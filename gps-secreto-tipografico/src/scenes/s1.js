// CENA 1 (0–5 s) — Gancho: "SEU CACHORRO TEM GPS?!"
import * as THREE from 'three';
import { Lockup, enter, exit, glint, flash, ev, vis, fadeBlock } from '../kit/kinetic.js';
import { TextBlock } from '../kit/text.js';
import { addSub } from '../engine/hud.js';
import { interp, shockRing, wob } from './common.js';

export function build(ctx) {
  const { tl, tf, G, hud } = ctx;
  const park = G.park;
  // título em 3D, atrás do cão (profundidade real)
  const A = new Lockup(tf.anton, [{ text: 'SEU', width: 0.64, colorA: '#BFD9FF', colorB: '#FFFFFF' }, { text: 'CACHORRO', width: 1.5, colorA: '#BFD9FF', colorB: '#FFFFFF' }], { gap: 0.1, depth: 0.18, rim: '#00D9F5', emis: '#04101E' });
  A.group.position.set(0, 2.85, -1.4); park.add(A.group);
  const B = new Lockup(tf.anton, [{ text: 'TEM GPS?!', width: 1.5, colorA: '#E8A200', colorB: '#FFE680', rim: '#FFF3B0', emis: '#2A1C00' }], { depth: 0.22 });
  B.group.position.set(0, 1.78, -1.1); park.add(B.group);
  ctx.reg(A.all); ctx.reg(B.all);
  vis(tl, A.group, 0, 2.6); vis(tl, B.group, 0, 2.6);

  enter(tl, A.blocks[0], 0.0, { style: 'slam', stagger: 0.05, dur: 0.55, dz: 2.2 }); ev(0.0, 'slam', 1);
  enter(tl, A.blocks[1], 0.5, { style: 'slam', stagger: 0.04, dur: 0.6, dz: 2.2 }); ev(0.5, 'slam', 1);
  glint(tl, A.blocks[1], 0.95, 0.8);
  enter(tl, B.blocks[0], 1.5, { style: 'drop', stagger: 0.045, dur: 0.7 }); ev(1.5, 'impact', 1.2); ev(1.5, 'riser_end', 1);
  flash(tl, B.blocks[0], 1.55, 0.7, 0.25); glint(tl, B.blocks[0], 1.8, 0.7); ctx.pulse(1.52, 1, 0.4);
  shockRing(ctx, park, 1.52, { pos: [0, 1.95, -0.9], color: '#F9D548', max: 4.2, dur: 0.8 });
  exit(tl, A.blocks[0], 2.3, { style: 'slide', dx: -3, stagger: 0.02, dur: 0.22 }); exit(tl, A.blocks[1], 2.3, { style: 'slide', dx: 3, stagger: 0.015, dur: 0.22, order: 'rtl' }); exit(tl, B.blocks[0], 2.35, { style: 'fall', stagger: 0.02, dur: 0.25 });
  ev(2.5, 'whip', 1);

  // plano 1B: bússola holográfica e "?" gigante
  const Q = new TextBlock(tf.anton, '?', { size: 1.5, depth: 0.2, colorA: '#E8A200', colorB: '#FFE680', rim: '#FFF3B0', emis: '#3A2A00' });
  Q.group.position.set(0.72, 1.72, 0.2); Q.group.scale.setScalar(0.8); park.add(Q.group); ctx.reg(Q.glyphs); vis(tl, Q.group, 2.7, 5.1);
  enter(tl, Q, 2.8, { style: 'spin', dur: 0.7, stagger: 0 }); ev(2.8, 'pop', 1); glint(tl, Q, 3.5, 0.7);
  ctx.updaters.push((t) => { if (t >= 2.7 && t < 5.1) { Q.group.rotation.y = Math.sin(t * 1.7) * 0.5; Q.group.position.y = 1.9 + Math.sin(t * 2.2) * 0.05; } });
  addSub(ctx, [{ t: 'Ele' }, { t: 'sabe' }, { t: 'onde' }, { t: 'fica' }, { t: 'o' }, { t: 'Norte?', pill: true }], 3.0, 5.0); ev(3.0, 'tick', 1);

  // câmeras
  ctx.shot(0, 2.5, 'park', (u, t) => { const k = interp(u, [{ t: 0, p: [1.3, 0.55, 5.6], l: [0, 1.55, 0], fov: 40, roll: 3 }, { t: 2.5, p: [0.45, 0.7, 4.0], l: [0, 1.5, 0], fov: 36, roll: 0 }], 'out'); k.p[0] += wob(t, 0.6) * 0.04; return k; }, { aperture: 0.7, bloom: 0.5 }, { dog: true });
  ctx.shot(2.5, 5.0, 'park', (u, t) => interp(u, [{ t: 0, p: [-1.5, 0.95, 4.2], l: [0.1, 1.05, 0.4], fov: 36, roll: -4 }, { t: 2.5, p: [-0.8, 1.1, 3.4], l: [0.1, 1.05, 0.4], fov: 32, roll: 0 }], 'out'), { aperture: 0.9, bloom: 0.5 }, { dog: true });
  ctx.transition(2.5, 0.36, 'whip', [1, 0]);
}
