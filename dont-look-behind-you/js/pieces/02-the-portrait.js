/* The Portrait — piece 2 of "Don't Look Behind You".
 *
 * A 32-second seamless loop of real pixel art. Every frame is a pure function of t.
 * A dim hallway is painted into a 216 × 270 art-pixel G-buffer that keeps, per pixel, a palette index,
 * a surface normal, a material and a world position (the back wall is the picture plane, the floor
 * recedes in true one-point perspective). One candle lights it live as a moving point light with
 * per-pixel cast shadows against the frame, the table, the things on it, the clock and someone who
 * isn't there; the moon comes in through the window behind its curtain. Light is stepped in 0.11
 * bands with a 4 × 4 Bayer dither, quantised to 32 colours and scaled up nearest-neighbour.
 * The oil painting is drawn on its own canvas, one version per state, with brushwork, craquelure
 * and a varnish that catches the flame.
 */
(function () {
  'use strict';

  /* ================================================================ constants & helpers */
  const AW = 216, AH = 270, NP = AW * AH, D = 32;
  // camera: wall at Z = 0 is the picture plane (1 art px = 1 inch), camera DC in front at eye height EC
  const FL = 206, EC = 66, DC = 240, XC = 108, YH = FL - EC;
  const TAU = Math.PI * 2;
  const fl = Math.floor;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const io = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  let SEED = 7;
  function ih(a, b, c) {
    let h = Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x165667b1) ^ Math.imul(((c | 0) + SEED * 7919) | 0, 0x85ebca77);
    h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
    h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
    h ^= h >>> 15;
    return (h >>> 0) / 4294967296;
  }
  // fixed-seed hash for things that must not change with the gallery seed (the painting, the room)
  const hs = (a, b, c) => { const s = SEED; SEED = 7; const v = ih(a, b, c); SEED = s; return v; };

  /* ================================================================ palette (32) */
  const PAL_HEX = [
    '07060b', '120f1a', '1c1a2c', '2a2a42', '3c3f5c', '545c7c', '7684a4', 'a5b4cc', 'dce4ee', // 0-8 night
    '1a100d', '2c1b15', '45291d', '633c27', '8a5a36', 'b5804f',                               // 9-14 umber
    '2a0e12', '461619', '6c2424', '9a3b2e',                                                   // 15-18 oxblood
    '4a3212', '7d5a1e', 'b78c34', 'e3c46e',                                                   // 19-22 gilt
    'fff3cf', 'ffbe55', 'e87a2c',                                                             // 23-25 flame
    'e6cba4', 'c49878',                                                                       // 26-27 ivory, flesh
    '172420', '293d34', '45604f',                                                             // 28-30 bottle green
    '5a3448',                                                                                 // 31 mauve
  ];
  const PAL = PAL_HEX.map((h) => [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]);
  const LUT = new Uint8Array(32768);
  function nearest(r, g, b) {
    let best = 0, bd = 1e18;
    for (let k = 0; k < PAL.length; k++) {
      const p = PAL[k], dr = r - p[0], dg = g - p[1], db = b - p[2];
      const rm = (r + p[0]) * 0.5;
      const d = (2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db;
      if (d < bd) { bd = d; best = k; }
    }
    return best;
  }
  function buildLUT() {
    for (let r = 0; r < 32; r++) for (let g = 0; g < 32; g++) for (let b = 0; b < 32; b++)
      LUT[(r << 10) | (g << 5) | b] = nearest(r * 8 + 4, g * 8 + 4, b * 8 + 4);
  }
  const DARK = [], LITE = [];
  function buildMaps() {
    for (let k = 0; k < PAL.length; k++) {
      const p = PAL[k];
      let d = nearest(p[0] * 0.68, p[1] * 0.68, p[2] * 0.7); if (d === k) d = k > 0 && k <= 8 ? k - 1 : k > 9 && k <= 14 ? k - 1 : 0;
      DARK[k] = d;
      let l = nearest(p[0] * 1.25 + 14, p[1] * 1.25 + 14, p[2] * 1.2 + 14); if (l === k && k < 8) l = k + 1;
      LITE[k] = l;
    }
  }
  const BAY = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
  const bay = (x, y) => BAY[((y & 3) << 2) | (x & 3)];
  const bay2 = (x, y) => BAY[(((y + 2) & 3) << 2) | ((x + 1) & 3)];

  /* ================================================================ G-buffer & pens */
  // materials
  const M_MATTE = 0, M_EMIT = 1, M_VARN = 2, M_GILT = 3, M_BRASS = 4, M_GLOSS = 5, M_WAX = 6, M_GLASS = 7, M_VEL = 8, M_RUG = 9;
  function mkG(w, h) {
    const n = w * h;
    return { w, h, c: new Uint8Array(n), m: new Uint8Array(n), ao: new Uint8Array(n), nx: new Float32Array(n), ny: new Float32Array(n), nz: new Float32Array(n),
      X: new Float32Array(n), H: new Float32Array(n), Z: new Float32Array(n), zt: false, x0: 0, y0: 0, x1: w, y1: h };
  }
  function mkP(w, h) { return { w, h, c: new Uint8Array(w * h), b: new Float32Array(w * h), x0: 0, y0: 0, x1: w, y1: h }; }
  const BS = mkG(AW, AH), SC = mkG(AW, AH);
  const OUT = new Uint8Array(NP);

  let TG = BS;
  // pen: plane kind 0 Z=v, 1 H=v, 2 X=v ; normal ; material ; ambient occlusion ; paint bump
  const PEN = { k: 0, v: 0, nx: 0, ny: 0, nz: 1, m: M_MATTE, ao: 255, b: 0 };
  function pen(k, v, nx, ny, nz, m, ao) {
    PEN.k = k; PEN.v = v;
    if (nx !== undefined) { const l = Math.hypot(nx, ny, nz) || 1; PEN.nx = nx / l; PEN.ny = ny / l; PEN.nz = nz / l; }
    PEN.m = m === undefined ? M_MATTE : m; PEN.ao = ao === undefined ? 255 : ao;
  }
  const penZ = (z, nx, ny, nz, m, ao) => pen(0, z, nx === undefined ? 0 : nx, ny === undefined ? 0 : ny, nz === undefined ? 1 : nz, m, ao);
  const penH = (h, m, ao) => pen(1, h, 0, 1, 0, m, ao);
  const penX = (x, nx, m, ao) => pen(2, x, nx, 0, 0, m, ao);
  let WX = 0, WH = 0, WZ = 0;
  function world(px, py) {
    const k = PEN.k, v = PEN.v;
    if (k === 0) { const t = (DC - v) / DC; WX = XC + t * (px - XC); WH = EC + t * (YH - py); WZ = v; }
    else if (k === 1) { const t = (v - EC) / (YH - py); WZ = DC - t * DC; WX = XC + t * (px - XC); WH = v; }
    else { const t = (v - XC) / (px - XC); WZ = DC - t * DC; WH = EC + t * (YH - py); WX = v; }
  }
  const proj = (X, H, Z) => { const s = DC / (DC - Z); return [XC + (X - XC) * s, YH + (EC - H) * s]; };
  function put(x, y, col, nx, ny, nz) {
    x = fl(x); y = fl(y);
    const T = TG;
    if (x < T.x0 || y < T.y0 || x >= T.x1 || y >= T.y1) return;
    const i = y * T.w + x;
    if (!T.X) { T.c[i] = col + 1; if (T.b) T.b[i] = FACEON ? 1 : (col === 26 || col === 27 || col === 14 ? 0.5 : 0); return; }
    world(x + 0.5, y + 0.5);
    if (T.zt && WZ < T.Z[i] - 0.02) return;
    T.c[i] = col + 1; T.m[i] = PEN.m; T.ao[i] = PEN.ao;
    T.X[i] = WX; T.H[i] = WH; T.Z[i] = WZ;
    if (nx === undefined) { T.nx[i] = PEN.nx; T.ny[i] = PEN.ny; T.nz[i] = PEN.nz; }
    else { const l = Math.hypot(nx, ny, nz) || 1; T.nx[i] = nx / l; T.ny[i] = ny / l; T.nz[i] = nz / l; }
  }
  const get = (x, y) => { x = fl(x); y = fl(y); if (x < 0 || y < 0 || x >= TG.w || y >= TG.h) return 0; return TG.c[y * TG.w + x]; };
  function rect(x, y, w, h, c) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) put(x + i, y + j, c); }
  function hl(x0, x1, y, c) { for (let x = x0; x <= x1; x++) put(x, y, c); }
  function vl(x, y0, y1, c) { for (let y = y0; y <= y1; y++) put(x, y, c); }
  function line(x0, y0, x1, y1, c) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let e = dx + dy;
    for (;;) {
      put(x0, y0, c);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * e;
      if (e2 >= dy) { e += dy; x0 += sx; }
      if (e2 <= dx) { e += dx; y0 += sy; }
    }
  }
  function ell(cx, cy, rx, ry, c, fn) {
    for (let y = fl(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y++)
      for (let x = fl(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x++) {
        const u = (x + 0.5 - cx) / rx, v = (y + 0.5 - cy) / ry;
        if (u * u + v * v <= 1) { if (fn) { const r = fn(x, y, u, v); if (r >= 0) put(x, y, r); } else put(x, y, c); }
      }
  }
  function poly(pts, c, fn) {
    let y0 = 1e9, y1 = -1e9;
    for (const p of pts) { if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1]; }
    for (let y = fl(y0); y <= Math.ceil(y1); y++) {
      const yc = y + 0.5, xs = [];
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i], b = pts[(i + 1) % pts.length];
        if ((a[1] <= yc && b[1] > yc) || (b[1] <= yc && a[1] > yc)) xs.push(a[0] + (yc - a[1]) / (b[1] - a[1]) * (b[0] - a[0]));
      }
      xs.sort((p, q) => p - q);
      for (let k = 0; k + 1 < xs.length; k += 2)
        for (let x = Math.round(xs[k]); x < Math.round(xs[k + 1]); x++) { if (fn) { const r = fn(x, y); if (r >= 0) put(x, y, r); } else put(x, y, c); }
    }
  }
  // string sprite: rows of chars, map char -> palette index (or -1 to skip)
  function spr(rows, map, x, y, flip) {
    for (let j = 0; j < rows.length; j++) {
      const r = rows[j], w = r.length;
      for (let i = 0; i < w; i++) {
        const ch = r[i]; if (ch === '.' || ch === ' ') continue;
        const m = map[ch]; if (m === undefined || m < 0) continue;
        put(x + (flip ? w - 1 - i : i), y + j, m);
      }
    }
  }

  /* ================================================================ shadow masks (world inches, 4 cells/inch) */
  const MR = 4;
  function mkMask(x0, h0, wIn, hIn) { const w = Math.ceil(wIn * MR), h = Math.ceil(hIn * MR); return { x0, h0, w, h, a: new Uint8Array(w * h) }; }
  function mFill(M, fn) { for (let j = 0; j < M.h; j++) for (let i = 0; i < M.w; i++) if (fn(M.x0 + (i + 0.5) / MR, M.h0 - (j + 0.5) / MR)) M.a[j * M.w + i] = 1; }
  const mAt = (M, X, H) => { const i = fl((X - M.x0) * MR), j = fl((M.h0 - H) * MR); return i >= 0 && j >= 0 && i < M.w && j < M.h ? M.a[j * M.w + i] : 0; };
  function inPoly(pts, x, y) {
    let c = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const a = pts[i], b = pts[j];
      if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) c = !c;
    }
    return c;
  }
  const inEll = (cx, cy, rx, ry, x, y) => { const u = (x - cx) / rx, v = (y - cy) / ry; return u * u + v * v <= 1; };
  function segD(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
    let t = l2 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0; t = clamp(t, 0, 1);
    return Math.hypot(px - ax - t * dx, py - ay - t * dy);
  }

  /* ================================================================ layout (world inches; wall = picture plane) */
  // frame & canvas
  const FX0 = 46, FX1 = 170, FY0 = 28, FY1 = 146;          // frame outer, screen = wall coords
  const FB = 11;                                             // frame border width
  const CX0 = FX0 + FB, CY0 = FY0 + FB, CW = FX1 - FX0 - 2 * FB, CH = FY1 - FY0 - 2 * FB; // canvas 102 x 96
  const FZ = 1.9, CZ = 0.8;                                  // frame front, canvas plane
  // table
  const TX0 = 86, TX1 = 132, TZ1 = 18, TTH = 31;
  // candle (chamberstick on the table)
  const KX = 112, KZ = 15.5, KB = TTH, KTOP = 46;              // candle x, depth, holder base, wick height
  // vase & letter rack on the table
  const VX = 95, VZ = 7.5, RKX = 125, RKZ = 6;
  // wall-hung regulator clock
  const QX0 = 184, QX1 = 202, QZ0 = 0, QZ1 = 5, QH0 = 104, QH1 = 174;
  // window
  const WX0 = 6, WX1 = 38, WH0 = 38, WH1 = 170, WZ0 = -6;
  // moon direction (travelling into the room): +x, down, toward camera
  const MDX = 0.62, MDY = -0.84, MDZ = 1.0;
  // runner rug (along the hall)
  const RZ0 = 56, RZ1 = 96;
  // the one who left the painting
  const SX = 140, SZ = 10.6;

  /* ================================================================ static hall */
  // damask tile, left half (10 x 30), mirrored about the axis; '#' velvet flock, '+' worn flock
  const DAM = [
    '..........', '.........#', '........##', '.......#.#', '........##', '.........#', '......#..#', '.....##.##',
    '....##..##', '...##..#.#', '..##..#..#', '..#..#...#', '.##.#..#.#', '.#..#.##.#', '.#.#..#.##', '.#.#...###',
    '.#..#....#', '..#..#...#', '..##..#..#', '...##..#.#', '....##..##', '.....##.##', '......#..#', '.......#.#',
    '........##', '.........#', '..........', '..........', '..........', '..........',
  ];
  const DAM2 = [ // small four-petal filler, sits in the gaps of the half-drop
    '........', '........', '........', '........', '........', '........', '........', '........', '........', '........',
    '........', '........', '........', '........', '........', '........', '........', '........', '........', '........',
    '........', '........', '........', '........', '........', '........', '.......#', '......#+', '.......#', '........',
  ];
  function damask(x, y) {
    const col = fl((x + 6) / 20), lx = (x + 6) - col * 20, yy = (y + (col & 1 ? 15 : 0)) % 30;
    const hx = lx < 10 ? lx : 19 - lx;
    let ch = DAM[yy][hx];
    if (ch === '.' && hx >= 2) ch = DAM2[(yy + 15) % 30][hx - 2] || '.';
    return ch;
  }
  function buildWall() {
    TG = BS; BS.zt = false;
    for (let y = 0; y < FL; y++) for (let x = 0; x < AW; x++) {
      penZ(0);
      let c = 16;
      if (y < 12) {
        // cornice: crown cove, dentils, fillet, egg-and-dart
        if (y === 0) { pen(0, 0, 0, -1, 0.3); c = 10; }
        else if (y < 4) { pen(0, 0, 0, -0.75, 0.6); c = y === 1 ? 12 : 13; }
        else if (y < 7) { const on = (x % 3) !== 2; pen(0, on ? 1 : 0, 0, y === 6 ? -0.6 : 0, 1); c = on ? (y === 6 ? 14 : 13) : 11; }
        else if (y === 7) { pen(0, 1, 0, -0.9, 0.4); c = 14; }
        else if (y < 11) { const e = x % 4, egg = e !== 3; pen(0, 0.8, 0, y === 10 ? -0.8 : y === 8 ? 0.4 : 0, 1); c = egg ? (y === 10 ? 14 : y === 8 ? 12 : 13) : 11; if (!egg && y === 9) c = 13; }
        else { pen(0, 0, 0, 0, 1); c = 10; }
      } else if (y < 17) {
        // frieze paper: dark ground, small gold anthemion
        c = 10;
        const a = (x + 2) % 8, b = y - 12;
        if ((a === 3 && b > 0 && b < 4) || (b === 2 && (a === 2 || a === 4)) || (b === 1 && (a === 1 || a === 5) && x % 16 < 8)) c = 19;
        if (y === 12 || y === 16) c = 9;
      } else if (y < 20) {
        // picture rail
        pen(0, 1.2, 0, y === 17 ? 0.8 : y === 19 ? -0.85 : 0, 1); c = y === 17 ? 12 : y === 18 ? 13 : 11;
      } else if (y < 169) {
        // flocked damask on oxblood; vertical paper seams; old stains
        const ch = damask(x, y - 20);
        c = ch === '#' ? 16 : ch === '+' ? 15 : 17;
        if ((x - 10) % 21 === 0 && ih(x, y >> 2, 3) < 0.55) c = c === 17 ? 16 : 15;
        const st = Math.hypot((x - 196) / 1.4, y - 34);
        if (st < 16 && ih(x, y, 5) < (16 - st) / 26) c = c === 17 ? 16 : 15;
        if (y < 24 && ih(x, y, 6) < 0.3 * (24 - y) / 4) c = 16;
      } else if (y < 173) {
        // dado rail
        pen(0, 1.5, 0, y === 169 ? 0.9 : y === 170 ? 0.45 : y === 172 ? -0.7 : 0, 1); c = y === 169 ? 13 : y === 170 ? 12 : y === 172 ? 10 : 12;
      } else if (y < 199) {
        // wainscot: stiles, rails, raised-and-fielded panels
        const px = (x + 9) % 30, py = y - 173;
        pen(0, 0.6, 0, 0, 1);
        c = 11;
        if (py < 3 || py > 22) { c = 11; if (py === 0) { pen(0, 0.6, 0, -0.6, 1); c = 10; } }
        else if (px < 4) { c = 11; }
        else {
          const ix = px - 4, iy = py - 3; // 0..25, 0..19
          const bt = iy < 2, bb = iy > 17, bl = ix < 2, br = ix > 23;
          if (bt && !bl && !br) { pen(0, 0.3, 0, 0.8, 0.6); c = 12; }
          else if (bb && !bl && !br) { pen(0, 0.3, 0, -0.8, 0.6); c = 10; }
          else if (bl) { pen(0, 0.3, -0.8, 0, 0.6); c = 11; }
          else if (br) { pen(0, 0.3, 0.8, 0, 0.6); c = 11; }
          else { pen(0, 0.9, 0, 0, 1); c = ih(x >> 1, y, 7) < 0.12 ? 12 : ih(x, y >> 1, 8) < 0.08 ? 10 : 11; }
        }
      } else {
        // skirting
        pen(0, 0.8, 0, y === 199 ? 0.7 : 0, 1);
        c = y === 199 ? 12 : y === 200 ? 10 : 11;
        if (y > 203) c = 10;
      }
      put(x, y, c);
    }
    // picture rail hooks
    for (const hx of [62, 154]) { penZ(1.5, 0, 0, 1, M_BRASS); put(hx, 18, 21); put(hx, 19, 20); put(hx, 20, 21); put(hx + 1, 20, 20); }
  }

  // floor: oak boards along the hall, true perspective, waxed
  function buildFloor() {
    TG = BS;
    for (let y = FL; y < AH; y++) for (let x = 0; x < AW; x++) {
      penH(0, M_GLOSS);
      world(x + 0.5, y + 0.5);
      const Z0 = WZ, X0 = WX;
      world(x + 0.5, y + 1.5); const Z1 = WZ;
      const bw = 4.5, r0 = fl(Z0 / bw), r1 = fl(Z1 / bw);
      const rowH = (Z1 - Z0) / bw; // rows per pixel
      const off = ih(r0, 3, 11) * 70, len = 50 + fl(ih(r0, 4, 11) * 40);
      let c = 11;
      const tone = ih(r0, 5, 11);
      if (tone < 0.25) c = 10; else if (tone > 0.8) c = 12;
      const gx = fl((X0 + off) / 5);
      if (ih(gx, r0, 12) < 0.18) c = c === 12 ? 11 : 12;
      if (ih(fl(X0 / 3), r0, 13) < 0.06) c = 10;
      // gaps between boards (only where a board is tall enough to show one)
      if (r0 !== r1 && rowH < 0.6) c = 9;
      // butt joints
      const wpx = (DC - Z0) / DC; // inches per pixel across
      const jx = ((X0 + off) % len + len) % len;
      if (jx < wpx * 1.0 && rowH < 0.5) c = 9;
      // slight cupping of boards for the gloss
      const fz = Z0 / bw - r0;
      const ny = 1, nz = (fz - 0.5) * 0.25;
      let ao = 255;
      if (Z0 < 8) ao = 120 + Z0 * 16;
      PEN.ao = ao;
      put(x, y, c, 0, ny, nz);
    }
  }

  // runner rug along the hall
  function rugAt(X, Z) {
    const w = Z - RZ0, u = X + 400;
    if (w < 0 || w > RZ1 - RZ0) return -1;
    const W = RZ1 - RZ0;
    const e = Math.min(w, W - w);
    if (e < 1.4) return 2;
    if (e < 2.4) return 20;
    if (e < 8.6) {
      // border: rosettes on navy joined by a vine
      const bw = e - 5.5, bu = ((u % 9) + 9) % 9 - 4.5;
      const dd = Math.abs(bu) + Math.abs(bw) * 1.35;
      if (dd < 1.3) return 17;
      if (dd < 2.9) return 21;
      if (Math.abs(bw - Math.sin(u * 0.7) * 1.6) < 0.55) return 20;
      if (dd < 3.6 && ((fl(u * 2) + fl(e * 2)) & 1)) return 26;
      return 3;
    }
    if (e < 9.6) return 26;
    if (e < 10.4) return 15;
    // field: lattice and medallions on red
    const fw = w - W / 2, fu = ((u % 28) + 28) % 28 - 14;
    const med = Math.abs(fu) / 10 + Math.abs(fw) / 9;
    if (med < 0.3) return 21;
    if (med < 0.52) return 26;
    if (med < 0.72) return 3;
    if (med < 0.86) return 20;
    const la = ((u + w * 1.3) % 7 + 7) % 7, lb = ((u - w * 1.3) % 7 + 7) % 7;
    if (la < 0.7 || lb < 0.7) return med < 1.1 ? 16 : 15;
    if (Math.abs(fu) > 12.6 && Math.abs(fw) < 2.2) return 20;
    return 17;
  }
  function buildRug() {
    TG = BS;
    for (let y = FL; y < AH; y++) for (let x = 0; x < AW; x++) {
      penH(0.4, M_RUG);
      world(x + 0.5, y + 0.5);
      // supersample 2 x 2 in the rug's own coordinates (perspective)
      const counts = {};
      let best = -1, bc = 0, n = 0;
      for (let sy = 0; sy < 2; sy++) for (let sx = 0; sx < 2; sx++) {
        world(x + 0.25 + sx * 0.5, y + 0.25 + sy * 0.5);
        const c = rugAt(WX, WZ);
        if (c < 0) continue;
        n++;
        counts[c] = (counts[c] || 0) + 1;
        if (counts[c] > bc) { bc = counts[c]; best = c; }
      }
      if (n < 2) continue;
      world(x + 0.5, y + 0.5);
      // worn pile in the middle of the walkway
      if (best === 17 && ih(x, y, 21) < 0.08) best = 16;
      put(x, y, best);
    }
  }

  // tall sash window, its reveal and the night outside (glass emissive)
  function buildWindow() {
    TG = BS;
    const [gx0, gy0] = proj(WX0, WH1, WZ0), [gx1, gy1] = proj(WX1, WH0, WZ0);
    // reveal: left jamb (X = WX0 plane, facing +x) and soffit
    for (let y = 36; y < 169; y++) for (let x = WX0; x < Math.ceil(gx0); x++) { penX(WX0, 1, M_MATTE, 150); put(x, y, 12); }
    for (let y = 36; y < Math.ceil(gy0); y++) for (let x = WX0; x < WX1; x++) { pen(1, WH1, 0, -1, 0, M_MATTE, 150); put(x, y, 12); }
    // the night: sky, moon, cloud, bare tree, rooftops
    const R = mulberry32(911);
    for (let y = Math.ceil(gy0); y < 169; y++) for (let x = Math.ceil(gx0); x < WX1; x++) {
      penZ(WZ0, 0, 0, 1, M_EMIT);
      const b = bay(x, y);
      const mx = 17, my = 58;
      const dm = Math.hypot(x + 0.5 - mx, y + 0.5 - my);
      let c = 2;
      const sky = (y - 40) / 120 + (x - 10) / 90;
      if (sky < 0.35) c = b < (0.35 - sky) * 3 ? 3 : 2; else c = b < (sky - 0.35) * 1.4 ? 1 : 2;
      if (dm < 22) c = dm < 12 ? 4 : (b < (22 - dm) / 10 ? 4 : 3);
      if (dm < 7.5) c = dm < 6.2 ? 8 : 7;
      if (dm < 5.5 && ((x === 15 && y === 57) || (x === 18 && y === 60) || (x === 19 && y === 56) || (x === 16 && y === 60))) c = 7;
      // cloud band across the moon
      const cl = Math.sin(x * 0.21 + y * 0.05) * 2.2 + 66 - y * 0.02;
      if (Math.abs(y - cl) < 1.6 && x < 36) c = dm < 12 ? 6 : 4;
      if (Math.abs(y - cl - 2) < 0.8 && x < 34) c = dm < 12 ? 5 : 3;
      if (R() < 0.006 && dm > 14 && y < 110) c = 7;
      // distant rooftops & a spire
      const roof = 150 - Math.max(0, 6 - Math.abs(x - 28) * 0.9) - (x < 18 ? 4 : 0) - Math.max(0, 22 - Math.abs(x - 13) * 6.5);
      if (y > roof) c = 1;
      if (y > roof && (x === 30 || x === 31) && (y === 154 || y === 155)) c = 24;
      put(x, y, c);
    }
    // bare tree silhouette (branches drawn emissive near-black)
    penZ(WZ0, 0, 0, 1, M_EMIT);
    BS.x0 = Math.ceil(gx0); BS.x1 = WX1; BS.y0 = Math.ceil(gy0); BS.y1 = 169;
    const br = (x0, y0, x1, y1) => line(x0, y0, x1, y1, 0);
    br(36, 168, 34, 120); br(35, 168, 33, 121); br(34, 121, 30, 96); br(33, 122, 37, 98); br(30, 96, 24, 80); br(30, 96, 32, 78);
    br(24, 80, 14, 72); br(24, 80, 22, 66); br(22, 66, 25, 52); br(14, 72, 8, 74); br(32, 78, 36, 64); br(36, 64, 35, 48);
    br(22, 66, 16, 60); br(25, 52, 29, 44); br(35, 48, 31, 40); br(28, 108, 20, 104); br(20, 104, 12, 108); br(33, 140, 26, 136);
    put(13, 71, 0); put(12, 72, 0); put(21, 103, 0); put(15, 106, 0);
    BS.x0 = 0; BS.y0 = 0; BS.x1 = AW; BS.y1 = AH;
    // sash: frame, meeting rail, glazing bars (dark painted wood, lit)
    pen(0, WZ0 + 0.5, 0, 0, 1, M_MATTE, 200);
    for (let y = Math.ceil(gy0); y < 169; y++) for (let x = Math.ceil(gx0); x < WX1; x++) {
      const X = XC + (x + 0.5 - XC) * (DC - WZ0) / DC, H = EC + (YH - y - 0.5) * (DC - WZ0) / DC;
      const fr = X < WX0 + 2.2 || X > WX1 - 2.2 || H > WH1 - 2.4 || H < WH0 + 3;
      const meet = Math.abs(H - 104) < 1.6;
      const bar = Math.abs(X - 22) < 0.8;
      if (fr || meet || bar) {
        const top = (meet && H > 104.6) || (H < WH0 + 3 && H > WH0 + 2.2);
        put(x, y, top ? 12 : meet && H < 103.4 ? 10 : 11, 0, top ? 0.8 : 0, 1);
      }
    }
    // sill (stool) seen from above
    penH(WH0, M_MATTE, 220);
    for (let x = WX0 - 2; x < WX1 + 3; x++) { put(x, 168, 13); }
    penZ(3, 0, -0.2, 1, M_MATTE, 220);
    for (let x = WX0 - 2; x < WX1 + 3; x++) { put(x, 169, 12); put(x, 170, 11); }
  }

  // velvet curtains (left static, right drawn live), tied back, with a pleated heading and a gold fringe
  const CUR_TOP = 30, CUR_TIE = 158, CUR_BOT = 207;
  function curtainEdge(side, y, sway) {
    // the free (inner) edge of each curtain at row y
    if (side < 0) { const k = y < CUR_TIE ? (y - CUR_TOP) / (CUR_TIE - CUR_TOP) : 1 - (y - CUR_TIE) / (CUR_BOT - CUR_TIE); return 9 - 3 * Math.sin(clamp(k, 0, 1) * Math.PI / 2); }
    const k = y < CUR_TIE ? (y - CUR_TOP) / (CUR_TIE - CUR_TOP) : 1 - (y - CUR_TIE) / (CUR_BOT - CUR_TIE) * 0.82;
    const lower = y > CUR_TIE ? (y - CUR_TIE) / (CUR_BOT - CUR_TIE) : 0;
    return 31 + 8 * Math.pow(clamp(k, 0, 1), 1.3) - sway * (0.6 + lower * 1.6);
  }
  function drawCurtain(side, sway) {
    const z = 4;
    const x0 = side < 0 ? 0 : 30, x1 = side < 0 ? 12 : 48;
    for (let y = CUR_TOP; y < CUR_BOT; y++) {
      const e = curtainEdge(side, y, sway);
      const xa = side < 0 ? 0 : Math.round(e), xb = side < 0 ? Math.round(e) : 47;
      const w = Math.max(1, xb - xa);
      for (let x = xa; x <= xb; x++) {
        // folds: rounded tubes whose spacing compresses into the gather at the tieback
        const u = side < 0 ? x / w : (xb - x) / w; // 0 at the wall side
        const nFold = side < 0 ? 1.6 : 2.3;
        const ph = u * nFold * TAU + (side > 0 ? sway * 0.35 * Math.max(0, y - 60) / 140 : 0.8);
        const sn = Math.sin(ph), cs = Math.cos(ph);
        const nx = sn * 0.62 * (side < 0 ? 1 : -1), nz = 0.6 + 0.4 * Math.abs(cs);
        let c = 29;
        if (cs > 0.82) c = 30;            // crest of the fold catches light
        else if (cs < -0.9) c = 9;        // deep crease
        else if (cs < -0.55) c = 28;
        if ((side < 0 && x === xb) || (side > 0 && x === xa)) c = 28;
        // pleated heading under the rings
        if (y < CUR_TOP + 5) { c = (x % 3 === 0) ? 28 : y === CUR_TOP ? 28 : 29; }
        // gold fringe at the hem
        if (y >= CUR_BOT - 4) c = y === CUR_BOT - 4 ? 21 : ((x + y) & 1) ? 20 : 19;
        penZ(z + (side > 0 ? 0.4 * Math.abs(cs) : 0), 0, 0, 1, y >= CUR_BOT - 4 ? M_BRASS : M_VEL, 255);
        put(x, y, c, nx, 0, nz);
      }
    }
    // the tieback: a gold cord and tassel
    const tx = side < 0 ? Math.round(curtainEdge(side, CUR_TIE, 0)) - 1 : Math.round(curtainEdge(side, CUR_TIE, sway)) + 1;
    penZ(z + 1, 0, 0.3, 1, M_BRASS);
    for (let k = -3; k <= 3; k++) put(tx - k * side, CUR_TIE + (Math.abs(k) > 2 ? 1 : 0), (k & 1) ? 21 : 22);
    put(tx, CUR_TIE + 1, 21); put(tx, CUR_TIE + 2, 22); put(tx - 1, CUR_TIE + 3, 20); put(tx, CUR_TIE + 3, 21); put(tx + 1, CUR_TIE + 3, 20);
    for (let k = 4; k < 8; k++) { put(tx - 1, CUR_TIE + k, 19); put(tx, CUR_TIE + k, (k & 1) ? 21 : 20); put(tx + 1, CUR_TIE + k, 19); }
  }
  function buildPole() {
    penZ(5, 0, 0.3, 1, M_BRASS);
    for (let x = 0; x < 50; x++) { put(x, 27, 21); put(x, 28, 20); }
    put(48, 26, 21); put(49, 26, 22); put(50, 26, 21); put(48, 27, 22); put(49, 27, 21); put(50, 27, 20); put(49, 28, 19); put(49, 25, 20); put(51, 27, 20);
    for (let k = 0; k < 7; k++) { put(2 + k * 7, 29, 20); put(36 + (k % 2), 29, 20); }
  }

  /* --- the gilt frame: carved height field, normals from it, worn gilding --- */
  const FRH = new Float32Array(AW * AH); // frame height (inches proud of the wall)
  function frameProfile(p) {
    // p: 0 outer edge .. FB inner sight edge
    const pts = [[0, 1.0], [0.8, 2.1], [1.8, 2.75], [2.8, 2.35], [3.6, 1.6], [5.0, 1.25], [6.2, 1.7], [7.2, 2.65], [8.0, 3.2], [8.9, 2.75], [9.7, 2.2], [10.4, 1.9], [11, 1.05]];
    for (let i = 0; i + 1 < pts.length; i++) {
      const a = pts[i], b = pts[i + 1];
      if (p <= b[0]) { const t = (p - a[0]) / (b[0] - a[0]); const s = t * t * (3 - 2 * t); return a[1] + (b[1] - a[1]) * s; }
    }
    return 1.0;
  }
  function frameHeight(x, y) {
    // x, y continuous screen coords; returns height or -1 outside the frame
    const dl = x - FX0, dr = FX1 - x, dt = y - FY0, db = FY1 - y;
    const p = Math.min(dl, dr, dt, db);
    if (p < 0) return -1;
    if (p >= FB) return -2;
    // which member (for the along-coordinate)
    let s;
    if (p === dt || p === db) s = x - FX0; else s = y - FY0;
    let h = frameProfile(p);
    // cove: acanthus leaves (repeating every 7)
    if (p > 3.4 && p < 6.4) {
      const ph = ((s % 8) + 8) % 8, lp = (p - 3.4) / 3;
      const leaf = Math.max(0, 1 - Math.abs(ph - 4 + (lp - 0.5) * 2.2) / (3.1 - lp * 1.4));
      h += leaf * 1.25 * Math.sin(lp * Math.PI);
      if (Math.abs(ph - 4 + (lp - 0.5) * 2.2) < 0.45 && lp > 0.15 && lp < 0.85) h -= 0.45; // leaf vein
    }
    // ridge: bead and reel (period 3)
    if (p > 7.1 && p < 8.9) {
      const ph = ((s % 3) + 3) % 3;
      h += (ph < 2 ? 0.35 * Math.sin(ph / 2 * Math.PI) : -0.3);
    }
    // outer bead: tiny pearls
    if (p > 0.8 && p < 2.8) { const ph = ((s % 2) + 2) % 2; h += ph < 1.2 ? 0.2 : -0.1; }
    // corner cartouches: raised shell with radial ribs
    const corners = [[FX0 + 5.5, FY0 + 5.5], [FX1 - 5.5, FY0 + 5.5], [FX0 + 5.5, FY1 - 5.5], [FX1 - 5.5, FY1 - 5.5]];
    for (const [cx, cy] of corners) {
      const d = Math.hypot(x - cx, y - cy);
      if (d < 7.5) {
        const a = Math.atan2(y - cy, x - cx);
        const rib = 0.5 + 0.5 * Math.cos(a * 9);
        const dome = Math.cos(d / 7.5 * Math.PI / 2);
        h = Math.max(h, 1.6 + dome * 1.9 + rib * 0.5 * dome);
      }
    }
    // centre cartouches on the long members
    const mids = [[(FX0 + FX1) / 2, FY0 + 5.5], [(FX0 + FX1) / 2, FY1 - 5.5], [FX0 + 5.5, (FY0 + FY1) / 2], [FX1 - 5.5, (FY0 + FY1) / 2]];
    for (const [cx, cy] of mids) {
      const d = Math.hypot((x - cx) / 1.6, y - cy);
      if (d < 5.2) { const dome = Math.cos(d / 5.2 * Math.PI / 2); h = Math.max(h, 1.8 + dome * 1.6 + 0.3 * Math.cos(Math.atan2(y - cy, x - cx) * 6) * dome); }
    }
    return h;
  }
  function crestHeight(x, y) {
    // the crest above the top member: a scallop shell with scrolls
    const cx = (FX0 + FX1) / 2, by = FY0 + 1;
    const dx = x - cx, dy = by - y;
    if (dy < 0 || dy > 9) return -1;
    const r = Math.hypot(dx / 1.15, dy * 1.05);
    if (r < 8.5 && dy > 0) {
      const a = Math.atan2(dy, dx);
      return 1.4 + Math.cos(r / 8.5 * Math.PI / 2) * 1.6 + 0.45 * Math.max(0, Math.cos(a * 11)) * (r / 8.5);
    }
    // side scrolls
    for (const s of [-1, 1]) {
      const sx = cx + s * 12, d = Math.hypot(x - sx, y - (by - 2.5));
      if (d < 3.2 && dy < 6) return 1.5 + Math.cos(d / 3.2 * Math.PI / 2) * 1.0 + (d < 1.2 ? -0.4 : 0);
      if (Math.abs(x - (cx + s * 9.5)) < 2.6 && dy < 2.2 && dy > 0) return 1.6;
    }
    return -1;
  }
  function buildFrame() {
    TG = BS;
    // heights
    for (let y = FY0 - 10; y <= FY1; y++) for (let x = FX0; x <= FX1; x++) {
      if (y < 0) continue;
      let h = 0;
      // 2x2 supersampled height
      for (let sy = 0; sy < 2; sy++) for (let sx = 0; sx < 2; sx++) {
        const X = x + 0.25 + sx * 0.5, Y = y + 0.25 + sy * 0.5;
        let v = frameHeight(X, Y);
        const cr = crestHeight(X, Y);
        if (cr > 0) v = Math.max(v, cr);
        h += v < 0 ? (v === -2 ? -0.5 : -9) : v;
      }
      FRH[y * AW + x] = h / 4;
    }
    const at = (x, y) => FRH[y * AW + x];
    for (let y = FY0 - 10; y < FY1; y++) for (let x = FX0; x < FX1; x++) {
      if (y < 0) continue;
      const h = at(x, y);
      if (h < 0.4) continue;
      const hx0 = at(x - 1, y), hx1 = at(x + 1, y), hy0 = at(x, y - 1), hy1 = at(x, y + 1);
      const ok = (v) => v > 0.3;
      const gx = (ok(hx1) ? hx1 : h - 1.2) - (ok(hx0) ? hx0 : h - 1.2);
      const gy = (ok(hy1) ? hy1 : h - 1.2) - (ok(hy0) ? hy0 : h - 1.2);
      const nx = -gx * 0.9, ny = gy * 0.9, nz = 1;
      // gilding: recesses dark, high points bright, rubbed bole on a few highs, dust in the deepest
      const curv = (hx0 + hx1 + hy0 + hy1) / 4 - h;
      let c = h > 2.85 ? 22 : h > 1.75 ? 21 : h > 1.3 ? 20 : 19;
      if (curv > 0.28) c = c > 19 ? c - 1 : 19;
      if (curv < -0.35 && c < 22) c++;
      if (h > 2.6 && ih(x, y, 31) < 0.05) c = 18; // gilding rubbed through to the red bole
      if (h < 1.35 && ih(x, y, 32) < 0.25) c = 19; // old dust in the hollows
      pen(0, h * 0.7, 0, 0, 1, M_GILT, clamp(fl(140 + h * 38), 0, 255));
      put(x, y, c, nx, ny, nz);
    }
    // a small brass title plate on the bottom member
    penZ(3.0, 0, 0.2, 1, M_BRASS);
    const px0 = 98, py0 = FY1 - 6;
    rect(px0, py0, 20, 4, 21); hl(px0, px0 + 19, py0, 22); hl(px0, px0 + 19, py0 + 3, 20);
    for (let k = 0; k < 7; k++) { put(px0 + 3 + k * 2, py0 + 1, 19); if (k % 3 !== 1) put(px0 + 3 + k * 2, py0 + 2, 19); }
    put(px0 + 1, py0 + 1, 19); put(px0 + 18, py0 + 2, 19);
    // hanging cords from the rail hooks
    penZ(1.6, 0, 0, 1, M_GILT);
    line(62, 21, 66, FY0 - 1, 20); line(154, 21, 150, FY0 - 1, 20);
    for (let y = 21; y < FY0; y += 2) { const t = (y - 21) / (FY0 - 21); put(Math.round(62 + 4 * t), y, 21); put(Math.round(154 - 4 * t), y, 21); }
  }

  /* --- table, chamberstick and candle, letter rack, vase of dead roses --- */
  function buildTable() {
    TG = BS; BS.zt = true;
    const Z1 = TZ1;
    // back legs (in the dark under the table)
    for (const lx of [TX0 + 2, TX1 - 4]) {
      penZ(2, 0, 0, 1, M_MATTE, 90);
      const [x0, y0] = proj(lx, 25, 2), [, y1] = proj(lx, 0, 2);
      for (let y = Math.round(y0); y < Math.round(y1); y++) { put(x0, y, 10); put(x0 + 1, y, 10); }
    }
    // underside shadow region is just the wall/floor, darkened by ao
    // apron front (Z = Z1 - 1) with a drawer, scalloped lower edge
    const [ax0, ay0] = proj(TX0, 29.5, Z1 - 1), [ax1, ay1] = proj(TX1, 24, Z1 - 1);
    for (let y = Math.round(ay0); y < Math.round(ay1); y++) for (let x = Math.round(ax0); x < Math.round(ax1); x++) {
      penZ(Z1 - 1, 0, 0, 1, M_MATTE, 200);
      const ly = y - Math.round(ay0), lx = x - Math.round(ax0), w = Math.round(ax1) - Math.round(ax0);
      let c = 12;
      if (ly === 0) c = 13;
      const dr0 = Math.round(w * 0.25), dr1 = Math.round(w * 0.75);
      if (lx >= dr0 && lx <= dr1 && ly >= 1 && ly <= 4) { c = (lx === dr0 || ly === 1) ? 10 : (lx === dr1 || ly === 4) ? 13 : 12; }
      if (ly >= Math.round(ay1) - Math.round(ay0) - 1 && Math.abs(lx - w / 2) > 4) c = 11;
      if (ih(x >> 1, y, 41) < 0.1) c = c === 12 ? 11 : c;
      put(x, y, c);
    }
    // drawer knob (brass)
    { const [kx, ky] = proj((TX0 + TX1) / 2, 26.8, Z1); penZ(Z1 + 0.6, 0, 0.2, 1, M_BRASS); put(kx - 0.5, ky, 21); put(kx + 0.5, ky, 20); put(kx, ky - 1, 22); }
    // front legs: turned
    for (const lx of [TX0 + 1.5, TX1 - 2.5]) {
      for (let H = 0; H < 24; H += 0.25) {
        const [px, py] = proj(lx, H, Z1 - 1);
        let r = 1.0;
        if (H < 2) r = 1.3; else if (H < 4) r = 0.8; else if (H > 6 && H < 11) r = 1.0 + 0.9 * Math.sin((H - 6) / 5 * Math.PI); else if (H > 13 && H < 15) r = 1.4; else if (H > 18) r = 1.25;
        for (let dx = -r; dx <= r + 0.01; dx += 0.5) {
          const u = dx / (r + 0.01);
          penZ(Z1 - 1 + Math.sqrt(Math.max(0, 1 - u * u)), 0, 0, 1, M_GLOSS, 210);
          const c = u < -0.4 ? 13 : u > 0.5 ? 10 : 12;
          put(px + dx * 1.08, py, c, u, 0, Math.sqrt(Math.max(0.05, 1 - u * u)));
        }
      }
    }
    // top slab: edge (front face) and the top surface
    const [tx0, ty0] = proj(TX0 - 1, TTH, Z1), [tx1, ty1] = proj(TX1 + 1, TTH - 1.6, Z1);
    for (let y = Math.round(ty0); y <= Math.round(ty1); y++) for (let x = Math.round(tx0); x < Math.round(tx1); x++) {
      penZ(Z1, 0, y === Math.round(ty0) ? 0.6 : 0, 1, M_GLOSS, 230);
      put(x, y, y === Math.round(ty0) ? 14 : y === Math.round(ty1) ? 11 : 13);
    }
    const [bx0, by0] = proj(TX0 - 1, TTH, 0);
    for (let y = Math.round(by0); y < Math.round(ty0); y++) for (let x = Math.round(bx0); x < Math.round(tx1); x++) {
      penH(TTH, M_GLOSS, 230);
      world(x + 0.5, y + 0.5);
      if (WX < TX0 - 1 || WX > TX1 + 1 || WZ < 0 || WZ > Z1) continue;
      put(x, y, ih(x, y, 43) < 0.15 ? 12 : 13);
    }
    // side faces of the slab
    BS.zt = false;
  }
  function buildCandle() {
    TG = BS; BS.zt = true;
    // chamberstick: drip pan (seen nearly edge-on), socket, finger ring
    const [cx, cy] = proj(KX, KB + 0.6, KZ);
    const X = Math.round(cx), Y = Math.round(cy);
    penZ(KZ + 2, 0, 0.5, 1, M_BRASS);
    for (let i = -6; i <= 6; i++) { put(X + i, Y, Math.abs(i) > 5 ? 20 : i < -2 ? 22 : 21); }
    for (let i = -5; i <= 5; i++) put(X + i, Y + 1, i < -3 ? 21 : 20);
    for (let i = -4; i <= 4; i++) put(X + i, Y - 1, i < 0 ? 22 : 21);
    put(X - 4, Y - 1, 21); put(X + 5, Y - 1, 20);
    // wax spilt on the pan
    penZ(KZ + 2.2, 0, 0.6, 1, M_WAX); put(X - 3, Y - 1, 26); put(X + 3, Y - 1, 26); put(X + 4, Y - 1, 27); put(X - 2, Y - 1, 26);
    // finger ring on the right
    penZ(KZ + 1, 0, 0, 1, M_BRASS);
    put(X + 7, Y - 1, 21); put(X + 8, Y - 2, 21); put(X + 9, Y - 3, 20); put(X + 9, Y - 4, 20); put(X + 8, Y - 5, 21); put(X + 7, Y - 5, 22); put(X + 7, Y, 20);
    // socket (nozzle)
    penZ(KZ + 1, 0, 0, 1, M_BRASS);
    for (let j = 2; j <= 5; j++) for (let i = -2; i <= 2; i++) put(X + i, Y - j, i < 0 ? 22 : i === 0 ? 21 : 20);
    hl(X - 3, X + 3, Y - 6, 21); put(X - 3, Y - 6, 22); put(X + 3, Y - 6, 20);
    // candle: wax column with drips
    penZ(KZ + 1, 0, 0, 1, M_WAX);
    const top = Y - 17;
    for (let y = top; y <= Y - 7; y++) for (let i = -2; i <= 1; i++) {
      let c = i === -2 ? 27 : i === -1 ? 26 : i === 0 ? 27 : 14;
      if (i === 1 && y > top + 5) c = 13;
      put(X + i, y, c, i * 0.6, 0, 1);
    }
    // melted rim and the pool around the wick
    put(X - 2, top, 26); put(X + 1, top, 26); put(X - 1, top, 14); put(X, top, 14);
    // drips
    put(X - 3, top + 1, 26); put(X - 3, top + 2, 26); put(X - 3, top + 3, 27); put(X - 3, top + 4, 26);
    put(X + 2, top + 2, 27); put(X + 2, top + 3, 14); put(X - 1, top + 5, 23); put(X, top + 8, 23);
    put(X + 2, Y - 8, 27); put(X + 2, Y - 7, 26); put(X - 3, Y - 7, 26);
    BS.zt = false;
    CANDLE.x = X; CANDLE.wick = top - 1;
  }
  const CANDLE = { x: 0, wick: 0 };
  // letter rack: brass, three letters, the front one black-bordered with a red seal
  function buildRack() {
    TG = BS; BS.zt = true;
    const [x, y] = proj(RKX, TTH, RKZ + 3);
    const X = Math.round(x), Y = Math.round(y);
    penZ(RKZ, 0, 0, 1, M_MATTE);
    rect(X - 2, Y - 8, 7, 6, 27); hl(X - 2, X + 4, Y - 8, 26); vl(X + 4, Y - 8, Y - 3, 14);
    penZ(RKZ + 1.5, 0, 0, 1, M_MATTE);
    rect(X - 5, Y - 6, 8, 5, 26); hl(X - 5, X + 2, Y - 6, 0); vl(X - 5, Y - 6, Y - 2, 0); vl(X + 2, Y - 6, Y - 2, 1);
    put(X - 2, Y - 4, 17); put(X - 1, Y - 4, 18); put(X - 2, Y - 3, 16);
    penZ(RKZ + 3, 0, 0.2, 1, M_BRASS);
    hl(X - 6, X + 5, Y - 1, 21); hl(X - 6, X + 5, Y, 20); put(X - 6, Y - 2, 22); put(X - 6, Y - 3, 21); put(X + 5, Y - 2, 20); put(X + 5, Y - 3, 20);
    BS.zt = false;
  }
  // a lace runner on the table top, draped over the front edge
  function buildLace() {
    TG = BS; BS.zt = true;
    const [x0, y0] = proj(KX - 15, TTH, TZ1), [x1] = proj(KX + 13, TTH, TZ1);
    const yt = Math.round(y0);
    for (let x = Math.round(x0); x < Math.round(x1); x++) {
      const k = x - Math.round(x0);
      penZ(TZ1 + 0.3, 0, 0.2, 1, M_MATTE, 230);
      const drop = 2 + ((k % 4 === 1 || k % 4 === 2) ? 1 : 0);
      for (let j = 0; j <= drop; j++) {
        const hole = j === 1 && k % 2 === 0;
        put(x, yt + j, hole ? 13 : j === 0 ? 26 : (k + j) % 3 === 0 ? 27 : 26);
      }
    }
    // the runner on the top surface (a sliver in this perspective)
    penH(TTH + 0.1, M_MATTE, 230);
    for (let y = yt - 3; y < yt; y++) for (let x = Math.round(x0) + 1; x < Math.round(x1) - 1; x++) { world(x + 0.5, y + 0.5); if (WZ > 4 && WZ < TZ1) put(x, y, (x + y) % 3 ? 26 : 27); }
    BS.zt = false;
  }
  // vase of dead roses: sprite and the same geometry as a shadow mask
  const VASE_STEMS = [ // [x0,h0,x1,h1] in inches relative to (VX, TTH) ; heads [x,h,r, droop]
    [-0.5, 10, -3.8, 21], [0, 10, 1.2, 24], [0.6, 10, 4.6, 19.5], [0.2, 10, -1.6, 17], [1.0, 10, 6.6, 15.2],
  ];
  const VASE_HEADS = [[-4.2, 21.2, 1.6], [1.4, 24.5, 1.9], [5.2, 19.0, 1.5], [-2.2, 16.6, 1.3], [7.0, 14.2, 1.4]];
  let VMASK = null;
  function vaseShape(x, h) { // relative inches; porcelain baluster vase 0..10 tall
    if (h < 0 || h > 10.4) return false;
    const r = h < 1 ? 2.4 : h < 6.5 ? 2.4 + 1.3 * Math.sin((h - 1) / 5.5 * Math.PI) - (h > 5 ? (h - 5) * 0.9 : 0) : h < 9 ? 1.3 : 1.3 + (h - 9) * 0.9;
    return Math.abs(x) <= r;
  }
  function buildVase() {
    TG = BS; BS.zt = true;
    // mask
    VMASK = mkMask(VX - 8, TTH + 27, 18, 28);
    mFill(VMASK, (X, H) => {
      const x = X - VX, h = H - TTH;
      if (vaseShape(x, h)) return true;
      for (const s of VASE_STEMS) if (segD(x, h, s[0], s[1], s[2], s[3]) < 0.32) return true;
      for (const hd of VASE_HEADS) if (inEll(hd[0], hd[1], hd[2] * 1.1, hd[2] * 0.85, x, h)) return true;
      // dry leaves
      if (inEll(-2.2, 14.5, 1.3, 0.45, x, h) || inEll(3.2, 15.5, 1.2, 0.4, x, h)) return true;
      return false;
    });
    // sprite, drawn at the vase's depth
    const [ox, oy] = proj(VX, TTH, VZ);
    for (let y = Math.round(oy) - 30; y <= Math.round(oy); y++) for (let x = Math.round(ox) - 10; x <= Math.round(ox) + 10; x++) {
      penZ(VZ, 0, 0, 1, M_MATTE);
      world(x + 0.5, y + 0.5);
      const rx = WX - VX, rh = WH - TTH;
      if (vaseShape(rx, rh)) {
        // blue-and-white porcelain: rounded shading, a painted band, glaze highlight
        const rr = rh < 1 ? 2.4 : rh < 6.5 ? 2.4 + 1.3 * Math.sin((rh - 1) / 5.5 * Math.PI) - (rh > 5 ? (rh - 5) * 0.9 : 0) : rh < 9 ? 1.3 : 1.3 + (rh - 9) * 0.9;
        const u = clamp(rx / rr, -1, 1);
        let c = 7;
        if (u > 0.45) c = 6; if (u > 0.8) c = 5;
        if (u < -0.5) c = 8;
        if ((rh > 2.6 && rh < 4.8) && ((fl(rx * 1.5 + rh * 1.2) & 1) || Math.abs(rh - 3.7) < 0.5)) c = u > 0.4 ? 3 : 4;
        if (Math.abs(rh - 8.6) < 0.5) c = 4;
        if (rh < 0.8) c = u > 0.3 ? 4 : 5;
        PEN.m = M_GLASS;
        put(x, y, c, u, 0.1, Math.sqrt(Math.max(0.05, 1 - u * u)));
      }
    }
    // stems & leaves & heads (drawn as lines in screen space)
    penZ(VZ + 0.5, 0, 0, 1, M_MATTE);
    const P = (x, h) => proj(VX + x, TTH + h, VZ + 0.5);
    for (const s of VASE_STEMS) { const a = P(s[0], s[1]), b = P(s[2], s[3]); line(a[0], a[1], b[0], b[1], 29); }
    { const a = P(-2.2, 14.5); put(a[0] - 1, a[1], 29); put(a[0], a[1], 30); put(a[0] + 1, a[1] - 1, 29); const b = P(3.2, 15.5); put(b[0], b[1], 29); put(b[0] + 1, b[1], 28); }
    VASE_HEADS.forEach((hd, k) => {
      const [hx, hy] = P(hd[0], hd[1]);
      ell(hx, hy, hd[2] * 1.05, hd[2] * 0.85, 31, (x, y, u, v) => (v < -0.4 ? (u < 0 ? 18 : 31) : u > 0.4 ? 15 : v > 0.5 ? 16 : (ih(x, y, 50 + k) < 0.35 ? 12 : 31)));
      put(hx, hy + hd[2] * 0.85, 12);
    });
    // fallen petals on the table top
    penH(TTH + 0.1, M_MATTE);
    for (const [px, pz] of [[VX - 6, 10], [VX + 5, 9], [VX + 7, 12], [VX - 3, 13]]) { const [x, y] = proj(px, TTH, pz); put(x, y, 31); }
    BS.zt = false;
  }

  /* --- Vienna regulator on the wall (case static; pendulum and its glints live) --- */
  const CLK = { px: 0, py: 0, len: 0, x0: 0, x1: 0, y0: 0, y1: 0 };
  function buildClock() {
    TG = BS; BS.zt = true;
    const s = DC / (DC - QZ1);
    const PX = (X) => XC + (X - XC) * s, PY = (H) => YH + (EC - H) * s;
    const ix = (X) => Math.round(PX(X)), iy = (H) => Math.round(PY(H));
    const cxm = (QX0 + QX1) / 2;
    // left side of the case, seen in perspective (faces the candle)
    for (let y = iy(QH1 - 8); y < iy(QH0 + 4); y++) {
      const xa = proj(QX0, 140, QZ0)[0], xb = PX(QX0);
      for (let x = Math.round(xa); x < Math.round(xb); x++) { penX(QX0, -1, M_GLOSS, 200); world(x + 0.5, y + 0.5); if (WZ < QZ0 || WZ > QZ1) continue; put(x, y, 12); }
    }
    // case: walnut, half-turned columns, glazed door
    for (let y = iy(QH1 - 6); y < iy(QH0 + 4); y++) for (let x = ix(QX0); x < ix(QX1); x++) {
      penZ(QZ1, 0, 0, 1, M_GLOSS, 230); world(x + 0.5, y + 0.5);
      const X = WX, H = WH;
      let c = 12;
      const col = X < QX0 + 2.2 || X > QX1 - 2.2;
      if (col) { const u = X < cxm ? (X - QX0) / 2.2 : (QX1 - X) / 2.2; c = u < 0.35 ? 11 : u > 0.7 ? 13 : 12; if (fl(H) % 9 === 0) c = 21; put(x, y, c, X < cxm ? -0.6 : 0.6, 0, 0.8); continue; }
      const glass = X > QX0 + 3.6 && X < QX1 - 3.6 && H > QH0 + 7 && H < QH1 - 23;
      if (glass) continue;
      const door = X > QX0 + 2.8 && X < QX1 - 2.8 && H > QH0 + 6 && H < QH1 - 8;
      if (door) c = (X < QX0 + 3.6 || H > QH1 - 23) ? 13 : 12;
      if (H < QH0 + 6.5 && H > QH0 + 5) c = 14;
      if (ih(x, y >> 1, 62) < 0.12) c = c === 12 ? 11 : c;
      put(x, y, c);
    }
    // the glazed trunk: dark back board (pendulum drawn live)
    CLK.x0 = ix(QX0 + 3.6); CLK.x1 = ix(QX1 - 3.6); CLK.y0 = iy(QH1 - 23); CLK.y1 = iy(QH0 + 7);
    for (let y = CLK.y0; y < CLK.y1; y++) for (let x = CLK.x0; x < CLK.x1; x++) { penZ(QZ0 + 1.5, 0, 0, 1, M_MATTE, 70); put(x, y, (x + y * 3) % 11 === 0 ? 11 : 10); }
    // white enamel dial behind the glazed bezel
    const dcx = PX(cxm), dcy = PY(QH1 - 15);
    CLK.px = Math.round(dcx); CLK.py = Math.round(dcy) + 5;
    for (let y = fl(dcy) - 8; y <= fl(dcy) + 8; y++) for (let x = fl(dcx) - 8; x <= fl(dcx) + 8; x++) {
      const r = Math.hypot(x + 0.5 - dcx, y + 0.5 - dcy);
      if (r > 7.2) continue;
      let c = (x + y) & 1 ? 21 : 22;
      penZ(QZ1 + 0.3, 0, 0, 1, M_BRASS, 255);
      if (r > 6.1) { c = r > 6.7 ? 19 : 20; }
      else if (r > 4.3 && r < 6.1) { PEN.m = M_MATTE; c = 8; const a = Math.atan2(y + 0.5 - dcy, x + 0.5 - dcx); const k = Math.round(a / (TAU / 12)); if (Math.abs(a - k * TAU / 12) < 0.22) c = 1; }
      else if (r < 2) c = 20;
      put(x, y, c);
    }
    penZ(QZ1 + 0.5, 0, 0, 1, M_MATTE);
    line(dcx, dcy, dcx + 3.0, dcy + 1.0, 0); line(dcx, dcy, dcx + 0.6, dcy - 4.0, 0); put(dcx, dcy, 21);
    // carved crest with a finial, and a turned drop below
    for (let y = iy(QH1 + 5); y < iy(QH1 - 6); y++) for (let x = ix(QX0 - 1); x < ix(QX1 + 1); x++) {
      penZ(QZ1 + 0.5, 0, 0.3, 1, M_GLOSS, 230); world(x + 0.5, y + 0.5);
      const dx = WX - cxm, h = WH - (QH1 - 6);
      const arch = 6 + Math.sqrt(Math.max(0, 100 - dx * dx)) * 0.38 - (Math.abs(dx) < 2.6 ? 0 : 0);
      if (h < 0 || h > arch) continue;
      if (Math.abs(dx) < 2.2 && h > 6) continue; // broken pediment
      put(x, y, h > arch - 1.3 ? 13 : h < 1.4 ? 14 : 11);
    }
    penZ(QZ1 + 1, 0, 0.3, 1, M_BRASS);
    { const x = ix(cxm), y = iy(QH1 + 4); put(x, y, 21); put(x, y - 1, 22); put(x - 1, y, 20); put(x + 1, y, 20); put(x, y + 1, 20); put(x, y + 2, 21); }
    penZ(QZ1, 0, -0.2, 1, M_GLOSS, 220);
    for (let k = 0; k < 7; k++) { const w = [3, 4, 3, 2, 3, 2, 1][k]; hl(ix(cxm) - w, ix(cxm) + w - 1, iy(QH0 + 4) + k, k === 0 ? 14 : k % 2 ? 11 : 12); }
    BS.zt = false;
  }

  /* --- ambient occlusion tweaks: under the table, behind the clock, room corners --- */
  function buildAO() {
    for (let y = 0; y < AH; y++) for (let x = 0; x < AW; x++) {
      const i = y * AW + x;
      let a = BS.ao[i] / 255;
      const H = BS.H[i], Z = BS.Z[i], X = BS.X[i];
      // under the table top
      if (H < TTH && X > TX0 - 3 && X < TX1 + 3 && Z < TZ1 + 3 && BS.m[i] !== M_GLOSS) a *= 0.55;
      if (H < TTH && X > TX0 - 3 && X < TX1 + 3 && Z < TZ1 + 3 && y > 200) a *= 0.6;
      // corners of the room
      if (y < 4) a *= 0.6;
      if (H < 2 && Z < 3) a *= 0.7;
      BS.ao[i] = clamp(Math.round(a * 255), 0, 255);
    }
  }

  /* ================================================================ moon: haze map */
  const HAZE = new Float32Array(NP);
  function moonPass(X, H, Z, sway) {
    // trace back along the moonbeam to the glass plane; 1 if it came through a pane
    const t = (Z - WZ0) / MDZ;
    const Xw = X - MDX * t, Hw = H - MDY * t;
    if (Xw < WX0 + 2.2 || Xw > WX1 - 2.2 || Hw < WH0 + 3 || Hw > WH1 - 2.4) return 0;
    if (Math.abs(Hw - 104) < 1.6 || Math.abs(Xw - 22) < 0.8) return 0;
    // curtains hang 4" in front of the wall
    const t4 = (Z - 4) / MDZ;
    if (t4 > 0) {
      const X4 = X - MDX * t4, H4 = H - MDY * t4, y4 = FL - H4;
      if (y4 > CUR_TOP && y4 < CUR_BOT) { if (X4 < curtainEdge(-1, y4, 0)) return 0; if (X4 > curtainEdge(1, y4, sway)) return 0; }
    }
    return 1;
  }
  function buildHaze() {
    // dusty air: how much of each camera ray runs through the moonbeam
    for (let y = 0; y < AH; y++) for (let x = 0; x < AW; x++) {
      const i = y * AW + x;
      const Zs = BS.Z[i];
      let acc = 0; const N = 24;
      for (let k = 0; k < N; k++) {
        const Z = (k + 0.5) / N * Math.max(Zs, 0) + 0.5;
        const tt = (DC - Z) / DC;
        const X = XC + tt * (x + 0.5 - XC), H = EC + tt * (YH - y - 0.5);
        if (H < 0) break;
        acc += moonPass(X, H, Z, 0.5);
      }
      HAZE[i] = acc / N * Math.min(1, Zs / 60);
    }
  }

  /* ================================================================ the painting */
  const PW = CW, PH = CH; // 102 x 96
  const PT = mkP(PW, PH);
  const PSTATES = [];
  // stroke field & cracks shared by every state (they belong to the canvas)
  const STROKE = new Int8Array(PW * PH), BUMP = new Float32Array(PW * PH), CRACK = new Uint8Array(PW * PH);
  function buildCanvasSurface() {
    const R = mulberry32(4242);
    // brushstrokes: loaded dabs laid along the form, lifting or sinking the tone a step and raising impasto
    for (let k = 0; k < 1500; k++) {
      const x = R() * PW, y = R() * PH;
      let a = R() < 0.5 ? 0.5 : -0.8;
      if (x > 84) a = 1.45 + (R() - 0.5) * 0.3;          // drapery: falls
      else if (y < 16 && x > 56) a = 0.25 + (R() - 0.5) * 0.3; // swag
      else if (y > 80) a = 0.05 + (R() - 0.5) * 0.2;     // floor
      else if (x < 9) a = 1.57;                           // pilaster
      else if (y > 30 && x > 8 && x < 40) a = 1.45 + (R() - 0.5) * 0.5; // coat: long vertical strokes
      else if (y > 56 && x > 30 && x < 80) a = 1.2 + (x - 55) * 0.02; // skirt
      const len = 3 + R() * 6, sgn = R() < 0.55 ? 1 : -1;
      for (let s2 = 0; s2 < len; s2 += 0.5) {
        const px = fl(x + Math.cos(a) * s2), py = fl(y + Math.sin(a) * s2);
        if (px < 0 || py < 0 || px >= PW || py >= PH) continue;
        const i = py * PW + px;
        if (s2 > 0.5 && s2 < len - 0.5 && R() < 0.8) STROKE[i] = sgn;
        BUMP[i] += 0.5 * Math.sin(s2 / len * Math.PI) + 0.1;
      }
    }
    // craquelure: an irregular cell network, a little cupped
    const pts = [];
    for (let k = 0; k < 170; k++) pts.push([R() * PW, R() * PH]);
    for (let y = 0; y < PH; y++) for (let x = 0; x < PW; x++) {
      let d1 = 1e9, d2 = 1e9;
      for (const p of pts) { const d = (p[0] - x) ** 2 + ((p[1] - y) * 0.75) ** 2; if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d; }
      const e = Math.sqrt(d2) - Math.sqrt(d1);
      if (e < 0.5 && hs(x, y, 77) < 0.7) { CRACK[y * PW + x] = 1; BUMP[y * PW + x] -= 0.7; }
      else if (e < 1.3) BUMP[y * PW + x] += 0.15;
    }
  }
  // --- the sitters: hand-placed heads (letters -> palette), bodies built from shapes
  // eyes are written as 1 2 3 (three-pixel eyes) or 4 5 (two-pixel eyes) and set by gaze
  const FACEMAP = {
    K: 0, H: 9, h: 10, j: 11, J: 12, S: 26, s: 27, t: 14, u: 13, v: 12, e: 9, w: 26, m: 17, M: 16, n: 13, r: 11, R: 12, q: 10,
    c: 26, C: 7, k: 1, x: 3, g: 21, l: 22, b: 2, B: 3, d: 15, p: 17, o: 4, W: 8,
  };
  // father, turned to face us
  const FA_FR = [
    '....hhhhh....',
    '..hhjjjhhhh..',
    '.hhjJjjhhhhh.',
    '.hjjhhhhhhhhh',
    '.hhSSSSSsshhh',
    'hhSSSSSSsstqh',
    'HqSSSSSSsstqH',
    'HqSHHSSsHHtqH',
    'HqS45SSs67uqH',
    'HqSSSSSsssuqH',
    'HqrSSSSnsttqH',
    'HqrSSnSnstuqH',
    '.qrrRqqqqrrq.',
    '.qrrSMMMMsrq.',
    '.HqrsSSsttqH.',
    '..HqrsstuqH..',
    '...HqqqqqH...',
    '...kccccCk...',
    '..kkcxgxCkk..',
  ];
  // father, three-quarter, looking off to our right
  const FA_34 = [
    '....hhhhh....',
    '..hhjjjhhhh..',
    '.hhjJjjhhhhh.',
    '.hjjhhhhhhhh.',
    '.hhhSSSSSshh.',
    'hhhSSSSSSssh.',
    'HqhSSSSSSsst.',
    'HqqSSHHSSsHH.',
    'HqqSS45SSs67.',
    'HqqSSSSSSSsS.',
    'HqqrSSSSSsnS.',
    'HqqrSSSSssnu.',
    '.HqrrRqqqqq..',
    '.HqqrSMMMs...',
    '..HqqrSsst...',
    '..HHqqrstu...',
    '...HHqqqq....',
    '...kccccCk...',
    '..kkcxgxCkk..',
  ];
  // mother, three-quarter to our left; centre parting, hair smoothed over the ears, chignon behind
  const MO_34 = [
    '....hhhhh.....',
    '..hhjJjhhhh...',
    '.hjJjjShhhhh..',
    '.hjjSSShhhhhH.',
    '.hSSSSSShhhhHH',
    '.SSSSSSsshhHHh',
    '.HHSSHHssthHHh',
    '.45SS67sstuhh.',
    '.SSSSSssstuhh.',
    'nSSSSssstuuh..',
    '.SSSSsssttuh..',
    '..SmMMsstuv...',
    '..SSSssttuv...',
    '...SSsstuv....',
    '....Sstuv.....',
    '...ccccccC....',
    '..cclcclccC...',
  ];
  // boy, three-quarter to our left
  const BO_34 = [
    '...hhhhh...',
    '.hhjJJjhh..',
    'hjJJjjhhhh.',
    'hjjSSShhhhh',
    'hjSSSSSsthh',
    '.SSSSSSssth',
    '.HHSHHssstu',
    '.45S67sstu.',
    '.SSSSSssttu',
    'nSSSSssstu.',
    '.SSmMsssu..',
    '..SSSsstu..',
    '...SSstu...',
  ];
  // a seated King Charles spaniel: W white, w cream shade, t tan, r chestnut, R light chestnut, q dark chestnut, e eye, K nose
  const DOG_BODY = [
    '....qrRRrrWWWw..',
    '....qrRRrqWWWWw.',
    '...qrrRrq.WWWWw.',
    '...qrrrq.WWWWWw.',
    '..qrrRrWWWWWtWw.',
    '.qrrRRrWWWWWtWw.',
    '.qrRRrrWWWWWtWw.',
    'qrrRrrqWWwW.tWw.',
    '.qrrrqWWwWW.tWw.',
    '..qq.wWWWw..wWW.',
  ];
  const DOG_PRO = [ // head in profile, looking off to our right
    '........qrrrq...',
    '.......qrRRRrq..',
    '......qrRWWWWRq.',
    '......qrWWWWWWW.',
    '.....qrrWeWWWWWw',
    '.....qrrWWWWWWKK',
    '.....qrRrWWWWww.',
    '.....qrRrrWWw...',
  ];
  const DOG_FR = [ // head turned to us; eyes 4 5
    '.......qrrrq....',
    '......qrRRRrq...',
    '.....qrRWWWRrq..',
    '.....qrW4W5Wrq..',
    '.....qrWWWWWrq..',
    '.....qrWWKWWrq..',
    '.....qrrWWWrrq..',
    '.....qrRrWrRrq..',
  ];
  // gaze: 0 at us, -1 to our left, 1 to our right, 2 down and to our left
  const GLINT = Object.assign({}, FACEMAP, { w: 8 });
  function setEyes(rows, gaze, kind) {
    // two-pixel eyes '45' (our left) and '67' (our right); three-pixel '123' / '789' on the big face
    let a, b, c3, d3;
    if (kind === 'front') { a = gaze === 0 ? 'we' : gaze === 1 ? 'we' : 'ew'; b = gaze === 0 ? 'ew' : gaze === 1 ? 'we' : 'ew'; }
    else if (kind === 'side') { a = gaze === 1 ? 'we' : 'ew'; b = gaze === 1 ? 'we' : 'ew'; }
    else { a = gaze === 0 || gaze === 1 ? 'we' : 'ew'; b = gaze === 0 || gaze === 1 ? 'we' : 'ew'; }
    c3 = gaze === 0 ? 'wew' : gaze === 1 ? 'wwe' : 'eww'; d3 = c3;
    return rows.map((r) => r.replace(/45/g, a).replace(/67/g, b).replace(/123/g, c3).replace(/789/g, d3));
  }
  let FACEON = false;
  function fput(rows, map, x, y) { FACEON = true; spr(rows, map, x, y); FACEON = false; }
  function drawBackground() {
    TG = PT; PEN.b = 0;
    for (let y = 0; y < PH; y++) for (let x = 0; x < PW; x++) {
      const b = bay(x, y);
      // warm umber glow behind the sitters' heads, falling off into the dark
      const g = Math.hypot((x - 30) / 1.3, (y - 22) * 1.1);
      let c = 10;
      if (g < 40) c = b < (40 - g) / 24 ? 11 : 10;
      if (g < 18) c = b < (18 - g) / 10 ? 12 : 11;
      if (g > 62 && b < (g - 62) / 30) c = 9;
      put(x, y, c);
    }
    // stone pilaster at the left, with a plinth
    for (let y = 0; y < 82; y++) for (let x = 0; x < 9; x++) {
      let c = x === 0 ? 9 : x === 8 ? 9 : (x === 3 || x === 6) ? 10 : 11;
      if (x === 2 || x === 5) c = 12;
      if (y > 72) c = y === 73 ? 13 : y === 74 ? 12 : y > 79 ? 10 : 11;
      if (y < 4) c = y === 3 ? 12 : 11;
      put(x, y, c);
    }
    // red drapery swag and fall at the right
    for (let y = 0; y < 80; y++) for (let x = 56; x < PW; x++) {
      const swag = 7 + Math.sin((x - 56) / 46 * Math.PI) * 9 - (x - 56) * 0.04;
      const fall = x > 86 - Math.max(0, (y - 18)) * 0.1;
      if (!(y < swag || fall)) continue;
      const f = fall && y >= swag ? Math.sin((x - 86) * 0.85 + y * 0.05) : Math.sin((y - (x - 56) * 0.3) * 0.75);
      let c = f > 0.6 ? 18 : f > -0.05 ? 17 : f > -0.65 ? 16 : 15;
      if (fall && y > 62 && bay(x, y) < (y - 62) / 16) c = DARK[c];
      put(x, y, c);
    }
    // gold rope and tassel on the drapery
    for (let x = 58; x < 99; x++) { const y = Math.round(11 + Math.sin((x - 56) / 46 * Math.PI) * 7.5); put(x, y, (x & 1) ? 21 : 20); if ((x & 3) === 0) put(x, y + 1, 19); }
    put(98, 15, 21); put(98, 16, 22); put(97, 17, 21); put(98, 17, 21); put(99, 17, 20);
    for (let y = 18; y < 24; y++) { put(97, y, 20); put(98, y, (y & 1) ? 21 : 20); put(99, y, 19); }
    // patterned carpet floor
    for (let y = 80; y < PH; y++) for (let x = 0; x < PW; x++) {
      let c = 15;
      if (((x + y * 2) % 7 === 0) && y > 82) c = 16;
      if (((x * 3 + y) % 11 === 0) && y > 84) c = 19;
      if (y === 80) c = 9;
      if (y > 92 && bay(x, y) < 0.5) c = 9;
      put(x, y, c);
    }
  }
  function drawChair(empty) {
    TG = PT;
    // high carved back: dark wood frame, red velvet panel, carved crest
    const cx = 55;
    poly([[cx - 14, 23], [cx + 14, 23], [cx + 13, 62], [cx - 13, 62]], 9);
    poly([[cx - 11, 26], [cx + 11, 26], [cx + 10, 59], [cx - 10, 59]], 17, (x, y) => (((x * 2 + y) % 6 === 0) ? 18 : (x > cx + 5 ? 16 : (x < cx - 7 ? 18 : 17))));
    // button tufting
    for (let j = 0; j < 4; j++) for (let i = -1; i <= 1; i++) put(cx + i * 6 + (j & 1) * 3 - 1, 30 + j * 7, 15);
    // crest: carved scrolls and a cresting knop
    ell(cx, 22, 10, 3.4, 11, (x, y, u, v) => (v < -0.3 ? 13 : v > 0.4 ? 10 : 12));
    ell(cx - 13, 23, 3, 3, 12, (x, y, u, v) => (u + v < 0 ? 13 : 11)); ell(cx + 13, 23, 3, 3, 11, (x, y, u, v) => (u + v < 0 ? 12 : 10));
    put(cx, 18, 21); put(cx, 17, 22); put(cx - 1, 19, 20); put(cx + 1, 19, 20); put(cx - 13, 23, 10); put(cx + 13, 23, 9);
    for (let y = 25; y < 62; y++) { put(cx - 14 + Math.round((y - 22) / 40), y, 12); put(cx + 14 - Math.round((y - 22) / 40), y, 10); }
    // arms and seat
    rect(cx - 19, 57, 7, 3, 11); hl(cx - 19, cx - 13, 57, 13); rect(cx + 12, 57, 7, 3, 10); hl(cx + 12, cx + 18, 57, 12);
    ell(cx - 19, 58.5, 1.7, 1.7, 13, (x, y, u) => (u > 0 ? 11 : 13)); ell(cx + 18, 58.5, 1.7, 1.7, 11);
    vl(cx - 18, 60, 79, 11); vl(cx - 17, 60, 79, 10); vl(cx + 17, 60, 79, 9);
    if (empty) {
      // the seat, its cushion still pressed
      poly([[cx - 16, 61], [cx + 16, 61], [cx + 18, 70], [cx - 18, 70]], 17, (x, y) => (y < 63 ? 18 : y > 68 ? 15 : (Math.abs(x - cx) < 7 && y > 63 && y < 67) ? 16 : 17));
      hl(cx - 18, cx + 17, 70, 12); rect(cx - 18, 71, 36, 3, 10); hl(cx - 18, cx + 17, 71, 11);
      for (const lx of [cx - 16, cx + 14]) { rect(lx, 74, 2, 7, 10); put(lx, 74, 12); put(lx, 80, 9); }
      for (let x = cx - 15; x < cx + 14; x++) put(x, 74, 9);
    }
  }
  function drawFather(S) {
    TG = PT;
    // trousers
    rect(13, 83, 7, 13, 3); rect(21, 83, 7, 13, 2); vl(19, 84, 95, 1); vl(13, 84, 95, 4); vl(21, 84, 95, 1);
    put(13, 95, 0); put(26, 95, 0);
    // frock coat: black broadcloth, a dull sheen down the lit side
    poly([[11, 30], [35, 30], [37, 46], [36, 86], [31, 90], [22, 84], [11, 90], [8, 70], [9, 46]], 1, (x, y) => {
      if (x < 11 && y > 34) return 3;
      if (x < 13) return 2;
      if (x > 33) return 0;
      if (y > 58 && Math.abs(x - 22) < 1) return 0;
      if ((x === 15 || x === 16) && y > 50 && y < 84) return 2;
      return 1;
    });
    // lapels (silk-faced), waistcoat, shirt front, cravat
    poly([[16, 29], [22, 29], [21, 47], [18, 40]], 3, (x) => (x < 18 ? 4 : 3));
    poly([[22, 29], [28, 29], [26, 40], [23, 47]], 2);
    poly([[19, 30], [25, 30], [23.5, 41], [22, 43], [20.5, 41]], 26, (x, y) => (x > 23 ? 7 : y > 38 ? 27 : 26));
    put(22, 33, 0); put(22, 36, 0); put(22, 39, 2);
    // waistcoat and watch chain
    rect(19, 42, 7, 8, 2); put(22, 43, 4); put(22, 46, 4); put(22, 49, 4);
    for (let k = 0; k < 7; k++) put(19 + k, 47 + (k > 1 && k < 5 ? 1 : 0), k === 3 ? 22 : 21);
    put(26, 47, 22); put(27, 47, 21);
    // near arm hangs, the hand holding a pair of kid gloves
    poly([[8, 44], [13, 44], [14, 63], [9, 64]], 1, (x) => (x < 10 ? 3 : x < 11 ? 2 : 1));
    rect(8, 63, 6, 2, 26); hl(8, 13, 63, 7);
    ell(11, 66.5, 2.4, 2.4, 26, (x, y, u, v) => (u > 0.4 ? 14 : v > 0.5 ? 27 : 26));
    rect(9, 68, 3, 5, 14); put(9, 72, 13); put(11, 72, 12); put(10, 69, 22);
    // far arm reaches across to her shoulder (or to where it was)
    poly([[33, 32], [37, 31], [45, 39], [43, 43], [35, 37]], 1, (x, y) => (y < 34 ? 2 : 1));
    rect(42, 40, 3, 2, 26);
    ell(45, 42.5, 2.6, 1.9, 26, (x, y, u, v) => (v > 0.4 ? 14 : u > 0.5 ? 27 : 26)); put(47, 43, 27); put(43, 44, 14); put(46, 44, 14);
    // head
    const head = S >= 1 ? setEyes(FA_FR, S === 5 ? 1 : 0, 'front') : setEyes(FA_34, 1, 'side');
    fput(head, S >= 2 ? GLINT : FACEMAP, 16, 12);
  }
  function drawMother(S) {
    TG = PT;
    if (S === 5) return;
    if (S === 4) { drawMotherForward(); return; }
    // skirt: black silk, sheen in the folds, spread over the seat and down to the floor
    poly([[40, 57], [70, 57], [78, 95], [32, 95]], 1, (x, y) => {
      const f = Math.sin((x - 55) * 0.6 + (y - 57) * 0.09 * (x < 55 ? -1 : 1));
      if (f > 0.85) return 4; if (f > 0.55) return 3; if (f < -0.6) return 0;
      return x < 43 ? 2 : 1;
    });
    hl(34, 77, 95, 0);
    // bodice, jet buttons
    poly([[47, 39], [63, 39], [64, 48], [62, 58], [48, 58], [46, 48]], 1, (x, y) => (x < 49 ? 3 : x > 61 ? 0 : (x === 55 && y % 3 === 1) ? 4 : (x === 50 ? 2 : 1)));
    // sleeves: fitted, with lace cuffs
    poly([[43, 41], [48, 40], [52, 60], [47, 62]], 2, (x) => (x < 46 ? 3 : 2)); poly([[62, 40], [67, 42], [63, 62], [58, 60]], 1);
    // high lace collar & cameo
    rect(52, 37, 7, 3, 26); hl(52, 58, 39, 7); put(58, 37, 7); put(52, 38, 8);
    put(55, 40, 21); put(54, 41, 21); put(55, 41, 26); put(56, 41, 21); put(55, 42, 21);
    // hands
    if (S === 3) {
      // gripping the arms of the chair: knuckles white
      poly([[43, 52], [47, 52], [39, 58], [37, 56]], 2); poly([[62, 52], [66, 52], [73, 56], [70, 58]], 1);
      rect(35, 56, 4, 2, 26); put(35, 58, 27); put(36, 58, 26); put(37, 58, 27); put(38, 57, 14); hl(35, 38, 55, 7);
      rect(71, 56, 4, 2, 27); put(71, 58, 14); put(72, 58, 27); put(73, 58, 14); put(74, 57, 13); hl(71, 74, 55, 7);
    } else {
      // folded in her lap over a black fan
      hl(48, 51, 61, 26); hl(58, 61, 61, 7);
      ell(53, 63, 3.2, 2.2, 26, (x, y, u, v) => (u > 0.3 ? 27 : v > 0.4 ? 14 : 26));
      ell(57.5, 63.5, 3, 2, 27, (x, y, u, v) => (u > 0.3 ? 14 : 27));
      put(51, 62, 26); put(55, 62, 26); put(59, 64, 13); put(54, 65, 14); put(56, 65, 13);
    }
    // head
    const head = S >= 2 ? setEyes(MO_34, 0, 'turnL') : setEyes(MO_34, -1, 'turnL');
    fput(head, S >= 2 ? GLINT : FACEMAP, 48, 22);
  }
  // mother, risen and stepped toward the picture plane
  const MO_BIG = [
    '......hhhhh......',
    '....hhjJjhhhh....',
    '...hjJJjjhhhhh...',
    '..hjjJjhShhhhhh..',
    '.hjjhhSSSShhhhhh.',
    '.hjhSSSSSSSsshhh.',
    'hhhSSSSSSSSsssthh',
    'hhSSSSSSSSSsssthh',
    'hhSSHHHHSSsHHHtuh',
    'hhSSt123SS789tuh.',
    '.hSSSSSSSSssssuh.',
    '.hSSSSSSSssssttu.',
    '..SSSSSSnnssttuu.',
    '..SSSSSnSnsstuuv.',
    '..SSSSSSSssstuv..',
    '..SSSmMMMMmstuv..',
    '...SSSSSsssttv...',
    '....SSSSssttv....',
    '.....SSssttv.....',
    '....cccccccC.....',
    '...cccclccccC....',
  ];
  function drawMotherForward() {
    TG = PT;
    // she has risen and come forward: larger, lower, nearer the glass
    const silk = (x, y, edgeL, edgeR) => {
      if (x < edgeL + 2) return 3;                         // light from the painting's window, upper left
      if (x > edgeR - 2) return 0;
      if (((x * 5 + y * 2) % 23 === 0) || ((x === edgeL + 4 || x === edgeL + 5) && y % 4 !== 0)) return 2; // dull sheen streaks
      return 1;
    };
    // skirt below the waist, then bodice with a fitted waist
    poly([[44, 86], [64, 86], [74, 96], [34, 96]], 1, (x, y) => silk(x, y, 34 + (96 - y) * 0.9, 74 - (96 - y) * 0.9));
    poly([[41, 53], [67, 53], [65, 70], [63, 87], [45, 87], [43, 70]], 1, (x, y) => (x === 54 && y % 3 === 1 ? 4 : silk(x, y, 42, 66)));
    // sloped shoulders into puffed sleeves
    poly([[36, 55], [44, 51], [46, 58], [38, 64]], 2); poly([[72, 55], [64, 51], [62, 58], [70, 64]], 1);
    ell(34, 64, 5.5, 9, 2, (x, y, u, v) => (u < -0.45 ? 4 : u < -0.1 ? 3 : v > 0.6 ? 1 : 2));
    ell(74, 64, 5.2, 9, 1, (x, y, u) => (u > 0.4 ? 0 : 1));
    // forearms come in to the hands clasped at her waist
    poly([[30, 70], [36, 69], [50, 84], [46, 87]], 2, (x, y) => (y < 74 && x < 33 ? 3 : 2));
    poly([[78, 70], [72, 69], [60, 84], [63, 87]], 1);
    hl(44, 49, 84, 26); hl(61, 66, 85, 7); // lace cuffs
    ell(51.5, 87, 4, 2.8, 27, (x, y, u, v) => (u < -0.4 && v < 0.2 ? 26 : u > 0.45 ? 14 : v > 0.5 ? 13 : 27));
    ell(57.5, 87.5, 3.8, 2.6, 27, (x, y, u, v) => (u > 0.3 ? 14 : v > 0.5 ? 13 : 27));
    put(49, 86, 26); put(55, 86, 26); put(54, 88, 13); put(60, 88, 12);
    // high lace collar, a lace jabot, the cameo
    rect(48, 46, 13, 7, 26); hl(48, 60, 52, 7); vl(60, 47, 52, 7); put(48, 47, 8); put(49, 47, 8);
    for (let k = 0; k < 4; k++) { put(53 + (k & 1), 53 + k, 26); put(55 - (k & 1), 53 + k, 7); }
    put(54, 57, 21); put(53, 58, 21); put(54, 58, 26); put(55, 58, 21); put(54, 59, 21);
    fput(setEyes(MO_BIG, 0, 'front'), GLINT, 46, 26);
  }
  function drawBoy(S) {
    TG = PT;
    // boots, stockings, knee breeches
    rect(76, 90, 4, 6, 0); rect(81, 90, 4, 6, 0); put(76, 90, 3); put(81, 90, 3); put(79, 95, 9);
    rect(76, 82, 3, 8, 26); rect(82, 82, 3, 8, 27); vl(78, 82, 89, 27); vl(84, 82, 89, 14);
    rect(75, 74, 11, 8, 26); vl(80, 76, 81, 7); hl(75, 85, 81, 27); vl(85, 74, 81, 7); vl(75, 74, 81, 8);
    // blouse
    poly([[74, 58], [86, 58], [88, 74], [73, 74]], 26, (x) => (x > 85 ? 7 : x < 75 ? 27 : 26));
    hl(74, 87, 73, 7);
    // big sailor collar (navy, two white stripes) and the knotted kerchief
    poly([[73, 56], [87, 56], [88, 63], [80, 65], [72, 63]], 3, (x, y) => ((y === 61 || (y === 59 && (x < 76 || x > 84))) ? 26 : x > 84 ? 2 : 3));
    poly([[78, 58], [82, 58], [80, 64]], 26, (x) => (x > 80 ? 7 : 26));
    put(80, 63, 2); put(79, 64, 2); put(81, 64, 2); put(80, 65, 3); put(79, 66, 3); put(81, 66, 2); put(80, 67, 2);
    // arms: near arm hangs to the dog's head, far arm at his side
    poly([[72, 58], [75, 58], [74, 71], [71, 70]], 26, (x) => (x < 73 ? 27 : 26));
    hl(71, 74, 71, 3);
    ell(72.5, 73, 1.8, 1.8, 26, (x, y, u) => (u > 0.3 ? 14 : 26));
    poly([[86, 59], [89, 60], [89, 71], [87, 71]], 7);
    hl(87, 89, 71, 3); put(88, 72, 27); put(87, 72, 14);
    const head = S >= 2 ? setEyes(BO_34, S === 5 ? 1 : 0, 'turnL') : setEyes(BO_34, -1, 'turnL');
    fput(head, S >= 2 ? GLINT : FACEMAP, 75, 45);
  }
  function drawDog(S) {
    TG = PT;
    const map = { q: 11, r: 12, R: 13, W: 26, w: 27, t: 14, e: 0, K: 0, '4': 0, '5': 0 };
    const fr = S >= 2 && S < 5;
    let head = fr ? DOG_FR : DOG_PRO;
    if (fr) head = head.map((r) => r.replace('4W5', S === 5 ? 'eWW' : 'eWe').replace('W4', 'W'));
    if (fr && S === 5) head = head.map((r, j) => (j === 3 ? '.....qreWeWWrq..' : r));
    const ox = 60, oy = 78;
    FACEON = true; spr(head, map, ox, oy); FACEON = false;
    spr(DOG_BODY, map, ox, oy + 8);
    // plumed tail on the carpet behind
    put(ox - 1, oy + 15, 12); put(ox - 2, oy + 16, 13); put(ox - 3, oy + 16, 12); put(ox - 2, oy + 17, 11);
    if (fr && S >= 2) { put(ox + 8, oy + 3, S === 5 ? 26 : 26); }
  }
  function paintState(S) {
    PT.c.fill(0); PT.b.fill(0);
    drawBackground();
    drawChair(S >= 4);
    drawFather(S);
    drawMother(S);
    drawBoy(S);
    drawDog(S);
    // canvas surface: brushwork shifts tone a step (never on faces), cracks darken, all of it raises a bump map
    const c = new Uint8Array(PW * PH), nx = new Float32Array(PW * PH), ny = new Float32Array(PW * PH), nz = new Float32Array(PW * PH);
    const UP = { 9: 10, 10: 11, 11: 12, 12: 13, 13: 14, 15: 16, 16: 17, 17: 18, 1: 2, 2: 3, 3: 4, 19: 20, 20: 21 };
    const DN = { 10: 9, 11: 10, 12: 11, 13: 12, 14: 13, 16: 15, 17: 16, 18: 17, 2: 1, 3: 2, 4: 3, 20: 19, 21: 20 };
    for (let i = 0; i < PW * PH; i++) {
      let col = PT.c[i] - 1;
      if (col < 0) col = 10;
      const face = PT.b[i];
      const st = STROKE[i];
      if (face < 1 && st && !(face > 0 && hs(i, 3, 91) < 0.8)) {
        if (st > 0 && UP[col] !== undefined) col = UP[col];
        else if (st < 0 && DN[col] !== undefined) col = DN[col];
      }
      if (CRACK[i] && (face < 1 || hs(i, 5, 92) < 0.25) && col !== 0 && col !== 9 && col !== 15) col = DN[col] !== undefined ? DN[col] : DARK[col];
      c[i] = col;
    }
    const bmp = (xx, yy) => { xx = clamp(xx, 0, PW - 1); yy = clamp(yy, 0, PH - 1); const i = yy * PW + xx; return BUMP[i] * (PT.b[i] >= 1 ? 0.3 : 1); };
    for (let y = 0; y < PH; y++) for (let x = 0; x < PW; x++) {
      const i = y * PW + x;
      const gx = bmp(x + 1, y) - bmp(x - 1, y), gy = bmp(x, y + 1) - bmp(x, y - 1);
      const l = Math.hypot(gx * 0.5, gy * 0.5, 1);
      nx[i] = -gx * 0.5 / l; ny[i] = gy * 0.5 / l; nz[i] = 1 / l;
    }
    return { c, nx, ny, nz };
  }
  function buildPainting() {
    buildCanvasSurface();
    for (let S = 0; S < 6; S++) PSTATES[S] = paintState(S);
    // canvas plane in the base buffer
    TG = BS;
    for (let y = CY0; y < CY0 + CH; y++) for (let x = CX0; x < CX0 + CW; x++) { penZ(CZ, 0, 0, 1, M_VARN); put(x, y, 10); }
  }
  function pastePainting(S) {
    const P = PSTATES[S];
    for (let v = 0; v < PH; v++) for (let u = 0; u < PW; u++) {
      const j = v * PW + u, i = (CY0 + v) * AW + CX0 + u;
      SC.c[i] = P.c[j] + 1; SC.nx[i] = P.nx[j]; SC.ny[i] = P.ny[j]; SC.nz[i] = P.nz[j];
    }
  }

  /* ================================================================ the one who isn't there (shadow masks) */
  let SHMASK = null; const SHMASKS = []; const HANDS = [];
  function buildShadowFigure() {
    // a woman in profile (world inches, feet at H = 0, plane Z = SZ), facing away from the candle (to +x);
    // three masks: head in profile facing away, head turning, head turned back over her shoulder
    const body = [
      [-1.5, 0], [10.5, 0], [8.5, 14], [6.8, 26], [5.8, 34], [4.6, 38.5], [5.3, 41.5], [6.2, 44.5], [6.3, 47.5], [4.8, 50.2], [3.4, 52], [2.1, 53.3],
      [-1.5, 53.3], [-3.8, 51], [-5.2, 47.5], [-5.4, 43], [-4.5, 39], [-5.0, 36], [-8.2, 34.4], [-9.0, 31.5], [-7.4, 29], [-6.0, 22], [-6.5, 10],
    ];
    const face = [[0.8, 64.9], [2.4, 63.8], [3.1, 62.3], [2.8, 61.3], [3.5, 60.4], [5.3, 58.9], [3.7, 58.5], [4.0, 57.9], [3.3, 57.5], [3.8, 56.9], [3.2, 56.2], [3.6, 55.4], [2.2, 54.5], [0.4, 54.9], [0.2, 58]];
    const headProfile = (x, h) => inEll(-0.6, 60.6, 4.1, 4.5, x, h) || inPoly(face, x, h) || inEll(-4.6, 58.9, 2.3, 2.1, x, h) || inEll(-1.0, 64.2, 3.6, 1.6, x, h);
    const heads = [
      headProfile,
      (x, h) => inEll(-0.6, 60.4, 3.9, 4.6, x, h) || inEll(-0.6, 64.0, 3.8, 1.7, x, h) || inEll(-3.9, 58.6, 1.4, 1.6, x, h) || inEll(2.7, 58.6, 1.4, 1.6, x, h), // turning: the bun shows on both sides of a round head
      (x, h) => headProfile(-1.2 - x, h), // looking back over her shoulder
    ];
    for (const head of heads) {
      const M = mkMask(SX - 16, 70, 32, 70);
      mFill(M, (X, H) => {
        const x = X - SX, h = H;
        return inPoly(body, x, h) || inEll(-0.4, 47.6, 3.0, 3.6, x, h) || (x > -2.2 && x < 2.3 && h > 52 && h < 57.2) || head(x, h);
      });
      SHMASKS.push(M);
    }
    SHMASK = SHMASKS[0];
    // hands (relative to the wrist; built pointing +x, tilted down toward the wick, mirrored to face the candle)
    const rot = (fn, a) => (x, h) => { const c = Math.cos(a), s2 = Math.sin(a); return fn(x * c - h * s2, x * s2 + h * c); };
    const handShapes = [
      // reaching: fingers long and a little spread
      (x, h) => inEll(1.6, 0, 2.3, 1.45, x, h) || segD(x, h, 3.0, 0.7, 6.8, 2.4) < 0.42 || segD(x, h, 3.3, 0.1, 7.7, 0.7) < 0.42 || segD(x, h, 3.2, -0.5, 7.4, -1.3) < 0.4 || segD(x, h, 2.7, -1.0, 6.0, -3.0) < 0.36 || segD(x, h, 1.2, 1.2, 3.0, 3.6) < 0.48 || segD(x, h, 3.0, 3.6, 4.0, 4.3) < 0.45,
      // closing
      (x, h) => inEll(1.6, 0, 2.2, 1.4, x, h) || segD(x, h, 3.0, 0.5, 6.4, 0.2) < 0.45 || segD(x, h, 3.1, -0.1, 6.3, -0.9) < 0.45 || segD(x, h, 2.8, -0.7, 5.4, -1.9) < 0.42 || segD(x, h, 2.4, -1.1, 4.4, -2.6) < 0.38 || segD(x, h, 1.5, 1.0, 4.6, 1.4) < 0.5,
      // pinching: thumb and finger meet, the rest curled
      (x, h) => inEll(1.6, 0, 2.2, 1.45, x, h) || segD(x, h, 3.0, 0.3, 5.6, -0.4) < 0.5 || segD(x, h, 1.6, 1.0, 5.4, -0.2) < 0.5 || segD(x, h, 2.9, -0.6, 4.2, -1.7) < 0.5 || segD(x, h, 2.4, -1.1, 3.3, -2.0) < 0.45,
    ];
    for (const fn of handShapes) { const f2 = rot(fn, -0.55); const M = mkMask(-9, 6, 11, 12); mFill(M, (X, H) => f2(-X, H)); HANDS.push(M); }
  }

  /* ================================================================ timeline */
  const DIPS = [
    { t0: 3.7, sw: 4.5, t1: 5.6, deep: 0.30, lean: 1 },
    { t0: 8.5, sw: 9.3, t1: 10.4, deep: 0.28, lean: 1 },
    { t0: 13.3, sw: 14.1, t1: 15.2, deep: 0.27, lean: -1 },
    { t0: 18.1, sw: 18.95, t1: 20.05, deep: 0.2, lean: 1 },
    { t0: 22.9, sw: 23.85, t1: 25.0, deep: 0.14, lean: 1 },
  ];
  const T_TURN = 26.75, T_RISE = 27.25, T_REACH = 28.1, T_PINCH = 28.95, T_OUT = 29.45, T_RESET = 30.25, T_LIGHT = 30.9, T_FULL = 31.92;
  const st10 = (t) => fl(t * 10 + 1e-6) / 10;
  function paintingState(t) {
    if (t >= T_RESET) return 0;
    let s = 0; for (const d of DIPS) if (t >= d.sw) s++;
    return s;
  }
  function dipAt(t) {
    for (const d of DIPS) {
      if (t >= d.t0 - 0.35 && t <= d.t1 + 0.2) {
        const down = io(clamp((t - d.t0) / 0.6, 0, 1));
        const up = io(clamp((t - (d.sw + 0.15)) / (d.t1 - d.sw - 0.15), 0, 1));
        const env = down * (1 - up);
        const pre = sstep(d.t0 - 0.35, d.t0 + 0.2, t) * (1 - sstep(d.sw, d.t1, t)); // the draft arrives before the dip
        return { env, deep: d.deep, lean: d.lean * pre, d };
      }
    }
    return { env: 0, deep: 1, lean: 0, d: null };
  }
  // all light & flame state at time t
  function flameAt(t) {
    const q = st10(t), fi = fl(t * 10 + 1e-6) % 320;
    const breathe = 1 + 0.045 * Math.sin(TAU * t * 3 / D) + 0.03 * Math.sin(TAU * t * 7 / D + 1.3);
    const flick = 0.965 + 0.05 * ih(fi, 3, 7);
    const dp = dipAt(t);
    let L = 1 - (1 - dp.deep) * dp.env;
    let size = 1 - 0.75 * dp.env, lean = dp.lean;
    let mode = 'burn';
    // the sting: a hand comes to the flame
    if (t >= T_REACH - 0.3 && t < T_PINCH) { lean = 0.6 * sstep(T_REACH - 0.3, T_PINCH, t); }
    if (t >= T_PINCH && t < T_OUT + 0.05) {
      const u = clamp((t - T_PINCH) / (T_OUT - T_PINCH), 0, 1);
      L = 1 - io(u) * 0.97; size = 1 - u * 0.85; mode = 'pinch'; lean = 0.4 * (1 - u);
    }
    if (t >= T_OUT + 0.05 && t < T_LIGHT) { L = 0; size = 0; mode = 'out'; }
    if (t >= T_LIGHT) {
      const u = clamp((t - T_LIGHT) / (T_FULL - T_LIGHT), 0, 1);
      L = io(u); size = 0.25 + 0.75 * io(clamp(u * 1.2, 0, 1)); mode = u < 0.18 ? 'catch' : 'burn';
    }
    const P = 2.25 * L * breathe * (mode === 'burn' ? flick : 1);
    const agit = t > 24.6 && t < T_PINCH ? 1.7 : 1;
    const sway = (0.45 * Math.sin(TAU * q * 4 / D) + 0.3 * Math.sin(TAU * q * 9 / D + 1) + 0.18 * (ih(fi, 5, 3) - 0.5)) * agit * (mode === 'burn' ? 1 : 0.3);
    return { q, fi, L, P, size, lean, mode, dp, sway };
  }

  /* ================================================================ flame sprites (10 fps) */
  const FMAP = { w: 23, y: 24, o: 25, g: 22, b: 5, B: 4, k: 9, r: 25, R: 17 };
  const FL_N = [
    ['..o..', '..o..', '.oyo.', '.yyy.', '.ywy.', 'oywyo', 'oywyo', '.ywy.', '.byb.'],
    ['.o...', '.oo..', '.yo..', '.yyo.', '.ywy.', 'oywyo', 'oywyo', '.ywy.', '.byb.'],
    ['...o.', '..oo.', '..oy.', '.oyy.', '.ywy.', 'oywyo', 'oywyo', '.ywy.', '.byb.'],
    ['..o..', '..y..', '.oyo.', '.ywy.', '.ywy.', 'oywyo', 'ywwwy', '.ywy.', '.byb.'],
    ['.....', '..o..', '.oyo.', '.ywy.', '.ywy.', 'oywyo', 'oywyo', '.ywy.', '.byb.'],
  ];
  const FL_R = [
    ['.....o', '....oy', '...oy.', '..yyy.', '.ywyo.', 'oywyo.', '.ywy..', '.byb..'],
    ['......oo', '.....oy.', '....oy..', '...yyo..', '..ywy...', '.ywyo...', 'oyy.....', '.by.....'],
  ];
  const FL_L = [
    ['o.....', 'yo....', '.yo...', '.yyy..', '.oywy.', '.oywyo', '..ywy.', '..byb.'],
  ];
  const FL_S = [
    ['..o..', '.oyo.', '.ywy.', '.ywy.', '.byb.'],
    ['...o.', '..oy.', '.oyy.', '.yw..', '.by..'],
    ['.o.', 'oyo', 'byb'],
  ];
  const FL_T = [['.b.', 'bgb'], ['.o.', 'byb']];
  const FL_P = [
    ['..o..', '..y..', '..y..', '..w..', '..w..', '.ywy.', '.byb.'],
    ['..o..', '..y..', '.yw..', '..b..'],
    ['..o.', '.y..'],
  ];
  function flameSprite(F) {
    if (F.mode === 'out') return null;
    if (F.mode === 'catch') return FL_T[F.fi & 1];
    if (F.mode === 'pinch') return FL_P[Math.min(2, fl((1 - F.size) / 0.85 * 3))];
    const s = F.size, ln = F.lean;
    if (s < 0.4) return FL_S[s < 0.3 ? 2 : 1];
    if (s < 0.7) return FL_S[Math.abs(ln) > 0.3 ? 1 : 0];
    if (ln > 0.6) return FL_R[1];
    if (ln > 0.25) return FL_R[0];
    if (ln < -0.25) return FL_L[0];
    if (F.sway > 0.35) return FL_N[2];
    if (F.sway < -0.35) return FL_N[1];
    return FL_N[[0, 3, 4][fl(ih(F.fi, 9, 4) * 3)]];
  }

  /* ================================================================ frame */
  let LIT = { x: 0, h: 0, z: 0, P: 0 };
  let ARM = null, HANDM = null, HAND = { x: 0, h: 0, z: 0 };
  function drawFrame(t, g, k) {
    t = ((t % D) + D) % D;
    const F = flameAt(t);
    const S = paintingState(t);
    SC.c.set(BS.c); SC.m.set(BS.m); SC.ao.set(BS.ao); SC.nx.set(BS.nx); SC.ny.set(BS.ny); SC.nz.set(BS.nz); SC.X.set(BS.X); SC.H.set(BS.H); SC.Z.set(BS.Z);
    TG = SC; SC.zt = false;
    pastePainting(S);
    // the curtain breathes; drafts push it
    const q = F.q;
    const sway = 0.5 + 0.5 * Math.sin(TAU * q * 2 / D) + 1.6 * (F.dp.env > 0 || F.dp.lean ? Math.abs(F.dp.lean) : 0) + (t > T_RISE && t < T_OUT ? 0.8 * sstep(T_RISE, T_REACH, t) : 0);
    TG = SC; drawCurtain(1, sway);
    const cEdge = sway;
    // pendulum (seconds pendulum: 2 s period, 16 swings per loop)
    {
      const ang = Math.sin(TAU * q / 2) * 0.07;
      const L = CLK.y1 - CLK.py - 5, ox = CLK.px, oy = CLK.py;
      TG = SC; SC.x0 = CLK.x0; SC.x1 = CLK.x1; SC.y0 = CLK.y0; SC.y1 = CLK.y1;
      penZ(QZ0 + 3, 0, 0, 1, M_BRASS);
      for (let k = 0; k < L; k++) { put(ox + Math.sin(ang) * k, oy + Math.cos(ang) * k, k % 7 === 3 ? 21 : 20); }
      const bx = ox + Math.sin(ang) * L, by = oy + Math.cos(ang) * L;
      for (let y = fl(by) - 4; y <= fl(by) + 4; y++) for (let x = fl(bx) - 4; x <= fl(bx) + 4; x++) {
        const u = (x + 0.5 - bx) / 3.4, v = (y + 0.5 - by) / 3.4;
        if (u * u + v * v > 1) continue;
        put(x, y, u + v < -0.6 ? 22 : u + v > 0.8 ? 19 : (u * u + v * v < 0.25 ? 22 : 21), u * 0.9, -v * 0.9, Math.sqrt(Math.max(0.05, 1 - u * u - v * v)));
      }
      SC.x0 = 0; SC.y0 = 0; SC.x1 = AW; SC.y1 = AH;
    }
    // the light: flame centre follows the sprite's lean
    const wick = proj(KX, KTOP, KZ + 1);
    LIT.x = KX + F.lean * 1.6 + F.sway; LIT.z = KZ + 1; LIT.h = KTOP + 1.4 + 2.6 * Math.max(0.2, F.size); LIT.P = F.P;
    // the figure that left the painting, beside the table
    ARM = null; HANDM = null;
    const shadowOn = S === 5;
    SHMASK = SHMASKS[t < T_TURN ? 0 : t < T_TURN + 0.2 ? 1 : 2];
    if (shadowOn && t >= T_RISE && t < T_OUT + 0.1) {
      // arm rises in her plane, then the hand comes forward to the flame
      const qq = st10(t);
      const u1 = io(clamp((qq - T_RISE) / (T_REACH - T_RISE), 0, 1));
      const u2 = io(clamp((qq - T_REACH) / (T_PINCH - T_REACH), 0, 1));
      const sh = [SX - 1.2, 49.5, SZ];
      const el = [SX - lerp(3.0, 9.5, u1), lerp(37, 48.5, u1), SZ + 0.8 * u1];
      const wr0 = [SX - lerp(5.0, 15.5, u1), lerp(32.5, 52, u1), SZ + 1.6 * u1];
      const wr1 = [KX + 6, KTOP + 12, KZ + 1 - 3.2];
      const u3 = io(clamp((qq - T_PINCH) / (T_OUT - T_PINCH), 0, 1));
      const wr = [lerp(wr0[0], wr1[0], u2) - 1.5 * u3, lerp(wr0[1], wr1[1], u2) - 3.2 * u3, lerp(wr0[2], wr1[2], u2) + 0.3 * u3];
      el[0] = lerp(el[0], SX - 12, u2); el[1] = lerp(el[1], 61, u2); el[2] = lerp(el[2], SZ + 1.2, u2);
      ARM = [sh, el, wr];
      HAND.x = wr[0]; HAND.h = wr[1]; HAND.z = wr[2];
      ARMB.x = (sh[0] + el[0] + wr[0]) / 3 - 3; ARMB.h = (sh[1] + el[1] + wr[1]) / 3; ARMB.z = (sh[2] + el[2] + wr[2]) / 3;
      let r = 0; for (const p of [sh, el, wr, [wr[0] - 8, wr[1] - 5, wr[2]], [wr[0] - 8, wr[1] + 5, wr[2]]]) r = Math.max(r, Math.hypot(p[0] - ARMB.x, p[1] - ARMB.h, p[2] - ARMB.z));
      ARMB.r2 = (r + 2.5) * (r + 2.5);
      HANDM = HANDS[t < T_PINCH ? (u2 > 0.6 ? 1 : 0) : 2];
    }
    lightPass(F, shadowOn, cEdge);
    overlays(t, F, wick);
    present(g, k);
  }

  /* ================================================================ light */
  const AMB = [0.15, 0.15, 0.23];
  const CWm = [1.0, 0.78, 0.52];
  const MWm = [0.5, 0.64, 0.96];
  const STEP = 0.11, BW = 0.3;
  const R2 = 122 * 122;
  function band(I, b) {
    const s = I / STEP; let k = fl(s); const f = s - k; const lo = 0.5 - BW * 0.5;
    if (f >= lo + BW) k++; else if (f > lo && (f - lo) / BW > b) k++;
    return k * STEP;
  }
  // segment P->L against an axis-aligned box
  function hitBox(px, ph, pz, lx, lh, lz, x0, x1, h0, h1, z0, z1) {
    // does the segment P->L pass through the box? (slab test, no allocation)
    let t0 = 0, t1 = 1, ta, tb, s2;
    const dx = lx - px, dh = lh - ph, dz = lz - pz;
    if (Math.abs(dx) < 1e-6) { if (px < x0 || px > x1) return false; } else { ta = (x0 - px) / dx; tb = (x1 - px) / dx; if (ta > tb) { s2 = ta; ta = tb; tb = s2; } if (ta > t0) t0 = ta; if (tb < t1) t1 = tb; if (t0 > t1) return false; }
    if (Math.abs(dh) < 1e-6) { if (ph < h0 || ph > h1) return false; } else { ta = (h0 - ph) / dh; tb = (h1 - ph) / dh; if (ta > tb) { s2 = ta; ta = tb; tb = s2; } if (ta > t0) t0 = ta; if (tb < t1) t1 = tb; if (t0 > t1) return false; }
    if (Math.abs(dz) < 1e-6) { if (pz < z0 || pz > z1) return false; } else { ta = (z0 - pz) / dz; tb = (z1 - pz) / dz; if (ta > tb) { s2 = ta; ta = tb; tb = s2; } if (ta > t0) t0 = ta; if (tb < t1) t1 = tb; if (t0 > t1) return false; }
    return t1 > 0.002 && t0 < 0.998;
  }
  function lit(X, H, Z, lx, lh, lz, m, shadowOn) {
    // returns 1 if the point sees the flame
    // the frame (a slab proud of the wall) and the canvas behind it
    if (Z < FZ - 0.05 && m !== M_GILT) {
      const t = (FZ - Z) / (lz - Z);
      const xx = X + t * (lx - X), hh = H + t * (lh - H), yy = FL - hh;
      if (xx > FX0 && xx < FX1 && yy > FY0 - 1 && yy < FY1) {
        const inOpen = xx > CX0 && xx < CX0 + CW && yy > CY0 && yy < CY0 + CH;
        if (!inOpen) return 0;
        if (Z < CZ - 0.05) { const t1 = (CZ - Z) / (lz - Z), y1 = FL - (H + t1 * (lh - H)), x1 = X + t1 * (lx - X); if (x1 > CX0 && x1 < CX0 + CW && y1 > CY0 && y1 < CY0 + CH) return 0; }
      }
    }
    // table top
    if (H < TTH - 0.05) {
      const t = (TTH - H) / (lh - H);
      const xx = X + t * (lx - X), zz = Z + t * (lz - Z);
      if (xx > TX0 - 1 && xx < TX1 + 1 && zz > 0 && zz < TZ1) return 0;
    }
    // drip pan of the chamberstick
    if (H < KB + 1 && H > KB - 30) {
      const t = (KB + 1 - H) / (lh - H);
      const xx = X + t * (lx - X), zz = Z + t * (lz - Z);
      if ((xx - KX) * (xx - KX) + ((zz - KZ - 1) * (zz - KZ - 1)) < 5.2 * 5.2) return 0;
    }
    // vase & dead roses
    if (Z < VZ) {
      const t = (VZ - Z) / (lz - Z);
      if (mAt(VMASK, X + t * (lx - X), H + t * (lh - H))) return 0;
    }
    // letter rack (a low card)
    if (Z < RKZ + 1 && H < TTH + 8) {
      const t = (RKZ + 1 - Z) / (lz - Z);
      const xx = X + t * (lx - X), hh = H + t * (lh - H);
      if (xx > RKX - 5 && xx < RKX + 4 && hh > TTH && hh < TTH + 7.5) return 0;
    }
    // the clock
    if (X > QX0 - 1 && H > QH0 - 30 && hitBox(X, H, Z, lx, lh, lz, QX0, QX1, QH0, QH1, QZ0, QZ1)) return 0;
    return 1;
  }
  // the one who isn't there: her silhouette, tested against a tighter penumbra so the profile stays crisp
  function litFigure(X, H, Z, lx, lh, lz) {
    if (Z >= SZ) return 1;
    const t = (SZ - Z) / (lz - Z);
    return mAt(SHMASK, X + t * (lx - X), H + t * (lh - H)) ? 0 : 1;
  }
  // distance between segment P->L and segment A->B (3D), no allocation
  function segSegD(px, ph, pz, lx, lh, lz, A, B) {
    const d1x = lx - px, d1h = lh - ph, d1z = lz - pz, d2x = B[0] - A[0], d2h = B[1] - A[1], d2z = B[2] - A[2];
    const rx = px - A[0], rh = ph - A[1], rz = pz - A[2];
    const a = d1x * d1x + d1h * d1h + d1z * d1z, e = d2x * d2x + d2h * d2h + d2z * d2z, f = d2x * rx + d2h * rh + d2z * rz;
    const c = d1x * rx + d1h * rh + d1z * rz, bb = d1x * d2x + d1h * d2h + d1z * d2z, den = a * e - bb * bb;
    let s1 = den > 1e-9 ? (bb * f - c * e) / den : 0; s1 = s1 < 0 ? 0 : s1 > 1 ? 1 : s1;
    let t1 = (bb * s1 + f) / e;
    if (t1 < 0) { t1 = 0; s1 = -c / a; s1 = s1 < 0 ? 0 : s1 > 1 ? 1 : s1; } else if (t1 > 1) { t1 = 1; s1 = (bb - c) / a; s1 = s1 < 0 ? 0 : s1 > 1 ? 1 : s1; }
    const dx = rx + d1x * s1 - d2x * t1, dh = rh + d1h * s1 - d2h * t1, dz = rz + d1z * s1 - d2z * t1;
    return dx * dx + dh * dh + dz * dz;
  }
  const ARMB = { x: 0, h: 0, z: 0, r2: 0 }; // bounding sphere of arm and hand, for a cheap early out
  function litHand(X, H, Z, lx, lh, lz) {
    if (Z > HAND.z + 3) return 1;
    {
      const dx = lx - X, dh = lh - H, dz = lz - Z, ox = ARMB.x - X, oh = ARMB.h - H, oz = ARMB.z - Z;
      let u = (ox * dx + oh * dh + oz * dz) / (dx * dx + dh * dh + dz * dz); u = u < 0 ? 0 : u > 1 ? 1 : u;
      const ex = ox - u * dx, eh = oh - u * dh, ez = oz - u * dz;
      if (ex * ex + eh * eh + ez * ez > ARMB.r2) return 1;
    }
    if (segSegD(X, H, Z, lx, lh, lz, ARM[0], ARM[1]) < 1.7 * 1.7) return 0;
    if (segSegD(X, H, Z, lx, lh, lz, ARM[1], ARM[2]) < 1.15 * 1.15) return 0;
    if (HANDM && Z < HAND.z) {
      const t = (HAND.z - Z) / (lz - Z);
      if (mAt(HANDM, X + t * (lx - X) - HAND.x, H + t * (lh - H) - HAND.h)) return 0;
    }
    return 1;
  }
  const SPEC = []; // per material: [ks, shininess]
  SPEC[M_GILT] = [1.5, 12]; SPEC[M_BRASS] = [1.0, 22]; SPEC[M_VARN] = [0.22, 9]; SPEC[M_GLOSS] = [0.32, 30]; SPEC[M_GLASS] = [0.9, 40]; SPEC[M_WAX] = [0.15, 8];
  let FLX = 0, FLY = 0;
  function lightPass(F, shadowOn, cEdge) {
    const lx = LIT.x, lh = LIT.h, lz = LIT.z, P = LIT.P;
    const fp = proj(lx, lh, lz); FLX = fp[0]; FLY = fp[1];
    const glowP = P;
    for (let y = 0; y < AH; y++) for (let x = 0; x < AW; x++) {
      const i = y * AW + x;
      const col = SC.c[i] - 1, m = SC.m[i];
      // halo in the dusty air around the flame
      const gdx = x + 0.5 - FLX, gdy = (y + 0.5 - FLY) * 0.8, gr2 = gdx * gdx + gdy * gdy;
      const b = BAY[((y & 3) << 2) | (x & 3)];
      const halo = glowP > 0.01 ? band(glowP * 0.16 * 60 / (60 + gr2), b) : 0;
      const hz = HAZE[i] > 0 ? band(HAZE[i] * 0.22, b) : 0;
      if (m === M_EMIT) {
        const p = PAL[col];
        let r = p[0] + halo * 255 * CWm[0] * 0.6, g = p[1] + halo * 255 * CWm[1] * 0.6, bb = p[2] + halo * 255 * CWm[2] * 0.6;
        r = r > 255 ? 255 : r; g = g > 255 ? 255 : g; bb = bb > 255 ? 255 : bb;
        OUT[i] = halo > 0 ? LUT[((r >> 3) << 10) | ((g >> 3) << 5) | (bb >> 3)] : col;
        continue;
      }
      const X = SC.X[i], H = SC.H[i], Z = SC.Z[i];
      let nx = SC.nx[i], ny = SC.ny[i], nz = SC.nz[i];
      const ao = SC.ao[i] / 255;
      let snx = nx, sny = ny, snz = nz;
      if (m === M_VARN) { nx *= 0.25; ny *= 0.25; const l = Math.sqrt(nx * nx + ny * ny + nz * nz); nx /= l; ny /= l; nz /= l; snx = SC.nx[i] * 0.5; sny = SC.ny[i] * 0.5; const l2 = Math.sqrt(snx * snx + sny * sny + snz * snz); snx /= l2; sny /= l2; snz /= l2; }
      let It = 0, Is = 0;
      if (P > 0.002) {
        const dx = lx - X, dh = lh - H, dz = lz - Z;
        const d2 = dx * dx + dh * dh + dz * dz, d = Math.sqrt(d2) + 1e-4;
        let nd = (nx * dx + ny * dh + nz * dz) / d;
        const wrap = m === M_VEL ? 0.55 : m === M_GILT ? 0.15 : m === M_VARN ? 0.75 : 0.42;
        nd = (nd + wrap) / (1 + wrap);
        if (nd > 0) {
          const jx = lx + (b - 0.5) * 1.6, jh = lh + (BAY[(((y + 2) & 3) << 2) | ((x + 1) & 3)] - 0.5) * 3.2;
          let sh = lit(X, H, Z, jx, jh, lz, m, shadowOn);
          if (sh && shadowOn) sh = litFigure(X, H, Z, lx + (b - 0.5) * 0.5, lh + (BAY[(((y + 2) & 3) << 2) | ((x + 1) & 3)] - 0.5) * 0.8, lz);
          if (sh && ARM) sh = litHand(X, H, Z, lx + (b - 0.5) * 0.4, lh + (b - 0.5) * 0.5, lz);
          if (sh) {
            const att = m === M_VARN ? P * 0.78 * 26000 / (26000 + d2) : P * R2 / (R2 + d2) * (1 - 0.42 * Math.exp(-d2 / 420));
            It = att * nd * (m === M_GILT ? 0.55 : 1) * (0.55 + 0.45 * ao);
            const sp = SPEC[m];
            if (sp) {
              // Blinn-Phong toward the camera
              let vx = XC - X, vh = EC - H, vz = DC - Z; const vl = Math.sqrt(vx * vx + vh * vh + vz * vz);
              vx /= vl; vh /= vl; vz /= vl;
              let hx = dx / d + vx, hh = dh / d + vh, hz2 = dz / d + vz; const hlen = Math.sqrt(hx * hx + hh * hh + hz2 * hz2);
              const ndh = (snx * hx + sny * hh + snz * hz2) / hlen;
              if (m === M_VARN) {
                // varnish: a broad sheen over the lower canvas, broken up by the impasto into glints
                const flat = hz2 / hlen;
                const sheen = Math.pow(Math.max(0, flat), 7);
                const pv = PAL[col], lum = (pv[0] + pv[1] + pv[2]) / 765;
                Is = att * sheen * (0.10 + 0.9 * Math.pow(Math.max(0, ndh), 40)) * (0.35 + lum) * 0.9;
              } else if (ndh > 0) Is = sp[0] * Math.pow(ndh, sp[1]) * att;
            }
          }
        }
        if (m === M_WAX) { const dd = Math.hypot(X - KX, H - (KTOP + 1)); It += P * 0.3 * Math.max(0, 1 - dd / 4); }
      }
      // moon (floor, rug and anything low in the beam)
      let Im = 0;
      if (Z > 6 && H < 60) { const mp = moonPass(X + (b - 0.5) * 0.9, H, Z, cEdge); if (mp) Im = 0.62; }
      // faint cold spill from the window onto the wall and curtains near it
      if (X < 60 && Z < 6) { const dw = Math.hypot(X - 22, (H - 104) * 0.5); Im += band(0.2 * 900 / (900 + dw * dw * 3), b); }
      if (P > 0.002) { const fx = X - lx, fh = H - (lh - 14), fz = Z - lz; It += P * (H < 1 ? 0.2 : 0.13) * 2600 / (2600 + fx * fx + fh * fh * 1.5 + fz * fz); }
      if ((m === M_GILT || m === M_BRASS) && P > 0.002) {
        // gilt and brass mirror the warm room around them
        const ex = X - lx, eh = H - lh, ed2 = ex * ex + eh * eh + 300;
        It += P * 0.42 * (0.55 + 0.45 * nz) * 4000 / (4000 + ed2) * ao;
      }
      const Itb = band(It, b), Isb = Is > 0.02 ? band(Is, b) : 0;
      const a = 0.55 + 0.45 * ao;
      const lr = AMB[0] * a + Itb * CWm[0] + Im * MWm[0];
      const lg = AMB[1] * a + Itb * CWm[1] + Im * MWm[1];
      const lb = AMB[2] * a + Itb * CWm[2] + Im * MWm[2];
      const p = PAL[col];
      const metal = m === M_GILT || m === M_BRASS;
      let r = p[0] * lr + Isb * (metal ? 255 : 235) + (halo + hz * 0) * 255 * CWm[0] * 0.5 + hz * 255 * MWm[0] * 0.5;
      let g = p[1] * lg + Isb * (metal ? 205 : 205) + halo * 255 * CWm[1] * 0.5 + hz * 255 * MWm[1] * 0.5;
      let bb = p[2] * lb + Isb * (metal ? 120 : 160) + halo * 255 * CWm[2] * 0.5 + hz * 255 * MWm[2] * 0.5;
      r = r > 255 ? 255 : r; g = g > 255 ? 255 : g; bb = bb > 255 ? 255 : bb;
      OUT[i] = LUT[((r >> 3) << 10) | ((g >> 3) << 5) | (bb >> 3)];
    }
  }

  /* ================================================================ overlays: flame, smoke, dust */
  const MOTES = [];
  function buildMotes() {
    const R = mulberry32(31337);
    // dust in the candle's light (in front of the table) and in the moonbeam
    for (let k = 0; k < 14; k++) MOTES.push({ x: KX - 26 + R() * 52, h: TTH + 10 + R() * 46, z: 22 + R() * 30, ax: 2 + R() * 4, ah: 3 + R() * 6, f1: 1 + fl(R() * 3), f2: 1 + fl(R() * 2), ph: R() * TAU, ph2: R() * TAU });
    for (let k = 0; k < 9; k++) MOTES.push({ x: 30 + R() * 50, h: 8 + R() * 50, z: 55 + R() * 45, ax: 3 + R() * 5, ah: 3 + R() * 5, f1: 1 + fl(R() * 2), f2: 1, ph: R() * TAU, ph2: R() * TAU, moon: true });
  }
  function smokeAt(t) {
    // the wisps alive at t: a thread after each gutter, a long ribbon after the flame is put out
    const ws = [];
    for (const d of DIPS) if (t > d.sw - 0.25 && t < d.t1 + 1.6) ws.push({ t0: d.sw - 0.25, s: 0.55, len: 18, k: d.t0 });
    if (t > T_PINCH + 0.25 && t < T_LIGHT + 0.6) ws.push({ t0: T_PINCH + 0.25, s: 1, len: 58, k: 7 });
    return ws;
  }
  function overlays(t, F, wick) {
    const q = st10(t);
    const wx = Math.round(wick[0]), wy = Math.round(wick[1]);
    // smoke wisps rising from the wick, curling in the draft
    for (const w of smokeAt(t)) {
      const age = q - w.t0;
      if (age < 0) continue;
      const head = Math.min(w.len, age * 24);
      const fade = clamp(1 - (age - 0.8) / 2.0, 0, 1) * w.s;
      let px = -1, py = -1;
      for (let s2 = 0; s2 < head; s2 += 0.34) {
        const yy = wy - 2 - s2;
        const sway = Math.sin(s2 * 0.2 - age * 1.9 + w.k) * (0.4 + s2 * 0.11) + Math.sin(s2 * 0.07 + w.k * 2) * s2 * 0.08;
        const xx = wx + sway + (F.lean > 0 ? s2 * 0.05 : 0);
        const X = Math.round(xx), Y = Math.round(yy);
        if (X === px && Y === py) continue; px = X; py = Y;
        if (X < 0 || Y < 0 || X >= AW || Y >= AH) continue;
        const dens = fade * (1 - s2 / (w.len + 4));
        if (bay(X, Y) > dens * 1.6) continue;
        const i = Y * AW + X;
        const near = Math.hypot(X - FLX, Y - FLY);
        const lum = F.P * 50 / (50 + near * near);
        OUT[i] = lum > 0.45 ? 26 : lum > 0.15 ? 14 : (F.P < 0.05 ? (s2 < w.len * 0.5 ? 6 : 5) : 13);
        // where the ribbon curls it fattens
        if (Math.abs(Math.cos(s2 * 0.2 - age * 1.9 + w.k)) < 0.3 && s2 > 8 && dens > 0.35 && X + 1 < AW) OUT[i + 1] = OUT[i] === 6 ? 5 : OUT[i] === 26 ? 14 : 4;
      }
    }
    // dust motes: only seen where light catches them
    for (let k = 0; k < MOTES.length; k++) {
      const m = MOTES[k];
      const X = m.x + Math.sin(TAU * q * m.f1 / D + m.ph) * m.ax, H = m.h + Math.sin(TAU * q * m.f2 / D + m.ph2) * m.ah - ((q * 0.6 + k) % 10) * 0, Z = m.z;
      const [sx, sy] = proj(X, H, Z);
      const x = Math.round(sx), y = Math.round(sy);
      if (x < 0 || y < 0 || x >= AW || y >= AH) continue;
      if (m.moon) {
        if (moonPass(X, H, Z, 0.5) && ((fl(q * 10) + k) % 7) !== 0) OUT[y * AW + x] = 7;
        continue;
      }
      const d2 = (X - LIT.x) ** 2 + (H - LIT.h) ** 2 + (Z - LIT.z) ** 2;
      const I = LIT.P * 900 / (900 + d2);
      const tw = (fl(q * 10) * 7 + k * 13) % 11; // motes turn in the air and catch the light now and then
      if (I > 0.9 && tw < 3) OUT[y * AW + x] = 23; else if (I > 0.55 && tw < 6) OUT[y * AW + x] = 22; else if (I > 0.3 && tw < 7) OUT[y * AW + x] = 14;
    }
    // flame (emissive sprite), ember when out
    const fs = flameSprite(F);
    if (fs) {
      const w = fs[0].length, h = fs.length;
      let base = fs[h - 1].search(/[bky]/); if (base < 0) base = w >> 1; base += (fs[h - 1][base + 1] === 'y' || fs[h - 1][base + 1] === 'b') ? 1 : 0;
      const ox = wx - base, oy = wy - h + 1;
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
        const ch = fs[j][i]; if (ch === '.') continue;
        const X = ox + i, Y = oy + j; if (X < 0 || Y < 0 || X >= AW || Y >= AH) continue;
        OUT[Y * AW + X] = FMAP[ch];
      }
    }
    if (F.mode === 'out' || F.mode === 'pinch') {
      const glow = F.mode === 'pinch' ? 1 : clamp(1 - (t - T_OUT) / 0.9, 0, 1);
      if (glow > 0.05) OUT[(wy) * AW + wx] = glow > 0.5 ? 25 : 17;
    }
    // the wick itself
    if (F.mode !== 'out') OUT[(wy + 1) * AW + wx] = 9;
  }

  /* ================================================================ present */
  let IMG = null, SMALL = null, SG = null;
  function present(g, k) {
    if (typeof document === 'undefined') return;
    if (!SMALL) { SMALL = document.createElement('canvas'); SMALL.width = AW; SMALL.height = AH; SG = SMALL.getContext('2d'); IMG = SG.createImageData(AW, AH); }
    const d = IMG.data;
    for (let i = 0, j = 0; i < NP; i++, j += 4) { const p = PAL[OUT[i]]; d[j] = p[0]; d[j + 1] = p[1]; d[j + 2] = p[2]; d[j + 3] = 255; }
    SG.putImageData(IMG, 0, 0);
    if (!g) return;
    g.imageSmoothingEnabled = false;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.drawImage(SMALL, 0, 0, AW * k, AH * k);
  }
  function pixelsB64() {
    let s = '';
    const chunk = new Uint8Array(AW * 3);
    for (let y = 0; y < AH; y++) {
      for (let x = 0; x < AW; x++) { const p = PAL[OUT[y * AW + x]]; chunk[x * 3] = p[0]; chunk[x * 3 + 1] = p[1]; chunk[x * 3 + 2] = p[2]; }
      s += String.fromCharCode.apply(null, chunk);
    }
    return btoa(s);
  }

  let BUILT = false;
  function build() {
    if (BUILT) return;
    buildLUT(); buildMaps();
    buildWall(); buildFloor(); buildRug(); buildWindow(); buildPole();
    drawCurtainStatic();
    buildFrame(); buildPainting(); buildTable(); buildLace(); buildCandle(); buildRack(); buildVase(); buildClock();
    buildAO(); buildHaze(); buildShadowFigure(); buildMotes();
    BUILT = true;
  }
  function drawCurtainStatic() { TG = BS; drawCurtain(-1, 0); }

  /* ================================================================ mount */
  (window.PIECES = window.PIECES || []).push({
    id: 'the-portrait',
    title: 'The Portrait',
    medium: 'Pixel art in 32 colours, 216 × 270, animated in JavaScript · 32 s loop',
    note: 'Watch the painting each time the candle dips · tap to pause',
    about: 'A family portrait hangs in a dark hallway above a single candle. Every time a draft makes the flame gutter, something in the painting is different when the light comes back. Every pixel is placed by code on a 216 × 270 grid and lit live by the candle, with shadows cast from wherever the flame happens to lean.',
    tone: 'dark',
    room: '#07060b',
    mount(el, api) {
      const EXPORT = /[?&]export\b/.test(location.search);
      SEED = (api.seed >>> 0) % 100000 || 7;
      let alive = true, raf = 0, playing = !EXPORT, clock = 0, last = 0;
      el.style.background = '#07060b';
      const cv = document.createElement('canvas');
      cv.style.cssText = 'position:absolute;display:block;cursor:pointer;image-rendering:pixelated;image-rendering:crisp-edges;';
      el.appendChild(cv);
      const g = cv.getContext('2d', { alpha: false });
      const pauseMark = document.createElement('div');
      pauseMark.style.cssText = 'position:absolute;width:34px;height:34px;opacity:0;transition:opacity .4s;pointer-events:none;';
      pauseMark.innerHTML = '<svg viewBox="0 0 34 34" width="34" height="34"><rect x="10" y="9" width="5" height="16" fill="rgba(236,228,214,.8)"/><rect x="19" y="9" width="5" height="16" fill="rgba(236,228,214,.8)"/></svg>';
      el.appendChild(pauseMark);
      let K = 5;
      function layout() {
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        let left = 0, top = 0, cssW, cssH;
        if (EXPORT) { cssW = 1080; cssH = 1350; cv.style.position = 'fixed'; K = Math.max(1, Math.round(5 * dpr)); }
        else {
          const w = el.clientWidth || window.innerWidth, h = el.clientHeight || window.innerHeight;
          const fit = Math.min(w * dpr / AW, h * dpr / AH) * 0.97;
          let kk = Math.floor(fit);
          if (kk < 1) kk = 1;
          K = kk;
          if (kk < fit * 0.9) { K = Math.max(1, Math.ceil(fit)); cssW = AW * fit / dpr; cssH = AH * fit / dpr; }
          else { cssW = AW * kk / dpr; cssH = AH * kk / dpr; }
          left = Math.round((w - cssW) / 2); top = Math.round((h - cssH) / 2);
        }
        cv.style.left = left + 'px'; cv.style.top = top + 'px'; cv.style.width = cssW + 'px'; cv.style.height = cssH + 'px';
        pauseMark.style.left = (left + cssW - 48) + 'px'; pauseMark.style.top = (top + 14) + 'px';
        if (cv.width !== AW * K || cv.height !== AH * K) { cv.width = AW * K; cv.height = AH * K; }
      }
      layout();
      build();
      drawFrame(0, g, K);
      const timed = (t) => { const t0 = performance.now(); drawFrame(t, g, K); hook.lastMs = performance.now() - t0; };
      const hook = {
        duration: D,
        lastMs: 0,
        isReady: () => BUILT && (!EXPORT || (() => { const st = el.parentElement; return !st || parseFloat(getComputedStyle(st).opacity) >= 0.999; })()),
        renderAt(t) { return new Promise((res) => { if (!EXPORT) { playing = false; clock = t; } timed(t); requestAnimationFrame(() => (EXPORT ? requestAnimationFrame(res) : res())); }); },
        pixels: pixelsB64,
        paint: (S, raw) => { let str = ''; const P = PSTATES[S]; for (let i = 0; i < PW * PH; i++) { const c = raw ? (PT.c[i] ? PT.c[i] - 1 : 10) : P.c[i]; const p = PAL[c]; str += String.fromCharCode(p[0], p[1], p[2]); } return btoa(str); },
        dbg: (x, y) => { const i = y * AW + x; return { c: SC.c[i] - 1, m: SC.m[i], X: SC.X[i], H: SC.H[i], Z: SC.Z[i], n: [SC.nx[i], SC.ny[i], SC.nz[i]], out: OUT[i] }; },
      };
      window.__portrait = hook;
      api.ready();
      function frame(now) {
        if (!alive || !api.isCurrent()) return;
        raf = requestAnimationFrame(frame);
        const dt = last ? Math.min(0.1, (now - last) / 1000) : 0; last = now;
        if (!playing) return;
        clock = (clock + dt) % D;
        timed(clock);
      }
      if (!EXPORT) raf = requestAnimationFrame(frame);
      const onDown = () => {
        if (EXPORT) return;
        playing = !playing; last = 0;
        pauseMark.style.opacity = playing ? '0' : '1';
      };
      cv.addEventListener('pointerdown', onDown);
      let rt = 0;
      const ro = new ResizeObserver(() => {
        clearTimeout(rt);
        rt = setTimeout(() => { if (!alive) return; layout(); drawFrame(clock, g, K); }, 120);
      });
      ro.observe(el);
      return {
        destroy() {
          alive = false; cancelAnimationFrame(raf); ro.disconnect(); clearTimeout(rt);
          cv.removeEventListener('pointerdown', onDown);
          if (window.__portrait === hook) delete window.__portrait;
        },
      };
    },
  });
})();
