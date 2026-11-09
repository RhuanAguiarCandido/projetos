// Configuração do Firebase (banco de dados + login com Google).
//
// Enquanto estiver `null`, o app roda em MODO DEMONSTRAÇÃO: tudo funciona,
// mas os dados ficam salvos só no aparelho de quem está usando.
//
// Para colocar no ar para o grupo todo, siga o passo a passo em SETUP.md e
// cole aqui o objeto que o Firebase mostra, por exemplo:
//
// export const firebaseConfig = {
//   apiKey: "AIza...",
//   authDomain: "conectados-em-cristo.firebaseapp.com",
//   projectId: "conectados-em-cristo",
//   storageBucket: "conectados-em-cristo.appspot.com",
//   messagingSenderId: "123456789",
//   appId: "1:123456789:web:abc123"
// };

export const firebaseConfig = null;

// Acesso do administrador: usuário + senha (tela Conta → "Acesso do Adm").
// No modo online, o usuário abaixo entra com a conta de e-mail ADMIN_EMAIL,
// criada no Firebase Authentication (veja SETUP.md, passo 3).
export const ADMIN_USUARIO = 'admin';

// Proprietário do app: sempre Adm, entra com Google e ninguém pode rebaixá-lo.
export const DONO_EMAIL = 'rhuan.4b@gmail.com';
export const ADMIN_EMAIL = 'admin@hinario-conectados.app';
