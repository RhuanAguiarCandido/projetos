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
const cultoPorData = (d) => state.cultos.find((c) => c.data === d);
const proximosCultos = () => state.cultos.filter((c) => c.data >= hojeISO()).sort((a, b) => a.data.localeCompare(b.data));
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
  rascunhoCulto: null,
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
  else if (partes[0] === 'culto' && partes[1]) v = telaCulto(partes[1], params);
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
    <span class="info"><b>${esc(h.titulo)}</b><small>${esc(h.cantor)}</small></span>
    <span class="icones">${fav ? '<i title="Favorito">★</i>' : ''}${temLetra ? '' : '<i class="falta" title="Letra ainda não cadastrada">sem letra</i>'}${temAudio ? '<i title="Áudio disponível">♪</i>' : ''}</span>
  </a>`;
}

function listaFiltrada() {
  const q = norm(ui.busca.trim());
  return ordenados().filter((h) => {
    if (ui.soFavoritos && !state.perfil.favoritos?.includes(h.id)) return false;
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
  const prox = proximosCultos()[0];
  const card = prox ? `<a class="card-culto" href="#/culto/${prox.data}">
      <small>${prox.data === hojeISO() ? 'Hoje' : 'Próximo culto'}</small>
      <b>${esc(prox.titulo || 'Culto')}</b>
      <span>${esc(fmtData(prox.data))} · ${prox.hinos.length} ${prox.hinos.length === 1 ? 'hino' : 'hinos'}</span>
    </a>` : '';
  return {
    html: `
    <header class="topo">
      <img src="img/logo.png" alt="Conectados em Cristo" class="logo">
      <div><h1>Hinário</h1><p>Grupo de Jovens · Conectados em Cristo</p></div>
    </header>
    ${state.isAdmin && state.usuarios.some((u) => u.status === 'pendente') ? `<a class="aviso link" href="#/cadastros">👤 ${state.usuarios.filter((u) => u.status === 'pendente').length} cadastro(s) aguardando sua aprovação →</a>` : ''}
    ${card}
    <div class="busca">
      <input id="busca" type="search" placeholder="Buscar por nome, número, cantor ou trecho" value="${esc(ui.busca)}" autocomplete="off">
    </div>
    <div class="filtros">
      <button class="chip ${ui.soFavoritos ? '' : 'on'}" data-act="filtro" data-v="0">Todos (${state.hinos.length})</button>
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

  // navegação dentro do culto
  let navCulto = '';
  const dataCulto = params.get('culto');
  const culto = dataCulto && cultoPorData(dataCulto);
  if (culto) {
    const lista = culto.hinos.filter(hinoPorId);
    const i = lista.indexOf(id);
    const link = (j) => `#/hino/${lista[j]}?culto=${culto.data}`;
    navCulto = `<div class="nav-culto">
      ${i > 0 ? `<a href="${link(i - 1)}">◀ Anterior</a>` : '<span></span>'}
      <a href="#/culto/${culto.data}" class="meio">${esc(culto.titulo || 'Culto')} · ${i + 1} de ${lista.length}</a>
      ${i < lista.length - 1 ? `<a href="${link(i + 1)}">Próximo ▶</a>` : '<span></span>'}
    </div>`;
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
      <a href="${culto ? `#/culto/${culto.data}` : '#/'}" class="voltar" aria-label="Voltar">←</a>
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
    ${h.estrofes?.length ? `<p class="dica">Toque numa estrofe para grifar${state.isAdmin ? ' ou marcar quem canta' : ''}.</p>` : ''}
    <article class="letra" style="--fonte:${fonte}px">${h.estrofes?.length ? estrofes : semLetra}</article>`,
    depois: atualizarTelaAcesa,
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

// ---------------- agenda / calendário ----------------
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
    const c = cultoPorData(iso);
    cel += `<button class="dia ${c ? 'culto' : ''} ${iso === hoje ? 'hoje' : ''}" data-act="dia" data-d="${iso}">
      ${d}${c ? `<i>${c.hinos.length}</i>` : ''}</button>`;
  }
  const prox = proximosCultos();
  const titulo = m.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  return {
    html: `
    <h2 class="secao">Agenda de cultos</h2>
    <div class="cal">
      <div class="cal-topo">
        <button class="icone" data-act="mes" data-d="-1" aria-label="Mês anterior">‹</button>
        <b>${titulo[0].toUpperCase() + titulo.slice(1)}</b>
        <button class="icone" data-act="mes" data-d="1" aria-label="Próximo mês">›</button>
      </div>
      <div class="cal-grade">${['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((x) => `<small>${x}</small>`).join('')}${cel}</div>
    </div>
    <p class="dica">${state.isAdmin ? 'Toque num dia para marcar um culto e escolher os hinos.' : 'Dias em vinho têm culto marcado. O número é a quantidade de hinos.'}</p>
    <h3 class="secao">Próximos cultos</h3>
    <div class="lista">${prox.length ? prox.map((c) => `<a class="linha" href="#/culto/${c.data}">
        <span class="num data">${isoToDate(c.data).getDate()}<small>${fmtData(c.data, { month: 'short' }).replace('.', '')}</small></span>
        <span class="info"><b>${esc(c.titulo || 'Culto')}</b><small>${esc(fmtData(c.data))} · ${c.hinos.length} hinos</small></span>
      </a>`).join('') : '<p class="vazio">Nenhum culto marcado.</p>'}</div>`,
  };
}

function telaCulto(data, params) {
  const c = cultoPorData(data);
  const editar = state.isAdmin && (params.get('editar') === '1' || !c);
  if (!c && !state.isAdmin) return { html: '<p class="vazio">Nenhum culto marcado neste dia. <a href="#/agenda">Voltar</a></p>' };

  if (editar) {
    if (!ui.rascunhoCulto || ui.rascunhoCulto.data !== data) {
      ui.rascunhoCulto = c ? JSON.parse(JSON.stringify(c)) : { data, titulo: isoToDate(data).getDay() === 0 ? 'Culto de domingo' : 'Culto', hinos: [] };
    }
    const r = ui.rascunhoCulto;
    return {
      form: true,
      html: `
      <div class="hino-topo"><a href="#/agenda" class="voltar">←</a><div class="titulo"><div><h2>${c ? 'Editar culto' : 'Novo culto'}</h2><small>${esc(fmtData(data))}</small></div></div></div>
      <label class="campo">Nome do culto<input id="c-titulo" value="${esc(r.titulo)}" placeholder="Ex.: Culto de domingo"></label>
      <h3 class="secao">Hinos (${r.hinos.length})</h3>
      <div class="lista ordem">${r.hinos.map((id, i) => {
        const h = hinoPorId(id);
        return `<div class="linha"><span class="num">${i + 1}º</span><span class="info"><b>${h ? `${pad(h.numero)} · ${esc(h.titulo)}` : '(hino removido)'}</b><small>${h ? esc(h.cantor) : ''}</small></span>
          <span class="acoes"><button class="icone" data-act="cMover" data-i="${i}" data-d="-1" ${i ? '' : 'disabled'}>▲</button><button class="icone" data-act="cMover" data-i="${i}" data-d="1" ${i < r.hinos.length - 1 ? '' : 'disabled'}>▼</button><button class="icone perigo" data-act="cTirar" data-i="${i}">✕</button></span></div>`;
      }).join('') || '<p class="vazio">Nenhum hino ainda. Busque abaixo para adicionar.</p>'}</div>
      <div class="busca"><input id="c-busca" type="search" placeholder="Adicionar hino: nome ou número" autocomplete="off"></div>
      <div id="c-result" class="lista"></div>
      <div class="botoes">
        <button class="btn primario" data-act="cSalvar">Salvar culto</button>
        <a class="btn" href="${c ? `#/culto/${data}` : '#/agenda'}" data-act="cCancelar">Cancelar</a>
        ${c ? '<button class="btn perigo" data-act="cExcluir">Excluir culto</button>' : ''}
      </div>`,
      depois() {
        $('#c-titulo').addEventListener('input', (e) => { r.titulo = e.target.value; });
        const busca = $('#c-busca');
        const mostrar = () => {
          const q = norm(busca.value.trim());
          if (!q) { $('#c-result').innerHTML = ''; return; }
          const l = ordenados().filter((h) => (/^\d+$/.test(q) ? String(h.numero).startsWith(String(Number(q))) : norm(h.titulo + ' ' + h.cantor).includes(q))).slice(0, 8);
          $('#c-result').innerHTML = l.map((h) => `<button class="linha" data-act="cAdd" data-id="${h.id}"><span class="num">${pad(h.numero)}</span><span class="info"><b>${esc(h.titulo)}</b><small>${esc(h.cantor)}</small></span><span class="icones">${r.hinos.includes(h.id) ? '<i>já está</i>' : '<i>+ adicionar</i>'}</span></button>`).join('') || '<p class="vazio">Nada encontrado.</p>';
        };
        busca.addEventListener('input', mostrar);
        busca.value = ui.cBusca || '';
        mostrar();
      },
    };
  }

  const lista = c.hinos.map(hinoPorId).filter(Boolean);
  return {
    html: `
    <div class="hino-topo"><a href="#/agenda" class="voltar">←</a><div class="titulo"><div><h2>${esc(c.titulo || 'Culto')}</h2><small>${esc(fmtData(c.data))}</small></div></div>
      ${state.isAdmin ? `<a class="btn pequeno" href="#/culto/${c.data}?editar=1">Editar</a>` : ''}</div>
    <div class="lista">${lista.length ? lista.map((h, i) => linhaHino(h, `?culto=${c.data}`).replace(`<span class="num">${pad(h.numero)}</span>`, `<span class="num ordem-n">${i + 1}º<small>nº ${pad(h.numero)}</small></span>`)).join('') : '<p class="vazio">Nenhum hino escolhido ainda.</p>'}</div>
    ${lista.length ? `<a class="btn primario largo" href="#/hino/${lista[0].id}?culto=${c.data}">Começar pelo 1º hino</a>` : ''}`,
  };
}

// ---------------- portão de acesso (entrar / cadastrar / aguardando) ----------------
const logoTopo = `<div class="portao-logo"><img src="img/logo.png" alt="Conectados em Cristo"><h1>Hinário</h1><p>Grupo de Jovens · Conectados em Cristo</p></div>`;
const avisoDemo = () => (state.modo === 'demo'
  ? '<p class="dica centro">Modo demonstração: cadastros e dados ficam só neste aparelho.</p>' : '');

function telaPortao() {
  // logado, mas ainda sem acesso
  if (state.user && !temAcesso()) {
    const recusado = state.status === 'recusado';
    return {
      html: `<div class="portao">${logoTopo}
        <div class="cartao centro">
          <div class="selo-grande ${recusado ? 'recusado' : ''}">${recusado ? '✕' : '⏳'}</div>
          <h2>${recusado ? 'Cadastro não aprovado' : 'Aguardando aprovação'}</h2>
          <p>Olá, <b>${esc(state.user.nome)}</b>!</p>
          <p>${recusado
            ? 'Seu cadastro não foi aprovado pelo administrador. Se acha que é um engano, fale com a liderança do grupo.'
            : 'Seu cadastro foi enviado. Assim que o administrador aprovar, o hinário abre aqui automaticamente.'}</p>
          <p class="dica">${esc(state.user.email)}</p>
          <button class="btn" data-act="logout">Sair</button>
        </div>${avisoDemo()}</div>`,
    };
  }

  const aba = ui.portal || 'entrar';
  const online = state.modo === 'online';
  const abas = `<div class="abas">
      <button class="${aba === 'entrar' ? 'on' : ''}" data-act="portal" data-v="entrar">Entrar</button>
      <button class="${aba === 'cadastro' ? 'on' : ''}" data-act="portal" data-v="cadastro">Criar cadastro</button>
    </div>`;
  const google = online ? `<div class="ou"><span>ou</span></div>
      <button class="btn largo google" type="button" data-act="google">Continuar com Google</button>` : '';

  let corpo;
  if (aba === 'adm') {
    corpo = `<form id="f-acesso" data-tipo="adm" class="cartao form">
        <h3>Acesso do Adm</h3>
        <label class="campo">Usuário<input name="usuario" autocomplete="username" autocapitalize="none" spellcheck="false" required></label>
        <label class="campo">Senha<input name="senha" type="password" autocomplete="current-password" required></label>
        <button class="btn primario largo" type="submit">Entrar como Adm</button>
        <button class="btn-link" type="button" data-act="portal" data-v="entrar">← Voltar</button>
      </form>`;
  } else if (aba === 'cadastro') {
    corpo = `${abas}<form id="f-acesso" data-tipo="cadastro" class="cartao form">
        <label class="campo">Nome<input name="nome" autocomplete="name" required></label>
        <label class="campo">E-mail<input name="email" type="email" autocomplete="email" autocapitalize="none" required></label>
        <label class="campo">Senha <small>mínimo 6 caracteres</small><input name="senha" type="password" minlength="6" autocomplete="new-password" required></label>
        <button class="btn primario largo" type="submit">Enviar cadastro</button>
        <p class="dica">Depois de enviar, o administrador precisa aprovar o seu cadastro.</p>
        ${google}
      </form>`;
  } else {
    corpo = `${abas}<form id="f-acesso" data-tipo="entrar" class="cartao form">
        <label class="campo">E-mail<input name="email" type="email" autocomplete="email" autocapitalize="none" required></label>
        <label class="campo">Senha<input name="senha" type="password" autocomplete="current-password" required></label>
        <button class="btn primario largo" type="submit">Entrar</button>
        ${online ? '<button class="btn-link" type="button" data-act="esqueci">Esqueci minha senha</button>' : ''}
        ${google}
      </form>`;
  }

  return {
    form: 'foco',
    html: `<div class="portao">${logoTopo}${corpo}
      ${aba !== 'adm' ? '<button class="btn-link adm-link" data-act="portal" data-v="adm">Acesso do Adm</button>' : ''}
      ${avisoDemo()}</div>`,
    depois() {
      $('#f-acesso').addEventListener('submit', async (e) => {
        e.preventDefault();
        const form = e.target;
        const f = Object.fromEntries(new FormData(form));
        const botao = form.querySelector('[type=submit]');
        botao.disabled = true;
        document.activeElement?.blur();
        try {
          if (form.dataset.tipo === 'adm') await api.loginAdm(f.usuario, f.senha);
          else if (form.dataset.tipo === 'cadastro') await api.cadastrar(f.nome, f.email, f.senha);
          else await api.entrar(f.email, f.senha);
          ui.portal = 'entrar';
          render(true);
        } catch (err) {
          toast(err.message || 'Não foi possível entrar.');
          if (form.senha) form.senha.value = '';
          botao.disabled = false;
        }
      });
    },
  };
}

// ---------------- conta / administração ----------------
function telaConta() {
  const u = state.user;
  const pend = state.usuarios.filter((x) => x.status === 'pendente').length;
  return {
    html: `
    <h2 class="secao">Conta</h2>
    <div class="cartao">
      <div class="usuario">${u.foto ? `<img src="${esc(u.foto)}" alt="">` : ''}<div><b>${esc(u.nome)}</b><small>${esc(u.email)}${state.isAdmin ? ' · <span class="selo">Adm</span>' : ''}</small></div></div>
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
      <a class="btn ${pend ? 'primario' : ''}" href="#/cadastros">Cadastros${pend ? ` · ${pend} aguardando aprovação` : ''}</a>
      <a class="btn" href="#/editar/novo">+ Adicionar hino novo</a>
      <a class="btn" href="#/ordem">Organizar numeração</a>
      <a class="btn" href="#/agenda">Marcar hinos dos cultos</a>
      ${!state.hinos.length ? '<button class="btn" data-act="importar">Importar repertório inicial (41 hinos)</button>' : ''}
    </div>` : ''}
    <p class="rodape">Hinário Conectados em Cristo · ${state.hinos.length} hinos</p>`,
  };
}

function telaCadastros() {
  if (!state.isAdmin) return { html: '<p class="vazio">Só o Adm pode ver os cadastros.</p>' };
  const aba = ui.abaCadastros || 'pendente';
  const grupos = { pendente: 'Aguardando', aprovado: 'Aprovados', recusado: 'Recusados' };
  const lista = state.usuarios.filter((u) => u.status === aba).sort((a, b) => (b.criadoEm || 0) - (a.criadoEm || 0));
  const quando = (t) => (t ? new Date(t).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' }) : '');
  const botoes = (u) => ({
    pendente: `<button class="btn pequeno primario" data-act="status" data-uid="${u.uid}" data-v="aprovado">Aprovar</button>
               <button class="btn pequeno perigo" data-act="status" data-uid="${u.uid}" data-v="recusado">Recusar</button>`,
    aprovado: `<button class="btn pequeno perigo" data-act="status" data-uid="${u.uid}" data-v="recusado" data-confirma="1">Remover acesso</button>`,
    recusado: `<button class="btn pequeno" data-act="status" data-uid="${u.uid}" data-v="aprovado">Aprovar</button>`,
  }[u.status]);
  return {
    html: `
    <div class="hino-topo"><a href="#/conta" class="voltar">←</a><div class="titulo"><div><h2>Cadastros</h2><small>Aprove quem pode usar o hinário</small></div></div></div>
    <div class="filtros">${Object.entries(grupos).map(([k, n]) => {
      const q = state.usuarios.filter((u) => u.status === k).length;
      return `<button class="chip ${aba === k ? 'on' : ''}" data-act="abaCadastros" data-v="${k}">${n} (${q})</button>`;
    }).join('')}</div>
    <div class="lista">${lista.length ? lista.map((u) => `<div class="linha cadastro">
        <span class="num avatar">${esc((u.nome || '?').trim()[0].toUpperCase())}</span>
        <span class="info"><b>${esc(u.nome)}</b><small>${esc(u.email)}${u.criadoEm ? ` · ${quando(u.criadoEm)}` : ''}</small></span>
        <span class="acoes">${botoes(u)}</span></div>`).join('')
      : `<p class="vazio">${aba === 'pendente' ? 'Nenhum cadastro aguardando aprovação.' : 'Ninguém aqui.'}</p>`}</div>`,
  };
}

function telaEditarHino(id) {
  if (!state.isAdmin) return { html: '<p class="vazio">Só o Adm pode editar hinos.</p>' };
  const novo = id === 'novo';
  const h = novo
    ? { id: novoId(), numero: Math.max(0, ...state.hinos.map((x) => x.numero)) + 1, titulo: '', cantor: '', estrofes: [], videoVoz: '', videoPlayback: '', grifosPadrao: {} }
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
  filtro(el) { ui.soFavoritos = el.dataset.v === '1'; render(true); },
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
    if (cultoPorData(d)) location.hash = `#/culto/${d}`;
    else if (state.isAdmin) { ui.rascunhoCulto = null; location.hash = `#/culto/${d}?editar=1`; }
    else toast('Nenhum culto marcado neste dia.');
  },
  cAdd(el) {
    const r = ui.rascunhoCulto;
    if (!r.hinos.includes(el.dataset.id)) r.hinos.push(el.dataset.id);
    ui.cBusca = $('#c-busca').value;
    render(true);
    $('#c-busca').focus();
  },
  cMover(el) { const r = ui.rascunhoCulto; const i = +el.dataset.i; const j = i + Number(el.dataset.d); [r.hinos[i], r.hinos[j]] = [r.hinos[j], r.hinos[i]]; render(true); },
  cTirar(el) { ui.rascunhoCulto.hinos.splice(+el.dataset.i, 1); render(true); },
  async cSalvar() {
    const r = ui.rascunhoCulto;
    r.titulo = $('#c-titulo').value.trim();
    await api.salvarCulto({ data: r.data, titulo: r.titulo, hinos: r.hinos });
    ui.rascunhoCulto = null; ui.cBusca = '';
    toast('Culto salvo.');
    location.hash = `#/culto/${r.data}`;
  },
  cCancelar() { ui.rascunhoCulto = null; ui.cBusca = ''; },
  async cExcluir() {
    const r = ui.rascunhoCulto;
    if (!confirm('Excluir este culto da agenda?')) return;
    await api.excluirCulto(r.data);
    ui.rascunhoCulto = null;
    location.hash = '#/agenda';
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
  async esqueci() {
    const email = $('#f-acesso [name=email]')?.value.trim();
    if (!email) { toast('Digite seu e-mail primeiro.'); return; }
    try { await api.esqueciSenha(email); toast('Enviamos um link para redefinir a senha.'); } catch (e) { toast(e.message); }
  },
  async logout() { fecharPlayer(); await api.logout(); location.hash = '#/'; render(true); },
  portal(el) { ui.portal = el.dataset.v; render(true); },
  abaCadastros(el) { ui.abaCadastros = el.dataset.v; render(true); },
  async status(el) {
    if (el.dataset.confirma && !confirm('Remover o acesso desta pessoa ao hinário?')) return;
    await api.definirStatus(el.dataset.uid, el.dataset.v);
    toast(el.dataset.v === 'aprovado' ? 'Cadastro aprovado.' : 'Acesso recusado.');
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
