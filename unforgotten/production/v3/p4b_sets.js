  // ---------------------------------------------------------------- more geometry: prisms, cones
  function prism(cx, cz, r, y0, y1, n, mat, rot) {
    rot = rot || 0;
    for (let k = 0; k < n; k++) {
      const a0 = rot + k / n * TAU, a1 = rot + (k + 1) / n * TAU;
      const p0 = [cx + Math.cos(a0) * r, y0, cz + Math.sin(a0) * r], p1 = [cx + Math.cos(a1) * r, y0, cz + Math.sin(a1) * r];
      const nx = Math.cos((a0 + a1) / 2), nz = Math.sin((a0 + a1) / 2); if (nx * (CAM.x - p0[0]) + nz * (CAM.z - p0[2]) <= 0) continue;
      const L = lightOf(nx, 0, nz);
      poly3([p0, [p0[0], y1, p0[2]], [p1[0], y1, p1[2]], p1], (u, v, x, y, t) => mat('side', v + k * r * 2 * Math.sin(PI / n), u, x, y, t, L), { two: true });
    }
  }
  function cone(cx, cz, r, y0, h, n, mat, rot) {
    rot = rot || 0;
    for (let k = 0; k < n; k++) {
      const a0 = rot + k / n * TAU, a1 = rot + (k + 1) / n * TAU, am = (a0 + a1) / 2;
      const nx = Math.cos(am) * h, ny = r, nz = Math.sin(am) * h, nl = Math.hypot(nx, ny, nz), L = lightOf(nx / nl, ny / nl, nz / nl);
      poly3([[cx + Math.cos(a0) * r, y0, cz + Math.sin(a0) * r], [cx, y0 + h, cz], [cx + Math.cos(a1) * r, y0, cz + Math.sin(a1) * r]], (u, v, x, y, t) => mat('roof', u, v, x, y, t, L), { two: true });
    }
  }
  const whiteStone = (base) => (face, u, v, x, y, t, L) => {
    const row = frac(v / 0.6) < 0.06, joint = frac(u / 1.1 + (fl(v / 0.6) % 2) * 0.5) < 0.04;
    return shadeC(R.linen, (base || 3.6) + L * 3 - (row || joint ? 0.8 : 0), x, y);
  };
  const goldRoof = (face, u, v, x, y, t, L) => shadeC(R.gold, 1.6 + L * 3.4 + (frac(u * 2.5) < 0.12 ? -0.8 : 0), x, y);
  const towerWin = (base, seed) => (face, u, v, x, y, t, L) => {
    const c = whiteStone(base)(face, u, v, x, y, t, L);
    const wu = frac(u / 1.6), wv = frac(v / 3.2), cell = fl(u / 1.6) * 31 + fl(v / 3.2);
    if (wu > 0.38 && wu < 0.62 && wv > 0.35 && wv < 0.8) return ih(cell, seed, 5) < 0.3 ? shadeC(R.gold, 5 + L, x, y) : shadeC(R.night, 2 + L * 1.5, x, y);
    return c;
  };

  // ---------------------------------------------------------------- HALCYON SPIRE: white towers above a sea of dawn cloud
  const HS = { towers: [], bridges: [] };
  (function buildSpire() {
    // the temple at the centre, and rings of towers around it
    HS.towers.push({ x: 0, z: 0, r: 9, h: 95, cap: 26, n: 10, seed: 1, temple: true });
    for (let k = 0; k < 26; k++) {
      const a = k / 26 * TAU + ih(k, 1, 91) * 0.3, d = 34 + ih(k, 2, 91) * 70 + (k % 3) * 18;
      HS.towers.push({ x: Math.cos(a) * d, z: Math.sin(a) * d, r: 3.5 + ih(k, 3, 91) * 4, h: 40 + ih(k, 4, 91) * 55, cap: 8 + ih(k, 5, 91) * 10, n: 8, seed: k + 3 });
    }
    for (let k = 1; k < HS.towers.length; k++) { const a = HS.towers[k], b = k % 4 === 0 ? HS.towers[0] : HS.towers[1 + (k % (HS.towers.length - 1))]; if (a === b) continue; HS.bridges.push([a, b, Math.min(a.h, b.h) * (0.55 + ih(k, 6, 91) * 0.3)]); }
  })();
  function skyDawn(dx, dy, dz, x, y) {
    const el = dy, az = Math.atan2(dx, dz), sunA = 2.4, sd = Math.hypot((az - sunA) * 1.3, (el - 0.04) * 2.2);
    if (sd < 0.035) return C('gold', 7);
    if (sd < 0.05) return C('gold', 6);
    const cl = fbm(az * 50 + T_NOW * 0.4, el * 160, 20, 3, 93);
    let r = el < 0.05 ? R.rose : el < 0.22 ? R.rose : R.violet, s = el < 0.05 ? 6.4 - el * 20 : el < 0.22 ? 5.6 - (el - 0.05) * 14 : 4.2 - (el - 0.22) * 6;
    s += Math.max(0, 0.6 - sd) * 2.5;
    if (cl > 0.6 && el > 0.04 && el < 0.4) { r = R.rose; s = 5.6 + (cl - 0.6) * 4; }
    return shadeC(r, s, x, y);
  }
  const cloudSea = (wx, wz, d, x, y) => {
    const n = fbm(wx * 0.7 + T_NOW * 1.5, wz * 0.7, 26, 4, 95);
    return shadeC(R.rose, 3.4 + n * 4.2 - (d > 220 ? 0 : 0), x, y);
  };
  function drawSpire(t, opt) {
    opt = opt || {};
    setSun(-0.55, 0.35, 0.75, 0.42); setFog('#f0b3a6', 60, 330, 0.85);
    sky(skyDawn);
    plane(0, cloudSea, { maxD: 600 });
    for (const T of HS.towers) {
      const dd = Math.hypot(T.x - CAM.x, T.z - CAM.z); if (dd > 420) continue;
      prism(T.x, T.z, T.r, -10, T.h, T.n, towerWin(T.temple ? 4 : 3.4, T.seed));
      prism(T.x, T.z, T.r * 1.18, T.h, T.h + 1.4, T.n, flatMat(R.gold, 3, 3));
      cone(T.x, T.z, T.r * 1.25, T.h + 1.4, T.cap, T.n, goldRoof);
      if (T.temple) { prism(T.x, T.z, T.r * 1.5, T.h * 0.55, T.h * 0.55 + 2, T.n, flatMat(R.gold, 3, 3)); cone(T.x, T.z, T.r * 1.6, T.h * 0.55 + 2, 5, T.n, goldRoof); }
    }
    for (const [a, b, y] of HS.bridges) {
      const dx = b.x - a.x, dz = b.z - a.z, L = Math.hypot(dx, dz), ux = dx / L, uz = dz / L, px = -uz * 1.3, pz = ux * 1.3;
      const s0 = [a.x + ux * a.r, a.z + uz * a.r], s1 = [b.x - ux * b.r, b.z - uz * b.r];
      poly3([[s0[0] - px, y, s0[1] - pz], [s0[0] + px, y, s0[1] + pz], [s1[0] + px, y, s1[1] + pz], [s1[0] - px, y, s1[1] - pz]], (u, v, x, yy, tt) => shadeC(R.linen, 4.4, x, yy), { two: true });
      poly3([[s0[0] - px, y - 1.2, s0[1] - pz], [s0[0] - px, y, s0[1] - pz], [s1[0] - px, y, s1[1] - pz], [s1[0] - px, y - 1.2, s1[1] - pz]], (u, v, x, yy, tt) => shadeC(R.linen, 3 + (frac(v / 3) < 0.15 ? -1 : 0), x, yy), { two: true });
    }
  }
  function spireBirds(t, n, cx, cy, cz) {
    for (let k = 0; k < n; k++) {
      const a = t * (0.3 + ih(k, 1, 97) * 0.2) + ih(k, 2, 97) * TAU, r = 20 + ih(k, 3, 97) * 30;
      const x = cx + Math.cos(a) * r, y = cy + ih(k, 4, 97) * 20 + Math.sin(t * 2 + k) * 1.5, z = cz + Math.sin(a) * r;
      const p = proj(x, y, z); if (!p) continue; const s = Math.max(1, Math.round(CAM.F / p.z * 0.6)), fw = Math.sin(t * 12 + k * 3) > 0 ? 1 : 0;
      PZ(p.x, p.y, C('night', 2), p.z); for (let i = 1; i <= s; i++) { PZ(p.x - i, p.y - fw * i * 0.6, C('night', 2), p.z); PZ(p.x + i, p.y - fw * i * 0.6, C('night', 2), p.z); }
    }
  }

  // ---------------------------------------------------------------- the upper rooftops of the spire (the chase)
  const RT = { roofs: [] };
  (function buildRoofs() {
    // three lanes of roofs along +z: the courier's in the middle, wardens either side
    for (let lane = -1; lane <= 1; lane++) {
      let z = -20;
      for (let k = 0; k < 22; k++) {
        const len = 7 + ih(k, lane + 5, 101) * 7, gap = lane === 0 ? 2.2 + ih(k, 2, 101) * 1.6 : 1 + ih(k, 3, 101) * 2, y = 30 + Math.sin(k * 0.9 + lane) * 1.6 + ih(k, lane, 102) * 1.2;
        RT.roofs.push({ x0: lane * 9 - 3.2, x1: lane * 9 + 3.2, z0: z, z1: z + len, y, seed: k * 3 + lane, lane });
        z += len + gap;
      }
    }
  })();
  function roofY(lane, z) { for (const r of RT.roofs) if (r.lane === lane && z >= r.z0 - 0.3 && z <= r.z1 + 0.3) return r.y; return null; }
  // the houses of the spire: coloured plaster with brick showing through, shuttered windows, a gold cornice
  const RT_RAMP = [R.linen, R.rose, R.linen, R.gold, R.stone, R.rose];
  const houseSide = (r) => (face, u, v, x, y, tt, L) => {
    const sd = ((r.seed % 6) + 6) % 6, ramp = RT_RAMP[sd], top = 14 - v;
    if (top < 0.32) return shadeC(R.gold, 3.2 + L * 2.4 - (top < 0.07 ? 1.2 : 0), x, y);
    if (top < 0.5) return shadeC(ramp, 1.2 + L * 1.6, x, y);
    const wu = frac(u / 1.8), wv = frac((top - 0.9) / 2.6), cell = fl(u / 1.8) * 31 + fl((top - 0.9) / 2.6);
    if (top > 0.9 && wu > 0.28 && wu < 0.72 && wv > 0.12 && wv < 0.74) {
      if (wu < 0.36 || wu > 0.64) return shadeC(ih(cell, sd, 7) < 0.5 ? R.teal : R.crimson, 2.4 + L * 2.2 - (frac(wv * 6) < 0.15 ? 0.8 : 0), x, y);
      return ih(cell, r.seed, 5) < 0.22 ? shadeC(R.gold, 5 + L, x, y) : shadeC(R.night, 1.8 + L * 1.4 + (wv < 0.25 ? 0.9 : 0), x, y);
    }
    if (top > 0.9 && wu > 0.24 && wu < 0.76 && wv >= 0.74 && wv < 0.8) return shadeC(R.stone, 3.6 + L * 2, x, y);
    const row = frac(v / 0.45) < 0.09, jt = frac(u / 0.9 + (fl(v / 0.45) % 2) * 0.5) < 0.06, patch = vn(u * 0.5, v * 0.5, 2, r.seed + 40) > 0.68;
    if (patch) return shadeC(R.ember, 2.4 + L * 2.2 - (row || jt ? 1 : 0), x, y);
    return shadeC(ramp, 3.4 + L * 2.6 + vn(u, v, 3, r.seed) * 0.7 - (vn(u * 2, v * 0.3, 2, r.seed + 9) > 0.8 ? 0.7 : 0), x, y);
  };
  // ---------------------------------------------------------------- the harbour ring at the foot of the spire
  const HB = { boats: [], crates: [], posts: [], lamps: [-19.5, -7.8, 4.2, 16.0], bollards: [-14.2, -5.6, 9.8, 21.5], perch: [2, 5, 9, 12] };
  (function buildHarbour() {
    for (let k = 0; k < 9; k++) HB.boats.push({ x: -40 + k * 11 + ih(k, 1, 111) * 4, z: 18 + ih(k, 2, 111) * 30, len: 6 + ih(k, 3, 111) * 4, rot: ih(k, 4, 111) * 0.6 - 0.3, mast: ih(k, 5, 111) < 0.7, seed: k, sail: [R.linen, R.rose, R.linen, R.gold, R.crimson][k % 5] });
    for (let k = 0; k < 14; k++) HB.crates.push({ x: (k & 1 ? -1 : 1) * (13 + ih(k, 1, 112) * 14), z: -2 + ih(k, 2, 112) * 5, s: 0.8 + ih(k, 3, 112) * 0.5, barrel: ih(k, 4, 112) < 0.4 });
    HB.crates.push({ x: -10.4, z: 2.6, s: 0.9, barrel: true }, { x: -9.6, z: 3.1, s: 0.8, barrel: false });
    for (let k = 0; k < 16; k++) HB.posts.push([-20 + k * 2.6, 4.4]);
  })();
  // the harbour keeps its own clock, so the Hush can stop the water, the boats and the birds; HWY is the sea's level
  let HT = 0, HWY = -0.4;
  const waterTex = (lights) => (wx, wz, d, x, y) => {
    const T = HT, w = Math.sin(wx * 1.3 + T * 1.6 + Math.sin(wz * 0.7) * 2) + Math.sin(wz * 2.1 - T * 2.2 + wx * 0.4) * 0.7, n = vn(wx * 3, wz * 6 + T * 2, 1, 113);
    let s = 2.6 + w * 0.5 + n * 0.8;
    if (lights) for (const L of lights) { const dx = Math.abs(x - L[0]); if (dx < L[2] && y > L[1] && ih(fl(x / 2), y, fl(T * 8)) < 0.5 * (1 - dx / L[2])) s += 2.5; }
    if (n > 0.86) s += 2;
    // sun glints that wink on and off
    if (d < 70 && n > 0.55 && ih(fl(wx * 4), fl(wz * 7), fl(T * 4 + wx * 0.3)) < 0.03) return d < 26 ? WHITE : C('sea', 7);
    // foam lapping at the piles and along the dock's edge
    if (Math.abs(wx) < 30) {
      const az = Math.abs(wz), lap = 4.06 + 0.1 + Math.sin(wx * 2.3 + T * 2.4) * 0.06;
      if (az > 4.0 && az < lap) return bay(x, y) < 0.6 ? C('sea', 7) : C('hush', 4);
      if (wx > -20.6 && wx < 19.6) { let dx = ((wx + 20) % 2.6 + 2.6) % 2.6; dx = Math.min(dx, 2.6 - dx); const r = Math.hypot(dx, az - 4.4); if (r > 0.2 && r < 0.3 + Math.sin(T * 3 + wx) * 0.04 && bay(x, y) < 0.7) return C('sea', 7); }
    }
    return shadeC(R.sea, s, x, y);
  };
  const plankMat = (base) => (face, u, v, x, y, t, L) => { const p = fl(u / 0.35), seam = frac(u / 0.35) < 0.12; return shadeC(R.wood, (base || 2.4) + L * 2.6 + (ih(p, 3, 114) - 0.5) - (seam ? 1.1 : 0), x, y); };
  // the dock's deck: boards along its length with staggered butt joints, nail heads, and weather in the grain
  const deckMat = (face, u, v, x, y, t, L) => {
    if (face !== 'top') return plankMat(1.6)(face, u, v, x, y, t, L);
    const p = fl(v / 0.32), pv = frac(v / 0.32), off = ih(p, 5, 114) * 3.1, ju = (u + off) / 3.1, jf = frac(ju), id = p * 97 + fl(ju);
    let s = 2.9 + L * 2.2 + (ih(id, 3, 114) - 0.5) * 1.0 + (vn(u * 1.5, v * 10, 1, 116) - 0.5) * 0.7;
    if (pv < 0.1) s -= 1.5;
    else if (jf < 0.02) s -= 1.2;
    else if (t < 22 && (jf < 0.045 || jf > 0.985) && Math.abs(pv - 0.55) < 0.09) return C('stone', 2);
    if (v < 0.25 || v > 7.75) s -= 0.6;                                          // the boards darken where the spray reaches
    return shadeC(R.wood, s, x, y);
  };
  // little props
  function crate3(x, y, z, s) { box(x - s / 2, y, z - s / 2, x + s / 2, y + s, z + s / 2, (f, u, v, xx, yy, tt, L) => shadeC(R.wood, 2.8 + L * 2.4 - (frac(u / 0.22) < 0.12 ? 1 : 0) - (u < 0.06 || v < 0.06 || u > s - 0.06 || v > s - 0.06 ? 1.2 : 0) + (Math.abs(u - v) < 0.05 || Math.abs(u + v - s) < 0.05 ? -0.9 : 0), xx, yy)); }
  function barrel3(x, z, s, y) { y = y === undefined ? DY_H : y; prism(x, z, s * 0.42, y, y + s * 1.05, 8, (f, u, v, xx, yy, tt, L) => shadeC(R.wood, 2.5 + L * 2.4 - (Math.abs(v - s * 0.18) < 0.05 || Math.abs(v - s * 0.85) < 0.05 ? 1.6 : 0) - (frac(u / 0.16) < 0.12 ? 0.6 : 0), xx, yy)); cone(x, z, s * 0.42, y + s * 1.05, 0.001, 8, flatMat(R.wood, 2.2)); }
  const DY_H = 0.35;
  // a rope hung between two points, sagging
  function rope3(a, b, sag, c) { let px = a[0], py = a[1], pz = a[2]; for (let k = 1; k <= 6; k++) { const u = k / 6, x = lerp(a[0], b[0], u), y = lerp(a[1], b[1], u) - Math.sin(u * PI) * sag, z = lerp(a[2], b[2], u); l3(px, py, pz, x, y, z, c); px = x; py = y; pz = z; } }
  function drawHarbour(t, opt) {
    opt = opt || {};
    HT = opt.freeze !== undefined ? Math.min(t, opt.freeze) : t; HWY = opt.waterY === undefined ? -0.4 : opt.waterY;
    const T = HT;
    setSun(-0.7, 0.4, 0.6, 0.45); setFog(opt.fogHex || '#f0c9a0', 30, 190, 0.8);
    sky(opt.sky || skyDawn);
    // the city wall rising behind the harbour, and the spire far above
    for (let k = 0; k < 12; k++) box(-90 + k * 15, -2, 70 + ih(k, 1, 115) * 10, -78 + k * 15, 22 + ih(k, 2, 115) * 26, 84, towerWin(2.8, k + 40));
    prism(0, 160, 9, -2, 160, 10, towerWin(4, 1)); cone(0, 160, 11, 160, 26, 10, goldRoof);
    // the lighthouse on the breakwater
    prism(70, 60, 2.6, -1, 22, 8, (f, u, v, x, y, tt, L) => shadeC(fl(v / 3) % 2 ? R.crimson : R.linen, 3 + L * 2.5, x, y)); cone(70, 60, 3, 22, 3, 8, flatMat(R.crimson, 2));
    if (!opt.keeperGone) glow3(70, 23.5, 60, 2.2, T_GOLD, 0.5);
    plane(HWY, waterTex(opt.lights), { maxD: 400 });
    // the dock: a long pier of planks on posts, a stringer along each side
    box(-30, -0.4, -4, 30, DY_H, 4, deckMat);
    box(-30, -0.25, -4.12, 30, 0.2, -4.0, plankMat(1.2)); box(-30, -0.25, 4.0, 30, 0.2, 4.12, plankMat(1.2));
    for (const [x, z] of HB.posts) { box(x - 0.18, -3, z - 0.18, x + 0.18, 1.1, z + 0.18, plankMat(1.6)); box(x - 0.18, -3, -z - 0.18, x + 0.18, 0.15, -z + 0.18, plankMat(1.6)); }   // the near piles stop under the deck, out of the cameras' way
    // rope rails between the far posts, and a slack line along the near ones
    for (let k = 0; k + 1 < HB.posts.length; k++) { const a = HB.posts[k], b = HB.posts[k + 1]; if (Math.abs(a[0] - CAM.x) > 40) continue; rope3([a[0], 0.98, a[1]], [b[0], 0.98, b[1]], 0.32, C('linen', 3)); }
    // gulls asleep on the post tops
    if (!opt.noGulls) for (const k of HB.perch) { const [x, z] = HB.posts[k], p = proj(x, 1.1, z); if (!p) continue; const s = Math.max(1, Math.round(CAM.F / p.z * 0.09)), hop = (opt.freeze === undefined && ih(k, fl(T * 1.5), 117) < 0.08) ? -s : 0; for (let j = 0; j < s * 2; j++) for (let i = -s * 2; i <= s * 2; i++) if ((i / (2 * s)) ** 2 + ((j - s) / s) ** 2 <= 1) PZ(p.x + i, p.y - j - 1 + hop, j > s * 1.2 ? WHITE : i < -s ? C('stone', 4) : C('hush', 3), p.z - 0.2); for (let i = 0; i <= s; i++) PZ(p.x + s * 2 + i, p.y - s * 1.6 + hop, C('gold', 5), p.z - 0.21); }
    // lamp posts and drying nets along the far edge, iron bollards with coiled lines
    for (const x of HB.lamps) {
      if (Math.abs(x - CAM.x) > 45) continue;
      box(x - 0.06, DY_H, 3.62, x + 0.06, DY_H + 2.5, 3.74, flatMat(R.char, 1.4, 2));
      box(x - 0.06, DY_H + 2.38, 3.62, x + 0.5, DY_H + 2.46, 3.74, flatMat(R.char, 1.4, 2));
      box(x + 0.32, DY_H + 1.98, 3.58, x + 0.58, DY_H + 2.3, 3.78, (f, u, v, xx, yy) => f === 'top' ? C('char', 2) : shadeC(R.ember, 5 + (u > 0.05 && u < 0.27 ? 1.2 : -2), xx, yy));
      glow3(x + 0.45, DY_H + 2.14, 3.68, 0.7, T_GOLD, 0.3);
    }
    for (const x of HB.bollards) {
      if (Math.abs(x - CAM.x) > 45) continue;
      prism(x, 3.45, 0.16, DY_H, DY_H + 0.42, 6, flatMat(R.char, 1.2, 2.4)); prism(x, 3.45, 0.22, DY_H + 0.42, DY_H + 0.5, 6, flatMat(R.char, 1.8, 2.4));
      const p = proj(x + 0.55, DY_H + 0.03, 3.2); if (p) { const r = CAM.F / p.z * 0.22; for (let q = 0; q < 3; q++) ring(p.x, p.y, r - q * 1.2, (r - q * 1.2) * 0.35, C('linen', 3 + (q & 1)), (xx, yy) => ZB[fl(yy) * W + fl(xx)] > p.z - 0.3); }
    }
    { const x0 = -12.8, x1 = -10.6; if (Math.abs(x0 - CAM.x) < 40) {
      box(x0 - 0.05, DY_H, 3.66, x0 + 0.05, DY_H + 1.9, 3.76, flatMat(R.wood, 1.4)); box(x1 - 0.05, DY_H, 3.66, x1 + 0.05, DY_H + 1.9, 3.76, flatMat(R.wood, 1.4));
      poly3([[x0, DY_H + 1.85, 3.7], [x1, DY_H + 1.85, 3.7], [x1, DY_H + 0.5, 3.72], [x0, DY_H + 0.3, 3.72]], (u, v, xx, yy) => { const sag = Math.sin(u / (x1 - x0) * PI) * 0.25; if (v > 1.55 - sag + 0.3) return -1; return frac(u / 0.11 + v * 2.2) < 0.22 || frac(u / 0.11 - v * 2.2) < 0.22 ? C('linen', 3) : -1; }, { two: true });
    } }
    for (const c of HB.crates) {
      if (opt.skipCrate && opt.skipCrate(c)) continue;
      if (Math.abs(c.x - CAM.x) > 60) continue;
      if (c.barrel) barrel3(c.x, c.z, c.s); else crate3(c.x, DY_H, c.z, c.s);
    }
    for (const b of HB.boats) {
      const bob = Math.sin(T * 1.3 + b.seed) * 0.12 + HWY + 0.4, roll = Math.sin(T * 1.1 + b.seed * 2) * 0.03, ca = Math.cos(b.rot), sa = Math.sin(b.rot), hl = b.len / 2;
      const pt = (u, w, h) => [b.x + ca * u - sa * w, h + bob + w * roll, b.z + sa * u + ca * w];
      const hull = (f, u, v, x, y, tt, L) => shadeC(b.seed % 3 ? R.wood : R.crimson, 2 + L * 2.6 - (frac(v / 0.3) < 0.15 ? 0.8 : 0), x, y);
      poly3([pt(-hl, -1.2, 0.8), pt(hl, -1.2, 0.8), pt(hl - 1, -0.6, -0.5), pt(-hl + 0.6, -0.6, -0.5)], hull, { two: true });
      poly3([pt(hl, 1.2, 0.8), pt(-hl, 1.2, 0.8), pt(-hl + 0.6, 0.6, -0.5), pt(hl - 1, 0.6, -0.5)], hull, { two: true });
      poly3([pt(hl, -1.2, 0.8), pt(hl + 1.4, 0, 1.0), pt(hl, 1.2, 0.8)], hull, { two: true });
      poly3([pt(-hl, -1.2, 0.8), pt(hl, -1.2, 0.8), pt(hl, 1.2, 0.8), pt(-hl, 1.2, 0.8)], (f, u, v, x, y) => shadeC(R.wood, 3.6 - (frac(u / 0.4) < 0.12 ? 1 : 0), x, y));
      if (b.mast) {
        const m = pt(0, 0, 0.8), top = [m[0], m[1] + 6, m[2]], luff = Math.sin(T * 2 + b.seed) * 0.15;
        l3(m[0], m[1], m[2], top[0], top[1], top[2], C('wood', 2), 2);
        poly3([[top[0], top[1] - 0.4, top[2]], [top[0] + ca * 3, top[1] - 1, top[2] + sa * 3], [m[0] + ca * 3.2, m[1] + 1.2, m[2] + sa * 3.2 + luff], [m[0], m[1] + 1.2, m[2]]], (f, u, v, x, y) => shadeC(b.sail, 4.6 + Math.sin(u * 2 + T) * 0.4 + (Math.abs(v - 1.4) < 0.25 && b.sail === R.linen ? -2 : 0), x, y), { two: true });
        poly3([[top[0], top[1] - 0.6, top[2]], [m[0] - ca * 2.6, m[1] + 1.0, m[2] - sa * 2.6], [m[0] - ca * 0.2, m[1] + 1.0, m[2] - sa * 0.2]], (f, u, v, x, y) => shadeC(R.linen, 5.4, x, y), { two: true });
        const bw = pt(hl + 1.4, 0, 1.0); l3(top[0], top[1], top[2], bw[0], bw[1], bw[2], C('wood', 2));
        const st = pt(-hl, 0, 0.8); l3(top[0], top[1], top[2], st[0], st[1], st[2], C('wood', 2));
        for (let q = 0; q < 4; q++) { const fx = top[0] - ca * q * 0.25, fy = top[1] + 0.05 + Math.sin(T * 9 + q + b.seed) * 0.05 * q, fz = top[2] - sa * q * 0.25; p3(fx, fy, fz, b.seed & 1 ? C('crimson', 5) : C('teal', 5), 0.12); }
      }
    }
  }
  // gulls wheeling over the water: an M of wings that beats; frozen (a time) holds them in the air
  function gulls(t, n, cx, cy, cz, frozen) {
    for (let k = 0; k < n; k++) {
      const tt = frozen === undefined ? t : Math.min(t, frozen), a = tt * (0.35 + ih(k, 1, 121) * 0.25) + ih(k, 2, 121) * TAU, r = 8 + ih(k, 3, 121) * 14;
      const x = cx + Math.cos(a) * r, y = cy + ih(k, 4, 121) * 7 + Math.sin(tt * 2 + k) * 0.6, z = cz + Math.sin(a) * r;
      const p = proj(x, y, z); if (!p) continue; const s = Math.max(1.5, CAM.F / p.z * 0.32), fw = Math.sin(tt * (7 + ih(k, 5, 121) * 3) + k * 3), dir = Math.sin(a) > 0 ? -1 : 1;
      const ey = -fw * s * 0.35, ty = fw * s * 0.45;
      for (const sd of [-1, 1]) { lineF(p.x, p.y, p.x + sd * s * 0.5, p.y + ey, (xx, yy) => PZ(xx, yy, WHITE, p.z)); lineF(p.x + sd * s * 0.5, p.y + ey, p.x + sd * s, p.y + ty, (xx, yy, u) => PZ(xx, yy, u > 0.6 ? C('stone', 3) : C('hush', 4), p.z)); }
      PZ(p.x, p.y + 1, C('hush', 2), p.z); if (s > 3) { PZ(p.x + dir, p.y, WHITE, p.z); PZ(p.x + dir * 2, p.y, C('gold', 5), p.z); }
    }
  }
