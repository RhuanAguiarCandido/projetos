// Tipografia cinética + primitivas de HUD (Canvas 2D). Tudo é função pura do tempo local.
export const COL = { navy: '#151C37', cyan: '#00D9F5', yellow: '#F9D548', white: '#FFFFFF', navy2: '#0b1024', coral: '#ff6a5c' };
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const prog = (t, a, d) => clamp((t - a) / d);
export const smooth = (x) => x * x * (3 - 2 * x);

export const E = {
  outCubic: (x) => 1 - Math.pow(1 - x, 3),
  inCubic: (x) => x * x * x,
  inOutCubic: (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
  outQuint: (x) => 1 - Math.pow(1 - x, 5),
  outExpo: (x) => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x)),
  inExpo: (x) => (x <= 0 ? 0 : Math.pow(2, 10 * x - 10)),
  inOutQuart: (x) => (x < 0.5 ? 8 * x * x * x * x : 1 - Math.pow(-2 * x + 2, 4) / 2),
  outBack: (x, s = 1.70158) => { const c3 = s + 1; return 1 + c3 * Math.pow(x - 1, 3) + s * Math.pow(x - 1, 2); },
  outElastic: (x, p = 0.4) => (x <= 0 ? 0 : x >= 1 ? 1 : Math.pow(2, -10 * x) * Math.sin(((x * 10 - 0.75) * (2 * Math.PI)) / (p * 7.5)) + 1),
  outBounce: (x) => { const n = 7.5625, d = 2.75; if (x < 1 / d) return n * x * x; if (x < 2 / d) return n * (x -= 1.5 / d) * x + 0.75; if (x < 2.5 / d) return n * (x -= 2.25 / d) * x + 0.9375; return n * (x -= 2.625 / d) * x + 0.984375; },
  // mola amortecida: 0 -> 1 com overshoot (frequência w, amortecimento z)
  spring: (x, w = 14, z = 0.38) => (x <= 0 ? 0 : 1 - Math.exp(-z * w * x) * Math.cos(w * Math.sqrt(1 - z * z) * x)),
};

export function rgba(hex, a = 1) {
  const n = parseInt(hex.slice(1), 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
export function shade(hex, k) { // k<1 escurece, k>1 clareia
  const n = parseInt(hex.slice(1), 16); let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  r = clamp(Math.round(r * k), 0, 255); g = clamp(Math.round(g * k), 0, 255); b = clamp(Math.round(b * k), 0, 255);
  return `rgb(${r},${g},${b})`;
}
export function mix(a, b, t) { // hex -> hex
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const f = (s) => Math.round(lerp((pa >> s) & 255, (pb >> s) & 255, t));
  return `rgb(${f(16)},${f(8)},${f(0)})`;
}

// ---------- texto ----------
export function fontStr(size, family = 'Anton', weight = 400) { return `${weight} ${size}px ${family}, 'Montserrat', sans-serif`; }

export function measure(ctx, str, size, family = 'Anton', weight = 400, spacing = 0) {
  ctx.font = fontStr(size, family, weight);
  const chars = [...str]; const adv = []; let x = 0;
  for (let i = 0; i < chars.length; i++) {
    // avanço com kerning aproximado: largura(prefixo+char) - largura(prefixo)
    const w = ctx.measureText(chars.slice(0, i + 1).join('')).width - ctx.measureText(chars.slice(0, i).join('')).width;
    adv.push(w + spacing); x += w + spacing;
  }
  return { chars, adv, width: x - spacing };
}

// Desenha um glifo com extrusão (profundidade 3D), contorno, preenchimento e brilho.
export function glyph(ctx, ch, o) {
  const { size, family = 'Anton', weight = 400, fill = '#fff', stroke, strokeW = 0, extrude = 0, extrudeCol = '#0b1024', exDir = [0.55, 0.85], glow, glowCol, glowBlur = 30, grad } = o;
  ctx.font = fontStr(size, family, weight); ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.lineJoin = 'round'; ctx.miterLimit = 2;
  if (extrude > 0) {
    for (let k = extrude; k >= 1; k--) {
      ctx.fillStyle = shade(extrudeCol.startsWith('#') ? extrudeCol : '#0b1024', 0.9 + 0.1 * (k / extrude));
      if (strokeW > 0) { ctx.strokeStyle = ctx.fillStyle; ctx.lineWidth = strokeW * 2; ctx.strokeText(ch, exDir[0] * k, exDir[1] * k); }
      ctx.fillText(ch, exDir[0] * k, exDir[1] * k);
    }
  }
  if (glow) { ctx.save(); ctx.shadowColor = glowCol || glow; ctx.shadowBlur = glowBlur; ctx.fillStyle = glowCol || fill; ctx.fillText(ch, 0, 0); ctx.restore(); }
  if (strokeW > 0 && stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = strokeW * 2; ctx.strokeText(ch, 0, 0); }
  if (grad) {
    const g = ctx.createLinearGradient(0, -size * 0.8, 0, size * 0.08); g.addColorStop(0, grad[0]); g.addColorStop(1, grad[1]); ctx.fillStyle = g;
  } else ctx.fillStyle = fill;
  ctx.fillText(ch, 0, 0);
}

// Linha de texto cinética. t = tempo local (s) desde o início da animação.
export function kinetic(ctx, str, o) {
  const { x, y, size, t, stagger = 0.04, dur = 0.55, effect = 'bounce', align = 'center', spacing = 0, family = 'Anton', weight = 400, rot = 0, scale = 1, alpha = 1, idle = 0, out = null, outDur = 0.35 } = o;
  const m = measure(ctx, str, size, family, weight, spacing);
  let sx = align === 'center' ? -m.width / 2 : align === 'right' ? -m.width : 0;
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(scale, scale); ctx.globalAlpha *= alpha;
  let cx = sx;
  for (let i = 0; i < m.chars.length; i++) {
    const ch = m.chars[i], w = m.adv[i] - spacing;
    if (ch !== ' ') {
      const p = clamp((t - i * stagger) / dur);
      let dx = 0, dy = 0, sc = 1, r = 0, a = 1, blur = 0;
      switch (effect) {
        case 'bounce': { const e = E.outBack(p, 2.6); dy = (1 - e) * size * 0.9; sc = 0.2 + 0.8 * e; a = clamp(p * 4); break; }
        case 'drop': { dy = -(1 - E.outBounce(p)) * size * 1.6; a = clamp(p * 6); break; }
        case 'rise': { dy = (1 - E.outCubic(p)) * size * 0.9; a = clamp(p * 3); break; }
        case 'spin': { const e = E.outBack(p, 1.4); r = (1 - e) * Math.PI * 2; sc = e; a = clamp(p * 5); break; }
        case 'zoom': { const e = E.outExpo(p); sc = 1 + (1 - e) * 2.4; a = clamp(p * 3.5); blur = (1 - e) * 24; break; }
        case 'slam': { const e = E.outExpo(p); sc = 1 + (1 - e) * 1.6; dy = -(1 - e) * size * 0.4; a = clamp(p * 8); break; }
        case 'pop': { const e = E.spring(p, 16, 0.32); sc = e; a = clamp(p * 6); break; }
        default: break;
      }
      if (out) { const po = clamp((t - out - i * 0.012) / outDur); const eo = E.inCubic(po); dy -= eo * size * 0.5; a *= 1 - po; sc *= 1 - eo * 0.25; }
      if (a > 0.003) {
        const iw = idle ? Math.sin(t * 5 + i * 0.7) * idle : 0;
        ctx.save(); ctx.translate(cx + w / 2 + dx, dy + iw); ctx.rotate(r); ctx.scale(sc, sc); ctx.globalAlpha *= a;
        if (blur) ctx.filter = `blur(${blur.toFixed(1)}px)`;
        glyph(ctx, ch, o); ctx.restore();
      }
    }
    cx += m.adv[i];
  }
  ctx.restore();
  return m.width;
}

// Máscara de revelação: roda fn dentro de um retângulo que cresce (wipe)
export function wipe(ctx, x, y, w, h, p, dir, fn) {
  ctx.save(); ctx.beginPath();
  if (dir === 'right') ctx.rect(x, y, w * p, h); else if (dir === 'left') ctx.rect(x + w * (1 - p), y, w * p, h);
  else if (dir === 'up') ctx.rect(x, y + h * (1 - p), w, h * p); else ctx.rect(x, y, w, h * p);
  ctx.clip(); fn(); ctx.restore();
}

export function roundRect(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2); ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

// Marca-texto que varre atrás de uma palavra
export function marker(ctx, x, y, w, h, p, col = COL.yellow, skew = 0.18) {
  if (p <= 0) return; const ww = w * E.outCubic(p);
  ctx.save(); ctx.fillStyle = col; ctx.beginPath();
  ctx.moveTo(x + h * skew, y); ctx.lineTo(x + ww + h * skew, y); ctx.lineTo(x + ww, y + h); ctx.lineTo(x, y + h); ctx.closePath(); ctx.fill(); ctx.restore();
}

// Texto "scramble": caracteres embaralhados que se resolvem no alvo
export function scramble(str, p, seed = 0, pool = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&') {
  let out = ''; const n = str.length;
  for (let i = 0; i < n; i++) {
    const c = str[i]; if (c === ' ') { out += c; continue; }
    if (p * (n + 4) > i + 2) out += c; else out += pool[Math.floor((Math.sin((i + 1) * 12.9898 + seed * 78.233 + Math.floor(p * 40) * 3.1) * 43758.5453 % 1 + 1) % 1 * pool.length)];
  }
  return out;
}

// ---------- HUD ----------
export function glowLine(ctx, x1, y1, x2, y2, col, w = 3, blur = 18, a = 1) {
  ctx.save(); ctx.globalAlpha *= a; ctx.lineCap = 'round'; ctx.strokeStyle = col; ctx.shadowColor = col; ctx.shadowBlur = blur; ctx.lineWidth = w;
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); ctx.shadowBlur = 0; ctx.lineWidth = w * 0.45; ctx.strokeStyle = '#fff'; ctx.globalAlpha *= 0.85; ctx.stroke(); ctx.restore();
}

export function arc(ctx, cx, cy, r, a0, a1, col, w = 4, blur = 14, a = 1, dash = null) {
  ctx.save(); ctx.globalAlpha *= a; ctx.strokeStyle = col; ctx.lineWidth = w; ctx.shadowColor = col; ctx.shadowBlur = blur; ctx.lineCap = 'round';
  if (dash) ctx.setLineDash(dash); ctx.beginPath(); ctx.arc(cx, cy, r, a0, a1); ctx.stroke(); ctx.restore();
}

export function arrowHead(ctx, x, y, ang, s, col) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.fillStyle = col; ctx.shadowColor = col; ctx.shadowBlur = 14;
  ctx.beginPath(); ctx.moveTo(s, 0); ctx.lineTo(-s * 0.7, s * 0.8); ctx.lineTo(-s * 0.35, 0); ctx.lineTo(-s * 0.7, -s * 0.8); ctx.closePath(); ctx.fill(); ctx.restore();
}

// seta circular animada (sentido horário); sweep em radianos
export function circArrow(ctx, cx, cy, r, a0, sweep, col = COL.cyan, w = 8, a = 1) {
  if (sweep <= 0.01) return;
  const a1 = a0 + sweep;
  arc(ctx, cx, cy, r, a0, a1, col, w, 18, a);
  arrowHead(ctx, cx + Math.cos(a1) * r, cy + Math.sin(a1) * r, a1 + Math.PI / 2, w * 2.2, col);
}

export function pill(ctx, x, y, w, h, o = {}) {
  const { fill = 'rgba(11,16,36,0.78)', stroke = COL.cyan, lw = 3, glow = COL.cyan, blur = 16 } = o;
  ctx.save(); roundRect(ctx, x, y, w, h, h / 2); ctx.fillStyle = fill; ctx.fill();
  ctx.shadowColor = glow; ctx.shadowBlur = blur; ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); ctx.restore();
}

// patinha vetorial (substitui o emoji, que não existe na fonte)
export function paw(ctx, x, y, s, col = COL.yellow, rot = 0) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s); ctx.fillStyle = col;
  ctx.shadowColor = col; ctx.shadowBlur = 10 / Math.max(s, 0.2) * 0.6;
  const e = (cx, cy, rx, ry, r = 0) => { ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, r, 0, Math.PI * 2); ctx.fill(); };
  e(0, 0.28, 0.52, 0.42);                       // almofada
  e(-0.60, -0.18, 0.19, 0.27, -0.45); e(-0.22, -0.58, 0.20, 0.29, -0.12); e(0.22, -0.58, 0.20, 0.29, 0.12); e(0.60, -0.18, 0.19, 0.27, 0.45);
  ctx.restore();
}

// ---------- legendas dinâmicas ----------
export function buildChunks(lines) {
  const chunks = [];
  for (const L of lines) {
    let cur = [];
    const flush = () => { if (cur.length) { chunks.push({ words: cur, t0: cur[0].t0, t1: cur[cur.length - 1].t1 }); cur = []; } };
    for (let i = 0; i < L.words.length; i++) {
      const w = L.words[i]; cur.push(w);
      const chars = cur.map((x) => x.w).join(' ').length;
      const punct = /[,.!?:;…]$/.test(w.w);
      const nxt = L.words[i + 1];
      const gap = nxt ? nxt.t0 - w.t1 : 1;
      if (punct || chars >= 17 || cur.length >= 3 || gap > 0.28) flush();
    }
    flush();
  }
  // evita blocos de 1 palavra pequena (de, o, a, e...) isolados: junta com o próximo/anterior quando possível
  for (let i = 0; i < chunks.length - 1; i++) {
    const c = chunks[i], n = chunks[i + 1];
    if (c.words.length === 1 && c.words[0].w.replace(/[^\p{L}]/gu, '').length <= 3 && !/[,.!?:;…]$/.test(c.words[0].w) && n.t0 - c.t1 < 0.3 && n.words.length < 3) { n.words = c.words.concat(n.words); n.t0 = c.t0; chunks.splice(i, 1); i--; }
  }
  return chunks;
}

export function drawCaption(ctx, chunks, t, o = {}) {
  const { cx = 540, cy = 1368, size = 70, maxW = 940 } = o;
  let idx = -1;
  for (let i = 0; i < chunks.length; i++) { if (t >= chunks[i].t0 - 0.02 && t < chunks[i].t1 + 0.14 && !(i + 1 < chunks.length && t >= chunks[i + 1].t0 - 0.02)) { idx = i; break; } }
  if (idx < 0) return;
  const ch = chunks[idx]; const tin = t - (ch.t0 - 0.02);
  const tout = t - ch.t1;                          // >0 após a fala do bloco
  const ap = E.outBack(clamp(tin / 0.16), 2.2);
  const fadeOut = 1 - clamp((tout - 0.04) / 0.1);
  const words = ch.words.map((w) => w.w.toUpperCase().replace(/[…]/g, '…'));
  ctx.font = fontStr(size, 'Montserrat', 800);
  const spW = size * 0.44;
  const widths = words.map((w) => { ctx.font = fontStr(size, 'Montserrat', 800); return ctx.measureText(w).width; });
  const total = widths.reduce((a, b) => a + b, 0) + spW * (words.length - 1);
  // quebra em 2 linhas se passar da largura
  let lines = [words.map((w, i) => i)];
  if (total > maxW) { const half = Math.ceil(words.length / 2); lines = [words.slice(0, half).map((w, i) => i), words.slice(half).map((w, i) => i + half)]; }
  const lh = size * 1.12; const y0 = cy - ((lines.length - 1) * lh) / 2;
  ctx.save(); ctx.globalAlpha *= clamp(ap * 1.4) * fadeOut; ctx.translate(cx, cy); ctx.scale(0.86 + 0.14 * ap, 0.86 + 0.14 * ap); ctx.translate(-cx, -cy);
  lines.forEach((ids, li) => {
    const lw = ids.reduce((a, i) => a + widths[i], 0) + spW * (ids.length - 1);
    let x = cx - lw / 2; const y = y0 + li * lh;
    for (const i of ids) {
      const w = ch.words[i]; const active = t >= w.t0 - 0.01 && t < w.t1 + 0.02;
      const past = t >= w.t1 + 0.02;
      const pa = active ? E.outBack(clamp((t - w.t0) / 0.14), 3) : 1;
      const k = active ? 1 + 0.09 * Math.sin(Math.PI * clamp((t - w.t0) / 0.22)) : 1;
      ctx.save(); ctx.translate(x + widths[i] / 2, y); ctx.scale(k, k); ctx.rotate(active ? Math.sin((t - w.t0) * 22) * 0.012 : 0);
      ctx.font = fontStr(size, 'Montserrat', 800); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
      // sombra/contorno para legibilidade
      ctx.shadowColor = 'rgba(8,12,30,0.55)'; ctx.shadowBlur = 18; ctx.shadowOffsetY = 6;
      ctx.lineWidth = size * 0.16; ctx.strokeStyle = COL.navy; ctx.strokeText(words[i], 0, 0);
      ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
      if (active) { ctx.shadowColor = COL.yellow; ctx.shadowBlur = 28; ctx.fillStyle = COL.yellow; ctx.fillText(words[i], 0, 0); ctx.shadowBlur = 0; ctx.save(); ctx.fillStyle = '#fff6cc'; ctx.globalAlpha *= 0.35 * clamp(pa); ctx.fillText(words[i], 0, -1); ctx.restore(); }
      else { ctx.fillStyle = past ? 'rgba(255,255,255,0.96)' : 'rgba(255,255,255,0.78)'; ctx.fillText(words[i], 0, 0); }
      ctx.restore();
      x += widths[i] + spW;
    }
  });
  ctx.restore();
}
