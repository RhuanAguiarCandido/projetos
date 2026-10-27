// Ponto de entrada: monta mundo + linha do tempo (GSAP pausada) e expõe a API de renderização determinística (window.GPS).
import * as THREE from 'three';
import gsap from 'gsap';
import { Engine } from './engine/engine.js';
import { Hud } from './engine/hud.js';
import { loadTypeface } from './kit/text.js';
import { EV } from './kit/kinetic.js';
import { STAGE, setLook } from './world/toon.js';
import { Dog } from './world/dog.js';
import { Park } from './world/park.js';
import { Space, loadLand } from './world/space.js';
import { Compass, DogField } from './world/compass.js';
import { Ctx, FPS, DUR, interp, wob } from './scenes/common.js';
import { dogPose } from './scenes/dogdir.js';
import { clamp, lerp, smooth } from './kit/util.js';

const q = new URLSearchParams(location.search);
const W = +q.get('w') || 1080, H = +q.get('h') || 1920, SS = +q.get('ss') || 4;
const SHUTTER = 0.5, MAXN = +q.get('maxn') || 5;

const LOOKS = {
  park: { keyDir: [0.5, 0.65, 0.55], rimDir: [-0.35, 0.3, -0.9], keyCol: '#FFE9C4', rimCol: '#2FD8FF', rimAmt: 0.9, fogCol: '#1E5F86', fogDen: 0.014 },
  space: { keyDir: [0.5, 0.55, 0.7], rimDir: [-0.6, 0.2, -0.8], keyCol: '#FFF4DD', rimCol: '#00D9F5', rimAmt: 1.1, fogCol: '#0A1030', fogDen: 0.0 },
  stage: { keyDir: [0.35, 0.8, 0.55], rimDir: [-0.5, 0.25, -0.85], keyCol: '#FFF1D0', rimCol: '#00D9F5', rimAmt: 1.3, fogCol: '#0B1024', fogDen: 0.02 },
};

export async function init() {
  const canvas = document.getElementById('c'); canvas.width = W; canvas.height = H;
  const engine = new Engine(canvas, W, H, { samples: SS });
  STAGE.uRes.value.set(W, H);
  const anton = await loadTypeface('/assets/fonts/Anton-Regular.ttf', 'Anton');
  const mont = await loadTypeface('/assets/fonts/Montserrat-800.ttf', 'Montserrat');
  const mont7 = await loadTypeface('/assets/fonts/Montserrat-700.ttf', 'Montserrat700');
  const land = await loadLand();

  const ctx = new Ctx(); ctx.W = W; ctx.H = H; ctx.engine = engine; ctx.tf = { anton, mont, mont7 };
  const scene = new THREE.Scene(); ctx.scene = scene;
  const camera = new THREE.PerspectiveCamera(36, W / H, 0.05, 500); ctx.camera = camera;
  ctx.hud = new Hud(1080, 1920);
  ctx.G = { park: new THREE.Group(), space: new THREE.Group(), stage: new THREE.Group() }; scene.add(ctx.G.park, ctx.G.space, ctx.G.stage);
  ctx.park = new Park(); ctx.G.park.add(ctx.park.group);
  ctx.space = new Space(land); ctx.G.space.add(ctx.space.group);
  ctx.compass = new Compass(anton); ctx.field = new DogField();
  ctx.dog = new Dog(); scene.add(ctx.dog.root);
  ctx.tl = gsap.timeline({ paused: true }); ctx.billboards = []; ctx.updaters = []; ctx.stageState = { count: 0, align: 0, hist: 0 };
  ctx.fadeOut = { v: 0 };

  for (const name of (q.get('scenes') || 's1,s2,s3,s4,s5,s6').split(',')) {
    try { const m = await import(`./scenes/${name}.js`); m.build(ctx); } catch (e) { if (!String(e).includes('Failed to fetch')) throw e; console.warn('cena ausente', name); }
  }
  ctx.shots.sort((a, b) => a.a - b.a);
  const hud = ctx.hud; const tl = ctx.tl;
  const tmpV = new THREE.Vector3();

  function setTime(ts) {
    tl.totalTime(ts, false);
    const shot = ctx.at(ts), u = ts - shot.a;
    for (const k of ['park', 'space', 'stage']) ctx.G[k].visible = shot.scene === k;
    ctx.dog.root.visible = !!shot.dog; setLook(LOOKS[shot.scene]);
    const wt = ctx.freeze && ts >= ctx.freeze[0] && ts < ctx.freeze[1] ? ctx.freeze[0] : ts; ctx.park.update(wt);
    camera.aspect = W / H; dogPose(ts, ctx.dog, shot.dogMode);
    // câmera
    const c = shot.cam(u, ts, ctx); const pl = ctx.pulseAt(ts);
    camera.position.set(...c.p); camera.up.set(0, 1, 0); camera.lookAt(new THREE.Vector3(...c.l)); camera.rotateZ((c.roll ?? 0) * Math.PI / 180);
    camera.fov = (c.fov ?? 36) * (1 - 0.05 * pl); camera.updateProjectionMatrix();
    const pxScale = H / (2 * Math.tan(camera.fov * Math.PI / 360));
    ctx.space.update(ts, pxScale); ctx.park.fireMat.uniforms.uScale.value = pxScale;
    for (const f of ctx.updaters) f(ts, shot, u);
    { let sc = 0; for (const [a, b] of ctx.subWins ?? []) sc = Math.max(sc, smooth((ts - a + 0.1) / 0.3) * smooth((b - ts) / 0.3)); hud.scrimMat.uniforms.uOpacity.value = sc; }
    for (const b of ctx.billboards) b.quaternion.copy(camera.quaternion);
    ctx.field.update(ts, ctx.stageState); ctx.compass.update(ts, ctx.needleYaw ? ctx.needleYaw(ts) : 0);
    scene.updateMatrixWorld(true); hud.scene.updateMatrixWorld(true);
    // fx
    const fx = engine.fx; const fo = shot.fx; const focus = fo.focus ?? new THREE.Vector3(...c.p).distanceTo(new THREE.Vector3(...c.l));
    fx.focus = focus; fx.aperture = fo.aperture ?? 0.6; fx.bloom = (fo.bloom ?? 0.32) + 0.25 * pl; fx.bloomThr = fo.thr ?? 1.05; fx.vig = fo.vig ?? 0.34; fx.exposure = fo.exposure ?? 1.0; fx.ca = 0.0022 + 0.004 * pl + (fo.ca ?? 0);
    camera.far = 500; return shot;
  }

  const probes = []; // {obj, hud}
  function collectProbes() { probes.length = 0; for (const b of ctx.blocks) b.forEach((g) => { if (!b.hud) probes.push({ obj: g.mesh ?? g, hud: false }); }); probes.push({ obj: ctx.dog.head, hud: false }, { obj: ctx.dog.tailRoot, hud: false }); }
  const isVis = (o) => { for (let p = o; p; p = p.parent) if (!p.visible) return false; return true; };
  const proj = (p) => { tmpV.setFromMatrixPosition(p.obj.matrixWorld); const cam = p.hud ? hud.cam : camera; tmpV.project(cam); return tmpV.z > 1 || tmpV.z < -1 ? null : [tmpV.x * W / 2, tmpV.y * H / 2]; };
  function adaptiveN(t) {
    const d = 1 / 60, tr = ctx.transAt(t); if (tr && tr.type !== 'wipe') return 2;
    collectProbes(); setTime(t - d); const A = probes.map((p) => (isVis(p.obj) ? proj(p) : null)); const cam0 = camera.position.clone(), look0 = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    setTime(t + d); let mx = 0; probes.forEach((p, i) => { if (!A[i] || !isVis(p.obj)) return; const B = proj(p); if (!B) return; mx = Math.max(mx, Math.hypot(B[0] - A[i][0], B[1] - A[i][1])); });
    const look1 = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion); mx = Math.max(mx, look1.distanceTo(look0) * H * 0.85);      // rotação de câmera
    const pxFrame = mx * (1 / 60) * 0 + mx * (FPS * 2 * d) / 1;                            // px movidos por quadro
    return clamp(Math.ceil(pxFrame * SHUTTER / 11), 1, MAXN);
  }

  function applyFrameFx(t, frame) {
    const fx = engine.fx; const tr = ctx.transAt(t); fx.tt = 0; fx.amt = 0; fx.seed = Math.floor(t * 7);
    if (tr) { fx.tt = { whip: 1, zoom: 2, glitch: 3, flash: 4, wipe: 5 }[tr.type]; fx.amt = tr.amt; fx.dir = tr.dir; }
    fx.glitch = ctx.glitchAt(t);
    const tOut = ctx.fadeOut.v; fx.fade = tOut;
  }

  window.GPS = {
    W, H, FPS, DUR, EV, ctx, engine,
    setTime,
    adaptiveN,
    async renderFrame(frame, n) {
      const t = frame / FPS; const N = n ?? adaptiveN(t);
      for (let i = 0; i < N; i++) { const ts = t + ((i + 0.5) / N - 0.5) * SHUTTER / FPS; setTime(ts); engine.sub({ scene, camera }, 1 / N, i === 0); }
      setTime(t); engine.hudPass({ hudScene: hud.scene, hudCam: hud.cam });
      applyFrameFx(t, frame); engine.final(frame); return N;
    },
    readFrame(buf) { return engine.readPixels(buf); },
    events() { return EV.slice().sort((a, b) => a.t - b.t); },
  };
  return window.GPS;
}
