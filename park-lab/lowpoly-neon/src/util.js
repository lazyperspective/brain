import * as THREE from 'three';

export const R2 = Math.SQRT1_2;
// screen-aligned authoring coords: X = right on screen, D = toward viewer
export const P = (X, D, y = 0) => new THREE.Vector3((D + X) * R2, y, (D - X) * R2);
export const toXD = (v) => [(v.x - v.z) * R2, (v.x + v.z) * R2];

export function rng(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
export const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
export const lerp = (a, b, t) => a + (b - a) * t;
export function hash1(n) { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); }

// local clock that ramps smoothly from 0 speed to 1x after t0
export function clockFn(t0, ramp = 0.5) {
  return (t) => {
    const x = t - t0;
    if (x <= 0) return 0;
    if (x < ramp) { const a = x / ramp; return ramp * (a * a * a - (a * a * a * a) / 2); }
    return ramp / 2 + x - ramp;
  };
}

export function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const h = (a, b) => hash1(a * 57.0 + b * 131.0);
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  return lerp(lerp(h(xi, yi), h(xi + 1, yi), u), lerp(h(xi, yi + 1), h(xi + 1, yi + 1), u), v);
}

// polyline helpers (world Vector3 arrays)
export class Polyline {
  constructor(pts) {
    this.pts = pts; this.cum = [0];
    for (let i = 1; i < pts.length; i++) this.cum.push(this.cum[i - 1] + pts[i].distanceTo(pts[i - 1]));
    this.length = this.cum[this.cum.length - 1];
  }
  at(s, out = new THREE.Vector3(), dir) {
    s = clamp(s, 0, this.length);
    let lo = 0, hi = this.cum.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (this.cum[m] <= s) lo = m; else hi = m; }
    const seg = this.cum[hi] - this.cum[lo] || 1e-6;
    const f = (s - this.cum[lo]) / seg;
    out.lerpVectors(this.pts[lo], this.pts[hi], f);
    if (dir) dir.subVectors(this.pts[hi], this.pts[lo]).normalize();
    return out;
  }
}

// geometry: sweep a closed 2D profile [(b,n)] along frames
export function sweep(P_, N_, B_, profile, closedPath) {
  const n = P_.length, m = profile.length;
  const pos = [], idx = [];
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < m; j++) {
      const [b, nn] = profile[j];
      pos.push(P_[i].x + B_[i].x * b + N_[i].x * nn, P_[i].y + B_[i].y * b + N_[i].y * nn, P_[i].z + B_[i].z * b + N_[i].z * nn);
    }
  }
  const segs = closedPath ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const i2 = (i + 1) % n;
    for (let j = 0; j < m; j++) {
      const j2 = (j + 1) % m;
      const a = i * m + j, b = i * m + j2, c = i2 * m + j, d = i2 * m + j2;
      idx.push(a, c, b, b, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  const g2 = g.toNonIndexed(); g2.computeVertexNormals();
  return g2;
}

export function circleProfile(r, seg, ob = 0, on = 0) {
  const p = [];
  for (let i = 0; i < seg; i++) { const a = (i / seg) * Math.PI * 2; p.push([ob + Math.cos(a) * r, on + Math.sin(a) * r]); }
  return p;
}

// per-face colored geometry (non-indexed), colorFn(faceIndex, centroid)
export function faceColors(geo, colorFn) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const pos = g.attributes.position; const cols = new Float32Array(pos.count * 3);
  const c = new THREE.Vector3();
  for (let f = 0; f < pos.count / 3; f++) {
    c.set(0, 0, 0);
    for (let k = 0; k < 3; k++) c.x += pos.getX(f * 3 + k) / 3, c.y += pos.getY(f * 3 + k) / 3, c.z += pos.getZ(f * 3 + k) / 3;
    const col = colorFn(f, c);
    for (let k = 0; k < 3; k++) cols.set([col.r, col.g, col.b], (f * 3 + k) * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  g.computeVertexNormals();
  return g;
}
