// Camada de dados: Firebase (online, compartilhado) ou modo demonstração (localStorage).
import { firebaseConfig } from './config.js';
import { SEED } from './seed.js';

export const state = {
  hinos: [],
  cultos: [],
  user: null,
  isAdmin: false,
  perfil: { favoritos: [], grifos: {} },
  modo: 'demo',
  pronto: false,
  erro: null,
};

const listeners = new Set();
export const onChange = (f) => listeners.add(f);
const emit = () => listeners.forEach((f) => f());
const clone = (o) => JSON.parse(JSON.stringify(o));
const upsert = (arr, key, obj) => {
  const i = arr.findIndex((x) => x[key] === obj[key]);
  if (i >= 0) arr[i] = obj; else arr.push(obj);
};

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
  login: () => impl.login(),
  logout: () => impl.logout(),
  importarRepertorio: () => api.salvarHinos(clone(SEED)),
};

// ---------- Modo demonstração: tudo no localStorage deste aparelho ----------
function demo() {
  const K = 'cec-demo-v1';
  let db = null;
  try { db = JSON.parse(localStorage.getItem(K)); } catch {}
  if (!db) db = { hinos: clone(SEED), cultos: [], perfil: { favoritos: [], grifos: {} }, admin: false };
  Object.assign(state, {
    modo: 'demo',
    hinos: db.hinos,
    cultos: db.cultos,
    perfil: db.perfil,
    isAdmin: db.admin,
    user: { nome: 'Visitante (demonstração)' },
  });
  const save = () => {
    try {
      localStorage.setItem(K, JSON.stringify({
        hinos: state.hinos, cultos: state.cultos, perfil: state.perfil, admin: state.isAdmin,
      }));
    } catch {}
  };
  return {
    putHinos: save, delHino: save, putCulto: save, delCulto: save, putPerfil: save,
    login() { state.isAdmin = true; save(); emit(); },   // no demo, "entrar" = virar Adm
    logout() { state.isAdmin = false; save(); emit(); },
  };
}

// ---------- Modo online: Firebase Auth (Google) + Firestore ----------
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

  F.onSnapshot(F.collection(db, 'hinos'), (s) => {
    state.hinos = s.docs.map((d) => ({ id: d.id, ...d.data() }));
    emit();
  });
  F.onSnapshot(F.collection(db, 'cultos'), (s) => {
    state.cultos = s.docs.map((d) => ({ data: d.id, ...d.data() }));
    emit();
  });

  let pararPerfil = null;
  await new Promise((pronto) => A.onAuthStateChanged(auth, async (u) => {
    if (pararPerfil) pararPerfil();
    pararPerfil = null;
    state.user = u ? { nome: u.displayName || u.email, email: u.email, uid: u.uid, foto: u.photoURL } : null;
    state.isAdmin = false;
    state.perfil = { favoritos: [], grifos: {} };
    if (u) {
      try { state.isAdmin = (await F.getDoc(F.doc(db, 'admins', u.email))).exists(); } catch {}
      pararPerfil = F.onSnapshot(F.doc(db, 'usuarios', u.uid), (d) => {
        if (d.exists()) state.perfil = { favoritos: [], grifos: {}, ...d.data() };
        emit();
      });
    }
    emit();
    pronto();
  }));

  const semId = ({ id, ...resto }) => resto;
  return {
    async putHinos(list) {
      const b = F.writeBatch(db);
      list.forEach((h) => b.set(F.doc(db, 'hinos', h.id), semId(h)));
      await b.commit();
    },
    delHino: (id) => F.deleteDoc(F.doc(db, 'hinos', id)),
    putCulto: ({ data, ...resto }) => F.setDoc(F.doc(db, 'cultos', data), resto),
    delCulto: (data) => F.deleteDoc(F.doc(db, 'cultos', data)),
    putPerfil: (p) => state.user && F.setDoc(F.doc(db, 'usuarios', state.user.uid), p),
    login: () => A.signInWithPopup(auth, new A.GoogleAuthProvider()),
    logout: () => A.signOut(auth),
  };
}
