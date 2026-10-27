// Kit de tipografia 3D: glifos reais (opentype.js) -> Shape -> ExtrudeGeometry (ou ShapeGeometry plano),
// com kerning, geometria em cache, pivô no centro de cada glifo e materiais próprios (gradiente, brilho, rim, dithering).
import * as THREE from 'three';
import { parse } from 'opentype.js';
import { toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { col } from './util.js';

export async function loadTypeface(url, name) {
  const buf = await (await fetch(url)).arrayBuffer();
  return new Typeface(parse(buf), name);
}

export class Typeface {
  constructor(font, name) {
    this.font = font; this.name = name; this.upm = font.unitsPerEm;
    this.geoCache = new Map(); this.outCache = new Map(); this.shapeCache = new Map();
    const h = font.charToGlyph('H').getBoundingBox();
    this.capH = (h.y2 - h.y1) / this.upm;        // altura das maiúsculas em em
    this.xH = (font.charToGlyph('x').getBoundingBox().y2) / this.upm;
  }

  // layout de uma linha (em unidades de em): [{ch, x (início), adv}], largura total
  layout(str, tracking = 0) {
    const f = this.font, out = []; let x = 0, prev = null;
    for (const ch of str) {
      const g = f.charToGlyph(ch);
      if (prev) x += f.getKerningValue(prev, g) / this.upm;
      const adv = g.advanceWidth / this.upm;
      out.push({ ch, x, adv });
      x += adv + tracking; prev = g;
    }
    return { glyphs: out, width: Math.max(0, x - tracking) };
  }

  shapes(ch) {
    if (this.shapeCache.has(ch)) return this.shapeCache.get(ch);
    const p = this.font.getPath(ch, 0, 0, 1);       // em, y para baixo
    const sp = new THREE.ShapePath();
    for (const c of p.commands) {
      if (c.type === 'M') sp.moveTo(c.x, -c.y);
      else if (c.type === 'L') sp.lineTo(c.x, -c.y);
      else if (c.type === 'Q') sp.quadraticCurveTo(c.x1, -c.y1, c.x, -c.y);
      else if (c.type === 'C') sp.bezierCurveTo(c.x1, -c.y1, c.x2, -c.y2, c.x, -c.y);
    }
    const shapes = sp.toShapes(false); this.shapeCache.set(ch, shapes); return shapes;
  }

  // geometria centrada no meio da caixa de avanço x altura de maiúscula. depth=0 -> plana.
  geometry(ch, depth = 0.12, bevel = 0.012, curveSegments = 7) {
    const key = `${ch}|${depth}|${bevel}`;
    if (this.geoCache.has(key)) return this.geoCache.get(key);
    const g0 = this.font.charToGlyph(ch); const adv = g0.advanceWidth / this.upm;
    let geo;
    const shapes = this.shapes(ch);
    if (!shapes.length) geo = new THREE.BufferGeometry();
    else if (depth <= 0) geo = new THREE.ShapeGeometry(shapes, curveSegments);
    else {
      geo = new THREE.ExtrudeGeometry(shapes, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel * 0.8, bevelOffset: -bevel * 0.8, bevelSegments: 2, curveSegments });
      geo.translate(0, 0, -depth / 2);
      geo = toCreasedNormals(geo, 0.6);
    }
    geo.translate(-adv / 2, -this.capH / 2, 0);
    this.geoCache.set(key, geo); return geo;
  }

  // contornos como pares de segmentos (para LineSegments2) — centrados como a geometria
  outlineSegments(ch, steps = 8) {
    if (this.outCache.has(ch)) return this.outCache.get(ch);
    const adv = this.font.charToGlyph(ch).advanceWidth / this.upm; const seg = [];
    for (const s of this.shapes(ch)) {
      for (const path of [s, ...s.holes]) {
        const pts = path.getPoints(steps); if (pts.length < 2) continue;
        for (let i = 0; i < pts.length; i++) {
          const a = pts[i], b = pts[(i + 1) % pts.length];
          seg.push(a.x - adv / 2, a.y - this.capH / 2, 0, b.x - adv / 2, b.y - this.capH / 2, 0);
        }
      }
    }
    const arr = new Float32Array(seg); this.outCache.set(ch, arr); return arr;
  }
}

// ---------------------------------------------------------------- materiais
const VS = /* glsl */ `
varying vec3 vN, vW; varying vec2 vL;
void main(){
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal); vL = position.xy;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
const FS = /* glsl */ `
precision highp float;
varying vec3 vN, vW; varying vec2 vL;
uniform vec3 uA, uB, uEmis, uRim; uniform float uOpacity, uShine, uShineAmt, uSide, uFlash, uAmb, uSpec, uFlat, uGradK;
float bayer(vec2 p){ p = mod(p, 4.0); int x = int(p.x), y = int(p.y); int i = y * 4 + x;
  float m[16] = float[16](0.0,8.0,2.0,10.0, 12.0,4.0,14.0,6.0, 3.0,11.0,1.0,9.0, 15.0,7.0,13.0,5.0); return (m[i] + 0.5) / 16.0; }
void main(){
#ifndef BLEND
  if (uOpacity < 0.999 && bayer(gl_FragCoord.xy) > uOpacity) discard;
#endif
  vec3 N = normalize(vN); vec3 V = normalize(cameraPosition - vW);
  vec3 L = normalize(vec3(0.35, 0.80, 0.60));
  float nl = clamp(dot(N, L) * 0.5 + 0.5, 0.0, 1.0);
  float g = clamp(vL.y * uGradK + 0.5, 0.0, 1.0);
  vec3 base = mix(uA, uB, g);
  if (uSide > 0.5) base = uA * 0.50;
  float lit = mix(uAmb + (1.0 - uAmb) * nl, 1.0, uFlat);
  vec3 c = base * lit;
  c += uRim * pow(1.0 - max(dot(N, V), 0.0), 2.4) * (1.0 - uFlat);
  c += pow(max(dot(reflect(-L, N), V), 0.0), 38.0) * uSpec * (1.0 - uFlat);
  float sh = smoothstep(0.09, 0.0, abs(vL.x * 0.9 + vL.y * 0.65 - uShine)) * uShineAmt;
  c += vec3(1.0) * sh * 0.6 * (1.0 - uSide);
  c += uEmis;
  c = mix(c, vec3(1.0), uFlash);
#ifdef BLEND
  gl_FragColor = vec4(c, uOpacity);
#else
  gl_FragColor = vec4(c, 1.0);
#endif
}`;

export function typeMaterial(o = {}) {
  const mk = (side) => new THREE.ShaderMaterial({
    vertexShader: VS, fragmentShader: FS, side: o.doubleSide ? THREE.DoubleSide : THREE.FrontSide,
    transparent: !!o.blend, depthTest: !o.blend, depthWrite: !o.blend, defines: o.blend ? { BLEND: 1 } : {},
    uniforms: {
      uA: { value: col(o.colorA ?? '#ffffff') }, uB: { value: col(o.colorB ?? o.colorA ?? '#ffffff') }, uEmis: { value: col(o.emis ?? '#000000') }, uRim: { value: col(o.rim ?? '#000000') },
      uOpacity: { value: 1 }, uShine: { value: -2 }, uShineAmt: { value: 1 }, uSide: { value: side }, uFlash: { value: 0 }, uAmb: { value: o.amb ?? 0.55 }, uSpec: { value: o.spec ?? 0.25 }, uFlat: { value: o.flat ?? 0 }, uGradK: { value: o.gradK ?? 1.25 },
    },
  });
  return [mk(0), mk(1)];
}

// ---------------------------------------------------------------- bloco de texto
export class TextBlock {
  /**
   * @param {Typeface} tf
   * @param {string|string[]} text  uma linha ou várias
   * @param {object} o  size (unidades do mundo por em), depth/bevel (em), align, tracking (em), lineHeight (em), cores
   */
  constructor(tf, text, o = {}) {
    this.tf = tf; this.o = o; this.group = new THREE.Group(); this.glyphs = []; this.lines = [];
    const size = o.size ?? 1, depth = o.depth ?? 0.12, bevel = o.bevel ?? 0.012, align = o.align ?? 'center', lh = o.lineHeight ?? 1.0;
    const lines = Array.isArray(text) ? text : [text];
    this.width = 0; this.size = size;
    lines.forEach((ln, li) => {
      const L = tf.layout(ln, o.tracking ?? 0); const ox = align === 'center' ? -L.width / 2 : align === 'right' ? -L.width : 0;
      const y = -li * lh * tf.capH * 1.12;                          // linhas empilhadas (baseline relativa ao centro de maiúscula)
      const lineGroup = new THREE.Group(); lineGroup.position.y = y * size; this.group.add(lineGroup);
      const info = { group: lineGroup, glyphs: [], width: L.width * size, text: ln };
      L.glyphs.forEach((g, i) => {
        if (g.ch === ' ') return;
        const geo = tf.geometry(g.ch, depth, bevel);
        if (!geo.attributes.position) return;
        const mats = typeMaterial({ colorA: o.colorA, colorB: o.colorB, emis: o.emis, rim: o.rim, amb: o.amb, spec: o.spec, flat: depth <= 0 ? 1 : (o.flat ?? 0), gradK: o.gradK, blend: o.blend });
        const mesh = new THREE.Mesh(geo, depth <= 0 ? mats[0] : mats);
        const cx = (ox + g.x + g.adv / 2) * size; mesh.position.set(cx, 0, 0); mesh.scale.setScalar(size);
        lineGroup.add(mesh);
        const gl = { mesh, ch: g.ch, i: this.glyphs.length, li, cx, mats: depth <= 0 ? [mats[0]] : mats, base: { x: cx, y: 0, z: 0 } };
        this.glyphs.push(gl); info.glyphs.push(gl);
      });
      this.lines.push(info); this.width = Math.max(this.width, L.width * size);
    });
    this.height = (tf.capH + (lines.length - 1) * lh * tf.capH * 1.12) * size;
  }
  // utilitários em massa
  each(fn) { this.glyphs.forEach(fn); return this; }
  setOpacity(v) { for (const g of this.glyphs) for (const m of g.mats) m.uniforms.uOpacity.value = v; }
  setFlash(v) { for (const g of this.glyphs) for (const m of g.mats) m.uniforms.uFlash.value = v; }
  setShine(v, amt = 1) { for (const g of this.glyphs) for (const m of g.mats) { m.uniforms.uShine.value = v; m.uniforms.uShineAmt.value = amt; } }
  sweep(v, amt = 1) { for (const g of this.glyphs) for (const m of g.mats) { m.uniforms.uShine.value = v - 0.9 * g.cx / this.size; m.uniforms.uShineAmt.value = amt; } }
  setColors(a, b = a) { for (const g of this.glyphs) for (const m of g.mats) { m.uniforms.uA.value.set(a); m.uniforms.uB.value.set(b); } }
  setEmis(c) { for (const g of this.glyphs) for (const m of g.mats) m.uniforms.uEmis.value.set(c); }
  dispose() { for (const g of this.glyphs) for (const m of g.mats) m.dispose(); }
}

// ---------------------------------------------------------------- texto só-contorno (linhas largas em pixels)
export class OutlineBlock {
  constructor(tf, text, o = {}) {
    this.group = new THREE.Group(); this.glyphs = []; const size = o.size ?? 1, align = o.align ?? 'center';
    const L = tf.layout(text, o.tracking ?? 0); const ox = align === 'center' ? -L.width / 2 : align === 'right' ? -L.width : 0;
    this.width = L.width * size; this.material = new LineMaterial({ color: col(o.color ?? '#ffffff').getHex(), linewidth: o.width ?? 3, transparent: true, depthTest: o.depthTest ?? true, worldUnits: false });
    this.material.resolution.set(o.resW ?? 1080, o.resH ?? 1920);
    for (const g of L.glyphs) {
      if (g.ch === ' ') continue; const seg = tf.outlineSegments(g.ch); if (!seg.length) continue;
      const geo = new LineSegmentsGeometry(); geo.setPositions(seg);
      const line = new LineSegments2(geo, this.material); line.position.set((ox + g.x + g.adv / 2) * size, 0, 0); line.scale.setScalar(size);
      this.group.add(line); this.glyphs.push({ line, geo, total: seg.length / 6 });
    }
  }
  // 0..1: desenha o contorno progressivamente (por glifo, com defasagem)
  draw(p, stagger = 0.06) {
    const n = this.glyphs.length;
    this.glyphs.forEach((g, i) => { const k = Math.min(1, Math.max(0, (p * (1 + stagger * n) - i * stagger))); g.geo.instanceCount = Math.floor(g.total * k); g.line.visible = k > 0; });
  }
  setOpacity(v) { this.material.opacity = v; }
}
