# Repertório — Conectados em Cristo

App de celular (PWA) do grupo de jovens. Abre pelo navegador e pode ser
instalado na tela inicial ("Adicionar à tela de início").

## O que ele faz

**Acesso só com conta Google, com aprovação**
- Quem quer usar abre o app e toca em **Continuar com Google**.
- No primeiro acesso a pessoa fica **aguardando aprovação**; até lá só vê essa tela.
- Os admins veem os pedidos em **Conta → Usuários** (com aviso na tela inicial e
  um número no ícone *Conta*) e aprovam como **membro** ou **admin**, ou recusam.
  Assim que é aprovado, o repertório abre sozinho no celular da pessoa.
- A qualquer momento um admin pode **trocar** alguém entre membro e admin ou
  **remover o acesso**.
- **Proprietário:** `rhuan.4b@gmail.com`, entrando com Google. É sempre admin e
  ninguém pode rebaixá-lo.

**Para todos**
- Lista e busca dos hinos (nome, número, cantor ou trecho da letra)
- Letra na tela, com **A− / A+** para o tamanho da fonte (fica salvo)
- Botões **▶ Voz** e **▶ Playback**: tocam só o áudio do YouTube num player
  pequeno na parte de baixo (sem abrir o vídeo em tela cheia)
- **Grifar estrofes**: toque numa estrofe e escolha a cor (6 cores prontas ou
  qualquer outra). Os grifos são de cada pessoa
- **Favoritos** (☆)
- **Aparência por pessoa** (*Conta → Cores do app*): 13 temas prontos (Areia, Claro,
  Vinho, Oceano, Floresta, Lavanda, Pôr do sol, Rosa, Café, Noite, Grafite, Azul e
  dourado, Alto contraste), cor de destaque e fonte da letra. Fica salvo na conta
  e vale em todos os aparelhos da pessoa
- **Agenda**: calendário com **cultos** (vinho) e **ensaios** (preto), com
  horário e observação. Cada um tem os hinos na ordem e **quem faz o solo** de
  cada hino; quem tem solo vê 🎤 no calendário, na tela inicial e no hino.
- Selo **NOVO** nos hinos cadastrados depois que a pessoa entrou, até ela abrir
  o hino pela primeira vez (filtro "Novos" na lista)
- **Tela sempre acesa** enquanto a letra está aberta
- **Funciona sem internet** depois de aberto uma vez (o áudio precisa de internet)

**Para admins**
- Aprovar pedidos de acesso, definir quem é membro ou admin, remover acesso
- **Backup** em *Conta → Backup*: baixar um arquivo com hinos, cultos, ensaios e
  usuários; o proprietário pode restaurar a partir desse arquivo
- Adicionar, editar e excluir hinos (letra, cantor, links do YouTube)
- Organizar a numeração (▲ ▼ e "Renumerar 1, 2, 3…")
- **Grifo padrão** que todos veem (o grifo pessoal fica por cima e pode ser
  desligado em "Mostrar meus grifos")
- Marcar **quem canta** cada estrofe: Todos, Solo masculino ou Solo feminino
- Marcar cultos e ensaios no calendário, escolher os hinos e quem faz cada solo

## Como experimentar agora

Sem configurar nada, o app roda em **modo demonstração** (dados só no aparelho):

```bash
cd conectados-em-cristo/app
python3 -m http.server 8000
# abra http://localhost:8000
```

No modo demonstração o login Google é **simulado** (você digita nome e e-mail).
Entre com um e-mail qualquer (fica aguardando), saia e entre com
`rhuan.4b@gmail.com` (proprietário) para aprovar em **Conta → Usuários**.

Para o grupo todo usar junto (login com Google, dados compartilhados), siga o
[SETUP.md](SETUP.md).

## Observações

- O repertório inicial (41 hinos) já vem cadastrado, **sem letras**: o documento
  original só tinha links de busca. O Adm cola cada letra em *Editar hino*
  (estrofes separadas por uma linha em branco).
- Dos links, só 2 eram vídeos diretos (playback de "Santidade" e de "Jesus Está
  Voltando"). Nos outros, o botão abre a busca do YouTube até o Adm colar o link
  do vídeo escolhido.
- O áudio usa o player oficial do YouTube. Ele toca com o app aberto; com a tela
  do celular apagada o YouTube pausa.

## Arquivos

| Arquivo | O que é |
|---|---|
| `index.html`, `styles.css`, `app.js` | Telas do app |
| `store.js` | Dados (Firebase ou modo demonstração) |
| `config.js` | Onde entram as chaves do Firebase |
| `seed.js` | Repertório inicial (41 hinos) |
| `sw.js`, `manifest.webmanifest` | Instalação e funcionamento offline |
| `firestore.rules` | Regras de segurança do banco |
| `firebase.json` | Configuração da hospedagem (Firebase Hosting) |
| `../../.github/workflows/deploy-hinario.yml` | Publicação automática pelo GitHub |

## Como atualizar o app

O app no ar é sempre o que está no repositório. Para mudar alguma coisa:

1. Abra uma sessão do Claude com este repositório e digite **`/repertorio`**: ele
   sincroniza, confere a versão publicada e cria um backup do código. Depois peça a alteração.
2. A alteração é salva no GitHub (commit e push).
3. Publique: no PowerShell, `cd $HOME\Documents\projetos` e depois `.\publicar.ps1`.
   (Com a publicação automática pelo GitHub configurada, nem isso é preciso.)
4. Nos celulares, a versão nova aparece ao reabrir o app (às vezes é preciso
   fechar e abrir duas vezes, por causa do modo offline).

Hinos, letras, cultos, ensaios e usuários **não precisam de atualização do
app**: os admins mudam isso direto nas telas do app.
