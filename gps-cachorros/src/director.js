// Diretor: dado o tempo global t decide planos (shots), câmera, pose do cão, bússola, transições, grade e overlay.
import * as THREE from 'three';
import { dogState } from './dogAnim.js';
import { HoloCompass } from './compass.js';
import { buildChunks, drawCaption, COL, clamp, lerp } from './typography.js';
import { buildShots, LOOKS } from './shots.js';
import { drawOverlayAll } from './overlays.js';
import { Space } from './space.js';
import { Ribbons } from './fieldlines.js';

const V = (a) => new THREE.Vector3(a[0], a[1], a[2]);
const DEFAULT_GRADE = { bloom: 0.55, bloomThresh: 1.0, ab: 0.0013, glitch: 0, vig: 0.38, grain: 0.022, exposure: 1.0, contrast: 1.07, sat: 1.12, desat: 0, flash: 0, warp: 0.035, overlay: 1, letter: 0, shakeX: 0, shakeY: 0 };

export class Director {
  constructor(world) {
    this.w = world;
    this.cam = new THREE.PerspectiveCamera(32, 1080 / 1920, 0.05, 700);
    this.T = THREE; this.V = V;
    this.shellMul = 1; this.dry = false;
    this.freezes = [[35.58, 0.30, 1.2]];
    this.t = 0; this.dogS = null; this.anchors = {}; this.primary = null;
    this._tmp = new THREE.Vector3();
  }

  async init() {
    const q = new URLSearchParams(location.search);
    this.voice = q.get('voice') || 'pf_dora';
    this.timing = await (await fetch(`/audio/build/timing_${this.voice}.json`)).json();
    this.chunks = buildChunks(this.timing.lines);
    const { park, dog } = this.w;
    // bússolas holográficas
    this.cmpHead = new HoloCompass({ size: 0.30 });           // acima da cabeça (billboard)
    park.holo.add(this.cmpHead.group);
    this.cmpGround = new HoloCompass({ size: 0.92, withField: false, withSparks: true, intensity: 1.9 });  // projetada no gramado
    this.cmpGround.group.rotation.x = -Math.PI / 2; this.cmpGround.group.position.y = 0.21; park.holo.add(this.cmpGround.group);
    // eixo norte-sul 3D sobre o gramado (testa profundidade: o cão passa na frente)
    const pts = []; for (let i = 0; i <= 48; i++) pts.push(new THREE.Vector3(0, 0.235, -1.75 + (3.5 * i) / 48));
    this.axis = new Ribbons([pts], { width: 7, colA: '#f9d548', colB: '#fff3b0', freq: 3, speed: 0.9, base: 0.8 });
    this.axis.mesh.visible = false; park.holo.add(this.axis.mesh);
    this.space = new Space(this);
    this.shots = buildShots(this);
    this.looks = LOOKS;
    this.lookCur = null;
  }

  // ---- utilidades para os planos ----
  setCam(c) {
    const cam = this.cam; cam.position.set(...c.pos); cam.fov = c.fov ?? 32; cam.near = c.near ?? 0.05; cam.far = c.far ?? 700; cam.updateProjectionMatrix();
    cam.up.set(...(c.up ?? [0, 1, 0])); cam.lookAt(...c.target); if (c.roll) cam.rotateZ(c.roll);
    cam.updateMatrixWorld(true);
  }
  headPos(out = new THREE.Vector3()) { this.w.dog.head.getWorldPosition(out); return out; }
  project(v) { const p = this._tmp.copy(v).project(this.cam); return { x: (p.x * 0.5 + 0.5) * 1080, y: (1 - (p.y * 0.5 + 0.5)) * 1920, z: p.z, front: p.z < 1 }; }
  pxPerMeter(v) { const d = this.cam.position.distanceTo(v); return (1920 / 2) / (Math.tan((this.cam.fov * Math.PI) / 360) * d); }

  // projetor com matrizes "congeladas" (o overlay roda depois que a câmera já mudou para o plano B)
  makeProjector() {
    const m = new THREE.Matrix4().multiplyMatrices(this.cam.projectionMatrix, this.cam.matrixWorldInverse); const e = m.elements.slice();
    return (x, y, z) => {
      if (x && x.isVector3) { z = x.z; y = x.y; x = x.x; }
      const w = e[3] * x + e[7] * y + e[11] * z + e[15];
      return { x: (((e[0] * x + e[4] * y + e[8] * z + e[12]) / w) * 0.5 + 0.5) * 1080, y: (1 - (((e[1] * x + e[5] * y + e[9] * z + e[13]) / w) * 0.5 + 0.5)) * 1920, w };
    };
  }
  // congelamento de quadro (cena 5): o mundo para por d segundos em f0 e depois "alcança" o relógio
  worldTime(t) {
    let off = 0;
    for (const [f0, d, catchUp] of this.freezes) {
      if (t >= f0 && t < f0 + d) return f0 - off;
      if (t >= f0 + d) { const u = t - f0 - d; const k = clamp(u / catchUp); off += d * (1 - k * k * (3 - 2 * k)); }
    }
    return t - off;
  }

  // ---- planejamento: quais planos estão ativos em t ----
  plan(t) {
    const S = this.shots; let i = 0;
    for (let k = 0; k < S.length; k++) if (t >= S[k].t0) i = k;
    const cur = S[i]; let P = { A: { shot: cur }, B: null, trans: null };
    const nxt = S[i + 1];
    if (nxt && nxt.trans) { const h = nxt.trans.dur / 2; if (t >= nxt.t0 - h) P = { A: { shot: cur }, B: { shot: nxt }, trans: { ...nxt.trans, p: clamp((t - (nxt.t0 - h)) / nxt.trans.dur) } }; }
    if (cur.trans && t < cur.t0 + cur.trans.dur / 2 && i > 0) { const prv = S[i - 1]; P = { A: { shot: prv }, B: { shot: cur }, trans: { ...cur.trans, p: clamp((t - (cur.t0 - cur.trans.dur / 2)) / cur.trans.dur) } }; }
    return P;
  }

  // aplica o estado do plano (cão, câmera, bússola, luz) e devolve o que renderizar
  apply(layer, t) {
    const sh = layer.shot, { park, dog } = this.w; const treal = t; t = this.worldTime(t); const lt = t - sh.t0;
    this.t = t; this.treal = treal; this.curShot = sh;
    const L = { scene: null, cam: this.cam, bg: 0x000000, dof: { on: false }, grade: { ...DEFAULT_GRADE, ...(sh.grade ? (typeof sh.grade === 'function' ? sh.grade(treal, lt, this) : sh.grade) : {}) } };
    if (sh.scene === 'park') {
      const S = dogState(t); this.dogS = S;
      dog.root.position.set(S.x, 0, S.z); dog.root.rotation.y = S.yaw; dog.setPose(S.pose); dog.root.updateMatrixWorld(true);
      park.setTime(t); park.setDog(dog.root.position, S.yaw);
      park.setLook(this.looks[sh.look || 'golden']);
      this.cmpHead.group.visible = false; this.cmpGround.group.visible = false; park.qMark.visible = false; this.axis.mesh.visible = false;
      dog.setFlash(0);
      const c = sh.cam(t, lt, this); this.setCam(c);
      if (sh.setup) sh.setup(t, lt, this);
      L.scene = park.scene; L.holo = park.holo; L.bg = 0x000000;
      const dd = this.cam.position.distanceTo(this.headPos());
      const d = sh.dof ?? {}; L.dof = { on: d.on ?? true, focus: (typeof d.focus === 'function' ? d.focus(this) : (d.focus ?? dd)) + (d.focusOff ?? 0), aperture: d.aperture ?? 1.0, maxCoc: d.maxCoc ?? 20, range: d.range ?? 0.9 };
      this.anchors = this._parkAnchors(dd);
      // qualidade do pelo conforme o tamanho do cão na tela
      const ppm = this.anchors.head.ppm; dog.setShellRatio((ppm > 620 ? 0.54 : ppm > 380 ? 0.42 : 0.32) * this.shellMul); dog.setLOD(ppm > 520 ? 0 : 1);
    } else {
      const c = sh.cam(t, lt, this); this.setCam(c);
      this.space.setTime(t);
      if (sh.setup) sh.setup(t, lt, this);
      L.scene = this.space.scene; L.holo = this.space.holo || null; L.bg = 0x02040c;
      const d = sh.dof ?? {}; L.dof = { on: d.on ?? false, focus: d.focus ?? 10, aperture: d.aperture ?? 1, maxCoc: d.maxCoc ?? 10, range: d.range ?? 1 };
      this.anchors = this.space.anchors ? { ...this.space.anchors(this), proj: this.makeProjector() } : {};
    }
    L.anchors = this.anchors; L.shot = sh; L.camSnap = { fov: this.cam.fov };
    L.cam = this.cam;
    return L;
  }

  _parkAnchors(dd) {
    const h = this.headPos(); const dp = this.w.dog.root.position;
    const body = new THREE.Vector3(dp.x, 0.65, dp.z);
    return { proj: this.makeProjector(), head: { ...this.project(h), ppm: this.pxPerMeter(h) }, body: { ...this.project(body), ppm: this.pxPerMeter(body) }, ground: { ...this.project(new THREE.Vector3(dp.x, 0.02, dp.z)), ppm: this.pxPerMeter(dp) } };
  }

  // deslocamento máximo (px) entre dois instantes: define quantos subquadros de motion blur valem a pena
  motionPx(t0, t1) {
    const sample = (t) => {
      const P = this.plan(t); const L = this.apply(P.A, t); const A = L.anchors; const out = [];
      const add = (p) => { if (p && p.w > 0.4 && Math.abs(p.x) < 4000 && Math.abs(p.y) < 6000) out.push([p.x, p.y]); else out.push(null); };
      if (A.head) { add({ ...A.head, w: 1 }); add({ ...A.body, w: 1 }); }
      const pr = A.proj;
      if (pr && A.head) for (const q of [[0, 0.3, 0], [2, 0.3, -3], [-2, 0.3, -3], [0, 0.3, 3]]) add(pr(q[0], q[1], q[2]));
      if (A.center) add({ ...A.center, w: 1 });
      if (A.north) add(A.north);
      return { out, trans: P.trans ? P.trans.p : -1, shot: L.shot.id };
    };
    this.dry = true; const a = sample(t0), b = sample(t1); this.dry = false; let m = 0;
    if (a.shot !== b.shot) return 99;
    for (let i = 0; i < Math.min(a.out.length, b.out.length); i++) if (a.out[i] && b.out[i]) m = Math.max(m, Math.min(400, Math.hypot(a.out[i][0] - b.out[i][0], a.out[i][1] - b.out[i][1])));
    if (a.trans >= 0 || b.trans >= 0) return 60;
    return m;
  }

  mixGrade(a, b, p) {
    const out = {};
    for (const k of Object.keys(a)) {
      const va = a[k], vb = b[k] ?? va;
      if (Array.isArray(va)) out[k] = va.map((x, i) => lerp(x, vb[i], p)); else if (typeof va === 'number') out[k] = lerp(va, vb, p); else out[k] = va;
    }
    for (const k of Object.keys(b)) if (!(k in out)) out[k] = b[k];
    return out;
  }

  drawOverlay(o, t, anchors) {
    const ctx = o.ctx;
    drawOverlayAll(this, ctx, t, anchors || this.anchors);
    drawCaption(ctx, this.chunks, t, { cy: 1432, size: 68 });
  }
}
