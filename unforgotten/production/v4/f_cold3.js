  /* ================================================================ COLD OPEN, the end: what is left, the oath, the title */
  // the shrine after the Hush: the same place drained to a pale sketch, the rain gone, only the embers keep their colour
  function drainedShrine(t) {
    shrineStage(t, { freeze: FREEZE, fire: 0 });
    hush(() => 1, t, false);
    // the embers in the bowl, the one warm thing left
    fillEll(FIRE[0], FIRE[1] - 1, 10, 2, 0, (x, y, u) => cel(R.ember, 2.4 + (1 - Math.abs(u)) * 2 + ih(x, y, fl(t * 5)) * 1.4, x, y));
    glow(FIRE[0], FIRE[1] - 2, 18, tab('#ff8030', true), 0.35 + Math.sin(t * 3) * 0.05);
  }
  // 12 — after (1:05): Sable alone on her knees by the cold fire; she reaches into the embers and draws the sword — it burns
  const DRAW = 69.0;
  shot(65.0, 74.0, (lt, t) => {
    drainedShrine(t);
    const g = t - DRAW, reach = sstep(-1.4, -0.3, g), pull = sstep(0, 0.35, g), rise = sstep(0.9, 1.9, g), burn = g > 0.15;
    // where the blade lies across the bowl, and then in her hand, burning
    const kneel = { hip: lerp(-15, -30, rise), lean: lerp(2, 0, rise) + reach * 2, legs: rise > 0.5 ? [{ foot: [5, 0] }, { foot: [-6, 0] }] : [{ knee: [9, -9], foot: [9, 0] }, { knee: [-3, -1], foot: [-13, -1] }] };
    LIGHT.x = -1; LIGHT.y = -0.3; ENV.edge = burn ? C('fire', 5) : C('hush', 6);
    const hand = g < 0 ? [lerp(8, 24, reach), lerp(-16, -8, reach)] : [lerp(24, 10, pull), lerp(-8, -24 - rise * 6, pull)];
    actor(SABLE, Object.assign({ t, wind: burn ? 1.5 : 0, face: { eyes: burn ? 'narrow' : g > -1.5 ? 'half' : 'closed', brows: burn ? 'angry' : 'worried', tear: !burn }, arms: [{ hand }, { hand: [4, -16 - rise * 10] }],
      prop: g < 0 ? undefined : (A) => swordArt(A.hand[0], A.hand[1], lerp(-PI / 2 - 0.4, 0.15, pull), 28, burn) }, kneel), SABLE_X - 18, FLOOR, 1, -1);
    ENV.edge = null;
    if (g < 0) { for (let u = 0; u < 28; u++) put(FIRE[0] - 14 + u, FIRE[1] - 3, u > 22 ? C('crimson', 3) : C('stone', 4)); }
    if (burn) {
      // the blade catches: fire runs up it, sparks, and the colour comes back into the world around it
      const r = Math.min(1, (g - 0.15) * 1.5);
      glow(SABLE_X - 30, 180, 60 * r, tab('#ff7a2a', true), 0.4);
      embers(SABLE_X - 30, 186, 50, 30, t, 202);
      if (g < 0.4) { flash(0.5 * (1 - g / 0.4)); shk(3); }
    } else embers(FIRE[0], FIRE[1] - 6, 10, 10, t, 203);
    const z = lerp(1.7, 2.6, eio(lt / 9)), fx = lerp(236, 236, lt / 9);
    view(fx, lerp(170, 172, lt / 9), z);
  });

  // 13 — the mask, then the oath (1:14): a cracked white mask on the stones; she lifts it; masked, burning, she swears
  function maskArt(cx, cy, s, t, lift) {
    // a porcelain face: two slits, a crack running from one slit to the jaw, a bevelled rim
    fillEll(cx, cy, 34 * s, 42 * s, -0.12 + lift * 0.1, (x, y, u, v) => {
      if (v > 0.55 && Math.abs(u) > 1 - (v - 0.55) * 1.6) return -1;
      const slit = Math.abs(v + 0.12) < 0.07 && Math.abs(Math.abs(u) - 0.38) < 0.2, crack = Math.abs(u - 0.33 - (v + 0.1) * 0.45 - Math.sin(v * 9) * 0.04) < 0.035 && v > -0.08;
      if (slit) return C('ink', 0); if (crack) return C('ink', 1);
      const r = Math.hypot(u, v); return cel(R.hush, 6.4 - (r > 0.88 ? 1.6 : 0) + (u * -0.6 + v * -0.6) * 1.2 + (Math.abs(v - 0.15) < 0.05 && Math.abs(u) < 0.2 ? -1 : 0), x, y);
    });
  }
  shot(74.0, 82.0, (lt, t) => {
    if (lt < 2.6) {
      // macro: pale stones, ash, the mask; her hand comes into frame and lifts it
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const u = x + y * 0.3, by = fl(y / 34), bx = fl(u / 52 + (by % 2) * 0.5), gap = frac(u / 52 + (by % 2) * 0.5) < 0.04 || frac(y / 34) < 0.06; BUF[y * W + x] = cel(R.hush, 3.6 + (ih(bx, by, 261) - 0.5) * 0.8 + (vn(x, y, 6, 262) > 0.7 ? 0.5 : 0) - (gap ? 1.4 : 0), x, y); }
      for (let k = 0; k < 50; k++) { const x = ih(k, 1, 263) * W, y = ih(k, 2, 263) * H; rectF(x, y, 2 + ih(k, 3, 263) * 3, 1 + ih(k, 4, 263) * 2, C('hush', 2)); }
      const lift = eio(lin(0.9, 2.5, lt)), mx = 226 + lift * 10, my = 150 - lift * 40;
      fillEll(mx + 10, 200, 52, 12, 0, (x, y) => (bay(x, y) < 0.5 * (1 - lift) ? C('hush', 2) : -1));    // its shadow
      maskArt(mx, my, 1.5 + lift * 0.2, t, lift);
      // her fingers on its rim
      if (lt > 0.5) {
        // her hand: a dark sleeve from the top right, the fingers curled over the mask's rim, the thumb on its face
        const hx = mx + 46 * (1.5 + lift * 0.2), hy = my - 14 - (1 - lin(0.5, 0.85, lt)) * 120;
        sclear(); LIGHTS.x = -0.6; LIGHTS.y = -0.7;
        sPoly([[8, -150], [40, -150], [26, -112], [6, -116]], (x, y) => band(R.ink, 3 + (x < 14 ? 1 : 0) + ((y + 150) % 12 < 1 ? -1 : 0)));
        sPoly([[6, -116], [24, -112], [25, -106], [5, -109]], (x, y) => band(R.crimson, 4));
        sEll(14, -100, 10, 11, (x, y, u, v) => band(R.tan, 5 + (litOf(u, v) > 0.3 ? 1 : litOf(u, v) < -0.4 ? -1 : 0)));
        for (let k = 0; k < 4; k++) { sEll(1 - k * 0.5, -96 + k * 6, 6, 2.6, (x, y, u, v) => band(R.tan, 5 + (v < -0.2 ? 1 : 0) - (u < -0.6 ? 1 : 0))); }
        sEll(4, -108, 3, 5, (x, y, u, v) => band(R.tan, 5.4 + (u < 0 ? 0.6 : -0.4)));
        soutline(); stamp(hx - 4, hy + 200, 2, false);
      }
      for (let k = 0; k < 24; k++) { const u = frac(ih(k, 1, 264) + t * 0.15); put(fl(ih(k, 2, 264) * W), fl(H - u * H), u < 0.5 ? C('ember', 6) : C('ember', 4)); }
      fade(1 - lin(0, 0.4, lt));
    } else if (lt < 5.4) {
      // low, wide: she stands masked in the white, the sword burning, embers climbing round her
      const u = lt - 2.6;
      drainedShrine(t);
      LIGHT.x = 1; LIGHT.y = -0.4; ENV.edge = C('fire', 5);
      actor(SABLE, { t, wind: 2 + Math.sin(t * 2) * 1.5, face: { mask: 2 }, arms: [{ hand: [10, -22] }, { a: 0.2 }], legs: [{ foot: [6, 0] }, { foot: [-6, 0] }], prop: (A) => swordArt(A.hand[0], A.hand[1], 0.5, 28, true) }, 240, FLOOR, 1, 1);
      ENV.edge = null;
      glow(258, FLOOR - 40, 50, tab('#ff8030', true), 0.45);
      embers(240, FLOOR - 4, 90, 60, t, 212);
      view(240, lerp(178, 172, u / 2.8), lerp(2.2, 2.6, eio(u / 2.8)));
    } else {
      // close: the mask, the embers burning in its eyes — "I remember that I swore" — the sword comes up, and down
      const u = lt - 5.4, raise = lin(0.2, 1.1, u), slash = lin(2.0, 2.2, u);
      closeBg(() => drainedShrine(t), 236, 160, 3, 3);
      LIGHT.x = 1; LIGHT.y = -0.4; ENV.edge = C('fire', 5);
      bust('sable', { t, wind: 2, face: { mask: 2 } }, 240, H - 22 + 6, 3, 1);
      ENV.edge = null;
      // the burning blade crossing the frame as she lifts it, then the cut
      if (slash <= 0) {
        // the blade rises into frame beside her face, upright, burning along its edge
        const bx = 340, tip = lerp(300, 34, eio(raise)), base = H;
        for (let y = Math.max(LB, fl(tip)); y < Math.min(H - LB, base); y++) { const q = (y - tip) / 190, wd = q < 0.1 ? Math.max(1, q / 0.1 * 7) : 7; for (let w = -wd; w <= wd; w++) { const x = fl(bx + w + (y - tip) * 0.06); put(x, y, w < -wd + 1.5 ? WHITE : w < -2 ? C('fire', 6) : w < 3 ? C('fire', 5) : w < wd - 1 ? C('ember', 5) : C('ember', 3)); } }
        for (let k = 0; k < 6; k++) if (tip + 20 + k * 34 < H - LB) fire(bx + 8 + (20 + k * 34) * 0.06, tip + 20 + k * 34, 9, t, 31 + k, { sparks: 5, smoke: false });
        glow(bx, (H + tip) / 2, 90, tab('#ff7a2a', true), 0.35);
      }
      embers(240, 250, 70, 300, t, 213);
      if (slash > 0) { BUF.fill(BLACK); const v = eoc(slash); for (let x = 0; x < W * v; x++) { const y = fl(250 - x * 0.48); put(x, y, WHITE); put(x, y + 1, C('fire', 6)); put(x, y - 1, C('fire', 5)); put(x, y + 2, C('ember', 4)); } }
      if (u > 2.2) { BUF.fill(BLACK); const fd = 1 - lin(2.2, 2.6, u); for (let x = 0; x < W; x++) { const y = fl(250 - x * 0.48); if (ih(x, 1, fl(t * 20)) < fd) { put(x, y, C('fire', 5)); put(x, y + 1, C('ember', 4)); } } }
      if (u > 1.7 && u < 2.05) shk(2);
    }
  });

  // 14 — the title (1:22): the letters catch from the cut, burn bright, and settle to embers; then they burn away
  shot(82.0, 93.0, (lt, t) => {
    BUF.fill(BLACK);
    const s = 'UNFORGOTTEN', sc = 6, w = textWidth(s, sc), x0 = fl(240 - w / 2), y0 = 92;
    const burnOut = lin(8.6, 10.6, lt);
    // the letters are windows onto a fire field: each pixel's heat rises with the noise, banded into flame colours
    text(s, x0, y0, (i, j, k) => -2, sc);       // (layout only)
    let cx = x0;
    for (let k = 0; k < s.length; k++) {
      const g = FONT[s[k]] || FONT[' '], gw = g[0].length, catchT = 0.6 + Math.abs(k - 5) * 0.16;
      for (let j = 0; j < 7; j++) for (let i = 0; i < gw; i++) {
        if (g[j][i] !== '#') continue;
        for (let yy = 0; yy < sc; yy++) for (let xx = 0; xx < sc; xx++) {
          const px = cx + i * sc + xx, py = y0 + j * sc + yy, age = lt - catchT - (6 - j) * 0.03;
          if (age < 0) continue;
          if (burnOut > 0 && ih(px >> 1, py >> 1, 222) < burnOut * 1.3 - (py - y0) / 60) continue;
          const n = fbm(px * 0.7, py * 0.5 + t * 26, 3, 2, 225), heat = Math.min(1, age * 2) * (0.55 + n * 0.6) - Math.max(0, age - 1.5) * 0.12 + (j < 2 ? 0.08 : 0);
          put(px, py, heat > 0.95 ? WHITE : heat > 0.78 ? C('fire', 6) : heat > 0.6 ? C('fire', 4) : heat > 0.42 ? C('ember', 5) : C('ember', 3));
        }
      }
      // little flames licking off the tops of the letters
      if (lt > catchT + 0.3 && burnOut < 0.5) fire(cx + gw * sc / 2, y0 + 2, 4 + ih(k, 1, 226) * 3, t, k + 40, { sparks: 3, smoke: false });
      cx += (gw + 1) * sc;
    }
    embers(240, y0 + 40, 70, w, t, 223);
    // the slash line still smouldering at first
    if (lt < 1.4) for (let x = 0; x < W; x++) { const y = fl(250 - x * 0.48); if (ih(x, 2, fl(t * 20)) < 1 - lt / 1.4) put(x, y, C('ember', 4)); }
    if (lt > 3.4) { const s2 = 'EPISODE ONE · THE COURIER', a = lin(3.4, 4.4, lt) * (1 - burnOut); text(s2, 240 - textWidth(s2, 1) / 2, 160, a > 0.5 ? C('linen', 6) : C('linen', 3), 1, undefined, fl((lt - 3.4) * 40)); }
  }, { nocaps: true });
