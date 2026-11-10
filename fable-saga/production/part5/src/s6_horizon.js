  /* ================================================================ ACT IV/V — the horizon cut; only a shadow (29.4–40.0)
     29.4 seen from far off, two blades longer than the horizon cross over the sun's rings and every shard of sky left bursts
     outward; the camera drives into the crossing, then onto the hero: its blade and its body cracking, pushed back. 31.0 the
     blade snaps, its pieces thrown at the lens; the bottom drops out. 32.0 a bare hand closes on the black blade and stops it
     dead. 33.0 FURTHER: the other hand reaches down to the horizon; the whole landscape bends toward it; the line of dawn comes
     free like a wire and is held, a blade the width of the world. 34.0 one horizontal cut: a white line on black, held three
     frames, and then everything above the line slides. The Hollow comes apart along it into ash; the sky heals shard by
     shard; what is left falls back onto the cloud as a shadow. Dawn. 38.8 the shadow's eye blinks once. */
  {
  const D5L = WORLDS.d5line, d6World = D5L.paint, d6Fore = D5L.fore, d6Stop = D5L.stop, d6Held = D5L.held, d6Hit = D5L.hit, d6Heavy = D5L.heavy, d6Hero = D5L.hero, d6Hol = D5L.hol, d6Horizon = D5L.horizon, d6On = D5L.on, D5 = D5L.D5;
  const S2 = 2.4, CX = 240, CY = 4;                                       // the crossing, in the climax's world
  /* ---------------------------------------------------------------- the fighters, 29.4–34.0 */
  const xH = TR([
    { t: 29.4, x: 20, y: 140, S: S2, form: 'dawn', nosw: true, arm: -0.5, a: 0.12, sq: -0.2, cr: 0.1, eyes: 'glow', flip: false, spread: 1.2, aur: 0.5, ws: 0.9 },
    { t: 29.6, x: 22, y: 140, a: 0.02, sq: 0.08, vib: 0.5, e: 'o' },
    { t: 30.45, x: 30, y: 128, a: -0.1, sq: 0.18, vib: 0.9, cr: 0.55, spread: 0.8 },
    { t: 30.98, x: 34, y: 127, a: -0.2, sq: 0.26, vib: 1.4, cr: 0.95, spread: 0.6, eyes: 'narrow' },
    { t: 31.0, x: 32, y: 128, e: 'l' },
    { t: 31.0001, nosw: false, sw: -0.5, swl: 7, arm: undefined },
    { t: 31.18, x: 4, y: 146, a: -1.3, sq: 0.1, vib: 0, cr: 1, spread: 0.4, sw: 0.6, e: 'o' },   // thrown back, tumbling, the stump in its hand
    { t: 31.45, x: -10, y: 160, a: -2.2, sq: 0.15, spread: 0.3, sw: 1.4, eyes: 'closed' },
    { t: 31.7, x: -4, y: 162, a: -0.9, sq: 0.1, spread: 0.6, sw: 1.0, eyes: 'narrow' },
    { t: 31.86, x: 12, y: 154, a: -0.1, sq: 0.05, arm2: [-0.4, 9, 1], eyes: 'glow' },
    { t: 32.0, x: 24, y: 152, a: 0.06, sq: -0.14, arm2: [-0.18, 16, 1], e: EQ },                // the catch
    { t: 32.2, x: 22, y: 152, sq: 0.14, vib: 0.9, e: 'o' },
    { t: 33.0, x: 30, y: 148, a: 0.04, vib: 0.5, cr: 0.8, sw: 0.9 },
    { t: 33.18, x: 32, y: 144, sw: 1.9, reach: 6, sq: -0.1 },                                    // the sword hand goes down to the horizon
    { t: 33.32, x: 34, y: 142, sw: 2.0, reach: 7, sq: 0.1, vib: 0.8 },
    { t: 33.62, x: 36, y: 136, sw: -0.3, reach: 2, sq: -0.15, a: -0.1, vib: 0.4 },               // it comes up: the line of dawn in its hand
    { t: 33.86, x: 30, y: 138, sw: 0.75, reach: 0, a: -0.22, sq: 0.3, vib: 0.2 },                // coiled
    { t: 34.0, x: 48, y: 140, sw: -0.15, a: 0.3, sq: -0.3, vib: 0, e: EQ },
  ]);
  const xE = TR([
    { t: 29.4, x: 460, y: 140, S: S2, form: 'hnova', nosw: true, arm: -0.5, a: -0.12, sq: -0.2, flip: true, spread: 1, wl: 0, chip: 1, eyeC: false, eyes: 'narrow', ws: 0.8 },
    { t: 29.6, x: 458, y: 140, a: 0, sq: 0.1, vib: 0.4, e: 'o' },
    { t: 30.98, x: 396, y: 122, a: 0.12, sq: 0.06, vib: 0.7 },
    { t: 31.0, x: 392, y: 122, a: 0.3, sq: -0.15, vib: 0, e: 'l' },
    { t: 31.95, x: 340, y: 132, a: 0.42, sq: 0, arm: 0.2, e: 'i' },
    { t: 32.0, x: 336, y: 134, a: 0.3, sq: 0.2, eyes: 'wide', e: 'l' },
    { t: 32.6, x: 340, y: 134, a: 0.2, vib: 0.8, sq: 0.1 },
    { t: 33.5, x: 346, y: 132, a: -0.2, vib: 1.3, sq: 0.2 },                                    // heaving to free it
    { t: 34.0, x: 334, y: 130, a: 0.1, vib: 0.4 },
  ]);
  const XHS = [[29.4, 0.134], [31.0, 0.134], [32.0, 0.167]];
  // where each blade points: at the crossing, until it snaps; then the black blade hunts the hero
  const crossPt = (t) => [CX - 30 * eio(clip01(29.6, 30.98, t)) + z5Sh(t, 2) * 1.2, CY + 10 * clip01(29.6, 30.98, t) + z5Sh(t, 4) * 0.8];
  /* ---------------------------------------------------------------- the cameras */
  function xView(t) {
    const kk = kick(t, [[29.4, 3.4, 0], [31.0, 2.8, PI + 0.4], [32.0, 2.6, PI], [33.25, 1.4, -PI / 2]]);
    let V;
    if (t < 29.95) { const u = eio(clip01(29.6, 29.95, t)); V = { x: lerp(240, CX - 6, u), y: lerp(108, CY + 30, u * u), z: lerp(0.62, 1.0, u * u) }; }
    else if (t < 30.45) { const u = clip01(29.95, 30.45, t); const c = crossPt(t); V = { x: c[0], y: c[1] + 4, z: lerp(2.6, 4.2, eio(u)) }; }
    else if (t < 31.0) { const u = clip01(30.45, 31.0, t); V = { x: 126 - 6 * u, y: 84 + 3 * u, z: lerp(1.28, 1.38, u) }; }
    else if (t < 31.95) { const u = eio(clip01(31.05, 31.9, t)); V = { x: lerp(150, 110, u), y: lerp(96, 136, u), z: lerp(1.25, 1.55, u) }; }
    else if (t < 32.45) { const u = eio(clip01(32.05, 32.45, t)); V = { x: lerp(54, 70, u), y: lerp(138, 140, u), z: lerp(3.1, 2.5, u) }; }
    else if (t < 33.0) { const u = eio(clip01(32.45, 33.0, t)); V = { x: lerp(130, 150, u), y: lerp(136, 146, u), z: lerp(1.2, 1.0, u) }; }
    else { const u = eio(clip01(33.0, 33.9, t)); V = { x: lerp(150, 140, u), y: lerp(146, 150, u), z: lerp(1.0, 1.08, u) }; }
    V.x -= kk[2] / V.z; V.y -= kk[3] / V.z; V.z *= 1 + kk[0] * 0.6; V.r = kk[1];
    return V;
  }
  // where a fighter's sword hand is, from its pose alone (so the world can bend toward it before anyone is drawn)
  function d6HandPt(p, V) {
    const sq = p.sq || 0, bw = Math.round(26 * (1 + sq * 0.5) / 2) * 2, bh = Math.max(10, Math.round(16 * (1 - sq * 0.4))), y0 = -Math.round(bh / 2), ah = Math.max(3, Math.round(bh * 0.32)), shY = y0 + Math.round(bh * 0.34) + ah / 2 - 0.5;
    const armA = p.arm !== undefined ? p.arm : clamp((p.sw || 0) * 0.45, -1.1, 0.9), r = 3 + Math.round(p.reach || 0);
    return h5Loc(p, vX(V, p.x), vY(V, p.y), (p.S || 2) * V.z, bw / 2 - 1 + Math.cos(armA) * r, shY + Math.sin(armA) * r + 0.5);
  }
  // the horizon of this world, on screen
  const HZW = 214;
  /* ---------------------------------------------------------------- the burst of sky, the blade's pieces */
  const BUR = []; for (let k = 0; k < 34; k++) BUR.push({ a: ih(k, 1, 9601) * TAU, r: 30 + ih(k, 2, 9601) * 160, v: 140 + ih(k, 3, 9601) * 320, s: 6 + ih(k, 4, 9601) * 16, view: ['dawn', 'city', 'ink', 'ocean', 'cath', 'night'][k % 6], sp: (ih(k, 5, 9601) - 0.5) * 6 });
  function xBurst(t, V, near) {
    const g = t - 29.4 - 0.134; if (g < -0.134 || g > 2.2) return;
    const gg = Math.max(0, g), cx = vX(V, CX), cy = vY(V, CY);
    for (let k = 0; k < BUR.length; k++) {
      const B = BUR[k]; if ((k % 3 === 0) !== !!near) continue;
      const d = (B.r + B.v * (1 - Math.exp(-gg * 1.6)) / 1.6 * 1.8) * V.z, x = cx + Math.cos(B.a) * d * 1.25, y = cy + Math.sin(B.a) * d * 0.8 + 30 * gg * gg * V.z, s = B.s * V.z * (near ? 1 + gg * 1.4 : 1) * (1 - clip01(1.6, 2.2, gg));
      if (s < 1 || x < -60 || x > W + 60 || y < LB - 60 || y > H - LB + 60) continue;
      h5Shard(shardPts(x, y, s * 1.5, s, gg * B.sp + B.a, fl(B.r), 6), B.view, 160 + B.r, 110 + (k % 4) * 20, t, { seed: k, glint: k % 4 === 0, th: near ? 3 : 0 });
    }
  }
  // the pieces of the snapped blade: half white, half black, tumbling at the lens
  const SNP = []; for (let k = 0; k < 16; k++) SNP.push({ a: -0.45 + (ih(k, 1, 9640) - 0.5) * 2.2, v: 120 + ih(k, 2, 9640) * 380, s: 5 + ih(k, 3, 9640) * 6, w: (ih(k, 4, 9640) - 0.5) * 16, grow: ih(k, 5, 9640) < 0.4, f: ih(k, 6, 9640) });
  function xShards(t, V, sx, sy, ba) {
    const g = t < 31.0 ? -1 : t < 31.134 ? 0.004 : t - 31.134; if (g < 0 || g > 1.15) return;
    const slow = t > 31.25 ? 0.75 : 1;
    for (const B of SNP) {
      if (g > 0.55 + B.f * 0.35) continue;
      const gg = g < 0.12 ? g : 0.12 + (g - 0.12) * slow, d = 8 + B.v * gg * (1 + gg), x = sx + Math.cos(B.a) * d * V.z + Math.cos(ba) * (B.f - 0.5) * 40 * V.z, y = sy + Math.sin(B.a) * d * V.z + Math.sin(ba) * (B.f - 0.5) * 40 * V.z + 60 * gg * gg, s = B.s * V.z * (B.grow ? 1 + gg * 2.2 : 1);
      const rot = ba + gg * B.w * 1.8, c = Math.cos(rot), sn = Math.sin(rot), L = s * 2.4, w = s * 0.8;
      const pts = [[-L, -w], [L * 0.7, -w * 1.1], [L, w * 0.2], [-L * 0.8, w]].map(([px, py]) => [x + px * c - py * sn, y + px * sn + py * c]);
      polyF(pts, (X, Y) => { const lx = (X - x) * -sn + (Y - y) * c; return lx < -w * 0.1 ? (bay(X, Y) < 0.5 ? 140 : 141) : lx < w * 0.1 ? 22 : (bay(X, Y) < 0.1 ? 57 : bay(X, Y) < 0.5 ? 139 : 4); });
      for (let i = 0; i < 4; i++) lineP(pts[i][0], pts[i][1], pts[(i + 1) % 4][0], pts[(i + 1) % 4][1], i < 2 ? 22 : 57);
      if (g > 0.1) light(x, y, 14 * V.z, L_GOLD, 0.3);
    }
  }
  /* ---------------------------------------------------------------- 29.4–34.0 */
  function xScene(t) {
    const V = xView(t);
    const tt = d6Stop(t, XHS), frz = d6Held(t, XHS) ? 1.6 : 0;
    H5PX = V.x * 0.3; H5PY = V.y * 0.1;
    const take = t >= 33.28, peel = clip01(33.28, 33.62, t);
    const bendT = t >= 33.0 && t < 33.62;
    d6World(t, V, { sunX: 240, hz: HZW, noLine: t >= 33.0, burn: t < 33.3 ? 1 : lerp(1, 0.35, peel), dim: t > 31.05 && t < 31.95 ? 0.18 : 0 });
    xBurst(t, V, false);
    const ph = h5Pose(xH, tt), pe = h5Pose(xE, tt);
    // FURTHER: the sword hand reaches down; the line lifts into it; the world bends toward it
    let hand1 = null;
    if (t >= 33.0) {
      const g = t - 33.0, hy = D5.hy;
      hand1 = d6HandPt(ph, V);
      if (!take) {
        const pull = eoc(clip01(0.06, 0.26, g)) * Math.max(0, hy - hand1[1]), wid = 40 + 150 * eoc(clip01(0.06, 0.28, g));
        warp(hand1[0], hand1[1] + 20, 320, 0.75 * eoc(clip01(0.04, 0.28, g)), 1.1);
        d6Horizon(t, hy, 1.2, 0, W, (x) => pull * Math.exp(-Math.pow((x - hand1[0]) / wid, 2)), V.x);
        light(hand1[0], hand1[1], 90, L_GOLD, 0.7 * clip01(0.1, 0.3, g));
      } else {
        warp(hand1[0], hand1[1] + 20, 320, 0.75 * (1 - peel), 1.1);
      }
    }
    const E = d6Hol(xE, tt, V, { frz });
    if (E) h5Ash(xE, tt, V, 22, 30, -30, [0, 78, 20, 0, 22, 77]);
    const HP = d6Hero(xH, tt, V, { frz, motes: 16 });
    const cp = crossPt(t), cx = vX(V, cp[0]), cy = vY(V, cp[1]);
    const eh = E.hand, hh = HP.hand;
    if (t < 31.0) {
      // the two blades, the length of the world, crossed
      const ha = Math.atan2(cy - hh[1], cx - hh[0]), ea = Math.atan2(cy - eh[1], cx - eh[0]), crk = clip01(29.7, 30.98, t);
      const bw = Math.max(4, 6 * V.z);
      bigBlade(eh[0], eh[1], ea, 2000, bw, t, { form: 'void', flare: 0.6 });
      bigBlade(hh[0], hh[1], ha, 2000, bw, t, { form: 'dawn', flare: 0.6, cracks: crk * 2.4 });
      // cracks running back down the hero's blade from the crossing
      for (let k = 0; k < 8 * crk; k++) { const f = 1 - (k + 1) / 9 * crk, px = lerp(hh[0], cx, f), py = lerp(hh[1], cy, f); let x = px, y = py; for (let q = 0; q < 3; q++) { const nx = x + (ih(k, q, 9602) - 0.5) * 4 * V.z, ny = y + (ih(k, q, 9603) - 0.5) * 4 * V.z; lineP(x, y, nx, ny, 0); x = nx; y = ny; } if (fl(t * 20 + k) % 4 === 0) P(px, py - 2, 22); }
      // the crossing: light and dark grinding
      for (let k = 0; k < 60; k++) { const u = frac(ih(k, 1, 9604) + t * (2 + ih(k, 2, 9604) * 2.4)), sd = k & 1 ? 1 : -1, a = -PI / 2 + sd * (0.2 + ih(k, 3, 9604) * 1.3), v = (40 + ih(k, 4, 9604) * 160) * Math.min(2.2, V.z), px = cx + Math.cos(a) * v * u, py = cy + Math.sin(a) * v * u + 80 * u * u; if (bay(fl(px), fl(py)) < 1.1 - u) lineP(px, py, px - Math.cos(a) * 3 * Math.min(3, V.z), py - Math.sin(a) * 3 * Math.min(3, V.z) + 2, k % 3 === 0 ? 22 : sd > 0 ? 74 : 141); }
      sparkle(cx, cy, (6 + 4 * Math.sin(t * 40)) * Math.min(2.5, V.z), 22, 140); light(cx, cy, (70 + 12 * Math.sin(t * 31)) * Math.min(2.5, V.z), L_WH, 0.6); shk(1.2 + (t > 29.95 ? 1.2 : 0));
      // 29.4: the clash itself
      d6Hit(cx, cy, t, 29.4, 0.134, 3, undefined, [22, 140, 74], 9605, 2, [22, 140, 141, 74, 56, 57], L_GOLD);
      { const g = t - 29.4 - 0.1; if (g > 0 && g < 1.4) { for (let k = 0; k < 3; k++) { const gk = g - k * 0.14; if (gk > 0 && gk < 1) shockRing(cx, cy, 10 + gk * 700 * V.z, 4 + gk * 180 * V.z, 3 - k, [22, k ? 141 : 140, k ? 110 : 56], 1 - gk); } } }
      // the rings of the world shiver at the clash: the horizon flattened by the shockwave
      if (t > 29.5 && t < 30.2) { const g = t - 29.5, hy = D5.hy; for (let x = 0; x < W; x++) { const d = Math.abs(x - cx) - g * 700; if (Math.abs(d) < 10) { P(x, hy - 1 - (10 - Math.abs(d)) * 0.6, 22); P(x, hy - 2 - (10 - Math.abs(d)) * 0.6, 141); } } }
    } else {
      // the snap: the hero's blade is a stump; the black blade comes on, slowly, then fast, and is caught
      const g = t - 31.0, s0 = 0.42, ha0 = Math.atan2(vY(V, CY + 4) - hh[1], vX(V, CX - 28) - hh[0]);
      const sx = hh[0] + Math.cos(ha0) * 150 * V.z * s0, sy = hh[1] + Math.sin(ha0) * 150 * V.z * s0;
      if (g < 0.134) { bigBlade(hh[0], hh[1], ha0, 150 * V.z * s0, 6 * V.z, t, { form: 'dawn', flare: 0.6, cracks: 3 }); bigBlade(sx + Math.cos(ha0) * 3, sy + Math.sin(ha0) * 3, ha0 + 0.05, 600, 6 * V.z, t, { form: 'dawn', flare: 0.4, cracks: 4, noHilt: true }); }
      if (t < 31.4) { const u = clip01(31.0, 31.4, t); for (let k = 0; k < 7; k++) { const a = ha0 + PI / 2 + (k - 3) * 0.5, L = (30 + 60 * u) * V.z; lineF(sx, sy, sx + Math.cos(a) * L, sy + Math.sin(a) * L, (X, Y, f) => { if (bay(X, Y) < 1 - f - u * 0.6) P(X, Y, 22); }); } }
      xShards(t, V, sx, sy, ha0);
      d6Hit(sx, sy, t, 31.0, 0.134, 3, ha0 + PI, [22, 140, 141], 9608, 1, [22, 140, 141, 56, 57, 138, 74], L_GOLD);
      // the black blade
      const cg = t - 32.0, grab = HP.p.arm2 ? h5Loc(HP.p, HP.x, HP.y, HP.S, -12 + Math.cos(HP.p.arm2[0]) * (HP.p.arm2[1] + 1), -2.6 + Math.sin(HP.p.arm2[0]) * (HP.p.arm2[1] + 1)) : [hh[0], hh[1]];
      const tipT = clip01(31.0, 32.0, t), tip = cg >= 0 ? [grab[0] - 14 * V.z, grab[1] + 3 * V.z] : [vX(V, lerp(CX + 60, 20, Math.pow(tipT, 2.4))), vY(V, lerp(CY + 30, 150, Math.pow(tipT, 2.4)))];
      const ea = Math.atan2(tip[1] - eh[1], tip[0] - eh[0]) + (cg >= 0 && t < 33.9 ? z5Sh(t, 6) * 0.004 : 0), el = Math.hypot(tip[0] - eh[0], tip[1] - eh[1]), cr = cg >= 0 ? clip01(0, 1.6, cg) * 2.4 : 0;
      if (t < 34.0) bigBlade(eh[0], eh[1], ea, el, 6 * V.z, t, { form: 'void', flare: 0.6, cracks: cr });
      if (cg >= 0 && t < 34.0) {
        for (let k = 0; k < 10; k++) { let d = 6, x = grab[0], y = grab[1]; const reach = clip01(0.05, 1.8, cg) * (110 + k * 26) * V.z; while (d < reach) { const st = 7 + ih(k, fl(d), 9610) * 9, off = (ih(k, fl(d) + 3, 9611) - 0.5) * 8 * V.z; const bx = grab[0] + Math.cos(ea + PI) * -(d + st) + Math.sin(ea) * off, by = grab[1] + Math.sin(ea + PI) * -(d + st) - Math.cos(ea) * off; lineP(x, y, bx, by, 22); x = bx; y = by; d += st; } }
        const zz = Math.min(V.z, 3), cb = Math.exp(-cg * 1.2);
        // the bare fist, closed on the edge (drawn over the blade it holds)
        { const fs = 4.4 * HP.S, fa = (HP.p.arm2 ? HP.p.arm2[0] : 0) + HP.p.ang, c = Math.cos(fa), s = Math.sin(fa), fx = grab[0] - c * fs * 0.2, fy = grab[1] - s * fs * 0.2;
          const q = [[-fs, -fs * 0.9], [fs * 0.8, -fs], [fs, fs * 0.9], [-fs * 0.9, fs]].map(([px, py]) => [fx + px * c - py * s, fy + px * s + py * c]);
          polyF(q, (X, Y) => { const lx = (X - fx) * c + (Y - fy) * s, ly = -(X - fx) * s + (Y - fy) * c; if (ih(X, Y, 9652) < 0.02) return 57; return ly < -fs * 0.7 ? 56 : lx > fs * 0.7 ? 141 : lx > fs * 0.45 && Math.abs(((ly + fs) % (fs * 0.66)) - fs * 0.33) > fs * 0.27 ? 138 : bay(X, Y) < 0.2 ? 5 : 4; });
          for (let i = 0; i < 4; i++) { lineP(q[i][0], q[i][1], q[(i + 1) % 4][0], q[(i + 1) % 4][1], i === 0 ? 22 : i === 1 ? 141 : 57); }
          for (let k = 0; k < 4; k++) { const px = fx + (ih(k, 1, 9659) - 0.5) * fs * 1.4, py = fy + (ih(k, 2, 9659) - 0.5) * fs * 1.4, a = ih(k, 3, 9659) * TAU, L = fs * (0.3 + 0.4 * clip01(0, 0.6, cg)); lineP(px, py, px + Math.cos(a) * L, py + Math.sin(a) * L, 22); } }
        for (let k = 0; k < 70; k++) { const sd = k & 1 ? 1 : -1, a = ea + (sd > 0 ? PI : 0) + (ih(k, 1, 9612) - 0.5) * 1.3 + sd * 0.25, f = frac(ih(k, 2, 9612) + t * (1.6 + ih(k, 3, 9612))), v = (20 + ih(k, 4, 9612) * 70) * zz * f, px = grab[0] + Math.cos(a) * v, py = grab[1] + Math.sin(a) * v + 30 * zz * f * f; if (bay(fl(px), fl(py)) < (1.1 - f) * (0.4 + 0.6 * cb)) lineP(px, py, px - Math.cos(a) * 2 * zz, py - Math.sin(a) * 2 * zz + 1, k % 3 === 0 ? 22 : k % 3 === 1 ? 141 : 74); }
        light(grab[0], grab[1], 40 * zz, L_GOLD, 0.5 + 0.3 * cb); light(grab[0] + 30 * zz, grab[1] - 10 * zz, 30 * zz, L_MAG, 0.3);
        d6Hit(grab[0], grab[1], t, 32.0, 0.167, 2.6, ea + PI, [22, 141, 74], 9658, 1, [22, 141, 140, 57, 74, 75, 139], L_GOLD);
        if (cg < 0.6) { const u = cg / 0.6; shockRing(grab[0], grab[1], 10 + u * 140 * zz, 10 + u * 100 * zz, 4, [22, 141, 110], 1 - u); }
      }
    }
    // FURTHER: the line of dawn, taken
    if (take && t < 34.0 && hand1) {
      const HP2 = HP.hand, ang = t < 33.62 ? lerp(0.02, -0.12, peel) : t < 33.86 ? lerp(-0.12, -0.3, eio(clip01(33.62, 33.86, t))) : lerp(-0.3, 0.22, eio(clip01(33.86, 34.0, t)));
      const wave = (1 - clip01(33.28, 33.8, t)) * 14, y0 = HP2[1];
      d6Horizon(t, y0, 1.5, 0, W, (x) => -(Math.tan(ang) * (x - HP2[0])) - Math.sin((x - HP2[0]) * 0.03 - t * 18) * wave * Math.min(1, Math.abs(x - HP2[0]) / 60), V.x);
      light(HP2[0], HP2[1], 110, L_GOLD, 0.9); sparkle(HP2[0], HP2[1], 6 + 3 * Math.sin(t * 30), 22, 140);
      for (let x = 0; x < W; x += 40) light(x, y0 - Math.tan(ang) * (x - HP2[0]), 50, L_WARM, 0.35);
      if (t < 33.5) { const g = t - 33.28; shockRing(HP2[0], HP2[1], 6 + g * 500, 4 + g * 160, 3, [22, 140, 141], 1 - g / 0.22); }
    }
    xBurst(t, V, true);
    // driving into the crossing: shards of sky streaming past the lens, the contact grinding white
    if (t >= 29.95 && t < 30.45) {
      const u = clip01(29.95, 30.45, t), cx2 = vX(V, crossPt(t)[0]), cy2 = vY(V, crossPt(t)[1]);
      for (let k = 0; k < 14; k++) { const ph = frac(ih(k, 1, 9660) + u * 1.4), a = ih(k, 2, 9660) * TAU, d = 20 + ph * ph * 420, s = (4 + ph * 40) * (0.6 + ih(k, 3, 9660) * 0.6), x = cx2 + Math.cos(a) * d * 1.3, y = cy2 + Math.sin(a) * d * 0.8; if (x < -80 || x > W + 80 || y < LB - 80 || y > H - LB + 80) continue; h5Shard(shardPts(x, y, s * 1.4, s, a + ph * 3, 120 + k, 6), ['dawn', 'city', 'ink', 'ocean', 'cath', 'night'][k % 6], 120 + k * 22, 90 + (k % 5) * 25, t, { seed: k, th: 2 + s * 0.1, glint: false }); }
      for (let k = 0; k < 6; k++) { const a = ih(k, fl(t * 30), 9661) * TAU, L = 30 + ih(k, 1, 9661) * 90; lineF(cx2, cy2, cx2 + Math.cos(a) * L, cy2 + Math.sin(a) * L, (X, Y, f) => { if (bay(X, Y) < 1 - f) P(X, Y, f < 0.3 ? 22 : k & 1 ? 141 : 74); }); }
      discF(cx2, cy2, 5 + 3 * Math.sin(t * 50), 22); light(cx2, cy2, 120, L_WH, 0.5);
    }
    if (t < 31.95) d6Fore(t, V, { amt: t < 29.95 ? 0.5 : 0 });
    if (V.r) z5Cam(1, V.r, 240, 135);
  }
  shot(29.4, 34.0, (lt, t) => { xScene(t); if (t > 31.12 && t < 31.95) { GD.sat = 0.72; GD.vig = 0.55; } });
  CAPS.push([33.0, 33.9, 'x', '', 'FURTHER!!', 58]);

  /* ---------------------------------------------------------------- 34.0–36.5: the cut, the slide, the healing */
  const YC = 140;
  const HEALT = new Float32Array(GN); { const ord = []; for (let q = 0; q < GN; q++) ord.push([Math.hypot(GSX[q] - 352, (GSY[q] - 160) * 1.4) + ih(q, 1, 9620) * 60, q]); ord.sort((a, b) => a[0] - b[0]); ord.forEach(([, q], k) => { HEALT[q] = 34.95 + k / GN * 1.35; }); }
  const EFX = 330, EFY = 136, HLAND = [236, 163];
  function vScene(t) {
    const g = t - 34.0, V = { x: 240, y: 135, z: 1 }; H5PX = 60; H5PY = 0;
    if (g < 0.1) {                                                                     // the held frame: one white line on black
      BUF.fill(0);
      for (let x = 0; x < W; x++) { const u = Math.abs(x - 250) / 250, th = Math.max(0, 2.2 - u * 1.6); for (let q = -2; q <= 2; q++) { const d = Math.abs(q); if (d <= th) P(x, YC + q, 22); else if (d <= th + 1 && bay(x, YC + q) < 0.5) P(x, YC + q, 140); } }
      GD.bloom = 0.55; GD.vig = 0; GD.thr = 0.7; return;
    }
    const sg = t - 34.1, slide = Math.round(96 * eoc(clip01(0, 1.4, sg)) + 8 * sg), gap = Math.round(11 * eoc(clip01(0, 0.45, sg)) * (1 - clip01(0.8, 1.9, sg)));
    d6World(t, V, { sunX: 300, hz: HZW, burn: 0.35 + 0.4 * clip01(34.4, 35.4, t), noLine: true });
    // the Hollow, cut through: it loses its hold on itself
    const gone = clip01(34.45, 35.4, t);
    const eK = TR([{ t: 0, x: EFX, y: EFY, S: S2, form: gone > 0.2 ? 'hollow' : 'hnova', nosw: true, arm: 0.4, a: 0.1 + 0.2 * gone, flip: true, spread: 1 - gone, wl: 0, cr: 1, chip: 1, eyeC: false, eyes: gone > 0.5 ? 'closed' : 'wide', alpha: 1 - gone * 0.96, aur: 1 - gone, glow: 1 - gone, nobob: true, ws: 0.8 }, { t: 100, x: EFX, y: EFY }]);
    if (gone < 1) { const E = h5F(eK, t, { noLight: gone > 0.6 }, V); if (E) { // the cut edges crumbling to ash
      for (let x = Math.max(0, SMB[0]); x <= Math.min(W - 1, SMB[2]); x++) for (let q = -2; q <= 2; q++) { const i = (YC + q) * W + x; if (SMASK[i] && bay(x, YC + q) < 0.8 - gone * 0.5) BUF[i] = q === 0 ? 22 : (fl(t * 20 + x) % 3 ? 74 : 75); } } }
    // everything above the line slides
    if (slide > 0) for (let y = LB; y < YC; y++) { const o = y * W, sy = Math.min(YC - 1, y + gap), os = sy * W; for (let x = W - 1; x >= 0; x--) BUF[o + x] = y >= YC - gap ? (y > YC - gap + 1 && y < YC - 1 ? (Math.abs(y - (YC - gap / 2)) < gap * 0.22 ? 22 : bay(x, y) < 0.5 ? 140 : 16) : 141) : x - slide >= 0 ? BUF[os + x - slide] : (bay(x, y) < 0.08 ? 139 : 0); }
    for (let x = 0; x < W; x++) { const a = 1 - clip01(0.3, 1.8, sg); if (bay(x, YC) < a + 0.2) { P(x, YC, 22); if (a > 0.4) P(x, YC + 1, 140); P(x, YC - gap - 1, a > 0.5 ? 22 : 141); } }
    for (let x = 0; x < W; x += 24) light(x + 12, YC - gap / 2, 30 + gap * 3, L_GOLD, 0.25 + gap * 0.03);
    if (sg < 1.4) for (let y = YC + 2; y < H - LB; y++) { const k = 0.35 * (1 - sg / 1.4) * (1 - (y - YC) / 140); if (k > 0.02) for (let x = 0; x < W; x++) tintI(y * W + x, x, y, T_DARK, k); }
    // sparks off the whole length of the cut
    if (sg < 1.2) for (let k = 0; k < 90; k++) { const x = ih(k, 1, 9623) * W, f = frac(ih(k, 2, 9623) + t * (1.2 + ih(k, 3, 9623))), up = k & 1 ? -1 : 1, y = YC + up * (2 + f * (6 + ih(k, 4, 9623) * 26)) + 30 * f * f; if (bay(fl(x), fl(y)) < (1.1 - f) * (1 - sg / 1.2)) lineP(x + f * 20, y, x + f * 20 - 3, y - up, k % 3 ? 141 : 22); }
    // the upper world tearing past: a smear along the cut while it is fast
    if (sg < 0.55) { const amt = 46 * (1 - sg / 0.55), f = fl(t * 30); TMP.set(BUF); for (let y = LB; y < YC - gap - 1; y++) { const o = y * W, k0 = amt * (0.4 + 0.6 * (1 - (YC - y) / 140)); for (let x = 0; x < W; x++) { const sx = x - fl(ih(x >> 2, y, f + 931) * k0); BUF[o + x] = TMP[o + clamp(sx, 0, W - 1)]; } } }
    light(240, YC, 320, L_GOLD, 0.32 * (1 - clip01(0, 1, sg)));
    // the sky heals, shard by shard
    if (t > 34.9) {
      H5NEW.set(BUF); const nl = LIGHTS.length; w5Dawn(t, t * 6, 180, 352, 160); H5OLD.set(BUF); BUF.set(H5NEW);
      for (let y = LB; y < H - LB; y++) for (let x = 0; x < W; x++) { const i = y * W + x, q = GCELL[i], h = t - HEALT[q]; if (h < 0) continue; BUF[i] = GEDGE[i] && h < 0.5 ? (h < 0.1 ? 22 : bay(x, y) < 1 - h * 2 ? 135 : H5OLD[i]) : h < 0.1 && bay(x, y) < 0.5 - h * 5 ? 140 : H5OLD[i]; }
      let heal = 0; for (let q = 0; q < GN; q++) if (t > HEALT[q]) heal++; heal /= GN;
      LIGHTS.length = nl; light(352, 160, 200, L_WARM, 0.5 * heal);
      // the last shards of the line-world tumbling away as they are replaced
      for (let q = 0; q < GN; q++) { const h = t - HEALT[q]; if (h < 0 || h > 0.7) continue; const x = GSX[q] + h * 60, y = GSY[q] - h * 30 + 160 * h * h, r = 9 * (1 - h / 0.7); if (r > 1) { const pts = shardPts(x, y, r * 1.4, r, h * 6 + q, q, 5); polyF(pts, () => 0); for (let i = 0, j = 4; i < 5; j = i++) lineP(pts[j][0], pts[j][1], pts[i][0], pts[i][1], q & 1 ? 141 : 57); } }
    }
    // the ash blows out of it
    const ex = vX(V, EFX), ey = vY(V, EFY);
    if (t > 34.15 && t < 36.4) for (let k = 0; k < 190; k++) { const b = 34.15 + ih(k, 1, 9621) * 1.4, a = t - b; if (a < 0 || a > 1.3) continue; const top = k & 1, x = ex + (top ? slide : 0) + (ih(k, 2, 9621) - 0.5) * 60 + a * (60 + ih(k, 3, 9621) * 130) + Math.sin(a * 7 + k) * 5, y = ey + (top ? -1 : 1) * ih(k, 4, 9621) * 22 - a * (10 + ih(k, 5, 9621) * 40) + 20 * a * a; if (bay(fl(x), fl(y)) > 1.2 - a) continue; const big = k % 4 === 0; rectF(x, y, big ? 2 : 1, big ? 2 : 1, k % 7 === 0 ? 72 : k % 7 === 3 ? 102 : k % 3 === 0 ? 0 : k % 3 === 1 ? 120 : 121); }
    // what is left of the mask, falling, its eye going out
    if (t > 34.5 && t < 36.45) { const f = clip01(34.5, 36.45, t), mx = ex + slide * 0.6 + 14 * Math.sin(f * 5), my = lerp(ey - 6, 196, f * f); z5MaskShard(mx, my, 0.4 * (1 - 0.4 * f), 0.4 + f * 2.2, Math.max(0, 1 - f * 1.5), [0, 0], t); if (f < 0.66) light(mx, my, 26, L_MAG, 0.5 * (1 - f * 1.5)); }
    // what is left of the rest: it shrinks, flattens, and falls back to the cloud as a shadow
    { const f = eio(clip01(34.9, 36.45, t)); if (t > 34.6) { const bx = lerp(ex, HLAND[0] - 44, f), by = lerp(ey + 12, 207, f * f), rx = lerp(15, 30, f * f) * (0.4 + 0.6 * clip01(34.6, 35.1, t)), ry = lerp(9, 4, eoc(f)); for (let y = fl(by - ry); y <= by + ry; y++) for (let x = fl(bx - rx); x <= bx + rx; x++) { const dx = (x - bx) / rx, dy = (y - by) / ry, d = dx * dx + dy * dy + (vn(x + t * 9, y, 4, 9622) - 0.5) * 0.5 * (1 - f); if (d < 1) P(x, y, d > 0.8 ? (bay(x, y) < 0.5 ? 2 : 63) : f > 0.8 ? 63 : 134); } } }
    // the hero: the stroke finished, it sinks toward the cloud, the stump of its blade in its hand
    const f = eio(clip01(34.6, 36.5, t));
    const hK = TR([{ t: 0, x: lerp(112, HLAND[0], f), y: lerp(YC + 8, HLAND[1] - 6, f) + Math.sin(t * 2) * 1.5 * f, S: 3, form: 'dawn', sw: lerp(0.0, 1.1, eoc(clip01(34.5, 35.4, t))), swl: 7, a: lerp(0.16, 0, eoc(clip01(34.3, 35.2, t))), sq: lerp(-0.2, 0, eoc(clip01(34.1, 34.8, t))), reach: lerp(4, 0, eoc(clip01(34.3, 35.0, t))), spread: 1, flap: 0.2, cr: lerp(0.8, 0.2, f) }, { t: 100, x: 0, y: 0 }]);
    hK[1].x = hK[0].x; hK[1].y = hK[0].y;
    d6Hero(hK, t, V, { motes: 14 });
    // the line of dawn, let go: it runs back down to where it belongs
    if (t < 34.9) { const u = eio(clip01(34.1, 34.9, t)); d6Horizon(t, lerp(YC, D5.hy, u), 1 - u * 0.3, 0, W, null, 0); }
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
    // the hero touches down; Dawnbreak leaves it; the broken hilt stays in its hand
    const land = t - 36.5, fade = eio(clip01(36.75, 37.7, t)), sq = 0.3 * Math.exp(-land * 7) * Math.cos(land * 14);
    const base = { x: HLAND[0], y: HLAND[1] - 6 * Math.exp(-land * 9), S: 3, a: 0, sq, sw: 1.15 - 0.1 * Math.exp(-land * 5), swl: 7, nobob: fade > 0.5 };
    const kP = TR([Object.assign({ t: 0, form: 'plain', cr: 0.12, eyes: t > 38.95 && t < 39.5 ? 'wide' : 'normal' }, base), Object.assign({ t: 100 }, base)]);
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
