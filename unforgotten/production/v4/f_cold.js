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
    fireBowl(rt, o.fire);
  }
  // the fire bowl and its flame (drawn again in front of anyone passing behind it)
  function fireBowl(rt, fo, again) {
    fillPoly([[FIRE[0] - 5, FIRE[1] + 3], [FIRE[0] + 5, FIRE[1] + 3], [FIRE[0] + 7, FIRE[1] + 8], [FIRE[0] - 7, FIRE[1] + 8]], (x, y) => cel(R.stone, 2.4 - (x - FIRE[0]) / 10, x, y));
    fillEll(FIRE[0], FIRE[1], 11, 5, 0, (x, y, u, v) => (v < -0.2 ? -1 : cel(R.bronze, 4 - v * 2.2 - u * 0.8 + (Math.abs(v - 0.1) < 0.15 ? 1.2 : 0), x, y)));
    fillEll(FIRE[0], FIRE[1] - 1, 10, 2, 0, (x, y, u) => cel(R.ember, 3 + (1 - Math.abs(u)) * 2 + ih(x, y, fl(rt * 6)) * 1.2, x, y));
    if (fo !== 0) fire(FIRE[0], FIRE[1] - 1, 14 * (fo === undefined ? 1 : fo), rt, 4, again ? { glow: false, sparks: 0 } : undefined);
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


  /* ---------------------------------------------------------------- the shrine scene, acted (0:17–0:32)
     Every character drawing is held on twos (ON2) and every move is keyed: anticipation, action, overshoot, settle. */
  // Mira's run: eight drawings (contact, down, passing, up, then the same off the other foot), two frames each
  const MRUN = [
    { hip: -15, lean: 2, legs: [{ foot: [6, 0] }, { foot: [-6, -4] }], arms: [{ a: -0.9, b: 1.0 }, { a: 1.1, b: 1.0 }] },
    { hip: -13.5, lean: 3, legs: [{ foot: [3, 0] }, { foot: [-4, -6] }], arms: [{ a: -0.6, b: 1.1 }, { a: 0.8, b: 1.1 }] },
    { hip: -14.5, lean: 3, legs: [{ foot: [-1, 0] }, { foot: [1, -7] }], arms: [{ a: 0, b: 1.0 }, { a: 0.1, b: 1.0 }] },
    { hip: -16.5, lean: 2, legs: [{ foot: [-5, -1] }, { foot: [5, -4] }], arms: [{ a: 0.9, b: 1.0 }, { a: -0.8, b: 1.0 }] },
  ];
  const mrun = (i) => { const D = MRUN[i % 4]; if (i % 8 < 4) return D; return Object.assign({}, D, { legs: [D.legs[1], D.legs[0]], arms: [D.arms[1], D.arms[0]] }); };
  // where she is: running in, then the skid
  const MX = [[17.0, 150], [18.1, 226, 'lin'], [18.42, 236, 'out']];
  const miraX = (t) => key(MX, t);
  // the hops of "I wrote it!": [time, height above the floor, squash (hip offset)]
  const MHOP = [[18.42, 0], [19.08, 0], [19.14, 0, 'lin'], [19.26, 5, 'out'], [19.36, 0, 'in'], [19.5, 0], [19.56, 3, 'out'], [19.66, 0, 'in']];
  const MSQ = [[18.1, 0], [18.18, 3, 'out'], [18.42, 2], [18.47, -1.5, 'out'], [18.6, 0], [19.08, 0], [19.14, 2.5, 'out'], [19.2, -1.5], [19.36, 0], [19.4, 3, 'out'], [19.5, 0, 'back'], [19.66, 0], [19.7, 2, 'out'], [19.8, 0, 'back']];

  // 3 — the shrine (0:17): Mira runs up the last steps out of the rain, skids, and bursts out with it
  shot(17.0, 19.95, (lt, t) => {
    const q = ON2(t);
    shrineStage(t);
    // Sable, kneeling, tying the red cord round her grip until she hears her name; her head comes up first, then her shoulders
    const up = key([[18.5, 0], [18.66, 1, 'out']], q), sit = key([[18.6, 0], [18.8, 1, 'back']], q), sm = key([[18.9, 0.15], [19.4, 0.75]], q);
    const tie = (1 - sstep(18.5, 18.6, q)), loop = fl(q * 7.5) % 4;
    const SB = blinkK(q, 3);
    sable(t, Object.assign({}, KNEEL, { lean: Math.round(-1 + sit), headY: Math.round(1 - up), headX: Math.round(up * (q > 19.3 ? 1 : 0)), face: { eyes: SB || (up > 0.5 ? 'open' : 'half'), brows: up > 0.5 ? 'up' : 'n', smile: sm, mouth: mouth('sable', q) }, arms: [{ hand: [10 + [0, 1, 1, 0][loop] * tie, -17 - [0, 0, 1, 1][loop] * tie] }, { hand: [5 + [1, 0, 0, 1][loop] * tie, -16] }], prop: kneelSword }), SABLE_X, FLOOR);
    // Mira
    const x = miraX(q), run = q < 18.1, skid = q >= 18.1 && q < 18.42, hop = key(MHOP, q), sq = key(MSQ, q);
    let P;
    if (run) P = Object.assign({ face: { eyes: 'wide', smile: 0.7, blush: 1 } }, mrun(fl(q * 15)));
    else if (skid) P = { hip: -16 + sq, lean: -3, wind: 2, face: { eyes: 'wide', smile: 0.4, blush: 1, mouth: 0.3 }, legs: [{ foot: [8, 0] }, { foot: [-3, 0] }], arms: [{ a: 2.0, b: 0.3 }, { a: 1.6, b: 0.3 }] };
    else {
      const tk = talking('mira', q), burst = key([[18.42, 0], [18.5, 1, 'out'], [18.9, 1], [19.05, 0.3]], q), air = hop > 0.5;
      P = { hip: -16 + sq, lean: Math.round(burst), face: { eyes: blinkK(q, 4) || (tk || burst > 0.5 ? 'wide' : 'open'), mouth: mouth('mira', q), smile: 0.8, blush: 1 },
        arms: burst > 0.5 ? [{ a: 2.9, b: 0.2 }, { a: 2.4, b: 0.3 }] : air ? [{ a: 2.3, b: 0.4 }, { a: 1.8, b: 0.6 }] : [{ a: 1.5, b: 1.6 }, { a: 0.9, b: 1.2 }],
        legs: air ? [{ foot: [3, -3] }, { foot: [-3, -2] }] : [{ foot: [3, 0] }, { foot: [-3, 0] }] };
    }
    // her lantern swings from her far hand, a pendulum driven by her own run and stop
    const sw = pendulum(miraX, 17.0, q, 7, 2.2);
    P.propFar = (A) => lanternArt(A.hand[0], A.hand[1] + 1, t, true, sw);
    mira(t, P, Math.round(x), FLOOR + 1 - Math.round(hop));
    if (x > 186 && x < 226) fireBowl(t, 1, true);
    if (skid) for (let k = 0; k < 7; k++) { const g = (q - 18.1) / 0.32; put(fl(x - 4 - k * 2 - g * 3), fl(FLOOR + 1 - (k & 1) - ih(k, fl(q * 15), 31) * 4 * (1 - g)), C('sky', 6 + (k & 1))); }
    if (q >= 18.1 && q < 18.2) shk(1);
    shrineAfter(t); splashes(t, FLOOR - 2, H, 18, 3);
    // the camera picks her up on the stair and runs with her, overshooting a touch as she stops
    const cx = key([[17.0, 196], [18.2, 247, 'io'], [18.5, 244, 'back'], [19.95, 246]], t);
    view(cx, 171, 2);
  });

  // 3b — Mira, close (0:20): "…I wrote my name on the wall, just like you showed me!" — she points back at it,
  // swings round to Sable, clasps her hands and bounces
  shot(19.95, 23.4, (lt, t) => {
    const q = ON2(t);
    closeBg(() => shrineStage(t), key([[19.95, 252], [23.4, 260]], t), 168, 3, 3);
    const turn = key([[20.05, 0], [20.3, -1.2, 'out'], [20.4, -1], [21.15, -1], [21.32, 0.5, 'out'], [21.45, 0.2, 'io']], q);
    const point = key([[20.05, 0], [20.38, 1, 'back'], [21.12, 1], [21.35, 0, 'in']], q), pump = accent('mira', q) * (q < 21.2 ? 1 : 0);
    const clasp = key([[21.38, 0], [21.6, 1, 'back'], [22.9, 1], [23.3, 0.7]], q);
    const beam = key([[22.2, 0], [22.3, 1, 'out']], q), tilt = key([[20.0, 0], [21.5, 0], [22.35, 0.13, 'back'], [23.4, 0.09]], q) + accent('mira', q) * 0.05;
    const bounce = q > 21.38 && q < 22.5 ? accent('mira', q) * 4 : 0, land = key([[19.95, -3], [20.02, 1, 'in'], [20.12, 0, 'back']], q);
    const hands = [];
    if (point > 0.02) hands.push({ from: [-14, 8], at: [lerp(-12, -21, point), lerp(8, -20, point) - pump * 2], pose: 'point', dir: [-0.5, -0.86] });
    if (clasp > 0.02) { hands.push({ from: [-12, 8], at: [lerp(-12, -4, clasp), lerp(10, -17, clasp)], pose: 'fist' }); hands.push({ from: [14, 8], at: [lerp(14, 8, clasp), lerp(10, -17, clasp)], pose: 'fist' }); }
    const F = { eyes: blinkK(q, 4) || (beam > 0.5 ? 'happy' : q < 21.3 ? 'wide' : 'wide'), look: q < 21.25 ? -2 : 1, mouth: mouth('mira', q), ee: syllable('mira', q) % 2, smile: beam > 0.5 ? 1 : 0.5, blush: 1, browUp: Math.round(accent('mira', q)) };
    const yb = Math.round(-bounce + land), sqz = q > 21.38 && q < 22.5 ? 1 - Math.max(0, accent('mira', q - 0.12) - 0.5) * 0.1 : land > 0.5 ? 0.95 : 1;
    fireBust('mira', t, { face: F, turn, tilt, hands, sy: sqz, sx: 2 - sqz, strings: Math.round(springTo((tt) => -bounce * 0.3 + turn * 2, 19.95, q, 120, 9)), fringe: Math.round(turn * -0.6) }, 200 + Math.round(key([[19.95, 0], [23.4, -4]], t)), H - 22 + 6 + yb, 1, 1);
    glow(110, 210, 50, tab('#ffb050', true), 0.3);
    nearRain(t, 40);
  });

  // 4 — Sable, close (0:23): she watches, her smile grows, a quiet laugh, then warmly — "Then the wall will remember you."
  function sableClose(t, q, P, o) {
    o = o || {};
    closeBg(() => shrineStage(t, o.stage), o.fx || 226, o.fy || 168, 3, 3);
    fireBust('sable', t, P, 296 + (o.dx || 0), H - 22 + 4 + (o.dy || 0), -1, -1);
    nearRain(t, o.rain || 36, o.frozen);
  }
  shot(23.4, 27.15, (lt, t) => {
    const q = ON2(t);
    const sm = key([[23.4, 0.25], [24.2, 0.6], [24.55, 1, 'out'], [25.3, 1], [25.5, 0.7]], q), laugh = q > 24.55 && q < 25.3;
    const tilt = key([[23.4, 0.02], [24.55, 0.02], [24.7, -0.09, 'out'], [25.25, -0.06], [25.45, 0.07, 'back'], [27.15, 0.06]], q) + accent('sable', q) * 0.05;
    const shake = laugh ? (fl(q * 15) % 2 ? -1 : 0) : 0, breath = key([[24.1, 0], [24.4, -1, 'io'], [24.55, 0]], q);
    const eyes = blinkK(q, 5) || (laugh ? 'happy' : q < 24.4 ? 'open' : 'half');
    sableClose(t, q, { face: { eyes, look: q < 24.5 ? 1 : 0, smile: sm, mouth: laugh ? 0 : mouth('sable', q), ee: syllable('sable', q) % 2, browUp: q > 25.4 ? 1 : 0 }, tilt, turn: key([[25.3, 0], [25.6, -0.5]], q), headY: Math.round(accent('sable', q)) }, { dy: shake + breath, dx: Math.round(key([[23.4, 2], [27.15, -1]], t)) });
  });

  // 4b — the two of them (0:27): "Even when I'm old and forgetful." She reaches over in an arc and pats the hood twice
  const PAT = [[27.15, [9, -17]], [27.35, [7, -14], 'io'], [27.58, [22, -30], 'out'], [27.72, [33, -42], 'out'], [27.82, [32, -39], 'back'],
    [28.0, [32, -42], 'out'], [28.08, [32, -38], 'in'], [28.32, [32, -42], 'out'], [28.4, [32, -38], 'in'],
    [28.6, [30, -39]], [28.8, [34, -39]], [29.0, [31, -39]], [29.2, [33, -39]], [29.45, [32, -40]], [29.75, [21, -28], 'io'], [29.95, [9, -17], 'out']];
  const PAT_HIT = [27.82, 28.08, 28.4];
  shot(27.15, 30.0, (lt, t) => {
    const q = ON2(t);
    shrineStage(t);
    const hand = key(PAT, q), away = q > 27.4 && q < 29.85, reach = key([[27.3, 0], [27.7, 2, 'out'], [29.5, 2], [29.95, 0]], q);
    // each landing pushes her down a pixel and squeezes her eyes shut; she giggles and leans into it
    let hit = 0; for (const h of PAT_HIT) { const d = q - h; if (d >= 0 && d < 0.14) hit = 1; }
    const giggle = q > 28.45 && q < 29.4 ? (fl(q * 7.5) % 2) : 0, after = key([[29.5, 0], [29.8, 1, 'out']], q);
    mira(t, { hip: -16 + hit + giggle, lean: q > 28.5 && q < 29.5 ? 1 : 0, headY: hit, face: { eyes: hit || (q > 27.8 && q < 29.6) ? 'happy' : blinkK(q, 4) || 'open', smile: 1, blush: 1, mouth: giggle ? 0.2 : 0 }, arms: [{ a: 0.5 + after * 0.6, b: 0.6 + after * 0.6 }, { a: 0.3, b: 0.4 }], legs: [{ foot: [3, 0] }, { foot: [-3, 0] }], propFar: (A) => lanternArt(A.hand[0], A.hand[1] + 1, t, true, pendulum((tt) => (giggle ? 0.6 : 0) + hit * 0.8 + tt * 0, 27.15, q, 7, 2) + Math.sin(q * 3) * 0.12) }, MIRA_X, FLOOR + 2);
    const shakeHead = q > 28.9 && q < 29.25 ? (fl(q * 7.5) % 2 ? 1 : -1) : 0;
    sable(t, Object.assign({}, KNEEL, { lean: Math.round(reach), headX: shakeHead, face: { eyes: blinkK(q, 3) || 'half', smile: 0.75, mouth: mouth('sable', q) }, arms: [{ hand, bend: -1 }, { hand: [5, -16] }], prop: away ? undefined : kneelSword, propFar: away ? (A) => swordArt(A.hand[0] - 1, A.hand[1] + 1, -PI / 2 - 0.55, 28, false) : undefined }), SABLE_X, FLOOR);
    shrineAfter(t); splashes(t, FLOOR - 2, H, 18, 3);
    view(key([[27.15, 254], [30.0, 250]], t), key([[27.15, 180], [30.0, 178]], t), 3);
  });

  // 5 — the rain stops in the air (0:30). She hasn't noticed; then she has: the smile goes, the eyes go up, the head follows
  shot(30.0, 32.4, (lt, t) => {
    const q = ON2(t), o = { freeze: FREEZE };
    const sm = key([[30.85, 0.6], [30.95, 0, 'in']], q), alarm = key([[31.05, 0], [31.4, 1, 'back']], q);
    const breathe = q < FREEZE ? (Math.sin(q * 2.4) > 0.3 ? -1 : 0) : 0;
    const F = { eyes: q < 30.95 ? (blinkK(q, 6) || 'half') : q < 31.15 ? 'open' : 'wide', look: q < 30.95 ? 1 : 0, lookY: q >= 30.95 ? -1 : 0, brows: q > 31.15 ? 'worried' : 'n', smile: sm };
    sableClose(t, q, { face: F, tilt: lerp(0.05, -0.15, alarm), turn: alarm * 0.4, headY: -Math.round(alarm * 2) }, { stage: o, frozen: t > FREEZE ? FREEZE : undefined, rain: 60, dy: breathe - Math.round(key([[31.2, 0], [32.4, 3]], t)), dx: Math.round(key([[31.2, 0], [32.4, 2]], t)), fy: key([[30.0, 168], [32.4, 162]], t) });
    if (t > FREEZE) tintAll(tab('#8090c0', true), Math.min(0.12, (t - FREEZE) * 0.08));
  });
