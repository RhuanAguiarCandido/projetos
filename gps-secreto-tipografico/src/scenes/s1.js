// CENA 1 (0–5 s) — Gancho: "SEU CACHORRO TEM GPS?!"
import * as THREE from 'three';
import { Lockup, enter, exit, glint, flash, ev, vis, fadeBlock } from '../kit/kinetic.js';
import { TextBlock } from '../kit/text.js';
import { addSub } from '../engine/hud.js';
import { interp, shockRing, wob } from './common.js';
import { Compass } from '../world/compass.js';
import { Space, makeField } from '../world/space.js';

export function build(ctx) {
  const { tl, tf, G, hud } = ctx;
  const park = G.park;
  // título em 3D, atrás do cão (profundidade real)
  const A = new Lockup(tf.anton, [{ text: 'SEU', width: 0.64, colorA: '#E6F0FF', colorB: '#FFFFFF' }, { text: 'CACHORRO', width: 1.5, colorA: '#E6F0FF', colorB: '#FFFFFF' }], { gap: 0.1, depth: 0.18, rim: '#00D9F5', emis: '#04101E' });
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

  // plano 1B (como na referência): o cão olha para o alto e acima da cabeça flutua o holograma — bússola em primeiro plano,
  // Terra translúcida atrás e arcos tracejados do campo magnético
  const comp1 = new Compass(tf.anton); const HG = new THREE.Group(); park.add(HG); HG.visible = false;
  const cp1 = comp1.group; HG.add(cp1); cp1.scale.setScalar(0.4); cp1.position.set(0, 2.0, 0.15); cp1.rotation.x = Math.PI / 2 + 0.25;
  const mini = new Space(ctx.land); mini.stars.visible = false; mini.dust.visible = false; mini.field.visible = false; mini.landMat.uniforms.uSize.value = 0.0135 * 0.46;
  mini.group.scale.setScalar(0.46); mini.group.position.set(0.22, 2.1, -0.5); mini.atm.material.uniforms.uInt.value = 1.1; HG.add(mini.group);
  const arcs = makeField([1.5, 2.0]); const arcG = new THREE.Group(); arcG.add(arcs.mesh); arcG.position.copy(mini.group.position); arcG.scale.setScalar(0.46); arcG.rotation.z = 0.35; arcs.mat.uniforms.uInt.value = 0.8; HG.add(arcG);
  ctx.reg(comp1.letters.flatMap((b) => b.glyphs));
  tl.set(HG, { visible: true }, 2.65); tl.set(HG, { visible: false }, 5.05); ev(2.75, 'pop', 1); ev(3.05, 'ding', 0.8);
  ctx.updaters.push((t) => {
    if (t < 2.6 || t >= 5.1) return; const k = Math.min(1, Math.max(0, (t - 2.7) / 0.7)); const e = 1 + 2.70158 * Math.pow(k - 1, 3) + 1.70158 * Math.pow(k - 1, 2);     // back.out
    comp1.setOpacity(Math.min(1, k * 2.2)); cp1.scale.setScalar(Math.max(0.0001, 0.4 * e)); cp1.position.y = 2.0 + Math.sin(t * 1.8) * 0.04;
    mini.group.scale.setScalar(Math.max(0.0001, 0.46 * e)); arcG.scale.setScalar(Math.max(0.0001, 0.46 * e)); arcs.mat.uniforms.uTime.value = t; arcs.mat.uniforms.uDraw.value = 1.25 * k;
    mini.update(t, ctx.H / (2 * Math.tan(ctx.camera.fov * Math.PI / 360))); mini.group.rotation.y = t * 0.35; mini.group.position.y = 2.12 + Math.sin(t * 1.5 + 1) * 0.05;
    const u = t - 3.0; comp1.update(t, u < 0 ? 0.6 : Math.sin(u * 8.5) * 1.3 * Math.exp(-u * 1.8));
  });
  addSub(ctx, [{ t: 'Ele' }, { t: 'sabe' }, { t: 'onde' }, { t: 'fica' }, { t: 'o' }, { t: 'Norte?', pill: true }], 3.0, 5.0); ev(3.0, 'tick', 1);

  // câmeras
  ctx.shot(0, 2.5, 'park', (u, t) => { const k = interp(u, [{ t: 0, p: [1.3, 0.55, 5.6], l: [0, 1.55, 0], fov: 40, roll: 3 }, { t: 2.5, p: [0.45, 0.7, 4.0], l: [0, 1.5, 0], fov: 36, roll: 0 }], 'out'); k.p[0] += wob(t, 0.6) * 0.04; return k; }, { aperture: 0.35, bloom: 0.5 }, { dog: true });
  ctx.shot(2.5, 5.0, 'park', (u, t) => interp(u, [{ t: 0, p: [-0.9, 0.55, 5.0], l: [0.05, 1.1, 0.2], fov: 42, roll: -4 }, { t: 2.5, p: [0.15, 0.7, 4.2], l: [0.05, 1.15, 0.2], fov: 40, roll: 0 }], 'out'), { aperture: 0.8, bloom: 0.5 }, { dog: true });
  ctx.transition(2.5, 0.36, 'whip', [1, 0]);
}
