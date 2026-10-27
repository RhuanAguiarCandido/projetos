// Linhas de campo magnético: fitas (billboards no espaço de tela) com pulsos de energia correndo ao longo da linha.
import * as THREE from 'three';

const VS = /* glsl */ `
precision highp float;
attribute vec3 aNext; attribute float aSide, aT, aId;
uniform vec2 uRes; uniform float uWidth;
varying float vT, vSide, vId;
void main(){
  vT = aT; vSide = aSide; vId = aId;
  vec4 p0 = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  vec4 p1 = projectionMatrix * modelViewMatrix * vec4(aNext, 1.0);
  vec2 s0 = p0.xy / p0.w * uRes * 0.5, s1 = p1.xy / p1.w * uRes * 0.5;
  vec2 d = s1 - s0; float l = length(d); d = l > 1e-4 ? d / l : vec2(1.0, 0.0);
  vec2 perp = vec2(-d.y, d.x);
  float w = uWidth * (0.35 + 0.65 * sin(aT * 3.14159));
  vec2 off = perp * aSide * w;
  gl_Position = p0 + vec4(off / (uRes * 0.5) * p0.w, 0.0, 0.0);
}`;
const FS = /* glsl */ `
precision highp float;
varying float vT, vSide, vId;
uniform float uTime, uGrow, uAlpha, uFreq, uSpeed, uBase; uniform vec3 uColA, uColB;
void main(){
  float edge = 1.0 - vSide * vSide;
  float core = pow(edge, 2.2);
  float head = smoothstep(uGrow, uGrow - 0.06, vT);
  float ph = fract(vT * uFreq - uTime * uSpeed + vId * 3.71);
  float pulse = pow(0.5 + 0.5 * cos((ph - 0.5) * 6.2831853), 10.0);
  float flare = smoothstep(uGrow - 0.02, uGrow - 0.0, vT) * 0.0;
  vec3 col = mix(uColA, uColB, smoothstep(0.0, 1.0, vT));
  float I = (uBase + 1.1 * pulse) * (0.35 + 0.65 * core) * head * uAlpha;
  col = mix(col, vec3(1.0), pulse * core * 0.25);
  gl_FragColor = vec4(col * I, I);
}`;

export function dipolePolylines({ Ls = [1.7, 2.3, 3.1], azimuths = 12, surface = 1, steps = 70, azOffset = 0 }) {
  const lines = [];
  for (const L of Ls) {
    const lamMax = Math.acos(Math.sqrt(surface / L));
    for (let a = 0; a < azimuths; a++) {
      const phi = azOffset + (a / azimuths) * Math.PI * 2; const pts = [];
      for (let i = 0; i <= steps; i++) {
        const u = -1 + (2 * i) / steps; const lam = Math.sign(u) * Math.pow(Math.abs(u), 0.85) * lamMax; // mais denso nos polos
        const r = L * Math.cos(lam) ** 2;
        pts.push(new THREE.Vector3(r * Math.cos(lam) * Math.cos(phi), r * Math.sin(lam), r * Math.cos(lam) * Math.sin(phi)));
      }
      lines.push(pts);
    }
  }
  return lines;
}

export class Ribbons {
  constructor(polylines, { width = 5, colA = '#00d9f5', colB = '#f9d548', freq = 2.5, speed = 0.45, base = 0.5, res = [1080, 1920] } = {}) {
    const pos = [], nxt = [], side = [], tt = [], id = [], idx = [];
    let vi = 0;
    polylines.forEach((pts, li) => {
      const n = pts.length; const rid = Math.random() * 0 + ((li * 0.6180339) % 1);
      for (let i = 0; i < n; i++) {
        const p = pts[i]; const q = i < n - 1 ? pts[i + 1] : p.clone().add(p.clone().sub(pts[i - 1]));
        for (const s of [-1, 1]) { pos.push(p.x, p.y, p.z); nxt.push(q.x, q.y, q.z); side.push(s); tt.push(i / (n - 1)); id.push(rid); }
        if (i < n - 1) { const a = vi + i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
      }
      vi += n * 2;
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('aNext', new THREE.Float32BufferAttribute(nxt, 3));
    g.setAttribute('aSide', new THREE.Float32BufferAttribute(side, 1)); g.setAttribute('aT', new THREE.Float32BufferAttribute(tt, 1)); g.setAttribute('aId', new THREE.Float32BufferAttribute(id, 1));
    g.setIndex(idx);
    this.u = {
      uRes: { value: new THREE.Vector2(...res) }, uWidth: { value: width }, uTime: { value: 0 }, uGrow: { value: 1.05 }, uAlpha: { value: 1 }, uFreq: { value: freq }, uSpeed: { value: speed }, uBase: { value: base },
      uColA: { value: new THREE.Color(colA) }, uColB: { value: new THREE.Color(colB) },
    };
    const m = new THREE.ShaderMaterial({
      vertexShader: VS, fragmentShader: FS, uniforms: this.u, transparent: true, depthWrite: false, side: THREE.DoubleSide,
      blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneFactor,
    });
    this.mesh = new THREE.Mesh(g, m); this.mesh.frustumCulled = false;
  }
  set(t, grow, alpha) { this.u.uTime.value = t; this.u.uGrow.value = grow; this.u.uAlpha.value = alpha; }
}

// Faíscas orbitais (partículas luminosas)
export class Sparks {
  constructor(n = 120, radius = 1, { colA = '#00d9f5', colB = '#f9d548', size = 0.05 } = {}) {
    const pos = new Float32Array(n * 3), rnd = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) { rnd[i * 4] = Math.random(); rnd[i * 4 + 1] = Math.random(); rnd[i * 4 + 2] = Math.random(); rnd[i * 4 + 3] = Math.random(); }
    // determinístico
    let s = 99; const R = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
    for (let i = 0; i < n * 4; i++) rnd[i] = R();
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aRnd', new THREE.BufferAttribute(rnd, 4));
    this.u = { uTime: { value: 0 }, uR: { value: radius }, uAmt: { value: 1 }, uSize: { value: size }, uScale: { value: 1080 }, uColA: { value: new THREE.Color(colA) }, uColB: { value: new THREE.Color(colB) }, uBurst: { value: 0 } };
    const m = new THREE.ShaderMaterial({
      uniforms: this.u, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: `attribute vec4 aRnd; uniform float uTime, uR, uSize, uScale, uBurst; varying vec4 vR; varying float vL;
        void main(){ vR = aRnd; float a = aRnd.x * 6.2831 + uTime * (0.4 + aRnd.y * 1.1) * (aRnd.z > 0.5 ? 1.0 : -1.0);
          float r = uR * (0.7 + aRnd.y * 0.9) * (1.0 + uBurst * (0.6 + aRnd.w)); float h = (aRnd.w - 0.5) * uR * 0.5 + sin(uTime * 1.3 + aRnd.x * 9.0) * uR * 0.06;
          vec3 p = vec3(cos(a) * r, h, sin(a) * r);
          vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv; vL = 0.5 + 0.5 * sin(uTime * 3.0 + aRnd.z * 30.0);
          gl_PointSize = clamp(uSize * uScale * 1.6 / max(-mv.z, 0.2) * (0.5 + aRnd.y), 1.5, 40.0); }`,
      fragmentShader: `precision highp float; varying vec4 vR; varying float vL; uniform vec3 uColA, uColB; uniform float uAmt;
        void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.0, d); a *= a; vec3 c = mix(uColA, uColB, step(0.55, vR.z)) ; float I = a * (0.6 + 0.8 * vL) * uAmt; gl_FragColor = vec4(c * I * 1.6, I); }`,
    });
    this.points = new THREE.Points(g, m); this.points.frustumCulled = false;
  }
}
