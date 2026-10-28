  /* ================================================================ acts V and VI — infinite, and the cost (104–180) */
  {
  /* -------------------------------------------------------------- b4 helpers */
  const B4_SM = [85, 83, 22];
  const B4_FORMS = [undefined, 'storm', 'zenith', 'nova', 'lastlight', 'infinite'];
  // the sword with any blade length (2.5..30 units) and an optional broken, jagged end: swapped in for spSword while one of
  // these heroes is built, so the arm still raises and follows its hilt like the real thing
  let b4SwL = 30, b4SwBroken = 0, b4SwCols = null;
  function b4SpSword(px, py, ang, cols) {
    const ca = Math.cos(ang), sa = Math.sin(ang), L = b4SwL, R = Math.ceil(Math.max(7, L + 2));
    for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
      const fx = dx + 0.5, fy = dy + 0.5, u = fx * ca + fy * sa, v = -fx * sa + fy * ca, av = Math.abs(v);
      let c = -1;
      if (u >= -6 && u < -4.5 && av <= 1.4) c = 58;
      else if (u >= -4.5 && u < 0.5 && av <= 1.0) c = 38;
      else if (u >= 0.5 && u < 2.5 && av <= 4.2) c = av > 3.2 ? 51 : 58;
      else if (u >= 2.5 && u < L) {
        // a clean point, or a snapped end: the edge zig-zags across the blade
        const end = b4SwBroken ? L - (Math.abs(frac(v * 0.9 + 0.3) - 0.5) * 3.2) : L;
        const tw = !b4SwBroken && u > L - 5 ? (L - u) * 0.36 : 1.8;
        if (u < end && av <= tw) c = b4SwCols ? (v < -0.6 ? 22 : b4SwCols[fl(frac(u * 0.08) * b4SwCols.length)]) : (v < -0.7 ? 22 : u < 5 ? 33 : 34);
        if (b4SwBroken && u < end && u > end - 1.2 && av <= tw) c = 94;
      }
      if (c >= 0) sp(px + dx, py + dy, c, 2);
    }
  }
  // a hero with a short (or broken) blade; returns actor()'s result with tip moved to the real end of the blade
  function b4Hero(o, x, y, S, ang, flip, opt, swl, broken, cols) {
    const keep = spSword; spSword = b4SpSword; b4SwL = swl; b4SwBroken = broken ? 1 : 0; b4SwCols = cols || null;
    let r;
    try { r = actor(HERO3(o), x, y, S, ang, flip, Object.assign({ noSmear: true }, opt || {})); } finally { spSword = keep; }
    const sw = o.sword || 0, da = (flip ? PI - sw : sw) + ang;
    r.tip = [r.hand[0] + Math.cos(da) * swl * S, r.hand[1] + Math.sin(da) * swl * S];
    return r;
  }
  // tint the last stamped sprite (only its own pixels)
  function b4TintSprite(T, a) {
    if (SMB[2] < SMB[0] || a <= 0) return;
    for (let y = SMB[1]; y <= SMB[3]; y++) for (let x = SMB[0]; x <= SMB[2]; x++) { const i = y * W + x; if (SMASK[i]) tintI(i, x, y, T, a); }
  }
  // wings of one element: three ranks of feathers on raised arms either side of (x, y), like z5Wings but recoloured and
  // turned: set 0 prism, 1 nova flame, 2 storm lightning, 3 last light; rot turns the arms, len stretches them
  function b4Wings(x, y, s, t, spread, flap, set, rot, len) {
    if (spread <= 0.02) return;
    const amp = flap === undefined ? 0.24 : flap, sh = fl(t * 8), f = fl(t * 30);
    for (const sd of [-1, 1]) {
      const beat = z5Beat(t) * amp, arm = -0.78 - beat + (1 - spread) * 1.3 + (rot || 0), ax = Math.cos(arm) * sd, ay = Math.sin(arm), Lw = 40 * s * (0.35 + 0.65 * spread) * (len || 1);
      const RANKS = [[9, 1, 0], [8, 0.62, 1], [7, 0.36, 2]];
      for (const [N, ln, rank] of RANKS) for (let j = N - 1; j >= 0; j--) {
        const u = (j + 0.6) / N, bx = x + ax * Lw * u, by = y + ay * Lw * u - Math.sin(u * PI) * 5 * s;
        const bu = z5Beat(t - 0.12 * u) * amp, fr = lerp(PI / 2 - 0.12, -0.15 - bu * 1.5, Math.pow(u, 1.25)) - (1 - spread) * 0.5 - (rot || 0) * 0.5 * u, fa = sd > 0 ? fr : PI - fr;
        let L = s * (15 + 30 * u) * ln * (0.45 + 0.55 * spread) * (len || 1), w = s * (4.4 - rank * 0.8);
        if (set === 2) {
          // lightning: each feather a bolt from root to tip, re-struck every other frame
          if (rank === 2) continue;
          const tx = bx + Math.cos(fa) * L, ty = by + Math.sin(fa) * L;
          bolt(bx, by, tx, ty, j * 7 + rank * 31 + fl(f / 2) * 3 + (sd > 0 ? 0 : 99), rank === 0 ? 2 : 1, rank === 0 ? 91 : 90, 89, 0.3);
          continue;
        }
        if (set === 1 || set === 3) L *= 0.85 + 0.3 * vn(j * 3 + rank * 17, t * 9, 1, 2101 + (sd > 0 ? 0 : 5));
        const fill = set === 0 ? (rank === 0 ? PRISM[(j + sh) % 7] : rank === 1 ? 60 : 22)
          : set === 1 ? (rank === 0 ? ((j + sh) % 3 ? 105 : 106) : rank === 1 ? 109 : 108)
            : (rank === 0 ? ((j + sh) % 3 ? 103 : 104) : rank === 1 ? 105 : 107);
        const rim = set === 0 ? (rank === 0 ? 22 : rank === 1 ? 59 : 60) : set === 1 ? (rank === 0 ? 104 : 110) : (rank === 0 ? 101 : 103);
        z5Kite(bx - Math.cos(fa) * 1.2, by - Math.sin(fa) * 1.2, fa, L + 2.4, w + 1.1, rim);
        z5Kite(bx, by, fa, L, w, fill);
        if (rank === 0) lineP(bx, by, bx + Math.cos(fa) * L * 0.8, by + Math.sin(fa) * L * 0.8, set === 0 ? 22 : 107);
      }
    }
  }
  // the four orbs: amt 0 (embers) .. 1 (orbs) .. 2 (blazing, with flares and comet tails)
  function b4Orbs(cx, cy, R, t, r, tilt, front, amt, spin, which) {
    for (let k = 0; k < 4; k++) {
      if (which && !which[k]) continue;
      const sp_ = spin || 2.4, a = t * sp_ + k * TAU / 4, z = Math.sin(a);
      if ((z > 0) !== front) continue;
      const x = cx + Math.cos(a) * R, y = cy + z * R * tilt, rr = r * (0.98 + 0.14 * z);
      if (amt > 1.05) for (let q = 1; q <= 5; q++) { const a2 = a - q * 0.07 * Math.sign(sp_), x2 = cx + Math.cos(a2) * R, y2 = cy + Math.sin(a2) * R * tilt; if (bay(fl(x2), fl(y2)) < 1 - q / 6) discF(x2, y2, rr * (1 - q / 7), ORB[k][q < 2 ? 2 : 1]); }
      orbAt(x, y, k, rr, t);
      if (amt > 1.05) { glow(x, y, rr * 6, EL_T[k], 0.35 * (amt - 1)); sparkle(x, y, rr * 1.6 * (amt - 1) + Math.sin(t * 13 + k) * 1.5, 22, ORB[k][2]); }
    }
  }
  // an ember: a dying orb, a mote of its colour with a faint halo; br 0..1
  function b4Ember(x, y, k, br, t) {
    if (br <= 0) return;
    glow(x, y, 4 + 10 * br, EL_T[k], 0.25 + 0.4 * br);
    P(x, y, ORB[k][br > 0.5 ? 2 : 1]); if (br > 0.4) { P(x + 1, y, ORB[k][1]); P(x, y + 1, ORB[k][1]); }
    if (br > 0.75) P(x, y, 22);
  }
  // FABLE INFINITE, complete: the light bent round it, rays, the four orbs blazing, three kinds of wings layered (nova flame
  // behind, storm lightning, prism in front), the white prism-banded body, a rainbow flame, and the halo.
  // o: ang, flip, sw (sword angle; null for none), swl (blade length in units, default a broken stub of 9), broken,
  // spread, flap, over (overdrive 0..1: the forms cycle, the wings multiply), cracks, eyes, mouth, white, after, sq, legs,
  // orbR, orbA (orb amount), warp, rays, auraR, wt (wing clock), noLife (still), bob
  function b4Inf(x, y, S, t, o) {
    o = o || {};
    const ang = o.ang || 0, sp_ = o.spread === undefined ? 1 : o.spread, ov = o.over || 0, f = fl(t * 30);
    if (o.warp) warp(x, y, 34 * S, o.warp * (0.8 + 0.2 * Math.sin(t * 7)), 1);
    if (o.rays) z5Sunburst(x, y, 16, t * 0.5, 6 * S, o.rays, 0.08 + 0.03 * ov);
    const orbR = o.orbR === undefined ? 20 * S : o.orbR, orbA = o.orbA === undefined ? 1.6 : o.orbA;
    // the four orbs ride a ring of prism light round it (the halo): the far half behind everything
    const orbr = Math.max(1.5, S * 1.6), oT = 0.3, ring = (front) => { if (orbR <= 0 || orbA < 1) return; for (let a = 0; a < TAU; a += 0.9 / orbR) { const z = Math.sin(a); if ((z > 0) !== front || (fl(a * orbR / 3) + f) % 3 === 0) continue; P(x + Math.cos(a) * orbR, y + z * orbR * oT, front ? PRISM[(fl(a * 4) + f) % 7] : 62); } };
    ring(false);
    if (orbR > 0) b4Orbs(x, y, orbR, t, orbr, oT, false, orbA, 2.6 + ov * 4);
    const wt = o.wt === undefined ? t : o.wt, bob = o.bob !== undefined ? o.bob : z5Bob(wt, S, o.flap) * sp_;
    const wx = x - Math.sin(ang) * 6 * S, wy = y + bob - Math.cos(ang) * 6 * S, ws = S * 0.6;
    if (ov > 0) for (let q = 0; q < Math.round(ov * 4); q++) b4Wings(wx, wy, ws * (1.5 - q * 0.08), wt * (1.3 + q * 0.2), sp_, (o.flap || 0.24) * 1.2, q % 2 ? 2 : 1, -0.9 + q * 0.5, 1.1);
    b4Wings(wx, wy, ws * 1.35, wt * 1.1 + 0.4, sp_, o.flap, 3, -0.38, 1.15);
    b4Wings(wx, wy, ws * 1.15, wt, sp_, o.flap, 2, 0.32, 1.0);
    b4Wings(wx, wy, ws, wt, sp_, o.flap, 0, 0, 1);
    let form = o.form || 'infinite';
    if (ov > 0.05) { const per = Math.max(1, Math.round(3 - ov * 2.5)); form = B4_FORMS[fl(f / per) % 6]; }
    const swl = o.swl === undefined ? 9 : o.swl;
    const heroO = { form, eyes: o.eyes || 'glow', mouth: o.mouth, sword: o.sw === undefined ? null : o.sw, fly: true, sq: o.sq, legs: o.legs, reach: o.reach, cracks: o.cracks };
    const opt = { white: o.white, after: o.after, bob, still: o.noLife, st: o.st, sd: o.sd };
    const r = heroO.sword === null ? Object.assign(actor(HERO3(heroO), x, y, S, ang, !!o.flip, Object.assign({ noSmear: true }, opt)), {}) : b4Hero(heroO, x, y, S, ang, !!o.flip, opt, swl, o.broken !== false, z5Sw(t));
    z5Eyes();
    const k0 = fl(t * 9) % 7;
    aura(t, [PRISM[k0], PRISM[(k0 + 2) % 7], 60, 22], o.auraR || 3.4 * S, { sparks: 14 + fl(ov * 20) });
    if (!o.white) z5Rim(0, 0, null, 0, 63);
    ring(true);
    if (orbR > 0) b4Orbs(x, y, orbR, t, orbr, oT, true, orbA, 2.6 + ov * 4);
    return r;
  }
  // the world under it all: the abyss below the chasm floor; slit (screen y) a crack of molten light far above
  function b4Abyss(t, gy, slitY, lightA, ox) {
    ox = ox || 0;
    gradient(LB, H - LB, [0, 0, 1, 96, 96, 97]);
    // the walls of the chasm climbing out of the frame either side, two depths of them: black rock in strata, faces turned
    // to the light far above catching a rim of it, seams of fire in the deep
    for (let layer = 0; layer < 2; layer++) {
      const par = 0.25 + layer * 0.45, base = layer ? 150 : 104, SH = layer ? 96 : 0, MID = layer ? 97 : 96, LIT = layer ? 98 : 97;
      for (let y = LB; y < gy + 14; y++) {
        const v = (y - LB) / Math.max(1, gy - LB);
        for (const sd of [-1, 1]) {
          const e0 = 240 + sd * (base - 26 * v + (vn(y * 0.045, layer * 2 + (sd > 0 ? 1 : 0), 1, 2115) - 0.5) * 60 + (vn(y * 0.22, layer + (sd > 0 ? 5 : 0), 1, 2116) - 0.5) * 10) - ox * par;
          const xa = sd < 0 ? 0 : Math.max(0, fl(e0)), xb = sd < 0 ? Math.min(W - 1, fl(e0)) : W - 1;
          for (let x = xa; x <= xb; x++) {
            const e = Math.abs(x - e0), st = frac((y + vn(x * 0.1, layer, 1, 2117) * 5) / (9 - layer * 3)) < 0.12;
            const n = vn(x * 0.07 + layer * 9, y * 0.045, 1, 2120 + layer) + (1 - Math.min(1, e / 60)) * 0.25 - v * 0.15;
            let c = e < 1.5 ? (lightA > 0.25 && bay(x, y) < 0.3 + lightA * 0.5 ? 101 : LIT) : n > 0.66 ? LIT : n > 0.44 ? MID : SH;
            if (st && c !== SH) c = c === LIT ? MID : SH;
            if (layer === 1 && v > 0.45 && Math.abs(vn(x * 0.06, y * 0.03, 1, 2118) - 0.5) < 0.007 && e < 30) c = 101;
            BUF[y * W + x] = c;
          }
        }
      }
    }
    if (slitY !== null) {
      glow(250, slitY, 120, T_EMBER, 0.18);
      for (let x = 150; x < 350; x++) { const w = (1 - Math.pow(Math.abs(x - 250) / 100, 2)) * 1.6, yy = slitY + (vn(x, 0, 9, 2111) - 0.5) * 6; for (let q = -fl(w) - 1; q <= w + 1; q++) P(x, yy + q, Math.abs(q) < w * 0.5 ? 105 : Math.abs(q) <= w ? 103 : 101); }
    }
    // a shaft of the far light falling down the chasm (dithered, drifting)
    const sx = 250 - ox * 0.2;
    for (let y = LB; y < gy; y++) { const v = (y - LB) / (gy - LB), hw = 18 + 50 * v, cx = sx + (vn(y * 0.02, t * 0.2, 1, 2119) - 0.5) * 20; for (let x = Math.max(0, fl(cx - hw)); x < Math.min(W, cx + hw); x++) { const f = 1 - Math.abs(x - cx) / hw; tintI(y * W + x, x, y, T_EMBER, f * f * 0.22 * (0.5 + lightA) * (1 - v * 0.4)); } }
    // dust and embers hanging in the dark at two depths, drifting up on the heat
    for (let k = 0; k < 40; k++) { const x = ((ih(k, 1, 2112) * 520 - ox * (0.3 + ih(k, 3, 2112)) + t * 3) % 520 + 520) % 520 - 20, y = LB + ih(k, 2, 2112) * (gy - LB) + Math.sin(t * 0.4 + k) * 3; P(x, y, k % 3 ? 97 : 98); }
    for (let k = 0; k < 18; k++) { const near = k % 3 === 0, f = frac(ih(k, 4, 2112) - t * (0.04 + ih(k, 5, 2112) * 0.05)), x = ((ih(k, 6, 2112) * 500 - ox * (near ? 1.2 : 0.5) + Math.sin(t * 0.7 + k) * 8) % 500 + 500) % 500 - 10, y = LB + f * (gy - LB + 20); if (near) { rectF(x, y, 2, 2, f < 0.5 ? 102 : 101); P(x, y, 104); } else P(x, y, f < 0.3 ? 103 : 101); }
    // the floor: broken rock, its lip lit faintly from above
    ridge(gy, 14, 40, 2113, 96, 98, ox);
    ridge(gy + 18, 10, 26, 2114, 96, 97, ox * 1.4);
    if (lightA > 0) glow(240, gy, 260, T_EMBER, 0.1 * lightA);
  }
  // the cracked crater the hero lies in
  function b4Crater(cx, cy, s, glowA, seed) {
    for (let k = 0; k < 9; k++) {
      let x = cx, y = cy; const a = (k / 9) * PI + PI * 0.06 + (ih(k, 1, seed) - 0.5) * 0.3, dir = Math.cos(a) > 0 ? 1 : -1;
      for (let q = 0; q < 6; q++) { const nx = x + dir * (6 + ih(k, q, seed + 1) * 10) * s, ny = y + (ih(k, q, seed + 2) - 0.5) * 3 * s + 0.6 * s; lineP(x, y, nx, ny, q < 2 && glowA > 0.3 ? 102 : 101); x = nx; y = ny; }
    }
  }
  const b4Clip = (a, b, t) => clamp((t - a) / (b - a), 0, 1);

  /* -------------------------------------------------------------- b4 hands, arms and life (the engine's anatomy) */
  // his stone and porcelain (what light squeezing out of a grip must not paint over)
  const b4IsHim = (c) => (c >= 64 && c <= 69) || (c >= 96 && c <= 100);
  // a hand pose between two poses (names or objects), u 0..1
  function b4Pose(a, b, u) {
    const A = poseOf(a), B = poseOf(b), ca = A.curls || [0, 1, 2, 3].map(() => A.curl), cb = B.curls || [0, 1, 2, 3].map(() => B.curl);
    u = clamp(u, 0, 1);
    return { curls: ca.map((c, i) => lerp(c, cb[i], u)), thumb: lerp(A.thumb, B.thumb, u), spread: lerp(A.spread, B.spread, u) };
  }
  // the fingers of a hand sunderer() drew with layer 'palm' (so something can sit in the palm first): the hand's place,
  // angle and scale are read back from the point it returned
  function b4Fing(h, pose, heat, side) {
    const ax = h.knuckles[0] - h.palm[0], ay = h.knuckles[1] - h.palm[1], d = Math.hypot(ax, ay) || 1, s = d / 5.3;
    return sHand(h.palm[0] - ax / d * 5.5 * s, h.palm[1] - ay / d * 5.5 * s, s, Math.atan2(ay, ax), Object.assign({}, poseOf(pose), { heat: heat || 0, side, layer: 'fingers' }), 0);
  }
  // light squeezed out of a grip: rays from (cx, cy) that show only where his hand is not (so they come out between the
  // fingers), and the porcelain round it lit through like a lamp; amt 0..1
  function b4Leak(cx, cy, r0, len, n, t, amt, seed, cols) {
    if (amt <= 0.02) return;
    cols = cols || [22, 16];
    for (let k = 0; k < n; k++) {
      const a = (k + ih(k, 1, seed) * 0.8) / n * TAU + Math.sin(t * 2.3 + k) * 0.06, L = len * (0.45 + 0.55 * ih(k, fl(t * 10), seed + 1)) * amt, ca = Math.cos(a), sa = Math.sin(a), w = 1.2 + ih(k, 2, seed) * 2.2;
      for (let r = r0 * 0.6; r < r0 + L; r += 0.8) {
        const fade = r < r0 ? 1 : 1 - (r - r0) / L, ww = w * (0.6 + 0.4 * fade);
        for (let q = -ww; q <= ww; q += 0.7) {
          const x = fl(cx + ca * r - sa * q), y = fl(cy + sa * r + ca * q); if (x < 0 || x >= W || y < LB || y >= H - LB) continue;
          const i = y * W + x; if (b4IsHim(BUF[i])) continue;
          if (bay(x, y) < fade * (1.1 - Math.abs(q) / (ww + 0.6))) BUF[i] = Math.abs(q) < ww * 0.45 && fade > 0.45 ? cols[0] : cols[1];
        }
      }
    }
    // the porcelain lit through, hottest nearest the light
    const R = r0 * 2.6;
    for (let y = Math.max(LB, fl(cy - R)); y < Math.min(H - LB, cy + R); y++) for (let x = Math.max(0, fl(cx - R)); x < Math.min(W, cx + R); x++) {
      const i = y * W + x, c = BUF[i]; if (!b4IsHim(c)) continue;
      const d = Math.hypot(x - cx, y - cy) / R; if (d < 1) tintI(i, x, y, T_WARM, amt * 0.75 * (1 - d));
    }
  }
  // where sunderer() bends an elbow, for arms drawn apart from him (severed ones)
  function b4Elbow(ax, ay, wx, wy, s, k) {
    const sd = SH4[k][0] < 0 ? -1 : 1, up = k < 2, mx = (ax + wx) / 2, my = (ay + wy) / 2, dx = wx - ax, dy = wy - ay, L = Math.hypot(dx, dy) || 1, bend = Math.max(0, 152 * s - L) * 0.45;
    return [mx + (-dy / L) * bend * -sd * (up ? 1 : 0.8), my + (dx / L) * bend * -sd * (up ? 1 : 0.8) + bend * 0.3 + 3 * s];
  }
  /* an arm of his, drawn the engine's way (muscled obsidian upper arm with veins, an elbow cop, a vambrace of three porcelain
     plates with fire in the gaps, the jointed hand), for arms that are no longer attached to him: shoulder (ax, ay) — the
     cut end, burning — elbow (ex, ey), wrist (wx, wy) or null (a stump cut at the elbow, burning there too) */
  function b4ArmLook(ax, ay, ex, ey, wx, wy, s, heat, k, pose, ang, t) {
    const rU = (u) => s * (17 + 5 * Math.sin(PI * Math.min(1, u * 1.25)) - u * 4);
    limbF(ax, ay, ex, ey, rU, 22 * s, (u, sdn, lit, X, Y, e) => {
      if (u < 0.05) return e < 0.45 ? 22 : e < 0.75 ? 105 : 103;
      const vein = Math.abs(sdn - 0.35 * Math.sin(u * 9 + k)) < 0.06 && u > 0.12 && u < 0.86; return vein && heat > 0.25 ? (heat > 0.6 ? 104 : 103) : obsLit(lit, X, Y, e, heat);
    });
    if (wx === null) { discF(ex, ey, 12 * s, 101); discF(ex, ey, 9 * s, 103); discF(ex, ey, 5.5 * s, 105); discF(ex, ey, 2.5 * s, 22); return null; }
    limbF(ex, ey, wx, wy, (u) => s * (12.5 + u * 2.5), 16 * s, (u, sdn, lit, X, Y, e) => {
      if (u < 0.28) return obsLit(lit, X, Y, e, heat);
      const pf = (u - 0.28) / 0.72 * 3; if (frac(pf) < 0.07 && u < 0.98) return heat > 0.25 ? (heat > 0.6 ? 104 : 102) : 96;
      if (e > 0.9) return 69;
      if (Math.abs(sdn + 0.15) < 0.05 && frac(pf) > 0.25 && frac(pf) < 0.8) return 67;
      return BONE4[clamp(fl(2.6 + lit * 2.4 + (bay(X, Y) - 0.5) * 0.9 - (frac(pf) < 0.18 ? 0.8 : 0)), 0, 5)];
    });
    discF(ex, ey, 11 * s, heat > 0.3 ? 102 : 96); limbF(ex - 1, ey - 1, ex + 1, ey + 1, () => 9.5 * s, 10 * s, (u, sdn, lit, X, Y, e) => e > 0.86 ? 69 : BONE4[clamp(fl(2.4 + lit * 2.4 + (bay(X, Y) - 0.5) * 0.9), 0, 5)]);
    discF(wx, wy, 13 * s, heat > 0.3 ? 103 : 96);
    const sd = SH4[k][0] < 0 ? -1 : 1;
    return sHand(wx, wy, s, ang === undefined ? Math.atan2(wy - ey, wx - ex) : ang, Object.assign({}, poseOf(pose || 'open'), { heat, side: k < 2 ? sd : -sd }), t);
  }
  // an arm between blows is never still: the wrist drifts on a slow loop and the fingers flex (k: which arm)
  const b4Idle = (t, k, amp) => [z5N(t * 0.55, k * 3.1) * (amp || 6), z5N(t * 0.47, k * 1.7 + 9) * (amp || 6) * 0.8];
  const b4Flex = (t, k, base) => { const P_ = poseOf(base || 'fist'), cs = P_.curls || [0, 1, 2, 3].map(() => P_.curl); return { curls: cs.map((c, i) => clamp(c + 0.07 * Math.sin(t * 1.3 + k * 2 + i * 0.9), 0, 1)), thumb: P_.thumb, spread: clamp(P_.spread + 0.08 * Math.sin(t * 0.9 + k), 0, 1) }; };
  // keep a reach inside what the arm can do (local units from shoulder k): a straight arm is a tube, a bent one an arm
  function b4Reach(k, x, y, max) { const dx = x - SH4[k][0], dy = y - SH4[k][1], d = Math.hypot(dx, dy), m = max || 140; return d <= m ? [x, y] : [SH4[k][0] + dx / d * m, SH4[k][1] + dy / d * m]; }

  /* ================================================================ V.1 — rock bottom (104.0–107.4) */
  // the four embers fall and land on it at these times (absolute), one piano note each
  const B4_LAND = [105.2, 105.8, 106.4, 107.0];
  const B4_EMB_X = [212, 268, 230, 252];
  function b4EmberPath(k, t, HX, HY) {
    const land = B4_LAND[k], st = land - 2.2, u = clamp((t - st) / 2.2, 0, 1), e = 1 - Math.pow(1 - u, 1.6);
    const x0 = B4_EMB_X[k], y0 = 30;
    const x = lerp(x0, HX + (k - 1.5) * 5, e) + Math.sin(u * 7 + k * 2) * 14 * (1 - u), y = lerp(y0, HY - 2 + (k % 2) * 3, e);
    return [x, y, u];
  }
  shot(104.0, 107.4, (lt, t) => {
    const GY = 206, HX = 244, HY = 194;
    b4Abyss(t, GY, 34, 0.5, 0);
    b4Crater(HX, GY + 1, 1.6, 0.2, 2121);
    // the hero, face down in the dark: flattened, limp, cracked, the light almost out; each ember that lands lifts it a
    // fraction (a pulse in its cracks)
    let pulse = 0; for (const L of B4_LAND) { const g = t - L; if (g > 0) pulse = Math.max(pulse, Math.exp(-g * 4)); }
    const breath = Math.sin(t * 1.1) * 0.03;
    b4Hero({ eyes: 'closed', sword: 0.18, cracks: 0.9, sq: 0.32 + breath, legs: [3, 4, 3, 4] }, HX, HY, 2.2, 0.1, false, { still: true }, 8, true);
    b4TintSprite(T_DARK, 0.55 - pulse * 0.4);
    glow(HX, HY, 18 + pulse * 14, T_EMBER, 0.12 + pulse * 0.3);
    // the embers: falling, swaying; once landed they sit on it, faint
    for (let k = 0; k < 4; k++) {
      const [x, y, u] = b4EmberPath(k, t, HX, HY);
      if (u <= 0) continue;
      const g = t - B4_LAND[k];
      if (g > 0) { b4Ember(HX + (k - 1.5) * 5, HY - 2 + (k % 2) * 3, k, 0.35 + 0.15 * Math.sin(t * 3 + k), t); if (g < 0.5) { sparkle(HX + (k - 1.5) * 5, HY - 2, 5 * (1 - g / 0.5), 22, ORB[k][2]); glow(HX, HY, 30, EL_T[k], 0.4 * (1 - g / 0.5)); } }
      else { b4Ember(x, y, k, 0.55 + 0.2 * Math.sin(t * 5 + k), t); for (let q = 1; q < 6; q++) { const [px, py] = b4EmberPath(k, t - q * 0.05, HX, HY); if (bay(fl(px), fl(py)) < 0.5 - q * 0.08) P(px, py, ORB[k][1]); } }
    }
    // the camera sinks slowly toward it
    const z = 1.1 + 0.5 * eio(lt / 3.4);
    z5Cam(z, 0.004 * z5N(t * 0.4, 1), lerp(240, HX, eio(lt / 3.4)), lerp(150, HY - 14, eio(lt / 3.4)), 240, 140);
    fadeIn(lt, 0.5);
  });

  /* ================================================================ V.2 — one more time (107.4–110.5) */
  shot(107.4, 110.5, (lt, t) => {
    const GY = 236, S = 5.0;
    b4Abyss(t, GY, null, 0.4, 30);
    glow(250, 30, 200, T_EMBER, 0.12);
    // it gathers itself: the eye opens a slit (108.2), the hand closes on the hilt (108.7), it pushes itself up (109.4),
    // its arms give and it drops back (109.85), and it tries again and gets up onto its knees (110.05 →)
    const eye = t < 108.2 ? 'closed' : t < 108.32 ? 'narrow' : t < 108.4 ? 'closed' : t < 109.85 ? 'narrow' : t < 110.05 ? 'closed' : 'wide';
    const grip = z5Knock(t - 108.7, 1, 18, 7);
    const up1 = eio(b4Clip(109.4, 109.82, t)), drop = eic(b4Clip(109.82, 109.95, t)), up2 = eoc(b4Clip(110.05, 110.5, t));
    const lift = up1 * (1 - drop) + up2 * 0.85, land = z5Knock(t - 109.95, 1, 16, 6);
    const effort = t > 108.6 ? (0.4 + (t > 109.4 ? 1 : 0)) : 0, tr = effort * z5Sh(t, 3);
    const HX = 236 + tr * 1.4, HY = 196 - lift * 22 + land * 4 + tr * 0.6;
    const ang = lerp(0.16, -0.02, lift) + tr * 0.012 + land * 0.04;
    // floor and crater under it
    b4Crater(HX, GY - 2, 3.2, 0.3, 2131);
    let pulse = 0; for (const L of [108.0, 108.7, 109.0, 109.5, 110.05]) { const g = t - L; if (g > 0) pulse = Math.max(pulse, Math.exp(-g * 3.5) * 0.8); }
    const sq = lerp(0.3, 0.02, lift) + land * 0.12, legs = [lerp(4, 0.5, lift), lerp(3, 1, lift), lerp(4, 0.5, lift), lerp(3, 1, lift)];
    const r = b4Hero({ eyes: eye, mouth: t > 109.0 && t < 110.3 && fl(t * 7) % 2 ? 1 : t > 110.1 ? 2 : 0, sword: 0.3 - grip * 0.25 - lift * 0.5, cracks: 0.9, sq, legs }, HX, HY, S, ang, false, { still: true }, 8, true);
    b4TintSprite(T_DARK, 0.26 - pulse * 0.2);
    // the four embers sit in its cracks and beat with it
    for (let k = 0; k < 4; k++) { const ex = HX - 34 + k * 22 + tr, ey = HY - 8 + (k % 2) * 14; b4Ember(ex, ey, k, 0.55 + pulse * 0.45 + 0.1 * Math.sin(t * 2.4 + k), t); discF(ex, ey, 1.4, ORB[k][2]); }
    // the broken hilt catches a glint
    if (t > 108.7 && t < 109.1) sparkle(r.tip[0], r.tip[1], 6 * (1 - (t - 108.7) / 0.4), 22, 34);
    glow(HX, HY, 70, T_EMBER, 0.08 + pulse * 0.14);
    // grit sliding off it as it moves; dust where it drops
    if (lift > 0.05) for (let k = 0; k < 8; k++) { const g = frac(t * 1.5 + ih(k, 1, 2132)); P(HX - 50 + ih(k, 2, 2132) * 100, HY + 30 + g * 40, 98); }
    if (t > 109.95) debris(HX, GY - 6, t - 109.95, 12, 40, 0.6, [97, 98, 99], 2133, 80);
    shk(t > 109.95 && t < 110.2 ? 2 : 0);
    z5Cam(1.06 + 0.08 * eio(lt / 3.1), 0.01 * z5N(t * 0.5, 2), 236, 172 - lift * 10, 240, 150);
  });
  CAPS.push([109.0, 110.5, 's', 'HERO', 'ONE... MORE... TIME.']);

  /* ================================================================ V.3 — every form at once (110.5–113.0) */
  // the forms run through it: gold, storm, zenith, nova, last light, then all of them, faster and faster
  const B4_CASC = [[110.5, 'gold'], [111.05, 'storm'], [111.5, 'zenith'], [111.85, 'nova'], [112.15, 'lastlight']];
  function b4CascForm(t) {
    if (t >= 112.4) { const per = t < 112.7 ? 3 : t < 112.88 ? 2 : 1, f = fl(t * 30); return ['gold', 'storm', 'zenith', 'nova', 'lastlight', 'infinite'][fl(f / per) % 6]; }
    let F = 'gold'; for (const [a, n] of B4_CASC) if (t >= a) F = n; return F;
  }
  shot(110.5, 113.0, (lt, t) => {
    const GY = 214, rise = eio(b4Clip(110.5, 112.9, t)), shakeA = 0.4 + lt * 1.2;
    const HX = 240 + z5Sh(t, 1) * shakeA * 0.6, HY = lerp(178, 140, rise) + z5Sh(t, 2) * shakeA * 0.5, S = 3.4;
    b4Abyss(t, GY, null, 0.3 + lt * 0.3, 0);
    // the light it gives off reaches the walls, and rocks lift off the floor around it
    const F = b4CascForm(t);
    const has = (n) => B4_CASC.some(([a, m]) => m === n && t >= a);
    glow(HX, HY, 80 + lt * 40, F === 'storm' ? T_CYAN : F === 'zenith' ? T_WH : F === 'nova' ? T_NOVA : F === 'lastlight' ? T_FIRE : T_GOLD, 0.25 + lt * 0.08);
    for (let k = 0; k < 24; k++) { const g = lt - ih(k, 1, 2141) * 1.6; if (g < 0) continue; const x = 60 + ih(k, 2, 2141) * 360, y = GY + 4 - g * g * (14 + ih(k, 3, 2141) * 20) - g * 8, s = 1 + fl(ih(k, 4, 2141) * 4); if (y < LB) continue; rectF(x + Math.sin(g * 2 + k) * 2, y, s, s, k % 3 ? 97 : 99); if (s > 2) P(x, y, 101); }
    // a ring of light running out along the floor each time the form changes
    for (const [a] of B4_CASC) { const g = t - a; if (g > 0 && g < 0.6) shockRing(HX, GY, 10 + g * 380, 2 + g * 30, 2, [22, 59, 58], 1 - g / 0.6); }
    // the layers: what each form leaves behind stays on, under the next
    const wt = t * 1.4;
    if (has('nova')) b4Wings(HX, HY - 6 * S, S * 0.75, wt + 0.3, Math.min(1, (t - 111.85) * 4), 0.2, 1, -0.2, 1.1);
    if (has('storm')) { for (let k = 0; k < 3; k++) { const f = fl(t * 15), a0 = ih(k, f, 2142) * TAU; bolt(HX + Math.cos(a0) * 8 * S, HY + Math.sin(a0) * 8 * S, HX + Math.cos(a0 + 0.6) * 20 * S, HY + Math.sin(a0 + 0.6) * 20 * S, f + k, 1, 91, 89); } }
    if (has('zenith')) z5Wings(HX, HY - 6 * S, S * 0.6, wt, Math.min(1, (t - 111.5) * 3), 0.22);
    const form = F === 'gold' ? undefined : F;
    b4Hero({ form, eyes: t < 111.05 ? 'angry' : 'glow', mouth: t > 112.4 ? 2 : 0, sword: -0.9 * rise - 0.1, cracks: F === 'lastlight' ? 0.85 : 0.9 - rise * 0.4, sq: 0.1 - rise * 0.15, legs: [2 * (1 - rise), 2 * (1 - rise), 2 * (1 - rise), 2 * (1 - rise)] }, HX, HY, S, 0, false, {}, 9, true, F === 'gold' ? GOLD_SW : F === 'storm' ? STORM_SW : z5Sw(t));
    if (F === 'zenith' || F === 'infinite') z5Eyes();
    const AU = { gold: AURA_GOLD, storm: AURA_STORM, zenith: ZEN_FLAME, nova: [104, 105, 109, 108], lastlight: [101, 103, 104, 107], infinite: [PRISM[fl(t * 9) % 7], PRISM[(fl(t * 9) + 2) % 7], 60, 22] }[F];
    aura(t, AU, (2.4 + lt * 1.4) * S * 0.9, { sparks: 10 + fl(lt * 8) });
    if (has('gold') && F !== 'gold') aura(t + 0.5, AURA_GOLD, 1.4 * S, { sparks: 0 });
    z5Rim(0, 0, null, 0, 63);
    // the embers wake: they start to circle it again, brighter with each form
    for (let k = 0; k < 4; k++) { const a = t * (1.5 + lt * 1.5) + k * TAU / 4, R = 22 * S - lt * 10, z = Math.sin(a); b4Ember(HX + Math.cos(a) * R, HY + z * R * 0.3, k, 0.4 + lt * 0.25, t); }
    shk(0.5 + lt * 1.4);
    const z = 1.0 + 0.3 * eic(lt / 2.5);
    z5Cam(z, 0.006 * z5N(t, 3), HX, HY + 6, 240, 140);
  });

  /* ================================================================ V.4 — FABLE INFINITE (113.0–114.6) */
  shot(113.0, 114.6, (lt, t) => {
    const GY = 222, HX = 240, HY = 132 - z5Knock(lt, 8, 7, 3);
    b4Abyss(t, GY, null, 1, 0);
    // everything round it is lit and blown outward: rock flung from the floor, a ring of light racing out
    z5GodRays(HX, HY, 9, t * 0.4, T_WH, 0.55 * (1 - lt * 0.35), 400);
    rocks(HX, GY, lt, 22, 300, 4, [96, 98, 99, 103], 2151, 60, -PI / 2, 2.4);
    shockRing(HX, HY, 20 + lt * 600, 20 + lt * 600, 4, [22, 85, 83], 1 - lt / 0.9);
    shockRing(HX, GY, 10 + lt * 700, 3 + lt * 60, 4, [22, 60, 59], 1 - lt / 1.2);
    b4Inf(HX, HY, 3.5, t, { sw: -1.15, spread: 1, flap: 0.3, wt: t * 1.6, orbR: 84, orbA: 2, warp: 0.5, rays: 150 + lt * 60, auraR: 12, mouth: lt < 0.8 ? 2 : 0 });
    if (lt < 0.03) impactFrame(HX, HY, 1);
    shk(9 * Math.exp(-lt * 3));
    const [kz, kr] = kick(lt, [[0, 3]]);
    z5Cam(1.12 - 0.12 * eoc(lt / 1.6) + kz, kr, HX, HY + 14, 240, 140);
  });
  CAPS.push([113.0, 114.5, 'x', '', 'FABLE...', 50], [113.35, 114.5, 'x', '', 'INFINITE!', 216]);

  /* ================================================================ V.5 — the ascent (114.6–118.0) */
  // one continuous rise: up the chasm, out past the sea, through the cloud sea, into the morning above
  const B4_SEA = 1300, B4_CB = 2500, B4_CT = 3200, B4_TOP = 3900, B4_AD = 3.4;
  const b4AV = (u) => (u < 0.1 ? u / 0.1 : u < 0.82 ? 1 : 1 - 0.88 * eio((u - 0.82) / 0.18));
  let B4_AN = 0; for (let k = 0; k < 400; k++) B4_AN += b4AV((k + 0.5) / 400) / 400;
  function b4AscY(lt) { const u = clamp(lt / B4_AD, 0, 1), n = 120; let s = 0; for (let k = 0; k < n; k++) s += b4AV((k + 0.5) / n * u) * u / n; return B4_TOP * s / B4_AN; }
  // the sky of the morning above the clouds, the sun in it
  const B4_SKY = [3, 4, 5, 6, 7, 8, 19, 15, 16];
  function b4Sky(t, hz, sunX, sunY, sunR, sunA) {
    gradient(LB, hz, B4_SKY);
    if (sunA > 0 && sunR > 0) { glow(sunX, sunY, sunR * 7, T_WARM, 0.55 * sunA); discF(sunX, sunY, sunR * 1.25, 15); discF(sunX, sunY, sunR, 16); discF(sunX - sunR * 0.2, sunY - sunR * 0.2, sunR * 0.45, 22); }
  }
  // the Sunderer as he stands in act V: lower arms gone, the mask cut, his brother's eye open in his brow
  const B4_MCUT = [[-12, -18, 10, 20, 1]];
  const B4_LOW = [{ x: -118, y: 150, cut: true }, { x: 118, y: 150, cut: true }];
  function b4Sund(cx, cy, s, t, o) {
    const arms = o.arms || [0, 1].map((k) => { const [dx, dy] = b4Idle(t, k); return { x: (k ? 132 : -132) + dx, y: 110 + dy, pose: b4Flex(t, k, 'fist') }; });
    // arms marked drift breathe between blows: the wrist on a slow loop, the fingers flexing
    const live = (A, k) => !A || !A.drift ? A : Object.assign({}, A, { x: A.x + b4Idle(t, k, A.drift)[0], y: A.y + b4Idle(t, k, A.drift)[1], pose: typeof A.pose === 'string' ? b4Flex(t, k, A.pose) : A.pose });
    return sunderer(cx, cy, s, t, Object.assign({ heat: 0.85, rage: 0.8, third: 1, eyes: 1.2, crown: 1, maskCuts: B4_MCUT }, o, { arms: [live(arms[0], 0), live(arms[1], 1), o.low === false ? null : B4_LOW[0], o.low === false ? null : B4_LOW[1]] }));
  }
  function b4Ascent(lt, t, Yc, vel) {
    const top = LB, bot = H - LB, SY = 135;
    // the far layer: the chasm's far wall (below the sea) or the sea and its sky; the cloud ceiling seen from below
    const hz = SY - 0.35 * (B4_SEA - Yc);
    if (Yc < B4_CT) belowWorld(t, clamp(hz, LB - 2, H), 0, 0.4, SKY_BLOOD);
    for (let y = top; y < bot; y++) {
      const Yf = Yc * 0.35 + (SY - y), Yceil = Yc * 0.15 + (SY - y);
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        // the cloud ceiling, coming down out of the top as it nears
        if (Yc > 1500 && Yc < B4_CT && Yceil > B4_CB * 0.15 + (vn(x, 0, 40, 2211) - 0.5) * 30 + (vn(x, 0, 11, 2210) - 0.5) * 10) { const d = Yceil - B4_CB * 0.15; BUF[i] = d < 3 ? 19 : d < 14 ? (bay(x, y) < 0.5 ? 18 : 17) : 17; continue; }
        // the far wall of the chasm, while it is still in it: dark, with a red glow from the depths
        if (Yc < B4_SEA + 60 && Yf < B4_SEA * 0.35 && y > hz) { const n = vn(x * 0.25, Yf * 0.25, 3, 2212); BUF[i] = Math.abs(n - 0.5) < 0.02 ? 101 : n > 0.62 ? 1 : 96; continue; }
      }
    }
    if (Yc < B4_SEA) glow(240, bot, 260, T_EMBER, 0.2 * (1 - Yc / B4_SEA));
    // the chasm seen from above once it is clear: a burning gash in the sea, narrowing to the horizon
    if (Yc > B4_SEA - 60 && hz < bot) for (let y = Math.max(top, fl(hz)); y < bot; y++) { const w = (y - hz) * 0.5 + 1; for (let x = fl(240 - w); x <= 240 + w; x++) { const e = Math.abs(x - 240) / w; P(x, y, e < 0.3 ? 105 : e < 0.7 ? 103 : 101); } }
    // above the clouds: the morning sky and the top of the cloud sea far below
    if (Yc > B4_CB) {
      const hz2 = 168 + (Yc - B4_CT) * 0.09;
      Z5B.set(BUF);
      b4Sky(t, hz2, 300, 52 + (B4_TOP - Yc) * 0.06, 14, 1);
      cloudBank(hz2 + 4, 22, 80, 5051, t * 12, CLOUD_SUN, false);
      cloudBank(hz2 + 30, 30, 60, 5052, t * 18, [17, 18, 19, 15], false);
      // the Sunderer, waiting: a mountain rising out of the cloud sea
      const sy = 92 + (B4_TOP - Yc) * 0.3;
      if (sy < bot + 40) { b4Sund(396, sy, 1.25, t, { eyes: 1.4, tilt: -0.08, nod: 2, arms: [{ x: -132, y: 120, pose: 'fist', drift: 6 }, { x: 130, y: 100, pose: 'claw', drift: 8 }] }); cloudBank(hz2 + 40, 24, 50, 5053, t * 22, [17, 18, 19, 15], false); }
      // until it is clear of the clouds, the old picture shows below the cloud's top
      if (Yc < B4_CT + 200) for (let y = top; y < bot; y++) { const Yn = Yc + (SY - y); if (Yn < B4_CT) for (let x = 0; x < W; x++) BUF[y * W + x] = Z5B[y * W + x]; }
    }
    // the near layer: the chasm walls, rushing past; the sea pouring over their lips; spires
    for (let y = top; y < bot; y++) {
      const Yn = Yc + (SY - y);
      if (Yn >= 0 && Yn < B4_SEA) {
        const xl = 96 + (vn(Yn * 0.012, 0, 1, 2213) - 0.5) * 80 + (vn(Yn * 0.08, 0, 1, 2214) - 0.5) * 18, xr = 384 + (vn(Yn * 0.012, 3, 1, 2215) - 0.5) * 80 + (vn(Yn * 0.08, 3, 1, 2216) - 0.5) * 18;
        const lipF = B4_SEA - Yn < 160 ? 1 - (B4_SEA - Yn) / 160 : 0;
        for (let x = 0; x < W; x++) {
          const inL = x < xl, inR = x > xr; if (!inL && !inR) continue;
          const e = inL ? xl - x : x - xr, n = vn(x * 0.12, Yn * 0.03, 2, 2217);
          let c = e < 2 ? 123 : e < 5 ? 100 : e < 10 ? 99 : n > 0.6 ? 98 : 97;
          if (Math.abs(vn(x * 0.05, Yn * 0.02, 1, 2218) - 0.5) < 0.02) c = e < 30 ? 105 : 103;
          // the sea falls in over the lip in sheets
          if (lipF > 0 && e < 26 * lipF + 4 && ih(x, fl(Yn / 3 + t * 40), 2219) < 0.5 + lipF * 0.4) c = e < 6 ? 119 : bay(x, y) < 0.5 ? 118 : 117;
          BUF[y * W + x] = c;
        }
      }
      // two spires standing out of the sea
      for (const [sx, sh_, sw_] of [[46, 900, 40], [446, 650, 34]]) if (Yn > B4_SEA && Yn < B4_SEA + sh_) { const v = (Yn - B4_SEA) / sh_, half = sw_ * (0.25 + 0.75 * Math.pow(1 - v, 0.6)); for (let x = fl(sx - half); x <= sx + half; x++) P(x, y, (x - sx) / half < -0.4 ? 99 : 97); }
      // the body of the cloud sea: mist, darker below, lit toward its top
      if (Yn > B4_CB && Yn < B4_CT) { const d = (Yn - B4_CB) / (B4_CT - B4_CB); for (let x = 0; x < W; x++) { const v = d * 3 + vn(x * 0.04, Yn * 0.01, 1, 2225) * 0.8 - 0.4 + bay(x, y) * 0.5; BUF[y * W + x] = v < 0.6 ? 17 : v < 1.4 ? 18 : v < 2.3 ? 19 : 20; } }
    }
    // the cloud: banks of it rushing down past, near ones faster
    if (Yc > B4_CB - 400 && Yc < B4_CT + 500) for (let k = 0; k < 34; k++) {
      const par = 1 + ih(k, 4, 2226) * 0.6, Y = B4_CB - 40 + ih(k, 1, 2226) * (B4_CT - B4_CB + 80), y = SY - (Y - Yc) * par;
      if (y < -60 || y > H + 60) continue;
      let x = ih(k, 2, 2226) * W; if (Math.abs(x - 240) < 70) x += x < 240 ? -70 : 70;
      const d = (Y - B4_CB) / (B4_CT - B4_CB);
      cloudPuff(x, y, 22 + ih(k, 3, 2226) * 30, d < 0.4 ? [17, 18, 19, 20] : [18, 19, 20, 21], 2227 + k);
    }
  }
  shot(114.6, 118.0, (lt, t) => {
    const Yc = b4AscY(lt), Yp = b4AscY(lt - 1 / 30), vel = (Yc - Yp) * 30, u = lt / B4_AD, vn_ = b4AV(u);
    b4Ascent(lt, t, Yc, vel);
    // speed: the world smeared along the rise, streaks rushing down past it
    const sc = Yc < B4_SEA ? 101 : Yc < B4_CB ? 118 : 21;
    streaks(PI / 2, 30, t, vel * 1.4, sc, 30 + vel * 0.06, 2231);
    streaks(PI / 2, 10, t + 0.3, vel * 1.9, Yc < B4_SEA ? 105 : 22, 50 + vel * 0.08, 2235);
    // crossing the sea's lip, and the cloud's base and top: the medium bursts round it
    const HX = 240 + z5N(t * 1.3, 1) * 6 - 70 * eio(b4Clip(0.8, 1, u)), HY = 184 - 44 * vn_ + 14 * eio(b4Clip(0.85, 1, u));
    const tSea = b4TOf(B4_SEA - 40), tCB = b4TOf(B4_CB - 40), tCT = b4TOf(B4_CT - 40);
    const gs = lt - tSea; if (gs > 0 && gs < 0.8) { rocks(HX, HY + 40, gs, 26, 260, 3, [117, 118, 119, 22], 2232, 300, -PI / 2, 3.2); shockRing(HX, HY + 30, 10 + gs * 500, 3 + gs * 90, 3, [22, 119, 118], 1 - gs / 0.6); }
    const gc = lt - tCB; if (gc > 0 && gc < 0.5) shockRing(HX, HY - 20, 10 + gc * 600, 4 + gc * 120, 4, [22, 21, 20], 1 - gc / 0.5);
    const gt = lt - tCT; if (gt > 0 && gt < 1.2) { for (let k = 0; k < 9; k++) cloudPuff(HX + (ih(k, 1, 2233) - 0.5) * 160 * (0.4 + gt), HY + 60 - gt * (90 + ih(k, 2, 2233) * 120) + gt * gt * 140, 10 + ih(k, 3, 2233) * 10, [18, 19, 20, 21], 2234 + k); shockRing(HX, HY + 30, 10 + gt * 520, 3 + gt * 60, 4, [22, 21, 16], 1 - gt / 0.7); }
    // the hero: wings swept back for the climb, blade-stub up, afterimages streaming below it
    const after = []; for (let k = 1; k <= 4; k++) after.push([HX, HY + k * vel * 0.012, k === 1 ? 22 : PRISM[(k * 2 + fl(t * 30)) % 7], 0.6 - k * 0.12]);
    const climb = 1 - eio(b4Clip(0.86, 1, u));
    b4Inf(HX, HY, 2.6, t, { sw: lerp(-0.6, -1.5, climb), ang: -0.12 * climb, spread: lerp(1, 0.45, climb), flap: 0.3, wt: t * 3.5, orbR: 52 - 16 * climb, after: vel > 300 ? after : undefined, warp: 0.35, auraR: 8 + 6 * climb, noLife: true, st: 0.35 * climb * Math.min(1, vel / 900), sd: -PI / 2, sq: -0.15 * climb });
    shk(1 + vel / 500);
    z5Cam(1.02 + 0.03 * vn_, 0.02 * z5N(t * 1.7, 2) * vn_, 240, 135, 240, 135);
    if (lt < 0.1) glow(HX, HY, 120, T_WH, 0.5 * (1 - lt / 0.1));
  });
  // when the rise passes altitude Y (shot time)
  function b4TOf(Y) { let a = 0, b = B4_AD; for (let k = 0; k < 24; k++) { const m = (a + b) / 2; if (b4AscY(m) < Y) a = m; else b = m; } return a; }

  /* ================================================================ V.6 — THE WORLDBLADE (118.0–121.5) */
  // the hilt grows a blade, and it does not stop: the camera pulls back from the hero, to the clouds, to the curve of the
  // world, and the blade is longer than the world is wide
  const B4_RW = 25000, B4_ZE = 150 / B4_RW;
  const b4WBZ = (lt) => Math.exp(Math.log(B4_ZE) * eio(b4Clip(0.55, 3.5, lt)));
  // the world from afar: a disc of cloud lit by the sun, an atmosphere on its rim; (px, py) its top, Rs its radius
  function b4Planet(px, py, Rs, t, sunX, sunY, dark) {
    const cx = px, cy = py + Rs, K = Math.min(B4_RW / 60, Rs / 4), lx = sunX - cx, ly = sunY - cy, ll = Math.hypot(lx, ly, Rs * 1.2) || 1;
    const atm = Math.max(2, Math.min(10, 3 + 2000 / Rs));
    const y0 = Math.max(LB, fl(py - atm - 1));
    for (let y = y0; y < H - LB; y++) {
      const dy = y + 0.5 - cy;
      for (let x = 0; x < W; x++) {
        const dx = x + 0.5 - cx, d2 = dx * dx + dy * dy, d = Math.sqrt(d2);
        if (d > Rs + atm) continue;
        const i = y * W + x;
        if (d > Rs) { if (bay(x, y) < 1 - (d - Rs) / atm) BUF[i] = (d - Rs) < atm * 0.35 ? 90 : 89; continue; }
        const u = dx / Rs, v = dy / Rs, z = Math.sqrt(Math.max(0, 1 - u * u - v * v));
        const n = vn(u * K + t * 0.6, z * K * 1.6, 1, 2301) * 0.65 + vn(u * K * 3 + t * 1.5, z * K * 4, 1, 2302) * 0.35;
        const lit = (u * lx + v * ly + z * Rs * 1.2) / ll, rim = 1 - z;
        let l = lit * 1.1 + (n - 0.5) * 0.9 + (bay(x, y) - 0.5) * 0.35 - (dark || 0);
        let c = l < 0.05 ? 3 : l < 0.3 ? 17 : l < 0.55 ? 18 : l < 0.8 ? 19 : l < 1.0 ? 15 : 16;
        if (rim > 0.93 && bay(x, y) < (rim - 0.93) * 12) c = 20;
        BUF[i] = c;
      }
    }
  }
  shot(118.0, 121.5, (lt, t) => {
    const Z = b4WBZ(lt), pull = eio(b4Clip(0.55, 3.5, lt));
    const AX = lerp(170, 110, pull), AY = lerp(150, 148, pull);
    const space = sstep(-1.9, -4.2, Math.log(Z));
    // the sky thins to space as it pulls back
    b4Sky(t, H - LB, 0, 0, 0, 0);
    if (space > 0) { for (let y = LB; y < H - LB; y++) for (let x = 0; x < W; x++) if (bay(x, y) < space * 1.15 - 0.05) BUF[y * W + x] = y < 60 ? 0 : 1 + (bay(x, y) < 0.3 ? 1 : 0); stars(t, H, fl(140 * space), 2311); }
    // the sun: a sky object, it hardly moves; in space it is a star with a corona
    const sunX = lerp(300, 178, pull), sunY = lerp(52, 76, pull), sunR = lerp(14, 16, pull);     // it ends where the next shot opens on it
    glow(sunX, sunY, sunR * (7 + space * 6), T_WARM, 0.55); discF(sunX, sunY, sunR * 1.25, 15); discF(sunX, sunY, sunR, 16); discF(sunX - 2, sunY - 2, sunR * 0.45, 22);
    if (space > 0.3) for (let k = 0; k < 6; k++) { const a = k * PI / 3 + t * 0.1; lineF(sunX, sunY, sunX + Math.cos(a) * sunR * 4 * space, sunY + Math.sin(a) * sunR * 4 * space, (x, y, u) => { if (bay(x, y) < 0.8 - u) P(x, y, 16); }); }
    // the Sunderer, a mountain standing in the cloud sea (he shrinks more slowly than everything: he is that big)
    const Zs = Math.pow(Z, 0.35), ss = 1.25 * Zs;
    b4Sund(AX + 290 * Zs, AY + lerp(10, -50, Zs), ss, t, { eyes: 1.4, tilt: -0.1, arms: [{ x: -104, y: 150, pose: 'fist', drift: 5 }, { x: 132, y: 96, pose: 'claw', drift: 7 }] });
    // the world under them
    b4Planet(AX, AY + 80 * Z, B4_RW * Z, t, sunX, sunY, 0);
    if (Z > 0.3) cloudBank(AY + 80 * Z + 6, 16 * Z, 70, 5051, t * 12, CLOUD_SUN, false);
    // the blade: it erupts from the broken hilt, swings down from overhead to level as it grows (too heavy to hold up),
    // and runs on out past the frame; it widens as it lengthens
    const S = 2.6 * Z, grow0 = eoc(b4Clip(0, 0.7, lt));
    const ang = lerp(-1.42, -0.2, eio(b4Clip(0.35, 2.4, lt))) + z5Knock(lt, -0.08, 9, 4);
    const big = S >= 0.55;
    let hand = [AX + 8 * S, AY];
    if (big) {
      const r = b4Inf(AX, AY, S, t, { sw: ang, spread: 1, flap: 0.3, wt: t * 1.8, orbR: 48 * Z, warp: 0.4, auraR: Math.max(4, 9 * Z), noLife: true, swl: 8, mouth: lt < 0.7 ? 2 : 0 });
      hand = r.hand;
    } else {
      // too far to see it: a star, its wings a cross of prism light
      const k = Math.max(0, S / 0.55);
      glow(AX, AY, 26, T_WH, 0.7); sparkle(AX, AY, 7 + Math.sin(t * 9) * 1.5, 22, PRISM[fl(t * 12) % 7]); discF(AX, AY, 1.6 + k * 2, 22);
      for (let q = 0; q < 4; q++) P(AX + Math.cos(t * 2.6 + q * PI / 2) * 6, AY + Math.sin(t * 2.6 + q * PI / 2) * 2, ORB[q][2]);
      hand = [AX + 2, AY];
    }
    const Ls = 40 + 1100 * grow0, w = Math.max(2.2, lerp(2.2, 5.5, Math.pow(Z, 0.3)));
    bigBlade(hand[0], hand[1], ang, Ls, w, t, { form: 'infinite', grow: lt < 0.7 ? 0.4 + 0.6 * grow0 : 1, surge: true, flare: 0.8 });
    // the blade's light along its whole length
    glow(hand[0] + Math.cos(ang) * 120, hand[1] + Math.sin(ang) * 120, 140, T_WH, 0.18);
    // the hit: the blade erupts
    if (lt < 0.03) impactFrame(hand[0], hand[1], 1);
    if (lt < 0.6) { shockRing(hand[0], hand[1], 8 + lt * 500, 8 + lt * 500, 3, [22, 85, 83], 1 - lt / 0.6); burst(hand[0], hand[1], lt / 0.4, 160, 18, 0.3, [22, 60], 3); }
    shk(7 * Math.exp(-lt * 3) + 0.6);
    z5Cam(1 + 0.06 * (1 - pull) + kick(lt, [[0, 2]])[0], 0.004 * z5N(t * 0.5, 1), 240, 135, 240, 135);
  });

  /* ================================================================ V.7 — he reaches for the sun (121.5–122.0) */
  // low, under him: the arm sweeps up on an arc, the hand opens wide over the sun, the palm meets it and the fingers
  // begin to close round it (they are shut on the cut, 122.0)
  const B4_SUN7 = [170, 74], B4_SR = 18, B4_SUNIN = 3.2;
  /* ================================================================ V.8 — he tears the sun out of the sky (122.0–124.6) */
  // his wrist in screen space (as sunderer() places it), so what he holds can be placed against his hand
  const b4Wr = (cx, cy, s, t, lx, ly) => [cx + lx * s, cy + Math.sin(t * 0.9) * s + ly * s];
  // only the pixels inside R of (cx, cy) turn to their negative: light inverted at a point of unbearable pressure
  function b4Inv(cx, cy, R, seed) {
    if (R < 1) return;
    for (let y = Math.max(LB, fl(cy - R)); y < Math.min(H - LB, cy + R); y++) for (let x = Math.max(0, fl(cx - R)); x < Math.min(W, cx + R); x++) {
      const d = Math.hypot(x - cx, y - cy) / R + (vn(x, y, 8, seed || 2401) - 0.5) * 0.25; if (d > 1 || (d > 0.85 && bay(x, y) > (1 - d) / 0.15)) continue;
      BUF[y * W + x] = INV[BUF[y * W + x]];
    }
  }
  // the sun in his hand, going out: amt 0 (the sun) .. 1 (a black sun)
  function b4DyingSun(x, y, r, t, amt) {
    if (amt >= 0.98) { blackSun(x, y, r, t, 1); return; }
    glow(x, y, r * 5 * (1 - amt), T_WARM, 0.6 * (1 - amt));
    if (amt > 0.4) blackSun(x, y, r, t, (amt - 0.4) / 0.6 * 0.9);
    discF(x, y, r * 1.2, amt > 0.5 ? 104 : 15); discF(x, y, r, amt > 0.5 ? 105 : 16);
    if (amt > 0) { discF(x, y, r * amt, 103); discF(x, y, r * amt * 0.85, 0); }
    else discF(x - r * 0.2, y - r * 0.2, r * 0.45, 22);
  }
  /* 0 the HIT: the fist shut round it · 0.1–1.0 it is torn down out of the sky on a long arc to before his chest, light
     dragged after it · 0.95–1.4 the other hand comes in and the two hands cup it · 1.55, 1.9, 2.15 three squeezes, light
     spurting between the fingers each time, the sun going dark · 2.2–2.6 the hands ease open on a black sun */
  /* ONE shot with the reach (121.5–122.0): it opens on the sun where the Worldblade shot left it (the same place in the
     frame), his open hand rises into the picture under it on a bow, the palm meets it, the fingers start to close; the
     camera eases back and down to find his mask under it; the fist shuts on the HIT and he tears it down */
  shot(121.5, 124.6, (lt0, t) => {
    const lt = t - 122.0, CX = 300, CY = 168, s = 1.3, fs = 1.08, se = s * fs;
    const reach = eio(b4Clip(121.5, 121.8, t)), closeR = eio(b4Clip(121.74, 122.0, t)), inHand = t >= 121.77;
    const pull = eio(b4Clip(0.1, 1.0, lt)), cr = eio(b4Clip(0.95, 1.4, lt)), rev = eio(b4Clip(2.2, 2.6, lt));
    const amt = eio(b4Clip(1.3, 2.35, lt)), r = lerp(B4_SR, 15, eio(b4Clip(1.35, 2.4, lt)));
    const sq = Math.max(0, z5Knocks(lt, [1.55, 1.9, 2.15], 1, 14, 5));
    let spurt = 0; for (const h of [1.55, 1.9, 2.15]) { const g = lt - h; if (g > 0) spurt = Math.max(spurt, Math.exp(-g * 7)); }
    // the left hand tearing it down: wrist (local) and angle along the arc
    const PL = (p) => [lerp(-90, -40, p) - Math.sin(p * PI) * 36, lerp(-62, 14, p) - Math.sin(p * PI) * 14, lerp(-1.95, -1.15, p)];
    const palmOf = (wx, wy, a) => [wx + Math.cos(a) * (5.5 + B4_SUNIN) * se, wy + Math.sin(a) * (5.5 + B4_SUNIN) * se];
    // before the HIT: the reach, from his side on a bow up to where the palm meets the sun
    let [plx, ply, pa] = PL(pull);
    if (lt < 0) { const q = 1 - reach, P0 = [-122, 92], Pc = [-176, -6], E0 = PL(0); plx = q * q * P0[0] + 2 * q * reach * Pc[0] + reach * reach * E0[0]; ply = q * q * P0[1] + 2 * q * reach * Pc[1] + reach * reach * E0[1]; pa = lerp(-1.2, E0[2], reach); }
    const [w1x, w1y] = b4Wr(CX, CY, s, t, plx, ply);
    // the cup: where the sun sits once both hands have it (screen), the hands either side, fingers up and over it
    const [e1x, e1y] = b4Wr(CX, CY, s, t, PL(1)[0], PL(1)[1]), CUP = palmOf(e1x, e1y, PL(1)[2]);
    CUP[0] += 18 * cr; CUP[1] -= 6 * cr + 18 * rev;
    const g2 = r * 1.05 + 2 - sq * 4 + 9 * rev, aL2 = -PI / 2 + 0.5 - 0.25 * rev, aR2 = -PI / 2 - 0.5 + 0.25 * rev;
    const toLocal = (px, py, a) => [(px - Math.cos(a) * 5.5 * se - CX) / s, (py - Math.sin(a) * 5.5 * se - CY - Math.sin(t * 0.9) * s) / s];
    const [l2x, l2y] = toLocal(CUP[0] - g2, CUP[1] + 3, aL2), [r2x, r2y] = toLocal(CUP[0] + g2, CUP[1] + 3, aR2);
    const aL = lerp(pa, aL2, cr), wL = [lerp(plx, l2x, cr), lerp(ply, l2y, cr)];
    // the right hand comes in from his side on a bow
    const rb = Math.sin(cr * PI) * 26, aR = lerp(-1.4, aR2, cr), wR = [lerp(132, r2x, cr) + rb * 0.4, lerp(110, r2y, cr) + rb];
    // the grip: shut hard on the hit, harder on each squeeze, easing open at the end
    const gripL = lt < 0 ? b4Pose('open', 'grab', closeR) : cr > 0 ? b4Pose(b4Pose('claw', 'grab', cr), 'fist', 0.25 + sq * 0.5) : b4Pose('grab', 'fist', 0.15 + 0.35 * eoc(b4Clip(0, 0.15, lt)));
    const gripR = b4Pose(b4Pose('open', 'grab', cr), 'fist', 0.25 + sq * 0.5);
    const poseL = rev > 0 ? b4Pose(gripL, 'claw', rev) : gripL, poseR = rev > 0 ? b4Pose(gripR, 'claw', rev) : gripR;
    const sx0 = palmOf(...b4Wr(CX, CY, s, 122.0, PL(0)[0], PL(0)[1]), PL(0)[2]);
    const dark = eio(b4Clip(0.15, 2.3, lt));
    b4Sky(t, H - LB, sx0[0], sx0[1], B4_SR, inHand ? 0 : 1);
    cloudBank(232, 26, 70, 5051, t * 10, CLOUD_SUN, false);
    cloudBank(250, 30, 50, 5052, t * 14, [17, 18, 19, 15], false);
    // the hole the sun leaves: torn sky, burning at its edge, night inside
    const hole = eoc(b4Clip(0.1, 0.9, lt));
    if (hole > 0) for (let y = Math.max(LB, fl(sx0[1] - 44)); y < sx0[1] + 44; y++) for (let x = fl(sx0[0] - 50); x < sx0[0] + 50; x++) { const d = Math.hypot(x - sx0[0], (y - sx0[1]) * 1.1) / (28 * hole) + (vn(x, y, 5, 2411) - 0.5) * 0.5; if (d < 1) P(x, y, d > 0.85 ? 104 : d > 0.72 ? 102 : 0); }
    bigBlade(-20, 236, -0.3, 900, 3, t, { form: 'infinite', flare: 0.7 });
    const pS = palmOf(w1x, w1y, pa);
    glow(pS[0], pS[1], 200, T_WARM, 0.35 * (1 - amt));
    tintAll(T_DARK, 0.72 * dark);
    // dragged light, ripped out with it
    if (lt > 0.1 && lt < 1.3) for (let k = 1; k < 14; k++) { const p2 = eio(b4Clip(0.1, 1.0, lt - k * 0.025)), [qx, qy, qa] = PL(p2), [ax, ay] = palmOf(...b4Wr(CX, CY, s, t, qx, qy), qa), rr = r * (1 - k * 0.06); for (let yy = -rr; yy <= rr; yy++) for (let xx = -rr; xx <= rr; xx++) if (xx * xx + yy * yy < rr * rr && bay(fl(ax + xx), fl(ay + yy)) < 0.9 - k * 0.06) P(ax + xx, ay + yy, k < 4 ? 16 : k < 8 ? 15 : 14); }
    let SC = pS;
    const sunAt = (x, y) => b4DyingSun(x, y, r, t, amt);
    const hold = cr > 0 || !inHand ? undefined : (I) => { SC = [I.palm[0] + I.ux * B4_SUNIN * I.s, I.palm[1] + I.uy * B4_SUNIN * I.s]; sunAt(SC[0], SC[1]); };
    const twoR = cr > 0.5;
    const arms = [{ x: wL[0], y: wL[1], pose: poseL, ang: aL, fs, front: true, hold, layer: cr > 0 ? 'palm' : undefined, heat: 0.9 },
      { x: wR[0], y: wR[1], pose: poseR, ang: aR, fs, front: cr > 0.3, layer: twoR ? 'palm' : undefined, heat: 0.9 }];
    // he hauls with his whole body: leans in and down after it, then hunches over it as he crushes
    const R_ = b4Sund(CX, CY, s, t, { eyes: 1.4 + 0.4 * dark, rage: 1, roar: 0.3 * eio(b4Clip(1.4, 2.0, lt)) + 0.25 * sq, tilt: (lt < 0 ? -0.1 * reach : -0.1 * (1 - pull)) + 0.04 * sq, nod: 4 * pull + 3 * sq - 5 * Math.sin(reach * PI) * (lt < 0 ? 1 : 0), lean: -8 * Math.sin(pull * PI) + 3 * cr - 12 * Math.sin(reach * PI) * (lt < 0 ? 1 : 0), arms, heat: 0.9 });
    const hL = R_.hands[0], hR = R_.hands[1];
    if (cr > 0) {
      // both hands: the sun sits between the palms, the fingers close over it
      const mid = twoR ? [(hL.palm[0] + hR.palm[0]) / 2, (hL.palm[1] + hR.palm[1]) / 2 - 4] : CUP, al = Math.atan2(hL.knuckles[1] - hL.palm[1], hL.knuckles[0] - hL.palm[0]);
      const own = [hL.palm[0] + Math.cos(al) * B4_SUNIN * se, hL.palm[1] + Math.sin(al) * B4_SUNIN * se], k = eio(b4Clip(0, 0.6, cr));
      SC = [lerp(own[0], mid[0], k), lerp(own[1], mid[1], k)];
      sunAt(SC[0], SC[1]);
      b4Fing(hL, poseL, 0.9, -1);
      if (twoR) b4Fing(hR, poseR, 0.9, 1);
    }
    // light squeezed out between the fingers, spurting on each squeeze, dying as it goes black
    const lk = lt < 0 ? (inHand ? 0.35 + 0.65 * closeR : 0.4 * reach) : (1 - amt) * (cr > 0 ? 0.55 + 0.45 * spurt : 1);
    b4Leak(SC[0], SC[1], r, 50 + 110 * spurt, 14, t, lk, 2412, amt > 0.5 ? [105, 103] : [22, 16]);
    // the light sucked in toward it as it collapses
    if (amt > 0.2) { for (let k = 0; k < 40; k++) { const a = ih(k, 1, 2413) * TAU, u = frac(ih(k, 2, 2413) - t * 1.4), R = 24 + u * 160; if (bay(k, fl(t * 30)) < amt) lineP(SC[0] + Math.cos(a) * R, SC[1] + Math.sin(a) * R, SC[0] + Math.cos(a) * (R + 10 * u), SC[1] + Math.sin(a) * (R + 10 * u), u < 0.4 ? 15 : 14); } }
    if (lt >= 0 && lt < 0.03) impactFrame(SC[0], SC[1], 1);
    if (lt >= 0 && lt < 0.5) { shockRing(SC[0], SC[1], 6 + lt * 300, 6 + lt * 300, 3, [22, 16, 15], 1 - lt / 0.5); shk(6 * (1 - lt / 0.5)); }
    for (const h of [1.55, 1.9, 2.15]) { const g = lt - h; if (g > 0 && g < 0.3) { shk(4 * (1 - g / 0.3)); shockRing(SC[0], SC[1], r + g * 200, r + g * 200, 2, [105, 103, 101], 1 - g / 0.3); } }
    const [kz, kr] = kick(lt, [[0, 2], [1.55, 0.8], [1.9, 0.6], [2.15, 1]]);
    const fo = eio(b4Clip(0.5, 1.6, lt));
    // the camera: from the sun (where the last shot left it in the frame) back and down to him for the HIT, then with the sun
    const cz = 1.0 + 0.3 * eio(b4Clip(1.2, 2.6, lt)) - 0.12 * eio(b4Clip(2.25, 2.6, lt)) + kz + 0.25 * (1 - eio(b4Clip(121.5, 122.0, t)));
    const cf = eio(b4Clip(121.5, 122.0, t)), fx0 = sx0[0] - (sx0[0] - 240) / 1.25, fy0 = sx0[1] - (sx0[1] - 135) / 1.25;
    z5Cam(cz, kr - 0.03 * (1 - pull) * cf, lerp(fx0, lerp(sx0[0] + 40, SC[0], fo), cf), lerp(fy0, lerp(sx0[1] + 40, SC[1] - 10, fo), cf), 240, 135);
  });

  /* ================================================================ V.10 — the clash (126.2–134.0) */
  function b4BSun(cx, cy, r, t) {
    glow(cx, cy, r * 2.4, T_EMBER, 0.3);
    blackSun(cx, cy, r, t, 1);
    const th = Math.max(1.5, r * 0.05);
    for (let q = 0; q < th; q += 0.7) ring(cx, cy, r + q, undefined, q < th * 0.5 ? 107 : 105);
    for (let a = 0; a < TAU; a += 0.9 / r) { const f = 0.5 + 0.5 * Math.sin(a * 5 + t * 3); if (f > 0.7) P(cx + Math.cos(a) * (r - 2), cy + Math.sin(a) * (r - 2), 22); }
  }
  // the black sun held against the blade: from the hand along angle a, D px out, it presses on the edge from the side n
  const b4Press = (hx, hy, a, D, r, w, side) => { const ux = Math.cos(a), uy = Math.sin(a), sd = side || 1, nx = -uy * sd, ny = ux * sd; return { cx: hx + ux * D + nx * (r + w), cy: hy + uy * D + ny * (r + w), px: hx + ux * D + nx * w, py: hy + uy * D + ny * w }; };
  // where its hand will be, without leaving a mark (draw, read, put the picture back), so what is behind it can go first
  function b4HandPre(x, y, S, t, o) { Z5C.set(BUF); const r = b4Inf(x, y, S, t, o); BUF.set(Z5C); return r.hand; }
  // the point of contact: blade against black sun at the limit — the light there turns inside out, sparks and void spray
  function b4Contact(px, py, lt, t, power, dir, sun) {
    // one clean point of pressure: a small knot of inverted light, a white-hot core, a modest glow
    b4Inv(px, py, (6 + 2 * Math.sin(t * 5)) * power, 2511);
    glow(px, py, 26 * power, T_WH, 0.4);
    // the black sun's rim heated white where the edge bites into it, the heat running off round it
    if (sun) {
      const [cx, cy, r] = sun, ac = Math.atan2(py - cy, px - cx), sp = 0.55 * power;
      for (let da = -sp; da <= sp; da += 0.6 / r) { const f = 1 - Math.abs(da) / sp, a = ac + da; for (let q = -1.5; q <= 1.5 + f * 2; q += 0.7) { const x = cx + Math.cos(a) * (r + q - 1), y = cy + Math.sin(a) * (r + q - 1); if (bay(fl(x), fl(y)) < f * 1.2) P(x, y, f > 0.75 ? 22 : f > 0.4 ? 107 : 105); } }
    }
    discF(px, py, 1.4 + power * 1.1, 22);
    // a steady fountain of sparks off the contact, thrown both ways along the edge (dir is the normal), falling as they go
    const ea = dir - PI / 2;
    for (let k = 0; k < 28; k++) {
      const life = frac(t * 2.4 + ih(k, 1, 2512)); if (life > 0.82) continue;
      const a = ea + (k % 2 ? 0 : PI) + (ih(k, 2, 2512) - 0.5) * 0.8, v = (70 + ih(k, 3, 2512) * 120) * power, d = v * life * 0.55;
      const x = px + Math.cos(a) * d, y = py + Math.sin(a) * d + 70 * life * life, tl = 1.5 + 5 * (1 - life);
      lineP(x, y, x - Math.cos(a) * tl, y - Math.sin(a) * tl, life < 0.25 ? 22 : k % 3 ? 105 : 85);
    }
    shk(1.2 * power);
  }
  const B4_BS = [304, 98, 58];
  // half a black sun: blackSun, keeping only the side sd of the line through (cx, cy) with normal (nx, ny); the cut face
  // burns white-hot
  function b4HalfSun(cx, cy, r, t, nx, ny, sd, open, fade) {
    const R = r * 3.2, x0 = Math.max(0, fl(cx - R)), x1 = Math.min(W - 1, Math.ceil(cx + R)), y0 = Math.max(LB, fl(cy - R)), y1 = Math.min(H - LB - 1, Math.ceil(cy + R));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy, side = (dx * nx + dy * ny) * sd; if (side < 0 || (fade && vn(x, y, 3, 2612) * 0.7 + bay(x, y) * 0.3 < fade)) continue;
      const d = Math.sqrt(dx * dx + dy * dy), an = Math.atan2(dy, dx);
      if (d < r) { BUF[y * W + x] = side < 2 + open * 3 ? (side < 1.2 ? 22 : 107) : d > r - 1.6 ? 105 : d > r - 3 ? 102 : 0; continue; }
      const tongue = r * (1.15 + 0.5 * Math.max(0, Math.sin(an * 7 + t * 2.3) * Math.sin(an * 3 - t * 1.1)) + 0.35 * vn(an * 4 + t, 0, 1, 1151)) * (1 - open * 0.6);
      if (d < tongue) { const e = (d - r) / Math.max(1, tongue - r); BUF[y * W + x] = e < 0.2 ? 107 : e < 0.45 ? 105 : e < 0.7 ? 103 : bay(x, y) < 0.5 ? 102 : 101; }
    }
  }
  /* ---------------------------------------------------------------- V.9–V.13 — THE CLASH, ONE shot (124.6–139.6)
     One world, one travelling camera. 124.6 he heaves the black sun up out of his hands, over his head (the camera tilts up
     with it, low under him) · 125.0 "THEN WE BOTH END." · 126.2 he rears back with his whole body as the camera pulls back
     and pans left to find the hero · 126.76 the hurl · 127.0 the CLASH (wide) · the camera pushes in on the contact: it holds
     and cannot, the blade cracks (130.0) · pulls out wide as it is driven back and back: the blade breaks at the tip (132.0) ·
     the black sun rolls over the broken blade and bears down: pushed in close, on its knees · 134.0 FURTHER!! — the flare
     throws the black sun back up; the camera rises with it as the blade regrows · the swing down into the black sun (136.0)
     and the grind to its centre · 138.0 it splits; the light floods back and the camera eases back to find him, rocked back
     behind it. He walks it in on the hero the whole time (his mask drifts left and up), leaning his weight into the push. */
  const B4_KW = (k) => (t) => b4K(k, t);
  const B4_SX = B4_KW([[124.6, 360], [125.6, 372], [126.2, 396], [126.7, 430, 'o'], [127.4, 430], [129, 422], [133, 372], [136, 365], [139.6, 365]]);
  const B4_SY = B4_KW([[124.6, 194], [127.4, 194], [131, 182], [136, 164], [139.6, 164]]);
  // the hero (world), the blade's angle, how far along it the black sun presses, the black sun's radius
  const B4_HP = B4_KW([[124.6, [118, 186]], [127.0, [118, 186]], [127.25, [100, 190], 'o'], [128.0, [106, 191]], [129.0, [104, 192]], [130.0, [98, 196]], [130.15, [90, 198], 'o'], [131.0, [88, 198]],
    [132.0, [76, 202]], [132.15, [70, 206], 'o'], [132.6, [72, 208]], [133.4, [70, 214]], [134.0, [70, 214]], [134.5, [76, 200], 'o'], [135.2, [80, 190]], [135.75, [66, 188]], [138.0, [83, 183]],
    [139.35, [83, 183]], [139.6, [86, 164], 'i']]);
  const B4_HA = B4_KW([[127.0, -0.35], [129.0, -0.23], [131.0, -0.18], [132.0, -0.14], [132.3, -0.16], [132.9, -0.95], [134.0, -1.0], [134.35, -0.92], [135.25, -0.92], [135.75, -2.0]]);
  const B4_D = B4_KW([[127, 160], [129, 142], [130, 120], [131, 108], [132, 96], [132.6, 72], [133.6, 60], [134.0, 60], [134.4, 66], [135.2, 92]]);
  const B4_R = B4_KW([[124.6, 13.5], [125.6, 26, 'o'], [126.4, 38], [129, 40], [132, 46], [139.6, 46]]);
  const B4_TG = [66 + 138.6, 188 - 70.9];                 // where FURTHER throws the black sun (world): where the swing meets it
  const B4_CL = [[124.6, 1.15, 356, 160], [125.4, 1.12, 368, 140], [125.9, 1.1, 384, 130], [126.2, 1.08, 396, 128], [126.55, 1.0, 300, 130], [126.9, 1.0, 240, 135], [127.6, 1.04, 236, 140],
    [128.4, 1.08, 226, 142], [129.0, 1.25, 200, 150], [129.8, 1.85, 150, 172], [130.4, 1.95, 148, 174], [131.3, 1.1, 196, 150], [132.0, 1.0, 205, 148], [132.5, 1.4, 140, 170], [133.3, 2.0, 108, 186],
    [134.0, 2.05, 106, 184], [134.5, 1.55, 118, 165], [135.3, 1.35, 140, 158], [135.75, 1.27, 66 + 112 / 1.27, 188 - 53 / 1.27], [137.9, 1.38, 166, 142], [138.2, 1.36, 170, 142], [139.6, 1.15, 200, 140]];
  // the hero's look through it
  const B4_HO = { spread: B4_KW([[124.6, 1], [129, 1], [130, 0.9], [131.5, 0.7], [132.6, 0.55], [133.6, 0.32], [134.0, 0.3], [134.35, 1, 'o'], [139.6, 1]]),
    flap: B4_KW([[124.6, 0.3], [127, 0.5], [129, 0.42], [132.6, 0.3], [133.2, 0.08], [134, 0.08], [134.3, 0.32], [139.6, 0.32]]),
    cracks: B4_KW([[124.6, 0], [127, 0], [129, 0.15], [130, 0.2], [130.05, 0.45, 'o'], [131, 0.5], [132, 0.6], [132.05, 0.75, 'o'], [134, 0.75], [135.2, 0], [139.6, 0]]),
    sq: B4_KW([[124.6, -0.05], [127, -0.05], [127.3, 0.1, 'o'], [129, 0.12], [132, 0.18], [133.4, 0.24], [134, 0.24], [135.1, -0.1], [135.75, -0.1], [136.05, 0.08], [139.6, 0]]),
    orbR: B4_KW([[124.6, 30], [129, 24], [132.6, 20], [134, 20], [134.5, 40, 'o'], [135.75, 30], [139.6, 30]]),
    orbA: B4_KW([[124.6, 1.6], [129, 1.2], [132.6, 1.0], [134, 1.0], [134.4, 2], [139.6, 2]]),
    aura: B4_KW([[124.6, 6], [129, 5], [133, 4], [134, 4], [134.5, 12, 'o'], [135.75, 6], [139.6, 6]]),
    warp: B4_KW([[124.6, 0.3], [129, 0.25], [133, 0.1], [134, 0.1], [134.3, 0.5], [135.75, 0.35], [139.6, 0.3]]),
    over: B4_KW([[134, 0], [134.35, 1, 'o'], [135.25, 0.85], [135.75, 0.35], [138, 0.35], [138.4, 0], [139.6, 0]]),
    ang: B4_KW([[132.6, 0], [134, 0.22], [134.4, 0.1], [135.2, -0.06], [135.75, -0.16], [136.2, 0], [139.6, 0]]) };
  // him, once the sun has left his hands: the push, a shove into each crack, thrown back by the flare, rocked by the light
  const B4_PL = B4_KW([[127.6, -10], [129.6, -8], [129.95, -20, 'i'], [130.4, -9, 'o'], [131.6, -8], [131.95, -22, 'i'], [132.4, -10, 'o'], [133.8, -12], [134.1, 22, 'o'], [135.0, 8], [135.75, 0],
    [137.5, -8], [138.0, -6], [138.5, 12, 'o'], [139.6, 6]]);
  const B4_PN = B4_KW([[127.6, 3], [130, 6], [133.8, 5], [134.1, -7, 'o'], [135, 0], [138.0, 1], [138.4, -5, 'o'], [139.6, -3]]);
  const B4_PR = B4_KW([[127.6, 0.35], [130, 0.6], [132, 0.7], [134.1, 0.95], [135, 0.5], [138.2, 0.6], [138.5, 0.9], [139.6, 0.6]]);
  const B4_PB = B4_KW([[133.9, 0], [134.15, 1, 'o'], [135.2, 0.4], [136, 0]]);   // thrown back by the flare
  const B4_HZW = 292.8;
  shot(124.6, 139.6, (lt, t) => {
    const [vz, vx, vy] = b4Spl(B4_CL, t), [, pvx] = b4Spl(B4_CL, t - 1 / 30);
    B4V = { x: vx, y: vy, z: vz };
    const hz = 135 + (B4_HZW - vy) * vz * 0.45, ox = vx * vz * 0.5;
    const T0 = 126.2, l2 = t - T0, tc = 127.0 - T0, rel = 0.56, pressing = t >= 127.0 && t < 135.3;
    const g0 = t - 127.0, g1 = t - 130.0, g2 = t - 132.0, g3 = t - 134.0, g4 = t - 136.0, g5 = t - 138.0, op = g5 > 0 ? eoc(b4Clip(0, 1.2, g5)) : 0;
    // ---- the night with its sun gone, the cloud sea a dim floor lit from the contact
    b4Sky(t, H - LB, 0, 0, 0, 0);
    cloudBank(hz, 24 * vz, 70, 5051, ox + t * 10, CLOUD_SUN, false);
    for (let k = 0; k < 6; k++) { const x = ((ih(k, 1, 2541) * 600 - ox * 1.2 + t * 6) % 600 + 600) % 600 - 60; cloudPuff(x, hz + 16 * vz + ih(k, 2, 2541) * 10, (9 + ih(k, 3, 2541) * 9) * vz, [17, 18, 19, 15], 2542 + k); }
    cloudBank(hz + 24 * vz, 30 * vz, 50, 5052, ox * 1.4 + t * 14, [17, 18, 19, 15], false);
    tintAll(T_DARK, lerp(0.68, 0.24, eio(b4Clip(138.0, 139.4, t))));
    stars(t, hz - 20, 26, 2501);
    // the far rim of the world still glows where the dawn was
    glow(120 - ox * 0.2, hz + 4, 260, T_EMBER, 0.14);
    // ---- him (world → screen)
    const SXw = B4_SX(t), SYw = B4_SY(t), s = vz, fs = 1.25, se = s * fs, [CX, CY] = b4P(SXw, SYw), bob = Math.sin(t * 0.9) * s, bobW = Math.sin(t * 0.9);
    const R = B4_R(t), Rs = R * vz;
    // ---- the hero (world → screen): where its hand is, so the black sun can sit on the blade before it is drawn
    const hpw = B4_HP(t), shA = g0 > 0 && g0 < 1.5 ? 1.2 : pressing ? 1.6 : 0.4, [HX, HY] = b4P(hpw[0] + z5Sh(t, 1) * shA, hpw[1] + z5Sh(t, 2) * shA * 0.8), S = 1.5 * vz;
    let a;
    const swDown = eic(b4Clip(126.82, 127.0, t));
    if (t < 127.0) a = lerp(0.75, -0.35, swDown);
    else if (t < 135.75) a = B4_HA(t) + (pressing ? z5Sh(t, 3) * 0.012 : 0);
    const eyes = t < 129.0 ? 'glow' : t < 132.6 ? ((g1 > 0 && g1 < 0.5) || (g2 > 0 && g2 < 0.4) ? 'wide' : 'closed') : t < 133.72 ? 'closed' : t < 133.88 ? 'wide' : 'glow';
    const ho = { sw: 0, ang: B4_HO.ang(t), spread: B4_HO.spread(t), flap: B4_HO.flap(t), wt: t * (pressing ? 3 : 2.4), orbR: B4_HO.orbR(t) * vz, orbA: B4_HO.orbA(t), warp: B4_HO.warp(t), auraR: B4_HO.aura(t) * vz, over: B4_HO.over(t),
      noLife: true, mouth: t > 127.0 && !(g5 > 0.6) ? 2 : 0, eyes, cracks: B4_HO.cracks(t), sq: B4_HO.sq(t), legs: t > 132.9 && t < 134.6 ? [4, 2, 4, 2] : undefined, rays: g3 > 0 && g3 < 1.2 ? 120 * eoc(b4Clip(0, 0.35, g3)) : 70 * op };
    // into the black sun (from 135.75): the swing down onto its tangent (136.0), then the grind in toward its centre line
    const TGs = b4P(...B4_TG);
    if (t >= 135.75) {
      ho.sw = -1.2; const hp0 = b4HandPre(HX, HY, S, t, Object.assign({}, ho, { orbR: 0 }));
      const dC = Math.atan2(TGs[1] - hp0[1], TGs[0] - hp0[0]), dd = Math.hypot(TGs[0] - hp0[0], TGs[1] - hp0[1]), tan = dC - Math.asin(Math.min(0.99, Rs / dd)), drive = eio(b4Clip(136.0, 138.0, t));
      a = t < 136.0 ? lerp(-2.0, tan, eic(b4Clip(135.75, 136.0, t))) : t < 138.0 ? lerp(tan, dC, drive) + z5Sh(t, 3) * 0.008 : lerp(dC, -0.47, eio(b4Clip(138.0, 138.4, t)));
    }
    ho.sw = a;
    const hand = b4HandPre(HX, HY, S, t, ho), ws = 4 * Math.min(vz, 1.7), C = b4Press(hand[0], hand[1], a, (B4_D(t)) * vz, Rs, ws, -1);
    // ---- the black sun: in his hands (local), flung, pressing on the blade, thrown back up, then where the swing meets it
    const wind = eio(b4Clip(0, 0.42, l2)), hurl = eic(b4Clip(0.42, rel, l2)), ft = eoc(b4Clip(rel, 0.85, l2)), settle = eio(b4Clip(0.85, 1.6, l2));
    const lift = eoc(b4Clip(124.6, 125.8, t)), held = l2 < rel;
    const sL = t < T0 ? [-8 + 4 * Math.sin(lift * PI), lerp(-10, -112, lift) - 8 * Math.sin(lift * PI)] : l2 < 0.42 ? [lerp(-8, 26, wind), lerp(-112, -120, wind)] : [lerp(26, -62, hurl), lerp(-120, -92, hurl) - Math.sin(hurl * PI) * 16];
    const toS = (lx, ly) => b4P(SXw + lx, SYw + bobW + ly);
    const [rx0, ry0] = toS(-62, -92);
    let SX, SY;
    if (held) [SX, SY] = toS(...sL);
    else if (t < 127.0) { const f2 = eic(b4Clip(T0 + rel, 127.0, t)); SX = lerp(rx0, C.cx, f2); SY = lerp(ry0, C.cy, f2) - Math.sin(f2 * PI) * 20 * vz; }
    else if (t < 135.75) { const k = eio(b4Clip(135.15, 135.75, t)); SX = lerp(C.cx, TGs[0], k); SY = lerp(C.cy, TGs[1], k); }
    else [SX, SY] = TGs;
    // the contact lights everything round it: the cloud floor under it, rays thrown across the sky
    const LX = pressing ? C.px : SX, LY = pressing ? C.py : SY, lit = t < 127.0 ? 0 : t < 135.3 ? 1 : t < 138 ? 0.9 : 0.6;
    if (lit > 0) { z5GodRays(LX, LY, 9, t * 0.3, T_WARM, 0.2 * lit, 520); glow(LX, hz + 20 * vz, 240, T_WARM, 0.32 * lit); }
    [127.0, 130.0, 132.0, 134.0, 136.0, 138.0].forEach((h, k) => b4Deck(LX, hz, t - h, k === 5 ? 1.6 : 1.2, 2551 + k * 7));
    // ---- his arms
    const loc = (px, py, aa) => [(px - Math.cos(aa) * 5.5 * se - CX) / s, (py - Math.sin(aa) * 5.5 * se - CY - bob) / s];
    let arms, grip, leanP, nodP, roarP;
    if (t < T0) {
      // the lift: palms against its sides, a little below its middle, turned up and in
      const aL = -0.95 + 0.1 * Math.sin(t * 1.7), aR = PI + 0.95 - 0.1 * Math.sin(t * 1.5 + 1), [lx, ly] = loc(SX - Rs - 5 * vz, SY + Rs * 0.3, aL), [rx, ry] = loc(SX + Rs + 5 * vz, SY + Rs * 0.3, aR);
      grip = b4Pose('claw', 'grab', 0.4 + 0.2 * Math.sin(t * 2.1) + 0.3 * lift);
      arms = [{ x: lx, y: ly, pose: grip, ang: aL, fs, front: true, layer: 'palm' }, { x: rx, y: ry, pose: grip, ang: aR, fs, front: true, layer: 'palm' }];
      const talk = t > 125.0 && t < 126.0 ? Math.max(0, Math.sin(t * 17)) * 0.35 : 0;
      leanP = -8 * Math.sin(lift * PI) + 4 * lift + 2 * Math.sin(t * 0.8); nodP = 6 * Math.sin(lift * PI * 0.8) - 6 * lift * lift; roarP = talk + 0.2 * Math.sin(lift * PI);
    } else {
      const aL0 = -0.95 - 0.5 * hurl, aR0 = PI + 0.95 - 0.5 * hurl;
      const [hlx, hly] = loc(SX - Rs - 5 * vz, SY + Rs * 0.3, aL0), [hrx, hry] = loc(SX + Rs + 5 * vz, SY + Rs * 0.3, aR0);
      const [rlx, rly] = loc(rx0 - Rs - 5 * vz, ry0 + Rs * 0.3, -1.45), [rrx, rry] = loc(rx0 + Rs + 5 * vz, ry0 + Rs * 0.3, PI + 0.45);
      const [dlx, dly] = b4Idle(t, 0, 4), [drx, dry] = b4Idle(t, 1, 4), pb = B4_PB(t), heave = pressing ? 4 * Math.sin(t * 2.3) : 0;
      grip = b4Pose('claw', 'grab', 0.45 + 0.35 * wind);
      const openP = b4Pose('grab', 'open', ft), k8 = eio(b4Clip(138.0, 138.4, t));
      let oL = [lerp(rlx, -150, ft) + dlx * settle + heave + 30 * pb, lerp(rly, -4, ft) + dly * settle - 50 * pb], oR = [lerp(rrx, -40, ft) + drx * settle + heave + 40 * pb, lerp(rry, 10, ft) + dry * settle - 30 * pb];
      oL = [lerp(oL[0], -96, k8), lerp(oL[1], -70 - 30 * op, k8)]; oR = [lerp(oR[0], 110 + drx, k8), lerp(oR[1], 80 + dry, k8)];
      arms = held ? [{ x: hlx, y: hly, pose: grip, ang: aL0, fs, front: true, layer: 'palm' }, { x: hrx, y: hry, pose: grip, ang: aR0, fs, front: true, layer: 'palm' }]
        : [{ x: oL[0], y: oL[1], pose: k8 > 0 ? b4Pose('claw', 'open', op) : openP, ang: k8 > 0.5 ? -2.0 - 0.4 * op : lerp(-1.45, PI + 0.1, ft), fs, front: k8 < 0.5 },
          { x: oR[0], y: oR[1], pose: k8 > 0.5 ? b4Flex(t, 1, 'fist') : openP, ang: k8 > 0.5 ? undefined : lerp(PI + 0.45, PI - 0.1, ft), fs, front: k8 < 0.5 }];
      // the whole body throws it: rears back (away from it), then everything forward, then into the push
      const thrown = l2 < 0.42 ? 24 * wind : lerp(24, -28, hurl) * (1 - settle) + (-10 + 3 * Math.sin(t * 1.3)) * settle - 4 * z5Knock(g0, 1, 9, 4), wP = sstep(127.3, 127.9, t);
      leanP = lerp(thrown, B4_PL(t) + 3 * Math.sin(t * 1.3), wP) + 8 * op;
      nodP = lerp(-7 * wind * (1 - hurl) + 9 * hurl * (1 - settle) + 3 * settle, B4_PN(t), wP);
      roarP = lerp(0.25 + 0.6 * hurl * (1 - settle), B4_PR(t), wP);
    }
    const R_ = b4Sund(CX, CY, s, t, { eyes: 1.8, rage: 1, roar: roarP, nod: nodP, tilt: t < 127.6 ? 0.12 * hurl * (1 - settle) + 0.06 * settle : 0.05 + 0.1 * op, lean: leanP, arms, heat: 0.95 });
    if (held) { b4BSun(SX, SY, Rs, t); b4Fing(R_.hands[0], grip, 0.95, -1); b4Fing(R_.hands[1], grip, 0.95, 1); b4Leak(SX, SY, Rs, (t < T0 ? 26 : 22) * vz, 10, t, t < T0 ? 0.6 : 0.5, 2523, [105, 103]); }
    // what light is left streams into it while he lifts it
    if (t < T0) { for (let k = 0; k < 40; k++) { const aa = ih(k, 1, 2422) * TAU, u = frac(ih(k, 2, 2422) - t * 0.9), RR = Rs + 6 + u * 200; lineP(SX + Math.cos(aa) * RR, SY + Math.sin(aa) * RR, SX + Math.cos(aa) * (RR + 4 + 14 * u), SY + Math.sin(aa) * (RR + 4 + 14 * u), u < 0.3 ? 105 : u < 0.6 ? 18 : 17); } warp(SX, SY, 3 * Rs, 0.35, 1); }
    // he keeps it pressing: fire pours from his open palms into it
    if (t > 127.0 && t < 135.2) for (const h of R_.hands.slice(0, 2)) if (h && h.palm) z5Beam(h.palm[0], h.palm[1], SX, SY, (3 + Math.sin(t * 20)) * Math.min(1.5, vz), (f) => f < 0.4 ? 106 : f < 0.8 ? 104 : 102, t, 3);
    // the trail of the flung sun
    if (!held && t < 127.0) for (let k = 1; k < 6; k++) { const f2 = eic(b4Clip(T0 + rel, 127.0, t - k * 0.025)); blackSun(lerp(rx0, C.cx, f2), lerp(ry0, C.cy, f2) - Math.sin(f2 * PI) * 20 * vz, Rs * (1 - k * 0.12), t, 0.5); }
    // ---- the black sun (and from 138.0 its two halves parting, the light pouring out of it)
    const ux = Math.cos(a), uy = Math.sin(a);
    if (g5 < 0) { if (!held) b4BSun(SX, SY, Rs, t); }
    else {
      z5GodRays(SX, SY, 9, t * 0.5, T_WARM, 0.7 * op, 520); glow(SX, SY, (60 + 200 * op) * vz, T_WH, 0.55 * (1 - 0.4 * op));
      const nx = -uy, ny = ux, gap = (6 + 70 * op) * vz;
      for (const sd of [-1, 1]) b4HalfSun(SX + nx * gap * sd + ux * 20 * op * sd * vz, SY + ny * gap * sd + 30 * op * op * vz, Rs * (1 - 0.15 * op), t, nx, ny, sd, op, sstep(0.3, 1.4, g5));
      for (let k = -1; k <= 1; k++) lineF(SX - ux * 300, SY - uy * 300 + k, SX + ux * 300, SY + uy * 300 + k, (x, y) => { if (bay(x, y) < 1 - op * 0.6) P(x, y, k ? 60 : 22); });
      for (let k = 0; k < 30; k++) { const u = frac(ih(k, 1, 2611) + g5 * 0.8), d = (ih(k, 2, 2611) - 0.5) * 2 * Rs, x = SX + ux * d + nx * (ih(k, 3, 2611) - 0.5) * gap * 2 + nx * u * 40 * (k % 2 ? 1 : -1), y = SY + uy * d + ny * (ih(k, 3, 2611) - 0.5) * gap * 2 + u * u * 40; if (bay(fl(x), fl(y)) < 1 - u) rectF(x, y, 2, 2, k % 3 ? 105 : 103); }
    }
    // ---- the hero and its blade
    const hero = b4Inf(HX, HY, S, t, ho);
    let blade;
    if (t < 132.0) blade = { L: 1100, o: { form: 'infinite', flare: 0.8, surge: true, cracks: g1 > 0 ? 0.5 + 0.3 * clamp(g1, 0, 1) : 0 } };
    else if (t < 132.9) { const L = 1100, snap = (96 + 46 * 0.6) / L, off = [Math.cos(a + 0.5) * g2 * 300 * vz, (Math.sin(a + 0.5) * g2 * 300 + g2 * g2 * 80) * vz]; blade = { L, o: { form: 'infinite', flare: 0.6, cracks: 0.6, snap, snapOff: off } }; }
    else { const reg = eoc(b4Clip(134.2, 135.1, t)), L = lerp(123.6, 1400, reg); blade = { L, o: reg > 0 ? { form: 'infinite', flare: 0.9, grow: t < 135.1 ? 0.6 + 0.4 * reg : 1, surge: true, cracks: 0.7 * (1 - reg) } : { form: 'infinite', flare: 0.4, cracks: 0.7, snap: 0.999 } }; }
    bigBlade(hero.hand[0], hero.hand[1], a, blade.L * vz, ws * (t > 134.2 ? 1 + 0.4 * eoc(b4Clip(134.2, 135, t)) : 1), t, blade.o);
    // the blade's light along its length; the hero lit by the contact
    for (let k = 1; k <= 3; k++) glow(hero.hand[0] + ux * k * 110 * vz, hero.hand[1] + uy * k * 110 * vz, 50 * vz, T_WH, 0.1);
    if (lit > 0) glow(LX, LY, 110 * vz, T_WARM, 0.16 * lit);
    // ---- the contact
    const pw = Math.min(1.7, Math.pow(vz, 0.6));
    if (pressing && t < 135.3) {
      b4Contact(C.px, C.py, g0, t, (1 + 0.3 * Math.min(1, g0 / 2) + (t > 129 ? 0.2 : 0)) * pw, a + PI / 2, [SX, SY, Rs]);
      // the cracks racing along the blade from the contact (130.0)
      if (g1 > 0 && t < 132.0) for (let k = 0; k < 7; k++) { const u = clamp(g1 * 3, 0, 1) * (40 + ih(k, 1, 2531) * 160) * vz / 2, s0 = (ih(k, 2, 2531) - 0.5) * 2 * u; let x = C.px - uy * 2, y = C.py + ux * 2; for (let q = 0; q < 8; q++) { const nx2 = x + ux * s0 / 8 + (ih(k, q, 2532) - 0.5) * 6, ny2 = y + uy * s0 / 8 + (ih(k, q, 2533) - 0.5) * 6; lineP(x, y, nx2, ny2, 0); x = nx2; y = ny2; } }
      // grit and void ripped off its body by the pressure
      for (let k = 0; k < 14; k++) { const u = frac(ih(k, 1, 2535) + t * 1.8), x = HX + 50 * vz - u * 260 + ih(k, 2, 2535) * 30, y = HY - 40 * vz + ih(k, 3, 2535) * 90 * vz + u * 20; if (bay(fl(x), fl(y)) < 1 - u) rectF(x, y, 2, 1, k % 3 ? 85 : 22); }
    }
    if (g0 >= 0) megaHit(C.px, C.py, g0, 2.5, a + PI / 2, [22, 85, 83], 2521);
    if (g1 >= 0) megaHit(C.px, C.py, g1, 2.6, a + PI / 2, [22, 85, 83], 2534);
    if (g2 >= 0) { megaHit(C.px, C.py, g2, 2.9, a, [22, 85, 83], 2541); const sx = hero.hand[0] + ux * 123.6 * vz, sy = hero.hand[1] + uy * 123.6 * vz; rocks(sx, sy, g2, 26, 260 * vz, 3 * vz, [83, 85, 22, 22], 2542, 120, a + 0.4, 1.8); }
    // on its knees under it: the dark closes in from the edges
    const sink = eoc(b4Clip(132.6, 134.0, t)) * (1 - eio(b4Clip(134.0, 134.4, t)));
    if (sink > 0.01) for (let y = LB; y < H - LB; y++) for (let x = 0; x < W; x++) { const d = Math.hypot((x - HX) / 260, (y - HY) / 150); if (d > 0.6) tintI(y * W + x, x, y, T_DARK, (d - 0.6) * 1.2 * (0.5 + 0.5 * sink) * Math.min(1, sink * 3)); }
    if (t > 133.88 && t < 134.0) glow(HX, HY, 60 * vz, T_WH, 0.3 * (t - 133.88) / 0.12);
    // FURTHER!!: the dark blown back from it in a ring of every colour
    if (g3 >= 0 && g3 < 1.2) { shockRing(HX, HY, 10 + g3 * 420, 10 + g3 * 420, 5, [22, PRISM[fl(t * 20) % 7], PRISM[(fl(t * 20) + 3) % 7]], 1 - g3 / 1.2); shockRing(HX, HY, 6 + g3 * 260, 6 + g3 * 260, 3, [22, 60, 59], 1 - g3 / 0.9); }
    if (g3 >= 0 && g3 < 0.034) impactFrame(HX, HY, 1);
    // into the black sun: where the blade is inside it light pours from the wound, and its edges throw sparks
    if (g4 > 0 && g5 < 0) {
      const px = SX - hero.hand[0], py = SY - hero.hand[1], m = px * ux + py * uy, q = Math.abs(-px * uy + py * ux), hc = Math.sqrt(Math.max(0, Rs * Rs - q * q)), drive = eio(b4Clip(136.0, 138.0, t));
      const e1 = [hero.hand[0] + ux * (m - hc), hero.hand[1] + uy * (m - hc)], e2 = [hero.hand[0] + ux * (m + hc), hero.hand[1] + uy * (m + hc)];
      for (const [ex, ey] of [e1, e2]) b4Contact(ex, ey, g4, t, (0.8 + 0.4 * drive) * pw, a - PI / 2, [SX, SY, Rs]);
      for (let k = 0; k < 6; k++) { const u = (k + 0.5) / 6, x = lerp(e1[0], e2[0], u), y = lerp(e1[1], e2[1], u); z5Ray(x, y, a - PI / 2 + Math.sin(t * 9 + k) * 0.2, (10 + 30 * drive * ih(k, fl(t * 15), 2601)) * vz, 2, 22, 60, 0.8); }
      glow((e1[0] + e2[0]) / 2, (e1[1] + e2[1]) / 2, (40 + 60 * drive) * vz, T_WH, 0.35 + 0.2 * drive);
      megaHit(e1[0], e1[1], g4, 2.8, a, [22, 85, 83], 2602);
    }
    if (g5 >= 0) { if (g5 < 0.034) impactFrame(SX, SY, 1); shockRing(SX, SY, 10 + g5 * 500, 10 + g5 * 500, 5, [22, 16, 15], 1 - g5 / 1.0); shk(7 * Math.exp(-g5 * 3)); }
    shk(t < T0 ? 0.6 + lift : pressing ? 1.2 + 3 * Math.exp(-Math.max(0, g0) * 2) : g3 > 0 && g3 < 1.75 ? 3 + 4 * (1 - g3 / 1.75) : 0.8);
    // ---- foreground: wisps of cloud and cinders streaming past the lens
    for (let k = 0; k < 5; k++) { const x = ((ih(k, 1, 2561) * 700 - vx * vz * 1.7 - t * 24) % 700 + 700) % 700 - 110, y = ((ih(k, 2, 2561) * 420 - vy * vz * 1.7) % 420 + 420) % 420 - 60; if (Math.abs(x - 240) < 180 && y > 50 && y < 230) continue; cloudPuff(x, y, 16 + ih(k, 3, 2561) * 14, [17, 18, 19, 15], 2562 + k); }
    for (let k = 0; k < 16; k++) { const x = ((ih(k, 4, 2561) * 560 - vx * vz * 2.2 + Math.sin(t + k) * 10) % 560 + 560) % 560 - 40, y = ((ih(k, 5, 2561) * 320 - vy * vz * 2.2 - t * 30) % 320 + 320) % 320; if (y > LB && y < H - LB) { rectF(x, y, 2, 2, k % 2 ? 104 : 121); P(x, y, k % 2 ? 106 : 123); } }
    // ---- the camera: banks into its moves, kicked on every hit
    const roll = clamp(-(vx - pvx) * 30 * 0.00005, -0.035, 0.035);
    const [kz, kr] = kick(t, [[127.0, 2.5], [130.0, 2], [132.0, 3], [134.0, 2], [136.0, 3], [138.0, 3]]);
    z5Cam(1.0 + kz, kr + roll, 240, 135, 240, 135);
  });
  CAPS.push([125.0, 126.6, 's', 'SUNDERER', 'THEN WE BOTH END.']);
  CAPS.push([134.2, 135.6, 'x', '', 'FURTHER!!', 62]);

  /* ================================================================ V.14 — the final combo (139.6–145.0) */
  // five cuts, each taking part of him; his state at any moment of it (absolute t)
  const B4_C = [140.0, 140.6, 141.2, 141.8, 142.4];
  const B4_MASKA = 1.93;                                   // the line the mask is cut along (mask frame)
  const B4_STOP = 2 / 30;                                  // the biggest hits hold on their contact for two frames
  function b4SundC(cx, cy, s, t, o) {
    const ul = t < B4_C[0] ? o.ul : null, l0 = t < B4_C[2], l1 = t < B4_C[4], half = t >= B4_C[3] && o.mask !== false;
    const wound = (o.wounds || []).concat(t >= B4_C[2] ? [[-110, 64, 80, 178, 3 + 2 * Math.min(1, (t - B4_C[2]) * 6)]] : []);
    const so = Object.assign({ heat: 0.95, rage: 1, third: 1, eyes: 1.6, crown: t < B4_C[1] ? 1 : 0.22, maskCuts: B4_MCUT }, o, { wounds: wound, arms: [ul, o.ur || null, l0 ? (o.low || B4_LOW)[0] : null, l1 ? (o.low || B4_LOW)[1] : null] });
    if (half) so.mask = false;
    const r = sunderer(cx, cy, s, t, so);
    // where an arm was taken at the shoulder: a burning socket, riding the shoulders' lean
    if (!o.split) for (const [k, gone] of [[0, !ul], [2, !l0], [3, !l1]]) if (gone && (k !== 0 || t >= B4_C[0])) { const [lx, ly] = SH4[k], X = cx + (lx + r.lean * (k < 2 ? 0.85 : 0.6)) * s, Y = cy + Math.sin(t * 0.9) * s + ly * s; discF(X, Y, 9 * s, 101); discF(X, Y, 6 * s, 103); discF(X, Y, 3 * s, 105); glow(X, Y, 22 * s, T_EMBER, 0.4); for (let q = 0; q < 4; q++) { const g = frac(t * 0.9 + ih(k, q, 2701)); rectF(X + (ih(k, q, 2702) - 0.5) * 14 * s, Y + 8 * s + g * 60 * s, Math.max(1, s * 1.5), Math.max(2, s * 3), g < 0.5 ? 105 : 103); } }
    if (half) b4MaskPart(cx, cy, s, t, so, 1, null, 0, r.lean);
    return r;
  }
  // one side of his mask (side +1 keeps the right of the cut, -1 the left), placed exactly as sunderer() places it (with
  // its lean and shake), moved by off and turned by rot (the half that falls); the kept half shows the molten inside of
  // his head where the other was, with relief and the glow of the cut on it
  function b4MaskPart(cx, cy, s, t, o, side, off, rot, lean) {
    cy += Math.sin(t * 0.9) * s;
    const sh = o.shake ? z5Sh(t, 7) * o.shake : 0;
    const mcx = cx + Math.sin(t * 0.6) * 0.6 * s + sh + (lean || 0) * s * 0.95 + (off ? off[0] : 0), mcy = cy + Math.sin(t * 0.9 - 0.8) * 0.5 * s + (o.nod || 0) * s + (off ? off[1] : 0);
    const tilt = Math.sin(t * 0.47) * 0.035 + (o.tilt || 0) + (rot || 0), cT = Math.cos(tilt), sT = Math.sin(tilt), ax = Math.cos(B4_MASKA), ay = Math.sin(B4_MASKA);
    const spl = o.split || 0, sa = o.splitA === undefined ? 1.2 : o.splitA, sux = Math.cos(sa), suy = Math.sin(sa), spx = o.splitX || 0, spy = o.splitY || 0;
    const sideOf = (lx, ly) => ((lx - spx) * -suy + (ly - spy) * sux) > 0 ? 1 : -1;
    const slide = (sd) => [-suy * sd * spl * 40 + sux * sd * spl * 10, sux * sd * spl * 40 + suy * sd * spl * 10 + spl * spl * 30];
    const R = 30 * s + spl * 50 * s, x0 = Math.max(0, fl(mcx - R)), x1 = Math.min(W - 1, Math.ceil(mcx + R)), y0 = Math.max(0, fl(mcy - R)), y1 = Math.min(H - 1, Math.ceil(mcy + R));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      let qx = (x + 0.5 - mcx) / s, qy = (y + 0.5 - mcy) / s;
      if (spl > 0) { let hit = null; for (const sd2 of [1, -1]) { const [ox, oy] = slide(sd2), a2 = qx - ox, b2 = qy - oy; if (sideOf(a2, b2) === sd2) { hit = [a2, b2]; break; } } if (!hit) continue; qx = hit[0]; qy = hit[1]; }
      const mx = qx * cT + qy * sT, my = -qx * sT + qy * cT;
      const c = sMaskPx(mx, my, x, y, t, o); if (c < 0) continue;
      if (spl > 0 && Math.abs((qx - (o.splitX || 0)) * -suy + (qy - (o.splitY || 0)) * sux) < 1.2) { BUF[y * W + x] = 22; continue; }
      const sd = (mx * ay - my * ax) * -1, e = Math.abs(sd);
      if (sd * side < 0) {
        if (side > 0 && !off) {
          // the inside of his head: black stone in relief, lit by the cut, molten seams running back from it
          const hgt = vn(mx, my, 2.6, 2703) * 1.4 + vn(mx, my, 6, 2704), gx = vn(mx + 0.6, my, 2.6, 2703) * 1.4 + vn(mx + 0.6, my, 6, 2704) - hgt, lit = 0.4 - gx * 3 - e * 0.05;
          BUF[y * W + x] = e < 1.2 ? 107 : e < 2.4 ? 105 : seamAt(mx / 4 + 7, my / 4) < 0.06 ? (e < 8 ? 104 : 102) : e < 4.5 ? 102 : OBS[clamp(fl(lit * 3 + (bay(x, y) - 0.5) * 0.8), 0, 3)];
        }
        continue;
      }
      BUF[y * W + x] = e < 0.9 ? 22 : e < 1.8 ? 105 : c;
    }
  }
  // the slash a giant blade leaves in the combo: only a thin crescent near its tip (the old full-width fan hid the bodies),
  // white at the leading edge, a band of prism, dissolving into its tail
  function b4Arc(hx, hy, a0, d, L, fade) {
    const ad = Math.min(Math.abs(d), TAU - 0.05); if (ad < 0.3 || fade >= 1) return;
    const R = L * 1.06, x0 = Math.max(0, fl(hx - R)), x1 = Math.min(W - 1, Math.ceil(hx + R)), y0 = Math.max(LB, fl(hy - R)), y1 = Math.min(H - LB - 1, Math.ceil(hy + R));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const i = y * W + x; if (SMASK[i]) continue;
      const dx = x + 0.5 - hx, dy = y + 0.5 - hy, r = Math.sqrt(dx * dx + dy * dy); if (r > R || r < L * 0.7) continue;
      let rel = Math.atan2(dy, dx) - a0; rel = d > 0 ? ((rel % TAU) + TAU) % TAU : ((-rel % TAU) + TAU) % TAU;
      if (rel > ad) continue;
      const u = rel / ad, rin = L * (0.97 - 0.13 * Math.pow(u, 1.5)), rout = L * 1.02; if (r < rin || r > rout) continue;
      const e = (r - rin) / (rout - rin); if (bay(x, y) > u * 1.5 - fade * 1.8 - 0.15) continue;
      BUF[i] = u > 0.95 || e > 0.9 ? 22 : u > 0.75 ? 60 : PRISM[fl(e * 6.99)];
    }
  }
  // where a blade from hand at angle a passes a target: the point on the blade nearest it (the contact), and how far off
  function b4OnBlade(hand, a, T) { const ux = Math.cos(a), uy = Math.sin(a), d = (T[0] - hand[0]) * ux + (T[1] - hand[1]) * uy; return [hand[0] + ux * d, hand[1] + uy * d, Math.abs(-(T[0] - hand[0]) * uy + (T[1] - hand[1]) * ux)]; }
  /* a cut landing, g seconds after: ONE impact frame; then the held contact (the stroke of light left across him along the
     blade, a hot point where it bites); sparks thrown on along the stroke, molten spatter back; a tight ring; the shake.
     Small glow: the hit is read off the bodies, not off a white-out */
  function b4Cut(x, y, g, a, seed, pw, st, noIF) {
    if (g < 0 || g > 0.8) return;
    pw = pw || 1; st = st === undefined ? B4_STOP : st;
    if (g < 1 / 60) { if (noIF) glow(x, y, 60 * pw, T_WH, 0.6); else impactFrame(x, y, 0); }
    const ux = Math.cos(a), uy = Math.sin(a);
    if (g < st + 0.07) {
      const k = 1 - g / (st + 0.07), L = 64 * pw;
      thick(x - ux * L * k, y - uy * L * k, x + ux * L, y + uy * L, 1, 22);
      lineP(x - ux * L * 0.6 - uy * 2, y - uy * L * 0.6 + ux * 2, x + ux * L * 0.8 - uy * 2, y + uy * L * 0.8 + ux * 2, 60);
      discF(x, y, 2 + 3 * k * pw, 22);
      glow(x, y, 22 * pw, T_WH, 0.5 * k);
    }
    if (g < 0.55) {
      const f = g / 0.55;
      for (let k = 0; k < 22 * pw; k++) {
        const aa = a + (ih(k, 1, seed) - 0.5) * 0.9, v = (120 + ih(k, 2, seed) * 260) * pw, dd = v * g * (1 - g * 0.8), px = x + Math.cos(aa) * dd, py = y + Math.sin(aa) * dd + 120 * g * g;
        if (bay(fl(px), fl(py)) > 1.1 - f) continue;
        const tl = 2 + v * 0.02 * (1 - f); lineP(px, py, px - Math.cos(aa) * tl, py - Math.sin(aa) * tl, k % 3 ? 85 : 22);
      }
      for (let k = 0; k < 12 * pw; k++) {
        const aa = a + PI + (ih(k, 3, seed) - 0.5) * 1.6, v = (40 + ih(k, 4, seed) * 110) * pw, px = x + Math.cos(aa) * v * g, py = y + Math.sin(aa) * v * g + 220 * g * g;
        if (bay(fl(px), fl(py)) > 1.05 - f) continue;
        rectF(px, py, 2, 2, f < 0.4 ? 105 : 103);
      }
      shockRing(x, y, 6 + g * 160 * pw, 4 + g * 70 * pw, 1, [22, 85, 83], 1 - g / 0.3);
    }
    glow(x, y, 50 * pw * Math.max(0, 1 - g * 2), T_GOLD, 0.3);
    shk(5 * pw * Math.max(0, 1 - g * 3));
  }
  // a severed arm: shoulder (ax, ay), elbow, wrist (or null for a stump) as they were at the cut, g seconds ago, thrown
  // along (vx, vy) and turning about its middle; the fingers spasm and go slack, and the cut end bleeds fire
  function b4Limb(ax, ay, ex, ey, wx, wy, s, g, vx, vy, spin, pose, k, t) {
    if (g < 0) return;
    const ox = wx === null ? (ax + ex) / 2 : (ax + ex + wx) / 3, oy = wx === null ? (ay + ey) / 2 : (ay + ey + wy) / 3;
    const mx = ox + vx * g, my = oy + vy * g + 160 * g * g, rot = spin * g, c = Math.cos(rot), sn = Math.sin(rot);
    const rp = (x, y) => { const dx = x - ox, dy = y - oy; return [mx + dx * c - dy * sn, my + dx * sn + dy * c]; };
    const pa = rp(ax, ay), pe = rp(ex, ey), pw = wx === null ? null : rp(wx, wy);
    const twitch = b4Pose(pose || 'open', 'claw', 0.5 + 0.5 * Math.sin(g * 34) * Math.exp(-g * 3));
    b4ArmLook(pa[0], pa[1], pe[0], pe[1], pw ? pw[0] : null, pw ? pw[1] : null, s, 0.3 + 0.5 * Math.exp(-g * 1.5), k, twitch, undefined, t);
    for (let q = 1; q < 7; q++) { const gg = g - q * 0.03; if (gg > 0) { const [qx, qy] = [ox + vx * gg, oy + vy * gg + 160 * gg * gg], d = [pa[0] - mx, pa[1] - my]; rectF(qx + d[0], qy + d[1], 2, 2, q < 3 ? 105 : 103); } }
    glow(pa[0], pa[1], 18 * s, T_EMBER, 0.5 * Math.exp(-g * 2));
  }
  // the crown's blades, cut loose and flung
  function b4CrownShards(cx, cy, s, g, seed) {
    if (g < 0 || g > 2) return;
    for (let k = 0; k < 9; k++) {
      const a = -PI + (k + 0.5) / 9 * PI, v = (90 + ih(k, 1, seed) * 140), x = cx + Math.cos(a) * (40 * s + v * g), y = cy - 8 * s + Math.sin(a) * (40 * s + v * g) + 200 * g * g, r = g * (4 + ih(k, 2, seed) * 8) + a, L = (24 + ih(k, 3, seed) * 20) * s, w = 3.5 * s;
      const ux = Math.cos(r), uy = Math.sin(r);
      z5Tri(x - ux * L * 0.5 - uy * w, y - uy * L * 0.5 + ux * w, x - ux * L * 0.5 + uy * w, y - uy * L * 0.5 - ux * w, x + ux * L * 0.5, y + uy * L * 0.5, 96);
      lineP(x - ux * L * 0.5, y - uy * L * 0.5, x + ux * L * 0.5, y + uy * L * 0.5, 103);
    }
  }
  // his reaction to a cut g seconds after it: nothing while the contact holds, then the knock (a function of g)
  const b4Rx = (g, amp, w, d) => g < B4_STOP ? 0 : z5Knock(g - B4_STOP, amp, w || 9, d || 4);
  const b4Shud = (g, t) => g >= 0 && g < B4_STOP ? z5Sh(t, 7) * 2.5 : 0;
  /* ================================================================ V.17 — THE FINAL CUT (144.75–146.6) */
  // wide: it swings the whole Worldblade over and down, crown to base, and the cut runs on through the clouds, the sea
  // and the horizon: the whole world split along one line, as he once split it
  const B4_FA = PI / 2 - 0.1;
  const B4_FX = 250, B4_FY = 154, B4_FS = 1.4;
  function b4WorldWide(t, dk) {
    b4Sky(t, 150, 0, 0, 0, 0);
    // the cloud sea to the horizon
    cloudBank(150, 10, 90, 5061, t * 4, [17, 18, 19, 20], false);
    cloudBank(176, 18, 70, 5051, t * 8, CLOUD_SUN, false);
    cloudBank(206, 26, 60, 5052, t * 12, [17, 18, 19, 15], false);
    if (dk > 0) tintAll(T_DARK, dk);
  }

  /* ---------------------------------------------------------------- the combo, his last fist and THE FINAL CUT: ONE shot
     139.6–146.6, one world and one travelling camera. The hero never stops: it springs up over his swipe and dives down its
     own blade through his upper-left arm at the shoulder (140.0), carries on round his right side under his backhand and
     sweeps back over the top through the crown (140.6), drops past his grab down across the chest through the lower-left
     stump (141.2), climbs his right side past his catching hand and comes down through his face (141.8: half the mask goes),
     loops under him and cuts up through the last stump (142.4), circles over his head to the left and levels its point at
     him; he rears back with his whole body and throws his last fist, which stops dead on the point (143.4) and breaks; it
     rises over his crown as the Worldblade regrows and brings it down crown to base (145.0). He fights with his whole body:
     a wind-up for every blow pulls him back, every cut throws him round, and the next wind-up grows out of the last recoil.
     The camera travels with the hero, a beat behind it: pulls out, tilts up over his crown, drops down his chest, pushes in
     on the face, banks into the turns. Hit-stop: two frames, on the face cut, the fist and the final cut only. */
  // a keyed track (absolute time) of numbers or arrays: [[t, v, ease]] (the ease into the key: 'o', 'i', 'io' (default), 'l')
  function b4K(keys, t) {
    const E_ = { o: eoc, i: eic, io: eio, l: (u) => u };
    if (t <= keys[0][0]) return keys[0][1];
    for (let n = 1; n < keys.length; n++) if (t < keys[n][0]) {
      const [t0, a] = keys[n - 1], [t1, b, e] = keys[n], u = E_[e || 'io']((t - t0) / (t1 - t0));
      return Array.isArray(a) ? a.map((v, k) => lerp(v, b[k], u)) : lerp(a, b, u);
    }
    return keys[keys.length - 1][1];
  }
  // a smooth path through keys [t, a, b, c...] (cubic Hermite, tangents from the neighbours; still at the ends and where a
  // key repeats the next one) — a camera that glides through its marks instead of stopping on each
  function b4Spl(keys, t) {
    const n = keys.length, D = keys[0].length - 1;
    if (t <= keys[0][0]) return keys[0].slice(1);
    if (t >= keys[n - 1][0]) return keys[n - 1].slice(1);
    let i = 0; while (keys[i + 1][0] <= t) i++;
    const tan = (j, k) => { if (j <= 0 || j >= n - 1 || keys[j][k] === keys[j + 1][k]) return 0; return (keys[j + 1][k] - keys[j - 1][k]) / (keys[j + 1][0] - keys[j - 1][0]); };
    const A = keys[i], B = keys[i + 1], h = B[0] - A[0], u = (t - A[0]) / h, u2 = u * u, u3 = u2 * u;
    const out = [];
    for (let k = 1; k <= D; k++) out.push((2 * u3 - 3 * u2 + 1) * A[k] + (u3 - 2 * u2 + u) * h * tan(i, k) + (-2 * u3 + 3 * u2) * B[k] + (u3 - u2) * h * tan(i + 1, k));
    return out;
  }
  const B4_HD = 2 / 30, B4_HOLD = [141.8, 143.4, 145.0];
  // the clock of the fight: it stops for two frames on the three biggest hits and catches up over the next 0.15 s, so every
  // later beat still lands on its cue
  function b4Clk(t) {
    for (const h of B4_HOLD) { const g = t - h + 1e-4; if (g >= 0 && g < B4_HD - 1e-3) return h; if (g >= B4_HD - 1e-3 && g < B4_HD + 0.15) return h + Math.max(0, g - B4_HD) * (B4_HD + 0.15) / 0.15; }
    return t;
  }
  // the world of the shot: his mask at (B4_WX, B4_WY), B4_WS px per local unit; the camera B4V (focus and zoom, a dolly: things
  // are drawn at their size on screen, not magnified)
  const B4_WX = 320, B4_WY = 112, B4_WS = 1.5, B4_HS = 1.45;
  let B4V = { x: 240, y: 135, z: 1 };
  const b4P = (x, y) => [240 + (x - B4V.x) * B4V.z, 135 + (y - B4V.y) * B4V.z];
  const B4_FZ = 0.75;                                         // the final framing: wide, the hero high over his crown
  const B4_CAMK = [[139.6, 179, 154, 1.3], [139.86, 168, 112, 1.04], [140.02, 196, 134, 1.08], [140.24, 300, 168, 0.97], [140.44, 372, 92, 0.95], [140.62, 340, 84, 0.9],
    [140.86, 252, 80, 0.88], [141.06, 196, 128, 0.92], [141.22, 212, 192, 1.04], [141.5, 330, 186, 0.95], [141.68, 372, 84, 1.14], [141.82, 350, 72, 1.3], [142.06, 300, 138, 1.12],
    [142.42, 372, 212, 1.0], [142.72, 334, 140, 0.95], [143.1, 300, 130, 0.92], [143.42, 272, 142, 1.0], [143.78, 272, 136, 0.98], [144.2, 286, 96, 0.95],
    [144.62, B4_WX - 10 / B4_FZ, B4_WY - 55 / B4_FZ, B4_FZ], [146.6, B4_WX - 10 / B4_FZ, B4_WY - 55 / B4_FZ, B4_FZ]];
  // the hero (world): x, y, sw (the blade, unwrapped so each swing turns the way it is thrown), a (body), S (blade length)
  const B4_DV = K({ t: 139.6, x: 110, y: 190, sw: -0.47, a: 0, S: 190 },
    { t: 139.84, x: 84, y: 44, sw: -2.4, a: -0.15, e: 'o' },                 // up over his swipe, the blade cocked overhead
    { t: 140.0, x: 112, y: 108, sw: 0.9, a: 0.35, e: EQ },                  // 1 — down its blade through the shoulder
    { t: 140.2, x: 262, y: 262, sw: 1.9, a: 0.5, e: 'o' },                  //     and on along it
    { t: 140.36, x: 476, y: 190, sw: 2.9, a: -0.2 },                       // round his right side, under the backhand
    { t: 140.5, x: 456, y: 8, sw: 5.38, a: -0.3, e: 'o' },                 // up, the blade carried round over its head
    { t: 140.6, x: 424, y: 22, sw: 2.89, a: -0.3, e: EQ },                  // 2 — back over the top through the crown
    { t: 140.85, x: 200, y: 24, sw: 2.3, a: -0.2, e: 'o' },
    { t: 141.05, x: 78, y: 92, sw: 3.78, a: 0.1 },                          // wind-up, high on his left, under his grab
    { t: 141.2, x: 100, y: 200, sw: 6.74, a: 0.4, e: EQ },                  // 3 — down across the chest, the lower-left stump
    { t: 141.5, x: 446, y: 300, sw: 7.48, a: 0.4, e: 'o' },
    { t: 141.64, x: 476, y: 112, sw: 6.3, a: -0.3 },                        // up his right side, past the catching hand
    { t: 141.72, x: 446, y: 2, sw: 4.88, a: -0.2, e: 'o' },
    { t: 141.8, x: 372, y: 9, sw: 8.21, a: 0.4, e: EQ, S: 230 },            // 4 — down through his face
    { t: 142.1, x: 228, y: 232, sw: 8.58, a: 0.5, e: 'o', S: 200 },
    { t: 142.33, x: 478, y: 296, sw: 7.48, a: -0.1, S: 190 },               // under him to the right
    { t: 142.4, x: 468, y: 258, sw: 9.5, a: -0.3, e: EQ },                  // 5 — up from under through the last stump
    { t: 142.7, x: 362, y: 66, sw: 10.88, a: -0.2, e: 'o' },
    { t: 143.05, x: 128, y: 150, sw: 12.5, a: 0, S: 120 },                  // over his head to his left; the point levelled
    { t: 143.4, x: 150, y: 150, sw: 12.566, a: 0.06, e: 'i' },              // braced, driving in: his fist meets the point
    { t: 143.8, x: 154, y: 150, sw: 12.566, a: 0, S: 140 },
    { t: 144.35, x: 236, y: 40, sw: 10.9, a: -0.15, e: 'io', S: 420 },      // it rises over his crown, the blade regrowing
    { t: 144.75, x: B4_WX - 10 / B4_FZ + 1 / B4_FZ, y: B4_WY - 110 / B4_FZ, sw: 10.12, a: -0.1, e: 'o', S: 900 / B4_FZ },
    { t: 145.0, sw: 7.75, a: 0.15, e: EQ },                                 // THE FINAL CUT
    { t: 146.6, sw: 7.75, a: 0.1 });
  B4_DV.arcs = new Map([[140.36, -40], [140.5, -30], [142.33, -50], [143.05, -60]]);
  // him (local units): lean (+ right), nod (+ down), tilt, the roar
  const B4_LEAN = [[139.6, 4], [139.74, 18, 'o'], [139.9, -26, 'i'], [140.0, -22], [140.22, 28, 'o'], [140.36, 12], [140.47, 22, 'i'], [140.6, 16], [140.76, -8, 'o'], [140.95, -10],
    [141.12, -26, 'i'], [141.2, -24], [141.42, 26, 'o'], [141.6, 10], [141.8, 12], [142.05, -30, 'o'], [142.28, -12], [142.4, -10], [142.58, 16, 'o'], [142.8, 8], [143.12, 32],
    [143.4, -30, 'i'], [143.62, 26, 'o'], [143.95, 10], [144.4, 0], [144.75, -4], [146.6, -2]];
  const B4_NOD = [[139.6, 0], [139.88, -4], [140.0, -4], [140.2, 3, 'o'], [140.5, -3], [140.6, -3], [140.72, 10, 'o'], [141.0, 2], [141.2, 0], [141.42, 6, 'o'], [141.75, -6], [141.8, -6],
    [142.0, 5, 'o'], [142.4, 1], [142.55, -10, 'o'], [142.85, -3], [143.12, -6], [143.4, 6, 'i'], [143.6, -7, 'o'], [144.0, -2], [144.75, -6], [146.6, -6]];
  const B4_TILT = [[139.6, 0], [139.9, -0.08], [140.2, 0.1, 'o'], [140.6, 0], [140.76, -0.08, 'o'], [141.2, -0.05], [141.42, 0.12, 'o'], [141.8, 0.02], [142.05, 0.22, 'o'], [142.4, 0.08],
    [142.58, -0.1, 'o'], [143.12, 0.06], [143.4, -0.1], [143.62, 0.14, 'o'], [144.2, 0], [146.6, 0]];
  const B4_ROAR = [[139.6, 0.2], [139.88, 0.5], [140.05, 0.9, 'o'], [140.5, 0.5], [140.65, 0.8], [141.0, 0.5], [141.25, 0.9], [141.6, 0.5], [141.85, 1], [142.3, 0.6], [142.45, 1],
    [142.9, 0.6], [143.3, 1], [143.8, 0.8], [144.6, 0.4], [146.6, 0.4]];
  // his upper-left hand: drawn back low with the shoulder, then the swipe up at it (it springs over); the arm goes at 140.0
  const B4_UL = [[139.6, [-128, 110]], [139.74, [-104, 150], 'o'], [139.9, [-196, -6], 'i'], [140.0, [-188, -24], 'o']];
  // the last arm (upper right): a flinch, the backhand it slips under, the grab across his body, the catch it climbs past,
  // then the last fist: cocked back by the whole body, thrown, stopped dead on the point, driven back
  const B4_FP = [236, 150];                                   // where his knuckles meet the point (world)
  const B4_WC = [(B4_FP[0] + 10.8 * B4_WS - B4_WX) / B4_WS, (B4_FP[1] - B4_WY - Math.sin(143.4 * 0.9) * B4_WS) / B4_WS];
  const B4_UR = [[139.6, [132, 104]], [139.9, [124, 80]], [140.05, [112, 50], 'o'], [140.3, [150, 130]], [140.46, [176, -30], 'i'], [140.6, [160, -50], 'o'], [140.75, [146, 20], 'o'],
    [140.95, [120, 70]], [141.12, [-36, 30], 'i'], [141.2, [-50, 36], 'o'], [141.42, [70, 90], 'o'], [141.6, [130, 40]], [141.76, [120, -60], 'i'], [141.8, [116, -62]], [142.05, [150, 30], 'o'],
    [142.35, [140, 110]], [142.6, [120, 80], 'o'], [142.8, [128, 60]], [143.12, [132, 0]], [143.3, [30, -6], 'i'], [143.4, B4_WC, 'l'], [143.47, [B4_WC[0] + 16, B4_WC[1] + 2], 'o'], [143.75, [90, 20], 'o'],
    [144.2, [130, 80]], [144.75, [140, 100]]];
  const B4_URP = [[139.6, 0], [140.3, 0], [140.4, 0.7], [140.6, 0.2], [141.0, 0.6], [141.12, 1], [141.25, 0.4], [141.6, 0.3], [141.74, 1], [141.9, 0.6], [142.3, 0], [146.6, 0]];
  // where each cut bites (world), worked out from the tracks at the moment of the hit
  function b4Bite(k) {
    const h = B4_C[k], L = b4K(B4_LEAN, h), N = b4K(B4_NOD, h), bob = Math.sin(h * 0.9) * B4_WS, p = z5Trk(B4_DV, h);
    const T = [[B4_WX + (SH4[0][0] + L * 0.85) * B4_WS, B4_WY + bob + SH4[0][1] * B4_WS], [B4_WX + L * 1.425, B4_WY + bob + (N - 46) * B4_WS], [B4_WX + (SH4[2][0] + L * 0.6) * B4_WS, B4_WY + bob + SH4[2][1] * B4_WS],
      [B4_WX + L * 1.425, B4_WY + bob + N * B4_WS], [B4_WX + (SH4[3][0] + L * 0.6) * B4_WS, B4_WY + bob + SH4[3][1] * B4_WS]][k];
    const [x, y] = b4OnBlade([p.x, p.y], p.sw, T);
    return { x, y, a: p.sw };
  }
  const B4_BITE = [0, 1, 2, 3, 4].map(b4Bite);
  // the cloud sea under a blow: a ring pushed out across it and a heave of cloud thrown up (screen x, the deck's y)
  function b4Deck(x, hz, g, pw, seed) {
    if (g < 0 || g > 1.1) return;
    shockRing(x, hz + 18, 10 + g * 420 * pw, 3 + g * 46 * pw, 3, [22, 21, 20], 1 - g / 0.8);
    for (let k = 0; k < 7; k++) { const u = g / 1.1, dx = (ih(k, 1, seed) - 0.5) * 160 * pw * (0.4 + g), up = (40 + ih(k, 2, seed) * 60) * pw * g - 70 * g * g; if (up > 0) cloudPuff(x + dx, hz + 22 - up, (6 + ih(k, 3, seed) * 8) * pw * (1 - 0.4 * u), [17, 18, 19, 20], seed + k); }
  }
  // the sky of the shot: the light let out of the broken black sun high behind the hero, raking across the cloud sea; the deck
  // at three depths (it moves with the camera at less than the camera's speed: it is far)
  function b4CombBg(t, V, hz) {
    const z = V.z, ox = V.x * z * 0.5;
    b4Sky(t, clamp(hz, LB + 40, H - LB), 0, 0, 0, 0);
    const lx = 240 + (150 - V.x) * z * 0.45, ly = 135 + (-60 - V.y) * z * 0.45;
    z5GodRays(lx, ly, 9, t * 0.4, T_WARM, 0.3, 560);
    glow(lx, ly, 150, T_WH, 0.22);
    cloudBank(hz, 10 * z, 90, 5061, ox * 0.4 + t * 4, [17, 18, 19, 20], false);
    for (let k = 0; k < 6; k++) { const x = ((ih(k, 1, 2781) * 600 - ox * 0.55 + t * 6) % 600 + 600) % 600 - 60; cloudPuff(x, hz + 8 * z + ih(k, 2, 2781) * 10, (10 + ih(k, 3, 2781) * 10) * z, [17, 18, 19, 20], 2782 + k); }
    cloudBank(hz + 24 * z, 18 * z, 70, 5051, ox * 0.7 + t * 8, CLOUD_SUN, false);
    cloudBank(hz + 54 * z, 26 * z, 60, 5052, ox + t * 12, [17, 18, 19, 15], false);
  }
  // the hero on its track (world), drawn through the camera: afterimages on the dash, a stretch along it, the crescent its blade
  // leaves when it turns fast; len (screen px) overrides the blade's length
  function b4Dive(c, t, dx, dy, extra, len, arcL) {
    const z = B4V.z, p = z5Trk(B4_DV, c), q = z5Trk(B4_DV, c - 1 / 30), [x, y] = b4P(p.x + dx, p.y + dy);
    const vx = (p.x - q.x) * 30 * z, vy = (p.y - q.y) * 30 * z, sp = Math.hypot(vx, vy);
    const after = []; if (sp > 300) for (let k = 1; k <= 4; k++) { const a = z5Trk(B4_DV, c - k * 0.03), [ax, ay] = b4P(a.x + dx, a.y + dy); after.push([ax, ay, k === 1 ? 22 : PRISM[(k * 2 + fl(t * 30)) % 7], 0.6 - k * 0.13]); }
    const S = B4_HS * z;
    const r = b4Inf(x, y, S, t, Object.assign({ sw: p.sw, ang: p.a || 0, noLife: true, after, st: clamp((sp - 150) / 1500, 0, 0.45), sd: Math.atan2(vy, vx), spread: 1, flap: 0.36, wt: t * 3, orbR: 13 * S, orbA: 1.2, auraR: 2.6 * S, mouth: 2, warp: 0 }, extra || {}));
    const L = typeof len === 'function' ? len(r.hand) : len || p.S * z, N = 5, wa = []; for (let k = 0; k <= N; k++) wa.push(z5Trk(B4_DV, c - k / 30).sw);
    let m = 0, nw = -1; for (let k = 0; k < N; k++) if (Math.abs(wa[k] - wa[k + 1]) > 0.12) { m = k + 1; if (nw < 0) nw = k; }
    if (m) b4Arc(r.hand[0], r.hand[1], wa[m], wa[0] - wa[m], Math.min(L, arcL || 1e9) * 1.02, nw / N * 0.9);
    const tip = bigBlade(r.hand[0], r.hand[1], p.sw, L, 4.4 * Math.max(0.9, z), t, { form: 'infinite', flare: 0.5 + 0.5 * sstep(144.2, 144.8, c), surge: true });
    return { p, hand: r.hand, tip, sp, x, y };
  }
  // the camera: its marks, pulled a third of the way toward where the hero was a beat ago, and never letting it leave the frame
  function b4Cam(c) {
    const [kx, ky, z] = b4Spl(B4_CAMK, c), w = 0.35 * (1 - sstep(144.2, 144.6, c)) * (1 - 0.75 * sstep(142.75, 142.95, c) * (1 - sstep(143.7, 143.95, c))), h = z5Trk(B4_DV, c - 0.06), n = z5Trk(B4_DV, c);
    let x = lerp(kx, h.x, w), y = lerp(ky, h.y, w);
    if (c < 144.5) {
      const sx = 240 + (n.x - x) * z, sy = 135 + (n.y - y) * z, mx = 70, yT = LB + 84, yB = H - LB - 12;
      if (sx < mx) x -= (mx - sx) / z; else if (sx > W - mx) x += (sx - W + mx) / z;
      if (sy < yT) y -= (yT - sy) / z; else if (sy > yB) y += (sy - yB) / z;
    }
    return [x, y, z];
  }
  shot(139.6, 146.6, (lt, t) => {
    const c = b4Clk(t), [vx, vy, vz] = b4Cam(c), [px_, py_] = b4Cam(b4Clk(t - 1 / 30));
    B4V = { x: vx, y: vy, z: vz }; if (globalThis.B4DBG) console.log(t.toFixed(2), vx.toFixed(1), vy.toFixed(1), vz.toFixed(2), b4P(z5Trk(B4_DV, c).x, z5Trk(B4_DV, c).y).map((v) => v.toFixed(0)).join(","));
    const hz = 135 + (127.3 - vy) * vz * 0.45, s = B4_WS * vz, [CX, CY] = b4P(B4_WX, B4_WY), bob = Math.sin(t * 0.9) * s;
    const gH = B4_C.map((h) => c - h), g6 = c - 143.4, g7 = c - 145.0, gs7 = Math.max(0, g7 - B4_STOP);
    b4CombBg(t, B4V, hz);
    tintAll(T_DARK, lerp(0.36, 0.16, eio(b4Clip(139.6, 146.6, t))));
    // embers and ash hanging in the air behind him (far, slow)
    for (let k = 0; k < 26; k++) { const x = ((ih(k, 1, 2791) * 560 - vx * vz * 0.6 + Math.sin(t * 0.5 + k) * 6) % 560 + 560) % 560 - 40, y = ((ih(k, 2, 2791) * 300 - vy * vz * 0.6 - t * 14) % 300 + 300) % 300; if (y > LB && y < H - LB) P(x, y, k % 3 ? 121 : 103); }
    // the cloud sea answers every blow
    B4_C.forEach((h, k) => b4Deck(b4P(B4_BITE[k].x, 0)[0], hz, gH[k], 1, 2795 + k * 9));
    b4Deck(b4P(B4_FP[0], 0)[0], hz, g6, 1.4, 2799);
    // ---- him
    const shake = Math.max(...gH.map((g) => (g > 0 && g < 0.6 ? 0.55 * Math.exp(-g * 4) : 0)), g6 > 0 && g6 < 0.8 ? 0.7 * Math.exp(-g6 * 3) : 0, g7 > 0 ? 0.6 * Math.exp(-gs7 * 1.5) : 0);
    let ul = null;
    if (c < 140.0) { const [x, y] = b4K(B4_UL, c), r = b4Reach(0, x, y, 150); ul = { x: r[0], y: r[1], pose: b4Pose('fist', 'claw', b4Clip(139.72, 139.9, c)) }; }
    let [ux, uy] = b4K(B4_UR, c), urPose = b4Pose('fist', 'open', b4K(B4_URP, c)), urAng;
    const [ix, iy] = b4Idle(t, 1, 4); if (c < 143.0 || c > 143.8) { ux += ix; uy += iy; }
    if (c > 143.0 && c < 143.7) urAng = lerp(-0.2, PI, eio(b4Clip(143.0, 143.36, c))); else if (c > 144.75) urAng = -1.95;
    if (c > 143.55) urPose = b4Pose('fist', 'claw', b4Clip(143.55, 144.0, c) * (1 - 0.6 * b4Clip(144.3, 144.7, c)));
    // the final cut: he sees it coming (looks up, the arm comes up to ward it off), is struck rigid, the blow drives him down
    const look = eio(b4Clip(144.75, 145.0, c));
    if (c > 144.75) { const r = b4Reach(1, lerp(ux, 56, look) + b4Rx(g7, 30), lerp(uy, -16, look) + b4Rx(g7, -20), 138); ux = r[0]; uy = r[1]; urPose = g7 > B4_STOP ? b4Pose('claw', 'grab', 0.5 + 0.5 * Math.sin(gs7 * 9) * Math.exp(-gs7 * 2)) : b4Pose('fist', 'claw', look); }
    const run = g7 < B4_STOP ? 0 : eoc(b4Clip(0, 0.4, gs7)), fux = Math.cos(B4_FA), fuy = Math.sin(B4_FA);
    const wounds = g7 > 0 ? [[fux * -70, fuy * -70, fux * (-70 + 460 * run), fuy * (-70 + 460 * run), 2 + 2 * run]] : [];
    const maskCuts = (g7 > 0 ? [[-fux * 28, -fuy * 28, fux * 28, fuy * 28, Math.max(0.15, run * 1.4)]] : []).concat(B4_MCUT);
    const low = [0, 1].map((k) => { const [dx, dy] = b4Idle(t, k + 2, 5); return { x: (k ? 118 : -118) + dx, y: 150 + dy, cut: true }; });
    const so = { ul, ur: { x: ux, y: uy, pose: urPose, ang: urAng, heat: c > 143.0 && c < 143.6 ? 1 : undefined, front: c > 140.9 && c < 141.5 || c > 143.0 && c < 143.9 }, low, wounds, maskCuts,
      roar: g7 > 0 ? 0.9 : b4K(B4_ROAR, c), eyes: g7 > 0 ? 2.1 : 1.6 + 0.4 * Math.max(0, ...gH.map((g) => (g > 0 && g < 0.4 ? 1 - g / 0.4 : 0))), lean: b4K(B4_LEAN, c) + b4Rx(g7, -6),
      nod: b4K(B4_NOD, c) - 4 * look * (g7 > 0 ? 0 : 1) + b4Rx(g7, 8), tilt: b4K(B4_TILT, c) + b4Rx(g7, 0.06), shake };
    const R_ = b4SundC(CX + b4Shud(g7, t), CY, s, t, so);
    // the hero's light on his stone, where it is close
    const hp = z5Trk(B4_DV, c), [hx, hy] = b4P(hp.x, hp.y);
    glow(hx, hy, 70 * vz, T_WH, 0.2);
    // ---- what each cut takes
    if (gH[0] > 0) { const tg = gH[0], wr0 = b4K(B4_UL, 140.0), shA = [CX + (SH4[0][0] + R_.lean * 0.85) * s, CY + bob + SH4[0][1] * s], wr = [CX + wr0[0] * s, CY + Math.sin(140.0 * 0.9) * s + wr0[1] * s], el = b4Elbow(shA[0], shA[1], wr[0], wr[1], s, 0); b4Limb(shA[0], shA[1], el[0], el[1], wr[0], wr[1], s, tg, -210 * vz, -40 * vz, -4.5, 'claw', 0, t); }
    b4CrownShards(CX + R_.lean * s, CY - 4 * s, gH[1], 2721);
    for (const [k, j, vx_, vy_, spin] of [[2, 2, -200, 60, 4], [4, 3, 90, -230, 5]]) if (gH[k] > 0) { const T = [CX + (SH4[j][0] + R_.lean * 0.6) * s, CY + bob + SH4[j][1] * s], lw = B4_LOW[j - 2], wr = [CX + lw.x * s, CY + bob + lw.y * s], el = b4Elbow(T[0], T[1], wr[0], wr[1], s, j); b4Limb(T[0], T[1], el[0], el[1], null, null, s, gH[k], vx_ * vz, vy_ * vz, spin, null, j, t); }
    if (gH[3] > B4_HD) { const tg = gH[3] - B4_HD; b4MaskPart(CX, CY, s, t, Object.assign({ heat: 0.95, rage: 1, third: 1, eyes: 1.8, maskCuts: B4_MCUT }, so), -1, [-tg * 140 * vz, (tg * 60 + tg * tg * 260) * vz], -tg * 2.2, R_.lean); }
    // his last fist breaking on the point
    const fist = R_.hands[1], [fpx, fpy] = b4P(...B4_FP);
    if (g6 > 0 && fist) { rocks(fist[0] + 6 * vz, fist[1], g6, 30, 220 * vz, 3.5 * vz, [67, 66, 65, 64], 2761, 140, -0.2, 2.4); rocks(fpx, fpy, g6, 16, 160 * vz, 2 * vz, [103, 105, 107, 22], 2762, 100, 0.3, 2); }
    // the front of the cloud sea closes over his base as it rises above him
    const fb = eio(b4Clip(143.9, 144.6, c)); if (fb > 0) cloudBank(hz + 100 * vz + 160 * (1 - fb), 16 * vz, 60, 5053, vx * vz + t * 16, [17, 18, 19, 15], false);
    // ---- the hero
    // raised over him, the Worldblade regrowing: its light floods the sky
    const rg = sstep(143.95, 144.7, c) * (1 - sstep(145.05, 145.6, c));
    if (rg > 0) { z5GodRays(hx, hy, 10, t * 0.6, T_WARM, 0.32 * rg, 520); glow(hx, hy, 140, T_WH, 0.18 * rg); }
    const kb = z5Knock(g6 - B4_HD, 14, 9, 4), sqF = g6 > 0 && g6 < 0.3 ? 0.18 * (1 - g6 / 0.3) : 0;
    const fistLen = c > 143.0 && c < 143.85 ? (hand) => Math.max(10, (g6 > 0 ? Math.min(fist ? fist[0] - 4 : 1e9, fpx + 40 * vz * eio(b4Clip(0.2, 1, g6))) : fpx) - hand[0]) : null;
    const F = b4Dive(c, t, -kb, 0, { eyes: g6 > 0 && g6 < 0.3 ? 'wide' : 'glow', sq: sqF || (g7 > 0 && g7 < B4_STOP ? 0.12 : 0), rays: g6 > 0 && g6 < 0.5 ? 60 : g7 > 0 ? 50 : 70 * rg, over: 0.35 * rg, warp: 0.45 * rg, orbR: lerp(13, 20, rg) * B4_HS * vz, orbA: 1.2 + 0.8 * rg },
      fistLen, c > 144.6 ? 300 : undefined);
    // his fire lights it when it is close to him
    if (Math.hypot(F.x - CX, F.y - CY - 60 * s) < 190 * vz) glow(F.x, F.y, 26 * vz, T_EMBER, 0.16);
    // ---- the cuts landing
    B4_C.forEach((h, k) => { const g = gH[k]; if (g < 0) return; const B = B4_BITE[k], [x, y] = b4P(B.x, B.y); b4Cut(x, y, g, B.a, [2711, 2722, 2731, 2741, 2751][k], (k === 3 ? 1.15 : 0.95) * vz, k === 3 ? B4_HD : 0, true); if ((k === 0 || k === 3) && t - h >= 0 && t - h < 1 / 60) impactFrame(x, y, 0); });
    if (g6 >= 0) { megaHit(fpx, fpy, t - 143.4, 3, PI, [22, 85, 83], 2763); b4Inv(fpx, fpy, 18 * vz * Math.exp(-g6 * 2.5), 2764); }
    else if (c > 143.1) { const th = b4Clip(143.1, 143.4, c); glow(fpx, fpy, 30 * th, T_WH, 0.25 * th); }
    // the final cut: it strikes his crown and the split runs out both ways along the line; the two halves of the world part
    if (g7 >= 0) {
      const crown = [CX + R_.lean * s * 0.95, CY - 40 * s], [px, py] = b4OnBlade(F.hand, F.p.sw, crown);
      b4Cut(px, py, g7, F.p.sw, 2801, 1.6, B4_STOP, true); if (t - 145.0 < 1 / 60) impactFrame(px, py, 0);
      if (g7 > B4_STOP) { const amt = eoc(b4Clip(0, 0.5, gs7)), gap = 3 + 27 * eoc(b4Clip(0.05, 1.4, gs7)); worldSplit(CX, CY + 20, B4_FA, gap, amt, t); glow(CX, CY, 120, T_WH, 0.4 * Math.exp(-gs7 * 2)); shockRing(CX, CY + 40, 10 + gs7 * 600, 4 + gs7 * 80, 3, [22, 21, 20], 1 - gs7 / 0.8); shk(8 * Math.exp(-gs7 * 3)); }
    }
    // ---- foreground: wisps of cloud and cinders streaming past the lens, faster than anything (near)
    for (let k = 0; k < 6; k++) { const x = ((ih(k, 1, 2771) * 700 - vx * vz * 1.7 - t * 30) % 700 + 700) % 700 - 110, y = ((ih(k, 2, 2771) * 420 - vy * vz * 1.7) % 420 + 420) % 420 - 60; if (Math.abs(x - 240) < 170 && y > 60 && y < 220) continue; cloudPuff(x, y, 16 + ih(k, 3, 2771) * 14, [17, 18, 19, 20], 2772 + k); }
    for (let k = 0; k < 14; k++) { const x = ((ih(k, 4, 2771) * 560 - vx * vz * 2.2 + Math.sin(t + k) * 10) % 560 + 560) % 560 - 40, y = ((ih(k, 5, 2771) * 320 - vy * vz * 2.2 - t * 40) % 320 + 320) % 320; if (y > LB && y < H - LB) { rectF(x, y, 2, 2, k % 2 ? 104 : 121); P(x, y, k % 2 ? 106 : 123); } }
    // ---- the camera: it banks into its turns, and is kicked along every blow
    const dvx = (vx - px_) * 30, roll = clamp(-dvx * 0.00006, -0.045, 0.045);
    const [kz, kr, kx, ky] = kick(c, B4_C.map((h, k) => [h, k === 3 ? 2.4 : 1.5, B4_BITE[k].a]).concat([[143.4, 3, 0], [145.0, 2], [145.0 + B4_STOP, 4, PI / 2]]));
    z5Cam(1.0 + kz, kr + roll, 240 - kx, 135 - ky, 240, 135);
  });

  /* ================================================================ V.18 — he comes apart; "...brother..." (146.6–150.0) */
  // he comes apart along the cut, the halves sliding, fire dripping from the faces of it; his last hand reaches up into the
  // light, trembling, for something that is not there, and slowly closes on nothing
  shot(146.6, 150.0, (lt, t) => {
    const u = lt / 3.4, spl = eio(b4Clip(0.1, 3.4, lt)) * 0.75;
    b4WorldWide(t, 0.25);
    worldSplit(240, 140, B4_FA, 34 + 10 * u, 1, t);
    const CX = 240, CY = 118, s = 1.9;
    const eyes = lerp(1.6, 0.25, eio(b4Clip(1.0, 3.2, lt))), third = 1 - eio(b4Clip(1.9, 3.0, lt));
    const reach = eio(b4Clip(0.3, 2.0, lt)), close = eio(b4Clip(2.3, 3.3, lt)), tr = (1 + 2 * reach) * z5Sh(t, 5);
    const [ix, iy] = b4Idle(t, 1, 3), ur = b4Reach(1, lerp(140, 30, reach) + ix + tr, lerp(124, -50, reach) + iy + tr * 0.5, 136);
    b4SundC(CX, CY, s, t, { ur: { x: ur[0], y: ur[1], pose: b4Pose(b4Pose('claw', 'open', reach), 'grab', close), ang: lerp(-0.4, -1.75, reach), heat: lerp(0.8, 0.35, u) }, split: spl, splitA: B4_FA, splitX: 0, splitY: 0, eyes, third, roar: t > 147.0 && t < 148.2 ? 0.25 + 0.15 * Math.sin(t * 9) : 0.1, heat: lerp(0.95, 0.4, u), rage: lerp(1, 0.2, u), nod: 4 * u - 3 * reach * (1 - u), tilt: -0.08 * reach + 0.03 * Math.sin(t * 0.7) });
    // fire dripping off both faces of the cut
    const ux = Math.cos(B4_FA), uy = Math.sin(B4_FA), sux = ux, suy = uy;
    for (const sd of [-1, 1]) {
      const ox = (-suy * sd * spl * 40 + sux * sd * spl * 10) * s, oy = (sux * sd * spl * 40 + suy * sd * spl * 10 + spl * spl * 30) * s;
      for (let k = 0; k < 9; k++) {
        const along = (-40 + k * 26 + ih(k, sd + 2, 2812) * 10) * s, f = frac(t * (0.6 + ih(k, sd + 4, 2812) * 0.5) + ih(k, sd + 6, 2812));
        const x = CX + ux * along + ox + uy * sd * 2, y = CY + uy * along + oy + f * f * 60;
        if (y < LB || y > H - LB) continue;
        rectF(x, y, 1 + (f < 0.3 ? 1 : 0), 2 + fl(3 * (1 - f)), f < 0.4 ? 105 : 103);
      }
    }
    // light pouring from the cut, embers and ash lifting off him already
    for (let k = 0; k < 50; k++) { const f = frac(ih(k, 1, 2811) + t * 0.35), x = CX + (ih(k, 2, 2811) - 0.5) * 300 * (0.3 + f), y = CY + 150 - f * 260 + ih(k, 3, 2811) * 40; if (bay(fl(x), fl(y)) < 1 - f) rectF(x, y, 2, 2, k % 3 ? 121 : 104); }
    shk(0.6 + 1.5 * u);
    z5Cam(1.04 + 0.08 * eio(u), 0.004 * z5N(t, 1), 240, 130, 240, 135);
  });
  CAPS.push([147.0, 149.6, 's', 'SUNDERER', '...BROTHER...']);

  /* ================================================================ VI.1 — he bursts into ash (150.0–153.0) */
  shot(150.0, 153.0, (lt, t) => {
    const g = lt;
    b4WorldWide(t, 0.25 + 0.25 * eio(b4Clip(0.4, 3, lt)));
    worldSplit(B4_FX, B4_FY + 20, B4_FA, 30 * (1 - eio(b4Clip(0.3, 3, lt))), 1, t);
    // the last of him: a white silhouette for an instant, then gone into shards and ash
    if (g < 0.12) { b4SundC(B4_FX, B4_FY, B4_FS, t, { ur: { x: 140, y: 140, pose: 'open' }, split: 0.75, splitA: B4_FA, eyes: 0.2, third: 0, heat: 0.4 }); for (let y = LB; y < H - LB; y++) for (let x = 120; x < 400; x++) { const i = y * W + x; if (BUF[i] >= 96 && BUF[i] <= 107 || (BUF[i] >= 64 && BUF[i] <= 69)) BUF[i] = 22; } }
    rocks(B4_FX, B4_FY + 40, g, 40, 220, 5, [96, 98, 100, 105], 2821, 40);
    rocks(B4_FX, B4_FY, g, 24, 300, 3, [103, 105, 107, 22], 2822, 20);
    rocks(B4_FX, B4_FY - 10, g, 14, 160, 4, [67, 66, 65, 64], 2823, 60);
    // a cloud of ash and cinder where he stood, swelling, thinning
    { const R = 30 + 150 * eoc(g / 2.2), th = sstep(0.4, 3, g); for (let y = Math.max(LB, fl(B4_FY - R)); y < Math.min(H - LB, B4_FY + 40 + R * 0.6); y++) for (let x = Math.max(0, fl(B4_FX - R * 1.3)); x < Math.min(W, B4_FX + R * 1.3); x++) { const dx = (x - B4_FX) / (R * 1.3), dy = (y - B4_FY - 20) / R, d = Math.sqrt(dx * dx + dy * dy) + (vn(x + t * 10, y - t * 6, 9, 2825) - 0.5) * 0.5; if (d > 1 || bay(x, y) < th + d * 0.5) continue; BUF[y * W + x] = d < 0.25 && g < 0.45 ? 107 : ASH[clamp(fl((1 - d) * 2.4 + vn(x, y, 5, 2826) * 1.2), 0, 3)]; } }
    // ash: a cloud of it thrown out, slowing, then drifting down
    for (let k = 0; k < 260; k++) {
      const a = ih(k, 1, 2824) * TAU, v = 30 + ih(k, 2, 2824) * 190, d = v * (1 - Math.exp(-g * 2.2)) / 2.2;
      const x = B4_FX + Math.cos(a) * d * 1.3 + Math.sin(t * 0.7 + k) * 3, y = B4_FY + 20 + Math.sin(a) * d * 0.8 + g * g * 4 + g * 6;
      if (ih(k, 3, 2824) < g * 0.12) continue;
      rectF(x, y, 1 + (k % 3 === 0 ? 1 : 0), 1 + (k % 3 === 0 ? 1 : 0), g < 0.5 && k % 4 === 0 ? 105 : ASH[k % 4]);
    }
    // the shockwave of light across the sky and the cloud sea
    shockRing(B4_FX, B4_FY, 10 + g * 520, 10 + g * 520, 5, [22, 16, 15], 1 - g / 1.2);
    shockRing(B4_FX, 190, 10 + g * 700, 4 + g * 70, 4, [22, 21, 20], 1 - g / 1.6);
    glow(B4_FX, B4_FY, 60 + 260 * eoc(g / 1.5), T_WH, 0.6 * Math.exp(-g * 1.4));
    if (g < 0.03) impactFrame(B4_FX, B4_FY, 0);
    shk(8 * Math.exp(-g * 2.5));
    // the hero above, alone, the blade still down
    const fall = eio(b4Clip(1.6, 3, lt));
    const hero = b4Inf(222, 62 + z5Knock(g, -8, 6, 3) + 6 * fall, 1.3, t, { sw: B4_FA - 0.4 * fall, spread: 1 - 0.3 * fall, flap: 0.22, wt: t * 2, orbR: 22, orbA: 2 - 0.6 * fall, auraR: 5, noLife: true, mouth: 0, eyes: lt > 1.6 ? 'narrow' : 'glow', warp: 0.2 });
    bigBlade(hero.hand[0], hero.hand[1], B4_FA - 0.4 * fall, lerp(900, 180, fall), 4, t, { form: 'infinite', flare: 0.8 });
    z5Cam(1.0 + kick(lt, [[0, 3]])[0] - 0.04 * eio(lt / 3), 0, 250, 122, 240, 135);
  });

  /* ================================================================ VI.2 — what it cost (153.0–158.0) */
  // silence and falling ash; the Infinite form drains out of it, the Worldblade shrinks back to a sword and crumbles to
  // its hilt, and it falls
  const B4_ASHF = (t, n, seed, sp) => { for (let k = 0; k < n; k++) { const x = ((ih(k, 1, seed) * 520 + Math.sin(t * 0.5 + k) * 12 - t * 4) % 520 + 520) % 520 - 20, y = LB + ((ih(k, 2, seed) * 230 + t * (8 + ih(k, 3, seed) * 10) * sp) % 230), big = k % 3 === 0; rectF(x, y, big ? 2 : 1, big ? 2 : 1, big ? 123 : ASH[1 + (k * 7) % 3]); if (big) P(x + 1, y + 1, 121); } };
  shot(153.0, 158.0, (lt, t) => {
    const drain = eio(b4Clip(0.2, 2.2, lt)), coral = lt > 1.7, fall = eic(b4Clip(3.0, 5.0, lt));
    // an ashen sky with no sun in it: a dim band of light low down where the dawn should be, the cloud sea in layers below,
    // pale shafts through the ash, the ash itself falling at three depths
    const hz = 196 - 60 * fall;
    gradient(LB, hz + 6, [1, 96, 120, 121, 17, 18]);
    glow(150, hz, 220, T_WARM, 0.12);
    z5GodRays(70, LB - 10, 6, t * 0.08, T_WH, 0.1, 360);
    cloudBank(hz + 4, 12, 90, 5061, t * 2, [120, 121, 17, 18], false);
    cloudBank(hz + 22, 22, 70, 5051, t * 4, [17, 120, 121, 18], false);
    cloudBank(hz + 50, 30, 55, 5052, t * 7, [96, 120, 121, 17], false);
    tintAll(T_DARK, 0.3);
    for (let k = 0; k < 10; k++) { const f = frac(ih(k, 1, 2835) + t * (0.05 + ih(k, 2, 2835) * 0.04)), x = ((ih(k, 3, 2835) * 520 + Math.sin(t * 0.6 + k) * 16 - t * 9) % 520 + 520) % 520 - 20, y = LB + f * (H - 2 * LB); rectF(x, y, 3, 2, 121); P(x + 1, y, 123); }
    B4_ASHF(t, 140, 2831, 1);
    const HX = 236 + z5N(t * 0.4, 1) * 2 + 8 * fall, HY = 118 + 30 * fall + Math.sin(t * 1.2) * 2 * (1 - fall), S = 3.2;
    const ang = 0.05 + 1.2 * fall * fall + Math.sin(t * 0.8) * 0.03;
    // the blade: a Worldblade's worth of light pulled back into the hilt; then just a sword; then it crumbles
    const bl = lt < 1.4 ? lerp(320, 30, eio(lt / 1.4)) : 30, crumble = eio(b4Clip(2.2, 3.2, lt));
    const swl = lt < 1.4 ? 9 : lerp(30, 8, crumble), sw = lerp(-0.5, 0.6, drain) + fall * 0.8;
    if (!coral) {
      const DF = ['infinite', 'lastlight', 'nova', 'zenith', 'storm', undefined], fi = clamp(fl(b4Clip(0.35, 1.7, lt) * 6), 0, 5);
      const r = b4Inf(HX, HY, S, t, { form: DF[fi], sw, ang, spread: 1 - drain, flap: 0.12, wt: t * 1.2, orbR: 60 * (1 - drain * 0.5), orbA: lerp(2, 0.2, drain), auraR: lerp(9, 2, drain), noLife: true, eyes: drain > 0.7 ? 'narrow' : 'glow', warp: 0.2 * (1 - drain), cracks: 0.3 + 0.5 * drain });
      if (lt < 1.4) bigBlade(r.hand[0], r.hand[1], sw + ang, bl * S / 3.2 * 3, 3 * (1 - drain * 0.5), t, { form: 'infinite', flare: 0.5 * (1 - drain), grow: 0.5 });
      if (lt > 1.4) for (let k = 0; k < 6; k++) { const g = lt - 1.4 - k * 0.04; if (g > 0 && g < 0.3) sparkle(r.hand[0] + Math.cos(sw + ang) * 30 * S * k / 6, r.hand[1] + Math.sin(sw + ang) * 30 * S * k / 6, 3, 22, PRISM[k]); }
    } else {
      const r = b4Hero({ eyes: lt < 2.6 ? 'narrow' : 'closed', sword: sw, cracks: 0.85, legs: z5Limp(t, 1.4), sq: 0.05 }, HX, HY, S, ang, false, { still: true }, swl, crumble > 0.05, crumble < 0.5 ? z5Sw(t * 0.2) : null);
      b4TintSprite(T_DARK, 0.25 + 0.2 * fall);
      if (lt < 1.95) { glow(HX, HY, 60, T_WH, 0.5 * (1 - (lt - 1.7) / 0.25)); for (let k = 0; k < 16; k++) { const a = ih(k, 1, 2832) * TAU, d = (lt - 1.7) * 160; P(HX + Math.cos(a) * d, HY + Math.sin(a) * d * 0.7, PRISM[k % 7]); } }
      // the blade crumbling: flakes of it falling away
      if (crumble > 0 && crumble < 1) rocks(r.tip[0], r.tip[1], (lt - 2.2) % 0.5, 6, 30, 1.6, [93, 94, 95, 34], 2833 + fl((lt - 2.2) / 0.5), 120, PI / 2, 2);
      // its four sparks, nearly out, hanging round it
      for (let k = 0; k < 4; k++) { const a = t * 0.8 + k * TAU / 4; if (ih(k, fl(t * 8), 2834) < 0.6) b4Ember(HX + Math.cos(a) * 34, HY + Math.sin(a) * 10, k, 0.2, t); }
    }
    z5Cam(1.1 + 0.08 * eio(lt / 5), 0.004 * z5N(t * 0.5, 2), HX, lerp(HY, 140, fall * 0.6), 240, 135);
  });

  /* ================================================================ VI.3 — the sun is reborn (158.0–162.0) */
  shot(158.0, 162.0, (lt, t) => {
    const born = eio(b4Clip(0, 2.6, lt)), SX = 330, SY = lerp(196, 168, eoc(b4Clip(0.2, 4, lt)));
    // dawn returns: from grey and ash to the morning
    z5Mix(born, () => { gradient(LB, 196, [17, 120, 121, 18, 19, 18]); cloudBank(204, 22, 80, 5051, t * 6, [17, 18, 19, 20], false); cloudBank(240, 30, 60, 5052, t * 9, [17, 18, 19, 20], false); }, () => { z5Dawn(t, 196, t * 8, SX, SY); });
    // the light gathers into a point, and the sun opens out of it
    const pt = eoc(b4Clip(0, 0.8, lt));
    if (born < 1) { glow(SX, SY, 30 + 120 * born, T_WARM, 0.7 * pt); sparkle(SX, SY, 4 + 16 * pt * (1 - born), 22, 16); }
    if (born > 0.3) z5GodRays(SX, SY, 7, t * 0.15, T_WARM, 0.5 * born, 400);
    // ash still coming down, thinning
    B4_ASHF(t, fl(70 * (1 - born * 0.7)), 2841, 1);
    // the hero far off, falling, slowing; the dawn reaches it and it hangs there over the cloud
    const sl = eoc(b4Clip(0, 3.4, lt)), HX = 168 + 10 * sl, HY = lerp(60, 150, sl) + Math.sin(t * 1.2) * 2 * sl;
    b4Hero({ eyes: 'closed', sword: 0.9 - 0.5 * sl, cracks: 0.85, legs: z5Limp(t, 1.2) }, HX, HY, 1.4, lerp(1.2, 0.25, sl), false, { still: true }, 8, true);
    b4TintSprite(T_DARK, 0.4 - 0.3 * born);
    z5Cam(1.0 + 0.03 * born, 0, 240, 135, 240, 135);
  });

  /* ================================================================ VI.4 — still here (162.0–171.0) */
  // it floats limp over the healed cloud sea: never still — it drifts on the air, turns slowly, breathes (shallow, then a
  // longer breath when it wakes), its limbs and the broken sword hang and sway; the four orbs come back as sparks one by
  // one, circling it on a tilted ring (behind it and in front), trailing light, twinkling, shedding motes, and drawing in
  // closer and brighter as it wakes and speaks
  const B4_SPARK = [163.0, 163.7, 164.4, 165.0];
  shot(162.0, 171.0, (lt, t) => {
    const SX = 352, SY = 170;
    z5Dawn(t, 192, t * 6, SX, SY);
    z5GodRays(SX, SY, 7, t * 0.15, T_WARM, 0.45, 380);
    B4_ASHF(t, 16, 2851, 0.6);
    const wake = clamp((t - 165.5) / 1.5, 0, 1), speak = t > 166.0 && t < 169.4 ? 1 : 0;
    // breath: about one every 4 s, deeper once it is awake
    const breath = Math.sin(t * 1.55 - 0.6) * (0.6 + 0.4 * wake);
    const HX = 214 + z5N(t * 0.21, 1) * 7 + 3 * Math.sin(t * 0.37), HY = 132 + Math.sin(t * 0.9) * 3.2 + z5N(t * 0.3, 2) * 2 - breath * 0.8, S = 3.0;
    const rot = 0.16 + Math.sin(t * 0.45) * 0.06 + z5N(t * 0.25, 3) * 0.03 - 0.06 * eio(wake);
    const eyes = t < 165.5 ? 'closed' : t < 165.62 ? 'narrow' : t < 165.7 ? 'closed' : t > 169.6 && t < 169.72 ? 'closed' : 'narrow';
    // the four sparks: where each is on its ring at time tt (and whether it is in front of it)
    const ringR = lerp(72, 60, wake), sp = (k, tt) => { const a = tt * 0.75 + k * TAU / 4, z = Math.sin(a); return [HX + Math.cos(a) * ringR, HY - 12 + z * ringR * 0.36 + Math.sin(tt * 2 + k) * 3, z]; };
    const drawSpark = (k, front) => {
      const st = B4_SPARK[k]; if (t < st) return;
      const g = t - st, flick = g < 0.6 ? ih(k, fl(t * 14), 2852) < 0.55 : true;
      const [x, y, z] = sp(k, t); if ((z > 0) !== front || !flick) return;
      const lvl = Math.min(1, g / 1.5) * (0.6 + 0.25 * wake + 0.25 * speak * (0.5 + 0.5 * Math.sin(t * 5 + k))), dz = 0.75 + 0.25 * z;
      // its trail along the ring, dissolving
      for (let q = 1; q < 9; q++) { const [px, py] = sp(k, t - q * 0.05); if (bay(fl(px), fl(py)) < (1 - q / 9) * lvl) P(px, py, q < 3 ? ORB[k][2] : ORB[k][1]); }
      const R = (2.2 + 1.6 * lvl) * dz + 0.3 * Math.sin(t * 3 + k);
      glow(x, y, R * 7, EL_T[k], 0.4 + 0.3 * lvl); discF(x, y, R + 1, 63); discF(x, y, R, ORB[k][1]); discF(x - R * 0.3, y - R * 0.3, R * 0.55, ORB[k][2]); P(x - R * 0.4, y - R * 0.4, 22);
      if (g < 0.25) sparkle(x, y, 5 * (1 - g / 0.25), 22, ORB[k][2]);
      else if (ih(k, fl(t * 2.5), 2855) < 0.45) { const tw = frac(t * 2.5); sparkle(x, y, 6 * Math.sin(tw * PI) * lvl, 22, ORB[k][2]); }
      // motes shed as it goes, sinking and going out
      for (let q = 0; q < 4; q++) { const f = frac(t * 0.8 + q * 0.25 + k * 0.13), [mx, my] = sp(k, t - f * 1.2); if (bay(fl(mx), fl(my + f * 16)) < (1 - f) * lvl * 0.8) P(mx + Math.sin(f * 7 + q) * 2, my + f * 16, ORB[k][f < 0.5 ? 2 : 1]); }
    };
    for (let k = 0; k < 4; k++) drawSpark(k, false);
    glow(HX, HY, 50 + 8 * breath, T_WARM, 0.15 + 0.05 * breath + 0.06 * wake);
    b4Hero({ eyes, mouth: speak && fl(t * 6) % 3 === 0 ? 1 : 0, sword: 0.55 + Math.sin(t * 0.6) * 0.12 + z5N(t * 0.4, 5) * 0.05, cracks: 0.85, legs: z5Limp(t * 0.8, 1.1), sq: 0.04 + 0.035 * breath }, HX, HY, S, rot, false, { still: true }, 8, true);
    b4TintSprite(T_DARK, 0.18 - 0.05 * wake);
    // the dawn on it: its sun-side edge lit
    z5Rim(1, -0.4, 60, 1);
    for (let k = 0; k < 4; k++) drawSpark(k, true);
    z5Cam(1.05 + 0.12 * eio(b4Clip(162, 167, t)) - 0.1 * eio(b4Clip(168, 171, t)), 0.006 * z5N(t * 0.4, 3), lerp(240, HX, eio(b4Clip(162, 166, t))) + z5N(t * 0.2, 6) * 4, lerp(135, HY, eio(b4Clip(162, 166, t))) + z5N(t * 0.23, 7) * 3, 240, 135);
    tintAll(T_DARK, sstep(169.9, 170.95, t));
  });
  CAPS.push([166.0, 169.4, 's', 'HERO', '...STILL... HERE.']);

  /* ================================================================ VI.5 — the title (171.0–180.0) */
  shot(171.0, 180.0, (lt, t) => {
    rectF(0, 0, W, H, 63);
    stars(t, H, 120, 5331);
    const s1 = 'FABLE 5.5', sc = lt < 0.08 ? 7 : 6, w = textWidth(s1, sc), x0 = 240 - w / 2;
    text(s1, x0, 70 - (sc - 6) * 3, (i, j, k) => (j < 2 ? 22 : EL[k % 4][j < 5 ? 2 : 1]), sc, 0);
    if (lt < 0.1) flashWhite(0.8 * (1 - lt / 0.1));
    if (lt > 0.7) { const s2 = 'PART IV · THE SUNDERER'; text(s2, 240 - textWidth(s2, 2) / 2, 132, 59, 2, 0, fl((lt - 0.7) * 30)); }
    if (lt > 1.6) { const s3 = 'TO BE CONTINUED'; text(s3, 240 - textWidth(s3, 1) / 2, 162, 19, 1, undefined, fl((lt - 1.6) * 30)); }
    b4Hero({ eyes: lt > 3 && lt < 3.12 ? 'closed' : 'normal', sword: -1.0, cracks: 0.35 }, 240, 210, 1.4, 0, false, {}, 8, true, z5Sw(t * 0.3));
  });
  }
