  /* ================================================================ COLD OPEN, the beginning: the name on the wall, the run up the hill */
  // 1 — the chalk (0:00): wet planks, the street's lanterns out of focus behind; a small hand writes MIRA, then she steps back
  const NAME = { x0: 214, y0: 74, sc: 9 };
  function plankWall(t, wx0) {
    // the gap to the street: night, lantern light in soft round bokeh
    for (let y = 0; y < H; y++) for (let x = 0; x < wx0 + 30; x++) BUF[y * W + x] = cel(R.night, 0.9 + y / H * 0.9, x, y);
    for (let k = 0; k < 9; k++) {
      const bx = 18 + ih(k, 1, 131) * (wx0 - 20), by = 30 + ih(k, 2, 131) * 210, r = 9 + ih(k, 3, 131) * 15, warm = ih(k, 4, 131) < 0.75;
      fillEll(bx, by, r, r, 0, (x, y, u, v) => { const d = Math.hypot(u, v); return cel(warm ? R.ember : R.sky, (warm ? 3.6 : 2.4) + (d > 0.82 ? 0.9 : 0) - (u + v) * 0.3, x, y); });
      glow(bx, by, r * 1.9, warm ? tab('#ff8a3a', true) : tab('#7aa0e0', true), 0.22);
    }
    // the planks: slanting a little away from us, grain, seams, nail heads, wet streaks, moss at the foot
    for (let y = 0; y < H; y++) for (let x = wx0 + fl((y - 135) * -0.07); x < W; x++) {
      const u = x - wx0 + y * 0.07, plank = fl(u / 38), pu = frac(u / 38), seam = pu < 0.045, grain = vn(u * 0.35, y * 0.045 + plank * 50, 3, 133);
      const streak = vn(u * 0.6, y * 0.012 - t * 0.02, 1, 136) > 0.78 ? 0.7 : 0, moss = y > 236 - vn(u, 0, 9, 137) * 14 ? 1 : 0;
      let v = 1.7 + grain * 1.3 + (ih(plank, 1, 134) - 0.5) * 0.7 - (seam ? 1.4 : pu < 0.09 ? 0.5 : 0) + streak + (x < wx0 + 6 ? 0.8 : 0) + (frac(grain * 5) < 0.12 ? -0.4 : 0);
      BUF[y * W + x] = moss ? cel(R.moss, 0.8 + grain * 0.8, x, y) : cel(R.wood, v, x, y);
      if ((Math.abs(pu - 0.5) < 0.04) && (Math.abs(y - 28) < 1.5 || Math.abs(y - 246) < 1.5)) BUF[y * W + x] = C('stone', Math.abs(y - 28) < 0.6 || Math.abs(y - 246) < 0.6 ? 5 : 3);
    }
    // rainwater running down the boards
    for (let k = 0; k < 26; k++) { const x = wx0 + 14 + ih(k, 1, 135) * 300, sp_ = 22 + ih(k, 2, 135) * 40, y0 = (t * sp_ + ih(k, 3, 135) * 400) % 330 - 30; for (let j = 0; j < 16; j++) put(fl(x + Math.sin((y0 + j) * 0.2) * 0.6), fl(y0 + j), j < 2 ? C('sky', 6) : j < 7 ? C('wood', 5) : C('wood', 4)); }
  }
  // the name in chalk, written stroke by stroke (letters: how many letters are done, 0..4), rough like real chalk
  function chalkName(letters, t, erase) {
    const s = 'MIRA', { x0, y0, sc } = NAME; let cx = x0;
    for (let k = 0; k < 4; k++) {
      const g = FONT[s[k]], gw = g[0].length, prog = clamp(letters - k, 0, 1);
      for (let j = 0; j < 7; j++) for (let i = 0; i < gw; i++) {
        if (g[j][i] !== '#') continue;
        const order = (j * gw + i) / (7 * gw); if (order > prog) continue;
        for (let yy = 0; yy < sc; yy++) for (let xx = 0; xx < sc; xx++) {
          const px = cx + i * sc + xx + Math.round(Math.sin((j * sc + yy) * 0.45 + k) * 0.8), py = y0 + j * sc + yy, n = ih(px, py, 139);
          if (n < 0.16 || (erase && ih(px >> 1, py >> 1, 141) < erase)) continue;
          put(px, py, n < 0.3 ? C('hush', 4) : n < 0.85 ? C('snow', 7) : C('hush', 6));
        }
      }
      cx += (gw + 1) * sc;
    }
    // the little heart she adds at the end
    if (letters > 4.3) for (const [i, j] of [[0, 1], [1, 0], [2, 1], [3, 0], [4, 1], [0, 2], [4, 2], [1, 3], [3, 3], [2, 4]]) { if ((i + j * 5) / 25 > (letters - 4.3) / 0.3) continue; for (let yy = 0; yy < 4; yy++) for (let xx = 0; xx < 4; xx++) if (ih(cx + i * 4 + xx, y0 + 30 + j * 4 + yy, 140) > 0.2) put(cx + 6 + i * 4 + xx, y0 + 30 + j * 4 + yy, C('snow', 7)); }
  }
  // where the chalk is now, as the letters progress
  function penAt(letters) {
    const s = 'MIRA', { x0, y0, sc } = NAME, k = Math.min(3, fl(letters)), u = frac(Math.min(letters, 3.999)); let cx = x0;
    for (let q = 0; q < k; q++) cx += (FONT[s[q]][0].length + 1) * sc;
    const gw = FONT[s[k]][0].length; return [cx + u * gw * sc, y0 + (3.5 + Math.sin(u * PI * 3) * 3) * sc];
  }
  // Mira's hand with the chalk, her yellow raincoat sleeve coming in from the lower right (drawn as a sprite, S = 2)
  function chalkHand(px, py, t) {
    sclear(); LIGHTS.x = 0.5; LIGHTS.y = 0.6;
    const T = [-40, -120], d = [0.62, 0.78], n = [-0.78, 0.62], at = (a, b) => [T[0] + d[0] * a + n[0] * b, T[1] + d[1] * a + n[1] * b];
    // the sleeve: widening down to the frame's edge, a cuff and two folds
    sPoly([at(12, -8), at(12, 9), at(150, 22), at(150, -20)], (x, y) => { const a = (x - T[0]) * d[0] + (y - T[1]) * d[1], b = (x - T[0]) * n[0] + (y - T[1]) * n[1], w = 8 + (a - 12) * 0.1; return band(R.gold, (a < 17 ? 3.4 : 4.6) + (b < -w + 4 ? 1.2 : b > w - 4 ? -1 : 0) + (Math.abs(a - 38 - b * 0.4) < 0.8 || Math.abs(a - 70 + b * 0.3) < 0.8 ? -1.2 : 0)); });
    // the fist: four knuckles toward the wall, a thumb wrapped over the chalk
    sEll(...at(8, 0.5), 8.5, 7.5, (x, y, u, v) => band(R.skin, 5 + (litOf(u, v) > 0.3 ? 1 : litOf(u, v) < -0.35 ? -1 : 0)));
    for (let q = 0; q < 4; q++) { const [kx, ky] = at(2, -5 + q * 3.3); sEll(kx, ky, 1.9, 1.9, (x, y, u, v) => band(R.skin, 5 + (u + v < -0.4 ? 1 : 0))); }
    sEll(...at(3, 6), 3.6, 2.4, (x, y, u, v) => band(R.skin, 5.4 + (v < 0 ? 0.6 : -0.4)));
    // the chalk: a short white stick worn to a blunt point at the wall
    for (let a = -1; a < 7; a += 0.5) for (let b = -1.6; b <= 1.6; b += 0.5) { const [x, y] = at(a, b + 1); sp(x, y, b < -0.6 ? C('snow', 7) : b > 0.8 ? C('hush', 3) : C('hush', 6), 2); }
    soutline(); stamp(px - T[0] * 2, py - T[1] * 2, 2, false);
    glow(px + 70, py + 110, 120, tab('#ffae55', true), 0.28);      // her lantern, just below the frame
  }
  // the writing, keyed: each letter a stroke-run with an ease, the chalk lifting off between letters, a breath, the heart
  const WRITE = [[1.6, 0], [2.35, 1, 'io'], [2.5, 1], [2.85, 2, 'io'], [3.0, 2], [3.8, 3, 'io'], [3.95, 3], [4.7, 4, 'io'], [5.05, 4], [5.45, 4.6, 'out']];
  const LIFT = [[1.3, 2], [1.6, 0, 'out'], [2.35, 0], [2.42, 1, 'out'], [2.5, 0, 'in'], [2.85, 0], [2.92, 1, 'out'], [3.0, 0, 'in'], [3.8, 0], [3.87, 1, 'out'], [3.95, 0, 'in'], [4.7, 0], [4.85, 1.8, 'out'], [5.05, 0.2, 'in'], [5.45, 0], [5.62, 2.5, 'out'], [5.9, 9, 'in']];
  // where the chalk is: along the letters, then round the little heart
  function penPos(letters) {
    if (letters <= 4) return penAt(Math.min(letters, 3.999));
    const { x0, y0, sc } = NAME; let cx = x0; for (const ch of 'MIRA') cx += (FONT[ch][0].length + 1) * sc;
    const u = clamp((letters - 4.3) / 0.3, 0, 1), a = -PI / 2 + u * TAU;
    return letters < 4.3 ? [lerp(penAt(3.999)[0], cx + 16, (letters - 4) / 0.3), lerp(penAt(3.999)[1], y0 + 34, (letters - 4) / 0.3)] : [cx + 16 + Math.cos(a) * 9, y0 + 40 + Math.sin(a) * 8];
  }
  shot(0, 7.5, (lt, t) => {
    const q = ON2(t), letters = key(WRITE, q), lift = key(LIFT, q), pull = sstep(5.75, 6.5, lt);
    plankWall(t, 150);
    chalkName(letters, t);
    if (q > 1.25 && q < 5.95) {
      const [px, py] = penPos(letters), writing = lift < 0.3 && q > 1.6 && q < 5.45, jit = writing ? Math.round(Math.sin(q * 40) * 0.6) : 0;
      chalkHand(px + jit + lift * 3, py + lift * 2, t);
      if (writing) for (let k = 0; k < 6; k++) { const u = frac(ih(k, 1, 241) + t * 1.4); put(fl(px - 3 + (ih(k, 2, 241) - 0.5) * 8 - u * 5), fl(py + 3 + u * 16), u < 0.5 ? C('snow', 6) : C('hush', 3)); }
    }
    if (pull > 0) {
      // the focus pulls back to her: the wall goes soft, she leans into frame (overshooting), tips her head at what she
      // has made, and squeezes with pride
      defocus(Math.round(1 + pull * 3));
      LIGHT.x = -0.8; LIGHT.y = -0.3; ENV.edge = C('fire', 5);
      const bx = key([[5.75, 560], [6.35, 380, 'out'], [6.55, 392, 'back']], q), proud = key([[6.7, 1], [6.78, 0.94, 'out'], [6.9, 1.03, 'out'], [7.02, 1, 'io']], q), wig = q > 6.95 && q < 7.35 ? (fl(q * 15) % 2) : 0;
      bust('mira', { t: q, face: { eyes: q > 6.72 ? 'happy' : blinkK(q, 9) || 'open', smile: 1, blush: 1, look: -1 }, tilt: key([[6.3, -0.04], [6.75, 0.13, 'back']], q), turn: key([[6.3, 0], [6.7, 0.4, 'out']], q), sy: proud, sx: 2 - proud, headY: wig }, Math.round(bx), H - 22 + 8, 3, -1);
      ENV.edge = null; glow(420, 250, 70, tab('#ffae55', true), 0.35 * pull);
    }
    rain(t, 70, 0.18);
    fade(1 - lin(0.4, 2.0, lt));
  });

  // 2 — the run (0:07): alongside her as she climbs the village stair in the rain, lantern swinging; the camera rises
  // until the whole hill is below, and the shrine's fire at the top
  const stairY = (wx) => 200 - fl(Math.max(0, wx) / 16) * 5;
  function villageSide(t, camX, camY) {
    vgrad(0, H, R.night, 0.5, 2.4);
    glow(392, 46 - camY * 0.05, 50, tab('#8fa4d8', true), 0.3); fillEll(392, 46 - camY * 0.05, 8, 8, 0, (x, y, u, v) => cel(R.hush, 6 - (u + v), x, y));
    CAM.x = camX; cloudBank(60 - camY * 0.08, 8, 9, R.night, 2.0, 3, t, 1.2);
    // the hill behind, the shrine on top of it: its red gate against the clouds, its fire, the lit stair winding up
    const HC = 470, Z = 2.5, hy = (lx) => 68 - camY / Z - Math.max(0, 90 - Math.abs(lx - HC) * 0.5) - vn(lx, 0, 30, 9) * 10;
    for (let x = 0; x < W; x++) { const lx = x + camX / Z, top = hy(lx); for (let y = Math.max(0, fl(top)); y < H; y++) BUF[y * W + x] = cel(R.ink, 1.6 + (y - top < 1.5 ? 1.2 : 0) + (vn(lx, y, 6, 12) > 0.7 ? 0.5 : 0), x, y); }
    const sx = HC - camX / Z, sy = hy(HC) + 2;
    for (let k = 0; k < 16; k++) { const u = k / 16, lx = HC + Math.sin(u * 9) * 18 - u * 6, ly = hy(HC) + 4 + u * 90; const x = lx - camX / Z; glow(x, ly, 5, tab('#ffb060', true), 0.5); put(fl(x), fl(ly), C('fire', 6)); }
    glow(sx, sy - 10, 46, tab('#ff9040', true), 0.55);
    for (const gx of [-16, 14]) for (let y = sy - 26; y < sy; y++) for (let x = sx + gx; x < sx + gx + 3; x++) put(fl(x), y, C('crimson', x === fl(sx + gx) ? 4 : 2));
    rectF(sx - 22, sy - 30, 44, 3, C('ink', 0)); rectF(sx - 19, sy - 24, 38, 2, C('ink', 1)); rectF(sx - 23, sy - 31, 4, 2, C('gold', 4)); rectF(sx + 19, sy - 31, 4, 2, C('gold', 4));
    fire(sx, sy - 1, 5, t, 9, { sparks: 6 });
    // the village's upper terraces between
    for (let row = 0; row < 2; row++) { const z = 3.2 - row * 1.0, base = 168 - camY / z + row * 14; for (let k = -2; k < 26; k++) { const lx = k * (34 + row * 10) + ih(k, row, 81) * 10, x = lx - camX / z; if (x < -40 || x > W + 40) continue; house(x, base - (lx / 16) * 5 / z * 0.8, 26 + row * 10, 12 + row * 4, 8 + row * 3, { seed: k * 7 + row, shade: -1 + row * 0.4, lit: 0.55 }); } }
    fog(110, 190, tab('#4a4f88'), 0.22, t, 3);
    // the street: houses lining the stair, eaves, paper lanterns; then the stone steps themselves, wet and shining
    for (let k = -1; k < 12; k++) {
      const hx = k * 84 + 30, x = hx - camX, base = stairY(hx) - camY - 2; if (x < -70 || x > W + 70) continue;
      house(x, base, 70, 44, 18, { seed: k + 40, shade: 0.2, lit: 0.7, chimney: k % 3 === 0 });
      lantern(x + 30, base - 50, 4, t, k);
      // a cloth sign over the door, stirring
      fillPoly([[x - 12, base - 38], [x + 4, base - 38], [x + 4 + Math.sin(t * 2 + k), base - 24], [x - 12 + Math.sin(t * 2 + k), base - 24]], (xx, yy) => cel(k % 2 ? R.indigo : R.crimson, 2.4 + (xx - x + 12 < 3 ? 1 : 0), xx, yy));
    }
    // the stair: worn treads catching the lantern light, dark risers, and the stone retaining wall beneath, in blocks
    for (let x = 0; x < W; x++) {
      const wx = x + camX, top = stairY(wx) - camY, ph = frac(Math.max(0, wx) / 16), riserCol = ph > 15 / 16;
      for (let y = Math.max(0, top); y < H; y++) {
        const d = y - top; let c;
        if (d < 2) c = cel(R.stone, 4.6 - d * 1.2 + (ih(fl(wx / 3), 0, 151) < 0.2 ? 0.8 : 0), x, y);
        else if (d < 5) c = cel(R.stone, 1.6 + (riserCol ? -0.6 : 0), x, y);
        else { const by = fl((y + camY) / 7), bx = fl((wx + (by & 1) * 6) / 12), mortar = ((y + camY) % 7 === 0) || ((wx + (by & 1) * 6) % 12 === 0);
          c = mortar ? C('ink', 2) : cel(R.stone, 1.9 + (ih(bx, by, 152) - 0.5) * 0.8 - d / 140 + (vn(wx * 0.2, y * 0.4, 3, 153) > 0.75 ? 0.7 : 0), x, y); }
        BUF[y * W + x] = c;
      }
    }
  }
  shot(7.5, 17.0, (lt, t) => {
    const mx = lerp(-30, 560, lt / 9.5), crane = eio(lin(5.6, 9.3, lt)), camX = mx - 200 + crane * 60, camY = stairY(mx) - 190 - crane * 90;
    villageSide(t, camX, camY);
    // Mira: the eight-drawing run on twos, a splash at each footfall, the lantern lagging behind her arm's swing
    const q = ON2(t), mq = mx, i = fl(q * 15), my = stairY(mq) - camY + 1, x = mq - camX;
    const swing = [0.3, 0.4, 0.22, -0.05, -0.3, -0.4, -0.22, 0.05][i % 8];
    LIGHT.x = 0.8; LIGHT.y = -0.5; ENV.edge = C('fire', 5);
    actor(MIRA, Object.assign({ t: q, face: { eyes: blinkK(q, 7) || 'open', smile: 0.7, blush: 1, mouth: i % 4 < 2 ? 0.2 : 0 }, propFar: (A) => lanternArt(A.hand[0], A.hand[1] + 1, t, true, swing) }, mrun(i)), Math.round(x), my, 1, 1);
    ENV.edge = null; glow(x - 4, my - 12, 22, tab('#ffb050', true), 0.35);
    if (i % 4 === 0) for (let k = 0; k < 7; k++) put(fl(x + 4 + (k - 3) * 2), fl(my - 1 - (3 - Math.abs(k - 3)) * 0.8 - (i % 8 === 0 ? 1 : 0)), C('sky', 6 + (k & 1)));
    // the near posts and lanterns rushing past
    for (let k = -1; k < 8; k++) { const fx = k * 150 + 60 - camX / 0.55; if (fx < -20 || fx > W + 20) continue; rectF(fx, 0, 7, H, C('ink', 0)); rectF(fx + 1, 0, 1, H, C('ink', 2)); lantern(fx + 14, 46 + Math.sin(k) * 10, 7, t, k + 20); }
    rain(t, 240, 0.18);
    view(240, lerp(150, 135, crane), lerp(2, 1, crane));
  });
