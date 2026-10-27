// CENA 4 (21–32 s) — Prova científica: "70 CÃES ANALISADOS" + "EIXO NORTE–SUL"
import * as THREE from 'three';
import { Lockup, enter, exit, glint, flash, ev, vis, fadeBlock } from '../kit/kinetic.js';
import { TextBlock } from '../kit/text.js';
import { addSub, subline, sublineIn, sublineOut } from '../engine/hud.js';
import { Compass } from '../world/compass.js';
import { glowMaterial } from '../world/glow.js';
import { interp, shockRing, wob, ease } from './common.js';
import { TAU, smooth, col, clamp } from '../kit/util.js';

const FLOOR_FS = `precision highp float; varying vec3 vW; uniform vec3 uBg, uLine; uniform float uRingGlow;
void main(){ float r = length(vW.xz); vec2 g = abs(fract(vW.xz * 0.5 + 0.5) - 0.5);
  float gl = smoothstep(0.02, 0.0, min(g.x, g.y)) * smoothstep(26.0, 3.0, r) * 0.28;
  float rg = smoothstep(0.03, 0.0, abs(r - 2.35)) * 0.7 + smoothstep(0.02, 0.0, abs(r - 3.5)) * 0.35;
  vec3 c = uBg * (1.0 + 0.9 * smoothstep(8.0, 0.0, r)); c += uLine * (gl + rg * uRingGlow); gl_FragColor = vec4(c, 1.0); }`;

export function build(ctx) {
  const { tl, tf, G, hud, dog, field } = ctx; const ST = G.stage;
  const SC = 1.9;
  // chão do laboratório
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), new THREE.ShaderMaterial({ vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }', fragmentShader: FLOOR_FS, uniforms: { uBg: { value: col('#0C1430') }, uLine: { value: col('#00D9F5') }, uRingGlow: { value: 1 } } }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = -0.01; ST.add(floor);
  const comp = new Compass(tf.anton); comp.group.scale.setScalar(SC); ST.add(comp.group);
  field.group.scale.setScalar(SC); ST.add(field.group);
  // eixo N–S
  const axisMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, uniforms: { uDraw: { value: 0 }, uTime: { value: 0 }, uOp: { value: 1 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `precision highp float; varying vec2 vUv; uniform float uDraw, uTime, uOp; void main(){ float a = abs(vUv.x - 0.5) * 2.0; float core = smoothstep(1.0, 0.0, a); float d = abs(vUv.y - 0.5) * 2.0; float on = step(d, uDraw);
      float dash = smoothstep(0.35, 0.5, fract(vUv.y * 22.0 - uTime * 1.5)); vec3 c = mix(vec3(0.0, 0.85, 1.0), vec3(1.0, 0.85, 0.3), smoothstep(0.1, 0.9, vUv.y)); gl_FragColor = vec4(c * (1.6 + dash * 1.4) * core, core * on * uOp); }` });
  const axis = new THREE.Mesh(new THREE.PlaneGeometry(0.13, 8.0), axisMat); axis.rotation.x = -Math.PI / 2; axis.position.y = 0.05; ST.add(axis);
  const mkArrow = (z, dir, c) => { const sh = new THREE.Shape(); sh.moveTo(0, 0.5 * dir); sh.lineTo(0.32, -0.15 * dir); sh.lineTo(0, 0.03 * dir); sh.lineTo(-0.32, -0.15 * dir); sh.closePath(); const m = new THREE.Mesh(new THREE.ShapeGeometry(sh), glowMaterial({ color: c, intensity: 2.2 })); m.rotation.x = -Math.PI / 2; m.position.set(0, 0.06, z); ST.add(m); return m; };
  const aN = mkArrow(-4.1, 1, '#F9D548'), aS = mkArrow(4.1, -1, '#00D9F5');
  // pings viajando N <-> S
  const ping = new THREE.Mesh(new THREE.RingGeometry(0.96, 1.0, 64), glowMaterial({ color: '#BFF6FF', intensity: 0.9, opacity: 0 })); ping.rotation.x = -Math.PI / 2; ping.position.y = 0.07; ST.add(ping);
  ctx.updaters.push((t) => {
    const on = t >= 21 && t < 32.2; comp.group.visible = field.group.visible = on; axis.visible = aN.visible = aS.visible = on && t >= 24.6; ping.visible = on && t >= 25.4;
    if (!on) return; comp.setOpacity(smooth((t - 21.0) / 0.5)); comp.update(t, 0.0); axisMat.uniforms.uDraw.value = smooth((t - 24.6) / 0.9); axisMat.uniforms.uTime.value = t; axisMat.uniforms.uOp.value = 0.9;
    const k = ((t - 25.4) % 1.6) / 1.6; ping.scale.setScalar(0.3 + k * 4.6); ping.material.uniforms.uOpacity.value = (1 - k) * 0.7;
    const st = ctx.stageState; const c = clamp((t - 21.35) / 1.9); st.count = 70 * (1 - Math.pow(1 - c, 2.4)); st.align = smooth((t - 24.9) / 1.3); st.hist = smooth((t - 26.0) / 1.0) * smooth((29.9 - t) / 0.4 + 0.0001);
    field.group.visible = t >= 21.2;
  });
  ctx.needleYaw2 = null;

  // 4A — contador 70 (dígitos 3D) + CÃES ANALISADOS
  const digitsT = [], digitsO = []; const dsz = 1.55;
  for (let n = 0; n < 10; n++) for (const [arr, x] of [[digitsT, -0.52], [digitsO, 0.52]]) { const b = new TextBlock(tf.anton, String(n), { size: dsz, depth: 0.22, bevel: 0.02, colorA: '#E8A200', colorB: '#FFE680', rim: '#FFF3B0', emis: '#2A1C00' }); b.group.position.x = x; b.group.visible = false; ST.add(b.group); arr.push(b); }
  const numG = new THREE.Group(); [...digitsT, ...digitsO].forEach((b) => { ST.remove(b.group); numG.add(b.group); }); numG.position.set(0, 5.1, -3.0); numG.rotation.x = -0.52; ST.add(numG); numG.visible = false; ctx.reg([...digitsT, ...digitsO].flatMap((b) => b.glyphs));
  const LB = new Lockup(tf.anton, [{ text: 'CÃES', width: 1.1, colorA: '#BFD9FF', colorB: '#FFFFFF' }, { text: 'ANALISADOS', width: 2.5, colorA: '#BFD9FF', colorB: '#FFFFFF' }], { gap: 0.08, depth: 0.14, rim: '#00D9F5', emis: '#04101E' });
  LB.group.position.set(0, 3.05, -3.0); LB.group.rotation.x = -0.52; ST.add(LB.group); ctx.reg(LB.all); vis(tl, LB.group, 21.2, 24.3);
  let last = -1;
  ctx.updaters.push((t) => {
    numG.visible = t >= 21.3 && t < 24.4; if (!numG.visible) return;
    const n = Math.min(70, Math.floor(ctx.stageState.count + 0.0001)); const T = Math.floor(n / 10), O = n % 10;
    digitsT.forEach((b, i) => { b.group.visible = i === T; }); digitsO.forEach((b, i) => { b.group.visible = i === O; });
    const pop = (t >= 23.1 && t < 23.7) ? 1 + 0.28 * Math.pow(1 - (t - 23.1) / 0.6, 2) * Math.cos((t - 23.1) * 14) : 1; const base = 0.0;
    const ent = t < 21.9 ? 1 + (1 - smooth((t - 21.3) / 0.6)) * 1.6 : 1; numG.scale.setScalar(pop * ent); const ex = smooth((t - 24.0) / 0.3); numG.scale.multiplyScalar(1 - ex);
    [...digitsT, ...digitsO].forEach((b) => b.setFlash(t > 23.1 && t < 23.35 ? 0.9 : 0));
  });
  for (let i = 0; i < 14; i++) ev(21.35 + i * 0.135, 'tick', 0.6 + i * 0.02); ev(23.2, 'impact', 1.2); ev(23.2, 'riser_end', 1); ctx.pulse(23.2, 1, 0.45);
  enter(tl, LB.blocks[0], 23.3, { style: 'drop', stagger: 0.05, dur: 0.6 }); enter(tl, LB.blocks[1], 23.45, { style: 'rise', stagger: 0.03, dur: 0.6 }); ev(23.3, 'slam', 0.8); glint(tl, LB.blocks[1], 23.8, 0.7);
  exit(tl, LB.blocks[0], 24.1, { style: 'fall', stagger: 0.02 }); exit(tl, LB.blocks[1], 24.12, { style: 'fall', stagger: 0.012 });

  // 4B — EIXO NORTE–SUL
  const LE = new Lockup(tf.anton, [{ text: 'EIXO', width: 1.0, colorA: '#00B5D6', colorB: '#8CF6FF', rim: '#C8FBFF', emis: '#00323F' }, { text: 'NORTE–SUL', width: 2.7, colorA: '#E8A200', colorB: '#FFE680', rim: '#FFF3B0', emis: '#2A1C00' }], { gap: 0.1, depth: 0.16, rim: '#00D9F5' });
  LE.group.position.set(0, 3.4, -3.4); LE.group.rotation.x = -0.5; ST.add(LE.group); ctx.reg(LE.all); vis(tl, LE.group, 24.5, 27.1);
  enter(tl, LE.blocks[0], 24.6, { style: 'spin', stagger: 0.05, dur: 0.6 }); enter(tl, LE.blocks[1], 25.1, { style: 'slam', stagger: 0.04, dur: 0.6, dz: 1.8 }); ev(24.6, 'slam', 0.9); ev(25.1, 'impact', 1); ev(24.9, 'whoosh', 1);
  flash(tl, LE.blocks[1], 25.15, 0.6, 0.25); glint(tl, LE.blocks[1], 25.7, 0.8); ctx.pulse(25.12, 0.9, 0.4);
  exit(tl, LE.blocks[0], 26.8, { style: 'shrink', stagger: 0.02 }); exit(tl, LE.blocks[1], 26.82, { style: 'shrink', stagger: 0.02 });
  const tiny = subline(tf.mont7, [{ t: 'gráfico ilustrativo', c: '#9EEFFF' }], { size: 30 }); tiny.position.set(0, -420, 0); hud.add(tiny); ctx.reg(tiny.userData.blocks.map((b) => b.tb.group), true); sublineIn(tl, tiny, 26.2); sublineOut(tl, tiny, 27.0);

  // 4C — NORTE / SUL no chão, cão alinhado
  const gtxt = (txt, w, c1, c2, z, rot) => { const b = new TextBlock(tf.anton, txt, { size: w / tf.anton.layout(txt).width, depth: 0.06, bevel: 0.008, colorA: c1, colorB: c2, rim: '#FFFFFF', emis: '#101010', amb: 0.9 }); b.group.rotation.x = -Math.PI / 2; b.group.rotation.z = rot; b.group.position.set(0, 0.08, z); ST.add(b.group); ctx.reg(b.glyphs); return b; };
  const gN = gtxt('NORTE', 2.2, '#E8A200', '#FFE680', -3.05, 0), gS = gtxt('SUL', 1.5, '#00B5D6', '#8CF6FF', 3.15, 0);
  vis(tl, gN.group, 26.9, 32.1); vis(tl, gS.group, 26.9, 32.1);
  enter(tl, gN, 27.1, { style: 'pop', stagger: 0.06, dur: 0.5 }); enter(tl, gS, 27.4, { style: 'pop', stagger: 0.06, dur: 0.5 }); ev(27.1, 'slam', 0.8); ev(27.4, 'slam', 0.7);
  addSub(ctx, [{ t: '37' }, { t: 'raças', c: '#F9D548' }, { t: '·' }, { t: '1.893', c: '#F9D548' }, { t: 'observações' }], 27.3, 29.6, { stagger: 0.09 });
  addSub(ctx, [{ t: 'com' }, { t: 'campo' }, { t: 'magnético' }, { t: 'estável', pill: true }], 29.65, 32.0, { stagger: 0.09 });
  const cred = addSub(ctx, [{ t: 'Hart et al., 2013 · Frontiers in Zoology', c: '#9EEFFF' }], 27.6, 32.0, { size: 32, y: -420, font: 'mont7', maxW: 960 }); ctx.subWins.pop();

  // câmeras
  ctx.shot(21.0, 24.5, 'stage', (u) => interp(u, [{ t: 0, p: [0, 16.0, 14.5], l: [0, 1.2, -0.8], fov: 36, roll: -3 }, { t: 3.5, p: [0, 14.0, 12.5], l: [0, 1.4, -0.6], fov: 36, roll: 2 }], 'out'), { focus: 19, aperture: 0.25, bloom: 0.45 });
  ctx.shot(24.5, 27.0, 'stage', (u) => interp(u, [{ t: 0, p: [-7.0, 7.0, 9.0], l: [0, 1.2, -0.5], fov: 34, roll: 5 }, { t: 2.5, p: [5.5, 6.0, 9.5], l: [0, 1.2, -0.5], fov: 34, roll: -2 }], 'inOut'), { focus: 13, aperture: 0.3, bloom: 0.5 });
  ctx.shot(27.0, 29.5, 'stage', (u) => interp(u, [{ t: 0, p: [2.0, 2.6, 5.6], l: [0, 0.5, -1.2], fov: 38, roll: 4 }, { t: 2.5, p: [-1.5, 2.2, 5.0], l: [0, 0.5, -1.3], fov: 36, roll: -2 }], 'out'), { focus: 8, aperture: 0.3, bloom: 0.5 }, { dog: true });
  ctx.shot(29.5, 32.0, 'stage', (u) => interp(u, [{ t: 0, p: [0.0, 14.5, 2.4], l: [0, 0, 0], fov: 36, roll: 0 }, { t: 2.5, p: [0.0, 12.8, 3.8], l: [0, 0, 0], fov: 36, roll: -12 }], 'inOut'), { focus: 12, aperture: 0.2, bloom: 0.5 }, { dog: true });
  ctx.transition(21.0, 0.5, 'wipe'); ctx.transition(24.5, 0.3, 'whip', [1, 0]); ctx.transition(27.0, 0.3, 'zoom'); ctx.transition(29.5, 0.3, 'whip', [0, 1]);
  ev(21.0, 'wipe', 1); ev(24.5, 'whip', 0.9); ev(27.0, 'zoomhit', 0.9); ev(29.5, 'whip', 0.8);
}
