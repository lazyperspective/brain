  /* ================================================================ part IV, act III (0:41–0:58): beyond */
  {
  const NOVA_AURA = [110, 109, 108, 22], WOUND1 = [-60, 58, 44, 112, 3.5], WOUND2 = [70, 34, 92, 52, 4];
  // wings like z5Wings but in any colours: flame for nova (three ranks: outer flames cycling, gold, white-hot)
  function i4Wings(x, y, s, t, spread, flap, P3, T) {
    if (spread <= 0.02) return;
    const amp = flap === undefined ? 0.24 : flap, sh = fl(t * 12);
    glow(x, y - 8 * s, 80 * s * spread, T || T_NOVA, 0.4 * spread);
    for (const sd of [-1, 1]) {
      const beat = z5Beat(t) * amp, arm = -0.78 - beat + (1 - spread) * 1.3, ax = Math.cos(arm) * sd, ay = Math.sin(arm), Lw = 44 * s * (0.35 + 0.65 * spread);
      for (const [N, len, rank] of [[10, 1, 0], [8, 0.62, 1], [7, 0.36, 2]]) for (let j = N - 1; j >= 0; j--) {
        const u = (j + 0.6) / N, bx = x + ax * Lw * u, by = y + ay * Lw * u - Math.sin(u * PI) * 5 * s;
        const bu = z5Beat(t - 0.12 * u) * amp, fr = lerp(PI / 2 - 0.12, -0.15 - bu * 1.5, Math.pow(u, 1.25)) - (1 - spread) * 0.5, fa = sd > 0 ? fr : PI - fr;
        const fl_ = 1 + 0.12 * Math.sin(t * 23 + j * 1.7 + rank), L = s * (15 + 32 * u) * len * (0.45 + 0.55 * spread) * fl_, w = s * (4.6 - rank * 0.8);
        const fill = rank === 0 ? P3[0][(j + sh) % P3[0].length] : P3[1], rim = rank === 0 ? P3[2] : rank === 1 ? P3[0][0] : P3[1];
        z5Kite(bx - Math.cos(fa) * 1.2, by - Math.sin(fa) * 1.2, fa, L + 2.4, w + 1.1, rim);
        z5Kite(bx, by, fa, L, w, rank === 2 ? 22 : fill);
      }
    }
  }
  const NOVA_W = [[104, 105, 106, 105], 108, 107];
  // the hero in Zenith Nova: flame wings, the white-hot star body, a corona; returns the actor's { hand, tip }
  function i4Nova(x, y, S, t, o) {
    o = o || {};
    const wt = o.wt === undefined ? t * 1.3 : o.wt, sp = o.spread === undefined ? 1 : o.spread, bob = z5Bob(wt, S, o.flap || 0.3) * sp, ang = o.ang || 0;
    glow(x, y, 26 * S, T_NOVA, 0.45);
    i4Wings(x - Math.sin(ang) * 6 * S, y + bob - Math.cos(ang) * 6 * S, S * 0.62, wt, sp, o.flap || 0.3, NOVA_W);
    const a = actor(HERO3({ form: 'nova', eyes: o.eyes || 'glow', mouth: o.mouth, sword: o.sw === undefined ? null : o.sw, swordCols: [105, 106, 107, 106], sq: o.sq, flip: o.flip, cracks: o.cracks }), x, y, S, ang, !!o.flip, { bob, white: o.white, noSmear: o.noSmear });
    aura(t, NOVA_AURA, o.auraR || 4 * S, { sparks: o.sparks === undefined ? 16 : o.sparks, rise: 0.6 });
    return a;
  }
  const SKY_DARK = [96, 97, 98, 101];

  /* 21 — in the crater (0:41.2–0:44.5): near black. The sea filling back in; the hero half sunk in it, still; the four orbs
     barely alight, circling slowly. A trembling hand closes on the sword. "...not... yet..." */
  shot(41.2, 44.5, (lt, t) => {
    belowWorld(t, 120, 930, 0.2);
    tintAll(T_DARK, 0.6);
    const HX = 240, HY = 200, grip = eio(lin(2.2, 3.2, lt));
    for (let k = 0; k < 5; k++) { const r = 30 + k * 30 + frac(t * 0.3 + k * 0.2) * 30; ring(HX, HY + 8, r, r * 0.22, 115); }
    actor(HERO3({ eyes: lt > 1.4 && lt < 1.55 ? 'narrow' : 'closed', sword: lerp(0.9, 0.4, grip) + z5Sh(t, 3) * 0.05 * grip, swordCols: z5Sw(t * 0.2), cracks: 0.55, legs: [3, 3, 3, 3], sq: Math.sin(t * 1.6) * 0.04 }), HX, HY - 6, 3.0, 0.12, false, { still: true });
    // the water over its lower half
    for (let y = HY + 2; y < H - LB; y++) for (let x = HX - 70; x < HX + 70; x++) { const d = Math.abs(x - HX) / 70; if (y > HY + 2 + Math.sin(x * 0.2 + t * 2) * 1.5 + d * 4) { BUF[y * W + x] = (x + y) % 5 === 0 ? 116 : 115; tintI(y * W + x, x, y, T_DARK, 0.6 + d * 0.1); } }
    // the orbs, guttering
    for (let k = 0; k < 4; k++) { const a = t * 0.6 + k * TAU / 4, fl_ = 0.6 + 0.4 * Math.sin(t * 7 + k * 2); if (ih(k, fl(t * 10), 4401) < 0.85) orbAt(HX + Math.cos(a) * 34, HY - 10 + Math.sin(a) * 9, k, 2 * fl_, t); }
    for (let k = 0; k < 14; k++) { const g = frac(t * 0.12 + ih(k, 1, 4402)); P(HX - 120 + ih(k, 2, 4402) * 240, HY - g * 120, 121); }
    z5Cam(1.25 + 0.08 * eio(lt / 3.3), 0, HX, HY - 20, 240, 150);
    if (lt < 0.8) tintAll(T_DARK, 1 - eio(lt / 0.8));
  });
  CAPS.push([42.6, 44.4, 's', 'HERO', '...NOT... YET...']);

  /* 22 — the orbs come in (0:44.5–0:46): they flare, and dive into it one after another; the sea boils away round it;
     it rises out of the water, curls in on itself — gathering */
  shot(44.5, 46.0, (lt, t) => {
    belowWorld(t, 120, 930, 0.2);
    tintAll(T_DARK, 0.6 * (1 - sstep(0.4, 1.4, lt)));
    const HX = 240, rise = eio(lin(0.3, 1.2, lt)), HY = 194 - rise * 14 + z5Sh(t, 2) * 1.5 * rise, curl = sstep(1.15, 1.45, lt);
    // the sea pushed back: a ring of boiling water, steam
    const R = 30 + eio(clamp(lt / 1.5, 0, 1)) * 90;
    for (let a = 0; a < TAU; a += 0.02) { const x = HX + Math.cos(a) * R, y = HY + 14 + Math.sin(a) * R * 0.24; for (let q = 0; q < 6; q++) P(x, y - q, q > 4 ? 119 : 117); }
    for (let k = 0; k < 30; k++) { const g = frac(t * 0.8 + ih(k, 1, 4411)), a = ih(k, 2, 4411) * TAU, r = R * (0.3 + ih(k, 3, 4411) * 0.7); cloudPuff(HX + Math.cos(a) * r, HY + 14 + Math.sin(a) * r * 0.24 - g * 40, 3 + g * 6, [19, 20, 21, 22], 4412 + k); }
    glow(HX, HY, 40 + lt * 80, T_NOVA, 0.3 + lt * 0.3);
    actor(HERO3({ eyes: lt > 0.8 ? 'angry' : 'closed', mouth: lt > 1.2 ? 2 : 0, sword: lerp(0.4, -1.6, eio(clamp((lt - 0.6) / 0.6, 0, 1))), swordCols: z5Sw(t), cracks: 0.55 * (1 - sstep(0.5, 1.3, lt)), sq: 0.35 * curl, legs: rise > 0.5 ? undefined : [3, 3, 3, 3] }), HX, HY + curl * 4, 3.0, 0, false);
    // the orbs flare and dive in, each on its own spiral
    for (let k = 0; k < 4; k++) {
      const st = 0.15 + k * 0.22, u = eic(clamp((lt - st) / 0.55, 0, 1)); if (u >= 1) { const g = lt - st - 0.55; if (g < 0.2) glow(HX, HY, 50, EL_T[k], 0.7 * (1 - g / 0.2)); continue; }
      const a = t * 0.6 + k * TAU / 4 + u * 5, r = 34 * (1 - u), x = HX + Math.cos(a) * r, y = HY - 10 + Math.sin(a) * r * 0.5 - Math.sin(u * PI) * 20;
      for (let q = 1; q < 8; q++) { const u2 = eic(clamp((lt - st - q * 0.025) / 0.55, 0, 1)), a2 = t * 0.6 + k * TAU / 4 + u2 * 5, r2 = 34 * (1 - u2); rectF(HX + Math.cos(a2) * r2 - 1, HY - 10 + Math.sin(a2) * r2 * 0.5 - Math.sin(u2 * PI) * 20 - 1, 2, 2, ORB[k][q < 3 ? 2 : 1]); }
      orbAt(x, y, k, 2 + 4 * Math.min(1, lt * 2), t);
    }
    shk(1 + lt * 3);
    z5Cam(1.25 + 0.1 * eio(lt / 1.5), 0, HX, HY - 20, 240, 150);
  });

  /* 23 — ZENITH NOVA (0:46–0:47.6): a star goes off in the sea. White-hot, molten, flame for wings — and the sword GROWS:
     the blade racing out of the hilt up into the sky, ten times its length; then raised, back, back, for the stroke */
  shot(46.0, 47.6, (lt, t) => {
    belowWorld(t, 150, 930, 0.6);
    const HX = 240, HY = 190, g = lt;
    z5Sunburst(HX, HY, 16, t * 0.5, 30, 320 * eoc(clamp(g / 0.3, 0, 1)), 0.07, [104, 105, 106, 107, 108, 22]);
    // the sea flattened in a ring
    const R = 20 + eoc(clamp(g / 0.5, 0, 1)) * 300;
    for (let a = 0; a < TAU; a += 0.012) { const x = HX + Math.cos(a) * R, y = HY + 18 + Math.sin(a) * R * 0.2; for (let q = 0; q < 8 * (1 - g / 1.6); q++) P(x, y - q, q > 5 ? 22 : 119); }
    // the growth: out it races, up into the sky (0.2–1.0); then cocked back for the stroke (1.15–1.6)
    const grow = eoc(clamp((g - 0.45) / 0.65, 0, 1)), cock = eio(lin(1.18, 1.6, g));
    const swA = -PI / 2 + 0.18 - cock * 0.9;
    const a = i4Nova(HX, HY - 6 * eob(clamp(g / 0.4, 0, 1)), 2.6, t, { sw: swA, spread: eob(clamp(g / 0.4, 0, 1)), flap: 0.4, mouth: g < 0.6 ? 2 : 1, noSmear: true, sq: -0.1 * cock });
    if (grow > 0) {
      const tip = bigBlade(a.hand[0], a.hand[1], swA, 640, 5.5, t, { form: 'nova', grow, flare: 0.8, surge: true });
      for (let k = 0; k < 4; k++) { const f = frac(g * 2 + k / 4) * grow; shockRing(a.hand[0] + Math.cos(swA) * 640 * f, a.hand[1] + Math.sin(swA) * 640 * f, 14 * (1 - f) + 4, 6 * (1 - f) + 2, 2, [22, 108, 105], 1 - f); }
    }
    if (g < 0.03) impactFrame(HX, HY, 0);
    if (g < 0.2) tintAll(T_NOVA, 0.5 * (1 - g / 0.2));
    shk(g < 0.6 ? 7 * (1 - g / 0.6) : 2);
    // the camera is thrown back by it, and climbs the blade
    const pull = eoc(clamp(g / 1.0, 0, 1));
    z5Cam(lerp(1.35, 0.95, pull) + kick(g, [[0, 2]])[0], 0, HX, lerp(HY - 20, HY - 60, pull), 240, lerp(150, 175, pull));
  });
  FLASH_CUTS.push(46.0);
  CAPS.push([46.0, 46.85, 'x', '', 'ZENITH...', 92], [46.3, 46.85, 'x', '', 'NOVA!', 140]);

  /* the giant-blade fight, in one wide frame: the hero left, him right, the blade across the frame between them.
     BK: blade angle keys [time, angle, ease]; his body pushed back further with each blow that lands */
  function i4BladeFight(t, o) {
    belowWorld(t, 150, 930 + (o.pan || 0), 0.75);
    const S = 1.7, hx = o.hx, hy = o.hy;
    const sx = o.sx, sy = o.sy, ss = o.ss;
    const so = sunderer(sx, sy, ss, t, o.sun);
    const a = i4Nova(hx, hy, S, t, { sw: o.swA, spread: o.spread === undefined ? 1 : o.spread, flap: 0.4, mouth: o.mouth || 1, noSmear: true, ang: o.ang || 0 });
    const tip = bigBlade(a.hand[0], a.hand[1], o.swA, o.len || 430, 4.4, t, { form: 'nova', flare: 0.7, surge: true });
    if (o.trail) for (let q = 1; q <= 5; q++) { const aa = o.trail(q * 0.016); if (aa === undefined) continue; for (let r = 40; r < (o.len || 430); r += 3) P(a.hand[0] + Math.cos(aa) * r, a.hand[1] + Math.sin(aa) * r, q < 2 ? 108 : q < 4 ? 109 : 110); }
    return { a, so, tip };
  }

  /* 24 — the first blow that matters (0:47.6–0:48.4): the giant blade comes down; he blocks it with crossed arms — and for
     the first time he moves: shoved back, ploughing the sea; the stroke's force runs on past him, cleaving the sea in a line
     to the horizon */
  shot(47.6, 48.4, (lt, t) => {
    const back = eoc(clamp(lt / 0.5, 0, 1)) * 46, swA = lerp(-1.5, 0.12, eic(clamp(lt / 0.04, 0, 1)));
    const { so } = i4BladeFight(t, { hx: 100, hy: 176, swA, sx: 330 + back, sy: 82, ss: 0.95,
      sun: { eyes: 1.5, heat: 0.8, crown: 1, rage: 0.2, nod: 1, arms: [{ x: 30, y: 30, pose: 'fist', front: true, ang: -0.6 }, { x: -30, y: 36, pose: 'fist', front: true, ang: -2.4 }, { x: -96, y: 196, pose: 'open' }, { x: 96, y: 196, pose: 'open' }] },
      trail: (d) => lt - d < 0.04 ? lerp(-1.5, 0.12, eic(clamp((lt - d) / 0.04, 0, 1))) : undefined });
    // the cleave runs on: a trench torn in the sea from his feet to the horizon, walls of water either side
    const run = eoc(clamp(lt / 0.35, 0, 1));
    for (let q = 0; q < 120 * run; q++) { const u = q / 120, x = lerp(330 + back, 470, u), y = lerp(250, 152, u), h = (1 - u) * 26 * (1 - lt / 0.8); for (let k = 0; k < h; k++) { P(x - 6 * (1 - u), y - k, k > h - 3 ? 22 : 119); P(x + 6 * (1 - u), y - k, k > h - 3 ? 22 : 118); } P(x, y, 22); }
    // the wake behind him: the sea ploughed up
    rocks(330 + back + 40, 240, lt, 40, 220, 3, [117, 118, 119, 22], 4441, 260, -PI / 2 + 0.6, 1.4);
    megaHit(332 + back * 0.5, 130, lt, 2.4, 0.3, [22, 108, 105], 4442); if (lt < 0.5) frameCrack(332, 130, clamp(lt * 4, 0, 0.5) * (1 - sstep(0.3, 0.5, lt)), 4443, 90);
    shk(8 * Math.max(0, 1 - lt / 0.6));
    const [kz, kr, kx, ky] = kick(lt, [[0, 2, 0.2]]);
    z5Cam(1.04 + kz, kr, 250 - kx, 140 - ky, 240, 140);
  });
  FLASH_CUTS.push(47.6);

  /* 25 — the giant blade, again and again (0:48.4–0:50.4): a sweep from the left, a rising cut, an overhead; he blocks each
     with a different arm, and gives ground with every one */
  const GB = [48.6, 49.2, 49.8];
  shot(48.4, 50.4, (lt, t) => {
    const keys = [[48.4, 0.12], [48.45, 0.4], [48.56, -1.25, 'io'], [48.6, 0.55, 'i'], [48.9, 0.7, 'o'], [49.12, 1.25, 'io'], [49.2, -0.75, 'i'], [49.5, -1.0, 'o'], [49.7, -2.2, 'io'], [49.8, 0.25, 'i'], [50.4, 0.3, 'o']];
    const angAt = (tt) => { if (tt <= keys[0][0]) return keys[0][1]; for (let i = 1; i < keys.length; i++) if (tt < keys[i][0]) { const [t0, a0] = keys[i - 1], [t1, a1, e] = keys[i], u = (tt - t0) / (t1 - t0); return lerp(a0, a1, e === 'i' ? eic(u) : e === 'o' ? eoc(u) : eio(u)); } return keys[keys.length - 1][1]; };
    const swA = angAt(t), back = GB.reduce((s_, h) => s_ + (t > h ? 14 * eoc(clamp((t - h) / 0.3, 0, 1)) : 0), 46);
    // blocks: lower-left takes the sweep, upper-right the rising cut, the crossed upper pair the overhead
    const blk = (h) => sstep(h - 0.2, h - 0.05, t) * (1 - sstep(h + 0.3, h + 0.5, t));
    const b1 = blk(GB[0]), b2 = blk(GB[1]), b3 = blk(GB[2]);
    const hx = 100 + 10 * Math.sin(t * 2), hy = 176 - b3 * 10;
    i4BladeFight(t, { hx, hy, swA, pan: lt * 30, sx: 330 + back, sy: 82, ss: 0.95, ang: (swA > 0 ? 0.15 : -0.15),
      sun: { eyes: 1.5, heat: 0.85, crown: 1, rage: 0.25, nod: 1,
        arms: [{ x: lerp(-130, 0, b3), y: lerp(124, -10, b3), pose: 'fist', front: b3 > 0.1, ang: b3 > 0.1 ? -0.8 : undefined }, { x: lerp(132, -40, Math.max(b2, b3)), y: lerp(124, lerp(150, -4, b3 / Math.max(0.01, Math.max(b2, b3))), Math.max(b2, b3)), pose: 'fist', front: Math.max(b2, b3) > 0.1 }, { x: lerp(-96, -150, b1), y: lerp(196, 130, b1), pose: b1 > 0.3 ? 'open' : 'fist', front: b1 > 0.1 }, { x: 96, y: 196, pose: 'open' }] },
      trail: (d) => angAt(t - d) });
    const CP = [[300, 150], [300, 196], [318, 100]];
    GB.forEach((h, k) => megaHit(CP[k][0] + back - 46, CP[k][1], t - h, 2.2, [PI, PI / 2 + 0.5, -PI / 2 - 0.2][k] + PI, [22, 108, 105], 4451 + k));
    const [kz, kr, kx, ky] = kick(t, GB.map((h, k) => [h, 1.3, k * 1.3]));
    shk(GB.some((h) => t > h && t < h + 0.25) ? 6 : 1.5);
    z5Cam(1.04 + kz, kr, 260 - kx, 140 - ky, 240, 140);
  });

  /* 26 — it gets through (0:50.4–0:51.4): a diagonal stroke past his guard; a burning wound opens across his chest; he
     staggers back — and for the first time, something in the mask that might be pain */
  shot(50.4, 51.4, (lt, t) => {
    belowWorld(t, 130, 960, 0.8);
    const h = 0.2, g = lt - h, cut = eoc(clamp(g / 0.08, 0, 1)), stag = g > 0 ? eoc(clamp(g / 0.45, 0, 1)) : 0;
    const W1 = [WOUND1[0], WOUND1[1], lerp(WOUND1[0], WOUND1[2], cut), lerp(WOUND1[1], WOUND1[3], cut), WOUND1[4]];
    const so = sunderer(300 + stag * 24, 70 - stag * 4, 1.3, t, { eyes: 1.4 + (g > 0 ? 0.5 * Math.exp(-g * 3) : 0), heat: 0.9, crown: 1, rage: g > 0 ? 0.5 : 0.2, roar: g > 0 ? 0.6 * Math.exp(-g * 2) * (1 - Math.exp(-g * 20)) : 0, tilt: -0.08 * stag, nod: -2 * stag,
      wounds: g > 0 ? [W1] : [], arms: [{ x: -132, y: 60 - stag * 30, pose: 'open' }, { x: 132, y: 100, pose: 'fist' }, { x: -96, y: 196, pose: 'open' }, { x: 96, y: 196, pose: 'fist' }] });
    // the blade: in from off the left, cutting down through him
    const swA = lerp(-0.95, 0.55, eic(clamp((lt - h + 0.06) / 0.08, 0, 1))) + (g > 0 ? 0.25 * eoc(clamp(g / 0.3, 0, 1)) : 0);
    bigBlade(-40, 100, swA, 520, 5, t, { form: 'nova', flare: 0.8 });
    if (g > 0) { const sx = 300 + stag * 24 + lerp(WOUND1[0], WOUND1[2], 0.5) * 1.3, sy = 70 + lerp(WOUND1[1], WOUND1[3], 0.5) * 1.3; rocks(sx, sy, g, 34, 240, 3, [102, 104, 105, 107], 4461, 240, 0.4, 2); megaHit(sx, sy, g, 2.6, 0.4, [22, 107, 104], 4462); }
    shk(g > 0 ? 7 * Math.exp(-g * 3) : 1);
    const [kz, kr] = kick(lt, [[h, 1.8]]);
    z5Cam(1.06 + kz, kr, 280, 130, 240, 135);
  });

  /* 27 — the upward cut (0:51.4–0:52.8): from under his guard; a gauntlet thrown up and back, blades blown out of his crown */
  shot(51.4, 52.8, (lt, t) => {
    belowWorld(t, 140, 980, 0.8);
    const h = 0.2, g = lt - h, up = g > 0 ? eoc(clamp(g / 0.3, 0, 1)) : 0;
    const crown = 1 - 0.25 * up;
    sunderer(320, 84, 1.1, t, { eyes: 1.6, heat: 0.9, crown, rage: 0.5, roar: 0.3 * up, nod: -1.5 * up, tilt: 0.06 * up,
      wounds: [WOUND1], arms: [{ x: lerp(-40, -140, up), y: lerp(40, -90, up), pose: 'open', front: true }, { x: 132, y: 100, pose: 'fist' }, { x: -96, y: 196, pose: 'fist' }, { x: 96, y: 196, pose: 'fist' }] });
    // crown blades flying off
    if (g > 0) rocks(320, 40, g, 9, 260, 6, [96, 97, 101, 103], 4471, 200, -PI / 2, 1.6);
    const swA = lerp(1.0, -1.25, eic(clamp((lt - h + 0.05) / 0.07, 0, 1))) - (g > 0 ? 0.25 * eoc(clamp(g / 0.4, 0, 1)) : 0);
    const a = i4Nova(130, 200, 1.9, t, { sw: swA, spread: 0.9, flap: 0.4, mouth: 2, noSmear: true, ang: -0.2 });
    bigBlade(a.hand[0], a.hand[1], swA, 420, 4.6, t, { form: 'nova', flare: 0.8 });
    megaHit(270, 120, g, 2.4, -PI / 2 - 0.3, [22, 108, 105], 4472);
    shk(g > 0 ? 6 * Math.exp(-g * 3) : 1);
    const [kz, kr] = kick(lt, [[h, 1.5]]);
    z5Cam(1.04 + kz, kr, 240, 140, 240, 140);
  });

  /* 28 — the thrust (0:52.8–0:54): it lunges with everything, the giant blade straight out: through his shoulder, and on,
     driving him back into a spire, pinning him there */
  shot(52.8, 54.0, (lt, t) => {
    belowWorld(t, 140, 1000, 0.8);
    const h = 0.4, g = lt - h, coil = eio(clamp(lt / 0.3, 0, 1)) * (g < 0 ? 1 : 0), lunge = g > -0.06 ? eic(clamp((g + 0.06) / 0.06, 0, 1)) : 0;
    const pin = g > 0 ? eoc(clamp(g / 0.15, 0, 1)) : 0, SX = 340 + pin * 30;
    // the spire behind him; it cracks when he hits it
    for (let q = 0; q < 210; q++) { const w = 70 * (1 - q / 260); thick(420 - w / 2, 250 - q, 420 + w / 2, 250 - q, 2, q % 37 < 2 ? 102 : g > 0.15 && Math.abs((q * 7) % 53 - 26) < 1 ? 104 : q < 120 ? 98 : 99); }
    sunderer(SX, 78, 1.0, t, { eyes: 1.6, heat: 0.9, crown: 0.75, rage: 0.6, roar: g > 0 ? 0.7 * Math.exp(-g * 2) : 0, tilt: 0.1 * pin, wounds: g > 0 ? [WOUND1, WOUND2] : [WOUND1],
      arms: [{ x: -130, y: 80, pose: 'open' }, { x: 140, y: 60 + pin * 30, pose: 'open' }, { x: -96, y: 196, pose: 'fist' }, { x: 110, y: 190, pose: 'open' }] });
    const hx = lerp(110 - coil * 20, 200, lunge), hy = 170;
    const a = i4Nova(hx, hy, 2.0, t, { sw: -0.08, spread: 0.6 + 0.4 * lunge, flap: 0.4, mouth: 2, noSmear: true, sq: 0.3 * coil - 0.2 * lunge });
    bigBlade(a.hand[0], a.hand[1], -0.12, 460, 4.8, t, { form: 'nova', flare: 0.8 });
    if (g > 0) { megaHit(SX + 74, 120, g, 2.4, -0.1, [22, 108, 105], 4481); rocks(430, 120, g, 30, 180, 5, [97, 98, 99, 104], 4482, 200, 0, 2); }
    shk(g > 0 ? 8 * Math.exp(-g * 3) : coil * 1.5);
    const [kz, kr, kx] = kick(lt, [[h, 2, 0]]);
    z5Cam(1.05 + kz, kr, 270 - kx, 140, 240, 140);
  });
  FLASH_CUTS.push(53.2);

  /* 29 — he laughs (0:54–0:55.6): pinned, he laughs; a hand closes round the blade, and he draws it back out of himself,
     slowly, the hero dragged along the length of its own sword */
  shot(54.0, 55.6, (lt, t) => {
    belowWorld(t, 140, 1000, 0.8);
    const draw = eio(clamp((lt - 0.4) / 1.1, 0, 1)), laugh = [0.1, 0.35, 0.6].reduce((s_, h) => s_ + Math.max(0, Math.sin(PI * clamp((lt - h) / 0.2, 0, 1))), 0);
    const SX = 370;
    for (let q = 0; q < 210; q++) { const w = 70 * (1 - q / 260); thick(420 - w / 2, 250 - q, 420 + w / 2, 250 - q, 2, q % 37 < 2 ? 102 : q < 120 ? 98 : 99); }
    const so = sunderer(SX, 78, 1.0, t, { eyes: 1.4, heat: 0.9, crown: 0.75, rage: 0.4, roar: 0.25 + laugh * 0.3, nod: -laugh * 2, wounds: [WOUND1, WOUND2],
      arms: [{ x: lerp(-60, -150, draw), y: lerp(30, 40, draw), pose: 'grab', front: true, ang: 0 }, { x: 140, y: 90, pose: 'fist' }, { x: -96, y: 196, pose: 'fist' }, { x: 110, y: 190, pose: 'open' }] });
    const hx = 200 - draw * 70, hy = 170 + z5Sh(t, 4) * 2;
    const a = i4Nova(hx, hy, 2.0, t, { sw: -0.08, spread: 0.7, flap: 0.6, mouth: 2, noSmear: true, sq: -0.15 + z5Sh(t * 2, 3) * 0.08 });
    bigBlade(a.hand[0], a.hand[1], -0.12, 460 - draw * 70, 4.8, t, { form: 'nova', flare: 0.6 });
    // the molten blood running out of the hole as the blade comes out
    for (let k = 0; k < 10; k++) { const g = frac(t * 1.4 + ih(k, 1, 4491)); rectF(SX + 74 + (ih(k, 2, 4491) - 0.5) * 10, 120 + g * 90, 2, 3, g < 0.5 ? 105 : 103); }
    shk(1 + laugh * 2);
    z5Cam(1.05, 0, 280, 140, 240, 140);
  });

  /* 30 — his brother's eye (0:55.6–0:58): close. The fist with the shard comes up to his brow and presses it in. It sinks
     into him; a spiral eye opens in his forehead. "Brother. See this." */
  shot(55.6, 58.0, (lt, t) => {
    gradient(LB, H - LB, [96, 97, 98, 101, 70]);
    const MX = 240, MY = 150, s = 3.2, press = eio(clamp(lt / 0.25, 0, 1)), sink = eic(clamp((lt - 0.2) / 0.3, 0, 1)), open = eob(clamp((lt - 0.4) / 0.4, 0, 1));
    const away = eio(clamp((lt - 0.55) / 0.5, 0, 1));
    const o = sunderer(MX, MY, s, t, { eyes: 1.4 + open * 0.4, heat: 1, crown: 0.75, rage: 0.4 + open * 0.3, third: open, body: false, nod: lerp(-1, 1, open) });
    // the fist, coming up to the brow and away again
    const fx = MX + 30 * s - press * 22 * s + away * 30 * s, fy = MY + 20 * s - press * 30 * s + away * 30 * s;
    if (sink < 1) { z5MaskShard(fx - 10 * s, fy - 12 * s, 1.6 * (1 - sink * 0.8), 0.4, 1, 0, t); glow(fx - 10 * s, fy - 12 * s, 60, T_MAG, 0.6); }
    sGauntlet(fx + 10 * s, fy + 14 * s, s * 0.9, -PI * 0.75, 'fist', 1, t);
    if (lt > 0.4) { const g = lt - 0.4; shockRing(o.brow[0], o.brow[1], 6 + g * 500, 4 + g * 300, 4, [75, 73, 104], 1 - g / 0.6); glow(o.brow[0], o.brow[1], 90 * Math.exp(-g * 2), T_MAG, 0.6); if (g < 0.03) tintAll(T_MAG, 0.45); }
    shk(lt > 0.4 && lt < 1 ? 5 * (1 - (lt - 0.4) / 0.6) : 0.8);
    z5Cam(1.02 + 0.04 * eio(lt / 2.4), 0, 240, 135);
  });
  FLASH_CUTS.push(55.6);
  CAPS.push([56.4, 57.95, 's', 'SUNDERER', 'BROTHER. SEE THIS.']);
  }
