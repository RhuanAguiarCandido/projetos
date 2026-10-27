// Camada 2D (Canvas) em coordenadas lógicas 1080x1920, enviada como textura ao compositor final.
import * as THREE from 'three';

export class Overlay {
  constructor(w, h, scale = 1) {
    this.w = w; this.h = h; this.scale = scale;
    this.canvas = document.createElement('canvas'); this.canvas.width = Math.round(w * scale); this.canvas.height = Math.round(h * scale);
    this.ctx = this.canvas.getContext('2d');
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.premultiplyAlpha = true; this.texture.generateMipmaps = false; this.texture.minFilter = THREE.LinearFilter; this.texture.magFilter = THREE.LinearFilter;
  }
  begin() { const c = this.ctx; c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, this.canvas.width, this.canvas.height); c.setTransform(this.scale, 0, 0, this.scale, 0, 0); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over'; c.shadowBlur = 0; c.filter = 'none'; }
  upload() { this.texture.needsUpdate = true; }
}
