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
    gradient(LB, H - LB, [0, 0, 1, 96, 96, 97]);
    if (slitY !== null) {
      glow(250, slitY, 120, T_EMBER, 0.18);
      for (let x = 150; x < 350; x++) { const w = (1 - Math.pow(Math.abs(x - 250) / 100, 2)) * 1.6, yy = slitY + (vn(x, 0, 9, 2111) - 0.5) * 6; for (let q = -fl(w) - 1; q <= w + 1; q++) P(x, yy + q, Math.abs(q) < w * 0.5 ? 105 : Math.abs(q) <= w ? 103 : 101); }
    }
    // dust hanging in the dark
    for (let k = 0; k < 40; k++) { const x = ((ih(k, 1, 2112) * 520 - (ox || 0) * (0.3 + ih(k, 3, 2112)) + t * 3) % 520 + 520) % 520 - 20, y = LB + ih(k, 2, 2112) * (gy - LB) + Math.sin(t * 0.4 + k) * 3; P(x, y, k % 3 ? 97 : 98); }
    // the floor: broken rock, its lip lit faintly from above
    ridge(gy, 14, 40, 2113, 96, 98, ox || 0);
    ridge(gy + 18, 10, 26, 2114, 96, 97, (ox || 0) * 1.4);
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
    const arms = o.arms || [{ x: -150, y: 110, pose: 'fist' }, { x: 150, y: 110, pose: 'fist' }];
    return sunderer(cx, cy, s, t, Object.assign({ heat: 0.85, rage: 0.8, third: 1, eyes: 1.2, crown: 1, maskCuts: B4_MCUT }, o, { arms: [arms[0], arms[1], o.low === false ? null : B4_LOW[0], o.low === false ? null : B4_LOW[1]] }));
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
      if (sy < bot + 40) { b4Sund(396, sy, 1.25, t, { eyes: 1.4, arms: [{ x: -150, y: 120, pose: 'fist' }, { x: 140, y: 100, pose: 'open' }] }); cloudBank(hz2 + 40, 24, 50, 5053, t * 22, [17, 18, 19, 15], false); }
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
    const sunX = lerp(300, 360, pull), sunY = lerp(52, 64, pull), sunR = lerp(14, 10, pull);
    glow(sunX, sunY, sunR * (7 + space * 6), T_WARM, 0.55); discF(sunX, sunY, sunR * 1.25, 15); discF(sunX, sunY, sunR, 16); discF(sunX - 2, sunY - 2, sunR * 0.45, 22);
    if (space > 0.3) for (let k = 0; k < 6; k++) { const a = k * PI / 3 + t * 0.1; lineF(sunX, sunY, sunX + Math.cos(a) * sunR * 4 * space, sunY + Math.sin(a) * sunR * 4 * space, (x, y, u) => { if (bay(x, y) < 0.8 - u) P(x, y, 16); }); }
    // the Sunderer, a mountain standing in the cloud sea (he shrinks more slowly than everything: he is that big)
    const Zs = Math.pow(Z, 0.35), ss = 1.25 * Zs;
    b4Sund(AX + 290 * Zs, AY + lerp(10, -50, Zs), ss, t, { eyes: 1.4, arms: [{ x: -104, y: 150, pose: 'fist' }, { x: 140, y: 96, pose: 'open' }] });
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
  // low, under him: the arm goes up, the hand opens over the sun
  shot(121.5, 122.0, (lt, t) => {
    const u = eic(lt / 0.5), sunX = 176, sunY = 64;
    b4Sky(t, H - LB, sunX, sunY, 24, 1);
    cloudBank(236, 26, 70, 5051, t * 10, CLOUD_SUN, false);
    // the Worldblade's light still runs across the sky behind him
    bigBlade(-20, 210, -0.32, 900, 3, t, { form: 'infinite', flare: 0.7 });
    const wx = lerp(-120, -96, u), wy = lerp(40, -104, u);
    b4Sund(300, 120 + 4 * u, 1.45, t, { eyes: 1.5, rage: 0.9, tilt: -0.12 * u, arms: [{ x: wx, y: wy, pose: 'open', ang: lerp(-1.2, -2.2, u) }, { x: 150, y: 110, pose: 'fist' }] });
    z5Cam(1.04 + 0.04 * u, -0.02 * u, 260, 120, 240, 135);
  });

  /* ================================================================ V.8 — he tears the sun out of the sky (122.0–124.6) */
  // his wrist in screen space (as sunderer() places it), so what he holds can be drawn in his hand and the hand redrawn
  // over it
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
  shot(122.0, 124.6, (lt, t) => {
    const CX = 300, CY = 168, s = 1.3;
    // the left hand: up, closed round the sun (the hit at 0), torn down in an arc to in front of him; then both hands
    // clasp it there and crush it
    const pull = eio(b4Clip(0.1, 1.0, lt)), cr = eio(b4Clip(0.95, 1.35, lt));
    const PL = (p) => [lerp(-92, -40, p) - Math.sin(p * PI) * 34, lerp(-78, 6, p) - Math.sin(p * PI) * 12, lerp(-2.1, -0.4, p)];
    const shrink = eio(b4Clip(1.35, 2.4, lt)), r = lerp(24, 19, shrink), amt = eio(b4Clip(1.3, 2.35, lt));
    const sq = z5Knocks(lt, [1.55, 1.9, 2.15], 1, 14, 5);
    // palms (local) → wrists
    const rev = eio(b4Clip(2.2, 2.55, lt)), gap = r / s + 5 + 20 * rev;
    const [plx, ply, pa] = PL(pull), palmL = [lerp(plx + Math.cos(pa) * 13, -gap - sq * 1.5, cr), lerp(ply + Math.sin(pa) * 13, 8, cr)], aL = lerp(pa, -0.05 + rev * 0.5, cr);
    const palmR = [lerp(150, gap + sq * 1.5, cr), lerp(100, 8, cr)], aR = lerp(-1.4, PI + 0.05 - rev * 0.5, cr);
    const wL = [palmL[0] - Math.cos(aL) * 13, palmL[1] - Math.sin(aL) * 13], wR = [palmR[0] - Math.cos(aR) * 13, palmR[1] - Math.sin(aR) * 13];
    const [SX, SY] = b4Wr(CX, CY, s, t, cr > 0 ? lerp(palmL[0], 0, cr) : palmL[0], palmL[1]);
    const [sx0, sy0] = (() => { const [x0, y0, a0] = PL(0); return b4Wr(CX, CY, s, 122.0, x0 + Math.cos(a0) * 13, y0 + Math.sin(a0) * 13); })();
    const dark = eio(b4Clip(0.15, 2.3, lt));
    b4Sky(t, H - LB, 0, 0, 0, 0);
    cloudBank(232, 26, 70, 5051, t * 10, CLOUD_SUN, false);
    cloudBank(250, 30, 50, 5052, t * 14, [17, 18, 19, 15], false);
    // the hole the sun leaves: torn sky, burning at its edge, night inside
    const hole = eoc(b4Clip(0.1, 0.9, lt));
    if (hole > 0) for (let y = Math.max(LB, fl(sy0 - 44)); y < sy0 + 44; y++) for (let x = fl(sx0 - 50); x < sx0 + 50; x++) { const d = Math.hypot(x - sx0, (y - sy0) * 1.1) / (28 * hole) + (vn(x, y, 5, 2411) - 0.5) * 0.5; if (d < 1) P(x, y, d > 0.85 ? 104 : d > 0.72 ? 102 : 0); }
    bigBlade(-20, 236, -0.3, 900, 3, t, { form: 'infinite', flare: 0.7 });
    glow(SX, SY, 200, T_WARM, 0.35 * (1 - amt));
    tintAll(T_DARK, 0.72 * dark);
    const pre = lt < 0.05;
    const arms = [{ x: wL[0], y: wL[1], pose: pre || rev > 0.3 ? 'open' : 'grab', ang: aL, front: true }, { x: wR[0], y: wR[1], pose: cr > 0.6 && rev < 0.3 ? 'grab' : 'open', ang: aR, front: cr > 0.3 }];
    b4Sund(CX, CY, s, t, { eyes: 1.4 + 0.4 * dark, rage: 1, roar: 0.3 * eio(b4Clip(1.4, 2.0, lt)), tilt: -0.1 * (1 - pull), nod: 4 * pull, arms, heat: 0.9 });
    // dragged light, ripped out with it
    if (lt > 0.1 && lt < 1.3) for (let k = 1; k < 14; k++) { const p2 = eio(b4Clip(0.1, 1.0, lt - k * 0.025)), [qx, qy, qa] = PL(p2), [ax, ay] = b4Wr(CX, CY, s, t, qx + Math.cos(qa) * 13, qy + Math.sin(qa) * 13), rr = r * (1 - k * 0.06); for (let yy = -rr; yy <= rr; yy++) for (let xx = -rr; xx <= rr; xx++) if (xx * xx + yy * yy < rr * rr && bay(fl(ax + xx), fl(ay + yy)) < 0.9 - k * 0.06) P(ax + xx, ay + yy, k < 4 ? 16 : k < 8 ? 15 : 14); }
    b4DyingSun(SX, SY, r, t, amt);
    // jets of light squeezed out between the fingers as he crushes it, dying as it goes black
    if (amt < 0.95 && lt > 0.02) for (let k = 0; k < 5; k++) { const a = -PI / 2 + (k - 2) * 0.5 + (cr > 0.5 ? 0 : aL + PI / 2) + Math.sin(t * 7 + k) * 0.08 + (k > 2 && cr > 0.5 ? PI : 0); z5Ray(SX, SY, a, (40 + 34 * ih(k, fl(t * 15), 2412)) * (1 - amt), 3, 22, 16, 0.9 * (1 - amt)); }
    // the hands over it
    { const [x1, y1] = b4Wr(CX, CY, s, t, wL[0], wL[1]); sGauntlet(x1, y1, s, aL, arms[0].pose, 0.9, t); }
    if (cr > 0.3) { const [x2, y2] = b4Wr(CX, CY, s, t, wR[0], wR[1]); sGauntlet(x2, y2, s, aR, arms[1].pose, 0.9, t); }
    // the light sucked in toward it as it collapses
    if (amt > 0.2) { for (let k = 0; k < 40; k++) { const a = ih(k, 1, 2413) * TAU, u = frac(ih(k, 2, 2413) - t * 1.4), R = 24 + u * 160; if (bay(k, fl(t * 30)) < amt) lineP(SX + Math.cos(a) * R, SY + Math.sin(a) * R, SX + Math.cos(a) * (R + 10 * u), SY + Math.sin(a) * (R + 10 * u), u < 0.4 ? 15 : 14); } }
    if (lt < 0.03) impactFrame(SX, SY, 1);
    if (lt < 0.5) { shockRing(SX, SY, 6 + lt * 300, 6 + lt * 300, 3, [22, 16, 15], 1 - lt / 0.5); shk(6 * (1 - lt / 0.5)); }
    for (const h of [1.55, 1.9, 2.15]) { const g = lt - h; if (g > 0 && g < 0.3) { shk(4 * (1 - g / 0.3)); shockRing(SX, SY, r + g * 200, r + g * 200, 2, [105, 103, 101], 1 - g / 0.3); } }
    const [kz, kr] = kick(lt, [[0, 2], [1.55, 0.8], [2.15, 1]]);
    const fo = eio(b4Clip(0.5, 1.6, lt));
    z5Cam(1.0 + 0.3 * eio(b4Clip(1.2, 2.6, lt)) + kz, kr - 0.03 * (1 - pull), lerp(sx0 + 40, SX, fo), lerp(sy0 + 40, SY - 10, fo), 240, 135);
  });

  /* ================================================================ V.9 — then we both end (124.6–126.2) */
  shot(124.6, 126.2, (lt, t) => {
    const CX = 240, CY = 178, s = 1.15;
    b4Sky(t, H - LB, 0, 0, 0, 0);
    cloudBank(222, 26, 70, 5051, t * 10, CLOUD_SUN, false);
    tintAll(T_DARK, 0.8);
    stars(t, 120, 30, 2421);
    // the Worldblade, far off, the only light left in the sky
    bigBlade(-40, 120, -0.18, 900, 2, t, { form: 'infinite', flare: 0.6 });
    const lift = eio(b4Clip(1.0, 1.6, lt)), talk = t > 125.0 && t < 126.0 ? Math.max(0, Math.sin(t * 17)) * 0.35 : 0;
    const arms = [{ x: -40, y: -70 - 14 * lift, pose: 'grab', ang: -0.9, front: true }, { x: 40, y: -70 - 14 * lift, pose: 'grab', ang: PI + 0.9, front: true }];
    const so = { eyes: 1.8, rage: 1, roar: talk, nod: -3 * lift, arms, heat: 0.95 };
    const [ax, ay] = b4Wr(CX, CY, s, t, -40, -70 - 14 * lift), [bx, by] = b4Wr(CX, CY, s, t, 40, -70 - 14 * lift);
    const SX = (ax + bx) / 2, SY = ay - 22 * s, BR = 28 + 4 * eio(lt / 1.6) + Math.sin(t * 6) * 0.8;
    // what light there is left streams into it
    for (let k = 0; k < 50; k++) { const a = ih(k, 1, 2422) * TAU, u = frac(ih(k, 2, 2422) - t * 0.9), R = BR + 6 + u * 220; lineP(SX + Math.cos(a) * R, SY + Math.sin(a) * R, SX + Math.cos(a) * (R + 4 + 14 * u), SY + Math.sin(a) * (R + 4 + 14 * u), u < 0.3 ? 105 : u < 0.6 ? 18 : 17); }
    warp(SX, SY, 90, 0.35, 1);
    b4BSun(SX, SY, BR, t);
    b4Sund(CX, CY, s, t, so);
    // its corona drinks what light there is; tongues of fire lash out round his hands
    for (let k = 0; k < 3; k++) { const a = -PI / 2 + (k - 1) * 0.9 + Math.sin(t * 2 + k) * 0.2; z5Ray(SX, SY, a, 60 + 20 * Math.sin(t * 3 + k), 4, 105, 103, 0.7); }
    b4BSun(SX, SY, BR, t);
    sGauntlet(ax, ay, s, -0.9, 'grab', 0.95, t); sGauntlet(bx, by, s, PI + 0.9, 'grab', 0.95, t);
    shk(0.6 + lift);
    z5Cam(1.05 + 0.1 * eio(lt / 1.6), 0.004 * z5N(t, 2), 240, lerp(140, 120, eio(lt / 1.6)), 240, 135);
  });
  CAPS.push([125.0, 126.6, 's', 'SUNDERER', 'THEN WE BOTH END.']);

  /* ================================================================ V.10 — the clash (126.2–134.0) */
  // the world with its sun gone: the morning sky drained to night, the cloud sea a dim floor
  function b4Night(t, hz, ox, dk) {
    b4Sky(t, H - LB, 0, 0, 0, 0);
    cloudBank(hz, 24, 70, 5051, (ox || 0) + t * 10, CLOUD_SUN, false);
    cloudBank(hz + 24, 30, 50, 5052, (ox || 0) * 1.4 + t * 14, [17, 18, 19, 15], false);
    tintAll(T_DARK, dk === undefined ? 0.8 : dk);
    stars(t, hz - 20, 26, 2501);
  }
  // the black sun with its rim burning hard enough to read against a night sky: the light bent round its edge
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
  function b4Contact(px, py, lt, t, power, dir) {
    b4Inv(px, py, (26 + 8 * Math.sin(t * 5)) * power, 2511);
    for (let k = 0; k < 4; k++) { const g = frac(lt * 2.6 + k * 0.25) * 0.5; z5Hit(px, py, g, 0.7 * power, dir + (k - 1.5) * 0.4, 85, 2512 + k + fl(lt * 2.6 + k * 0.25) * 7); }
    glow(px, py, 50 * power, T_WH, 0.55);
    sparkle(px, py, 10 * power + Math.sin(t * 31) * 3, 22, 105);
    shk(1.5 * power);
  }
  shot(126.2, 129.0, (lt, t) => {
    const T0 = 126.2, tc = 127.0 - T0;
    b4Night(t, 206, 0);
    // the Sunderer at the right edge: the black sun overhead, a lean back, the hurl; then his hands stay out, driving it
    const wind = eio(b4Clip(0, 0.42, lt)), hurl = eic(b4Clip(0.42, 0.62, lt)), rel = 0.56;
    const SCX = 436, SCY = 146, ss = 1.0;
    const hy0 = lerp(-92, -104, wind), hx0 = lerp(0, 22, wind);
    const armL = { x: lerp(hx0 - 36, -170, hurl), y: lerp(hy0, -20, hurl), pose: hurl > 0.7 ? 'open' : 'grab', ang: lerp(-0.9, -PI + 0.2, hurl), front: true };
    const armR = { x: lerp(hx0 + 36, -130, hurl), y: lerp(hy0, 20, hurl), pose: hurl > 0.7 ? 'open' : 'grab', ang: lerp(PI + 0.9, -PI + 0.05, hurl), front: true };
    // the hero at left: blade raised, then the swing down to meet it
    const sw = eic(b4Clip(0.62, tc, lt)), push = eoc(b4Clip(tc, 2.8, lt)) + z5Knock(lt - tc, 0.4, 10, 4);
    const HX = 118 - 14 * push + z5Sh(t, 1) * (lt > tc ? 1.2 : 0), HY = 186 + 6 * push, S = 1.5;
    const a = lt < tc ? lerp(0.75, -0.35, sw) : -0.35 + 0.12 * push, D = 160 - 18 * push, R = 38, w = 4;
    const ho = { sw: a, spread: 1, flap: 0.3 + 0.2 * (lt > tc ? 1 : 0), wt: t * 2.2, orbR: 30, warp: 0.3, auraR: 6, noLife: true, mouth: lt > tc ? 2 : 0, eyes: 'glow', cracks: lt > tc ? 0.15 * push : 0, sq: lt > tc ? 0.1 * push : -0.05 }, hand = b4HandPre(HX, HY, S, t, ho);
    const C = b4Press(hand[0], hand[1], a, D, R, w, -1);
    // the black sun's path: in his hands, then flung (fast, accelerating), then held hard on the blade
    const [bx, by] = b4Wr(SCX, SCY, ss, t, (armL.x + armR.x) / 2, (armL.y + armR.y) / 2 - 24);
    const fl_ = eic(b4Clip(rel, tc, lt));
    const SX = lt < rel ? bx : lerp(bx, C.cx, fl_), SY = lt < rel ? by : lerp(by, C.cy, fl_) - Math.sin(fl_ * PI) * 20;
    if (lt > rel && lt < tc) for (let k = 1; k < 6; k++) { const f2 = eic(b4Clip(rel, tc, lt - k * 0.025)); blackSun(lerp(bx, C.cx, f2), lerp(by, C.cy, f2) - Math.sin(f2 * PI) * 20, R * (1 - k * 0.12), t, 0.5); }
    b4Sund(SCX, SCY, ss, t, { eyes: 1.8, rage: 1, roar: 0.4 * hurl, nod: -4 * wind + 6 * hurl, tilt: 0.1 * hurl, arms: [armL, armR], heat: 0.95 });
    // he keeps it pressing: fire pours from his open hands into it
    if (lt > tc) { const [hx, hy] = b4Wr(SCX, SCY, ss, t, armL.x - 14, armL.y); z5Beam(hx, hy, C.cx, C.cy, 4 + Math.sin(t * 20), (f) => f < 0.4 ? 106 : f < 0.8 ? 104 : 102, t, 3); }
    b4BSun(SX, SY, R, t);
    const hero = b4Inf(HX, HY, S, t, ho);
    bigBlade(hero.hand[0], hero.hand[1], a, 1100, w, t, { form: 'infinite', flare: 0.8, surge: true });
    if (lt >= tc) { b4Contact(C.px, C.py, lt - tc, t, 1 + 0.3 * push, a + PI / 2); megaHit(C.px, C.py, lt - tc, 2.5, a + PI / 2, [22, 85, 83], 2521); }
    const [kz, kr] = kick(lt, [[tc, 2.5]]);
    z5Cam(1.0 + 0.12 * eio(b4Clip(tc, 2.8, lt)) + kz, kr, lerp(240, C.px, 0.5 * eio(b4Clip(tc, 2.8, lt))), 135, 240, 135);
  });

  // close: it holds, and it cannot; the blade cracks (130.0)
  shot(129.0, 131.0, (lt, t) => {
    const hc = 1.0, g = lt - hc;
    b4Night(t, 230, 40, 0.74);
    const push = lt * 0.4 + (g > 0 ? 0.6 : 0), kb = z5Knock(g, 14, 9, 4);
    const S = 3.4, HX = 132 - kb - 10 * lt + z5Sh(t, 2) * 1.6, HY = 176 + z5Sh(t, 3) * 1.2 + 4 * lt;
    const a = -0.1 + 0.04 * push, R = 56;
    const crk = clamp(0.2 + lt * 0.2 + (g > 0 ? 0.25 : 0), 0, 0.75);
    const ho = { sw: a, spread: 0.9, flap: 0.42, wt: t * 3.2, orbR: 0, warp: 0.25, auraR: 9, noLife: true, mouth: 2, eyes: g > 0 && g < 0.5 ? 'wide' : 'closed', cracks: crk, sq: 0.12 }, hand = b4HandPre(HX, HY, S, t, ho);
    const D = 168 - 10 * push, C = b4Press(hand[0], hand[1], a, D, R, 7, -1);
    b4BSun(C.cx, C.cy, R, t);
    const hero = b4Inf(HX, HY, S, t, ho);
    bigBlade(hero.hand[0], hero.hand[1], a, 1100, 7, t, { form: 'infinite', flare: 0.8, cracks: g > 0 ? 0.5 + 0.3 * lt : 0 });
    // the cracks race along the blade from the contact
    if (g > 0) for (let k = 0; k < 7; k++) { const u = clamp(g * 3, 0, 1) * (40 + ih(k, 1, 2531) * 160), s0 = (ih(k, 2, 2531) - 0.5) * 2 * u, ux = Math.cos(a), uy = Math.sin(a); let x = C.px - uy * 2, y = C.py + ux * 2; for (let q = 0; q < 8; q++) { const nx = x + ux * s0 / 8 + (ih(k, q, 2532) - 0.5) * 6, ny = y + uy * s0 / 8 + (ih(k, q, 2533) - 0.5) * 6; lineP(x, y, nx, ny, 0); x = nx; y = ny; } }
    b4Contact(C.px, C.py, lt, t, 1.4 + 0.3 * lt, a + PI / 2);
    if (g >= 0) megaHit(C.px, C.py, g, 2.6, a + PI / 2, [22, 85, 83], 2534);
    // grit and void ripped off its body by the pressure
    for (let k = 0; k < 14; k++) { const u = frac(ih(k, 1, 2535) + t * 1.8), x = HX + 50 - u * 260 + ih(k, 2, 2535) * 30, y = HY - 40 + ih(k, 3, 2535) * 90 + u * 20; if (bay(fl(x), fl(y)) < 1 - u) rectF(x, y, 2, 1, k % 3 ? 85 : 22); }
    const [kz, kr] = kick(lt, [[hc, 2]]);
    z5Cam(1.04 + 0.05 * lt + kz, kr - 0.02, 250, 130, 240, 135);
  });

  // wide: pushed back and back; the blade breaks at the tip (132.0)
  shot(131.0, 132.6, (lt, t) => {
    const hb = 1.0, g = lt - hb;
    b4Night(t, 206, 80, 0.74);
    const push = eio(lt / 1.6) + z5Knock(g, 0.5, 9, 4), S = 1.5;
    const HX = 112 - 34 * push + z5Sh(t, 1) * 1.5, HY = 190 + 14 * push + z5Sh(t, 2);
    const a = -0.3 + 0.16 * push, R = 46, w = 4;
    const ho = { sw: a, spread: 0.7, flap: 0.4, wt: t * 3, orbR: 24, orbA: 1.2, warp: 0.2, auraR: 5, noLife: true, mouth: 2, eyes: 'closed', cracks: 0.5 + 0.2 * lt, sq: 0.18 }, hand = b4HandPre(HX, HY, S, t, ho);
    const D = 150 - 12 * push, C = b4Press(hand[0], hand[1], a, D, R, w, -1);
    z5Beam(W + 20, 30, C.cx, C.cy, 5 + Math.sin(t * 20), (f) => f < 0.4 ? 106 : f < 0.8 ? 104 : 102, t, 5);
    // past the contact the blade is breaking: from the hit the far part shears off and is flung away, spinning to shards
    const L = 1100, snap = (D + R * 0.6) / L, off = g > 0 ? [Math.cos(a + 0.5) * g * 300, Math.sin(a + 0.5) * g * 300 + g * g * 80] : [0, 0];
    b4BSun(C.cx, C.cy, R, t);
    const hero = b4Inf(HX, HY, S, t, ho);
    bigBlade(hero.hand[0], hero.hand[1], a, L, w, t, g > 0 ? { form: 'infinite', flare: 0.6, cracks: 0.6, snap, snapOff: off } : { form: 'infinite', flare: 0.6, cracks: 0.5 });
    b4Contact(C.px, C.py, lt, t, 1.1, a + PI / 2);
    if (g >= 0) { megaHit(C.px, C.py, g, 2.9, a, [22, 85, 83], 2541); const sx = hero.hand[0] + Math.cos(a) * snap * L, sy = hero.hand[1] + Math.sin(a) * snap * L; rocks(sx, sy, g, 26, 260, 3, [83, 85, 22, 22], 2542, 120, a + 0.4, 1.8); }
    const [kz, kr] = kick(lt, [[hb, 3]]);
    z5Cam(1.02 + kz, kr, 230, 140, 240, 135);
  });

  // close: on its knees in the air under it; the wings sag; nothing left
  shot(132.6, 134.0, (lt, t) => {
    b4Night(t, 236, 120, 0.8);
    const S = 3.4, sink = eoc(lt / 1.4), tr = z5Sh(t, 4) * (1.2 + lt);
    const HX = 196 + tr * 0.8, HY = 176 + 8 * sink + tr * 0.5, a = -1.0 + 0.08 * sink + z5Sh(t, 5) * 0.02;
    const eyes = lt < 1.12 ? 'closed' : lt < 1.28 ? 'wide' : 'glow';
    const ho = { sw: a, ang: 0.22 * sink, spread: 0.45 - 0.15 * sink, flap: 0.08, wt: t * 0.8, orbR: 30, orbA: 1.0, warp: 0.1, auraR: 4, noLife: true, mouth: lt > 1.25 ? 2 : 0, eyes, cracks: 0.75, sq: 0.24, legs: [4, 2, 4, 2] }, hand = b4HandPre(HX, HY, S, t, ho);
    const R = 78, C = b4Press(hand[0], hand[1], a, 100, R, 6, -1);
    b4BSun(C.cx, C.cy, R, t);
    const hero = b4Inf(HX, HY, S, t, ho);
    bigBlade(hero.hand[0], hero.hand[1], a, 150, 6, t, { form: 'infinite', flare: 0.4, cracks: 0.7, snap: 0.999 });
    b4Contact(C.px, C.py, lt, t, 0.9, a + PI / 2);
    // the dark closes in from the edges
    for (let y = LB; y < H - LB; y++) for (let x = 0; x < W; x++) { const d = Math.hypot((x - HX) / 260, (y - HY) / 150); if (d > 0.6) tintI(y * W + x, x, y, T_DARK, (d - 0.6) * 1.2 * (0.5 + 0.5 * sink)); }
    if (lt > 1.28) glow(HX, HY, 60, T_WH, 0.3 * (lt - 1.28) / 0.12);
    z5Cam(1.05 + 0.18 * eio(lt / 1.4), 0.01 * z5N(t, 6), lerp(200, HX, 0.5), lerp(140, HY, 0.6), 240, 135);
  });

  /* ================================================================ V.11 — FURTHER!! (134.0–135.75) */
  shot(134.0, 135.75, (lt, t) => {
    const er = eoc(b4Clip(0, 0.35, lt)), rise = eio(b4Clip(0.1, 1.2, lt)), wind = eio(b4Clip(1.25, 1.75, lt));
    b4Night(t, 236, 120 + lt * 20, 0.9 - 0.25 * er);
    const tr = z5Sh(t, 4) * (2.5 - rise * 1.5);
    const HX = 196 - 30 * wind + tr, HY = 184 - 16 * rise + tr * 0.5;
    const ov = er * (1 - 0.3 * wind), S = 2.8;
    const a = lerp(-0.92, -2.0, wind) + z5Sh(t, 5) * 0.03 * (1 - wind);
    const ho = { sw: a, ang: lerp(0.22, -0.06, rise) - 0.1 * wind, spread: lerp(0.3, 1, er), flap: 0.32, wt: t * 3.4, over: ov, orbR: 62, orbA: 1 + er, warp: 0.5 * er, rays: 120 * er, auraR: 6 + 8 * er, noLife: true, mouth: 2, eyes: 'glow', cracks: 0.75 * (1 - rise), sq: lerp(0.24, -0.1, rise), legs: rise < 0.6 ? [4, 2, 4, 2] : undefined };
    const hand = b4HandPre(HX, HY, S, t, ho);
    // the black sun forced back up off it
    const R = 78, C = b4Press(hand[0], hand[1], -0.92, 100 + 40 * rise, R, 6, -1);
    const sx = C.cx + 40 * wind, sy = C.cy - 30 * rise - 20 * wind;
    b4BSun(sx, sy, R, t);
    // the dark blown back from it in a ring of every colour
    if (lt < 1.2) { shockRing(HX, HY, 10 + lt * 420, 10 + lt * 420, 5, [22, PRISM[fl(t * 20) % 7], PRISM[(fl(t * 20) + 3) % 7]], 1 - lt / 1.2); shockRing(HX, HY, 6 + lt * 260, 6 + lt * 260, 3, [22, 60, 59], 1 - lt / 0.9); }
    const hero = b4Inf(HX, HY, S, t, ho);
    // the blade regrows past the frame, its cracks sealing in light
    const L = lerp(150, 1400, eoc(b4Clip(0.2, 1.1, lt)));
    bigBlade(hero.hand[0], hero.hand[1], a, L, 6 + 2 * rise, t, { form: 'infinite', flare: 0.9, grow: lt < 1.1 ? 0.6 + 0.4 * eoc(b4Clip(0.2, 1.1, lt)) : 1, surge: true, cracks: 0.7 * (1 - rise) });
    if (wind < 0.1) b4Contact(C.px, C.py, lt, t, 0.9 + er * 0.6, -0.92 + PI / 2);
    if (lt < 0.03) impactFrame(HX, HY, 1);
    shk(3 + 4 * er * (1 - lt / 1.75));
    z5Cam(1.08 - 0.1 * eio(b4Clip(0.2, 1.75, lt)) + kick(lt, [[0, 2]])[0], 0.01 * z5N(t, 3), lerp(HX + 10, 240, eio(b4Clip(0.3, 1.75, lt))), lerp(HY - 40, 120, eio(b4Clip(0.3, 1.75, lt))), 240, 135);
  });
  CAPS.push([134.2, 135.6, 'x', '', 'FURTHER!!', 62]);

  /* ================================================================ V.12 — into the black sun (135.75–138.0) */
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
  shot(135.75, 138.0, (lt, t) => {
    const tc = 0.25, g = lt - tc, [BX, BY, R] = B4_BS;
    b4Night(t, 214, 160, 0.74);
    const drive = eio(b4Clip(tc, 2.25, lt)), HX = 128 + 22 * drive + z5Sh(t, 1) * 1.4 * (g > 0 ? 1 : 0), HY = 188 - 6 * drive + z5Sh(t, 2) * (g > 0 ? 1 : 0), S = 1.9;
    // the swing comes down from overhead; at the hit it is the tangent of the black sun, and it grinds on in toward the
    // centre line
    const ho0 = { sw: -1.2, noLife: true };
    const hand = b4HandPre(HX, HY, S, t, Object.assign({}, ho0, { orbR: 0 }));
    const dC = Math.atan2(BY - hand[1], BX - hand[0]), dd = Math.hypot(BX - hand[0], BY - hand[1]), tan = dC - Math.asin(R / dd);
    const a = lt < tc ? lerp(-2.1, tan, eic(lt / tc)) : lerp(tan, dC, drive) + z5Sh(t, 3) * 0.008;
    b4BSun(BX, BY, R, t);
    const hero = b4Inf(HX, HY, S, t, { sw: a, spread: 1, flap: 0.36, wt: t * 3, over: 0.35, orbR: 36, orbA: 2, warp: 0.35, auraR: 7, noLife: true, mouth: 2, eyes: 'glow', sq: g > 0 ? 0.08 : -0.1 });
    bigBlade(hero.hand[0], hero.hand[1], a, 1400, 5, t, { form: 'infinite', flare: 1, surge: true });
    // where the blade is inside it: light pours from the wound, and its edges throw sparks
    if (g > 0) {
      const ux = Math.cos(a), uy = Math.sin(a), px = BX - hero.hand[0], py = BY - hero.hand[1], m = px * ux + py * uy, q = Math.abs(-px * uy + py * ux), hc = Math.sqrt(Math.max(0, R * R - q * q));
      const e1 = [hero.hand[0] + ux * (m - hc), hero.hand[1] + uy * (m - hc)], e2 = [hero.hand[0] + ux * (m + hc), hero.hand[1] + uy * (m + hc)];
      for (const [ex, ey] of [e1, e2]) { b4Contact(ex, ey, lt, t, 0.8 + 0.4 * drive, a - PI / 2); }
      for (let k = 0; k < 6; k++) { const u = (k + 0.5) / 6, x = lerp(e1[0], e2[0], u), y = lerp(e1[1], e2[1], u); z5Ray(x, y, a - PI / 2 + Math.sin(t * 9 + k) * 0.2, 10 + 30 * drive * ih(k, fl(t * 15), 2601), 2, 22, 60, 0.8); }
      glow((e1[0] + e2[0]) / 2, (e1[1] + e2[1]) / 2, 40 + 60 * drive, T_WH, 0.35 + 0.2 * drive);
      megaHit(e1[0], e1[1], g, 2.8, a, [22, 85, 83], 2602);
    }
    const [kz, kr] = kick(lt, [[tc, 3]]);
    z5Cam(1.0 + 0.1 * drive + kz, kr, lerp(240, 250, drive), 135, 240, 135);
  });

  /* ================================================================ V.13 — the black sun splits; the light comes back (138.0–139.6) */
  shot(138.0, 139.6, (lt, t) => {
    const [BX, BY, R] = B4_BS, op = eoc(b4Clip(0, 1.2, lt));
    b4Night(t, 214, 200, 0.74 - 0.52 * eio(b4Clip(0, 1.4, lt)));
    // the light that was in it, flooding out across the sky
    z5GodRays(BX, BY, 9, t * 0.5, T_WARM, 0.7 * op, 520);
    glow(BX, BY, 60 + 200 * op, T_WH, 0.55 * (1 - 0.4 * op));
    // the Sunderer, seen behind it as it comes apart: rocked back by the light
    b4Sund(420, 150 + 6 * op, 1.0, t, { eyes: 1.6, rage: 1, roar: 0.6 * op, tilt: 0.1 * op, nod: -4 * op, arms: [{ x: -150, y: -10 - 30 * op, pose: 'open', front: true }, { x: 110, y: 80, pose: 'fist' }], heat: 0.9 });
    const HX = 150, HY = 182, S = 1.9, a = -0.47;
    const ux = Math.cos(a), uy = Math.sin(a), nx = -uy, ny = ux, gap = 6 + 70 * op;
    for (const sd of [-1, 1]) b4HalfSun(BX + nx * gap * sd + ux * 20 * op * sd, BY + ny * gap * sd + 30 * op * op, R * (1 - 0.15 * op), t, nx, ny, sd, op, sstep(0.3, 1.4, lt));
    // the seam of light between the halves
    for (let k = -1; k <= 1; k++) lineF(BX - ux * 300, BY - uy * 300 + k, BX + ux * 300, BY + uy * 300 + k, (x, y) => { if (bay(x, y) < 1 - op * 0.6) P(x, y, k ? 60 : 22); });
    for (let k = 0; k < 30; k++) { const u = frac(ih(k, 1, 2611) + lt * 0.8), d = (ih(k, 2, 2611) - 0.5) * 2 * R, x = BX + ux * d + nx * (ih(k, 3, 2611) - 0.5) * gap * 2 + nx * u * 40 * (k % 2 ? 1 : -1), y = BY + uy * d + ny * (ih(k, 3, 2611) - 0.5) * gap * 2 + u * u * 40; if (bay(fl(x), fl(y)) < 1 - u) rectF(x, y, 2, 2, k % 3 ? 105 : 103); }
    const hero = b4Inf(HX, HY, S, t, { sw: a, spread: 1, flap: 0.3, wt: t * 2.6, orbR: 36, orbA: 2, warp: 0.3, auraR: 6, noLife: true, mouth: lt < 0.6 ? 2 : 0, eyes: 'glow', rays: 70 * op });
    bigBlade(hero.hand[0], hero.hand[1], a, 1400, 5, t, { form: 'infinite', flare: 1, surge: true });
    if (lt < 0.03) impactFrame(BX, BY, 1);
    shockRing(BX, BY, 10 + lt * 500, 10 + lt * 500, 5, [22, 16, 15], 1 - lt / 1.0);
    shk(7 * Math.exp(-lt * 3));
    const [kz, kr] = kick(lt, [[0, 3]]);
    z5Cam(1.08 - 0.06 * op + kz, kr, 260, 135, 240, 135);
  });

  /* ================================================================ V.14 — the final combo (139.6–145.0) */
  // five cuts, each taking part of him; his state at any moment of it (absolute t)
  const B4_C = [140.0, 140.6, 141.2, 141.8, 142.4];
  const B4_MASKA = 1.93;                                   // the line the mask is cut along (mask frame)
  function b4SundC(cx, cy, s, t, o) {
    const ul = t < B4_C[0] ? o.ul : null, l0 = t < B4_C[2], l1 = t < B4_C[4], half = t >= B4_C[3] && o.mask !== false;
    const wound = t >= B4_C[2] ? [[-92, 48, 72, 132, 3 + 2 * Math.min(1, (t - B4_C[2]) * 6)]] : [];
    const so = Object.assign({ heat: 0.95, rage: 1, third: 1, eyes: 1.6, crown: t < B4_C[1] ? 1 : 0.22, maskCuts: B4_MCUT, wounds: wound }, o, { arms: [ul, o.ur || null, l0 ? B4_LOW[0] : null, l1 ? B4_LOW[1] : null] });
    if (half) so.mask = false;
    const r = sunderer(cx, cy, s, t, so);
    // where an arm was taken at the shoulder: a burning socket
    if (!o.split) for (const [k, gone] of [[0, !ul], [2, !l0], [3, !l1]]) if (gone && (k !== 0 || t >= B4_C[0])) { const [lx, ly] = SH4[k], X = cx + lx * s, Y = cy + Math.sin(t * 0.9) * s + ly * s; discF(X, Y, 9 * s, 101); discF(X, Y, 6 * s, 103); discF(X, Y, 3 * s, 105); glow(X, Y, 22 * s, T_EMBER, 0.4); for (let q = 0; q < 4; q++) { const g = frac(t * 0.9 + ih(k, q, 2701)); rectF(X + (ih(k, q, 2702) - 0.5) * 14 * s, Y + 8 * s + g * 60 * s, Math.max(1, s * 1.5), Math.max(2, s * 3), g < 0.5 ? 105 : 103); } }
    if (half) b4MaskPart(cx, cy, s, t, so, 1, null, 0);
    return r;
  }
  // one side of his mask (side +1 keeps the right of the cut, -1 the left), placed as sunderer() places it, moved by off
  // and turned by rot (the half that falls); the kept half shows the molten inside of his head where the other was
  function b4MaskPart(cx, cy, s, t, o, side, off, rot) {
    cy += Math.sin(t * 0.9) * s;
    const mcx = cx + Math.sin(t * 0.6) * 0.6 * s + (off ? off[0] : 0), mcy = cy + Math.sin(t * 0.9 - 0.8) * 0.5 * s + (o.nod || 0) * s + (off ? off[1] : 0);
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
      if (sd * side < 0) { if (side > 0 && !off) BUF[y * W + x] = e < 1.2 ? 107 : seamAt(mx / 4 + 7, my / 4) < 0.06 ? 104 : e < 3 ? 102 : vn(mx, my, 3, 2703) > 0.6 ? 97 : 96; continue; }
      BUF[y * W + x] = e < 0.9 ? 22 : e < 1.8 ? 105 : c;
    }
  }
  // a hero from a key track, Infinite, with its giant blade: afterimages on the dash, a stretch along it, and the slash
  // of light its blade leaves when it turns fast
  function b4Fighter(keys, lt, t, S, L, w, extra) {
    const p = z5Trk(keys, lt), q = z5Trk(keys, lt - 1 / 30), vx = (p.x - q.x) * 30, vy = (p.y - q.y) * 30, sp = Math.hypot(vx, vy);
    const after = []; if (sp > 300) for (let k = 1; k <= 4; k++) { const a = z5Trk(keys, lt - k * 0.03); after.push([a.x, a.y, k === 1 ? 22 : PRISM[(k * 2 + fl(t * 30)) % 7], 0.6 - k * 0.13]); }
    const r = b4Inf(p.x, p.y, S, t, Object.assign({ sw: p.sw, ang: p.a || 0, noLife: true, after, st: clamp((sp - 150) / 1500, 0, 0.45), sd: Math.atan2(vy, vx), spread: 1, flap: 0.36, wt: t * 3, orbR: 16 * S, orbA: 2, auraR: 4 * S, mouth: 2, warp: 0.2 }, extra || {}));
    const N = 5, wa = []; for (let k = 0; k <= N; k++) wa.push(z5Trk(keys, lt - k / 30).sw);
    let m = 0, nw = -1; for (let k = 0; k < N; k++) if (Math.abs(wa[k] - wa[k + 1]) > 0.12) { m = k + 1; if (nw < 0) nw = k; }
    if (m) z5Arc(r.hand[0], r.hand[1], wa[m], wa[0] - wa[m], L * 1.02, nw / N * 0.9);
    const tip = bigBlade(r.hand[0], r.hand[1], p.sw, L, w, t, { form: 'infinite', flare: 0.7, surge: true });
    return { p, hand: r.hand, tip, sp };
  }
  // a severed limb: from (ax, ay) to the wrist (bx, by) at the moment of the cut, g seconds ago, thrown along (vx, vy)
  // and turning; with its gauntlet if it had one
  function b4Limb(ax, ay, bx, by, s, g, vx, vy, spin, pose, t) {
    if (g < 0) return;
    const mx = (ax + bx) / 2 + vx * g, my = (ay + by) / 2 + vy * g + 160 * g * g, rot = spin * g, c = Math.cos(rot), sn = Math.sin(rot);
    const rp = (x, y) => { const dx = x - (ax + bx) / 2, dy = y - (ay + by) / 2; return [mx + dx * c - dy * sn, my + dx * sn + dy * c]; };
    const [pa, pb] = [rp(ax, ay), rp(bx, by)];
    capsF(pa[0], pa[1], pb[0], pb[1], 15 * s, 12 * s, (u, d, X, Y, nx) => d > 0.82 ? 96 : u < 0.06 ? 105 : OBS[clamp(fl(2 - nx * 1.6 + (bay(X, Y) - 0.5) * 0.8), 0, 4)]);
    discF(pa[0], pa[1], 10 * s, 103); discF(pa[0], pa[1], 6 * s, 105);
    if (pose) sGauntlet(pb[0], pb[1], s, Math.atan2(pb[1] - pa[1], pb[0] - pa[0]), pose, 0.4, t);
    for (let q = 0; q < 4; q++) { const gg = g - q * 0.04; if (gg > 0) P(pa[0] - vx * q * 0.01, pa[1] + q * 3, 105); }
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
  // the sky as the light comes back after the black sun
  function b4Return(t, hz, ox, dk) {
    b4Sky(t, H - LB, 0, 0, 0, 0);
    cloudBank(hz, 24, 70, 5051, (ox || 0) + t * 10, CLOUD_SUN, false);
    cloudBank(hz + 24, 30, 50, 5052, (ox || 0) * 1.4 + t * 14, [17, 18, 19, 15], false);
    z5GodRays(80, 30, 8, t * 0.4, T_WARM, 0.35, 520);
    tintAll(T_DARK, dk === undefined ? 0.3 : dk);
  }
  const b4Cut = (x, y, g, a, seed) => { megaHit(x, y, g, 2.2, a, [22, 85, 83], seed); };
  // 1 — the dive: along its blade and down through his upper left arm at the shoulder (140.0)
  const B4_K1 = K({ t: 0, x: 40, y: 236, sw: -0.7 }, { t: 0.25, x: 146, y: 92, sw: -2.6, e: 'o' }, { t: 0.4, x: 200, y: 118, sw: 1.3, e: EQ }, { t: 0.7, x: 262, y: 226, sw: 1.75, e: 'o' });
  shot(139.6, 140.3, (lt, t) => {
    const tc = 0.4, g = lt - tc;
    b4Return(t, 214, 260, 0.34);
    const CX = 318, CY = 104, s = 1.5;
    b4SundC(CX, CY, s, t, { ul: { x: -150, y: 110, pose: 'fist' }, ur: { x: 150, y: 100, pose: 'fist' }, roar: g > 0 ? 0.6 : 0.1, tilt: g > 0 ? z5Knock(g, 0.12, 9, 4) : 0 });
    if (g > 0) b4Limb(CX - 102 * s, CY + 52 * s, CX - 150 * s, CY + 110 * s, s, g, -120, -60, -4, 'fist', t);
    b4Fighter(B4_K1, lt, t, 1.5, 150, 4);
    if (g >= 0) b4Cut(CX - 96 * s, CY + 44 * s, g, 1.3, 2711);
    const [kz, kr] = kick(lt, [[tc, 2, 1.3]]);
    z5Cam(1.04 + kz, kr, 250, 140, 240, 135);
  });
  // 2 — overhead and across: the crown (140.6)
  const B4_K2 = K({ t: 0, x: 470, y: 96, sw: 0.2 }, { t: 0.2, x: 396, y: 86, sw: 0.0, e: 'o' }, { t: 0.4, x: 120, y: 94, sw: 3.1, e: EQ }, { t: 0.6, x: 50, y: 110, sw: 3.4, e: 'o' });
  shot(140.3, 140.9, (lt, t) => {
    const tc = 0.3, g = lt - tc;
    b4Return(t, 230, 300, 0.32);
    const CX = 250, CY = 204, s = 1.8;
    b4SundC(CX, CY, s, t, { ur: { x: 150, y: 110, pose: 'fist' }, roar: 0.5, nod: g > 0 ? z5Knock(g, 6, 9, 4) : 0 });
    b4CrownShards(CX, CY - 4 * s, g, 2721);
    b4Fighter(B4_K2, lt, t, 1.5, 130, 4);
    if (g >= 0) b4Cut(CX - 10, CY - 70 * s, g, PI, 2722);
    const [kz, kr] = kick(lt, [[tc, 2, -PI / 2]]);
    z5Cam(1.0 + kz, kr, 250, 140, 240, 135);
  });
  // 3 — down across the chest, through the left stump (141.2)
  const B4_K3 = K({ t: 0, x: 30, y: 46, sw: -1.6 }, { t: 0.15, x: 72, y: 66, sw: -2.5, e: 'o' }, { t: 0.3, x: 204, y: 150, sw: 0.9, e: EQ }, { t: 0.6, x: 440, y: 234, sw: 1.5, e: 'o' });
  shot(140.9, 141.5, (lt, t) => {
    const tc = 0.3, g = lt - tc;
    b4Return(t, 250, 340, 0.36);
    const CX = 222, CY = 56, s = 1.6;
    b4SundC(CX, CY, s, t, { ur: { x: 150, y: 110, pose: 'fist' }, roar: 0.8, tilt: g > 0 ? z5Knock(g, -0.1, 9, 4) : 0 });
    if (g > 0) b4Limb(CX - 60 * s, CY + 94 * s, CX - 118 * s, CY + 150 * s, s, g, -90, 20, 3, null, t);
    b4Fighter(B4_K3, lt, t, 1.5, 170, 4);
    if (g >= 0) b4Cut(CX - 10 * s, CY + 90 * s, g, 0.6, 2731);
    const [kz, kr] = kick(lt, [[tc, 2, 0.6]]);
    z5Cam(1.0 + kz, kr, 240, 135, 240, 135);
  });
  // 4 — straight down through his face: half the mask (141.8)
  const B4_K4 = K({ t: 0, x: 468, y: 96, sw: 2.6 }, { t: 0.15, x: 400, y: 84, sw: -0.9, e: 'o' }, { t: 0.3, x: 300, y: 110, sw: 2.1, e: EQ }, { t: 0.7, x: 110, y: 236, sw: 2.5, e: 'o' });
  shot(141.5, 142.2, (lt, t) => {
    const tc = 0.3, g = lt - tc;
    b4Return(t, 260, 380, 0.4);
    const CX = 240, CY = 142, s = 3.0, o = { ur: { x: 150, y: 110, pose: 'fist' }, roar: 0.4 + (g > 0 ? 0.5 : 0), eyes: 1.8, tilt: g > 0 ? z5Knock(g, 0.12, 8, 4) : 0 };
    b4SundC(CX, CY, s, t, o);
    if (g > 0) b4MaskPart(CX, CY, s, t, Object.assign({ heat: 0.95, rage: 1, third: 1, eyes: 1.8, maskCuts: B4_MCUT }, o), -1, [-g * 140, g * 60 + g * g * 260], -g * 2.2);
    b4Fighter(B4_K4, lt, t, 1.6, 230, 5);
    if (g >= 0) megaHit(CX, CY, g, 1.6, 2.0, [22, 85, 83], 2741);
    const [kz, kr] = kick(lt, [[tc, 2.5, 2.0]]);
    z5Cam(1.0 + kz, kr, 240, 135, 240, 135);
  });
  // 5 — up from under: the last stump (142.4); he roars
  const B4_K5 = K({ t: 0, x: 450, y: 240, sw: 1.6 }, { t: 0.1, x: 410, y: 236, sw: 2.3, e: 'o' }, { t: 0.2, x: 352, y: 176, sw: -1.0, e: EQ }, { t: 0.55, x: 300, y: 60, sw: -1.5, e: 'o' });
  shot(142.2, 142.75, (lt, t) => {
    const tc = 0.2, g = lt - tc;
    b4Return(t, 240, 420, 0.38);
    const CX = 250, CY = 100, s = 1.4;
    b4SundC(CX, CY, s, t, { ur: { x: 156, y: 96, pose: 'fist' }, roar: g > 0 ? 1 : 0.4, eyes: 2, nod: g > 0 ? -5 : 0, shake: g > 0 ? 0.6 : 0 });
    if (g > 0) b4Limb(CX + 60 * s, CY + 94 * s, CX + 118 * s, CY + 150 * s, s, g, 80, -220, 5, null, t);
    b4Fighter(B4_K5, lt, t, 1.5, 150, 4);
    if (g >= 0) b4Cut(CX + 64 * s, CY + 100 * s, g, -1.2, 2751);
    const [kz, kr] = kick(lt, [[tc, 2, -1.2]]);
    z5Cam(1.02 + kz, kr, 250, 140, 240, 135);
  });

  /* ================================================================ V.15 — his last fist (142.75–144.1) */
  shot(142.75, 144.1, (lt, t) => {
    const T0 = 142.75, hc = 143.4 - T0, g = lt - hc;
    b4Return(t, 226, 460, 0.45);
    const CX = 380, CY = 104, s = 1.3;
    // the fist: drawn back, then thrown with everything he has left; it stops dead on the point of the blade
    const cock = eio(b4Clip(0, 0.35, lt)), thr = eic(b4Clip(0.35, hc, lt)), rec = g > 0 ? eoc(b4Clip(0, 0.6, g)) : 0;
    const contact = [242, 140];
    const wrC = [(contact[0] - CX) / s + 17, (contact[1] - CY) / s];
    const wx = lerp(lerp(150, 128, cock), wrC[0], thr) + rec * 50, wy = lerp(lerp(100, -10, cock), wrC[1], thr) + rec * 10;
    const sh = g > 0 ? z5Sh(t, 7) * 2 * Math.exp(-g * 3) : 0;
    b4SundC(CX + sh, CY, s, t, { ur: { x: wx, y: wy, pose: 'fist', ang: lerp(-0.6, PI - 0.05, thr), heat: 1, front: true }, roar: 1, eyes: 2, nod: -3 * cock + 5 * thr });
    // the gauntlet breaks from the knuckles back
    if (g > 0) { rocks(contact[0] + 10, contact[1], g, 30, 220, 3.5, [67, 66, 65, 64], 2761, 140, 0, 2.4); rocks(contact[0], contact[1], g, 16, 160, 2, [103, 105, 107, 22], 2762, 100, 0.3, 2); }
    // the hero, blade levelled at him, braced; driven back a little at the hit, then drives on
    const HX = 112 - z5Knock(g, 12, 9, 4) + 14 * eio(b4Clip(0.3, 1.2, g)) - 6 * cock + z5N(t, 3) * 2, HY = 142 + z5Sh(t, 2) * (g > 0 ? 1 : 0.4) + Math.sin(t * 2.4) * 2 * (1 - thr);
    const a = -0.02 + z5Knock(g, 0.08, 10, 4);
    const hero = b4Inf(HX, HY, 1.9, t, { sw: a, spread: 1, flap: 0.34, wt: t * 3, orbR: 34, orbA: 2, auraR: 8, noLife: true, mouth: 2, eyes: 'glow', warp: 0.3, rays: g > 0 && g < 0.5 ? 80 : 0 });
    bigBlade(hero.hand[0], hero.hand[1], a, contact[0] - hero.hand[0] + (g > 0 ? 40 * eio(b4Clip(0.2, 1, g)) : 0), 5, t, { form: 'infinite', flare: 0.9, surge: true });
    if (g >= 0) { megaHit(contact[0], contact[1], g, 4, PI, [22, 85, 83], 2763); b4Inv(contact[0], contact[1], 40 * Math.exp(-g * 2), 2764); }
    const [kz, kr, kx] = kick(lt, [[hc, 3, 0]]);
    z5Cam(1.04 + 0.1 * thr + kz, kr, 250 + kx, 138, 240, 135);
  });

  /* ================================================================ V.16 — raised over the world (144.1–145.0) */
  // under it, looking up: it rises into the returning light, and the Worldblade grows back to its whole length overhead
  shot(144.1, 144.75, (lt, t) => {
    const u = eio(lt / 0.65);
    b4Sky(t, H - LB, 240, 60, 0, 0);
    z5GodRays(240, 40, 10, t * 0.6, T_WARM, 0.6, 520);
    tintAll(T_DARK, 0.4 - 0.25 * u);
    glow(240, 40, 220, T_WH, 0.3 + 0.2 * u);
    const HX = 240, HY = lerp(170, 96, eoc(lt / 0.6)), a = lerp(-1.0, -1.62, u);
    const hero = b4Inf(HX, HY, 2.4, t, { sw: a, spread: 1, flap: 0.3, wt: t * 2.4, orbR: 60, orbA: 2, auraR: 9, noLife: true, mouth: 2, eyes: 'glow', warp: 0.5, rays: 160, over: 0.3 * u });
    bigBlade(hero.hand[0], hero.hand[1], a, 200 + 1200 * u, 4 + 3 * u, t, { form: 'infinite', flare: 1, grow: 0.5 + 0.5 * u, surge: true });
    shk(2 + 3 * u);
    z5Cam(1.1 - 0.1 * u, -0.04 * u, 240, 135, 240, 135);
  });

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
  shot(144.75, 146.6, (lt, t) => {
    const tc = 0.25, g = lt - tc;
    b4WorldWide(t, 0.35 - 0.15 * eio(b4Clip(0, 1.8, lt)));
    z5GodRays(B4_FX - 6, 40, 10, t * 0.5, T_WARM, 0.45, 500);
    const frz = g > 0 ? Math.min(1, g * 3) : 0;
    b4SundC(B4_FX, B4_FY, B4_FS, t, { ur: { x: 150, y: 96, pose: 'fist' }, roar: g > 0 ? 0.8 : 0.3, eyes: g > 0 ? 2 : 1.6, nod: g > 0 ? 3 * frz : 0, shake: g > 0 ? 0.4 * Math.exp(-g * 2) : 0 });
    // the cloud closes over his base in front
    cloudBank(250, 16, 60, 5053, t * 16, [17, 18, 19, 15], false);
    // the hero high over his crown, the blade swung over from straight up to straight down
    const HX = 222, HY = 62 - 4 * frz, a = lt < tc ? lerp(PI + 0.7, B4_FA, eic(lt / tc)) : B4_FA;
    const hero = b4Inf(HX, HY, 1.3, t, { sw: a, spread: 1, flap: 0.3, wt: t * 2.6, orbR: 22, orbA: 2, auraR: 5, noLife: true, mouth: 2, eyes: 'glow', warp: 0.3, rays: 60 });
    if (lt < tc + 0.15) { const a0 = lerp(PI + 0.7, B4_FA, eic(clamp(lt - 0.12, 0, tc) / tc)); z5Arc(hero.hand[0], hero.hand[1], a0, a - a0, 420, lt < tc ? 0 : (lt - tc) / 0.15); }
    bigBlade(hero.hand[0], hero.hand[1], a, 900, 4, t, { form: 'infinite', flare: 1, surge: true });
    // the split runs out from where it struck him, both ways along the line, and the two halves of the world part
    if (g > 0) {
      const amt = eoc(b4Clip(0, 0.5, g)), gap = 3 + 27 * eoc(b4Clip(0.05, 1.4, g));
      worldSplit(B4_FX, B4_FY + 20, B4_FA, gap, amt, t);
      megaHit(B4_FX, B4_FY, g, 2.9, PI / 2, [22, 85, 83], 2801);
      glow(B4_FX, B4_FY, 120, T_WH, 0.5 * Math.exp(-g * 2));
    }
    const [kz, kr] = kick(lt, [[tc, 4, PI / 2]]);
    z5Cam(1.0 + kz - 0.04 * eio(b4Clip(tc, 1.8, lt)), kr, 250, 122, 240, 135);
  });

  /* ================================================================ V.18 — he comes apart; "...brother..." (146.6–150.0) */
  shot(146.6, 150.0, (lt, t) => {
    const u = lt / 3.4, spl = eio(b4Clip(0.1, 3.4, lt)) * 0.75;
    b4WorldWide(t, 0.25);
    worldSplit(240, 140, B4_FA, 34 + 10 * u, 1, t);
    const CX = 240, CY = 118, s = 1.9;
    const eyes = lerp(1.6, 0.25, eio(b4Clip(1.0, 3.2, lt))), third = 1 - eio(b4Clip(1.9, 3.0, lt));
    b4SundC(CX, CY, s, t, { ur: { x: 140, y: 120 + 30 * u, pose: 'open', heat: 0.6 }, split: spl, splitA: B4_FA, splitX: 0, splitY: 0, eyes, third, roar: t > 147.0 && t < 148.2 ? 0.25 + 0.15 * Math.sin(t * 9) : 0.1, heat: lerp(0.95, 0.4, u), rage: lerp(1, 0.2, u), nod: 4 * u });
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
    gradient(LB, H - LB, [17, 120, 121, 18, 19, 18]);
    tintAll(T_DARK, 0.35);
    cloudBank(220 - 60 * fall, 22, 70, 5051, t * 4, [17, 18, 19, 20], false);
    tintAll(T_DARK, 0.2);
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
  const B4_SPARK = [163.0, 163.7, 164.4, 165.0];
  shot(162.0, 171.0, (lt, t) => {
    const SX = 352, SY = 170;
    z5Dawn(t, 192, t * 6, SX, SY);
    z5GodRays(SX, SY, 7, t * 0.15, T_WARM, 0.45, 380);
    B4_ASHF(t, 16, 2851, 0.6);
    // it floats limp over the healed cloud sea, barely glowing; it wakes enough to speak
    const HX = 214 + z5N(t * 0.3, 1) * 2, HY = 132 + Math.sin(t * 1.1) * 2.4, S = 3.0;
    const wake = t > 165.5, eyes = t < 165.5 ? 'closed' : t < 165.62 ? 'narrow' : t < 165.7 ? 'closed' : t > 169.6 && t < 169.72 ? 'closed' : 'narrow';
    const r = b4Hero({ eyes, mouth: t > 166.0 && t < 168.4 && fl(t * 6) % 3 === 0 ? 1 : 0, sword: 0.55 + Math.sin(t * 0.7) * 0.05, cracks: 0.85, legs: z5Limp(t, 1.0), sq: 0.04 }, HX, HY, S, 0.16 + Math.sin(t * 0.6) * 0.03 - (wake ? 0.06 * eio(b4Clip(165.5, 167, t)) : 0), false, { still: true }, 8, true);
    b4TintSprite(T_DARK, 0.18);
    glow(HX, HY, 50, T_WARM, 0.15 + 0.05 * Math.sin(t * 2));
    // the four orbs, flickering back as sparks, one by one, then holding (faint) round it
    for (let k = 0; k < 4; k++) {
      const st = B4_SPARK[k]; if (t < st) continue;
      const g = t - st, flick = g < 0.6 ? ih(k, fl(t * 14), 2852) < 0.55 : true;
      if (!flick) continue;
      const a = t * 0.9 + k * TAU / 4, x = HX + Math.cos(a) * 52, y = HY + Math.sin(a) * 14;
      const R = lerp(2.6, 1.6, clamp(g / 1.5, 0, 1)) + 0.3 * Math.sin(t * 3 + k); glow(x, y, R * 5, EL_T[k], 0.4); discF(x, y, R, ORB[k][1]); discF(x - R * 0.3, y - R * 0.3, R * 0.55, ORB[k][2]); P(x - R * 0.4, y - R * 0.4, 22);
      if (g < 0.25) sparkle(x, y, 4 * (1 - g / 0.25), 22, ORB[k][2]);
    }
    z5Cam(1.05 + 0.12 * eio(b4Clip(162, 167, t)) - 0.1 * eio(b4Clip(168, 171, t)), 0.004 * z5N(t * 0.4, 3), lerp(240, HX, eio(b4Clip(162, 166, t))), lerp(135, HY, eio(b4Clip(162, 166, t))), 240, 135);
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
