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

  /* ================================================================ the 3D world: camera, sky, planes, boxes, fog, ink */
  // world: y is up, metres-ish. The camera is a pinhole; F is the focal length in pixels.
  const CAM = { x: 0, y: 2, z: -10, fx: 0, fy: 0, fz: 1, rx: 1, ry: 0, rz: 0, ux: 0, uy: 1, uz: 0, F: 300, cx: 240, cy: 135 };
  function lookAt(px, py, pz, tx, ty, tz, fov, roll) {
    let fx = tx - px, fy = ty - py, fz = tz - pz; const fl_ = Math.hypot(fx, fy, fz) || 1; fx /= fl_; fy /= fl_; fz /= fl_;
    let rx = fz, rz = -fx; const rl = Math.hypot(rx, rz) || 1; rx /= rl; rz /= rl; let ry = 0;
    let ux = fy * rz - fz * ry, uy = fz * rx - fx * rz, uz = fx * ry - fy * rx;
    if (roll) { const c = Math.cos(roll), s = Math.sin(roll); const nrx = rx * c + ux * s, nry = ry * c + uy * s, nrz = rz * c + uz * s; ux = ux * c - rx * s; uy = uy * c - ry * s; uz = uz * c - rz * s; rx = nrx; ry = nry; rz = nrz; }
    Object.assign(CAM, { x: px, y: py, z: pz, fx, fy, fz, rx, ry, rz, ux, uy, uz, F: (W / 2) / Math.tan((fov || 60) * PI / 360) });
  }
  // the same framing from k times farther back along the line of sight, with the aim raised by dy (keeps sprites at a sane size)
  function lookK(px, py, pz, tx, ty, tz, fov, k, dy) { dy = dy || 0; lookAt(tx + (px - tx) * k, ty + dy + (py - ty) * k, tz + (pz - tz) * k, tx, ty + dy, tz, fov); }
  // world → screen; returns null behind the camera. Z is the depth along the view axis.
  const PR = { x: 0, y: 0, z: 0 };
  function proj(x, y, z) {
    const dx = x - CAM.x, dy = y - CAM.y, dz = z - CAM.z, Z = dx * CAM.fx + dy * CAM.fy + dz * CAM.fz;
    if (Z < 0.05) return null;
    PR.x = CAM.cx + CAM.F * (dx * CAM.rx + dy * CAM.ry + dz * CAM.rz) / Z; PR.y = CAM.cy - CAM.F * (dx * CAM.ux + dy * CAM.uy + dz * CAM.uz) / Z; PR.z = Z;
    return PR;
  }
  // the ray through a pixel, scaled so that its forward component is 1 (so t along it is the depth)
  const RY = { x: 0, y: 0, z: 0 };
  function ray(sx, sy) {
    const a = (sx - CAM.cx) / CAM.F, b = -(sy - CAM.cy) / CAM.F;
    RY.x = CAM.fx + CAM.rx * a + CAM.ux * b; RY.y = CAM.fy + CAM.ry * a + CAM.uy * b; RY.z = CAM.fz + CAM.rz * a + CAM.uz * b; return RY;
  }

  // light & fog for the current set
  const ENV = { sun: [0.4, 0.8, -0.45], amb: 0.35, fog: null, fogNear: 30, fogFar: 160, fogMax: 0.85 };
  function setFog(hex, near, far, max) { ENV.fog = hex ? tab(hex) : null; ENV.fogNear = near; ENV.fogFar = far; ENV.fogMax = max === undefined ? 0.85 : max; }
  function setSun(x, y, z, amb) { const l = Math.hypot(x, y, z); ENV.sun = [x / l, y / l, z / l]; ENV.amb = amb; }
  const fogA = (z) => (ENV.fog ? ENV.fogMax * sstep(ENV.fogNear, ENV.fogFar, z) : 0);
  function fogC(c, z, x, y) { if (!ENV.fog) return c; const a = fogA(z); if (a <= 0) return c; const l = Math.min(7, fl(a * 8 + bay(x, y) - 0.5)); return l >= 0 ? ENV.fog[l * NPAL + c] : c; }
  // a shade value (0..7, fractional) on a ramp, dithered to a palette index
  const shadeC = (ramp, s, x, y) => ramp * 8 + clamp(fl(s + bay(x, y) - 0.5 + 0.5), 0, 7);
  const lightOf = (nx, ny, nz) => ENV.amb + (1 - ENV.amb) * Math.max(0, nx * ENV.sun[0] + ny * ENV.sun[1] + nz * ENV.sun[2]);

  let QID = 1;
  function beginWorld() { ZB.fill(1e9); IDB.fill(0); EMIS.fill(0); QID = 1; }
  // the sky: fn(dirx, diry, dirz, x, y) → colour, for every pixel nothing else will cover
  function sky(fn) {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const d = ray(x + 0.5, y + 0.5), l = Math.hypot(d.x, d.y, d.z); BUF[y * W + x] = fn(d.x / l, d.y / l, d.z / l, x, y); }
  }
  // a horizontal plane at height h; tex(wx, wz, depth, x, y) → colour (or -1 for a hole)
  function plane(h, tex, opt) {
    opt = opt || {}; const id = QID++, maxD = opt.maxD || 1e9;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const d = ray(x + 0.5, y + 0.5); if (Math.abs(d.y) < 1e-6) continue;
      const t = (h - CAM.y) / d.y; if (t <= 0.05 || t > maxD) continue;
      const i = y * W + x; if (t >= ZB[i]) continue;
      const c = tex(CAM.x + t * d.x, CAM.z + t * d.z, t, x, y); if (c < 0) continue;
      BUF[i] = opt.nofog ? c : fogC(c, t, x, y); ZB[i] = t; IDB[i] = opt.id || id;
    }
  }
  // a flat convex polygon in the world (3 or 4 corners, any order around the edge); shade(u, v, x, y, depth, n) → colour
  // u runs along the first edge and v along the last, both in world units
  const CLIP = [], SCR = [];
  function poly3(pts, shade, opt) {
    opt = opt || {};
    const p0 = pts[0], p1 = pts[1], pl = pts[pts.length - 1];
    let ex = p1[0] - p0[0], ey = p1[1] - p0[1], ez = p1[2] - p0[2], gx = pl[0] - p0[0], gy = pl[1] - p0[1], gz = pl[2] - p0[2];
    let nx = ey * gz - ez * gy, ny = ez * gx - ex * gz, nz = ex * gy - ey * gx; const nl = Math.hypot(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl;
    const facing = nx * (CAM.x - p0[0]) + ny * (CAM.y - p0[1]) + nz * (CAM.z - p0[2]);
    if (facing <= 0) { if (!opt.two) return; nx = -nx; ny = -ny; nz = -nz; }
    const el = Math.hypot(ex, ey, ez) || 1, gl = Math.hypot(gx, gy, gz) || 1; ex /= el; ey /= el; ez /= el; gx /= gl; gy /= gl; gz /= gl;
    // camera space, clipped against the near plane
    CLIP.length = 0;
    const cs = pts.map((p) => { const dx = p[0] - CAM.x, dy = p[1] - CAM.y, dz = p[2] - CAM.z; return [dx * CAM.rx + dy * CAM.ry + dz * CAM.rz, dx * CAM.ux + dy * CAM.uy + dz * CAM.uz, dx * CAM.fx + dy * CAM.fy + dz * CAM.fz]; });
    const NEAR = 0.08;
    for (let i = 0; i < cs.length; i++) {
      const a = cs[i], b = cs[(i + 1) % cs.length], ain = a[2] >= NEAR, bin = b[2] >= NEAR;
      if (ain) CLIP.push(a);
      if (ain !== bin) { const u = (NEAR - a[2]) / (b[2] - a[2]); CLIP.push([a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, NEAR]); }
    }
    if (CLIP.length < 3) return;
    SCR.length = 0; let minx = 1e9, maxx = -1e9, miny = 1e9, maxy = -1e9;
    for (const c of CLIP) { const sx = CAM.cx + CAM.F * c[0] / c[2], sy = CAM.cy - CAM.F * c[1] / c[2]; SCR.push(sx, sy); if (sx < minx) minx = sx; if (sx > maxx) maxx = sx; if (sy < miny) miny = sy; if (sy > maxy) maxy = sy; }
    const x0 = Math.max(0, fl(minx)), x1 = Math.min(W - 1, Math.ceil(maxx)), y0 = Math.max(0, fl(miny)), y1 = Math.min(H - 1, Math.ceil(maxy));
    if (x0 > x1 || y0 > y1) return;
    const n = SCR.length / 2; let area = 0;
    for (let i = 0; i < n; i++) { const j = (i + 1) % n; area += SCR[2 * i] * SCR[2 * j + 1] - SCR[2 * j] * SCR[2 * i + 1]; }
    const sg = area > 0 ? 1 : -1, id = opt.id || QID++;
    const pd = nx * p0[0] + ny * p0[1] + nz * p0[2], camd = nx * CAM.x + ny * CAM.y + nz * CAM.z;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const px = x + 0.5, py = y + 0.5; let ok = true;
      for (let i = 0; i < n; i++) { const j = (i + 1) % n, ax = SCR[2 * i], ay = SCR[2 * i + 1]; if (sg * ((SCR[2 * j] - ax) * (py - ay) - (SCR[2 * j + 1] - ay) * (px - ax)) < 0) { ok = false; break; } }
      if (!ok) continue;
      const d = ray(px, py), den = nx * d.x + ny * d.y + nz * d.z; if (Math.abs(den) < 1e-9) continue;
      const t = (pd - camd) / den; if (t <= 0.05) continue;
      const i = y * W + x; if (t >= ZB[i]) continue;
      const hx = CAM.x + t * d.x - p0[0], hy = CAM.y + t * d.y - p0[1], hz = CAM.z + t * d.z - p0[2];
      const c = shade(hx * ex + hy * ey + hz * ez, hx * gx + hy * gy + hz * gz, x, y, t, nx, ny, nz); if (c < 0) continue;
      BUF[i] = opt.nofog ? c : fogC(c, t, x, y); ZB[i] = t; IDB[i] = id;
    }
  }
  // an axis-aligned box; mat(face, u, v, x, y, depth, light) → colour; face is 'top', 'bottom', 'n', 's', 'e' or 'w'
  function box(x0, y0, z0, x1, y1, z1, mat, opt) {
    const F = [
      ['top', [[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]], [0, 1, 0]],
      ['s', [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0]], [0, 0, -1]],
      ['n', [[x1, y0, z1], [x0, y0, z1], [x0, y1, z1], [x1, y1, z1]], [0, 0, 1]],
      ['w', [[x0, y0, z1], [x0, y0, z0], [x0, y1, z0], [x0, y1, z1]], [-1, 0, 0]],
      ['e', [[x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0]], [1, 0, 0]],
      ['bottom', [[x0, y0, z1], [x1, y0, z1], [x1, y0, z0], [x0, y0, z0]], [0, -1, 0]],
    ];
    for (const [nm, pts, nn] of F) {
      if (nn[0] * (CAM.x - pts[0][0]) + nn[1] * (CAM.y - pts[0][1]) + nn[2] * (CAM.z - pts[0][2]) <= 0) continue;
      const L = lightOf(nn[0], nn[1], nn[2]);
      // our corner order winds the normal inward for poly3, so pass it reversed
      const side = nm !== 'top' && nm !== 'bottom', cool = ENV.coolT && L < 0.62 ? Math.min(0.55, (0.62 - L) * 1.3) : 0, ao = ENV.ao || 0;
      poly3([pts[0], pts[3], pts[2], pts[1]], (u, v, x, y, t) => {
        let c = mat(nm, v, u, x, y, t, L); if (c < 0) return c;
        // shadowed faces lean cool; the foot of every wall darkens where it meets the ground
        if (cool > 0) { const l = fl(cool * 8 + bay(x, y) - 0.5); if (l >= 0) c = ENV.coolT[Math.min(7, l) * NPAL + c]; }
        if (side && ao > 0 && u < 0.7) { const l = fl((0.7 - u) / 0.7 * ao * 8 + bay(x, y) - 0.5); if (l >= 0) c = T_DARK[Math.min(7, l) * NPAL + c]; }
        return c;
      }, opt);
    }
  }
  // a gabled roof over [x0..x1] × [z0..z1], ridge along x at height y0 + h
  function roof(x0, z0, x1, z1, y0, h, mat, over) {
    over = over || 0.3; const zm = (z0 + z1) / 2, xa = x0 - over, xb = x1 + over, za = z0 - over, zb = z1 + over, yr = y0 + h;
    const sides = [
      [[[xa, y0, za], [xb, y0, za], [xb, yr, zm], [xa, yr, zm]], 's'],
      [[[xb, y0, zb], [xa, y0, zb], [xa, yr, zm], [xb, yr, zm]], 'n'],
    ];
    for (const [pts, nm] of sides) {
      const e1 = [pts[1][0] - pts[0][0], pts[1][1] - pts[0][1], pts[1][2] - pts[0][2]], e2 = [pts[3][0] - pts[0][0], pts[3][1] - pts[0][1], pts[3][2] - pts[0][2]];
      let nx = e1[1] * e2[2] - e1[2] * e2[1], ny = e1[2] * e2[0] - e1[0] * e2[2], nz = e1[0] * e2[1] - e1[1] * e2[0]; const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
      const L = lightOf(nx, ny, nz);
      poly3(pts, (u, v, x, y, t) => mat('roof' + nm, u, v, x, y, t, L), { two: true });
    }
    for (const [pts, nm] of [[[[x0, y0, z0], [x0, y0, z1], [x0, yr, zm]], 'w'], [[[x1, y0, z1], [x1, y0, z0], [x1, yr, zm]], 'e']]) {
      const L = lightOf(nm === 'w' ? -1 : 1, 0, 0);
      poly3(pts, (u, v, x, y, t) => mat('gable', u, v, x, y, t, L), { two: true });
    }
  }
  // ink: darken the near side of every edge between surfaces (and between surfaces and the sky)
  const RD = (c, k) => (c & ~7) | Math.max(0, (c & 7) - k);
  function ink(strength, far) {
    far = far || 120; strength = strength === undefined ? 2 : strength;
    for (let y = 0; y < H - 1; y++) for (let x = 0; x < W - 1; x++) {
      const i = y * W + x, id = IDB[i]; if (id === 0 || id === 65535) continue;
      const a = IDB[i + 1], b = IDB[i + W], za = ZB[i];
      let edge = false;
      if (a !== id && a !== 65535 && za <= ZB[i + 1] * 1.002) edge = true;
      else if (b !== id && b !== 65535 && za <= ZB[i + W] * 1.002) edge = true;
      else if (x > 0 && IDB[i - 1] !== id && IDB[i - 1] !== 65535 && za < ZB[i - 1] * 0.98) edge = true;
      else if (y > 0 && IDB[i - W] !== id && IDB[i - W] !== 65535 && za < ZB[i - W] * 0.98) edge = true;
      if (edge) BUF[i] = RD(BUF[i], za > far ? 1 : strength);
    }
  }
  // 3D marks with depth testing
  function p3(x, y, z, c, size) { const p = proj(x, y, z); if (!p) return null; const s = Math.min(3, Math.max(1, Math.round((size || 0.1) * CAM.F / p.z))), sx = fl(p.x - s / 2), sy = fl(p.y - s / 2), zz = p.z; for (let j = 0; j < s; j++) for (let i = 0; i < s; i++) PZ(sx + i, sy + j, c, zz); return p; }
  function l3(ax, ay, az, bx, by, bz, c, w) {
    const a = proj(ax, ay, az); if (!a) return; const sa = [a.x, a.y, a.z]; const b = proj(bx, by, bz); if (!b) return;
    const sw = w || 1; lineF(sa[0], sa[1], b.x, b.y, (x, y, u) => { const z = lerp(sa[2], b.z, u); for (let k = 0; k < sw; k++) PZ(x + k, y, c, z); });
  }
  // a glow at a world point, scaled by distance and hidden behind nearer surfaces
  function glow3(x, y, z, r, T, a, test) { const p = proj(x, y, z); if (!p) return; if (test !== false) { const ix = fl(p.x), iy = fl(p.y); if (ix >= 0 && iy >= 0 && ix < W && iy < H && ZB[iy * W + ix] < p.z - 0.5) return; } glow(p.x, p.y, r * CAM.F / p.z, T, a); }
  // rain: streaks in a box around the camera, falling and blowing
  function rain3(t, n, len, wind, c, seed, box_) {
    const B = box_ || 18;
    for (let k = 0; k < n; k++) {
      const fx = ih(k, 1, seed), fz = ih(k, 2, seed), fall = frac(ih(k, 3, seed) + t * (1.4 + ih(k, 4, seed) * 0.5));
      const x = CAM.x + (fx - 0.5) * B * 2 + CAM.fx * B * 0.6, z = CAM.z + (fz - 0.5) * B * 2 + CAM.fz * B * 0.6, y = CAM.y + B * 0.6 - fall * B * 1.4;
      l3(x, y, z, x - wind * len, y + len, z, c);
    }
  }

  /* ================================================================ the cast: chibi sprites built from parts every frame */
  // local sprite space: feet on y = 60, body centre x = 30, facing right; the canvas is offset so weapons fit
  const SW = 128, SH = 120, SOX = 44, SOY = 40;
  const SPR = new Uint8Array(SW * SH), SPK = new Uint8Array(SW * SH);   // colour + 1; kind: 1 body, 2 prop, 3 glow (no outline), 4 outline
  const SBB = [0, 0, 0, 0];
  function sp(x, y, c, k) {
    const X = Math.round(x) + SOX, Y = Math.round(y) + SOY;
    if (X < 0 || Y < 0 || X >= SW || Y >= SH) return;
    const i = Y * SW + X; SPR[i] = c + 1; SPK[i] = k || 1;
    if (X < SBB[0]) SBB[0] = X; if (Y < SBB[1]) SBB[1] = Y; if (X > SBB[2]) SBB[2] = X; if (Y > SBB[3]) SBB[3] = Y;
  }
  function sRect(x0, y0, x1, y1, c, k) { for (let y = Math.round(y0); y <= Math.round(y1); y++) for (let x = Math.round(x0); x <= Math.round(x1); x++) sp(x, y, c, k); }
  function sEll(cx, cy, rx, ry, c, k, keep) { for (let y = fl(cy - ry) - 1; y <= cy + ry + 1; y++) for (let x = fl(cx - rx) - 1; x <= cx + rx + 1; x++) if (((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1 && (!keep || keep(x, y))) sp(x, y, c, k); }
  function sLine(x0, y0, x1, y1, c, w, k) { w = w || 1; const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 1.5)); for (let i = 0; i <= n; i++) { const u = i / n, x = x0 + (x1 - x0) * u, y = y0 + (y1 - y0) * u; for (let j = 0; j < w; j++) for (let q = 0; q < w; q++) sp(x + q - (w - 1) / 2, y + j - (w - 1) / 2, c, k); } }
  function sPoly(pts, c, k) {
    let y0 = 1e9, y1 = -1e9; for (const p of pts) { y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
    for (let y = fl(y0); y <= Math.ceil(y1); y++) {
      const xs = []; const yy = y + 0.5;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const a = pts[i], b = pts[j]; if ((a[1] > yy) !== (b[1] > yy)) xs.push(a[0] + (yy - a[1]) * (b[0] - a[0]) / (b[1] - a[1])); }
      xs.sort((a, b) => a - b); for (let q = 0; q + 1 < xs.length; q += 2) for (let x = Math.round(xs[q]); x < Math.round(xs[q + 1]); x++) sp(x, y, c, k);
    }
  }
  // a blade from a hand at an angle: L long, w half-width; edge/core colours, an optional glow line
  function sBlade(hx, hy, ang, L, w, edge, core, guard, grip, glowC) {
    const ca = Math.cos(ang), sa = Math.sin(ang);
    if (grip !== undefined) sLine(hx - ca * 3.5, hy - sa * 3.5, hx + ca, hy + sa, grip, 2, 2);
    if (guard !== undefined) sLine(hx + ca * 2 - sa * 3, hy + sa * 2 + ca * 3, hx + ca * 2 + sa * 3, hy + sa * 2 - ca * 3, guard, 2, 2);
    for (let u = 3; u < 3 + L; u += 0.5) {
      const ww = u > L - 2 ? Math.max(0.3, w * (3 + L - u) / 5) : w;
      for (let k = -ww; k <= ww; k += 0.5) sp(hx + ca * u - sa * k, hy + sa * u + ca * k, k <= -ww + 0.5 ? edge : core, 2);
    }
    if (glowC !== undefined) for (let u = 5; u < 2 + L; u += 3) sp(hx + ca * u, hy + sa * u, glowC, 2);
  }
  function clearSprite() { SPR.fill(0); SPK.fill(0); SBB[0] = SW; SBB[1] = SH; SBB[2] = -1; SBB[3] = -1; }
  // outline every shape in the darkest shade of its own colour (coloured, selective outlines)
  const OUTS = new Uint8Array(SW * SH);
  function outlineSprite(inkC) {
    OUTS.set(SPR);
    const x0 = Math.max(1, SBB[0] - 1), x1 = Math.min(SW - 2, SBB[2] + 1), y0 = Math.max(1, SBB[1] - 1), y1 = Math.min(SH - 2, SBB[3] + 1);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const i = y * SW + x; if (OUTS[i]) continue;
      let src = 0;
      for (const j of [i - 1, i + 1, i - SW, i + SW]) if (OUTS[j] && SPK[j] !== 3 && SPK[j] !== 4) { src = OUTS[j]; break; }
      if (src) { SPR[i] = (inkC !== undefined ? inkC : ((src - 1) & ~7)) + 1; SPK[i] = 4; }
    }
    SBB[0]--; SBB[1]--; SBB[2]++; SBB[3]++;
  }

  // ---------------------------------------------------------------- shared anatomy
  const SKIN = { l: C('skin', 6), m: C('skin', 5), d: C('skin', 4), dd: C('skin', 3) };
  // eyes and mouth on the right side of the face (the side the character faces)
  function face(o, hx, P) {
    const ey = 30, e = o.eyes || 'open', ec = P.eye, look = Math.round(o.look || 0);
    const ex0 = hx + 2 + look, ex1 = hx + 7 + look;
    const br = o.brows || 'n', bc = P.brow;
    for (const [ex, side] of [[ex0, 0], [ex1, 1]]) {
      if (e === 'closed') { sRect(ex - (side ? 0 : 1), ey + 1, ex + 1, ey + 1, ec); }
      else if (e === 'half') { sRect(ex, ey, ex + 1, ey + 1, ec); sRect(ex - 1, ey - 1, ex + 1, ey - 1, P.lid || SKIN.d); }
      else if (e === 'wide') { sRect(ex - 1, ey - 2, ex + 1, ey + 2, ec); sp(ex - 1, ey - 2, WHITE); sp(ex, ey - 2, WHITE); }
      else if (e === 'narrow') { sRect(ex - 1, ey + 1, ex + 1, ey + 1, ec); sRect(ex - 1, ey, ex + 1, ey, ec); }
      else if (e === 'glow') { sRect(ex - 1, ey - 1, ex + 1, ey + 2, P.glow || C('gold', 6), 3); sRect(ex, ey, ex, ey + 1, WHITE, 3); }
      else if (e === 'sad') { sRect(ex, ey, ex + 1, ey + 2, ec); sp(ex + (side ? 0 : 1), ey, WHITE); }
      else { sRect(ex, ey - 1, ex + 1, ey + 2, ec); sp(ex, ey - 1, WHITE); }
      // brows
      if (br === 'angry') { sp(ex - 1 + side * 2, ey - 3, bc); sp(ex + side * 0, ey - 3 + (side ? 0 : 0), bc); sp(ex + (side ? -1 : 2), ey - 2, bc); }
      else if (br === 'worried') { sp(ex + (side ? 0 : -1), ey - 4, bc); sp(ex + (side ? 1 : 0), ey - 4, bc); sp(ex + (side ? -1 : 1), ey - 3, bc); }
      else if (br === 'up') { sRect(ex - 1, ey - 5, ex + 1, ey - 5, bc); }
      else if (br !== 'none') sRect(ex - 1, ey - 4, ex + 1, ey - 4, bc);
    }
    if (o.tear) { const ty = ey + 3 + ((T_NOW * 9) % 5); sp(ex0 - 1, ty, C('hush', 5), 3); sp(ex0 - 1, ty + 1, C('hush', 3), 3); }
    if (o.blush) { sRect(hx + 1, ey + 4, hx + 2, ey + 4, C('rose', 5)); sRect(hx + 8, ey + 4, hx + 9, ey + 4, C('rose', 5)); }
    // mouth: openness 0..1 from the lip-sync, smile -1..1
    const m = o.mouth || 0, mx = hx + 5 + look * 0.5, my = ey + 5, sm = o.smile || 0;
    if (m < 0.15) {
      if (sm > 0.3) { sp(mx - 1, my, P.mouth); sp(mx, my + 1, P.mouth); sp(mx + 1, my + 1, P.mouth); sp(mx + 2, my, P.mouth); }
      else if (sm < -0.3) { sp(mx - 1, my + 1, P.mouth); sp(mx, my, P.mouth); sp(mx + 1, my, P.mouth); sp(mx + 2, my + 1, P.mouth); }
      else sRect(mx, my, mx + 1, my, P.mouth);
    } else {
      const h = m < 0.45 ? 1 : m < 0.8 ? 2 : 3, w = m < 0.45 ? 2 : m < 0.8 ? 3 : 4;
      sRect(mx - (w > 2 ? 1 : 0), my, mx - (w > 2 ? 1 : 0) + w - 1, my + h, P.mouth);
      if (h >= 2) sRect(mx - (w > 2 ? 1 : 0) + 1, my + h, mx - (w > 2 ? 1 : 0) + w - 2, my + h, C('crimson', 4));
    }
  }
  // the standard chibi body; P is the character's look, o the pose of this frame
  function body(o, P) {
    const lean = o.lean || 0, cr = o.crouch || 0, hx = 30 + lean, hy = 30 + cr * 4 + (o.bob || 0);
    const ty = 39 + cr * 4 + (o.bob || 0), tx = 23 + lean * 0.5;
    // legs
    const legs = () => {
      let a = o.stride || 0, b = -(o.stride || 0), la = 0, lb = 0;
      if (o.run !== undefined) { const s = Math.sin(o.run), g = o._gait || 1, c = Math.cos(o.run); a = s * 1.5 * g; b = -s * 1.5 * g; la = Math.max(0, c) * 3 * g; lb = Math.max(0, -c) * 3 * g; }
      if (o.air) { la = 3; lb = 4; a = -1; b = 1.2; }
      const leg = (x, sx, lift, c, cb) => { const top = ty + 14, bot = 60 - lift; sRect(x + sx * 2, top, x + 3 + sx * 2, bot, c); sRect(x + sx * 4 - 1 + (P.bootOut ? 0 : 0), bot - 1, x + sx * 4 + 4, bot, cb); };
      if (P.robe) { // robes hide the legs: a flared skirt, with feet peeking
        const sw = (o.run !== undefined ? Math.sin(o.run) * 2 : 0);
        sPoly([[tx - 1, ty + 9], [tx + 15, ty + 9], [tx + 18 + sw, 59], [tx - 4 + sw, 59]], P.robe);
        sRect(tx - 3 + sw, 57, tx + 17 + sw, 58, P.robeD);
        sRect(tx + 1 + a * 2, 59, tx + 5 + a * 2, 60, P.boot); sRect(tx + 10 + b * 2, 59, tx + 14 + b * 2, 60, P.bootD);
        return;
      }
      if (o.kneel) {   // the back shin flat on the ground, the front knee up
        sRect(tx - 7, 57, tx + 5, 60, P.legD); sRect(tx - 8, 58, tx - 5, 60, P.bootD);
        sRect(tx + 6, ty + 12, tx + 16, ty + 15, P.leg); sRect(tx + 13, ty + 12, tx + 16, 60, P.leg); sRect(tx + 12, 59, tx + 19, 60, P.boot);
        return;
      }
      leg(25 + lean * 0.3, b, lb, P.legD, P.bootD); leg(31 + lean * 0.3, a, la, P.leg, P.boot);
    };
    // back arm
    const armB = o.armB === undefined ? 1.9 : o.armB;
    const sbx = tx + 2, sby = ty + 3;
    if (P.backHair) P.backHair(o, hx, hy);
    sLine(sbx, sby, sbx + Math.cos(armB) * 7, sby + Math.sin(armB) * 7, P.armD, 3);
    if (P.backProp) P.backProp(o, sbx + Math.cos(armB) * 8, sby + Math.sin(armB) * 8);
    legs();
    // torso
    sPoly([[tx, ty], [tx + 14, ty], [tx + 15, ty + 15], [tx - 1, ty + 15]], P.cloth);
    sRect(tx, ty, tx + 14, ty, P.clothL);
    P.torso && P.torso(o, tx, ty);
    // head
    sEll(hx, hy, 10, 9.5, P.skin || SKIN.m);
    sRect(hx - 8, hy + 6, hx + 8, hy + 7, P.skinD || SKIN.d);
    if (P.cap) for (let y = hy - 11; y <= hy + 8; y++) for (let x = hx - 11; x <= hx + 11; x++) if (((x + 0.5 - hx) / 10) ** 2 + ((y + 0.5 - hy) / 9.5) ** 2 <= 1 && (y <= hy - 8 || x <= hx - 3 + (y - hy + 8) * 0.25)) sp(x, y, P.cap);
    face(o, hx, P);
    P.front && P.front(o, hx, hy);
    // front arm and whatever it holds
    const armF = o.armF === undefined ? 1.2 : o.armF, reach = 7 + (o.reach || 0);
    const sfx = tx + 12, sfy = ty + 3, hxp = sfx + Math.cos(armF) * reach, hyp = sfy + Math.sin(armF) * reach;
    sLine(sfx, sfy, hxp, hyp, P.arm, 3);
    sRect(hxp - 1, hyp - 1, hxp + 1, hyp + 1, P.skin || SKIN.m);
    if (P.prop) P.prop(o, hxp, hyp);
    return { hand: [hxp, hyp], head: [hx, hy], chest: [tx + 8, ty + 6] };
  }

  // the same body seen from the front or from behind (view: 'front' | 'back')
  function bodyFB(o, P, view) {
    const cr = o.crouch || 0, bob = o.bob || 0, hx = 30 + (o.lean || 0) * 0.3, hy = 30 + cr * 4 + bob, ty = 39 + cr * 4 + bob, tx = 22;
    const back = view === 'back';
    // legs
    const ls = o.run !== undefined ? Math.sin(o.run) * 1.35 * (o._gait || 1) : 0;
    if (P.robe) { sPoly([[tx + 1, ty + 9], [tx + 15, ty + 9], [tx + 18, 59], [tx - 2, 59]], P.robe); sRect(tx - 2, 57, tx + 18, 58, P.robeD); }
    else { sRect(25, ty + 14, 28, 60 - Math.max(0, ls) * 3, P.legD); sRect(32, ty + 14, 35, 60 - Math.max(0, -ls) * 3, P.leg); sRect(24, 59 - Math.max(0, ls) * 3, 29, 60 - Math.max(0, ls) * 3, P.bootD); sRect(31, 59 - Math.max(0, -ls) * 3, 36, 60 - Math.max(0, -ls) * 3, P.boot); }
    if (back && P.backB) P.backB(o, hx, hy);
    // arms (screen-left and screen-right)
    // seen from the front, a swinging arm mostly foreshortens: the hand rises a little as it comes toward us
    const au = o._autoArms, aL = au !== undefined ? 1.95 - au * 0.12 : o.armL === undefined ? 1.9 : o.armL, aR = au !== undefined ? 1.2 - au * 0.12 : o.armF === undefined ? 1.25 : o.armF;
    const rl = (au !== undefined ? 7 - Math.max(0, au) * 2.2 : 7) + (o.reachL || 0), rr = (au !== undefined ? 7 - Math.max(0, -au) * 2.2 : 7) + (o.reach || 0);
    const sl = [tx + 1, ty + 3], sr = [tx + 15, ty + 3], hl = [sl[0] + Math.cos(aL) * rl, sl[1] + Math.sin(aL) * rl], hr = [sr[0] + Math.cos(aR) * rr, sr[1] + Math.sin(aR) * rr];
    if (!o.patL) sLine(sl[0], sl[1], hl[0], hl[1], P.armD, 3); sLine(sr[0], sr[1], hr[0], hr[1], P.arm, 3);
    // torso
    sPoly([[tx, ty], [tx + 16, ty], [tx + 17, ty + 15], [tx - 1, ty + 15]], back ? P.clothD || P.cloth : P.cloth);
    sRect(tx, ty, tx + 16, ty, P.clothL);
    if (P.torsoFB) P.torsoFB(o, tx, ty, back);
    // head
    if (!back && P.behindF) P.behindF(o, hx, hy);
    sEll(hx, hy, 10.5, 9.5, P.skin || SKIN.m);
    if (back) { sEll(hx, hy, 10.5, 9.5, P.hairC); if (P.backH) P.backH(o, hx, hy); }
    else {
      sRect(hx - 8, hy + 6, hx + 8, hy + 7, P.skinD || SKIN.d);
      faceF(o, hx, P);
      if (P.frontH) P.frontH(o, hx, hy);
    }
    // an arm raised to reach (a pat, a wave) passes in front of the head
    if (o.reachL > 0) sLine(sl[0], sl[1], hl[0], hl[1], P.armD, 3);
    // a bent arm laid on something (patL: the hand's offset from the screen-left shoulder): up over the elbow, down onto it
    if (o.patL) { const ex = sl[0] + o.patL[0] * 0.5, ey = sl[1] + Math.min(o.patL[1], 0) - 5, hx2 = sl[0] + o.patL[0], hy2 = sl[1] + o.patL[1]; sLine(sl[0], sl[1], ex, ey, P.armD, 3); sLine(ex, ey, hx2, hy2, P.armD, 3); sRect(hx2 - 2, hy2 - 1, hx2 + 1, hy2 + 1, P.skin || SKIN.m); }
    if (o.reach > 0 && hr[1] < sr[1]) sLine(sr[0], sr[1], hr[0], hr[1], P.arm, 3);
    if (!o.patL) sRect(hl[0] - 1, hl[1] - 1, hl[0] + 1, hl[1] + 1, P.skin || SKIN.m); sRect(hr[0] - 1, hr[1] - 1, hr[0] + 1, hr[1] + 1, P.skin || SKIN.m);
    if (P.prop) P.prop(o, hr[0], hr[1]);
    return { hand: hr, head: [hx, hy], chest: [tx + 8, ty + 6] };
  }
  // a symmetric face, looking out of the screen
  function faceF(o, hx, P) {
    const ey = 30 + (o.crouch || 0) * 4 + (o.bob || 0), e = o.eyes || 'open', ec = P.eye, lk = Math.round(o.look || 0), br = o.brows || 'n', bc = P.brow;
    for (const [ex, side] of [[hx - 5 + lk, 0], [hx + 3 + lk, 1]]) {
      if (e === 'closed') sRect(ex, ey + 1, ex + 1, ey + 1, ec);
      else if (e === 'half') { sRect(ex, ey, ex + 1, ey + 1, ec); }
      else if (e === 'wide') { sRect(ex - 1, ey - 2, ex + 2, ey + 2, ec); sp(ex, ey - 2, WHITE); sp(ex - 1, ey - 2, WHITE); }
      else if (e === 'narrow') sRect(ex - 1, ey + 1, ex + 2, ey + 1, ec);
      else if (e === 'glow') { sRect(ex - 1, ey - 1, ex + 2, ey + 2, P.glow || C('gold', 6), 3); sRect(ex, ey, ex + 1, ey + 1, WHITE, 3); }
      else { sRect(ex, ey - 1, ex + 1, ey + 2, ec); sp(ex + (side ? 0 : 1), ey - 1, WHITE); }
      if (br === 'angry') { sp(ex + (side ? 0 : 1), ey - 3, bc); sp(ex + (side ? 1 : 0), ey - 4, bc); sp(ex + (side ? -1 : 2), ey - 3, bc); }
      else if (br === 'worried') { sp(ex + (side ? 1 : 0), ey - 3, bc); sp(ex + (side ? 0 : 1), ey - 4, bc); sp(ex + (side ? -1 : 2), ey - 4, bc); }
      else if (br === 'up') sRect(ex - 1, ey - 5, ex + 2, ey - 5, bc);
      else if (br !== 'none') sRect(ex - 1, ey - 4, ex + 2, ey - 4, bc);
    }
    if (o.tear) { const ty = ey + 3 + ((T_NOW * 9) % 5); sp(hx - 5, ty, C('hush', 5), 3); sp(hx - 5, ty + 1, C('hush', 3), 3); }
    if (o.blush) { sRect(hx - 7, ey + 4, hx - 6, ey + 4, C('rose', 5)); sRect(hx + 6, ey + 4, hx + 7, ey + 4, C('rose', 5)); }
    const m = o.mouth || 0, my = ey + 5, sm = o.smile || 0;
    if (m < 0.15) { if (sm > 0.3) { sp(hx - 2, my, P.mouth); sRect(hx - 1, my + 1, hx + 1, my + 1, P.mouth); sp(hx + 2, my, P.mouth); } else if (sm < -0.3) { sp(hx - 2, my + 1, P.mouth); sRect(hx - 1, my, hx + 1, my, P.mouth); sp(hx + 2, my + 1, P.mouth); } else sRect(hx - 1, my, hx + 1, my, P.mouth); }
    else { const h = m < 0.45 ? 1 : m < 0.8 ? 2 : 3, w = m < 0.45 ? 1 : m < 0.8 ? 2 : 3; sRect(hx - w, my, hx + w - 1 + (w === 1 ? 1 : 0), my + h, P.mouth); if (h >= 2) sRect(hx - w + 1, my + h, hx + w - 2 + (w === 1 ? 1 : 0), my + h, C('crimson', 4)); }
  }

  // ---------------------------------------------------------------- the characters
  const CAST = {};
  CAST.kaira = {
    hairC: C('stone', 7),
    behindF(o, hx, hy) { const w = o.wind || 0; for (let k = 0; k < 7; k++) { const a = -PI / 2 + (k - 3) * 0.42, L = 13 + (k % 2) * 3 + w * 0.6; sPoly([[hx + Math.cos(a - 0.2) * 8, hy - 2 + Math.sin(a - 0.2) * 8], [hx + Math.cos(a) * L, hy - 3 + Math.sin(a) * L - w * 0.4], [hx + Math.cos(a + 0.2) * 8, hy - 2 + Math.sin(a + 0.2) * 8]], k % 2 ? C('stone', 6) : C('stone', 7)); } },
    frontH(o, hx, hy) { sEll(hx, hy - 5, 10.6, 5, C('stone', 7), 1, (x, y) => y < hy - 6); for (let k = -2; k <= 2; k++) sPoly([[hx + k * 4 - 2.5, hy - 8], [hx + k * 4 + 2.5, hy - 8], [hx + k * 4 + k * 0.6, hy - 3 - (k & 1) * 2]], k & 1 ? C('stone', 6) : C('stone', 7)); sRect(hx - 10, hy - 9, hx + 10, hy - 8, C('indigo', 2)); sEll(hx, hy - 9, 2.5, 2, C('gold', 5)); sp(hx - 1, hy - 10, WHITE); },
    backH(o, hx, hy) { const w = o.wind || 0; for (let k = 0; k < 9; k++) { const a = -PI / 2 + (k - 4) * 0.36, L = 12 + (k % 3) * 2 + w * 0.7; sPoly([[hx + Math.cos(a - 0.25) * 7, hy + Math.sin(a - 0.25) * 7], [hx + Math.cos(a) * L, hy + Math.sin(a) * L * 0.9 - w * 0.5], [hx + Math.cos(a + 0.25) * 7, hy + Math.sin(a + 0.25) * 7]], k % 2 ? C('stone', 7) : C('stone', 5)); } for (let k = 0; k < 5; k++) sLine(hx - 6 + k * 3, hy - 7, hx - 7 + k * 3.4, hy + 6, C('stone', 5)); sRect(hx - 10, hy - 9, hx + 10, hy - 8, C('indigo', 2)); sRect(hx - 1, hy - 8, hx + 1, hy - 3, C('indigo', 2)); sLine(hx, hy - 3, hx - 4 - w, hy + 4, C('indigo', 2)); },
    torsoFB(o, tx, ty, back) { sRect(tx - 1, ty + 9, tx + 17, ty + 10, C('gold', 5)); if (!back) { sLine(tx + 8, ty, tx + 8, ty + 15, C('linen', 6)); sLine(tx, ty + 1, tx + 16, ty + 12, C('linen', 5)); if (o.seed) { const cx = tx + 8, cy = ty + 5; sRect(cx - 1, cy - 1, cx + 1, cy + 1, C('gold', 6), 3); if (o.seed > 0.4) { sp(cx, cy, WHITE, 3); sp(cx - 2, cy, C('gold', 5), 3); sp(cx + 2, cy, C('gold', 5), 3); } } } else { sLine(tx + 16, ty + 1, tx, ty + 12, C('linen', 5)); sRect(tx + 3, ty + 9, tx + 9, ty + 15, C('linen', 6)); sRect(tx + 3, ty + 9, tx + 9, ty + 9, C('gold', 5)); } },
    eye: C('gold', 2), brow: C('stone', 4), mouth: C('crimson', 1), glow: C('gold', 6),
    cap: C('stone', 7), cloth: C('indigo', 3), clothL: C('indigo', 5), arm: C('indigo', 3), armD: C('indigo', 2),
    leg: C('indigo', 2), legD: C('indigo', 1), boot: C('night', 2), bootD: C('night', 1),
    backHair(o, hx, hy) {
      const w = (o.wind || 0) + 3;
      for (let k = 0; k < 5; k++) sPoly([[hx - 7, hy - 8 + k * 4], [hx - 15 - w * 1.4 - k, hy - 10 + k * 5 - w * 0.3], [hx - 8, hy - 4 + k * 4]], k % 2 ? C('stone', 7) : C('stone', 6));
    },
    torso(o, tx, ty) {
      sLine(tx + 7, ty, tx + 9, ty + 15, C('linen', 6));                       // wrap
      sRect(tx - 1, ty + 9, tx + 15, ty + 10, C('gold', 5));                   // sash
      sLine(tx, ty + 1, tx + 13, ty + 11, C('linen', 5));                      // satchel strap
      sRect(tx - 4, ty + 10, tx + 1, ty + 15, C('linen', 6)); sRect(tx - 4, ty + 10, tx + 1, ty + 10, C('gold', 5));
      if (o.seed) { const s = o.seed, cx = tx + 9, cy = ty + 5; sRect(cx - 1, cy - 1, cx + 1, cy + 1, C('gold', 6), 3); if (s > 0.4) { sp(cx, cy, WHITE, 3); sp(cx - 2, cy, C('gold', 5), 3); sp(cx + 2, cy, C('gold', 5), 3); sp(cx, cy - 2, C('gold', 5), 3); sp(cx, cy + 2, C('gold', 5), 3); } }
    },
    front(o, hx, hy) {
      sPoly([[hx - 9, hy - 3], [hx - 6, hy - 11], [hx + 3, hy - 12], [hx + 9, hy - 8], [hx + 5, hy - 7], [hx + 6, hy - 4], [hx + 2, hy - 7], [hx - 2, hy - 5], [hx - 5, hy - 7]], C('stone', 7));
      sLine(hx - 3, hy - 11, hx + 4, hy - 11, WHITE);
      sRect(hx - 9, hy - 9, hx + 9, hy - 8, C('indigo', 2)); sEll(hx + 4, hy - 9, 2.5, 2, C('gold', 5));
      sLine(hx + 1, hy + 3, hx + 3, hy + 5, C('gold', 5));                     // the gold courier mark
    },
    prop(o, x, y) { if (o.blade !== undefined) sBlade(x, y, o.blade, 13, 1.1, C('indigo', 5), C('indigo', 7), C('gold', 5), C('indigo', 1), o.storm ? C('gold', 7) : undefined); },
    backProp(o, x, y) { if (o.blade2 !== undefined) sBlade(x, y, o.blade2, 11, 1.0, C('indigo', 4), C('indigo', 6), C('gold', 4), C('indigo', 1)); },
  };
  CAST.tamo = {
    hairC: C('teal', 4),
    frontH(o, hx, hy) { sEll(hx, hy - 6, 10.5, 4.5, C('teal', 4), 1, (x, y) => y < hy - 6); for (let k = -2; k <= 2; k++) sPoly([[hx + k * 4 - 2, hy - 8], [hx + k * 4 + 2, hy - 8], [hx + k * 4 + (k > 0 ? 1 : -1), hy - 3]], C('teal', 4)); sEll(hx, hy - 14, 4, 3.5, C('teal', 4)); sRect(hx - 1, hy - 12, hx + 1, hy - 10, C('gold', 5)); sRect(hx - 9, hy + 7, hx + 9, hy + 9, C('teal', 5)); sRect(hx - 6, hy + 2, hx - 5, hy + 3, C('rose', 5)); sRect(hx + 5, hy + 2, hx + 6, hy + 3, C('rose', 5)); },
    backH(o, hx, hy) { sEll(hx, hy - 14, 4, 3.5, C('teal', 4)); sRect(hx - 1, hy - 12, hx + 1, hy - 10, C('gold', 5)); sRect(hx - 9, hy + 7, hx + 9, hy + 9, C('teal', 5)); sLine(hx + 2, hy + 9, hx + 6 + (o.wind || 0), hy + 15, C('teal', 5), 2); },
    torsoFB(o, tx, ty, back) { sRect(tx - 2, ty + 1, tx + 18, ty + 15, C('linen', 5)); sRect(tx - 3, ty + 9, tx + 19, ty + 11, C('sea', 4)); sEll(back ? tx + 2 : tx + 15, ty + 2, 4.5, 3.2, C('rose', 6)); },
    eye: C('night', 1), brow: C('teal', 2), mouth: C('crimson', 1), glow: C('teal', 7),
    cap: C('teal', 4), cloth: C('linen', 5), clothL: C('linen', 7), arm: C('skin', 4), armD: C('skin', 3),
    leg: C('linen', 4), legD: C('linen', 3), boot: C('wood', 3), bootD: C('wood', 2),
    backHair(o, hx, hy) { sEll(hx - 3, hy - 14, 4, 3.5, C('teal', 4)); sRect(hx - 4, hy - 12, hx - 2, hy - 10, C('gold', 5)); },
    torso(o, tx, ty) {
      sRect(tx - 2, ty + 1, tx + 16, ty + 15, C('linen', 5)); sRect(tx - 3, ty + 9, tx + 17, ty + 11, C('sea', 4));
      sEll(tx + 12, ty + 2, 5, 3.5, C('rose', 6)); sLine(tx + 9, ty + 1, tx + 15, ty + 1, C('rose', 4)); sLine(tx + 9, ty + 3, tx + 15, ty + 3, C('rose', 4));
    },
    front(o, hx, hy) {
      for (let k = 0; k < 5; k++) sPoly([[hx - 8 + k * 4, hy - 10], [hx - 4 + k * 4, hy - 10], [hx - 6 + k * 4 + (k > 2 ? 2 : 0), hy - 4]], C('teal', 4));
      sLine(hx - 6, hy - 10, hx + 6, hy - 11, C('teal', 6));
      sRect(hx - 9, hy + 7, hx + 9, hy + 9, C('teal', 5)); sLine(hx - 8, hy + 9, hx - 14 - (o.wind || 0), hy + 14 - (o.wind || 0) * 0.5, C('teal', 5), 2);
      sRect(hx - 4, hy + 2, hx - 2, hy + 3, C('rose', 5));
    },
    prop(o, x, y) { if (o.anchor !== undefined) drawAnchor(x, y, o.anchor, o.anchorGlow); },
  };
  function drawAnchor(x, y, ang, glowA) {
    const ca = Math.cos(ang), sa = Math.sin(ang), L = 20, ex = x + ca * L, ey = y + sa * L;
    const iron = glowA ? C('teal', 6) : C('stone', 4), ironL = glowA ? C('teal', 7) : C('stone', 6), ironD = glowA ? C('teal', 4) : C('stone', 2);
    sLine(x - ca * 4, y - sa * 4, ex, ey, iron, 3, 2); sLine(x - ca * 4, y - sa * 4, ex, ey, ironL, 1, 2);
    sEll(x - ca * 6, y - sa * 6, 2.5, 2.5, iron, 2); sEll(x - ca * 6, y - sa * 6, 1, 1, ironD, 2);
    sLine(x + ca * 2 - sa * 6, y + sa * 2 + ca * 6, x + ca * 2 + sa * 6, y + sa * 2 - ca * 6, iron, 2, 2);  // stock
    for (let k = -10; k <= 10; k++) { const bx = ex + ca * (Math.abs(k) * 0.25) * -1 - sa * k, by = ey + sa * (Math.abs(k) * 0.25) * -1 + ca * k; sp(bx, by, iron, 2); sp(bx + ca, by + sa, iron, 2); sp(bx - ca, by - sa, ironD, 2); }
    for (const s of [-1, 1]) { const fx = ex - sa * 10 * s - ca * 2.5, fy = ey + ca * 10 * s - sa * 2.5; sPoly([[fx, fy], [fx - ca * 5 + sa * 2 * s, fy - sa * 5 - ca * 2 * s], [fx + sa * 3 * s, fy - ca * 3 * s]], ironL, 2); }
  }
  CAST.sable = {
    hairC: C('char', 1),
    frontH(o, hx, hy) { sEll(hx, hy - 4, 11, 7, C('char', 1), 1, (x, y) => y < hy - 5 || Math.abs(x - hx) > 8.5); sPoly([[hx - 1, hy - 10], [hx - 9, hy - 6], [hx - 10, hy + 2], [hx - 7, hy - 3]], C('char', 1)); sPoly([[hx + 1, hy - 10], [hx + 9, hy - 6], [hx + 10, hy + 2], [hx + 7, hy - 3]], C('char', 1)); sRect(hx + 7, hy - 13, hx + 10, hy - 11, C('crimson', 5)); if (o.mask) { sPoly([[hx, hy - 7], [hx + 8, hy - 6], [hx + 9, hy + 6], [hx + 1, hy + 7]], C('hush', 6)); sLine(hx + 4, hy - 6, hx + 6, hy - 1, C('night', 1)); sLine(hx + 6, hy - 1, hx + 4, hy + 4, C('night', 1)); } },
    backH(o, hx, hy) { const sw = (o.wind || 0); sPoly([[hx - 3, hy - 9], [hx + 3, hy - 9], [hx + 4 + sw, hy + 22], [hx - 4 + sw * 1.2, hy + 24]], C('char', 1)); sLine(hx, hy - 6, hx + sw * 0.8, hy + 20, C('char', 3)); sRect(hx - 3, hy - 11, hx + 3, hy - 9, C('crimson', 5)); },
    torsoFB(o, tx, ty, back) { if (!back) { sLine(tx + 4, ty, tx + 8, ty + 8, C('linen', 6)); sLine(tx + 12, ty, tx + 8, ty + 8, C('linen', 6)); } sRect(tx - 1, ty + 9, tx + 17, ty + 11, C('crimson', 4)); },
    eye: C('night', 1), brow: C('char', 1), mouth: C('crimson', 2), glow: C('ember', 6),
    cap: C('char', 1), cloth: C('char', 3), clothL: C('char', 5), arm: C('char', 3), armD: C('char', 2),
    leg: C('char', 2), legD: C('char', 1), boot: C('char', 1), bootD: C('night', 1),
    backHair(o, hx, hy) {
      sEll(hx - 1, hy - 3, 11, 10, C('char', 1));
      const sw = (o.wind || 0);
      sPoly([[hx - 6, hy - 11], [hx - 14 - sw, hy - 12], [hx - 22 - sw * 1.5, hy - 6], [hx - 25 - sw * 1.8, hy + 3], [hx - 20 - sw * 1.4, hy], [hx - 15 - sw, hy - 5], [hx - 8, hy - 5]], C('char', 1));
      sLine(hx - 14 - sw, hy - 10, hx - 22 - sw * 1.5, hy - 4, C('char', 3));
      if (o.embers) for (let k = 0; k < 3; k++) sp(hx - 24 - sw * 1.8 + k, hy + 2 - k, C('ember', 6), 3);
      sRect(hx - 8, hy - 12, hx - 5, hy - 10, C('crimson', 5));
    },
    torso(o, tx, ty) { sLine(tx + 6, ty, tx + 10, ty + 8, C('linen', 6)); sLine(tx + 10, ty + 8, tx + 8, ty + 15, C('char', 5)); sRect(tx - 1, ty + 9, tx + 15, ty + 11, C('crimson', 4)); sLine(tx - 1, ty + 11, tx - 5, ty + 18, C('crimson', 4), 2); },
    front(o, hx, hy) {
      sPoly([[hx - 9, hy - 4], [hx - 7, hy - 10], [hx + 2, hy - 11], [hx + 8, hy - 9], [hx + 4, hy - 6], [hx + 1, hy - 7], [hx - 3, hy - 4], [hx - 6, hy - 6]], C('char', 1));
      sLine(hx - 4, hy - 9, hx + 3, hy - 10, C('char', 3));
      if (o.mask) { sPoly([[hx + 5, hy - 8], [hx + 10, hy - 6], [hx + 10, hy + 6], [hx + 6, hy + 7], [hx + 5, hy + 1]], C('hush', 6)); sLine(hx + 7, hy - 7, hx + 9, hy - 2, C('night', 1)); sLine(hx + 9, hy - 2, hx + 7, hy + 3, C('night', 1)); sRect(hx + 7, hy - 1, hx + 8, hy, o.embers ? C('ember', 6) : C('night', 1)); }
    },
    prop(o, x, y) { if (o.sword !== undefined) sBlade(x, y, o.sword, 25, 1.3, o.embers ? C('ember', 5) : C('stone', 5), o.embers ? C('ember', 7) : C('stone', 7), C('gold', 5), C('crimson', 2), o.embers ? C('gold', 7) : undefined); },
  };
  CAST.mira = {
    hairC: C('gold', 5),
    frontH(o, hx, hy) { sPoly([[hx - 7, hy - 4], [hx - 4, hy - 8], [hx + 4, hy - 8], [hx + 7, hy - 4], [hx + 3, hy - 6], [hx - 3, hy - 6]], C('wood', 2)); sPoly([[hx - 12, hy + 4], [hx - 11, hy - 6], [hx - 5, hy - 12], [hx + 5, hy - 12], [hx + 11, hy - 6], [hx + 12, hy + 4], [hx + 9, hy + 4], [hx + 9, hy - 5], [hx + 4, hy - 9], [hx - 4, hy - 9], [hx - 9, hy - 5], [hx - 9, hy + 4]], C('gold', 5)); sLine(hx - 4, hy - 11, hx + 4, hy - 11, C('gold', 7)); },
    backH(o, hx, hy) { sEll(hx, hy, 12, 11, C('gold', 5)); sLine(hx, hy - 10, hx, hy + 9, C('gold', 4)); },
    torsoFB(o, tx, ty, back) { if (!back) { sRect(tx + 7, ty + 1, tx + 8, ty + 14, C('gold', 4)); for (let k = 0; k < 3; k++) sp(tx + 10, ty + 3 + k * 4, C('linen', 7)); } },
    eye: C('night', 1), brow: C('wood', 2), mouth: C('crimson', 2),
    cap: null, cloth: C('gold', 5), clothL: C('gold', 6), arm: C('gold', 5), armD: C('gold', 4),
    leg: C('crimson', 4), legD: C('crimson', 3), boot: C('crimson', 4), bootD: C('crimson', 3),
    backHair(o, hx, hy) { sEll(hx - 1, hy - 1, 11.5, 11, C('gold', 5)); },        // the hood
    torso(o, tx, ty) { sRect(tx + 6, ty + 1, tx + 7, ty + 14, C('gold', 4)); for (let k = 0; k < 3; k++) sp(tx + 9, ty + 3 + k * 4, C('linen', 7)); },
    front(o, hx, hy) {
      sPoly([[hx - 8, hy - 3], [hx - 6, hy - 9], [hx + 3, hy - 10], [hx + 8, hy - 7], [hx + 3, hy - 6], [hx - 1, hy - 4]], C('wood', 2));
      sPoly([[hx - 11, hy + 3], [hx - 11, hy - 6], [hx - 5, hy - 11], [hx + 5, hy - 11], [hx + 11, hy - 6], [hx + 10, hy - 4], [hx + 4, hy - 9], [hx - 4, hy - 9], [hx - 9, hy - 4]], C('gold', 5));
      sLine(hx - 4, hy - 10, hx + 4, hy - 10, C('gold', 7));
    },
    prop(o, x, y) { if (o.lantern) { sLine(x, y, x, y + 3, C('wood', 2)); sRect(x - 2, y + 3, x + 2, y + 8, C('ember', 6), 3); sRect(x - 1, y + 4, x + 1, y + 7, C('gold', 7), 3); } if (o.chalk) sRect(x, y - 1, x + 1, y, WHITE, 2); },
  };
  CAST.warden = {
    hairC: C('linen', 6),
    frontH(o, hx, hy) { sPoly([[hx - 12, hy + 6], [hx - 10, hy - 10], [hx, hy - 19 - (o.captain ? 6 : 0)], [hx + 10, hy - 10], [hx + 12, hy + 6], [hx + 9, hy + 6], [hx + 8, hy - 7], [hx - 8, hy - 7], [hx - 9, hy + 6]], C('linen', 6)); sEll(hx, hy + 1, 8, 7.5, C('linen', 7)); sRect(hx - 7, hy - 1, hx + 7, hy + 1, C('night', 1)); sRect(hx - 5, hy - 1, hx - 4, hy, o.captain ? C('gold', 6) : C('indigo', 6)); sRect(hx + 3, hy - 1, hx + 4, hy, o.captain ? C('gold', 6) : C('indigo', 6)); if (o.captain) sLine(hx, hy - 24, hx, hy - 14, C('gold', 6), 2); },
    backH(o, hx, hy) { sPoly([[hx - 12, hy + 7], [hx - 10, hy - 10], [hx, hy - 19 - (o.captain ? 6 : 0)], [hx + 10, hy - 10], [hx + 12, hy + 7]], C('linen', 6)); },
    torsoFB(o, tx, ty, back) { sRect(tx - 1, ty + 8, tx + 17, ty + 10, o.captain ? C('gold', 5) : C('indigo', 4)); },
    eye: C('night', 0), brow: 'none', mouth: C('linen', 4),
    cap: null, cloth: C('linen', 6), clothL: C('linen', 7), arm: C('linen', 6), armD: C('linen', 4),
    robe: C('linen', 6), robeD: C('linen', 4), boot: C('indigo', 2), bootD: C('indigo', 1),
    backHair(o, hx, hy) { sPoly([[hx - 12, hy + 6], [hx - 9, hy - 11], [hx + 1, hy - 18 - (o.captain ? 6 : 0)], [hx + 10, hy - 10], [hx + 11, hy + 6]], C('linen', 6)); if (o.captain) sLine(hx + 1, hy - 23, hx + 1, hy - 14, C('gold', 6), 2); },
    torso(o, tx, ty) { sRect(tx - 1, ty + 8, tx + 15, ty + 10, o.captain ? C('gold', 5) : C('indigo', 4)); sLine(tx + 7, ty, tx + 7, ty + 15, C('linen', 4)); },
    front(o, hx, hy) {
      // a veil over the whole face, with a dark slit for the eyes
      sEll(hx + 1, hy + 1, 9, 8.5, C('linen', 7)); sRect(hx + 1, hy - 1, hx + 9, hy + 1, C('night', 1));
      sRect(hx + 3, hy - 1, hx + 4, hy, o.captain ? C('gold', 6) : C('indigo', 6)); sRect(hx + 7, hy - 1, hx + 8, hy, o.captain ? C('gold', 6) : C('indigo', 6));
      sLine(hx - 7, hy + 4, hx + 8, hy + 6, C('linen', 5));
    },
    prop(o, x, y) { if (o.spear !== undefined) { const a = o.spear, ca = Math.cos(a), sa = Math.sin(a); sLine(x - ca * 12, y - sa * 12, x + ca * 22, y + sa * 22, C('wood', 4), 2, 2); sBlade(x + ca * 19, y + sa * 19, a, 7, 1.4, C('stone', 5), C('stone', 7)); for (let k = 0; k < 5; k++) sp(x - ca * (10 + k * 2) + Math.sin(k + T_NOW * 9) * 1.5, y - sa * (10 + k * 2) + 3, C('stone', 6), 2); } },
  };
  CAST.docker = {
    hairC: C('stone', 5),
    frontH(o, hx, hy) { sPoly([[hx - 11, hy - 4], [hx - 9, hy - 11], [hx + 9, hy - 11], [hx + 11, hy - 4]], C('wood', 3)); sRect(hx - 12, hy - 5, hx + 12, hy - 4, C('wood', 2)); sPoly([[hx - 6, hy + 3], [hx + 6, hy + 3], [hx + 4, hy + 11], [hx - 4, hy + 11]], C('stone', 6)); },
    eye: C('night', 1), brow: C('stone', 6), mouth: C('crimson', 1),
    cap: null, cloth: C('linen', 4), clothL: C('linen', 6), arm: C('skin', 3), armD: C('skin', 2),
    leg: C('wood', 3), legD: C('wood', 2), boot: C('wood', 1), bootD: C('wood', 1),
    torso(o, tx, ty) { sRect(tx - 2, ty, tx + 16, ty + 15, C('linen', 4)); sRect(tx + 1, ty + 4, tx + 13, ty + 15, C('wood', 4)); },
    front(o, hx, hy) { sPoly([[hx - 10, hy - 3], [hx - 9, hy - 10], [hx + 4, hy - 11], [hx + 11, hy - 7], [hx + 11, hy - 5], [hx - 10, hy - 4]], C('wood', 3)); sRect(hx + 9, hy - 7, hx + 13, hy - 5, C('wood', 3)); sPoly([[hx - 2, hy + 3], [hx + 10, hy + 3], [hx + 8, hy + 10], [hx + 2, hy + 10]], C('stone', 6)); },
  };
  CAST.hollow = {
    hairC: C('char', 0),
    frontH(o, hx, hy) { for (let k = 0; k < 7; k++) { const x = hx - 9 + k * 3; sLine(x, hy - 9, x + (ih(k, 3, 701) - 0.5) * 4, hy - 14 - ih(k, 4, 701) * 5, C('char', 0)); } },
    backH(o, hx, hy) { for (let k = 0; k < 7; k++) { const x = hx - 9 + k * 3; sLine(x, hy - 9, x + (ih(k, 3, 701) - 0.5) * 4, hy - 14 - ih(k, 4, 701) * 5, C('char', 0)); } },
    eye: WHITE, brow: 'none', mouth: C('char', 0), skin: C('char', 1), skinD: C('char', 0),
    cap: C('char', 0), cloth: C('char', 1), clothL: C('char', 2), arm: C('char', 1), armD: C('char', 0),
    leg: C('char', 1), legD: C('char', 0), boot: C('char', 0), bootD: C('char', 0),
    front(o, hx, hy) {
      for (let k = 0; k < 7; k++) { const x = hx - 9 + k * 3; sLine(x, hy - 9, x + (ih(k, 3, 701) - 0.5) * 4, hy - 14 - ih(k, 4, 701) * 5, C('char', 0)); }
      for (let k = 0; k < 6; k++) sp(hx - 8 + fl(ih(k, 1, 702) * 18), hy - 6 + fl(ih(k, 2, 702) * 14), C('crimson', 5));
    },
  };

  // the Bellwether: a tall robed lord with a cracked bronze bell for a head
  function drawBellwether(o) {
    const sw = o.sway || 0, ring = o.ring || 0, rob = C('violet', 2), robD = C('violet', 1), robL = C('violet', 3);
    sPoly([[18, 4], [42, 4], [52 + sw, 60], [8 + sw, 60]], rob);
    for (let k = 0; k < 6; k++) sLine(20 + k * 4, 6, 14 + k * 7 + sw, 59, k & 1 ? robD : robL);
    sRect(6 + sw, 58, 54 + sw, 60, robD);
    // long arms with grey hands
    const aa = o.arms === undefined ? 1.3 : o.arms;
    for (const s of [-1, 1]) { const sx = s < 0 ? 18 : 42, ex = sx + Math.cos(s < 0 ? PI - aa : aa) * 26, ey = 8 + Math.sin(aa) * 26; sLine(sx, 8, ex, ey, rob, 4); for (let f = -1; f <= 1; f++) sLine(ex, ey, ex + f * 3 + s * 2, ey + 6, C('stone', 5), 1); }
    // the bell
    const bx = 30, by = -8 + (ring ? Math.sin(T_NOW * 60) * ring : 0);
    sPoly([[bx - 8, by - 12], [bx + 8, by - 12], [bx + 14, by + 8], [bx - 14, by + 8]], C('gold', 3));
    sEll(bx, by - 12, 8, 4, C('gold', 4)); sRect(bx - 1, by - 19, bx + 1, by - 15, C('gold', 2));
    sRect(bx - 15, by + 7, bx + 15, by + 9, C('gold', 2));
    for (let k = 0; k < 4; k++) sLine(bx - 6 + k * 4, by - 10, bx - 9 + k * 6, by + 6, C('gold', 4));
    sLine(bx + 4, by - 11, bx + 1, by - 3, C('night', 0)); sLine(bx + 1, by - 3, bx + 6, by + 6, C('night', 0));            // the crack
    sRect(bx - 9, by + 2, bx + 9, by + 4, C('night', 0)); sRect(bx - 6, by + 3, bx + 6, by + 3, o.glowEyes ? WHITE : C('hush', 2), 3);
  }
  // the Hollow King, from behind: a tall cloak and a floating ring crown of glyphs
  function drawKing(o) {
    sPoly([[22, -10], [38, -10], [48, 60], [12, 60]], C('night', 1));
    sLine(30, -10, 30, 60, C('night', 2));
    sEll(30, -16, 7, 7, C('night', 1));
    const cy = -30, r = 11;
    for (let a = 0; a < TAU; a += 0.06) { const x = 30 + Math.cos(a + T_NOW * 0.3) * r, y = cy + Math.sin(a + T_NOW * 0.3) * r * 0.35; if (fl(a * 8) % 3) sp(x, y, WHITE, 3); }
  }
  // Vesper as a shape in the fog: armour, a violet crest, a lantern
  function drawVesper(o) {
    sPoly([[18, 20], [42, 20], [44, 52], [16, 52]], C('stone', 3)); sRect(20, 52, 26, 60, C('stone', 2)); sRect(34, 52, 40, 60, C('stone', 2));
    sEll(30, 12, 10, 10, C('stone', 3)); sRect(31, 10, 39, 13, C('night', 0)); sRect(33, 11, 34, 12, C('violet', 6), 3); sRect(37, 11, 38, 12, C('violet', 6), 3);
    for (let k = 0; k < 6; k++) sLine(24 + k * 2, 2, 22 + k * 2, -6 - [5, 8, 10, 9, 6, 3][k], k % 2 ? C('violet', 6) : C('violet', 7), 2, 3);
    sPoly([[14, 22], [4, 58], [18, 58]], C('crimson', 2));
    sRect(40, 40, 44, 46, C('gold', 4)); sRect(41, 41, 43, 45, C('violet', 7), 3);
  }

  // build a sprite for a character in a pose; returns anchor points in local space
  // a run or walk drives the whole body: arms swing against the legs, the body dips on each footfall and rises
  // as the legs pass, the runner leans in and the hair streams; anything a shot sets explicitly wins
  function cycle(o) {
    const ph = o.run !== undefined ? o.run : o.walk; if (ph === undefined || o.air) return o;
    const s = Math.sin(ph), k = o.run !== undefined ? 1 : 0.55, q = Object.assign({}, o);
    if (o.run === undefined) { q.run = ph; q.stride = 0; }
    if (q.bob === undefined) q.bob = Math.abs(s) > 0.75 ? 1 : Math.abs(s) < 0.3 ? -1 : 0;
    if (q.armF === undefined) { q.armF = PI / 2 + s * 0.95 * k - 0.15; q._autoArms = s * k * 2; }
    if (q.armB === undefined) q.armB = PI / 2 - s * 0.95 * k - 0.1;
    if (q.armL === undefined) q.armL = PI / 2 + 0.35 - s * 0.6 * k;
    if (q.lean === undefined) q.lean = o.run !== undefined ? 2 : 0.5;
    if (q.wind === undefined) q.wind = o.run !== undefined ? 3 : 1;
    q._gait = k;
    return q;
  }
  function buildChar(who, o) {
    clearSprite(); o = cycle(o);
    let r = null;
    if (who === 'bellwether') drawBellwether(o);
    else if (who === 'king') drawKing(o);
    else if (who === 'vesper') drawVesper(o);
    else r = o.view && o.view !== 'side' ? bodyFB(o, CAST[who], o.view) : body(o, CAST[who]);
    outlineSprite(who === 'hollow' || who === 'king' ? C('char', 0) : undefined);
    return r;
  }

  // ---------------------------------------------------------------- stamping: scale, rotate, mirror, depth test, light
  const SMASK = new Uint8Array(NP), SMB = [0, 0, 0, 0];
  let T_NOW = 0;
  // draw the built sprite with its feet at screen (x, y); S pixels per sprite pixel; opt: z (depth), dark (shades), rim {side, T, a},
  // color, alpha, white, tint {T, a}, ghost
  function stamp(x, y, S, ang, flip, opt) {
    opt = opt || {};
    const ca = Math.cos(ang || 0), sa = Math.sin(ang || 0), z = opt.z === undefined ? 0.01 : opt.z;
    // feet at local (30, 60)
    const fxl = 30 + SOX, fyl = 60 + SOY;
    let Rr = 0; for (const [lx, ly] of [[SBB[0], SBB[1]], [SBB[2] + 1, SBB[1]], [SBB[0], SBB[3] + 1], [SBB[2] + 1, SBB[3] + 1]]) Rr = Math.max(Rr, Math.hypot(lx - fxl, ly - fyl));
    Rr = Rr * S + 2;
    const x0 = Math.max(0, fl(x - Rr)), x1 = Math.min(W - 1, Math.ceil(x + Rr)), y0 = Math.max(0, fl(y - Rr)), y1 = Math.min(H - 1, Math.ceil(y + Rr));
    if (!opt.keepMask) { SMB[0] = W; SMB[1] = H; SMB[2] = -1; SMB[3] = -1; }
    const dark = opt.dark || 0, rim = opt.rim, fogT = opt.fog ? ENV.fog : null, fa = opt.fog ? fogA(z) : 0;
    for (let Y = y0; Y <= y1; Y++) for (let X = x0; X <= x1; X++) {
      const dx = X + 0.5 - x, dy = Y + 0.5 - y;
      let lx = (dx * ca + dy * sa) / S; const ly = (-dx * sa + dy * ca) / S;
      if (flip) lx = -lx;
      const ix = fl(lx + fxl), iy = fl(ly + fyl);
      if (ix < 0 || iy < 0 || ix >= SW || iy >= SH) continue;
      const si = iy * SW + ix, c0 = SPR[si]; if (!c0) continue;
      if (opt.alpha !== undefined && bay(X, Y) > opt.alpha) continue;
      const i = Y * W + X; if (z > ZB[i]) continue;
      let c = c0 - 1;
      if (opt.color !== undefined) c = opt.color;
      else if (opt.white) c = SPK[si] === 4 ? C('hush', 2) : WHITE;
      else {
        if (dark && SPK[si] !== 3) c = RD(c, dark);
        if (rim && SPK[si] !== 4) { const nb = flip ? -rim.side : rim.side; if (!SPR[si + nb] || SPK[si + nb] === 4 || !SPR[si + nb * 2]) c = rim.T[Math.min(7, fl(rim.a * 8)) * NPAL + c]; }
        if (opt.tint) c = opt.tint.T[Math.min(7, Math.max(0, fl(opt.tint.a * 8 + bay(X, Y) - 0.5))) * NPAL + c];
        if (fogT && fa > 0 && SPK[si] !== 3) { const l = Math.min(7, fl(fa * 8 + bay(X, Y) - 0.5)); if (l >= 0) c = fogT[l * NPAL + c]; }
      }
      BUF[i] = c; if (!opt.noZ) ZB[i] = z; IDB[i] = 65535; EMIS[i] = SPK[si] === 3 ? 1 : 0;
      if (!opt.noMask) { SMASK[i] = 1; if (X < SMB[0]) SMB[0] = X; if (Y < SMB[1]) SMB[1] = Y; if (X > SMB[2]) SMB[2] = X; if (Y > SMB[3]) SMB[3] = Y; }
    }
  }
  function clearMask() { if (SMB[2] >= SMB[0]) for (let y = SMB[1]; y <= SMB[3]; y++) SMASK.fill(0, y * W + SMB[0], y * W + SMB[2] + 1); SMB[0] = W; SMB[1] = H; SMB[2] = -1; SMB[3] = -1; }
  const ROWT = new Uint8Array(W);
  function glitchRows(t, amp, prob) {
    const f = fl(t * 15); prob = prob || 0.18;
    for (let y = SMB[1]; y <= SMB[3]; y++) {
      const band = fl(y / 3); if (ih(band, f, 51) > prob) continue;
      const sh = Math.round((ih(band, f, 52) - 0.5) * 2 * amp); if (!sh) continue;
      const o = y * W; for (let x = SMB[0]; x <= SMB[2]; x++) ROWT[x] = BUF[o + x];
      for (let x = SMB[0]; x <= SMB[2]; x++) { const sx = x - sh; if (sx >= SMB[0] && sx <= SMB[2] && SMASK[o + sx]) BUF[o + x] = ROWT[sx]; }
    }
  }
  // light the built sprite: the pixels on the side facing the light step up their ramp (a rim), and the outline on that
  // side can take a pale edge colour (ENV.edge), so figures read against any background
  const RIMT = new Uint8Array(SW * SH);
  function rimSprite(dx, dy, k, edge) {
    if (k <= 0 && edge === undefined) return;
    const ox = Math.round(dx * 1.4), oy = Math.round(dy * 1.4); if (!ox && !oy) return;
    RIMT.set(SPR);
    const x0 = Math.max(2, SBB[0]), x1 = Math.min(SW - 3, SBB[2]), y0 = Math.max(2, SBB[1]), y1 = Math.min(SH - 3, SBB[3]);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const i = y * SW + x, c = RIMT[i]; if (!c) continue;
      const kd = SPK[i], j = i + oy * SW + ox, n = RIMT[j], nk = SPK[j];
      if (kd === 4) { if (edge !== undefined && !n) SPR[i] = edge + 1; continue; }
      if (kd === 3) continue;
      if (k > 0 && (!n || nk === 4)) { const v = c - 1; SPR[i] = ((v & ~7) | Math.min(7, (v & 7) + k)) + 1; }
    }
  }
  // the light's direction on screen (toward the light), from the sun and the camera, unless a shot sets ENV.rimDir
  function rimDir() {
    if (ENV.rimDir) return ENV.rimDir;
    const s = ENV.sun; let x = s[0] * CAM.rx + s[1] * CAM.ry + s[2] * CAM.rz, y = -(s[0] * CAM.ux + s[1] * CAM.uy + s[2] * CAM.uz);
    const l = Math.hypot(x, y); if (l < 0.2) { x = -0.6; y = -0.8; } else { x /= l; y /= l; }
    return [x, y];
  }
  // pixel art at one scale: big sprites snap to whole pixels per sprite pixel, so they never shimmer as they move
  const snapS = (S) => { if (S < 0.85) return S; const r = Math.round(S); if (Math.abs(S - r) < 0.15) return r; return Math.round(S * 4) / 4; };
  // (whole pixels when close to a whole scale; otherwise quarter steps, so a slow dolly never jumps a whole size)
  // place a character in screen space: feet at (x, y), S scale. Hollow get ghosts and tearing.
  function actor(who, o, x, y, S, opt) {
    opt = opt || {};
    // standing figures breathe: the chest and head rise one pixel and settle
    if (o.run === undefined && !o.air && o.bob === undefined && !opt.still) { const ph = (who.charCodeAt(0) * 0.37 + (who.charCodeAt(1) || 0) * 0.11) % TAU; o = Object.assign({}, o, { bob: Math.sin(T_NOW * 2.3 + ph) > 0.35 ? -1 : 0 }); }
    const r = buildChar(who, o);
    if (!opt.white && opt.color === undefined && ENV.rimK !== 0) { const d = rimDir(), f = opt.flip ? -1 : 1; rimSprite(d[0] * f, d[1], ENV.rimK === undefined ? 1 : ENV.rimK, ENV.edge === null ? undefined : ENV.edge); }
    if (!opt.ang && !opt.smooth) { S = snapS(S); x = Math.round(x); y = Math.round(y); }
    if (typeof window !== 'undefined' && window.__dbgS !== undefined && who !== 'bellwether' && who !== 'king') window.__dbgS = Math.max(window.__dbgS, S);
    clearMask();
    if (who === 'hollow' && !opt.clean) {
      const off = Math.max(1, Math.round(S * 1.1)) + (fl(T_NOW * 12) % 3 === 0 ? 1 : 0);
      stamp(x - off, y, S, opt.ang, opt.flip, { z: opt.z, color: C('teal', 5), alpha: 0.3, noMask: true, noZ: true });
      stamp(x + off, y, S, opt.ang, opt.flip, { z: opt.z, color: C('crimson', 5), alpha: 0.3, noMask: true, noZ: true });
    }
    if (opt.after) for (const a of opt.after) stamp(a[0], a[1], S, opt.ang, opt.flip, { z: opt.z, color: a[2], alpha: a[3], noMask: true, noZ: true });
    stamp(x, y, S, opt.ang, opt.flip, opt);
    if ((who === 'hollow' && !opt.clean) || opt.glitch) glitchRows(T_NOW, Math.max(2, Math.round(S * 1.5)) * (1 + (opt.glitch || 0) * 3), opt.glitch ? 0.55 : 0.2);
    // where things are, in screen space
    const L = (p) => { if (!p) return null; let lx = (p[0] - 30) * S, ly = (p[1] - 60) * S; if (opt.flip) lx = -lx; const c = Math.cos(opt.ang || 0), s = Math.sin(opt.ang || 0); return [x + lx * c - ly * s, y + lx * s + ly * c]; };
    return r ? { hand: L(r.hand), head: L(r.head), chest: L(r.chest), S } : { head: L([30, 20]), S };
  }
  // a soft shadow where a figure meets the ground: a dithered dark disc on the surface under its feet (radius r metres)
  function contactShadow(wx, gy, wz, r, a) {
    const c = proj(wx, gy, wz); if (!c) return; const cx = c.x, cy = c.y, cz = c.z, R0 = r * CAM.F / cz * 1.2 + 2;
    const x0 = Math.max(0, fl(cx - R0)), x1 = Math.min(W - 1, Math.ceil(cx + R0)), y0 = Math.max(0, fl(cy - R0)), y1 = Math.min(H - 1, Math.ceil(cy + R0));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const d = ray(x + 0.5, y + 0.5); if (Math.abs(d.y) < 1e-4) continue;
      const t = (gy - CAM.y) / d.y; if (t <= 0) continue;
      const i = y * W + x; if (Math.abs(ZB[i] - t) > 0.04 * t + 0.05) continue;     // only on the ground itself
      const q = Math.hypot(CAM.x + t * d.x - wx, (CAM.z + t * d.z - wz) * 1.15) / r; if (q >= 1) continue;
      tintI(i, x, y, T_DARK, a * (1 - q * q));
    }
  }
  // place a character in the world: feet at (wx, wy, wz), hgt = sprite pixels per world metre (≈ 28 px is 1.6 m tall at S=1)
  // opt.gy: the ground under an airborne figure (its shadow shrinks and fades with height); opt.shadow: false for none
  function actor3(who, o, wx, wy, wz, opt) {
    opt = opt || {}; const p = proj(wx, wy, wz); if (!p) return null;
    const px = p.x, py = p.y, pz = p.z;
    const S = CAM.F / pz * (opt.size || 1) / 26;
    if (S > 12 && !opt.big) return null;                // a figure right on the lens: leave it out of the picture
    if (opt.shadow !== false && !opt.white && opt.alpha === undefined) {
      const gy = opt.gy === undefined ? wy : opt.gy, hgt = Math.max(0, wy - gy), sz = opt.size || 1;
      if (hgt < 6) contactShadow(wx, gy, wz, (0.5 + hgt * 0.05) * sz * (who === 'bellwether' ? 2.2 : 1), 0.55 * (1 - hgt / 6));
    }
    return Object.assign(actor(who, o, px, py, S, Object.assign({ z: pz + (opt.zBias || 0), fog: true }, opt)), { x: px, y: py, z: pz });
  }
  // a natural blink every few seconds
  const blink = (t, seed) => frac(t / (2.6 + ih(seed, 1, 9) * 1.8) + ih(seed, 2, 9)) < 0.045;

  /* ================================================================ effects */
  let SHAKE_A = 0;
  const shk = (a) => { SHAKE_A = Math.max(SHAKE_A, a); };
  const TMP = new Uint8Array(NP);
  // a 2D camera move on the finished picture: zoom z, roll r about (fx, fy), which lands at (sx, sy)
  function cam2(z, r, fx, fy, sx, sy) {
    if (sx === undefined) { sx = fx; sy = fy; }
    if (Math.abs(z - 1) < 0.002 && Math.abs(r) < 0.002 && fx === sx && fy === sy) return;
    TMP.set(BUF); const c = Math.cos(r) / z, s = Math.sin(r) / z;
    for (let y = 0; y < H; y++) { const dy = y + 0.5 - sy; for (let x = 0; x < W; x++) { const dx = x + 0.5 - sx; let X = fl(fx + dx * c + dy * s), Y = fl(fy - dx * s + dy * c); X = X < 0 ? 0 : X >= W ? W - 1 : X; Y = Y < 0 ? 0 : Y >= H ? H - 1 : Y; BUF[y * W + x] = TMP[Y * W + X]; } }
  }
  function whip(amt, dir) {
    if (amt < 1) return; TMP.set(BUF); const f = fl(T_NOW * 30), ca = Math.cos(dir), sa = Math.sin(dir);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const k = ih(fl(x / 3), y, f + 620) * amt; let X = fl(x - ca * k), Y = fl(y - sa * k); X = X < 0 ? 0 : X >= W ? W - 1 : X; Y = Y < 0 ? 0 : Y >= H ? H - 1 : Y; BUF[y * W + x] = TMP[Y * W + X]; }
  }
  function zoomBlur(cx, cy, amt) {
    if (amt < 0.01) return; TMP.set(BUF); const f = fl(T_NOW * 30);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const k = 1 - amt * ih(fl(x / 2), fl(y / 2), f + 630); let X = fl(cx + (x - cx) * k), Y = fl(cy + (y - cy) * k); X = X < 0 ? 0 : X >= W ? W - 1 : X; Y = Y < 0 ? 0 : Y >= H ? H - 1 : Y; BUF[y * W + x] = TMP[Y * W + X]; }
  }
  // two-tone impact frame: bright → ink and dark → light (mode 1) or the reverse (mode 0), with a burst of lines
  function impactFrame(cx, cy, mode) {
    for (let i = 0; i < NP; i++) { const l = LUM[BUF[i]]; BUF[i] = mode ? (l > 105 ? INK : WHITE) : (l > 140 ? WHITE : INK); }
    for (let k = 0; k < 44; k++) { const a = ih(k, 1, 81) * TAU, r0 = 30 + ih(k, 2, 81) * 40; lineF(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0, cx + Math.cos(a) * 520, cy + Math.sin(a) * 520, (x, y) => P(x, y, mode ? WHITE : INK)); }
  }
  function flashWhite(a) { if (a <= 0) return; if (a >= 1) { BUF.fill(WHITE); return; } tintAll(T_WH, a); }
  function fade(a, T) { if (a <= 0) return; if (a >= 1) { BUF.fill(BLACK); return; } tintAll(T || T_DARK, a); }
  function radialLines(cx, cy, n, inner, c, t, seed) {
    for (let k = 0; k < n; k++) {
      const a = ih(k, fl(t * 20), seed) * TAU, r0 = inner + ih(k, fl(t * 20) + 1, seed) * 60, w = ih(k, 3, seed) < 0.3 ? 2 : 1;
      for (let r = r0; r < 520; r++) { const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r; if (x < 0 || y < 0 || x >= W || y >= H) break; if (bay(fl(x), fl(y)) < 0.25 + (r - r0) / 300) { P(x, y, c); if (w > 1) P(x + Math.sin(a), y - Math.cos(a), c); } }
    }
  }
  function streaks(a, n, t, speed, c, len, seed, area) {
    const ca = Math.cos(a), sa = Math.sin(a), A = area || [0, 0, W, H];
    for (let k = 0; k < n; k++) {
      const L = len * (0.5 + ih(k, 1, seed)), px = ih(k, 2, seed) * (A[2] + 200) - 100 + A[0], py = ih(k, 3, seed) * A[3] + A[1];
      const off = frac(ih(k, 4, seed) + t * speed / 600) * 700 - 200, x0 = px + ca * off, y0 = py + sa * off;
      lineF(x0, y0, x0 + ca * L, y0 + sa * L, (x, y, u) => { if (bay(x, y) < 0.9 - u * 0.6) P(x, y, c); });
    }
  }
  function shockRing(cx, cy, r, ry, w, cols, fade_) { for (let k = 0; k < w; k++) ring(cx, cy, r - k, ry * (r - k) / Math.max(1, r), k < 1 ? cols[0] : k < w * 0.5 ? cols[1] : cols[2], (x, y) => bay(fl(x), fl(y)) < fade_); }
  function burst(cx, cy, u, R, rays, rot, cols, th) {
    if (u <= 0 || u >= 1) return; const len = R * eoc(u), w0 = th * (1 - u);
    for (let k = 0; k < rays; k++) { const a = rot + k * TAU / rays + (ih(k, 1, 71) - 0.5) * 0.25, L = len * (0.55 + 0.45 * ih(k, 2, 71)); lineF(cx, cy, cx + Math.cos(a) * L, cy + Math.sin(a) * L, (x, y, f) => { if (f > u * 0.85) { P(x, y, f < 0.6 ? cols[0] : cols[1]); if (w0 > 1.2) P(x + 1, y, cols[1]); } }); }
  }
  function debris(cx, cy, age, n, spread, up, cols, seed, g) {
    if (age < 0) return; g = g === undefined ? 260 : g;
    for (let k = 0; k < n; k++) { const a = -PI * (0.1 + 0.8 * ih(k, 1, seed)), v = spread * (0.4 + ih(k, 2, seed)); const x = cx + Math.cos(a) * v * age * 1.2, y = cy + Math.sin(a) * v * age * up + g * age * age, s = 1 + fl(ih(k, 3, seed) * 3); rectF(x, y, s, s, cols[k % cols.length]); }
  }
  // a swing smear: a crescent from angle a0 to a1 about (hx, hy), thick at its leading edge; drawn behind the last stamped sprite
  function smearArc(hx, hy, a0, a1, L, cols) {
    let d = a1 - a0; while (d > PI) d -= TAU; while (d < -PI) d += TAU; if (Math.abs(d) < 0.25) return;
    const Rm = L * 1.08, x0 = Math.max(0, fl(hx - Rm)), x1 = Math.min(W - 1, Math.ceil(hx + Rm)), y0 = Math.max(0, fl(hy - Rm)), y1 = Math.min(H - 1, Math.ceil(hy + Rm));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const i = y * W + x; if (SMASK[i]) continue;
      const dx = x + 0.5 - hx, dy = y + 0.5 - hy, r = Math.hypot(dx, dy); if (r > Rm || r < L * 0.55) continue;
      let rel = Math.atan2(dy, dx) - a0; rel = d > 0 ? ((rel % TAU) + TAU) % TAU : ((-rel % TAU) + TAU) % TAU; if (rel > Math.abs(d)) continue;
      const u = rel / Math.abs(d), rin = L * lerp(1.0, 0.62, u * u), rout = L * lerp(1.02, 1.07, u); if (r < rin || r > rout) continue;
      const e = (r - rin) / (rout - rin), b = bay(x, y); if (b > u * 1.6) continue;
      BUF[i] = e > 0.72 && u > 0.7 ? WHITE : u > 0.75 ? cols[2] : u > 0.45 ? (b < 0.5 ? cols[2] : cols[1]) : cols[0];
    }
  }
  // a hit (g seconds after it): ink flash, burst, ring, sparks, glow, shake
  function hitFx(x, y, g, power, cols) {
    if (g < 0 || g > 0.5) return; power = power || 1; cols = cols || [WHITE, C('gold', 6)];
    burst(x, y, g / 0.3, 90 * power, 14, ih(fl(x), fl(y), 611) * TAU, cols, 3);
    shockRing(x, y, 6 + g * 320 * power, 4 + g * 210 * power, 3, [WHITE, C('hush', 3), C('hush', 1)], 1 - g / 0.35);
    for (let k = 0; k < 18; k++) { const a = ih(k, fl(x), 612) * TAU, v = (60 + ih(k, 2, 612) * 170) * power, px = x + Math.cos(a) * v * g, py = y + Math.sin(a) * v * g + 200 * g * g; if (g < 0.4) { P(px, py, WHITE); P(px - Math.cos(a) * 2, py - Math.sin(a) * 2, cols[1]); } }
    glow(x, y, 50 * power * Math.max(0, 1 - g * 2), T_WH, 0.7);
    shk(5 * power * Math.max(0, 1 - g * 3));
    if (power >= 1 && g < (power >= 1.5 ? 0.067 : 0.034)) impactFrame(x, y, 1);
  }
  // the Hush: inside mask(x, y) → amount 0..1, colour drains to blank white, edges flicker with glyphs
  // the Hush: what it touches loses its colour and becomes a pale, unpainted sketch of itself (graphite lines on paper)
  const HUB = new Uint8Array(NP);
  function hushOver(amt, t, flecks) {
    if (flecks === undefined) flecks = true;
    HUB.set(BUF);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const a = amt(x, y); if (a <= 0) continue;
      const i = y * W + x, l = LUM[HUB[i]];
      if (a >= 0.85) {
        // an edge in the old picture stays as a faint line
        const lr = x < W - 1 ? LUM[HUB[i + 1]] : l, ld = y < H - 1 ? LUM[HUB[i + W]] : l, e = Math.max(Math.abs(l - lr), Math.abs(l - ld));
        if (e > 58) { BUF[i] = e > 95 ? C('stone', 5) : C('hush', 1); continue; }
        BUF[i] = shadeC(R.hush, 2.2 + l / 255 * 5.6, x, y);
        if (flecks && ih(x >> 1, y >> 1, fl(t * 12)) < 0.004) BUF[i] = C('crimson', 5);
        continue;
      }
      tintI(i, x, y, T_HUSH, a);
      if (flecks && a > 0.35 && a < 0.6 && ih(x >> 1, y >> 1, fl(t * 20)) < 0.05) BUF[i] = ih(x, y, 3) < 0.5 ? WHITE : C('crimson', 5);
    }
  }

  // a ring of white glyphs (the Hush sigil) as an ellipse on screen
  function sigil(cx, cy, r, ry, t, a, seed) {
    if (a <= 0) return;
    glow(cx, cy, r * 1.4, T_WH, 0.35 * a);
    for (let k = 0; k < 3; k++) {
      const rr = r * (1 - k * 0.16), rot = t * (k & 1 ? -0.4 : 0.3);
      for (let q = 0; q < 64; q++) {
        const ang = q / 64 * TAU + rot, x = cx + Math.cos(ang) * rr, y = cy + Math.sin(ang) * rr * (ry / r);
        if (ih(q, k, seed) > a) continue;
        const g = fl(ih(q, k + 7, seed) * 4);
        if (g === 0) { P(x, y, WHITE); P(x + 1, y, WHITE); P(x, y + 1, WHITE); } else if (g === 1) { P(x - 1, y, WHITE); P(x + 1, y, WHITE); P(x, y - 1, WHITE); } else if (g === 2) { P(x, y, WHITE); P(x, y - 1, C('hush', 3)); } else P(x, y, C('hush', 5));
      }
      ring(cx, cy, rr + 3, (rr + 3) * ry / r, C('hush', 4), (x, y) => bay(fl(x), fl(y)) < 0.5 * a);
    }
  }
  // a pixel glass shard / ember / dust in screen space
  function shard(x, y, s, ang, c, c2) { const ca = Math.cos(ang), sa = Math.sin(ang); for (let k = -s; k <= s; k++) { P(x + ca * k, y + sa * k, c); P(x + ca * k * 0.5 - sa, y + sa * k * 0.5 + ca, c2); } }

  // flames licking up from the last stamped sprite; cols: dark, mid, bright, core
  const ADIST = new Float32Array(NP);
  function aura(t, cols, Rr, opt) {
    opt = opt || {}; if (SMB[2] < SMB[0]) return; Rr = Math.max(2, Rr);
    const x0 = Math.max(0, SMB[0] - fl(Rr)), x1 = Math.min(W - 1, SMB[2] + fl(Rr)), y0 = Math.max(0, SMB[1] - fl(Rr * 2)), y1 = Math.min(H - 1, SMB[3] + fl(Rr * 0.8));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const i = y * W + x; ADIST[i] = SMASK[i] ? 0 : 1e9; }
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const i = y * W + x; let d = ADIST[i]; if (x > x0) d = Math.min(d, ADIST[i - 1] + 1); if (y > y0) { d = Math.min(d, ADIST[i - W] + 1); if (x > x0) d = Math.min(d, ADIST[i - W - 1] + 1.41); if (x < x1) d = Math.min(d, ADIST[i - W + 1] + 1.41); } ADIST[i] = d; }
    for (let y = y1; y >= y0; y--) for (let x = x1; x >= x0; x--) { const i = y * W + x; let d = ADIST[i]; if (x < x1) d = Math.min(d, ADIST[i + 1] + 1); if (y < y1) { d = Math.min(d, ADIST[i + W] + 1); if (x < x1) d = Math.min(d, ADIST[i + W + 1] + 1.41); if (x > x0) d = Math.min(d, ADIST[i + W - 1] + 1.41); } ADIST[i] = d; }
    const cyM = (SMB[1] + SMB[3]) / 2, hh = SMB[3] - SMB[1] + 1, sc = opt.scale || Math.max(1, Rr / 8), rise = opt.rise === undefined ? 1 : opt.rise;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const i = y * W + x; if (SMASK[i]) continue; const d = ADIST[i]; if (d > Rr * 2.2) continue;
      const up = y < cyM ? 1 + rise * (cyM - y) / hh * 1.1 : 0.75;
      const n = vn(x / sc, (y + t * 70 * rise) / sc, 4, 801) * 0.6 + vn(x / sc, (y + t * 110 * rise) / sc, 2, 802) * 0.4;
      const lim = Rr * up * (0.35 + 0.85 * n); if (d > lim) continue;
      const f = d / lim; if (f > 0.82 && bay(x, y) < 0.45) continue;
      BUF[i] = f < 0.25 ? cols[3] : f < 0.55 ? cols[2] : f < 0.82 ? cols[1] : cols[0];
    }
    const n = opt.sparks === undefined ? 16 : opt.sparks;
    for (let k = 0; k < n; k++) { const u = frac(ih(k, 1, 811) + t * (0.9 + ih(k, 2, 811))), x = lerp(SMB[0] - Rr * 0.5, SMB[2] + Rr * 0.5, ih(k, 3, 811)) + Math.sin(u * 6 + k) * 2, y = SMB[3] - u * (hh + Rr * 3); if (bay(fl(x), fl(y)) > 1 - u) continue; P(x, y, cols[u < 0.5 ? 3 : 2]); P(x, y + 1, cols[1]); }
  }
  // key tracks: [{t, ...numbers, ...anything}] — numbers ease (e: 'l' | 'o' | 'i' | 'io' | 's'), everything else holds
  const EASE = { l: (u) => u, o: eoc, i: eic, io: eio, b: eob, s: (u) => (u >= 1 ? 1 : 0) };
  function K(...keys) { for (let i = 1; i < keys.length; i++) for (const f in keys[i - 1]) if (!(f in keys[i]) && f !== 'e' && f !== 't') keys[i][f] = keys[i - 1][f]; return keys; }
  function trk(keys, t) {
    let k = 0; while (k < keys.length - 1 && keys[k + 1].t <= t) k++;
    const A = keys[k], B = keys[k + 1], o = Object.assign({}, A);
    if (B && t > A.t) { const u = EASE[B.e || 'io'](clamp((t - A.t) / (B.t - A.t), 0, 1)); for (const f in A) if (typeof A[f] === 'number' && typeof B[f] === 'number' && f !== 't') o[f] = A[f] + (B[f] - A[f]) * u; }
    return o;
  }
  // hit-stop: the clock stops for d seconds at each hit (hits in track time)
  function stopClock(lt, hits, d) { let o = lt, fz = false; for (let k = 0; k < hits.length; k++) { const h = hits[k] + k * d; if (lt >= h && lt < h + d) fz = true; o -= clamp(lt - h, 0, d); } return [o, fz]; }
  // a splash: a column and a crown of water drops (world point, age g)
  function splash3(x, y, z, g, size) {
    if (g < 0 || g > 1.6) return; size = size || 1;
    for (let k = 0; k < 60; k++) { const a = ih(k, 1, 821) * TAU, v = (1.5 + ih(k, 2, 821) * 3) * size, up = (4 + ih(k, 3, 821) * 6) * size; const px = x + Math.cos(a) * v * g, pz = z + Math.sin(a) * v * g * 0.6, py = y + up * g - 9.8 * g * g; if (py < y - 0.2) continue; p3(px, py, pz, k % 3 ? C('sea', 7) : WHITE, 0.12 * size); }
    for (let k = 0; k < 14; k++) { const h = (1 - g / 1.6) * 3 * size * (0.6 + ih(k, 4, 821) * 0.5); l3(x + (ih(k, 5, 821) - 0.5) * size, y, z + (ih(k, 6, 821) - 0.5) * size, x + (ih(k, 5, 821) - 0.5) * size * 1.2, y + h, z + (ih(k, 6, 821) - 0.5) * size, k & 1 ? C('sea', 6) : C('sea', 7), 2); }
  }
  /* ================================================================ the cut: shots, captions, lip sync, frame */
  const LB = 22;
  const SHOTS = [];
  const shot = (t0, t1, fn, opt) => SHOTS.push(Object.assign({ t0, t1, fn }, opt || {}));
  // dialogue: DLG (from the voice pass) holds each line's start, length, text and a mouth envelope at 30 fps
  function lineOf(who, t) { for (const l of DLG) if (l.who === who && t >= l.t0 && t < l.t0 + l.dur) return l; return null; }
  function mouth(who, t) {
    const l = lineOf(who, t); if (!l) return 0;
    const f = fl((t - l.t0) * 30), e = l.env; if (f < 0 || f >= e.length) return 0;
    return clamp((e.charCodeAt(f) - 48) / 9, 0, 1);
  }
  const talking = (who, t) => mouth(who, t) > 0.05;
  const CAPCOL = { sable: C('ember', 6), sable_vo: C('ember', 6), mira: C('gold', 6), king: C('hush', 5), oren: C('indigo', 6), warden: C('indigo', 6), kaira: C('gold', 6), tamo: C('teal', 6), docker: C('wood', 6), bellwether: C('gold', 4), vesper: C('violet', 6) };
  const CAPNAME = { sable: 'SABLE', sable_vo: '', mira: 'MIRA', king: '???', oren: 'OREN', warden: 'WARDEN', kaira: 'KAIRA', tamo: 'TAMO', docker: 'DOCKHAND', bellwether: 'THE BELLWETHER', vesper: '???' };
  function captions(t) {
    for (const l of DLG) {
      if (t < l.t0 - 0.05 || t >= l.t0 + l.dur + 0.35) continue;
      const s = l.text.replace(/\[[a-z]+\]\s*/g, '').toUpperCase(), name = CAPNAME[l.who], y = H - LB + 8;
      if (l.who === 'sable_vo') { const w = textWidth(s, 1); text(s, 240 - w / 2, y, C('linen', 6), 1); continue; }
      const tag = name + ':', tw = textWidth(tag, 1), w = tw + 5 + textWidth(s, 1);
      if (w <= 456) { const x0 = 240 - w / 2; text(tag, x0, y, CAPCOL[l.who], 1); text(s, x0 + tw + 5, y, C('hush', 5), 1); continue; }
      // too long for one line: break at the space nearest the middle and stack two lines in the bar
      let br = -1; for (let i = 0; i < s.length; i++) if (s[i] === ' ' && (br < 0 || Math.abs(i - s.length / 2) < Math.abs(br - s.length / 2))) br = i;
      const a = s.slice(0, br), b = s.slice(br + 1), wa = tw + 5 + textWidth(a, 1), wb = textWidth(b, 1), x0 = 240 - Math.max(wa, wb) / 2;
      text(tag, x0, H - LB + 3, CAPCOL[l.who], 1); text(a, x0 + tw + 5, H - LB + 3, C('hush', 5), 1); text(b, x0 + tw + 5, H - LB + 12, C('hush', 5), 1);
    }
  }
  // cards: on-screen titles in the picture area
  const CARDS = [];
  // only light sources bloom: sky, glows, fire and sprites' glowing bits, not every pale wall in daylight
  const RB_EM = (i) => IDB[i] === 0 || EMIS[i] === 1;
  // the lens: bright things bloom into the air around them, and the corners fall off into shadow
  const BLW = 120, BLH = 68, BL = new Float32Array(BLW * BLH), BL2 = new Float32Array(BLW * BLH);
  function lens() {
    const k = ENV.bloom;
    if (k > 0) {
      BL.fill(0);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const l = LUM[BUF[y * W + x]]; const i = y * W + x; if (l > 214 && (EMIS[i] === 1 || (IDB[i] === 0 && l > 238))) BL[(y >> 2) * BLW + (x >> 2)] += (l - 214) / 41 / 16; }
      for (let pass = 0; pass < 3; pass++) {
        for (let y = 0; y < BLH; y++) for (let x = 0; x < BLW; x++) { let v = 0, n = 0; for (let d = -2; d <= 2; d++) { const xx = x + d; if (xx >= 0 && xx < BLW) { v += BL[y * BLW + xx]; n++; } } BL2[y * BLW + x] = v / n; }
        for (let y = 0; y < BLH; y++) for (let x = 0; x < BLW; x++) { let v = 0, n = 0; for (let d = -2; d <= 2; d++) { const yy = y + d; if (yy >= 0 && yy < BLH) { v += BL2[yy * BLW + x]; n++; } } BL[y * BLW + x] = v / n; }
      }
      const T = ENV.bloomT || T_GOLD;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        // bilinear up from the quarter-size map
        const fx = x / 4 - 0.5, fy = y / 4 - 0.5, ix = clamp(fl(fx), 0, BLW - 2), iy = clamp(fl(fy), 0, BLH - 2), ux = clamp(fx - ix, 0, 1), uy = clamp(fy - iy, 0, 1);
        const v = lerp(lerp(BL[iy * BLW + ix], BL[iy * BLW + ix + 1], ux), lerp(BL[(iy + 1) * BLW + ix], BL[(iy + 1) * BLW + ix + 1], ux), uy);
        if (v > 0.02) tintI(y * W + x, x, y, T, Math.min(0.7, v * k * 2.2));
      }
    }
    if (ENV.vig > 0) for (let y = LB; y < H - LB; y++) for (let x = 0; x < W; x++) {
      const dx = (x - 240) / 240, dy = (y - 135) / 113, r = dx * dx * 0.75 + dy * dy * 0.5;
      if (r > 0.6) tintI(y * W + x, x, y, T_DARK, Math.min(0.3, (r - 0.6) * ENV.vig));
    }
  }
  let SHX = 0, SHY = 0;
  function render(t) {
    t = clamp(t, 0, D - 1 / FPS);
    T_NOW = t; SHAKE_A = 0; BUF.fill(BLACK); beginWorld();
    ENV.rimK = 1; ENV.edge = null; ENV.rimDir = null; ENV.bloom = 0.5; ENV.coolT = T_SHADE; ENV.ao = 0.4; ENV.bloomT = null; ENV.vig = 0;
    let S = SHOTS[0]; for (const s of SHOTS) if (t >= s.t0) S = s;
    S.fn(t - S.t0, t, S.t1 - S.t0);
    lens();
    // whip pans between shots that ask for one
    for (const s of SHOTS) if (s.whip !== undefined) { const d = Math.abs(t - s.t0); if (d < 0.1) whip(80 * (1 - d / 0.1), s.whip); }
    if (!S.nobars) letterbox(LB);
    for (const s of SHOTS) if (s.flash && t >= s.t0 && t < s.t0 + 0.067) tintAll(T_WH, 0.55);
    if (!S.nocaps) captions(t);
    const f = fl(t * FPS);
    SHX = Math.round((ih(f, 1, 901) - 0.5) * 2 * SHAKE_A); SHY = Math.round((ih(f, 2, 901) - 0.5) * 2 * SHAKE_A);
  }

  /* ================================================================ sets */
  // ---------------------------------------------------------------- materials
  // wood walls with planks and lit paper windows
  function wallMat(seed, lit) {
    return (face, u, v, x, y, t, L) => {
      if (face === 'bottom') return C('wood', 1);
      if (face === 'top') return shadeC(R.wood, 1 + L * 2, x, y);
      const plank = fl(u / 0.45), seam = frac(u / 0.45) < 0.1;
      let s = 1 + L * 2.6 + (ih(plank, seed, 31) - 0.5) * 0.8 - (seam ? 0.9 : 0);
      // windows: lit squares of paper in a grid
      const wu = frac(u / 2.4), wv = v;
      if (lit && wv > 1.1 && wv < 2.2 && wu > 0.3 && wu < 0.7 && ih(fl(u / 2.4), seed, 33) < lit) {
        const mull = Math.abs(wu - 0.5) < 0.03 || Math.abs(wv - 1.65) < 0.05;
        const fl_ = ih(fl(T_NOW * 6), fl(u / 2.4) + seed * 7, 34) * 0.4;
        return mull ? C('wood', 1) : shadeC(R.ember, 5.2 + fl_ + (wv > 1.65 ? 0.5 : 0), x, y);
      }
      if (v < 0.35) s -= 0.8;                                         // a dark skirting
      return shadeC(R.wood, s, x, y);
    };
  }
  const roofMat = (ramp, base) => (face, u, v, x, y, t, L) => {
    if (face === 'gable') return shadeC(R.wood, 1 + L * 2, x, y);
    const row = frac(v / 0.32) < 0.18, col = frac((u + fl(v / 0.32) * 0.2) / 0.4) < 0.1;
    return shadeC(ramp, base + L * 2.6 - (row ? 1 : 0) - (col ? 0.5 : 0) + (frac(v / 0.32) > 0.8 ? 0.6 : 0), x, y);
  };
  const stoneMat = (ramp, base) => (face, u, v, x, y, t, L) => {
    const bx = fl(u / 0.7 + (fl(v / 0.35) % 2) * 0.5), by = fl(v / 0.35), mortar = frac(u / 0.7 + (by % 2) * 0.5) < 0.08 || frac(v / 0.35) < 0.12;
    return shadeC(ramp, base + L * 2.4 + (ih(bx, by, 41) - 0.5) * 0.9 - (mortar ? 1.1 : 0), x, y);
  };
  const flatMat = (ramp, base, k) => (face, u, v, x, y, t, L) => shadeC(ramp, base + L * (k || 2.5), x, y);
  // a cobbled ground: tex(wx, wz, depth, x, y)
  const cobble = (ramp, base, wet) => (wx, wz, d, x, y) => {
    const cx = fl(wx / 0.55 + (fl(wz / 0.45) % 2) * 0.5), cz = fl(wz / 0.45), gap = frac(wx / 0.55 + (cz % 2) * 0.5) < 0.1 || frac(wz / 0.45) < 0.12;
    let s = base + (ih(cx, cz, 51) - 0.5) * 1.1 - (gap ? 1.2 : 0);
    if (wet && !gap && ih(cx, cz, 52) < 0.2) s += 1.2;                                        // puddle shine
    return shadeC(ramp, s, x, y);
  };

  // ---------------------------------------------------------------- EMBERWICK: a terraced village climbing to a shrine, at night, in rain
  const EW = { houses: [], lanterns: [], terr: [] };
  (function buildEmberwick() {
    for (let k = 0; k < 7; k++) EW.terr.push({ z0: k * 10, z1: k * 10 + 10, y: k * 1.8 });
    for (let k = 0; k < 7; k++) for (const side of [-1, 1]) for (let j = 0; j < 3; j++) {
      const w = 3.2 + ih(k, j * 2 + side, 61) * 2.2, d = 3 + ih(k, j, 62) * 2, h = 2.6 + ih(k, j + 9, 63) * 1.8;
      const x0 = side * (3.4 + j * 6.2 + ih(k, j, 64) * 1.5), z0 = k * 10 + 1.5 + ih(j, k, 65) * 3;
      const xa = side < 0 ? x0 - w : x0, y0 = k * 1.8;
      EW.houses.push({ x0: xa, z0, x1: xa + w, z1: z0 + d, y0, h, roofH: 1.2 + ih(k, j, 66) * 0.6, seed: k * 7 + j + (side > 0 ? 50 : 0), lit: 0.75 });
      if (ih(k, j + side * 3, 67) < 0.7) EW.lanterns.push([side < 0 ? xa + w + 0.3 : xa - 0.3, y0 + 2.4, z0 + 0.5, ih(k, j, 68)]);
    }
  })();
  const EW_SHRINE = { x: 0, y: 7 * 1.8, z: 72 };
  function skyNight(dx, dy, dz, x, y) {
    const el = dy;
    if (el < -0.05) return C('night', 1);
    const cl = fbm(Math.atan2(dx, dz) * 60 + T_NOW * 0.6, el * 120, 18, 3, 71);
    let s = 0.8 + el * 3.2 + (cl > 0.55 ? (cl - 0.55) * 4 : 0);
    if (el > 0.15 && ih(fl(Math.atan2(dx, dz) * 400), fl(el * 400), 72) > 0.997 && cl < 0.5) return C('night', 6);
    return shadeC(R.night, Math.min(3.2, s), x, y);
  }
  // draw the village from the current camera; hush(x, y) optional erasure handled by the shot
  function drawEmberwick(t, opt) {
    opt = opt || {};
    setSun(-0.3, 0.7, -0.6, 0.18); setFog('#121a33', 18, 95, 0.8);
    sky(opt.sky || skyNight);
    // terraces and the central stair
    for (const tr of EW.terr) {
      box(-40, tr.y - 6, tr.z0, 40, tr.y, tr.z1, (face, u, v, x, y, tt, L) => face === 'top' ? cobble(R.stone, 1.2 + L * 1.6, true)(u - 40, v, tt, x, y) : stoneMat(R.stone, 0.8)(face, u, v, x, y, tt, L));
      for (let s = 0; s < 6; s++) box(-1.6, tr.y + s * 0.3, tr.z1 - 1.8 + s * 0.3, 1.6, tr.y + (s + 1) * 0.3, tr.z1 + 0.01, stoneMat(R.stone, 1.4));
    }
    for (const h of EW.houses) {
      if (opt.cull && !opt.cull(h)) continue;
      box(h.x0, h.y0, h.z0, h.x1, h.y0 + h.h, h.z1, wallMat(h.seed, opt.dark ? 0 : h.lit));
      roof(h.x0, h.z0, h.x1, h.z1, h.y0 + h.h, h.roofH, roofMat(R.night, 1.0));
    }
    // the shrine: a platform, two red pillars and a beam, and the fire
    const S = EW_SHRINE;
    box(-6, S.y - 1, S.z - 4, 6, S.y, S.z + 6, stoneMat(R.stone, 1.3));
    for (const sx of [-3.2, 3.2]) box(sx - 0.25, S.y, S.z - 3.2, sx + 0.25, S.y + 4.4, S.z - 2.7, flatMat(R.crimson, 1.4, 2.6));
    box(-4.2, S.y + 4.0, S.z - 3.3, 4.2, S.y + 4.5, S.z - 2.6, flatMat(R.crimson, 1.6, 2.6));
    box(-3.8, S.y + 3.3, S.z - 3.15, 3.8, S.y + 3.55, S.z - 2.75, flatMat(R.char, 1.4, 2));
    box(-2.4, S.y, S.z + 1, 2.4, S.y + 2.6, S.z + 4, wallMat(901, 0)); roof(-2.4, S.z + 1, 2.4, S.z + 4, S.y + 2.6, 1.4, roofMat(R.crimson, 0.6));
  }
  // lights that should sit on top of everything: lanterns, the shrine fire, rain
  function emberwickLights(t, opt) {
    opt = opt || {};
    for (const [x, y, z, ph] of EW.lanterns) {
      const p = proj(x, y, z); if (!p) continue;
      const fl_ = 0.85 + 0.15 * Math.sin(t * 7 + ph * 20);
      p3(x, y, z, C('ember', 6), 0.32); p3(x, y - 0.16, z, C('ember', 4), 0.24);
      glow3(x, y, z, 1.6 * fl_, T_EMBER, 0.55 * (opt.lantern === undefined ? 1 : opt.lantern));
    }
    const S = EW_SHRINE;
    if (opt.fire !== 0) {
      for (let k = 0; k < 40; k++) { const u = frac(ih(k, 1, 81) + t * (0.5 + ih(k, 2, 81) * 0.6)); p3(S.x + (ih(k, 3, 81) - 0.5) * 1.6 * (1 - u) + Math.sin(t * 3 + k) * 0.2 * u, S.y + 0.2 + u * 3.2, S.z + (ih(k, 4, 81) - 0.5) * 1.2, u < 0.3 ? C('ember', 7) : u < 0.6 ? C('ember', 6) : C('ember', 4), 0.18 * (1 - u * 0.6)); }
      glow3(S.x, S.y + 1, S.z, 6, T_EMBER, 0.6 * (opt.fire === undefined ? 1 : opt.fire), false);
    }
  }

  // ---------------------------------------------------------------- more geometry: prisms, cones
  function prism(cx, cz, r, y0, y1, n, mat, rot) {
    rot = rot || 0;
    for (let k = 0; k < n; k++) {
      const a0 = rot + k / n * TAU, a1 = rot + (k + 1) / n * TAU;
      const p0 = [cx + Math.cos(a0) * r, y0, cz + Math.sin(a0) * r], p1 = [cx + Math.cos(a1) * r, y0, cz + Math.sin(a1) * r];
      const nx = Math.cos((a0 + a1) / 2), nz = Math.sin((a0 + a1) / 2); if (nx * (CAM.x - p0[0]) + nz * (CAM.z - p0[2]) <= 0) continue;
      const L = lightOf(nx, 0, nz);
      poly3([p0, [p0[0], y1, p0[2]], [p1[0], y1, p1[2]], p1], (u, v, x, y, t) => mat('side', v + k * r * 2 * Math.sin(PI / n), u, x, y, t, L), { two: true });
    }
  }
  function cone(cx, cz, r, y0, h, n, mat, rot) {
    rot = rot || 0;
    for (let k = 0; k < n; k++) {
      const a0 = rot + k / n * TAU, a1 = rot + (k + 1) / n * TAU, am = (a0 + a1) / 2;
      const nx = Math.cos(am) * h, ny = r, nz = Math.sin(am) * h, nl = Math.hypot(nx, ny, nz), L = lightOf(nx / nl, ny / nl, nz / nl);
      poly3([[cx + Math.cos(a0) * r, y0, cz + Math.sin(a0) * r], [cx, y0 + h, cz], [cx + Math.cos(a1) * r, y0, cz + Math.sin(a1) * r]], (u, v, x, y, t) => mat('roof', u, v, x, y, t, L), { two: true });
    }
  }
  const whiteStone = (base) => (face, u, v, x, y, t, L) => {
    const row = frac(v / 0.6) < 0.06, joint = frac(u / 1.1 + (fl(v / 0.6) % 2) * 0.5) < 0.04;
    return shadeC(R.linen, (base || 3.6) + L * 3 - (row || joint ? 0.8 : 0), x, y);
  };
  const goldRoof = (face, u, v, x, y, t, L) => shadeC(R.gold, 1.6 + L * 3.4 + (frac(u * 2.5) < 0.12 ? -0.8 : 0), x, y);
  const towerWin = (base, seed) => (face, u, v, x, y, t, L) => {
    const c = whiteStone(base)(face, u, v, x, y, t, L);
    const wu = frac(u / 1.6), wv = frac(v / 3.2), cell = fl(u / 1.6) * 31 + fl(v / 3.2);
    if (wu > 0.38 && wu < 0.62 && wv > 0.35 && wv < 0.8) return ih(cell, seed, 5) < 0.3 ? shadeC(R.gold, 5 + L, x, y) : shadeC(R.night, 2 + L * 1.5, x, y);
    return c;
  };

  // ---------------------------------------------------------------- HALCYON SPIRE: white towers above a sea of dawn cloud
  const HS = { towers: [], bridges: [] };
  (function buildSpire() {
    // the temple at the centre, and rings of towers around it
    HS.towers.push({ x: 0, z: 0, r: 9, h: 95, cap: 26, n: 10, seed: 1, temple: true });
    for (let k = 0; k < 26; k++) {
      const a = k / 26 * TAU + ih(k, 1, 91) * 0.3, d = 34 + ih(k, 2, 91) * 70 + (k % 3) * 18;
      HS.towers.push({ x: Math.cos(a) * d, z: Math.sin(a) * d, r: 3.5 + ih(k, 3, 91) * 4, h: 40 + ih(k, 4, 91) * 55, cap: 8 + ih(k, 5, 91) * 10, n: 8, seed: k + 3 });
    }
    for (let k = 1; k < HS.towers.length; k++) { const a = HS.towers[k], b = k % 4 === 0 ? HS.towers[0] : HS.towers[1 + (k % (HS.towers.length - 1))]; if (a === b) continue; HS.bridges.push([a, b, Math.min(a.h, b.h) * (0.55 + ih(k, 6, 91) * 0.3)]); }
  })();
  function skyDawn(dx, dy, dz, x, y) {
    const el = dy, az = Math.atan2(dx, dz), sunA = 2.4, sd = Math.hypot((az - sunA) * 1.3, (el - 0.04) * 2.2);
    if (sd < 0.035) return C('gold', 7);
    if (sd < 0.05) return C('gold', 6);
    const cl = fbm(az * 50 + T_NOW * 0.4, el * 160, 20, 3, 93);
    let r = el < 0.05 ? R.rose : el < 0.22 ? R.rose : R.violet, s = el < 0.05 ? 6.4 - el * 20 : el < 0.22 ? 5.6 - (el - 0.05) * 14 : 4.2 - (el - 0.22) * 6;
    s += Math.max(0, 0.6 - sd) * 2.5;
    if (cl > 0.6 && el > 0.04 && el < 0.4) { r = R.rose; s = 5.6 + (cl - 0.6) * 4; }
    return shadeC(r, s, x, y);
  }
  const cloudSea = (wx, wz, d, x, y) => {
    const n = fbm(wx * 0.7 + T_NOW * 1.5, wz * 0.7, 26, 4, 95);
    return shadeC(R.rose, 3.4 + n * 4.2 - (d > 220 ? 0 : 0), x, y);
  };
  function drawSpire(t, opt) {
    opt = opt || {};
    setSun(-0.55, 0.35, 0.75, 0.42); setFog('#f0b3a6', 60, 330, 0.85);
    sky(skyDawn);
    plane(0, cloudSea, { maxD: 600 });
    for (const T of HS.towers) {
      const dd = Math.hypot(T.x - CAM.x, T.z - CAM.z); if (dd > 420) continue;
      prism(T.x, T.z, T.r, -10, T.h, T.n, towerWin(T.temple ? 4 : 3.4, T.seed));
      prism(T.x, T.z, T.r * 1.18, T.h, T.h + 1.4, T.n, flatMat(R.gold, 3, 3));
      cone(T.x, T.z, T.r * 1.25, T.h + 1.4, T.cap, T.n, goldRoof);
      if (T.temple) { prism(T.x, T.z, T.r * 1.5, T.h * 0.55, T.h * 0.55 + 2, T.n, flatMat(R.gold, 3, 3)); cone(T.x, T.z, T.r * 1.6, T.h * 0.55 + 2, 5, T.n, goldRoof); }
    }
    for (const [a, b, y] of HS.bridges) {
      const dx = b.x - a.x, dz = b.z - a.z, L = Math.hypot(dx, dz), ux = dx / L, uz = dz / L, px = -uz * 1.3, pz = ux * 1.3;
      const s0 = [a.x + ux * a.r, a.z + uz * a.r], s1 = [b.x - ux * b.r, b.z - uz * b.r];
      poly3([[s0[0] - px, y, s0[1] - pz], [s0[0] + px, y, s0[1] + pz], [s1[0] + px, y, s1[1] + pz], [s1[0] - px, y, s1[1] - pz]], (u, v, x, yy, tt) => shadeC(R.linen, 4.4, x, yy), { two: true });
      poly3([[s0[0] - px, y - 1.2, s0[1] - pz], [s0[0] - px, y, s0[1] - pz], [s1[0] - px, y, s1[1] - pz], [s1[0] - px, y - 1.2, s1[1] - pz]], (u, v, x, yy, tt) => shadeC(R.linen, 3 + (frac(v / 3) < 0.15 ? -1 : 0), x, yy), { two: true });
    }
  }
  function spireBirds(t, n, cx, cy, cz) {
    for (let k = 0; k < n; k++) {
      const a = t * (0.3 + ih(k, 1, 97) * 0.2) + ih(k, 2, 97) * TAU, r = 20 + ih(k, 3, 97) * 30;
      const x = cx + Math.cos(a) * r, y = cy + ih(k, 4, 97) * 20 + Math.sin(t * 2 + k) * 1.5, z = cz + Math.sin(a) * r;
      const p = proj(x, y, z); if (!p) continue; const s = Math.max(1, Math.round(CAM.F / p.z * 0.6)), fw = Math.sin(t * 12 + k * 3) > 0 ? 1 : 0;
      PZ(p.x, p.y, C('night', 2), p.z); for (let i = 1; i <= s; i++) { PZ(p.x - i, p.y - fw * i * 0.6, C('night', 2), p.z); PZ(p.x + i, p.y - fw * i * 0.6, C('night', 2), p.z); }
    }
  }

  // ---------------------------------------------------------------- the upper rooftops of the spire (the chase)
  const RT = { roofs: [] };
  (function buildRoofs() {
    // three lanes of roofs along +z: the courier's in the middle, wardens either side
    for (let lane = -1; lane <= 1; lane++) {
      let z = -20;
      for (let k = 0; k < 22; k++) {
        const len = 7 + ih(k, lane + 5, 101) * 7, gap = lane === 0 ? 2.2 + ih(k, 2, 101) * 1.6 : 1 + ih(k, 3, 101) * 2, y = 30 + Math.sin(k * 0.9 + lane) * 1.6 + ih(k, lane, 102) * 1.2;
        RT.roofs.push({ x0: lane * 9 - 3.2, x1: lane * 9 + 3.2, z0: z, z1: z + len, y, seed: k * 3 + lane, lane });
        z += len + gap;
      }
    }
  })();
  function roofY(lane, z) { for (const r of RT.roofs) if (r.lane === lane && z >= r.z0 - 0.3 && z <= r.z1 + 0.3) return r.y; return null; }
  // the houses of the spire: coloured plaster with brick showing through, shuttered windows, a gold cornice
  const RT_RAMP = [R.linen, R.rose, R.linen, R.gold, R.stone, R.rose];
  const houseSide = (r) => (face, u, v, x, y, tt, L) => {
    const sd = ((r.seed % 6) + 6) % 6, ramp = RT_RAMP[sd], top = 14 - v;
    if (top < 0.32) return shadeC(R.gold, 3.2 + L * 2.4 - (top < 0.07 ? 1.2 : 0), x, y);
    if (top < 0.5) return shadeC(ramp, 1.2 + L * 1.6, x, y);
    const wu = frac(u / 1.8), wv = frac((top - 0.9) / 2.6), cell = fl(u / 1.8) * 31 + fl((top - 0.9) / 2.6);
    if (top > 0.9 && wu > 0.28 && wu < 0.72 && wv > 0.12 && wv < 0.74) {
      if (wu < 0.36 || wu > 0.64) return shadeC(ih(cell, sd, 7) < 0.5 ? R.teal : R.crimson, 2.4 + L * 2.2 - (frac(wv * 6) < 0.15 ? 0.8 : 0), x, y);
      return ih(cell, r.seed, 5) < 0.22 ? shadeC(R.gold, 5 + L, x, y) : shadeC(R.night, 1.8 + L * 1.4 + (wv < 0.25 ? 0.9 : 0), x, y);
    }
    if (top > 0.9 && wu > 0.24 && wu < 0.76 && wv >= 0.74 && wv < 0.8) return shadeC(R.stone, 3.6 + L * 2, x, y);
    const row = frac(v / 0.45) < 0.09, jt = frac(u / 0.9 + (fl(v / 0.45) % 2) * 0.5) < 0.06, patch = vn(u * 0.5, v * 0.5, 2, r.seed + 40) > 0.68;
    if (patch) return shadeC(R.ember, 2.4 + L * 2.2 - (row || jt ? 1 : 0), x, y);
    return shadeC(ramp, 3.4 + L * 2.6 + vn(u, v, 3, r.seed) * 0.7 - (vn(u * 2, v * 0.3, 2, r.seed + 9) > 0.8 ? 0.7 : 0), x, y);
  };
  // ---------------------------------------------------------------- the harbour ring at the foot of the spire
  const HB = { boats: [], crates: [], posts: [], lamps: [-19.5, -7.8, 4.2, 16.0], bollards: [-14.2, -5.6, 9.8, 21.5], perch: [2, 5, 9, 12] };
  (function buildHarbour() {
    for (let k = 0; k < 9; k++) HB.boats.push({ x: -40 + k * 11 + ih(k, 1, 111) * 4, z: 18 + ih(k, 2, 111) * 30, len: 6 + ih(k, 3, 111) * 4, rot: ih(k, 4, 111) * 0.6 - 0.3, mast: ih(k, 5, 111) < 0.7, seed: k, sail: [R.linen, R.rose, R.linen, R.gold, R.crimson][k % 5] });
    for (let k = 0; k < 14; k++) HB.crates.push({ x: (k & 1 ? -1 : 1) * (13 + ih(k, 1, 112) * 14), z: -2 + ih(k, 2, 112) * 5, s: 0.8 + ih(k, 3, 112) * 0.5, barrel: ih(k, 4, 112) < 0.4 });
    HB.crates.push({ x: -10.4, z: 2.6, s: 0.9, barrel: true }, { x: -9.6, z: 3.1, s: 0.8, barrel: false });
    for (let k = 0; k < 16; k++) HB.posts.push([-20 + k * 2.6, 4.4]);
  })();
  // the harbour keeps its own clock, so the Hush can stop the water, the boats and the birds; HWY is the sea's level
  let HT = 0, HWY = -0.4;
  const waterTex = (lights) => (wx, wz, d, x, y) => {
    const T = HT, w = Math.sin(wx * 1.3 + T * 1.6 + Math.sin(wz * 0.7) * 2) + Math.sin(wz * 2.1 - T * 2.2 + wx * 0.4) * 0.7, n = vn(wx * 3, wz * 6 + T * 2, 1, 113);
    let s = 2.6 + w * 0.5 + n * 0.8;
    if (lights) for (const L of lights) { const dx = Math.abs(x - L[0]); if (dx < L[2] && y > L[1] && ih(fl(x / 2), y, fl(T * 8)) < 0.5 * (1 - dx / L[2])) s += 2.5; }
    if (n > 0.86) s += 2;
    // sun glints that wink on and off
    if (d < 70 && n > 0.55 && ih(fl(wx * 4), fl(wz * 7), fl(T * 4 + wx * 0.3)) < 0.03) return d < 26 ? WHITE : C('sea', 7);
    // foam lapping at the piles and along the dock's edge
    if (Math.abs(wx) < 30) {
      const az = Math.abs(wz), lap = 4.06 + 0.1 + Math.sin(wx * 2.3 + T * 2.4) * 0.06;
      if (az > 4.0 && az < lap) return bay(x, y) < 0.6 ? C('sea', 7) : C('hush', 4);
      if (wx > -20.6 && wx < 19.6) { let dx = ((wx + 20) % 2.6 + 2.6) % 2.6; dx = Math.min(dx, 2.6 - dx); const r = Math.hypot(dx, az - 4.4); if (r > 0.2 && r < 0.3 + Math.sin(T * 3 + wx) * 0.04 && bay(x, y) < 0.7) return C('sea', 7); }
    }
    return shadeC(R.sea, s, x, y);
  };
  const plankMat = (base) => (face, u, v, x, y, t, L) => { const p = fl(u / 0.35), seam = frac(u / 0.35) < 0.12; return shadeC(R.wood, (base || 2.4) + L * 2.6 + (ih(p, 3, 114) - 0.5) - (seam ? 1.1 : 0), x, y); };
  // the dock's deck: boards along its length with staggered butt joints, nail heads, and weather in the grain
  const deckMat = (face, u, v, x, y, t, L) => {
    if (face !== 'top') return plankMat(1.6)(face, u, v, x, y, t, L);
    const p = fl(v / 0.32), pv = frac(v / 0.32), off = ih(p, 5, 114) * 3.1, ju = (u + off) / 3.1, jf = frac(ju), id = p * 97 + fl(ju);
    let s = 2.9 + L * 2.2 + (ih(id, 3, 114) - 0.5) * 1.0 + (vn(u * 1.5, v * 10, 1, 116) - 0.5) * 0.7;
    if (pv < 0.1) s -= 1.5;
    else if (jf < 0.02) s -= 1.2;
    else if (t < 22 && (jf < 0.045 || jf > 0.985) && Math.abs(pv - 0.55) < 0.09) return C('stone', 2);
    if (v < 0.25 || v > 7.75) s -= 0.6;                                          // the boards darken where the spray reaches
    return shadeC(R.wood, s, x, y);
  };
  // little props
  function crate3(x, y, z, s) { box(x - s / 2, y, z - s / 2, x + s / 2, y + s, z + s / 2, (f, u, v, xx, yy, tt, L) => shadeC(R.wood, 2.8 + L * 2.4 - (frac(u / 0.22) < 0.12 ? 1 : 0) - (u < 0.06 || v < 0.06 || u > s - 0.06 || v > s - 0.06 ? 1.2 : 0) + (Math.abs(u - v) < 0.05 || Math.abs(u + v - s) < 0.05 ? -0.9 : 0), xx, yy)); }
  function barrel3(x, z, s, y) { y = y === undefined ? DY_H : y; prism(x, z, s * 0.42, y, y + s * 1.05, 8, (f, u, v, xx, yy, tt, L) => shadeC(R.wood, 2.5 + L * 2.4 - (Math.abs(v - s * 0.18) < 0.05 || Math.abs(v - s * 0.85) < 0.05 ? 1.6 : 0) - (frac(u / 0.16) < 0.12 ? 0.6 : 0), xx, yy)); cone(x, z, s * 0.42, y + s * 1.05, 0.001, 8, flatMat(R.wood, 2.2)); }
  const DY_H = 0.35;
  // a rope hung between two points, sagging
  function rope3(a, b, sag, c) { let px = a[0], py = a[1], pz = a[2]; for (let k = 1; k <= 6; k++) { const u = k / 6, x = lerp(a[0], b[0], u), y = lerp(a[1], b[1], u) - Math.sin(u * PI) * sag, z = lerp(a[2], b[2], u); l3(px, py, pz, x, y, z, c); px = x; py = y; pz = z; } }
  function drawHarbour(t, opt) {
    opt = opt || {};
    HT = opt.freeze !== undefined ? Math.min(t, opt.freeze) : t; HWY = opt.waterY === undefined ? -0.4 : opt.waterY;
    const T = HT;
    setSun(-0.7, 0.4, 0.6, 0.45); setFog(opt.fogHex || '#f0c9a0', 30, 190, 0.8);
    sky(opt.sky || skyDawn);
    // the city wall rising behind the harbour, and the spire far above
    for (let k = 0; k < 12; k++) box(-90 + k * 15, -2, 70 + ih(k, 1, 115) * 10, -78 + k * 15, 22 + ih(k, 2, 115) * 26, 84, towerWin(2.8, k + 40));
    prism(0, 160, 9, -2, 160, 10, towerWin(4, 1)); cone(0, 160, 11, 160, 26, 10, goldRoof);
    // the lighthouse on the breakwater
    prism(70, 60, 2.6, -1, 22, 8, (f, u, v, x, y, tt, L) => shadeC(fl(v / 3) % 2 ? R.crimson : R.linen, 3 + L * 2.5, x, y)); cone(70, 60, 3, 22, 3, 8, flatMat(R.crimson, 2));
    if (!opt.keeperGone) glow3(70, 23.5, 60, 2.2, T_GOLD, 0.5);
    plane(HWY, waterTex(opt.lights), { maxD: 400 });
    // the dock: a long pier of planks on posts, a stringer along each side
    box(-30, -0.4, -4, 30, DY_H, 4, deckMat);
    box(-30, -0.25, -4.12, 30, 0.2, -4.0, plankMat(1.2)); box(-30, -0.25, 4.0, 30, 0.2, 4.12, plankMat(1.2));
    for (const [x, z] of HB.posts) { box(x - 0.18, -3, z - 0.18, x + 0.18, 1.1, z + 0.18, plankMat(1.6)); box(x - 0.18, -3, -z - 0.18, x + 0.18, 0.15, -z + 0.18, plankMat(1.6)); }   // the near piles stop under the deck, out of the cameras' way
    // rope rails between the far posts, and a slack line along the near ones
    for (let k = 0; k + 1 < HB.posts.length; k++) { const a = HB.posts[k], b = HB.posts[k + 1]; if (Math.abs(a[0] - CAM.x) > 40) continue; rope3([a[0], 0.98, a[1]], [b[0], 0.98, b[1]], 0.32, C('linen', 3)); }
    // gulls asleep on the post tops
    if (!opt.noGulls) for (const k of HB.perch) { const [x, z] = HB.posts[k], p = proj(x, 1.1, z); if (!p) continue; const s = Math.max(1, Math.round(CAM.F / p.z * 0.09)), hop = (opt.freeze === undefined && ih(k, fl(T * 1.5), 117) < 0.08) ? -s : 0; for (let j = 0; j < s * 2; j++) for (let i = -s * 2; i <= s * 2; i++) if ((i / (2 * s)) ** 2 + ((j - s) / s) ** 2 <= 1) PZ(p.x + i, p.y - j - 1 + hop, j > s * 1.2 ? WHITE : i < -s ? C('stone', 4) : C('hush', 3), p.z - 0.2); for (let i = 0; i <= s; i++) PZ(p.x + s * 2 + i, p.y - s * 1.6 + hop, C('gold', 5), p.z - 0.21); }
    // lamp posts and drying nets along the far edge, iron bollards with coiled lines
    for (const x of HB.lamps) {
      if (Math.abs(x - CAM.x) > 45) continue;
      box(x - 0.06, DY_H, 3.62, x + 0.06, DY_H + 2.5, 3.74, flatMat(R.char, 1.4, 2));
      box(x - 0.06, DY_H + 2.38, 3.62, x + 0.5, DY_H + 2.46, 3.74, flatMat(R.char, 1.4, 2));
      box(x + 0.32, DY_H + 1.98, 3.58, x + 0.58, DY_H + 2.3, 3.78, (f, u, v, xx, yy) => f === 'top' ? C('char', 2) : shadeC(R.ember, 5 + (u > 0.05 && u < 0.27 ? 1.2 : -2), xx, yy));
      glow3(x + 0.45, DY_H + 2.14, 3.68, 0.7, T_GOLD, 0.3);
    }
    for (const x of HB.bollards) {
      if (Math.abs(x - CAM.x) > 45) continue;
      prism(x, 3.45, 0.16, DY_H, DY_H + 0.42, 6, flatMat(R.char, 1.2, 2.4)); prism(x, 3.45, 0.22, DY_H + 0.42, DY_H + 0.5, 6, flatMat(R.char, 1.8, 2.4));
      const p = proj(x + 0.55, DY_H + 0.03, 3.2); if (p) { const r = CAM.F / p.z * 0.22; for (let q = 0; q < 3; q++) ring(p.x, p.y, r - q * 1.2, (r - q * 1.2) * 0.35, C('linen', 3 + (q & 1)), (xx, yy) => ZB[fl(yy) * W + fl(xx)] > p.z - 0.3); }
    }
    { const x0 = -12.8, x1 = -10.6; if (Math.abs(x0 - CAM.x) < 40) {
      box(x0 - 0.05, DY_H, 3.66, x0 + 0.05, DY_H + 1.9, 3.76, flatMat(R.wood, 1.4)); box(x1 - 0.05, DY_H, 3.66, x1 + 0.05, DY_H + 1.9, 3.76, flatMat(R.wood, 1.4));
      poly3([[x0, DY_H + 1.85, 3.7], [x1, DY_H + 1.85, 3.7], [x1, DY_H + 0.5, 3.72], [x0, DY_H + 0.3, 3.72]], (u, v, xx, yy) => { const sag = Math.sin(u / (x1 - x0) * PI) * 0.25; if (v > 1.55 - sag + 0.3) return -1; return frac(u / 0.11 + v * 2.2) < 0.22 || frac(u / 0.11 - v * 2.2) < 0.22 ? C('linen', 3) : -1; }, { two: true });
    } }
    for (const c of HB.crates) {
      if (opt.skipCrate && opt.skipCrate(c)) continue;
      if (Math.abs(c.x - CAM.x) > 60) continue;
      if (c.barrel) barrel3(c.x, c.z, c.s); else crate3(c.x, DY_H, c.z, c.s);
    }
    for (const b of HB.boats) {
      const bob = Math.sin(T * 1.3 + b.seed) * 0.12 + HWY + 0.4, roll = Math.sin(T * 1.1 + b.seed * 2) * 0.03, ca = Math.cos(b.rot), sa = Math.sin(b.rot), hl = b.len / 2;
      const pt = (u, w, h) => [b.x + ca * u - sa * w, h + bob + w * roll, b.z + sa * u + ca * w];
      const hull = (f, u, v, x, y, tt, L) => shadeC(b.seed % 3 ? R.wood : R.crimson, 2 + L * 2.6 - (frac(v / 0.3) < 0.15 ? 0.8 : 0), x, y);
      poly3([pt(-hl, -1.2, 0.8), pt(hl, -1.2, 0.8), pt(hl - 1, -0.6, -0.5), pt(-hl + 0.6, -0.6, -0.5)], hull, { two: true });
      poly3([pt(hl, 1.2, 0.8), pt(-hl, 1.2, 0.8), pt(-hl + 0.6, 0.6, -0.5), pt(hl - 1, 0.6, -0.5)], hull, { two: true });
      poly3([pt(hl, -1.2, 0.8), pt(hl + 1.4, 0, 1.0), pt(hl, 1.2, 0.8)], hull, { two: true });
      poly3([pt(-hl, -1.2, 0.8), pt(hl, -1.2, 0.8), pt(hl, 1.2, 0.8), pt(-hl, 1.2, 0.8)], (f, u, v, x, y) => shadeC(R.wood, 3.6 - (frac(u / 0.4) < 0.12 ? 1 : 0), x, y));
      if (b.mast) {
        const m = pt(0, 0, 0.8), top = [m[0], m[1] + 6, m[2]], luff = Math.sin(T * 2 + b.seed) * 0.15;
        l3(m[0], m[1], m[2], top[0], top[1], top[2], C('wood', 2), 2);
        poly3([[top[0], top[1] - 0.4, top[2]], [top[0] + ca * 3, top[1] - 1, top[2] + sa * 3], [m[0] + ca * 3.2, m[1] + 1.2, m[2] + sa * 3.2 + luff], [m[0], m[1] + 1.2, m[2]]], (f, u, v, x, y) => shadeC(b.sail, 4.6 + Math.sin(u * 2 + T) * 0.4 + (Math.abs(v - 1.4) < 0.25 && b.sail === R.linen ? -2 : 0), x, y), { two: true });
        poly3([[top[0], top[1] - 0.6, top[2]], [m[0] - ca * 2.6, m[1] + 1.0, m[2] - sa * 2.6], [m[0] - ca * 0.2, m[1] + 1.0, m[2] - sa * 0.2]], (f, u, v, x, y) => shadeC(R.linen, 5.4, x, y), { two: true });
        const bw = pt(hl + 1.4, 0, 1.0); l3(top[0], top[1], top[2], bw[0], bw[1], bw[2], C('wood', 2));
        const st = pt(-hl, 0, 0.8); l3(top[0], top[1], top[2], st[0], st[1], st[2], C('wood', 2));
        for (let q = 0; q < 4; q++) { const fx = top[0] - ca * q * 0.25, fy = top[1] + 0.05 + Math.sin(T * 9 + q + b.seed) * 0.05 * q, fz = top[2] - sa * q * 0.25; p3(fx, fy, fz, b.seed & 1 ? C('crimson', 5) : C('teal', 5), 0.12); }
      }
    }
  }
  // gulls wheeling over the water: an M of wings that beats; frozen (a time) holds them in the air
  function gulls(t, n, cx, cy, cz, frozen) {
    for (let k = 0; k < n; k++) {
      const tt = frozen === undefined ? t : Math.min(t, frozen), a = tt * (0.35 + ih(k, 1, 121) * 0.25) + ih(k, 2, 121) * TAU, r = 8 + ih(k, 3, 121) * 14;
      const x = cx + Math.cos(a) * r, y = cy + ih(k, 4, 121) * 7 + Math.sin(tt * 2 + k) * 0.6, z = cz + Math.sin(a) * r;
      const p = proj(x, y, z); if (!p) continue; const s = Math.max(1.5, CAM.F / p.z * 0.32), fw = Math.sin(tt * (7 + ih(k, 5, 121) * 3) + k * 3), dir = Math.sin(a) > 0 ? -1 : 1;
      const ey = -fw * s * 0.35, ty = fw * s * 0.45;
      for (const sd of [-1, 1]) { lineF(p.x, p.y, p.x + sd * s * 0.5, p.y + ey, (xx, yy) => PZ(xx, yy, WHITE, p.z)); lineF(p.x + sd * s * 0.5, p.y + ey, p.x + sd * s, p.y + ty, (xx, yy, u) => PZ(xx, yy, u > 0.6 ? C('stone', 3) : C('hush', 4), p.z)); }
      PZ(p.x, p.y + 1, C('hush', 2), p.z); if (s > 3) { PZ(p.x + dir, p.y, WHITE, p.z); PZ(p.x + dir * 2, p.y, C('gold', 5), p.z); }
    }
  }
  /* ================================================================ dialogue: timings and mouth envelopes (generated) */
  const DLG = [{"id": "L01", "who": "sable_vo", "text": "Everything has a name.", "t0": 3.0, "dur": 1.395, "env": "146644552246665566544577766554333321000000"}, {"id": "L02", "who": "sable_vo", "text": "A name is a promise... that something was here.", "t0": 9.6, "dur": 2.835, "env": "14677777777777654441012566655444442100000000001112456776324566554332145554443100000000"}, {"id": "L03", "who": "mira", "text": "Sable! I wrote it! I wrote my name on the wall, just like you showed me!", "t0": 18.3, "dur": 4.09, "env": "000257654335544332000000000025766777666653100000000002566664456777665666666654566655421244224541145544456664345543321000000"}, {"id": "L04", "who": "sable", "text": "[chuckle] Then the wall will remember you. Even when I'm old and forgetful.", "t0": 24.6, "dur": 4.135, "env": "00123200000000000000002566666445787655555555666666554443332100000000000014554567766666667777664345421133466531001333210000000"}, {"id": "L05", "who": "king", "text": "Hush now.", "t0": 38.4, "dur": 1.1, "env": "014544433456666665433221110000000"}, {"id": "L06", "who": "mira", "text": "Sable...?", "t0": 52.4, "dur": 0.755, "env": "00025666544543100000000"}, {"id": "L07", "who": "sable", "text": "Mira, take my hand! Don't let go. Don't let go!", "t0": 55.4, "dur": 3.815, "env": "1356655443200000000123564235776655444445654210000000014677765556764213677766420000001477765557763246777776531000000"}, {"id": "L08", "who": "sable", "text": "No! Mira!", "t0": 60.5, "dur": 1.515, "env": "1355677776543100000000013456667777754100000000"}, {"id": "L09", "who": "sable_vo", "text": "I don't remember her face anymore.", "t0": 66.2, "dur": 1.68, "env": "144467765677776533453101467655444554555544431000000"}, {"id": "L10", "who": "sable_vo", "text": "I remember that I swore.", "t0": 77.4, "dur": 1.585, "env": "146655677766665444444455544553124665431100000000"}, {"id": "L11", "who": "warden", "text": "The Storm Seed... it's gone!", "t0": 104.9, "dur": 1.9, "env": "135554346677776555554332221111100133332367776654443333210"}, {"id": "L12", "who": "oren", "text": "The courier. Kaira was the last one in the vault. Find her!", "t0": 107.0, "dur": 5.7, "env": "133233456654433322111110000000000001356777767776654444456653345556677665554333456666666544344676543222221100000000000257776666544443332222100000000000000000000000000000000"}, {"id": "L13", "who": "kaira", "text": "[gasp] Okay. Okay. Framed, chased, and glowing. Great start to the week.", "t0": 123.0, "dur": 4.905, "env": "0145542100000000001465222455442100000000000000000025642235665421015777777765421135667654322236754567666655544431136774233467521344565555310000000000"}, {"id": "L14", "who": "oren", "text": "Courier! Return the Seed!", "t0": 128.6, "dur": 2.665, "env": "13345777776554310000000000000000135652124435666666666677766555555555554210000000"}, {"id": "L15", "who": "kaira", "text": "I don't HAVE it!", "t0": 131.6, "dur": 1.075, "env": "146666665334566422443100000000000"}, {"id": "L16", "who": "kaira", "text": "[sigh] Okay. I might have it.", "t0": 134.3, "dur": 2.275, "env": "002577764200000001442125665542000000000146777752124554334310000000000"}, {"id": "L17", "who": "oren", "text": "Five days, courier. That's how long the elders give you before it tears you apart. Come quietly.", "t0": 153.5, "dur": 5.7, "env": "014666542113421012212355431000000000000000000002576456777667776665531247776556555423576433333113332356531244566655544445410246664100000000000000013567643346754210000000000"}, {"id": "L18", "who": "kaira", "text": "Quiet's not really my thing.", "t0": 162.3, "dur": 1.68, "env": "014777752122357776422466666665543101344333321000000"}, {"id": "L19", "who": "tamo", "text": "Hey! That was the GOOD crate!", "t0": 182.6, "dur": 1.965, "env": "01466766654210000000146666653455335775312345654421000000000"}, {"id": "L20", "who": "kaira", "text": "Sorry! Not sorry! You should run.", "t0": 185.0, "dur": 2.15, "env": "01367777665332100146764334665543221001455566555776544331000000000"}, {"id": "L21", "who": "tamo", "text": "Run from wh-", "t0": 187.6, "dur": 0.875, "env": "024677653356655531000000000"}, {"id": "L22", "who": "tamo", "text": "Three grown-ups... against one girl?", "t0": 191.6, "dur": 2.555, "env": "00257754457766554310023221000000012444676543113456666554446666665310000000000"}, {"id": "L23", "who": "docker", "text": "Kid, that anchor hasn't moved in a hundred years", "t0": 197.6, "dur": 3.04, "env": "01256664200000000025776567766434554456643445666555542246655456654454323555643110000000000000"}, {"id": "L24", "who": "tamo", "text": "That's not very fair... for you.", "t0": 205.6, "dur": 2.235, "env": "14653345566533455542001466665532000000000014566677777766421000000000"}, {"id": "L25", "who": "kaira", "text": "Okay. Who ARE you?", "t0": 221.0, "dur": 1.495, "env": "257532455421000000002575457776644543210000000"}, {"id": "L26", "who": "tamo", "text": "Tamo! I work here. Well. I did, until you landed on me.", "t0": 222.9, "dur": 3.855, "env": "14677655432000000000257776678753113443100000000000235555553100000146665457777555542355555555555554334443333321000000"}, {"id": "L27", "who": "kaira", "text": "What is that?", "t0": 230.6, "dur": 0.985, "env": "135666431257765421000000000000"}, {"id": "L28", "who": "tamo", "text": "Hollow. They took the lighthouse keeper last week. Nobody even remembers his name.", "t0": 235.6, "dur": 4.525, "env": "0147776665543100000001454257632467677777777642124422566667776543113454310000000001356655665655444555555555555665444444444444443221000000"}, {"id": "L29", "who": "oren", "text": "No... not here. Not the harbor.", "t0": 242.2, "dur": 2.87, "env": "135677775320000000000245677765322356654321000000000012456763124543356775322321000000000"}, {"id": "L30", "who": "bellwether", "text": "The courier. And the anchor-bearer. Two of four.", "t0": 262.6, "dur": 3.15, "env": "12321223444433221000000000001356678777777654433332222100000000000123344443223687665544210000000"}, {"id": "L31", "who": "bellwether", "text": "[chuckle] The King will be so pleased.", "t0": 267.0, "dur": 2.235, "env": "00015765544310000023223576656665555544456765544466655443321100000000"}, {"id": "L32", "who": "tamo", "text": "Kaira! Whatever you've got, now would be a really good time!", "t0": 279.0, "dur": 4.6, "env": "013677777766677777777777777766553210000246666666555655566422477765310110001345677777666544553235566543345677655532355322355554432100000000"}, {"id": "L33", "who": "kaira", "text": "I don't know how to use it!", "t0": 283.8, "dur": 1.555, "env": "14666777777765445665544567776422453100000000000"}, {"id": "L34", "who": "vesper", "text": "Step away from them.", "t0": 296.0, "dur": 1.24, "env": "01333576435567777632345445544321000000"}];

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

  /* ================================================================ ACT ONE (a) — Halcyon Spire: the vault, the window, the chase, the edge, the fall */
  function card(t0, t, title, sub, x, y) {
    const a = lin(t0, t0 + 0.4, t); if (a <= 0) return;
    const nv = fl((t - t0) * 30);
    text(title, x, y, C('linen', 7), 2, C('night', 0), nv);
    if (sub) text(sub, x, y + 20, C('gold', 6), 1, C('night', 0), Math.max(0, nv - title.length));
  }

  // 15 — HALCYON SPIRE: rising out of the clouds and gliding between the towers toward the temple (1:33)
  shot(93.0, 104.0, (lt, t) => {
    const u = eio(lt / 11);
    lookAt(lerp(-150, -46, u), lerp(8, 92, u), lerp(-260, -96, u), lerp(-30, 0, u), lerp(30, 84, u), lerp(-60, 0, u), 56);
    drawSpire(t); ink(2, 160);
    spireBirds(t, 26, lerp(-120, -30, u), lerp(20, 80, u), lerp(-200, -80, u));
    // the bells: a ripple of light from the temple belfry when they toll
    for (const bt of [96.5, 99.5, 102.5]) { const g = t - bt; if (g > 0 && g < 2) { const p = proj(0, 62, 0); if (p) shockRing(p.x, p.y, 8 + g * 160 * CAM.F / p.z / 3, (8 + g * 160 * CAM.F / p.z / 3) * 0.4, 2, [C('gold', 7), C('gold', 5), C('rose', 5)], 1 - g / 2); } }
    card(95.2, t, 'HALCYON SPIRE', 'THE CITY ABOVE THE CLOUDS · NOW', 22, 36);
  });

  // ---------------------------------------------------------------- the temple vault: pillars, an empty pedestal, a stained-glass window
  const VLT = { pillars: [[-6, 6], [6, 6], [-6, 14], [6, 14], [-6, 22], [6, 22]] };
  const stained = (u, v, x, y, broken) => {
    // u across (0..6), v up (0..12): an arched window of coloured panes and lead
    const cx = u - 3, top = 8 + Math.sqrt(Math.max(0, 9 - cx * cx)) * 1.3; if (v > top) return -1;
    if (broken) return Math.abs(cx) > 2.7 || v < 0.4 || v > top - 0.4 ? C('stone', 5) : -2;
    const lead = Math.abs(frac(u / 1.5) - 0.5) > 0.44 || Math.abs(frac(v / 1.8) - 0.5) > 0.43 || Math.abs(Math.hypot(cx, v - 6) - 2.4) < 0.12 || Math.abs(Math.hypot(cx, v - 6) - 4.2) < 0.12;
    if (lead) return C('night', 1);
    const cell = fl(u / 1.5) * 7 + fl(v / 1.8) + (Math.hypot(cx, v - 6) < 2.4 ? 50 : 0), r = [R.indigo, R.gold, R.crimson, R.teal, R.violet][fl(ih(cell, 1, 301) * 5)];
    return shadeC(Math.hypot(cx, v - 6) < 2.4 ? R.gold : r, 4.6 + ih(cell, 2, 301) * 1.6 + (v / top) * 0.6, x, y);
  };
  function drawVault(t, opt) {
    opt = opt || {};
    setSun(0.2, 0.5, -0.8, 0.3); setFog('#1b2160', 14, 60, 0.6);
    sky(() => C('night', 1));
    // the floor: white and gold tiles in a sunburst
    plane(0, (wx, wz, d, x, y) => { const a = Math.atan2(wx, wz - 14), r = Math.hypot(wx, wz - 14), ray_ = fl(a / TAU * 24 + 24) % 2, ring_ = fl(r / 1.6); return shadeC(ray_ ^ (ring_ & 1) ? R.linen : R.gold, 2.4 + (ray_ ? 0.6 : 0) + (frac(r / 1.6) < 0.06 ? -1 : 0) + Math.max(0, 2 - Math.abs(wx) * 0.4) * (wz > 18 ? 0.6 : 0), x, y); });
    const wallM = (u, v, x, y) => shadeC(R.indigo, 1.4 + (frac(v / 2.2) < 0.06 || frac(u / 3) < 0.04 ? -0.9 : 0) + vn(u, v, 1.5, 302) * 0.6, x, y);
    poly3([[-10, 0, 0], [-10, 14, 0], [-10, 14, 26], [-10, 0, 26]], (u, v, x, y) => wallM(v, u, x, y), { two: true });
    poly3([[10, 0, 26], [10, 14, 26], [10, 14, 0], [10, 0, 0]], (u, v, x, y) => wallM(v, u, x, y), { two: true });
    poly3([[-10, 0, 26], [-10, 14, 26], [10, 14, 26], [10, 0, 26]], (u, v, x, y) => { const g = stained(v - 7, u - 1.5, x, y, opt.broken); if (g === -2) return C('rose', 6); if (g >= 0 && v > 7 && v < 13) return g; return wallM(v, u, x, y); }, { two: true });
    poly3([[-10, 14, 0], [10, 14, 0], [10, 14, 26], [-10, 14, 26]], (u, v, x, y) => shadeC(R.indigo, 0.8 + (frac(u / 2) < 0.08 ? -0.8 : 0), x, y), { two: true });
    for (const [px, pz] of VLT.pillars) { prism(px, pz, 0.9, 0, 14, 8, (f, u, v, x, y, tt, L) => shadeC(R.linen, 2 + L * 3 + (frac(u / 0.6) < 0.15 ? -0.8 : 0), x, y)); prism(px, pz, 1.2, 0, 0.8, 8, flatMat(R.gold, 2.4, 3)); prism(px, pz, 1.2, 13.2, 14, 8, flatMat(R.gold, 2.4, 3)); }
    // the pedestal and its smashed glass case
    prism(0, 14, 1.4, 0, 1.4, 8, flatMat(R.gold, 2.2, 3)); prism(0, 14, 1.0, 1.4, 2.6, 8, (f, u, v, x, y) => (ih(fl(u * 6), fl(v * 6), 303) < 0.6 ? -1 : C('teal', 6)));
    for (let k = 0; k < 24; k++) p3((ih(k, 1, 304) - 0.5) * 3.2, 0.05, 14 + (ih(k, 2, 304) - 0.5) * 3.2, ih(k, 3, 304) < 0.5 ? C('teal', 7) : WHITE, 0.08);
  }
  // shafts of coloured light from the window into the dusty air
  function vaultShafts(t, a) {
    const top = proj(0, 11, 26); if (!top) return;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x; const d = ray(x + 0.5, y + 0.5); const p = worldAt(i, x, y);
      if (p[2] > 25.5) continue;
      const along = (26 - p[2]) / 26, off = Math.abs(p[0]) - 2.6 - along * 2, hy = 11 - along * 9 - p[1];
      if (off < 0 && Math.abs(hy) < 2 + along * 2) tintI(i, x, y, T_GOLD, a * 0.35 * (1 - along) * (1 - Math.abs(hy) / (2 + along * 2)));
    }
    for (let k = 0; k < 40; k++) { const u = frac(ih(k, 1, 305) + t * 0.03), x = (ih(k, 2, 305) - 0.5) * 5, y = 2 + ih(k, 3, 305) * 9, z = 4 + u * 20; p3(x, y + Math.sin(t + k) * 0.2, z, C('gold', 7), 0.03); }
  }

  // 16 — the vault: the alarm, an empty pedestal, the wardens (1:44)
  shot(104.0, 112.0, (lt, t) => {
    if (lt < 3.0) {
      lookAt(-2.4 + lt * 0.4, 2.6, -1.5 + lt * 0.6, 0, 1.8, 14, 60);
      drawVault(t); ink(2);
      // wardens running in from behind the camera
      for (let k = 0; k < 3; k++) { const z = lerp(4, 11 + k * 0.8, eoc(lin(0.2 + k * 0.25, 1.8 + k * 0.2, lt))); actor3('warden', { view: 'back', run: z < 10 ? t * 16 + k : undefined, spear: -1.4, captain: false }, -1.6 + k * 1.6, 0, z, { dark: 1, rim: { side: 1, T: T_GOLD, a: 0.35 } }); }
      vaultShafts(t, 1);
      actor3('warden', { view: 'side', spear: -1.3, eyes: 'open', mouth: mouth('warden', t) }, 1.4, 0, 12.6, { flip: true, dark: 1 });
    } else {
      // OREN, close, turning from the empty case
      const u = lt - 3.0;
      lookAt(5.4, 2.0, 7.4, 2.8, 1.5, 11.4, 44);
      drawVault(t); ink(2); vaultShafts(t, 1);
      actor3('warden', { view: u < 0.6 ? 'side' : 'front', captain: true, spear: -1.5, eyes: 'narrow', brows: 'angry', mouth: mouth('oren', t) }, 2.8, 0, 11.4, { flip: true, dark: 1, rim: { side: -1, T: T_GOLD, a: 0.6 } });
    }
    // the alarm: a pulse of red through the hall
    tintAll(T_RED, (0.5 + 0.5 * Math.sin(t * 9)) * 0.12);
  });

  // ---------------------------------------------------------------- the temple facade with its great window
  const GLASS0 = 113.0;
  // slow motion: shot time → story time
  const slowmo = (lt) => (lt < 1.0 ? lt : lt < 4.0 ? 1.0 + (lt - 1.0) * 0.12 : 1.36 + (lt - 4.0) * 1.0);
  function drawFacade(t, broken) {
    setSun(-0.55, 0.45, 0.7, 0.45); setFog('#f0b3a6', 40, 260, 0.85);
    sky(skyDawn);
    plane(0, cloudSea, { maxD: 600 });
    for (const T of HS.towers.slice(1, 14)) { prism(T.x + 40, T.z + 90, T.r, -10, T.h, T.n, towerWin(3.4, T.seed)); cone(T.x + 40, T.z + 90, T.r * 1.25, T.h, T.cap, T.n, goldRoof); }
    // the temple wall (front face at z = 0) and a lower roof in front of it
    box(-24, 0, 0, 24, 62, 6, (f, u, v, x, y, tt, L) => {
      if (f === 's') { const g = stained(u - 21, v - 33, x, y, broken); if (g === -2) return C('violet', 1); if (g >= 0 && u > 21 && u < 27 && v > 33) return g; }
      if (f === 's') {
        // pilasters every six metres, a carved frieze above the window, a gold surround on the glass
        const pc = frac((u + 3) / 6); if (pc < 0.13) return shadeC(R.linen, 4.6 + L * 2 - (pc < 0.02 || pc > 0.11 ? 1.4 : 0) - (frac(v / 1.2) < 0.06 ? 0.6 : 0), x, y);
        if (v > 45.4 && v < 47) return shadeC(R.gold, 3 + L * 2 + (Math.abs(frac(u / 1.4) - 0.5) * 4 > (v - 45.4) / 1.6 * 2 ? 1 : -0.6), x, y);
        const wx_ = u - 24, top = 41 + Math.sqrt(Math.max(0, 9 - wx_ * wx_)) * 1.3; if (Math.abs(wx_) < 3.5 && v > 32.4 && v < top + 0.6 && (Math.abs(wx_) > 2.95 || v > top - 0.05)) return shadeC(R.gold, 4 + L * 2, x, y);
      }
      return whiteStone(3.6)(f, u, v, x, y, tt, L);
    });
    box(-22, 31.6, -0.6, 22, 32.2, 0, flatMat(R.gold, 2.6, 3));
    // long indigo banners either side of the window, stirring in the wind
    for (const bx of [-6.5, 6.5]) { const sw = Math.sin(t * 1.6 + bx) * 0.25; poly3([[bx - 1, 44.5, -0.1], [bx + 1, 44.5, -0.1], [bx + 1 + sw, 35, -0.4], [bx - 1 + sw, 35, -0.4]], (u, v, x, y) => { const cy = 44.5 - v; if (cy > 7.6 && Math.abs(u - 1) < 1 - (cy - 7.6) * 0.8) return -1; if (Math.abs(u - 1) < 0.45 && Math.abs(cy - 3.2) < 0.45) return C('gold', 6); if (u < 0.12 || u > 1.88) return C('gold', 4); return shadeC(R.indigo, 3 + (frac(u / 0.5) < 0.2 ? -0.7 : 0), x, y); }, { two: true }); }
    const LR = { seed: 4, lane: 0, x0: -14, x1: 14, z0: -26, z1: -1, y: 30 };
    box(-14, 18, -26, 14, 30, -1, (f, u, v, x, y, tt, L) => f === 'top' ? RF_top(LR)(f, u, v, x, y, tt, L) : towerWin(3, 9)(f, u, v, x, y, tt, L));
    for (const sx of [-14, 13.7]) box(sx, 30, -26, sx + 0.3, 30.45, -1, flatMat(R.gold, 2.6));
  }
  // ---------------------------------------------------------------- the rooftops of the spire, dressed
  // houses of coloured plaster with brick showing through, shuttered windows and a gold cornice
  const RF_RAMP = [R.linen, R.rose, R.linen, R.gold, R.stone, R.rose];
  const RF_side = (r) => (face, u, v, x, y, tt, L) => {
    const sd = ((r.seed % 6) + 6) % 6, ramp = RF_RAMP[sd], top = 14 - v;
    if (top < 0.32) return shadeC(R.gold, 3.2 + L * 2.4 - (top < 0.07 ? 1.2 : 0), x, y);
    if (top < 0.5) return shadeC(ramp, 1.2 + L * 1.6, x, y);
    const wu = frac(u / 1.8), wv = frac((top - 0.9) / 2.6), cell = fl(u / 1.8) * 31 + fl((top - 0.9) / 2.6);
    if (top > 0.9 && wu > 0.28 && wu < 0.72 && wv > 0.12 && wv < 0.74) {
      if (wu < 0.36 || wu > 0.64) return shadeC(ih(cell, sd, 7) < 0.5 ? R.teal : R.crimson, 2.4 + L * 2.2 - (frac(wv * 6) < 0.15 ? 0.8 : 0), x, y);
      return ih(cell, r.seed, 5) < 0.22 ? shadeC(R.gold, 5 + L, x, y) : shadeC(R.night, 1.8 + L * 1.4 + (wv < 0.25 ? 0.9 : 0), x, y);
    }
    if (top > 0.9 && wu > 0.24 && wu < 0.76 && wv >= 0.74 && wv < 0.8) return shadeC(R.stone, 3.6 + L * 2, x, y);
    const row = frac(v / 0.45) < 0.09, jt = frac(u / 0.9 + (fl(v / 0.45) % 2) * 0.5) < 0.06, patch = vn(u * 0.5, v * 0.5, 2, r.seed + 40) > 0.68;
    if (patch) return shadeC(R.ember, 2.4 + L * 2.2 - (row || jt ? 1 : 0), x, y);
    return shadeC(ramp, 3.4 + L * 2.6 + vn(u, v, 3, r.seed) * 0.7 - (vn(u * 2, v * 0.3, 2, r.seed + 9) > 0.8 ? 0.7 : 0), x, y);
  };
  // the roofs: clay tile, mossy flagstones or pale pavers
  const RF_top = (r) => (face, u, v, x, y, tt, L) => {
    const k = fl(ih(r.seed, 3, 107) * 3);
    if (k === 0) { const rw = fl(v / 0.32), cu = frac(u / 0.45 + (rw % 2) * 0.5); return shadeC(R.crimson, 2.0 + L * 1.8 + (frac(v / 0.32) < 0.18 ? -1.1 : 0) + (cu < 0.08 ? -0.7 : 0) + (ih(fl(u / 0.45), rw, r.seed) - 0.5) * 0.7, x, y); }
    const sz = k === 1 ? 0.9 : 0.75, crack = frac(u / sz) < 0.07 || frac(v / sz) < 0.07;
    if (k === 1 && crack && vn(u, v, 1.5, r.seed) > 0.45) return shadeC(R.moss, 3 + L * 2, x, y);
    return shadeC(k === 1 ? R.stone : R.linen, (k === 1 ? 3.4 : 3) + L * 2.4 + (crack ? -1 : 0) + (ih(fl(u / sz), fl(v / sz), r.seed) - 0.5) * 0.6, x, y);
  };
  // what lives on a roof: a parapet, a chimney, a water tank, pots of herbs, a skylight, laundry on a line
  // (all of it on the far side of the courier's lane, so the side camera always sees her)
  function RF_dress(r, t) {
    const sd = ((r.seed % 6) + 6) % 6;
    for (const sx of [r.x0, r.x1 - 0.28]) box(sx, r.y, r.z0, sx + 0.28, r.y + 0.42, r.z1, (f, u, v, x, y, tt, L) => shadeC(sd === 3 ? R.linen : R.gold, 2.6 + L * 2.4 - (frac(u / 1.2) < 0.05 ? 0.8 : 0), x, y));
    const ex = r.lane * 9 - 2.3;
    if (ih(r.seed, 1, 103) < 0.6) box(r.x0 + 0.5, r.y, r.z0 + 1.5, r.x0 + 1.3, r.y + 1.8, r.z0 + 2.3, (f, u, v, x, y, tt, L) => shadeC(R.ember, 2.2 + L * 2.2 - (frac(v / 0.3) < 0.12 ? 0.9 : 0), x, y));
    if (ih(r.seed, 2, 103) < 0.4) { prism(r.x0 + 1.5, r.z1 - 2, 0.9, r.y, r.y + 1.6, 6, flatMat(R.wood, 2.6)); cone(r.x0 + 1.5, r.z1 - 2, 1.1, r.y + 1.6, 0.8, 6, flatMat(R.wood, 2)); }
    for (let k = 0; k < 3; k++) { if (ih(r.seed, k + 10, 104) > 0.55) continue; const pz = r.z0 + 1 + ih(r.seed, k + 20, 104) * (r.z1 - r.z0 - 2), px = ex + (ih(r.seed, k + 30, 104) - 0.5) * 0.8; box(px - 0.22, r.y, pz - 0.22, px + 0.22, r.y + 0.4, pz + 0.22, flatMat(R.ember, 2.2)); box(px - 0.3, r.y + 0.4, pz - 0.3, px + 0.3, r.y + 0.75 + ih(k, r.seed, 105) * 0.3, pz + 0.3, (f, u, v, x, y, tt, L) => shadeC(R.moss, 2.6 + L * 2.6 + (ih(fl(x / 2), fl(y / 2), 106) - 0.5) * 1.4, x, y)); }
    if (ih(r.seed, 6, 104) < 0.4) box(ex - 0.6, r.y, r.z1 - 3, ex + 0.6, r.y + 0.5, r.z1 - 2, (f, u, v, x, y, tt, L) => (f === 'top' ? shadeC(R.teal, 4 + L * 2 + (frac(u / 0.4) < 0.1 ? -1.5 : 0), x, y) : shadeC(R.stone, 2.6 + L * 2, x, y)));
    if (ih(r.seed, 7, 104) < 0.5) {
      const lx = r.lane * 9 - 2.9, z0 = r.z0 + 1.2, z1 = Math.min(r.z1 - 1, z0 + 5), hy = r.y + 1.9;
      for (const z of [z0, z1]) box(lx - 0.05, r.y, z - 0.05, lx + 0.05, hy, z + 0.05, flatMat(R.wood, 2));
      l3(lx, hy, z0, lx, hy - 0.15, (z0 + z1) / 2, C('linen', 6)); l3(lx, hy - 0.15, (z0 + z1) / 2, lx, hy, z1, C('linen', 6));
      for (let k = 0; k < 4; k++) { const zc = lerp(z0, z1, (k + 0.6) / 4.4), sw = Math.sin(t * 2.2 + k * 1.3) * 0.12, cy_ = hy - 0.1 - Math.sin((k + 0.6) / 4.4 * PI) * 0.15, col = [R.crimson, R.teal, R.gold, R.linen][(k + sd) % 4];
        poly3([[lx, cy_, zc - 0.3], [lx, cy_, zc + 0.3], [lx + sw, cy_ - 0.7, zc + 0.3], [lx + sw, cy_ - 0.75, zc - 0.3]], (u, v, x, y) => shadeC(col, 4 + (frac(u / 0.2) < 0.15 ? -0.8 : 0), x, y), { two: true }); }
    }
    // prayer flags strung over the gap to the next roof
    if (ih(r.seed, 3, 103) < 0.7 && r.lane === 0) for (let k = 0; k < 8; k++) { const z = r.z1 - 1 + k * 0.5, sag = Math.sin(k / 7 * PI) * 0.7, x = r.x0 + 0.5 + k * 0.7, fy = r.y + 3.2 - sag, col = [R.crimson, R.gold, R.indigo, R.teal, R.linen][k % 5]; poly3([[x, fy, z], [x + 0.4, fy, z], [x + 0.2 + Math.sin(t * 3 + k) * 0.08, fy - 0.6, z + 0.05]], (u, v, xx, yy) => shadeC(col, 4.6, xx, yy), { two: true }); }
  }
  function drawRoofs(t) {
    setSun(-0.55, 0.45, 0.7, 0.45); setFog('#f0b3a6', 40, 260, 0.85);
    sky(skyDawn);
    plane(0, cloudSea, { maxD: 600 });
    for (const T of HS.towers) { if (Math.abs(T.x + 60) < 30 + T.r || Math.hypot(T.x - CAM.x, T.z - CAM.z) > 380) continue; prism(T.x + 60, T.z + 120, T.r, -10, T.h, T.n, towerWin(3.4, T.seed)); cone(T.x + 60, T.z + 120, T.r * 1.25, T.h, T.cap, T.n, goldRoof); }
    for (const r of RT.roofs) {
      if (r.z1 < CAM.z - 4 || r.z0 > CAM.z + 140) continue;
      box(r.x0, r.y - 14, r.z0, r.x1, r.y, r.z1, (face, u, v, x, y, tt, L) => face === 'top' ? RF_top(r)(face, u, v, x, y, tt, L) : RF_side(r)(face, u, v, x, y, tt, L));
      if (r.z0 < CAM.z + 70) RF_dress(r, t);
    }
  }

  // 17 — the window bursts; Kaira, in slow motion, and her card; then she lands and runs (1:52)
  shot(112.0, 122.0, (lt, t) => {
    const g = t - GLASS0, st = slowmo(Math.max(0, g)), broken = g > 0;
    const freeze = g > 1.9 && g < 3.9;
    const fo = sstep(-0.2, 1.0, g), ru = sstep(4.2, 7.5, g);
    const kxr = -2.2 - Math.max(0, slowmo(Math.max(0, g)) - 2.2) * 6;
    // Kaira's arc out of the window to the roof
    let kx = 0, ky = 37, kz = 0.5, ka = 0, view = 'side';
    if (g > 0) {
      const u = clamp(st / 1.7, 0, 1);
      kx = lerp(0, -2.2, u); kz = lerp(-0.6, -7, u); ky = lerp(36.4, 30, u) + Math.sin(u * PI) * 2.4; ka = -u * TAU * 0.75;
      if (st > 1.7) { const r = st - 1.7; kz = -7; ky = 30; ka = r < 0.4 ? -PI * 1.5 - r * 4 : 0; kx = -2.2 - Math.max(0, r - 0.5) * 6; }
    }
    // the camera rides with her once she is through the glass: a three-quarter view, a little below her line
    const fy_ = Math.max(ky, 30.6) + 0.7;
    lookAt(lerp(6.0, kx + 4.6, fo), lerp(31.0, fy_ - 0.2, fo), lerp(-18, kz - 7.8, fo), lerp(0, kx - 0.3, fo), lerp(37.2, fy_, fo), lerp(-0.5, kz, fo), lerp(60, 52, fo));
    drawFacade(t, broken);
    ink(2);
    const fx = (sx) => sx;
    if (g > 0) {
      const ruN = st > 2.1;
      actor3('kaira', { view: ruN ? 'side' : 'side', run: ruN ? t * 18 : undefined, air: !ruN && st < 1.7, crouch: st > 1.7 && st < 2.2 ? 1 : 0, blade: 2.2, blade2: 2.6, seed: 0.6, wind: 4, eyes: 'narrow', brows: 'angry', armF: ruN ? 1.4 : -0.6 }, kx, ky, kz, { flip: st < 1.7, ang: ka, size: 1.25, gy: 30 });
    }
    // the glass: a burst of coloured shards toward the camera
    if (g > 0) for (let k = 0; k < 160; k++) {
      const vx = (ih(k, 1, 311) - 0.5) * 10, vy = (ih(k, 2, 311) - 0.2) * 7, vz = -(4 + ih(k, 3, 311) * 14), tt = st * 1.1;
      const x = (ih(k, 4, 311) - 0.5) * 5 + vx * tt, y = 37 + (ih(k, 5, 311) - 0.5) * 7 + vy * tt - 6 * tt * tt, z = -0.4 + vz * tt;
      const p = proj(x, y, z); if (!p || p.z < 0.5) continue;
      const s = Math.min(6, Math.max(1, CAM.F / p.z * 0.18)), a = ih(k, 6, 311) * TAU + tt * (3 + ih(k, 7, 311) * 6), col = [C('indigo', 6), C('gold', 6), C('crimson', 6), C('teal', 6), WHITE][k % 5];
      shard(p.x, p.y, Math.round(s), a, col, WHITE);
    }
    if (g > 0 && g < 0.12) { flashWhite(0.5 * (1 - g / 0.12)); shk(4); }
    // the freeze-frame card
    if (freeze) {
      tintAll(T_DARK, 0.35);
      const a = lin(1.9, 2.15, g);
      for (let y = 150; y < 206; y++) for (let x = 0; x < W; x++) { const xx = x - (y - 150) * 0.6; if (xx > 30 && xx < 30 + 420 * a) BUF[y * W + x] = y < 153 || y > 202 ? C('gold', 5) : shadeC(R.indigo, 2.4 + (xx % 40 < 20 ? 0.3 : 0), x, y); }
      text('KAIRA', 70, 158, C('gold', 6), 4, C('night', 0), fl((g - 1.95) * 30));
      text('COURIER OF THE SKY TEMPLE', 74, 192, C('linen', 7), 1, undefined, fl((g - 2.2) * 40));
    }
    if (g > 3.9 && g < 4.0) whip(60, 0);
  });

  // ---------------------------------------------------------------- the chase along the rooftops
  const K_RUN = 9.5;                                      // metres per second
  // the courier's path: run along lane 0, jumping every gap
  function kairaAt(t0, t) {
    const z = 2 + (t - t0) * K_RUN; let y = roofY(0, z);
    if (y === null) { // in a gap: an arc from the end of one roof to the start of the next
      let a = null, b = null; for (const r of RT.roofs) if (r.lane === 0) { if (r.z1 <= z && (!a || r.z1 > a.z1)) a = r; if (r.z0 >= z && (!b || r.z0 < b.z0)) b = r; }
      if (a && b) { const u = (z - a.z1) / (b.z0 - a.z1); y = lerp(a.y, b.y, u) + Math.sin(u * PI) * 1.6; } else y = 30;
      return { z, y, air: true };
    }
    return { z, y, air: false };
  }
  // pursuers on the side lanes
  function wardensChase(t, t0, n, side) {
    for (let k = 0; k < n; k++) {
      const lane = k % 2 ? 1 : -1, z = 2 + (t - t0) * K_RUN - 5 - k * 3.2, y = roofY(lane, z);
      const yy = y === null ? 30 + Math.sin(frac(z / 9) * PI) * 1.2 : y;
      actor3('warden', { view: side || 'back', run: t * 15 + k, spear: -1.1, captain: k === 0 }, lane * 9, yy, z, {});
    }
  }
  // 18 — behind her: "framed, chased, and glowing" (2:02)
  const CH0 = 118.0;
  shot(122.0, 131.0, (lt, t) => {
    const k = kairaAt(CH0, t);
    lookAt(0.6, k.y + 2.2, k.z - 5.2, 0, k.y + 1.0, k.z + 6, 64);
    drawRoofs(t); ink(2);
    wardensChase(t, CH0, 4);
    actor3('kaira', { view: 'back', run: k.air ? undefined : t * 19, air: k.air, wind: 5, seed: 0.5 + 0.3 * Math.sin(t * 6) }, 0, k.y, k.z, {});
    streaks(PI / 2, 26, t, 1600, C('linen', 7), 40, 321, [0, LB, W, H - 2 * LB]);
  });
  // 19 — in front of her, running at us: "I don't HAVE it!" — the chest glows — a spear — the step (2:11)
  shot(131.0, 140.0, (lt, t) => {
    const k = kairaAt(CH0, t), dodge = lin(136.3, 136.5, t), seedA = sstep(132.8, 133.6, t);
    const kx = -1.6 * eoc(dodge);
    lookAt(-0.4, k.y + 1.3, k.z + 5.4, -0.2, k.y + 0.9, k.z, 58);
    drawRoofs(t); ink(2);
    wardensChase(t, CH0, 4, 'front');
    const after = dodge > 0 && dodge < 1 || (t > 136.3 && t < 136.8) ? [[proj(0, k.y, k.z) || { x: 0, y: 0 }]].map((q) => [q.x, q.y, C('gold', 6), 0.5]) : undefined;
    const kk = actor3('kaira', { view: 'front', run: k.air ? undefined : t * 19, air: k.air, wind: 2, seed: 0.4 + seedA * 0.6, eyes: t > 133 && t < 136 ? 'half' : 'wide', brows: t > 133.4 && t < 136 ? 'worried' : 'n', look: 0, mouth: mouth('kaira', t), smile: t > 134.3 && t < 136 ? -0.5 : 0 }, kx, k.y, k.z, { after });
    if (kk && seedA > 0) { glow(kk.chest[0], kk.chest[1], 30 * kk.S / 3 * (0.7 + 0.3 * Math.sin(t * 8)), T_GOLD, 0.55 * seedA); }
    // the spear
    if (t > 135.8 && t < 136.9) {
      const u = (t - 135.8) / 1.1, sz = k.z - 12 + u * 20, sx = lerp(-0.9, -0.15, u), sy = k.y + 1.15;
      const a = proj(sx, sy, sz), A = a && [a.x, a.y, a.z], b = proj(sx, sy + 0.05, sz + 2.4), B = b && [b.x, b.y, b.z], c = proj(sx, sy + 0.06, sz + 3.0), Cc = c && [c.x, c.y];
      if (A && B && Cc) { const w = Math.max(2, Math.min(6, CAM.F / B[2] * 0.06)); for (let q = 0; q < 6; q++) thick(A[0], A[1] + q * 0.5, B[0], B[1] + q * 0.5, w, q < 3 ? C('wood', 5) : C('wood', 3)); thick(B[0], B[1], Cc[0], Cc[1], w * 1.6, C('stone', 7)); P(Cc[0], Cc[1], WHITE); for (let q = 1; q < 6; q++) lineF(A[0] - (B[0] - A[0]) * q * 0.3, A[1] - (B[1] - A[1]) * q * 0.3 + q, A[0], A[1], (x, y) => { if (ih(x, y, q) < 0.4) P(x, y, C('linen', 7)); }); }
    }
    if (dodge > 0 && dodge < 1) { for (let q = 0; q < 3; q++) { const p = proj(lerp(0, kx, q / 3), k.y + 0.8, k.z); if (p) { sparkle(p.x, p.y - q * 6, 6, WHITE, C('gold', 6)); } } shk(2); }
    if (t > 136.3 && t < 136.9) { const p = proj(kx, k.y + 0.8, k.z); if (p) for (let b = 0; b < 3; b++) lineF(p.x, p.y, p.x + (ih(b, fl(t * 30), 323) - 0.5) * 80, p.y + (ih(b, fl(t * 30) + 1, 323) - 0.5) * 60, (x, y) => P(x, y, C('gold', 7))); }
  });
  // 20 — the wide side view: three lanes, the clouds, a big spinning leap (2:20)
  shot(140.0, 148.0, (lt, t) => {
    const k = kairaAt(CH0, t);
    const lift_ = Math.sin(lin(142.5, 143.8, t) * PI) * 1.8;
    lookAt(5.0, k.y + 1.9 + lift_ * 0.6, k.z - 3.4, 0, k.y + 1.3 + lift_, k.z + 1.4, 60);
    drawRoofs(t); ink(2);
    wardensChase(t, CH0, 6, 'side');
    const spin = lin(142.6, 143.6, t);
    actor3('kaira', { view: 'side', run: k.air ? undefined : t * 19, air: k.air, wind: 5, blade: spin > 0 && spin < 1 ? -0.6 + spin * 4 : 2.0, blade2: 2.5, storm: spin > 0 && spin < 1, eyes: 'narrow', brows: 'angry' }, 0, k.y + Math.sin(spin * PI) * 2.2, k.z, { flip: true, ang: spin > 0 && spin < 1 ? -eio(spin) * TAU : 0, gy: k.y, after: spin > 0.1 && spin < 0.95 ? [0.15, 0.3].map((d) => { const p = proj(0, k.y + Math.sin(Math.max(0, spin - d) * PI) * 2.2, k.z - d * 3); return p ? [p.x, p.y, C('gold', 6), 0.5 - d] : [0, 0, 0, 0]; }) : undefined });
    // thrown chains arcing at her
    for (const [c0, side] of [[141.2, -1], [144.6, 1], [146.0, -1]]) { const u = (t - c0) / 0.6; if (u <= 0 || u >= 1.4) continue; const x0 = side * 9, z0 = k.z - 6; const xe = lerp(x0, 0.4 * side, Math.min(1, u)), ze = lerp(z0, k.z + (u > 1 ? -1 : 0), Math.min(1, u)); for (let c = 0; c <= 12; c++) { const v = c / 12; p3(lerp(x0, xe, v), k.y + 1.4 + Math.sin(v * PI) * 1.4, lerp(z0, ze, v), C('stone', 6), 0.07); } }
  });

  // ---------------------------------------------------------------- the broken bridge and the long drop
  const BR = { y: 30, z1: 14 };
  function drawBridge(t, opt) {
    opt = opt || {};
    setSun(-0.55, 0.45, 0.7, 0.45); setFog('#f0b3a6', 30, 240, 0.85);
    sky(skyDawn);
    // the harbour ring, far below: water, docks, the city wall
    plane(-60, (wx, wz, d, x, y) => { const dock = Math.abs(wz - 40) < 3 && Math.abs(wx) < 40, boat = ih(fl(wx / 6), fl(wz / 4), 331) < 0.04; return dock ? shadeC(R.wood, 3.2 + (frac(wx) < 0.2 ? -0.8 : 0), x, y) : boat ? shadeC(R.crimson, 3, x, y) : waterTex()(wx, wz, d, x, y); }, { maxD: 900 });
    for (let k = 0; k < 9; k++) box(-60 + k * 14, -60, 70, -50 + k * 14, -28 + ih(k, 1, 332) * 18, 80, towerWin(3, k));
    for (let k = 0; k < 6; k++) box(-34 + k * 12, -60, 16 + ih(k, 2, 332) * 10, -26 + k * 12, -40 + ih(k, 3, 332) * 10, 26 + ih(k, 2, 332) * 10, wallMat(k + 80, 0.3));
    // the bridge: a stone span ending in a broken jagged edge
    box(-2.4, BR.y - 2.2, -40, 2.4, BR.y, BR.z1, (f, u, v, x, y, tt, L) => f === 'top' ? shadeC(R.linen, 3 + L * 2.2 + (frac(u / 0.9) < 0.08 || frac(v / 0.9) < 0.08 ? -1 : 0), x, y) : stoneMat(R.linen, 2.2)(f, u, v, x, y, tt, L));
    for (const sx of [-2.4, 2.1]) box(sx, BR.y, -40, sx + 0.3, BR.y + 1.0, BR.z1 - 1.4, stoneMat(R.linen, 2.6));
    for (let k = 0; k < 6; k++) box(-2.4 + k * 0.8, BR.y - 2.2 - ih(k, 1, 333) * 2, BR.z1, -1.6 + k * 0.8, BR.y - 0.2 * (k & 1), BR.z1 + 0.4 + ih(k, 2, 333) * 1.4, stoneMat(R.linen, 2));
    for (const T of HS.towers.slice(0, 16)) { prism(T.x + 30, T.z + 110, T.r, -60, T.h, T.n, towerWin(3.4, T.seed)); cone(T.x + 30, T.z + 110, T.r * 1.25, T.h, T.cap, T.n, goldRoof); }
  }
  const OREN_Z = 6.0, KAIRA_EDGE = 12.6;
  function standoff(t, opt) {
    // wardens in a half ring, Oren in front, Kaira at the edge
    const land = [149.0, 149.6, 150.3, 151.0];
    for (let k = 0; k < 4; k++) {
      const g = t - land[k]; if (g < -0.6) continue;
      const x = [-1.6, 1.6, -0.6, 0.9][k], z = [8.4, 8.6, 6.6, 6.9][k], y = g < 0 ? BR.y + (-g) * 12 : BR.y;
      actor3('warden', { view: opt.wview || 'side', spear: g < 0 ? -1.2 : -0.5, crouch: g > 0 && g < 0.25 ? 1 : 0, air: g < 0, captain: false }, x, y, z, {});
      if (g > 0 && g < 0.3) { const p = proj(x, BR.y, z); if (p) { shockRing(p.x, p.y, 4 + g * 80, 1.5 + g * 20, 2, [WHITE, C('linen', 6), C('linen', 4)], 1 - g / 0.3); shk(1.5); } }
    }
  }
  // 21 — the dead end (2:28): a low orbit as they land around her
  shot(148.0, 153.0, (lt, t) => {
    const a = -0.7 + lt * 0.22, r = 6.6;
    lookK(Math.sin(a) * r, BR.y + 2.8, KAIRA_EDGE - 1 - Math.cos(a) * r, 0, BR.y + 1.0, KAIRA_EDGE - 2, 58, 1.3);
    drawBridge(t); ink(2);
    const skid = 1 - eoc(lin(0, 0.6, lt));
    actor3('kaira', { view: 'side', crouch: skid > 0.2 ? 1 : 0, eyes: 'wide', brows: 'worried', blade: 1.2, blade2: 2.5, seed: 0.6, wind: 2 }, 0, BR.y, KAIRA_EDGE - skid * 3, { flip: false });
    if (skid > 0.05) for (let q = 0; q < 10; q++) { const p = proj((ih(q, 1, 341) - 0.5) * 0.8, BR.y + 0.1 + ih(q, 2, 341) * 0.3, KAIRA_EDGE - skid * 3 - 0.4 - q * 0.2); if (p) P(p.x, p.y, C('linen', 6)); }
    standoff(t, { wview: 'side' });
    actor3('warden', { view: 'side', captain: true, spear: -0.4, run: lt < 2.6 ? t * 14 : undefined }, 0, BR.y, lerp(-4, OREN_Z, eoc(lin(1.2, 3.4, lt))), {});
  });
  // 22 — Oren: "five days, courier" (2:33)
  shot(153.0, 160.0, (lt, t) => {
    if (lt < 4.6) {
      lookAt(1.0, BR.y + 1.1, OREN_Z + 4.4, -0.2, BR.y + 0.95, OREN_Z, 46);
      drawBridge(t); ink(2);
      actor3('warden', { view: 'front', captain: true, spear: -1.5, eyes: 'narrow', mouth: mouth('oren', t) }, 0, BR.y, OREN_Z, { rim: { side: 1, T: T_GOLD, a: 0.5 } });
      actor3('warden', { view: 'front', spear: -1.4 }, -1.7, BR.y, OREN_Z - 1.6, {});
    } else {
      // over Oren's shoulder: Kaira at the edge, the sky behind her
      lookAt(-0.9, BR.y + 1.9, OREN_Z - 4.7, 0, BR.y + 1.0, KAIRA_EDGE, 36);
      drawBridge(t); ink(2);
      actor3('kaira', { view: 'front', eyes: blink(t, 11) ? 'closed' : 'open', brows: 'worried', blade: 1.4, seed: 0.6, wind: 2, look: 0 }, 0, BR.y, KAIRA_EDGE, {});
      actor3('warden', { view: 'back', captain: true, spear: -1.5 }, 0.4, BR.y, OREN_Z, { dark: 1 });
    }
  });
  // 23 — she looks down: the drop (vertigo), then the grin, and she falls backwards (2:40)
  shot(160.0, 166.0, (lt, t) => {
    if (lt < 1.6) {
      const v = eio(lin(0, 1.6, lt));
      lookAt(0, BR.y + 1.3, BR.z1 + 1.8, 0, -60, BR.z1 + 24, lerp(34, 72, v));
      drawBridge(t); ink(2, 60);
      zoomBlur(240, 135, 0.06 * Math.sin(v * PI));
    } else {
      const fall = lin(4.5, 5.6, lt), u = lt - 1.6;
      // she tips back off the edge, clear of the broken stones; the camera swings out past the edge and tilts down after her
      const ky_ = BR.y - Math.max(0, fall - 0.3) ** 2 * 16, kz_ = KAIRA_EDGE + eoc(fall) * 4.6, cr = sstep(0.25, 0.55, fall);
      lookK(lerp(0.2, 2.2, cr), lerp(BR.y + 1.4, BR.y + 1.0, cr), lerp(KAIRA_EDGE - 3.4, BR.z1 + 9, cr), 0, lerp(BR.y + 1.0, ky_ + 0.6, cr), lerp(KAIRA_EDGE, kz_, cr), 40 + cr * 16, lerp(1.4, 1, cr));
      drawBridge(t); ink(2);
      actor3('kaira', { view: 'front', eyes: u > 0.6 ? 'half' : 'open', brows: u > 0.6 ? 'up' : 'n', smile: u > 0.5 ? 0.8 : 0, mouth: mouth('kaira', t), seed: 0.6, wind: 3 + fall * 3, armF: fall > 0 ? -1.2 : 1.3, armL: fall > 0 ? -1.9 : 1.9 }, 0, ky_, kz_, { ang: eio(fall) * 1.9, shadow: fall < 0.3 });
    }
  });

  // ---------------------------------------------------------------- the fall through the market awnings
  const AWN = [[169.5, -14, C('crimson', 5), R.crimson], [171.0, -30, C('teal', 5), R.teal], [172.5, -44, C('gold', 5), R.gold]];
  shot(166.0, 176.0, (lt, t) => {
    // her height: falling fast, slowed by each awning she rips through
    let y = 26 - (lt * lt) * 4.2; for (const [ta] of AWN) if (t > ta) y += (t - ta) * 2.5;
    y = Math.max(y, -52);
    const cy = y + 9;
    lookAt(0.3, cy, -0.4, 0, y - 20, 0.6, 70);
    setSun(-0.4, 0.8, 0.4, 0.5); setFog('#f0b3a6', 20, 120, 0.7);
    sky(skyDawn);
    // the market far below: stalls and crowds, and the buildings around the plunge
    plane(-60, (wx, wz, d, x, yy) => { const st = ih(fl((wx + 100) / 4), fl((wz + 100) / 4), 351); return st < 0.3 ? shadeC([R.crimson, R.teal, R.gold, R.indigo][fl(st * 13) % 4], 4, x, yy) : cobble(R.stone, 3, false)(wx, wz, d, x, yy); }, { maxD: 300 });
    for (let k = 0; k < 8; k++) { const a = k / 8 * TAU, d = 9 + ih(k, 1, 352) * 4; box(Math.cos(a) * d - 3, -60, Math.sin(a) * d - 3, Math.cos(a) * d + 3, 20 - ih(k, 2, 352) * 10, Math.sin(a) * d + 3, towerWin(3.2, k + 90)); }
    // the awnings: sloped cloth on poles; torn once she's through
    for (const [ta, ay, col, ramp] of AWN) {
      const torn = t > ta;
      poly3([[-2.6, ay, -2.0], [2.6, ay, -2.0], [2.6, ay - 1.0, 2.0], [-2.6, ay - 1.0, 2.0]], (u, v, x, yy) => { if (torn && Math.abs(u - 2.6) < 1.2 + (t - ta) * 0.6 && Math.abs(v - 2.0) < 1.0 + (t - ta) * 0.8) return -1; return frac(u / 0.9) < 0.5 ? shadeC(ramp, 4.4, x, yy) : shadeC(R.linen, 6, x, yy); }, { two: true });
    }
    actor3('kaira', { view: 'front', air: true, eyes: lt < 2 ? 'wide' : 'narrow', brows: lt < 2 ? 'worried' : 'angry', mouth: lt < 1.2 ? 0.6 : 0, armF: -1.6 + Math.sin(t * 7) * 0.3, armL: -1.5, wind: 6, seed: 0.6 }, 0, y, 0, { ang: Math.sin(t * 2) * 0.3 });
    // tearing cloth
    for (const [ta, ay, col] of AWN) { const g = t - ta; if (g < 0 || g > 1.2) continue; for (let k = 0; k < 30; k++) { const p = proj((ih(k, 1, 353) - 0.5) * 4 + (ih(k, 2, 353) - 0.5) * g * 6, ay - g * 4 + ih(k, 3, 353) * g * 3, (ih(k, 4, 353) - 0.5) * 4); if (p) shard(p.x, p.y, 2, ih(k, 5, 353) * TAU + g * 8, col, C('linen', 7)); } if (g < 0.1) { shk(4); flashWhite(0.3 * (1 - g / 0.1)); } }
    streaks(-PI / 2, 50, t, 2600, C('linen', 7), 60, 354, [0, LB, W, H - 2 * LB]);
  });

  /* ================================================================ ACT ONE (b) — the harbour: Tamo, the anchor, the Hush, the Bellwether */
  const DY = 0.35;                                             // the dock's top
  const RUNK = 6.2, WALKK = 7.5;                               // gait phase per metre travelled, so the feet keep (roughly) to the planks
  const ANCHOR_X = 6.2, ANCHOR_Z = 1.4, AK = 1.3;              // where the old anchor stands, and its size against its bearer
  const angF = (a, flip) => (flip ? PI - a : a);               // an angle in a figure's facing space, on screen
  const bobOf = (ph) => { const s = Math.abs(Math.sin(ph)); return s > 0.75 ? 1 : s < 0.3 ? -1 : 0; };

  // ---------------------------------------------------------------- props and helpers for this act
  // the anchor, drawn into the sprite canvas at scale k: its ring at (x, y), its flukes out along ang
  function drawAnchorK(x, y, ang, glowA, k) {
    const ca = Math.cos(ang), sa = Math.sin(ang), L = 20 * k, ex = x + ca * L, ey = y + sa * L;
    const iron = glowA ? C('teal', 6) : C('stone', 4), ironL = glowA ? C('teal', 7) : C('stone', 6), ironD = glowA ? C('teal', 4) : C('stone', 2);
    sLine(x - ca * 3 * k, y - sa * 3 * k, ex, ey, iron, 3, 2); sLine(x - ca * 2 * k, y - sa * 2 * k, ex - ca * 3, ey - sa * 3, ironL, 1, 2);
    const rx = x - ca * 6.5 * k, ry = y - sa * 6.5 * k; for (let a = 0; a < TAU; a += 0.12) sp(rx + Math.cos(a) * 2.8 * k, ry + Math.sin(a) * 2.8 * k, a > 2 && a < 4.5 ? ironD : iron, 2);
    sLine(x + ca * k - sa * 7 * k, y + sa * k + ca * 7 * k, x + ca * k + sa * 7 * k, y + sa * k - ca * 7 * k, ironD, 2, 2);
    for (let q = -11 * k; q <= 11 * k; q += 0.5) { const b = q * q / (11 * k) * 0.45, bx = ex - ca * b - sa * q, by = ey - sa * b + ca * q; sp(bx + ca, by + sa, ironD, 2); sp(bx, by, iron, 2); sp(bx - ca, by - sa, ironL, 2); }
    for (const s of [-1, 1]) {
      const tq = 11 * k * s, b = 11 * k * 0.45, fx = ex - ca * b - sa * tq, fy = ey - sa * b + ca * tq;
      sPoly([[fx + ca * 1.5, fy + sa * 1.5], [fx - ca * 6 * k - sa * s * 1.2, fy - sa * 6 * k + ca * s * 1.2], [fx - sa * s * 3.6 * k, fy + ca * s * 3.6 * k]], ironL, 2);
    }
    if (!glowA) { for (let q = 0; q < 6; q++) { const u = 0.15 + q * 0.14; sp(x + ca * L * u + (q & 1 ? -sa : sa), y + sa * L * u + (q & 1 ? ca : -ca), C('wood', 3), 2); } sp(ex - sa * 6 * k, ey + ca * 6 * k, C('moss', 5), 2); sp(ex + sa * 5 * k, ey - ca * 5 * k, C('moss', 4), 2); }
  }
  // the anchor in a bearer's hand (r from actor3), at the bearer's own pixel scale; ang on screen
  function heldAnchor(r, ang, glowA, behind) {
    if (!r || !r.hand) return null;
    const S = r.S, hx = Math.round(r.hand[0]), hy = Math.round(r.hand[1]);
    clearSprite(); drawAnchorK(30, 20, ang, glowA, AK); outlineSprite();
    stamp(hx, hy + Math.round(40 * S), S, 0, false, { z: r.z + (behind ? 0.06 : -0.06), fog: true, keepMask: true });
    const L = (20 + 5) * AK * S;
    return { x: hx, y: hy, tip: [hx + Math.cos(ang) * L, hy + Math.sin(ang) * L], L, S };
  }
  // the anchor standing (or lying) on its own: its ring at world (x, y, z)
  function anchorAt3(x, y, z, ang, glowA) {
    const p = proj(x, y, z); if (!p) return null; const S = snapS(CAM.F / p.z / 26); if (S > 12) return null;
    const px = Math.round(p.x), py = Math.round(p.y), pz = p.z;
    clearSprite(); drawAnchorK(30, 20, ang, glowA, AK); outlineSprite(); clearMask();
    stamp(px, py + Math.round(40 * S), S, 0, false, { z: pz, fog: true });
    return { x: px, y: py, S, z: pz, tip: [px + Math.cos(ang) * 25 * AK * S, py + Math.sin(ang) * 25 * AK * S] };
  }
  // a figure turned about its feet (lying, toppling) or about its middle (tumbling through the air)
  function atFeet(who, o, x, y, z, ang, opt) {
    opt = opt || {}; const p = proj(x, y, z); if (!p) return null;
    const S = snapS(CAM.F / p.z * (opt.size || 1) / 26); if (S > 12) return null;
    const pz = p.z, px = p.x, py = p.y;
    if (opt.gy !== undefined) contactShadow(opt.sx === undefined ? x : opt.sx, opt.gy, z, opt.sr || 0.6, 0.5);
    return Object.assign(actor(who, o, Math.round(px), Math.round(py), S, Object.assign({ z: pz, fog: true, ang: ang || 1e-6 }, opt)), { z: pz });
  }
  function spin(who, o, cx, cy, cz, ang, opt) {
    opt = opt || {}; const p = proj(cx, cy, cz); if (!p) return null;
    const S = snapS(CAM.F / p.z * (opt.size || 1) / 26); if (S > 12) return null;
    const pz = p.z, px = p.x, py = p.y, h = 22 * S;
    if (opt.gy !== undefined) { const hgt = Math.max(0, cy - 0.8 - opt.gy); if (hgt < 6) contactShadow(cx, opt.gy, cz, 0.45 + hgt * 0.05, 0.5 * (1 - hgt / 6)); }
    return Object.assign(actor(who, Object.assign({ air: true }, o), Math.round(px - Math.sin(ang) * h), Math.round(py + Math.cos(ang) * h), S, Object.assign({ z: pz, fog: true, ang: ang || 1e-6 }, opt)), { z: pz, cx: px, cy: py });
  }
  // a fish: a chunky silver body, a dark back, a forked tail (screen space, s = half length in pixels)
  function fishAt(px, py, pz, s, a, flop) {
    const ca = Math.cos(a), sa = Math.sin(a);
    for (const pass of [0, 1]) {
      const g = pass ? 0 : 1;
      for (let k = -s - g; k <= s + g; k += 0.5) { const w = Math.sqrt(Math.max(0, 1 - (k / (s + g)) ** 2)) * (s * 0.36 + g); for (let j = -w; j <= w; j += 0.5) PZ(px + ca * k - sa * j, py + sa * k + ca * j, pass ? (j < -w * 0.25 ? C('sea', 3) : j > w * 0.45 ? C('hush', 5) : C('stone', 6)) : C('night', 1), pz - 0.05 - pass * 0.001); }
      const tx = px - ca * (s + 0.5), ty = py - sa * (s + 0.5), f = 1 + (flop || 0) * 0.5;
      for (let j = -s * 0.5 * f - g; j <= s * 0.5 * f + g; j += 0.5) lineF(tx, ty, tx - ca * (Math.abs(j) * 0.8 + 1 + g) - sa * j, ty - sa * (Math.abs(j) * 0.8 + 1 + g) + ca * j, (x, y) => PZ(x, y, pass ? C('stone', 4) : C('night', 1), pz - 0.05 - pass * 0.001));
    }
    PZ(px + ca * s * 0.62 + sa, py + sa * s * 0.62 - ca, C('night', 0), pz - 0.06); PZ(px + ca * s * 0.62 + sa * 2, py + sa * s * 0.62 - ca * 2, WHITE, pz - 0.06);
  }
  function fish3(x, y, z, a, flop) { const p = proj(x, y, z); if (!p) return; fishAt(p.x, p.y, p.z, Math.max(2, Math.min(10, CAM.F / p.z * 0.17)), a, flop); }
  // a ring of dust rolling out along the planks from (x, z), g seconds old
  function dust3(x, z, g, size, seed, y0) {
    if (g < 0 || g > 1.5) return; size = size || 1; y0 = y0 === undefined ? DY : y0;
    const n = fl(10 + 8 * size), fade = 1 - g / 1.5;
    for (let k = 0; k < n; k++) {
      const a = ih(k, 1, seed) * TAU, v = (0.7 + ih(k, 2, seed) * 0.9) * size, r = v * eoc(g / 1.2);
      const px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r * 0.85, py = y0 + 0.08 + g * 0.35 * (0.4 + ih(k, 3, seed)) * size;
      const p = proj(px, py, pz); if (!p) continue;
      const rad = Math.min(40, (0.1 + 0.16 * eoc(g / 0.8)) * Math.sqrt(size) * CAM.F / p.z * (0.6 + ih(k, 4, seed) * 0.7));
      for (let yy = -rad; yy <= rad; yy++) for (let xx = -rad; xx <= rad; xx++) {
        const d = Math.hypot(xx, yy) / rad; if (d > 1) continue; const X = fl(p.x + xx), Y = fl(p.y + yy * 0.75); if (X < 0 || Y < LB || X >= W || Y >= H - LB) continue;
        if (bay(X, Y) > fade * (1.15 - d)) continue; const i = Y * W + X; if (ZB[i] < p.z - 0.4) continue;
        BUF[i] = yy < -rad * 0.3 ? C('linen', 6) : d < 0.6 ? C('linen', 5) : C('wood', 5);
      }
    }
  }
  // splinters: boards flung up from (x, y, z), tumbling, landing flat on the deck and staying there
  function plank3(x, y, z, L, w, rot, flat, ramp, s0) {
    const c = Math.cos(rot), s = Math.sin(rot), sh = (u, v, xx, yy) => shadeC(ramp === undefined ? R.wood : ramp, (s0 || 3.4) + (v < 0.03 ? -1.4 : 0.4), xx, yy);
    if (flat) poly3([[x - c * L / 2 + s * w, y, z - s * L / 2 - c * w], [x + c * L / 2 + s * w, y, z + s * L / 2 - c * w], [x + c * L / 2 - s * w, y, z + s * L / 2 + c * w], [x - c * L / 2 - s * w, y, z - s * L / 2 + c * w]], sh, { two: true });
    else poly3([[x - c * L / 2 + s * w, y - s * L / 2 - c * w, z], [x + c * L / 2 + s * w, y + s * L / 2 - c * w, z], [x + c * L / 2 - s * w, y + s * L / 2 + c * w, z], [x - c * L / 2 - s * w, y - s * L / 2 + c * w, z]], sh, { two: true });
  }
  function planks3(x, y, z, g, n, pow, seed, ramp, floor) {
    if (g < 0) return; floor = floor === undefined ? DY : floor;
    for (let k = 0; k < n; k++) {
      const a = ih(k, 1, seed) * TAU, v = (0.6 + ih(k, 2, seed) * 1.8) * pow, vy = (2.2 + ih(k, 3, seed) * 3.6) * pow;
      const L = 0.22 + ih(k, 4, seed) * 0.4, w = 0.035 + ih(k, 5, seed) * 0.03;
      const tl = (vy + Math.sqrt(vy * vy + 2 * 9.8 * Math.max(0, y - floor))) / 9.8, gg = Math.min(g, tl), landed = g >= tl;
      let px = x + Math.cos(a) * v * gg, pz = z + Math.sin(a) * v * gg * 0.6, py = y + vy * gg - 4.9 * gg * gg;
      if (Math.abs(pz) > 4.05 && floor === DY) { if (landed) continue; }          // off the edge: gone into the sea
      if (landed) { py = floor + 0.02; }
      plank3(px, py, pz, L, landed ? w * 2.4 : w, landed ? ih(k, 6, seed) * PI : ih(k, 6, seed) * TAU + gg * (7 + ih(k, 7, seed) * 9) * (k & 1 ? 1 : -1), landed, ramp, 2.8 + ih(k, 8, seed) * 1.4);
    }
  }
  // rings spreading on the water
  function ripple3(x, z, g, size) {
    if (g < 0 || g > 2.2) return; size = size || 1;
    for (let r = 0; r < 3; r++) { const gg = g - r * 0.25, rad = (0.25 + gg * 1.6) * size; if (gg <= 0) continue; for (let a = 0; a < TAU; a += 0.05) { if (bay(fl(a * 31), r * 3) > 1 - g / 2.2) continue; p3(x + Math.cos(a) * rad, HWY + 0.02, z + Math.sin(a) * rad * 0.9, r ? C('sea', 6) : C('hush', 4), 0.05); } }
  }
  // a warden fallen in, splashing about with only a head and an arm out of the water
  function swimmer(t, x, z, k, frozen) {
    const tt = frozen === undefined ? t : Math.min(t, frozen), b = Math.sin(tt * 3.1 + k) * 0.07;
    actor3('warden', { view: 'front', eyes: 'wide', armF: -1.2 + Math.sin(tt * 9 + k) * 0.6, armL: -1.9 - Math.sin(tt * 8 + k) * 0.5, bob: 0 }, x, HWY - 0.95 + b, z, { shadow: false });
    for (let q = 0; q < 10; q++) { const u = frac(ih(q, 1, 990 + k) + tt * 1.3); p3(x + (ih(q, 2, 990 + k) - 0.5) * 1.0, HWY + 0.1 + Math.sin(u * PI) * 0.5, z - 0.2 + (ih(q, 3, 990 + k) - 0.5) * 0.4, q & 1 ? WHITE : C('sea', 7), 0.07); }
  }
  // little musical notes from a whistler (screen space)
  const NOTE = ['.##', '.#.', '.#.', '##.', '##.'];
  function notes(x, y, t, t0, t1) { for (let k = 0; k < 4; k++) { const u = frac((t - t0) * 0.7 + k * 0.25); if (t < t0 + k * 0.35 || t > t1 + 0.6) continue; const nx = x + u * 26 + Math.sin(u * 9 + k) * 3, ny = y - u * 30; if (bay(fl(nx), fl(ny)) > 1.1 - u) continue; for (let j = 0; j < 5; j++) for (let i = 0; i < 3; i++) if (NOTE[j][i] === '#') { P(nx + i, ny + j, k & 1 ? C('teal', 6) : C('linen', 7)); } } }
  // a zig-zag bolt of lightning between two screen points
  function bolt(x0, y0, x1, y1, t, seed, c0, c1) { let px = x0, py = y0; const n = 7; for (let k = 1; k <= n; k++) { const u = k / n, j = k === n ? 0 : (ih(k, fl(t * 30), seed) - 0.5) * 14; const nx = lerp(x0, x1, u) - (y1 - y0) / Math.hypot(x1 - x0, y1 - y0 || 1) * j, ny = lerp(y0, y1, u) + (x1 - x0) / Math.hypot(x1 - x0, y1 - y0 || 1) * j; lineF(px, py, nx, ny, (x, y) => { P(x, y, c0); P(x + 1, y, c1); }); px = nx; py = ny; } }
  // dizzy stars round a head
  function dizzy(x, y, r, t) { for (let k = 0; k < 3; k++) { const a = t * 5 + k * TAU / 3; sparkle(Math.round(x + Math.cos(a) * r), Math.round(y + Math.sin(a) * r * 0.35), 2, WHITE, C('gold', 6)); } }
  // the hit-stop of this cut: the action's clock holds for d after each hit, then snaps on (beats stay where the audio has them)
  function hold(t, hits, d) { for (const h of hits) if (t >= h && t < h + d) return [h, true]; return [t, false]; }

  // ---------------------------------------------------------------- the Hush, painted: drained places become a pencil sketch on pale paper
  const SKB = new Uint8Array(NP);
  function sketchOver(amt, t, glyphs) {
    SKB.set(BUF);
    for (let y = LB; y < H - LB; y++) for (let x = 0; x < W; x++) {
      const a = amt(x, y); if (a <= 0) continue;
      const i = y * W + x, l = LUM[SKB[i]];
      if (a >= 0.85) {
        const lr = x < W - 1 ? LUM[SKB[i + 1]] : l, ld = y < H - 1 ? LUM[SKB[i + W]] : l, e = Math.max(Math.abs(l - lr), Math.abs(l - ld));
        if (e > 52) { BUF[i] = e > 90 ? C('night', 4) : C('stone', 5); continue; }
        // shading as hatching: the darker the old colour, the denser the pencil strokes
        const dk = 1 - l / 255, jit = (ih(x >> 3, y >> 3, 61) * 3) | 0;
        if ((dk > 0.42 && (x + y + jit) % 5 === 0) || (dk > 0.66 && (x - y + 400 + jit) % 5 === 0) || (dk > 0.84 && (x + jit) % 3 === 0)) { BUF[i] = C('stone', dk > 0.75 ? 4 : 5); continue; }
        BUF[i] = shadeC(R.hush, 3.0 + l / 255 * 4.4, x, y);
        continue;
      }
      tintI(i, x, y, T_HUSH, a);
      if (glyphs && a > 0.4 && ih(x >> 1, y >> 1, fl(t * 14)) < 0.035) BUF[i] = ih(x, y, 3) < 0.7 ? WHITE : C('crimson', 5);
    }
  }
  function sketchWorld(t, amount, glyphs) { sketchOver((x, y) => { const p = worldAt(y * W + x, x, y); return amount(p[0], p[1], p[2], x, y); }, t, glyphs); }

  // ---------------------------------------------------------------- the morning harbour, with whatever has changed by time t
  const HUSH_T = 228.5;                                        // the moment everything stops
  function harbour(t, opt) {
    opt = opt || {};
    drawHarbour(t, Object.assign({ lights: [], freeze: t > HUSH_T ? HUSH_T : undefined, keeperGone: true }, opt));
    ink(2);
    if (!opt.noGulls) gulls(t, 12, 2, 7, 16, t > HUSH_T ? HUSH_T : undefined);
  }
  // the hush over the harbour: first a faint chill, then a ring spreading from under the sigil
  const HUSH_O = [40, 0, 62], hushR = (t) => Math.min(60, Math.max(0, (t - 246.0) * 6));
  function harbourHush(t, extra) {
    if (t < HUSH_T) return;
    const R0 = hushR(t), chill = 0.16 * lin(HUSH_T, 231, t);
    sketchWorld(t, (wx, wy, wz) => {
      const d = Math.hypot(wx - HUSH_O[0], wz - HUSH_O[2]);
      let a = chill;
      if (R0 > 0) a = Math.max(a, d < R0 - 3 ? 1 : d < R0 ? 0.55 : 0);
      if (extra) a = Math.max(a, extra(wx, wy, wz));
      return a;
    }, R0 > 0);
  }

  // ---------------------------------------------------------------- 24 — the dock at morning: Tamo and a crate; something falls out of the sky onto him (2:56)
  const IMPACT = 178.0, IX = -3.0, IZ = 0.4;
  const TWALK = K({ t: 176.0, x: -6.7 }, { t: 177.45, x: -3.55, e: 'l' }, { t: 177.85, x: -3.05, e: 'o' });
  // the last fish, thrown straight up by the crash, comes down on his face at 180.5
  const FISH_UP = 180.5;
  function crateFish(t, skip0) {
    const g = t - IMPACT - 0.1; if (g < 0) return;
    for (let k = 1; k < 10; k++) {
      const a = ih(k, 1, 401) * TAU, vh = 0.8 + ih(k, 2, 401) * 2.0, vy = 2.6 + ih(k, 3, 401) * 3.2, y0 = DY + 0.8;
      const tl = (vy + Math.sqrt(vy * vy + 2 * 9.8 * (y0 - DY - 0.06))) / 9.8, gg = Math.min(g, tl);
      const x = IX + 0.35 + Math.cos(a) * vh * gg, z = IZ + Math.sin(a) * vh * gg * 0.5, y = y0 + vy * gg - 4.9 * gg * gg;
      if (Math.abs(z) > 4.0) continue;
      const landed = g >= tl, f = landed ? Math.sin(t * (14 + k) + k) * Math.max(0.2, 1 - (g - tl) * 0.3) : 0;
      fish3(x, landed ? DY + 0.07 + Math.abs(f) * 0.06 : y, z, landed ? ih(k, 4, 401) * 0.6 - 0.3 + f * 0.3 : gg * 9 + k, f);
    }
  }
  function fishUp(t) { const g = t - IMPACT - 0.1; if (g < 0 || t >= FISH_UP) return; const u = g / (FISH_UP - IMPACT - 0.1); fish3(lerp(IX + 0.35, IX - 0.7, u), DY + 0.8 + 12.0 * g - 4.9 * g * g, IZ, g * 7, 0); }
  function crateWreck(t) { planks3(IX + 0.35, DY + 0.75, IZ, t - IMPACT - 0.1, 14, 1.0, 402); crateFish(t); }
  shot(176.0, 182.0, (lt, t) => {
    const g = t - IMPACT, ge = g - 0.1;
    const wide = t < 178.45;
    if (wide) { const cx = lerp(-6.4, -3.0, sstep(176.0, 177.9, t)), up = sstep(177.35, 177.85, t) * (1 - sstep(178.05, 178.4, t)); lookAt(cx - 1.4, 1.8, -9.2, cx + 0.5 + up * 0.6, 1.3 + up * 0.9, IZ + 0.4, 46); }
    else { const u = lin(178.45, 182, t); lookAt(IX - 2.6 + u * 0.5, 1.55, -6.6 + u * 0.8, IX + 0.35, 1.2, IZ + 0.3, 46); }
    harbour(t);
    if (g < 0) {
      // he walks along whistling, a crate hugged to his chest; a shadow grows round him and he looks up
      const x = trk(TWALK, t).x, walking = t < 177.8, ph = x * WALKK, bob = walking ? bobOf(ph) : 0, look = sstep(177.48, 177.66, t), up = sstep(177.82, 177.95, t);
      const r = actor3('tamo', { view: 'side', walk: walking ? ph : undefined, bob, armF: lerp(0.05, -1.25, up), armB: lerp(0.25, -1.2, up), eyes: look > 0.5 ? 'wide' : 'closed', brows: look > 0.5 ? 'up' : 'n', smile: look > 0.5 ? 0 : 0.7, mouth: look > 0.5 ? 0.75 : 0.22, lean: -1.6 * look }, x, DY, IZ, {});
      crate3(x + 0.4 - look * 0.08, DY + 0.32 - bob / 26 + up * 0.75, IZ, 0.52);
      if (r && look < 0.5) notes(r.head[0] + 10 * r.S, r.head[1] + 2 * r.S, t, 176.2, 177.5);
      // the fall: a streak out of the sky with a girl at the head of it, and her shadow on the planks
      const u = lin(177.4, IMPACT, t);
      if (u > 0) {
        const e = (q) => Math.pow(q, 1.25), fx = (q) => lerp(IX + 6.0, IX + 0.1, e(q)), fy = (q) => lerp(8.5, DY + 1.1, e(q)), fz = (q) => lerp(IZ + 2.5, IZ, e(q));
        contactShadow(IX + 0.1, DY, IZ, 0.15 + u * 0.75, 0.8 * Math.min(1, u * 1.4));
        let pp = null; for (let j = 14; j >= 0; j--) { const q = Math.max(0, u - j * 0.03), p = proj(fx(q), fy(q), fz(q)); if (!p) continue; const c = [p.x, p.y]; if (pp) { const w = Math.max(1.5, 8 - j * 0.45); lineF(pp[0], pp[1], c[0], c[1], (xx, yy) => { for (let d = -w; d <= w; d++) if (bay(xx + d, yy) < 1.1 - j / 15) P(xx + d, yy, Math.abs(d) < w * 0.3 ? WHITE : Math.abs(d) < w * 0.65 ? C('gold', 6) : C('indigo', 5)); }); } pp = c; }
        spin('kaira', { view: 'front', eyes: 'wide', brows: 'worried', mouth: 0.8, armF: -1.7 + Math.sin(t * 30) * 0.2, armL: -1.4, wind: 7, seed: 0.6 }, fx(u), fy(u), fz(u), Math.PI + 0.75, { gy: DY });
        const hp = proj(fx(u), fy(u), fz(u)); if (hp) glow(hp.x, hp.y, 26, T_GOLD, 0.45);
      }
    } else {
      // the pile-up: Tamo flat on his back, the girl sat on top of him seeing stars; fish raining down
      const sit = eob(lin(181.1, 181.6, t)), front = t > 181.62;
      crateWreck(t); fishUp(t);
      dust3(IX, IZ, ge, 1.5, 403);
      let rT;
      const tamoO = { view: 'side', bob: 0, eyes: t > FISH_UP && t < 181.2 ? 'wide' : 'closed', brows: 'worried', mouth: t > FISH_UP && t < 181.0 ? 0.6 : 0.3, armF: lerp(-2.7, 1.2, sit), armB: lerp(-2.3, 1.9, sit), stride: (t > 179.3 && t < 179.5) || (t > 179.9 && t < 180.05) ? 1.5 : 0 };
      if (front) rT = actor3('tamo', { view: 'front', crouch: 1.2, eyes: 'narrow', brows: 'angry', smile: -0.6, armF: 1.3, armL: 1.9, bob: 0 }, IX, DY, IZ, {});
      else rT = atFeet('tamo', tamoO, lerp(IX + 0.45, IX, sit), lerp(DY + 0.38, DY, Math.min(1, sit)), IZ, lerp(-PI / 2, -0.05, Math.min(1, sit)), { gy: DY, sx: IX - 0.2, sr: 0.9 });
      // the fish that went up comes down on his face, and stays on his head
      if (rT && t >= FISH_UP) { const a = front ? 0 : lerp(-PI / 2, 0, Math.min(1, sit)), hx = rT.head[0] + Math.sin(a) * 10 * rT.S, hy = rT.head[1] - Math.cos(a) * 10 * rT.S - (front ? 2 * rT.S : 0); fishAt(hx, hy, rT.z - 0.1, 8 * rT.S / 3, a + (front ? 0.15 : 0) + Math.sin(t * 20) * 0.05, Math.sin(t * 22)); }
      if (t >= FISH_UP && t < FISH_UP + 0.3 && rT) { const p = rT.head; for (let k = 0; k < 10; k++) { const a = -PI * ih(k, 1, 405), v = 30 + ih(k, 2, 405) * 50, gg = t - FISH_UP; P(p[0] - 10 * rT.S + Math.cos(a) * v * gg, p[1] + Math.sin(a) * v * gg + 120 * gg * gg, k & 1 ? WHITE : C('sea', 7)); } }
      // her: squashed by the landing, dazed, then a hop off him onto her knees
      const hop = lin(181.0, 181.35, t);
      if (hop <= 0) {
        const rK = actor3('kaira', { view: 'front', crouch: g < 0.15 ? 1.6 : g < 0.3 ? 0.6 : 1.0, eyes: t > 180.8 ? 'open' : 'closed', brows: 'worried', mouth: t > 180.8 ? 0.2 : 0.35, armF: g < 0.3 ? -0.8 : 0.5, armL: g < 0.3 ? -2.2 : 2.6, look: t > 180.8 ? (t < 180.9 ? -2 : 2) : Math.sin(t * 5) * 1.4, wind: 1, seed: 0.5, bob: 0 }, IX - 0.12, DY + 0.6, IZ - 0.12, { shadow: false });
        if (rK && g > 0.4 && t < 180.85) dizzy(rK.head[0], rK.head[1] - 12 * rK.S, 9 * rK.S, t);
      } else if (hop < 1) {
        actor3('kaira', { view: 'side', air: true, eyes: 'open', brows: 'worried', armF: -1.0, wind: 3, seed: 0.5 }, lerp(IX - 0.12, IX + 1.6, hop), lerp(DY + 0.6, DY, hop) + Math.sin(hop * PI) * 0.55, lerp(IZ - 0.12, IZ + 0.2, hop), { flip: true, gy: DY });
      } else {
        const sq = lin(181.35, 181.6, t);
        actor3('kaira', { view: 'side', kneel: sq >= 1, crouch: sq < 1 ? lerp(1.4, 0.4, sq) : 0, eyes: 'open', brows: 'worried', armF: -2.0, smile: 0.2, seed: 0.5, blade2: 2.4, bob: 0 }, IX + 1.6, DY, IZ + 0.2, { flip: true });
      }
      if (g < 0.5) { const p = proj(IX, DY + 0.8, IZ); if (p) hitFx(p.x, p.y, g, 1.5, [WHITE, C('gold', 6)]); }
      if (!wide && t < 178.6) shk(3);
    }
  });

  // ---------------------------------------------------------------- 25 — "that was the GOOD crate!" / "you should run" / "run from wh—" THUD THUD THUD (3:02)
  const THUDS = [188.6, 188.8, 189.0], WDX = [-7.2, -6.2, -5.2], WDZ = [1.6, 2.1, 2.6];
  // the wreck as it lies on the planks
  function wreckRest(t) { crateWreck(t); }
  function fishOnHead(r, t, extra) { if (!r) return; fishAt(r.head[0] + r.S, r.head[1] - 12 * r.S - (extra || 0), r.z - 0.1, 8 * r.S / 3, 0.15 + Math.sin(t * 20) * 0.05, Math.sin(t * 22)); }
  function wardenDrop(t, k, x, z, opt) {
    opt = opt || {}; const g = t - THUDS[k];
    if (g < -0.6) return null;
    if (g < 0) {
      const y = DY + (-g) * 30, p = proj(x, y, z), q = proj(x, y + 6, z);
      if (p && q) lineF(q.x, q.y, p.x, p.y, (xx, yy, u) => { if (bay(xx, yy) < u) { P(xx - 1, yy, C('indigo', 6)); P(xx, yy, WHITE); P(xx + 1, yy, C('linen', 6)); } });
      return actor3('warden', { view: 'front', air: true, spear: -1.5, armL: -2.0 }, x, y, z, { gy: DY });
    }
    const land = eoc(lin(0, 0.35, g));
    if (g < 0.3) { const p = proj(x, DY, z); if (p) shockRing(p.x, p.y, 3 + g * 110, 1 + g * 26, 2, [WHITE, C('linen', 6), C('linen', 4)], 1 - g / 0.3); shk(3 * (1 - g / 0.3)); }
    dust3(x, z, g, 0.9, 411 + k); planks3(x, DY, z, g, 2, 0.5, 415 + k);
    return actor3('warden', Object.assign({ view: 'front', crouch: g < 0.35 ? 1.4 * (1 - land) : 0, spear: lerp(-1.5, -1.25, land), armL: 1.9, bob: g < 0.35 ? 0 : undefined }, opt.pose || {}), x, DY, z, opt.o || {});
  }
  shot(182.0, 197.0, (lt, t) => {
    if (t < 187.5) {
      // the two of them sat in the wreck: a slow push in
      const u = lin(182, 187.5, t);
      lookAt(-2.3, 1.35, -6.6 + u * 0.7, -2.25, 0.98, 0.5, 46);
      harbour(t); wreckRest(t);
      const tk = talking('tamo', t), good = t > 183.35 && t < 184.0, point = t > 184.0 && t < 184.6;
      const rT = actor3('tamo', {
        view: 'front', crouch: 1.2, eyes: blink(t, 21) ? 'closed' : t > 186.2 ? 'wide' : 'open', brows: t > 186.2 ? 'up' : 'angry', mouth: mouth('tamo', t), smile: -0.6,
        armF: good ? -0.9 + Math.sin(t * 22) * 0.25 : tk ? -0.3 + Math.sin(t * 9) * 0.5 : point ? 0.2 : t > 184.6 ? 2.6 : 1.3, armL: good ? -2.2 - Math.sin(t * 22) * 0.25 : t > 184.6 ? 0.55 : 1.9,
        look: t < 182.5 ? (fl(t * 8) % 2 ? 1 : -1) : t > 184.6 ? 1 : 0, bob: good ? (fl(t * 12) % 2 ? -1 : 0) : undefined,
      }, IX, DY, IZ, {});
      fishOnHead(rT, t, good ? 2 : 0);
      // Kaira: sheepish on her knees; she springs up; "Sorry! Not sorry! You should run."
      const pop = lin(184.72, 184.95, t), land = lin(184.95, 185.15, t), fr = t > 184.82;
      const sorry = t > 185.0 && t < 185.6, notS = t > 185.6 && t < 186.2, run = t > 186.2 && t < 187.3;
      const kO = fr ? {
        view: 'front', crouch: land < 1 ? 0.8 * (1 - land) : sorry ? 0.4 : 0, air: pop > 0 && pop < 1, eyes: blink(t, 22) ? 'closed' : notS ? 'narrow' : 'open', brows: run ? 'up' : sorry ? 'worried' : 'n',
        mouth: mouth('kaira', t), smile: notS ? 0.9 : 0.3, armF: sorry ? 2.4 : notS ? -0.7 : run ? 1.2 : 1.25, armL: sorry ? 0.75 : run ? PI + 0.35 : 1.9, seed: 0.5, blade2: 2.4, look: run ? -2 : 0, bob: sorry ? 1 : undefined,
      } : { view: 'side', kneel: t < 184.6, crouch: t < 184.6 ? 0 : 1.3, eyes: blink(t, 22) ? 'closed' : 'open', brows: 'worried', smile: 0.3, armF: -2.0 + Math.sin(t * 6) * 0.15, seed: 0.5, blade2: 2.4, mouth: 0, bob: 0 };
      actor3('kaira', kO, IX + 1.6, DY + (pop > 0 && pop < 1 ? Math.sin(pop * PI) * 0.22 : 0), IZ + 0.2, { flip: !fr, gy: DY });
    } else if (t < 189.4) {
      // Tamo, closer: "run from wh—" … and three shapes land behind him
      lookAt(0.3, 1.4, -4.4, -4.35, 1.1, 1.6, 46);
      harbour(t); wreckRest(t);
      for (let k = 0; k < 3; k++) wardenDrop(t, k, WDX[k], WDZ[k]);
      const jump = t > 188.6 && t < 188.78 ? Math.sin(lin(188.6, 188.78, t) * PI) * 0.12 : 0, startled = t > 188.6;
      const rT = actor3('tamo', { view: 'front', crouch: 1.2, eyes: startled ? 'wide' : blink(t, 21) ? 'closed' : 'narrow', brows: startled ? 'up' : 'angry', mouth: startled ? 0.5 : mouth('tamo', t), smile: -0.4, armF: t < 188.5 ? 0.35 : 1.0, armL: t < 188.5 ? 2.75 : 2.2, look: startled ? -2 : 1, bob: 0 }, IX, DY + jump, IZ, { gy: DY });
      fishOnHead(rT, t, jump > 0 ? 0 : 0);
    } else if (t < 191.6) {
      // over his shoulder, low: the three of them; the spears come down together, and a step
      const u = lin(189.4, 191.6, t);
      lookAt(0.6 + u * 0.2, 1.15, -3.3 + u * 0.3, -6.6, 1.25, 1.2, 46);
      harbour(t); wreckRest(t);
      const rise = sstep(189.75, 189.9, t), lower = eoc(lin(189.95, 190.15, t)), step = sstep(190.6, 191.0, t);
      for (let k = 0; k < 3; k++) {
        const x = WDX[k] + step * 0.35, ph = (x - WDX[k]) * WALKK * 2 + (k & 1) * PI;
        actor3('warden', { view: 'front', spear: lower > 0 ? lerp(-1.75, -0.55, lower) : lerp(-1.25, -1.75, rise), armL: 1.9 - lower * 0.4, walk: step > 0 && step < 1 ? ph : undefined, eyes: 'open' }, x, DY, WDZ[k], { rim: { side: 1, T: T_GOLD, a: 0.3 } });
        if (lower > 0 && lower < 1) { const p = proj(x, DY + 1.0, WDZ[k]); if (p && k === 1) for (let q = 0; q < 6; q++) P(p.x + 20 + q * 3, p.y - 14 + q * 2, WHITE); }
      }
      actor3('tamo', { view: 'back', crouch: 1.2, bob: 0 }, IX, DY, IZ, { dark: 1 });
    } else {
      // "three grown-ups… against one girl?" — he gets up, flicks the fish away, and walks off toward the anchor
      const cx = lerp(-3.7, -0.6, sstep(194.9, 197.3, t));
      lookAt(cx, 1.6, -8.3, cx, 1.0, 1.0, 50);
      harbour(t); wreckRest(t);
      for (let k = 0; k < 3; k++) {
        const turn = t > 195.2 + k * 0.15;
        actor3('warden', { view: turn ? 'side' : 'front', spear: turn ? 0.15 : -0.55, armL: 1.5, eyes: 'open' }, WDX[k] + 0.35, DY, WDZ[k], { flip: false });
      }
      const ant = lin(192.0, 192.25, t), push = lin(192.25, 192.6, t), settle = lin(192.6, 192.85, t);
      const crouch = t < 192.0 ? 1.2 : ant < 1 ? lerp(1.2, 1.6, ant) : push < 1 ? lerp(1.6, 0, eoc(push)) : settle < 1 ? Math.sin(settle * PI) * 0.35 : 0;
      const hopY = push > 0 && push < 1 ? Math.sin(push * PI) * 0.1 : 0;
      const WK = K({ t: 195.0, x: IX }, { t: 195.45, x: IX + 0.55, e: 'i' }, { t: 197.0, x: IX + 4.0, e: 'l' }), tx = trk(WK, t).x, walking = t > 195.0;
      const flick = lin(193.55, 193.85, t), roll = t > 194.2 && t < 194.9;
      const side = t > 194.85;
      const tO = side ? { view: 'side', walk: walking ? (tx - IX) * WALKK : undefined, eyes: blink(t, 23) ? 'closed' : 'narrow', brows: 'angry', smile: 0.5, mouth: 0 }
        : { view: 'front', crouch, eyes: blink(t, 23) ? 'closed' : 'narrow', brows: 'angry', mouth: mouth('tamo', t), smile: t > 194.0 ? 0.6 : 0,
          armF: flick > 0 && flick < 1 ? lerp(0.4, -1.7, eoc(flick)) : flick >= 1 && t < 194.2 ? -1.5 : roll ? -0.4 + Math.cos((t - 194.2) * 13) * 0.9 : t > 192.9 && t < 193.5 ? 0.6 : 1.3,
          armL: t > 192.9 && t < 193.5 ? PI + 0.1 : t < 192.0 ? 1.9 : 2.0, look: t < 191.9 ? -2 : t < 192.2 ? 2 : t > 192.9 && t < 193.5 ? 2 : 0, bob: ant > 0 && settle < 1 ? 0 : undefined };
      const rT = actor3('tamo', tO, tx, DY + hopY, IZ, { gy: DY });
      if (flick <= 0) fishOnHead(rT, t);
      else if (t < 194.35) { const u = lin(193.7, 194.35, t), p = proj(lerp(IX + 0.05, IX + 1.2, u), lerp(DY + 1.85, DY + 0.2, u) + Math.sin(u * PI) * 1.4, lerp(IZ, 4.6, u)); if (p) fishAt(p.x, p.y, p.z - 0.1, Math.max(3, CAM.F / p.z * 0.17), u * 14, 0); }
      splash3(IX + 1.2, HWY, 4.6, t - 194.35, 0.35); ripple3(IX + 1.2, 4.6, t - 194.35, 0.5);
      // Kaira steps back out of his way and turns to watch him go
      const kz = lerp(IZ + 0.2, IZ + 1.2, sstep(194.5, 195.1, t)), kturn = t > 195.5;
      actor3('kaira', { view: kturn ? 'side' : 'front', walk: t > 194.5 && t < 195.1 ? (kz - IZ) * WALKK : undefined, eyes: blink(t, 24) ? 'closed' : 'wide', brows: 'worried', seed: 0.5, blade2: 2.4, look: t < 193.0 ? -1 : 1, armF: kturn ? 1.3 : 2.4, armL: 0.8 }, IX + 1.6, DY, kz, { flip: false });
    }
  });

  // ---------------------------------------------------------------- 26 — the anchor: "that anchor hasn't moved in a hundred years—" … it moves (3:17)
  const GRIP = 199.5, RIP = 203.0, TAX = ANCHOR_X - 0.62, TAZ = ANCHOR_Z - 0.06;
  const seaPull = (t) => -0.4 - 1.8 * sstep(200.3, 202.8, t) * (t < RIP ? 1 : 0) + (t >= RIP ? -1.8 * (1 - eoc(lin(RIP, RIP + 0.9, t))) + 0.45 * Math.sin(lin(RIP + 0.4, RIP + 1.8, t) * PI) : 0);
  // cracks in the boards round the anchor's foot, growing with the strain
  function cracks(x, z, amt, t) {
    if (amt <= 0) return;
    for (let k = 0; k < 9; k++) { const a = ih(k, 1, 421) * TAU, L = amt * (0.5 + ih(k, 2, 421) * 1.1); let px = x, pz = z; for (let s = 1; s <= 5; s++) { const u = s / 5, nx = x + Math.cos(a + (ih(k, s, 422) - 0.5) * 0.7) * L * u, nz = z + Math.sin(a + (ih(k, s, 423) - 0.5) * 0.7) * L * u * 0.7; l3(px, DY + 0.005, pz, nx, DY + 0.005, nz, C('wood', 0), s < 3 ? 2 : 1); px = nx; pz = nz; } }
  }
  const DOCKER_X = 7.9, DOCKER_Z = 0.1;
  function dockerStack() { crate3(8.7, DY, -0.3, 0.75); crate3(8.65, DY + 0.75, -0.35, 0.6); barrel3(8.9, 0.65, 0.8); }
  shot(197.0, 214.0, (lt, t) => {
    if (t < GRIP) {
      // he strides up to it; the dockhand, leaning on his crates, warns him off
      const cx = lerp(3.4, 5.0, sstep(197.0, 199.2, t));
      lookAt(cx - 0.6, 1.75, -7.4, cx + 0.6, 1.15, 1.0, 52);
      harbour(t);
      anchorAt3(ANCHOR_X, DY + 1.0, ANCHOR_Z, PI / 2, 0);
      dockerStack();
      const dk = talking('docker', t);
      actor3('docker', { view: 'side', eyes: blink(t, 25) ? 'closed' : 'half', mouth: mouth('docker', t), armF: dk && t < 198.4 ? -0.5 + Math.sin(t * 11) * 0.35 : 1.0, armB: 1.6, lean: -1, smile: -0.3 }, DOCKER_X, DY, DOCKER_Z, { flip: true });
      const WK = K({ t: 197.0, x: 1.3, z: 0.6 }, { t: 198.45, x: TAX - 0.45, z: TAZ - 0.05, e: 'l' }, { t: 198.85, x: TAX, z: TAZ, e: 'o' }), w = trk(WK, t), walking = t < 198.8;
      const spit = t > 198.95 && t < 199.15, rub = t > 199.15 && t < 199.32, reach = sstep(199.3, 199.5, t);
      const rT = actor3('tamo', { view: 'side', walk: walking ? (w.x - 1.3) * WALKK : undefined, eyes: 'narrow', brows: 'angry', mouth: spit ? 0.5 : 0, armF: spit ? -0.7 : rub ? -0.1 + Math.sin(t * 40) * 0.25 : walking ? undefined : lerp(1.0, 0.0, reach), armB: rub ? -0.1 - Math.sin(t * 40) * 0.25 : walking ? undefined : lerp(1.6, 0.15, reach), crouch: reach * 0.5, lean: t > 198.85 && t < 198.95 ? 1 : 0, reach: reach * 1.5 }, w.x, DY, w.z, {});
      if (rT && spit) { const p = rT.head; P(p[0] + 9 * rT.S, p[1] + 6 * rT.S, WHITE); }
    } else if (t < RIP + 0.2) {
      // low, close: his grip; the planks groan; the sea draws back out of the harbour
      const sh = sstep(GRIP + 0.1, RIP - 0.1, t), u = t - RIP, push = sstep(GRIP, RIP, t);
      lookAt(ANCHOR_X - 3.1 + push * 0.5, 1.35, -2.9 + push * 0.7, ANCHOR_X - 0.35, 1.05, ANCHOR_Z, 50);
      harbour(t, { waterY: seaPull(t) });
      cracks(ANCHOR_X, ANCHOR_Z, sh * 1.3 + (u > 0 ? 0.5 : 0), t);
      const lift = u > 0 ? eoc(lin(0, 0.2, u)) * 0.7 : sh > 0.75 ? Math.abs(Math.sin(t * 23)) * 0.03 * sh : 0;
      const jit = (ih(fl(t * 30), 1, 7) - 0.5) * 0.025 * sh;
      anchorAt3(ANCHOR_X, DY + 1.0 + lift, ANCHOR_Z, PI / 2 + Math.sin(t * 41) * 0.02 * sh, sh > 0.6 ? 1 : 0);
      const rT = actor3('tamo', { view: 'side', crouch: 0.5 + sh * 0.7 - (u > 0 ? lin(0, 0.15, u) * 0.6 : 0), armF: -0.05 - lift * 0.8, armB: 0.1 - lift * 0.8, reach: 1.5, lean: -1.6 * sh, eyes: sh > 0.7 ? 'glow' : 'narrow', glow: C('teal', 7), brows: 'angry', mouth: sh > 0.4 ? 0.9 : 0, smile: -1, bob: 0 }, TAX + jit, DY, TAZ, { rim: { side: 1, T: T_TEAL, a: sh * 0.8 } });
      if (sh > 0.35) aura(t, [C('teal', 3), C('teal', 5), C('teal', 6), C('teal', 7)], 3 + sh * 7, { sparks: 22 });
      // sweat, and splinters starting out of the cracks
      if (rT && sh > 0.3) for (let k = 0; k < 3; k++) { const g = frac(t * 1.6 + k / 3); P(rT.head[0] - 6 * rT.S - g * 30, rT.head[1] - 6 * rT.S - g * 20 + g * g * 50, C('sea', 7)); }
      for (let k = 0; k < 12 * sh; k++) { const gg = frac(t * 0.9 + ih(k, 1, 424)), a = ih(k, 2, 424) * TAU, r = 0.4 + ih(k, 3, 424) * 1.2 * sh; p3(ANCHOR_X + Math.cos(a) * r, DY + gg * 1.4 * (0.5 + ih(k, 4, 424)), ANCHOR_Z + Math.sin(a) * r * 0.7, gg < 0.5 ? C('wood', 5) : C('teal', 6), 0.05); }
      // water climbing out of the sea in strands, winding in toward the anchor
      for (let k = 0; k < 110 * sh; k++) { const ph = ih(k, 1, 411) * TAU + t * 1.8, rr = 2.5 + ih(k, 2, 411) * 5 - (t - GRIP) * 0.5, fy = frac(ih(k, 3, 411) + t * 0.45); p3(ANCHOR_X + Math.cos(ph) * Math.max(0.6, rr), lerp(seaPull(t), DY + 2.4, fy), ANCHOR_Z + Math.sin(ph) * Math.max(0.6, rr), k & 1 ? C('teal', 7) : C('sea', 7), 0.07); }
      shk(0.4 + sh * 2.2);
      // the rip
      if (u >= 0) { planks3(ANCHOR_X, DY + 0.1, ANCHOR_Z, u, 16, 1.2, 425); splash3(ANCHOR_X, DY, ANCHOR_Z, u, 1.3); shk(6); if (u < 0.07) { const p = proj(ANCHOR_X, DY + 0.6, ANCHOR_Z); impactFrame(p ? p.x : 240, p ? p.y : 135, 1); } }
    } else if (t < 209.5) {
      // the hero shot, from the planks: the anchor held high as the sea comes roaring back
      const u = t - RIP;
      lookAt(ANCHOR_X - 3.9 + u * 0.04, 0.7, -4.3 - u * 0.03, ANCHOR_X - 0.55, 1.5, ANCHOR_Z, 54);
      harbour(t, { waterY: seaPull(t) });
      planks3(ANCHOR_X, DY + 0.1, ANCHOR_Z, u, 16, 1.2, 425);
      cracks(ANCHOR_X, ANCHOR_Z, 1.8, t);
      const hole = proj(ANCHOR_X, DY + 0.01, ANCHOR_Z); if (hole) { const r = CAM.F / hole.z * 0.35; for (let yy = -r * 0.3; yy <= r * 0.3; yy++) for (let xx = -r; xx <= r; xx++) if ((xx / r) ** 2 + (yy / (r * 0.3)) ** 2 < 1) { const X = fl(hole.x + xx), Y = fl(hole.y + yy), i = Y * W + X; if (X >= 0 && Y >= 0 && X < W && Y < H && ZB[i] > hole.z - 0.5) BUF[i] = C('night', 1); } }
      const settle = eoc(lin(0.2, 0.75, u)), lower = eio(lin(205.0, 205.5, t)), front = t > 205.45;
      const smirk = t > 207.0, glowEyes = u < 2.2;
      let rT, an;
      if (!front) {
        rT = actor3('tamo', { view: 'side', crouch: (1 - settle) * 0.9, armF: lerp(-1.35, -0.55, lower), armB: lerp(-1.1, 1.7, lower), eyes: glowEyes ? 'glow' : 'narrow', glow: C('teal', 7), brows: 'angry', mouth: u < 0.6 ? 0.9 : 0, wind: 3, bob: 0 }, TAX, DY, TAZ, { rim: { side: 1, T: T_TEAL, a: 0.4 } });
        an = heldAnchor(rT, lerp(-0.8, -2.55, lower), u < 2.4 ? 1 : 0, lower > 0.5);
      } else {
        rT = actor3('tamo', { view: 'front', armF: -1.5, armL: smirk && t < 207.8 ? PI + 0.3 : 1.9, eyes: blink(t, 26) ? 'closed' : 'narrow', brows: 'angry', mouth: mouth('tamo', t), smile: smirk ? 0.85 : 0.35, wind: 2 }, TAX, DY, TAZ, { rim: { side: 1, T: T_TEAL, a: 0.3 } });
        an = heldAnchor(rT, -2.3, 0, true);
      }
      if (u < 3.0) aura(t, [C('teal', 3), C('teal', 5), C('teal', 6), C('teal', 7)], 6 * (1 - u / 3.4), { sparks: 26 });
      if (an && t > 207.45 && t < 207.9) { const g2 = (t - 207.45) / 0.45; sparkle(Math.round(an.tip[0]), Math.round(an.tip[1]), 2 + Math.sin(g2 * PI) * 9, WHITE, C('teal', 7)); }
      // the sea thrown up comes down as rain; a crest of the returning wave bursts over the far edge
      for (let k = 0; k < 90; k++) { const fall = u * (5 + ih(k, 1, 426) * 4) - ih(k, 2, 426) * 3; if (fall < 0 || u > 3.5) continue; const y = DY + 7 - fall; if (y < DY) continue; p3(ANCHOR_X - 3 + ih(k, 3, 426) * 6, y, ANCHOR_Z - 1.5 + ih(k, 4, 426) * 4, k % 3 ? C('sea', 7) : WHITE, 0.06); }
      for (let q = 0; q < 4; q++) splash3(ANCHOR_X - 3 + q * 2, -0.2, 4.2, u - 0.45 - q * 0.08, 0.9);
      if (u < 0.5) shk(4 * (1 - u * 2));
    } else {
      // the wardens look at each other … and come anyway; he drags the anchor out to meet them
      lookAt(1.9, 2.0, -8.6, 1.1, 1.05, 1.3, 52);
      harbour(t);
      cracks(ANCHOR_X, ANCHOR_Z, 1.8, t); planks3(ANCHOR_X, DY + 0.1, ANCHOR_Z, t - RIP, 16, 1.2, 425);
      const TK = K({ t: 209.5, x: TAX, z: TAZ }, { t: 210.0, x: TAX - 0.6, z: 1.2, e: 'i' }, { t: 212.0, x: 0.75, z: 1.0, e: 'l' }, { t: 212.5, x: 0.6, z: 1.0, e: 'o' }), tp = trk(TK, t), walking = t < 212.4;
      const ready = eio(lin(212.6, 213.2, t));
      const rT = actor3('tamo', { view: 'side', walk: walking ? (TAX - tp.x) * WALKK : undefined, armF: walking ? 1.0 : lerp(1.0, 2.1, ready), armB: walking ? undefined : 1.8, crouch: ready * 0.6, eyes: blink(t, 27) ? 'closed' : 'narrow', brows: 'angry', smile: 0.4, wind: 2 }, tp.x, DY, tp.z, { flip: true });
      const an = heldAnchor(rT, angF(lerp(2.75, 2.5, ready), true), 0, true);
      // the drag: sparks where the flukes scrape the planks, and a pale groove behind
      if (an && walking && t > 210.0) { for (let k = 0; k < 6; k++) { const g = frac(t * 4 + k / 6); P(an.tip[0] + g * 20 + ih(k, fl(t * 30), 427) * 6, an.tip[1] - g * 14 + g * g * 30, k & 1 ? C('gold', 7) : WHITE); } }
      if (t > 210.0) l3(Math.min(TAX - 1.4, tp.x + 1.25), DY + 0.005, tp.z - 0.05, TAX - 1.4, DY + 0.005, TAZ - 0.05, C('wood', 6), 1);
      // three wardens: a look between them, a nod, and a charge — one of them circles out round the far side
      const conf = t > 210.4 && t < 211.3, nod = t > 211.0 && t < 211.3;
      const paths = [
        K({ t: 209.5, x: -4.0, z: 1.0 }, { t: 210.4, x: -3.0, e: 'o' }, { t: 211.4, x: -3.0 }, { t: 212.3, x: -1.0, z: 3.0, e: 'i' }, { t: 213.2, x: 2.4, z: 3.1, e: 'l' }, { t: 214.0, x: 5.6, z: 1.0, e: 'l' }),
        K({ t: 209.5, x: -5.4, z: 1.7 }, { t: 210.4, x: -4.2, e: 'o' }, { t: 211.4, x: -4.2 }, { t: 212.6, x: -3.3, e: 'i' }, { t: 214.0, x: -3.6, z: 1.4 }),
        K({ t: 209.5, x: -5.0, z: 0.4 }, { t: 210.4, x: -3.7, e: 'o' }, { t: 211.4, x: -3.7 }, { t: 212.6, x: -2.6, z: 0.8, e: 'i' }, { t: 214.0, x: -2.9, z: 0.9 }),
      ];
      for (let k = 0; k < 3; k++) {
        const w = trk(paths[k], t), w0 = trk(paths[k], t - 0.05), moving = Math.abs(w.x - w0.x) + Math.abs(w.z - w0.z) > 0.004, fast = t > 211.4;
        const lookL = conf && (k === 0 ? fl(t * 3) % 2 === 0 : k === 1 ? false : true);
        actor3('warden', { view: 'side', run: moving && fast ? (w.x + w.z) * RUNK : undefined, walk: moving && !fast ? (w.x + w.z) * WALKK : undefined, spear: fast ? 0.05 : -0.5, crouch: nod ? 0.4 : 0, eyes: 'open' }, w.x, DY, w.z, { flip: (w.x < w0.x - 0.002) || (lookL && !moving) });
      }
    }
  });

  // ---------------------------------------------------------------- 27 — the fight (3:34): a swing into the sea, a chain yanked into the barrels, a kick out of a lightning step
  const FHITS = [214.8, 217.2, 219.6], HSTOP = 0.1, TX = 0.6, TZ = 1.0;
  const BRL = [7.3, -0.9];
  function barrelStack(t) {
    if (t < 218.0) { barrel3(BRL[0] - 0.35, BRL[1] - 0.2, 0.8); barrel3(BRL[0] + 0.4, BRL[1] + 0.1, 0.8); barrel3(BRL[0], BRL[1] - 0.05, 0.72, DY + 0.84); crate3(BRL[0] + 1.1, DY, BRL[1] - 0.5, 0.7); return; }
    const g = t - 218.0;
    planks3(BRL[0], DY + 0.5, BRL[1], g, 18, 1.0, 431); planks3(BRL[0] + 0.2, DY + 0.9, BRL[1], g, 8, 0.8, 432, R.wood);
    barrel3(BRL[0] + 0.9 + eoc(lin(0, 1.2, g)) * 0.8, BRL[1] - 0.4, 0.8);
    crate3(BRL[0] + 1.4 + eoc(lin(0, 0.6, g)) * 0.3, DY, BRL[1] - 0.6, 0.7);
    dust3(BRL[0], BRL[1], g, 1.8, 433);
  }
  function w3Wreck(t) { if (t < 218.0) return; const g = t - 218.0; atFeet('warden', { view: 'side', walk: g < 1.5 ? t * 9 : t * 2, eyes: 'wide', spear: undefined, bob: 0 }, BRL[0] + 0.1, DY + 1.25 - Math.min(0.25, g * 2), BRL[1] + 0.05, PI + 0.15, { flip: true }); }
  shot(214.0, 221.0, (lt, t) => {
    const [T, frozen] = hold(t, FHITS, HSTOP);
    let cam = 1;
    if (t < 215.7) { const u = lin(214.0, 215.7, t), fl_ = sstep(214.95, 215.4, T); lookAt(2.0 + fl_ * 0.8, 1.65, -5.9 + u * 0.3, 2.2 + fl_ * 1.4, 1.1 + fl_ * 0.3, 1.6 + fl_ * 0.8, 50); }
    else if (t < 218.4) { cam = 2; const pan = eio(lin(217.3, 218.05, t)), lift = Math.sin(lin(217.3, 218.0, t) * PI) * 0.6; lookAt(-1.0 + pan * 5.9, 1.7 + lift * 0.4, -6.5 - pan * 1.0, -1.0 + pan * 6.8, 1.2 + lift, 1.0, 52); }
    else { cam = 3; const u = lin(218.4, 221, t); lookAt(-1.3 + u * 0.4, 1.6, -6.9 + u * 0.3, -1.2 + u * 0.4, 1.15, 1.2, 52); }
    harbour(t);
    barrelStack(T); w3Wreck(T);
    if (T > 215.6) swimmer(t, 5.4, 6.2, 1);
    // ---- Tamo
    let tO, tFlip, aAng, tx = TX;
    const sw1 = lin(214.65, 214.8, T), ft1 = lin(214.9, 215.3, T), rec1 = lin(215.3, 215.7, T);
    if (T < 215.7) {
      tFlip = T > 215.6;
      const wind = sstep(214.45, 214.65, T);
      aAng = T < 214.65 ? lerp(2.5, 2.85, wind) : T < 214.9 ? lerp(2.85, -1.0, eoc(sw1)) : T < 215.3 ? lerp(-1.0, -1.9, eoc(ft1)) : lerp(-1.9, -2.4, rec1);
      tx = TX + 0.3 * eoc(ft1);
      tO = { view: 'side', crouch: T < 214.65 ? 0.6 + wind * 0.4 : T < 214.9 ? lerp(1.0, 0.1, sw1) : lerp(0.1, 0.4, rec1), lean: T < 214.65 ? -1.2 * wind : T < 214.9 ? lerp(-1.2, 2.2, sw1) : lerp(2.2, 0, ft1), armF: T < 214.65 ? lerp(2.0, 2.3, wind) : T < 214.9 ? lerp(2.3, -1.1, eoc(sw1)) : lerp(-1.1, -0.8, rec1), armB: 1.2, eyes: frozen ? 'glow' : 'narrow', glow: C('teal', 7), brows: 'angry', mouth: frozen || (sw1 > 0 && sw1 < 1) ? 0.9 : 0, walk: ft1 > 0 && ft1 < 1 ? ft1 * 2.2 : undefined, wind: 3 };
    } else if (T < 218.0) {
      tFlip = true;
      const wrap = T > 216.78, tug = lin(216.8, 217.2, T), yank = lin(217.3, 217.7, T), fol = lin(217.7, 218.0, T);
      aAng = !wrap ? -2.4 : T < 217.3 ? lerp(-2.4, 0.25, eoc(lin(216.78, 216.95, T))) : T < 217.7 ? lerp(0.25, -PI - 0.6, eio(yank)) : lerp(-PI - 0.6, -PI - 0.95, fol);
      tx = TX + 0.3 - (wrap && T < 217.3 ? 0.12 * tug : 0.12);
      tO = { view: 'side', crouch: !wrap ? 0.4 : T < 217.3 ? 0.4 + tug * 0.5 : lerp(0.9, 0.3, yank), lean: !wrap ? 0 : T < 217.3 ? -1.6 * tug : lerp(-1.6, 1.5, yank), armF: !wrap ? -0.8 : T < 217.3 ? 0.1 : lerp(0.1, -2.6, eio(yank)), armB: 1.5, eyes: frozen ? 'glow' : 'narrow', glow: C('teal', 7), brows: 'angry', smile: T > 217.0 && T < 217.3 ? 0.8 : 0, mouth: yank > 0 && yank < 1 ? 0.9 : 0, wind: 2 };
    } else {
      tx = TX + 0.18;
      const turnBack = T > 219.25, flinch = T > 219.5 && T < 219.8, kL = T > 220.45;
      tFlip = turnBack;
      aAng = -2.45;
      tO = { view: 'side', crouch: flinch ? 0.6 : 0.15, lean: flinch ? -1.2 : 0, armF: -0.75, armB: T > 218.4 && T < 218.9 && !turnBack ? -1.7 : 1.7, eyes: turnBack ? (kL ? 'open' : 'wide') : 'narrow', brows: turnBack ? 'up' : 'angry', smile: turnBack ? (kL ? 0.4 : 0) : 0.7, mouth: T > 218.4 && T < 218.9 ? 0.6 : turnBack && !kL ? 0.5 : 0 };
    }
    const rT = actor3('tamo', tO, tx, DY, TZ, {});
    const an = heldAnchor(rT, angF(aAng, tFlip), 0, false);
    // swing smears
    if (rT && an && sw1 > 0 && sw1 < 1 && T < 214.9) smearArc(an.x, an.y, 2.85, angF(aAng, tFlip), an.L, [C('teal', 4), C('teal', 6), C('teal', 7)]);
    if (rT && an && T > 217.3 && T < 217.75) smearArc(an.x, an.y, angF(0.25, true), angF(aAng, true), an.L, [C('teal', 4), C('teal', 6), C('teal', 7)]);
    // ---- W1: charges from the right, eats the anchor, sails into the sea
    if (T < 215.25) {
      if (T < 214.9) {
        const w = trk(K({ t: 214.0, x: 5.6 }, { t: 214.62, x: 2.6, e: 'l' }, { t: 214.75, x: 2.2, e: 'o' }), T), lunge = lin(214.6, 214.75, T);
        actor3('warden', { view: 'side', run: T < 214.62 ? (5.6 - w.x) * RUNK : undefined, spear: 0.05, reach: lunge * 3, lean: lunge * 2, eyes: frozen ? 'wide' : 'open' }, w.x, DY, TZ, { flip: true });
      } else {
        const u = lin(214.9, 215.2, T);
        spin('warden', { view: 'side', eyes: 'wide', spear: -1.0 + u * 3 }, lerp(2.2, 5.4, u), lerp(DY + 0.8, -0.2, u) + Math.sin(u * PI) * 2.4, lerp(TZ, 6.2, u), (T - 214.9) * 16, { flip: true, gy: u < 0.4 ? DY : undefined });
        for (let k = 0; k < 3; k++) { const p = proj(lerp(2.2, 5.4, u) - 0.6 * (k + 1) * 0.3, lerp(DY + 0.8, -0.2, u) + Math.sin(u * PI) * 2.4, lerp(TZ, 6.2, u)); if (p) streaks(Math.atan2(-1, -1.2), 2, t + k, 0, WHITE, 18, 441 + k, [p.x - 30, p.y - 10, 30, 20]); }
      }
    }
    splash3(5.4, HWY, 6.2, T - 215.2, 1.5); ripple3(5.4, 6.2, T - 215.2, 1.4);
    // ---- W3: whirls a chain, wraps the anchor, gets yanked over Tamo's head into the barrels
    if (T < 218.0) {
      const crown = an ? an.tip : null;
      if (T < 217.3) {
        const throwU = lin(216.4, 216.75, T), tug = lin(216.8, 217.2, T);
        const wx = (T < 215.9 ? lerp(-3.6, -2.9, eoc(lin(214.0, 215.9, T))) : -2.9) - tug * 0.2;
        const rW = actor3('warden', { view: 'side', run: T < 215.9 ? wx * RUNK : undefined, armF: T < 216.4 ? -1.5 : throwU < 1 ? lerp(-1.5, 0.2, eoc(throwU)) : 0.05, armB: 1.6, lean: -1.8 * tug, crouch: tug * 0.5, eyes: 'open', spear: undefined }, wx, DY, 0.9, {});
        if (rW) {
          if (T < 216.45) { const a = T * 16, cx = rW.hand[0], cy = rW.hand[1] - 10 * rW.S; let lx = null, ly = 0; for (let q = 0; q < 30; q++) { const aa = a - q * 0.19, x = cx + Math.cos(aa) * 15 * rW.S, y = cy + Math.sin(aa) * 5 * rW.S; if (lx !== null) lineF(lx, ly, x, y, (xx, yy) => { P(xx, yy + 1, C('night', 1)); P(xx, yy, q < 8 ? WHITE : (xx + yy) & 1 ? C('stone', 6) : C('stone', 3)); if (q < 14) P(xx, yy - 1, C('stone', 5)); }); lx = x; ly = y; } lineF(rW.hand[0], rW.hand[1], cx + Math.cos(a) * 15 * rW.S, cy + Math.sin(a) * 5 * rW.S, (x, y, u) => { P(x, y, (x + y) % 2 ? C('stone', 6) : C('stone', 3)); P(x, y + 1, C('night', 1)); }); }
          else if (crown) { const e = throwU < 1 ? [lerp(rW.hand[0], crown[0], eoc(throwU)), lerp(rW.hand[1] - 20, crown[1], eoc(throwU))] : crown; lineF(rW.hand[0], rW.hand[1], e[0], e[1], (x, y, u) => { const sag = throwU < 1 ? Math.sin(u * PI) * 10 : (T < 216.8 ? Math.sin(u * PI) * 6 : 0); const yy = y + sag + Math.sin(u * 30 + t * 30) * (tug > 0 ? 0.6 : 0); P(x, yy, (x + y) % 3 === 1 ? C('stone', 7) : C('stone', 4)); P(x, yy + 1, C('night', 1)); }); if (throwU >= 1) for (let q = 0; q < 3; q++) ring(crown[0], crown[1] + q * 2 - 2, 5 + q, 3, C('stone', 5)); }
        }
      } else {
        const u = lin(217.3, 218.0, T), cx = lerp(-3.0, BRL[0] + 0.1, u), cy = DY + 0.9 + Math.sin(u * PI) * 1.9, cz = lerp(0.9, BRL[1], u);
        const rW = spin('warden', { view: 'side', eyes: 'wide', armF: -1.4, armB: -1.6 }, cx, cy, cz, -(T - 217.3) * 11, { gy: DY });
        if (rW && crown && u < 0.45) lineF(rW.hand[0], rW.hand[1], crown[0], crown[1], (x, y) => { P(x, y, (x + y) % 3 ? C('stone', 6) : C('stone', 3)); P(x, y + 1, C('night', 1)); });
      }
    }
    // ---- W2: sneaks up behind him; a spear thrust; a lightning step; a kick into the sea
    if (T > 218.0 && T < 220.1) {
      if (T < 219.7) {
        const w = trk(K({ t: 218.0, x: -4.4, z: 1.6 }, { t: 218.95, x: -1.25, z: 1.2, e: 'l' }), T), draw = lin(218.95, 219.08, T), thr = lin(219.08, 219.4, T);
        actor3('warden', { view: 'side', walk: T < 218.95 ? (w.x + 4.4) * WALKK * 1.4 : undefined, crouch: T < 218.95 ? 0.6 : 0.3, spear: 0.0, reach: draw < 1 ? -2 * draw : lerp(-2, 5, eoc(thr)), lean: draw < 1 ? -draw : lerp(-1, 2, thr), eyes: frozen ? 'wide' : 'open' }, w.x + eoc(thr) * 0.25, DY, w.z, {});
      } else {
        const u = lin(219.7, 220.1, T);
        spin('warden', { view: 'side', eyes: 'wide', spear: u * 4 }, lerp(-1.0, 0.5, u), lerp(DY + 0.8, -0.3, u) + Math.sin(u * PI) * 2.6, lerp(1.2, 6.2, u), (T - 219.7) * 15, { gy: u < 0.3 ? DY : undefined });
        // still crackling
        const p = proj(lerp(-1.0, 0.5, u), lerp(DY + 0.8, -0.3, u) + Math.sin(u * PI) * 2.6, lerp(1.2, 6.2, u)); if (p) for (let b = 0; b < 2; b++) bolt(p.x, p.y, p.x + (ih(b, fl(t * 30), 451) - 0.5) * 50, p.y + (ih(b + 2, fl(t * 30), 451) - 0.5) * 40, t, 452 + b, C('gold', 7), WHITE);
      }
    }
    splash3(0.5, HWY, 6.2, T - 220.1, 1.2); ripple3(0.5, 6.2, T - 220.1, 1.1);
    if (T > 220.6) swimmer(t, 0.5, 6.2, 2);
    // ---- Kaira: the lightning step
    if (T > 219.25) {
      const dash = lin(219.25, 219.55, T), ft = lin(219.7, 220.45, T), sq = lin(220.45, 220.8, T);
      const kx = (q) => lerp(-6.4, -1.75, eoc(q)), ky = (q) => DY + 0.45 + Math.sin(q * PI * 0.5) * 0.25;
      if (T < 219.7) {
        const after = dash < 1 ? [0.2, 0.4, 0.6, 0.8].map((q, i) => { const p = proj(kx(dash * q), ky(dash * q), 1.3); return p ? [Math.round(p.x), Math.round(p.y), i & 1 ? C('indigo', 6) : C('gold', 6), 0.25 + q * 0.4] : [0, 0, 0, 0]; }) : undefined;
        const p0 = proj(kx(0), ky(0) + 0.6, 1.3), p1 = proj(kx(dash), ky(dash) + 0.6, 1.3);
        if (p0 && p1 && dash < 1) { bolt(p0.x, p0.y, p1.x, p1.y, t, 453, C('gold', 7), WHITE); bolt(p0.x, p0.y + 8, p1.x, p1.y + 4, t + 0.5, 454, C('gold', 6), C('gold', 7)); }
        actor3('kaira', { view: 'side', air: true, stride: 3, armF: -0.6, armB: 2.4, reach: dash > 0.8 ? 3 : 0, blade2: 2.6, storm: true, eyes: 'narrow', brows: 'angry', seed: 0.8, wind: 6 }, kx(dash), ky(dash), 1.3, { after, ang: -0.55, gy: DY });
      } else if (T < 220.45) {
        const cx = lerp(-1.75, -1.05, ft), cy = DY + 0.85 + Math.sin(ft * PI) * 0.9 - ft * 0.05;
        spin('kaira', { view: 'side', armF: -1.0, blade: 0.4, blade2: 2.4, storm: true, eyes: 'narrow', brows: 'angry', seed: 0.8, wind: 4 }, cx, cy, 1.25, -0.55 - eio(ft) * (TAU - 0.55), { gy: DY });
      } else {
        actor3('kaira', { view: 'side', crouch: sq < 1 ? 1.3 * (1 - eob(sq)) : 0, armF: sq < 1 ? 0.6 : -0.2, blade: sq < 1 ? 0.5 : -0.35, blade2: 2.4, storm: T < 221, eyes: blink(t, 34) ? 'closed' : 'narrow', brows: 'angry', smile: sq >= 1 ? 0.6 : 0, seed: 0.6, wind: 2 }, -1.05, DY, 1.25, {});
        if (sq < 0.5) dust3(-1.05, 1.25, T - 220.45, 0.8, 455);
      }
      // a scorched streak along the planks where she ran
      if (T > 219.3 && T < 221) { const a = 1 - lin(219.6, 221, T); for (let q = 0; q < 40; q++) { const u = q / 40; if (u > eoc(Math.min(1, dash))) break; const p = proj(lerp(-6.4, -1.9, u), DY + 0.005, 1.3); if (p) for (let j = -1; j <= 1; j++) tintP(p.x, p.y + j, T_DARK, 0.5 * a); } }
    }
    // ---- the hits (each fires on its own beat; the clock holds behind it)
    const hitAt = [[2.2, DY + 0.95, TZ], [-2.9, DY + 1.0, 0.9], [-1.15, DY + 1.0, 1.2]];
    for (let k = 0; k < 3; k++) { const p = proj(hitAt[k][0], hitAt[k][1], hitAt[k][2]); if (p) hitFx(p.x, p.y, t - FHITS[k], k === 0 ? 1.4 : k === 1 ? 0.9 : 1.2, k === 2 ? [WHITE, C('gold', 6)] : [WHITE, C('teal', 7)]); }
    if (T >= 218.0 && T < 218.5) { const p = proj(BRL[0], DY + 0.8, BRL[1]); if (p) hitFx(p.x, p.y, T - 218.0, 0.9, [WHITE, C('wood', 6)]); }
    if (t > 219.6 && t < 219.75) { const p = proj(-1.15, DY + 0.9, 1.2); if (p) cam2(1 + 0.08 * (1 - (t - 219.6) / 0.15), 0, p.x, p.y); }
    void cam;
  });

  // ---------------------------------------------------------------- 28 — the breather: "Okay. Who ARE you?" / "Tamo! I work here…" (3:41)
  const KX = -1.05, KZ = 1.25;
  function breatherCam(t, k) { const u = lin(221, 231, t); lookAt(0.0, 1.32, -5.9 + u * 0.6, 0.0, 0.98, 1.1, 46); }
  function wreckFight(t) { barrelStack(t); w3Wreck(t); }
  shot(221.0, 228.0, (lt, t) => {
    breatherCam(t);
    harbour(t); wreckFight(t);
    swimmer(t, 5.4, 6.2, 1); swimmer(t, 0.5, 6.2, 2);
    const tk = talking('tamo', t), name = t > 222.9 && t < 223.45, here = t > 223.45 && t < 224.5, well = t > 224.55 && t < 225.3, you = t > 225.3 && t < 226.8;
    actor3('tamo', {
      view: 'front', eyes: blink(t, 31) ? 'closed' : well ? 'half' : 'open', brows: well ? 'worried' : 'n', mouth: mouth('tamo', t), smile: name ? 0.9 : well ? -0.3 : t > 226.8 ? 0.7 : 0.5,
      armF: t < 222.9 ? -1.15 : name ? 2.75 : here ? 0.15 + Math.sin(t * 6) * 0.15 : well ? 0.55 : you ? 1.25 : 1.15, armL: t < 222.8 ? -2.25 + Math.sin(t * 9) * 0.15 : well ? 2.55 : you ? PI + 0.05 : 1.9,
      look: you ? -1 : 0, lean: Math.sin(t * 1.3) * 0.8,
    }, TX, DY, TZ, {});
    const laugh = t > 225.55;
    actor3('kaira', {
      view: 'front', eyes: blink(t, 32) ? 'closed' : laugh ? 'closed' : 'open', brows: t < 222.5 ? 'up' : 'n', smile: laugh ? 0.95 : 0.25, mouth: laugh && t < 227 ? (fl(t * 9) % 2 ? 0.5 : 0.2) : mouth('kaira', t),
      armF: t < 222.6 ? 0.85 : laugh ? 2.6 : 1.3, armL: t < 222.6 ? 2.3 : 1.9, seed: 0.4, blade: t < 222.6 ? undefined : 1.3, blade2: 2.4, look: 1, bob: laugh && t < 227 ? (fl(t * 9) % 2 ? 1 : 0) : undefined, lean: 0.6 + Math.sin(t * 1.1 + 2) * 0.6,
    }, KX, DY, KZ, {});
  });

  // ---------------------------------------------------------------- 29 — the world goes quiet: gulls stop in the air; the ring opens over the harbour (3:48)
  const SIGIL_H = [34, 46, 78];
  // the Hush's ring in the sky, drawn here without a wash of light: three turning rings of glyphs, cracks running out of
  // them, and inside, the sky gone to paper with pencil hatching
  function sigil2(cx, cy, r, ry, t, a, seed) {
    if (a <= 0) return;
    for (let k = 0; k < 3; k++) {
      const rr = r * (1 - k * 0.15), rot = t * (k & 1 ? -0.35 : 0.25), n = fl(48 + rr * 0.6);
      for (let q = 0; q < n; q++) {
        if (ih(q, k, seed) > a) continue;
        const ang = q / n * TAU + rot, x = Math.round(cx + Math.cos(ang) * rr), y = Math.round(cy + Math.sin(ang) * rr * (ry / r)), g = fl(ih(q, k + 7, seed) * 5);
        if (g === 0) { rectF(x - 1, y - 1, 3, 1, WHITE); rectF(x, y - 1, 1, 3, WHITE); }
        else if (g === 1) { rectF(x - 1, y, 3, 1, WHITE); P(x - 1, y - 1, C('hush', 3)); P(x + 1, y + 1, C('hush', 3)); }
        else if (g === 2) { rectF(x, y - 1, 1, 3, C('hush', 6)); P(x + 1, y - 1, WHITE); }
        else if (g === 3) { P(x, y, WHITE); P(x + 1, y, C('crimson', 5)); }
        else P(x, y, C('hush', 4));
      }
      ring(cx, cy, rr + 3, (rr + 3) * ry / r, C('hush', 2), (x, y) => bay(fl(x), fl(y)) < 0.6 * a);
    }
    for (let k = 0; k < 10; k++) {
      const ang = ih(k, 1, seed + 5) * TAU, L = (0.3 + ih(k, 2, seed + 5) * 0.5) * r * a; let px = cx + Math.cos(ang) * r, py = cy + Math.sin(ang) * ry;
      for (let j = 1; j <= 5; j++) { const u = j / 5, nx = cx + Math.cos(ang + (ih(k, j, seed + 6) - 0.5) * 0.12) * (r + L * u), ny = cy + Math.sin(ang + (ih(k, j, seed + 6) - 0.5) * 0.12) * (ry + L * u * ry / r); lineF(px, py, nx, ny, (x, y) => { if (y >= LB && bay(x, y) < 1 - u * 0.7) P(x, y, j < 3 ? WHITE : C('hush', 3)); }); px = nx; py = ny; }
    }
  }
  function sigilOver(t, p, r0, a) {
    const r = r0, ry = r0 * 0.42;
    // the sky inside the ring becomes paper: pale, cross-hatched toward the rim, never a flat white
    for (let y = Math.max(LB, fl(p.y - ry)); y <= Math.min(H - LB - 1, p.y + ry); y++) for (let x = Math.max(0, fl(p.x - r)); x <= Math.min(W - 1, p.x + r); x++) {
      const i = y * W + x; if (IDB[i] !== 0) continue;
      const d = ((x - p.x) / r) ** 2 + ((y - p.y) / ry) ** 2; if (d > 1) continue;
      const k = a * (1 - d * 0.35);
      if (bay(x, y) > k * 1.3) continue;
      const hatch = ((x + y) % 4 === 0 && d > 0.25) || ((x - y + 400) % 4 === 0 && d > 0.6);
      BUF[i] = hatch ? C('stone', 5) : shadeC(R.hush, 0.6 + (1 - d) * 2.6, x, y);
    }
    sigil2(p.x, p.y, r, ry, t, a, 461);
  }
  shot(228.0, 246.0, (lt, t) => {
    if (t < 231.0) {
      // the laugh stops; everything stops; they look up
      breatherCam(t);
      harbour(t); wreckFight(t);
      swimmer(t, 5.4, 6.2, 1, HUSH_T); swimmer(t, 0.5, 6.2, 2, HUSH_T);
      harbourHush(t);
      const look = t > 229.4, lean = sstep(229.4, 229.8, t);
      actor3('tamo', { view: 'front', armF: 1.15, armL: 1.9, eyes: look ? 'wide' : 'open', brows: look ? 'up' : 'n', smile: look ? 0 : 0.6, look: look ? 1 : 0, lean: -lean * 1.2, mouth: look ? 0.35 : 0 }, TX, DY, TZ, { rim: { side: 1, T: T_WH, a: 0.35 * lean } });
      actor3('kaira', { view: 'front', eyes: t < HUSH_T ? 'closed' : look ? 'wide' : 'open', brows: look ? 'worried' : 'n', smile: t < HUSH_T ? 0.95 : 0, mouth: mouth('kaira', t), armF: 1.3, armL: 1.9, seed: 0.4, blade: 1.3, blade2: 2.4, look: look ? 1 : 0, lean: -lean }, KX, DY, KZ, { rim: { side: 1, T: T_WH, a: 0.35 * lean } });
    } else if (t < 235.4) {
      // the sky over the harbour opens: from the planks, past the two of them, up
      const u = t - 231.0; ENV.bloom = 0.12;
      lookAt(-1.4, 0.9, -4.2, 14, 16 + u * 1.8, 50, 58);
      harbour(t); harbourHush(t);
      const p = proj(SIGIL_H[0], SIGIL_H[1], SIGIL_H[2]);
      if (p) sigilOver(t, p, 18 + eoc(u / 3.6) * 92, lin(0, 2.4, u));
      actor3('tamo', { view: 'back', armF: 1.15, armL: 1.9, bob: 0 }, TX, DY, TZ - 0.6, { dark: 1, rim: { side: 1, T: T_WH, a: 0.5 } });
      actor3('kaira', { view: 'back', seed: 0.4, blade: 1.3, blade2: 2.4, bob: 0, wind: 1 }, KX, DY, KZ - 0.5, { dark: 1, rim: { side: 1, T: T_WH, a: 0.5 } });
      shk(0.5);
    } else if (t < 242.0) {
      // Tamo, close, the dark lighthouse behind him: "Hollow."
      const u = lin(235.4, 242, t);
      lookAt(TX - 3.9 + u * 0.4, 1.7, TZ - 4.0 + u * 0.4, TX, 1.45, TZ, 40);
      harbour(t); harbourHush(t);
      const down = t > 238.1 && t < 240.2;
      const rT = actor3('tamo', { view: 'front', armF: 0.9, armL: 1.9, eyes: blink(t, 33) ? 'closed' : down ? 'half' : 'sad', brows: 'worried', mouth: mouth('tamo', t), look: down ? -1 : 1, lean: Math.sin(t * 0.9) * 0.6 }, TX, DY, TZ, { rim: { side: 1, T: T_WH, a: 0.45 } });
      heldAnchor(rT, 1.35, 0, true);
    } else {
      // Oren drops in behind them: "No… not here. Not the harbour."
      const g = t - 242.0;
      lookAt(-0.9, 1.45, -6.0, -0.85, 1.05, 1.3, 48);
      harbour(t); wreckFight(t); harbourHush(t);
      const land = eoc(lin(0, 0.4, g));
      if (g < 0) { const p = proj(-2.4, DY + 6, 1.7), q = proj(-2.4, DY + (-g) * 30, 1.7); if (p && q) lineF(p.x, p.y, q.x, q.y, (x, y) => { if (bay(x, y) < 0.6) P(x, y, WHITE); }); }
      if (g >= 0 && g < 0.3) { const p = proj(-2.4, DY, 1.7); if (p) shockRing(p.x, p.y, 3 + g * 100, 1 + g * 24, 2, [WHITE, C('linen', 6), C('linen', 4)], 1 - g / 0.3); shk(3 * (1 - g / 0.3)); }
      dust3(-2.4, 1.7, g, 1.0, 471);
      actor3('warden', { view: 'front', captain: true, spear: lerp(-1.5, -1.2, land), armL: 1.9, eyes: 'wide', mouth: mouth('oren', t), crouch: g < 0.4 ? 1.4 * (1 - land) : 0, air: g < 0, bob: g < 0.4 ? 0 : undefined }, -2.4, DY + Math.max(0, -g * 30), 1.7, { rim: { side: 1, T: T_WH, a: 0.4 }, gy: DY });
      const turn = t > 242.25;
      actor3('kaira', { view: turn ? 'side' : 'front', seed: 0.5, blade: 1.3, blade2: 2.4, eyes: blink(t, 35) ? 'closed' : 'wide', brows: 'worried', armF: 1.0 }, KX, DY, KZ, { flip: true, rim: { side: 1, T: T_WH, a: 0.3 } });
      const rT = actor3('tamo', { view: turn ? 'side' : 'front', eyes: blink(t, 36) ? 'closed' : 'wide', brows: 'up', armF: -0.6 }, TX, DY, TZ, { flip: true, rim: { side: 1, T: T_WH, a: 0.3 } });
      heldAnchor(rT, angF(-2.4, true), 0, true);
    }
  });

  // ---------------------------------------------------------------- 30 — the Hollow fall like stars; a warden is erased; the Bellwether comes down (4:06)
  const HOLLOW_LAND = [247.0, 247.4, 247.7, 248.1, 248.5, 248.8, 249.2, 249.6], HOLLOW_X = [12, 9.5, 15, 7.5, 18, 11, 6.5, 14], HOLLOW_Z = [0.4, -1.8, 1.8, 2.2, -0.6, 2.6, -1.0, -2.6];
  const BELL_LAND = 260.0, BX = 8.4, BZ = 1.4, BSZ = 2.0;
  const hollowX = (k, t) => HOLLOW_X[k] - (t > 250 ? Math.min(3.2, (t - 250) * 0.5) : 0);
  function hollowCrowd(t, opt) {
    opt = opt || {};
    for (let k = 0; k < 8; k++) {
      const g = t - HOLLOW_LAND[k]; if (g < -0.6) continue;
      const x = hollowX(k, t), z = HOLLOW_Z[k] + (opt.part ? Math.sign(HOLLOW_Z[k] - VZ + 0.01) * opt.part * Math.max(0, 2.4 - Math.abs(HOLLOW_Z[k] - VZ)) : 0);
      if (g < 0) {
        const y = DY + (-g) * 40, p = proj(x, y, z), q = proj(x, y + 9, z);
        if (p && q) lineF(q.x, q.y, p.x, p.y, (xx, yy, u) => { if (bay(xx, yy) < u) { P(xx - 1, yy, C('crimson', 4)); P(xx, yy, WHITE); P(xx + 1, yy, C('char', 1)); } });
        continue;
      }
      const land = eoc(lin(0, 0.35, g)), moving = t > 250 && t < 256.4, cower = t > BELL_LAND && t < BELL_LAND + 2.5 ? sstep(BELL_LAND, BELL_LAND + 0.3, t) * (1 - sstep(BELL_LAND + 1.8, BELL_LAND + 2.5, t)) : 0;
      actor3('hollow', { view: opt.view || 'side', eyes: 'open', crouch: g < 0.35 ? 1.4 * (1 - land) : cower * 1.2, armF: 1.0 + Math.sin(t * 3 + k) * 0.25, armB: 1.7, walk: moving ? x * WALKK : undefined, lean: Math.sin(t * 2 + k) * 0.8 }, x, DY, z, { flip: true, dark: opt.dark || 0 });
      if (g < 0.25) { const p = proj(x, DY, z); if (p) { shockRing(p.x, p.y, 3 + g * 90, 1 + g * 20, 2, [WHITE, C('crimson', 5), C('hush', 3)], 1 - g / 0.25); shk(1); } }
    }
  }
  // the Bellwether: tall, robed, a cracked bronze bell for a head
  function bellwether(t, y, o, opt) { return actor3('bellwether', Object.assign({ glowEyes: true, sway: Math.sin(t * 0.8) * 2 }, o), BX, y, BZ, Object.assign({ size: BSZ, big: true }, opt || {})); }
  shot(246.0, 262.0, (lt, t) => {
    if (t < 250.0) {
      // wide, high: the white ring sweeping in across the far boats; the Hollow streak down onto the dock
      const u = lin(246, 250, t);
      lookAt(-10 + u * 1.5, 6.5, -17, 12, 2.5, 26, 56);
      harbour(t); harbourHush(t);
      const p = proj(SIGIL_H[0], SIGIL_H[1], SIGIL_H[2]); if (p) sigil2(p.x, p.y, 100, 42, t, 1, 461);
      hollowCrowd(t);
      for (const [x, z] of [[-2.4, 1.7], [-4.6, -0.8], [-5.8, 1.2]]) actor3('warden', { view: 'side', spear: 0.1, eyes: 'open' }, x, DY, z, {});
      const rT = actor3('tamo', { view: 'side', armF: -0.6, eyes: 'wide' }, TX, DY, TZ, {}); heldAnchor(rT, -2.4, 0, true);
      actor3('kaira', { view: 'side', seed: 0.5, blade: 0.6, blade2: 2.4, eyes: 'wide' }, KX, DY, KZ, {});
    } else if (t < 254.0) {
      // the fight with shadows: a spear goes through one and it only tears; a warden is touched, and is not a warden any more
      const er = t - 252.5;
      const u = lin(250, 254, t); lookAt(3.6 + u * 0.4, 1.9, -8.2 + u * 0.4, 5.6 + u * 0.4, 1.0, 0.0, 50);
      harbour(t); harbourHush(t);
      hollowCrowd(t);
      // Oren: thrust, a spin of the spear, a second thrust
      const th1 = lin(250.4, 250.6, t), sp = lin(251.0, 251.7, t), th2 = lin(252.05, 252.25, t);
      actor3('warden', { view: 'side', captain: true, spear: sp > 0 && sp < 1 ? sp * TAU * 2 : 0.0, reach: th1 > 0 && th1 < 1 ? th1 * 5 : th2 > 0 && th2 < 1 ? th2 * 5 : 0, lean: (th1 > 0 && th1 < 1) || (th2 > 0 && th2 < 1) ? 2 : 0, crouch: 0.4, eyes: er > 0.2 ? 'wide' : 'open' }, 4.4, DY, 0.4, { flip: er > 0.3, rim: { side: 1, T: T_WH, a: 0.3 } });
      if (th1 > 0.8 && th1 < 1) { const p = proj(5.9, DY + 0.9, 0.4); if (p) for (let k = 0; k < 12; k++) P(p.x + (ih(k, 1, 472) - 0.3) * 30, p.y + (ih(k, 2, 472) - 0.5) * 30, k & 1 ? WHITE : C('crimson', 5)); }
      // the warden at the back, and the Hollow that reaches him
      const gw = er > 0 ? Math.min(1, er / 0.6) : 0, reach = lin(252.0, 252.5, t);
      actor3('hollow', { view: 'side', eyes: 'open', armF: lerp(1.2, 0.05, reach), reach: reach * 4, lean: reach * 1.5, walk: t < 252.0 ? t * 5 : undefined }, 8.9 - reach * 0.5 - lin(250, 252, t) * 0.4, DY, -1.5, { flip: true });
      if (er < 1.4) {
        const wO = { view: er > 0 ? 'front' : 'side', spear: er > 0 ? undefined : 0.1, eyes: 'wide', armF: er > 0 ? -1.2 : undefined, armL: er > 0 ? -1.9 : undefined, bob: 0 };
        if (er < 0.1) actor3('warden', wO, 7.3, DY, -1.5, { white: er > 0, flip: false });
        else { actor3('warden', wO, 7.3, DY + er * 0.15, -1.5, { glitch: gw * 2, alpha: 1 - Math.max(0, er - 0.6) * 1.25, shadow: false }); }
      }
      if (er > 0.05 && er < 2.0) { const p = proj(7.3, 1.0, -1.5); if (p) for (let k = 0; k < 70; k++) { const uu = frac(ih(k, 1, 471) + er * 0.8); if (uu > er * 1.2) continue; const x = p.x + (ih(k, 2, 471) - 0.5) * 50 + Math.sin(uu * 6 + k) * 6, y = p.y + 30 - ih(k, 3, 471) * 50 - uu * 70; if (bay(fl(x), fl(y)) > 1 - uu) continue; P(x, y, ih(k, 4, 471) < 0.75 ? WHITE : C('crimson', 5)); if (k % 3 === 0) P(x + 1, y, C('hush', 3)); } }
      if (er > 0 && er < 0.04) impactFrame(240, 135, 0);
      // Tamo and Kaira back to back, in the left of the frame
      const rT = actor3('tamo', { view: 'side', armF: -0.6, eyes: 'narrow', brows: 'angry', crouch: 0.4 }, 2.4, DY, 1.6, { flip: true }); heldAnchor(rT, angF(-2.4, true), 0, true);
      actor3('kaira', { view: 'side', seed: 0.6, blade: 0.2, blade2: 2.6, eyes: 'narrow', brows: 'angry', crouch: 0.5 }, 3.1, DY, 2.0, {});
    } else {
      // the Bellwether coming down out of the ring, huge and slow; it lands, and rings
      const g = t - BELL_LAND, y = g >= 0 ? DY : t < 259.25 ? DY + 4.6 + 26 * (1 - eoc(lin(254.0, 259.25, t))) : t < 259.72 ? DY + 4.6 + Math.sin(lin(259.25, 259.72, t) * PI) * 0.35 : DY + 4.6 * (1 - eic(lin(259.72, BELL_LAND, t)));
      const fy = Math.max(3.4, lerp(y + 1.6, 3.4, sstep(258.3, 259.3, t)));
      lookAt(-2.8, 0.75, -8.0 - sstep(259.9, 261.5, t) * 0.6, BX - 1.5, fy, BZ, 60);
      harbour(t); harbourHush(t);
      const p = proj(SIGIL_H[0], SIGIL_H[1], SIGIL_H[2]); if (p) sigil2(p.x, p.y, 100, 42, t, 1, 461);
      // a thin falling column of glyphs it rides down
      if (g < 0.5) { for (let k = 0; k < 60; k++) { const fy = frac(ih(k, 1, 481) - t * 0.6) * 30, q = proj(BX + (ih(k, 2, 481) - 0.5) * 3, y + fy, BZ + (ih(k, 3, 481) - 0.5) * 2); if (q && bay(fl(q.x), fl(q.y)) < 0.6) P(q.x, q.y, k & 3 ? C('hush', 5) : WHITE); } }
      hollowCrowd(t);
      if (g < 0 && t > 259.72) { const q = proj(BX, y + 3, BZ); if (q) streaks(-PI / 2, 26, t, 2600, C('hush', 5), 50, 484, [q.x - 90, LB, 180, H - 2 * LB]); }
      const bw = bellwether(t, y, { sway: g < 0 ? Math.sin(t * 5) * 3 * (t < 259.72 ? 1 : 0.2) : Math.sin(t * 0.8) * 2, arms: g < 0 ? 0.55 + Math.sin(t * 1.3) * 0.08 : lerp(0.55, 1.3, eoc(lin(0.2, 1.4, g))), ring: g > 0 && g < 1.6 ? 1.6 * (1 - g / 1.6) : 0 }, { gy: DY, rim: { side: -1, T: T_WH, a: 0.3 } });
      const push = g > 0 ? eoc(lin(0, 0.5, g)) * 0.35 : 0, crouchH = g > 0 && g < 1.6 ? 1 - lin(0.6, 1.6, g) : 0;
      const rT = actor3('tamo', { view: 'back', armF: 1.15, armL: 1.9, crouch: crouchH * 0.8, bob: 0, wind: g > 0 && g < 1.5 ? 5 : 1 }, TX - 0.2 - push, DY, -0.6, { dark: 1, rim: { side: 1, T: T_WH, a: 0.4 } }); heldAnchor(rT, -1.3, 0, true);
      actor3('kaira', { view: 'back', seed: 0.6, blade: 0.8, blade2: 2.4, crouch: crouchH * 0.9, bob: 0, wind: g > 0 && g < 1.5 ? 6 : 1 }, TX - 1.05 - push, DY, -0.2, { dark: 1, rim: { side: 1, T: T_WH, a: 0.4 } });
      if (g > 0) {
        dust3(BX, BZ, g, 4.0, 482); planks3(BX, DY + 0.05, BZ, g, 20, 1.3, 483);
        const base = proj(BX, DY, BZ), bh = proj(BX, DY + 5.2, BZ);
        for (let r = 0; r < 3; r++) { const gg = g - r * 0.22; if (gg > 0 && gg < 1.4) { if (base) shockRing(base.x, base.y, 10 + gg * 380, 3 + gg * 60, 3, [WHITE, C('hush', 5), C('gold', 6)], 1 - gg / 1.4); if (bh) shockRing(bh.x, bh.y, 8 + gg * 200, 8 + gg * 200, 2, [WHITE, C('gold', 6), C('gold', 4)], 1 - gg / 1.4); } }
        if (bh && g < 0.6) radialLines(bh.x, bh.y, 36, 30, WHITE, t, 493);
        shk(6 * Math.exp(-g * 2.2)); if (g < 0.07) flashWhite(0.45);
      }
      void bw;
    }
  });

  // ---------------------------------------------------------------- 31 — "The courier. And the anchor-bearer. Two of four." (4:22)
  shot(262.0, 276.0, (lt, t) => {
    if (t < 266.2 || (t > 267.0 && t < 270.2)) {
      // low on the bell as it speaks; a slow push
      const a = t < 266.2, u = a ? lin(262, 266.2, t) : lin(267, 270.2, t);
      if (a) lookAt(2.0 + u * 0.5, 0.9, -7.2 + u * 0.6, BX, 4.6, BZ, 56); else lookAt(4.4 + u * 0.3, 3.2, -4.6 + u * 0.3, BX, 5.5, BZ, 44);
      harbour(t); wreckFight(t); harbourHush(t);
      hollowCrowd(t);
      const sp_ = talking('bellwether', t), m = mouth('bellwether', t), chuckle = t > 267.0 && t < 267.7;
      const bw = bellwether(t, DY, { ring: chuckle ? 0.9 : sp_ ? 0.35 * m : 0, arms: 1.3 + Math.sin(t * 0.7) * 0.1, sway: Math.sin(t * 0.8) * 2 + (chuckle ? Math.sin(t * 40) * 1 : 0) }, { rim: { side: -1, T: T_WH, a: 0.35 } });
      if (bw && bw.head && sp_) { glow(bw.head[0], bw.head[1] - 26 * bw.S, (8 + 14 * m) * bw.S / 2, T_GOLD, 0.35); }
    } else if (t < 267.0) {
      // the two of them, ready
      lookAt(-0.05, 1.3, -5.6, -0.05, 0.98, 1.1, 46);
      harbour(t); harbourHush(t);
      const draw = eoc(lin(266.3, 266.55, t));
      const rT = actor3('tamo', { view: 'front', armF: lerp(-1.15, -0.4, draw), armL: 1.9, eyes: 'narrow', brows: 'angry', crouch: draw * 0.4 }, TX, DY, TZ, { rim: { side: 1, T: T_WH, a: 0.4 } }); heldAnchor(rT, lerp(-2.1, -1.2, draw), 0, true);
      actor3('kaira', { view: 'front', seed: 0.7, blade: lerp(1.3, -0.9, draw), blade2: 2.4, armF: lerp(1.3, -0.4, draw), eyes: 'wide', brows: 'worried', crouch: draw * 0.4 }, KX, DY, KZ, { rim: { side: 1, T: T_WH, a: 0.4 } });
    } else {
      // the standoff, wide: their stances; it spreads its arms; the Hollow edge in
      const u = t - 270.2;
      lookAt(0.3, 1.7, -9.8 + u * 0.25, 3.5, 3.25, 1.0, 66);
      harbour(t); wreckFight(t); harbourHush(t);
      hollowCrowd(t);
      bellwether(t, DY, { arms: lerp(1.3, 0.2, eio(lin(273, 275.5, t))) }, { flip: true });
      const st = eio(lin(270.8, 271.6, t));
      const rT = actor3('tamo', { view: 'side', armF: lerp(-0.6, 0.6, st), crouch: st * 0.6, eyes: 'narrow', brows: 'angry', lean: st * 0.8 }, TX, DY, TZ, {}); heldAnchor(rT, lerp(-2.4, 2.6, st), 0, true);
      actor3('kaira', { view: 'side', seed: 0.7, blade: lerp(1.6, 0.0, eio(lin(271.4, 272.2, t))), blade2: 2.6, crouch: 0.7 * eio(lin(271.4, 272.2, t)), eyes: 'narrow', brows: 'angry', storm: t > 272 }, KX, DY, KZ + 0.2, {});
      for (let k = 0; k < 18; k++) { const yy = 120 + ih(k, 1, 491) * 110, x = frac(ih(k, 2, 491) - t * 0.25) * 560 - 40; lineF(x, yy, x + 14, yy - 1, (xx, y2) => { if (bay(xx, y2) < 0.4) P(xx, y2, C('hush', 5)); }); }
    }
  });

  // ---------------------------------------------------------------- 32 — the toll: a white wave down the dock; a wall of water; the strain; the break (4:36)
  const TOLL = 276.5, WALL = 277.5, MEET = 278.5, BREAK = 285.5, WX = 1.35;
  const waveFront = (t) => (t < TOLL ? 99 : t < MEET ? lerp(BX - 0.5, WX + 0.25, Math.pow(lin(TOLL, MEET, t), 1.4)) : t < BREAK ? WX + 0.25 + Math.sin(t * 7) * 0.06 : Math.max(-0.9, WX + 0.25 - (t - BREAK) * 3));
  // the wall of water: a churning sheet with a ragged foaming crest, spray thrown off its top, and the white eating into its far face
  function waterWall(t, h) {
    if (h < 0.05) return;
    const z0 = -4.6, z1 = 5.0, strain = t > MEET && t < BREAK;
    for (const [xo, dark] of [[0.22, 1], [0, 0]]) {
      poly3([[WX + xo, -0.5, z0], [WX + xo, -0.5, z1], [WX + xo, h + 0.6, z1], [WX + xo, h + 0.6, z0]], (u, v, x, y) => {
        // u: along z, v: up
        const crest = h - 0.25 + Math.sin(u * 3.1 + t * 5) * 0.12 + Math.sin(u * 7.3 - t * 7) * 0.07 + (vn(u * 4, t * 3, 1, 501) - 0.5) * 0.25;
        if (v > crest + 0.12) return -1;
        if (v > crest - 0.1) return bay(x, y) < 0.7 ? WHITE : C('hush', 4);
        const flow = vn(u * 2.2, v * 1.3 - t * 3.2, 1, 502), streak = frac(u * 2.7 + Math.sin(v * 1.5 + t * 2) * 0.3);
        let s = 2.6 + v / h * 2.2 + flow * 1.6 - dark * 0.8;
        if (streak < 0.08) s += 1.8;
        if (vn(u * 5, v * 5 - t * 6, 1, 503) > 0.8) return C('sea', 7);
        if (v < 0.5 + Math.sin(u * 4 + t * 6) * 0.15) return bay(x, y) < 0.5 ? WHITE : C('sea', 6);     // churn at the foot
        if (strain && !dark && ih(x >> 1, y >> 1, fl(t * 18)) < 0.04) return ih(x, y, 5) < 0.6 ? WHITE : C('crimson', 5);
        return shadeC(R.sea, s, x, y);
      }, { two: true });
    }
    // spray off the crest and droplets falling back
    for (let k = 0; k < 70; k++) { const zz = z0 + ih(k, 1, 504) * (z1 - z0), ph = frac(ih(k, 2, 504) + t * (0.8 + ih(k, 3, 504))), up = Math.sin(ph * PI) * (0.5 + ih(k, 4, 504) * 1.0); p3(WX + 0.1 - ph * 0.8 * ih(k, 5, 504), h - 0.1 + up, zz, k % 3 ? C('sea', 7) : WHITE, 0.09); }
    // where the white meets the water: static, glyphs, steam
    if (strain) for (let k = 0; k < 60; k++) { const zz = z0 + ih(k, 1, 505) * (z1 - z0), yy = ih(k, 2, 505) * h, ph = frac(ih(k, 3, 505) + t * 2); p3(WX + 0.35 + ph * 0.8, yy + ph * 0.6, zz, ph < 0.5 ? WHITE : C('crimson', 5), 0.06); }
  }
  shot(276.0, 292.0, (lt, t) => {
    const close = t > 280.4 && t < 285.2, after = t >= BREAK + 0.5;
    if (after) { const u = lin(BREAK + 0.5, 292, t); lookAt(-13.6 + u * 0.5, 1.25, -0.8, BX, 3.0, BZ, 48); }
    else if (close) { const u = lin(280.4, 285.2, t); lookAt(-2.6 + u * 0.3, 1.35, -4.5 + u * 0.35, 0.1, 1.28, 1.1, 48); }
    else { const u = lin(276, 280.4, t); lookAt(-4.6 + u * 0.3, 2.4, -7.4 + u * 0.3, 3.2, 2.6, 1.0, 60); }
    harbour(t); wreckFight(t);
    const front = waveFront(t);
    harbourHush(t, (wx, wy, wz) => (Math.abs(wz) > 8 || wy > 7 ? 0 : wx > front + 0.7 ? 1 : wx > front ? 0.55 : 0));
    // the wall
    const wh = t < WALL ? 0 : t < BREAK ? 4.4 * eob(lin(WALL, WALL + 0.7, t)) : 4.4 * (1 - eic(lin(BREAK, BREAK + 0.35, t)));
    waterWall(t, wh);
    if (t > WALL && t < WALL + 1.2) { splash3(WX, -0.3, -3.6, t - WALL, 1.6); splash3(WX, -0.3, 4.6, t - WALL, 1.6); }
    // the Bellwether, the Hollow
    hollowCrowd(t);
    bellwether(t, DY, { ring: t > TOLL && t < TOLL + 1.4 ? 1.5 * (1 - (t - TOLL) / 1.4) : 0, arms: t > 288 ? lerp(0.2, -0.9, eio(lin(288, 290.5, t))) : 0.2 }, { flip: !after });
    if (t > TOLL && t < TOLL + 1.2) { const b = proj(BX, DY + 5.2, BZ); if (b) for (let r = 0; r < 3; r++) { const gg = t - TOLL - r * 0.2; if (gg > 0 && gg < 1) shockRing(b.x, b.y, 8 + gg * 220, 8 + gg * 220, 2, [WHITE, C('gold', 6), C('gold', 4)], 1 - gg); } shk(3 * (1 - (t - TOLL) / 1.2)); }
    // the heroes: he slams the anchor down and holds the wall; she braces at his back; then they're thrown
    const thrownT = lin(BREAK + 0.5, BREAK + 1.15, t), thrownK = lin(BREAK + 0.55, BREAK + 1.3, t), down = t >= BREAK + 1.15, downK = t >= BREAK + 1.3;
    const slam = lin(WALL - 0.35, WALL, t), strain = t > WALL && t < BREAK + 0.5;
    if (!after && t < BREAK + 0.5) {
      const rT = actor3('tamo', {
        view: close ? 'front' : 'side', armF: close ? -1.3 + (strain ? Math.sin(t * 30) * 0.05 : 0) : slam < 1 ? lerp(-0.6, -1.5, sstep(276.6, WALL - 0.35, t)) : 0.5, armL: close ? -1.9 : undefined,
        crouch: t > WALL ? 1.0 : slam > 0 ? -0.0 : 0.4, lean: strain && !close ? 1.5 : 0, eyes: t > MEET ? 'glow' : 'narrow', glow: C('teal', 7), brows: 'angry', mouth: mouth('tamo', t) || (t > MEET && !talking('tamo', t) ? 0.0 : 0), smile: strain ? -1 : 0, bob: strain ? 0 : undefined,
      }, TX + (strain ? (ih(fl(t * 30), 3, 9) - 0.5) * 0.02 : 0), DY, TZ, { rim: { side: 1, T: T_TEAL, a: t > WALL ? 0.6 : 0 } });
      const aA = close ? -1.45 : t < WALL - 0.35 ? lerp(-2.4, -1.5, sstep(276.6, WALL - 0.4, t)) : t < WALL ? lerp(-1.5, 1.1, eic(slam)) : 1.15;
      heldAnchor(rT, aA, t > WALL ? 1 : 0, false);
      if (t > WALL && t < BREAK && !close) aura(t, [C('teal', 3), C('teal', 5), C('teal', 6), C('teal', 7)], 6, { sparks: 14 });
      if (t > WALL && t < WALL + 0.4) { dust3(TX + 0.8, TZ, t - WALL, 1.2, 506); planks3(TX + 0.8, DY, TZ, t - WALL, 8, 0.8, 507); }
    }
    const blaze = sstep(283.4, 284.2, t) * (t < BREAK ? 1 : 0);
    let ka = null;
    if (!after && t < BREAK + 0.55) ka = actor3('kaira', { view: close ? 'front' : 'side', seed: 0.6 + blaze * 0.4, blade: 0.3, blade2: 2.6, armF: close ? 1.3 : -0.1, crouch: 0.7, lean: strain ? 1.4 : 0, eyes: blaze > 0.5 ? 'glow' : 'wide', brows: 'worried', mouth: mouth('kaira', t), wind: 3 }, KX + 0.25, DY, KZ + (close ? 0.35 : 0), {});
    if (ka && blaze > 0) { glow(ka.chest[0], ka.chest[1], 40 * blaze, T_GOLD, 0.5 * blaze); for (let b = 0; b < 4; b++) if (ih(b, fl(t * 20), 491) < blaze) bolt(ka.chest[0], ka.chest[1], ka.chest[0] + (ih(b, fl(t * 20) + 1, 491) - 0.5) * 120, ka.chest[1] + (ih(b, fl(t * 20) + 2, 491) - 0.5) * 90, t, 492 + b, C('gold', 7), WHITE); shk(blaze * 2); }
    if (t > MEET && t < BREAK) shk(1.2 + Math.sin(t * 3) * 0.5);
    // the break: the wall bursts toward them; they're thrown back down the dock and land hard
    if (t > BREAK) {
      splash3(WX, DY, 0.6, t - BREAK, 2.4); splash3(WX, DY, -2.2, t - BREAK - 0.05, 1.8); splash3(WX, DY, 3.0, t - BREAK - 0.1, 1.8);
      const p = proj(WX, 1.6, 0.8); if (p && !after) hitFx(p.x, p.y, t - BREAK, 1.6, [WHITE, C('sea', 7)]);
      for (let k = 0; k < 120; k++) { const g = t - BREAK, a = ih(k, 1, 508) * PI, v = 3 + ih(k, 2, 508) * 6; if (g > 1.4) break; const y = 0.8 + ih(k, 3, 508) * 3 + Math.sin(a) * v * g * 0.6 - 4.9 * g * g; if (y < DY) continue; p3(WX - Math.abs(Math.cos(a)) * v * g, y, -3 + ih(k, 4, 508) * 7, k % 3 ? C('sea', 7) : WHITE, 0.1); }
    }
    if (t >= BREAK + 0.5) {
      // flying, then down: Tamo, his anchor, Kaira
      const TL = [-3.0, -4.3], ZL = [TZ, KZ + 0.3];
      if (!down) spin('tamo', { view: 'side', eyes: 'closed', brows: 'worried', armF: -2.4, armB: -2.0, wind: 5 }, lerp(TX, TL[0], thrownT), DY + 0.6 + Math.sin(thrownT * PI) * 1.3, lerp(TZ, ZL[0], thrownT), -thrownT * 4.2, { gy: DY });
      else atFeet('tamo', { view: 'side', eyes: t > 289.5 ? 'half' : 'closed', brows: 'worried', armF: -2.6, armB: 2.4, bob: 0, mouth: 0.2 }, TL[0] - 0.55 - eoc(lin(BREAK + 1.15, BREAK + 1.5, t)) * 0.2, DY + 0.36 + (t < BREAK + 1.3 ? Math.sin(lin(BREAK + 1.15, BREAK + 1.3, t) * PI) * 0.12 : 0), ZL[0], PI / 2, { gy: DY, sx: TL[0], sr: 0.9 });
      if (!downK) spin('kaira', { view: 'side', eyes: 'closed', brows: 'worried', armF: -2.2, blade2: 2.4, wind: 6 }, lerp(KX + 0.25, TL[1], thrownK), DY + 0.6 + Math.sin(thrownK * PI) * 1.5, lerp(KZ, ZL[1], thrownK), -thrownK * 5.0, { gy: DY });
      else atFeet('kaira', { view: 'side', eyes: 'closed', brows: 'worried', armF: 2.6, armB: -2.5, blade2: 2.4, bob: 0 }, TL[1] - 0.5, DY + 0.36 + (t < BREAK + 1.45 ? Math.sin(lin(BREAK + 1.3, BREAK + 1.45, t) * PI) * 0.12 : 0), ZL[1], PI / 2, { gy: DY, sx: TL[1], sr: 0.9 });
      if (t < BREAK + 1.8) { dust3(TL[0], ZL[0], t - BREAK - 1.15, 0.9, 509); dust3(TL[1], ZL[1], t - BREAK - 1.3, 0.9, 510); }
      // the anchor clatters down between them
      const au = lin(BREAK + 0.5, BREAK + 1.25, t), ax = lerp(TX + 0.5, -1.6, au), ay = au < 1 ? DY + 0.5 + Math.sin(au * PI) * 1.8 : DY + 0.2;
      anchorAt3(ax, ay, TZ - 0.2, au < 1 ? au * 9 : 0.1, 0);
      if (t > BREAK + 1.25 && t < BREAK + 1.6) shk(2);
    }
    // the Bellwether lifts its arms for the last toll … which never comes
    if (t > 288 && t < 290.6) { const b = proj(BX, DY + 5.0, BZ); if (b) { glow(b.x, b.y, 18 + (t - 288) * 12, T_GOLD, 0.35); radialLines(b.x, b.y, 24, 30, C('hush', 6), t, 492); } shk((t - 288) * 0.9); }
    if (t > 290.8) tintAll(T_DARK, 0.3);
  });

  // ---------------------------------------------------------------- 33 — the light in the fog (4:52)
  // Vesper: a tall armoured knight in a ragged cloak, a violet crest that streams like flame, a lantern
  const VSTEPS = [292.2, 293.4, 294.6, 295.8, 297.0], VZ = -2.5;
  function drawVesper3(o) {
    const ph = o.step || 0, s = Math.sin(ph), lift = (q) => Math.max(0, q) * 3;
    const armour = C('stone', 3), armL = C('stone', 5), armD = C('stone', 1), cloak = C('night', 1), cloakL = C('night', 2), vio = C('violet', 6), vioL = C('violet', 7);
    // the cloak behind, ragged at the hem, blown
    const w = o.wind || 0;
    sPoly([[17, 4], [43, 4], [48 - w, 58], [12 - w * 1.5, 60]], cloak);
    for (let k = 0; k < 7; k++) { const x = 12 - w * 1.5 + k * 5.5; sPoly([[x, 57], [x + 5, 57], [x + 2 - w * 0.6, 63 + (k & 1) * 2 + Math.sin(T_NOW * 3 + k) * 1]], k & 1 ? cloak : cloakL); }
    // legs, armoured, stepping
    const legX = [25 + s * 2, 33 - s * 2], legLift = [lift(-Math.cos(ph)), lift(Math.cos(ph))];
    for (let k = 0; k < 2; k++) { const x = legX[k], ly = 60 - legLift[k]; sRect(x - 3, 40, x + 2, ly - 3, k ? armour : armD); sRect(x - 4, ly - 3, x + 3, ly, k ? armL : armour); sRect(x - 3, 47, x + 2, 48, k ? armL : armour); }
    // the body: a breastplate and a tasset skirt
    sPoly([[19, 16], [41, 16], [39, 38], [21, 38]], armour); sRect(20, 16, 40, 17, armL); sLine(30, 18, 30, 36, armL);
    sPoly([[20, 37], [40, 37], [42, 45], [18, 45]], armD); for (let k = 0; k < 4; k++) sLine(21 + k * 5, 38, 20 + k * 5.5, 44, armour);
    // pauldrons
    sEll(17, 18, 6, 4.5, armL); sEll(43, 18, 6, 4.5, armour); sRect(12, 19, 22, 20, armD); sRect(38, 19, 48, 20, armD);
    // the left arm down with the lantern; the right on the sword's hilt
    const sw = Math.sin(ph) * 0.3;
    sLine(14, 22, 13 + Math.sin(sw) * 2, 34, armour, 4); sRect(11, 33, 15, 36, armD);
    const lx = 13 + Math.sin(sw) * 5, ly = 37 + Math.cos(sw) * 0;
    sLine(lx, 36, lx + Math.sin(sw) * 3, 40, C('stone', 2)); sRect(lx - 2 + Math.sin(sw) * 3, 40, lx + 2 + Math.sin(sw) * 3, 46, C('stone', 2)); sRect(lx - 1 + Math.sin(sw) * 3, 41, lx + 1 + Math.sin(sw) * 3, 45, vio, 3); sp(lx + Math.sin(sw) * 3, 42, vioL, 3);
    sLine(46, 22, 45, 33, armour, 4); sRect(43, 32, 47, 35, armD);
    sLine(45, 30, 45, 22, C('stone', 4), 2); sRect(42, 30, 48, 31, C('stone', 6));        // the hilt over the shoulder
    // the helm: tall, a visor slit, the eyes
    sPoly([[22, 15], [23, 2], [26, -3], [34, -3], [37, 2], [38, 15]], armour); sRect(22, 13, 38, 15, armD); sLine(27, -2, 27, 13, armL);
    sRect(24, 4, 37, 6, C('night', 0)); const eg = o.eyeGlow || 0;
    sRect(29, 4, 30, 5, vio, 3); sRect(33, 4, 34, 5, vio, 3); if (eg > 0.5) { sp(29, 4, WHITE, 3); sp(33, 4, WHITE, 3); }
    // the crest: violet strands streaming back like a flame
    for (let k = 0; k < 7; k++) { const bx = 27 + k * 1.2, L = 12 + (k % 3) * 4 + Math.sin(T_NOW * 7 + k * 1.7) * 2; let px = bx, py = -3; for (let j = 1; j <= 6; j++) { const u = j / 6, nx = bx - u * L * 0.9 - w * u * 2, ny = -3 - u * L * 0.55 + u * u * L * 0.5 + Math.sin(T_NOW * 9 + k + j) * u * 1.2; sLine(px, py, nx, ny, j < 3 ? vioL : k & 1 ? vio : C('violet', 5), j < 4 ? 3 : 2, 3); px = nx; py = ny; } }
  }
  function vesper3(o, wx, wy, wz, opt) {
    const p = proj(wx, wy, wz); if (!p) return null;
    const S = snapS(CAM.F / p.z * (opt.size || 1) / 26); if (S > 14) return null;
    clearSprite(); drawVesper3(o); outlineSprite(C('night', 0));
    clearMask(); const x = Math.round(p.x), y = Math.round(p.y);
    stamp(x, y, S, 0, opt.flip, Object.assign({ z: p.z, fog: true }, opt));
    return { x, y, S, z: p.z, eyes: [x + (opt.flip ? -1 : 1) * 1.5 * S, y - 56 * S], lantern: [x + (opt.flip ? 1 : -1) * 17 * S, y - 17 * S] };
  }
  // the fog: everything far off goes pale lavender, by depth
  const T_FOG = tab('#cfc6e2');
  function fogDepth(near, far, amax) { for (let y = LB; y < H - LB; y++) for (let x = 0; x < W; x++) { const i = y * W + x, z = IDB[i] === 0 ? far : ZB[i], a = amax * sstep(near, far, z); if (a > 0.02) tintI(i, x, y, T_FOG, a); } }
  shot(292.0, 300.0, (lt, t) => {
    if (t > 298.5) { BUF.fill(BLACK); return; }
    // where the knight is: one heavy step every 1.2 s, each landing on a footfall in the score
    const st = clamp((t - 291.6) / 1.2, 0, 4.2), vx = 17.2 - st * 1.15, ph = st * PI;   // a foot comes down at st = 0.5, 1.5, … = each footfall in the score
    const plant = VSTEPS.some((s) => t > s && t < s + 0.12);
    if (t < 297.2) {
      // from the planks beside the fallen two: the Bellwether turns; something walks out of the white
      const u = lin(292, 297.2, t);
      lookAt(-13.4 + u * 0.9, 1.25, -0.9, 14, 3.1 - u * 0.15, -1.6, 46);
      harbour(t, { noGulls: true });
      harbourHush(t, () => 1);
      hollowCrowd(t, { dark: 1, part: sstep(292.4, 294.5, t) });
      bellwether(t, DY, { arms: lerp(-0.9, 0.9, eio(lin(292.0, 293.6, t))), ring: 0 }, { flip: t > 293.2, rim: { side: 1, T: T_VIO, a: 0.3 * lin(292.5, 295, t) } });
      atFeet('tamo', { view: 'side', eyes: t > 294.5 ? 'half' : 'closed', brows: 'worried', armF: -2.6, armB: 2.4, bob: 0, mouth: 0.1 }, -3.75, DY + 0.36, TZ, PI / 2, { gy: DY, sx: -3.0, sr: 0.9, dark: 1 });
      atFeet('kaira', { view: 'side', eyes: 'closed', brows: 'worried', armF: 2.6, armB: -2.5, blade2: 2.4, bob: 0 }, -4.8, DY + 0.36, KZ + 0.3, PI / 2, { gy: DY, sx: -4.3, sr: 0.9, dark: 1 });
      fogDepth(9, 40, 0.85);
      const vs = vesper3({ step: ph, wind: 1.5, eyeGlow: 0.3 }, vx, DY, VZ, { size: 1.8, flip: true, dark: 2, tint: { T: T_FOG, a: 0.85 * (1 - sstep(292.0, 295.6, t)) }, rim: { side: 1, T: T_VIO, a: 0.4 } });
      // the lantern's light, the eyes, the dust of each footfall
      if (vs) { glow(vs.lantern[0], vs.lantern[1], 7 * vs.S, T_VIO, 0.35); glow(vs.eyes[0], vs.eyes[1], 3 * vs.S, T_VIO, 0.5); }
      for (let k = 0; k < VSTEPS.length; k++) { const g = t - VSTEPS[k]; if (g > 0 && g < 1.2) dust3(17.2 - ((VSTEPS[k] - 291.6) / 1.2) * 1.15, VZ, g, 0.9, 520 + k); }
      if (plant) shk(1.2);
    } else {
      // the helm, close; the eyes flare
      const u = lin(297.2, 298.5, t);
      lookAt(vx - 7.6 + u * 0.6, DY + 2.6, VZ - 2.4, vx, DY + 3.45, VZ, 40);
      harbour(t, { noGulls: true }); harbourHush(t, () => 1);
      fogDepth(4, 30, 0.8);
      const fl_ = sstep(297.35, 297.75, t);
      const vs = vesper3({ step: ph, wind: 2 + u, eyeGlow: fl_ }, vx, DY, VZ, { size: 1.8, flip: true, dark: 1, rim: { side: 1, T: T_VIO, a: 0.5 } });
      if (vs) { glow(vs.eyes[0], vs.eyes[1], (4 + fl_ * 10) * vs.S / 2, T_VIO, 0.85); if (fl_ > 0.3) for (const dx of [-2.5, 1.5]) sparkle(Math.round(vs.eyes[0] + dx * vs.S), Math.round(vs.eyes[1]), fl_ * 3 * vs.S, WHITE, C('violet', 7)); }
      for (let k = 0; k < 30; k++) { const yy = 40 + ih(k, 1, 530) * 190, x = frac(ih(k, 2, 530) - t * 0.08) * 600 - 60; lineF(x, yy, x + 30, yy, (xx, y2) => { if (bay(xx, y2) < 0.25) tintP(xx, y2, T_FOG, 0.6); }); }
    }
  });
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
    id: 'ep1',
    title: 'Unforgotten · Episode 1',
    medium: 'Pixel art in 128 colours, 480 × 270, drawn in JavaScript · 5 min',
    note: 'The Courier, part one · tap to pause',
    about: 'Episode one of an original pixel-art series. Years ago, a crown in the sky erased a hillside village and everyone in it, and a girl named Sable swore on a burning sword. Now, in the cloud city of Halcyon Spire, the courier Kaira is framed for stealing the Storm Seed, falls into the harbour on top of a dockhand called Tamo, and the same white ring opens over the sea.',
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
        window.__ep1 = {
          duration: D,
          isReady: () => ready && faded(),
          renderAt(t) { return new Promise((res) => { const t0 = performance.now(); draw(t); window.__ep1.lastMs = performance.now() - t0; requestAnimationFrame(() => requestAnimationFrame(res)); }); },
          lastMs: 0,
        };
        document.documentElement.dataset.ready = 'ep1';
        api.ready();
      } else {
        window.__ep1 = { duration: D, isReady: () => ready, renderAt(t) { return new Promise((res) => { playing = false; clock = t; draw(t); requestAnimationFrame(() => res()); }); } };
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
          if (window.__ep1) delete window.__ep1;
        },
      };
    },
  });
})();
