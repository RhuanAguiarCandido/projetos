import * as THREE from 'three';
import { Dog } from '../world/dog.js';
import { Park } from '../world/park.js';
import { STAGE, setLook } from '../world/toon.js';
const q = new URLSearchParams(location.search); const W = +q.get('w') || 540, H = +q.get('h') || 960;
const canvas = document.getElementById('c'); canvas.width = W; canvas.height = H;
const r = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true }); r.setSize(W, H, false);
r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.0;
const scene = new THREE.Scene(); const park = new Park(); scene.add(park.group);
setLook({ keyDir: [0.45, 0.75, 0.5], rimDir: [-0.5, 0.4, -0.8], keyCol: '#FFF1D6', rimCol: '#8CCBFF', rimAmt: 0.85, fogCol: '#A9CFF7', fogDen: 0.011 }); STAGE.uRes.value.set(W, H);
const dog = new Dog(); scene.add(dog.root);
const mode = q.get('pose') || 'sit';
if (mode === 'sit') { Object.assign(dog.s, { sit: 1, headRoll: 0.2, headPitch: -0.3, lookY: 0.6, mouth: 0.4, tongue: 0.6, smile: 1.5, earPerk: 0.3 }); }
else { Object.assign(dog.s, { sit: 0, mouth: 0.4, tongue: 0.6, smile: 1.4 }); }
dog.update(); park.update(1.0);
const cam = new THREE.PerspectiveCamera(+q.get('fov') || 34, W / H, 0.05, 400);
const cz = +q.get('cz') || 3.4, cy = +q.get('cy') || 0.5; cam.position.set(+q.get('cx') || 0.6, cy, cz); cam.lookAt(0, +q.get('ly') || 0.95, 0);
park.fireMat.uniforms.uScale.value = H / (2 * Math.tan(cam.fov * Math.PI / 360));
r.render(scene, cam); window.__info = {};
