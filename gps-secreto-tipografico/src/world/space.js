// Espaço: Terra pontilhada (continentes de Natural Earth 110m), oceano holográfico, atmosfera, estrelas e linhas do campo dipolar.
import * as THREE from 'three';
import { glowMaterial, pointsMaterial } from './glow.js';
import { rng, col, TAU } from '../kit/util.js';

export async function loadLand(url = '/assets/geo/land.geo.json') {
  const geo = await (await fetch(url)).json();
  const cv = document.createElement('canvas'); cv.width = 2048; cv.height = 1024; const g = cv.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, 2048, 1024); g.fillStyle = '#fff';
  const P = ([lon, lat]) => [(lon + 180) / 360 * 2048, (90 - lat) / 180 * 1024];
  const draw = (poly) => { g.beginPath(); poly.forEach((ring) => { ring.forEach((c, i) => { const [x, y] = P(c); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.closePath(); }); g.fill('evenodd'); };
  for (const f of geo.features) { const G = f.geometry; if (G.type === 'Polygon') draw(G.coordinates); else G.coordinates.forEach(draw); }
  return g.getImageData(0, 0, 2048, 1024);
}

const ATM_VS = `varying vec3 vN, vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * viewMatrix * w; }`;
const ATM_FS = `precision highp float; varying vec3 vN, vW; uniform vec3 uCol; uniform float uInt, uPow;
void main(){ vec3 V = normalize(cameraPosition - vW); float f = pow(max(0.0, 1.0 - abs(dot(normalize(vN), V))), uPow); gl_FragColor = vec4(uCol * uInt * f, f); }`;
const OCEAN_FS = `precision highp float; varying vec3 vN, vW; varying vec3 vP; uniform vec3 uDeep, uShallow, uLine, uSunDir; uniform float uGrid;
void main(){
  vec3 N = normalize(vN); vec3 V = normalize(cameraPosition - vW);
  float nl = dot(N, uSunDir) * 0.5 + 0.5; float fr = pow(1.0 - max(dot(N, V), 0.0), 2.2);
  vec3 c = mix(uDeep, uShallow, nl * 0.8 + fr * 0.5);
  vec3 p = normalize(vP); float lat = asin(p.y), lon = atan(p.z, p.x);
  float gl = smoothstep(0.012, 0.0, abs(fract(lat / 0.2618 + 0.5) - 0.5) * 0.2618) + smoothstep(0.012, 0.0, abs(fract(lon / 0.2618 + 0.5) - 0.5) * 0.2618 * max(0.25, cos(lat)));
  c += uLine * gl * 0.32 * uGrid; c += uLine * fr * 0.55;
  gl_FragColor = vec4(c, 1.0); }`;

export class Space {
  constructor(landImg) {
    this.group = new THREE.Group(); this.earth = new THREE.Group(); this.group.add(this.earth);
    const R = 1;
    // oceano
    this.ocean = new THREE.Mesh(new THREE.SphereGeometry(R * 0.995, 64, 48), new THREE.ShaderMaterial({
      vertexShader: `varying vec3 vN, vW, vP; void main(){ vP = position; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * viewMatrix * w; }`, fragmentShader: OCEAN_FS,
      uniforms: { uDeep: { value: col('#0A1638') }, uShallow: { value: col('#14498A') }, uLine: { value: col('#00D9F5') }, uSunDir: { value: new THREE.Vector3(0.5, 0.4, 0.8).normalize() }, uGrid: { value: 1 } } }));
    this.earth.add(this.ocean);
    // pontos de terra (Fibonacci) — amostra a máscara
    const N = 30000, ga = Math.PI * (3 - Math.sqrt(5)); const P = [], S = [], C = [], Ph = []; const rr = rng(5);
    for (let i = 0; i < N; i++) {
      const y = 1 - (i / (N - 1)) * 2, rad = Math.sqrt(1 - y * y), th = ga * i; const x = Math.cos(th) * rad, z = Math.sin(th) * rad;
      const lat = Math.asin(y), lon = Math.atan2(z, x);
      const u = Math.floor(((lon / Math.PI + 1) / 2) * 2047 + 0.5), v = Math.floor((0.5 - lat / Math.PI) * 1023 + 0.5);
      if (landImg.data[(v * 2048 + u) * 4] < 128) continue;
      P.push(x * R * 1.004, y * R * 1.004, z * R * 1.004); S.push(0.8 + rr() * 0.5); Ph.push(rr()); const k = rr(); C.push(...(k < 0.12 ? [1, 0.85, 0.35] : [0.55, 0.95, 1.0]));
    }
    const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); gg.setAttribute('aSize', new THREE.Float32BufferAttribute(S, 1)); gg.setAttribute('aPh', new THREE.Float32BufferAttribute(Ph, 1)); gg.setAttribute('aCol', new THREE.Float32BufferAttribute(C, 3));
    this.landMat = pointsMaterial({ size: 0.0135, intensity: 1.9, color: '#FFFFFF' }); this.land = new THREE.Points(gg, this.landMat); this.land.frustumCulled = false; this.earth.add(this.land);
    // atmosfera
    this.atm = new THREE.Mesh(new THREE.SphereGeometry(R * 1.13, 48, 32), new THREE.ShaderMaterial({ vertexShader: ATM_VS, fragmentShader: ATM_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.BackSide,
      uniforms: { uCol: { value: col('#19C8FF') }, uInt: { value: 1.6 }, uPow: { value: 2.4 } } }));
    this.atm2 = new THREE.Mesh(new THREE.SphereGeometry(R * 1.02, 48, 32), new THREE.ShaderMaterial({ vertexShader: ATM_VS, fragmentShader: ATM_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.FrontSide,
      uniforms: { uCol: { value: col('#5FE6FF') }, uInt: { value: 1.1 }, uPow: { value: 3.0 } } }));
    this.group.add(this.atm, this.atm2);
    // estrelas
    const NS = 1800, sp = new Float32Array(NS * 3), ss = new Float32Array(NS), sph = new Float32Array(NS), sc = new Float32Array(NS * 3);
    for (let i = 0; i < NS; i++) { const a = rr() * TAU, b = Math.acos(2 * rr() - 1), d = 60 + rr() * 40; sp.set([Math.sin(b) * Math.cos(a) * d, Math.cos(b) * d, Math.sin(b) * Math.sin(a) * d], i * 3); ss[i] = 0.5 + rr() * rr() * 2.2; sph[i] = rr(); const k = rr(); sc.set(k < 0.2 ? [1, 0.9, 0.6] : k < 0.5 ? [0.6, 0.9, 1] : [1, 1, 1], i * 3); }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3)); sg.setAttribute('aSize', new THREE.BufferAttribute(ss, 1)); sg.setAttribute('aPh', new THREE.BufferAttribute(sph, 1)); sg.setAttribute('aCol', new THREE.BufferAttribute(sc, 3));
    this.starMat = pointsMaterial({ size: 2.2, atten: 0, intensity: 1.2, color: '#FFFFFF', depthTest: false }); this.stars = new THREE.Points(sg, this.starMat); this.stars.frustumCulled = false; this.stars.renderOrder = -5; this.group.add(this.stars);
    // poeira próxima (parallax)
    const ND = 220, dp = new Float32Array(ND * 3), dsz = new Float32Array(ND), dph = new Float32Array(ND), dc = new Float32Array(ND * 3);
    for (let i = 0; i < ND; i++) { dp.set([(rr() - 0.5) * 14, (rr() - 0.5) * 14, (rr() - 0.5) * 14], i * 3); dsz[i] = 0.4 + rr(); dph[i] = rr(); dc.set([0.5, 0.9, 1], i * 3); }
    const dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.BufferAttribute(dp, 3)); dg.setAttribute('aSize', new THREE.BufferAttribute(dsz, 1)); dg.setAttribute('aPh', new THREE.BufferAttribute(dph, 1)); dg.setAttribute('aCol', new THREE.BufferAttribute(dc, 3));
    this.dustMat = pointsMaterial({ size: 0.02, intensity: 1.1, color: '#9EEFFF' }); this.dust = new THREE.Points(dg, this.dustMat); this.dust.frustumCulled = false; this.group.add(this.dust);

    const f = makeField(); this.field = f.mesh; this.fieldMat = f.mat; this.earth.add(this.field);
  }

  setScale(k) { this.earth.scale.setScalar(k); this.atm.scale.setScalar(k); this.atm2.scale.setScalar(k); }
  update(t, scaleUniform) {
    this.fieldMat.uniforms.uTime.value = t; for (const m of [this.landMat, this.starMat, this.dustMat]) { m.uniforms.uTime.value = t; if (scaleUniform) m.uniforms.uScale.value = scaleUniform; }
    this.land.rotation.y = t * 0.05;
  }
}

// linhas dipolares r = L cos^2(lat): tubos finos com pulsos viajando do Sul ao Norte
export function makeField(shellsIn) {
    const shells = shellsIn ?? [1.55, 1.95, 2.5, 3.2], M = 14, SEG = 90, TUBE = 6;
    const pos = [], aT = [], aS = [], aId = [], idx = []; let vbase = 0; const rr = rng(9);
    shells.forEach((L, si) => {
      const lmax = Math.acos(Math.sqrt(1.02 / L));
      for (let m = 0; m < M; m++) {
        const ph = (m / M) * TAU + si * 0.21; const id = rr(); const pts = [];
        for (let i = 0; i <= SEG; i++) { const lat = -lmax + (2 * lmax * i) / SEG; const r = L * Math.cos(lat) ** 2; pts.push(new THREE.Vector3(r * Math.cos(lat) * Math.cos(ph), r * Math.sin(lat), r * Math.cos(lat) * Math.sin(ph))); }
        const rad = 0.0052 + si * 0.0008;
        for (let i = 0; i <= SEG; i++) {
          const p = pts[i], tang = pts[Math.min(SEG, i + 1)].clone().sub(pts[Math.max(0, i - 1)]).normalize(); const ref = Math.abs(tang.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
          const nrm = new THREE.Vector3().crossVectors(tang, ref).normalize(), bin = new THREE.Vector3().crossVectors(tang, nrm).normalize();
          for (let k = 0; k < TUBE; k++) { const a = (k / TUBE) * TAU; const q = p.clone().addScaledVector(nrm, Math.cos(a) * rad).addScaledVector(bin, Math.sin(a) * rad); pos.push(q.x, q.y, q.z); aT.push(i / SEG); aS.push(si); aId.push(id); }
        }
        for (let i = 0; i < SEG; i++) for (let k = 0; k < TUBE; k++) { const a = vbase + i * TUBE + k, b = vbase + i * TUBE + (k + 1) % TUBE, c = vbase + (i + 1) * TUBE + k, d = vbase + (i + 1) * TUBE + (k + 1) % TUBE; idx.push(a, b, c, b, d, c); }
        vbase += (SEG + 1) * TUBE;
      }
    });
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('aT', new THREE.Float32BufferAttribute(aT, 1)); g.setAttribute('aS', new THREE.Float32BufferAttribute(aS, 1)); g.setAttribute('aId', new THREE.Float32BufferAttribute(aId, 1)); g.setIndex(idx);
    const mat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      uniforms: { uDraw: { value: 0 }, uTime: { value: 0 }, uOpacity: { value: 1 }, uCol: { value: col('#00D9F5') }, uPulse: { value: col('#FFF6C8') }, uInt: { value: 1.0 } },
      vertexShader: `attribute float aT, aS, aId; varying float vT, vS, vId; void main(){ vT = aT; vS = aS; vId = aId; gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0); }`,
      fragmentShader: `precision highp float; varying float vT, vS, vId; uniform float uDraw, uTime, uOpacity, uInt; uniform vec3 uCol, uPulse;
        void main(){ float s = 1.0 - abs(2.0 * vT - 1.0);                       // 0 nos polos, 1 no equador
          float on = smoothstep(uDraw - 0.12, uDraw, s * 0.82 + vS * 0.05); on = 1.0 - on;  
          float p = fract(vT * 2.0 - uTime * 0.28 + vId * 3.0); float pulse = smoothstep(0.0, 0.03, p) * smoothstep(0.28, 0.03, p);
          vec3 c = uCol * (0.28 + 0.22 * s) + uPulse * pulse * 1.0; gl_FragColor = vec4(c * uInt, on * uOpacity * (0.55 + pulse)); }` });
    const mesh = new THREE.Mesh(g, mat); mesh.frustumCulled = false; mesh.renderOrder = 2; mat.uniforms.uDraw.value = 1.2; return { mesh, mat };
}
