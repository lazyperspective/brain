'use strict';
// ---------- camera, orchard layout and gnarled apple-tree skeletons ----------
// Design space is 1080 x 1350 ("D" units); K scales to pixels (K = 2 for the 4K output).
const CAM = { YH: 650, VPX: 650, F: 800, H: 1.9 };
const HOUSE = { X: 1.7, Z: 36 };

function proj(X, Y, Z) {
  const s = CAM.F / Z;
  return [CAM.VPX + X * s, CAM.YH + (CAM.H - Y) * s, s];
}

function buildTrees(seed) {
  const r = new RNG(seed);
  const trees = [];
  const add = (X, Z, o) => trees.push(Object.assign({ X, Z, seed: r.int(1, 1e9) }, o));
  // hero trees that frame the picture
  add(-2.75, 3.9, { hero: 1, trunkH: 1.25, spread: 2.6, lean: 0.10, leanAz: 2.6, apples: 6 });
  add(3.35, 6.3, { hero: 2, trunkH: 1.05, spread: 2.45, lean: 0.14, leanAz: 0.4, apples: 6 });
  // inner rows beside the aisle
  let z = 9.0;
  while (z < 44) { add((z > 25 ? -4.3 : -3.45) + r.range(-0.3, 0.3), z + r.range(-0.5, 0.5), { apples: z < 22 ? r.int(1, 3) : 0, spread: z > 25 ? 1.7 : undefined }); z += r.range(4.3, 5.0); }
  z = 10.6;
  while (z < 34.5) { add((z > 25 ? 4.4 : 3.55) + r.range(-0.3, 0.3), z + r.range(-0.5, 0.5), { apples: z < 22 ? r.int(1, 3) : 0, spread: z > 25 ? 1.7 : undefined }); z += r.range(4.3, 5.0); }
  z = 49;
  while (z < 110) { add(-3.4 + r.range(-0.3, 0.3), z + r.range(-0.8, 0.8), {}); add(3.5 + r.range(-0.3, 0.3), z + 3 + r.range(-0.8, 0.8), {}); z += r.range(5, 6.4); }
  // outer rows
  z = 4.6; while (z < 120) { add(-9.3 + r.range(-0.6, 0.6), z + r.range(-0.6, 0.6), { apples: z < 18 ? r.int(0, 2) : 0 }); z += r.range(4.5, 5.5) * (1 + z / 90); }
  z = 6.9; while (z < 120) { add(9.2 + r.range(-0.6, 0.6), z + r.range(-0.6, 0.6), { apples: z < 18 ? r.int(0, 2) : 0 }); z += r.range(4.5, 5.5) * (1 + z / 90); }
  z = 9; while (z < 150) { add(-15.5 + r.range(-1, 1), z + r.range(-0.8, 0.8), {}); z += r.range(5, 6.5) * (1 + z / 80); }
  z = 12; while (z < 150) { add(15.8 + r.range(-1, 1), z + r.range(-0.8, 0.8), {}); z += r.range(5, 6.5) * (1 + z / 80); }
  z = 16; while (z < 180) { add(-22.5 + r.range(-1.5, 1.5), z + r.range(-1, 1), {}); add(23 + r.range(-1.5, 1.5), z + 4 + r.range(-1, 1), {}); z += r.range(6, 8) * (1 + z / 80); }
  z = 28; while (z < 200) { add(-31 + r.range(-2, 2), z, {}); add(32 + r.range(-2, 2), z + 5, {}); z += r.range(8, 11) * (1 + z / 90); }
  for (const t of trees) {
    if (t.trunkH === undefined) t.trunkH = r.range(0.9, 1.55);
    if (t.spread === undefined) t.spread = r.range(1.9, 2.5);
    if (t.lean === undefined) t.lean = r.range(0.0, 0.2);
    if (t.leanAz === undefined) t.leanAz = r.range(0, 6.283);
    if (t.apples === undefined) t.apples = 0;
  }
  trees.sort((a, b) => b.Z - a.Z);
  return trees;
}

function norm3(v) { const l = Math.hypot(v[0], v[1], v[2]) || 1; v[0] /= l; v[1] /= l; v[2] /= l; return v; }

// Returns array of branches: {order, pts:[{x,y,z,r}]} in local metres (y up).
function genTree(t) {
  const rng = new RNG(t.seed);
  const B = [];
  const Zc = t.Z;
  // level of detail by distance
  const step = Zc < 14 ? 0.2 : Zc < 30 ? 0.3 : Zc < 60 ? 0.45 : 0.8;
  const maxOrder = Zc < 14 ? 5 : Zc < 30 ? 4 : Zc < 60 ? 3 : 2;
  const minR = Zc < 14 ? 0.0045 : Zc < 30 ? 0.007 : Zc < 60 ? 0.01 : 0.02;
  const dens = Zc < 14 ? 1 : Zc < 30 ? 0.85 : 0.7;
  const pSp = [0.0, 0.7, 0.85, 0.8, 0.65, 0.5];
  function grow(pos, dir, len, r0, r1, order, gnarl, up) {
    const n = Math.max(2, Math.round(len / step));
    const ds = len / n;
    let x = pos[0], y = pos[1], z = pos[2];
    let d = norm3(dir.slice());
    const pts = [];
    const ph = rng.range(0, 6.28), tw = [rng.gauss() * 0.03, 0, rng.gauss() * 0.03];
    const bend = rng.gauss() * 0.05;
    for (let i = 0; i <= n; i++) {
      const tt = i / n;
      const r = (r0 + (r1 - r0) * Math.pow(tt, 0.85)) * (1 + 0.1 * Math.sin(i * 1.9 + ph));
      pts.push({ x, y, z, r: Math.max(r, minR) });
      if (i === n) break;
      if (Zc < HOUSE.Z + 2 && i > 0) { // keep the farmhouse window clear of near branches
        const Zp = Math.max(1.4, Zc + z), s0 = CAM.F / Zp;
        const sx = CAM.VPX + (t.X + x) * s0, sy = CAM.YH + (CAM.H - y) * s0;
        if (sx > 560 && sx < 810 && sy > 500 && sy < 745 && Zp < HOUSE.Z - 2) break;
      }
      d[0] += rng.gauss() * gnarl + tw[0] + bend; d[1] += rng.gauss() * gnarl * 0.8 + up * (0.02 + 0.05 * tt); d[2] += rng.gauss() * gnarl + tw[2];
      if (y < 0.7 && d[1] < 0) d[1] = -d[1] * 0.5 + 0.1;
      norm3(d);
      x += d[0] * ds; y += d[1] * ds; z += d[2] * ds;
      if (order < maxOrder && tt > 0.1 && i < n - 1 && rng.next() < pSp[order] * dens * (ds / 0.22) * (order >= 3 ? 1.0 : 1)) {
        // spawn a child
        const th = rng.range(0.55, 1.2);
        let u = norm3([-d[2], 0.0001, d[0]]);
        const v = [d[1] * u[2] - d[2] * u[1], d[2] * u[0] - d[0] * u[2], d[0] * u[1] - d[1] * u[0]];
        const ph2 = rng.range(0, 6.283);
        const sa = Math.sin(th), ca = Math.cos(th);
        const c = [d[0] * ca + (u[0] * Math.cos(ph2) + v[0] * Math.sin(ph2)) * sa,
                   d[1] * ca + (u[1] * Math.cos(ph2) + v[1] * Math.sin(ph2)) * sa,
                   d[2] * ca + (u[2] * Math.cos(ph2) + v[2] * Math.sin(ph2)) * sa];
        c[1] += (order <= 2 ? 0.2 : 0.1);
        if (c[1] < -0.2) c[1] = -c[1] * 0.6;
        norm3(c);
        const lenC = len * rng.range(0.3, 0.62) * (order === 1 ? 1.1 : 1) * (1 - 0.1 * order);
        const rc0 = Math.max(minR * 1.2, r * rng.range(0.5, 0.7));
        grow([x, y, z], c, Math.max(lenC, 0.25), rc0, Math.max(minR, rc0 * 0.3), order + 1, gnarl * 1.1, 0.5);
      }
    }
    B.push({ order, pts });
  }
  // trunk
  const lean = t.lean, az = t.leanAz;
  const r0 = rng.range(0.17, 0.25) * (t.hero ? 1.15 : 1);
  const tdir = [Math.cos(az) * lean, 1, Math.sin(az) * lean];
  // trunk grows as one branch but we add limb forks from its top
  const trunkTop = [0, 0, 0];
  {
    const n = Math.max(3, Math.round(t.trunkH / step));
    let x = 0, y = 0, z = 0; const d = norm3(tdir.slice());
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const tt = i / n;
      const flare = 1 + 0.55 * Math.pow(1 - tt, 5);
      pts.push({ x, y, z, r: r0 * (1 - 0.25 * tt) * flare * (1 + 0.06 * Math.sin(i * 2.3)) });
      if (i === n) break;
      d[0] += rng.gauss() * 0.07; d[2] += rng.gauss() * 0.07; d[1] += 0.01; norm3(d);
      x += d[0] * t.trunkH / n; y += d[1] * t.trunkH / n; z += d[2] * t.trunkH / n;
    }
    trunkTop[0] = x; trunkTop[1] = y; trunkTop[2] = z;
    B.push({ order: 0, pts });
  }
  const nl = t.hero ? 5 : rng.int(3, 5);
  const az0 = rng.range(0, 6.283);
  for (let i = 0; i < nl; i++) {
    const a = az0 + i * 6.283 / nl + rng.range(-0.4, 0.4);
    const el = rng.range(0.8, 1.4); // angle from vertical
    const dir = [Math.sin(el) * Math.cos(a), Math.cos(el) * 0.9 + 0.1, Math.sin(el) * Math.sin(a)];
    const fy = trunkTop[1] - rng.range(0, 0.25);
    const len = t.spread * rng.range(0.95, 1.4);
    const rr = r0 * rng.range(0.55, 0.72);
    grow([trunkTop[0], fy, trunkTop[2]], dir, len, rr, Math.max(minR * 2, rr * 0.28), 1, 0.17, 0.9);
  }
  // a couple of upright water sprouts from the trunk top
  const ns = Zc < 30 ? 2 : 1;
  for (let i = 0; i < ns; i++) {
    const dir = [rng.gauss() * 0.25, 1, rng.gauss() * 0.25];
    grow([trunkTop[0], trunkTop[1] - 0.1, trunkTop[2]], dir, t.spread * rng.range(0.7, 1.1), r0 * 0.3, minR * 2, 2, 0.05, 0.4);
  }
  return B;
}
