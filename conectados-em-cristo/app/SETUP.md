# Colocar o Hinário no ar

Leva uns 20 minutos e é gratuito para o tamanho do grupo (plano Spark do Firebase).
Faça logado com a conta **rhuan.4b@gmail.com**, que é a proprietária do app.

## 1. Criar o projeto no Firebase
1. Acesse <https://console.firebase.google.com> → **Adicionar projeto**
   (ex.: `conectados-em-cristo`). O Google Analytics pode ficar desligado.
2. **Criação → Authentication → Começar** e ative dois provedores:
   - **Google** (você e quem quiser entrar com Google)
   - **E-mail/senha** (cadastro dos jovens e o usuário `admin`)
3. **Criação → Firestore Database → Criar banco de dados**: região
   `southamerica-east1 (São Paulo)`, modo **produção**.
4. Aba **Regras** do Firestore: apague tudo, cole o arquivo
   [`firestore.rules`](firestore.rules) e clique em **Publicar**.

## 2. Ligar o app ao projeto
1. **⚙ Configurações do projeto → Seus apps → ícone Web `</>`**: dê um nome e
   registre (não precisa marcar o Hosting aqui).
2. Copie o objeto `firebaseConfig` que aparece. Esses dados **não são secretos**
   (vão dentro de qualquer app web); pode colar no chat que eu coloco no
   [`config.js`](config.js), ou cole você mesmo no lugar de `null`.

## 3. Acesso do usuário `admin` (opcional)
Você, como proprietário, já é admin entrando com o Google. O usuário `admin`
(usuário e senha) é um acesso extra compartilhado. Para ativá-lo:

1. **Authentication → Usuários → Adicionar usuário**
   - E-mail: `admin@hinario-conectados.app` (não precisa existir)
   - Senha: **a senha do Adm seguida de `-cec`**. O Firebase exige 6+
     caracteres; o app soma o `-cec` sozinho, então no app se digita só a senha.
2. **Firestore → Iniciar coleção** `admins` → documento com **ID
   `admin@hinario-conectados.app`** (um campo qualquer, ex.: `nome: admin`).

> Faça os dois passos juntos: se a conta `admin@hinario-conectados.app` não
> for criada por você, alguém poderia criá-la pelo cadastro do app. Sem o
> documento em `admins`, ela não teria poder de admin, mas é melhor não deixar
> o e-mail livre. Se não quiser esse acesso, pule este passo.

## 4. Publicar o app
Escolha **uma** das opções.

### Opção A — publicação automática pelo GitHub (recomendada)
Toda alteração no app que chegar na branch `main` é publicada sozinha.

1. No Firebase: **⚙ Configurações do projeto → Contas de serviço → Gerar nova
   chave privada**. Baixa um arquivo `.json`. **Ele é secreto: não cole no chat
   nem no repositório.**
2. No GitHub, no repositório `projetos`: **Settings → Secrets and variables →
   Actions**
   - aba **Secrets** → *New repository secret* → nome
     `FIREBASE_SERVICE_ACCOUNT`, valor: todo o conteúdo do `.json`
   - aba **Variables** → *New repository variable* → nome
     `FIREBASE_PROJECT_ID`, valor: o ID do projeto (ex.: `conectados-em-cristo`)
3. No Google Cloud do projeto, ative a **Firebase Hosting API** e a **Cloud
   Firestore API** se o deploy pedir (o erro mostra o link direto).
4. Junte a branch do app na `main` (pull request). A aba **Actions** mostra a
   publicação "Publicar Hinário"; também dá para rodá-la à mão por lá.

### Opção B — pelo seu computador
```bash
npm install -g firebase-tools
firebase login                     # com rhuan.4b@gmail.com
cd conectados-em-cristo/app
firebase deploy --only hosting,firestore:rules --project SEU-PROJETO-ID
```

O endereço fica `https://SEU-PROJETO-ID.web.app`.

## 5. Primeiro acesso
1. Abra o endereço e toque em **Continuar com Google** com `rhuan.4b@gmail.com`.
   Você entra direto como **Proprietário** (sem aprovação).
2. **Conta → Importar repertório inicial (41 hinos)**.
3. Mande o link para os jovens. Cada um faz o cadastro e fica aguardando; em
   **Conta → Usuários** você aprova como **membro** ou **admin**, e pode trocar
   o papel ou remover o acesso quando quiser.
4. No celular, instale pelo menu do navegador → **Adicionar à tela de início**.

## Papéis
| Papel | Como vira | Pode |
|---|---|---|
| **Proprietário** | `rhuan.4b@gmail.com` entrando com Google | Tudo; ninguém pode rebaixá-lo |
| **Admin** | Aprovado como admin, ou trocado em *Usuários* | Editar hinos, cultos e grifos padrão; aprovar, recusar e trocar membros/admins |
| **Membro** | Aprovado como membro | Ver hinos e agenda, grifar, favoritar |
| Aguardando | Acabou de se cadastrar | Só vê a tela de espera |
