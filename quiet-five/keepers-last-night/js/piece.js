/* The Keeper's Last Night — pixel art, 216x270, 16 colours, 8 s loop.
   Everything is computed on the native grid as palette indices; no filtering anywhere. */
'use strict';
(function () {
  const W = 216, H = 270, LOOP = 8, FPS = 30;

  // ---------------------------------------------------------------- palette (16)
  const PAL_HEX = [
    '#04060b', // 0  ink black (rock)
    '#09101b', // 1  deepest night
    '#0e192a', // 2  navy
    '#152439', // 3  storm blue
    '#1d3149', // 4
    '#29425e', // 5  slate blue
    '#3a5876', // 6
    '#55728f', // 7  grey blue
    '#829bb2', // 8
    '#b9c9d6', // 9  foam
    '#e8f0f1', // 10 foam white
    '#35201a', // 11 warm umber (window frame, lamp shadow)
    '#874620', // 12 amber dark
    '#d3832d', // 13 amber
    '#f5c263', // 14 amber light
    '#fff0c6', // 15 lamp cream
  ];
  const PAL = PAL_HEX.map(h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]);

  // ---------------------------------------------------------------- determinism
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const rnd = mulberry32(0x6b33704e);

  // gradient noise with optional integer period (for tileable / periodic textures)
  const PERM = new Uint16Array(512);
  const GX = new Float32Array(256), GY = new Float32Array(256);
  (function () {
    const p = []; for (let i = 0; i < 256; i++) p.push(i);
    for (let i = 255; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const t = p[i]; p[i] = p[j]; p[j] = t; }
    for (let i = 0; i < 512; i++) PERM[i] = p[i & 255];
    for (let i = 0; i < 256; i++) { const a = rnd() * Math.PI * 2; GX[i] = Math.cos(a); GY[i] = Math.sin(a); }
  })();
  const fade = t => t * t * t * (t * (t * 6 - 15) + 10);
  function noise(x, y, px, py) {
    let xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    let x0 = xi, x1 = xi + 1, y0 = yi, y1 = yi + 1;
    if (px) { x0 = ((x0 % px) + px) % px; x1 = ((x1 % px) + px) % px; }
    if (py) { y0 = ((y0 % py) + py) % py; y1 = ((y1 % py) + py) % py; }
    const h = (ix, iy) => PERM[(PERM[ix & 255] + iy) & 511];
    const g = (hh, dx, dy) => GX[hh] * dx + GY[hh] * dy;
    const n00 = g(h(x0, y0), xf, yf), n10 = g(h(x1, y0), xf - 1, yf);
    const n01 = g(h(x0, y1), xf, yf - 1), n11 = g(h(x1, y1), xf - 1, yf - 1);
    const u = fade(xf), v = fade(yf);
    return (n00 + (n10 - n00) * u) * (1 - v) + (n01 + (n11 - n01) * u) * v; // ~[-0.7,0.7]
  }
  function fbm(x, y, oct) {
    let s = 0, a = 0.5, f = 1;
    for (let i = 0; i < oct; i++) { s += a * noise(x * f + i * 17.3, y * f - i * 9.1); f *= 2.03; a *= 0.5; }
    return s;
  }

  // ordered dither
  const B4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  const bay = (x, y) => (B4[((y & 3) << 2) | (x & 3)] + 0.5) / 16;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  // quantise a continuous value to an index; `steep` > 1 keeps bands solid and dithers only the seams
  function qd(v, x, y, steep) {
    const f = Math.floor(v); let fr = v - f;
    if (steep > 1) fr = clamp((fr - 0.5) * steep + 0.5, 0, 1);
    return f + (fr > bay(x, y) ? 1 : 0);
  }

  // ---------------------------------------------------------------- camera / world
  const CX = 108, HY = 180, F = 772, CAMH = 8, DY = 10;
  const ZL = 386;                       // lighthouse distance (m)
  const TOWER_X = 140;                  // screen x of tower axis
  const XL = (TOWER_X - CX) * ZL / F;   // world x of tower
  const LAMP_SY = 66 + DY;
  const LAMP_Y = CAMH + (HY - LAMP_SY) * ZL / F; // ~40 m
  const ZSPR = 367;                     // depth assigned to rock/buildings sprite (front face)
  const P = [XL, LAMP_Y, ZL];           // lamp position
  const C = [0, CAMH, 0];               // camera

  // ---------------------------------------------------------------- static: sky
  const MOON = [70, 6];                 // hidden moon behind the deck, above the gap
  const sky = new Uint8Array(W * H);
  const skyCloud = new Float32Array(W * H);  // signed cloud field (>0 cloud)
  // explicit masses: the heavy deck (top, sagging down the right), a ragged mid band, low scud
  function deckEdge(x) {
    // lower boundary of the deck in screen y
    const base = x < 100 ? 17 + x * 0.06 : 23 + Math.pow((x - 100) / 116, 1.5) * 92;
    return base + 7 * fbm(x * 0.05, 3.7, 3) + 3.5 * fbm(x * 0.17, 9.2, 2);
  }
  // clouds are built from overlapping puffs, painted back to front, each rim-lit by the hidden moon
  function buildPuffs() {
    const r = mulberry32(4242);
    const puffs = [];
    // the deck: three ranks of billows along its ragged lower edge
    for (let row = 2; row >= 0; row--) {
      let x = -14 + r() * 8;
      while (x < W + 14) {
        const rx = 6 + r() * 9 + (2 - row) * 1.5, ry = rx * (0.5 + r() * 0.22);
        const y = deckEdge(x) - ry * 0.45 - row * 8 - r() * 3;
        puffs.push({ x, y, rx, ry, kind: 0, depthF: 1 - row * 0.28, base: null });
        x += rx * (0.85 + r() * 0.7);
      }
    }
    // mid band: strato-cumulus with flat dark bases, sloping down to the right
    for (let row = 1; row >= 0; row--) {
      let x = -12 + r() * 6;
      while (x < 156) {
        const yc = 98 + (x - 40) * 0.12 + 5 * fbm(x * 0.03, 1.3, 2);
        const big = 0.6 + 0.4 * Math.sin(x * 0.045 + 1.2);
        const rx = (5 + r() * 8) * (0.7 + big * 0.5) * (row ? 0.8 : 1), ry = rx * (0.55 + r() * 0.2);
        const base = yc + 5 + (row ? -3 : 0);
        puffs.push({ x, y: base - ry * (0.35 + r() * 0.35) - row * 5, rx, ry, kind: 1, depthF: 1 - row * 0.35, base });
        x += rx * (0.7 + r() * 0.8) + (r() < 0.12 ? 10 + r() * 14 : 0);
      }
    }
    // low scud: thin dark lenses in front of the horizon glow
    let x = -10;
    while (x < W + 10) {
      const rx = 6 + r() * 14, ry = 1.6 + r() * 2.2;
      const y = 146 + r() * 16 + (x > 120 ? -4 : 0);
      puffs.push({ x: x + rx, y, rx, ry, kind: 2, depthF: 1, base: y + ry * 0.4 });
      x += rx * 2 + 4 + r() * 22;
    }
    return puffs;
  }
  function buildSky() {
    const val = new Float32Array(W * H);
    const isCloud = new Uint8Array(W * H);
    const prox = (x, y) => Math.exp(-Math.hypot(x - MOON[0], y - MOON[1]) / 70);
    // clear sky
    for (let y = 0; y < HY; y++) for (let x = 0; x < W; x++) {
      const md = Math.hypot(x - MOON[0], y - MOON[1]);
      val[y * W + x] = 1.05 + 0.9 * smooth(40, 130, y) + 2.2 * Math.pow(smooth(122, HY, y), 1.25) + 1.15 * Math.exp(-md / 20);
    }
    // the deck's solid interior (behind its billows)
    for (let x = 0; x < W; x++) {
      const e = deckEdge(x) - 9;
      for (let y = 0; y < Math.min(HY, e); y++) {
        const i = y * W + x;
        val[i] = 2.35 + 0.7 * fbm(x * 0.07 + 11, y * 0.13, 3) + 0.25 * smooth(e - 12, e, y);
        isCloud[i] = 1;
      }
    }
    const puffs = buildPuffs();
    const mxm = MOON[0], mym = MOON[1];
    const kindAt = new Int8Array(W * H).fill(-1);
    for (let i = 0; i < W * H; i++) if (isCloud[i]) kindAt[i] = 0;
    for (const p of puffs) {
      const x0 = Math.floor(p.x - p.rx - 2), x1 = Math.ceil(p.x + p.rx + 2);
      const y0 = Math.floor(p.y - p.ry - 2), y1 = Math.ceil(p.y + p.ry + 2);
      for (let y = Math.max(0, y0); y <= Math.min(HY - 1, y1); y++) for (let x = Math.max(0, x0); x <= Math.min(W - 1, x1); x++) {
        const dx = (x + 0.5 - p.x) / p.rx, dy = (y + 0.5 - p.y) / p.ry;
        let rn = Math.sqrt(dx * dx + dy * dy);
        rn += 0.13 * noise(x * 0.35 + p.x, y * 0.5 + p.y);
        if (rn > 1) continue;
        if (p.base !== null && y + 0.5 > p.base) continue;
        const i = y * W + x;
        const nl = Math.hypot(dx, dy) || 1, ny = dy / nl;
        let edge = (1 - rn) * Math.min(p.rx, p.ry * 1.6);
        if (p.base !== null) edge = Math.min(edge, (p.base - y - 0.5) * 1.4);
        const round = -dy * Math.sqrt(Math.max(0, 1 - rn * rn * 0.5)); // +1 at the top of the billow, -1 at the bottom
        let body;
        if (p.kind === 0) body = 2.55 + 0.75 * round + 0.3 * fbm(x * 0.08 + 11, y * 0.15, 3);
        else if (p.kind === 1) body = 2.45 + 0.8 * round + 0.35 * fbm(x * 0.08 + 31, y * 0.15, 3) - (p.base !== null ? 0.6 * smooth(3, 0, p.base - y) : 0);
        else body = 1.6 + 0.3 * round;
        // crease where a front billow overlaps one behind it (shadowed seam on its upper rim)
        val[i] = body;
        isCloud[i] = 1;
        kindAt[i] = p.kind;
      }
    }
    // silver lining: distance to clear sky, strongest near the hidden moon, on edges that face it
    const Rr = 7;
    const lit = new Float32Array(W * H);
    for (let y = 0; y < HY; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (!isCloud[i]) continue;
      let best = 1e9, bx = 0, by = 0;
      for (let dy = -Rr; dy <= Rr; dy++) {
        const yy = y + dy; if (yy < 0 || yy >= HY) continue;
        for (let dx = -Rr; dx <= Rr; dx++) {
          const xx = x + dx; if (xx < 0 || xx >= W) continue;
          const d2 = dx * dx + dy * dy;
          if (d2 < best && !isCloud[yy * W + xx]) { best = d2; bx = dx; by = dy; }
        }
      }
      if (best > Rr * Rr) continue;
      const dist = Math.sqrt(best);
      const tmx = mxm - x, tmy = mym - y, tml = Math.hypot(tmx, tmy) || 1;
      const facing = (bx * tmx + by * tmy) / (dist * tml);
      const k = kindAt[i];
      let dirF;
      if (k === 0) dirF = 0.55 + 0.45 * Math.max(0, by / dist);         // the deck: lining all round its underside
      else if (k === 1) dirF = clamp(facing * 1.3 + 0.1, 0, 1);         // mid band: tops toward the moon
      else dirF = 0.15 * Math.max(0, -by / dist);
      const pr = prox(x, y);
      lit[i] = (k === 1 ? 6.0 * Math.pow(pr, 0.55) : 7.8 * pr) * dirF * Math.exp(-(dist - 1) / 1.7);
    }
    for (let i = 0; i < W * H; i++) val[i] += lit[i];
    for (let i = 0; i < W * H; i++) skyCloud[i] = isCloud[i] ? 1 : -1;
    for (let y = 0; y < HY; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const v = val[i];
      const idx = isCloud[i] ? Math.floor(v) : qd(v, x, y, 2.6);
      sky[i] = clamp(idx, 1, 8);
    }
    cleanup(sky, 0, HY - 1, 3, isCloud);
    for (let y = HY; y < HY + 4; y++) for (let x = 0; x < W; x++) sky[y * W + x] = sky[(HY - 1) * W + x];
    // stars, hand placed inside the gap (only where the sky is clear)
    const stars = [
      [33, 38, 3], [58, 31, 1], [83, 46, 2], [22, 57, 1], [49, 55, 1], [104, 40, 1], [70, 64, 1], [11, 33, 1], [92, 60, 1], [40, 70, 1], [116, 52, 1],
    ];
    for (const [x, y, b] of stars) {
      if (skyCloud[y * W + x] > -0.15) continue;
      if (b === 3) {
        sky[y * W + x] = 10;
        sky[(y - 1) * W + x] = 6; sky[(y + 1) * W + x] = 6; sky[y * W + x - 1] = 6; sky[y * W + x + 1] = 6;
      } else if (b === 2) { sky[y * W + x] = 9; }
      else sky[y * W + x] = 6;
    }
  }

  // remove orphan pixels: a pixel none of whose 4-neighbours shares its index takes the commonest neighbour
  function cleanup(buf, y0, y1, passes, mask) {
    const cnt = new Uint8Array(16);
    for (let p = 0; p < passes; p++) {
      for (let y = Math.max(1, y0); y <= Math.min(H - 2, y1); y++) for (let x = 1; x < W - 1; x++) {
        const i = y * W + x;
        if (mask && !mask[i]) continue;
        const c = buf[i];
        const n = [buf[i - 1], buf[i + 1], buf[i - W], buf[i + W]];
        if (n[0] === c || n[1] === c || n[2] === c || n[3] === c) continue;
        cnt.fill(0); let best = n[0], bc = 0;
        for (const k of n) { if (k > 15) continue; cnt[k]++; if (cnt[k] > bc) { bc = cnt[k]; best = k; } }
        buf[i] = best;
      }
    }
  }

  // ---------------------------------------------------------------- static: rock, lighthouse, cottage
  const spr = new Uint8Array(W * H).fill(255);
  const sprKind = new Uint8Array(W * H); // 1 rock, 2 tower, 3 cottage, 4 lantern
  function inPoly(pts, x, y) {
    let c = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, yi] = pts[i], [xj, yj] = pts[j];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c;
    }
    return c;
  }
  function polyFill(pts, fn) {
    let minx = W, maxx = 0, miny = H, maxy = 0;
    for (const [x, y] of pts) { minx = Math.min(minx, x); maxx = Math.max(maxx, x); miny = Math.min(miny, y); maxy = Math.max(maxy, y); }
    for (let y = Math.max(0, Math.floor(miny)); y <= Math.min(H - 1, Math.ceil(maxy)); y++)
      for (let x = Math.max(0, Math.floor(minx)); x <= Math.min(W - 1, Math.ceil(maxx)); x++)
        if (inPoly(pts, x + 0.5, y + 0.5)) fn(x, y);
  }
  const put = (x, y, c, k) => { if (x >= 0 && x < W && y >= 0 && y < H) { spr[y * W + x] = c; if (k) sprKind[y * W + x] = k; } };

  const ROCK = [
    [64, 200], [67, 192], [71, 187], [75, 183], [78, 180], [80, 176], [84, 173], [86, 170], [89, 168], [91, 165],
    [94, 162], [96, 159], [99, 158], [126, 158], [128, 156], [131, 155.4], [150, 155.4], [153, 156.5], [156, 158],
    [158, 161], [160, 163], [161, 166], [164, 168], [166, 172], [168, 175], [171, 178], [173, 181], [177, 184],
    [181, 187], [186, 191], [190, 196], [192, 200],
  ];
  const COTT = { x0: 99, x1: 124, wallTop: 147, base: 158, roofTop: 138 };
  const WIN = { x: 104, y: 150, w: 7, h: 6 };
  const TOWER = { base: 156, top: 80, hwB: 8.6, hwT: 6.2 };

  function buildSprite() {
    // ---- rock: a relief map lit from the gap (upper left), quantised to four tones
    const rock = new Uint8Array(W * H);
    polyFill(ROCK, (x, y) => { rock[y * W + x] = 1; });
    const relief = (x, y) => {
      // blocky, layered stone: strata tilted down to the right plus broken blocks
      const strata = Math.abs(((y * 0.9 + x * 0.22) / 7 + 0.35 * fbm(x * 0.05, y * 0.05, 2)) % 1 - 0.5);
      return 1.1 * fbm(x * 0.07 + 40, y * 0.1, 4) + 0.5 * strata;
    };
    const rv = new Float32Array(W * H);
    const rmask = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (!rock[y * W + x]) continue;
      const gx = relief(x + 1, y) - relief(x - 1, y), gy = relief(x, y + 1) - relief(x, y - 1);
      // light from upper-left: surfaces rising toward the light are lit
      const sh = -gx * 2.2 - gy * 2.6;
      let v = 1.05 + sh * 1.5;
      v += 0.9 * smooth(150, 110, x) - 0.6 * smooth(150, 175, x);   // left flank faces the gap
      v -= 0.8 * smooth(176, 192, y);                                  // wet black foot
      rv[y * W + x] = v; rmask[y * W + x] = 1;
    }
    const rq = new Uint8Array(W * H);
    for (let i = 0; i < W * H; i++) if (rmask[i]) rq[i] = clamp(Math.floor(rv[i]), 0, 3);
    modeFilter(rq, rmask, 1, 2, 2);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (rmask[y * W + x]) put(x, y, rq[y * W + x], 1);
    // top edges catch the cold light; wet sheen near the waterline
    for (let y = 1; y < H; y++) for (let x = 1; x < W - 1; x++) {
      const i = y * W + x;
      if (!rock[i] || rock[i - W]) continue;
      put(x, y, x < 128 ? 4 : x < 150 ? 3 : 2, 1);
      if (y + 1 < H && rock[i + W] && x < 150) put(x, y + 1, x < 128 ? 3 : 2, 1);
    }
    for (const [sx, sy, len] of [[83, 179, 3], [92, 177, 2], [160, 176, 2], [72, 186, 2], [176, 186, 3], [100, 181, 2]]) {
      for (let k = 0; k < len; k++) if (rock[sy * W + sx + k]) put(sx + k, sy, k === 0 ? 3 : 2, 1);
    }
    // wet glints on the rock top and along the waterline
    for (const [x, y, c] of [[97, 161, 5], [98, 161, 4], [104, 160, 4], [133, 157, 5], [134, 157, 4], [152, 158, 4], [88, 170, 4], [89, 170, 3],
                              [80, 180, 4], [81, 180, 3], [92, 184, 4], [93, 184, 3], [94, 184, 3], [167, 179, 3], [172, 183, 3], [173, 183, 2], [110, 186, 3], [111, 186, 4], [150, 187, 3], [151, 187, 3]]) {
      if (rock[y * W + x]) put(x, y, c, 1);
    }
    // ---- cottage: whitewashed front wall, shadowed gable end, slate roof, stone chimney
    const ct = COTT;
    for (let y = 148; y <= 157; y++) for (let x = 100; x <= 123; x++) {
      let c = 4;
      if (x <= 101) c = 5;
      if (y === 148) c = 2;
      if (y === 157) c = 3;
      if (x === 123) c = 3;
      put(x, y, c, 3);
    }
    polyFill([[93, 158], [93, 148], [96.5, 139.5], [100, 148], [100, 158]], (x, y) => put(x, y, x === 99 ? 2 : y === 157 ? 4 : (x === 93 ? 6 : 5), 3));
    polyFill([[100.2, 148.2], [96.6, 139], [124.5, 139], [125.6, 148.2]], (x, y) => {
      let c = (y - 139) % 2 === 1 ? 1 : 2;
      if (y === 139) c = 5;
      if (y === 148) c = 1;
      put(x, y, c, 3);
    });
    for (let k = 0; k <= 9; k++) put(Math.floor(93.3 + k * 0.37), 148 - k, 6, 3); // lit verge
    for (let y = 132; y <= 139; y++) for (let x = 118; x <= 121; x++) put(x, y, x === 118 ? 6 : x === 121 ? 3 : 4, 3);
    for (let x = 117; x <= 122; x++) put(x, 131, x < 119 ? 7 : 5, 3);
    put(119, 130, 4, 3); put(120, 130, 3, 3);
    for (let y = 151; y <= 157; y++) for (let x = 115; x <= 117; x++) put(x, y, y === 151 ? 2 : 1, 3);
    put(114, 157, 5, 3); put(118, 157, 3, 3);
    // window frame (glass drawn per frame)
    for (let y = WIN.y - 1; y <= WIN.y + WIN.h; y++) for (let x = WIN.x - 1; x <= WIN.x + WIN.w; x++) put(x, y, 11, 3);
    for (let x = WIN.x - 1; x <= WIN.x + WIN.w; x++) put(x, WIN.y + WIN.h, 5, 3); // sill

    // ---- lighthouse tower: a tapered cylinder lit from the gap (left), core shadow, cold reflected edge
    const tw = TOWER;
    const twr = mulberry32(31);
    // value across the shaft: lit flank, core shadow, a cold reflected edge
    const TP = [[-1, 5.2], [-0.86, 6.7], [-0.6, 7.6], [-0.3, 7.05], [0, 6.0], [0.25, 5.0], [0.5, 4.0], [0.68, 3.0], [0.82, 3.0], [0.9, 4.1], [0.96, 3.4], [1, 2.6]];
    const towerV = (u, f) => {
      let k = 0;
      while (k < TP.length - 2 && u > TP[k + 1][0]) k++;
      const [u0, v0] = TP[k], [u1, v1] = TP[k + 1];
      const v = v0 + (v1 - v0) * clamp((u - u0) / (u1 - u0), 0, 1);
      return v + 0.3 * (1 - f) - 0.6 * f * f;
    };
    for (let y = tw.top; y <= tw.base; y++) {
      const f = (y - tw.top) / (tw.base - tw.top);
      const hw = tw.hwT + (tw.hwB - tw.hwT) * f;
      for (let x = Math.floor(TOWER_X - hw); x <= Math.ceil(TOWER_X + hw); x++) {
        const u = (x + 0.5 - TOWER_X) / hw;
        if (Math.abs(u) > 1) continue;
        // band seams get a one-pixel checker, the rest stays solid
        put(x, y, clamp(qd(towerV(u, f), x, y, 5), 2, 8), 2);
      }
    }
    // weathering: damp streaks running down from the gallery and the windows, a few lit wet patches
    const drip = (x, y0, len) => { for (let k = 0; k < len; k++) { const i = (y0 + k) * W + x; if (sprKind[i] === 2) spr[i] = Math.max(2, spr[i] - 1); } };
    for (const [dx, y0, len] of [[-4, 81, 6], [-1, 81, 3], [2, 82, 5], [5, 81, 4], [-3, 97, 4], [0, 115, 3], [-5, 120, 5], [3, 128, 4], [-2, 136, 3], [4, 142, 5], [-6, 147, 4]]) drip(TOWER_X + dx, y0, len);
    for (const [dx, y] of [[-6, 90], [-5, 104], [-6, 125], [-4, 140], [-5, 151], [-3, 110]]) {
      for (let k = 0; k < 2; k++) { const i = (y + k) * W + TOWER_X + dx; if (sprKind[i] === 2) spr[i] = Math.min(8, spr[i] + 1); }
    }
    // the lantern's warm light reaching down on the shadow side of the upper shaft
    for (let y = tw.top + 1; y <= tw.top + 6; y++) {
      const f = (y - tw.top) / (tw.base - tw.top), hw = tw.hwT + (tw.hwB - tw.hwT) * f;
      for (let x = Math.floor(TOWER_X - hw); x <= Math.ceil(TOWER_X + hw); x++) {
        const u = (x + 0.5 - TOWER_X) / hw;
        const i = y * W + x;
        if (sprKind[i] !== 2 || Math.abs(u) > 1) continue;
        const k = (y - tw.top) / 6;
        if (u > 0.55 && y === tw.top + 1 && (x & 1)) spr[i] = 11;
      }
    }
    // a plinth where the tower meets the rock
    for (let x = TOWER_X - 11; x <= TOWER_X + 11; x++) { put(x, tw.base - 1, x < TOWER_X - 4 ? 4 : x < TOWER_X + 5 ? 3 : 2, 2); put(x, tw.base, 1, 2); }
    // door & slit windows
    for (let y = tw.base - 8; y < tw.base - 1; y++) for (let x = TOWER_X - 2; x <= TOWER_X; x++) put(x, y, y === tw.base - 8 ? 2 : 1, 2);
    put(TOWER_X - 3, tw.base - 8, 3, 2); put(TOWER_X + 1, tw.base - 8, 3, 2);
    for (const [wy, wx] of [[134, -1], [114, 0], [96, -1]]) { put(TOWER_X + wx, wy - 1, 4, 2); put(TOWER_X + wx, wy, 1, 2); put(TOWER_X + wx, wy + 1, 1, 2); put(TOWER_X + wx, wy + 2, 3, 2); }
    // corbelled gallery
    const gy = tw.top;
    for (let k = 0; k < 3; k++) {
      const hw = tw.hwT + 1 + k;
      for (let x = Math.round(TOWER_X - hw); x <= Math.round(TOWER_X + hw); x++) {
        const u = (x + 0.5 - TOWER_X) / hw;
        put(x, gy - k, k === 2 ? (u < -0.2 ? 6 : u < 0.35 ? 12 : 3) : (u < -0.3 ? 4 : u < 0.4 ? 3 : 2), 2);
      }
    }
    // gallery deck and railing
    const deck = gy - 3;
    for (let x = TOWER_X - 10; x <= TOWER_X + 10; x++) put(x, deck, x < TOWER_X - 3 ? 7 : x < TOWER_X + 4 ? 6 : 4, 2);
    for (let x = TOWER_X - 10; x <= TOWER_X + 10; x++) put(x, deck - 4, 3, 2);
    for (let x = TOWER_X - 10; x <= TOWER_X + 10; x += 2) for (let y = deck - 3; y < deck; y++) put(x, y, 2, 2);
    // the whole island sits DY rows lower so the horizon sits on the lower third
    for (let y = H - 1; y >= 0; y--) for (let x = 0; x < W; x++) {
      const i = y * W + x, j = (y - DY) * W + x;
      spr[i] = y - DY >= 0 ? spr[j] : 255;
      sprKind[i] = y - DY >= 0 ? sprKind[j] : 0;
    }
  }
  // lantern geometry
  const LAN = { cx: TOWER_X, y0: 66 - 5, y1: 66 + 5, hw: 5 };

  // ---------------------------------------------------------------- sea
  const TWO_PI = Math.PI * 2;
  const W0 = TWO_PI / LOOP;
  const G = 9.81;
  const WAVES = [];
  (function () {
    // [harmonic n, direction deg (0 = toward camera, + = toward right), amplitude, phase, sharpness]
    const spec = [
      [2, 12, 1.9, 0.3, 3.0],     // the main swell: crests stacked toward the viewer
      [2, -38, 0.55, 2.1, 1.6],   // a cross swell: crest heights vary along each ridge
      [1, 4, 0.9, 4.0, 1.4],      // the long heave
      [3, 30, 0.14, 1.2, 1.3],
      [3, -20, 0.12, 5.1, 1.3],
      [4, 50, 0.06, 0.7, 1.2],
      [4, -10, 0.06, 2.6, 1.2],
      [5, 20, 0.035, 3.9, 1.0],
    ];
    for (const [n, deg, A, ph, p] of spec) {
      const w = W0 * n, k = w * w / G, a = deg * Math.PI / 180;
      WAVES.push({ n, w, k, dx: Math.sin(a), dz: -Math.cos(a), A, ph, p, lam: TWO_PI / k });
    }
  })();
  const ROCKC = [XL - 6, ZL + 9], ROCKR = [25, 19];

  // height field with analytic slope; lod = metres per pixel
  function seaH(X, Z, t, lod, out) {
    let h = 0, hx = 0, hz = 0, bx = 0, bz = 0;
    for (let i = 0; i < WAVES.length; i++) {
      const wv = WAVES[i];
      const fadeA = clamp(1.6 - lod * 7 / wv.lam, 0, 1);
      if (fadeA <= 0) continue;
      const th = wv.k * (wv.dx * X + wv.dz * Z) - wv.w * t + wv.ph;
      const c = Math.cos(th), s = Math.sin(th);
      const q = (c + 1) * 0.5;
      const qp = Math.pow(q, wv.p);
      const A = wv.A * fadeA;
      h += A * (2 * qp - 1);
      const dth = -A * wv.p * (qp / (q + 1e-6)) * s; // dh/dtheta
      hx += dth * wv.k * wv.dx; hz += dth * wv.k * wv.dz;
      if (wv.n <= 2) { bx += dth * wv.k * wv.dx; bz += dth * wv.k * wv.dz; }
    }
    out[0] = h; out[1] = hx; out[2] = hz; out[3] = bx; out[4] = bz;
  }

  // ---------------------------------------------------------------- rain (periodic over the loop)
  const RAIN = [];
  (function () {
    const r2 = mulberry32(991);
    for (let i = 0; i < 560; i++) RAIN.push({ x: r2() * (W + 40), y: r2() * (H + 40), near: 0, len: 2 + (r2() < 0.4 ? 1 : 0) });
    for (let i = 0; i < 110; i++) RAIN.push({ x: r2() * (W + 40), y: r2() * (H + 40), near: 1, len: 4 + Math.floor(r2() * 3) });
  })();

  // ---------------------------------------------------------------- per-frame buffers
  const out = new Uint8Array(W * H);
  const seaIdx = new Uint8Array(W * H);
  const seaZ = new Float32Array(W * H);
  const seaFoam = new Uint8Array(W * H);
  const seaV = new Float32Array(W * H), seaF = new Float32Array(W * H), seaSurf = new Float32Array(W * H);
  const seaCrest = new Uint8Array(W * H);
  const seaL = new Float32Array(W * H);
  let seaLace = 0, seaNbv = 0;
  const seaNb = new Float32Array(W * H);
  const seaVs = new Float32Array(W * H), seaFs = new Float32Array(W * H);
  const seaFoot = new Float32Array(W * H);
  const seaGlint = new Float32Array(W * H);
  const isSea = new Uint8Array(W * H);
  const rainBuf = new Uint8Array(W * H);
  const lamI = new Float32Array(W * H);
  const glowI = new Float32Array(W * H);
  const hb = [0, 0, 0, 0, 0];

  const BEAM_TILT = 0.01, SIGH = 0.036, SIGV = 0.042, SIGV2 = 0.15, SKIRT = 0.08, EXT = 320;
  function beamDir(phi) {
    const tilt = BEAM_TILT;
    return [Math.cos(phi) * Math.cos(tilt), -Math.sin(tilt), Math.sin(phi) * Math.cos(tilt)];
  }
  const PHI0 = 0.35;
  const phiAt = t => PHI0 + TWO_PI * t / LOOP;

  function renderSea(t, A) {
    isSea.fill(0); seaZ.fill(1e9); seaFoam.fill(0); seaFoot.fill(0); seaGlint.fill(0);
    const lampDirAz = Math.atan2(A[2], A[0]);
    for (let x = 0; x < W; x++) {
      const rx = (x + 0.5 - CX) / F;
      let ymin = H;
      let z = 9;
      while (z < 7000 && ymin > HY - 30) {
        const X = rx * z;
        const lod = z / F;
        seaH(X, z, t, lod, hb);
        let h = hb[0], hx = hb[1], hz = hb[2];
        // surf on the rock: white water heaped against the base
        const ex = (X - ROCKC[0]) / ROCKR[0], ez = (z - ROCKC[1]) / ROCKR[1];
        const e = Math.sqrt(ex * ex + ez * ez);
        let surf = 0;
        if (e < 1) { h = -50; }
        else if (e < 1.9) {
          const ph = WAVES[0].k * (WAVES[0].dx * X + WAVES[0].dz * z) - WAVES[0].w * t + WAVES[0].ph;
          const surge = Math.pow(0.5 + 0.5 * Math.cos(ph - 0.6), 3);
          surf = (1 - (e - 1) / 0.9);
          surf = surf * surf * (0.35 + 0.65 * surge);
          const plume = Math.max(0, 0.55 + noise(X * 0.9, z * 0.3) + 0.6 * noise(X * 2.3 + 7, z * 0.7));
          h += surf * 3.8 * (0.2 + 0.8 * surge) * plume;
        }
        const sy = HY + F * (CAMH - h) / z;
        const yTop = Math.ceil(sy - 0.5);
        if (yTop < ymin) {
          // ---- shade
          let nx = -hx, ny = 1, nz = -hz;
          const nl = Math.hypot(nx, ny, nz); nx /= nl; ny /= nl; nz /= nl;
          let vx = -X, vy = CAMH - h, vz = -z;
          const vl = Math.hypot(vx, vy, vz); vx /= vl; vy /= vl; vz /= vl;
          const ndv = Math.max(0.0, nx * vx + ny * vy + nz * vz);
          const fr = 0.02 + 0.98 * Math.pow(1 - ndv, 5);
          const rxv = 2 * ndv * nx - vx, ryv = 2 * ndv * ny - vy, rzv = 2 * ndv * nz - vz;
          // reflected sky: bright near the horizon, the moonlit gap up-left
          const el = ryv;
          let skyv = el < 0 ? 1.4 : 3.5 - 2.2 * smooth(0, 0.35, el);
          const gx = -0.42, gy = 0.38, gz = 0.82;
          const gd = Math.max(0, rxv * gx + ryv * gy + rzv * gz);
          skyv += 2.4 * Math.pow(gd, 10);
          // ---- designed value: every swell is one shape, toned by where we are on it
          const W1 = WAVES[0], W2 = WAVES[1], W3 = WAVES[2];
          const th1 = W1.k * (W1.dx * X + W1.dz * z) - W1.w * t + W1.ph;
          const th2 = W2.k * (W2.dx * X + W2.dz * z) - W2.w * t + W2.ph;
          const th3 = W3.k * (W3.dx * X + W3.dz * z) - W3.w * t + W3.ph;
          const tw1 = Math.atan2(Math.sin(th1), Math.cos(th1));   // 0 = crest, + = forward face (toward us), - = back slope
          const chf = 0.5 + 0.5 * Math.cos(th2);                   // how tall this stretch of the ridge is
          const heave = 0.5 + 0.5 * Math.cos(th3);
          let tone;
          if (tw1 >= 0) {
            // lip, then the steep forward face darkening into the trough
            tone = tw1 < 0.2 ? 4.2 : 1.05 + 2.9 * Math.exp(-(tw1 - 0.2) / 0.5);
          } else {
            // back slope rising to the crest, catching the cold light of the gap
            tone = 1.05 + 2.75 * Math.pow(smooth(-2.7, 0, tw1), 1.4);
          }
          tone += 0.55 * (chf - 0.5) + 0.3 * (heave - 0.5);
          tone += 0.35 * smooth(170, 20, x) * smooth(-2.2, -0.2, tw1);  // back slopes on the left face the gap
          // distance: bands compress, contrast drops into the horizon haze
          const far = smooth(160, 1400, z);
          tone = tone * (1 - far) + (2.75 + 0.3 * (tone - 2.5)) * far;
          let v = tone;
          // ---- foam, by energy
          const u1 = th1 / TWO_PI, u2 = th2 / TWO_PI;
          const sL = -W1.dz * X + W1.dx * z;                    // coordinate along the ridge
          const crestNo = u1;                                    // which ridge (periodic in phase)
          const E = chf * 0.7 + heave * 0.3;                     // crest energy
          const lodF = clamp(1.4 - lod * 3.0, 0, 1);
          const segN = noise(crestNo * 3, sL * 0.05, 3, 0) + 0.5 * noise(crestNo * 3 + 1.7, sL * 0.16, 3, 0);
          const brk = smooth(0.35, 0.75, E) * smooth(-0.25, 0.15, segN);   // this stretch is breaking
          const lip = Math.exp(-Math.pow((tw1 - 0.06) / 0.13, 2));
          const tailN = noise(crestNo * 5 + 2.2, sL * 0.42, 5, 0);
          const tail = tw1 > 0.1 ? Math.exp(-(tw1 - 0.1) / 0.6) * smooth(0.0, 0.3, tailN) : 0;
          const n1 = noise(u1 * 11, u2 * 11, 11, 11), n2 = noise(u1 * 27 + 5, u2 * 27 + 1, 27, 27);
          const lace = 1 - Math.abs(n1 + 0.45 * n2) * 3.6;            // ridged network
          const behind = tw1 < 0 ? smooth(-1.5, -0.05, tw1) : 0;
          let foam = brk * (1.5 * lip + 1.5 * tail * lodF + 1.1 * behind * smooth(0.4, 0.8, lace) * lodF);
          // a lace of old foam drifting down the face below a breaking stretch, joined to its tails
          if (tw1 > 0.25) foam += brk * 1.05 * Math.exp(-(tw1 - 0.25) / 0.6) * smooth(0.5, 0.85, lace) * lodF * smooth(160, 80, z);
          foam += lip * 0.62 * smooth(0.3, 0.7, E) * (1 - lodF * 0.5) * smooth(900, 300, z);  // thin lit lip on most ridges
          foam += surf * (1.2 + 1.2 * smooth(-0.2, 0.3, segN + 0.4 * Math.sin(X * 1.3)));
          foam *= smooth(1300, 450, z);
          seaNbv = segN;
          const crest = 0;
          // ---- beam footprint on the water (crests flash)
          const dxL = X - P[0], dyL = h - P[1], dzL = z - P[2];
          const hd = Math.hypot(dxL, dzL);
          let daz = Math.atan2(dzL, dxL) - lampDirAz;
          daz = Math.atan2(Math.sin(daz), Math.cos(daz));
          const elv = Math.atan2(dyL, hd) + 0.012;
          let foot = Math.exp(-Math.pow(daz / 0.075, 2)) * Math.exp(-Math.pow(elv / 0.11, 2)) * (1.0 / (1 + hd / 900));
          // lamp glint: reflection of the lantern in wave faces
          const lx = P[0] - X, ly = P[1] - h, lz = P[2] - z, ll = Math.hypot(lx, ly, lz);
          const rl = (rxv * lx + ryv * ly + rzv * lz) / ll;
          const glint = rl > 0 ? Math.pow(rl, 70) * Math.exp(-Math.pow((x + 0.5 - TOWER_X) / 6, 2)) * smooth(60, 120, z) : 0;
          for (let y = Math.max(yTop, 0); y < ymin; y++) {
            if (y >= H) continue;
            const i = y * W + x;
            seaV[i] = v; seaZ[i] = z; isSea[i] = 1; seaF[i] = foam; seaSurf[i] = surf; seaCrest[i] = crest; seaL[i] = seaLace; seaNb[i] = seaNbv;
            seaFoot[i] = foot; seaGlint[i] = glint;
          }
          ymin = yTop;
        }
        z += Math.max(0.05, z * 0.005);
      }
    }
    quantiseSea();
  }
  // turn the continuous sea fields into clean pixel clusters
  function modeFilter(buf, mask, y0, passes, minSame) {
    const cnt = new Uint8Array(16);
    const tmp = new Uint8Array(buf);
    for (let p = 0; p < passes; p++) {
      tmp.set(buf);
      for (let y = Math.max(1, y0); y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
        const i = y * W + x;
        if (!mask[i]) continue;
        const c = tmp[i];
        cnt.fill(0);
        let same = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const j = i + dy * W + dx;
          if (!mask[j]) continue;
          const k = tmp[j]; cnt[k]++;
          if (k === c) same++;
        }
        // horizontal slivers: one pixel tall, same colour above and below
        const sliver = tmp[i - W] === tmp[i + W] && tmp[i - W] !== c && mask[i - W] && mask[i + W];
        if (same - 1 >= minSame && !sliver) continue;
        let best = c, bc = 0;
        for (let k = 0; k < 16; k++) if (cnt[k] > bc) { bc = cnt[k]; best = k; }
        if (sliver) best = tmp[i - W];
        buf[i] = best;
      }
    }
  }
  // connected-component cleanup: islands smaller than minSize take the commonest colour around them
  const ccLabel = new Int32Array(W * H), ccQueue = new Int32Array(W * H);
  function killIslands(buf, mask, y0, minSize, keepBigger) {
    ccLabel.fill(0, y0 * W);
    const cnt = new Uint16Array(16);
    let lab = 0;
    for (let i0 = y0 * W; i0 < W * H; i0++) {
      if (!mask[i0] || ccLabel[i0]) continue;
      lab++;
      const c = buf[i0];
      let qh = 0, qt = 0;
      ccQueue[qt++] = i0; ccLabel[i0] = lab;
      while (qh < qt) {
        const i = ccQueue[qh++], x = i % W;
        const nb4 = [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, i - W >= y0 * W ? i - W : -1, i + W < W * H ? i + W : -1];
        for (const j of nb4) {
          if (j < 0 || !mask[j] || ccLabel[j] || buf[j] !== c) continue;
          ccLabel[j] = lab; ccQueue[qt++] = j;
        }
      }
      if (qt >= minSize || (keepBigger && c >= keepBigger)) continue;
      // repaint the island with the commonest bordering colour
      cnt.fill(0);
      for (let k = 0; k < qt; k++) {
        const i = ccQueue[k], x = i % W;
        for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, i - W, i + W]) {
          if (j < y0 * W || j >= W * H || !mask[j] || buf[j] === c) continue;
          cnt[buf[j]]++;
        }
      }
      let best = c, bc = 0;
      for (let k = 0; k < 16; k++) if (cnt[k] > bc) { bc = cnt[k]; best = k; }
      for (let k = 0; k < qt; k++) buf[ccQueue[k]] = best;
    }
  }
  function quantiseSea() {
    const y0 = HY - 30;
    // light depth-aware smoothing so band edges follow the ridges, not the sampling grid
    const sv = seaVs;
    for (let y = y0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (!isSea[i]) continue;
      let acc = 0, facc = 0, wsum = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx, yy = y + dy;
        if (xx < 0 || xx >= W || yy < y0 || yy >= H) continue;
        const j = yy * W + xx;
        if (!isSea[j]) continue;
        const r = seaZ[j] / seaZ[i];
        if (r > 1.06 || r < 0.943) continue;
        const w = (dy === 0 ? 2 : 1) * (dx === 0 ? 2 : 1);
        acc += seaV[j] * w; facc += seaF[j] * w; wsum += w;
      }
      sv[i] = acc / wsum;
      seaFs[i] = 0.5 * facc / wsum + 0.5 * seaF[i];
    }
    for (let y = y0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (!isSea[i]) continue;
      const v = sv[i];
      seaIdx[i] = v < 1.75 ? 1 : v < 2.45 ? 2 : v < 3.15 ? 3 : v < 3.85 ? 4 : 5;
    }
    modeFilter(seaIdx, isSea, y0, 1, 2);
    killIslands(seaIdx, isSea, y0, 7, 0);
    // crest lines: where a ridge hides the water behind it, its lip is drawn as one crisp line
    for (let y = y0 + 1; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (!isSea[i] || !isSea[i - W]) continue;
      if (seaZ[i - W] > seaZ[i] * 1.1 && seaZ[i] < 1400) {
        seaIdx[i] = seaZ[i] < 260 ? 6 : 5;
        if (y + 1 < H && isSea[i + W] && seaZ[i] < 200 && seaIdx[i + W] < 4) seaIdx[i + W] = 4;
      }
    }
    // foam
    seaFoam.fill(0);
    for (let y = y0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (!isSea[i]) continue;
      const f = seaFs[i];
      seaFoam[i] = f > 1.2 ? 3 : f > 0.82 ? 2 : f > 0.5 ? 1 : 0;
    }
    modeFilter(seaFoam, isSea, y0, 1, 2);
    killIslands(seaFoam, isSea, y0, 5, 0);
    for (let y = y0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const fl = seaFoam[i];
      if (!isSea[i] || !fl) continue;
      let c = fl === 1 ? 7 : fl === 2 ? 8 : 9;
      // foam has volume: bright along its top edge, shadowed on its underside
      const above = y > y0 ? seaFoam[i - W] : 0, below = y + 1 < H ? seaFoam[i + W] : 0;
      if (!above && fl >= 2) c = Math.min(10, c + 1);
      else if (!below && c > 7) c -= 1;
      // surf is white water: bright crown, grey underside
      if (seaSurf[i] > 0.25) c = !above ? 10 : !below ? 8 : 9;
      // taper the ends of thin foam runs so lips read as drawn strokes, not bars
      const lf = x > 0 ? seaFoam[i - 1] : 0, rf = x < W - 1 ? seaFoam[i + 1] : 0;
      if ((!lf || !rf) && !(above && below) && c > 7) c -= 1;
      if (seaZ[i] > 1000) c = Math.min(c, 8);
      seaIdx[i] = c;
    }
  }

  // ---------------------------------------------------------------- beam volume
  let GLOW_R = 5.5;
  function beamField(t, A) {
    // camera-ray integral of the scattered beam + the lamp's omni glow
    const Cx = C[0], Cy = C[1], Cz = C[2];
    const W0B = 1.3;
    // is the camera inside the beam's fan?
    let camIn = false;
    {
      const px = C[0] - P[0], py = C[1] - P[1], pz = C[2] - P[2];
      const sC = px * A[0] + py * A[1] + pz * A[2];
      if (sC > 0) {
        const hl0 = Math.hypot(A[0], A[2]);
        const ehx0 = A[2] / hl0, ehz0 = -A[0] / hl0;
        const qx = px - sC * A[0], qy = py - sC * A[1], qz = pz - sC * A[2];
        const qh = qx * ehx0 + qz * ehz0, qv = Math.sqrt(Math.max(0, qx * qx + qy * qy + qz * qz - qh * qh));
        const wh = SIGH * sC + W0B, wv = SIGV2 * sC + W0B;
        camIn = Math.exp(-qh * qh / (wh * wh) - qv * qv / (wv * wv)) > 0.004;
      }
    }
    // beam basis: horizontal and vertical directions across the fan
    const hl = Math.hypot(A[0], A[2]);
    const ehx = A[2] / hl, ehz = -A[0] / hl;            // horizontal, perpendicular to the axis
    const evx = A[1] * ehz, evy = A[2] * ehx - A[0] * ehz, evz = -A[1] * ehx; // A x eh
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        let dx = (x + 0.5 - CX) / F, dy = (HY - (y + 0.5)) / F, dz = 1;
        const dl = Math.hypot(dx, dy, dz); dx /= dl; dy /= dl; dz /= dl;
        // scene depth along the ray
        let umax = 6000;
        if (isSea[i] && !(spr[i] !== 255 && seaZ[i] >= ZSPR)) umax = seaZ[i] / dz;
        else if (spr[i] !== 255) umax = ZSPR / dz;
        // closest approach between view ray and beam axis
        const w0x = Cx - P[0], w0y = Cy - P[1], w0z = Cz - P[2];
        const b = dx * A[0] + dy * A[1] + dz * A[2];
        const d = dx * w0x + dy * w0y + dz * w0z;
        const e = A[0] * w0x + A[1] * w0y + A[2] * w0z;
        const den = Math.max(1e-6, 1 - b * b);
        let uc = (b * e - d) / den;
        const sinA = Math.sqrt(den);
        let I = 0;
        // integration window around the closest approach
        const sc = Math.max(1, (e - b * d) / den);
        const wid = SIGV2 * sc + W0B;
        let half = 4.5 * wid / Math.max(sinA, 0.02);
        let u0 = Math.max(0, uc - half), u1 = Math.min(umax, uc + half);
        let N = 28;
        // rain scatters forward: a beam aimed away from us is dimmer than one aimed at us (Henyey-Greenstein, g = 0.35)
        const cth = -(dx * A[0] + dy * A[1] + dz * A[2]);
        const phase = Math.min(2.1, 0.8775 / Math.pow(1.1225 - 0.7 * cth, 1.5) / 0.738);
        if (camIn) { u0 = 0; u1 = Math.min(umax, ZL * 1.6); N = 56; }   // viewer inside the fan: the whole near air glows
        if (u1 > u0) {
          const du = (u1 - u0) / N;
          for (let k = 0; k < N; k++) {
            const u = u0 + (k + 0.5) * du;
            const px = Cx + dx * u - P[0], py = Cy + dy * u - P[1], pz = Cz + dz * u - P[2];
            const s = px * A[0] + py * A[1] + pz * A[2];
            if (s <= 0) continue;
            const qx = px - s * A[0], qy = py - s * A[1], qz = pz - s * A[2];
            const qh = qx * ehx + qz * ehz, qv = qx * evx + qy * evy + qz * evz;
            const wh = SIGH * s + W0B, wv = SIGV * s + W0B, wv2 = SIGV2 * s + W0B;
            const gh = Math.exp(-qh * qh / (wh * wh));
            // a tight core plus the lens's faint vertical skirt; rain extinguishes the far beam
            I += gh * (Math.exp(-qv * qv / (wv * wv)) / (wh * wv) + SKIRT * Math.exp(-qv * qv / (wv2 * wv2)) / (wh * wv2)) * Math.exp(-s / EXT) * phase * du;
          }
        }
        // omni glow of the lantern scattered by rain haze (analytic 1/r^2 line integral)
        const tc = -(dx * w0x + dy * w0y + dz * w0z); // u of closest approach to lamp point
        const qx = Cx + dx * tc - P[0], qy = Cy + dy * tc - P[1], qz = Cz + dz * tc - P[2];
        const dd = Math.sqrt(qx * qx + qy * qy + qz * qz) + 0.6;
        const ua = Math.min(umax, 1e5);
        const glow = (Math.atan((ua - tc) / dd) - Math.atan((0 - tc) / dd)) / dd;
        lamI[i] = I;
        glowI[i] = glow * Math.exp(-dd / GLOW_R);
      }
    }
  }

  function lift(i, k) {
    if (k <= 0) return i;
    if (i >= 11) return Math.min(15, i + k);
    const j = (i === 0 ? 1 : i) + k;
    return j > 10 ? 10 : j;
  }

  function drawRain(t) {
    rainBuf.fill(0);
    for (const r of RAIN) {
      const cyc = r.near ? 9 : 6, cx = r.near ? 3 : 2;
      const Wp = W + 40, Hp = H + 40;
      const vy = cyc * Hp / LOOP, vx = cx * Wp / LOOP;
      const x = ((r.x + vx * t) % Wp + Wp) % Wp - 20;
      const y = ((r.y + vy * t) % Hp + Hp) % Hp - 20;
      const sl = vx / vy;
      for (let k = 0; k < r.len; k++) {
        const yy = Math.floor(y - k), xx = Math.floor(x - k * sl);
        if (xx >= 0 && xx < W && yy >= 0 && yy < H) rainBuf[yy * W + xx] = r.near ? 2 : 1;
      }
    }
  }

  // ---------------------------------------------------------------- frame
  const WALK_T = 1.2, WALK_D = 0.75; // the keeper passes the window while the beam faces away
  const DBG = { noBeam: false };
  function renderFrame(t) {
    t = ((t % LOOP) + LOOP) % LOOP;
    const phi = phiAt(t);
    const A = beamDir(phi);
    renderSea(t, A);
    beamField(t, A);
    drawRain(t);
    // glare toward the camera
    const pcx = C[0] - P[0], pcy = C[1] - P[1], pcz = C[2] - P[2], pcl = Math.hypot(pcx, pcy, pcz);
    let dAz = Math.atan2(pcz, pcx) - Math.atan2(A[2], A[0]);
    dAz = Math.atan2(Math.sin(dAz), Math.cos(dAz));
    const dEl = Math.atan2(pcy, Math.hypot(pcx, pcz)) - Math.asin(A[1]);
    const glare = Math.exp(-Math.pow(dAz / 0.06, 2) - Math.pow(dEl / 0.16, 2));
    const nearLit = Math.exp(-Math.pow(dAz / 0.09, 2) - Math.pow(dEl / 0.2, 2));
    frameGlare = glare;

    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x;
      let c;
      const s = spr[i];
      if (s !== 255 && !(isSea[i] && seaZ[i] < ZSPR)) c = s;
      else if (isSea[i]) c = seaIdx[i];
      else c = sky[i];
      out[i] = c;
    }
    // ---- window, and the keeper walking past it (a dark figure crossing the lit room)
    const wt = (t - WALK_T) / WALK_D;
    const walking = wt > 0 && wt < 1;
    const fx = -2.5 + wt * (WIN.w + 5);              // figure centre in window pixels
    let covered = 0;
    for (let yy = 0; yy < WIN.h; yy++) for (let xx = 0; xx < WIN.w; xx++) {
      const x = WIN.x + xx, y = WIN.y + yy + DY;
      let c = yy < 3 ? 14 : 13;
      if (xx === 5 && yy === 3) c = 15;              // the lamp on the table
      if (walking) {
        const d = Math.abs(xx + 0.5 - fx);
        const fig = yy <= 1 ? d < 1.0 : yy === 2 ? d < 1.55 : d < 2.0;   // head, shoulders, body
        if (fig) { c = 11; covered++; }
      }
      if (xx === 3 || yy === 3) c = c === 11 ? 11 : 12; // glazing bars
      out[y * W + x] = c;
    }
    const winLight = 1 - covered / (WIN.w * WIN.h) * 1.4;
    // a thin line of light on the ground below the sill
    for (let x = WIN.x - 1; x <= WIN.x + WIN.w; x++) {
      const i = (COTT.base + DY) * W + x;
      if (sprKind[i] !== 1 || (isSea[i] && seaZ[i] < ZSPR)) continue;
      if (winLight > 0.5 && ((x + COTT.base) & 1) === 0) out[i] = 11;
    }
    // ---- lantern
    lanMask.fill(0);
    drawLantern(t, phi, glare);
    // ---- beam: lift the scene by dithered levels
    if (DBG.noBeam) return;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (lanMask[i]) { if (glare > 0.35 && out[i] >= 12) out[i] = 15; continue; }
      const lb = 6.4 * (1 - Math.exp(-lamI[i] * 1.05));
      const lg = 4.0 * (1 - Math.exp(-glowI[i] * (0.9 + 2.5 * glare)));
      let lam = lb + lg;
      // rain caught in the light
      const rb = rainBuf[i];
      if (rb === 1 && lb > 0.3) lam += 1.0 + 0.4 * lb;
      if (rb === 2) lam += nearLit * 4 + (lb > 0.6 ? 1.0 : 0);
      // beam hitting the water: crests flash
      if (isSea[i] && !(spr[i] !== 255 && seaZ[i] >= ZSPR)) {
        const ft = seaFoot[i] * (1.0 + 2.5 * nearLit);
        if (seaFoam[i]) { if (ft > 0.18) { out[i] = ft > 0.5 ? 15 : 10; continue; } lam += ft * 4; }
        else lam += ft * 2.2;
        const gl = seaGlint[i] * (0.2 + 6 * glare + 2.5 * seaFoot[i]);
        if (gl > 0.5) { out[i] = gl > 1.6 ? 15 : gl > 0.9 ? 14 : 13; continue; }
      }
      if (lam < 0.05) continue;
      const k = qd(lam, x, y, 1.35);
      if (k <= 0) continue;
      if (lg > 2.6 && k >= 6) { out[i] = 15; continue; }
      out[i] = lift(out[i], k);
    }
    // the flash: when the beam sweeps across the viewer, a four-point star on the lantern
    if (glare > 0.2) {
      const g = (glare - 0.2) / 0.8;
      const lh = Math.round(2 + 26 * g), lv = Math.round(1 + 15 * g);
      const cx0 = TOWER_X, cy0 = LAMP_SY;
      const spike = (dx, dy, len) => {
        for (let k = 1; k <= len; k++) {
          const x = cx0 + dx * k, y = cy0 + dy * k;
          if (x < 0 || x >= W || y < 0 || y >= H) continue;
          const f = 1 - k / (len + 1);
          let c = f > 0.7 ? 15 : f > 0.45 ? 10 : f > 0.25 ? 9 : 8;
          if (f < 0.25 && ((x + y) & 1)) continue;
          if (c > out[y * W + x] || out[y * W + x] < 11) out[y * W + x] = Math.max(out[y * W + x] >= 11 ? 0 : out[y * W + x], c);
        }
      };
      spike(1, 0, lh); spike(-1, 0, lh); spike(0, -1, lv); spike(0, 1, Math.round(lv * 0.6));
    }
  }
  let frameGlare = 0;

  function drawLantern(t, phi, glare) {
    const L = LAN, cx = L.cx;
    const deck = TOWER.top - 3;                    // 77
    // pedestal (the watch room wall behind the railing)
    for (let y = L.y1 + 1; y < deck; y++) for (let x = cx - 6; x <= cx + 6; x++) put2(x, y, x < cx - 3 ? 4 : x < cx + 2 ? 3 : 2);
    // glazing: lamp glow, a Fresnel lens with prism rings, astragals, the bright panel turning with the beam
    const bx = cx + Math.cos(phi) * L.hw * 0.95;
    const front = Math.sin(phi) < 0;
    for (let y = L.y0 + 1; y <= L.y1; y++) for (let x = cx - L.hw; x <= cx + L.hw; x++) {
      const dx = x - cx, ady = Math.abs(y - 66);
      let c = Math.abs(dx) >= 4 ? 12 : 13;
      if (Math.abs(dx) <= 1 && y >= 63 && y <= 69) c = (y & 1) ? 14 : 15;   // lens with prism rings
      if (Math.abs(dx) === 2 && ady <= 2) c = 14;
      const dpx = Math.abs(x + 0.5 - bx);
      if (front && dpx < 1.6) c = dpx < 0.9 ? 15 : Math.max(c, 14);
      if (!front && dpx < 1.0 && c < 14) c = 13;
      if (dx === -5 || dx === 5) c = 11;                                    // frame
      else if ((dx === -3 || dx === 3) && c < 15) c = c >= 14 ? 13 : 11;    // astragals
      if (y === L.y1) c = c >= 14 ? 13 : 12;                               // lower sill catches the light
      put2(x, y, c);
    }
    // cornice
    for (let x = cx - 6; x <= cx + 6; x++) put2(x, L.y0, x < cx - 2 ? 6 : x < cx + 3 ? 4 : 2);
    // dome: lit from the gap on its left, warm on the underside of the eave
    const dTop = L.y0 - 4;
    for (let y = dTop; y < L.y0; y++) {
      const k = (y - dTop + 1) / (L.y0 - dTop);
      const hw = 1 + (L.hw - 0.5) * Math.sqrt(k);
      for (let x = Math.round(cx - hw); x <= Math.round(cx + hw); x++) {
        const u = (x + 0.5 - cx) / hw;
        put2(x, y, u < -0.5 ? 6 : u < 0.1 ? 4 : u < 0.6 ? 3 : 2);
      }
    }
    put2(cx, dTop - 1, 6); put2(cx - 1, dTop - 1, 5); put2(cx + 1, dTop - 1, 3); // ventilator ball
    put2(cx, dTop - 2, 3); put2(cx, dTop - 3, 4); put2(cx, dTop - 4, 2);        // lightning rod
    // railing lit from above by the lantern
    for (let x = cx - 10; x <= cx + 10; x++) put2(x, deck - 4, Math.abs(x - cx) <= 6 ? 12 : (x < cx ? 5 : 3));
    for (let x = cx - 10; x <= cx + 10; x += 2) for (let y = deck - 3; y < deck; y++) put2(x, y, Math.abs(x - cx) <= 6 ? 11 : 2);
    for (let x = cx - 10; x <= cx + 10; x++) put2(x, deck, x < cx - 3 ? 7 : x < cx + 4 ? 6 : 4);
  }
  const lanMask = new Uint8Array(W * H);
  function put2(x, y, c) { y += DY; if (x >= 0 && x < W && y >= 0 && y < H) { out[y * W + x] = c; lanMask[y * W + x] = 1; } }

  // ---------------------------------------------------------------- init & output
  buildSky();
  buildSprite();

  const canvas = document.getElementById('c');
  const small = document.createElement('canvas'); small.width = W; small.height = H;
  const sctx = small.getContext('2d');
  const img = sctx.createImageData(W, H);
  function toImage() {
    const d = img.data;
    for (let i = 0; i < W * H; i++) { const p = PAL[out[i]]; d[i * 4] = p[0]; d[i * 4 + 1] = p[1]; d[i * 4 + 2] = p[2]; d[i * 4 + 3] = 255; }
    sctx.putImageData(img, 0, 0);
  }
  function present(scale) {
    canvas.width = W * scale; canvas.height = H * scale;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(small, 0, 0, W * scale, H * scale);
  }
  function renderAt(t, opts) {
    opts = opts || {};
    renderFrame(t);
    toImage();
    present(opts.scale || 5);
    return canvas;
  }
  function frameRGB(t) {
    renderFrame(t);
    let s = '';
    const bytes = new Uint8Array(W * H * 3);
    for (let i = 0; i < W * H; i++) { const p = PAL[out[i]]; bytes[i * 3] = p[0]; bytes[i * 3 + 1] = p[1]; bytes[i * 3 + 2] = p[2]; }
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(s);
  }
  function frameIdx(t) { renderFrame(t); return Array.from(out); }
  function debugI(t) { renderFrame(t); return [Array.from(lamI), Array.from(glowI)]; }

  const params = new URLSearchParams(location.search);
  window.__piece = { renderAt, frameRGB, frameIdx, debugI, DBG, W, H, LOOP, FPS, PAL: PAL_HEX };

  if (params.has('export')) { renderAt(0, { scale: 5 }); return; }
  if (params.has('t')) { renderAt(parseFloat(params.get('t')) || 0, { scale: 5 }); return; }
  // live playback, frame-quantised to 30 fps on the loop clock
  let start = null, last = -1;
  function tick(ts) {
    if (start === null) start = ts;
    const f = Math.floor(((ts - start) / 1000) * FPS) % (LOOP * FPS);
    if (f !== last) { last = f; renderAt(f / FPS, { scale: 5 }); }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
})();
