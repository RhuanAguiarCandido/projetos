// Bússola holográfica 3D (plana no plano XZ, Norte = -Z) + palco dos 70 cães com histograma polar.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { glowMaterial } from './glow.js';
import { TextBlock } from '../kit/text.js';
import { col, rng, TAU, BRAND } from '../kit/util.js';

function ringGeo(r0, r1, seg = 128, a0 = 0, a1 = TAU) { return new THREE.RingGeometry(r0, r1, seg, 1, a0, a1 - a0); }
// marcas radiais como quads finos
function tickGeo(r, len, w, n, every, longLen) {
  const P = [], I = []; let b = 0;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU, L = i % every === 0 ? longLen : len, c = Math.cos(a), s = Math.sin(a), ww = i % every === 0 ? w * 1.7 : w;
    const px = -s * ww, pz = c * ww;
    const x0 = c * r, z0 = s * r, x1 = c * (r - L), z1 = s * (r - L);
    P.push(x0 - px, 0, z0 - pz, x0 + px, 0, z0 + pz, x1 + px, 0, z1 + pz, x1 - px, 0, z1 - pz); I.push(b, b + 1, b + 2, b, b + 2, b + 3); b += 4;
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setIndex(I); return g;
}
function diamond(w, h, depth) {
  const s = new THREE.Shape(); s.moveTo(0, h); s.lineTo(w, 0); s.lineTo(0, -h * 0.12); s.lineTo(-w, 0); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false }); g.translate(0, 0, -depth / 2); return g;
}

export class Compass {
  constructor(tf) {
    this.group = new THREE.Group(); this.root = new THREE.Group(); this.group.add(this.root);
    const R = 1;
    const m = (c, i, o = 1, extra = {}) => glowMaterial({ color: c, intensity: i, opacity: o, ...extra });
    this.mats = [];
    const add = (geo, mat, rotX = true) => { const o = new THREE.Mesh(geo, mat); if (rotX) o.rotation.x = -Math.PI / 2; this.root.add(o); this.mats.push(mat); mat.userData = { base: mat.uniforms.uOpacity.value }; return o; };
    // disco de vidro + anéis
    this.disc = add(new THREE.CircleGeometry(R * 1.04, 96), m('#0A2A5A', 0.9, 0.55, { additive: false, depthTest: true }));
    this.disc.position.y = -0.01;
    this.ring1 = add(ringGeo(R * 0.968, R * 1.0), m('#F9D548', 2.0));            // aro dourado (como na referência)
    {   // rosa dos ventos de 8 pontas, brilhando em ciano sob a agulha (Norte em -Z)
      const sh = new THREE.Shape();
      for (let i = 0; i < 16; i++) { const a = (i / 16) * TAU, r = i % 2 ? 0.17 : (i % 4 === 0 ? 0.80 : 0.52); const x = Math.sin(a) * r, y = Math.cos(a) * r; i ? sh.lineTo(x, y) : sh.moveTo(x, y); }
      sh.closePath(); this.rose = add(new THREE.ShapeGeometry(sh), m('#7FEFFF', 1.25, 0.6)); this.rose.position.y = 0.003;
    }
    this.ring2 = add(ringGeo(R * 0.80, R * 0.806), m('#00D9F5', 1.4, 0.8));
    this.ring3 = add(ringGeo(R * 0.52, R * 0.524), m('#9EEFFF', 1.2, 0.6));
    this.ticks = add(tickGeo(R * 0.97, R * 0.035, 0.0035, 120, 10, R * 0.09), m('#BFF6FF', 1.6), false);
    this.ticks.position.y = 0.002;
    this.scan = add(ringGeo(0, R * 0.98, 64, 0, 0.9), m('#00D9F5', 0.7, 0.28)); this.scan.position.y = 0.004;
    // rosa dos ventos em português: N L S O
    this.letters = [];
    const L = [['N', 0, '#F9D548'], ['L', 1, '#FFFFFF'], ['S', 2, '#FFFFFF'], ['O', 3, '#FFFFFF']];
    for (const [ch, k, c] of L) {
      const tb = new TextBlock(tf, ch, { size: 0.22, depth: 0.03, bevel: 0.004, colorA: c, colorB: c, emis: c === '#FFFFFF' ? '#2A5A70' : '#6A5300', amb: 0.9, spec: 0.1 });
      const a = -Math.PI / 2 + k * Math.PI / 2; tb.group.position.set(Math.cos(a) * 0.68, 0.04, Math.sin(a) * 0.68); tb.group.rotation.x = -Math.PI / 2; this.root.add(tb.group); this.letters.push(tb);
    }
    // agulha: ponta Norte (amarela) e Sul (ciano)
    this.needle = new THREE.Group(); this.root.add(this.needle);
    const nMat = new THREE.MeshBasicMaterial({ color: col('#F9D548') }), sMat = new THREE.MeshBasicMaterial({ color: col('#EAF8FF') });
    const nG = diamond(0.085, 0.5, 0.03), sG = diamond(0.085, 0.5, 0.03);
    const n = new THREE.Mesh(nG, nMat); n.rotation.x = -Math.PI / 2; n.rotation.z = 0; this.needle.add(n);
    const s = new THREE.Mesh(sG, sMat); s.rotation.x = -Math.PI / 2; s.rotation.z = Math.PI; this.needle.add(s);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.05, 24), new THREE.MeshBasicMaterial({ color: col('#FFFFFF') })); this.needle.add(hub);
    this.needle.position.y = 0.03; this.nMat = nMat; this.sMat = sMat;
    // anel de cantos (tracejado) orbitando
    const dash = tickGeo(R * 1.1, 0.07, 0.006, 48, 1, 0.07); this.orbit = add(dash, m('#F9D548', 1.3, 0.9), false);
  }
  setOpacity(v) { for (const mt of this.mats) mt.uniforms.uOpacity.value = mt.userData.base * v; for (const l of this.letters) l.setOpacity(v); this.group.visible = v > 0.001; }
  update(t, needleYaw = 0) {
    this.ring2.rotation.z = t * 0.2; this.scan.rotation.z = -t * 1.6; this.orbit.rotation.y = -t * 0.35;
    this.needle.rotation.y = needleYaw;
  }
}

// ---------- 70 cães vistos de cima: marcador em forma de cão (corpo, cabeça, orelhas, rabo) apontando para +X local
function dogIconGeo() {
  const parts = [];
  const ell = (cx, cy, rx, ry, rot = 0) => { const s = new THREE.Shape(); s.absellipse(cx, cy, rx, ry, 0, TAU, false, rot); return new THREE.ShapeGeometry(s, 16); };
  parts.push(ell(0, 0, 0.30, 0.15), ell(0.30, 0, 0.13, 0.115), ell(0.40, 0, 0.065, 0.05), ell(0.27, 0.115, 0.07, 0.04, 0.5), ell(0.27, -0.115, 0.07, 0.04, -0.5), ell(-0.34, 0.03, 0.14, 0.04, 0.35));
  const g = mergeGeometries(parts); g.rotateX(-Math.PI / 2); return g;      // deita no plano XZ; "frente" = +X
}

export class DogField {
  constructor() {
    this.group = new THREE.Group(); this.n = 70; const R = rng(70);
    this.mesh = new THREE.InstancedMesh(dogIconGeo(), glowMaterial({ color: '#FFFFFF', intensity: 1.5, additive: false, opacity: 1 }), this.n);
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(this.n * 3), 3); this.mesh.frustumCulled = false; this.mesh.material.defines = { USE_INSTANCING_COLOR: '' };
    this.group.add(this.mesh);
    this.pos = []; this.rand = []; this.dir = [];
    const rings = [[0.72, 14], [1.1, 22], [1.5, 34]]; let k = 0;
    for (const [rad, cnt] of rings) for (let i = 0; i < cnt && k < this.n; i++, k++) { const a = (i / cnt) * TAU + rad; this.pos.push([Math.cos(a) * rad, Math.sin(a) * rad]); this.rand.push(R() * TAU); this.dir.push(R() < 0.5 ? 0 : 1); }
    const gold = col('#FFC83D'), cream = col('#FFF1B8');
    for (let i = 0; i < this.n; i++) { const c = i % 5 === 0 ? cream : gold; this.mesh.instanceColor.setXYZ(i, c.r, c.g, c.b); }
    // histograma polar ilustrativo (barras radiais)
    const B = 36, bars = []; this.bars = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), glowMaterial({ color: '#00D9F5', intensity: 1.7, additive: true, opacity: 0.9 }), B);
    this.bars.frustumCulled = false; this.group.add(this.bars); this.B = B;
    this.m4 = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.s = new THREE.Vector3(); this.p = new THREE.Vector3(); this.e = new THREE.Euler();
  }
  // order: quanto dos 70 já apareceram (0..70); align: 0 aleatório -> 1 alinhado ao eixo N–S; hist: 0..1; spin: tremor
  update(t, { count = this.n, align = 0, hist = 0, scale = 1 } = {}) {
    for (let i = 0; i < this.n; i++) {
      const [x, z] = this.pos[i]; const appear = Math.min(1, Math.max(0, count - i)); const pop = appear < 1 ? appear * appear * (3 - 2 * appear) : 1 + Math.sin(Math.min(1, (count - i - 1) / 4) * Math.PI) * 0.0;
      const wob = Math.sin(t * 2 + i) * 0.35 * (1 - align);
      const target = this.dir[i] ? Math.PI / 2 : -Math.PI / 2;                    // ao longo do eixo N–S (Z)
      let h = this.rand[i] + t * (0.6 + (i % 5) * 0.25) * (1 - align) * 0.0 + wob; const d = ((target - h + Math.PI * 3) % TAU) - Math.PI; h = h + d * align;
      this.e.set(0, -h, 0); this.q.setFromEuler(this.e); const k = 0.2 * pop * scale; this.s.set(k, k, k); this.p.set(x, 0.02, z); this.m4.compose(this.p, this.q, this.s); this.mesh.setMatrixAt(i, this.m4);
    }
    this.mesh.instanceMatrix.needsUpdate = true; this.mesh.instanceColor.needsUpdate = true;
    // barras: setores em volta (ilustrativo): pico em N e S
    for (let j = 0; j < this.B; j++) {
      const a = (j / this.B) * TAU, ax = Math.abs(Math.sin(a)); const v = 0.1 + 0.9 * Math.pow(ax, 6) * 0.9 + 0.12 * Math.abs(Math.sin(j * 12.9));
      const len = Math.max(0.0001, v * hist * 0.8); const r0 = 1.72; this.e.set(0, -a, 0); this.q.setFromEuler(this.e);
      this.p.set(Math.cos(a) * (r0 + len / 2), 0.02, Math.sin(a) * (r0 + len / 2)); this.s.set(len, 0.02, 0.085); this.m4.compose(this.p, this.q, this.s); this.bars.setMatrixAt(j, this.m4);
    }
    this.bars.instanceMatrix.needsUpdate = true;
  }
}
