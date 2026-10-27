// Motor de render: cena 3D em HDR com MSAA -> profundidade de campo + bloom -> HUD ortográfico -> acumulação de subquadros
// (motion blur real, adaptativo) -> passe final (tone map, aberração cromática, glitch, transições, grade, grão, dither).
import * as THREE from 'three';
import { clamp } from '../kit/util.js';

const VS = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
const tri = new THREE.BufferGeometry();
tri.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
tri.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2));

const LIN = `float linZ(float d, float n, float f){ float z = d * 2.0 - 1.0; return (2.0 * n * f) / (f + n - z * (f - n)); }`;

const DOF_FS = `precision highp float; varying vec2 vUv; uniform sampler2D tColor, tDepth; uniform vec2 uTexel; uniform float uNear, uFar, uFocus, uAperture, uMaxR;
${LIN}
float coc(vec2 uv){ float z = linZ(texture2D(tDepth, uv).x, uNear, uFar); return clamp(abs(z - uFocus) / max(z, 0.01) * uAperture, 0.0, 1.0); }
void main(){
  float c0 = coc(vUv); vec3 acc = texture2D(tColor, vUv).rgb; float wsum = 1.0;
  if (c0 > 0.01) {
    for (int i = 0; i < 28; i++) {
      float fi = float(i) + 0.5; float r = sqrt(fi / 28.0); float a = fi * 2.39996323;
      vec2 off = vec2(cos(a), sin(a)) * r * c0 * uMaxR; vec2 uv = vUv + off * uTexel;
      float ct = coc(uv); float w = smoothstep(r * c0 * uMaxR - 1.5, r * c0 * uMaxR + 0.5, ct * uMaxR + 0.001);
      vec3 s = texture2D(tColor, uv).rgb; w *= 1.0 + 0.6 * max(0.0, dot(s, vec3(0.3, 0.5, 0.2)) - 1.0);       // realça "bokeh" de altas luzes
      acc += s * w; wsum += w;
    }
  }
  gl_FragColor = vec4(acc / wsum, c0); }`;

const DOWN_FS = `precision highp float; varying vec2 vUv; uniform sampler2D tSrc; uniform vec2 uTexel; uniform float uThr, uFirst;
vec3 pre(vec3 c){ float l = max(c.r, max(c.g, c.b)); float k = max(0.0, l - uThr) / max(l, 1e-4); return c * mix(1.0, k, uFirst); }
void main(){ vec2 t = uTexel;
  vec3 c = pre(texture2D(tSrc, vUv).rgb) * 0.25 + pre(texture2D(tSrc, vUv + vec2(-t.x, -t.y)).rgb) * 0.125 + pre(texture2D(tSrc, vUv + vec2(t.x, -t.y)).rgb) * 0.125 + pre(texture2D(tSrc, vUv + vec2(-t.x, t.y)).rgb) * 0.125 + pre(texture2D(tSrc, vUv + vec2(t.x, t.y)).rgb) * 0.125
    + pre(texture2D(tSrc, vUv + vec2(-2.0 * t.x, 0.0)).rgb) * 0.0625 + pre(texture2D(tSrc, vUv + vec2(2.0 * t.x, 0.0)).rgb) * 0.0625 + pre(texture2D(tSrc, vUv + vec2(0.0, -2.0 * t.y)).rgb) * 0.0625 + pre(texture2D(tSrc, vUv + vec2(0.0, 2.0 * t.y)).rgb) * 0.0625;
  gl_FragColor = vec4(c, 1.0); }`;
const UP_FS = `precision highp float; varying vec2 vUv; uniform sampler2D tSrc, tBase; uniform vec2 uTexel; uniform float uMix;
void main(){ vec2 t = uTexel;
  vec3 c = texture2D(tSrc, vUv).rgb * 4.0 + (texture2D(tSrc, vUv + vec2(t.x, 0.0)).rgb + texture2D(tSrc, vUv - vec2(t.x, 0.0)).rgb + texture2D(tSrc, vUv + vec2(0.0, t.y)).rgb + texture2D(tSrc, vUv - vec2(0.0, t.y)).rgb) * 2.0
    + texture2D(tSrc, vUv + t).rgb + texture2D(tSrc, vUv - t).rgb + texture2D(tSrc, vUv + vec2(t.x, -t.y)).rgb + texture2D(tSrc, vUv + vec2(-t.x, t.y)).rgb;
  gl_FragColor = vec4(c / 16.0 + texture2D(tBase, vUv).rgb * uMix, 1.0); }`;

const COMP_FS = `precision highp float; varying vec2 vUv; uniform sampler2D tColor, tDof, tDepth, tBloom; uniform float uNear, uFar, uFocus, uAperture, uBloom;
${LIN}
void main(){
  vec3 sharp = texture2D(tColor, vUv).rgb; vec4 d = texture2D(tDof, vUv);
  float z = linZ(texture2D(tDepth, vUv).x, uNear, uFar); float coc = clamp(abs(z - uFocus) / max(z, 0.01) * uAperture, 0.0, 1.0);
  vec3 c = mix(sharp, d.rgb, smoothstep(0.03, 0.35, coc));
  c += texture2D(tBloom, vUv).rgb * uBloom;
  gl_FragColor = vec4(c, 1.0); }`;

const ACC_FS = `precision highp float; varying vec2 vUv; uniform sampler2D tSrc; uniform float uW; void main(){ gl_FragColor = vec4(texture2D(tSrc, vUv).rgb * uW, 1.0); }`;

const FINAL_FS = `precision highp float; varying vec2 vUv; uniform sampler2D tA; uniform vec2 uRes; uniform float uFrame, uTT, uAmt, uSeed, uCA, uGlitch, uVig, uFade, uExposure, uGrain; uniform vec2 uDir; uniform vec3 uFadeCol;
float h11(float x){ return fract(sin(x * 127.1 + 311.7) * 43758.5453); }
float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
vec3 fetch(vec2 uv, float ca){ vec2 d = (uv - 0.5) * ca; return vec3(texture2D(tA, uv + d).r, texture2D(tA, uv).g, texture2D(tA, uv - d).b); }
vec3 tone(vec3 x){ x *= uExposure; vec3 lo = x; vec3 hi = 0.80 + 0.20 * tanh((x - 0.80) / 0.20); return mix(lo, hi, step(0.80, x)); }
vec3 enc(vec3 c){ c = clamp(c, 0.0, 1.0); return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
void main(){
  vec2 uv = vUv; float asp = uRes.x / uRes.y; float ca = uCA; vec3 add = vec3(0.0);
  float tt = floor(uFrame / 2.0);
  // glitch (global + transição tipo 3)
  float gl = max(uGlitch, uTT > 2.5 && uTT < 3.5 ? uAmt : 0.0);
  if (gl > 0.001) {
    float rows = mix(24.0, 70.0, h11(tt + uSeed)); float band = floor(uv.y * rows); float on = step(0.55 - 0.4 * gl, h21(vec2(band, tt + uSeed)));
    uv.x += (h21(vec2(band, tt * 1.7 + 3.0)) - 0.5) * 0.28 * gl * on;
    float blk = step(0.93 - 0.1 * gl, h21(floor(uv * vec2(6.0, 14.0)) + tt)); uv.x += blk * 0.05 * gl * (h11(tt) - 0.5);
    ca += 0.05 * gl * (0.4 + 0.6 * h11(tt * 3.1));
  }
  vec3 c;
  float jit = h21(vUv * uRes + uFrame * 1.7) - 0.5;
  if (uTT > 0.5 && uTT < 1.5) {                                   // whip: borrão direcional com jitter por pixel
    c = vec3(0.0); for (int i = 0; i < 24; i++) { float k = (float(i) + jit) / 24.0 - 0.5; c += fetch(uv + uDir * k * uAmt * 0.30, ca + uAmt * 0.05); } c /= 24.0;
    c += vec3(0.6, 0.9, 1.0) * uAmt * uAmt * 0.16;
  } else if (uTT > 1.5 && uTT < 2.5) {                            // zoom radial
    vec2 ctr = vec2(0.5, 0.45); c = vec3(0.0); for (int i = 0; i < 24; i++) { float k = (float(i) + jit) / 24.0; c += fetch(ctr + (uv - ctr) * (1.0 - k * uAmt * 0.30), ca + uAmt * 0.04); } c /= 24.0;
    c += vec3(1.0, 0.95, 0.8) * uAmt * uAmt * 0.22;
  } else c = fetch(uv, ca);
  if (uTT > 3.5 && uTT < 4.5) c += vec3(1.0, 0.96, 0.82) * pow(uAmt, 2.0) * 2.6;                           // flash
  if (uTT > 4.5 && uTT < 5.5) {                                   // wipe diagonal em faixas da marca: uAmt = progresso -1..1 (cobre até 0, descobre depois)
    float pr = uAmt; vec2 q0 = uv - 0.5; float d = dot(q0, normalize(vec2(0.5, 1.0))) / 1.34 + 0.5;
    float front = clamp(pr + 1.0, 0.0, 1.0) * 1.7 - 0.35, trail = clamp(pr, 0.0, 1.0) * 1.7 - 0.35;
    float cover = (1.0 - smoothstep(front - 0.02, front, d)) * smoothstep(trail - 0.02, trail, d);
    float ef = front - d, et = d - trail;                                                                    // distância às bordas
    float yel = (step(ef, 0.09) + step(et, 0.0) * 0.0) * step(0.0, ef);
    float cy = step(0.09, ef) * step(ef, 0.18);
    float cy2 = step(et, 0.09) * step(0.0, et) * step(0.001, pr); float yel2 = step(0.09, et) * step(et, 0.18) * step(0.001, pr);
    vec3 P = vec3(0.0075, 0.012, 0.045); vec3 col = P;
    col = mix(col, vec3(0.0, 0.69, 0.91), clamp(cy + cy2, 0.0, 1.0)); col = mix(col, vec3(0.94, 0.66, 0.08), clamp(yel + yel2, 0.0, 1.0));
    c = mix(c, col, cover); }
  c = tone(c);
  // grade: sombras azuladas da marca, contraste e saturação
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722)); c = mix(vec3(l), c, 1.10); c += vec3(0.004, 0.008, 0.02) * (1.0 - clamp(l * 2.0, 0.0, 1.0));
  c = (c - 0.5) * 1.04 + 0.5 * 1.0; c = max(c, 0.0);
  vec2 q = vUv - 0.5; q.x *= asp * 0.62; float v = 1.0 - uVig * smoothstep(0.18, 0.95, length(q) * 1.25); c *= v;
  c = mix(c, uFadeCol, uFade);
  c = enc(c);
  float n = h21(vUv * uRes + uFrame * 7.13) + h21(vUv * uRes * 1.37 + uFrame * 3.7) - 1.0;           // dither triangular + grão fino
  c += n * (0.5 / 255.0 + uGrain);
  gl_FragColor = vec4(c, 1.0); }`;

export class Engine {
  constructor(canvas, W, H, { samples = 4 } = {}) {
    this.W = W; this.H = H; this.canvas = canvas;
    const r = this.r = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance', alpha: false });
    r.setPixelRatio(1); r.setSize(W, H, false); r.autoClear = false; r.setClearColor(new THREE.Color('#0B1024'), 1);
    const mk = (w, h, o = {}) => new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, format: THREE.RGBAFormat, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false, ...o });
    const dt = new THREE.DepthTexture(W, H); dt.type = THREE.UnsignedIntType;
    this.rtMain = mk(W, H, { samples, depthBuffer: true, depthTexture: dt });
    this.rtDof = mk(W >> 1, H >> 1);
    this.rtComp = mk(W, H);
    this.rtHud = mk(W, H, { samples, depthBuffer: false, type: THREE.UnsignedByteType });
    this.rtAccum = mk(W, H);
    this.down = []; this.up = [];
    for (let i = 1; i <= 5; i++) this.down.push(mk(W >> i, H >> i));
    for (let i = 1; i <= 4; i++) this.up.push(mk(W >> i, H >> i));
    this.cam = new THREE.Camera(); this.quadScene = new THREE.Scene(); this.quad = new THREE.Mesh(tri, null); this.quad.frustumCulled = false; this.quadScene.add(this.quad);
    const P = (fs, u, extra = {}) => new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: fs, uniforms: u, depthTest: false, depthWrite: false, ...extra });
    this.mDof = P(DOF_FS, { tColor: { value: null }, tDepth: { value: null }, uTexel: { value: new THREE.Vector2(1 / (W >> 1), 1 / (H >> 1)) }, uNear: { value: 0.1 }, uFar: { value: 400 }, uFocus: { value: 5 }, uAperture: { value: 1 }, uMaxR: { value: 14 } });
    this.mDown = P(DOWN_FS, { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() }, uThr: { value: 0.9 }, uFirst: { value: 1 } });
    this.mUp = P(UP_FS, { tSrc: { value: null }, tBase: { value: null }, uTexel: { value: new THREE.Vector2() }, uMix: { value: 1 } });
    this.mComp = P(COMP_FS, { tColor: { value: null }, tDof: { value: null }, tDepth: { value: null }, tBloom: { value: null }, uNear: { value: 0.1 }, uFar: { value: 400 }, uFocus: { value: 5 }, uAperture: { value: 1 }, uBloom: { value: 0.5 } });
    this.mAcc = P(ACC_FS, { tSrc: { value: null }, uW: { value: 1 } }, { transparent: true, blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor });
    this.mOver = P(ACC_FS.replace('uW; void main(){ gl_FragColor = vec4(texture2D(tSrc, vUv).rgb * uW, 1.0); }', 'uW; void main(){ gl_FragColor = texture2D(tSrc, vUv); }'), { tSrc: { value: null }, uW: { value: 1 } }, { transparent: true, blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor });
    this.mFinal = P(FINAL_FS, { tA: { value: null }, uRes: { value: new THREE.Vector2(W, H) }, uFrame: { value: 0 }, uTT: { value: 0 }, uAmt: { value: 0 }, uSeed: { value: 0 }, uCA: { value: 0.0025 }, uGlitch: { value: 0 }, uVig: { value: 0.32 }, uFade: { value: 0 }, uFadeCol: { value: new THREE.Color('#0B1024') }, uExposure: { value: 1.0 }, uGrain: { value: 0.006 }, uDir: { value: new THREE.Vector2(1, 0) } });
    this.fx = { bloom: 0.5, bloomThr: 0.9, focus: 5, aperture: 1.0, ca: 0.0025, glitch: 0, vig: 0.32, fade: 0, exposure: 1.0, tt: 0, amt: 0, seed: 0, dir: [1, 0] };
  }
  pass(mat, target) { this.quad.material = mat; this.r.setRenderTarget(target); this.r.render(this.quadScene, this.cam); }

  // um subquadro: cena -> DOF/bloom -> HUD -> acumula com peso w (first limpa)
  sub(world, w, first) {
    const r = this.r, fx = this.fx, cam = world.camera;
    r.setRenderTarget(this.rtMain); r.clear(true, true, true); r.render(world.scene, cam);
    // DOF (meia resolução)
    const near = cam.near, far = cam.far;
    Object.assign(this.mDof.uniforms, { tColor: { value: this.rtMain.texture }, tDepth: { value: this.rtMain.depthTexture } }); this.mDof.uniforms.uNear.value = near; this.mDof.uniforms.uFar.value = far; this.mDof.uniforms.uFocus.value = fx.focus; this.mDof.uniforms.uAperture.value = fx.aperture;
    this.pass(this.mDof, this.rtDof);
    // bloom
    let src = this.rtMain.texture;
    for (let i = 0; i < this.down.length; i++) { const t = this.down[i]; this.mDown.uniforms.tSrc.value = src; this.mDown.uniforms.uTexel.value.set(1 / (this.W >> i), 1 / (this.H >> i)); this.mDown.uniforms.uThr.value = fx.bloomThr; this.mDown.uniforms.uFirst.value = i === 0 ? 1 : 0; this.pass(this.mDown, t); src = t.texture; }
    for (let i = this.up.length - 1; i >= 0; i--) { this.mUp.uniforms.tSrc.value = src; this.mUp.uniforms.tBase.value = this.down[i].texture; this.mUp.uniforms.uTexel.value.set(1 / (this.W >> (i + 2)), 1 / (this.H >> (i + 2))); this.pass(this.mUp, this.up[i]); src = this.up[i].texture; }
    const cu = this.mComp.uniforms; cu.tColor.value = this.rtMain.texture; cu.tDof.value = this.rtDof.texture; cu.tDepth.value = this.rtMain.depthTexture; cu.tBloom.value = src; cu.uNear.value = near; cu.uFar.value = far; cu.uFocus.value = fx.focus; cu.uAperture.value = fx.aperture; cu.uBloom.value = fx.bloom;
    r.setRenderTarget(this.rtComp); r.clear(true, true, true); this.quad.material = this.mComp; r.render(this.quadScene, this.cam);
    // acumula
    if (first) { r.setRenderTarget(this.rtAccum); r.clear(true, false, false); }
    this.mAcc.uniforms.tSrc.value = this.rtComp.texture; this.mAcc.uniforms.uW.value = w; this.pass(this.mAcc, this.rtAccum);
  }
  // HUD ortográfico (MSAA) por cima do quadro acumulado — uma vez por quadro
  hudPass(world) {
    const r = this.r; const c = new THREE.Color(); r.getClearColor(c); const a = r.getClearAlpha();
    r.setClearColor(0x000000, 0); r.setRenderTarget(this.rtHud); r.clear(true, true, true); r.render(world.hudScene, world.hudCam); r.setClearColor(c, a);
    this.mOver.uniforms.tSrc.value = this.rtHud.texture; this.pass(this.mOver, this.rtAccum);
  }
  final(frame) {
    const u = this.mFinal.uniforms, fx = this.fx; u.tA.value = this.rtAccum.texture; u.uFrame.value = frame; u.uTT.value = fx.tt; u.uAmt.value = fx.amt; u.uSeed.value = fx.seed; u.uCA.value = fx.ca; u.uGlitch.value = fx.glitch; u.uVig.value = fx.vig; u.uFade.value = fx.fade; u.uExposure.value = fx.exposure; u.uDir.value.set(...fx.dir);
    this.r.setRenderTarget(null); this.r.setViewport(0, 0, this.W, this.H); this.pass(this.mFinal, null);
  }
  readPixels(buf) { const gl = this.r.getContext(); gl.readPixels(0, 0, this.W, this.H, gl.RGBA, gl.UNSIGNED_BYTE, buf); return buf; }
}
