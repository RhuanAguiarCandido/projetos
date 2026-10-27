// Materiais "emissivos" (HDR) para linhas, anéis, partículas: cor * intensidade, mistura aditiva, suporte a instâncias.
import * as THREE from 'three';
import { col } from '../kit/util.js';

const VS = /* glsl */ `
varying vec3 vC; varying vec2 vUv; varying vec3 vW;
void main(){
  vec4 p4 = vec4(position, 1.0); vC = vec3(1.0);
#ifdef USE_INSTANCING
  p4 = instanceMatrix * p4;
#endif
#ifdef USE_INSTANCING_COLOR
  vC = instanceColor;
#endif
  vUv = uv; vec4 w = modelMatrix * p4; vW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
const FS = /* glsl */ `
precision highp float; varying vec3 vC; varying vec2 vUv; varying vec3 vW;
uniform vec3 uColor, uColor2; uniform float uInt, uOpacity, uGrad;
void main(){ vec3 c = mix(uColor, uColor2, clamp(vUv.x * uGrad, 0.0, 1.0)) * vC * uInt; gl_FragColor = vec4(c, uOpacity); }`;

export function glowMaterial(o = {}) {
  return new THREE.ShaderMaterial({
    vertexShader: VS, fragmentShader: FS, transparent: true, depthWrite: false,
    blending: o.additive === false ? THREE.NormalBlending : THREE.AdditiveBlending, side: o.side ?? THREE.DoubleSide, depthTest: o.depthTest ?? true,
    uniforms: { uColor: { value: col(o.color ?? '#00D9F5') }, uColor2: { value: col(o.color2 ?? o.color ?? '#00D9F5') }, uInt: { value: o.intensity ?? 1.6 }, uOpacity: { value: o.opacity ?? 1 }, uGrad: { value: o.grad ?? 0 } },
  });
}

// pontos redondos com tamanho em pixels (atenuado pela distância)
export function pointsMaterial(o = {}) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, depthTest: o.depthTest ?? true,
    uniforms: { uSize: { value: o.size ?? 4 }, uScale: { value: 1000 }, uColor: { value: col(o.color ?? '#7EEFFF') }, uInt: { value: o.intensity ?? 1.4 }, uOpacity: { value: o.opacity ?? 1 }, uTime: { value: 0 }, uAtten: { value: o.atten ?? 1 } },
    vertexShader: `
      attribute float aSize; attribute float aPh; attribute vec3 aCol; varying vec3 vC; varying float vA;
      uniform float uSize, uScale, uTime, uAtten; 
      void main(){ vec4 mv = viewMatrix * modelMatrix * vec4(position, 1.0);
        float tw = 0.65 + 0.35 * sin(uTime * 2.0 + aPh * 6.2831);
        gl_PointSize = clamp(uSize * aSize * mix(1.0, uScale / -mv.z, uAtten) * (0.8 + 0.2 * tw), 1.0, 96.0); vC = aCol; vA = tw;
        gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `precision highp float; varying vec3 vC; varying float vA; uniform vec3 uColor; uniform float uInt, uOpacity;
      void main(){ vec2 d = gl_PointCoord - 0.5; float r = length(d) * 2.0; float a = smoothstep(1.0, 0.35, r); gl_FragColor = vec4(uColor * vC * uInt, a * uOpacity); }`,
  });
}
