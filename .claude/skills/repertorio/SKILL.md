---
name: repertorio
description: Prepara a sessão para alterar o app Repertório (Conectados em Cristo) — sincroniza o repositório, lê o guia do projeto, compara a versão do código com a versão publicada no Firebase, cria um ponto de restauração (backup do código) e lembra do backup dos dados. Use quando o dono digitar /repertorio, ou pedir para "preparar", "ler tudo" ou "fazer backup" antes de mexer no app.
---

# Preparar o Repertório para alterações

Fale sempre em **português do Brasil**, em linguagem simples: o dono não é
programador. Faça os passos abaixo em ordem e, no fim, mostre um resumo curto.
Não altere nada do app nesta etapa: só prepare e espere o pedido.

## 1. Sincronizar o repositório
1. `git fetch origin --tags`.
2. Escolha a branch de trabalho: a **branch principal** do repositório
   (`git remote show origin | grep "HEAD branch"`; hoje é `claude/entrellun-video`),
   desde que ela já tenha `conectados-em-cristo/app/version.json`. Se não tiver,
   use `claude/admiring-lovelace-ibx930` (onde o app foi criado).
   Se a sessão já estiver numa branch designada pelo sistema, trabalhe nela, mas
   traga as mudanças da branch acima (`git merge origin/<branch>`) se estiver atrás.
3. `git status`: se houver alterações não salvas que não são suas, **pare e
   pergunte** ao dono antes de seguir.
4. `git pull` na branch escolhida.

## 2. Ler o projeto
Leia, nesta ordem: `CLAUDE.md` (raiz), `conectados-em-cristo/app/README.md`,
`conectados-em-cristo/app/SETUP.md`. Passe os olhos em `app.js` e `store.js` para
saber onde ficam as telas e os dados. Não precisa resumir isso para o dono.

## 3. Comparar versões (código × publicado)
- Versão do código: `conectados-em-cristo/app/version.json` (campo `versao`).
  Ela tem que ser igual ao número em `sw.js` (`const CACHE = 'repertorio-vN'`);
  se estiverem diferentes, avise.
- Versão publicada:
  `curl -s https://conectados-em-cristo-fe363.web.app/version.json`
  - Se responder: compare. Publicado **menor** que o código = há mudanças salvas
    que ainda não foram publicadas (avise e passe o comando de publicar).
  - Se a rede bloquear (comum em sessões na nuvem): diga que não deu para conferir
    e que o dono pode ver a versão no app em **Conta**, no rodapé.
- Últimas mudanças: `git log --oneline -5 -- conectados-em-cristo/app`.

## 4. Ponto de restauração (backup do código)
1. Crie uma tag com data e hora: `git tag backup/AAAA-MM-DD-HHMM` (horário de Brasília).
2. Envie: `git push origin backup/AAAA-MM-DD-HHMM`. Se o push de tags for
   recusado, avise e siga (o histórico do git continua sendo um backup).
3. Liste os 3 backups mais recentes: `git tag -l 'backup/*' --sort=-creatordate | head -3`.

Como voltar a um backup (explique só se o dono pedir):
`git checkout backup/<data> -- conectados-em-cristo/app`, commit, e publicar de novo.
No Firebase também dá para voltar a publicação anterior em
*Hosting → Histórico de versões → Reverter*.

## 5. Backup dos dados
O código está no git, mas **hinos, cultos, ensaios e usuários ficam no Firebase**.
Diga ao dono, numa linha, para baixar o backup dos dados no app antes de mudanças
grandes: **Conta → Backup → Baixar backup dos dados**. Isso é obrigatório de
lembrar se o pedido mudar a estrutura dos dados (campos de hinos/eventos/usuários
ou as regras do `firestore.rules`).

## 6. Resumo para o dono
Mostre só isto, curto:
- Branch e última alteração (data e assunto).
- Versão no código × versão publicada (ou "não deu para conferir daqui").
- Backup criado: nome da tag.
- Lembrete do backup dos dados (uma linha).
- "Pronto. O que você quer mudar no Repertório?"

## Quando o dono pedir uma alteração
Siga o checklist "Ao alterar o app" do `CLAUDE.md`. Além dele:
- Aumente `versao` em `version.json` **e** o número em `sw.js`, os dois iguais,
  e atualize `data` e `notas`.
- Teste no modo demonstração antes de salvar.
- No fim, dê os comandos de PowerShell para publicar:
  ```powershell
  cd $HOME\Documents\projetos
  git pull
  cd conectados-em-cristo\app
  firebase deploy --only hosting,firestore:rules
  ```
