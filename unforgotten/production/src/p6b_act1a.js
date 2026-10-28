  /* ================================================================ ACT ONE (a) — Halcyon Spire: the vault, the window, the chase, the edge, the fall */
  function card(t0, t, title, sub, x, y) {
    const a = lin(t0, t0 + 0.4, t); if (a <= 0) return;
    const nv = fl((t - t0) * 30);
    text(title, x, y, C('linen', 7), 2, C('night', 0), nv);
    if (sub) text(sub, x, y + 20, C('gold', 6), 1, C('night', 0), Math.max(0, nv - title.length));
  }

  // 15 — HALCYON SPIRE: rising out of the clouds and gliding between the towers toward the temple (1:33)
  shot(93.0, 104.0, (lt, t) => {
    const u = eio(lt / 11);
    lookAt(lerp(-150, -46, u), lerp(8, 92, u), lerp(-260, -96, u), lerp(-30, 0, u), lerp(30, 84, u), lerp(-60, 0, u), 56);
    drawSpire(t); ink(2, 160);
    spireBirds(t, 26, lerp(-120, -30, u), lerp(20, 80, u), lerp(-200, -80, u));
    // the bells: a ripple of light from the temple belfry when they toll
    for (const bt of [96.5, 99.5, 102.5]) { const g = t - bt; if (g > 0 && g < 2) { const p = proj(0, 62, 0); if (p) shockRing(p.x, p.y, 8 + g * 160 * CAM.F / p.z / 3, (8 + g * 160 * CAM.F / p.z / 3) * 0.4, 2, [C('gold', 7), C('gold', 5), C('rose', 5)], 1 - g / 2); } }
    card(95.2, t, 'HALCYON SPIRE', 'THE CITY ABOVE THE CLOUDS · NOW', 22, 36);
  });

  // ---------------------------------------------------------------- the temple vault: pillars, an empty pedestal, a stained-glass window
  const VLT = { pillars: [[-6, 6], [6, 6], [-6, 14], [6, 14], [-6, 22], [6, 22]] };
  const stained = (u, v, x, y, broken) => {
    // u across (0..6), v up (0..12): an arched window of coloured panes and lead
    const cx = u - 3, top = 8 + Math.sqrt(Math.max(0, 9 - cx * cx)) * 1.3; if (v > top) return -1;
    if (broken) return Math.abs(cx) > 2.7 || v < 0.4 || v > top - 0.4 ? C('stone', 5) : -2;
    const lead = Math.abs(frac(u / 1.5) - 0.5) > 0.44 || Math.abs(frac(v / 1.8) - 0.5) > 0.43 || Math.abs(Math.hypot(cx, v - 6) - 2.4) < 0.12 || Math.abs(Math.hypot(cx, v - 6) - 4.2) < 0.12;
    if (lead) return C('night', 1);
    const cell = fl(u / 1.5) * 7 + fl(v / 1.8) + (Math.hypot(cx, v - 6) < 2.4 ? 50 : 0), r = [R.indigo, R.gold, R.crimson, R.teal, R.violet][fl(ih(cell, 1, 301) * 5)];
    return shadeC(Math.hypot(cx, v - 6) < 2.4 ? R.gold : r, 4.6 + ih(cell, 2, 301) * 1.6 + (v / top) * 0.6, x, y);
  };
  function drawVault(t, opt) {
    opt = opt || {};
    setSun(0.2, 0.5, -0.8, 0.3); setFog('#1b2160', 14, 60, 0.6);
    sky(() => C('night', 1));
    // the floor: white and gold tiles in a sunburst
    plane(0, (wx, wz, d, x, y) => { const a = Math.atan2(wx, wz - 14), r = Math.hypot(wx, wz - 14), ray_ = fl(a / TAU * 24 + 24) % 2, ring_ = fl(r / 1.6); return shadeC(ray_ ^ (ring_ & 1) ? R.linen : R.gold, 2.4 + (ray_ ? 0.6 : 0) + (frac(r / 1.6) < 0.06 ? -1 : 0) + Math.max(0, 2 - Math.abs(wx) * 0.4) * (wz > 18 ? 0.6 : 0), x, y); });
    const wallM = (u, v, x, y) => shadeC(R.indigo, 1.4 + (frac(v / 2.2) < 0.06 || frac(u / 3) < 0.04 ? -0.9 : 0) + vn(u, v, 1.5, 302) * 0.6, x, y);
    poly3([[-10, 0, 0], [-10, 14, 0], [-10, 14, 26], [-10, 0, 26]], (u, v, x, y) => wallM(v, u, x, y), { two: true });
    poly3([[10, 0, 26], [10, 14, 26], [10, 14, 0], [10, 0, 0]], (u, v, x, y) => wallM(v, u, x, y), { two: true });
    poly3([[-10, 0, 26], [-10, 14, 26], [10, 14, 26], [10, 0, 26]], (u, v, x, y) => { const g = stained(v - 7, u - 1.5, x, y, opt.broken); if (g === -2) return C('rose', 6); if (g >= 0 && v > 7 && v < 13) return g; return wallM(v, u, x, y); }, { two: true });
    poly3([[-10, 14, 0], [10, 14, 0], [10, 14, 26], [-10, 14, 26]], (u, v, x, y) => shadeC(R.indigo, 0.8 + (frac(u / 2) < 0.08 ? -0.8 : 0), x, y), { two: true });
    for (const [px, pz] of VLT.pillars) { prism(px, pz, 0.9, 0, 14, 8, (f, u, v, x, y, tt, L) => shadeC(R.linen, 2 + L * 3 + (frac(u / 0.6) < 0.15 ? -0.8 : 0), x, y)); prism(px, pz, 1.2, 0, 0.8, 8, flatMat(R.gold, 2.4, 3)); prism(px, pz, 1.2, 13.2, 14, 8, flatMat(R.gold, 2.4, 3)); }
    // the pedestal and its smashed glass case
    prism(0, 14, 1.4, 0, 1.4, 8, flatMat(R.gold, 2.2, 3)); prism(0, 14, 1.0, 1.4, 2.6, 8, (f, u, v, x, y) => (ih(fl(u * 6), fl(v * 6), 303) < 0.6 ? -1 : C('teal', 6)));
    for (let k = 0; k < 24; k++) p3((ih(k, 1, 304) - 0.5) * 3.2, 0.05, 14 + (ih(k, 2, 304) - 0.5) * 3.2, ih(k, 3, 304) < 0.5 ? C('teal', 7) : WHITE, 0.08);
  }
  // shafts of coloured light from the window into the dusty air
  function vaultShafts(t, a) {
    const top = proj(0, 11, 26); if (!top) return;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x; const d = ray(x + 0.5, y + 0.5); const p = worldAt(i, x, y);
      if (p[2] > 25.5) continue;
      const along = (26 - p[2]) / 26, off = Math.abs(p[0]) - 2.6 - along * 2, hy = 11 - along * 9 - p[1];
      if (off < 0 && Math.abs(hy) < 2 + along * 2) tintI(i, x, y, T_GOLD, a * 0.35 * (1 - along) * (1 - Math.abs(hy) / (2 + along * 2)));
    }
    for (let k = 0; k < 40; k++) { const u = frac(ih(k, 1, 305) + t * 0.03), x = (ih(k, 2, 305) - 0.5) * 5, y = 2 + ih(k, 3, 305) * 9, z = 4 + u * 20; p3(x, y + Math.sin(t + k) * 0.2, z, C('gold', 7), 0.03); }
  }

  // 16 — the vault: the alarm, an empty pedestal, the wardens (1:44)
  shot(104.0, 112.0, (lt, t) => {
    if (lt < 3.0) {
      lookAt(-2.4 + lt * 0.4, 2.6, -1.5 + lt * 0.6, 0, 1.8, 14, 60);
      drawVault(t); ink(2);
      // wardens running in from behind the camera
      for (let k = 0; k < 3; k++) { const z = lerp(4, 11 + k * 0.8, eoc(lin(0.2 + k * 0.25, 1.8 + k * 0.2, lt))); actor3('warden', { view: 'back', run: z < 10 ? t * 16 + k : undefined, spear: -1.4, captain: false }, -1.6 + k * 1.6, 0, z, { dark: 1, rim: { side: 1, T: T_GOLD, a: 0.35 } }); }
      vaultShafts(t, 1);
      actor3('warden', { view: 'side', spear: -1.3, eyes: 'open', mouth: mouth('warden', t) }, 1.4, 0, 12.6, { flip: true, dark: 1 });
    } else {
      // OREN, close, turning from the empty case
      const u = lt - 3.0;
      lookAt(5.4, 2.0, 7.4, 2.8, 1.5, 11.4, 44);
      drawVault(t); ink(2); vaultShafts(t, 1);
      actor3('warden', { view: u < 0.6 ? 'side' : 'front', captain: true, spear: -1.5, eyes: 'narrow', brows: 'angry', mouth: mouth('oren', t) }, 2.8, 0, 11.4, { flip: true, dark: 1, rim: { side: -1, T: T_GOLD, a: 0.6 } });
    }
    // the alarm: a pulse of red through the hall
    tintAll(T_RED, (0.5 + 0.5 * Math.sin(t * 9)) * 0.12);
  });

  // ---------------------------------------------------------------- the temple facade with its great window
  const GLASS0 = 113.0;
  // slow motion: shot time → story time
  const slowmo = (lt) => (lt < 1.0 ? lt : lt < 4.0 ? 1.0 + (lt - 1.0) * 0.12 : 1.36 + (lt - 4.0) * 1.0);
  function drawFacade(t, broken) {
    setSun(-0.55, 0.45, 0.7, 0.45); setFog('#f0b3a6', 40, 260, 0.85);
    sky(skyDawn);
    plane(0, cloudSea, { maxD: 600 });
    for (const T of HS.towers.slice(1, 14)) { prism(T.x + 40, T.z + 90, T.r, -10, T.h, T.n, towerWin(3.4, T.seed)); cone(T.x + 40, T.z + 90, T.r * 1.25, T.h, T.cap, T.n, goldRoof); }
    // the temple wall (front face at z = 0) and a lower roof in front of it
    box(-24, 0, 0, 24, 62, 6, (f, u, v, x, y, tt, L) => {
      if (f === 's') { const g = stained(u - 21, v - 33, x, y, broken); if (g === -2) return C('violet', 1); if (g >= 0 && u > 21 && u < 27 && v > 33) return g; }
      return whiteStone(3.6)(f, u, v, x, y, tt, L);
    });
    box(-22, 31.6, -0.6, 22, 32.2, 0, flatMat(R.gold, 2.6, 3));
    box(-14, 18, -26, 14, 30, -1, (f, u, v, x, y, tt, L) => f === 'top' ? shadeC(R.linen, 2.8 + L * 2.4 + (frac(u / 0.8) < 0.08 || frac(v / 0.8) < 0.08 ? -0.9 : 0), x, y) : towerWin(3, 9)(f, u, v, x, y, tt, L));
  }
  // 17 — the window bursts; Kaira, in slow motion, and her card; then she lands and runs (1:52)
  shot(112.0, 122.0, (lt, t) => {
    const g = t - GLASS0, st = slowmo(Math.max(0, g)), broken = g > 0;
    const freeze = g > 1.9 && g < 3.9;
    const fo = sstep(-0.2, 1.0, g), ru = sstep(4.2, 7.5, g);
    const kxr = -2.2 - Math.max(0, slowmo(Math.max(0, g)) - 2.2) * 6;
    lookAt(lerp(6.0, 4.0, fo) + (kxr + 2.2) * ru * 0.8, lerp(31.0, 31.4, fo), lerp(-18, -13.5, fo), lerp(0, -1.8, fo) + (kxr + 2.2) * ru, lerp(37.2, 31.6, fo), lerp(-0.5, -6.5, fo), lerp(60, 50, fo));
    drawFacade(t, broken);
    ink(2);
    // Kaira's arc out of the window to the roof
    let kx = 0, ky = 37, kz = 0.5, ka = 0, view = 'side';
    if (g > 0) {
      const u = clamp(st / 1.7, 0, 1);
      kx = lerp(0, -2.2, u); kz = lerp(-0.6, -7, u); ky = lerp(36.4, 30, u) + Math.sin(u * PI) * 2.4; ka = -u * TAU * 0.75;
      if (st > 1.7) { const r = st - 1.7; kz = -7; ky = 30; ka = r < 0.4 ? -PI * 1.5 - r * 4 : 0; kx = -2.2 - Math.max(0, r - 0.5) * 6; }
    }
    const fx = (sx) => sx;
    if (g > 0) {
      const ruN = st > 2.1;
      actor3('kaira', { view: ruN ? 'side' : 'side', run: ruN ? t * 18 : undefined, air: !ruN && st < 1.7, crouch: st > 1.7 && st < 2.2 ? 1 : 0, blade: 2.2, blade2: 2.6, seed: 0.6, wind: 4, eyes: 'narrow', brows: 'angry', armF: ruN ? 1.4 : -0.6 }, kx, ky, kz, { flip: st < 1.7, ang: ka, size: 1.25 });
    }
    // the glass: a burst of coloured shards toward the camera
    if (g > 0) for (let k = 0; k < 160; k++) {
      const vx = (ih(k, 1, 311) - 0.5) * 10, vy = (ih(k, 2, 311) - 0.2) * 7, vz = -(4 + ih(k, 3, 311) * 14), tt = st * 1.1;
      const x = (ih(k, 4, 311) - 0.5) * 5 + vx * tt, y = 37 + (ih(k, 5, 311) - 0.5) * 7 + vy * tt - 6 * tt * tt, z = -0.4 + vz * tt;
      const p = proj(x, y, z); if (!p || p.z < 0.5) continue;
      const s = Math.min(6, Math.max(1, CAM.F / p.z * 0.18)), a = ih(k, 6, 311) * TAU + tt * (3 + ih(k, 7, 311) * 6), col = [C('indigo', 6), C('gold', 6), C('crimson', 6), C('teal', 6), WHITE][k % 5];
      shard(p.x, p.y, Math.round(s), a, col, WHITE);
    }
    if (g > 0 && g < 0.12) { flashWhite(0.5 * (1 - g / 0.12)); shk(4); }
    // the freeze-frame card
    if (freeze) {
      tintAll(T_DARK, 0.35);
      const a = lin(1.9, 2.15, g);
      for (let y = 150; y < 206; y++) for (let x = 0; x < W; x++) { const xx = x - (y - 150) * 0.6; if (xx > 30 && xx < 30 + 420 * a) BUF[y * W + x] = y < 153 || y > 202 ? C('gold', 5) : shadeC(R.indigo, 2.4 + (xx % 40 < 20 ? 0.3 : 0), x, y); }
      text('KAIRA', 70, 158, C('gold', 6), 4, C('night', 0), fl((g - 1.95) * 30));
      text('COURIER OF THE SKY TEMPLE', 74, 192, C('linen', 7), 1, undefined, fl((g - 2.2) * 40));
    }
    if (g > 3.9 && g < 4.0) whip(60, 0);
  });

  // ---------------------------------------------------------------- the chase along the rooftops
  const K_RUN = 9.5;                                      // metres per second
  // the courier's path: run along lane 0, jumping every gap
  function kairaAt(t0, t) {
    const z = 2 + (t - t0) * K_RUN; let y = roofY(0, z);
    if (y === null) { // in a gap: an arc from the end of one roof to the start of the next
      let a = null, b = null; for (const r of RT.roofs) if (r.lane === 0) { if (r.z1 <= z && (!a || r.z1 > a.z1)) a = r; if (r.z0 >= z && (!b || r.z0 < b.z0)) b = r; }
      if (a && b) { const u = (z - a.z1) / (b.z0 - a.z1); y = lerp(a.y, b.y, u) + Math.sin(u * PI) * 1.6; } else y = 30;
      return { z, y, air: true };
    }
    return { z, y, air: false };
  }
  // pursuers on the side lanes
  function wardensChase(t, t0, n, side) {
    for (let k = 0; k < n; k++) {
      const lane = k % 2 ? 1 : -1, z = 2 + (t - t0) * K_RUN - 5 - k * 3.2, y = roofY(lane, z);
      const yy = y === null ? 30 + Math.sin(frac(z / 9) * PI) * 1.2 : y;
      actor3('warden', { view: side || 'back', run: t * 15 + k, spear: -1.1, captain: k === 0 }, lane * 9, yy, z, {});
    }
  }
  // 18 — behind her: "framed, chased, and glowing" (2:02)
  const CH0 = 118.0;
  shot(122.0, 131.0, (lt, t) => {
    const k = kairaAt(CH0, t);
    lookAt(0.6, k.y + 2.2, k.z - 5.2, 0, k.y + 1.0, k.z + 6, 64);
    drawRooftops(t); ink(2);
    wardensChase(t, CH0, 4);
    actor3('kaira', { view: 'back', run: k.air ? undefined : t * 19, air: k.air, wind: 5, seed: 0.5 + 0.3 * Math.sin(t * 6) }, 0, k.y, k.z, {});
    streaks(PI / 2, 26, t, 1600, C('linen', 7), 40, 321, [0, LB, W, H - 2 * LB]);
  });
  // 19 — in front of her, running at us: "I don't HAVE it!" — the chest glows — a spear — the step (2:11)
  shot(131.0, 140.0, (lt, t) => {
    const k = kairaAt(CH0, t), dodge = lin(136.3, 136.5, t), seedA = sstep(132.8, 133.6, t);
    const kx = -1.6 * eoc(dodge);
    lookAt(-0.4, k.y + 1.3, k.z + 5.4, -0.2, k.y + 0.9, k.z, 58);
    drawRooftops(t); ink(2);
    wardensChase(t, CH0, 4, 'front');
    const after = dodge > 0 && dodge < 1 || (t > 136.3 && t < 136.8) ? [[proj(0, k.y, k.z) || { x: 0, y: 0 }]].map((q) => [q.x, q.y, C('gold', 6), 0.5]) : undefined;
    const kk = actor3('kaira', { view: 'front', run: k.air ? undefined : t * 19, air: k.air, wind: 2, seed: 0.4 + seedA * 0.6, eyes: t > 133 && t < 136 ? 'half' : 'wide', brows: t > 133.4 && t < 136 ? 'worried' : 'n', look: 0, mouth: mouth('kaira', t), smile: t > 134.3 && t < 136 ? -0.5 : 0 }, kx, k.y, k.z, { after });
    if (kk && seedA > 0) { glow(kk.chest[0], kk.chest[1], 30 * kk.S / 3 * (0.7 + 0.3 * Math.sin(t * 8)), T_GOLD, 0.55 * seedA); }
    // the spear
    if (t > 135.8 && t < 136.9) { const u = (t - 135.8) / 1.1, sz = k.z - 12 + u * 20, sx = lerp(-1, -0.2, u); l3(sx, k.y + 1.2, sz, sx, k.y + 1.25, sz + 2.2, C('wood', 4), 2); l3(sx, k.y + 1.25, sz + 2.2, sx, k.y + 1.26, sz + 2.8, C('stone', 7), 2); for (let c = 0; c < 8; c++) p3(sx, k.y + 1.2 + Math.sin(c + t * 20) * 0.08, sz - c * 0.35, C('stone', 6), 0.05); }
    if (dodge > 0 && dodge < 1) { for (let q = 0; q < 3; q++) { const p = proj(lerp(0, kx, q / 3), k.y + 0.8, k.z); if (p) { sparkle(p.x, p.y - q * 6, 6, WHITE, C('gold', 6)); } } shk(2); }
    if (t > 136.3 && t < 136.9) { const p = proj(kx, k.y + 0.8, k.z); if (p) for (let b = 0; b < 3; b++) lineF(p.x, p.y, p.x + (ih(b, fl(t * 30), 323) - 0.5) * 80, p.y + (ih(b, fl(t * 30) + 1, 323) - 0.5) * 60, (x, y) => P(x, y, C('gold', 7))); }
  });
  // 20 — the wide side view: three lanes, the clouds, a big spinning leap (2:20)
  shot(140.0, 148.0, (lt, t) => {
    const k = kairaAt(CH0, t);
    lookAt(21, k.y + 9.5, k.z - 1, 0, k.y + 0.6, k.z + 3, 46);
    drawRooftops(t); ink(2);
    wardensChase(t, CH0, 6, 'side');
    const spin = lin(142.6, 143.6, t);
    actor3('kaira', { view: 'side', run: k.air ? undefined : t * 19, air: k.air, wind: 5, blade: spin > 0 && spin < 1 ? -0.6 + spin * 4 : 2.0, blade2: 2.5, storm: spin > 0 && spin < 1, eyes: 'narrow', brows: 'angry' }, 0, k.y + Math.sin(spin * PI) * 1.4, k.z, { flip: true, ang: spin > 0 && spin < 1 ? -spin * TAU : 0 });
    // thrown chains arcing at her
    for (const [c0, side] of [[141.2, -1], [144.6, 1], [146.0, -1]]) { const u = (t - c0) / 0.6; if (u <= 0 || u >= 1.4) continue; const x0 = side * 9, z0 = k.z - 6; const xe = lerp(x0, 0.4 * side, Math.min(1, u)), ze = lerp(z0, k.z + (u > 1 ? -1 : 0), Math.min(1, u)); for (let c = 0; c <= 12; c++) { const v = c / 12; p3(lerp(x0, xe, v), k.y + 1.4 + Math.sin(v * PI) * 1.4, lerp(z0, ze, v), C('stone', 6), 0.07); } }
  });

  // ---------------------------------------------------------------- the broken bridge and the long drop
  const BR = { y: 30, z1: 14 };
  function drawBridge(t, opt) {
    opt = opt || {};
    setSun(-0.55, 0.45, 0.7, 0.45); setFog('#f0b3a6', 30, 240, 0.85);
    sky(skyDawn);
    // the harbour ring, far below: water, docks, the city wall
    plane(-60, (wx, wz, d, x, y) => { const dock = Math.abs(wz - 40) < 3 && Math.abs(wx) < 40, boat = ih(fl(wx / 6), fl(wz / 4), 331) < 0.04; return dock ? shadeC(R.wood, 3.2 + (frac(wx) < 0.2 ? -0.8 : 0), x, y) : boat ? shadeC(R.crimson, 3, x, y) : waterTex()(wx, wz, d, x, y); }, { maxD: 900 });
    for (let k = 0; k < 9; k++) box(-60 + k * 14, -60, 70, -50 + k * 14, -28 + ih(k, 1, 332) * 18, 80, towerWin(3, k));
    for (let k = 0; k < 6; k++) box(-34 + k * 12, -60, 16 + ih(k, 2, 332) * 10, -26 + k * 12, -40 + ih(k, 3, 332) * 10, 26 + ih(k, 2, 332) * 10, wallMat(k + 80, 0.3));
    // the bridge: a stone span ending in a broken jagged edge
    box(-2.4, BR.y - 2.2, -40, 2.4, BR.y, BR.z1, (f, u, v, x, y, tt, L) => f === 'top' ? shadeC(R.linen, 3 + L * 2.2 + (frac(u / 0.9) < 0.08 || frac(v / 0.9) < 0.08 ? -1 : 0), x, y) : stoneMat(R.linen, 2.2)(f, u, v, x, y, tt, L));
    for (const sx of [-2.4, 2.1]) box(sx, BR.y, -40, sx + 0.3, BR.y + 1.0, BR.z1 - 1.4, stoneMat(R.linen, 2.6));
    for (let k = 0; k < 6; k++) box(-2.4 + k * 0.8, BR.y - 2.2 - ih(k, 1, 333) * 2, BR.z1, -1.6 + k * 0.8, BR.y - 0.2 * (k & 1), BR.z1 + 0.4 + ih(k, 2, 333) * 1.4, stoneMat(R.linen, 2));
    for (const T of HS.towers.slice(0, 16)) { prism(T.x + 30, T.z + 110, T.r, -60, T.h, T.n, towerWin(3.4, T.seed)); cone(T.x + 30, T.z + 110, T.r * 1.25, T.h, T.cap, T.n, goldRoof); }
  }
  const OREN_Z = 6.0, KAIRA_EDGE = 12.6;
  function standoff(t, opt) {
    // wardens in a half ring, Oren in front, Kaira at the edge
    const land = [149.0, 149.6, 150.3, 151.0];
    for (let k = 0; k < 4; k++) {
      const g = t - land[k]; if (g < -0.6) continue;
      const x = [-1.6, 1.6, -0.6, 0.9][k], z = [8.4, 8.6, 6.6, 6.9][k], y = g < 0 ? BR.y + (-g) * 12 : BR.y;
      actor3('warden', { view: opt.wview || 'side', spear: g < 0 ? -1.2 : -0.5, crouch: g > 0 && g < 0.25 ? 1 : 0, air: g < 0, captain: false }, x, y, z, {});
      if (g > 0 && g < 0.3) { const p = proj(x, BR.y, z); if (p) { shockRing(p.x, p.y, 4 + g * 80, 1.5 + g * 20, 2, [WHITE, C('linen', 6), C('linen', 4)], 1 - g / 0.3); shk(1.5); } }
    }
  }
  // 21 — the dead end (2:28): a low orbit as they land around her
  shot(148.0, 153.0, (lt, t) => {
    const a = -0.7 + lt * 0.22, r = 6.6;
    lookAt(Math.sin(a) * r, BR.y + 2.8, KAIRA_EDGE - 1 - Math.cos(a) * r, 0, BR.y + 1.0, KAIRA_EDGE - 2, 58);
    drawBridge(t); ink(2);
    const skid = 1 - eoc(lin(0, 0.6, lt));
    actor3('kaira', { view: 'side', crouch: skid > 0.2 ? 1 : 0, eyes: 'wide', brows: 'worried', blade: 1.2, blade2: 2.5, seed: 0.6, wind: 2 }, 0, BR.y, KAIRA_EDGE - skid * 3, { flip: false });
    if (skid > 0.05) for (let q = 0; q < 10; q++) { const p = proj((ih(q, 1, 341) - 0.5) * 0.8, BR.y + 0.1 + ih(q, 2, 341) * 0.3, KAIRA_EDGE - skid * 3 - 0.4 - q * 0.2); if (p) P(p.x, p.y, C('linen', 6)); }
    standoff(t, { wview: 'side' });
    actor3('warden', { view: 'side', captain: true, spear: -0.4, run: lt < 2.6 ? t * 14 : undefined }, 0, BR.y, lerp(-4, OREN_Z, eoc(lin(1.2, 3.4, lt))), {});
  });
  // 22 — Oren: "five days, courier" (2:33)
  shot(153.0, 160.0, (lt, t) => {
    if (lt < 4.6) {
      lookAt(1.0, BR.y + 1.1, OREN_Z + 4.4, -0.2, BR.y + 0.95, OREN_Z, 46);
      drawBridge(t); ink(2);
      actor3('warden', { view: 'front', captain: true, spear: -1.5, eyes: 'narrow', mouth: mouth('oren', t) }, 0, BR.y, OREN_Z, { rim: { side: 1, T: T_GOLD, a: 0.5 } });
      actor3('warden', { view: 'front', spear: -1.4 }, -1.7, BR.y, OREN_Z - 1.6, {});
    } else {
      // over Oren's shoulder: Kaira at the edge, the sky behind her
      lookAt(-0.6, BR.y + 1.6, OREN_Z - 1.6, 0, BR.y + 1.0, KAIRA_EDGE, 36);
      drawBridge(t); ink(2);
      actor3('kaira', { view: 'front', eyes: blink(t, 11) ? 'closed' : 'open', brows: 'worried', blade: 1.4, seed: 0.6, wind: 2, look: 0 }, 0, BR.y, KAIRA_EDGE, {});
      actor3('warden', { view: 'back', captain: true, spear: -1.5 }, 0.4, BR.y, OREN_Z, { dark: 1 });
    }
  });
  // 23 — she looks down: the drop (vertigo), then the grin, and she falls backwards (2:40)
  shot(160.0, 166.0, (lt, t) => {
    if (lt < 1.6) {
      const v = eio(lin(0, 1.6, lt));
      lookAt(0, BR.y + 1.3, BR.z1 + 1.8, 0, -60, BR.z1 + 24, lerp(34, 72, v));
      drawBridge(t); ink(2, 60);
      zoomBlur(240, 135, 0.06 * Math.sin(v * PI));
    } else {
      const fall = lin(4.5, 5.6, lt), u = lt - 1.6;
      const ky_ = BR.y - Math.max(0, fall - 0.35) ** 2 * 14, kz_ = KAIRA_EDGE + fall * 2.2, cr = sstep(0.3, 1.0, fall);
      lookAt(0.2, BR.y + 1.4 + cr * 1.2, lerp(KAIRA_EDGE - 3.4, BR.z1 + 1.2, cr), 0, lerp(BR.y + 1.0, ky_ + 0.6, cr), lerp(KAIRA_EDGE, kz_ + 1.5, cr), 40 + cr * 10);
      drawBridge(t); ink(2);
      actor3('kaira', { view: 'front', eyes: u > 0.6 ? 'half' : 'open', brows: u > 0.6 ? 'up' : 'n', smile: u > 0.5 ? 0.8 : 0, mouth: mouth('kaira', t), seed: 0.6, wind: 3, armF: fall > 0 ? -1.2 : 1.3, armL: fall > 0 ? -1.9 : 1.9 }, 0, BR.y - Math.max(0, fall - 0.35) ** 2 * 14, KAIRA_EDGE + fall * 2.2, { ang: fall * 1.4 });
    }
  });

  // ---------------------------------------------------------------- the fall through the market awnings
  const AWN = [[169.5, -14, C('crimson', 5), R.crimson], [171.0, -30, C('teal', 5), R.teal], [172.5, -44, C('gold', 5), R.gold]];
  shot(166.0, 176.0, (lt, t) => {
    // her height: falling fast, slowed by each awning she rips through
    let y = 26 - (lt * lt) * 4.2; for (const [ta] of AWN) if (t > ta) y += (t - ta) * 2.5;
    y = Math.max(y, -52);
    const cy = y + 9;
    lookAt(0.3, cy, -0.4, 0, y - 20, 0.6, 70);
    setSun(-0.4, 0.8, 0.4, 0.5); setFog('#f0b3a6', 20, 120, 0.7);
    sky(skyDawn);
    // the market far below: stalls and crowds, and the buildings around the plunge
    plane(-60, (wx, wz, d, x, yy) => { const st = ih(fl((wx + 100) / 4), fl((wz + 100) / 4), 351); return st < 0.3 ? shadeC([R.crimson, R.teal, R.gold, R.indigo][fl(st * 13) % 4], 4, x, yy) : cobble(R.stone, 3, false)(wx, wz, d, x, yy); }, { maxD: 300 });
    for (let k = 0; k < 8; k++) { const a = k / 8 * TAU, d = 9 + ih(k, 1, 352) * 4; box(Math.cos(a) * d - 3, -60, Math.sin(a) * d - 3, Math.cos(a) * d + 3, 20 - ih(k, 2, 352) * 10, Math.sin(a) * d + 3, towerWin(3.2, k + 90)); }
    // the awnings: sloped cloth on poles; torn once she's through
    for (const [ta, ay, col, ramp] of AWN) {
      const torn = t > ta;
      poly3([[-2.6, ay, -2.0], [2.6, ay, -2.0], [2.6, ay - 1.0, 2.0], [-2.6, ay - 1.0, 2.0]], (u, v, x, yy) => { if (torn && Math.abs(u - 2.6) < 1.2 + (t - ta) * 0.6 && Math.abs(v - 2.0) < 1.0 + (t - ta) * 0.8) return -1; return frac(u / 0.9) < 0.5 ? shadeC(ramp, 4.4, x, yy) : shadeC(R.linen, 6, x, yy); }, { two: true });
    }
    actor3('kaira', { view: 'front', air: true, eyes: lt < 2 ? 'wide' : 'narrow', brows: lt < 2 ? 'worried' : 'angry', mouth: lt < 1.2 ? 0.6 : 0, armF: -1.6 + Math.sin(t * 7) * 0.3, armL: -1.5, wind: 6, seed: 0.6 }, 0, y, 0, { ang: Math.sin(t * 2) * 0.3 });
    // tearing cloth
    for (const [ta, ay, col] of AWN) { const g = t - ta; if (g < 0 || g > 1.2) continue; for (let k = 0; k < 30; k++) { const p = proj((ih(k, 1, 353) - 0.5) * 4 + (ih(k, 2, 353) - 0.5) * g * 6, ay - g * 4 + ih(k, 3, 353) * g * 3, (ih(k, 4, 353) - 0.5) * 4); if (p) shard(p.x, p.y, 2, ih(k, 5, 353) * TAU + g * 8, col, C('linen', 7)); } if (g < 0.1) { shk(4); flashWhite(0.3 * (1 - g / 0.1)); } }
    streaks(-PI / 2, 50, t, 2600, C('linen', 7), 60, 354, [0, LB, W, H - 2 * LB]);
  });

