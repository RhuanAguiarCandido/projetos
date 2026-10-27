// Parque: céu procedural, gramado de lâminas (instanciadas), árvores, colinas, poeira luminosa.
import * as THREE from 'three';
import { lightU } from './fur.js';

function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

const skyVS = /* glsl */ `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position.z = gl_Position.w * 0.9999; }`;
const skyFS = /* glsl */ `
precision highp float; varying vec3 vDir;
uniform vec3 uTop, uMid, uHor, uSunCol, uSunDir; uniform float uTime, uCloud, uSunGlow;
float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f); return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }
float fbm(vec2 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++){ s += a * vn(p); p = p * 2.03 + 11.7; a *= 0.5; } return s; }
void main(){
  vec3 d = normalize(vDir);
  float y = clamp(d.y, -0.2, 1.0);
  vec3 col = mix(uHor, uMid, smoothstep(0.0, 0.22, y));
  col = mix(col, uTop, smoothstep(0.18, 0.85, y));
  float sd = max(dot(d, normalize(uSunDir)), 0.0);
  col += uSunCol * (pow(sd, 6.0) * 0.55 + pow(sd, 90.0) * 1.8) * uSunGlow;
  // nuvens
  vec2 cp = d.xz / (d.y + 0.35) * 1.6 + vec2(uTime * 0.012, 0.0);
  float c = fbm(cp * 1.3);
  float cov = smoothstep(0.50, 0.78, c) * uCloud * smoothstep(0.02, 0.25, d.y);
  vec3 cc = mix(vec3(0.78, 0.9, 1.0), vec3(1.0, 0.96, 0.88), smoothstep(0.4, 0.8, c) * 0.7 + sd * 0.5);
  col = mix(col, cc, cov * 0.92);
  gl_FragColor = vec4(col, 1.0);
}`;

const grassVS = /* glsl */ `
precision highp float;
attribute vec3 aOff; attribute vec4 aRnd; // x=altura y=rotação z=curvatura w=semente de cor
uniform float uTime, uWind;
varying vec3 vCol; varying float vT; varying vec3 vN; varying vec3 vWorld; varying float vSeed;
void main(){
  float h = aRnd.x, rot = aRnd.y, bend = aRnd.z;
  float t = position.y;                       // 0..1 ao longo da lâmina
  float w = position.x * (1.0 - t * 0.92);    // afina até a ponta
  float c = cos(rot), s = sin(rot);
  vec3 p = vec3(w * c, t * h, w * s);
  vec2 fwd = vec2(-s, c);
  float sway = sin(uTime * 1.7 + aOff.x * 1.3 + aOff.z * 0.9) * 0.5 + sin(uTime * 3.1 + aOff.x * 3.7) * 0.18;
  float k = t * t;
  p.xz += fwd * (bend * h * k + sway * uWind * 0.06 * h * k);
  p.y -= (bend * h * k) * 0.25;
  vec3 world = aOff + p;
  vN = normalize(vec3(-fwd.x * 0.6, 0.8, -fwd.y * 0.6));
  vWorld = world; vT = t; vSeed = aRnd.w;
  gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
}`;
const grassFS = /* glsl */ `
precision highp float;
uniform vec3 uBase, uTipC, uKey, uKeyCol, uRimDir, uRimCol, uSky, uFog; uniform float uFogDen;
uniform vec4 uDog; uniform vec2 uDogR; uniform float uAO;
varying vec3 vCol; varying float vT; varying vec3 vN; varying vec3 vWorld; varying float vSeed;
void main(){
  vec3 col = mix(uBase, uTipC, pow(vT, 0.8));
  col *= 0.8 + 0.4 * vSeed;
  col = mix(col, col * vec3(1.15, 1.1, 0.6), step(0.93, vSeed) * 0.7);   // alguns fios amarelados
  vec3 N = normalize(vN);
  float kd = clamp(dot(N, normalize(uKey)) * 0.5 + 0.55, 0.0, 1.0);
  vec3 V = normalize(cameraPosition - vWorld);
  float trans = pow(clamp(dot(-V, normalize(uKey)), 0.0, 1.0), 2.0) * vT;      // luz atravessando a lâmina
  vec3 lit = col * (uKeyCol * kd + uSky * 0.7) + col * uKeyCol * trans * 1.2 + uRimCol * pow(1.0 - abs(dot(N, V)), 3.0) * 0.08 * vT;
  lit *= mix(0.45, 1.0, pow(vT, 0.7));                                           // AO natural na base
  // sombra de contato do cachorro (elipse no espaço do cachorro)
  vec2 q = vWorld.xz - uDog.xy; vec2 qd = vec2(q.x * uDog.w - q.y * uDog.z, q.x * uDog.z + q.y * uDog.w);
  float occ = exp(-dot(qd / uDogR, qd / uDogR) * 1.6);
  lit *= 1.0 - occ * uAO;
  float dist = length(cameraPosition - vWorld);
  lit = mix(lit, uFog, 1.0 - exp(-dist * dist * uFogDen));
  gl_FragColor = vec4(lit, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

const groundFS = /* glsl */ `
precision highp float; varying vec3 vW;
uniform vec3 uA, uB, uSky, uKeyCol, uFog; uniform vec4 uDog; uniform vec2 uDogR; uniform float uAO, uFogDen;
float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f); return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }
void main(){
  // listras de gramado cortado + manchas
  float stripe = smoothstep(0.35, 0.65, abs(fract(vW.x * 0.35 + vW.z * 0.12) - 0.5) * 2.0);
  float n = vn(vW.xz * 1.3);
  vec3 col = mix(uA, uB, stripe * 0.55 + n * 0.5);
  col *= (uKeyCol * 0.55 + uSky * 0.55);
  vec2 q = vW.xz - uDog.xy; vec2 qd = vec2(q.x * uDog.w - q.y * uDog.z, q.x * uDog.z + q.y * uDog.w);
  col *= 1.0 - exp(-dot(qd / uDogR, qd / uDogR) * 1.6) * uAO;
  float dist = length(cameraPosition - vW);
  col = mix(col, uFog, 1.0 - exp(-dist * dist * uFogDen));
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export class Park {
  constructor() {
    this.scene = new THREE.Scene(); this.holo = new THREE.Scene();
    const S = this.scene;
    this.fogColor = new THREE.Color('#bfe9f0');
    this.fogDen = 0.0012;

    // luzes (para materiais padrão: olhos, nariz, árvores)
    this.key = new THREE.DirectionalLight('#ffe7b0', 2.6); this.key.position.set(5, 7, 6); S.add(this.key);
    this.rim = new THREE.DirectionalLight('#00d9f5', 2.2); this.rim.position.set(-6, 3, -7); S.add(this.rim);
    this.hemi = new THREE.HemisphereLight('#9fe3ff', '#3c8a3a', 1.0); S.add(this.hemi);

    // céu
    this.skyU = {
      uTop: { value: new THREE.Color('#1c8bd4') }, uMid: { value: new THREE.Color('#5fd2f4') }, uHor: { value: new THREE.Color('#d9f6f0') },
      uSunCol: { value: new THREE.Color('#ffd98a') }, uSunDir: { value: new THREE.Vector3(0.45, 0.28, 0.85) }, uTime: { value: 0 }, uCloud: { value: 1 }, uSunGlow: { value: 1 },
    };
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(300, 48, 24), new THREE.ShaderMaterial({ vertexShader: skyVS, fragmentShader: skyFS, uniforms: this.skyU, side: THREE.BackSide, depthWrite: false }));
    this.sky.renderOrder = -10; this.sky.frustumCulled = false; S.add(this.sky);

    // chão
    this.dogU = { uDog: { value: new THREE.Vector4(0, 0, 0, 1) }, uDogR: { value: new THREE.Vector2(0.42, 0.78) }, uAO: { value: 0.65 } };
    this.gU = {
      uA: { value: new THREE.Color('#1c7a2a') }, uB: { value: new THREE.Color('#47b83c') }, uSky: lightU.uSky, uKeyCol: { value: new THREE.Color('#ffe7b0') },
      uFog: { value: this.fogColor }, uFogDen: { value: this.fogDen }, ...this.dogU,
    };
    const gm = new THREE.ShaderMaterial({
      vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
      fragmentShader: groundFS, uniforms: this.gU,
    });
    this.ground = new THREE.Mesh(new THREE.CircleGeometry(260, 64), gm); this.ground.rotation.x = -Math.PI / 2; S.add(this.ground);

    // lâminas
    this.grassU = {
      uTime: { value: 0 }, uWind: { value: 1 }, uBase: { value: new THREE.Color('#14631f') }, uTipC: { value: new THREE.Color('#9be84f') },
      uKey: { value: lightU.uKeyDir.value }, uKeyCol: { value: new THREE.Color('#ffe7b0') }, uRimDir: lightU.uRimDir, uRimCol: lightU.uRimCol, uSky: lightU.uSky,
      uFog: { value: this.fogColor }, uFogDen: { value: this.fogDen }, ...this.dogU,
    };
    this.grassMat = new THREE.ShaderMaterial({ vertexShader: grassVS, fragmentShader: grassFS, uniforms: this.grassU, side: THREE.DoubleSide });
    this._addGrass(44000, 3.2, 0.0, 0.15, 0.012, 1, 3, 1.0);
    this._addGrass(16000, 9.5, 3.1, 0.30, 0.032, 2, 2, 2.5);
    this._addFlowers();
    this._addTrees();
    this._addDust();
    this._addQ();
  }

  _addQ() {
    const c = document.createElement('canvas'); c.width = 512; c.height = 640; const g = c.getContext('2d');
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '620px Anton, sans-serif';
    for (let k = 26; k >= 1; k--) { g.fillStyle = k > 20 ? '#06102a' : '#0b1938'; g.fillText('?', 256 + k * 0.7, 330 + k * 0.9); }
    g.shadowColor = '#f9d548'; g.shadowBlur = 40; g.fillStyle = '#f9d548'; g.fillText('?', 256, 330); g.shadowBlur = 0;
    const gr = g.createLinearGradient(0, 40, 0, 600); gr.addColorStop(0, '#fff6b0'); gr.addColorStop(0.5, '#f9d548'); gr.addColorStop(1, '#f1a91f'); g.fillStyle = gr; g.fillText('?', 256, 330);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.premultiplyAlpha = true;
    this.qMat = new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, toneMapped: false });
    this.qMat.color.setScalar(1.15);
    this.qMark = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 4.0), this.qMat); this.qMark.visible = false; this.qMark.renderOrder = 3; this.holo.add(this.qMark);
  }

  _addGrass(n, rMax, rMin, hMax, wBlade, seed, segs = 4, cell = 1.2) {
    const R = rng(1234 + seed);
    const pos = [], idx = [];
    for (let i = 0; i <= segs; i++) { const t = i / segs; pos.push(-wBlade, t, 0, wBlade, t, 0); }
    for (let i = 0; i < segs; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    const base = new THREE.BufferGeometry(); base.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); base.setIndex(idx);
    // distribui as lâminas e agrupa em células espaciais (frustum culling por bloco)
    const cells = new Map();
    for (let i = 0; i < n; i++) {
      const a = R() * Math.PI * 2, r = Math.sqrt(rMin * rMin + R() * (rMax * rMax - rMin * rMin));
      const x = Math.cos(a) * r, z = Math.sin(a) * r; const key = Math.floor(x / cell) + ',' + Math.floor(z / cell);
      let c = cells.get(key); if (!c) { c = { off: [], rnd: [], cx: (Math.floor(x / cell) + 0.5) * cell, cz: (Math.floor(z / cell) + 0.5) * cell }; cells.set(key, c); }
      c.off.push(x, 0, z); c.rnd.push(hMax * (0.55 + R() * 0.65), R() * Math.PI * 2, 0.15 + R() * 0.55, R());
    }
    for (const c of cells.values()) {
      const g = new THREE.InstancedBufferGeometry(); g.setAttribute('position', base.attributes.position); g.setIndex(base.index);
      g.setAttribute('aOff', new THREE.InstancedBufferAttribute(new Float32Array(c.off), 3)); g.setAttribute('aRnd', new THREE.InstancedBufferAttribute(new Float32Array(c.rnd), 4));
      g.instanceCount = c.off.length / 3; g.boundingSphere = new THREE.Sphere(new THREE.Vector3(c.cx, hMax * 0.5, c.cz), cell * 0.75 + hMax);
      const m = new THREE.Mesh(g, this.grassMat); m.frustumCulled = true; m.userData.grass = true; this.scene.add(m);
    }
  }

  _addFlowers() {
    const R = rng(77); const n = 260;
    const g = new THREE.CircleGeometry(0.035, 10);
    const mesh = new THREE.InstancedMesh(g, new THREE.MeshBasicMaterial({ color: '#ffffff', side: THREE.DoubleSide }), n);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    const col = new THREE.Color();
    for (let i = 0; i < n; i++) {
      const a = R() * 6.28, r = 0.5 + R() * 6.5, y = 0.11 + R() * 0.04;
      e.set(-Math.PI / 2 + (R() - 0.5) * 0.5, 0, R() * 6.28); q.setFromEuler(e);
      m.compose(new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r), q, new THREE.Vector3(1, 1, 1).multiplyScalar(0.7 + R() * 0.8));
      mesh.setMatrixAt(i, m); col.set(R() < 0.7 ? '#ffffff' : R() < 0.5 ? '#ffe36a' : '#ffb6d9'); mesh.setColorAt(i, col);
    }
    mesh.frustumCulled = false; this.scene.add(mesh); this.flowers = mesh;
  }

  _addTrees() {
    const R = rng(4242);
    // tudo instanciado: troncos, copas (cor por instância) e colinas = 3 draw calls
    const ico = new THREE.IcosahedronGeometry(1, 2);
    const nz = new THREE.Vector3(); const pos = ico.attributes.position;
    for (let i = 0; i < pos.count; i++) { nz.fromBufferAttribute(pos, i); const k = 1 + 0.18 * Math.sin(nz.x * 5.1 + nz.y * 3.7) * Math.cos(nz.z * 4.3 + nz.x * 2.2); pos.setXYZ(i, nz.x * k, nz.y * k, nz.z * k); }
    ico.computeVertexNormals();
    const leafCols = ['#2f9e44', '#3fb34f', '#2a8a45', '#58c25a', '#1f7d3b'].map((c) => new THREE.Color(c));
    const trunks = [], canopies = [];
    const place = (x, z, s) => {
      const th = 2.2 * s; trunks.push({ x, z, s, th });
      const col = leafCols[Math.floor(R() * leafCols.length)];
      for (let j = 0; j < 4; j++) { const sc = (1.7 + R() * 1.0) * s; canopies.push({ x: x + (R() - 0.5) * 2.2 * s, y: th + 0.9 * s + R() * 1.6 * s, z: z + (R() - 0.5) * 2.2 * s, sx: sc, sy: sc * (0.85 + R() * 0.2), col }); }
    };
    for (let i = 0; i < 46; i++) { const a = (i / 46) * Math.PI * 2 + R() * 0.2, r = 30 + R() * 45; place(Math.cos(a) * r, Math.sin(a) * r, 1.0 + R() * 1.4); }
    for (let i = 0; i < 12; i++) { const a = R() * Math.PI * 2, r = 17 + R() * 8; place(Math.cos(a) * r, Math.sin(a) * r, 0.55 + R() * 0.45); }
    this.trees = new THREE.Group();
    const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), V = new THREE.Vector3(), Sc = new THREE.Vector3();
    const trunkMesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.16, 0.26, 1, 7), new THREE.MeshStandardMaterial({ color: '#6b4a2b', roughness: 0.95 }), trunks.length);
    trunks.forEach((t, i) => { M.compose(V.set(t.x, t.th / 2, t.z), Q.identity(), Sc.set(t.s, t.th, t.s)); trunkMesh.setMatrixAt(i, M); });
    const canMesh = new THREE.InstancedMesh(ico, new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.9 }), canopies.length);
    canopies.forEach((c, i) => { M.compose(V.set(c.x, c.y, c.z), Q.identity(), Sc.set(c.sx, c.sy, c.sx)); canMesh.setMatrixAt(i, M); canMesh.setColorAt(i, c.col); });
    const hillMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 20, 10), new THREE.MeshStandardMaterial({ color: '#2f9a46', roughness: 1 }), 9);
    for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2 + 0.3, r = 95; M.compose(V.set(Math.cos(a) * r, 0, Math.sin(a) * r), Q.identity(), Sc.set(40 + R() * 25, 9 + R() * 8, 30 + R() * 20)); hillMesh.setMatrixAt(i, M); }
    [trunkMesh, canMesh, hillMesh].forEach((m) => { m.frustumCulled = false; this.trees.add(m); });
    this.scene.add(this.trees);
    this.scene.fog = new THREE.FogExp2(this.fogColor, 0.02);
  }

  _addDust() {
    const R = rng(909); const n = 100;
    const pos = new Float32Array(n * 3), rnd = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) { pos[i * 3] = (R() - 0.5) * 9; pos[i * 3 + 1] = 0.2 + R() * 3.2; pos[i * 3 + 2] = (R() - 0.5) * 9; rnd[i * 4] = R(); rnd[i * 4 + 1] = R(); rnd[i * 4 + 2] = R(); rnd[i * 4 + 3] = R(); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aRnd', new THREE.BufferAttribute(rnd, 4));
    this.dustU = { uTime: { value: 0 }, uScale: { value: 1080 }, uAmt: { value: 1 } };
    const m = new THREE.ShaderMaterial({
      uniforms: this.dustU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: `attribute vec4 aRnd; uniform float uTime, uScale; varying vec4 vR; varying float vFade;
        void main(){ vR = aRnd; vec3 p = position; p.y += mod(uTime * (0.05 + aRnd.x * 0.12) + aRnd.y * 3.0, 3.4); p.x += sin(uTime * 0.4 + aRnd.z * 20.0) * 0.4; p.z += cos(uTime * 0.35 + aRnd.w * 20.0) * 0.4;
          p.y = mod(p.y, 3.4) + 0.1; vec4 mv = viewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv;
          float sz = (0.05 + aRnd.x * 0.1) * uScale * 1.7 / max(-mv.z, 0.3); gl_PointSize = clamp(sz, 2.0, 52.0); vFade = smoothstep(0.0, 0.6, p.y) * (1.0 - smoothstep(2.6, 3.4, p.y)); }`,
      fragmentShader: `precision highp float; varying vec4 vR; varying float vFade; uniform float uAmt;
        void main(){ vec2 c = gl_PointCoord - 0.5; float d = length(c); float a = smoothstep(0.5, 0.0, d); a = a * a; vec3 col = mix(vec3(1.0, 0.86, 0.45), vec3(0.4, 0.95, 1.0), step(0.7, vR.z));
          gl_FragColor = vec4(col * a * 0.9 * uAmt, a * vFade * uAmt); }`,
    });
    this.dust = new THREE.Points(g, m); this.dust.frustumCulled = false; this.scene.add(this.dust);
  }

  // look: { top, mid, hor, fog, key, rim, ... } cores em hex; mood interpola
  setTime(t) {
    this.skyU.uTime.value = t; this.grassU.uTime.value = t; this.dustU.uTime.value = t; lightU.uTime.value = t;
  }
  setDog(pos, yaw) {
    this.dogU.uDog.value.set(pos.x, pos.z, Math.sin(yaw), Math.cos(yaw));
  }
  setLook(L) {
    const c = (o, v) => o.set(v);
    if (L.top) c(this.skyU.uTop.value, L.top); if (L.mid) c(this.skyU.uMid.value, L.mid); if (L.hor) c(this.skyU.uHor.value, L.hor);
    if (L.fog) { this.fogColor.set(L.fog); this.scene.fog.color.copy(this.fogColor); }
    if (L.fogDen !== undefined) { this.fogDen = L.fogDen; this.grassU.uFogDen.value = L.fogDen * 0.14; this.gU.uFogDen.value = L.fogDen * 0.14; this.scene.fog.density = L.fogDen; }
    if (L.sun) this.skyU.uSunCol.value.set(L.sun);
    if (L.sunDir) { this.skyU.uSunDir.value.fromArray(L.sunDir); }
    if (L.cloud !== undefined) this.skyU.uCloud.value = L.cloud;
    if (L.sunGlow !== undefined) this.skyU.uSunGlow.value = L.sunGlow;
    if (L.key) { this.key.color.set(L.key); lightU.uKeyCol.value.set(L.key).multiplyScalar(0.58 * (L.keyI ?? 1.25)); this.grassU.uKeyCol.value.set(L.key); this.gU.uKeyCol.value.set(L.key); }
    if (L.keyI !== undefined) { this.key.intensity = 2.0 * L.keyI; }
    if (L.keyDir) { lightU.uKeyDir.value.fromArray(L.keyDir).normalize(); this.key.position.copy(lightU.uKeyDir.value).multiplyScalar(8); }
    if (L.rim) { this.rim.color.set(L.rim); lightU.uRimCol.value.set(L.rim).multiplyScalar(0.8 * (L.rimI ?? 1.9)); }
    if (L.rimI !== undefined) this.rim.intensity = 1.2 * L.rimI;
    if (L.rimDir) { lightU.uRimDir.value.fromArray(L.rimDir).normalize(); this.rim.position.copy(lightU.uRimDir.value).multiplyScalar(8); }
    if (L.sky) { lightU.uSky.value.set(L.sky).multiplyScalar(0.62 * (L.skyI ?? 0.55)); this.hemi.color.set(L.sky); }
    if (L.ground) { lightU.uGround.value.set(L.ground).multiplyScalar(0.4); this.hemi.groundColor.set(L.ground); }
    if (L.grassBase) this.grassU.uBase.value.set(L.grassBase); if (L.grassTip) this.grassU.uTipC.value.set(L.grassTip);
    if (L.gA) this.gU.uA.value.set(L.gA); if (L.gB) this.gU.uB.value.set(L.gB);
    if (L.dust !== undefined) this.dustU.uAmt.value = L.dust;
    if (L.flowers !== undefined) this.flowers.visible = L.flowers;
  }
}
