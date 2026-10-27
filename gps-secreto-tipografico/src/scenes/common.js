// Contexto compartilhado das cenas: ativos, grupos de mundo, registro de planos/transições/pulsos e utilitários de câmera.
import * as THREE from 'three';
import gsap from 'gsap';
import { clamp, lerp, smooth, hash1 } from '../kit/util.js';
import { glowMaterial } from '../world/glow.js';

export const FPS = 30, DUR = 45;
const E = {
  lin: (x) => x, in: (x) => x * x * x, out: (x) => 1 - (1 - x) ** 3, inOut: (x) => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2),
  expoOut: (x) => (x >= 1 ? 1 : 1 - 2 ** (-10 * x)), expoInOut: (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x < 0.5 ? 2 ** (20 * x - 10) / 2 : (2 - 2 ** (-20 * x + 10)) / 2),
  backOut: (x) => { const c = 1.70158; return 1 + (c + 1) * (x - 1) ** 3 + c * (x - 1) ** 2; },
};
export const ease = (name, x) => E[name](clamp(x));

// interpola chaves de câmera { t, p:[x,y,z], l:[x,y,z], fov, roll } com easing por segmento
export function interp(u, keys, easing = 'inOut') {
  if (u <= keys[0].t) return { ...keys[0] };
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i], b = keys[i + 1];
    if (u <= b.t) {
      const x = ease(b.ease ?? easing, (u - a.t) / (b.t - a.t)); const L = (p, q) => p.map((v, k) => lerp(v, q[k], x));
      return { p: L(a.p, b.p), l: L(a.l, b.l), fov: lerp(a.fov ?? 36, b.fov ?? 36, x), roll: lerp(a.roll ?? 0, b.roll ?? 0, x) };
    }
  }
  return { ...keys[keys.length - 1] };
}
// ruído suave determinístico (mão-livre)
export const wob = (t, f = 1, s = 0) => Math.sin(t * 1.3 * f + s) * 0.5 + Math.sin(t * 2.9 * f + s * 1.7 + 1.3) * 0.3 + Math.sin(t * 5.3 * f + s * 2.3 + 2.1) * 0.2;
export const orbit = (c, r, h, ang) => [c[0] + Math.sin(ang) * r, h, c[2] + Math.cos(ang) * r];
export const beatPulse = (t, t0, d = 0.35) => { const x = (t - t0) / d; return x < 0 || x > 1 ? 0 : (1 - x) ** 2; };

export class Ctx {
  constructor() { this.shots = []; this.trans = []; this.pulses = []; this.glitches = []; this.probes = []; this.blocks = []; this.huds = []; }
  shot(a, b, scene, cam, fx = {}, extra = {}) { const o = { a, b, scene, cam, fx, ...extra }; this.shots.push(o); return o; }
  reg(items, hud = false) { const a = items.slice(); a.hud = hud; this.blocks.push(a); }
  transition(t, dur, type, dir = [1, 0]) { this.trans.push({ t, dur, type, dir }); }   // type: whip, zoom, glitch, flash, wipe
  pulse(t, amp = 1, dur = 0.35) { this.pulses.push({ t, amp, dur }); }
  glitch(a, b, amt = 1) { this.glitches.push({ a, b, amt }); }
  at(t) { return this.shots.find((s) => t >= s.a && t < s.b) ?? this.shots[this.shots.length - 1]; }
  pulseAt(t) { let v = 0; for (const p of this.pulses) v = Math.max(v, p.amp * beatPulse(t, p.t, p.dur)); return v; }
  transAt(t) {
    for (const tr of this.trans) { const h = tr.dur / 2, x = (t - tr.t) / h; if (Math.abs(x) <= 1) return { type: tr.type, amt: tr.type === 'wipe' ? x : 1 - Math.abs(x), dir: tr.dir, tr }; }
    return null;
  }
  glitchAt(t) { let v = 0; for (const g of this.glitches) if (t >= g.a && t < g.b) v = Math.max(v, g.amt * (0.55 + 0.45 * hash1(Math.floor(t * 15)))); return v; }
}

// anel de choque (billboard, aditivo) que expande e some
export function shockRing(ctx, parent, t, { pos = [0, 0, 0], color = '#F9D548', max = 3, dur = 0.7, width = 0.06, intensity = 2.2 } = {}) {
  const m = glowMaterial({ color, intensity, opacity: 0 }); const g = new THREE.Mesh(new THREE.RingGeometry(1 - width, 1, 96), m); g.position.set(...pos); g.visible = false; parent.add(g); ctx.billboards.push(g);
  const p = { v: 0 };
  ctx.tl.set(g, { visible: true }, t);
  ctx.tl.fromTo(p, { v: 0 }, { v: 1, duration: dur, ease: 'expo.out', immediateRender: false, onUpdate: () => { g.scale.setScalar(0.05 + p.v * max); m.uniforms.uOpacity.value = (1 - p.v) ** 1.5; } }, t);
  ctx.tl.set(g, { visible: false }, t + dur + 0.01);
  return g;
}

// câmera relativa ao cão (frente/lado/altura no referencial do corpo)
export function dogRel(ctx, fwd, side, up, lookUp = 0.8, lookFwd = 0) {
  const r = ctx.dog.root, y = r.rotation.y, f = [Math.sin(y), Math.cos(y)], rt = [Math.cos(y), -Math.sin(y)], d = r.position;
  return { p: [d.x + f[0] * fwd + rt[0] * side, up, d.z + f[1] * fwd + rt[1] * side], l: [d.x + f[0] * lookFwd, lookUp, d.z + f[1] * lookFwd] };
}
