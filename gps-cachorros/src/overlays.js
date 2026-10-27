// Overlays 2D por cena (tipografia cinética, HUD). Coordenadas lógicas 1080x1920.
import { COL, E, clamp, lerp, prog, kinetic, glowLine, arc, roundRect, pill, paw, fontStr, rgba, measure } from './typography.js';
import { circleAngle } from './dogAnim.js';

const h1 = (x) => { const s = Math.sin(x * 12.9898 + 78.233) * 43758.5453; return s - Math.floor(s); };

function topShade(ctx, a = 0.5, h = 760) {
  const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, `rgba(11,16,36,${a})`); g.addColorStop(1, 'rgba(11,16,36,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 1080, h);
}
function bottomShade(ctx, a = 0.45, y0 = 1150) {
  const g = ctx.createLinearGradient(0, y0, 0, 1920); g.addColorStop(0, 'rgba(11,16,36,0)'); g.addColorStop(1, `rgba(11,16,36,${a})`);
  ctx.fillStyle = g; ctx.fillRect(0, y0, 1080, 1920 - y0);
}
function star(ctx, x, y, r, col, rot = 0) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.fillStyle = col; ctx.shadowColor = col; ctx.shadowBlur = 16; ctx.beginPath();
  for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2 - Math.PI / 2, rr = i % 2 ? r * 0.45 : r; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
  ctx.closePath(); ctx.fill(); ctx.restore();
}
// arco desenhado sobre o plano do chão, com projeção em perspectiva
function arc3(ctx, proj, cx, cy, cz, r, a0, a1, col, w = 9, head = 22, alpha = 1) {
  const n = 28, pts = [];
  for (let i = 0; i <= n; i++) { const a = a0 + ((a1 - a0) * i) / n; const p = proj(cx + Math.sin(a) * r, cy, cz + Math.cos(a) * r); pts.push(p); }
  if (pts.some((p) => !(p.w > 0))) return;
  ctx.save(); ctx.globalAlpha *= alpha; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = col; ctx.shadowColor = col; ctx.shadowBlur = 20;
  ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  const sc = clamp(7.0 / Math.max(pts[0].w, 0.5), 0.55, 2.2);
  ctx.lineWidth = w * sc; ctx.stroke(); ctx.shadowBlur = 0; ctx.lineWidth = w * sc * 0.4; ctx.strokeStyle = '#fff'; ctx.stroke();
  const p1 = pts[n - 1], p2 = pts[n]; const ang = Math.atan2(p2.y - p1.y, p2.x - p1.x);
  ctx.translate(p2.x, p2.y); ctx.rotate(ang); ctx.fillStyle = col; ctx.shadowColor = col; ctx.shadowBlur = 16; ctx.beginPath(); ctx.moveTo(head * sc, 0); ctx.lineTo(-head * 0.5 * sc, head * 0.75 * sc); ctx.lineTo(-head * 0.5 * sc, -head * 0.75 * sc); ctx.closePath(); ctx.fill();
  ctx.restore();
}
function chip(ctx, x, y, text, o = {}) {
  const { size = 34, fill = 'rgba(11,16,36,0.82)', stroke = COL.cyan, col = '#fff', align = 'left', pad = 28, dot = null, alpha = 1, scale = 1 } = o;
  ctx.save(); ctx.font = fontStr(size, 'Montserrat', 800); const tw = ctx.measureText(text).width; const w = tw + pad * 2 + (dot ? size * 0.9 : 0), h = size * 1.9;
  const x0 = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
  ctx.globalAlpha *= alpha; ctx.translate(x0 + w / 2, y + h / 2); ctx.scale(scale, scale); ctx.translate(-(x0 + w / 2), -(y + h / 2));
  pill(ctx, x0, y, w, h, { fill, stroke, glow: stroke, lw: 3 });
  ctx.textBaseline = 'middle'; ctx.textAlign = 'left'; let tx = x0 + pad;
  if (dot) { ctx.fillStyle = dot; ctx.shadowColor = dot; ctx.shadowBlur = 14; ctx.beginPath(); ctx.arc(tx + size * 0.28, y + h / 2, size * 0.28, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0; tx += size * 0.9; }
  ctx.fillStyle = col; ctx.fillText(text, tx, y + h / 2 + 2); ctx.restore();
  return { w, h };
}
function rollNumber(ctx, n, p, x, y, size, col, glowCol) {
  ctx.save(); ctx.textAlign = 'center'; ctx.font = fontStr(size, 'Anton', 400); ctx.shadowColor = glowCol; ctx.shadowBlur = 24;
  const ap = p < 1 ? E.outBack(p, 2) : 1;
  if (p < 1 && n > 0) { ctx.globalAlpha = 1 - clamp(ap); ctx.fillStyle = col; ctx.fillText(String(n - 1), x, y - ap * size * 0.8); }
  ctx.globalAlpha = clamp(ap * 1.4); ctx.fillStyle = col; ctx.fillText(String(n), x, y + (1 - ap) * size * 0.8);
  ctx.restore();
}

// ------------------------------------------------------------------ CENA 1
function ov1(D, ctx, t) {
  if (t > 5.1) return;
  const out = 4.62;
  const sh = E.outCubic(prog(t, 0.0, 0.5)) * (1 - E.inCubic(prog(t, out, 0.38)));
  ctx.save(); ctx.globalAlpha = sh; topShade(ctx, 0.55, 820); ctx.restore();
  const k = E.inOutCubic(prog(t, 2.15, 0.5));
  kinetic(ctx, 'SEU CACHORRO', { x: 540, y: lerp(440, 330, k), size: lerp(158, 108, k), t: t + 0.18, effect: 'bounce', stagger: 0.035, dur: 0.5, fill: '#ffffff', extrude: lerp(14, 10, k), extrudeCol: '#0b1024', glow: COL.cyan, glowBlur: 26, out: 4.35 + 0.18, idle: 3 });
  kinetic(ctx, 'TEM GPS?!', { x: 540, y: lerp(660, 480, k), size: lerp(214, 150, k), t: t - 0.7, effect: 'slam', stagger: 0.05, dur: 0.42, grad: ['#fff2a8', COL.yellow], extrude: lerp(18, 12, k), extrudeCol: '#0b1024', glow: COL.yellow, glowBlur: 34, rot: -0.045, out: 4.45 + 0.7, idle: 4 });
}

// ------------------------------------------------------------------ CENA 2
function ov2(D, ctx, t, A) {
  if (t < 4.9 || t > 12.3) return;
  const outT = 11.5;
  const fade = E.outCubic(prog(t, 5.0, 0.4)) * (1 - E.inCubic(prog(t, outT, 0.4)));
  ctx.save(); ctx.globalAlpha = fade; topShade(ctx, 0.5, 820); ctx.restore();
  kinetic(ctx, 'POR QUE TANTAS', { x: 540, y: 345, size: 112, t: t - 5.3, effect: 'bounce', stagger: 0.03, dur: 0.5, fill: '#ffffff', extrude: 12, extrudeCol: '#0b1024', glow: COL.cyan, glowBlur: 22, out: 11.45 - 5.3, idle: 2 });
  kinetic(ctx, 'VOLTAS?', { x: 540, y: 590, size: 252, t: t - 5.7, effect: 'spin', stagger: 0.07, dur: 0.7, grad: ['#fff2a8', COL.yellow], extrude: 18, extrudeCol: '#0b1024', glow: COL.yellow, glowBlur: 36, rot: -0.04, out: 11.5 - 5.7, idle: 5 });
  // setas circulares em perspectiva em volta do cão
  if (A.proj && t > 5.5 && t < 10.0) {
    const al = E.outCubic(prog(t, 5.5, 0.5)) * (1 - E.inCubic(prog(t, 9.2, 0.7)));
    for (let k = 0; k < 3; k++) { const a0 = t * 3.4 + (k * Math.PI * 2) / 3; arc3(ctx, A.proj, 0, 0.06, -0.62, 1.05, a0, a0 + 1.45, k === 1 ? COL.yellow : COL.cyan, 9, 24, al); }
  }
  // contador de voltas
  if (t > 5.6) {
    const laps = circleAngle(t) / (Math.PI * 2); const n = Math.floor(laps + 0.0001); const p = (laps - n) / 0.16;
    let pulse = 0; for (const w of D.timing.lines[1].words) if (/^rodando/i.test(w.w)) pulse = Math.max(pulse, Math.exp(-(t - w.t0) * 9) * (t >= w.t0 ? 1 : 0));
    const ap = E.outBack(prog(t, 5.6, 0.4), 2) * (1 - E.inCubic(prog(t, 11.1, 0.4)));
    const cx = 160, cy = 840;
    ctx.save(); ctx.translate(cx, cy); ctx.scale(ap * (1 + 0.14 * pulse), ap * (1 + 0.14 * pulse)); ctx.translate(-cx, -cy); ctx.globalAlpha = clamp(ap);
    pill(ctx, 40, cy - 78, 400, 156, { fill: 'rgba(11,16,36,0.82)', stroke: COL.cyan, glow: COL.cyan, lw: 4 });
    ctx.fillStyle = COL.cyan; ctx.font = fontStr(30, 'Montserrat', 800); ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText('VOLTAS', 168, cy - 36);
    arc(ctx, 98, cy, 30, 0.4, 0.4 + Math.PI * 1.55, COL.yellow, 7, 14); ctx.fillStyle = COL.yellow; ctx.beginPath(); ctx.moveTo(98 + Math.cos(0.4) * 30 + 14, cy + Math.sin(0.4) * 30 - 6); ctx.lineTo(98 + Math.cos(0.4) * 30 - 10, cy + Math.sin(0.4) * 30 - 16); ctx.lineTo(98 + Math.cos(0.4) * 30 - 6, cy + Math.sin(0.4) * 30 + 10); ctx.closePath(); ctx.fill();
    ctx.save(); ctx.beginPath(); ctx.rect(180, cy - 70, 240, 150); ctx.clip(); rollNumber(ctx, n, clamp(p), 300, cy + 42, 112, COL.yellow, COL.yellow); ctx.restore();
    ctx.restore();
  }
  // crash zoom: linhas de velocidade
  if (t >= 9.5 && t < 10.05) {
    const a = 1 - (t - 9.5) / 0.55; ctx.save(); ctx.globalAlpha = a * 0.9; ctx.lineCap = 'round';
    for (let i = 0; i < 70; i++) { const ang = h1(i * 3.1) * Math.PI * 2, r0 = 330 + h1(i) * 260, r1 = r0 + 400 + h1(i * 2.3) * 700; ctx.strokeStyle = i % 4 === 0 ? COL.yellow : '#ffffff'; ctx.lineWidth = 3 + h1(i * 5.5) * 5; ctx.beginPath(); ctx.moveTo(540 + Math.cos(ang) * r0, 960 + Math.sin(ang) * r0 * 1.2); ctx.lineTo(540 + Math.cos(ang) * r1, 960 + Math.sin(ang) * r1 * 1.2); ctx.stroke(); }
    ctx.restore();
  }
  // tontura: estrelas girando em volta da cabeça
  if (t > 10.15 && t < 11.7 && A.head) {
    const al = E.outCubic(prog(t, 10.15, 0.3)) * (1 - E.inCubic(prog(t, 11.3, 0.4))); const hx = A.head.x, hy = A.head.y - A.head.ppm * 0.50, rr = A.head.ppm * 0.50;
    for (let i = 0; i < 5; i++) { const a = t * 5.5 + (i * Math.PI * 2) / 5; const z = Math.sin(a); star(ctx, hx + Math.cos(a) * rr, hy + z * rr * 0.22, (30 + z * 7) * al, i % 2 ? COL.yellow : COL.cyan, t * 3 + i); }
  }
}

// ------------------------------------------------------------------ CENA 3
function poleTag(ctx, p, letter, col, t, t0) {
  if (!p || !(p.w === undefined || p.w > 0)) return; const x = p.x, y = p.y; if (x < 70 || x > 1010 || y < 240 || y > 1500) return;
  const ap = E.outBack(prog(t, t0, 0.4), 2) * (1 - E.inCubic(prog(t, 20.4, 0.4))); if (ap <= 0.01) return;
  ctx.save(); ctx.translate(x, y); ctx.scale(ap, ap); const pulse = 0.5 + 0.5 * Math.sin(t * 5);
  ctx.strokeStyle = col; ctx.shadowColor = col; ctx.shadowBlur = 20; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(0, 0, 40 + pulse * 6, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = 'rgba(11,16,36,0.85)'; ctx.beginPath(); ctx.arc(0, 0, 34, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
  ctx.fillStyle = col; ctx.font = fontStr(46, 'Anton', 400); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(letter, 0, 3); ctx.restore();
}
function ov3(D, ctx, t, A) {
  if (t < 12.2 || t > 21.3) return;
  const outT = 20.35;
  const fade = E.outCubic(prog(t, 13.0, 0.6)) * (1 - E.inCubic(prog(t, outT, 0.4)));
  ctx.save(); ctx.globalAlpha = fade * 0.8; topShade(ctx, 0.5, 700); ctx.restore();
  kinetic(ctx, 'CAMPO MAGNÉTICO', { x: 540, y: 330, size: 124, t: t - 13.25, effect: 'zoom', stagger: 0.035, dur: 0.6, grad: ['#ffffff', '#8defff'], extrude: 12, extrudeCol: '#0b1024', glow: COL.cyan, glowBlur: 34, out: 20.25 - 13.25 });
  kinetic(ctx, 'DA TERRA', { x: 540, y: 540, size: 214, t: t - 13.6, effect: 'slam', stagger: 0.06, dur: 0.5, grad: ['#fff2a8', COL.yellow], extrude: 18, extrudeCol: '#0b1024', glow: COL.yellow, glowBlur: 36, rot: -0.03, out: 20.35 - 13.6, idle: 3 });
  // varredura amarela quando a locução diz "campo magnético da Terra"
  const p = prog(t, 18.05, 0.55);
  if (p > 0 && t < outT) { ctx.save(); ctx.globalAlpha = 1 - clamp((t - 19.6) / 0.5); const w = 880 * E.outCubic(p); ctx.fillStyle = COL.yellow; ctx.shadowColor = COL.yellow; ctx.shadowBlur = 20; roundRect(ctx, 100, 628, w, 9, 4); ctx.fill(); ctx.restore(); }
  if (A.north) { poleTag(ctx, A.north, 'N', COL.cyan, t, 14.2); poleTag(ctx, A.south, 'S', COL.yellow, t, 14.5); }
}

// ------------------------------------------------------------------ CENA 4
function polarHist(ctx, cx, cy, R, tt, t, strength = 1) {
  const bins = 24; const ap = E.outCubic(clamp(tt / 0.5));
  ctx.save(); ctx.translate(cx, cy); ctx.scale(ap, ap);
  const bg = ctx.createRadialGradient(0, 0, 10, 0, 0, R * 1.18); bg.addColorStop(0, 'rgba(11,16,36,0.78)'); bg.addColorStop(1, 'rgba(11,16,36,0.55)');
  ctx.fillStyle = bg; ctx.beginPath(); ctx.arc(0, 0, R * 1.16, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = COL.cyan; ctx.shadowColor = COL.cyan; ctx.shadowBlur = 14; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(0, 0, R * 1.16, 0, Math.PI * 2); ctx.stroke(); ctx.shadowBlur = 0;
  ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(0,217,245,0.45)';
  for (const f of [0.35, 0.65, 1.0]) { ctx.beginPath(); ctx.arc(0, 0, R * f, 0, Math.PI * 2); ctx.stroke(); }
  for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; ctx.beginPath(); ctx.moveTo(Math.sin(a) * R * 0.2, -Math.cos(a) * R * 0.2); ctx.lineTo(Math.sin(a) * R * 1.05, -Math.cos(a) * R * 1.05); ctx.stroke(); }
  // barras (N em cima): dados estilizados — preferência por N–S sob campo estável
  const r0 = R * 0.2;
  for (let i = 0; i < bins; i++) {
    const a0 = ((i - 0.46) / bins) * Math.PI * 2, a1 = ((i + 0.46) / bins) * Math.PI * 2; const th = (i / bins) * Math.PI * 2;
    const base = 0.16 + 0.07 * h1(i * 1.7); const peak = Math.pow(Math.abs(Math.cos(th)), 3.2) * 0.84 * strength; const v = base + peak * (0.8 + 0.2 * h1(i * 3.3));
    const g = E.outBack(clamp((tt - 0.25 - i * 0.022) / 0.55), 1.7); const rr = r0 + (R - r0) * v * g;
    const col = v > 0.55 ? COL.yellow : COL.cyan;
    ctx.fillStyle = col; ctx.shadowColor = col; ctx.shadowBlur = v > 0.55 ? 16 : 8; ctx.globalAlpha = 0.92;
    ctx.beginPath(); ctx.arc(0, 0, rr, a0 - Math.PI / 2, a1 - Math.PI / 2); ctx.arc(0, 0, r0, a1 - Math.PI / 2, a0 - Math.PI / 2, true); ctx.closePath(); ctx.fill();
  }
  ctx.globalAlpha = 1; ctx.shadowBlur = 0;
  ctx.fillStyle = '#fff'; ctx.font = fontStr(30, 'Montserrat', 800); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  [['N', 0, '#ffffff'], ['L', 90, COL.cyan], ['S', 180, COL.yellow], ['O', 270, COL.cyan]].forEach(([l, d, c]) => { const a = (d / 180) * Math.PI; ctx.fillStyle = c; ctx.fillText(l, Math.sin(a) * R * 1.32 * 0.9, -Math.cos(a) * R * 1.32 * 0.9); });
  ctx.restore();
}
function ov4(D, ctx, t, A) {
  if (t < 20.95 || t > 32.3) return;
  const fade = E.outCubic(prog(t, 21.1, 0.4)) * (1 - E.inCubic(prog(t, 31.7, 0.3)));
  ctx.save(); ctx.globalAlpha = fade * 0.9; topShade(ctx, 0.62, 880); ctx.restore();
  const hide = E.inOutCubic(prog(t, 28.0, 0.35));
  ctx.save(); ctx.globalAlpha = fade;
  // fonte
  chip(ctx, 56, 236, 'ESTUDO · HART ET AL. (2013) · FRONTIERS IN ZOOLOGY', { size: 22, stroke: COL.cyan, alpha: E.outCubic(prog(t, 21.3, 0.4)), pad: 22 });
  // "70": pop no instante da palavra
  const t70 = 22.29; const shrink = E.inOutCubic(prog(t, 24.2, 0.6));
  if (t >= 21.9 && hide < 0.999) {
    ctx.save(); ctx.globalAlpha *= 1 - hide;
    const pp = E.spring(clamp((t - t70 + 0.12) / 0.8), 13, 0.42);
    const cnt = Math.round(70 * E.outCubic(clamp((t - 22.0) / 0.45)));
    const x = lerp(540, 250, shrink), y = lerp(620, 560, shrink), sz = lerp(400, 190, shrink);
    ctx.save(); ctx.translate(x, y); ctx.scale(Math.max(pp, 0.001), Math.max(pp, 0.001)); ctx.translate(-x, -y);
    kinetic(ctx, String(cnt), { x, y, size: sz, t: 99, effect: 'none', grad: ['#ffffff', '#8defff'], extrude: Math.round(lerp(26, 14, shrink)), extrudeCol: '#0b1024', glow: COL.cyan, glowBlur: 44, spacing: 4 });
    kinetic(ctx, 'CÃES ANALISADOS', { x, y: y + lerp(110, 78, shrink), size: lerp(88, 50, shrink), t: t - 22.55, effect: 'rise', stagger: 0.025, dur: 0.4, fill: '#ffffff', extrude: 6, extrudeCol: '#0b1024', glow: COL.cyan, glowBlur: 16 });
    ctx.restore();
    // chips de dados
    if (t > 23.1) {
      const a1 = E.outBack(prog(t, 23.1, 0.35), 2), a2 = E.outBack(prog(t, 23.45, 0.35), 2);
      const x0 = lerp(540, 56, shrink); const al = lerp(1, 1, shrink);
      chip(ctx, lerp(300, 56, shrink), lerp(780, 690, shrink), '37 RAÇAS', { size: 32, stroke: COL.yellow, scale: a1, alpha: clamp(a1), dot: COL.yellow });
      chip(ctx, lerp(300, 56, shrink), lerp(780, 690, shrink) + 84, '1.893 OBSERVAÇÕES', { size: 32, stroke: COL.cyan, scale: a2, alpha: clamp(a2), dot: COL.cyan });
    }
    ctx.restore();
  }
  // gráfico polar + estado do campo
  if (t > 24.3 && hide < 0.999) {
    ctx.save(); ctx.globalAlpha *= 1 - hide;
    const tt = t - 24.3; polarHist(ctx, 760, 590, 205, tt, t);
    const ap = E.outBack(prog(t, 24.5, 0.4), 2); const blink = 0.6 + 0.4 * Math.sin(t * 8);
    chip(ctx, 760, 830, 'CAMPO ESTÁVEL', { size: 30, align: 'center', stroke: COL.cyan, scale: ap, alpha: clamp(ap), dot: `rgba(0,217,245,${blink})` });
    ctx.save(); ctx.globalAlpha *= clamp(ap) * 0.75; ctx.fillStyle = '#ffffff'; ctx.font = fontStr(21, 'Montserrat', 600); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('gráfico ilustrativo', 760, 912); ctx.restore();
    // eixo N–S destacado no gráfico
    if (t > 26.6) { const k = E.outCubic(prog(t, 26.6, 0.5)); glowLine(ctx, 760, 590 - 242 * k, 760, 590 + 242 * k, COL.yellow, 6, 22, 0.95); }
    ctx.restore();
  }
  // texto-título do eixo (no instante de "norte-sul")
  if (t > 28.15) {
    kinetic(ctx, 'EIXO', { x: 540, y: 356, size: 70, t: t - 28.15, effect: 'rise', stagger: 0.04, dur: 0.4, fill: '#ffffff', spacing: 14, extrude: 5, extrudeCol: '#0b1024', glow: COL.cyan, glowBlur: 14 });
    kinetic(ctx, 'NORTE–SUL', { x: 540, y: 552, size: 196, t: t - 28.25, effect: 'slam', stagger: 0.05, dur: 0.45, grad: ['#ffffff', '#8defff'], extrude: 16, extrudeCol: '#0b1024', glow: COL.cyan, glowBlur: 38, rot: -0.025, idle: 3 });
  }
  ctx.restore();
  // marcadores N / S nas pontas do eixo (a linha em si é um objeto 3D com profundidade)
  if (A.proj && t > 27.4) {
    const k = E.outBack(prog(t, 27.4, 0.5), 2);
    const n = A.proj(0, 0.3, -1.85), s2 = A.proj(0, 0.3, 1.85);
    ctx.save(); ctx.globalAlpha = fade * clamp(k);
    for (const [pt, l, c] of [[n, 'N', '#ffffff'], [s2, 'S', COL.yellow]]) {
      if (!(pt.w > 0.5)) continue;
      ctx.save(); ctx.translate(pt.x, pt.y); ctx.scale(k, k); ctx.fillStyle = 'rgba(11,16,36,0.85)'; ctx.strokeStyle = c; ctx.shadowColor = c; ctx.shadowBlur = 16; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(0, 0, 34, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.shadowBlur = 0;
      ctx.fillStyle = c; ctx.font = fontStr(44, 'Anton', 400); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(l, 0, 3); ctx.restore();
    }
    ctx.restore();
  }
}

// ------------------------------------------------------------------ CENA 5
function ghost(ctx, str, o, col, dx, dy) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha *= 0.85; kinetic(ctx, str, { ...o, fill: col, extrude: 0, glow: null, grad: null, x: o.x + dx, y: o.y + dy }); ctx.restore(); }
function ov5(D, ctx, t, A) {
  if (t < 31.95 || t > 39.2) return;
  const fade = E.outCubic(prog(t, 32.3, 0.3)) * (1 - E.inCubic(prog(t, 38.7, 0.3)));
  ctx.save(); ctx.globalAlpha = fade * 0.8; topShade(ctx, 0.62, 860); ctx.restore();
  // "NEM SEMPRE"
  if (t > 33.25 && t < 35.5) {
    const o = { x: 540, y: 400, size: 164, t: t - 33.35, effect: 'drop', stagger: 0.04, dur: 0.5, fill: '#ffffff', extrude: 14, extrudeCol: '#0b1024', glow: COL.cyan, glowBlur: 26, out: 35.12 - 33.35, outDur: 0.25 };
    kinetic(ctx, 'NEM SEMPRE', o);
  }
  // título com glitch RGB + cortes
  if (t > 35.58) {
    const g = (t < 36.0 ? 1 : 0) + 0.55 * (h1(Math.floor(t * 12)) > 0.86 ? 1 : 0) + (t > 37.28 && t < 37.5 ? 1 : 0);
    const j = (h1(Math.floor(t * 22) * 1.3) - 0.5) * 26 * g;
    const o1 = { x: 540, y: 400, size: 150, t: t - 35.62, effect: 'slam', stagger: 0.045, dur: 0.4, fill: '#ffffff', extrude: 12, extrudeCol: '#0b1024', glow: COL.cyan, glowBlur: 24, out: 38.4 - 35.62 };
    const o2 = { x: 540, y: 620, size: 232, t: t - 35.7, effect: 'slam', stagger: 0.05, dur: 0.45, grad: ['#fff2a8', COL.yellow], extrude: 18, extrudeCol: '#0b1024', glow: COL.yellow, glowBlur: 34, rot: -0.03, out: 38.45 - 35.7, idle: 3 };
    if (g > 0.01) { ghost(ctx, 'AINDA É UM', o1, '#ff2f6d', -j - 6, 0); ghost(ctx, 'AINDA É UM', o1, '#00d9f5', j + 6, 0); ghost(ctx, 'MISTÉRIO!', o2, '#ff2f6d', -j - 8, 0); ghost(ctx, 'MISTÉRIO!', o2, '#00d9f5', j + 8, 0); }
    kinetic(ctx, 'AINDA É UM', { ...o1, x: o1.x + j * 0.3 }); kinetic(ctx, 'MISTÉRIO!', { ...o2, x: o2.x - j * 0.3 });
    if (g > 0.3) { ctx.save(); ctx.globalCompositeOperation = 'destination-out'; for (let i = 0; i < 6; i++) { const y = 280 + h1(i * 7.7 + Math.floor(t * 20)) * 460; ctx.fillRect(0, y, 1080, 4 + h1(i * 3.3) * 14); } ctx.restore(); }
    if (t > 36.75) chip(ctx, 540, 740, 'CAUSA AINDA DESCONHECIDA', { size: 30, align: 'center', stroke: COL.yellow, scale: E.outBack(prog(t, 36.75, 0.35), 2), alpha: E.outCubic(prog(t, 36.75, 0.2)) * (1 - E.inCubic(prog(t, 38.4, 0.3))), dot: COL.yellow });
  }
  // pontos de interrogação flutuando
  if (A.head && t > 32.4) {
    for (let i = 0; i < 6; i++) {
      const ph = h1(i * 4.4); const a = (t * 0.5 + ph * 6.28); const x = 540 + Math.sin(a + i) * 400, y = 980 + Math.cos(a * 0.7 + i * 2) * 260 + ((t * 40 + i * 90) % 300) * 0 - ((t * 25 + i * 130) % 260);
      const al = clamp((t - 32.4) / 0.5) * (0.35 + 0.35 * Math.sin(t * 2 + i)) * fade; ctx.save(); ctx.globalAlpha = al; ctx.translate(x, y); ctx.rotate(Math.sin(t + i) * 0.3);
      ctx.font = fontStr(90 + (i % 3) * 30, 'Anton', 400); ctx.textAlign = 'center'; ctx.fillStyle = i % 2 ? COL.cyan : COL.yellow; ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 22; ctx.fillText('?', 0, 0); ctx.restore();
    }
  }
}

// ------------------------------------------------------------------ CENA 6
function ov6(D, ctx, t, A) {
  if (t < 38.95) return;
  const fade = E.outCubic(prog(t, 39.0, 0.4));
  ctx.save(); ctx.globalAlpha = fade * 0.5 * clamp((t - 43.0) / 0.5 + 0.0); topShade(ctx, 0.55, 800); ctx.restore();
  const t0 = 43.42;
  if (t > t0 - 0.02) {
    kinetic(ctx, 'VOCÊ JÁ PERCEBEU', { x: 540, y: 318, size: 104, t: t - t0, effect: 'bounce', stagger: 0.03, dur: 0.5, fill: '#ffffff', extrude: 11, extrudeCol: '#0b1024', glow: COL.cyan, glowBlur: 24, idle: 2 });
    kinetic(ctx, 'ISSO?', { x: 470, y: 610, size: 280, t: t - t0 - 0.35, effect: 'bounce', stagger: 0.08, dur: 0.6, grad: ['#fff2a8', COL.yellow], extrude: 20, extrudeCol: '#0b1024', glow: COL.yellow, glowBlur: 38, rot: -0.04, idle: 5 });
    const pp = E.outBack(prog(t, t0 + 0.85, 0.5), 2.4);
    if (pp > 0.01) { ctx.save(); ctx.translate(850, 500); ctx.rotate(0.35 + Math.sin(t * 4) * 0.08); ctx.scale(pp * 1.0, pp * 1.0); paw(ctx, 0, 0, 95, COL.yellow); ctx.restore(); }
  }
  // crédito da fonte
  const cr = E.outCubic(prog(t, 41.2, 0.5));
  if (cr > 0) {
    ctx.save(); ctx.globalAlpha = cr; pill(ctx, 120, 1488, 840, 84, { fill: 'rgba(11,16,36,0.74)', stroke: 'rgba(0,217,245,0.7)', glow: COL.cyan, lw: 2, blur: 10 });
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#ffffff';
    ctx.font = fontStr(24, 'Montserrat', 800); ctx.fillText('FONTE: HART ET AL. (2013) · FRONTIERS IN ZOOLOGY', 540, 1518);
    ctx.font = fontStr(20, 'Montserrat', 600); ctx.fillStyle = '#9fefff'; ctx.fillText('pmc.ncbi.nlm.nih.gov/articles/PMC3882779', 540, 1549); ctx.restore();
  }
}

export function drawOverlayAll(D, ctx, t, A) {
  ctx.save(); ov1(D, ctx, t, A); ctx.restore();
  ctx.save(); ov2(D, ctx, t, A); ctx.restore();
  ctx.save(); ov3(D, ctx, t, A); ctx.restore();
  ctx.save(); ov4(D, ctx, t, A); ctx.restore();
  ctx.save(); ov5(D, ctx, t, A); ctx.restore();
  ctx.save(); ov6(D, ctx, t, A); ctx.restore();
}
