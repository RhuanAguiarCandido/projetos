# Projetos — guia para o Claude

> Antes de alterar o app Repertório, rode a skill **`/repertorio`**
> (`.claude/skills/repertorio/SKILL.md`): sincroniza, compara versões e cria backup.

Dono: Rhuan (rhuan.4b@gmail.com). Responda sempre em **português do Brasil**,
em linguagem simples (o dono não é programador).

## Pastas
| Pasta | O que é |
|---|---|
| `conectados-em-cristo/app/` | **App "Repertório"** do Grupo de Jovens Conectados em Cristo (o projeto principal) |
| `conectados-em-cristo/logos/`, `repertorio/` | Logos do grupo e o repertório original (41 hinos, .docx/.csv/.json) |
| `igreja-imiss/` | Logo da igreja I.MISS. |
| `paletas/preto-areia-vinho/` | Paleta oficial. **Não alterar** (pedido do dono) |
| `entrellun/`, `gps-cachorros/`, `gps-secreto-tipografico/` | Outros projetos de vídeo, independentes |

## App Repertório (`conectados-em-cristo/app/`)
PWA em HTML/CSS/JS puro (sem build, sem framework), módulos ES.

- `app.js`: telas e ações (roteamento por hash `#/...`, delegação de cliques por `data-act`)
- `store.js`: dados. Firebase (Auth Google + Firestore) quando publicado; senão
  **modo demonstração** em localStorage, com login Google simulado
- `config.js`: `DONO_EMAIL`. A config do Firebase vem de `/__/firebase/init.json` no Hosting
- `seed.js`: 41 hinos iniciais. `sw.js`: offline. `firestore.rules`: segurança
- `version.json`: número da versão (aparece em Conta e serve para comparar com o
  publicado em https://conectados-em-cristo-fe363.web.app/version.json)
- Backup dos dados: em Conta → Backup (admins baixam JSON; só o proprietário restaura)
- `SETUP.md`: como publicar. `README.md`: funções do app

**Regras de negócio**
- Login **só com Google**. Primeiro acesso fica "pendente" até um admin aprovar.
- Papéis: proprietário (`rhuan.4b@gmail.com`, nunca rebaixável), admin, membro.
- Firestore: `hinos/{id}`, `eventos/{id}` (cultos e ensaios: data, hora, tipo,
  titulo, obs, hinos:[{id, solistas:[{uid,nome}]}]), `usuarios/{uid}` (status,
  papel, favoritos, grifos, vistos, aparencia, criadoEm).
- Selo NOVO: hino com `criadoEm` maior que o `criadoEm` do usuário e fora de `vistos`.
- Visual: paleta Preto `#000000`, Areia `#ECD3B5`, Vinho `#600F1E`; fontes Anton + Inter.

**Ao alterar o app**
1. Mantenha `firestore.rules` coerente com qualquer campo/coleção novo.
2. Suba a versão: `versao` em `version.json` e `const CACHE = 'repertorio-vN'` em
   `sw.js`, **com o mesmo número** (os celulares só pegam a versão nova assim).
3. Teste no modo demonstração: `python3 -m http.server` dentro de `app/` e
   Playwright (fluxo: entrar com `rhuan.4b@gmail.com` = proprietário).
4. Atualize `README.md` do app se mudar alguma função.
5. Commit e push. Publicação: `firebase deploy --only hosting,firestore:rules`
   dentro de `app/` (projeto `conectados-em-cristo-fe363`, já em `.firebaserc`),
   ou automática pelo GitHub Actions (`.github/workflows/deploy-hinario.yml`)
   quando o secret `FIREBASE_SERVICE_ACCOUNT` existir.
6. No fim, diga ao dono os comandos de PowerShell para publicar:
   `cd $HOME\Documents\projetos; git pull; cd conectados-em-cristo\app; firebase deploy --only hosting,firestore:rules`

App no ar: https://conectados-em-cristo-fe363.web.app
