// CENA 6 (39–45 s) — Final viral: "VOCÊ JÁ PERCEBEU ISSO? 🐾"
import * as THREE from 'three';
import gsap from 'gsap';
import { Lockup, enter, exit, glint, flash, ev, vis } from '../kit/kinetic.js';
import { TextBlock } from '../kit/text.js';
import { addSub, paw, subline, sublineIn, sublineOut, pill } from '../engine/hud.js';
import { interp, shockRing, wob } from './common.js';
import { TAU, smooth, hash1, BRAND } from '../kit/util.js';

export function build(ctx) {
  const { tl, tf, G, hud } = ctx; const PK = G.park;
  const L = new Lockup(tf.anton, [
    { text: 'VOCÊ JÁ', width: 1.35, colorA: '#BFD9FF', colorB: '#FFFFFF' },
    { text: 'PERCEBEU', width: 1.78, colorA: '#E8A200', colorB: '#FFE680', rim: '#FFF3B0', emis: '#2A1C00' },
    { text: 'ISSO?', width: 1.3, colorA: '#00B5D6', colorB: '#8CF6FF', rim: '#C8FBFF', emis: '#00323F' }], { gap: 0.09, depth: 0.2, rim: '#00D9F5', emis: '#04101E' });
  L.group.position.set(0, 2.95, -1.4); PK.add(L.group); ctx.reg(L.all); vis(tl, L.group, 39.0, 45.2);
  enter(tl, L.blocks[0], 39.0, { style: 'spin', stagger: 0.05, dur: 0.6 }); ev(39.0, 'slam', 1);
  enter(tl, L.blocks[1], 39.5, { style: 'slam', stagger: 0.04, dur: 0.6, dz: 2.0 }); ev(39.5, 'slam', 1);
  enter(tl, L.blocks[2], 40.0, { style: 'drop', stagger: 0.06, dur: 0.75 }); ev(40.0, 'impact', 1.2); flash(tl, L.blocks[2], 40.05, 0.7, 0.25); ctx.pulse(40.02, 1, 0.45);
  glint(tl, L.blocks[1], 40.4, 0.8); glint(tl, L.blocks[2], 41.1, 0.7);
  shockRing(ctx, PK, 40.02, { pos: [0, 1.9, -1.2], color: '#00D9F5', max: 5, dur: 0.9 });
  // patinhas vetoriais (substituem o emoji) estouram do centro
  const pawsG = new THREE.Group(); hud.scene.add(pawsG); const P = [];
  for (let i = 0; i < 9; i++) { const p = paw(70 + (i % 3) * 22, i % 2 ? BRAND.yellow : BRAND.cyan); p.visible = false; pawsG.add(p); p.traverse((o) => { o.renderOrder = 8; }); P.push(p); }
  P.forEach((p, i) => { const a = (i / P.length) * TAU + 0.4, d = 340 + (i % 3) * 120; const T = 40.15 + i * 0.03; const st = { v: 0 };
    tl.set(p, { visible: true }, T); tl.fromTo(st, { v: 0 }, { v: 1, duration: 1.4, ease: 'expo.out', immediateRender: false, onUpdate: () => { p.position.set(Math.cos(a) * d * st.v * 1.15, 300 + Math.sin(a) * d * st.v * 0.8, 0); p.rotation.z = a - Math.PI / 2 + st.v * 0.6; p.scale.setScalar(0.6 + 0.5 * Math.sin(Math.min(1, st.v * 1.2) * Math.PI * 0.5)); p.userData.mat.opacity = Math.min(1, (1 - st.v) * 2.2); } }, T); tl.set(p, { visible: false }, T + 1.45); });
  ev(40.15, 'sparkle', 1);
  // pegadas fixas (patinha final ao lado do título)
  const pawEnd = paw(120, BRAND.yellow); pawEnd.position.set(410, 470, 0); pawEnd.rotation.z = -0.35; pawEnd.visible = false; hud.add(pawEnd, 8); pawEnd.traverse((o) => { o.renderOrder = 8; });
  const pst = { v: 0 }; tl.set(pawEnd, { visible: true }, 41.2); tl.fromTo(pst, { v: 0 }, { v: 1, duration: 0.6, ease: 'back.out(2.4)', immediateRender: false, onUpdate: () => { pawEnd.scale.setScalar(Math.max(0.0001, pst.v)); pawEnd.userData.mat.opacity = Math.min(1, pst.v * 2); } }, 41.2); ev(41.2, 'pop', 1);
  ctx.updaters.push((t) => { if (t >= 41.2) pawEnd.position.y = 470 + Math.sin(t * 3) * 10; });
  // fim: CTA + crédito
  tl.set(L.group.scale, { x: 0.62, y: 0.62, z: 0.62 }, 42.2); tl.set(L.group.position, { y: 2.75 }, 42.2);
  addSub(ctx, [{ t: 'Conta' }, { t: 'nos' }, { t: 'comentários', pill: true }], 42.4, 44.6, { stagger: 0.1, y: 80 });
  ev(42.4, 'tick', 1);
  const cred = subline(tf.mont7, [{ t: 'Fonte: Hart et al. (2013), Frontiers in Zoology', c: '#9EEFFF' }], { size: 30, maxW: 980 }); cred.position.set(0, -450, 0); hud.add(cred); ctx.reg(cred.userData.blocks.map((b) => b.tb.group), true); sublineIn(tl, cred, 42.6); sublineOut(tl, cred, 44.8);
  // fade final para o azul-marinho (loop limpo)
  tl.fromTo(ctx.fadeOut, { v: 0 }, { v: 1, duration: 0.45, ease: 'power2.in', immediateRender: false }, 44.55);
  ev(44.55, 'outro', 1);

  ctx.shot(39.0, 42.2, 'park', (u, t) => interp(u, [{ t: 0, p: [1.6, 0.6, 6.0], l: [0, 1.5, 0], fov: 40, roll: -3 }, { t: 3.2, p: [-0.7, 0.9, 5.0], l: [0, 1.4, 0], fov: 36, roll: 2 }], 'inOut'), { aperture: 0.6, bloom: 0.5 }, { dog: true });
  ctx.shot(42.2, 45.0, 'park', (u, t) => interp(u, [{ t: 0, p: [-0.6, 1.0, 6.6], l: [0, 1.4, 0], fov: 34, roll: 2 }, { t: 2.8, p: [0.3, 1.15, 7.2], l: [0, 1.45, 0], fov: 34, roll: -1 }], 'inOut'), { aperture: 0.7, bloom: 0.5 }, { dog: true });
  ctx.transition(39.0, 0.36, 'wipe'); ctx.transition(42.2, 0.3, 'whip', [1, 0]);
  ev(39.0, 'wipe', 1); ev(42.2, 'whip', 0.9);
}
