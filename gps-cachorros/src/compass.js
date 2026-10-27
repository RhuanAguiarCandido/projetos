// Bússola holográfica: textura animada em Canvas 2D mapeada num plano aditivo + laços de campo magnético + faíscas.
import * as THREE from 'three';
import { COL, clamp, E, prog } from './typography.js';
import { Ribbons, Sparks, dipolePolylines } from './fieldlines.js';

const S = 1024, C = S / 2;

export class HoloCompass {
  constructor({ size = 1, withField = true, withSparks = true, intensity = 2.2 } = {}) {
    this.group = new THREE.Group();
    this.size = size;
    this.canvas = document.createElement('canvas'); this.canvas.width = this.canvas.height = S;
    this.ctx = this.canvas.getContext('2d');
    this.buf = document.createElement('canvas'); this.buf.width = this.buf.height = S; this.bctx = this.buf.getContext('2d');
    this.tex = new THREE.CanvasTexture(this.canvas); this.tex.colorSpace = THREE.SRGBColorSpace; this.tex.anisotropy = 8; this.tex.premultiplyAlpha = true;
    this.mat = new THREE.MeshBasicMaterial({ map: this.tex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
    this.mat.color.setScalar(intensity);
    this.plane = new THREE.Mesh(new THREE.PlaneGeometry(size * 2, size * 2), this.mat); this.plane.renderOrder = 5;
    // "vidro" escuro translúcido atrás do holograma (ajuda a leitura contra fundos claros)
    const bc = document.createElement('canvas'); bc.width = bc.height = 256; const bg = bc.getContext('2d');
    const rg = bg.createRadialGradient(128, 128, 20, 128, 128, 124); rg.addColorStop(0, 'rgba(8,16,44,0.62)'); rg.addColorStop(0.82, 'rgba(8,22,56,0.52)'); rg.addColorStop(1, 'rgba(8,22,56,0)');
    bg.fillStyle = rg; bg.fillRect(0, 0, 256, 256);
    const btex = new THREE.CanvasTexture(bc); btex.colorSpace = THREE.SRGBColorSpace;
    this.backMat = new THREE.MeshBasicMaterial({ map: btex, transparent: true, depthWrite: false, toneMapped: false, side: THREE.DoubleSide });
    this.back = new THREE.Mesh(new THREE.PlaneGeometry(size * 1.92, size * 1.92), this.backMat); this.back.position.z = -0.002; this.back.renderOrder = 4;
    this.group.add(this.back); this.group.add(this.plane);
    if (withField) {
      // dipolo com eixo ao longo de +Y (agulha: Norte para cima); laços em torno do disco
      const lines = dipolePolylines({ Ls: [1.55, 2.1, 2.8], azimuths: 6, surface: 0.78, steps: 54 });
      this.field = new Ribbons(lines, { width: 4.2, freq: 2, speed: 0.5, base: 0.55 });
      this.field.mesh.scale.setScalar(size * 0.9); this.group.add(this.field.mesh);
    }
    if (withSparks) { this.sparks = new Sparks(110, size * 1.15, { size: 0.035 * size }); this.group.add(this.sparks.points); }
  }

  // st: { reveal, needle, spin, glitch, alpha, t, scan, flicker, mode:'normal'|'ground', label }
  draw(st) {
    const g = this.ctx, b = this.bctx; const t = st.t || 0;
    const rev = st.reveal ?? 1;
    b.clearRect(0, 0, S, S);
    this._compass(b, st, rev, t);
    g.clearRect(0, 0, S, S);
    const gl = st.glitch || 0;
    if (gl > 0.02) {
      // fatias horizontais deslocadas
      const n = 22; let seed = Math.floor(t * 18);
      for (let i = 0; i < n; i++) {
        const y0 = (i / n) * S, h = S / n + 1; const r = Math.abs(Math.sin((i + 1) * 12.9898 + seed * 78.233) * 43758.5453) % 1;
        const dx = r > 0.55 ? (r - 0.55) * 2.0 * gl * 160 * (i % 2 ? 1 : -1) : 0;
        g.drawImage(this.buf, 0, y0, S, h, dx, y0, S, h);
      }
    } else g.drawImage(this.buf, 0, 0);
    // linhas de varredura holográficas
    g.save(); g.globalCompositeOperation = 'destination-out';
    for (let y = (t * 40) % 6; y < S; y += 6) { g.fillStyle = 'rgba(0,0,0,0.20)'; g.fillRect(0, y, S, 2); }
    g.restore();
    const fl = st.flicker ? 1 - st.flicker * (0.5 + 0.5 * Math.sin(t * 90) * Math.sin(t * 37)) : 1;
    this.mat.opacity = clamp((st.alpha ?? 1) * fl); this.backMat.opacity = clamp((st.alpha ?? 1) * E.outCubic(prog(rev, 0, 0.4)) * (st.backAlpha ?? 1));
    this.tex.needsUpdate = true;
    if (this.field) this.field.set(t, E.outCubic(prog(rev, 0.35, 0.6)) * 1.1, (st.alpha ?? 1) * (st.fieldAlpha ?? 1) * fl);
    if (this.sparks) { this.sparks.u.uTime.value = t; this.sparks.u.uAmt.value = (st.alpha ?? 1) * (st.sparkAlpha ?? 1) * E.outCubic(prog(rev, 0.4, 0.6)); this.sparks.u.uBurst.value = st.burst || 0; }
    // o laço de campo gira junto com a agulha (eixo = direção da agulha)
    if (this.field) this.field.mesh.rotation.z = -(st.needle || 0);
  }

  _compass(g, st, rev, t) {
    const spin = st.spin || 0;
    const needle = st.needle || 0; // radianos, 0 = Norte (para cima), sentido horário
    g.save(); g.translate(C, C); g.lineCap = 'round';
    const glow = (col, blur) => { g.shadowColor = col; g.shadowBlur = blur; };
    // anel externo desenhado progressivamente
    const pOuter = E.outCubic(prog(rev, 0, 0.45));
    g.strokeStyle = COL.cyan; glow(COL.cyan, 28);
    g.lineWidth = 7; g.beginPath(); g.arc(0, 0, 470, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * pOuter); g.stroke();
    g.lineWidth = 2.5; g.globalAlpha = 0.8; g.beginPath(); g.arc(0, 0, 445, -Math.PI / 2, -Math.PI / 2 - Math.PI * 2 * pOuter, true); g.stroke(); g.globalAlpha = 1;
    // carta de rumos (gira com spin)
    g.save(); g.rotate(spin);
    const pT = prog(rev, 0.1, 0.6);
    for (let i = 0; i < 72; i++) {
      const a = (i / 72) * Math.PI * 2; const pi = clamp(pT * 1.6 - (i / 72) * 0.6);
      if (pi <= 0) continue;
      const big = i % 6 === 0, mid = i % 3 === 0;
      const r0 = 400, r1 = big ? 436 : mid ? 424 : 416;
      g.strokeStyle = big ? '#ffffff' : COL.cyan; g.lineWidth = big ? 5 : 2.5; glow(COL.cyan, big ? 16 : 6); g.globalAlpha = pi;
      g.beginPath(); g.moveTo(Math.sin(a) * r0, -Math.cos(a) * r0); g.lineTo(Math.sin(a) * (r0 + (r1 - r0) * pi), -Math.cos(a) * (r0 + (r1 - r0) * pi)); g.stroke();
    }
    g.globalAlpha = 1;
    // graus a cada 30°
    g.fillStyle = COL.cyan; glow(COL.cyan, 10); g.font = "600 26px Montserrat, sans-serif"; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (let i = 0; i < 12; i++) { if (i % 3 === 0) continue; const a = (i / 12) * Math.PI * 2; g.save(); g.translate(Math.sin(a) * 372, -Math.cos(a) * 372); g.rotate(a); g.globalAlpha = clamp(pT * 2 - 0.5); g.fillText(String(i * 30).padStart(3, '0'), 0, 0); g.restore(); }
    g.globalAlpha = 1;
    // pontos cardeais: N L S O (português)
    const card = [['N', 0, '#ffffff'], ['L', 90, COL.cyan], ['S', 180, COL.yellow], ['O', 270, COL.cyan]];
    g.font = "400 112px Anton, sans-serif";
    card.forEach(([l, deg, col], i) => {
      const pc = E.outBack(prog(rev, 0.25 + i * 0.07, 0.35), 2);
      const a = (deg / 180) * Math.PI; g.save(); g.translate(Math.sin(a) * 322, -Math.cos(a) * 322); g.rotate(a * 0 - spin * 0 + 0); g.scale(pc, pc);
      g.fillStyle = col; glow(col, 30); g.globalAlpha = clamp(pc * 1.5); g.fillText(l, 0, 6); g.restore();
    });
    g.restore();
    // anel tracejado interno (gira ao contrário)
    g.save(); g.rotate(-spin * 1.6 + t * 0.5); g.strokeStyle = COL.cyan; glow(COL.cyan, 12); g.lineWidth = 3; g.globalAlpha = 0.85 * E.outCubic(prog(rev, 0.2, 0.5)); g.setLineDash([22, 16]);
    g.beginPath(); g.arc(0, 0, 250, 0, Math.PI * 2); g.stroke(); g.setLineDash([]);
    // colchetes
    g.lineWidth = 8; g.strokeStyle = COL.yellow; glow(COL.yellow, 18);
    for (let k = 0; k < 4; k++) { const a0 = (k / 4) * Math.PI * 2 + 0.25; g.beginPath(); g.arc(0, 0, 290, a0, a0 + 0.45); g.stroke(); }
    g.restore();
    // varredura de radar
    const sa = (st.scan ?? t * 1.4) % (Math.PI * 2);
    g.save(); g.rotate(sa);
    const grd = g.createConicGradient ? g.createConicGradient(-Math.PI / 2 - 0.9, 0, 0) : null;
    if (grd) { grd.addColorStop(0, 'rgba(0,217,245,0)'); grd.addColorStop(0.14, 'rgba(0,217,245,0.34)'); grd.addColorStop(0.1401, 'rgba(0,217,245,0)'); grd.addColorStop(1, 'rgba(0,217,245,0)'); g.fillStyle = grd; g.globalAlpha = E.outCubic(prog(rev, 0.5, 0.4)); g.shadowBlur = 0; g.beginPath(); g.arc(0, 0, 238, 0, Math.PI * 2); g.fill(); }
    g.restore();
    // círculos internos e retículo
    g.strokeStyle = COL.cyan; glow(COL.cyan, 10); g.lineWidth = 2; g.globalAlpha = 0.6 * E.outCubic(prog(rev, 0.3, 0.5));
    for (const r of [190, 120]) { g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.stroke(); }
    g.globalAlpha = 0.35 * E.outCubic(prog(rev, 0.4, 0.5)); g.beginPath(); g.moveTo(-255, 0); g.lineTo(255, 0); g.moveTo(0, -255); g.lineTo(0, 255); g.stroke(); g.globalAlpha = 1;
    // globo holográfico no centro (Terra consultada pelo cachorro)
    if (st.globe) {
      const gp = E.outBack(clamp(st.globe), 1.6), gr = 118 * gp; g.save(); g.globalAlpha = clamp(st.globe * 1.4); g.strokeStyle = COL.cyan; g.shadowColor = COL.cyan; g.shadowBlur = 20; g.lineWidth = 4;
      g.beginPath(); g.arc(0, 0, gr, 0, Math.PI * 2); g.stroke(); g.fillStyle = 'rgba(0,140,220,0.30)'; g.fill();
      const rot = t * 1.1;
      for (let k = 0; k < 4; k++) { const w = Math.abs(Math.cos(rot + k * Math.PI / 4)) * gr; g.lineWidth = 2.5; g.beginPath(); g.ellipse(0, 0, w, gr, 0, 0, Math.PI * 2); g.stroke(); }
      for (const y of [-0.55, 0, 0.55]) { const yy = y * gr, w = Math.sqrt(Math.max(0, gr * gr - yy * yy)); g.beginPath(); g.ellipse(0, yy, w, w * 0.18, 0, 0, Math.PI * 2); g.stroke(); }
      g.restore();
    }
    // patinha central (cachorros se alinhando ao eixo)
    if (st.paw) {
      g.save(); g.rotate(needle); g.globalAlpha = clamp(st.paw); const ps = 70 * E.outBack(clamp(st.paw), 1.8);
      g.fillStyle = COL.yellow; g.shadowColor = COL.yellow; g.shadowBlur = 26;
      const e = (cx, cy, rx, ry, r) => { g.beginPath(); g.ellipse(cx * ps, cy * ps, rx * ps, ry * ps, r, 0, Math.PI * 2); g.fill(); };
      e(0, 0.28, 0.52, 0.42, 0); e(-0.6, -0.18, 0.19, 0.27, -0.45); e(-0.22, -0.58, 0.2, 0.29, -0.12); e(0.22, -0.58, 0.2, 0.29, 0.12); e(0.6, -0.18, 0.19, 0.27, 0.45);
      g.restore();
    }
    // agulha (losango): ponta Norte ciano/branca, ponta Sul amarela
    const pn = E.outBack(prog(rev, 0.45, 0.45), 1.6);
    g.save(); g.rotate(needle); g.scale(pn, pn);
    const L = 300, Wn = 46;
    g.shadowBlur = 26; g.shadowColor = COL.cyan; g.fillStyle = '#d9fbff';
    g.beginPath(); g.moveTo(0, -L); g.lineTo(Wn, 0); g.lineTo(-Wn, 0); g.closePath(); g.fill();
    g.shadowColor = COL.yellow; g.fillStyle = COL.yellow;
    g.beginPath(); g.moveTo(0, L); g.lineTo(Wn, 0); g.lineTo(-Wn, 0); g.closePath(); g.fill();
    g.shadowBlur = 0; g.fillStyle = 'rgba(0,217,245,0.9)'; g.beginPath(); g.moveTo(0, -L); g.lineTo(0, 0); g.lineTo(-Wn, 0); g.closePath(); g.fill();
    g.fillStyle = 'rgba(190,140,10,0.55)'; g.beginPath(); g.moveTo(0, L); g.lineTo(0, 0); g.lineTo(-Wn, 0); g.closePath(); g.fill();
    g.restore();
    g.shadowBlur = 20; g.shadowColor = '#fff'; g.fillStyle = COL.navy; g.strokeStyle = '#fff'; g.lineWidth = 6;
    g.beginPath(); g.arc(0, 0, 22 * pn, 0, Math.PI * 2); g.fill(); g.stroke();
    g.restore();
  }
}
