# Colocar o Hinário no ar para o grupo

Leva uns 20 minutos e é gratuito para o tamanho do grupo (plano Spark do Firebase).

## 1. Criar o projeto no Firebase
1. Acesse <https://console.firebase.google.com> e clique em **Adicionar projeto**
   (ex.: `conectados-em-cristo`). O Google Analytics pode ficar desligado.
2. Em **Criação → Authentication → Começar**, ative os provedores **Google**
   (para os jovens) e **E-mail/senha** (para o Adm).
3. Em **Criação → Firestore Database → Criar banco de dados**, escolha a região
   `southamerica-east1 (São Paulo)` e o modo **produção**.
4. Na aba **Regras** do Firestore, apague o conteúdo, cole o arquivo
   [`firestore.rules`](firestore.rules) e clique em **Publicar**.

## 2. Ligar o app ao projeto
1. Em **Configurações do projeto (⚙) → Seus apps**, clique no ícone **Web `</>`**,
   dê um nome e registre.
2. Copie o objeto `firebaseConfig` que aparece e cole em [`config.js`](config.js)
   no lugar de `null`.

## 3. Criar o acesso do Adm (usuário `admin`)
No app, o Adm entra em **Conta → Acesso do Adm** com o usuário `admin` e a senha
combinada. Por trás, isso usa uma conta de e-mail no Firebase:

1. Em **Authentication → Usuários → Adicionar usuário**:
   - E-mail: `admin@hinario-conectados.app` (o mesmo de `ADMIN_EMAIL` em `config.js`;
     não precisa ser um e-mail que existe)
   - Senha: **a senha do Adm seguida de `-cec`** (ex.: se a senha fosse `abc`,
     cadastre `abc-cec`). O Firebase exige 6 caracteres ou mais; o app soma o
     `-cec` sozinho, então o Adm digita só a senha normal.
2. No Firestore, crie a coleção **`admins`** e, dentro dela, um documento com
   **ID `admin@hinario-conectados.app`** (pode ter um campo qualquer, como `nome`).
   É isso que libera as funções de Adm.

Para trocar a senha depois: em *Authentication → Usuários*, redefina a senha da
conta (lembrando do `-cec` no final).

## 4. Publicar o app
Qualquer hospedagem de site estático serve. Duas opções simples:

- **Firebase Hosting**: instale o Firebase CLI, rode `firebase init hosting`
  dentro de `conectados-em-cristo/app` (pasta pública: `.`), depois
  `firebase deploy`. O endereço fica `https://SEU-PROJETO.web.app`.
- **GitHub Pages**: em *Settings → Pages* do repositório, publique a branch e
  acesse `.../conectados-em-cristo/app/`.

Depois de publicar, em **Authentication → Configurações → Domínios autorizados**,
confira se o endereço do site está na lista.

## 5. Primeiro acesso
1. Abra o app e vá em **Conta → Acesso do Adm** (usuário `admin`).
2. Clique em **Importar repertório inicial (41 hinos)**.
3. Mande o link para os jovens. No celular: menu do navegador →
   **Adicionar à tela de início**.
