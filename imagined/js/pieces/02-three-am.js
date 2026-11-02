/* 3 a.m. — In Imagination, piece 02.
 *
 * "There are more things likely to frighten us than there are to crush us;
 *  we suffer more often in imagination than in reality."  (Seneca)
 *
 * A 38-second seamless loop. 3 a.m., a cosy two-storey house in moonlight, seen as a dollhouse cross-section.
 * THUD from downstairs: her eyes snap open; a creak. Fear draws itself over the house in boiling ink and
 * charcoal: the branch shadows grow claws, the wardrobe yawns and opens eyes, the landing stretches without end,
 * the coats on their hooks reach for her, her own shadow grows teeth, the stairs multiply and twist and something
 * huge and scribbled climbs them. Torch in one hand, slipper in the other, she clicks the torch on and walks down
 * into it; the beam burns the ink away. At the bottom: the cat, sitting in the saucepan it knocked off the
 * counter, extremely pleased with itself. The ink recedes, the kitchen light comes on, the words come; back in
 * bed, the cat curls up on her, purrs, then slips away downstairs... THUD.
 *
 * Two media in one frame. Reality is pixel art: a 366 x 456 palette image (64 colours, 4 x 4 Bayer dither),
 * lit per pixel by moonlight, the torch and the lamps, and shown at exactly 3x. Imagination is ink and charcoal
 * drawn at the full 1080 x 1350 with Canvas 2D over the pixels: tapered dry-brush strokes, hatching, scribble,
 * smear, splatter and a charcoal grain, all re-drawn ("boiling") at 10 fps from hashed jitter. Every frame is a
 * pure function of t; render hook: window.__threeam.
 */
(function () {
  'use strict';

  /* ================================================================ constants & helpers */
  const W = 360, H = 450, M = 3, AW = W + 2 * M, AH = H + 2 * M, NA = AW * AH, K = 3, D = 38;
  const OW = W * K, OH = H * K;
  const TAU = Math.PI * 2, fl = Math.floor;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, u) => a + (b - a) * u;
  const sstep = (a, b, x) => { const u = clamp((x - a) / (b - a), 0, 1); return u * u * (3 - 2 * u); };
  const s5 = (u) => { u = clamp(u, 0, 1); return u * u * u * (u * (u * 6 - 15) + 10); };
  const ph = (t, a, b) => clamp((t - a) / (b - a), 0, 1);
  const fr = (v) => v - fl(v);
  const mod = (a, n) => ((a % n) + n) % n;
  const back = (u, c) => { u = clamp(u, 0, 1); c = c === undefined ? 1.7 : c; const v = u - 1; return 1 + (c + 1) * v * v * v + c * v * v; };
  const win = (t, a, b, fi, fo) => s5(ph(t, a, a + fi)) * (1 - s5(ph(t, b - fo, b)));   // 0 -> 1 -> 0 window
  function ih(a, b, c) {
    let h = Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x165667b1) ^ Math.imul((c | 0) + 0x3c6ef372, 0x85ebca77);
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
    for (let k = 0; k < (o || 4); k++) { a += amp * vn2(x, y, s + k * 31); n += amp; x = x * 2.03 + 5.1; y = y * 2.03 + 1.7; amp *= 0.5; }
    return a / n;
  }
  const vn1 = (x, s) => { const i = fl(x), f = x - i, u = f * f * (3 - 2 * f); return lerp(ih(i, s, 5), ih(i + 1, s, 5), u); };
  const hx = (h) => [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  const mixc = (a, b, u) => [lerp(a[0], b[0], u), lerp(a[1], b[1], u), lerp(a[2], b[2], u)];
  const mulc = (a, k) => [a[0] * k, a[1] * k, a[2] * k];

  /* ================================================================ palette (65) */
  // class 0: anything may use it; 1: warm-only (skin, ginger, copper, pinks) - only clearly warm inputs;
  // 2: green-only (sage) - only greenish inputs. Moonlit surfaces therefore stay in the blues and greys.
  const PAL_DEF = [
    ['06060c', 0], ['0d0f1d', 0], ['151a2f', 0], ['1d2541', 0], ['27324f', 0], ['33415f', 0], ['435273', 0], ['566887', 0],
    ['6e819f', 0], ['8fa1bd', 0], ['b6c4da', 0], ['dfe7f1', 0],                                       // 0-11 night blues
    ['141316', 0], ['222125', 0], ['333236', 0], ['47454a', 0], ['5e5b60', 0], ['77747a', 0], ['939096', 0], ['b1aeb1', 0], ['d0ccca', 0], // 12-20 greys
    ['23140f', 0], ['362015', 0], ['4c2d1d', 0], ['653d26', 0], ['7f5131', 0], ['9b6840', 0], ['b8834f', 0], // 21-27 wood
    ['d9a85b', 0], ['efc472', 0], ['fbdc94', 0], ['fff0c4', 0],                                       // 28-31 honey, lamplight
    ['f2e6cc', 0], ['ddcca8', 0], ['bfa985', 0],                                                      // 32-34 cream
    ['26332b', 2], ['3a4c3f', 2], ['52695a', 2], ['6d8872', 2], ['8ea78e', 2], ['b5c9ab', 2], ['dbe5cc', 2], // 35-41 sage
    ['3b2119', 1], ['5a3324', 1], ['7c4a31', 1], ['9f6643', 1], ['c08559', 1], ['dca97f', 1],         // 42-47 skin
    ['4e230f', 1], ['7a3a16', 1], ['a85320', 1], ['d27430', 1], ['ee9a48', 1], ['fbc27a', 1], ['ffe1b0', 1], // 48-54 ginger
    ['5a2c22', 1], ['8d4430', 1], ['bd6a4b', 1], ['e3967a', 1],                                       // 55-58 copper
    ['a34b5a', 1], ['d77b86', 1], ['f2b3b4', 1],                                                      // 59-61 pinks
    ['3b2f4f', 0], ['584767', 0], ['7b6684', 0],                                                      // 62-64 violets
  ];
  const PAL = PAL_DEF.map((p) => hx(p[0])), CLS = PAL_DEF.map((p) => p[1]), NPAL = PAL.length;
  const QN = 64, LUT = new Uint8Array(QN * QN * QN);
  function nearest(r, g, b) {
    let best = 0, bd = 1e18;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), sat = mx > 1 ? (mx - mn) / mx : 0;
    const warmOK = sat > 0.2 && r > b * 1.15 && r >= g * 0.98;
    const greenOK = sat > 0.06 && g >= r * 0.95 && g >= b * 0.92;
    for (let k = 0; k < NPAL; k++) {
      if (CLS[k] === 1 && !warmOK) continue;
      if (CLS[k] === 2 && !greenOK) continue;
      const p = PAL[k], dr = r - p[0], dg = g - p[1], db = b - p[2], rm = (r + p[0]) * 0.5;
      const s = 1 / (14 + (r + g + b + p[0] + p[1] + p[2]) / 6);
      const d = ((2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db) * s;
      if (d < bd) { bd = d; best = k; }
    }
    return best;
  }
  function buildLUT() {
    const dec = new Float32Array(QN);
    for (let q = 0; q < QN; q++) { const u = q / (QN - 1); dec[q] = 255 * u * u; }
    for (let r = 0; r < QN; r++) for (let g = 0; g < QN; g++) for (let b = 0; b < QN; b++)
      LUT[(r << 12) | (g << 6) | b] = nearest(dec[r], dec[g], dec[b]);
  }
  const BAY = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16 - 0.5);
  const C = (i) => PAL[i];                       // a palette colour as an albedo

  /* ================================================================ raster: images and shapes */
  // An image: albedo c (rgb 0..255), optional part buffer p (0 = empty) for sprites.
  function img(w, h, parts) { return { w, h, c: new Float32Array(w * h * 3), p: parts ? new Uint8Array(w * h) : null }; }
  let TG = null, PART = 1;
  const target = (im) => { TG = im; };
  function put(x, y, col) {
    if (x < 0 || y < 0 || x >= TG.w || y >= TG.h) return;
    const i = y * TG.w + x, j = i * 3;
    TG.c[j] = col[0]; TG.c[j + 1] = col[1]; TG.c[j + 2] = col[2];
    if (TG.p) TG.p[i] = PART;
  }
  function span(y, x0, x1, col) {
    if (y < 0 || y >= TG.h) return;
    const a = Math.max(0, Math.ceil(x0 - 0.5)), b = Math.min(TG.w - 1, Math.floor(x1 - 0.5));
    if (typeof col === 'function') { for (let x = a; x <= b; x++) { const c = col(x, y); if (c) put(x, y, c); } }
    else for (let x = a; x <= b; x++) put(x, y, col);
  }
  function rect(x, y, w, h, col) { for (let yy = Math.round(y); yy < Math.round(y + h); yy++) span(yy, x, x + w, col); }
  function poly(pts, col) {
    let y0 = 1e9, y1 = -1e9;
    for (const p of pts) { y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
    const xs = [];
    for (let y = Math.max(0, fl(y0)); y <= Math.min(TG.h - 1, Math.ceil(y1)); y++) {
      const yc = y + 0.5; xs.length = 0;
      for (let i = 0, n = pts.length; i < n; i++) {
        const a = pts[i], b = pts[(i + 1) % n];
        if ((a[1] <= yc) !== (b[1] <= yc)) xs.push(a[0] + (yc - a[1]) / (b[1] - a[1]) * (b[0] - a[0]));
      }
      xs.sort((p, q) => p - q);
      for (let k = 0; k + 1 < xs.length; k += 2) span(y, xs[k], xs[k + 1], col);
    }
  }
  function ell(cx, cy, rx, ry, col) {
    for (let y = Math.max(0, fl(cy - ry)); y <= Math.min(TG.h - 1, Math.ceil(cy + ry)); y++) {
      const dy = (y + 0.5 - cy) / ry; if (dy * dy > 1) continue;
      const hw = rx * Math.sqrt(1 - dy * dy);
      span(y, cx - hw, cx + hw, col);
    }
  }
  // rotated ellipse
  function rell(cx, cy, rx, ry, a, col) {
    const ca = Math.cos(a), sa = Math.sin(a), R = Math.max(rx, ry);
    for (let y = Math.max(0, fl(cy - R)); y <= Math.min(TG.h - 1, Math.ceil(cy + R)); y++)
      for (let x = Math.max(0, fl(cx - R)); x <= Math.min(TG.w - 1, Math.ceil(cx + R)); x++) {
        const dx = x + 0.5 - cx, dy = y + 0.5 - cy, u = (dx * ca + dy * sa) / rx, v = (-dx * sa + dy * ca) / ry;
        if (u * u + v * v <= 1) put(x, y, typeof col === 'function' ? col(x, y) : col);
      }
  }
  // a capsule (thick segment) whose radius goes from r0 to r1
  function cap(x0, y0, x1, y1, r0, r1, col) {
    const R = Math.max(r0, r1), dx = x1 - x0, dy = y1 - y0, L2 = dx * dx + dy * dy || 1e-6;
    const xa = Math.max(0, fl(Math.min(x0, x1) - R)), xb = Math.min(TG.w - 1, Math.ceil(Math.max(x0, x1) + R));
    const ya = Math.max(0, fl(Math.min(y0, y1) - R)), yb = Math.min(TG.h - 1, Math.ceil(Math.max(y0, y1) + R));
    for (let y = ya; y <= yb; y++) for (let x = xa; x <= xb; x++) {
      const px = x + 0.5 - x0, py = y + 0.5 - y0, u = clamp((px * dx + py * dy) / L2, 0, 1);
      const ex = px - u * dx, ey = py - u * dy, r = r0 + (r1 - r0) * u;
      if (ex * ex + ey * ey <= r * r) put(x, y, typeof col === 'function' ? col(x, y) : col);
    }
  }
  function line(x0, y0, x1, y1, col) {
    const n = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))));
    for (let k = 0; k <= n; k++) put(fl(lerp(x0, x1, k / n)), fl(lerp(y0, y1, k / n)), col);
  }
  // a curve through points (polyline of capsules)
  function curve(pts, r, col) { for (let i = 0; i + 1 < pts.length; i++) cap(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], r, r, col); }
  // texture helpers: ordered 2-tone mixes and noise-varied shades
  const dith = (x, y) => BAY[((y & 3) << 2) | (x & 3)] + 0.5;
  const tex2 = (a, b, f) => (x, y) => (f(x, y) > dith(x, y) ? b : a);

  /* ================================================================ plates */
  // A plate is a painted set: albedo A, night light LN (rgb multipliers), warm light LW (lamps on), moon-shaft
  // strength MS (so cast shadows can take the moon away), emissive E (night) / EW (lamps on), and a foreground
  // layer FG (p = 1 where it covers the sprites).
  function newPlate(w, h) {
    return { w, h, A: img(w, h), LN: new Float32Array(w * h * 3), LW: new Float32Array(w * h * 3), MS: new Float32Array(w * h),
      E: new Float32Array(w * h * 3), EW: new Float32Array(w * h * 3), FG: img(w, h, true) };
  }
  const MOON = [0.66, 0.74, 1.0], WARM = [1.32, 1.0, 0.66], TORCH = [1.55, 1.18, 0.74];
  function glow(P, buf, x0, y0, x1, y1, col) { // add emissive over a rect
    for (let y = Math.max(0, y0); y < Math.min(P.h, y1); y++) for (let x = Math.max(0, x0); x < Math.min(P.w, x1); x++) {
      const j = (y * P.w + x) * 3; buf[j] += col[0]; buf[j + 1] += col[1]; buf[j + 2] += col[2];
    }
  }
  function emitShape(P, buf, col, fn) { // emissive where the albedo target was just painted by fn (uses a scratch mask)
    const m = img(P.w, P.h, true), keep = TG; target(m); PART = 1; fn(); target(keep);
    for (let i = 0; i < P.w * P.h; i++) if (m.p[i]) { buf[i * 3] += col[0]; buf[i * 3 + 1] += col[1]; buf[i * 3 + 2] += col[2]; }
  }

  /* ================================================================ the house, in cross-section */
  const HW = 964, HH = 700;
  const YA = 56, Y1 = 316, YS = 334, Y0 = 594, YF = 612;   // attic floor; upper floor; ground-floor ceiling; ground floor; footing
  const XL = 14, XR = 950, XP = 330, XP2 = 344;            // interior; bedroom/landing partition
  const XST = 640, XSB = 920, NST = 16, RISE = (Y0 - Y1) / NST, TREAD = (XSB - XST) / NST;
  const stepY = (x) => (x < XST ? Y1 : x >= XSB ? Y0 : Y1 + (fl((x - XST) / TREAD) + 1) * RISE);  // the tread under x
  const stairLine = (x) => Y1 + clamp((x - XST) / (XSB - XST), 0, 1) * (Y0 - Y1);                 // the pitch line
  const BED = { x0: 74, x1: 262, top: 264 }, NIGHT = { x0: 16, x1: 62, top: 270 };
  const WARD = { x0: 232, x1: 322, y0: 124, gap0: 272, gap1: 281 };                                // the wardrobe and its ajar door
  const COATS = [{ x: 500, y: 150, w: 34, h: 116, col: 'b07d4f' }, { x: 540, y: 152, w: 30, h: 100, col: '6d8872' }, { x: 572, y: 152, w: 12, h: 80, col: 'a34b5a' }];
  const PAN_X = 800, LIGHT_SW = [941, 500];
  // branch shadows thrown through the bedroom window onto the back wall (shared with the ink, which traces them)
  const BR = [];
  function buildBranches() {
    let s = 0;
    const grow = (x, y, a, len, w, d) => {
      const n = 4, pts = [[x, y]];
      for (let k = 0; k < n; k++) { a += (ih(s++, d, 3) - 0.5) * 0.5; x += Math.cos(a) * len / n; y += Math.sin(a) * len / n; pts.push([x, y]); }
      BR.push({ pts, w, d });
      if (d < 3) for (let k = 1; k <= 2; k++) {
        const p = pts[1 + fl(ih(s++, d, 9) * (n - 1))], sgn = ih(s++, d, 11) < 0.5 ? -1 : 1;
        grow(p[0], p[1], a + sgn * (0.45 + 0.4 * ih(s++, d, 12)), len * (0.5 + 0.18 * ih(s++, d, 13)), w * 0.6, d + 1);
      }
    };
    grow(10, 150, 0.42, 150, 5, 0);
    grow(10, 214, 0.2, 110, 3.6, 1);
  }
  function brMask(x, y) {
    let m = 0;
    for (const b of BR) for (let i = 0; i + 1 < b.pts.length; i++) {
      const a = b.pts[i], c = b.pts[i + 1], dx = c[0] - a[0], dy = c[1] - a[1], L2 = dx * dx + dy * dy;
      const u = clamp(((x - a[0]) * dx + (y - a[1]) * dy) / L2, 0, 1), ex = x - a[0] - u * dx, ey = y - a[1] - u * dy;
      const r = b.w * (1 - 0.35 * (i + u) / (b.pts.length - 1)), d = Math.sqrt(ex * ex + ey * ey);
      if (d < r + 1.5) m = Math.max(m, clamp(r + 1.5 - d, 0, 1.5) / 1.5);
    }
    return m;
  }
  // the moon shafts, as functions of a world point: 0..1
  function shaftBed(x, y) {               // bedroom: window in the left wall, light falling down-right
    if (x < XL || x > XP || y > Y1 || y < YA) return 0;
    const wy = y - (x - XL) * 0.62;
    let s = sstep(118, 123, wy) * (1 - sstep(227, 232, wy));
    s *= 1 - 0.85 * (sstep(171, 173, wy) * (1 - sstep(176, 178, wy)));        // the glazing bar
    return s;
  }
  function shaftStair(x, y) {             // stairwell: tall window in the right wall, light falling down-left
    if (x < XP2 || x > XR || y < YA) return 0;
    if (x < XST && y > Y1) return 0;
    if (x >= XST && y > stepY(x)) return 0;
    const wy = y - (XR - x) * 0.22;
    let s = sstep(78, 84, wy) * (1 - sstep(226, 232, wy));
    s *= 1 - 0.85 * (sstep(126, 128, wy) * (1 - sstep(131, 133, wy))) * 1;
    s *= 1 - 0.85 * (sstep(178, 180, wy) * (1 - sstep(183, 185, wy)));
    return s;
  }

  function buildHouse() {
    const P = newPlate(HW, HH);
    target(P.A); PART = 1;
    const n2 = (x, y, s, k) => fbm(x / k, y / k, s, 3);
    // the cut: walls, slabs, footing (a warm dark section, so the rooms read as lit boxes)
    rect(0, 0, HW, HH, (x, y) => mixc(hx('2c211d'), hx('3d2e27'), n2(x, y, 3, 9) > 0.55 ? 1 : 0.3 * dith(x, y)));
    // brick coursing in the exterior walls
    for (const [x0, x1] of [[0, XL], [XR, HW]]) for (let y = 0; y < YF; y++) for (let x = x0; x < x1; x++) {
      const row = fl(y / 5), bx = (x + (row & 1) * 3) % 7;
      if (y % 5 === 0 || bx === 0) put(x, y, hx('241a17')); else put(x, y, mixc(hx('5a3324'), hx('7c4a31'), ih(fl((x + (row & 1) * 3) / 7), row, 4)));
    }
    // attic: rafters and insulation
    rect(XL, 6, XR - XL, YA - 10, (x, y) => (fl((x + 3) / 46) % 1 === 0 && (x + 3) % 46 < 5 ? hx('4c2d1d') : mixc(hx('3b2f4f'), hx('584767'), n2(x, y, 9, 4) > 0.5 ? 0.6 : 0.1)));
    for (let x = XL; x < XR; x += 46) rect(x, 6, 5, YA - 10, hx('4c2d1d'));
    rect(120, 30, 34, 20, hx('7f5131')); rect(122, 32, 30, 3, hx('9b6840')); rect(600, 34, 26, 16, hx('9b6840')); rect(626, 40, 18, 10, hx('7f5131'));
    // earth under the house
    rect(0, YF + 8, HW, HH - YF - 8, (x, y) => { const v = n2(x, y, 21, 7); return v > 0.68 ? hx('4c2d1d') : v > 0.4 ? hx('2c1a12') : hx('22140e'); });
    for (let k = 0; k < 26; k++) { const x = ih(k, 1, 5) * HW, y = YF + 16 + ih(k, 2, 5) * 60; ell(x, y, 4 + ih(k, 3, 5) * 7, 3 + ih(k, 4, 5) * 3, hx(['47454a', '5e5b60', '77747a'][k % 3])); }
    for (let k = 0; k < 7; k++) { let x = 60 + k * 130 + ih(k, 9, 5) * 60, y = YF + 8, a = 1.4 + (ih(k, 8, 5) - 0.5); for (let s = 0; s < 30; s++) { a += (ih(k, s, 6) - 0.5) * 0.6; x += Math.cos(a) * 2; y += Math.sin(a) * 2; put(fl(x), fl(y), hx('653d26')); } }

    /* ---------------- back walls */
    // bedroom: dusty sage paper with a small cream sprig
    rect(XL, YA, XP - XL, Y1 - YA, (x, y) => { const sx = (x - XL) % 14, sy = (y - YA + ((fl((x - XL) / 14) & 1) * 9)) % 18; return (sx === 7 && (sy === 8 || sy === 10)) || (sy === 9 && (sx === 6 || sx === 8)) ? hx('e9dfc6') : sx === 0 ? hx('8ea78e') : hx('9db49a'); });
    // landing and stairwell: cream paper, honey pinstripe
    rect(XP2, YA, XR - XP2, Y0 - YA, (x, y) => ((x - XP2) % 12 === 0 ? hx('d9b77a') : (x - XP2) % 12 === 6 && (y & 1) ? hx('e6d3ac') : hx('efe2c4')));
    // kitchen: warm plaster
    rect(XL, YS, XST - XL + 8, Y0 - YS, (x, y) => mixc(hx('f2e6cc'), hx('e6d6b6'), n2(x, y, 33, 6) > 0.55 ? 1 : 0));
    // under the stairs: plaster in the triangle below the stair soffit
    for (let x = XST; x < XR; x++) { const sy = stairLine(x) + 24; rect(x, Math.max(YS, sy), 1, Y0 - Math.max(YS, sy), (xx, y) => mixc(hx('ead9b8'), hx('dccaa6'), n2(xx, y, 34, 6) > 0.55 ? 1 : 0)); }
    // the upper slab (cut) with joists and floorboard edge, and the ceiling below
    rect(XL, Y1, XST - XL, YS - Y1, (x, y) => (y < Y1 + 3 ? hx('9b6840') : y > YS - 3 ? hx('d0ccca') : (x % 24 < 6 ? hx('653d26') : hx('3d2e27'))));
    // ceiling plaster lines under the attic
    rect(XL, YA, XR - XL, 3, hx('d0ccca'));
    // skirting boards and floors
    const floor = (x0, x1, y) => { rect(x0, y - 9, x1 - x0, 9, hx('7f5131')); rect(x0, y - 9, x1 - x0, 1, hx('9b6840')); };
    floor(XL, XP, Y1); floor(XP2, XST, Y1);
    rect(XL, Y0, XR - XL, 6, (x, y) => ((x - XL) % 10 === 0 ? hx('8ea78e') : (fl((x - XL) / 10) & 1) ? hx('dbe5cc') : hx('b5c9ab')));   // kitchen tiles (edge-on)
    rect(XL, Y0 - 7, XST - XL, 7, hx('6d8872')); rect(XL, Y0 - 7, XST - XL, 1, hx('8ea78e'));

    /* ---------------- partition and the bedroom door (open, flat against the landing wall) */
    rect(XP, YA, XP2 - XP, Y1 - YA, (x, y) => (x === XP || x === XP2 - 1 ? hx('d0ccca') : hx('3d2e27')));
    rect(XP, 128, XP2 - XP, Y1 - 128, hx('27324f'));   // the doorway through the cut wall: the dark gap
    rect(XP, 124, XP2 - XP, 5, hx('9b6840'));
    rect(XP2 + 2, 128, 44, Y1 - 128 - 2, (x, y) => (n2(x, y, 41, 3) > 0.6 ? hx('b8834f') : hx('9b6840')));
    for (const [yy, hh] of [[138, 70], [218, 86]]) { rect(XP2 + 8, yy, 32, hh, hx('7f5131')); rect(XP2 + 10, yy + 2, 28, hh - 4, hx('b8834f')); }
    ell(XP2 + 40, 228, 2.5, 2.5, hx('efc472'));

    /* ---------------- bedroom */
    // window in the left wall: sill, glass, curtains
    rect(0, 116, XL + 4, 118, hx('d0ccca'));
    rect(2, 120, XL - 2, 110, hx('8fa1bd'));
    rect(2, 172, XL - 2, 3, hx('d0ccca'));
    emitShape(P, P.E, [70, 82, 110], () => { rect(2, 120, XL - 2, 52, 1); rect(2, 175, XL - 2, 55, 1); });
    rect(0, 230, XL + 10, 5, hx('efe2c4'));
    for (let y = 104; y < 250; y++) { const w = 9 + 3 * Math.sin(y * 0.09) + (y > 170 ? (y - 170) * 0.04 : 0); span(y, XL, XL + w, (x) => ((x + fl(y / 3)) % 4 === 0 ? hx('b8834f') : hx('d9a85b'))); }
    rect(XL, 100, 40, 3, hx('7f5131'));
    // framed print above the bed: hills and a moon
    rect(126, 148, 66, 50, hx('4c2d1d')); rect(129, 151, 60, 44, hx('f2e6cc'));
    rect(132, 154, 54, 38, (x, y) => (y > 178 - 6 * Math.sin((x - 132) * 0.12) ? hx('6d8872') : y > 184 - 9 * Math.sin((x - 120) * 0.07) ? hx('52695a') : hx('b6c4da')));
    ell(170, 164, 4, 4, hx('fbdc94'));
    // a shelf with books and a trailing plant
    rect(200, 196, 30, 3, hx('7f5131'));
    [['a34b5a', 4, 14], ['6d8872', 3, 17], ['d9a85b', 5, 12], ['566887', 3, 15]].reduce((x, b) => { rect(x, 196 - b[2], b[1], b[2], hx(b[0])); return x + b[1]; }, 202);
    rect(218, 186, 9, 10, hx('bd6a4b'));
    for (let k = 0; k < 9; k++) ell(214 + k * 1.6, 184 + k * 3.6, 2.2, 1.6, hx(k & 1 ? '52695a' : '6d8872'));
    // fairy lights (off) strung along the top of the wall
    for (let x = 22; x < 322; x++) { const y = 70 + 8 * Math.abs(Math.sin((x - 22) * Math.PI / 75)); put(x, fl(y), hx('47454a')); if ((x - 22) % 15 === 7) { put(x, fl(y) + 1, hx('fbdc94')); put(x, fl(y) + 2, hx('efc472')); } }
    // ceiling pendant
    rect(170, YA, 1, 24, hx('333236')); poly([[160, 92], [181, 92], [176, 80], [165, 80]], hx('d9a85b')); rect(160, 92, 21, 2, hx('b8834f'));
    // the wardrobe: oak, two doors, the left one ajar on darkness
    rect(WARD.x0, WARD.y0, WARD.x1 - WARD.x0, Y1 - WARD.y0, hx('7f5131'));
    rect(WARD.x0 - 3, WARD.y0 - 6, WARD.x1 - WARD.x0 + 6, 7, hx('9b6840'));
    rect(WARD.x0 + 4, WARD.y0 + 6, WARD.x1 - WARD.x0 - 8, Y1 - WARD.y0 - 28, (x, y) => (n2(x, y * 0.3, 52, 2) > 0.55 ? hx('b8834f') : hx('9b6840')));
    rect(WARD.gap0, WARD.y0 + 6, WARD.gap1 - WARD.gap0, Y1 - WARD.y0 - 28, hx('0d0f1d'));
    rect(WARD.gap0 + 2, WARD.y0 + 30, 5, 70, hx('6d8872')); ell(WARD.gap0 + 4, WARD.y0 + 102, 3, 4, hx('dca97f'));   // a sleeve hangs out of the gap
    rect(WARD.gap0 - 6, WARD.y0 + 8, 2, Y1 - WARD.y0 - 32, hx('653d26'));      // the ajar door's edge
    for (const x of [WARD.x0 + 10, WARD.gap1 + 6]) { rect(x, WARD.y0 + 14, WARD.gap0 - WARD.x0 - 24, 70, hx('8d4430')); rect(x + 2, WARD.y0 + 16, WARD.gap0 - WARD.x0 - 28, 66, hx('a85320')); }
    rect(WARD.x0 + 6, Y1 - 22, WARD.x1 - WARD.x0 - 12, 14, hx('653d26')); rect(WARD.x0 + 6, Y1 - 22, WARD.x1 - WARD.x0 - 12, 2, hx('9b6840'));
    ell(WARD.gap0 - 10, 210, 2, 2, hx('efc472')); ell(WARD.gap1 + 4, 210, 2, 2, hx('efc472'));
    // trailing plant on the wardrobe
    rect(300, WARD.y0 - 18, 14, 12, hx('bd6a4b')); for (let k = 0; k < 14; k++) ell(298 + Math.sin(k * 0.7) * 5 + (k > 5 ? 8 : 0), WARD.y0 - 20 + k * (k > 5 ? 5 : -1.2), 2.6, 1.9, hx(k & 1 ? '52695a' : '8ea78e'));
    // the bed: headboard, mattress, sheet, pillow, footboard, legs; the quilt is a sprite (it moves)
    rect(BED.x0 - 10, 212, 10, Y1 - 212, hx('7f5131')); ell(BED.x0 - 5, 214, 7, 6, hx('9b6840')); rect(BED.x0 - 8, 220, 2, 80, hx('9b6840'));
    rect(BED.x0, BED.top, BED.x1 - BED.x0, 30, hx('f2e6cc')); rect(BED.x0, BED.top + 26, BED.x1 - BED.x0, 4, hx('ddcca8'));
    rect(BED.x0, BED.top + 30, BED.x1 - BED.x0, 8, hx('653d26'));
    rect(BED.x1, 238, 8, Y1 - 238, hx('7f5131')); ell(BED.x1 + 4, 240, 6, 5, hx('9b6840'));
    rect(BED.x0 + 2, BED.top + 38, 6, Y1 - BED.top - 38, hx('4c2d1d')); rect(BED.x1 - 8, BED.top + 38, 6, Y1 - BED.top - 38, hx('4c2d1d'));
    rect(BED.x0 + 8, BED.top + 38, BED.x1 - BED.x0 - 16, Y1 - BED.top - 38, hx('222125'));
    ell(150, Y1 - 4, 10, 4, hx('d77b86')); ell(168, Y1 - 4, 10, 4, hx('d77b86'));    // the slippers under the bed
    // the nightstand: drawer, lamp, glass of water (the torch on it is a sprite)
    rect(NIGHT.x0, NIGHT.top, NIGHT.x1 - NIGHT.x0, Y1 - NIGHT.top, hx('9b6840'));
    rect(NIGHT.x0 - 2, NIGHT.top - 3, NIGHT.x1 - NIGHT.x0 + 4, 4, hx('b8834f'));
    rect(NIGHT.x0 + 4, NIGHT.top + 6, NIGHT.x1 - NIGHT.x0 - 8, 16, hx('7f5131')); ell((NIGHT.x0 + NIGHT.x1) / 2, NIGHT.top + 14, 2, 2, hx('efc472'));
    rect(23, 250, 8, 17, hx('8ea78e')); ell(27, 250, 5, 3, hx('8ea78e'));
    poly([[16, 250], [39, 250], [35, 230], [20, 230]], hx('efe2c4')); rect(16, 249, 24, 2, hx('d9b77a'));
    emitShape(P, P.EW, [150, 110, 60], () => poly([[16, 250], [39, 250], [35, 230], [20, 230]], 1));
    rect(52, 256, 7, 11, hx('b6c4da')); rect(53, 260, 5, 6, hx('dfe7f1'));
    // the alarm clock, glowing 3:00
    rect(40, 259, 12, 8, hx('222125'));
    emitShape(P, P.E, [130, 80, 30], () => { for (const [x, y] of [[42, 261], [43, 261], [43, 262], [42, 263], [43, 263], [43, 264], [42, 265], [43, 265], [45, 262], [45, 264], [47, 261], [47, 262], [47, 263], [47, 264], [47, 265], [49, 261], [49, 265], [50, 261], [50, 262], [50, 263], [50, 264], [50, 265], [48, 261], [48, 265]]) put(x, y, 1); });
    // rug
    rect(96, Y1 - 3, 150, 3, (x) => (x % 6 < 3 ? hx('bd6a4b') : hx('d9a85b')));
    for (let x = 96; x < 246; x += 2) put(x, Y1 - 4, hx('efe2c4'));

    /* ---------------- landing */
    // pictures: the cat (of course) and a small landscape
    rect(400, 160, 34, 40, hx('4c2d1d')); rect(403, 163, 28, 34, hx('f2e6cc'));
    ell(417, 186, 9, 8, hx('d27430')); ell(417, 176, 7, 6, hx('d27430')); poly([[411, 173], [413, 166], [416, 172]], hx('d27430')); poly([[418, 172], [421, 166], [423, 173]], hx('d27430'));
    put(414, 176, hx('23140f')); put(420, 176, hx('23140f'));
    rect(444, 172, 22, 26, hx('b8834f')); rect(446, 174, 18, 22, hx('8fa1bd')); rect(446, 186, 18, 10, hx('6d8872'));
    // the coat rail, coats, scarf, umbrella, the bench and boots
    rect(490, 146, 108, 4, hx('7f5131')); for (let x = 500; x < 596; x += 20) rect(x, 150, 2, 4, hx('d9a85b'));
    for (const c of COATS) {
      const x0 = c.x - c.w / 2;
      if (c.w > 20) {
        poly([[c.x - 3, c.y], [c.x + 3, c.y], [x0 + c.w, c.y + 22], [x0 + c.w + 2, c.y + c.h], [x0 - 2, c.y + c.h], [x0, c.y + 22]], hx(c.col));
        poly([[c.x - 3, c.y], [c.x + 3, c.y], [c.x + 6, c.y + 26], [c.x, c.y + 36], [c.x - 6, c.y + 26]], mulc(hx(c.col), 0.7));
        rect(x0 - 3, c.y + 24, 5, c.h - 34, mulc(hx(c.col), 0.82)); rect(x0 + c.w - 2, c.y + 24, 5, c.h - 34, mulc(hx(c.col), 0.82));
        for (let k = 0; k < 3; k++) ell(c.x + 1, c.y + 44 + k * 16, 1.5, 1.5, hx('efe2c4'));
      } else {
        rect(c.x - 5, c.y, 10, 8, hx(c.col)); for (let y = c.y + 8; y < c.y + c.h; y++) span(y, c.x - 4 + Math.sin(y * 0.1), c.x + 2 + Math.sin(y * 0.1), (x, yy) => (fl(yy / 6) & 1 ? hx('efe2c4') : hx(c.col)));
      }
    }
    rect(587, 152, 3, 90, hx('333236')); poly([[582, 172], [594, 172], [590, 240], [586, 240]], hx('566887')); ell(585, 152, 4, 4, hx('7f5131'));
    rect(492, Y1 - 36, 104, 5, hx('9b6840')); rect(496, Y1 - 31, 4, 22, hx('7f5131')); rect(588, Y1 - 31, 4, 22, hx('7f5131'));
    for (const bx of [512, 530]) { rect(bx, Y1 - 24, 9, 15, hx('4c2d1d')); rect(bx, Y1 - 12, 14, 3, hx('4c2d1d')); }
    // runner
    rect(XP2, Y1 - 3, XST - XP2, 3, (x) => (x % 10 < 5 ? hx('a34b5a') : hx('d9a85b')));
    // landing lamp (wall sconce) - comes on in the end light
    rect(460, 112, 3, 8, hx('7f5131')); poly([[452, 120], [471, 120], [468, 108], [455, 108]], hx('efe2c4'));
    emitShape(P, P.EW, [160, 120, 70], () => poly([[452, 120], [471, 120], [468, 108], [455, 108]], 1));

    /* ---------------- stairwell: the window, the cat's portrait, a pendant */
    rect(XR - 2, 76, HW - XR + 2, 160, hx('d0ccca'));
    rect(XR + 1, 80, HW - XR - 3, 150, hx('8fa1bd'));
    rect(XR + 1, 128, HW - XR - 3, 3, hx('d0ccca')); rect(XR + 1, 180, HW - XR - 3, 3, hx('d0ccca'));
    emitShape(P, P.E, [70, 82, 110], () => { rect(XR + 1, 80, HW - XR - 3, 48, 1); rect(XR + 1, 131, HW - XR - 3, 49, 1); rect(XR + 1, 183, HW - XR - 3, 47, 1); });
    rect(744, 132, 70, 84, hx('b8834f')); rect(748, 136, 62, 76, hx('d9a85b')); rect(751, 139, 56, 70, hx('3a4c3f'));
    ell(779, 196, 20, 16, hx('d27430')); ell(779, 168, 15, 13, hx('d27430'));
    poly([[766, 162], [769, 148], [776, 158]], hx('d27430')); poly([[782, 158], [789, 148], [792, 162]], hx('d27430'));
    ell(779, 174, 6, 4, hx('f2e6cc')); ell(779, 196, 9, 12, hx('f2e6cc'));
    put(773, 166, hx('23140f')); put(774, 166, hx('23140f')); put(784, 166, hx('23140f')); put(785, 166, hx('23140f'));
    for (const yy of [160, 164]) { put(770, yy, hx('a85320')); put(788, yy, hx('a85320')); }
    rect(774, 210, 10, 2, hx('d9a85b'));   // a little brass plaque
    rect(856, YA, 1, 70, hx('333236')); ell(856, YA + 76, 10, 7, hx('efe2c4')); rect(846, YA + 76, 21, 4, hx('d9b77a'));
    emitShape(P, P.EW, [170, 128, 72], () => ell(856, YA + 77, 10, 7, 1));

    /* ---------------- the stairs: treads, risers, runner, stringer, soffit */
    for (let k = 0; k < NST; k++) {
      const x0 = XST + k * TREAD, y0 = Y1 + (k + 1) * RISE, x1 = x0 + TREAD;
      if (k < NST - 1) {
        rect(x0, y0 - RISE + (k === 0 ? 0 : 0), TREAD + 1, RISE, (x, y) => (y < y0 - RISE + 3 ? hx('b8834f') : hx('7f5131')));
        rect(x0 + 2, y0, TREAD + 1, 3, hx('b8834f')); rect(x0, y0, TREAD + 2, 1, hx('d9a85b'));
        rect(x0 + 4, y0 - 2, TREAD - 2, 2, hx('a34b5a')); rect(x1 - 2, y0, 3, RISE, hx('a34b5a'));     // the runner
      }
      void x1;
    }
    // the stringer and soffit: a diagonal band under the treads
    for (let x = XST; x < XSB + 4; x++) {
      const yl = stairLine(x);
      rect(x, Math.max(Y1 + 2, yl + 4), 1, 20, (xx, y) => (y < yl + 7 ? hx('9b6840') : y < yl + 20 ? hx('653d26') : hx('4c2d1d')));
    }
    // the floor beside and below the stairs
    rect(XSB, Y0 - 7, XR - XSB, 7, hx('6d8872'));

    /* ---------------- kitchen */
    // window in the back wall: moonlit garden
    rect(146, 398, 88, 76, hx('efe2c4'));
    rect(150, 402, 80, 68, (x, y) => (y > 452 - 6 * Math.sin((x - 150) * 0.09) ? hx('26332b') : hx('33415f')));
    for (let k = 0; k < 6; k++) put(fl(156 + ih(k, 1, 77) * 70), fl(406 + ih(k, 2, 77) * 30), hx('dfe7f1'));
    ell(212, 416, 6, 6, hx('dfe7f1'));
    for (let k = 0; k < 4; k++) curve([[160 + k * 2, 470], [164 + k * 5, 448 - k * 4], [172 + k * 9, 436 - k * 3]], 1, hx('151a2f'));
    rect(188, 402, 3, 68, hx('efe2c4')); rect(150, 434, 80, 3, hx('efe2c4'));
    emitShape(P, P.E, [26, 34, 58], () => rect(150, 402, 80, 68, 1));
    emitShape(P, P.E, [110, 115, 120], () => ell(212, 416, 6, 6, 1));
    rect(142, 474, 96, 5, hx('ddcca8'));
    rect(140, 392, 100, 4, hx('7f5131'));
    for (let y = 396; y < 470; y++) { span(y, 141, 150 + 3 * Math.sin(y * 0.11), hx('d77b86')); span(y, 230 - 3 * Math.sin(y * 0.11), 239, hx('d77b86')); }
    // table, two chairs, fruit bowl, vase
    rect(96, 522, 160, 6, hx('b8834f')); rect(96, 528, 160, 3, hx('7f5131'));
    rect(104, 531, 6, Y0 - 531, hx('7f5131')); rect(242, 531, 6, Y0 - 531, hx('7f5131'));
    for (const cx of [84, 262]) { const s = cx < 150 ? -1 : 1; rect(cx - 10, 548, 20, 4, hx('9b6840')); rect(cx - 8, 552, 3, Y0 - 552, hx('7f5131')); rect(cx + 5, 552, 3, Y0 - 552, hx('7f5131')); rect(cx + s * 9 - 1, 500, 3, 48, hx('7f5131')); for (let y = 506; y < 540; y += 9) rect(cx + s * 9 - 1 - (s < 0 ? 0 : 0), y, 3, 3, hx('9b6840')); }
    ell(140, 516, 14, 7, hx('7c4a31')); ell(134, 509, 5, 5, hx('d27430')); ell(144, 508, 5, 5, hx('efc472')); ell(139, 504, 4, 4, hx('8ea78e'));
    rect(214, 500, 8, 22, hx('8fa1bd')); for (const [fx, fy, c] of [[212, 492, 'f2b3b4'], [220, 488, 'fbdc94'], [216, 484, 'efe2c4']]) { line(218, 500, fx, fy, hx('52695a')); ell(fx, fy, 3, 3, hx(c)); }
    rect(176, YS, 1, 46, hx('333236')); poly([[164, 394], [189, 394], [183, 380], [170, 380]], hx('d9a85b')); rect(164, 393, 25, 2, hx('b8834f'));
    emitShape(P, P.EW, [190, 140, 80], () => poly([[164, 394], [189, 394], [183, 380], [170, 380]], 1));
    // fridge with a drawing and magnets
    rect(282, 452, 62, Y0 - 452, hx('efe2c4')); rect(282, 452, 62, 2, hx('fff0c4')); rect(282, 500, 62, 2, hx('bfa985')); rect(336, 462, 3, 28, hx('b1aeb1')); rect(336, 510, 3, 40, hx('b1aeb1'));
    rect(294, 512, 22, 26, hx('fff0c4')); ell(305, 526, 6, 5, hx('d27430')); poly([[300, 522], [301, 516], [304, 521]], hx('d27430')); poly([[306, 521], [309, 516], [310, 522]], hx('d27430'));
    ell(305, 512, 2, 2, hx('a34b5a')); ell(296, 466, 2, 2, hx('6d8872')); ell(320, 470, 2, 2, hx('efc472'));
    // upper cabinets, extractor, backsplash
    rect(360, 378, 270, 64, hx('6d8872')); rect(360, 378, 270, 3, hx('8ea78e'));
    for (let x = 362; x < 628; x += 45) { rect(x + 2, 384, 41, 54, hx('8ea78e')); rect(x + 5, 387, 35, 48, hx('7f9a7c' === 'x' ? '' : '6d8872')); rect(x + 38, 420, 2, 8, hx('d9a85b')); }
    rect(360, 442, 280, 86, (x, y) => ((x - 360) % 8 === 0 || (y - 442) % 8 === 0 ? hx('ddcca8') : (((x - 360) >> 3) + ((y - 442) >> 3)) & 1 ? hx('f2e6cc') : hx('dbe5cc')));
    rect(360, 442, 270, 2, hx('47454a'));
    emitShape(P, P.EW, [150, 115, 70], () => rect(362, 444, 266, 2, 1));
    // the worktop and lower cabinets (they run on under the stairs)
    rect(352, 528, 426, 6, hx('b8834f')); rect(352, 528, 426, 2, hx('d9a85b'));
    rect(356, 534, 418, Y0 - 534 - 6, hx('6d8872'));
    for (let x = 358; x < 770; x += 41) { rect(x + 2, 538, 37, 44, hx('8ea78e')); rect(x + 18, 542, 5, 2, hx('d9a85b')); }
    rect(356, Y0 - 6, 418, 6, hx('3a4c3f'));
    // sink and tap
    rect(430, 526, 52, 3, hx('b1aeb1')); curve([[470, 526], [470, 506], [462, 502], [458, 506]], 1.4, hx('b1aeb1'));
    // the oven and hob, kettle, the oven clock
    rect(540, 534, 56, Y0 - 540, hx('333236')); rect(546, 546, 44, 30, hx('151a2f')); rect(546, 540, 44, 3, hx('b1aeb1'));
    emitShape(P, P.E, [110, 70, 26], () => { for (const x of [562, 564, 568, 571, 573]) rect(x, 536, 1, 3, 1); });
    ell(568, 515, 14, 12, hx('a34b5a')); rect(556, 515, 25, 12, hx('a34b5a')); rect(560, 502, 16, 3, hx('333236')); curve([[580, 512], [588, 504], [590, 500]], 1.5, hx('a34b5a'));
    // a bread bin and the fruit bowl's twin on the run under the stairs
    rect(690, 508, 30, 20, hx('d9a85b')); rect(690, 508, 30, 4, hx('efc472'));
    // the pan rail under the stairs: frying pan, a saucepan, an EMPTY hook, a ladle
    rect(652, 462, 108, 3, hx('b1aeb1'));
    for (const x of [664, 692, 722, 748]) rect(x, 465, 2, 6, hx('939096'));
    ell(665, 494, 13, 13, hx('333236')); rect(664, 471, 3, 12, hx('333236')); ell(665, 494, 10, 10, hx('47454a'));
    rect(684, 480, 18, 20, hx('bd6a4b')); rect(682, 480, 22, 3, hx('e3967a')); rect(692, 471, 2, 9, hx('8d4430'));
    curve([[749, 471], [749, 498]], 1, hx('b1aeb1')); ell(749, 502, 5, 4, hx('b1aeb1'));
    // under the stairs: the cat's bed and bowls, the light switch, a wall sconce
    ell(886, Y0 - 6, 24, 7, hx('a34b5a')); ell(886, Y0 - 9, 18, 4, hx('f2b3b4'));
    ell(842, Y0 - 3, 7, 3, hx('566887')); ell(856, Y0 - 3, 7, 3, hx('566887'));
    rect(938, 492, 7, 12, hx('fff0c4')); rect(940, 495, 3, 5, hx('d0ccca'));
    rect(926, 444, 3, 10, hx('7f5131')); poly([[918, 444], [937, 444], [933, 430], [922, 430]], hx('efe2c4'));
    emitShape(P, P.EW, [200, 150, 90], () => poly([[918, 444], [937, 444], [933, 430], [922, 430]], 1));

    /* ---------------- foreground: the banister in front of the stairs */
    target(P.FG); PART = 1;
    const RAIL = 62;
    for (let x = XST - 6; x < XSB + 6; x++) { const y = stairLine(x) - RAIL; rect(x, y, 1, 4, hx('7f5131')); put(x, fl(y), hx('b8834f')); }
    for (let k = 0; k < NST - 1; k++) { const x = XST + k * TREAD + TREAD * 0.5; rect(x - 1, stairLine(x) - RAIL + 4, 2, RAIL - 6 + (stepY(x) - stairLine(x)), hx('efe2c4')); }
    rect(XST - 8, Y1 - RAIL - 10, 8, RAIL + 10, hx('7f5131')); ell(XST - 4, Y1 - RAIL - 12, 5, 4, hx('9b6840'));
    rect(XSB, Y0 - RAIL - 10, 8, RAIL + 10, hx('7f5131')); ell(XSB + 4, Y0 - RAIL - 12, 5, 4, hx('9b6840'));
    // landing balustrade along the stairwell edge (left of the top newel is solid floor)
    target(P.A);

    /* ---------------- light */
    buildBranches();
    for (let y = 0; y < HH; y++) for (let x = 0; x < HW; x++) {
      const i = y * HW + x, j = i * 3;
      const inside = x >= XL && x < XR && ((y >= YA && y < Y1 && !(x >= XP && x < XP2 && y < 124)) || (y >= YS && y < Y0 + 6) || (x >= XST && y >= Y1 && y < Y0));
      let a = inside ? 1 : 0.55;
      if (y >= YF) a = 0.42;
      const up = y < Y1 + 10 && !(x >= XST && y > stairLine(x) + 2);
      let amb = up ? [0.34, 0.38, 0.6] : [0.24, 0.27, 0.46];
      if (x >= XST && y > stairLine(x) + 20 && y < Y0) amb = [0.18, 0.2, 0.36];          // under the stairs: darkest
      else if (x >= XST && y >= Y1 - 40 && y <= stairLine(x) + 20) { const pm = 0.22 / (1 + ((x - 820) * (x - 820) + (y - 430) * (y - 430)) / 9000); amb = [0.3 + pm * 0.66, 0.34 + pm * 0.74, 0.56 + pm]; }
      // ambient occlusion near floors, ceilings and walls
      let ao = 1;
      if (inside) {
        const fy = up ? Y1 : Y0, cy = up ? YA : YS;
        ao = (0.72 + 0.28 * sstep(0, 26, fy - y)) * (0.8 + 0.2 * sstep(0, 18, y - cy));
        ao *= 0.86 + 0.14 * sstep(0, 20, Math.min(x - XL, XR - x));
      }
      const sb = shaftBed(x, y) * (1 - 0.82 * brMask(x, y)), ss = shaftStair(x, y);
      const ms = inside ? sb * 0.95 + ss * 0.85 : 0;
      P.MS[i] = ms;
      for (let c = 0; c < 3; c++) P.LN[j + c] = amb[c] * a * ao + MOON[c] * ms;
      // kitchen window: moonlight spills toward us onto the table and floor below it
      if (y > 470 && y < Y0 + 2 && x > 120 && x < 260) { const g = 0.16 * (1 - Math.abs(x - 190) / 70) * sstep(470, 520, y); for (let c = 0; c < 3; c++) P.LN[j + c] += MOON[c] * Math.max(0, g); }
      // warm state: lamps on downstairs (and spill up the stairwell), the landing sconce upstairs
      let wl = 0;
      const pool = (px, py, r, k) => k / (1 + ((x - px) * (x - px) + (y - py) * (y - py)) / (r * r));
      if (!up || x >= XST) wl += pool(176, 400, 70, 0.95) + pool(500, 452, 120, 0.9) + pool(928, 448, 80, 1.1) + pool(856, 140, 120, 0.6);
      else wl += pool(462, 120, 120, 0.85) + pool(700, 300, 160, 0.4);
      if (y > 442 && y < 534 && x > 356 && x < 640) wl += 0.35 * sstep(442, 470, y) * (1 - sstep(520, 534, y));
      wl *= ao * a;
      for (let c = 0; c < 3; c++) P.LW[j + c] = P.LN[j + c] * 0.55 + WARM[c] * wl + [0.16, 0.12, 0.09][c] * a * ao;
    }
    // the foreground (banister) is lit by the same light
    return P;
  }

  /* ================================================================ sprites */
  // Sprites are drawn per frame into SP (frame-sized, art pixels) in world coordinates offset by (OX, OY); each
  // shape carries a part id in draw order, and finishSprites() gives them a dark outline against the set, an inner
  // line where a later part overlaps an earlier one, and a one-pixel light/shadow bevel along part edges.
  const SP = img(AW, AH, true), SHD = new Float32Array(NA);
  let OX = 0, OY = 0;
  const X = (x) => x - OX, Y = (y) => y - OY;
  let BB = [1e9, 1e9, -1e9, -1e9];
  function bbReset() { BB = [1e9, 1e9, -1e9, -1e9]; }
  function ik(ax, ay, bx, by, l1, l2, bend) {
    const dx = bx - ax, dy = by - ay, d = Math.max(1e-6, Math.hypot(dx, dy)), dm = Math.min(d, l1 + l2 - 0.01);
    const a = Math.atan2(dy, dx), c = clamp((l1 * l1 + dm * dm - l2 * l2) / (2 * l1 * dm), -1, 1), b = Math.acos(c);
    const ang = a - bend * b, jx = ax + Math.cos(ang) * l1, jy = ay + Math.sin(ang) * l1;
    const ex = bx - jx, ey = by - jy, el = Math.max(1e-6, Math.hypot(ex, ey));
    return [jx, jy, jx + ex / el * l2, jy + ey / el * l2];
  }
  const OUTLINE = hx('1a1218');
  function finishSprites(sx, sy) {
    const p = SP.p, c = SP.c;
    // bevel and inner lines
    const tmp = finishSprites.tmp || (finishSprites.tmp = new Float32Array(NA * 3));
    tmp.set(c);
    for (let y = 1; y < AH - 1; y++) for (let x = 1; x < AW - 1; x++) {
      const i = y * AW + x, q = p[i]; if (!q || q === 255) continue;
      const j = i * 3;
      let k = 1;
      const a = p[i + sx + sy * AW], b = p[i - sx - sy * AW];
      if (a && a !== q && a !== 255) k = 0.74; else if (b !== q) k = 1.12;
      const n4 = [p[i - 1], p[i + 1], p[i - AW], p[i + AW]];
      for (const r of n4) if (r && r !== 255 && r < q && !(SAMEPART[q] && SAMEPART[q] === SAMEPART[r])) { k = 0.55; break; }
      tmp[j] = c[j] * k; tmp[j + 1] = c[j + 1] * k; tmp[j + 2] = c[j + 2] * k;
    }
    c.set(tmp);
    // outline
    for (let y = 1; y < AH - 1; y++) for (let x = 1; x < AW - 1; x++) {
      const i = y * AW + x; if (p[i]) continue;
      if ((p[i - 1] && p[i - 1] !== 255) || (p[i + 1] && p[i + 1] !== 255) || (p[i - AW] && p[i - AW] !== 255) || (p[i + AW] && p[i + AW] !== 255)) {
        p[i] = 255; c[i * 3] = OUTLINE[0]; c[i * 3 + 1] = OUTLINE[1]; c[i * 3 + 2] = OUTLINE[2];
      }
    }
  }
  const SAMEPART = new Uint8Array(256);    // parts that should not draw inner lines between each other

  /* ---------------- her */
  const SKIN = hx('9f6643'), SKINL = hx('c08559'), HAIR = hx('2e1c15'), HAIRL = hx('5a3324'), TOPC = hx('8ea78e'), PIPE = hx('f2e6cc');
  const BOTC = hx('efc472'), BOTS = hx('fff0c4'), SLIPC = hx('f2b3b4'), SLIPD = hx('d77b86'), TORCHC = hx('efc472'), TORCHD = hx('333236');
  const pjBot = (x, y) => (((x + OX) + (y + OY) * 0.0 + 64) % 6 < 2 ? BOTS : BOTC);
  // pose: { hx, hy (hip, world), f (+1 faces right), lean, tilt, feet: [[x,y],[x,y]] (back, front), hands: [[x,y],[x,y]],
  //   eye, look, brow, mouth, fright, sit, tip, torch: {a, on}|null (front hand), slipper (back hand, angle)|null, pan: bool,
  //   headF (head facing, defaults to f), lap: fn (drawn over the torso, under the arms: the quilt) }
  const PART_IDS = { legB: 10, slipB: 11, armB: 12, handB: 13, itemB: 14, torso: 20, legF: 30, slipF: 31, lap: 40, hairB: 50, neck: 51, face: 52, hairF: 53, armF: 60, handF: 61, itemF: 62, pan: 63, cat: 64 };
  SAMEPART[PART_IDS.face] = SAMEPART[PART_IDS.neck] = 1;
  SAMEPART[PART_IDS.hairB] = SAMEPART[PART_IDS.hairF] = 2;
  let HER = null;                                   // the last drawn pose's key points (for beam, shadow, ink)
  function person(P) {
    const f = P.f, hf = P.headF || f;
    const hX = P.hx, hY = P.hy, la = P.lean || 0;
    const nX = hX + f * Math.sin(la) * 50, nY = hY - Math.cos(la) * 50;
    const shX = nX - f * 3, shY = nY + 7;
    const ti = P.tilt || 0;
    const hc = [nX + hf * 3 * Math.cos(ti) + 15 * Math.sin(ti) * hf, nY - 15 * Math.cos(ti) + 3 * Math.sin(ti)];
    bbReset();
    const legs = [], arms = [];
    // legs (IK, knees forward), slippers
    const legDraw = (foot, idL, idS, bare) => {
      const k = ik(hX, hY - 2, foot[0], foot[1], 41, 40, f);
      legs.push(k);
      PART = idL; cap(X(hX), Y(hY - 2), X(k[0]), Y(k[1]), 8.5, 6.5, pjBot); cap(X(k[0]), Y(k[1]), X(k[2]), Y(k[3]), 6.5, 5, pjBot);
      PART = idS;
      const tip = P.tip ? 0.45 : 0;
      if (bare) { rell(X(k[2] + f * 5), Y(k[3] + 1), 7, 3, f * tip, SKIN); }
      else { rell(X(k[2] + f * 5), Y(k[3] + 1), 9.5, 5, f * tip, SLIPC); rell(X(k[2] + f * 9), Y(k[3] - 1), 4, 3.5, 0, (x, y) => (ih(x + OX, y + OY, 3) > 0.5 ? SLIPC : hx('fff0c4'))); }
    };
    const armDraw = (hand, idA, idH) => {
      const k = ik(shX, shY, hand[0], hand[1], 26, 24, -f);
      arms.push(k);
      PART = idA; cap(X(shX), Y(shY), X(k[0]), Y(k[1]), 6, 5, TOPC); cap(X(k[0]), Y(k[1]), X(k[2]), Y(k[3]), 5, 4.2, TOPC);
      PART = idH; ell(X(k[2]), Y(k[3]), 4.4, 4.4, SKIN);
      return k;
    };
    const torch = (k, id) => {
      if (!P.torch) return;
      const a = P.torch.a, dx = Math.cos(a), dy = Math.sin(a), x = k[2], y = k[3];
      PART = id;
      cap(X(x - dx * 9), Y(y - dy * 9), X(x + dx * 8), Y(y + dy * 8), 3.6, 3.8, TORCHC);
      cap(X(x - dx * 2), Y(y - dy * 2), X(x + dx * 3), Y(y + dy * 3), 4, 4, TORCHD);
      cap(X(x + dx * 9), Y(y + dy * 9), X(x + dx * 13), Y(y + dy * 13), 5.6, 6.2, TORCHD);
      cap(X(x + dx * 13.5), Y(y + dy * 13.5), X(x + dx * 14), Y(y + dy * 14), 4.4, 4.4, P.torch.on > 0.5 ? hx('fff0c4') : hx('b6c4da'));
      HER.beam = [x + dx * 15, y + dy * 15, a];
    };
    const slipper = (k, id) => {
      if (P.slipper === undefined || P.slipper === null) return;
      PART = id; const a = P.slipper, x = k[2], y = k[3];
      rell(X(x + Math.cos(a) * 6), Y(y + Math.sin(a) * 6), 11, 5.5, a, SLIPC);
      rell(X(x + Math.cos(a) * 13), Y(y + Math.sin(a) * 13), 5, 4, a, (xx, yy) => (ih(xx + OX, yy + OY, 4) > 0.5 ? SLIPC : hx('fff0c4')));
    };
    HER = { hip: [hX, hY], neck: [nX, nY], head: hc, f, beam: null };
    if (!P.sit) legDraw(P.feet[0], PART_IDS.legB, PART_IDS.slipB, P.bareB);
    const kB = armDraw(P.hands[0], PART_IDS.armB, PART_IDS.handB);
    slipper(kB, PART_IDS.itemB);
    if (P.torchB) { const keep = P.torch; P.torch = P.torchB; torch(kB, PART_IDS.itemB); P.torch = keep; }
    // torso: pyjama top
    PART = PART_IDS.torso;
    cap(X(hX), Y(hY - 4), X(nX), Y(nY + 6), 12, 10.5, TOPC);
    cap(X(hX - f * 1), Y(hY - 2), X(hX + f * 2), Y(hY - 8), 12.5, 12, TOPC);
    if (!P.sit) legDraw(P.feet[1], PART_IDS.legF, PART_IDS.slipF, false);
    if (P.lap) { PART = PART_IDS.lap; P.lap(); }
    if (P.tuck) { PART = PART_IDS.lap; const tx = nX - f * 1, ty = nY + 24, a = f > 0 ? Math.PI - 0.25 : 0.25, dx = Math.cos(a), dy = Math.sin(a);
      cap(X(tx - dx * 12), Y(ty - dy * 12), X(tx + dx * 6), Y(ty + dy * 6), 3.6, 3.8, TORCHC); cap(X(tx + dx * 7), Y(ty + dy * 7), X(tx + dx * 11), Y(ty + dy * 11), 5.6, 6, TORCHD); }
    // head: back hair, neck, face, front hair
    const fr = P.fright || 0, bo = P.bounce || 0;
    const puffs = [[-9, -9, 10], [-15, -1, 9], [-13, 8, 8], [-3, -15, 9], [6, -14, 7.5], [-19, -11, 7], [-8, -21, 7], [2, -21, 6], [-21, 3, 6.5], [-17, 13, 6], [-6, 13, 5]];
    PART = PART_IDS.hairB;
    for (let k = 0; k < puffs.length; k++) {
      const q = puffs[k], s = 1 + 0.32 * fr + 0.06 * Math.sin(k * 1.7) * bo;
      const ox = q[0] * s * (1 + 0.15 * fr), oy = q[1] * s * (1 + 0.25 * fr) - fr * 4;
      ell(X(hc[0] + hf * ox), Y(hc[1] + oy), q[2] * s, q[2] * s, (x, y) => (ih(x + OX >> 1, y + OY >> 1, 7) > 0.8 ? HAIRL : HAIR));
    }
    if (fr > 0.3) for (let k = 0; k < 7; k++) { const a = -Math.PI / 2 + (k - 3) * 0.38 * hf, L = 26 + 8 * fr + 4 * ih(k, 1, 1); curve([[hc[0] + Math.cos(a) * 14, hc[1] + Math.sin(a) * 14], [hc[0] + Math.cos(a + 0.12 * hf) * L, hc[1] + Math.sin(a + 0.12) * L]].map((p) => [X(p[0]), Y(p[1])]), 1.6, HAIR); }
    PART = PART_IDS.neck; cap(X(nX), Y(nY + 6), X(hc[0] - hf * 2), Y(hc[1] + 8), 4.5, 4.5, SKIN);
    PART = PART_IDS.face;
    ell(X(hc[0]), Y(hc[1]), 12.5, 13, SKIN);
    ell(X(hc[0] + hf * 6), Y(hc[1] + 7), 8, 6.5, SKIN);
    ell(X(hc[0] + hf * 12.5), Y(hc[1] + 1.5), 2.6, 3, SKIN);
    PART = PART_IDS.hairF;
    for (const q of [[2, -12, 8], [-4, -12, 8], [9, -10, 5], [-12, -4, 7]]) ell(X(hc[0] + hf * q[0] * (1 + 0.1 * fr)), Y(hc[1] + q[1] * (1 + 0.12 * fr) - fr * 2), q[2], q[2] * 0.9, (x, y) => (ih(x + OX >> 1, y + OY >> 1, 9) > 0.78 ? HAIRL : HAIR));
    // front arm and the torch / pan
    if (P.pan) drawPanCat(P.pan.x, P.pan.y, P.pan);
    const kF = armDraw(P.hands[1], PART_IDS.armF, PART_IDS.handF);
    torch(kF, PART_IDS.itemF);
    HER.hands = [kB, kF];
    HER.legs = legs;
    HER.faceP = P;
  }
  // facial details, drawn after the bevel/outline pass so they stay crisp
  function faceDetails() {
    if (!HER || !HER.faceP) return;
    const P = HER.faceP, hf = P.headF || P.f, hc = HER.head;
    const ex = Math.round(X(hc[0] + hf * 6.5)), ey = Math.round(Y(hc[1] - 2));
    const dark = hx('1a1218'), white = hx('f2e6cc');
    const set = (x, y, c) => { if (x >= 0 && y >= 0 && x < AW && y < AH) { const j = (y * AW + x) * 3; SP.c[j] = c[0]; SP.c[j + 1] = c[1]; SP.c[j + 2] = c[2]; } };
    const e = P.eye || 'open', lk = P.look || 0;
    if (e === 'closed' || e === 'laugh') {
      for (let k = -2; k <= 2; k++) set(ex + k * hf, ey + (e === 'laugh' ? (Math.abs(k) === 2 ? 1 : 0) : (Math.abs(k) === 2 ? 0 : 1)), dark);
    } else {
      const wide = e === 'wide', sq = e === 'squint';
      const w = wide ? 5 : 4, h = wide ? 5 : sq ? 2 : 4;
      for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) set(ex - hf * 2 + hf * xx, ey - (h >> 1) + yy, white);
      const px = ex + hf * (wide ? 1 : 1) + Math.round(lk * hf), py = ey - (sq ? 1 : 0) + (P.lookY || 0);
      set(px, py, dark); set(px + hf, py, dark); if (!sq) { set(px, py - 1 + (wide ? 0 : 0), dark); set(px + hf, py - 1, wide ? white : dark); }
      if (!wide && !sq) set(px + hf, py - 1, white);
    }
    // brow
    const bw = P.brow || 0;
    for (let k = -2; k <= 2; k++) set(ex + k * hf, ey - (e === 'wide' ? 6 : 5) - Math.round(bw * (k * hf > 0 ? 0 : 1) + (bw < 0 ? -bw * (k * hf > 0 ? 1 : 0) : 0)), HAIR);
    // mouth
    const mx = Math.round(X(hc[0] + hf * 9)), my = Math.round(Y(hc[1] + 8));
    const m = P.mouth || 'line';
    if (m === 'o') { set(mx, my, dark); set(mx, my + 1, dark); set(mx - hf, my, dark); set(mx - hf, my + 1, dark); }
    else if (m === 'grin') { for (let k = -1; k <= 2; k++) set(mx - hf * k, my, dark); for (let k = 0; k <= 1; k++) set(mx - hf * k, my + 1, hx('a34b5a')); set(mx + hf, my - 1, dark); }
    else if (m === 'smile') { set(mx, my, dark); set(mx - hf, my + 1, dark); set(mx - 2 * hf, my + 1, dark); set(mx + hf, my - 1, dark); }
    else if (m === 'grit') { for (let k = -1; k <= 2; k++) set(mx - hf * k, my, dark); for (let k = 0; k <= 1; k++) set(mx - hf * k, my + 1, white); }
    else { set(mx, my, dark); set(mx - hf, my, dark); }
    // cheek
    set(Math.round(X(hc[0] + hf * 1)), Math.round(Y(hc[1] + 4)), hx('c8606a')); set(Math.round(X(hc[0] + hf * 2)), Math.round(Y(hc[1] + 4)), hx('c8606a'));
  }

  /* ---------------- the cat in the pan (small, side view: in the house) */
  const GING = hx('d27430'), GINGL = hx('ee9a48'), GINGD = hx('a85320'), CREAM = hx('fff0c4');
  const COPPER = hx('bd6a4b'), COPL = hx('e3967a'), COPD = hx('8d4430');
  // q: { f (handle side), blink 0..1 (1 = closed), shine (eye-shine in the beam), look, lift (0 on floor), tail }
  function drawPanCat(x, y, q) {
    const f = q.f || 1;
    PART = PART_IDS.cat;
    // tail over the rim
    const tw = Math.sin(q.tail || 0) * 3;
    curve([[X(x - f * 14), Y(y - 10)], [X(x - f * 22), Y(y - 6 + tw)], [X(x - f * 25), Y(y - 14 + tw)]], 2.6, GING);
    // body and head
    ell(X(x), Y(y - 14), 13, 10, (xx, yy) => ((xx + OX + (yy + OY)) % 5 === 0 ? GINGD : GING));
    ell(X(x + f * 2), Y(y - 30), 10.5, 9, GING);
    poly([[X(x - 8), Y(y - 33)], [X(x - 7), Y(y - 44)], [X(x - 1), Y(y - 37)]], GING);
    poly([[X(x + 3), Y(y - 37)], [X(x + 9), Y(y - 44)], [X(x + 10), Y(y - 32)]], GING);
    ell(X(x + f * 3), Y(y - 25), 5.5, 4, CREAM);
    PART = PART_IDS.pan;
    // the saucepan: body, rim, handle
    rect(X(x - 17), Y(y - 12), 34, 13, (xx, yy) => (yy + OY < y - 8 ? COPL : COPPER));
    rect(X(x - 19), Y(y - 14), 38, 3, COPL);
    cap(X(x + f * 18), Y(y - 10), X(x + f * 36), Y(y - 14), 2.2, 2.2, hx('4c2d1d'));
    q._eyes = [x + f * 2, y - 31];
  }
  function panCatDetails(q) {
    if (!q || !q._eyes) return;
    const set = (x, y, c) => { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < AW && y < AH) { const j = (y * AW + x) * 3; SP.c[j] = c[0]; SP.c[j + 1] = c[1]; SP.c[j + 2] = c[2]; } };
    const [x, y] = q._eyes, dark = hx('1a1218');
    for (const dx of [-4, 4]) {
      if ((q.blink || 0) > 0.5) { set(X(x + dx - 1), Y(y), dark); set(X(x + dx), Y(y + 1), dark); set(X(x + dx + 1), Y(y), dark); }
      else { const c = q.shine ? hx('fff0c4') : hx('efc472'); set(X(x + dx), Y(y), c); set(X(x + dx + 1), Y(y), c); set(X(x + dx), Y(y + 1), dark); set(X(x + dx + 1), Y(y + 1), q.shine ? c : dark); }
    }
    set(X(x + (q.f || 1) * 2), Y(y + 4), hx('d77b86'));
  }

  /* ================================================================ close-up 1: in bed, from above */
  const CW = 372, CH = 470;
  const FACE = { x: 186, y: 168 };
  const QUILT = ['efc472', 'f2e6cc', '8ea78e', 'bd6a4b', 'd9a85b', 'b5c9ab', 'efc472', 'ddcca8'].map(hx);
  function moonPatchCU(x, y) {
    const a = -0.2, ca = Math.cos(a), sa = Math.sin(a), dx = x - 214, dy = y - 236;
    const u = dx * ca + dy * sa, v = -dx * sa + dy * ca;
    let m = sstep(-170, -162, u) * (1 - sstep(150, 158, u)) * sstep(-150, -142, v) * (1 - sstep(130, 138, v));
    m *= 1 - 0.85 * (1 - sstep(3, 6, Math.abs(u + 6)));
    m *= 1 - 0.85 * (1 - sstep(3, 6, Math.abs(v - 4)));
    m *= 1 - 0.6 * brMask(x * 1.15 - 40, y * 0.95 + 20);
    return m;
  }
  function buildBedCU() {
    const P = newPlate(CW, CH);
    target(P.A); PART = 1;
    // floor at the left, planks seen from above
    rect(0, 0, CW, CH, (x, y) => { const b = fl(x / 15); return x % 15 === 0 ? hx('4c2d1d') : (y + b * 37) % 90 === 0 ? hx('4c2d1d') : mixc(hx('7f5131'), hx('9b6840'), ih(b, fl((y + b * 37) / 90), 2) * 0.8); });
    ell(30, 420, 26, 10, hx('d77b86')); ell(30, 420, 18, 6, hx('f2b3b4'));
    // headboard
    rect(64, 0, CW - 64, 30, (x, y) => (y < 4 ? hx('b8834f') : (x * 7 + y * 3) % 23 < 2 ? hx('653d26') : hx('7f5131')));
    for (let x = 80; x < CW; x += 40) ell(x, 15, 5, 5, hx('9b6840'));
    // mattress and sheet
    rect(64, 30, CW - 64, CH - 30, (x, y) => mixc(hx('f2e6cc'), hx('fff0c4'), fbm(x / 20, y / 20, 61, 2) > 0.55 ? 0.8 : 0.2));
    rect(64, 30, 4, CH - 30, hx('ddcca8'));
    // the pillow, with a seam and a soft dent
    for (let y = 36; y < 158; y++) span(y, 96 + 6 * Math.cos((y - 36) / 122 * Math.PI) - 6, 280 - 6 * Math.cos((y - 36) / 122 * Math.PI) + 6, (x, yy) => { const d = Math.hypot((x - 186) / 90, (yy - 100) / 56); return d < 0.85 ? (d < 0.55 ? hx('ddcca8') : hx('f2e6cc')) : hx('fff0c4'); });
    for (let x = 100; x < 280; x += 3) put(x, 40, hx('ddcca8'));
    // nightstand, lamp from above, the clock reading 3:00, a glass of water, the torch
    rect(0, 0, 62, 132, hx('9b6840')); rect(0, 128, 62, 6, hx('653d26')); rect(58, 0, 4, 132, hx('7f5131'));
    for (let y = 8; y < 126; y += 9) rect(2, y, 54, 1, hx('8a5a36' === '' ? '' : '7f5131'));
    ell(26, 36, 23, 23, hx('efe2c4')); ell(26, 36, 17, 17, hx('f2e6cc')); ell(26, 36, 6, 6, hx('d9a85b'));
    rect(6, 76, 40, 18, hx('222125')); rect(8, 78, 36, 14, hx('141316'));
    const DIG = { 3: ['###', '..#', '.##', '..#', '###'], 0: ['###', '#.#', '#.#', '#.#', '###'] };
    emitShape(P, P.E, [210, 110, 40], () => {
      const dg = (d, x0) => DIG[d].forEach((r, yy) => { for (let xx = 0; xx < 3; xx++) if (r[xx] === '#') { put(x0 + xx * 2, 80 + yy * 2, 1); put(x0 + xx * 2 + 1, 80 + yy * 2, 1); put(x0 + xx * 2, 81 + yy * 2, 1); put(x0 + xx * 2 + 1, 81 + yy * 2, 1); } });
      dg(3, 10); put(18, 83, 1); put(18, 87, 1); dg(0, 21); dg(0, 31);
    });
    emitShape(P, P.E, [40, 18, 6], () => rect(6, 76, 40, 18, 1));
    ell(46, 112, 8, 8, hx('b6c4da')); ell(46, 112, 5, 5, hx('dfe7f1')); put(44, 110, hx('ffffff' === '' ? '' : 'dfe7f1'));
    // light: blue ambient, the moon patch through the window (with its bars and the tree), the clock's faint glow
    for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) {
      const i = y * CW + x, j = i * 3, m = moonPatchCU(x, y);
      const amb = 0.85 + 0.15 * (y / CH);
      P.MS[i] = m;
      const cg = 0.22 / (1 + ((x - 26) * (x - 26) + (y - 86) * (y - 86)) / 900);
      for (let c = 0; c < 3; c++) P.LN[j + c] = [0.3, 0.34, 0.54][c] * amb + [0.5, 0.53, 0.64][c] * m + [1.0, 0.55, 0.25][c] * cg;
      for (let c = 0; c < 3; c++) P.LW[j + c] = P.LN[j + c];
    }
    return P;
  }
  // q: { open (0 closed .. 1 open .. 1.25 wide), look [x,y], brow (worry 0..1), mouth, quilt (edge y), hands 0..1, jolt, fright }
  function quiltFill(x, y) {
    const wx = x + OX, wy = y + OY, s = 30, bx = fl((wx + 6) / s), by = fl((wy - 12) / s);
    const lx = (wx + 6) - bx * s, ly = (wy - 12) - by * s;
    if ((lx === 0 || ly === 0) && ((wx + wy) & 3) < 2) return hx('fff0c4');
    let c = QUILT[fl(ih(bx, by, 17) * QUILT.length)];
    if ((bx + by) % 3 === 0 && (lx + ly) % 7 === 0) c = mulc(c, 0.86);
    return c;
  }
  const curl = (pcx, pcy, r) => (x, y) => {
    const wx = x + OX + 0.5, wy = y + OY + 0.5, d = Math.hypot(wx - pcx, wy - pcy), h = Math.hypot(wx - pcx + r * 0.22, wy - pcy + r * 0.3);
    if (d > r * 0.84 + dith(x, y) * r * 0.08) return hx('1f130e');
    if (h > r * 0.4 && h < r * 0.56 && (wx - pcx) + (wy - pcy) < -r * 0.35 && (wy - pcy) < 0) return HAIRL;
    return HAIR;
  };
  function faceTop(q) {
    const cx = FACE.x, cy = FACE.y + (q.jolt || 0), fr = q.fright || 0;
    // hair spread on the pillow: a ring of big curls
    PART = PART_IDS.hairB;
    for (let k = 0; k < 26; k++) {
      const a = -Math.PI * 1.08 + k / 25 * Math.PI * 1.16 + (ih(k, 4, 2) - 0.5) * 0.1;
      const R = (70 + 22 * ih(k, 1, 2)) * (1 + 0.1 * fr), r = 17 + 9 * ih(k, 2, 2);
      const pcx = cx + Math.cos(a) * R * 1.12, pcy = cy + 8 + Math.sin(a) * R * 0.92;
      ell(X(pcx), Y(pcy), r, r * 0.92, curl(pcx, pcy, r));
    }
    for (let k = 0; k < 10; k++) { const a = Math.PI * 0.2 + k * 0.07, R = 92; ell(X(cx + (k < 5 ? -1 : 1) * Math.abs(Math.cos(a)) * R * 1.2), Y(cy + 30 + k % 5 * 10), 14, 14, HAIR); }
    // ears and face
    PART = PART_IDS.face;
    ell(X(cx - 45), Y(cy + 6), 8, 12, SKIN); ell(X(cx + 45), Y(cy + 6), 8, 12, SKIN);
    ell(X(cx), Y(cy), 46, 55, (x, y) => {
      const dx = (x + OX - cx) / 46, dy = (y + OY - cy) / 55, d = dx * dx + dy * dy;
      const hl = Math.hypot(dx + 0.25, dy + 0.45);
      if (d > 0.78 + 0.06 * dith(x, y)) return hx('7c4a31');
      if (hl < 0.42 + 0.1 * dith(x, y)) return SKINL;
      return SKIN;
    });
    ell(X(cx), Y(cy + 40), 26, 14, (x, y) => ((y + OY) > cy + 46 + 3 * dith(x, y) ? hx('7c4a31') : SKIN));
    // a few curls on the forehead
    PART = PART_IDS.hairF;
    for (const [dx, dy, r] of [[-30, -50, 13], [-12, -56, 13], [8, -55, 12], [26, -49, 12], [40, -38, 9], [-42, -36, 9]]) ell(X(cx + dx), Y(cy + dy - fr * 2), r, r * 0.9, curl(cx + dx, cy + dy - fr * 2, r));
    // the pyjama collar (when the quilt is down), and in the standing close-up her shoulders
    PART = PART_IDS.torso;
    if (q.body) {
      poly([[X(cx - 50), Y(cy + 58)], [X(cx + 50), Y(cy + 58)], [X(cx + 118), Y(cy + 112)], [X(cx + 132), Y(cy + 330)], [X(cx - 132), Y(cy + 330)], [X(cx - 118), Y(cy + 112)]], (x, y) => {
        const wx = x + OX, wy = y + OY, fold = Math.sin((wx - cx) * 0.09 + (wy - cy) * 0.03) > 0.86;
        return Math.abs(wx - cx - 6) < 2 && wy > cy + 80 ? PIPE : fold ? hx('6d8872') : TOPC; });
      for (const sd of [-1, 1]) poly([[X(cx), Y(cy + 84)], [X(cx + sd * 52), Y(cy + 56)], [X(cx + sd * 70), Y(cy + 74)], [X(cx + sd * 18), Y(cy + 112)]], (x, y) => (ih(x + OX, y + OY, 5) > 2 ? 0 : PIPE));
      for (const sd of [-1, 1]) poly([[X(cx), Y(cy + 88)], [X(cx + sd * 50), Y(cy + 61)], [X(cx + sd * 64), Y(cy + 75)], [X(cx + sd * 16), Y(cy + 106)]], TOPC);
      for (let k = 0; k < 3; k++) ell(X(cx + 12), Y(cy + 128 + k * 34), 4, 4, PIPE);
    }
    poly([[X(cx - 58), Y(cy + 66)], [X(cx - 8), Y(cy + 52)], [X(cx), Y(cy + 74)], [X(cx + 8), Y(cy + 52)], [X(cx + 58), Y(cy + 66)], [X(cx + 70), Y(cy + 110)], [X(cx - 70), Y(cy + 110)]], TOPC);
    PART = PART_IDS.lap;
    // the quilt, pulled up to just under her eyes when she is frightened
    const qy = q.quilt;
    for (let y = Math.max(0, fl(Y(qy - 10))); y < AH; y++) {
      const wy = y + OY;
      span(y, 0, AW, (x) => { const wx = x + OX, e = qy + 3 * Math.sin(wx * 0.045) + 5 * Math.cos((wx - cx) * 0.02); if (wy < e) return null; return wy < e + 11 ? (wy < e + 2 ? hx('ddcca8') : hx('fff0c4')) : quiltFill(x, y); });
    }
    // hands gripping the edge
    if (q.hands > 0.01) {
      PART = PART_IDS.handF;
      for (const s of [-1, 1]) for (let k = 0; k < 4; k++) {
        const hxp = cx + s * (22 + k * 9), e = qy + 3 * Math.sin(hxp * 0.045) + 5 * Math.cos((hxp - cx) * 0.02);
        ell(X(hxp), Y(e + 4 - 8 * q.hands), 5, 7, SKIN);
      }
    }
  }
  function faceTopDetails(q) {
    const cx = FACE.x, cy = FACE.y + (q.jolt || 0);
    const dark = hx('1a1218'), white = hx('f2e6cc'), iris = hx('3b2119');
    const set = (x, y, c) => { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < AW && y < AH) { const j = (y * AW + x) * 3; SP.c[j] = c[0]; SP.c[j + 1] = c[1]; SP.c[j + 2] = c[2]; } };
    const qy = q.quilt;
    const vis = (x, y) => y < qy + 3 * Math.sin(x * 0.045) + 5 * Math.cos((x - cx) * 0.02) - 0.5;
    const S = (x, y, c) => { if (vis(x, y)) set(X(x), Y(y), c); };
    const o = q.open, lx = (q.look || [0, 0])[0], ly = (q.look || [0, 0])[1];
    for (const s of [-1, 1]) {
      const ex = cx + s * 21, ey = cy - 2;
      if (o < 0.12) {
        for (let dx = -9; dx <= 9; dx++) { const yy = ey + Math.round(2.4 * (1 - (dx / 9) * (dx / 9))); S(ex + dx, yy, dark); S(ex + dx, yy - 1, hx('7c4a31')); }
        S(ex + s * 9, ey - 1, dark); S(ex + s * 10, ey - 2, dark);
      } else {
        const h = 7.5 * Math.min(o, 1.3);
        for (let dx = -10; dx <= 10; dx++) {
          const sh = Math.sqrt(Math.max(0, 1 - (dx / 10.5) * (dx / 10.5)));
          const top = ey - h * sh, bot = ey + h * 0.75 * sh;
          for (let yy = Math.round(top); yy <= Math.round(bot); yy++) S(ex + dx, yy, white);
        }
        const ir = o > 1.1 ? 4 : 5.2, ix = ex + lx * 4.5, iy = ey + ly * 3;
        for (let yy = -6; yy <= 6; yy++) for (let xx = -6; xx <= 6; xx++) {
          const dx = ix + xx - ex, sh = Math.sqrt(Math.max(0, 1 - (dx / 10.5) * (dx / 10.5)));
          if (xx * xx + yy * yy > ir * ir || iy + yy < ey - h * sh || iy + yy > ey + h * 0.75 * sh) continue;
          S(ix + xx, iy + yy, xx * xx + yy * yy < 6 ? dark : iris);
        }
        S(ix - 2, iy - 2, white); S(ix - 1, iy - 2, white); S(ix - 2, iy - 1, white);
        for (let dx = -10; dx <= 10; dx++) { const sh = Math.sqrt(Math.max(0, 1 - (dx / 10.5) * (dx / 10.5))); S(ex + dx, Math.round(ey - h * sh) - 1, dark); S(ex + dx, Math.round(ey - h * sh) - 2, dark); }
        S(ex + s * 11, ey - h * 0.5 - 2, dark); S(ex + s * 12, ey - h * 0.5 - 3, dark);
      }
      // brows: thick; the inner end climbs when she worries
      const bw = q.brow || 0;
      for (let dx = -10; dx <= 10; dx++) {
        const inner = (dx * s < 0) ? (-dx * s) / 10 : 0;
        const yy = ey - 15 - 3 * bw - 6 * bw * inner + 2 * (dx / 10) * (dx / 10) * (1 - bw);
        S(ex + dx, yy, HAIR); S(ex + dx, yy - 1, HAIR); if (Math.abs(dx) < 8) S(ex + dx, yy - 2, HAIR);
      }
    }
    // nose and mouth
    S(cx - 5, cy + 19, hx('5a3324')); S(cx + 5, cy + 19, hx('5a3324')); S(cx - 4, cy + 20, hx('5a3324')); S(cx + 4, cy + 20, hx('5a3324'));
    for (let k = 0; k < 4; k++) S(cx - 1, cy + 6 + k * 3, SKINL);
    const m = q.mouth || 'line', my = cy + 33;
    if (m === 'o') { for (let yy = -3; yy <= 3; yy++) for (let xx = -3; xx <= 3; xx++) if (xx * xx / 9 + yy * yy / 12 <= 1) S(cx + xx, my + yy, Math.abs(yy) < 2 && Math.abs(xx) < 2 ? hx('5a2c22') : dark); }
    else if (m === 'smile') { for (let dx = -8; dx <= 8; dx++) S(cx + dx, my + Math.round(-2.2 * (1 - (dx / 8) * (dx / 8))) + 1, dark); S(cx - 9, my - 1, dark); S(cx + 9, my - 1, dark); }
    else if (m === 'grit') { for (let yy = -4; yy <= 4; yy++) for (let xx = -11; xx <= 11; xx++) { const edge = Math.abs(yy) === 4 || Math.abs(xx) === 11; S(cx + xx, my + yy, edge ? dark : yy === 0 ? hx('ddcca8') : (xx % 4 === 0 ? hx('ddcca8') : white)); } }
    else { for (let dx = -6; dx <= 6; dx++) S(cx + dx, my + (Math.abs(dx) > 4 ? 1 : 0), dark); }
    for (const s of [-1, 1]) for (let k = 0; k < 6; k++) S(cx + s * (27 + (k % 3) * 2), cy + 18 + (k > 2 ? 2 : 0), hx('c8606a'));
  }
  // the cat curled on the quilt (the end), and leaving
  function catCurled(x, y, q) {
    const br = 1 + 0.03 * Math.sin(q.breath || 0), lift = q.lift || 0, sx = q.sx || 1;
    PART = PART_IDS.cat;
    // the body: a curled kidney, tabby bands across the back, a paler flank
    ell(X(x - 6), Y(y + 4), 58 * br * sx, 40 * br, (xx, yy) => {
      const dx = (xx + OX - x + 6) / (58 * sx), dy = (yy + OY - y - 4) / 40, a = Math.atan2(dy, dx), r = Math.hypot(dx, dy);
      if (r > 0.88 + 0.08 * dith(xx, yy)) return GINGD;
      if (r > 0.5 && Math.sin(a * 9 + 0.6) > 0.5) return GINGD;
      if (r < 0.5) return dy < 0 ? GINGL : GING;
      return GING;
    });
    // the tail, round the front, pale-tipped
    const tl = [[X(x - 60 * sx), Y(y + 6)], [X(x - 44 * sx), Y(y + 36)], [X(x), Y(y + 46)], [X(x + 36 * sx), Y(y + 34)]];
    curve(tl, 8, (xx) => (((xx + OX) >> 3) & 1 ? GINGD : GING));
    ell(tl[3][0] + 5, tl[3][1] - 3, 7, 6, CREAM);
    // head at the top right of the curl, chin on the paws; at the end it lifts, ears up
    const hxp = x + 38 * sx + lift * 8, hyp = y - 18 - lift * 18;
    ell(X(x + 34 * sx), Y(y + 2), 11, 7, CREAM); ell(X(x + 52 * sx), Y(y + 4), 10, 7, CREAM);
    const ear = 11 + lift * 7;
    poly([[X(hxp - 21), Y(hyp - 4)], [X(hxp - 20 - lift * 2), Y(hyp - 12 - ear)], [X(hxp - 5), Y(hyp - 16)]], GING);
    poly([[X(hxp + 5), Y(hyp - 16)], [X(hxp + 20 + lift * 2), Y(hyp - 12 - ear)], [X(hxp + 21), Y(hyp - 4)]], GING);
    poly([[X(hxp - 17), Y(hyp - 6)], [X(hxp - 16), Y(hyp - 8 - ear)], [X(hxp - 8), Y(hyp - 13)]], hx('e3967a'));
    poly([[X(hxp + 8), Y(hyp - 13)], [X(hxp + 16), Y(hyp - 8 - ear)], [X(hxp + 17), Y(hyp - 6)]], hx('e3967a'));
    ell(X(hxp), Y(hyp), 23, 19, (xx, yy) => ((yy + OY) < hyp - 9 && Math.abs((xx + OX) - hxp) < 10 && ((xx + OX) & 3) === 0 ? GINGD : GING));
    ell(X(hxp - 7), Y(hyp + 8), 9, 6, CREAM); ell(X(hxp + 7), Y(hyp + 8), 9, 6, CREAM);
    q._head = [hxp, hyp];
  }
  function catCurledDetails(q) {
    if (!q._head) return;
    const set = (x, y, c) => { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < AW && y < AH) { const j = (y * AW + x) * 3; SP.c[j] = c[0]; SP.c[j + 1] = c[1]; SP.c[j + 2] = c[2]; } };
    const [x, y] = q._head, dark = hx('1a1218');
    for (const s of [-1, 1]) {
      if ((q.open || 0) < 0.5) for (let k = -4; k <= 4; k++) { set(X(x + s * 9 + k), Y(y - 2 + (Math.abs(k) >= 3 ? 0 : 1)), dark); }
      else { for (let k = -3; k <= 3; k++) for (let j = -2; j <= 2; j++) if (k * k / 9 + j * j / 4 <= 1) set(X(x + s * 9 + k), Y(y - 2 + j), Math.abs(k) < 1 ? dark : hx('efc472')); }
    }
    set(X(x), Y(y + 4), hx('d77b86')); set(X(x - 1), Y(y + 4), hx('d77b86')); set(X(x), Y(y + 5), hx('d77b86'));
    for (const s of [-1, 1]) for (let k = 0; k < 9; k++) { set(X(x + s * (14 + k * 1.6)), Y(y + 7 + k * 0.25), hx('fff0c4')); set(X(x + s * (14 + k * 1.6)), Y(y + 10 + k * 0.6), hx('fff0c4')); }
  }

  /* ================================================================ close-up 3: her face at the top of the stairs */
  function buildFaceCU() {
    const P = newPlate(CW, CH);
    target(P.A); PART = 1;
    rect(0, 0, CW, CH, (x, y) => (x % 26 === 0 ? hx('d9b77a') : x % 26 === 13 && (y & 2) ? hx('e6d3ac') : hx('efe2c4')));
    rect(0, 0, 44, 200, hx('b8834f')); rect(0, 0, 38, 194, hx('d9a85b')); rect(0, 0, 32, 188, hx('3a4c3f'));
    for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) {
      const i = y * CW + x, j = i * 3, wy = y + (x - CW) * 0.42;
      const m = sstep(-120, -108, wy) * (1 - sstep(110, 122, wy)) * (1 - 0.85 * (sstep(-46, -42, wy) * (1 - sstep(-36, -32, wy))));
      P.MS[i] = m;
      const fp = 0.55 / (1 + ((x - 186) * (x - 186) + (y - 175) * (y - 175)) / 4200);
      for (let c = 0; c < 3; c++) { P.LN[j + c] = [0.34, 0.38, 0.6][c] + [0.45, 0.5, 0.66][c] * m + [0.8, 0.78, 0.8][c] * fp; P.LW[j + c] = P.LN[j + c]; }
    }
    return P;
  }

  /* ================================================================ close-up 2: the reveal (the cat in the pan, in the torch beam) */
  function buildCatCU() {
    const P = newPlate(CW, CH);
    target(P.A); PART = 1;
    // backsplash tiles, worktop edge, lower cabinets with knobs, toe-kick, floor tiles in perspective
    rect(0, 0, CW, 92, (x, y) => ((x % 24 === 0 || y % 24 === 0) ? hx('ddcca8') : ((fl(x / 24) + fl(y / 24)) & 1 ? hx('f2e6cc') : hx('dbe5cc'))));
    rect(0, 92, CW, 16, hx('b8834f')); rect(0, 92, CW, 3, hx('d9a85b')); rect(0, 106, CW, 2, hx('7f5131'));
    rect(0, 108, CW, 206, hx('6d8872'));
    for (let x = -40; x < CW; x += 124) { rect(x + 8, 116, 108, 186, hx('8ea78e')); rect(x + 16, 124, 92, 170, hx('7f9a7c' === '' ? '' : '6d8872')); rect(x + 20, 128, 84, 162, hx('8ea78e')); ell(x + 100, 140, 3.5, 3.5, hx('d9a85b')); }
    rect(0, 302, CW, 14, hx('3a4c3f'));
    for (let y = 316; y < CH; y++) {
      const d = (y - 300) / 170, row = fl(Math.log(1 + (y - 316) / 12) * 4.1), sc = 40 + 60 * d;
      span(y, 0, CW, (x) => { const col = fl((x - 186) / sc + 100); return ((col + row) & 1) ? hx('f2e6cc') : hx('8ea78e'); });
    }
    for (let y = 316; y < CH; y++) { const r0 = Math.log(1 + (y - 316) / 12) * 4.1, r1 = Math.log(1 + (y + 1 - 316) / 12) * 4.1; if (fl(r0) !== fl(r1)) rect(0, y, CW, 1, hx('bfa985')); }
    // the lid, on its edge against the cabinet, and a wooden spoon
    rell(62, 392, 52, 16, -0.12, hx('bd6a4b')); rell(62, 390, 44, 12, -0.12, hx('e3967a')); ell(60, 386, 8, 5, hx('4c2d1d')); ell(60, 384, 6, 3, hx('7f5131'));
    cap(270, 430, 352, 404, 3, 3, hx('b8834f')); rell(262, 433, 12, 7, -0.3, hx('b8834f')); rell(262, 432, 8, 4, -0.3, hx('d9a85b'));
    // light: very dark blue; the torch is added per frame
    for (let i = 0; i < CW * CH; i++) { const y = fl(i / CW); for (let c = 0; c < 3; c++) P.LN[i * 3 + c] = [0.2, 0.23, 0.4][c] * (0.8 + 0.2 * y / CH); P.LW.set(P.LN.subarray(i * 3, i * 3 + 3), i * 3); }
    return P;
  }
  // q: { blink (1 shut), lid (0 open .. 1 half-closed: smug), ear (twitch 0..1), mrrp (mouth 0..1), tail (phase), tilt }
  const CATC = { x: 186, y: 176 };
  function catBig(q) {
    const x = CATC.x, y = CATC.y, til = q.tilt || 0;
    // the pan's back rim and dark inside
    PART = 70;
    ell(X(x), Y(306), 112, 24, COPD); ell(X(x), Y(308), 104, 19, hx('5a2c22'));
    // tail curling out over the right rim
    PART = 71;
    const tp = q.tail || 0;
    curve([[X(x + 64), Y(282)], [X(x + 112), Y(262)], [X(x + 132 + 6 * Math.sin(tp)), Y(226)], [X(x + 124 + 10 * Math.sin(tp + 0.8)), Y(196)]], 10, (xx, yy) => (((xx + OX + yy + OY) >> 3) & 1 ? GINGD : GING));
    // body
    PART = 72;
    ell(X(x), Y(y + 96), 78, 66, (xx, yy) => { const dx = xx + OX - x, dy = yy + OY - y - 96; return Math.sin(dx * 0.11 + Math.abs(dx) * 0.04 + dy * 0.02) > 0.72 ? GINGD : (dx * dx / 4900 + dy * dy / 3600 > 0.8 ? GINGD : GING); });
    ell(X(x), Y(y + 104), 36, 46, (xx, yy) => (fbm((xx + OX) / 5, (yy + OY) / 5, 9, 2) > 0.62 ? hx('f2e6cc') : CREAM));
    // head (tilted a little, chin up: proud)
    PART = 73;
    const hy = y + 4 - 4 * (q.chin || 0);
    const ears = (s, tw) => {
      const bx = x + s * 44, by = hy - 40, ang = s * (0.25 + 0.35 * tw);
      const tipx = bx + s * 8 + Math.sin(ang) * 46 * s, tipy = by - Math.cos(ang) * 46 + 4;
      poly([[X(bx - s * 30), Y(by + 8)], [X(tipx), Y(tipy)], [X(bx + s * 14), Y(by + 18)]], GING);
      poly([[X(bx - s * 18), Y(by + 8)], [X(tipx - s * 2), Y(tipy + 12)], [X(bx + s * 6), Y(by + 14)]], hx('e3967a'));
      for (let k = 0; k < 5; k++) line(X(tipx - s * 4 + k * s), Y(tipy + 14 + k), X(tipx - s * 4 + k * s - s * 3), Y(tipy + 24 + k * 2), CREAM);
    };
    ears(-1, 0); ears(1, q.ear || 0);
    ell(X(x), Y(hy), 76, 62, (xx, yy) => { const dx = (xx + OX - x) / 76, dy = (yy + OY - hy) / 62; return dx * dx + dy * dy > 0.84 ? GINGD : (dy < -0.3 && Math.abs(dx) < 0.5 ? GINGL : GING); });
    for (const s of [-1, 1]) poly([[X(x + s * 60), Y(hy - 8)], [X(x + s * 90), Y(hy + 18)], [X(x + s * 70), Y(hy + 22)], [X(x + s * 84), Y(hy + 34)], [X(x + s * 52), Y(hy + 40)]], GING);
    // muzzle and chin
    ell(X(x - 16), Y(hy + 30), 22, 17, CREAM); ell(X(x + 16), Y(hy + 30), 22, 17, CREAM); ell(X(x), Y(hy + 44), 16, 10, CREAM);
    // paws on the rim, and the front of the pan over the body
    PART = 74;
    ell(X(x), Y(332), 112, 24, COPPER);
    for (let yy = 306; yy < 384; yy++) {
      const w = 112 - Math.max(0, yy - 360) * 1.6;
      span(Y(yy), X(x - w), X(x + w), (xx) => { const u = (xx + OX - x) / w; return u < -0.86 || u > 0.9 ? COPD : (u > -0.55 && u < -0.36) ? COPL : (u > 0.5 ? hx('a85320') : COPPER); });
    }
    ell(X(x), Y(306), 112, 24, (xx, yy) => (yy + OY > 306 ? null : null));
    for (let xx = -112; xx <= 112; xx++) { const yy = 306 + 24 * Math.sqrt(Math.max(0, 1 - (xx / 112) * (xx / 112))); rect(X(x + xx), Y(yy - 2), 1, 5, xx > -70 && xx < -40 ? hx('ffe1b0') : COPL); }
    // handle
    PART = 75;
    cap(X(x + 108), Y(318), X(x + 132), Y(312), 7, 7, COPPER);
    cap(X(x + 132), Y(312), X(x + 196), Y(292), 7.5, 8.5, hx('4c2d1d')); cap(X(x + 140), Y(310), X(x + 190), Y(294), 2, 2, hx('7f5131'));
    PART = 76;
    for (const s of [-1, 1]) { ell(X(x + s * 34), Y(326), 18, 11, CREAM); }
    q._hy = hy;
  }
  function catBigDetails(q) {
    const x = CATC.x, hy = q._hy, dark = hx('1a1218');
    const set = (xx, yy, c) => { xx = Math.round(X(xx)); yy = Math.round(Y(yy)); if (xx >= 0 && yy >= 0 && xx < AW && yy < AH) { const j = (yy * AW + xx) * 3; SP.c[j] = c[0]; SP.c[j + 1] = c[1]; SP.c[j + 2] = c[2]; } };
    // stripes: the M on the forehead, cheeks
    for (let k = -1; k <= 1; k++) for (let j = 0; j < 22; j++) { set(x + k * 13 + Math.sin(j * 0.3) * 2, hy - 54 + j, GINGD); set(x + k * 13 + 1 + Math.sin(j * 0.3) * 2, hy - 54 + j, GINGD); }
    for (const s of [-1, 1]) for (let r = 0; r < 3; r++) for (let j = 0; j < 16; j++) { set(x + s * (58 + j), hy + 2 + r * 9 - j * 0.3, GINGD); }
    // eyes: amber, slit pupils, lids (smug half-closed, blinking)
    for (const s of [-1, 1]) {
      const ex = x + s * 30, ey = hy - 6;
      const lid = clamp(Math.max(q.lid || 0, q.blink || 0), 0, 1), h = 12 * (1 - lid) + 0.01;
      if (h < 1.2) { for (let k = -13; k <= 13; k++) { set(ex + k, ey + 2 - Math.round(2 * (1 - (k / 13) * (k / 13))) + 2, dark); set(ex + k, ey + 3 - Math.round(2 * (1 - (k / 13) * (k / 13))) + 2, dark); } continue; }
      for (let k = -14; k <= 14; k++) {
        const sh = Math.sqrt(Math.max(0, 1 - (k / 14.5) * (k / 14.5)));
        const top = ey + 10 - (h + 10) * sh * 1.0 + 10 * (1 - sh) * 0, bot = ey + 10 * sh;
        const t0 = Math.max(top, ey - 12 * sh + 24 * lid * sh);
        for (let yy = Math.round(t0); yy <= Math.round(bot); yy++) {
          const d = Math.abs(k) / 3.2 + 0 * yy;
          set(ex + k, yy, Math.abs(k + s * 1) < 2.2 ? dark : (yy > bot - 3 ? hx('d9a85b') : d < 2.6 ? hx('fbdc94') : hx('efc472')));
        }
        set(ex + k, Math.round(t0) - 1, dark); set(ex + k, Math.round(t0) - 2, dark);
        if (Math.abs(k) < 13) set(ex + k, Math.round(bot) + 1, dark);
      }
      set(ex - s * 5, ey - 3 + 14 * lid, hx('fff0c4')); set(ex - s * 4, ey - 3 + 14 * lid, hx('fff0c4')); set(ex - s * 5, ey - 2 + 14 * lid, hx('fff0c4'));
    }
    // nose, mouth
    for (let k = 0; k < 6; k++) for (let j = -6 + k; j <= 6 - k; j++) set(x + j, hy + 16 + k, k === 0 ? hx('f2b3b4') : hx('d77b86'));
    set(x, hy + 22, dark); set(x, hy + 23, dark); set(x, hy + 24, dark);
    for (let k = 1; k <= 6; k++) { set(x - k, hy + 25 + (k > 3 ? 0 : 1) - (k > 5 ? 1 : 0), dark); set(x + k, hy + 25 + (k > 3 ? 0 : 1) - (k > 5 ? 1 : 0), dark); }
    const mo = q.mrrp || 0;
    if (mo > 0.05) { const h = Math.round(9 * mo); for (let j = 0; j < h; j++) for (let k = -4 + (j > h - 3 ? 1 : 0); k <= 4 - (j > h - 3 ? 1 : 0); k++) set(x + k, hy + 27 + j, j > h - 4 ? hx('d77b86') : hx('5a2c22')); }
    // whiskers
    for (const s of [-1, 1]) for (let w = 0; w < 3; w++) for (let k = 0; k < 46; k++) {
      const xx = x + s * (34 + k), yy = hy + 26 + w * 6 - k * (0.22 - w * 0.12) + k * k * 0.004;
      if (k > 4) set(xx, yy, hx('fff0c4'));
    }
    // toe lines on the paws
    for (const s of [-1, 1]) for (const d of [-6, 0, 6]) { set(x + s * 34 + d, 330, hx('ddcca8')); set(x + s * 34 + d, 331, hx('ddcca8')); }
  }

  /* ================================================================ the clock */
  // Every cue lives here (the score reads them too: production/threeam/cues.js dumps this object).
  const T = {
    thud: 0, eyes: 0.1, creak1: 1.3, cut1: 2.5,
    claws: 2.7, creak2: 3.45, wardrobe: 3.5, heart: 3.9, reach: 4.9, grab: 5.35, out: 5.95, stand: 6.6,
    door: 8.4, coats: 9.4, freeze: 11.0, top: 13.0, slip0: 14.1, slip1: 15.0, cutF: 15.35, gulp: 15.75, resolve: 15.95, cutF2: 16.4, click: 16.55, smack: 16.85, on: 17.1,
    desc0: 17.45, desc1: 20.5, turn: 20.6, found: 21.15, cut2: 21.4,
    mrrp: 21.85, blink: 22.55, ear: 23.3, cut3: 24.0,
    recede: 24.0, sw: 24.65, light: 24.9, laugh: 25.05, slipOn: 26.1, walk2: 26.45, crouch: 27.4, lift: 28.0, hold: 28.6, walk3: 30.3, climb: 31.25,
    q1: [24.6, 25.1, 29.3, 29.7], q2: [29.8, 30.3, 34.1, 34.4],
    cut4: 34.4, catUp: 36.0, catGo: 36.4, catGone: 37.1,
  };
  const SHOTS = [
    { a: 0, b: T.cut1, k: 'bed' }, { a: T.cut1, b: T.cutF, k: 'house' }, { a: T.cutF, b: T.cutF2, k: 'face' }, { a: T.cutF2, b: T.cut2, k: 'house' }, { a: T.cut2, b: T.cut3, k: 'cat' },
    { a: T.cut3, b: T.cut4, k: 'house' }, { a: T.cut4, b: D, k: 'bed' },
  ];
  const CUTS = [T.cut1, T.cutF, T.cutF2, T.cut2, T.cut3, T.cut4];
  // the heart: lub-dub from T.heart, quickening to the torch, then gone; beat times are shared with the score
  const BEATS = [];
  (function () { let t = T.heart; while (t < T.on - 0.15) { BEATS.push(t); const u = (t - T.heart) / (T.on - T.heart); t += 60 / (66 + 74 * u * u); } })();
  function heartAt(t) {
    let v = 0;
    for (const b of BEATS) { const d = t - b; if (d > -0.02 && d < 0.6) v = Math.max(v, Math.exp(-d / 0.09) * (d >= 0 ? 1 : 0) + 0.6 * Math.exp(-Math.abs(d - 0.2) / 0.08) * (d > 0.12 ? 1 : 0)); }
    return v;
  }
  // monotone cubic through keys [[t, v], ...]
  function keys(K, t) {
    if (t <= K[0][0]) return K[0][1];
    if (t >= K[K.length - 1][0]) return K[K.length - 1][1];
    let i = 0; while (K[i + 1][0] < t) i++;
    const m = (j) => { if (j <= 0 || j >= K.length - 1) return 0; const d0 = (K[j][1] - K[j - 1][1]) / (K[j][0] - K[j - 1][0]), d1 = (K[j + 1][1] - K[j][1]) / (K[j + 1][0] - K[j][0]); return d0 * d1 <= 0 ? 0 : 2 / (1 / d0 + 1 / d1); };
    const h = K[i + 1][0] - K[i][0], s = (t - K[i][0]) / h, s2 = s * s, s3 = s2 * s;
    return (2 * s3 - 3 * s2 + 1) * K[i][1] + (s3 - 2 * s2 + s) * h * m(i) + (-2 * s3 + 3 * s2) * K[i + 1][1] + (s3 - s2) * h * m(i + 1);
  }
  const shotAt = (t) => SHOTS.find((s) => t >= s.a && t < s.b) || SHOTS[SHOTS.length - 1];

  /* ================================================================ her, in the house: a pose for every t */
  const HIPH = 77;
  const WALKX = [[T.stand, 150], [T.door, 330], [T.coats, 400], [T.freeze, 492], [T.freeze + 0.6, 496], [T.top, 622]];
  const STRIDE = 58;
  function walkFeet(x, fy, f, lift, stride) {
    const S = stride || STRIDE, A = S / 4, ph0 = (x / S) * TAU;
    const out = [];
    for (const off of [0, Math.PI]) {
      const p = mod(ph0 + off, TAU);
      let dx, up = 0;
      if (p < Math.PI) dx = A * Math.cos(p); else { const u = (p - Math.PI) / Math.PI; dx = -A + 2 * A * s5(u); up = Math.sin(u * Math.PI) * lift; }
      out.push([x + f * dx, fy - up]);
    }
    return out;
  }
  // stairs: tread k's foot spot (k = -1 the landing, 16 the hall floor)
  const tread = (k) => (k < 0 ? [618 + k * 0 - 4, Y1] : k >= NST - 1 ? [XST + (NST - 0.5) * TREAD + (k - NST + 1) * 6, Y0] : [XST + (k + 0.5) * TREAD, Y1 + (k + 1) * RISE]);
  function stairFeet(s) {               // s in step units: 0 = both on the landing, 17 = both on the hall floor
    const out = [];
    for (const par of [0, 1]) {
      const n = fl(s), u = s - n;
      let a, b, w;
      if ((n & 1) === par) { a = n - 1 - (par ? 0 : 0); w = 0; }
      // the foot whose turn it is swings from its last tread to two ahead
      const last = (k) => { let q = k; while ((q & 1) !== par) q--; return q; };
      if ((n & 1) !== par) { a = last(n); b = a + 2; w = s5(u); } else { a = last(n); b = a; w = 0; }
      const pa = tread(a - 1), pb = tread(b - 1);
      const x = lerp(pa[0], pb[0], w), y = lerp(pa[1], pb[1], w) - Math.sin(w * Math.PI) * 9;
      out.push([x, y]);
    }
    return out;
  }
  function herHouse(t) {
    const P = { f: 1, lean: 0, tilt: 0, eye: 'wide', look: 0, brow: 0, mouth: 'o', fright: 0, torch: null, slipper: null, bounce: 0 };
    const tremble = (amp) => (ih(fl(t * 15), 3, 9) - 0.5) * amp;
    if (t < T.out) {
      // sitting bolt upright in bed, hair on end, clutching the quilt
      P.sit = true; P.hx = 104; P.hy = 262 + tremble(0.8); P.lean = -0.04;
      P.fright = 1 - 0.55 * s5(ph(t, T.cut1, T.cut1 + 1.2));
      P.bounce = Math.exp(-(t - T.cut1) * 3) * Math.sin((t - T.cut1) * 30);
      P.look = t < 2.9 ? 0 : t < T.reach ? 1 : -1;
      P.lookY = t > T.creak2 && t < T.reach ? 1 : 0;
      P.brow = 1;
      P.mouth = 'o';
      const reach = s5(ph(t, T.reach, T.grab)) * (1 - s5(ph(t, T.grab + 0.1, T.out)));
      P.lean = -0.04 - 0.3 * reach;
      P.headF = t > T.reach - 0.2 && t < T.out - 0.2 ? -1 : 1;
      const chest = [112, 236];
      P.hands = [[lerp(chest[0] - 6, 40, reach), lerp(chest[1] - 2, 262, reach)], [118, 238]];
      if (t > T.grab) P.torchB = { a: lerp(-2.6, -1.7, s5(ph(t, T.grab, T.out))), on: 0 };
      P.lap = () => quiltOn(1, 0);
      P.feet = [[200, 258], [210, 258]];
      return P;
    }
    if (t < T.stand) {
      // throwing back the quilt and sliding out onto the floor
      const u = s5(ph(t, T.out, T.stand)), v = s5(ph(t, T.out, T.out + 0.35));
      P.hx = lerp(104, 150, u); P.hy = lerp(262, Y1 - HIPH, u) - Math.sin(u * Math.PI) * 10;
      P.lean = lerp(-0.04, 0.12, u);
      P.feet = [[lerp(200, 140, u), lerp(258, Y1, u)], [lerp(210, 160, u), lerp(258, Y1, u)]];
      P.hands = [[lerp(112, 140, u), lerp(236, 238, u)], [lerp(118, 166, u), lerp(238, 236, u)]];
      P.torch = { a: lerp(-1.7, 0.4, u), on: 0 };
      P.fright = 0.4; P.brow = 1; P.look = 1;
      P.lap = () => quiltOn(1 - v, v);
      return P;
    }
    if (t < T.top + 0.2) {
      // tiptoeing: bedroom -> landing -> the top of the stairs
      const x = keys(WALKX, t), stopped = t > T.freeze && t < T.freeze + 0.6;
      P.hx = x; const ft = walkFeet(x, Y1, 1, 10, STRIDE);
      const ph1 = (x / STRIDE) * TAU;
      P.hy = Y1 - HIPH + 1 - 2.5 * Math.abs(Math.sin(ph1)) + (stopped ? tremble(0.8) : 0);
      P.feet = ft; P.tip = true; P.lean = 0.16;
      P.hands = [[x + 6, Y1 - 128], [x + 18, Y1 - 112]];
      P.torch = { a: 0.35, on: 0 };
      P.fright = 0.25 + 0.3 * win(t, T.coats, T.freeze + 1, 0.3, 0.5);
      P.brow = 1; P.mouth = stopped ? 'o' : 'line';
      P.look = (t > T.coats + 0.4 && t < T.freeze + 0.8) ? (fl(t * 2.5) & 1 ? -1 : 1) : 1;
      P.headF = (t > T.freeze && t < T.freeze + 0.45) ? -1 : 1;
      P.eye = 'wide';
      return P;
    }
    if (t < T.desc0) {
      // the top of the stairs: frozen; the slipper comes off and goes up; click... nothing; whack; light
      const x = 622; P.hx = x; P.hy = Y1 - HIPH + tremble(1.2) * (t < T.on ? 1 : 0);
      P.feet = [[x - 9, Y1], [x + 9, Y1]];
      const sl = ph(t, T.slip0, T.slip1);
      if (sl > 0 && sl < 1) {
        const lift = Math.sin(sl * Math.PI);
        P.feet[1] = [x + 9 + 6 * lift, Y1 - 26 * lift];
        P.hy -= 0;
        P.lean = 0.35 * lift;
      }
      const raised = s5(ph(t, T.slip0 + 0.6, T.slip1 + 0.2));
      const smack = Math.exp(-Math.abs(t - T.smack) / 0.07);
      let hb = [lerp(x + 6, x + 22, Math.sin(sl * Math.PI)), lerp(Y1 - 128, Y1 - 30, Math.sin(sl * Math.PI))];
      if (t > T.slip0 + 0.45) hb = [lerp(x + 4, x - 4, raised), lerp(Y1 - 120, Y1 - 160, raised)];
      hb = [lerp(hb[0], x + 14, smack), lerp(hb[1], Y1 - 118, smack)];
      P.hands = [hb, [x + 20 + (t > T.click && t < T.on ? 2 * Math.sin(t * 40) * Math.exp(-(t - T.click) * 3) : 0), Y1 - 116]];
      if (t > T.slip0 + 0.45) P.slipper = lerp(0.2, -2.3, raised) + 1.2 * smack;
      P.bareF = t > T.slip0 + 0.45;
      P.torch = { a: lerp(0.3, 0.72, s5(ph(t, T.on - 0.2, T.desc0))), on: t >= T.on ? 1 : 0 };
      P.eye = t > T.click - 0.3 ? 'squint' : 'wide'; P.brow = t > T.click - 0.3 ? -1 : 1; P.mouth = t > T.click - 0.3 ? 'grit' : 'o';
      P.look = 1; P.lookY = 1; P.fright = 0.3 * (1 - ph(t, T.click, T.on));
      P.lean = Math.max(P.lean, 0.1);
      return P;
    }
    if (t < T.turn) {
      // down the stairs behind the beam, slipper raised
      const s = 17 * s5(ph(t, T.desc0, T.desc1)) * 0.0 + 17 * ph(t, T.desc0, T.desc1);
      const ft = stairFeet(s);
      P.feet = [ft[0], ft[1]];
      const fx = (ft[0][0] + ft[1][0]) / 2, fy = Math.max(ft[0][1], ft[1][1]);
      P.hx = fx + 2; P.hy = fy - HIPH + 2 - 3 * Math.abs(Math.sin(s * Math.PI));
      P.lean = 0.12; P.bareF = true;
      P.hands = [[P.hx - 4, P.hy - 82], [P.hx + 20, P.hy - 40]];
      P.slipper = -2.3 + 0.15 * Math.sin(t * 9);
      const u = ph(t, T.desc0, T.desc1);
      P.torch = { a: lerp(0.72, 0.95, u) + 0.06 * Math.sin(t * 3.1), on: 1 };
      P.eye = 'squint'; P.brow = -1; P.mouth = 'grit'; P.look = 1; P.lookY = 1;
      return P;
    }
    if (t < T.cut2 + 0.01 || (t >= T.cut3 && t < T.walk2)) {
      // at the foot of the stairs, facing the kitchen: the beam finds... (and, later, the laugh)
      const x = 916; P.f = -1; P.hx = x; P.hy = Y0 - HIPH;
      P.feet = [[x + 9, Y0], [x - 9, Y0]]; P.bareF = t < T.slipOn + 0.2;
      const sweep = s5(ph(t, T.turn + 0.1, T.found));
      P.torch = { a: lerp(Math.PI - 0.95, Math.PI - 0.42, sweep), on: t < 26.0 ? 1 : 1 - ph(t, 26.0, 26.3) };
      P.hands = [[x - 2, P.hy - 82], [x - 22, P.hy - 40]];
      P.slipper = -0.8;
      P.eye = 'squint'; P.brow = -1; P.mouth = 'grit'; P.look = 1; P.lookY = 1;
      if (t > T.found - 0.15 && t < T.cut2 + 0.1) { P.eye = 'wide'; P.brow = 1; P.mouth = 'o'; }
      if (t >= T.cut3) {
        // relief: the light switch with the slipper, then she laughs and puts the slipper back on
        P.eye = 'open'; P.brow = 0; P.mouth = 'smile';
        const sw = win(t, T.sw - 0.25, T.light + 0.25, 0.25, 0.25);
        P.hands[0] = [lerp(x - 2, LIGHT_SW[0] - 6, sw), lerp(P.hy - 82, LIGHT_SW[1] + 2, sw)];
        P.slipper = lerp(-0.8, -1.6, sw);
        const la = win(t, T.laugh, T.slipOn, 0.2, 0.3);
        if (la > 0) {
          P.eye = la > 0.5 ? 'laugh' : 'open'; P.mouth = la > 0.4 ? 'grin' : 'smile';
          P.tilt = 0.28 * la; P.hy += la * 2 * Math.abs(Math.sin((t - T.laugh) * 16));
          P.lean = -0.1 * la;
        }
        P.torch.a = lerp(Math.PI - 0.42, Math.PI - 1.2, s5(ph(t, T.laugh, T.laugh + 0.5)));
        const so = ph(t, T.slipOn - 0.1, T.walk2);
        if (so > 0) { const l = Math.sin(so * Math.PI); P.feet[1] = [x - 9 - 2 * l, Y0 - 18 * l]; P.hands[0] = [lerp(P.hands[0][0], x - 14, l), lerp(P.hands[0][1], Y0 - 30, l)]; P.lean = 0.3 * l; }
        if (t > T.walk2 - 0.1) P.slipper = null;
        const tk = s5(ph(t, T.walk2 - 0.35, T.walk2));
        if (tk > 0) { P.hands[1] = [lerp(P.hands[1][0], P.hx - 4, tk), lerp(P.hands[1][1], P.hy - 30, tk)]; P.torch.a = lerp(P.torch.a, 0.25, tk); }
      }
      return P;
    }
    // the kitchen: to the cat, scoop up pan and all, cuddle, and back up the stairs
    P.eye = 'open'; P.brow = 0; P.mouth = 'smile'; P.f = -1; P.lean = 0.05;
    P.torch = null; P.tuck = true;
    const cat = { f: -1, blink: 0, tail: t * 2 };
    if (t < T.crouch) {
      const x = lerp(916, 830, s5(ph(t, T.walk2, T.crouch)));
      P.hx = x; P.feet = walkFeet(x, Y0, -1, 6, 50); P.hy = Y0 - HIPH - 1.5 * Math.abs(Math.sin(x / 50 * TAU));
      P.hands = [[x - 4, P.hy - 40], [x - 10, P.hy - 42]];
      return P;
    }
    if (t < T.walk3) {
      const x = 830, c = s5(ph(t, T.crouch, T.lift)) * (1 - s5(ph(t, T.lift, T.hold)));
      P.hx = x; P.hy = Y0 - HIPH + 32 * c; P.feet = [[x + 10, Y0], [x - 12, Y0]]; P.lean = 0.05 + 0.5 * c;
      const up = s5(ph(t, T.lift, T.hold));
      const px = lerp(PAN_X + 2, x - 16, up), py = lerp(Y0, Y0 - 66, up);
      P.pan = Object.assign(cat, { x: px, y: py });
      P.hands = [[px + 14, py - 6], [px - 12, py - 4]];
      if (t > T.hold) { P.tilt = 0.25 * win(t, T.hold, T.walk3, 0.4, 0.4); P.eye = t > T.hold + 0.4 && t < T.walk3 - 0.3 ? 'closed' : 'open'; cat.blink = P.eye === 'closed' ? 1 : 0; }
      return P;
    }
    // back to the stairs and up them (facing right, carrying the pan)
    P.f = 1;
    if (t < T.climb) {
      const x = lerp(814, 912, s5(ph(t, T.walk3, T.climb)));
      P.hx = x; P.feet = walkFeet(x, Y0, 1, 6, 50); P.hy = Y0 - HIPH - 1.5 * Math.abs(Math.sin(x / 50 * TAU));
    } else {
      const s = 17 - 11 * ph(t, T.climb, T.cut4 + 0.4);
      const ft = stairFeet(s); P.feet = [ft[0], ft[1]];
      const fx = (ft[0][0] + ft[1][0]) / 2, fy = Math.max(ft[0][1], ft[1][1]);
      P.hx = fx - 4; P.hy = fy - HIPH + 2 - 3 * Math.abs(Math.sin(s * Math.PI));
      P.lean = 0.12;
    }
    P.pan = Object.assign(cat, { x: P.hx + 16, y: P.hy - 46, f: 1 });
    P.hands = [[P.pan.x - 12, P.pan.y - 6], [P.pan.x + 12, P.pan.y - 4]];
    return P;
  }
  // the quilt over her legs (on: 1 covering her, 0 thrown back)
  function quiltOn(on, off) {
    const top = [];
    for (let x = 90; x <= BED.x1 + 2; x += 2) {
      const u = (x - 90) / (BED.x1 - 90);
      let y = BED.top - 2 - 10 * Math.exp(-((x - 150) * (x - 150)) / 500) * on - 4 * Math.exp(-((x - 205) * (x - 205)) / 300) * on;
      if (x < 120) y = lerp(y, 232, (1 - (x - 90) / 30) * on);
      y = lerp(y, BED.top - 1 + 8 * Math.exp(-((x - 230) * (x - 230)) / 400), off);
      if (off > 0 && x < 90 + 120 * off) y = BED.top + 1;
      void u;
      top.push([X(x), Y(y)]);
    }
    const pts = top.concat([[X(BED.x1 + 3), Y(BED.top + 30)], [X(lerp(90, 200, off)), Y(BED.top + 32)]]);
    poly(pts, (x, y) => quiltFill(x, y));
    if (off > 0.05) { // the bunched fold at the foot
      ell(X(232), Y(BED.top - 2), 30 * off, 9 * off, quiltFill);
    }
  }

  /* ================================================================ cameras */
  function camHouse(t) {
    if (t < T.stand + 0.2) return [lerp(0, 6, ph(t, T.cut1, T.stand)), 16];
    if (t < T.top) { const x = keys(WALKX, t - 0.35); return [clamp(lerp(6, x - 150, s5(ph(t, T.stand + 0.2, T.stand + 1.4))), 0, HW - W), 16]; }
    if (t < T.desc0) {
      const u = s5(ph(t, T.top, T.top + 1.5)), a = keys(WALKX, T.top - 0.35) - 150, v = s5(ph(t, T.top + 1.5, T.desc0));
      return [lerp(a, 470, u) + 14 * v, lerp(16, 104, u) + 16 * v];
    }
    if (t < T.cut2) {
      // follow her down (with a little lag), then settle on the kitchen
      const hx = lerp(622, 916, s5(ph(t - 0.2, T.desc0 - 0.3, T.desc1 + 0.2)));
      const fx = clamp(hx - 150, 484, HW - W), fy = clamp(stairLine(hx) - 220, 120, 306);
      const u = s5(ph(t, T.desc0, T.desc0 + 0.6)), v = s5(ph(t, T.desc1 - 0.2, T.found));
      return [lerp(lerp(484, fx, u), HW - W, v), lerp(lerp(120, fy, u), 306, v)];
    }
    // the kitchen: still, a slow drift
    return [HW - W, 304];
  }

  /* ================================================================ composition */
  const FB = new Float32Array(NA * 3);     // this frame's linear-ish colour, 0..255
  const OUT = new Uint8Array(NA);
  let CAMF = [0, 0];                       // the sub-pixel part of the camera (for the present) and shake
  let SHAKE = [0, 0];
  let FEAR = 0;                            // how much of the world the fear has drained (0..1)
  // opt: { wa, beam: [x, y, a, k] (world), spot: [x, y, rx, ry, k], fear, beamHalf }
  function compose(P, opt) {
    const wa = opt.wa || 0, A = P.A.c, FGp = P.FG.p, FGc = P.FG.c, pw = P.w;
    const bm = opt.beam, sp = opt.spot;
    const bx = bm ? bm[0] : 0, by = bm ? bm[1] : 0, bca = bm ? Math.cos(bm[2]) : 0, bsa = bm ? Math.sin(bm[2]) : 0, bk = bm ? bm[3] : 0;
    const half = opt.beamHalf || 0.36, c0 = Math.cos(half), c1 = Math.cos(half * 0.55), blen = opt.beamLen || 260;
    const fear = opt.fear || 0;
    for (let y = 0; y < AH; y++) {
      const wy = y + OY;
      const ey = Math.abs((y - AH / 2) / (AH / 2));
      for (let x = 0; x < AW; x++) {
        const wx = x + OX, i = y * AW + x, j = i * 3;
        const pi = (wy < 0 || wx < 0 || wy >= P.h || wx >= pw) ? -1 : wy * pw + wx, pj = pi * 3;
        let r, g, b;
        if (FGp && pi >= 0 && FGp[pi]) { r = FGc[pj]; g = FGc[pj + 1]; b = FGc[pj + 2]; }
        else if (SP.p[i]) { r = SP.c[j]; g = SP.c[j + 1]; b = SP.c[j + 2]; }
        else if (pi >= 0) { r = A[pj]; g = A[pj + 1]; b = A[pj + 2]; }
        else { r = g = b = 0; }
        if (pi < 0) { FB[j] = FB[j + 1] = FB[j + 2] = 0; continue; }
        // light
        let lr = P.LN[pj] + (P.LW[pj] - P.LN[pj]) * wa, lg = P.LN[pj + 1] + (P.LW[pj + 1] - P.LN[pj + 1]) * wa, lb = P.LN[pj + 2] + (P.LW[pj + 2] - P.LN[pj + 2]) * wa;
        const sh = SHD[i];
        if (sh > 0 && !SP.p[i]) { const m = P.MS[pi] * sh * 0.9 * (1 - wa); lr -= MOON[0] * m; lg -= MOON[1] * m; lb -= MOON[2] * m; }
        let tl = 0, haze = 0;
        if (bk > 0) {
          const dx = wx + 0.5 - bx, dy = wy + 0.5 - by, d = Math.sqrt(dx * dx + dy * dy) + 1e-6, ca = (dx * bca + dy * bsa) / d;
          if (ca > c0) {
            const cone = ca >= c1 ? 1 : (ca - c0) / (c1 - c0), cs = cone * cone * (3 - 2 * cone);
            const fall = 1 / (1 + (d / blen) * (d / blen)), near = d < 16 ? d / 16 : 1;
            tl = bk * cs * fall * near * 0.5; haze = bk * cs * near * 0.45 / (1 + (d / (blen * 0.6)) * (d / (blen * 0.6)));
          }
        }
        if (sp && sp[4] > 0) {
          const dx = (wx + 0.5 - sp[0]) / sp[2], dy = (wy + 0.5 - sp[1]) / sp[3], d2 = dx * dx + dy * dy;
          let s = sp[4] * (d2 < 1 ? 1 - d2 * d2 * 0.6 : 0.4 / (d2 * d2));
          if (sh > 0 && !SP.p[i]) s *= 1 - 0.75 * sh;
          tl += s;
        }
        lr += TORCH[0] * tl; lg += TORCH[1] * tl; lb += TORCH[2] * tl;
        r = r * lr + P.E[pj] + P.EW[pj] * wa + haze * 26;
        g = g * lg + P.E[pj + 1] + P.EW[pj + 1] * wa + haze * 18;
        b = b * lb + P.E[pj + 2] + P.EW[pj + 2] * wa + haze * 9;
        // the fear drains colour and light from the edges in (the beam gives it back)
        if (fear > 0) {
          const ex = Math.abs((x - AW / 2) / (AW / 2)), e = Math.max(ex, ey), f = fear * (0.45 + 0.55 * e * e) * (1 - Math.min(1, tl * 1.6));
          if (f > 0) { const l = 0.3 * r + 0.55 * g + 0.15 * b, k = 1 - 0.42 * f; r = lerp(r, l * 0.92, f) * k; g = lerp(g, l * 0.94, f) * k; b = lerp(b, l * 1.04, f) * k; }
        }
        FB[j] = r; FB[j + 1] = g; FB[j + 2] = b;
      }
    }
  }
  function quantise() {
    const DA = 3.6, Kq = 63 / Math.sqrt(255);
    for (let y = 0, i = 0; y < AH; y++) {
      const by = (y & 3) << 2;
      for (let x = 0; x < AW; x++, i++) {
        const j = i * 3, d = BAY[by | (x & 3)] * DA;
        let r = FB[j], g = FB[j + 1], b = FB[j + 2];
        r = r <= 0 ? 0 : r >= 255 ? 63 : Math.sqrt(r) * Kq; g = g <= 0 ? 0 : g >= 255 ? 63 : Math.sqrt(g) * Kq; b = b <= 0 ? 0 : b >= 255 ? 63 : Math.sqrt(b) * Kq;
        let qr = (r + d + 0.5) | 0, qg = (g + d + 0.5) | 0, qb = (b + d + 0.5) | 0;
        qr = qr < 0 ? 0 : qr > 63 ? 63 : qr; qg = qg < 0 ? 0 : qg > 63 ? 63 : qg; qb = qb < 0 ? 0 : qb > 63 ? 63 : qb;
        OUT[i] = LUT[(qr << 12) | (qg << 6) | qb];
      }
    }
  }

  /* ================================================================ the words: a small serif pixel face at 2x */
  const GL = {
    a: [, , , '.###.', '....#', '.####', '#...#', '#...#', '#..##', '.##.#'],
    c: [, , , '.###', '#...', '#...', '#...', '#...', '#...', '.###'],
    e: [, , , '.###.', '#...#', '#...#', '#####', '#....', '#...#', '.###.'],
    f: ['..##', '.#..', '.#..', '###.', '.#..', '.#..', '.#..', '.#..', '.#..', '###.'],
    g: [, , , '.####', '#...#', '#...#', '#...#', '#...#', '#...#', '.####', '....#', '#...#', '.###.'],
    h: ['##...', '.#...', '.#...', '.#.#.', '.##.#', '.#..#', '.#..#', '.#..#', '.#..#', '##.##'],
    i: [, '.#.', , '##.', '.#.', '.#.', '.#.', '.#.', '.#.', '###'],
    k: ['##...', '.#...', '.#...', '.#.##', '.#.#.', '.##..', '.##..', '.#.#.', '.#..#', '##.##'],
    l: ['##.', '.#.', '.#.', '.#.', '.#.', '.#.', '.#.', '.#.', '.#.', '###'],
    m: [, , , '##.#..#..', '.##.##.#.', '.#..#..#.', '.#..#..#.', '.#..#..#.', '.#..#..#.', '##.###.##'],
    n: [, , , '##.#.', '.##.#', '.#..#', '.#..#', '.#..#', '.#..#', '##.##'],
    o: [, , , '.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
    r: [, , , '##.##', '.##..', '.#...', '.#...', '.#...', '.#...', '###..'],
    s: [, , , '.###', '#...', '#...', '.##.', '...#', '...#', '###.'],
    t: [, '.#..', '.#..', '###.', '.#..', '.#..', '.#..', '.#..', '.#.#', '..#.'],
    u: [, , , '##.##', '.#..#', '.#..#', '.#..#', '.#..#', '.#.##', '..#.#'],
    w: [, , , '##...##', '.#...#.', '.#...#.', '.#.#.#.', '.#.#.#.', '.##.##.', '.#...#.'],
    y: [, , , '##.##', '#...#', '#...#', '.#.#.', '.#.#.', '..#..', '..#..', '.#...', '.#...', '##...'],
    T: ['#######', '#..#..#', '...#...', '...#...', '...#...', '...#...', '...#...', '...#...', '...#...', '..###..'],
    S: ['.####', '#...#', '#....', '#....', '.###.', '....#', '....#', '....#', '#...#', '####.'],
    ';': [, , , , '#', , , , , '#', '#'],
    '.': [, , , , , , , , , '#'],
    '—': [, , , , , , '######'],
  };
  const CARDS = [
    { lines: ['There are more things', 'likely to frighten us', 'than there are', 'to crush us;'], at: T.q1 },
    { lines: ['we suffer more often', 'in imagination', 'than in reality.', '— Seneca'], at: T.q2 },
  ];
  const TS = 2, TEXT_Y = 312;
  function textPixels(card) {
    const px = [];
    card.lines.forEach((ln, li) => {
      const gw = (ch) => (ch === ' ' ? 3 : GL[ch].reduce((m, r) => Math.max(m, r ? r.length : 0), 0));
      let w = 0; for (const ch of ln) w += gw(ch) + 1; w -= 1;
      let x = Math.round(W / 2 - (w * TS) / 2) + M;
      const y0 = TEXT_Y + li * 30 + (li === 3 ? 6 : 0);
      for (const ch of ln) {
        if (ch !== ' ') GL[ch].forEach((row, ry) => { if (row) for (let rx = 0; rx < row.length; rx++) if (row[rx] === '#') px.push([x + rx * TS, y0 + ry * TS, li === 3 && card === CARDS[1]]); });
        x += (gw(ch) + 1) * TS;
      }
    });
    return px;
  }
  let TEXTPX = null;
  function drawText(t) {
    if (!TEXTPX) TEXTPX = CARDS.map(textPixels);
    CARDS.forEach((cd, k) => {
      const [a, b, c, d] = cd.at, f = ph(t, a, b) * (1 - ph(t, c, d));
      if (f <= 0) return;
      const sh = [26, 16, 18], fg = [255, 240, 196], acc = [239, 196, 114];
      const set = (x, y, col, al) => { if (x < 0 || y < 0 || x >= AW || y >= AH) return; if (al < 1 && (BAY[((y & 3) << 2) | (x & 3)] + 0.5) > al) return; const j = (y * AW + x) * 3; FB[j] = col[0]; FB[j + 1] = col[1]; FB[j + 2] = col[2]; };
      for (const [x, y] of TEXTPX[k]) for (let dy = 0; dy < TS + 1; dy++) for (let dx = 0; dx < TS + 1; dx++) set(x + dx + 1, y + dy + 1, sh, f);
      for (const [x, y, s] of TEXTPX[k]) for (let dy = 0; dy < TS; dy++) for (let dx = 0; dx < TS; dx++) set(x + dx, y + dy, s ? acc : fg, f);
    });
  }

  /* ================================================================ fear: how far the ink has got */
  function fearAt(t) {
    if (t < T.cut1) return 0.25 * s5(ph(t, 1.2, T.cut1));
    if (t < T.on) return keys([[T.cut1, 0.25], [6, 0.42], [10, 0.6], [13.5, 0.82], [T.on, 0.95]], t);
    if (t < T.cut2) return keys([[T.on, 0.95], [T.desc1, 0.7], [T.cut2, 0.62]], t);
    if (t < T.cut3) return 0.55 * (1 - s5(ph(t, T.cut2, T.cut3 - 0.3)));
    return 0;
  }

  /* ================================================================ the ink (Canvas 2D, full resolution) */
  let IC = null, ig = null, GRAIN = null, GPAT = null, B = 0, ICAM = [0, 0];
  const INKC = (a) => `rgba(11,10,13,${a})`, GREYC = (a) => `rgba(58,56,62,${a})`, BONE = (a) => `rgba(218,211,196,${a})`;
  const ACID = (a) => `rgba(178,216,62,${a})`, BRUISE = (a) => `rgba(96,60,118,${a})`, RUST = (a) => `rgba(178,84,42,${a})`, EMBER = (a) => `rgba(255,150,52,${a})`;
  const J = (id, k, amp) => (ih(id, k, B) - 0.5) * 2 * amp;
  const S = (x, y) => [(x - ICAM[0]) * K + SHAKE[0], (y - ICAM[1]) * K + SHAKE[1]];
  // tileable noise for the paper tooth and the charcoal mottling
  function pvn(x, y, P, sd) {
    const xi = fl(x), yi = fl(y), fx = x - xi, fy = y - yi, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
    const a = (i, j) => ih(mod(i, P), mod(j, P), sd);
    return lerp(lerp(a(xi, yi), a(xi + 1, yi), u), lerp(a(xi, yi + 1), a(xi + 1, yi + 1), u), v);
  }
  function pfbm(x, y, P, sd, o) { let s = 0, amp = 0.5, n = 0; for (let k = 0; k < o; k++) { s += amp * pvn(x, y, P, sd + k * 17); n += amp; x *= 2; y *= 2; P *= 2; amp *= 0.5; } return s / n; }
  let CHAR = null, CPAT = null;
  function buildGrain() {
    const N = 256;
    GRAIN = document.createElement('canvas'); GRAIN.width = GRAIN.height = N;
    let g = GRAIN.getContext('2d'), id = g.createImageData(N, N);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const i = (y * N + x) * 4;
      // paper tooth: the charcoal skips the pits of the paper
      const tooth = pfbm(x / 3.2, y / 2.6, N / 3.2 | 0, 901, 2), streak = pfbm(x / 24, y / 24, 10, 905, 2);
      const a = clamp((tooth - 0.6) * 5, 0, 1) * clamp((streak - 0.4) * 3, 0, 1);
      id.data[i] = id.data[i + 1] = id.data[i + 2] = 255; id.data[i + 3] = clamp(a, 0, 1) * 255;
    }
    g.putImageData(id, 0, 0);
    const CN = 512;
    CHAR = document.createElement('canvas'); CHAR.width = CHAR.height = CN;
    g = CHAR.getContext('2d'); id = g.createImageData(CN, CN);
    for (let y = 0; y < CN; y++) for (let x = 0; x < CN; x++) {
      const i = (y * CN + x) * 4, f = pfbm(x / 64, y / 64, 8, 911, 4), h = pfbm(x / 8, y / 40, 64, 931, 2);
      // smudged greys where the charcoal was rubbed, a few bone-pale lifts
      const grey = clamp((f - 0.5) * 3.2, 0, 1), lift = clamp((h - 0.72) * 5, 0, 1) * grey;
      id.data[i] = 64 + 120 * lift; id.data[i + 1] = 62 + 114 * lift; id.data[i + 2] = 70 + 100 * lift;
      id.data[i + 3] = (grey * 0.22 + lift * 0.16) * 255;
    }
    g.putImageData(id, 0, 0);
  }
  // Catmull-Rom through control points
  function crs(pts, n) {
    if (pts.length < 3) return pts.slice();
    const out = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
      for (let k = 0; k < n; k++) {
        const s = k / n, s2 = s * s, s3 = s2 * s;
        out.push([0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * s + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * s2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * s3),
          0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * s + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * s2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * s3)]);
      }
    }
    out.push(pts[pts.length - 1]);
    return out;
  }
  // a tapered, ragged brush stroke; o: { j: jitter, col, dry, rough }
  function brush(pts, w0, w1, id, o) {
    o = o || {};
    if (pts.length < 2) return;
    const jj = o.j === undefined ? 2.5 : o.j;
    const cp = pts.map((p, k) => [p[0] + J(id, k * 2, jj), p[1] + J(id, k * 2 + 1, jj)]);
    const sp = crs(cp, o.seg || 5), n = sp.length;
    if (n < 2) return;
    const L = [], R = [];
    for (let k = 0; k < n; k++) {
      const a = sp[Math.max(0, k - 1)], b = sp[Math.min(n - 1, k + 1)];
      let dx = b[0] - a[0], dy = b[1] - a[1]; const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
      const u = k / (n - 1), rough = o.rough === undefined ? 0.45 : o.rough;
      const w = lerp(w0, w1, u) * (1 - rough * 0.5 + rough * vn1(u * 7 + B * 1.37, id)) * (o.taper0 ? Math.min(1, u * 6 + 0.15) : 1) * 0.5;
      L.push([sp[k][0] - dy * w, sp[k][1] + dx * w]); R.push([sp[k][0] + dy * w, sp[k][1] - dx * w]);
    }
    ig.beginPath(); ig.moveTo(L[0][0], L[0][1]);
    for (let k = 1; k < n; k++) ig.lineTo(L[k][0], L[k][1]);
    for (let k = n - 1; k >= 0; k--) ig.lineTo(R[k][0], R[k][1]);
    ig.closePath(); ig.fillStyle = o.col || INKC(0.94); ig.fill();
    if (o.dry && Math.max(w0, w1) > 7) {
      ig.save(); ig.globalCompositeOperation = 'destination-out'; ig.lineCap = 'round';
      for (let s = 0; s < 3; s++) {
        const off = (ih(id, s + 40, B) - 0.5) * 0.7;
        ig.beginPath();
        for (let k = 0; k < n; k++) { const x = lerp(L[k][0], R[k][0], 0.5 + off), y = lerp(L[k][1], R[k][1], 0.5 + off); k ? ig.lineTo(x, y) : ig.moveTo(x, y); }
        ig.setLineDash([4 + 18 * ih(id, s, B + 1), 3 + 9 * ih(id, s + 9, B + 1)]); ig.lineDashOffset = 30 * ih(id, s + 3, B);
        ig.lineWidth = 1 + 1.6 * ih(id, s + 7, 1); ig.strokeStyle = 'rgba(0,0,0,0.85)'; ig.stroke();
      }
      ig.restore();
    }
  }
  function pline(pts, w, col, id, jj) {
    const cp = pts.map((p, k) => [p[0] + J(id, k * 2, jj || 1.5), p[1] + J(id, k * 2 + 1, jj || 1.5)]);
    ig.beginPath(); cp.forEach((p, k) => (k ? ig.lineTo(p[0], p[1]) : ig.moveTo(p[0], p[1])));
    ig.lineWidth = w; ig.strokeStyle = col; ig.stroke();
  }
  // a frantic looping scribble inside an ellipse
  function scrib(cx, cy, rx, ry, n, w, id, col) {
    ig.beginPath();
    let a = ih(id, 1, B) * TAU, px = cx, py = cy;
    for (let k = 0; k < n; k++) {
      a += 1.1 + ih(id, k + 7, B) * 1.6;
      const r = 0.25 + 0.75 * Math.sqrt(ih(id, k + 300, B));
      const x = cx + Math.cos(a) * rx * r, y = cy + Math.sin(a) * ry * r;
      if (!k) ig.moveTo(x, y); else ig.quadraticCurveTo(px + (x - px) * 0.5 + J(id, k + 900, rx * 0.25), py + (y - py) * 0.5 + J(id, k + 950, ry * 0.25), x, y);
      px = x; py = y;
    }
    ig.lineWidth = w; ig.strokeStyle = col; ig.stroke();
  }
  function hatchRect(x0, y0, x1, y1, ang, gap, len, w, col, id) {
    ig.beginPath();
    const ca = Math.cos(ang), sa = Math.sin(ang);
    let k = 0;
    for (let y = y0; y < y1; y += gap) for (let x = x0 + ((fl(y / gap) & 1) * gap * 0.5); x < x1; x += len * 1.3) {
      const jx = J(id, k, gap * 0.4), jy = J(id, k + 5000, gap * 0.4), l = len * (0.6 + 0.6 * ih(id, k + 9000, B)); k++;
      ig.moveTo(x + jx, y + jy); ig.lineTo(x + jx + ca * l, y + jy + sa * l);
    }
    ig.lineWidth = w; ig.strokeStyle = col; ig.stroke();
  }
  function splat(x, y, r, n, id, col) {
    ig.fillStyle = col;
    for (let k = 0; k < n; k++) {
      const a = ih(id, k, 3) * TAU, d = r * Math.pow(ih(id, k, 4), 0.6), s = 1.2 + 5 * Math.pow(ih(id, k, 5), 3) * (1 - d / r * 0.6);
      ig.beginPath(); ig.ellipse(x + Math.cos(a) * d + J(id, k, 1), y + Math.sin(a) * d + J(id, k + 99, 1), s, s * (0.7 + 0.3 * ih(id, k, 6)), a, 0, TAU); ig.fill();
    }
  }
  function smear(x, y, r, col0, col1) {
    const g = ig.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, col0); g.addColorStop(1, col1);
    ig.fillStyle = g; ig.beginPath(); ig.arc(x, y, r, 0, TAU); ig.fill();
  }
  function eye(x, y, s, open, id, look) {
    open = clamp(open, 0, 1);
    x += J(id, 1, s * 0.06); y += J(id, 2, s * 0.06);
    if (open < 0.08) { pline([[x - s, y], [x, y + s * 0.12], [x + s, y]], Math.max(1.5, s * 0.16), INKC(0.9), id, s * 0.05); return; }
    smear(x, y, s * 2.4, ACID(0.16 * open), ACID(0));
    ig.beginPath(); ig.moveTo(x - s, y);
    ig.quadraticCurveTo(x, y - s * 1.05 * open, x + s, y); ig.quadraticCurveTo(x, y + s * 0.8 * open, x - s, y); ig.closePath();
    ig.fillStyle = ACID(0.92); ig.fill();
    ig.save(); ig.clip();
    ig.fillStyle = INKC(0.95); ig.beginPath(); ig.ellipse(x + (look || 0) * s * 0.35, y, s * 0.16, s * 0.6 * open, 0, 0, TAU); ig.fill();
    ig.fillStyle = 'rgba(250,250,230,0.9)'; ig.beginPath(); ig.arc(x + (look || 0) * s * 0.35 - s * 0.32, y - s * 0.25 * open, Math.max(1, s * 0.1), 0, TAU); ig.fill();
    ig.restore();
    ig.lineWidth = Math.max(1.5, s * 0.17); ig.strokeStyle = INKC(0.95);
    ig.beginPath(); ig.moveTo(x - s * 1.15, y + J(id, 5, 1)); ig.quadraticCurveTo(x, y - s * 1.15 * open + J(id, 6, 2), x + s * 1.15, y + J(id, 7, 1)); ig.stroke();
    ig.lineWidth = Math.max(1, s * 0.08);
    ig.beginPath(); ig.moveTo(x - s, y); ig.quadraticCurveTo(x, y + s * 0.85 * open, x + s, y); ig.stroke();
  }
  function teeth(pts, n, h, side, id, a) {
    const sp = crs(pts, 6), m = sp.length;
    ig.lineWidth = 2.2; ig.strokeStyle = INKC(0.95); ig.fillStyle = BONE(0.88 * (a === undefined ? 1 : a));
    for (let k = 0; k < n; k++) {
      const u0 = k / n, u1 = (k + 1) / n, i0 = fl(u0 * (m - 1)), i1 = fl(u1 * (m - 1)), im = fl((u0 + u1) * 0.5 * (m - 1));
      const p0 = sp[i0], p1 = sp[i1], pm = sp[im];
      const dx = p1[0] - p0[0], dy = p1[1] - p0[1], l = Math.hypot(dx, dy) || 1;
      const hh = h * (0.55 + 0.7 * ih(id, k, 3)) * (0.6 + 0.4 * Math.sin(u0 * Math.PI));
      const tip = [pm[0] - dy / l * hh * side + J(id, k, 2), pm[1] + dx / l * hh * side + J(id, k + 50, 2)];
      ig.beginPath(); ig.moveTo(p0[0], p0[1]); ig.lineTo(tip[0], tip[1]); ig.lineTo(p1[0], p1[1]); ig.closePath(); ig.fill(); ig.stroke();
    }
  }
  function claw(x, y, a, len, curl, w, id, col) {
    const pts = [[x, y]];
    let cx = x, cy = y, ang = a;
    for (let k = 1; k <= 6; k++) { ang += curl * (k > 4 ? 2.2 : 0.6) / 6; cx += Math.cos(ang) * len / 6; cy += Math.sin(ang) * len / 6; pts.push([cx, cy]); }
    brush(pts, w, 0.6, id, { col: col || INKC(0.95), rough: 0.3, j: 1.5 });
    return [cx, cy];
  }
  function hand(x, y, a, len, spread, curl, w, id) {   // an arm-end of claws
    for (let k = 0; k < 4; k++) claw(x, y, a + (k - 1.5) * spread, len * (0.8 + 0.3 * ih(id, k, 2)), curl * (k & 1 ? 1 : 0.8), w, id * 7 + k);
  }
  // ink crawling in from the frame edges. depth in screen px; spikes put out tendrils
  function edgeInk(depth, id, o) {
    o = o || {};
    if (depth < 2) return;
    const N = 46, pts = [], tend = [];
    const side = (s) => { // s in 0..4 around the frame
      const k = fl(s), u = s - k;
      if (k === 0) return [[u * OW, 0], [0, 1]];
      if (k === 1) return [[OW, u * OH], [-1, 0]];
      if (k === 2) return [[OW - u * OW, OH], [0, -1]];
      return [[0, OH - u * OH], [1, 0]];
    };
    for (let i = 0; i < N * 4; i++) {
      const s = i / N, [p, nv] = side(s);
      const g = vn1(s * 9.3 + id * 7.1, id) * 0.75 + vn1(s * 31 + id, id + 1) * 0.35;
      let d = depth * (0.35 + 1.05 * g) * (o.pulse || 1);
      if (Math.abs(fr(s) - 0) < 0.05 || Math.abs(fr(s) - 1) < 0.05) d *= 1.25;
      const q = [p[0] + nv[0] * d + J(id, i, 3), p[1] + nv[1] * d + J(id, i + 999, 3)];
      pts.push(q);
      if (ih(i, id, 77) > 0.86) tend.push([q, Math.atan2(nv[1], nv[0]) + (ih(i, id, 78) - 0.5) * 1.2, depth * (0.3 + 0.6 * ih(i, id, 79)), i]);
    }
    const ring = (f, alpha) => {
      ig.beginPath(); ig.rect(-40, -40, OW + 80, OH + 80);
      const q = pts.map((p, i) => { const [b] = side(i / N); return [lerp(b[0], p[0], f), lerp(b[1], p[1], f)]; });
      ig.moveTo(q[0][0], q[0][1]); for (let i = q.length - 1; i >= 0; i--) ig.lineTo(q[i][0], q[i][1]); ig.closePath();
      ig.fillStyle = INKC(alpha); ig.fill('evenodd');
      return q;
    };
    ring(1.3, 0.1 * (o.alpha || 1)); ring(1.08, 0.22 * (o.alpha || 1));
    const core = ring(0.72, 0.95 * (o.alpha || 1));
    // a ragged brushed rim and charcoal tendrils
    for (let i = 0; i < core.length; i += 6) brush(core.slice(i, i + 8), 9, 5, id * 31 + i, { dry: true, rough: 0.7 });
    for (const [q, a, l, i] of tend) claw(q[0], q[1], a, l, (ih(i, 3, 1) - 0.5) * 2.4, 9, id * 13 + i);
    if (o.ember) {
      ig.save(); ig.globalCompositeOperation = 'source-atop';
      ig.lineWidth = 16; ig.strokeStyle = EMBER(0.5 * o.ember); ig.beginPath(); core.forEach((p, k) => (k ? ig.lineTo(p[0], p[1]) : ig.moveTo(p[0], p[1]))); ig.closePath(); ig.stroke();
      ig.lineWidth = 5; ig.strokeStyle = `rgba(255,214,140,${0.7 * o.ember})`; ig.stroke();
      ig.restore();
    }
    return core;
  }
  // a branch shadow traced in ink, with claws growing from its tips
  function inkBranches(t, k) {
    if (k <= 0) return;
    BR.forEach((b, bi) => {
      const pts = b.pts.map((p) => S(p[0], p[1]));
      const grow = clamp(k * 3 - b.d * 0.6, 0, 1);
      if (grow <= 0) return;
      const n = Math.max(2, Math.round(pts.length * grow));
      brush(pts.slice(0, n), b.w * K * 1.3, b.w * K * 0.7, 100 + bi, { dry: true });
      if (b.d >= 1 && grow >= 1) {
        const tip = pts[pts.length - 1], prev = pts[pts.length - 2], a = Math.atan2(tip[1] - prev[1], tip[0] - prev[0]);
        const cl = clamp(k * 2 - 1, 0, 1), flex = Math.sin(t * 2.3 + bi) * 0.5;
        hand(tip[0], tip[1], a + flex * 0.3, 40 + 70 * cl, 0.32, 1.3 + flex, 6, 300 + bi);
      }
    });
  }
  // ring of eyes in the dark: [x, y (world), t0, size(px), id]
  const EYES = [];
  (function () {
    const spots = [[40, 300, 3.0], [205, 302, 3.3], [300, 40, 3.8], [120, 40, 4.4], [60, 420, 4.0], [250, 430, 4.8], [420, 40, 6.5], [520, 30, 7.5], [700, 40, 8.2],
      [380, 400, 8.8], [460, 430, 9.5], [600, 410, 10.1], [880, 60, 11.0], [690, 430, 11.6], [820, 520, 12.4], [900, 380, 13.2], [760, 560, 13.6], [940, 300, 14.2], [700, 250, 14.8]];
    spots.forEach((s, i) => EYES.push({ x: s[0], y: s[1], t0: s[2], s: 7 + 6 * ih(i, 1, 4), id: 600 + i }));
  })();
  function inkEyes(t, kill) {
    for (const e of EYES) {
      if (t < e.t0) continue;
      const age = t - e.t0;
      let open = s5(age / 0.5);
      const bl = fr((t + e.id * 0.37) / 3.1); if (bl < 0.05) open *= Math.abs(bl - 0.025) / 0.025;
      open *= 1 - kill;
      if (open <= 0.01) continue;
      const [x, y] = S(e.x, e.y);
      if (x < -60 || y < -60 || x > OW + 60 || y > OH + 60) continue;
      const s = e.s * K * 0.55;
      eye(x - s * 1.4, y, s, open, e.id, Math.sin(t + e.id));
      eye(x + s * 1.4, y, s, open, e.id + 1, Math.sin(t + e.id));
    }
  }
  // the wardrobe: its gap yawns into a mouth with eyes, and the sleeve reaches out
  function inkWardrobe(t, k, kill) {
    if (k <= 0) return;
    const gx = (WARD.gap0 + WARD.gap1) / 2, y0 = WARD.y0 + 8, y1 = Y1 - 26;
    const op = k * (1 - kill) * (1 + 0.08 * heartAt(t));
    const wpx = (5 + 34 * op), top = S(gx, y0 - 4 * op), bot = S(gx, y1 + 6 * op);
    const L = [], R = [];
    for (let i = 0; i <= 10; i++) {
      const u = i / 10, yy = lerp(top[1], bot[1], u), bulge = Math.sin(u * Math.PI) * (0.4 + 0.6 * Math.sin(u * Math.PI)) * wpx * K;
      L.push([top[0] - bulge + J(500, i, 3), yy]); R.push([top[0] + bulge + J(501, i, 3), yy]);
    }
    ig.beginPath(); L.forEach((p, i) => (i ? ig.lineTo(p[0], p[1]) : ig.moveTo(p[0], p[1]))); for (let i = R.length - 1; i >= 0; i--) ig.lineTo(R[i][0], R[i][1]); ig.closePath();
    ig.fillStyle = INKC(0.97); ig.fill();
    smear(top[0], (top[1] + bot[1]) / 2, wpx * K * 1.4, BRUISE(0.32 * op), BRUISE(0));
    brush(L, 8, 8, 510, { dry: true }); brush(R, 8, 8, 511, { dry: true });
    if (op > 0.25) { teeth(L, 9, 22 * op, -1, 520, op); teeth(R, 9, 22 * op, 1, 521, op); }
    // eyes inside the dark
    if (op > 0.4) {
      const n = 2 + fl(op * 5);
      for (let e = 0; e < n; e++) {
        const u = 0.18 + 0.64 * ih(e, 1, 530), ex = top[0] + (ih(e, 2, 530) - 0.5) * wpx * K * 0.7, ey = lerp(top[1], bot[1], u);
        const bl = fr(t * 0.5 + e * 0.29); eye(ex, ey, (e === 0 ? 16 : 7 + 4 * ih(e, 3, 530)) * op, s5((op - 0.4) * 3) * (bl < 0.06 ? 0.1 : 1), 540 + e, 0.6);
      }
    }
    // the sleeve becomes an arm
    const ar = clamp((t - (T.wardrobe + 1.0)) / 1.6, 0, 1) * (1 - kill);
    if (ar > 0) {
      const a0 = S(WARD.gap0 + 3, WARD.y0 + 40), reachTo = S(lerp(WARD.gap0, 150, ar), lerp(WARD.y0 + 70, 210, ar));
      const mid = [(a0[0] + reachTo[0]) / 2 + 30, (a0[1] + reachTo[1]) / 2 + 60 * ar];
      brush([a0, mid, reachTo], 22, 10, 560, { dry: true });
      hand(reachTo[0], reachTo[1], Math.PI + 0.25, 30 + 30 * ar, 0.35, -1.2 + 0.3 * Math.sin(t * 3), 5, 561);
    }
  }
  // ink rising from downstairs: the noise came from there
  function inkBelow(t, k, yTop) {
    if (k <= 0) return;
    const lvl = lerp(OH + 80, yTop, k), pts = [];
    for (let i = 0; i <= 24; i++) {
      const x = -40 + i * (OW + 80) / 24, h = lvl - (30 + 110 * vn1(i * 0.6 + t * 0.2, 3)) * Math.min(1, k * 2);
      pts.push([x + J(700, i, 4), h + J(701, i, 4)]);
    }
    const fillTo = (off, a) => { ig.beginPath(); ig.moveTo(-40, OH + 40); pts.forEach((p) => ig.lineTo(p[0], p[1] + off)); ig.lineTo(OW + 40, OH + 40); ig.closePath(); ig.fillStyle = INKC(a); ig.fill(); };
    fillTo(-24, 0.14); fillTo(0, 0.4); fillTo(50, 0.78);
    brush(pts, 12, 12, 702, { dry: true, rough: 0.7 });
    for (let i = 1; i < 24; i += 2) claw(pts[i][0], pts[i][1], -Math.PI / 2 + (ih(i, 1, 703) - 0.5) * 1.2, (40 + 120 * ih(i, 2, 703)) * Math.min(1, k * 1.5), (ih(i, 3, 703) - 0.5) * 3.4 + 0.4 * Math.sin(t * 1.3 + i), 10, 710 + i);
    // something huge reaching up out of the dark downstairs: a scribbled arm drawn in pale chalk over the black
    const ra = clamp((k - 0.4) / 0.6, 0, 1);
    if (ra > 0) {
      const bx = OW * 0.62 + 120 * Math.sin(t * 0.4), base = [bx, OH + 40], tip = [bx - 160 - 60 * Math.sin(t * 0.7), lvl - 40 - 140 * ra];
      const mid = [(base[0] + tip[0]) / 2 + 80, (base[1] + tip[1]) / 2];
      brush([base, mid, tip], 90 * ra, 26 * ra, 745, { col: INKC(0.97), dry: true });
      pline([[base[0] + 46, base[1]], [mid[0] + 40, mid[1]], [tip[0] + 14, tip[1]]], 2.5, BONE(0.55 * ra), 746, 4);
      pline([[base[0] - 46, base[1]], [mid[0] - 44, mid[1]], [tip[0] - 14, tip[1]]], 2.5, BONE(0.45 * ra), 747, 4);
      for (let f = 0; f < 5; f++) { const e = claw(tip[0], tip[1], -Math.PI / 2 - 0.9 + f * 0.42, 70 * ra + 20, 1.1 + 0.3 * Math.sin(t * 2 + f), 12 * ra + 2, 750 + f); pline([tip, e], 1.5, BONE(0.4 * ra), 760 + f, 3); }
    }
    // a few long charcoal hatches over it, pale
    for (let i = 0; i < 9; i++) { const x = (i + 0.5) * OW / 9 + J(740, i, 20), y = lvl + 90 + 60 * ih(i, 2, 741); brush([[x - 60, y + 50], [x, y], [x + 70, y - 46]], 3, 1, 742 + i, { col: BONE(0.16), j: 3 }); }
  }
  // the endless landing: a tunnel of door frames opens ahead of her and keeps coming
  function inkTunnel(t, k, herX) {
    if (k <= 0) return;
    const vp = S(Math.min(herX + 150, 640), 222), base = 210 * K;
    const z = fr(t * 0.55);
    ig.save();
    for (let i = 7; i >= 0; i--) {
      const sc = Math.pow(0.62, i - z) * k;
      if (sc < 0.04) continue;
      const w = base * 0.55 * sc, h = base * sc, x0 = vp[0] - w / 2, y0 = vp[1] - h * 0.55, a = Math.min(1, sc * 2.4) * k;
      const pts = [[x0, y0 + h], [x0, y0 + w * 0.3], [vp[0], y0 - w * 0.1], [x0 + w, y0 + w * 0.3], [x0 + w, y0 + h]];
      ig.globalAlpha = a;
      if (i === 7 || sc < 0.12) { ig.fillStyle = INKC(1); ig.beginPath(); ig.moveTo(pts[0][0], pts[0][1]); pts.forEach((p) => ig.lineTo(p[0], p[1])); ig.fill(); }
      brush(pts, Math.max(3, 16 * sc), Math.max(3, 16 * sc), 800 + i * 3, { dry: true, j: 3 });
      if (i % 2 === 1 && sc > 0.18) teeth([pts[1], pts[2], pts[3]], 7, 30 * sc, 1, 820 + i, 1);
      // floor lines converging
      pline([[x0, y0 + h], [vp[0] - w * 0.08, vp[1] + base * 0.1]], 2, GREYC(0.7), 840 + i);
      pline([[x0 + w, y0 + h], [vp[0] + w * 0.08, vp[1] + base * 0.1]], 2, GREYC(0.7), 850 + i);
    }
    ig.globalAlpha = 1;
    // the dark at the end, and something looking back out of it
    smear(vp[0], vp[1], 60 * k, INKC(0.95), INKC(0));
    eye(vp[0] - 10, vp[1] - 6, 5 * k, 1, 860, 0); eye(vp[0] + 10, vp[1] - 6, 5 * k, 1, 861, 0);
    ig.restore();
  }
  // the coats wake: outlines over the pixel coats, collar mouths, button eyes, sleeves that reach for her
  function inkCoats(t, k, herX) {
    if (k <= 0) return;
    COATS.forEach((c, ci) => {
      const kk = clamp(k * 1.6 - ci * 0.25, 0, 1);
      if (kk <= 0) return;
      const sw = Math.sin(t * 1.7 + ci) * 0.05;
      const top = S(c.x, c.y), bot = S(c.x, c.y + c.h + 10 * kk);
      const w = (c.w + 10 * kk) * K * 0.5;
      const sh = 26 * kk * K;    // the shoulders rise
      const body = [[top[0], top[1] - sh * 0.3], [top[0] + w, top[1] + 50 - sh * 0.4], [top[0] + w * 1.1, bot[1]], [top[0] - w * 1.1, bot[1]], [top[0] - w, top[1] + 50 - sh * 0.4]];
      ig.globalAlpha = 0.85 * kk;
      ig.beginPath(); body.forEach((p, i) => (i ? ig.lineTo(p[0], p[1]) : ig.moveTo(p[0], p[1]))); ig.closePath(); ig.fillStyle = INKC(0.75); ig.fill();
      ig.globalAlpha = 1;
      brush(body.concat([body[0]]), 7 * kk + 2, 7 * kk + 2, 900 + ci, { dry: true, j: 3.5 });
      hatchRect(top[0] - w, top[1] + 40, top[0] + w, bot[1], 1.1 + sw, 8, 22, 1.4, BONE(0.25 * kk), 910 + ci);
      // collar mouth
      const my = top[1] + 40;
      if (kk > 0.3) {
        const mw = w * 0.55 * kk;
        ig.fillStyle = INKC(1); ig.beginPath(); ig.ellipse(top[0], my + 20, mw, 24 * kk, 0, 0, TAU); ig.fill();
        teeth([[top[0] - mw, my + 10], [top[0], my + 2], [top[0] + mw, my + 10]], 6, 14 * kk, 1, 920 + ci, kk);
        teeth([[top[0] - mw, my + 32], [top[0], my + 40], [top[0] + mw, my + 32]], 6, 12 * kk, -1, 930 + ci, kk);
        eye(top[0] - w * 0.35, top[1] + 10, 9 * kk, s5((kk - 0.3) * 2), 940 + ci, -1);
        eye(top[0] + w * 0.35, top[1] + 10, 9 * kk, s5((kk - 0.3) * 2), 945 + ci, -1);
      }
      // sleeves stretch toward her
      if (kk > 0.4) {
        const her = S(herX + 20, Y1 - 120);
        const reach = s5((kk - 0.4) / 0.6);
        for (const s of [-1, 1]) {
          const a0 = [top[0] + s * w * 0.9, top[1] + 60];
          const tip = [lerp(a0[0], her[0] + 40 + ci * 30, reach * 0.9), lerp(a0[1] + 60, her[1] + s * 30, reach * 0.8)];
          const mid = [(a0[0] + tip[0]) / 2, Math.max(a0[1], tip[1]) + 50];
          brush([a0, mid, tip], 18 * kk, 8, 950 + ci * 2 + (s > 0), { dry: true });
          hand(tip[0], tip[1], Math.atan2(her[1] - tip[1], her[0] - tip[0]) + 0.1 * Math.sin(t * 4 + s), 26 + 18 * reach, 0.4, 1.0 * s, 4.5, 960 + ci * 2 + (s > 0));
        }
      }
    });
  }
  // her own shadow, thrown on the landing wall, grows horns and teeth
  function inkShadow(t, k, H0) {
    if (k <= 0 || !H0) return;
    const hc = S(H0.head[0] - 26, H0.head[1] + 8);
    const s = (1 + 0.9 * k) * K;
    ig.globalAlpha = 0.8 * k;
    scrib(hc[0], hc[1], 26 * s, 24 * s, 34, 5, 980, INKC(0.85));
    ig.fillStyle = INKC(0.9); ig.beginPath(); ig.ellipse(hc[0], hc[1], 20 * s, 19 * s, 0, 0, TAU); ig.fill();
    ig.globalAlpha = 1;
    // horns from the curls
    for (let i = 0; i < 5; i++) claw(hc[0] - 6 * s + i * 4 * s, hc[1] - 14 * s, -Math.PI / 2 - 0.8 + i * 0.4, (16 + 10 * k) * s, (i - 2) * 0.35, 6, 990 + i);
    // the jaw
    const jw = 18 * s, jy = hc[1] + 6 * s, op = 6 + 10 * k * (0.7 + 0.3 * Math.sin(t * 5));
    ig.fillStyle = RUST(0.55 * k); ig.beginPath(); ig.ellipse(hc[0] + 8 * s, jy + op * 0.5, jw, op * 0.8, 0, 0, TAU); ig.fill();
    teeth([[hc[0] - jw * 0.6, jy], [hc[0] + 8 * s, jy - 4], [hc[0] + jw * 1.5, jy]], 8, 7 * s, 1, 1000, k);
    teeth([[hc[0] - jw * 0.6, jy + op], [hc[0] + 8 * s, jy + op + 4], [hc[0] + jw * 1.5, jy + op]], 8, 6 * s, -1, 1001, k);
    eye(hc[0] + 6 * s, hc[1] - 6 * s, 6 * s * 0.6, 1, 1002, 1);
  }
  // the stairs multiply and twist into a vortex
  function inkStairs(t, k, kill) {
    if (k <= 0) return;
    const c = S(708, 452), spin = t * 0.32;
    for (let i = 8; i >= 0; i--) {
      const sc = Math.pow(0.8, i) * (1.0 + 0.25 * k), a = spin * (0.4 + i * 0.3) + i * 0.5, al = Math.min(1, (1.15 - i / 10) * k) * (1 - kill);
      if (al <= 0.02) continue;
      const ca = Math.cos(a), sa = Math.sin(a), TR = TREAD * K * sc, RS = RISE * K * sc;
      const tr = (x, y) => [c[0] + x * ca - y * sa, c[1] + x * sa + y * ca];
      const saw = [];
      for (let q = -9; q <= 9; q++) { saw.push(tr(q * TR, q * RS)); saw.push(tr((q + 1) * TR, q * RS)); }
      const under = [tr(10 * TR, 10 * RS + 2.2 * RS), tr(-9 * TR, -9 * RS + 2.2 * RS)];
      ig.globalAlpha = al * 0.8;
      ig.beginPath(); saw.forEach((p, n) => (n ? ig.lineTo(p[0], p[1]) : ig.moveTo(p[0], p[1]))); ig.lineTo(under[0][0], under[0][1]); ig.lineTo(under[1][0], under[1][1]); ig.closePath();
      ig.fillStyle = INKC(0.75); ig.fill();
      ig.globalAlpha = al;
      pline(saw, Math.max(2, 7 * sc), INKC(0.95), 1100 + i, 2);
      pline(saw.map((p) => [p[0] + 2, p[1] - 3]), Math.max(1.5, 3.2 * sc), BONE(0.75), 1120 + i, 1.5);
      brush([under[1], under[0]], 10 * sc, 10 * sc, 1140 + i, { dry: true });
    }
    ig.globalAlpha = 1;
    smear(c[0], c[1], 160 * k, INKC(0.85 * k * (1 - kill)), INKC(0));
  }
  // the thing on the stairs: a great scribbled heap with cat ears for horns, a mouthful of teeth, many eyes,
  // coat-sleeve arms reaching up the banister and a tail like a whip
  function beast(cx, cy, s, t, op, id) {
    if (op <= 0 || s <= 0) return;
    ig.globalAlpha = op;
    smear(cx, cy, 330 * s, BRUISE(0.75), BRUISE(0));
    smear(cx - 30 * s, cy + 10 * s, 150 * s, RUST(0.25), RUST(0));
    ig.fillStyle = INKC(0.96); ig.beginPath(); ig.ellipse(cx, cy, 190 * s, 150 * s, -0.4, 0, TAU); ig.fill();
    scrib(cx, cy, 230 * s, 180 * s, 70, 4, id, INKC(0.9));
    scrib(cx + 30 * s, cy - 20 * s, 170 * s, 130 * s, 46, 3, id + 1, BONE(0.6));
    scrib(cx - 60 * s, cy + 40 * s, 120 * s, 80 * s, 30, 2, id + 5, BONE(0.4));
    { const rim = []; for (let k = 0; k <= 26; k++) { const a = k / 26 * TAU; rim.push([cx + Math.cos(a - 0.4) * 196 * s * (1 + 0.1 * Math.sin(a * 5 + t)), cy + Math.sin(a - 0.4) * 156 * s * (1 + 0.1 * Math.cos(a * 4 - t))]); }
      pline(rim, 4, BONE(0.85), id + 2, 5); }
    // horns (ears)
    for (const sd of [-1, 1]) {
      const bx = cx + sd * 90 * s - 40 * s, by = cy - 120 * s;
      brush([[bx - sd * 30 * s, by + 30 * s], [bx, by - 60 * s], [bx + sd * 40 * s, by - 150 * s]], 60 * s, 2, id + 3 + sd, { dry: true });
    }
    // arms up the stairs, tail
    for (let a = 0; a < 3; a++) {
      const ang = -2.3 + a * 0.35 + 0.15 * Math.sin(t * 2.2 + a), L = (260 + 60 * a) * s;
      const p0 = [cx - 60 * s, cy - 40 * s + a * 30 * s], p1 = [p0[0] + Math.cos(ang) * L * 0.5, p0[1] + Math.sin(ang) * L * 0.5 + 40 * s], p2 = [p0[0] + Math.cos(ang) * L, p0[1] + Math.sin(ang) * L];
      brush([p0, p1, p2], 44 * s, 12 * s, id + 10 + a, { dry: true });
      hand(p2[0], p2[1], ang, 70 * s, 0.38, 1.3, 9 * s, id + 20 + a);
    }
    const tp = [[cx + 150 * s, cy + 40 * s], [cx + 260 * s, cy + 10 * s + 40 * s * Math.sin(t * 3)], [cx + 330 * s, cy - 90 * s + 60 * s * Math.sin(t * 3 + 1)], [cx + 300 * s, cy - 180 * s]];
    brush(tp, 30 * s, 2, id + 30, { dry: true });
    // the mouth
    const mx = cx - 30 * s, my = cy + 10 * s, mw = 110 * s, mo = (30 + 18 * Math.sin(t * 2.6)) * s;
    ig.fillStyle = RUST(0.6); ig.beginPath(); ig.ellipse(mx, my, mw, mo, -0.2, 0, TAU); ig.fill();
    ig.fillStyle = INKC(0.9); ig.beginPath(); ig.ellipse(mx, my + mo * 0.15, mw * 0.85, mo * 0.7, -0.2, 0, TAU); ig.fill();
    teeth([[mx - mw, my + 18 * s], [mx, my - mo + 4 * s], [mx + mw, my - 22 * s]], 12, 34 * s, 1, id + 40, 1);
    teeth([[mx - mw, my + 22 * s], [mx, my + mo], [mx + mw, my - 18 * s]], 11, 28 * s, -1, id + 41, 1);
    // eyes, a lot of them
    for (let e = 0; e < 11; e++) {
      const ea = -2.6 + e * 0.38, er = (100 + 40 * ih(e, 1, id)) * s;
      const ex = cx + 20 * s + Math.cos(ea) * er, ey = cy - 30 * s + Math.sin(ea) * er * 0.6 - 30 * s;
      const bl = fr(t * 0.4 + e * 0.17);
      eye(ex, ey, (8 + 10 * ih(e, 2, id)) * s * 1.6, bl < 0.04 ? 0.1 : 1, id + 50 + e, Math.sin(t * 1.3 + e));
    }
    ig.globalAlpha = 1;
  }
  // the heartbeat: a scribbled ripple off her chest on each beat
  function inkHeart(t, at) {
    for (const b of BEATS) {
      const d = t - b; if (d < 0 || d > 0.9) continue;
      const r = 40 + d * 520, a = 0.4 * (1 - d / 0.9);
      ig.globalAlpha = a; ig.lineWidth = 3; ig.strokeStyle = INKC(1);
      ig.beginPath();
      for (let k = 0; k <= 40; k++) { const an = k / 40 * TAU, rr = r * (1 + 0.06 * Math.sin(an * 7 + b * 10)) + J(1200, k, 4); const x = at[0] + Math.cos(an) * rr, y = at[1] + Math.sin(an) * rr; k ? ig.lineTo(x, y) : ig.moveTo(x, y); }
      ig.stroke();
    }
    ig.globalAlpha = 1;
  }
  // the beam burns the ink away: embers on the cut edges, then a clean cone
  function burnBeam(o, a, half, L, k) {
    if (k <= 0) return;
    const cone = (h, Lr, jj, id) => {
      ig.beginPath(); ig.moveTo(o[0], o[1]);
      const n = 14;
      for (let i = 0; i <= n; i++) { const an = a - h + (2 * h) * i / n, r = Lr * (0.92 + 0.1 * ih(id, i, B)); ig.lineTo(o[0] + Math.cos(an) * r + J(id, i, jj), o[1] + Math.sin(an) * r + J(id, i + 50, jj)); }
      ig.closePath();
    };
    ig.save();
    ig.globalCompositeOperation = 'source-atop';
    for (const sd of [-1, 1]) {
      const an = a + sd * half * 0.92, pts = [];
      for (let i = 0; i <= 12; i++) { const r = 20 + (L - 20) * i / 12; pts.push([o[0] + Math.cos(an) * r + J(1300 + sd, i, 7), o[1] + Math.sin(an) * r + J(1310 + sd, i, 7)]); }
      ig.lineCap = 'round'; ig.lineWidth = 40; ig.strokeStyle = EMBER(0.42 * k); ig.beginPath(); pts.forEach((p, i) => (i ? ig.lineTo(p[0], p[1]) : ig.moveTo(p[0], p[1]))); ig.stroke();
      ig.lineWidth = 12; ig.strokeStyle = `rgba(255,220,150,${0.55 * k})`; ig.stroke();
    }
    ig.globalCompositeOperation = 'destination-out';
    ig.fillStyle = `rgba(0,0,0,${k})`; cone(half * 0.92, L, 8, 1320); ig.fill();
    ig.fillStyle = `rgba(0,0,0,${0.5 * k})`; cone(half * 1.12, L * 1.06, 12, 1321); ig.fill();
    ig.restore();
  }
  function grain() {
    if (!GPAT) { GPAT = ig.createPattern(GRAIN, 'repeat'); CPAT = ig.createPattern(CHAR, 'repeat'); }
    ig.save(); ig.globalCompositeOperation = 'source-atop'; ig.globalAlpha = 1;
    ig.translate(fl(ih(fl(B / 3), 3, 1400) * 40), fl(ih(fl(B / 3), 4, 1400) * 40)); ig.fillStyle = CPAT; ig.fillRect(-512, -512, OW + 1024, OH + 1024);
    ig.restore();
    ig.save(); ig.globalCompositeOperation = 'destination-out'; ig.globalAlpha = 0.35;
    ig.translate(fl(ih(B, 1, 1400) * 256), fl(ih(B, 2, 1400) * 256)); ig.fillStyle = GPAT; ig.fillRect(-256, -256, OW + 512, OH + 512);
    ig.restore();
  }
  // keep her readable: the ink thins over her silhouette (she is real; the fear is around her)
  let PROT = null, PG = null, PIMG = null;
  function protect(sel, a) {
    if (!PROT) { PROT = document.createElement('canvas'); PROT.width = AW; PROT.height = AH; PG = PROT.getContext('2d'); PIMG = PG.createImageData(AW, AH); }
    const d = PIMG.data; d.fill(0);
    let any = false;
    for (let i = 0; i < NA; i++) { const p = SP.p[i]; if (p && p !== 255 && sel(p)) { const x = i % AW, y = (i / AW) | 0; any = true; for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < AW && yy < AH) d[(yy * AW + xx) * 4 + 3] = 255; } } }
    if (!any) return;
    PG.putImageData(PIMG, 0, 0);
    ig.save(); ig.globalCompositeOperation = 'destination-out'; ig.globalAlpha = a; ig.imageSmoothingEnabled = true;
    ig.drawImage(PROT, -M * K - CAMF[0] * K + SHAKE[0], -M * K - CAMF[1] * K + SHAKE[1], AW * K, AH * K);
    ig.restore();
  }
  // ash: little burnt flakes lifting off as the ink goes
  function ash(t, t0, t1, n, id) {
    const u = ph(t, t0, t1); if (u <= 0 || u >= 1) return;
    for (let i = 0; i < n; i++) {
      const st = ih(i, 1, id) * 0.6, v = clamp((u - st) / 0.4, 0, 1); if (v <= 0 || v >= 1) continue;
      const e = ih(i, 2, id) * 4, side = fl(e), w = fr(e);
      let x = side === 0 ? w * OW : side === 1 ? OW - 30 : side === 2 ? w * OW : 30, y = side === 0 ? 30 : side === 1 ? w * OH : side === 2 ? OH - 30 : w * OH;
      x += Math.sin(v * 6 + i) * 30 + (OW / 2 - x) * v * 0.25; y -= v * (120 + 100 * ih(i, 3, id));
      const s = 4 + 8 * ih(i, 4, id), r = v * 9 + i;
      ig.save(); ig.translate(x, y); ig.rotate(r); ig.globalAlpha = 1 - v;
      ig.fillStyle = INKC(0.9); ig.fillRect(-s, -s * 0.5, 2 * s, s);
      ig.fillStyle = EMBER(0.8); ig.fillRect(-s, s * 0.3, 2 * s, s * 0.25);
      ig.restore();
    }
  }

  /* ================================================================ frames */
  let HOUSE = null, BEDCU = null, CATCU = null, FACECU = null, INFO = {};
  function setCam(cx, cy) { OX = fl(cx) - M; OY = fl(cy) - M; CAMF = [cx - fl(cx), cy - fl(cy)]; ICAM = [cx, cy]; }
  function clearSprites() { SP.p.fill(0); SHD.fill(0); HER = null; target(SP); }
  function shadowFromParts(dx, dy, sel, sc, cx, cy) {
    sc = sc || 1; cx = cx || 0; cy = cy || 0;
    for (let y = 0; y < AH; y++) for (let x = 0; x < AW; x++) {
      const sx = Math.round(cx + (x - cx - dx) / sc), sy = Math.round(cy + (y - cy - dy) / sc);
      if (sx < 0 || sy < 0 || sx >= AW || sy >= AH) continue;
      const p = SP.p[sy * AW + sx];
      if (p && p !== 255 && sel(p)) SHD[y * AW + x] = 1;
    }
  }
  function houseFrame(t) {
    const [cx, cy] = camHouse(t); SHAKE = [0, 0];
    setCam(cx, cy); clearSprites();
    if (t < T.grab) { PART = 5; cap(X(30), Y(265), X(48), Y(265), 3.2, 3.2, TORCHC); cap(X(49), Y(265), X(53), Y(265), 4.6, 4.6, TORCHD); }
    if (t >= T.stand) { PART = 6; quiltOn(0, 1); }
    let cat = null;
    if (t < T.lift) {
      const found = t > T.found - 0.35 && t < T.cut3 + 0.5;
      cat = { f: -1, blink: (fr(t / 3.7) < 0.05 && !found) ? 1 : 0, shine: found && t < T.cut2 + 0.1, tail: t * 2 };
      drawPanCat(PAN_X, Y0, cat);
    }
    const P = herHouse(t);
    person(P);
    finishSprites(1, 1);
    faceDetails(); panCatDetails(cat); if (P.pan) panCatDetails(P.pan);
    const inBed = HER.hip[0] < XP;
    shadowFromParts(inBed ? 20 : -26, inBed ? 10 : 8, (p) => p >= 10 && p < 70);
    let beam = null;
    if (HER.beam && P.torch && P.torch.on > 0) {
      const k = P.torch.on * (t < T.cut3 ? s5(ph(t, T.on, T.on + 0.35)) : 1);
      if (k > 0) beam = [HER.beam[0], HER.beam[1], HER.beam[2], k];
    }
    const wa = t >= T.cut3 ? s5(ph(t, T.light, T.light + 1.1)) : 0;
    compose(HOUSE, { wa, beam, fear: fearAt(t), beamHalf: 0.34, beamLen: 250 });
    INFO = { shot: 'house', beam, her: HER, P };
  }
  function faceParams(t) {
    if (t < T.cut1) {
      const sn = ph(t, 0.1, 0.19);
      let look = [0, 0];
      if (t > 0.6) look = [lerp(0, 0.9, s5(ph(t, 0.6, 0.85))), lerp(0, 0.75, s5(ph(t, 0.6, 0.85)))];
      if (t > T.creak1) look = [lerp(0.9, -0.15, s5(ph(t, T.creak1, T.creak1 + 0.08))), lerp(0.75, 1.0, s5(ph(t, T.creak1, T.creak1 + 0.08)))];
      if (t > 2.0) look = [lerp(-0.15, 0.6, s5(ph(t, 2.0, 2.1))), 1.0];
      return { open: t < 0.1 ? 0 : 1.3 * back(sn, 1.2) - 0.15 * s5(ph(t, 0.3, 0.6)), look, brow: s5(ph(t, 0.12, 0.3)), mouth: t < 0.4 ? 'line' : 'o',
        quilt: lerp(236, 190, back(ph(t, T.creak1 + 0.05, T.creak1 + 0.32), 1.0)), hands: s5(ph(t, T.creak1 + 0.02, T.creak1 + 0.25)),
        jolt: -5 * Math.exp(-t / 0.1) * Math.sin(t * 40) * (t > 0 ? 1 : 0), fright: 0.7 * s5(ph(t, 0.1, 0.25)) };
    }
    const u = t - T.cut4;
    let open = 0.55;
    if (u > 0.5) open = 0.55 * (1 - s5(ph(u, 0.5, 0.65)));
    if (u > 0.8) open = 0.35 * s5(ph(u, 0.8, 0.95)) * (1 - s5(ph(u, 1.25, 1.5)));
    const breath = 1.6 * Math.sin((t - T.cut4) * 2.6) * (1 - s5(ph(t, 36.8, 37.8)));
    return { open, look: [0.1, 0.2], brow: 0, mouth: t < 37.4 ? 'smile' : 'line', quilt: 236 + breath, hands: 0, jolt: 0, fright: 0 };
  }
  function bedFrame(t) {
    const end = t >= T.cut4, e = t > 0 && t < 1 ? Math.exp(-t / 0.13) : 0;
    SHAKE = end ? [0, 0] : [Math.round(Math.sin(t * TAU * 11) * 12 * e), Math.round(Math.sin(t * TAU * 14 + 1) * 8 * e)];
    let cx, cy;
    if (!end) { cx = 6 + 2 * s5(ph(t, 0, T.cut1)); cy = 12 - 8 * s5(ph(t, 1.2, T.cut1)); }
    else { const u = s5(ph(t, T.cut4, D)); cx = lerp(9, 6, u); cy = lerp(4, 12, u); }
    setCam(cx, cy); clearSprites();
    const q = faceParams(t);
    faceTop(q);
    let cq = null;
    if (end && t < T.catGone) {
      const go = s5(ph(t, T.catGo, T.catGone));
      cq = { breath: t * 4.2, lift: s5(ph(t, T.catUp, T.catUp + 0.3)), open: t > T.catUp + 0.1 ? 1 : 0, sx: 1 + 0.35 * Math.sin(go * Math.PI) };
      catCurled(206 + 330 * go, 322 + 170 * go, cq);
    }
    finishSprites(1, 1);
    faceTopDetails(q); if (cq) catCurledDetails(cq);
    compose(BEDCU, { fear: fearAt(t) });
    INFO = { shot: 'bed', q };
  }
  function faceFrame(t) {
    const u = ph(t, T.cutF, T.cutF2);
    SHAKE = [0, 0];
    setCam(6, 6 + 10 * s5(u)); clearSprites();
    const res = s5(ph(t, T.resolve, T.resolve + 0.12));
    const dart = t < T.gulp ? (fr((t - T.cutF) / 0.32) < 0.5 ? -0.8 : 0.8) : 0;
    const q = { open: lerp(1.25, 0.55, res), look: [dart * (1 - res), 0.1], brow: lerp(1, -1, res), mouth: t < T.gulp ? 'o' : t < T.resolve ? 'line' : 'grit',
      quilt: 1e4, hands: 0, jolt: t > T.gulp && t < T.gulp + 0.15 ? 2 : 0, fright: 0.35 * (1 - res), body: true };
    faceTop(q);
    // torch clutched at her chest, and the slipper coming up like a sword
    PART = PART_IDS.itemB; cap(X(120), Y(480), X(150), Y(372), 15, 15, TORCHC); cap(X(150), Y(372), X(158), Y(344), 21, 22, TORCHD); cap(X(160), Y(340), X(161), Y(338), 16, 16, hx('b6c4da'));
    PART = PART_IDS.handB; ell(X(124), Y(420), 18, 14, SKIN); ell(X(118), Y(446), 17, 13, SKIN);
    const sl = s5(ph(t, T.resolve + 0.05, T.cutF2 - 0.05));
    if (sl > 0) {
      const sx = 320 - 30 * sl, sy = 520 - 300 * sl, a = -1.25 + 0.2 * sl;
      PART = PART_IDS.itemF; rell(X(sx), Y(sy), 78, 34, a, SLIPC); rell(X(sx + Math.cos(a) * 52), Y(sy + Math.sin(a) * 52), 30, 26, a, (xx, yy) => (ih((xx + OX) >> 1, (yy + OY) >> 1, 4) > 0.5 ? SLIPC : hx('fff0c4')));
      rell(X(sx - Math.cos(a) * 40), Y(sy - Math.sin(a) * 40), 34, 22, a, SLIPD);
      PART = PART_IDS.handF; ell(X(sx - Math.cos(a) * 64 + 8), Y(sy - Math.sin(a) * 64 + 10), 18, 15, SKIN);
    }
    finishSprites(1, 1);
    faceTopDetails(q);
    compose(FACECU, { fear: 0.3 });
    INFO = { shot: 'face', q };
  }
  function catFrame(t) {
    const u = s5(ph(t, T.cut2, T.cut3));
    SHAKE = [0, 0];
    setCam(7, 13); clearSprites(); void u;
    const q = { chin: 1, lid: 0.45, blink: win(t, T.blink, T.blink + 0.55, 0.18, 0.25), mrrp: win(t, T.mrrp, T.mrrp + 0.5, 0.08, 0.3), ear: win(t, T.ear, T.ear + 0.28, 0.06, 0.18), tail: t * 1.7 };
    if (t < T.mrrp - 0.05) q.lid = 0.15;
    catBig(q);
    finishSprites(1, 1);
    catBigDetails(q);
    shadowFromParts(-58, -40, (p) => p >= 71 && p <= 73, 1.18, X(CATC.x), X(CATC.y) - X(0) + Y(0));
    compose(CATCU, { spot: [CATC.x + 10, CATC.y + 70, 170, 200, 1.0], fear: fearAt(t) });
    INFO = { shot: 'cat', q };
  }
  let built = false;
  function build() {
    if (built) return;
    buildLUT(); HOUSE = buildHouse(); BEDCU = buildBedCU(); CATCU = buildCatCU(); FACECU = buildFaceCU();
    built = true;
  }
  function renderPixels(t) {
    t = mod(t, D);
    const sh = shotAt(t);
    if (sh.k === 'house') houseFrame(t); else if (sh.k === 'bed') bedFrame(t); else if (sh.k === 'face') faceFrame(t); else catFrame(t);
    drawText(t);
    quantise();
  }
  const core = { W, H, AW, AH, M, K, D, T, CUTS, BEATS, SHOTS, PAL, OUT, FB, build, renderPixels, fearAt, shotAt, walkX: (t) => keys(WALKX, t), STRIDE, NST,
    get CAMF() { return CAMF; }, get SHAKE() { return SHAKE; } };
  window.__threeamCore = core;
  if (typeof document === 'undefined') return;

  /* ================================================================ the ink, per shot */
  function inkBed(t) {
    if (t >= T.cut4) return;
    // THUD: a jagged burst from below
    if (t < 0.8) {
      const u = t / 0.8, g = s5(Math.min(1, t / 0.1));
      for (let k = 0; k < 13; k++) {
        const x0 = OW * (0.08 + 0.84 * k / 12), a = -Math.PI / 2 + (k - 6) * 0.13 + J(1600, k, 0.05), L = (260 + 260 * ih(k, 1, 1601)) * g;
        const pts = []; for (let s = 0; s <= 5; s++) { const r = L * s / 5; pts.push([x0 + Math.cos(a) * r + (s ? J(1602 + k, s, 14) : 0), OH + 10 + Math.sin(a) * r]); }
        ig.globalAlpha = 1 - u * u; brush(pts, 22 + 16 * ih(k, 2, 1601), 1, 1610 + k, { dry: true, j: 0 });
      }
      ig.globalAlpha = 1 - u; splat(OW / 2, OH - 60, 260 * g, 40, 1620, INKC(0.9)); ig.globalAlpha = 1;
    }
    // what the thud left behind: a few tendrils keep creeping up from the bottom edge
    if (t > 0.25) {
      const g = s5(ph(t, 0.25, 2.4));
      for (let k = 0; k < 6; k++) {
        const x0 = OW * (0.1 + 0.16 * k + 0.04 * ih(k, 1, 1650)), L = (60 + 170 * g) * (0.6 + 0.5 * ih(k, 2, 1650));
        claw(x0, OH + 8, -Math.PI / 2 + (ih(k, 3, 1650) - 0.5) * 0.7 + 0.12 * Math.sin(t * 1.7 + k), L, (ih(k, 4, 1650) - 0.5) * 2.2, 12, 1660 + k);
      }
    }
    // CREAK: a crack crawls across the quilt
    if (t > T.creak1) {
      const g = s5(ph(t, T.creak1, T.creak1 + 0.45));
      const main = [[OW + 10, OH * 0.84], [OW * 0.82, OH * 0.8], [OW * 0.7, OH * 0.83], [OW * 0.56, OH * 0.76], [OW * 0.42, OH * 0.79], [OW * 0.28, OH * 0.72]];
      const n = Math.max(2, Math.round(main.length * g));
      brush(main.slice(0, n), 18, 5, 1630, { dry: true, j: 4 });
      if (g > 0.5) { brush([main[2], [OW * 0.66, OH * 0.9], [OW * 0.6, OH + 20]], 6, 1, 1631, { j: 4 }); brush([main[3], [OW * 0.52, OH * 0.7], [OW * 0.47, OH * 0.66]], 5, 1, 1632, { j: 4 }); }
      if (g > 0.9) { brush([main[5], [OW * 0.2, OH * 0.66], [OW * 0.12, OH * 0.68]], 5, 1, 1633, { j: 4 }); }
    }
    const depth = 110 * s5(ph(t, 1.45, T.cut1 + 0.2)) + 18 * s5(ph(t, 0.15, 0.6));
    edgeInk(depth, 3);
    if (t > 1.9) { const o = s5(ph(t, 1.9, 2.2)); const p = [70, OH - 70]; eye(p[0] - 14, p[1], 9, o, 1640, 0.5); eye(p[0] + 14, p[1], 9, o, 1641, 0.5); }
  }
  function inkHouse(t) {
    const her = INFO.her;
    if (t >= T.cut3) {
      // the last of it burns back to the edges and goes up as ash
      const k = 1 - s5(ph(t, T.cut3, T.cut3 + 1.5));
      if (k > 0) edgeInk(150 * k, 7, { ember: Math.min(1, k * 3) });
      ash(t, T.cut3, T.cut3 + 2.2, 46, 1500);
      return;
    }
    const kill = t >= T.on ? s5(ph(t, T.on, T.cut2)) : 0;
    const belowY = S(0, YS + 6)[1];
    inkBelow(t, s5(ph(t, T.cut1, T.cut1 + 1.4)) * (1 - 0.7 * kill), belowY);
    inkTunnel(t, win(t, T.door - 0.2, T.top + 0.5, 1.2, 0.7), her ? her.hip[0] : 400);
    inkCoats(t, s5(ph(t, T.coats, T.coats + 1.8)) * (1 - s5(ph(t, T.top + 0.2, T.top + 1.2))), her ? her.hip[0] : 400);
    inkBranches(t, s5(ph(t, T.claws, T.claws + 1.8)));
    inkWardrobe(t, s5(ph(t, T.wardrobe, T.wardrobe + 1.6)), 0);
    inkStairs(t, s5(ph(t, T.top - 0.6, T.top + 1.4)), kill);
    // the beast climbs, is burned back down the stairs, and shrinks into the dark round the pan
    const bx = keys([[13.0, 880], [T.on, 742], [T.desc1, 878], [T.found, 812], [T.cut2, 806]], t), by = keys([[13.0, 590], [T.on, 410], [T.desc1, 556], [T.found, 584], [T.cut2, 590]], t);
    const bs = keys([[13.0, 0.5], [T.on, 1.0], [T.desc1, 0.62], [T.found, 0.22], [T.cut2, 0.12]], t);
    const bop = s5(ph(t, 13.1, 13.9)) * (1 - s5(ph(t, T.found - 0.2, T.cut2)));
    if (bop > 0) { const c = S(bx, by); beast(c[0], c[1], bs * 1.5, t, bop, 1700); }
    inkShadow(t, win(t, 9.6, T.top + 0.9, 1.2, 0.8), her);
    inkEyes(t, kill);
    if (her && t > T.heart && t < T.on + 0.9) inkHeart(t, S(her.neck[0], her.neck[1] + 24));
    protect((p) => p >= 10 && p < 70, 0.82);
    const depth = keys([[T.cut1, 110], [6, 140], [10, 175], [13.5, 225], [T.on, 260], [T.desc1, 180], [T.cut2, 160]], t) * (1 + 0.06 * heartAt(t));
    edgeInk(depth, 5, {});
  }
  function inkFace(t) {
    const res = s5(ph(t, T.resolve, T.resolve + 0.25));
    const pulse = 1 + 0.08 * heartAt(t);
    const depth = (300 - 70 * res) * pulse;
    // claws reaching in for her face from all round
    for (let h = 0; h < 7; h++) {
      const a = -Math.PI * 0.95 + h * 0.48, R0 = 760, reach = (0.55 + 0.2 * Math.sin(t * 3 + h)) * (1 - 0.35 * res);
      const fx = OW / 2, fy = 500;
      const p0 = [fx + Math.cos(a) * R0, fy + Math.sin(a) * R0 * 0.9], p2 = [fx + Math.cos(a) * R0 * (1 - reach * 0.62), fy + Math.sin(a) * R0 * 0.9 * (1 - reach * 0.62)];
      const p1 = [(p0[0] + p2[0]) / 2 + 40 * Math.sin(h), (p0[1] + p2[1]) / 2 + 40 * Math.cos(h)];
      brush([p0, p1, p2], 50, 14, 1900 + h, { dry: true });
      hand(p2[0], p2[1], a + Math.PI, 70, 0.34, 1.2 * (h & 1 ? 1 : -1), 9, 1910 + h);
    }
    inkBelow(t, 0.85, OH * 0.62);
    edgeInk(depth, 11, {});
    for (let e = 0; e < 9; e++) { const a = e / 9 * TAU + 0.3, x = OW / 2 + Math.cos(a) * 470, y = 620 + Math.sin(a) * 600; if (y > 80 && y < OH - 60) { eye(x - 16, y, 12, 1 - res * 0.6, 1930 + e, -Math.cos(a)); eye(x + 16, y, 12, 1 - res * 0.6, 1940 + e, -Math.cos(a)); } }
    inkHeart(t, [OW / 2, OH - 120]);
    protect((p) => (p >= 50 && p <= 53) || p === 13 || p === 14 || p >= 60, 0.95);
  }
  function inkCat(t) {
    const kill = s5(ph(t, T.cut2, T.cut2 + 1.5));
    // the beast's shadow on the cupboards shrinks back into what it always was: the cat's
    const op = 1 - s5(ph(t, T.cut2 + 0.1, T.cut2 + 1.3));
    if (op > 0) {
      const s = lerp(1.0, 0.55, s5(ph(t, T.cut2, T.cut2 + 1.3)));
      const c = S(CATC.x - 58, CATC.y - 28);
      ig.globalAlpha = op;
      ig.fillStyle = INKC(0.9); ig.beginPath(); ig.ellipse(c[0], c[1], 260 * s, 200 * s, 0, 0, TAU); ig.fill();
      scrib(c[0], c[1], 300 * s, 230 * s, 50, 4, 1800, INKC(0.9));
      for (const sd of [-1, 1]) brush([[c[0] + sd * 150 * s, c[1] - 120 * s], [c[0] + sd * 190 * s, c[1] - 260 * s], [c[0] + sd * 170 * s, c[1] - 400 * s]], 90 * s, 2, 1810 + sd, { dry: true });
      teeth([[c[0] - 170 * s, c[1] + 40 * s], [c[0], c[1] + 10 * s], [c[0] + 170 * s, c[1] + 40 * s]], 10, 50 * s, 1, 1820, op);
      for (let e = 0; e < 6; e++) eye(c[0] - 150 * s + e * 60 * s, c[1] - 60 * s - (e % 2) * 30 * s, 22 * s, 1, 1830 + e, 0);
      ig.globalAlpha = 1;
    }
    protect((p) => p >= 70 && p <= 76, 1);
    const d = 170 * (1 - kill);
    if (d > 1) edgeInk(d, 9, { ember: 1 });
    ash(t, T.cut2, T.cut2 + 2.2, 50, 1850);
  }
  function drawInk(t) {
    t = mod(t, D);
    B = fl(t * 10);
    ig.setTransform(1, 0, 0, 1, 0, 0); ig.globalAlpha = 1; ig.globalCompositeOperation = 'source-over';
    ig.clearRect(0, 0, OW, OH);
    ig.lineCap = 'round'; ig.lineJoin = 'round';
    const sh = shotAt(t);
    if (sh.k === 'bed') inkBed(t); else if (sh.k === 'house') inkHouse(t); else if (sh.k === 'face') inkFace(t); else inkCat(t);
    if (INFO.beam && INFO.shot === 'house') { const o = S(INFO.beam[0], INFO.beam[1]); burnBeam(o, INFO.beam[2], 0.36, 1000, INFO.beam[3]); }
    grain();
  }

  /* ================================================================ present */
  let SMALL = null, SG = null, IMG = null, PIX = null;
  const LE = new Uint8Array(new Uint32Array([0x01020304]).buffer)[0] === 4;
  const PACK = new Uint32Array(NPAL);
  function present(g) {
    if (!SMALL) {
      SMALL = document.createElement('canvas'); SMALL.width = AW; SMALL.height = AH;
      SG = SMALL.getContext('2d'); IMG = SG.createImageData(AW, AH); PIX = new Uint32Array(IMG.data.buffer);
      for (let n = 0; n < NPAL; n++) { const p = PAL[n]; PACK[n] = (LE ? ((255 << 24) | (p[2] << 16) | (p[1] << 8) | p[0]) : ((p[0] << 24) | (p[1] << 16) | (p[2] << 8) | 255)) >>> 0; }
    }
    for (let i = 0; i < NA; i++) PIX[i] = PACK[OUT[i]];
    SG.putImageData(IMG, 0, 0);
    g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    g.fillStyle = '#06060c'; g.fillRect(0, 0, OW, OH);
    g.imageSmoothingEnabled = false;
    g.drawImage(SMALL, -M * K - Math.round(CAMF[0] * K) + SHAKE[0], -M * K - Math.round(CAMF[1] * K) + SHAKE[1], AW * K, AH * K);
    g.drawImage(IC, 0, 0);
  }
  let MAIN = null, MG = null;
  function pixelsB64() {
    const d = MG.getImageData(0, 0, OW, OH).data, buf = new Uint8Array(OW * OH * 3);
    for (let i = 0, j = 0; i < d.length; i += 4, j += 3) { buf[j] = d[i]; buf[j + 1] = d[i + 1]; buf[j + 2] = d[i + 2]; }
    let s = '';
    for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
    return btoa(s);
  }

  /* ================================================================ mount */
  const ROOM = '#07070c';
  (window.PIECES = window.PIECES || []).push({
    id: 'three-am',
    title: '3 a.m.',
    medium: 'Pixel art in 65 colours, 360 × 450 at 3×, under ink and charcoal at 1080 × 1350 · 38 s loop',
    note: 'The noise downstairs · tap to pause',
    about: 'A thud from downstairs at three in the morning. Her eyes snap open; something creaks. In the dark the fear draws itself over the house in boiling ink: the branch shadows grow claws, the wardrobe yawns, the landing will not end, the coats reach for her, the stairs twist and something enormous climbs them. Torch in one hand, slipper in the other, she goes down. The beam burns the ink away, and at the bottom of the stairs is the cat, sitting in the saucepan it knocked off the counter, very pleased with itself.',
    tone: 'dark',
    room: ROOM,
    mount(el, api) {
      const EXPORT = /[?&]export\b/.test(location.search);
      let alive = true, raf = 0, playing = !EXPORT, clock = 0, last = 0;
      el.style.background = ROOM;
      MAIN = document.createElement('canvas'); MAIN.width = OW; MAIN.height = OH;
      MAIN.style.cssText = 'position:absolute;display:block;cursor:pointer;';
      el.appendChild(MAIN);
      MG = MAIN.getContext('2d', { alpha: false, willReadFrequently: EXPORT });
      IC = document.createElement('canvas'); IC.width = OW; IC.height = OH;
      ig = IC.getContext('2d');
      buildGrain(); GPAT = null;
      const pauseMark = document.createElement('div');
      pauseMark.style.cssText = 'position:absolute;width:34px;height:34px;opacity:0;transition:opacity .4s;pointer-events:none;';
      pauseMark.innerHTML = '<svg viewBox="0 0 34 34" width="34" height="34"><rect x="10" y="9" width="5" height="16" fill="rgba(244,232,206,.85)"/><rect x="19" y="9" width="5" height="16" fill="rgba(244,232,206,.85)"/></svg>';
      el.appendChild(pauseMark);
      function fit() {
        let left = 0, top = 0, cssW = OW, cssH = OH;
        if (EXPORT) { MAIN.style.position = 'fixed'; }
        else {
          const w = el.clientWidth || window.innerWidth, h = el.clientHeight || window.innerHeight;
          const f = Math.min(w / OW, h / OH);
          cssW = OW * f; cssH = OH * f;
          left = Math.round((w - cssW) / 2); top = Math.round((h - cssH) / 2);
        }
        MAIN.style.left = left + 'px'; MAIN.style.top = top + 'px'; MAIN.style.width = cssW + 'px'; MAIN.style.height = cssH + 'px';
        pauseMark.style.left = (left + cssW - 48) + 'px'; pauseMark.style.top = (top + 14) + 'px';
      }
      const draw = (t) => { renderPixels(t); drawInk(t); present(MG); };
      fit();
      build();
      draw(0);
      const hook = {
        duration: D, cuts: CUTS, cues: T, beats: BEATS, lastMs: 0,
        isReady: () => built && (!EXPORT || (() => { const st = el.parentElement; return !st || parseFloat(getComputedStyle(st).opacity) >= 0.999; })()),
        renderAt(t) { return new Promise((res) => { playing = false; clock = t; const t0 = performance.now(); draw(t); hook.lastMs = performance.now() - t0; requestAnimationFrame(() => res()); }); },
        pixels: pixelsB64,
      };
      window.__threeam = hook;
      if (EXPORT) document.documentElement.dataset.ready = 'three-am';
      api.ready();
      function frame(now) {
        if (!alive || !api.isCurrent()) return;
        raf = requestAnimationFrame(frame);
        const dt = last ? Math.min(0.1, (now - last) / 1000) : 0; last = now;
        if (!playing) return;
        clock = (clock + dt) % D;
        const t0 = performance.now();
        draw(clock);
        hook.lastMs = performance.now() - t0;
      }
      if (!EXPORT) raf = requestAnimationFrame(frame);
      const onDown = () => { if (EXPORT) return; playing = !playing; last = 0; pauseMark.style.opacity = playing ? '0' : '1'; };
      MAIN.addEventListener('pointerdown', onDown);
      let rt = 0;
      const ro = new ResizeObserver(() => { clearTimeout(rt); rt = setTimeout(() => { if (alive) fit(); }, 120); });
      ro.observe(el);
      return {
        destroy() {
          alive = false; cancelAnimationFrame(raf); ro.disconnect(); clearTimeout(rt);
          MAIN.removeEventListener('pointerdown', onDown);
          if (window.__threeam === hook) delete window.__threeam;
        },
      };
    },
  });
})();
