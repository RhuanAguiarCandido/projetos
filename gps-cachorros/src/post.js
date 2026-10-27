// Pipeline de imagem: cena(s) HDR+MSAA -> DOF -> transição -> bloom -> grade/lente/overlay -> acúmulo (motion blur).
import * as THREE from 'three';

const VS = /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

const fsCoc = /* glsl */ `
precision highp float; varying vec2 vUv;
uniform sampler2D tColor, tDepth; uniform float uNear, uFar, uFocus, uAperture, uMaxCoc, uRange; uniform float uOn;
float viewZ(float d){ return (uNear * uFar) / (uFar - d * (uFar - uNear)); }
void main(){
  vec4 c = texture2D(tColor, vUv);
  float z = viewZ(texture2D(tDepth, vUv).x);
  float coc = uOn * clamp(max(abs(z - uFocus) - uRange, 0.0) / z * uAperture, 0.0, 1.0) * uMaxCoc;
  gl_FragColor = vec4(c.rgb, coc);
}`;

const fsDof = /* glsl */ `
precision highp float; varying vec2 vUv;
uniform sampler2D tCoc; uniform vec2 uTexel; uniform float uMaxCoc;
void main(){
  vec4 c0 = texture2D(tCoc, vUv);
  if (uMaxCoc < 0.5) { gl_FragColor = vec4(c0.rgb, 1.0); return; }
  float R = c0.a;
  vec3 acc = c0.rgb; float ws = 1.0;
  const int N = 24;
  const float GA = 2.39996323;
  for (int i = 1; i < N; i++) {
    float fi = float(i);
    float rr = sqrt(fi / float(N));
    vec2 o = vec2(cos(fi * GA), sin(fi * GA)) * rr * uMaxCoc;
    vec4 s = texture2D(tCoc, vUv + o * uTexel);
    float d = length(o);
    // o disco de desfoque da amostra alcança o pixel? (scatter-as-gather)
    float w = smoothstep(d - 1.0, d + 1.0, s.a);
    // um pixel nítido não recebe desfoque do fundo (borda do foco preservada)
    w *= 1.0 - smoothstep(R + 1.0, R + 6.0, s.a);
    // pontos muito brilhantes viram discos de bokeh
    float lum = dot(s.rgb, vec3(0.299, 0.587, 0.114));
    w *= 1.0 + 1.6 * smoothstep(1.5, 6.0, lum);
    acc += s.rgb * w; ws += w;
  }
  gl_FragColor = vec4(acc / ws, 1.0);
}`;

const fsDofComp = /* glsl */ `
precision highp float; varying vec2 vUv; uniform sampler2D tCoc, tBlur; uniform float uMaxCoc;
void main(){
  vec4 c = texture2D(tCoc, vUv);
  if (uMaxCoc < 0.5) { gl_FragColor = vec4(c.rgb, 1.0); return; }
  vec3 b = texture2D(tBlur, vUv).rgb;
  gl_FragColor = vec4(mix(c.rgb, b, smoothstep(0.4, 3.2, c.a)), 1.0);
}`;

const fsBright = /* glsl */ `
precision highp float; varying vec2 vUv; uniform sampler2D tSrc; uniform vec2 uTexel; uniform float uThresh, uKnee;
vec3 prefilter(vec3 c){ float br = max(max(c.r, c.g), c.b); float soft = clamp(br - uThresh + uKnee, 0.0, 2.0 * uKnee); soft = soft * soft / (4.0 * uKnee + 1e-4); float k = max(soft, br - uThresh) / max(br, 1e-4); return c * k; }
void main(){
  vec3 a = prefilter(texture2D(tSrc, vUv + uTexel * vec2(-1.0, -1.0)).rgb);
  vec3 b = prefilter(texture2D(tSrc, vUv + uTexel * vec2( 1.0, -1.0)).rgb);
  vec3 c = prefilter(texture2D(tSrc, vUv + uTexel * vec2(-1.0,  1.0)).rgb);
  vec3 d = prefilter(texture2D(tSrc, vUv + uTexel * vec2( 1.0,  1.0)).rgb);
  gl_FragColor = vec4((a + b + c + d) * 0.25, 1.0);
}`;
const fsDown = /* glsl */ `
precision highp float; varying vec2 vUv; uniform sampler2D tSrc; uniform vec2 uTexel;
void main(){
  vec3 s = texture2D(tSrc, vUv).rgb * 4.0;
  s += texture2D(tSrc, vUv + uTexel * vec2(-1.0, -1.0)).rgb + texture2D(tSrc, vUv + uTexel * vec2(1.0, -1.0)).rgb;
  s += texture2D(tSrc, vUv + uTexel * vec2(-1.0, 1.0)).rgb + texture2D(tSrc, vUv + uTexel * vec2(1.0, 1.0)).rgb;
  gl_FragColor = vec4(s / 8.0, 1.0);
}`;
const fsUp = /* glsl */ `
precision highp float; varying vec2 vUv; uniform sampler2D tSrc, tPrev; uniform vec2 uTexel; uniform float uMix;
void main(){
  vec3 s = texture2D(tSrc, vUv + uTexel * vec2(-1.0, 0.0)).rgb + texture2D(tSrc, vUv + uTexel * vec2(1.0, 0.0)).rgb
         + texture2D(tSrc, vUv + uTexel * vec2(0.0, -1.0)).rgb + texture2D(tSrc, vUv + uTexel * vec2(0.0, 1.0)).rgb;
  s += 2.0 * (texture2D(tSrc, vUv + uTexel * vec2(-0.5, -0.5)).rgb + texture2D(tSrc, vUv + uTexel * vec2(0.5, -0.5)).rgb
            + texture2D(tSrc, vUv + uTexel * vec2(-0.5, 0.5)).rgb + texture2D(tSrc, vUv + uTexel * vec2(0.5, 0.5)).rgb);
  gl_FragColor = vec4(texture2D(tPrev, vUv).rgb + s / 12.0 * uMix, 1.0);
}`;

// Transições A -> B
const fsTrans = /* glsl */ `
precision highp float; varying vec2 vUv;
uniform sampler2D tA, tB; uniform int uType; uniform float uP, uAspect, uSeed; uniform vec2 uDir, uCenter;
float h11(float p){ p = fract(p * .1031); p *= p + 33.33; p *= p + p; return fract(p); }
vec3 blurDir(sampler2D t, vec2 uv, vec2 dir, float amt){
  // amostras com jitter (ruído de gradiente intercalado): o borrão vira ruído fino em vez de "cópias" empilhadas
  float j = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
  vec3 s = vec3(0.0); float ws = 0.0;
  for (int i = 0; i < 28; i++){ float f = (float(i) + j) / 28.0 - 0.5; float w = 1.0 - abs(f) * 1.2; s += texture2D(t, uv + dir * f * amt).rgb * w; ws += w; }
  return s / ws;
}
vec3 blurRad(sampler2D t, vec2 uv, vec2 c, float scale, float amt){
  vec3 s = vec3(0.0); float ws = 0.0;
  for (int i = 0; i < 18; i++){ float f = float(i) / 17.0; vec2 d = (uv - c); float k = scale * (1.0 - f * amt); vec2 u = c + d * k; s += texture2D(t, u).rgb; ws += 1.0; }
  return s / ws;
}
void main(){
  vec2 uv = vUv; vec3 col;
  float p = uP;
  if (uType == 0) { col = texture2D(tA, uv).rgb; }
  else if (uType == 1) {            // whip: arrasto direcional, corte escondido no pico do borrão
    float amt = sin(p * 3.14159) * 0.55;
    vec2 off = uDir * (p < 0.5 ? p : p - 1.0) * 0.9;
    col = p < 0.5 ? blurDir(tA, uv - off, uDir, amt) : blurDir(tB, uv - off, uDir, amt);
  }
  else if (uType == 2) {            // zoom radial (punch-in)
    float amt = sin(p * 3.14159) * 0.55;
    if (p < 0.5) col = blurRad(tA, uv, uCenter, 1.0 / (1.0 + p * 2.4), amt);
    else col = blurRad(tB, uv, uCenter, 1.0 / (1.0 + (p - 1.0) * 2.4 * -1.0 * -1.0 * 0.0 + (1.0 - p) * 2.4), amt);
  }
  else if (uType == 3) {            // íris em anel com borda ciano
    vec2 q = (uv - uCenter) * vec2(uAspect, 1.0);
    float r = length(q); float R = p * 2.0;
    float edge = smoothstep(R - 0.02, R, r) - smoothstep(R, R + 0.02, r);
    vec2 dirv = normalize(q + 1e-5);
    float refr = smoothstep(R - 0.18, R, r) * (1.0 - smoothstep(R, R + 0.02, r));
    vec2 uvB = uv - dirv * refr * 0.03 / vec2(uAspect, 1.0);
    col = mix(texture2D(tA, uv).rgb, texture2D(tB, uvB).rgb, smoothstep(R, R - 0.012, r));
    col += vec3(0.0, 0.85, 0.96) * edge * 5.0 + vec3(0.98, 0.84, 0.28) * smoothstep(R - 0.05, R, r) * (1.0 - smoothstep(R, R + 0.004, r)) * 0.8;
  }
  else if (uType == 4) {            // glitch por fatias
    float sl = floor(uv.y * 36.0 + uSeed * 7.0); float rr = h11(sl + floor(p * 14.0) * 3.7);
    float act = smoothstep(0.0, 0.2, min(p, 1.0 - p) * 2.0);
    float sh = (rr - 0.5) * 0.28 * act * step(0.4, h11(sl * 1.7 + uSeed));
    vec2 u2 = uv + vec2(sh, 0.0);
    vec3 a = vec3(texture2D(tA, u2 + vec2(0.012 * act, 0.0)).r, texture2D(tA, u2).g, texture2D(tA, u2 - vec2(0.012 * act, 0.0)).b);
    vec3 b = vec3(texture2D(tB, u2 + vec2(0.012 * act, 0.0)).r, texture2D(tB, u2).g, texture2D(tB, u2 - vec2(0.012 * act, 0.0)).b);
    col = p < 0.5 + (rr - 0.5) * 0.3 ? a : b;
  }
  else {                            // flash
    col = p < 0.5 ? texture2D(tA, uv).rgb : texture2D(tB, uv).rgb;
    col += vec3(1.0, 0.95, 0.8) * pow(sin(p * 3.14159), 3.0) * 2.2;
  }
  gl_FragColor = vec4(col, 1.0);
}`;

const fsFinal = /* glsl */ `
precision highp float; varying vec2 vUv;
uniform sampler2D tScene, tBloom, tOverlay; uniform float uBloom, uAb, uGlitch, uTime, uVig, uGrain, uExposure, uContrast, uSat, uWeight, uFlash, uAspect, uOverlayOn, uWarp, uDesat, uLetter;
uniform vec3 uLift, uGain, uFlashCol, uShadowTint, uHiTint; uniform vec2 uShake;
float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
vec3 aces(vec3 x){ return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
void main(){
  vec2 uv = vUv + uShake;
  // lente: leve distorção em barril + aberração cromática radial
  vec2 c = uv - 0.5; float r2 = dot(c * vec2(uAspect, 1.0), c * vec2(uAspect, 1.0));
  uv = 0.5 + c * (1.0 + uWarp * r2);
  // glitch: deslocamento de fatias horizontais
  float g = uGlitch;
  float sl = floor(uv.y * 48.0); float rr = h21(vec2(sl, floor(uTime * 24.0)));
  float sh = (rr - 0.5) * 0.16 * g * step(0.72, h21(vec2(sl * 0.37, floor(uTime * 24.0) + 3.0)));
  uv.x += sh;
  float ab = uAb * (0.4 + r2 * 2.2) + g * 0.012;
  vec2 dir = normalize(c + 1e-4);
  vec3 col;
  col.r = texture2D(tScene, uv + dir * ab).r;
  col.g = texture2D(tScene, uv).g;
  col.b = texture2D(tScene, uv - dir * ab).b;
  vec3 bl = texture2D(tBloom, uv).rgb;
  col += bl * uBloom;
  col *= uExposure;
  // grade: lift/gain, tons de sombra/luz (azul-marinho na sombra, quente nas luzes)
  col = col * uGain + uLift;
  float lum = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(col, col * uShadowTint, (1.0 - smoothstep(0.0, 0.6, lum)) * 0.6);
  col = mix(col, col * uHiTint, smoothstep(0.4, 1.6, lum) * 0.5);
  col = aces(col);
  col = pow(col, vec3(1.0 / 2.2));
  col = mix(vec3(dot(col, vec3(0.299, 0.587, 0.114))), col, uSat);
  col = mix(col, vec3(dot(col, vec3(0.299, 0.587, 0.114))), uDesat);
  col = (col - 0.5) * uContrast + 0.5;
  // vinheta
  float vg = smoothstep(0.35, 1.05, length(c * vec2(uAspect * 0.9, 1.15)));
  col *= 1.0 - vg * uVig;
  // overlay 2D (já em sRGB, pré-multiplicado)
  vec2 ouv = uv;
  vec4 ov;
  ov.r = texture2D(tOverlay, ouv + vec2(g * 0.006 + uAb * 0.5, 0.0)).r;
  vec4 o2 = texture2D(tOverlay, ouv); ov.g = o2.g; ov.a = o2.a;
  ov.b = texture2D(tOverlay, ouv - vec2(g * 0.006 + uAb * 0.5, 0.0)).b;
  col = col * (1.0 - o2.a * uOverlayOn) + ov.rgb * uOverlayOn;
  // flash + grão + dither
  col = mix(col, uFlashCol, uFlash);
  col += (h21(uv * 1000.0 + fract(uTime) * 91.7) - 0.5) * uGrain;
  col += (h21(gl_FragCoord.xy + fract(uTime * 3.1) * 77.0) - 0.5) / 255.0;
  // letterbox opcional (barras suaves nos cortes dramáticos)
  float lb = uLetter; float bar = smoothstep(0.0, 0.002, vUv.y - lb * 0.5) * smoothstep(0.0, 0.002, (1.0 - vUv.y) - lb * 0.5);
  col *= mix(1.0, bar, step(0.0001, lb));
  gl_FragColor = vec4(col * uWeight, uWeight);
}`;

const fsBlit = /* glsl */ `
precision highp float; varying vec2 vUv; uniform sampler2D tSrc;
void main(){ gl_FragColor = vec4(clamp(texture2D(tSrc, vUv).rgb, 0.0, 1.0), 1.0); }`;

export class Post {
  constructor(renderer, W, H, msaa = 4) {
    this.r = renderer; this.W = W; this.H = H;
    const rtOpts = { type: THREE.HalfFloatType, format: THREE.RGBAFormat, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: true };
    const mk = (w, h, o = {}) => new THREE.WebGLRenderTarget(w, h, { ...rtOpts, depthBuffer: false, ...o });
    const mkScene = () => { const t = new THREE.WebGLRenderTarget(W, H, { ...rtOpts, samples: msaa }); t.depthTexture = new THREE.DepthTexture(W, H); t.depthTexture.type = THREE.UnsignedIntType; return t; };
    this.rtA = mkScene(); this.rtB = mkScene();
    this.rtCoc = mk(W, H); this.rtDofHalf = mk(W >> 1, H >> 1);
    this.rtDofA = mk(W, H, { depthBuffer: true, depthTexture: this.rtA.depthTexture });   // hologramas testam contra a profundidade da cena
    this.rtDofB = mk(W, H, { depthBuffer: true, depthTexture: this.rtB.depthTexture });
    this.rtC = mk(W, H);
    this.accum = mk(W, H, { type: THREE.HalfFloatType });
    this.lv = []; this.up = [];
    for (let i = 0; i < 5; i++) { const w = Math.max(2, W >> (i + 1)), h = Math.max(2, H >> (i + 1)); this.lv.push(mk(w, h)); this.up.push(mk(w, h)); }
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
    this.quad.frustumCulled = false;
    this.cam = new THREE.Camera();
    this.scn = new THREE.Scene(); this.scn.add(this.quad);
    const mat = (fs, u, extra = {}) => new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: fs, uniforms: u, depthTest: false, depthWrite: false, ...extra });
    this.mCoc = mat(fsCoc, { tColor: { value: null }, tDepth: { value: null }, uNear: { value: 0.1 }, uFar: { value: 200 }, uFocus: { value: 4 }, uAperture: { value: 1 }, uMaxCoc: { value: 16 }, uRange: { value: 0.8 }, uOn: { value: 1 } });
    this.mDof = mat(fsDof, { tCoc: { value: null }, uTexel: { value: new THREE.Vector2(1 / W, 1 / H) }, uMaxCoc: { value: 16 } });
    this.mDofComp = mat(fsDofComp, { tCoc: { value: null }, tBlur: { value: null }, uMaxCoc: { value: 16 } });
    this.mBright = mat(fsBright, { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() }, uThresh: { value: 1.0 }, uKnee: { value: 0.6 } });
    this.mDown = mat(fsDown, { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() } });
    this.mUp = mat(fsUp, { tSrc: { value: null }, tPrev: { value: null }, uTexel: { value: new THREE.Vector2() }, uMix: { value: 1 } });
    this.mTrans = mat(fsTrans, { tA: { value: null }, tB: { value: null }, uType: { value: 0 }, uP: { value: 0 }, uAspect: { value: W / H }, uSeed: { value: 0 }, uDir: { value: new THREE.Vector2(1, 0) }, uCenter: { value: new THREE.Vector2(0.5, 0.5) } });
    this.fin = {
      tScene: { value: null }, tBloom: { value: null }, tOverlay: { value: null }, uBloom: { value: 0.5 }, uAb: { value: 0.0015 }, uGlitch: { value: 0 }, uTime: { value: 0 }, uVig: { value: 0.35 }, uGrain: { value: 0.025 },
      uExposure: { value: 1 }, uContrast: { value: 1.06 }, uSat: { value: 1.12 }, uWeight: { value: 1 }, uFlash: { value: 0 }, uAspect: { value: W / H }, uOverlayOn: { value: 1 }, uWarp: { value: 0.03 }, uDesat: { value: 0 }, uLetter: { value: 0 },
      uLift: { value: new THREE.Vector3(0, 0, 0) }, uGain: { value: new THREE.Vector3(1, 1, 1) }, uFlashCol: { value: new THREE.Vector3(1, 1, 1) },
      uShadowTint: { value: new THREE.Vector3(0.82, 0.92, 1.12) }, uHiTint: { value: new THREE.Vector3(1.10, 1.02, 0.88) }, uShake: { value: new THREE.Vector2() },
    };
    this.mFinal = mat(fsFinal, this.fin, { transparent: true, blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneFactor });
    this.mBlit = mat(fsBlit, { tSrc: { value: null } });
    this.overlayTex = null;
  }

  beginFrame() { this.r.setRenderTarget(this.accum); this.r.setClearColor(0x000000, 0); this.r.clear(true, true, true); }
  endFrame() { this.mBlit.uniforms.tSrc.value = this.accum.texture; this.pass(this.mBlit, null); }

  pass(material, target, clear = false) {
    this.quad.material = material;
    this.r.setRenderTarget(target);
    if (clear) { this.r.setClearColor(0x000000, 0); this.r.clear(true, true, true); }
    this.r.render(this.scn, this.cam);
  }

  renderScene(scene, camera, rt, bg) {
    this.r.setRenderTarget(rt);
    this.r.setClearColor(bg ?? 0x000000, 1);
    this.r.clear(true, true, true);
    this.r.render(scene, camera);
  }

  renderHolo(scene, camera, rt) {
    this.r.setRenderTarget(rt); this.r.render(scene, camera);
  }

  dof(rt, cam, dst, p) {
    const m = this.mCoc.uniforms;
    m.tColor.value = rt.texture; m.tDepth.value = rt.depthTexture; m.uNear.value = cam.near; m.uFar.value = cam.far;
    m.uFocus.value = p.focus; m.uAperture.value = p.aperture; m.uMaxCoc.value = p.maxCoc; m.uRange.value = p.range ?? 0.8; m.uOn.value = p.on ? 1 : 0;
    this.pass(this.mCoc, this.rtCoc);
    this.mDof.uniforms.tCoc.value = this.rtCoc.texture; this.mDof.uniforms.uMaxCoc.value = p.on ? p.maxCoc : 0;
    this.pass(this.mDof, this.rtDofHalf);
    this.mDofComp.uniforms.tCoc.value = this.rtCoc.texture; this.mDofComp.uniforms.tBlur.value = this.rtDofHalf.texture; this.mDofComp.uniforms.uMaxCoc.value = p.on ? p.maxCoc : 0;
    this.pass(this.mDofComp, dst);
    return dst;
  }

  bloom(src, thresh = 1.0, knee = 0.6) {
    let prev = src;
    for (let i = 0; i < 5; i++) {
      const t = this.lv[i];
      const m = i === 0 ? this.mBright : this.mDown;
      m.uniforms.tSrc.value = prev.texture; m.uniforms.uTexel.value.set(1 / prev.width, 1 / prev.height);
      if (i === 0) { m.uniforms.uThresh.value = thresh; m.uniforms.uKnee.value = knee; }
      this.pass(m, t); prev = t;
    }
    // sobe: up[i] = lv[i] + tent(up[i+1])
    let carry = null;
    for (let i = 4; i >= 0; i--) {
      if (i === 4) { carry = this.lv[4]; continue; }
      const m = this.mUp; m.uniforms.tSrc.value = carry.texture; m.uniforms.tPrev.value = this.lv[i].texture;
      m.uniforms.uTexel.value.set(1 / carry.width, 1 / carry.height); m.uniforms.uMix.value = 1.0;
      this.pass(m, this.up[i]); carry = this.up[i];
    }
    return carry;
  }
}
