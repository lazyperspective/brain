// geo.js: geometry helpers (merging, unit shapes, little people, trees)
import * as THREE from 'three';

export function rng(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

// merge geometries (non-indexed); keeps position, normal, uv (if all have) and any float attributes listed in `extra`
export function merge(list, extra = []) {
  const gs = list.filter(Boolean).map(g => (g.index ? g.toNonIndexed() : g));
  let n = 0; for (const g of gs) n += g.attributes.position.count;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3);
  const ex = {}; for (const [name, size] of extra) ex[name] = new Float32Array(n * size);
  let o = 0;
  for (const g of gs) {
    if (!g.attributes.normal) g.computeVertexNormals();
    const c = g.attributes.position.count;
    pos.set(g.attributes.position.array.subarray(0, c * 3), o * 3);
    nor.set(g.attributes.normal.array.subarray(0, c * 3), o * 3);
    for (const [name, size] of extra) { const a = g.attributes[name]; if (a) ex[name].set(a.array.subarray(0, c * size), o * size); }
    o += c;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  for (const [name, size] of extra) out.setAttribute(name, new THREE.BufferAttribute(ex[name], size));
  out.computeBoundingSphere();
  return out;
}
export const T = (g, x, y, z) => { g.translate(x, y, z); return g; };
export const S = (g, x, y, z) => { g.scale(x, y, z); return g; };
export const R = (g, rx, ry, rz) => { if (rx) g.rotateX(rx); if (ry) g.rotateY(ry); if (rz) g.rotateZ(rz); return g; };
export const box = (w, h, d, x = 0, y = 0, z = 0) => T(new THREE.BoxGeometry(w, h, d), x, y, z);
export const cyl = (r0, r1, h, n, x = 0, y = 0, z = 0) => T(new THREE.CylinderGeometry(r0, r1, h, n), x, y, z);
export const ico = (r, d, x = 0, y = 0, z = 0) => T(new THREE.IcosahedronGeometry(r, d), x, y, z);
export const sph = (r, ws, hs, x = 0, y = 0, z = 0, ...rest) => T(new THREE.SphereGeometry(r, ws, hs, ...rest), x, y, z);
export const cone = (r, h, n, x = 0, y = 0, z = 0) => T(new THREE.ConeGeometry(r, h, n), x, y, z);
export const setAttr = (g, name, v) => { const n = g.attributes.position.count; g.setAttribute(name, new THREE.BufferAttribute(new Float32Array(n).fill(v), 1)); return g; };

// ----------------------------------------------------------------------------- little people
// local: feet at y=0, facing +z, adult height 1.0 unit = 1.7 m scaled later. Parts: 0 skin 1 top 2 bottom 3 hair 4 shoes 5 hat
export function personGeometry(lod = 2) {
  const P = (g, part, swing = 0, pivot = 0) => { setAttr(g, 'aPart', part); setAttr(g, 'aSwing', swing); setAttr(g, 'aPivot', pivot); return g; };
  const parts = [];
  const hip = 0.86, sh = 1.40;
  if (lod >= 2) {
    // shoes
    parts.push(P(box(0.11, 0.08, 0.25, -0.09, 0.04, 0.035), 4, -1, hip), P(box(0.11, 0.08, 0.25, 0.09, 0.04, 0.035), 4, 1, hip));
    // legs (trousers) slightly tapered
    parts.push(P(cyl(0.075, 0.062, hip - 0.07, 6, -0.09, 0.07 + (hip - 0.07) / 2, 0), 2, -1, hip), P(cyl(0.075, 0.062, hip - 0.07, 6, 0.09, 0.07 + (hip - 0.07) / 2, 0), 2, 1, hip));
    // hips + torso (tapered, rounded)
    parts.push(P(S(cyl(0.17, 0.165, 0.16, 8, 0, hip + 0.02, 0), 1, 1, 0.68), 2));
    parts.push(P(S(cyl(0.19, 0.165, 0.5, 8, 0, hip + 0.33, 0), 1, 1, 0.62), 1));
    parts.push(P(S(sph(0.19, 8, 4, 0, sh - 0.02, 0, 0, Math.PI * 2, 0, Math.PI / 2), 1, 0.45, 0.62), 1));
    // arms: sleeve + hand
    for (const sx of [-1, 1]) {
      parts.push(P(cyl(0.055, 0.048, 0.5, 6, sx * 0.235, sh - 0.27, 0), 1, sx * 2, sh - 0.04));
      parts.push(P(ico(0.05, 0, sx * 0.235, sh - 0.56, 0.01), 0, sx * 2, sh - 0.04));
    }
    // neck + head
    parts.push(P(cyl(0.05, 0.055, 0.08, 6, 0, sh + 0.04, 0), 0));
    parts.push(P(S(ico(0.115, 1, 0, sh + 0.17, 0.005), 0.95, 1.08, 1.0), 0));
    // nose
    parts.push(P(box(0.03, 0.04, 0.04, 0, sh + 0.16, 0.115), 0));
    // hair cap (back-heavy)
    parts.push(P(S(sph(0.125, 8, 5, 0, sh + 0.19, -0.012, 0, Math.PI * 2, 0, Math.PI * 0.55), 1, 1.0, 1.05), 3));
    parts.push(P(box(0.22, 0.12, 0.06, 0, sh + 0.14, -0.09), 3));
    // hat (cap with brim) - collapsed unless iAnim.w
    parts.push(P(cyl(0.13, 0.13, 0.07, 10, 0, sh + 0.27, 0), 5), P(box(0.16, 0.015, 0.12, 0, sh + 0.245, 0.12), 5));
    // backpack-ish shading strip (belt)
    parts.push(P(S(cyl(0.172, 0.172, 0.03, 8, 0, hip + 0.1, 0), 1, 1, 0.69), 4));
  } else {
    parts.push(P(box(0.26, hip, 0.15, 0, hip / 2, 0), 2));
    parts.push(P(box(0.36, 0.56, 0.22, 0, hip + 0.28, 0), 1));
    parts.push(P(ico(0.12, 0, 0, sh + 0.16, 0), 0));
    parts.push(P(box(0.25, 0.1, 0.25, 0, sh + 0.22, -0.01), 3));
    parts.push(P(cyl(0.13, 0.13, 0.06, 6, 0, sh + 0.28, 0), 5));
  }
  const g = merge(parts, [['aPart', 1], ['aSwing', 1], ['aPivot', 1]]);
  g.scale(1 / 1.7 * 1.7, 1, 1);
  return g;
}

// stroller (pram) local: handle at z=0 behind; body ahead +z
export function strollerGeometry() {
  return merge([
    box(0.42, 0.28, 0.6, 0, 0.5, 0.55), // tub
    S(sph(0.3, 8, 4, 0, 0.62, 0.38, 0, Math.PI * 2, 0, Math.PI / 2), 0.7, 0.8, 0.9), // hood
    box(0.03, 0.5, 0.03, -0.18, 0.72, 0.2), box(0.03, 0.5, 0.03, 0.18, 0.72, 0.2), box(0.4, 0.03, 0.03, 0, 0.96, 0.15),
    R(cyl(0.09, 0.09, 0.04, 8, 0, 0, 0), 0, 0, Math.PI / 2).translate(-0.2, 0.09, 0.3), R(cyl(0.09, 0.09, 0.04, 8), 0, 0, Math.PI / 2).translate(0.2, 0.09, 0.3),
    R(cyl(0.09, 0.09, 0.04, 8), 0, 0, Math.PI / 2).translate(-0.2, 0.09, 0.8), R(cyl(0.09, 0.09, 0.04, 8), 0, 0, Math.PI / 2).translate(0.2, 0.09, 0.8),
  ]);
}

// ----------------------------------------------------------------------------- trees (unit height 1, crown radius 1 normalised per kind)
// returns {crown, trunk} geometries for a shape kind; caller scales by (cr, h, cr)
export function treeGeometries(kind, lowpoly, variant = 0) {
  const r = rng(1000 + variant * 77 + kind.length * 13);
  const d = lowpoly ? 0 : 1;
  const crowns = [], trunks = [];
  const blob = (x, y, z, s, sy = s) => crowns.push(S(ico(1, d), s, sy, s).translate(x, y, z));
  switch (kind) {
    case 'round': // oak/maple/plane: lumpy clusters; trunk to 0.45
      trunks.push(cyl(0.05, 0.08, 0.5, 6, 0, 0.25, 0));
      trunks.push(R(cyl(0.025, 0.04, 0.3, 5, 0, 0.15, 0), 0, 0, 0.7).translate(0.08, 0.45, 0));
      blob(0, 0.66, 0, 0.62, 0.34);
      for (let i = 0; i < 4; i++) { const a = i / 4 * 6.283 + r(); blob(Math.cos(a) * 0.45, 0.6 + r() * 0.12, Math.sin(a) * 0.45, 0.45 + r() * 0.12, 0.27); }
      blob(0.1, 0.82, -0.05, 0.42, 0.22);
      break;
    case 'oval': // plane/birch
      trunks.push(cyl(0.035, 0.06, 0.55, 6, 0, 0.27, 0));
      blob(0, 0.62, 0, 0.75, 0.36); blob(0.25, 0.55, 0.2, 0.5, 0.22); blob(-0.2, 0.75, -0.15, 0.5, 0.2);
      break;
    case 'clipped': // lime_clipped: box head on stem
      trunks.push(cyl(0.05, 0.06, 0.45, 6, 0, 0.22, 0));
      crowns.push(lowpoly ? S(new THREE.BoxGeometry(2, 1, 2, 1, 1, 1), 0.9, 0.55, 0.9).translate(0, 0.72, 0) : S(ico(1, 2), 0.95, 0.32, 0.95).translate(0, 0.72, 0));
      break;
    case 'pine': // bare trunk, flat cloud crown
      trunks.push(cyl(0.03, 0.05, 0.85, 6, 0, 0.42, 0));
      blob(0, 0.86, 0, 0.9, 0.13); blob(0.35, 0.78, 0.2, 0.55, 0.1); blob(-0.3, 0.92, -0.15, 0.55, 0.1); blob(0.0, 0.7, -0.35, 0.5, 0.09);
      break;
    case 'fir': // stacked cones
      trunks.push(cyl(0.03, 0.05, 0.2, 5, 0, 0.1, 0));
      for (let i = 0; i < 4; i++) { const y = 0.12 + i * 0.2, s = 1 - i * 0.2; crowns.push(cone(s, 0.42 - i * 0.03, lowpoly ? 7 : 12, 0, y + 0.2, 0)); }
      break;
    case 'column': // cypress
      trunks.push(cyl(0.03, 0.04, 0.1, 5, 0, 0.05, 0));
      crowns.push(S(ico(1, d + 1), 1, 0.5, 1).translate(0, 0.52, 0));
      break;
    case 'palm': {
      // curved trunk segments + fronds
      let x = 0, y = 0; const segs = 6;
      for (let i = 0; i < segs; i++) { const y0 = i / segs * 0.88, y1 = (i + 1) / segs * 0.88; const x1 = 0.12 * Math.pow(y1, 2) * 3; trunks.push(R(cyl(0.035 - i * 0.002, 0.045 - i * 0.002, (y1 - y0) * 1.02, 6), 0, 0, -Math.atan2(x1 - x, y1 - y0)).translate((x + x1) / 2, (y0 + y1) / 2, 0)); x = x1; }
      for (let i = 0; i < 10; i++) { const a = i / 10 * 6.283 + r() * 0.3; const fr = S(new THREE.ConeGeometry(0.16, 1, 4), 1, 1, 0.22); fr.rotateZ(Math.PI / 2 + 0.35 + r() * 0.25); fr.translate(0.5, -0.1, 0); fr.rotateY(a); fr.translate(x, 0.9, 0); crowns.push(fr); }
      crowns.push(ico(0.08, 0, x, 0.88, 0));
      break;
    }
    case 'umbrella': // jungle broadleaf: layered umbrella crowns
      trunks.push(cyl(0.04, 0.08, 0.7, 6, 0, 0.35, 0));
      blob(0, 0.78, 0, 1.0, 0.16); blob(0.3, 0.62, 0.25, 0.6, 0.12); blob(-0.35, 0.66, -0.1, 0.6, 0.12); blob(0.05, 0.92, -0.05, 0.6, 0.12);
      break;
    case 'banana':
      trunks.push(cyl(0.05, 0.07, 0.4, 6, 0, 0.2, 0));
      for (let i = 0; i < 7; i++) { const a = i / 7 * 6.283 + r(); const lf = S(ico(0.5, 0), 0.9, 0.08, 0.3); lf.rotateZ(0.6 + r() * 0.3); lf.translate(0.42, 0.62, 0); lf.rotateY(a); crowns.push(lf); }
      break;
    case 'vase': // cherry blossom: spreading vase crown
      trunks.push(cyl(0.04, 0.07, 0.4, 6, 0, 0.2, 0)); trunks.push(R(cyl(0.025, 0.035, 0.35, 5), 0, 0, 0.6).translate(0.12, 0.45, 0)); trunks.push(R(cyl(0.025, 0.035, 0.35, 5), 0, 0, -0.6).translate(-0.12, 0.45, 0));
      blob(0, 0.7, 0, 0.75, 0.3); blob(0.45, 0.64, 0.1, 0.45, 0.22); blob(-0.45, 0.66, -0.1, 0.45, 0.22); blob(0, 0.68, 0.45, 0.42, 0.2); blob(0, 0.68, -0.45, 0.42, 0.2);
      break;
    case 'weep': // willow curtain
      trunks.push(cyl(0.05, 0.08, 0.5, 6, 0, 0.25, 0));
      blob(0, 0.72, 0, 0.8, 0.3);
      { const g = new THREE.CylinderGeometry(0.85, 1.02, 0.6, lowpoly ? 9 : 16, 1, true); g.translate(0, 0.4, 0); crowns.push(g); }
      break;
  }
  return { crown: merge(crowns), trunk: merge(trunks) };
}
export const speciesKind = { oak: 'round', plane: 'oval', lime_clipped: 'clipped', pine: 'pine', fir: 'fir', palm: 'palm', jungle_broadleaf: 'umbrella', banana: 'banana', birch: 'oval', cherry_blossom: 'vase', cypress: 'column', willow: 'weep', maple_red: 'round' };
