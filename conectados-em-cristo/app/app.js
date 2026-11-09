import { state, onChange, init, api, temAcesso } from './store.js';

// ---------------- utilidades ----------------
const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = (n) => String(n).padStart(2, '0');
const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const hojeISO = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const isoToDate = (iso) => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d); };
const fmtData = (iso, o = { weekday: 'long', day: 'numeric', month: 'long' }) => isoToDate(iso).toLocaleDateString('pt-BR', o);
const novoId = () => 'h' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const ordenados = () => [...state.hinos].sort((a, b) => a.numero - b.numero);
const hinoPorId = (id) => state.hinos.find((h) => h.id === id);
// "NOVO": hino criado depois que a pessoa entrou e que ela ainda não abriu
const ehNovo = (h) => !!h.criadoEm && h.criadoEm > (state.perfil.desde || 0) && !(state.perfil.vistos || []).includes(h.id);
export const ytId = (url) => (String(url || '').match(/(?:youtu\.be\/|[?&]v=|\/embed\/|\/shorts\/|\/live\/)([\w-]{11})/) || [])[1] || null;

const pref = {
  get(k, def) { try { const v = localStorage.getItem('cec-' + k); return v === null ? def : JSON.parse(v); } catch { return def; } },
  set(k, v) { try { localStorage.setItem('cec-' + k, JSON.stringify(v)); } catch {} },
};

const CORES = [['#FFF176', 'Amarelo'], ['#A5E8A0', 'Verde'], ['#F8BBD9', 'Rosa'], ['#A7D3F5', 'Azul'], ['#FFCC80', 'Laranja'], ['#D7B8F3', 'Lilás']];
const PARTES = { todos: 'Todos', masc: 'Solo masculino', fem: 'Solo feminino' };

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('on');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => t.classList.remove('on'), 2600);
}

// ---------------- estado da interface ----------------
const ui = {
  busca: '',
  soFavoritos: false,
  mes: (() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); })(),
  rascunho: null, // evento sendo editado
  sheet: null, // { hinoId, i }
};

const precisaLogin = () => state.modo === 'online' && !state.user;

// ---------------- roteamento ----------------
function rota() {
  const [path, q] = (location.hash.slice(1) || '/').split('?');
  return { partes: path.split('/').filter(Boolean), params: new URLSearchParams(q || '') };
}

let telaAtual = '';
function render(forcar = false) {
  const { partes, params } = rota();
  const chave = location.hash;
  // não redesenha formulários enquanto o Adm digita
  const f = $('#view').dataset.form;
  const digitando = $('#view').contains(document.activeElement) && /^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName);
  if (!forcar && chave === telaAtual && (f === '1' || (f === 'foco' && digitando))) return;
  telaAtual = chave;

  let v;
  const liberado = state.pronto && temAcesso();
  document.body.classList.toggle('bloqueado', !liberado);
  if (!state.pronto) v = { html: '<p class="vazio">Carregando…</p>' };
  else if (!liberado) v = telaPortao();
  else if (partes[0] === 'cadastros') v = telaCadastros();
  else if (partes[0] === 'hino' && partes[1]) v = telaHino(partes[1], params);
  else if (partes[0] === 'agenda') v = telaAgenda();
  else if (partes[0] === 'dia' && partes[1]) v = telaDia(partes[1]);
  else if (partes[0] === 'evento' && partes[1]) v = telaEvento(partes[1], params);
  else if (partes[0] === 'conta') v = telaConta();
  else if (partes[0] === 'editar' && partes[1]) v = telaEditarHino(partes[1]);
  else if (partes[0] === 'ordem') v = telaOrdem();
  else v = telaInicio();

  const view = $('#view');
  const scroll = window.scrollY;
  view.dataset.form = v.form === true ? '1' : (v.form || '0');
  view.innerHTML = (state.erro ? `<div class="aviso">${esc(state.erro)}</div>` : '') + v.html;
  if (v.depois) v.depois();
  if (!forcar) window.scrollTo(0, scroll);

  const pend = state.isAdmin ? state.usuarios.filter((x) => x.status === 'pendente').length : 0;
  $('.nav [data-nav=conta]').dataset.badge = pend || '';
  document.querySelectorAll('.nav a').forEach((a) => a.classList.toggle('ativo', a.dataset.nav === (partes[0] || 'inicio')));
  manterTelaAcesa(partes[0] === 'hino');
  renderSheet();
}

// ---------------- tela inicial: busca + lista ----------------
function linhaHino(h, extra = '') {
  const temLetra = h.estrofes?.length > 0;
  const temAudio = ytId(h.videoVoz) || ytId(h.videoPlayback);
  const fav = state.perfil.favoritos?.includes(h.id);
  return `<a class="linha" href="#/hino/${h.id}${extra}">
    <span class="num">${pad(h.numero)}</span>
    <span class="info"><b>${esc(h.titulo)}${ehNovo(h) ? ' <span class="novo">NOVO</span>' : ''}</b><small>${esc(h.cantor)}</small></span>
    <span class="icones">${fav ? '<i title="Favorito">★</i>' : ''}${temLetra ? '' : '<i class="falta" title="Letra ainda não cadastrada">sem letra</i>'}${temAudio ? '<i title="Áudio disponível">♪</i>' : ''}</span>
  </a>`;
}

function listaFiltrada() {
  const q = norm(ui.busca.trim());
  return ordenados().filter((h) => {
    if (ui.soFavoritos && !state.perfil.favoritos?.includes(h.id)) return false;
    if (ui.soNovos && !ehNovo(h)) return false;
    if (!q) return true;
    if (/^\d+$/.test(q)) return String(h.numero).startsWith(String(Number(q)));
    return norm(`${h.titulo} ${h.cantor} ${(h.estrofes || []).map((e) => e.texto).join(' ')}`).includes(q);
  });
}

function htmlLista() {
  const l = listaFiltrada();
  if (!l.length) return `<p class="vazio">${ui.soFavoritos && !ui.busca ? 'Você ainda não tem favoritos. Toque na ☆ de um hino para salvar aqui.' : 'Nenhum hino encontrado.'}</p>`;
  return l.map((h) => linhaHino(h)).join('');
}

function telaInicio() {
  const pc = proximosEventos('culto')[0];
  const pe = proximosEventos('ensaio')[0];
  const card = [pc && cardEvento(pc, 'Próximo culto'), pe && cardEvento(pe, 'Próximo ensaio')]
    .filter(Boolean).sort().join('');
  return {
    html: `
    <header class="topo">
      <img src="img/logo.png" alt="Conectados em Cristo" class="logo">
      <div><h1>Repertório</h1><p>Grupo de Jovens · Conectados em Cristo</p></div>
    </header>
    ${state.isAdmin && state.usuarios.some((u) => u.status === 'pendente') ? `<a class="aviso link" href="#/cadastros">👤 ${state.usuarios.filter((u) => u.status === 'pendente').length} cadastro(s) aguardando sua aprovação →</a>` : ''}
    ${card}
    <div class="busca">
      <input id="busca" type="search" placeholder="Buscar por nome, número, cantor ou trecho" value="${esc(ui.busca)}" autocomplete="off">
    </div>
    <div class="filtros">
      <button class="chip ${ui.soFavoritos || ui.soNovos ? '' : 'on'}" data-act="filtro" data-v="0">Todos (${state.hinos.length})</button>
      ${state.hinos.some(ehNovo) ? `<button class="chip novo-chip ${ui.soNovos ? 'on' : ''}" data-act="filtro" data-v="2">Novos (${state.hinos.filter(ehNovo).length})</button>` : ''}
      <button class="chip ${ui.soFavoritos ? 'on' : ''}" data-act="filtro" data-v="1">★ Favoritos (${state.perfil.favoritos?.length || 0})</button>
      ${state.isAdmin ? '<a class="chip adm" href="#/editar/novo">+ Novo hino</a>' : ''}
    </div>
    <div id="lista" class="lista">${htmlLista()}</div>`,
    depois() {
      $('#busca').addEventListener('input', (e) => { ui.busca = e.target.value; $('#lista').innerHTML = htmlLista(); });
    },
  };
}

// ---------------- tela do hino ----------------
function telaHino(id, params) {
  const h = hinoPorId(id);
  if (!h) return { html: '<p class="vazio">Hino não encontrado. <a href="#/">Voltar</a></p>' };
  const fonte = pref.get('fonte', 20);
  const verMeus = pref.get('verMeus', true);
  const meus = state.perfil.grifos?.[id] || {};
  const padrao = h.grifosPadrao || {};
  const fav = state.perfil.favoritos?.includes(id);

  // navegação dentro do culto/ensaio
  let navCulto = '';
  let soloAqui = '';
  const culto = params.get('ev') && eventoPorId(params.get('ev'));
  if (culto) {
    const itens = culto.hinos.filter((x) => hinoPorId(x.id));
    const lista = itens.map((x) => x.id);
    const i = lista.indexOf(id);
    const link = (j) => `#/hino/${lista[j]}?ev=${culto.id}`;
    navCulto = `<div class="nav-culto">
      ${i > 0 ? `<a href="${link(i - 1)}">◀ Anterior</a>` : '<span></span>'}
      <a href="#/evento/${culto.id}" class="meio">${esc(tituloEv(culto))} · ${i + 1} de ${lista.length}</a>
      ${i < lista.length - 1 ? `<a href="${link(i + 1)}">Próximo ▶</a>` : '<span></span>'}
    </div>`;
    const item = itens[i];
    if (item && (item.solistas || []).length) {
      soloAqui = `<div class="aviso solo ${souSolista(item) ? 'eu' : ''}">🎤 Solo neste ${culto.tipo === 'ensaio' ? 'ensaio' : 'culto'}: <b>${esc(nomesSolistas(item))}</b></div>`;
    }
  }

  const botaoAudio = (tipo, rotulo) => {
    const url = tipo === 'voz' ? h.videoVoz : h.videoPlayback;
    const busca = tipo === 'voz' ? h.buscaVoz : h.buscaPlayback;
    if (ytId(url)) return `<button class="btn audio" data-act="tocar" data-tipo="${tipo}">▶ ${rotulo}</button>`;
    if (busca) return `<a class="btn audio fraco" href="${esc(busca)}" target="_blank" rel="noopener" title="Ainda não há vídeo escolhido; abre a busca no YouTube">🔎 ${rotulo}</a>`;
    return '';
  };

  const estrofes = (h.estrofes || []).map((e, i) => {
    const cor = (verMeus && meus[i]) || padrao[i] || '';
    const parte = e.parte && PARTES[e.parte] ? `<span class="parte ${e.parte}">${PARTES[e.parte]}</span>` : '';
    return `<div class="estrofe ${cor ? 'grifada' : ''}" data-act="estrofe" data-i="${i}" style="${cor ? `--grifo:${esc(cor)}` : ''}">
      ${parte}<p>${esc(e.texto).replace(/\n/g, '<br>')}</p></div>`;
  }).join('');

  const semLetra = `<div class="vazio">
      <p>A letra deste hino ainda não foi cadastrada.</p>
      ${h.buscaLetra ? `<a class="btn" href="${esc(h.buscaLetra)}" target="_blank" rel="noopener">Ver letra na internet ↗</a>` : ''}
      ${state.isAdmin ? `<a class="btn primario" href="#/editar/${h.id}">Cadastrar letra</a>` : ''}
    </div>`;

  return {
    html: `
    ${navCulto}
    <div class="hino-topo">
      <a href="${culto ? `#/evento/${culto.id}` : '#/'}" class="voltar" aria-label="Voltar">←</a>
      <div class="titulo"><span class="num">${pad(h.numero)}</span><div><h2>${esc(h.titulo)}</h2><small>${esc(h.cantor)}</small></div></div>
      <button class="icone ${fav ? 'on' : ''}" data-act="fav" aria-label="Favorito">${fav ? '★' : '☆'}</button>
    </div>
    <div class="ferramentas">
      <div class="grupo">${botaoAudio('voz', 'Voz')}${botaoAudio('playback', 'Playback')}</div>
      <div class="grupo">
        <button class="icone" data-act="fonte" data-d="-2" aria-label="Diminuir letra">A−</button>
        <span class="tam">${fonte}</span>
        <button class="icone" data-act="fonte" data-d="2" aria-label="Aumentar letra">A+</button>
      </div>
    </div>
    <div class="ferramentas sub">
      <label class="check"><input type="checkbox" data-act="verMeus" ${verMeus ? 'checked' : ''}> Mostrar meus grifos</label>
      <span id="tela-acesa" class="tela-acesa" hidden>☀ Tela acesa</span>
      ${state.isAdmin ? `<a class="link-adm" href="#/editar/${h.id}">Editar hino</a>` : ''}
    </div>
    ${soloAqui}
    ${h.estrofes?.length ? `<p class="dica">Toque numa estrofe para grifar${state.isAdmin ? ' ou marcar quem canta' : ''}.</p>` : ''}
    <article class="letra" style="--fonte:${fonte}px">${h.estrofes?.length ? estrofes : semLetra}</article>`,
    depois() {
      atualizarTelaAcesa();
      if (ehNovo(h)) { // abriu pela primeira vez: tira o selo NOVO
        state.perfil.vistos = [...(state.perfil.vistos || []), h.id];
        api.salvarPerfil();
      }
    },
  };
}

// ---------------- folha de grifo (bottom sheet) ----------------
function renderSheet() {
  const el = $('#sheet');
  const s = ui.sheet;
  const h = s && hinoPorId(s.hinoId);
  if (!h || !h.estrofes?.[s.i] || rota().partes[1] !== s.hinoId) { el.hidden = true; el.innerHTML = ''; ui.sheet = null; return; }
  const meu = state.perfil.grifos?.[h.id]?.[s.i] || '';
  const pad_ = h.grifosPadrao?.[s.i] || '';
  const parte = h.estrofes[s.i].parte || '';
  const paleta = (alvo, atual) => CORES.map(([c, n]) =>
    `<button class="cor ${atual === c ? 'on' : ''}" style="background:${c}" title="${n}" data-act="grifar" data-alvo="${alvo}" data-cor="${c}"></button>`).join('')
    + `<label class="cor livre" title="Escolher outra cor"><input type="color" data-act="corLivre" data-alvo="${alvo}" value="${atual && atual.startsWith('#') ? atual : '#ffd54f'}">+</label>`
    + `<button class="cor limpar" data-act="grifar" data-alvo="${alvo}" data-cor="" title="Sem grifo">✕</button>`;

  el.hidden = false;
  el.innerHTML = `<div class="fundo" data-act="fecharSheet"></div>
    <div class="painel">
      <div class="trecho">${esc(h.estrofes[s.i].texto.split('\n')[0])}…</div>
      ${precisaLogin()
        ? `<p>Entre com sua conta Google para grifar suas estrofes.</p><button class="btn primario" data-act="login">Entrar com Google</button>`
        : `<h4>Meu grifo <small>só você vê</small></h4><div class="cores">${paleta('meu', meu)}</div>`}
      ${state.isAdmin ? `
        <h4>Grifo padrão <small>todos veem</small></h4><div class="cores">${paleta('padrao', pad_)}</div>
        <h4>Quem canta</h4>
        <div class="partes">
          ${Object.entries(PARTES).map(([k, n]) => `<button class="chip ${parte === k ? 'on' : ''}" data-act="parte" data-v="${k}">${n}</button>`).join('')}
          <button class="chip ${parte ? '' : 'on'}" data-act="parte" data-v="">Nenhum</button>
        </div>` : ''}
      <button class="btn fechar" data-act="fecharSheet">Pronto</button>
    </div>`;
}

async function aplicarGrifo(alvo, cor) {
  const { hinoId, i } = ui.sheet;
  const h = hinoPorId(hinoId);
  if (alvo === 'padrao') {
    const g = { ...(h.grifosPadrao || {}) };
    if (cor) g[i] = cor; else delete g[i];
    await api.salvarHino({ ...h, grifosPadrao: g });
  } else {
    const grifos = state.perfil.grifos || (state.perfil.grifos = {});
    const g = grifos[hinoId] || (grifos[hinoId] = {});
    if (cor) g[i] = cor; else delete g[i];
    if (!Object.keys(g).length) delete grifos[hinoId];
    if (cor && !pref.get('verMeus', true)) pref.set('verMeus', true);
    await api.salvarPerfil();
  }
}

// ---------------- player de áudio (YouTube, só o som) ----------------
let yt = null;
let ytPronto = null;
const tocando = { hinoId: null, tipo: null, titulo: '' };

function carregarYT() {
  if (ytPronto) return ytPronto;
  ytPronto = new Promise((res, rej) => {
    window.onYouTubeIframeAPIReady = res;
    const s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    s.onerror = () => { ytPronto = null; rej(new Error('yt')); };
    document.head.append(s);
  });
  return ytPronto;
}

async function tocar(h, tipo) {
  const vid = ytId(tipo === 'voz' ? h.videoVoz : h.videoPlayback);
  if (!vid) return;
  Object.assign(tocando, { hinoId: h.id, tipo, titulo: `${pad(h.numero)} ${h.titulo}` });
  $('#player').hidden = false;
  $('#player-titulo').textContent = `${tipo === 'voz' ? 'Voz' : 'Playback'} · ${tocando.titulo}`;
  $('#player-tempo').textContent = 'carregando…';
  document.body.classList.add('com-player');
  try { await carregarYT(); } catch { toast('Sem conexão com o YouTube.'); fecharPlayer(); return; }
  if (!yt) {
    yt = new YT.Player('yt', {
      width: '96', height: '54', videoId: vid,
      playerVars: { autoplay: 1, playsinline: 1, controls: 0, rel: 0, modestbranding: 1 },
      events: {
        onReady: (e) => e.target.playVideo(),
        onStateChange: atualizarPlayer,
        onError: () => toast('Este vídeo não pode ser tocado aqui. Peça ao Adm para trocar o link.'),
      },
    });
  } else {
    yt.loadVideoById(vid);
  }
}

function fmtTempo(s) { s = Math.max(0, Math.floor(s || 0)); return `${Math.floor(s / 60)}:${pad(s % 60)}`; }
function atualizarPlayer() {
  if (!yt || !yt.getPlayerState || $('#player').hidden) return;
  const st = yt.getPlayerState();
  $('#player-play').textContent = st === 1 || st === 3 ? '❚❚' : '▶';
  const dur = yt.getDuration?.() || 0;
  const cur = yt.getCurrentTime?.() || 0;
  $('#player-tempo').textContent = dur ? `${fmtTempo(cur)} / ${fmtTempo(dur)}` : (st === 3 ? 'carregando…' : '');
  $('#player-barra').style.width = dur ? `${(cur / dur) * 100}%` : '0';
}
setInterval(atualizarPlayer, 500);

function fecharPlayer() {
  try { yt?.stopVideo(); } catch {}
  $('#player').hidden = true;
  document.body.classList.remove('com-player');
}

// ---------------- manter a tela acesa ----------------
let wakeLock = null;
let querTelaAcesa = false;
async function manterTelaAcesa(on) {
  querTelaAcesa = on;
  try {
    if (on && !wakeLock && 'wakeLock' in navigator && document.visibilityState === 'visible') {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; atualizarTelaAcesa(); });
    } else if (!on && wakeLock) {
      await wakeLock.release();
      wakeLock = null;
    }
  } catch {}
  atualizarTelaAcesa();
}
function atualizarTelaAcesa() { const el = $('#tela-acesa'); if (el) el.hidden = !wakeLock; }
document.addEventListener('visibilitychange', () => { if (querTelaAcesa) manterTelaAcesa(true); });

// ---------------- agenda: cultos e ensaios ----------------
const TIPOS = { culto: 'Culto', ensaio: 'Ensaio' };
const ordemEv = (a, b) => a.data.localeCompare(b.data) || (a.hora || '').localeCompare(b.hora || '');
const eventoPorId = (id) => state.eventos.find((e) => e.id === id);
const eventosDoDia = (d) => state.eventos.filter((e) => e.data === d).sort(ordemEv);
const proximosEventos = (tipo) => state.eventos.filter((e) => e.data >= hojeISO() && (!tipo || e.tipo === tipo)).sort(ordemEv);
const tituloEv = (e) => e.titulo || TIPOS[e.tipo] || 'Evento';
const quandoEv = (e) => `${fmtData(e.data)}${e.hora ? ` · ${e.hora}` : ''}`;
const souSolista = (x) => (x.solistas || []).some((s) => s.uid === state.user?.uid);
const meusSolos = (e) => (e.hinos || []).filter((x) => souSolista(x) && hinoPorId(x.id));
const nomesSolistas = (x) => (x.solistas || []).map((s) => (s.uid === state.user?.uid ? 'você' : s.nome)).join(', ');
const seloTipo = (e) => `<span class="tipo ${e.tipo}">${TIPOS[e.tipo] || 'Evento'}</span>`;

function cardEvento(e, rotulo) {
  const solos = meusSolos(e);
  return `<a class="card-culto ${e.tipo}" href="#/evento/${e.id}">
      <small>${e.data === hojeISO() ? 'Hoje' : rotulo}</small>
      <b>${esc(tituloEv(e))}</b>
      <span>${esc(quandoEv(e))} · ${e.hinos.length} ${e.hinos.length === 1 ? 'hino' : 'hinos'}</span>
      ${solos.length ? `<em>🎤 Você faz solo em ${solos.length} ${solos.length === 1 ? 'hino' : 'hinos'}</em>` : ''}
    </a>`;
}

function linhaEvento(e) {
  const d = isoToDate(e.data);
  const solos = meusSolos(e).length;
  return `<a class="linha" href="#/evento/${e.id}">
    <span class="num data ${e.tipo}">${d.getDate()}<small>${fmtData(e.data, { month: 'short' }).replace('.', '')}</small></span>
    <span class="info"><b>${seloTipo(e)} ${esc(tituloEv(e))}</b><small>${esc(quandoEv(e))} · ${e.hinos.length} ${e.hinos.length === 1 ? 'hino' : 'hinos'}${solos ? ' · 🎤 seu solo' : ''}</small></span>
  </a>`;
}

function telaAgenda() {
  const m = ui.mes;
  const ano = m.getFullYear();
  const mes = m.getMonth();
  const primeiroDia = new Date(ano, mes, 1).getDay();
  const diasNoMes = new Date(ano, mes + 1, 0).getDate();
  const hoje = hojeISO();
  let cel = '';
  for (let i = 0; i < primeiroDia; i++) cel += '<span></span>';
  for (let d = 1; d <= diasNoMes; d++) {
    const iso = `${ano}-${pad(mes + 1)}-${pad(d)}`;
    const evs = eventosDoDia(iso);
    const temCulto = evs.some((e) => e.tipo === 'culto');
    const temEnsaio = evs.some((e) => e.tipo === 'ensaio');
    const solo = evs.some((e) => meusSolos(e).length);
    cel += `<button class="dia ${temCulto ? 'culto' : temEnsaio ? 'ensaio' : ''} ${iso === hoje ? 'hoje' : ''}" data-act="dia" data-d="${iso}">
      ${d}${temCulto && temEnsaio ? '<i class="ponto-ensaio"></i>' : ''}${solo ? '<i class="mic">🎤</i>' : ''}</button>`;
  }
  const prox = proximosEventos();
  const titulo = m.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  return {
    html: `
    <h2 class="secao">Agenda</h2>
    <div class="cal">
      <div class="cal-topo">
        <button class="icone" data-act="mes" data-d="-1" aria-label="Mês anterior">‹</button>
        <b>${titulo[0].toUpperCase() + titulo.slice(1)}</b>
        <button class="icone" data-act="mes" data-d="1" aria-label="Próximo mês">›</button>
      </div>
      <div class="cal-grade">${['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((x) => `<small>${x}</small>`).join('')}${cel}</div>
      <div class="legenda"><span><i class="q culto"></i>Culto</span><span><i class="q ensaio"></i>Ensaio</span><span>🎤 Seu solo</span></div>
    </div>
    <p class="dica">${state.isAdmin ? 'Toque num dia para marcar um culto ou ensaio, escolher os hinos e quem faz o solo.' : 'Toque num dia marcado para ver os hinos.'}</p>
    <h3 class="secao">Próximos</h3>
    <div class="lista">${prox.length ? prox.map(linhaEvento).join('') : '<p class="vazio">Nada marcado.</p>'}</div>`,
  };
}

function telaDia(iso) {
  const evs = eventosDoDia(iso);
  return {
    html: `
    <div class="hino-topo"><a href="#/agenda" class="voltar">←</a><div class="titulo"><div><h2>${esc(fmtData(iso, { weekday: 'long' }))}</h2><small>${esc(fmtData(iso, { day: 'numeric', month: 'long', year: 'numeric' }))}</small></div></div></div>
    <div class="lista">${evs.length ? evs.map(linhaEvento).join('') : '<p class="vazio">Nada marcado neste dia.</p>'}</div>
    ${state.isAdmin ? `<div class="botoes">
      <a class="btn primario" href="#/evento/novo?data=${iso}&tipo=culto">+ Marcar culto</a>
      <a class="btn" href="#/evento/novo?data=${iso}&tipo=ensaio">+ Marcar ensaio</a></div>` : ''}`,
  };
}

function telaEvento(id, params) {
  const e = id === 'novo' ? null : eventoPorId(id);
  const editar = state.isAdmin && (id === 'novo' || params.get('editar') === '1');
  if (!e && !editar) return { html: '<p class="vazio">Evento não encontrado. <a href="#/agenda">Voltar</a></p>' };
  if (editar) return telaEditarEvento(e, params);

  const lista = e.hinos.filter((x) => hinoPorId(x.id));
  const solos = meusSolos(e);
  return {
    html: `
    <div class="hino-topo"><a href="#/dia/${e.data}" class="voltar">←</a><div class="titulo"><div><h2>${esc(tituloEv(e))}</h2><small>${seloTipo(e)} ${esc(quandoEv(e))}</small></div></div>
      ${state.isAdmin ? `<a class="btn pequeno" href="#/evento/${e.id}?editar=1">Editar</a>` : ''}</div>
    ${e.obs ? `<div class="cartao obs">${esc(e.obs).replace(/\n/g, '<br>')}</div>` : ''}
    ${solos.length ? `<div class="aviso solo">🎤 <b>Você faz solo em:</b> ${solos.map((x) => esc(hinoPorId(x.id).titulo)).join(', ')}</div>` : ''}
    <div class="lista">${lista.length ? lista.map((x, i) => {
      const h = hinoPorId(x.id);
      const sol = (x.solistas || []).length ? `<small class="solistas ${souSolista(x) ? 'eu' : ''}">🎤 Solo: ${esc(nomesSolistas(x))}</small>` : '';
      return `<a class="linha" href="#/hino/${h.id}?ev=${e.id}">
        <span class="num ordem-n">${i + 1}º<small>nº ${pad(h.numero)}</small></span>
        <span class="info"><b>${esc(h.titulo)}${ehNovo(h) ? ' <span class="novo">NOVO</span>' : ''}</b><small>${esc(h.cantor)}</small>${sol}</span>
      </a>`;
    }).join('') : '<p class="vazio">Nenhum hino escolhido ainda.</p>'}</div>
    ${lista.length ? `<a class="btn primario largo" href="#/hino/${lista[0].id}?ev=${e.id}">${e.tipo === 'ensaio' ? 'Começar o ensaio' : 'Começar pelo 1º hino'}</a>` : ''}`,
  };
}

function telaEditarEvento(e, params) {
  const chave = e ? e.id : `novo:${params.get('data')}:${params.get('tipo')}`;
  if (!ui.rascunho || ui.rascunho._chave !== chave) {
    ui.rascunho = e
      ? { ...JSON.parse(JSON.stringify(e)), _chave: chave }
      : { _chave: chave, id: 'e' + Date.now().toString(36), data: params.get('data') || hojeISO(), tipo: params.get('tipo') === 'ensaio' ? 'ensaio' : 'culto', hora: '', titulo: '', obs: '', hinos: [] };
    ui.cBusca = '';
  }
  const r = ui.rascunho;
  const aprovados = state.usuarios.filter((u) => u.status === 'aprovado').sort((a, b) => a.nome.localeCompare(b.nome));
  const sugestao = r.tipo === 'ensaio' ? 'Ensaio' : (isoToDate(r.data).getDay() === 0 ? 'Culto de domingo' : 'Culto');
  return {
    form: true,
    html: `
    <div class="hino-topo"><a href="${e ? `#/evento/${e.id}` : `#/dia/${r.data}`}" class="voltar" data-act="rCancelar">←</a><div class="titulo"><div><h2>${e ? 'Editar' : 'Marcar'} ${TIPOS[r.tipo].toLowerCase()}</h2></div></div></div>
    <div class="seg grande">
      <button class="${r.tipo === 'culto' ? 'on' : ''}" data-act="rTipo" data-v="culto">Culto</button>
      <button class="${r.tipo === 'ensaio' ? 'on' : ''}" data-act="rTipo" data-v="ensaio">Ensaio</button>
    </div>
    <div class="duas"><label class="campo">Data<input id="r-data" type="date" value="${r.data}" required></label>
    <label class="campo curto">Horário<input id="r-hora" type="time" value="${esc(r.hora)}"></label></div>
    <label class="campo">Nome <small>opcional</small><input id="r-titulo" value="${esc(r.titulo)}" placeholder="${sugestao}"></label>
    <label class="campo">Observação <small>opcional (ex.: local, roupa, chegar mais cedo)</small><textarea id="r-obs" rows="2">${esc(r.obs)}</textarea></label>

    <h3 class="secao">Hinos (${r.hinos.length})</h3>
    <div class="lista ordem">${r.hinos.map((x, i) => {
      const h = hinoPorId(x.id);
      const ja = new Set((x.solistas || []).map((s) => s.uid));
      return `<div class="linha evento-hino">
        <span class="num">${i + 1}º</span>
        <span class="info"><b>${h ? `${pad(h.numero)} · ${esc(h.titulo)}` : '(hino removido)'}</b>
          <span class="chips">${(x.solistas || []).map((s, j) => `<button class="chip pequeno on" data-act="rTirarSolista" data-i="${i}" data-j="${j}" title="Tirar">🎤 ${esc(s.nome)} ✕</button>`).join('')}
            <select class="add-solista" data-i="${i}" aria-label="Adicionar solista">
              <option value="">+ quem faz o solo</option>
              ${aprovados.filter((u) => !ja.has(u.uid)).map((u) => `<option value="${u.uid}">${esc(u.nome)}</option>`).join('')}
            </select></span></span>
        <span class="acoes"><button class="icone" data-act="rMover" data-i="${i}" data-d="-1" ${i ? '' : 'disabled'}>▲</button><button class="icone" data-act="rMover" data-i="${i}" data-d="1" ${i < r.hinos.length - 1 ? '' : 'disabled'}>▼</button><button class="icone perigo" data-act="rTirar" data-i="${i}">✕</button></span>
      </div>`;
    }).join('') || '<p class="vazio">Nenhum hino ainda. Busque abaixo para adicionar.</p>'}</div>
    <div class="busca"><input id="c-busca" type="search" placeholder="Adicionar hino: nome ou número" autocomplete="off"></div>
    <div id="c-result" class="lista"></div>
    <div class="botoes">
      <button class="btn primario" data-act="rSalvar">Salvar</button>
      <a class="btn" href="${e ? `#/evento/${e.id}` : `#/dia/${r.data}`}" data-act="rCancelar">Cancelar</a>
      ${e ? `<button class="btn perigo" data-act="rExcluir">Excluir ${TIPOS[r.tipo].toLowerCase()}</button>` : ''}
    </div>`,
    depois() {
      const liga = (sel, campo) => $(sel).addEventListener('input', (ev) => { r[campo] = ev.target.value; });
      liga('#r-data', 'data'); liga('#r-hora', 'hora'); liga('#r-titulo', 'titulo'); liga('#r-obs', 'obs');
      document.querySelectorAll('.add-solista').forEach((sel) => sel.addEventListener('change', () => {
        const u = state.usuarios.find((x) => x.uid === sel.value);
        if (!u) return;
        const item = r.hinos[+sel.dataset.i];
        item.solistas = [...(item.solistas || []), { uid: u.uid, nome: u.nome }];
        render(true);
      }));
      const busca = $('#c-busca');
      const mostrar = () => {
        const q = norm(busca.value.trim());
        if (!q) { $('#c-result').innerHTML = ''; return; }
        const l = ordenados().filter((h) => (/^\d+$/.test(q) ? String(h.numero).startsWith(String(Number(q))) : norm(h.titulo + ' ' + h.cantor).includes(q))).slice(0, 8);
        $('#c-result').innerHTML = l.map((h) => `<button class="linha" data-act="rAdd" data-id="${h.id}"><span class="num">${pad(h.numero)}</span><span class="info"><b>${esc(h.titulo)}</b><small>${esc(h.cantor)}</small></span><span class="icones">${r.hinos.some((x) => x.id === h.id) ? '<i>já está</i>' : '<i>+ adicionar</i>'}</span></button>`).join('') || '<p class="vazio">Nada encontrado.</p>';
      };
      busca.addEventListener('input', mostrar);
      busca.value = ui.cBusca || '';
      mostrar();
    },
  };
}

// ---------------- portão de acesso (entrar / cadastrar / aguardando) ----------------
const logoTopo = `<div class="portao-logo"><img src="img/logo.png" alt="Conectados em Cristo"><h1>Repertório</h1><p>Grupo de Jovens · Conectados em Cristo</p></div>`;
const avisoDemo = () => (state.modo === 'demo'
  ? '<p class="dica centro">Modo demonstração: login simulado; os dados ficam só neste aparelho.</p>' : '');

function telaPortao() {
  // logado, mas ainda sem acesso
  if (state.user && !temAcesso()) {
    const recusado = state.status === 'recusado';
    return {
      html: `<div class="portao">${logoTopo}
        <div class="cartao centro">
          <div class="selo-grande ${recusado ? 'recusado' : ''}">${recusado ? '✕' : '⏳'}</div>
          <h2>${recusado ? 'Acesso não aprovado' : 'Aguardando aprovação'}</h2>
          <p>Olá, <b>${esc(state.user.nome)}</b>!</p>
          <p>${recusado
            ? 'Seu acesso não foi aprovado por um administrador. Se acha que é um engano, fale com a liderança do grupo.'
            : 'Seu pedido de acesso foi enviado. Assim que um administrador aprovar, o repertório abre aqui automaticamente.'}</p>
          <p class="dica">${esc(state.user.email)}</p>
          <button class="btn" data-act="logout">Sair</button>
        </div>${avisoDemo()}</div>`,
    };
  }

  const demo = state.modo === 'demo';
  return {
    form: demo ? 'foco' : false,
    html: `<div class="portao">${logoTopo}
      <div class="cartao centro">
        <h2>Bem-vindo!</h2>
        <p>Entre com sua conta Google. No primeiro acesso, um administrador precisa aprovar o seu pedido.</p>
        ${demo ? `
        <form id="f-simula" class="form esquerda">
          <p class="dica">Modo demonstração: simule a conta Google digitando nome e e-mail.</p>
          <label class="campo">Nome<input name="nome" autocomplete="name"></label>
          <label class="campo">E-mail Google<input name="email" type="email" autocapitalize="none" required></label>
          <button class="btn largo google" type="submit">${iconeGoogle} Continuar com Google</button>
        </form>`
        : `<button class="btn largo google" data-act="google">${iconeGoogle} Continuar com Google</button>`}
      </div>
      ${avisoDemo()}</div>`,
    depois() {
      $('#f-simula')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const f = Object.fromEntries(new FormData(e.target));
        document.activeElement?.blur();
        try { await api.entrarGoogle(f); render(true); } catch (err) { toast(err.message); }
      });
    },
  };
}

const iconeGoogle = `<svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.6 5.4 2.7 13.3l7.9 6.1C12.5 13.6 17.8 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 2.9-2.2 5.4-4.7 7.1l7.6 5.9c4.4-4.1 6.9-10.1 6.9-17.5z"/><path fill="#FBBC05" d="M10.6 28.6c-.5-1.4-.8-3-.8-4.6s.3-3.2.8-4.6l-7.9-6.1C1 16.6 0 20.2 0 24s1 7.4 2.7 10.7l7.9-6.1z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.6-5.9c-2.1 1.4-4.9 2.3-8.3 2.3-6.2 0-11.5-4.1-13.4-9.9l-7.9 6.1C6.6 42.6 14.6 48 24 48z"/></svg>`;

// ---------------- conta / administração ----------------
function telaConta() {
  const u = state.user;
  const pend = state.usuarios.filter((x) => x.status === 'pendente').length;
  return {
    html: `
    <h2 class="secao">Conta</h2>
    <div class="cartao">
      <div class="usuario">${u.foto ? `<img src="${esc(u.foto)}" alt="">` : ''}<div><b>${esc(u.nome)}</b><small>${esc(u.email)} · <span class="selo">${state.isDono ? 'Proprietário' : state.isAdmin ? 'Admin' : 'Membro'}</span></small></div></div>
      <button class="btn" data-act="logout">Sair</button>
      ${state.modo === 'demo' ? '<p class="dica">Modo demonstração: os dados ficam salvos só neste aparelho. Para o grupo todo usar junto, o app precisa ser ligado ao Firebase (veja o SETUP.md).</p>' : ''}
    </div>

    <h3 class="secao">Leitura</h3>
    <div class="cartao">
      <div class="linha-pref">Tamanho da letra
        <span><button class="icone" data-act="fonte" data-d="-2">A−</button> <b>${pref.get('fonte', 20)}</b> <button class="icone" data-act="fonte" data-d="2">A+</button></span></div>
      <label class="linha-pref">Mostrar meus grifos <input type="checkbox" data-act="verMeus" ${pref.get('verMeus', true) ? 'checked' : ''}></label>
    </div>

    ${state.isAdmin ? `
    <h3 class="secao">Administração</h3>
    <div class="cartao botoes col">
      <a class="btn ${pend ? 'primario' : ''}" href="#/cadastros">Usuários${pend ? ` · ${pend} aguardando aprovação` : ''}</a>
      <a class="btn" href="#/editar/novo">+ Adicionar hino novo</a>
      <a class="btn" href="#/ordem">Organizar numeração</a>
      <a class="btn" href="#/agenda">Agenda: cultos, ensaios e solos</a>
      ${!state.hinos.length ? '<button class="btn" data-act="importar">Importar repertório inicial (41 hinos)</button>' : ''}
    </div>` : ''}
    <p class="rodape">Repertório Conectados em Cristo · ${state.hinos.length} hinos</p>`,
  };
}

function telaCadastros() {
  if (!state.isAdmin) return { html: '<p class="vazio">Só o Adm pode ver os usuários.</p>' };
  const aba = ui.abaCadastros || 'pendente';
  const grupos = {
    pendente: ['Aguardando', (u) => u.status === 'pendente'],
    membro: ['Membros', (u) => u.status === 'aprovado' && u.papel !== 'admin' && !u.dono],
    admin: ['Admins', (u) => u.status === 'aprovado' && (u.papel === 'admin' || u.dono)],
    recusado: ['Recusados', (u) => u.status === 'recusado'],
  };
  const lista = state.usuarios.filter(grupos[aba][1]).sort((x, y) => (y.dono - x.dono) || (y.criadoEm || 0) - (x.criadoEm || 0));
  const quando = (t) => (t ? new Date(t).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' }) : '');
  const eu = (u) => u.uid === state.user?.uid;
  const btn = (u, rotulo, mud, cls = '', confirma = '') =>
    `<button class="btn pequeno ${cls}" data-act="usuario" data-uid="${u.uid}" data-mud='${JSON.stringify(mud)}' ${confirma ? `data-confirma="${esc(confirma)}"` : ''}>${rotulo}</button>`;
  const acoesDe = (u) => {
    if (u.dono) return '<span class="selo">Proprietário</span>';
    if (eu(u)) return '<span class="dica">você</span>';
    if (u.status === 'pendente') return btn(u, 'Aprovar como membro', { status: 'aprovado', papel: 'membro' }, 'primario')
      + btn(u, 'Aprovar como admin', { status: 'aprovado', papel: 'admin' }) + btn(u, 'Recusar', { status: 'recusado' }, 'perigo');
    if (u.status === 'recusado') return btn(u, 'Aprovar como membro', { status: 'aprovado', papel: 'membro' });
    const papel = `<div class="seg">
        <button class="${u.papel !== 'admin' ? 'on' : ''}" data-act="usuario" data-uid="${u.uid}" data-mud='{"papel":"membro"}'>Membro</button>
        <button class="${u.papel === 'admin' ? 'on' : ''}" data-act="usuario" data-uid="${u.uid}" data-mud='{"papel":"admin"}' data-confirma="Tornar ${esc(u.nome)} admin? Admins podem editar hinos, cultos e usuários.">Admin</button>
      </div>`;
    return papel + btn(u, 'Remover acesso', { status: 'recusado', papel: 'membro' }, 'perigo', `Remover o acesso de ${u.nome} ao repertório?`);
  };
  return {
    html: `
    <div class="hino-topo"><a href="#/conta" class="voltar">←</a><div class="titulo"><div><h2>Usuários</h2><small>Aprove cadastros e defina membros e admins</small></div></div></div>
    <div class="filtros">${Object.entries(grupos).map(([k, [n, f]]) =>
      `<button class="chip ${aba === k ? 'on' : ''}" data-act="abaCadastros" data-v="${k}">${n} (${state.usuarios.filter(f).length})</button>`).join('')}</div>
    <div class="lista">${lista.length ? lista.map((u) => `<div class="linha cadastro">
        <span class="num avatar">${esc((u.nome || '?').trim()[0].toUpperCase())}</span>
        <span class="info"><b>${esc(u.nome)}</b><small>${esc(u.email)}${u.criadoEm ? ` · ${quando(u.criadoEm)}` : ''}</small></span>
        <span class="acoes">${acoesDe(u)}</span></div>`).join('')
      : `<p class="vazio">${aba === 'pendente' ? 'Nenhum cadastro aguardando aprovação.' : 'Ninguém aqui.'}</p>`}</div>
`,
  };
}

function telaEditarHino(id) {
  if (!state.isAdmin) return { html: '<p class="vazio">Só o Adm pode editar hinos.</p>' };
  const novo = id === 'novo';
  const h = novo
    ? { id: novoId(), criadoEm: Date.now(), numero: Math.max(0, ...state.hinos.map((x) => x.numero)) + 1, titulo: '', cantor: '', estrofes: [], videoVoz: '', videoPlayback: '', grifosPadrao: {} }
    : hinoPorId(id);
  if (!h) return { html: '<p class="vazio">Hino não encontrado.</p>' };
  const ytBusca = (extra) => `https://www.youtube.com/results?search_query=${encodeURIComponent(`${h.titulo} ${h.cantor} ${extra}`)}`;
  return {
    form: true,
    html: `
    <div class="hino-topo"><a href="${novo ? '#/' : `#/hino/${h.id}`}" class="voltar">←</a><div class="titulo"><div><h2>${novo ? 'Novo hino' : 'Editar hino'}</h2></div></div></div>
    <form id="form-hino" class="form">
      <div class="duas"><label class="campo curto">Número<input name="numero" type="number" min="1" required value="${h.numero}"></label>
      <label class="campo">Nome do hino<input name="titulo" required value="${esc(h.titulo)}"></label></div>
      <label class="campo">Cantor(a)<input name="cantor" value="${esc(h.cantor)}"></label>
      <label class="campo">Letra <small>Separe as estrofes com uma linha em branco.</small>
        <textarea name="letra" rows="14" placeholder="Primeira estrofe…&#10;&#10;Refrão…">${esc((h.estrofes || []).map((e) => e.texto).join('\n\n'))}</textarea></label>
      ${!novo && h.buscaLetra ? `<a class="link-adm" href="${esc(h.buscaLetra)}" target="_blank" rel="noopener">Procurar a letra na internet ↗</a>` : ''}
      <label class="campo">Link do YouTube — voz (cantada)<input name="videoVoz" inputmode="url" placeholder="https://www.youtube.com/watch?v=…" value="${esc(h.videoVoz)}"></label>
      ${h.titulo ? `<a class="link-adm" href="${ytBusca('oficial')}" target="_blank" rel="noopener">Procurar a versão cantada ↗</a>` : ''}
      <label class="campo">Link do YouTube — playback<input name="videoPlayback" inputmode="url" placeholder="https://www.youtube.com/watch?v=…" value="${esc(h.videoPlayback)}"></label>
      ${h.titulo ? `<a class="link-adm" href="${ytBusca('playback')}" target="_blank" rel="noopener">Procurar o playback ↗</a>` : ''}
      <div class="botoes">
        <button class="btn primario" type="submit">Salvar</button>
        ${novo ? '' : '<button class="btn perigo" type="button" data-act="excluirHino">Excluir hino</button>'}
      </div>
    </form>`,
    depois() {
      $('#form-hino').addEventListener('submit', async (e) => {
        e.preventDefault();
        const f = Object.fromEntries(new FormData(e.target));
        for (const k of ['videoVoz', 'videoPlayback']) {
          if (f[k].trim() && !ytId(f[k])) { toast('Link do YouTube inválido. Cole o link de um vídeo.'); return; }
        }
        const textos = f.letra.split(/\n\s*\n/).map((t) => t.trim()).filter(Boolean);
        const antigas = h.estrofes || [];
        const estrofes = textos.map((texto, i) => ({ texto, parte: antigas[i]?.parte || '' }));
        const grifosPadrao = Object.fromEntries(Object.entries(h.grifosPadrao || {}).filter(([i]) => i < estrofes.length));
        const numero = Math.max(1, parseInt(f.numero, 10) || 1);
        const salvo = { ...h, numero, titulo: f.titulo.trim(), cantor: f.cantor.trim(), estrofes, videoVoz: f.videoVoz.trim(), videoPlayback: f.videoPlayback.trim(), grifosPadrao };
        // se o número já está em uso, empurra os seguintes uma posição
        const mudados = [salvo];
        if (state.hinos.some((x) => x.id !== h.id && x.numero === numero)) {
          state.hinos.filter((x) => x.id !== h.id && x.numero >= numero).forEach((x) => mudados.push({ ...x, numero: x.numero + 1 }));
        }
        await api.salvarHinos(mudados);
        toast('Hino salvo.');
        location.hash = `#/hino/${h.id}`;
      });
    },
  };
}

function telaOrdem() {
  if (!state.isAdmin) return { html: '<p class="vazio">Só o Adm pode organizar a numeração.</p>' };
  const l = ordenados();
  const buraco = l.some((h, i) => h.numero !== i + 1);
  return {
    html: `
    <div class="hino-topo"><a href="#/conta" class="voltar">←</a><div class="titulo"><div><h2>Organizar numeração</h2><small>Use ▲ ▼ para trocar a posição</small></div></div></div>
    ${buraco ? '<div class="aviso">Há números pulados ou repetidos. <button class="btn pequeno" data-act="renumerar">Renumerar 1, 2, 3…</button></div>' : ''}
    <div class="lista ordem">${l.map((h, i) => `<div class="linha"><span class="num">${pad(h.numero)}</span><span class="info"><b>${esc(h.titulo)}</b><small>${esc(h.cantor)}</small></span>
      <span class="acoes"><button class="icone" data-act="mover" data-id="${h.id}" data-d="-1" ${i ? '' : 'disabled'}>▲</button><button class="icone" data-act="mover" data-id="${h.id}" data-d="1" ${i < l.length - 1 ? '' : 'disabled'}>▼</button></span></div>`).join('')}</div>`,
  };
}

// ---------------- ações (delegação de cliques) ----------------
const acoes = {
  filtro(el) { ui.soFavoritos = el.dataset.v === '1'; ui.soNovos = el.dataset.v === '2'; render(true); },
  async fav() {
    if (precisaLogin()) { toast('Entre com Google para salvar favoritos.'); return; }
    const id = rota().partes[1];
    const f = state.perfil.favoritos || (state.perfil.favoritos = []);
    const i = f.indexOf(id);
    if (i >= 0) f.splice(i, 1); else f.push(id);
    await api.salvarPerfil();
    toast(i >= 0 ? 'Removido dos favoritos.' : 'Salvo nos favoritos.');
  },
  fonte(el) {
    const v = Math.min(44, Math.max(14, pref.get('fonte', 20) + Number(el.dataset.d)));
    pref.set('fonte', v);
    render(true);
  },
  verMeus(el) { pref.set('verMeus', el.checked); render(true); },
  tocar(el) { const h = hinoPorId(rota().partes[1]); if (h) tocar(h, el.dataset.tipo); },
  estrofe(el) { ui.sheet = { hinoId: rota().partes[1], i: Number(el.dataset.i) }; renderSheet(); },
  fecharSheet() { ui.sheet = null; renderSheet(); },
  async grifar(el) { await aplicarGrifo(el.dataset.alvo, el.dataset.cor); },
  async parte(el) {
    const { hinoId, i } = ui.sheet;
    const h = hinoPorId(hinoId);
    const estrofes = h.estrofes.map((e, j) => (j === i ? { ...e, parte: el.dataset.v } : e));
    await api.salvarHino({ ...h, estrofes });
  },
  playerPlay() { if (!yt) return; const st = yt.getPlayerState(); if (st === 1 || st === 3) yt.pauseVideo(); else yt.playVideo(); },
  playerPular(el) { if (yt) yt.seekTo(Math.max(0, yt.getCurrentTime() + Number(el.dataset.s)), true); },
  playerFechar: fecharPlayer,
  playerIr() { if (tocando.hinoId) location.hash = `#/hino/${tocando.hinoId}`; },
  mes(el) { ui.mes = new Date(ui.mes.getFullYear(), ui.mes.getMonth() + Number(el.dataset.d), 1); render(true); },
  dia(el) {
    const d = el.dataset.d;
    const evs = eventosDoDia(d);
    if (evs.length === 1 && !state.isAdmin) location.hash = `#/evento/${evs[0].id}`;
    else if (evs.length || state.isAdmin) location.hash = `#/dia/${d}`;
    else toast('Nada marcado neste dia.');
  },
  rTipo(el) { ui.rascunho.tipo = el.dataset.v; render(true); },
  rAdd(el) {
    const r = ui.rascunho;
    if (!r.hinos.some((x) => x.id === el.dataset.id)) r.hinos.push({ id: el.dataset.id, solistas: [] });
    ui.cBusca = $('#c-busca').value;
    render(true);
    $('#c-busca').focus();
  },
  rMover(el) { const h = ui.rascunho.hinos; const i = +el.dataset.i; const j = i + Number(el.dataset.d); [h[i], h[j]] = [h[j], h[i]]; render(true); },
  rTirar(el) { ui.rascunho.hinos.splice(+el.dataset.i, 1); render(true); },
  rTirarSolista(el) { ui.rascunho.hinos[+el.dataset.i].solistas.splice(+el.dataset.j, 1); render(true); },
  async rSalvar() {
    const { _chave, ...r } = ui.rascunho;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(r.data)) { toast('Escolha a data.'); return; }
    r.titulo = r.titulo.trim(); r.obs = r.obs.trim();
    await api.salvarEvento(r);
    ui.rascunho = null; ui.cBusca = '';
    toast(`${TIPOS[r.tipo]} salvo.`);
    location.hash = `#/evento/${r.id}`;
  },
  rCancelar() { ui.rascunho = null; ui.cBusca = ''; },
  async rExcluir() {
    const r = ui.rascunho;
    if (!confirm(`Excluir este ${TIPOS[r.tipo].toLowerCase()} da agenda?`)) return;
    await api.excluirEvento(r.id);
    ui.rascunho = null;
    location.hash = `#/dia/${r.data}`;
  },
  async excluirHino() {
    const id = rota().partes[1];
    const h = hinoPorId(id);
    if (!confirm(`Excluir o hino "${h.titulo}"? Isso não pode ser desfeito.`)) return;
    await api.excluirHino(id);
    toast('Hino excluído.');
    location.hash = '#/';
  },
  async mover(el) {
    const l = ordenados();
    const i = l.findIndex((h) => h.id === el.dataset.id);
    const j = i + Number(el.dataset.d);
    const a = l[i]; const b = l[j];
    await api.salvarHinos([{ ...a, numero: b.numero }, { ...b, numero: a.numero }]);
  },
  async renumerar() {
    const mud = ordenados().map((h, i) => ({ ...h, numero: i + 1 })).filter((h) => h.numero !== hinoPorId(h.id).numero);
    await api.salvarHinos(mud);
    toast('Numeração organizada.');
  },
  async importar() { await api.importarRepertorio(); toast('Repertório importado.'); },
  async login() { acoes.google(); },
  async google() { try { await api.entrarGoogle(); } catch (e) { toast(e.message || 'Não foi possível entrar.'); } },
  async logout() { fecharPlayer(); await api.logout(); location.hash = '#/'; render(true); },
  abaCadastros(el) { ui.abaCadastros = el.dataset.v; render(true); },
  async usuario(el) {
    if (el.dataset.confirma && !confirm(el.dataset.confirma)) return;
    const mud = JSON.parse(el.dataset.mud);
    try {
      await api.atualizarUsuario(el.dataset.uid, mud);
      toast(mud.status === 'recusado' ? 'Acesso removido.' : mud.status === 'aprovado' ? 'Cadastro aprovado.' : mud.papel === 'admin' ? 'Agora é admin.' : 'Agora é membro.');
    } catch (e) { toast(e.message || 'Não foi possível alterar.'); }
  },
};

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el || el.tagName === 'INPUT') return;
  const f = acoes[el.dataset.act];
  if (!f) return;
  if (el.tagName === 'BUTTON' || el.dataset.act === 'estrofe' || el.classList.contains('fundo')) e.preventDefault();
  f(el, e);
});
document.addEventListener('change', (e) => {
  const el = e.target;
  if (el.matches('input[type=color][data-act=corLivre]')) aplicarGrifo(el.dataset.alvo, el.value);
  else if (el.matches('input[type=checkbox][data-act=verMeus]')) acoes.verMeus(el);
});

window.addEventListener('hashchange', () => { ui.sheet = null; render(true); window.scrollTo(0, 0); });
onChange(() => render());

init();
render(true);

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
