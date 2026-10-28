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
    T_TEAL = tab('#5fe6d0', true), T_VIO = tab('#a070ff', true), T_RED = tab('#ff3050', true), T_COLD = tab('#2a3a70'), T_SEPIA = tab('#3a2a1a');

  /* ================================================================ buffers & primitives */
  const BUF = new Uint8Array(NP), ZB = new Float32Array(NP), IDB = new Uint16Array(NP);
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
  function beginWorld() { ZB.fill(1e9); IDB.fill(0); QID = 1; }
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
      poly3([pts[0], pts[3], pts[2], pts[1]], (u, v, x, y, t) => mat(nm, v, u, x, y, t, L), opt);
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
      if (o.run !== undefined) { const s = Math.sin(o.run); a = s * 1.4; b = -s * 1.4; la = Math.max(0, -s) * 3; lb = Math.max(0, s) * 3; }
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
    const ls = o.run !== undefined ? Math.sin(o.run) : 0;
    if (P.robe) { sPoly([[tx + 1, ty + 9], [tx + 15, ty + 9], [tx + 18, 59], [tx - 2, 59]], P.robe); sRect(tx - 2, 57, tx + 18, 58, P.robeD); }
    else { sRect(25, ty + 14, 28, 60 - Math.max(0, ls) * 3, P.legD); sRect(32, ty + 14, 35, 60 - Math.max(0, -ls) * 3, P.leg); sRect(24, 59 - Math.max(0, ls) * 3, 29, 60 - Math.max(0, ls) * 3, P.bootD); sRect(31, 59 - Math.max(0, -ls) * 3, 36, 60 - Math.max(0, -ls) * 3, P.boot); }
    if (back && P.backB) P.backB(o, hx, hy);
    // arms (screen-left and screen-right)
    const aL = o.armL === undefined ? 1.9 : o.armL, aR = o.armF === undefined ? 1.25 : o.armF, rr = 7 + (o.reach || 0);
    const sl = [tx + 1, ty + 3], sr = [tx + 15, ty + 3], hl = [sl[0] + Math.cos(aL) * 7, sl[1] + Math.sin(aL) * 7], hr = [sr[0] + Math.cos(aR) * rr, sr[1] + Math.sin(aR) * rr];
    sLine(sl[0], sl[1], hl[0], hl[1], P.armD, 3); sLine(sr[0], sr[1], hr[0], hr[1], P.arm, 3);
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
    sRect(hl[0] - 1, hl[1] - 1, hl[0] + 1, hl[1] + 1, P.skin || SKIN.m); sRect(hr[0] - 1, hr[1] - 1, hr[0] + 1, hr[1] + 1, P.skin || SKIN.m);
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
  function buildChar(who, o) {
    clearSprite();
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
      BUF[i] = c; if (!opt.noZ) ZB[i] = z; IDB[i] = 65535;
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
  // place a character in screen space: feet at (x, y), S scale. Hollow get ghosts and tearing.
  function actor(who, o, x, y, S, opt) {
    opt = opt || {};
    const r = buildChar(who, o);
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
    return r ? { hand: L(r.hand), head: L(r.head), chest: L(r.chest) } : { head: L([30, 20]) };
  }
  // place a character in the world: feet at (wx, wy, wz), hgt = sprite pixels per world metre (≈ 28 px is 1.6 m tall at S=1)
  function actor3(who, o, wx, wy, wz, opt) {
    opt = opt || {}; const p = proj(wx, wy, wz); if (!p) return null;
    const S = CAM.F / p.z * (opt.size || 1) / 26;
    return Object.assign(actor(who, o, p.x, p.y, S, Object.assign({ z: p.z, fog: true }, opt)), { S, x: p.x, y: p.y, z: p.z });
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
  function hushOver(amt, t, flecks) {
    if (flecks === undefined) flecks = true;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const a = amt(x, y); if (a <= 0) continue;
      const i = y * W + x;
      if (a >= 1) { const l = LUM[BUF[i]]; BUF[i] = l > 150 ? WHITE : l > 80 ? C('hush', 6) : l > 40 ? C('hush', 4) : C('hush', 2); continue; }
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
  let SHX = 0, SHY = 0;
  function render(t) {
    t = clamp(t, 0, D - 1 / FPS);
    T_NOW = t; SHAKE_A = 0; BUF.fill(BLACK); beginWorld();
    let S = SHOTS[0]; for (const s of SHOTS) if (t >= s.t0) S = s;
    S.fn(t - S.t0, t, S.t1 - S.t0);
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
  function drawRooftops(t, opt) {
    opt = opt || {};
    setSun(-0.55, 0.45, 0.7, 0.45); setFog('#f0b3a6', 40, 260, 0.85);
    sky(skyDawn);
    plane(0, cloudSea, { maxD: 600 });
    for (const T of HS.towers) { if (Math.abs(T.x + 60) < 30 + T.r || Math.hypot(T.x - CAM.x, T.z - CAM.z) > 380) continue; prism(T.x + 60, T.z + 120, T.r, -10, T.h, T.n, towerWin(3.4, T.seed)); cone(T.x + 60, T.z + 120, T.r * 1.25, T.h, T.cap, T.n, goldRoof); }
    for (const r of RT.roofs) {
      if (r.z1 < CAM.z - 4 || r.z0 > CAM.z + 140) continue;
      box(r.x0, r.y - 14, r.z0, r.x1, r.y, r.z1, (face, u, v, x, y, tt, L) => face === 'top' ? shadeC(R.linen, 2.6 + L * 2.6 + (frac(u / 0.8) < 0.08 || frac(v / 0.8) < 0.08 ? -0.9 : 0), x, y) : towerWin(3, r.seed)(face, u, v, x, y, tt, L));
      if (ih(r.seed, 1, 103) < 0.6) box(r.x0 + 0.8, r.y, r.z0 + 1.5, r.x0 + 1.6, r.y + 1.8, r.z0 + 2.3, flatMat(R.stone, 2.6));         // chimney
      if (ih(r.seed, 2, 103) < 0.4) { prism(r.x1 - 1.5, r.z1 - 2, 0.9, r.y, r.y + 1.6, 6, flatMat(R.wood, 2.6)); cone(r.x1 - 1.5, r.z1 - 2, 1.1, r.y + 1.6, 0.8, 6, flatMat(R.wood, 2)); } // water tank
      // prayer flags strung over the gap to the next roof
      if (ih(r.seed, 3, 103) < 0.7 && r.lane === 0) for (let k = 0; k < 8; k++) { const z = r.z1 - 1 + k * 0.5, sag = Math.sin(k / 7 * PI) * 0.7, x = r.x0 + 0.5 + k * 0.7; const fy = r.y + 3.2 - sag; poly3([[x, fy, z], [x + 0.4, fy, z], [x + 0.2 + Math.sin(t * 6 + k) * 0.1, fy - 0.6, z + 0.05]], () => C([R.crimson, R.gold, R.indigo, R.teal, R.linen][k % 5], 5), { two: true }); }
    }
  }

  // ---------------------------------------------------------------- the harbour ring at the foot of the spire
  const HB = { boats: [], crates: [], posts: [] };
  (function buildHarbour() {
    for (let k = 0; k < 9; k++) HB.boats.push({ x: -40 + k * 11 + ih(k, 1, 111) * 4, z: 18 + ih(k, 2, 111) * 30, len: 6 + ih(k, 3, 111) * 4, rot: ih(k, 4, 111) * 0.6 - 0.3, mast: ih(k, 5, 111) < 0.7, seed: k });
    for (let k = 0; k < 14; k++) HB.crates.push({ x: (k & 1 ? -1 : 1) * (13 + ih(k, 1, 112) * 14), z: -2 + ih(k, 2, 112) * 5, s: 0.8 + ih(k, 3, 112) * 0.5, barrel: ih(k, 4, 112) < 0.4 });
    HB.crates.push({ x: -10.4, z: 2.6, s: 0.9, barrel: true }, { x: -9.6, z: 3.1, s: 0.8, barrel: false });
    for (let k = 0; k < 16; k++) HB.posts.push([-20 + k * 2.6, 4.4]);
  })();
  const waterTex = (lights) => (wx, wz, d, x, y) => {
    const w = Math.sin(wx * 1.3 + T_NOW * 1.6 + Math.sin(wz * 0.7) * 2) + Math.sin(wz * 2.1 - T_NOW * 2.2 + wx * 0.4) * 0.7, n = vn(wx * 3, wz * 6 + T_NOW * 2, 1, 113);
    let s = 2.6 + w * 0.5 + n * 0.8;
    if (lights) for (const L of lights) { const dx = Math.abs(x - L[0]); if (dx < L[2] && y > L[1] && ih(fl(x / 2), y, fl(T_NOW * 8)) < 0.5 * (1 - dx / L[2])) s += 2.5; }
    if (n > 0.86) s += 2;
    return shadeC(R.sea, s, x, y);
  };
  const plankMat = (base) => (face, u, v, x, y, t, L) => { const p = fl(u / 0.35), seam = frac(u / 0.35) < 0.12; return shadeC(R.wood, (base || 2.4) + L * 2.6 + (ih(p, 3, 114) - 0.5) - (seam ? 1.1 : 0), x, y); };
  function drawHarbour(t, opt) {
    opt = opt || {};
    setSun(-0.7, 0.4, 0.6, 0.45); setFog(opt.fogHex || '#f0c9a0', 30, 190, 0.8);
    sky(opt.sky || skyDawn);
    // the city wall rising behind the harbour, and the spire far above
    for (let k = 0; k < 12; k++) box(-90 + k * 15, -2, 70 + ih(k, 1, 115) * 10, -78 + k * 15, 22 + ih(k, 2, 115) * 26, 84, towerWin(2.8, k + 40));
    prism(0, 160, 9, -2, 160, 10, towerWin(4, 1)); cone(0, 160, 11, 160, 26, 10, goldRoof);
    // the lighthouse on the breakwater
    prism(70, 60, 2.6, -1, 22, 8, (f, u, v, x, y, tt, L) => shadeC(fl(v / 3) % 2 ? R.crimson : R.linen, 3 + L * 2.5, x, y)); cone(70, 60, 3, 22, 3, 8, flatMat(R.crimson, 2));
    plane(-0.4, waterTex(opt.lights), { maxD: 400 });
    // the dock: a long pier of planks on posts
    box(-30, -0.4, -4, 30, 0.35, 4, (f, u, v, x, y, tt, L) => f === 'top' ? plankMat(2.6)(f, v, u, x, y, tt, L) : plankMat(1.8)(f, u, v, x, y, tt, L));
    for (const [x, z] of HB.posts) { box(x - 0.18, -3, z - 0.18, x + 0.18, 1.1, z + 0.18, plankMat(1.6)); box(x - 0.18, -3, -z - 0.18, x + 0.18, 1.1, -z + 0.18, plankMat(1.6)); }
    for (const c of HB.crates) {
      if (opt.skipCrate && opt.skipCrate(c)) continue;
      if (c.barrel) { prism(c.x, c.z, c.s * 0.45, 0.35, 0.35 + c.s * 1.1, 8, (f, u, v, x, y, tt, L) => shadeC(R.wood, 2.4 + L * 2.4 - (frac(v / 0.35) < 0.15 ? 1.2 : 0), x, y)); }
      else box(c.x - c.s / 2, 0.35, c.z - c.s / 2, c.x + c.s / 2, 0.35 + c.s, c.z + c.s / 2, (f, u, v, x, y, tt, L) => shadeC(R.wood, 2.8 + L * 2.4 - (frac(u / 0.25) < 0.12 ? 1 : 0) - (u < 0.06 || v < 0.06 || u > c.s - 0.06 || v > c.s - 0.06 ? 1.2 : 0), x, y));
    }
    for (const b of HB.boats) {
      const bob = Math.sin(t * 1.3 + b.seed) * 0.12, ca = Math.cos(b.rot), sa = Math.sin(b.rot), hl = b.len / 2;
      const pt = (u, w, h) => [b.x + ca * u - sa * w, h + bob, b.z + sa * u + ca * w];
      const hull = (f, u, v, x, y, tt, L) => shadeC(b.seed % 3 ? R.wood : R.crimson, 2 + L * 2.6 - (frac(v / 0.3) < 0.15 ? 0.8 : 0), x, y);
      poly3([pt(-hl, -1.2, 0.8), pt(hl, -1.2, 0.8), pt(hl - 1, -0.6, -0.5), pt(-hl + 0.6, -0.6, -0.5)], hull, { two: true });
      poly3([pt(hl, 1.2, 0.8), pt(-hl, 1.2, 0.8), pt(-hl + 0.6, 0.6, -0.5), pt(hl - 1, 0.6, -0.5)], hull, { two: true });
      poly3([pt(hl, -1.2, 0.8), pt(hl + 1.4, 0, 1.0), pt(hl, 1.2, 0.8)], hull, { two: true });
      poly3([pt(-hl, -1.2, 0.8), pt(hl, -1.2, 0.8), pt(hl, 1.2, 0.8), pt(-hl, 1.2, 0.8)], (f, u, v, x, y) => shadeC(R.wood, 3.6 - (frac(u / 0.4) < 0.12 ? 1 : 0), x, y));
      if (b.mast) { const m = pt(0, 0, 0.8), top = [m[0], m[1] + 6, m[2]]; l3(m[0], m[1], m[2], top[0], top[1], top[2], C('wood', 2), 2); poly3([[top[0], top[1] - 0.4, top[2]], [top[0] + ca * 3, top[1] - 1, top[2] + sa * 3], [m[0] + ca * 3.2, m[1] + 1.2, m[2] + sa * 3.2], [m[0], m[1] + 1.2, m[2]]], (f, u, v, x, y, tt) => shadeC(R.linen, 5 + Math.sin(u * 2 + t) * 0.4, x, y), { two: true }); }
    }
  }
  function gulls(t, n, cx, cy, cz, frozen) {
    for (let k = 0; k < n; k++) {
      const tt = frozen === undefined ? t : frozen, a = tt * (0.35 + ih(k, 1, 121) * 0.25) + ih(k, 2, 121) * TAU, r = 8 + ih(k, 3, 121) * 14;
      const x = cx + Math.cos(a) * r, y = cy + ih(k, 4, 121) * 7 + Math.sin(tt * 2 + k) * 0.6, z = cz + Math.sin(a) * r;
      const p = proj(x, y, z); if (!p) continue; const s = Math.max(1, Math.round(CAM.F / p.z * 0.35)), fw = Math.sin(tt * 10 + k * 3);
      for (let i = -s; i <= s; i++) PZ(p.x + i, p.y - Math.abs(i) * fw * 0.6, i === 0 ? C('stone', 5) : WHITE, p.z);
    }
  }

  /* ================================================================ dialogue: timings and mouth envelopes (generated) */
  const DLG = [{"id": "L01", "who": "sable_vo", "text": "Everything has a name.", "t0": 3.0, "dur": 1.111, "env": "6865787435677644666678998877665665"}, {"id": "L02", "who": "sable_vo", "text": "A name is a promise... that something was here.", "t0": 9.6, "dur": 2.474, "env": "689998899998876653223688877666664200000000012334568998545777766553357776664"}, {"id": "L03", "who": "mira", "text": "Sable! I wrote it! I wrote my name on the wall, just like you showed me!", "t0": 18.3, "dur": 3.964, "env": "13688876568876554310000258756787777777542100000157756787777777777777777777766667777654321135422465235655677776324654442"}, {"id": "L04", "who": "sable", "text": "[chuckle] Then the wall will remember you. Even when I'm old and forgetful.", "t0": 24.6, "dur": 4.151, "env": "54201453100001222210003799999876788999875457766677777777655534555555310000000136875789888888888899888765455531145457874211144"}, {"id": "L05", "who": "king", "text": "Hush now.", "t0": 38.4, "dur": 0.748, "env": "79998888999999998776664"}, {"id": "L06", "who": "mira", "text": "Sable...?", "t0": 52.4, "dur": 0.381, "env": "589997688753"}, {"id": "L07", "who": "sable", "text": "Mira, take my hand! Don't let go. Don't let go!", "t0": 55.4, "dur": 3.555, "env": "57877665420000000014677435888876666666787520000000002699987778886323699988742000001479987778986325899988864"}, {"id": "L08", "who": "sable", "text": "No! Mira!", "t0": 60.5, "dur": 1.185, "env": "578899988754210000000136778889999864"}, {"id": "L09", "who": "sable_vo", "text": "I don't remember her face anymore.", "t0": 66.2, "dur": 1.398, "env": "577898778999975567642247998766677777776665"}, {"id": "L10", "who": "sable_vo", "text": "I remember that I swore.", "t0": 77.4, "dur": 1.201, "env": "6876789998888766666567766776435788754"}, {"id": "L11", "who": "warden", "text": "The Storm Seed... it's gone!", "t0": 104.9, "dur": 1.618, "env": "4664368999987655554443210000000014544422799887763"}, {"id": "L12", "who": "oren", "text": "The courier. Kaira was the last one in the vault. Find her!", "t0": 107.0, "dur": 4.127, "env": "2222356654321000000000000000013467666544322222345422454556665553123566665443333211354310000000000000000000000258887776677763"}, {"id": "L13", "who": "kaira", "text": "[gasp] Okay. Okay. Framed, chased, and glowing. Great start to the week.", "t0": 123.0, "dur": 4.517, "env": "7999633568876433210000000000279985446898863000269999999886553125667888875443221268986347888776654321000000025899742333698731356677777764"}, {"id": "L14", "who": "oren", "text": "Courier! Return the Seed!", "t0": 128.6, "dur": 2.416, "env": "4557888877665421000000000000000257753135546777777767888877666666666655310"}, {"id": "L15", "who": "kaira", "text": "I don't HAVE it!", "t0": 131.6, "dur": 0.796, "env": "687888754567774356532100"}, {"id": "L16", "who": "kaira", "text": "[sigh] Okay. I might have it.", "t0": 134.3, "dur": 1.825, "env": "6998753100000026522467776531000000002589999743457753454"}, {"id": "L17", "who": "oren", "text": "Five days, courier. That's how long the elders give you before it tears you apart. Come quietly.", "t0": 153.5, "dur": 6.445, "env": "67778876444689987654445421357876543100000000000000001589756666887766899877666664126888655666651157865445544565323567776411455688776555555541013565310000000000000000000000000146898774334678776432"}, {"id": "L18", "who": "kaira", "text": "Quiet's not really my thing.", "t0": 162.3, "dur": 1.351, "env": "26899986335788875578888877775302566667764"}, {"id": "L19", "who": "tamo", "text": "Hey! That was the GOOD crate!", "t0": 182.6, "dur": 1.595, "env": "688888876410000000258888876677557998533467877653"}, {"id": "L20", "who": "kaira", "text": "Sorry! Not sorry! You should run.", "t0": 185.0, "dur": 1.776, "env": "479999987554310147985335788765532001577778767898776554"}, {"id": "L21", "who": "tamo", "text": "Run from wh-", "t0": 187.6, "dur": 0.5, "env": "589998657988875"}, {"id": "L22", "who": "tamo", "text": "Three grown-ups... against one girl?", "t0": 191.6, "dur": 2.144, "env": "37998657899877764113544310000001366679887644467898877766788888874"}, {"id": "L23", "who": "docker", "text": "Kid, that anchor hasn't moved in a hundred years", "t0": 197.6, "dur": 2.699, "env": "357887420000000025887667887644666667875456777777765346777667776556544567765321111"}, {"id": "L24", "who": "tamo", "text": "That's not very fair... for you.", "t0": 205.6, "dur": 1.868, "env": "686456899854678775311589888775310000000013788899999998763"}, {"id": "L25", "who": "kaira", "text": "Okay. Who ARE you?", "t0": 221.0, "dur": 1.205, "env": "7853467653100000002698779998876765542"}, {"id": "L26", "who": "tamo", "text": "Tamo! I work here. Well. I did, until you landed on me.", "t0": 222.9, "dur": 3.6, "env": "5898776532100000001578887789852124653200000000001356666663100000258876579998667654467666666677665556655555554"}, {"id": "L27", "who": "kaira", "text": "What is that?", "t0": 230.6, "dur": 0.598, "env": "688875226999864100"}, {"id": "L28", "who": "tamo", "text": "Hollow. They took the lighthouse keeper last week. Nobody even remembers his name.", "t0": 235.6, "dur": 4.132, "env": "6888776543100001589645885126888899877787665235532466667776554335776411100001478876777754566556777766777666665555545666655554"}, {"id": "L29", "who": "oren", "text": "No... not here. Not the harbor.", "t0": 242.2, "dur": 2.502, "env": "5789998642100000000146789997543467777643100000000001468986225765557998633443"}, {"id": "L30", "who": "bellwether", "text": "The courier. And the anchor-bearer. Two of four.", "t0": 262.6, "dur": 3.031, "env": "6656778777766554321000000001478898778998776664456654444322110000013567888877876554467766543"}, {"id": "L31", "who": "bellwether", "text": "[chuckle] The King will be so pleased.", "t0": 267.0, "dur": 1.77, "env": "786665531000013334688777787677665568887665577776655433"}, {"id": "L32", "who": "tamo", "text": "Kaira! Whatever you've got, now would be a really good time!", "t0": 279.0, "dur": 4.313, "env": "3689999988889999999999999998876531000247888899877887778763369998642122101357889999988776677545788776556899987764467742357877655432"}, {"id": "L33", "who": "kaira", "text": "I don't know how to use it!", "t0": 283.8, "dur": 1.254, "env": "69999999999876788887678999973368741012"}, {"id": "L34", "who": "vesper", "text": "Step away from them.", "t0": 296.0, "dur": 0.805, "env": "7864567899885335655666654"}];

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
  // a big child's hand with chalk, for the close-up (x, y is the chalk tip)
  function chalkHand(x, y) {
    const sk = C('skin', 5), skd = C('skin', 3), sl = C('gold', 5), sld = C('gold', 3), ink_ = C('wood', 0);
    // the sleeve: a yellow cuff running off the bottom-right of the frame
    for (let yy = 16; yy < 120; yy++) for (let xx = -10; xx < 120; xx++) { const u = xx - (yy - 16) * 0.75; if (u > -4 && u < 52) P(x + xx + 4, y + yy, u < -1 || u > 49 ? ink_ : u > 40 ? sld : (yy < 24 ? C('gold', 6) : sl)); }
    // the hand: a fist pinching the chalk
    for (let yy = -4; yy < 30; yy++) for (let xx = -6; xx < 30; xx++) { const d = ((xx - 12) / 16) ** 2 + ((yy - 12) / 14) ** 2; if (d < 1) P(x + xx, y + yy, d > 0.8 ? ink_ : yy > 16 ? skd : sk); }
    for (let k = 0; k < 3; k++) { const fx = x + 4 + k * 5, fy = y + 1 + k; for (let yy = -3; yy < 4; yy++) for (let xx = -2; xx < 3; xx++) if (xx * xx + yy * yy < 9) P(fx + xx, fy + yy, xx * xx + yy * yy > 5 ? ink_ : sk); }
    rectF(x - 4, y - 6, 6, 9, WHITE); rectF(x - 4, y + 1, 6, 2, C('hush', 3)); rectF(x - 5, y - 7, 8, 1, ink_);
  }

  // 1 — the chalk (0:00)
  shot(0, 7.5, (lt, t) => {
    const letters = lin(1.6, 6.0, lt) * 4.6;
    chalkWall(t, lt, letters, 0);
    if (lt > 1.4 && lt < 6.6) {
      const k = Math.min(3, fl(letters)), g = FONT['MIRA'[k]], u = frac(letters), gw = g[0].length;
      const px = 196 + k * (gw + 1) * 9 + (u * gw) * 9, py = 92 + Math.sin(u * PI * 3) * 26 + 30;
      chalkHand(px, py);
    }
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
    actor3('mira', { view: 'back', run: t * 15, lantern: true }, 0.2, my, mz, { size: 0.72, dark: 1, rim: { side: 1, T: T_EMBER, a: 0.4 } });
    ink(2); emberwickLights(t);
    const mp = proj(0.4, my + 0.4, mz); if (mp) glow(mp.x, mp.y, 16 * CAM.F / mp.z / 10, T_EMBER, 0.5);
    rain3(t, 420, 0.8, 0.15, RAINC, 91, 20);
  });

  // 3 — the shrine: Sable tying a red cord on her sword by the fire; Mira bursts up the steps (0:17)
  shot(17.0, 23.5, (lt, t) => {
    lookAt(-4.4 + lt * 0.15, 14.6, 63.8 + lt * 0.2, 0.8, 13.4, 72.4, 50);
    drawEmberwick(t);
    const mz = lerp(63, 70.4, eoc(lin(0, 1.8, lt))), my = streetY(mz);
    ink(2); emberwickLights(t);
    const turn = lt > 2.2;
    actor3('sable', { kneel: true, crouch: 1.4, armF: 0.4, sword: turn ? -0.4 : -0.05, eyes: blink(t, 3) ? 'closed' : turn ? 'open' : 'half', smile: turn ? 0.6 : 0.2, mouth: mouth('sable', t), wind: 1 }, 1.9, 12.6, 72.6, { flip: !turn, dark: 1, rim: { side: turn ? 1 : -1, T: T_EMBER, a: 0.65 } });
    actor3('mira', { view: lt < 1.8 ? 'back' : 'side', run: lt < 1.8 ? t * 16 : undefined, lantern: true, eyes: blink(t, 4) ? 'closed' : 'open', mouth: mouth('mira', t), smile: 0.7, armF: talking('mira', t) ? -0.6 + Math.sin(t * 9) * 0.5 : 1.2 }, lerp(-0.4, -0.9, lin(0, 1.8, lt)), my, mz, { size: 0.72, dark: 1, rim: { side: 1, T: T_EMBER, a: 0.6 } });
    rain3(t, 360, 0.8, 0.15, RAINC, 92, 16);
  });

  // 4 — two-shot by the fire: "then the wall will remember you" (0:23)
  shot(23.5, 30.0, (lt, t) => {
    lookAt(-0.6 - lt * 0.06, 14.3, 66.9 + lt * 0.12, 1.3, 13.5, 72.6, 46);
    drawEmberwick(t, { cull: (h) => h.z0 > 55 });
    ink(2); emberwickLights(t);
    const pat = lt > 3.6 && lt < 5.2;
    actor3('sable', { view: 'front', kneel: true, crouch: 1.4, armF: pat ? -1.3 : 1.0, armL: 1.6, eyes: blink(t, 3) ? 'closed' : lt > 4.4 ? 'half' : 'open', smile: 0.7, mouth: mouth('sable', t), look: -1 }, 2.0, 12.6, 72.8, { dark: 1, rim: { side: -1, T: T_EMBER, a: 0.75 } });
    actor3('mira', { view: 'front', lantern: true, eyes: pat ? 'closed' : blink(t, 4) ? 'closed' : 'open', smile: 0.9, blush: pat, mouth: 0, look: 1, bob: pat ? 1 : 0 }, 0.6, 12.6, 72.0, { size: 0.72, dark: 1, rim: { side: 1, T: T_EMBER, a: 0.75 } });
    rain3(t, 200, 0.6, 0.15, RAINC, 93, 8);
  });

  // 5 — the rain stops in the air; Sable looks up; the sky opens a ring of glyphs (0:30)
  const FREEZE = 30.6;
  shot(30.0, 36.0, (lt, t) => {
    const ft = Math.min(t, FREEZE);
    if (lt < 2.4) {
      // close on Sable, drops hanging in front of her face
      lookAt(0.6, 13.7, 68.6, 2.0, 13.5, 72.8, 30);
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
    lookAt(-0.9, 13.4, 68.9, 0.6, 13.15, 72.0, 34);
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
    lookAt(1.2, 13.65, 68.4, 2.0, 13.5, 72.8, 30 - lt * 2.2);
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
    actor3('sable', { kneel: true, crouch: lt < pull ? 1.6 : 1.0, armF: lt < pull - 0.3 ? 1.6 : lt < pull ? 0.6 : -0.6, reach: lt < pull ? 3 : 0, eyes: lt > lit ? 'narrow' : 'half', brows: lt > lit ? 'angry' : 'worried', sword: sw, embers: lt > lit, mouth: 0, tear: lt < pull }, 1.4, 12.6, 72.4, { flip: true, dark: lt > lit ? 0 : 1, rim: lt > lit ? { side: 1, T: T_EMBER, a: 0.8 } : undefined });
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
      return whiteStone(3.6)(f, u, v, x, y, tt, L);
    });
    box(-22, 31.6, -0.6, 22, 32.2, 0, flatMat(R.gold, 2.6, 3));
    box(-14, 18, -26, 14, 30, -1, (f, u, v, x, y, tt, L) => f === 'top' ? shadeC(R.linen, 2.8 + L * 2.4 + (frac(u / 0.8) < 0.08 || frac(v / 0.8) < 0.08 ? -0.9 : 0), x, y) : towerWin(3, 9)(f, u, v, x, y, tt, L));
  }
  // 17 — the window bursts; Kaira, in slow motion, and her card; then she lands and runs (1:52)
  shot(112.0, 122.0, (lt, t) => {
    const g = t - GLASS0, st = slowmo(Math.max(0, g)), broken = g > 0;
    const freeze = g > 1.9 && g < 3.9;
    const fo = sstep(-0.2, 1.0, g), ru = sstep(4.2, 7.5, g);
    const kxr = -2.2 - Math.max(0, slowmo(Math.max(0, g)) - 2.2) * 6;
    lookAt(lerp(6.0, 4.0, fo) + (kxr + 2.2) * ru * 0.8, lerp(31.0, 31.4, fo), lerp(-18, -13.5, fo), lerp(0, -1.8, fo) + (kxr + 2.2) * ru, lerp(37.2, 31.6, fo), lerp(-0.5, -6.5, fo), lerp(60, 50, fo));
    drawFacade(t, broken);
    ink(2);
    // Kaira's arc out of the window to the roof
    let kx = 0, ky = 37, kz = 0.5, ka = 0, view = 'side';
    if (g > 0) {
      const u = clamp(st / 1.7, 0, 1);
      kx = lerp(0, -2.2, u); kz = lerp(-0.6, -7, u); ky = lerp(36.4, 30, u) + Math.sin(u * PI) * 2.4; ka = -u * TAU * 0.75;
      if (st > 1.7) { const r = st - 1.7; kz = -7; ky = 30; ka = r < 0.4 ? -PI * 1.5 - r * 4 : 0; kx = -2.2 - Math.max(0, r - 0.5) * 6; }
    }
    const fx = (sx) => sx;
    if (g > 0) {
      const ruN = st > 2.1;
      actor3('kaira', { view: ruN ? 'side' : 'side', run: ruN ? t * 18 : undefined, air: !ruN && st < 1.7, crouch: st > 1.7 && st < 2.2 ? 1 : 0, blade: 2.2, blade2: 2.6, seed: 0.6, wind: 4, eyes: 'narrow', brows: 'angry', armF: ruN ? 1.4 : -0.6 }, kx, ky, kz, { flip: st < 1.7, ang: ka, size: 1.25 });
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
    drawRooftops(t); ink(2);
    wardensChase(t, CH0, 4);
    actor3('kaira', { view: 'back', run: k.air ? undefined : t * 19, air: k.air, wind: 5, seed: 0.5 + 0.3 * Math.sin(t * 6) }, 0, k.y, k.z, {});
    streaks(PI / 2, 26, t, 1600, C('linen', 7), 40, 321, [0, LB, W, H - 2 * LB]);
  });
  // 19 — in front of her, running at us: "I don't HAVE it!" — the chest glows — a spear — the step (2:11)
  shot(131.0, 140.0, (lt, t) => {
    const k = kairaAt(CH0, t), dodge = lin(136.3, 136.5, t), seedA = sstep(132.8, 133.6, t);
    const kx = -1.6 * eoc(dodge);
    lookAt(-0.4, k.y + 1.3, k.z + 5.4, -0.2, k.y + 0.9, k.z, 58);
    drawRooftops(t); ink(2);
    wardensChase(t, CH0, 4, 'front');
    const after = dodge > 0 && dodge < 1 || (t > 136.3 && t < 136.8) ? [[proj(0, k.y, k.z) || { x: 0, y: 0 }]].map((q) => [q.x, q.y, C('gold', 6), 0.5]) : undefined;
    const kk = actor3('kaira', { view: 'front', run: k.air ? undefined : t * 19, air: k.air, wind: 2, seed: 0.4 + seedA * 0.6, eyes: t > 133 && t < 136 ? 'half' : 'wide', brows: t > 133.4 && t < 136 ? 'worried' : 'n', look: 0, mouth: mouth('kaira', t), smile: t > 134.3 && t < 136 ? -0.5 : 0 }, kx, k.y, k.z, { after });
    if (kk && seedA > 0) { glow(kk.chest[0], kk.chest[1], 30 * kk.S / 3 * (0.7 + 0.3 * Math.sin(t * 8)), T_GOLD, 0.55 * seedA); }
    // the spear
    if (t > 135.8 && t < 136.9) { const u = (t - 135.8) / 1.1, sz = k.z - 12 + u * 20, sx = lerp(-1, -0.2, u); l3(sx, k.y + 1.2, sz, sx, k.y + 1.25, sz + 2.2, C('wood', 4), 2); l3(sx, k.y + 1.25, sz + 2.2, sx, k.y + 1.26, sz + 2.8, C('stone', 7), 2); for (let c = 0; c < 8; c++) p3(sx, k.y + 1.2 + Math.sin(c + t * 20) * 0.08, sz - c * 0.35, C('stone', 6), 0.05); }
    if (dodge > 0 && dodge < 1) { for (let q = 0; q < 3; q++) { const p = proj(lerp(0, kx, q / 3), k.y + 0.8, k.z); if (p) { sparkle(p.x, p.y - q * 6, 6, WHITE, C('gold', 6)); } } shk(2); }
    if (t > 136.3 && t < 136.9) { const p = proj(kx, k.y + 0.8, k.z); if (p) for (let b = 0; b < 3; b++) lineF(p.x, p.y, p.x + (ih(b, fl(t * 30), 323) - 0.5) * 80, p.y + (ih(b, fl(t * 30) + 1, 323) - 0.5) * 60, (x, y) => P(x, y, C('gold', 7))); }
  });
  // 20 — the wide side view: three lanes, the clouds, a big spinning leap (2:20)
  shot(140.0, 148.0, (lt, t) => {
    const k = kairaAt(CH0, t);
    lookAt(21, k.y + 9.5, k.z - 1, 0, k.y + 0.6, k.z + 3, 46);
    drawRooftops(t); ink(2);
    wardensChase(t, CH0, 6, 'side');
    const spin = lin(142.6, 143.6, t);
    actor3('kaira', { view: 'side', run: k.air ? undefined : t * 19, air: k.air, wind: 5, blade: spin > 0 && spin < 1 ? -0.6 + spin * 4 : 2.0, blade2: 2.5, storm: spin > 0 && spin < 1, eyes: 'narrow', brows: 'angry' }, 0, k.y + Math.sin(spin * PI) * 1.4, k.z, { flip: true, ang: spin > 0 && spin < 1 ? -spin * TAU : 0 });
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
    lookAt(Math.sin(a) * r, BR.y + 2.8, KAIRA_EDGE - 1 - Math.cos(a) * r, 0, BR.y + 1.0, KAIRA_EDGE - 2, 58);
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
      lookAt(-0.6, BR.y + 1.6, OREN_Z - 1.6, 0, BR.y + 1.0, KAIRA_EDGE, 36);
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
      const ky_ = BR.y - Math.max(0, fall - 0.35) ** 2 * 14, kz_ = KAIRA_EDGE + fall * 2.2, cr = sstep(0.3, 1.0, fall);
      lookAt(0.2, BR.y + 1.4 + cr * 1.2, lerp(KAIRA_EDGE - 3.4, BR.z1 + 1.2, cr), 0, lerp(BR.y + 1.0, ky_ + 0.6, cr), lerp(KAIRA_EDGE, kz_ + 1.5, cr), 40 + cr * 10);
      drawBridge(t); ink(2);
      actor3('kaira', { view: 'front', eyes: u > 0.6 ? 'half' : 'open', brows: u > 0.6 ? 'up' : 'n', smile: u > 0.5 ? 0.8 : 0, mouth: mouth('kaira', t), seed: 0.6, wind: 3, armF: fall > 0 ? -1.2 : 1.3, armL: fall > 0 ? -1.9 : 1.9 }, 0, BR.y - Math.max(0, fall - 0.35) ** 2 * 14, KAIRA_EDGE + fall * 2.2, { ang: fall * 1.4 });
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
  function anchorProp(x, y, z, ang, size, glowA, opt) {
    clearSprite(); drawAnchor(30, 37, PI / 2, glowA); outlineSprite();
    const p = proj(x, y, z); if (!p) return null;
    const S = CAM.F / p.z / 26 * (size || 2.2);
    clearMask(); stamp(p.x, p.y, S, ang || 0, false, Object.assign({ z: p.z, fog: true }, opt || {}));
    return { x: p.x, y: p.y, S };
  }
  function crate3(x, y, z, s) { box(x - s / 2, y, z - s / 2, x + s / 2, y + s, z + s / 2, (f, u, v, xx, yy, tt, L) => shadeC(R.wood, 2.8 + L * 2.4 - (frac(u / 0.22) < 0.12 ? 1 : 0) - (u < 0.06 || v < 0.06 || u > s - 0.06 || v > s - 0.06 ? 1.2 : 0), xx, yy)); }
  function fish3(x, y, z, a, flop) { const p = proj(x, y, z); if (!p) return; const s = Math.max(2, Math.min(9, CAM.F / p.z * 0.16)), ca = Math.cos(a), sa = Math.sin(a); for (let k = -s; k <= s; k++) { const w = Math.max(0, (1 - Math.abs(k) / s) * s * 0.35); for (let j = -w; j <= w; j++) PZ(p.x + ca * k - sa * j, p.y + sa * k + ca * j, j < 0 ? C('stone', 7) : C('sea', 4), p.z - 0.05); } PZ(p.x + ca * s * 0.6, p.y + sa * s * 0.6 - 1, C('night', 0), p.z - 0.06); for (let j = -2; j <= 2; j++) PZ(p.x - ca * (s + 1) - sa * j * (1 + flop), p.y - sa * (s + 1) + ca * j, C('stone', 5), p.z - 0.05); }
  const ANCHOR_X = 6.2;
  // the morning harbour, with whatever has changed by time t
  function harbour(t, opt) {
    opt = opt || {};
    const drain = opt.drain || 0;
    drawHarbour(t, { lights: [], skipCrate: opt.skipCrate });
    ink(2);
    if (!opt.noGulls) gulls(t, 10, 2, 7, 14, t > 228.5 ? 228.5 : undefined);
    return drain;
  }
  // the hush over the harbour: a ring spreading from under the sigil
  const HUSH_O = [40, 0, 62], hushR = (t) => Math.min(52, Math.max(0, (t - 246.0) * 6));
  function harbourHush(t) {
    if (t < 228.5) return;
    const R0 = hushR(t);
    hushWorld(t, (wx, wy, wz) => {
      const d = Math.hypot(wx - HUSH_O[0], wz - HUSH_O[2]);
      let a = 0.14 * lin(228.5, 231, t);
      if (R0 > 0) a = Math.max(a, d < R0 - 4 ? 0.85 : d < R0 ? 1 : 0);
      return a;
    }, true);
  }

  // 24 — the dock at morning: Tamo with a crate; something falls out of the sky onto him (2:56)
  const IMPACT = 178.0;
  shot(176.0, 182.0, (lt, t) => {
    const g = t - IMPACT;
    lookAt(-8.5 + lt * 0.2, 2.0, -9.5, -3, 1.0, 1.5, 54);
    harbour(t);
    if (g < 0) {
      const x = lerp(-11, -3, lin(176, IMPACT, t));
      const a = actor3('tamo', { view: 'side', run: t * 8, armF: -1.5, armL: -1.6, eyes: 'closed', smile: 0.7, mouth: 0.3 + Math.sin(t * 6) * 0.1 }, x, DY, 0.4, { dark: 0 });
      crate3(x + 0.1, 1.95, 0.4, 0.95);
      // a streak from the sky
      if (g > -0.35) { const p = proj(x, 1.2, 0.4); if (p) { const top = Math.max(LB, p.y - 300 * (1 + g / 0.35)); for (let y = top; y < p.y - 30; y++) for (let q = -3; q <= 3; q++) if (bay(fl(p.x + q), fl(y)) < 1 - Math.abs(q) / 4) P(p.x + q, y, q === 0 ? WHITE : C('indigo', 6)); } }
    } else {
      // the pile-up
      const sit = lin(3.3, 3.8, g);
      actor3('tamo', { view: 'side', eyes: g < 3.2 ? 'closed' : 'open', brows: 'angry', armF: -0.4, mouth: 0 }, -3.3, DY + 0.05, 0.4, { ang: lerp(-1.5, -0.2, sit) });
      actor3('kaira', { view: 'side', eyes: 'closed', blade2: 2.4, wind: 1 }, -1.6, DY + 0.05, 0.9, { ang: 1.5, flip: true });
      if (g < 1.4) for (let k = 0; k < 18; k++) { const a = -PI * (0.1 + 0.8 * ih(k, 1, 401)), v = 2 + ih(k, 2, 401) * 4, gx = -2.6 + Math.cos(a) * v * g, gy = 1.6 + -Math.sin(a) * v * g - 4.9 * g * g, gz = 0.4 + (ih(k, 3, 401) - 0.5) * 2 * g; if (gy > DY) box(gx - 0.3, gy, gz - 0.06, gx + 0.3, gy + 0.08, gz + 0.06, flatMat(R.wood, 3)); }
      for (let k = 0; k < 9; k++) { const a = -PI * (0.15 + 0.7 * ih(k, 4, 401)), v = 1.5 + ih(k, 5, 401) * 3, land = 0.9 + ih(k, 6, 401) * 0.6; const gg = Math.min(g, land); fish3(-2.6 + Math.cos(a) * v * gg, Math.max(DY + 0.05, 1.6 - Math.sin(a) * v * gg - 4.9 * gg * gg), 0.4 + (ih(k, 7, 401) - 0.5) * 2 * gg, g > land ? Math.sin(t * 12 + k) * 0.6 : g * 9 + k, g > land ? Math.sin(t * 20 + k) : 0); }
      // one last fish, onto his head
      const fg = t - 180.5; if (fg > -0.5) { const fy = fg < 0 ? 1.8 - fg * 6 : 1.25 + DY; fish3(-3.25, fy, 0.38, fg > 0 ? 0.1 : -1.2, fg > 0 ? Math.sin(t * 22) : 0); }
      hitFx(240, 150, g, 1.2, [WHITE, C('gold', 6)]);
    }
  });

  // 25 — "that was the GOOD crate!" / "you should run" / "run from wh—" THUD THUD THUD (3:02)
  const THUDS = [188.6, 188.8, 189.0], WDX = [-7.2, -6.2, -5.2];
  function wardenDrop(t, k, x, z) { const g = t - THUDS[k]; const y = g < 0 ? DY + Math.min(14, -g * 30) : DY; return { y, g }; }
  shot(182.0, 197.0, (lt, t) => {
    if (t < 187.5) {
      lookAt(-2.0, 1.25, -3.8, -2.4, 0.9, 0.4, 46);
      harbour(t);
      actor3('tamo', { view: 'front', crouch: 1.2, kneel: false, eyes: blink(t, 21) ? 'closed' : 'open', brows: 'angry', mouth: mouth('tamo', t), smile: -0.6, armF: talking('tamo', t) ? -0.9 + Math.sin(t * 8) * 0.3 : 1.3 }, -3.0, DY, 0.4, {});
      fish3(-3.0, 1.18 + DY, 0.36, 0.2, Math.sin(t * 18));
      const up = lin(184.6, 185.0, t);
      actor3('kaira', { view: up > 0.5 ? 'front' : 'side', crouch: 1 - up, eyes: blink(t, 22) ? 'closed' : 'open', brows: t > 185 ? 'up' : 'worried', mouth: mouth('kaira', t), smile: t > 185 && t < 186 ? 0.5 : 0, armF: t > 186 ? -0.4 : 1.2, seed: 0.5, blade2: 2.4 }, -1.4, DY, 0.6, { flip: up < 0.5 });
    } else if (t < 189.4) {
      // Tamo, close: "run from wh—" … and three shapes land behind him
      lookAt(-2.6, 1.3, -2.6, -3.0, 1.05, 0.4, 40);
      harbour(t);
      for (let k = 0; k < 3; k++) { const d = wardenDrop(t, k); actor3('warden', { view: 'front', spear: -1.3, crouch: d.g > 0 && d.g < 0.2 ? 1 : 0, air: d.g < 0 }, WDX[k], d.y, 1.6 + k * 0.4, {}); if (d.g > 0 && d.g < 0.3) { const p = proj(WDX[k], DY, 1.6 + k * 0.4); if (p) shockRing(p.x, p.y, 4 + d.g * 120, 1 + d.g * 26, 2, [WHITE, C('linen', 6), C('linen', 4)], 1 - d.g / 0.3); shk(2); } }
      actor3('tamo', { view: 'front', crouch: 1.2, eyes: t > 188.7 ? 'wide' : 'open', brows: t > 188.7 ? 'up' : 'n', mouth: mouth('tamo', t), armF: 1.2 }, -3.0, DY, 0.4, {});
      fish3(-3.0, 1.18 + DY, 0.36, 0.2, Math.sin(t * 18));
    } else if (t < 191.6) {
      // over his shoulder: the three of them, spears down, low angle
      lookAt(-1.0, 1.25, -1.9, -6.2, 1.2, 2.0, 50);
      harbour(t);
      for (let k = 0; k < 3; k++) actor3('warden', { view: 'front', spear: -1.1 + Math.sin(t * 2 + k) * 0.05, captain: false }, WDX[k], DY, 1.6 + k * 0.4, { rim: { side: 1, T: T_GOLD, a: 0.3 } });
      actor3('tamo', { view: 'back', crouch: 1.2 }, -3.0, DY, 0.4, { dark: 1 });
    } else {
      // he looks at them, at her, and gets up: "three grown-ups… against one girl?"
      const stand = lin(192.2, 193.0, t), walk = lin(195.0, 197.0, t);
      lookAt(-1.4 - walk * 2, 1.4, -4.2, -2.9 + walk * 3, 1.0, 0.4, 46);
      harbour(t);
      for (let k = 0; k < 3; k++) actor3('warden', { view: 'front', spear: -1.1 }, WDX[k], DY, 1.6 + k * 0.4, {});
      const flick = lin(193.6, 194.0, t);
      actor3('tamo', { view: walk > 0 ? 'side' : 'front', crouch: 1.2 * (1 - stand), run: walk > 0 ? t * 9 : undefined, eyes: blink(t, 23) ? 'closed' : 'narrow', brows: 'angry', mouth: mouth('tamo', t), smile: t > 194 ? 0.4 : 0, armF: flick > 0 && flick < 1 ? -1.6 : 1.3, look: t < 191.9 ? -2 : t < 192.2 ? 2 : 0 }, -3.0 + walk * 4, DY, 0.4, {});
      if (flick < 1) fish3(-3.0 + flick * 0.8, 1.18 + DY + Math.sin(flick * PI) * 0.8 - (1 - stand) * 0, 0.36, flick * 6, 0);
      actor3('kaira', { view: 'front', eyes: blink(t, 24) ? 'closed' : 'wide', brows: 'worried', seed: 0.5, blade: 1.0, blade2: 2.4 }, -1.3, DY, 0.9, {});
    }
  });

  // 26 — the anchor: "that anchor hasn't moved in a hundred years—" … it moves (3:17)
  const GRIP = 199.5, RIP = 203.0;
  const tideY = (t) => -0.4 - 1.8 * sstep(200.3, 202.8, t) + 1.2 * sstep(203.0, 203.6, t);
  shot(197.0, 214.0, (lt, t) => {
    const ripG = t - RIP;
    if (t < GRIP) {
      lookAt(9.6, 2.2, -7.0, 5.0, 1.4, 1.2, 50);
      harbour(t);
      anchorProp(ANCHOR_X, DY, 1.4, 0, 2.4);
      actor3('docker', { view: 'side', eyes: 'half', mouth: mouth('docker', t), armF: 0.6, crouch: 1.0 }, 9.4, DY, -1.6, { flip: true });
      crate3(9.4, DY, -1.4, 0.7);
      actor3('tamo', { view: 'side', run: t < 198.8 ? t * 9 : undefined, eyes: 'narrow', brows: 'angry' }, lerp(1.6, ANCHOR_X - 1.1, lin(197, 198.8, t)), DY, 1.2, {});
    } else if (t < RIP + 0.2) {
      // low, close: his grip; the planks groan; the sea pulls back
      const sh = sstep(GRIP, RIP, t);
      lookAt(ANCHOR_X - 3.4, 0.7, -2.2, ANCHOR_X - 0.6, 1.3, 1.3, 48);
      drawHarbour(t, { lights: [] });
      ink(2);
      anchorProp(ANCHOR_X, DY, 1.4, Math.sin(t * 40) * 0.01 * sh, 2.4, sh > 0.6 ? sh : 0);
      const a = actor3('tamo', { view: 'side', crouch: 0.6 + sh * 0.6, armF: -0.6, armL: -0.4, eyes: sh > 0.7 ? 'glow' : 'narrow', brows: 'angry', mouth: sh > 0.4 ? 0.9 : 0, glow: C('teal', 7) }, ANCHOR_X - 1.15, DY, 1.2, { rim: { side: 1, T: T_TEAL, a: sh * 0.8 } });
      if (sh > 0.4) aura(t, [C('teal', 3), C('teal', 5), C('teal', 6), C('teal', 7)], 3 + sh * 7, { sparks: 20 });
      // water rising off the sea in strands, swirling toward the anchor
      for (let k = 0; k < 80 * sh; k++) { const a0 = ih(k, 1, 411) * TAU + t * 1.5, r = 3 + ih(k, 2, 411) * 6 - (t - GRIP) * 0.6, y = tideY(t) + frac(ih(k, 3, 411) + t * 0.5) * 3; p3(ANCHOR_X + Math.cos(a0) * r, y, 1.4 + Math.sin(a0) * r, k & 1 ? C('teal', 7) : C('sea', 7), 0.07); }
      shk(0.5 + sh * 2.5);
    } else {
      // the hero shot: up from the planks as the anchor tears free and the sea comes back
      const u = t - RIP;
      lookAt(ANCHOR_X - 2.4, 0.55, -2.8 + u * 0.05, ANCHOR_X - 1.0, 2.1, 1.2, 56);
      drawHarbour(t, { lights: [] }); ink(2);
      const lift = eoc(lin(0, 1.2, u));
      const a = actor3('tamo', { view: u > 2.4 ? 'front' : 'side', anchor: lerp(-1.4, -2.3, lift), anchorGlow: u < 6, armF: lerp(0.6, -1.55, lift), eyes: u < 6 ? 'glow' : 'narrow', glow: C('teal', 7), brows: 'angry', mouth: mouth('tamo', t), smile: t > 205.6 ? 0.6 : 0, wind: 2 }, ANCHOR_X - 1.15, DY, 1.2, { rim: { side: 1, T: T_TEAL, a: 0.35 } });
      if (u < 6) aura(t, [C('teal', 3), C('teal', 5), C('teal', 6), C('teal', 7)], 5.5 * (1 - u / 7), { sparks: 22 });
      // splintered planks and a ring of water thrown up around them
      if (u < 1.6) { splash3(ANCHOR_X, DY, 1.4, u, 1.6); debris(240, 190, u, 40, 220, 1.2, [C('wood', 3), C('wood', 5), C('sea', 7)], 412); }
      if (u < 0.08) impactFrame(240, 120, 1);
      shk(4 * Math.max(0, 1 - u * 1.5));
      if (t > 209.5) {   // the wardens look at each other, and charge anyway
        const c = lin(211.4, 214.0, t);
        for (let k = 0; k < 3; k++) actor3('warden', { view: 'side', spear: -0.3, run: c > 0 ? t * 14 + k : undefined }, lerp(-5.4 + k, -2.6 + k * 0.6, c) - 0.1, DY, 1.6 + k * 0.4 - 1.2, { flip: false });
      }
    }
  });

  // 27 — the fight (3:34): a swing into the sea, a chain yanked, a kick out of a lightning step
  const FHITS = [214.8, 217.2, 219.6], FD = 0.08;
  shot(214.0, 221.0, (lt, t) => {
    const [tt, fz] = stopClock(t - 214.0, FHITS.map((h) => h - 214.0), FD), T = 214.0 + tt;
    lookAt(-0.6 + tt * 0.25, 2.3, -8.8, 0.8, 1.0, 1.0, 52);
    drawHarbour(t, { lights: [] }); ink(2);
    // Tamo, anchor in hand, at the centre
    const sw1 = lin(214.45, 214.85, T), sw2 = lin(216.9, 217.25, T);
    const anchorA = T < 214.45 ? -2.4 : T < 216.9 ? lerp(-2.4, 0.5, eoc(sw1)) : lerp(0.5, -2.6, eoc(sw2));
    const ta = actor3('tamo', { view: 'side', anchor: anchorA, armF: anchorA * 0.5, eyes: 'narrow', brows: 'angry', mouth: fz ? 0.9 : 0, wind: 2 }, 0.6, DY, 1.0, { flip: T > 216.6 && T < 218.6 });
    if (ta && sw1 > 0 && sw1 < 1) smearArc(ta.hand[0], ta.hand[1], -2.4, anchorA, 34 * ta.S, [C('teal', 4), C('teal', 6), C('teal', 7)]);
    if (ta && sw2 > 0 && sw2 < 1) smearArc(ta.hand[0], ta.hand[1], PI - 0.5, PI + 2.6 - (1 - eoc(sw2)) * 3.1, 34 * ta.S, [C('teal', 4), C('teal', 6), C('teal', 7)]);
    // W1: charges from the right, takes the anchor, flies into the sea
    const w1 = K({ t: 214.0, x: 5.4, y: DY, z: 1.0, a: 0 }, { t: 214.8, x: 2.0, e: 'i' }, { t: 215.2, x: 4.2, y: 2.2, z: 4.6, a: 2, e: 'o' }, { t: 215.5, x: 5.0, y: -0.6, z: 6.0, a: 4, e: 'i' });
    const W1 = trk(w1, T); if (T < 215.5) actor3('warden', { view: 'side', spear: -0.2, run: T < 214.8 ? T * 15 : undefined }, W1.x, W1.y, W1.z, { flip: true, ang: W1.a });
    splash3(5.0, -0.4, 6.0, T - 215.2, 1.1);
    // W3: the chain round the anchor, yanked over Tamo's head into the barrels
    const w3 = K({ t: 214.0, x: -4.6, y: DY, z: 0.6, a: 0 }, { t: 216.4, x: -2.4, e: 'o' }, { t: 217.2, x: -2.4 }, { t: 217.6, x: 1.4, y: 3.4, z: 0.6, a: -3, e: 'o' }, { t: 218.0, x: 7.4, y: 0.6, z: -1.4, a: -6, e: 'i' }, { t: 221, x: 7.4, y: 0.4, z: -1.4, a: -6.6 });
    const W3 = trk(w3, T); actor3('warden', { view: 'side', spear: T < 216.8 ? -0.4 : undefined, run: T < 216.4 ? T * 14 : undefined, eyes: T > 217.2 ? 'wide' : 'open' }, W3.x, W3.y, W3.z, { ang: W3.a });
    if (T > 216.5 && T < 217.3 && ta) { const p = proj(W3.x + 0.4, 1.1, W3.z); if (p) { const hx = ta.hand[0] + Math.cos(anchorA) * 20 * ta.S, hy = ta.hand[1] + Math.sin(anchorA) * 20 * ta.S; lineF(p.x, p.y, hx, hy, (x, y, u) => { if ((x + y) % 3) P(x, y + Math.sin(u * 12 + t * 20) * 1.5, C('stone', 6)); }); } }
    if (T > 218.0) debris(proj(7.4, 0.6, -1.4) ? PR.x : 400, PR.y, T - 218.0, 30, 140, 1.2, [C('wood', 3), C('wood', 5)], 421);
    // W2: comes at his back; a lightning step; a kick into the sea
    const w2 = K({ t: 214.0, x: -6.6, y: DY, z: 1.8, a: 0 }, { t: 218.6, x: -1.6, e: 'io' }, { t: 219.2, x: -0.8, e: 'i' }, { t: 219.6, x: -0.6 }, { t: 219.9, x: -2.8, y: 1.8, z: 4.4, a: 2.4, e: 'o' }, { t: 220.1, x: -3.4, y: -0.6, z: 5.4, a: 4, e: 'i' });
    const W2 = trk(w2, T); if (T < 220.1) actor3('warden', { view: 'side', spear: T > 218.9 && T < 219.4 ? 0.0 : -0.6, reach: T > 218.9 && T < 219.4 ? 4 : 0, run: T < 218.6 ? T * 14 : undefined }, W2.x, W2.y, W2.z, { ang: W2.a });
    splash3(-3.4, -0.4, 5.4, T - 220.1, 1.0);
    const kin = lin(219.25, 219.6, T);
    if (T > 219.2) {
      const kx = lerp(-6.0, -1.3, eoc(kin)), ky = DY + Math.sin(kin * PI) * 0.8 + (T > 219.6 ? Math.max(0, 0.6 - (T - 219.6) * 1.5) : 0);
      const after = kin < 1 ? [0.25, 0.5, 0.75].map((q) => { const p = proj(lerp(-6.0, kx, q), ky, 1.4); return p ? [p.x, p.y, C('gold', 6), 0.55 - q * 0.4] : [0, 0, 0, 0]; }) : undefined;
      actor3('kaira', { view: 'side', air: T < 220.4, armF: -0.2, reach: kin > 0.8 && kin < 1 ? 4 : 0, blade: 0.4, blade2: 2.4, storm: true, eyes: 'narrow', brows: 'angry', seed: 0.7, wind: 4 }, T > 219.6 ? lerp(-1.3, -1.9, lin(219.6, 220.5, T)) : kx, ky, 1.4, { after, ang: kin < 1 ? -0.4 : 0 });
      if (kin > 0 && kin < 1) for (let b = 0; b < 3; b++) { const p = proj(kx, ky + 0.8, 1.4); if (p) lineF(p.x, p.y, p.x - 30 - ih(b, fl(t * 30), 431) * 60, p.y + (ih(b, fl(t * 30) + 1, 431) - 0.5) * 50, (x, y) => P(x, y, C('gold', 7))); }
    }
    // hits
    const hp = [[proj(2.0, 1.2, 1.0)], [proj(-2.2, 1.4, 0.6)], [proj(-0.8, 1.3, 1.6)]];
    for (let k = 0; k < 3; k++) { const p = proj([2.0, -2.0, -0.8][k], [1.2, 1.6, 1.3][k], [1.0, 0.6, 1.6][k]); const h = FHITS[k] + k * FD; if (p) hitFx(p.x, p.y, t - h, k === 0 ? 1.4 : 1.0, k === 2 ? [WHITE, C('gold', 6)] : [WHITE, C('teal', 7)]); }
    void hp;
  });

  // 28 — the breather: "Okay. Who ARE you?" / "Tamo! I work here…" (3:41)
  shot(221.0, 228.0, (lt, t) => {
    lookAt(-0.4, 1.35, -4.6, -0.6, 1.0, 1.0, 46);
    harbour(t);
    actor3('tamo', { view: 'front', anchor: 1.45, armF: 1.1, eyes: blink(t, 31) ? 'closed' : 'open', smile: t > 222.8 ? 0.8 : 0.3, mouth: mouth('tamo', t), wind: 1 }, 0.5, DY, 1.0, {});
    actor3('kaira', { view: 'front', eyes: blink(t, 32) ? 'closed' : t > 225.6 ? 'closed' : 'open', brows: t < 222.5 ? 'up' : 'n', smile: t > 225.4 ? 0.9 : 0.2, mouth: mouth('kaira', t), seed: 0.4, blade: 1.3, blade2: 2.4, look: 1 }, -1.4, DY, 1.2, {});
  });

  // 29 — the world goes quiet: gulls stop in the air; the ring opens over the harbour (3:48)
  const SIGIL_H = [34, 46, 78];
  shot(228.0, 246.0, (lt, t) => {
    if (t < 231.0) {
      lookAt(-0.4, 1.35, -4.6, -0.6, 1.0, 1.0, 46);
      harbour(t); harbourHush(t);
      const look = t > 229.4;
      actor3('tamo', { view: 'front', anchor: 1.45, armF: 1.1, eyes: look ? 'wide' : 'open', brows: look ? 'up' : 'n', smile: look ? 0 : 0.6, look: look ? 2 : 0 }, 0.5, DY, 1.0, {});
      actor3('kaira', { view: 'front', eyes: look ? 'wide' : 'closed', brows: look ? 'worried' : 'n', smile: look ? 0 : 0.8, mouth: mouth('kaira', t), seed: 0.4, blade: 1.3, blade2: 2.4, look: look ? 2 : 1 }, -1.4, DY, 1.2, {});
    } else if (t < 235.4) {
      // the sky over the harbour opens
      lookAt(-1.0, 1.2, -6, 24, 30, 60, 64);
      harbour(t); harbourHush(t);
      const p = proj(SIGIL_H[0], SIGIL_H[1], SIGIL_H[2]); const u = t - 231.0;
      if (p) { glow(p.x, p.y, 160, T_WH, 0.35 * lin(0, 2, u)); sigil(p.x, p.y, 20 + eoc(u / 3) * 80, (20 + eoc(u / 3) * 80) * 0.42, t, lin(0, 2.6, u), 461); }
      actor3('tamo', { view: 'back', anchor: -2.2, armF: -1.4 }, 0.6, DY, 0.0, { dark: 1 });
      actor3('kaira', { view: 'back', seed: 0.4, blade: 1.3 }, -1.4, DY, 0.2, { dark: 1 });
      shk(0.6);
    } else if (t < 242.0) {
      // Tamo, close: "Hollow."
      lookAt(0.0, 1.4, -2.4, 0.5, 1.15, 1.0, 40);
      harbour(t); harbourHush(t);
      actor3('tamo', { view: 'front', anchor: 1.45, armF: 1.1, eyes: blink(t, 33) ? 'closed' : 'sad', brows: 'worried', mouth: mouth('tamo', t), look: 1 }, 0.5, DY, 1.0, { rim: { side: 1, T: T_WH, a: 0.4 } });
      const p = proj(SIGIL_H[0], SIGIL_H[1], SIGIL_H[2]); if (p) glow(p.x, p.y, 200, T_WH, 0.2);
    } else {
      // Oren lands behind them: "No… not here. Not the harbour."
      const g = t - 242.0;
      lookAt(-4.4, 1.5, -3.6, -2.6, 1.1, 1.4, 44);
      harbour(t); harbourHush(t);
      actor3('warden', { view: 'front', captain: true, spear: -1.4, eyes: 'wide', mouth: mouth('oren', t), crouch: g < 0.3 ? 1 : 0, air: g < 0 }, -2.8, DY + Math.max(0, (0.15 - g) * 20), 1.6, { rim: { side: 1, T: T_WH, a: 0.4 } });
      actor3('kaira', { view: 'side', seed: 0.5, blade: 1.3, eyes: 'wide', brows: 'worried' }, -0.6, DY, 0.6, { flip: true });
    }
  });

  // 30 — the Hollow fall like stars; a warden is erased; the Bellwether comes down (4:06)
  const HOLLOW_LAND = [247.0, 247.4, 247.7, 248.1, 248.5, 248.8, 249.2, 249.6], HOLLOW_X = [12, 9.5, 15, 7.5, 18, 11, 6.5, 14], HOLLOW_Z = [0.4, -1.8, 1.8, 2.2, -0.6, 2.6, -1.0, -2.6];
  const BELL_LAND = 260.0;
  function hollowCrowd(t, opt) {
    opt = opt || {};
    for (let k = 0; k < 8; k++) {
      const g = t - HOLLOW_LAND[k]; if (g < -0.8) continue;
      const y = g < 0 ? DY + (-g) * 40 : DY, x = HOLLOW_X[k] - (t > 250 ? Math.min(3, (t - 250) * 0.8) : 0);
      if (g < 0) { const p = proj(x, y, HOLLOW_Z[k]), q = proj(x, y + 8, HOLLOW_Z[k]); if (p && q) lineF(q.x, q.y, p.x, p.y, (xx, yy, u) => { if (bay(xx, yy) < u) { P(xx, yy, WHITE); P(xx + 1, yy, C('crimson', 5)); } }); continue; }
      actor3('hollow', { view: opt.view || 'front', eyes: 'open', armF: 1.0 + Math.sin(t * 3 + k) * 0.2, run: t > 250 && t < 254 ? t * 9 + k : undefined }, x, y, HOLLOW_Z[k], {});
      if (g < 0.25) { const p = proj(x, DY, HOLLOW_Z[k]); if (p) { shockRing(p.x, p.y, 3 + g * 90, 1 + g * 20, 2, [WHITE, C('crimson', 5), C('hush', 3)], 1 - g / 0.25); shk(1); } }
    }
  }
  shot(246.0, 262.0, (lt, t) => {
    if (t < 250.0) {
      // wide: the white ring sweeping across the far boats; the Hollow streak down
      lookAt(-12, 7, -18, 14, 3, 30, 58);
      harbour(t); harbourHush(t);
      const p = proj(SIGIL_H[0], SIGIL_H[1], SIGIL_H[2]); if (p) sigil(p.x, p.y, 100, 42, t, 1, 461);
      hollowCrowd(t);
      for (const [x, z] of [[-2.8, 1.6], [-4.6, -0.8], [-5.8, 1.2]]) actor3('warden', { view: 'side', spear: -0.4 }, x, DY, z, {});
      actor3('tamo', { view: 'side', anchor: -2.0, armF: -1.2, eyes: 'wide' }, 0.5, DY, 1.0, {});
      actor3('kaira', { view: 'side', seed: 0.5, blade: 0.6, blade2: 2.4, eyes: 'wide' }, -0.8, DY, 0.4, {});
    } else if (t < 254.0) {
      // the fight with shadows: a warden is touched, and is not a warden any more
      const er = t - 252.5;
      lookAt(4.6, 1.7, -5.6, 7.6, 1.0, 0.8, 48);
      harbour(t); harbourHush(t);
      hollowCrowd(t, { view: 'side' });
      actor3('warden', { view: 'side', spear: Math.sin(t * 9) * 0.6, captain: true }, 4.6, DY, 0.4, { flip: false });
      const gw = er > 0 ? Math.min(1, er / 0.9) : 0;
      if (er < 1.3) actor3(er > 0.5 ? 'hollow' : 'warden', { view: 'front', spear: er > 0 ? undefined : -0.8, eyes: 'wide' }, 6.6, DY, -0.8, { glitch: gw * 2, alpha: 1 - Math.max(0, er - 0.9) * 2.4 });
      if (er > 0 && er < 1.2) { const p = proj(6.6, 1.0, -0.8); if (p) for (let k = 0; k < 50; k++) { const u = frac(ih(k, 1, 471) + er); P(p.x + (ih(k, 2, 471) - 0.5) * 50 + u * 20, p.y - ih(k, 3, 471) * 40 - u * 30, ih(k, 4, 471) < 0.5 ? WHITE : C('crimson', 5)); } }
      if (er > 0 && er < 0.06) impactFrame(240, 135, 0);
    } else {
      // the Bellwether descending out of the ring, huge, slow; it lands, and rings
      const g = t - BELL_LAND, y = g < 0 ? DY + Math.pow(-g / 6, 1.6) * 40 : DY;
      lookAt(-3.4, 0.7, -9.6, 6.4, lerp(7.4, 3.6, sstep(254.5, 259.5, t)), 1.2, 60);
      harbour(t); harbourHush(t);
      const p = proj(SIGIL_H[0], SIGIL_H[1], SIGIL_H[2]); if (p) sigil(p.x, p.y, 100, 42, t, 1, 461);
      hollowCrowd(t, { view: 'side' });
      const bw = actor3('bellwether', { glowEyes: true, sway: Math.sin(t * 0.8) * 2, ring: g > 0 && g < 1.2 ? 1.5 * (1 - g / 1.2) : 0 }, 8.4, y, 1.0, { size: 1.6 });
      actor3('tamo', { view: 'back', anchor: -2.2, armF: -1.4 }, 0.4, DY, -0.6, { dark: 1 });
      actor3('kaira', { view: 'back', seed: 0.6, blade: 0.8, blade2: 2.4 }, -1.0, DY, -0.4, { dark: 1 });
      if (g > 0 && bw) { const bh = proj(8.4, 4.4, 1.0); for (let r = 0; r < 3; r++) { const gg = g - r * 0.25; if (gg > 0 && gg < 1.2) { shockRing(bw.x, bw.y - 2, 10 + gg * 420, 3 + gg * 70, 3, [WHITE, C('hush', 5), C('gold', 6)], 1 - gg / 1.2); if (bh) shockRing(bh.x, bh.y, 6 + gg * 260, 6 + gg * 260, 2, [WHITE, C('gold', 6), C('gold', 4)], 1 - gg / 1.2); } } if (bh && g < 0.6) radialLines(bh.x, bh.y, 40, 20, WHITE, t, 493); shk(5 * Math.exp(-g * 2.5)); if (g < 0.07) flashWhite(0.7); }
    }
  });

  // 31 — "The courier. And the anchor-bearer. Two of four." (4:22)
  shot(262.0, 276.0, (lt, t) => {
    if (t < 266.2 || (t > 267.0 && t < 270.2)) {
      // low and close on the bell
      lookAt(t < 266.2 ? 1.4 : 4.4, t < 266.2 ? 1.0 : 2.6, t < 266.2 ? -7.6 : -3.6, 8.4, t < 266.2 ? 3.4 : 4.6, 1.0, t < 266.2 ? 54 : 40);
      harbour(t); harbourHush(t);
      hollowCrowd(t, { view: 'side' });
      const sp_ = talking('bellwether', t);
      actor3('bellwether', { glowEyes: true, sway: Math.sin(t * 0.8) * 2, ring: sp_ ? 0.4 * mouth('bellwether', t) : 0, arms: 1.3 + Math.sin(t * 0.7) * 0.1 }, 8.4, DY, 1.0, { size: 1.6, rim: { side: -1, T: T_WH, a: 0.35 } });
      const p = proj(8.4, 4.4, 1.0); if (p && sp_) glow(p.x, p.y, 40 * mouth('bellwether', t) + 10, T_WH, 0.35);
    } else if (t < 267.0) {
      // the two of them
      lookAt(-1.0, 1.25, -3.4, -0.3, 1.0, 0.8, 42);
      harbour(t); harbourHush(t);
      actor3('tamo', { view: 'front', anchor: 1.45, armF: 1.1, eyes: 'narrow', brows: 'angry' }, 0.4, DY, 0.8, { rim: { side: 1, T: T_WH, a: 0.4 } });
      actor3('kaira', { view: 'front', seed: 0.7, blade: 0.5, blade2: 2.4, eyes: 'wide', brows: 'worried' }, -1.0, DY, 1.0, { rim: { side: 1, T: T_WH, a: 0.4 } });
    } else {
      // the standoff, wide: they take their stances; it spreads its arms
      const u = t - 270.2;
      lookAt(3.6, 2.0, -12 + u * 0.15, 3.6, 1.8, 1.0, 54);
      harbour(t); harbourHush(t);
      hollowCrowd(t, { view: 'side' });
      actor3('bellwether', { glowEyes: true, sway: Math.sin(t * 0.8) * 2, arms: lerp(1.3, 0.2, eio(lin(273, 275.5, t))) }, 8.4, DY, 1.0, { size: 1.6, flip: true });
      actor3('tamo', { view: 'side', anchor: lerp(-2.0, -0.6, eio(lin(271, 272, t))), armF: -0.4, crouch: 0.5, eyes: 'narrow', brows: 'angry' }, 0.4, DY, 0.8, {});
      actor3('kaira', { view: 'side', seed: 0.7, blade: lerp(1.6, 0.2, eio(lin(271.4, 272.2, t))), blade2: 2.6, crouch: 0.6, eyes: 'narrow', brows: 'angry', storm: t > 272 }, -1.0, DY, 1.4, {});
    }
  });

  // 32 — the toll: a white wave down the dock; a wall of water; the strain; the break (4:36)
  const TOLL = 276.5, WALL = 277.5, MEET = 278.5, BREAK = 285.5;
  const waveX = (t) => 8.4 - Math.max(0, t - TOLL) * 8;
  shot(276.0, 292.0, (lt, t) => {
    const close = t > 280.4 && t < 285.2;
    if (!close) lookAt(3.4, 2.2, -11.6, 3.4, 1.8, 1.0, 56);
    else lookAt(-0.7, 1.3, -2.6, -0.2, 1.1, 1.0, 44);
    harbour(t); harbourHush(t);
    // the wave of erasure along the dock, held back by the wall from MEET until BREAK
    const front = t < MEET ? waveX(t) : t < BREAK ? 1.2 + Math.sin(t * 7) * 0.08 : 1.2 - (t - BREAK) * 9;
    hushWorld(t, (wx, wy, wz) => (wx > front + 0.8 ? 1 : wx > front ? 0.55 : 0), true);
    // the wall of water
    const wh = t < WALL ? 0 : t < BREAK ? 4.2 * eoc(lin(WALL, WALL + 0.6, t)) : 4.2 * (1 - lin(BREAK, BREAK + 0.4, t));
    if (wh > 0.05) poly3([[1.0, -0.4, -3.4], [1.0, -0.4, 4.6], [1.0, wh, 4.6], [1.0, wh, -3.4]], (u, v, x, y) => {
      const flow = frac(v * 0.9 - t * 1.6 + Math.sin(u * 2 + t * 3) * 0.2), top = u > wh - 0.35;
      if (t > MEET && t < BREAK && ih(x >> 1, y >> 1, fl(t * 18)) < 0.12) return ih(x, y, 5) < 0.5 ? WHITE : C('crimson', 5);
      return top ? C('sea', 7) : shadeC(R.sea, 3.6 + flow * 2 + (frac(v * 2.3 + t) < 0.08 ? 2 : 0), x, y);
    }, { two: true });
    if (t > MEET && t < BREAK) for (let k = 0; k < 40; k++) p3(1.05, ih(k, 1, 481) * wh, -3.4 + ih(k, 2, 481) * 8, ih(k, fl(t * 20), 482) < 0.5 ? WHITE : C('crimson', 5), 0.06);
    // the Bellwether, the heroes
    hollowCrowd(t, { view: 'side' });
    actor3('bellwether', { glowEyes: true, sway: Math.sin(t * 0.8) * 2, ring: t > TOLL && t < TOLL + 1.2 ? 1.4 * (1 - (t - TOLL) / 1.2) : 0, arms: t > 288 ? lerp(0.2, -0.9, eio(lin(288, 290.5, t))) : 0.2 }, 8.4, DY, 1.0, { size: 1.6, flip: true });
    const thrown = t > BREAK + 0.5 ? lin(BREAK + 0.5, BREAK + 1.2, t) : 0, down = thrown >= 1;
    const tx = 0.4 - thrown * 3.2, kx = -1.0 - thrown * 3.4;
    actor3('tamo', { view: close ? 'front' : 'side', anchor: down ? undefined : t > WALL ? -1.5 : -0.6, armF: t > WALL ? 0.9 : -0.4, crouch: t > WALL && !down ? 1.0 : 0, eyes: down ? 'closed' : t > MEET ? 'glow' : 'narrow', glow: C('teal', 7), brows: 'angry', mouth: mouth('tamo', t), vib: 0 }, tx, DY + Math.sin(thrown * PI) * 1.2, 0.8, { ang: down ? -1.4 : thrown * -1.2, rim: { side: 1, T: T_TEAL, a: t > WALL && t < BREAK ? 0.6 : 0 } });
    if (t > WALL && t < BREAK && !close) aura(t, [C('teal', 3), C('teal', 5), C('teal', 6), C('teal', 7)], 6, { sparks: 14 });
    const blaze = sstep(283.4, 284.2, t) * (t < BREAK ? 1 : 0);
    const ka = actor3('kaira', { view: close ? 'front' : 'side', seed: 0.6 + blaze * 0.4, blade: 0.3, blade2: 2.6, crouch: 0.6, eyes: down ? 'closed' : blaze > 0.5 ? 'glow' : 'wide', brows: 'worried', mouth: mouth('kaira', t) }, kx, DY + Math.sin(thrown * PI) * 1.4, 1.4, { ang: down ? 1.5 : thrown * 1.3 });
    if (ka && blaze > 0) { glow(ka.chest[0], ka.chest[1], 60 * blaze, T_GOLD, 0.7 * blaze); for (let b = 0; b < 4; b++) if (ih(b, fl(t * 20), 491) < blaze) lineF(ka.chest[0], ka.chest[1], ka.chest[0] + (ih(b, fl(t * 20) + 1, 491) - 0.5) * 120, ka.chest[1] + (ih(b, fl(t * 20) + 2, 491) - 0.5) * 90, (x, y) => P(x, y, C('gold', 7))); shk(blaze * 2); }
    if (t > MEET && t < BREAK) shk(1.5 + Math.sin(t * 3) * 0.5);
    // the break
    if (t > BREAK) { splash3(1.0, -0.4, 0.6, t - BREAK, 2.2); const p = proj(1.0, 1.4, 0.6); if (p) hitFx(p.x, p.y, t - BREAK, 1.6, [WHITE, C('sea', 7)]); }
    if (t > 288 && t < 290.6) { const p = proj(8.4, 4.6, 1.0); if (p) { glow(p.x, p.y, 30 + (t - 288) * 40, T_WH, 0.5); radialLines(p.x, p.y, 30, 40, WHITE, t, 492); } shk((t - 288) * 1.2); }
    if (t > 290.8) { tintAll(T_DARK, 0.25); }
  });

  // 33 — the light in the fog (4:52)
  shot(292.0, 300.0, (lt, t) => {
    const vz = lerp(40, 26, eio(lin(0, 5.5, lt)));
    if (t < 297.2) {
      lookAt(-6.4, 0.8, -1.2, 12, 2.0, 2.2, 50);
      harbour(t, { noGulls: true }); harbourHush(t);
      hushWorld(t, (wx) => (wx > front2(t) ? 0.9 : 0), false);
      tintAll(tab('#b8b0d0'), 0.15);
      hollowCrowd(t, { view: 'side' });
      actor3('bellwether', { glowEyes: true, sway: Math.sin(t * 0.8) * 2, arms: -0.9 + lin(292, 294, t) * 1.6 }, 8.4, DY, 1.0, { size: 1.6, flip: lt > 1.4 });
      actor3('tamo', { view: 'side', eyes: 'half', brows: 'worried' }, -2.8, DY, 1.6, { ang: -1.4, dark: 1 });
      // a violet glow in the white, and a shape walking out of it
      const p = proj(vz, 1.6, 3.2); if (p) glow(p.x, p.y, 70 + Math.sin(t * 3) * 6, T_VIO, 0.55 * lin(0, 1, lt));
      if (lt > 0.6) { actor3('vesper', {}, vz, DY + Math.abs(Math.sin(t * 2.4)) * 0.05, 3.2, { size: 1.5, flip: true, alpha: lin(0.6, 2.4, lt), dark: 2, tint: { T: tab('#2a1c48'), a: 0.6 * (1 - lin(3, 5.5, lt)) } }); const q = proj(vz - 0.4, 1.4, 3.2); if (q) glow(q.x, q.y, 18, T_VIO, 0.8); }
    } else {
      // the helm, close; its eyes flare
      lookAt(vz - 7.0, DY + 2.6, 2.6, vz, DY + 2.7, 3.2, 40);
      harbour(t, { noGulls: true }); hushWorld(t, () => 0.9, false);
      const vs = actor3('vesper', {}, vz, DY, 3.2, { size: 1.5, flip: true });
      if (vs) { const ex = vs.x - 5 * vs.S, ey = vs.y - 49 * vs.S; glow(ex, ey, (5 + lin(297.4, 297.8, t) * 4) * vs.S, T_VIO, 0.8); }
    }
    if (t > 298.5) BUF.fill(BLACK);
  });
  const front2 = (t) => 14 + (t - 292) * 0.5;

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
