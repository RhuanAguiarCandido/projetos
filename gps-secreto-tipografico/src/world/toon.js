// Estilo "mascote 3D": sombreado toon em bandas suaves, luz de recorte colorida e contorno por casco invertido.
// Todos os materiais compartilham o mesmo palco (STAGE: luzes, neblina, resolução) para trocar o "look" por cena.
import * as THREE from 'three';
import { col } from '../kit/util.js';

export const STAGE = {
  uKeyDir: { value: new THREE.Vector3(0.55, 0.7, 0.55).normalize() },
  uRimDir: { value: new THREE.Vector3(-0.7, 0.35, -0.7).normalize() },
  uKeyCol: { value: col('#FFFFFF') },
  uRimCol: { value: col('#00D9F5') },
  uRimAmt: { value: 1.0 },
  uFogCol: { value: col('#CFEFF5') },
  uFogDen: { value: 0.012 },
  uAmb: { value: 0.0 },
  uRes: { value: new THREE.Vector2(1080, 1920) },
  uTime: { value: 0 },
};

export function setLook(L) {
  if (L.keyDir) STAGE.uKeyDir.value.fromArray(L.keyDir).normalize();
  if (L.rimDir) STAGE.uRimDir.value.fromArray(L.rimDir).normalize();
  if (L.keyCol) STAGE.uKeyCol.value.set(L.keyCol);
  if (L.rimCol) STAGE.uRimCol.value.set(L.rimCol);
  if (L.rimAmt !== undefined) STAGE.uRimAmt.value = L.rimAmt;
  if (L.fogCol) STAGE.uFogCol.value.set(L.fogCol);
  if (L.fogDen !== undefined) STAGE.uFogDen.value = L.fogDen;
}

const VS = /* glsl */ `
varying vec3 vN, vW, vL;
uniform float uAxisK;
void main(){
  vec4 p4 = vec4(position, 1.0); vec3 nn = normal;
#ifdef USE_INSTANCING
  vec3 axis = normalize(mat3(instanceMatrix) * vec3(0.0, 1.0, 0.0));            // pelos: sombreia pelo eixo (continua a superfície)
  p4 = instanceMatrix * p4; nn = normalize(mix(mat3(instanceMatrix) * nn, axis, uAxisK));
#endif
  vec4 w = modelMatrix * p4;
  vW = w.xyz; vL = p4.xyz;
  vN = normalize(mat3(modelMatrix) * nn);
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
const FS = /* glsl */ `
precision highp float;
varying vec3 vN, vW, vL;
uniform vec3 uBase, uShade, uLight, uBase2, uShade2, uLight2, uGradDir; uniform vec2 uGradRange;
uniform vec3 uKeyDir, uRimDir, uKeyCol, uRimCol, uFogCol; uniform float uRimAmt, uFogDen, uSpec, uFlash, uAmb, uBandA, uBandB, uSoft, uOpacity;
uniform vec3 uFlashCol;
float bayer(vec2 p){ p = mod(p, 4.0); int i = int(p.y) * 4 + int(p.x);
  float m[16] = float[16](0.0,8.0,2.0,10.0, 12.0,4.0,14.0,6.0, 3.0,11.0,1.0,9.0, 15.0,7.0,13.0,5.0); return (m[i] + 0.5) / 16.0; }
void main(){
  if (uOpacity < 0.999 && bayer(gl_FragCoord.xy) > uOpacity) discard;
  vec3 N = normalize(vN); vec3 V = normalize(cameraPosition - vW);
  float t = dot(N, uKeyDir) * 0.5 + 0.5;
  float b1 = smoothstep(uBandA - uSoft, uBandA + uSoft, t), b2 = smoothstep(uBandB - uSoft, uBandB + uSoft, t);
  float g = smoothstep(uGradRange.x, uGradRange.y, dot(vL, uGradDir));
  vec3 sh = mix(uShade, uShade2, g), ba = mix(uBase, uBase2, g), li = mix(uLight, uLight2, g);
  vec3 c = mix(sh, ba, b1); c = mix(c, li, b2);
  c *= mix(0.80, 1.0, N.y * 0.5 + 0.5) + uAmb;                           // oclusão suave por baixo
  c *= uKeyCol;
  float rim = pow(1.0 - max(dot(N, V), 0.0), 2.6) * smoothstep(-0.35, 0.55, dot(N, uRimDir));
  c += uRimCol * rim * uRimAmt;                                          // contraluz colorido
  vec3 H = normalize(uKeyDir + V); c += vec3(1.0) * smoothstep(0.965, 0.975, dot(N, H)) * uSpec;   // brilho "toon"
  c = mix(c, uFlashCol, uFlash);
  float d = length(cameraPosition - vW); c = mix(c, uFogCol, 1.0 - exp(-pow(d * uFogDen, 2.0)));
  gl_FragColor = vec4(c, 1.0);
}`;

const OVS = /* glsl */ `
uniform vec2 uRes; uniform float uWidth;
void main(){
  vec4 p4 = vec4(position, 1.0); vec3 nn = normal;
#ifdef USE_INSTANCING
  p4 = instanceMatrix * p4; nn = mat3(instanceMatrix) * nn;
#endif
  vec4 clip = projectionMatrix * viewMatrix * modelMatrix * p4;
  vec3 n = normalize(mat3(viewMatrix) * mat3(modelMatrix) * nn);
  vec2 d = normalize((projectionMatrix * vec4(n, 0.0)).xy + 1e-6);
  clip.xy += d * uWidth * (uRes.x / 1080.0) * clip.w * 2.0 / uRes;                           // largura constante em pixels
  gl_Position = clip;
}`;
const OFS = /* glsl */ `
precision highp float; uniform vec3 uColor, uFogCol; uniform float uFogDen; uniform float uOpacity;
void main(){ gl_FragColor = vec4(uColor, 1.0); }`;

// paleta: { base, shade, light } (hex) + opcional segunda paleta (base2...) com gradiente no espaço do objeto
export function toonMaterial(o = {}) {
  const P = o.palette ?? { base: '#F4B13D', shade: '#C97719', light: '#FFD97A' };
  const P2 = o.palette2 ?? P;
  return new THREE.ShaderMaterial({
    vertexShader: VS, fragmentShader: FS, side: o.side ?? THREE.FrontSide,
    uniforms: {
      ...STAGE, uRimAmt: o.rimAmt !== undefined ? { value: o.rimAmt } : STAGE.uRimAmt,
      uBase: { value: col(P.base) }, uShade: { value: col(P.shade) }, uLight: { value: col(P.light) },
      uBase2: { value: col(P2.base) }, uShade2: { value: col(P2.shade) }, uLight2: { value: col(P2.light) },
      uGradDir: { value: new THREE.Vector3(...(o.gradDir ?? [0, -1, 0])).normalize() }, uGradRange: { value: new THREE.Vector2(...(o.gradRange ?? [10, 11])) },
      uSpec: { value: o.spec ?? 0 }, uFlash: { value: 0 }, uFlashCol: { value: col('#FFFFFF') },
      uBandA: { value: o.bandA ?? 0.42 }, uBandB: { value: o.bandB ?? 0.84 }, uSoft: { value: o.soft ?? 0.035 }, uOpacity: { value: 1 }, uAxisK: { value: o.axisK ?? 0 },
    },
  });
}

export function outlineMaterial(o = {}) {
  return new THREE.ShaderMaterial({
    vertexShader: OVS, fragmentShader: OFS, side: THREE.BackSide,
    uniforms: { uRes: STAGE.uRes, uWidth: { value: o.width ?? 2.6 }, uColor: { value: col(o.color ?? '#6B3A0F') }, uFogCol: STAGE.uFogCol, uFogDen: STAGE.uFogDen, uOpacity: { value: 1 } },
  });
}

// elipsoide com normais analíticas (pronto para contorno por casco invertido)
export function ellipsoid(rx, ry, rz, ws = 28, hs = 18, deform) {
  const g = new THREE.SphereGeometry(1, ws, hs);
  const pos = g.attributes.position, nor = g.attributes.normal; const v = new THREE.Vector3(), n = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    v.set(x * rx, y * ry, z * rz); n.set(x / rx, y / ry, z / rz).normalize();
    if (deform) deform(v, n, x, y, z);
    pos.setXYZ(i, v.x, v.y, v.z); nor.setXYZ(i, n.x, n.y, n.z);
  }
  return g;
}

// malha + contorno
export function toonMesh(geo, matOpts = {}, outline = { width: 2.6, color: '#6B3A0F' }) {
  const g = new THREE.Group();
  const m = new THREE.Mesh(geo, toonMaterial(matOpts)); g.add(m);
  let o = null;
  if (outline) { o = new THREE.Mesh(geo, outlineMaterial(outline)); g.add(o); }
  g.userData = { fill: m, outline: o };
  return g;
}

// tufo (mecha de pelo: cone fino levemente curvo) — geometria compartilhada
export function tuftGeometry(h = 0.12, w = 0.045) {
  const g = new THREE.ConeGeometry(w, h, 4, 3); g.translate(0, h / 2, 0);
  const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i) / h; p.setZ(i, p.getZ(i) + y * y * h * 0.22); }       // curva a ponta
  g.computeVertexNormals(); return g;
}
// amostra pontos/normais sobre a superfície de uma geometria (vértices sorteados, determinístico) e cria o pelo
export function furOn(geo, count, o = {}) {
  const pos = geo.attributes.position, nor = geo.attributes.normal; const P = [], N = []; let a = o.seed ?? 11;
  const rnd = () => ((a = (a * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let tries = 0; P.length < count && tries < count * 60; tries++) {
    const k = Math.floor(rnd() * pos.count); const y = pos.getY(k);
    if (o.filter && !o.filter(pos.getX(k), y, pos.getZ(k), nor.getX(k), nor.getY(k), nor.getZ(k))) continue;
    P.push(new THREE.Vector3(pos.getX(k), y, pos.getZ(k))); N.push(new THREE.Vector3(nor.getX(k), nor.getY(k), nor.getZ(k)));
  }
  return tuftSet(P, N, o);
}
// conjunto instanciado de tufos sobre pontos de uma superfície (local do pai)
export function tuftSet(points, normals, o = {}) {
  const geo = tuftGeometry(o.h ?? 0.12, o.w ?? 0.045);
  const mat = toonMaterial({ palette: o.palette, palette2: o.palette2, gradDir: o.gradDir, gradRange: o.gradRange, spec: 0, soft: o.soft ?? 0.2, bandA: o.bandA ?? 0.38, bandB: o.bandB ?? 0.78, axisK: o.axisK ?? 0.78, rimAmt: o.rimAmt ?? 0.12 });
  const mesh = new THREE.InstancedMesh(geo, mat, points.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), s = new THREE.Vector3();
  const rnd = (() => { let a = 7; return () => ((a = (a * 1664525 + 1013904223) >>> 0) / 4294967296); })();
  points.forEach((p, i) => {
    const n = normals[i].clone().normalize();
    // inclina um pouco para "cair" ao longo do corpo
    if (o.sweep) n.add(new THREE.Vector3(...o.sweep)).normalize();
    n.x += (rnd() - 0.5) * 0.25; n.y += (rnd() - 0.5) * 0.25; n.z += (rnd() - 0.5) * 0.25; n.normalize();
    q.setFromUnitVectors(up, n); const k = (o.scale ?? 1) * (0.75 + rnd() * 0.6); s.set(k, k * (0.8 + rnd() * 0.5), k);
    m.compose(p, q, s); mesh.setMatrixAt(i, m);
  });
  mesh.frustumCulled = false;
  return mesh;
}
