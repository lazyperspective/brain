/* Creature Feature — piece 1 of "Don't Look Behind You".
 *
 * A 32-second seamless loop of real pixel art. Every frame is a pure function of t:
 * the room is painted into a 216 × 270 art-pixel buffer (palette index + surface normal + depth + height
 * per pixel), lit by the CRT, a jack-o'-lantern, the hall night-light and the moon with stepped, ordered-
 * dithered light, quantised to a 32-colour palette and scaled up nearest-neighbour. The TV programmes are
 * drawn into their own 48 × 36 screen; its average colour is what lights the room.
 */
(function () {
  'use strict';

  /* ================================================================ constants & helpers */
  const AW = 216, AH = 270, NP = AW * AH, D = 32, FL = 146;
  const SW = 48, SH = 36, SX = 83, SY = 83; // TV screen rect in art pixels
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

  /* ================================================================ palette (32) */
  const PAL_HEX = [
    '07061a', '12112c', '1c1b42', '282759', '373573', '4b4a8e', '6667ad', '8d93cf', 'bccbee', 'ecf8ff', // 0-9 night ramp
    '6cc4dc', '2f7896',                                                                               // 10-11 cyan
    '2a1426', '4e1f36', '7c3436', 'b8532e', 'f28a2a', 'ffc552', 'fff3c4',                             // 12-18 warm
    '3a2444', '5c3a5c', '8a5c7c', 'bf92a6',                                                           // 19-22 wood / mauve
    '1d3b36', '3e7a4c', '92d460',                                                                     // 23-25 green
    'd83c6c', 'ff8fb6', '7a3ec2', '46d2ba',                                                           // 26-29 candy
    'eaa98a', 'a5685c',                                                                               // 30-31 skin
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
      let d = nearest(p[0] * 0.66, p[1] * 0.66, p[2] * 0.7); if (d === k) d = k > 0 && k <= 9 ? k - 1 : 0;
      DARK[k] = d;
      let l = nearest(p[0] * 1.22 + 16, p[1] * 1.22 + 16, p[2] * 1.18 + 18); if (l === k && k < 9) l = k + 1;
      LITE[k] = l;
    }
  }
  const BAY = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
  const bay = (x, y) => BAY[((y & 3) << 2) | (x & 3)];

  /* ================================================================ targets & pixel pens */
  // normals: 0 emissive, 1 up, 2 front, 3 rim (faces the TV), 4 left, 5 right, 6 soft (sprites)
  // layer-only markers: 7 glint (googly eyes), 8 eye (cat eyes), 9 steam
  const NE = 0, NU = 1, NF = 2, NR = 3, NL = 4, NRT = 5, NS = 6, NG = 7, NY = 8, NST = 9;
  function mkT(w, h, full) {
    return { w, h, c: new Uint8Array(w * h), n: new Uint8Array(w * h), g: full ? new Int16Array(w * h) : null, hh: full ? new Int16Array(w * h) : null, x0: 0, y0: 0, x1: w, y1: h, zt: false };
  }
  let TG = null, PN = NF, PG = FL, PH = -1;
  const pen = (n, g, h) => { PN = n; PG = g === undefined ? PG : g; PH = h === undefined ? -1 : h; };
  function put(x, y, col) {
    x = fl(x); y = fl(y);
    const T = TG;
    if (x < T.x0 || y < T.y0 || x >= T.x1 || y >= T.y1) return;
    const i = y * T.w + x;
    if (T.g) {
      if (T.zt && PG < T.g[i]) return;
      T.g[i] = PG; T.hh[i] = PH >= 0 ? PH : PG - y;
    }
    T.n[i] = PN; T.c[i] = col + 1;
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
        if (u * u + v * v <= 1) put(x, y, fn ? fn(x, y, u, v) : c);
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
        for (let x = Math.round(xs[k]); x < Math.round(xs[k + 1]); x++) put(x, y, fn ? fn(x, y) : c);
    }
  }
  // string sprite: rows of chars, map char -> palette index or [index, normal]
  function spr(rows, map, x, y, flip) {
    const n0 = PN;
    for (let j = 0; j < rows.length; j++) {
      const r = rows[j], w = r.length;
      for (let i = 0; i < w; i++) {
        const ch = r[i]; if (ch === '.' || ch === ' ') continue;
        const m = map[ch]; if (m === undefined) continue;
        if (typeof m === 'number') { PN = n0; put(x + (flip ? w - 1 - i : i), y + j, m); }
        else { PN = m[1]; put(x + (flip ? w - 1 - i : i), y + j, m[0]); }
      }
    }
    PN = n0;
  }

  /* ================================================================ 3x5 pixel font */
  const F3 = {
    A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110', E: '111100110100111',
    F: '111100110100100', G: '011100101101011', H: '101101111101101', I: '111010010010111', J: '001001001101010',
    K: '101101110101101', L: '100100100100111', M: '101111111101101', N: '110101101101101', O: '010101101101010',
    P: '110101110100100', Q: '010101101110011', R: '110101110101101', S: '011100010001110', T: '111010010010010',
    U: '101101101101111', V: '101101101101010', W: '101101111111101', X: '101101010101101', Y: '101101010010010',
    Z: '111001010100111', 0: '111101101101111', 1: '010110010010111', 2: '110001010100111', 3: '110001010001110',
    4: '101101111001001', 5: '111100110001110', 6: '011100111101111', 7: '111001010010010', 8: '111101111101111',
    9: '111101111001110', ':': '000010000010000', '*': '000101010101000', '-': '000000111000000', '%': '101001010100101',
    '!': '010010010000010', '.': '000000000000010', "'": '010010000000000', '&': '010101010101011', '@': '010101111101010',
    '+': '000010111010000', '°': '010101010000000', '/': '001001010100100', ' ': '000000000000000',
  };
  function text(s, x, y, c, sh) {
    let cx = x;
    for (const ch of s) {
      const g = F3[ch] || F3[' '];
      for (let j = 0; j < 5; j++) for (let i = 0; i < 3; i++) if (g[j * 3 + i] === '1') {
        if (sh !== undefined) put(cx + i + 1, y + j + 1, sh);
        put(cx + i, y + j, c);
      }
      cx += 4;
    }
    return cx - x;
  }
  // chunky 4x6 font for HAPPY
  const F4 = {
    H: ['1001', '1001', '1111', '1001', '1001', '1001'], A: ['0110', '1001', '1001', '1111', '1001', '1001'],
    P: ['1110', '1001', '1001', '1110', '1000', '1000'], Y: ['1001', '1001', '0110', '0010', '0010', '0010'],
  };

  /* ================================================================ layers (sprites) */
  function mkL(w, h) { return mkT(w, h, false); }
  function clr(L) { L.c.fill(0); L.n.fill(0); }
  // rim marks lit edges (toward the TV), outline wraps the rest in a dark line
  function finish(L, lx, ly, oc) {
    const w = L.w, h = L.h, src = L.c.slice();
    const lit = (dx, dy) => dx * lx + dy * ly > 0.2;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (src[i]) {
        const nn = L.n[i];
        if (nn === NE || nn === NG || nn === NY || nn === NST) continue;
        for (const [dx, dy] of [[0, -1], [1, 0], [-1, 0], [0, 1]]) {
          const X = x + dx, Y = y + dy;
          const empty = X < 0 || Y < 0 || X >= w || Y >= h || !src[Y * w + X];
          if (empty && lit(dx, dy)) { L.n[i] = NR; break; }
        }
      } else if (oc >= 0) {
        for (const [dx, dy] of [[0, -1], [1, 0], [-1, 0], [0, 1]]) {
          const X = x - dx, Y = y - dy; // neighbour that is filled, we sit at its (dx,dy) side
          if (X < 0 || Y < 0 || X >= w || Y >= h) continue;
          const k = Y * w + X;
          if (src[k] && L.n[k] !== NST && !lit(dx, dy)) { L.c[i] = oc + 1; L.n[i] = NF; break; }
        }
      }
    }
  }
  // mode: 0 lit colours, 1 silhouette (TV rim), 2 backlit silhouette (emissive, warm rim)
  function stamp(L, ox, oy, gy, mode, clip, noZ) {
    TG = SC; SC.zt = !noZ; PH = -1; PG = gy;
    if (clip) { SC.x0 = clip[0]; SC.y0 = clip[1]; SC.x1 = clip[2]; SC.y1 = clip[3]; }
    const w = L.w, h = L.h;
    ox = Math.round(ox); oy = Math.round(oy);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x, c = L.c[i];
      if (!c) continue;
      let col = c - 1, n = L.n[i];
      if (mode === 0) {
        if (n === NG || n === NST) n = NS;
        else if (n === NY) n = NS;
      } else if (mode === 1) {
        if (n === NG) { col = 7; n = NE; }
        else if (n === NY) { n = NE; }
        else if (n === NST) { col = 6; n = NS; }
        else if (n === NR) { col = 5; }
        else { col = 1; n = NF; }
      } else {
        if (n === NG) { col = 6; n = NE; }
        else if (n === NY) { n = NE; }
        else if (n === NST) { col = 13; n = NE; }
        else {
          let edge = false;
          for (const [dx, dy] of [[0, -1], [1, 0], [-1, 0], [0, 1]]) {
            const X = x + dx, Y = y + dy;
            if (X < 0 || Y < 0 || X >= w || Y >= h || !L.c[Y * w + X]) { edge = true; break; }
          }
          col = edge ? 13 : 0; n = NE;
        }
      }
      PN = n; put(ox + x, oy + y, col);
    }
    SC.zt = false; SC.x0 = 0; SC.y0 = 0; SC.x1 = AW; SC.y1 = AH;
  }
  function flipL(L) {
    const w = L.w, h = L.h;
    for (let y = 0; y < h; y++) for (let x = 0; x < w >> 1; x++) {
      const a = y * w + x, b = y * w + (w - 1 - x);
      let t = L.c[a]; L.c[a] = L.c[b]; L.c[b] = t;
      t = L.n[a]; L.n[a] = L.n[b]; L.n[b] = t;
    }
  }

  /* ================================================================ buffers */
  const SC = mkT(AW, AH, true);   // scene (albedo index+1, normal, depth, height)
  const BS = mkT(AW, AH, true);   // static base
  const SCR = mkT(SW, SH, false); // tv screen
  const OUT = new Uint8Array(NP);
  const MOON = new Float32Array(NP);
  const LK = mkL(40, 42), LP = mkL(64, 104), LC = mkL(20, 20), LT = mkL(24, 30), LX = mkL(20, 20);

  /* ================================================================ timeline */
  const SEGS = [
    [0, 4.4, 'movie', 13], [4.4, 4.8, 'static', 6], [4.8, 9.2, 'pumpkin', 6], [9.2, 9.6, 'static', 7],
    [9.6, 14.0, 'host', 7], [14.0, 14.4, 'static', 9], [14.4, 18.8, 'weather', 9], [18.8, 19.2, 'static', 13],
    [19.2, 22.4, 'movie2', 13], [22.4, 22.8, 'static', 0], [22.8, 25.2, 'cam', 0], [25.2, 25.4, 'static', 31],
    [25.4, 31.6, 'card', 31], [31.6, 32.01, 'static', 13],
  ];
  const FLIPS = [4.6, 9.4, 14.2, 19.0, 22.6, 25.3, 31.8];
  function seg(t) { for (const s of SEGS) if (t < s[1]) return s; return SEGS[SEGS.length - 1]; }
  function stage(t) { let s = 0; for (const f of FLIPS) if (t >= f) s++; return s; }
  const st10 = (t) => fl(t * 10 + 1e-6) / 10; // sprite clock, 10 fps

  /* ================================================================ static room */
  let CAT = { k: 2, m: 4, l: 5, w: 8 };
  let WRAP = [];
  function buildBase() {
    const R = mulberry32(SEED * 9301 + 49297);
    TG = BS; BS.zt = false;
    // ---- ceiling and wall
    pen(NF, FL);
    for (let y = 0; y < 12; y++) for (let x = 0; x < AW; x++) put(x, y, y < 9 ? 3 : y === 9 ? 6 : y === 10 ? 7 : 4);
    for (let y = 12; y < 140; y++) for (let x = 0; x < AW; x++) {
      let c = y < 104 ? 5 : 4;
      if (y < 103 && (x + 4) % 13 === 0) c = 4;
      if (y >= 106 && (x + 9) % 19 === 0) c = 3;
      put(x, y, c);
    }
    // wallpaper motif: tiny stars and moons
    for (let y = 18, row = 0; y < 100; y += 11, row++) for (let x = (row & 1) ? 10 : 4; x < AW; x += 13) {
      if (ih(x, y, 3) < 0.5) { put(x, y, 6); put(x - 1, y, 6); put(x + 1, y, 6); put(x, y - 1, 6); put(x, y + 1, 6); }
      else { put(x, y, 6); put(x + 1, y, 6); put(x, y + 1, 6); put(x, y - 1, 6); put(x + 1, y + 2, 6); put(x + 1, y - 2, 6); }
    }
    hl(0, AW - 1, 103, 7); hl(0, AW - 1, 104, 6); hl(0, AW - 1, 105, 3);
    rect(0, 140, AW, 6, 20); hl(0, AW - 1, 140, 22); hl(0, AW - 1, 141, 21); hl(0, AW - 1, 145, 19);
    // ---- floor (planks)
    for (let y = FL; y < AH; y++) {
      const r = fl((y - FL) / 7), ry = (y - FL) % 7;
      for (let x = 0; x < AW; x++) {
        let c = 20;
        if (ry === 0) c = 19;
        else {
          const off = fl(ih(r, 1, 5) * 47);
          if ((x + off) % 47 === 0) c = 19;
          else if (ih(x >> 2, y, 9) < 0.05) c = 21;
          else if (ih(x >> 3, y, 11) < 0.05) c = 19;
        }
        if (y < FL + 2) c = 19;
        pen(NU, y, 0); put(x, y, c);
      }
    }
    // ---- rug (braided oval)
    const rcx = 110, rcy = 226, rrx = 64, rry = 23;
    const ringC = [[13, 12], [14, 13], [20, 19], [28, 4], [20, 19], [14, 13], [13, 12], [21, 20], [4, 3], [13, 12]];
    for (let y = rcy - rry - 1; y <= rcy + rry + 1; y++) for (let x = rcx - rrx - 1; x <= rcx + rrx + 1; x++) {
      const u = (x + 0.5 - rcx) / rrx, v = (y + 0.5 - rcy) / rry, rho = Math.sqrt(u * u + v * v);
      if (rho > 1) continue;
      const ring = fl((1 - rho) * 10);
      const rc = ringC[Math.min(ring, ringC.length - 1)];
      const fr = (1 - rho) * 10 - ring;
      let c = fr < 0.12 ? rc[1] : rc[0];
      if (fr > 0.45 && fr < 0.6 && ((x + (y << 1)) % 5 === 0)) c = rc[1];
      pen(NU, y, 0); put(x, y, c);
    }
    // ---- doorway to the hall (baked, emissive)
    pen(NE, FL);
    for (let y = 55; y < 146; y++) for (let x = 6; x < 36; x++) {
      const dx = (x - 11) / 1.0, dy = (y - 130) / 1.3, d = Math.sqrt(dx * dx + dy * dy);
      let c = y >= 134 ? 19 : 1;
      if (y >= 134 && ((y - 134) % 4 === 0)) c = 12;
      const b = bay(x, y);
      if (d < 26) c = d < 9 ? 14 : d < 15 ? (b < 0.5 ? 13 : 14) : d < 21 ? (b < 0.5 ? 12 : 13) : (b < 0.4 ? 12 : c);
      if (x < 10) c = d < 18 ? 13 : 19; // open door panel against the hall wall
      if (x === 10) c = d < 18 ? 14 : 20;
      put(x, y, c);
    }
    rect(22, 80, 10, 12, 12); rect(23, 81, 8, 10, 2); put(25, 86, 4); put(26, 85, 4); put(27, 86, 4); put(28, 87, 4); // picture in the hall
    rect(9, 126, 3, 4, 18); put(10, 125, 17); put(9, 130, 17); put(11, 130, 17); // night-light
    pen(NF, FL);
    rect(3, 51, 36, 4, 21); hl(3, 38, 51, 22);
    rect(3, 51, 3, 95, 21); vl(3, 51, 145, 22);
    rect(36, 51, 3, 95, 21); vl(38, 51, 145, 20);
    // ---- monster-movie poster
    rect(42, 22, 23, 31, 8); rect(44, 24, 19, 27, 13);
    for (let y = 24; y < 51; y++) for (let x = 44; x < 63; x++) if (((x + y) & 1) && y > 38) put(x, y, 12);
    ell(53.5, 41, 6, 6.5, 15); ell(53.5, 41, 4.5, 5, 16);
    put(50, 39, 18); put(51, 39, 18); put(56, 39, 18); put(57, 39, 18); put(51, 40, 0); put(56, 40, 0);
    hl(50, 57, 44, 12); put(51, 43, 18); put(56, 43, 18);
    line(47, 37, 45, 33, 16); line(60, 37, 62, 33, 16); put(48, 34, 17); put(59, 34, 17);
    hl(44, 62, 50, 15);
    text('BOG', 47, 26, 17, 12);
    put(42, 22, 9); put(64, 22, 9); put(42, 52, 9); put(64, 52, 9); // tape
    // ---- toy shelf
    rect(40, 80, 28, 2, 21); hl(40, 67, 82, 19); put(43, 83, 19); put(64, 83, 19);
    rect(42, 71, 6, 9, 6); rect(43, 72, 4, 3, 7); put(44, 73, 10); put(46, 73, 10); hl(43, 46, 76, 4); put(44, 70, 7); put(44, 69, 26); // robot
    rect(41, 74, 1, 3, 6); rect(48, 74, 1, 3, 6);
    rect(51, 68, 3, 12, 8); put(52, 66, 26); hl(51, 67, 53, 26); put(50, 77, 26); put(54, 77, 26); put(50, 78, 26); put(54, 78, 26); put(52, 71, 11); // rocket
    ell(59, 77, 3.5, 3, 16); put(59, 73, 24); put(58, 76, 17); // little pumpkin
    rect(63, 74, 2, 6, 24); rect(65, 73, 2, 7, 26); // books
    // kid's crayon drawing taped under the shelf
    rect(45, 88, 15, 12, 9); put(45, 88, 8); put(59, 88, 8);
    ell(50, 93, 2.5, 3, 7); put(49, 92, 0); put(51, 92, 0); hl(48, 52, 96, 7); // ghost
    poly([[54, 98], [54, 94], [56, 92], [58, 94], [58, 98]], 26); put(56, 96, 17); hl(45, 59, 99, 24); // house
    put(57, 90, 17); put(58, 89, 17);
    // ---- pennant garland
    pen(NF, FL);
    let px = 40, prev = null, pk = 0;
    for (let x = 40; x < AW; x++) {
      const u = (x - 40) / (AW - 40);
      const y = Math.round(13 + Math.sin(u * Math.PI) * 9);
      put(x, y, 7);
      if (x - px >= 9 || x === 40) {
        px = x; const cols = [16, 28, 24, 17, 26];
        const col = cols[pk++ % cols.length];
        poly([[x, y + 1], [x + 6, y + 1], [x + 3, y + 8]], col);
        put(x + 1, y + 1, LITE[col]); put(x + 2, y + 1, LITE[col]);
      }
      prev = y;
    }
    // ---- cobweb (top-left)
    pen(NF, FL);
    const wc = [0, 12];
    const rays = [[22, 12], [20, 20], [14, 28], [6, 32], [0, 34]];
    for (const r of rays) line(wc[0], wc[1], r[0], r[1], 6);
    for (let k = 1; k <= 3; k++) {
      const f = k / 3.4;
      for (let i = 0; i + 1 < rays.length; i++) {
        const a = rays[i], b = rays[i + 1];
        const ax = wc[0] + (a[0] - wc[0]) * f, ay = wc[1] + (a[1] - wc[1]) * f;
        const bx = wc[0] + (b[0] - wc[0]) * f, by = wc[1] + (b[1] - wc[1]) * f;
        const mx = (ax + bx) / 2 - 1, my = (ay + by) / 2 - 1;
        line(ax, ay, mx, my, 6); line(mx, my, bx, by, 6);
      }
    }
    // ---- window with moon and tree (glass baked emissive)
    pen(NE, FL);
    for (let y = 29; y < 94; y++) for (let x = 176; x < 205; x++) {
      const b = bay(x, y);
      let c = y < 45 ? 2 : y < 66 ? (b < (y - 45) / 21 ? 3 : 2) : 3;
      const dm = Math.hypot(x + 0.5 - 193, y + 0.5 - 72);
      if (dm < 14) c = dm < 10 ? 5 : (b < (14 - dm) / 4 ? 5 : 4);
      if (ih(x, y, 21) < 0.018 && dm > 11) c = 7;
      put(x, y, c);
    }
    ell(193, 72, 7.2, 7.2, 8); ell(194, 71, 5.6, 5.6, 9);
    put(190, 72, 8); put(191, 73, 8); put(195, 75, 8); put(196, 69, 8); put(192, 68, 8);
    // distant rooftops with one lit window and a tiny pumpkin
    poly([[176, 86], [183, 80], [190, 86], [190, 94], [176, 94]], 1); rect(186, 80, 2, 4, 1);
    poly([[195, 88], [200, 84], [205, 88], [205, 94], [195, 94]], 1);
    rect(180, 87, 2, 2, 17); put(198, 90, 16); put(199, 90, 16);
    // bare tree
    const tl = (x0, y0, x1, y1) => line(x0, y0, x1, y1, 0);
    rect(178, 60, 3, 34, 0); tl(180, 70, 186, 63); tl(186, 63, 192, 61); tl(192, 61, 199, 63); tl(186, 63, 189, 55);
    tl(189, 55, 188, 47); tl(189, 55, 195, 50); tl(180, 62, 177, 50); tl(177, 50, 179, 40); tl(179, 40, 183, 33);
    tl(178, 54, 184, 46); tl(184, 46, 186, 40); tl(192, 61, 196, 57); tl(199, 63, 203, 66); tl(195, 50, 200, 46);
    put(181, 70, 0); put(181, 71, 0); put(179, 59, 0);
    pen(NF, FL);
    rect(173, 26, 35, 3, 21); rect(173, 26, 3, 72, 21); rect(205, 26, 3, 72, 21);
    vl(190, 29, 93, 21); hl(176, 204, 61, 21); vl(191, 29, 93, 20); hl(176, 204, 62, 20);
    hl(173, 207, 26, 22);
    rect(171, 94, 39, 2, 22); rect(172, 96, 37, 3, 21); hl(172, 207, 99, 19);
    // curtains
    const curt = (x0, x1, side) => {
      for (let y = 20; y < 104; y++) {
        const pinch = y > 62 && y < 74 ? 3 : y > 54 && y < 82 ? 1 : 0;
        for (let x = x0; x <= x1; x++) {
          const local = side < 0 ? x - x0 : x1 - x;
          const w = x1 - x0;
          if (local > w - pinch * 2 && y > 50 && y < 90) continue;
          const f = (x * 3 + (y >> 4)) % 5;
          let c = f === 0 ? 13 : f === 3 ? 22 : f === 4 ? 20 : 28;
          if (y > 100 && ((x + y) & 1)) c = 13;
          put(x, y, c);
        }
      }
      for (let x = x0; x <= x1; x++) { put(x, 67, 16); put(x, 68, 15); }
    };
    curt(164, 174, -1); curt(206, 215, 1);
    hl(162, 215, 19, 7); hl(162, 215, 20, 6); put(162, 19, 8); put(162, 20, 8);
    // ---- cabinet (low console)
    pen(NU, 158, 30);
    for (let y = 116; y < 128; y++) for (let x = 62; x < 159; x++) put(x, y, (ih(x >> 3, y, 31) < 0.15) ? 20 : 21);
    hl(62, 158, 127, 22);
    pen(NF, 158);
    for (let y = 128; y < 153; y++) for (let x = 62; x < 159; x++) {
      let c = 20;
      if (ih(x >> 2, y, 33) < 0.08) c = 19;
      put(x, y, c);
    }
    // doors
    const door = (x0, x1) => {
      rect(x0, 131, x1 - x0, 19, 19); rect(x0 + 1, 132, x1 - x0 - 2, 17, 20);
      hl(x0 + 1, x1 - 2, 132, 21); vl(x1 - 1, 131, 149, 21);
      put(x1 - 4, 140, 22); put(x1 - 4, 141, 22); put(x1 - 5, 140, 21);
    };
    door(65, 100); door(121, 156);
    rect(101, 131, 19, 19, 12); hl(101, 119, 131, 19);
    // tapes in the cubby
    const tp = [[26, 9], [29, 0], [16, 9], [28, 8]];
    for (let k = 0; k < 4; k++) { rect(103, 146 - k * 4, 15, 3, tp[k][0]); rect(107, 147 - k * 4, 6, 1, tp[k][1]); }
    rect(62, 153, 97, 1, 19);
    pen(NF, 158);
    rect(64, 153, 3, 5, 19); rect(154, 153, 3, 5, 19); put(64, 153, 21); put(154, 153, 21);
    // ---- the TV
    pen(NU, 157, 80);
    for (let y = 71; y < 77; y++) for (let x = 78 + (y < 73 ? 2 : 0); x < 143 - (y < 73 ? 2 : 0); x++) put(x, y, y < 73 ? 21 : y === 76 ? 22 : 21);
    rect(88, 67, 42, 4, 20); hl(90, 127, 66, 21); hl(88, 129, 70, 19);
    pen(NF, 157);
    for (let y = 77; y < 127; y++) for (let x = 76; x < 145; x++) {
      if ((y === 77 || y === 126) && (x < 78 || x > 142)) continue;
      if ((y === 78 || y === 125) && (x < 77 || x > 143)) continue;
      let c = 20;
      if (ih(x, y >> 1, 41) < 0.08) c = 21;
      if (ih(x, y >> 1, 43) < 0.06) c = 19;
      put(x, y, c);
    }
    hl(78, 142, 77, 22); vl(76, 79, 124, 21); vl(144, 79, 124, 19); hl(78, 142, 126, 19);
    // bezel
    for (let y = 79; y < 123; y++) for (let x = 79; x < 134; x++) {
      const ex = x < 82 ? 82 - x : x > 130 ? x - 130 : 0, ey = y < 82 ? 82 - y : y > 119 ? y - 119 : 0;
      if (ex * ex + ey * ey > 12) continue;
      let c = 4;
      if (y < 81 || x < 81) c = 6;
      if (y > 120 || x > 131) c = 3;
      put(x, y, c);
    }
    // control panel
    rect(135, 81, 8, 41, 19); vl(135, 81, 121, 20);
    const knob = (cx, cy) => { ell(cx, cy, 3, 3, 4); ell(cx - 0.4, cy - 0.4, 2.2, 2.2, 6); put(fl(cx) - 1, fl(cy) - 2, 8); put(fl(cx), fl(cy) - 2, 7); vl(fl(cx), fl(cy) - 1, fl(cy) + 1, 1); };
    knob(139, 87); knob(139, 97);
    for (let y = 104; y < 119; y += 2) hl(137, 141, y, 1);
    rect(100, 121, 14, 2, 6); put(101, 121, 8);
    pen(NE, 157); put(140, 120, 26);
    pen(NF, 157);
    rect(79, 127, 4, 2, 1); rect(138, 127, 4, 2, 1);
    // antennas
    pen(NF, 157);
    rect(107, 63, 7, 3, 6); hl(108, 112, 62, 7); hl(107, 113, 65, 4);
    pen(NR, 157); line(109, 62, 93, 36, 6); line(112, 62, 131, 40, 6); pen(NF, 157); line(110, 62, 94, 36, 4);
    rect(92, 34, 2, 2, 8); rect(131, 38, 2, 2, 8);
    put(122, 51, 8); put(123, 51, 9); put(122, 52, 7); put(123, 50, 8); put(124, 52, 8); // tinfoil
    // ---- jack-o'-lantern body (face drawn live)
    pen(NF, 152);
    ell(70.5, 117.5, 7.5, 5.8, 16, (x, y, u, v) => (Math.abs(u) > 0.78 ? 15 : (fl(x) === 66 || fl(x) === 70 || fl(x) === 74) && Math.abs(v) < 0.8 ? 15 : (v < -0.55 && u < 0.1 ? 17 : 16)));
    rect(70, 110, 2, 3, 24); put(72, 110, 25); put(73, 111, 25);
    hl(65, 76, 123, 12);
    // ---- tapes stack and remote on the cabinet top
    pen(NF, 150);
    rect(147, 117, 11, 3, 1); rect(149, 118, 6, 1, 9);
    rect(146, 114, 11, 3, 28); rect(148, 115, 6, 1, 18);
    rect(148, 111, 10, 3, 26); rect(150, 112, 5, 1, 9);
    pen(NU, 158, 30);
    rect(122, 124, 8, 2, 1); put(124, 124, 26); put(127, 124, 4);
    // ---- outlet, plug and cable
    pen(NF, FL);
    rect(160, 126, 5, 7, 7); put(161, 128, 1); put(163, 128, 1); put(161, 130, 1); put(163, 130, 1);
    rect(161, 129, 3, 3, 2);
    line(162, 132, 162, 142, 1); line(162, 142, 160, 146, 1);
    pen(NU, 150, 0); line(160, 146, 157, 152, 1);
    // ---- moon patch on the floor
    for (let y = FL; y < AH; y++) for (let x = 0; x < AW; x++) {
      const Z = 2 * (y - FL);
      let acc = 0;
      for (let sy = 0; sy < 2; sy++) for (let sx = 0; sx < 2; sx++) {
        const Xs = x + 0.25 + sx * 0.5, Zs = Z + sy;
        const s = Zs / 0.9, Xw = Xs + 0.5 * s, Hw = s;
        const wy = FL - Hw;
        if (Xw > 176 && Xw < 205 && wy > 30 && wy < 93 && !(Math.abs(Xw - 190.5) < 1.2) && !(Math.abs(wy - 61.5) < 1.2)) acc += 0.25;
      }
      MOON[y * AW + x] = acc;
    }
    // ---- bed (front-left)
    pen(NU, 264, 26);
    for (let y = 200; y < 238; y++) for (let x = 0; x < 60; x++) {
      if (x > 56 - (y < 204 ? (204 - y) : 0) && y < 204) continue;
      const qx = fl(x / 9), qy = fl((y - 200) / 6);
      const cols = [28, 13, 24, 15, 5, 26];
      let c = cols[(qx * 2 + qy * 3 + (qy & 1)) % cols.length];
      if (x % 9 === 0 || (y - 200) % 6 === 0) c = (x + y) & 1 ? 22 : DARK[c];
      put(x, y, c);
    }
    // pillow
    for (let y = 201; y < 214; y++) for (let x = 0; x < 15; x++) {
      const u = (x - 5) / 10, v = (y - 207) / 6.5; if (u * u + v * v > 1) continue;
      put(x, y, v < -0.3 ? 9 : u > 0.5 || v > 0.5 ? 7 : 8);
    }
    // plush bat on the bed
    ell(34, 214, 3, 2.5, 2); poly([[31, 213], [24, 210], [26, 215], [31, 216]], 4); poly([[37, 213], [44, 210], [42, 215], [37, 216]], 4);
    put(33, 213, 26); put(35, 213, 26); put(32, 211, 2); put(36, 211, 2);
    // comic
    rect(44, 224, 9, 6, 7); rect(45, 225, 4, 4, 26); hl(49, 52, 226, 1);
    pen(NF, 264);
    for (let y = 238; y < 254; y++) for (let x = 0; x < 60; x++) {
      const scal = Math.round(Math.sin(x * 0.55) * 1.2);
      if (y > 251 + scal) continue;
      if (x > 57 && y > 240) continue;
      const qx = fl(x / 9);
      const cols = [13, 28, 15, 24, 26, 5, 13];
      let c = DARK[cols[qx % cols.length]];
      if (y === 238) c = 22;
      if (x % 9 === 0) c = 19;
      if (y > 249 + scal) c = DARK[c];
      put(x, y, c);
    }
    for (let y = 250; y < 264; y++) for (let x = 0; x < 58; x++) if (!BS.c[y * AW + x] || BS.g[y * AW + x] < 264 || y > 253) {
      const scal = Math.round(Math.sin(x * 0.55) * 1.2);
      if (y <= 251 + scal) continue;
      put(x, y, 0);
    }
    rect(3, 252, 3, 12, 19); rect(53, 252, 3, 12, 19); put(3, 252, 20); put(53, 252, 20);
    put(40, 262, 26); put(41, 262, 26); put(42, 261, 26); // lost sock
    // ---- wardrobe body (front-right)
    pen(NU, 261, 100);
    for (let y = 146; y < 161; y++) for (let x = 176; x < AW; x++) put(x, y, y < 148 ? 22 : 21);
    pen(NF, 261);
    for (let y = 161; y < 262; y++) for (let x = 176; x < AW; x++) {
      let c = 21;
      if (x < 179) c = x === 176 ? 22 : 20;
      if (y < 165) c = y === 161 ? 22 : y === 164 ? 20 : 21;
      if (y > 254) c = y === 255 ? 22 : 20;
      put(x, y, c);
    }
    rect(181, 166, 33, 88, 0); // interior shown when door opens
    // ---- cat bed
    for (let y = 186; y < 198; y++) for (let x = 150; x < 180; x++) {
      const u = (x + 0.5 - 165) / 13.5, v = (y + 0.5 - 192) / 5.2; if (u * u + v * v > 1) continue;
      const inner = ((x + 0.5 - 165) / 9.5) ** 2 + ((y + 0.5 - 191.2) / 3.2) ** 2 < 1;
      if (inner) { pen(NU, 197, 3); put(x, y, (x + y) & 1 ? 26 : 13); }
      else { pen(v < 0 ? NU : NF, 197, v < 0 ? 4 : -1); put(x, y, v < -0.5 ? 27 : v > 0.5 ? 13 : 26); }
    }
    pen(NU, 200, 0);
    rect(181, 197, 4, 2, 10); put(180, 198, 10); put(185, 196, 10); put(185, 199, 10); put(182, 197, 0); // fish toy
    // building blocks and a toy car by the cabinet
    pen(NF, 166); rect(48, 159, 5, 5, 16); put(49, 160, 17); put(50, 161, 13); rect(53, 160, 4, 4, 11); put(54, 161, 10);
    pen(NU, 166, 5); hl(48, 52, 158, 17); hl(53, 56, 159, 10);
    pen(NF, 163); rect(50, 154, 4, 4, 28); put(51, 155, 27); pen(NU, 163, 9); hl(50, 53, 153, 27);
    pen(NF, 214); rect(166, 209, 8, 3, 26); rect(168, 207, 4, 2, 26); put(169, 207, 10); put(170, 207, 10); put(167, 212, 0); put(172, 212, 0); put(173, 210, 17);
    // candy wrappers (positions, used live)
    WRAP = [];
    const wcols = [26, 29, 17, 27, 25, 10, 16, 28];
    const spots = [[128, 236], [144, 220], [96, 246], [150, 236], [122, 248], [160, 228], [86, 240], [140, 244], [134, 212], [102, 250]];
    for (let k = 0; k < spots.length; k++) WRAP.push({ x: spots[k][0] + fl(R() * 5) - 2, y: spots[k][1] + fl(R() * 3) - 1, c: wcols[fl(R() * wcols.length)], f: R() < 0.5 });
  }

  /* ================================================================ sprites */
  // --- cat (hand-placed). k body, m mid, l light, e eyes, n nose, h hat, b hat band, w whisker/chin
  const CAT_SIT = [
    '.......h.....',
    '......hh.....',
    '......hhh....',
    '.....hhhh....',
    '..k..hhhhh.k.',
    '..kkbbbbbbkk.',
    '.hhhhhhhhhhhh',
    '..kkkkkkkkkk.',
    '..kkekkkkekk.',
    '..kkkwnwkkkk.',
    '...kkwwwkkk..',
    '....kwwwkk...',
    '...kkwwwkkk..',
    '..kkwwwwkkkk.',
    '..kmkwwkkkkk.k',
    '..kmkwwkkkkkkk',
    '..ww.ww..kkk..',
  ];
  const CAT_SLEEP = [
    '....h...........',
    '...hhh..........',
    '..hhhh..........',
    '.bbbbbb.........',
    'hhhhhhhh........',
    '.kkkkkk..kkkkk..',
    'kkmmkkkkkkkkkkk.',
    'kwwwkkkkkkkkkkkk',
    'wwwkkkkkkkkkkkkk',
    '.wwwkkkkkkkkkww.',
  ];
  const CAT_WALK = [[
    '............h...',
    '...........hh...',
    '..........hhh...',
    '..........bbbb..',
    'k........hhhhhhh',
    '.k.......kkkkkk.',
    '.k.......kekkek.',
    '..kkkkkkkkkkkkk.',
    '..kkkkkkkkkwwn..',
    '..kmmkkkkkkww...',
    '..k.k.....w.w...',
    '.w...w...w...w..',
  ], [
    '............h...',
    '...........hh...',
    '..........hhh...',
    '..........bbbb..',
    '.........hhhhhhh',
    'kk.......kkkkkk.',
    '..k......kekkek.',
    '..kkkkkkkkkkkkk.',
    '..kkkkkkkkkwwn..',
    '..kmmkkkkkkww...',
    '...kk.....ww....',
    '...w.w...w.w....',
  ]];
  function catMap(eyes) {
    return { k: [CAT.k, NS], m: [CAT.m, NS], l: [CAT.l, NS], e: [eyes === undefined ? 25 : eyes, NY], n: [27, NS], w: [CAT.w, NS], h: [28, NS], b: [17, NS] };
  }
  // --- jack-o'-lantern faces (emissive, 13 wide, placed over the body)
  const JF = {
    smile: ['..ab.....ba..', '.aaab...baaa.', '.............', '..a.......a..', '..aaabaaaa...', '....aaaab....'],
    oh: ['..aa.....aa..', '.aaaa...aaaa.', '.............', '.....aaa.....', '....aaaaa....', '.....aaa.....'],
    worry: ['.aa.....aa...', '.aab...aab...', '.............', '..aaaaaaa....', '..a.a.a.a....', '.............'],
    side: ['ab......ab...', 'aa......aa...', '.............', '...aaaaaa....', '..a......a...', '.............'],
    scared: ['..aaa...aaa..', '..aba...aba..', '..aaa...aaa..', '.............', '...a.a.a.a...', '....a.a.a....'],
    grin: ['.aa.......aa.', '.aab.....baa.', '.............', '.aaaaaaaaaaa.', '..aa.aaa.aa..', '....aaaaa....'],
    wink: ['.aa..........', '.aab.....aaa.', '.............', '.aaaaaaaaaaa.', '..aa.aaa.aa..', '....aaaaa....'],
  };
  // --- teddy (back / front) and chair
  const TEDDY_B = [
    '.oo....oo.',
    'oaao..oaao',
    '.oaaaaaao.',
    '.aaaaaaaa.',
    '.aaaaaaaa.',
    '..aaaaaa..',
    '.aaaaaaaa.',
    'aaaaaaaaaa',
    'aaaabbaaaa',
    '.aaaaaaaa.',
    '.aa....aa.',
  ];
  const TEDDY_F = [
    '.oo....oo.',
    'obao..obao',
    '.oaaaaaao.',
    '.aeaaaaea.',
    '.aaabbaaa.',
    '..abeeba..',
    '.aaabbaaa.',
    'aaaaaaaaaa',
    'aabbbbbbaa',
    '.abbbbbba.',
    '.bb....bb.',
  ];

  /* --- the kid in a bedsheet ghost, seen from behind (procedural profile, hand-tuned shading) */
  function drawKid(k) {
    const L = LK; clr(L); TG = L; PN = NS;
    const cx = 20 + (k.dx || 0), by = 40 - (k.hop || 0);
    const sq = k.squash || 0;
    const yT = by - 34 + sq;
    const hx = cx + (k.hdx || 0), hyc = yT + 8.4 + (k.bob || 0) + (k.hdy || 0);
    const tilt = k.tilt || 0;
    // body drape: round shoulders, straight fall, flared over the crossed knees
    for (let y = yT + 13; y <= by; y++) {
      const s = y - yT - 15 + sq * 0.5;
      const hw = s < 0 ? 5 : s < 6 ? 5.4 + 6 * Math.sin((s / 6) * Math.PI / 2) : s < 13 ? 11.4 + (s - 6) * 0.1 : 12.1 + Math.pow(s - 13, 1.5) * 0.3;
      const c = cx + (s < 8 ? tilt * (1 - Math.max(0, s) / 8) : 0);
      const x0 = Math.round(c - hw), x1 = Math.round(c + hw);
      for (let x = x0; x <= x1; x++) {
        const nx = (x + 0.5 - c) / hw;
        let col = 7;
        if (Math.abs(nx) > 0.8) col = 8;
        if (nx < -0.9 && s > 6) col = 6;
        if (y >= by - 1) col = 6;
        put(x, y, col);
      }
    }
    // hem scallops + feet
    for (let x = cx - 18; x <= cx + 18; x++) {
      const w = (x - cx + 60) % 5;
      if (w === 0 && get(x, by)) { TG.c[by * TG.w + x] = 0; }
    }
    // folds: dark line with a lit edge beside it
    for (let y = yT + 19; y < by - 1; y++) {
      const s = y - yT - 19;
      const folds = [cx - 4 - s * 0.38, cx + 1 + s * 0.06, cx + 5 + s * 0.42];
      for (let f = 0; f < folds.length; f++) {
        if (f === 1 && s < 6) continue;
        const fx = Math.round(folds[f]);
        if (get(fx, y)) put(fx, y, 6);
        if (get(fx + 1, y) && s > 2) put(fx + 1, y, 8);
      }
    }
    // head dome
    ell(hx, hyc, 8.4, 8.2, 7, (x, y, u, v) => (v < -0.62 || (u > 0.7 && v < 0.35) ? 8 : u < -0.75 && v > -0.25 ? 6 : 7));
    // crease where the sheet falls from the head onto the shoulders
    for (let x = hx - 6; x <= hx + 6; x++) { const yy = Math.round(hyc + 7.6 - Math.abs(x - hx) * 0.2); put(x, yy, 6); }
    put(hx - 7, hyc + 6, 6); put(hx + 7, hyc + 6, 6); put(hx - 8, hyc + 5, 6);
    // it is a real bedsheet: a faded print of little stars
    for (let y = yT + 2; y < by - 1; y += 4) for (let x = cx - 16 + ((y >> 2) & 1) * 3; x < cx + 17; x += 6) {
      if (get(x, y) - 1 === 7 && get(x + 1, y) && get(x - 1, y) && get(x, y - 1) && get(x, y + 1)) put(x, y, 10);
    }
    // eye holes (appear as the head turns over the left shoulder)
    const turn = k.turn || 0;
    if (turn > 0.02) {
      const tf = Math.PI - turn * 2.55;
      for (const off of [-0.38, 0.38]) {
        const th = tf + off, cs = Math.cos(th);
        if (cs < 0.12) continue;
        const ex = hx - 7 * Math.sin(th), ey = hyc + 0.5 - (k.look || 0);
        const wdt = cs > 0.55 ? 2 : 1;
        PN = NE;
        for (let j = 0; j < 3; j++) for (let i = 0; i < wdt; i++) {
          if (wdt === 2 && (j === 0 || j === 2) && i === (off < 0 ? 0 : 1) && cs < 0.85) continue;
          put(Math.round(ex - wdt / 2 + i), Math.round(ey - 1 + j), 0);
        }
        PN = NS;
      }
      if (turn > 0.5) { const fx = Math.round(hx - 6 * Math.sin(tf)); put(fx, Math.round(hyc + 3), 8); put(fx + 1, Math.round(hyc + 3), 8); }
    }
    // sneaker soles peeking out under the hem (cross-legged)
    PN = NS;
    put(cx + 15, by - 1, 26); put(cx + 16, by - 1, 26); put(cx + 17, by - 1, 9); put(cx + 16, by, 26); put(cx + 15, by, 1);
    put(cx - 16, by - 1, 26); put(cx - 17, by - 1, 26); put(cx - 18, by - 1, 9); put(cx - 17, by, 26); put(cx - 16, by, 1);
    // reaching hand into the candy bowl
    if (k.reach > 0) {
      const n = Math.round(k.reach * 6);
      for (let i = 0; i < n; i++) { put(cx + 12 + i, by - 9 + (i >> 1), 28); put(cx + 12 + i, by - 8 + (i >> 1), 28); }
      const hx2 = cx + 12 + n, hy2 = by - 9 + (n >> 1);
      put(hx2, hy2, 30); put(hx2 + 1, hy2, 30); put(hx2, hy2 + 1, 31); put(hx2 + 1, hy2 + 1, 30);
      if (k.reach > 0.9 && k.candy) { put(hx2 + 1, hy2 - 1, 26); put(hx2 + 2, hy2 - 1, 27); }
    }
    // arms up (yay!)
    if (k.yay) {
      for (const s of [-1, 1]) {
        const ax = cx + s * 11, ay = yT + 14;
        put(ax, ay, 28); put(ax, ay - 1, 28); put(ax + s, ay - 2, 28); put(ax + s, ay - 3, 30); put(ax + s * 2, ay - 4, 30); put(ax + s, ay - 4, 30);
      }
    }
    // holding a mug of cocoa in both hands
    if (k.mug) {
      const mx = hx - 10 + (k.sip ? 3 : 0), my = yT + 12 - (k.sip ? 4 : 0);
      rect(mx, my, 5, 5, 26); hl(mx, mx + 4, my, 9); hl(mx + 1, mx + 3, my, 13); put(mx + 1, my + 2, 27);
      put(mx - 1, my + 1, 26); put(mx - 2, my + 2, 26); put(mx - 1, my + 3, 26);
      put(mx + 4, my + 3, 30); put(mx + 5, my + 3, 30); put(mx + 4, my + 4, 31); put(mx + 5, my + 2, 30);
      PN = NST;
      const ph = fl((k.t || 0) * 4);
      put(mx + 1 + (ph & 1), my - 2, 8); put(mx + 3 - (ph & 1), my - 4, 8); put(mx + 2, my - 5 - (ph % 3 === 0 ? 1 : 0), 8);
      PN = NS;
    }
    finish(L, 0, -1, 1);
    return L;
  }

  /* --- the parent in a homemade monster suit (procedural rig, every shape snapped to the grid) */
  function drawParent(p) {
    const L = LP; clr(L); TG = L; PN = NS;
    const pose = p.pose, back = !!p.back, sit = pose === 'sit', walk = pose === 'walk';
    let ux = 0, uy = 0;
    if (pose === 'lean') { ux = 5; uy = 6; }
    if (pose === 'crouch') { ux = 2; uy = 13; }
    if (sit) { ux = 0; uy = 27; }
    if (walk && (p.wf & 1)) uy -= 1;
    const G = 24;
    // ----- tail (behind everything)
    {
      const sway = walk ? [0, 2, 0, -2][p.wf & 3] : 0;
      let pts = back ? [[31, 76 + uy * 0.5], [32 + sway, 86], [34 + sway * 2, 94], [39 + sway, 98]] : [[20, 76 + uy * 0.4], [13, 86], [8, 94], [3, 98]];
      if (sit) pts = [[16, 88], [9, 94], [5, 98], [1, 99]];
      for (let i = 0; i + 1 < pts.length; i++) {
        const a = pts[i], b = pts[i + 1];
        for (let s = 0; s <= 8; s++) { const r = i === 0 ? 2.6 : i === 1 ? 2.1 : 1.5; ell(lerp(a[0], b[0], s / 8), lerp(a[1], b[1], s / 8), r, r, G); }
      }
      const tp = pts[pts.length - 1]; ell(tp[0], tp[1] - 0.5, 2.4, 1.8, 28); put(fl(tp[0]), fl(tp[1]) - 2, 27);
    }
    // ----- legs and slippers
    const foot = (x, y, f) => {
      ell(x, y, 6, 3, 25, (xx, yy, u, v) => (v > 0.4 ? 24 : 25));
      const tx = f > 0 ? x + 5 : x - 6;
      put(tx, y - 1, 9); put(tx + f, y, 9); put(tx, y + 1, 9);
      put(x - f, y - 2, 9); put(x - f, y - 1, 0);
    };
    if (sit) {
      ell(31, 92, 20, 7, G);
      foot(9, 97, -1); foot(53, 97, 1);
    } else if (walk) {
      const wf = p.wf & 3, a = wf === 0 ? 2 : wf === 2 ? -2 : 0;
      rect(22 - a, 78, 8, 16, G); rect(33 + a, 78, 8, 16, G);
      foot(26 - a, 96 + (a > 0 ? 1 : 0), -1); foot(37 + a, 96 + (a < 0 ? 1 : 0), 1);
    } else if (pose === 'crouch') {
      ell(31, 90, 17, 8, G);
      foot(20, 97, 1); foot(40, 98, 1);
    } else {
      rect(22, 78, 8, 16, G); rect(33, 78, 8, 16, G);
      foot(26, 96, 1); foot(38, 97, 1);
    }
    // ----- torso
    let T = [[23 + ux, 35 + uy], [39 + ux, 35 + uy], [45 + ux, 39 + uy], [48 + ux * 0.7, 50 + uy * 0.7], [50 + ux * 0.4, 63 + uy * 0.4], [48, 75], [45, 81], [18, 81], [15, 72], [14 + ux * 0.4, 58 + uy * 0.5], [16 + ux, 41 + uy]];
    if (sit) T = [[22, 62], [40, 62], [46, 67], [49, 80], [50, 91], [12, 91], [13, 80], [16, 67]];
    if (pose === 'crouch') T = [[24, 48], [42, 48], [47, 53], [49, 70], [47, 88], [15, 88], [14, 70], [18, 53]];
    poly(T, G);
    // ----- arms
    const sleeve = (x0, y0, x1, y1, r) => { for (let s = 0; s <= 12; s++) ell(lerp(x0, x1, s / 12), lerp(y0, y1, s / 12), r || 3.2, r || 3.2, G); };
    const ext = pose === 'lean' ? 3 : 0;
    if (!back && !sit && pose !== 'crouch') {
      sleeve(44 + ux, 41 + uy, 51 + ux + ext, 50 + uy);
    } else if (sit) {
      sleeve(43, 66, 46, 76);
      if (p.arm) sleeve(44, 64, 58, 58, 2.8);
    } else if (pose === 'crouch') {
      sleeve(44, 54, 50, 62);
    } else {
      sleeve(18, 40 + uy, 15, 56 + uy); sleeve(44, 40 + uy, 47, 56 + uy);
    }
    // ----- hood
    const hx = 31 + ux, hy = 25 + uy;
    ell(hx, hy, 11.5, 11.5, G);
    // ----- shading pass over the green suit: back side in shadow, lit top edges
    for (let y = 0; y < L.h; y++) for (let x = 0; x < L.w; x++) {
      if (get(x, y) - 1 !== G) continue;
      let col = G;
      if (!back) { for (let kk = 1; kk <= 3; kk++) if (!get(x - kk, y)) { col = 23; break; } }
      else if (!get(x - 1, y) || !get(x + 1, y) || !get(x - 2, y)) col = 23;
      if (!get(x, y - 1) || (!back && !get(x + 1, y) && get(x, y + 1))) col = 25;
      put(x, y, col);
    }
    // far arm crosses in front of the body (drawn after the pass, its own shading)
    if (!back && !sit && pose !== 'crouch') {
      for (let s = 0; s <= 12; s++) ell(lerp(20 + ux, 42 + ux + ext, s / 12), lerp(44 + uy, 55 + uy, s / 12), 3.1, 3.1, 0, (x, y, u, v) => (v < -0.5 ? 25 : v > 0.55 ? 23 : 24));
    }
    // ----- belly patch with big homemade stitches
    if (!back) {
      const bx = sit ? 34 : 34 + ux * 0.5, byy = sit ? 79 : 63 + uy * 0.5, rx = sit ? 9 : 7.5, ry = sit ? 7 : 10;
      ell(bx, byy, rx, ry, 25, (x, y, u, v) => (u < -0.6 || v > 0.7 ? 24 : 25));
      for (let a = 0; a < 18; a++) { const th = a / 18 * TAU; if (a & 1) put(bx + Math.cos(th) * (rx + 0.4), byy + Math.sin(th) * (ry + 0.4), 9); }
    }
    // ----- felt spikes
    const sp = back ? [42, 51, 60, 69] : sit ? [66, 74] : pose === 'crouch' ? [52, 61, 70] : [43, 51, 59, 67];
    for (const sy0 of sp) {
      const sy = sy0 + (back || sit || pose === 'crouch' ? 0 : Math.round(uy * (1 - (sy0 - 35) / 50)));
      if (back) { poly([[27, sy + 6], [35, sy + 6], [31, sy - 1]], 28); put(31, sy + 1, 27); put(30, sy + 3, 27); }
      else {
        const ex = (sit ? 13 : pose === 'crouch' ? 15 : 16 + Math.round(ux * 0.5 * (1 - (sy0 - 35) / 50)));
        poly([[ex + 1, sy - 1], [ex + 1, sy + 7], [ex - 6, sy + 2]], 28); put(ex - 4, sy + 2, 27); put(ex - 3, sy + 2, 27); put(ex - 2, sy + 1, 27);
      }
    }
    // ----- mugs, hands
    const mug = (mx, my, col) => {
      mx = Math.round(mx); my = Math.round(my);
      rect(mx, my, 6, 6, col); hl(mx, mx + 5, my, 9); hl(mx + 1, mx + 4, my, 13); put(mx + 1, my + 2, LITE[col]); put(mx + 1, my + 3, LITE[col]);
      put(mx + 6, my + 1, col); put(mx + 7, my + 2, col); put(mx + 7, my + 3, col); put(mx + 6, my + 4, col);
      hl(mx, mx + 5, my + 5, DARK[col]);
      PN = NST; const ph = fl(p.t * 4 + mx * 0.3);
      put(mx + 1 + (ph & 1), my - 2, 8); put(mx + 3 - (ph & 1), my - 3, 8); put(mx + 2 + (ph & 1), my - 5, 8); if (ph % 3) put(mx + 3, my - 7, 8);
      PN = NS;
    };
    const hand = (x, y) => { x = Math.round(x); y = Math.round(y); rect(x, y, 3, 3, 30); put(x, y + 2, 31); put(x + 2, y + 2, 31); };
    if (!back && !sit && pose !== 'crouch') {
      if (p.mugs >= 1) mug(49 + ux + ext, 43 + uy, 26);
      if (p.mugs >= 2) mug(40 + ux + ext, 49 + uy, 29);
      hand(48 + ux + ext, 47 + uy); hand(39 + ux + ext, 53 + uy);
      if (p.remote) { rect(43 + ux, 50 + uy, 5, 2, 1); PN = NE; put(48 + ux, 50 + uy, p.remote > 1 ? 26 : 13); PN = NS; }
    } else if (sit) {
      if (p.mugs >= 1) mug(39, p.sip ? 60 : 66, 29);
      hand(37, (p.sip ? 64 : 70)); hand(44, (p.sip ? 64 : 70));
      if (p.arm) hand(57, 56);
    } else if (pose === 'crouch') {
      if (p.mugs >= 1) mug(48, 56, 29);
      if (p.mugs >= 2) mug(40, 60, 26);
      hand(47, 60);
    } else {
      PN = NST; const ph = fl(p.t * 4);
      put(48 + (ph & 1), 31 + uy, 8); put(49, 28 + uy, 8); put(48 - (ph & 1), 25 + uy, 8);
      PN = NS;
    }
    // ----- horns (cardboard, one of them bent)
    poly([[hx - 9, hy - 6], [hx - 4, hy - 9], [hx - 9, hy - 15], [hx - 15, hy - 21], [hx - 13, hy - 13]], 15, (x, y) => (x <= hx - 12 && y < hy - 14 ? 17 : x < hx - 8 ? 15 : 14));
    poly([[hx + 4, hy - 9], [hx + 9, hy - 6], [hx + 12, hy - 13], [hx + 16, hy - 15], [hx + 18, hy - 11], [hx + 13, hy - 11]], 15, (x, y) => (y < hy - 12 ? 17 : 15));
    put(hx - 7, hy - 9, 8); put(hx - 6, hy - 8, 8); put(hx - 8, hy - 8, 8); put(hx + 6, hy - 9, 8); put(hx + 7, hy - 8, 8);
    if (!back) {
      // the face peeks out of the monster's mouth
      const fx = hx + 3, fy = hy + 3;
      ell(fx, fy, 7, 7.4, 13);
      ell(fx, fy + 0.4, 5.9, 6.3, 30, (x, y, u) => (u < -0.62 ? 31 : 30));
      for (const tx of [-5, -2, 1, 4]) { put(fx + tx, fy - 7, 9); put(fx + tx + 1, fy - 7, 9); put(fx + tx, fy - 6, 9); }
      for (const tx of [-4, -1, 2]) { put(fx + tx, fy + 7, 9); put(fx + tx + 1, fy + 7, 9); put(fx + tx + 1, fy + 6, 9); }
      // round glasses, raised brows, a big open grin, rosy cheeks
      rect(fx - 5, fy - 2, 4, 4, 1); rect(fx + 1, fy - 2, 4, 4, 1); put(fx - 1, fy - 1, 1); put(fx, fy - 1, 1);
      rect(fx - 4, fy - 1, 2, 2, 8); rect(fx + 2, fy - 1, 2, 2, 8); put(fx - 4, fy - 1, 9); put(fx + 2, fy - 1, 9);
      put(fx - 3, fy, 0); put(fx + 3, fy, 0);
      hl(fx - 5, fx - 2, fy - 4, 20); hl(fx + 1, fx + 4, fy - 4, 20); put(fx - 5, fy - 3, 20);
      put(fx, fy + 2, 31);
      rect(fx - 3, fy + 3, 7, 2, 13); hl(fx - 2, fx + 2, fy + 3, 9); put(fx - 4, fy + 2, 13); put(fx + 4, fy + 2, 13); put(fx, fy + 4, 26); put(fx + 1, fy + 4, 26);
      put(fx - 5, fy + 2, 27); put(fx + 5, fy + 2, 27);
      // googly eyes glued on the hood
      const gl = (ex, ey, kk) => {
        if (p.sil) { PN = NG; put(ex + 1, ey - 1, 9); PN = NS; return; }
        PN = NG; ell(ex, ey, 3.6, 3.6, 9); PN = NS;
        const w = p.t * 6 + kk * 2.3, ox = Math.round(Math.sin(w) * 1.2 + 0.5), oy = Math.round(Math.cos(w * 1.3) * 1.0 + 0.6);
        rect(fl(ex) - 1 + ox, fl(ey) - 1 + oy, 2, 2, 0);
      };
      gl(hx - 5, hy - 7, 0); gl(hx + 4, hy - 8, 1);
    } else {
      for (let y = hy - 10; y < hy + 10; y++) put(hx, y, 23);
    }
    // ----- the cat rides on the shoulder
    if (p.cat) { PN = NS; spr(CAT_SIT, catMap(p.catEyes), hx - 23, hy - 6, false); }
    if (p.flip) flipL(L);
    finish(L, p.lx || 0.2, p.ly || -1, 1);
    return L;
  }

  /* ================================================================ TV programmes (48 x 36) */
  const MON = [
    '.o..........o.',
    'oho........oho',
    'ohoooooooooo.o',
    '.ohmmmmmmmmmho',
    '..ommmmmmmmmo.',
    'oommwwmmmwwmoo',
    'hmmmwpmmmwpmmh',
    'hommmmmmmmmmoh',
    'hommmmmmmmmmoh',
    '.oomowooowommo',
    '..omoooooooomo',
    '..ommmmmmmmmo.',
    '..ommdmmmmdmo.',
    '..ommmmmmmmmo.',
    '...ommo..ommo.',
    '...oo.....oo..',
  ];
  const MON2 = MON.slice(0, 14).concat(['..ommo..ommo..', '..oo......oo..']);
  const MONMAP = { o: 1, h: 7, m: 5, w: 9, p: 0, d: 4 };
  const BAT = [['o.....o', 'oo.o.oo', '.ooooo.', '..o.o..'], ['.......', 'ooooooo', '.oo.oo.', '..o.o..'], ['...o...', '..ooo..', '.ooooo.', 'o.o.o.o']];
  function sbar(c) { for (let i = 0; i < SW * SH; i++) SCR.c[i] = c + 1; }
  function progMovie(lt, fi, second) {
    TG = SCR; PN = NE;
    const weave = ih(fl(fi / 2), 3, 1) < 0.2 ? 1 : 0;
    const flash = second ? (lt > 1.4 && lt < 1.55) || (lt > 1.65 && lt < 1.7) : (lt > 1.8 && lt < 1.95) || (lt > 2.05 && lt < 2.12);
    for (let y = 0; y < SH; y++) for (let x = 0; x < SW; x++) {
      const b = bay(x, y);
      let c = y < 8 ? 2 : y < 18 ? (b < (y - 8) / 10 ? 3 : 2) : 3;
      if (flash) c += 4;
      if (ih(x, y, 5) < 0.02 && y < 20) c = flash ? 9 : 5;
      put(x, y, c);
    }
    // moon
    ell(37.5, 8.5 + weave, 5.2, 5.2, flash ? 9 : 7); ell(38.2, 7.8 + weave, 4, 4, flash ? 9 : 8); put(36, 9 + weave, 6); put(39, 10 + weave, 6);
    if (!second) {
      // hill & castle
      ell(14, 36 + weave, 22, 12, flash ? 3 : 1);
      const cs = flash ? 2 : 0;
      rect(4, 14 + weave, 5, 14, cs); rect(10, 18 + weave, 12, 10, cs); rect(18, 11 + weave, 5, 17, cs);
      poly([[3, 14 + weave], [6.5, 8 + weave], [10, 14 + weave]], cs); poly([[17, 11 + weave], [20.5, 4 + weave], [24, 11 + weave]], cs);
      for (let x = 10; x < 18; x += 2) put(x, 17 + weave, cs);
      const lit = (x, y, k) => { if (ih(k, fl(lt * 3), 9) < 0.9) put(x, y + weave, 6); };
      lit(6, 17, 1); lit(20, 15, 2); lit(14, 21, 3); lit(20, 21, 4); lit(12, 22, 5);
      // ground, tombstones
      for (let y = 28; y < SH; y++) for (let x = 20; x < SW; x++) put(x, y + weave, y === 28 && (x & 3) === 0 ? 3 : 2);
      rect(30, 24 + weave, 3, 5, 4); put(31, 23 + weave, 4); put(30, 24 + weave, 5);
      rect(42, 25 + weave, 3, 4, 4); put(43, 24 + weave, 4);
      // monster walking
      const mx = Math.round(46 - st10(lt) * 6), step = fl(lt * 4) & 1;
      spr(step ? MON2 : MON, MONMAP, mx, 13 + weave + (step ? 1 : 0));
    } else {
      // close-up: the monster lumbers toward the camera, getting bigger
      for (let y = 26; y < SH; y++) for (let x = 0; x < SW; x++) put(x, y, y === 26 ? 3 : 2);
      const sc = 2 + fl(sstep(0, 3.2, lt) * 2);
      const step = fl(lt * 3) & 1;
      const S = step ? MON2 : MON;
      const w = S[0].length * sc, hgt = S.length * sc;
      const ox = Math.round(24 - w / 2), oy = Math.round(30 - hgt + (step ? 1 : 0)) + weave;
      for (let j = 0; j < S.length; j++) for (let i = 0; i < S[j].length; i++) {
        const m = MONMAP[S[j][i]]; if (m === undefined) continue;
        rect(ox + i * sc, oy + j * sc, sc, sc, flash ? Math.min(9, m + 2) : m);
      }
    }
    // bat
    const bx = 50 - ((lt * 11) % 64), byy = 6 + Math.round(Math.sin(lt * 3) * 2);
    spr(BAT[fl(lt * 10) % 3], { o: flash ? 1 : 0 }, Math.round(bx), byy + weave);
    // film dust & scratches
    for (let k = 0; k < 3; k++) if (ih(fi, k, 7) < 0.6) put(fl(ih(fi, k, 8) * SW), fl(ih(fi, k, 9) * SH), ih(fi, k, 10) < 0.5 ? 9 : 0);
    if (ih(fl(fi / 6), 1, 12) < 0.3) { const sx = fl(ih(fl(fi / 6), 2, 13) * SW); for (let y = 0; y < SH; y++) if (ih(fi, y, 14) < 0.7) put(sx, y, 6); }
    if (ih(fl(fi / 3), 4, 15) < 0.15) for (let i = 0; i < SW * SH; i++) SCR.c[i] = Math.max(1, SCR.c[i] - 1);
    return flash;
  }
  function pumpkinChar(cx, cy, lt, sq) {
    const rx = 8 + sq, ry = 6.5 - sq;
    ell(cx, cy, rx, ry, 16, (x, y, u, v) => (Math.abs(u) > 0.82 ? 15 : (Math.abs(fl(x) - cx) === 3 && Math.abs(v) < 0.8) ? 15 : v < -0.55 && u < 0 ? 17 : 16));
    rect(cx - 1, cy - ry - 3, 2, 3, 24); put(cx + 1, cy - ry - 3, 25); put(cx + 2, cy - ry - 4, 25); put(cx + 3, cy - ry - 4, 25);
    rect(cx - 4, cy - 2, 2, 3, 0); rect(cx + 2, cy - 2, 2, 3, 0); put(cx - 4, cy - 2, 9); put(cx + 2, cy - 2, 9);
    hl(cx - 3, cx + 3, cy + 2, 0); put(cx - 4, cy + 1, 0); put(cx + 4, cy + 1, 0); put(cx - 6, cy + 1, 27); put(cx + 6, cy + 1, 27);
  }
  function progPumpkin(lt, fi) {
    TG = SCR; PN = NE;
    const rot = fl(lt * 6) * 0.1;
    for (let y = 0; y < SH; y++) for (let x = 0; x < SW; x++) {
      const a = Math.atan2(y - 18, x - 24) + rot;
      const k = fl(((a / TAU) + 1) * 14) & 1;
      put(x, y, k ? 28 : 13);
    }
    for (let y = 29; y < SH; y++) for (let x = 0; x < SW; x++) put(x, y, y === 29 ? 25 : (x + y) % 5 === 0 ? 23 : 24);
    rect(0, 0, SW, 8, 12);
    text('PUMPKIN', 3, 2, 17, 15); text('PALS', 31, 2, 27, 13);
    // dancing pumpkin
    const beat = (lt * 2.5) % 1, ph = fl(lt * 2.5);
    const hop = beat < 0.5 ? Math.round(Math.sin(beat * 2 * Math.PI) * 5) : 0;
    const sq = beat > 0.5 && beat < 0.65 ? 1 : 0;
    const cx = 20, cy = 21 - hop + sq;
    // legs and arms
    const L1 = ph & 1;
    line(cx - 3, cy + 5, cx - 4 - L1, 29, 0); line(cx + 3, cy + 5, cx + 4 + (1 - L1), 29, 0);
    put(cx - 5 - L1, 29, 26); put(cx - 4 - L1, 29, 26); put(cx + 4 + (1 - L1), 29, 26); put(cx + 5 + (1 - L1), 29, 26);
    if (L1) { line(cx - 8, cy, cx - 11, cy - 5, 0); line(cx + 8, cy, cx + 11, cy + 3, 0); }
    else { line(cx - 8, cy, cx - 11, cy + 3, 0); line(cx + 8, cy, cx + 11, cy - 5, 0); }
    pumpkinChar(cx, cy, lt, sq);
    // ghost pal
    const gx = 38, gy = 16 + Math.round(Math.sin(lt * 3) * 2);
    ell(gx, gy, 4, 4.5, 9); rect(gx - 4, gy, 8, 5, 9);
    for (let x = -4; x < 4; x++) if (((x + fl(lt * 6)) & 1) === 0) put(gx + x, gy + 5, 9);
    put(gx - 2, gy - 1, 0); put(gx + 1, gy - 1, 0); put(gx - 1, gy + 1, 26); put(gx, gy + 1, 26);
    if (fl(lt * 4) & 1) { put(gx + 5, gy - 2, 9); put(gx + 4, gy - 1, 9); } else { put(gx + 5, gy + 1, 9); put(gx + 4, gy + 1, 9); }
    // notes
    for (let k = 0; k < 3; k++) {
      const u = ((lt * 0.8 + k / 3) % 1);
      const nx = 4 + k * 4 + Math.round(Math.sin(u * 6) * 1), ny = 27 - Math.round(u * 18);
      if (ny < 8) continue;
      vl(nx + 1, ny - 3, ny, 27); put(nx, ny, 27); put(nx + 2, ny - 3, 27);
    }
    return false;
  }
  function progHost(lt, fi) {
    TG = SCR; PN = NE;
    for (let y = 0; y < SH; y++) for (let x = 0; x < SW; x++) {
      const f = (x + (y >> 3)) % 6;
      let c = f === 0 ? 12 : f === 1 || f === 5 ? 13 : f === 3 ? 26 : 14;
      const d = Math.hypot(x - 26, (y - 20) * 1.2);
      if (d < 15 && c === 14 && bay(x, y) < (15 - d) / 8) c = 15;
      put(x, y, c);
    }
    for (let x = 0; x < SW; x++) { put(x, 0, 26); put(x, 1, (x % 4) < 2 ? 26 : 14); if (x % 4 === 1) put(x, 2, 17); }
    // candelabra
    vl(7, 18, 30, 15); hl(3, 11, 18, 15); vl(3, 15, 18, 15); vl(11, 15, 18, 15); hl(5, 9, 30, 15); put(7, 17, 17);
    for (const [cx, cy] of [[3, 12], [7, 11], [11, 12]]) {
      rect(cx, cy, 1, 3, 9);
      const f = ih(cx, fl(lt * 12), 3);
      put(cx, cy - 1, 17); if (f < 0.6) put(cx, cy - 2, 18); if (f > 0.7) put(cx + 1, cy - 2, 17);
    }
    // the host: a skeleton in a tux and a top hat
    const hx = 27;
    const talk = ih(fl(lt * 7), 5, 2) < 0.55 && (lt % 2.2) < 1.7;
    const pose = fl(lt / 1.1) % 3;
    poly([[hx - 11, 36], [hx - 9, 22], [hx - 4, 20], [hx + 4, 20], [hx + 9, 22], [hx + 11, 36]], 1);
    poly([[hx - 3, 20], [hx + 3, 20], [hx, 30]], 9);
    line(hx - 3, 20, hx - 1, 28, 3); line(hx + 3, 20, hx + 1, 28, 3);
    put(hx - 2, 21, 26); put(hx - 1, 22, 26); put(hx, 21, 26); put(hx + 1, 22, 26); put(hx + 2, 21, 26); put(hx - 2, 22, 26); put(hx + 2, 22, 26);
    ell(hx, 12, 5.4, 5.2, 8); ell(hx - 1, 11, 3.6, 3.2, 9);
    rect(hx - 3, 10, 2, 3, 0); rect(hx + 1, 10, 2, 3, 0);
    if ((fl(lt * 3) % 7) !== 0) { put(hx - 2, 11, 26); put(hx + 2, 11, 26); }
    put(hx, 14, 1);
    for (let x = hx - 3; x <= hx + 3; x++) put(x, 16, (x & 1) ? 9 : 6);
    const jaw = talk ? 2 : 1;
    rect(hx - 3, 16 + jaw, 7, 2, 8); for (let x = hx - 2; x <= hx + 2; x++) put(x, 16 + jaw, (x & 1) ? 6 : 9);
    if (talk) hl(hx - 2, hx + 2, 17, 0);
    // top hat
    rect(hx - 4, 1, 9, 6, 0); hl(hx - 4, hx + 4, 5, 26); hl(hx - 6, hx + 6, 7, 0); put(hx - 3, 2, 3);
    // gesturing bony hand
    const hands = [[hx + 13, 15], [hx + 12, 24], [hx + 14, 19]];
    const [ax, ay] = hands[pose];
    line(hx + 8, 24, ax, ay + 2, 1); line(hx + 9, 24, ax + 1, ay + 2, 1);
    put(ax, ay, 8); put(ax + 1, ay - 1, 8); put(ax + 2, ay, 8); put(ax - 1, ay - 1, 8); put(ax + 1, ay + 1, 8); put(ax, ay + 1, 8);
    // lower third
    rect(0, 29, SW, 7, 0); hl(0, SW - 1, 29, 26);
    const msg = 'CREATURE FEATURE * TONIGHT: THE BOG THING * STAY UP LATE * ';
    const off = fl(lt * 14) % (msg.length * 4);
    TG.x0 = 0; TG.x1 = SW;
    text(msg + msg, 2 - off, 31, 17);
    return false;
  }
  function progWeather(lt, fi) {
    TG = SCR; PN = NE;
    for (let y = 0; y < SH; y++) for (let x = 0; x < SW; x++) put(x, y, ((x + y * 2 + fl(lt * 2)) % 9 === 0) ? 10 : 11);
    // land
    const land = [[[0, 9], [10, 8], [16, 12], [14, 18], [20, 22], [18, 29], [8, 31], [0, 30]], [[26, 24], [34, 21], [42, 24], [40, 30], [30, 31]]];
    for (const pg of land) poly(pg, 24, (x, y) => (ih(x >> 1, y >> 1, 4) < 0.15 ? 23 : 24));
    for (const pg of land) for (let i = 0; i < pg.length; i++) { const a = pg[i], b = pg[(i + 1) % pg.length]; line(a[0], a[1], b[0], b[1], 25); }
    put(8, 16, 17); put(9, 16, 17); put(34, 26, 17);
    text('13°', 3, 20, 9, 1); text('9°', 31, 27, 9, 1);
    // header
    rect(0, 0, SW, 7, 3); hl(0, SW - 1, 7, 1);
    text('FORECAST', 2, 1, 9, 1);
    // smiling moon
    const mx = 38, my = 15;
    for (let y = my - 9; y <= my + 9; y++) for (let x = mx - 9; x <= mx + 9; x++) { const d = Math.hypot(x + 0.5 - mx, y + 0.5 - my); if (d > 6.5 && d < 9 && bay(x, y) < (9 - d) / 3 && y > 7) put(x, y, 7); }
    ell(mx, my, 6, 6, 8); ell(mx - 0.6, my - 0.6, 5, 5, 9);
    put(mx + 3, my - 3, 7); put(mx + 4, my - 2, 7); put(mx - 4, my + 2, 7); put(mx + 3, my + 3, 7); put(mx + 2, my + 4, 7);
    hl(mx - 3, mx - 2, my - 1, 6); hl(mx + 1, mx + 2, my - 1, 6); put(mx - 2, my + 2, 6); hl(mx - 1, mx + 1, my + 3, 6); put(mx + 2, my + 2, 6);
    put(mx - 4, my + 1, 27); put(mx + 4, my + 1, 27);
    for (const [sx, sy] of [[28, 9], [46, 24], [30, 22]]) if (ih(sx, fl(lt * 3), 4) < 0.7) put(sx, sy, 18);
    // drifting clouds
    for (let k = 0; k < 2; k++) {
      const cx = ((lt * 3 + k * 26) % 60) - 8, cy = 12 + k * 9;
      ell(cx, cy, 4, 2.2, 8); ell(cx + 4, cy - 1, 3.5, 2.6, 9); ell(cx + 7, cy, 3, 2, 8); hl(Math.round(cx - 3), Math.round(cx + 9), Math.round(cy + 2), 7);
    }
    // migrating bats
    for (let k = 0; k < 4; k++) {
      const bx = ((lt * 7 + k * 6) % 56) - 4, byy = 19 + (k & 1) * 3 - k;
      const f = (fl(lt * 8) + k) & 1;
      put(bx, byy, 0); put(bx - 1, byy - f, 0); put(bx + 1, byy - f, 0);
    }
    rect(0, 31, SW, 5, 2); hl(0, SW - 1, 31, 7);
    const msg = 'OCT 31: FULL MOON * CLEAR AND SPOOKY * 100% CHANCE OF CANDY * ';
    const off = fl(lt * 12) % (msg.length * 4);
    text(msg + msg, 2 - off, 31, 17);
    return false;
  }
  function progCard(lt, fi) {
    TG = SCR; PN = NE;
    for (let y = 0; y < SH; y++) for (let x = 0; x < SW; x++) {
      let c = y < 12 ? 12 : y < 24 ? (bay(x, y) < (y - 12) / 12 ? 13 : 12) : 13;
      if (ih(x, y, 50) < 0.03 && y < 26) c = ih(x, fl(lt * 4), 51) < 0.5 ? 17 : 15;
      put(x, y, c);
    }
    const word = 'HAPPY';
    for (let k = 0; k < 5; k++) {
      const app = lt - k * 0.12;
      if (app < 0) continue;
      const g = F4[word[k]];
      const ox = 2 + k * 9, oy = 4 + Math.round(Math.sin(lt * 6 - k * 0.9) * 1.2) - (app < 0.15 ? 2 : 0);
      for (let j = 0; j < 6; j++) for (let i = 0; i < 4; i++) if (g[j][i] === '1') {
        put(ox + i * 2 + 1, oy + j * 2 + 1, 13); put(ox + i * 2 + 2, oy + j * 2 + 1, 13); put(ox + i * 2 + 1, oy + j * 2 + 2, 13); put(ox + i * 2 + 2, oy + j * 2 + 2, 13);
      }
      for (let j = 0; j < 6; j++) for (let i = 0; i < 4; i++) if (g[j][i] === '1') {
        const c = j < 2 ? 17 : 16;
        put(ox + i * 2, oy + j * 2, c); put(ox + i * 2 + 1, oy + j * 2, c); put(ox + i * 2, oy + j * 2 + 1, c); put(ox + i * 2 + 1, oy + j * 2 + 1, c);
      }
    }
    if (lt > 0.7) {
      const s = 'HALLOWEEN';
      for (let k = 0; k < s.length; k++) {
        if (lt - 0.7 < k * 0.06) continue;
        text(s[k], 6 + k * 4, 19 + Math.round(Math.sin(lt * 6 - k * 0.7) * 0.9), 18, 15);
      }
    }
    // pumpkins at the bottom, bats
    for (const [px, sz] of [[6, 1], [24, 0], [41, 1]]) {
      const py = 31;
      ell(px, py, 4 + sz, 3.2, 16); put(px, py - 4, 24);
      const blink = ih(px, fl(lt * 2), 52) < 0.15;
      put(px - 2, py - 1, blink ? 15 : 17); put(px + 1, py - 1, blink ? 15 : 17); hl(px - 2, px + 2, py + 1, 17);
    }
    return false;
  }
  function progStatic(lt, fi, chNum) {
    TG = SCR; PN = NE;
    const roll = (fi * 3) % SH;
    for (let y = 0; y < SH; y++) {
      const shift = ih(fi, y, 60) < 0.1 ? 2 : 0;
      for (let x = 0; x < SW; x++) {
        const v = ih(x + shift, y, fi * 131 + 7);
        let c = v < 0.3 ? 1 : v < 0.55 ? 4 : v < 0.8 ? 6 : v < 0.95 ? 8 : 9;
        if (Math.abs(y - roll) < 3) c = Math.min(9, c + 2);
        put(x, y, c);
      }
    }
  }
  function osd(chNum) {
    TG = SCR; PN = NE;
    const s = 'CH ' + chNum;
    text(s, SW - 2 - s.length * 4, 2, 25, 0);
  }
  function progCam(lt, fi) {
    TG = SCR; PN = NE;
    // the security camera is the very camera we are watching through
    const x0 = 46, y0 = 138, sc = 128 / SW;
    const ramp = [0, 23, 23, 24, 24, 25, 25, 18];
    for (let y = 0; y < SH; y++) for (let x = 0; x < SW; x++) {
      let s = 0, n = 0;
      for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) {
        const X = fl(x0 + (x + (i + 0.5) / 3) * sc), Y = fl(y0 + (y + (j + 0.5) / 3) * sc);
        if (X < 0 || Y < 0 || X >= AW || Y >= AH) continue;
        const p = PAL[OUT[Y * AW + X]];
        s += 0.3 * p[0] + 0.59 * p[1] + 0.11 * p[2]; n++;
      }
      let l = (n ? s / n : 0) / 255;
      l = Math.pow(l, 1.1) * 2.6 + 0.04;
      if (ih(x, y, fi * 17 + 3) < 0.06) l += 0.12;
      const k = clamp(fl(l * (ramp.length - 1) + bay(x, y) - 0.5), 0, ramp.length - 1);
      put(x, y, ramp[k]);
    }
    // glitch line
    const gy = fl((lt * 13) % SH);
    for (let x = 0; x < SW; x++) put(x, gy, ramp[Math.min(ramp.length - 1, 3 + (ih(x, fi, 2) < 0.5 ? 1 : 0))]);
    text('CAM2', 2, 2, 18, 0);
    if (fl(lt * 2) % 2 === 0) { ell(31.5, 4.5, 1.6, 1.6, 26); }
    text('REC', 34, 2, 18, 0);
    const sec = 7 + fl(lt);
    text('11:59:' + (sec < 10 ? '0' : '') + sec, 2, 29, 18, 0);
    // viewfinder corners
    hl(1, 4, 1, 18); vl(1, 1, 4, 18); hl(43, 46, 34, 18); vl(46, 31, 34, 18);
  }

  /* ================================================================ the story at time t */
  function kidPose(t) {
    const q = st10(t);
    const k = { t, bob: (fl(q * 10) % 16) < 8 ? 0 : 1, dx: 0, hdx: 0, hdy: 0, turn: 0, look: 0, reach: 0, hop: 0, squash: 0, mug: false, sip: false, yay: false, tilt: 0 };
    const reaches = [2.7, 11.1, 16.6];
    for (const r0 of reaches) {
      const u = q - r0;
      if (u >= 0 && u < 1.2) {
        k.reach = u < 0.4 ? u / 0.4 : u < 0.6 ? 1 : u < 0.9 ? 1 - (u - 0.6) / 0.3 : 0; k.candy = u > 0.45;
        k.hdx = u < 0.9 ? 1 : 0;
        if (u > 0.9) k.bob = (fl(q * 10) & 1);
      }
    }
    const sg = seg(t)[2];
    if (sg === 'pumpkin') k.bob = (fl(q * 5) & 1);
    if (sg === 'weather' && q > 15.4 && q < 18.4) { k.hdx = -1; k.hdy = 1; }
    if (sg === 'movie2') { k.hdy = 1; k.squash = 1; }
    if ((q >= 1.8 && q < 2.2) || (q >= 20.6 && q < 20.9)) { k.squash = 2; k.bob = 0; }
    // the realisation
    if (q >= 23.2 && q < 25.3) {
      k.bob = 0;
      if (q < 23.8) k.dx = (fl(q * 10) & 1) ? 1 : 0;
      k.turn = io(clamp((q - 23.9) / 1.2, 0, 1)) * 0.95;
      k.look = q > 24.8 ? 1 : 0;
    }
    if (q >= 25.3 && q < 29.0) {
      k.turn = 0.95; k.look = 2; k.bob = 0;
      if (q >= 25.4 && q < 25.7) k.hop = 2;
      if (q >= 25.6 && q < 26.2) k.yay = true;
      if (q >= 26.4) { k.mug = true; k.turn = 0.62; k.look = 1; k.tilt = -1; k.hdx = -1; }
      if (q >= 27.2 && q < 28.4) { k.turn = 0.12; k.look = 0; k.hdx = 0; }
      if (q >= 27.5 && q < 28.0) k.sip = true;
    }
    if (q >= 29.0 && q < 31.4) {
      k.turn = q < 30.6 ? 0.85 : 0.85 * (1 - (q - 30.6) / 0.8); k.look = 0;
      if (q >= 29.9 && q < 30.4) k.yay = (fl(q * 10) & 1) === 0;
    }
    if (q >= 31.4) k.turn = 0;
    return k;
  }

  /* ================================================================ frame */
  let LIGHT = { tv: [0.8, 0.85, 1], tvI: 1 };
  function drawFrame(t, g, k) {
    t = ((t % D) + D) % D;
    const fi = fl(t * 30 + 1e-4);
    const q = st10(t);
    const sgm = seg(t), ch = sgm[2], lt = t - sgm[0];
    const S = stage(t);
    // ---------------- TV programme
    let flash = false;
    SCR.c.fill(1);
    if (ch === 'movie') flash = progMovie(lt, fi, false);
    else if (ch === 'movie2') flash = progMovie(lt, fi, true);
    else if (ch === 'pumpkin') progPumpkin(lt, fi);
    else if (ch === 'host') progHost(lt, fi);
    else if (ch === 'weather') progWeather(lt, fi);
    else if (ch === 'card') progCard(lt, fi);
    else if (ch === 'static') progStatic(lt, fi, sgm[3]);
    if (ch === 'static' || (lt < 1.2 && ch !== 'cam' && ch !== 'card')) { if (sgm[3]) osd(sgm[3]); }
    // light from the screen
    let tvr = 0.78, tvg = 0.84, tvb = 1.0, tvI = 1.0;
    if (ch !== 'cam') {
      let r = 0, gg = 0, b = 0;
      for (let i = 0; i < SW * SH; i++) { const p = PAL[SCR.c[i] - 1]; r += p[0]; gg += p[1]; b += p[2]; }
      r /= SW * SH * 255; gg /= SW * SH * 255; b /= SW * SH * 255;
      const lum = 0.3 * r + 0.59 * gg + 0.11 * b;
      const m = Math.max(r, gg, b, 0.01);
      tvr = lerp(r / m, 1, 0.45); tvg = lerp(gg / m, 1, 0.45); tvb = lerp(b / m, 1, 0.45);
      tvI = 0.7 + lum * 2.3;
    } else { tvr = 0.62; tvg = 0.9; tvb = 0.72; tvI = 0.95; }
    if (ch === 'static') tvI *= 0.85 + ih(fi, 1, 99) * 0.3;
    tvI *= 0.96 + 0.04 * ih(fi, 2, 98);
    // ---------------- scene
    SC.c.set(BS.c); SC.n.set(BS.n); SC.g.set(BS.g); SC.hh.set(BS.hh);
    TG = SC; SC.zt = false;
    // spider on its thread
    {
      const u = t < 25.6 ? sstep(0, 25.6, t) : 1 - sstep(25.6, 30.5, t);
      const sy = Math.round(14 + u * 30);
      pen(NF, FL); vl(9, 14, sy - 1, 6);
      const leg = (fl(q * 10) & 1);
      rect(8, sy, 3, 2, 0); put(9, sy + 2, 0); put(7, sy + leg, 0); put(11, sy + leg, 0); put(7, sy + 2 - leg, 0); put(11, sy + 2 - leg, 0);
      pen(NE, FL); put(8, sy, 26); put(10, sy, 26);
    }
    // stars twinkle in the window
    pen(NE, FL);
    for (let k = 0; k < 6; k++) {
      const x = 177 + fl(ih(k, 1, 40) * 26), y = 31 + fl(ih(k, 2, 40) * 24);
      if (Math.hypot(x - 193, y - 72) < 12) continue;
      const on = ih(k, fl(t * 2), 41) < 0.6;
      put(x, y, on ? 8 : 4); if (on && k < 2) { put(x - 1, y, 5); put(x + 1, y, 5); }
    }
    // the skeleton decoration (paper, jointed), sways
    {
      const sw = Math.round(Math.sin(TAU * q / 4) * 1.4);
      pen(NF, FL);
      const bx = 160;
      put(bx, 24, 7); vl(bx, 25, 27, 6);
      const sh = (y) => Math.round(sw * (y - 27) / 36);
      const B = (x, y, c) => put(bx + x + sh(y), y, c);
      for (let y = 28; y < 34; y++) for (let x = -3; x <= 3; x++) { const u = x / 3.4, v = (y - 30.8) / 3; if (u * u + v * v <= 1) B(x, y, 8); }
      B(-1, 30, 0); B(-2, 30, 0); B(1, 30, 0); B(2, 30, 0); B(0, 32, 6); B(-1, 33, 7); B(1, 33, 7);
      for (let y = 34; y < 47; y++) B(0, y, 7);
      for (let r = 0; r < 4; r++) { const y = 36 + r * 2; for (let x = -3; x <= 3; x++) if (x) B(x, y, 8); }
      for (let x = -3; x <= 3; x++) B(x, 47, 8);
      const arm = (s) => { for (let k = 0; k < 6; k++) B(s * (3 + (k >> 1)), 36 + k, 8); for (let k = 0; k < 5; k++) B(s * (5 - (k >> 2)), 42 + k, 7); B(s * 5, 47, 8); B(s * 6, 48, 8); };
      arm(-1); arm(1);
      const lg = (s) => { for (let k = 0; k < 7; k++) B(s * (2 + (k > 4 ? 1 : 0)), 48 + k, 8); for (let k = 0; k < 6; k++) B(s * 3, 55 + k, 7); B(s * 3, 61, 8); B(s * 4, 61, 8); };
      lg(-1); lg(1);
    }
    // jack-o'-lantern face
    {
      const faces = ['smile', 'smile', 'oh', 'worry', 'side', 'scared', 'grin', 'smile'];
      let f = faces[S];
      if (S === 6 && q > 27.6 && q < 28.2) f = 'wink';
      const flick = ih(fl(t * 12), 3, 70);
      const map = { a: flick < 0.15 ? 16 : 17, b: 18 };
      pen(NE, 152); spr(JF[f], map, 64, 113);
    }
    // window: the cat's witch silhouette on the sill
    if (S === 3) {
      TG = SC; pen(NE, FL);
      const tw = (fl(q * 10) % 23) < 3;
      const rows = CAT_SIT.map((r, j) => (j === 12 && tw ? r.slice(0, 11) + '.' : r));
      spr(rows, { k: 0, m: 0, l: 0, e: 0, n: 0, h: 0, b: 0 }, 189, 78, false);
    }
    // wardrobe door
    {
      let ang = [0, 0.1, 0.24, 0.42, 0.62, 0.62, 0.62, 0][S];
      if (S === 6) ang = 0.62 * (1 - io(clamp((q - 30.05) / 0.4, 0, 1))) + (q > 30.45 && q < 30.6 ? 0.03 : 0);
      if (S === 7) ang = 0;
      TG = SC; pen(NF, 261);
      // interior details
      if (ang > 0.01) {
        rect(181, 166, 33, 88, 0);
        hl(182, 212, 171, 4);
        for (const [hx, c1, c2, len] of [[186, 2, 3, 40], [192, 13, 12, 46], [199, 3, 2, 36], [206, 28, 13, 44]]) {
          put(hx, 172, 6); put(hx + 1, 173, 6); put(hx - 1, 173, 6);
          for (let y = 174; y < 174 + len; y++) for (let x = hx - 3; x <= hx + 3; x++) put(x, y, (y & 3) === 0 && c1 === 13 ? 26 : (x === hx - 3 ? c2 : c1));
        }
        if (S >= 3 && S <= 6) { /* the empty hanger */ hl(201, 205, 175, 7); put(203, 174, 7); put(203, 173, 7); }
        if (S === 1 && q > 6.6 && q < 7.6 && !(q > 7.0 && q < 7.1)) { pen(NE, 261); put(181, 210, 25); put(181, 212, 25); pen(NF, 261); }
      }
      const W = 32, s = 15 * Math.sin(ang * Math.PI / 2 * 1.0);
      const xl = 213 - W * Math.cos(ang * Math.PI / 2);
      const top = 166, bot = 253;
      for (let x = Math.round(xl); x <= 213; x++) {
        const u = (213 - x) / (213 - xl + 1e-6);
        const yo = Math.round(s * u);
        for (let y = top + yo; y <= bot + yo; y++) {
          const lx = W * (1 - (x - xl) / (213 - xl + 1e-6));
          let c = 20;
          const ix = W - lx;
          if (y - yo < top + 3 || y - yo > bot - 3) c = 21;
          if ((ix > 4 && ix < 14) || (ix > 18 && ix < 29)) { if (y - yo > top + 6 && y - yo < bot - 6) { c = (y - yo === top + 7 || ix === 5 || ix === 19) ? 19 : 20; } }
          if (x === Math.round(xl)) c = 22;
          put(x, y, c);
        }
      }
      // knob and sticker
      const kx = Math.round(xl + 3 * Math.cos(ang * Math.PI / 2)), ky = 208 + Math.round(s * (1 - 3 / W));
      put(kx, ky, 17); put(kx, ky + 1, 15);
      if (ang < 0.3) { const sx = Math.round(xl + 18 * Math.cos(ang * Math.PI / 2)), syy = 186 + Math.round(s * 0.4); ell(sx, syy, 3.2, 2.6, 16); put(sx - 1, syy - 1, 0); put(sx + 1, syy - 1, 0); hl(sx - 1, sx + 1, syy + 1, 0); put(sx, syy - 3, 24); }
    }
    // the ball (rolls between flips)
    {
      const pos = S >= 2 && S <= 6 ? [30, 196] : [64, 198];
      pen(NF, pos[1]); TG = SC; SC.zt = true;
      ell(pos[0], pos[1] - 3, 3.5, 3.5, 26, (x, y, u, v) => (u + v < -0.6 ? 27 : u + v > 0.7 ? 14 : 26));
      SC.zt = false;
    }
    // chair and teddy
    {
      const moved = S >= 4 && S <= 6;
      const cx = moved ? 60 : 40, cb = moved ? 194 : 182;
      clr(LT); TG = LT; PN = NF;
      // back legs + backrest
      rect(2, 0, 2, 26, 20); rect(16, 0, 2, 26, 20); rect(2, 0, 16, 2, 21); rect(2, 4, 16, 1, 20); rect(2, 7, 16, 1, 20);
      put(9, 3, 26); put(10, 3, 26); put(9, 2, 26); put(10, 2, 26); // a little heart cutout painted on
      PN = NU; rect(1, 12, 18, 3, 21); hl(1, 18, 12, 22); PN = NF; rect(1, 15, 18, 2, 20);
      rect(1, 17, 2, 10, 19); rect(17, 17, 2, 10, 19);
      // teddy sits on the seat
      const turned = S >= 3 && S <= 6;
      PN = NS;
      spr(turned ? TEDDY_F : TEDDY_B, { o: 14, a: 15, b: 22, e: 0 }, 5, 2, false);
      finish(LT, 0.3, -1, 1);
      stamp(LT, cx - 10, cb - 27, cb, 0);
    }
    // eyes under the bed
    if (S === 2) {
      const bl = (q > 11.6 && q < 11.8) || (q > 13.3 && q < 13.5);
      TG = SC; pen(NE, 264);
      const ex = 26, ey = 257;
      if (bl) { hl(ex, ex + 1, ey + 1, 23); hl(ex + 5, ex + 6, ey + 1, 23); }
      else { rect(ex, ey, 2, 2, 25); rect(ex + 5, ey, 2, 2, 25); put(ex, ey, 18); put(ex + 5, ey, 18); }
    }
    // the parent's shadow in the doorway / walking out; mid-room; behind the kid
    const par = parentState(t, q, S);
    // candy bowl & wrappers
    {
      const nW = [3, 4, 5, 6, 7, 7, 9, 3][S];
      TG = SC;
      for (let k = 0; k < nW; k++) {
        const w = WRAP[k]; pen(NU, w.y, 0); SC.zt = true;
        put(w.x, w.y, w.c); put(w.x + 1, w.y, LITE[w.c]); put(w.x + 2, w.y, w.c); if (w.f) { put(w.x + 1, w.y - 1, w.c); } else { put(w.x - 1, w.y + 1, DARK[w.c]); }
      }
      const lvl = [5, 4, 4, 3, 3, 3, 2, 5][S];
      pen(NF, 232); SC.zt = true;
      ell(138, 228.5, 7.5, 3.6, 11, (x, y, u, v) => (v > 0.3 ? 11 : 10));
      pen(NU, 232, 4);
      ell(138, 226.5, 6.5, 2.2, 1);
      const cc = [26, 29, 17, 27, 25, 28, 16, 10];
      for (let k = 0; k < 14; k++) {
        const a = ih(k, 1, 80) * TAU, r = ih(k, 2, 80);
        const x = 138 + Math.cos(a) * r * 5.5, y = 226.5 + Math.sin(a) * r * 1.6 - (k < lvl * 2 ? 1 : 0);
        if (k > lvl * 3) continue;
        put(x, y, cc[k % cc.length]);
      }
      pen(NF, 232); hl(131, 145, 228, 10);
      SC.zt = false;
    }
    // occluders for the TV light
    const occ = [{ x: 110, z: 2 * (227 - FL) - 4, r: 11, h: 31 }];
    const kp = kidPose(t);
    // ---------------- sprites in depth order
    const draws = [];
    draws.push({ gy: 227, f: () => { const L = drawKid(kp); stamp(L, 110 - 20, 227 - 40, 227, 0); } });
    if (par) {
      draws.push({ gy: par.gy, f: () => drawParentState(par) });
      if (par.occ) occ.push(par.occ);
    }
    const cat = catState(t, q, S);
    if (cat) draws.push({ gy: cat.gy, f: () => drawCat(cat) });
    draws.sort((a, b) => a.gy - b.gy);
    for (const d of draws) d.f();
    // ---------------- lighting
    const hallOcc = par && par.inDoor ? { x: 21, z: -6, r: 8, h: 84 } : par && par.hallOcc ? par.hallOcc : null;
    lightPass(t, fi, tvr, tvg, tvb, tvI, occ, hallOcc, S);
    // ---------------- the CRT
    if (ch === 'cam') progCam(lt, fi);
    composeScreen(fi, ch === 'static');
    present(g, k, fi);
  }

  function parentState(t, q, S) {
    if (S === 3) return { pose: 'stand', x: 21, gy: 144, mode: 2, inDoor: true, remote: q > 18.7 && q < 18.85 ? 2 : 1, cat: false, t: q, gyLight: 144 };
    if (S === 4) return { pose: 'stand', x: 33, gy: 212, mode: 1, cat: true, catEyes: 25, remote: q > 22.3 && q < 22.45 ? 2 : 1, t: q, occ: { x: 33, z: 2 * (212 - FL), r: 10, h: 84 } };
    if (S === 5) {
      const lean = q > 24.6;
      return { pose: lean ? 'lean' : 'stand', x: 76, gy: 245, mode: 1, cat: true, catEyes: 25, mugs: 2, t: q, occ: { x: 76, z: 2 * (245 - FL), r: 11, h: 84 } };
    }
    if (S === 6) {
      if (q < 26.2) return { pose: 'lean', x: 76, gy: 245, mode: 0, cat: q < 26.5, mugs: q < 25.9 ? 2 : 1, t: q, occ: { x: 76, z: 198, r: 11, h: 84 } };
      if (q < 26.5) return { pose: 'crouch', x: 79, gy: 243, mode: 0, cat: true, mugs: 1, t: q };
      if (q < 28.6) return { pose: 'sit', x: 82, gy: 240, mode: 0, mugs: 1, sip: q > 27.0 && q < 27.6, arm: q > 27.6, t: q };
      if (q < 28.9) return { pose: 'crouch', x: 79, gy: 243, mode: 0, mugs: 2, t: q };
      // walk out to the hall
      const u = clamp((q - 28.9) / 2.5, 0, 1);
      const x = lerp(82, 22, u), gy = Math.round(lerp(243, 140, u));
      const wf = fl(q * 8) & 3;
      const inDoor = gy < 150;
      return { pose: 'walk', back: true, x, gy, wf, mode: inDoor ? 2 : 0, t: q, inDoorWalk: inDoor, hallOcc: { x, z: 2 * (gy - FL), r: 8, h: 84 }, occ: { x, z: 2 * (gy - FL), r: 10, h: 84 } };
    }
    return null;
  }
  function drawParentState(p) {
    const L = drawParent({ sil: p.mode !== 0, pose: p.pose, back: p.back, wf: p.wf, mugs: p.mugs || 0, cat: p.cat, catEyes: p.catEyes, remote: p.remote, sip: p.sip, arm: p.arm, t: p.t, flip: p.back, lx: p.inDoor ? 0.6 : 0.3, ly: -1 });
    const ox = p.x - 31, oy = p.gy - 100;
    if (p.inDoor) stamp(L, ox, oy, p.gy, 2, [6, 55, 36, 146], true);
    else if (p.inDoorWalk) stamp(L, ox, oy, p.gy, 2, [6, 55, 36, 146], true);
    else stamp(L, ox, oy, p.gy, p.mode);
  }
  function catState(t, q, S) {
    const sleep = { pose: 'sleep', x: 165, gy: 197, br: (fl(q * 10) % 20) < 10 };
    if (S === 0 || S === 7) return sleep;
    if (S === 6) {
      if (q < 26.5) return null; // still on the shoulder
      if (q < 26.8) { const u = (q - 26.5) / 0.3; return { pose: 'sit', x: lerp(59, 96, u), gy: Math.round(lerp(181, 250, u) - Math.sin(u * Math.PI) * 10) }; }
      if (q < 29.2) return { pose: 'sit', x: 96, gy: 250 };
      if (q < 30.0) { const u = (q - 29.2) / 0.8; return { pose: 'walk', x: lerp(96, 172, u), gy: Math.round(lerp(250, 266, u)), wf: fl(q * 8) & 1 }; }
      if (q < 30.4) return { pose: 'walk', x: 172 + ((fl(q * 10) & 1) ? 1 : 0), gy: 266, wf: 0 };
      if (q < 31.3) { const u = (q - 30.4) / 0.9; return { pose: 'walk', x: lerp(172, 166, u), gy: Math.round(lerp(266, 197, u)), wf: fl(q * 8) & 1, flip: true }; }
      return sleep;
    }
    return null;
  }
  function drawCat(c) {
    const L = LC; clr(L); TG = L; PN = NS;
    let rows, ox, oy;
    if (c.pose === 'sleep') { rows = c.br ? CAT_SLEEP : CAT_SLEEP.slice(0, 5).concat(CAT_SLEEP.slice(6)); ox = 2; oy = 20 - rows.length; }
    else if (c.pose === 'sit') { rows = CAT_SIT; ox = 3; oy = 20 - rows.length; }
    else { rows = CAT_WALK[c.wf || 0]; ox = 2; oy = 20 - rows.length; }
    spr(rows, catMap(), ox, oy, !!c.flip);
    finish(L, 0, -1, 0);
    stamp(L, Math.round(c.x) - 10, c.gy - 20, c.gy, 0);
  }

  /* ================================================================ light */
  const TX = 106.5, TZ = 26, TH = 56;
  const AMB = [0.30, 0.30, 0.44];
  const STEP = 0.11, BW = 0.5;
  function band(I, b) {
    const s = I / STEP; let k = fl(s); const f = s - k; const lo = 0.5 - BW * 0.5;
    if (f >= lo + BW) k++; else if (f > lo && (f - lo) / BW > b) k++;
    return k * STEP;
  }
  function cyl(PX, PZ, PHh, LX, LZ, LH, o) {
    const dx = LX - PX, dz = LZ - PZ, L2 = dx * dx + dz * dz;
    const u = ((o.x - PX) * dx + (o.z - PZ) * dz) / L2;
    if (u < 0 || u > 1) return 1;
    const qx = PX + dx * u - o.x, qz = PZ + dz * u - o.z, dd = Math.sqrt(qx * qx + qz * qz);
    if (dd > o.r) return 1;
    const hh = PHh + (LH - PHh) * u; if (hh > o.h) return 1;
    return 0.2 + 0.8 * sstep(0.55, 1, dd / o.r);
  }
  function lightPass(t, fi, tr, tg, tb, tI, occ, hallOcc, S) {
    const pf = 0.85 + 0.15 * ih(fl(t * 12), 3, 70);
    const pumpI = 0.75 * pf, hallI = 4.2;
    const R2 = 120 * 120;
    for (let y = 0; y < AH; y++) for (let x = 0; x < AW; x++) {
      const i = y * AW + x, n = SC.n[i], col = SC.c[i] - 1;
      if (n === NE) { OUT[i] = col; continue; }
      const H = SC.hh[i], Z = 2 * (y + H - FL), X = x + 0.5;
      const b = BAY[((y & 3) << 2) | (x & 3)];
      // TV
      let dx = TX - X, dz = TZ - Z, dh = TH - H;
      let d = Math.sqrt(dx * dx + dz * dz + dh * dh) + 1e-3;
      let nd = n === NU ? dh / d : n === NF ? dz / d : n === NL ? -dx / d : n === NRT ? dx / d : n === NR ? 1 : 0.5;
      nd = (nd + 0.3) / 1.3; if (nd < 0) nd = 0;
      const ax = -dz / d;
      let beam = 0.3 + 0.8 * ax; beam = beam < 0.14 ? 0.14 : beam > 1 ? 1 : beam;
      let I = tI * 1.5 * R2 / (R2 + d * d) * (beam * nd + 0.2);
      if (n === NU && H === 0) for (let k = 0; k < occ.length; k++) I *= cyl(X, Z, 0, TX, TZ, TH, occ[k]);
      // CRT halo on the wall around the set
      if (Z < 4 && n === NF) { const hd = Math.hypot(X - 110, (FL - H) - 95); I += tI * 0.5 * 900 / (900 + hd * hd); }
      const It = band(I, b);
      // jack-o'-lantern
      dx = 70.5 - X; dz = 14 - Z; dh = 34 - H; d = Math.sqrt(dx * dx + dz * dz + dh * dh) + 1e-3;
      nd = n === NU ? dh / d : n === NF ? dz / d : n === NL ? -dx / d : n === NRT ? dx / d : n === NR ? 0.7 : 0.4;
      nd = (nd + 0.4) / 1.4; if (nd < 0) nd = 0;
      const Ip = band(pumpI * 700 / (700 + d * d) * nd, b);
      // hall night-light through the door
      let Ih = 0;
      if (Z > -1) {
        const LXh = 12, LZh = -34, LHh = 6;
        const s = (0 - LZh) / (Z - LZh + 1e-3), Xc = LXh + (X - LXh) * s, Hc = LHh + (H - LHh) * s;
        if (Xc > 6 && Xc < 36 && Hc < 90) {
          dx = LXh - X; dz = LZh - Z; dh = LHh - H; d = Math.sqrt(dx * dx + dz * dz + dh * dh) + 1e-3;
          nd = n === NU ? dh / d + 0.35 : n === NF ? 0.3 : 0.5; if (nd < 0) nd = 0;
          Ih = hallI * 2600 / (2600 + d * d) * nd * sstep(6, 9, Xc) * (1 - sstep(33, 36, Xc));
          if (hallOcc && n === NU && H === 0) Ih *= cyl(X, Z, 0, LXh, LZh, LHh, hallOcc);
        }
      }
      Ih = band(Ih, b);
      // moon
      let Im = 0;
      { const gy = SC.g[i]; const m = n === NU && H === 0 ? MOON[i] : (n === NS || n === NR) && gy >= FL && gy < AH ? MOON[gy * AW + x] * 0.8 : 0; if (m > 0) Im = m > 0.6 ? 0.4 : (b < m ? 0.4 : 0); }
      const lr = AMB[0] + It * tr + Ip * 1.0 + Ih * 1.0 + Im * 0.62;
      const lg = AMB[1] + It * tg + Ip * 0.5 + Ih * 0.62 + Im * 0.78;
      const lb = AMB[2] + It * tb + Ip * 0.18 + Ih * 0.34 + Im * 0.82;
      const p = PAL[col];
      let r = p[0] * lr, g = p[1] * lg, bb = p[2] * lb;
      r = r > 255 ? 255 : r; g = g > 255 ? 255 : g; bb = bb > 255 ? 255 : bb;
      OUT[i] = LUT[((r >> 3) << 10) | ((g >> 3) << 5) | (bb >> 3)];
    }
  }

  /* ================================================================ CRT composite & present */
  function composeScreen(fi, isStatic) {
    for (let y = 0; y < SH; y++) for (let x = 0; x < SW; x++) {
      // bulging glass: rounded corners
      const ex = x < 3 ? 3 - x : x > SW - 4 ? x - (SW - 4) : 0, ey = y < 3 ? 3 - y : y > SH - 4 ? y - (SH - 4) : 0;
      if (ex * ex + ey * ey > 7) continue;
      let c = SCR.c[y * SW + x] - 1;
      // vignette toward the bezel
      const edge = Math.min(x, y, SW - 1 - x, SH - 1 - y);
      if (edge === 0 || (ex * ex + ey * ey > 3)) c = DARK[c];
      else if (edge === 1 && bay(x, y) < 0.5) c = DARK[c];
      // glare on the glass
      const gl = x + y * 1.3;
      if (gl > 6 && gl < 9 && y < 14 && bay(x, y) < 0.5) c = LITE[c];
      if (x > SW - 9 && y > SH - 8 && (x + y) % 3 === 0 && !isStatic) c = LITE[c];
      OUT[(SY + y) * AW + SX + x] = c;
    }
  }
  let IMG = null, SMALL = null, SG = null;
  function present(g, k, fi) {
    if (!SMALL) { SMALL = document.createElement('canvas'); SMALL.width = AW; SMALL.height = AH; SG = SMALL.getContext('2d'); IMG = SG.createImageData(AW, AH); }
    const d = IMG.data;
    for (let i = 0, j = 0; i < NP; i++, j += 4) { const p = PAL[OUT[i]]; d[j] = p[0]; d[j + 1] = p[1]; d[j + 2] = p[2]; d[j + 3] = 255; }
    SG.putImageData(IMG, 0, 0);
    if (!g) return;
    g.imageSmoothingEnabled = false;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.drawImage(SMALL, 0, 0, AW * k, AH * k);
    // scanlines over the tube only
    if (k >= 3) {
      const a = 0.2 + 0.08 * ih(fi, 7, 1);
      g.fillStyle = 'rgba(4,3,16,' + a.toFixed(3) + ')';
      const th = Math.max(1, Math.round(k / 4));
      for (let y = 0; y < SH; y++) g.fillRect(SX * k, (SY + y + 1) * k - th, SW * k, th);
      // a slow bright roll bar
      const ry = ((fi * 0.7) % (SH + 20)) - 10;
      g.fillStyle = 'rgba(200,230,255,0.05)';
      g.fillRect(SX * k, (SY + Math.max(0, ry)) * k, SW * k, Math.max(0, Math.min(SH - ry, 6, SH)) * k);
    }
  }

  /* ================================================================ mount */
  (window.PIECES = window.PIECES || []).push({
    id: 'halloween',
    title: 'Creature Feature',
    medium: 'Pixel art in 32 colours, 216 × 270, animated in JavaScript · 32 s loop',
    note: 'Watch the room, not the TV · tap to pause',
    about: 'A kid in a bedsheet ghost watches the late-night monster movie while, at every flip of the channel, something in the dark room behind them moves a little closer. Every pixel is placed by code on a 216 × 270 grid, lit by the glow of the set in stepped, dithered light, and every programme on the TV is invented.',
    tone: 'dark',
    room: '#07061a',
    mount(el, api) {
      const EXPORT = /[?&]export\b/.test(location.search);
      SEED = (api.seed >>> 0) % 100000 || 7;
      const cr = mulberry32(SEED * 13 + 1);
      const coats = [{ k: 2, m: 4, l: 5, w: 8 }, { k: 1, m: 3, l: 5, w: 3 }, { k: 15, m: 16, l: 17, w: 18 }, { k: 5, m: 6, l: 7, w: 9 }];
      CAT = SEED === 7 ? coats[0] : coats[fl(cr() * coats.length)];
      let alive = true, raf = 0, playing = !EXPORT, clock = 0, last = 0, built = false;
      el.style.background = '#07061a';
      const cv = document.createElement('canvas');
      cv.style.cssText = 'position:absolute;display:block;cursor:pointer;image-rendering:pixelated;image-rendering:crisp-edges;';
      el.appendChild(cv);
      const g = cv.getContext('2d', { alpha: false });
      const pauseMark = document.createElement('div');
      pauseMark.style.cssText = 'position:absolute;width:34px;height:34px;opacity:0;transition:opacity .4s;pointer-events:none;';
      pauseMark.innerHTML = '<svg viewBox="0 0 34 34" width="34" height="34"><rect x="10" y="9" width="5" height="16" fill="rgba(236,248,255,.8)"/><rect x="19" y="9" width="5" height="16" fill="rgba(236,248,255,.8)"/></svg>';
      el.appendChild(pauseMark);
      let K = 5;
      function layout() {
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        let left = 0, top = 0, cssW, cssH;
        if (EXPORT) { cssW = 1080; cssH = 1350; cv.style.position = 'fixed'; K = Math.max(1, Math.round(5 * dpr)); }
        else {
          const w = el.clientWidth || window.innerWidth, h = el.clientHeight || window.innerHeight;
          const fit = Math.min(w * dpr / AW, h * dpr / AH);
          let k = Math.floor(fit);
          if (k < 1) k = 1;
          K = k;
          if (k * AH < fit * AH * 0.82) { // integer scale wastes too much: scale fractionally (still nearest-neighbour)
            K = Math.max(1, Math.ceil(fit));
            cssW = AW * fit / dpr; cssH = AH * fit / dpr;
          } else { cssW = AW * k / dpr; cssH = AH * k / dpr; }
          left = Math.round((w - cssW) / 2); top = Math.round((h - cssH) / 2);
        }
        cv.style.left = left + 'px'; cv.style.top = top + 'px'; cv.style.width = cssW + 'px'; cv.style.height = cssH + 'px';
        pauseMark.style.left = (left + cssW - 48) + 'px'; pauseMark.style.top = (top + 14) + 'px';
        if (cv.width !== AW * K || cv.height !== AH * K) { cv.width = AW * K; cv.height = AH * K; }
      }
      layout();
      function build() {
        buildLUT(); buildMaps(); buildBase();
        built = true;
      }
      build();
      drawFrame(0, g, K);
      if (EXPORT) {
        const mo = new MutationObserver(() => { if (!built && document.documentElement.dataset.ready) delete document.documentElement.dataset.ready; });
        mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-ready'] });
        // ready only once the room's fade-in has finished, so frame 0 is captured at full strength
        const faded = () => { const st = el.parentElement; return !st || parseFloat(getComputedStyle(st).opacity) >= 0.999; };
        window.__halloween = {
          duration: D,
          isReady: () => built && faded(),
          renderAt(t) { return new Promise((res) => { const t0 = performance.now(); drawFrame(t, g, K); window.__halloween.lastMs = performance.now() - t0; requestAnimationFrame(() => requestAnimationFrame(res)); }); },
          lastMs: 0,
          dbg: (x, y) => { const i = y * AW + x; return { c: SC.c[i] - 1, n: SC.n[i], g: SC.g[i], h: SC.hh[i], base: BS.c[i] - 1, out: OUT[i] }; },
        };
        document.documentElement.dataset.ready = 'halloween';
        api.ready();
      } else {
        window.__halloween = { duration: D, isReady: () => built, renderAt(t) { return new Promise((res) => { playing = false; clock = t; drawFrame(t, g, K); requestAnimationFrame(() => res()); }); } };
        api.ready();
      }
      function frame(now) {
        if (!alive || !api.isCurrent()) return;
        raf = requestAnimationFrame(frame);
        const dt = last ? Math.min(0.1, (now - last) / 1000) : 0; last = now;
        if (!playing) return;
        clock = (clock + dt) % D;
        drawFrame(clock, g, K);
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
          if (window.__halloween) delete window.__halloween;
        },
      };
    },
  });
})();
