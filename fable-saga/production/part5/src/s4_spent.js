  /* ================================================================ ACT III — everything you spent (14.0–23.0)
     14.0 the Hollow copies: NOVA, inverted (a black star, white fire, wings of void), and its blade races out to colossal
     length. 15.0 it cuts the cathedral, and the dead sun in its window, clean in half; the halves slide apart on night.
     16.2 the hero blocks and is driven backward through a moon. 17.4 a wing is cut off from behind. 18.4 it is pinned to a
     slab of sky through the shoulder. 19.2 the mask, close. 20–23 the low point: four sparks, a hand closing on the blade. */
  {
  // a black star: a hole with a corona of white fire
  function blackStar(cx, cy, r, t, amt) {
    if (amt <= 0.02 || r < 1) return;
    const R = r * 2.6, x0 = Math.max(0, fl(cx - R)), x1 = Math.min(W - 1, Math.ceil(cx + R)), y0 = Math.max(LB, fl(cy - R)), y1 = Math.min(H - LB - 1, Math.ceil(cy + R));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy, d = Math.sqrt(dx * dx + dy * dy), an = Math.atan2(dy, dx);
      if (d < r) { BUF[y * W + x] = d > r - 1.5 ? 22 : d > r - 3 ? 20 : ih(x, y, 9401) < 0.01 ? 57 : 0; continue; }
      const tongue = r * (1.12 + 0.75 * Math.max(0, Math.sin(an * 7 + t * 2.6) * Math.sin(an * 3 - t * 1.3)) + 0.4 * vn(an * 4 + t * 1.4, 0, 1, 9402)) * amt;
      if (d < tongue) { const e = (d - r) / Math.max(1, tongue - r); BUF[y * W + x] = e < 0.25 ? 22 : e < 0.5 ? 21 : e < 0.75 ? 20 : bay(x, y) < 0.5 ? 19 : 62; }
    }
    light(cx, cy, r * 4, L_DARK, 0.45 * amt); light(cx, cy, r * 2.4, L_COLD, 0.5 * amt);
  }
  // the smear of a colossal blade swept about (hx, hy) from angle a0 to a1
  function bladeFan(hx, hy, a0, a1, len, edge) {
    let d = a1 - a0; const ad = Math.abs(d); if (ad < 0.05) return;
    for (let y = LB; y < H - LB; y++) for (let x = 0; x < W; x++) {
      const dx = x + 0.5 - hx, dy = y + 0.5 - hy, r = Math.sqrt(dx * dx + dy * dy); if (r > len || r < 14) continue;
      let rel = Math.atan2(dy, dx) - a0; rel = d > 0 ? ((rel % TAU) + TAU) % TAU : ((-rel % TAU) + TAU) % TAU; if (rel > ad) continue;
      const u = rel / ad; if (bay(x, y) > u * u * 1.2 - 0.05) continue;
      BUF[y * W + x] = u > 0.94 ? 22 : u > 0.86 ? edge : (ih(x, y, 9403) < 0.01 ? 57 : u > 0.6 ? 0 : 77);
    }
  }
  /* ---------------------------------------------------------------- 14.0–16.2: NOVA., and the world cut in half */
  const FL = 204;
  const nE = TR([
    { t: 14.0, x: 240, y: 160, S: 2.2, flip: true, form: 'hnova', nosw: true, arm: -0.4, sq: -0.26, spread: 0.1, aur: 2.4, eyes: 'wide', a: 0 },
    { t: 14.3, x: 240, y: 128, sq: 0, spread: 1.3, aur: 1.5, arm: -0.8, e: 'o' },
    { t: 14.5, x: 240, y: 126, spread: 1, aur: 1.15, eyes: 'narrow' },
    { t: 14.86, x: 244, y: 118, a: 0.22, arm: -1.1, sq: 0.1 },
    { t: 14.96, x: 246, y: 116, a: 0.3, sq: 0.18 },
    { t: 15.0, x: 232, y: 132, a: -0.3, arm: 0.7, sq: -0.2, e: EQ },
    { t: 15.25, x: 230, y: 136, a: -0.34, sq: 0, e: 'o' },
    { t: 15.6, x: 250, y: 124, a: 0, arm: -0.2 },
    { t: 15.95, x: 306, y: 116, a: 0.28, arm: -0.2, sq: 0.16 },
    { t: 16.13, x: 310, y: 116, a: 0.32, sq: 0.2 },
    { t: 16.2, x: 286, y: 124, a: -0.3, arm: 0.5, sq: -0.2, e: EQ },
    { t: 16.4, x: 280, y: 126 },
  ]);
  const nH = TR([
    { t: 14.0, x: 92, y: FL - 26, S: 2.2, form: 'nova', sw: -0.5, a: 0, eyes: 'glow', sq: 0 },
    { t: 14.25, x: 78, y: FL - 26, a: -0.16, sw: -1.3, sq: 0.12, e: 'o' },
    { t: 14.92, x: 70, y: FL - 26, a: -0.2, sq: 0.22, sw: -1.4 },
    { t: 14.96, x: 70, y: FL - 24, sq: 0.36 },
    { t: 15.0, x: 96, y: 112, a: 0.3, sq: -0.22, sw: -0.6, e: 'o' },
    { t: 15.3, x: 108, y: 104, a: 0, sq: 0, sw: -0.9 },
    { t: 15.9, x: 126, y: 124, sw: -1.3 },
    { t: 16.12, x: 130, y: 128, sw: -1.55, reach: 2, sq: 0.16, a: -0.1 },
    { t: 16.2, x: 120, y: 126, sq: 0.32, a: -0.25, e: 'l' },
    { t: 16.3, x: -120, y: 106, e: 'l' },
  ]);
  const bladeA = (t) => t < 14.5 ? lerp(-2.3, -2.0, clip01(14.0, 14.5, t)) : t < 14.9 ? lerp(-2.0, -1.15, eio(clip01(14.5, 14.9, t))) : t < 14.94 ? -1.15 : t < 14.97 ? -1.3 : t < 15.0 ? -1.95 : t < 15.3 ? -3.6 : t < 15.95 ? lerp(-3.6, -0.25, eio(clip01(15.3, 15.95, t))) : t < 16.14 ? -0.25 + 0.06 * Math.sin(t * 40) : t < 16.17 ? 0.5 : t < 16.2 ? 1.7 : 2.96;
  const bladeL = (t) => t < 14.5 ? 300 * eoc(clip01(14.05, 14.5, t)) : lerp(300, 900, eio(clip01(14.5, 14.9, t)));
  const CUT = [210, 120, -0.897, 0.443];                    // the line the world is cut along: a point, a direction
  function nCath(t, fire) { w5Cath(t, 0, 0, { fire }); }
  function nScene(t) {
    const HS = [[15.0, 0.12], [16.2, 0.1]], tt = h5Stop(t, HS), frz = h5Frz(t, HS) ? 1.6 : 0;
    const zb = lerp(1.75, 1, eio(clip01(14.25, 14.9, t))), kk = kick(t, [[14.0, 2, -PI / 2], [15.0, 2.6, 2.6], [16.2, 2.4, PI]]);
    const V = { x: lerp(240, 200, eio(clip01(14.25, 14.9, t))) - kk[2], y: lerp(132, 135, eio(clip01(14.25, 14.9, t))) - kk[3], z: zb * (1 + kk[0]) };
    const fire = lerp(1, 0.22, eoc(clip01(14.0, 14.5, t))), sg = t - 15.0;
    H5PX = 0; H5PY = 0;
    if (sg < 0) { nCath(t, fire); z5Cam(V.z, 0, V.x, V.y, 240, 135); }
    else {
      // the halves of the cathedral slide apart; between them the night, and a moon
      w5Night(t, 0, 0, { moon: [128, 150, 40] });
      H5NEW.set(BUF); nCath(t, 0.22); H5OLD.set(BUF); BUF.set(H5NEW); LIGHTS.length = 0;
      const gap = 170 * eoc(clip01(0.02, 1.15, sg)) + 6 * sg, [lx, ly, ux, uy] = CUT, nx = -uy, ny = ux;   // n points down-left... the sign is taken per side below
      for (let y = LB; y < H - LB; y++) for (let x = 0; x < W; x++) {
        const d = (x - lx) * nx + (y - ly) * ny, sd = d > 0 ? 1 : -1, sx = x - nx * sd * gap * 0.5 - ux * sd * gap * 0.22, sy = y - ny * sd * gap * 0.5 - uy * sd * gap * 0.22;
        const ds = (sx - lx) * nx + (sy - ly) * ny; if (ds * sd <= 0) continue;
        const X = fl(sx), Y = fl(sy); if (X < 0 || X >= W || Y < LB || Y >= H - LB) continue;
        BUF[y * W + x] = Math.abs(ds) < 1.6 ? 22 : Math.abs(ds) < 3.2 ? 20 : H5OLD[Y * W + X];
      }
      light(lx, ly, 260 * Math.max(0, 1 - sg * 2), L_COLD, 0.7);
      rocks(lx - 40, ly + 20, sg, 22, 260, 6, [96, 98, 100, 103], 9410, 140);
    }
    const E0 = h5Pose(nE, tt), ex = vX(V, E0.x), ey = vY(V, E0.y);
    blackStar(ex, ey - 4 * V.z, 26 * V.z * eob(clip01(14.0, 14.35, t)), t, 1);
    // the hero, braced in the wind of it
    const HR = h5F(nH, tt, { frz, rim: [1, -0.2, 20] }, V);
    if (t < 15) for (let k = 0; k < 30; k++) { const u = frac(ih(k, 1, 9411) + t * 2.2), a = PI + (ih(k, 2, 9411) - 0.5) * 1.6, r = 30 + u * 260; if (bay(k, fl(t * 30)) < 1 - u) P(ex + Math.cos(a) * r, ey + Math.sin(a) * r * 0.6, k % 3 ? 20 : 22); }
    // the blade
    const ba = bladeA(t), bl = bladeL(t) * V.z, bw = lerp(3, 8, clip01(14.0, 14.9, t)) * V.z;
    const E = h5F(nE, tt, { frz }, V);
    const bh = [E.hand[0] - 3 * V.z, E.hand[1]];
    if (t > 14.03) {
      if (t >= 14.96 && t < 15.1) bladeFan(bh[0], bh[1], bladeA(t - 1 / 30) > -1.2 ? -1.15 : bladeA(t - 1 / 30), ba - (t >= 15 ? 0 : 0), 900, 74);
      if (t >= 16.14 && t < 16.3) bladeFan(bh[0], bh[1], -0.25, ba, 900, 74);
      bigBlade(bh[0], bh[1], ba, bl, bw, t, { form: 'void', grow: t < 14.9 ? 0.999 : 1, flare: 0.7, surge: t < 14.97 });
      // where it goes out through the vault
      if (t > 14.3 && t < 14.97) { const ty = LB + 2, k2 = (ty - bh[1]) / Math.sin(ba), tx = bh[0] + Math.cos(ba) * k2; if (k2 > 0 && k2 < bl) { rocks(tx, ty, frac(t * 2.5) * 0.4, 6, 120, 3, [96, 98, 100, 103], 9412 + fl(t * 2.5), 300, PI / 2, 1.6); light(tx, ty + 6, 40, L_WH, 0.6); } }
    }
    h5Ash(nE, tt, V, 18, 30, -40, [0, 78, 20, 0, 22, 77]);
    if (t < 14.5) { const g = t - 14.0; h5Heavy(ex, ey, g, 2.2, undefined, [22, 20, 62], 9413, 1, [73, 74, 104, 107], L_COLD); }
    if (sg >= 0) { const [lx, ly, ux, uy] = CUT; h5Heavy(lx + ux * 60, ly + uy * 60, sg, 3, Math.atan2(uy, ux), [22, 20, 74], 9414, 1, [72, 73, 74, 104, 107], L_COLD); if (sg < 0.4) for (let k = -6; k <= 6; k++) { const px = lx + ux * k * 60, py = ly + uy * k * 60; if (bay(k + 8, 3) < 1 - sg * 2.5) sparkle(px, py, 10 * (1 - sg / 0.4), 22, 20); } }
    const bg = t - 16.2;
    if (bg >= 0) h5Heavy(HR ? HR.x + 30 : 150, HR ? HR.y : 126, bg, 2.8, PI, [22, 109, 74], 9415, 2, [72, 73, 74, 104, 107, 109, 110], L_WARM);
    if (kk[1]) z5Cam(1, kk[1], 240, 135);
  }
  shot(14.0, 16.2334, (lt, t) => nScene(t));
  CAPS.push([14.0, 14.9, 'x', 'inv', 'NOVA.', 208]);

  /* ---------------------------------------------------------------- 16.2–18.4: through the moon; the wing; pinned */
  const SLY = 350, MOON = [250, 118, 50];
  const mH = TR([
    { t: 16.2, x: 500, y: 128, S: 1.7, form: 'nova', a: -0.35, sw: -1.5, reach: 2, sq: 0.25, eyes: 'closed', mouth: 2, cr: 0.3 },
    { t: 16.3, x: 300, y: 124, e: 'l' },
    { t: 16.38, x: 200, y: 122, a: -1.6, reach: 0, e: 'l' },
    { t: 16.72, x: 176, y: 138, a: -6.5, sq: 0, e: 'o' },
    { t: 16.7201, a: -0.217 },
    { t: 16.98, x: 172, y: 140, a: 0, sw: -0.7, eyes: 'glow', mouth: 1, cr: 0.45 },
    { t: 17.28, x: 174, y: 141, vib: 0.5 },
    { t: 17.34, x: 174, y: 140, eyes: 'wide', a: 0.1 },
    { t: 17.4, x: 180, y: 146, a: 0.22, sq: 0.16, wl: 1, vib: 0, e: 'l' },
    { t: 17.4001, wl: 0, mouth: 2, eyes: 'closed', cr: 0.6 },
    { t: 17.64, x: 214, y: 176, a: 1.9, sq: 0, e: 'o' },
    { t: 18.0, x: 252, y: SLY - 22, a: 6.38, sq: 0.4, sw: 0.4, e: 'i' },
    { t: 18.0001, a: 0.1 },
    { t: 18.1, x: 262, y: SLY - 46, a: 0.5, sq: -0.05, e: 'o' },
    { t: 18.2, x: 270, y: SLY - 19, a: 0.12, sq: 0.34, e: 'i' },
    { t: 18.34, x: 270, y: SLY - 24, a: -0.05, sq: 0.1, vib: 0.5, eyes: 'narrow', mouth: 1, spread: 0.7 },
    { t: 18.4, x: 272, y: SLY - 18, a: 0.12, sq: 0.36, eyes: 'closed', mouth: 2, cr: 0.85, vib: 0, e: 'l' },
    { t: 18.6, x: 272, y: SLY - 18 },
  ]);
  const mE = TR([
    { t: 16.2, x: 620, y: 110, S: 1.7, flip: false, form: 'hnova', nosw: true, arm: -1.2, hide: true, a: 0 },
    { t: 17.0, x: 330, y: 20, hide: false, a: -0.2 },
    { t: 17.08, x: 104, y: 62, a: -0.34, sq: 0.16, e: 'o' },
    { t: 17.34, x: 100, y: 58, a: -0.42, sq: 0.22 },
    { t: 17.4, x: 114, y: 86, a: 0.3, arm: 0.9, sq: -0.2, e: EQ },
    { t: 17.58, x: 118, y: 94, a: 0.34, sq: 0, e: 'o' },
    { t: 18.0, x: 228, y: 196, a: 0, arm: 1.2 },
    { t: 18.3, x: 236, y: 236, arm: 1.3, sq: 0.16, a: -0.1 },
    { t: 18.4, x: 238, y: 262, sq: -0.16, a: 0.05, e: EQ },
    { t: 18.6, x: 238, y: 261, sq: 0 },
  ]);
  const mBladeA = (t) => t < 17.36 ? -1.05 + 0.04 * Math.sin(t * 30) : t < 17.38 ? -0.2 : t < 17.6 ? 1.0 : t < 18.3 ? lerp(1.0, 1.31, eio(clip01(17.6, 18.2, t))) : 1.31;
  const mBladeL = (t) => t < 17.5 ? 420 : lerp(420, 62, eio(clip01(17.5, 18.1, t)));
  const mView = (t) => {
    const kk = kick(t, [[16.3, 1.6, PI], [17.4, 2.2, 1.2], [18.0, 1.2, PI / 2], [18.4, 2.4, PI / 2]]), p = h5Trk(mH, Math.max(t, 17.4));
    const a = eio(clip01(16.9, 17.3, t)), b = eio(clip01(17.45, 18.0, t));
    return { x: lerp(lerp(240, 162, a), 250, b) - kk[2], y: lerp(lerp(128, 116, a), lerp(292, 300, clip01(18.0, 18.4, t)), b) - kk[3], z: lerp(lerp(1, 1.5, a), 1.4, b) * (1 + kk[0]), r: kk[1] };
  };
  function mBg(t, V) {
    w5Night(t, V.x * 0.25, V.y * 0.25, {});
    // the moon: whole, then tunnelled, then in halves, drifting apart
    const mx = vX(V, MOON[0]), my = vY(V, MOON[1]), r = MOON[2] * V.z, g = t - 16.3;
    if (g < 0) w5Moon(mx, my, r);
    else {
      const hb = 16 * V.z * clip01(0, 0.08, g), d = 46 * V.z * eoc(clip01(0.04, 1.4, g)), jag = (dx) => (vn(dx, 0, 7, 9420) - 0.5) * 12;
      w5Moon(mx - d * 0.25, my - d * 0.5, r, (dx, dy) => dy < -hb + jag(dx) - dx * 0.04);
      w5Moon(mx + d * 0.2, my + d * 0.5, r, (dx, dy) => dy > hb + jag(dx + 40) - dx * 0.04);
      rocks(mx, my, g, 30, 170 * V.z, 8 * V.z, [17, 18, 19, 20], 9421, 30, PI, 2.6);
      rocks(mx, my, g * 0.7, 40, 90 * V.z, 3 * V.z, [18, 19, 20, 21], 9422, 20);
      if (g < 0.5) { shockRing(mx, my, 10 + g * 380, 10 + g * 380, 3, [22, 20, 19], 1 - g / 0.5); light(mx, my, 200 * (1 - g * 2), L_COLD, 0.8); }
    }
    h5Shard(slabPts(vX(V, 150), vX(V, 372), vY(V, SLY), 0, 44 * V.z, 31), 'dawn', 250, 120, t, { th: 4, seed: 31 });
  }
  function mScene(t) {
    const HS = [[16.3, 0.05], [17.4, 0.12], [18.0, 0.05], [18.4, 0.12]], V = mView(t), tt = h5Stop(t, HS), frz = h5Frz(t, HS) ? 1.6 : 0;
    H5PX = V.x * 0.3; H5PY = V.y * 0.3;
    mBg(t, V);
    // the sweep that sent it, passing
    if (t < 16.4) { const g = t - 16.2; bladeFan(W + 200, vY(V, 126), PI + 0.5 - g * 2, PI + 0.05 - g * 0.2, 900, 74); }
    const wg = t - 17.4;
    // the wing that was cut off: it spins away, burning out
    if (wg >= 0 && wg < 1.1) { const wx = vX(V, 160 - 90 * wg - 30 * wg * wg), wy = vY(V, 128 - 80 * wg + 150 * wg * wg), burn = clip01(0.1, 1.0, wg); h5Wing(wx, wy, 1.7 * 0.55 * V.z, t, 1, 0.1, -1, 'nova', -wg * 6, 0, 0, burn); light(wx - 14, wy - 10, 60 * (1 - burn), L_WARM, 0.6 * (1 - burn)); for (let k = 0; k < 16; k++) { const u = frac(ih(k, 1, 9430) + t * 2); if (bay(k, fl(t * 30)) < (1 - u) * (1 - burn * 0.6)) P(wx - 20 + (ih(k, 2, 9430) - 0.5) * 40 + u * 20, wy - 10 + (ih(k, 3, 9430) - 0.5) * 30 - u * 26, k % 3 ? 105 : 109); } }
    // the Hollow arrives behind it: its eyes get there first
    if (t > 16.94 && t < 17.12) { const u = clip01(16.94, 17.08, t), ax = vX(V, lerp(520, 104, eoc(u))), ay = vY(V, lerp(-10, 60, eoc(u))); for (const [c, o] of [[74, -4], [104, 5]]) lineF(vX(V, 520), vY(V, -10) + o, ax, ay + o, (X, Y, f) => { if (bay(X, Y) < f * 1.2 - (t > 17.08 ? (t - 17.08) * 20 : 0)) P(X, Y, c); }); }
    const E = h5F(mE, tt, { frz }, V);
    if (E) {
      const ba = mBladeA(t), bh = [E.hand[0] + 3 * V.z, E.hand[1]];
      if (t >= 17.36 && t < 17.5) bladeFan(bh[0], bh[1], -1.05, ba, 520 * V.z, 74);
      bigBlade(bh[0], bh[1], ba, mBladeL(t) * V.z, lerp(6, 3.4, clip01(17.5, 18.1, t)) * V.z, t, { form: 'void', flare: 0.6 });
      h5Ash(mE, tt, V, 14, 20, -40, [0, 78, 20, 0, 22, 77]);
    }
    const HR = h5F(mH, tt, { frz, rim: [-0.6, -0.6, 20] }, V);
    // light bleeding from the stump of the wing
    if (wg > 0 && t < 18.4) for (let k = 0; k < 14; k++) { const age = frac(ih(k, 1, 9431) + t * 1.8) * 0.5, p = h5Trk(mH, tt - age), x = vX(V, p.x - 8) + (ih(k, 2, 9431) - 0.5) * 12, y = vY(V, p.y - 14) + (ih(k, 3, 9431) - 0.5) * 10 - age * 30; if (bay(fl(x), fl(y)) < 1 - age * 2) { P(x, y, k % 2 ? 22 : 109); P(x, y - 1, 105); } }
    if (wg >= 0) h5Heavy(vX(V, 160), vY(V, 128), wg, 2.4, 1.0, [22, 109, 105], 9432, 1, [72, 73, 74, 104, 107, 109, 110], L_WARM);
    let g = t - 18.0; if (g >= 0 && g < 0.6) { h5Heavy(vX(V, 252), vY(V, SLY), g, 1.3, -PI / 2, [22, 135, 136], 9433, 0, null, L_COLD); rocks(vX(V, 252), vY(V, SLY), g, 10, 140, 3, [137, 136, 135, 22], 9434, 200, -PI / 2, 2); }
    g = t - 18.4; if (g >= 0) { h5Heavy(vX(V, 262), vY(V, SLY - 20), g, 2.6, PI / 2, [22, 109, 74], 9435, 1, [72, 73, 74, 104, 107], L_WARM); }
    if (V.r) z5Cam(1, V.r, 240, 135);
  }
  shot(16.2334, 18.4334, (lt, t) => mScene(t));

  /* ---------------------------------------------------------------- the pin (18.4–19.2, 20.0–21.5, 22.3–23.0) */
  const PH = [276, 181], HILT = [224, 70], TIP = [262, 216], PSL = 210, SPK = [20.4, 20.9, 21.4, 21.9];
  const SPT = [[262, 170], [292, 186], [276, 166], [246, 150]];                              // where each spark touches
  // o: flick (the nova guttering), up 0..1 (it pulls itself up the blade), grip 0..1, drain 0..1, hz 0..1, eEyes
  function pinScene(t, V, o) {
    H5PX = V.x * 0.3; H5PY = V.y * 0.3;
    w5Night(t, 40 + V.x * 0.2, 60 + V.y * 0.2, {});
    // the broken moon, far behind now
    { const mx = vX(V, 96) * 0.6 + 60, my = vY(V, 70) * 0.5 + 30; w5Moon(mx - 6, my - 9, 22, (dx, dy) => dy < -3 + (vn(dx, 0, 5, 9420) - 0.5) * 6); w5Moon(mx + 5, my + 10, 22, (dx, dy) => dy > 3 + (vn(dx + 40, 0, 5, 9420) - 0.5) * 6); for (let k = 0; k < 10; k++) { const a = ih(k, 1, 9440) * TAU, r = 20 + ih(k, 2, 9440) * 30 + t * 0.6; discF(mx + Math.cos(a) * r, my + Math.sin(a) * r * 0.7, 1 + ih(k, 3, 9440) * 2.5, k % 2 ? 18 : 19); } }
    // first light, far off: the line where the night ends
    if (o.hz > 0) { const hy = vY(V, 190); for (let x = 0; x < W; x++) { if (bay(x, hy) < o.hz * 1.2) P(x, hy, o.hz > 0.6 ? 140 : 141); if (o.hz > 0.5 && bay(x, hy + 1) < (o.hz - 0.5) * 2) P(x, hy - 1, 141); } light(240, hy, 240, L_GOLD, 0.25 * o.hz); }
    h5Shard(slabPts(vX(V, 110), vX(V, 410), vY(V, PSL), 0, 50 * V.z, 31), 'dawn', 250, 120, t, { th: 5, seed: 31 });
    // cracks in the slab round the point
    { const cx = vX(V, TIP[0]), cy = vY(V, PSL + 2); for (let k = 0; k < 7; k++) { let a = PI * (0.08 + k * 0.14), x = cx, y = cy; for (let q = 0; q < 4; q++) { const nx = x + Math.cos(a) * 9 * V.z, ny = y + Math.abs(Math.sin(a)) * 5 * V.z; lineP(x, y, nx, ny, q < 2 ? 22 : 135); x = nx; y = ny; a += (ih(k, q, 9441) - 0.5) * 0.9; } } }
    const z = V.z, up = o.up || 0, drain = o.drain || 0, sh = (o.shake || 0);
    // the Hollow over it, pressing the blade down
    const eK = TR([{ t: 0, x: 176 - 3 * drain, y: 76 + Math.sin(t * 1.3) * 2 - 4 * drain, S: 3, form: 'hnova', nosw: true, arm: 0.5, a: 0.14, eyes: o.eEyes || 'narrow', spread: 1, flap: 0.14, aur: 1.1 - 0.5 * drain, glow: 1 - 0.5 * drain }, { t: 100, x: 176 - 3 * drain, y: 76 + Math.sin(t * 1.3) * 2 - 4 * drain }]);
    const E = h5F(eK, t, {}, V);
    // the blade, through the shoulder into the slab
    const hx = E.hand[0] + 5 * z, hy = E.hand[1] + 2 * z, tx = vX(V, TIP[0]), ty = vY(V, TIP[1]), ba = Math.atan2(ty - hy, tx - hx), bl = Math.hypot(tx - hx, ty - hy);
    bigBlade(hx, hy, ba, bl, 5 * z * (1 - 0.25 * drain), t, { form: 'void', flare: 0.5 * (1 - drain), cracks: drain * 2.4 });
    // its darkness running down into the hero
    if (drain > 0) for (let k = 0; k < 40 * drain; k++) { const u = frac(ih(k, 1, 9442) + t * (1.2 + ih(k, 2, 9442))), q = (ih(k, 3, 9442) - 0.5) * 8 * z, px = hx + Math.cos(ba) * bl * u - Math.sin(ba) * q, py = hy + Math.sin(ba) * bl * u + Math.cos(ba) * q; lineP(px, py, px - Math.cos(ba) * 6 * z, py - Math.sin(ba) * 6 * z, k % 3 ? 22 : 74); }
    // the hero
    const flick = o.flick !== undefined && o.flick > 0 && (fl(t * 22) % 3 !== 0 || o.flick > 0.7), lit = o.lit || 0;
    const hK = TR([{ t: 0, x: PH[0] + z5Sh(t, 3) * sh, y: PH[1] - 5 * up + z5Sh(t, 5) * sh * 0.6 + Math.sin(t * 1.5) * 0.5, S: 3, form: flick ? 'nova' : 'plain', sw: 0.5 + 0.1 * Math.sin(t * 0.7), a: 0.3 - 0.26 * up, sq: 0.34 - 0.2 * up + Math.sin(t * 1.5) * 0.025, cr: flick ? 0.6 : 1, eyes: o.eyes || 'closed', mouth: o.mouth || 0, spread: 0, aur: o.flick || 0, glow: o.flick || 0, dim: flick ? 0 : Math.max(0, 0.42 - lit * 0.42), nobob: true, arm2: o.grip ? [-2.25 + 0.2 * (1 - o.grip), 4 + 6 * o.grip, 1] : null, legs: up > 0.5 ? [1, 0, 0, 1] : [5, 4, 5, 5] }, { t: 100, x: PH[0], y: PH[1] }]);
    const HR = h5F(hK, t, { rim: lit > 0.05 ? [0.5, -0.8, 60] : undefined, noLight: !flick }, V);
    // where the blade goes in
    { const wx = vX(V, PH[0] - 31), wy = vY(V, PH[1] - 24 - 5 * up); sparkle(wx, wy, 3 + Math.sin(t * 9) * 1.2, flick ? 22 : 107, 103); light(wx, wy, 26, L_CRIM, 0.5); for (let k = 0; k < 5; k++) { const u2 = frac(ih(k, 1, 9443) + t * 0.9); if (bay(k, fl(t * 30)) < 1 - u2) P(wx + (ih(k, 2, 9443) - 0.5) * 8, wy + u2 * 16, k & 1 ? 107 : 103); } }
    // the sparks: drifting in, touching, going into it
    for (let k = 0; k < 4; k++) {
      const g = t - SPK[k], sx = vX(V, SPT[k][0]), sy = vY(V, SPT[k][1] - 5 * up);
      if (g < -1.6) continue;
      if (g < 0) { const u = 1 + g / 1.6, e = eio(u), a0 = k * 1.9 + 0.6, ox = Math.cos(a0) * 230 * (1 - e) + Math.sin(u * 5 + k) * 14 * (1 - u), oy = Math.sin(a0) * 120 * (1 - e) - 30 * Math.sin(u * PI), x = sx + ox, y = sy + oy; for (let q = 1; q < 7; q++) { const u2 = Math.max(0, u - q * 0.02), e2 = eio(u2); if (bay(q, k + fl(t * 30)) < 1 - q / 7) P(sx + Math.cos(a0) * 230 * (1 - e2) + Math.sin(u2 * 5 + k) * 14 * (1 - u2), sy + Math.sin(a0) * 120 * (1 - e2) - 30 * Math.sin(u2 * PI), ORB[k][q < 3 ? 2 : 1]); } light(x, y, 22, [L_COLD, [0.5, 1, 0.4], L_GOLD, L_VIO][k], 0.6); discF(x, y, 3.4, 63); discF(x, y, 2.6, ORB[k][1]); discF(x - 0.8, y - 0.8, 1.4, ORB[k][2]); P(x - 1, y - 1, 22); }
      else if (g < 0.9) { shockRing(sx, sy, 3 + g * 70, 3 + g * 70, 2, [22, ORB[k][2], ORB[k][1]], 1 - g / 0.5); light(sx, sy, 80 * Math.max(0.2, 1 - g), [L_COLD, [0.5, 1, 0.4], L_GOLD, L_VIO][k], 0.75 * (1 - g / 0.9)); if (g < 0.1) sparkle(sx, sy, 7 * (1 - g / 0.1), 22, ORB[k][2]); }
    }
    return { H: HR, E, hx, hy, ba, bl };
  }
  shot(18.4334, 19.2, (lt, t) => {
    const kk = kick(t, [[18.4, 2, PI / 2]]), u = eio(clip01(18.5, 19.2, t)), V = { x: lerp(250, 222, u) - kk[2], y: lerp(146, 118, u) - kk[3], z: lerp(1.0, 1.16, u) * (1 + kk[0]) };
    pinScene(t, V, { flick: 1 - clip01(18.4, 18.95, t), shake: 2.5 * (1 - clip01(18.4, 18.8, t)), eyes: 'closed', mouth: t < 18.7 ? 2 : 0 });
    const g = t - 18.4; if (g < 0.5) { GD.ca = Math.max(GD.ca, 3 * (1 - g / 0.5)); rocks(vX(V, TIP[0]), vY(V, PSL), g, 12, 200, 3.5, [137, 136, 135, 22], 9450, 240, -PI / 2, 2.4); }
    GD.mul = [1 - 0.12 * u, 1 - 0.12 * u, 1 - 0.06 * u];
  });

  /* ---------------------------------------------------------------- 19.2–20.0: the half-mask, close */
  function hollowFace(t, s, cx, cy) {
    // the body, turned to us: 26 × 16 units of night, the mask over the right half
    const bw = 26 * s, bh = 16 * s, x0 = cx - bw / 2, y0 = cy - bh / 2, f6 = fl(t * 6);
    w5Night(t, 30, 20, { noShards: true });
    light(cx, cy, 300, L_DARK, 0.5);
    // white fire off its edge
    for (let x = fl(x0 - 14); x < x0 + bw + 14; x++) { const hgt = 10 + 40 * vn(x * 0.09, t * 3.4, 1, 9460) * vn(x * 0.31, t * 5, 1, 9461) * 2; for (let q = 0; q < hgt; q++) { const u = q / hgt, y = y0 - q; if (y < LB) break; if (bay(x, fl(y)) < 1.15 - u) P(x, y, u < 0.2 ? 0 : u < 0.45 ? 22 : u < 0.7 ? 20 : 62); } }
    const X0 = Math.max(0, fl(x0)), X1 = Math.min(W - 1, fl(x0 + bw)), Y0 = Math.max(LB, fl(y0)), Y1 = Math.min(H - LB - 1, fl(y0 + bh));
    const lim = (v) => 13.4 + Math.sin(v * 1.9) * 1.3 + (vn(v * 2.2, 0, 1, 9462) - 0.5) * 3.2 - (v > 10 ? (v - 10) * 1.6 : 0), mh = 12.6;
    for (let y = Y0; y <= Y1; y++) for (let x = X0; x <= X1; x++) {
      const u = (x - x0) / s, v = (y - y0) / s, um = 26 - u, i = y * W + x;
      const e = Math.min(u, v, 26 - u, 16 - v);
      let c;
      if (e < 0.22 + 0.1 * Math.sin(x * 0.7 + t * 9)) c = 22; else if (e < 0.5 && ((x + y + fl(t * 10)) & 1)) c = 20;
      else { const h = ih(x, y, 9463); if (h < 0.012) { const tw = ih(x, y, 9464 + f6); c = h < 0.003 ? 22 : tw < 0.5 ? 57 : h < 0.007 ? 56 : 75; } else { const n = vn(x + t * 2, y, 26, 9465) + vn(x, y - t, 9, 9466) * 0.3; c = n > 0.86 ? 79 : n > 0.72 ? 78 : n > 0.58 ? 77 : n < 0.3 ? 0 : 134; } }
      // the mask (in its own half: um from its outer edge)
      const L = lim(v), inM = um > 0.9 && um < L && v > 0.9 && v < mh && !(v > mh - 2.4 && um < 3.2 - (mh - v)) ;
      if (inM) {
        const dE = Math.min(L - um, um - 0.9, v - 0.9, mh - v), n = vn(x, y, 14, 9467), l = 0.62 - (v / mh) * 0.5 + (um / 13) * 0.2 + (n - 0.5) * 0.3;
        c = l > 0.5 ? 64 : l > 0.3 ? (bay(x, y) < (l - 0.3) * 5 ? 64 : 65) : l > 0.12 ? (bay(x, y) < (l - 0.12) * 5.5 ? 65 : 66) : 66;
        if (dE < 0.16) c = 64; else if (dE < 0.5) c = L - um < 0.5 ? 67 : 66;                                              // the thickness of the porcelain at its broken edge
        // cracks: the long one down to the eye, hairlines off it
        const c1 = Math.abs(um - (7.2 - v * 0.36 + Math.sin(v * 2.3) * 0.5)), on1 = v < 4.2 || (v > 9.4 && v < 11.6);
        if (on1 && c1 < 0.11) c = 69; else if (on1 && c1 < 0.24 && um > 7.2 - v * 0.36) c = 64;
        const c2 = Math.abs(v - (3.1 + (um - 6) * 0.42 + Math.sin(um * 3) * 0.2)); if (um > 7.2 && um < 10.8 && c2 < 0.09) c = 68;
        const c3 = Math.abs(v - (10.3 - (um - 2) * 0.3)); if (um > 1.6 && um < 6 && c3 < 0.08) c = 68;
        if (n > 0.8 && bay(x, y) < 0.3) c = 66;
      } else if (um > 0.9 && um < L + 0.5 && v > 0.9 && v < mh + 0.4 && um >= L) c = 0;                                     // its shadow on the void
      BUF[i] = c;
    }
    // the eyes: the Unmaker's in the mask, the Sunderer's burning in the dark
    const open = 0.55 + 0.45 * eoc(clip01(19.2, 19.5, t)) - 0.25 * clip01(19.7, 20, t);
    const mx = x0 + (26 - 6.3) * s, my = y0 + 6.6 * s, R = 2.3 * s;
    for (let y = fl(my - R); y <= my + R; y++) for (let x = fl(mx - R * 1.25); x <= mx + R * 1.25; x++) { const dx = (x - mx) / (R * 1.25), dy = (y - my) / (R * 0.92 * open), d = dx * dx + dy * dy; if (d < 1 && x >= 0 && x < W && y >= LB && y < H - LB) BUF[y * W + x] = d > 0.8 ? 68 : d > 0.66 ? 69 : 0; }
    { const keep = BUF.slice(); spiralEye(mx, my, R * 0.86, t, 1); for (let y = fl(my - R); y <= my + R; y++) for (let x = fl(mx - R * 1.25); x <= mx + R * 1.25; x++) { if (x < 0 || x >= W || y < 0 || y >= H) continue; const dx = (x - mx) / (R * 1.25), dy = (y - my) / (R * 0.92 * open); if (dx * dx + dy * dy > 0.62) BUF[y * W + x] = keep[y * W + x]; } }
    light(mx, my, R * 3.4, L_MAG, 0.55);
    const kx = x0 + 6.3 * s, ky = y0 + 6.6 * s;
    for (let y = fl(ky - R * 2.4); y <= ky + R * 1.2; y++) for (let x = fl(kx - R * 1.5); x <= kx + R * 1.5; x++) {
      if (x < 0 || x >= W || y < LB || y >= H - LB) continue;
      const dx = (x - kx) / (R * 1.1), dy = (y - ky) / (R * 0.8 * open), d = dx * dx + dy * dy, fl2 = dy < 0 ? vn(x * 0.2, y * 0.12 + t * 7, 1, 9468) * 1.5 * (1 - Math.abs(dx)) : 0;
      if (d < 1) { const sl = Math.abs(dx) < 0.1 + 0.06 * Math.sin(t * 2) && Math.abs(dy) < 0.8; BUF[y * W + x] = sl ? 96 : d < 0.22 ? 22 : d < 0.42 ? 107 : d < 0.66 ? 105 : d < 0.86 ? 104 : 102; }
      else if (d < 1 + fl2 * 2.2 && dy < 0.2) { const e = (d - 1) / (fl2 * 2.2 + 0.001); if (bay(x, y) < 1.1 - e) BUF[y * W + x] = e < 0.3 ? 105 : e < 0.6 ? 103 : 102; }
      else if (d < 1.25 && dy > 0) BUF[y * W + x] = 101;
    }
    light(kx, ky, R * 3.6, L_CRIM, 0.6);
    // ash crossing the lens
    for (let k = 0; k < 40; k++) { const u = frac(ih(k, 1, 9469) + t * (0.12 + ih(k, 2, 9469) * 0.2)), x = W + 20 - u * (W + 60), y = LB + ih(k, 3, 9469) * (H - 2 * LB) + Math.sin(u * 9 + k) * 8, big = k % 5 === 0; rectF(x, y, big ? 3 : 1, big ? 2 : 1, k % 4 === 0 ? 121 : k % 4 === 1 ? 0 : 120); }
  }
  shot(19.2, 20.0, (lt, t) => { const u = clip01(19.2, 20.0, t); hollowFace(t, 18.5 + 2.2 * eoc(u), 240 + 6 * u, 164 - 3 * u); GD.vig = 0.5; });
  CAPS.push([19.2, 20.5, 's', 'HOLLOW', 'I AM EVERYTHING YOU SPENT.']);

  /* ---------------------------------------------------------------- 20.0–23.0: the low point */
  const litAt = (t) => { let l = 0; for (const s of SPK) if (t > s) l += 0.22 + 0.2 * Math.exp(-(t - s) * 4); return Math.min(1, l); };
  shot(20.0, 21.5, (lt, t) => {
    const u = clip01(20.0, 21.5, t), V = { x: lerp(262, 270, u), y: lerp(166, 172, u), z: lerp(1.22, 1.42, eio(u)) };
    pinScene(t, V, { lit: litAt(t), eyes: t > 21.15 ? 'narrow' : 'closed', shake: t > 21.15 ? 0.5 : 0 });
    const d = 0.3 - 0.16 * litAt(t); GD.mul = [1 - d, 1 - d, 1 - d * 0.6]; GD.sat = 0.86 + 0.2 * litAt(t); GD.vig = 0.5;
    if (t < 20.3) GD.fade = 1 - t + 20.0 > 0.7 ? 0 : 0;
  });
  // the hand, close: it closes on the black blade
  shot(21.5, 22.3, (lt, t) => {
    w5Night(t, 80, 40, { noShards: true });
    const ang = 0.98, ca = Math.cos(ang), sa = Math.sin(ang), cx = 236, cy = 138, curl = t < 21.86 ? 0.5 * eoc(clip01(21.5, 21.78, t)) : 0.5 + 0.5 * eob(clip01(21.86, 22.0, t)), sh = t > 21.86 ? 1.6 * Math.max(0.25, 1 - (t - 21.9) * 2) : 0.5;
    const jx = z5Sh(t, 1) * sh, jy = z5Sh(t, 2) * sh;
    const Lc = (u, v) => [cx + jx + u * ca - v * sa, cy + jy + u * sa + v * ca];           // blade-aligned coords → screen (u along the blade)
    const quad = (u0, v0, u1, v1, fn) => polyF([Lc(u0, v0), Lc(u1, v0), Lc(u1, v1), Lc(u0, v1)], fn);
    const skin = (x, y, lit) => { const n = vn(x, y, 7, 9470); return lit > 0.6 ? 37 : lit > 0.2 ? (bay(x, y) < (lit - 0.2) * 2.5 ? 37 : 35) : lit > -0.3 ? 35 : bay(x, y) < 0.5 + n * 0.3 ? 36 : 35; };
    // the forearm and palm, behind the blade
    quad(-26, 34, 26, 190, (x, y) => { const p = (x - cx) * ca + (y - cy) * sa; return Math.abs(p) > 24 ? 38 : skin(x, y, -p / 30); });
    quad(-40, -6, 40, 44, (x, y) => { const p = (x - cx) * ca + (y - cy) * sa, q = -(x - cx) * sa + (y - cy) * ca; return Math.abs(p) > 38 || q > 42 ? 38 : skin(x, y, -p / 46 - q / 80); });
    for (let k = 0; k < 3; k++) { const u0 = -38 + k * 26, ext = (1 - curl) * 40 + 6; quad(u0, -14 - ext, u0 + 24, -6, (x, y) => { const p = (x - cx) * ca + (y - cy) * sa, q = -(x - cx) * sa + (y - cy) * ca; return p < u0 + 2 || p > u0 + 22 || q < -12 - ext ? 38 : skin(x, y, 0.3 - (p - u0) / 30); }); }
    // the blade
    const [bx, by] = Lc(-340, 0);
    bigBlade(bx + jx * 0.3, by + jy * 0.3, ang, 760, 13, t, { form: 'void', flare: 0.5, noHilt: true });
    const cg = clip01(21.94, 22.3, t);
    if (cg > 0) for (let k = 0; k < 9; k++) { const sd = k & 1 ? 1 : -1; let u = sd * 30, v = (ih(k, 1, 9471) - 0.5) * 18; for (let q = 0; q < 12 * cg; q++) { const nu = u + sd * (8 + ih(k, q, 9472) * 10), nv = clamp(v + (ih(k, q, 9473) - 0.5) * 9, -11, 11), a = Lc(u, v), b = Lc(nu, nv); lineP(a[0], a[1], b[0], b[1], 22); if (q % 3 === 0) lineP(a[0], a[1] + 1, b[0], b[1] + 1, 140); u = nu; v = nv; } }
    // the fingers, closing over it; the thumb under
    for (let k = 0; k < 3; k++) { const u0 = -38 + k * 26, dn = -15 + curl * 34 + (k === 1 ? 2 : 0); quad(u0, -17, u0 + 24, dn, (x, y) => { const p = (x - cx - jx) * ca + (y - cy - jy) * sa, q = -(x - cx - jx) * sa + (y - cy - jy) * ca; return p < u0 + 2 || p > u0 + 22 || q < -15 || q > dn - 2 ? 38 : skin(x, y, 0.9 - (q + 15) / 16 - (p - u0) / 40); }); }
    quad(-58, 4, -36, 10 + curl * 16, (x, y) => { const p = (x - cx - jx) * ca + (y - cy - jy) * sa, q = -(x - cx - jx) * sa + (y - cy - jy) * ca; return p < -56 || q > 8 + curl * 16 || q < 6 ? 38 : skin(x, y, 0.2); });
    // cracks of light in the hand
    for (let k = 0; k < 6; k++) { let [x, y] = Lc(-30 + k * 12, 12 + (k % 3) * 9); for (let q = 0; q < 4; q++) { const nx = x + (ih(k, q, 9474) - 0.5) * 12 + 2, ny = y + 6 + ih(k, q, 9475) * 6; lineP(x, y, nx, ny, q < 1 ? 107 : cg > 0.2 ? 22 : 103); x = nx; y = ny; } }
    // the fourth spark
    { const g = t - 21.9, [sx, sy] = Lc(-4, -4); if (g < 0) { const u = 1 + g / 0.4, e = eio(clamp(u, 0, 1)), x = sx - 170 * (1 - e), y = sy - 90 * (1 - e) + Math.sin(u * 6) * 8 * (1 - u); light(x, y, 40, L_VIO, 0.7); discF(x, y, 6, 63); discF(x, y, 4.6, ORB[3][1]); discF(x - 1.4, y - 1.4, 2.4, ORB[3][2]); P(x - 2, y - 2, 22); for (let q = 1; q < 9; q++) { const e2 = eio(clamp(u - q * 0.03, 0, 1)); if (bay(q, fl(t * 30)) < 1 - q / 9) rectF(sx - 170 * (1 - e2), sy - 90 * (1 - e2), 2, 2, ORB[3][q < 4 ? 2 : 1]); } } else { shockRing(sx, sy, 6 + g * 260, 6 + g * 200, 3, [22, ORB[3][2], ORB[3][1]], 1 - g / 0.4); light(sx, sy, 150 * Math.max(0.3, 1 - g * 1.5), L_VIO, 0.8 * Math.max(0.25, 1 - g * 2)); light(sx, sy + 10, 70, L_GOLD, 0.5 * cg); if (g < 0.1) GD.ca = 2 * (1 - g / 0.1); } }
    for (let k = 0; k < 20; k++) { const u = frac(ih(k, 1, 9476) + t * 0.2), x = W + 10 - u * (W + 30), y = LB + ih(k, 2, 9476) * (H - 2 * LB); P(x, y, k % 2 ? 121 : 120); }
    GD.vig = 0.55;
  });
  CAPS.push([21.6, 22.9, 's', 'HERO', "THEN I'LL SPEND MORE."]);
  shot(22.3, 23.0, (lt, t) => {
    const u = clip01(22.3, 23.0, t), V = { x: 250, y: lerp(150, 140, u), z: lerp(1.05, 1.0, u) };
    pinScene(t, V, { lit: 1, eyes: 'angry', grip: 1, up: eio(u), drain: eic(u) * 0.9 + 0.1, hz: eio(u), shake: 0.6 + 1.6 * u, eEyes: u > 0.45 ? 'wide' : 'narrow' });
    GD.vig = 0.42; shk(1.6 * u * u);
  });
  WORLDS.pin = () => pinScene(22.99, { x: 250, y: 140, z: 1 }, { lit: 1, eyes: 'angry', grip: 1, up: 1, drain: 1, hz: 1 });
  }
