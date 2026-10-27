// Utilidades pequenas e puras.
import * as THREE from 'three';

export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (x) => { x = clamp(x); return x * x * (3 - 2 * x); };
export const TAU = Math.PI * 2;

// cores da marca (sRGB) -> THREE.Color (gerenciamento de cor liga/desliga automático do three)
export const BRAND = { navy: '#151C37', navyDeep: '#0B1024', cyan: '#00D9F5', yellow: '#F9D548', white: '#FFFFFF', coral: '#FF5A6E' };
export const col = (hex) => new THREE.Color(hex);

// gerador pseudo-aleatório determinístico (mulberry32)
export function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export const hash1 = (x) => { const s = Math.sin(x * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

// batida do projeto: 120 BPM
export const BPM = 120, BEAT = 60 / BPM;
export const beat = (n) => n * BEAT;
