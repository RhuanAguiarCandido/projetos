// Espaço: Terra estilizada (textura procedural), nuvens, atmosfera, campo magnético dipolar, auroras, estrelas.
import * as THREE from 'three';
import { HoloCompass } from './compass.js';
import { Ribbons, dipolePolylines } from './fieldlines.js';

export const EARTH_R = 2;

// contornos aproximados (lon, lat) — estilizados
const LAND = {
  na: [-168, 66, -164, 69, -156, 71.3, -141, 69.7, -128, 70, -115, 68.5, -108, 68, -96, 71.5, -88, 68.5, -82, 69.5, -80, 63, -93, 61, -94.5, 58.5, -92, 57, -85, 55, -82, 52.5, -79, 51.5, -78, 56, -77, 60, -72, 61.5, -65, 60.3, -62, 57, -56, 52, -60, 50, -66, 49.5, -65, 47, -60, 46, -64, 44.5, -67, 44.8, -70, 43.5, -70.5, 41.5, -74, 40.5, -76, 37, -76, 35, -78, 34, -81, 31.5, -80, 27, -80.3, 25.2, -82, 26.5, -83, 29.5, -86, 30.3, -89.5, 30, -90, 29, -94, 29.5, -97.3, 27.5, -97.5, 24, -97.5, 21.5, -96, 19, -94, 18.2, -91, 18.7, -90.5, 21, -87, 21.5, -87.5, 18, -88.5, 16, -84, 15.8, -83.2, 13, -83.7, 10.5, -81.5, 9, -79, 9.5, -77.5, 8.5, -78, 7, -80.5, 7.5, -83, 8.3, -85.7, 10, -87.5, 13, -92, 14.5, -96, 15.8, -101, 17.3, -105.5, 19.7, -105.5, 22, -109.5, 25.5, -112.5, 29, -114.7, 31.7, -117, 32.5, -120.5, 34.5, -122.5, 37.5, -124, 40.5, -124, 46, -123, 48.3, -125, 50, -128, 51, -131, 54.5, -134, 57, -138, 59, -142, 60, -147, 61, -152, 59, -155, 57, -158, 56.5, -162, 55, -164, 54.7, -160, 57.5, -158, 58.7, -162, 60, -165, 61.5, -166, 64],
  baja: [-114.7, 31.7, -112.5, 29, -110, 24, -109.5, 23, -112, 25, -114, 28, -115, 30],
  sa: [-77, 8.5, -72, 12, -63, 10.7, -60, 8.5, -52, 5, -50, 0, -44, -2.5, -39, -3, -35, -5.5, -35, -9, -37.5, -13, -39, -18, -41, -22.5, -45, -24, -48.5, -26, -49, -29, -53, -33.5, -57, -35, -57.5, -38, -62, -39, -65, -41, -65, -45, -67.5, -46.5, -66, -48, -69, -51, -68.5, -53, -71, -54, -74, -52, -75, -47, -73.5, -40, -72, -33, -71.5, -28, -70.5, -18, -76, -14, -79.5, -8, -81, -5, -80, -1, -80, 2, -77.5, 4],
  gl: [-73, 78, -60, 82, -40, 83.5, -22, 82, -18, 76, -20, 70, -26, 68, -40, 65, -44, 60, -50, 61, -53, 66, -56, 70, -68, 76],
  af: [-5.9, 35.8, -2, 35.2, 3, 36.8, 10.2, 37.2, 11, 33.5, 15.5, 32.3, 20, 30.9, 20, 32.3, 25, 31.6, 32, 31.2, 34.5, 28, 37, 21, 38.5, 18, 40, 15.5, 43.3, 12.7, 43, 11.5, 51.3, 11.8, 51, 10.3, 48, 4.5, 44, 1, 41, -2, 39.3, -4.7, 40.5, -10.5, 40.7, -15, 35, -20, 35.5, -24, 32.5, -26, 32.8, -28.5, 30, -31.5, 27, -33.5, 22, -34.2, 19, -34.5, 18.2, -32, 16.5, -28.5, 14.5, -22.5, 11.7, -17, 12.5, -13.5, 13.5, -9, 12.3, -6, 9.5, -1, 9.5, 3.8, 6, 4.3, 4.5, 6.3, 1, 6, -4, 5.2, -7.8, 4.4, -11.5, 6.8, -13.5, 9.5, -15, 11, -16.7, 12.5, -17.5, 14.7, -16.5, 19.5, -17, 21, -15.5, 24.5, -13, 27.7, -10, 29.5, -9.8, 31.5, -8.5, 33.3, -6.8, 34.5],
  eu: [-9.2, 43.2, -8, 43.7, -4, 43.4, -1.8, 43.4, -1.3, 44.5, -1.8, 46.2, -4.7, 47.7, -4.5, 48.4, -1.5, 48.7, -1.3, 49.7, 0.2, 49.7, 1.6, 50.1, 2, 51, 3.3, 51.4, 4, 52, 4.8, 52.8, 7, 53.4, 8.5, 53.6, 8.7, 54, 8.5, 55.5, 8.2, 57, 10.5, 57.7, 10.3, 56.2, 9.8, 55, 10.8, 54, 12, 54.2, 14, 53.8, 16, 54.2, 18.5, 54.5, 19.8, 54.5, 21, 55.3, 21.2, 57, 24.2, 57, 23.5, 58, 24, 59.4, 28, 59.4, 29.5, 59.7, 30, 60, 27, 60.5, 24, 59.8, 22, 60.2, 21.3, 61.2, 21.5, 63, 25, 64, 24.8, 65, 22.3, 65.8, 21.5, 65.2, 19, 63.8, 17.5, 62.5, 17.5, 61.3, 18.6, 60, 17.2, 58.5, 16.5, 57, 14.5, 56, 13, 55.5, 12.2, 56.5, 11, 58, 11.5, 59, 10.5, 59.5, 8.7, 58.2, 7, 58, 5.5, 59, 5, 60.5, 5.5, 62, 8, 63, 10.5, 64, 12.5, 65.5, 14, 67.5, 16, 69, 20, 70, 25.5, 71, 30, 70.3, 33, 69.5, 40.5, 66.2, 44, 68.5, 53, 68.5, 60, 69.5, 68, 68.8, 69.5, 72.5, 73, 72.8, 76, 74.5, 87, 75, 98, 76.2, 104, 77.7, 113, 75.5, 113, 73.5, 126.5, 73.5, 129, 71.5, 140.5, 72.5, 150, 71.3, 160, 70, 170, 69.7, 180, 68.9, 180, 65.5, 178, 64.3, 175, 62.5, 170, 60.2, 164, 59.8, 162.5, 57, 160.5, 54.5, 156.7, 51, 155.8, 54, 155.5, 57, 156.5, 59.5, 153, 59.2, 150, 59.2, 143.5, 59.3, 142, 58, 138, 54.8, 137, 54, 140.5, 53.3, 141.5, 52.5, 140.5, 48.5, 138, 46, 135.5, 43.8, 133, 42.8, 131.5, 42.5, 129.8, 41, 128.5, 38.7, 129.5, 37.5, 129.3, 36, 128.5, 35, 126.8, 34.5, 126, 34.6, 126.5, 37, 125, 38, 124.5, 39.8, 122.5, 40, 121.5, 39, 121, 40.7, 119.5, 39.5, 117.8, 39.2, 118.5, 38.2, 119, 37.2, 121, 37, 119.5, 35, 120.5, 33, 121.5, 31.2, 121.8, 29.5, 120.5, 27, 119, 25, 116.5, 23, 114, 22.2, 112, 21.8, 110.5, 20.2, 110.5, 21, 108, 21.5, 106.5, 20, 106.5, 17.5, 108.5, 15, 109, 12, 107, 11, 106, 10, 105, 9, 103.5, 10.5, 103, 5, 104, 2, 103.3, 1.4, 101.5, 3, 100.3, 6.3, 99.5, 7, 98.5, 10, 98, 13, 97.5, 16.5, 94.5, 16.5, 94, 16, 92.2, 21, 91, 22.8, 89, 22, 87, 21.5, 85, 19.5, 82, 16.5, 80.2, 15.8, 80.3, 13.5, 80, 10, 78.5, 8.8, 77.5, 8, 75, 12, 73.5, 16, 72.8, 19, 70, 21, 67, 24.8, 66.5, 25.4, 61, 25.2, 57.3, 25.6, 56.7, 27, 52, 27.5, 50, 30, 48.5, 29.5, 50.5, 26, 51.5, 24.5, 54, 24.2, 56.3, 26.2, 56.5, 25, 59, 22.5, 57.5, 19, 55, 17.5, 52, 16, 48, 14, 45, 13, 44.5, 12.7, 43, 13, 41.5, 17, 39, 21.5, 37, 25, 35.5, 28, 34.9, 29.5, 34.3, 31.3, 34.9, 32.7, 35.8, 34.2, 36, 36.6, 32, 36.2, 28, 36.7, 26.5, 38, 26, 40.5, 24, 40.8, 23.2, 40, 24, 38, 23, 36.5, 21, 38.5, 19.6, 40, 19.4, 41.5, 18.5, 42.4, 15.5, 43.2, 13.7, 44.5, 13.7, 45.6, 12.3, 45.3, 12.5, 44, 14, 42.5, 16.2, 41.7, 18.5, 40.1, 17, 39, 16, 38.3, 15.7, 40, 14, 41, 11.8, 42.3, 10.2, 44, 8, 43.8, 5.5, 43.2, 3, 43.2, 3.2, 42, 0.8, 41, 0, 38.8, -2, 36.8, -6.2, 36.4, -8.8, 37, -9.5, 38.7, -8.8, 40],
  au: [114, -22, 116, -20.5, 122, -18, 126, -14, 129.5, -15, 131, -12, 136.5, -12, 136.5, -15, 140, -17.5, 141.5, -12.5, 143.5, -14, 145.5, -15, 146.5, -19, 150, -22.5, 153, -26, 153, -30, 151, -34, 150, -37.5, 146.5, -39, 144, -38.5, 140, -38, 138.5, -35, 136, -35, 135, -33, 131, -31.5, 124, -33.5, 118, -35, 115, -34, 115.5, -31, 113.5, -26],
  mad: [49, -12, 50.5, -15.5, 49.5, -19, 47.5, -24.5, 45, -25.5, 43.5, -22, 44.5, -17, 47, -15],
  uk: [-5.5, 50, -3, 51.5, 1.5, 51, 1.8, 52.8, -0.5, 54, -1.5, 55.8, -2, 57.6, -4, 58.6, -6, 58, -5.5, 56, -4.5, 54.5, -3, 53.5, -4.5, 52],
  ie: [-10, 52, -6, 52.2, -6, 55, -8.5, 55, -10, 54],
  jp1: [130.5, 31, 131.5, 33.5, 135, 33.8, 137, 34.6, 140, 35, 141, 38, 142, 40.5, 141, 41.4, 139.5, 39.5, 139.5, 37, 137, 36.7, 136, 35.7, 133, 35.5, 131, 34.4],
  jp2: [140, 42, 141.5, 45.4, 145.5, 43.3, 143.3, 42, 141, 42.2],
  sum: [95.3, 5.5, 98, 4, 104, -1, 106, -3, 105.8, -5.8, 102, -4, 98.5, 0.5],
  java: [105.3, -6.5, 114.5, -7.7, 114.3, -8.7, 106, -7.5],
  bor: [109, 1.5, 111, 1.8, 114, 4.5, 117.5, 7, 119, 5, 118, 1, 116.5, -2, 114, -4, 110, -3, 109, 0],
  sul: [119.5, -5, 120.5, -2, 121, 1, 124.5, 1.5, 120, 0, 121, -3, 122.5, -5],
  ng: [131, -1, 135, -3.5, 138, -1.7, 145, -5, 147.5, -6, 150.5, -10.5, 146, -9, 143.5, -8.3, 141, -9, 138, -8, 135, -4.5, 132, -3],
  ph1: [120, 18.5, 122.2, 18.4, 122, 14, 124, 13, 120.5, 13.5, 120, 16],
  ph2: [122, 7, 126, 9.5, 126.5, 6.5, 124, 6, 122, 7.5],
  nz1: [172.7, -34.5, 175, -37, 178.5, -37.7, 175.5, -41.5, 174.8, -40, 173, -35.5],
  nz2: [172.5, -40.5, 174.3, -41.7, 171.2, -44.5, 169, -46.5, 166.5, -46, 168, -44, 171.5, -41.5],
  ice: [-24, 65.5, -22, 66.5, -15, 66.3, -13.5, 65, -18, 63.5, -22.5, 63.8],
  cuba: [-85, 22, -82, 23.1, -77, 21.5, -74, 20.2, -77.5, 20, -80, 21.5],
  hisp: [-74.4, 18.5, -72, 19.8, -68.5, 18.5, -71, 17.8],
};

function rngf(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

function makeEarthTextures() {
  const W = 2048, H = 1024;
  const X = (lon) => ((lon + 180) / 360) * W, Y = (lat) => ((90 - lat) / 180) * H;
  const mk = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; return c; };
  const poly = (g, pts, extra) => { g.beginPath(); for (let i = 0; i < pts.length; i += 2) { const x = X(pts[i]), y = Y(pts[i + 1]); i ? g.lineTo(x, y) : g.moveTo(x, y); } g.closePath(); g.fill(); if (extra) { extra(); } };
  // máscara de terra
  const mask = mk(), mg = mask.getContext('2d'); mg.fillStyle = '#000'; mg.fillRect(0, 0, W, H); mg.fillStyle = '#fff';
  for (const k in LAND) poly(mg, LAND[k]);
  // Antártida
  mg.beginPath(); mg.moveTo(0, Y(-90)); for (let lon = -180; lon <= 180; lon += 6) mg.lineTo(X(lon), Y(-71 - 4 * Math.sin(lon * 0.09) - 3 * Math.sin(lon * 0.31))); mg.lineTo(W, Y(-90)); mg.closePath(); mg.fill();
  // mares interiores
  mg.fillStyle = '#000';
  const ell = (lon, lat, rx, ry, rot = 0) => { mg.beginPath(); mg.ellipse(X(lon), Y(lat), rx * (W / 360), ry * (H / 180), rot, 0, Math.PI * 2); mg.fill(); };
  ell(34.5, 43.3, 6, 1.7); ell(51, 41.5, 2.2, 4.6); ell(-87, 45.5, 3.2, 2.4); ell(-80.5, 44, 1.6, 1.0);
  mg.fillStyle = '#fff';
  const maskA = mk(), ag = maskA.getContext('2d'); const mdat = mg.getImageData(0, 0, W, H); const ad = ag.createImageData(W, H);
  for (let i = 0; i < W * H; i++) { ad.data[i * 4] = 255; ad.data[i * 4 + 1] = 255; ad.data[i * 4 + 2] = 255; ad.data[i * 4 + 3] = mdat.data[i * 4]; }
  ag.putImageData(ad, 0, 0);
  // textura de cor
  const day = mk(), g = day.getContext('2d');
  const og = g.createLinearGradient(0, 0, 0, H); og.addColorStop(0, '#0d4f9e'); og.addColorStop(0.5, '#0a4fb0'); og.addColorStop(1, '#0d4f9e');
  g.fillStyle = og; g.fillRect(0, 0, W, H);
  const R = rngf(31);
  // variações de oceano
  for (let i = 0; i < 160; i++) { g.fillStyle = `rgba(${R() < 0.5 ? '10,90,200' : '8,60,150'},0.16)`; g.beginPath(); g.ellipse(R() * W, R() * H, 40 + R() * 160, 10 + R() * 50, R() * 3, 0, 6.28); g.fill(); }
  // águas rasas (halo ciano) ao redor da terra
  g.save(); g.filter = 'blur(10px)'; g.globalAlpha = 0.55; g.drawImage(maskA, 0, 0); g.restore();
  const sh = mk(), sg = sh.getContext('2d'); sg.fillStyle = '#0b6fd0'; sg.fillRect(0, 0, W, H); sg.globalCompositeOperation = 'destination-in'; sg.filter = 'blur(9px)'; sg.drawImage(maskA, 0, 0);
  sg.globalCompositeOperation = 'source-over'; sg.filter = 'none';
  g.save(); g.globalAlpha = 0.9; g.filter = 'blur(2px)'; g.drawImage(sh, 0, 0); g.restore();
  g.save(); g.fillStyle = 'rgba(0,217,245,0.28)'; g.filter = 'blur(6px)'; g.globalCompositeOperation = 'lighter'; g.drawImage(maskA, 0, 0); g.restore();
  // terra: gradiente por latitude sobre a máscara
  const land = mk(), lg = land.getContext('2d');
  const grad = lg.createLinearGradient(0, 0, 0, H);
  const stops = [[0, '#e9f3f6'], [0.07, '#cfe0d3'], [0.16, '#79b86b'], [0.30, '#4aa653'], [0.42, '#37a05c'], [0.5, '#2c9b52'], [0.58, '#3aa653'], [0.7, '#5ab85a'], [0.84, '#8fc07a'], [0.93, '#e8f2f0'], [1, '#ffffff']];
  stops.forEach(([p, c]) => grad.addColorStop(p, c)); lg.fillStyle = grad; lg.fillRect(0, 0, W, H);
  const blob = (lon, lat, rx, ry, col, a, rot = 0, blur = 14) => { lg.save(); lg.filter = `blur(${blur}px)`; lg.globalAlpha = a; lg.fillStyle = col; lg.beginPath(); lg.ellipse(X(lon), Y(lat), rx * (W / 360), ry * (H / 180), rot, 0, 6.28); lg.fill(); lg.restore(); };
  blob(12, 23, 24, 7, '#e0b765', 0.95); blob(-3, 22, 10, 6, '#e0b765', 0.9); blob(45, 24, 10, 8, '#e4bf6e', 0.95); blob(133, -25, 14, 9, '#d9a95b', 0.95); blob(60, 36, 12, 5, '#d8bd7c', 0.7); blob(95, 40, 14, 5, '#cdb783', 0.75);
  blob(-66, -4, 13, 8, '#1f8a43', 0.9); blob(22, -2, 11, 7, '#1c8a45', 0.85); blob(112, 0, 8, 5, '#1c8a45', 0.8); blob(-50, -26, 8, 10, '#5fb85b', 0.6); blob(-100, 40, 12, 6, '#7fc063', 0.5); blob(-70, -38, 4, 14, '#c9c18a', 0.7); blob(-72, 5, 5, 14, '#8a8f5a', 0.5);
  blob(-100, 62, 22, 6, '#bfd3c3', 0.8); blob(95, 66, 40, 6, '#c3d6c5', 0.8);
  // detalhe fino
  for (let i = 0; i < 2600; i++) { const x = R() * W, y = R() * H; lg.fillStyle = `rgba(${R() < 0.5 ? '20,90,40' : '240,240,200'},${0.04 + R() * 0.05})`; lg.beginPath(); lg.ellipse(x, y, 2 + R() * 9, 1 + R() * 5, R() * 3, 0, 6.28); lg.fill(); }
  lg.globalCompositeOperation = 'destination-in'; lg.drawImage(maskA, 0, 0);
  g.drawImage(land, 0, 0);
  // contorno fino (costa clara)
  const rim = mk(), rg = rim.getContext('2d'); rg.fillStyle = '#000'; rg.fillRect(0, 0, W, H); rg.filter = 'blur(2.5px)'; rg.drawImage(mask, 0, 0); rg.globalCompositeOperation = 'difference'; rg.filter = 'none'; rg.drawImage(mask, 0, 0);
  g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.55; g.drawImage(rim, 0, 0); g.restore();
  // luzes das cidades
  const lights = mk(), lig = lights.getContext('2d'); lig.fillStyle = '#000'; lig.fillRect(0, 0, W, H);
  const md = mg.getImageData(0, 0, W, H).data;
  const hubs = [[-74, 40.7, 4], [-46.6, -23.5, 4], [-58, -34.6, 3], [-99, 19.4, 3], [-87.6, 41.9, 2], [-118, 34, 3], [2, 48.8, 3], [-0.1, 51.5, 3], [13, 52, 2], [37.6, 55.7, 3], [31, 30, 3], [3.4, 6.5, 3], [28, -26, 2], [77, 28.6, 4], [72.8, 19, 3], [88.3, 22.5, 3], [116.4, 39.9, 4], [121.4, 31.2, 4], [114, 22.5, 3], [139.7, 35.7, 4], [127, 37.5, 3], [106.8, -6.2, 3], [-43, -22.9, 3], [-47.9, -15.8, 2], [151, -33.9, 2]];
  for (const [lon, lat, s] of hubs) for (let i = 0; i < 260 * s; i++) {
    const a = R() * 6.28, r = Math.abs(R() + R() - 1) * 3.5 * s * 0.6; const x = Math.floor(X(lon + Math.cos(a) * r)), y = Math.floor(Y(lat + Math.sin(a) * r * 0.7));
    if (x < 0 || x >= W || y < 0 || y >= H) continue; if (md[(y * W + x) * 4] > 128) { lig.fillStyle = `rgba(255,${190 + R() * 50},${90 + R() * 80},${0.5 + R() * 0.5})`; lig.fillRect(x, y, 1.5 + R() * 1.5, 1.5 + R() * 1.2); }
  }
  lig.save(); lig.filter = 'blur(2px)'; lig.globalCompositeOperation = 'lighter'; lig.drawImage(lights, 0, 0); lig.restore();
  // nuvens
  const cl = mk(), cg = cl.getContext('2d');
  for (let i = 0; i < 380; i++) {
    const lat = (R() - 0.5) * 150, lon = R() * 360 - 180; const band = 0.5 + 0.5 * Math.cos(lat * 0.09 * 3.0);
    cg.save(); cg.filter = `blur(${5 + R() * 8}px)`; cg.fillStyle = `rgba(255,255,255,${0.10 + R() * 0.28 * (0.5 + band)})`; cg.beginPath(); cg.ellipse(X(lon), Y(lat), (3 + R() * 14) * (W / 360), (1 + R() * 3.4) * (H / 180), (R() - 0.5) * 0.3, 0, 6.28); cg.fill(); cg.restore();
  }
  const T = (c, srgb) => { const t = new THREE.CanvasTexture(c); t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.anisotropy = 8; t.wrapS = THREE.RepeatWrapping; return t; };
  return { day: T(day, true), lights: T(lights, true), mask: T(mask, false), clouds: T(cl, true) };
}

const earthVS = /* glsl */ `varying vec2 vUv; varying vec3 vN, vW; void main(){ vUv = uv; vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const earthFS = /* glsl */ `
precision highp float; varying vec2 vUv; varying vec3 vN, vW;
uniform sampler2D tDay, tLights, tMask; uniform vec3 uSun, uRimCol; uniform float uNight, uGlow;
void main(){
  vec3 day = texture2D(tDay, vUv).rgb; float land = texture2D(tMask, vUv).r;
  vec3 N = normalize(vN), V = normalize(cameraPosition - vW);
  float nd = dot(N, normalize(uSun));
  float lit = smoothstep(-0.10, 0.45, nd);
  vec3 col = day * (0.04 + 0.92 * lit);
  vec3 night = vec3(0.015, 0.03, 0.10) + day * vec3(0.01, 0.025, 0.06);
  col = mix(night + day * 0.05, col, smoothstep(-0.12, 0.18, nd));
  col += vec3(1.0, 0.45, 0.18) * exp(-pow(nd / 0.16, 2.0)) * 0.16;                           // anel do terminador (pôr do sol)
  col += texture2D(tLights, vUv).rgb * (1.0 - smoothstep(-0.05, 0.25, nd)) * 1.5 * uNight;   // cidades
  vec3 H = normalize(normalize(uSun) + V); float sp = pow(max(dot(N, H), 0.0), 110.0) * (1.0 - land) * lit;
  col += vec3(1.0, 0.95, 0.8) * sp * 1.6;
  float f = pow(1.0 - max(dot(N, V), 0.0), 3.0);
  col += uRimCol * f * (0.25 + 0.9 * lit) * uGlow;
  gl_FragColor = vec4(col, 1.0);
}`;
const cloudFS = /* glsl */ `
precision highp float; varying vec2 vUv; varying vec3 vN, vW; uniform sampler2D tCl; uniform vec3 uSun;
void main(){
  float a = texture2D(tCl, vUv).a; vec3 N = normalize(vN); float nd = dot(N, normalize(uSun));
  float lit = smoothstep(-0.15, 0.4, nd); vec3 col = mix(vec3(0.03, 0.06, 0.16), vec3(1.0, 0.98, 0.95), lit) * (0.9 + 0.2 * lit);
  gl_FragColor = vec4(col * 0.9, a * 0.55);
}`;
const atmFS = /* glsl */ `
precision highp float; varying vec3 vN, vW; uniform vec3 uCol, uSun; uniform float uI, uPow;
void main(){
  vec3 N = normalize(vN), V = normalize(cameraPosition - vW);
  float f = pow(clamp(0.72 - dot(N, V), 0.0, 1.0), uPow); float lit = 0.35 + 0.65 * smoothstep(-0.4, 0.5, dot(normalize(vW), normalize(uSun)));
  gl_FragColor = vec4(uCol * f * uI * lit, f * lit);
}`;
const auroraVS = /* glsl */ `varying vec2 vUv; varying vec3 vW; void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const auroraFS = /* glsl */ `
precision highp float; varying vec2 vUv; uniform float uTime, uAmt; uniform vec3 uA, uB;
float h(float x){ return fract(sin(x * 91.3458) * 47453.5453); }
float n1(float x){ float i = floor(x), f = fract(x); f = f * f * (3. - 2. * f); return mix(h(i), h(i + 1.0), f); }
void main(){
  float ang = vUv.x * 62.0;
  float rays = 0.35 + 0.65 * n1(ang + uTime * 0.8) * n1(ang * 0.37 - uTime * 0.4 + 7.0);
  float v = vUv.y;                                     // 0 base -> 1 topo
  float a = pow(1.0 - v, 1.4) * smoothstep(0.0, 0.08, v) * rays;
  vec3 c = mix(uA, uB, smoothstep(0.0, 0.9, v));
  gl_FragColor = vec4(c * a * 1.6 * uAmt, a * uAmt);
}`;

function glowTex(inner = 'rgba(255,255,255,1)') {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  const r = g.createRadialGradient(64, 64, 0, 64, 64, 64); r.addColorStop(0, inner); r.addColorStop(0.2, 'rgba(255,255,255,0.55)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export class Space {
  constructor(D) {
    this.D = D; this.scene = new THREE.Scene(); this.holo = new THREE.Scene();
    const w = D.w;
    this.sun = new THREE.Vector3(-0.75, 0.38, 0.55).normalize();

    // estrelas
    const R = rngf(5); const n = 3200; const pos = new Float32Array(n * 3), col = new Float32Array(n * 3), sz = new Float32Array(n), ph = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const u = R() * 2 - 1, a = R() * 6.2832, s = Math.sqrt(1 - u * u); const r = 260;
      pos.set([s * Math.cos(a) * r, u * r, s * Math.sin(a) * r], i * 3);
      const k = R(); const c = k < 0.12 ? [0.55, 0.9, 1.0] : k < 0.2 ? [1.0, 0.9, 0.55] : [0.9, 0.95, 1.0]; col.set(c, i * 3); sz[i] = 0.6 + Math.pow(R(), 4) * 3.2; ph[i] = R() * 6.28;
    }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); sg.setAttribute('aCol', new THREE.BufferAttribute(col, 3)); sg.setAttribute('aSz', new THREE.BufferAttribute(sz, 1)); sg.setAttribute('aPh', new THREE.BufferAttribute(ph, 1));
    this.starU = { uTime: { value: 0 }, uScale: { value: w.W / 1080 } };
    this.stars = new THREE.Points(sg, new THREE.ShaderMaterial({
      uniforms: this.starU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: 'attribute vec3 aCol; attribute float aSz, aPh; uniform float uTime, uScale; varying vec3 vC; varying float vA; void main(){ vC = aCol; vA = 0.55 + 0.45 * sin(uTime * (1.0 + aSz * 0.4) + aPh); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_PointSize = aSz * 2.4 * uScale; }',
      fragmentShader: 'precision highp float; varying vec3 vC; varying float vA; void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.0, d); gl_FragColor = vec4(vC * a * vA * 1.3, a); }',
    }));
    this.stars.frustumCulled = false; this.scene.add(this.stars);

    // nebulosa de fundo (navy + toques ciano/roxo)
    this.nebU = { uTime: { value: 0 } };
    const neb = new THREE.Mesh(new THREE.SphereGeometry(300, 32, 16), new THREE.ShaderMaterial({
      uniforms: this.nebU, side: THREE.BackSide, depthWrite: false,
      vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position.z = gl_Position.w * 0.9999; }',
      fragmentShader: `precision highp float; varying vec3 vD; uniform float uTime;
        float h(vec3 p){ p = fract(p * 0.3183 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
        float n(vec3 x){ vec3 i = floor(x), f = fract(x); f = f * f * (3. - 2. * f); return mix(mix(mix(h(i), h(i + vec3(1,0,0)), f.x), mix(h(i + vec3(0,1,0)), h(i + vec3(1,1,0)), f.x), f.y), mix(mix(h(i + vec3(0,0,1)), h(i + vec3(1,0,1)), f.x), mix(h(i + vec3(0,1,1)), h(i + vec3(1,1,1)), f.x), f.y), f.z); }
        void main(){ vec3 d = normalize(vD); float a = n(d * 2.2) * 0.6 + n(d * 5.0) * 0.3 + n(d * 11.0) * 0.1;
          vec3 base = mix(vec3(0.0006, 0.0010, 0.0035), vec3(0.0030, 0.0050, 0.0140), smoothstep(0.3, 0.8, a));
          base += vec3(0.0, 0.010, 0.014) * smoothstep(0.55, 0.85, n(d * 3.0 + 4.0)) + vec3(0.012, 0.003, 0.018) * smoothstep(0.6, 0.9, n(d * 2.4 - 9.0));
          gl_FragColor = vec4(base, 1.0); }`,
    }));
    neb.frustumCulled = false; neb.renderOrder = -20; this.scene.add(neb);

    // Terra
    const T = makeEarthTextures();
    this.tilt = new THREE.Group(); this.scene.add(this.tilt);
    this.earthU = { tDay: { value: T.day }, tLights: { value: T.lights }, tMask: { value: T.mask }, uSun: { value: this.sun }, uRimCol: { value: new THREE.Color('#2fd3ff') }, uNight: { value: 1 }, uGlow: { value: 0.55 } };
    this.earth = new THREE.Mesh(new THREE.SphereGeometry(EARTH_R, 128, 96), new THREE.ShaderMaterial({ vertexShader: earthVS, fragmentShader: earthFS, uniforms: this.earthU }));
    this.tilt.add(this.earth);
    this.cloudU = { tCl: { value: T.clouds }, uSun: { value: this.sun } };
    this.clouds = new THREE.Mesh(new THREE.SphereGeometry(EARTH_R * 1.013, 96, 72), new THREE.ShaderMaterial({ vertexShader: earthVS, fragmentShader: cloudFS, uniforms: this.cloudU, transparent: true, depthWrite: false }));
    this.tilt.add(this.clouds);
    const atm = (r, col, I, pw) => { const m = new THREE.Mesh(new THREE.SphereGeometry(EARTH_R * r, 96, 72), new THREE.ShaderMaterial({ vertexShader: earthVS, fragmentShader: atmFS, uniforms: { uCol: { value: new THREE.Color(col) }, uSun: { value: this.sun }, uI: { value: I }, uPow: { value: pw } }, side: THREE.BackSide, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); return m; };
    this.tilt.add(atm(1.10, '#3ec9ff', 0.85, 3.2)); this.tilt.add(atm(1.20, '#1a8cff', 0.28, 2.4));

    // campo magnético dipolar (alinhado ao eixo do planeta, não gira com a textura)
    this.fieldGroup = new THREE.Group(); this.tilt.add(this.fieldGroup);
    const lines = dipolePolylines({ Ls: [1.55, 2.0, 2.65, 3.4], azimuths: 12, surface: 1.0, steps: 90 });
    this.field = new Ribbons(lines, { width: 3.0, freq: 1.8, speed: 0.38, base: 0.26, res: [1080, 1920] });
    this.field.mesh.scale.setScalar(EARTH_R); this.fieldGroup.add(this.field.mesh);
    // auroras e feixes nos polos
    const mkAurora = (sign) => {
      const lat = 70 * Math.PI / 180, r0 = EARTH_R * Math.cos(lat) * 1.012, y0 = sign * EARTH_R * Math.sin(lat);
      const geo = new THREE.CylinderGeometry(r0 * 1.12, r0, 0.5, 96, 1, true);
      const m = new THREE.Mesh(geo, new THREE.ShaderMaterial({ vertexShader: auroraVS, fragmentShader: auroraFS, uniforms: { uTime: { value: 0 }, uAmt: { value: 1 }, uA: { value: new THREE.Color('#00d9f5') }, uB: { value: new THREE.Color('#f9d548') } }, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
      m.position.y = y0 + sign * 0.2; if (sign < 0) m.rotation.x = Math.PI; return m;
    };
    this.auroraN = mkAurora(1); this.auroraS = mkAurora(-1); this.fieldGroup.add(this.auroraN, this.auroraS);
    const gt = glowTex();
    const mkFlare = (sign, col) => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: gt, color: col, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })); s.position.set(0, sign * EARTH_R * 1.04, 0); s.scale.setScalar(0.5); return s; };
    this.flareN = mkFlare(1, '#9ff3ff'); this.flareS = mkFlare(-1, '#ffe27a'); this.fieldGroup.add(this.flareN, this.flareS);
    // reflexo solar na borda
    this.sunFlare = new THREE.Sprite(new THREE.SpriteMaterial({ map: gt, color: '#ffe9b0', blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, depthTest: false })); this.sunFlare.scale.setScalar(0.001); this.scene.add(this.sunFlare);

    // bússola holográfica em primeiro plano
    this.cmp = new HoloCompass({ size: 1, withField: false, withSparks: true, intensity: 2.4 }); this.holo.add(this.cmp.group); this.cmp.group.visible = false;

    this.setSpin(0, 23.5);
  }

  setSpin(spin, tiltZDeg = 23.5, tiltXDeg = 20) { this.earth.rotation.y = spin; this.clouds.rotation.y = spin * 1.08; this.tilt.rotation.set(THREE.MathUtils.degToRad(tiltXDeg), 0, THREE.MathUtils.degToRad(tiltZDeg)); this.tilt.updateMatrixWorld(true); }
  setTime(t) {
    this.starU.uTime.value = t; this.nebU.uTime.value = t;
    this.auroraN.material.uniforms.uTime.value = t; this.auroraS.material.uniforms.uTime.value = t + 4;
    this.earthU.uSun.value.copy(this.sun);
  }
  // pontos para o overlay (polos e centro projetados)
  anchors(D) {
    this.tilt.updateMatrixWorld(true);
    const p = (v) => D.project(v);
    const N = new THREE.Vector3(0, EARTH_R * 1.28, 0).applyMatrix4(this.tilt.matrixWorld), Sp = new THREE.Vector3(0, -EARTH_R * 1.28, 0).applyMatrix4(this.tilt.matrixWorld);
    const c = new THREE.Vector3(0, 0, 0);
    return { north: p(N), south: p(Sp), center: { ...p(c), ppm: D.pxPerMeter(c) }, earthR: EARTH_R };
  }
}
