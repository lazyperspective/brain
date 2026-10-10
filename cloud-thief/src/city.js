// CIRRUS QUAY — procedural floating metropolis. Static geometry is merged per material bucket;
// moving parts (gears, turbine, airships, trams, banners) are returned for per-frame animation.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { mulberry32, V, clamp, lerp } from './util.js';
import { paint, G, cloudTexture } from './mats.js';

// ---------- Layout: the geography every shot relies on ----------
export const L = {
  flower: V(0.95, 0.0, 0.15),
  pipSpot: V(1.4, 0, 0.45),
  balcony: { x0: -0.05, x1: 2.3, z0: -1.5, z1: 1.5 },
  homeWallX: 2.3,
  marketY: 8,
  market: { x0: -36, x1: -16.5, z0: -11, z1: 11 },
  stall: V(-17.8, 8, -1.2),          // Puff's jar stall, facing the shaft (+x)
  street: { x: -19.6, z0: -2, z1: 9 }, // chase street along +z
  noodle: V(-19.8, 8, 3.8),
  awning: V(-20.6, 10.2, 8.4),
  bridge: { x0: -16.4, x1: -0.05, y: 0, z: 0 },
  turbine: V(-8, -26, 0),
  railStart: V(-17.2, 9.4, 9.2),
  sun: new THREE.Vector3(-0.62, 0.30, 0.72).normalize(),
};
G.uSunDir.value.copy(L.sun);

const PAL = {
  cream: 0xe9dcc2, ivory: 0xf2e8d4, terracotta: 0xc0704e, rust: 0x93492f, copper: 0xb8734a, brass: 0xc9a24a,
  teal: 0x5f9e94, verd: 0x7fb5a4, slate: 0x4d6a8a, pink: 0xd98a9a, rose: 0xc9677a, plum: 0x5b3a52,
  navy: 0x2f3f5f, wood: 0x8a5a3c, iron: 0x4a4a55, dark: 0x2a2630, sand: 0xd8b98a, mint: 0xa8d5c2,
};
const WALLS = [PAL.cream, PAL.ivory, PAL.terracotta, PAL.teal, PAL.pink, PAL.sand, PAL.verd, PAL.cream, PAL.rose];
const ROOFS = [PAL.slate, PAL.teal, PAL.copper, PAL.rose, PAL.navy, PAL.verd, PAL.plum];

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3();
export function M(x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) {
  _e.set(rx, ry, rz); _q.setFromEuler(_e); _s.set(sx, sy, sz);
  return new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), _q, _s);
}

// shared unit geometries
const GEO = {
  box: new THREE.BoxGeometry(1, 1, 1),
  cyl8: new THREE.CylinderGeometry(1, 1, 1, 8),
  cyl16: new THREE.CylinderGeometry(1, 1, 1, 18),
  cyl6: new THREE.CylinderGeometry(1, 1, 1, 6),
  cone16: new THREE.ConeGeometry(1, 1, 18),
  cone8: new THREE.ConeGeometry(1, 1, 8),
  sph: new THREE.SphereGeometry(1, 16, 10),
  sphLo: new THREE.SphereGeometry(1, 8, 6),
  hemi: new THREE.SphereGeometry(1, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2),
  torus: new THREE.TorusGeometry(1, 0.08, 6, 24),
  plane: new THREE.PlaneGeometry(1, 1),
  disc: new THREE.CircleGeometry(1, 6, 0, Math.PI),
  pagoda: (() => { const pts = []; for (let i = 0; i <= 10; i++) { const t = i / 10; pts.push(new THREE.Vector2(1.15 * Math.pow(1 - t, 1.8) + 0.02, t)); } return new THREE.LatheGeometry(pts, 18); })(),
  onion: (() => { const pts = []; for (let i = 0; i <= 14; i++) { const t = i / 14; pts.push(new THREE.Vector2(Math.max(0.01, Math.sin(t * Math.PI * 0.95) * (1 - t * 0.6) * 1.1), t * 1.6)); } return new THREE.LatheGeometry(pts, 16); })(),
  root: (() => { const pts = []; for (let i = 0; i <= 10; i++) { const t = i / 10; pts.push(new THREE.Vector2(Math.max(0.02, Math.pow(t, 0.7)), t - 1)); } return new THREE.LatheGeometry(pts, 12); })(),
};
export function gearGeometry(teeth = 12, r = 1, depth = 0.18) {
  const s = new THREE.Shape();
  const ri = r * 0.82, steps = teeth * 4;
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    const k = i % 4; const rr = (k === 1 || k === 2) ? r : ri;
    const x = Math.cos(a) * rr, y = Math.sin(a) * rr;
    i === 0 ? s.moveTo(x, y) : s.lineTo(x, y);
  }
  const hole = new THREE.Path(); hole.absarc(0, 0, r * 0.25, 0, Math.PI * 2, true); s.holes.push(hole);
  for (let j = 0; j < 4; j++) { const h = new THREE.Path(); const a = j * Math.PI / 2 + 0.6; h.absarc(Math.cos(a) * r * 0.55, Math.sin(a) * r * 0.55, r * 0.15, 0, Math.PI * 2, true); s.holes.push(h); }
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 6 });
  g.translate(0, 0, -depth / 2);
  return g;
}

class Builder {
  constructor() { this.b = {}; }
  add(geo, m, color, bucket = 'enamel', jitter = 0.04, rr = Math.random, ao = 0.38) {
    let g = geo.index ? geo.toNonIndexed() : geo.clone();
    if (g.attributes.uv) g.deleteAttribute('uv');
    if (g.attributes.uv1) g.deleteAttribute('uv1');
    g.applyMatrix4(m);
    const c = new THREE.Color(color);
    if (jitter) c.offsetHSL((rr() - 0.5) * jitter * 0.4, (rr() - 0.5) * jitter, (rr() - 0.5) * jitter);
    const n = g.attributes.position.count, arr = new Float32Array(n * 3);
    const pos = g.attributes.position; let y0 = 1e9, y1 = -1e9;
    if (ao) { for (let i = 0; i < n; i++) { const y = pos.getY(i); y0 = Math.min(y0, y); y1 = Math.max(y1, y); } }
    const span = Math.max(1e-3, y1 - y0);
    for (let i = 0; i < n; i++) {
      const k = ao && span > 0.6 ? 1 - ao * Math.pow(1 - (pos.getY(i) - y0) / span, 2.2) : 1;
      arr[i * 3] = c.r * k; arr[i * 3 + 1] = c.g * k * (0.98 + 0.02 * k); arr[i * 3 + 2] = c.b * (k * 0.9 + 0.1);
    }
    g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    (this.b[bucket] ||= []).push(g);
    return g;
  }
  build(mats) {
    const out = [];
    for (const k in this.b) {
      const list = this.b[k];
      for (let i = 0; i < list.length; i += 4000) {
        const merged = mergeGeometries(list.slice(i, i + 4000), false);
        const mesh = new THREE.Mesh(merged, mats[k]);
        mesh.castShadow = k !== 'glow'; mesh.receiveShadow = true; mesh.matrixAutoUpdate = false;
        mesh.userData.bucket = k;
        out.push(mesh);
      }
    }
    return out;
  }
}

function catenary(a, b, sag, n = 16) {
  const pts = [];
  for (let i = 0; i <= n; i++) { const t = i / n; const p = a.clone().lerp(b, t); p.y -= sag * 4 * t * (1 - t); pts.push(p); }
  return pts;
}

// ---------- the city ----------
export function buildCity(scene) {
  const r = mulberry32(2024);
  const B = new Builder();
  const anim = { gears: [], spinners: [], ships: [], trams: [], banners: [], lanterns: [], birds: [] };
  const bloomSpots = []; // candidate places for flowers: {p, n, s}
  const vineCurves = []; // curves vines will grow along
  const add = (geo, m, c, bucket, j) => B.add(geo, m, c, bucket, j ?? 0.05, r);
  const spot = (x, y, z, s = 1, nx = 0, ny = 1, nz = 0) => bloomSpots.push({ p: V(x, y, z), n: V(nx, ny, nz), s });

  // ---- reusable kit pieces ----
  function archWindow(px, y, pz, ry, ww, hh, isLit, fx, fz) {
    const glassC = isLit ? [0xffc879, 0xffb36b, 0xffe2a8][Math.floor(r() * 3)] : [0x22304a, 0x34465f, 0x3d3352, 0x2c4450][Math.floor(r() * 4)];
    add(GEO.box, M(px, y, pz, 0, ry, 0, ww * 1.3, hh * 1.12, 0.07), 0x6b4a3a, 'metal', 0.06);
    add(GEO.plane, M(px + fx * 0.045, y, pz + fz * 0.045, 0, ry, 0, ww, hh, 1), glassC, isLit ? 'glow' : 'glass', 0.08);
    add(GEO.disc, M(px + fx * 0.05, y + hh / 2, pz + fz * 0.05, 0, ry, 0, ww / 2, ww / 2, 1), glassC, isLit ? 'glow' : 'glass', 0.08);
    add(GEO.box, M(px + fx * 0.08, y - hh / 2 - 0.05, pz + fz * 0.08, 0, ry, 0, ww * 1.5, 0.07, 0.16), PAL.brass, 'metal', 0.06);
    if (r() < 0.12) add(GEO.cone8, M(px + fx * 0.25, y + hh / 2 + 0.25, pz + fz * 0.25, 0, ry, 0, ww * 0.95, 0.35, ww * 0.6), [PAL.rose, PAL.teal, 0xe8a34a, PAL.pink][Math.floor(r() * 4)], 'cloth');
    if (r() < 0.1) { add(GEO.box, M(px + fx * 0.18, y - hh / 2 - 0.12, pz + fz * 0.18, 0, ry, 0, ww * 1.4, 0.16, 0.28), PAL.terracotta, 'enamel'); spot(px + fx * 0.2, y - hh / 2, pz + fz * 0.2, 0.7, fx, 0.5, fz); }
  }
  function windowsOnCylinder(x, z, y0, y1, rad, cols, rows, faces = 0, lit = 0.28) {
    cols = Math.max(3, Math.floor(cols * 0.8));
    // vertical ribs between columns
    for (let i = 0; i < cols; i++) { const a = (i / cols) * Math.PI * 2 + Math.PI / cols; add(GEO.box, M(x + Math.cos(a) * (rad + 0.03), (y0 + y1) / 2, z + Math.sin(a) * (rad + 0.03), 0, -a, 0, 0.1, y1 - y0 + 0.6, 0.16), PAL.copper, 'metal', 0.05); }
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      if (r() < 0.25) continue;
      const a = (i / cols) * Math.PI * 2;
      const y = y0 + (j + 0.5) * (y1 - y0) / rows;
      const fx = Math.cos(a), fz = Math.sin(a);
      const ww = Math.min(0.55, rad * 0.32), hh = Math.min(1.25, (y1 - y0) / rows * 0.55);
      archWindow(x + fx * (rad + 0.02), y, z + fz * (rad + 0.02), Math.PI / 2 - a, ww, hh, r() < lit, fx, fz);
    }
    add(GEO.cyl16, M(x, y1 + 0.2, z, 0, 0, 0, rad * 1.04, 0.12, rad * 1.04), PAL.brass, 'metal', 0.04);
  }
  function windowsOnBox(x, z, y0, y1, w, d, rows, lit = 0.28) {
    const faces = [[1, 0, d], [-1, 0, d], [0, 1, w], [0, -1, w]];
    for (const [fx, fz, span] of faces) {
      const cols = Math.max(1, Math.floor(span / 2.0));
      // timber/brass horizontal trims
      for (let j = 0; j <= rows; j++) { const y = y0 + j * (y1 - y0) / rows - 0.15; add(GEO.box, M(x + fx * (w / 2 + 0.03), y, z + fz * (d / 2 + 0.03), 0, fx !== 0 ? Math.PI / 2 : 0, 0, span + 0.05, 0.1, 0.08), 0x6b4a3a, 'metal', 0.05); }
      for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
        if (r() < 0.25) continue;
        const u = (i + 0.5) / cols - 0.5;
        const y = y0 + (j + 0.5) * (y1 - y0) / rows;
        const px = x + fx * (w / 2 + 0.03) + (fz !== 0 ? u * span : 0);
        const pz = z + fz * (d / 2 + 0.03) + (fx !== 0 ? u * span : 0);
        const ry = fx !== 0 ? (fx > 0 ? Math.PI / 2 : -Math.PI / 2) : (fz > 0 ? 0 : Math.PI);
        const ww = Math.min(0.55, span / cols * 0.35), hh = Math.min(1.25, (y1 - y0) / rows * 0.55);
        archWindow(px, y, pz, ry, ww, hh, r() < lit, fx, fz);
      }
    }
  }
  function railingRing(x, y, z, rad, n) {
    for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; add(GEO.cyl6, M(x + Math.cos(a) * rad, y + 0.35, z + Math.sin(a) * rad, 0, 0, 0, 0.035, 0.7, 0.035), PAL.iron, 'metal'); }
    add(GEO.torus, M(x, y + 0.7, z, Math.PI / 2, 0, 0, rad, rad, 0.5), PAL.brass, 'metal');
  }
  function gear(x, y, z, rad, ry, speed, color = PAL.brass) { anim.gears.push({ p: V(x, y, z), r: rad, ry, speed, color }); }
  function lantern(x, y, z, s = 1, color = 0xffb862) {
    add(GEO.cyl8, M(x, y + 0.25 * s, z, 0, 0, 0, 0.12 * s, 0.06 * s, 0.12 * s), PAL.iron, 'metal');
    add(GEO.sphLo, M(x, y, z, 0, 0, 0, 0.16 * s, 0.22 * s, 0.16 * s), color, 'glow', 0.05);
  }
  function bunting(a, b, sag, colors = [PAL.pink, PAL.ivory, PAL.teal, 0xf0b85a, PAL.rose]) {
    const pts = catenary(a, b, sag, 24);
    const curve = new THREE.CatmullRomCurve3(pts);
    add(new THREE.TubeGeometry(curve, 24, 0.015, 3), new THREE.Matrix4(), PAL.dark, 'metal', 0);
    const dir = b.clone().sub(a); const ang = Math.atan2(dir.x, dir.z);
    const len = dir.length(); const n = Math.floor(len / 0.55);
    for (let i = 1; i < n; i++) {
      const p = curve.getPointAt(i / n);
      const tri = new THREE.BufferGeometry();
      tri.setAttribute('position', new THREE.Float32BufferAttribute([-0.18, 0, 0, 0.18, 0, 0, 0, -0.38, 0], 3)); tri.computeVertexNormals();
      add(tri, M(p.x, p.y, p.z, 0, ang + Math.PI / 2, 0), colors[i % colors.length], 'cloth', 0.08);
    }
  }
  function cable(a, b, sag, rad = 0.03, color = PAL.dark) {
    const curve = new THREE.CatmullRomCurve3(catenary(a, b, sag, 16));
    add(new THREE.TubeGeometry(curve, 16, rad, 4), new THREE.Matrix4(), color, 'metal', 0);
    return curve;
  }
  function pipeRun(x, z, y0, y1, rad = 0.12, color = PAL.copper) {
    add(GEO.cyl8, M(x, (y0 + y1) / 2, z, 0, 0, 0, rad, y1 - y0, rad), color, 'metal');
    for (let y = y0 + 1; y < y1; y += 2.2) add(GEO.cyl8, M(x, y, z, 0, 0, 0, rad * 1.5, 0.12, rad * 1.5), PAL.brass, 'metal');
  }
  function roof(x, y, z, rad, style, color) {
    if (r() < 0.5) { const a = r() * 6.28; add(GEO.cyl8, M(x + Math.cos(a) * rad * 0.5, y + rad * 0.5, z + Math.sin(a) * rad * 0.5, 0, 0, 0, 0.18, rad * 0.9 + 0.5, 0.18), PAL.terracotta, 'enamel'); add(GEO.cyl8, M(x + Math.cos(a) * rad * 0.5, y + rad * 0.95 + 0.3, z + Math.sin(a) * rad * 0.5, 0, 0, 0, 0.24, 0.12, 0.24), PAL.iron, 'metal'); }
    if (style === 0) { add(GEO.pagoda, M(x, y, z, 0, 0, 0, rad * 1.25, rad * 1.1, rad * 1.25), color, 'roof'); add(GEO.cyl6, M(x, y + rad * 1.3, z, 0, 0, 0, 0.04, rad * 0.8, 0.04), PAL.brass, 'metal'); spot(x + rad * 0.9, y + 0.1, z, 1.3); }
    else if (style === 1) { add(GEO.hemi, M(x, y, z, 0, 0, 0, rad, rad * 0.8, rad), color, 'roof'); add(GEO.sphLo, M(x, y + rad * 0.85, z, 0, 0, 0, rad * 0.12), PAL.brass, 'metal'); }
    else if (style === 2) { add(GEO.cone16, M(x, y + rad * 1.4, z, 0, 0, 0, rad * 1.05, rad * 2.8, rad * 1.05), color, 'roof'); anim.banners.push({ p: V(x, y + rad * 2.9, z), s: rad * 0.6 }); }
    else { add(GEO.onion, M(x, y, z, 0, 0, 0, rad * 0.9, rad * 0.9, rad * 0.9), color, 'roof'); add(GEO.cyl6, M(x, y + rad * 1.5, z, 0, 0, 0, 0.03, rad * 0.8, 0.03), PAL.brass, 'metal'); }
  }

  // A stacked tower. detail: 0 far silhouette, 1 mid, 2 near
  function tower(x, z, yBot, yTop, rad, detail = 1, opts = {}) {
    let y = yBot;
    const wall0 = opts.wall ?? WALLS[Math.floor(r() * WALLS.length)];
    // hanging machinery root under the tower
    add(GEO.root, M(x, yBot, z, 0, 0, 0, rad * 0.95, rad * 2.2 + 3, rad * 0.95), PAL.iron, 'metal');
    if (detail > 0) { for (let k = 0; k < 3; k++) { const a = r() * 6.28; lantern(x + Math.cos(a) * rad * 0.6, yBot - 2 - r() * 4, z + Math.sin(a) * rad * 0.6, 1.4); } }
    let rr = rad;
    while (y < yTop - 1) {
      const h = Math.min(yTop - y, 3 + r() * 6);
      const style = r();
      const wall = r() < 0.6 ? wall0 : WALLS[Math.floor(r() * WALLS.length)];
      rr = clamp(rr * (0.85 + r() * 0.25), rad * 0.55, rad * 1.15);
      if (style < 0.55) {
        add(GEO.cyl16, M(x, y + h / 2, z, 0, 0, 0, rr, h, rr), wall, 'enamel');
        if (detail > 0) windowsOnCylinder(x, z, y + 0.4, y + h - 0.4, rr, Math.max(4, Math.floor(rr * 2.2)), Math.max(1, Math.floor(h / 2.2)), 0, 0.3);
      } else {
        const w = rr * 1.7, d = rr * (1.3 + r() * 0.5);
        add(GEO.box, M(x, y + h / 2, z, 0, 0, 0, w, h, d), wall, 'enamel');
        if (detail > 0) windowsOnBox(x, z, y + 0.4, y + h - 0.4, w, d, Math.max(1, Math.floor(h / 2.2)), 0.3);
        // little gabled overhang
        if (detail > 1 && r() < 0.5) add(GEO.cone8, M(x + w / 2 + 0.4, y + h - 0.3, z, 0, 0, Math.PI / 2, 0.6, 0.9, 0.6), ROOFS[Math.floor(r() * ROOFS.length)], 'roof');
      }
      // ledge band
      add(GEO.cyl16, M(x, y + h, z, 0, 0, 0, rr * 1.12, 0.3, rr * 1.12), PAL.copper, 'metal');
      spot(x + rr * 1.05, y + h + 0.15, z, 1); spot(x - rr * 1.05, y + h + 0.15, z, 1); spot(x, y + h + 0.15, z + rr * 1.05, 1); spot(x, y + h + 0.15, z - rr * 1.05, 1);
      if (detail > 0 && r() < 0.35) { // balcony ring
        add(GEO.cyl16, M(x, y + h + 0.15, z, 0, 0, 0, rr * 1.4, 0.18, rr * 1.4), PAL.wood, 'enamel');
        if (detail > 1) railingRing(x, y + h + 0.24, z, rr * 1.38, 22);
        for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + r(); spot(x + Math.cos(a) * rr * 1.3, y + h + 0.3, z + Math.sin(a) * rr * 1.3, 1.3); }
        // dry planters
        for (let k = 0; k < 3; k++) { const a = r() * 6.28; add(GEO.box, M(x + Math.cos(a) * rr * 1.25, y + h + 0.42, z + Math.sin(a) * rr * 1.25, 0, -a, 0, 0.5, 0.3, 0.3), PAL.terracotta, 'enamel'); spot(x + Math.cos(a) * rr * 1.25, y + h + 0.6, z + Math.sin(a) * rr * 1.25, 1.5); }
      }
      if (detail > 0 && r() < 0.4) { const a = r() * 6.28; gear(x + Math.cos(a) * (rr + 0.12), y + h * 0.5, z + Math.sin(a) * (rr + 0.12), Math.min(h * 0.35, 0.6 + r() * 1.4), -a + Math.PI / 2, (r() - 0.5) * 1.5); }
      if (detail > 0 && r() < 0.4) { const a = r() * 6.28; pipeRun(x + Math.cos(a) * (rr + 0.2), z + Math.sin(a) * (rr + 0.2), y, y + h, 0.1 + r() * 0.08, r() < 0.5 ? PAL.copper : PAL.verd); }
      y += h + 0.3;
    }
    roof(x, y, z, rr * (0.9 + r() * 0.3), opts.roof ?? Math.floor(r() * 4), ROOFS[Math.floor(r() * ROOFS.length)]);
    // vines will climb this tower after the bloom
    if (detail > 0) {
      const pts = []; const turns = 2 + r() * 2; const ph = r() * 6.28; const y0 = yBot + (yTop - yBot) * 0.1, y1 = yTop;
      for (let i = 0; i <= 40; i++) { const t = i / 40; const a = ph + t * turns * 6.28; pts.push(V(x + Math.cos(a) * rad * 1.2, lerp(y0, y1, t), z + Math.sin(a) * rad * 1.2)); }
      vineCurves.push({ curve: new THREE.CatmullRomCurve3(pts), rad: 0.09 + rad * 0.02 });
    }
    return { x, z, top: y, rad };
  }

  function bridgeSpan(a, b, w = 1.4, color = PAL.wood) {
    const d = b.clone().sub(a); const len = Math.hypot(d.x, d.z); const ang = Math.atan2(d.x, d.z);
    const mid = a.clone().add(b).multiplyScalar(0.5);
    const pitch = Math.atan2(d.y, len);
    add(GEO.box, M(mid.x, mid.y, mid.z, -pitch, ang, 0, w, 0.18, Math.hypot(len, d.y)), color, 'enamel');
    for (const s of [-1, 1]) {
      const off = V(Math.cos(ang) * s * w / 2, 0, -Math.sin(ang) * s * w / 2);
      add(GEO.box, M(mid.x + off.x, mid.y + 0.5, mid.z + off.z, -pitch, ang, 0, 0.05, 0.05, Math.hypot(len, d.y)), PAL.brass, 'metal');
      const n = Math.max(1, Math.floor(len / 0.8));
      for (let i = 0; i <= n; i++) { const p = a.clone().lerp(b, i / n).add(off); add(GEO.cyl6, M(p.x, p.y + 0.25, p.z, 0, 0, 0, 0.03, 0.5, 0.03), PAL.iron, 'metal'); if (i % 3 === 0) spot(p.x, p.y + 0.5, p.z, 0.8); }
    }
    // under-arch truss
    const arch = []; for (let i = 0; i <= 16; i++) { const t = i / 16; const p = a.clone().lerp(b, t); p.y -= 0.2 + Math.sin(t * Math.PI) * Math.min(3, len * 0.15); arch.push(p); }
    add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(arch), 16, 0.1, 5), new THREE.Matrix4(), PAL.iron, 'metal', 0);
    for (let i = 1; i < 8; i++) { const t = i / 8; const p = a.clone().lerp(b, t); const dy = 0.2 + Math.sin(t * Math.PI) * Math.min(3, len * 0.15); add(GEO.cyl6, M(p.x, p.y - dy / 2, p.z, 0, 0, 0, 0.04, dy, 0.04), PAL.iron, 'metal'); }
  }

  // ================= NEAR: Pip's home tower & balcony =================
  {
    const hx = 6.3;
    // main home tower body: a tall cream/terracotta stack
    add(GEO.box, M(hx, -14, 0, 0, 0, 0, 8, 40, 8.5), PAL.cream, 'enamel');
    add(GEO.root, M(hx, -34, 0, 0, 0, 0, 5.5, 14, 5.5), PAL.iron, 'metal');
    windowsOnBox(hx, 0, -32, 5, 8, 8.5, 14, 0.3);
    add(GEO.box, M(hx, 0.05 - 0.6, 0, 0, 0, 0, 8.4, 0.5, 8.9), PAL.copper, 'metal');
    add(GEO.cyl16, M(hx, 9, 0, 0, 0, 0, 3.6, 8, 3.6), PAL.terracotta, 'enamel');
    windowsOnCylinder(hx, 0, 6, 12, 3.6, 10, 3, 0, 0.3);
    add(GEO.cyl16, M(hx, 13.2, 0, 0, 0, 0, 4.1, 0.4, 4.1), PAL.copper, 'metal');
    add(GEO.cyl16, M(hx, 16, 0, 0, 0, 0, 2.6, 5, 2.6), PAL.ivory, 'enamel');
    roof(hx, 18.5, 0, 3.1, 0, PAL.slate);
    add(GEO.box, M(hx, 5.2, 0, 0, 0, 0, 8.6, 0.4, 9.1), PAL.copper, 'metal');
    // big clock face on the home tower's shaft side
    add(GEO.cyl16, M(hx - 3.65, 9.2, -0.2, 0, 0, Math.PI / 2, 2.2, 0.25, 2.2), PAL.ivory, 'enamel');
    add(GEO.torus, M(hx - 3.8, 9.2, -0.2, 0, Math.PI / 2, 0, 2.2, 2.2, 2.5), PAL.brass, 'metal');
    anim.clock = { p: V(hx - 3.85, 9.2, -0.2) };
    // pipes and gears on the shaft face
    pipeRun(2.15, -3.2, -30, 6, 0.22, PAL.copper); pipeRun(2.15, 3.3, -30, 4, 0.16, PAL.verd); pipeRun(2.15, -2.4, -30, 3, 0.1, PAL.brass);
    gear(2.2, 2.6, -2.2, 0.9, Math.PI / 2, 0.6); gear(2.2, 3.7, -0.9, 0.55, Math.PI / 2, -0.98); gear(2.2, -3, 2.8, 1.6, Math.PI / 2, 0.3); gear(2.2, -6, -2.0, 2.2, Math.PI / 2, -0.2);
    // Pip's little round door + porthole windows
    add(GEO.cyl16, M(2.31, 0.55, -0.85, 0, 0, Math.PI / 2, 0.42, 0.06, 0.42), PAL.teal, 'enamel');
    add(GEO.torus, M(2.33, 0.55, -0.85, 0, Math.PI / 2, 0, 0.44, 0.44, 0.8), PAL.brass, 'metal');
    add(GEO.sphLo, M(2.36, 0.5, -0.6, 0, 0, 0, 0.04), PAL.brass, 'metal');
    add(GEO.cyl16, M(2.31, 1.4, 0.75, 0, 0, Math.PI / 2, 0.25, 0.05, 0.25), 0xffcf8a, 'glow');
    add(GEO.torus, M(2.33, 1.4, 0.75, 0, Math.PI / 2, 0, 0.27, 0.27, 0.8), PAL.brass, 'metal');
    // balcony: rusted iron plates with a crack between two of them
    const { x0, x1, z0, z1 } = L.balcony;
    add(GEO.box, M(1.15, -0.12, 0.05 + (z0 + 0.05) / 2 * 0 - 0.0, 0, 0, 0, 0.001, 0.001, 0.001), PAL.rust, 'metal');
    const plates = [[x0, 1.0, z0, 0.12], [x0, 1.0, 0.18, z1], [1.0, 0.88 + 0.0, -0.1, -0.1]];
    add(GEO.box, M((x0 + 0.92) / 2, -0.1, (z0 + z1) / 2, 0, 0, 0.004, 0.92 - x0, 0.2, z1 - z0), 0x8d5a45, 'metal');
    add(GEO.box, M((0.98 + x1) / 2, -0.1, (z0 + z1) / 2, 0, 0, -0.004, x1 - 0.98, 0.2, z1 - z0), 0x7f5444, 'metal');
    // rivets on plates
    for (let i = 0; i < 14; i++) { const px = i < 7 ? x0 + 0.1 + (i % 7) * 0.12 : 1.08 + (i % 7) * 0.18; add(GEO.sphLo, M(px, 0.0, z0 + 0.08, 0, 0, 0, 0.025), PAL.brass, 'metal'); add(GEO.sphLo, M(px, 0.0, z1 - 0.08, 0, 0, 0, 0.025), PAL.brass, 'metal'); }
    // soil in the crack
    add(GEO.box, M(0.95, -0.02, 0.15, 0, 0, 0, 0.07, 0.04, 0.5), 0x4a3426, 'enamel');
    add(GEO.box, M(1.15, -0.32, 0, 0, 0, 0, x1 - x0 + 0.1, 0.3, z1 - z0 + 0.1), PAL.iron, 'metal');
    // brackets under balcony
    for (const zz of [z0 + 0.2, z1 - 0.2]) add(GEO.box, M(1.6, -0.9, zz, 0, 0, -0.7, 0.12, 1.6, 0.12), PAL.iron, 'metal');
    // railing with a gate gap at the bridge (z ~ 0)
    for (let i = 0; i <= 12; i++) { const zz = lerp(z0, z1, i / 12); if (Math.abs(zz) < 0.5) continue; add(GEO.cyl6, M(x0 + 0.04, 0.3, zz, 0, 0, 0, 0.022, 0.6, 0.022), PAL.iron, 'metal'); }
    add(GEO.box, M(x0 + 0.04, 0.62, (z0 - 0.5) / 2, 0, 0, 0, 0.05, 0.05, -0.5 - z0), PAL.brass, 'metal');
    add(GEO.box, M(x0 + 0.04, 0.62, (z1 + 0.5) / 2, 0, 0, 0, 0.05, 0.05, z1 - 0.5), PAL.brass, 'metal');
    for (const zz of [z0, z1]) { for (let i = 0; i <= 8; i++) add(GEO.cyl6, M(lerp(x0, x1, i / 8), 0.3, zz, 0, 0, 0, 0.022, 0.6, 0.022), PAL.iron, 'metal'); add(GEO.box, M((x0 + x1) / 2, 0.62, zz, 0, 0, 0, x1 - x0, 0.05, 0.05), PAL.brass, 'metal'); }
    // dried pots & little props
    add(GEO.cyl8, M(2.0, 0.12, -1.2, 0, 0, 0, 0.14, 0.24, 0.11), PAL.terracotta, 'enamel'); spot(2.0, 0.26, -1.2, 0.8);
    add(GEO.cyl8, M(1.75, 0.09, -1.28, 0, 0, 0, 0.1, 0.18, 0.08), PAL.rose, 'enamel'); spot(1.75, 0.2, -1.28, 0.6);
    add(GEO.cyl8, M(2.05, 0.1, 1.15, 0, 0, 0, 0.12, 0.2, 0.1), PAL.teal, 'enamel'); spot(2.05, 0.22, 1.15, 0.7);
    add(GEO.box, M(1.95, 0.15, 0.95, 0, 0.3, 0, 0.3, 0.3, 0.3), PAL.wood, 'enamel');
    lantern(2.1, 1.7, 1.25, 0.8);
    add(GEO.box, M(2.2, 1.95, 1.25, 0, 0, 0, 0.25, 0.04, 0.04), PAL.iron, 'metal');
    for (let i = 0; i < 10; i++) spot(lerp(x0, x1, r()), 0.02, lerp(z0, z1, r()) * 0.9, 0.7);
    for (let i = 0; i < 8; i++) spot(x0 + 0.05, 0.64, lerp(z0, z1, i / 7), 0.6);
    bunting(V(2.3, 2.6, -1.5), V(-0.1, 1.9, -1.5), 0.3);
    bunting(V(2.3, 2.6, 1.5), V(2.3, 3.1, 6), 0.3);
    // vines on home tower
    for (let k = 0; k < 4; k++) { const pts = []; const zz = -3 + k * 2; for (let i = 0; i <= 30; i++) { const t = i / 30; pts.push(V(2.36 + Math.sin(t * 9 + k) * 0.05, -12 + t * 22, zz + Math.sin(t * 7 + k) * 0.6)); } vineCurves.push({ curve: new THREE.CatmullRomCurve3(pts), rad: 0.06 }); }
    // facade bloom spots
    for (let i = 0; i < 90; i++) spot(2.25, -10 + r() * 22, -4 + r() * 8, 1.4, 1, 0, 0);
    // neighbouring stacks hugging the home tower
    tower(6, 9, -26, 14, 3.2, 2); tower(6.5, -10, -30, 22, 3.6, 2, { roof: 2 });
    tower(13, 3, -30, 26, 4, 1, { roof: 3 });
    bridgeSpan(V(6, 5.6, 6), V(6, 5.6, 2), 1.2);
  }

  // ================= SHAFT: bridge supports, turbine, walls =================
  {
    const { x0, x1 } = L.bridge;
    // far-side bridge abutment
    add(GEO.box, M(x0 - 1.0, -0.6, 0, 0, 0, 0, 2.2, 1.2, 2.4), PAL.copper, 'metal');
    // telescoping bridge sleeves (static housing) — moving deck segments are separate meshes
    add(GEO.box, M(x0 + 0.6, -0.35, 0, 0, 0, 0, 1.6, 0.6, 1.6), PAL.iron, 'metal');
    // the turbine housing ring far below
    const T = L.turbine;
    add(new THREE.TorusGeometry(8.5, 0.6, 8, 48), M(T.x, T.y, T.z, Math.PI / 2, 0, 0), PAL.copper, 'metal');
    add(GEO.cyl16, M(T.x, T.y - 2, T.z, 0, 0, 0, 1.3, 5, 1.3), PAL.brass, 'metal');
    for (let i = 0; i < 6; i++) { const a = i / 6 * 6.28; add(GEO.box, M(T.x + Math.cos(a) * 9.5, T.y + 2, T.z + Math.sin(a) * 9.5, 0, -a, 0, 1, 4, 1), PAL.iron, 'metal'); }
    for (let i = 0; i < 24; i++) { const a = i / 24 * 6.28; lantern(T.x + Math.cos(a) * 8.6, T.y + 0.8, T.z + Math.sin(a) * 8.6, 1.5, 0x9ff0ff); }
    // shaft back wall (toward -z) — a dense facade giving vertical depth
    for (let i = 0; i < 5; i++) tower(-14 + i * 3.4, -15 - (i % 2) * 2, -40, 6 + r() * 14, 2.6, 2);
    // hanging cable under the bridge (the guard ends up dangling from this)
    cable(V(-6.5, 0.1, -9), V(-6.5, 0.1, 9), 1.3, 0.035);
    cable(V(-12, 2.5, -14), V(2.2, 4.5, -2), 2.2, 0.04);
    cable(V(-15, 12, 5), V(2.3, 10, 3), 2.0, 0.04);
    bunting(V(-16, 9.5, -2), V(2.3, 7.5, -3.5), 2.4);
    bunting(V(-16, 11, 4), V(2.3, 8.5, 3.5), 2.0, [0xf0b85a, PAL.pink, PAL.ivory]);
    // tram line across the upper shaft
    const tramA = V(-40, 16, -6), tramB = V(40, 18, 8);
    cable(tramA, tramB, 2.5, 0.06, PAL.iron);
    anim.trams.push({ a: tramA, b: tramB, sag: 2.5, speed: 0.025, phase: 0.42 });
    anim.trams.push({ a: tramA, b: tramB, sag: 2.5, speed: 0.025, phase: 0.92 });
  }

  // ================= MARKET DISTRICT (far side, one level up) =================
  const market = { stalls: [], jarAnchors: [] };
  {
    const { x0, x1, z0, z1 } = L.market; const y = L.marketY;
    // platform deck with planks, hung from the district towers
    add(GEO.box, M((x0 + x1) / 2, y - 0.25, (z0 + z1) / 2, 0, 0, 0, x1 - x0, 0.5, z1 - z0), PAL.wood, 'enamel');
    for (let i = 0; i < 30; i++) add(GEO.box, M(lerp(x0, x1, i / 30), y + 0.005, (z0 + z1) / 2, 0, 0, 0, 0.04, 0.02, z1 - z0), 0x6f4630, 'enamel', 0.02);
    add(GEO.box, M((x0 + x1) / 2, y - 0.9, (z0 + z1) / 2, 0, 0, 0, x1 - x0 - 1, 0.8, z1 - z0 - 1), PAL.iron, 'metal');
    // edge railing along the shaft side
    for (let i = 0; i <= 44; i++) { const zz = lerp(z0, z1, i / 44); add(GEO.cyl6, M(x1 - 0.1, y + 0.4, zz, 0, 0, 0, 0.03, 0.8, 0.03), PAL.iron, 'metal'); }
    add(GEO.box, M(x1 - 0.1, y + 0.82, (z0 + z1) / 2, 0, 0, 0, 0.06, 0.06, z1 - z0), PAL.brass, 'metal');
    // support cables up to towers
    for (const [cx, cz] of [[x1, z0], [x1, z1], [x0, z0], [x0, z1]]) cable(V(cx, y, cz), V(cx * 1.05, y + 22, cz * 1.4), 0.2, 0.06);
    // market towers behind the deck
    tower(-27, -5, -30, 30, 4.2, 2, { roof: 0 }); tower(-33, 7, -26, 24, 3.6, 2, { roof: 3 });
    tower(-24, 13, -20, 20, 3, 2); tower(-30, -15, -24, 26, 3.8, 2, { roof: 2 });
    tower(-20, -16, -18, 18, 2.6, 2);
    bridgeSpan(V(-27, 18, -5), V(-33, 16, 7), 1.4); bridgeSpan(V(-24, 14, 13), V(-30, 14, 7), 1.2);
    // stalls: canopies (striped), counters, goods
    const stallSpots = [[-17.8, -1.2, PAL.rose], [-22.6, -1.5, PAL.teal], [-17.9, 4.8, 0xe8a34a], [-22.8, 5.4, PAL.pink], [-17.9, -7, PAL.slate], [-22.5, -7.5, PAL.rose], [-26, 1, 0xe8a34a], [-26, -4.5, PAL.teal], [-26.5, 7.5, PAL.rose]];
    for (const [sx, sz, c] of stallSpots) {
      const cw = 2.6, cd = 1.9;
      add(GEO.box, M(sx, y + 0.45, sz, 0, 0, 0, cd * 0.7, 0.9, cw * 0.9), PAL.wood, 'enamel');
      add(GEO.box, M(sx, y + 0.92, sz, 0, 0, 0, cd * 0.75, 0.05, cw * 0.95), PAL.brass, 'metal');
      for (const [ox, oz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) add(GEO.cyl6, M(sx + ox * cd * 0.45, y + 1.3, sz + oz * cw * 0.48, 0, 0, 0, 0.04, 2.6, 0.04), PAL.iron, 'metal');
      // striped canopy: alternating gores of a shallow cone
      for (let g = 0; g < 12; g++) {
        const seg = new THREE.ConeGeometry(1.75, 0.8, 1, 1, true, (g / 12) * Math.PI * 2, Math.PI * 2 / 12);
        add(seg, M(sx, y + 2.95, sz, 0, 0, 0, 1, 1, 1), g % 2 ? c : PAL.ivory, 'cloth', 0.03);
      }
      for (let k = 0; k < 4; k++) lantern(sx + (r() - 0.5) * 2.4, y + 2.3, sz + (r() - 0.5) * 2.4, 0.7, [0xffb862, 0xff9a7a, 0xa8f0ff][k % 3]);
      // goods on counter (fruit/gizmos)
      for (let k = 0; k < 8; k++) add(GEO.sphLo, M(sx + (r() - 0.5) * 0.9, y + 1.02, sz + (r() - 0.5) * 2, 0, 0, 0, 0.07 + r() * 0.05), [0xe8604a, 0xf0b85a, 0x9ed36a, 0x7ab8e8, PAL.pink][k % 5], 'enamel');
      spot(sx, y + 3.3, sz, 1.6); spot(sx + 0.8, y + 0.95, sz, 0.8);
      market.stalls.push(V(sx, y, sz));
    }
    bunting(V(-16.6, 11.5, -10), V(-16.6, 11.5, 10), 1.2);
    bunting(V(-21, 12, -10), V(-21, 12, 10), 1.4, [PAL.teal, 0xf0b85a, PAL.ivory, PAL.pink]);
    bunting(V(-16.6, 11, -6), V(-34, 13, -6), 1.2);
    bunting(V(-16.6, 11, 6), V(-34, 13, 6), 1.2, [0xf0b85a, PAL.rose, PAL.ivory]);
    for (let i = 0; i < 26; i++) spot(lerp(x0, x1, r()), y + 0.02, lerp(z0, z1, r()), 0.9);
    // the sprung awning Pip ricochets off
    const A = L.awning;
    add(GEO.box, M(A.x, A.y - 1.3, A.z, 0, 0, 0, 0.6, 2.6, 0.6), PAL.terracotta, 'enamel');
    // sky rail sweeping down from market to the bridge head
    const railPts = [L.railStart, V(-16.4, 8.6, 12), V(-13.5, 6, 11), V(-12.6, 3.2, 7), V(-14.2, 1.2, 3.2), V(-16.2, 0.25, 0.8)];
    const railCurve = new THREE.CatmullRomCurve3(railPts);
    add(new THREE.TubeGeometry(railCurve, 80, 0.07, 6), new THREE.Matrix4(), PAL.brass, 'metal', 0);
    for (let i = 0; i <= 12; i++) { const p = railCurve.getPointAt(i / 12); add(GEO.cyl6, M(p.x, p.y + 4, p.z, 0, 0, 0, 0.02, 8, 0.02), PAL.dark, 'metal'); }
    market.railCurve = railCurve;
  }

  // ================= MID CITY RING =================
  const towers = [];
  {
    const keep = (x, z) => {
      if (x > -38 && x < 16 && z > -18 && z < 16) return false; // the hero zone
      if (Math.hypot(x - 35, z - 40) < 26) return false; // keep the camera side open for wides
      return true;
    };
    let n = 0, tries = 0;
    while (n < 70 && tries < 3000) {
      tries++;
      const a = r() * Math.PI * 2, d = 26 + Math.pow(r(), 0.8) * 110;
      const x = Math.cos(a) * d - 10, z = Math.sin(a) * d - 10;
      if (!keep(x, z)) continue;
      if (towers.some(t => Math.hypot(t.x - x, t.z - z) < t.rad + 6)) continue;
      const rad = 2.5 + r() * 5 + (d > 80 ? r() * 3 : 0);
      const top = 6 + r() * 40 + (r() < 0.12 ? 30 : 0);
      towers.push(tower(x, z, -40 - r() * 30, top, rad, d < 90 ? 1 : 0));
      n++;
    }
    // bridges & bunting between neighbours, plus floating platforms
    for (let i = 0; i < towers.length; i++) {
      const a = towers[i];
      let best = null, bd = 1e9;
      for (let j = 0; j < towers.length; j++) { if (i === j) continue; const b = towers[j]; const d = Math.hypot(a.x - b.x, a.z - b.z); if (d < bd) { bd = d; best = b; } }
      if (best && bd < 40) {
        const y = Math.min(a.top, best.top) * (0.3 + r() * 0.5) - 6;
        const dir = V(best.x - a.x, 0, best.z - a.z).normalize();
        const pa = V(a.x + dir.x * a.rad, y, a.z + dir.z * a.rad), pb = V(best.x - dir.x * best.rad, y + (r() - 0.5) * 3, best.z - dir.z * best.rad);
        if (r() < 0.6) bridgeSpan(pa, pb, 1.4 + r()); else cable(pa, pb, bd * 0.05, 0.05);
        if (r() < 0.6) bunting(pa.clone().setY(y + 4), pb.clone().setY(y + 5), bd * 0.04);
        if (r() < 0.4) cable(pa.clone().setY(y - 6), pb.clone().setY(y - 5), bd * 0.08, 0.04);
      }
    }
    // floating platforms / islands with mini houses
    for (let i = 0; i < 22; i++) {
      const a = r() * 6.28, d = 30 + r() * 90; const x = Math.cos(a) * d - 10, z = Math.sin(a) * d - 10;
      if (!keep(x, z)) continue;
      const y = -10 + r() * 40; const rad = 2 + r() * 3;
      add(GEO.cyl16, M(x, y, z, 0, 0, 0, rad, 0.5, rad), PAL.wood, 'enamel');
      add(GEO.root, M(x, y - 0.25, z, 0, 0, 0, rad * 0.9, rad * 1.6, rad * 0.9), PAL.iron, 'metal');
      add(GEO.box, M(x, y + 1, z, 0, r() * 3, 0, rad * 0.8, 1.6, rad * 0.7), WALLS[Math.floor(r() * WALLS.length)], 'enamel');
      add(GEO.cone8, M(x, y + 2.4, z, 0, r() * 3, 0, rad * 0.75, 1.3, rad * 0.75), ROOFS[Math.floor(r() * ROOFS.length)], 'roof');
      spot(x + rad * 0.8, y + 0.3, z, 1.3);
      lantern(x, y - rad * 1.6, z, 1.5);
    }
  }

  // ================= GIANT STRUCTURES =================
  {
    // the Great Chronospire: a colossal clock spire in the distance (behind the market from the hero angle)
    const sx = -150, sz = -95;
    add(GEO.root, M(sx, -60, sz, 0, 0, 0, 22, 50, 22), PAL.iron, 'metal');
    let y = -60; let rad = 22;
    for (let i = 0; i < 9; i++) {
      const h = 18 + r() * 8;
      add(i % 2 ? GEO.cyl16 : GEO.cyl8, M(sx, y + h / 2, sz, 0, 0, 0, rad, h, rad), i % 3 === 0 ? PAL.cream : (i % 3 === 1 ? PAL.terracotta : PAL.teal), 'enamel');
      add(GEO.cyl16, M(sx, y + h, sz, 0, 0, 0, rad * 1.12, 1.2, rad * 1.12), PAL.copper, 'metal');
      windowsOnCylinder(sx, sz, y + 1, y + h - 1, rad, 18, 3, 0, 0.4);
      y += h + 1; rad *= 0.86;
    }
    // clock face pointing toward the city center
    const fa = Math.atan2(0 - sz, 0 - sx);
    anim.bigClock = { p: V(sx + Math.cos(fa) * (rad / 0.86 + 0.6), y - 12, sz + Math.sin(fa) * (rad / 0.86 + 0.6)), a: fa, r: 9 };
    add(GEO.cyl16, M(anim.bigClock.p.x, anim.bigClock.p.y, anim.bigClock.p.z, 0, -fa, Math.PI / 2, 9, 1, 9), PAL.ivory, 'enamel');
    add(GEO.torus, M(anim.bigClock.p.x + Math.cos(fa) * 0.5, anim.bigClock.p.y, anim.bigClock.p.z + Math.sin(fa) * 0.5, 0, Math.PI / 2 - fa, 0, 9, 9, 6), PAL.brass, 'metal');
    roof(sx, y, sz, rad * 1.1, 2, PAL.slate);
    anim.spinners.push({ p: V(sx, y - 30, sz), r: rad * 2.0, speed: 0.08, kind: 'ring' });
    // colossal gear arch on the opposite side
    gear(80, 20, -60, 24, 0.5, 0.05, PAL.copper);
    gear(60, 2, -48, 12, 0.5, -0.1, PAL.brass);
    // a giant suspended dome-hall
    add(GEO.hemi, M(-60, 40, 90, 0, 0, 0, 26, 20, 26), PAL.verd, 'roof');
    add(GEO.cyl16, M(-60, 32, 90, 0, 0, 0, 27, 16, 27), PAL.cream, 'enamel');
    windowsOnCylinder(-60, 90, 26, 38, 27, 30, 3, 0, 0.45);
    add(GEO.root, M(-60, 24, 90, 0, 0, 0, 27, 40, 27), PAL.iron, 'metal');
  }

  // ================= FAR SILHOUETTES =================
  {
    for (let i = 0; i < 140; i++) {
      const a = r() * 6.28, d = 170 + r() * 380; const x = Math.cos(a) * d, z = Math.sin(a) * d;
      const rad = 5 + r() * 14, top = -10 + r() * 70 + (r() < 0.1 ? 60 : 0);
      add(GEO.root, M(x, -60, z, 0, 0, 0, rad, 30, rad), PAL.iron, 'far');
      add(r() < 0.5 ? GEO.cyl8 : GEO.box, M(x, (top - 60) / 2, z, 0, r() * 3, 0, rad * (r() < 0.5 ? 1 : 1.6), top + 60, rad), WALLS[Math.floor(r() * WALLS.length)], 'far');
      const rs = Math.floor(r() * 4);
      if (rs === 0) add(GEO.cone8, M(x, top + rad, z, 0, 0, 0, rad * 1.1, rad * 2, rad * 1.1), ROOFS[Math.floor(r() * ROOFS.length)], 'far');
      else if (rs === 1) add(GEO.hemi, M(x, top, z, 0, 0, 0, rad, rad, rad), ROOFS[Math.floor(r() * ROOFS.length)], 'far');
      else if (rs === 2) add(GEO.cyl8, M(x, top + rad * 0.4, z, 0, 0, 0, rad * 0.6, rad * 0.8, rad * 0.6), PAL.copper, 'far');
    }
  }

  // ---------- materials & build ----------
  const mats = {
    enamel: paint(0xffffff, { vertexColors: true, roughness: 0.7, metalness: 0.05, strokeAmt: 0.25, rim: 0.25 }),
    metal: paint(0xffffff, { vertexColors: true, roughness: 0.42, metalness: 0.55, strokeAmt: 0.3, rim: 0.3 }),
    roof: paint(0xffffff, { vertexColors: true, roughness: 0.55, metalness: 0.2, strokeAmt: 0.25, rim: 0.4 }),
    cloth: paint(0xffffff, { vertexColors: true, roughness: 0.85, metalness: 0, strokeAmt: 0.15, rim: 0.5, side: THREE.DoubleSide }),
    glass: paint(0xffffff, { vertexColors: true, roughness: 0.15, metalness: 0.4, strokeAmt: 0.1, rim: 0.6, side: THREE.DoubleSide }),
    far: paint(0xffffff, { vertexColors: true, roughness: 0.8, metalness: 0.0, strokeAmt: 0.2, rim: 0.2 }),
    glow: new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, toneMapped: true }),
  };
  mats.glow.color.setScalar(1.6);
  const meshes = B.build(mats);
  const group = new THREE.Group(); group.name = 'city';
  meshes.forEach(m => group.add(m));
  for (const m of meshes) if (m.userData.bucket === 'far') { m.castShadow = false; m.receiveShadow = false; }
  scene.add(group);

  // ---- animated gears (instanced) ----
  const gearGeo = gearGeometry(14, 1, 0.22);
  const gearMat = paint(0xffffff, { roughness: 0.38, metalness: 0.7, strokeAmt: 0.2, rim: 0.35 });
  const gears = new THREE.InstancedMesh(gearGeo, gearMat, anim.gears.length);
  anim.gears.forEach((g, i) => gears.setColorAt(i, new THREE.Color(g.color).offsetHSL(0, 0, (r() - 0.5) * 0.08)));
  gears.castShadow = true; gears.receiveShadow = true;
  group.add(gears);
  anim.gearMesh = gears;

  return { group, anim, bloomSpots, vineCurves, market, towers, mats, PAL };
}

// Fish-shaped airship (built once, instanced as clones)
export function makeFishShip(scale = 1, hue = 0) {
  const g = new THREE.Group();
  const bodyCol = new THREE.Color(0xd98a6a).offsetHSL(hue, 0, 0);
  const body = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 14), paint(bodyCol, { roughness: 0.5, metalness: 0.2, rim: 0.45 }));
  body.scale.set(2.6, 1.05, 1.0); g.add(body);
  const belly = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 10), paint(0xf2e2c4, { roughness: 0.6, rim: 0.3 }));
  belly.scale.set(2.3, 0.75, 0.82); belly.position.y = -0.35; g.add(belly);
  // scale bands
  for (let i = 0; i < 5; i++) { const t = new THREE.Mesh(new THREE.TorusGeometry(1, 0.05, 6, 28), paint(0xc9a24a, { metalness: 0.7, roughness: 0.35 })); const x = -1.4 + i * 0.7; const rr = Math.sqrt(Math.max(0.05, 1 - (x / 2.6) ** 2)); t.scale.set(rr * 1.02, rr * 1.06, rr * 1.02); t.position.x = x; t.rotation.y = Math.PI / 2; g.add(t); }
  const finMat = paint(0x5f9e94, { roughness: 0.6, rim: 0.5, side: THREE.DoubleSide });
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.9, 1.6, 4, 1), finMat); tail.rotation.z = Math.PI / 2; tail.scale.set(1, 1, 0.12); tail.position.x = -3.1; g.add(tail); g.userData.tail = tail;
  const dorsal = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.2, 3), finMat); dorsal.position.set(0.2, 1.1, 0); dorsal.scale.z = 0.15; dorsal.rotation.z = -0.4; g.add(dorsal);
  for (const s of [-1, 1]) { const f = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.9, 3), finMat); f.position.set(0.9, -0.4, s * 0.95); f.rotation.set(s * 1.2, 0, -1.2); f.scale.z = 0.2; g.add(f); g.userData['fin' + s] = f; }
  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 8), new THREE.MeshBasicMaterial({ color: 0xfff2c0 })); eye.position.set(2.1, 0.2, 0.55); g.add(eye);
  const eye2 = eye.clone(); eye2.position.z = -0.55; g.add(eye2);
  const gond = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.45, 0.6), paint(0x8a5a3c, { roughness: 0.7 })); gond.position.y = -1.15; g.add(gond);
  for (let i = 0; i < 4; i++) { const w = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 0.18), new THREE.MeshBasicMaterial({ color: 0xffd38a, side: THREE.DoubleSide })); w.position.set(-0.5 + i * 0.33, -1.12, 0.31); g.add(w); }
  const prop = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.2, 0.15), paint(0x4a4a55, { metalness: 0.7 })); prop.position.set(-2.4, -0.6, 0); g.add(prop); g.userData.prop = prop;
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; } });
  g.scale.setScalar(scale);
  return g;
}

// Cloud sea + sky cloud billboards
export function buildClouds(scene) {
  const r = mulberry32(99);
  const texs = [0, 1, 2, 3, 4, 5].map(i => cloudTexture(100 + i));
  const group = new THREE.Group();
  const sprites = [];
  const mk = (x, y, z, s, op = 1, tint = 0xffffff) => {
    const m = new THREE.SpriteMaterial({ map: texs[Math.floor(r() * texs.length)], color: tint, transparent: true, opacity: op, depthWrite: false, fog: true });
    const sp = new THREE.Sprite(m); sp.position.set(x, y, z); sp.scale.set(s, s * 0.62, 1); group.add(sp); sprites.push(sp); return sp;
  };
  // the endless cloud ocean below
  for (let i = 0; i < 110; i++) { const a = r() * 6.28, d = 30 + Math.pow(r(), 0.7) * 650; mk(Math.cos(a) * d, -62 - r() * 25 + d * 0.02, Math.sin(a) * d, 70 + r() * 110, 1); }
  // mid-air drifting cumulus between districts
  for (let i = 0; i < 40; i++) { const a = r() * 6.28, d = 45 + r() * 400; mk(Math.cos(a) * d, -30 + r() * 70, Math.sin(a) * d, 25 + r() * 60, 0.9); }
  // grand cumulus towers on the horizon
  for (let i = 0; i < 24; i++) { const a = r() * 6.28, d = 600 + r() * 200; mk(Math.cos(a) * d, 20 + r() * 80, Math.sin(a) * d, 300 + r() * 200, 1); }
  group.renderOrder = -1;
  scene.add(group);
  return { group, sprites };
}

// Gradient painted sky dome with sun glow and wispy streaks
export function buildSky(scene) {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { uSun: G.uSunDir, uTime: G.uTime, uBloom: G.uBloom },
    vertexShader: `varying vec3 vD; void main(){ vD = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position = p.xyww; }`,
    fragmentShader: `
      uniform vec3 uSun; uniform float uTime; uniform float uBloom; varying vec3 vD;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
      float n2(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
      float fbm(vec2 p){ float v=0.0, a=0.5; for(int i=0;i<3;i++){ v+=a*n2(p); p*=2.03; a*=0.5; } return v; }
      void main(){
        vec3 d = normalize(vD);
        float y = d.y;
        vec3 zen = vec3(0.20, 0.36, 0.66), mid = vec3(0.55, 0.62, 0.86), hor = vec3(1.0, 0.78, 0.66), low = vec3(0.95, 0.66, 0.70);
        vec3 c = mix(hor, mid, smoothstep(0.02, 0.28, y)); c = mix(c, zen, smoothstep(0.25, 0.85, y));
        c = mix(c, low, smoothstep(0.02, -0.25, y));
        float s = max(dot(d, normalize(uSun)), 0.0);
        c += vec3(1.0, 0.75, 0.45) * pow(s, 8.0) * 0.55 + vec3(1.0, 0.9, 0.7) * pow(s, 90.0) * 1.6 + vec3(1.0,0.97,0.9)*smoothstep(0.9993,0.9997,s)*4.0;
        // wispy painted streaks
        vec2 uv = d.xz / (y + 0.25) * 1.3 + vec2(uTime*0.004, 0.0);
        float w = fbm(uv * vec2(1.0, 3.5)); w = smoothstep(0.52, 0.8, w) * smoothstep(0.0, 0.3, y) * (1.0 - smoothstep(0.6,0.95,y));
        c = mix(c, vec3(1.0, 0.86, 0.85) + pow(s,4.0)*0.3, w * 0.55);
        // post-bloom: a soft rainbow arc band across the sky
        float ang = acos(clamp(dot(d, normalize(vec3(uSun.x, 0.0, uSun.z))*-1.0), -1.0, 1.0));
        float band = smoothstep(0.08, 0.0, abs(ang - 0.72));
        vec3 rb = 0.5 + 0.5*cos(6.2831*((ang-0.64)/0.16 + vec3(0.0,0.33,0.67)));
        c = mix(c, c + rb*0.35, band * uBloom * smoothstep(-0.05, 0.15, y));
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(5000, 32, 16), mat);
  m.frustumCulled = false; m.renderOrder = -10;
  scene.add(m);
  return m;
}
