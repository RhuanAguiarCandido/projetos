// Parque na "hora azul": céu em gradiente com sol baixo, gramado listrado, árvores toon instanciadas, nuvens e vaga-lumes.
import * as THREE from 'three';
import { toonMaterial, outlineMaterial, STAGE } from './toon.js';
import { pointsMaterial } from './glow.js';
import { rng, col } from '../kit/util.js';

const SKY_VS = `varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * viewMatrix * vec4(position + cameraPosition, 1.0); }`;
const SKY_FS = `precision highp float; varying vec3 vD; uniform vec3 uTop, uMid, uHor, uSun; uniform vec3 uSunDir; uniform float uTime;
float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void main(){
  float y = clamp(vD.y, -0.1, 1.0);
  vec3 c = mix(uHor, uMid, smoothstep(0.0, 0.28, y)); c = mix(c, uTop, smoothstep(0.2, 0.9, y));
  float s = max(dot(vD, uSunDir), 0.0);
  c += uSun * (pow(s, 16.0) * 0.16 + pow(s, 70.0) * 0.9 + smoothstep(0.9975, 0.9985, s) * 2.0);
  vec2 q = floor(vD.xz / max(0.04, vD.y + 0.2) * 40.0); float st = step(0.9965, h(q)) * smoothstep(0.35, 0.8, y);
  c += vec3(0.8, 0.95, 1.0) * st * 0.9;
  gl_FragColor = vec4(c, 1.0); }`;

const GROUND_VS = `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const GROUND_FS = `precision highp float; varying vec3 vW; uniform vec3 uA, uB, uFogCol; uniform float uFogDen; uniform float uWorn;
void main(){
  float r = length(vW.xz);
  float stripe = step(0.0, sin(vW.x * 1.1 + vW.z * 0.35));
  vec3 c = mix(uA, uB, stripe * 0.55);
  c = mix(c, uA * 0.55, smoothstep(2.0, 40.0, r));
  float ring = smoothstep(0.13, 0.0, abs(r - 0.8)) * uWorn;                        // trilha gasta onde o cão gira
  c = mix(c, vec3(0.62, 0.45, 0.22), ring * 0.8);
  float d = length(cameraPosition - vW); c = mix(c, uFogCol, 1.0 - exp(-pow(d * uFogDen, 2.0)));
  gl_FragColor = vec4(c, 1.0); }`;

export class Park {
  constructor() {
    this.group = new THREE.Group();
    const sunDir = new THREE.Vector3(-0.35, 0.12, -1).normalize(); this.sunDir = sunDir;
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(300, 32, 20), new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, vertexShader: SKY_VS, fragmentShader: SKY_FS,
      uniforms: { uTop: { value: col('#070C26') }, uMid: { value: col('#173F78') }, uHor: { value: col('#3BB8DC') }, uSun: { value: col('#FFD36A') }, uSunDir: { value: sunDir }, uTime: { value: 0 } } }));
    this.sky.frustumCulled = false; this.sky.renderOrder = -10; this.group.add(this.sky);

    this.ground = new THREE.Mesh(new THREE.CircleGeometry(160, 72), new THREE.ShaderMaterial({ vertexShader: GROUND_VS, fragmentShader: GROUND_FS,
      uniforms: { uA: { value: col('#1D6B5E') }, uB: { value: col('#2C8F6E') }, uFogCol: STAGE.uFogCol, uFogDen: STAGE.uFogDen, uWorn: { value: 0 } } }));
    this.ground.rotation.x = -Math.PI / 2; this.group.add(this.ground);

    const R = rng(11);
    // árvores (tronco + 3 copas) instanciadas
    const N = 26, trunk = new THREE.CylinderGeometry(0.16, 0.24, 1.6, 8); trunk.translate(0, 0.8, 0);
    const crown = new THREE.IcosahedronGeometry(1, 2);
    const mTrunk = new THREE.InstancedMesh(trunk, toonMaterial({ palette: { base: '#6B4A38', shade: '#3C2A2E', light: '#8A6650' } }), N);
    const mCrownA = new THREE.InstancedMesh(crown, toonMaterial({ palette: { base: '#1F8A6E', shade: '#0E4A4A', light: '#4CC79B' }, palette2: { base: '#2BA37F', shade: '#135A55', light: '#6EDCAA' }, gradDir: [0, 1, 0], gradRange: [0.1, 0.9] }), N * 3);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), p = new THREE.Vector3();
    let ci = 0; this.treePos = [];
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2 + (R() - 0.5) * 0.35, rad = 9 + R() * 20; const x = Math.cos(a) * rad, z = Math.sin(a) * rad;
      if (Math.abs(a % (Math.PI * 2) - Math.PI * 1.5) < 0.12 && rad < 18) continue;   // deixa a "porta" para o sol
      const k = 0.8 + R() * 0.9; p.set(x, 0, z); q.setFromEuler(e.set(0, R() * 6.28, 0)); s.set(k, k, k); m4.compose(p, q, s); mTrunk.setMatrixAt(i, m4);
      for (let j = 0; j < 3; j++) { const cr = (1.15 - j * 0.22) * k * (1.3 + R() * 0.3); p.set(x + (R() - 0.5) * 0.5 * k, (1.6 + j * 0.85) * k, z + (R() - 0.5) * 0.5 * k); s.set(cr, cr * 0.85, cr); m4.compose(p, q, s); mCrownA.setMatrixAt(ci++, m4); }
      this.treePos.push([x, z]);
    }
    mTrunk.count = N; mCrownA.count = ci; mTrunk.frustumCulled = mCrownA.frustumCulled = false; this.group.add(mTrunk, mCrownA);
    // arbustos baixos
    const bush = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 2), toonMaterial({ palette: { base: '#2A8F70', shade: '#13564F', light: '#6BD6A8' } }), 40);
    for (let i = 0; i < 40; i++) { const a = R() * 6.28, rad = 5 + R() * 24; const k = 0.4 + R() * 0.7; p.set(Math.cos(a) * rad, 0.2 * k, Math.sin(a) * rad); q.setFromEuler(e.set(0, R() * 6, 0)); s.set(k * 1.4, k * 0.8, k * 1.2); m4.compose(p, q, s); bush.setMatrixAt(i, m4); }
    bush.frustumCulled = false; this.group.add(bush);

    // nuvens suaves (lilás/rosa)
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 96; const g = cv.getContext('2d'); const gr = g.createRadialGradient(128, 48, 4, 128, 48, 120);
    gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.save(); g.scale(1, 0.38); g.translate(0, 80); g.fillStyle = gr; g.fillRect(0, -60, 256, 260); g.restore();
    const tex = new THREE.CanvasTexture(cv); this.clouds = [];
    for (let i = 0; i < 9; i++) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.38), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, color: i % 3 ? '#7C8FE0' : '#E89AA8', opacity: 0.2, fog: false }));
      const a = -Math.PI / 2 + (R() - 0.5) * 2.6; const d = 150; m.position.set(Math.cos(a) * d, 22 + R() * 40, Math.sin(a) * d); m.scale.setScalar(70 + R() * 90); m.lookAt(0, m.position.y, 0); m.userData = { a, d, sp: 0.0006 + R() * 0.0008, y: m.position.y }; this.clouds.push(m); this.group.add(m);
    }
    // vaga-lumes
    const F = 140, pos = new Float32Array(F * 3), sz = new Float32Array(F), ph = new Float32Array(F), cc = new Float32Array(F * 3); this.fireBase = [];
    for (let i = 0; i < F; i++) { const a = R() * 6.28, rad = 1.5 + R() * 11; const b = [Math.cos(a) * rad, 0.3 + R() * 3.2, Math.sin(a) * rad]; this.fireBase.push(b); pos.set(b, i * 3); sz[i] = 0.5 + R(); ph[i] = R(); const y = R() < 0.65; cc.set(y ? [1, 0.84, 0.35] : [0.3, 0.9, 1], i * 3); }
    const fg = new THREE.BufferGeometry(); fg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); fg.setAttribute('aSize', new THREE.BufferAttribute(sz, 1)); fg.setAttribute('aPh', new THREE.BufferAttribute(ph, 1)); fg.setAttribute('aCol', new THREE.BufferAttribute(cc, 3));
    this.fireMat = pointsMaterial({ size: 0.055, intensity: 1.8 }); this.fires = new THREE.Points(fg, this.fireMat); this.fires.frustumCulled = false; this.group.add(this.fires); this.fireGeo = fg;
  }
  update(t) {
    this.sky.material.uniforms.uTime.value = t;
    this.fireMat.uniforms.uTime.value = t;
    const pos = this.fireGeo.attributes.position.array;
    for (let i = 0; i < this.fireBase.length; i++) { const b = this.fireBase[i]; pos[i * 3] = b[0] + Math.sin(t * 0.5 + i) * 0.5; pos[i * 3 + 1] = b[1] + Math.sin(t * 0.7 + i * 1.7) * 0.35; pos[i * 3 + 2] = b[2] + Math.cos(t * 0.45 + i * 0.6) * 0.5; }
    this.fireGeo.attributes.position.needsUpdate = true;
    for (const c of this.clouds) { const a = c.userData.a + t * c.userData.sp; c.position.set(Math.cos(a) * c.userData.d, c.userData.y, Math.sin(a) * c.userData.d); c.lookAt(0, c.userData.y, 0); }
  }
  look() { return { keyDir: [0.5, 0.65, 0.55], rimDir: [-0.35, 0.3, -0.9], keyCol: '#FFF1D0', rimCol: '#43E0FF', rimAmt: 1.0, fogCol: '#2E7FA0', fogDen: 0.018 }; }
}
