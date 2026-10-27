/* Fable Quest — a 36-second pixel-art short.
 *
 * A small coral hero pulls a sword from a stone in an enchanted forest at twilight, beats a water slime, a
 * thorn sprite and a storm wisp, takes an element orb from each, then fells an ancient forest guardian and
 * braids the four orbs into a column of light that unfolds into a storybook cathedral of crystal geometry.
 *
 * Drawn into a 480 × 270 indexed buffer (64 colours, Bayer-dithered tints) and shown at exactly 4×.
 * Nothing is simulated forward: every frame is a pure function of t, built from keyframes and seeded hashes.
 */
(function () {
  'use strict';

  /* ================================================================ constants & helpers */
  const W = 480, H = 270, NP = W * H, D = 36;
  const TAU = Math.PI * 2, PI = Math.PI, fl = Math.floor;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, u) => a + (b - a) * u;
  const sstep = (a, b, x) => { const u = clamp((x - a) / (b - a), 0, 1); return u * u * (3 - 2 * u); };
  const lin = (a, b, x) => clamp((x - a) / (b - a), 0, 1);
  const mod = (a, m) => ((a % m) + m) % m;
  const frac = (x) => x - Math.floor(x);
  const eoc = (u) => 1 - Math.pow(1 - clamp(u, 0, 1), 3);          // ease out cubic
  const eic = (u) => Math.pow(clamp(u, 0, 1), 3);
  const eio = (u) => { u = clamp(u, 0, 1); return u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2; };
  const eob = (u) => { u = clamp(u, 0, 1); const c1 = 1.9, c3 = c1 + 1; return 1 + c3 * Math.pow(u - 1, 3) + c1 * Math.pow(u - 1, 2); }; // ease out back
  const SEED = 11;
  function ih(a, b, c) {
    let h = Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x165667b1) ^ Math.imul(((c | 0) + SEED * 7919) | 0, 0x85ebca77);
    h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
    h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
    h ^= h >>> 15;
    return (h >>> 0) / 4294967296;
  }
  function vn(x, y, c, s) {
    const gx = x / c, gy = y / c, i = fl(gx), j = fl(gy), fx = gx - i, fy = gy - j;
    const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
    return lerp(lerp(ih(i, j, s), ih(i + 1, j, s), ux), lerp(ih(i, j + 1, s), ih(i + 1, j + 1, s), ux), uy);
  }
  function fbm(x, y, c, oct, s) {
    let v = 0, a = 1, n = 0;
    for (let k = 0; k < oct; k++) { v += a * vn(x, y, c, s + k * 31); n += a; a *= 0.5; c *= 0.5; }
    return v / n;
  }
  function vn1(x, s) { const i = fl(x), f = x - i, u = f * f * (3 - 2 * f); return lerp(ih(i, 7, s), ih(i + 1, 7, s), u); }
  const B8 = [0, 32, 8, 40, 2, 34, 10, 42, 48, 16, 56, 24, 50, 18, 58, 26, 12, 44, 4, 36, 14, 46, 6, 38, 60, 28, 52, 20, 62, 30, 54, 22,
    3, 35, 11, 43, 1, 33, 9, 41, 51, 19, 59, 27, 49, 17, 57, 25, 15, 47, 7, 39, 13, 45, 5, 37, 63, 31, 55, 23, 61, 29, 53, 21].map((v) => (v + 0.5) / 64);
  const bay = (x, y) => B8[((y & 7) << 3) | (x & 7)];

  /* ================================================================ palette (64) */
  const PAL_HEX = [
    '04050b', '080b17', '0d1222', '121a2e', '18233b', '1f2e4a', '283b5a', '33496b', '41597c', '546e90', // 0-9 twilight night
    '0a1a1e', '0f2629', '15342f', '1d4538', '27583f', '347049', '4a8c55', '6cad66',                     // 10-17 teal moss
    '150f14', '20171c', '2d2125', '3e2e2e', '54403a',                                                   // 18-22 bark
    '6c8fa6', '93b5c4', 'c2dcdf', 'eaf5f1', 'ffffff',                                                   // 23-27 mist and light
    'd97757', 'a8553b', 'f2a585',                                                                       // 28-30 coral
    '1c1b1a', '2b2a28',                                                                                 // 31-32 charcoal
    '0f3c72', '1f66bd', '3f98f2', '95d4ff',                                                             // 33-36 water
    '1e561f', '3a952c', '7bd23e', 'c8f27c',                                                             // 37-40 leaf
    '6e520f', 'cf9c17', 'ffd84a', 'fff4b0',                                                             // 41-44 lightning
    '260d42', '4a1d80', '7c3ccc', 'ad78ff', 'e0c8ff',                                                   // 45-49 starlight violet
    '27b8b0', '8cf2e2',                                                                                 // 50-51 glow cyan
    '6e2763', 'cc56a0', 'ffaedc',                                                                       // 52-54 glow pink
    '6a7886', 'b9c7d3', 'c48b2c',                                                                       // 55-57 steel, gold
    '363b42', '50585e', '737c7f', '0a0a0a', '949e98', '120c24',                                         // 58-63 stone, ink, pale stone, night violet
  ];
  const PAL = PAL_HEX.map((h) => [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]);
  const NPAL = PAL.length;
  const C = { CORAL: 28, CORALD: 29, CORALL: 30, CHAR: 31, CHAR2: 32, WHITE: 27, INK: 61, CREAM: 26 };
  const EL = [ // element ramps: dark, mid, bright, pale
    [33, 34, 35, 36], [37, 38, 39, 40], [41, 42, 43, 44], [46, 47, 48, 49],
  ];

  function nearest(r, g, b, cand) {
    let best = 0, bd = 1e18;
    for (let k = 0; k < cand.length; k++) {
      const p = PAL[cand[k]], rm = (p[0] + r) / 2;
      const dr = p[0] - r, dg = p[1] - g, db = p[2] - b;
      const d = (2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db;
      if (d < bd) { bd = d; best = cand[k]; }
    }
    return best;
  }
  const ALL = PAL.map((_, i) => i);
  const ENV = ALL.filter((i) => i < 28 || i > 32);
  const hexRGB = (h) => [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  function mkTab(hex, add, cand) {
    const T = [], q = hexRGB(hex);
    for (let lv = 0; lv <= 8; lv++) {
      const a = lv / 8, tab = new Uint8Array(256);
      for (let i = 0; i < 256; i++) tab[i] = i;
      for (let i = 0; i < NPAL; i++) {
        const p = PAL[i];
        if (lv === 0) continue;
        let r, g, b;
        if (add) { r = Math.min(255, p[0] + q[0] * a); g = Math.min(255, p[1] + q[1] * a); b = Math.min(255, p[2] + q[2] * a); }
        else { r = lerp(p[0], q[0], a); g = lerp(p[1], q[1], a); b = lerp(p[2], q[2], a); }
        tab[i] = nearest(r, g, b, cand || ENV);
      }
      T.push(tab);
    }
    return T;
  }
  const T_FOG = mkTab('3a5574', false), T_MIST = mkTab('7f9fb4', false), T_DARK = mkTab('04050b', false);
  const LIGHTC = ENV.filter((i) => [55, 56, 58, 59, 60, 62, 18, 19, 20, 21, 22].indexOf(i) < 0 && (i < 33 || i > 54));
  const T_WHITE = mkTab('ffffff', false, LIGHTC), T_NIGHT = mkTab('0d0a1c', false, ALL);
  const T_RAY = mkTab('6f9a96', true), T_CY = mkTab('2fc8bc', true), T_PK = mkTab('c8509c', true);
  const T_BL = mkTab('3f8ef0', true), T_GR = mkTab('5cc036', true), T_YE = mkTab('ffcf40', true), T_VI = mkTab('8a4cf0', true);
  const T_WH = mkTab('ffffff', true, LIGHTC), T_CO = mkTab('d97757', true, ALL), T_FF = mkTab('b8e86c', true);
  const EL_T = [T_BL, T_GR, T_YE, T_VI];

  /* ================================================================ buffer & primitives */
  const BUF = new Uint8Array(NP);
  let PEN = -1; // when >= 0, every primitive paints this colour (used for outline passes)
  function P(x, y, c) { x = fl(x); y = fl(y); if (x >= 0 && x < W && y >= 0 && y < H) BUF[y * W + x] = PEN >= 0 ? PEN : c; }
  function rectF(x, y, w, h, c) {
    x = fl(x); y = fl(y);
    const x0 = Math.max(0, x), y0 = Math.max(0, y), x1 = Math.min(W, x + w), y1 = Math.min(H, y + h);
    if (PEN >= 0) c = PEN;
    for (let yy = y0; yy < y1; yy++) { const o = yy * W; for (let xx = x0; xx < x1; xx++) BUF[o + xx] = c; }
  }
  function lineP(x0, y0, x1, y1, c) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let e = dx + dy, n = 0;
    for (;;) {
      P(x0, y0, c);
      if ((x0 === x1 && y0 === y1) || ++n > 2000) break;
      const e2 = 2 * e;
      if (e2 >= dy) { e += dy; x0 += sx; }
      if (e2 <= dx) { e += dx; y0 += sy; }
    }
  }
  function lineF(x0, y0, x1, y1, fn) { // calls fn(x, y, u) along a line
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    const L = Math.max(dx, -dy) || 1;
    let e = dx + dy, n = 0;
    for (;;) {
      fn(x0, y0, n / L);
      if ((x0 === x1 && y0 === y1) || ++n > 2000) break;
      const e2 = 2 * e;
      if (e2 >= dy) { e += dy; x0 += sx; }
      if (e2 <= dx) { e += dx; y0 += sy; }
    }
  }
  function discF(cx, cy, r, c) {
    if (PEN >= 0) c = PEN;
    const r2 = r * r, y0 = Math.max(0, fl(cy - r)), y1 = Math.min(H - 1, Math.ceil(cy + r)), x0 = Math.max(0, fl(cx - r)), x1 = Math.min(W - 1, Math.ceil(cx + r));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const dx = x + 0.5 - cx, dy = y + 0.5 - cy; if (dx * dx + dy * dy <= r2) BUF[y * W + x] = c; }
  }
  let HMASKREF = null;
  function tintI(i, x, y, T, a) {
    if (HMASKREF !== null && HMASKREF[i]) return;
    let lv = (a * 8 + 0.5 + (bay(x, y) - 0.5) * 0.6) | 0;
    if (lv <= 0) return;
    if (lv > 8) lv = 8;
    BUF[i] = T[lv][BUF[i]];
  }
  function tintP(x, y, T, a) { x = fl(x); y = fl(y); if (x >= 0 && x < W && y >= 0 && y < H) tintI(y * W + x, x, y, T, a); }
  function glow(cx, cy, r, T, amax, pw) {
    if (amax <= 0.004 || r <= 0 || PEN >= 0) return;
    pw = pw || 2;
    const y0 = Math.max(0, fl(cy - r)), y1 = Math.min(H - 1, Math.ceil(cy + r)), x0 = Math.max(0, fl(cx - r)), x1 = Math.min(W - 1, Math.ceil(cx + r));
    const ir = 1 / r;
    for (let y = y0; y <= y1; y++) {
      const dy = (y + 0.5 - cy) * ir, o = y * W;
      for (let x = x0; x <= x1; x++) {
        const dx = (x + 0.5 - cx) * ir, d = dx * dx + dy * dy;
        if (d >= 1) continue;
        const f = 1 - Math.sqrt(d);
        tintI(o + x, x, y, T, amax * (pw === 2 ? f * f : f));
      }
    }
  }
  function tintRect(x0, y0, x1, y1, T, a) {
    x0 = Math.max(0, fl(x0)); y0 = Math.max(0, fl(y0)); x1 = Math.min(W - 1, fl(x1)); y1 = Math.min(H - 1, fl(y1));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) tintI(y * W + x, x, y, T, a);
  }
  // a 4-point sparkle with rays of length L (screen px)
  function sparkle(x, y, L, c0, c1) {
    x = Math.round(x); y = Math.round(y);
    if (L < 0.5) return;
    P(x, y, c0);
    const l = Math.round(L);
    for (let k = 1; k <= l; k++) {
      const c = k <= l * 0.45 ? c0 : c1;
      P(x + k, y, c); P(x - k, y, c); P(x, y + k, c); P(x, y - k, c);
    }
    if (l >= 3) { const d = Math.max(1, Math.round(l * 0.3)); for (let k = 1; k <= d; k++) { P(x + k, y + k, c1); P(x - k, y - k, c1); P(x + k, y - k, c1); P(x - k, y + k, c1); } }
  }

  /* ================================================================ small text font (disclaimer) */
  const MINI = {
    U: ['#.#', '#.#', '#.#', '#.#', '#.#', '###'],
    A: ['.#.', '#.#', '#.#', '###', '#.#', '#.#'],
    n: ['', '', '##.', '#.#', '#.#', '#.#'],
    o: ['', '', '.#.', '#.#', '#.#', '.#.'],
    f: ['.##', '#..', '###', '#..', '#..', '#..'],
    i: ['#', '', '#', '#', '#', '#'],
    c: ['', '', '.##', '#..', '#..', '.##'],
    a: ['', '', '##.', '.##', '#.#', '.##'],
    l: ['#.', '#.', '#.', '#.', '#.', '.#'],
    e: ['', '', '.#.', '###', '#..', '.##'],
    p: ['', '', '##.', '#.#', '#.#', '##.', '#..', '#..'],
    t: ['', '#..', '###', '#..', '#..', '.##'],
    d: ['..#', '..#', '.##', '#.#', '#.#', '.##'],
    w: ['', '', '#...#', '#...#', '#.#.#', '.#.#.'],
    h: ['#..', '#..', '##.', '#.#', '#.#', '#.#'],
    r: ['', '', '#.#', '##.', '#..', '#..'],
    '·': ['', '', '', '#', '', ''],
    ' ': ['..'],
  };
  function miniWidth(s) { let w = 0; for (const ch of s) { const g = MINI[ch]; w += (g ? Math.max(...g.map((r) => r.length), 1) : 2) + 1; } return w - 1; }
  function miniText(s, x, y, c, vis) { // vis(u) in 0..1 per glyph (optional fade)
    let cx = x, k = 0;
    const n = [...s].length;
    for (const ch of s) {
      const g = MINI[ch] || MINI[' '];
      const gw = Math.max(...g.map((r) => r.length), 1);
      const show = vis ? vis(k / n) : 1;
      for (let r = 0; r < g.length; r++) for (let q = 0; q < g[r].length; q++) if (g[r][q] === '#' && (show >= 1 || bay(cx + q, y + r) < show)) P(cx + q, y + r, c);
      cx += gw + 1; k++;
    }
  }

  /* ================================================================ title lettering (FABLE 5.5) */
  // Each glyph is defined by a predicate over its box (pixel centres), then cached as a mask.
  const GH = 19;
  function rr(x, y, x0, y0, x1, y1) { return x >= x0 && x <= x1 && y >= y0 && y <= y1; }
  function seg(x, y, ax, ay, bx, by, w) { // thick segment
    const vx = bx - ax, vy = by - ay, L2 = vx * vx + vy * vy;
    const u = clamp(((x - ax) * vx + (y - ay) * vy) / L2, 0, 1);
    const dx = x - (ax + vx * u), dy = y - (ay + vy * u);
    return dx * dx + dy * dy <= w * w;
  }
  function bowl(x, y, x0, y0, x1, y1, th) { // right-hand D bowl (stem side open)
    const cx = x0, cy = (y0 + y1) / 2, rx = x1 - x0, ry = (y1 - y0) / 2;
    if (x < x0) return false;
    const u = (x - cx) / rx, v = (y - cy) / ry, d = Math.pow(Math.abs(u), 2.6) + Math.pow(Math.abs(v), 2.6);
    const ui = (x - cx) / (rx - th), vi = (y - cy) / (ry - th * 0.72), di = Math.pow(Math.abs(ui), 2.6) + Math.pow(Math.abs(vi), 2.6);
    return d <= 1 && (di > 1 || rx - th <= 0);
  }
  const GLYPHS = {
    F: { w: 13, f: (x, y) => rr(x, y, 1, 0, 4, 18) || rr(x, y, 0, 0, 12, 2) || rr(x, y, 11, 0, 12, 5) || rr(x, y, 1, 8, 9, 10) || rr(x, y, 8, 6, 9, 12) || rr(x, y, 0, 17, 6, 18) },
    A: { w: 15, f: (x, y) => seg(x, y, 2.2, 17.5, 7, 0.8, 1.6) || seg(x, y, 7.3, 0.6, 12.3, 17.5, 2.1) || rr(x, y, 4, 11, 11, 12) || rr(x, y, 0, 17, 4, 18) || rr(x, y, 10, 17, 14, 18) || rr(x, y, 6, 0, 8, 1) },
    B: { w: 14, f: (x, y) => rr(x, y, 1, 0, 4, 18) || rr(x, y, 0, 0, 2, 0) || rr(x, y, 0, 18, 2, 18) || bowl(x, y, 3, 0, 11.5, 9, 3) || bowl(x, y, 3, 8, 13, 18, 3.3) },
    L: { w: 13, f: (x, y) => rr(x, y, 1, 0, 4, 18) || rr(x, y, 0, 0, 6, 1) || rr(x, y, 1, 16, 12, 18) || rr(x, y, 11, 13, 12, 18) },
    E: { w: 13, f: (x, y) => rr(x, y, 1, 0, 4, 18) || rr(x, y, 0, 0, 12, 2) || rr(x, y, 11, 0, 12, 5) || rr(x, y, 1, 8, 9, 10) || rr(x, y, 8, 6, 9, 12) || rr(x, y, 0, 16, 12, 18) || rr(x, y, 11, 13, 12, 18) },
    5: { w: 13, f: (x, y) => rr(x, y, 2, 0, 12, 2) || rr(x, y, 2, 0, 5, 9) || bowl(x, y, 5, 6.5, 12.5, 18, 3.2) || rr(x, y, 2, 6, 7, 9) || rr(x, y, 1, 16, 6, 18) || rr(x, y, 0, 13, 2, 17) },
    '.': { w: 5, f: (x, y) => rr(x, y, 0, 14, 4, 18) },
    ' ': { w: 6, f: () => false },
  };
  for (const k in GLYPHS) {
    const g = GLYPHS[k], m = new Uint8Array(g.w * GH);
    for (let y = 0; y < GH; y++) for (let x = 0; x < g.w; x++) m[y * g.w + x] = g.f(x + 0.5, y + 0.5) ? 1 : 0;
    g.m = m;
  }

  /* ================================================================ keyframes & camera */
  // list of [t, v]; eased in-out between keys, held outside
  function kf(L, t, ease) {
    if (t <= L[0][0]) return L[0][1];
    for (let i = 1; i < L.length; i++) {
      if (t < L[i][0]) {
        const a = L[i - 1], b = L[i], u = (t - a[0]) / (b[0] - a[0]);
        const e = b[2] === 'l' ? u : b[2] === 'o' ? eoc(u) : b[2] === 'i' ? eic(u) : (ease || eio)(u);
        return lerp(a[1], b[1], e);
      }
    }
    return L[L.length - 1][1];
  }
  const CAMK = [[0, 10], [2.95, 10], [4.0, 236], [6.95, 236], [8.0, 430], [11.6, 430], [12.45, 648], [15.65, 648], [16.9, 945], [26.5, 945], [27.5, 930]];
  const ZK = [[0, 1], [16.2, 1], [17.6, 0.8], [26.6, 0.8], [27.6, 1]];
  const GYK = [[0, 222], [16.2, 222], [17.6, 236], [26.6, 236], [27.6, 228]];
  const CAM = { x: 0, z: 1, gy: 222 };
  const sxw = (wx) => Math.round(240 + (wx - CAM.x) * CAM.z);
  const syw = (h) => Math.round(CAM.gy - h * CAM.z);

  /* ================================================================ sky, cliffs and waterfalls */
  const SKYR = [1, 2, 3, 4, 5, 6, 7, 8, 9, 23];
  function drawSky(t) {
    const hz = CAM.gy - 222;
    for (let y = 0; y < H; y++) {
      const yy = y - hz * 0.1;
      const s = yy < 40 ? lerp(0, 1.2, yy / 40) : yy < 120 ? lerp(1.2, 3.4, (yy - 40) / 80) : yy < 175 ? lerp(3.4, 7.2, (yy - 120) / 55) : lerp(7.2, 8.6, clamp((yy - 175) / 40, 0, 1));
      const o = y * W;
      for (let x = 0; x < W; x++) {
        const k = clamp((s + bay(x, y) - 0.5 + 0.5) | 0, 0, 9);
        BUF[o + x] = SKYR[k];
      }
    }
    // stars
    const ox = fl(CAM.x * 0.02);
    for (let y = 0; y < 120; y++) for (let x = 0; x < W; x++) {
      const h = ih(x + ox, y, 501);
      if (h < 0.0035) {
        const tw = 0.5 + 0.5 * Math.sin(t * (2 + ih(x, y, 502) * 4) + ih(x, y, 503) * TAU);
        BUF[y * W + x] = tw > 0.8 ? 26 : tw > 0.45 ? 24 : 8;
      }
    }
  }
  function ridge(wx) { const m = vn1(wx / 70, 43); return 100 + 40 * fbm(wx, 0, 90, 3, 41) + (m > 0.55 ? -18 : 0) * sstep(0.55, 0.62, m) + 6 * vn1(wx / 9, 42); }
  function drawCliffs(t) {
    const p = 0.07, zp = 1 + (CAM.z - 1) * p, base = Math.round(CAM.x * p * zp) / zp, dy = (CAM.gy - 222) * 0.25;
    const bot = 200 + dy;
    // a paler, farther range first
    for (let x = 0; x < W; x++) {
      const wx = Math.round(CAM.x * p * 0.5 * zp) / zp + (x - 240) / zp;
      const yt = Math.round(128 + 26 * fbm(wx + 900, 0, 60, 3, 48) + dy);
      for (let y = Math.max(0, yt); y < bot; y++) BUF[y * W + x] = y === yt ? 9 : (vn(wx * 2, y, 7, 49) > 0.6 ? 8 : 7);
    }
    for (let x = 0; x < W; x++) {
      const wx = base + (x - 240) / zp;
      const yt = Math.round(ridge(wx) + dy);
      for (let y = Math.max(0, yt); y < bot + 30 && y < H; y++) {
        const d = y - yt;
        const st = vn(wx * 4, y * 0.35, 6, 44), ledge = frac((y + vn(wx, 0, 20, 45) * 30) / 17);
        let c = d < 1 ? 7 : d < 2 ? 6 : st > 0.66 ? 2 : st > 0.5 ? 4 : 3;
        if (ledge < 0.08 && st < 0.7) c = 5;
        if (ledge > 0.08 && ledge < 0.15) c = 2;
        BUF[y * W + x] = c;
      }
    }
    // luminous waterfalls
    const k0 = fl((base - 300) / 84), k1 = fl((base + 300) / 84);
    for (let k = k0; k <= k1; k++) {
      if (ih(k, 1, 46) < 0.35) continue;
      const wx = k * 84 + ih(k, 2, 46) * 40, wdt = 2 + fl(ih(k, 3, 46) * 4);
      const cx = Math.round(240 + (wx - base) * zp);
      if (cx < -20 || cx > W + 20) continue;
      const yt = Math.round(ridge(wx) + dy) + 2, sp = 34 + ih(k, 4, 46) * 22;
      for (let y = Math.max(0, yt); y < bot; y++) {
        const spread = Math.round((y - yt) * 0.04);
        for (let x = cx - spread; x < cx + wdt + spread; x++) {
          if (x < 0 || x >= W) continue;
          const s = frac((y - t * sp) / 9 + ih(x - cx + 9, k, 47) * 0.7);
          const edge = x === cx - spread || x === cx + wdt + spread - 1;
          BUF[y * W + x] = edge ? (s < 0.5 ? 50 : 24) : s < 0.22 ? 27 : s < 0.55 ? 25 : 51;
        }
      }
      glow(cx + wdt / 2, (yt + bot) / 2, Math.max(14, (bot - yt) * 0.55), T_CY, 0.22, 1);
      for (let m = 0; m < 5; m++) {
        const mx = cx + wdt / 2 + (m - 2) * 6 + Math.sin(t * 1.7 + m * 1.3 + k) * 3;
        glow(mx, bot - 3 - (m % 2) * 3, 9 + (m % 3) * 2, T_MIST, 0.5, 1);
      }
    }
  }

  /* ================================================================ far forest */
  function drawFarForest(t) {
    const p = 0.22, zp = 1 + (CAM.z - 1) * p, base = Math.round(CAM.x * p * zp) / zp, dy = (CAM.gy - 222) * 0.45;
    const gy = 199 + dy, CW = 44;
    const k0 = fl((base - 300 / zp) / CW) - 1, k1 = fl((base + 300 / zp) / CW) + 1;
    for (let k = k0; k <= k1; k++) {
      const wx = k * CW + ih(k, 1, 51) * 24, w = (6 + ih(k, 2, 51) * 9) * zp;
      const cx = 240 + (wx - base) * zp;
      const x0 = Math.max(0, fl(cx - w / 2 - 6)), x1 = Math.min(W - 1, Math.ceil(cx + w / 2 + 6));
      for (let x = x0; x <= x1; x++) {
        for (let y = 0; y < gy + 2; y++) {
          const flare = y > gy - 14 ? Math.pow((y - (gy - 14)) / 14, 2) * 5 : 0;
          const hw = w / 2 + flare + Math.sin(y * 0.07 + k) * 0.8;
          const u = (x + 0.5 - cx) / hw;
          if (Math.abs(u) > 1) continue;
          const v = 0.5 - u * 0.4 + (vn(x * 2, y, 5, 52 + k) - 0.5) * 0.3;
          BUF[y * W + x] = u < -0.7 ? 6 : v > 0.55 ? 5 : 4;
        }
      }
    }
    // canopy masses
    for (let x = 0; x < W; x++) {
      const wx = base + (x - 240) / zp;
      const top = 30 + 26 * fbm(wx, 0, 40, 3, 53) + dy * 0.3;
      for (let y = 0; y < top; y++) {
        const n = fbm(wx * 1.4, y * 1.4, 14, 2, 54);
        BUF[y * W + x] = n > 0.62 ? 5 : n > 0.4 ? 4 : 3;
      }
    }
    // far floor band with tiny glowing spots
    for (let y = fl(gy); y < H; y++) for (let x = 0; x < W; x++) {
      const wx = base + (x - 240) / zp;
      BUF[y * W + x] = (y === fl(gy) && vn(wx, 0, 6, 55) > 0.45) ? 6 : (vn(wx, y, 8, 56) > 0.6 ? 5 : 4);
    }
    for (let i = 0; i < 46; i++) {
      const wx = fl((base - 260 / zp) / 20) * 20 + i * 20 + ih(i + fl((base - 260 / zp) / 20), 1, 57) * 18;
      const id = fl(wx / 20);
      if (ih(id, 2, 57) < 0.5) continue;
      const x = Math.round(240 + (wx - base) * zp), y = Math.round(gy - 1 - ih(id, 3, 57) * 3);
      const pk = ih(id, 4, 57) < 0.4, pul = 0.6 + 0.4 * Math.sin(t * 2.3 + id);
      P(x, y, pk ? 53 : 50); P(x + 1, y, pk ? 52 : 12);
      glow(x, y, 5, pk ? T_PK : T_CY, 0.35 * pul, 2);
    }
  }

  /* ================================================================ giant mossy trees */
  const BARK = [18, 19, 20, 21, 22], MOSS = [11, 12, 13, 14, 15, 16];
  const IDMAP = new Uint8Array(256).map((_, i) => i);
  const LAYERS = {
    back: { p: 0.36, CW: 84, seed: 160, wmin: 14, wmax: 26, gy0: 207, dens: 0.25, map: T_FOG[3], lift: -0.12, fungi: 1, eyes: 0, roots: 1 },
    mid: { p: 0.52, CW: 150, seed: 61, wmin: 26, wmax: 50, gy0: 214, dens: 0.22, map: null, lift: 0, fungi: 1, eyes: 1, roots: 3 },
  };
  function layerGeo(L) { const zp = 1 + (CAM.z - 1) * L.p; return { zp, base: Math.round(CAM.x * L.p * zp) / zp, gy: L.gy0 + (CAM.gy - 222) * (L.p + 0.3) }; }
  function barkShade(x, y, u, lx, k, L, lit) {
    // lit: extra light from the sky side; returns palette index (bark or moss)
    const wob = vn(lx * 0.8, y, 14, 62 + k) * 1.6;
    const g = frac(u * 3.2 + wob);
    let l = 0.5 - u * 0.34 + lit - Math.pow(Math.abs(u), 5) * 0.3;
    if (g < 0.16) l -= 0.28; else if (g < 0.3) l += 0.08;
    l += (vn(lx * 3, y * 0.5, 4, 63) - 0.5) * 0.1;
    const side = (u < -0.2 ? 0.2 : u > 0.35 ? -0.3 : 0) + (g < 0.3 ? 0.04 : 0);
    const mo = vn(lx * 1.1 + k * 57, y * 0.8, 7, 64) * 0.55 + vn(lx + k * 31, y * 0.5, 22, 65) * 0.45 + side;
    const thr = 0.62;
    if (mo > thr) {
      const ml = clamp(l * 0.55 + (mo - thr) * 2.6 + 0.05, 0, 0.999);
      return MOSS[clamp(fl(ml * 4.6 + bay(x, y) - 0.5), 0, 4)];
    }
    return BARK[clamp(fl(l * 5 + bay(x, y) - 0.5), 0, 4)];
  }
  function bracket(x, y, side, fw, fh, pk) {
    for (let dy = -fh; dy <= 1; dy++) for (let dx = 0; dx <= fw; dx++) {
      const e = (dx * dx) / (fw * fw) + (dy * dy) / (fh * fh);
      if (dy <= 0 && e > 1) continue;
      if (dy === 1 && dx > fw - 1) continue;
      const c = dy === 1 ? (pk ? 52 : 12) : e > 0.55 && dy < 0 ? (pk ? 54 : 51) : (pk ? 53 : 50);
      P(x + side * dx, y + dy, c);
    }
  }
  function drawTrees(t, L) {
    const { zp, base, gy } = layerGeo(L), CW = L.CW, map = L.map;
    const k0 = fl((base - 340 / zp) / CW) - 1, k1 = fl((base + 340 / zp) / CW) + 1;
    const lift = L.lift;
    for (let k = k0; k <= k1; k++) {
      if (ih(k, 9, L.seed) < L.dens) continue;
      const wx = k * CW + ih(k, 1, L.seed) * CW * 0.45, w0 = (L.wmin + ih(k, 2, L.seed) * (L.wmax - L.wmin)) * zp;
      const cx = 240 + (wx - base) * zp;
      if (cx < -w0 * 2.5 || cx > W + w0 * 2.5) continue;
      const lean = (ih(k, 3, L.seed) - 0.5) * 0.1;
      const x0 = Math.max(0, fl(cx - w0)), x1 = Math.min(W - 1, Math.ceil(cx + w0));
      const fb = 34 * zp;
      for (let y = 0; y < gy + 2; y++) {
        const fy = Math.max(0, (y - (gy - fb)) / fb);
        const hw = w0 / 2 * (1 + 0.55 * fy * fy) + Math.sin(y * 0.045 + k * 3) * 1.2;
        const ccx = cx + (y - gy) * lean;
        const o = y * W;
        for (let x = x0; x <= x1; x++) {
          const u = (x + 0.5 - ccx) / hw;
          if (u < -1 || u > 1) continue;
          let c = barkShade(x, y, u, (x - ccx) / zp, k, L, lift);
          if (u < -0.9) c = c >= 11 && c <= 16 ? 16 : 23;
          BUF[o + x] = map ? map[c] : c;
        }
      }
      // roots
      for (let s = -1; s <= 1; s += 2) {
        const nr = L.roots;
        for (let r = 0; r < nr; r++) {
          const h0 = (14 + ih(k, 70 + r + s * 5, L.seed) * 26) * zp, reach = (w0 * (0.35 + 0.5 * ih(k, 80 + r + s * 5, L.seed)) + 6) * (1 + r * 0.4);
          const ax = cx + s * w0 * (0.32 + 0.12 * r), ay = gy - h0, bx = ax + s * reach, by = gy + 1, qx = ax + s * reach * 0.15, qy = gy - 3;
          const th0 = w0 * (0.2 - r * 0.04) + 2;
          const Lr = reach + h0;
          for (let q = 0; q <= 1.0001; q += Math.max(0.5, lerp(th0, 1.2, Math.pow(q, 0.8)) * 0.45) / Lr) {
            const mx = (1 - q) * (1 - q) * ax + 2 * (1 - q) * q * qx + q * q * bx, my = (1 - q) * (1 - q) * ay + 2 * (1 - q) * q * qy + q * q * by;
            const th = lerp(th0, 1.2, Math.pow(q, 0.8));
            const ri = Math.ceil(th);
            for (let oy = -ri; oy <= ri; oy++) for (let ox = -ri; ox <= ri; ox++) {
              const d2 = (ox * ox + oy * oy) / (th * th);
              if (d2 > 1) continue;
              const X = Math.round(mx + ox), Y = Math.round(my + oy);
              if (X < 0 || X >= W || Y < 0 || Y >= H || Y > gy + 1) continue;
              const nx = ox / th, ny = oy / th;
              let l = 0.5 - 0.3 * nx * s * -1 - 0.45 * ny + lift;
              let c;
              const mo = vn(X / zp + k * 13, Y, 5, 66) * 0.6 + 0.2 - ny * 0.3;
              if (mo > 0.66) c = MOSS[clamp(fl((l * 0.5 + (mo - 0.66) * 2) * 5 + bay(X, Y) - 0.5), 0, 4)];
              else c = BARK[clamp(fl(l * 5 + bay(X, Y) - 0.5), 0, 4)];
              if (d2 > 0.72 && ny > 0.3) c = 18;
              BUF[Y * W + X] = map ? map[c] : c;
            }
          }
        }
      }
      if (!L.fungi) continue;
      // hollow knot with two curious eyes
      if (L.eyes && ih(k, 6, L.seed) < 0.45) {
        const hy = Math.round(gy - 70 - ih(k, 7, L.seed) * 60), hx = Math.round(cx + (hy - gy) * lean + w0 * 0.08);
        for (let y = -8; y <= 8; y++) for (let x = -6; x <= 6; x++) {
          const e = (x * x) / 36 + (y * y) / 64;
          if (e <= 1) P(hx + x, hy + y, e > 0.62 ? (x < 0 ? 22 : 19) : e > 0.4 ? 18 : 0);
        }
        const look = Math.sin(t * 0.7 + k) > 0.3 ? 1 : 0, bl = frac(t * 0.37 + k * 0.3) < 0.05;
        if (!bl) { P(hx - 2 + look, hy - 1, 43); P(hx + 2 + look, hy - 1, 43); P(hx - 2 + look, hy, 41); P(hx + 2 + look, hy, 41); glow(hx, hy - 1, 7, T_YE, 0.22); }
      }
      // glowing shelf fungi
      const nf = 1 + fl(ih(k, 8, L.seed) * 4);
      for (let f = 0; f < nf; f++) {
        const fy = Math.round(gy - 16 - ih(k, 20 + f, L.seed) * 130), side = ih(k, 30 + f, L.seed) < 0.5 ? -1 : 1;
        const fy0 = Math.max(0, (fy - (gy - fb)) / fb), hw = w0 / 2 * (1 + 0.55 * fy0 * fy0);
        const fx = Math.round(cx + (fy - gy) * lean + side * (hw - 2)), fw = Math.round((3 + ih(k, 40 + f, L.seed) * 4) * (map ? 0.7 : 1)), pk = ih(k, 50 + f, L.seed) < 0.3;
        const pul = 0.7 + 0.3 * Math.sin(t * 1.9 + f * 2 + k);
        bracket(fx, fy, side, fw, Math.max(1, Math.round(fw * 0.4)), pk);
        if (fw > 4) bracket(fx, fy + 4, side, fw - 2, Math.max(1, Math.round(fw * 0.3)), pk);
        glow(fx + side * fw * 0.5, fy, 10 + fw, pk ? T_PK : T_CY, (map ? 0.2 : 0.32) * pul, 2);
      }
    }
  }
  function drawCanopy(t) {
    const { zp, base } = layerGeo(LAYERS.mid), dy = (CAM.gy - 222) * 0.5;
    for (let x = 0; x < W; x++) {
      const wx = Math.round(base * 1.06 * zp) / zp + (x - 240) / zp;
      const top = 10 + 30 * fbm(wx, 0, 70, 3, 71) + 8 * Math.sin(wx * 0.05) - dy;
      for (let y = 0; y < top + 4; y++) {
        // leaf clumps: a scalloped lower edge and lit tops of each clump
        const cl = vn(wx, y, 7, 72), scal = top - 3 + Math.sin(wx * 0.6 + fl(wx / 9)) * 2.5;
        if (y > scal && cl < 0.55) continue;
        if (y > top) continue;
        const cell = vn(wx * 1.0 + 3, y * 1.2, 5, 73), cell2 = vn(wx * 1.0 + 3, (y + 1) * 1.2, 5, 73);
        let c = cell > 0.62 ? 12 : cell > 0.4 ? 11 : 10;
        if (cell > 0.62 && cell2 < cell - 0.04 && y > 3) c = 13;
        if (y > scal - 2 && y <= scal && cl > 0.5) c = 13;
        BUF[y * W + x] = c;
      }
    }
  }
  // vines hanging from the canopy, swaying
  function drawVines(t, p, seed, dark) {
    const zp = 1 + (CAM.z - 1) * p, base = Math.round(CAM.x * p * zp) / zp, CW = dark ? 120 : 46;
    const k0 = fl((base - 300 / zp) / CW) - 1, k1 = fl((base + 300 / zp) / CW) + 1;
    for (let k = k0; k <= k1; k++) {
      if (ih(k, 1, seed) < (dark ? 0.45 : 0.25)) continue;
      const wx = k * CW + ih(k, 2, seed) * CW, len = (dark ? 50 : 30) + ih(k, 3, seed) * (dark ? 70 : 120);
      const cx = 240 + (wx - base) * zp, ph = ih(k, 4, seed) * TAU;
      if (cx < -20 || cx > W + 20) continue;
      let px = cx;
      for (let y = 0; y < len; y++) {
        const sw = Math.sin(t * 1.1 + ph + y * 0.04) * 3.5 * (y / len) + Math.sin(y * 0.2 + ph) * 0.8;
        const x = Math.round(cx + sw);
        const c = dark ? (y % 7 === 0 ? 11 : 10) : (y % 9 < 2 ? 15 : 14);
        P(x, y, c); if (dark) P(x + 1, y, 10);
        if (y % 6 === 3) { P(x - 1, y, dark ? 10 : 15); P(x + 1, y + 1, dark ? 11 : 16); P(x - 2, y + 1, dark ? 10 : 14); }
        px = x;
      }
      if (!dark && ih(k, 5, seed) < 0.5) { // a glowing pod at the tip
        const y = Math.round(len), pul = 0.7 + 0.3 * Math.sin(t * 2.6 + ph);
        P(px, y, 54); P(px, y + 1, 53); P(px - 1, y, 53); P(px + 1, y, 53);
        glow(px, y, 8, T_PK, 0.4 * pul);
      }
    }
  }

  /* ================================================================ light, fog, ground */
  const RAYB = new Float32Array(64 * 4);
  function drawRays(t, amt) {
    const drift = Math.round(CAM.x * 0.12);
    const i0 = fl(drift / 52) - 1, i1 = fl((W + H * 0.45 + drift) / 52) + 1;
    for (let i = i0; i <= i1; i++) {
      const k = (i - i0) * 4;
      RAYB[k] = ih(i, 1, 81) < 0.45 ? 0 : 1;
      RAYB[k + 1] = 0.18 + ih(i, 2, 81) * 0.3; RAYB[k + 2] = 0.2 + ih(i, 3, 81) * 0.4;
      RAYB[k + 3] = (0.6 + 0.4 * Math.sin(t * 0.8 + i * 1.7)) * (0.5 + ih(i, 4, 81) * 0.5);
    }
    for (let y = 0; y < CAM.gy + 10 && y < H; y++) {
      const fy = 1 - y / 250, o = y * W;
      if (fy <= 0) continue;
      for (let x = 0; x < W; x++) {
        const u = (x + y * 0.45 + drift) / 52, i = fl(u), f = u - i, k = (i - i0) * 4;
        if (!RAYB[k]) continue;
        const d = Math.abs(f - RAYB[k + 2]) / RAYB[k + 1];
        if (d >= 1) continue;
        tintI(o + x, x, y, T_RAY, (1 - d * d) * RAYB[k + 3] * fy * amt);
      }
    }
  }
  function drawHaze(t) { // distance haze over the far layers
    for (let y = 0; y < H; y++) {
      const a = 0.05 + 0.3 * sstep(120, 210, y), o = y * W;
      for (let x = 0; x < W; x++) tintI(o + x, x, y, T_FOG, a);
    }
  }
  function drawFog(t, y0, y1, amax, sp, seed, T) {
    const base = Math.round(CAM.x * sp);
    for (let y = Math.max(0, fl(y0)); y < Math.min(H, y1); y++) {
      const fy = Math.sin(PI * (y - y0) / (y1 - y0)), o = y * W;
      for (let x = 0; x < W; x++) {
        const n = fbm(x + base + t * 7, y * 2.4 + Math.sin(x * 0.01 + t * 0.3) * 4, 46, 3, seed);
        const a = (n - 0.38) * 2.2 * fy * amax;
        if (a > 0.02) tintI(o + x, x, y, T, a);
      }
    }
  }
  function groundTop(wx) { return Math.round(vn1(wx / 13, 91) * 2.2); }
  const GRND = [15, 14, 13, 12, 11, 10, 10, 1];
  function drawGround(t) {
    const gy = CAM.gy, z = CAM.z;
    for (let x = 0; x < W; x++) {
      const wx = CAM.x + (x - 240) / z;
      const top = gy + groundTop(wx);
      const r1 = top + 7 + Math.round(2.5 * Math.sin(wx * 0.045) + 1.5 * Math.sin(wx * 0.13)), r2 = top + 15 + Math.round(3 * Math.sin(wx * 0.031 + 2) + Math.sin(wx * 0.2));
      for (let y = top; y < H; y++) {
        const d = y - top;
        const n = vn(wx, y, 4, 92);
        let c;
        if (d === 0) c = n > 0.72 ? 16 : 15;
        else if (d < 3) c = n > 0.55 ? 14 : 13;
        else {
          const k = 2.2 + (d - 3) * 0.17 + (n - 0.5) * 1.6;
          c = GRND[clamp(fl(k + bay(x, y) * 0.9 - 0.45), 2, 7)];
        }
        // roots running under the path
        if (d > 3 && (Math.abs(y - r1) < 1 || (Math.abs(y - r2) < 1.5 && d > 10))) c = y <= r1 - 0.5 || y <= r2 - 1 ? 21 : 19;
        // pebbles
        if (d > 4) {
          const cx = fl(wx / 9), cy = fl((d - 4) / 6), hp = ih(cx, cy, 97);
          if (hp < 0.16 && d < 22) {
            const px = cx * 9 + 2 + ih(cx, cy, 98) * 5, py = 4 + cy * 6 + 1 + ih(cx, cy, 99) * 3, rr = 1.2 + ih(cx, cy, 100) * 1.6;
            const ddx = wx - px, ddy = d - py;
            if (ddx * ddx + ddy * ddy * 1.6 < rr * rr) c = ddy < -rr * 0.3 ? 59 : ddx > rr * 0.3 ? 2 : 58;
          }
        }
        if (d > 8 && ih(fl(wx), y, 93) < 0.003) c = frac(t * 0.5 + ih(fl(wx), y, 94)) < 0.5 ? 50 : 52;
        BUF[y * W + x] = c;
      }
      // grass blades, a few with tiny flowers
      const id = fl(wx);
      if (ih(id, 1, 95) < 0.5) {
        const hgt = 1 + fl(Math.pow(ih(id, 2, 95), 1.6) * 6), sway = Math.sin(t * 2.2 + wx * 0.07) > 0.5 ? 1 : 0;
        for (let q = 1; q <= hgt; q++) P(x + (q > 2 ? sway : 0), top - q, q === hgt ? 16 : q > hgt * 0.5 ? 15 : 14);
        if (hgt >= 5 && ih(id, 3, 95) < 0.25) P(x + sway, top - hgt - 1, ih(id, 4, 95) < 0.5 ? 54 : 44);
      }
    }
    // small ferns along the edge of the path
    const FW = 26, f0 = fl((CAM.x - 270 / z) / FW), f1 = fl((CAM.x + 270 / z) / FW);
    for (let k = f0; k <= f1; k++) {
      if (ih(k, 1, 103) < 0.55) continue;
      const wx = k * FW + ih(k, 2, 103) * 16, bx = sxw(wx), by = gy + groundTop(wx);
      const nf = 4, L0 = 8 + ih(k, 3, 103) * 8;
      for (let f = 0; f < nf; f++) {
        const ang = -PI / 2 + (f - 1.5) * 0.5 + Math.sin(t * 1.5 + k + f) * 0.05, L = L0 * (f === 1 || f === 2 ? 1 : 0.75);
        let px = bx, py = by;
        for (let q = 0; q < L; q++) {
          const a = ang + (q / L) * 0.8 * (f < 2 ? -1 : 1);
          px += Math.cos(a); py += Math.sin(a);
          P(px, py, 13);
          if (q % 2 === 1 && q < L - 1) { P(px - 1, py, q > L * 0.5 ? 15 : 14); P(px + 1, py, 14); }
        }
      }
    }
    // glowing mushroom clusters
    const CW = 34, k0 = fl((CAM.x - 280 / z) / CW), k1 = fl((CAM.x + 280 / z) / CW);
    for (let k = k0; k <= k1; k++) {
      if (ih(k, 1, 96) < 0.42) continue;
      const n = 1 + fl(ih(k, 2, 96) * 3), pk = ih(k, 3, 96) < 0.35;
      for (let m = 0; m < n; m++) {
        const wx = k * CW + ih(k, 10 + m, 96) * 24, x = sxw(wx), top = gy + groundTop(wx);
        const hgt = 2 + fl(ih(k, 20 + m, 96) * 5), cw = 2 + fl(ih(k, 30 + m, 96) * 3);
        const pul = 0.65 + 0.35 * Math.sin(t * 2.1 + k * 1.7 + m);
        for (let q = 0; q < hgt; q++) P(x, top - q, 25);
        const cy = top - hgt;
        for (let q = -cw; q <= cw; q++) { P(x + q, cy, pk ? 53 : 50); if (Math.abs(q) < cw) P(x + q, cy - 1, pk ? 54 : 51); }
        if (cw > 2) P(x - 1, cy - 1, 27);
        P(x - cw, cy + 1, pk ? 52 : 12); P(x + cw, cy + 1, pk ? 52 : 12);
        glow(x, cy, 9 + cw * 2, pk ? T_PK : T_CY, 0.42 * pul, 2);
      }
    }
  }
  // dark ferns along the bottom edge, in front of everything
  function drawFerns(t) {
    const p = 1.35, z = CAM.z, base = Math.round(CAM.x * p * z) / z, CW = 38;
    const k0 = fl((base - 300) / CW) - 1, k1 = fl((base + 300) / CW) + 1;
    for (let k = k0; k <= k1; k++) {
      if (ih(k, 1, 101) < 0.3) continue;
      const wx = k * CW + ih(k, 2, 101) * 20, bx = 240 + (wx - base) * z, by = H + 4;
      const nf = 3 + fl(ih(k, 3, 101) * 3), hgt = (14 + ih(k, 4, 101) * 20) * (0.8 + 0.2 * z);
      for (let f = 0; f < nf; f++) {
        const ang = -PI / 2 + (f - (nf - 1) / 2) * 0.42 + Math.sin(t * 1.3 + k + f) * 0.04, L = hgt * (0.75 + 0.25 * ih(k, 10 + f, 101));
        let px = bx, py = by;
        for (let s = 0; s < L; s++) {
          const a = ang + (s / L) * 0.9 * Math.sign(ang + PI / 2 || 1);
          px += Math.cos(a); py += Math.sin(a);
          P(px, py, 0); P(px + 1, py, 1);
          if (s % 3 === 0 && s > 2) {
            const lf = 3.5 * (1 - s / L) + 1;
            for (let q = 1; q <= lf; q++) { P(px - q, py + q * 0.4, q === Math.round(lf) ? 12 : 0); P(px + 1 + q, py + q * 0.4, q === Math.round(lf) ? 11 : 1); }
          }
        }
      }
    }
  }
  // huge foreground trunk that sweeps past during walks
  const FGT = [1020, 1610, 2340];
  function drawFgTrunks(t) {
    const p = 3, base = Math.round(CAM.x * p);
    for (let i = 0; i < FGT.length; i++) {
      const cx = 240 + (FGT[i] - base), w = 34 + i * 6;
      if (cx < -w - 10 || cx > W + w + 10) continue;
      for (let y = 0; y < H; y++) {
        const hw = w / 2 + Math.sin(y * 0.05 + i) * 2 + (y > 200 ? Math.pow((y - 200) / 70, 2) * 20 : 0);
        for (let x = Math.max(0, fl(cx - hw)); x <= Math.min(W - 1, cx + hw); x++) {
          const u = (x - cx) / hw;
          const g = frac(u * 2.4 + vn(x - cx, y, 18, 104 + i) * 1.2);
          BUF[y * W + x] = u < -0.9 ? 13 : u < -0.78 ? 12 : g < 0.2 ? 0 : (vn(x - cx, y, 6, 102 + i) > 0.68 ? 11 : 10);
        }
      }
    }
  }

  /* ================================================================ zones: a storm, and ruins around the guardian */
  function stormAmt(t) { return sstep(11.6, 12.3, t) * (1 - sstep(15.0, 15.9, t)); }
  function drawRain(t) {
    const a = stormAmt(t);
    if (a <= 0.01) return;
    for (let i = 0; i < 380; i++) {
      if (ih(i, 9, 171) > a) continue;
      const sp = 380 + ih(i, 1, 171) * 160, ph = ih(i, 2, 171);
      const y = mod(ph * 300 + t * sp, 300) - 20, x = mod(ih(i, 3, 171) * 560 - CAM.x * 1.1 - y * 0.25, 560) - 40;
      const L = 3 + fl(ih(i, 4, 171) * 4), c = ih(i, 5, 171) < 0.3 ? 24 : 9;
      for (let q = 0; q < L; q++) P(x - q * 0.25, y - q, c);
      if (y > CAM.gy - 2 && y < CAM.gy + 6) { P(x - 1, CAM.gy - 1, 24); P(x + 1, CAM.gy - 1, 24); }
    }
  }
  const RUINS = [[-235, 70, 16, 0], [-165, 112, 18, 1], [-120, 44, 14, 2], [175, 128, 18, 3], [240, 84, 16, 4], [300, 60, 14, 5]];
  function drawRuins(t) {
    const p = 0.6, zp = 1 + (CAM.z - 1) * p, base = Math.round(CAM.x * p * zp) / zp, gy = 214 + (CAM.gy - 222) * 0.9;
    const rg = 0.5 + 0.5 * Math.sin(t * 3.1);
    for (const [ox, hgt, w, k] of RUINS) {
      const cx = Math.round(240 + (567 + ox - base) * zp), hw = Math.round(w * zp / 2), hh = Math.round(hgt * zp);
      if (cx < -40 || cx > W + 40) continue;
      for (let y = gy - hh - 4; y <= gy; y++) for (let x = cx - hw - 3; x <= cx + hw + 3; x++) {
        const dy = gy - y, base2 = dy < 6 ? 3 : 0, cap = dy > hh - 6 && dy <= hh ? 2 : 0;
        const brk = dy > hh - 8 + Math.round(ih(x, k, 181) * 8) && cap === 0 && dy > hh - 8;
        if (Math.abs(x - cx) > hw + Math.max(base2, cap) || dy > hh || brk) continue;
        const u = (x - cx) / (hw + 0.5), row = fl(dy / 7), joint = dy % 7 === 0 || (fl((x - cx + (row & 1) * 4 + 40) / 8) !== fl((x - cx + 1 + (row & 1) * 4 + 40) / 8));
        let c = u < -0.6 ? 7 : u < 0.2 ? 6 : u < 0.7 ? 5 : 4;
        if (joint) c = 3;
        if ((dy > hh - 3 || ih(x >> 1, dy >> 1, 182 + k) < 0.12) && !joint) c = dy > hh - 2 ? 14 : 13;
        P(x, y, c);
      }
      // a rune glyph on each stone, pulsing with the guardian
      const gyph = gy - Math.round(hh * 0.55);
      for (let q = -3; q <= 3; q++) { P(cx + q, gyph + (Math.abs(q) === 3 ? 1 : 0), rg > 0.5 ? 48 : 47); if (q % 3 === 0) P(cx + q, gyph - 2, 47); }
      P(cx, gyph - 3, 48); P(cx, gyph + 2, 48);
      glow(cx, gyph, 10, T_VI, 0.2 + 0.15 * rg);
    }
  }

  /* ================================================================ fireflies and spores */
  function drawSpores(t) {
    for (let i = 0; i < 170; i++) {
      const p = 0.6 + ih(i, 1, 111) * 0.6, span = 560;
      const x = mod(ih(i, 2, 111) * span - CAM.x * p + Math.sin(t * 0.7 + i) * 6 + t * 3, span) - 40;
      const y = mod(ih(i, 3, 111) * 260 - t * (4 + ih(i, 4, 111) * 7), 260) + Math.sin(t * 1.3 + i * 0.7) * 3;
      const a = 0.3 + 0.4 * Math.sin(t * 2 + i);
      tintP(x, y, T_MIST, 0.55 + a * 0.4);
    }
  }
  function drawFireflies(t, n) {
    for (let i = 0; i < n; i++) {
      const p = 0.8 + ih(i, 1, 121) * 0.5, span = 600;
      const ph = ih(i, 5, 121) * TAU;
      const x = mod(ih(i, 2, 121) * span - CAM.x * p * CAM.z + Math.sin(t * 0.6 + ph) * 18 + Math.sin(t * 1.7 + ph * 2) * 5, span) - 60;
      const y = 60 + ih(i, 3, 121) * (CAM.gy - 66) + Math.sin(t * 0.8 + ph * 3) * 12 + Math.cos(t * 1.9 + ph) * 4;
      const b = Math.pow(0.5 + 0.5 * Math.sin(t * (1.6 + ih(i, 4, 121) * 1.5) + ph), 2);
      if (b < 0.08) continue;
      glow(x, y, 5 + b * 3, T_FF, 0.5 * b, 2);
      P(x, y, b > 0.5 ? 44 : 40);
      if (b > 0.75) { P(x + 1, y, 40); P(x - 1, y, 40); P(x, y - 1, 40); P(x, y + 1, 40); }
    }
  }

  /* ================================================================ the hero */
  // Drawn from rectangles into a small local buffer (feet centre at HOX, HOY), then outlined and stamped.
  const HBW = 104, HBH = 84, HOX = 52, HOY = 58;
  const HB = new Uint8Array(HBW * HBH), HK = new Uint8Array(HBW * HBH), HMASK = new Uint8Array(NP);
  HMASKREF = HMASK; // colour, class (1 body, 2 sword)
  function hrect(x, y, w, h, c, k) {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) {
      const X = xx + HOX, Y = yy + HOY;
      if (X < 0 || X >= HBW || Y < 0 || Y >= HBH) continue;
      HB[Y * HBW + X] = c; HK[Y * HBW + X] = k;
    }
  }
  const LEGX = [1, 5, 12, 16];
  // o: { sx, sy, lift:[4], eyeDX, eyeDY, blink, flash, sword, ang, blade:[colours], happy }
  function heroGeom(o) {
    let bw = Math.round(26 * o.sx / 2) * 2, bh = Math.max(9, Math.round(16 * o.sy)), lh = Math.max(3, Math.round(6 * Math.min(1.25, o.sy * (o.legK || 1))));
    const bx0 = -bw / 2, by1 = -lh, by0 = by1 - bh;           // body box: x in [bx0, bx0 + bw), y in [by0, by1)
    const ay0 = by0 + Math.round(bh * 0.34), ah = Math.max(2, Math.round(bh * 0.34));
    return { bw, bh, lh, bx0, by0, by1, ay0, ah, piv: [bx0 + bw + 2.5, ay0 + ah / 2] };
  }
  function drawHero(x, y, o) {
    HB.fill(0); HK.fill(0);
    const g = heroGeom(o), body = o.flash ? 27 : C.CORAL;
    const { bw, bh, lh, bx0, by0, by1, ay0, ah } = g;
    hrect(bx0, by0, bw, bh, body, 1);
    hrect(bx0 - 4, ay0, 4, ah, body, 1);
    hrect(bx0 + bw, ay0, 4, ah, body, 1);
    const lw = bw >= 22 ? 4 : 3;
    for (let i = 0; i < 4; i++) {
      const lx = bx0 + Math.round(LEGX[i] * bw / 20) + (i > 1 ? (3 - lw) : 0) + (i === 1 ? 0 : 0), lift = (o.lift && o.lift[i]) || 0;
      hrect(lx, by1, lw, Math.max(1, lh - lift), body, 1);
    }
    // eyes: two small black squares set wide
    const eyeC = o.flash ? C.CORALD : C.INK;
    const ex0 = bx0 + Math.round(bw * 0.17) + (o.eyeDX || 0), ex1 = bx0 + bw - Math.round(bw * 0.17) - 2 + (o.eyeDX || 0);
    const ey = by0 + Math.round(bh * 0.3) + (o.eyeDY || 0);
    if (o.happy) { // ^ ^
      hrect(ex0, ey + 1, 1, 1, eyeC, 1); hrect(ex0 + 1, ey, 1, 1, eyeC, 1); hrect(ex0 + 2, ey + 1, 1, 1, eyeC, 1);
      hrect(ex1 - 1, ey + 1, 1, 1, eyeC, 1); hrect(ex1, ey, 1, 1, eyeC, 1); hrect(ex1 + 1, ey + 1, 1, 1, eyeC, 1);
    } else if (o.blink) { hrect(ex0, ey + 1, 2, 1, eyeC, 1); hrect(ex1, ey + 1, 2, 1, eyeC, 1); }
    else { hrect(ex0, ey, 2, 3, eyeC, 1); hrect(ex1, ey, 2, 3, eyeC, 1); }
    // sword on the right arm nub
    if (o.sword) drawSwordLocal(g.piv[0], g.piv[1], o.ang, o.blade || null, o.t || 0);
    // outline + stamp
    const X0 = Math.round(x) - HOX, Y0 = Math.round(y) - HOY;
    const outB = o.flash ? C.CORAL : 27;
    for (let yy = 0; yy < HBH; yy++) for (let xx = 0; xx < HBW; xx++) {
      const i = yy * HBW + xx, X = X0 + xx, Y = Y0 + yy;
      if (X < 0 || X >= W || Y < 0 || Y >= H) continue;
      if (HK[i]) { BUF[Y * W + X] = HB[i]; HMASK[Y * W + X] = 1; continue; }
      let nb = 0, ns = 0;
      if (xx > 0) { const k = HK[i - 1]; if (k === 1) nb = 1; else if (k === 2) ns = 1; }
      if (xx < HBW - 1) { const k = HK[i + 1]; if (k === 1) nb = 1; else if (k === 2) ns = 1; }
      if (yy > 0) { const k = HK[i - HBW]; if (k === 1) nb = 1; else if (k === 2) ns = 1; }
      if (yy < HBH - 1) { const k = HK[i + HBW]; if (k === 1) nb = 1; else if (k === 2) ns = 1; }
      if (nb) { BUF[Y * W + X] = outB; HMASK[Y * W + X] = 1; } else if (ns) { BUF[Y * W + X] = 1; HMASK[Y * W + X] = 1; }
    }
    return g;
  }
  // the sword: u along the blade from the grip pivot, v across (drawn at SS times its base size)
  const SS = 1.8;
  function swordPix(u, v, blade, t) {
    u /= SS; v /= SS;
    const av = Math.abs(v);
    if (u >= -3.5 && u < -2.5 && av <= 0.75) return 57;
    if (u >= -2.5 && u < 0.5 && av <= 0.6) return 21;
    if (u >= 0.5 && u < 1.6 && av <= 2.6) return av > 1.9 ? 44 : 57;
    if (u >= 1.6 && u < 14.5) {
      const tw = u > 11.5 ? (14.5 - u) * 0.4 : 1.1;
      if (av > tw) return 0;
      if (blade) return v < 0 ? 27 : blade[fl(mod(u * 0.5 - t * 14, blade.length))];
      return v < -0.05 ? 27 : u < 3 ? 55 : 56;
    }
    return 0;
  }
  function drawSwordLocal(px, py, ang, blade, t) {
    const ca = Math.cos(ang), sa = Math.sin(ang);
    for (let dy = -27; dy <= 27; dy++) for (let dx = -27; dx <= 27; dx++) {
      const fx = dx + 0.5 - (px - Math.floor(px)), fy = dy + 0.5 - (py - Math.floor(py));
      const u = fx * ca + fy * sa, v = -fx * sa + fy * ca;
      const c = swordPix(u, v, blade, t);
      if (!c) continue;
      const X = Math.floor(px) + dx + HOX, Y = Math.floor(py) + dy + HOY;
      if (X < 0 || X >= HBW || Y < 0 || Y >= HBH) continue;
      HB[Y * HBW + X] = c; HK[Y * HBW + X] = 2;
    }
  }
  // a stand-alone sword (stuck in the stone, flying)
  function drawSwordAt(x, y, ang, clipY) {
    const ca = Math.cos(ang), sa = Math.sin(ang);
    const pts = [];
    for (let dy = -27; dy <= 27; dy++) for (let dx = -27; dx <= 27; dx++) {
      const u = (dx + 0.5) * ca + (dy + 0.5) * sa, v = -(dx + 0.5) * sa + (dy + 0.5) * ca;
      const c = swordPix(u, v, null, 0);
      if (c && (clipY === undefined || y + dy < clipY)) pts.push(x + dx, y + dy, c);
    }
    for (let i = 0; i < pts.length; i += 3) for (let k = 0; k < 4; k++) P(pts[i] + (k === 0 ? 1 : k === 1 ? -1 : 0), pts[i + 1] + (k === 2 ? 1 : k === 3 ? -1 : 0), 1);
    for (let i = 0; i < pts.length; i += 3) P(pts[i], pts[i + 1], pts[i + 2]);
  }
  // crescent smear between two blade angles; age 0 at a1 (newest) to 1 at a0
  function drawSmear(cx, cy, a0, a1, e, big) {
    const da = a1 - a0;
    if (Math.abs(da) < 0.05) return;
    const R0 = big ? 7 : 8, R1 = big ? 36 : 30;
    const ramp = e >= 0 ? [27, EL[e][3], EL[e][2], EL[e][1]] : [27, 26, 25, 24];
    const x0 = fl(cx - R1 - 1), x1 = Math.ceil(cx + R1 + 1), y0 = fl(cy - R1 - 1), y1 = Math.ceil(cy + R1 + 1);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy, r = Math.sqrt(dx * dx + dy * dy);
      if (r > R1 || r < R0) continue;
      let a = Math.atan2(dy, dx);
      // position of a within the sweep
      let f = (a - a0) / da;
      for (let w = -2; w <= 2 && (f < 0 || f > 1); w++) { const ff = (a + w * TAU - a0) / da; if (ff >= 0 && ff <= 1) f = ff; }
      if (f < 0 || f > 1) continue;
      const age = 1 - f;
      const rin = R0 + age * age * (R1 - R0) * 0.85;
      if (r < rin) continue;
      const edge = (r - rin) / (R1 - rin + 0.01);
      let k = age < 0.18 ? 0 : age < 0.4 ? 1 : age < 0.68 ? 2 : 3;
      if (edge < 0.25 && k < 3) k++;
      if (age > 0.72 && bay(x, y) > (1 - age) * 3.5) continue;
      P(x, y, ramp[k]);
    }
  }

  /* ================================================================ orbs */
  function drawOrb(x, y, e, t, s) {
    s = s === undefined ? 1 : s;
    if (s <= 0.02) return;
    const r = EL[e];
    glow(x, y, 12 * s + 2, EL_T[e], 0.5 * Math.min(1, s));
    const R = 3.2 * s;
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
      const d = Math.sqrt((dx) * (dx) + (dy) * (dy));
      if (d > R) continue;
      const X = Math.round(x) + dx, Y = Math.round(y) + dy;
      const l = (R - d) / R - (dx + dy) * 0.08;
      P(X, Y, l > 0.75 ? 27 : l > 0.5 ? r[3] : l > 0.2 ? r[2] : r[1]);
    }
    if (s > 0.6) P(Math.round(x) - 1, Math.round(y) - 1, 27);
    // a little satellite spark per element
    const a = t * (5 + e) + e * 1.7, sx = x + Math.cos(a) * 6 * s, sy = y + Math.sin(a) * 3 * s;
    P(sx, sy, r[3]);
    if (e === 2 && frac(t * 7) < 0.3) { P(sx + 1, sy - 1, 44); P(sx + 2, sy - 1, 43); }
    if (e === 3) { const tw = frac(t * 2.3 + 0.4); if (tw < 0.35) sparkle(x + 4, y - 5, 2, 49, 48); }
  }

  /* ================================================================ effects */
  // the coral firework burst of the reference: tapered rays that shoot out and detach
  function drawBurst(cx, cy, u, R, rays, rot, cols, thick) {
    if (u <= 0 || u >= 1) return;
    const rOut = R * eoc(Math.min(1, u * 1.7)), rIn = R * eic(u) * 0.95 + R * 0.12 * Math.min(1, u * 4);
    for (let k = 0; k < rays; k++) {
      const a = rot + k * TAU / rays + (ih(k, 1, 201) - 0.5) * 0.12, len = 0.75 + 0.25 * ih(k, 2, 201);
      const r1 = rIn * len, r2 = rOut * len;
      if (r2 <= r1) continue;
      const ca = Math.cos(a), sa = Math.sin(a);
      for (let r = r1; r <= r2; r += 0.5) {
        const f = (r - r1) / Math.max(1, r2 - r1);
        const th = (thick || 1.6) * (1 - f * 0.6) * (1 - u * 0.5);
        const X = cx + ca * r, Y = cy + sa * r;
        for (let w = -th; w <= th; w += 0.7) P(X - sa * w, Y + ca * w, f > 0.8 ? cols[1] : cols[0]);
      }
    }
  }
  function drawDust(cx, cy, t0, t, n, spread, seed) {
    const u = (t - t0) / 0.55;
    if (u < 0 || u > 1) return;
    for (let i = 0; i < n; i++) {
      const dir = i % 2 ? 1 : -1, sp = (0.4 + ih(i, 1, seed) * 0.6) * spread;
      const x = cx + dir * sp * eoc(u) * 1.0, y = cy - 1 - ih(i, 2, seed) * 3 * eoc(u) - u * 2;
      const r = 1 + (1 - u) * 1.5 * ih(i, 3, seed) + u * 1.2;
      if (u > 0.6 && bay(fl(x), fl(y)) < (u - 0.6) * 2.5) continue;
      discF(x, y, r, u < 0.4 ? 25 : 24);
    }
  }
  function drawImpactStar(cx, cy, u, R, e) {
    if (u < 0 || u > 1) return;
    const c0 = 27, c1 = e >= 0 ? EL[e][3] : 26;
    const n = 8;
    for (let k = 0; k < n; k++) {
      const a = k * TAU / n + 0.3, L = R * (k % 2 ? 0.55 : 1) * (1 - u * 0.4), r0 = R * 0.15 + u * R * 0.5;
      const ca = Math.cos(a), sa = Math.sin(a);
      for (let r = r0; r < L; r += 0.5) { const th = (1 - (r - r0) / (L - r0)) * (k % 2 ? 1 : 1.8); for (let w = -th; w <= th; w += 0.7) P(cx + ca * r - sa * w, cy + sa * r + ca * w, r > L * 0.7 ? c1 : c0); }
    }
    if (u < 0.4) discF(cx, cy, R * 0.25 * (1 - u), c0);
  }
  function drawTing(x, y, u) { // the little sword-pull sparkle
    if (u < 0 || u > 1) return;
    const L = 9 * (u < 0.25 ? eoc(u / 0.25) : 1 - eic((u - 0.25) / 0.75));
    glow(x, y, 14 * (1 - u) + 4, T_WH, 0.55 * (1 - u));
    sparkle(x, y, L, 27, 44);
    const rr2 = 3 + u * 12;
    for (let k = 0; k < 16; k++) { const a = k * TAU / 16; if (u < 0.7 && (k % 2 === 0)) P(x + Math.cos(a) * rr2, y + Math.sin(a) * rr2, k % 4 ? 26 : 44); }
  }
  // zig-zag bolt between two points, re-rolled every frame step
  function drawBolt(x0, y0, x1, y1, seed, w, cCore, cEdge) {
    const n = Math.max(4, Math.round(Math.hypot(x1 - x0, y1 - y0) / 8));
    let px = x0, py = y0;
    const nx = -(y1 - y0), ny = x1 - x0, nl = Math.hypot(nx, ny) || 1;
    for (let i = 1; i <= n; i++) {
      const u = i / n, j = i === n ? 0 : (ih(i, seed, 211) - 0.5) * 16;
      const qx = lerp(x0, x1, u) + nx / nl * j, qy = lerp(y0, y1, u) + ny / nl * j;
      if (w > 1) { lineP(px - 1, py, qx - 1, qy, cEdge); lineP(px + 1, py, qx + 1, qy, cEdge); }
      lineP(px, py, qx, qy, cCore);
      if (ih(i, seed, 212) < 0.3) { // a forked twig
        const fx = qx + (ih(i, seed, 213) - 0.5) * 18, fy = qy + ih(i, seed, 214) * 10;
        lineP(qx, qy, fx, fy, cEdge);
      }
      px = qx; py = qy;
    }
  }

  /* ================================================================ the boss: an ancient forest guardian */
  // Rendered into its own layer (BB colours, BK kinds) so it can flash, crack and shatter as a whole.
  const BB = new Uint8Array(NP), BK = new Uint8Array(NP); // BK: 0 empty, 1 body, 2 rune light, 3 eye
  const STONE = [1, 3, 58, 59, 60, 62];
  let BCLIP = H;
  function bput(x, y, c, k) {
    x = fl(x); y = fl(y);
    if (x < 0 || x >= W || y < 0 || y >= BCLIP || y >= H) return;
    const i = y * W + x; BB[i] = c; BK[i] = k || 1;
  }
  // irregular stone plates: a jittered cell pattern, id of the nearest seed and the gap to the second
  let PL_ID = 0, PL_GAP = 0;
  function platesRaw(lx, ly) {
    const gx = lx / 12, gy = ly / 9.5, ix = fl(gx), iy = fl(gy);
    let d1 = 9, d2 = 9, id = 0;
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
      const cx = ix + i, cy = iy + j, mx = mod(cx, 24), my = mod(cy, 27);   // the cell lattice wraps with the 288 x 256 texture
      const px = cx + 0.15 + ih(mx, my, 405) * 0.7, py = cy + 0.15 + ih(mx, my, 406) * 0.7;
      const dx = gx - px, dy = (gy - py) * 1.25, d = dx * dx + dy * dy;
      if (d < d1) { d2 = d1; d1 = d; id = mx * 131 + my * 7; } else if (d < d2) d2 = d;
    }
    PL_ID = id; PL_GAP = Math.sqrt(d2) - Math.sqrt(d1);
  }
  const PTW = 288, PTH = 256.5 | 0, PT_ID = new Int32Array(PTW * PTH), PT_GAP = new Float32Array(PTW * PTH);
  for (let y = 0; y < PTH; y++) for (let x = 0; x < PTW; x++) { platesRaw(x + 0.5, y + 0.5); PT_ID[y * PTW + x] = PL_ID; PT_GAP[y * PTW + x] = PL_GAP; }
  function plates(lx, ly, sd) {
    const i = mod(fl(ly + sd * 53), PTH) * PTW + mod(fl(lx + sd * 37), PTW);
    PL_ID = PT_ID[i] + sd * 1009; PL_GAP = PT_GAP[i];
  }
  function stoneAt(x, y, lx, ly, nx, ny, nz, e, moss, sd) {
    let l = 0.3 + 0.42 * (-0.55 * nx - 0.55 * ny + 0.55 * nz);
    plates(lx, ly, sd);
    const id = PL_ID, gap = PL_GAP;
    plates(lx, ly - 1, sd);
    const topEdge = PL_ID !== id;
    l += (ih(id, 3, 407) - 0.5) * 0.2;
    const mortar = gap < 0.1;
    if (mortar) l -= 0.3;
    else if (topEdge) l += 0.18;
    else if (gap < 0.2) l -= 0.06;
    l -= Math.pow(e, 6) * 0.25;
    const m = vn(lx + sd * 40, ly, 5, 403) * 0.55 + vn(lx, ly + sd * 9, 13, 404) * 0.3 - ny * 0.45 + moss + (topEdge ? 0.08 : 0) + (ih(id, 4, 408) < 0.25 ? 0.12 : 0);
    if (m > 0.8 && !mortar) {
      const ml = clamp(l * 0.7 + (m - 0.8) * 1.8, 0, 0.999);
      return MOSS[clamp(fl(ml * 5 + bay(x, y) - 0.5), 0, 4)];
    }
    if (nx < -0.62 && e > 0.8 && ny < 0.5) return 23;
    return STONE[clamp(fl(l * 6 + bay(x, y) - 0.5), 0, 5)];
  }
  function bpart(cx, cy, rx, ry, pw, moss, sd) {
    const x0 = fl(cx - rx - 1), x1 = Math.ceil(cx + rx + 1), y0 = fl(cy - ry - 1), y1 = Math.ceil(cy + ry + 1);
    for (let y = Math.max(0, y0); y <= Math.min(H - 1, y1); y++) for (let x = Math.max(0, x0); x <= Math.min(W - 1, x1); x++) {
      const u = (x + 0.5 - cx) / rx, v = (y + 0.5 - cy) / ry;
      const au = Math.abs(u), av = Math.abs(v), e = Math.pow(au, pw) + Math.pow(av, pw);
      if (e > 1) continue;
      let nx = Math.sign(u) * Math.pow(au, pw - 1), ny = Math.sign(v) * Math.pow(av, pw - 1);
      const nl = Math.hypot(nx, ny) || 1, s = Math.min(1, Math.pow(e, 1 / pw));
      nx = nx / nl * s; ny = ny / nl * s;
      const nz = Math.sqrt(Math.max(0, 1 - s * s));
      bput(x, y, stoneAt(x, y, x - cx, y - cy, nx, ny, nz, e, moss, sd), 1);
    }
  }
  function bdisc(x, y, r, c, k) { for (let dy = -Math.ceil(r); dy <= Math.ceil(r); dy++) for (let dx = -Math.ceil(r); dx <= Math.ceil(r); dx++) if (dx * dx + dy * dy <= r * r) bput(x + dx, y + dy, c, k); }
  function bline(x0, y0, x1, y1, c, k, halo) {
    lineF(x0, y0, x1, y1, (x, y) => {
      if (halo) for (let q = 0; q < 4; q++) { const X = x + (q === 0 ? 1 : q === 1 ? -1 : 0), Y = y + (q === 2 ? 1 : q === 3 ? -1 : 0); const i = Y * W + X; if (X >= 0 && X < W && Y >= 0 && Y < Math.min(H, BCLIP) && BK[i] === 1) { BB[i] = halo; BK[i] = 2; } }
      bput(x, y, c, k);
    });
  }
  // a branch: recursive, swaying with time
  function branch(x, y, ang, len, th, depth, sd, t, sway, out) {
    const sw = Math.sin(t * 1.6 + sd * 1.3) * sway * (4 - depth) * 0.02 + Math.sin(t * 9 + sd) * sway * 0.004 * depth;
    const a = ang + sw, x1 = x + Math.cos(a) * len, y1 = y + Math.sin(a) * len;
    const n = Math.max(1, Math.round(len));
    for (let i = 0; i <= n; i++) {
      const u = i / n, px = lerp(x, x1, u), py = lerp(y, y1, u), r = lerp(th, th * 0.7, u);
      for (let dy = -Math.ceil(r); dy <= Math.ceil(r); dy++) for (let dx = -Math.ceil(r); dx <= Math.ceil(r); dx++) {
        if (dx * dx + dy * dy > r * r + 0.3) continue;
        const side = (dx * Math.sin(a) - dy * Math.cos(a)) / (r + 0.01);
        bput(px + dx, py + dy, side > 0.45 ? 22 : side > -0.3 ? 20 : 19, 1);
      }
    }
    if (depth >= 4 || len < 5) { out.push(x1, y1, sd); return; }
    const k = 2 + (ih(sd, depth, 411) < 0.4 ? 1 : 0);
    for (let i = 0; i < k; i++) {
      const da = (i - (k - 1) / 2) * (0.55 + ih(sd, i, 412) * 0.3) + (ih(sd, i + 7, 413) - 0.5) * 0.3;
      branch(x1, y1, a + da, len * (0.62 + ih(sd, i + 3, 414) * 0.18), Math.max(0.6, th * 0.62), depth + 1, sd * 3 + i + 1, t, sway, out);
    }
  }
  function leafCluster(x, y, sd, t, mag) {
    const n = 7 + fl(ih(sd, 1, 421) * 6);
    for (let i = 0; i < n; i++) {
      const dx = (ih(sd, i, 422) - 0.5) * 12, dy = (ih(sd, i, 423) - 0.5) * 8 - 1;
      const r = 1.5 + ih(sd, i, 424) * 2;
      for (let yy = -2; yy <= 2; yy++) for (let xx = -2; xx <= 2; xx++) if (xx * xx + yy * yy <= r * r) bput(x + dx + xx, y + dy + yy, yy < -r * 0.4 ? 15 : yy < r * 0.3 ? 14 : 13, 1);
    }
    if (ih(sd, 9, 425) < 0.45) { const g = 0.5 + 0.5 * Math.sin(t * 3 + sd); bput(x, y - 1, g > 0.5 ? 49 : 48, 2); bput(x + 1, y - 1, 47, 2); }
    if (mag > 0) bput(x + 2, y + 2, 48, 2);
  }
  function ik(sx, sy, fx, fy, a, b, side) {
    let dx = fx - sx, dy = fy - sy, d = Math.hypot(dx, dy);
    const dm = (a + b) * 0.995;
    if (d > dm) { fx = sx + dx / d * dm; fy = sy + dy / d * dm; dx = fx - sx; dy = fy - sy; d = dm; }
    const th = Math.atan2(dy, dx), al = Math.acos(clamp((a * a + d * d - b * b) / (2 * a * d), -1, 1));
    const e1 = [sx + Math.cos(th + al) * a, sy + Math.sin(th + al) * a], e2 = [sx + Math.cos(th - al) * a, sy + Math.sin(th - al) * a];
    const e = side < 0 ? (e1[0] < e2[0] ? e1 : e2) : (e1[0] > e2[0] ? e1 : e2);
    return [e[0], e[1], fx, fy];
  }
  function drawArm(sx, sy, fx, fy, side, t, sd, glowOn) {
    const [ex, ey, Fx, Fy] = ik(sx, sy, fx, fy, 50, 50, side);
    // upper arm then forearm as chains of mossy stones
    for (let i = 0; i <= 3; i++) { const u = i / 3; bpart(lerp(sx, ex, u), lerp(sy, ey, u), 13 - u * 2, 12 - u * 2, 2.4, 0.08, sd + i); }
    for (let i = 0; i <= 3; i++) { const u = i / 3; bpart(lerp(ex, Fx, u), lerp(ey, Fy, u), 11 + u * 3, 10 + u * 3, 2.4, 0.05, sd + 10 + i); }
    bpart(Fx, Fy, 18, 15, 2.8, 0.02, sd + 20);
    // knuckles
    const fa = Math.atan2(Fy - ey, Fx - ex);
    for (let k = -1; k <= 1; k++) { const kx = Fx + Math.cos(fa) * 12 + Math.cos(fa + PI / 2) * k * 8, ky = Fy + Math.sin(fa) * 12 + Math.sin(fa + PI / 2) * k * 8; bpart(kx, ky, 6, 5, 2.2, 0, sd + 30 + k); }
    bpart(sx, sy - 4, 22, 18, 2.4, 0.2, sd + 40);
    // rune bands
    const ga = glowOn;
    for (const u of [0.45]) {
      const bx = lerp(ex, Fx, u), by = lerp(ey, Fy, u), pa = fa + PI / 2;
      bline(bx + Math.cos(pa) * 11, by + Math.sin(pa) * 11, bx - Math.cos(pa) * 11, by - Math.sin(pa) * 11, ga > 0.6 ? 49 : 48, 2, 47);
    }
    bline(sx - 10, sy - 8, sx + 8, sy - 12, ga > 0.6 ? 49 : 48, 2, 47);
    return [ex, ey, Fx, Fy];
  }
  // rune cracks over the torso, in torso-local coordinates, revealed in order
  const CRACKS = (function () {
    const L = [];
    for (let c = 0; c < 26; c++) {
      let x = (ih(c, 1, 431) - 0.5) * 80, y = (ih(c, 2, 431) - 0.5) * 70;
      if (c < 6) { const a = c * TAU / 6; x = Math.cos(a) * 12; y = Math.sin(a) * 12; }
      const pts = [x, y];
      let a = c < 6 ? Math.atan2(y, x) : ih(c, 3, 431) * TAU;
      const n = 4 + fl(ih(c, 4, 431) * 5);
      for (let i = 0; i < n; i++) {
        a += (ih(c, i + 10, 431) - 0.5) * 1.4;
        x += Math.cos(a) * (4 + ih(c, i + 30, 431) * 5); y += Math.sin(a) * (4 + ih(c, i + 50, 431) * 4);
        pts.push(x, y);
      }
      L.push({ pts, ord: c < 6 ? 0 : c / 26 });
    }
    return L;
  })();
  // boss timeline
  const B_RISE = [16.4, 17.7], B_ROAR = 17.8, B_SLAM = [18.8, 19.66], B_LEAF = [20.4, 22.5], B_CHARGE = [22.65, 23.5], B_BEAM = [23.5, 24.3];
  const B_HITS = [25.02, 25.2, 25.38, 25.68], B_SHATTER = 26.3;
  const FREST = [-80, -54], FUP = [-66, -232], FSLAM = [-126, -16];
  const FISTK_X = [[17.9, FREST[0]], [18.5, FUP[0], 'o'], [18.8, FSLAM[0], 'i'], [19.18, FSLAM[0]], [19.42, FUP[0], 'o'], [19.66, FSLAM[0], 'i'], [20.1, FSLAM[0]], [20.6, FREST[0]], [22.5, FREST[0]], [23.0, -92], [24.3, -92], [24.8, FREST[0]]];
  const FISTK_Y = [[17.9, FREST[1]], [18.5, FUP[1], 'o'], [18.8, FSLAM[1], 'i'], [19.18, FSLAM[1]], [19.42, FUP[1], 'o'], [19.66, FSLAM[1], 'i'], [20.1, FSLAM[1]], [20.6, FREST[1]], [22.5, FREST[1]], [23.0, -96], [24.3, -96], [24.8, FREST[1]]];
  function bossAnchor(t) { return [sxw(1070), CAM.gy]; }
  function bossRunes(t) {
    let g = 0.55 + 0.25 * Math.sin(t * 3.1);
    if (t > B_ROAR - 0.1 && t < B_ROAR + 0.5) g = 1;
    if (t > B_CHARGE[0]) g = 0.8 + 0.2 * Math.sin(t * 20);
    return g;
  }
  function renderBoss(t, tp) { // tp: the pose time (frozen at the shatter)
    BB.fill(0); BK.fill(0);
    const [ax, ay0] = bossAnchor(t);
    const rise = 230 * (1 - eoc(lin(B_RISE[0], B_RISE[1], tp)));
    let ay = ay0 + Math.round(rise);
    BCLIP = ay0 + 2;
    const breathe = Math.round(Math.sin(tp * 2.2) * 1.5);
    let reel = 0;
    for (const h of B_HITS) if (tp > h) reel += 3 * eoc(lin(h, h + 0.12, tp)) * (1 - 0.6 * lin(h + 0.12, h + 0.6, tp));
    const lean = (tp > B_CHARGE[0] && tp < B_BEAM[1] + 0.3) ? Math.round(5 * sstep(B_CHARGE[0], B_CHARGE[0] + 0.5, tp) * (1 - sstep(B_BEAM[1], B_BEAM[1] + 0.3, tp))) : 0;
    const ox = ax + Math.round(reel), ty = ay - 108 + breathe;
    const glowOn = bossRunes(tp);
    // crown of branches behind the head
    const tips = [];
    const shake = (tp > B_LEAF[0] && tp < B_LEAF[1]) ? 3.5 : 1;
    const crownY = ty - 74 + lean;
    branch(ox - 6 - lean, crownY, -PI / 2 - 0.5, 34, 4.5, 0, 3, tp, shake, tips);
    branch(ox + 4 - lean, crownY - 2, -PI / 2 + 0.35, 38, 4.5, 0, 5, tp, shake, tips);
    branch(ox - 40, ty - 40, -PI / 2 - 1.0, 30, 3.6, 1, 7, tp, shake, tips);
    branch(ox + 40, ty - 42, -PI / 2 + 0.9, 32, 3.6, 1, 9, tp, shake, tips);
    branch(ox - 1 - lean, crownY, -PI / 2 - 0.05, 30, 3.5, 1, 11, tp, shake, tips);
    for (let i = 0; i < tips.length; i += 3) leafCluster(tips[i], tips[i + 1], tips[i + 2], tp, 0);
    // far arm (screen right)
    drawArm(ox + 64, ty - 30, ox + 82 + Math.sin(tp * 1.7) * 2, ay - 56 + breathe, 1, tp, 60, glowOn);
    // legs with root toes
    for (const s of [-1, 1]) {
      bpart(ox + s * 28, ay - 24, 20, 27, 2.6, 0.1, 70 + s);
      bpart(ox + s * 34, ay - 6, 24, 8, 2.2, 0.15, 74 + s);
      for (let r = 0; r < 4; r++) {
        const rx0 = ox + s * (26 + r * 6), len = 18 + r * 6;
        for (let q = 0; q < len; q++) { const X = rx0 + s * q, Y = ay - 3 + Math.round(q * q * 0.006) + Math.round(Math.sin(q * 0.4 + r) * 0.8); bput(X, Y, q % 5 === 0 ? 14 : 20, 1); bput(X, Y + 1, 19, 1); if (q < len * 0.5) bput(X, Y - 1, 21, 1); }
      }
    }
    bpart(ox, ay - 48 + breathe, 40, 13, 2.4, 0.05, 80);
    // torso
    const TW = 62, TH = 54;
    for (let y = fl(ty - TH); y <= ty + TH; y++) for (let x = fl(ox - TW - 2); x <= ox + TW + 2; x++) {
      const v = (y + 0.5 - ty) / TH, rx = TW * (v < 0 ? 1 + 0.1 * Math.sin(-v * PI) : 1 - 0.34 * v * v) * (1 + 0.04 * Math.sin(v * 7)), u = (x + 0.5 - ox) / rx;
      const au = Math.abs(u), av = Math.abs(v), e = Math.pow(au, 2.8) + Math.pow(av, 2.6);
      if (e > 1) continue;
      let nx = Math.sign(u) * Math.pow(au, 1.8), ny = Math.sign(v) * Math.pow(av, 1.6);
      const nl = Math.hypot(nx, ny) || 1, s = Math.min(1, Math.pow(e, 0.37)); nx = nx / nl * s; ny = ny / nl * s;
      bput(x, y, stoneAt(x, y, x - ox, y - ty, nx, ny, Math.sqrt(Math.max(0, 1 - s * s)), e, 0.02, 90), 1);
    }
    // old roots wrapping the stone body
    const wrap = (pts, th0) => {
      for (let i = 0; i < pts.length - 2; i += 2) {
        const x0 = ox + pts[i], y0 = ty + pts[i + 1], x1 = ox + pts[i + 2], y1 = ty + pts[i + 3];
        const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0));
        for (let q = 0; q <= n; q++) {
          const px = lerp(x0, x1, q / n), py = lerp(y0, y1, q / n), r = th0 * (1 - (i / pts.length) * 0.5);
          for (let dy = -Math.ceil(r); dy <= Math.ceil(r); dy++) for (let dx = -Math.ceil(r); dx <= Math.ceil(r); dx++) {
            if (dx * dx + dy * dy > r * r) continue;
            const X = fl(px + dx), Y = fl(py + dy), ii = Y * W + X;
            if (X < 0 || X >= W || Y < 0 || Y >= H || !BK[ii]) continue;
            const sh = dy / r;
            BB[ii] = sh < -0.45 ? (ih(X, Y, 409) < 0.5 ? 14 : 22) : sh < 0.2 ? 21 : sh < 0.6 ? 20 : 18;
          }
        }
      }
    };
    wrap([-58, -30, -40, -18, -22, 2, -12, 28, -20, 50], 3.2);
    wrap([60, -36, 44, -8, 30, 14, 34, 40], 2.8);
    wrap([-30, -50, -10, -40, 18, -46, 40, -52], 2.4);
    // hanging moss beards from the chest ledge and shoulders
    for (let i = 0; i < 30; i++) {
      const mx = ox - 50 + i * 3.4 + ih(i, 1, 441) * 2, my = ty - TH * 0.58 + Math.abs(i - 15) * 0.9;
      const len = 4 + ih(i, 2, 441) * 12;
      for (let q = 0; q < len; q++) bput(mx + Math.sin(tp * 2 + i + q * 0.3) * q * 0.06, my + q, q > len - 2 ? 15 : (q + i) % 3 ? 13 : 14, 1);
    }
    // chest rune core
    const ccx = ox, ccy = ty - 6;
    for (let dy = -13; dy <= 13; dy++) for (let dx = -13; dx <= 13; dx++) {
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d > 13) continue;
      if (d > 11.5) bput(ccx + dx, ccy + dy, 1, 1);
      else if (d > 10) bput(ccx + dx, ccy + dy, glowOn > 0.6 ? 48 : 47, 2);
      else if (d < 5) bput(ccx + dx, ccy + dy, d < 2.5 ? 27 : d < 4 ? 49 : 48, 2);
      else if (Math.abs(Math.sin(Math.atan2(dy, dx) * 3 + tp * 1.2)) < 0.18) bput(ccx + dx, ccy + dy, 47, 2);
      else bput(ccx + dx, ccy + dy, 45, 2);
    }
    // rune cracks
    const cp = tp < B_HITS[0] ? 0.2 : tp < 25.8 ? 0.2 + 0.6 * lin(B_HITS[0], 25.8, tp) : 0.8 + 0.2 * lin(25.8, 26.2, tp);
    for (const cr of CRACKS) {
      if (cr.ord > cp) continue;
      const p = cr.pts, n = p.length / 2;
      const show = cr.ord === 0 ? n : Math.min(n, 1 + Math.floor((cp - cr.ord) * 40));
      for (let i = 1; i < show; i++) bline(ccx + p[i * 2 - 2], ccy + p[i * 2 - 1], ccx + p[i * 2], ccy + p[i * 2 + 1], glowOn > 0.85 || cp > 0.5 ? 49 : 48, 2, 47);
    }
    // head
    const hx = ox - lean, hy = ty - 60 + lean + Math.round(Math.sin(tp * 2.2 + 0.6));
    bpart(hx, hy, 30, 23, 2.7, 0.05, 100);
    bpart(hx, hy - 15, 32, 9, 2.4, 0.4, 101);         // mossy brow ledge
    bpart(hx, hy + 14, 20, 9, 2.4, -0.1, 102);       // jaw
    for (let i = 0; i < 14; i++) { const mx = hx - 16 + i * 2.4, len = 5 + ih(i, 3, 441) * 10; for (let q = 0; q < len; q++) bput(mx + Math.sin(tp * 2 + i) * q * 0.07, hy + 20 + q, q > len - 2 ? 15 : 13, 1); }
    // eye sockets and eyes
    const eyeR = (tp > B_CHARGE[0] && tp < B_BEAM[1]) ? 3 + 2 * sstep(B_CHARGE[0], B_BEAM[0], tp) : 3;
    const lit = tp > B_RISE[1] - 0.25;
    for (const s of [-1, 1]) {
      const ex = hx + s * 12, ey = hy - 3;
      bpart(ex, ey, 7, 5, 2.2, -1, 110 + s);
      for (let dy = -5; dy <= 4; dy++) for (let dx = -7; dx <= 7; dx++) if ((dx * dx) / 42 + (dy * dy) / 20 < 1) bput(ex + dx, ey + dy, 0, 1);
      if (lit) { bdisc(ex, ey, eyeR, 48, 3); bdisc(ex, ey, eyeR - 1.2, 49, 3); bput(ex, ey, 27, 3); bput(ex - 1, ey, 27, 3); }
    }
    // forehead rune
    bline(hx - 5, hy - 13, hx, hy - 9, 48, 2, 47); bline(hx, hy - 9, hx + 5, hy - 13, 48, 2, 47); bline(hx, hy - 9, hx, hy - 4, 48, 2, 47);
    // near arm (screen left), the one that slams
    const fx = ox + kf(FISTK_X, tp), fy = ay + kf(FISTK_Y, tp) + (tp < 18 ? breathe : 0);
    drawArm(ox - 64, ty - 30, fx, fy, -1, tp, 120, glowOn);
    return { ox, oy: ay, ty, ccx, ccy, hx, hy, eyes: [[hx - 12, hy - 3], [hx + 12, hy - 3]], fist: [fx, fy], glowOn };
  }
  function compositeBoss(t, info, flash) {
    for (let i = 0; i < NP; i++) {
      const k = BK[i];
      if (!k) continue;
      BUF[i] = flash && k === 1 ? (BB[i] === 1 || BB[i] === 0 ? 25 : 27) : BB[i];
    }
    // outline the silhouette in ink so it sits crisply on the forest
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
      const i = y * W + x;
      if (BK[i]) continue;
      if (BK[i - 1] || BK[i + 1] || BK[i - W] || BK[i + W]) BUF[i] = flash ? 27 : 0;
    }
    glow(info.ccx, info.ccy, 30, T_VI, 0.25 + 0.25 * info.glowOn);
    for (const e of info.eyes) glow(e[0], e[1], 12 + (t > B_CHARGE[0] && t < B_BEAM[1] ? 14 : 0), T_VI, 0.45);
  }
  function drawBossShatter(t, info) {
    const u = t - B_SHATTER;
    const NS = 40, sx = new Float32Array(NS), sy = new Float32Array(NS);
    for (let s = 0; s < NS; s++) { sx[s] = info.ox + (ih(s, 1, 451) - 0.5) * 170; sy[s] = info.oy - ih(s, 2, 451) * 230; }
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (!BK[i]) continue;
      let best = 0, bd = 1e9;
      for (let s = 0; s < NS; s++) { const dx = x - sx[s], dy = y - sy[s], d = dx * dx + dy * dy; if (d < bd) { bd = d; best = s; } }
      const dx = sx[best] - info.ccx, dy = sy[best] - info.ccy, dl = Math.hypot(dx, dy) || 1;
      const sp = 90 + ih(best, 3, 451) * 160;
      const X = Math.round(x + dx / dl * sp * u), Y = Math.round(y + dy / dl * sp * u - 60 * u + 260 * u * u);
      if (X < 0 || X >= W || Y < 0 || Y >= H) continue;
      if (bay(X, Y) < (u - 0.25) * 1.6) continue;
      let c = BB[i];
      if (u < 0.1) c = 27; else if (u < 0.55) c = BK[i] === 1 ? T_VI[clamp(fl((0.6 - u) * 12), 0, 8)][c] : 49;
      BUF[Y * W + X] = c;
    }
  }
  // the awakening: dust and falling rock while it rises, eyes igniting, a roar of rings
  function drawBossFx(t, info) {
    const gy = CAM.gy;
    if (t > B_RISE[0] && t < B_RISE[1] + 0.6) {
      const u = lin(B_RISE[0], B_RISE[1] + 0.6, t);
      for (let i = 0; i < 26; i++) {
        const life = frac(ih(i, 1, 491) + (t - B_RISE[0]) * 1.3), side = i % 2 ? 1 : -1;
        const x = info.ox + side * (40 + ih(i, 2, 491) * 70 + life * 40), y = gy - 2 - life * (8 + ih(i, 3, 491) * 10);
        const r = 2 + life * 5 * (1 - u * 0.5);
        if (bay(fl(x), fl(y)) < 1 - life) discF(x, y, r, life < 0.5 ? 24 : 23);
      }
      for (let i = 0; i < 18; i++) {
        const tt = (t - B_RISE[0] - ih(i, 4, 491) * 1.2);
        if (tt < 0 || tt > 0.8) continue;
        const x = info.ox + (ih(i, 5, 491) - 0.5) * 130 + tt * (ih(i, 6, 491) - 0.5) * 40, y = info.ty - 40 + (ih(i, 7, 491) - 0.5) * 60 + 200 * tt * tt;
        if (y < gy) { rectF(x, y, 2, 2, 59); P(x, y, 60); }
      }
    }
    const ig = B_RISE[1] - 0.2;
    if (t > ig && t < ig + 0.5) for (const e of info.eyes) { const u = (t - ig) / 0.5; sparkle(e[0], e[1], 10 * Math.sin(PI * u), 27, 49); }
    if (t > B_ROAR && t < B_ROAR + 0.8) {
      for (let k = 0; k < 3; k++) {
        const u = (t - B_ROAR - k * 0.12) / 0.6;
        if (u < 0 || u > 1) continue;
        const R = 20 + u * 200;
        for (let a = 0; a < TAU; a += 1.2 / R) {
          const x = info.hx + Math.cos(a) * R, y = info.hy + Math.sin(a) * R * 0.75;
          if (bay(fl(x), fl(y)) < 1 - u * 0.8) { P(x, y, k === 0 ? 27 : 49); P(x, y + 1, 48); P(x, y - 1, 47); }
        }
      }
      glow(info.hx, info.hy, 60, T_VI, 0.4 * (1 - lin(B_ROAR, B_ROAR + 0.8, t)));
    }
  }
  // the shockwave of a root slam, running along the ground toward the hero
  function drawShockwave(t, t0, x0, gy) {
    const u = t - t0;
    if (u < 0 || u > 1.3) return;
    const fx = x0 - 210 * u, fade = 1 - sstep(0.9, 1.3, u);
    // a glowing fissure left in the ground behind the front
    for (let x = Math.max(0, fl(fx)); x < Math.min(W, x0); x++) {
      const age = (x - fx) / 210;
      if (bay(x, gy) > (1 - age * 1.4) * fade) continue;
      const yy = gy + (ih(x >> 2, 1, 463) < 0.5 ? 0 : 1);
      P(x, yy, age < 0.15 ? 49 : 48); if (age < 0.3) P(x, yy + 1, 47);
    }
    // stone spikes erupting behind the front
    for (let x = Math.max(0, fl(fx) + 4); x < Math.min(W, fl(fx) + 80); x++) {
      const d = x - fx, sid = fl((x - x0) / 8);
      if (ih(sid, 1, 461) > 0.7) continue;
      const life = clamp((d - 4) / 76, 0, 1), sh = (ih(sid, 2, 461) * 10 + 8) * Math.sin(PI * Math.min(1, life * 1.3)) * fade;
      const xm = mod(x - x0, 8), w = 1 - Math.abs(xm - 3.5) / 4;
      const hh = Math.round(sh * w);
      for (let q = 0; q < hh; q++) P(x, gy - q, q > hh - 3 ? 62 : xm < 3.5 ? 60 : 58);
      if (hh > 2) P(x, gy - hh, 1);
    }
    // the crest: a curling wall of violet light
    for (let x = fl(fx) - 4; x < fx + 26; x++) {
      if (x < 0 || x >= W) continue;
      const d = x - fx;
      const hgt = (d < 0 ? 0 : d < 5 ? 24 * Math.sqrt(d / 5) : 24 * Math.exp(-(d - 5) / 7)) * fade;
      const h = Math.round(hgt + Math.sin(d * 0.9 + t * 40) * (hgt > 4 ? 1.2 : 0));
      for (let q = 0; q < h; q++) {
        const f = q / Math.max(1, h);
        let c = f > 0.9 ? 27 : f > 0.7 ? 49 : f > 0.4 ? 48 : 47;
        if (d > 9 && bay(x, gy - q) > 1 - (d - 9) / 17) continue;
        P(x, gy - q, c);
      }
    }
    glow(fx + 8, gy - 10, 34, T_VI, 0.65 * fade);
    for (let i = 0; i < 22; i++) {
      const life = frac(ih(i, 1, 462) + u * 2.5), px = fx + 6 + life * 30 + ih(i, 3, 462) * 6, py = gy - 4 - Math.sin(PI * life) * (10 + ih(i, 2, 462) * 22);
      P(px, py, i % 3 ? 49 : 59); if (i % 3 === 0) P(px + 1, py, 58);
    }
  }
  // falling-leaf barrage from the crown
  const NLEAF = 60;
  function leafData(i, t, info) {
    const t0 = B_LEAF[0] + 0.1 + (i / NLEAF) * 1.7 + ih(i, 1, 471) * 0.1, dur = 0.85 + ih(i, 2, 471) * 0.45, tl = t0 + dur;
    let lx = 30 + ih(i, 3, 471) * 280;
    const hx = sxw(kf(HXK, tl));
    if (Math.abs(lx - hx) < 20) lx = hx + (lx < hx ? -20 : 20) + (ih(i, 4, 471) - 0.5) * 6;
    return { t0, tl, lx };
  }
  function drawLeaves(t, info) {
    if (t < B_LEAF[0] || t > B_LEAF[1] + 1.2) return;
    for (let i = 0; i < NLEAF; i++) {
      const { t0, tl, lx } = leafData(i, t, info);
      if (t < t0) continue;
      const gy = CAM.gy;
      if (t >= tl) { // stuck in the ground, fading
        const v = (t - tl) / 0.4;
        if (v < 1) { P(lx, gy - 1, 48); P(lx - 1, gy - 1, 14); P(lx + 1, gy, 47); if (v < 0.3) glow(lx, gy - 2, 6, T_VI, 0.4); }
        continue;
      }
      const u = (t - t0) / (tl - t0);
      const x0 = info.ox + (ih(i, 5, 471) - 0.5) * 150, y0 = info.oy - 200 - ih(i, 6, 471) * 30;
      const x = lerp(x0, lx, u) + Math.sin(u * 9 + i) * 8 * (1 - u), y = lerp(y0, gy - 2, eic(u) * 0.3 + u * 0.7);
      const ang = u * 9 + i, ca = Math.cos(ang), sa = Math.sin(ang) * 0.6;
      glow(x, y, 7, T_VI, 0.35);
      for (let q = -4; q <= 4; q++) {
        const w = Math.round(Math.sqrt(Math.max(0, 16 - q * q)) * 0.45);
        for (let r = -w; r <= w; r++) {
          const X = x + ca * q - sa * r, Y = y + sa * q + ca * r;
          P(X, Y, Math.abs(r) === w ? 48 : q === 0 || r === 0 ? 49 : (q < 0 ? 15 : 14));
        }
      }
      P(x - ca * 5, y - sa * 5, 47);
      for (let k = 1; k <= 3; k++) { const pu = Math.max(0, u - k * 0.03); const px = lerp(x0, lx, pu) + Math.sin(pu * 9 + i) * 8 * (1 - pu), py = lerp(y0, gy - 2, eic(pu) * 0.3 + pu * 0.7); if (bay(fl(px), fl(py)) < 0.8 - k * 0.2) P(px, py, 47); }
    }
  }
  function drawBeam(t, info, tx, ty) {
    if (t > B_CHARGE[0] && t < B_BEAM[0]) { // charging: motes spiral into the eyes
      const u = lin(B_CHARGE[0], B_BEAM[0], t);
      for (const e of info.eyes) for (let i = 0; i < 14; i++) {
        const a = i * TAU / 14 + t * 6, r = 34 * (1 - frac(u * 3 + i / 14)) + 3;
        P(e[0] + Math.cos(a) * r, e[1] + Math.sin(a) * r, i % 3 ? 48 : 49);
      }
      glow((info.eyes[0][0] + info.eyes[1][0]) / 2, info.eyes[0][1], 30 * u + 8, T_VI, 0.4 * u);
      return;
    }
    if (t < B_BEAM[0] || t > B_BEAM[1]) return;
    const u = lin(B_BEAM[0], B_BEAM[1], t), wv = Math.min(1, u * 8) * Math.min(1, (1 - u) * 6);
    const mx = (info.eyes[0][0] + info.eyes[1][0]) / 2 - 6, my = info.eyes[0][1] + 4;
    for (const e of info.eyes) lineF(e[0], e[1], mx, my, (x, y) => { discF(x, y, 2.2 * wv, 49); P(x, y, 27); });
    const len = Math.hypot(tx - mx, ty - my), dx = (tx - mx) / len, dy = (ty - my) / len;
    for (let s = 0; s < len; s += 0.5) {
      const x = mx + dx * s, y = my + dy * s;
      const w = (4.5 + Math.sin(s * 0.35 - t * 50) * 1.2) * wv;
      for (let q = -w - 2; q <= w + 2; q += 0.6) {
        const aq = Math.abs(q);
        const c = aq < w * 0.35 ? 27 : aq < w * 0.65 ? 49 : aq < w ? 48 : 47;
        if (aq > w && bay(fl(x - dy * q), fl(y + dx * q)) < 0.5) continue;
        P(x - dy * q, y + dx * q, c);
      }
    }
    for (let s = 0; s < len; s += 14) glow(mx + dx * s, my + dy * s, 16, T_VI, 0.35 * wv);
    // the splash where it meets the shield
    for (let i = 0; i < 18; i++) {
      const a = PI + (ih(i, fl(t * 30), 481) - 0.5) * 2.6 + Math.atan2(dy, dx), r = 4 + ih(i, 2, 481) * 22;
      P(tx - Math.cos(a) * r * -1, ty - Math.sin(a) * r * -1, i % 3 ? 49 : 27);
    }
    glow(tx, ty, 26, T_WH, 0.5 * wv);
  }

  /* ================================================================ finale: the braid of light */
  const F_COL = [28.75, 29.5], F_WHITE = [30.25, 30.95], R_T0 = 31.05;
  function swordTip(t) {
    const p = heroPose(t), X = sxw(p.x), Y = syw(p.h) - p.bob, g = heroGeom({ sx: p.sx, sy: p.sy, legK: p.legK });
    const a = swordAngle(t);
    return [X + g.piv[0] + Math.cos(a) * 14 * SS, Y + g.piv[1] + Math.sin(a) * 14 * SS];
  }
  function drawBraidBack(t) {
    if (t < 27.6) return;
    const [cx, ty] = swordTip(t);
    const grow = lin(F_COL[0], 30.6, t), pre = lin(27.6, F_COL[0], t);
    // the forest darkens around the gathering light, then light floods outward from the column
    const dk = 0.35 * pre * (1 - grow);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const dx = Math.abs(x + 0.5 - cx), dy = Math.abs(y - ty + 20);
      const d = Math.sqrt(dx * dx + dy * dy * 0.25);
      if (dk > 0.01) tintI(y * W + x, x, y, T_DARK, dk * Math.min(1, d / 90));
      if (grow > 0) { const a = Math.max(0, 1 - dx / (60 + grow * 120)) * (0.12 + 0.4 * grow) * (0.75 + 0.25 * Math.sin(fl(dx / 7) * 2.3 + t * 3)); if (a > 0.02) tintI(y * W + x, x, y, T_WH, a); }
    }
  }
  function drawBraid(t) {
    if (t < F_COL[0]) return;
    const [cx, ty] = swordTip(t);
    const top = ty - (ty + 12) * eoc(lin(F_COL[0], F_COL[1], t));
    const grow = lin(F_COL[0], 30.6, t), core = 1.5 + grow * 7;
    const strands = (front) => {
      for (let k = 0; k < 4; k++) {
        for (let y = Math.max(0, fl(top)); y <= ty; y++) {
          const ph = k * PI / 2 + y * 0.085 - t * 16, s = Math.sin(ph), z = Math.cos(ph);
          if ((z >= 0) !== front) continue;
          const rr = 6 + core * 0.8 + 3 * Math.sin(y * 0.03 + t * 2);
          const x = cx + s * rr;
          const c = z > 0.6 ? EL[k][3] : z > 0 ? EL[k][2] : EL[k][1];
          P(x, y, c); P(x + 1, y, c); if (z > 0.5) P(x, y - 1, 27);
        }
      }
    };
    strands(false);
    for (let y = Math.max(0, fl(top)); y <= ty; y++) {
      const w = core * (0.85 + 0.15 * Math.sin(y * 0.2 - t * 30));
      for (let q = -Math.ceil(w); q <= Math.ceil(w); q++) { const aq = Math.abs(q) / w; if (aq <= 1) P(cx + q, y, aq < 0.5 ? 27 : aq < 0.8 ? 26 : 25); }
    }
    strands(true);
    // motes flowing up
    for (let i = 0; i < 60; i++) {
      const y = mod(ty - (t * 160 + ih(i, 1, 501) * 300), Math.max(1, ty - top)) + top, a = ih(i, 2, 501) * TAU + t * 4;
      P(cx + Math.cos(a) * (core + 10 + ih(i, 3, 501) * 14), y, EL[i % 4][3]);
    }
    glow(cx, ty, 40 + grow * 30, T_WH, 0.5);
  }
  function drawWhiteout(t) {
    if (t < F_WHITE[0]) return;
    const [cx] = swordTip(t);
    const u = lin(F_WHITE[0], F_WHITE[1], t), R = 330 * eic(u) + 6;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const dx = Math.abs(x + 0.5 - cx), d = dx + Math.abs(y - 130) * 0.25 * (1 - u);
      const i = y * W + x, b = bay(x, y);
      if (d < R - 24 * b) BUF[i] = d > R - 30 ? 25 : 27;
      else tintI(i, x, y, T_WH, 0.15 + u * 0.5);
    }
  }

  /* ================================================================ the reveal: a mind made of the four elements */
  const RCX = 240, RCY = 118;
  const NEBW = W + 160, NEB = new Float32Array(NEBW * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < NEBW; x++) NEB[y * NEBW + x] = fbm(x, y * 1.3, 60, 3, 513);
  function drawRevealBg(t) {
    const nofs = fl(t * 3) % 160;
    for (let y = 0; y < H; y++) {
      const o = y * W;
      for (let x = 0; x < W; x++) {
        const dx = x + 0.5 - RCX, dy = y + 0.5 - RCY, r = Math.sqrt(dx * dx + dy * dy), th = Math.atan2(dy, dx);
        const neb = NEB[y * NEBW + x + nofs] + (1 - Math.min(1, r / 260)) * 0.35;
        let c = neb > 0.78 ? 46 : neb > 0.62 ? 45 : neb > 0.5 ? 63 : 0;
        if (neb > 0.6 && neb < 0.64 && bay(x, y) < 0.5) c = 63;
        if (neb > 0.76 && neb < 0.8 && bay(x, y) < 0.5) c = 45;
        const sh = Math.sin(th * 12 + t * 0.25) * 0.5 + 0.5;
        if (sh > 0.8 && r > 30 && bay(x, y) < (sh - 0.8) * 3.5 * (1 - r / 320)) c = c === 0 ? 63 : c === 63 ? 45 : 46;
        if (ih(x, y, 511) < 0.0035) c = frac(t * 0.7 + ih(x, y, 512)) < 0.5 ? 49 : 9;
        BUF[o + x] = c;
      }
    }
    // faint orbit rings with beads
    for (const [R, sp, n] of [[150, 0.06, 90], [184, -0.04, 120], [222, 0.03, 150]]) {
      for (let a = 0; a < TAU; a += 0.0035) {
        const x = RCX + Math.cos(a) * R, y = RCY + Math.sin(a) * R * 0.62;
        if (y < 0 || y > 222) continue;
        const bead = frac((a + t * sp) / TAU * n);
        P(x, y, bead < 0.08 ? 49 : bead < 0.5 ? 46 : 45);
      }
    }
  }
  // A brain in side view, facing left, with one lobe per element: water (frontal), leaf (parietal),
  // lightning (occipital) and starlight (temporal). Its folds, a web of neurons and the signals between them
  // assemble out of the light, then the title writes itself beneath.
  const BCX = 240, BCY = 92, TITLE_Y = 190;
  const BW2 = 240, BH2 = 176, BOX = 120, BOY = 84, BX0 = BCX - BOX, BY0 = BCY - BOY;
  const BM = new Uint8Array(BW2 * BH2);   // 1 cerebrum, 2 cerebellum, 3 brainstem
  const BL = new Uint8Array(BW2 * BH2);   // lobe = element
  const BS = new Uint8Array(BW2 * BH2);   // 1 fold, 2 great fissure
  const BE = new Uint8Array(BW2 * BH2);   // outline
  const BO = new Float32Array(BW2 * BH2); // assembly order, 0 first
  const BG = new Float32Array(BW2 * BH2); // fold height: 1 on a gyrus crest, 0 deep in a sulcus
  const inE = (x, y, cx, cy, rx, ry) => ((x - cx) * (x - cx)) / (rx * rx) + ((y - cy) * (y - cy)) / (ry * ry) <= 1;
  const centralX = (y) => -10 - (y + 60) * 0.26 + 3 * Math.sin(y * 0.13);       // the central sulcus, leaning back
  const sylvianY = (x) => 6 + (x + 70) * 0.13 + 2.5 * Math.sin(x * 0.09);          // the lateral fissure above the temporal lobe
  function brainPart(x, y) {
    if (inE(x, y, 60, 42, 33, 19)) return inE(x, y, 60, 42, 31, 17) ? 2 : 0;
    const cer = inE(x, y, 0, -14, 92, 56) || inE(x, y, -56, -8, 44, 50) || inE(x, y, 52, -10, 46, 48) || inE(x, y, -16, 22, 62, 24);
    if (cer && !inE(x, y, 58, 44, 38, 23)) return 1;
    const sy = (y - 30) / 42;
    if (sy >= 0 && sy <= 1) { const cx = 30 + sy * 14, w = 8 - sy * 2.6; if (Math.abs(x - cx) < w) return 3; }
    return 0;
  }
  (function buildBrain() {
    for (let ly = 0; ly < BH2; ly++) for (let lx = 0; lx < BW2; lx++) {
      const x = lx - BOX, y = ly - BOY, i = ly * BW2 + lx, m = brainPart(x, y);
      if (!m) continue;
      BM[i] = m;
      let e = 1;
      if (m === 2) e = 2; else if (m === 3) e = 3;
      else if (y > sylvianY(x) && x < 44) e = 3;
      else if (x < centralX(y)) e = 0;
      else if (x > 40) e = 2;
      BL[i] = e;
      if (m === 1) {
        // winding folds: contour lines of a domain-warped noise field
        const q1 = fbm(x, y, 22, 2, 701), q2 = fbm(x + 40, y, 22, 2, 702);
        const f = fbm(x + 30 * q1, y * 1.1 + 30 * q2, 22, 3, 703);
        BG[i] = Math.sin(PI * frac(f * 5.5));
        if (Math.abs(x - centralX(y)) < 1.1 && y < sylvianY(x)) BS[i] = 2;
        if (Math.abs(y - sylvianY(x)) < 1.1 && x < 44 && x > -66) BS[i] = 2;
      } else if (m === 2) { const ux = (x - 60) / 31; BG[i] = Math.sin(PI * frac((y - 40 - ux * ux * 7) / 3.6)); }
      else BG[i] = 0.4 + 0.5 * Math.sin(PI * frac((x - y * 0.3) * 0.3));
      BO[i] = clamp(Math.sqrt(x * x + y * y * 1.5) / 120 + (ih(lx, ly, 704) - 0.5) * 0.08, 0, 1);
    }
    for (let ly = 1; ly < BH2 - 1; ly++) for (let lx = 1; lx < BW2 - 1; lx++) {
      const i = ly * BW2 + lx;
      if (BM[i] && (BM[i - 1] !== BM[i] || BM[i + 1] !== BM[i] || BM[i - BW2] !== BM[i] || BM[i + BW2] !== BM[i])) BE[i] = 1;
    }
  })();
  // neurons scattered through the lobes, each wired to its nearest neighbours
  const NEU = [], NED = [];
  (function buildNeurons() {
    for (let k = 0; NEU.length < 150 && k < 30000; k++) {
      const x = Math.round((ih(k, 1, 721) - 0.5) * 228), y = Math.round((ih(k, 2, 721) - 0.5) * 150);
      const lx = x + BOX, ly = y + BOY;
      if (lx < 4 || ly < 4 || lx >= BW2 - 4 || ly >= BH2 - 4) continue;
      const i = ly * BW2 + lx;
      if (BM[i] !== 1 && BM[i] !== 2) continue;
      if (!BM[i - 4] || !BM[i + 4] || !BM[i - 4 * BW2] || !BM[i + 4 * BW2]) continue;
      let ok = true;
      for (const n of NEU) if ((n.x - x) * (n.x - x) + (n.y - y) * (n.y - y) < 110) { ok = false; break; }
      if (!ok) continue;
      NEU.push({ x, y, e: BL[i], o: BO[i], a: ih(k, 3, 721) * TAU, inc: [] });
    }
    for (let a = 0; a < NEU.length; a++) {
      const d = [];
      for (let b = 0; b < NEU.length; b++) if (b !== a) d.push([b, (NEU[b].x - NEU[a].x) ** 2 + (NEU[b].y - NEU[a].y) ** 2]);
      d.sort((p, q) => p[1] - q[1]);
      for (let k = 0; k < 3; k++) {
        const b = d[k][0];
        if (d[k][1] > 1000 || NED.some((ed) => ed.a === b && ed.b === a)) continue;
        const ed = { a, b, sp: 0.55 + ih(a, b, 722) * 0.9, ph: ih(b, a, 723), len: Math.sqrt(d[k][1]), on: ih(a + 300, b, 724) };
        NED.push(ed); NEU[b].inc.push(ed);
      }
    }
  })();
  function drawBrain(t) {
    const g = lin(R_T0 + 0.5, R_T0 + 1.9, t) * 1.05;   // the assembly front
    const live = lin(R_T0 + 1.3, R_T0 + 2.4, t);       // the signals wake up
    const wave = R_T0 + 2.3;                             // a wave of light when the title arrives
    const sweep = frac(t * 0.35);
    for (let ly = 0; ly < BH2; ly++) for (let lx = 0; lx < BW2; lx++) {
      const i = ly * BW2 + lx, m = BM[i];
      if (!m) continue;
      const o = BO[i];
      if (o > g) continue;
      const X = BX0 + lx, Y = BY0 + ly;
      if (X < 0 || Y < 0 || X >= W || Y >= H) continue;
      const e = BL[i], x = lx - BOX, y = ly - BOY, b = bay(X, Y), R = EL[e], d = Math.sqrt(x * x + y * y);
      let c;
      if (g < 1.04 && o > g - 0.045) c = b < 0.55 ? 27 : R[3];                       // construction sparks at the front
      else if (BE[i]) { const a = frac(Math.atan2(y, x) / TAU + 0.5); c = Math.abs(a - sweep) < 0.025 || Math.abs(a - sweep) > 0.975 ? 27 : R[3]; }
      else if (BS[i] === 2) c = 0;
      else {
        const w = Math.max(0, Math.sin(d * 0.15 - t * 4 + e * 1.3)), wl = w * w * w * 0.55 * live;
        const v = BG[i] * 0.6 + wl + 0.08 * (-x / 120 - y / 84) + 0.06;
        const k = Math.floor(v * 4.3 + (b - 0.5) * 0.8);
        c = BG[i] < 0.16 ? 0 : k <= 0 ? 63 : k === 1 ? R[0] : k === 2 ? R[1] : k === 3 ? R[2] : k === 4 ? R[3] : 27;
      }
      if (t > wave) { const r = (t - wave) * 170, dd = Math.abs(d - r); if (dd < 6) c = dd < 2.2 ? 27 : R[3]; }
      BUF[Y * W + X] = c;
    }
    // axons, and the signals running along them
    for (const ed of NED) {
      const A = NEU[ed.a], B = NEU[ed.b];
      if (A.o > g - 0.06 || B.o > g - 0.06) continue;
      const ax = BCX + A.x, ay = BCY + A.y, bx = BCX + B.x, by = BCY + B.y;
      lineF(ax, ay, bx, by, (x, y) => { const q = bay(x, y); if (q < 0.3) P(x, y, 27); else if (q < 0.7) P(x, y, EL[A.e][3]); });
      if (ed.on < live) {
        const ph = frac(t * ed.sp + ed.ph);
        for (let k = 4; k >= 0; k--) {
          const q = ph - k * 1.6 / ed.len;
          if (q < 0) continue;
          P(lerp(ax, bx, q), lerp(ay, by, q), k === 0 ? 27 : k < 2 ? EL[A.e][3] : EL[B.e][2]);
        }
      }
    }
    // the neurons: a bright body, a few dendrites, a flash when a signal lands
    for (const n of NEU) {
      if (n.o > g - 0.03) continue;
      const x = BCX + n.x, y = BCY + n.y, R = EL[n.e];
      for (let k = 0; k < 3; k++) { const a = n.a + k * 2.1; for (let r = 2; r <= 4; r++) if (r < 4 || k === 0) P(x + Math.cos(a) * r, y + Math.sin(a) * r, R[2]); }
      let fire = false;
      for (const ed of n.inc) if (ed.on < live && frac(t * ed.sp + ed.ph) > 0.88) fire = true;
      if (fire) { glow(x, y, 9, EL_T[n.e], 0.5); sparkle(x, y, 3, 27, R[3]); }
      else { P(x - 1, y, 0); P(x + 2, y, 0); P(x, y - 1, 0); P(x + 1, y + 2, 0); P(x, y, 27); P(x + 1, y, R[3]); P(x, y + 1, R[3]); P(x + 1, y + 1, R[2]); if (frac(t * 1.7 + n.a) < 0.2) glow(x, y, 6, EL_T[n.e], 0.4); }
    }
  }
  function drawMindParticles(t, front) {
    // four streams of element light pour in from the corners and settle into the neurons
    if (!front && t < R_T0 + 2.3) {
      const CORN = [[-30, -20], [W + 30, -20], [W + 30, H + 20], [-30, H + 20]];
      for (let i = 0; i < 320; i++) {
        const e = i & 3, n = NEU[fl(ih(i, 1, 731) * NEU.length)];
        const t0 = R_T0 + 0.1 + ih(i, 2, 731) * 1.5, u = (t - t0) / 0.75;
        if (u <= 0 || u >= 1) continue;
        const [cx, cy] = CORN[e], tx = BCX + n.x, ty = BCY + n.y, s = eic(u);
        const sw = Math.sin(u * PI) * 50 * (ih(i, 3, 731) - 0.5);
        const nx = -(ty - cy), ny = tx - cx, nl = Math.sqrt(nx * nx + ny * ny) || 1;
        const x = lerp(cx, tx, s) + nx / nl * sw, y = lerp(cy, ty, s) + ny / nl * sw;
        P(x, y, u > 0.85 ? 27 : EL[e][3]);
        const s2 = eic(u - 0.04), x2 = lerp(cx, tx, s2) + nx / nl * sw, y2 = lerp(cy, ty, s2) + ny / nl * sw;
        lineF(x2, y2, x, y, (px, py, f) => { if (f < 0.9 && bay(px, py) < 0.6) P(px, py, EL[e][2]); });
      }
    }
    // three tilted rings of light circling the mind, with beads riding them
    const on = lin(R_T0 + 1.1, R_T0 + 2.3, t);
    if (on > 0) for (let ring = 0; ring < 3; ring++) {
      const dir = ring === 1 ? -1 : 1, Rr = 136 + ring * 16, tilt = [-0.26, 0.14, 0.4][ring], c = EL[[0, 3, 2][ring]];
      const pos = (a) => { const ex = Math.cos(a) * Rr, ey = Math.sin(a) * Rr * 0.2; return [BCX + ex * Math.cos(tilt) - ey * Math.sin(tilt), BCY + 6 + ex * Math.sin(tilt) + ey * Math.cos(tilt)]; };
      for (let a = 0; a < TAU; a += 0.004) {
        if ((Math.sin(a) > 0) !== front || frac(a / TAU + ring * 0.3) > on) continue;
        const [x, y] = pos(a);
        if (bay(x, y) < (front ? 0.45 : 0.22)) P(x, y, front ? c[1] : c[0]);
      }
      for (let k = 0; k < 9; k++) {
        const a = k * TAU / 9 + t * (0.5 + ring * 0.15) * dir;
        if ((Math.sin(a) > 0) !== front || k / 9 > on) continue;
        const [x, y] = pos(a);
        for (let q = 1; q <= 6; q++) { const [tx, ty] = pos(a - dir * q * 0.012); P(tx, ty, q < 3 ? c[3] : c[2]); }
        if (front) { sparkle(x, y, 2, 27, c[3]); glow(x, y, 7, EL_T[[0, 3, 2][ring]], 0.4); } else { P(x, y, c[3]); P(x + 1, y, c[2]); }
      }
    }
    // thoughts drifting up off the crown
    if (front && t > R_T0 + 1.8) for (let i = 0; i < 50; i++) {
      const u = frac(ih(i, 1, 751) + t * 0.3), x = BCX + (ih(i, 2, 751) - 0.5) * 180 + Math.sin(u * 5 + i) * 4, y = BCY - 58 - u * 34 + Math.abs(x - BCX) * 0.25;
      if (bay(x, y) > 1 - u) continue;
      P(x, y, EL[i & 3][u < 0.5 ? 3 : 2]);
    }
  }
  // the title, built letter by letter
  const TITLE = 'FABLE 5.5';
  function drawTitle(t) {
    const t0 = R_T0 + 2.0;
    // banner
    const bu = eoc(lin(t0 - 0.35, t0, t));
    if (bu <= 0) return;
    const bw = Math.round(86 * bu), y0 = TITLE_Y - 17, y1 = TITLE_Y + 17;
    for (let y = y0; y <= y1; y++) for (let x = RCX - bw; x <= RCX + bw; x++) {
      const edge = y === y0 || y === y1 || x === RCX - bw || x === RCX + bw, edge2 = y === y0 + 2 || y === y1 - 2;
      P(x, y, edge ? 26 : edge2 ? (fl((x + t * 20) / 3) % 4 === 0 ? 49 : 47) : 63);
    }
    for (const s of [-1, 1]) { // scroll ends
      const ex = RCX + s * (bw + 5);
      if (bu < 0.95) break;
      for (let dy = -17; dy <= 17; dy++) for (let dx = -5; dx <= 5; dx++) {
        const e = (dx * dx) / 25 + (dy * dy) / 289;
        if (e > 1) continue;
        P(ex + dx, TITLE_Y + dy, e > 0.7 ? 26 : (Math.abs(dy) % 6 < 2 ? 46 : 45));
      }
      discF(ex, TITLE_Y, 2.5, EL[s < 0 ? 0 : 3][3]);
    }
    // letters
    let wsum = 0;
    for (const ch of TITLE) wsum += GLYPHS[ch].w + 2;
    wsum -= 2;
    let lx = RCX - Math.floor(wsum / 2);
    const ly = TITLE_Y - Math.floor(GH / 2);
    let li = 0;
    for (const ch of TITLE) {
      const g = GLYPHS[ch];
      if (ch !== ' ') {
        const ta = t0 + 0.1 + li * 0.17, u = (t - ta) / 0.3;
        if (u > 0) {
          const e = li < 5 ? li % 4 : li === 5 || li === 7 ? 3 : 2;
          const drop = Math.round(u < 1 ? (1 - eob(u)) * -6 : 0);
          // shadow, outline, fill
          for (let y = -1; y <= GH; y++) for (let x = -1; x <= g.w; x++) {
            const m = (xx, yy) => xx >= 0 && xx < g.w && yy >= 0 && yy < GH && g.m[yy * g.w + xx];
            const X = lx + x, Y = ly + y + drop;
            if (m(x, y)) {
              const reveal = ih(x, y, 551 + li) < u * 1.6 + (y / GH) * 0.2;
              if (!reveal) continue;
              let c = y < 7 ? 27 : y < 12 ? 26 : EL[e][3];
              if (y >= 15) c = EL[e][2];
              if (!m(x - 1, y) && y < 12) c = 27;
              if (!m(x, y + 1) && y > 9) c = EL[e][1];
              if (u < 0.6 && ih(x, y, 552) < 0.4) c = 27;
              P(X, Y, c);
            } else if (m(x - 1, y) || m(x + 1, y) || m(x, y - 1) || m(x, y + 1)) { if (u > 0.3) P(X, Y, 0); }
            else if ((m(x - 1, y - 1) || m(x - 2, y - 2)) && u > 0.5) P(X, Y, EL[e][0]);
          }
          if (u > 0.6 && u < 1.6) sparkle(lx + g.w - 2, ly + 2 + drop, 4 * Math.sin(PI * (u - 0.6)), 27, EL[e][3]);
        }
        li++;
      }
      lx += g.w + 2;
    }
  }
  function drawReveal(t) {
    drawRevealBg(t);
    tintRect(0, 0, W - 1, H - 1, T_DARK, 0.38);
    glow(BCX, BCY, 160, T_VI, 0.34 * lin(R_T0 + 0.5, R_T0 + 2, t), 1);
    drawMindParticles(t, false);
    drawBrain(t);
    drawMindParticles(t, true);
    drawTitle(t);
    // the hero, small and proud beneath it
    let hy = 0, sx = 1, sy = 1;
    const jt = R_T0 + 0.55;
    if (t > jt && t < jt + 0.35) { const u = (t - jt) / 0.35; hy = 14 * 4 * u * (1 - u); sy = 1.15; sx = 0.9; }
    if (t >= jt + 0.35 && t < jt + 0.53) { const q = (t - jt - 0.35) / 0.18, a = Math.sin(PI * q) * 0.3; sx = 1 + a; sy = 1 - a; }
    const HX = RCX - 2, HY = 252;
    drawHero(HX, HY - Math.round(hy), { sx, sy, legK: frac(t / 0.9) > 0.5 ? 0.8 : 1, eyeDX: 0, happy: t > R_T0 + 2.5 && frac(t / 2.4) > 0.6, blink: frac(t / 2.7) < 0.05, sword: true, ang: -70 * D2R, blade: [EL[0][3], EL[1][3], EL[2][3], EL[3][3]], t });
    const g = 0.5 + 0.5 * Math.sin(t * 4);
    sparkle(HX + 24, HY - 50 - Math.round(hy), 2 + g * 2, 27, 44);
    // the small print
    const s = 'Unofficial fan concept · not affiliated with Anthropic', w = miniWidth(s);
    const tf = R_T0 + 3.1;
    if (t > tf) miniText(s, RCX - fl(w / 2), 262, 9, (k) => clamp((t - tf - k * 0.5) / 0.4, 0, 1));
    // dissolve from white at the start
    if (t < R_T0 + 0.75) { const R = 300 * eic(lin(R_T0 + 0.02, R_T0 + 0.75, t)); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const dx = x + 0.5 - BCX, dy = (y + 0.5 - BCY) * 1.4, d = Math.sqrt(dx * dx + dy * dy) - bay(x, y) * 22; if (d > R) BUF[y * W + x] = d < R + 5 ? 25 : 27; } }
  }

  /* ================================================================ hero choreography */
  const HXK = [
    [0, -16], [1.9, -16], [2.15, 9, 'l'],
    [3.0, 9], [3.95, 196],
    [4.32, 196], [4.62, 172, 'o'],
    [4.72, 172], [4.84, 192, 'o'],
    [5.40, 192], [5.62, 204, 'l'],
    [6.9, 204], [7.95, 385],
    [8.6, 385], [8.8, 372, 'o'],
    [9.05, 372], [9.15, 376], [10.15, 376], [10.65, 452, 'l'],
    [11.6, 452], [12.4, 600],
    [13.75, 600], [14.0, 625, 'l'],
    [14.15, 625], [14.7, 690, 'l'],
    [15.7, 690], [16.6, 820],
    [20.6, 820], [20.92, 792], [21.0, 792], [21.42, 842], [21.5, 842], [21.92, 802], [22.0, 802], [22.38, 828], [22.6, 820],
    [23.55, 820], [24.3, 804, 'o'],
    [24.7, 804], [25.0, 1024, 'o'], [25.62, 1034], [25.78, 1036], [26.2, 940, 'l'],
  ];
  const JUMPS = [
    [1.9, 2.15, 10], [4.32, 4.62, 15], [4.72, 4.84, 3], [5.40, 5.62, 18], [8.6, 8.8, 6], [10.15, 10.65, 50],
    [13.08, 13.48, 26], [13.75, 14.0, 9], [14.15, 14.7, 74], [18.98, 19.42, 32], [19.86, 20.3, 32],
    [20.62, 20.92, 7], [21.0, 21.42, 10], [21.5, 21.92, 9], [22.0, 22.38, 8],
  ];
  const COMBOH = [[24.7, 0], [25.0, 118, 'o'], [25.15, 122], [25.3, 118], [25.45, 124], [25.62, 128, 'o'], [25.8, 130], [26.2, 0, 'i']];
  const FALL0 = 1.02, FALL1 = 1.35;
  function heroH(t) {
    if (t < FALL1) { const u = clamp((t - FALL0) / (FALL1 - FALL0), 0, 1); return 300 * (1 - u * u); }
    if (t > 24.7 && t < 26.2) return kf(COMBOH, t);
    let h = 0;
    for (const j of JUMPS) if (t > j[0] && t < j[1]) { const u = (t - j[0]) / (j[1] - j[0]); h += 4 * j[2] * u * (1 - u); }
    return h;
  }
  const LANDS = JUMPS.map((j) => [j[1], j[2]]).concat([[FALL1, 60], [26.2, 60]]);
  const TAKEOFFS = JUMPS.map((j) => [j[0], j[2]]).concat([[24.7, 60]]);
  // sword swings: start, duration, from, to (radians, screen space, + is clockwise), element (-1 plain), big
  const D2R = PI / 180;
  const SWINGS = [
    [4.76, 0.11, -140, 50, -1, 0], [5.47, 0.12, -150, 65, -1, 1],
    [9.2, 0.1, 60, -115, -1, 0], [9.6, 0.1, -125, 45, -1, 0],
    [10.33, 0.12, -150, 70, 0, 1],
    [14.36, 0.12, 85, -125, 1, 1],
    [24.98, 0.1, -150, 50, 0, 1], [25.16, 0.1, 60, -130, 1, 1], [25.34, 0.1, -150, 60, 2, 1], [25.56, 0.2, -100, 260, 3, 1],
  ];
  const HFLASH = [[8.6, 8.76], [23.56, 24.28]];
  const REST = -52 * D2R;
  function swordAngle(t) {
    // poses
    if (t >= 2.6 && t < 2.98) return -90 * D2R;
    if (t >= 23.35 && t < 24.3) return lerp(REST, -18 * D2R, sstep(23.35, 23.5, t));
    if (t >= 24.3 && t < 24.72) return lerp(-18 * D2R, -90 * D2R, sstep(24.3, 24.5, t));
    if (t >= 28.2 && t < 31) return lerp(REST, -90 * D2R, sstep(28.2, 28.5, t));
    if (t >= 31) return -70 * D2R;
    for (const s of SWINGS) {
      const t0 = s[0], d = s[1];
      if (t >= t0 - 0.07 && t < t0) return lerp(REST, s[2] * D2R, sstep(t0 - 0.07, t0, t));
      if (t >= t0 && t < t0 + d) return lerp(s[2], s[3], eoc((t - t0) / d)) * D2R;
      if (t >= t0 + d && t < t0 + d + 0.22) return lerp(s[3] * D2R, REST, sstep(t0 + d + 0.08, t0 + d + 0.22, t));
    }
    return REST + Math.sin(t * 3) * 0.06;
  }
  function heroPose(t) {
    const x = kf(HXK, t), h = heroH(t);
    const v = (kf(HXK, t + 0.01) - kf(HXK, t - 0.01)) / 0.02;
    let sx = 1, sy = 1, bob = 0, lift = [0, 0, 0, 0], legK = 1;
    const air = h > 0.5;
    if (air) {
      const dh = (heroH(t + 0.01) - heroH(t - 0.01)) / 0.02, s = clamp(Math.abs(dh) / 260, 0, 1);
      sy = 1 + 0.22 * s; sx = 1 - 0.1 * s; lift = [0, 1, 1, 0];
    } else if (Math.abs(v) > 12) {
      const p = frac(t / 0.3), sn = Math.sin(p * TAU);
      lift = [Math.round(Math.max(0, sn) * 2), Math.round(Math.max(0, -sn) * 2), Math.round(Math.max(0, -sn) * 2), Math.round(Math.max(0, sn) * 2)];
      bob = Math.round(Math.abs(sn) * 1.6);
    } else {
      if (frac(t / 0.9) > 0.5) legK = 0.8;
    }
    for (const [t0, pk] of TAKEOFFS) if (t > t0 - 0.08 && t <= t0) { const a = Math.sin(PI * (t - (t0 - 0.08)) / 0.08) * Math.min(0.3, pk / 60); sx = 1 + a; sy = 1 - a; }
    for (const [t1, pk] of LANDS) if (t > t1 && t < t1 + 0.18) { const q = (t - t1) / 0.18, a = Math.sin(PI * q) * (1 - q * 0.3) * Math.min(0.42, 0.12 + pk / 100); sx = 1 + a; sy = 1 - a; }
    // pulling the sword: strain
    if (t > 2.15 && t < 2.6) { const s = sstep(2.15, 2.5, t); sy = 1 + 0.12 * s; sx = 1 - 0.06 * s; }
    if (t >= 2.6 && t < 2.98) { sy = 1.12; sx = 0.94; }
    if (t >= 28.2 && t < 31) { const s = sstep(28.2, 28.5, t); sy = 1 + 0.1 * s; sx = 1 - 0.05 * s; }
    if (t > 23.5 && t < 24.3) { sx = 1.12; sy = 0.9; lift = [0, 0, 0, 0]; }
    let flash = false;
    for (const f of HFLASH) if (t >= f[0] && t < f[1]) flash = fl(t * 30) % 2 === 0;
    let eyeDX = 1, blink = frac(t / 2.7 + 0.3) < 0.05, happy = false;
    if (t > 1.5 && t < 1.75) eyeDX = -1;
    if (t >= 2.62 && t < 2.98) happy = true;
    if (t > 8.6 && t < 8.95) blink = true;
    if (t > 31.2) happy = frac(t / 2.2) > 0.75;
    const shake = (t > 2.15 && t < 2.6) ? (fl(t * 40) % 2) : 0;
    return { x, h, sx, sy, bob, lift, legK, flash, eyeDX, blink, happy, shake };
  }
  function bladeColours(t) {
    if (t >= 24.55 && t < 26.4) return [35, 36, 39, 40, 43, 44, 48, 49];
    for (const [t0, e] of SURGES) if (t >= t0 && t < t0 + 0.9) return [EL[e][1], EL[e][2], EL[e][3], 27];
    return null;
  }
  function drawHeroAt(t) {
    const p = heroPose(t);
    const X = sxw(p.x) + p.shake, Y = syw(p.h) - p.bob;
    const sword = t >= 2.6;
    const ang = swordAngle(t);
    const blade = bladeColours(t);
    if (blade) glow(X + 26, Y - 26, 32, T_WH, 0.25 + 0.1 * Math.sin(t * 30));
    if (t > FALL0 && t < FALL1) for (let k = -1; k <= 1; k++) for (let q = 0; q < 26; q++) if (bay(X + k * 9, Y - 30 - q) < 1 - q / 26) P(X + k * 9, Y - 26 - q, k ? 30 : 27);
    const g = drawHero(X, Y, { sx: p.sx, sy: p.sy, lift: p.lift, legK: p.legK, flash: p.flash, eyeDX: p.eyeDX, blink: p.blink, happy: p.happy, sword, ang, blade, t });
    const pvx = X + g.piv[0], pvy = Y + g.piv[1];
    // smear
    for (const s of SWINGS) {
      const t0 = s[0], d = s[1];
      if (t < t0 || t > t0 + d + 0.09) continue;
      const tNow = Math.min(t, t0 + d), tOld = Math.max(t0, t - 0.1);
      const aN = lerp(s[2], s[3], eoc((tNow - t0) / d)) * D2R, aO = lerp(s[2], s[3], eoc((tOld - t0) / d)) * D2R;
      drawSmear(pvx, pvy, aO, aN, s[4], s[5]);
      if (s[4] >= 0 && t > 24.5) { // empowered: extra coloured echo trails
        for (let e = 0; e < 3; e++) if (e !== s[4]) drawSmear(pvx + (e - 1) * 2, pvy + (e - 1), aO - 0.25, aO, e, 0);
      }
    }
    return { X, Y, g, pvx, pvy, ang };
  }
  // landing dust and the little coral pop when the hero lands
  function drawHeroFx(t) {
    for (const [t1, pk] of LANDS) {
      if (t < t1 || t > t1 + 0.6 || pk < 8) continue;
      const x = sxw(kf(HXK, t1)), y = syw(0);
      drawDust(x, y, t1, t, pk > 40 ? 10 : 6, pk > 40 ? 26 : 16, 300 + fl(t1 * 10));
      if (t1 === FALL1) { drawBurst(x, y - 10, (t - t1) / 0.45, 40, 12, 0.13, [30, 27], 1.3); drawBurst(x, y - 10, (t - t1 - 0.04) / 0.45, 30, 12, 0.39, [32, 32], 1.0); }
    }
  }

  /* ================================================================ orbs */
  const ORBS = [
    { e: 0, src: [212, 12], rise: [5.9, 6.6], join: [6.6, 7.1] },
    { e: 1, src: [466, 44], rise: [10.7, 11.25], join: [11.25, 11.75] },
    { e: 2, src: [700, 72], rise: [14.8, 15.3], join: [15.3, 15.8] },
    { e: 3, src: [1070, 140], rise: [26.5, 27.1], join: [27.1, 27.6] },
  ];
  function orbPhase(t) { return 2.4 * t + (t > 27 ? 1.35 * Math.pow(t - 27, 3) : 0); }
  function orbit(t) { // per orb: {x, y, d (depth), s (scale), e}
    const hp = heroPose(t), hx = sxw(hp.x), hy = syw(hp.h) - 14;
    const out = [];
    let nPrev = 0;
    for (let k = 0; k < ORBS.length; k++) if (t >= ORBS[k].join[0]) nPrev = k + 1;
    const lastJ = nPrev ? ORBS[nPrev - 1].join : null, ej = lastJ ? eio(lin(lastJ[0], lastJ[1], t)) : 1;
    let rx = 25, ry = 8;
    if (t > 27.6) { const s = sstep(27.6, 28.6, t); rx = lerp(25, 31, s); ry = lerp(8, 10, s); }
    for (let k = 0; k < ORBS.length; k++) {
      const O = ORBS[k];
      if (t < O.rise[0]) continue;
      const sx0 = sxw(O.src[0]), sy0 = syw(O.src[1]);
      // rising from where the enemy fell
      const ur = eoc(lin(O.rise[0], O.rise[1], t));
      let x = sx0, y = sy0 - ur * 26 + Math.sin(t * 5) * 1.5, s = Math.min(1, lin(O.rise[0], O.rise[0] + 0.25, t) * 1.4);
      if (ur < 1 && t < O.rise[1]) s = Math.min(s, 0.2 + ur * 1.2);
      // orbit slot
      const n = nPrev, ph = orbPhase(t);
      let slot;
      if (k < n - 1) slot = lerp(k * TAU / Math.max(1, n - 1), k * TAU / n, ej); else slot = k * TAU / Math.max(1, n);
      const a = ph + slot;
      let ox = hx + Math.cos(a) * rx, oy = hy + Math.sin(a) * ry + Math.sin(t * 2 + k) * 1.2, d = Math.sin(a);
      if (t >= O.join[0]) {
        const u = eio(lin(O.join[0], O.join[1], t));
        x = lerp(x, ox, u); y = lerp(y - Math.sin(PI * u) * 14, oy, u); s = 1;
      } else d = -1;
      // the shield against the eye beam, then into the sword
      if (k < 3 && t >= 23.3 && t < 26.7) {
        const th0 = Math.atan2(-0.6, 0.8), sa = th0 + (k - 1) * 0.6;
        const sh = [hx + Math.cos(sa) * 31, hy + Math.sin(sa) * 31];
        const u1 = eio(lin(23.3, 23.5, t));
        x = lerp(x, sh[0], u1) + Math.sin(t * 40 + k) * (t > 23.55 && t < 24.3 ? 1 : 0); y = lerp(y, sh[1], u1);
        if (t >= 24.3) {
          const hp2 = heroPose(t), sw = swordAngle(t), tipx = sxw(hp2.x) + 16 + Math.cos(sw) * 13 * SS, tipy = syw(hp2.h) - 14 + Math.sin(sw) * 13 * SS;
          const u2 = eic(lin(24.3, 24.58, t));
          x = lerp(x, tipx, u2); y = lerp(y, tipy, u2); s = 1 - u2;
          if (t >= 26.25) { const u3 = eoc(lin(26.25, 26.7, t)); x = lerp(tipx, ox, u3); y = lerp(tipy, oy, u3); s = u3; }
        }
        d = 1;
      }
      // the finale: climbing the sword into a braid of light
      if (t > 28.7) {
        const u = eic(lin(28.7, 29.5, t));
        y -= u * 160; s *= 1 - u;
      }
      out.push({ x, y, d, s, e: O.e, k });
    }
    return out;
  }
  function drawOrbs(t, front) {
    const L = orbit(t);
    for (const o of L) {
      if ((o.d >= 0) !== front || o.s <= 0.02) continue;
      // trail: sample the same function slightly in the past
      if (t > ORBS[o.k].join[0] + 0.2) {
        const nt = t > 27.3 && t < 29.6 ? 14 : 4, dt = t > 27.3 && t < 29.6 ? 0.012 : 0.03;
        let px = o.x, py = o.y;
        for (let q = 1; q <= nt; q++) {
          const pv = orbit(t - q * dt).find((p) => p.k === o.k);
          if (!pv || pv.s < 0.3) break;
          const f = q / nt;
          lineF(px, py, pv.x, pv.y, (x, y) => { if (bay(x, y) < 1 - f * 0.8) P(x, y, EL[o.e][f < 0.3 ? 3 : f < 0.6 ? 2 : 1]); });
          px = pv.x; py = pv.y;
        }
      }
      drawOrb(o.x, o.y, o.e, t, o.s);
    }
  }

  /* ================================================================ power-ups */
  // each element the hero takes is a power-up: a surge as the orb arrives, then an elemental special on the next big hits
  const SURGES = ORBS.slice(0, 3).map((o) => [o.join[1] - 0.05, o.e]);
  const SPECIALS = [ // time, element, kind
    [10.33, 0, 'wave'], [14.36, 1, 'leaves'],
    [B_HITS[0], 0, 'wave'], [B_HITS[1], 1, 'leaves'], [B_HITS[2], 2, 'bolt'], [B_HITS[3], 3, 'nova'],
  ];
  function drawSurge(t, front) {
    for (const [t0, e] of SURGES) {
      const u = (t - t0) / 0.75;
      if (u <= 0 || u >= 1) continue;
      const hp = heroPose(t), hx = sxw(hp.x), hy = syw(hp.h) - 12, gy = syw(0);
      const R = EL[e];
      if (!front) {
        glow(hx, hy, 44, EL_T[e], 0.75 * (1 - u));
        // a column of light that rises off the ground and fades
        const ch = 70 * eoc(u);
        for (let y = fl(gy - ch); y <= gy; y++) for (let q = -14; q <= 14; q++) {
          const f = Math.abs(q) / 14, a = (1 - f) * (1 - u) * (0.4 + 0.6 * (y - (gy - ch)) / (ch + 1));
          if (bay(hx + q, y) < a * 0.6) P(hx + q, y, f < 0.3 ? R[3] : R[2]);
        }
        return;
      }
      // two rings rushing outward along the ground, and one around the body
      for (const [rr, c] of [[8 + 56 * eoc(u), R[3]], [6 + 40 * eoc(u), 27], [4 + 24 * eoc(u), R[2]]]) for (let a = 0; a < TAU; a += 0.015) {
        const x = hx + Math.cos(a) * rr, y = gy + Math.sin(a) * rr * 0.2;
        if (bay(x, y) < 1 - u) P(x, y, c);
      }
      for (let a = 0; a < TAU; a += 0.03) { const rr = 10 + 18 * eoc(u); const x = hx + Math.cos(a) * rr, y = hy + Math.sin(a) * rr * 0.9; if (bay(x, y) < (1 - u) * 0.8) P(x, y, R[2]); }
      // the element itself, rising: droplets, leaves or sparks
      for (let i = 0; i < 40; i++) {
        const lf = frac(ih(i, 1, 951 + e) + u * 1.3), x = hx + (ih(i, 2, 951) - 0.5) * 40 + Math.sin(lf * 6 + i) * 3, y = gy - 4 - lf * 54;
        if (lf > 1 - u * 0.2 || ih(i, 3, 951) > 1 - u * 0.4 + 0.4) continue;
        if (e === 0) { P(x, y, R[3]); P(x, y + 1, R[2]); }
        else if (e === 1) { P(x, y, R[3]); P(x + 1, y - 1, R[2]); P(x - 1, y + 1, R[1]); }
        else { P(x, y, 27); P(x - 1, y, R[3]); P(x + 1, y, R[3]); P(x, y - 1, R[2]); }
      }
      // power-up chevrons climbing above the head
      for (let k = 0; k < 3; k++) {
        const v = u * 1.6 - k * 0.22;
        if (v <= 0 || v >= 1) continue;
        const cy = hy - 22 - v * 26;
        for (let q = -6; q <= 6; q++) { const yy = cy + Math.abs(q); P(hx + q, yy, v < 0.6 ? 27 : R[3]); P(hx + q, yy + 1, R[3]); P(hx + q, yy + 2, R[2]); }
      }
    }
  }
  function specialAt(sp) {
    if (sp[0] === 10.33) { const p = spritePos(10.43); return [sxw(p[0]), syw(p[1])]; }
    if (sp[0] === 14.36) { const p = wispPos(14.48); return [sxw(p[0]), syw(p[1])]; }
    const tip = swordTip(sp[0] + 0.05); return [tip[0] + 8, tip[1]];
  }
  function drawSpecials(t) {
    for (const sp of SPECIALS) {
      const [t0, e, kind] = sp, dur = kind === 'nova' ? 0.8 : 0.6, u = (t - t0) / dur;
      if (u <= 0 || u >= 1) continue;
      const [cx, cy] = specialAt(sp), R = EL[e];
      if (kind === 'wave') { // a crown of water bursting outward and falling back
        glow(cx, cy, 46, T_BL, 0.6 * (1 - u));
        for (let k = 0; k < 2; k++) { const rr = 6 + (34 + k * 14) * eoc(u); for (let a = 0; a < TAU; a += 0.025) { const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr * 0.55; if (bay(x, y) < 1 - u) P(x, y, k ? R[2] : R[3]); } }
        for (let i = 0; i < 30; i++) {
          const a = -PI * (0.05 + 0.9 * ih(i, 1, 961)), v = 40 + ih(i, 2, 961) * 50;
          const x = cx + Math.cos(a) * v * u, y = cy + Math.sin(a) * v * u + 70 * u * u;
          if (ih(i, 3, 961) < u) continue;
          P(x, y, R[3]); P(x, y + 1, R[2]); P(x, y - 1, 27);
        }
      } else if (kind === 'leaves') { // a whirlwind of leaves spiralling up around the target
        glow(cx, cy, 44, T_GR, 0.55 * (1 - u));
        for (let i = 0; i < 34; i++) {
          const a = i * TAU / 34 + u * 10 + ih(i, 1, 971), rr = 6 + (18 + ih(i, 2, 971) * 18) * eoc(u), lift = u * 26 * ih(i, 3, 971);
          const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr * 0.45 - lift;
          if (bay(x, y) < u * 0.9) continue;
          const sx = Math.cos(a + 1) > 0 ? 1 : -1;
          P(x, y, R[3]); P(x + sx, y - 1, R[2]); P(x - sx, y + 1, R[1]); if (i % 5 === 0) P(x, y - 1, 27);
        }
      } else if (kind === 'bolt') { // a bolt called down from the sky
        if (u < 0.45) {
          const fr = fl(t * 30);
          drawBolt(cx + (ih(fr, 1, 981) - 0.5) * 30, 0, cx, cy, fr, 2, 27, 43);
          if (fr % 2) drawBolt(cx + (ih(fr, 2, 981) - 0.5) * 60, 0, cx + (ih(fr, 3, 981) - 0.5) * 12, cy, fr + 7, 1, 44, 42);
          glow(cx, cy, 90, T_YE, 0.7 * (1 - u / 0.45));
        }
        for (let i = 0; i < 24; i++) { const a = ih(i, 1, 982) * TAU, r = 50 * eoc(u) * (0.4 + ih(i, 2, 982)); if (ih(i, 3, 982) < u) continue; sparkle(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 1 + (i % 3 === 0 ? 1 : 0), 27, R[3]); }
      } else { // nova: every element at once
        glow(cx, cy, 120 * eoc(u) + 20, T_WH, 0.6 * (1 - u));
        for (let k = 0; k < 4; k++) {
          drawBurst(cx, cy, clamp(u * 1.2 - k * 0.08, 0, 1), 60 + k * 22, 10 + k * 2, k * 0.4, [EL[k][3], EL[k][2]], 1.4 - k * 0.15);
          const rr = (20 + k * 18) * eoc(clamp(u * 1.3 - k * 0.1, 0, 1));
          for (let a = 0; a < TAU; a += 0.012) { const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr; if (bay(x, y) < 1 - u) P(x, y, EL[k][3]); }
        }
      }
    }
  }

  function drawFinaleFx(t) {
    if (t < 27.3 || t > 31) return;
    const hp = heroPose(t), hx = sxw(hp.x), gy = syw(0);
    const g = eoc(lin(27.3, 28.2, t)), R = 44 * g;
    // a rune circle turning on the ground
    for (let a = 0; a < TAU; a += 0.01) {
      const rot = a + t * 1.6;
      for (const [rr, c0] of [[R, 1], [R * 0.72, 0]]) {
        const x = hx + Math.cos(rot) * rr, y = gy + 1 + Math.sin(rot) * rr * 0.18;
        const k = fl(mod(a / TAU * 4 + (c0 ? 0 : 0.5), 4));
        if (rr === R || mod(a * 24, 1) < 0.5) P(x, y, EL[k][c0 ? 3 : 2]);
      }
    }
    for (let k = 0; k < 16; k++) { const a = k * TAU / 16 - t * 2.2, x = hx + Math.cos(a) * R * 0.86, y = gy + 1 + Math.sin(a) * R * 0.86 * 0.18; if (g > 0.5) { P(x, y, 27); P(x + 1, y, EL[k & 3][3]); } }
    glow(hx, gy, R + 8, T_WH, 0.18 * g);
    // motes from the whole forest drawn in along inward spirals
    for (let i = 0; i < 90; i++) {
      const life = frac(ih(i, 1, 311) + (t - 27.3) * (0.55 + ih(i, 2, 311) * 0.4));
      if (t - 27.3 < life * 1.2) continue;
      const r = (1 - life) * (120 + ih(i, 3, 311) * 140) + 6, a = ih(i, 4, 311) * TAU + life * 5.5;
      const x = hx + Math.cos(a) * r, y = gy - 14 + Math.sin(a) * r * 0.55;
      P(x, y, life > 0.85 ? 27 : EL[i & 3][life > 0.5 ? 3 : 2]);
    }
  }

  /* ================================================================ intro: burst, iris, sword in the stone */
  const STONE_X = 36, SWORD_X = 28;
  function drawStone(t) {
    const x = sxw(STONE_X), y = syw(0);
    // stone: a mossy boulder with faint runes
    for (let dy = -10; dy <= 0; dy++) for (let dx = -11; dx <= 11; dx++) {
      const e = (dx * dx) / 121 + ((dy + 1) * (dy + 1)) / 100;
      if (e > 1) continue;
      const l = 0.55 - dx * 0.03 - dy * 0.02 - e * 0.3 + (ih(dx + 40, dy + 40, 221) - 0.5) * 0.15;
      let c = l > 0.62 ? 62 : l > 0.45 ? 60 : l > 0.3 ? 59 : 58;
      if (dy < -6 + Math.sin(dx * 0.9) * 1.5 && e > 0.25) c = dx < 0 ? 15 : 14;
      if (e > 0.86) c = 1;
      P(x + dx, y + dy, c);
    }
    const rg = 0.5 + 0.5 * Math.sin(t * 3);
    for (const [rx, ry] of [[-6, -4], [-5, -3], [-4, -4], [4, -3], [5, -4], [6, -3], [0, -2]]) P(x + rx, y + ry, rg > 0.5 ? 48 : 47);
    glow(x, y - 4, 12, T_VI, 0.18 * rg);

    // stone chips on the pull
    if (t > 2.6 && t < 3.2) {
      for (let i = 0; i < 8; i++) {
        const u = t - 2.6, vx = (ih(i, 1, 222) - 0.5) * 70, vy = -40 - ih(i, 2, 222) * 60;
        const px = x + vx * u, py = y - 10 + vy * u + 260 * u * u;
        if (py < y) P(px, py, i % 2 ? 60 : 59);
      }
    }
  }
  function drawStoneSword(t) { // drawn in front of the hero, so the grip reads in its arm nub
    if (t >= 2.6) return;
    const x = sxw(SWORD_X), y = syw(0);
    const rise = t > 2.15 ? Math.round(eic(lin(2.2, 2.6, t)) * 6) : 0;
    const jig = t > 2.15 && t < 2.6 ? (fl(t * 40) % 2) : 0;
    drawSwordAt(x + jig, y - 22 - rise, PI / 2, y - 7);
    // the glint before the pull
    if (t > 1.55 && t < 2.0) {
      const u = (t - 1.55) / 0.45, gy = y - 20 + u * 10;
      P(x, gy, 27); P(x + 1, gy, 27);
      if (u > 0.1 && u < 0.9) sparkle(x, y - 27, 5 * Math.sin(PI * (u - 0.1) / 0.8), 27, 44);
    }
  }
  function drawIntroOverlay(t) {
    // black screen with a coral starburst that opens onto the forest
    const R = t < 0.55 ? 0 : 330 * eic(lin(0.55, 1.3, t)) + 4 * lin(0.55, 0.6, t);
    if (t >= 1.3) return;
    const cx = 240, cy = 128, R2 = R * R;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const dx = x + 0.5 - cx, dy = (y + 0.5 - cy), d2 = dx * dx + dy * dy;
      if (d2 > R2) BUF[y * W + x] = C.CHAR;
      else if (d2 > (R - 3) * (R - 3)) BUF[y * W + x] = d2 > (R - 1.5) * (R - 1.5) ? 30 : 28;
    }
    // the reference-style fireworks: a dark burst behind, the coral burst on top, two small ones
    const u = (t - 0.12) / 0.95;
    drawBurst(cx, cy, u * 1.05, 120, 16, 0.1, [32, 32], 3.2);
    drawBurst(cx, cy, u, 96, 12, 0.36, [28, 30], 2.6);
    drawBurst(cx - 150, cy - 70, (t - 0.32) / 0.7, 40, 10, 0.5, [28, 30], 1.4);
    drawBurst(cx + 160, cy + 50, (t - 0.42) / 0.7, 34, 10, 0.2, [28, 30], 1.3);
    drawBurst(cx + 120, cy - 90, (t - 0.5) / 0.7, 22, 9, 0.7, [32, 32], 1.1);
    if (t > 0.1 && t < 0.3) discF(cx, cy, 10 * Math.sin(PI * (t - 0.1) / 0.2), 30);
  }

  /* ================================================================ enemy 1: the water slime */
  const SLX = [[3.3, 390], [3.62, 335, 'l'], [3.9, 280, 'l'], [4.3, 280], [4.55, 206, 'l'], [4.86, 206], [5.1, 232, 'o'], [5.35, 232], [5.6, 214, 'l']];
  const SLJ = [[3.3, 3.62, 24], [3.62, 3.9, 14], [4.3, 4.55, 20], [4.86, 5.1, 9], [5.35, 5.6, 16]];
  const SL_BURST = 5.6;
  function hopH(J, t) { for (const j of J) if (t > j[0] && t < j[1]) { const u = (t - j[0]) / (j[1] - j[0]); return 4 * j[2] * u * (1 - u); } return 0; }
  function hopSquash(J, t) {
    for (const j of J) {
      if (t > j[0] - 0.1 && t <= j[0]) return 1 - 0.3 * Math.sin(PI * (t - j[0] + 0.1) / 0.1);
      if (t > j[1] && t < j[1] + 0.16) return 1 - 0.32 * Math.sin(PI * (t - j[1]) / 0.16);
      if (t > j[0] && t < j[1]) return 1.15;
    }
    return 1;
  }
  function drawSlime(t) {
    if (t < 3.3 || t > 7.2) return;
    const wx = kf(SLX, t), h = hopH(SLJ, t);
    const X = sxw(wx), Y = syw(h);
    if (t < SL_BURST) {
      let sq = hopSquash(SLJ, t);
      if (t > 4.05 && t < 4.3) sq = 0.78 + Math.sin(t * 90) * 0.04;           // wind-up quiver
      if (t > 4.86 && t < 5.0) sq = 0.75;
      const wob = Math.sin(t * 9) * 0.04, w = 30 / Math.sqrt(sq) * (1 + wob), hh = 19 * sq * (1 - wob);
      const flash = t > 4.86 && t < 4.98 && fl(t * 30) % 2 === 0;
      const angry = t > 5.05 && t < 5.4, jx = angry ? (fl(t * 30) % 2) : 0;
      glow(X, Y - hh / 2, 20, T_BL, 0.25);
      const bodyL = (X, Y) => {
        for (let dy = -Math.ceil(hh) - 1; dy <= 0; dy++) for (let dx = -Math.ceil(w / 2) - 1; dx <= Math.ceil(w / 2) + 1; dx++) {
          const u = (dx + 0.5) / (w / 2), v = (dy + 0.5) / hh;
          const e = Math.pow(Math.abs(u), 2.3) + Math.pow(Math.abs(v + (v < -0.0 ? 0 : 0)), 2) * (v < 0 ? 1 : 0);
          if (e > 1 || v > 0.05) continue;
          let c;
          if (flash) c = e > 0.82 ? 25 : 27;
          else {
            const l = 0.5 - u * 0.25 - v * -0.1 + (v < -0.6 ? 0.15 : 0);
            c = e > 0.8 ? 33 : l > 0.62 ? 35 : 34;
            const bub = frac(t * 0.9 + ih(fl(dx / 3) + 9, 1, 231)) ;
            if (ih(dx + 20, fl(dy - t * 20), 232) < 0.025 && e < 0.6) c = 35;
            if (u < -0.25 && u > -0.55 && v < -0.55 && v > -0.85) c = 36;
            if (u > -0.5 && u < -0.38 && v < -0.62 && v > -0.78) c = 27;
            if (bub < 0) c = 34;
          }
          P(X + dx + jx, Y + dy, c);
        }
        // face
        const look = kf(HXK, t) < wx ? -1 : 1, ey = Math.round(Y - hh * 0.55);
        if (!flash) {
          const ex = X + jx + look * 2;
          if (angry) { rectF(ex - 8, ey - 3, 3, 1, 61); rectF(ex - 6, ey - 2, 2, 1, 61); rectF(ex + 5, ey - 3, 3, 1, 61); rectF(ex + 4, ey - 2, 2, 1, 61); }
          rectF(ex - 7, ey, 3, 4, 61); rectF(ex + 4, ey, 3, 4, 61); P(ex - 7, ey, 27); P(ex + 4, ey, 27);
          rectF(ex - 2, ey + 4, 4, 1, 33); P(ex - 3, ey + 3, 33); P(ex + 2, ey + 3, 33);
        }
      };
      PEN = 0; bodyL(X - 1, Y); bodyL(X + 1, Y); bodyL(X, Y - 1); bodyL(X, Y + 1); PEN = -1; bodyL(X, Y);
      if (t > 4.3 && t < 4.6 && h < 2) drawDust(X, Y, 4.55, t, 6, 16, 241);
    }
    // the burst into droplets, a puddle that steams away
    if (t >= SL_BURST) {
      const u = t - SL_BURST;
      // crown splash
      if (u < 0.4) for (let k = -6; k <= 6; k++) {
        const hgt = Math.round((14 + ih(k + 9, 5, 233) * 16) * Math.sin(PI * u / 0.4) * (1 - Math.abs(k) / 8)), cx = X + k * 2.6 * (1 + u * 3);
        for (let q = 0; q < hgt; q++) P(cx, Y - q, q > hgt - 3 ? 36 : (k + q) % 3 ? 35 : 34);
        if (hgt > 2) { P(cx, Y - hgt - 1, 27); }
      }
      for (let i = 0; i < 44; i++) {
        const vx = (ih(i, 1, 233) - 0.5) * 190, vy = -60 - ih(i, 2, 233) * 150, g = 340;
        let x = X + vx * u, y = Y - 8 + vy * u + g * u * u;
        const tl = (-vy + Math.sqrt(vy * vy + 4 * g * 8)) / (2 * g);
        if (u > tl) { // landed: splash ring then gone
          x = X + vx * tl; y = Y;
          const v2 = (u - tl) / 0.25;
          if (v2 < 1) { P(x - 1 - v2 * 2, Y - 1, 36); P(x + 1 + v2 * 2, Y - 1, 36); }
          continue;
        }
        const big = ih(i, 4, 233) < 0.4;
        P(x, y, 36); P(x + 1, y, 35); P(x, y + 1, 34); if (big) { P(x + 1, y + 1, 34); P(x - 1, y, 35); P(x, y - 1, 36); }
        if (ih(i, 3, 233) < 0.4) P(x, y - 1 - (big ? 1 : 0), 27);
      }
      if (u < 0.9) {
        const pw = Math.round(18 * (1 - u * 0.6));
        for (let dx = -pw; dx <= pw; dx++) if (bay(X + dx, Y) < 1 - u) P(X + dx, Y, Math.abs(dx) > pw - 2 ? 34 : 35);
      }
      if (u < 0.35) { drawImpactStar(X, Y - 8, u / 0.35, 24, 0); glow(X, Y - 8, 34, T_BL, 0.6 * (1 - u / 0.35)); }
    }
  }

  /* ================================================================ enemy 2: the thorn sprite */
  const SPK = [[7.45, 560, 120], [8.05, 470, 46], [9.95, 470, 46], [10.25, 466, 40], [10.42, 466, 44]];
  const SP_BURST = 10.43;
  function spritePos(t) {
    let i = 0;
    while (i < SPK.length - 1 && t > SPK[i + 1][0]) i++;
    const a = SPK[i], b = SPK[Math.min(i + 1, SPK.length - 1)];
    const u = b[0] > a[0] ? eio(clamp((t - a[0]) / (b[0] - a[0]), 0, 1)) : 0;
    return [lerp(a[1], b[1], u), lerp(a[2], b[2], u) + Math.sin(t * 4.2) * 3];
  }
  const THORNS = [ // throw time, arrival, outcome: 0 hits hero, 1 deflected away, 2 deflected back
    [8.3, 8.6, 0], [9.02, 9.3, 1], [9.42, 9.7, 2],
  ];
  function drawThorn(x, y, a, s) {
    glow(x, y, 10, T_GR, 0.4);
    for (let k = 0; k < 3; k++) {
      const aa = a + k * TAU / 3, ca = Math.cos(aa), sa = Math.sin(aa), L = 7 * s;
      for (let r = 0; r <= L; r += 0.5) {
        const w = (1 - r / L) * 1.6;
        for (let q = -w; q <= w; q += 0.5) P(x + ca * r - sa * q, y + sa * r + ca * q, r > L - 1.5 ? 27 : r > L * 0.55 ? 40 : q < 0 ? 39 : 37);
      }
    }
    discF(x, y, 1.8, 22); P(x, y, 57);
  }
  function thornPos(th, t) { // world position of a thrown thorn, or null
    const [t0, t1, out] = th;
    if (t < t0) return null;
    const [sx0, sy0] = spritePos(t0);
    const hx = kf(HXK, t1) + 15, hy = 13;
    const u = (t - t0) / (t1 - t0);
    if (u <= 1) return [lerp(sx0, hx, u), lerp(sy0, hy, u) + Math.sin(PI * u) * 12];
    if (out === 1) { const v = t - t1; if (v > 1) return null; return [hx + 150 * v, hy + 170 * v - 100 * v * v]; }
    if (out === 2) { const v = (t - t1) / 0.25; if (v > 1) return null; const [ex, ey] = spritePos(9.95); return [lerp(hx, ex, v), lerp(hy, ey, v) + Math.sin(PI * v) * 6]; }
    return null;
  }
  function drawSprite(t) {
    if (t < 7.45 || t > 11.4) return;
    const [wx, hh] = spritePos(t);
    const X = sxw(wx), Y = syw(hh);
    if (t < SP_BURST) {
      const stun = t > 9.95, flash = (t > 9.95 && t < 10.08 && fl(t * 30) % 2 === 0) || (t > SP_BURST - 0.05);
      let windup = 0;
      for (const th of THORNS) if (t > th[0] - 0.18 && t < th[0] + 0.05) windup = Math.sin(PI * (t - th[0] + 0.18) / 0.23);
      glow(X, Y, 20 + windup * 10, T_GR, 0.3 + windup * 0.35);
      if (windup > 0.2) for (let k = 0; k < 8; k++) { const a = k * TAU / 8 + t * 10, r = 14 - windup * 4; P(X + Math.cos(a) * r, Y + Math.sin(a) * r, 40); }
      const bodyS = (X, Y) => {
        // leaf wings
        const flap = Math.sin(t * 22) * (stun ? 0.3 : 1);
        for (let s = -1; s <= 1; s += 2) {
          for (let r = 2; r < 15; r++) {
            const a = -0.5 - flap * 0.5 - windup * 0.6, wy = Math.round(Math.sin(a) * r * 0.7 + Math.sin(r * 0.45) * 2), wxp = Math.round(s * (6 + r));
            const th = Math.round(Math.sin(PI * r / 15) * 3.4);
            for (let q = -th; q <= th; q++) P(X + wxp, Y - 2 + wy + q, flash ? 27 : q === -th ? 39 : q === th ? 37 : 38);
            if (r % 3 === 0) P(X + wxp, Y - 2 + wy, flash ? 27 : 40);
          }
        }
        // round leaf-bud body
        for (let dy = -8; dy <= 8; dy++) for (let dx = -8; dx <= 8; dx++) {
          const e = (dx * dx + dy * dy) / 64;
          if (e > 1) continue;
          const l = 0.5 - dx * 0.04 - dy * 0.045;
          P(X + dx, Y + dy, flash ? 27 : e > 0.78 ? 37 : l > 0.75 ? 40 : l > 0.5 ? 39 : 38);
        }
        // crest of two leaves and a thorny tail
        for (let r = 0; r < 9; r++) { P(X - 1 - r * 0.6, Y - 8 - r, flash ? 27 : r > 5 ? 40 : 39); P(X - r * 0.6, Y - 8 - r, flash ? 27 : 38); P(X + 1 + r * 0.9, Y - 8 - r * 0.7, flash ? 27 : 39); P(X + 2 + r * 0.9, Y - 8 - r * 0.7, flash ? 27 : 38); }
        for (let r = 0; r < 7; r++) { P(X + Math.sin(t * 6) * r * 0.3, Y + 8 + r, flash ? 27 : r > 3 ? 22 : 37); if (r === 3) { P(X - 1, Y + 8 + r, 40); P(X + 1, Y + 8 + r, 40); } }
        // face
        if (!flash) {
          if (stun) { // dizzy spiral eyes and circling stars
            for (const ex of [-4, 4]) { P(X + ex - 1, Y - 2, 61); P(X + ex, Y - 1, 61); P(X + ex - 1, Y, 61); P(X + ex + 1, Y - 1, 61); P(X + ex, Y - 3, 61); }
            for (let k = 0; k < 3; k++) { const a = t * 8 + k * TAU / 3; sparkle(X + Math.cos(a) * 11, Y - 13 + Math.sin(a) * 3, 1, 44, 43); }
          } else {
            rectF(X - 5, Y - 2, 2, 3, 61); rectF(X + 3, Y - 2, 2, 3, 61); P(X - 5, Y - 2, 27); P(X + 3, Y - 2, 27);
            P(X - 6, Y + 2, 53); P(X + 6, Y + 2, 53); P(X - 7, Y + 2, 53); P(X + 5, Y + 2, 53); P(X - 1, Y + 3, 61); P(X, Y + 3, 61); P(X - 2, Y + 2, 61); P(X + 1, Y + 2, 61);
          }
        }
      };
      PEN = 0; bodyS(X - 1, Y); bodyS(X + 1, Y); bodyS(X, Y - 1); bodyS(X, Y + 1); PEN = -1; bodyS(X, Y);
    } else {
      // burst into a swirl of leaves
      const u = t - SP_BURST;
      for (let i = 0; i < 26; i++) {
        const a = ih(i, 1, 251) * TAU, sp = 30 + ih(i, 2, 251) * 60;
        const r = sp * eoc(Math.min(1, u * 1.6));
        const x = X + Math.cos(a + u * 2) * r + Math.sin(u * 5 + i) * 4, y = Y + Math.sin(a + u * 2) * r * 0.7 + u * u * 50;
        if (u > 0.6 && bay(fl(x), fl(y)) < (u - 0.6) * 1.8) continue;
        const ph = fl(u * 12 + i) % 4;
        const c0 = i % 3 === 0 ? 40 : 39, c1 = 38;
        if (ph === 0) { P(x, y, c0); P(x + 1, y, c1); P(x - 1, y, c1); }
        else if (ph === 1) { P(x, y, c0); P(x + 1, y + 1, c1); }
        else if (ph === 2) { P(x, y, c0); P(x, y + 1, c1); }
        else { P(x, y, c0); P(x - 1, y + 1, c1); }
      }
      if (u < 0.35) { drawImpactStar(X, Y, u / 0.35, 22, 1); glow(X, Y, 32, T_GR, 0.55 * (1 - u / 0.35)); }
    }
    // thorns in flight
    for (const th of THORNS) {
      const p = thornPos(th, t);
      if (p) {
        for (let k = 4; k >= 1; k--) { const q = thornPos(th, t - k * 0.02); if (q && bay(k * 3, k) < 1 - k * 0.2) { P(sxw(q[0]), syw(q[1]), k > 2 ? 37 : 39); P(sxw(q[0]) + 1, syw(q[1]), 38); } }
        drawThorn(sxw(p[0]), syw(p[1]), t * 26, 1);
      }
      const [, t1, out] = th;
      if (t > t1 && t < t1 + 0.16) {
        const hx = sxw(kf(HXK, t1) + 15), hy = syw(13), u = (t - t1) / 0.16;
        drawImpactStar(hx, hy, u, out === 0 ? 16 : 20, out === 0 ? -1 : 2);
        if (out) for (let i = 0; i < 10; i++) { const a = ih(i, 1, 252) * TAU, r = 4 + u * 22 * ih(i, 2, 252); P(hx + Math.cos(a) * r, hy + Math.sin(a) * r, i % 2 ? 44 : 27); }
      }
    }
  }

  /* ================================================================ enemy 3: the storm wisp */
  const WPK = [[11.95, 760, 130], [12.45, 704, 84], [13.6, 712, 88], [14.15, 702, 78], [14.48, 702, 80]];
  const WP_BURST = 14.48;
  const BOLTS = [[12.9, 662], [13.95, 598]];
  function wispPos(t) {
    let i = 0;
    while (i < WPK.length - 1 && t > WPK[i + 1][0]) i++;
    const a = WPK[i], b = WPK[Math.min(i + 1, WPK.length - 1)];
    const u = b[0] > a[0] ? eio(clamp((t - a[0]) / (b[0] - a[0]), 0, 1)) : 0;
    return [lerp(a[1], b[1], u) + Math.sin(t * 2.7) * 4, lerp(a[2], b[2], u) + Math.sin(t * 3.9) * 3];
  }
  function drawWisp(t) {
    if (t < 11.95 || t > 15.4) return;
    const [wx, wh] = wispPos(t);
    const X = sxw(wx), Y = syw(wh);
    if (t < WP_BURST) {
      const flash = t > 14.42 && fl(t * 30) % 2 === 0;
      let charge = 0;
      for (const b of BOLTS) if (t > b[0] - 0.35 && t < b[0]) charge = (t - b[0] + 0.35) / 0.35;
      glow(X, Y, 26, T_YE, 0.22 + charge * 0.35);
      const bodyW = (X, Y) => {
        // bat wings
        const flap = Math.sin(t * 16);
        for (let s = -1; s <= 1; s += 2) {
          for (let r = 3; r < 23; r++) {
            const top = Math.round(-flap * r * 0.45 - Math.sin(r * 0.3) * 4), bot = top + Math.round(4 + (r % 6 === 5 ? -3 : 1) + Math.sin(PI * r / 23) * 4);
            for (let q = top; q <= bot; q++) P(X + s * (7 + r), Y - 3 + q, flash ? 27 : q === top ? (r % 3 === 0 ? 44 : 43) : q === bot ? 4 : ((r + q) % 5 === 0 ? 42 : r % 2 ? 6 : 5));
          }
        }
        // puffy storm-cloud body
        const puffs = [[0, 0, 9.5], [-7, 3, 6.5], [7, 3, 6.5], [-4, -7, 6], [4, -7, 6.5], [0, 5, 7], [-10, -1, 4.5], [10, -1, 4.5]];
        for (let dy = -15; dy <= 13; dy++) for (let dx = -16; dx <= 16; dx++) {
          let inn = 0, top = 0;
          for (const p of puffs) { const ddx = dx - p[0], ddy = dy - p[1] + Math.sin(t * 5 + p[0]) * 0.6, r = p[2]; const e = (ddx * ddx + ddy * ddy) / (r * r); if (e <= 1) { inn = 1; if (ddy < -r * 0.45) top = 1; } }
          if (!inn) continue;
          P(X + dx, Y + dy, flash ? 27 : top ? 24 : dy > 4 ? 7 : (ih(dx + 20, dy + 20, 263) < 0.12 ? 23 : 9));
        }
        // eyes and crackle
        if (!flash) { rectF(X - 6, Y - 2, 4, 3, 44); rectF(X + 3, Y - 2, 4, 3, 44); P(X - 6, Y, 43); P(X + 6, Y, 43); rectF(X - 2, Y + 3, 4, 1, 4); glow(X, Y, 12, T_YE, 0.4); }
      };
      PEN = 0; bodyW(X - 1, Y); bodyW(X + 1, Y); bodyW(X, Y - 1); bodyW(X, Y + 1); PEN = -1; bodyW(X, Y);
      const fr = fl(t * 15);
      for (let k = 0; k < 3; k++) if (ih(fr, k, 261) < 0.55 + charge * 0.4) {
        const a = ih(fr, k + 5, 261) * TAU, r0 = 13, r1 = 18 + charge * 8;
        drawBolt(X + Math.cos(a) * r0, Y + Math.sin(a) * r0, X + Math.cos(a) * r1, Y + Math.sin(a) * r1, fr * 7 + k, 1, 44, 43);
      }
      if (charge > 0) for (let i = 0; i < 10; i++) { const a = i * TAU / 10 + t * 4, r = 26 * (1 - charge) + 4; P(X + Math.cos(a) * r, Y + Math.sin(a) * r, 44); }
    } else {
      const u = t - WP_BURST;
      for (let i = 0; i < 16; i++) {
        const a = i * TAU / 16 + ih(i, 1, 262), r = 8 + 70 * eoc(Math.min(1, u * 1.5));
        if (u > 0.5) continue;
        const fr = fl(t * 30);
        drawBolt(X + Math.cos(a) * r * 0.6, Y + Math.sin(a) * r * 0.6, X + Math.cos(a) * r, Y + Math.sin(a) * r, fr + i * 3, 1, 44, 43);
      }
      for (let i = 0; i < 20; i++) { const vx = (ih(i, 2, 262) - 0.5) * 120, vy = (ih(i, 3, 262) - 0.7) * 120; const x = X + vx * u, y = Y + vy * u + 90 * u * u; if (u < 0.8) P(x, y, ih(i, 4, 262) < 0.5 ? 44 : 9); }
      if (u < 0.35) { drawImpactStar(X, Y, u / 0.35, 26, 2); glow(X, Y, 40, T_YE, 0.6 * (1 - u / 0.35)); }
    }
    // bolts
    for (const [tb, gx] of BOLTS) {
      if (t < tb || t > tb + 0.6) continue;
      const u = t - tb, [bx, bh] = wispPos(tb);
      const fr = fl(t * 30);
      if (u < 0.16) {
        drawBolt(sxw(bx), syw(bh) + 6, sxw(gx), syw(0), fr * 13, 2, 27, 43);
        glow(sxw(gx), syw(0), 30, T_YE, 0.5);
        tintRect(0, 0, W - 1, H - 1, T_WH, 0.1 * (1 - u / 0.16));
      }
      if (u < 0.5) { // scorch and sparks
        for (let q = -6; q <= 6; q++) if (bay(sxw(gx) + q, syw(0)) < 1 - u * 2) P(sxw(gx) + q, syw(0), Math.abs(q) < 3 ? 44 : 41);
      }
    }
    // the first bolt runs along the ground toward the hero
    if (t > 12.95 && t < 13.55) {
      const u = (t - 12.95) / 0.55, fx = lerp(662, 540, u), fr = fl(t * 30);
      const X0 = sxw(fx), Y0 = syw(0);
      for (let k = 0; k < 3; k++) {
        const len = 18 - k * 4;
        drawBolt(X0, Y0 - 1 - k, X0 + len, Y0 - 2 - (k * 2), fr * 5 + k, k === 0 ? 2 : 1, k === 0 ? 27 : 44, 43);
      }
      glow(X0 + 6, Y0 - 3, 16, T_YE, 0.45);
    }
  }

  /* ================================================================ frame */
  const SHAKE = { x: 0, y: 0 };
  const SHAKES = [ // start, duration, amplitude
    [1.35, 0.2, 2], [5.6, 0.25, 2], [10.43, 0.22, 2], [12.9, 0.2, 2], [13.95, 0.2, 2], [14.48, 0.25, 2],
    [16.4, 1.35, 1.4], [17.8, 0.5, 3], [18.8, 0.4, 4], [19.66, 0.4, 4], [23.5, 0.8, 1.2],
    [25.02, 0.14, 2], [25.2, 0.14, 2], [25.38, 0.14, 2], [25.68, 0.3, 4], [26.3, 0.7, 6],
  ];
  function setShake(t) {
    let a = 0;
    for (const s of SHAKES) if (t >= s[0] && t < s[0] + s[1]) a = Math.max(a, s[2] * (1 - (t - s[0]) / s[1]));
    const f = fl(t * 30);
    SHAKE.x = Math.round((ih(f, 1, 901) - 0.5) * 2 * a);
    SHAKE.y = Math.round((ih(f, 2, 901) - 0.5) * 2 * a);
  }
  function setCam(t) { CAM.z = kf(ZK, t); CAM.x = Math.round(kf(CAMK, t) * CAM.z) / CAM.z; CAM.gy = Math.round(kf(GYK, t)); }
  function renderForest(t) {
    drawSky(t); drawCliffs(t); drawHaze(t);
    drawFarForest(t);
    drawVines(t, 0.3, 131, false);
    drawTrees(t, LAYERS.back); drawRays(t, 0.35);
    drawTrees(t, LAYERS.mid); drawCanopy(t); drawVines(t, 0.52, 132, false);
    if (t > 14.8 && t < 27.6) drawRuins(t);
    drawRays(t, 0.22 * (1 - stormAmt(t) * 0.7));
    { const sa = stormAmt(t); if (sa > 0.01) for (let i = 0; i < NP; i++) { const x = i % W, y = (i / W) | 0; tintI(i, x, y, T_DARK, 0.22 * sa); } }
    drawFog(t, CAM.gy - 60, CAM.gy + 12, 0.5, 0.6, 141, T_MIST);
    drawGround(t); drawSpores(t);
  }
  function impactFrame(boss) { // two-tone silhouette frame on the biggest hits; the hero keeps its colours
    for (let i = 0; i < NP; i++) {
      if (HMASK[i]) continue;
      if (boss && BK[i]) { BUF[i] = BK[i] === 1 ? 27 : 48; continue; }
      const p = PAL[BUF[i]];
      BUF[i] = (p[0] * 0.3 + p[1] * 0.55 + p[2] * 0.15) > 170 ? 27 : 63;
    }
  }
  function drawShield(t) {
    if (t < 23.42 || t > 24.32) return;
    const hp = heroPose(t), hx = sxw(hp.x), hy = syw(hp.h) - 14;
    const hit = t > 23.55, fr = fl(t * 30), th0 = Math.atan2(-0.6, 0.8);
    const grow = eoc(lin(23.42, 23.55, t)), span = 0.75 * grow;
    for (let a = th0 - span; a <= th0 + span; a += 0.006) {
      for (let r = 28; r <= 34; r++) {
        const x = hx + Math.cos(a) * r, y = hy + Math.sin(a) * r;
        const cell = (fl((a - th0) * 30) + fl(r / 2) + fr) % 6 === 0;
        const edge = r === 28 || r === 34 || Math.abs(Math.abs(a - th0) - span) < 0.01;
        if (edge) P(x, y, hit && fr % 2 ? 27 : 36);
        else if (cell) P(x, y, hit ? 49 : 36);
        else tintP(x, y, T_WH, hit ? 0.45 : 0.3);
      }
    }
    glow(hx + Math.cos(th0) * 31, hy + Math.sin(th0) * 31, 24, T_WH, hit ? 0.35 : 0.15);
  }
  let bkDirty = false;
  // hit-stop: the action freezes for two frames on each big contact, then catches up at double speed (no drift)
  const HITSTOP = [4.86, 5.6, 9.3, 9.7, 10.43, 14.48, 18.8, 19.66, 25.02, 25.2, 25.38, 25.68, 26.3];
  function hitWarp(t) {
    const d = 2 / 30;
    for (const h of HITSTOP) {
      if (t >= h && t < h + d) return h;
      if (t >= h + d && t < h + 2 * d) return h + 2 * (t - h - d);
    }
    return t;
  }
  function render(t) {
    t = Math.min(t, D - 0.5);
    const tReal = t;
    t = hitWarp(t);
    HMASK.fill(0);
    if (bkDirty) { BK.fill(0); bkDirty = false; }
    setCam(t); setShake(tReal);
    if (t >= R_T0) { SHAKE.x = 0; SHAKE.y = 0; drawReveal(t); return; }
    renderForest(t);
    if (t < 3.4) drawStone(t);
    drawSlime(t); drawSprite(t); drawWisp(t);
    let binfo = null;
    if (t > B_RISE[0] && t < 27.5) {
      binfo = renderBoss(t, Math.min(t, B_SHATTER)); bkDirty = true;
      if (t < B_SHATTER) {
        let fl1 = false;
        for (const h of B_HITS) if (t >= h && t < h + 0.1) fl1 = fl(t * 30) % 2 === 0;
        if (t > 25.8) fl1 = fl1 || (fl(t * 15) % 3 === 0 && t > 26.1);
        compositeBoss(t, binfo, fl1);
      } else drawBossShatter(t, binfo);
      drawBossFx(t, binfo);
      drawShockwave(t, B_SLAM[0], binfo.ox - 128, CAM.gy);
      drawShockwave(t, B_SLAM[1], binfo.ox - 128, CAM.gy);
      if (t > B_SLAM[0] && t < B_SLAM[0] + 0.3) drawImpactStar(binfo.ox - 126, CAM.gy - 4, (t - B_SLAM[0]) / 0.3, 30, 3);
      if (t > B_SLAM[1] && t < B_SLAM[1] + 0.3) drawImpactStar(binfo.ox - 126, CAM.gy - 4, (t - B_SLAM[1]) / 0.3, 30, 3);
    }
    drawBraidBack(t);
    drawFinaleFx(t);
    drawHeroFx(t);
    drawSurge(t, false);
    drawOrbs(t, false);
    if (t >= FALL0) drawHeroAt(t);
    drawOrbs(t, true);
    drawSurge(t, true);
    if (t < 2.6) drawStoneSword(t);
    drawShield(t);
    drawSpecials(t);
    if (binfo) {
      const hp = heroPose(t);
      drawBeam(t, binfo, sxw(hp.x) + 34, syw(hp.h) - 15);
      drawLeaves(t, binfo);
      for (let k = 0; k < B_HITS.length; k++) { const h = B_HITS[k]; if (t >= h && t < h + 0.16) drawImpactStar(sxw(hp.x) + 40, syw(hp.h) - 20, (t - h) / 0.16, k === 3 ? 44 : 30, k); }
      if (t > B_SHATTER && t < B_SHATTER + 0.9) {
        const u = (t - B_SHATTER) / 0.9;
        if (u < 0.7) drawBurst(binfo.ccx, binfo.ccy, u / 0.7, 240, 22, 0.3, [49, 48], 1.6);
        if (u < 0.6) drawBurst(binfo.ccx, binfo.ccy, u / 0.6, 150, 14, 0.45, [27, 49], 1.2);
        const rr0 = 260 * eoc(u);
        if (u < 0.6) for (let a = 0; a < TAU; a += 0.004) { P(binfo.ccx + Math.cos(a) * rr0, binfo.ccy + Math.sin(a) * rr0, 49); P(binfo.ccx + Math.cos(a) * (rr0 - 1), binfo.ccy + Math.sin(a) * (rr0 - 1), 27); }
        for (let i = 0; i < 70; i++) { const a = ih(i, 1, 905) * TAU, r = (40 + ih(i, 2, 905) * 200) * eoc(u); if (bay(i, 3) > 1 - u) continue; sparkle(binfo.ccx + Math.cos(a) * r, binfo.ccy + Math.sin(a) * r + u * u * 40, ih(i, 3, 905) < 0.2 ? 2 : 0, 27, 49); }
        glow(binfo.ccx, binfo.ccy, 160 * eoc(u) + 20, T_VI, 0.7 * (1 - u));
      }
    }
    if (t > 2.6 && t < 3.0) { const p = heroPose(2.7); drawTing(sxw(p.x) + 16, syw(0) - 42, (t - 2.6) / 0.4); }
    drawBraid(t);
    drawFireflies(t, 60);
    drawRain(t);
    drawFgTrunks(t); drawFerns(t);
    drawWhiteout(t);
    if (t < 1.3) drawIntroOverlay(t);
    if ((t >= B_SHATTER && t < B_SHATTER + 0.067) || (t >= SL_BURST && t < SL_BURST + 0.034) || (t >= B_HITS[3] && t < B_HITS[3] + 0.034)) impactFrame(!!binfo);
  }

  /* ================================================================ present */
  const LE = new Uint8Array(new Uint32Array([0x01020304]).buffer)[0] === 0x04;
  const pack = (r, g, b) => (LE ? ((255 << 24) | (b << 16) | (g << 8) | r) : ((r << 24) | (g << 16) | (b << 8) | 255)) >>> 0;
  const LIVE = new Uint32Array(256);
  for (let i = 0; i < NPAL; i++) LIVE[i] = pack(PAL[i][0], PAL[i][1], PAL[i][2]);
  let SMALL = null, SG = null, IMG = null, PIX = null;
  function drawFrame(t, g, cw, ch, k, ox, oy) {
    render(t);
    if (!SMALL) {
      SMALL = document.createElement('canvas'); SMALL.width = W; SMALL.height = H;
      SG = SMALL.getContext('2d'); IMG = SG.createImageData(W, H); PIX = new Uint32Array(IMG.data.buffer);
    }
    // whole-pixel screen shake: shift the finished frame, clamping at the edges
    const sx = SHAKE.x, sy = SHAKE.y;
    for (let y = 0; y < H; y++) {
      const yy = clamp(y - sy, 0, H - 1), o = y * W, oo = yy * W;
      for (let x = 0; x < W; x++) PIX[o + x] = LIVE[BUF[oo + clamp(x - sx, 0, W - 1)]];
    }
    SG.putImageData(IMG, 0, 0);
    g.imageSmoothingEnabled = false;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = '#04050b'; g.fillRect(0, 0, cw, ch);
    g.drawImage(SMALL, ox, oy, W * k, H * k);
  }

  /* ================================================================ mount */
  (window.PIECES = window.PIECES || []).push({
    id: 'fable-quest',
    title: 'Fable Quest',
    medium: 'Pixel art in 64 colours, 480 × 270, drawn in JavaScript · 36 s',
    note: 'A small hero, four orbs, one story · tap to pause',
    about: 'A small coral hero lands in an enchanted forest at twilight and pulls a sword from a stone. It beats a water slime, a thorn sprite and a storm wisp, and each leaves an orb of its element to circle the hero: water, leaf and lightning. An ancient forest guardian wakes, slams the ground, rains down leaves and fires a beam from its eyes; the orbs pour into the sword, the guardian shatters into violet light and leaves the fourth orb, starlight. The four orbs braid into a column of light that unfolds into a storybook cathedral of crystal geometry. An unofficial fan concept, not affiliated with Anthropic.',
    tone: 'dark',
    room: '#04050b',
    mount(el, api) {
      const EXPORT = /[?&]export\b/.test(location.search);
      let alive = true, raf = 0, playing = !EXPORT, clock = 0, last = 0, ready = false;
      el.style.background = '#04050b';
      const cv = document.createElement('canvas');
      cv.style.cssText = 'position:absolute;display:block;cursor:pointer;image-rendering:pixelated;image-rendering:crisp-edges;';
      el.appendChild(cv);
      const g = cv.getContext('2d', { alpha: false });
      const pauseMark = document.createElement('div');
      pauseMark.style.cssText = 'position:absolute;width:34px;height:34px;opacity:0;transition:opacity .4s;pointer-events:none;';
      pauseMark.innerHTML = '<svg viewBox="0 0 34 34" width="34" height="34"><rect x="10" y="9" width="5" height="16" fill="rgba(255,230,210,.8)"/><rect x="19" y="9" width="5" height="16" fill="rgba(255,230,210,.8)"/></svg>';
      el.appendChild(pauseMark);
      let K = 4, CW = W * 4, CH = H * 4;
      function layout() {
        const dpr = Math.min(3, window.devicePixelRatio || 1);
        let left = 0, top = 0, cssW, cssH;
        if (EXPORT) {
          cssW = 1920; cssH = 1080; cv.style.position = 'fixed';
          K = Math.max(1, Math.round(4 * dpr)); CW = Math.round(1920 * dpr); CH = Math.round(1080 * dpr);
        } else {
          const w = el.clientWidth || window.innerWidth, h = el.clientHeight || window.innerHeight;
          const fit = Math.min(w * dpr / W, h * dpr / H);
          K = Math.max(1, Math.floor(fit));
          let show = K;
          if (K < fit * 0.88) { K = Math.max(1, Math.ceil(fit)); show = fit; }
          CW = W * K; CH = H * K;
          cssW = W * show / dpr; cssH = H * show / dpr;
          left = Math.round((w - cssW) / 2); top = Math.round((h - cssH) / 2);
        }
        if (cv.width !== CW || cv.height !== CH) { cv.width = CW; cv.height = CH; }
        cv.style.left = left + 'px'; cv.style.top = top + 'px'; cv.style.width = cssW + 'px'; cv.style.height = cssH + 'px';
        pauseMark.style.left = (left + cssW - 48) + 'px'; pauseMark.style.top = (top + 14) + 'px';
      }
      const draw = (t) => drawFrame(t, g, CW, CH, K, 0, 0);
      layout();
      draw(0);
      ready = true;
      if (EXPORT) {
        const faded = () => { const st = el.parentElement; return !st || parseFloat(getComputedStyle(st).opacity) >= 0.999; };
        window.__fablequest = {
          duration: D,
          isReady: () => ready && faded(),
          renderAt(t) { return new Promise((res) => { const t0 = performance.now(); draw(t); window.__fablequest.lastMs = performance.now() - t0; requestAnimationFrame(() => requestAnimationFrame(res)); }); },
          lastMs: 0,
        };
        document.documentElement.dataset.ready = 'fable-quest';
        api.ready();
      } else {
        window.__fablequest = { duration: D, isReady: () => ready, renderAt(t) { return new Promise((res) => { playing = false; clock = t; draw(t); requestAnimationFrame(() => res()); }); } };
        api.ready();
      }
      let hold = 0;
      function frame(now) {
        if (!alive || !api.isCurrent()) return;
        raf = requestAnimationFrame(frame);
        const dt = last ? Math.min(0.1, (now - last) / 1000) : 0; last = now;
        if (!playing) return;
        if (clock >= D) { hold += dt; if (hold < 2.5) return; hold = 0; clock = 0; } // a short rest on the last frame, then again
        clock = Math.min(D, clock + dt);
        draw(Math.min(clock, D - 1 / 30));
      }
      if (!EXPORT) raf = requestAnimationFrame(frame);
      const onDown = () => { if (EXPORT) return; playing = !playing; last = 0; pauseMark.style.opacity = playing ? '0' : '1'; };
      cv.addEventListener('pointerdown', onDown);
      let rt = 0;
      const ro = new ResizeObserver(() => { clearTimeout(rt); rt = setTimeout(() => { if (!alive) return; layout(); draw(Math.min(clock, D - 1 / 30)); }, 120); });
      ro.observe(el);
      return {
        destroy() {
          alive = false; cancelAnimationFrame(raf); ro.disconnect(); clearTimeout(rt);
          cv.removeEventListener('pointerdown', onDown);
          if (window.__fablequest) delete window.__fablequest;
        },
      };
    },
  });
})();
