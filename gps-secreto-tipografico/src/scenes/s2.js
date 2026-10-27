// CENA 2 (5–12 s) — Mistério: "POR QUE TANTAS VOLTAS?"
import * as THREE from 'three';
import { Lockup, enter, exit, glint, flash, ev, vis } from '../kit/kinetic.js';
import { TextBlock } from '../kit/text.js';
import { addSub } from '../engine/hud.js';
import { interp, shockRing, wob, orbit, dogRel } from './common.js';
import { theta, omegaAt } from './dogdir.js';
import { glowMaterial } from '../world/glow.js';
import { TAU, smooth } from '../kit/util.js';

export function build(ctx) {
  const { tl, tf, G, hud, dog, park } = ctx; const P = G.park;
  // 2A — título atrás do cão que gira
  const L = new Lockup(tf.anton, [
    { text: 'POR QUE', width: 1.25, colorA: '#E6F0FF', colorB: '#FFFFFF' },
    { text: 'TANTAS', width: 1.62, colorA: '#E8A200', colorB: '#FFE680', rim: '#FFF3B0', emis: '#2A1C00' },
    { text: 'VOLTAS?', width: 1.7, colorA: '#CFE4FF', colorB: '#FFFFFF', rim: '#00D9F5', emis: '#04101E' }], { gap: 0.09, depth: 0.18, rim: '#00D9F5', emis: '#04101E' });
  L.group.position.set(0, 2.75, -2.0); P.add(L.group); ctx.reg(L.all); vis(tl, L.group, 5.0, 7.55);
  enter(tl, L.blocks[0], 5.0, { style: 'rise', stagger: 0.045, dur: 0.6 }); ev(5.0, 'slam', 1);
  enter(tl, L.blocks[1], 5.5, { style: 'rise', stagger: 0.05, dur: 0.6 }); ev(5.5, 'slam', 1);
  enter(tl, L.blocks[2], 6.0, { style: 'drop', stagger: 0.05, dur: 0.7 }); ev(6.0, 'impact', 1); flash(tl, L.blocks[2], 6.05, 0.6, 0.25); ctx.pulse(6.02, 0.9, 0.4);
  glint(tl, L.blocks[1], 6.4, 0.7);
  exit(tl, L.blocks[0], 7.3, { style: 'shrink', stagger: 0.02 }); exit(tl, L.blocks[1], 7.33, { style: 'shrink', stagger: 0.02 }); exit(tl, L.blocks[2], 7.36, { style: 'shrink', stagger: 0.02 });

  // 2B — texto em anel no chão, visto de cima
  const R = 1.5, txt = 'TANTAS VOLTAS?  ·  TANTAS VOLTAS?  ·  ', lay = tf.anton.layout(txt, 0.02); const size = (TAU * R) / lay.width;
  const ring = new TextBlock(tf.anton, txt, { size, depth: 0.05, bevel: 0.006, tracking: 0.02, colorA: '#E8A200', colorB: '#FFE680', emis: '#2A1C00', rim: '#FFF3B0', amb: 0.9 });
  const rg = new THREE.Group(); rg.add(ring.group); P.add(rg); ring.group.position.y = 0.03;
  ring.glyphs.forEach((g, i) => { const phi = g.cx / R - (lay.width * size) / (2 * R) * 0; const m = g.mesh; ring.lines[0].group.position.y = 0; m.position.set(Math.sin(phi) * R, 0, -Math.cos(phi) * R); m.rotation.order = 'YXZ'; m.rotation.set(-Math.PI / 2, -phi, 0); });
  ctx.reg(ring.glyphs); vis(tl, rg, 7.5, 10.05);
  enter(tl, ring, 7.55, { style: 'pop', stagger: 0.025, dur: 0.45 }); ev(7.55, 'whoosh', 1);
  ctx.updaters.push((t) => { if (t >= 7.5 && t < 10.05) rg.rotation.y = -(t - 7.5) * 0.55 + 0.0; });
  // trilha luminosa atrás do cão
  const trailMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, uniforms: { uArc: { value: 1.6 }, uOp: { value: 0 } },
    vertexShader: `varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `precision highp float; varying vec3 vP; uniform float uArc, uOp; void main(){ float a = atan(vP.y, vP.x); float k = clamp(1.0 + a / uArc, 0.0, 1.0); vec3 c = mix(vec3(0.0, 0.65, 1.0), vec3(0.8, 1.0, 1.0), k * k); gl_FragColor = vec4(c * 2.0, k * k * uOp); }` });
  const trail = new THREE.Mesh(new THREE.RingGeometry(0.8 - 0.055, 0.8 + 0.055, 64, 1, -1.6, 1.6), trailMat); trail.rotation.x = -Math.PI / 2; trail.position.y = 0.04; const tg = new THREE.Group(); tg.add(trail); P.add(tg);
  ctx.updaters.push((t) => { tg.visible = t >= 5.4 && t < 11.0; if (tg.visible) { tg.rotation.y = theta(t) - Math.PI / 2; trailMat.uniforms.uOp.value = smooth((t - 5.4) / 0.4) * smooth((10.6 - t) / 0.8) * Math.min(1, Math.abs(omegaAt(t)) / 3); } });
  ctx.updaters.push((t) => { park.ground.material.uniforms.uWorn.value = smooth((t - 6.2) / 2.5); });
  // contador de voltas (HUD)
  const label = new TextBlock(tf.mont, 'VOLTAS', { size: 44, depth: 0, colorA: '#FFFFFF', flat: 1, blend: true, tracking: 0.12 }); label.group.position.set(-290, 585, 0); hud.add(label.group, 6); vis(tl, label.group, 7.6, 10.0); ctx.reg(label.glyphs.map((g) => g.mesh), true);
  const digs = [1, 2, 3, 4, 5].map((n) => { const b = new TextBlock(tf.anton, String(n), { size: 200, depth: 0, colorA: '#F9D548', colorB: '#FFF3B0', flat: 1, blend: true }); b.group.position.set(-290, 470, 0); hud.add(b.group, 6); b.group.visible = false; ctx.reg(b.glyphs.map((g) => g.mesh), true); return b; });
  const cross = []; for (let tt = 5.0; tt < 12; tt += 1 / 120) { const a = Math.floor(theta(tt + 1 / 120) / TAU), b = Math.floor(theta(tt) / TAU); if (a > b) cross.push([tt, a]); }
  cross.forEach(([tt, n]) => { ev(tt, 'spin', Math.min(1, 0.6 + n * 0.1)); });
  ctx.updaters.push((t) => {
    const on = t >= 7.6 && t < 10.0; const n = Math.floor(theta(t) / TAU) + 1; const ph = (theta(t) / TAU) % 1;
    digs.forEach((b, i) => { const v = on && n === i + 1; b.group.visible = v; if (v) { const k = Math.min(1, ph * 6); const s = 1 + 0.5 * (1 - k) * (1 - k) * Math.cos(k * 8); b.group.scale.setScalar(s); b.setOpacity(1); } });
  });
  addSub(ctx, [{ t: 'Gira,' }, { t: 'gira,' }, { t: 'gira…', c: '#F9D548' }], 7.8, 9.9, { stagger: 0.28 });

  // 2C — tontura
  const dizzy = new THREE.Group(); const qs = [0, 1, 2].map((i) => { const b = new TextBlock(tf.anton, i === 1 ? '!' : '?', { size: 0.42, depth: 0.08, colorA: '#E8A200', colorB: '#FFE680', rim: '#FFF3B0', emis: '#3A2A00' }); dizzy.add(b.group); return b; });
  G.park.add(dizzy); vis(tl, dizzy, 10.55, 12.0); ctx.reg(qs.flatMap((b) => b.glyphs));
  qs.forEach((b, i) => enter(tl, b, 10.6 + i * 0.1, { style: 'pop', dur: 0.45, stagger: 0 })); ev(10.6, 'pop', 1);
  ctx.updaters.push((t) => { if (t < 10.5 || t >= 12) return; const hp = new THREE.Vector3(); dog.head.getWorldPosition(hp); qs.forEach((b, i) => { const a = t * 4.5 + i * TAU / 3; b.group.position.set(hp.x + Math.cos(a) * 0.42, hp.y + 0.45 + Math.sin(t * 3 + i) * 0.04, hp.z + Math.sin(a) * 0.42); b.group.rotation.y = -a + Math.PI / 2; }); });
  addSub(ctx, [{ t: 'Será' }, { t: 'coincidência?', pill: true }], 10.4, 12.0);

  // câmeras
  ctx.shot(5.0, 7.5, 'park', (u, t) => interp(u, [{ t: 0, p: [2.8, 0.6, 6.6], l: [0, 1.35, 0], fov: 40, roll: 4 }, { t: 2.5, p: [-1.2, 0.8, 6.0], l: [0, 1.3, 0], fov: 38, roll: -2 }], 'inOut'), { aperture: 0.6, bloom: 0.35 }, { dog: true });
  ctx.shot(7.5, 10.0, 'park', (u, t) => { const k = interp(u, [{ t: 0, p: [0.0, 15.5, 0.4], l: [0, 0, 0], fov: 32, roll: 0 }, { t: 2.5, p: [0.0, 13.5, 0.4], l: [0, 0, 0], fov: 32, roll: 14 }], 'inOut'); return k; }, { focus: 14, aperture: 0.2, bloom: 0.4 }, { dog: true });
  ctx.shot(10.0, 12.0, 'park', (u, t, c) => { const k = u / 2; const a = dogRel(c, 3.8 - 0.8 * k, 1.1 - 0.5 * k, 1.0, 0.85); return { p: a.p, l: a.l, fov: 36 - 3 * k, roll: -6 + 10 * k }; }, { aperture: 0.9, bloom: 0.35 }, { dog: true });
  ctx.transition(5.0, 0.36, 'zoom'); ctx.transition(7.5, 0.34, 'whip', [0, 1]); ctx.transition(10.0, 0.34, 'whip', [-1, 0]); ctx.transition(12.0, 0.42, 'flash');
  ev(7.5, 'whip', 1); ev(10.0, 'whip', 1); ev(12.0, 'flash', 1);
}
