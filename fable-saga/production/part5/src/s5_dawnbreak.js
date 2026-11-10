  /* ================================================================ ACT IV — dawnbreak (23.0–29.4)
     23.0 DAWNBREAK: it drinks the darkness of the blade that pins it. Half dawn fire, half star-flecked night; a ring of
     sunrise behind its head; a wing of light and a wing of night; a blade half white, half black. And the world changes
     style with it: black, drawn in lines of light, with a burning horizon. 25.0 / 25.4 / 25.7 / 26.0 / 26.2 / 26.4 six
     strikes, each a different move, each breaking a piece of the Hollow (the mask, the blade arm, a wing, the crimson eye,
     its fire, its body); 27.0 an uppercut; 27.6 / 28.2 / 28.8 it is punched up through three stacked shards of world. */
  {
  const PH = [276, 181], PSL = 210, HY = 168;
  /* ---------------------------------------------------------------- 23.0–24.5: the form */
  const dH = TR([
    { t: 23.0, x: PH[0], y: PH[1] - 5, S: 3, form: 'dawn', nosw: true, arm: 0.3, a: 0.02, sq: 0.14, spread: 0.05, aur: 2.6, ring: 0, eyes: 'glow', ringR: 0.4 },
    { t: 23.12, x: PH[0], y: PH[1] - 8, sq: -0.2, aur: 3 },
    { t: 23.6, x: 262, y: 128, sq: 0, a: 0, spread: 1.3, aur: 1.5, ring: 1, ringR: 1.15, e: 'o' },
    { t: 23.95, x: 260, y: 124, spread: 1, aur: 1.1, ringR: 1, arm: -0.6 },
    { t: 23.96, nosw: false, sw: -1.0, swl: 3 },
    { t: 24.3, x: 258, y: 122, sw: -1.15, swl: 30 },
    { t: 24.5, x: 256, y: 124, sw: -0.7 },
    { t: 25, x: 256, y: 124 },
  ]);
  const dE = TR([
    { t: 23.0, x: 176, y: 72, S: 3, form: 'hnova', nosw: true, arm: 0.5, a: 0.14, eyes: 'wide', spread: 1, flip: false, aur: 0.6 },
    { t: 23.3, x: 60, y: 66, a: -0.5, spread: 0.5, sq: 0.1, arm: -1.2, e: 'o' },
    { t: 23.9, x: 44, y: 76, a: -0.2, spread: 0.8, sq: 0, eyes: 'narrow' },
    { t: 24.5, x: 40, y: 84, a: 0, spread: 1, aur: 1, arm: -0.4 },
    { t: 25, x: 40, y: 84 },
  ]);
  function dView(t) { const kk = kick(t, [[23.0, 2.6, -PI / 2]]), u = eio(clip01(23.15, 24.2, t)); return { x: lerp(272, 232, u) - kk[2], y: lerp(160, 126, u) - kk[3], z: lerp(1.5, 0.86, u) * (1 + kk[0] * 0.6), r: kk[1] }; }
  function lineBg(t, V, o) { w5Line(t, (V.x - 240) * 0.6 + t * 8, vY(V, HY) * 0.5 + 150 * 0.5, Object.assign({ sunX: 330 - (V.x - 240) * 0.2 }, o || {})); }
  shot(23.0, 24.5, (lt, t) => {
    const HS = [[23.0, 0.1]], V = dView(t), tt = h5Stop(t, HS), g = t - 23.0;
    H5PX = V.x * 0.3; H5PY = V.y * 0.3;
    // the world changes style, outward from the hero
    lineBg(t, V, { burn: eoc(clip01(23.0, 23.5, t)) });
    const hx0 = vX(V, PH[0]), hy0 = vY(V, PH[1]);
    if (g < 0.4) { const R = 30 + 800 * eic(g / 0.4); H5NEW.set(BUF); const nl = LIGHTS.length; WORLDS.pin(); LIGHTS.length = nl; for (let y = LB; y < H - LB; y++) for (let x = 0; x < W; x++) { const d = Math.hypot(x - hx0, (y - hy0) * 1.3); if (d < R) BUF[y * W + x] = d > R - 3 ? 22 : d > R - 6 ? 140 : H5NEW[y * W + x]; } }
    // the slab, in outline now
    { const pts = slabPts(vX(V, 110), vX(V, 410), vY(V, PSL), 0, 50 * V.z, 31); for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) lineP(pts[j][0], pts[j][1], pts[i][0], pts[i][1], i === 1 ? 135 : 137); }
    // the black blade comes apart and is drunk: its pieces run down into the night half
    const E = h5F(dE, tt, {}, V);
    const HP = h5Pose(dH, tt), hx = vX(V, HP.x), hy = vY(V, HP.y);
    if (g < 0.9) { const u = g / 0.9; for (let k = 0; k < 70; k++) { const f = ih(k, 1, 9501), sx0 = vX(V, lerp(224, 262, f)) + (ih(k, 2, 9501) - 0.5) * 10, sy0 = vY(V, lerp(70, 216, f)), d = clamp(u * 1.6 - ih(k, 3, 9501) * 0.6, 0, 1), e = d * d, x = lerp(sx0, hx - 14 * V.z, e) + Math.sin(d * 7 + k) * 10 * (1 - d), y = lerp(sy0, hy, e); if (d >= 1) continue; const s = 1 + fl(ih(k, 4, 9501) * 3 * (1 - d)); rectF(x, y, s, s + 1, k % 5 === 0 ? 74 : k % 5 === 1 ? 22 : 0); if (k % 2) P(x + s, y, 72); } }
    const HR = h5F(dH, tt, { frz: h5Frz(t, HS) ? 2 : 0 }, V);
    // the new blade draws itself: half white, half black
    if (t > 23.9 && t < 24.4) { for (let k = 0; k < 20; k++) { const u = frac(ih(k, 1, 9502) + t * 3), a = ih(k, 2, 9502) * TAU; P(HR.tip[0] + Math.cos(a) * 18 * (1 - u), HR.tip[1] + Math.sin(a) * 18 * (1 - u), k & 1 ? 22 : 56); } light(HR.tip[0], HR.tip[1], 30, L_WH, 0.6); }
    if (g < 0.7) { shockRing(hx0, hy0, 10 + g * 700, 8 + g * 460, 4, [22, 140, 56], 1 - g / 0.7); shockRing(hx0, hy0, 6 + g * 380, 4 + g * 250, 2, [22, 56, 6], 1 - g / 0.6); }
    h5Heavy(hx0, hy0, g, 3, undefined, [22, 140, 56], 9503, 1, [140, 141, 56, 57, 73, 74, 104], L_GOLD);
    // motes of first light rising off it
    for (let k = 0; k < 26; k++) { const u = frac(ih(k, 1, 9504) + t * (0.5 + ih(k, 2, 9504) * 0.6)), sd = k & 1, x = hx + (sd ? 1 : -1) * ih(k, 3, 9504) * 60 * V.z, y = hy + 20 * V.z - u * 120 * V.z; if (bay(fl(x), fl(y)) < 1 - u) P(x, y, sd ? (u < 0.5 ? 22 : 141) : (u < 0.5 ? 57 : 56)); }
    if (V.r) z5Cam(1, V.r, 240, 135);
  });
  CAPS.push([23.0, 24.4, 'x', 'dawn', 'DAWNBREAK!!', 218]);

  /* ---------------------------------------------------------------- 24.5–27.0: the counter-attack */
  const S2 = 2.2;
  const EX = 290;
  const cH = TR([
    { t: 24.5, x: 256, y: 124, S: 3, form: 'dawn', sw: -0.7, a: 0, sq: 0, flip: false, eyes: 'glow' },
    { t: 24.62, x: 240, y: 130, S: S2, sw: -2.2, sq: 0.25, a: -0.15, e: 'o' },
    { t: 24.8, x: 196, y: 154, sq: 0.44, sw: 1.2, a: 0.1 },                               // under its sweep
    { t: 24.93, x: 188, y: 152, sq: 0.36, sw: 1.6, a: 0.05 },
    { t: 25.0, x: 208, y: 130, sw: -1.25, sq: -0.2, a: -0.12, e: EQ },                    // 1: a rising cut across the mask
    { t: 25.1, x: 214, y: 112, sw: -2.3, a: -0.3, sq: 0, e: 'o' },
    { t: 25.28, x: 236, y: 60, sw: -2.6, a: -0.2, sq: 0.2 },
    { t: 25.4, x: 236, y: 112, sw: 0.95, a: 0.25, sq: -0.2, e: EQ },                      // 2: the chop on the blade arm
    { t: 25.5, x: 236, y: 126, sw: 1.5, a: 0.3, sq: 0.2, e: 'o' },
    { t: 25.7, x: 322, y: 96, a: 6.58, sw: -0.4, sq: 0, e: EQ },                          // 3: spinning over it, through its wing
    { t: 25.7001, a: 0.3, flip: true },
    { t: 25.8, x: 380, y: 100, a: 0, sw: -0.3, sq: 0.1, e: 'o' },
    { t: 25.92, x: 432, y: 112, sw: 0, sq: 0.26, reach: 0 },
    { t: 26.0, x: 404, y: 122, sw: 0.04, reach: 5, sq: -0.2, e: EQ },                     // 4: the thrust into the crimson eye
    { t: 26.08, x: 398, y: 118, reach: 1, sw: -0.6, sq: 0, e: 'o' },
    { t: 26.2, x: 352, y: 112, a: 1.0, lk: 1, sq: -0.18, sw: -2.2, e: EQ },               // 5: the kick
    { t: 26.28, x: 362, y: 108, a: 0.4, lk: 0.3, sq: 0.1, e: 'o' },
    { t: 26.34, x: 384, y: 112, a: 0, lk: 0, sw: -0.2, sq: 0.3 },
    { t: 26.4, x: 250, y: 126, sw: 0.2, sq: -0.3, reach: 4, e: 'l' },                     // 6: through it
    { t: 26.47, x: 170, y: 134, sw: 0.5, sq: 0, reach: 0, e: 'o' },
    { t: 26.6, x: 164, y: 138, flip: false, sw: 0.6 },
    { t: 26.78, x: 196, y: 172, sq: 0.44, sw: 1.7, a: -0.1 },
    { t: 26.96, x: 204, y: 176, sq: 0.5, sw: 1.8 },
    { t: 27.0, x: 214, y: 150, sw: -1.5, sq: -0.3, a: 0.2, e: EQ },                       // the uppercut
    { t: 27.12, x: 216, y: 96, sw: -2.2, sq: 0, a: 0.1, e: 'o' },
    { t: 27.4, x: 216, y: 90 },
  ], { 25.28: 30, 25.7: 40, 26.78: -20 });
  const cE = TR([
    { t: 24.5, x: 40, y: 84, S: 3, form: 'hnova', nosw: true, arm: -0.4, a: 0, flip: false, eyes: 'narrow', spread: 1, chip: 0 },
    { t: 24.62, x: 150, y: 110, S: S2, arm: -1.3, a: -0.25, sq: 0.15 },
    { t: 24.8, x: EX - 40, y: 124, arm: 0.5, a: 0.3, sq: -0.15, flip: false, e: EQ },      // its sweep, over the hero
    { t: 24.95, x: EX, y: 128, arm: 0.9, a: 0.1, sq: 0, e: 'o' },
    { t: 24.9501, flip: true, a: -0.1, arm: 0.9 },
    { t: 25.0, x: EX, y: 128, a: 0, eyes: 'wide' },
    { t: 25.08, x: EX + 12, y: 122, a: 0.34, chip: 1, sq: 0.1, e: 'o' },                   // head snapped back
    { t: 25.3, x: EX + 8, y: 126, a: 0.1, arm: -0.6, sq: 0 },                              // raises the blade again
    { t: 25.4, x: EX + 8, y: 128, a: 0.05, arm: -0.2 },
    { t: 25.48, x: EX + 12, y: 136, a: -0.2, sq: 0.2, arm: 0.9, e: 'o' },                  // the arm driven down
    { t: 25.7, x: EX + 6, y: 130, a: 0.1, sq: 0, wl: 1 },
    { t: 25.7001, wl: 0 },
    { t: 25.78, x: EX - 8, y: 136, a: -0.3, sq: 0.1, e: 'o' },
    { t: 25.9, x: EX - 6, y: 132, a: 0, flip: false, eyes: 'wide', eyeC: true },           // turns to face it
    { t: 26.0, x: EX - 6, y: 132 },
    { t: 26.0001, eyeC: false, eyes: 'narrow' },
    { t: 26.1, x: EX - 22, y: 128, a: -0.4, sq: 0.1, e: 'o' },
    { t: 26.2, x: EX - 20, y: 130, a: -0.2 },
    { t: 26.28, x: EX - 44, y: 136, a: 0.5, sq: 0.36, aur: 0.3, e: 'o' },                  // folded by the kick
    { t: 26.4, x: EX - 46, y: 134, a: 0.2, sq: 0.1, cr: 0 },
    { t: 26.4001, cr: 1, form: 'hollow', spread: 0, eyes: 'wide' },
    { t: 26.6, x: EX - 44, y: 140, a: -0.5, sq: 0.1, e: 'o' },
    { t: 26.95, x: EX - 40, y: 138, a: 0.3, sq: 0 },
    { t: 27.0, x: EX - 40, y: 132, a: 0.1, sq: 0.4, e: 'l' },
    { t: 27.2, x: EX - 38, y: -220, a: -5, sq: -0.2, e: 'o' },
    { t: 27.4, x: EX - 38, y: -500 },
  ]);
  const STR = [[25.0, 300, 118, -1.0], [25.4, 262, 126, 1.3], [25.7, 320, 108, -2.6], [26.0, 304, 126, PI], [26.2, 318, 130, PI], [26.4, 246, 132, PI]];
  function cView(t) {
    const kk = kick(t, [[25.0, 1.1, -1], [25.4, 1.2, 1.3], [25.7, 1.1, -2.6], [26.0, 1.2, PI], [26.2, 1.0, PI], [26.4, 1.4, PI], [27.0, 2.6, -PI / 2]]), u = eio(clip01(24.5, 24.85, t)), v = eio(clip01(26.5, 26.95, t));
    return { x: lerp(232, EX - 30, u) - 20 * v - kk[2], y: lerp(126, 126, u) + 10 * v - kk[3] - 80 * eic(clip01(27.02, 27.4, t)), z: lerp(0.86, 1.3, u) * (1 + kk[0]), r: kk[1] };
  }
  shot(24.5, 27.0, (lt, t) => {
    const HS = [[25.0, 0.05], [25.4, 0.05], [25.7, 0.05], [26.0, 0.05], [26.2, 0.04], [26.4, 0.05]], V = cView(t), tt = h5Stop(t, HS), frz = h5Frz(t, HS) ? 1.5 : 0;
    H5PX = V.x * 0.3; H5PY = V.y * 0.3;
    lineBg(t, V, {});
    const pe = h5Pose(cE, tt);
    // the wing that comes off, falling
    let g = t - 25.7; if (g >= 0 && g < 1.2) { const wx = vX(V, EX + 34 + 50 * g), wy = vY(V, 112 - 40 * g + 190 * g * g); h5Wing(wx, wy, S2 * 0.55 * V.z, t, 1, 0.05, 1, 'void', g * 4, 0, 0, clip01(0.2, 1.1, g) * 0.9); }
    const E = h5F(cE, tt, { frz }, V);
    // its blade: swung once, then cut from its hand
    if (E) {
      const bh = [E.hand[0] + (pe.flip ? -3 : 3) * V.z, E.hand[1]], ba = t < 24.62 ? -0.9 : t < 24.72 ? lerp(-0.9, -2.2, clip01(24.62, 24.72, t)) : t < 24.8 ? lerp(-2.2, -3.6, clip01(24.72, 24.8, t)) : t < 24.95 ? lerp(-3.6, -3.9, clip01(24.8, 24.95, t)) : lerp(-2.6, -2.2, clip01(24.95, 25.4, t)) + (t > 25.0 && t < 25.3 ? 0.5 * Math.sin((t - 25) * 10) : 0);
      if (t < 25.4) { if (t > 24.72 && t < 24.86) bladeFan5(bh[0], bh[1], -2.2, ba, 600); bigBlade(bh[0], bh[1], ba, 520 * V.z, 5 * V.z, t, { form: 'void', flare: 0.6 }); }
      else { g = t - 25.4; if (g < 1.3) { const bx = bh[0] - 20 - 60 * g, by = vY(V, 110) - 90 * g + 260 * g * g; bigBlade(bx, by, -2.2 - g * 7, 170 * V.z, 5 * V.z, t, { form: 'void', flare: 0.3 * (1 - g / 1.3), cracks: g * 3 }); } }
      h5Ash(cE, tt, V, t > 26.4 ? 40 : 14, t > 26.4 ? -50 : 20, -40, [0, 78, 20, 0, 22, 77]);
      // crimson pouring from the eye that was put out
      if (t > 26.0) for (let k = 0; k < 12; k++) { const age = frac(ih(k, 1, 9510) + t * 1.6) * 0.5, p = h5Pose(cE, tt - age), q = h5Loc(p, vX(V, p.x), vY(V, p.y), S2 * V.z, 7.5, -2); if (bay(k, fl(t * 30)) < 1 - age * 2) { P(q[0] + (ih(k, 2, 9510) - 0.5) * 4 + age * 10, q[1] + age * 34, k % 2 ? 104 : 102); } }
    }
    const HR = h5F(cH, tt, { frz }, V);
    for (let k = 0; k < STR.length; k++) {
      const [h, x, y, d] = STR[k]; g = t - h; if (g < 0 || g > 0.7) continue; const sx = vX(V, x), sy = vY(V, y);
      h5Heavy(sx, sy, g, k === 5 ? 1.5 : 1.0, d, k === 3 ? [22, 104, 102] : [22, 140, 56], 9520 + k, 0, null, k === 3 ? L_CRIM : k % 2 ? L_VIO : L_GOLD);
      if (k === 0) rocks(sx, sy, g, 9, 190, 3.2 * V.z, [66, 65, 64, 22], 9530, 260, -0.6, 1.4);                            // porcelain
      if (k === 1) rocks(sx, sy, g, 8, 160, 2.6 * V.z, [0, 77, 74, 22], 9531, 220, 1.2, 1.6);
      if (k === 2) for (let q = 0; q < 14; q++) { const a = ih(q, 1, 9532) * TAU, r = (30 + ih(q, 2, 9532) * 120) * g; z5Kite(sx + Math.cos(a) * r, sy + Math.sin(a) * r + 120 * g * g, a + g * 6, 9 * V.z * (1 - g), 2.2, q % 3 ? 0 : 78); lineP(sx + Math.cos(a) * r, sy + Math.sin(a) * r + 120 * g * g, sx + Math.cos(a) * r + Math.cos(a + g * 6) * 8, sy + Math.sin(a) * r + 120 * g * g + Math.sin(a + g * 6) * 8, 22); }
      if (k === 3 && g < 0.4) { for (let q = 0; q < 18; q++) { const a = (ih(q, 1, 9533) - 0.5) * 1.6, v = 80 + ih(q, 2, 9533) * 260; lineP(sx + Math.cos(a) * v * g, sy + Math.sin(a) * v * g + 100 * g * g, sx + Math.cos(a) * v * g * 0.8, sy + Math.sin(a) * v * g * 0.8 + 64 * g * g, q % 3 ? 104 : 107); } }
      if (k === 5 && g < 0.3) { const u = g / 0.3; thick(sx - 150 * (1 - u * 0.3), sy + 8, sx + 150, sy - 6, u < 0.4 ? 3 : 1, 22); thick(sx - 140, sy + 10, sx + 140, sy - 4, 1, 138); }
    }
    // the uppercut's wind-up: light gathers at its feet
    if (t > 26.7 && HR) { const u = clip01(26.7, 27, t); for (let k = 0; k < 16; k++) { const f = frac(ih(k, 1, 9534) + t * 3), a = ih(k, 2, 9534) * TAU; P(HR.x + Math.cos(a) * 40 * (1 - f), HR.y + 12 + Math.sin(a) * 18 * (1 - f), k & 1 ? 22 : 56); } light(HR.x, HR.y, 70 * u, L_GOLD, 0.5 * u); }
    if (V.r) z5Cam(1, V.r, 240, 135);
  });
  function bladeFan5(hx, hy, a0, a1, len) { let d = a1 - a0; const ad = Math.abs(d); if (ad < 0.05) return; for (let y = LB; y < H - LB; y++) for (let x = 0; x < W; x++) { const dx = x + 0.5 - hx, dy = y + 0.5 - hy, r = Math.sqrt(dx * dx + dy * dy); if (r > len || r < 14) continue; let rel = Math.atan2(dy, dx) - a0; rel = d > 0 ? ((rel % TAU) + TAU) % TAU : ((-rel % TAU) + TAU) % TAU; if (rel > ad) continue; const u = rel / ad; if (bay(x, y) > u * u * 1.1 - 0.05) continue; BUF[y * W + x] = u > 0.94 ? 22 : u > 0.86 ? 74 : 77; } }

  /* ---------------------------------------------------------------- 27.0–29.4: the uppercut, and up through three worlds */
  const PANE = [[-470, 'city'], [-1070, 'ink'], [-1670, 'ocean']], PT = [27.6, 28.2, 28.8], UX = 250;
  const uE = TR([
    { t: 27.0, x: UX, y: 132, S: S2, form: 'hollow', nosw: true, arm: 0.4, a: 0.1, sq: 0.4, cr: 1, chip: 1, eyeC: false, eyes: 'wide', flip: false },
    { t: 27.25, x: UX + 4, y: -190, a: -5, sq: -0.2, e: 'o' },
    { t: 27.56, x: UX, y: -390, a: -8.5, sq: 0, e: 'l' },
    { t: 27.6, x: UX, y: -410, a: -8.8, sq: 0.4, e: 'l' },
    { t: 27.74, x: UX + 10, y: -640, a: -10, sq: -0.25, e: 'o' },
    { t: 28.16, x: UX - 6, y: -1000, a: -13, sq: 0, e: 'l' },
    { t: 28.2, x: UX - 4, y: -1016, sq: 0.4, e: 'l' },
    { t: 28.34, x: UX - 14, y: -1240, a: -11.5, sq: -0.25, e: 'o' },
    { t: 28.76, x: UX, y: -1590, a: -8, sq: 0, e: 'l' },
    { t: 28.8, x: UX, y: -1610, sq: 0.42, e: 'l' },
    { t: 28.96, x: UX + 60, y: -1880, a: -6.283 * 2 + 0.6, sq: -0.2, e: 'o' },
    { t: 28.9601, a: 0.6 },
    { t: 29.14, x: UX + 126, y: -1960, a: 0, sq: 0, flip: true, form: 'hnova', spread: 0.3, wl: 0, cr: 1, arm: -1.0 },
    { t: 29.36, x: UX + 134, y: -1964, a: 0.3, sq: 0.18, spread: 1, arm: -1.1 },
    { t: 29.4, x: UX + 120, y: -1950, a: -0.25, sq: -0.2, arm: -0.2, e: EQ },
    { t: 29.6, x: UX + 122, y: -1950 },
  ]);
  const uH = TR([
    { t: 27.0, x: UX - 36, y: 150, S: S2, form: 'dawn', sw: -1.5, sq: -0.3, a: 0.2, flip: false },
    { t: 27.14, x: UX - 38, y: 100, sw: -2.2, sq: 0, a: 0.1, e: 'o' },
    { t: 27.28, x: UX - 34, y: 110, sq: 0.36, sw: -0.4, a: 0 },                           // gathers
    { t: 27.3, x: UX - 34, y: 108, nosw: true, arm: 0.6 },
    { t: 27.57, x: UX - 16, y: -340, sq: -0.3, arm: 0.4, a: -0.25, reach: 0, e: 'i' },    // 1: a straight rising punch
    { t: 27.6, x: UX - 14, y: -382, arm: -1.25, reach: 7, e: 'l' },
    { t: 27.72, x: UX - 18, y: -520, arm: -0.2, reach: 0, sq: 0, a: 0, e: 'o' },
    { t: 28.0, x: UX + 46, y: -860, a: 3.6, sq: 0.1, e: 'i' },                             // 2: over, and both feet
    { t: 28.17, x: UX + 6, y: -972, a: 6.0, sq: 0.3, lk: 0.2, e: 'l' },
    { t: 28.2, x: UX, y: -986, a: 6.1, lk: 1, sq: -0.3, e: 'l' },
    { t: 28.2001, a: -0.18 },
    { t: 28.34, x: UX + 10, y: -1100, a: 0, lk: 0, sq: 0, arm: 0.3, e: 'o' },
    { t: 28.62, x: UX - 60, y: -1420, sq: 0.3, a: 0.5, spread: 0.3, e: 'i' },             // 3: wings shut, the whole body
    { t: 28.8, x: UX - 20, y: -1586, a: 0.75, sq: -0.4, spread: 0.1, e: 'l' },
    { t: 28.92, x: UX - 30, y: -1800, a: 0.3, sq: 0, spread: 1.2, e: 'o' },
    { t: 29.12, x: UX - 100, y: -1950, a: 0, spread: 1, arm: -2.2 },
    { t: 29.36, x: UX - 108, y: -1954, a: -0.3, sq: 0.18, arm: -2.4 },
    { t: 29.4, x: UX - 94, y: -1944, a: 0.25, sq: -0.2, arm: -0.4, e: EQ },
    { t: 29.6, x: UX - 96, y: -1944 },
  ]);
  function uView(t) {
    const pe = h5Trk(uE, t), ph = h5Trk(uH, t), kk = kick(t, [[27.0, 2.4, -PI / 2], [27.6, 1.5, -PI / 2], [28.2, 1.5, -PI / 2], [28.8, 1.6, -PI / 2]]);
    const top = eio(clip01(28.9, 29.3, t)), my = lerp((pe.y + ph.y) / 2 - 6, -1952, top);
    return { x: lerp(UX, UX + 14, top) - kk[2], y: (t < 27.2 ? lerp(132, my, eio(clip01(27.02, 27.2, t))) : my) - kk[3], z: lerp(clamp(150 / (Math.abs(pe.y - ph.y) + 40), 0.72, 1.35), 0.92, top) * (1 + kk[0] * 0.7), r: kk[1] };
  }
  function uPane(t, V, k) {
    const [py, view] = PANE[k], g = t - PT[k], sy = vY(V, py); if (sy < -140 || sy > H + 140) return;
    const Wv = wview(view), z = V.z, cx = vX(V, UX);
    const piece = (x0, x1, dx, rot, sd) => { const pts = [[x0, -74], [lerp(x0, x1, 0.4), -86], [x1, -70], [x1 + 8, 6], [x1 - 6, 76], [lerp(x0, x1, 0.5), 88], [x0 + 4, 72], [x0 - 10, 2]].map(([px, py2]) => { const mx = (x0 + x1) / 2, c = Math.cos(rot), s = Math.sin(rot), rx = (px - mx) * c - py2 * s, ry = (px - mx) * s + py2 * c; return [cx + (mx + rx + dx) * z, sy + ry * z + Math.abs(dx) * 0.2]; }); h5Shard(pts, Wv, 240 + ((x0 + x1) / 2) * 0.8, 135, t, { seed: sd, th: 4 }); };
    if (g < 0) piece(-250, 250, 0, 0.02 * (k - 1), 70 + k);
    else { const d = eoc(clamp(g / 0.8, 0, 1)); piece(-250, -40, -60 * d, -0.35 * d, 73 + k); piece(40, 250, 60 * d, 0.35 * d, 76 + k);
      for (let q = 0; q < 16; q++) { const a = -PI / 2 + (ih(q, 1, 9540 + k) - 0.5) * 2.6, v = 120 + ih(q, 2, 9540 + k) * 300, x = cx + Math.cos(a) * v * g * z, y = sy + (Math.sin(a) * v * g + 260 * g * g) * z, r = (5 + ih(q, 3, 9540 + k) * 12) * z; if (g < 1) h5Shard(shardPts(x, y, r * 1.4, r, g * (4 + q) + q, 80 + q + k * 20, 5), Wv, 120 + q * 20, 90 + q * 6, t, { seed: q, glint: false }); }
      h5Heavy(cx, sy, g, 1.8, -PI / 2, [22, 135, 136], 9545 + k, 0, null, L_COLD);
    }
  }
  shot(27.0, 29.4, (lt, t) => {
    const HS = [[27.0, 0.1], [27.6, 0.05], [28.2, 0.05], [28.8, 0.05]], V = uView(t), tt = h5Stop(t, HS), frz = h5Frz(t, HS) ? 1.6 : 0;
    H5PX = V.x * 0.3; H5PY = V.y * 0.05;
    const climb = clip01(27.1, 29.0, t), top = eio(clip01(28.9, 29.3, t));
    w5Line(t, 20, lerp(lerp(150, 236, eoc(clip01(27.0, 27.5, t))), 160, top), { sunX: 320, burn: 1 });
    // the climb: streaks of the line-world falling past
    if (t > 27.1 && top < 1) for (let k = 0; k < 40; k++) { const x = ih(k, 1, 9550) * W, sp = 500 + ih(k, 2, 9550) * 900, y = ((ih(k, 3, 9550) * 400 + (t - 27) * sp) % 400) - 80, L = (20 + ih(k, 4, 9550) * 70) * (1 - top); for (let q = 0; q < L; q++) if (bay(fl(x), fl(y + q)) < 0.6 - q / L * 0.5) P(x, y + q, k % 5 === 0 ? 141 : k % 5 === 1 ? 56 : 5); }
    for (let k = 0; k < 3; k++) uPane(t, V, k);
    const E = h5F(uE, tt, { frz }, V);
    if (E) h5Ash(uE, tt, V, 30, 0, 80, [0, 78, 121, 0, 72, 120]);
    const HR = h5F(uH, tt, { frz }, V);
    let g = t - 27.0; if (g < 0.8) h5Heavy(vX(V, UX - 8), vY(V, 128), g, 2.6, -PI / 2, [22, 140, 56], 9551, 1, [140, 141, 56, 57, 73, 74], L_GOLD);
    for (let k = 0; k < 3; k++) { g = t - PT[k]; if (g >= 0 && g < 0.5) { const p = h5Trk(uE, PT[k]); h5Heavy(vX(V, p.x - 4), vY(V, p.y + 18), g, 1.5, -PI / 2, [22, 140, 56], 9552 + k, 0, null, L_GOLD); } }
    // at the top: both blades race out to the length of the world
    if (t > 29.1 && HR && E) {
      const gr = eoc(clip01(29.1, 29.38, t)), ha = t < 29.37 ? lerp(-2.0, -2.5, clip01(29.1, 29.37, t)) : -0.36, ea = t < 29.37 ? lerp(-1.14, -0.64, clip01(29.1, 29.37, t)) : -PI + 0.36;
      bigBlade(E.hand[0] - 3, E.hand[1], ea, 1500 * gr, 6 * V.z, t, { form: 'void', grow: gr < 1 ? 0.999 : 1, flare: 0.6, surge: true });
      bigBlade(HR.hand[0] + 3, HR.hand[1], ha, 1500 * gr, 6 * V.z, t, { form: 'dawn', grow: gr < 1 ? 0.999 : 1, flare: 0.6, surge: true });
    }
    if (V.r) z5Cam(1, V.r, 240, 135);
  });
  }
