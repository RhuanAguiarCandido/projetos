// Direção do cão: pose e posição como função pura do tempo (determinístico).
import { clamp, smooth, TAU, hash1 } from '../kit/util.js';

const DEFAULT = { bob: 0, pitch: 0, roll: 0, sit: 0, gait: 0, gaitAmp: 0, neckPitch: 0, headYaw: 0, headPitch: 0, headRoll: 0, lookX: 0, lookY: 0, blink: 0, lid: 0.12, brow: 0, browTilt: 0, mouth: 0.15, tongue: 0, smile: 1, tailWag: 1, tailPhase: 0, tailLift: 0.3, earL: 0, earR: 0, earPerk: 0, breathe: 0, squash: 0, dizzy: 0, time: 0, flash: 0, opacity: 1 };

// ângulo acumulado do giro (5 s -> 12 s), pré-integrado
const T0 = 5, T1 = 12, DT = 1 / 600; const TH = [0];
const omega = (u) => TAU / 1.15 * smooth(u / 0.9) * (1 - smooth((u - 5.0) / 1.7));
for (let i = 1; i <= Math.round((T1 - T0) / DT); i++) TH.push(TH[i - 1] + omega((i - 0.5) * DT) * DT);
export const theta = (t) => { const x = clamp((t - T0) / DT, 0, TH.length - 1.001); const i = Math.floor(x); return TH[i] + (TH[i + 1] - TH[i]) * (x - i); };
export const omegaAt = (t) => omega(t - T0);

// instante do giro em que o cão fica de 3/4 para a câmera (usado no congelamento da cena 5)
export const FREEZE_T = (() => { let best = 10.2, bd = 9; for (let t = 9.4; t < 11.0; t += 1 / 240) { const a = ((theta(t) % TAU) + TAU) % TAU; const d = Math.abs(a - 5.498); if (d < bd) { bd = d; best = t; } } return best; })();
const blinkAt = (t) => { let b = 0; for (const k of [0.8, 2.9, 4.4, 6.1, 8.3, 9.9, 13, 18.2, 19.7, 28, 29.4, 33.5, 36.1, 38.2, 40.6, 43.1]) { const x = (t - k) / 0.16; if (x > 0 && x < 1) b = Math.max(b, Math.sin(x * Math.PI)); } return b; };

export function dogPose(t, dog, mode = {}) {
  const s = dog.s; Object.assign(s, DEFAULT);
  const r = dog.root; r.position.set(0, 0, 0); r.rotation.set(0, 0, 0); r.scale.setScalar(1);
  s.time = t; s.breathe = Math.sin(t * 2.4); s.blink = blinkAt(t); s.tailPhase = t * 9.5; s.earL = Math.sin(t * 3.1) * 0.25; s.earR = Math.sin(t * 3.4 + 1) * 0.25;
  const w = (a, b) => smooth((t - a) / (b - a));
  if (t < 5) {                                           // S1: senta e inclina a cabeça, curioso
    s.sit = 1; s.mouth = 0.22; s.tongue = 0.35 * w(1.4, 1.9); s.headYaw = 0.12 * Math.sin(t * 1.3); s.headPitch = -0.05 + 0.1 * w(2.4, 2.7); s.headRoll = 0.34 * w(2.4, 2.9) * (1 + 0.05 * Math.sin(t * 4)); s.brow = 0.7 * w(1.4, 1.7) + 0.3 * w(2.6, 3); s.browTilt = 0.4 * w(2.6, 3.0);
    s.earPerk = 0.7 * w(1.45, 1.7); s.tailWag = 0.9; s.tailLift = 0.15; s.lookX = 0.15 * Math.sin(t * 1.1);
    s.squash = 0.35 * Math.max(0, 1 - Math.abs(t - 1.5) * 8);
    if (mode.sitFace) r.rotation.y = mode.sitFace;
  } else if (t < 12) {                                   // S2: gira em círculos
    const u = t - T0, th = theta(t), R = 0.8;
    const om = omega(u), spd = clamp(om / (TAU / 1.15), 0, 1);
    r.position.set(Math.sin(th) * R, 0, Math.cos(th) * R - R * 0); r.rotation.y = th + Math.PI / 2;
    s.sit = 1 - w(5.0, 5.35); s.gaitAmp = spd * 1.0 * (1 - 0.0); s.gait = th * 4.2; s.bob = spd * 0.035 * Math.abs(Math.sin(th * 4.2)); s.roll = -0.2 * spd; s.pitch = 0.05 * spd;
    s.mouth = 0.35; s.tongue = 0.6 * spd; s.tailWag = 1.2; s.tailLift = 0.55 * spd + 0.15; s.earPerk = 0; s.earL = 0.5 * spd; s.earR = 0.5 * spd; s.neckPitch = 0.05; s.headYaw = -0.25 * spd; s.lookX = -0.6 * spd;
    const dz = w(10.6, 11.2); s.dizzy = dz; s.roll += Math.sin(t * 6) * 0.18 * dz * (1 - spd); s.headRoll = Math.sin(t * 5.5) * 0.25 * dz; s.lid = 0.3 * dz + 0.12; s.tongue = Math.max(s.tongue, 0.9 * dz); s.mouth = 0.5 * dz + 0.35 * (1 - dz);
    if (u < 0.35) { s.sit = 1 - w(5.0, 5.35); }
  } else if (t < 21) {                                   // S3 (parque): senta e olha o céu/bússola
    s.sit = 1; s.mouth = 0.2; s.tailWag = 0.8; s.tailLift = 0.12; const up = w(17.4, 18.2); s.headPitch = -0.38 * up; s.lookY = 0.7 * up; s.headRoll = 0.12 * Math.sin(t * 0.9); s.brow = 0.5 * up; s.earPerk = 0.5 * up;
    r.rotation.y = 0.25 * Math.sin(t * 0.4) - 0.35;
  } else if (t < 32) {                                   // S4: em pé sobre a bússola olhando ao Norte (-Z)
    s.sit = 0; s.gaitAmp = 0; r.rotation.y = 0; r.scale.setScalar(0.8); s.mouth = 0.25; s.tongue = 0.2; s.tailWag = 0.5; s.headYaw = 0.35 * Math.sin((t - 27.5) * 1.1) * w(27.5, 28.2); s.lookX = 0.5 * Math.sin((t - 27.5) * 1.1); s.earPerk = 0.35; s.brow = 0.3;
    s.tailLift = 0.5;
  } else if (t < 39) {                                   // S5: congelado em meio à volta, depois confuso
    if (t < 35) {
      const th = theta(FREEZE_T), R = 0.8; r.position.set(Math.sin(th) * R, 0, Math.cos(th) * R); r.rotation.y = th + Math.PI / 2;
      s.sit = 0; s.gaitAmp = 0.9; s.gait = th * 4.2; s.bob = 0.02; s.roll = -0.22; s.mouth = 0.5; s.tongue = 0.8; s.dizzy = 1; s.lid = 0.3; s.time = 32.5 + (t - 32) * 0.0; s.tailWag = 0; s.tailLift = 0.5; s.earL = 0.4; s.earR = 0.4; s.headYaw = -0.2; s.lookX = -0.5;
      s.tailPhase = 3.0; s.breathe = 0; s.blink = 0;
      const sh = t < 32.6 ? (Math.sin((t - 32) * 90) * 0.012) : 0; r.position.x += sh;
    } else {
      const k = w(35, 35.6); s.sit = 1; s.mouth = 0.12; s.dizzy = 1 - w(35, 35.5); s.headRoll = 0.38 * k + Math.sin(t * 2.2) * 0.05; s.brow = 0.8; s.browTilt = 0.7 * k; s.lookX = 0.8 * Math.sin(t * 1.6); s.lookY = 0.25; s.tailWag = 0.25; s.tailLift = 0.05; s.earPerk = 0.2; s.lid = 0.14; s.headYaw = 0.1 * Math.sin(t * 1.6);
      s.neckPitch = 0.03; r.rotation.y = -0.2;
    }
  } else {                                               // S6: feliz — pula, depois senta sorrindo
    if (t < 42.2) {
      const u = (t - 39.2); const hop = Math.abs(Math.sin(Math.max(0, u) * Math.PI * 1.1)); const air = Math.pow(hop, 0.85);
      s.sit = 0; s.bob = 0.28 * air * (u > 0 ? 1 : 0); s.squash = 0.4 * (1 - air) * smooth(1 - Math.abs(u - 0.0) / 3) - 0.25 * air; s.gaitAmp = 0.3 * air; s.gait = t * 8; s.mouth = 0.55; s.tongue = 0.9; s.tailWag = 1.6; s.tailLift = 0.7; s.earL = 0.6 * air; s.earR = 0.6 * air; s.brow = 0.6; s.smile = 1.6; s.headRoll = 0.15 * Math.sin(t * 6); s.lid = 0.1;
      if (u < 0) { s.sit = 1; }
    } else {
      s.sit = 1; s.mouth = 0.45; s.tongue = 0.8; s.tailWag = 1.6; s.tailLift = 0.5; s.smile = 1.6; s.brow = 0.4; s.headRoll = 0.2 * Math.sin(t * 1.4); s.earPerk = 0.3;
    }
  }
  dog.update();
}
