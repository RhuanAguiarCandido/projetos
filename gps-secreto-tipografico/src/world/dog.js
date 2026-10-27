// Golden retriever 3D estilizado ("mascote"): formas suaves, toon shading, contorno, tufos instanciados e rig completo.
import * as THREE from 'three';
import { toonMaterial, outlineMaterial, ellipsoid, toonMesh, tuftSet, STAGE } from './toon.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { col, clamp } from '../kit/util.js';

const GOLD = { base: '#EE9F26', shade: '#A9540F', light: '#FFC24F' };
const CREAM = { base: '#FFE0A0', shade: '#E2B56C', light: '#FFF2D0' };
const EAR = { base: '#DB8A1C', shade: '#9E4F0C', light: '#F5B046' };
const SNOUT = { base: '#A9651E', shade: '#6F3A0D', light: '#C98532' };
const BROW = { base: '#FFC651', shade: '#D58B22', light: '#FFE49A' };
const PINK = { base: '#FF7C9A', shade: '#D84A6E', light: '#FFB0C3' };
const OUT = '#7A400C';

function onEllipsoid(rx, ry, rz, thetas, phis) {
  const P = [], N = [];
  for (const th of thetas) for (const ph of phis) {
    const x = Math.sin(th) * Math.cos(ph), y = Math.cos(th), z = Math.sin(th) * Math.sin(ph);
    P.push(new THREE.Vector3(x * rx, y * ry, z * rz)); N.push(new THREE.Vector3(x / rx, y / ry, z / rz).normalize());
  }
  return [P, N];
}


// tronco único (uma malha, um contorno): perfil de raios ao longo de z
function torsoGeometry() {
  const K = [[-0.60, 0.16, 0.18, 0.70], [-0.36, 0.27, 0.28, 0.67], [-0.05, 0.245, 0.25, 0.68], [0.22, 0.285, 0.31, 0.63], [0.52, 0.25, 0.30, 0.64]];
  const prof = (z) => { z = clamp(z, K[0][0], K[K.length - 1][0]); let i = 0; while (i < K.length - 2 && z > K[i + 1][0]) i++; const a = K[i], b = K[i + 1]; let t = (z - a[0]) / (b[0] - a[0]); t = t * t * (3 - 2 * t); return [a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t, a[3] + (b[3] - a[3]) * t]; };
  let g = new THREE.SphereGeometry(1, 40, 28); const pos = g.attributes.position; const zc = -0.04, hl = 0.56;
  for (let i = 0; i < pos.count; i++) { const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i); const zz = zc + z * hl; const [rx, ry, yc] = prof(zz); pos.setXYZ(i, x * rx, yc + y * ry, zz); }
  g.deleteAttribute('uv'); g.deleteAttribute('normal'); g = mergeVertices(g, 1e-4); g.computeVertexNormals(); return g;
}

export class Dog {
  constructor() {
    this.root = new THREE.Group(); this.fills = []; this.outlines = [];
    const reg = (g) => { if (g.userData.fill) this.fills.push(g.userData.fill); if (g.userData.outline) this.outlines.push(g.userData.outline); return g; };
    const part = (parent, geo, matOpts, pos, outline = { width: 2.5, color: OUT }) => { const g = reg(toonMesh(geo, matOpts, outline)); g.position.set(...pos); parent.add(g); return g; };

    // ---------------- corpo ----------------
    this.body = new THREE.Group(); this.root.add(this.body);
    part(this.body, torsoGeometry(), { palette: GOLD, palette2: CREAM, gradDir: [0, -1, 0.6], gradRange: [-0.50, -0.40] }, [0, 0, 0]);
    part(this.body, ellipsoid(0.23, 0.26, 0.21), { palette: GOLD, palette2: CREAM, gradDir: [0, 0, 1], gradRange: [0.0, 0.17] }, [0, 0.88, 0.31]);   // pescoço/ruff
    // peitoral: tufos cremosos
    { const [P, N] = onEllipsoid(0.27, 0.30, 0.25, [1.35, 1.65, 1.95], [0.7, 1.05, 1.4, 1.75, 2.1, 2.45]); P.forEach((p) => p.add(new THREE.Vector3(0, 0.63, 0.30)));
      this.body.add(tuftSet(P, N, { palette: CREAM, h: 0.12, w: 0.055, sweep: [0, -1.1, 0.1] })); }

    // ---------------- pescoço/cabeça ----------------
    this.neck = new THREE.Group(); this.neck.position.set(0, 0.93, 0.34); this.body.add(this.neck);
    this.head = new THREE.Group(); this.head.position.set(0, 0.21, 0.12); this.neck.add(this.head);
    const H = this.head;
    part(H, ellipsoid(0.35, 0.31, 0.31, 32, 22), { palette: GOLD, palette2: CREAM, gradDir: [0, -1, 0], gradRange: [0.25, 0.34] }, [0, 0, 0]);
    for (const s of [1, -1]) part(H, ellipsoid(0.15, 0.125, 0.15), { palette: GOLD, palette2: CREAM, gradDir: [0, -1, 0], gradRange: [-0.02, 0.1] }, [0.2 * s, -0.10, 0.06]);
    // bochechas: tufos macios
    for (const s of [1, -1]) { const [P, N] = onEllipsoid(0.15, 0.125, 0.15, [1.4, 1.8, 2.2], [0.4, 0.9, 1.4]); P.forEach((p) => { p.x = p.x * s + 0.2 * s; p.y -= 0.10; p.z += 0.06; }); N.forEach((n) => { n.x *= s; });
      H.add(tuftSet(P, N, { palette: CREAM, h: 0.075, w: 0.04, sweep: [0.3 * s, -0.8, 0] })); }
    // focinho (ponta escura) + nariz
    this.muzzle = part(H, ellipsoid(0.155, 0.118, 0.205, 28, 20), { palette: GOLD, palette2: SNOUT, gradDir: [0, 0, 1], gradRange: [0.12, 0.2] }, [0, -0.07, 0.29]);
    this.nose = part(H, ellipsoid(0.082, 0.056, 0.06, 20, 14), { palette: { base: '#2A1710', shade: '#150A06', light: '#4A2E22' }, spec: 0.9, bandA: 0.2, bandB: 0.8 }, [0, -0.016, 0.495], { width: 1.8, color: '#150A06' });
    for (const s of [1, -1]) { const nm = new THREE.Mesh(ellipsoid(0.014, 0.01, 0.012, 8, 6), new THREE.MeshBasicMaterial({ color: '#000000' })); nm.position.set(0.034 * s, -0.026, 0.548); H.add(nm); }
    this.smileMat = new THREE.MeshBasicMaterial({ color: '#4A220A' });
    const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, -0.045, 0.50), new THREE.Vector3(0, -0.085, 0.495), new THREE.Vector3(0, -0.125, 0.46), new THREE.Vector3(0.075, -0.155, 0.42), new THREE.Vector3(0.14, -0.14, 0.36), new THREE.Vector3(0.175, -0.11, 0.29)]);
    this.smile = new THREE.Group(); H.add(this.smile);
    const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 20, 0.0065, 5, false), this.smileMat), tube2 = new THREE.Mesh(tube.geometry, this.smileMat); tube2.scale.x = -1; this.smile.add(tube, tube2);
    // mandíbula, boca, língua
    this.jaw = new THREE.Group(); this.jaw.position.set(0, -0.115, 0.14); H.add(this.jaw);
    const mouth = new THREE.Mesh(ellipsoid(0.098, 0.03, 0.17, 18, 10), new THREE.MeshBasicMaterial({ color: '#5A1426' })); mouth.position.set(0, 0.03, 0.17); this.jaw.add(mouth);
    part(this.jaw, ellipsoid(0.108, 0.05, 0.18, 22, 12), { palette: CREAM, palette2: GOLD, gradDir: [0, 1, 0], gradRange: [0.02, 0.05] }, [0, -0.01, 0.17], { width: 2, color: OUT });
    this.tongue = new THREE.Group(); this.tongue.position.set(0, 0.035, 0.08); this.jaw.add(this.tongue);
    part(this.tongue, ellipsoid(0.06, 0.016, 0.125, 18, 10, (v) => { v.y += Math.max(0, v.z) * -0.08 * (v.z / 0.125); }), { palette: PINK, spec: 0.5 }, [0, 0, 0.10], { width: 1.6, color: '#A8304E' });

    // olhos grandes e brilhantes
    this.eyes = [];
    const irisMat = () => new THREE.ShaderMaterial({
      uniforms: { uSpiral: { value: 0 }, uTime: { value: 0 } }, transparent: false, side: THREE.DoubleSide,
      vertexShader: 'varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `precision highp float; varying vec2 vP; uniform float uSpiral, uTime;
        void main(){ float r = length(vP) / 0.066; float a = atan(vP.y, vP.x);
          vec3 c = vec3(0.04, 0.02, 0.01);
          vec3 ring = mix(vec3(0.42, 0.20, 0.06), vec3(0.88, 0.50, 0.16), smoothstep(0.35, 1.0, r) * (0.7 + 0.3 * sin(a * 9.0)));
          ring = mix(ring, vec3(0.99, 0.74, 0.34), smoothstep(0.0, 1.0, -vP.y / 0.066 * 0.5 + 0.3) * 0.5);
          c = mix(c, ring, smoothstep(0.34, 0.42, r));
          c = mix(c, vec3(0.10, 0.05, 0.02), smoothstep(0.9, 1.0, r));
          float sp = step(0.0, sin(a * 2.0 + r * 14.0 - uTime * 12.0));
          c = mix(c, mix(vec3(0.0), vec3(1.0), sp), uSpiral);
          gl_FragColor = vec4(c, 1.0); }`,
    });
    for (const s of [1, -1]) {
      const eye = new THREE.Group(); eye.position.set(0.148 * s, 0.07, 0.245); eye.rotation.y = 0.10 * s; H.add(eye);
      const ball = new THREE.Group(); eye.add(ball);
      const R = 0.09;
      const eb = new THREE.Mesh(new THREE.SphereGeometry(R, 24, 16), new THREE.MeshBasicMaterial({ color: '#1F0F07' })); ball.add(eb);
      const iris = new THREE.Mesh(new THREE.CircleGeometry(0.066, 28), irisMat()); iris.position.z = R * 0.98 - 0.004; ball.add(iris);
      const h1 = new THREE.Mesh(new THREE.CircleGeometry(0.024, 18), new THREE.MeshBasicMaterial({ color: '#FFFFFF' })); h1.position.set(0.026, 0.03, R * 1.0); eye.add(h1);
      const h2 = new THREE.Mesh(new THREE.CircleGeometry(0.0105, 14), new THREE.MeshBasicMaterial({ color: '#FFFFFF' })); h2.position.set(-0.03, -0.03, R * 1.0); eye.add(h2);
      const lidO = (a, b, c) => ({ palette: GOLD, bandA: 0.3, bandB: 0.8 });
      const upper = new THREE.Group(); eye.add(upper); upper.add(part(upper, new THREE.SphereGeometry(R * 1.1, 24, 12, 0, Math.PI * 2, 0, 1.5708), lidO(), [0, 0, 0], { width: 1.6, color: OUT }));
      const lower = new THREE.Group(); eye.add(lower); lower.add(part(lower, new THREE.SphereGeometry(R * 1.09, 24, 10, 0, Math.PI * 2, Math.PI - 0.9, 0.9), lidO(), [0, 0, 0], { width: 1.4, color: OUT }));
      this.eyes.push({ eye, ball, upper, lower, iris, s });
    }
    // sobrancelhas
    this.brows = [];
    for (const s of [1, -1]) { const g = new THREE.Group(); g.position.set(0.15 * s, 0.185, 0.215); g.rotation.x = -0.45; H.add(g); part(g, ellipsoid(0.056, 0.02, 0.03, 14, 8), { palette: BROW }, [0, 0, 0], { width: 1.8, color: OUT }); this.brows.push({ g, s }); }
    // orelhas caídas
    this.ears = [];
    for (const s of [1, -1]) {
      const pivot = new THREE.Group(); pivot.position.set(0.30 * s, 0.12, -0.02); H.add(pivot);
      const flap = new THREE.Group(); pivot.add(flap);
      part(flap, ellipsoid(0.05, 0.225, 0.15, 20, 16, (v, n, x, y) => { const t = (-v.y / 0.225) * 0.5 + 0.5; v.z *= 1 - 0.25 * t; v.x += 0.02 * s * t; }), { palette: EAR, palette2: GOLD, gradDir: [0, 1, 0], gradRange: [0.1, 0.22] }, [0.035 * s, -0.20, 0]);
      const [P, N] = onEllipsoid(0.05, 0.225, 0.15, [2.3, 2.65], [0.7, 1.6, 2.5, 3.4, 4.3, 5.2]); P.forEach((p) => { p.x += 0.035 * s; p.y -= 0.20; });
      flap.add(tuftSet(P, N, { palette: GOLD, h: 0.1, w: 0.04, sweep: [0, -1, 0] }));
      this.ears.push({ pivot, flap, s });
    }

    // ---------------- patas ----------------
    this.legs = [];
    const mkLeg = (x, y, z, front) => {
      const hip = new THREE.Group(); hip.position.set(x, y, z); this.body.add(hip);
      part(hip, front ? ellipsoid(0.098, 0.18, 0.108) : ellipsoid(0.125, 0.21, 0.15), { palette: GOLD, palette2: CREAM, gradDir: [0, -1, 0], gradRange: [0.02, 0.14] }, [0, front ? -0.14 : -0.12, front ? 0 : -0.02]);
      const knee = new THREE.Group(); knee.position.set(0, front ? -0.29 : -0.27, front ? 0 : 0.03); hip.add(knee);
      part(knee, ellipsoid(0.078, 0.15, 0.084), { palette: CREAM, gradRange: [10, 11] }, [0, -0.12, 0]);
      const paw = new THREE.Group(); paw.position.set(0, -0.25, 0); knee.add(paw);
      part(paw, ellipsoid(0.095, 0.055, 0.125), { palette: CREAM }, [0, 0, 0.035]);
      for (const dx of [-0.04, 0, 0.04]) { const toe = new THREE.Mesh(ellipsoid(0.017, 0.011, 0.02, 8, 6), new THREE.MeshBasicMaterial({ color: '#4A2A14' })); toe.position.set(dx, -0.012, 0.155); paw.add(toe); }
      if (front) { const [P, N] = onEllipsoid(0.098, 0.18, 0.108, [1.6, 2.0, 2.4], [3.6, 4.1, 4.6, 5.1]); P.forEach((p) => p.add(new THREE.Vector3(0, -0.14, 0))); hip.add(tuftSet(P, N, { palette: CREAM, h: 0.08, w: 0.035, sweep: [0, -0.7, -0.4] })); }
      const leg = { hip, knee, paw, front, side: Math.sign(x) }; this.legs.push(leg); return leg;
    };
    mkLeg(0.155, 0.58, 0.24, true); mkLeg(-0.155, 0.58, 0.24, true); mkLeg(0.175, 0.58, -0.29, false); mkLeg(-0.175, 0.58, -0.29, false);

    // ---------------- rabo (pluma) ----------------
    this.tail = []; let parent = new THREE.Group(); parent.position.set(0, 0.78, -0.50); this.body.add(parent); this.tailRoot = parent;
    for (let i = 0; i < 5; i++) {
      const seg = new THREE.Group(); if (i > 0) seg.position.set(0, 0, -0.15); parent.add(seg);
      const rx = 0.05 + Math.sin((i + 0.6) / 5 * Math.PI) * 0.05; part(seg, ellipsoid(rx, rx * 1.15, 0.13, 16, 10), { palette: GOLD }, [0, 0, -0.075], { width: 1.6, color: '#A8590F' });
      const [P, N] = onEllipsoid(rx, rx * 1.15, 0.13, [2.2, 2.6], [1.3, 1.9, 4.4, 5.0]); P.forEach((p) => p.z -= 0.075); seg.add(tuftSet(P, N, { palette: GOLD, h: 0.11, w: 0.045, sweep: [0, -0.9, -1.0] }));
      this.tail.push(seg); parent = seg;
    }

    // sombra de contato
    const sc = document.createElement('canvas'); sc.width = sc.height = 128; const sg = sc.getContext('2d'); const gr = sg.createRadialGradient(64, 64, 4, 64, 64, 62);
    gr.addColorStop(0, 'rgba(10,20,40,0.55)'); gr.addColorStop(0.6, 'rgba(10,20,40,0.25)'); gr.addColorStop(1, 'rgba(10,20,40,0)'); sg.fillStyle = gr; sg.fillRect(0, 0, 128, 128);
    const st = new THREE.CanvasTexture(sc); st.colorSpace = THREE.SRGBColorSpace;
    this.shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: st, transparent: true, depthWrite: false }));
    this.shadow.rotation.x = -Math.PI / 2; this.shadow.position.y = 0.015; this.shadow.scale.set(1.3, 1.8, 1); this.shadow.renderOrder = 1; this.root.add(this.shadow);

    // estado padrão (GSAP anima estes campos; update() aplica)
    this.s = {
      bob: 0, pitch: 0, roll: 0, sit: 0, gait: 0, gaitAmp: 0, neckPitch: 0, headYaw: 0, headPitch: 0, headRoll: 0, lookX: 0, lookY: 0, blink: 0, lid: 0.16,
      brow: 0, browTilt: 0, mouth: 0.15, tongue: 0, smile: 1, tailWag: 1, tailPhase: 0, tailLift: 0.3, earL: 0, earR: 0, earPerk: 0, breathe: 0, squash: 0, dizzy: 0, time: 0, flash: 0, opacity: 1,
    };
    this.update();
  }

  update() {
    const q = this.s, sit = q.sit;
    this.body.position.y = q.bob - sit * 0.21;
    this.body.rotation.x = -q.pitch - sit * 0.50; this.body.rotation.z = q.roll;
    const br = 1 + q.breathe * 0.012, sq = q.squash;
    this.body.scale.set(1 + sq * 0.06, br * (1 - sq * 0.09), 1 - sq * 0.02);
    this.shadow.scale.set(1.3 * (1 - sit * 0.1), 1.8 * (1 - sit * 0.25), 1);
    this.neck.rotation.x = q.neckPitch + sit * 0.42;
    this.head.rotation.set(q.headPitch, q.headYaw, q.headRoll, 'YXZ');
    const c = clamp(1 - (1 - q.blink) * (1 - q.lid));
    for (const e of this.eyes) {
      e.ball.rotation.set(-q.lookY * 0.35, q.lookX * 0.45, 0);
      e.upper.rotation.x = THREE.MathUtils.lerp(-1.2, 1.05, c);
      e.lower.rotation.x = -THREE.MathUtils.smoothstep(c, 0.35, 1.0) * 0.85;
      e.iris.material.uniforms.uSpiral.value = q.dizzy; e.iris.material.uniforms.uTime.value = q.time;
    }
    for (const b of this.brows) { b.g.position.y = 0.185 + q.brow * 0.045; b.g.rotation.z = b.s * q.browTilt * 0.55 - b.s * 0.08; b.g.rotation.x = -0.45 - q.brow * 0.2; }
    this.jaw.rotation.x = q.mouth * 0.55;
    this.tongue.rotation.x = q.tongue * 0.35; this.tongue.position.z = 0.08 + q.tongue * 0.09; this.tongue.scale.set(1, 1, 0.55 + q.tongue * 0.75);
    this.smile.scale.set(1, 1 + (q.smile - 1) * 0.3 - q.mouth * 0.4, 1); this.smile.position.y = -q.mouth * 0.012;
    for (const e of this.ears) { const dyn = e.s > 0 ? q.earR : q.earL; e.flap.rotation.set(-0.05 + dyn * 0.35 - q.earPerk * 0.35, 0, e.s * (0.10 + q.earPerk * 0.55 + dyn * 0.25)); }
    const ph = q.gait, A = q.gaitAmp;
    for (const L of this.legs) {
      const off = (L.front ? 0 : Math.PI) + (L.side > 0 ? 0 : Math.PI); const s = Math.sin(ph + off), c2 = Math.cos(ph + off);
      const sw = s * 0.55 * A, kn = Math.max(0, c2) * 0.9 * A * (L.front ? 0.7 : 1.0);
      if (L.front) { L.hip.rotation.x = sw - sit * 0.10; L.knee.rotation.x = -kn * 0.8; L.paw.rotation.x = -sw * 0.35 + kn * 0.3; }
      else { L.hip.rotation.x = -sw * 0.56 + sit * 1.25; L.knee.rotation.x = kn * 0.9 - sit * 1.9; L.paw.rotation.x = sw * 0.3 + sit * 0.65; }
    }
    this.tailRoot.rotation.x = -0.15 - q.tailLift * 1.0;
    for (let i = 0; i < this.tail.length; i++) { this.tail[i].rotation.y = Math.sin(q.tailPhase - i * 0.55) * q.tailWag * (0.18 + i * 0.07); this.tail[i].rotation.x = i === 0 ? 0 : -0.22 - q.tailLift * 0.12; }
    for (const m of this.fills) { m.material.uniforms.uFlash.value = q.flash; m.material.uniforms.uOpacity.value = q.opacity; }
  }
}
