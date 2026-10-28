/* UNFORGOTTEN — Episode 1, "The Courier" (first half).
 *
 * An original pixel-art series, drawn entirely in JavaScript. Every frame is a pure function of t, rendered
 * into a 480 × 270 indexed buffer and shown at 4×. The sets are real 3D (a pinhole camera, flat-shaded boxes
 * and planes, depth fog, ink outlines on every edge) but they stay pixel art: one fixed 128-colour palette of
 * sixteen 8-step light ramps, ordered dithering, and nearest-neighbour everywhere. Characters are chibi sprites
 * built from parts each frame, so they can act: lean, run, swing, blink, and move their mouths to the dialogue.
 */
(function () {
  'use strict';

  /* ================================================================ constants & helpers */
  const W = 480, H = 270, NP = W * H, D = 300, FPS = 30;
  const TAU = Math.PI * 2, PI = Math.PI, fl = Math.floor;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, u) => a + (b - a) * u;
  const sstep = (a, b, x) => { const u = clamp((x - a) / (b - a), 0, 1); return u * u * (3 - 2 * u); };
  const lin = (a, b, x) => clamp((x - a) / (b - a), 0, 1);
  const frac = (x) => x - Math.floor(x);
  const eoc = (u) => 1 - Math.pow(1 - clamp(u, 0, 1), 3);
  const eic = (u) => Math.pow(clamp(u, 0, 1), 3);
  const eio = (u) => { u = clamp(u, 0, 1); return u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2; };
  const eob = (u) => { u = clamp(u, 0, 1); const c1 = 1.9, c3 = c1 + 1; return 1 + c3 * Math.pow(u - 1, 3) + c1 * Math.pow(u - 1, 2); };
  function ih(a, b, c) {
    let h = Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x165667b1) ^ Math.imul(((c | 0) + 7919 * 23) | 0, 0x85ebca77);
    h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d); h = Math.imul(h ^ (h >>> 12), 0x297a2d39); h ^= h >>> 15;
    return (h >>> 0) / 4294967296;
  }
  function vn(x, y, c, s) {
    const X = x / c, Y = y / c, xi = Math.floor(X), yi = Math.floor(Y), u = X - xi, v = Y - yi, su = u * u * (3 - 2 * u), sv = v * v * (3 - 2 * v);
    const a = ih(xi, yi, s), b = ih(xi + 1, yi, s), cc = ih(xi, yi + 1, s), d = ih(xi + 1, yi + 1, s);
    return a + (b - a) * su + (cc - a) * sv + (a - b - cc + d) * su * sv;
  }
  function fbm(x, y, c, oct, s) { let v = 0, a = 1, n = 0; for (let k = 0; k < oct; k++) { v += a * vn(x, y, c, s + k * 31); n += a; a *= 0.5; c *= 0.5; } return v / n; }
  const B8 = (() => { const m = [[0, 32, 8, 40, 2, 34, 10, 42], [48, 16, 56, 24, 50, 18, 58, 26], [12, 44, 4, 36, 14, 46, 6, 38], [60, 28, 52, 20, 62, 30, 54, 22], [3, 35, 11, 43, 1, 33, 9, 41], [51, 19, 59, 27, 49, 17, 57, 25], [15, 47, 7, 39, 13, 45, 5, 37], [63, 31, 55, 23, 61, 29, 53, 21]]; const a = new Float32Array(64); for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) a[y * 8 + x] = (m[y][x] + 0.5) / 64; return a; })();
  const bay = (x, y) => B8[((y & 7) << 3) | (x & 7)];

  /* ================================================================ palette: 16 ramps × 8 shades */
  const RAMPS = [
    ['#07070f', '#0d0f1f', '#151a33', '#1f2849', '#2d3a63', '#44557f', '#6b7ea3', '#a3b4cc'], // 0 night
    ['#120a1c', '#1f1230', '#2f1b48', '#43275f', '#5c3677', '#7a4b8c', '#9e6ea6', '#c9a3c6'], // 1 dusk violet
    ['#1a0806', '#3a0f08', '#66180b', '#962a0e', '#c94a15', '#ee7a22', '#ffb347', '#ffe4a0'], // 2 ember
    ['#2a1c06', '#4d340b', '#7a5413', '#a9781d', '#d39f2c', '#efc24a', '#fbe08a', '#fff6d6'], // 3 gold
    ['#111318', '#1d2028', '#2c303b', '#3e4350', '#565c6b', '#767d8c', '#9ea5b2', '#cdd2da'], // 4 stone
    ['#160c07', '#2a170c', '#432612', '#5e381a', '#7c4f26', '#9c6a36', '#bf8c52', '#e0b781'], // 5 wood
    ['#04121a', '#08222e', '#0d3442', '#134b59', '#1c6772', '#2b8a8c', '#4fb2aa', '#9fe0d2'], // 6 sea
    ['#0a1208', '#13210f', '#1d3317', '#284620', '#36602a', '#4c7d38', '#6d9e4b', '#a5c878'], // 7 moss
    ['#2a160f', '#4b2a1d', '#6e402b', '#94593b', '#b9774f', '#d39a72', '#ebbf9a', '#f7dfc6'], // 8 skin
    ['#0b0a0f', '#15131c', '#201d29', '#2c2836', '#3a3546', '#4d4759', '#6a6378', '#948ca1'], // 9 charcoal
    ['#0a0c24', '#121640', '#1b2160', '#263080', '#34429e', '#4b5cbd', '#7085d6', '#a9b8ee'], // 10 indigo
    ['#062421', '#0b3b36', '#11564f', '#1a756b', '#279a8b', '#3fbfaa', '#77e0cb', '#c4fbef'], // 11 turquoise
    ['#241d14', '#3f3424', '#5f5038', '#827050', '#a7936d', '#c9b78f', '#e6d8b4', '#fbf5e2'], // 12 linen
    ['#1a0509', '#33080f', '#570c18', '#811325', '#ad1d33', '#d8314a', '#f2647a', '#ffb0bc'], // 13 crimson
    ['#2a1220', '#47202f', '#6b3242', '#934756', '#b8636b', '#d98a86', '#f0b3a6', '#ffe0d2'], // 14 dawn rose
    ['#9aa3b5', '#b4bccb', '#c8cfdb', '#d9dee8', '#e6eaf1', '#f0f2f7', '#f8f9fc', '#ffffff'], // 15 hush white
  ];
  const R = { night: 0, violet: 1, ember: 2, gold: 3, stone: 4, wood: 5, sea: 6, moss: 7, skin: 8, char: 9, indigo: 10, teal: 11, linen: 12, crimson: 13, rose: 14, hush: 15 };
  const C = (ramp, s) => (typeof ramp === 'string' ? R[ramp] : ramp) * 8 + clamp(Math.round(s), 0, 7);
  const BLACK = 0, WHITE = 127, INK = C('night', 0);
  const hexrgb = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const PAL = []; for (const r of RAMPS) for (const h of r) PAL.push(hexrgb(h));
  const NPAL = PAL.length;
  const LUM = PAL.map((p) => p[0] * 0.3 + p[1] * 0.55 + p[2] * 0.15);
  function nearest(r, g, b) {
    let best = 0, bd = 1e9;
    for (let i = 0; i < NPAL; i++) { const p = PAL[i], dr = p[0] - r, dg = p[1] - g, db = p[2] - b, d = dr * dr * 0.3 + dg * dg * 0.59 + db * db * 0.11; if (d < bd) { bd = d; best = i; } }
    return best;
  }
  // tint tables: 8 strengths of blending every colour toward a target (or adding light, if add)
  const TABS = new Map();
  function tab(hex, add) {
    const key = hex + (add ? '+' : '');
    if (TABS.has(key)) return TABS.get(key);
    const c = hexrgb(hex), T = new Uint8Array(8 * NPAL);
    for (let l = 0; l < 8; l++) { const a = (l + 1) / 8; for (let i = 0; i < NPAL; i++) { const p = PAL[i]; T[l * NPAL + i] = add ? nearest(Math.min(255, p[0] + c[0] * a), Math.min(255, p[1] + c[1] * a), Math.min(255, p[2] + c[2] * a)) : nearest(lerp(p[0], c[0], a), lerp(p[1], c[1], a), lerp(p[2], c[2], a)); } }
    TABS.set(key, T); return T;
  }
  const T_DARK = tab('#04040a'), T_WH = tab('#ffffff'), T_EMBER = tab('#ff8a2a', true), T_GOLD = tab('#ffd27a', true), T_HUSH = tab('#eef1f8'),
    T_TEAL = tab('#5fe6d0', true), T_VIO = tab('#a070ff', true), T_RED = tab('#ff3050', true), T_COLD = tab('#2a3a70'), T_SEPIA = tab('#3a2a1a'), T_SHADE = tab('#2b2550');

  /* ================================================================ buffers & primitives */
  const BUF = new Uint8Array(NP), ZB = new Float32Array(NP), IDB = new Uint16Array(NP), EMIS = new Uint8Array(NP);
  function P(x, y, c) { x = fl(x); y = fl(y); if (x >= 0 && x < W && y >= 0 && y < H) BUF[y * W + x] = c; }
  function PZ(x, y, c, z) { x = fl(x); y = fl(y); if (x >= 0 && x < W && y >= 0 && y < H) { const i = y * W + x; if (z < ZB[i]) { BUF[i] = c; ZB[i] = z; } } }
  function rectF(x, y, w, h, c) { const x0 = Math.max(0, fl(x)), y0 = Math.max(0, fl(y)), x1 = Math.min(W, fl(x + w)), y1 = Math.min(H, fl(y + h)); for (let yy = y0; yy < y1; yy++) BUF.fill(c, yy * W + x0, yy * W + Math.max(x0, x1)); }
  function lineF(x0, y0, x1, y1, fn) { const n = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)))); for (let k = 0; k <= n; k++) { const u = k / n; fn(fl(x0 + (x1 - x0) * u), fl(y0 + (y1 - y0) * u), u); } }
  const lineP = (x0, y0, x1, y1, c) => lineF(x0, y0, x1, y1, (x, y) => P(x, y, c));
  function thick(x0, y0, x1, y1, w, c) { const r = w / 2; lineF(x0, y0, x1, y1, (x, y) => { for (let j = -r; j < r; j++) for (let i = -r; i < r; i++) P(x + i, y + j, c); }); }
  function discF(cx, cy, r, c) { for (let y = fl(cy - r); y <= cy + r; y++) for (let x = fl(cx - r); x <= cx + r; x++) if ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= r * r) P(x, y, c); }
  function ring(cx, cy, r, ry, c, keep) { if (ry === undefined) ry = r; for (let a = 0; a < TAU; a += 0.6 / Math.max(4, r)) { const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * ry; if (!keep || keep(x, y)) P(x, y, c); } }
  function tintI(i, x, y, T, a) { if (a <= 0) return; const l = Math.min(7, fl(a * 8 + bay(x, y) - 0.5)); if (l >= 0) BUF[i] = T[l * NPAL + BUF[i]]; }
  function tintP(x, y, T, a) { x = fl(x); y = fl(y); if (x >= 0 && x < W && y >= 0 && y < H) tintI(y * W + x, x, y, T, a); }
  function tintAll(T, a) { if (a <= 0.004) return; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) tintI(y * W + x, x, y, T, a); }
  function glow(cx, cy, r, T, amax, pw) {
    pw = pw || 2; const x0 = Math.max(0, fl(cx - r)), x1 = Math.min(W - 1, Math.ceil(cx + r)), y0 = Math.max(0, fl(cy - r)), y1 = Math.min(H - 1, Math.ceil(cy + r));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy) / r; if (d < 1) tintI(y * W + x, x, y, T, amax * Math.pow(1 - d, pw)); }
  }
  function sparkle(x, y, L, c0, c1) { L = fl(L); P(x, y, c0); for (let k = 1; k <= L; k++) { const c = k < L * 0.5 ? c0 : c1; P(x + k, y, c); P(x - k, y, c); P(x, y + k, c); P(x, y - k, c); } }
  function letterbox(h) { rectF(0, 0, W, h, BLACK); rectF(0, H - h, W, h, BLACK); }

  /* ================================================================ type: a 5 × 7 pixel font */
  const FONT = (() => {
    const g = {
      A: '.###.|#...#|#...#|#####|#...#|#...#|#...#', B: '####.|#...#|#...#|####.|#...#|#...#|####.', C: '.###.|#...#|#....|#....|#....|#...#|.###.', D: '####.|#...#|#...#|#...#|#...#|#...#|####.',
      E: '#####|#....|#....|####.|#....|#....|#####', F: '#####|#....|#....|####.|#....|#....|#....', G: '.###.|#...#|#....|#.###|#...#|#...#|.###.', H: '#...#|#...#|#...#|#####|#...#|#...#|#...#',
      I: '###|.#.|.#.|.#.|.#.|.#.|###', J: '..###|...#.|...#.|...#.|...#.|#..#.|.##..', K: '#...#|#..#.|#.#..|##...|#.#..|#..#.|#...#', L: '#....|#....|#....|#....|#....|#....|#####',
      M: '#...#|##.##|#.#.#|#.#.#|#...#|#...#|#...#', N: '#...#|##..#|#.#.#|#..##|#...#|#...#|#...#', O: '.###.|#...#|#...#|#...#|#...#|#...#|.###.', P: '####.|#...#|#...#|####.|#....|#....|#....',
      Q: '.###.|#...#|#...#|#...#|#.#.#|#..#.|.##.#', R: '####.|#...#|#...#|####.|#.#..|#..#.|#...#', S: '.####|#....|#....|.###.|....#|....#|####.', T: '#####|..#..|..#..|..#..|..#..|..#..|..#..',
      U: '#...#|#...#|#...#|#...#|#...#|#...#|.###.', V: '#...#|#...#|#...#|#...#|#...#|.#.#.|..#..', W: '#...#|#...#|#...#|#.#.#|#.#.#|##.##|#...#', X: '#...#|#...#|.#.#.|..#..|.#.#.|#...#|#...#',
      Y: '#...#|#...#|.#.#.|..#..|..#..|..#..|..#..', Z: '#####|....#|...#.|..#..|.#...|#....|#####',
      0: '.###.|#..##|#.#.#|#.#.#|##..#|#...#|.###.', 1: '.#.|##.|.#.|.#.|.#.|.#.|###', 2: '.###.|#...#|....#|...#.|..#..|.#...|#####', 3: '####.|....#|....#|.###.|....#|....#|####.',
      4: '#..#.|#..#.|#..#.|#####|...#.|...#.|...#.', 5: '#####|#....|####.|....#|....#|#...#|.###.', 6: '.###.|#....|#....|####.|#...#|#...#|.###.', 7: '#####|....#|...#.|..#..|..#..|..#..|..#..',
      8: '.###.|#...#|#...#|.###.|#...#|#...#|.###.', 9: '.###.|#...#|#...#|.####|....#|....#|.###.',
      '.': '..|..|..|..|..|##|##', ',': '..|..|..|..|..|.#|#.', '!': '#|#|#|#|#|.|#', '?': '.###.|#...#|....#|...#.|..#..|.....|..#..', "'": '#|#|.|.|.|.|.',
      '-': '...|...|...|###|...|...|...', ':': '.|#|.|.|.|#|.', '·': '.|.|.|#|.|.|.', ' ': '...|...|...|...|...|...|...', '—': '.....|.....|.....|#####|.....|.....|.....',
    };
    const o = {}; for (const k in g) o[k] = g[k].split('|'); return o;
  })();
  const glyphW = (ch) => (FONT[ch] || FONT[' '])[0].length;
  function textWidth(s, sc) { let w = 0; for (const ch of s) w += (glyphW(ch) + 1) * sc; return w - sc; }
  // draw text; c may be a function (i, j, k) of glyph pixel and glyph index; oc outline colour; nvis typewriter count
  function text(s, x, y, c, sc, oc, nvis, shake) {
    sc = sc || 1; let cx = x, k = 0;
    for (const ch of s.toUpperCase()) {
      if (nvis !== undefined && k >= nvis) break;
      const g = FONT[ch] || FONT[' '], gw = g[0].length;
      const jx = shake ? Math.round((ih(k, fl(shake * 30), 77) - 0.5) * 2) : 0, jy = shake ? Math.round((ih(k, fl(shake * 30), 78) - 0.5) * 2) : 0;
      if (oc !== undefined) { const ow = sc > 2 ? Math.max(1, Math.round(sc * 0.5)) : 1; for (let j = 0; j < 7; j++) for (let i = 0; i < gw; i++) if (g[j][i] === '#') rectF(cx + i * sc - ow + jx, y + j * sc - ow + jy, sc + ow * 2, sc + ow * 2, oc); }
      for (let j = 0; j < 7; j++) for (let i = 0; i < gw; i++) if (g[j][i] === '#') rectF(cx + i * sc + jx, y + j * sc + jy, sc, sc, typeof c === 'function' ? c(i, j, k) : c);
      cx += (gw + 1) * sc; k++;
    }
  }

