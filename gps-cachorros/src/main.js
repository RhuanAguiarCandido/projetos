// Renderizador determinístico: cada quadro é função pura do tempo. Subquadros acumulados = motion blur real.
import * as THREE from 'three';
import { Post } from './post.js';
import { Park } from './park.js';
import { Dog } from './dog.js';
import { Overlay } from './overlay.js';
import { Director } from './director.js';

const q = new URLSearchParams(location.search);
const SCALE = +(q.get('scale') || 1);
const W = Math.round(1080 * SCALE), H = Math.round(1920 * SCALE);
const FPS = 30;
const OV_OFF = q.get('ov') === '0';
const BLOOM_MUL = q.has('bloom') ? +q.get('bloom') : 1;

const canvas = document.getElementById('c'); canvas.width = W; canvas.height = H;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true, alpha: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(1); renderer.setSize(W, H, false); renderer.autoClear = false;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;

const post = new Post(renderer, W, H, q.has('msaa') ? +q.get('msaa') : 4);
const overlay = new Overlay(1080, 1920, SCALE);
post.fin.tOverlay.value = overlay.texture;

const park = new Park();
const dog = new Dog();
park.scene.add(dog.root);

const world = { THREE, renderer, post, overlay, park, dog, W, H, FPS, scale: SCALE };
const director = new Director(world);

await document.fonts.ready;
await Promise.all([document.fonts.load('100px Anton'), document.fonts.load('800 60px Montserrat'), document.fonts.load('600 40px Montserrat')]);
await director.init();

const DBG = { noOverlay: false, noBloom: false, tm: null };
let _tp = 0; const _px = new Uint8Array(4); const sync = () => { const g = renderer.getContext(); renderer.setRenderTarget(null); g.readPixels(0, 0, 1, 1, g.RGBA, g.UNSIGNED_BYTE, _px); };
const mark = (label) => { if (!DBG.tm) return; sync(); const n = performance.now(); DBG.tm[label] = (DBG.tm[label] || 0) + (n - _tp); _tp = performance.now(); };
function smoothstep01(x) { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); }
function drawSub(t, weight, ovT) {
  if (DBG.tm) { sync(); _tp = performance.now(); }
  const P = director.plan(t);
  const LA = director.apply(P.A, t); mark('apply');
  post.renderScene(LA.scene, LA.cam, post.rtA, LA.bg); mark('scene');
  let srcA = post.rtA;
  if (LA.dof.on) { srcA = post.dof(post.rtA, LA.cam, post.rtDofA, LA.dof); } mark('dof');
  if (LA.holo) post.renderHolo(LA.holo, LA.cam, srcA); mark('holo');
  let src = srcA, grade = LA.grade, primary = LA;
  if (P.B) {
    const LB = director.apply(P.B, t);
    post.renderScene(LB.scene, LB.cam, post.rtB, LB.bg);
    let srcB = post.rtB;
    if (LB.dof.on) { srcB = post.dof(post.rtB, LB.cam, post.rtDofB, LB.dof); }
    if (LB.holo) post.renderHolo(LB.holo, LB.cam, srcB);
    const T = P.trans, u = post.mTrans.uniforms;
    u.tA.value = srcA.texture; u.tB.value = srcB.texture; u.uType.value = T.type; u.uP.value = T.p;
    u.uDir.value.set(...(T.dir || [1, 0])); u.uCenter.value.set(...(T.center || [0.5, 0.5])); u.uSeed.value = T.seed || 0;
    post.pass(post.mTrans, post.rtC); src = post.rtC;
    grade = director.mixGrade(LA.grade, LB.grade, smoothstep01((T.p - 0.35) / 0.3));
    if (T.fx) Object.assign(grade, T.fx(T.p, grade));
    primary = T.p < 0.5 ? LA : LB;
  }
  if (!DBG.noOverlay && (ovT === undefined || DBG.ovFresh)) { overlay.begin(); director.drawOverlay(overlay, ovT ?? t, primary.anchors); overlay.upload(); } mark('overlay');
  const bl = DBG.noBloom ? src : post.bloom(src, grade.bloomThresh ?? 1.0, 0.6); mark('bloom');
  const f = post.fin; const g = grade;
  f.tScene.value = src.texture; f.tBloom.value = bl.texture;
  f.uBloom.value = (g.bloom ?? 0.5) * BLOOM_MUL; f.uAb.value = g.ab ?? 0.0012; f.uGlitch.value = g.glitch ?? 0; f.uTime.value = t;
  f.uVig.value = g.vig ?? 0.35; f.uGrain.value = g.grain ?? 0.022; f.uExposure.value = g.exposure ?? 1; f.uContrast.value = g.contrast ?? 1.06;
  f.uSat.value = g.sat ?? 1.1; f.uDesat.value = g.desat ?? 0; f.uWeight.value = weight; f.uFlash.value = g.flash ?? 0; f.uWarp.value = g.warp ?? 0.03;
  f.uOverlayOn.value = OV_OFF ? 0 : (g.overlay ?? 1); f.uLetter.value = g.letter ?? 0;
  f.uShake.value.set(g.shakeX ?? 0, g.shakeY ?? 0);
  f.uFlashCol.value.set(...(g.flashCol || [1, 1, 1]));
  f.uShadowTint.value.set(...(g.shadowTint || [0.82, 0.92, 1.12])); f.uHiTint.value.set(...(g.hiTint || [1.10, 1.02, 0.88]));
  f.uGain.value.set(...(g.gain || [1, 1, 1])); f.uLift.value.set(...(g.lift || [0, 0, 0]));
  post.pass(post.mFinal, post.accum); mark('final');
}

// frame: índice do quadro; N: subquadros (0 = automático pelo movimento); shutter: fração do intervalo de quadro (0.5 = 180°)
async function renderFrame(frame, N = 1, shutter = 0.5) {
  const dt = shutter / FPS;
  if (N === 0) { const px = director.motionPx(frame / FPS, frame / FPS + dt); N = px >= 99 || px === 60 ? 1 : px < 20 ? 1 : px < 60 ? 2 : 3; }
  post.beginFrame();
  for (let k = 0; k < N; k++) {
    const t = (frame + (N > 1 ? (k / N) * shutter : 0)) / FPS;
    // overlay: desenhado uma única vez por quadro (no meio da exposição) e reutilizado nos subquadros
    if (k === 0) { DBG.ovFresh = true; drawSub(t, 1 / N, (frame + 0.5 * shutter * (N > 1 ? 1 : 0)) / FPS); DBG.ovFresh = false; }
    else drawSub(t, 1 / N, 0);
  }
  post.endFrame();
  renderer.getContext().finish();
  window.__lastN = N;
}
async function renderAt(t, N = 1, shutter = 0.5) { return renderFrame(t * FPS, N, shutter); }

const gl = renderer.getContext();
const pix = new Uint8Array(W * H * 4);
function readPixels() { gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, pix); return pix; }

async function send(url) { const px = readPixels(); const r = await fetch(url, { method: 'POST', body: px }); if (!r.ok) throw new Error('send failed ' + r.status); }
window.R = { renderFrame, renderAt, readPixels, send, W, H, FPS, director, world, DBG };
window.__ready = true;
