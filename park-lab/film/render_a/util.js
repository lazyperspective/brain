import * as THREE from 'three';
export const hex = s => (typeof s === 'string' ? parseInt(s.replace('#', ''), 16) : s);
const E = new THREE.Euler(), Q = new THREE.Quaternion();
export function T(x, y, z, ry = 0, sx = 1, sy = 1, sz = 1, rx = 0, rz = 0) { E.set(rx, ry, rz, 'YXZ'); Q.setFromEuler(E); return new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), Q, new THREE.Vector3(sx, sy, sz)); }
export function beamM(a, b, w, h) {
  const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b); const d = vb.clone().sub(va); const L = d.length() || 1e-4;
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  return new THREE.Matrix4().compose(va.add(vb).multiplyScalar(0.5), q, new THREE.Vector3(w, L, h ?? w));
}
export function rng(seed) { let s = (seed >>> 0) || 1; return () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
export const GEO = {
  box: new THREE.BoxGeometry(1, 1, 1), cyl: new THREE.CylinderGeometry(0.5, 0.5, 1, 12), cyl6: new THREE.CylinderGeometry(0.5, 0.5, 1, 6),
  cyl16: new THREE.CylinderGeometry(0.5, 0.5, 1, 20), cone: new THREE.ConeGeometry(0.5, 1, 12), cone4: new THREE.ConeGeometry(0.71, 1, 4).rotateY(Math.PI / 4),
  sph: new THREE.IcosahedronGeometry(0.5, 1), ico: new THREE.IcosahedronGeometry(0.5, 0), sph2: new THREE.IcosahedronGeometry(0.5, 2), hemi: new THREE.SphereGeometry(0.5, 14, 6, 0, Math.PI * 2, 0, Math.PI / 2),
  tri: (() => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, 0, 0, 0.5, 0, 0, 0, -1, 0], 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 0, 0, 1], 3)); return g; })(),
  wedge: (() => { // gable prism: base 1x1 at y=0, ridge along x at y=1
    const v = [-0.5, 0, -0.5, -0.5, 0, 0.5, -0.5, 1, 0, 0.5, 0, -0.5, 0.5, 0, 0.5, 0.5, 1, 0];
    const idx = [0, 1, 2, 3, 5, 4, 0, 3, 4, 0, 4, 1, 1, 4, 5, 1, 5, 2, 2, 5, 3, 2, 3, 0];
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); g.setIndex(idx); const g2 = g.toNonIndexed(); g2.computeVertexNormals(); return g2; })(),
  plane: new THREE.PlaneGeometry(1, 1),
};
GEO.cyl.translate(0, 0, 0);

// Instanced kit: add(geo, material, matrix, color) -> one InstancedMesh per (geo, material)
export class Kit {
  constructor(group) { this.group = group; this.b = new Map(); }
  add(geo, mat, m, c = 0xffffff) { const k = geo.uuid + mat.uuid; let e = this.b.get(k); if (!e) this.b.set(k, e = { geo, mat, it: [] }); e.it.push(m, c); }
  build(shadow = true, tile = 60) {
    const col = new THREE.Color(); const out = [];
    for (const e of this.b.values()) {
      const n = e.it.length / 2; const tiles = new Map();
      for (let i = 0; i < n; i++) { const m = e.it[2 * i].elements; const k = Math.floor(m[12] / tile) + ',' + Math.floor(m[14] / tile); if (!tiles.has(k)) tiles.set(k, []); tiles.get(k).push(i); }
      for (const idx of tiles.values()) {
        const im = new THREE.InstancedMesh(e.geo, e.mat, idx.length);
        idx.forEach((j, i) => { im.setMatrixAt(i, e.it[2 * j]); im.setColorAt(i, col.set(e.it[2 * j + 1])); });
        im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true;
        im.computeBoundingSphere(); im.castShadow = shadow; im.receiveShadow = true; im.frustumCulled = true; this.group.add(im); out.push(im);
      }
    }
    this.b.clear(); return out;
  }
}
// local frame helper: returns L(lx,ly,lz, sx,sy,sz, lry, lrx, lrz) -> world Matrix4
export function frame(x, y, z, rot) {
  const B = T(x, y, z, rot);
  return (lx, ly, lz, sx = 1, sy = 1, sz = 1, lry = 0, lrx = 0, lrz = 0) => B.clone().multiply(T(lx, ly, lz, lry, sx, sy, sz, lrx, lrz));
}


// merged vertex-coloured model builder: add(geo, matrix, color, slot=0, limb=0)
export class MG {
  constructor() { this.P = []; this.N = []; this.C = []; this.S = []; this.L = []; }
  add(geo, m, color = 0xffffff, slot = 0, limb = 0) {
    const g = geo.index ? geo.toNonIndexed() : geo.clone(); if (!g.attributes.normal) g.computeVertexNormals(); g.applyMatrix4(m);
    const p = g.attributes.position.array, n = g.attributes.normal.array, c = new THREE.Color(color);
    const gc = g.attributes.color ? g.attributes.color.array : null;
    for (let i = 0; i < p.length / 3; i++) {
      this.P.push(p[3 * i], p[3 * i + 1], p[3 * i + 2]); this.N.push(n[3 * i], n[3 * i + 1], n[3 * i + 2]);
      if (gc) this.C.push(gc[3 * i] * c.r, gc[3 * i + 1] * c.g, gc[3 * i + 2] * c.b); else this.C.push(c.r, c.g, c.b);
      this.S.push(slot); this.L.push(limb);
    }
    return this;
  }
  geo() {
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(this.P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(this.N, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.C, 3)); g.setAttribute('aSlot', new THREE.Float32BufferAttribute(this.S, 1)); g.setAttribute('aLimb', new THREE.Float32BufferAttribute(this.L, 1));
    g.computeBoundingSphere(); return g;
  }
}
// stripe a geometry's faces by angle around y (or by local x when byX) with a colour list -> non-indexed with vertex colours
export function stripe(geo, colors, n, byX = false, xScale = 1) {
  const g = geo.index ? geo.toNonIndexed() : geo.clone(); const p = g.attributes.position.array; const cols = new Float32Array(p.length); const C = colors.map(c => new THREE.Color(c));
  for (let f = 0; f < p.length / 9; f++) {
    const cx = (p[9 * f] + p[9 * f + 3] + p[9 * f + 6]) / 3, cz = (p[9 * f + 2] + p[9 * f + 5] + p[9 * f + 8]) / 3;
    let k; if (byX) k = Math.floor(cx * xScale + 1000); else { let a = Math.atan2(cz, cx); if (a < 0) a += Math.PI * 2; k = Math.floor(a / (Math.PI * 2) * n + 1e-4); }
    const c = C[((k % C.length) + C.length) % C.length]; for (let v = 0; v < 3; v++) { cols[9 * f + 3 * v] = c.r; cols[9 * f + 3 * v + 1] = c.g; cols[9 * f + 3 * v + 2] = c.b; }
  }
  g.setAttribute('color', new THREE.BufferAttribute(cols, 3)); return g;
}
// lathe from profile [[r,y]...] with n segments
export function lathe(profile, n = 16) { return new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), n); }
export function hash(a, b = 0) { let h = Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; }
// pop/squash-stretch scale after a pop at tau=0 (from the pixel prototype); null before the pop
export function popScale(tau) {
  if (tau < 0) return null; if (tau > 0.5) return [1, 1];
  const k = 1 - Math.exp(-tau * 14) * Math.cos(tau * 26); const v = 1 - Math.exp(-tau * 14) * Math.cos(tau * 26 + 0.6);
  return [Math.max(0.03, Math.min(1.4, k)), Math.max(0.03, Math.min(1.5, v))];
}
// dynamic instanced kit: items pop (scale about a pivot) at given times; update(t) rewrites matrices
export class DynKit {
  constructor(group) { this.group = group; this.b = new Map(); }
  add(geo, mat, m, c, popT, pivot) { const k = geo.uuid + mat.uuid; let e = this.b.get(k); if (!e) this.b.set(k, e = { geo, mat, it: [] }); e.it.push({ m, c, popT, pivot }); }
  build() {
    const col = new THREE.Color(); this.meshes = [];
    for (const e of this.b.values()) { const im = new THREE.InstancedMesh(e.geo, e.mat, e.it.length); e.it.forEach((it, i) => { im.setMatrixAt(i, it.m); im.setColorAt(i, col.set(it.c)); });
      im.castShadow = im.receiveShadow = true; im.frustumCulled = false; this.group.add(im); this.meshes.push([im, e.it]); }
  }
  update(t) {
    const S = new THREE.Matrix4(), P = new THREE.Matrix4(), Pi = new THREE.Matrix4(), M = new THREE.Matrix4();
    for (const [im, items] of this.meshes) { items.forEach((it, i) => {
      const s = popScale(t - it.popT); if (!s) { im.setMatrixAt(i, M.makeScale(0, 0, 0)); return; }
      const [px, py, pz] = it.pivot; P.makeTranslation(px, py, pz); Pi.makeTranslation(-px, -py, -pz); S.makeScale(s[0], s[1], s[0]);
      im.setMatrixAt(i, M.copy(P).multiply(S).multiply(Pi).multiply(it.m)); }); im.instanceMatrix.needsUpdate = true; }
  }
}
