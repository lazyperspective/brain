  /* ================================================================ COLD OPEN — Emberwick, years ago */
  // the street up the middle of the village: terraces of 10 m, each 1.8 m higher, joined by stairs
  function streetY(z) { const k = clamp(fl(z / 10), 0, 6), z1 = k * 10 + 10; let y = k * 1.8; if (z > z1 - 1.8 && k < 6) y += (z - (z1 - 1.8)) / 1.8 * 1.8; if (z > 68.2) y = Math.min(12.6, 10.8 + (z - 68.2)); return y; }
  // world position under a pixel (from the depth buffer)
  function worldAt(i, x, y) { const d = ray(x + 0.5, y + 0.5), z = Math.min(ZB[i], 2000); return [CAM.x + d.x * z, CAM.y + d.y * z, CAM.z + d.z * z]; }
  // the Hush on a 3D frame: amount(wx, wy, wz) per pixel
  function hushWorld(t, amount, flecks) { hushOver((x, y) => { const p = worldAt(y * W + x, x, y); return amount(p[0], p[1], p[2]); }, t, flecks); }
  const RAINC = C('night', 5);
  // the wet wall with the chalk name, in extreme close-up; erase 0..1 dissolves the letters
  function chalkWall(t, lt, letters, erase, freeze) {
    // bokeh: lanterns far behind, out of focus, through the gap at the left
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) BUF[y * W + x] = shadeC(R.night, 1.2 + y / H * 0.8, x, y);
    for (let k = 0; k < 9; k++) { const bx = 20 + ih(k, 1, 131) * 120, by = 40 + ih(k, 2, 131) * 180, r = 10 + ih(k, 3, 131) * 16; discF(bx, by, r, C('ember', 3)); discF(bx, by, r - 2, C('ember', 4)); glow(bx, by, r * 1.8, T_EMBER, 0.25); }
    // the wall: vertical planks, wet, at a slight angle
    const wx0 = 140;
    for (let y = 0; y < H; y++) for (let x = wx0 + fl((y - 135) * -0.08); x < W; x++) {
      const u = x - wx0 + y * 0.08, plank = fl(u / 34), seam = frac(u / 34) < 0.05, grain = vn(u * 0.3, y * 0.05 + plank * 50, 3, 133);
      BUF[y * W + x] = shadeC(R.wood, 1.6 + grain * 1.2 + (ih(plank, 1, 134) - 0.5) * 0.6 - (seam ? 1.2 : 0) + (x < wx0 + 12 ? -0.8 : 0), x, y);
    }
    // water running down the planks
    for (let k = 0; k < 26; k++) { const x = wx0 + 20 + ih(k, 1, 135) * 300, sp_ = 30 + ih(k, 2, 135) * 50, y0 = ((freeze === undefined ? t : freeze) * sp_ + ih(k, 3, 135) * 400) % 330 - 30; for (let j = 0; j < 14; j++) P(x + Math.sin((y0 + j) * 0.2) * 0.6, y0 + j, j < 3 ? C('night', 6) : C('wood', 4)); P(x, y0 + 14, C('hush', 3)); }
    // the chalk letters: drawn stroke by stroke, slightly rough
    const s = 'MIRA', sc = 9, x0 = 196, y0 = 92;
    let cx = x0;
    for (let k = 0; k < s.length; k++) {
      const g = FONT[s[k]], gw = g[0].length, prog = clamp(letters - k, 0, 1);
      const er = clamp(erase * 4 - k, 0, 1);
      for (let j = 0; j < 7; j++) for (let i = 0; i < gw; i++) {
        if (g[j][i] !== '#') continue;
        const order = (j * gw + i) / (7 * gw); if (order > prog) continue;
        for (let yy = 0; yy < sc; yy++) for (let xx = 0; xx < sc; xx++) {
          const px = cx + i * sc + xx + Math.round(Math.sin((j * sc + yy) * 0.5) * 0.8), py = y0 + j * sc + yy;
          const n = ih(px, py, 136);
          if (n < 0.18) continue;                                                     // chalk is rough
          if (er > 0 && ih(px >> 1, py >> 1, 137 + fl(T_NOW * 24)) < er * 1.3) { if (n < 0.35 + er * 0.3) P(px, py, ih(px, py, 138) < 0.5 ? WHITE : C('crimson', 5)); continue; }
          P(px, py, n < 0.5 ? C('hush', 3) : WHITE);
        }
      }
      cx += (gw + 1) * sc;
    }
    if (letters >= 4.4 && erase <= 0) { const hx = cx + 6, hy = y0 + 24; for (const [i, j] of [[0, 1], [1, 0], [2, 1], [3, 0], [4, 1], [0, 2], [4, 2], [1, 3], [3, 3], [2, 4]]) rectF(hx + i * 4, hy + j * 4, 3, 3, C('hush', 4)); }
  }
  // a big child's hand with chalk, for the close-up (x, y is the chalk tip): the yellow raincoat sleeve comes in from
  // the lower right, a small fist pinches the chalk, knuckles toward the wall; everything is shaded from the lanterns (upper left)
  function chalkHand(x, y, t) {
    const dx = 0.62, dy = 0.78, nx = -dy, ny = dx, ink_ = C('wood', 0);
    const fx = x + dx * 17, fy = y + dy * 17;                                   // the fist's centre
    for (let Y = fl(y - 30); Y < H; Y++) for (let X = fl(x - 34); X < W; X++) {
      const px = X + 0.5, py = Y + 0.5, a = ((px - x) * dx + (py - y) * dy) / 1.4, b = ((px - x) * nx + (py - y) * ny) / 1.4;   // along / across the arm
      let c = -1;
      // the sleeve: from the wrist on, widening a little, with a cuff, two folds and a bright edge
      if (a > 24) {
        const w = 15 + (a - 24) * 0.12, e = Math.abs(b - 1) - w;
        if (e < 0) { const cuff = a < 31, fold = Math.abs(a - 44 - b * 0.3) < 1.2 || Math.abs(a - 63 + b * 0.25) < 1.2, lit = b < -w + 4;
          c = e > -1.2 ? ink_ : cuff ? (a < 25.5 ? C('gold', 3) : lit ? C('gold', 6) : C('gold', 4)) : fold ? C('gold', 3) : lit ? C('gold', 6) : b > w - 5 ? C('gold', 3) : C('gold', 5); }
      }
      // the fist: a rounded block of four fingers, the knuckles toward the wall
      if (c < 0) {
        const qa = (a - 17) / 11.5, qb = (b - 1.5) / 12, d = qa * qa + qb * qb;
        if (d < 1) {
          const knuck = qa < -0.55 && frac((b + 13.5) / 6) < 0.16, crease = qa > -0.75 && qa < 0.2 && frac((b + 13.5) / 6) < 0.1;
          c = d > 0.86 ? ink_ : knuck || crease ? C('skin', 3) : (qa + qb * 0.8 < -0.55 ? C('skin', 6) : qa + qb > 0.6 ? C('skin', 3) : C('skin', 5));
        }
      }
      // the thumb, wrapped over the chalk
      if (c < 0) { const qa = (a - 8) / 7, qb = (b + 7.5) / 4.2, d = qa * qa + qb * qb; if (d < 1) c = d > 0.72 ? ink_ : qb < -0.2 ? C('skin', 6) : C('skin', 4); }
      // the chalk: a short white stick, worn to a point at the wall
      if (c < 0 && a > -1 && a < 12 && Math.abs(b + 1) < 2.6 - (a < 1 ? (1 - a) * 1.2 : 0)) c = Math.abs(b + 1) > 1.9 ? C('hush', 2) : b < -1.2 ? WHITE : C('hush', 5);
      if (c >= 0) P(X, Y, c);
    }
    // chalk dust drifting off the tip
    for (let k = 0; k < 10; k++) { const u = frac(ih(k, 1, 241) + t * 0.9); P(x - 2 + (ih(k, 2, 241) - 0.5) * 8 - u * 6, y + 2 + u * 18, u < 0.5 ? C('hush', 6) : C('hush', 3)); }
  }

  // 1 — the chalk (0:00)
  shot(0, 7.5, (lt, t) => {
    const letters = lin(1.6, 6.0, lt) * 4.6;
    chalkWall(t, lt, letters, 0);
    if (lt > 1.4 && lt < 6.6) {
      const k = Math.min(3, fl(letters)), g = FONT['MIRA'[k]], u = frac(letters), gw = g[0].length;
      const px = 196 + k * (gw + 1) * 9 + (u * gw) * 9, py = 92 + Math.sin(u * PI * 3) * 26 + 30;
      chalkHand(px, py, t);
    }
    ENV.bloom = 0.2;
    rain2D(t, 60, 0.14);
    fade(1 - lin(0.8, 2.2, lt));
  }, { nobars: false });
  function rain2D(t, n, wind) { for (let k = 0; k < n; k++) { const x = ih(k, 1, 141) * (W + 60) - 30, sp_ = 380 + ih(k, 2, 141) * 200, y = (t * sp_ + ih(k, 3, 141) * 400) % 320 - 30, L = 10 + ih(k, 4, 141) * 10; lineF(x, y, x - wind * L, y + L, (px, py, u) => { if (u > 0.2) P(px, py, RAINC); }); } }

  // 2 — the crane up and over the village; Mira running up the street with her lantern (0:07)
  shot(7.5, 17.0, (lt, t) => {
    const u = eio(lt / 9.5);
    const mz0 = lerp(6, 36, lin(0.4, 9.5, lt));
    lookAt(lerp(1.4, -6, u), lerp(1.3, 21, u), lerp(mz0 - 3.2, -14, u), lerp(0.2, 0, u), lerp(streetY(mz0) + 1.0, 6, u), lerp(mz0 + 8, 40, u), lerp(58, 52, u));
    drawEmberwick(t);
    const mz = lerp(6, 36, lin(0.4, 9.5, lt)), my = streetY(mz);
    ENV.rimK = 0;
    actor3('mira', { view: 'back', run: t * 15, lantern: true }, 0.2, my, mz, { size: 0.72, dark: 1, rim: { side: 1, T: T_EMBER, a: 0.3 } });
    ink(2); emberwickLights(t);
    const mp = proj(0.55, my + 0.35, mz); if (mp) glow(mp.x, mp.y, 9 * CAM.F / mp.z / 10, T_EMBER, 0.32);
    rain3(t, 420, 0.8, 0.15, RAINC, 91, 20);
  });

  // 3 — the shrine: Sable tying a red cord on her sword by the fire; Mira bursts up the steps (0:17)
  shot(17.0, 23.5, (lt, t) => {
    lookAt(-4.4 + lt * 0.15, 14.6, 63.8 + lt * 0.2, 0.8, 13.4, 72.4, 50);
    drawEmberwick(t);
    // she runs the last steps (the stride slows as she brakes), skids, then bounces on her toes as she tells him
    const arr = lin(0, 1.9, lt), mz = lerp(63, 70.4, 1 - (1 - arr) * (1 - arr)), my = streetY(mz), skid = lt > 1.9 && lt < 2.15;
    ink(2); emberwickLights(t);
    const turn = sstep(2.0, 2.35, lt), tie = Math.sin(t * 5.5) * 0.25 * (1 - turn);
    actor3('sable', { kneel: true, crouch: 1.4, armF: 0.45 + tie, reach: Math.cos(t * 5.5) * 1.2 * (1 - turn), sword: turn > 0.5 ? -0.4 : -0.05, look: turn > 0.5 ? 1 : 0, eyes: blink(t, 3) ? 'closed' : turn > 0.5 ? 'open' : 'half', brows: turn > 0.5 ? 'up' : 'n', smile: turn > 0.5 ? 0.6 : 0.2, mouth: mouth('sable', t), wind: 1 }, 1.9, 12.6, 72.6, { flip: turn < 0.5, dark: 1, rim: { side: turn > 0.5 ? 1 : -1, T: T_EMBER, a: 0.65 } });
    const tk = talking('mira', t), hop = lt > 2.15 ? Math.round(-Math.abs(Math.sin(t * 6.5)) * 2 * (tk ? 1 : 0.4)) : 0;
    actor3('mira', { view: lt < 1.9 ? 'back' : 'side', run: lt < 1.9 ? 10 + lt * 16 - lt * lt * 2.5 : undefined, crouch: skid ? 0.8 : 0, lean: skid ? -2 : 0.5, lantern: true, bob: hop,
      eyes: blink(t, 4) ? 'closed' : tk ? 'wide' : 'open', mouth: mouth('mira', t), smile: 0.8, armF: tk ? -0.5 + Math.sin(t * 4.2) * 0.6 : skid ? -0.4 : 1.2, armB: tk ? 2.4 + Math.sin(t * 4.2 + 1) * 0.3 : undefined, wind: skid ? 3 : 1 },
      lerp(-0.4, -0.9, arr), my, mz, { size: 0.72, dark: 1, rim: { side: 1, T: T_EMBER, a: 0.6 } });
    rain3(t, 360, 0.8, 0.15, RAINC, 92, 16);
  });

  // 4 — two-shot by the fire: "then the wall will remember you" (0:23)
  shot(23.5, 30.0, (lt, t) => {
    lookAt(-0.6 - lt * 0.06, 14.3, 66.9 + lt * 0.12, 1.3, 13.5, 72.6, 46);
    drawEmberwick(t, { cull: (h) => h.z0 > 55 });
    ink(2); emberwickLights(t);
    const up = sstep(3.3, 3.75, lt) * (1 - sstep(5.0, 5.5, lt)), pat = up > 0.6, tap = pat ? Math.max(0, Math.sin((lt - 3.75) * 11)) * 0.25 : 0;
    actor3('mira', { view: 'front', lantern: true, eyes: pat ? 'closed' : blink(t, 4) ? 'closed' : 'open', smile: 0.9, blush: up > 0.3, mouth: 0, look: pat ? 0 : 1, bob: pat ? (tap > 0.12 ? 1 : 0) : undefined, armL: pat ? 2.3 : undefined }, 0.95, 12.6, 72.3, { size: 0.72, dark: 1, rim: { side: 1, T: T_EMBER, a: 0.75 } });
    actor3('sable', { view: 'front', kneel: true, crouch: 1.4, armF: 1.0, armL: 1.75, patL: up > 0.05 ? [lerp(-3, -14, up), lerp(4, -12, up) + Math.round(tap * 6)] : undefined, eyes: blink(t, 3) ? 'closed' : lt > 4.4 ? 'half' : 'open', smile: 0.7, mouth: mouth('sable', t), look: -1 }, 2.0, 12.6, 72.8, { dark: 1, zBias: -1.6, rim: { side: -1, T: T_EMBER, a: 0.75 } });
    rain3(t, 200, 0.6, 0.15, RAINC, 93, 8);
  });

  // 5 — the rain stops in the air; Sable looks up; the sky opens a ring of glyphs (0:30)
  const FREEZE = 30.6;
  shot(30.0, 36.0, (lt, t) => {
    const ft = Math.min(t, FREEZE);
    if (lt < 2.4) {
      // close on Sable, drops hanging in front of her face
      lookK(0.6, 13.7, 68.6, 2.0, 13.5, 72.8, 30, 1.9 - eio(lt / 2.4) * 0.3, 0.1);
      drawEmberwick(t, { cull: (h) => h.z0 > 58 });
      ink(2); emberwickLights(ft);
      actor3('sable', { view: 'front', kneel: true, crouch: 1.4, eyes: lt > 1.1 ? 'wide' : blink(t, 3) ? 'closed' : 'open', brows: lt > 1.1 ? 'worried' : 'n', look: lt > 1.1 ? 0 : -1, smile: lt > 0.8 ? 0 : 0.5, armF: 1.0 }, 2.0, 12.6, 72.8, { dark: 1, rim: { side: -1, T: T_EMBER, a: 0.7 } });
      rain3(ft, 260, 0.6, 0.15, RAINC, 94, 5);
      if (t > FREEZE) for (let k = 0; k < 40; k++) { const x = ih(k, 1, 151) * W, y = ih(k, 2, 151) * H; P(x, y, C('hush', 4)); P(x, y + 1, C('night', 5)); }
      tintAll(T_COLD, lin(0.6, 2.4, lt) * 0.3);
    } else {
      // up at the sky over the shrine
      const u = lt - 2.4;
      lookAt(0.4, 7.6, 36, 0, 44, 110, 72 - u * 2);
      drawEmberwick(t, { cull: (h) => h.z0 > 30 });
      ink(2); emberwickLights(FREEZE);
      const p = proj(0, 70, 120);
      if (p) {
        // the clouds part, the ring opens
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const d = Math.hypot(x - p.x, (y - p.y) * 1.6); if (d < 30 + u * 40 && ZB[y * W + x] > 1e8) tintI(y * W + x, x, y, T_WH, Math.max(0, 1 - d / (30 + u * 40)) * 0.5); }
        sigil(p.x, p.y, 20 + eoc(u / 3) * 70, (20 + eoc(u / 3) * 70) * 0.42, t, lin(0, 2.6, u), 161);
      }
      rain3(FREEZE, 300, 0.8, 0.15, RAINC, 95, 18);
      shk(0.6);
    }
  });

  // 6 — the King on the ridge, his back to us, the ring above him: "hush now" (0:36)
  shot(36.0, 41.0, (lt, t) => {
    lookAt(-2.4 + lt * 0.25, 27.6, 93.5 + lt * 0.3, 0, 30.4, 104, 44);
    setFog('#121a33', 18, 140, 0.8); setSun(-0.3, 0.7, -0.6, 0.18);
    sky((dx, dy, dz, x, y) => skyNight(dx, dy, dz, x, y));
    const p = proj(0, 44, 160); if (p) { glow(p.x, p.y, 260, T_WH, 0.4); sigil(p.x, p.y, 150, 62, t, 1, 161); }
    // the ridge: a dark slope of rock and grass
    plane(26, (wx, wz, d, x, y) => shadeC(R.night, 1.2 + vn(wx, wz, 2, 171) * 0.8 - (wz > 104 ? 0 : 0), x, y), { maxD: 60 });
    box(-30, 0, 100, 30, 26.8, 140, (f, u, v, x, y, tt, L) => shadeC(R.night, 0.8 + L * 1.4 + vn(u, v, 3, 172) * 0.8, x, y));
    ink(2);
    const k = actor3('king', {}, 0, 26.8, 104, { size: 1.0, dark: 0, rim: { side: 1, T: T_WH, a: 0.5 } });
    // his cloak stirs in a wind that isn't there
    for (let i = 0; i < 18; i++) { const u = frac(ih(i, 1, 173) + t * 0.4); if (k) P(k.x + (ih(i, 2, 173) - 0.5) * 30 * k.S, k.y - u * 40 * k.S, C('hush', 4)); }
    rain3(FREEZE, 160, 0.8, 0.15, RAINC, 96, 10);
    tintAll(T_COLD, 0.2);
  });

  // 7 — the wave: the white ring comes down over the village, everything inside it blanks (0:41)
  const WAVE0 = 41.4, waveR = (t) => Math.max(0, (t - WAVE0) * 13);
  shot(41.0, 48.0, (lt, t) => {
    lookAt(-24 + lt * 0.8, 26, -10, 0, 6, 40, 58);
    const R0 = waveR(t), cz = 64;
    drawEmberwick(t, { dark: false });
    ink(2);
    emberwickLights(FREEZE, { fire: R0 > 10 ? 0 : 1 });
    hushWorld(t, (wx, wy, wz) => { const d = Math.hypot(wx, (wz - cz) * 0.9, (wy - 40) * 0.25); return d < R0 - 4 ? 0.92 : d < R0 ? 1 : d < R0 + 2.5 ? 0.45 : 0; });
    for (let k = 0; k < 140; k++) { const a = ih(k, 1, 251) * TAU, y = ih(k, 2, 251) * 9, x = Math.cos(a) * R0, z = cz + Math.sin(a) * R0 / 0.9; const p = proj(x, y + 1, z); if (p && p.z < ZB[Math.min(NP - 1, Math.max(0, fl(p.y) * W + fl(p.x)))] + 2) { P(p.x, p.y, ih(k, fl(t * 20), 252) < 0.5 ? WHITE : C('crimson', 5)); P(p.x, p.y - 1, WHITE); } }
    { const p = proj(0, 60, 120); if (p) for (let y = 0; y < H; y++) { const w = 6 + y * 0.05; for (let x = fl(p.x - w); x < p.x + w; x++) if (x >= 0 && x < W && ZB[y * W + x] > 1e8) tintI(y * W + x, x, y, T_WH, 0.6 * (1 - Math.abs(x - p.x) / w)); } }
    rain3(FREEZE, 300, 0.8, 0.15, RAINC, 97, 20);
    shk(1.5);
  });
  // 8 — the name on the wall dissolves (0:48)
  shot(48.0, 51.0, (lt, t) => {
    chalkWall(t, lt, 4.6, lin(0.2, 2.6, lt), 47.9);
    hushOver((x, y) => clamp((lt - 1.2) * 0.6 - (W - x) / W * 0.4, 0, 1), t);
  });

  // 9 — Mira turns toward the light: "Sable...?" (0:51)
  shot(51.0, 55.0, (lt, t) => {
    lookK(-0.9, 13.4, 68.9, 0.6, 13.15, 72.0, 34, 1.35, 0.05);
    drawEmberwick(t, { cull: (h) => h.z0 > 58 });
    ink(2); emberwickLights(FREEZE);
    actor3('mira', { view: lt < 0.7 ? 'side' : 'front', lantern: true, eyes: lt > 1.6 ? 'wide' : 'open', brows: 'worried', mouth: mouth('mira', t), look: lt > 0.7 ? -1 : 0, tear: lt > 2.4 }, 0.6, 12.6, 72.0, { size: 0.72, flip: lt < 0.7, dark: 1, rim: { side: -1, T: T_WH, a: 0.4 + lt * 0.12 } });
    glow(0, 120, 220, T_WH, 0.2 + lt * 0.12);
    hushOver((x, y) => clamp((lt - 1.6) * 0.5 - x / W * 0.9, 0, 0.9), t);
  });

  // 10 — her hand in Sable's; the wave hits; the hand turns to static and slips away (0:55)
  shot(55.0, 60.0, (lt, t) => {
    const hit = 3.2;
    lookAt(1.2, 13.6, 67.6, 1.2, 13.25, 72.6, 40);
    drawEmberwick(t, { cull: (h) => h.z0 > 58 });
    ink(2); emberwickLights(FREEZE, { fire: lt > hit ? 0 : 1 });
    const gone = lt > hit + 0.9;
    actor3('sable', { view: 'side', kneel: true, crouch: 1.0, armF: -0.15, reach: 3, eyes: lt > hit ? 'wide' : 'narrow', brows: 'worried', mouth: mouth('sable', t) }, 1.8, 12.6, 72.6, { flip: true, dark: 1, rim: { side: -1, T: T_WH, a: 0.6 } });
    if (!gone) {
      const gl = lt > hit ? (lt - hit) / 0.9 : 0;
      const m = actor3(lt > hit + 0.45 ? 'hollow' : 'mira', { view: 'side', armF: -0.3, reach: 2, eyes: 'wide', brows: 'worried', tear: true, mouth: 0.3 }, 0.55, 12.6, 72.5, { size: 0.72, dark: 1, glitch: gl * 2, alpha: 1 - gl * 0.8 });
      if (lt > hit && m) for (let k = 0; k < 60 * gl; k++) { const u = frac(ih(k, 1, 181) + lt * 0.8); P(m.x + (ih(k, 2, 181) - 0.5) * 40 * m.S + u * 30, m.y - ih(k, 3, 181) * 34 * m.S - u * 40, ih(k, 4, 181) < 0.5 ? WHITE : C('crimson', 5)); }
    }
    // the white wall coming up the stairs behind her
    const wv = clamp((lt - 1.2) / (hit - 1.2), 0, 1);
    hushOver((x, y) => { const front = W * wv * 0.42; return x > front + 30 ? 0 : x > front ? (front + 30 - x) / 30 * 0.8 : 1; }, t);
    if (lt > hit && lt < hit + 0.08) impactFrame(240, 130, 0);
    shk(lt > hit ? 3 * Math.exp(-(lt - hit) * 3) : wv * 1.2);
  });

  // 11 — the scream (1:00)
  shot(60.0, 65.0, (lt, t) => {
    lookK(1.2, 13.65, 68.4, 2.0, 13.5, 72.8, 30 - lt * 2.2, 2.0);
    drawEmberwick(t, { cull: (h) => h.z0 > 60 });
    ink(2);
    actor3('sable', { view: 'front', kneel: true, crouch: 1.0, eyes: lt < 1.6 ? 'closed' : 'sad', brows: 'worried', mouth: mouth('sable', t), tear: true, armF: 1.2 }, 2.0, 12.6, 72.8, { dark: 0, rim: { side: 1, T: T_WH, a: 0.6 } });
    hushOver((x, y) => clamp(Math.hypot(x - 240, (y - 120) * 1.6) / 260 * (0.6 + lt * 0.5) - 0.25, 0, 1), t, false);
    if (lt > 0.25 && lt < 1.6) { shk(3); zoomBlur(240, 120, 0.05); }
    if (lt > 0.3 && lt < 1.3) { const sp_ = lin(0.3, 1.3, lt); radialLines(240, 130, 40, 60 + sp_ * 40, WHITE, t, 271); }
    flashWhite(lin(1.8, 2.6, lt));
    if (lt > 2.6) { BUF.fill(WHITE); for (let k = 0; k < 50; k++) { const x = ih(k, 1, 191) * W, y = (ih(k, 2, 191) * H - (lt - 2.6) * 20 * (1 + ih(k, 3, 191))) % H; P(x, (y + H) % H, C('hush', 2)); } tintAll(tab('#8a90a0'), lin(3.4, 5, lt) * 0.6); }
  }, { nocaps: false });

  // 12 — after: a drained world; only the embers keep their colour; Sable pulls the sword from the fire (1:05)
  const AFTER = (t) => { hushWorld(t, () => 0.5, false); tintAll(T_COLD, 0.25); };
  function embers3(t, cx, cy, cz, n, spread, seed) {
    for (let k = 0; k < n; k++) { const u = frac(ih(k, 1, seed) + t * (0.12 + ih(k, 2, seed) * 0.15)); const x = cx + (ih(k, 3, seed) - 0.5) * spread + Math.sin(t * 1.3 + k) * 0.4, y = cy + u * 7, z = cz + (ih(k, 4, seed) - 0.5) * spread; const p = p3(x, y, z, u < 0.5 ? C('ember', 6) : C('ember', 4), 0.07); if (p && ih(k, 5, seed) < 0.15) glow(p.x, p.y, 4, T_EMBER, 0.4); }
  }
  shot(65.0, 74.0, (lt, t) => {
    const pull = 3.6, lit = 4.2;
    lookAt(-5 + lt * 0.35, 14.8, 66 + lt * 0.15, 1.0, 13.2, 72.6, 46);
    drawEmberwick(t, { dark: true, cull: (h) => h.z0 > 30 });
    ink(2);
    AFTER(t);
    // the cold fire bed still glowing
    for (let k = 0; k < 30; k++) p3(-0.2 + (ih(k, 1, 201) - 0.5) * 1.6, 12.65, 72 + (ih(k, 2, 201) - 0.5) * 1.2, ih(k, 3, 201) < 0.5 ? C('ember', 3) : C('ember', 5), 0.12);
    glow3(0, 12.8, 72, 2.4, T_EMBER, 0.45, false);
    const sw = lt < pull ? undefined : lerp(1.7, -1.2, eob(lin(pull, pull + 0.8, lt)));
    const rise = sstep(lit + 0.15, lit + 0.7, lt), reachIn = sstep(pull - 1.2, pull - 0.3, lt);
    actor3('sable', { kneel: rise < 0.35, crouch: rise < 0.35 ? (lt < pull ? 1.6 : 1.0) : lerp(1.6, 0, (rise - 0.35) / 0.65), armF: lt < pull ? lerp(1.6, 0.6, reachIn) : lerp(0.6, -0.6, eob(lin(pull, pull + 0.35, lt))), reach: lt < pull ? reachIn * 3 : 0, lean: rise > 0.35 ? (1 - rise) * 2 : 0, eyes: lt > lit ? 'narrow' : 'half', brows: lt > lit ? 'angry' : 'worried', sword: sw, embers: lt > lit, mouth: 0, tear: lt < pull }, 1.4, 12.6, 72.4, { flip: true, dark: lt > lit ? 0 : 1, rim: lt > lit ? { side: 1, T: T_EMBER, a: 0.8 } : undefined });
    // the porcelain mask, cracked, lying on the stones
    const mp = proj(2.6, 12.62, 71.4); if (mp) { const s = CAM.F / mp.z * 0.035; for (let y = -5; y <= 5; y++) for (let x = -4; x <= 4; x++) if ((x / 4.2) ** 2 + (y / 5.2) ** 2 <= 1) PZ(mp.x + x * s * 3, mp.y + y * s * 1.4, Math.abs(x - y * 0.4) < 0.7 ? C('night', 1) : C('hush', 6), mp.z - 0.01); }
    if (lt > lit) { glow3(0.6, 14, 72.4, 3 * Math.min(1, (lt - lit) * 2), T_EMBER, 0.6, false); embers3(t, 1, 12.8, 72.4, 70, 3, 202); }
    else embers3(t, 0, 12.8, 72, 26, 2, 203);
    if (lt > lit && lt < lit + 0.3) { shk(3); flashWhite(0.4 * (1 - (lt - lit) / 0.3)); }
  });

  // 13 — the mask, and the oath; the camera circles her as the embers rise (1:14)
  shot(74.0, 82.0, (lt, t) => {
    if (lt < 2.6) {
      // her hand lifting the cracked mask (close)
      // macro: wet grey stones, ash, and the mask being lifted out of frame
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const u = x + y * 0.3, bx = fl(u / 46 + (fl(y / 30) % 2) * 0.5), by = fl(y / 30), gap = frac(u / 46 + (by % 2) * 0.5) < 0.05 || frac(y / 30) < 0.07; BUF[y * W + x] = shadeC(R.stone, 2.4 + (ih(bx, by, 261) - 0.5) * 0.8 + vn(x, y, 6, 262) * 0.7 - (gap ? 1.4 : 0), x, y); }
      tintAll(T_COLD, 0.2);
      for (let k = 0; k < 40; k++) { const x = ih(k, 1, 263) * W, y = ih(k, 2, 263) * H; rectF(x, y, 2 + ih(k, 3, 263) * 3, 2, C('stone', 5)); }
      const lift = eio(lin(0.5, 2.4, lt)), mx = 236 + lift * 14, my = 150 - lift * 120, ms = 1 + lift * 0.25;
      for (let y = -56; y <= 56; y++) for (let x = -44; x <= 44; x++) { const X = x / ms, Y = y / ms; if ((X / 42) ** 2 + (Y / 54) ** 2 > 1) continue; const crack = Math.abs(X - 6 - Math.sin(Y * 0.15) * 9) < 2.2 && Y < 40, rim = (X / 42) ** 2 + (Y / 54) ** 2 > 0.86; P(mx + x, my + y, crack ? C('night', 0) : rim ? C('hush', 2) : (X * X * 0.6 + (Y + 10) * (Y + 10) * 0.4 < 500 ? WHITE : C('hush', 5))); }
      rectF(mx - 28 * ms, my - 14 * ms, 18 * ms, 8 * ms, C('night', 0)); rectF(mx + 10 * ms, my - 14 * ms, 18 * ms, 8 * ms, C('night', 0));
      for (let k = 0; k < 4; k++) { discF(mx + 44 * ms + k * 3, my - 20 + k * 13, 9, C('skin', 3)); discF(mx + 44 * ms + k * 3, my - 20 + k * 13, 7, C('skin', 5)); }
      glow(mx, my, 120, T_EMBER, 0.22);
      for (let k = 0; k < 30; k++) { const u = frac(ih(k, 1, 264) + t * 0.15); P(ih(k, 2, 264) * W, H - u * H, u < 0.5 ? C('ember', 6) : C('ember', 4)); }
    } else {
      const u = lt - 2.6, ang = 0.95 + u * 0.2, r = 5.0;
      lookAt(1.6 + Math.sin(ang) * r, 14.0 - u * 0.12, 72.4 - Math.cos(ang) * r, 1.6, 13.9, 72.4, 46);
      drawEmberwick(t, { dark: true, cull: (h) => h.z0 > 40 });
      ink(2); AFTER(t);
      const raise = lin(4.0, 4.7, u), slash = lin(4.75, 5.05, u);
      const swd = slash > 0 ? lerp(-2.0, 0.9, eoc(slash)) : lerp(-0.4, -2.0, eio(raise));
      const sb = actor3('sable', { view: u < 1.6 ? 'back' : 'side', mask: true, sword: swd, embers: true, eyes: 'narrow', brows: 'angry', armF: slash > 0 ? 0.3 : lerp(0.9, -1.6, raise), wind: 3 + Math.sin(t * 3) * 2 }, 1.6, 12.6, 72.4, { flip: Math.cos(ang) < 0.2, rim: { side: 1, T: T_EMBER, a: 0.8 } });
      embers3(t, 1.6, 12.4, 72.4, 120, 7, 212);
      if (sb && slash > 0 && slash < 1) smearArc(sb.hand[0], sb.hand[1], -2.0, swd, 26 * sb.S, [C('ember', 4), C('ember', 6), C('gold', 7)]);
      if (u > 5.05) { BUF.fill(BLACK); const v = lin(5.05, 5.4, u); lineF(0, 140 + 30, W, 140 - 30, (x, y) => { if (x / W < v * 1.2) { P(x, y, C('ember', 7)); P(x, y + 1, C('ember', 5)); } }); }
      if (u > 4.75 && u < 5.0) shk(4);
    }
  });

  // 14 — the title (1:22)
  shot(82.0, 93.0, (lt, t) => {
    BUF.fill(BLACK);
    const s = 'UNFORGOTTEN', sc = 5, w = textWidth(s, sc), x0 = 240 - w / 2, y0 = 104;
    // the slash line still burning, then the letters catching from it
    const line_ = 1 - lin(1.2, 3.0, lt);
    if (line_ > 0) lineF(0, 168, W, 108, (x, y) => { if (ih(x, fl(t * 20), 221) < line_) { P(x, y, C('ember', 7)); P(x, y + 1, C('ember', 5)); } });
    const burnOut = lin(8.6, 10.6, lt);
    text(s, x0, y0, (i, j, k) => {
      const catchT = 0.8 + Math.abs(k - 5) * 0.18 + j * 0.05;
      if (lt < catchT) return BLACK;
      const age = lt - catchT, flick = ih(i + k * 7, j, fl(t * 12)) * 0.6;
      if (burnOut > 0 && ih(i + k * 7, j, 222) < burnOut * 1.4) return BLACK;
      return age < 0.15 ? WHITE : age < 0.5 ? C('gold', 7) : shadeC(R.ember, 5.6 + flick - j * 0.12, i * sc, j * sc);
    }, sc);
    glow(240, 122, 200, T_EMBER, 0.25 * lin(0.8, 2.5, lt) * (1 - burnOut));
    for (let k = 0; k < 70; k++) { const u = frac(ih(k, 1, 223) + t * (0.08 + ih(k, 2, 223) * 0.1)); if (lt < 0.8) continue; P(x0 + ih(k, 3, 223) * w + Math.sin(t + k) * 4, 140 - u * 120, u < 0.5 ? C('ember', 6) : C('ember', 3)); }
    if (lt > 3.4) { const s2 = 'EPISODE ONE · THE COURIER', a = lin(3.4, 4.4, lt) * (1 - burnOut); text(s2, 240 - textWidth(s2, 1) / 2, 160, a > 0.5 ? C('linen', 6) : C('linen', 3), 1, undefined, fl((lt - 3.4) * 40)); }
  }, { nocaps: true });

