  /* ---------------------------------------------------------------- the Hush: a crown of glyphs, and what it erases */
  // a glyph tile: a 5×5 mark from a small alphabet of strokes, white with a pale shadow
  const GLY = ['#.#.#|.#.#.|#.#.#|.....|#####', '#####|#...#|#.#.#|#...#|#####', '..#..|.###.|#####|.###.|..#..', '#...#|.#.#.|..#..|.#.#.|#...#', '###..|#.#..|###.#|....#|..###', '.###.|#...#|.....|#...#|.###.'].map((g) => g.split('|'));
  function glyph(x, y, k, sc, c, c2) { const g = GLY[k % GLY.length]; for (let j = 0; j < 5; j++) for (let i = 0; i < 5; i++) if (g[j][i] === '#') { rectF(x + i * sc, y + j * sc, sc, sc, c); if (c2 !== undefined) rectF(x + i * sc + sc, y + j * sc + sc, sc, 1, c2); } }
  // the sigil: rings of glyph tiles on a tilted ellipse, turning; r is the radius, a 0..1 how much has appeared
  function sigil(cx, cy, r, tilt, t, a, seed) {
    if (a <= 0) return;
    glow(cx, cy, r * 1.25, tab('#e8ecff', true), 0.28 * a);
    for (let ring_ = 0; ring_ < 2; ring_++) {
      const rr = r * (1 - ring_ * 0.3), n = fl(8 + rr * 0.09) * 2, rot = t * (ring_ & 1 ? -0.12 : 0.08) + ring_;
      // a thin line joining the tiles
      for (let q = 0; q < 720; q++) { if (ih(q, ring_, seed + 1) > a) continue; const an = q / 720 * TAU; put(fl(cx + Math.cos(an) * rr), fl(cy + Math.sin(an) * rr * tilt), Math.sin(an) > 0 ? C('hush', 5) : C('hush', 3)); }
      for (let k = 0; k < n; k++) {
        if (ih(k, ring_, seed) > a * 1.2) continue;
        const ang = k / n * TAU + rot, x = cx + Math.cos(ang) * rr, y = cy + Math.sin(ang) * rr * tilt, sc = Math.max(1, Math.round(rr / 70 * (0.75 + 0.35 * Math.sin(ang))));
        glyph(fl(x - sc * 2.5), fl(y - sc * 2.5), k + ring_ * 7 + seed, sc, k % 5 === 2 ? C('crimson', 5) : WHITE, C('hush', 3));
      }
    }
  }
  // erase: wherever amt(x, y) ≥ 0.85 the picture loses its colour and becomes a pale unpainted sketch of itself
  // (its edges kept as faint lines); in between it washes toward white; flecks of crimson glyph-dust on the boundary
  const HUB = new Uint8Array(NP);
  function hush(amt, t, flecks) {
    HUB.set(BUF);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const a = amt(x, y); if (a <= 0) continue;
      const i = y * W + x, l = LUM[HUB[i]];
      if (a >= 0.85) {
        const lr = x < W - 1 ? LUM[HUB[i + 1]] : l, ld = y < H - 1 ? LUM[HUB[i + W]] : l, e = Math.max(Math.abs(l - lr), Math.abs(l - ld));
        BUF[i] = e > 60 ? C('hush', e > 110 ? 1 : 3) : cel(R.hush, 3.2 + l / 255 * 4.6, x, y);
      } else tintI(i, x, y, tab('#f4f6fc', true), a * 0.9);
      if (flecks !== false && a > 0.3 && a < 0.85 && ih(x >> 1, y >> 1, fl(t * 14)) < 0.035) BUF[i] = ih(x, y, 3) < 0.6 ? WHITE : C('crimson', 5);
    }
  }
  // glyph dust: tiles flying up and away from a point (a figure coming apart), age g in seconds
  function glyphDust(x, y, g, n, spread, seed) {
    for (let k = 0; k < n; k++) {
      const a = -PI / 2 + (ih(k, 1, seed) - 0.5) * 2.2, v = 20 + ih(k, 2, seed) * 50, d = v * g;
      const px = x + (ih(k, 3, seed) - 0.5) * spread + Math.cos(a) * d - g * g * 18, py = y + (ih(k, 4, seed) - 0.5) * spread * 1.6 + Math.sin(a) * d;
      if (ih(k, 5, seed) > 1.4 - g) continue;
      if (ih(k, 6, seed) < 0.25) glyph(fl(px), fl(py), k, 1, WHITE); else rectF(fl(px), fl(py), 2, 2, ih(k, 7, seed) < 0.8 ? WHITE : C('crimson', 5));
    }
  }

  // 5b — up at the sky (0:32): the clouds part and a crown of glyphs opens over the shrine
  shot(32.4, 36.0, (lt, t) => {
    vgrad(0, H, R.night, 0.6, 2.2);
    const op = eoc(lin(0.2, 3, lt));
    cloudBank(80 - op * 30, 12, 6, R.night, 2.2, 3, FREEZE, 0); cloudBank(200 + op * 30, 14, 6, R.dusk, 1.4, 9, FREEZE, 0);
    sigil(240, 128, 30 + op * 120, 0.42, t, lin(0, 2.4, lt), 161);
    // the shrine's eave at the bottom of the frame, black against it, and the rain hanging in the air
    for (let x = 0; x < W; x++) { const top = 236 - Math.pow(Math.abs(x - 240) / 240, 2) * 18; for (let y = fl(top); y < H; y++) BUF[y * W + x] = cel(R.ink, y - top < 2 ? 2 : 0.6, x, y); }
    rain(t, 260, 0.18, undefined, FREEZE);
    shk(0.5 * lin(0, 2, lt));
  });

  // 6 — the King on the ridge, his back to us, the crown above him (0:36): "hush now"
  // the Hollow King, from behind: a tall cloak that flares to a tattered hem stirring in a wind that isn't there,
  // a deep hood, a collar trimmed with white glyphs, long sleeves with pale hands hanging out of them; his crown floats above
  function king(x, y, s, t, pulse) {
    sclear(); LIGHTS.x = 0; LIGHTS.y = -1;
    const sw = Math.sin(t * 0.9) * 2, ink = (v) => band(R.ink, v);
    // the cloak: folds as darker vertical bands, lit along the shoulders from the crown above
    sPoly([[-11, -96], [11, -96], [22 + sw, -8], [-24 + sw * 1.3, -8]], (xx, yy) => ink(1.2 + (frac((xx + 30) / 6 + yy * 0.01) < 0.22 ? -0.7 : 0) + (yy < -88 ? 1.4 : 0)));
    // the tattered hem: strips of different length, each fluttering on its own
    for (let k = 0; k < 12; k++) { const hx = -23 + k * 4 + sw * 1.2, len = 6 + ih(k, 1, 71) * 10, fl_ = Math.sin(t * 2.4 + k * 1.3) * 2; sPoly([[hx, -9], [hx + 4, -9], [hx + 3 + fl_, -9 + len], [hx + 1 + fl_ * 1.2, -9 + len + 2]], ink(0.9)); }
    // sleeves and long pale hands
    for (const side of [-1, 1]) {
      sPoly([[side * 10, -92], [side * 17, -64], [side * 18, -42], [side * 12, -44], [side * 8, -70]], ink(1.6));
      sEll(side * 15, -42, 2.2, 2.2, band(R.hush, 3)); for (let f = 0; f < 3; f++) sLock(side * 14 + f * side * 1.2, -41, side * 14 + f * side * 1.6 + Math.sin(t + f) * 0.6, -31 - (f === 1 ? 2 : 0), 0, 0.5, R.hush, 3, false);
    }
    // the collar's glyph trim and the hood
    for (let k = 0; k < 9; k++) { const cx = -10 + k * 2.5; sp(cx, -95 + (k % 2), C('snow', 7), 1); sp(cx + 1, -95, C('hush', 5), 1); }
    sEll(0, -104, 10, 11, (xx, yy, u, v) => ink(1.2 + (v < -0.5 ? 1.4 : 0) - (Math.abs(u) < 0.1 && v > -0.2 ? 0.6 : 0)));
    sPoly([[-3, -115], [3, -115], [0, -121]], ink(1.6));          // the hood's peak
    soutline(C('hush', 5)); stamp(x, y, s, false);
    // the crown: glyph tiles in a slow ring, brightening (and some turning red) as he speaks
    const cy = y - 136 * s;
    for (let k = 0; k < 14; k++) { const a = k / 14 * TAU + t * 0.4, gx = x + Math.cos(a) * 20 * s, gy = cy + Math.sin(a) * 5 * s; if (Math.sin(a) < -0.2) { rectF(fl(gx), fl(gy), s, s, C('hush', 3)); continue; } glyph(fl(gx - 2.5 * s), fl(gy - 2.5 * s), k, s, pulse > 0.5 && k % 3 === 0 ? C('crimson', 6) : WHITE); }
    glow(x, cy, 30 * s, tab('#e8ecff', true), 0.25 + pulse * 0.25);
  }
  shot(36.0, 41.0, (lt, t) => {
    vgrad(0, H, R.night, 0.5, 1.8);
    sigil(250, 46, 150, 0.28, t, 1, 161);
    // the valley far below: the village's lights, small, in the rain
    ridge(170, 20, 60, 3, R.night, 1.2, 23, 0.6);
    for (let k = 0; k < 90; k++) { const x = 60 + ih(k, 1, 31) * 360, y = 176 + ih(k, 2, 31) * 30; if (ih(k, 3, 31) < 0.6) put(fl(x), fl(y), C('fire', ih(k, 4, 31) < 0.5 ? 5 : 4)); }
    // the ridge he stands on, black rock with a wet lit edge
    for (let x = 0; x < W; x++) { const top = 214 + Math.sin(x * 0.03) * 8 + vn(x, 0, 14, 41) * 10 - Math.max(0, 40 - Math.abs(x - 250)) * 0.35; for (let y = fl(top); y < H; y++) BUF[y * W + x] = cel(R.ink, y - top < 1.5 ? 2.4 : 0.6 + vn(x, y, 6, 42) * 0.6, x, y); }
    const pulse = talking('king', t) ? 1 : 0;
    rays(250, 46, 7, 220, tab('#c8d4ff', true), 0.22, t, 5);
    king(250, 216, 1, t, pulse);
    rain(t, 160, 0.18, undefined, FREEZE);
    view(250, lerp(132, 126, lt / 5), lerp(1.0, 1.25, eio(lt / 5)));
  });

  // 7 — the wave (0:41): the crown comes down over the village, and everything it touches goes blank
  const WAVE0 = 41.4;
  shot(41.0, 48.0, (lt, t) => {
    vgrad(0, 120, R.night, 0.6, 2.2);
    sigil(240, 40, 200, 0.25, t, 1, 161);
    ridge(118, 30, 70, 4, R.night, 1.3, 11, 0.8);
    // the whole village, terrace on terrace down the hill toward us
    for (let row = 0; row < 7; row++) {
      const yb = 120 + row * 22, sh = -1 + row * 0.25, w0 = 16 + row * 7;
      for (let y = yb; y < yb + 30; y++) for (let x = 0; x < W; x++) BUF[y * W + x] = cel(R.ink, 1.4 + sh * 0.5 + (y - yb) / 50, x, y);
      for (let k = 0; k < 30; k++) { const x = -12 + k * w0 * 1.25 + (row % 2) * w0 * 0.6 + ih(k, row, 61) * 6, w = w0 * (0.8 + ih(k, row, 62) * 0.4); if (x > W + 20) break; if (ih(k, row, 63) < 0.18) { fillEll(x, yb - w * 0.3, w * 0.38, w * 0.38, 0, (xx, yy, u, v) => cel(R.moss, 0.5 + sh * 0.4 - v * 0.6, xx, yy)); continue; } house(x, yb, w, w * 0.45, w * 0.27, { seed: k + row * 31, shade: sh, lit: 0.6 }); }
    }
    for (const [lx, ly] of LAMPS) if (ih(lx, ly, 9) < 0.04) glow(lx, ly, 6, tab('#ff9a40', true), 0.22);
    rain(t, 240, 0.18, undefined, FREEZE);
    // the ring drops onto the village: a white ring spreading out from the top of the hill, erasing as it goes
    const R0 = Math.max(0, (t - WAVE0) * 80), cx = 240, cy = 100;
    hush((x, y) => { const d = Math.hypot(x - cx, (y - cy) * 2.2); return d < R0 - 10 ? 1 : d < R0 ? 0.6 : 0; }, t);
    for (let k = 0; k < 120; k++) { const a = k / 120 * PI + PI * 0, d = R0; const x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d / 2.2; if (y > 100 && y < H) glyph(fl(x - 2), fl(y - 2), k, 1, ih(k, fl(t * 12), 5) < 0.75 ? WHITE : C('crimson', 5)); }
    shk(1.2);
  });

  // 8 — the name on the wall goes blank (0:48)
  shot(48.0, 51.0, (lt, t) => {
    // wet planks in close-up, lantern light from the left, the chalk letters, and the white creeping in from the right
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const u = x + y * 0.05, plank = fl(u / 46), seam = frac(u / 46) < 0.04, grain = vn(u * 0.3, y * 0.05 + plank * 50, 3, 133); BUF[y * W + x] = cel(R.wood, 1.4 + grain * 1.4 + (ih(plank, 1, 134) - 0.5) * 0.6 - (seam ? 1.2 : 0) + Math.max(0, 1 - x / 300) * 1.2, x, y); }
    for (let k = 0; k < 24; k++) { const x = 20 + ih(k, 1, 135) * 440, sp_ = 30 + ih(k, 2, 135) * 50, y0 = (FREEZE * sp_ + ih(k, 3, 135) * 400) % 300 - 20; for (let j = 0; j < 12; j++) put(fl(x), fl(y0 + j), j < 3 ? C('sky', 5) : C('wood', 4)); }
    const sc = 8, s = 'MIRA', w = textWidth(s, sc), x0 = 240 - w / 2, y0 = 100, er = lin(0.9, 2.9, lt);
    text(s, x0, y0, (i, j, k) => { const gone = ih(i + k * 7, j, 140) < er * 1.4 - k * 0.15; if (gone) return -1; return ih(i * 3 + k, j * 5, 141) < 0.12 ? C('hush', 4) : WHITE; }, sc);
    // a little heart she drew after it
    if (er < 0.8) for (const [i, j] of [[0, 1], [1, 0], [2, 1], [3, 0], [4, 1], [0, 2], [4, 2], [1, 3], [3, 3], [2, 4]]) rectF(x0 + w + 16 + i * 5, y0 + 14 + j * 5, 4, 4, C('hush', 6));
    glyphDust(x0 + w * 0.3, y0 + 30, lt * 0.8, fl(er * 60), 140, 142);
    hush((x, y) => clamp((x - W + Math.max(0, lt - 0.6) * 170) / 60, 0, 1), t);
  });

  // 9 — Mira turns toward the light: "Sable...?" (0:51); a cold white light comes over her from the left
  shot(51.0, 55.0, (lt, t) => {
    const o = { freeze: FREEZE, fire: 0.5 }, turn = sstep(0.5, 0.9, lt);
    closeBg(() => shrineStage(t, o), 250, 168, 3, 3);
    hush((x, y) => clamp((lt - 0.8) * 0.3 - x / W * 0.8 + 0.2, 0, 0.75), t);
    LIGHT.x = turn > 0.5 ? -1 : 1; LIGHT.y = -0.2; ENV.edge = turn > 0.5 ? C('hush', 6) : C('fire', 5);
    bust('mira', { t, face: { eyes: lt > 1.4 ? 'wide' : 'open', brows: 'worried', mouth: mouth('mira', t), smile: -0.2, blush: 1, tear: lt > 2.3, look: turn > 0.5 ? 1 : 0 }, headX: Math.round(turn * -1) }, 236 - Math.round(lt * 2), H - 22 + 6, 3, turn > 0.5 ? -1 : 1);
    ENV.edge = null;
    nearRain(t, 50, FREEZE);
    glow(0, 120, 260, tab('#eef1fb', true), 0.15 + lt * 0.08);
  });

  // 10 — her hand in Sable's; the white reaches her; she comes apart into glyphs and is gone (0:55)
  const HIT = 58.2;
  shot(55.0, 60.0, (lt, t) => {
    const o = { freeze: FREEZE, fire: t < HIT ? 0.4 : 0 }, g = t - HIT;
    shrineStage(t, o);
    const reach = sstep(0.2, 0.9, lt);
    sable(t, { hip: lerp(-15, -20, reach), lean: reach * 3, legs: [{ knee: [9, -9 - reach * 3], foot: [9, 0] }, { knee: [-3, -1], foot: [-13, -1] }], face: { eyes: g > 0 ? 'wide' : 'narrow', brows: 'worried', mouth: mouth('sable', t) }, arms: [{ hand: [lerp(10, 24, reach), lerp(-17, -24, reach)] }, { hand: [5, -16] }], propFar: kneelSword }, SABLE_X, FLOOR);
    if (g < 1.2) {
      const MP = { hip: -16, face: { eyes: g > 0.1 ? 'closed' : 'wide', brows: 'worried', mouth: 0.3, blush: 1 }, arms: [{ a: 1.5, b: 0.1 }, { a: 0.3, b: 0.4 }], legs: [{ foot: [3, 0] }, { foot: [-3, 0] }], lamp: g < 0 };
      if (g <= 0) mira(t, MP, MIRA_X, FLOOR + 2, 1, 1);
      else { LIGHT.x = 1; LIGHT.y = -0.3; actor(MIRA, Object.assign({ t }, MP), MIRA_X, FLOOR + 2, 1, 1, { fx: (c, x, y) => (ih(x, y, fl(t * 20)) < g * 1.1 ? -1 : LUM[c] > 90 ? WHITE : C('hush', 3)) }); }
    }
    if (g > 0) glyphDust(MIRA_X, FLOOR - 18, g, 140, 20, 181);
    shrineAfter(t, o);
    // the white wall coming up the steps behind her, then over her
    const front = W * 0.15 + clamp((lt - 0.8) / (HIT - 55.8), 0, 1) * (MIRA_X - W * 0.15 + 4);
    hush((x, y) => (Math.hypot(x - SABLE_X, y - 190) < 26 && g > 0 ? 0 : x < front - 10 ? 1 : x < front ? 0.6 : 0), t);
    view(252, 188, 3);
    if (g > 0 && g < 0.1) flash(0.8);
    shk(g > 0 ? 3 * Math.exp(-g * 3) : lin(1, 3, lt) * 1.2);
  });

  // 11 — the scream (1:00): close on Sable as the white closes round her
  shot(60.0, 65.0, (lt, t) => {
    const o = { freeze: FREEZE, fire: 0 };
    closeBg(() => shrineStage(t, o), 250, 168, 3, 3);
    const scream = lt > 0.35 && lt < 1.75;
    LIGHT.x = -1; LIGHT.y = -0.3; ENV.edge = C('hush', 6);
    const sh = scream ? Math.round((ih(fl(t * 30), 1, 7) - 0.5) * 3) : 0;
    bust('sable', { t, wind: scream ? 2 : 0, face: { eyes: scream ? 'shut' : lt < 0.35 ? 'wide' : 'sad', brows: 'worried', scream, mouth: mouth('sable', t), tear: lt > 1.8 }, headY: scream ? -1 : 0 }, 244 + sh, H - 22 + 6, 3, -1);
    ENV.edge = null;
    // the white closes in round her, its edge ragged with glyph-dust
    hush((x, y) => { const d = Math.hypot(x - 244, (y - 140) * 1.05) + (vn(Math.atan2(y - 140, x - 244) * 8 + 20, lt * 2, 1, 191) - 0.5) * 18; const r0 = 190 - lt * 32; return d > r0 ? 1 : d > r0 - 10 ? 0.6 : 0; }, t);
    if (scream) shk(2.5);
    flash(lin(1.9, 2.7, lt));
    if (lt > 2.7) { BUF.fill(WHITE); for (let k = 0; k < 60; k++) { const x = ih(k, 1, 191) * W, y = (ih(k, 2, 191) * H - (lt - 2.7) * 20 * (1 + ih(k, 3, 191)) + H) % H; put(fl(x), fl(y), C('hush', 3)); } tintAll(tab('#8a90a0'), lin(3.4, 5, lt) * 0.6); }
  });
