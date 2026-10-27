// CENA 5 (32–39 s) — Reviravolta: glitch, congela no meio da volta, "AINDA É UM MISTÉRIO!"
import * as THREE from 'three';
import { Lockup, enter, exit, glint, flash, ev, vis, fadeBlock } from '../kit/kinetic.js';
import { TextBlock } from '../kit/text.js';
import { addSub } from '../engine/hud.js';
import { interp, shockRing, wob, dogRel } from './common.js';
import { theta } from './dogdir.js';
import { TAU, smooth, hash1 } from '../kit/util.js';

export function build(ctx) {
  const { tl, tf, G, hud, dog, compass } = ctx; const PK = G.park;
  ctx.freeze = [32.0, 35.0];
  // glitch no corte
  ctx.glitch(32.0, 32.55, 1.0); ctx.glitch(33.55, 33.75, 0.7); ctx.glitch(34.45, 34.62, 0.8);
  // título 3D
  const L = new Lockup(tf.anton, [
    { text: 'AINDA É UM', width: 1.5, colorA: '#E6F0FF', colorB: '#FFFFFF' },
    { text: 'MISTÉRIO!', width: 1.6, colorA: '#E8A200', colorB: '#FFE680', rim: '#FFF3B0', emis: '#2A1C00' }], { gap: 0.1, depth: 0.2, rim: '#00D9F5', emis: '#04101E' });
  L.group.position.set(-0.28, 2.55, -1.2); PK.add(L.group); ctx.reg(L.all); vis(tl, L.group, 32.0, 35.05);
  enter(tl, L.blocks[0], 32.2, { style: 'slam', stagger: 0.04, dur: 0.5, dz: 2.0, order: 'rand', seed: 3 }); ev(32.0, 'glitch', 1); ev(32.2, 'slam', 1);
  enter(tl, L.blocks[1], 32.85, { style: 'drop', stagger: 0.05, dur: 0.7 }); ev(32.85, 'impact', 1.2); flash(tl, L.blocks[1], 32.9, 0.7, 0.25); ctx.pulse(32.88, 1, 0.4);
  glint(tl, L.blocks[1], 33.6, 0.8); ev(33.55, 'glitch', 0.7); ev(34.45, 'glitch', 0.8);
  shockRing(ctx, PK, 32.88, { pos: [0, 2.0, -1.0], color: '#F9D548', max: 4.5, dur: 0.8 });
  exit(tl, L.blocks[0], 34.7, { style: 'spin', stagger: 0.02, dur: 0.25 }); exit(tl, L.blocks[1], 34.72, { style: 'spin', stagger: 0.02, dur: 0.25 }); ev(35.0, 'whip', 1);
  ctx.updaters.push((t) => {      // tremor de glitch nas linhas
    if (t < 32 || t >= 35) return; const g = ctx.glitchAt(t); L.blocks.forEach((b, i) => { b.group.position.x = (hash1(Math.floor(t * 30) + i) - 0.5) * 0.12 * g; b.group.rotation.z = (hash1(Math.floor(t * 30) + i * 3) - 0.5) * 0.04 * g; });
  });
  // pontos de interrogação orbitando o cão congelado / confuso
  const Qs = []; for (let i = 0; i < 5; i++) { const b = new TextBlock(tf.anton, '?', { size: 0.5, depth: 0.1, colorA: '#CFE4FF', colorB: '#FFFFFF', rim: '#00D9F5', emis: '#04101E' }); PK.add(b.group); Qs.push(b); vis(tl, b.group, 33.2 + i * 0.12, 39.0); ctx.reg(b.glyphs); enter(tl, b, 33.25 + i * 0.12, { style: 'pop', dur: 0.5, stagger: 0 }); }
  ev(33.25, 'pop', 0.8); ev(33.5, 'pop', 0.7); ev(33.75, 'pop', 0.6);
  ctx.updaters.push((t) => { if (t < 33.2 || t >= 39) return; const hp = new THREE.Vector3(); dog.head.getWorldPosition(hp); Qs.forEach((b, i) => { const a = t * 1.3 + i * TAU / 5, r = 0.95 + 0.12 * Math.sin(t * 2 + i); b.group.position.set(hp.x + Math.cos(a) * r, hp.y + 0.35 + Math.sin(t * 1.7 + i * 2) * 0.25 + (i % 2) * 0.3, hp.z - Math.abs(Math.sin(a)) * r * 0.9 - 0.15); b.group.rotation.y = Math.cos(a) * 0.5; }); });
  // bússola enlouquecida
  const prevNeedle = ctx.needleYaw; ctx.needleYaw = (t) => (t >= 35 ? Math.sin(t * 11) * 2.0 + Math.sin(t * 4.3) * 1.2 + Math.sin(t * 23) * 0.3 : prevNeedle(t));
  ctx.updaters.push((t) => { if (t < 35 || t >= 39.05) return; const cp = compass.group; cp.visible = t < 39; cp.position.set(-1.3, 1.5 + Math.sin(t * 1.6) * 0.05, 0.8); cp.scale.setScalar(0.5); compass.setOpacity(smooth((t - 35.1) / 0.4)); cp.rotation.x = Math.PI / 2 - 0.15; });
  addSub(ctx, [{ t: 'Nem' }, { t: 'sempre' }, { t: 'acontece.', pill: true }], 35.1, 36.55, { stagger: 0.09 });
  addSub(ctx, [{ t: 'Ninguém' }, { t: 'provou' }, { t: 'que' }, { t: 'seja' }, { t: 'magnético', c: '#F9D548' }], 36.65, 39.0, { stagger: 0.08 });

  // câmeras
  ctx.shot(32.0, 35.0, 'park', (u) => interp(u, [{ t: 0, p: [1.9, 0.8, 6.2], l: [-0.3, 1.5, 0], fov: 40, roll: 9 }, { t: 3, p: [0.6, 0.95, 4.7], l: [-0.3, 1.4, 0], fov: 34, roll: 0 }], 'out'), { aperture: 0.6, bloom: 0.5, ca: 0.002 }, { dog: true });
  ctx.shot(35.0, 37.0, 'park', (u) => interp(u, [{ t: 0, p: [-2.4, 0.7, 4.4], l: [0, 0.9, 0], fov: 36, roll: -5 }, { t: 2, p: [-1.4, 0.9, 3.4], l: [0.1, 0.95, 0], fov: 32, roll: 0 }], 'out'), { aperture: 0.8, bloom: 0.45 }, { dog: true });
  ctx.shot(37.0, 39.0, 'park', (u) => interp(u, [{ t: 0, p: [1.1, 1.0, 4.0], l: [0, 1.0, 0.2], fov: 33, roll: 3 }, { t: 2, p: [0.45, 1.1, 3.1], l: [0, 1.0, 0.2], fov: 30, roll: -2 }], 'inOut'), { aperture: 0.9, bloom: 0.45 }, { dog: true });
  ctx.transition(32.0, 0.4, 'glitch'); ctx.transition(35.0, 0.3, 'whip', [-1, 0]); ctx.transition(37.0, 0.28, 'zoom');
  ev(37.0, 'zoomhit', 0.7);
}
