// Camada HUD ortográfica (pixels, y para cima, origem no centro): legendas dinâmicas por palavra, pílulas, ícone de patinha, créditos.
import * as THREE from 'three';
import gsap from 'gsap';
import { TextBlock } from '../kit/text.js';
import { col, BRAND } from '../kit/util.js';

export class Hud {
  constructor(W = 1080, H = 1920) {
    this.W = W; this.H = H; this.scene = new THREE.Scene(); this.cam = new THREE.OrthographicCamera(-W / 2, W / 2, H / 2, -H / 2, -50, 50); this.cam.position.z = 10;
    this.order = 0;
    const m = new THREE.ShaderMaterial({ transparent: true, depthTest: false, depthWrite: false, vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `precision highp float; varying vec2 vUv; uniform float uOpacity; void main(){ float y = (vUv.y - 0.5) * 2.0; float a = exp(-pow((y + 0.05) / 0.62, 2.0)); gl_FragColor = vec4(0.02, 0.04, 0.12, a * 0.66 * uOpacity); }`, uniforms: { uOpacity: { value: 0 } } });
    this.scrim = new THREE.Mesh(new THREE.PlaneGeometry(1080, 760), m); this.scrim.position.set(0, -245, -5); this.scrim.renderOrder = 0; this.scene.add(this.scrim); this.scrimMat = m;
  }
  add(obj, order = 0) { obj.traverse((o) => { o.renderOrder = order; }); this.scene.add(obj); return obj; }
}

const PILL_FS = `precision highp float; varying vec2 vUv; uniform vec2 uSize; uniform float uR, uOpacity, uStroke; uniform vec3 uColor, uColor2, uStrokeCol;
float sdBox(vec2 p, vec2 b, float r){ vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
void main(){ vec2 p = (vUv - 0.5) * uSize; float d = sdBox(p, uSize * 0.5, uR); float a = smoothstep(1.0, -1.0, d);
  float st = smoothstep(uStroke + 1.0, uStroke - 0.5, abs(d + uStroke * 0.5)) * step(0.01, uStroke);
  vec3 c = mix(uColor, uColor2, vUv.y); c = mix(c, uStrokeCol, st); gl_FragColor = vec4(c, a * uOpacity); }`;
export function pill(w, h, o = {}) {
  const m = new THREE.ShaderMaterial({ transparent: true, depthTest: false, depthWrite: false, vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`, fragmentShader: PILL_FS,
    uniforms: { uSize: { value: new THREE.Vector2(w, h) }, uR: { value: o.r ?? h / 2 }, uOpacity: { value: o.opacity ?? 1 }, uStroke: { value: o.stroke ?? 0 }, uColor: { value: col(o.color ?? BRAND.yellow) }, uColor2: { value: col(o.color2 ?? o.color ?? BRAND.yellow) }, uStrokeCol: { value: col(o.strokeColor ?? BRAND.cyan) } } });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m); mesh.userData.mat = m; return mesh;
}

// patinha vetorial (almofada + 4 dedos)
export function paw(size = 100, color = BRAND.yellow) {
  const g = new THREE.Group(); const m = new THREE.MeshBasicMaterial({ color: col(color), transparent: true, depthTest: false, depthWrite: false });
  const ell = (x, y, rx, ry, rot) => { const s = new THREE.Shape(); s.absellipse(0, 0, rx, ry, 0, Math.PI * 2, false, rot); const mesh = new THREE.Mesh(new THREE.ShapeGeometry(s, 24), m); mesh.position.set(x * size, y * size, 0); mesh.scale.set(size, size, 1); g.add(mesh); };
  ell(0, -0.12, 0.30, 0.24, 0); ell(-0.32, 0.16, 0.115, 0.15, 0.45); ell(-0.12, 0.34, 0.12, 0.16, 0.12); ell(0.12, 0.34, 0.12, 0.16, -0.12); ell(0.32, 0.16, 0.115, 0.15, -0.45);
  g.userData.mat = m; return g;
}

// uma linha (ou duas) de legenda, palavra por palavra. words: [{t, c?, pill?}] ; maxW px
export function subline(tf, words, o = {}) {
  const size = o.size ?? 58, maxW = o.maxW ?? 780, gapEm = 0.3, lh = o.lineHeight ?? 1.32;
  const g = new THREE.Group(); const items = [];
  const meas = (txt) => tf.layout(txt, 0.0).width * size;
  let lines = [[]], cur = 0; const gap = gapEm * size;
  for (const w of words) { const wd = meas(w.t) + (w.pill ? size * 0.5 : 0); if (cur + wd > maxW && lines[lines.length - 1].length) { lines.push([]); cur = 0; } lines[lines.length - 1].push({ ...w, wd }); cur += wd + gap; }
  const total = lines.length; const blocks = [];
  lines.forEach((ln, li) => {
    const lw = ln.reduce((a, w) => a + w.wd, 0) + gap * (ln.length - 1); let x = -lw / 2; const y = -(li - (total - 1) / 2) * size * lh;
    for (const w of ln) {
      const cxw = x + w.wd / 2; const color = w.pill ? BRAND.navy : (w.c ?? '#FFFFFF');
      const mk = (c, blend = true, shadow = false) => new TextBlock(tf, w.t, { size, depth: 0, colorA: c, colorB: c, flat: 1, blend, amb: 1 });
      const sh = mk('#050A1E'); sh.group.position.set(cxw + 0, y - 4, -0.2); sh.setOpacity(0.0);
      const tb = mk(color); tb.group.position.set(cxw, y, 0);
      let bg = null; if (w.pill) { bg = pill(w.wd, size * 1.2, { color: w.pill === true ? BRAND.yellow : w.pill }); bg.position.set(cxw, y, -0.5); g.add(bg); }
      g.add(sh.group, tb.group); blocks.push({ tb, sh, bg, w, cx: cxw, y }); x += w.wd + gap;
    }
  });
  g.userData = { blocks, size, height: total * size * lh };
  g.traverse((o) => { o.renderOrder = o.renderOrder || 0; });
  g.children.forEach((c) => { c.renderOrder = c.isMesh ? 1 : 3; });
  blocks.forEach((b) => { b.tb.group.traverse((o) => { o.renderOrder = 5; }); b.sh.group.traverse((o) => { o.renderOrder = 4; }); if (b.bg) b.bg.renderOrder = 3; });
  g.visible = false;
  return g;
}

// anima a legenda: entra palavra por palavra (sobe + aparece) e sai junto
export function sublineIn(tl, g, t, o = {}) {
  const st = o.stagger ?? 0.07, dur = o.dur ?? 0.42; const B = g.userData.blocks;
  tl.set(g, { visible: true }, t);
  B.forEach((b, i) => {
    const T = t + i * st; const p = { v: 0 };
    tl.fromTo(p, { v: 0 }, { v: 1, duration: dur, ease: 'expo.out', immediateRender: false, onUpdate: () => {
      const e = p.v, s = 0.86 + 0.14 * e; const dy = (1 - e) * -46;
      b.tb.setOpacity(e); b.sh.setOpacity(e * 0.55); b.tb.group.position.set(b.cx, b.y + dy, 0); b.sh.group.position.set(b.cx, b.y + dy - 4, -0.2); b.tb.group.scale.setScalar(s); b.sh.group.scale.setScalar(s);
      if (b.bg) { b.bg.userData.mat.uniforms.uOpacity.value = e; b.bg.position.y = b.y + dy; b.bg.scale.set(s, s, 1); } } }, T);
    tl.set(p, { v: 0 }, t - 0.001);
  });
}
export function sublineOut(tl, g, t, o = {}) {
  const dur = o.dur ?? 0.28; const B = g.userData.blocks; const p = { v: 0 };
  tl.fromTo(p, { v: 0 }, { v: 1, duration: dur, ease: 'power2.in', immediateRender: false, onUpdate: () => {
    const e = 1 - p.v, dy = p.v * 36; B.forEach((b) => { b.tb.setOpacity(e); b.sh.setOpacity(e * 0.55); b.tb.group.position.set(b.cx, b.y + dy, 0); b.sh.group.position.set(b.cx, b.y + dy - 4, -0.2); if (b.bg) { b.bg.userData.mat.uniforms.uOpacity.value = e; b.bg.position.y = b.y + dy; } }); } }, t);
  tl.set(g, { visible: false }, t + dur + 0.001);
}

// legenda completa (cria, anima, registra janela do scrim e eventos de áudio)
export function addSub(ctx, words, a, b, o = {}) {
  const g = subline(ctx.tf[o.font ?? 'mont'], words, { size: o.size ?? 58, maxW: o.maxW ?? 800 }); g.position.set(o.x ?? 0, o.y ?? -165, 0); ctx.hud.add(g);
  ctx.reg(g.userData.blocks.map((bl) => bl.tb.group), true); sublineIn(ctx.tl, g, a, { stagger: o.stagger ?? 0.07 }); sublineOut(ctx.tl, g, b - 0.3);
  (ctx.subWins ??= []).push([a, b]); return g;
}
