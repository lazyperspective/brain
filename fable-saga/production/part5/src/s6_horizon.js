  /* ================================================================ ACT IV/V — the horizon cut; only a shadow (29.4–40.0)
     29.4 two blades longer than the horizon cross and every shard of sky left bursts outward; the hero's blade and body
     crack; 31.0 the blade snaps; 32.0 it catches the black blade in its bare hand. 33.0 FURTHER: it takes hold of the
     horizon, the line of dawn itself, and draws it like a sword. 34.0 one horizontal cut across the whole frame: a white
     line on black, held, and then everything above the line slides. The Hollow comes apart, the sky heals shard by
     shard, and what is left falls back onto the cloud as a shadow. Dawn. 38.8 the shadow's eye blinks once. */
  {
  const S2 = 2.2, HYW = 178, YC = 138;
  // a burning line through (x0, y0) at a small angle: the horizon, or the horizon held as a blade
  function dawnLine(x0, y0, ang, t, burn, xa, xb, curve) {
    const sl = Math.tan(ang);
    for (let x = Math.max(0, fl(xa)); x < Math.min(W, xb); x++) {
      const y = Math.round(y0 + sl * (x - x0) - (curve ? curve(x) : 0)), hgt = (1.5 + 7 * Math.pow(vn(x * 0.35, t * 4.5, 1, 8630), 2) + 3 * vn(x * 0.08, t * 1.5, 1, 8631)) * burn;
      for (let q = 0; q < hgt; q++) { const u = q / hgt; if (bay(x, y - 2 - q) < 1.1 - u) P(x, y - 2 - q, u < 0.25 ? 140 : u < 0.5 ? 141 : u < 0.78 ? 110 : 105); }
      P(x, y + 2, bay(x, y + 2) < 0.5 ? 141 : 110); P(x, y - 1, 22); P(x, y, 22); P(x, y + 1, 140);
    }
    for (let x = Math.max(30, xa); x < Math.min(W, xb); x += 70) light(x, y0 + sl * (x - x0), 44, L_GOLD, 0.34 * burn);
  }
  const lineBg2 = (t, V, o) => w5Line(t, (V.x - 240) * 0.6 + t * 8, vY(V, HYW), Object.assign({ sunX: 330 - (V.x - 240) * 0.2 }, o || {}));
  /* ---------------------------------------------------------------- 29.4–34.0 */
  const xH = TR([
    { t: 29.4, x: 96, y: 150, S: S2, form: 'dawn', nosw: true, arm: -0.42, a: 0.2, sq: -0.2, cr: 0, eyes: 'glow', flip: false },
    { t: 29.6, x: 92, y: 150, a: 0.05, sq: 0.1, vib: 0.6, e: 'o' },
    { t: 30.9, x: 66, y: 152, a: -0.14, sq: 0.2, vib: 1.1, cr: 0.9 },
    { t: 31.0, x: 62, y: 152, a: -0.2, e: 'l' },
    { t: 31.2, x: 44, y: 158, a: -0.5, sq: 0.1, vib: 0, eyes: 'narrow', arm: 0.6, e: 'o' },                // thrown back, the hilt dropping
    { t: 31.55, x: 46, y: 160, a: -0.2, sq: 0.2, arm: 0.4 },
    { t: 31.9, x: 52, y: 156, a: 0, sq: 0.1, arm: -0.9, reach: 3, eyes: 'glow' },
    { t: 32.0, x: 56, y: 152, a: 0.08, sq: -0.12, arm: -1.05, reach: 7, e: EQ },                            // the catch
    { t: 32.2, x: 54, y: 154, sq: 0.12, vib: 0.8, e: 'o' },
    { t: 33.0, x: 56, y: 154, a: 0.05, vib: 0.5, arm2: null },
    { t: 33.14, x: 56, y: 154, arm2: [2.4, 10, 1] },                                                        // the other hand goes down to the horizon
    { t: 33.6, x: 60, y: 150, a: -0.22, sq: 0.1, vib: 0.3, arm2: [2.9, 10, 1] },
    { t: 33.86, x: 56, y: 150, a: -0.42, sq: 0.3, arm2: [3.5, 10, 1], arm: -0.4, reach: 2 },               // coiled
    { t: 34.0, x: 84, y: 156, a: 0.4, sq: -0.3, arm2: [1.9, 12, 1], vib: 0, e: EQ },
    { t: 34.4, x: 88, y: 158, a: 0.3, sq: 0 },
  ]);
  const xE = TR([
    { t: 29.4, x: 384, y: 150, S: S2, form: 'hnova', nosw: true, arm: -0.42, a: -0.2, sq: -0.2, flip: true, spread: 1, wl: 0, cr: 1, chip: 1, eyeC: false, eyes: 'narrow' },
    { t: 29.6, x: 386, y: 150, a: 0, sq: 0.1, vib: 0.4, e: 'o' },
    { t: 30.9, x: 352, y: 150, a: 0.14, sq: 0.1, vib: 0.7 },
    { t: 31.0, x: 344, y: 150, a: 0.3, sq: -0.15, vib: 0, arm: -0.2, e: 'l' },
    { t: 31.95, x: 322, y: 146, a: 0.42, arm: 0.1, sq: 0, e: 'l' },
    { t: 32.0, x: 318, y: 146, a: 0.3, sq: 0.2, eyes: 'wide', e: 'l' },
    { t: 32.6, x: 322, y: 146, a: 0.2, vib: 0.8, sq: 0.1 },
    { t: 33.5, x: 330, y: 144, a: -0.2, vib: 1.2, sq: 0.2 },                                                // heaving to free it
    { t: 33.9, x: 322, y: 142, a: 0.2, sq: 0, vib: 0.4 },
    { t: 34.0, x: 316, y: 140, a: 0.1 },
    { t: 34.4, x: 316, y: 140 },
  ]);
  const crossX = (t) => lerp(240, 196, eio(clip01(29.5, 30.9, t))) + z5Sh(t, 2) * 1.5, crossY = (t) => 96 + lerp(0, 10, clip01(29.5, 30.9, t)) + z5Sh(t, 4);
  function xView(t) {
    const kk = kick(t, [[29.4, 3, 0], [31.0, 2.4, PI], [32.0, 2.6, PI], [33.0, 1, -PI / 2]]);
    const a = eio(clip01(30.15, 30.9, t)), b = eio(clip01(31.05, 31.95, t)), c = eio(clip01(32.1, 32.9, t)), d = eoc(clip01(33.0, 33.25, t));
    let x = lerp(240, 170, a), y = 128, z = lerp(0.92, 1.2, a);
    x = lerp(x, 118, b); z = lerp(z, 1.7, b); y = lerp(y, 134, b);
    x = lerp(x, 104, c); z = lerp(z, 2.1, c); y = lerp(y, 126, c);
    x = lerp(x, 226, d); z = lerp(z, 1.0, d); y = lerp(y, 132, d);
    return { x: x - kk[2], y: y - kk[3], z: z * (1 + kk[0] * 0.6), r: kk[1] };
  }
  const BUR = []; for (let k = 0; k < 30; k++) BUR.push({ a: ih(k, 1, 9601) * TAU, r: 40 + ih(k, 2, 9601) * 200, v: 160 + ih(k, 3, 9601) * 300, s: 5 + ih(k, 4, 9601) * 12, view: ['dawn', 'city', 'ink', 'ocean', 'cath'][k % 5] });
  function xScene(t) {
    const HS = [[29.4, 0.13], [31.0, 0.1], [32.0, 0.13]], V = xView(t), tt = h5Stop(t, HS), frz = h5Frz(t, HS) ? 1.6 : 0;
    H5PX = V.x * 0.3; H5PY = 0;
    const take = t >= 33.3, hyS = vY(V, HYW);
    lineBg2(t, V, { noLine: t >= 33.0 });
    // every shard of sky that was left, bursting outward
    { const g = t - 29.4; if (g < 1.6) for (const B of BUR) { const d = B.r + B.v * eoc(g / 1.6) * 1.4, x = 240 + Math.cos(B.a) * d * 1.3, y = 120 + Math.sin(B.a) * d * 0.8, s = B.s * (1 - g / 1.8); if (x < -40 || x > W + 40) continue; h5Shard(shardPts(x, y, s * 1.5, s, g * 5 + B.a, fl(B.r), 5), B.view, 200 + B.r, 120, t, { seed: fl(B.r), glint: false }); } }
    const pe = h5Pose(xE, tt), ph = h5Pose(xH, tt);
    const E = h5F(xE, tt, { frz }, V);
    const HP = h5F(xH, tt, { frz }, V);
    const cx = vX(V, crossX(t)), cy = vY(V, crossY(t));
    // the blades
    const eh = [E.hand[0] - 3 * V.z, E.hand[1]], hh = [HP.hand[0] + 3 * V.z, HP.hand[1]];
    if (t < 31.0) {
      const ha = Math.atan2(cy - hh[1], cx - hh[0]), ea = Math.atan2(cy - eh[1], cx - eh[0]), crk = clip01(29.6, 30.95, t);
      bigBlade(eh[0], eh[1], ea, 1500, 6 * V.z, t, { form: 'void', flare: 0.6 });
      bigBlade(hh[0], hh[1], ha, 1500, 6 * V.z, t, { form: 'dawn', flare: 0.6, cracks: crk * 2.2 });
      // the cracks in the hero's blade, running back from the crossing toward its hand
      for (let k = 0; k < 6 * crk; k++) { const f = 1 - (k + 1) / 7 * crk, px = lerp(hh[0], cx, f), py = lerp(hh[1], cy, f); let x = px, y = py; for (let q = 0; q < 3; q++) { const nx = x + (ih(k, q, 9602) - 0.5) * 9, ny = y + (ih(k, q, 9603) - 0.5) * 9; lineP(x, y, nx, ny, 0); x = nx; y = ny; } if (fl(t * 20 + k) % 4 === 0) P(px, py - 3, 22); }
      // the crossing: light and dark grinding
      const g = t - 29.4;
      for (let k = 0; k < 40; k++) { const u = frac(ih(k, 1, 9604) + t * (2 + ih(k, 2, 9604) * 2.4)), sd = k & 1 ? 1 : -1, a = -PI / 2 + sd * (0.15 + ih(k, 3, 9604) * 1.4), v = (40 + ih(k, 4, 9604) * 130) * V.z, px = cx + Math.cos(a) * v * u, py = cy + Math.sin(a) * v * u + 70 * u * u; if (bay(fl(px), fl(py)) < 1.1 - u) lineP(px, py, px - Math.cos(a) * 4, py - Math.sin(a) * 4 + 2, k % 3 === 0 ? 22 : sd > 0 ? 74 : 141); }
      sparkle(cx, cy, 6 + 4 * Math.sin(t * 40), 22, 140); light(cx, cy, 90 + 12 * Math.sin(t * 31), L_WH, 0.7); shk(1.4);
      h5Heavy(cx, cy, g, 3.2, undefined, [22, 140, 74], 9605, 2, [140, 141, 56, 57, 73, 74], L_GOLD);
      if (g < 1.2) { shockRing(cx, cy, 20 + g * 520, 12 + g * 300, 3, [22, 140, 56], 1 - g / 1.2); for (let k = 0; k < 2; k++) shockRing(cx, cy, 10 + (g - k * 0.12) * 380, 6 + (g - k * 0.12) * 120, 2, [22, 74, 72], 1 - g / 0.9); }
    } else {
      // the hero's blade has snapped: the far part spins away; the black blade comes on, slowly, and is caught
      const g = t - 31.0, sx = vX(V, 196), sy = vY(V, 106);
      const ha0 = Math.atan2(sy - hh[1], sx - hh[0]);
      if (g < 0.5) bigBlade(hh[0], hh[1], ha0 + g * 0.8, 26 * V.z * (1 - g * 0.6), 6 * V.z, t, { form: 'dawn', flare: 0.3, cracks: 3, noHilt: true });
      if (g < 1.4) bigBlade(sx - 40 * g * V.z, sy - 120 * g * V.z + 150 * g * g * V.z, ha0 - g * 5.5, 150 * V.z, 6 * V.z, t, { form: 'dawn', flare: 0.4 * (1 - g / 1.4), cracks: 1 + g * 3, noHilt: true });
      if (g < 0.9) { rocks(sx, sy, g, 16, 240, 4 * V.z, [141, 140, 22, 22], 9606, 200); rocks(sx, sy, g, 10, 160, 3 * V.z, [138, 139, 56, 57], 9607, 200); }
      h5Heavy(sx, sy, g, 2.8, PI, [22, 140, 141], 9608, 1, [140, 141, 56, 57, 73, 74], L_GOLD);
      // the hilt, let go
      if (g > 0.15 && g < 1.2) { const q = g - 0.15, x = hh[0] - 10 * q, y = hh[1] + 10 + 260 * q * q; bigBlade(x, y, 1.2 + q * 9, 12 * V.z, 5 * V.z, t, { form: 'dawn', flare: 0, cracks: 3 }); }
      // the black blade
      const cg = t - 32.0, grab = [HP.hand[0] + 3 * V.z, HP.hand[1] - 4 * V.z];
      const tgt = cg >= 0 ? grab : [vX(V, lerp(196, 82, eio(clip01(31.0, 32.0, t)))), vY(V, lerp(106, 128, eio(clip01(31.0, 32.0, t))))];
      const ea = Math.atan2(tgt[1] - eh[1], tgt[0] - eh[0]) + (cg >= 0 && t < 33.9 ? z5Sh(t, 6) * 0.004 : 0), cr = cg >= 0 ? clip01(0, 1.6, cg) * 2.4 : 0;
      if (t < 33.93) bigBlade(eh[0], eh[1], ea, 1500, 6 * V.z, t, { form: 'void', flare: 0.6, cracks: cr });
      if (cg >= 0) {
        h5Heavy(grab[0], grab[1], cg, 3, 0, [22, 140, 74], 9609, 1, [140, 141, 56, 57, 73, 74], L_GOLD);
        if (cg < 0.8) { shockRing(grab[0], grab[1], 8 + cg * 600, 8 + cg * 600, 4, [22, 140, 56], 1 - cg / 0.8); }
        // white cracks running up the black blade from the hand
        if (t < 33.93) for (let k = 0; k < 10; k++) { let d = 6, x = grab[0], y = grab[1]; const reach = clip01(0.05, 1.8, cg) * (130 + k * 30) * V.z; while (d < reach) { const st = 7 + ih(k, fl(d), 9610) * 9, off = (ih(k, fl(d) + 3, 9611) - 0.5) * 9 * V.z; const bx = grab[0] - Math.cos(ea) * (d + st) + Math.sin(ea) * off, by = grab[1] - Math.sin(ea) * (d + st) - Math.cos(ea) * off; lineP(x, y, bx, by, 22); x = bx; y = by; d += st; } }
        for (let k = 0; k < 16; k++) { const u = frac(ih(k, 1, 9612) + t * 2.6), a = ih(k, 2, 9612) * TAU; if (bay(k, fl(t * 30)) < 1 - u) P(grab[0] + Math.cos(a) * 30 * u * V.z, grab[1] + Math.sin(a) * 30 * u * V.z + 20 * u * u, k % 2 ? 22 : 141); }
        light(grab[0], grab[1], 60, L_GOLD, 0.5);
      }
    }
    // FURTHER: the horizon. It bends up into the hand, comes free, and is held: the whole line of dawn, a blade
    if (t >= 33.0) {
      const g = t - 33.0, hand2 = h5Loc(ph, HP.x, HP.y, S2 * V.z, -12 + Math.cos(ph.arm2 ? ph.arm2[0] : 2.4) * 11, -2 + Math.sin(ph.arm2 ? ph.arm2[0] : 2.4) * 11);
      if (!take) { const pull = eoc(clip01(0.12, 0.3, g)) * (hyS - hand2[1]); dawnLine(0, hyS, 0, t, 1, 0, W, (x) => pull * Math.exp(-Math.pow((x - hand2[0]) / (30 + 60 * clip01(0.1, 0.3, g)), 2))); light(hand2[0], hand2[1], 80, L_GOLD, 0.7 * clip01(0.1, 0.3, g)); }
      else if (t < 34.0) { const ang = lerp(0, -0.34, eio(clip01(33.3, 33.84, t))) + (t > 33.84 ? 0.05 * Math.sin((t - 33.84) * 30) : 0), y0 = lerp(hyS, hand2[1], eoc(clip01(33.3, 33.45, t))); dawnLine(hand2[0], y0, ang, t, 1.4, 0, W); light(hand2[0], hand2[1], 90, L_GOLD, 0.8); }
      if (g < 0.5) { shockRing(hand2[0], hand2[1], 6 + g * 300, 4 + g * 120, 2, [22, 140, 141], 1 - g / 0.5); }
    }
    if (V.r) z5Cam(1, V.r, 240, 135);
    return { V, E, HP };
  }
  shot(29.4, 34.0, (lt, t) => { xScene(t); if (t > 31.05 && t < 32.0) { GD.sat = 0.86; GD.vig = 0.5; } });
  CAPS.push([33.0, 33.9, 'x', '', 'FURTHER!!', 58]);

  /* ---------------------------------------------------------------- 34.0–36.5: the cut, the slide, the healing */
  const HEALT = new Float32Array(GN); { const ord = []; for (let q = 0; q < GN; q++) ord.push([Math.hypot(GSX[q] - 352, (GSY[q] - 160) * 1.4) + ih(q, 1, 9620) * 60, q]); ord.sort((a, b) => a[0] - b[0]); ord.forEach(([, q], k) => { HEALT[q] = 34.95 + k / GN * 1.35; }); }
  const EFX = 316, EFY = 140, HLAND = [236, 163];
  function vScene(t) {
    const g = t - 34.0, V = { x: 226, y: 132, z: 1 }; H5PX = 68; H5PY = 0;
    if (g < 0.1) {                                                                     // the held frame: one white line on black
      BUF.fill(0); for (let x = 0; x < W; x++) { P(x, YC - 1, 22); P(x, YC, 22); P(x, YC + 1, 22); if (bay(x, YC - 2) < 0.5) P(x, YC - 2, 140); if (bay(x, YC + 2) < 0.5) P(x, YC + 2, 140); }
      GD.bloom = 0.5; GD.vig = 0; return;
    }
    const sg = t - 34.1, slide = Math.round(64 * eoc(clip01(0, 1.5, sg)) + 4 * sg);
    lineBg2(t, V, { burn: 1 - clip01(34.4, 35.2, t) * 0.6 });
    // the Hollow, cut through: it loses its hold on itself
    const gone = clip01(34.5, 35.5, t);
    const eK = TR([{ t: 0, x: EFX, y: EFY, S: S2, form: gone > 0.2 ? 'hollow' : 'hnova', nosw: true, arm: 0.4, a: 0.1 + 0.2 * gone, flip: true, spread: 1 - gone, wl: 0, cr: 1, chip: 1, eyeC: false, eyes: gone > 0.5 ? 'closed' : 'wide', alpha: 1 - gone * 0.96, aur: 1 - gone, glow: 1 - gone, nobob: true }, { t: 100, x: EFX, y: EFY }]);
    if (gone < 1) h5F(eK, t, { noLight: gone > 0.6 }, V);
    // everything above the line slides
    if (slide > 0) for (let y = LB; y < YC; y++) { const o = y * W; for (let x = W - 1; x >= 0; x--) BUF[o + x] = x - slide >= 0 ? BUF[o + x - slide] : 0; }
    for (let x = 0; x < W; x++) { const a = 1 - clip01(0.2, 1.6, sg); if (bay(x, YC) < a) { P(x, YC, 22); if (a > 0.6) P(x, YC + 1, 140); } }
    light(240, YC, 300, L_GOLD, 0.3 * (1 - clip01(0, 1, sg)));
    // the sky heals, shard by shard
    if (t > 34.9) {
      H5NEW.set(BUF); const nl = LIGHTS.length; w5Dawn(t, t * 6, 180, 352, 160); H5OLD.set(BUF); BUF.set(H5NEW);
      for (let y = LB; y < H - LB; y++) for (let x = 0; x < W; x++) { const i = y * W + x, q = GCELL[i], h = t - HEALT[q]; if (h < 0) continue; BUF[i] = GEDGE[i] && h < 0.5 ? (h < 0.1 ? 22 : bay(x, y) < 1 - h * 2 ? 135 : H5OLD[i]) : h < 0.1 && bay(x, y) < 0.5 - h * 5 ? 140 : H5OLD[i]; }
      let heal = 0; for (let q = 0; q < GN; q++) if (t > HEALT[q]) heal++; heal /= GN;
      LIGHTS.length = nl; light(352, 160, 200, L_WARM, 0.5 * heal);
    }
    // the ash blows out of it
    const ex = vX(V, EFX), ey = vY(V, EFY);
    if (t > 34.3 && t < 36.3) for (let k = 0; k < 150; k++) { const b = 34.3 + ih(k, 1, 9621) * 1.3, a = t - b; if (a < 0 || a > 1.2) continue; const top = k & 1, x = ex + (top ? slide : 0) + (ih(k, 2, 9621) - 0.5) * 56 + a * (50 + ih(k, 3, 9621) * 110) + Math.sin(a * 7 + k) * 5, y = ey + (ih(k, 4, 9621) - 0.5) * 40 - a * (10 + ih(k, 5, 9621) * 40) + 20 * a * a; if (bay(fl(x), fl(y)) > 1.2 - a) continue; const big = k % 4 === 0; rectF(x, y, big ? 2 : 1, big ? 2 : 1, k % 7 === 0 ? 72 : k % 7 === 3 ? 102 : k % 3 === 0 ? 0 : k % 3 === 1 ? 120 : 121); }
    // what is left of the mask, falling, its eye going out
    if (t > 34.5 && t < 36.45) { const f = clip01(34.5, 36.45, t), mx = ex + slide * 0.6 + 14 * Math.sin(f * 5), my = lerp(ey - 6, 196, f * f); z5MaskShard(mx, my, 0.62 * (1 - 0.4 * f), 0.4 + f * 2.2, Math.max(0, 1 - f * 1.5), [0, 0], t); if (f < 0.66) light(mx, my, 26, L_MAG, 0.5 * (1 - f * 1.5)); }
    // what is left of the rest: it shrinks, flattens, and falls back to the cloud as a shadow
    { const f = eio(clip01(34.9, 36.45, t)); if (t > 34.6) { const bx = lerp(ex, HLAND[0] - 44, f), by = lerp(ey + 12, 207, f * f), rx = lerp(15, 30, f * f) * (0.4 + 0.6 * clip01(34.6, 35.1, t)), ry = lerp(9, 4, eoc(f)); for (let y = fl(by - ry); y <= by + ry; y++) for (let x = fl(bx - rx); x <= bx + rx; x++) { const dx = (x - bx) / rx, dy = (y - by) / ry, d = dx * dx + dy * dy + (vn(x + t * 9, y, 4, 9622) - 0.5) * 0.5 * (1 - f); if (d < 1) P(x, y, d > 0.8 ? (bay(x, y) < 0.5 ? 2 : 63) : f > 0.8 ? 63 : 134); } } }
    // the hero: the stroke finished, it sinks toward the cloud
    const f = eio(clip01(34.6, 36.5, t));
    const hK = TR([{ t: 0, x: lerp(84, HLAND[0], f), y: lerp(156, HLAND[1] - 6, f) + Math.sin(t * 2) * 1.5, S: lerp(S2, 3, f), form: 'dawn', nosw: true, arm: 0.3, a: lerp(0.4, 0, eoc(clip01(34.1, 35.0, t))), sq: 0, spread: 1, arm2: t < 34.6 ? [1.9, 12, 1] : null, flap: 0.2 }, { t: 100, x: 0, y: 0 }]);
    hK[1].x = hK[0].x; hK[1].y = hK[0].y;
    h5F(hK, t, { rim: [1, -0.3, 22] }, V);
    if (t < 34.6) { const u = clip01(34.1, 34.6, t); dawnLine(0, YC, 0, t, 1 - u, 0, W * (1 - u * 0)); }
  }
  shot(34.0, 36.5, (lt, t) => vScene(t));
  CAPS.push([35.4, 36.9, 's', 'HOLLOW', '...I ONLY... FOLLOWED YOU.']);

  /* ---------------------------------------------------------------- 36.5–40.0: dawn */
  shot(36.5, 40.0, (lt, t) => {
    const V = { x: 240, y: 135 + 4 * eio(clip01(36.5, 40, t)), z: 1 + 0.04 * eio(clip01(36.5, 40, t)) };
    H5PX = 68; H5PY = 0;
    w5Dawn(t, t * 6, 180, 352, 160);
    // the shadow, lying still at its feet
    const sx = vX(V, HLAND[0] - 44), sy = vY(V, 207);
    for (let y = fl(sy - 5); y <= sy + 5; y++) for (let x = fl(sx - 34); x <= sx + 34; x++) { const dx = (x - sx) / 33, dy = (y - sy) / 4.4, d = dx * dx + dy * dy; if (d < 1) P(x, y, d > 0.78 ? (bay(x, y) < 0.5 ? 2 : 63) : 63); }
    // 38.8: its eye blinks, once
    { const g = t - 38.8; if (g >= 0 && g < 0.3) { const op = g < 0.07 ? g / 0.07 : g > 0.2 ? 1 - (g - 0.2) / 0.1 : 1, ex = sx - 8, ey = sy; rectF(ex - 4, ey - (op > 0.5 ? 1 : 0), 8, op > 0.5 ? 2 : 1, 73); rectF(ex - 1, ey - (op > 0.5 ? 1 : 0), 2, op > 0.5 ? 2 : 1, 75); light(ex, ey, 26, L_MAG, 0.8 * op); } }
    // the hero touches down; Dawnbreak leaves it
    const land = t - 36.5, fade = eio(clip01(36.75, 37.7, t)), sq = 0.3 * Math.exp(-land * 7) * Math.cos(land * 14);
    const base = { x: HLAND[0], y: HLAND[1] - 6 * Math.exp(-land * 9), S: 3, a: 0, sq, nosw: true, arm: 0.5, nobob: fade > 0.5 };
    const kP = TR([Object.assign({ t: 0, form: 'plain', cr: 0.5, eyes: t > 38.95 && t < 39.5 ? 'wide' : 'normal' }, base), Object.assign({ t: 100 }, base)]);
    const kD = TR([Object.assign({ t: 0, form: 'dawn', spread: 1 - 0.7 * fade, alpha: 1 - fade, aur: 1 - fade, glow: 1 - fade, ring: 1 - fade, flap: 0.14 }, base), Object.assign({ t: 100 }, base)]);
    if (fade > 0) { h5F(kP, t, { rim: [1, -0.3, 60] }, V); }
    if (fade < 1) h5F(kD, t, fade > 0 ? { noLight: fade > 0.6 } : { rim: [1, -0.3, 22] }, V);
    if (land < 0.5) { for (let k = 0; k < 14; k++) { const a = PI + ih(k, 1, 9630) * PI, v = 30 + ih(k, 2, 9630) * 60; cloudPuff(vX(V, HLAND[0]) + Math.cos(a) * v * land * 2, vY(V, 207) - Math.abs(Math.sin(a)) * 12 * land + 4, 5 * (1 - land * 2) + 1, [18, 19, 15, 16], 9631 + k); } }
    // motes of the form drifting off into the morning
    for (let k = 0; k < 30; k++) { const b = 36.7 + ih(k, 1, 9632) * 1.2, a = t - b; if (a < 0 || a > 1.6) continue; const x = vX(V, HLAND[0]) + (ih(k, 2, 9632) - 0.5) * 80 + a * 14, y = vY(V, HLAND[1]) + (ih(k, 3, 9632) - 0.5) * 50 - a * 40; if (bay(fl(x), fl(y)) < 1 - a / 1.6) P(x, y, k & 1 ? 22 : k % 4 ? 141 : 56); }
    if (t > 39.5) GD.fade = clip01(39.5, 40.0, t) * 0.9;
  }, { post: (lt, t) => {
    if (t < 37.5) return;
    const g = t - 37.5, s1 = 'FABLE 5.5', sc = g < 0.07 ? 6 : 5, w = textWidth(s1, sc);
    text(s1, 240 - w / 2, 44 - (sc - 5) * 3, (i, j, k) => (j < 2 ? 22 : k < 4 ? (j < 5 ? 56 : 55) : (j < 5 ? 59 : 58)), sc, 0);
    if (g > 0.5) { const s2 = 'PART V · THE HOLLOW'; text(s2, 240 - textWidth(s2, 2) / 2, 92, 21, 2, 0, fl((g - 0.5) * 30)); }
  } });
  }
