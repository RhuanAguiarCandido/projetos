// Camada de dados: Firebase (online, compartilhado) ou modo demonstração (localStorage).
//
// Acesso: somente com conta Google.
//   - No primeiro login a pessoa fica "pendente" até um admin aprovar.
//   - Só aprovados veem o hinário. Admins aprovam e definem membro/admin.
//   - O proprietário (DONO_EMAIL em config.js) é sempre admin.
import { firebaseConfig, DONO_EMAIL } from './config.js';
import { SEED } from './seed.js';

export const state = {
  hinos: [],
  cultos: [],
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

export async function init() {
  try {
    impl = firebaseConfig && firebaseConfig.apiKey ? await firebase() : demo();
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
  async salvarCulto(c) {
    upsert(state.cultos, 'data', c);
    emit();
    await impl.putCulto(c);
  },
  async excluirCulto(data) {
    state.cultos = state.cultos.filter((c) => c.data !== data);
    emit();
    await impl.delCulto(data);
  },
  async salvarPerfil() {
    emit();
    await impl.putPerfil(state.perfil);
  },
  importarRepertorio: () => api.salvarHinos(clone(SEED)),

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
  const K = 'cec-demo-v3';
  let db = null;
  try { db = JSON.parse(localStorage.getItem(K)); } catch {}
  if (!db) db = { hinos: clone(SEED), cultos: [], contas: [], sessao: null };
  state.modo = 'demo';
  state.hinos = db.hinos;
  state.cultos = db.cultos;

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
    state.usuarios = state.isAdmin
      ? db.contas.map(({ uid, nome, email, status, papel, criadoEm }) => ({
        uid, nome, email, status, papel: papel || 'membro', criadoEm, dono: email === DONO_EMAIL,
      }))
      : [];
    save();
    emit();
  };
  aplicar();

  const salvar = () => { db.hinos = state.hinos; db.cultos = state.cultos; save(); };
  return {
    putHinos: salvar, delHino: salvar, putCulto: salvar, delCulto: salvar, putPerfil: save,
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
async function firebase() {
  const B = 'https://www.gstatic.com/firebasejs/10.12.2/';
  const [{ initializeApp }, A, F] = await Promise.all([
    import(B + 'firebase-app.js'),
    import(B + 'firebase-auth.js'),
    import(B + 'firebase-firestore.js'),
  ]);
  const app = initializeApp(firebaseConfig);
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
    const b = F.onSnapshot(F.collection(db, 'cultos'), (s) => {
      state.cultos = s.docs.map((d) => ({ data: d.id, ...d.data() }));
      emit();
    }, () => {});
    parar.dados = () => { a(); b(); };
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
    Object.assign(state, { user: null, isAdmin: false, isDono: false, papel: 'membro', status: 'anonimo', perfil: perfilVazio(), usuarios: [], hinos: [], cultos: [] });
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
      state.perfil = { ...perfilVazio(), favoritos: dados.favoritos || [], grifos: dados.grifos || {} };
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
    putCulto: ({ data, ...resto }) => F.setDoc(F.doc(db, 'cultos', data), resto),
    delCulto: (data) => F.deleteDoc(F.doc(db, 'cultos', data)),
    putPerfil: (p) => state.user && F.updateDoc(F.doc(db, 'usuarios', state.user.uid), { favoritos: p.favoritos || [], grifos: p.grifos || {} }),
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
