// Lista de planos (shots) sincronizada com a narração. Tempos em segundos globais.
import * as THREE from 'three';
import { E, clamp, lerp, prog } from './typography.js';

export const LOOKS = {
  golden: { top: '#1b86d8', mid: '#62d2f4', hor: '#fff1cc', fog: '#d4f4ee', fogDen: 0.019, sun: '#ffd98a', sunDir: [-0.45, 0.30, -0.85], cloud: 1, sunGlow: 1,
    key: '#ffe3a8', keyI: 1.3, keyDir: [0.55, 0.55, 0.65], rim: '#00d9f5', rimI: 1.5, rimDir: [-0.7, 0.35, -0.75], sky: '#8fdcff', skyI: 0.6, ground: '#3a9a3a',
    grassBase: '#14631f', grassTip: '#a3ea52', gA: '#1c7a2a', gB: '#4fbf40', dust: 1, flowers: true },
  science: { top: '#0c2a5e', mid: '#13679a', hor: '#7fd7e8', fog: '#2a7f9c', fogDen: 0.022, sun: '#9fe9ff', sunDir: [0.0, 0.5, -1], cloud: 0.25, sunGlow: 0.4,
    key: '#ffe6b8', keyI: 1.75, keyDir: [0.35, 0.9, 0.45], rim: '#00d9f5', rimI: 2.2, rimDir: [-0.5, 0.5, -0.8], sky: '#6cc8ee', skyI: 0.42, ground: '#1c5f66',
    grassBase: '#0d4a45', grassTip: '#5fd69a', gA: '#0f5a52', gB: '#2c9a78', dust: 0.22, flowers: false },
  twist: { top: '#10173a', mid: '#20457a', hor: '#8fb7d9', fog: '#31587f', fogDen: 0.024, sun: '#f9d548', sunDir: [0.4, 0.2, -0.9], cloud: 0.4, sunGlow: 0.5,
    key: '#ffe9a8', keyI: 1.25, keyDir: [0.6, 0.45, 0.6], rim: '#00d9f5', rimI: 2.2, rimDir: [-0.7, 0.3, -0.7], sky: '#5aa8e0', skyI: 0.45, ground: '#25606a',
    grassBase: '#12533f', grassTip: '#6fd27c', gA: '#155a45', gB: '#30a070', dust: 1, flowers: true },
};

const V3 = (a, b, c) => new THREE.Vector3(a, b, c);
// câmera orbital em torno de um ponto
export function orbit(h, az, el, dist, off = [0, 0, 0]) {
  const ce = Math.cos(el);
  return [h.x + Math.sin(az) * ce * dist + off[0], h.y + Math.sin(el) * dist + off[1], h.z + Math.cos(az) * ce * dist + off[2]];
}
// tremor de câmera (determinístico)
export function shake(t, a = 0.006, f = 1) { return [Math.sin(t * 13.1 * f) * a + Math.sin(t * 7.3 * f) * a * 0.6, Math.sin(t * 11.7 * f + 1.2) * a + Math.sin(t * 5.9 * f) * a * 0.6]; }

export function needleAngle(t, t0) {
  const k = clamp((t - t0) / 1.4);
  const big = (1 - E.outCubic(k)) * Math.PI * 7;
  const wob = t > t0 + 1.2 ? 0.14 * Math.exp(-3.2 * (t - t0 - 1.2)) * Math.sin(16 * (t - t0 - 1.2)) : 0;
  return big + wob;
}

export function buildShots(D) {
  const S = [];
  const headCompass = (t, D, reveal, extra = {}) => {
    if (D.dry) return;
    const h = D.headPos(); const c = D.cmpHead;
    c.group.visible = reveal > 0.001; c.group.position.set(h.x, h.y + (extra.up ?? 0.66), h.z); c.group.quaternion.copy(D.cam.quaternion);
    c.group.scale.setScalar(extra.scale ?? 1.0);
    c.draw({ t, reveal, needle: extra.needle ?? 0, spin: t * 0.3, alpha: extra.alpha ?? 1, glitch: extra.glitch ?? 0, scan: t * 1.6, flicker: extra.flicker ?? 0.06, burst: extra.burst ?? 0 });
  };

  // ===== CENA 1 (0–5): gancho =====
  S.push({ id: 's1a', t0: 0, t1: 2.0, scene: 'park', look: 'golden',
    cam: (t, lt, D) => { const h = D.headPos(); const k = E.outExpo(clamp(lt / 1.5)); const sh = shake(t, 0.004);
      return { pos: orbit(h, lerp(0.5, 0.05, k), lerp(0.2, 0.04, k), lerp(4.6, 3.7, k), [sh[0], sh[1], 0]), target: [h.x, h.y + lerp(0.25, 0.30, k), h.z], fov: lerp(36, 31, k), roll: lerp(0.09, 0, k) }; },
    grade: { bloom: 0.6 } });
  S.push({ id: 's1b', t0: 2.0, t1: 3.5, scene: 'park', look: 'golden', trans: { type: 2, dur: 0.16, center: [0.5, 0.5] },
    cam: (t, lt, D) => { const h = D.headPos(); const k = E.inOutCubic(clamp(lt / 1.5)); const sh = shake(t, 0.004);
      return { pos: orbit(h, lerp(-0.40, -0.18, k), lerp(-0.05, 0.04, k), lerp(3.7, 3.3, k), [sh[0], sh[1], 0]), target: [h.x, h.y + 0.30, h.z], fov: 30, roll: lerp(-0.05, -0.015, k) }; },
    setup: (t, lt, D) => headCompass(t, D, clamp((t - 2.45) / 0.9), { needle: needleAngle(t, 2.45) }) });
  S.push({ id: 's1c', t0: 3.5, t1: 5.0, scene: 'park', look: 'golden', trans: { type: 2, dur: 0.16, center: [0.5, 0.6] },
    cam: (t, lt, D) => { const h = D.headPos(); const k = E.inOutCubic(clamp(lt / 1.5)); const sh = shake(t, 0.004);
      return { pos: orbit(h, lerp(0.12, -0.05, k), lerp(0.02, 0.07, k), lerp(3.3, 2.7, k), [sh[0], sh[1], 0]), target: [h.x, h.y + lerp(0.34, 0.30, k), h.z], fov: 30, roll: lerp(0.03, 0, k) }; },
    setup: (t, lt, D) => headCompass(t, D, 1, { needle: needleAngle(t, 2.45), burst: Math.exp(-6 * Math.max(0, t - 3.5)) }) });

  // ===== CENA 3 (12–21): espaço =====
  const spaceSet = (t, D, o = {}) => {
    const sp = D.space; sp.setSpin(-0.61 + (t - 12) * 0.16, 23.5, o.tiltX ?? 20);
    const grow = E.outCubic(prog(t, 12.9, 1.7)) * 1.12;
    sp.field.set(t, grow, 1); sp.flareN.material.opacity = 0.9; sp.flareS.material.opacity = 0.9;
    const pul = 0.75 + 0.25 * Math.sin(t * 5); sp.flareN.scale.setScalar(0.35 * pul + 0.2); sp.flareS.scale.setScalar(0.35 * pul + 0.2);
    const a = E.outCubic(prog(t, 13.4, 1.0)); sp.auroraN.material.uniforms.uAmt.value = a; sp.auroraS.material.uniforms.uAmt.value = a;
    // luz do sol rasante: flare na borda do planeta
    sp.sunFlare.position.copy(sp.sun).multiplyScalar(60); sp.sunFlare.scale.setScalar(o.flare ?? 0.001);
  };
  const spaceCompass = (t, D, reveal, o = {}) => {
    if (D.dry) return;
    const c = D.space.cmp; c.group.visible = reveal > 0.001;
    const p = D.cam.localToWorld(new THREE.Vector3(o.x ?? 0, o.y ?? -0.3, -(o.z ?? 5.2)));
    c.group.position.copy(p); c.group.quaternion.copy(D.cam.quaternion); c.group.rotateX(o.rx ?? -0.35); c.group.rotateY(o.ry ?? 0.0);
    c.group.scale.setScalar(o.scale ?? 0.5);
    c.draw({ t, reveal, needle: o.needle ?? 0, spin: t * 0.3, alpha: o.alpha ?? 1, glitch: o.glitch ?? 0, scan: t * 1.6, flicker: 0.05, paw: o.paw ?? 0 });
  };
  S.push({ id: 's3a', t0: 12.0, t1: 15.0, scene: 'space', trans: { type: 1, dur: 0.42, dir: [0, 1] },
    cam: (t, lt) => { const k = E.inOutCubic(clamp(lt / 3)); return { pos: [lerp(0.0, 0.0, k), lerp(-0.6, 0.5, k), lerp(17.5, 14.2, k)], target: [0, lerp(-0.2, 0.2, k), 0], fov: 32, roll: lerp(0.06, 0, k) }; },
    setup: (t, lt, D) => spaceSet(t, D), grade: { bloom: 0.5, bloomThresh: 1.1 } });
  S.push({ id: 's3b', t0: 15.0, t1: 18.0, scene: 'space', trans: { type: 2, dur: 0.18, center: [0.5, 0.4] },
    cam: (t, lt) => { const k = E.inOutCubic(clamp(lt / 3)); return { pos: [lerp(3.0, 1.4, k), lerp(7.2, 6.4, k), lerp(11, 9.4, k)], target: [0, lerp(1.9, 1.4, k), 0], fov: 32, roll: lerp(-0.05, 0.02, k) }; },
    setup: (t, lt, D) => { spaceSet(t, D, { tiltX: 24 }); spaceCompass(t, D, clamp((t - 16.2) / 0.9), { needle: needleAngle(t, 16.2) * 0.0 + (t < 17.4 ? needleAngle(t, 16.2) : 0.0), paw: clamp((t - 17.3) / 0.5), y: -0.28 }); }, grade: { bloom: 0.55, bloomThresh: 1.1 } });
  S.push({ id: 's3c', t0: 18.0, t1: 21.0, scene: 'space', trans: { type: 2, dur: 0.18, center: [0.5, 0.5] },
    cam: (t, lt) => { const k = E.inOutCubic(clamp(lt / 3)); const z = lerp(11.5, 6.2, E.inOutQuart(clamp(lt / 3))); return { pos: [lerp(-1.8, 0.0, k), lerp(2.2, 0.4, k), z], target: [0, lerp(0.8, 0.0, k), 0], fov: lerp(32, 36, k), roll: lerp(0.0, -0.06, k) }; },
    setup: (t, lt, D) => { spaceSet(t, D, { tiltX: 18, flare: 5.0 * E.inCubic(prog(t, 19.0, 1.8)) }); spaceCompass(t, D, 1, { needle: 0, paw: 1, y: -0.30, alpha: 1 - E.inCubic(prog(t, 20.2, 0.6)) }); }, grade: { bloom: 0.6, bloomThresh: 1.1 } });

  // ===== CENA 2 (5–12): o mistério das voltas =====
  const C2 = [0, 0, -0.62];
  const focusC2 = (D) => D.cam.position.distanceTo(new THREE.Vector3(C2[0], 0.35, C2[2]));
  S.push({ id: 's2a', t0: 5.0, t1: 7.0, scene: 'park', look: 'golden', trans: { type: 1, dur: 0.30, dir: [1, 0] },
    cam: (t, lt, D) => { const h = D.headPos(); const phi = lerp(1.25, 0.8, clamp(lt / 2)); const sh = shake(t, 0.006);
      return { pos: [C2[0] + Math.sin(phi) * 6.6 + sh[0], 1.0 + sh[1], C2[2] + Math.cos(phi) * 6.6], target: [lerp(C2[0], h.x, 0.3), 0.55, lerp(C2[2], h.z, 0.3) + 0.1], fov: 34, roll: lerp(-0.04, 0.03, clamp(lt / 2)) }; },
    dof: { focus: focusC2, range: 1.1 } });
  S.push({ id: 's2b', t0: 7.0, t1: 9.5, scene: 'park', look: 'golden', trans: { type: 2, dur: 0.16, center: [0.5, 0.55] },
    cam: (t, lt, D) => { const h = D.headPos(); const phi = -0.3 - lt * 0.75; const el = 0.78; const dist = lerp(6.6, 5.4, E.inOutCubic(clamp(lt / 2.5))); const sh = shake(t, 0.007);
      return { pos: [C2[0] + Math.sin(phi) * Math.cos(el) * dist + sh[0], Math.sin(el) * dist + 0.2 + sh[1], C2[2] + Math.cos(phi) * Math.cos(el) * dist], target: [lerp(C2[0], h.x, 0.3), 0.85, lerp(C2[2], h.z, 0.3)], fov: lerp(34, 40, clamp(lt / 2.5)), roll: Math.sin(lt * 1.6) * 0.07 }; },
    dof: { focus: focusC2, range: 1.0 } });
  S.push({ id: 's2c', t0: 9.5, t1: 12.0, scene: 'park', look: 'golden', trans: { type: 2, dur: 0.14, center: [0.5, 0.5] },
    cam: (t, lt, D) => {
      const h = D.headPos(); const yaw = D.dogS.yaw; const f = [Math.sin(yaw), Math.cos(yaw)];
      const zoom = E.outExpo(clamp(lt / 0.45)); const dist = lerp(5.4, 3.1, zoom) - 0.4 * E.inOutCubic(clamp((lt - 0.6) / 1.9));
      const diz = clamp((t - 9.7) / 0.7);
      const side = Math.sin(t * 2.2) * 0.12 * diz;
      const k = clamp((t - 11.5) / 0.5); const pitchUp = 5.5 * Math.pow(k, 2.2);   // chicote para o céu (sem chegar ao zênite chapado)
      return { pos: [h.x + f[0] * dist + side, h.y + 0.08, h.z + f[1] * dist], target: [h.x, h.y + 0.06 + pitchUp, h.z], fov: lerp(32, 30, zoom), roll: Math.sin(t * 6.5) * 0.09 * diz };
    }, dof: { aperture: 1.1, range: 0.6 }, grade: (t) => ({ bloom: 0.6, ab: 0.0013 + 0.004 * Math.exp(-8 * Math.max(0, t - 9.5)) * (t >= 9.5 ? 1 : 0) }) });

  // ===== CENA 4 (21–32): a prova científica (vista do alto) =====
  const groundCmp = (t, D, rev, o = {}) => {
    if (D.dry) return;
    const c = D.cmpGround; c.group.visible = rev > 0.001; c.group.position.set(0, 0.21, 0);
    c.draw({ t, reveal: rev, needle: o.needle ?? 0, spin: t * 0.12, alpha: o.alpha ?? 1, glitch: 0, scan: t * 1.2, flicker: 0.03 });
  };
  const axisLine = (t, D, k) => {
    const a = D.axis; a.mesh.visible = k > 0.001; a.set(t, 1.1 * k, 1);
  };
  const camPolar = (tx, ty, tz, az, el, dist, up) => ({ pos: [tx + Math.sin(az) * Math.cos(el) * dist, ty + Math.sin(el) * dist, tz + Math.cos(az) * Math.cos(el) * dist], target: [tx, ty, tz], up });
  S.push({ id: 's4a', t0: 21.0, t1: 24.0, scene: 'park', look: 'science', trans: { type: 3, dur: 0.5, center: [0.5, 0.5] },
    cam: (t, lt) => { const k = E.inOutCubic(clamp(lt / 3)); const c = camPolar(0, 0, lerp(-0.55, -0.45, k), 0, 1.5446, lerp(6.9, 6.1, k), [0, 0, -1]); return { ...c, fov: 32, roll: lerp(0.12, 0.0, k) }; },
    setup: (t, lt, D) => groundCmp(t, D, clamp((t - 21.25) / 1.3)), dof: { on: true, range: 2.5, aperture: 0.5 }, grade: { bloom: 0.7, vig: 0.45 } });
  S.push({ id: 's4b', t0: 24.0, t1: 27.0, scene: 'park', look: 'science',
    cam: (t, lt) => { const k = E.inOutCubic(clamp(lt / 3)); const c = camPolar(0, 0, lerp(-0.45, -0.35, k), lerp(0, -0.1, k), lerp(1.5446, 1.18, k), lerp(6.1, 6.6, k), [0, 0, -1]); return { ...c, fov: 32, roll: lerp(0.0, -0.05, k) }; },
    setup: (t, lt, D) => { groundCmp(t, D, 1); axisLine(t, D, E.outCubic(prog(t, 26.9, 0.5)) * 0 ); }, dof: { on: true, range: 2.5, aperture: 0.5 }, grade: { bloom: 0.7, vig: 0.45 } });
  S.push({ id: 's4c', t0: 27.0, t1: 29.5, scene: 'park', look: 'science', trans: { type: 2, dur: 0.14, center: [0.5, 0.45] },
    cam: (t, lt) => { const k = E.inOutCubic(clamp(lt / 2.5)); const c = camPolar(0, lerp(0.0, 0.75, k), lerp(-0.35, -0.1, k), lerp(-0.1, Math.PI - 0.95, E.inOutQuart(clamp(lt / 2.5))), lerp(1.18, 0.30, k), lerp(6.6, 5.6, k)); return { ...c, fov: lerp(32, 34, k), roll: lerp(0, 0.06, Math.sin(k * Math.PI)) }; },
    setup: (t, lt, D) => { groundCmp(t, D, 1); axisLine(t, D, E.outCubic(prog(t, 26.9, 0.6))); }, dof: { on: true, range: 1.2, aperture: 0.7 }, grade: { bloom: 0.75, vig: 0.42 } });
  S.push({ id: 's4d', t0: 29.5, t1: 32.0, scene: 'park', look: 'science', trans: { type: 2, dur: 0.12, center: [0.5, 0.5] },
    cam: (t, lt) => { const k = E.inOutCubic(clamp(lt / 2.5)); const c = camPolar(0, 0.75, -0.1, lerp(Math.PI - 0.95, Math.PI - 0.50, k), lerp(0.30, 0.20, k), lerp(5.6, 5.0, k)); return { ...c, fov: 32, roll: lerp(0.04, -0.02, k) }; },
    setup: (t, lt, D) => { groundCmp(t, D, 1, { alpha: 1 - 0.3 * clamp((t - 31) / 1) }); axisLine(t, D, 1); }, dof: { on: true, range: 0.9, aperture: 0.8 }, grade: { bloom: 0.75, vig: 0.42 } });

  // ===== CENA 5 (32–39): plot twist =====
  const GL = [[32.0, 32.34], [33.9, 34.12], [35.58, 35.96], [37.3, 37.48]];
  const glitchAt = (t) => { let g = 0; for (const [a, b] of GL) if (t >= a && t < b) g = Math.max(g, 1 - (t - a) / (b - a) * 0.4); return g; };
  const errCompass = (t, D, rev, o = {}) => {
    if (D.dry) return;
    const h = D.headPos(); const c = D.cmpHead;
    c.group.visible = rev > 0.001; c.group.position.set(h.x + (o.dx ?? 0), h.y + (o.dy ?? 0.18), h.z - (o.dz ?? 0.95)); c.group.quaternion.copy(D.cam.quaternion); c.group.scale.setScalar(o.scale ?? 2.7);
    const snap = Math.floor(t * 8); const ang = (Math.sin(snap * 12.9898) * 43758.5453 % 1) * Math.PI * 2;
    c.draw({ t, reveal: rev, needle: o.calm ? ang * 0.2 : ang + Math.sin(t * 31) * 0.25, spin: Math.sin(t * 3) * 1.4, alpha: o.alpha ?? 0.9, glitch: o.glitch ?? 0.7, scan: t * 5, flicker: 0.5, burst: 0.0 });
  };
  const frz = (t) => (t >= 35.58 && t < 35.88 ? 1 : 0);
  S.push({ id: 's5a', t0: 32.0, t1: 34.2, scene: 'park', look: 'twist', trans: { type: 4, dur: 0.22, seed: 3 },
    cam: (t, lt, D) => { const h = D.headPos(); const k = E.inOutCubic(clamp(lt / 2.2)); const sh = shake(t, 0.006);
      return { pos: orbit(h, lerp(0.30, 0.04, k), lerp(0.02, 0.0, k), lerp(3.2, 2.1, k), [sh[0], sh[1], 0]), target: [h.x, h.y + 0.12, h.z], fov: lerp(27, 40, k), roll: lerp(0.14, -0.07, k) }; },
    setup: (t, lt, D) => { errCompass(t, D, clamp((t - 32.0) / 0.35), { glitch: 0.9 }); },
    grade: (t) => ({ glitch: glitchAt(t) * 0.8, contrast: 1.12, sat: 1.0, bloom: 0.65, vig: 0.5 }) });
  S.push({ id: 's5b', t0: 34.2, t1: 36.2, scene: 'park', look: 'twist',
    cam: (t, lt, D) => { const h = D.headPos(); const k = E.inOutCubic(clamp(lt / 2.0)); const sh = shake(t, 0.005);
      return { pos: orbit(h, lerp(-0.22, 0.1, k), lerp(0.03, 0.08, k), lerp(3.1, 3.5, k), [sh[0], sh[1], 0]), target: [h.x, h.y + 0.22, h.z], fov: 30, roll: lerp(-0.08, 0.06, k) }; },
    setup: (t, lt, D) => {
      errCompass(t, D, 1, { glitch: 0.5, dx: -0.55, dy: 0.1, dz: 1.2, scale: 1.7, alpha: 0.7 });
      const q = D.w.park.qMark; const p = E.spring(clamp((t - 34.45) / 0.9), 11, 0.38); const h = D.headPos();
      q.visible = t > 34.44; q.position.set(h.x + 0.44, h.y + 0.74 + Math.sin(t * 2.3) * 0.04, h.z - 0.8); q.quaternion.copy(D.cam.quaternion); q.rotateZ(Math.sin(t * 3.1) * 0.06 + (1 - p) * 0.4); q.scale.setScalar(Math.max(0.01, p) * 0.28);
    }, grade: (t) => ({ glitch: glitchAt(t) * 0.9, contrast: 1.12, sat: 1.0 - 0.8 * frz(t), desat: 0.6 * frz(t), bloom: 0.6, vig: 0.5, flash: 0.6 * Math.exp(-40 * Math.max(0, t - 35.58)) * (t >= 35.58 ? 1 : 0), flashCol: [0.8, 0.95, 1] }) });
  S.push({ id: 's5c', t0: 36.2, t1: 39.0, scene: 'park', look: 'twist',
    cam: (t, lt, D) => { const h = D.headPos(); const k = E.inOutCubic(clamp(lt / 2.8)); const sh = shake(t, 0.004);
      return { pos: orbit(h, lerp(0.1, -0.12, k), lerp(0.08, 0.14, k), lerp(3.5, 5.2, k), [sh[0], sh[1], 0]), target: [h.x, h.y + lerp(0.22, 0.05, k), h.z], fov: 30, roll: lerp(0.06, -0.03, k) }; },
    setup: (t, lt, D) => {
      errCompass(t, D, 1, { glitch: 0.35 * (1 - clamp((t - 37.6) / 1)), dx: -0.55, dy: 0.1, dz: 1.2, scale: 1.7, alpha: 0.65 * (1 - clamp((t - 38.2) / 0.7)), calm: t > 37.5 });
      const q = D.w.park.qMark; const h = D.headPos(); const out = 1 - E.inCubic(clamp((t - 38.35) / 0.6));
      q.visible = out > 0.01; q.position.set(h.x + 0.44, h.y + 0.74 + Math.sin(t * 2.3) * 0.04, h.z - 0.8); q.quaternion.copy(D.cam.quaternion); q.rotateZ(Math.sin(t * 3.1) * 0.06); q.scale.setScalar(0.28 * out);
    }, grade: (t) => ({ glitch: glitchAt(t) * 0.9, contrast: 1.1, sat: 1.0, bloom: 0.6, vig: 0.5 }) });

  // ===== CENA 6 (39–45): final viral =====
  const spinCompass = (t, D, rev, o = {}) => {
    if (D.dry) return;
    const h = D.headPos(); const c = D.cmpHead;
    c.group.visible = rev > 0.001; c.group.position.set(h.x + (o.dx ?? 0), h.y + (o.dy ?? 0.30), h.z - (o.dz ?? 0.7)); c.group.quaternion.copy(D.cam.quaternion); c.group.scale.setScalar(o.scale ?? 2.1);
    const spinT = (t - 39.2); const ang = spinT < 3.2 ? spinT * 7.5 * (1 - 0.65 * E.inOutCubic(clamp(spinT / 3.2))) : 3.2 * 7.5 * 0.675 + (spinT - 3.2) * 1.2;
    c.draw({ t, reveal: rev, needle: ang, spin: t * 0.5, alpha: o.alpha ?? 0.95, glitch: 0, scan: t * 2, flicker: 0.04, globe: clamp((t - 42.0) / 0.6), burst: 0.2 + 0.5 * Math.exp(-5 * Math.max(0, t - 43.4)) * (t > 43.4 ? 1 : 0) });
  };
  S.push({ id: 's6a', t0: 39.0, t1: 42.0, scene: 'park', look: 'golden', trans: { type: 2, dur: 0.2, center: [0.5, 0.45] },
    cam: (t, lt, D) => { const h = D.headPos(); const k = E.inOutCubic(clamp(lt / 3)); const sh = shake(t, 0.003);
      return { pos: orbit(h, lerp(-0.16, 0.06, k), lerp(0.05, 0.03, k), lerp(3.7, 3.15, k), [sh[0], sh[1], 0]), target: [h.x, h.y + 0.12, h.z], fov: 30, roll: lerp(0.02, -0.015, k) }; },
    setup: (t, lt, D) => spinCompass(t, D, clamp((t - 39.1) / 0.8)), grade: { bloom: 0.7 } });
  S.push({ id: 's6b', t0: 42.0, t1: 45.0, scene: 'park', look: 'golden', trans: { type: 2, dur: 0.14, center: [0.5, 0.5] },
    cam: (t, lt, D) => { const h = D.headPos(); const k = E.inOutCubic(clamp(lt / 3)); const sh = shake(t, 0.003);
      return { pos: orbit(h, lerp(0.08, -0.04, k), lerp(0.03, 0.05, k), lerp(2.9, 2.5, k), [sh[0], sh[1], 0]), target: [h.x, h.y + 0.10, h.z], fov: 30, roll: lerp(-0.02, 0.025, k) }; },
    setup: (t, lt, D) => spinCompass(t, D, 1, { dy: 0.34, scale: 2.0 }), grade: { bloom: 0.7 } });

  S.sort((a, b) => a.t0 - b.t0);
  return S;
}
