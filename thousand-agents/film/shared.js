/* 1000 Agents — the film. Shared constants and pure functions used by every section, the compositor and the live page.
   Everything here is a pure function of film time T (seconds, 0..40) and of seeded hashes. No Math.random, no Date.
   Loaded as a plain <script> in pages (window.FILM) and with require() in node (module.exports). */
(function (root) {
  'use strict';
  const F = {};
  F.W = 1920; F.H = 1080; F.FPS = 30; F.DUR = 40; F.FRAMES = 1200; F.N = 1000;
  const PI = Math.PI, TAU = PI * 2;

  /* ---------------------------------------------------------------- maths */
  const clamp = (x, a, b) => x < a ? a : x > b ? b : x;
  const sat = (x) => x < 0 ? 0 : x > 1 ? 1 : x;
  const lerp = (a, b, u) => a + (b - a) * u;
  const ss = (a, b, x) => { const u = sat((x - a) / (b - a)); return u * u * (3 - 2 * u); };
  const pulse = (a, b, c, d, x) => ss(a, b, x) * (1 - ss(c, d, x));
  const eo = (u) => 1 - Math.pow(1 - sat(u), 3);
  const eio = (u) => { u = sat(u); return u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2; };
  const backOut = (u, c) => { c = c == null ? 1.7 : c; u = sat(u) - 1; return 1 + (c + 1) * u * u * u + c * u * u; };
  const frac = (x) => x - Math.floor(x);
  function hash(a, b) {                       // seeded hash -> [0,1)
    let h = Math.imul(a | 0, 374761393) ^ Math.imul((b | 0) + 0x9e37, 668265263);
    h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; h = Math.imul(h, 2246822519); h ^= h >>> 13;
    return (h >>> 0) / 4294967296;
  }
  function vn1(x, s) { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return lerp(hash(i, s), hash(i + 1, s), u); }
  function vn2(x, y, s) {
    const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy, ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
    const h00 = hash(ix * 7919 + iy * 104729, s), h10 = hash((ix + 1) * 7919 + iy * 104729, s);
    const h01 = hash(ix * 7919 + (iy + 1) * 104729, s), h11 = hash((ix + 1) * 7919 + (iy + 1) * 104729, s);
    return lerp(lerp(h00, h10, ux), lerp(h01, h11, ux), uy);
  }
  function keys(K, t) {                       // [[t, v], ...] eased
    if (t <= K[0][0]) return K[0][1];
    for (let i = 1; i < K.length; i++) if (t < K[i][0]) return lerp(K[i - 1][1], K[i][1], ss(K[i - 1][0], K[i][0], t));
    return K[K.length - 1][1];
  }
  F.m = { clamp, sat, lerp, ss, pulse, eo, eio, backOut, frac, hash, vn1, vn2, keys, PI, TAU };

  /* ---------------------------------------------------------------- palette (sRGB 0..255) */
  F.C = {
    coral: [217, 119, 87], shade: [168, 85, 59], light: [242, 165, 133], dark: [110, 42, 26], cream: [255, 226, 207],
    lilac: [169, 163, 230], violet: [108, 100, 189], vdim: [55, 51, 107], vdeep: [27, 24, 56],
    teal: [95, 214, 196], ink: [10, 7, 22],
  };
  F.hex = (c) => '#' + c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');

  /* ---------------------------------------------------------------- timeline
     A section renders its own span plus the transition overlaps on either side. Transition k is centred on F.X[k].t. */
  F.XW = 0.8;                                  // transition length (s)
  F.X = [
    { t: 5.0,  from: '07-ink-sketch',       to: '01-iso-pixel',        kind: 'sweep'  },
    { t: 10.5, from: '01-iso-pixel',        to: '02-paper-cut',        kind: 'curtain' },
    { t: 16.0, from: '02-paper-cut',        to: '05-vector-wireframe', kind: 'bloom'  },
    { t: 22.0, from: '05-vector-wireframe', to: '04-voxel',            kind: 'blocks' },
    { t: 27.0, from: '04-voxel',            to: '03-low-poly-3d',      kind: 'spiral' },
    { t: 32.0, from: '03-low-poly-3d',      to: '06-clay-3d',          kind: 'pour'   },
  ];
  F.SECTIONS = [
    { slot: '07-ink-sketch',       t0: 0.0,  t1: 5.0,  stage: 'SKETCH' },
    { slot: '01-iso-pixel',        t0: 5.0,  t1: 10.5, stage: 'CODE' },
    { slot: '02-paper-cut',        t0: 10.5, t1: 16.0, stage: 'MODULES' },
    { slot: '05-vector-wireframe', t0: 16.0, t1: 22.0, stage: 'KERNEL' },
    { slot: '04-voxel',            t0: 22.0, t1: 27.0, stage: 'KERNEL' },
    { slot: '03-low-poly-3d',      t0: 27.0, t1: 32.0, stage: 'BOOT' },
    { slot: '06-clay-3d',          t0: 32.0, t1: 40.0, stage: 'DESKTOP' },
  ];
  F.section = (slot) => F.SECTIONS.find((s) => s.slot === slot);
  // the film-time span a section must render (its own span + half a transition either side)
  F.span = (slot) => { const s = F.section(slot); return [Math.max(0, s.t0 - (s.t0 > 0 ? F.XW / 2 : 0)), Math.min(F.DUR, s.t1 + (s.t1 < F.DUR ? F.XW / 2 : 0))]; };
  F.frameSpan = (slot) => { const sp = F.span(slot); return [Math.round(sp[0] * F.FPS), Math.min(F.FRAMES - 1, Math.round(sp[1] * F.FPS))]; };
  // which sections are visible at T, and the transition progress
  F.at = (T) => {
    for (let k = 0; k < F.X.length; k++) {
      const x = F.X[k], a = x.t - F.XW / 2, b = x.t + F.XW / 2;
      if (T >= a && T < b) return { k, p: (T - a) / F.XW, from: x.from, to: x.to };
    }
    let cur = F.SECTIONS[0].slot;
    for (const s of F.SECTIONS) if (T >= s.t0) cur = s.slot;
    return { k: -1, p: 0, from: cur, to: null };
  };

  /* ---------------------------------------------------------------- the anchor (screen space, 1920x1080)
     At every transition the hero stands with its feet's centre at (ANCHOR.x, ANCHOR.gy); body width ~bodyW px, the
     top of its body ~h px above the ground. The thing being built sits right of centre, on the same ground line. */
  F.ANCHOR = { x: 780, gy: 742, bodyW: 250, h: 206 };
  F.BUILD = { x: 1215, gy: 742 };

  /* ---------------------------------------------------------------- the hero's performance (shared by every style)
     dx: offset from the anchor in body widths (+ right); lift: hop height in body heights; sq: squash (+ squashed, - stretched);
     lean (rad, + leans right); air 0..1; look [x, y] in -1..1 (+x right, +y up); blink 0..1; mouth 0..1; arm 0..1 (right arm up);
     point 0..1 (right arm held out, pointing); turn -1..1 (3D yaw hint: 0 = the anchor's 3/4 view, + toward the build); joy 0..1. */
  const HOPS = [
    // t0, t1, dx0, dx1, height
    [-0.06, 0.40, -4.30, -2.85, 0.62],
    [0.47, 0.88, -2.85, -1.42, 0.55],
    [0.95, 1.38, -1.42, 0.00, 0.44],
    [2.58, 2.92, 0, 0, 0.42],                  // the signal
    [6.00, 6.36, 0, 0.32, 0.16],               // CODE: walks the grid toward the stacks
    [6.42, 6.78, 0.32, 0.62, 0.16],
    [7.62, 7.92, 0.62, 0.62, 0.30],            // a stack completes
    [8.70, 9.00, 0.62, 0.62, 0.24],
    [9.10, 9.46, 0.62, 0.31, 0.16],            // and walks back
    [9.52, 9.88, 0.31, 0.00, 0.16],
    [14.86, 15.16, 0, 0, 0.22],                // MODULES: the last one clicks
    [17.70, 18.08, 0, -0.38, 0.20],            // KERNEL: steps back as it grows
    [20.70, 21.10, -0.38, 0, 0.26],            //         and returns
    [24.62, 24.96, 0, 0, 0.46],                // ALIVE: hops in delight at the pulse
    [25.02, 25.30, 0, 0, 0.26],
    [30.86, 31.18, 0, 0, 0.30],                // BOOT: the bar completes
    [36.66, 37.02, 0, 0.62, 0.34],             // DESKTOP: hops over to the login panel
    [37.10, 37.46, 0.62, 1.12, 0.26],
  ];
  F.HOPS = HOPS;
  const LOOK_X = [[0, 0.6], [1.38, 0.6], [1.5, 1], [1.8, 1], [1.88, -1], [2.12, -1], [2.2, 0.9], [2.5, 0.8], [3.0, 0.7], [4.3, 0.55], [4.6, 0.35],
    [5.6, 0.4], [6.0, 0.8], [7.0, 0.9], [8.0, 0.6], [9.0, 0.7], [9.9, 0.4],
    [11.1, 0.6], [11.6, 0.9], [12.4, 0.6], [13.2, 0.9], [14.0, 0.5], [14.8, 0.8], [15.4, 0.4],
    [16.6, 0.7], [18.5, 0.8], [20.5, 0.6], [21.4, 0.4],
    [22.6, 0.7], [24.0, 0.8], [25.6, 0.6], [26.4, 0.4],
    [27.6, 0.7], [29.0, 0.9], [31.4, 0.4],
    [32.6, 0.5], [33.0, 0.2], [33.8, 1.0], [34.6, 0.5], [35.3, 0.9], [36.2, 0.7], [37.6, -0.15], [40, -0.2]];
  const LOOK_Y = [[0, 0], [1.4, 0], [1.5, -0.25], [1.8, -0.25], [1.88, 0.1], [2.12, 0.1], [2.2, 0], [3.0, 0.45], [3.4, 0.7], [4.3, 0.5], [4.6, 0.1],
    [5.6, 0.1], [6.0, -0.2], [7.0, -0.3], [8.0, 0.0], [9.0, -0.1], [9.9, 0.05],
    [11.1, 0.2], [12.5, 0.35], [14.0, 0.25], [15.4, 0.05],
    [16.6, 0.3], [18.5, 0.7], [20.5, 0.5], [21.4, 0.1],
    [22.6, 0.35], [24.2, 0.5], [25.6, 0.35], [26.4, 0.1],
    [27.6, 0.25], [29.0, 0.35], [31.4, 0.1],
    [32.6, 0.2], [33.0, 0.45], [34.6, 0.5], [36.2, 0.3], [37.6, -0.05], [40, -0.1]];
  const BLINKS = [0.72, 2.16, 3.92, 5.82, 7.30, 8.35, 11.0, 12.9, 14.4, 16.9, 19.3, 21.9, 23.4, 26.1, 28.3, 29.9, 33.4, 35.9, 38.25];
  F.heroAt = function (T) {
    const s = { dx: 0, lift: 0, sq: 0, lean: 0, air: 0, look: [0, 0], blink: 0, mouth: 0, arm: 0, point: 0, turn: 0, joy: 0, hopI: -1, moving: 0 };
    let land = -99, amp = 0;
    for (let i = 0; i < HOPS.length; i++) {
      const h = HOPS[i];
      if (T >= h[1]) { s.dx = h[3]; land = h[1]; amp = h[4]; continue; }
      if (T >= h[0]) {
        const u = (T - h[0]) / (h[1] - h[0]);
        s.dx = lerp(h[2], h[3], ss(0, 1, u) * 0.3 + u * 0.7);
        s.lift = h[4] * 4 * u * (1 - u); s.air = Math.sin(PI * u);
        s.sq = -0.13 * s.air * Math.min(1, h[4] / 0.4) + 0.12 * Math.max(0, 1 - u / 0.12) * (u < 0.12 ? 1 : 0);
        s.lean = (h[3] - h[2]) * 0.06 * Math.cos(PI * u) + (h[3] !== h[2] ? 0.04 * Math.sign(h[3] - h[2]) : 0);
        s.hopI = i; s.moving = 1; land = -99;
        break;
      }
      // anticipation dip before the next take-off
      s.sq += 0.13 * pulse(h[0] - 0.09, h[0] - 0.02, h[0] - 0.01, h[0], T) * Math.min(1, h[4] / 0.3);
      break;
    }
    if (land > -50) { const dt = T - land; s.sq += (0.08 + 0.32 * amp) * Math.exp(-dt * 11) * Math.cos(dt * 24); }
    s.sq += 0.014 * Math.sin(T * 4.6 + 0.6) * (1 - s.moving);                      // breathing
    s.look = [keys(LOOK_X, T), keys(LOOK_Y, T)];
    let bl = 0;
    for (const b of BLINKS) bl = Math.max(bl, 1 - Math.abs(T - b) / 0.07);
    s.blink = sat(bl * 1.7);
    // the signal (2.6 s): arm up, mouth open; the pointing in CODE; delight at the pulse; the last hop's call
    s.arm = Math.max(pulse(2.5, 2.66, 3.25, 3.75, T), 0.85 * pulse(24.55, 24.68, 25.3, 25.7, T), 0.7 * pulse(30.8, 30.95, 31.25, 31.5, T));
    s.point = pulse(6.85, 7.05, 7.55, 7.75, T) * 0.9 + pulse(8.15, 8.3, 8.62, 8.75, T) * 0.7;
    s.mouth = Math.max(pulse(2.56, 2.64, 2.95, 3.08, T), pulse(24.6, 24.68, 25.0, 25.15, T), 0.6 * pulse(7.62, 7.68, 7.8, 7.9, T), 0.5 * pulse(30.88, 30.95, 31.1, 31.2, T));
    s.joy = pulse(24.5, 24.6, 25.4, 26.0, T);
    s.turn = keys([[0, 0.5], [1.38, 0.35], [1.5, 0.5], [1.88, -0.5], [2.12, -0.5], [2.25, 0.3], [4.4, 0.0],
      [5.6, 0], [5.95, 0.6], [9.0, 0.6], [9.9, 0],
      [11.1, 0], [12.0, 0.25], [15.4, 0],
      [16.6, 0], [17.6, 0.3], [21.2, 0.2], [21.4, 0],
      [22.6, 0], [23.5, 0.3], [26.4, 0],
      [27.6, 0], [28.5, 0.25], [31.4, 0],
      [32.6, 0], [36.4, 0.15], [36.6, 0.5], [37.5, 0.3], [38.2, -0.15], [40, -0.2]], T);
    s.lean += -0.05 * ss(3.0, 3.4, T) * (1 - ss(4.2, 4.5, T)) - 0.04 * ss(18.0, 18.6, T) * (1 - ss(20.4, 20.7, T));
    return s;
  };

  /* ---------------------------------------------------------------- the swarm: 1000 agents with seeded identities */
  F.T_OPEN = 2.86;                             // the folder opens
  F.T_ALL = 7.4;                               // all 1000 are out
  F.agentsOut = (T) => T <= F.T_OPEN ? 0 : Math.min(F.N, Math.floor(F.N * Math.pow(sat((T - F.T_OPEN) / (F.T_ALL - F.T_OPEN)), 1.35) + 1e-6));
  F.emitT = (i) => F.T_OPEN + (F.T_ALL - F.T_OPEN) * Math.pow((i + 0.5) / F.N, 1 / 1.35);
  F.AG = [];
  for (let i = 0; i < F.N; i++) {
    F.AG.push({ i, te: F.emitT(i), r: [hash(i, 11), hash(i, 12), hash(i, 13), hash(i, 14), hash(i, 15), hash(i, 16), hash(i, 17), hash(i, 18)],
      tone: hash(i, 19), squad: Math.floor(i / 5) });
  }
  F.agentColor = (i) => { const t = F.AG[i].tone; return t < 0.15 ? F.C.shade : t < 0.6 ? F.C.coral : t < 0.88 ? F.C.light : F.C.cream; };

  /* ---------------------------------------------------------------- the story counters */
  F.files = (T) => {
    const a = sat((T - 5.7) / (10.4 - 5.7)), b = sat((T - 10.4) / (40 - 10.4));
    return Math.floor(128 * (a * a * (3 - 2 * a) * 0.8 + a * 0.2) + 384 * Math.pow(b, 0.8));
  };
  F.lines = (T) => { const f = F.files(T); return Math.floor(f * 61 + 37 * Math.sin(f * 1.7) * (f > 0 ? 1 : 0) + (f > 0 ? 40 : 0)); };
  F.stage = (T) => {
    if (T < 5.0) return 'SKETCH'; if (T < 10.5) return 'CODE'; if (T < 16.0) return 'MODULES';
    if (T < 27.0) return 'KERNEL'; if (T < 32.0) return 'BOOT'; return 'DESKTOP';
  };

  /* ---------------------------------------------------------------- the HUD: one overlay for the whole film
     drawn by the compositor through rect(x, y, w, h, rgb, alpha). 3x5 pixel glyphs (from the original flat piece). */
  const GL = { A: '25755', B: '65656', C: '34443', D: '65556', E: '74647', F: '74644', G: '34553', H: '55755', I: '72227', J: '11152', K: '55655', L: '44447', M: '57755', N: '65555', O: '25552', P: '65644', Q: '25563', R: '65655', S: '34216', T: '72222', U: '55557', V: '55552', W: '55775', X: '55255', Y: '55222', Z: '71247',
    0: '75557', 1: '26227', 2: '61247', 3: '61216', 4: '55711', 5: '74616', 6: '34757', 7: '71222', 8: '75757', 9: '75716', '.': '00002', ':': '02020', '-': '00700', '/': '11244', '>': '42124', '_': '00007', ' ': '00000' };
  F.GL = GL;
  function glyphs(str, x, y, px, rgb, a, rect) {
    for (let k = 0; k < str.length; k++) {
      const g = GL[str[k]] || GL[' '];
      for (let j = 0; j < 5; j++) { const row = +g[j]; for (let i = 0; i < 3; i++) if (row & (4 >> i)) rect(x + (k * 4 + i) * px, y + j * px, px, px, rgb, a); }
    }
    return x + str.length * 4 * px;
  }
  F.glyphs = glyphs;
  F.textW = (str, px) => (str.length * 4 - 1) * px;
  F.hud = function (T, rect) {
    const A = ss(0.25, 0.65, T);
    if (A <= 0) return;
    const X0 = 64, Y0 = 56, P1 = 4, P2 = 3;
    const lil = [150, 142, 226], dim = [108, 100, 178], cor = F.C.light, teal = F.C.teal;
    // faint dark backing, so it reads on every style
    rect(X0 - 18, Y0 - 16, 312, 112, [6, 4, 16], 0.42 * A);
    rect(X0 - 14, Y0 - 12, 304, 104, [6, 4, 16], 0.22 * A);
    let x = glyphs('AGENTS', X0, Y0, P1, lil, A, rect);
    glyphs(String(F.agentsOut(T)).padStart(4, '0'), x + 2 * P1, Y0, P1, cor, A, rect);
    const y2 = Y0 + 34, fa = A;
    x = glyphs('FILES', X0, y2, P2, dim, fa, rect);
    x = glyphs(String(F.files(T)).padStart(4, '0'), x + P2 * 2, y2, P2, cor, fa * 0.95, rect);
    x = glyphs('LINES', x + P2 * 8, y2, P2, dim, fa, rect);
    glyphs(String(F.lines(T)).padStart(5, '0'), x + P2 * 2, y2, P2, cor, fa * 0.95, rect);
    // the stage label: it types on after each transition
    const y3 = Y0 + 60, st = F.stage(T);
    let tSwitch = 0; for (const x2 of F.X) if (T >= x2.t && F.stage(x2.t) !== F.stage(x2.t - 0.01)) tSwitch = x2.t;
    const n = Math.min(st.length, Math.floor((T - tSwitch) / 0.045) + 1);
    const pip = 0.55 + 0.45 * ss(0, 0.25, T - tSwitch);
    rect(X0, y3 + 3, P2 * 3, P2 * 3, cor, A * pip);
    glyphs('STAGE', X0 + P2 * 6, y3, P2, dim, A, rect);
    glyphs(st.slice(0, n), X0 + P2 * 6 + P2 * 24, y3, P2, lil, A, rect);
    // a short progress tick per completed stage
    const done = ['SKETCH', 'CODE', 'MODULES', 'KERNEL', 'BOOT', 'DESKTOP'].indexOf(st);
    for (let i = 0; i < 6; i++) rect(X0 + 186 + i * 13, y3 + 6, 9, 3, i < done ? teal : i === done ? cor : dim, A * (i <= done ? 0.9 : 0.35));
  };

  /* ---------------------------------------------------------------- transitions: the agent wave
     mask(k, p, x, y) -> 0..1, how much of the INCOMING style shows at screen point (x, y) at progress p (0..1).
     waveAgents(k, p) -> [{x, y, r, a, vx, vy, hot}] the lights that carry the front (drawn additively on top). */
  const BX = F.BUILD.x, BY = 520;              // the build's centre on screen (bloom / spiral origin)
  F.KERNEL = [1215, 500];
  F.SCREEN = { x: 1225, y: 455, w: 520, h: 300 };   // where the boot screen sits at the end of BOOT
  const smooth01 = (e0, e1, x) => { const u = sat((x - e0) / (e1 - e0)); return u * u * (3 - 2 * u); };
  F.mask = function (k, p, x, y) {
    const kind = F.X[k].kind;
    if (kind === 'sweep') {                    // left to right, in lanes
      const e = eio(p), f = lerp(-260, 2200, e) + 90 * (vn1(y / 70, 31) - 0.5) + 70 * Math.sin(y / 47 + 1.3) * (vn1(y / 160, 32));
      return smooth01(f + 70, f - 70, x);
    }
    if (kind === 'curtain') {                  // rises from the bottom
      const e = eio(p), f = lerp(1340, -260, e) + 70 * (vn1(x / 90, 41) - 0.5) + 36 * Math.sin(x / 38 + 0.4);
      return smooth01(f - 60, f + 60, y);
    }
    if (kind === 'bloom') {                    // converge to the centre, then bloom outward
      const q = sat((p - 0.3) / 0.7), R = eo(q) * 2300 * (q > 0 ? 1 : 0) - 40;
      const dx = x - BX, dy = y - BY, a = Math.atan2(dy, dx), d = Math.hypot(dx, dy) * (1 + 0.12 * (vn1(a * 3 + 10, 51) - 0.5));
      return smooth01(R + 70, R - 70, d);
    }
    if (kind === 'blocks') {                   // a voxel bloom from the kernel: square cells switch on
      const cell = 36, cx = Math.floor(x / cell), cy = Math.floor(y / cell);
      const mx = (cx + 0.5) * cell - F.KERNEL[0], my = (cy + 0.5) * cell - F.KERNEL[1];
      const d = Math.max(Math.abs(mx), Math.abs(my) * 1.35) + 220 * hash(cx * 131 + cy, 61);
      const R = eo(p) * 2050 - 60, fade = 90;
      return smooth01(R + fade, R - fade, d);
    }
    if (kind === 'spiral') {                   // three arms sweeping out of the core
      const dx = x - BX, dy = y - BY, d = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
      const tau = 0.5 * Math.min(1, d / 1500) + 0.42 * frac(3 * a / TAU + d / 560);
      return smooth01(tau - 0.07, tau + 0.07, p * 1.12 - 0.05);
    }
    if (kind === 'pour') {                     // out of the screen, toward camera
      const S = F.SCREEN, qx = Math.max(Math.abs(x - S.x) - S.w / 2, 0), qy = Math.max(Math.abs(y - S.y) - S.h / 2, 0);
      const d = Math.hypot(qx, qy) + 30 * (vn1(Math.atan2(y - S.y, x - S.x) * 4 + 3, 71) - 0.5) * (qx + qy > 0 ? 1 : 0);
      const inside = smooth01(0.0, 0.22, p);
      const R = eo(sat((p - 0.12) / 0.88)) * 1500 - 30;
      return Math.max(smooth01(R + 80, R - 80, d) * (p > 0.12 ? 1 : 0), (qx + qy === 0 ? inside : 0));
    }
    return p > 0.5 ? 1 : 0;
  };
  F.waveAgents = function (k, p) {
    const kind = F.X[k].kind, out = [];
    const env = ss(0, 0.12, p) * (1 - ss(0.86, 1, p));
    if (env <= 0) return out;
    const N = 420;
    for (let i = 0; i < N; i++) {
      const r1 = hash(i, 101 + k), r2 = hash(i, 202 + k), r3 = hash(i, 303 + k), r4 = hash(i, 404 + k);
      const rad = 1.6 + 2.6 * r3 * r3, hot = r4;
      let x, y, vx, vy, a = env * (0.55 + 0.45 * r2);
      if (kind === 'sweep') {
        const lane = Math.floor(r1 * 22), ly = 90 + lane * 44 + (r2 - 0.5) * 16;
        const e = eio(p), f = lerp(-260, 2200, e) + 90 * (vn1(ly / 70, 31) - 0.5) + 70 * Math.sin(ly / 47 + 1.3) * vn1(ly / 160, 32);
        x = f + 10 + 150 * r4 - 40; y = ly + 6 * Math.sin(x / 60 + r1 * 9); vx = 1; vy = 0.05 * Math.cos(x / 60 + r1 * 9);
      } else if (kind === 'curtain') {
        const lx = r1 * 1920, e = eio(p), f = lerp(1340, -260, e) + 70 * (vn1(lx / 90, 41) - 0.5) + 36 * Math.sin(lx / 38 + 0.4);
        y = f - 10 - 140 * r4 + 40; x = lx + 7 * Math.sin(y / 50 + r2 * 9); vx = 0.06 * Math.cos(y / 50); vy = -1;
      } else if (kind === 'bloom') {
        const an = r1 * TAU, q = sat((p - 0.3) / 0.7);
        if (p < 0.34) {                        // converging
          const c = eio(p / 0.34), R0 = 380 + 620 * r2;
          const R = lerp(R0, 18 + 30 * r4, c), w = an + 1.4 * c;
          x = BX + Math.cos(w) * R; y = BY + Math.sin(w) * R * 0.8; vx = -Math.cos(w); vy = -Math.sin(w);
        } else {
          const R = eo(q) * 2300 - 40, d = R / (1 + 0.12 * (vn1(an * 3 + 10, 51) - 0.5)) + 10 + 120 * r4 - 30;
          x = BX + Math.cos(an) * d; y = BY + Math.sin(an) * d; vx = Math.cos(an); vy = Math.sin(an);
        }
      } else if (kind === 'blocks') {
        const R = eo(p) * 2050 - 60, side = Math.floor(r1 * 4), s = (r2 * 2 - 1);
        const d = R + 40 * (r4 - 0.5) - 110;
        const cx = side < 2 ? (side ? 1 : -1) * d : s * d, cy = side < 2 ? s * d / 1.35 : (side === 2 ? 1 : -1) * d / 1.35;
        x = Math.round((F.KERNEL[0] + cx) / 36) * 36 + 18; y = Math.round((F.KERNEL[1] + cy) / 36) * 36 + 18;
        vx = side === 0 ? -1 : side === 1 ? 1 : 0; vy = side === 2 ? 1 : side === 3 ? -1 : 0;
      } else if (kind === 'spiral') {
        const arm = Math.floor(r1 * 3), u = r2;                           // position along the arm
        const pp = p * 1.12 - 0.05, d = 40 + u * 1700;
        // on an arm, tau(d, a) == pp at the front: solve for the angle
        const base = 0.5 * Math.min(1, d / 1500), fr = sat((pp - base) / 0.42);
        const ang = TAU * (arm + fr - d / 560) / 3 + (r4 - 0.5) * 0.08;
        x = BX + Math.cos(ang) * d; y = BY + Math.sin(ang) * d; vx = -Math.sin(ang); vy = Math.cos(ang);
        a *= fr > 0.02 && fr < 0.98 ? 1 : 0.2;
      } else {                                 // pour
        const S = F.SCREEN, an = r1 * TAU, q = sat((p - 0.05) / 0.95);
        const tr = Math.pow(sat(q * (0.7 + 0.6 * r4) - r2 * 0.25), 1.6);
        const sx = S.x + (r3 - 0.5) * S.w * 0.85, sy = S.y + (r2 - 0.5) * S.h * 0.8;
        x = sx + Math.cos(an) * tr * 1500; y = sy + Math.sin(an) * tr * 1000; vx = Math.cos(an); vy = Math.sin(an);
        const grow = 1 + 2.4 * tr;
        out.push({ x, y, r: rad * grow, a: a * (tr > 0 ? 1 : 0) * (1 - ss(0.75, 1, tr)), vx, vy, hot });
        continue;
      }
      out.push({ x, y, r: rad, a, vx, vy, hot });
    }
    return out;
  };

  /* ---------------------------------------------------------------- section registry (pages)
     F.define(slot, factory): factory(canvas, opts) -> { renderAt(T), isReady() }. opts.scale < 1 renders smaller (live page). */
  F.factories = {};
  F.define = (slot, factory) => { F.factories[slot] = factory; };

  if (typeof module !== 'undefined' && module.exports) module.exports = F;
  else root.FILM = F;
})(typeof window !== 'undefined' ? window : this);
