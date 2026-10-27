// Tipografia cinética: entradas/saídas por letra (GSAP, determinístico), lockups empilhados, registro de eventos de áudio.
import gsap from 'gsap';
import * as THREE from 'three';
import { TextBlock } from './text.js';
import { hash1 } from './util.js';

export const EV = [];
export const ev = (t, type, v = 1, extra = {}) => { EV.push({ t: +t.toFixed(4), type, v, ...extra }); };

export const fitSize = (tf, text, width, tracking = 0) => width / tf.layout(text, tracking).width;

export function vis(tl, obj, t0, t1) { obj.visible = false; tl.set(obj, { visible: true }, t0); if (t1 != null) tl.set(obj, { visible: false }, t1); }

// empilha linhas, cada uma ajustada à própria largura (lockup tipográfico)
export class Lockup {
  constructor(tf, lines, o = {}) {
    this.group = new THREE.Group(); this.blocks = []; const gap = o.gap ?? 0.12; let y = 0; const items = [];
    for (const L of lines) {
      const size = L.size ?? fitSize(tf, L.text, L.width, L.tracking ?? 0);
      const b = new TextBlock(tf, L.text, { size, depth: L.depth ?? o.depth ?? 0.14, bevel: o.bevel ?? 0.012, colorA: L.colorA ?? o.colorA ?? '#FFFFFF', colorB: L.colorB ?? L.colorA ?? o.colorB ?? o.colorA ?? '#FFFFFF', emis: L.emis ?? o.emis ?? '#000000', rim: L.rim ?? o.rim ?? '#00D9F5', amb: L.amb ?? o.amb ?? 0.6, spec: L.spec ?? o.spec ?? 0.25, tracking: L.tracking ?? 0 });
      items.push({ b, h: b.height }); this.blocks.push(b);
    }
    const total = items.reduce((a, i) => a + i.h, 0) + gap * (items.length - 1); let cy = total / 2;
    items.forEach((it) => { it.b.group.position.y = cy - it.h / 2; cy -= it.h + gap; this.group.add(it.b.group); });
    this.height = total; this.width = Math.max(...items.map((i) => i.b.width));
    this.all = this.blocks.flatMap((b) => b.glyphs);
  }
  setOpacity(v) { this.blocks.forEach((b) => b.setOpacity(v)); }
  setFlash(v) { this.blocks.forEach((b) => b.setFlash(v)); }
  setShine(v, a = 1) { this.blocks.forEach((b) => b.setShine(v, a)); }
}

const rnd = (i, k) => hash1(i * 7.13 + k * 3.7) - 0.5;

// entra uma TextBlock letra a letra. estilos: slam, rise, drop, spin, pop, zoom
export function enter(tl, block, t, o = {}) {
  const st = o.style ?? 'slam', stag = o.stagger ?? 0.04, dur = o.dur ?? 0.5, order = o.order ?? 'ltr', dz = o.dz ?? 1.4, sz = block.size;
  const gs = block.glyphs, n = gs.length; let last = t;
  gs.forEach((g, i) => {
    const k = order === 'rtl' ? n - 1 - i : order === 'center' ? Math.abs(i - (n - 1) / 2) * 2 : order === 'rand' ? Math.floor(hash1(i + (o.seed ?? 0)) * n) : i;
    const T = t + k * stag, m = g.mesh; last = Math.max(last, T + dur); m.visible = false;
    tl.set(m, { visible: true }, T);
    const sc = (a) => ({ x: sz * a, y: sz * a, z: sz * a });
    const done = { x: sz, y: sz, z: sz, duration: dur, ease: o.ease ?? 'expo.out', immediateRender: false };
    if (st === 'slam') {
      tl.fromTo(m.position, { z: dz, x: g.cx + rnd(i, 1) * 0.1 * sz, y: rnd(i, 2) * 0.3 * sz }, { z: 0, x: g.cx, y: 0, duration: dur, ease: 'expo.out', immediateRender: false }, T);
      tl.fromTo(m.scale, sc(2.4), done, T); tl.fromTo(m.rotation, { x: rnd(i, 3) * 2.2, y: rnd(i, 4) * 1.6, z: rnd(i, 5) * 0.8 }, { x: 0, y: 0, z: 0, duration: dur * 1.2, ease: 'expo.out', immediateRender: false }, T);
    } else if (st === 'rise') {
      tl.fromTo(m.position, { y: -sz * 0.9, z: -0.2 }, { y: 0, z: 0, duration: dur, ease: o.ease ?? 'back.out(1.5)', immediateRender: false }, T);
      tl.fromTo(m.rotation, { x: -1.9 }, { x: 0, duration: dur, ease: 'expo.out', immediateRender: false }, T); tl.fromTo(m.scale, sc(0.5), { ...done, ease: 'back.out(1.8)' }, T);
    } else if (st === 'drop') {
      tl.fromTo(m.position, { y: sz * 3.2 }, { y: 0, duration: dur, ease: 'bounce.out', immediateRender: false }, T); tl.fromTo(m.scale, sc(1), { ...done, duration: 0.01 }, T); tl.fromTo(m.rotation, { z: rnd(i, 6) * 1.5 }, { z: 0, duration: dur, ease: 'back.out(2)', immediateRender: false }, T);
    } else if (st === 'spin') {
      tl.fromTo(m.rotation, { y: Math.PI * 1.5 }, { y: 0, duration: dur, ease: 'back.out(1.4)', immediateRender: false }, T); tl.fromTo(m.scale, sc(0.01), { ...done, ease: 'back.out(1.6)' }, T);
    } else if (st === 'zoom') {
      tl.fromTo(m.scale, sc(0.01), { ...done, ease: 'expo.out' }, T); tl.fromTo(m.position, { z: -dz }, { z: 0, duration: dur, ease: 'expo.out', immediateRender: false }, T);
    } else {          // pop
      tl.fromTo(m.scale, sc(0.01), { ...done, ease: 'back.out(2.4)' }, T);
    }
  });
  return last;
}

// sai letra a letra. estilos: shrink, fall, slide, spin
export function exit(tl, block, t, o = {}) {
  const st = o.style ?? 'shrink', stag = o.stagger ?? 0.025, dur = o.dur ?? 0.3, order = o.order ?? 'ltr', sz = block.size; const gs = block.glyphs, n = gs.length; let last = t;
  gs.forEach((g, i) => {
    const k = order === 'rtl' ? n - 1 - i : order === 'center' ? Math.abs(i - (n - 1) / 2) * 2 : i; const T = t + k * stag, m = g.mesh; last = Math.max(last, T + dur);
    if (st === 'fall') { tl.to(m.position, { y: -sz * 3, duration: dur, ease: 'power2.in' }, T); tl.to(m.rotation, { z: rnd(i, 7) * 2, x: rnd(i, 8) * 2, duration: dur, ease: 'power2.in' }, T); }
    else if (st === 'slide') tl.to(m.position, { x: g.cx + (o.dx ?? 3), duration: dur, ease: 'power3.in' }, T);
    else if (st === 'spin') tl.to(m.rotation, { y: Math.PI, duration: dur, ease: 'power2.in' }, T);
    tl.to(m.scale, { x: 0.0001, y: 0.0001, z: 0.0001, duration: dur, ease: 'power3.in' }, T);
    tl.set(m, { visible: false }, T + dur);
  });
  tl.set(block.group, { visible: false }, last + 0.001);
  return last;
}

// brilho varrendo o bloco + flash curto
export function glint(tl, block, t, dur = 0.7) {
  const w = block.width / block.size * 0.45 + 0.7; const p = { v: -w };
  tl.fromTo(p, { v: -w }, { v: w, duration: dur, ease: 'power1.inOut', immediateRender: false, onUpdate: () => block.sweep(p.v) }, t);
  tl.set(p, { v: -9 }, t + dur + 0.01); tl.call(() => block.sweep(-9), null, t + dur + 0.011);
}
export function flash(tl, block, t, amt = 0.8, dur = 0.22) {
  const p = { v: amt }; tl.fromTo(p, { v: amt }, { v: 0, duration: dur, ease: 'power2.out', immediateRender: false, onUpdate: () => block.setFlash(p.v) }, t);
}
export function fadeBlock(tl, block, t, from, to, dur = 0.25, ease = 'power2.out') {
  const p = { v: from }; tl.fromTo(p, { v: from }, { v: to, duration: dur, ease, immediateRender: false, onUpdate: () => block.setOpacity(p.v) }, t);
}
