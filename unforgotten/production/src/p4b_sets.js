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
  function drawRooftops(t, opt) {
    opt = opt || {};
    setSun(-0.55, 0.45, 0.7, 0.45); setFog('#f0b3a6', 40, 260, 0.85);
    sky(skyDawn);
    plane(0, cloudSea, { maxD: 600 });
    for (const T of HS.towers) { if (Math.abs(T.x + 60) < 30 + T.r || Math.hypot(T.x - CAM.x, T.z - CAM.z) > 380) continue; prism(T.x + 60, T.z + 120, T.r, -10, T.h, T.n, towerWin(3.4, T.seed)); cone(T.x + 60, T.z + 120, T.r * 1.25, T.h, T.cap, T.n, goldRoof); }
    for (const r of RT.roofs) {
      if (r.z1 < CAM.z - 4 || r.z0 > CAM.z + 140) continue;
      box(r.x0, r.y - 14, r.z0, r.x1, r.y, r.z1, (face, u, v, x, y, tt, L) => face === 'top' ? shadeC(R.linen, 2.6 + L * 2.6 + (frac(u / 0.8) < 0.08 || frac(v / 0.8) < 0.08 ? -0.9 : 0), x, y) : towerWin(3, r.seed)(face, u, v, x, y, tt, L));
      if (ih(r.seed, 1, 103) < 0.6) box(r.x0 + 0.8, r.y, r.z0 + 1.5, r.x0 + 1.6, r.y + 1.8, r.z0 + 2.3, flatMat(R.stone, 2.6));         // chimney
      if (ih(r.seed, 2, 103) < 0.4) { prism(r.x1 - 1.5, r.z1 - 2, 0.9, r.y, r.y + 1.6, 6, flatMat(R.wood, 2.6)); cone(r.x1 - 1.5, r.z1 - 2, 1.1, r.y + 1.6, 0.8, 6, flatMat(R.wood, 2)); } // water tank
      // prayer flags strung over the gap to the next roof
      if (ih(r.seed, 3, 103) < 0.7 && r.lane === 0) for (let k = 0; k < 8; k++) { const z = r.z1 - 1 + k * 0.5, sag = Math.sin(k / 7 * PI) * 0.7, x = r.x0 + 0.5 + k * 0.7; const fy = r.y + 3.2 - sag; poly3([[x, fy, z], [x + 0.4, fy, z], [x + 0.2 + Math.sin(t * 6 + k) * 0.1, fy - 0.6, z + 0.05]], () => C([R.crimson, R.gold, R.indigo, R.teal, R.linen][k % 5], 5), { two: true }); }
    }
  }

  // ---------------------------------------------------------------- the harbour ring at the foot of the spire
  const HB = { boats: [], crates: [], posts: [] };
  (function buildHarbour() {
    for (let k = 0; k < 9; k++) HB.boats.push({ x: -40 + k * 11 + ih(k, 1, 111) * 4, z: 18 + ih(k, 2, 111) * 30, len: 6 + ih(k, 3, 111) * 4, rot: ih(k, 4, 111) * 0.6 - 0.3, mast: ih(k, 5, 111) < 0.7, seed: k });
    for (let k = 0; k < 14; k++) HB.crates.push({ x: (k & 1 ? -1 : 1) * (13 + ih(k, 1, 112) * 14), z: -2 + ih(k, 2, 112) * 5, s: 0.8 + ih(k, 3, 112) * 0.5, barrel: ih(k, 4, 112) < 0.4 });
    HB.crates.push({ x: -10.4, z: 2.6, s: 0.9, barrel: true }, { x: -9.6, z: 3.1, s: 0.8, barrel: false });
    for (let k = 0; k < 16; k++) HB.posts.push([-20 + k * 2.6, 4.4]);
  })();
  const waterTex = (lights) => (wx, wz, d, x, y) => {
    const w = Math.sin(wx * 1.3 + T_NOW * 1.6 + Math.sin(wz * 0.7) * 2) + Math.sin(wz * 2.1 - T_NOW * 2.2 + wx * 0.4) * 0.7, n = vn(wx * 3, wz * 6 + T_NOW * 2, 1, 113);
    let s = 2.6 + w * 0.5 + n * 0.8;
    if (lights) for (const L of lights) { const dx = Math.abs(x - L[0]); if (dx < L[2] && y > L[1] && ih(fl(x / 2), y, fl(T_NOW * 8)) < 0.5 * (1 - dx / L[2])) s += 2.5; }
    if (n > 0.86) s += 2;
    return shadeC(R.sea, s, x, y);
  };
  const plankMat = (base) => (face, u, v, x, y, t, L) => { const p = fl(u / 0.35), seam = frac(u / 0.35) < 0.12; return shadeC(R.wood, (base || 2.4) + L * 2.6 + (ih(p, 3, 114) - 0.5) - (seam ? 1.1 : 0), x, y); };
  function drawHarbour(t, opt) {
    opt = opt || {};
    setSun(-0.7, 0.4, 0.6, 0.45); setFog(opt.fogHex || '#f0c9a0', 30, 190, 0.8);
    sky(opt.sky || skyDawn);
    // the city wall rising behind the harbour, and the spire far above
    for (let k = 0; k < 12; k++) box(-90 + k * 15, -2, 70 + ih(k, 1, 115) * 10, -78 + k * 15, 22 + ih(k, 2, 115) * 26, 84, towerWin(2.8, k + 40));
    prism(0, 160, 9, -2, 160, 10, towerWin(4, 1)); cone(0, 160, 11, 160, 26, 10, goldRoof);
    // the lighthouse on the breakwater
    prism(70, 60, 2.6, -1, 22, 8, (f, u, v, x, y, tt, L) => shadeC(fl(v / 3) % 2 ? R.crimson : R.linen, 3 + L * 2.5, x, y)); cone(70, 60, 3, 22, 3, 8, flatMat(R.crimson, 2));
    plane(-0.4, waterTex(opt.lights), { maxD: 400 });
    // the dock: a long pier of planks on posts
    box(-30, -0.4, -4, 30, 0.35, 4, (f, u, v, x, y, tt, L) => f === 'top' ? plankMat(2.6)(f, v, u, x, y, tt, L) : plankMat(1.8)(f, u, v, x, y, tt, L));
    for (const [x, z] of HB.posts) { box(x - 0.18, -3, z - 0.18, x + 0.18, 1.1, z + 0.18, plankMat(1.6)); box(x - 0.18, -3, -z - 0.18, x + 0.18, 1.1, -z + 0.18, plankMat(1.6)); }
    for (const c of HB.crates) {
      if (opt.skipCrate && opt.skipCrate(c)) continue;
      if (c.barrel) { prism(c.x, c.z, c.s * 0.45, 0.35, 0.35 + c.s * 1.1, 8, (f, u, v, x, y, tt, L) => shadeC(R.wood, 2.4 + L * 2.4 - (frac(v / 0.35) < 0.15 ? 1.2 : 0), x, y)); }
      else box(c.x - c.s / 2, 0.35, c.z - c.s / 2, c.x + c.s / 2, 0.35 + c.s, c.z + c.s / 2, (f, u, v, x, y, tt, L) => shadeC(R.wood, 2.8 + L * 2.4 - (frac(u / 0.25) < 0.12 ? 1 : 0) - (u < 0.06 || v < 0.06 || u > c.s - 0.06 || v > c.s - 0.06 ? 1.2 : 0), x, y));
    }
    for (const b of HB.boats) {
      const bob = Math.sin(t * 1.3 + b.seed) * 0.12, ca = Math.cos(b.rot), sa = Math.sin(b.rot), hl = b.len / 2;
      const pt = (u, w, h) => [b.x + ca * u - sa * w, h + bob, b.z + sa * u + ca * w];
      const hull = (f, u, v, x, y, tt, L) => shadeC(b.seed % 3 ? R.wood : R.crimson, 2 + L * 2.6 - (frac(v / 0.3) < 0.15 ? 0.8 : 0), x, y);
      poly3([pt(-hl, -1.2, 0.8), pt(hl, -1.2, 0.8), pt(hl - 1, -0.6, -0.5), pt(-hl + 0.6, -0.6, -0.5)], hull, { two: true });
      poly3([pt(hl, 1.2, 0.8), pt(-hl, 1.2, 0.8), pt(-hl + 0.6, 0.6, -0.5), pt(hl - 1, 0.6, -0.5)], hull, { two: true });
      poly3([pt(hl, -1.2, 0.8), pt(hl + 1.4, 0, 1.0), pt(hl, 1.2, 0.8)], hull, { two: true });
      poly3([pt(-hl, -1.2, 0.8), pt(hl, -1.2, 0.8), pt(hl, 1.2, 0.8), pt(-hl, 1.2, 0.8)], (f, u, v, x, y) => shadeC(R.wood, 3.6 - (frac(u / 0.4) < 0.12 ? 1 : 0), x, y));
      if (b.mast) { const m = pt(0, 0, 0.8), top = [m[0], m[1] + 6, m[2]]; l3(m[0], m[1], m[2], top[0], top[1], top[2], C('wood', 2), 2); poly3([[top[0], top[1] - 0.4, top[2]], [top[0] + ca * 3, top[1] - 1, top[2] + sa * 3], [m[0] + ca * 3.2, m[1] + 1.2, m[2] + sa * 3.2], [m[0], m[1] + 1.2, m[2]]], (f, u, v, x, y, tt) => shadeC(R.linen, 5 + Math.sin(u * 2 + t) * 0.4, x, y), { two: true }); }
    }
  }
  function gulls(t, n, cx, cy, cz, frozen) {
    for (let k = 0; k < n; k++) {
      const tt = frozen === undefined ? t : frozen, a = tt * (0.35 + ih(k, 1, 121) * 0.25) + ih(k, 2, 121) * TAU, r = 8 + ih(k, 3, 121) * 14;
      const x = cx + Math.cos(a) * r, y = cy + ih(k, 4, 121) * 7 + Math.sin(tt * 2 + k) * 0.6, z = cz + Math.sin(a) * r;
      const p = proj(x, y, z); if (!p) continue; const s = Math.max(1, Math.round(CAM.F / p.z * 0.35)), fw = Math.sin(tt * 10 + k * 3);
      for (let i = -s; i <= s; i++) PZ(p.x + i, p.y - Math.abs(i) * fw * 0.6, i === 0 ? C('stone', 5) : WHITE, p.z);
    }
  }

