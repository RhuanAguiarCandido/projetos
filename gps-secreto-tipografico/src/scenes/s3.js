// CENA 3 (12–21 s) — Terra como ímã: "CAMPO MAGNÉTICO DA TERRA"
import * as THREE from 'three';
import { Lockup, enter, exit, glint, flash, ev, vis, fadeBlock } from '../kit/kinetic.js';
import { TextBlock } from '../kit/text.js';
import { addSub } from '../engine/hud.js';
import { interp, shockRing, wob, orbit } from './common.js';
import { makeField } from '../world/space.js';
import { TAU, smooth } from '../kit/util.js';

export function build(ctx) {
  const { tl, tf, G, hud, space, compass } = ctx; const SP = G.space;
  // título 3D sobre a Terra
  const L = new Lockup(tf.anton, [
    { text: 'CAMPO', width: 1.0, colorA: '#00B5D6', colorB: '#8CF6FF', rim: '#C8FBFF', emis: '#00323F' },
    { text: 'MAGNÉTICO', width: 1.7, colorA: '#BFD9FF', colorB: '#FFFFFF' },
    { text: 'DA TERRA', width: 1.35, colorA: '#E8A200', colorB: '#FFE680', rim: '#FFF3B0', emis: '#2A1C00' }], { gap: 0.07, depth: 0.14, rim: '#00D9F5', emis: '#04101E' });
  L.group.position.set(0, 1.62, 0.9); SP.add(L.group); ctx.reg(L.all); vis(tl, L.group, 12.0, 14.55);
  space.fieldMat.uniforms.uDraw.value = 0;
  ctx.updaters.push((t) => { if (t >= 12 && t < 17.2) space.fieldMat.uniforms.uDraw.value = smooth((t - 12.0) / 2.4) * 1.25; });
  enter(tl, L.blocks[0], 12.15, { style: 'spin', stagger: 0.06, dur: 0.6 }); ev(12.15, 'slam', 1);
  enter(tl, L.blocks[1], 12.65, { style: 'spin', stagger: 0.04, dur: 0.6 }); ev(12.65, 'slam', 1);
  enter(tl, L.blocks[2], 13.15, { style: 'rise', stagger: 0.05, dur: 0.6 }); ev(13.15, 'impact', 1); flash(tl, L.blocks[2], 13.2, 0.6, 0.25); ctx.pulse(13.17, 0.8, 0.4);
  glint(tl, L.blocks[1], 13.4, 0.7);
  exit(tl, L.blocks[0], 14.25, { style: 'fall', stagger: 0.02 }); exit(tl, L.blocks[1], 14.28, { style: 'fall', stagger: 0.015 }); exit(tl, L.blocks[2], 14.31, { style: 'fall', stagger: 0.02 });
  shockRing(ctx, SP, 13.17, { pos: [0, 0, 0.5], color: '#00D9F5', max: 6, dur: 1.0 });

  // 3B — polos N e S (letras 3D) + legenda
  const mkPole = (ch, c1, c2, y) => { const b = new TextBlock(tf.anton, ch, { size: 0.5, depth: 0.1, colorA: c1, colorB: c2, rim: '#FFFFFF', emis: '#1A1400' }); b.group.position.set(0, y, 0); SP.add(b.group); ctx.reg(b.glyphs); ctx.billboards.push(b.group); vis(tl, b.group, 14.6, 17.1); return b; };
  const pN = mkPole('N', '#E8A200', '#FFE680', 1.55), pS = mkPole('S', '#00B5D6', '#8CF6FF', -1.55);
  enter(tl, pN, 14.7, { style: 'pop', dur: 0.5, stagger: 0 }); enter(tl, pS, 14.85, { style: 'pop', dur: 0.5, stagger: 0 }); ev(14.7, 'pop', 1); ev(14.85, 'pop', 0.9);
  addSub(ctx, [{ t: 'A' }, { t: 'Terra' }, { t: 'é' }, { t: 'um' }, { t: 'ímã gigante', pill: true }], 14.8, 17.0, { stagger: 0.08 });

  // 3C/3D — parque: o cão no centro das linhas do campo + bússola flutuante
  const PK = G.park; const cage = makeField([1.55, 2.0, 2.6]); const cg = new THREE.Group(); cg.add(cage.mesh); cage.mesh.rotation.x = -Math.PI / 2; cg.position.set(0, 0.8, 0); cg.scale.setScalar(1.8); PK.add(cg); cg.visible = false;
  ctx.updaters.push((t) => { cg.visible = t >= 17 && t < 21; if (cg.visible) { cage.mat.uniforms.uTime.value = t; cage.mat.uniforms.uDraw.value = smooth((t - 17.0) / 1.2) * 1.25; cage.mat.uniforms.uOpacity.value = 0.8 * smooth((21 - t) / 0.3); cage.mat.uniforms.uInt.value = 0.55; } });
  const cp = compass.group; PK.add(cp); cp.scale.setScalar(0.55); cp.position.set(0.6, 1.8, 0.3); cp.rotation.x = Math.PI / 2 - 0.15; cp.visible = false;
  compass.root.userData.t0 = 17.4; ctx.reg(compass.letters.flatMap((b) => b.glyphs));
  ctx.updaters.push((t) => { cp.visible = t >= 17.3 && t < 21; compass.setOpacity(smooth((t - 17.3) / 0.4) * smooth((21 - t) / 0.3)); const s = 0.55 * (0.6 + 0.4 * (1 - Math.pow(1 - Math.min(1, (t - 17.3) / 0.6), 3))); cp.scale.setScalar(s); cp.position.set(0.6, 1.8 + Math.sin(t * 1.6) * 0.04, 0.3); });
  ctx.needleYaw = (t) => { const u = t - 17.6; if (u < 0) return 0.5; const damp = Math.exp(-u * 2.2); return Math.sin(u * 9) * 1.5 * damp; };
  ev(17.3, 'pop', 1); ev(18.0, 'ding', 1);
  addSub(ctx, [{ t: 'Bússolas' }, { t: 'usam' }, { t: 'esse campo' }, { t: 'para' }, { t: 'achar' }, { t: 'o Norte', pill: true }], 17.7, 21.0, { stagger: 0.09 });

  // câmeras
  ctx.shot(12.0, 14.5, 'space', (u, t) => interp(u, [{ t: 0, p: [2.2, 0.9, 13], l: [0, 0.35, 0], fov: 32, roll: -8 }, { t: 2.5, p: [0.5, 0.5, 7.4], l: [0, 0.4, 0], fov: 32, roll: 0 }], 'out'), { focus: 7.5, aperture: 0.15, bloom: 0.55 });
  ctx.shot(14.5, 17.0, 'space', (u, t) => { const a = interp(u, [{ t: 0, p: [1.6, -3.2, 8.6], l: [0, 0.1, 0], fov: 32, roll: 5 }, { t: 1.9, p: [0.8, 2.8, 8.8], l: [0, 0.1, 0], fov: 30, roll: 0 }, { t: 2.5, p: [0.5, 0.4, 3.2], l: [0, 0.15, 0], fov: 38, roll: -4, ease: 'in' }], 'inOut'); return a; }, { focus: 6, aperture: 0.15, bloom: 0.55 });
  ctx.shot(17.0, 19.5, 'park', (u, t) => interp(u, [{ t: 0, p: [3.2, 0.8, 7.0], l: [0.3, 0.95, 0], fov: 38, roll: 3 }, { t: 2.5, p: [1.2, 1.0, 5.8], l: [0.35, 1.0, 0.2], fov: 36, roll: -1 }], 'out'), { aperture: 0.7, bloom: 0.45 }, { dog: true });
  ctx.shot(19.5, 21.0, 'park', (u, t) => interp(u, [{ t: 0, p: [-0.3, 1.0, 5.0], l: [0.4, 1.0, 0.3], fov: 36, roll: -3 }, { t: 1.5, p: [0.2, 1.05, 4.5], l: [0.4, 1.05, 0.3], fov: 33, roll: 2 }], 'out'), { aperture: 0.9, bloom: 0.45 }, { dog: true });
  ctx.transition(14.5, 0.34, 'whip', [-1, 0]); ctx.transition(17.0, 0.4, 'zoom'); ctx.transition(19.5, 0.3, 'whip', [0, -1]);
  ev(14.5, 'whip', 1); ev(17.0, 'dive', 1); ev(19.5, 'whip', 0.8);
}
