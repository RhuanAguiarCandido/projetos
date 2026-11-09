# Colocar o Repertório no ar

Projeto Firebase: **`conectados-em-cristo-fe363`**
(<https://console.firebase.google.com/project/conectados-em-cristo-fe363/overview>)

Endereço do app depois de publicado: **<https://conectados-em-cristo-fe363.web.app>**

Faça tudo logado com **rhuan.4b@gmail.com**, o proprietário do app.

## 1. Configurar o projeto (no console do Firebase)
1. **Criação → Authentication → Começar → Sign-in method**: ative **somente o
   Google** (escolha o e-mail de suporte e salve).
2. **Criação → Firestore Database → Criar banco de dados**: região
   `southamerica-east1 (São Paulo)`, modo **produção**.
   (As regras de segurança são publicadas junto com o app; não precisa colar.)
3. **⚙ Configurações do projeto → Geral → Seus apps → ícone Web `</>`**:
   apelido `Repertório`, registre. Não precisa copiar o código que aparece:
   publicado no Firebase, o app lê essa configuração sozinho.

## 2. Plano de cobrança
O plano gratuito (**Spark**) atende o grupo. Não é preciso ativar o Blaze.

## 3. Publicar
Escolha **uma** das opções.

### Opção A: pelo seu computador (mais rápida para a 1ª vez)
Precisa do [Node.js](https://nodejs.org) instalado.
```bash
npm install -g firebase-tools
firebase login                         # entre com rhuan.4b@gmail.com
git clone https://github.com/rhuanaguiarcandido/projetos.git
cd projetos
git checkout claude/admiring-lovelace-ibx930
cd conectados-em-cristo/app
firebase deploy --only hosting,firestore:rules
```
O projeto já está configurado no arquivo `.firebaserc`, então não precisa
informar o ID.

### Opção B: publicação automática pelo GitHub
Depois de configurada, toda alteração no app que chegar na branch `main` é
publicada sozinha.

1. No Firebase: **⚙ Configurações do projeto → Contas de serviço → Gerar nova
   chave privada**. Isso baixa um arquivo `.json`. **Ele é secreto: não cole no
   chat nem no repositório.**
2. No [Google Cloud IAM do projeto](https://console.cloud.google.com/iam-admin/iam?project=conectados-em-cristo-fe363),
   encontre a conta `firebase-adminsdk-…@conectados-em-cristo-fe363.iam.gserviceaccount.com`,
   clique no lápis e adicione o papel **Administrador do Firebase**
   (`Firebase Admin`).
3. No GitHub, repositório `projetos` → **Settings → Secrets and variables →
   Actions → New repository secret**: nome `FIREBASE_SERVICE_ACCOUNT`, valor:
   todo o conteúdo do `.json`.
4. Junte a branch do app na `main` (pull request). A aba **Actions** mostra
   "Publicar Repertório"; dá para rodar à mão também (*Run workflow*).

## 4. Primeiro acesso
1. Abra <https://conectados-em-cristo-fe363.web.app> e toque em **Continuar com
   Google** com `rhuan.4b@gmail.com`. Você entra direto como **Proprietário**.
2. **Conta → Importar repertório inicial (41 hinos)**.
3. Mande o link para os jovens. Cada um entra com a própria conta Google e fica
   aguardando; em **Conta → Usuários** você aprova como **membro** ou **admin**,
   e pode trocar o papel ou remover o acesso quando quiser.
4. No celular, instale pelo menu do navegador → **Adicionar à tela de início**.

## Se algo der errado
- **"auth/unauthorized-domain"** ao entrar: em *Authentication → Configurações →
  Domínios autorizados*, confira se `conectados-em-cristo-fe363.web.app` está na
  lista (normalmente já vem).
- **O app abre em "modo demonstração"**: falta registrar o app Web (passo 1.3).
  Publique de novo depois de registrar.
- **Erro de permissão no deploy pelo GitHub**: falta o papel do passo 3B.2.

## Papéis
| Papel | Como vira | Pode |
|---|---|---|
| **Proprietário** | `rhuan.4b@gmail.com` entrando com Google | Tudo; ninguém pode rebaixá-lo |
| **Admin** | Aprovado como admin, ou trocado em *Usuários* | Editar hinos, cultos e grifos padrão; aprovar e trocar membros/admins |
| **Membro** | Aprovado como membro | Ver hinos e agenda, grifar, favoritar |
| Aguardando | Entrou com Google pela primeira vez | Só vê a tela de espera |
