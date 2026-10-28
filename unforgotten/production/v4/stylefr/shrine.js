  // style frame: the shrine above Emberwick, at night, in the rain. Sable by the fire; Mira has just run up the steps.
  function draw(t) {
    LAMPS.length = 0;
    // the sky: deep blue-violet, a moon burning through a gap in the clouds
    vgrad(0, 150, R.night, 1.0, 2.6);
    glow(318, 74, 80, tab('#8fa4d8', true), 0.3);
    fillEll(318, 74, 10, 10, 0, (x, y, u, v) => cel(R.hush, 6 - (u + v) * 0.8, x, y));
    cloudBank(96, 12, 6, R.night, 2.0, 3, t, 1.5); cloudBank(60, 8, 7, R.dusk, 1.6, 5, t, 1);
    // far ridges, then the hill the village climbs
    ridge(150, 46, 70, 4, R.night, 1.4, 11, 0.8);
    ridge(176, 30, 50, 3, R.ink, 2.6, 17, 1);
    // the village below the shrine: three terraces, far to near, each a little warmer and more detailed
    const T3 = [[150, 0.3, -1.1, 24, 0.5], [168, 0.55, -0.6, 34, 0.55], [188, 0.85, 0, 46, 0.6]];
    T3.forEach(([yb, sc, sh, w0, lit], row) => {
      for (let y = yb; y < yb + 30; y++) for (let x = 0; x < W; x++) BUF[y * W + x] = soft(R.ink, 1.6 + sh * 0.6 + (y - yb) / 30, x, y);
      for (let k = 0; k < 12; k++) {
        const x = -10 + k * (w0 * 1.25) + (row % 2) * w0 * 0.6 + ih(k, row, 71) * 10, w = w0 * (0.8 + ih(k, row, 72) * 0.4), h = w * 0.42;
        if (Math.abs(x - 205) < 26) continue;
        if (ih(k, row, 75) < 0.25) { fillEll(x, yb - h * 0.6, w * 0.4, h * 0.8, 0, (xx, yy, u, v) => cel(R.moss, 0.6 + sh * 0.5 - v * 0.8 + (vn(xx, yy, 2, 76) - 0.5), xx, yy)); continue; }
        house(x, yb, w, h, h * 0.55, { seed: k + row * 13, shade: sh, lit, chimney: ih(k, row, 74) < 0.35 });
      }
    });
    for (let k = 0; k < 10; k++) { const sx = 205 + Math.sin(k * 0.8) * 8, sy = 214 - k * 7; glow(sx, sy, 7, tab('#ffb060', true), 0.6); put(fl(sx), fl(sy), C('fire', 6)); put(fl(sx), fl(sy) - 1, C('fire', 5)); }
    for (const [lx, ly] of LAMPS) if (ih(lx, ly, 9) < 0.05) glow(lx, ly, 7, tab('#ff9a40', true), 0.22);
    fog(140, 175, tab('#4a4f88'), 0.28, t, 3);
    // the shrine platform: wet stone flags in perspective, the fire reflected in them
    for (let y = 196; y < H; y++) {
      const d = (y - 190) / 80, rowH = fl(Math.log(y - 186) * 6);
      for (let x = 0; x < W; x++) {
        const u = (x - 220) / (0.6 + d * 2.2), joint = Math.abs(frac(u / 22) - 0.5) > 0.46 || (Math.log(y - 186) * 6) % 1 < 0.12;
        let v = 1.6 + d * 1.3 + (joint ? -1 : 0) + (ih(fl(u / 22), rowH, 81) - 0.5) * 0.6;
        // the fire's reflection on the wet stone: broken streaks that shimmer
        const wob = Math.sin(y * 1.7 + t * 9) * 3, rx = Math.abs(x - 218 + wob), rf = rx < 24 && y > 222 && !joint && ih(fl((x + wob) / 2), y, fl(t * 8)) < 0.55 ? (1 - rx / 24) * (1 - (y - 222) / 60) * 3.2 : 0;
        BUF[y * W + x] = rf > 0.5 ? soft(R.ember, 1.4 + rf, x, y) : soft(R.stone, v * 0.8 + (1 - Math.min(1, Math.abs(x - 218) / 120)) * 0.8, x, y);
      }
    }
    // the gate: two great red pillars framing the shot, a black lintel, lanterns hanging
    for (const [x0, w] of [[18, 22], [430, 26]]) for (let y = 22; y < H; y++) for (let x = x0; x < x0 + w; x++) BUF[y * W + x] = cel(R.crimson, 2.2 + (x - x0) / w * -1.4 + (x - x0 < 3 ? 1.6 : 0) + ((y % 34) < 2 ? -1.2 : 0), x, y);
    for (let y = 22; y < 40; y++) for (let x = 0; x < W; x++) BUF[y * W + x] = cel(R.ink, 1.4 + (y < 25 ? 1.2 : 0) + (y > 36 ? -0.8 : 0), x, y);
    lantern(92, 70, 9, t, 1); lantern(370, 64, 10, t, 2); lantern(150, 56, 7, t, 3);
    // the fire bowl
    // the fire bowl: a bronze basin on a squat stone foot
    fillPoly([[208, 222], [228, 222], [232, 230], [204, 230]], (x, y) => cel(R.stone, 2.4 - (x - 204) / 28 * 1.4, x, y));
    fillEll(218, 214, 22, 9, 0, (x, y, u, v) => (v < -0.2 ? -1 : cel(R.bronze, 4 - v * 2.2 - u * 0.8 + (Math.abs(v - 0.1) < 0.12 ? 1.2 : 0), x, y)));
    fillEll(218, 212, 21, 4, 0, (x, y, u, v) => cel(R.ember, 3 + (1 - Math.abs(u)) * 2 + ih(x, y, fl(t * 6)) * 1.2, x, y));
    fire(218, 210, 26, t, 4);
    // the two of them: firelight from the bowl on their faces
    LIGHT.x = 1; LIGHT.y = -0.4; ENV.edge = C('fire', 5);
    actor(MIRA, { t, face: { eyes: 'wide', mouth: 0.6, smile: 0.4, blush: 1 }, arms: [{ a: 1.5, b: 0.4 }, { a: 0.25, b: 0.4 }], legs: [{ foot: [3, 0] }, { foot: [-3, 0] }], propFar: (A) => lanternArt(A.hand[0], A.hand[1] + 1, t, true) }, 146, 236, 2, 1);
    glow(146 - 3 * 2, 236 - 18, 26, tab('#ffb050', true), 0.35);
    LIGHT.x = -1; LIGHT.y = -0.4;
    actor(SABLE, { t, hip: -15, lean: 1, face: { eyes: 'open', smile: 0.6, brows: 'up' }, arms: [{ hand: [10, -18] }, { hand: [4, -16] }], legs: [{ knee: [9, -9], foot: [9, 0] }, { knee: [-3, -1], foot: [-13, -1] }], prop: (A) => swordArt(A.hand[0] - 9, A.hand[1] + 1, PI / 2 - 0.1, 30, false) }, 292, 230, 2, -1);
    ENV.edge = null;
    embers(218, 200, 40, 30, t, 7);
    rain(t, 260, 0.18, 230);
    letterbox(22);
  }
