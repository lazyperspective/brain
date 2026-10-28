/* The Null — Fable Saga, part II.
 *
 * A 45-second pixel-art action short: the coral hero from Fable Quest meets its shadow, a glitched
 * double called the Null, and the fight goes up, through and above the clouds. Every frame is a pure
 * function of t, drawn into a 480 × 270 indexed buffer in 64 colours and shown at 4×. The film is cut
 * as a sequence of shots, each with its own camera, composed in screen space; a letterbox, captions
 * and shouts sit on top. An unofficial fan concept, not affiliated with Anthropic.
 */
(function () {
  'use strict';

  /* ================================================================ constants & helpers */
  const W = 480, H = 270, NP = W * H, D = 45;
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
  const SEED = 23;
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
  function fbm(x, y, c, oct, s) { let v = 0, a = 1, n = 0; for (let k = 0; k < oct; k++) { v += a * vn(x, y, c, s + k * 31); n += a; a *= 0.5; c *= 0.5; } return v / n; }
  const B8 = [0, 32, 8, 40, 2, 34, 10, 42, 48, 16, 56, 24, 50, 18, 58, 26, 12, 44, 4, 36, 14, 46, 6, 38, 60, 28, 52, 20, 62, 30, 54, 22,
    3, 35, 11, 43, 1, 33, 9, 41, 51, 19, 59, 27, 49, 17, 57, 25, 15, 47, 7, 39, 13, 45, 5, 37, 63, 31, 55, 23, 61, 29, 53, 21].map((v) => (v + 0.5) / 64);
  const bay = (x, y) => B8[((y & 7) << 3) | (x & 7)];

  /* ================================================================ palette (64) */
  const PAL_HEX = [
    '000000', '07060d', '0e0c1a', '171530', '221f48', '2f2b63', '3f3a80', '524ca0', '6c64bd',     // 0-8 night and sky violets
    '2a0f1f', '4a1426', '7a1e2c', 'b0322f', 'e0582f', 'f28c3a', 'ffc060', 'ffe9a8',               // 9-16 dusk fire
    '3a3550', '5a5370', '8a83a0', 'c4bfd6', 'eceaf4', 'ffffff',                                   // 17-22 cloud and light
    '0e1f1a', '18352a', '26503a', '3a7048',                                                       // 23-26 forest
    '201814', '3a2a20', '5a4030', '7c5a40', 'a07a58',                                             // 27-31 earth and rock
    '4a4a52', '6c6c74', '9a9aa2',                                                                 // 32-34 stone
    'd97757', 'a8553b', 'f2a585', '6e2a1a',                                                       // 35-38 hero coral
    '141218', '24202c', '3a3444', 'ff2a4a', 'a0102a', 'ff8aa0',                                   // 39-44 the Null
    '1f66bd', '3f98f2', '95d4ff', '3a952c', '7bd23e', 'c8f27c', 'cf9c17', 'ffd84a', 'fff4b0',     // 45-53 water, leaf, lightning
    '4a1d80', '7c3ccc', 'ad78ff', 'e0c8ff',                                                       // 54-57 starlight
    'ffb020', 'ffe066', 'fffbe0', '30e0ff', '5a2a8a', '120c24',                                   // 58-63 gold aura, electric cyan, deep violets
  ];
  const PAL = PAL_HEX.map((h) => [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]);
  const NPAL = PAL.length;
  const EL = [[45, 46, 47, 22], [48, 49, 50, 22], [51, 52, 53, 22], [54, 55, 56, 57]]; // element ramps: dark, mid, bright, pale
  const GOLD = [58, 59, 60, 22], RED = [43, 42, 44, 22], CORAL = 35, CORD = 36, CORL = 37;
  function nearest(r, g, b) {
    let best = 0, bd = 1e18;
    for (let k = 0; k < NPAL; k++) {
      const p = PAL[k], rm = (p[0] + r) / 2, dr = p[0] - r, dg = p[1] - g, db = p[2] - b;
      const d = (2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db;
      if (d < bd) { bd = d; best = k; }
    }
    return best;
  }
  // tint tables: 8 levels of mixing (or adding) a colour into every palette entry
  function mkTab(hex, add) {
    const q = [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)], T = [];
    for (let lv = 0; lv <= 8; lv++) {
      const a = lv / 8, tab = new Uint8Array(256);
      for (let i = 0; i < NPAL; i++) {
        const p = PAL[i];
        tab[i] = lv === 0 ? i : add ? nearest(Math.min(255, p[0] + q[0] * a), Math.min(255, p[1] + q[1] * a), Math.min(255, p[2] + q[2] * a))
          : nearest(lerp(p[0], q[0], a), lerp(p[1], q[1], a), lerp(p[2], q[2], a));
      }
      T.push(tab);
    }
    return T;
  }
  const T_DARK = mkTab('000000', false), T_WH = mkTab('ffffff', true), T_RED = mkTab('ff2040', true), T_GOLD = mkTab('ffc040', true);
  const T_BL = mkTab('3f98f2', true), T_GR = mkTab('6cc040', true), T_YE = mkTab('ffd84a', true), T_VI = mkTab('9a5cf0', true);
  const T_NIGHT = mkTab('120c24', false), T_CRIM = mkTab('5a0a1c', false), T_WARM = mkTab('ffb060', true);
  const EL_T = [T_BL, T_GR, T_YE, T_VI];

  /* ================================================================ buffer & primitives */
  const BUF = new Uint8Array(NP);
  function P(x, y, c) { x = fl(x); y = fl(y); if (x >= 0 && x < W && y >= 0 && y < H) BUF[y * W + x] = c; }
  function rectF(x, y, w, h, c) {
    const x0 = Math.max(0, fl(x)), y0 = Math.max(0, fl(y)), x1 = Math.min(W, fl(x + w)), y1 = Math.min(H, fl(y + h));
    for (let yy = y0; yy < y1; yy++) BUF.fill(c, yy * W + x0, yy * W + x1);
  }
  function lineF(x0, y0, x1, y1, fn) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1, L = Math.max(dx, -dy) || 1;
    let e = dx + dy, n = 0;
    for (;;) {
      fn(x0, y0, n / L);
      if ((x0 === x1 && y0 === y1) || ++n > 3000) break;
      const e2 = 2 * e;
      if (e2 >= dy) { e += dy; x0 += sx; }
      if (e2 <= dx) { e += dx; y0 += sy; }
    }
  }
  const lineP = (x0, y0, x1, y1, c) => lineF(x0, y0, x1, y1, (x, y) => P(x, y, c));
  function thick(x0, y0, x1, y1, w, c) { for (let k = 0; k < w; k++) for (let j = 0; j < w; j++) lineP(x0 + k - w / 2, y0 + j - w / 2, x1 + k - w / 2, y1 + j - w / 2, c); }
  function discF(cx, cy, r, c) {
    const r2 = r * r, y0 = Math.max(0, fl(cy - r)), y1 = Math.min(H - 1, Math.ceil(cy + r)), x0 = Math.max(0, fl(cx - r)), x1 = Math.min(W - 1, Math.ceil(cx + r));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const dx = x + 0.5 - cx, dy = y + 0.5 - cy; if (dx * dx + dy * dy <= r2) BUF[y * W + x] = c; }
  }
  function ring(cx, cy, r, ry, c, keep) { for (let a = 0; a < TAU; a += 0.6 / Math.max(4, r)) { const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * (ry === undefined ? r : ry); if (!keep || keep(x, y, a)) P(x, y, c); } }
  function tintI(i, x, y, T, a) {
    let lv = (a * 8 + 0.5 + (bay(x, y) - 0.5) * 0.6) | 0;
    if (lv <= 0) return;
    if (lv > 8) lv = 8;
    BUF[i] = T[lv][BUF[i]];
  }
  function tintP(x, y, T, a) { x = fl(x); y = fl(y); if (x >= 0 && x < W && y >= 0 && y < H) tintI(y * W + x, x, y, T, a); }
  function tintAll(T, a) { if (a <= 0.004) return; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) tintI(y * W + x, x, y, T, a); }
  function glow(cx, cy, r, T, amax, pw) {
    if (amax <= 0.004 || r <= 0) return;
    const y0 = Math.max(0, fl(cy - r)), y1 = Math.min(H - 1, Math.ceil(cy + r)), x0 = Math.max(0, fl(cx - r)), x1 = Math.min(W - 1, Math.ceil(cx + r)), ir = 1 / r;
    for (let y = y0; y <= y1; y++) {
      const dy = (y + 0.5 - cy) * ir;
      for (let x = x0; x <= x1; x++) {
        const dx = (x + 0.5 - cx) * ir, d = dx * dx + dy * dy;
        if (d >= 1) continue;
        const f = 1 - Math.sqrt(d);
        tintI(y * W + x, x, y, T, amax * (pw === 1 ? f : f * f));
      }
    }
  }
  function sparkle(x, y, L, c0, c1) {
    x = Math.round(x); y = Math.round(y);
    if (L < 0.5) return;
    P(x, y, c0);
    const l = Math.round(L);
    for (let k = 1; k <= l; k++) { const c = k <= l * 0.45 ? c0 : c1; P(x + k, y, c); P(x - k, y, c); P(x, y + k, c); P(x, y - k, c); }
    if (l >= 3) { const d = Math.max(1, Math.round(l * 0.3)); for (let k = 1; k <= d; k++) { P(x + k, y + k, c1); P(x - k, y - k, c1); P(x + k, y - k, c1); P(x - k, y + k, c1); } }
  }

  /* ================================================================ lettering: a 5 × 7 font for captions and shouts */
  const FONT = {
    A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'], B: ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
    C: ['.####', '#....', '#....', '#....', '#....', '#....', '.####'], D: ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
    E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'], F: ['#####', '#....', '#....', '####.', '#....', '#....', '#....'],
    G: ['.####', '#....', '#....', '#.###', '#...#', '#...#', '.###.'], H: ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
    I: ['###', '.#.', '.#.', '.#.', '.#.', '.#.', '###'], J: ['..###', '...#.', '...#.', '...#.', '#..#.', '#..#.', '.##..'],
    K: ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'], L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
    M: ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'], N: ['#...#', '##..#', '#.#.#', '#..##', '#...#', '#...#', '#...#'],
    O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'], P: ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
    Q: ['.###.', '#...#', '#...#', '#...#', '#.#.#', '#..#.', '.##.#'], R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
    S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'], T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
    U: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'], V: ['#...#', '#...#', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
    W: ['#...#', '#...#', '#...#', '#.#.#', '#.#.#', '##.##', '#...#'], X: ['#...#', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '#...#'],
    Y: ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'], Z: ['#####', '....#', '...#.', '..#..', '.#...', '#....', '#####'],
    0: ['.###.', '#...#', '#..##', '#.#.#', '##..#', '#...#', '.###.'], 1: ['.#.', '##.', '.#.', '.#.', '.#.', '.#.', '###'],
    2: ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'], 5: ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
    '.': ['..', '..', '..', '..', '..', '##', '##'], ',': ['..', '..', '..', '..', '..', '.#', '#.'], '!': ['#', '#', '#', '#', '#', '.', '#'],
    '?': ['.###.', '#...#', '....#', '...#.', '..#..', '.....', '..#..'], "'": ['#', '#', '.', '.', '.', '.', '.'],
    '-': ['...', '...', '...', '###', '...', '...', '...'], ':': ['.', '#', '.', '.', '.', '#', '.'], '·': ['.', '.', '.', '#', '.', '.', '.'],
    ' ': ['...', '...', '...', '...', '...', '...', '...'],
  };
  const glyphW = (ch) => (FONT[ch] || FONT[' '])[0].length;
  function textWidth(s, sc) { let w = 0; for (const ch of s) w += (glyphW(ch) + 1) * sc; return w - sc; }
  // draw text; vis(k) gives how many glyphs are visible (typewriter); outline colour oc
  function text(s, x, y, c, sc, oc, nvis, shake) {
    sc = sc || 1;
    let cx = x, k = 0;
    for (const ch of s) {
      if (nvis !== undefined && k >= nvis) break;
      const g = FONT[ch] || FONT[' '], gw = g[0].length;
      const jx = shake ? Math.round((ih(k, fl(shake * 30), 77) - 0.5) * 2) : 0, jy = shake ? Math.round((ih(k, fl(shake * 30), 78) - 0.5) * 2) : 0;
      if (oc !== undefined) for (let j = 0; j < 7; j++) for (let i = 0; i < gw; i++) if (g[j][i] === '#') { const ow = sc > 2 ? Math.max(1, Math.round(sc * 0.5)) : sc; rectF(cx + i * sc - ow + jx, y + j * sc - ow + jy, sc + ow * 2, sc + ow * 2, oc); }
      for (let j = 0; j < 7; j++) for (let i = 0; i < gw; i++) if (g[j][i] === '#') rectF(cx + i * sc + jx, y + j * sc + jy, sc, sc, typeof c === 'function' ? c(i, j, k) : c);
      cx += (gw + 1) * sc; k++;
    }
  }

  /* ================================================================ characters: drawn small, stamped at any scale and angle */
  const SW = 120, SH = 84, SOX = 60, SOY = 46;            // local sprite canvas, origin at the body centre
  const SPR = new Uint8Array(SW * SH), SPK = new Uint8Array(SW * SH); // colour + 1; class: 1 body, 2 sword, 4 outline
  const LBB = [0, 0, 0, 0];
  function sp(x, y, c, k) {
    x = Math.round(x); y = Math.round(y);
    const X = x + SOX, Y = y + SOY;
    if (X < 0 || Y < 0 || X >= SW || Y >= SH) return;
    SPR[Y * SW + X] = c + 1; SPK[Y * SW + X] = k || 1;
    if (x < LBB[0]) LBB[0] = x; if (y < LBB[1]) LBB[1] = y; if (x > LBB[2]) LBB[2] = x; if (y > LBB[3]) LBB[3] = y;
  }
  function spRect(x, y, w, h, c, k) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) sp(x + i, y + j, c, k); }
  // the sword, rasterised at an angle about the hand: u along the blade, v across
  function spSword(px, py, ang, cols) {
    const ca = Math.cos(ang), sa = Math.sin(ang);
    for (let dy = -34; dy <= 34; dy++) for (let dx = -34; dx <= 34; dx++) {
      const fx = dx + 0.5, fy = dy + 0.5, u = fx * ca + fy * sa, v = -fx * sa + fy * ca, av = Math.abs(v);
      let c = -1;
      if (u >= -6 && u < -4.5 && av <= 1.4) c = 58;                          // pommel
      else if (u >= -4.5 && u < 0.5 && av <= 1.0) c = 38;                    // grip
      else if (u >= 0.5 && u < 2.5 && av <= 4.2) c = av > 3.2 ? 51 : 58;     // guard
      else if (u >= 2.5 && u < 30) {
        const tw = u > 25 ? (30 - u) * 0.36 : 1.8;
        if (av <= tw) c = cols ? (v < -0.6 ? 22 : cols[fl(frac(u * 0.08) * cols.length)]) : (v < -0.7 ? 22 : u < 5 ? 33 : 34);
      }
      if (c >= 0) sp(px + dx, py + dy, c, 2);
    }
  }
  // o: who ('hero' | 'null'), eyes, mouth, sword (angle or null), swordCols, legs (lift per leg), sq (squash: + wide, − tall)
  function buildSprite(o) {
    SPR.fill(0); SPK.fill(0); LBB[0] = 1e9; LBB[1] = 1e9; LBB[2] = -1e9; LBB[3] = -1e9;
    const sq = o.sq || 0, bw = Math.round(26 * (1 + sq * 0.5) / 2) * 2, bh = Math.max(10, Math.round(16 * (1 - sq * 0.4)));
    const x0 = -bw / 2, y0 = -Math.round(bh / 2), y1 = y0 + bh;
    const N = o.who === 'null';
    const body = N ? 40 : CORAL, dark = N ? 39 : CORD, lite = N ? 41 : CORL;
    // legs
    const lift = o.legs || [0, 0, 0, 0], lh = o.fly ? 4 : 6;
    const lx = [x0, x0 + Math.round(bw * 0.2), x0 + bw - Math.round(bw * 0.2) - 4, x0 + bw - 4];
    for (let k = 0; k < 4; k++) spRect(lx[k], y1, 4, Math.max(1, lh - lift[k]), k === 0 || k === 2 ? body : body, 1);
    // body with a little shading (flat, as in the reference, just a lit top edge and a darker base)
    spRect(x0, y0, bw, bh, body, 1);
    for (let i = 0; i < bw; i++) { sp(x0 + i, y1 - 1, dark, 1); if (o.shade) sp(x0 + i, y0, lite, 1); }
    // arms
    const ay = y0 + Math.round(bh * 0.34), ah = Math.max(3, Math.round(bh * 0.32)), ar = Math.round(o.reach || 0);
    spRect(x0 - 4, ay, 4, ah, body, 1); spRect(x0 + bw, ay, 4 + ar, ah, body, 1);
    if (N) { // claws, and a jagged crown
      for (const s of [-1, 1]) { const ax = s < 0 ? x0 - 5 : x0 + bw + 4 + ar; sp(ax, ay, body, 1); sp(ax + s, ay - 1, 42, 1); sp(ax, ay + ah - 1, body, 1); sp(ax + s, ay + ah, 42, 1); }
      for (const [cx, h] of [[x0 + 5, 4], [0, 7], [x0 + bw - 6, 4]]) for (let j = 0; j < h; j++) { const w = Math.max(0, Math.round((h - j) * 0.45)); for (let i = -w; i <= w; i++) sp(cx + i, y0 - 1 - j, j > h - 3 ? 42 : 39, 1); }
      for (let i = 0; i < bw; i += 3) sp(x0 + i + (ih(i, 1, 41) < 0.5 ? 1 : 0), y0 + 2 + fl(ih(i, 2, 41) * (bh - 4)), 41, 1); // glitch flecks
    }
    // eyes
    const ex0 = x0 + Math.round(bw * 0.17), ex1 = x0 + bw - Math.round(bw * 0.17) - 2, ey = y0 + Math.round(bh * 0.28);
    const EC = N ? 42 : 0, e = o.eyes || 'normal';
    const eye = (ex, side) => {
      if (e === 'closed') { spRect(ex, ey + 2, 2, 1, EC, 1); return; }
      if (e === 'glow') { spRect(ex - 1, ey - 1, 4, 5, 59, 1); spRect(ex, ey, 2, 3, 22, 1); return; }
      if (e === 'wide') { spRect(ex - 1, ey - 1, 3, 4, EC, 1); sp(ex - 1, ey - 1, 22, 1); return; }
      if (e === 'narrow') { spRect(ex, ey + 1, 2, 2, EC, 1); return; }
      spRect(ex, ey, 2, 3, EC, 1);
      if (e === 'angry' || N) { const inner = side < 0 ? ex + 1 : ex; sp(inner + side * -1, ey - 1, N ? 42 : 0, 1); sp(inner + side * -1 + (side < 0 ? 1 : -1), ey - 2, N ? 42 : 0, 1); sp(ex + (side < 0 ? 0 : 1), ey, body, 1); }
    };
    eye(ex0, -1); eye(ex1, 1);
    if (o.mouth) { const mw = o.mouth > 1 ? 8 : 4, mh = o.mouth > 1 ? 4 : 2; spRect(-mw / 2, ey + 5, mw, mh, N ? 42 : 0, 1); if (N) for (let i = -mw / 2; i < mw / 2; i += 2) sp(i, ey + 5, 39, 1); else if (o.mouth > 1) spRect(-mw / 2 + 1, ey + 5 + mh - 1, mw - 2, 1, 36, 1); }
    // sword on the right arm nub
    if (o.sword !== undefined && o.sword !== null) spSword(x0 + bw + 2 + ar, ay + ah / 2 - 0.5, o.sword, o.swordCols || null);
    // outline
    const oc = o.outline !== undefined ? o.outline : N ? 42 : 22;
    const src = SPR.slice();
    for (let y = 1; y < SH - 1; y++) for (let x = 1; x < SW - 1; x++) {
      const i = y * SW + x; if (src[i]) continue;
      if (src[i - 1] || src[i + 1] || src[i - SW] || src[i + SW]) { SPR[i] = (SPK[i - 1] === 2 || SPK[i + 1] === 2 || SPK[i - SW] === 2 || SPK[i + SW] === 2 ? (N ? 42 : 1) : oc) + 1; SPK[i] = 4; }
    }
    LBB[0]--; LBB[1]--; LBB[2]++; LBB[3]++;
    return { bw, bh, hand: [x0 + bw + 2 + ar, ay + ah / 2], top: y0, bottom: y1 + lh };
  }
  // stamp the built sprite at screen (x, y), scale S, angle (radians), mirrored if flip
  const SMASK = new Uint8Array(NP), SMB = [0, 0, 0, 0];
  function stamp(x, y, S, ang, flip, opt) {
    opt = opt || {};
    const ca = Math.cos(ang), sa = Math.sin(ang);
    let R = 0;
    for (const [lx, ly] of [[LBB[0], LBB[1]], [LBB[2] + 1, LBB[1]], [LBB[0], LBB[3] + 1], [LBB[2] + 1, LBB[3] + 1]]) R = Math.max(R, Math.hypot(lx, ly));
    R = R * S + 2;
    const x0 = Math.max(0, fl(x - R)), x1 = Math.min(W - 1, Math.ceil(x + R)), y0 = Math.max(0, fl(y - R)), y1 = Math.min(H - 1, Math.ceil(y + R));
    if (!opt.keepMask) { SMB[0] = W; SMB[1] = H; SMB[2] = -1; SMB[3] = -1; }
    for (let Y = y0; Y <= y1; Y++) for (let X = x0; X <= x1; X++) {
      const dx = X + 0.5 - x, dy = Y + 0.5 - y;
      let lx = (dx * ca + dy * sa) / S;
      const ly = (-dx * sa + dy * ca) / S;
      if (flip) lx = -lx;
      const ix = fl(lx) + SOX, iy = fl(ly) + SOY;
      if (ix < 0 || iy < 0 || ix >= SW || iy >= SH) continue;
      const c = SPR[iy * SW + ix];
      if (!c) continue;
      if (opt.alpha !== undefined && bay(X, Y) > opt.alpha) continue;
      const i = Y * W + X;
      BUF[i] = opt.color !== undefined ? opt.color : opt.white ? (SPK[iy * SW + ix] === 4 ? 59 : 22) : c - 1;
      if (!opt.noMask) {
        SMASK[i] = 1;
        if (X < SMB[0]) SMB[0] = X; if (Y < SMB[1]) SMB[1] = Y; if (X > SMB[2]) SMB[2] = X; if (Y > SMB[3]) SMB[3] = Y;
      }
    }
  }
  function clearMask() { if (SMB[2] >= SMB[0]) for (let y = SMB[1]; y <= SMB[3]; y++) SMASK.fill(0, y * W + SMB[0], y * W + SMB[2] + 1); SMB[0] = W; SMB[1] = H; SMB[2] = -1; SMB[3] = -1; }
  // a character in one call: build, optional ghosts and glitch, stamp; returns where its hand and sword tip are
  function actor(o, x, y, S, ang, flip, opt) {
    opt = opt || {};
    const g = buildSprite(o);
    clearMask();
    if (o.who === 'null' && !opt.clean) { // chromatic ghosts either side
      const off = Math.max(1, Math.round(S * 1.2)) + (fl(T_NOW * 12) % 3 === 0 ? 1 : 0);
      stamp(x - off, y, S, ang, flip, { color: 61, alpha: 0.35, noMask: true });
      stamp(x + off, y, S, ang, flip, { color: 42, alpha: 0.35, noMask: true });
    }
    if (opt.after) for (let k = opt.after.length - 1; k >= 0; k--) { const a = opt.after[k]; stamp(a[0], a[1], S, ang, flip, { color: a[2], alpha: a[3], noMask: true }); }
    stamp(x, y, S, ang, flip, opt);
    if (o.who === 'null' && !opt.clean) glitchRows(T_NOW, Math.max(2, Math.round(S * 1.5)) * (1 + (opt.glitch || 0) * 3), opt.glitch ? 0.6 : 0.18);
    const c = Math.cos(ang), s = Math.sin(ang), hx = (flip ? -1 : 1) * g.hand[0] * S, hy = g.hand[1] * S;
    const hand = [x + hx * c - hy * s, y + hx * s + hy * c];
    const sw = o.sword !== undefined && o.sword !== null ? o.sword : 0, da = flip ? PI - sw : sw, tipL = 29 * S;
    const tip = [hand[0] + Math.cos(da + ang) * tipL, hand[1] + Math.sin(da + ang) * tipL];
    return { hand, tip, g };
  }
  // horizontal tears through the last stamped sprite
  const ROWT = new Uint8Array(W);
  function glitchRows(t, amp, prob) {
    prob = prob || 0.18;
    const f = fl(t * 15);
    for (let y = SMB[1]; y <= SMB[3]; y++) {
      const band = fl(y / 3), r = ih(band, f, 51);
      if (r > prob) continue;
      const sh = Math.round((ih(band, f, 52) - 0.5) * 2 * amp);
      if (!sh) continue;
      const o = y * W;
      for (let x = SMB[0]; x <= SMB[2]; x++) ROWT[x] = BUF[o + x];
      for (let x = SMB[0]; x <= SMB[2]; x++) { const sx = x - sh; if (sx >= SMB[0] && sx <= SMB[2] && SMASK[o + sx]) BUF[o + x] = ROWT[sx]; }
    }
  }
  let T_NOW = 0;

  /* ================================================================ auras */
  const ADIST = new Float32Array(NP);
  // flames licking up from the last stamped sprite; cols: dark, mid, bright, core
  function aura(t, cols, R, opt) {
    opt = opt || {};
    if (SMB[2] < SMB[0]) return;
    R = Math.max(2, R);
    const x0 = Math.max(0, SMB[0] - fl(R)), x1 = Math.min(W - 1, SMB[2] + fl(R)), y0 = Math.max(0, SMB[1] - fl(R * 2)), y1 = Math.min(H - 1, SMB[3] + fl(R * 0.8));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const i = y * W + x; ADIST[i] = SMASK[i] ? 0 : 1e9; }
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const i = y * W + x; let d = ADIST[i];
      if (x > x0) d = Math.min(d, ADIST[i - 1] + 1);
      if (y > y0) { d = Math.min(d, ADIST[i - W] + 1); if (x > x0) d = Math.min(d, ADIST[i - W - 1] + 1.41); if (x < x1) d = Math.min(d, ADIST[i - W + 1] + 1.41); }
      ADIST[i] = d;
    }
    for (let y = y1; y >= y0; y--) for (let x = x1; x >= x0; x--) {
      const i = y * W + x; let d = ADIST[i];
      if (x < x1) d = Math.min(d, ADIST[i + 1] + 1);
      if (y < y1) { d = Math.min(d, ADIST[i + W] + 1); if (x < x1) d = Math.min(d, ADIST[i + W + 1] + 1.41); if (x > x0) d = Math.min(d, ADIST[i + W - 1] + 1.41); }
      ADIST[i] = d;
    }
    const cyM = (SMB[1] + SMB[3]) / 2, hh = SMB[3] - SMB[1] + 1, sc = opt.scale || Math.max(1, R / 8);
    const rise = opt.rise === undefined ? 1 : opt.rise;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const i = y * W + x;
      if (SMASK[i]) continue;
      const d = ADIST[i];
      if (d > R * 2.2) continue;
      const up = y < cyM ? 1 + rise * (cyM - y) / hh * 1.1 : 0.75;
      const n = vn(x / sc, (y + t * 70 * rise) / sc, 4, 801) * 0.6 + vn(x / sc, (y + t * 110 * rise) / sc, 2, 802) * 0.4;
      const lim = R * up * (0.35 + 0.85 * n);
      if (d > lim) continue;
      const f = d / lim;
      if (f > 0.82 && bay(x, y) < 0.45) continue;
      BUF[i] = f < 0.25 ? cols[3] : f < 0.55 ? cols[2] : f < 0.82 ? cols[1] : cols[0];
    }
    // sparks streaming up off the flames
    const n = opt.sparks === undefined ? 16 : opt.sparks;
    for (let k = 0; k < n; k++) {
      const u = frac(ih(k, 1, 811) + t * (0.9 + ih(k, 2, 811)));
      const x = lerp(SMB[0] - R * 0.5, SMB[2] + R * 0.5, ih(k, 3, 811)) + Math.sin(u * 6 + k) * 2;
      const y = SMB[3] - u * (hh + R * 3);
      if (bay(fl(x), fl(y)) > 1 - u) continue;
      P(x, y, cols[u < 0.5 ? 3 : 2]); P(x, y + 1, cols[1]);
    }
  }

  /* ================================================================ effects */
  function bolt(x0, y0, x1, y1, seed, w, cCore, cEdge, jag) {
    jag = jag || 0.22;
    const n = Math.max(3, Math.round(Math.hypot(x1 - x0, y1 - y0) / 9)), nx = -(y1 - y0), ny = x1 - x0, L = Math.hypot(nx, ny) || 1;
    let px = x0, py = y0;
    for (let s = 1; s <= n; s++) {
      const u = s / n, o = s < n ? (ih(s, seed, 61) - 0.5) * 2 * jag * Math.hypot(x1 - x0, y1 - y0) / n * 3 : 0;
      const qx = lerp(x0, x1, u) + nx / L * o, qy = lerp(y0, y1, u) + ny / L * o;
      if (w > 1) thick(px, py, qx, qy, w + 1, cEdge);
      lineP(px, py, qx, qy, cCore);
      if (ih(s, seed, 62) < 0.25 && s < n) { const bx = qx + (ih(s, seed, 63) - 0.5) * 24, by = qy + (ih(s, seed, 64) - 0.5) * 24; lineP(qx, qy, bx, by, cEdge); }
      px = qx; py = qy;
    }
  }
  // speed lines streaming toward (cx, cy) from the frame edges
  function radialLines(cx, cy, n, inner, c, t, seed) {
    for (let k = 0; k < n; k++) {
      const a = ih(k, fl(t * 20), seed) * TAU, r0 = inner + ih(k, fl(t * 20) + 1, seed) * 60, r1 = 420;
      const w = ih(k, 3, seed) < 0.3 ? 2 : 1;
      for (let r = r0; r < r1; r += 1) { const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r; if (x < 0 || y < 0 || x >= W || y >= H) break; if (bay(fl(x), fl(y)) < 0.25 + (r - r0) / 300) { P(x, y, c); if (w > 1) P(x + Math.sin(a), y - Math.cos(a), c); } }
    }
  }
  // parallel streaks moving along angle a (motion blur of the world behind a fast flier)
  function streaks(a, n, t, speed, c, len, seed, area) {
    const ca = Math.cos(a), sa = Math.sin(a), A = area || [0, 0, W, H];
    for (let k = 0; k < n; k++) {
      const L = len * (0.5 + ih(k, 1, seed)), px = ih(k, 2, seed) * (A[2] + 200) - 100, py = ih(k, 3, seed) * A[3] + A[1];
      const off = frac(ih(k, 4, seed) + t * speed / 600) * 700 - 200;
      const x0 = px + ca * off, y0 = py + sa * off;
      lineF(x0, y0, x0 + ca * L, y0 + sa * L, (x, y, u) => { if (bay(x, y) < 0.9 - u * 0.6) P(x, y, c); });
    }
  }
  function shockRing(cx, cy, r, ry, w, cols, fade) {
    for (let k = 0; k < w; k++) ring(cx, cy, r - k, ry === null ? r - k : ry * (r - k) / r, k < 1 ? cols[0] : k < w * 0.5 ? cols[1] : cols[2], (x, y) => bay(fl(x), fl(y)) < fade);
  }
  function burst(cx, cy, u, R, rays, rot, cols, th) {
    if (u <= 0 || u >= 1) return;
    const len = R * eoc(u), w0 = th * (1 - u);
    for (let k = 0; k < rays; k++) {
      const a = rot + k * TAU / rays + (ih(k, 1, 71) - 0.5) * 0.25, L = len * (0.55 + 0.45 * ih(k, 2, 71));
      lineF(cx, cy, cx + Math.cos(a) * L, cy + Math.sin(a) * L, (x, y, f) => { if (f > u * 0.85) { P(x, y, f < 0.6 ? cols[0] : cols[1]); if (w0 > 1.2) P(x + 1, y, cols[1]); } });
    }
  }
  // flying debris with gravity
  function debris(cx, cy, age, n, spread, up, cols, seed, g) {
    if (age < 0) return;
    g = g === undefined ? 260 : g;
    for (let k = 0; k < n; k++) {
      const a = -PI * (0.1 + 0.8 * ih(k, 1, seed)), v = spread * (0.4 + ih(k, 2, seed));
      const x = cx + Math.cos(a) * v * age * 1.2, y = cy + Math.sin(a) * v * age * up + g * age * age;
      const s = 1 + fl(ih(k, 3, seed) * 3);
      rectF(x, y, s, s, cols[k % cols.length]); if (s > 1) P(x, y, cols[0]);
    }
  }
  // an energy beam from (x0, y0) to (x1, y1)
  function beam(x0, y0, x1, y1, w, cols, t, seed) {
    const dx = x1 - x0, dy = y1 - y0, L2 = dx * dx + dy * dy, L = Math.sqrt(L2) || 1;
    const bx0 = Math.max(0, fl(Math.min(x0, x1) - w * 2)), bx1 = Math.min(W - 1, Math.ceil(Math.max(x0, x1) + w * 2));
    const by0 = Math.max(0, fl(Math.min(y0, y1) - w * 2)), by1 = Math.min(H - 1, Math.ceil(Math.max(y0, y1) + w * 2));
    for (let y = by0; y <= by1; y++) for (let x = bx0; x <= bx1; x++) {
      const px = x + 0.5 - x0, py = y + 0.5 - y0, u = clamp((px * dx + py * dy) / L2, 0, 1);
      const qx = px - u * dx, qy = py - u * dy, d = Math.sqrt(qx * qx + qy * qy);
      const wob = w * (0.85 + 0.15 * Math.sin(u * L * 0.25 - t * 40 + seed) + 0.08 * Math.sin(u * L * 0.7 + t * 23));
      if (d > wob * 1.5) continue;
      const f = d / wob;
      if (f > 1 && bay(x, y) > (1.5 - f) * 1.4) continue;
      BUF[y * W + x] = f < 0.35 ? 22 : f < 0.6 ? cols[3] : f < 0.85 ? cols[2] : f < 1 ? cols[1] : cols[0];
    }
    // spiralling rings around the beam
    for (let k = 0; k < Math.floor(L / 16); k++) {
      const u = frac(k / Math.floor(L / 16) - t * 2.2), cx = x0 + dx * u, cy = y0 + dy * u, nx = -dy / L, ny = dx / L;
      for (let a = 0; a < TAU; a += 0.15) { const r = w * 1.35, z = Math.sin(a); if (z < 0) continue; P(cx + nx * Math.cos(a) * r + dx / L * z * 2, cy + ny * Math.cos(a) * r + dy / L * z * 2, cols[2]); }
    }
  }
  // two-tone impact frame: everything collapses to ink and light, with a burst of lines
  function impactFrame(cx, cy, mode) {
    for (let i = 0; i < NP; i++) { const p = PAL[BUF[i]], l = p[0] * 0.3 + p[1] * 0.55 + p[2] * 0.15; BUF[i] = mode ? (l > 110 ? 0 : 22) : (l > 140 ? 22 : 0); }
    for (let k = 0; k < 40; k++) { const a = ih(k, 1, 81) * TAU, r0 = 30 + ih(k, 2, 81) * 40; lineF(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0, cx + Math.cos(a) * 500, cy + Math.sin(a) * 500, (x, y) => P(x, y, mode ? 22 : 0)); }
  }
  function flashWhite(a) { if (a <= 0) return; if (a >= 1) { BUF.fill(22); return; } tintAll(T_WH, a); }

  /* ================================================================ backgrounds */
  function gradient(y0, y1, ramp, shift) {
    for (let y = Math.max(0, fl(y0)); y < Math.min(H, y1); y++) {
      const f = clamp((y - y0) / (y1 - y0), 0, 0.9999) * (ramp.length - 1) + (shift || 0), k = fl(f), r = f - k;
      const a = ramp[clamp(k, 0, ramp.length - 1)], b = ramp[clamp(k + 1, 0, ramp.length - 1)];
      for (let x = 0; x < W; x++) BUF[y * W + x] = bay(x, y) < r ? b : a;
    }
  }
  function stars(t, y1, n, seed) {
    for (let k = 0; k < n; k++) { const x = fl(ih(k, 1, seed) * W), y = fl(ih(k, 2, seed) * y1), tw = frac(ih(k, 3, seed) + t * 0.6); P(x, y, tw < 0.15 ? 22 : tw < 0.5 ? 20 : 19); }
  }
  function ridge(yb, h, sc, seed, c, cl, ox) {
    for (let x = 0; x < W; x++) {
      const wx = x + (ox || 0), top = yb - h * fbm(wx, 0, sc, 4, seed);
      for (let y = Math.max(0, fl(top)); y < Math.min(H, yb + 400); y++) BUF[y * W + x] = cl !== undefined && y < top + 2 && fbm(wx + 3, 0, sc, 4, seed) > fbm(wx, 0, sc, 4, seed) ? cl : c;
    }
  }
  function canopy(yb, sc, seed, c, cl, ox, rough) {
    for (let x = 0; x < W; x++) {
      const wx = x + (ox || 0), crowns = Math.abs(Math.sin(wx / sc * 3.1 + vn(wx, 0, sc, seed) * 4)) * sc * 0.45 + vn(wx, 0, sc * 3, seed + 1) * sc * (rough || 1);
      const top = yb - crowns;
      for (let y = Math.max(0, fl(top)); y < H; y++) BUF[y * W + x] = cl !== undefined && y < top + 1.5 ? cl : c;
    }
  }
  // a bank of cumulus: lumpy tops lit from one side, flat darker bases
  function cloudBank(yb, h, sc, seed, ox, cols, lightLeft) {
    for (let x = 0; x < W; x++) {
      const wx = x + (ox || 0), f = fbm(wx, 0, sc, 4, seed), top = yb - h * f, sl = fbm(wx + 2, 0, sc, 4, seed) - f;
      for (let y = Math.max(0, fl(top)); y < H; y++) {
        const dd = y - top, v = dd < 2 ? ((lightLeft ? -sl : sl) > 0 ? 3 : 2) : dd < 6 ? 2 : dd < 16 + 10 * vn(wx, y, 9, seed + 2) ? 1 : 0;
        BUF[y * W + x] = bay(x, y) < 0.18 && v > 0 ? cols[v - 1] : cols[v];
      }
    }
  }
  // a puffy cloud blob centred at (cx, cy), radius r
  function cloudPuff(cx, cy, r, cols, seed) {
    const x0 = Math.max(0, fl(cx - r * 1.6)), x1 = Math.min(W - 1, Math.ceil(cx + r * 1.6)), y0 = Math.max(0, fl(cy - r)), y1 = Math.min(H - 1, Math.ceil(cy + r * 0.7));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const dx = (x + 0.5 - cx) / (r * 1.6), dy = (y + 0.5 - cy) / r, n = vn(x, y, Math.max(3, r * 0.35), seed);
      const d = dx * dx + dy * dy * (dy > 0 ? 3 : 1) - (n - 0.5) * 0.7;
      if (d > 1) continue;
      const l = -dy * 0.8 - dx * 0.3 + (n - 0.5) * 0.6;
      const v = l > 0.45 ? 3 : l > 0 ? 2 : l > -0.45 ? 1 : 0;
      BUF[y * W + x] = d > 0.82 && bay(x, y) < 0.5 ? cols[Math.max(0, v - 1)] : cols[v];
    }
  }
  function letterbox(h) { rectF(0, 0, W, h, 0); rectF(0, H - h, W, h, 0); }

  /* ================================================================ direction: key tracks, fighters, hits, camera */
  // a key track is a list of poses in time: {t, x, y, a (body angle), sw (sword angle), S, reach, sq, alpha, e (ease into this key), ...};
  // numbers ease from key to key, everything else (eyes, mouth, flip, white, glitch ...) holds until the next key changes it
  const EASE = { l: (u) => u, o: eoc, i: eic, io: eio, b: eob, s: (u) => (u >= 1 ? 1 : 0) };
  const NUMF = ['x', 'y', 'a', 'sw', 'reach', 'sq', 'S', 'alpha', 'vib', 'breath'];
  function K(...keys) { for (let i = 1; i < keys.length; i++) for (const f in keys[i - 1]) if (!(f in keys[i]) && f !== 'e' && f !== 't') keys[i][f] = keys[i - 1][f]; return keys; }
  function trk(keys, t) {
    let k = 0;
    while (k < keys.length - 1 && keys[k + 1].t <= t) k++;
    const A = keys[k], B = keys[k + 1], o = Object.assign({}, A);
    if (B && t > A.t) {
      const u = EASE[B.e || 'io'](clamp((t - A.t) / (B.t - A.t), 0, 1));
      for (const f of NUMF) if (typeof A[f] === 'number' && typeof B[f] === 'number') o[f] = A[f] + (B[f] - A[f]) * u;
    }
    return o;
  }
  // hit-stop: the track clock stops for d seconds at each hit (hits given in track time); returns [track time, frozen]
  function stopClock(lt, hits, d) {
    let o = lt, fz = false;
    for (let k = 0; k < hits.length; k++) { const h = hits[k] + k * d; if (lt >= h && lt < h + d) fz = true; o -= clamp(lt - h, 0, d); }
    return [o, fz];
  }
  const rawT = (tt, hits, d) => { let o = tt; for (const h of hits) if (h < tt) o += d; return o; };   // track time → shot time

  // a swing smear: a crescent swept from angle a0 to a1 about (hx, hy), thick at the leading edge, thinning into its tail
  function smearArc(hx, hy, a0, a1, L, cols) {
    let d = a1 - a0;
    while (d > PI) d -= TAU;
    while (d < -PI) d += TAU;
    if (Math.abs(d) < 0.3) return;
    const R = L * 1.1, x0 = Math.max(0, fl(hx - R)), x1 = Math.min(W - 1, Math.ceil(hx + R)), y0 = Math.max(0, fl(hy - R)), y1 = Math.min(H - 1, Math.ceil(hy + R));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const i = y * W + x;
      if (SMASK[i]) continue;
      const dx = x + 0.5 - hx, dy = y + 0.5 - hy, r = Math.hypot(dx, dy);
      if (r > R || r < L * 0.6) continue;
      let rel = Math.atan2(dy, dx) - a0;
      rel = d > 0 ? ((rel % TAU) + TAU) % TAU : ((-rel % TAU) + TAU) % TAU;
      if (rel > Math.abs(d)) continue;
      const u = rel / Math.abs(d), rin = L * lerp(1.0, 0.62, u * u), rout = L * lerp(1.02, 1.06, u);
      if (r < rin || r > rout) continue;
      const e = (r - rin) / (rout - rin), b = bay(x, y);
      if (b > u * 1.6) continue;                          // the tail dissolves
      BUF[i] = e > 0.72 && u > 0.7 ? 22 : u > 0.75 ? cols[2] : u > 0.45 ? (b < 0.5 ? cols[2] : cols[1]) : cols[0];
    }
  }

  // one character driven by a key track: it leans into its motion, stretches with speed, leaves afterimages and smears its swings
  let FRZ = 0;
  function fighter(who, keys, lt, base) {
    base = base || {};
    const p = trk(keys, lt);
    if (p.hide || p.alpha === 0) return null;
    const q = trk(keys, lt - 1 / 30), q2 = trk(keys, lt - 2 / 30);
    const vx = (p.x - q.x) * 30, vy = (p.y - q.y) * 30, sp = Math.hypot(vx, vy);
    const S = p.S || base.S || 2, ox = base.ox || 0, oy = base.oy || 0;
    const lean = p.nolean ? 0 : clamp(vx / 1300, -0.45, 0.45);
    const sq = (p.sq || 0) + (p.breath ? Math.sin(T_NOW * 11) * p.breath : 0) + (sp > 150 ? clamp((Math.abs(vx) - Math.abs(vy)) / 2400, -0.4, 0.4) : 0);
    const vib = (p.vib || 0) + FRZ, f = fl(T_NOW * 30);
    const jx = vib ? Math.round((ih(f, 3, 601) - 0.5) * 2 * vib) : 0, jy = vib ? Math.round((ih(f, 4, 601) - 0.5) * 2 * vib) : 0;
    let legs = p.legs;
    if (p.run) { const s = Math.sin(lt * 20); legs = [Math.max(0, s) * 3, Math.max(0, -s) * 3, Math.max(0, -s) * 3, Math.max(0, s) * 3]; }
    const o = { who, eyes: p.eyes, mouth: p.mouth, sword: typeof p.sw === 'number' ? p.sw : undefined, swordCols: base.swc, legs, fly: p.fly, sq, reach: p.reach, shade: base.shade };
    const after = [];
    if (sp > 380 && !p.noAfter) for (let k = 1; k <= 3; k++) { const a = trk(keys, lt - k * 0.03); after.push([a.x + ox, a.y + oy, base.ghost || (who === 'null' ? 42 : 37), 0.55 - k * 0.14]); }
    const ang = (p.a || 0) + lean;
    const res = actor(o, p.x + jx + ox, p.y + jy + oy, S, ang, !!p.flip, { after, white: p.white, alpha: p.alpha, glitch: p.glitch });
    if (base.aura) aura(T_NOW, base.aura, base.auraR || 7, { sparks: base.sparks === undefined ? 8 : base.sparks, rise: base.rise });
    if (typeof p.sw === 'number' && typeof q2.sw === 'number' && !q2.hide && q2.alpha !== 0) {
      const sa = (p.flip ? PI - p.sw : p.sw) + ang, sa0 = (q2.flip ? PI - q2.sw : q2.sw) + (q2.a || 0) + lean;
      smearArc(res.hand[0], res.hand[1], sa0, sa, 30 * S, base.smear || [19, 20, 21]);
    }
    return { x: p.x + ox, y: p.y + oy, vx, vy, sp, S, hand: res.hand, tip: res.tip, p };
  }
  // dust kicked up behind a fighter skidding along the ground at gy (feet sit 14·S below the body centre)
  function dustTrail(keys, lt, S, gy, oy, seed) {
    for (let k = 1; k <= 7; k++) {
      const a = trk(keys, lt - k * 0.035), b = trk(keys, lt - k * 0.035 - 1 / 30);
      if (a.hide || a.alpha === 0 || Math.abs(a.y + 14 * S - gy) > 5 || Math.abs(a.x - b.x) * 30 < 140) continue;
      const r = 2 + k * 1.7, x = a.x + (ih(k, fl(lt * 30) - k, seed) - 0.5) * 6, y = gy + (oy || 0) - r * 0.5;
      for (let yy = -r; yy <= r; yy++) for (let xx = -r; xx <= r; xx++) if (xx * xx + yy * yy <= r * r && bay(fl(x + xx), fl(y + yy)) > k / 9) P(x + xx, y + yy, yy < -r * 0.3 ? 31 : 30);
    }
  }
  // the moment of a hit (g seconds after it): ink flash, starburst, ring, sparks, glow and shake
  function hitFx(x, y, g, power, cols) {
    if (g < 0 || g > 0.5) return;
    power = power || 1; cols = cols || [22, 59];
    burst(x, y, g / 0.3, 90 * power, 14, ih(fl(x), fl(y), 611) * TAU, cols, 3);
    shockRing(x, y, 6 + g * 320 * power, 4 + g * 210 * power, 3, [22, 20, 19], 1 - g / 0.35);
    for (let k = 0; k < 18; k++) {
      const a = ih(k, fl(x), 612) * TAU, v = (60 + ih(k, 2, 612) * 170) * power, px = x + Math.cos(a) * v * g, py = y + Math.sin(a) * v * g + 200 * g * g;
      if (g < 0.4) { P(px, py, 22); P(px - Math.cos(a) * 2, py - Math.sin(a) * 2, cols[1]); }
    }
    glow(x, y, 50 * power * Math.max(0, 1 - g * 2), T_WH, 0.7);
    shk(5 * power * Math.max(0, 1 - g * 3));
    if (power >= 1 && g < (power >= 1.5 ? 0.067 : 0.034)) impactFrame(x, y, 1);
  }

  // the camera, applied to the finished shot: zoom z and roll r about (fx, fy), which lands on screen at (sx, sy)
  const TMP = new Uint8Array(NP);
  function cam(z, r, fx, fy, sx, sy) {
    if (sx === undefined) { sx = fx; sy = fy; }
    if (Math.abs(z - 1) < 0.002 && Math.abs(r) < 0.002 && fx === sx && fy === sy) return;
    TMP.set(BUF);
    const c = Math.cos(r) / z, s = Math.sin(r) / z;
    for (let y = 0; y < H; y++) {
      const dy = y + 0.5 - sy;
      for (let x = 0; x < W; x++) {
        const dx = x + 0.5 - sx;
        let X = fl(fx + dx * c + dy * s), Y = fl(fy - dx * s + dy * c);
        X = X < 0 ? 0 : X >= W ? W - 1 : X; Y = Y < 26 ? 26 : Y >= H - 26 ? H - 27 : Y;
        BUF[y * W + x] = TMP[Y * W + X];
      }
    }
  }
  // a whip-pan smear along angle dir, amt pixels long
  function whip(amt, dir) {
    if (amt < 1) return;
    TMP.set(BUF);
    const f = fl(T_NOW * 30), ca = Math.cos(dir), sa = Math.sin(dir);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const k = ih(fl(x / 3), y, f + 620) * amt;
      let X = fl(x - ca * k), Y = fl(y - sa * k);
      X = X < 0 ? 0 : X >= W ? W - 1 : X; Y = Y < 0 ? 0 : Y >= H ? H - 1 : Y;
      BUF[y * W + x] = TMP[Y * W + X];
    }
  }
  // a crash-zoom streak: every pixel pulled a random way toward (cx, cy)
  function zoomBlur(cx, cy, amt) {
    if (amt < 0.01) return;
    TMP.set(BUF);
    const f = fl(T_NOW * 30);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const k = 1 - amt * ih(fl(x / 2), fl(y / 2), f + 630);
      let X = fl(cx + (x - cx) * k), Y = fl(cy + (y - cy) * k);
      X = X < 0 ? 0 : X >= W ? W - 1 : X; Y = Y < 0 ? 0 : Y >= H ? H - 1 : Y;
      BUF[y * W + x] = TMP[Y * W + X];
    }
  }

  /* ================================================================ the film: shots */
  const LB = 26;                                           // letterbox bar height
  const SKY_DUSK = [3, 4, 5, 10, 11, 12, 13, 14, 15], SKY_RED = [1, 9, 10, 11, 12, 13], SKY_HIGH = [2, 3, 4, 5, 6, 7], SKY_DAWN = [4, 5, 6, 7, 8, 19, 15, 16];
  const CLOUD_RED = [9, 10, 11, 12], CLOUD_HI = [17, 18, 20, 21], CLOUD_GOLD = [18, 19, 15, 16];
  const HERO = (o) => Object.assign({ who: 'hero' }, o), NULLO = (o) => Object.assign({ who: 'null' }, o);
  const AURA_NULL = [39, 43, 42, 44], AURA_GOLD = [58, 58, 59, 60], AURA_RAIN = (t) => EL[fl(t * 8) % 4].slice(0, 3).concat([60]);
  const GOLD_SW = [58, 59, 60, 59], SM_GOLD = [58, 59, 60], SM_RED = [43, 42, 44];
  const HERO_GOLD = { swc: GOLD_SW, smear: SM_GOLD, ghost: 59, aura: AURA_GOLD, auraR: 7 };
  let SHAKE_A = 0;
  const shk = (a) => { SHAKE_A = Math.max(SHAKE_A, a); };
  // the crack in the sky the Null comes through
  function skyCrack(cx, y0, y1, open, t, scale) {
    scale = scale || 1;
    if (open <= 0) return;
    glow(cx, (y0 + y1) / 2, (y1 - y0) * 0.9 * open, T_RED, 0.55 * open);
    for (let y = fl(y0); y <= y1; y++) {
      const u = (y - y0) / (y1 - y0), jag = (vn(y, 0, 6 * scale, 91) - 0.5) * 26 * scale + (vn(y, 0, 2, 92) - 0.5) * 6 * scale;
      const w = open * (1 - Math.abs(u - 0.5) * 1.8) * 9 * scale + 0.5, x = cx + jag;
      for (let q = -fl(w) - 2; q <= fl(w) + 2; q++) P(x + q, y, Math.abs(q) <= w ? (Math.abs(q) < w - 1.5 ? 0 : 42) : 43);
    }
    for (let k = 0; k < 30 * open; k++) { // squares of broken sky drifting off the edges
      const u = frac(ih(k, 1, 93) + t * 0.25), y = lerp(y0, y1, ih(k, 2, 93)), x = cx + (vn(y, 0, 6 * scale, 91) - 0.5) * 26 * scale + (ih(k, 3, 93) < 0.5 ? -1 : 1) * (10 + u * 50) * scale;
      const s = 1 + fl(ih(k, 4, 93) * 3);
      if (bay(fl(x), fl(y)) > 1 - u) continue;
      rectF(x, y - u * 10, s, s, ih(k, 5, 93) < 0.5 ? 0 : 42);
    }
  }
  function grassField(y0, ox, cols) {
    for (let y = Math.max(0, fl(y0)); y < H; y++) for (let x = 0; x < W; x++) {
      const wx = x + ox * (1 + (y - y0) / 40), n = vn(wx, y * 3, 6, 95);
      BUF[y * W + x] = y < y0 + 2 ? cols[2] : n > 0.62 ? cols[2] : n > 0.35 ? cols[1] : cols[0];
    }
  }
  // the dusk meadow of the ground fight; camX pans it sideways, camY tilts the camera up (the ground drops away)
  const GY = 206, FY = (S) => GY - 14 * S;                 // ground line, and the body centre of a fighter standing on it
  function field(t, camX, camY) {
    camY = camY || 0;
    gradient(LB, H - LB, SKY_RED);
    skyCrack(240 - camX * 0.1, LB + camY * 0.3, 120 + camY * 0.3, 0.7, t, 1.1);
    ridge(196 + camY, 26, 50, 141, 9, 10, camX * 0.3);
    canopy(206 + camY, 8, 142, 1, 10, camX * 0.6, 1.0);
    grassField(GY + camY, camX, [24, 25, 26]);
  }
  function groundCracks(cx, cy, len, n, seed, c0, c1) {
    for (let k = 0; k < n; k++) {
      const a = PI * (ih(k, 1, seed) < 0.5 ? ih(k, 2, seed) * 0.4 : 1 - ih(k, 2, seed) * 0.4);
      let x = cx, y = cy;
      for (let s = 0; s < 7; s++) { const nx = x + Math.cos(a) * len / 7 + (ih(k, s, seed + 1) - 0.5) * 8, ny = y + Math.abs(Math.sin(a)) * len / 50 + (ih(k, s, seed + 2) - 0.5) * 2; lineP(x, y, nx, ny, s < 2 ? c0 : c1); x = nx; y = ny; }
    }
  }
  const SHOTS = [];
  const shot = (t0, t1, fn) => SHOTS.push({ t0, t1, fn });

  // 1 — the vista: a hero on a cliff at dusk; the camera creeps in, the sky cracks, the hero jumps to alert
  shot(0, 2.8, (lt, t) => {
    gradient(0, 205, SKY_DUSK);
    stars(t, 80, 60, 101);
    glow(340, 190, 70, T_WARM, 0.5); discF(340, 192, 20, 15); discF(340, 192, 16, 16);
    const ox = lt * 5;
    ridge(200, 70, 90, 111, 4, 5, ox * 0.3);
    ridge(212, 42, 60, 112, 10, 11, ox * 0.6);
    canopy(232, 9, 113, 23, 24, ox);
    for (let x = 0; x < 170; x++) { const top = 196 + Math.pow(Math.max(0, x - 120) / 50, 2) * 50 + (vn(x, 0, 7, 114) - 0.5) * 4; for (let y = fl(top); y < H; y++) BUF[y * W + x] = y < top + 2 ? 31 : (vn(x, y, 5, 115) > 0.6 ? 29 : 28); }
    tintAll(T_CRIM, sstep(1.6, 2.6, lt) * 0.45);
    skyCrack(300, 22, 150, sstep(1.7, 2.2, lt), t);
    const hop = Math.sin(PI * lin(1.85, 2.15, lt)) * 7;
    actor(HERO({ eyes: lt > 1.85 ? 'wide' : 'normal', sword: lt > 2.0 ? -0.6 : -2.2, sq: lt > 1.8 && lt < 1.88 ? 0.5 : lt < 2.0 && lt > 1.88 ? -0.3 : 0 }), 112, 187 - hop, 1, 0, false);
    if (lt > 1.7 && lt < 2.5) shk(2);
    cam(1 + 0.16 * eio(lt / 2.8) + (lt > 1.75 ? 0.06 * Math.exp(-(lt - 1.75) * 6) : 0), 0, 190, 160);
  });
  // 2 — low angle: the Null drops out of the crack like a meteor and stops dead; the forest bows
  shot(2.8, 4.7, (lt, t) => {
    const land = 0.3, g = lt - land;
    gradient(LB, H - LB, SKY_RED);
    skyCrack(240, LB - 10, 150, 1, t, 1.6);
    const sway = g > 0 ? Math.sin(g * 13) * Math.exp(-g * 2.6) * 18 : 0;
    for (let x = 0; x < W; x++) {
      const e = Math.min(x, W - 1 - x), bend = sway * (x < 240 ? -1 : 1) * Math.max(0, 1 - e / 160), xs = x - bend;
      const top = H - LB - 10 - Math.max(0, 70 - Math.min(xs, W - 1 - xs) * 0.55) - Math.abs(Math.sin(xs * 0.21)) * 14 + Math.abs(bend) * 0.5;
      for (let y = fl(top); y < H; y++) BUF[y * W + x] = y < top + 2 ? 10 : 1;
    }
    if (g > 0) {
      shockRing(240, 150, 20 + g * 640, 10 + g * 150, 5, [44, 42, 22], 1 - g * 1.4);
      for (let k = 0; k < 50; k++) { const a = ih(k, 1, 123) * TAU, r = g * (200 + ih(k, 2, 123) * 300); if (g < 0.8) rectF(240 + Math.cos(a) * r, 120 + Math.sin(a) * r * 0.6, 2, 2, k & 1 ? 23 : 10); }
      shk(7 * Math.exp(-g * 3.5));
      if (g < 0.034) impactFrame(240, 118, 0);
    }
    const y = lt < land ? lerp(-90, 118, eic(lt / land)) : 118 + Math.sin(g * 22) * 7 * Math.exp(-g * 6) + Math.sin(t * 2) * 2;
    const sq = lt < land ? -0.55 : 0.7 * Math.exp(-g * 7) * Math.cos(g * 26);
    if (lt < land) streaks(PI / 2, 50, t, 3000, 42, 100, 122, [0, LB, W, H - 2 * LB]);
    actor(NULLO({ eyes: 'angry', mouth: lt > 0.9 ? 1 : 0, sq }), 240, y, 3, 0, false, lt < land ? { after: [[240, y - 34, 42, 0.5], [240, y - 70, 43, 0.35], [240, y - 106, 0, 0.2]] } : {});
    aura(t, AURA_NULL, 14 + (g > 0 ? 22 * Math.exp(-g * 3) : 0), { sparks: 30 });
    for (let k = 0; k < 40; k++) { const u = frac(ih(k, 1, 121) + t * 0.5); rectF(240 + (ih(k, 2, 121) - 0.5) * 140, y + 40 - u * 120, 2, 2, ih(k, 3, 121) < 0.5 ? 0 : 42); }
    cam(1.08 + (g > 0 ? 0.12 * Math.exp(-g * 5) : 0), -0.07, 240, 130);
  });
  // 3 — crash in on the hero: no. the sword comes out with a smear
  shot(4.7, 5.9, (lt, t) => {
    gradient(LB, H - LB, [10, 11, 12, 11]);
    streaks(0.08, 30, t, 900, 13, 60, 131, [0, LB, W, H - 2 * LB]);
    const swAt = (u) => lerp(-2.6, -1.25, eob(lin(0.42, 0.62, u)));
    const draw = lt > 0.42;
    const a = actor(HERO({ eyes: lt > 0.22 ? 'angry' : 'normal', sword: draw ? swAt(lt) : undefined, shade: true, sq: lt > 0.36 && lt < 0.44 ? 0.12 : 0 }), 230, 172, 7, 0, false);
    if (draw && lt < 0.7) smearArc(a.hand[0], a.hand[1], swAt(lt - 0.07), swAt(lt), 29 * 7, [19, 20, 21]);
    if (lt > 0.62 && lt < 1.0) { const u = (lt - 0.62) / 0.38; sparkle(lerp(a.hand[0], a.tip[0], 0.3 + u * 0.7), lerp(a.hand[1], a.tip[1], 0.3 + u * 0.7), 9 * Math.sin(PI * u), 22, 59); }
    if (lt > 0.42 && lt < 0.6) shk(2);
    cam(1 + 0.2 * eoc(lin(0, 0.18, lt)) + 0.05 * lt, 0, 230, 140);
    zoomBlur(230, 140, 0.18 * (1 - lin(0, 0.2, lt)));
  });
  // 4 — the first clash: both crouch, both dash, blade meets claw, they grind, and the blast throws them apart
  {
    const S = 2.2, Y = FY(S), HITS = [0.62], DS = 0.12;
    const HK = K({ t: 0, x: 104, y: Y, sw: -2.3, eyes: 'angry', a: 0, sq: 0 },
      { t: 0.35, x: 92, y: Y + 5, sq: 0.55, a: -0.18, sw: -2.7, e: 'o' },
      { t: 0.62, x: 196, y: Y, sq: 0, a: 0, sw: 0.25, e: 'i' },
      { t: 1.25, x: 192, sw: -0.05, vib: 1.5, e: 'l' },
      { t: 1.5, x: 112, a: -0.12, sq: 0.35, sw: -0.7, vib: 0, e: 'o' },
      { t: 2.2, x: 106, a: 0, sq: 0, sw: -0.5 });
    const NK = K({ t: 0, x: 376, y: Y, flip: true, eyes: 'angry', mouth: 0, a: 0, sq: 0, reach: 0, alpha: 1 },
      { t: 0.35, x: 388, y: Y + 5, sq: 0.55, a: 0.18, e: 'o' },
      { t: 0.62, x: 274, y: Y, sq: 0, a: 0, reach: 7, mouth: 1, e: 'i' },
      { t: 1.25, x: 278, vib: 1.5, e: 'l' },
      { t: 1.5, x: 364, a: 0.12, sq: 0.35, reach: 0, vib: 0, e: 'o' },
      { t: 1.7, x: 368, a: 0, sq: 0, mouth: 0 },
      { t: 1.78, glitch: 1 }, { t: 1.95, alpha: 0, e: 'l' });
    shot(5.9, 8.1, (lt, t) => {
      const [tt, fz] = stopClock(lt, HITS, DS), g = lt - HITS[0], push = lt > 1.37 ? lt - 1.37 : -1;
      FRZ = fz ? 2 : 0;
      field(t, lt * 6, 0);
      if (g > 0) groundCracks(234, GY + 1, 20 + 90 * eoc(g / 0.6), 8, 141, 22, 27);
      dustTrail(HK, tt, S, GY, 0, 142); dustTrail(NK, tt, S, GY, 0, 143);
      if (lt > 0.35 && lt < 0.62) streaks(0, 40, t, 1800, 20, 90, 144, [0, 120, W, 70]);
      fighter('null', NK, tt, { S, aura: AURA_NULL, auraR: 6 });
      fighter('hero', HK, tt, { S });
      if (g > 0.12 && lt < 1.37) { // grinding: sparks spraying off the contact point
        for (let k = 0; k < 10; k++) { const u = frac(ih(k, 1, 145) + lt * 4), a = -PI * (0.15 + ih(k, 2, 145) * 0.7); P(236 + Math.cos(a) * u * 70, 166 + Math.sin(a) * u * 50 + u * u * 40, u < 0.4 ? 22 : 59); }
        sparkle(236, 166, 6 + Math.sin(t * 50) * 2, 22, 59); shk(1.5);
      }
      if (push > 0) { shockRing(236, 170, 10 + push * 520, 8 + push * 160, 4, [22, 20, 59], 1 - push * 1.6); debris(236, 204, push, 40, 160, 1, [29, 30, 26], 146); shk(5 * Math.exp(-push * 4)); }
      hitFx(236, 166, g, 1.5);
      const zIn = 0.2 * sstep(0.4, 0.62, lt) * (1 - sstep(1.37, 1.6, lt));
      cam(1 + zIn, 0.06 * sstep(0.62, 0.7, lt) * (1 - sstep(1.37, 1.6, lt)), 236, 168);
    });
  }
  // 5 — the exchange: an ambush from a glitch, a duck, a rising cut, a parry, a shoulder charge, a thrust into empty air,
  //     a hammer from above, a roll, and a spinning slash that throws the Null across the field
  {
    const S = 2.2, Y = FY(S), HITS = [0.4, 0.68, 0.85, 1.95], DS = 0.07, SLAM = 1.48;
    const HK = K({ t: 0, x: 180, y: Y, sw: -0.6, eyes: 'angry', a: 0, sq: 0, reach: 0 },
      { t: 0.1, eyes: 'wide' },
      { t: 0.17, y: Y + 9, sq: 0.75, a: -0.25, sw: 0.4, e: 'o' },
      { t: 0.3, y: Y, sq: 0, a: 0, sw: 0.95, eyes: 'angry' },
      { t: 0.42, x: 206, y: Y - 14, a: -0.15, sq: -0.3, sw: -2.0, e: 'o' },
      { t: 0.55, x: 212, y: Y, a: 0, sq: 0, sw: -2.1, e: 'i' },
      { t: 0.68, x: 228, sw: 0.7, e: 'i' },
      { t: 0.85, x: 216, sw: 0.1, sq: 0.25, e: 'o' },
      { t: 1.0, x: 170, sq: 0, e: 'o' },
      { t: 1.12, x: 162, sw: 0, sq: 0.45, e: 'o' },
      { t: 1.24, x: 250, reach: 8, sq: -0.25, e: 'i' },
      { t: 1.32, eyes: 'wide', reach: 0, sq: 0 },
      { t: 1.5, x: 200, a: -TAU, e: 'io' },
      { t: 1.62, x: 194, sw: -2.4, sq: 0.55, eyes: 'angry', e: 'o' },
      { t: 1.8, x: 234, y: Y - 44, a: -TAU, sw: 0, sq: -0.3, e: 'o' },
      { t: 1.95, x: 274, y: Y - 18, a: TAU, sq: 0, e: 'l' },
      { t: 2.15, x: 286, y: Y, a: TAU, sw: 0.3, e: 'b' },
      { t: 2.5, x: 290, sw: -0.5 });
    const NK = K({ t: 0, x: 288, y: Y, flip: true, alpha: 0, glitch: 1, eyes: 'angry', mouth: 0, a: 0, sq: 0, reach: 0 },
      { t: 0.1, alpha: 1, e: 'l' }, { t: 0.13, glitch: 0 },
      { t: 0.2, x: 272, a: -0.15, reach: 8, mouth: 1, e: 'i' },
      { t: 0.3, x: 282, a: 0, reach: 0, mouth: 0 },
      { t: 0.4, x: 286, white: true, eyes: 'wide' }, { t: 0.46, white: false },
      { t: 0.55, x: 314, y: Y - 10, a: -0.35, e: 'o' },
      { t: 0.62, x: 306, y: Y, a: 0, eyes: 'angry', e: 'i' },
      { t: 0.68, reach: 5 }, { t: 0.76, x: 318, reach: 0, e: 'o' },
      { t: 0.8, x: 328, sq: 0.45, e: 'o' },
      { t: 0.85, x: 272, sq: -0.2, a: 0.15, mouth: 1, e: 'i' },
      { t: 1.0, x: 288, sq: 0, a: 0, mouth: 0, e: 'o' },
      { t: 1.17, glitch: 1 }, { t: 1.24, alpha: 0, e: 'l' },
      { t: 1.3, x: 288, y: 60, alpha: 1, glitch: 0, mouth: 2, sq: -0.3, e: 's' },
      { t: 1.48, y: Y, sq: -0.45, a: 0.1, e: 'i' },
      { t: 1.53, sq: 0.6, a: 0, e: 'o' }, { t: 1.62, sq: 0, mouth: 1, e: 'o' },
      { t: 1.95, x: 326, y: Y, white: true, eyes: 'wide', mouth: 2 }, { t: 2.0, white: false },
      { t: 2.08, x: 376, y: Y - 38, a: 3, e: 'o' },
      { t: 2.18, x: 430, y: Y + 3, a: 5, e: 'i' },
      { t: 2.3, x: 478, y: Y - 22, a: 7, e: 'o' },
      { t: 2.45, x: 566, y: Y, a: 9, e: 'i' });
    const HP = [[264, 160], [272, 168], [246, 168], [304, 160]], HPOW = [0.8, 0.6, 0.7, 1.6];
    shot(8.1, 10.6, (lt, t) => {
      const [tt, fz] = stopClock(lt, HITS, DS);
      FRZ = fz ? 1.5 : 0;
      field(t, lt * 30, 0);
      const sl = lt - rawT(SLAM, HITS, DS);
      if (sl > 0) groundCracks(288, GY + 1, 30 + 80 * eoc(sl / 0.4), 7, 151, 42, 27);
      dustTrail(HK, tt, S, GY, 0, 152); dustTrail(NK, tt, S, GY, 0, 153);
      const n = fighter('null', NK, tt, { S, aura: AURA_NULL, auraR: 6 });
      if (n && tt > 0.14 && tt < 0.26) smearArc(n.x - 10, n.y, PI + 1.1, PI - 0.9, 52, SM_RED);
      fighter('hero', HK, tt, { S });
      if (tt > 1.5 && tt < 1.6) streaks(PI, 20, t, 2000, 20, 50, 154, [150, 150, 140, 60]);
      if (sl > 0) { shockRing(288, GY, 10 + sl * 400, 4 + sl * 50, 4, [42, 44, 22], 1 - sl * 2); debris(288, GY - 2, sl, 40, 150, 1.3, [29, 30, 31], 155); shk(5 * Math.exp(-sl * 5)); }
      let z = 1, r = 0;
      for (let k = 0; k < HITS.length; k++) {
        const g = lt - rawT(HITS[k], HITS, DS) - (k ? 0 : 0);
        hitFx(HP[k][0], HP[k][1], g, HPOW[k], k === 3 ? [22, 20] : [22, 59]);
        if (g > 0) { z += 0.1 * HPOW[k] * Math.exp(-g * 9); if (k === 3) r = 0.08 * Math.exp(-g * 4); }
      }
      cam(z, r, 250, 160);
    });
  }
  // 6 — from above: they circle and dart in at each other, again and again, while the world turns under them
  shot(10.6, 11.3, (lt, t) => {
    const rot = lt * 2.2, cr = Math.cos(rot), sr = Math.sin(rot), cx = 240, cy = 135;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const dx = x - cx, dy = y - cy, wx = dx * cr + dy * sr + 600, wy = -dx * sr + dy * cr + 600, n = fbm(wx, wy, 30, 3, 161);
      BUF[y * W + x] = n > 0.62 ? 23 : n > 0.5 ? 24 : n > 0.42 ? 25 : (vn(wx, wy, 3, 162) > 0.5 ? 26 : 25);
    }
    tintAll(T_CRIM, 0.3);
    const orbit = (lq, k) => { const pq = frac(lq * 5), Rq = 100 * (0.2 + 0.8 * Math.pow(Math.abs(Math.cos(PI * pq)), 0.6)), a = lq * 6 + k * PI + fl(lq * 5) * 0.9 + lq * 2.2; return [cx + Math.cos(a) * Rq, cy + Math.sin(a) * Rq * 0.8, a]; };
    const p = frac(lt * 5);
    for (let k = 0; k < 2; k++) {
      for (let q = 16; q >= 1; q--) { const [x, y] = orbit(lt - q * 0.012, k); if (bay(fl(x), fl(y)) < 1 - q / 16) rectF(x - 1, y - 1, 3, 3, k ? 42 : 21); }
      const [x, y, a] = orbit(lt, k);
      actor(k ? NULLO({ eyes: 'angry', reach: p > 0.4 && p < 0.6 ? 6 : 0 }) : HERO({ eyes: 'angry', sword: p > 0.35 && p < 0.6 ? lerp(-1.6, 1.2, (p - 0.35) / 0.25) : -0.6 }), x, y, 2, a + PI, false, { clean: true });
    }
    hitFx(cx, cy, (p - 0.45) * 0.2, 0.7);
    cam(1.1, 0, cx, cy);
  });
  // 7 — blade against claw, pushing in
  shot(11.3, 11.8, (lt, t) => {
    gradient(LB, H - LB, [9, 10, 11, 10]);
    radialLines(240, 135, 60, 70, 12, t, 171);
    const j = Math.round(Math.sin(t * 60) * 1.5), mx = 250 + j, my = 128;
    const bx0 = -40, by0 = 330, ddx = mx + 30 - bx0, ddy = my - 18 - by0, BL = Math.hypot(ddx, ddy), ux = ddx / BL, uy = ddy / BL;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const px = x - bx0, py = y - by0, u = px * ux + py * uy, v = -px * uy + py * ux;
      if (u < 0 || u > BL) continue;
      const hw = u > BL - 40 ? (BL - u) / 40 * 16 : 16;
      if (Math.abs(v) > hw) continue;
      BUF[y * W + x] = Math.abs(v) > hw - 2 ? 0 : v < -hw * 0.25 ? (v < -hw + 4 ? 22 : 34) : Math.abs(v) < 1.5 ? 33 : 32;
    }
    for (let y = 0; y < H; y++) for (let x = mx + 10; x < W; x++) { const yy = my + 26 + (x - mx) * 0.32; if (Math.abs(y - yy) < 26) BUF[y * W + x] = Math.abs(y - yy) > 23 ? 42 : (vn(x, y, 3, 173) > 0.72 ? 41 : 40); }
    for (let k = 0; k < 3; k++) {
      const by = my - 10 + k * 20, bx = mx + 40;
      for (let q = 0; q < 46; q++) { const ww = (1 - q / 46) * 7 + 0.5, cx = bx - q, cy = by + (q * q) / 90 - q * 0.1; for (let s = -ww; s <= ww; s++) P(cx, cy + s, Math.abs(s) > ww - 1.5 ? 42 : s < 0 ? 41 : 39); }
    }
    for (let k = 0; k < 60; k++) { const u = frac(ih(k, 1, 172) + lt * 3), a = -PI * (0.1 + ih(k, 2, 172) * 0.8); const x = mx + Math.cos(a) * u * 160, y = my + Math.sin(a) * u * 100 + u * u * 90; P(x, y, u < 0.4 ? 22 : 59); P(x + 1, y, 58); P(x - Math.cos(a) * 3, y - Math.sin(a) * 3, 58); }
    sparkle(mx, my, 14 + j * 3, 22, 59);
    glow(mx, my, 60, T_GOLD, 0.6);
    shk(2.5);
    cam(1 + lt * 0.5, 0.04 * Math.sin(lt * 40), mx, my);
  });
  // 8 — the ambush: the Null glitches in behind the hero, uppercuts it into the sky, appears above it and hammers it back down
  {
    const S = 2.2, Y = FY(S), HIT = 0.55;
    const HK = K({ t: 0, x: 252, y: Y, sw: -0.5, eyes: 'angry', breath: 0.12, a: 0, sq: 0 },
      { t: 0.32, eyes: 'wide', breath: 0 }, { t: 0.4, flip: true },
      { t: HIT, x: 250, y: Y, a: 0, white: true }, { t: HIT + 0.06, white: false, eyes: 'closed' },
      { t: 0.85, x: 262, y: -70, a: -4, e: 'o' });
    const NK = K({ t: 0, x: 168, y: Y, alpha: 0, glitch: 1, eyes: 'angry', mouth: 1, a: 0, sq: 0, reach: 0 },
      { t: 0.24, alpha: 0, e: 's' }, { t: 0.32, alpha: 1, e: 'l' }, { t: 0.38, glitch: 0 },
      { t: 0.47, x: 186, y: Y + 6, sq: 0.55, e: 'o' },
      { t: HIT, x: 222, y: Y - 26, sq: -0.4, a: -0.5, reach: 8, mouth: 2, e: 'i' },
      { t: 0.85, x: 228, y: Y - 44, sq: 0, a: -0.2, reach: 3, e: 'o' });
    shot(11.8, 13.6, (lt, t) => {
      if (lt < 0.85) {
        const g = lt - HIT, camY = g > 0 ? eoc(lin(HIT, 0.85, lt)) * 150 : 0;
        field(t, 20, camY);
        fighter('null', NK, lt, { S, oy: camY, aura: AURA_NULL, auraR: 6 });
        fighter('hero', HK, lt, { S, oy: camY });
        if (g > 0) streaks(-PI / 2, 50, t, 2600, 20, 80, 181, [0, LB, W, H - 2 * LB]);
        hitFx(244, 156 + camY, g, 1.4);
        cam(1.06 + (g > 0 ? 0.14 * Math.exp(-g * 6) : 0.04 * sstep(0.3, 0.5, lt)), g > 0 ? 0.06 : 0, 230, 160);
      } else {
        const u = lt - 0.85, hit2 = 0.42, g = u - hit2;
        gradient(LB, H - LB, [2, 3, 4, 10, 11]);
        for (let k = 0; k < 16; k++) { const sy = g < 0 ? u * 900 : hit2 * 900 - g * 1600; const y = ((ih(k, 1, 182) * 400 + sy) % 400 + 400) % 400 - 60; cloudPuff(ih(k, 2, 182) * W, y, 14 + ih(k, 3, 182) * 22, CLOUD_RED, 183 + k); }
        streaks(g < 0 ? -PI / 2 : PI / 2, 40, t, 2400, 20, 90, 184, [0, LB, W, H - 2 * LB]);
        const HK2 = K({ t: 0, x: 244, y: 330, a: -5, eyes: 'closed', sw: -0.5 }, { t: 0.28, y: 150, a: -6.6, e: 'o' }, { t: hit2, y: 156, a: -6.9, eyes: 'wide', white: true }, { t: hit2 + 0.06, white: false }, { t: 0.62, y: 440, a: -8, e: 'i' });
        const NK2 = K({ t: 0, x: 250, y: 64, alpha: 0, glitch: 1, eyes: 'angry', mouth: 2, sq: 0, a: 0 }, { t: 0.16, alpha: 0, e: 's' }, { t: 0.22, alpha: 1, e: 'l' }, { t: 0.27, glitch: 0 },
          { t: 0.34, y: 48, sq: -0.45, a: -0.2, e: 'o' }, { t: hit2, y: 108, sq: 0.45, a: 0.25, e: 'i' }, { t: 0.7, y: 102, sq: 0, a: 0, mouth: 1, e: 'o' });
        const n = fighter('null', NK2, u, { S, aura: AURA_NULL, auraR: 7 });
        if (n && u > 0.36 && u < 0.5) smearArc(n.x + 4, n.y + 6, -1.5, 1.3, 46, [42, 44, 22]);
        fighter('hero', HK2, u, { S });
        hitFx(246, 128, g, 1.6);
        cam(1.06 + (g > 0 ? 0.16 * Math.exp(-g * 6) : 0), -0.08, 240, 135);
      }
    });
  }
  // 9 — the crater: the hero comes down like a meteor; the dust rolls out; the Null sinks into frame and gloats
  shot(13.6, 15.8, (lt, t) => {
    const land = 0.12, g = lt - land, cx = 360, cy = 150;
    gradient(LB, H - LB, SKY_RED);
    skyCrack(130, LB, 110, 0.6, t, 0.9);
    for (let y = 0; y < H; y++) for (let x = 230; x < W; x++) { const e = x - 230 - (y - LB) * -0.2 + (vn(x, y, 9, 191) - 0.5) * 20; if (e < 0) continue; BUF[y * W + x] = vn(x, y, 6, 192) > 0.55 ? 29 : 28; }
    if (g < 0) {
      const hy = lerp(-30, cy, lt / land);
      for (let y = 0; y < hy; y++) for (let q = -7; q <= 7; q++) if (bay(cx + q, y) < 1.1 - Math.abs(q) / 8 - (hy - y) / 300) P(cx + q, y, Math.abs(q) < 3 ? 22 : 20);
      actor(HERO({ eyes: 'closed' }), cx, hy, 1.6, lt * 20, false);
    } else {
      for (let y = cy - 50; y < cy + 50; y++) for (let x = cx - 60; x < cx + 60; x++) { const dx = (x - cx) / 56, dy = (y - cy) / 42, d = dx * dx + dy * dy; if (d < 1) P(x, y, d < 0.6 ? 27 : d < 0.85 ? 28 : 30); }
      for (let k = 0; k < 9; k++) { const a = k / 9 * TAU + 0.3; let x = cx + Math.cos(a) * 52, y = cy + Math.sin(a) * 40; for (let s = 0; s < 6; s++) { const nx = x + Math.cos(a + (ih(k, s, 193) - 0.5)) * 9, ny = y + Math.sin(a + (ih(k, s, 194) - 0.5)) * 9; lineP(x, y, nx, ny, 27); x = nx; y = ny; } }
      actor(HERO({ eyes: 'closed', sword: lt > 1.6 ? 0.4 + Math.sin(t * 9) * 0.05 : 0.9 }), cx + 4, cy + 4, 1.6, 0.6, false);
      // a ring of dust rolling out and settling
      for (let k = 0; k < 36; k++) { const a = ih(k, 1, 195) * TAU, r = eoc(g / 1.2) * (60 + ih(k, 2, 195) * 70), rr = 6 + ih(k, 3, 195) * 10 + g * 6; if (bay(k, 5) > 1.2 - g * 0.5) continue; discF(cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.6 - g * 10, rr, k & 1 ? 30 : 29); }
      debris(cx, cy - 20, g, 30, 120, 1.2, [29, 30, 31], 196, 200);
    }
    const ny = lt < 0.55 ? -60 : lerp(-60, 92, eoc(lin(0.55, 1.3, lt))) + Math.sin(t * 2) * 3;
    actor(NULLO({ eyes: 'angry', mouth: lt > 1.4 ? 1 : 0 }), 140, ny, 1.8, 0, false);
    aura(t, AURA_NULL, 8, { sparks: 10 });
    hitFx(cx, cy, g, 1.8, [22, 20]);
    const push = sstep(1.3, 2.2, lt);
    cam(1 + 0.16 * push, 0, lerp(250, 150, push), lerp(140, 110, push), 240, 135);
  });
  // 10 — the eye opens
  shot(15.8, 17.0, (lt, t) => {
    gradient(LB, H - LB, [62, 1, 27, 28]);
    for (let k = 0; k < 40; k++) { const u = frac(ih(k, 1, 203) + t * 0.1); discF(ih(k, 2, 203) * W, H - LB - u * 40, 6 + ih(k, 3, 203) * 10, 27); }
    actor(HERO({ eyes: lt < 0.5 ? 'closed' : 'angry', shade: true }), 240, 236, 10, 0, false);
    for (let k = 0; k < 30; k++) { const u = frac(ih(k, 1, 201) + t * 0.15); P(ih(k, 2, 201) * W, LB + u * 220, 31); }
    if (lt > 0.5) { const u = lin(0.5, 0.8, lt); for (const ex of [160, 320]) { glow(ex, 212, 60, EL_T[fl(t * 10) % 4], 0.45 * u); rectF(ex - 8, 199, 6, 6, 22); rectF(ex + 3, 218, 3, 3, 19); } sparkle(154, 202, 14 * Math.sin(PI * Math.min(1, u * 1.4)), 22, 59); radialLines(240, 212, 30, 150, 22, t, 202); shk(1.5 * u); }
    cam(1 + 0.12 * lt / 1.2 + (lt > 0.5 ? 0.08 * Math.exp(-(lt - 0.5) * 8) : 0), 0, 240, 205);
  });
  // 11a — rising: rocks lift, the ground splits in every element's colour, the hero shakes and screams
  shot(17.0, 18.5, (lt, t) => {
    const S = lerp(2.4, 3.0, lt / 1.5), rise = eio(lin(0.1, 1.2, lt));
    gradient(LB, 200, SKY_RED);
    tintAll(T_DARK, 0.25);
    for (let y = 200; y < H; y++) for (let x = 0; x < W; x++) BUF[y * W + x] = vn(x, y * 2, 8, 211) > 0.55 ? 29 : 28;
    for (let k = 0; k < 12; k++) {
      const a = PI * (k / 11), e = k % 4; let x = 240, y = 214;
      for (let s = 0; s < 10; s++) { const nx = x + Math.cos(a) * 26 + (ih(k, s, 212) - 0.5) * 14, ny = y + Math.sin(a) * 4 + (ih(k, s, 213) - 0.5) * 3; lineF(x, y, nx, ny, (px, py) => { if (s < lt * 9) { P(px, py, EL[e][2]); P(px, py - 1, EL[e][1]); } }); x = nx; y = ny; }
    }
    for (let k = 0; k < 30; k++) {
      const x = 240 + (ih(k, 1, 214) - 0.5) * 440, s = 2 + fl(ih(k, 2, 214) * 5), up = clamp(lt * 1.8 - ih(k, 3, 214), 0, 3) * (30 + ih(k, 4, 214) * 50);
      const y = 216 + ih(k, 5, 214) * 20 - up + Math.sin(t * 3 + k) * 2;
      rectF(x, y, s, s, 29); rectF(x, y, s, 1, 31); rectF(x, y + s - 1, s, 1, 27);
    }
    const hy = lerp(206, 146, rise), v = 0.5 + lt * 1.5, jx = Math.round((ih(fl(t * 30), 1, 216) - 0.5) * 2 * v);
    actor(HERO({ eyes: 'angry', mouth: lt > 0.7 ? 2 : 0, sword: -1.2, legs: [1, 1, 1, 1], sq: lt > 0.7 ? -0.15 + Math.sin(t * 40) * 0.08 : 0 }), 240 + jx, hy, S, 0, false);
    const cols = AURA_RAIN(t);
    aura(t, cols, 10 + lt * 9, { sparks: 34 });
    for (let k = 0; k < 4; k++) if (ih(k, fl(t * 12), 215) < 0.55) { const a = ih(k, fl(t * 12) + 9, 215) * TAU; bolt(240 + Math.cos(a) * 20, hy - 20 + Math.sin(a) * 20, 240 + Math.cos(a) * 90, hy - 20 + Math.sin(a) * 70, fl(t * 12) + k, 1, 22, cols[2]); }
    glow(240, hy - 20, 120, EL_T[fl(t * 8) % 4], 0.3);
    shk(0.5 + lt * 1.6);
    cam(1 + lt * 0.1, 0, 240, hy);
  });
  // 11b — the Null braces against the blast of it
  shot(18.5, 19.2, (lt, t) => {
    gradient(LB, H - LB, [1, 9, 10, 9]);
    glow(0, 135, 320, T_GOLD, 0.45 + Math.sin(t * 30) * 0.1);
    streaks(0, 70, t, 3000, 59, 110, 221, [0, LB, W, H - 2 * LB]);
    streaks(0, 30, t, 2400, 22, 70, 222, [0, LB, W, H - 2 * LB]);
    for (let k = 0; k < 30; k++) { const u = frac(ih(k, 1, 223) + lt * 2.2), y = LB + ih(k, 2, 223) * 210; const s = 2 + fl(ih(k, 3, 223) * 5); rectF(u * 560 - 40, y + Math.sin(u * 9 + k) * 6, s, s, k & 1 ? 29 : 31); }
    const jx = Math.round((ih(fl(t * 30), 1, 224) - 0.5) * 4);
    actor(NULLO({ eyes: 'wide', mouth: 1, sq: 0.2 }), lerp(296, 330, eoc(lt / 0.7)) + jx, 150, 3, 0.18, true);
    aura(t, AURA_NULL, 8, { sparks: 6, rise: 0.2 });
    shk(2.5);
    cam(1.08, -0.06, 300, 150);
  });
  // 11c — the scream: close, shaking, the aura boiling over
  shot(19.2, 20.0, (lt, t) => {
    gradient(LB, H - LB, [1, 9, 10, 11]);
    radialLines(240, 150, 80, 60, EL[fl(t * 12) % 4][2], t, 231);
    const jx = Math.round((ih(fl(t * 30), 1, 232) - 0.5) * 6), jy = Math.round((ih(fl(t * 30), 2, 232) - 0.5) * 4);
    actor(HERO({ eyes: lt > 0.45 ? 'glow' : 'angry', mouth: 2, sword: -1.3, sq: -0.1 + Math.sin(t * 50) * 0.06 }), 240 + jx, 196 + jy, 5, 0, false);
    aura(t, AURA_RAIN(t), 24 + lt * 16, { sparks: 50 });
    for (let k = 0; k < 6; k++) if (ih(k, fl(t * 15), 233) < 0.6) { const a = ih(k, fl(t * 15) + 9, 233) * TAU; bolt(240 + Math.cos(a) * 40, 150 + Math.sin(a) * 30, 240 + Math.cos(a) * 240, 150 + Math.sin(a) * 160, fl(t * 15) + k, 2, 22, EL[k % 4][2]); }
    shk(4);
    cam(1 + lt * 0.25, 0, 240, 160);
    zoomBlur(240, 160, lt * 0.18);
  });
  // 12 — white: TOGETHER
  shot(20.0, 20.6, (lt, t) => {
    rectF(0, 0, W, H, 60);
    radialLines(240, 135, 70, 20, 58, t, 241);
    const R = 30 + lt * 500; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const d = Math.hypot(x - 240, y - 135); if (d < R) BUF[y * W + x] = d < R - 40 ? 22 : bay(x, y) < 0.5 ? 22 : 59; }
    shk(4);
  });
  // 13 — fable mode: the camera tilts up the hero from its feet, in gold
  shot(20.6, 21.8, (lt, t) => {
    gradient(LB, H - LB, [58, 15, 14, 13, 12]);
    for (let k = 0; k < 24; k++) { const a = k / 24 * TAU + t * 0.3; if (!(k & 1)) continue; for (let r = 20; r < 400; r += 1) { const x = 240 + Math.cos(a) * r, y = 150 + Math.sin(a) * r; if (bay(fl(x), fl(y)) < 0.4) P(x, y, 59); } }
    for (let y = 215; y < H; y++) for (let x = 0; x < W; x++) BUF[y * W + x] = vn(x, y * 2, 8, 251) > 0.55 ? 29 : 28;
    const a = actor(HERO({ eyes: 'glow', sword: -1.57, swordCols: GOLD_SW }), 240, 170, 3.5, 0, false);
    aura(t, AURA_GOLD, 16, { sparks: 40 });
    sparkle(a.tip[0], a.tip[1], 6 + Math.sin(t * 10) * 2, 22, 59);
    for (let k = 0; k < 50; k++) { const u = frac(ih(k, 1, 252) + t * 0.6); P(240 + (ih(k, 2, 252) - 0.5) * 300, 220 - u * 200, EL[k & 3][2]); }
    const u = eio(lin(0, 0.9, lt));
    cam(lerp(1.7, 1.0, u), 0, 240, lerp(222, 135, u), 240, 135);
  });
  // 14 — the new speed: the Null sneers, the hero is simply there, one cut, and the Null is gone into the sky; the hero follows
  {
    const HIT = 0.7, S = 2.4;
    const NK = K({ t: 0, x: 332, y: 158, flip: true, eyes: 'angry', mouth: 1, a: 0, sq: 0 },
      { t: 0.6, eyes: 'wide', mouth: 0 },
      { t: HIT, x: 332, y: 158, white: true, mouth: 2 }, { t: HIT + 0.07, white: false },
      { t: HIT + 0.35, x: 580, y: -130, a: -5, e: 'o' });
    const HK = K({ t: 0, x: 282, y: 160, alpha: 0, sw: -2.6, eyes: 'glow', a: 0, sq: 0 },
      { t: 0.55, alpha: 0, e: 's' }, { t: 0.56, alpha: 1, e: 's' },
      { t: 0.63, sw: -2.7, sq: 0.15 }, { t: HIT, sw: 0.95, sq: -0.1, e: 'i' },
      { t: 0.98, sw: 0.9, sq: 0 },
      { t: 1.06, y: 170, sq: 0.65, sw: -1.3, e: 'o' },
      { t: 1.12, sq: -0.5 },
      { t: 1.42, x: 580, y: -130, a: -0.7, e: 'i' });
    shot(21.8, 23.6, (lt, t) => {
      const g = lt - HIT, go = lt - 1.12;
      gradient(LB, 214, [13, 14, 15, 14]);
      ridge(214, 60, 90, 246, 12, 13, 0); ridge(214, 30, 50, 247, 11, 12, 40);
      for (let y = 214; y < H; y++) for (let x = 0; x < W; x++) BUF[y * W + x] = vn(x, y * 2, 8, 261) > 0.55 ? 29 : 28;
      if (lt > 0.5 && lt < 0.62) { const u = (lt - 0.5) / 0.12; for (let x = 0; x < 282 * Math.min(1, u * 2); x++) for (let q = -3; q <= 3; q++) if (bay(x, 160 + q) < 1 - u - Math.abs(q) / 5) P(x, 160 + q, Math.abs(q) < 2 ? 22 : 59); }
      if (go > 0) { // the take-off: a gold column from the ground and a crater ring
        const hp = trk(HK, lt);
        lineF(282, 200, hp.x, hp.y, (x, y) => { for (let q = -5; q <= 5; q++) if (bay(fl(x + q), fl(y)) < 1.2 - Math.abs(q) / 6 - go * 1.2) P(x + q, y, Math.abs(q) < 2 ? 22 : 59); });
        shockRing(282, 214, 10 + go * 420, 4 + go * 40, 4, [22, 59, 58], 1 - go * 1.6);
        debris(282, 212, go, 50, 160, 1.4, [29, 30, 31], 262); shk(4 * Math.exp(-go * 4));
      }
      fighter('null', NK, lt, { S, aura: AURA_NULL, auraR: 7 });
      fighter('hero', HK, lt, Object.assign({ S }, HERO_GOLD, { auraR: 8 }));
      if (g > 0 && g < 0.4) streaks(-0.9, 40, t, 2600, 22, 90, 263, [0, LB, W, H - 2 * LB]);
      hitFx(324, 148, g, 2, [22, 59]);
      cam(1.05 + (g > 0 ? 0.18 * Math.exp(-g * 5) : 0.06 * sstep(0.5, 0.7, lt)), g > 0 ? -0.07 * Math.exp(-g * 3) : 0, 300, 150);
    });
  }
  // 15 — the chase: behind the hero; the Null throws bolts back; the hero sidesteps, barrel-rolls, and closes in
  {
    const HK = K({ t: 0, x: 240, y: 200, a: 0, sw: -0.9, eyes: 'glow', fly: true, S: 2.4 },
      { t: 0.55, x: 240 }, { t: 0.62, x: 160, e: 'o' },
      { t: 0.95, x: 160, a: 0 }, { t: 1.04, x: 310, a: TAU, e: 'o' },
      { t: 1.38, x: 310, a: TAU }, { t: 1.45, x: 240, e: 'o' },
      { t: 1.6, y: 160, S: 1.6, e: 'i' });
    const TGT = [240, 160, 310];
    shot(23.6, 25.2, (lt, t) => {
      gradient(LB, H - LB, SKY_HIGH);
      const VX = 240, VY = 118;
      for (let k = 0; k < 26; k++) {
        const z = frac(ih(k, 1, 271) - lt * 1.1) + 0.06, sx = (ih(k, 2, 271) - 0.5) * 900, sy = (ih(k, 3, 271) - 0.5) * 300 + 60;
        const x = VX + sx / (z * 6), y = VY + sy / (z * 6), r = 30 / z * 0.35;
        if (r > 140) continue;
        cloudPuff(x, y, r, CLOUD_HI, 272 + k);
      }
      radialLines(VX, VY, 50, 80, 21, t, 273);
      const nx = VX + Math.sin(t * 3.2) * 40, ny = VY - 6 + Math.cos(t * 2.4) * 16;
      actor(NULLO({ eyes: 'angry', mouth: 1 }), nx, ny, 0.9 + lt * 0.15, Math.sin(t * 3.2) * 0.3, false);
      aura(t, AURA_NULL, 4, { sparks: 4 });
      for (let k = 0; k < 3; k++) {
        const t0 = 0.2 + k * 0.42, u = (lt - t0) / 0.42;
        if (u > 0 && u < 1) { const bx = lerp(nx, TGT[k], u), by = lerp(ny, 205, u), r = 2 + u * 18; glow(bx, by, r * 2.2, T_RED, 0.5); discF(bx, by, r, 42); discF(bx, by, r * 0.6, 44); discF(bx, by, r * 0.3, 22); }
        const g = lt - t0 - 0.42;
        if (g > 0 && g < 0.2) { burst(TGT[k], 215, g / 0.2, 140, 12, k, [44, 42], 3); shk(3); }
      }
      fighter('hero', HK, lt, Object.assign({}, HERO_GOLD, { auraR: 9, rise: 0.4 }));
      cam(1.05, 0.1 * Math.sin(lt * 3), 240, 150);
    });
  }
  // 16 — the speed battle: two streaks, gold and red, meeting all over the sky faster and faster, then locking
  {
    const CP = [[120, 92], [360, 72], [250, 188], [92, 166], [398, 158], [200, 64], [330, 124], [240, 132]];
    const CT = [0.15, 0.47, 0.75, 1.0, 1.22, 1.41, 1.58, 1.73], HOLD = 0.1;
    const START = [[-60, 210], [540, 30]];
    function streakAt(lt, side) { // side 0 hero, 1 Null; where the streak head is
      if (lt >= CT[CT.length - 1]) return CP[CP.length - 1];
      let k = 0; while (CT[k] <= lt) k++;
      const A = k ? CP[k - 1] : START[side], t0 = k ? CT[k - 1] + HOLD : 0, B = CP[k];
      const u = eio(clamp((lt - t0) / (CT[k] - t0), 0, 1)), mx = (A[0] + B[0]) / 2, my = (A[1] + B[1]) / 2, L = Math.hypot(B[0] - A[0], B[1] - A[1]) || 1;
      const s = (side ? -1 : 1) * (ih(k, 1, 281) < 0.5 ? 1 : -1) * 0.5 * L, cxp = mx - (B[1] - A[1]) / L * s, cyp = my + (B[0] - A[0]) / L * s;
      const a = (1 - u) * (1 - u), b = 2 * (1 - u) * u, c = u * u;
      return [a * A[0] + b * cxp + c * B[0] + (side ? 14 : -14) * u, a * A[1] + b * cyp + c * B[1]];
    }
    shot(25.2, 27.4, (lt, t) => {
      gradient(LB, 240, SKY_HIGH);
      cloudBank(246, 34, 70, 282, t * 30, CLOUD_RED, true);
      for (let k = 0; k < 6; k++) cloudPuff(ih(k, 1, 283) * W, 60 + ih(k, 2, 283) * 120, 10 + ih(k, 3, 283) * 14, CLOUD_HI, 284 + k);
      const locked = lt >= CT[CT.length - 1];
      for (let side = 0; side < 2; side++) {
        const cc = side ? [44, 42, 43] : [22, 60, 59];
        for (let j = 24; j >= 1; j--) {
          const p0 = streakAt(lt - j * 0.006, side), p1 = streakAt(lt - (j - 1) * 0.006, side), w = Math.max(1, 4 - j * 0.14);
          lineF(p0[0], p0[1], p1[0], p1[1], (x, y) => { if (bay(fl(x), fl(y)) >= Math.pow(j / 25, 1.5)) for (let q = -w; q <= w; q++) P(x, y + q, Math.abs(q) < w * 0.4 ? cc[0] : j < 10 ? cc[1] : cc[2]); });
        }
      }
      let k = -1; for (let i = 0; i < CT.length; i++) if (lt >= CT[i] && lt < CT[i] + HOLD) k = i;
      if (k >= 0 || locked) {
        const C = locked ? CP[CP.length - 1] : CP[k], v = locked ? 1.5 : 0, j = Math.round((ih(fl(t * 30), 1, 285) - 0.5) * 2 * v);
        actor(HERO({ eyes: 'glow', sword: -0.2, swordCols: GOLD_SW }), C[0] - 22 + j, C[1] + 2, 2, -0.1, false);
        aura(t, AURA_GOLD, 6, { sparks: 6 });
        actor(NULLO({ eyes: 'angry', mouth: 2, reach: 6 }), C[0] + 26 - j, C[1] + 2, 2, 0.1, true);
        aura(t, AURA_NULL, 6, { sparks: 6 });
      } else for (let side = 0; side < 2; side++) { const p = streakAt(lt, side); glow(p[0], p[1], 26, side ? T_RED : T_GOLD, 0.7); discF(p[0], p[1], 6, side ? 42 : 59); discF(p[0], p[1], 3, 22); }
      for (let i = 0; i < CT.length; i++) hitFx(CP[i][0], CP[i][1], lt - CT[i], i === CT.length - 1 ? 1.2 : 0.7);
      if (locked) { const g = lt - CT[CT.length - 1]; radialLines(240, 132, 40, 50, 22, t, 286); for (let q = 0; q < 12; q++) { const u = frac(ih(q, 1, 287) + lt * 3), a = ih(q, 2, 287) * TAU; P(242 + Math.cos(a) * u * 60, 128 + Math.sin(a) * u * 40, 22); } shk(2.5); cam(1 + 0.4 * eoc(g / 0.4), 0.05 * Math.sin(lt * 30), 242, 132); }
    });
  }
  // 17 — hammered down into the sea of cloud, and back up out of it
  shot(27.4, 29.4, (lt, t) => {
    if (lt < 0.75) {
      const hit = 0.25, g = lt - hit;
      gradient(LB, H - LB, SKY_HIGH);
      cloudBank(250, 40, 70, 291, 0, CLOUD_RED, true);
      const sp = lt < hit ? eic(lt / hit) * TAU * 2 : 0, ny = lt < hit ? 142 : lerp(142, 440, eic(lin(hit, 0.75, lt)));
      if (g > 0) streaks(-PI / 2, 40, t, 2600, 20, 80, 292, [180, LB, 120, H - 2 * LB]);
      actor(NULLO({ eyes: 'wide', mouth: 1 }), 240, ny, 1.8, g > 0 ? g * 14 : 0, false, { white: g > 0 && g < 0.06 });
      const a = actor(HERO({ eyes: 'glow', sword: lt < hit ? -1.6 + sp : 1.45, swordCols: GOLD_SW }), 240, lt < hit ? 92 : 102, 1.8, 0, false);
      aura(t, AURA_GOLD, 8, { sparks: 10 });
      if (lt < hit + 0.05 && lt > 0.03) smearArc(a.hand[0], a.hand[1], lt < hit ? -1.6 + eic((lt - 0.06) / hit) * TAU * 2 : 1.45 - 1.2, lt < hit ? -1.6 + sp : 1.45, 30 * 1.8, SM_GOLD);
      hitFx(240, 126, g, 1.6, [22, 59]);
      cam(1.05 + (g > 0 ? 0.14 * Math.exp(-g * 6) : 0), 0, 240, 120);
    } else {
      const u = lt - 0.75;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const n = fbm(x, y, 36, 4, 293); const d = Math.hypot(x - 240, (y - 135) * 1.3); const hole = 30 + u * 40; BUF[y * W + x] = d < hole ? (d < hole - 6 ? (vn(x, y, 6, 294) > 0.5 ? 10 : 9) : 4) : n > 0.6 ? 21 : n > 0.48 ? 20 : n > 0.38 ? 19 : 18; }
      ring(240, 135, 30 + u * 40, (30 + u * 40) / 1.3, 22);
      if (u > 0.4) {
        const v = (u - 0.4) / 0.85;
        actor(NULLO({ eyes: 'angry', mouth: 2 }), 240, lerp(140, 120, v), lerp(1, 3.4, eoc(v * 1.5)), 0, false);
        aura(t, AURA_NULL, 8 + v * 16, { sparks: 30 });
        radialLines(240, 130, 50, 60, 42, t, 295);
        if (v < 0.3) { shockRing(240, 135, 20 + v * 600, 16 + v * 460, 5, [42, 44, 22], 1 - v * 3); }
        shk(2 + v * 3);
        zoomBlur(240, 130, 0.12 * (1 - v));
      }
    }
  });
  // 18 — the Null gathers a black-red orb
  shot(29.4, 30.5, (lt, t) => {
    gradient(LB, H - LB, [1, 9, 10, 9]);
    radialLines(330, 140, 50, 60, 10, t, 301);
    const jx = Math.round((ih(fl(t * 30), 1, 302) - 0.5) * 2 * (1 + lt * 2));
    actor(NULLO({ eyes: 'angry', mouth: lt > 0.4 ? 2 : 1, reach: 6 }), 170 + jx, 160, 4, -0.05, false);
    aura(t, AURA_NULL, 18 + lt * 6, { sparks: 30 });
    const r = 6 + eoc(lt / 1.1) * 30, ox = 330, oy = 140;
    glow(ox, oy, r * 3, T_RED, 0.6);
    for (let y = fl(oy - r); y <= oy + r; y++) for (let x = fl(ox - r); x <= ox + r; x++) { const d = Math.hypot(x - ox, y - oy) / r + (vn(x, y + t * 80, 4, 303) - 0.5) * 0.35; if (d < 1) P(x, y, d < 0.35 ? 0 : d < 0.6 ? 43 : d < 0.85 ? 42 : 44); }
    for (let k = 0; k < 3; k++) if (ih(k, fl(t * 15), 304) < 0.6) bolt(ox, oy, ox + (ih(k, fl(t * 15) + 1, 304) - 0.5) * 140, oy + (ih(k, fl(t * 15) + 2, 304) - 0.5) * 120, fl(t * 15) + k, 1, 44, 42);
    for (let k = 0; k < 40; k++) { const u = frac(ih(k, 1, 305) - t * 1.5), a = ih(k, 2, 305) * TAU; P(ox + Math.cos(a) * u * 120, oy + Math.sin(a) * u * 90, u < 0.5 ? 42 : 43); }
    shk(1 + lt * 2);
    cam(1 + lt * 0.14, 0.04, 260, 150);
  });
  // 19 — the hero gathers every element on the point of the sword
  shot(30.5, 31.6, (lt, t) => {
    gradient(LB, H - LB, [5, 6, 7, 6]);
    radialLines(150, 120, 50, 60, 8, t, 311);
    const jx = Math.round((ih(fl(t * 30), 1, 312) - 0.5) * 2 * (1 + lt * 2));
    const a = actor(HERO({ eyes: 'glow', sword: -0.25, swordCols: GOLD_SW }), 330 + jx, 170, 4, 0.05, true);
    aura(t, AURA_GOLD, 18 + lt * 6, { sparks: 30 });
    const ox = a.tip[0] - 6, oy = a.tip[1], r = 5 + eoc(lt / 1.1) * 22;
    for (let e = 0; e < 4; e++) { const ang = t * 7 + e * PI / 2, rr = r * 1.8 * (1 - lt / 1.3); const ex = ox + Math.cos(ang) * rr, ey = oy + Math.sin(ang) * rr * 0.6; glow(ex, ey, 14, EL_T[e], 0.6); discF(ex, ey, 4, EL[e][2]); discF(ex, ey, 2, 22); }
    glow(ox, oy, r * 3, T_GOLD, 0.7);
    for (let y = fl(oy - r); y <= oy + r; y++) for (let x = fl(ox - r); x <= ox + r; x++) { const d = Math.hypot(x - ox, y - oy) / r + (vn(x, y - t * 80, 4, 313) - 0.5) * 0.3; if (d < 1) P(x, y, d < 0.4 ? 22 : d < 0.7 ? 60 : EL[fl(Math.atan2(y - oy, x - ox) / TAU * 4 + 4 + t * 3) % 4][2]); }
    shk(1 + lt * 2);
    cam(1 + lt * 0.14, -0.04, 220, 150);
  });
  // 20 — the beams meet; the struggle shoves both fighters back and forth; the camera crashes in on the clash
  function clashAt(lt) { const u = lt * 2.2 / 2.6; return 240 + Math.sin(u * 2.2) * 34 * (u < 1.4 ? 1 : 0) + (u > 1.4 ? -(u - 1.4) * 60 : 0) + 20 * sstep(0.6, 1.2, u); }
  shot(31.6, 34.2, (lt, t) => {
    gradient(LB, 236, SKY_HIGH);
    cloudBank(226, 26, 60, 321, t * 40, CLOUD_RED, false);
    const cx = clashAt(lt), cy = 132;
    for (let k = 0; k < 4; k++) { const r = frac(lt * 1.2 + k / 4) * 260; ring(cx, 226, r, r * 0.12, 22, (x, y) => bay(fl(x), fl(y)) < 1 - r / 260); }
    const f = fl(t * 30), j1 = Math.round((ih(f, 1, 322) - 0.5) * 3), j2 = Math.round((ih(f, 2, 322) - 0.5) * 3);
    const nx = 66 - Math.max(0, 240 - cx) * 0.25 + j1, hx = 414 + Math.max(0, cx - 240) * 0.3 + j2;
    actor(NULLO({ eyes: 'angry', mouth: 2, reach: 6, sq: 0.15 }), nx, 132, 1.5, 0.05, false);
    aura(t, AURA_NULL, 8, { sparks: 10 });
    actor(HERO({ eyes: 'glow', sword: -0.05, swordCols: GOLD_SW, sq: 0.15 }), hx, 132, 1.5, -0.05, true);
    aura(t, AURA_GOLD, 8, { sparks: 10 });
    beam(nx + 18, 130, cx, cy, 11, [43, 42, 44, 44], t, 1);
    beam(hx - 26, 130, cx, cy, 11, [58, 58, 59, 60], t, 2);
    const R = 18 + Math.sin(t * 30) * 2 + lt * 4;
    glow(cx, cy, R * 3, T_WH, 0.6);
    for (let y = fl(cy - R); y <= cy + R; y++) for (let x = fl(cx - R); x <= cx + R; x++) { const d = Math.hypot(x - cx, y - cy) / R + (vn(x, y, 3, fl(t * 20)) - 0.5) * 0.4; if (d < 1) P(x, y, d < 0.5 ? 22 : x < cx ? 44 : 60); }
    for (let k = 0; k < 4; k++) if (ih(k, fl(t * 15), 323) < 0.7) { const a = ih(k, fl(t * 15) + 1, 323) * TAU; bolt(cx, cy, cx + Math.cos(a) * 80, cy + Math.sin(a) * 60, fl(t * 15) + k * 5, 1, 22, k & 1 ? 42 : 59); }
    shk(2.5);
    const zin = sstep(0.9, 1.15, lt) * (1 - sstep(1.75, 2.0, lt));
    cam(1.04 + 0.6 * zin, 0.05 * zin * Math.sin(t * 20), cx, cy, 240, 135);
    zoomBlur(240, 135, 0.1 * (sstep(0.9, 1.0, lt) - sstep(1.0, 1.1, lt)));
  });
  // 21 — strike
  shot(34.2, 35.3, (lt, t) => {
    gradient(LB, H - LB, [58, 59, 60, 59]);
    radialLines(240, 140, 90, 70, 58, t, 331);
    actor(HERO({ eyes: 'glow', mouth: 2, sword: -0.6, swordCols: GOLD_SW, sq: Math.sin(t * 50) * 0.05 }), 236, 196, 6, 0, false);
    aura(t, [58, 59, 60, 22], 22 + lt * 10, { sparks: 40 });
    shk(4);
    cam(1 + lt * 0.15, 0, 236, 170);
    zoomBlur(236, 170, 0.08 + lt * 0.08);
  });
  // 22 — overpowered: the gold beam eats the red one and the Null; then the dome of light over the clouds
  shot(35.3, 37.4, (lt, t) => {
    if (lt < 0.8) {
      gradient(LB, 236, SKY_HIGH);
      cloudBank(226, 26, 60, 321, t * 40, CLOUD_RED, false);
      const cx = lerp(clashAt(2.6), 40, eic(lin(0, 0.6, lt))), w = 11 + eic(lin(0, 0.7, lt)) * 40;
      actor(NULLO({ eyes: 'wide', mouth: 2 }), 66 - lt * 20, 132, 1.5, -lt * 0.5, false, { white: lt > 0.45 });
      if (cx - 20 > 96) beam(84, 130, cx - 20, 132, 11 * (1 - lin(0, 0.55, lt)) + 3, [43, 42, 44, 44], t, 1);
      beam(388, 130, cx - 20, 132, w, [58, 59, 60, 60], t, 2);
      if (cx - 20 > 96) { glow(cx - 20, 132, 50, T_WH, 0.7); discF(cx - 20, 132, 14 + w * 0.3, 22); }
      actor(HERO({ eyes: 'glow', mouth: 2, sword: -0.05, swordCols: GOLD_SW }), 414, 132, 1.5, 0, true);
      aura(t, AURA_GOLD, 9, { sparks: 10 });
      shk(3 + lt * 4);
      cam(1.04 + lt * 0.1, 0, 240, 132);
    } else {
      const u = (lt - 0.8) / 1.3;
      gradient(LB, H - LB, [2, 3, 4, 5]);
      for (let y = 120; y < H; y++) for (let x = 0; x < W; x++) { const n = fbm(x, y * 2.2, 40, 3, 341); BUF[y * W + x] = n > 0.55 ? 20 : n > 0.45 ? 19 : 18; }
      const R = 20 + eoc(u) * 240, cy = 150;
      for (let y = LB; y < H - LB; y++) for (let x = 0; x < W; x++) {
        const dx = x - 240, dy = (y - cy) * (y < cy ? 1 : 3.2), d = Math.hypot(dx, dy);
        if (d < R) BUF[y * W + x] = d < R * 0.55 ? 22 : d < R * 0.75 ? 60 : d < R * 0.9 ? 59 : EL[fl(d / 12 + t * 6) % 4][2];
      }
      shockRing(240, cy + 10, R * 1.3, R * 0.25, 4, [22, 20, 59], 1 - u);
      if (u < 0.08) flashWhite(1 - u * 12);
      shk(5 * (1 - u));
      cam(1.2 - u * 0.2, 0, 240, 150);
    }
  });
  // 23 — dawn: the Null falls apart; the hero calms
  shot(37.4, 41.4, (lt, t) => {
    gradient(LB, 210, SKY_DAWN);
    glow(360, 210, 120, T_WARM, 0.55); discF(360, 214, 24, 15); discF(360, 214, 20, 16);
    cloudBank(236, 30, 70, 351, lt * 10, CLOUD_GOLD, false);
    const nx = lerp(110, 60, lt / 4), ny = lerp(90, 200, lin(0, 4, lt));
    actor(NULLO({ eyes: 'closed' }), nx, ny, 1.4, lt * 0.8, false, { alpha: 1 - lt / 5 });
    for (let k = 0; k < 60; k++) { const u = frac(ih(k, 1, 352) + t * 0.4); if (ih(k, 2, 352) > lt / 3) continue; const x = nx + (ih(k, 3, 352) - 0.5) * 50 + u * 30, y = ny + (ih(k, 4, 352) - 0.5) * 30 - u * 60; rectF(x, y, 2, 2, u < 0.5 ? 42 : 40); }
    const hy = 120 + Math.sin(t * 1.6) * 4, calm = lin(1.0, 3.2, lt);
    actor(HERO({ eyes: lt > 3.2 ? 'normal' : 'glow', sword: -1.0, swordCols: calm < 0.8 ? GOLD_SW : null }), 300, hy, 2.2, 0, lt > 2.8);
    aura(t, AURA_GOLD, 8 * (1 - calm) + 1, { sparks: Math.round(12 * (1 - calm)) });
    cam(1.1 - 0.1 * eio(lt / 4), 0, 240, 140);
  });
  // 24 — the title
  shot(41.4, 45, (lt, t) => {
    rectF(0, 0, W, H, 63);
    stars(t, H, 120, 361);
    const s = 'FABLE 5.5', sc = 6, w = textWidth(s, sc), x0 = 240 - w / 2;
    text(s, x0, 70, (i, j, k) => (j < 2 ? 22 : EL[k % 4][j < 5 ? 2 : 1]), sc, 0, Math.min(s.length, fl(lt * 12)));
    if (lt > 0.9) { const s2 = 'PART II · THE NULL'; text(s2, 240 - textWidth(s2, 2) / 2, 132, 59, 2, 0, fl((lt - 0.9) * 30)); }
    if (lt > 1.6) { const s3 = 'TO BE CONTINUED'; text(s3, 240 - textWidth(s3, 1) / 2, 162, 19, 1, undefined, fl((lt - 1.6) * 30)); }
    actor(HERO({ eyes: 'normal', sword: -1.0 }), 240, 210, 1.4, 0, false);
  });

  /* ================================================================ captions */
  // [t0, t1, kind, speaker, text, y]; kinds: n narration (top bar), s speech (bottom bar), x shout (centre)
  const CAPS = [
    [0.2, 1.45, 'n', '', 'THE FOUR ELEMENTS CHOSE A HERO.'],
    [1.5, 2.75, 'n', '', 'SOMETHING ELSE WANTED THEM.'],
    [3.25, 4.65, 's', 'NULL', 'FOUR ELEMENTS. HAND THEM OVER.'],
    [5.0, 5.85, 's', 'HERO', 'NO.'],
    [14.25, 15.75, 's', 'NULL', 'IS THAT ALL THE FABLE YOU HAVE?'],
    [16.25, 16.95, 's', 'HERO', '...NOT EVEN CLOSE.'],
    [17.1, 18.45, 's', 'HERO', 'WATER. LEAF. LIGHTNING. STARLIGHT...'],
    [18.55, 19.15, 's', 'NULL', 'WHAT IS THIS?!'],
    [20.0, 20.6, 'x', '', 'TOGETHER!'],
    [20.7, 21.75, 'n', '', 'FABLE MODE'],
    [21.9, 22.36, 's', 'NULL', "PRETTY LIGHTS. THEY WON'T SAVE YOU."],
    [28.75, 29.38, 'x', '', 'ENOUGH!'],
    [29.5, 30.45, 's', 'NULL', 'THEN VANISH!'],
    [30.6, 31.55, 's', 'HERO', 'FABLE...'],
    [34.25, 35.25, 'x', '', 'STRIKE!', 52],
    [37.8, 39.4, 's', 'NULL', "THIS... ISN'T... OVER."],
    [39.6, 41.0, 's', 'HERO', 'I KNOW.'],
  ];
  function drawCaptions(t) {
    if (t > 42.6) { const s4 = 'UNOFFICIAL FAN CONCEPT · NOT AFFILIATED WITH ANTHROPIC'; text(s4, 240 - textWidth(s4, 1) / 2, H - LB + 9, 19, 1); }
    for (const [t0, t1, k, who, s, sy] of CAPS) {
      if (t < t0 || t >= t1) continue;
      const nv = Math.ceil((t - t0) * 38);
      if (k === 'n') { const w = textWidth(s, 1); text(s, 240 - w / 2, 9, 20, 1, undefined, nv); }
      else if (k === 's') {
        const tag = who + ':', tw = textWidth(tag, 1), w = tw + 6 + textWidth(s, 1), x0 = 240 - w / 2, y = H - LB + 9;
        text(tag, x0, y, who === 'NULL' ? 42 : 35, 1);
        text(s, x0 + tw + 6, y, 21, 1, undefined, nv);
      } else {
        const u = (t - t0) / (t1 - t0), sc = u < 0.12 ? 8 : 6, w = textWidth(s, sc);
        text(s, 240 - w / 2, (sy || 135) - 3.5 * sc, (i, j) => (j < 3 ? 22 : 59), sc, 0, undefined, t);
      }
    }
  }

  /* ================================================================ frame */
  const FLASH_CUTS = [5.9, 11.3, 13.6, 20.6, 21.8, 31.6, 35.3];
  const WHIPS = [[8.1, 0], [10.6, 0], [11.8, -PI / 2], [23.6, -PI / 2], [25.2, 0], [27.4, PI / 2]];
  let SHX = 0, SHY = 0;
  function render(t) {
    t = clamp(t, 0, D - 1 / 30);
    T_NOW = t; SHAKE_A = 0; FRZ = 0; BUF.fill(0);
    let S = SHOTS[0];
    for (const s of SHOTS) if (t >= s.t0) S = s;
    S.fn(t - S.t0, t);
    for (const [wt, dir] of WHIPS) { const d = Math.abs(t - wt); if (d < 0.1) whip(80 * (1 - d / 0.1), dir); }
    letterbox(LB);
    for (const c of FLASH_CUTS) if (t >= c && t < c + 0.067) tintAll(T_WH, 0.55);
    drawCaptions(t);
    const f = fl(t * 30);
    SHX = Math.round((ih(f, 1, 901) - 0.5) * 2 * SHAKE_A); SHY = Math.round((ih(f, 2, 901) - 0.5) * 2 * SHAKE_A);
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
    const sx = SHX, sy = SHY;
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
    id: 'the-null',
    title: 'The Null',
    medium: 'Pixel art in 64 colours, 480 × 270, drawn in JavaScript · 45 s',
    note: 'Fable Saga, part II · tap to pause',
    about: 'Part two of the Fable saga. The sky over the forest cracks open and the Null, a glitched shadow of the coral hero, comes for the four elements. They clash on the ground and in the trees, the hero is beaten into a crater, then calls the elements together, turns gold and takes the fight above the clouds: a chase, a barrel roll, a blow that sends the Null through the cloud sea, and a beam struggle that ends in a dome of light at dawn. An unofficial fan concept, not affiliated with Anthropic.',
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
        window.__thenull = {
          duration: D,
          isReady: () => ready && faded(),
          renderAt(t) { return new Promise((res) => { const t0 = performance.now(); draw(t); window.__thenull.lastMs = performance.now() - t0; requestAnimationFrame(() => requestAnimationFrame(res)); }); },
          lastMs: 0,
        };
        document.documentElement.dataset.ready = 'the-null';
        api.ready();
      } else {
        window.__thenull = { duration: D, isReady: () => ready, renderAt(t) { return new Promise((res) => { playing = false; clock = t; draw(t); requestAnimationFrame(() => res()); }); } };
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
          if (window.__thenull) delete window.__thenull;
        },
      };
    },
  });
})();
