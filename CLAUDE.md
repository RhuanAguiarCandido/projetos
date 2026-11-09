# Projetos — guia para o Claude

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
- `SETUP.md`: como publicar. `README.md`: funções do app

**Regras de negócio**
- Login **só com Google**. Primeiro acesso fica "pendente" até um admin aprovar.
- Papéis: proprietário (`rhuan.4b@gmail.com`, nunca rebaixável), admin, membro.
- Firestore: `hinos/{id}`, `eventos/{id}` (cultos e ensaios: data, hora, tipo,
  titulo, obs, hinos:[{id, solistas:[{uid,nome}]}]), `usuarios/{uid}` (status,
  papel, favoritos, grifos, vistos, criadoEm).
- Selo NOVO: hino com `criadoEm` maior que o `criadoEm` do usuário e fora de `vistos`.
- Visual: paleta Preto `#000000`, Areia `#ECD3B5`, Vinho `#600F1E`; fontes Anton + Inter.

**Ao alterar o app**
1. Mantenha `firestore.rules` coerente com qualquer campo/coleção novo.
2. Suba a versão do cache em `sw.js` (`const CACHE = 'repertorio-vN'`) para os
   celulares pegarem a versão nova.
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
