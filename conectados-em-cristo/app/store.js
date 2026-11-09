// Camada de dados: Firebase (online, compartilhado) ou modo demonstração (localStorage).
//
// Acesso:
//   - Quem quer usar faz o cadastro (nome, e-mail, senha) ou entra com Google.
//   - O cadastro fica "pendente" até o Adm aprovar. Só aprovados (e o Adm) veem o hinário.
//   - O Adm entra com usuário + senha (ADMIN_USUARIO em config.js).
import { firebaseConfig, ADMIN_USUARIO, ADMIN_EMAIL } from './config.js';
import { SEED } from './seed.js';

export const state = {
  hinos: [],
  cultos: [],
  user: null,          // { uid, nome, email, foto }
  isAdmin: false,
  status: 'anonimo',   // anonimo | pendente | aprovado | recusado
  perfil: { favoritos: [], grifos: {} },
  usuarios: [],        // só para o Adm: cadastros de todos
  modo: 'demo',
  pronto: false,
  erro: null,
};
export const temAcesso = () => state.isAdmin || state.status === 'aprovado';

// O Firebase exige senha com 6+ caracteres; este sufixo é somado à senha do Adm.
const SUFIXO_SENHA_ADM = '-cec';
// Modo demonstração: só o hash SHA-256 da senha do Adm fica no código, nunca a senha.
const HASH_SENHA_ADM_DEMO = '1118ebe7618c13369a6a50e238ab3d3953e271c22e9614c72f5ebd5c8060d7d0';

async function sha256(t) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
}

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

  // ---- acesso ----
  async cadastrar(nome, email, senha) {
    nome = String(nome || '').trim();
    email = normEmail(email);
    if (nome.length < 2) throw erro('Informe seu nome.');
    if (!/^\S+@\S+\.\S+$/.test(email)) throw erro('E-mail inválido.');
    if (String(senha).length < 6) throw erro('A senha precisa ter pelo menos 6 caracteres.');
    await impl.cadastrar(nome, email, senha);
  },
  entrar: (email, senha) => impl.entrar(normEmail(email), senha),
  entrarGoogle: () => impl.entrarGoogle(),
  async loginAdm(usuario, senha) {
    if (String(usuario).trim().toLowerCase() !== ADMIN_USUARIO || !senha) throw erro('Usuário ou senha incorretos.');
    await impl.loginAdm(senha);
  },
  esqueciSenha: (email) => impl.esqueciSenha(normEmail(email)),
  logout: () => impl.logout(),
  async definirStatus(uid, status) {
    const u = state.usuarios.find((x) => x.uid === uid);
    if (u) u.status = status;
    emit();
    await impl.definirStatus(uid, status);
  },
};

// =====================================================================
// Modo demonstração: tudo no localStorage deste aparelho.
// Dá para simular vários cadastros e aprová-los como Adm no mesmo aparelho.
// =====================================================================
function demo() {
  const K = 'cec-demo-v2';
  let db = null;
  try { db = JSON.parse(localStorage.getItem(K)); } catch {}
  if (!db) db = { hinos: clone(SEED), cultos: [], contas: [], sessao: null, perfilAdm: perfilVazio() };
  state.modo = 'demo';
  state.hinos = db.hinos;
  state.cultos = db.cultos;

  const save = () => { try { localStorage.setItem(K, JSON.stringify(db)); } catch {} };
  const aplicar = () => {
    state.isAdmin = db.sessao === 'adm';
    const c = db.contas.find((x) => x.uid === db.sessao);
    if (state.isAdmin) {
      state.user = { uid: 'adm', nome: 'Administrador', email: ADMIN_USUARIO };
      state.status = 'aprovado';
      state.perfil = db.perfilAdm;
    } else if (c) {
      state.user = { uid: c.uid, nome: c.nome, email: c.email };
      state.status = c.status;
      state.perfil = c.perfil;
    } else {
      state.user = null;
      state.status = 'anonimo';
      state.perfil = perfilVazio();
    }
    state.usuarios = state.isAdmin
      ? db.contas.map(({ uid, nome, email, status, criadoEm }) => ({ uid, nome, email, status, criadoEm }))
      : [];
    save();
    emit();
  };
  aplicar();

  const salvar = () => { db.hinos = state.hinos; db.cultos = state.cultos; save(); };
  return {
    putHinos: salvar, delHino: salvar, putCulto: salvar, delCulto: salvar, putPerfil: save,
    async cadastrar(nome, email, senha) {
      if (db.contas.some((c) => c.email === email)) throw erro('Este e-mail já tem cadastro. Use "Entrar".');
      const uid = 'u' + Date.now().toString(36);
      db.contas.push({ uid, nome, email, hash: await sha256(email + ':' + senha), status: 'pendente', criadoEm: Date.now(), perfil: perfilVazio() });
      db.sessao = uid;
      aplicar();
    },
    async entrar(email, senha) {
      const c = db.contas.find((x) => x.email === email);
      if (!c || c.hash !== (await sha256(email + ':' + senha))) throw erro('E-mail ou senha incorretos.');
      db.sessao = c.uid;
      aplicar();
    },
    entrarGoogle() { throw erro('O login com Google só funciona com o app ligado ao Firebase.'); },
    async loginAdm(senha) {
      if ((await sha256(senha)) !== HASH_SENHA_ADM_DEMO) throw erro('Usuário ou senha incorretos.');
      db.sessao = 'adm';
      aplicar();
    },
    esqueciSenha() { throw erro('No modo demonstração não há envio de e-mail.'); },
    logout() { db.sessao = null; aplicar(); },
    definirStatus(uid, status) {
      const c = db.contas.find((x) => x.uid === uid);
      if (c) c.status = status;
      aplicar();
    },
  };
}

// =====================================================================
// Modo online: Firebase Auth (e-mail/senha e Google) + Firestore
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

  // Assinaturas que dependem de quem está logado
  let parar = [];
  const pararTudo = () => { parar.forEach((f) => f()); parar = []; };
  let dadosAssinados = false;
  let usuariosAssinados = false;
  const assinarDados = () => {
    if (dadosAssinados) return;
    dadosAssinados = true;
    parar.push(F.onSnapshot(F.collection(db, 'hinos'), (s) => {
      state.hinos = s.docs.map((d) => ({ id: d.id, ...d.data() }));
      emit();
    }));
    parar.push(F.onSnapshot(F.collection(db, 'cultos'), (s) => {
      state.cultos = s.docs.map((d) => ({ data: d.id, ...d.data() }));
      emit();
    }));
  };
  const assinarUsuarios = () => {
    if (usuariosAssinados) return;
    usuariosAssinados = true;
    parar.push(F.onSnapshot(F.collection(db, 'usuarios'), (s) => {
      state.usuarios = s.docs
        .map((d) => ({ uid: d.id, ...d.data() }))
        .filter((u) => !u.adm)
        .map(({ uid, nome, email, status, criadoEm }) => ({ uid, nome, email, status, criadoEm }));
      emit();
    }));
  };

  let nomeDoCadastro = null; // nome digitado no cadastro, usado ao criar o documento
  await new Promise((pronto) => A.onAuthStateChanged(auth, async (u) => {
    pararTudo();
    dadosAssinados = false;
    usuariosAssinados = false;
    Object.assign(state, { user: null, isAdmin: false, status: 'anonimo', perfil: perfilVazio(), usuarios: [], hinos: [], cultos: [] });
    if (!u) { emit(); pronto(); return; }

    state.user = { uid: u.uid, nome: u.displayName || nomeDoCadastro || u.email, email: u.email, foto: u.photoURL };
    try { state.isAdmin = (await F.getDoc(F.doc(db, 'admins', u.email))).exists(); } catch {}

    const ref = F.doc(db, 'usuarios', u.uid);
    try {
      const snap = await F.getDoc(ref);
      if (!snap.exists()) {
        await F.setDoc(ref, {
          nome: state.user.nome, email: u.email, criadoEm: Date.now(),
          status: state.isAdmin ? 'aprovado' : 'pendente', adm: state.isAdmin,
          ...perfilVazio(),
        });
      }
    } catch (e) { console.error(e); }
    nomeDoCadastro = null;

    parar.push(F.onSnapshot(ref, (d) => {
      const dados = d.data() || {};
      state.perfil = { ...perfilVazio(), favoritos: dados.favoritos || [], grifos: dados.grifos || {} };
      state.status = state.isAdmin ? 'aprovado' : (dados.status || 'pendente');
      if (dados.nome) state.user.nome = dados.nome;
      if (state.isAdmin || state.status === 'aprovado') assinarDados(); // libera assim que o Adm aprovar
      if (state.isAdmin) assinarUsuarios();
      emit();
    }));
    emit();
    pronto();
  }));

  const semId = ({ id, ...resto }) => resto;
  const traduz = (e) => {
    const c = e?.code || '';
    if (c.includes('email-already-in-use')) return erro('Este e-mail já tem cadastro. Use "Entrar".');
    if (c.includes('invalid-credential') || c.includes('wrong-password') || c.includes('user-not-found')) return erro('E-mail ou senha incorretos.');
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
    cadastrar: (nome, email, senha) => tentar(async () => {
      nomeDoCadastro = nome;
      const cred = await A.createUserWithEmailAndPassword(auth, email, senha);
      await A.updateProfile(cred.user, { displayName: nome });
    }),
    entrar: (email, senha) => tentar(() => A.signInWithEmailAndPassword(auth, email, senha)),
    entrarGoogle: () => tentar(() => A.signInWithPopup(auth, new A.GoogleAuthProvider())),
    loginAdm: (senha) => tentar(() => A.signInWithEmailAndPassword(auth, ADMIN_EMAIL, senha + SUFIXO_SENHA_ADM)),
    esqueciSenha: (email) => tentar(() => A.sendPasswordResetEmail(auth, email)),
    logout: () => A.signOut(auth),
    definirStatus: (uid, status) => F.updateDoc(F.doc(db, 'usuarios', uid), { status }),
  };
}
