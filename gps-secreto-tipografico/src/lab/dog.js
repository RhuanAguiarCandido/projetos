import * as THREE from 'three';
import { Dog } from '../world/dog.js';
import { STAGE, setLook } from '../world/toon.js';
const q = new URLSearchParams(location.search); const W = +q.get('w') || 800, H = +q.get('h') || 800;
const canvas = document.getElementById('c'); canvas.width = W; canvas.height = H;
const r = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true }); r.setSize(W, H, false);
r.outputColorSpace = THREE.SRGBColorSpace; r.setScissorTest(true);
const scene = new THREE.Scene(); scene.background = new THREE.Color('#9FD9E8');
const ground = new THREE.Mesh(new THREE.CircleGeometry(6, 48), new THREE.MeshBasicMaterial({ color: '#7BC96B' })); ground.rotation.x = -Math.PI / 2; scene.add(ground);
const dog = new Dog(); scene.add(dog.root);
STAGE.uRes.value.set(W / 2, H / 2);
const views = [
  { x: 0, y: 1, pos: [1.9, 1.2, 2.6], look: [0, 0.65, 0], fov: 32, pose: {} },
  { x: 1, y: 1, pos: [2.9, 0.9, 0.2], look: [0, 0.6, 0], fov: 32, pose: { gait: 0.8, gaitAmp: 1, tailPhase: 1 } },
  { x: 0, y: 0, pos: [0.5, 1.45, 1.55], look: [0, 1.2, 0.35], fov: 30, pose: { mouth: 0.6, tongue: 0.8, browTilt: 0.2, brow: 0.6, headYaw: 0.15, earPerk: 0.4 } },
  { x: 1, y: 0, pos: [1.7, 1.0, 2.4], look: [0, 0.5, 0], fov: 32, pose: { sit: 1, mouth: 0.2, tongue: 0.3 } },
];
for (const v of views) {
  Object.assign(dog.s, { sit: 0, gait: 0, gaitAmp: 0, mouth: 0.15, tongue: 0, brow: 0, browTilt: 0, headYaw: 0, earPerk: 0, tailPhase: 0 }, v.pose); dog.update();
  const cam = new THREE.PerspectiveCamera(v.fov, 1, 0.1, 50); cam.position.set(...v.pos); cam.lookAt(...v.look);
  const w = W / 2, h = H / 2; r.setViewport(v.x * w, v.y * h, w, h); r.setScissor(v.x * w, v.y * h, w, h); r.render(scene, cam);
}
window.__info = { ok: true }; window.__done = true;
