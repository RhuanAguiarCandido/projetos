// O golden retriever: personagem 3D procedural com rig completo.
// Mesma geometria/paleta em todas as cenas (consistência de identidade); só a pose muda.
import * as THREE from 'three';
import { furMesh, ellipsoid } from './fur.js';

const C = {
  root: '#9a5410', mid: '#e29a28', tip: '#ffd270', cream: '#fdebb8', earRoot: '#85430c', earMid: '#cd8420', earTip: '#f3b64e',
  nose: '#120c0b', muzzleDark: '#4a2a12',
};

function mkEyeTexture() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 256;
  const g = c.getContext('2d');
  // v (eixo y) = raio a partir do centro da íris; u (eixo x) = ângulo
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0.00, '#050302'); grad.addColorStop(0.34, '#080403');       // pupila
  grad.addColorStop(0.40, '#2a1306'); grad.addColorStop(0.55, '#5e2d0c');       // anel interno
  grad.addColorStop(0.78, '#a35e1d'); grad.addColorStop(0.92, '#6a3510');       // íris
  grad.addColorStop(1.00, '#1a0b04');                                           // limbo escuro
  g.fillStyle = grad; g.fillRect(0, 0, 256, 256);
  // estrias da íris (determinístico: sem Math.random)
  let sd = 12345; const rnd = () => (sd = (sd * 1664525 + 1013904223) >>> 0) / 4294967296;
  for (let i = 0; i < 90; i++) {
    const x = rnd() * 256, h = 40 + rnd() * 120, y = 70 + rnd() * 100;
    g.fillStyle = `rgba(${230 + rnd() * 25},${150 + rnd() * 60},${50 + rnd() * 40},${0.05 + rnd() * 0.09})`;
    g.fillRect(x, y, 2 + rnd() * 3, h * 0.6);
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; t.anisotropy = 4;
  return t;
}

export class Dog {
  constructor() {
    this.root = new THREE.Group();
    const fur = (geo, o) => furMesh(geo, { root: C.root, mid: C.mid, tip: C.tip, accent: C.cream, ...o });
    const add = (parent, mesh, x = 0, y = 0, z = 0) => { mesh.position.set(x, y, z); parent.add(mesh); return mesh; };

    // ---------------- corpo ----------------
    this.body = new THREE.Group(); this.root.add(this.body);
    this.torso = add(this.body, fur(ellipsoid(0.30, 0.30, 0.40), { flow: [0, -0.2, -1.0], len: 0.05, density: 120, gradDir: [0, -1, 0], gradRange: [0.12, 0.30] }), 0, 0.67, -0.02);
    this.chest = add(this.body, fur(ellipsoid(0.285, 0.32, 0.27), { flow: [0, -1.0, 0.2], len: 0.09, density: 100, gradDir: [0, 0, 1], gradRange: [0.02, 0.2] }), 0, 0.61, 0.20);
    this.hips = add(this.body, fur(ellipsoid(0.29, 0.29, 0.25), { flow: [0, -0.4, -1.0], len: 0.06, density: 120, gradDir: [0, -1, 0], gradRange: [0.15, 0.30] }), 0, 0.64, -0.27);
    this.ruff = add(this.body, fur(ellipsoid(0.245, 0.29, 0.23), { flow: [0, -1.0, -0.2], len: 0.09, density: 100, gradDir: [0, 0, 1], gradRange: [0.0, 0.2] }), 0, 0.90, 0.30);
    // franjas (penugem de golden) na barriga e atrás das patas
    add(this.body, fur(ellipsoid(0.17, 0.07, 0.30), { len: 0.10, density: 90, root: '#9a6420', mid: '#e8b865', tip: '#fff0c4' }), 0, 0.40, 0.0);

    // ---------------- cabeça ----------------
    this.neck = new THREE.Group(); this.neck.position.set(0, 0.93, 0.34); this.body.add(this.neck);
    this.head = new THREE.Group(); this.head.position.set(0, 0.22, 0.12); this.neck.add(this.head);
    const H = this.head;
    add(H, fur(ellipsoid(0.34, 0.31, 0.31, 36, 24), { flow: [0, -0.3, -1.0], len: 0.03, density: 190 }), 0, 0, 0);
    for (const s of [1, -1]) add(H, fur(ellipsoid(0.15, 0.13, 0.155), { len: 0.04, density: 150, gradDir: [0, -1, 0], gradRange: [-0.02, 0.1] }), 0.205 * s, -0.10, 0.07);
    add(H, fur(ellipsoid(0.15, 0.07, 0.15), { len: 0.045, density: 170 }), 0, 0.27, 0.02);   // topete
    // focinho (largo, com a ponta mais escura)
    this.muzzle = add(H, fur(ellipsoid(0.155, 0.118, 0.215, 36, 24), { len: 0.014, density: 260, root: '#5a2c0a', mid: '#c27a1c', tip: '#f0b24c', accent: C.muzzleDark, gradDir: [0, 0, 1], gradRange: [0.12, 0.21] }), 0, -0.07, 0.29);
    // nariz + narinas
    const noseMat = new THREE.MeshStandardMaterial({ color: C.nose, roughness: 0.22, metalness: 0.0 });
    add(H, new THREE.Mesh(ellipsoid(0.082, 0.056, 0.060, 28, 20), noseMat), 0, -0.016, 0.495);
    const nose2 = new THREE.MeshBasicMaterial({ color: '#000000' });
    for (const s of [1, -1]) add(H, new THREE.Mesh(ellipsoid(0.014, 0.010, 0.012, 10, 8), nose2), 0.034 * s, -0.026, 0.548);
    const nhl = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.85 });
    add(H, new THREE.Mesh(ellipsoid(0.024, 0.009, 0.014, 10, 8), nhl), 0.022, 0.016, 0.532);

    // linha da boca (sorriso)
    this.smileMat = new THREE.MeshBasicMaterial({ color: '#2b1608' });
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, -0.045, 0.50), new THREE.Vector3(0, -0.085, 0.495), new THREE.Vector3(0.0, -0.125, 0.46),
      new THREE.Vector3(0.075, -0.155, 0.42), new THREE.Vector3(0.14, -0.140, 0.36), new THREE.Vector3(0.175, -0.110, 0.29),
    ]);
    this.smile = new THREE.Group(); H.add(this.smile);
    const tubeR = new THREE.Mesh(new THREE.TubeGeometry(curve, 24, 0.0062, 6, false), this.smileMat);
    const mirror = new THREE.Mesh(tubeR.geometry, this.smileMat); mirror.scale.x = -1;
    this.smile.add(tubeR, mirror);

    // mandíbula + interior + língua
    this.jaw = new THREE.Group(); this.jaw.position.set(0, -0.115, 0.14); H.add(this.jaw);
    const mouthMat = new THREE.MeshStandardMaterial({ color: '#5b1020', roughness: 0.6 });
    add(this.jaw, new THREE.Mesh(ellipsoid(0.098, 0.03, 0.17, 24, 12), mouthMat), 0, 0.03, 0.17);
    add(this.jaw, fur(ellipsoid(0.108, 0.05, 0.18, 28, 16), { len: 0.012, density: 260, root: '#8a5014', mid: '#e1b060', tip: '#fbe4a6', gradDir: [0, -1, 0], gradRange: [-0.05, 0.03] }), 0, -0.01, 0.17);
    this.tongue = new THREE.Group(); this.tongue.position.set(0, 0.035, 0.08); this.jaw.add(this.tongue);
    const tonMat = new THREE.MeshStandardMaterial({ color: '#ff6b8e', roughness: 0.45 });
    add(this.tongue, new THREE.Mesh(ellipsoid(0.060, 0.016, 0.125, 24, 12, (v) => { v.y += Math.max(0, v.z) * -0.08 * (v.z / 0.125); }), tonMat), 0, 0, 0.10);
    add(this.tongue, new THREE.Mesh(ellipsoid(0.006, 0.004, 0.10, 8, 6), new THREE.MeshBasicMaterial({ color: '#d63e66' })), 0, 0.016, 0.11);

    // olhos grandes e expressivos
    const eyeTex = mkEyeTexture();
    const eyeMat = new THREE.MeshStandardMaterial({ color: '#1b0d06', roughness: 0.12, metalness: 0.0 });
    const irisMat = new THREE.MeshStandardMaterial({ map: eyeTex, roughness: 0.14, metalness: 0.0 });
    const hiTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); const r = g.createRadialGradient(32, 32, 2, 32, 32, 30); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.55, 'rgba(255,255,255,0.95)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
    const hiMat = new THREE.MeshBasicMaterial({ map: hiTex, transparent: true, depthWrite: false, toneMapped: false });
    const lidMat = new THREE.MeshStandardMaterial({ color: '#d28a24', roughness: 0.85 });
    this.eyes = [];
    for (const s of [1, -1]) {
      const eye = new THREE.Group(); eye.position.set(0.148 * s, 0.066, 0.236); eye.rotation.y = 0.10 * s; H.add(eye);
      const ball = new THREE.Group(); eye.add(ball);
      const R = 0.082;
      ball.add(new THREE.Mesh(new THREE.SphereGeometry(R, 32, 24), eyeMat));
      const cap = new THREE.Mesh(new THREE.SphereGeometry(R * 1.004, 40, 20, 0, Math.PI * 2, 0, 1.0), irisMat);
      cap.rotation.x = Math.PI / 2; ball.add(cap);   // polo (+Y) vira +Z (frente)
      // brilhos (ficam na cabeça, não giram com o olho -> olhar "molhado")
      const h1 = new THREE.Mesh(new THREE.PlaneGeometry(0.052, 0.056), hiMat); h1.position.set(0.024, 0.030, R * 1.015); h1.renderOrder = 3; eye.add(h1);
      const h2 = new THREE.Mesh(new THREE.PlaneGeometry(0.024, 0.024), hiMat); h2.position.set(-0.030, -0.034, R * 1.0); h2.renderOrder = 3; eye.add(h2);
      const lidFur = { len: 0.014, density: 260, shells: 14, root: '#9a5410', mid: '#e29a28', tip: '#ffd270' };
      const upper = new THREE.Group(); eye.add(upper);
      upper.add(furMesh(new THREE.SphereGeometry(R * 1.08, 28, 14, 0, Math.PI * 2, 0, 1.5708), lidFur));
      const lower = new THREE.Group(); eye.add(lower);
      lower.add(furMesh(new THREE.SphereGeometry(R * 1.07, 28, 12, 0, Math.PI * 2, Math.PI - 0.9, 0.9), lidFur));
      this.eyes.push({ eye, ball, upper, lower, s });
    }
    // sobrancelhas
    this.brows = [];
    for (const s of [1, -1]) {
      const b = fur(ellipsoid(0.050, 0.018, 0.030, 20, 12), { len: 0.016, density: 300, root: '#8a4c10', mid: '#e9a72e', tip: '#ffd77a' });
      const g = new THREE.Group(); g.position.set(0.152 * s, 0.185, 0.262); g.add(b); H.add(g); this.brows.push({ g, s });
    }
    // orelhas caídas (grandes, penduradas ao lado das bochechas)
    this.ears = [];
    for (const s of [1, -1]) {
      const pivot = new THREE.Group(); pivot.position.set(0.30 * s, 0.12, -0.02); H.add(pivot);
      const flap = new THREE.Group(); pivot.add(flap);
      const e = fur(ellipsoid(0.055, 0.27, 0.165, 28, 24, (v, n, x, y, z) => { const t = (-v.y / 0.27) * 0.5 + 0.5; v.z *= 1 - 0.25 * t; v.x += 0.02 * s * t; }), { len: 0.04, density: 110, root: C.earRoot, mid: C.earMid, tip: C.earTip });
      add(flap, e, 0.035 * s, -0.24, 0.0);
      this.ears.push({ pivot, flap, s });
    }

    // ---------------- patas ----------------
    this.legs = [];
    const mkLeg = (x, y, z, front) => {
      const hip = new THREE.Group(); hip.position.set(x, y, z); this.body.add(hip);
      const up = front
        ? fur(ellipsoid(0.098, 0.18, 0.108), { len: 0.03, density: 140, gradDir: [0, 1, 0], gradRange: [-0.2, 0.1] })
        : fur(ellipsoid(0.125, 0.21, 0.15), { len: 0.045, density: 130, gradDir: [0, 1, 0], gradRange: [-0.25, 0.15] });
      add(hip, up, 0, front ? -0.14 : -0.12, front ? 0 : -0.02);
      const knee = new THREE.Group(); knee.position.set(0, front ? -0.29 : -0.27, front ? 0 : 0.03); hip.add(knee);
      add(knee, fur(ellipsoid(0.078, 0.15, 0.084), { len: 0.026, density: 150, gradDir: [0, -1, 0], gradRange: [-0.02, 0.1] }), 0, -0.12, 0);
      const paw = new THREE.Group(); paw.position.set(0, -0.25, 0); knee.add(paw);
      add(paw, fur(ellipsoid(0.092, 0.054, 0.12), { len: 0.026, density: 170, root: '#8a5412', mid: '#e8b563', tip: '#fbe4a6' }), 0, 0.0, 0.035);
      for (const dx of [-0.04, 0, 0.04]) add(paw, new THREE.Mesh(ellipsoid(0.018, 0.012, 0.02, 8, 6), new THREE.MeshStandardMaterial({ color: '#241410', roughness: 0.5 })), dx, -0.012, 0.155);
      // franja atrás da pata dianteira
      if (front) add(hip, fur(ellipsoid(0.04, 0.16, 0.05), { len: 0.075, density: 100, root: '#9a6420', mid: '#e8b865', tip: '#fff0c4' }), 0, -0.18, -0.085);
      const leg = { hip, knee, paw, front, side: Math.sign(x) };
      this.legs.push(leg); return leg;
    };
    mkLeg(0.155, 0.58, 0.24, true); mkLeg(-0.155, 0.58, 0.24, true);
    mkLeg(0.175, 0.58, -0.29, false); mkLeg(-0.175, 0.58, -0.29, false);

    // ---------------- rabo (plumagem de golden, 5 segmentos) ----------------
    this.tail = []; let parent = new THREE.Group(); parent.position.set(0, 0.78, -0.46); this.body.add(parent); this.tailRoot = parent;
    for (let i = 0; i < 5; i++) {
      const seg = new THREE.Group(); if (i > 0) seg.position.set(0, 0, -0.17); parent.add(seg);
      add(seg, fur(ellipsoid(0.07 - i * 0.004, 0.07 - i * 0.004, 0.125, 24, 16), { len: 0.095, density: 100, gradDir: [0, -1, 0], gradRange: [0.02, 0.07], root: '#7a3e0a', tip: '#ffe29a' }), 0, 0, -0.085);
      this.tail.push(seg); parent = seg;
    }

    this.shadow = this._mkShadow(); this.root.add(this.shadow);
    this.pose = {};
    this.setPose({});
  }

  _mkShadow() {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d'); const r = g.createRadialGradient(64, 64, 4, 64, 64, 62);
    r.addColorStop(0, 'rgba(0,10,10,0.75)'); r.addColorStop(0.55, 'rgba(0,10,10,0.35)'); r.addColorStop(1, 'rgba(0,10,10,0)');
    g.fillStyle = r; g.fillRect(0, 0, 128, 128);
    const t = new THREE.CanvasTexture(c);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, toneMapped: false }));
    m.rotation.x = -Math.PI / 2; m.position.y = 0.012; m.scale.set(1.35, 1.9, 1); m.renderOrder = 1;
    return m;
  }

  // p: pose normalizada. Tudo é função pura do estado -> render determinístico.
  setPose(p) {
    const d = {
      bob: 0, pitch: 0, roll: 0, sit: 0, gait: 0, gaitAmp: 0,
      neckPitch: 0, headYaw: 0, headPitch: 0, headRoll: 0,
      lookX: 0, lookY: 0, blink: 0, lid: 0.18, brow: 0, browTilt: 0, mouth: 0.15, tongue: 0, smile: 1,
      tailWag: 0, tailPhase: 0, tailLift: 0.3, earL: 0, earR: 0, earPerk: 0, breathe: 0, squash: 0,
    };
    const q = Object.assign(d, p); this.pose = q;
    const sit = q.sit;

    // corpo
    this.body.position.y = q.bob - sit * 0.21;
    this.body.rotation.x = -q.pitch - sit * 0.50;
    this.body.rotation.z = q.roll;
    const br = 1 + q.breathe * 0.012, sq = q.squash;
    this.body.scale.set(1 + sq * 0.05, br * (1 - sq * 0.08), 1 - sq * 0.02);
    this.shadow.scale.set(1.35 * (1 - sit * 0.1), 1.9 * (1 - sit * 0.25), 1);

    // pescoço/cabeça
    this.neck.rotation.x = q.neckPitch + sit * 0.42;
    this.head.rotation.set(q.headPitch, q.headYaw, q.headRoll, 'YXZ');

    // olhos / pálpebras: c = 0 aberto, 1 fechado
    const c = THREE.MathUtils.clamp(1 - (1 - q.blink) * (1 - q.lid), 0, 1);
    for (const e of this.eyes) {
      e.ball.rotation.set(-q.lookY * 0.35, q.lookX * 0.45, 0);
      e.upper.rotation.x = THREE.MathUtils.lerp(-1.20, 1.05, c);
      e.lower.rotation.x = -THREE.MathUtils.smoothstep(c, 0.35, 1.0) * 0.85;
    }
    // sobrancelhas: brow>0 sobe; browTilt>0 = preocupada (pontas internas sobem)
    for (const b of this.brows) {
      b.g.position.y = 0.19 + q.brow * 0.05;
      b.g.rotation.z = b.s * q.browTilt * 0.55 - b.s * 0.08;
      b.g.rotation.x = -q.brow * 0.25;
    }
    // boca
    this.jaw.rotation.x = q.mouth * 0.55;
    this.tongue.rotation.x = q.tongue * 0.35;
    this.tongue.position.z = 0.08 + q.tongue * 0.09;
    this.tongue.scale.set(1, 1, 0.55 + q.tongue * 0.75);
    this.smile.scale.set(1, 1 + (q.smile - 1) * 0.3 - q.mouth * 0.4, 1);
    this.smile.position.y = -q.mouth * 0.012;

    // orelhas (rotação base + flop dinâmico); +z = ponta para fora
    for (const e of this.ears) {
      const dyn = e.s > 0 ? q.earR : q.earL;
      e.flap.rotation.set(-0.05 + dyn * 0.35 - q.earPerk * 0.35, 0, e.s * (0.10 + q.earPerk * 0.55 + dyn * 0.25));
    }

    // patas: ciclo de marcha diagonal + posição sentado
    const ph = q.gait, A = q.gaitAmp;
    for (const L of this.legs) {
      const off = ((L.front ? 0 : Math.PI) + (L.side > 0 ? 0 : Math.PI));
      const s = Math.sin(ph + off), c2 = Math.cos(ph + off);
      const sw = s * 0.55 * A, kn = Math.max(0, c2) * 0.9 * A * (L.front ? 0.7 : 1.0);
      if (L.front) { L.hip.rotation.x = sw - sit * 0.10; L.knee.rotation.x = -kn * 0.8; L.paw.rotation.x = -sw * 0.35 + kn * 0.3; }
      else { L.hip.rotation.x = -sw * 0.56 + sit * 1.25; L.knee.rotation.x = kn * 0.9 - sit * 1.9; L.paw.rotation.x = sw * 0.3 + sit * 0.65; }
    }

    // rabo
    const wag = q.tailWag;
    this.tailRoot.rotation.x = -0.15 - q.tailLift * 1.0;
    for (let i = 0; i < this.tail.length; i++) {
      this.tail[i].rotation.y = Math.sin(q.tailPhase - i * 0.55) * wag * (0.18 + i * 0.07);
      this.tail[i].rotation.x = i === 0 ? 0 : -0.22 - q.tailLift * 0.12;
    }
  }

  // quantidade de camadas de pelo (qualidade x custo): 1.0 = máximo
  setShellRatio(r) {
    if (this._shellRatio === r) return; this._shellRatio = r;
    this.root.traverse((o) => { if (o.userData.fur) { const n = Math.max(6, Math.round(o.userData.maxShells * r)); o.count = n; o.material.uniforms.uShells.value = n; } });
  }

  // LOD de malha: 0 = alta (close-ups), 1 = baixa (planos médios/abertos)
  setLOD(l) {
    if (this._lod === l) return; this._lod = l;
    this.root.traverse((o) => { if (o.userData.fur && o.userData.geoLo) o.geometry = l ? o.userData.geoLo : o.userData.geoHi; });
  }

  setFlash(a, color) {
    this.root.traverse((o) => { if (o.userData.fur) { o.material.uniforms.uFlash.value = a; if (color) o.material.uniforms.uFlashCol.value.set(color); } });
  }
}
