  /* ================================================================ UNFORGOTTEN v4 — core: frame, palette, primitives */
  // A 480 × 270 indexed frame shown at 4×. Everything is drawn at the frame's own resolution (never upscaled sprites),
  // so a face in close-up gets more pixels of detail rather than bigger pixels.
  const W = 480, H = 270, NP = W * H, FPS = 30;
  const TAU = Math.PI * 2, PI = Math.PI, fl = Math.floor;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, u) => a + (b - a) * u;
  const sstep = (a, b, x) => { const u = clamp((x - a) / (b - a), 0, 1); return u * u * (3 - 2 * u); };
  const lin = (a, b, x) => clamp((x - a) / (b - a), 0, 1);
  const frac = (x) => x - Math.floor(x);
  const eoc = (u) => 1 - Math.pow(1 - clamp(u, 0, 1), 3);
  const eic = (u) => Math.pow(clamp(u, 0, 1), 3);
  const eio = (u) => { u = clamp(u, 0, 1); return u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2; };
  const eob = (u) => { u = clamp(u, 0, 1); const c1 = 1.7, c3 = c1 + 1; return 1 + c3 * Math.pow(u - 1, 3) + c1 * Math.pow(u - 1, 2); };
  function ih(a, b, c) {
    let h = Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x165667b1) ^ Math.imul(((c | 0) + 7919 * 29) | 0, 0x85ebca77);
    h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d); h = Math.imul(h ^ (h >>> 12), 0x297a2d39); h ^= h >>> 15;
    return (h >>> 0) / 4294967296;
  }
  function vn(x, y, c, s) {
    const X = x / c, Y = y / c, xi = Math.floor(X), yi = Math.floor(Y), u = X - xi, v = Y - yi, su = u * u * (3 - 2 * u), sv = v * v * (3 - 2 * v);
    const a = ih(xi, yi, s), b = ih(xi + 1, yi, s), cc = ih(xi, yi + 1, s), d = ih(xi + 1, yi + 1, s);
    return a + (b - a) * su + (cc - a) * sv + (a - b - cc + d) * su * sv;
  }
  function fbm(x, y, c, oct, s) { let v = 0, a = 1, n = 0; for (let k = 0; k < oct; k++) { v += a * vn(x, y, c, s + k * 31); n += a; a *= 0.5; c *= 0.5; } return v / n; }
  const B4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
  const bay = (x, y) => B4[((y & 3) << 2) | (x & 3)];

  /* ---------------------------------------------------------------- palette: hue-shifted ramps (32 × 8) */
  // Each ramp is built from one base colour in OKLCH: shadows slide toward cool violet, highlights toward warm
  // yellow, and saturation eases off at both ends — the way a pixel artist builds a ramp by hand.
  function srgb2lin(c) { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
  function lin2srgb(c) { c = c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055; return clamp(Math.round(c * 255), 0, 255); }
  function rgb2oklch(r, g, b) {
    r = srgb2lin(r); g = srgb2lin(g); b = srgb2lin(b);
    const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b), m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b), s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
    return [L, Math.hypot(A, B), Math.atan2(B, A)];
  }
  function oklch2rgb(L, C, h) {
    const A = C * Math.cos(h), B = C * Math.sin(h);
    const l = Math.pow(L + 0.3963377774 * A + 0.2158037573 * B, 3), m = Math.pow(L - 0.1055613458 * A - 0.0638541728 * B, 3), s = Math.pow(L - 0.0894841775 * A - 1.291485548 * B, 3);
    return [lin2srgb(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s), lin2srgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s), lin2srgb(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s)];
  }
  const hex3 = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  // base: the colour at shade 4; lo/hi: lightness at shades 0 and 7; shift: hue swing in radians
  function makeRamp(base, lo, hi, shift, satK) {
    const [L0, C0, h0] = rgb2oklch(...hex3(base)), out = [];
    const COOL = 4.6, WARM = 1.45;                                   // OKLab hue angles of violet-blue and warm yellow
    const toward = (h, t, a) => { let d = t - h; while (d > PI) d -= TAU; while (d < -PI) d += TAU; return h + d * a; };
    for (let s = 0; s < 8; s++) {
      const u = s / 7, L = s <= 4 ? lerp(lo, L0, s / 4) : lerp(L0, hi, (s - 4) / 3);
      const h = s < 4 ? toward(h0, COOL, (4 - s) / 4 * shift) : toward(h0, WARM, (s - 4) / 3 * shift * 0.8);
      const C = C0 * (satK || 1) * (1 - Math.pow(Math.abs(u - 0.55) / 0.55, 2) * 0.55);
      out.push(oklch2rgb(L, Math.max(0, C), h));
    }
    return out;
  }
  const RAMP_DEF = [
    ['ink', '#1c1830', 0.08, 0.42, 0.25], ['night', '#283a68', 0.1, 0.78, 0.3], ['dusk', '#5a3e86', 0.12, 0.82, 0.3], ['ember', '#e0602a', 0.18, 0.95, 0.35],
    ['fire', '#ffb43c', 0.3, 0.99, 0.25], ['gold', '#d8a332', 0.22, 0.96, 0.4], ['skin', '#e2a581', 0.3, 0.95, 0.35], ['tan', '#b07650', 0.22, 0.9, 0.35],
    ['hair', '#2a2335', 0.07, 0.6, 0.35], ['crimson', '#bf2638', 0.14, 0.86, 0.35], ['rose', '#e4848a', 0.25, 0.96, 0.3], ['moss', '#4f8a3c', 0.14, 0.88, 0.4],
    ['teal', '#2aa596', 0.16, 0.93, 0.35], ['sea', '#2f6f9a', 0.12, 0.88, 0.35], ['sky', '#7aa8e0', 0.25, 0.97, 0.3], ['indigo', '#3b48a8', 0.1, 0.84, 0.35],
    ['stone', '#7b8094', 0.12, 0.93, 0.3], ['warm', '#8c7c72', 0.13, 0.93, 0.35], ['wood', '#8a5634', 0.12, 0.86, 0.35], ['earth', '#6b5440', 0.1, 0.8, 0.3],
    ['linen', '#d9c9a4', 0.2, 0.98, 0.3], ['hush', '#d8dcea', 0.45, 1.0, 0.15], ['mint', '#8ad6b4', 0.25, 0.97, 0.3], ['lav', '#a28ad6', 0.2, 0.96, 0.3],
    ['rust', '#a04a2a', 0.12, 0.86, 0.35], ['olive', '#8a8a42', 0.14, 0.9, 0.35], ['pink', '#e86aa6', 0.2, 0.96, 0.3], ['steel', '#6a86a0', 0.12, 0.95, 0.3],
    ['bronze', '#a9783a', 0.14, 0.9, 0.4], ['cyan', '#46d2f0', 0.25, 0.99, 0.25], ['violet', '#8a4ad6', 0.14, 0.92, 0.3], ['snow', '#f0f2f8', 0.6, 1.0, 0.1],
  ];
  const R = {}; RAMP_DEF.forEach((d, i) => { R[d[0]] = i; });
  const PAL = []; for (const d of RAMP_DEF) for (const c of makeRamp(d[1], d[2], d[3], d[4])) PAL.push(c);
  const NPAL = PAL.length;
  const LUM = PAL.map((p) => p[0] * 0.3 + p[1] * 0.55 + p[2] * 0.15);
  const C = (ramp, s) => (typeof ramp === 'string' ? R[ramp] : ramp) * 8 + clamp(Math.round(s), 0, 7);
  const BLACK = C('ink', 0), WHITE = C('snow', 7);
  function nearest(r, g, b) {
    let best = 0, bd = 1e9;
    for (let i = 0; i < NPAL; i++) { const p = PAL[i], dr = p[0] - r, dg = p[1] - g, db = p[2] - b, d = dr * dr * 0.3 + dg * dg * 0.59 + db * db * 0.11; if (d < bd) { bd = d; best = i; } }
    return best;
  }
  // tint tables: 8 strengths of mixing every colour toward a target, or adding light
  const TABS = new Map();
  function tab(hex, add) {
    const key = hex + (add ? '+' : ''); if (TABS.has(key)) return TABS.get(key);
    const c = hex3(hex), T = new Uint8Array(8 * NPAL);
    for (let l = 0; l < 8; l++) { const a = (l + 1) / 8; for (let i = 0; i < NPAL; i++) { const p = PAL[i]; T[l * NPAL + i] = add ? nearest(Math.min(255, p[0] + c[0] * a), Math.min(255, p[1] + c[1] * a), Math.min(255, p[2] + c[2] * a)) : nearest(lerp(p[0], c[0], a), lerp(p[1], c[1], a), lerp(p[2], c[2], a)); } }
    TABS.set(key, T); return T;
  }

  /* ---------------------------------------------------------------- the frame */
  const BUF = new Uint8Array(NP);
  // a continuous shade v (0..7) on a ramp, banded like hand-placed pixels: a pixel-wide checker only where two bands meet
  function cel(ramp, v, x, y) {
    v = clamp(v, 0, 7); const b = fl(v), f = v - b;
    if (f > 0.46 && f < 0.54) return ramp * 8 + (((x + y) & 1) ? Math.min(7, b + 1) : b);
    return ramp * 8 + (f >= 0.5 ? Math.min(7, b + 1) : b);
  }
  // the same, with a soft ordered dither (for skies, glows and atmosphere)
  const soft = (ramp, v, x, y) => ramp * 8 + clamp(fl(v + bay(x, y) - 0.5 + 0.5), 0, 7);
  function P(x, y, c) { x = fl(x); y = fl(y); if (x >= 0 && x < W && y >= 0 && y < H) BUF[y * W + x] = c; }
  function rectF(x, y, w, h, c) { const x0 = Math.max(0, fl(x)), y0 = Math.max(0, fl(y)), x1 = Math.min(W, fl(x + w)), y1 = Math.min(H, fl(y + h)); for (let yy = y0; yy < y1; yy++) BUF.fill(c, yy * W + x0, yy * W + Math.max(x0, x1)); }
  // tints step in clean bands, with a pixel checker only right at each band's edge (the way glows are hand-placed)
  function tintI(i, x, y, T, a) { if (a <= 0) return; const v = a * 8 - 0.5, b = fl(v), f = v - b; const l = Math.min(7, f > 0.4 && f < 0.6 ? b + ((x + y) & 1) : Math.round(v)); if (l >= 0) BUF[i] = T[l * NPAL + BUF[i]]; }
  // the old soft dithered tint, for things that should look like haze
  function tintSoft(i, x, y, T, a) { if (a <= 0) return; const l = Math.min(7, fl(a * 8 + bay(x, y) - 0.5)); if (l >= 0) BUF[i] = T[l * NPAL + BUF[i]]; }
  function tintAll(T, a) { if (a <= 0.004) return; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) tintI(y * W + x, x, y, T, a); }
  function glow(cx, cy, r, T, amax, pw) {
    pw = pw || 1.6; const x0 = Math.max(0, fl(cx - r)), x1 = Math.min(W - 1, Math.ceil(cx + r)), y0 = Math.max(0, fl(cy - r)), y1 = Math.min(H - 1, Math.ceil(cy + r));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const d = Math.hypot(x - cx, y - cy) / r; if (d < 1) tintI(y * W + x, x, y, T, amax * Math.pow(1 - d, pw)); }
  }

  /* ---------------------------------------------------------------- shapes: scanline fills with a per-pixel shader */
  // a target is anything with put(x, y, colour, part): the frame, or a figure's layer
  const FRAME = { put(x, y, c) { BUF[y * W + x] = c; } };
  let TGT = FRAME, TGT_PART = 0;
  function put(x, y, c) { if (c < 0 || x < 0 || y < 0 || x >= W || y >= H) return; TGT.put(x, y, c, TGT_PART); }
  function fillPoly(pts, sh) {
    let y0 = 1e9, y1 = -1e9; for (const p of pts) { if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1]; }
    y0 = Math.max(0, fl(y0)); y1 = Math.min(H - 1, Math.ceil(y1));
    const xs = [];
    for (let y = y0; y <= y1; y++) {
      xs.length = 0; const yy = y + 0.5;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const a = pts[i], b = pts[j]; if ((a[1] > yy) !== (b[1] > yy)) xs.push(a[0] + (yy - a[1]) * (b[0] - a[0]) / (b[1] - a[1])); }
      xs.sort((a, b) => a - b);
      for (let q = 0; q + 1 < xs.length; q += 2) { const xa = Math.max(0, Math.round(xs[q])), xb = Math.min(W, Math.round(xs[q + 1])); for (let x = xa; x < xb; x++) { const c = typeof sh === 'number' ? sh : sh(x, y); if (c >= 0) put(x, y, c); } }
    }
  }
  // an ellipse (optionally rotated); the shader gets the pixel and its position inside (u, v in -1..1)
  function fillEll(cx, cy, rx, ry, rot, sh) {
    const c = Math.cos(rot || 0), s = Math.sin(rot || 0), R_ = Math.max(rx, ry) + 1;
    const x0 = Math.max(0, fl(cx - R_)), x1 = Math.min(W - 1, Math.ceil(cx + R_)), y0 = Math.max(0, fl(cy - R_)), y1 = Math.min(H - 1, Math.ceil(cy + R_));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy, u = (dx * c + dy * s) / rx, v = (-dx * s + dy * c) / ry;
      if (u * u + v * v <= 1) { const k = typeof sh === 'number' ? sh : sh(x, y, u, v); if (k >= 0) put(x, y, k); }
    }
  }
  // a tapered limb from a (radius ra) to b (radius rb) with round ends; the shader gets the pixel, how far along (t 0..1)
  // and how far across (w -1..1, signed: + is to the left of the direction of travel)
  function capsule(ax, ay, ra, bx, by, rb, sh) {
    const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy || 1e-6, L = Math.sqrt(L2), R_ = Math.max(ra, rb) + 1;
    const x0 = Math.max(0, fl(Math.min(ax, bx) - R_)), x1 = Math.min(W - 1, Math.ceil(Math.max(ax, bx) + R_)), y0 = Math.max(0, fl(Math.min(ay, by) - R_)), y1 = Math.min(H - 1, Math.ceil(Math.max(ay, by) + R_));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const px = x + 0.5 - ax, py = y + 0.5 - ay, t = clamp((px * dx + py * dy) / L2, 0, 1), qx = px - dx * t, qy = py - dy * t, r = lerp(ra, rb, t), d = Math.hypot(qx, qy);
      if (d <= r) { const side = (dx * qy - dy * qx) / L >= 0 ? 1 : -1, k = typeof sh === 'number' ? sh : sh(x, y, t, side * d / Math.max(0.5, r)); if (k >= 0) put(x, y, k); }
    }
  }
  // a cloth strip along a polyline of [x, y, halfwidth] points (scarves, sashes, coat tails, banners)
  function ribbon(pts, sh) {
    for (let i = 0; i + 1 < pts.length; i++) {
      const a = pts[i], b = pts[i + 1], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l;
      const t0 = i / (pts.length - 1), t1 = (i + 1) / (pts.length - 1);
      fillPoly([[a[0] + nx * a[2], a[1] + ny * a[2]], [b[0] + nx * b[2], b[1] + ny * b[2]], [b[0] - nx * b[2], b[1] - ny * b[2]], [a[0] - nx * a[2], a[1] - ny * a[2]]], typeof sh === 'number' ? sh : (x, y) => sh(x, y, t0 + (t1 - t0) * clamp(((x + 0.5 - a[0]) * dx + (y + 0.5 - a[1]) * dy) / (l * l), 0, 1), ((x + 0.5 - a[0]) * nx + (y + 0.5 - a[1]) * ny) / Math.max(0.5, lerp(a[2], b[2], 0.5))));
    }
  }
  function line(x0, y0, x1, y1, c, w) {
    w = w || 1; const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0)));
    for (let i = 0; i <= n; i++) { const u = i / n, x = x0 + (x1 - x0) * u, y = y0 + (y1 - y0) * u; if (w <= 1) put(fl(x), fl(y), typeof c === 'number' ? c : c(fl(x), fl(y), u)); else for (let j = 0; j < w; j++) for (let k = 0; k < w; k++) put(fl(x - w / 2 + j + 0.5), fl(y - w / 2 + k + 0.5), typeof c === 'number' ? c : c(fl(x), fl(y), u)); }
  }
