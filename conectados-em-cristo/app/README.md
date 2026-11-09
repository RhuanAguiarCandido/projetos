# Hinário — Conectados em Cristo

App de celular (PWA) do grupo de jovens. Abre pelo navegador e pode ser
instalado na tela inicial ("Adicionar à tela de início").

## O que ele faz

**Acesso só com conta Google, com aprovação**
- Quem quer usar abre o app e toca em **Continuar com Google**.
- No primeiro acesso a pessoa fica **aguardando aprovação**; até lá só vê essa tela.
- Os admins veem os pedidos em **Conta → Usuários** (com aviso na tela inicial e
  um número no ícone *Conta*) e aprovam como **membro** ou **admin**, ou recusam.
  Assim que é aprovado, o hinário abre sozinho no celular da pessoa.
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
- **Agenda**: calendário com os cultos e os hinos de cada um, na ordem; dentro do
  culto dá para ir de um hino para o próximo
- **Tela sempre acesa** enquanto a letra está aberta
- **Funciona sem internet** depois de aberto uma vez (o áudio precisa de internet)

**Para admins**
- Aprovar pedidos de acesso, definir quem é membro ou admin, remover acesso
- Adicionar, editar e excluir hinos (letra, cantor, links do YouTube)
- Organizar a numeração (▲ ▼ e "Renumerar 1, 2, 3…")
- **Grifo padrão** que todos veem (o grifo pessoal fica por cima e pode ser
  desligado em "Mostrar meus grifos")
- Marcar **quem canta** cada estrofe: Todos, Solo masculino ou Solo feminino
- Marcar os cultos no calendário e escolher os hinos de cada dia

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
