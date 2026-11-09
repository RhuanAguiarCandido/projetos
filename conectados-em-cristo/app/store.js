// Camada de dados: Firebase (online, compartilhado) ou modo demonstração (localStorage).
//
// Acesso: somente com conta Google.
//   - No primeiro login a pessoa fica "pendente" até um admin aprovar.
//   - Só aprovados veem o repertório. Admins aprovam e definem membro/admin.
//   - O proprietário (DONO_EMAIL em config.js) é sempre admin.
import { firebaseConfig, DONO_EMAIL } from './config.js';
import { SEED } from './seed.js';

export const state = {
  hinos: [],
  eventos: [],         // cultos e ensaios: { id, data, hora, tipo, titulo, obs, hinos: [{ id, solistas: [{ uid, nome }] }] }
  devocionais: [],     // { id, data, referencia, versiculo, texto, autor, criadoEm }
  user: null,          // { uid, nome, email, foto }
  isAdmin: false,
  isDono: false,       // proprietário (DONO_EMAIL)
  papel: 'membro',     // membro | admin
  status: 'anonimo',   // anonimo | pendente | aprovado | recusado
  perfil: { favoritos: [], grifos: {} },
  usuarios: [],        // só para o Adm: cadastros de todos
  modo: 'demo',
  pronto: false,
  erro: null,
};
export const temAcesso = () => state.isAdmin || state.status === 'aprovado';

const listeners = new Set();
export const onChange = (f) => listeners.add(f);
const emit = () => listeners.forEach((f) => f());
const clone = (o) => JSON.parse(JSON.stringify(o));
const upsert = (arr, key, obj) => {
  const i = arr.findIndex((x) => x[key] === obj[key]);
  if (i >= 0) arr[i] = obj; else arr.push(obj);
};
const perfilVazio = () => ({ favoritos: [], grifos: {} });
const normEmail = (e) => String(e || '').trim().toLowerCase();

export class ErroAcesso extends Error {}
const erro = (msg) => new ErroAcesso(msg);

let impl;

// Quando o app está publicado no Firebase Hosting, a configuração do projeto
// vem do próprio servidor (/__/firebase/init.json) e não precisa estar no código.
async function lerConfig() {
  if (firebaseConfig && firebaseConfig.apiKey) return firebaseConfig;
  if (!/\.(web\.app|firebaseapp\.com)$/.test(location.hostname)) return null;
  try {
    const r = await fetch('/__/firebase/init.json', { cache: 'no-store' });
    const c = r.ok ? await r.json() : null;
    return c && c.apiKey ? c : null;
  } catch { return null; }
}

export async function init() {
  try {
    const cfg = await lerConfig();
    impl = cfg ? await firebase(cfg) : demo();
  } catch (e) {
    console.error(e);
    state.erro = 'Não foi possível conectar ao servidor. Usando o modo demonstração.';
    impl = demo();
  }
  state.pronto = true;
  emit();
}

export const api = {
  async salvarHinos(list) {
    list.forEach((h) => upsert(state.hinos, 'id', h));
    emit();
    await impl.putHinos(list);
  },
  salvarHino(h) { return api.salvarHinos([h]); },
  async excluirHino(id) {
    state.hinos = state.hinos.filter((h) => h.id !== id);
    emit();
    await impl.delHino(id);
  },
  async salvarEvento(e) {
    upsert(state.eventos, 'id', e);
    emit();
    await impl.putEvento(e);
  },
  async excluirEvento(id) {
    state.eventos = state.eventos.filter((e) => e.id !== id);
    emit();
    await impl.delEvento(id);
  },
  async salvarDevocional(d) {
    upsert(state.devocionais, 'id', d);
    emit();
    await impl.putDevocional(d);
  },
  async excluirDevocional(id) {
    state.devocionais = state.devocionais.filter((d) => d.id !== id);
    emit();
    await impl.delDevocional(id);
  },
  async salvarPerfil() {
    emit();
    await impl.putPerfil(state.perfil);
  },
  importarRepertorio: () => api.salvarHinos(clone(SEED)),

  // ---- backup ----
  // Cópia de hinos e agenda (e da lista de usuários, para consulta) num arquivo JSON.
  backup(versao) {
    return {
      app: 'repertorio-conectados', versao, exportadoEm: new Date().toISOString(), modo: state.modo,
      hinos: clone(state.hinos), eventos: clone(state.eventos), devocionais: clone(state.devocionais),
      usuarios: clone(state.usuarios), // só consulta: não é restaurado
    };
  },
  // Restaura hinos e agenda de um backup (só o proprietário). Não apaga nada que
  // não esteja no arquivo; hinos e eventos com o mesmo id são substituídos.
  async restaurar(dados) {
    if (!state.isDono) throw erro('Só o proprietário pode restaurar um backup.');
    if (!dados || dados.app !== 'repertorio-conectados' || !Array.isArray(dados.hinos) || !Array.isArray(dados.eventos)) {
      throw erro('Este arquivo não é um backup do Repertório.');
    }
    for (let i = 0; i < dados.hinos.length; i += 400) await api.salvarHinos(dados.hinos.slice(i, i + 400));
    for (const e of dados.eventos) await api.salvarEvento(e);
    const devs = Array.isArray(dados.devocionais) ? dados.devocionais : []; // backups antigos não têm
    for (const d of devs) await api.salvarDevocional(d);
    return { hinos: dados.hinos.length, eventos: dados.eventos.length, devocionais: devs.length };
  },

  // ---- acesso (só Google) ----
  entrarGoogle: (simulado) => impl.entrarGoogle(simulado),
  logout: () => impl.logout(),
  // Adm aprova/recusa (status) e define membro/admin (papel). O proprietário não pode ser alterado.
  async atualizarUsuario(uid, mudancas) {
    const u = state.usuarios.find((x) => x.uid === uid);
    if (!u || u.dono) throw erro('O proprietário não pode ser alterado.');
    Object.assign(u, mudancas);
    emit();
    await impl.atualizarUsuario(uid, mudancas);
  },
};

// =====================================================================
// Modo demonstração: tudo no localStorage deste aparelho.
// O login com Google é SIMULADO (nome + e-mail digitados), só para testar o
// fluxo de aprovação e os papéis num aparelho só.
// =====================================================================
function demo() {
  const K = 'cec-demo-v4';
  let db = null;
  try { db = JSON.parse(localStorage.getItem(K)); } catch {}
  if (!db) db = { hinos: clone(SEED), eventos: [], contas: [], sessao: null };
  state.modo = 'demo';
  state.hinos = db.hinos;
  state.eventos = db.eventos;
  state.devocionais = db.devocionais || (db.devocionais = []);

  const save = () => { try { localStorage.setItem(K, JSON.stringify(db)); } catch {} };
  const aplicar = () => {
    const c = db.contas.find((x) => x.uid === db.sessao);
    const dono = !!c && c.email === DONO_EMAIL;
    state.isDono = dono;
    state.papel = dono ? 'admin' : (c?.papel || 'membro');
    state.isAdmin = dono || (c?.papel === 'admin' && c?.status === 'aprovado');
    state.user = c ? { uid: c.uid, nome: c.nome, email: c.email } : null;
    state.status = !c ? 'anonimo' : (state.isAdmin ? 'aprovado' : c.status);
    state.perfil = c ? c.perfil : perfilVazio();
    if (c) c.perfil.desde = c.criadoEm;
    state.usuarios = state.isAdmin
      ? db.contas.map(({ uid, nome, email, status, papel, criadoEm }) => ({
        uid, nome, email, status, papel: papel || 'membro', criadoEm, dono: email === DONO_EMAIL,
      }))
      : [];
    save();
    emit();
  };
  aplicar();

  const salvar = () => { db.hinos = state.hinos; db.eventos = state.eventos; db.devocionais = state.devocionais; save(); };
  return {
    putHinos: salvar, delHino: salvar, putEvento: salvar, delEvento: salvar, putPerfil: save,
    putDevocional: salvar, delDevocional: salvar,
    entrarGoogle(simulado) {
      const nome = String(simulado?.nome || '').trim();
      const email = normEmail(simulado?.email);
      if (!/^\S+@\S+\.\S+$/.test(email)) throw erro('Digite um e-mail válido.');
      let c = db.contas.find((x) => x.email === email);
      if (!c) {
        const dono = email === DONO_EMAIL;
        c = { uid: 'u' + Date.now().toString(36), nome: nome || email, email, criadoEm: Date.now(),
          status: dono ? 'aprovado' : 'pendente', papel: dono ? 'admin' : 'membro', perfil: perfilVazio() };
        db.contas.push(c);
      }
      db.sessao = c.uid;
      aplicar();
    },
    logout() { db.sessao = null; aplicar(); },
    atualizarUsuario(uid, mudancas) {
      const c = db.contas.find((x) => x.uid === uid);
      if (c) Object.assign(c, mudancas);
      aplicar();
    },
  };
}

// =====================================================================
// Modo online: Firebase Auth (Google) + Firestore
// =====================================================================
async function firebase(cfg) {
  const B = 'https://www.gstatic.com/firebasejs/10.12.2/';
  const [{ initializeApp }, A, F] = await Promise.all([
    import(B + 'firebase-app.js'),
    import(B + 'firebase-auth.js'),
    import(B + 'firebase-firestore.js'),
  ]);
  const app = initializeApp(cfg);
  const auth = A.getAuth(app);
  const db = F.initializeFirestore(app, {
    // guarda os dados no aparelho: o app abre as letras mesmo sem internet
    localCache: F.persistentLocalCache({ tabManager: F.persistentMultipleTabManager() }),
  });
  state.modo = 'online';

  // Assinaturas que dependem de quem está logado (cada uma pode ser ligada/desligada)
  const parar = { dados: null, usuarios: null, perfil: null };
  const desligar = (k) => { if (parar[k]) { parar[k](); parar[k] = null; } };
  const ligarDados = () => {
    if (parar.dados) return;
    const a = F.onSnapshot(F.collection(db, 'hinos'), (s) => {
      state.hinos = s.docs.map((d) => ({ id: d.id, ...d.data() }));
      emit();
    }, () => {});
    const b = F.onSnapshot(F.collection(db, 'eventos'), (s) => {
      state.eventos = s.docs.map((d) => ({ id: d.id, ...d.data() }));
      emit();
    }, () => {});
    const c = F.onSnapshot(F.collection(db, 'devocionais'), (s) => {
      state.devocionais = s.docs.map((d) => ({ id: d.id, ...d.data() }));
      emit();
    }, () => {});
    parar.dados = () => { a(); b(); c(); };
  };
  const ligarUsuarios = () => {
    if (parar.usuarios) return;
    parar.usuarios = F.onSnapshot(F.collection(db, 'usuarios'), (s) => {
      state.usuarios = s.docs
        .map((d) => ({ uid: d.id, ...d.data() }))
        .map(({ uid, nome, email, status, papel, criadoEm }) => ({
          uid, nome, email, status, papel: papel || 'membro', criadoEm, dono: email === DONO_EMAIL,
        }));
      emit();
    }, () => {});
  };

  await new Promise((pronto) => A.onAuthStateChanged(auth, async (u) => {
    Object.keys(parar).forEach(desligar);
    Object.assign(state, { user: null, isAdmin: false, isDono: false, papel: 'membro', status: 'anonimo', perfil: perfilVazio(), usuarios: [], hinos: [], eventos: [], devocionais: [] });
    if (!u) { emit(); pronto(); return; }

    state.user = { uid: u.uid, nome: u.displayName || u.email, email: u.email, foto: u.photoURL };
    // proprietário: e-mail do dono, verificado pelo Google
    const dono = u.email === DONO_EMAIL && u.emailVerified;
    const admNato = dono;
    state.isDono = dono;

    const ref = F.doc(db, 'usuarios', u.uid);
    try {
      const snap = await F.getDoc(ref);
      if (!snap.exists()) {
        await F.setDoc(ref, {
          nome: state.user.nome, email: u.email, criadoEm: Date.now(),
          status: admNato ? 'aprovado' : 'pendente', papel: admNato ? 'admin' : 'membro',
          ...perfilVazio(),
        });
      }
    } catch (e) { console.error(e); }

    // o próprio cadastro: aprovação, papel, favoritos e grifos chegam ao vivo
    parar.perfil = F.onSnapshot(ref, (d) => {
      const dados = d.data() || {};
      state.perfil = { ...perfilVazio(), favoritos: dados.favoritos || [], grifos: dados.grifos || {}, vistos: dados.vistos || [], desde: dados.criadoEm || 0, aparencia: dados.aparencia || null };
      state.papel = admNato ? 'admin' : (dados.papel || 'membro');
      state.isAdmin = admNato || (dados.papel === 'admin' && dados.status === 'aprovado');
      state.status = state.isAdmin ? 'aprovado' : (dados.status || 'pendente');
      if (dados.nome) state.user.nome = dados.nome;
      if (state.status === 'aprovado') ligarDados(); else desligar('dados');
      if (state.isAdmin) ligarUsuarios(); else { desligar('usuarios'); state.usuarios = []; }
      emit();
    }, () => {});
    emit();
    pronto();
  }));

  const semId = ({ id, ...resto }) => resto;
  const traduz = (e) => {
    const c = e?.code || '';
    if (c.includes('too-many-requests')) return erro('Muitas tentativas. Espere alguns minutos.');
    if (c.includes('popup-closed')) return erro('Login cancelado.');
    if (c.includes('network')) return erro('Sem conexão com a internet.');
    return erro('Não foi possível concluir. Tente de novo.');
  };
  const tentar = async (f) => { try { return await f(); } catch (e) { console.error(e); throw e instanceof ErroAcesso ? e : traduz(e); } };

  return {
    async putHinos(list) {
      const b = F.writeBatch(db);
      list.forEach((h) => b.set(F.doc(db, 'hinos', h.id), semId(h)));
      await b.commit();
    },
    delHino: (id) => F.deleteDoc(F.doc(db, 'hinos', id)),
    putEvento: (e) => F.setDoc(F.doc(db, 'eventos', e.id), semId(e)),
    delEvento: (id) => F.deleteDoc(F.doc(db, 'eventos', id)),
    putDevocional: (d) => F.setDoc(F.doc(db, 'devocionais', d.id), semId(d)),
    delDevocional: (id) => F.deleteDoc(F.doc(db, 'devocionais', id)),
    putPerfil: (p) => state.user && F.updateDoc(F.doc(db, 'usuarios', state.user.uid), { favoritos: p.favoritos || [], grifos: p.grifos || {}, vistos: p.vistos || [], aparencia: p.aparencia || null }),
    entrarGoogle: () => tentar(async () => {
      const prov = new A.GoogleAuthProvider();
      prov.setCustomParameters({ prompt: 'select_account' });
      try {
        await A.signInWithPopup(auth, prov);
      } catch (e) {
        // app instalado / navegador que bloqueia pop-up: faz o login redirecionando a página
        if (/popup-blocked|operation-not-supported|cancelled-popup/.test(e?.code || '')) await A.signInWithRedirect(auth, prov);
        else throw e;
      }
    }),
    logout: () => A.signOut(auth),
    atualizarUsuario: (uid, mudancas) => F.updateDoc(F.doc(db, 'usuarios', uid), mudancas),
  };
}
