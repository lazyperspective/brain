  /* ================================================================ ACT II — through the worlds (11.6–14.0)
     Still locked, they smash through three panes of the sky. 11.6 the white void: black ink line, a duck under a rising
     cut, a counter, ink for sparks. 12.6 the folded city: the hero runs up a flight of stairs and the Hollow runs along
     the underside of the flight above, upside down, their blades meeting in the gap as the two flights close. 13.4 the
     cathedral inside the dead sun: a thrust turned aside, a kick. */
  {
  /* ---------------------------------------------------------------- the white void */
  const iH = TR([
    { t: 11.6, x: 150, y: 132, sw: -1.25, S: 2, form: 'nova', a: 0, sq: 0, mouth: 0 },
    { t: 11.82, x: 112, y: 150, sw: -0.4, a: -0.2, e: 'o' },
    { t: 11.9, x: 116, y: 152, sw: 0.4, a: 0 },
    { t: 11.97, x: 140, y: 170, sq: 0.44, sw: 1.3, a: -0.15 },
    { t: 12.03, x: 152, y: 168, sq: 0.4, sw: 1.6 },
    { t: 12.12, x: 186, y: 140, sw: -0.9, sq: -0.16, a: 0.1, e: EQ },
    { t: 12.2, x: 176, y: 132, sw: -1.6, a: -0.5, sq: 0, e: 'o' },
    { t: 12.32, x: 208, y: 134, sw: -1.25, a: -6.283, sq: 0.05 },
    { t: 12.3201, a: 0 },
    { t: 12.7, x: 520, y: 128, vib: 0.6, e: 'i' },
  ]);
  const iE = TR([
    { t: 11.6, x: 212, y: 132, flip: true, sw: -1.25, S: 2, form: 'hollow', eyes: 'narrow', a: 0 },
    { t: 11.82, x: 366, y: 118, sw: 1.4, sq: 0.26, a: 0.1, e: 'o' },
    { t: 11.88, x: 368, y: 120, sw: 1.5, sq: 0.3 },
    { t: 11.97, x: 262, y: 140, sw: -1.2, sq: -0.14, a: -0.15, e: EQ },
    { t: 12.05, x: 256, y: 132, sw: -2.2, a: -0.25, sq: 0, e: 'o' },
    { t: 12.12, x: 300, y: 138, sw: -0.8, a: 0 },
    { t: 12.2, x: 318, y: 130, sw: -0.2, a: 0.4, e: 'o' },
    { t: 12.32, x: 270, y: 134, sw: -1.25, a: 6.283, sq: 0.05 },
    { t: 12.3201, a: 0 },
    { t: 12.7, x: 582, y: 128, vib: 0.6, e: 'i' },
  ]);
  const iView = (t) => { const kk = kick(t, [[11.6, 1.6, 0], [12.12, 1.3, -0.8]]), AF = h5Frame(iH, iE, Math.min(t, 12.3), { fill: 330, pad: 80, zmin: 1.5, zmax: 1.95, oy: -6 }), run = t > 12.3 ? (h5Trk(iH, t).x - 208) : 0; return { x: AF.x + run - kk[2], y: AF.y - kk[3], z: AF.z * (1 + kk[0]), r: kk[1] }; };
  const iBg = (t, V) => { w5Ink(t, (t - 11.6) * 60 + (V.x - 240) * 0.8, 0, {}); if (t > 12.3) { const u = clip01(12.3, 12.6, t); for (let k = 0; k < 30 * u; k++) { const y = LB + ih(k, 1, 9301) * (H - 2 * LB), x0 = ih(k, fl(t * 30), 9302) * W, L = 40 + ih(k, 3, 9301) * 160; lineF(x0, y, x0 + L, y, (X, Y, f) => { if (bay(X, Y) < 0.9 - Math.abs(f - 0.5) * 1.6) P(X, Y, 0); }); } } };
  function inkSplat(x, y, g, n, v, seed) { if (g < 0 || g > 0.7) return; for (let k = 0; k < n; k++) { const a = ih(k, 1, seed) * TAU, sp = v * (0.3 + ih(k, 2, seed)), px = x + Math.cos(a) * sp * g * (1 - g * 0.5), py = y + Math.sin(a) * sp * g * (1 - g * 0.5) + 160 * g * g, r = (1 + ih(k, 3, seed) * 3.2) * (1 - g * 0.9); discF(px, py, r, 0); if (k % 3 === 0) lineP(px, py, px - Math.cos(a) * 9 * (1 - g), py - Math.sin(a) * 9 * (1 - g), 0); } }
  shot(11.6, 12.6, (lt, t) => {
    const HS = [[11.6, 0.1], [12.12, 0.1]], V = iView(t), [tt, fz] = h5Clock(t, HS, 0.1, 2.2), frz = fz ? 1.4 : 0;
    GD.bloom = 0; GD.con = 0.1; GD.vig = 0.22; H5PX = 0; H5PY = 0;
    iBg(t, V);
    h5Shatter(WORLDS.lock, t - 11.6, 230, 130, { v: 420, dur: 0.5, grav: 60, delay: 0.0005 });
    inkSplat(vX(V, 180), vY(V, 132), t - 11.6, 26, 330, 9310);
    const E = h5F(iE, tt, { ink: true, frz }, V), HR = h5F(iH, tt, { ink: true, frz }, V);
    // brush marks where the blades met; ink for sparks
    const g = t - 12.12; if (g >= 0) { const cx = vX(V, 242), cy = vY(V, 107); inkSplat(cx, cy, g, 30, 300, 9311); if (g < 0.1) { thick(cx - 60 * (1 - g * 8), cy + 20, cx + 60 * (1 - g * 8), cy - 20, 3, 0); thick(cx - 16, cy - 40, cx + 16, cy + 40, 2, 0); } shk(4 * Math.max(0, 1 - g * 5)); }
    if (t > 12.32) { const cx = (E.x + HR.x) / 2, cy = HR.y - 34; for (let k = 0; k < 12; k++) { const u = frac(ih(k, 1, 9312) + t * 3), a = PI + (ih(k, 2, 9312) - 0.5) * 1.2; discF(cx + Math.cos(a) * 120 * u, cy + Math.sin(a) * 60 * u + 40 * u * u, 2 * (1 - u), 0); } }
    // the paper's edge, coming
    if (t > 12.45) { const u = eic(clip01(12.45, 12.6, t)), px = lerp(W + 20, 300, u), Wc = wview('city'); polyF([[px, LB], [W, LB], [W, H - LB], [px + 30, H - LB], [px - 16, 150], [px + 12, 90]], (x, y) => (x < px + 4 + Math.abs(((y * 7) % 23) - 11) * 0.6 ? 0 : bay(x, y) < 0.2 ? Wc[y * W + x] : -1)); }
    if (V.r) z5Cam(1, V.r, 240, 135);
  });
  WORLDS.inkEnd = () => { const V = iView(12.6); iBg(12.6, V); };

  /* ---------------------------------------------------------------- the folded city */
  const yA = (x) => 262 - 0.3 * (x + 40), yB = (x) => -4 + 0.1179 * (x + 80);
  const cHk = [], cEk = [];
  { // the run: built from the stairs themselves
    const S = 2.2, hx = (t) => lerp(196, 372, clip01(12.74, 13.4, t));
    cHk.push({ t: 12.6, x: 150, y: 80, a: 0.5, sw: -0.6, S, form: 'nova', sq: -0.1 }, { t: 12.74, x: 196, y: yA(196) - 26, a: 0, sq: 0.3, sw: 0.3, e: 'i' });
    cEk.push({ t: 12.6, x: 232, y: 60, a: 0, flip: true, sw: -0.6, S, form: 'hollow', eyes: 'narrow', sq: -0.1 }, { t: 12.76, x: 200, y: yB(200) + 37, a: PI, sq: 0.3, sw: 0.3, e: 'i' });
    for (const [tk, swH, swE, sq, ee] of [[12.84, 0.9, 0.9, 0, 'l'], [12.95, -1.15, -1.5, -0.12, EQ], [13.02, -2.3, -2.4, 0, 'o'], [13.1, 0.9, 1.0, 0.1, 'l'], [13.18, -1.2, -1.45, -0.12, EQ], [13.26, -2.2, -2.3, 0, 'o'], [13.4, -1.3, -1.3, 0.1, 'l']]) {
      const x = hx(tk); cHk.push({ t: tk, x, y: yA(x) - 26 - (tk === 12.95 || tk === 13.18 ? 5 : 0), sw: swH, sq, run: true, e: ee });
      cEk.push({ t: tk, x: x + 2, y: yB(x + 2) + 37 + (tk === 12.95 || tk === 13.18 ? 5 : 0), sw: swE, sq, run: true, e: ee });
    }
    cHk.push({ t: 13.6, x: 420, y: 96 }); cEk.push({ t: 13.6, x: 422, y: 84 });
  }
  const cH = TR(cHk), cE = TR(cEk);
  const cView = (t) => { const p = h5Trk(cH, t), kk = kick(t, [[12.6, 1.4, 0.4], [12.95, 1.1, -PI / 2], [13.18, 1.2, -PI / 2]]), u = eio(clip01(12.6, 12.8, t)); return { x: lerp(240, clamp(p.x + 44, 240, 420), u) - kk[2], y: lerp(135, (yA(p.x) + yB(p.x)) / 2 - 4, u) - kk[3], z: lerp(1.05, 1.36, u) * (1 + kk[0]), r: kk[1] * 0.6 }; };
  function cBg(t, V) {
    const ox = V.x - 240, oy = V.y - 135;
    w5City(t, ox * 0.9 + (t - 12.6) * 40, oy, {});
    // where the two flights meet: the dead sun, waiting
    const bx = vX(V, 432), by = vY(V, 92), r = (20 + 22 * eic(clip01(12.6, 13.4, t))) * V.z;
    blackSun(bx, by, r, t, 1);
    w5Flight(vX(V, -40), vY(V, 262), vX(V, 420), vY(V, 124), 10 * V.z, [126, 125, 129], false, t, 3, true);
    w5Flight(vX(V, -80), vY(V, -4), vX(V, 430), vY(V, yB(430)), 10 * V.z, [126, 125, 129], true, t, 4, true);
    for (let x = 0; x < W; x++) { const wx = (x - 240) / V.z + V.x; if (wx > 420) continue; const ya = vY(V, yA(wx)), yb = vY(V, yB(wx)); tintP(x, ya - 1, T_CYAN, 0.5); tintP(x, ya, T_CYAN, 0.6); tintP(x, yb, T_MAG, 0.35); tintP(x, yb + 1, T_MAG, 0.3); }
  }
  shot(12.6, 13.4, (lt, t) => {
    const HS = [[12.95, 0.1], [13.18, 0.1]], V = cView(t), [tt, fz] = h5Clock(t, HS, 0.1, 2), frz = fz ? 1.2 : 0;
    H5PX = V.x * 0.4; H5PY = 0;
    cBg(t, V);
    GD.bloom = 0; const gg = clip01(12.6, 12.75, t); GD.bloom = 0.3 * gg;
    h5Shatter(WORLDS.inkEnd, t - 12.6, 250, 130, { v: 420, dur: 0.45, grav: 80, delay: 0.0005 });
    const E = h5F(cE, tt, { frz, rim: [0, 1, 74], halo: 73 }, V), HR = h5F(cH, tt, { frz, dmg: (tq) => 0.36 }, V);
    h5Ash(cE, tt, V, 12, -60, 10);
    for (const [h, sd] of [[12.95, 9320], [13.18, 9321]]) { const g = t - h; if (g < 0 || g > 0.5) continue; const p = h5Trk(cH, h), cx = vX(V, p.x + 44), cy = vY(V, (yA(p.x) + yB(p.x)) / 2 + 4); h5Clash(cx, cy, g, 1.1, 0, 109, 74, sd); }
    for (let k = 0; k < 8; k++) { const u = frac(ih(k, 1, 9322) + t * 2.5); if (HR && bay(k, fl(t * 30)) < 1 - u) P(HR.x - 20 - u * 40, HR.y + 26 - u * 8 + (k % 3), k % 2 ? 128 : 15); }
    if (V.r) z5Cam(1, V.r, 240, 135);
  });
  WORLDS.cityEnd = () => { const V = cView(13.4); cBg(13.4, V); };

  /* ---------------------------------------------------------------- the cathedral inside the dead sun */
  const FL = 204;
  const kH = TR([
    { t: 13.4, x: 210, y: 120, a: -0.8, sw: -0.8, S: 2.2, form: 'nova', sq: 0 },
    { t: 13.52, x: 128, y: FL - 26, a: 0.12, sq: 0.3, sw: 0.4, e: 'o' },
    { t: 13.6, x: 118, y: FL - 26, a: 0, sq: 0.1, sw: 0.5 },
    { t: 13.66, x: 122, y: FL - 28, sw: -1.5, sq: -0.05, a: -0.1, e: EQ },                 // turns the thrust aside
    { t: 13.71, x: 126, y: FL - 28, sw: -2.2, a: -0.3, sq: 0.2, e: 'o' },
    { t: 13.77, x: 168, y: FL - 34, a: -1.05, lk: 1, sq: -0.2, sw: -2.4, e: EQ },          // the kick
    { t: 13.86, x: 160, y: FL - 28, a: -0.3, lk: 0, sq: 0.15, e: 'o' },
    { t: 14.0, x: 150, y: FL - 26, a: 0, sq: 0, sw: -0.5 },
  ]);
  const kE = TR([
    { t: 13.4, x: 270, y: 110, a: 0.8, flip: true, sw: -0.8, S: 2.2, form: 'hollow', eyes: 'narrow' },
    { t: 13.52, x: 372, y: FL - 31, a: -0.12, sq: 0.3, sw: 0.2, e: 'o' },
    { t: 13.58, x: 378, y: FL - 31, a: 0.1, sq: 0.3, sw: 0, reach: 0 },
    { t: 13.66, x: 252, y: FL - 32, a: -0.06, sq: -0.2, sw: -0.05, reach: 4, e: EQ },      // the thrust
    { t: 13.71, x: 240, y: FL - 33, sw: -0.9, reach: 1, a: -0.2, sq: 0, e: 'o' },         // its point thrown up
    { t: 13.77, x: 238, y: FL - 32, a: -0.2 },
    { t: 13.8, x: 244, y: FL - 30, sq: 0.36, a: 0.5, e: 'l' },                             // folded by the kick
    { t: 13.93, x: 318, y: FL - 31, sq: 0.1, a: 0.1, sw: 0.5, e: 'o' },
    { t: 14.0, x: 322, y: FL - 31, sq: 0, a: 0, sw: 0.6 },
  ]);
  for (const K0 of [kH, kE]) for (const k of K0) { k.x = 240 + (k.x - 240) * 1.12; k.y = FL - (FL - k.y) * 1.318; k.S = 2.9; }
  const kView = (t) => { const kk = kick(t, [[13.4, 1.4, 0], [13.66, 1.0, -1], [13.77, 1.8, 0]]); return { x: 240 - kk[2], y: 135 - kk[3], z: 1 + kk[0], r: kk[1] }; };
  shot(13.4, 14.0, (lt, t) => {
    const HS = [[13.66, 0.067], [13.77, 0.1]], V = kView(t), [tt, fz] = h5Clock(t, HS, 0.1, 2.4), frz = fz ? 1.3 : 0;
    H5PX = 0; H5PY = 0;
    w5Cath(t, (V.x - 240) * 2, 0, {});
    h5Shatter(WORLDS.cityEnd, t - 13.4, 240, 120, { v: 420, dur: 0.42, grav: 100, delay: 0.0005 });
    // their reflections in the floor, and the dust of the skid
    const E = h5F(kE, tt, { frz, rim: [0, -1, 103] }, V), HR = h5F(kH, tt, { frz, rim: [1, -0.3, 105], dmg: (tq) => 0.4 }, V);
    h5Ash(kE, tt, V, 12, 30, -30);
    for (const F of [E, HR]) if (F && t < 13.66) for (let k = 0; k < 10; k++) { const u = frac(ih(k, 1, 9330) + t * 4); if (bay(k, fl(t * 30)) < 1 - u) P(F.x + (F === HR ? 1 : -1) * (20 + u * 30) + (ih(k, 2, 9330) - 0.5) * 8, vY(V, FL) - u * 10, k % 2 ? 105 : 103); }
    let g = t - 13.66; if (g >= 0 && g < 0.5) h5Clash(vX(V, 191), vY(V, FL - 58), g, 1.0, -1.2, 109, 74, 9331);
    g = t - 13.77; if (g >= 0 && g < 0.6) { h5Blow(vX(V, 211), vY(V, FL - 34), g, 1.4, 0, [22, 109, 105], 9332, 0, null, L_WARM, ['cath', 'city', 'ink']); }
    if (V.r) z5Cam(1, V.r, 240, 135);
  });
  }
