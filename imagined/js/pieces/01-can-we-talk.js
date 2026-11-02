/* Can we talk later? — In Imagination, piece 01.
 *
 * "There are more things likely to frighten us than there are to crush us;
 *  we suffer more often in imagination than in reality." (Seneca)
 *
 * A 37-second seamless loop. Evening in a small flat: Noor, curled on a sage sofa with a mug, under a lamp and a
 * string of fairy lights. Their phone buzzes on the coffee table: "hey, can we talk later?" from Sam. The typing
 * dots appear, vanish, reappear, vanish. And the fear arrives as another medium: rough, boiling ink and charcoal
 * that crawls in over the warm pixel room, scribbles over the lamp, the plant, the clock and the window, cracks
 * the floor, flickers with imagined disasters and lifts the phone into a looming monolith, until Noor is small in
 * the dark. They breathe, and they answer: "what's up?". The reply is a surprise party and a cake. The ink burns
 * back from the screen and the room underneath was never touched. The quote; then the phone buzzes again.
 *
 * Two layers, two media. The world is pixel art computed every frame at 360 × 450 (signed-distance shapes in one
 * room-sized scene, lit by the lamp and the phone, quantised with a 4 × 4 Bayer dither to a 64-colour palette) and
 * shown at exactly 3×. The imagination is drawn over it at the full 1080 × 1350 with Canvas 2D brush strokes whose
 * lines "boil": they are redrawn ten times a second with fresh jitter. Every frame is a pure function of t.
 */
(function () {
  'use strict';

  /* ================================================================ constants & helpers */
  const W = 360, H = 450, NP = W * H, D = 37, KS = 3, OW = W * KS, OH = H * KS;
  const TAU = Math.PI * 2, PI = Math.PI, fl = Math.floor;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, u) => a + (b - a) * u;
  const sstep = (a, b, x) => { const u = clamp((x - a) / (b - a), 0, 1); return u * u * (3 - 2 * u); };
  const s5 = (u) => { u = clamp(u, 0, 1); return u * u * u * (u * (u * 6 - 15) + 10); };
  const ph = (t, a, b) => clamp((t - a) / (b - a), 0, 1);
  const fr = (v) => v - fl(v);
  const mod = (a, n) => { const r = a % n; return r < 0 ? r + n : r; };   // exact for a in [0, n)
  const win = (t, a, b, fi, fo) => sstep(a, a + fi, t) * (1 - sstep(b - fo, b, t));
  const back = (u, c) => { u = clamp(u, 0, 1); c = c === undefined ? 1.7 : c; const v = u - 1; return 1 + (c + 1) * v * v * v + c * v * v; };
  function ih(a, b, c) {
    let h = Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x165667b1) ^ Math.imul((c | 0) + 1013, 0x85ebca77);
    h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
    h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
    h ^= h >>> 15;
    return (h >>> 0) / 4294967296;
  }
  function vn2(x, y, s) {
    const xi = fl(x), yi = fl(y), fx = x - xi, fy = y - yi;
    const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
    return lerp(lerp(ih(xi, yi, s), ih(xi + 1, yi, s), u), lerp(ih(xi, yi + 1, s), ih(xi + 1, yi + 1, s), u), v);
  }
  function fbm(x, y, s, o) {
    let a = 0, amp = 0.5, n = 0;
    for (let k = 0; k < (o || 3); k++) { a += amp * vn2(x, y, s + k * 31); n += amp; x = x * 2.03 + 5.1; y = y * 2.03 + 1.7; amp *= 0.5; }
    return a / n;
  }
  const hx = (h) => [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];

  // monotone cubic keyframes (Fritsch–Carlson), clamped at the ends: keys [[t, v0, v1, ...], ...]
  function track(keys) {
    const n = keys.length, m = keys[0].length - 1, tg = [];
    for (let c = 0; c < m; c++) {
      const s = [], tc = [];
      for (let i = 0; i < n - 1; i++) s.push((keys[i + 1][c + 1] - keys[i][c + 1]) / (keys[i + 1][0] - keys[i][0]));
      for (let i = 0; i < n; i++) {
        if (i === 0 || i === n - 1) { tc.push(0); continue; }
        const a = s[i - 1], b = s[i];
        if (a * b <= 0) { tc.push(0); continue; }
        const h0 = keys[i][0] - keys[i - 1][0], h1 = keys[i + 1][0] - keys[i][0];
        tc.push(3 * (h0 + h1) / ((2 * h1 + h0) / a + (h1 + 2 * h0) / b));
      }
      tg.push(tc);
    }
    const out = new Array(m);
    return function (x) {
      if (x <= keys[0][0]) { for (let c = 0; c < m; c++) out[c] = keys[0][c + 1]; return out; }
      if (x >= keys[n - 1][0]) { for (let c = 0; c < m; c++) out[c] = keys[n - 1][c + 1]; return out; }
      let i = 0; while (keys[i + 1][0] < x) i++;
      const h = keys[i + 1][0] - keys[i][0], u = (x - keys[i][0]) / h, u2 = u * u, u3 = u2 * u;
      for (let c = 0; c < m; c++) {
        out[c] = (2 * u3 - 3 * u2 + 1) * keys[i][c + 1] + (u3 - 2 * u2 + u) * h * tg[c][i] + (-2 * u3 + 3 * u2) * keys[i + 1][c + 1] + (u3 - u2) * h * tg[c][i + 1];
      }
      return out;
    };
  }

  /* ================================================================ palette (64) */
  const PAL_HEX = [
    '120d10', '1e1519', '2b1f23', '3a2a2c', '4d3834', '62473d', '7a5a49',            // 0-6   warm darks
    '5a3a24', '7a4f2c', '9b6735', 'bc8443', 'd9a352', 'ecc06a',                      // 7-12  wood, honey
    'f7da92', 'fbe8bb', 'fff5de', 'f0e0c0', 'dcc7a2', 'bfa784',                      // 13-18 cream
    '34402f', '4a5a41', '637756', '82966f', 'a6b58e', 'c9d1ae',                      // 19-24 sage
    '1d3524', '2c5232', '427344', '5f964f', '8cba67',                                // 25-29 leaf green
    '5e271e', '86382a', 'ad5234', 'cf7446', 'e9a074',                                // 30-34 terracotta
    '3d2219', '5c3424', '7d4a31', '9e6342', 'bb7f55', 'd6a074',                      // 35-40 skin
    '6e4f16', '9c731e', 'c99b2b', 'e6c04f',                                          // 41-44 mustard
    '17162b', '25234a', '37336a', '524a85', '7a68a0', 'a787ad', 'd6a6ad', 'f3c3a0',  // 45-52 dusk
    '2d4e78', '4f7fb0', '8fbadb', 'cde6ef', 'f4fbfd',                                // 53-57 screen light
    '23232d', '373844', '545666', '8a8c99',                                          // 58-61 cool greys
    'e58a95', 'f6c1c6',                                                              // 62-63 pink
  ];
  const PAL = PAL_HEX.map(hx), NPAL = PAL.length;
  const QN = 64, LUT = new Uint8Array(QN * QN * QN);
  function nearest(r, g, b) {
    let best = 0, bd = 1e18;
    for (let k = 0; k < NPAL; k++) {
      const p = PAL[k], dr = r - p[0], dg = g - p[1], db = b - p[2], rm = (r + p[0]) * 0.5;
      const s = 1 / (14 + (r + g + b + p[0] + p[1] + p[2]) / 6);
      const d = ((2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db) * s;
      if (d < bd) { bd = d; best = k; }
    }
    return best;
  }
  let LUT_OK = false;
  function buildLUT() {
    if (LUT_OK) return;
    const dec = new Float32Array(QN);
    for (let q = 0; q < QN; q++) { const u = q / (QN - 1); dec[q] = 255 * u * u; }
    for (let r = 0; r < QN; r++) for (let g = 0; g < QN; g++) for (let b = 0; b < QN; b++)
      LUT[(r << 12) | (g << 6) | b] = nearest(dec[r], dec[g], dec[b]);
    LUT_OK = true;
  }
  const BAY = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16 - 0.5);
  const P = (k) => PAL[k];

  /* ================================================================ pixel font (5 × 7, descenders to row 8) */
  const GLYPHS = {
    A: '.###.|#...#|#...#|#####|#...#|#...#|#...#', B: '####.|#...#|#...#|####.|#...#|#...#|####.',
    C: '.###.|#...#|#....|#....|#....|#...#|.###.', D: '####.|#...#|#...#|#...#|#...#|#...#|####.',
    E: '#####|#....|#....|####.|#....|#....|#####', F: '#####|#....|#....|####.|#....|#....|#....',
    G: '.###.|#...#|#....|#.###|#...#|#...#|.###.', H: '#...#|#...#|#...#|#####|#...#|#...#|#...#',
    I: '###|.#.|.#.|.#.|.#.|.#.|###', J: '..###|...#.|...#.|...#.|#..#.|#..#.|.##..',
    K: '#...#|#..#.|#.#..|##...|#.#..|#..#.|#...#', L: '#....|#....|#....|#....|#....|#....|#####',
    M: '#...#|##.##|#.#.#|#.#.#|#...#|#...#|#...#', N: '#...#|##..#|#.#.#|#..##|#...#|#...#|#...#',
    O: '.###.|#...#|#...#|#...#|#...#|#...#|.###.', P: '####.|#...#|#...#|####.|#....|#....|#....',
    Q: '.###.|#...#|#...#|#...#|#.#.#|#..#.|.##.#', R: '####.|#...#|#...#|####.|#.#..|#..#.|#...#',
    S: '.###.|#...#|#....|.###.|....#|#...#|.###.', T: '#####|..#..|..#..|..#..|..#..|..#..|..#..',
    U: '#...#|#...#|#...#|#...#|#...#|#...#|.###.', V: '#...#|#...#|#...#|#...#|.#.#.|.#.#.|..#..',
    W: '#...#|#...#|#...#|#.#.#|#.#.#|##.##|#...#', X: '#...#|#...#|.#.#.|..#..|.#.#.|#...#|#...#',
    Y: '#...#|#...#|.#.#.|..#..|..#..|..#..|..#..', Z: '#####|....#|...#.|..#..|.#...|#....|#####',
    a: '.....|.....|.###.|....#|.####|#...#|.####', b: '#....|#....|####.|#...#|#...#|#...#|####.',
    c: '.....|.....|.###.|#....|#....|#....|.###.', d: '....#|....#|.####|#...#|#...#|#...#|.####',
    e: '.....|.....|.###.|#...#|#####|#....|.###.', f: '..##|.#..|####|.#..|.#..|.#..|.#..',
    g: '.....|.....|.####|#...#|#...#|.####|....#|#...#|.###.', h: '#....|#....|####.|#...#|#...#|#...#|#...#',
    i: '.#.|...|##.|.#.|.#.|.#.|###', j: '...#|....|..##|...#|...#|...#|...#|#..#|.##.',
    k: '#...|#...|#..#|#.#.|##..|#.#.|#..#', l: '##.|.#.|.#.|.#.|.#.|.#.|###',
    m: '.....|.....|##.#.|#.#.#|#.#.#|#.#.#|#.#.#', n: '.....|.....|####.|#...#|#...#|#...#|#...#',
    o: '.....|.....|.###.|#...#|#...#|#...#|.###.', p: '.....|.....|####.|#...#|#...#|#...#|####.|#....|#....',
    q: '.....|.....|.####|#...#|#...#|#...#|.####|....#|....#', r: '....|....|#.##|##..|#...|#...|#...',
    s: '.....|.....|.####|#....|.###.|....#|####.', t: '.#..|.#..|####|.#..|.#..|.#..|..##',
    u: '.....|.....|#...#|#...#|#...#|#..##|.##.#', v: '.....|.....|#...#|#...#|#...#|.#.#.|..#..',
    w: '.....|.....|#...#|#...#|#.#.#|#.#.#|.#.#.', x: '.....|.....|#...#|.#.#.|..#..|.#.#.|#...#',
    y: '.....|.....|#...#|#...#|#...#|#...#|.####|....#|.###.', z: '.....|.....|#####|...#.|..#..|.#...|#####',
    '0': '.###.|#...#|#..##|#.#.#|##..#|#...#|.###.', '1': '.#.|##.|.#.|.#.|.#.|.#.|###',
    '2': '.###.|#...#|....#|...#.|..#..|.#...|#####', '3': '####.|....#|....#|.###.|....#|....#|####.',
    '4': '...#.|..##.|.#.#.|#..#.|#####|...#.|...#.', '5': '#####|#....|####.|....#|....#|#...#|.###.',
    '6': '.###.|#....|#....|####.|#...#|#...#|.###.', '7': '#####|....#|...#.|..#..|.#...|.#...|.#...',
    '8': '.###.|#...#|#...#|.###.|#...#|#...#|.###.', '9': '.###.|#...#|#...#|.####|....#|....#|.###.',
    ',': '..|..|..|..|..|.#|.#|#.', '.': '.|.|.|.|.|.|#', ';': '..|..|..|.#|..|..|.#|.#|#.', ':': '.|.|.|#|.|.|#',
    '!': '#|#|#|#|#|.|#', '?': '.###.|#...#|....#|...#.|..#..|.....|..#..', "'": '#|#|.', '-': '....|....|....|####',
    '—': '......|......|......|######', '…': '.....|.....|.....|.....|.....|.....|#.#.#', ' ': '...', '<': '...#|..#.|.#..|#...|.#..|..#.|...#',
  };
  const FONT = {};
  for (const ch in GLYPHS) {
    const rows = GLYPHS[ch].split('|'), w = rows[0].length, bm = new Uint8Array(9 * w);
    rows.forEach((r, y) => { for (let x = 0; x < w; x++) if (r[x] === '#') bm[y * w + x] = 1; });
    FONT[ch] = { w, bm };
  }
  function textW(str, sc) { let w = 0; for (const ch of str) w += ((FONT[ch] || FONT['?']).w + 1) * sc; return w - sc; }

  /* ================================================================ timeline */
  const PX = 48;                         // where Noor sits (room world)
  const PHX = 92, PHY = 111, PU = 0.26;  // the phone on the table: centre, and world units per screen pixel
  // shots: [start, end, kind]; the last room shot runs across the seam (unwrapped time 25.6 → 39.3)
  const SHOTS = [[2.3, 3.6, 'face'], [3.6, 7.2, 'pov'], [7.2, 10.6, 'face'], [10.6, 19.4, 'room'], [19.4, 21.6, 'face'], [21.6, 25.6, 'pov'], [25.6, D + 2.3, 'room']];
  function shotAt(t) {
    for (let i = 0; i < SHOTS.length; i++) {
      const s = SHOTS[i];
      if (t >= s[0] && t < s[1]) return { i, k: s[2], t0: s[0], t1: s[1], u: t };
      if (s[1] > D && t + D >= s[0] && t + D < s[1]) return { i, k: s[2], t0: s[0], t1: s[1], u: t + D };
    }
    return { i: SHOTS.length - 1, k: 'room', t0: 25.6, t1: D + 2.3, u: t < 2.3 ? t + D : t };
  }
  // fear: 0 calm .. 1 overwhelmed (drives the ink); calm returns with the reveal
  function fearAt(t) {
    return 0.10 * sstep(4.6, 5.4, t) + 0.25 * sstep(5.2, 9.5, t) + 0.65 * sstep(10.0, 18.6, t) - sstep(22.6, 25.0, t) * 1.0;
  }

  // camera keys per shot [t, x, y, ln z]
  const LN = Math.log;
  const CAM = {
    0: track([[2.3, 50, -62, LN(4.0)], [3.6, 50, -63, LN(4.35)]]),
    1: track([[3.6, 0, 2, LN(2)], [7.2, 0, 2, LN(2)]]),
    2: track([[7.2, 49, -64, LN(3.9)], [10.6, 49, -61, LN(4.8)]]),
    3: track([[10.6, 52, -40, LN(1.7)], [14.2, 46, -32, LN(1.36)], [17.6, 40, -22, LN(1.08)], [19.4, 38, -18, LN(1.0)]]),
    4: track([[19.4, 49, -61, LN(4.5)], [21.6, 49, -60, LN(4.0)]]),
    5: track([[21.6, 0, 2, LN(2)], [25.6, 0, 2, LN(2)]]),
    6: track([[25.6, 50, -34, LN(1.4)], [27.4, 46, -26, LN(1.2)], [28.8, 32, -10, LN(1.0)], [35.6, 28, -8, LN(1.03)], [D, 66, 18, LN(1.9)],
      [D + 0.95, PHX, PHY, LN(1 / PU * 2)], [D + 2.3, PHX, PHY + 1.6, LN(1 / PU * 2)]]),
  };

  /* ================================================================ pixel buffers & camera */
  const C = new Float32Array(NP * 3);   // colour 0..255 (albedo, then lit)
  const EM = new Uint8Array(NP);        // 1 = emissive (skips lighting)
  const ND = new Uint8Array(NP);        // 1 = no dither (UI, text)
  const OUT = new Uint8Array(NP);
  const PM = new Uint8Array(NP);        // 1 = Noor (the ink behind them is cut away here)
  let MARK = 0;
  let CX = 0, CY = 0, CZ = 1, IZ = 1;
  const SO = new Float64Array(3);        // the shade functions' output
  let LDX = -0.8, LDY = -0.6;            // direction toward the key light (edge lighting)
  const sxOf = (x) => (x - CX) * CZ + W / 2, syOf = (y) => (y - CY) * CZ + H / 2;
  function setCam(x, y, z) { CZ = z; IZ = 1 / z; CX = Math.round(x * z) / z; CY = Math.round(y * z) / z; }

  // fill an SDF shape (world coords): shade(x, y, d) sets SO[0], SO[1], SO[2].
  // o.ol: darken the 1-px outline by this factor; o.rim: edge band (world) lit toward the key light; o.ld its strength;
  // o.em: emissive; o.nd: no dither; o.a: opacity (0..1) blended over what is there.
  function fill(x0, y0, x1, y1, sdf, shade, o) {
    const ol = (o && o.ol) || 0, rim = (o && o.rim) || 0, em = o && o.em ? 1 : 0, nd = o && o.nd ? 1 : 0;
    const ld = o && o.ld !== undefined ? o.ld : 0.35, al = o && o.a !== undefined ? o.a : 1, ow = IZ * ((o && o.ow) || 1), add = o && o.add;
    const mk = MARK;
    if (al <= 0.003) return;
    const px0 = Math.max(0, fl(sxOf(x0))), px1 = Math.min(W - 1, Math.ceil(sxOf(x1)));
    const py0 = Math.max(0, fl(syOf(y0))), py1 = Math.min(H - 1, Math.ceil(syOf(y1)));
    const e = IZ * 0.75;
    for (let py = py0; py <= py1; py++) {
      const wy = CY + (py + 0.5 - H / 2) * IZ;
      for (let px = px0; px <= px1; px++) {
        const wx = CX + (px + 0.5 - W / 2) * IZ;
        const d = sdf(wx, wy);
        if (d > 0) continue;
        shade(wx, wy, d);
        let m = 1;
        if (rim > 0 && -d < rim) {
          let gx = sdf(wx + e, wy) - sdf(wx - e, wy), gy = sdf(wx, wy + e) - sdf(wx, wy - e);
          const gl = Math.hypot(gx, gy) || 1; gx /= gl; gy /= gl;
          m *= 1 + ld * (gx * LDX + gy * LDY) * (1 + d / rim);
        }
        if (ol && d > -ow) m *= ol;
        const i = py * W + px, j = i * 3;
        if (add) { C[j] += SO[0] * m; C[j + 1] += SO[1] * m; C[j + 2] += SO[2] * m; continue; }
        PM[i] = mk;
        if (al >= 1) { C[j] = SO[0] * m; C[j + 1] = SO[1] * m; C[j + 2] = SO[2] * m; EM[i] = em; ND[i] = nd; }
        else { C[j] += (SO[0] * m - C[j]) * al; C[j + 1] += (SO[1] * m - C[j + 1]) * al; C[j + 2] += (SO[2] * m - C[j + 2]) * al; if (em) EM[i] = 1; }
      }
    }
  }
  const setc = (c, k) => { k = k === undefined ? 1 : k; SO[0] = c[0] * k; SO[1] = c[1] * k; SO[2] = c[2] * k; };
  const mixc = (a, b, u, k) => { k = k === undefined ? 1 : k; SO[0] = (a[0] + (b[0] - a[0]) * u) * k; SO[1] = (a[1] + (b[1] - a[1]) * u) * k; SO[2] = (a[2] + (b[2] - a[2]) * u) * k; };
  const flat = (c, k) => () => setc(c, k);

  /* ---------------------------------------------------------------- SDF primitives */
  const sdC = (x, y, cx, cy, r) => Math.hypot(x - cx, y - cy) - r;
  function sdE(x, y, cx, cy, rx, ry) { const u = (x - cx) / rx, v = (y - cy) / ry; return (Math.hypot(u, v) - 1) * Math.min(rx, ry); }
  function sdB(x, y, cx, cy, hw, hh, r) {
    r = r || 0;
    const qx = Math.abs(x - cx) - hw + r, qy = Math.abs(y - cy) - hh + r;
    return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
  }
  function sdS(x, y, ax, ay, bx, by, r) {
    const px = x - ax, py = y - ay, dx = bx - ax, dy = by - ay;
    const h = clamp((px * dx + py * dy) / (dx * dx + dy * dy || 1), 0, 1);
    return Math.hypot(px - dx * h, py - dy * h) - r;
  }
  // tapered segment (radius ra at a, rb at b)
  function sdT(x, y, ax, ay, bx, by, ra, rb) {
    const px = x - ax, py = y - ay, dx = bx - ax, dy = by - ay;
    const h = clamp((px * dx + py * dy) / (dx * dx + dy * dy || 1), 0, 1);
    return Math.hypot(px - dx * h, py - dy * h) - (ra + (rb - ra) * h);
  }
  function sdPoly(x, y, v) {   // v = [x0, y0, x1, y1, ...]
    const n = v.length >> 1;
    let d = (x - v[0]) ** 2 + (y - v[1]) ** 2, s = 1;
    for (let i = 0, j = n - 1; i < n; j = i, i++) {
      const xi = v[i * 2], yi = v[i * 2 + 1], xj = v[j * 2], yj = v[j * 2 + 1];
      const ex = xj - xi, ey = yj - yi, wx = x - xi, wy = y - yi;
      const h = clamp((wx * ex + wy * ey) / (ex * ex + ey * ey), 0, 1);
      const bx = wx - ex * h, by = wy - ey * h;
      d = Math.min(d, bx * bx + by * by);
      const c1 = y >= yi, c2 = y < yj, c3 = ex * wy > ey * wx;
      if ((c1 && c2 && c3) || (!c1 && !c2 && !c3)) s = -s;
    }
    return s * Math.sqrt(d);
  }
  const ring = (d, w) => Math.abs(d) - w;

  /* ================================================================ the phone screen (its own pixels, "pu") */
  const SW = 100, SH = 180;
  const SCR = new Float32Array(SW * SH * 3);
  let SD = 1;   // screen-element dissolve (1 = solid): new UI arrives in a quick ordered dither, not in one frame
  const sOK = (x, y) => SD >= 1 || BAY[((y & 3) << 2) | (x & 3)] + 0.5 < SD;
  function sRect(x0, y0, w, h, c, r) {
    for (let y = Math.max(0, y0); y < Math.min(SH, y0 + h); y++) for (let x = Math.max(0, x0); x < Math.min(SW, x0 + w); x++) {
      if (r) { // rounded corners
        const cx = x < x0 + r ? x0 + r - 0.5 : x >= x0 + w - r ? x0 + w - r - 0.5 : x + 0.5;
        const cy = y < y0 + r ? y0 + r - 0.5 : y >= y0 + h - r ? y0 + h - r - 0.5 : y + 0.5;
        if ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 > r * r) continue;
      }
      if (!sOK(x, y)) continue;
      const j = (y * SW + x) * 3; SCR[j] = c[0]; SCR[j + 1] = c[1]; SCR[j + 2] = c[2];
    }
  }
  function sDisc(cx, cy, r, c) {
    for (let y = fl(cy - r); y <= Math.ceil(cy + r); y++) for (let x = fl(cx - r); x <= Math.ceil(cx + r); x++) {
      if (x < 0 || y < 0 || x >= SW || y >= SH) continue;
      if ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 > r * r || !sOK(x, y)) continue;
      const j = (y * SW + x) * 3; SCR[j] = c[0]; SCR[j + 1] = c[1]; SCR[j + 2] = c[2];
    }
  }
  function sText(str, x, y, c, sc) {
    sc = sc || 1;
    for (const ch of str) {
      const g = FONT[ch] || FONT['?'];
      for (let gy = 0; gy < 9; gy++) for (let gx = 0; gx < g.w; gx++) if (g.bm[gy * g.w + gx])
        for (let a = 0; a < sc; a++) for (let b = 0; b < sc; b++) {
          const X = x + gx * sc + b, Y = y + gy * sc + a;
          if (X < 0 || Y < 0 || X >= SW || Y >= SH || !sOK(X, Y)) continue;
          const j = (Y * SW + X) * 3; SCR[j] = c[0]; SCR[j + 1] = c[1]; SCR[j + 2] = c[2];
        }
      x += (g.w + 1) * sc;
    }
  }
  const CAKE = ['....a.....', '....b.....', '....c.....', '.dddddddd.', 'deedeedeed', 'dddddddddd', 'ffffffffff', 'gggggggggg', 'ffffffffff', '.hhhhhhhh.'];
  const CAKEC = { a: P(44), b: P(12), c: P(55), d: P(15), e: P(62), f: P(33), g: P(16), h: P(17) };
  function sCake(x, y, sc) {
    for (let r = 0; r < CAKE.length; r++) for (let c = 0; c < 10; c++) {
      const k = CAKE[r][c]; if (k === '.') continue;
      for (let a = 0; a < sc; a++) for (let b = 0; b < sc; b++) {
        const X = x + c * sc + b, Y = y + r * sc + a; if (X < 0 || Y < 0 || X >= SW || Y >= SH || !sOK(X, Y)) continue;
        const j = (Y * SW + X) * 3, q = CAKEC[k]; SCR[j] = q[0]; SCR[j + 1] = q[1]; SCR[j + 2] = q[2];
      }
    }
  }
  const BUB_IN = P(16), BUB_OUT = P(12), INK_T = P(1), CHAT_BG = P(58);
  // a message bubble: lines of text; returns its height
  function sBubble(lines, y, out, cake) {
    let w = 0; for (const l of lines) w = Math.max(w, textW(l, 1));
    if (cake) w = Math.max(w, textW(lines[lines.length - 1], 1) + 13);
    const bw = w + 8, bh = lines.length * 10 + 5, x = out ? SW - 5 - bw : 5;
    sRect(x, y, bw, bh, out ? BUB_OUT : BUB_IN, 4);
    lines.forEach((l, k) => sText(l, x + 4, y + 3 + k * 10, INK_T));
    if (cake) sCake(x + 4 + textW(lines[lines.length - 1], 1) + 3, y + 3 + (lines.length - 1) * 10 - 2, 1);
    return bh;
  }
  // which messages are on the phone at time t (shot time u for the POV shots)
  const MSG = [
    { lines: ['hey, can we', 'talk later?'], out: false },
    { lines: ["what's up?"], out: true },
    { lines: ["it's about mum's", 'surprise party!!'], out: false },
    { lines: ["you're in charge", 'of cake'], out: false },
    { cakeOnly: true },
  ];
  function typingAt(t) {   // how present the typing bubble is (0..1): it pops in and out in a tenth of a second
    return Math.max(win(t, 3.95, 5.05, 0.1, 0.1), win(t, 5.75, 6.7, 0.1, 0.1), win(t, 22.2, 22.6, 0.1, 0.1));
  }
  function paintChat(t) {
    sRect(0, 0, SW, SH, CHAT_BG);
    // which messages exist, and how far each new one has risen in
    const show = [[0, -99]];
    if (t > 21.0) show.push([1, 22.1]);
    if (t > 21.0) show.push([2, 22.6]);
    if (t > 21.0) show.push([3, 23.3]);
    if (t > 21.0) show.push([4, 23.75]);
    const vis = show.filter((s) => t >= s[1]);
    const ty = typingAt(t);
    // layout bottom-up above the input bar
    let y = SH - 20;
    // each item's slot grows as it arrives, so the conversation scrolls up smoothly instead of jumping
    const items = [];
    let slotT = 0;
    if (t > 3.95 && t < 7.2) slotT = s5(ph(t, 3.95, 4.12));                       // the dots' slot stays: their ink stays there
    else if (t > 22.2 && t < 22.75) slotT = t < 22.6 ? s5(ph(t, 22.2, 22.35)) : 1 - s5(ph(t, 22.6, 22.75));
    if (slotT > 0) items.push({ typing: true, f: slotT });
    for (let k = vis.length - 1; k >= 0; k--) items.push({ m: MSG[vis[k][0]], at: vis[k][1], f: vis[k][1] < 0 ? 1 : s5(ph(t, vis[k][1], vis[k][1] + 0.15)) });
    let yf = y;
    for (const it of items) {
      const h = it.typing ? 15 : it.m.cakeOnly ? 30 : it.m.lines.length * 10 + 5;
      yf -= (h + 4) * it.f;
      const yy = Math.round(yf);
      if (it.typing) {
        if (ty <= 0) continue;
        SD = ty;
        sRect(5, yy, 28, 15, BUB_IN, 6);
        for (let k = 0; k < 3; k++) {
          const b = Math.round(1.5 * Math.max(0, Math.sin(t * 9 - k * 0.9)));
          sDisc(11 + k * 8, yy + 8 - b, 2.2, P(60));
        }
        continue;
      }
      SD = ph(t, it.at, it.at + 0.13);
      if (it.m.cakeOnly) sCake(6, yy, 3);
      else sBubble(it.m.lines, yy, it.m.out, it.m.cake);
    }
    SD = 1;
    // header (drawn last so the oldest message slides under it)
    sRect(0, 0, SW, 22, P(59));
    sDisc(14, 11, 7, P(11)); sText('S', 12, 7, P(1));
    sText('Sam', 26, 7, P(15));
    sText('<', 3, 7, P(56));
    // input bar
    sRect(0, SH - 16, SW, 16, P(59));
    sRect(4, SH - 13, 78, 10, P(58), 4);
    const typed = t > 21.0 && t < 22.1 ? "what's up?".slice(0, Math.max(0, Math.floor((t - 21.6) / 0.045) + 1)) : '';
    if (typed) sText(typed, 8, SH - 12, P(16)); else sText('message', 8, SH - 12, P(60));
    sDisc(91, SH - 8, 5, t > 21.98 && t < 22.15 ? P(13) : P(11));
  }
  function paintLock(t, onAt) {
    // dusk wallpaper
    for (let y = 0; y < SH; y++) {
      const v = y / SH;
      const c0 = v < 0.5 ? P(47) : P(48), c1 = v < 0.5 ? P(48) : P(50), u = v < 0.5 ? v * 2 : (v - 0.5) * 2;
      for (let x = 0; x < SW; x++) {
        const bay = BAY[((y & 3) << 2) | (x & 3)];
        const k = u + bay * 0.5 > 0.5 ? c1 : c0;
        const j = (y * SW + x) * 3; SCR[j] = k[0]; SCR[j + 1] = k[1]; SCR[j + 2] = k[2];
      }
    }
    // hills
    for (let x = 0; x < SW; x++) {
      const h1 = 132 + Math.round(8 * Math.sin(x * 0.06 + 1) + 4 * Math.sin(x * 0.17)), h2 = 150 + Math.round(6 * Math.sin(x * 0.045 + 3));
      for (let y = h1; y < SH; y++) { const j = (y * SW + x) * 3, c = y >= h2 ? P(45) : P(46); SCR[j] = c[0]; SCR[j + 1] = c[1]; SCR[j + 2] = c[2]; }
    }
    sDisc(76, 52, 5, P(14)); sDisc(78, 50, 4.2, P(48));
    sText('21:47', 50 - Math.round(textW('21:47', 2) / 2), 14, P(15), 2);
    sText('sunday', 50 - Math.round(textW('sunday', 1) / 2), 34, P(51));
    // the notification drops in
    const u = s5(ph(t - onAt, 0.05, 0.3));
    if (u > 0) {
      SD = ph(t - onAt, 0.05, 0.18);
      const y0 = Math.round(62 - 14 * (1 - u));
      sRect(4, y0, 92, 36, P(16), 6);
      sDisc(15, y0 + 11, 7, P(11)); sText('S', 13, y0 + 7, P(1));
      sText('Sam', 26, y0 + 5, P(1));
      sText('now', 77, y0 + 5, P(18));
      sText('hey, can we', 26, y0 + 15, P(3));
      sText('talk later?', 26, y0 + 25, P(3));
      SD = 1;
    }
  }

  /* ================================================================ the room (world units: 1 = one art pixel at z 1) */
  let ST = null;                         // this frame's story state (pose, phone, light)

  function wall() {
    fill(-400, -400, 400, 70, () => -1, (x, y) => {
      // honey wallpaper with a small cream sprig, every 18 × 24
      const n = vn2(x * 0.08, y * 0.08, 3);
      let k = 0.92 + 0.12 * n;
      setc(P(11), 0.86 * k);
      const gx = mod(x + 9, 18) - 9, gy = mod(y + (mod(fl((x + 9) / 18), 2) ? 12 : 0), 24) - 12;
      const dd = Math.abs(gx) + Math.abs(gy);
      if (dd < 2.6) setc(P(13), 0.95 * k);
      else if ((Math.abs(gx) < 0.55 && Math.abs(gy) < 5.5) || (Math.abs(gy) < 0.55 && Math.abs(gx) < 4)) setc(P(12), 0.9 * k);
      // the cream wainscot below the rail
      if (y > -34) {
        setc(P(16), 0.93 * k);
        const pxl = mod(x + 15, 46);
        if (y < -28) setc(P(17), 0.95);
        else if (y < -26) setc(P(18));
        else if (pxl < 1.2) setc(P(18), 0.95);
        else if (pxl < 2.4) setc(P(15), 0.98);
      }
      if (y > 54) setc(P(9), 0.85 + 0.15 * vn2(x * 0.1, 0, 4));   // skirting
      if (y > 54 && y < 56) setc(P(12));
    });
  }
  function floor() {
    // boards toward a vanishing point; seams staggered
    const vx = 40, vy = -180;
    fill(-400, 62, 400, 400, (x, y) => 64 - y, (x, y) => {
      const u = (x - vx) / (y - vy) * 120, b = fl(u / 10), f = u / 10 - b;
      const depth = (y - 64) / 160;
      const seam = mod(y * (1.1 - depth * 0.3) + ih(b, 3, 7) * 60, 70);
      const grain = fbm(u * 0.6, y * 0.08, 11 + b, 2);
      setc(P(9), 0.7 + 0.18 * ih(b, 9, 2) + 0.2 * grain);
      if (f < 0.07 || seam < 1.1) setc(P(7), 0.85);
      if (y < 70) { const k = 0.6 + 0.4 * (y - 64) / 6; SO[0] *= k; SO[1] *= k; SO[2] *= k; }
    });
  }
  function rug() {
    const v = [-150, 72, 230, 72, 300, 250, -230, 250];
    fill(-240, 70, 310, 252, (x, y) => sdPoly(x, y, v), (x, y, d) => {
      // perspective-mapped coordinates on the rug
      const ry = (y - 72) / 178, rx = ((x - lerp(-150, -230, ry)) / (lerp(230, 300, ry) - lerp(-150, -230, ry)));
      const ux = rx * 12, uy = ry * 9;
      setc(P(32), 0.85);
      const bx = Math.min(rx, 1 - rx) * 12, by = Math.min(ry, 1 - ry) * 9;
      const edge = Math.min(bx, by);
      if (edge < 0.35) setc(P(16), 0.9);
      else if (edge < 0.5) setc(P(31));
      else {
        const gx = fr(ux) - 0.5, gy = fr(uy) - 0.5, dm = Math.abs(gx) + Math.abs(gy);
        if (dm < 0.18) setc(P(13), 0.95); else if (Math.abs(dm - 0.38) < 0.06) setc(P(16), 0.9); else if (dm > 0.62) setc(P(31), 0.95);
      }
      const n = vn2(x * 0.5, y * 0.5, 21); SO[0] *= 0.92 + 0.12 * n; SO[1] *= 0.92 + 0.12 * n; SO[2] *= 0.92 + 0.12 * n;
    }, { ol: 0.8 });
  }
  function windowAndSky(t) {
    const x0 = 58, x1 = 162, y0 = -206, y1 = -64;
    // sky
    fill(x0, y0, x1, y1, (x, y) => sdB(x, y, (x0 + x1) / 2, (y0 + y1) / 2, (x1 - x0) / 2, (y1 - y0) / 2), (x, y) => {
      const v = (y - y0) / (y1 - y0);
      if (v < 0.35) mixc(P(46), P(47), v / 0.35); else if (v < 0.62) mixc(P(47), P(49), (v - 0.35) / 0.27); else if (v < 0.82) mixc(P(49), P(51), (v - 0.62) / 0.2); else mixc(P(51), P(52), (v - 0.82) / 0.18);
      // stars
      if (v < 0.5 && ih(fl(x), fl(y), 5) > 0.992) setc(P(14), 0.8 + 0.2 * Math.sin(t * TAU * 2 / D * 7 + x));
      // the moon
      const dm = Math.hypot(x - 136, y - 182);
      if (dm < 6 && Math.hypot(x - 133.5, y - 184) > 5.2) setc(P(15));
      // the town: two rows of roofs with lit windows
      const r1 = -96 + 10 * Math.sin(fl(x / 9) * 1.7) + (ih(fl(x / 9), 1, 3) * 14), r2 = -80 + 6 * ih(fl(x / 7), 2, 3);
      if (y > r1) {
        setc(P(46), 0.9);
        const wx = mod(x, 4), wy = mod(y, 5);
        if (wx < 1.6 && wy < 2 && ih(fl(x / 4), fl(y / 5), 9) > 0.72) setc(ih(fl(x / 4), fl(y / 5), 4) > 0.4 ? P(12) : P(13));
      }
      if (y > r2) { setc(P(45)); const wx = mod(x + 2, 5), wy = mod(y, 5); if (wx < 1.6 && wy < 2 && ih(fl(x / 5), fl(y / 5), 19) > 0.8) setc(P(11)); }
    }, { em: true });
    // frame & mullions
    const fr0 = (x, y) => {
      const out = sdB(x, y, (x0 + x1) / 2, (y0 + y1) / 2, (x1 - x0) / 2 + 4, (y1 - y0) / 2 + 4, 1);
      const inn = sdB(x, y, (x0 + x1) / 2, (y0 + y1) / 2, (x1 - x0) / 2, (y1 - y0) / 2);
      const mul = Math.min(sdB(x, y, (x0 + x1) / 2, (y0 + y1) / 2, 1.6, (y1 - y0) / 2), sdB(x, y, (x0 + x1) / 2, -150, (x1 - x0) / 2, 1.6));
      return Math.min(Math.max(out, -inn), mul);
    };
    fill(x0 - 5, y0 - 5, x1 + 5, y1 + 5, fr0, (x, y) => setc(P(16), 0.92), { ol: 0.78, rim: 3, ld: 0.3 });
    // sill
    fill(x0 - 10, y1 + 2, x1 + 10, y1 + 10, (x, y) => sdB(x, y, (x0 + x1) / 2, y1 + 6, (x1 - x0) / 2 + 9, 3, 1), () => setc(P(16)), { ol: 0.75, rim: 2 });
  }
  function curtains() {
    for (const [cx, s] of [[48, 1], [172, -1]]) {
      fill(cx - 16, -222, cx + 16, 0, (x, y) => {
        const sway = Math.sin(y * 0.03) * 1.5;
        return sdB(x - sway, y, cx, -110, 11 + Math.max(0, (y + 60) * 0.06), 112, 3);
      }, (x, y) => {
        const fold = Math.sin((x - cx) * 0.55 + y * 0.01);
        setc(P(32), 0.72 + 0.16 * fold);
        if (fold > 0.85) setc(P(33), 0.8);
      }, { ol: 0.7 });
    }
    fill(30, -224, 192, -216, (x, y) => sdS(x, y, 34, -220, 188, -220, 1.8), () => setc(P(9)), { ol: 0.7 });
    fill(26, -226, 196, -214, (x, y) => Math.min(sdC(x, y, 32, -220, 3.2), sdC(x, y, 190, -220, 3.2)), () => setc(P(10)), { ol: 0.7 });
  }
  function fairyLights(t) {
    const pts = [];
    for (let k = 0; k <= 26; k++) {
      const u = k / 26, x = lerp(-190, 200, u);
      const y = -214 + 16 * Math.sin(u * PI * 3) ** 2 + 4 * u;
      pts.push([x, y]);
    }
    fill(-200, -220, 210, -190, (x, y) => {
      const u = clamp((x + 190) / 390, 0, 1);
      const yy = -214 + 16 * Math.sin(u * PI * 3) ** 2 + 4 * u;
      return Math.abs(y - yy) - 0.45 - 0.2 * IZ;
    }, () => setc(P(3)), {});
    pts.forEach(([x, y], k) => {
      const tw = 0.75 + 0.25 * Math.sin(TAU * (3 * t / D) + k * 1.9);
      const c = k % 3 === 0 ? P(13) : k % 3 === 1 ? P(12) : P(34);
      // a soft halo, then the bulb
      fill(x - 9, y - 6, x + 9, y + 12, (X, Y) => sdC(X, Y, x, y + 3.5, 7), (X, Y) => { const g = Math.max(0, 1 - Math.hypot(X - x, Y - y - 3.5) / 7); setc(c); SO[0] = SO[0] * 0.12 * g * g * tw; SO[1] = SO[1] * 0.12 * g * g * tw; SO[2] = SO[2] * 0.12 * g * g * tw; }, { add: true });
      fill(x - 6, y - 2, x + 6, y + 10, (X, Y) => sdE(X, Y, x, y + 3.5, 1.6 + 0.4 * IZ, 2.4 + 0.4 * IZ), () => setc(c, 0.9 + 0.2 * tw), { em: true });
    });
  }
  function clock(t) {
    const cx = -70, cy = -138, r = 18;
    fill(cx - r - 3, cy - r - 3, cx + r + 3, cy + r + 3, (x, y) => sdC(x, y, cx, cy, r + 2), (x, y, d) => {
      if (d > -3) setc(P(10), 0.95); else setc(P(16));
      const a = Math.atan2(y - cy, x - cx), rr = Math.hypot(x - cx, y - cy);
      const tk = mod(a / TAU * 12 + 0.5, 1) - 0.5;
      if (rr > r - 5 && rr < r - 2 && Math.abs(tk) * rr * TAU / 12 < 0.7) setc(P(4));
    }, { ol: 0.7, rim: 4, ld: 0.4 });
    // 21:47 — the hands
    const hm = (47 / 60) * TAU - PI / 2, hh = ((9 + 47 / 60) / 12) * TAU - PI / 2;
    fill(cx - r, cy - r, cx + r, cy + r, (x, y) => Math.min(sdS(x, y, cx, cy, cx + Math.cos(hm) * 13, cy + Math.sin(hm) * 13, 0.8 + 0.3 * IZ), sdS(x, y, cx, cy, cx + Math.cos(hh) * 8.5, cy + Math.sin(hh) * 8.5, 1.2 + 0.3 * IZ)), () => setc(P(2)));
    fill(cx - 3, cy - 3, cx + 3, cy + 3, (x, y) => sdC(x, y, cx, cy, 1.6), () => setc(P(10)));
  }
  function shelf() {
    // a floating shelf with books and a trailing pothos
    fill(-182, -186, -96, -178, (x, y) => sdB(x, y, -139, -181, 42, 2.8, 0.8), () => setc(P(9)), { ol: 0.7, rim: 2 });
    const books = [[-176, 6, 22, 31], [-169, 5, 25, 21], [-163, 6, 20, 43], [-156, 4, 24, 13], [-151, 5, 18, 32]];
    for (const [bx, bw, bh, c] of books)
      fill(bx - 1, -184 - bh, bx + bw + 1, -183, (x, y) => sdB(x, y, bx + bw / 2, -184 - bh / 2, bw / 2, bh / 2), (x, y) => { setc(P(c)); if (Math.abs(y - (-184 - bh * 0.75)) < 0.8) setc(P(13), 0.9); }, { ol: 0.65, rim: 2 });
    // a leaning book and a small pot
    fill(-146, -206, -128, -183, (x, y) => sdPoly(x, y, [-145, -184, -141, -184, -131, -204, -135, -206]), () => setc(P(22)), { ol: 0.65 });
    fill(-122, -196, -104, -183, (x, y) => sdPoly(x, y, [-120, -195, -106, -195, -108, -183, -118, -183]), () => setc(P(33)), { ol: 0.65, rim: 2 });
    for (let k = 0; k < 4; k++) {
      const ox = -117 + k * 3.5, len = 18 + k * 9;
      fill(ox - 8, -198, ox + 8, -190 + len, (x, y) => {
        const yy = y + 194; if (yy < 0 || yy > len + 4) return 1;
        const xx = ox + Math.sin(yy * 0.18 + k) * 2.5;
        let d = Math.abs(x - xx) - 0.5 - 0.25 * IZ;
        for (let l = 4; l < len; l += 6) d = Math.min(d, sdE(x, y, xx + ((l / 6 + k) % 2 ? 2.2 : -2.2), -194 + l, 2.4, 1.7));
        return d;
      }, (x, y) => setc((fl(x * 0.7 + y * 0.3) & 1) ? P(28) : P(27)), { ol: 0.7 });
    }
  }
  function picture() {
    const cx = -6, cy = -150;
    fill(cx - 18, cy - 22, cx + 18, cy + 22, (x, y) => sdB(x, y, cx, cy, 16, 20), (x, y, d) => {
      if (d > -2.5) { setc(P(8)); return; }
      if (d > -4) { setc(P(16)); return; }
      // a little painting: sunset over the sea
      const v = (y - cy + 16) / 32;
      if (v < 0.45) mixc(P(51), P(52), v / 0.45); else setc(P(48), 0.9 + 0.1 * Math.sin(x * 2));
      if (Math.hypot(x - cx, y - cy - 0.5) < 4 && v < 0.5) setc(P(13));
    }, { ol: 0.7, rim: 2.5 });
  }
  const LAMP = { x: -150, y: -84 };
  function lamp() {
    const lx = LAMP.x;
    fill(lx - 16, 58, lx + 16, 72, (x, y) => sdE(x, y, lx, 66, 13, 3.6), () => setc(P(9)), { ol: 0.6, rim: 3 });
    fill(lx - 3, -76, lx + 3, 68, (x, y) => sdS(x, y, lx, -74, lx, 66, 0.9 + 0.35 * IZ), () => setc(P(10)), { rim: 2, ld: 0.6 });
    // the shade (glows)
    fill(lx - 28, -116, lx + 28, -70, (x, y) => sdPoly(x, y, [lx - 16, -114, lx + 16, -114, lx + 24, -76, lx - 24, -76]), (x, y) => {
      const v = (y + 114) / 38;
      mixc(P(13), P(15), v * v);
      const pl = Math.sin((x - lx) * 0.9 / (0.65 + 0.35 * v));
      if (pl > 0.8) setc(P(14));
      if (v > 0.93) setc(P(12));
      if (v < 0.06) setc(P(11));
    }, { em: true, ol: 0.85 });
  }
  function sofaBack() {
    const sc = (x, y, d, k) => {
      // velvet: soft nap in noise, darker toward the bottom of each cushion
      const n = vn2(x * 0.25, y * 0.25, 33);
      setc(P(22), (k || 1) * (0.9 + 0.1 * n));
    };
    fill(-140, -60, 160, 12, (x, y) => sdB(x, y, 10, -22, 140, 32, 12), (x, y, d) => sc(x, y, d, 0.86), { ol: 0.7, rim: 6, ld: 0.3 });
    for (const cx of [-48, 68])
      fill(cx - 60, -42, cx + 60, 12, (x, y) => sdB(x, y, cx, -14, 56, 22, 9) + 0.6 * Math.sin((x - cx) * 0.2) * sstep(-30, -36, y), (x, y, d) => { sc(x, y, d, 0.98 - 0.12 * sstep(-10, 8, y)); }, { ol: 0.72, rim: 7, ld: 0.45 });
    // throw pillows: honey with a diamond, rust
    fill(-110, -40, -50, 8, (x, y) => sdB(x, y, -82, -14, 22, 20, 8) - 1.5 * Math.cos((y + 14) * 0.13), (x, y, d) => {
      setc(P(11), 0.92);
      const g = Math.abs(x + 82) + Math.abs(y + 14);
      if (Math.abs(g - 11) < 1.5) setc(P(16)); else if (g < 4) setc(P(32));
    }, { ol: 0.66, rim: 6, ld: 0.5 });
    fill(98, -36, 140, 8, (x, y) => sdB(x, y, 118, -12, 17, 17, 7) - 1.2 * Math.cos((x - 118) * 0.16), () => setc(P(32), 0.95), { ol: 0.66, rim: 6, ld: 0.5 });
  }
  function sofaFront() {
    const sc = (x, y, k) => { const n = vn2(x * 0.25, y * 0.25, 34); setc(P(22), k * (0.9 + 0.1 * n)); };
    // seat cushions
    for (const cx of [-48, 68]) {
      fill(cx - 60, 2, cx + 60, 42, (x, y) => sdB(x, y, cx, 22, 58, 17, 6), (x, y) => {
        sc(x, y, y < 10 ? 1.06 : 0.86);
        if (y > 9 && y < 11) sc(x, y, 0.78);
      }, { ol: 0.7, rim: 5, ld: 0.3 });
    }
    // base and legs
    fill(-140, 36, 160, 62, (x, y) => sdB(x, y, 10, 48, 142, 11, 3), (x, y) => sc(x, y, 0.7), { ol: 0.7 });
    for (const lx of [-122, 142]) fill(lx - 5, 56, lx + 5, 70, (x, y) => sdPoly(x, y, [lx - 4, 58, lx + 4, 58, lx + 2, 68, lx - 2, 68]), () => setc(P(7)), { ol: 0.7 });
    // arms (rolled)
    for (const ax of [-124, 144]) {
      fill(ax - 22, -30, ax + 22, 62, (x, y) => Math.min(sdB(x, y, ax, 18, 18, 42, 7), sdC(x, y, ax, -16, 19)), (x, y) => sc(x, y, y < -10 ? 1.02 : 0.92), { ol: 0.7, rim: 7, ld: 0.45 });
      fill(ax - 8, -24, ax + 8, -8, (x, y) => sdC(x, y, ax + 3 * Math.sign(ax), -16, 6), () => sc(0, 0, 0.82), { ol: 0.8 });
    }
    // a knitted blanket over the left arm
    fill(-150, -40, -96, 46, (x, y) => sdPoly(x, y, [-147, -34, -104, -38, -100, -18, -104, 34, -112, 44, -120, 36, -128, 44, -138, 38, -146, 10]) - 1, (x, y) => {
      const cab = Math.sin((x + 125) * 0.9 + Math.sin(y * 0.35) * 1.6);
      setc(P(16), 0.86 + 0.08 * cab);
      if (mod(x + 3, 9) < 1) setc(P(17));
      if (y > 30 && mod(x, 4) < 1.2) setc(P(18));
    }, { ol: 0.7, rim: 6, ld: 0.5 });
  }
  function plant() {
    const px = 176;
    fill(px - 22, 18, px + 22, 70, (x, y) => sdPoly(x, y, [px - 19, 24, px + 19, 24, px + 14, 68, px - 14, 68]), (x, y) => {
      setc(P(32), 0.9);
      if (y < 30) setc(P(33));
      if (mod(y, 9) < 1) setc(P(31));
    }, { ol: 0.65, rim: 5, ld: 0.5 });
    const leaves = [[-34, -62, 0.6, 22], [8, -90, 0.1, 24], [-14, -40, -0.3, 19], [24, -48, 0.5, 20], [-30, -10, -0.9, 16], [16, -14, 1.1, 15]];
    for (const [ox, oy, ang, r] of leaves) {
      const lx = px + ox, ly = oy;
      // stem
      fill(Math.min(lx, px) - 3, Math.min(ly, 24) - 3, Math.max(lx, px) + 3, 28, (x, y) => sdS(x, y, px + ox * 0.15, 24, lx, ly + r * 0.6, 0.9 + 0.3 * IZ), () => setc(P(27)), {});
      const ca = Math.cos(ang), sa = Math.sin(ang);
      fill(lx - r - 2, ly - r - 2, lx + r + 2, ly + r + 2, (x, y) => {
        const u = (x - lx) * ca + (y - ly) * sa, v = -(x - lx) * sa + (y - ly) * ca;
        // heart-ish leaf with slits (monstera)
        let d = sdE(u, v, 0, 0, r * 0.95, r * 0.78) + 0.05 * r * Math.abs(Math.sin(Math.atan2(v, u) * 2));
        const a = Math.atan2(v, u), rr = Math.hypot(u, v);
        const sl = Math.abs(mod(a * 7 / PI + 0.5, 1) - 0.5);
        if (rr > r * 0.45 && sl < 0.05 + 0.02 * (rr / r)) d = Math.max(d, 0.6 - sl * 6);
        return d;
      }, (x, y) => {
        const u = (x - lx) * ca + (y - ly) * sa, v = -(x - lx) * sa + (y - ly) * ca;
        setc(P(28), 0.92 + 0.1 * Math.sign(v));
        if (Math.abs(v) < 0.5 + 0.2 * IZ && u > -r * 0.7) setc(P(29));
        if (Math.abs(Math.abs(u * 0.6) - Math.abs(v)) < 0.35 && Math.hypot(u, v) > r * 0.3) setc(P(27));
      }, { ol: 0.6, rim: 5, ld: 0.6 });
    }
  }
  function table(t) {
    // top, edge, legs
    for (const lx of [-96, 176]) fill(lx - 7, 130, lx + 7, 260, (x, y) => sdB(x, y, lx, 190, 4.5, 60), (x) => setc(P(8), 0.9 + 0.1 * Math.sign(x - lx)), { ol: 0.7 });
    fill(-130, 82, 214, 152, (x, y) => sdB(x, y, 42, 117, 168, 32, 12), (x, y, d) => {
      const g = fbm(x * 0.06, y * 0.6, 51, 2);
      setc(P(10), 0.9 + 0.16 * g);
      if (y > 141) setc(P(8), 0.92 + 0.1 * g);
      else if (y > 139) setc(P(11));
      if (fr(g * 9) < 0.08 && y < 139) setc(P(9));
    }, { ol: 0.65, rim: 3, ld: 0.3 });
  }
  function candle(t) {
    const cx = -58, cy = 106;
    fill(cx - 10, cy - 16, cx + 10, cy + 12, (x, y) => sdB(x, y, cx, cy, 8, 10, 2.5), (x, y) => {
      setc(P(16), 0.88);
      if (y > cy + 3) setc(P(17), 0.86);
      if (Math.abs(x - cx + 4) < 1) setc(P(15));
    }, { ol: 0.6, rim: 3 });
    const fl0 = 0.85 + 0.15 * Math.sin(TAU * 11 * t / D) * Math.sin(TAU * 7 * t / D + 1);
    fill(cx - 4, cy - 20, cx + 4, cy - 8, (x, y) => sdE(x, y, cx + 0.3 * Math.sin(TAU * 5 * t / D), cy - 13.5, 1.7 + 0.3 * IZ, 3.4 * fl0 + 0.3 * IZ), (x, y) => { setc(y < cy - 14 ? P(13) : P(12)); }, { em: true });
  }
  function books() {
    fill(-140, 92, -84, 128, (x, y) => sdB(x, y, -112, 117, 26, 6, 1), (x, y) => { setc(P(21)); if (x > -88) setc(P(16)); }, { ol: 0.6, rim: 2 });
    fill(-136, 90, -88, 118, (x, y) => sdB(x, y, -113, 107, 22, 5, 1), (x, y) => { setc(P(31)); if (x > -94) setc(P(15)); }, { ol: 0.6, rim: 2 });
  }
  function clementines() {
    const bx = 160, by = 108;
    fill(bx - 22, by - 6, bx + 22, by + 14, (x, y) => Math.max(sdE(x, y, bx, by + 2, 20, 11), y - by - 12 > 0 ? 1 : -1, by - 2 - y), (x, y) => setc(P(16), 0.86), { ol: 0.6, rim: 4 });
    for (const [ox, oy] of [[-8, -3], [6, -4], [-1, -9]])
      fill(bx + ox - 8, by + oy - 8, bx + ox + 8, by + oy + 8, (x, y) => sdC(x, y, bx + ox, by + oy, 6.5), (x, y) => { setc(P(33)); if (Math.hypot(x - bx - ox + 2, y - by - oy + 2) < 2) setc(P(34)); }, { ol: 0.7, rim: 4, ld: 0.5 });
    fill(bx - 18, by - 2, bx + 18, by + 14, (x, y) => Math.max(sdE(x, y, bx, by + 2, 20, 11), by + 1 - y), (x, y) => setc(P(16), 0.9 - 0.15 * sstep(by + 2, by + 12, y)), { ol: 0.6 });
  }
  function mug(cx, cy, s, t, steam) {
    // a terracotta mug with a cream band
    fill(cx - 9 * s, cy - 9 * s, cx + 12 * s, cy + 9 * s, (x, y) => ring(sdC(x, y, cx + 7.5 * s, cy, 3.8 * s), 1.3 * s), () => setc(P(32)), { ol: 0.7 });
    fill(cx - 8 * s, cy - 9 * s, cx + 8 * s, cy + 9 * s, (x, y) => sdB(x, y, cx, cy, 7 * s, 8 * s, 1.5 * s), (x, y) => {
      setc(P(32));
      if (Math.abs(y - cy) < 1.6 * s) setc(P(16));
      if (y < cy - 6.5 * s) setc(P(31), 0.8);
    }, { ol: 0.7, rim: 3 * s, ld: 0.5 });
    if (steam > 0) {
      for (let k = 0; k < 3; k++) {
        const ph0 = fr(t * 0.35 + k / 3);
        const yy = cy - 10 * s - ph0 * 22 * s, xx = cx + (k - 1) * 3 * s + Math.sin(ph0 * 7 + k * 2) * 2.5 * s;
        const a = Math.sin(ph0 * PI) * 0.45 * steam;
        fill(xx - 3 * s, yy - 4 * s, xx + 3 * s, yy + 4 * s, (x, y) => sdE(x, y, xx, yy, 1.1 * s + 0.4 * IZ, 3 * s), () => setc(P(15)), { a, em: true });
      }
    }
  }
  // the phone: screen up (s: world per screen pixel); content in SCR; on: brightness 0..1
  function phone(cx, cy, s, on, rot) {
    const bw = (SW + 8) / 2 * s, bh = (SH + 16) / 2 * s;
    fill(cx - bw - 1, cy - bh - 1, cx + bw + 1, cy + bh + 1, (x, y) => sdB(x, y, cx, cy, bw, bh, 12 * s), (x, y, d) => {
      setc(P(2));
      if (d > -1.2 * s - IZ) setc(P(5));
    }, { ol: 0.9 });
    const hw = SW / 2 * s, hh = SH / 2 * s;
    fill(cx - hw, cy - hh, cx + hw, cy + hh, (x, y) => sdB(x, y, cx, cy, hw, hh, 6 * s), (x, y) => {
      if (on <= 0.01) { setc(P(58)); const g = (x - cx + y - cy) / (hw + hh); if (Math.abs(g + 0.2) < 0.08) setc(P(59)); return; }
      const u = clamp(fl((x - cx + hw) / s), 0, SW - 1), v = clamp(fl((y - cy + hh) / s), 0, SH - 1), j = (v * SW + u) * 3;
      SO[0] = SCR[j] * on + 35 * (1 - on); SO[1] = SCR[j + 1] * on + 35 * (1 - on); SO[2] = SCR[j + 2] * on + 45 * (1 - on);
    }, { em: true, nd: true });
    // camera notch
    fill(cx - 3 * s, cy - bh, cx + 3 * s, cy - hh, (x, y) => sdC(x, y, cx, cy - hh - 4 * s, 1.6 * s), () => setc(P(1)), { em: true });
  }
  // the phone seen from behind in a hand: a sage case, its screen's light spilling round it
  function phoneBack(cx, cy, w, h) {
    fill(cx - w - 1, cy - h - 1, cx + w + 1, cy + h + 1, (x, y) => sdB(x, y, cx, cy, w, h, w * 0.3), (x, y) => {
      setc(P(21));
      if (Math.hypot(x - cx + w * 0.45, y - cy + h * 0.6) < w * 0.28) setc(P(2));
    }, { ol: 0.6, rim: 2, ld: 0.6 });
  }

  /* ================================================================ Noor */
  const SKIN = P(39), SKIN_D = P(38), SKIN_L = P(40), HAIR = P(1), HAIR_L = P(4), SWEAT = P(43), PANTS = P(21);
  function person(t, ps) {
    const bx = PX + (ps.bx || 0), hy = ps.hy, hx = bx + ps.hx;
    const sh = ps.hunch;
    const shY = -36 + sh * 5 + ps.breath * -2.2, shX = 21 - sh * 3;
    // hair puff behind
    const puffX = hx + ps.tilt * -14, puffY = hy - 21;
    const puffSDF = (x, y) => {
      const dx = x - puffX, dy = y - puffY, r0 = Math.hypot(dx, dy);
      let d = r0 - 16;
      if (d < -8) return d;
      const kc = Math.round((Math.atan2(dy, dx) - 0.3) / TAU * 11);
      for (let q = kc - 1; q <= kc + 1; q++) {
        const k = ((q % 11) + 11) % 11, L = PUFF[k];
        d = Math.min(d, Math.hypot(dx - L[0], dy - L[1]) - L[2]);
      }
      return d;
    };
    const hairShade = curls(hx, hy);
    fill(puffX - 26, puffY - 26, puffX + 26, puffY + 26, puffSDF, hairShade, { ol: 0.7, rim: 3.5, ld: 0.8 });
    // legs, crossed on the seat
    const lg = (x, y) => Math.min(sdS(x, y, bx - 10, 14, bx - 36, 20, 8.5), sdS(x, y, bx + 10, 14, bx + 36, 20, 8.5));
    fill(bx - 48, 0, bx + 48, 34, lg, (x, y) => { setc(PANTS, 0.95 + 0.05 * Math.sin(x * 0.5)); }, { ol: 0.7, rim: 5, ld: 0.5 });
    const shin = (x, y) => Math.min(sdS(x, y, bx - 36, 22, bx + 8, 30, 6.8), sdS(x, y, bx + 36, 22, bx - 8, 33, 6.8));
    fill(bx - 46, 10, bx + 46, 42, shin, (x, y) => setc(PANTS, 1.02), { ol: 0.7, rim: 4, ld: 0.5 });
    // socks: cream with rust stripes
    for (const [fx, fy, s] of [[bx + 14, 29, 1], [bx - 14, 33, -1]])
      fill(fx - 9, fy - 7, fx + 9, fy + 7, (x, y) => sdE(x, y, fx + s * 2, fy, 6.5, 4.2), (x) => setc(mod(x * s, 4) < 1.6 ? P(32) : P(16), 0.95), { ol: 0.7, rim: 3 });
    // torso: an oversized mustard sweater
    const tor = [bx - shX, shY, bx + shX, shY, bx + 23, 0, bx + 24, 14, bx - 24, 14, bx - 23, 0];
    fill(bx - 30, shY - 6, bx + 30, 18, (x, y) => sdPoly(x, y, tor) - 3, (x, y) => {
      const cab = Math.sin((x - bx) * 0.7) * Math.sin(y * 0.45 + Math.cos((x - bx) * 0.7) * 1.2);
      setc(SWEAT, 0.92 + 0.08 * cab);
      if (Math.abs(mod(x - bx + 6, 12) - 6) < 0.7) setc(SWEAT, 0.82);
      if (y > 8) setc(SWEAT, mod(x, 2.4) < 1.2 ? 0.8 : 0.9);
    }, { ol: 0.66, rim: 6, ld: 0.5 });
    // neck
    fill(hx - 7, hy + 8, hx + 7, shY + 4, (x, y) => sdB(x, y, (hx + bx) / 2, (hy + 12 + shY) / 2, 5.2, Math.max(1, (shY - hy - 10) / 2 + 1)), () => setc(SKIN_D), {});
    // collar
    fill(bx - 14, shY - 4, bx + 14, shY + 6, (x, y) => ring(sdE(x, y, (hx + bx) / 2, shY + 0.5, 9.5, 3.5), 1.3), () => setc(SWEAT, 0.78), {});
    head(t, ps, hx, hy);
    // arms & what the hands hold
    const hold = ps.hold;   // 'mug' | 'phone'
    const hdy = hold === 'mug' ? -12 : -10 + sh * 3, hdx = hold === 'mug' ? 7 : 6.5;
    for (const s of [-1, 1]) {
      const sx = bx + s * (shX - 2), sy = shY + 4, ex = bx + s * 24, ey = -4 + sh * 2, wx = bx + s * hdx, wy = hdy + 3;
      fill(Math.min(sx, ex, wx) - 8, sy - 8, Math.max(sx, ex, wx) + 8, Math.max(ey, wy) + 8, (x, y) => Math.min(sdT(x, y, sx, sy, ex, ey, 7, 6.5), sdT(x, y, ex, ey, wx, wy, 6.5, 5.2)), (x, y) => {
        setc(SWEAT, 0.9);
        const cab = Math.sin((x + y) * 0.6);
        if (cab > 0.8) setc(SWEAT, 0.8);
        if (Math.hypot(x - wx, y - wy) < 5.5) setc(SWEAT, mod(x + y, 2.2) < 1.1 ? 0.78 : 0.88);
      }, { ol: 0.66, rim: 5, ld: 0.5 });
    }
    if (hold === 'mug') mug(bx, hdy, 1, t, ps.steam);
    else phoneBack(bx, hdy - 2, 7, 11);
    for (const s of [-1, 1]) {
      const wx = bx + s * (hdx + 1.5), wy = hdy + 1;
      fill(wx - 6, wy - 6, wx + 6, wy + 6, (x, y) => sdE(x, y, wx, wy, 4.4, 5), (x, y) => {
        setc(SKIN);
        if (Math.abs(y - wy) < 0.4 + 0.2 * IZ && x * s > (wx - 3 * s) * s) setc(SKIN_D);
      }, { ol: 0.7, rim: 3, ld: 0.5 });
    }
  }
  const PUFF = [];
  for (let k = 0; k < 11; k++) { const a = k / 11 * TAU + 0.3, rr = 14.5 + 1.5 * Math.sin(k * 2.3); PUFF.push([Math.cos(a) * rr, Math.sin(a) * rr * 0.92, 7.4 + 0.8 * Math.sin(k * 1.7)]); }
  // tight curls: small rings, one per jittered cell, with a soft sheen toward the lamp
  function curls(hx, hy) {
    return (x, y) => {
      const cx = (x - hx) / 2.7, cy = (y - hy) / 2.5, ix = fl(cx), iy = fl(cy);
      let best = 9, bdx = 0, bdy = 0, bh = 0;
      for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
        const ox = ix + a + 0.2 + 0.6 * ih(ix + a, iy + b, 61), oy = iy + b + 0.2 + 0.6 * ih(ix + a, iy + b, 62);
        const d = Math.hypot(cx - ox, cy - oy);
        if (d < best) { best = d; bdx = cx - ox; bdy = cy - oy; bh = ih(ix + a, iy + b, 64); }
      }
      setc(HAIR, 0.92 + 0.2 * vn2(cx * 0.4, cy * 0.4, 63));
      // a highlight arc on the lamp side of each curl (not every curl)
      if (bh > 0.3 && Math.abs(best - 0.4) < 0.07 + 0.14 / CZ && (-bdx * 0.8 - bdy * 0.6) > 0.05) setc(HAIR_L, 0.85 + 0.3 * bh);
      else if (best < 0.22 && bh > 0.5) setc(HAIR, 0.75);
    };
  }
  const HUV = new Float64Array(2);
  function head(t, ps, hx, hy) {
    const ca = Math.cos(ps.tilt), sa = Math.sin(ps.tilt);
    const L = (x, y) => { const dx = x - hx, dy = y - hy; return [dx * ca + dy * sa, -dx * sa + dy * ca]; };
    const UV = HUV;
    const loc = (x, y) => { const dx = x - hx, dy = y - hy; UV[0] = dx * ca + dy * sa; UV[1] = -dx * sa + dy * ca; };
    const headSDF = (x, y) => { loc(x, y); const rx = 14.2 - Math.max(0, UV[1] - 3) * 0.32; return sdE(UV[0], UV[1], 0, 0, rx, 16.5); };
    // ears + earrings
    for (const s of [-1, 1]) {
      fill(hx - 22, hy - 10, hx + 22, hy + 14, (x, y) => { loc(x, y); return sdE(UV[0], UV[1], s * 14, 1.5, 3.2, 4.6); }, () => setc(SKIN_D), { ol: 0.7 });
      fill(hx - 22, hy - 4, hx + 22, hy + 16, (x, y) => { loc(x, y); return ring(sdC(UV[0], UV[1], s * 14.4, 8.5, 2.2), 0.45 + 0.3 * IZ); }, () => setc(P(12)), { em: false });
    }
    fill(hx - 18, hy - 20, hx + 18, hy + 20, headSDF, (x, y) => {
      loc(x, y);
      setc(SKIN);
      // soft form: lighter on the lamp side, cheekbones
      const k = 0.94 + 0.08 * (-UV[0] / 14) * (ps.lampSide || 1);
      SO[0] *= k; SO[1] *= k; SO[2] *= k;
      if (Math.hypot(UV[0] - 9.5, UV[1] - 6.5) < 3 || Math.hypot(UV[0] + 9.5, UV[1] - 6.5) < 3) { SO[0] = SO[0] * 0.88 + P(33)[0] * 0.12; SO[1] = SO[1] * 0.88 + P(33)[1] * 0.12; SO[2] = SO[2] * 0.88 + P(33)[2] * 0.12; }
      // freckles
      if (CZ > 3 && UV[1] > 3 && UV[1] < 7 && Math.abs(UV[0]) > 4.5 && Math.abs(UV[0]) < 10.5 && ih(fl(UV[0] * 1.6), fl(UV[1] * 1.6), 77) > 0.86) mixc(SKIN, SKIN_D, 0.6);
    }, { ol: 0.72, rim: 5, ld: 0.45 });
    // hair: a cap over the top, curls along the hairline
    fill(hx - 22, hy - 26, hx + 22, hy + 4, (x, y) => {
      loc(x, y);
      const hl = -10.2 + 0.055 * UV[0] * UV[0] + 1.1 * Math.sin(UV[0] * 0.9 + 1);
      return Math.max(headSDF(x, y) - 1.6, UV[1] - hl);
    }, curls(hx, hy), { ol: 0.75, rim: 4, ld: 0.6 });
    // scrunchie
    fill(hx - 16, hy - 26, hx + 16, hy - 8, (x, y) => { loc(x, y); return sdE(UV[0], UV[1], 0, -15.5, 11, 2.8) + 0.4 * Math.sin(UV[0] * 1.6); }, (x, y) => { loc(x, y); setc(P(23), 0.95 + 0.08 * Math.sin(UV[0] * 1.6)); }, { ol: 0.7, rim: 2 });
    // face
    const E = ps.expr;
    const eyeOpen = E.open;
    for (const s of [-1, 1]) {
      const ex = s * 6.2, ey = 1.6;
      // eyes
      if (eyeOpen > 0.15) {
        const ry = Math.max(0.45 * IZ * 2, 2.3 * eyeOpen), rx = 2.7;
        fill(hx - 18, hy - 10, hx + 18, hy + 10, (x, y) => { loc(x, y); return sdE(UV[0], UV[1], ex, ey, rx, ry); }, (x, y) => {
          loc(x, y);
          setc(P(15));
          const gx = ex + E.gx * 1.2, gy = ey + E.gy * 0.9;
          const pr = Math.max(1.55 * (E.pupil || 1), 0.5 * IZ * 2);
          if (Math.hypot(UV[0] - gx, UV[1] - gy) < pr) { setc(P(2)); if (Math.hypot(UV[0] - gx + 0.55, UV[1] - gy + 0.6) < 0.5 + 0.3 * IZ) setc(P(15)); }
          if (UV[1] < ey - ry + 0.7 + 0.3 * IZ) setc(P(3));   // upper lid line
        }, {});
      } else {
        // closed: a soft arc (down for calm, up for laughing)
        const up = E.happy ? -1 : 1;
        fill(hx - 18, hy - 10, hx + 18, hy + 10, (x, y) => { loc(x, y); const du = (UV[0] - ex) / 2.8; if (Math.abs(du) > 1) return 1; return Math.abs(UV[1] - (ey + up * 1.2 * (1 - du * du) - up * 0.4)) - 0.45 - 0.35 * IZ; }, () => setc(P(3)), {});
      }
      // brows (worry lifts the inner ends)
      const bi = -5.6 - E.brow * 2.2, bo = -6.4 + E.brow * 0.7;
      fill(hx - 18, hy - 14, hx + 18, hy, (x, y) => { loc(x, y); return sdS(UV[0], UV[1], s * 2.6, bi, s * 9.2, bo, 0.75 + 0.25 * IZ); }, () => setc(HAIR), {});
      // glasses: round, amber tortoiseshell
      fill(hx - 18, hy - 10, hx + 18, hy + 12, (x, y) => { loc(x, y); return ring(sdC(UV[0], UV[1], ex, ey + 0.2, 5.6), 0.55 + 0.3 * IZ); }, (x, y) => { loc(x, y); setc(P(10), 0.8 + 0.2 * Math.sin(UV[0] * 2 + UV[1])); }, {});
      if (ps.glow > 0.2) // the screen in the lenses
        fill(hx - 18, hy - 10, hx + 18, hy + 12, (x, y) => { loc(x, y); return sdS(UV[0], UV[1], ex + 1.8, ey - 3.2, ex + 3.4, ey - 1.4, 0.3 + 0.3 * IZ); }, () => setc(P(56)), { a: 0.75 * ps.glow, em: true });
    }
    fill(hx - 4, hy - 4, hx + 4, hy + 6, (x, y) => { loc(x, y); return sdS(UV[0], UV[1], 0, 1.5, 0, 0.6, 0.5 + 0.25 * IZ); }, () => setc(P(10)), {});
    // nose
    fill(hx - 5, hy, hx + 5, hy + 10, (x, y) => { loc(x, y); return sdE(UV[0], UV[1], 0, 5.4, 1.9, 1.3); }, (x, y) => { loc(x, y); setc(SKIN_D, UV[0] > 0.6 ? 0.92 : 1.0); }, {});
    // mouth
    const mo = E.mouthOpen || 0, sm = E.smile;
    fill(hx - 10, hy + 4, hx + 10, hy + 17, (x, y) => {
      loc(x, y);
      const w = 4.2 + 1.6 * Math.max(0, sm) + mo * 1.2, du = UV[0] / w;
      if (Math.abs(du) > 1.08) return 1;
      const top = 10.4 - sm * 1.5 * (1 - du * du) + (E.wobble || 0) * 0.5 * Math.sin(UV[0] * 2.2);
      if (mo > 0.05) { const bot = top + mo * 4.5 * (1 - du * du) + 0.6; return Math.max(top - UV[1] - 0.45 - 0.3 * IZ, UV[1] - bot); }
      return Math.abs(UV[1] - top) - 0.42 - 0.32 * IZ;
    }, (x, y) => {
      loc(x, y);
      setc(P(36));
      if (mo > 0.05) { const top = 10.4 - sm * 1.5 * (1 - (UV[0] / (4.2 + 1.6 * Math.max(0, sm) + mo * 1.2)) ** 2); if (UV[1] < top + 1.0) setc(P(15)); else if (UV[1] > top + mo * 3) setc(P(33)); }
    }, {});
  }

  /* ================================================================ story state */
  function stateAt(t, shot) {
    const u = shot.u;                 // unwrapped time for the seam shot
    const ps = { hx: 0, hy: -58, tilt: 0, hunch: 0, breath: 0, hold: 'phone', steam: 0, glow: 0.8, lampSide: 1,
      expr: { open: 1, gx: 0, gy: 0.8, brow: 0.2, smile: 0, mouthOpen: 0, happy: false, pupil: 1 } };
    const E = ps.expr;
    const blink = (a) => { const b = Math.abs(u - a); if (b < 0.09) E.open = Math.min(E.open, b / 0.09 * 0.9); };
    let phoneOn = 0, lockAt = 0, phoneOnTable = false, mugOnTable = true;
    if (shot.i === 6) {
      if (u < 29.6) {           // laughing with the phone, then calming
        const lf = win(u, 25.6, 27.9, 0.15, 0.7);
        ps.tilt = -0.16 * lf; ps.hy = -58 - 2 * lf + Math.sin(u * 34) * 0.9 * lf;
        E.open = lf > 0.4 ? 0 : 0.8; E.happy = true; E.smile = 1; E.mouthOpen = 0.9 * lf; E.brow = -0.2; E.gy = 0.6;
        ps.glow = 0.5;
      } else {                  // under the quote: back to the mug, phone face-down on the table
        ps.hold = 'mug'; ps.steam = 1; ps.glow = 0; phoneOnTable = true; mugOnTable = false;
        E.open = 0.78; E.smile = 0.7; E.brow = -0.1; E.gy = 1; E.gx = -0.3;
        blink(32.4); blink(35.1);
        // the buzz: a glance toward the table, brows up
        const r = sstep(D - 0.35, D + 0.25, u);
        E.gx = lerp(-0.3, 1, r); E.gy = lerp(1, 1.1, r); E.brow = lerp(-0.1, 0.45, r); E.smile = lerp(0.7, 0.15, r); E.open = lerp(0.78, 1.05, r);
        ps.tilt = 0.06 * r; ps.hx = 1.5 * r;
        if (u > D + 1.4) { E.brow = lerp(0.45, 0.7, ph(u, D + 1.4, D + 2.2)); E.smile = lerp(0.15, -0.2, ph(u, D + 1.4, D + 2.2)); }
        phoneOn = sstep(D - 0.6, D - 0.5, u); lockAt = D - 0.55;
      }
    } else if (shot.i === 0) {    // reaction close-up: picked the phone up, reading
      E.gy = 1.25; E.gx = 0.2; E.brow = lerp(0.3, 0.75, ph(u, 2.5, 3.4)); E.smile = lerp(0, -0.3, ph(u, 2.5, 3.4)); ps.glow = 1;
      blink(3.0);
    } else if (shot.i === 2) {    // the dots stopped: worry builds
      const w = ph(u, 7.2, 10.6);
      E.gy = 1.2; E.brow = 0.8 + 0.4 * w; E.open = 1.08 + 0.12 * w; E.pupil = 1 - 0.25 * w; E.smile = -0.45 - 0.3 * w; E.wobble = 1;
      const dart = [[8.1, -1], [8.55, 0.9], [9.2, -0.8], [9.7, 0.6], [10.1, 0]];
      let gx = 0.2; for (const [a, v] of dart) if (u > a) gx = lerp(gx, v, sstep(a, a + 0.08, u));
      E.gx = gx; if (u > 8.0 && u < 10.2) E.gy = 0.2;
      blink(7.6); blink(9.95);
      ps.glow = 1; ps.hunch = 0.3 * w;
    } else if (shot.i === 3) {    // the spiral, seen whole
      const w = ph(u, 10.6, 19.4);
      ps.hunch = 0.4 + 0.6 * s5(w); ps.hy = -58 + 5 * s5(w); E.brow = 1.2; E.open = 1.2; E.pupil = 0.7; E.smile = -0.8; E.wobble = 1;
      E.gy = 1.1; E.gx = Math.sin(u * 3) * 0.4; ps.glow = 1;
      ps.bx = (ih(fl(u * 10), 3, 99) - 0.5) * 1.1 * s5(w);   // a shiver, on the ink's beat
    } else if (shot.i === 4) {    // the breath
      const inh = s5(ph(u, 19.75, 20.55)) - s5(ph(u, 20.75, 21.35));
      ps.breath = inh; ps.hy = -58 - inh * 1.6; ps.hunch = 0.6 - 0.5 * ph(u, 19.6, 21.4);
      E.open = u < 19.65 ? 1.15 : u < 21.25 ? 0 : 0.95; E.brow = lerp(1.1, 0.15, ph(u, 19.6, 21.3)); E.smile = lerp(-0.7, 0.05, ph(u, 19.8, 21.4));
      E.mouthOpen = 0.25 * s5(ph(u, 20.8, 21.0)) * (1 - s5(ph(u, 21.2, 21.4))); E.gy = 1.2; E.pupil = lerp(0.75, 1, ph(u, 20, 21.4)); ps.glow = 1;
    } else {                      // POV shots: hands only
      ps.glow = 1;
    }
    const s = { ps, phoneOn, lockAt, phoneOnTable, mugOnTable, u };
    if (shot.i === 6 && u >= 29.6) s.phoneOnTable = true;
    if (shot.i !== 6) s.phoneOnTable = false;
    return s;
  }

  /* ================================================================ the room render */
  function lightPass(t, st) {
    // ambient dusk + the lamp (with its cone on the wall) + the candle + the phone
    const lx = LAMP.x, ly = LAMP.y;
    const ph = st.lightPhone, pon = st.lightPhoneOn;
    for (let py = 0, i = 0; py < H; py++) {
      const wy = CY + (py + 0.5 - H / 2) * IZ;
      for (let px = 0; px < W; px++, i++) {
        if (EM[i]) continue;
        const wx = CX + (px + 0.5 - W / 2) * IZ;
        const dx = wx - lx, dy = wy - ly, d2 = dx * dx + dy * dy;
        let lam = 1 / (1 + d2 / 9000);
        // the cone: light thrown up and down the wall from the open shade
        const cw = 26 + Math.abs(dy) * 0.42;
        if (wy < 54 && Math.abs(dx) < cw && Math.abs(dy) > 14) lam += 0.32 * (1 - sstep(cw * 0.7, cw, Math.abs(dx))) * (1 - sstep(60, 180, Math.abs(dy)));
        let r = 0.36 + 0.95 * lam, g = 0.34 + 0.74 * lam, b = 0.44 + 0.42 * lam;
        // the candle
        const cd2 = (wx + 58) ** 2 + (wy - 94) ** 2, cl = 0.25 / (1 + cd2 / 900);
        r += cl; g += cl * 0.7; b += cl * 0.3;
        // fairy lights: a warm wash along the top of the wall
        const fw = 0.16 * sstep(-120, -205, wy); r += fw; g += fw * 0.75; b += fw * 0.4;
        if (pon > 0) {
          const pd2 = (wx - ph[0]) ** 2 + (wy - ph[1]) ** 2, pl = pon * ph[2] / (1 + pd2 / ph[3]);
          r += pl * 0.55; g += pl * 0.75; b += pl * 1.0;
        }
        const j = i * 3;
        C[j] *= r; C[j + 1] *= g; C[j + 2] *= b;
      }
    }
  }
  function drawRoom(t, st) {
    const ps = st.ps;
    LDX = -0.85; LDY = -0.5;
    wall(); windowAndSky(t); curtains(); shelf(); picture(); clock(t); fairyLights(t);
    floor(); rug(); lamp();
    sofaBack();
    sofaFront();
    MARK = 1; person(t, ps); MARK = 0;
    plant();
    table(t);
    books(); candle(t); clementines();
    if (st.mugOnTable) mug(18, 104, 1.5, t, 0);
    if (st.phoneOnTable || st.phoneOnTableAlways) {
      const bz = st.buzz || 0;
      const jx = bz ? (((fl(t * 30) & 1) ? 1 : -1) * 0.7 * bz) : 0;
      phone(PHX + jx, PHY, PU, st.phoneOn, 0);
    }
  }

  /* ================================================================ POV: the phone in Noor's hands */
  function drawPOV(t, st) {
    LDX = -0.6; LDY = -0.8;
    // lap: crossed legs, the blanket, the sofa
    fill(-400, -400, 400, 400, () => -1, (x, y) => {
      const n = vn2(x * 0.2, y * 0.2, 81);
      setc(P(22), 0.7 + 0.08 * n);
      // the knit blanket over the knees
      const bl = y > 40 + 12 * Math.sin(x * 0.03 + 1);
      if (bl) { const cab = Math.sin(x * 0.5 + Math.sin(y * 0.2) * 2); setc(P(16), 0.8 + 0.08 * cab); if (mod(x + 3, 14) < 1.5) setc(P(17), 0.85); }
    });
    // sleeves coming in from the bottom corners
    for (const s of [-1, 1])
      fill(s * 30 - 130, 10, s * 30 + 130, 160, (x, y) => sdT(x, y, s * 150, 160, s * 66, 84, 40, 25), (x, y) => {
        setc(SWEAT, 0.9 + 0.08 * Math.sin((x * s + y) * 0.35));
        if (Math.abs(mod(x * s * 0.7 + y * 0.7, 14) - 7) < 1) setc(SWEAT, 0.78);
      }, { ol: 0.66, rim: 10, ld: 0.5 });
    const bw = (SW + 8) / 2, bh = (SH + 16) / 2;
    // palms behind the phone
    for (const sd of [-1, 1]) fill(sd * 58 - 24, 50, sd * 58 + 24, 124, (x, y) => sdE(x, y, sd * 60, 90, 17, 28), () => setc(SKIN, 0.9), { ol: 0.7, rim: 6, ld: 0.5 });
    // the phone body and screen
    fill(-bw - 2, -bh - 2, bw + 2, bh + 2, (x, y) => sdB(x, y, 0, 0, bw, bh, 12), (x, y, d) => { setc(P(2)); if (d > -1.5) setc(P(5)); }, { ol: 0.9 });
    MARK = 1;
    fill(-SW / 2, -SH / 2, SW / 2, SH / 2, (x, y) => sdB(x, y, 0, 0, SW / 2, SH / 2, 6), (x, y) => {
      const u = clamp(fl(x + SW / 2), 0, SW - 1), v = clamp(fl(y + SH / 2), 0, SH - 1), j = (v * SW + u) * 3;
      SO[0] = SCR[j]; SO[1] = SCR[j + 1]; SO[2] = SCR[j + 2];
    }, { em: true, nd: true });
    MARK = 0;
    fill(-4, -bh, 4, -SH / 2, (x, y) => sdC(x, y, 0, -SH / 2 - 4, 1.8), () => setc(P(1)), { em: true });
    // fingertips over the side edges, thumbs on the glass
    for (const sd of [-1, 1]) {
      for (let k = 0; k < 3; k++) {
        const fy = 22 + k * 13 + (sd > 0 ? 3 : 0);
        fill(sd * bw - 9, fy - 8, sd * bw + 9, fy + 8, (x, y) => sdE(x, y, sd * (bw + 1.5), fy, 4.6, 6), (x, y) => { setc(SKIN, 0.92); if (Math.hypot(x - sd * (bw - 0.5), y - fy + 1) < 2.2) setc(SKIN_L, 0.95); }, { ol: 0.72, rim: 3, ld: 0.5 });
      }
      const tx = sd * 38 + (st.thumb && sd === 1 ? st.thumb[0] : 0), ty = 72 + (st.thumb && sd === 1 ? st.thumb[1] : 0), bx0 = sd * (bw + 8), by0 = 96;
      fill(Math.min(tx, bx0) - 10, Math.min(ty, by0) - 10, Math.max(tx, bx0) + 10, by0 + 12, (x, y) => sdT(x, y, bx0, by0, tx, ty, 8.5, 5.4), (x, y) => {
        setc(SKIN);
        const d2 = Math.hypot(x - tx, y - ty);
        if (d2 < 3.6) setc(SKIN_L);
        if (Math.abs(d2 - 6.5) < 0.6 && (x - tx) * sd > 0) setc(SKIN_D);
      }, { ol: 0.7, rim: 4, ld: 0.6 });
    }
  }
  function lightPOV(t, st) {
    for (let py = 0, i = 0; py < H; py++) {
      const wy = CY + (py + 0.5 - H / 2) * IZ;
      for (let px = 0; px < W; px++, i++) {
        if (EM[i]) continue;
        const wx = CX + (px + 0.5 - W / 2) * IZ;
        const d2 = wx * wx + wy * wy * 0.6, pl = 0.55 / (1 + d2 / 9000);
        const warm = 0.55 + 0.35 * sstep(140, -160, wx + wy * 0.5);
        const j = i * 3;
        C[j] *= warm * 1.05 + pl * 0.5; C[j + 1] *= warm * 0.9 + pl * 0.7; C[j + 2] *= warm * 0.72 + pl * 0.95;
      }
    }
  }

  /* ================================================================ the quote card (screen space, after lighting) */
  const QY0 = 92, QY1 = 382, QX0 = 22, QX1 = 338, QT = QY0 + 24;   // QT: the first line of type
  const Q1 = ['There are more things', 'likely to frighten us', 'than there are to', 'crush us;'];
  const QINK = { size: 50 };                       // the ink word, in ink px (cap height)
  function qLayout() {
    const wi = textW('in', 2), wink = 11 * 5.4 / 6 * QINK.size / KS, tot = wi + 7 + wink;
    const x = Math.round(180 - tot / 2);
    return { inX: x, inkX: (x + wi + 7) * KS, inkY: (QT + 154 + 14) * KS - QINK.size, inkW: wink * KS };
  }
  function qPix(px, py, c, prog) {
    if (px < 0 || py < 0 || px >= W || py >= H) return;
    if (BAY[(((py >> 1) & 3) << 2) | ((px >> 1) & 3)] + 0.5 >= prog) return;
    const i = py * W + px, j = i * 3; C[j] = c[0]; C[j + 1] = c[1]; C[j + 2] = c[2]; ND[i] = 1; PM[i] = 0;
  }
  function qText(str, x, y, c, prog) {
    for (const ch of str) {
      const g = FONT[ch] || FONT['?'];
      for (let gy = 0; gy < 9; gy++) for (let gx = 0; gx < g.w; gx++) if (g.bm[gy * g.w + gx])
        for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) qPix(x + gx * 2 + b, y + gy * 2 + a, c, prog);
      x += (g.w + 1) * 2;
    }
    return x;
  }
  function quoteCard(u) {
    const pc = ph(u, 27.8, 28.35) * (1 - ph(u, 35.35, 35.9)), p2 = ph(u, 30.8, 31.25) * (1 - ph(u, 35.35, 35.9));
    if (pc <= 0) return;
    // shadow
    for (let py = QY0 + 4; py < QY1 + 5; py++) for (let px = QX0 + 4; px < QX1 + 4; px++) {
      if (BAY[(((py >> 1) & 3) << 2) | ((px >> 1) & 3)] + 0.5 >= pc) continue;
      const j = (py * W + px) * 3; C[j] *= 0.45; C[j + 1] *= 0.42; C[j + 2] *= 0.42;
    }
    // paper, a honey rule inside the edge
    for (let py = QY0; py < QY1; py++) for (let px = QX0; px < QX1; px++) {
      const e = Math.min(px - QX0, QX1 - 1 - px, py - QY0, QY1 - 1 - py);
      let c = P(16);
      if (e < 1) c = P(5); else if (e === 6 || e === 7) c = P(11); else if (ih(px >> 1, py >> 1, 707) > 0.93) c = P(17);
      if ((px === QX0 && py === QY0) || (px === QX1 - 1 && py === QY0) || (px === QX0 && py === QY1 - 1) || (px === QX1 - 1 && py === QY1 - 1)) continue;
      qPix(px, py, c, pc);
    }
    const ink = P(3);
    Q1.forEach((l, k) => qText(l, Math.round(180 - textW(l, 2) / 2), QT + k * 24, ink, pc));
    if (p2 > 0) {
      const l1 = 'we suffer more often';
      qText(l1, Math.round(180 - textW(l1, 2) / 2), QT + 130, ink, p2);
      const L = qLayout();
      qText('in', L.inX, QT + 154, ink, p2);
      const l3a = 'than in ', l3b = 'reality.', w3 = textW(l3a + l3b, 2), x3 = Math.round(180 - w3 / 2);
      const xr = qText(l3a, x3, QT + 178, ink, p2);
      const xe = qText(l3b, xr, QT + 178, P(32), p2);
      for (let px = xr; px < xe - 6; px++) for (let a = 0; a < 2; a++) qPix(px, QT + 178 + 17 + a, P(11), p2);
      const sn = '— Seneca';
      qText(sn, QX1 - 26 - textW(sn, 2), QT + 218, P(9), p2);
    }
  }
  // the buzz: little pixel arcs either side of the phone, alternating frame to frame
  function buzzMarks(t) {
    const cx = sxOf(PHX), cy = syOf(PHY), hw = (SW + 8) / 2 * PU * CZ, hh = (SH + 16) / 2 * PU * CZ, f = fl(t * 30) & 1;
    for (const s of [-1, 1]) for (let k = 0; k < 2; k++) {
      const r = hh * 0.55 + k * Math.max(3, hw * 0.25) + f * 1.5, ax = cx - s * (r - hw - 4 - k * 2);
      for (let py = Math.round(cy - r); py <= Math.round(cy + r); py++) for (let px = Math.round(ax - r - 2); px <= Math.round(ax + r + 2); px++) {
        if (px < 0 || py < 0 || px >= W || py >= H) continue;
        const dx = px + 0.5 - ax, dy = py + 0.5 - cy, d = Math.hypot(dx, dy);
        if (Math.abs(d - r) > 0.75 || dx * s > -r * 0.82 || Math.abs(dy) > r * 0.42) continue;
        const j = (py * W + px) * 3, c = P(15); C[j] = c[0]; C[j + 1] = c[1]; C[j + 2] = c[2]; ND[py * W + px] = 1;
      }
    }
  }

  /* ================================================================ render one frame of the pixel layer */
  let SHOT = null, STATE = null;
  function renderPixels(t) {
    t = mod(t, D);
    const shot = shotAt(t), st = stateAt(t, shot);
    SHOT = shot; STATE = st;
    EM.fill(0); ND.fill(0); PM.fill(0);
    const cam = CAM[shot.i](shot.u);
    if (shot.k === 'pov') {
      setCam(cam[0], cam[1], Math.exp(cam[2]));
      paintChat(t);
      if (t > 21.55 && t < 22.25) {   // the right thumb types, then presses send
        const tap = Math.abs(Math.sin((t - 21.6) * PI / 0.09)) * (t < 22.05 ? 1 : 0), go = s5(ph(t, 21.92, 22.0)), back = s5(ph(t, 22.1, 22.25));
        st.thumb = [lerp(-26 + 6 * Math.sin(t * 23), 2, go) * (1 - back), (lerp(-6, -2, go) + 3 * tap) * (1 - back)];
      }
      drawPOV(t, st);
      lightPOV(t, st);
    } else {
      setCam(cam[0], cam[1], Math.exp(cam[2]));
      // what is on the phone, and its light
      if (st.phoneOnTable) {
        paintLock(shot.u, st.lockAt);
        st.phoneOn = st.phoneOn !== undefined ? st.phoneOn : 1;
        const u = shot.u, b1 = u > D - 0.55 && u < D + 0.15, b2 = u > D + 0.55 && u < D + 1.05;
        st.buzz = b1 || b2 ? 1 : 0;
        st.lightPhone = [PHX, PHY, 1.25 + 0.35 * st.buzz, 1500]; st.lightPhoneOn = st.phoneOn;
      } else {
        st.lightPhone = [PX, st.ps.hy + 50, 0.75, 700]; st.lightPhoneOn = st.ps.hold === 'phone' ? st.ps.glow : 0;
      }
      drawRoom(t, st);
      lightPass(t, st);
      if (st.buzz) buzzMarks(t);
      if (shot.i === 6) quoteCard(shot.u);
    }
  }
  function quantise() {
    const DA = 3.4, KQ = 63 / Math.sqrt(255);
    for (let y = 0, i = 0; y < H; y++) {
      const by = (y & 3) << 2;
      for (let x = 0; x < W; x++, i++) {
        const j = i * 3, d = ND[i] ? 0 : BAY[by | (x & 3)] * DA;
        let r = C[j], g = C[j + 1], b = C[j + 2];
        r = r <= 0 ? 0 : r >= 255 ? 63 : Math.sqrt(r) * KQ; g = g <= 0 ? 0 : g >= 255 ? 63 : Math.sqrt(g) * KQ; b = b <= 0 ? 0 : b >= 255 ? 63 : Math.sqrt(b) * KQ;
        let qr = (r + d + 0.5) | 0, qg = (g + d + 0.5) | 0, qb = (b + d + 0.5) | 0;
        qr = qr < 0 ? 0 : qr > 63 ? 63 : qr; qg = qg < 0 ? 0 : qg > 63 ? 63 : qg; qb = qb < 0 ? 0 : qb > 63 ? 63 : qb;
        OUT[i] = LUT[(qr << 12) | (qg << 6) | qb];
      }
    }
  }

  /* ================================================================ the ink (Canvas 2D, full resolution) */
  // Everything here is drawn at 1080 × 1350 over the pixel layer. Lines boil: control points get fresh jitter
  // ten times a second (BOIL), so a held drawing shimmers like hand-redrawn animation on threes.
  let INK = null, IG = null, MASKC = null, MASKG = null, MASKI = null, MASKP = null, GRAIN = null, GPAT = null;
  const SMUDGE = [], SMUDGE_P = [], SMUDGE_G = [];
  let BOIL = 0, JIT = 1, IT = 0;      // boil index, jitter scale, ink time (quantised to the boil)
  const INKC = '#0d0a0e', CHAR1 = '#1d191d', CHAR2 = '#3a3438', BRUISE = '#4e2d5f', BRUISE_L = '#7b4f8a', ACID = '#b7d63c', ACID_D = '#6f8a1c', BLOOD = '#a4482a', PAPER = '#cfc6b4', CHALK = '#d8d0bf';
  const IX = (x) => ((x - CX) * CZ + W / 2) * KS, IY = (y) => ((y - CY) * CZ + H / 2) * KS;
  const jit = (s, i, a) => (ih(s, i, BOIL) - 0.5) * 2 * a * JIT;

  function makeSmudge(seed, rgb, stretch) {
    const S = 160, c = document.createElement('canvas'); c.width = c.height = S;
    const g = c.getContext('2d'), im = g.createImageData(S, S), d = im.data;
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const u = (x / S - 0.5) * 2, v = (y / S - 0.5) * 2;
      const r = Math.hypot(u, v) + 0.45 * (fbm(x * 0.025, y * 0.025, seed, 3) - 0.5);
      const fall = Math.pow(clamp(1 - r, 0, 1), 1.1);
      const grain = 0.45 + 0.55 * fbm(x * 0.05 * stretch, y * 0.05 / stretch, seed + 9, 3) + (ih(x, y, seed) > 0.985 ? -0.4 : 0);
      const a = clamp(fall * grain * 1.6, 0, 1);
      const k = (y * S + x) * 4; d[k] = rgb[0]; d[k + 1] = rgb[1]; d[k + 2] = rgb[2]; d[k + 3] = a * 255;
    }
    g.putImageData(im, 0, 0);
    return c;
  }
  function initInk() {
    INK = document.createElement('canvas'); INK.width = OW; INK.height = OH; IG = INK.getContext('2d');
    MASKC = document.createElement('canvas'); MASKC.width = W; MASKC.height = H; MASKG = MASKC.getContext('2d');
    MASKI = MASKG.createImageData(W, H); MASKP = new Uint32Array(MASKI.data.buffer);
    for (let k = 0; k < 4; k++) SMUDGE.push(makeSmudge(200 + k, [13, 10, 14], k % 2 ? 3 : 1.4));
    for (let k = 0; k < 2; k++) SMUDGE_P.push(makeSmudge(300 + k, [70, 38, 88], 2));
    SMUDGE_G.push(makeSmudge(400, [120, 150, 30], 1.6));
    // charcoal grain for big fills
    GRAIN = document.createElement('canvas'); GRAIN.width = GRAIN.height = 256;
    const g = GRAIN.getContext('2d'), im = g.createImageData(256, 256), d = im.data;
    for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
      // periodic noise so the pattern tiles
      const n = 0.5 * (vn2(x * 0.0625 % 16, y * 0.25 % 64, 501) ) + 0.3 * ih(x, y, 502) + 0.2 * vn2((x % 256) * 0.25, (y % 256) * 0.03, 503);
      const k = (y * 256 + x) * 4, v = 10 + n * 34;
      d[k] = v; d[k + 1] = v * 0.86; d[k + 2] = v * 1.05; d[k + 3] = 205 + n * 50;
    }
    g.putImageData(im, 0, 0);
    GPAT = IG.createPattern(GRAIN, 'repeat');
  }

  /* ---------------------------------------------------------------- brush */
  function resample(pts, step) {
    const out = [], n = pts.length;
    if (n === 1) return [pts[0]];
    for (let i = 0; i < n - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(n - 1, i + 2)];
      const len = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]), m = Math.max(1, Math.ceil(len / step));
      for (let k = 0; k < m; k++) {
        const u = k / m, u2 = u * u, u3 = u2 * u;
        const a = -0.5 * u3 + u2 - 0.5 * u, b = 1.5 * u3 - 2.5 * u2 + 1, c = -1.5 * u3 + 2 * u2 + 0.5 * u, d = 0.5 * u3 - 0.5 * u2;
        out.push([a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0], a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1]]);
      }
    }
    out.push(pts[n - 1]);
    return out;
  }
  // a tapered, pressure-varying brush stroke through pts (ink px). o: seed, j (jitter px), t0/t1 taper fractions,
  // rough, dry (fraction where the brush runs dry and breaks into bristles), c (colour), part (0..1 drawn so far)
  function brush(pts, w, o) {
    o = o || {};
    const seed = o.seed || 0, ja = o.j === undefined ? 2 : o.j;
    let J = pts.map((p, i) => [p[0] + jit(seed, i * 2, ja), p[1] + jit(seed, i * 2 + 1, ja)]);
    let S = resample(J, o.step || 5);
    if (o.part !== undefined && o.part < 1) { const m = Math.max(2, Math.round(S.length * o.part)); if (o.part <= 0) return; S = S.slice(0, m); }
    const m = S.length; if (m < 2) return;
    const t0 = o.t0 === undefined ? 0.12 : o.t0, t1 = o.t1 === undefined ? 0.35 : o.t1, rough = o.rough === undefined ? 0.35 : o.rough;
    const dry = o.dry || 1, md = Math.max(2, Math.round(m * dry));
    const L = [], R = [], N = [];
    for (let i = 0; i < m; i++) {
      const u = i / (m - 1), a = S[Math.max(0, i - 1)], b = S[Math.min(m - 1, i + 1)];
      let nx = a[1] - b[1], ny = b[0] - a[0]; const nl = Math.hypot(nx, ny) || 1; nx /= nl; ny /= nl;
      let ww = w * Math.pow(Math.min(1, t0 > 0 ? u / t0 + 0.08 : 1, t1 > 0 ? (1 - u) / t1 + 0.04 : 1), 0.65);
      ww *= 0.72 + 0.56 * vn2(u * 4 + seed * 0.37, BOIL * 0.61, 7);
      ww *= 1 + rough * (ih(seed, i, BOIL + 77) - 0.5);
      ww = Math.max(ww, o.min || 0.7);
      N.push([nx, ny, ww]);
      L.push([S[i][0] + nx * ww * 0.5, S[i][1] + ny * ww * 0.5]); R.push([S[i][0] - nx * ww * 0.5, S[i][1] - ny * ww * 0.5]);
    }
    const g = IG;
    if (o.c) g.fillStyle = o.c;
    g.beginPath();
    g.moveTo(L[0][0], L[0][1]);
    for (let i = 1; i < md; i++) g.lineTo(L[i][0], L[i][1]);
    for (let i = md - 1; i >= 0; i--) g.lineTo(R[i][0], R[i][1]);
    g.closePath(); g.fill();
    if (dry < 1) {   // dry brush: the tail breaks into bristle streaks with gaps
      const nb = 6;
      g.strokeStyle = o.c || g.fillStyle; g.lineCap = 'round';
      for (let k = 0; k < nb; k++) {
        const f = (k / (nb - 1) - 0.5) * 0.9;
        g.lineWidth = Math.max(0.8, w / nb * (0.8 + 0.6 * ih(seed, k, 5)));
        g.beginPath(); let pen = false;
        for (let i = md - 1; i < m; i++) {
          const ur = (i - md) / Math.max(1, m - md);
          if (ih(seed + k * 13, fl(i / 2), BOIL) < 0.12 + 0.75 * ur) { pen = false; continue; }
          const x = S[i][0] + N[i][0] * N[i][2] * f * 1.6, y = S[i][1] + N[i][1] * N[i][2] * f * 1.6;
          if (pen) g.lineTo(x, y); else g.moveTo(x, y);
          pen = true;
        }
        g.stroke();
      }
    }
  }
  // a quick scratchy line (constant width, jittered)
  function scratch(pts, w, c, seed, ja) {
    const g = IG; g.strokeStyle = c; g.lineWidth = w; g.lineCap = 'round'; g.lineJoin = 'round';
    g.beginPath();
    pts.forEach((p, i) => { const x = p[0] + jit(seed, i * 2, ja), y = p[1] + jit(seed, i * 2 + 1, ja); if (i) g.lineTo(x, y); else g.moveTo(x, y); });
    g.stroke();
  }
  function smudge(x, y, r, a, k, set) {
    if (a <= 0.004 || r < 2) return;
    const s = (set || SMUDGE)[k % (set || SMUDGE).length], g = IG, a0 = g.globalAlpha;
    g.save(); g.globalAlpha = clamp(a, 0, 1) * a0; g.translate(x, y); g.rotate(ih(k, 3, 9) * TAU + (ih(k, BOIL, 4) - 0.5) * 0.25 * JIT);
    g.drawImage(s, -r, -r, r * 2, r * 2); g.restore();
  }
  function hatch(cx, cy, rx, ry, ang, n, len, w, c, seed, a) {
    const g = IG, ca = Math.cos(ang), sa = Math.sin(ang), a0 = g.globalAlpha;
    g.strokeStyle = c; g.lineWidth = w; g.lineCap = 'round'; g.globalAlpha = (a === undefined ? 1 : a) * a0;
    g.beginPath();
    for (let k = 0; k < n; k++) {
      const u = ih(seed, k, 1) * 2 - 1, v = ih(seed, k, 2) * 2 - 1;
      if (u * u + v * v > 1) continue;
      const x = cx + u * rx + jit(seed, k * 3, 2), y = cy + v * ry + jit(seed, k * 3 + 1, 2), l = len * (0.6 + 0.6 * ih(seed, k, 3));
      g.moveTo(x - ca * l / 2, y - sa * l / 2); g.lineTo(x + ca * l / 2 + jit(seed, k * 3 + 2, 1.5), y + sa * l / 2);
    }
    g.stroke(); g.globalAlpha = a0;
  }
  function splat(x, y, r, n, seed, c) {
    const g = IG; g.fillStyle = c || INKC;
    for (let k = 0; k < n; k++) {
      const a = ih(seed, k, 1) * TAU, d = r * Math.pow(ih(seed, k, 2), 0.7), s = (1 - d / r) * r * 0.16 * (0.4 + ih(seed, k, 3)) + 1.2;
      g.beginPath(); g.arc(x + Math.cos(a) * d + jit(seed, k, 1), y + Math.sin(a) * d + jit(seed, k + 50, 1), s, 0, TAU); g.fill();
    }
  }
  function blob(x, y, rx, ry, seed, c, rough) {
    const g = IG, n = 28; g.fillStyle = c;
    g.beginPath();
    for (let k = 0; k <= n; k++) {
      const a = k / n * TAU, rr = 1 + (rough === undefined ? 0.12 : rough) * (vn2(Math.cos(a) * 2 + seed, Math.sin(a) * 2 + BOIL * 0.4, 9) - 0.5) * 2;
      const px = x + Math.cos(a) * rx * rr, py = y + Math.sin(a) * ry * rr;
      if (k) g.lineTo(px, py); else g.moveTo(px, py);
    }
    g.closePath(); g.fill();
  }
  // an ellipse drawn as one or two boiling brush loops
  function ringStroke(x, y, rx, ry, w, seed, loops, c) {
    for (let l = 0; l < (loops || 1); l++) {
      const pts = [], n = 18, a0 = ih(seed, l, 3) * TAU;
      for (let k = 0; k <= n + 2; k++) { const a = a0 + k / n * TAU; pts.push([x + Math.cos(a) * rx * (1 + 0.04 * l), y + Math.sin(a) * ry * (1 + 0.04 * l)]); }
      brush(pts, w, { seed: seed + l * 17, c, t0: 0.08, t1: 0.15, j: 2.2 });
    }
  }

  /* ---------------------------------------------------------------- a scrawled stroke alphabet (capitals) */
  const O_ = [[2, 0], [0.5, 0.9], [0, 3], [0.5, 5.1], [2, 6], [3.5, 5.1], [4, 3], [3.5, 0.9], [2, 0]];
  const P_ = [[0, 6], [0, 0], [3, 0], [4, 0.9], [4, 2.1], [3, 3], [0, 3]];
  const SF = {
    A: [[[0, 6], [2, 0], [4, 6]], [[0.9, 3.7], [3.1, 3.7]]],
    B: [[[0, 6], [0, 0], [2.8, 0], [3.8, 0.8], [3.8, 2.2], [2.8, 3], [0, 3]], [[2.8, 3], [4, 3.9], [4, 5.1], [3, 6], [0, 6]]],
    C: [[[4, 0.9], [3, 0], [1.2, 0], [0, 1.4], [0, 4.6], [1.2, 6], [3, 6], [4, 5.1]]],
    D: [[[0, 0], [0, 6], [2.4, 6], [4, 4.4], [4, 1.6], [2.4, 0], [0, 0]]],
    E: [[[4, 0], [0, 0], [0, 6], [4, 6]], [[0, 3], [3, 3]]],
    F: [[[4, 0], [0, 0], [0, 6]], [[0, 3], [3, 3]]],
    G: [[[4, 0.9], [3, 0], [1.2, 0], [0, 1.4], [0, 4.6], [1.2, 6], [3, 6], [4, 5], [4, 3.4], [2.4, 3.4]]],
    H: [[[0, 0], [0, 6]], [[4, 0], [4, 6]], [[0, 3], [4, 3]]],
    I: [[[2, 0], [2, 6]], [[0.8, 0], [3.2, 0]], [[0.8, 6], [3.2, 6]]],
    J: [[[4, 0], [4, 4.6], [2.8, 6], [1.2, 6], [0, 4.8]]],
    K: [[[0, 0], [0, 6]], [[4, 0], [0, 3.6]], [[1.4, 2.5], [4, 6]]],
    L: [[[0, 0], [0, 6], [4, 6]]],
    M: [[[0, 6], [0, 0], [2, 3.6], [4, 0], [4, 6]]],
    N: [[[0, 6], [0, 0], [4, 6], [4, 0]]],
    O: [O_],
    P: [P_],
    Q: [O_, [[2.5, 4.3], [4.3, 6.4]]],
    R: [P_, [[2, 3], [4, 6]]],
    S: [[[4, 0.9], [3, 0], [1, 0], [0, 0.9], [0, 2.1], [1, 3], [3, 3], [4, 3.9], [4, 5.1], [3, 6], [1, 6], [0, 5.1]]],
    T: [[[0, 0], [4, 0]], [[2, 0], [2, 6]]],
    U: [[[0, 0], [0, 4.6], [1.2, 6], [2.8, 6], [4, 4.6], [4, 0]]],
    V: [[[0, 0], [2, 6], [4, 0]]],
    W: [[[0, 0], [1, 6], [2, 2.4], [3, 6], [4, 0]]],
    X: [[[0, 0], [4, 6]], [[4, 0], [0, 6]]],
    Y: [[[0, 0], [2, 3], [4, 0]], [[2, 3], [2, 6]]],
    Z: [[[0, 0], [4, 0], [0, 6], [4, 6]]],
    '?': [[[0, 1.2], [1, 0], [3, 0], [4, 1], [4, 2.2], [2, 3.4], [2, 4.4]], [[2, 5.5], [2.1, 6]]],
    '!': [[[2, 0], [2, 4.2]], [[2, 5.5], [2.1, 6]]],
    "'": [[[2, 0], [1.6, 1.6]]],
    '.': [[[2, 5.5], [2.1, 6]]],
    ',': [[[2.2, 5.4], [1.4, 7]]],
  };
  function textStrokes(str) { let n = 0; for (const ch of str) n += (SF[ch] || []).length; return n; }
  // scrawled capitals: x, y = left of the baseline-top; size = cap height (px); prog = write-on 0..1
  function inkText(str, x, y, size, prog, o) {
    o = o || {};
    const sc = size / 6, total = textStrokes(str), seed = o.seed || 0, w = o.w || Math.max(2.5, size * 0.16);
    const ang = o.rot || 0, ca = Math.cos(ang), sa = Math.sin(ang);
    let k = 0, cx = 0, ci = 0;
    for (const ch of str) {
      ci++;
      if (ch === ' ') { cx += 3.2 * sc; continue; }
      const strokes = SF[ch] || [];
      const lr = (ih(seed, ci, 11) - 0.5) * 0.14, ly = (ih(seed, ci, 12) - 0.5) * size * 0.12, lsc = 1 + (ih(seed, ci, 13) - 0.5) * 0.16;
      const lc = Math.cos(lr), ls = Math.sin(lr);
      for (const st of strokes) {
        const part = clamp(prog * total - k, 0, 1); k++;
        if (part <= 0) continue;
        const pts = st.map(([u, v]) => {
          const px = (u - 2) * sc * lsc, py = (v - 3) * sc * lsc, rx = px * lc - py * ls + 2 * sc + cx, ry = px * ls + py * lc + 3 * sc + ly;
          return [x + rx * ca - ry * sa, y + rx * sa + ry * ca];
        });
        brush(pts, w, { seed: seed * 31 + k, c: o.c || INKC, t0: 0.1, t1: 0.25, j: o.j === undefined ? Math.max(1, size * 0.04) : o.j, part, step: 4, rough: 0.5 });
      }
      cx += 5.4 * sc;
    }
    return cx;
  }
  const textWidth = (str, size) => { let w = 0; for (const ch of str) w += ch === ' ' ? 3.2 : 5.4; return w * size / 6; };

  /* ---------------------------------------------------------------- creatures and threats */
  function eye(x, y, r, open, lx, ly, seed, o) {
    o = o || {};
    if (open < 0.06) { brush([[x - r, y], [x, y + r * 0.18], [x + r, y]], Math.max(2, r * 0.14), { seed, c: INKC }); return; }
    const g = IG, h = r * 0.62 * open;
    g.save();
    g.beginPath(); g.moveTo(x - r, y); g.quadraticCurveTo(x, y - h * 2, x + r, y); g.quadraticCurveTo(x, y + h * 1.7, x - r, y); g.closePath();
    g.fillStyle = o.white || '#d6d1bf'; g.fill(); g.clip();
    const ix = x + lx * r * 0.45, iy = y + ly * h * 0.35;
    g.fillStyle = o.iris || ACID; g.beginPath(); g.arc(ix, iy, r * 0.48, 0, TAU); g.fill();
    g.fillStyle = ACID_D; g.beginPath(); g.arc(ix, iy, r * 0.48, 0, TAU); g.lineWidth = r * 0.08; g.strokeStyle = ACID_D; g.stroke();
    g.fillStyle = INKC; g.beginPath(); g.ellipse(ix, iy, r * 0.12 * (o.slit ? 0.6 : 1.5), r * 0.36, 0, 0, TAU); g.fill();
    g.fillStyle = '#f4f1e6'; g.beginPath(); g.arc(ix - r * 0.16, iy - r * 0.18, r * 0.08, 0, TAU); g.fill();
    g.restore();
    brush([[x - r * 1.1, y + r * 0.05], [x - r * 0.4, y - h * 1.1], [x + r * 0.4, y - h * 1.1], [x + r * 1.1, y]], Math.max(2.5, r * 0.22), { seed: seed + 1, c: INKC, t0: 0.2, t1: 0.3 });
    brush([[x - r * 0.9, y + h * 0.3], [x, y + h * 0.95], [x + r * 0.9, y + h * 0.2]], Math.max(1.5, r * 0.1), { seed: seed + 2, c: INKC });
  }
  function mouthTeeth(x, y, w, h, open, seed) {
    const g = IG;
    g.fillStyle = INKC;
    g.beginPath();
    const n = 9;
    for (let k = 0; k <= n; k++) { const u = k / n, px = x - w / 2 + u * w, py = y - h * 0.15 * Math.sin(u * PI) + jit(seed, k, 1.5); if (k) g.lineTo(px, py); else g.moveTo(px, py); }
    for (let k = n; k >= 0; k--) { const u = k / n, px = x - w / 2 + u * w, py = y + h * open * Math.sin(u * PI) + jit(seed, k + 20, 1.5); g.lineTo(px, py); }
    g.closePath(); g.fill();
    // teeth
    g.fillStyle = CHALK;
    for (let k = 1; k < n; k++) {
      const u = k / n, px = x - w / 2 + u * w, top = y - h * 0.15 * Math.sin(u * PI);
      g.beginPath(); g.moveTo(px - w / n * 0.4, top + 1); g.lineTo(px + w / n * 0.4, top + 1); g.lineTo(px + jit(seed, k + 40, 1), top + h * open * 0.45 * Math.sin(u * PI) + 2); g.closePath(); g.fill();
    }
  }

  /* ---------------------------------------------------------------- elements */
  // ink tendrils crawling in from the frame edges, with charcoal and splatter
  function edgeCrawl(a, seed, pulse) {
    if (a <= 0.01) return;
    const per = 2 * (OW + OH), n = 34;
    for (let k = 0; k < n; k++) {
      const s = (k + ih(seed, k, 1) * 0.8) / n * per;
      let x, y, ang;
      if (s < OW) { x = s; y = -10; ang = PI / 2; } else if (s < OW + OH) { x = OW + 10; y = s - OW; ang = PI; } else if (s < 2 * OW + OH) { x = OW - (s - OW - OH); y = OH + 10; ang = -PI / 2; } else { x = -10; y = OH - (s - 2 * OW - OH); ang = 0; }
      ang += (ih(seed, k, 2) - 0.5) * 1.1;
      const L = a * (180 + 420 * ih(seed, k, 3)) * (1 + 0.04 * pulse), steps = Math.max(2, Math.round(L / 22));
      const pts = [[x, y]], ph0 = ih(seed, k, 4) * TAU, curl = (ih(seed, k, 5) - 0.5) * 0.5;
      for (let i = 1; i <= steps; i++) {
        ang += curl + Math.sin(i * 0.55 + ph0 + IT * 0.6) * 0.32;
        x += Math.cos(ang) * 22; y += Math.sin(ang) * 22; pts.push([x, y]);
      }
      const w = (16 + 26 * ih(seed, k, 6)) * Math.min(1, a * 1.6);
      brush(pts, w, { seed: seed + k * 7, c: INKC, t0: 0, t1: 0.75, dry: k % 3 === 0 ? 0.55 : 1, j: 3 });
      if (k % 2 === 0 && pts.length > 4) { // a branch
        const b = pts[fl(pts.length * 0.45)], ba = ang + (k % 4 ? 0.9 : -0.9), bl = L * 0.35;
        const bp = [b]; let bx = b[0], by = b[1], aa = ba;
        for (let i = 0; i < 5; i++) { aa += Math.sin(i + ph0) * 0.4; bx += Math.cos(aa) * bl / 5; by += Math.sin(aa) * bl / 5; bp.push([bx, by]); }
        brush(bp, w * 0.5, { seed: seed + k * 7 + 3, c: INKC, t0: 0, t1: 0.8 });
      }
      if (k % 3 === 1) splat(x, y, 26 * a, 7, seed + k, INKC);
    }
    // charcoal along the edges
    for (let k = 0; k < 18; k++) {
      const s = (k + 0.5) / 18 * per;
      let x, y;
      if (s < OW) { x = s; y = 0; } else if (s < OW + OH) { x = OW; y = s - OW; } else if (s < 2 * OW + OH) { x = OW - (s - OW - OH); y = OH; } else { x = 0; y = OH - (s - 2 * OW - OH); }
      smudge(x, y, (190 + 160 * ih(seed, k, 8)) * (0.5 + a), 0.85 * Math.min(1, a * 1.3), k);
    }
    // hatching fields just inside the edges
    for (let k = 0; k < 8; k++) {
      const s = (k + 0.3) / 8 * per; let x, y;
      if (s < OW) { x = s; y = 40; } else if (s < OW + OH) { x = OW - 40; y = s - OW; } else if (s < 2 * OW + OH) { x = OW - (s - OW - OH); y = OH - 40; } else { x = 40; y = OH - (s - 2 * OW - OH); }
      hatch(x, y, 110 * a, 110 * a, 0.7 + k, fl(26 * a), 34, 2.6, INKC, seed + 300 + k, 0.8);
    }
  }
  // a tangled scribble ball (rumination) — world-anchored centre, radius in px
  function scribble(cx, cy, rx, ry, a, seed, w, c) {
    if (a <= 0.01) return;
    const ns = 2 + fl(6 * a);
    for (let q = 0; q < ns; q++) {
      const pts = [], n = 22;
      const f1 = 0.62 + ih(seed, q, 1) * 0.3, f2 = 0.85 + ih(seed, q, 2) * 0.35, p1 = ih(seed, q, 3) * TAU, p2 = ih(seed, q, 4) * TAU, sc = 0.55 + 0.45 * a;
      for (let k = 0; k < n; k++) {
        const u = k * 0.75 + q * 2.3;
        pts.push([cx + rx * sc * (0.68 * Math.sin(u * f1 + p1 + IT * 0.9) + 0.32 * Math.sin(u * f2 * 2.1 + p2)),
          cy + ry * sc * (0.68 * Math.cos(u * f2 + p2 - IT * 0.7) + 0.32 * Math.cos(u * f1 * 1.7 + p1))]);
      }
      brush(pts, w * (0.5 + 0.9 * ih(seed, q, 5)), { seed: seed + q * 13, c: c || INKC, t0: 0.1, t1: 0.3, j: 3, step: 4, rough: 0.5 });
    }
  }
  // write-on whispers: [text, x, y, size, at, rot, seed]
  function whispers(list, t, a, ox, oy) {
    for (const [s, x, y, size, at, rot, seed, until] of list) {
      if (t < at) continue;
      const prog = clamp((t - at) / (0.08 * s.length + 0.15), 0, 1);
      const fade = until ? 1 - sstep(until - 0.3, until, t) : 1;
      if (fade <= 0) continue;
      IG.globalAlpha = a * fade;
      inkText(s, (ox || 0) + x, (oy || 0) + y, size, prog, { seed, rot, c: INKC });
      IG.globalAlpha = 1;
    }
  }
  // the clock spins (world anchored)
  function clockInk(t, a) {
    if (a <= 0.01) return;
    const cx = IX(-70), cy = IY(-138), r = 18 * CZ * KS, z = CZ * KS / 3;
    ringStroke(cx, cy, r * 1.18, r * 1.12, 7 * z, 900, 2, INKC);
    // the hands race (angle integrates an accelerating speed), with smeared afterimages
    const tt = Math.max(0, IT - 10.8), turn = 0.25 * tt + 0.11 * tt * tt;
    const am = turn * TAU, ah = turn * TAU / 5;
    for (let k = 4; k >= 0; k--) {
      const lag = k * 0.16;
      IG.globalAlpha = a * (k ? 0.22 : 1);
      brush([[cx, cy], [cx + Math.cos(am - lag - PI / 2) * r * 0.95, cy + Math.sin(am - lag - PI / 2) * r * 0.95]], (k ? 5 : 8) * z, { seed: 910 + k, c: INKC, t0: 0, t1: 0.5 });
      brush([[cx, cy], [cx + Math.cos(ah - lag * 0.3 - PI / 2) * r * 0.6, cy + Math.sin(ah - lag * 0.3 - PI / 2) * r * 0.6]], (k ? 6 : 10) * z, { seed: 920 + k, c: INKC, t0: 0, t1: 0.4 });
    }
    IG.globalAlpha = a;
    // tick marks flung outward
    for (let k = 0; k < 12; k++) {
      const an = k / 12 * TAU + turn * 0.2, d0 = r * (1.25 + 0.35 * a * ih(k, 1, 920)), d1 = d0 + r * 0.22;
      brush([[cx + Math.cos(an) * d0, cy + Math.sin(an) * d0], [cx + Math.cos(an) * d1, cy + Math.sin(an) * d1]], 4 * z, { seed: 930 + k, c: INKC });
    }
    IG.globalAlpha = 1;
  }
  // faces pressed against the window (world anchored, clipped to the glass)
  function windowFaces(t, a) {
    if (a <= 0.01) return;
    const g = IG, x0 = IX(58), y0 = IY(-206), x1 = IX(162), y1 = IY(-64), z = CZ * KS / 3;
    g.save();
    g.beginPath(); g.rect(x0, y0, x1 - x0, y1 - y0); g.clip();
    // the glass fogs with charcoal
    g.globalAlpha = 0.7 * a; g.fillStyle = GPAT; g.fillRect(x0, y0, x1 - x0, y1 - y0); g.globalAlpha = 1;
    const faces = [[80, -110, 15, 0.0], [112, -128, 18, 0.35], [146, -104, 14, 0.7], [96, -168, 12, 1.1], [138, -170, 11, 1.4]];
    faces.forEach(([fx, fy, fr0, del], k) => {
      const ap = s5(ph(a, del * 0.45, del * 0.45 + 0.45));
      if (ap <= 0) return;
      const sway = Math.sin(IT * 1.3 + k * 2) * 2.5;
      const X = IX(fx + sway), Y = IY(fy + (1 - ap) * 50), R = fr0 * CZ * KS;
      // shoulders and head: smeared charcoal silhouettes
      blob(X, Y + R * 1.9, R * 1.9, R * 1.0, 40 + k, '#121014', 0.15);
      blob(X, Y, R * 0.92, R * 1.12, 50 + k, '#19161b', 0.1);
      // hollow eyes looking at Noor, a whispering mouth
      const lx = -0.6, open = 0.75 + 0.25 * Math.sin(IT * 2 + k);
      eye(X - R * 0.36, Y - R * 0.1, R * 0.26, open, lx, 0.4, 60 + k, { iris: k % 2 ? ACID : '#9fb83a' });
      eye(X + R * 0.36, Y - R * 0.1, R * 0.26, open, lx, 0.4, 70 + k, { iris: k % 2 ? ACID : '#9fb83a' });
      const mo = 0.4 + 0.6 * Math.abs(Math.sin(IT * 7 + k * 1.7));
      blob(X - R * 0.05, Y + R * 0.5, R * 0.2, R * 0.16 * mo + 1, 80 + k, '#050405', 0.2);
      // palms on the glass
      if (k < 3) for (const s of [-1, 1]) {
        const hx = X + s * R * 1.45, hy = Y + R * 0.9;
        blob(hx, hy, R * 0.32, R * 0.4, 90 + k * 2 + s, '#141116', 0.15);
        for (let f = 0; f < 4; f++) brush([[hx + (f - 1.5) * R * 0.16, hy - R * 0.25], [hx + (f - 1.5) * R * 0.22, hy - R * 0.75]], R * 0.12, { seed: 95 + f + k * 9, c: '#141116', t1: 0.2 });
      }
    });
    g.restore();
    // whisper lines leaking into the room toward Noor
    for (let k = 0; k < 6; k++) {
      const sx = IX(70 + k * 14), sy = IY(-100 - (k % 3) * 22), ex = IX(PX + 10), ey = IY(-70);
      const pts = []; for (let i = 0; i <= 8; i++) { const u = i / 8 * a; pts.push([lerp(sx, ex, u) + Math.sin(u * 14 + k + IT * 3) * 10 * z, lerp(sy, ey, u) + Math.cos(u * 11 + k) * 8 * z]); }
      if (a > 0.2) scratch(pts, 2 * z + 1, 'rgba(14,11,15,0.6)', 990 + k, 2);
    }
  }
  // cracks spreading across the floor and the table (world-anchored polylines, built once)
  let CRACKS = null;
  function buildCracks() {
    CRACKS = [];
    const roots = [[PX - 30, 64], [PX + 40, 64], [PX + 5, 152], [-60, 152], [150, 152]];
    roots.forEach(([rx, ry], r) => {
      const n = r < 2 ? 3 : 2;
      for (let b = 0; b < n; b++) {
        let x = rx, y = ry, ang = (r < 2 ? PI / 2 : PI / 2) + (b - (n - 1) / 2) * 0.9 + (ih(r, b, 1) - 0.5) * 0.5;
        const pts = [[x, y]], len = 60 + 120 * ih(r, b, 2);
        for (let s = 0; s < len; s += 7) {
          ang += (ih(r * 10 + b, s, 3) - 0.5) * 1.2; ang = lerp(ang, PI / 2 + (ang > PI / 2 ? 0.7 : -0.7), 0.1);
          x += Math.cos(ang) * 7; y += Math.sin(ang) * 7 * 0.6; pts.push([x, y]);
        }
        CRACKS.push({ pts, d0: ih(r, b, 9) * 0.3 });
        // side branches
        for (let q = 3; q < pts.length - 2; q += 4 + fl(ih(r, b + q, 5) * 4)) {
          let bx = pts[q][0], by = pts[q][1], ba = ang + (ih(r, q, 6) > 0.5 ? 1 : -1) * (0.8 + ih(r, q, 7) * 0.6);
          const bp = [[bx, by]];
          for (let s = 0; s < 4; s++) { ba += (ih(r * 7 + q, s, 8) - 0.5) * 1; bx += Math.cos(ba) * 6; by += Math.sin(ba) * 6 * 0.6; bp.push([bx, by]); }
          CRACKS.push({ pts: bp, d0: ih(r, b, 9) * 0.3 + q / pts.length * 0.6 + 0.1, side: true });
        }
      }
    });
  }
  function cracks(a) {
    if (a <= 0.01) return;
    if (!CRACKS) buildCracks();
    const z = CZ * KS / 3;
    for (let k = 0; k < CRACKS.length; k++) {
      const c = CRACKS[k], part = clamp((a - c.d0) / 0.55, 0, 1);
      if (part <= 0) continue;
      const pts = c.pts.map(([x, y]) => [IX(x), IY(y)]);
      brush(pts, (c.side ? 6 : 13) * z, { seed: 1200 + k, c: INKC, t0: 0.02, t1: 0.6, part, j: 1.5, rough: 0.8 });
      if (!c.side && part > 0.3) {
        IG.globalAlpha = 0.55; brush(pts, 3 * z, { seed: 1300 + k, c: BLOOD, t0: 0.1, t1: 0.6, part: part * 0.8, j: 1 }); IG.globalAlpha = 1;
        // hatch shading beside the crack
        for (let q = 1; q < pts.length * part - 1; q += 2) hatch(pts[q][0], pts[q][1] + 8 * z, 10 * z, 5 * z, 1.1, 4, 12 * z, 1.6 * z + 0.6, INKC, 1400 + k * 50 + q, 0.7);
      }
    }
  }
  // the lamp becomes a long-necked thing peering down at Noor
  function lampCreature(t, a) {
    if (a <= 0.01) return;
    const z = CZ * KS / 3, lx = -150, reach = s5(a);
    const hx = lerp(lx + 40, -26, reach) + Math.sin(IT * 1.6) * 6 * reach, hy = lerp(-94, -132, reach);
    // the neck: from the base, bending over
    const neck = [];
    for (let i = 0; i <= 12; i++) { const u = i / 12; neck.push([IX(lerp(lx, hx, u * u) + Math.sin(u * 5 + IT * 2) * 5 * reach), IY(lerp(66, hy - 10, u) - Math.sin(u * PI) * 70 * reach)]); }
    brush(neck, 26 * z, { seed: 1500, c: INKC, t0: 0.05, t1: 0.1, dry: 0.9 });
    brush(neck.map(([x, y]) => [x + 9 * z, y + 4 * z]), 8 * z, { seed: 1501, c: INKC, t0: 0.1, t1: 0.2 });
    for (let i = 2; i < 11; i += 2) hatch(neck[i][0], neck[i][1], 14 * z, 14 * z, 0.4, 5, 20 * z, 2 * z, INKC, 1502 + i, 0.8);
    // the shade as a hunched head (tilting toward Noor)
    const tilt = 0.5 * reach, ct = Math.cos(tilt), st = Math.sin(tilt);
    const loc = (u, v) => [IX(hx + u * ct - v * st), IY(hy + u * st + v * ct)];
    const shade = [loc(-24, -28), loc(24, -28), loc(36, 24), loc(-36, 24)];
    IG.fillStyle = GPAT; IG.globalAlpha = 0.85 * a;
    IG.beginPath(); shade.forEach((p, i) => (i ? IG.lineTo(p[0], p[1]) : IG.moveTo(p[0], p[1]))); IG.closePath(); IG.fill(); IG.globalAlpha = 1;
    brush([...shade, shade[0]], 7 * z, { seed: 1510, c: INKC, t0: 0.02, t1: 0.05 });
    // one great eye under the rim, and teeth along it
    const e = loc(0, 38);
    eye(e[0], e[1], 13 * z * 3, 0.55 + 0.45 * reach, 0.8, 0.6, 1520, {});
    const m0 = loc(-34, 24), m1 = loc(34, 24);
    for (let k = 0; k < 9; k++) {
      const u = (k + 0.5) / 9, px = lerp(m0[0], m1[0], u), py = lerp(m0[1], m1[1], u);
      brush([[px - 7 * z, py], [px + jit(1530, k, 2), py + (22 + 12 * ih(k, 1, 1530)) * z * reach], [px + 7 * z, py]], 9 * z, { seed: 1540 + k, c: INKC, t0: 0.3, t1: 0.3 });
    }
    // the light it throws becomes a hatched cone of attention
    hatch(IX(lerp(hx, PX, 0.5)), IY(lerp(hy + 40, -40, 0.5)), 60 * z, 40 * z, 2.2, fl(30 * a), 26 * z, 2 * z, 'rgba(14,11,15,0.5)', 1550, a);
  }
  // the monstera reaches: each leaf a long-fingered hand
  function plantHands(t, a) {
    if (a <= 0.01) return;
    const z = CZ * KS / 3;
    const hands = [[176 - 34, -62, 0.9], [176 + 8, -90, 0.6], [176 - 14, -40, 1.1], [176 + 24, -48, 0.8], [176 - 30, -10, 1.4]];
    hands.forEach(([x, y, d], k) => {
      const ap = s5(ph(a, k * 0.1, k * 0.1 + 0.5));
      if (ap <= 0) return;
      const reach = ap * (40 + 20 * Math.sin(IT * 1.1 + k)), ang = PI + (ih(k, 2, 1600) - 0.5) * 0.8 + (k - 2) * 0.12;
      // palm = the leaf, outlined
      const px = IX(x), py = IY(y), R = 16 * CZ * KS;
      IG.globalAlpha = 0.85; blob(px, py, R * 0.9, R * 0.75, 1610 + k, '#141016', 0.18); IG.globalAlpha = 1;
      for (let f = 0; f < 5; f++) {
        const fa = ang + (f - 2) * 0.32, L = (reach + 18) * CZ * KS / 3 * 3 * (f === 0 || f === 4 ? 0.7 : 1);
        const curl = 0.5 * Math.sin(IT * 2.2 + f + k) * (1 - ap * 0.5);
        const p0 = [px + Math.cos(fa) * R * 0.7, py + Math.sin(fa) * R * 0.6];
        const p1 = [p0[0] + Math.cos(fa) * L * 0.45, p0[1] + Math.sin(fa) * L * 0.45];
        const p2 = [p1[0] + Math.cos(fa + curl) * L * 0.35, p1[1] + Math.sin(fa + curl) * L * 0.35];
        const p3 = [p2[0] + Math.cos(fa + curl * 2.2) * L * 0.22, p2[1] + Math.sin(fa + curl * 2.2) * L * 0.22];
        brush([p0, p1, p2, p3], 9 * z, { seed: 1620 + k * 10 + f, c: INKC, t0: 0.05, t1: 0.5 });
        // knuckles
        hatch(p1[0], p1[1], 5 * z, 5 * z, fa + PI / 2, 3, 8 * z, 1.5 * z + 0.5, INKC, 1700 + k * 10 + f, 0.9);
      }
    });
  }
  // imagined disasters, flickering on rough paper panels (screen space)
  function figure(x, y, s, o, seed) {
    o = o || {};
    const lean = o.lean || 0;
    IG.fillStyle = INKC; IG.beginPath(); IG.arc(x + jit(seed, 1, 1), y - s * 1.9, s * 0.42, 0, TAU); IG.fill();
    brush([[x, y - s * 1.45], [x + lean * s * 0.2, y - s * 0.7], [x + lean * s * 0.1, y - s * 0.1]], s * 0.32, { seed, c: INKC, t0: 0.1, t1: 0.2 });
    brush([[x, y - s * 0.1], [x - s * 0.3, y + s * 0.85]], s * 0.18, { seed: seed + 1, c: INKC });
    brush([[x, y - s * 0.1], [x + s * 0.3 + (o.walk || 0) * s * 0.3, y + s * 0.85]], s * 0.18, { seed: seed + 2, c: INKC });
    const ar = o.arms || [[-0.6, -0.5], [0.6, -0.5]];
    ar.forEach(([ax, ay], k) => brush([[x, y - s * 1.3], [x + ax * s * 0.6, y - s * 1.3 + (ay + 0.5) * s * 0.5], [x + ax * s, y - s * 1.3 + (ay + 0.9) * s * 0.6]], s * 0.15, { seed: seed + 3 + k, c: INKC }));
  }
  // a head in profile, facing dir (+1 right), mouth open by `open`, filled black with a pale eye
  function profileHead(x, y, s, dir, open, seed) {
    const P0 = [[0.55, 0.9], [0.62, 0.1], [0.42, -0.62], [0, -0.92], [-0.45, -0.72], [-0.62, -0.38], [-0.6, -0.12], [-0.78, 0.02], [-0.6, 0.16],
      [-0.62, 0.28], [-0.78 - 0.12 * open, 0.38 + 0.1 * open], [-0.5, 0.45 + 0.2 * open], [-0.6, 0.58 + 0.2 * open], [-0.4, 0.75], [-0.25, 0.95]];
    const pts = P0.map(([u, v]) => [x - dir * u * s + jit(seed, u * 100, 1.5), y + v * s + jit(seed, v * 100, 1.5)]);
    IG.fillStyle = INKC; IG.beginPath(); pts.forEach((p, i) => (i ? IG.lineTo(p[0], p[1]) : IG.moveTo(p[0], p[1]))); IG.closePath(); IG.fill();
    // eye and a furious brow
    IG.fillStyle = CHALK; IG.beginPath(); IG.ellipse(x + dir * 0.36 * s, y - 0.34 * s, s * 0.09, s * 0.06, 0, 0, TAU); IG.fill();
    brush([[x + dir * 0.18 * s, y - 0.56 * s], [x + dir * 0.52 * s, y - 0.44 * s]], s * 0.08, { seed: seed + 5, c: CHALK });
  }
  function heart(x, y, s, broken, seed) {
    const half = (side, dx) => {
      const pts = [];
      for (let k = 0; k <= 12; k++) {
        const u = k / 12 * PI, hx = 16 * Math.sin(u) ** 3, hy = -(13 * Math.cos(u) - 5 * Math.cos(2 * u) - 2 * Math.cos(3 * u) - Math.cos(4 * u));
        pts.push([x + dx + side * hx * s / 16, y + hy * s / 16]);
      }
      return pts;
    };
    for (const side of [-1, 1]) {
      const dx = broken * side * s * 0.4, pts = half(side, dx);
      // the jagged break down the middle
      pts.push([x + dx + side * s * 0.05, y + s * 0.65], [x + dx - side * s * 0.12, y + s * 0.3], [x + dx + side * s * 0.1, y - s * 0.05], [x + dx, y - s * 0.32]);
      IG.fillStyle = BLOOD; IG.globalAlpha = 0.85; IG.beginPath(); pts.forEach((p, i) => (i ? IG.lineTo(p[0], p[1]) : IG.moveTo(p[0], p[1]))); IG.closePath(); IG.fill(); IG.globalAlpha = 1;
      brush(pts.concat([pts[0]]), Math.max(3, s * 0.08), { seed: seed + side, c: INKC, t0: 0.02, t1: 0.05 });
    }
  }
  function panel(cx, cy, w, h, rot, a, seed, draw) {
    if (a <= 0.01) return;
    const g = IG;
    g.save(); g.translate(cx, cy); g.rotate(rot + jit(seed, 1, 0.006));
    // paper
    g.globalAlpha = a;
    g.fillStyle = PAPER;
    g.beginPath();
    const n = 6;
    for (let k = 0; k < 4 * n; k++) {
      const side = fl(k / n), u = (k % n) / n;
      const x = side === 0 ? lerp(-w / 2, w / 2, u) : side === 1 ? w / 2 : side === 2 ? lerp(w / 2, -w / 2, u) : -w / 2;
      const y = side === 0 ? -h / 2 : side === 1 ? lerp(-h / 2, h / 2, u) : side === 2 ? h / 2 : lerp(h / 2, -h / 2, u);
      const px = x + jit(seed, k, 3), py = y + jit(seed, k + 40, 3);
      if (k) g.lineTo(px, py); else g.moveTo(px, py);
    }
    g.closePath(); g.fill();
    g.globalAlpha = a * 0.25; g.fillStyle = GPAT; g.fill(); g.globalAlpha = a;
    // sketchy frame, overshooting the corners
    const cs = [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]];
    for (let k = 0; k < 4; k++) {
      const p = cs[k], q = cs[(k + 1) % 4], dx = (q[0] - p[0]) * 0.04, dy = (q[1] - p[1]) * 0.04;
      brush([[p[0] - dx, p[1] - dy], [q[0] + dx, q[1] + dy]], 7, { seed: seed + 10 + k, c: INKC, t0: 0.05, t1: 0.2 });
    }
    draw(g);
    g.restore();
    g.globalAlpha = 1;
  }
  function panels(t, tilt) {
    const P1 = win(IT, 13.5, 15.4, 0.25, 0.35), P2 = win(IT, 15.0, 16.9, 0.25, 0.35), P3 = win(IT, 16.5, 18.6, 0.25, 0.35);
    const fl1 = (s) => 0.88 + 0.12 * ih(s, BOIL, 1);
    panel(300, 360, 420, 330, -0.07 + tilt, P1 * fl1(1), 2001, () => {
      inkText("YOU'RE FIRED", -150, -140, 34, ph(IT, 13.6, 14.3), { seed: 2002 });
      // the walk out with a box, a plant poking out
      figure(40, 95, 52, { walk: 1, arms: [[0.55, -0.1], [0.75, -0.1]] }, 2010);
      IG.fillStyle = CHAR2; IG.fillRect(60, -20, 80, 56);
      brush([[60, -20], [140, -20], [140, 36], [60, 36], [60, -20]], 5, { seed: 2020, c: INKC, t0: 0.02, t1: 0.02 });
      brush([[98, -20], [92, -48], [104, -62]], 4, { seed: 2021, c: INKC });
      blob(104, -64, 8, 5, 2022, INKC);
      // a giant pointing hand
      blob(-150, 40, 34, 26, 2023, INKC, 0.15);
      brush([[-125, 30], [-60, 22]], 15, { seed: 2024, c: INKC, t0: 0.02, t1: 0.25 });
    });
    panel(290, 905, 400, 320, 0.06 + tilt, P2 * fl1(2), 2101, () => {
      inkText("WE'RE DONE", -130, -135, 34, ph(IT, 15.1, 15.8), { seed: 2102 });
      figure(-95, 105, 50, { arms: [[-0.6, -0.4], [-0.3, -0.2]], lean: -0.6 }, 2110);
      figure(95, 105, 50, { arms: [[0.6, -0.4], [0.3, -0.2]], lean: 0.6 }, 2120);
      heart(0, -30, 60, 0.25 + 0.25 * s5(ph(IT, 15.3, 16.2)), 2130);
      const cr = []; for (let k = 0; k <= 6; k++) cr.push([(k % 2 ? 10 : -10) + jit(2140, k, 4), 30 + k * 20]);
      brush(cr, 7, { seed: 2141, c: INKC, t0: 0.02, t1: 0.3 });
    });
    panel(780, 1010, 430, 320, -0.05 + tilt, P3 * fl1(3), 2201, () => {
      inkText("IT'S YOUR FAULT", -170, -135, 30, ph(IT, 16.6, 17.4), { seed: 2202 });
      // two heads shouting, jagged balloons
      for (const s of [-1, 1]) {
        const x = s * 120, y = 50;
        profileHead(x, y, 62, -s, 0.5 + 0.5 * Math.abs(Math.sin(IT * 9 + s)), 2210 + s);
        const bx = x - s * 85, by = y - 60, pts = [];
        for (let k = 0; k <= 14; k++) { const an = k / 14 * TAU, r = (k % 2 ? 26 : 44); pts.push([bx + Math.cos(an) * r * 1.25, by + Math.sin(an) * r * 0.8]); }
        brush(pts, 5, { seed: 2220 + s, c: INKC, t0: 0.02, t1: 0.05 });
        inkText(s < 0 ? '!!' : '?!', bx - 18, by - 16, 32, 1, { seed: 2230 + s });
      }
    });
  }
  // the phone, imagined: a monolith rising behind the sofa, the typing dots as eyes
  function giantPhoneEyesOnly(t) {
    const a = sstep(15.4, 17.4, t); if (a <= 0.01) return;
    const z = CZ * KS / 3, rise = s5(a), cx = 112, cy = lerp(80, -104, rise), rot = -0.2 * rise;
    const cr = Math.cos(rot), sr = Math.sin(rot);
    PHONE_EYES = { x: IX(cx - 6 * cr - 40 * sr), y: IY(cy - 6 * sr + 40 * cr), z, open: sstep(16.6, 17.2, t) };
  }
  function giantPhone(t, a, eyesOpen) {
    if (a <= 0.01) return;
    const z = CZ * KS / 3, rise = s5(a);
    const cx = 112, cy = lerp(80, -104, rise), hw = 72, hh = 118, rot = -0.2 * rise;
    const cr = Math.cos(rot), sr = Math.sin(rot);
    const L = (u, v) => [IX(cx + u * cr - v * sr), IY(cy + u * sr + v * cr)];
    const body = [];
    const rr = 18;
    for (let k = 0; k < 4; k++) {
      const sx = k === 0 || k === 3 ? -1 : 1, sy = k < 2 ? -1 : 1, a0 = [PI, PI * 1.5, 0, PI * 0.5][k];
      for (let i = 0; i <= 4; i++) { const an = a0 + i / 4 * PI / 2; body.push(L(sx * (hw - rr) + Math.cos(an) * rr, sy * (hh - rr) + Math.sin(an) * rr)); }
    }
    const g = IG;
    g.fillStyle = GPAT; g.beginPath(); body.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.closePath(); g.fill();
    g.globalAlpha = 0.75; brush(body.concat([body[0]]), 9 * z, { seed: 1801, c: CHALK, t0: 0.01, t1: 0.04, dry: 0.85, j: 3 }); g.globalAlpha = 1;
    brush(body.concat([body[0]]), 16 * z, { seed: 1800, c: INKC, t0: 0.01, t1: 0.04, dry: 0.9 });
    // the screen: a bruise-dark rectangle, the message in chalk, the dots as three eyes
    const scr = [L(-hw + 12, -hh + 26), L(hw - 12, -hh + 26), L(hw - 12, hh - 26), L(-hw + 12, hh - 26)];
    const sg = g.createLinearGradient(scr[0][0], scr[0][1], scr[3][0], scr[3][1]);
    sg.addColorStop(0, 'rgba(196,208,150,0.95)'); sg.addColorStop(0.55, 'rgba(150,164,110,0.95)'); sg.addColorStop(1, 'rgba(90,70,104,0.95)');
    g.fillStyle = sg; g.beginPath(); scr.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.closePath(); g.fill();
    g.save(); g.clip(); g.globalAlpha = 0.35; g.fillStyle = GPAT; g.fill(); g.globalAlpha = 1;
    hatch((scr[0][0] + scr[2][0]) / 2, (scr[0][1] + scr[2][1]) / 2, 120 * z * 3 / 3 * 3, 200 * z, 0.8, 50, 40 * z, 2 * z, 'rgba(13,10,14,0.35)', 1802, 1);
    g.restore();
    brush(scr.concat([scr[0]]), 6 * z, { seed: 1803, c: INKC, t0: 0.02, t1: 0.05 });
    const tp = L(-hw + 22, -hh + 44);
    g.save(); g.translate(tp[0], tp[1]); g.rotate(rot);
    const ts = 30 * z;
    inkText('CAN WE', 0, 0, ts, ph(IT, 15.9, 16.4), { seed: 1810, c: INKC, w: ts * 0.2 });
    inkText('TALK', 0, ts * 1.6, ts, ph(IT, 16.2, 16.6), { seed: 1811, c: INKC, w: ts * 0.2 });
    inkText('LATER?', 0, ts * 3.2, ts, ph(IT, 16.4, 16.9), { seed: 1812, c: INKC, w: ts * 0.2 });
    g.restore();
    // the typing bubble with three eyes
    const bc = L(-6, 40);
    g.fillStyle = 'rgba(214,209,191,0.92)';
    blob(bc[0], bc[1], 62 * z * 3, 30 * z * 3, 1820, INKC, 0.08);
    PHONE_EYES = { x: bc[0], y: bc[1], z, open: eyesOpen };
    phoneEyes();
  }
  let PHONE_EYES = null;
  function phoneEyes(a) {
    const e = PHONE_EYES; if (!e) return;
    IG.globalAlpha = a === undefined ? 1 : a;
    for (let k = 0; k < 3; k++) {
      const blink = ih(k, fl(IT * 2.5), 1830) > 0.85 ? 0.05 : 1;
      eye(e.x + (k - 1) * 40 * e.z * 3, e.y, 17 * e.z * 3, e.open * blink, -0.7 + 0.3 * Math.sin(IT * 1.3 + k), 0.6, 1840 + k * 3, {});
    }
    IG.globalAlpha = 1;
  }
  // the walls close in and the room leans (screen space, around a point)
  function walls(a, px, py) {
    if (a <= 0.01) return;
    const g = IG, inset = a * 0.24;
    const L = OW * inset, R = OW * (1 - inset), T = OH * inset * 0.55;
    g.fillStyle = GPAT;
    g.beginPath(); g.moveTo(-60, -60); g.lineTo(L + 30 * Math.sin(IT * 2.1), -60); g.lineTo(L * 0.85, OH + 60); g.lineTo(-60, OH + 60); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(OW + 60, -60); g.lineTo(R - 30 * Math.sin(IT * 1.9), -60); g.lineTo(R + (OW - R) * 0.15, OH + 60); g.lineTo(OW + 60, OH + 60); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(-60, -60); g.lineTo(OW + 60, -60); g.lineTo(OW + 60, T); g.lineTo(-60, T + 20 * Math.sin(IT)); g.closePath(); g.fill();
    // rough inner edges and converging perspective lines
    brush([[L + 30 * Math.sin(IT * 2.1), -40], [L * 0.92, OH * 0.5], [L * 0.85, OH + 40]], 16, { seed: 1900, c: INKC, t0: 0, t1: 0, dry: 0.9 });
    brush([[R - 30 * Math.sin(IT * 1.9), -40], [R + (OW - R) * 0.08, OH * 0.5], [R + (OW - R) * 0.15, OH + 40]], 16, { seed: 1901, c: INKC, t0: 0, t1: 0, dry: 0.9 });
    for (let k = 0; k < 10; k++) {
      const u = k / 9, sx = u < 0.5 ? 0 : OW, sy = lerp(-40, OH + 40, (u * 2) % 1.0001);
      IG.globalAlpha = 0.5 * a;
      brush([[sx, sy], [lerp(sx, px, 0.5 * a), lerp(sy, py, 0.5 * a)]], 4, { seed: 1910 + k, c: INKC, t0: 0, t1: 0.6 });
    }
    IG.globalAlpha = 1;
    // hatching on the walls
    hatch(L * 0.45, OH * 0.5, L * 0.5, OH * 0.5, 1.2, fl(70 * a), 40, 2.5, 'rgba(60,54,60,0.6)', 1920, 1);
    hatch(R + (OW - R) * 0.5, OH * 0.5, (OW - R) * 0.5, OH * 0.5, -1.2, fl(70 * a), 40, 2.5, 'rgba(60,54,60,0.6)', 1921, 1);
  }
  // darkness closing to a ragged hole around a point
  function tunnel(cx, cy, r, a, seed) {
    if (a <= 0.01) return;
    const g = IG, n = 40, pts = [];
    for (let k = 0; k < n; k++) {
      const an = k / n * TAU, rr = r * (1 + 0.16 * (vn2(Math.cos(an) * 2.2 + seed, Math.sin(an) * 2.2, BOIL % 7 + 3) - 0.5) * 2);
      pts.push([cx + Math.cos(an) * rr, cy + Math.sin(an) * rr * 1.15]);
    }
    g.globalAlpha = a;
    g.fillStyle = GPAT;
    g.beginPath(); g.rect(-50, -50, OW + 100, OH + 100);
    g.moveTo(pts[0][0], pts[0][1]); for (let k = n - 1; k >= 0; k--) g.lineTo(pts[k][0], pts[k][1]); g.closePath();
    g.fill('evenodd');
    brush(pts.concat([pts[0], pts[1]]), 30, { seed: seed + 1, c: INKC, t0: 0, t1: 0, dry: 0.8 });
    brush(pts.map(([x, y]) => [cx + (x - cx) * 1.06, cy + (y - cy) * 1.06]).concat([pts[0]]), 14, { seed: seed + 2, c: INKC, t0: 0.1, t1: 0.1 });
    for (let k = 0; k < n; k += 3) hatch(pts[k][0] + (pts[k][0] - cx) * 0.12, pts[k][1] + (pts[k][1] - cy) * 0.12, 40, 40, Math.atan2(pts[k][1] - cy, pts[k][0] - cx) + 1.4, 7, 46, 3, INKC, seed + 10 + k, 0.9);
    g.globalAlpha = 1;
  }
  // POV: the typing dots leave ink behind
  function ghostDots(t, a, big) {
    if (a <= 0.01) return;
    const k6 = CZ * KS, by = IY(59), bleed = ph(IT, 5.05, 7.2);
    IG.globalAlpha = a;
    for (let k = 0; k < 3; k++) {
      const x = IX(-39 + k * 8), r = (3.0 + 2.2 * bleed + 2.6 * big) * k6;
      // the drip runs down from each drop
      const dl = (6 + 10 * ih(k, 1, 2440)) * bleed * k6;
      brush([[x + jit(2450, k, 1), by], [x + 2, by + dl * 0.5], [x - 1, by + dl]], r * 0.7, { seed: 2460 + k, c: INKC, t0: 0, t1: 0.7 });
      blob(x, by, r, r * 1.05, 2400 + k, INKC, 0.25);
      splat(x, by, r * 2.4, 9, 2410 + k * 9, INKC);
      if (big > 0.05) eye(x, by - r * 0.05, r * 0.8, s5(ph(big, 0.15, 1)), lerp(0, 0.3, big), lerp(0.5, -0.8, big), 2420 + k * 5, {});
    }
    IG.globalAlpha = 1;
  }
  // the burn: the ink is eaten back from a ragged front with an ember rim
  function burn(cx, cy, r, seed) {
    if (r <= 0) return;
    const g = IG, n = 64, pts = [];
    for (let k = 0; k < n; k++) {
      const an = k / n * TAU, rr = r * (1 + 0.22 * (fbm(Math.cos(an) * 1.6 + seed, Math.sin(an) * 1.6 + IT * 0.5, 7, 2) - 0.5) * 2);
      pts.push([cx + Math.cos(an) * rr, cy + Math.sin(an) * rr]);
    }
    const path = () => { g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (let k = 1; k < n; k++) g.lineTo(pts[k][0], pts[k][1]); g.closePath(); };
    g.save();
    g.globalCompositeOperation = 'destination-out';
    path(); g.fillStyle = '#000'; g.fill();
    // ember rim on what remains
    g.globalCompositeOperation = 'source-atop';
    path(); g.lineJoin = 'round';
    g.strokeStyle = 'rgba(70,40,30,0.9)'; g.lineWidth = 90; g.stroke();
    g.strokeStyle = 'rgba(150,62,30,0.9)'; g.lineWidth = 46; g.stroke();
    g.strokeStyle = 'rgba(232,140,58,0.95)'; g.lineWidth = 22; g.stroke();
    g.strokeStyle = 'rgba(255,214,130,1)'; g.lineWidth = 8; g.stroke();
    g.restore();
    // sparks lifting off the edge
    g.fillStyle = '#ffd88a';
    for (let k = 0; k < 26; k++) {
      const an = ih(k, seed, 1) * TAU, lift = fr(IT * 0.9 + ih(k, seed, 2));
      const rr = r * (1.02 + 0.05 * ih(k, seed, 3)) + lift * 30;
      g.globalAlpha = 1 - lift;
      g.beginPath(); g.arc(cx + Math.cos(an) * rr, cy + Math.sin(an) * rr - lift * 50, 2.5 + 2 * ih(k, seed, 4), 0, TAU); g.fill();
    }
    g.globalAlpha = 1;
  }
  function eraseNoor() {
    for (let i = 0; i < NP; i++) MASKP[i] = PM[i] ? 0xff000000 : 0;
    MASKG.putImageData(MASKI, 0, 0);
    IG.save(); IG.globalCompositeOperation = 'destination-out'; IG.imageSmoothingEnabled = false;
    IG.drawImage(MASKC, 0, 0, OW, OH); IG.restore();
  }

  /* ---------------------------------------------------------------- heartbeats (shared with the score) */
  const BEATS = (() => { const b = []; let x = 7.3, iv = 0.95; while (x < 19.6) { b.push(x); x += iv; iv = Math.max(0.42, iv * 0.955); } return b; })();
  function pulseAt(t) { let p = 0; for (const b of BEATS) { const d = t - b; if (d > -0.02 && d < 0.5) p = Math.max(p, Math.exp(-d * 9)); } return p; }

  /* ---------------------------------------------------------------- per shot */
  const WH_FACE = [
    ['LATER??', 40, 130, 60, 7.5, -0.1, 1, 0], ['WHAT DID I DO', 560, 60, 38, 8.1, 0.06, 2, 0], ['IS IT BAD', 24, 560, 40, 8.7, -0.08, 3, 0],
    ["THEY'RE", 780, 560, 46, 9.2, 0.08, 4, 0], ['ANGRY', 800, 640, 58, 9.45, 0.05, 5, 0], ['I KNEW IT', 20, 860, 38, 9.9, -0.05, 6, 0],
  ];
  const WH_ROOM = [
    ['LATER', 70, 300, 48, 11.0, -0.1, 11], ['TALK ABOUT WHAT', 540, 1000, 38, 11.8, 0.06, 12], ['YOU MESSED UP', 60, 1090, 42, 12.6, -0.05, 13],
    ['THEY KNOW', 600, 50, 46, 13.3, 0.1, 14], ['IT IS BAD', 90, 660, 52, 14.2, -0.12, 15], ['LATER', 760, 1220, 62, 15.0, 0.05, 16],
    ['LATER', 40, 1250, 70, 16.0, -0.06, 17], ['WHAT DID I DO', 30, 470, 40, 16.8, 0.04, 18], ['TOO LATE', 640, 780, 60, 17.6, -0.08, 19],
  ];
  function inkFace(t, k) {
    const hx = IX(PX), hy = IY(STATE.ps.hy), z = CZ * KS / 3;
    if (k === 0) return false;
    if (k === 2) {
      const w = ph(IT, 7.2, 10.6), p = pulseAt(t);
      edgeCrawl(0.15 + 0.4 * w, 3100, p);
      windowFaces(IT, 0.3 * sstep(9.3, 10.6, IT));   // something rises in the window behind
      smudge(hx, hy - 75 * z, 150 * z * (0.6 + w), 0.45 * w, 0, SMUDGE_P);
      scribble(hx, hy - 75 * z, (100 + 70 * w) * z, (60 + 34 * w) * z, 0.3 + 0.7 * w, 3200, 9 * z, INKC);
      whispers(WH_FACE, IT, 1);
      return true;
    }
    if (k === 4) {   // the breath: the dark holds, then gives a little
      const ex = s5(ph(IT, 20.75, 21.5));
      edgeCrawl(0.9 - 0.25 * ex, 3100, 0);
      tunnel(hx, hy + 20 * z, (520 + 260 * ex) * (1 + 0.02 * Math.sin(IT * 3)), 0.9, 3300);
      scribble(hx, hy - 75 * z, 150 * z, 90 * z, 1 - 0.6 * ex, 3200, 9 * z, INKC);
      whispers(WH_FACE.map((w) => [w[0], w[1], w[2], w[3], 19.0, w[5], w[6], 0]), IT, 1 - ex);
      return true;
    }
    return false;
  }
  function inkFaceFront(t, k) {
    const hx = IX(PX + STATE.ps.hx), hy = IY(STATE.ps.hy), z = CZ * KS / 3;
    if (k === 2) {
      const w = ph(IT, 7.2, 10.6);
      // anxious hatching on the shadow side of the face and dark rings under the eyes
      hatch(hx + 22 * z * 3, hy + 10 * z * 3, 18 * z, 30 * z, 1.0, fl(10 + 30 * w), 18 * z, 1.6 * z, 'rgba(13,10,14,0.55)', 3400, w);
      for (const s of [-1, 1]) brush([[hx + (s * 6.2 - 2.6) * CZ * KS, hy + 4.8 * CZ * KS], [hx + s * 6.2 * CZ * KS, hy + 5.6 * CZ * KS], [hx + (s * 6.2 + 2.6) * CZ * KS, hy + 4.6 * CZ * KS]], 3 * z, { seed: 3410 + s, c: 'rgba(78,45,95,0.35)' });
      // a sweat drop slides down the temple
      if (IT > 8.9) {
        const u = ph(IT, 8.9, 10.4), dx = hx - 13.5 * CZ * KS, dy = hy + (-4 + 10 * u) * CZ * KS, r = 1.6 * CZ * KS;
        IG.fillStyle = 'rgba(205,230,239,0.85)'; IG.beginPath(); IG.moveTo(dx, dy - r * 2.2); IG.quadraticCurveTo(dx + r, dy, dx, dy + r); IG.quadraticCurveTo(dx - r, dy, dx, dy - r * 2.2); IG.fill();
        brush([[dx, dy - r * 2.2], [dx + r, dy], [dx, dy + r], [dx - r, dy], [dx, dy - r * 2.2]], 3 * z, { seed: 3420, c: INKC, t0: 0.02, t1: 0.02 });
      }
    }
  }
  function inkPOV(t, k) {
    if (k === 1) {
      const a = sstep(5.0, 6.8, IT);
      if (a > 0) edgeCrawl(0.12 + 0.45 * a, 4100, 0);
      // the dots vanish and leave ink; they grow into eyes after the second silence
      if (IT > 5.2) hatch(IX(0) - 80, IY(0) + 200, 40, 60, 0.9, fl(30 * a), 30, 2, INKC, 4200, a);
      return true;
    }
    if (k === 5) {
      edgeCrawl(0.95, 4100, 0);
      for (let q = 0; q < 6; q++) smudge(ih(q, 1, 4300) * OW, ih(q, 2, 4300) * OH, 300, 0.7, q);
      whispers([['LATER', 40, 140, 40, 21.6, -0.1, 41], ['WHAT', 760, 260, 40, 21.6, 0.1, 42], ['BAD', 60, 1080, 44, 21.6, 0.05, 43], ['TALK', 820, 1180, 40, 21.6, -0.06, 44]], IT, 1);
      return true;
    }
    return false;
  }
  function inkSpiral(tv, tilt) {
    // tv: the story time to draw the spiral at (the peak is held through the burn in the last shot)
    const p = pulseAt(tv), hx = IX(PX), hy = IY(STATE.ps.hy);
    const g = IG;
    g.save();
    g.translate(hx, hy); g.rotate(tilt); g.translate(-hx, -hy);
    const z = CZ * KS / 3;
    walls(sstep(14.4, 18.8, tv), hx, hy);
    windowFaces(tv, sstep(11.2, 14.5, tv));
    clockInk(tv, sstep(10.7, 11.6, tv));
    lampCreature(tv, sstep(12.6, 15.8, tv));
    plantHands(tv, sstep(13.2, 16.4, tv));
    cracks(sstep(12.0, 17.0, tv));
    giantPhone(tv, sstep(15.4, 17.4, tv), sstep(16.6, 17.2, tv));
    smudge(hx, hy - 80 * z, 260 * z, 0.5, 1, SMUDGE_P);
    scribble(hx, hy - 75 * z, 130 * z, 80 * z, 0.6 + 0.4 * sstep(10.6, 15, tv), 3200, 8 * z, INKC);
    g.restore();
    edgeCrawl(0.45 + 0.5 * sstep(10.6, 18.5, tv), 5100, p);
    for (let q = 0; q < 8; q++) smudge(ih(q, 1, 5300) * OW, ih(q, 2, 5300) * OH, 260 + 120 * ih(q, 3, 5300), 0.55 * sstep(12 + q * 0.6, 15 + q * 0.6, tv), q + 2);
    whispers(WH_ROOM, tv, 1);
    PHONE_EYES = null;
    const ta = sstep(16.8, 18.6, tv) * 0.92;
    tunnel(hx, hy + 30, lerp(900, 330, sstep(17.2, 19.2, tv)) * (1 - 0.035 * p), ta, 5400);
    if (ta > 0.1) {   // eyes in the dark: the phone's, and the lamp's
      g.save(); g.translate(hx, hy); g.rotate(tilt); g.translate(-hx, -hy);
      giantPhoneEyesOnly(tv);
      phoneEyes(ta);
      g.restore();
    }
    panels(tv, tilt * 0.5);
  }

  function quoteInk(u) {
    const p2 = ph(u, 30.8, 31.25) * (1 - ph(u, 35.35, 35.9));
    if (p2 <= 0) return;
    const L = qLayout();
    IG.globalAlpha = p2;
    smudge(L.inkX + L.inkW / 2, L.inkY + QINK.size * 0.6, L.inkW * 0.42, 0.35, 0, SMUDGE_P);
    inkText('IMAGINATION', L.inkX, L.inkY, QINK.size, ph(u, 30.95, 31.9), { seed: 7001, c: INKC, w: QINK.size * 0.17 });
    IG.globalAlpha = 1;
  }
  function drawInk(g, t) {
    const sh = SHOT;
    // the boil: 10 redraws a second; it slows and settles while Noor breathes
    let fps = 10;
    if (t > 19.7 && t < 21.4) fps = 4;
    BOIL = fl(t * fps + 1e-6) + (fps === 4 ? 5000 : 0);
    IT = fl(t * fps + 1e-6) / fps;
    JIT = (t > 19.7 && t < 21.4) ? 0.5 : 1;
    let any = false, front = false;
    IG.setTransform(1, 0, 0, 1, 0, 0); IG.globalCompositeOperation = 'source-over'; IG.globalAlpha = 1;
    IG.clearRect(0, 0, OW, OH);
    if (sh.k === 'pov') any = inkPOV(t, sh.i);
    else if (sh.k === 'face') { any = inkFace(t, sh.i); front = sh.i === 2 || sh.i === 4; }
    else if (sh.i === 3) {
      const tilt = 0.075 * s5(ph(t, 14.4, 18.8)) * (1 + 0.25 * Math.sin(t * 1.4));
      inkSpiral(IT, tilt); any = true;
    } else if (sh.i === 6 && sh.u < 27.4) {
      inkSpiral(19.0, 0.075); any = true;
    }
    const quote = sh.i === 6 && sh.u > 30.8 && sh.u < 36;
    if (!any && !front && !quote) return;
    if (any) eraseNoor();
    if (front) { if (sh.k === 'face') inkFaceFront(t, sh.i); any = true; }
    if (sh.i === 1 && IT > 5.0) { const g1 = sstep(5.05, 5.4, IT), big = sstep(6.7, 7.15, IT); ghostDots(t, g1 * (IT > 5.75 && IT < 6.7 ? 0.45 : 1), big); }
    if (quote) quoteInk(sh.u);
    // the reveal: the ink burns back from the screen, then from Noor out to the walls
    if (sh.i === 5 && t > 22.6) burn(OW / 2, OH / 2 - 60, (t - 22.6) / 2.2 * 1100 * (1 + 0.15 * (t - 22.6)), 6100);
    if (sh.i === 6 && sh.u < 27.4) burn(IX(PX), IY(-40), lerp(330, 1500, Math.pow(ph(sh.u, 25.6, 27.3), 1.25)), 6200);
    g.drawImage(INK, 0, 0);
  }

  /* ================================================================ present */
  let SMALL = null, SG2 = null, IMG = null, PIX = null, MAIN = null, MG = null;
  const LE = new Uint8Array(new Uint32Array([0x01020304]).buffer)[0] === 4;
  const PACK = new Uint32Array(NPAL);
  window.__cantalkCore = { renderPixels, quantise, buildLUT, W, H, D, PAL, OUT };
  function initCanvases() {
    SMALL = document.createElement('canvas'); SMALL.width = W; SMALL.height = H;
    SG2 = SMALL.getContext('2d'); IMG = SG2.createImageData(W, H); PIX = new Uint32Array(IMG.data.buffer);
    for (let n = 0; n < NPAL; n++) { const p = PAL[n]; PACK[n] = (LE ? ((255 << 24) | (p[2] << 16) | (p[1] << 8) | p[0]) : ((p[0] << 24) | (p[1] << 16) | (p[2] << 8) | 255)) >>> 0; }
  }
  function renderFrame(g, t) {
    renderPixels(t);
    quantise();
    for (let i = 0; i < NP; i++) PIX[i] = PACK[OUT[i]];
    SG2.putImageData(IMG, 0, 0);
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    g.imageSmoothingEnabled = false;
    g.drawImage(SMALL, 0, 0, OW, OH);
    drawInk(g, mod(t, D));
  }

  /* ================================================================ mount */
  const ROOM_BG = '#141013';
  (window.PIECES = window.PIECES || []).push({
    id: 'can-we-talk',
    title: 'Can we talk later?',
    medium: 'Pixel art and boiling ink, drawn in JavaScript · 37 s loop',
    note: 'There are more things likely to frighten us than there are to crush us · tap to pause',
    about: 'An evening on the sofa with a mug, until the phone lights up: “hey, can we talk later?” The typing dots come and go, and the fear arrives as another medium: rough, boiling ink that crawls in over the warm pixel room, turns the lamp, the plant, the clock and the window into threats, cracks the floor and lifts the phone into a looming monolith. A breath, a reply, and the answer is a surprise party and a cake. The ink burns back; the room underneath was never touched.',
    tone: 'dark',
    room: ROOM_BG,
    mount(el, api) {
      const EXPORT = /[?&]export\b/.test(location.search);
      let alive = true, raf = 0, playing = !EXPORT, clock = 0, last = 0, built = false;
      el.style.background = ROOM_BG;
      const cv = document.createElement('canvas');
      cv.width = OW; cv.height = OH;
      cv.style.cssText = 'position:absolute;display:block;cursor:pointer;';
      el.appendChild(cv);
      const g = cv.getContext('2d', { alpha: false });
      MAIN = cv; MG = g;
      const pauseMark = document.createElement('div');
      pauseMark.style.cssText = 'position:absolute;width:34px;height:34px;opacity:0;transition:opacity .4s;pointer-events:none;';
      pauseMark.innerHTML = '<svg viewBox="0 0 34 34" width="34" height="34"><rect x="10" y="9" width="5" height="16" fill="rgba(244,232,206,.85)"/><rect x="19" y="9" width="5" height="16" fill="rgba(244,232,206,.85)"/></svg>';
      el.appendChild(pauseMark);
      function fit() {
        let left = 0, top = 0, cssW, cssH;
        if (EXPORT) { cssW = OW; cssH = OH; cv.style.position = 'fixed'; }
        else {
          const w = el.clientWidth || window.innerWidth, h = el.clientHeight || window.innerHeight;
          const f = Math.min(w / OW, h / OH);
          cssW = OW * f; cssH = OH * f;
          left = Math.round((w - cssW) / 2); top = Math.round((h - cssH) / 2);
        }
        cv.style.left = left + 'px'; cv.style.top = top + 'px'; cv.style.width = cssW + 'px'; cv.style.height = cssH + 'px';
        pauseMark.style.left = (left + cssW - 48) + 'px'; pauseMark.style.top = (top + 14) + 'px';
      }
      fit();
      buildLUT();
      initCanvases();
      initInk();
      built = true;
      renderFrame(g, 0);
      const hook = {
        duration: D,
        isReady: () => built && (!EXPORT || (() => { const st = el.parentElement; return !st || parseFloat(getComputedStyle(st).opacity) >= 0.999; })()),
        lastMs: 0,
        renderAt(t) {
          return new Promise((res) => {
            playing = false; clock = t;
            const t0 = performance.now(); renderFrame(g, t); hook.lastMs = performance.now() - t0;
            requestAnimationFrame(() => res());
          });
        },
        pixels() {   // the composited 1080 × 1350 frame as base64 RGB
          const d = g.getImageData(0, 0, OW, OH).data, buf = new Uint8Array(OW * OH * 3);
          for (let i = 0, j = 0; i < d.length; i += 4, j += 3) { buf[j] = d[i]; buf[j + 1] = d[i + 1]; buf[j + 2] = d[i + 2]; }
          let s = '';
          for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
          return btoa(s);
        },
        state: () => ({ shot: SHOT && SHOT.k, i: SHOT && SHOT.i }),
      };
      window.__cantalk = hook;
      if (EXPORT) document.documentElement.dataset.ready = 'can-we-talk';
      api.ready();
      function frame(now) {
        if (!alive || !api.isCurrent()) return;
        raf = requestAnimationFrame(frame);
        const dt = last ? Math.min(0.1, (now - last) / 1000) : 0; last = now;
        if (!playing) return;
        clock = (clock + dt) % D;
        const t0 = performance.now();
        renderFrame(g, clock);
        hook.lastMs = performance.now() - t0;
      }
      if (!EXPORT) raf = requestAnimationFrame(frame);
      const onDown = () => { if (EXPORT) return; playing = !playing; last = 0; pauseMark.style.opacity = playing ? '0' : '1'; };
      cv.addEventListener('pointerdown', onDown);
      let rt = 0;
      const ro = new ResizeObserver(() => { clearTimeout(rt); rt = setTimeout(() => { if (!alive) return; fit(); }, 120); });
      ro.observe(el);
      return {
        destroy() {
          alive = false; cancelAnimationFrame(raf); ro.disconnect(); clearTimeout(rt);
          cv.removeEventListener('pointerdown', onDown);
          if (window.__cantalk === hook) delete window.__cantalk;
        },
      };
    },
  });
})();
