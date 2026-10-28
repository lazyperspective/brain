  /* ================================================================ COLD OPEN — the shrine above Emberwick, years ago */
  // poses: a side-view run (or walk) cycle at phase ph, k = stride in sprite px
  function runPose(P, ph, k, B) {
    const s = Math.sin(ph), c = Math.cos(ph);
    P.legs = [{ foot: [s * k, -Math.max(0, c) * k * 0.55] }, { foot: [-s * k, -Math.max(0, -c) * k * 0.55] }];
    P.arms = P.arms || [{ a: -s * 0.95, b: 0.7 }, { a: s * 0.95, b: 0.7 }];
    P.hip = -B.leg + Math.abs(s) * k * 0.12 - 0.5; P.lean = (P.lean || 0) + 1; P.wind = (P.wind || 0) + 1.5;
    return P;
  }
  const FIRE = [205, 206], MIRA_X = 236, SABLE_X = 268, FLOOR = 208;
  const FREEZE = 30.6;
  // the shrine stage at 1×: sky, ridges, the village below, the wet stone platform, the gate, lanterns and the fire
  function shrineStage(t, o) {
    o = o || {}; const rt = o.freeze !== undefined ? Math.min(t, o.freeze) : t;
    vgrad(0, 160, R.night, 0.8, 2.6);
    glow(352, 58, 60, tab('#8fa4d8', true), 0.3);
    fillEll(352, 58, 9, 9, 0, (x, y, u, v) => cel(R.hush, 6 - (u + v) * 0.9 - (Math.hypot(u - 0.3, v + 0.2) < 0.25 ? 1 : 0), x, y));
    cloudBank(78, 10, 6, R.night, 2.0, 3, rt, 1.5); cloudBank(44, 7, 7, R.dusk, 1.6, 5, rt, 1);
    ridge(140, 40, 70, 4, R.night, 1.4, 11, 0.8);
    ridge(160, 26, 50, 3, R.ink, 2.6, 17, 1);
    // three terraces of the village, far to near
    const T3 = [[146, -1.1, 18, 0.5], [162, -0.6, 24, 0.55], [180, 0, 32, 0.6]];
    T3.forEach(([yb, sh, w0, lit], row) => {
      for (let y = yb; y < yb + 30; y++) for (let x = 0; x < W; x++) BUF[y * W + x] = cel(R.ink, 1.6 + sh * 0.6 + (y - yb) / 40, x, y);
      for (let k = 0; k < 18; k++) {
        const x = -10 + k * (w0 * 1.3) + (row % 2) * w0 * 0.6 + ih(k, row, 71) * 8, w = w0 * (0.8 + ih(k, row, 72) * 0.4), h = w * 0.45;
        if (ih(k, row, 75) < 0.22) { fillEll(x, yb - h * 0.6, w * 0.4, h * 0.85, 0, (xx, yy, u, v) => cel(R.moss, 0.6 + sh * 0.5 - v * 0.8 + (vn(xx, yy, 2, 76) > 0.6 ? 0.6 : 0), xx, yy)); continue; }
        house(x, yb, w, h, h * 0.6, { seed: k + row * 19, shade: sh, lit, chimney: ih(k, row, 74) < 0.35 });
      }
    });
    // the lantern-lit stair climbing up to the shrine
    for (let k = 0; k < 9; k++) { const sx = 300 + Math.sin(k * 0.8) * 7, sy = 196 - k * 6; glow(sx, sy, 5, tab('#ffb060', true), 0.6); put(fl(sx), fl(sy), C('fire', 6)); }
    for (const [lx, ly] of LAMPS) if (ih(lx, ly, 9) < 0.04) glow(lx, ly, 6, tab('#ff9a40', true), 0.22);
    fog(132, 168, tab('#4a4f88'), 0.25, rt, 3);
    // the platform: wet stone flags, the fire's light pooled and its reflection broken by the rain
    for (let y = 188; y < H; y++) {
      const d = (y - 184) / 86, rowH = fl(Math.log(y - 182) * 7);
      for (let x = 0; x < W; x++) {
        const u = (x - 240) / (0.5 + d * 2.0), joint = Math.abs(frac(u / 18) - 0.5) > 0.46 || (Math.log(y - 182) * 7) % 1 < 0.13;
        const v = 1.5 + d * 1.2 + (joint ? -1 : 0) + (ih(fl(u / 18), rowH, 81) - 0.5) * 0.6, fd = Math.hypot((x - FIRE[0]) / 1.6, y - FIRE[1]);
        const wob = Math.sin(y * 1.7 + rt * 9) * 2, rx = Math.abs(x - FIRE[0] + wob), rf = o.fire !== 0 && rx < 12 && y > FIRE[1] + 6 && !joint && ih(fl((x + wob) / 2), y, fl(rt * 8)) < 0.55 ? (1 - rx / 12) * (1 - (y - FIRE[1] - 6) / 50) * 3.2 : 0;
        BUF[y * W + x] = rf > 0.5 ? cel(R.ember, 1.4 + rf, x, y) : cel(R.stone, v * 0.8 + (o.fire !== 0 ? Math.max(0, 1 - fd / 70) * 1.2 : 0), x, y);
      }
    }
    // the gate: two red pillars with stone feet, a black lintel with gold caps, paper charms tied on with rope
    for (const x0 of [148, 324]) {
      for (let y = 96; y < 214; y++) for (let x = x0; x < x0 + 10; x++) BUF[y * W + x] = cel(R.crimson, 2.4 - (x - x0) / 10 * 1.6 + (x - x0 < 2 ? 1.6 : 0) + ((y % 30) < 1 ? -1 : 0), x, y);
      for (let y = 206; y < 216; y++) for (let x = x0 - 3; x < x0 + 13; x++) BUF[y * W + x] = cel(R.stone, 2.6 - (x - x0) / 16 + (y === 206 ? 1 : 0), x, y);
      for (let k = 0; k < 3; k++) { const px = x0 + 2 + k * 3, py = 132 + k * 5; for (let y = 0; y < 7; y++) put(px, py + y, y === 0 ? C('linen', 4) : C('linen', 6)); }
    }
    for (let y = 92; y < 104; y++) for (let x = 132; x < 350; x++) BUF[y * W + x] = cel(R.ink, 1.2 + (y < 94 ? 1.4 : 0) + (y > 101 ? -0.6 : 0), x, y);
    for (let y = 106; y < 111; y++) for (let x = 140; x < 342; x++) BUF[y * W + x] = cel(R.ink, 1.6 + (y === 106 ? 1 : 0), x, y);
    for (const x0 of [130, 344]) for (let y = 90; y < 104; y++) for (let x = x0; x < x0 + 8; x++) BUF[y * W + x] = cel(R.gold, 3.6 - (y - 90) / 10, x, y);
    lantern(178, 128, 5, rt, 1); lantern(296, 126, 6, rt, 2);
    // the fire bowl
    fillPoly([[FIRE[0] - 5, FIRE[1] + 3], [FIRE[0] + 5, FIRE[1] + 3], [FIRE[0] + 7, FIRE[1] + 8], [FIRE[0] - 7, FIRE[1] + 8]], (x, y) => cel(R.stone, 2.4 - (x - FIRE[0]) / 10, x, y));
    fillEll(FIRE[0], FIRE[1], 11, 5, 0, (x, y, u, v) => (v < -0.2 ? -1 : cel(R.bronze, 4 - v * 2.2 - u * 0.8 + (Math.abs(v - 0.1) < 0.15 ? 1.2 : 0), x, y)));
    fillEll(FIRE[0], FIRE[1] - 1, 10, 2, 0, (x, y, u) => cel(R.ember, 3 + (1 - Math.abs(u)) * 2 + ih(x, y, fl(rt * 6)) * 1.2, x, y));
    if (o.fire !== 0) fire(FIRE[0], FIRE[1] - 1, 14 * (o.fire === undefined ? 1 : o.fire), rt, 4);
  }
  // after the figures: embers, rain (or rain hanging in the air), the night's cool cast
  function shrineAfter(t, o) {
    o = o || {};
    if (o.fire !== 0) embers(FIRE[0], FIRE[1] - 8, 30, 16, t, 7);
    rain(t, 220, 0.18, FLOOR + 6, o.freeze !== undefined && t > o.freeze ? o.freeze : undefined);
  }
  // the two of them by the fire. P0/P1: extra pose fields for Mira and Sable; the fire lights the sides that face it
  function mira(t, P, x, y, S, f) {
    LIGHT.x = x > FIRE[0] ? -1 : 1; LIGHT.y = -0.3; ENV.edge = C('fire', 5);
    const r = actor(MIRA, Object.assign({ t, propFar: (A) => lanternArt(A.hand[0], A.hand[1] + 1, t, P.lamp !== false) }, P), x, y, S || 1, f === undefined ? 1 : f);
    ENV.edge = null; return r;
  }
  function sable(t, P, x, y, S, f) {
    LIGHT.x = x > FIRE[0] ? -1 : 1; LIGHT.y = -0.3; ENV.edge = C('fire', 5);
    const r = actor(SABLE, Object.assign({ t }, P), x, y, S || 1, f === undefined ? -1 : f);
    ENV.edge = null; return r;
  }
  // Sable kneels on one knee, the sword across her lap, tying a red cord round the grip
  const KNEEL = { hip: -15, legs: [{ knee: [9, -9], foot: [9, 0] }, { knee: [-3, -1], foot: [-13, -1] }] };
  const kneelSword = (A, t) => swordArt(A.hand[0] - 1, A.hand[1] + 1, -PI / 2 - 0.55, 28, false);

  // a close-up's background: the stage seen nearer, out of focus (the frame px it covers, the blur radius)
  function closeBg(stage, fx, fy, Z, k) { stage(); view(fx, fy, Z); defocus(k || 3); }
  // rain in front of a close-up: big near drops, a few running down, all in focus (frozen: hang in the air)
  function nearRain(t, n, frozen) {
    const tt = frozen === undefined ? t : frozen;
    for (let k = 0; k < n; k++) {
      const sp = 330 + ih(k, 1, 61) * 160, x0 = ih(k, 2, 61) * (W + 60) - 30, y = ((tt * sp + ih(k, 3, 61) * 500) % (H + 60)) - 30, x = x0 + y * 0.18, len = frozen === undefined ? 16 : 3;
      for (let j = 0; j < len; j++) put(fl(x - j * 0.18), fl(y - j), j < 2 ? C('sky', 7) : C('sky', 5));
      if (frozen !== undefined) { put(fl(x) + 1, fl(y) - 1, C('fire', 6)); put(fl(x), fl(y) + 1, C('sky', 4)); }
    }
  }
  // the bust of a speaker by the fire: firelight from one side (side = +1: the fire is to the right of frame)
  function fireBust(who, t, P, x, y, f, side) {
    LIGHT.x = side; LIGHT.y = -0.25; ENV.edge = C('fire', 5);
    const r = bust(who, Object.assign({ t }, P), x, y, P.S || 3, f);
    ENV.edge = null; return r;
  }

  // 3 — the shrine (0:17): Mira runs up out of the rain with her lantern and skids to a stop
  shot(17.0, 20.3, (lt, t) => {
    shrineStage(t);
    const arrive = 1.25, run = lt < arrive, mx = run ? lerp(120, MIRA_X, eoc(lt / arrive) * 0.4 + lt / arrive * 0.6) : MIRA_X, skid = lt > arrive && lt < arrive + 0.25;
    const tk = talking('mira', t), hop = lt > arrive + 0.25 ? -Math.round(Math.abs(Math.sin(t * 6.5)) * (tk ? 2 : 0.6)) : 0;
    const P = run ? runPose({ face: { eyes: 'wide', smile: 0.6 } }, t * 15, 4, MIRA.body) : { hip: skid ? -13 : -16 + hop, lean: skid ? -2 : 0, wind: skid ? 2 : 0, face: { eyes: blink(t, 4) ? 'closed' : tk ? 'wide' : 'open', mouth: mouth('mira', t), smile: 0.8, blush: 1 }, arms: tk ? [{ a: 1.6 + Math.sin(t * 4.5) * 0.5, b: 0.4 }, { a: 0.3, b: 0.4 }] : skid ? [{ a: 1.2, b: 0.2 }, { a: 0.9 }] : [{ a: 0.4 }, { a: 0.3, b: 0.4 }], legs: skid ? [{ foot: [6, 0] }, { foot: [-4, 0] }] : [{ foot: [3, 0] }, { foot: [-3, 0] }] };
    const look = sstep(1.9, 2.3, lt);
    sable(t, Object.assign({}, KNEEL, { face: { eyes: blink(t, 3) ? 'closed' : look > 0.5 ? 'open' : 'half', brows: look > 0.5 ? 'up' : 'n', smile: 0.2 + look * 0.5, mouth: mouth('sable', t) }, arms: [{ hand: [10 + Math.sin(t * 6) * 1.2 * (1 - look), -17] }, { hand: [5 - Math.cos(t * 6) * 1.2 * (1 - look), -16] }], prop: kneelSword }), SABLE_X, FLOOR);
    mira(t, P, mx, FLOOR + 2);
    if (skid) for (let k = 0; k < 6; k++) put(mx - 6 - k * 2, FLOOR + 1 - (k & 1), C('sky', 6));
    shrineAfter(t); splashes(t, FLOOR - 2, H, 18, 3);
    view(lerp(222, 238, eio(lt / 3.3)), 168, lerp(1.6, 1.8, lt / 3.3));
  });
  // 3b — Mira, close (0:20): "I wrote my name on the wall, just like you showed me!", bouncing on her toes
  shot(20.3, 23.5, (lt, t) => {
    closeBg(() => shrineStage(t), 258, 168, 3, 3);
    const tk = talking('mira', t), hop = Math.round(Math.abs(Math.sin(t * 6.5)) * (tk ? 3 : 1));
    fireBust('mira', t, { face: { eyes: blink(t, 4) ? 'closed' : tk && lt < 1.5 ? 'wide' : 'open', mouth: mouth('mira', t), smile: tk ? 0.4 : 0.9, blush: 1 }, headY: -hop, headX: Math.round(Math.sin(t * 2) * 1) }, 200, H - 22 + 6 - hop * 2, 1, 1);
    glow(110, 210, 50, tab('#ffb050', true), 0.3);
    nearRain(t, 40);
  });
  // 4 — Sable, close (0:23): she laughs — "then the wall will remember you…"
  shot(23.5, 26.6, (lt, t) => {
    closeBg(() => shrineStage(t), 226, 168, 3, 3);
    fireBust('sable', t, { face: { eyes: blink(t, 3) ? 'closed' : lt < 1.6 ? 'happy' : 'open', mouth: mouth('sable', t), smile: 0.7, brows: 'up' }, headX: Math.round(Math.sin(t * 1.3) * 0.6) }, 296, H - 22 + 4, -1, -1);
    nearRain(t, 36);
  });
  // 4b — the two of them (0:26): she reaches over and pats the hood
  shot(26.6, 30.0, (lt, t) => {
    shrineStage(t);
    const up = sstep(0.4, 0.85, lt) * (1 - sstep(2.1, 2.6, lt)), pat = up > 0.6, tap = pat ? Math.max(0, Math.sin((lt - 0.85) * 11)) : 0;
    mira(t, { hip: -16 + (tap > 0.5 ? 1 : 0), face: { eyes: pat ? 'happy' : blink(t, 4) ? 'closed' : 'open', smile: 0.9, blush: 1 }, arms: [{ a: 0.4 }, { a: 0.3, b: 0.4 }], legs: [{ foot: [3, 0] }, { foot: [-3, 0] }] }, MIRA_X, FLOOR + 2);
    // her near arm lifts, over and down onto the hood, and taps twice
    const hx = lerp(9, 33, up), hy = lerp(-17, -45, up) + tap * 2;
    sable(t, Object.assign({}, KNEEL, { lean: up * 2, face: { eyes: blink(t, 3) ? 'closed' : lt > 1.5 ? 'half' : 'open', smile: 0.7, mouth: mouth('sable', t) }, arms: [{ hand: [hx, hy], bend: up > 0.3 ? 1 : -1 }, { hand: [5, -16] }], prop: up < 0.1 ? kneelSword : undefined, propFar: up >= 0.1 ? (A) => swordArt(A.hand[0] - 1, A.hand[1] + 1, -PI / 2 - 0.55, 28, false) : undefined }), SABLE_X, FLOOR);
    shrineAfter(t); splashes(t, FLOOR - 2, H, 18, 3);
    view(lerp(248, 251, lt / 3.4), 178, 2.6 + lt * 0.05);
  });

  // 5 — the rain stops in the air (0:30); she looks up
  shot(30.0, 32.4, (lt, t) => {
    const o = { freeze: FREEZE }, up = sstep(1.0, 1.5, lt);
    closeBg(() => shrineStage(t, o), 226, 166, 3, 3);
    fireBust('sable', t, { face: { eyes: lt > 1.0 ? 'wide' : blink(t, 3) ? 'closed' : 'open', brows: lt > 1.0 ? 'worried' : 'n', smile: lt > 0.7 ? 0 : 0.5 }, headY: -Math.round(up * 2), headX: Math.round(up) }, 296, H - 22 + 4, -1, -1);
    nearRain(t, 60, t > FREEZE ? FREEZE : undefined);
  });
