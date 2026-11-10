  /* ================================================================ ACT I/II — the fall, Zenith Nova, the duel on the falling sky (5.4–11.6)
     One world (the ocean hanging overhead, its teeth pointing down) and one frame of reference: the broken sky falling
     through it. The hero is slammed in from above, catches a shard one-handed and swings up onto it (6.15–6.7); 7.5 ZENITH
     NOVA; then one travelling shot to the right across the shards: clashes at 8.2 (a rising cut meets a diving one), 8.8 (a
     duck under a sweep, an uppercut into a block), 9.3 (a kick into a guard), 9.7 (a leaping spin that cuts the shard
     under them in half), 10.0 (thrust past thrust), and at 10.6 the blades lock and every shard round them bursts. */
  {
  const SLAB = [[150, 260, 170, 26, 1, 'dawn'], [330, 430, 120, 22, 2, 'a1'], [300, 560, 190, 30, 3, 'dawn'], [545, 635, 176, 20, 4, 'ink'], [600, 700, 120, 24, 5, 'dawn'], [690, 820, 200, 28, 6, 'city'], [760, 850, 150, 22, 7, 'dawn'], [1000, 1085, 150, 22, 8, 'a1']];
  const HITS = [[7.5, 0.1], [8.2, 0.1], [8.8, 0.1], [9.3, 0.1], [9.7, 0.1], [10.0, 0.067], [10.6, 0.167]];
  const CL = [[8.2, 305, 107, -0.6], [8.8, 462, 114, -1.2], [9.3, 624, 96, 2.6], [9.7, 749, 192, 0.5], [10.0, 774, 192, 0]];
  const D2 = (t) => t < 7.5 ? 0 : clamp(0.06 * ((t >= 8.2) + (t >= 8.8) + (t >= 9.3) + (t >= 9.7) + (t >= 10.0)) + 0.12 * (t >= 10.6), 0, 1);
  const bH = TR([
    { t: 5.4, x: 250, y: -70, a: 0.6, sw: 0.5, S: 2, eyes: 'closed', mouth: 2, cr: 1, form: 'plain' },
    { t: 5.78, x: 264, y: 60, a: 3.6, e: 'l' },
    { t: 6.04, x: 280, y: 150, a: 6.0, eyes: 'wide', mouth: 1, e: 'l' },
    { t: 6.15, x: 290, y: 192, a: 6.48, arm2: [-2.0, 8, 1], eyes: 'angry', mouth: 0, e: 'o' },
    { t: 6.1501, a: 0.2 },
    { t: 6.3, x: 302, y: 150, a: -1.3 },
    { t: 6.43, x: 264, y: 118, a: -4.2, arm2: null },
    { t: 6.55, x: 236, y: 147, a: -6.283, sq: 0.34, e: 'o' },
    { t: 6.5501, a: 0 },
    { t: 6.74, x: 234, y: 142, sq: 0, sw: 0.6 },
    { t: 7.2, x: 234, y: 142, sw: -0.5 },
    { t: 7.46, x: 234, y: 146, sq: 0.28, sw: -0.9 },
    { t: 7.5, x: 234, y: 136, sq: -0.22, sw: -1.5, form: 'nova', swl: 9, spread: 0.1, cr: 0, eyes: 'glow', aur: 2.2, e: 'l' },
    { t: 7.72, x: 234, y: 132, sq: 0, swl: 30, spread: 1.25, aur: 1.3, e: 'o' },
    { t: 7.86, x: 234, y: 136, sw: -1.2, spread: 1, aur: 1 },
    { t: 8.02, x: 212, y: 152, sw: 1.5, a: -0.15, sq: 0.25, e: 'o' },
    { t: 8.2, x: 250, y: 140, sw: -0.9, a: 0.1, sq: -0.14, e: EQ },
    { t: 8.3, x: 244, y: 150, sw: -0.4, a: -0.2, sq: 0, e: 'o' },
    { t: 8.46, x: 330, y: 166, sw: 0.3, a: 0, sq: 0.25 },
    { t: 8.54, x: 356, y: 166, sw: 0.2, sq: 0, run: true },
    { t: 8.6, x: 376, y: 174, sq: 0.42, sw: 1.2 },
    { t: 8.7, x: 398, y: 172, sq: 0.38, sw: 1.6, run: false },
    { t: 8.8, x: 410, y: 150, sw: -1.0, sq: -0.18, e: EQ },
    { t: 8.9, x: 416, y: 132, sw: -2.1, sq: -0.05, e: 'o' },
    { t: 9.02, x: 436, y: 166, sw: -0.6, sq: 0.22 },
    { t: 9.15, x: 530, y: 166, sq: 0, run: true, sw: -0.3 },
    { t: 9.3, x: 590, y: 108, sw: -1.45, reach: 2, run: false, sq: -0.1, a: -0.1 },
    { t: 9.45, x: 578, y: 152, a: 0.3, sq: 0.3, reach: 0, sw: -0.9, e: 'o' },
    { t: 9.52, x: 572, y: 152, a: 0, sq: 0.28, sw: -2.7 },
    { t: 9.7, x: 688, y: 168, a: 6.283, sw: 0.7, sq: -0.1, e: EQ },
    { t: 9.7001, a: 0 },
    { t: 9.86, x: 690, y: 184, sw: 0, a: -0.08, sq: 0.2, reach: 0 },
    { t: 10.0, x: 712, y: 192, sw: 0, reach: 4, sq: -0.15, a: -0.05, e: EQ },
    { t: 10.08, x: 700, y: 190, reach: 0, sq: 0.22, sw: -0.7, e: 'o' },
    { t: 10.27, x: 805, y: 126, sq: 0.3, sw: -2.4, a: 0 },
    { t: 10.42, x: 802, y: 128, sq: 0.34, sw: -2.6 },
    { t: 10.6, x: 864, y: 130, sw: -0.8, sq: -0.12, e: EQ },
    { t: 10.8, x: 888, y: 130, sw: -1.25, sq: 0.05, vib: 0.7, mouth: 1, eyes: 'angry', e: 'o' },
    { t: 11.05, x: 892, y: 130 }, { t: 11.25, x: 881, y: 131 }, { t: 11.45, x: 894, y: 129 }, { t: 11.7, x: 889, y: 130 },
  ], { 8.46: 26, 9.3: 30, 9.7: 36, 10.27: 40 });
  const bE = TR([
    { t: 5.4, x: 420, y: -80, flip: true, sw: 0.4, S: 2, form: 'hollow', eyes: 'narrow', hide: true },
    { t: 6.2, x: 404, y: -60, hide: false },
    { t: 6.85, x: 380, y: 92, sq: 0, e: 'o' },
    { t: 6.95, x: 380, y: 93, sq: 0.14 },
    { t: 7.1, x: 380, y: 92, sq: 0 },
    { t: 7.5, x: 380, y: 92, sw: 0.4, a: 0 },
    { t: 7.58, x: 390, y: 90, a: -0.14, eyes: 'wide', sw: 0.1, e: 'o' },
    { t: 7.82, x: 384, y: 94, sq: 0.25, a: 0, sw: -1.6, eyes: 'narrow' },
    { t: 8.04, x: 374, y: 50, sw: -2.3, sq: -0.1, a: 0.2, e: 'o' },
    { t: 8.2, x: 368, y: 86, sw: 0.6, sq: -0.12, a: -0.1, e: EQ },
    { t: 8.3, x: 386, y: 100, sw: 0.2, a: 0.25, sq: 0, e: 'o' },
    { t: 8.45, x: 448, y: 162, sw: -0.5, a: 0, sq: 0.25 },
    { t: 8.52, x: 456, y: 162, sw: -2.0, sq: 0, run: true },
    { t: 8.62, x: 470, y: 160, sw: 0.5, reach: 3, e: EQ },
    { t: 8.72, x: 492, y: 158, sw: 0.9, reach: 0, run: false },
    { t: 8.8, x: 522, y: 122, sw: 0.1, a: 0.1, sq: -0.1, e: 'o' },
    { t: 9.1, x: 650, y: 92, a: 6.283, sw: -1.0, sq: 0.28 },
    { t: 9.1001, a: 0 },
    { t: 9.2, x: 652, y: 94, a: -0.38, sq: 0.3, sw: -2.0 },
    { t: 9.3, x: 656, y: 80, a: 1.0, lk: 1, sq: -0.15, e: EQ },
    { t: 9.38, x: 668, y: 74, a: 0.7, lk: 0.5, e: 'o' },
    { t: 9.54, x: 790, y: 172, a: 0, lk: 0, sq: 0.25, sw: 0.3 },
    { t: 9.62, x: 800, y: 172, sq: 0, sw: -0.4 },
    { t: 9.7, x: 808, y: 170, sw: 0.7, sq: 0.1, e: 'o' },
    { t: 9.86, x: 848, y: 186, sw: 0.0, a: 0.07, sq: 0.2, reach: 0 },
    { t: 10.0, x: 836, y: 196, sw: 0.0, reach: 4, sq: -0.15, e: EQ },
    { t: 10.08, x: 850, y: 190, reach: 0, sq: 0.2, sw: -0.6, e: 'o' },
    { t: 10.27, x: 1040, y: 122, a: 0, sq: 0.3, sw: -2.4 },
    { t: 10.42, x: 1043, y: 124, sq: 0.34, sw: -2.6 },
    { t: 10.6, x: 982, y: 130, sw: -0.8, sq: -0.12, e: EQ },
    { t: 10.8, x: 958, y: 130, sw: -1.25, sq: 0.05, vib: 0.7, eyes: 'wide', e: 'o' },
    { t: 11.05, x: 963, y: 130 }, { t: 11.25, x: 951, y: 131 }, { t: 11.45, x: 965, y: 129 }, { t: 11.7, x: 960, y: 130 },
  ], { 8.04: -10, 9.1: 46, 9.54: 30, 10.27: 44 });
  const CAMK = [[5.4, 240, 135, 1], [6.1, 250, 150, 1.1], [6.6, 292, 130, 1.5], [7.44, 288, 128, 1.56], [7.5, 250, 130, 1.8], [7.95, 300, 128, 1.2], [8.2, 306, 124, 1.28], [8.8, 462, 138, 1.22], [9.3, 616, 112, 1.28], [9.7, 746, 162, 1.22], [10.0, 774, 172, 1.3], [10.42, 922, 132, 1.5], [10.6, 923, 126, 1.6], [10.8, 923, 120, 2.2], [10.98, 923, 116, 3.1], [11.45, 924, 116, 3.35], [11.6, 924, 118, 2.4]];
  function b2View(t) {
    const AF = h5Frame(bH, bE, t, { fill: 330, pad: 90, zmin: 1.4, zmax: 1.8, oy: -8 }), wa = sstep(7.8, 8.0, t) * (1 - sstep(10.36, 10.56, t));
    const C = b2Cam(t); return { x: lerp(C.x, AF.x - (C.kx || 0), wa), y: lerp(C.y, AF.y - (C.ky || 0), wa), z: lerp(C.z, AF.z * (1 + (C.kz || 0)), wa), r: C.r };
  }
  function b2Cam(t) {
    let k = 0; while (k < CAMK.length - 2 && CAMK[k + 1][0] <= t) k++;
    const A = CAMK[k], B = CAMK[k + 1], u = (k === 3 || k === 12 ? eoc : eio)(clip01(A[0], B[0], t));
    const kk = kick(t, [[7.5, 2, -PI / 2], [8.2, 1, -0.6], [8.8, 1.1, -1.3], [9.3, 1.1, 2.8], [9.7, 1.3, 0.6], [10.0, 0.9, 0], [10.6, 2.6, 0]]);
    return { x: lerp(A[1], B[1], u) - kk[2], y: lerp(A[2], B[2], u) - kk[3], z: lerp(A[3], B[3], u) * (1 + kk[0]), r: kk[1], kx: kk[2], ky: kk[3], kz: kk[0] };
  }
  const fall = (t) => 210 * (t - 5.4) + 170 * (1 - Math.exp(-(t - 5.4) * 3));
  function b2Bg(t, V) {
    const rush = t > 10.6 ? Math.pow(t - 10.6, 2) * 900 : 0;
    w5Ocean(t, V.x * 0.5 + rush, fall(t), { hole: [250 - (V.x - 240) * 0.12, clamp(1 - (t - 5.4) * 0.22, 0, 1)], lx: 250 - (V.x - 240) * 0.2 });
    if (rush > 0) streaks(PI, 26, t, 1500, 117, 70 + rush * 0.1, 9201);
  }
  // loose shards of sky falling with them, at every depth
  const DEC = []; for (let k = 0; k < 26; k++) DEC.push({ x: ih(k, 1, 9202) * 1500 - 150, y: ih(k, 2, 9202) * 330 - 30, r: 6 + ih(k, 3, 9202) * (k % 5 === 0 ? 30 : 15), par: k % 5 === 0 ? 1.5 + ih(k, 4, 9202) * 0.5 : 0.4 + ih(k, 4, 9202) * 0.6, view: ['dawn', 'a1', 'dawn', 'city', 'ink', 'dawn', 'cath'][k % 7], rs: (ih(k, 5, 9202) - 0.5) * 1.6, rise: 14 + ih(k, 6, 9202) * 40 });
  function b2Dec(t, V, front) {
    const burst = t - 10.6;
    for (let k = 0; k < DEC.length; k++) {
      const D = DEC[k]; if ((D.par > 1.2) !== front) continue;
      let sx = 240 + (D.x - V.x) * D.par * V.z, sy = ((135 + (D.y - V.y) * D.par - (t - 5.4) * D.rise * D.par) % 330 + 330) % 330 - 30 + Math.sin(t * 0.9 + k) * 3;
      if (sx < -70 || sx > W + 70) continue;
      const r = D.r * (front ? 1 : V.z) * (0.7 + D.par * 0.4);
      if (burst > 0 && !front) { if (burst < 0.6) rocks(sx, sy, burst, 5, 150, r * 0.5, [137, 136, 135, 22], 9203 + k, 60); continue; }
      h5Shard(shardPts(sx, sy, r * 1.5, r, t * D.rs + k, 20 + k, 5 + (k % 3)), D.view, 60 + (k * 37) % 360, 50 + (k * 53) % 150, t, { seed: k, dim: front ? 0.75 : D.par < 0.7 ? 0.45 : 0, th: front ? 0 : 2, glint: !front });
    }
  }
  function b2Slabs(t, V) {
    const burst = t - 10.6;
    for (let k = 0; k < SLAB.length; k++) {
      const [x0, x1, y, dp, sd, view] = SLAB[k], cx = vX(V, (x0 + x1) / 2), cy = vY(V, y);
      if (cx < -160 || cx > W + 160) continue;
      if (burst > 0) { if (burst < 0.7) rocks(cx, cy + 6, burst, 9, 230, 7 * V.z, [137, 136, 135, 22], 9210 + k, 80); continue; }
      const S = (a, b, yy, rot, d2, s2) => h5Shard(slabPts(vX(V, a), vX(V, b), vY(V, yy), rot, d2 * V.z, s2), view, 100 + sd * 40, 80 + sd * 14, t, { th: 3, seed: sd });
      if (k === 5 && t > 9.7) { const g = t - 9.7; S(690, 749, 200 + g * 95, -g * 0.8, dp, 61); S(749, 820, 200 + g * 105, g * 0.7, dp, 62); if (g < 0.1) { thick(vX(V, 760), vY(V, 150), vX(V, 738), vY(V, 250), 3, 22); light(vX(V, 749), vY(V, 200), 70, L_WARM, 0.8); } rocks(vX(V, 749), vY(V, 204), g, 8, 120, 3, [137, 136, 135, 22], 9220, 220); }
      else S(x0, x1, y, 0, dp, sd);
    }
  }
  function b2Scene(t) {
    const V = b2View(t), [tt, fz] = h5Clock(t, HITS, 0.1, 2.4), frz = fz ? 1.5 : 0;
    H5PX = V.x * 0.4; H5PY = fall(t) * 0.1;
    b2Bg(t, V);
    b2Dec(t, V, false);
    if (t < 6.2) h5Shatter(WORLDS.a1, t - 5.4, 280, 140, { v: 330, dur: 0.62, grav: -160, delay: 0.0006 });
    b2Slabs(t, V);
    // the zenith nova: a sun behind it for a breath
    const ng = t - 7.5;
    if (ng >= 0 && ng < 0.62) { const hx = vX(V, 234), hy = vY(V, 134), a = ng < 0.3 ? 1 : 1 - (ng - 0.3) / 0.32; z5Sunburst(hx, hy, 16, t * 0.5, 18 * V.z, (90 + 260 * eoc(ng / 0.4)) * a + 30, 0.11 * a, [110, 109, 108, 105, 109, 110, 104]); light(hx, hy, 340 * a, L_WARM, 0.75 * a); }
    const E = h5F(bE, tt, { form: 'hollow', frz, rim: t > 7.5 && t < 8.6 ? [-1, 0.2, 105] : undefined }, V);
    if (E) h5Ash(bE, tt, V, 16, 18, -34);
    const HR = h5F(bH, tt, { frz, rim: t < 7.5 ? [0.6, -0.8, 119] : undefined, dmg: D2 }, V);
    // the broken hilt spits light; then the light gathers
    if (t > 6.7 && t < 7.5) { const g = clip01(7.15, 7.5, t); for (let k = 0; k < 10 + 24 * g; k++) { const u = frac(ih(k, 1, 9230) + t * (1.6 + g * 2)), a = ih(k, 2, 9230) * TAU, r = g > 0 ? (1 - u) * 60 * V.z : u * 22 * V.z; if (bay(k, fl(t * 30)) < 0.9) { const px = HR.tip[0] + Math.cos(a) * r, py = HR.tip[1] + Math.sin(a) * r * (g > 0 ? 1 : 0.6) - (g > 0 ? 0 : u * 10); P(px, py, k % 3 ? 59 : 22); if (g > 0) P(px + Math.cos(a) * 2, py + Math.sin(a) * 2, 58); } } light(HR.tip[0], HR.tip[1], 26 + 60 * g, L_GOLD, 0.5 + 0.4 * g); }
    if (ng >= 0 && ng < 0.03) h5Impact(HR.x, HR.y, 0, [108, 109, 110, 73, 74, 104]);
    if (ng >= 0 && ng < 0.45) { shockRing(HR.x, HR.y, 12 + ng * 620, 8 + ng * 420, 4, [22, 109, 110], 1 - ng / 0.45); rocks(HR.x, HR.y + 30, ng, 10, 260, 3, [137, 136, 135, 22], 9231, 120); }
    // hero trail of sparks while it burns
    if (t > 7.5) for (let k = 0; k < 14; k++) { const age = frac(ih(k, 1, 9232) + t * 1.4) * 0.6, p = h5Trk(bH, tt - age), x = vX(V, p.x) + (ih(k, 2, 9232) - 0.5) * 50 * V.z, y = vY(V, p.y) + (ih(k, 3, 9232) - 0.3) * 30 * V.z - age * 40; if (bay(fl(x), fl(y)) < 1 - age / 0.6) P(x, y, k % 3 ? 109 : 22); }
    // clashes
    for (let k = 0; k < CL.length; k++) { const [h, x, y, d] = CL[k], g = t - h; if (g < 0 || g > 0.6) continue; h5Clash(vX(V, x), vY(V, y), g, k === 2 ? 0.9 : 1.15, d, 109, 74, 9240 + k); h5Spray(vX(V, x), vY(V, y), g, 0.8, d + (k & 1 ? 0.4 : -0.4), [22, 109], 9260 + k, ['dawn', 'ink', 'city']); if (k === 2 && g < 0.25) shockRing(vX(V, x), vY(V, y), 6 + g * 300, 6 + g * 300, 3, [22, 74, 72], 1 - g / 0.25); }
    // the lock: every shard bursts, the edges grind
    const lg = t - 10.6;
    if (lg >= 0) {
      const cx = vX(V, 923), cy = vY(V, lg < 0.2 ? lerp(100, 116, lg / 0.2) : 116 + z5Sh(t, 1) * 1.5);
      h5Blow(cx, cy, lg, 2.6, undefined, [22, 109, 74], 9250, 2, [72, 73, 74, 104, 107, 109, 110], L_WARM);
      if (lg > 0.05) { for (let k = 0; k < 34; k++) { const u = frac(ih(k, 1, 9251) + t * (2.2 + ih(k, 2, 9251) * 2)), sd = k & 1 ? 1 : -1, a = -PI / 2 + sd * (0.2 + ih(k, 3, 9251) * 1.3), v = (30 + ih(k, 4, 9251) * 90) * V.z * 0.5, px = cx + Math.cos(a) * v * u, py = cy + Math.sin(a) * v * u + 60 * u * u; if (bay(fl(px), fl(py)) < 1.1 - u) lineP(px, py, px - Math.cos(a) * 3, py - Math.sin(a) * 3 + 2, k % 3 === 0 ? 22 : sd > 0 ? 74 : 109); } sparkle(cx, cy, 4 + 3 * Math.sin(t * 40), 22, 140); light(cx, cy, 70 + 10 * Math.sin(t * 31), L_WH, 0.6); shk(1.2); }
    }
    b2Dec(t, V, true);
    // the next pane of the sky, coming at them: white paper behind it
    if (t > 11.2) { const u = eic(clip01(11.2, 11.6, t)), px = lerp(W + 30, 150, u), Wi = wview('ink'); polyF([[px, LB], [px + 5, LB], [px + 26, 150], [px + 64, H - LB], [px + 59, H - LB], [px + 21, 150]], () => 22); polyF([[px + 5, LB], [W, LB], [W, H - LB], [px + 64, H - LB], [px + 26, 150]], (x, y) => (bay(x, y) < 0.22 * u ? Wi[y * W + x] : -1)); light(px, 135, 120, L_WH, 0.5 * u); }
    if (V.r) z5Cam(1, V.r, 240, 135);
  }
  shot(5.4334, 11.6, (lt, t) => { b2Scene(t); });
  CAPS.push([6.6, 7.45, 's', 'HERO', 'NOT YOU TOO.'], [7.5, 8.45, 'x', '', 'ZENITH NOVA!', 58]);
  WORLDS.lock = () => { const V = b2View(11.6); b2Bg(11.6, V); };
  }
