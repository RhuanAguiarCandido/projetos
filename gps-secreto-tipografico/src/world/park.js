// Parque ensolarado (como na imagem de referência): céu azul-cobalto, nuvens brancas, gramado vibrante com lâminas em primeiro plano,
// árvores toon instanciadas, flores e partículas de pólen.
import * as THREE from 'three';
import { toonMaterial, STAGE } from './toon.js';
import { pointsMaterial } from './glow.js';
import { rng, col } from '../kit/util.js';

const SKY_VS = `varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * viewMatrix * vec4(position + cameraPosition, 1.0); }`;
const SKY_FS = `precision highp float; varying vec3 vD; uniform vec3 uTop, uMid, uHor, uSun; uniform vec3 uSunDir; uniform float uTime;
void main(){
  float y = clamp(vD.y, -0.1, 1.0);
  vec3 c = mix(uHor, uMid, smoothstep(0.0, 0.32, y)); c = mix(c, uTop, smoothstep(0.25, 0.95, y));
  float s = max(dot(vD, uSunDir), 0.0);
  c += uSun * (pow(s, 12.0) * 0.18 + pow(s, 90.0) * 0.8);
  gl_FragColor = vec4(c, 1.0); }`;

const GROUND_VS = `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const GROUND_FS = `precision highp float; varying vec3 vW; uniform vec3 uA, uB, uFogCol; uniform float uFogDen; uniform float uWorn;
float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void main(){
  float r = length(vW.xz);
  float stripe = step(0.0, sin(vW.x * 0.9 + vW.z * 0.3));
  vec3 c = mix(uA, uB, stripe * 0.6);
  c *= 0.96 + 0.08 * smoothstep(0.0, 1.0, sin(vW.x * 0.37) * sin(vW.z * 0.41) * 0.5 + 0.5);   // variação suave de tom
  float ring = smoothstep(0.13, 0.0, abs(r - 0.8)) * uWorn;                                // trilha gasta onde o cão gira
  c = mix(c, vec3(0.55, 0.40, 0.20), ring * 0.8);
  float d = length(cameraPosition - vW); c = mix(c, uFogCol, 1.0 - exp(-pow(d * uFogDen, 2.0)));
  gl_FragColor = vec4(c, 1.0); }`;

const BLADE_VS = `uniform float uTime; varying float vH; varying vec3 vW;
void main(){
  vec3 p = position; float hgt = p.y; vH = clamp(hgt / 0.5, 0.0, 1.0);
  vec4 ip = instanceMatrix * vec4(p, 1.0); vec3 base = instanceMatrix[3].xyz;
  float sway = sin(uTime * 1.9 + base.x * 1.3 + base.z * 0.9) * 0.05 * vH * vH;
  ip.x += sway; ip.z += sway * 0.6;
  vec4 w = modelMatrix * ip; vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const BLADE_FS = `precision highp float; varying float vH; varying vec3 vW; uniform vec3 uBase, uTip, uFogCol; uniform float uFogDen;
void main(){ vec3 c = mix(uBase, uTip, smoothstep(0.0, 1.0, vH)); float d = length(cameraPosition - vW); c = mix(c, uFogCol, 1.0 - exp(-pow(d * uFogDen, 2.0))); gl_FragColor = vec4(c, 1.0); }`;

export class Park {
  constructor() {
    this.group = new THREE.Group();
    const sunDir = new THREE.Vector3(-0.55, 0.5, 0.65).normalize(); this.sunDir = sunDir;
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(300, 32, 20), new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, vertexShader: SKY_VS, fragmentShader: SKY_FS,
      uniforms: { uTop: { value: col('#0A3AB8') }, uMid: { value: col('#2A78E8') }, uHor: { value: col('#8CC4FF') }, uSun: { value: col('#FFE9B0') }, uSunDir: { value: sunDir }, uTime: { value: 0 } } }));
    this.sky.frustumCulled = false; this.sky.renderOrder = -10; this.group.add(this.sky);

    this.ground = new THREE.Mesh(new THREE.CircleGeometry(160, 72), new THREE.ShaderMaterial({ vertexShader: GROUND_VS, fragmentShader: GROUND_FS,
      uniforms: { uA: { value: col('#2E9B38') }, uB: { value: col('#46B847') }, uFogCol: STAGE.uFogCol, uFogDen: STAGE.uFogDen, uWorn: { value: 0 } } }));
    this.ground.rotation.x = -Math.PI / 2; this.group.add(this.ground);

    const R = rng(11);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), p = new THREE.Vector3();
    // árvores (tronco + 3 copas) instanciadas
    const N = 28, trunk = new THREE.CylinderGeometry(0.16, 0.24, 1.6, 8); trunk.translate(0, 0.8, 0);
    const crown = new THREE.IcosahedronGeometry(1, 2);
    const mTrunk = new THREE.InstancedMesh(trunk, toonMaterial({ palette: { base: '#7A5238', shade: '#46301F', light: '#9C6E4B' }, soft: 0.2 }), N);
    const mCrown = new THREE.InstancedMesh(crown, toonMaterial({ palette: { base: '#2E9E40', shade: '#17652C', light: '#7ADB58' }, palette2: { base: '#45B84A', shade: '#1F7A33', light: '#A2EE70' }, gradDir: [0, 1, 0], gradRange: [0.1, 0.9], soft: 0.25, bandA: 0.36, bandB: 0.78 }), N * 3);
    let ci = 0;
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2 + (R() - 0.5) * 0.35, rad = 9 + R() * 22; const x = Math.cos(a) * rad, z = Math.sin(a) * rad;
      const k = 0.8 + R() * 0.9; p.set(x, 0, z); q.setFromEuler(e.set(0, R() * 6.28, 0)); s.set(k, k, k); m4.compose(p, q, s); mTrunk.setMatrixAt(i, m4);
      for (let j = 0; j < 3; j++) { const cr = (1.15 - j * 0.22) * k * (1.3 + R() * 0.3); p.set(x + (R() - 0.5) * 0.5 * k, (1.6 + j * 0.85) * k, z + (R() - 0.5) * 0.5 * k); s.set(cr, cr * 0.85, cr); m4.compose(p, q, s); mCrown.setMatrixAt(ci++, m4); }
    }
    mTrunk.count = N; mCrown.count = ci; mTrunk.frustumCulled = mCrown.frustumCulled = false; this.group.add(mTrunk, mCrown);
    // arbustos + flores
    const bush = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 2), toonMaterial({ palette: { base: '#2A9B3C', shade: '#14602B', light: '#6FD655' }, soft: 0.25 }), 46);
    for (let i = 0; i < 46; i++) { const a = R() * 6.28, rad = 5 + R() * 26; const k = 0.4 + R() * 0.7; p.set(Math.cos(a) * rad, 0.2 * k, Math.sin(a) * rad); q.setFromEuler(e.set(0, R() * 6, 0)); s.set(k * 1.4, k * 0.8, k * 1.2); m4.compose(p, q, s); bush.setMatrixAt(i, m4); }
    bush.frustumCulled = false; this.group.add(bush);
    const NF = 260; const flowers = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.045, 1), toonMaterial({ palette: { base: '#FF9EC4', shade: '#D8608C', light: '#FFD0E2' }, soft: 0.3 }), NF);
    flowers.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(NF * 3), 3);
    const FC = ['#FF8FB8', '#FFFFFF', '#FFD84D', '#FF6F9C', '#C8A6FF'].map((c) => new THREE.Color(c));
    for (let i = 0; i < NF; i++) { const a = R() * 6.28, rad = 4.5 + R() * 20; p.set(Math.cos(a) * rad, 0.15 + R() * 0.08, Math.sin(a) * rad); q.identity(); const k = 0.8 + R() * 0.9; s.set(k, k * 0.8, k); m4.compose(p, q, s); flowers.setMatrixAt(i, m4); }
    flowers.frustumCulled = false; this.group.add(flowers);
    // lâminas de grama (balançam ao vento)
    const bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.Float32BufferAttribute([-0.02, 0, 0, 0.02, 0, 0, 0, 0.5, 0], 3));
    const NB = 3200; const blades = new THREE.InstancedMesh(bg, new THREE.ShaderMaterial({ vertexShader: BLADE_VS, fragmentShader: BLADE_FS, side: THREE.DoubleSide,
      uniforms: { uTime: { value: 0 }, uBase: { value: col('#1F7A2B') }, uTip: { value: col('#9AF05E') }, uFogCol: STAGE.uFogCol, uFogDen: STAGE.uFogDen } }), NB);
    for (let i = 0; i < NB; i++) {
      const a = R() * 6.28, rad = 1.6 + Math.pow(R(), 0.8) * 9; p.set(Math.cos(a) * rad, 0, Math.sin(a) * rad); q.setFromEuler(e.set((R() - 0.5) * 0.5, R() * 6.28, (R() - 0.5) * 0.5)); const k = 0.3 + R() * 0.55; s.set(1.1, k, 1); m4.compose(p, q, s); blades.setMatrixAt(i, m4);
    }
    blades.frustumCulled = false; this.blades = blades; this.group.add(blades);

    // nuvens brancas suaves
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 96; const g = cv.getContext('2d');
    const puff = (x, y, r, a) => { const gr = g.createRadialGradient(x, y, 2, x, y, r); gr.addColorStop(0, `rgba(255,255,255,${a})`); gr.addColorStop(0.6, `rgba(255,255,255,${a * 0.45})`); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 256, 96); };
    puff(70, 56, 38, 0.95); puff(112, 44, 44, 1); puff(158, 52, 40, 0.95); puff(196, 60, 30, 0.85); puff(130, 62, 50, 0.8);
    const tex = new THREE.CanvasTexture(cv); this.clouds = [];
    for (let i = 0; i < 9; i++) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.375), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, color: '#FFFFFF', opacity: 0.85, fog: false }));
      const a = -Math.PI / 2 + (R() - 0.5) * 2.8; const d = 160; m.position.set(Math.cos(a) * d, 30 + R() * 60, Math.sin(a) * d); m.scale.setScalar(55 + R() * 70); m.lookAt(0, m.position.y, 0); m.userData = { a, d, sp: 0.0005 + R() * 0.0007, y: m.position.y }; this.clouds.push(m); this.group.add(m);
    }
    // pólen / partículas de luz
    const F = 90, pos = new Float32Array(F * 3), sz = new Float32Array(F), ph = new Float32Array(F), cc = new Float32Array(F * 3); this.fireBase = [];
    for (let i = 0; i < F; i++) { const a = R() * 6.28, rad = 1.2 + R() * 10; const b = [Math.cos(a) * rad, 0.3 + R() * 3.4, Math.sin(a) * rad]; this.fireBase.push(b); pos.set(b, i * 3); sz[i] = 0.5 + R(); ph[i] = R(); cc.set(R() < 0.7 ? [1, 0.95, 0.7] : [0.8, 0.95, 1], i * 3); }
    const fg = new THREE.BufferGeometry(); fg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); fg.setAttribute('aSize', new THREE.BufferAttribute(sz, 1)); fg.setAttribute('aPh', new THREE.BufferAttribute(ph, 1)); fg.setAttribute('aCol', new THREE.BufferAttribute(cc, 3));
    this.fireMat = pointsMaterial({ size: 0.05, intensity: 1.1 }); this.fires = new THREE.Points(fg, this.fireMat); this.fires.frustumCulled = false; this.group.add(this.fires); this.fireGeo = fg;
  }
  update(t) {
    this.sky.material.uniforms.uTime.value = t; this.blades.material.uniforms.uTime.value = t;
    this.fireMat.uniforms.uTime.value = t;
    const pos = this.fireGeo.attributes.position.array;
    for (let i = 0; i < this.fireBase.length; i++) { const b = this.fireBase[i]; pos[i * 3] = b[0] + Math.sin(t * 0.5 + i) * 0.5; pos[i * 3 + 1] = b[1] + Math.sin(t * 0.7 + i * 1.7) * 0.35; pos[i * 3 + 2] = b[2] + Math.cos(t * 0.45 + i * 0.6) * 0.5; }
    this.fireGeo.attributes.position.needsUpdate = true;
    for (const c of this.clouds) { const a = c.userData.a + t * c.userData.sp; c.position.set(Math.cos(a) * c.userData.d, c.userData.y, Math.sin(a) * c.userData.d); c.lookAt(0, c.userData.y, 0); }
  }
}
