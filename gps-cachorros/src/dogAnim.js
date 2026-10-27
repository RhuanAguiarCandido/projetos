// Animação do cachorro como função pura do tempo global (s). Sem estado: qualquer quadro pode ser renderizado isoladamente.
import { clamp, E, lerp } from './typography.js';

export const BEAT = 0.5; // 120 BPM

const BLINKS = [0.9, 2.55, 4.3, 5.8, 7.6, 9.9, 11.6, 21.7, 24.8, 27.6, 30.1, 32.9, 35.4, 37.6, 40.2, 42.6, 44.1];
export function blinkAt(t) {
  let v = 0;
  for (const b of BLINKS) { const d = t - b; if (d >= 0 && d < 0.17) v = Math.max(v, Math.sin((Math.PI * d) / 0.17)); }
  return v;
}
const beatPulse = (t) => Math.exp(-9 * (((t % BEAT) + BEAT) % BEAT));

// integral numérica de uma função de velocidade angular (tabela 1/240 s) -> posição
const TAB = { dt: 1 / 240, n: 45 * 240 + 1 };
function makeIntegral(fn) {
  const a = new Float64Array(TAB.n); let s = 0;
  for (let i = 1; i < TAB.n; i++) { s += 0.5 * (fn((i - 1) * TAB.dt) + fn(i * TAB.dt)) * TAB.dt; a[i] = s; }
  return (t) => { const x = clamp(t, 0, 45) / TAB.dt, i = Math.floor(x), f = x - i; return a[i] * (1 - f) + a[Math.min(i + 1, TAB.n - 1)] * f; };
}

// ---- Cena 2: velocidade angular ao circular (rad/s) ----
function omega2(t) {
  const ramp = (a, b) => clamp((t - a) / (b - a));
  let w = 0;
  w += E.inOutCubic(ramp(5.0, 5.7)) * 4.3;                  // entra trotando em círculo
  w += E.inOutCubic(ramp(7.2, 8.6)) * 2.3;                  // acelera (cômico)
  w -= E.inOutCubic(ramp(9.5, 10.6)) * 6.0;                 // freia
  if (t > 10.5) w += 0.0;
  return Math.max(w, 0);
}
const theta2 = makeIntegral(omega2);

// ---- Cena 4: guinada do cão até o eixo norte-sul (yaw = PI aponta para o Norte, -Z) ----
function yaw4(t) {
  const a0 = 2.25;                                              // orientação inicial "aleatória"
  const k = E.inOutCubic(clamp((t - 24.7) / 2.7));              // assenta no eixo
  const base = lerp(a0, Math.PI, k);
  const search = 0.55 * Math.sin(clamp((t - 22.3) / 2.4) * Math.PI) + 0.13 * Math.sin(t * 1.9) * (1 - k);   // procura o lugar
  const settle = Math.sin(clamp((t - 24.7) / 2.7) * Math.PI * 3) * 0.05 * (1 - k);
  return base + search * (1 - k * 0.6) + settle;
}
export const circleAngle = (t) => theta2(t);

// pose-base (respiração, piscar, rabo) comum
function idle(t, o = {}) {
  const wagF = o.wagF ?? 3.4;
  const bp = beatPulse(t) * (o.beat ?? 1);
  return {
    breathe: Math.sin(t * 2.3), blink: blinkAt(t), tailWag: o.wag ?? 1, tailPhase: t * wagF * Math.PI * 2, tailLift: o.tailLift ?? 0.3,
    bob: bp * 0.012, squash: bp * 0.35, earL: 0, earR: 0, mouth: 0.2 + 0.05 * Math.sin(t * 5), smile: 1,
  };
}

export function dogState(t) {
  const S = { x: 0, z: 0, yaw: 0, pose: {} };
  const P = (S.pose = idle(t));
  const ramp = (a, b) => clamp((t - a) / (b - a));

  if (t < 5.0) {
    // ----- CENA 1: senta de frente para a câmera, curiosidade e olhar para a bússola -----
    P.sit = 1; S.yaw = 0;
    const tilt = E.inOutCubic(ramp(1.35, 1.8)) - E.inOutCubic(ramp(3.0, 3.5));
    P.headRoll = 0.30 * tilt + Math.sin(t * 1.7) * 0.015;
    P.headYaw = -0.30 * E.inOutCubic(ramp(1.9, 2.3)) * (1 - E.inOutCubic(ramp(3.3, 3.7)));   // olha para a câmera no plano 3/4
    const up = E.inOutCubic(ramp(2.35, 2.75)) - E.inOutCubic(ramp(4.0, 4.5));
    P.headPitch = -0.16 * up + 0.04 * beatPulse(t);
    P.lookY = 0.95 * up; P.lookX = 0.1 * Math.sin(t * 1.3) * (1 - up);
    P.brow = 0.25 + 0.55 * up; P.lid = 0.16 - 0.16 * up;
    P.mouth = 0.30 + 0.08 * Math.sin(t * 6); P.tongue = 0.55;
    P.earPerk = 0.25 * up; P.earL = Math.sin(t * 3) * 0.1; P.earR = Math.cos(t * 3.1) * 0.1;
    // pulinho quando a bússola surge
    const hop = Math.exp(-10 * Math.max(t - 2.45, 0)) * (t > 2.45 ? 1 : 0);
    P.bob += hop * 0.05; P.squash = -hop * 0.5 + beatPulse(t) * 0.3;
  } else if (t < 12.0) {
    // ----- CENA 2: gira, gira, gira procurando o lugar -----
    const th = theta2(t); const R = 0.62;
    const live = ramp(5.0, 5.35);
    S.x = Math.sin(th) * R * live; S.z = (Math.cos(th) - 1) * R * live - 0.0;
    S.yaw = Math.atan2(Math.cos(th), -Math.sin(th));
    const w = omega2(t);
    const arc = th * R;
    P.sit = 0; P.gaitAmp = clamp(w / 3.5, 0, 1) * 1.1; P.gait = (arc / 0.52) * Math.PI * 2;
    P.roll = clamp(w * 0.03, 0, 0.2); P.pitch = 0.04;
    const sniff = Math.sin(t * 9) * 0.5 + 0.5;
    P.headPitch = 0.32 + 0.12 * sniff * (w > 0.5 ? 1 : 0); P.neckPitch = 0.15;
    P.mouth = 0.12; P.tongue = 0.0; P.brow = 0.3; P.lid = 0.1;
    P.lookX = 0.0; P.lookY = -0.4;
    P.tailLift = 0.5; P.tailWag = 1; P.bob = Math.abs(Math.sin(P.gait)) * 0.03 * P.gaitAmp + beatPulse(t) * 0.01;
    P.earL = clamp(w * 0.15, 0, 0.9); P.earR = clamp(w * 0.15, 0, 0.9);
    // tontura no final (cabeça balança, olhos em espiral)
    const diz = ramp(9.7, 10.4);
    if (diz > 0) {
      P.roll = 0.12 * Math.sin(t * 5) * diz; P.headRoll = 0.18 * Math.sin(t * 4.1) * diz;
      P.lookX = Math.cos(t * 17) * 0.9 * diz; P.lookY = Math.sin(t * 17) * 0.9 * diz; P.tongue = 0.8 * diz; P.mouth = 0.3 * diz; P.brow = 0.6 * diz; P.browTilt = 0.4 * diz;
      P.lid = 0.05;
    }
    if (t > 10.5) { S.x = lerp(S.x, 0, 0); P.gaitAmp *= clamp(1 - (t - 10.5) * 2); }
  } else if (t < 21.0) {
    // espaço: cachorro fora de cena (apenas aquecimento do estado)
    P.sit = 0; S.yaw = 0;
  } else if (t < 32.0) {
    // ----- CENA 4: de pé, vista do alto; gira até o eixo norte-sul -----
    S.yaw = yaw4(t); P.sit = 0; P.headPitch = 0.28; P.neckPitch = 0.1; P.lookY = -0.5; P.mouth = 0.12; P.tongue = 0; P.brow = 0.2;
    P.tailLift = 0.35; P.tailWag = 1;
    const sn = Math.sin(t * 8) * 0.5 + 0.5; P.headPitch += sn * 0.1 * (t < 25.5 ? 1 : 0.2);
    // pequeno passeio enquanto se orienta
    const moving = t > 22.2 && t < 27.4;
    P.gaitAmp = moving ? 0.35 * (1 - E.inOutCubic(ramp(26.6, 27.4))) : 0; P.gait = t * 7.5;
    // alinhado: levanta o focinho, orgulhoso, rabo abanando
    const done = E.inOutCubic(ramp(27.4, 28.2));
    P.headPitch = lerp(P.headPitch, -0.05, done); P.lookY = lerp(P.lookY, 0.1, done); P.mouth = lerp(0.12, 0.35, done); P.tongue = 0.5 * done; P.brow = lerp(0.2, 0.45, done);
  } else if (t < 39.0) {
    // ----- CENA 5: confuso (inclina a cabeça, olha de lado, sobrancelhas preocupadas) -----
    P.sit = 1; S.yaw = 0.0; P.tailWag = 0.5; P.beat = 0;
    const a = E.inOutCubic(ramp(32.0, 32.5));
    const swing = Math.sin((t - 32.5) * 1.5);
    P.headRoll = (0.34 * Math.sin((t - 32.0) * 1.25) + 0.1) * a;
    P.lookX = Math.sin((t - 32.0) * 2.2) * 0.85 * a; P.lookY = 0.25 * Math.sin((t - 32) * 1.7) * a;
    P.browTilt = 0.85 * a; P.brow = 0.55 * a; P.lid = 0.12; P.mouth = 0.08; P.smile = 0.2; P.tongue = 0; P.earPerk = 0.15;
    P.headYaw = 0.28 * Math.sin((t - 32.0) * 1.05) * a;
    P.squash = 0; P.bob = 0; P.tailLift = 0.15;
    P.earL = swing * 0.3; P.earR = -swing * 0.3;
  } else {
    // ----- CENA 6: final -----
    P.sit = 1; S.yaw = 0;
    const tilt = E.outBack(ramp(43.35, 43.8), 2.2);
    P.headRoll = 0.32 * tilt + Math.sin(t * 1.3) * 0.012;
    P.brow = 0.3 + 0.3 * tilt; P.mouth = 0.35 + 0.06 * Math.sin(t * 6); P.tongue = 0.6; P.lid = 0.14; P.earPerk = 0.1 + 0.2 * tilt;
    P.lookX = 0.0; P.lookY = 0.0; P.earL = Math.sin(t * 2.7) * 0.12; P.earR = Math.cos(t * 2.9) * 0.12;
    P.headPitch = -0.03;
  }
  return S;
}
