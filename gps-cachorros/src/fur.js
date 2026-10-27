// Pelagem por "shells": a mesma malha é desenhada N vezes, cada vez deslocada ao longo da normal,
// com fios (células 3D) que afinam até a ponta. Iluminação própria (wrap + rim + translucência)
// para o visual de personagem 3D estilizado, com luz-chave quente e contraluz ciano.
import * as THREE from 'three';

// Uniforms compartilhados por todos os materiais de pelo (luzes da cena corrente).
export const lightU = {
  uKeyDir: { value: new THREE.Vector3(0.55, 0.75, 0.65).normalize() },
  uKeyCol: { value: new THREE.Color('#ffe7b0').multiplyScalar(1.25) },
  uRimDir: { value: new THREE.Vector3(-0.7, 0.35, -0.75).normalize() },
  uRimCol: { value: new THREE.Color('#00d9f5').multiplyScalar(1.9) },
  uFillDir: { value: new THREE.Vector3(-0.6, 0.1, 0.7).normalize() },
  uFillCol: { value: new THREE.Color('#ffd9a0').multiplyScalar(0.35) },
  uSky: { value: new THREE.Color('#7fd7ff').multiplyScalar(0.55) },
  uGround: { value: new THREE.Color('#3c8a3a').multiplyScalar(0.40) },
  uTime: { value: 0 },
  uWind: { value: 1 },
};

const vert = /* glsl */ `
precision highp float;
uniform float uLen, uShells, uTime, uWind;
uniform vec3 uGravity, uFlow;
varying vec3 vN, vObj, vWorld;
varying float vH;
void main() {
  float h = float(gl_InstanceID) / (uShells - 1.0);
  vH = h;
  vec3 n = normalize(normal);
  vec3 p = position + n * uLen * h;
  vec4 wp = modelMatrix * vec4(p, 1.0);
  // gravidade + brisa suave (mais efeito perto da ponta)
  float k = h * h;
  wp.xyz += uGravity * k * uLen + (mat3(modelMatrix) * uFlow) * k * uLen;
  wp.x += sin(uTime * 2.1 + wp.y * 5.0 + wp.z * 3.0) * 0.006 * k * uWind * (uLen / 0.04);
  wp.z += cos(uTime * 1.7 + wp.x * 4.0) * 0.004 * k * uWind * (uLen / 0.04);
  vWorld = wp.xyz;
  vObj = position;
  vN = normalize(mat3(modelMatrix) * n);
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

const frag = /* glsl */ `
precision highp float;
uniform vec3 uRoot, uMid, uTip, uAccent;
uniform vec3 uGradDir; uniform vec2 uGradRange;
uniform float uDensity, uCover, uSheen, uTone;
uniform vec3 uKeyDir, uKeyCol, uRimDir, uRimCol, uFillDir, uFillCol, uSky, uGround;
uniform float uFlash; uniform vec3 uFlashCol;
varying vec3 vN, vObj, vWorld;
varying float vH;
float hash13(vec3 p){ p = fract(p*0.1031); p += dot(p, p.zyx+31.32); return fract((p.x+p.y)*p.z); }
float vnoise(vec3 p){
  vec3 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
  float a=hash13(i), b=hash13(i+vec3(1,0,0)), c=hash13(i+vec3(0,1,0)), d=hash13(i+vec3(1,1,0));
  float e=hash13(i+vec3(0,0,1)), g=hash13(i+vec3(1,0,1)), h=hash13(i+vec3(0,1,1)), k=hash13(i+vec3(1,1,1));
  return mix(mix(mix(a,b,f.x),mix(c,d,f.x),f.y), mix(mix(e,g,f.x),mix(h,k,f.x),f.y), f.z);
}
void main() {
  // fios: células 3D rotacionadas + jitter (evita anéis/listras alinhados aos eixos)
  mat3 RR = mat3(0.8040, 0.3647, -0.4733, -0.5036, 0.8338, -0.2227, 0.3187, 0.4133, 0.8531);
  vec3 q = RR * vObj * uDensity;
  vec3 cell = floor(q);
  float r = hash13(cell);
  float r2 = hash13(cell + 17.3);
  vec3 jit = vec3(hash13(cell + 1.7), hash13(cell + 8.3), hash13(cell + 4.1)) - 0.5;
  float d = length(fract(q) - 0.5 - jit * 0.6);
  float lenStrand = mix(0.5, 1.05, r);
  float thick = mix(0.70, 0.30, vH);
  float cov = 1.0;
  if (vH > 0.001) {
    cov = smoothstep(thick + 0.10, thick - 0.10, d) * smoothstep(lenStrand + 0.02, lenStrand - 0.20, vH);
    cov *= step(vH, uCover + 0.0001);
    if (cov < 0.06) discard;
  }
  // cor: raiz escura -> meio -> ponta clara; acento gradiente no espaço do objeto
  float g = smoothstep(uGradRange.x, uGradRange.y, dot(vObj, uGradDir));
  vec3 mid = mix(uMid, uAccent, g);
  vec3 tip = mix(uTip, uAccent * 1.15, g);
  vec3 col = mix(uRoot, mid, smoothstep(0.0, 0.5, vH));
  col = mix(col, tip, smoothstep(0.45, 1.0, vH));
  float lowf = 0.5 + 0.25 * sin(dot(vObj, vec3(23.1, 17.3, 19.7))) + 0.25 * sin(dot(vObj, vec3(-13.7, 31.9, 11.3)));
  col *= 0.86 + 0.22 * lowf + 0.18 * (r2 - 0.5);
  // luz
  vec3 N = normalize(vN);
  vec3 V = normalize(cameraPosition - vWorld);
  float wrap = 0.45;
  float kd = clamp((dot(N, uKeyDir) + wrap) / (1.0 + wrap), 0.0, 1.0);
  float fd = clamp((dot(N, uFillDir) + 0.5) / 1.5, 0.0, 1.0);
  float hemi = N.y * 0.5 + 0.5;
  vec3 amb = mix(uGround, uSky, hemi);
  float ao = mix(0.52, 1.0, pow(vH, 0.6));
  vec3 lit = col * (uKeyCol * kd * kd * 1.15 + uFillCol * fd + amb) * ao;
  // contraluz ciano + borda translúcida
  float fres = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 2.6);
  float rim = clamp(dot(N, uRimDir) * 0.5 + 0.55, 0.0, 1.0);
  lit += uRimCol * fres * rim * (0.35 + 0.9 * vH) * uTone;
  lit += col * uKeyCol * pow(clamp(dot(-V, uKeyDir), 0.0, 1.0), 3.0) * fres * 0.9; // luz atravessando os pelos
  // brilho sedoso (Kajiya-Kay simplificado)
  vec3 H = normalize(uKeyDir + V);
  float sh = pow(clamp(dot(N, H), 0.0, 1.0), 38.0);
  lit += uKeyCol * sh * uSheen * (0.4 + 0.6 * vH);
  lit = mix(lit, uFlashCol, uFlash);
  gl_FragColor = vec4(lit, cov);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export function furMaterial(o = {}) {
  const m = new THREE.ShaderMaterial({
    vertexShader: vert,
    fragmentShader: frag,
    uniforms: {
      ...lightU,
      uLen: { value: o.len ?? 0.04 },
      uShells: { value: o.shells ?? 26 },
      uGravity: { value: new THREE.Vector3(0, -0.8, 0) },
      uFlow: { value: new THREE.Vector3(...(o.flow ?? [0, 0, 0])) },
      uRoot: { value: new THREE.Color(o.root ?? '#6a3508') },
      uMid: { value: new THREE.Color(o.mid ?? '#c97d1c') },
      uTip: { value: new THREE.Color(o.tip ?? '#ffc656') },
      uAccent: { value: new THREE.Color(o.accent ?? '#f7dc9c') },
      uGradDir: { value: new THREE.Vector3(...(o.gradDir ?? [0, -1, 0])).normalize() },
      uGradRange: { value: new THREE.Vector2(...(o.gradRange ?? [10, 11])) }, // fora do alcance = sem acento
      uDensity: { value: (o.density ?? 140) * 1.7 },
      uCover: { value: o.cover ?? 1.0 },
      uSheen: { value: o.sheen ?? 0.35 },
      uTone: { value: o.rimTone ?? 1.0 },
      uFlash: { value: 0 },
      uFlashCol: { value: new THREE.Color('#ffffff') },
    },
  });
  m.alphaToCoverage = true;
  return m;
}

// Malha de pelo = InstancedMesh com 1 instância por camada (gl_InstanceID = camada).
export function furMesh(geometry, o = {}) {
  const shells = o.shells ?? 26;
  const mat = furMaterial({ ...o, shells });
  const mesh = new THREE.InstancedMesh(geometry, mat, shells);
  const I = new THREE.Matrix4();
  for (let i = 0; i < shells; i++) mesh.setMatrixAt(i, I);
  mesh.instanceMatrix.needsUpdate = true;
  mesh.frustumCulled = false;
  mesh.userData.fur = true; mesh.userData.maxShells = shells; mesh.userData.geoHi = geometry;
  const e = geometry.userData.ell; if (e) mesh.userData.geoLo = ellipsoid(e.rx, e.ry, e.rz, Math.max(10, Math.round(e.ws * 0.5)), Math.max(7, Math.round(e.hs * 0.5)), e.deform);
  return mesh;
}

// Elipsoide com normais analíticas (o deslocamento do pelo fica uniforme em qualquer eixo).
export function ellipsoid(rx, ry, rz, ws = 24, hs = 16, deform) {
  const g = new THREE.SphereGeometry(1, ws, hs); g.userData.ell = { rx, ry, rz, ws, hs, deform };
  const pos = g.attributes.position, nor = g.attributes.normal;
  const v = new THREE.Vector3(), n = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    v.set(x * rx, y * ry, z * rz);
    n.set(x / rx, y / ry, z / rz).normalize();
    if (deform) deform(v, n, x, y, z);
    pos.setXYZ(i, v.x, v.y, v.z);
    nor.setXYZ(i, n.x, n.y, n.z);
  }
  return g;
}
