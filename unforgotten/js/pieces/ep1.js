(function () {
  "use strict";
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
    const tf = r > 36 ? tintSoft : tintI;   // big glows dither softly; small ones step in hand-placed bands
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const d = Math.hypot(x - cx, y - cy) / r; if (d < 1) tf(y * W + x, x, y, T, amax * Math.pow(1 - d, pw)); }
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

  /* ================================================================ sprites: hand-pixelled parts on a light rig */
  // A character is put together in a small sprite canvas each frame: hand-drawn pixel art for the parts that carry
  // character (head, face, hair, coat) and short drawn limbs for the parts that move. The canvas is then outlined the way
  // a pixel artist would (a dark line round the outside, in the darkest shade of whatever it touches), lit from the
  // scene's key light, and stamped into the frame at a whole-pixel scale.
  const SW = 160, SH = 176, SOX = 80, SOY = 160;                // local origin (feet) at (80, 160)
  const SPR = new Int16Array(SW * SH).fill(-1), SPK = new Uint8Array(SW * SH), SBB = [SW, SH, -1, -1];
  // kinds: 1 body, 2 prop, 3 glow (never outlined or shaded), 4 outline (hand-drawn or automatic)
  function sclear() { SPR.fill(-1); SPK.fill(0); SBB[0] = SW; SBB[1] = SH; SBB[2] = -1; SBB[3] = -1; }
  function sp(x, y, c, k) {
    const X = Math.round(x) + SOX, Y = Math.round(y) + SOY; if (X < 0 || Y < 0 || X >= SW || Y >= SH || c < 0) return;
    const i = Y * SW + X; SPR[i] = c; SPK[i] = k || 1;
    if (X < SBB[0]) SBB[0] = X; if (Y < SBB[1]) SBB[1] = Y; if (X > SBB[2]) SBB[2] = X; if (Y > SBB[3]) SBB[3] = Y;
  }
  // hand-drawn rows: a key maps each character to a colour; 'k' is the hand-drawn outline; '.' is empty.
  // (x, y) is where the art's anchor (ax, ay) lands; flip mirrors it about the anchor
  function art(A, x, y, flip, key) {
    const K = key || A.key, rows = A.rows, ax = A.ax || 0, ay = A.ay || 0;
    for (let j = 0; j < rows.length; j++) { const row = rows[j]; for (let i = 0; i < row.length; i++) { const ch = row[i]; if (ch === '.' || ch === ' ') continue; const c = K[ch]; if (c === undefined) continue; sp(x + (flip ? ax - i : i - ax), y + j - ay, typeof c === 'function' ? c() : c, ch === 'k' ? 4 : ch === '*' ? 3 : 1); } }
  }
  // a drawn limb: a thick line with a lit edge and a shadowed edge (ramp, base shade), r: half-width
  function limb(ax, ay, bx, by, r0, r1, ramp, base, kind) {
    const dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L, n = Math.ceil(L * 2), lit = nx * LIGHTS.x + ny * LIGHTS.y;
    for (let i = 0; i <= n; i++) {
      const u = i / n, cx = ax + dx * u, cy = ay + dy * u, r = lerp(r0, r1, u);
      for (let q = -r; q <= r + 0.01; q += 0.5) { const w = q / Math.max(0.5, r), s = base + (w * lit > 0.45 ? 1 : w * lit < -0.45 ? -1 : 0); sp(cx + nx * q, cy + ny * q, ramp * 8 + clamp(s, 0, 7), kind || 1); }
    }
  }
  // a small round thing (a hand, a knee, a cord): lit on the light side
  function blob(cx, cy, r, ramp, base, kind) { for (let y = fl(cy - r); y <= cy + r; y++) for (let x = fl(cx - r); x <= cx + r; x++) { const dx = x + 0.5 - cx, dy = y + 0.5 - cy; if (dx * dx + dy * dy > r * r + 0.3) continue; const l = (dx * LIGHTS.x + dy * LIGHTS.y) / Math.max(1, r); sp(x, y, ramp * 8 + clamp(base + (l > 0.35 ? 1 : l < -0.4 ? -1 : 0), 0, 7), kind || 1); } }
  // the light as the sprite sees it (flipped with the sprite)
  const LIGHTS = { x: -0.6, y: -0.8 }, LIGHT = { x: -0.6, y: -0.8 };
  // the automatic outline: every empty pixel touching a body pixel takes the darkest shade of what it touches;
  // pixels on the lit side of the silhouette take ENV.edge if a scene sets one (a rim of light, like The Null)
  const OUTS = new Int16Array(SW * SH);
  function soutline(edge) {
    OUTS.set(SPR);
    const x0 = Math.max(1, SBB[0] - 1), x1 = Math.min(SW - 2, SBB[2] + 1), y0 = Math.max(1, SBB[1] - 1), y1 = Math.min(SH - 2, SBB[3] + 1);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const i = y * SW + x; if (OUTS[i] >= 0) continue;
      let src = -1, dx = 0, dy = 0;
      for (const [j, ox, oy] of [[i - 1, -1, 0], [i + 1, 1, 0], [i - SW, 0, -1], [i + SW, 0, 1]]) if (OUTS[j] >= 0 && SPK[j] !== 3 && SPK[j] !== 4) { src = OUTS[j]; dx = ox; dy = oy; break; }
      if (src < 0) continue;
      const lit = -(dx * LIGHTS.x + dy * LIGHTS.y) > 0.4;
      SPR[i] = lit && edge !== undefined && edge !== null ? edge : (src >> 3) * 8 + (lit ? 1 : 0); SPK[i] = 4;
    }
    SBB[0] = Math.max(0, SBB[0] - 1); SBB[1] = Math.max(0, SBB[1] - 1); SBB[2] = Math.min(SW - 1, SBB[2] + 1); SBB[3] = Math.min(SH - 1, SBB[3] + 1);
  }
  // stamp the sprite into the frame: feet at (x, y), whole-pixel scale S, flip; o: alpha, fx(c, x, y) colour filter,
  // white (a flash), color (a silhouette), noOutline
  function stamp(x, y, S, flip, o) {
    o = o || {}; x = Math.round(x); y = Math.round(y); S = Math.max(1, Math.round(S || 1));
    if (o.rot || o.sx || o.sy) return stampRot(x, y, S, flip, o);
    for (let j = SBB[1]; j <= SBB[3]; j++) for (let i = SBB[0]; i <= SBB[2]; i++) {
      const k = j * SW + i; let c = SPR[k]; if (c < 0) continue;
      if (o.color !== undefined) c = o.color; else if (o.white) c = SPK[k] === 4 ? C('hush', 3) : WHITE;
      const ox = flip ? -(i - SOX) - 1 : i - SOX, ly = j - SOY;
      for (let q = 0; q < S; q++) for (let p = 0; p < S; p++) {
        const X = x + ox * S + p, Y = y + ly * S + q;
        if (X < 0 || Y < 0 || X >= W || Y >= H) continue;
        if (o.alpha !== undefined && bay(X, Y) >= o.alpha) continue;
        const cc = o.fx ? o.fx(c, X, Y, SPK[k]) : c; if (cc >= 0) BUF[Y * W + X] = cc;
      }
    }
  }
  // a rotated stamp: every frame pixel samples the sprite through the inverse rotation about a pivot (piv: sprite px
  // above the feet), so the pixels stay whole and crisp at any angle
  function stampRot(x, y, S, flip, o) {
    // (sx, sy: a squash or stretch about the pivot, for the frames of an impact or a hop)
    const piv = o.piv === undefined ? 30 : o.piv, px = x, py = y - piv * S, ca = Math.cos(o.rot || 0), sa = Math.sin(o.rot || 0), kx = o.sx || 1, ky = o.sy || 1;
    const R_ = Math.hypot(Math.max(SOX - SBB[0], SBB[2] - SOX) + 1, Math.max(Math.abs(SBB[1] - SOY + piv), Math.abs(SBB[3] - SOY + piv)) + 1) * S * Math.max(kx, ky, 1);
    for (let Y = Math.max(0, fl(py - R_)); Y < Math.min(H, py + R_); Y++) for (let X = Math.max(0, fl(px - R_)); X < Math.min(W, px + R_); X++) {
      const dx = (X + 0.5 - px) / S, dy = (Y + 0.5 - py) / S, sx = (dx * ca + dy * sa) / kx, sy = (-dx * sa + dy * ca) / ky;
      const ox = fl(sx), i = flip ? SOX - 1 - ox : ox + SOX, j = fl(sy - piv + SOY);
      if (i < SBB[0] || i > SBB[2] || j < SBB[1] || j > SBB[3]) continue;
      const k = j * SW + i; let c = SPR[k]; if (c < 0) continue;
      if (o.color !== undefined) c = o.color; else if (o.white) c = WHITE;
      if (o.alpha !== undefined && bay(X, Y) >= o.alpha) continue;
      const cc = o.fx ? o.fx(c, X, Y, SPK[k]) : c; if (cc >= 0) BUF[Y * W + X] = cc;
    }
  }

  /* ================================================================ the cast: hand-pixelled parts */
  // Everything faces right; the rig mirrors it. Keys map letters to palette entries.
  const k_ = C('ink', 0);
  /* ---- Sable */
  const SABLE_KEY = {
    k: k_, H: C('hair', 1), h: C('hair', 2), l: C('hair', 3), L: C('hair', 5), s: C('tan', 5), S: C('tan', 3), t: C('tan', 6), n: C('tan', 2),
    C: C('ink', 3), D: C('ink', 4), c: C('ink', 2), w: C('linen', 6), W: C('linen', 4), r: C('crimson', 4), R: C('crimson', 2), g: C('gold', 5),
  };
  const SABLE = {
    key: SABLE_KEY,
    head: { ax: 11, ay: 23, eyeN: [15, 12], eyeF: [10, 12], mouth: [15, 18], browN: [14, 10], browF: [9, 10], rows: [
      '........kkkkkkk.......',
      '......kkHHHHHHHkk.....',
      '.....kHHhhhhhhhhHk....',
      '....kHhhhlllllhhhHk...',
      '...kHhhhlLLLLLlhhhHk..',
      '..kHhhhhllllllhhhhhk..',
      '.kHhhhhhhhhhhhhhhhhHk.',
      '.kHhhhhhhhHhhhHhhhhhk.',
      'kHhhhhhhHkhHkhhHhHhhk.',
      'kHhhhhhHkssHksshHkshHk',
      'kHhhhhHksssskssssksssk',
      'kHhhhhHkssssssssssssk.',
      'kHhhhhHksssssssssssssk',
      'kHhhhhHsssssssssssssk.',
      'kHhhhhHsSsssssssssssk.',
      'kHhhhhHsSsssssssssnssk',
      'kHhhhhHSSssssssssssk..',
      'kHhhhhHkSSsssssssssk..',
      '.kHhhhHkSSssssssssk...',
      '.kHhhhHkkSSssssssk....',
      '.kHhhhHk.kSSsssskk....',
      '..kHhhHk..kkSSSk......',
      '..kHhhHk...kSSSk......',
      '...kHHk....kSSSk......',
    ] },
    torso: { ax: 8, ay: 0, shN: [13, 3], shF: [3, 3], hip: [8, 16], rows: [
      '......kssk......',
      '....kkwSwkkk....',
      '..kkDDwwwwCCkk..',
      '.kDDDCCwwCCCcCk.',
      '.kDDCCCCwCCCcCk.',
      'kDDCCCCCwCCCcCCk',
      'kDDCCCCCCwCCcCCk',
      'kDCCCCCCCCwCcCCk',
      'kDCCCCCCCCCwcCk.',
      '.kDCCCCCCCCCcCk.',
      '.kDCCCCCCCCCcCk.',
      '.kDCCCCCCCCCcCk.',
      '.krrrrrrrrrRRrk.',
      '.krrrrrrgrrRRrk.',
      '.kRRRRRRRRRRRRk.',
      '.kDCCCCCCCCcCCk.',
      '.kDCCCCCCCCckCCk',
      'kDCCCCCCCCck.kCk',
      'kDCCCCCCCck..kCk',
      'kDCCcCCCCck...kCk',
      'kDCCcCCCck....kCk',
      'kDCCcCCCck....kCk',
      'kDCCcCCck.....kk.',
      'kkkkkkkk.........',
    ] },
  };
  // faces, shared shapes: eyes (near and far), mouths, brows; I = iris, P = pupil
  const EYES = {
    open: { n: ['kkk', 'wIP', 'wPP'], f: ['kk', 'IP', 'PP'] },
    wide: { n: ['kkk', 'wIw', 'wPP', '.w.'], f: ['kk', 'Iw', 'PP'] },
    half: { n: ['...', 'kkk', 'wPP'], f: ['..', 'kk', 'PP'] },
    narrow: { n: ['...', 'kkk', '.PP'], f: ['..', 'kk', '.P'] },
    closed: { n: ['...', '...', 'kkk'], f: ['..', '..', 'kk'] },
    happy: { n: ['...', '.k.', 'k.k'], f: ['..', 'k.', '.k'] },
    sad: { n: ['k..', 'wIP', 'wPP'], f: ['.k', 'IP', 'PP'] },
  };
  const MOUTHS = { closed: ['nn'], smile: ['n..n', '.nn.'], frown: ['.nn.', 'n..n'], o1: ['kk', 'mm'], o2: ['kkk', 'mmm', 'kkk'], o3: ['kkk', 'mtm', 'mmm', 'kkk'], grit: ['kkk', 'www', 'kkk'] };
  const BROWS = { n: { n: ['HHH'], f: ['HH'] }, angry: { n: ['H..', '.HH'], f: ['.H', 'H.'] }, worried: { n: ['.HH', 'H..'], f: ['H.', '.H'] }, up: { n: ['HHH', '...'], f: ['HH', '..'] } };
  function face(CH, x0, y0, flip, F, key) {
    const hd = CH.head, at = (a) => [x0 + (flip ? hd.ax - a[0] : a[0] - hd.ax), y0 + a[1] - hd.ay];
    const ek = Object.assign({}, key, { w: C('snow', 7), I: C(CH.iris, 5), P: C(CH.iris, 1), m: C('crimson', 1), t: C('crimson', 4), k: k_ });
    const E = EYES[F.eyes || 'open'] || EYES.open;
    for (const [rows, a] of [[E.n, hd.eyeN], [E.f, hd.eyeF]]) { const [x, y] = at(a); art({ rows, ax: 0, ay: 0 }, x, y, flip, ek); }
    const B = BROWS[F.brows || 'n'] || BROWS.n;
    for (const [rows, a] of [[B.n, hd.browN], [B.f, hd.browF]]) { const [x, y] = at(a); art({ rows, ax: 0, ay: 0 }, x, y - rows.length + 1, flip, ek); }
    const m = F.mouth || 0, M = m > 0.75 ? MOUTHS.o3 : m > 0.45 ? MOUTHS.o2 : m > 0.15 ? MOUTHS.o1 : F.smile > 0.3 ? MOUTHS.smile : F.smile < -0.3 ? MOUTHS.frown : MOUTHS.closed;
    const [mx, my] = at(hd.mouth); art({ rows: M, ax: 0, ay: 0 }, mx - (M[0].length > 2 ? 1 : 0), my, flip, ek);
    // the cracked white mask: a plate over the upper face with two slits (embers burning behind them when lit)
    if (F.mask) { const x0_ = hd.eyeF[0] - 2, x1_ = hd.eyeN[0] + 4, y0_ = hd.browF[1] - 1, y1_ = hd.mouth[1] + 1;
      for (let yy = y0_; yy <= y1_; yy++) for (let xx = x0_; xx <= x1_; xx++) { if (yy === y1_ && (xx === x0_ || xx === x1_)) continue; const [px, py] = at([xx, yy]); const slit = yy === hd.eyeN[1] + 1 && ((xx >= hd.eyeN[0] && xx <= hd.eyeN[0] + 2) || (xx >= hd.eyeF[0] && xx <= hd.eyeF[0] + 1)); const crack = xx === hd.eyeN[0] + 1 + (yy > hd.eyeN[1] + 2 ? 1 : 0) && yy !== hd.eyeN[1] + 1;
        sp(px, py, slit ? (F.mask > 1 ? C('fire', 6) : C('ink', 0)) : crack ? C('ink', 1) : yy === y0_ ? C('snow', 7) : C('hush', 5 + (xx > hd.eyeN[0] ? -1 : 0)), slit && F.mask > 1 ? 3 : 1); } }
    if (F.blush) for (const a of [[hd.eyeN[0] - 1, hd.eyeN[1] + 4], [hd.eyeF[0] - 1, hd.eyeF[1] + 4]]) { const [x, y] = at(a); sp(x, y, C('rose', 4)); sp(x + (flip ? -1 : 1), y, C('rose', 4)); }
  }
  SABLE.iris = R.ember;
  SABLE.head.key = SABLE.torso.key = SABLE_KEY;

  /* ---- Mira: eight, a yellow raincoat with the hood up, brown fringe, red boots */
  const MIRA_KEY = {
    k: k_, Y: C('gold', 5), y: C('gold', 4), z: C('gold', 3), Z: C('gold', 6), s: C('skin', 5), S: C('skin', 3), t: C('skin', 6), n: C('skin', 2),
    b: C('wood', 3), B: C('wood', 2), o: C('linen', 7), H: C('wood', 1),
  };
  const MIRA = {
    key: MIRA_KEY, iris: R.wood,
    head: { ax: 9, ay: 19, eyeN: [13, 11], eyeF: [8, 11], mouth: [13, 15], browN: [12, 9], browF: [7, 9], rows: [
      '.......kkkkkk.......',
      '.....kkYYYYYYkk.....',
      '....kYZZZZZZYYYk....',
      '...kYZZYYYYYYYYYk...',
      '..kYZYYyyyyyyyYYYk..',
      '..kYYyykkkkkkkyyYk..',
      '.kYYyykbbbbbbbkkyYk.',
      '.kYYykbbBbbbbbbbkYk.',
      '.kYYykbBssbbbssbbkYk',
      '.kYYyksssssssssssskk',
      '.kYYykssssssssssssk.',
      '.kYYyksssssssssssssk',
      '.kYYyksSsssssssssssk',
      '.kYYyksSssssssssssk.',
      '.kYYyksSSsssssssssk.',
      '.kYYYykSSssssssssk..',
      '..kYYYykSSsssssskk..',
      '..kzYYYykkSSSSkk....',
      '...kzzYYYkkkkk......',
      '....kkkkkk..........',
    ] },
    torso: { ax: 7, ay: 0, shN: [11, 2], shF: [3, 2], hip: [7, 12], rows: [
      '.....kssk.....',
      '...kkYYYYkk...',
      '..kZYYYYYYYk..',
      '.kZZYYoYYYYYk.',
      '.kZYYYYYYYyYk.',
      '.kZYYYoYYYyYk.',
      'kZZYYYYYYYyYYk',
      'kZYYYYoYYYyYYk',
      'kZYYYYYYYYyYYk',
      'kZYYYYoYYyyYYk',
      'kZYYYYYYYyYYYk',
      'kZYYyyyyyyYYYk',
      'kZYYYYYYYYYYYk',
      'kZYYYYYYYYYYYk',
      'kZYYYYYYYYYYYYk',
      'kzzzzzzzzzzzzzk',
      'kkkkkkkkkkkkkkk',
    ] },
  };
  MIRA.head.key = MIRA.torso.key = MIRA_KEY;
  // body measures (sprite pixels): legs, arms, limb widths, colours
  SABLE.body = { leg: 30, thigh: 15.5, shin: 15, legR: 2.3, arm1: 9, arm2: 8.5, armR: 1.7, pants: R.ink, pantsB: 2, sleeve: R.ink, sleeveB: 3, skin: R.tan, boot: R.hair, cuff: R.crimson };
  MIRA.body = { leg: 16, thigh: 8.5, shin: 8, legR: 2, arm1: 6, arm2: 5.5, armR: 1.7, pants: R.crimson, pantsB: 3, sleeve: R.gold, sleeveB: 4, skin: R.skin, boot: R.crimson, kid: true };

  /* ---------------------------------------------------------------- the rig */
  // pose (sprite pixels, feet at 0,0, facing right): hip (y offset of the hips, default -leg), lean (px the head leads),
  // legs [near, far]: { foot: [x, y], knee: [x, y] } (knee optional: IK bends it forward), arms [near, far]: { a, b } angles
  // (0 = hanging, + forward/up) or { hand: [x, y] }, face {...}, hair (sway), prop (fn)
  function ik(ax, ay, bx, by, l1, l2, bend) {
    let dx = bx - ax, dy = by - ay, d = Math.hypot(dx, dy); const mx = l1 + l2 - 0.01; if (d > mx) { dx *= mx / d; dy *= mx / d; d = mx; }
    const a = Math.acos(clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d || 1), -1, 1)), base = Math.atan2(dy, dx), ang = base + a * bend;
    return [ax + Math.cos(ang) * l1, ay + Math.sin(ang) * l1, ax + dx, ay + dy];
  }
  function rig(CH, P, t) {
    const B = CH.body, tr = CH.torso, hd = CH.head;
    sclear();
    const hipY = P.hip === undefined ? -B.leg : P.hip, lean = P.lean || 0, bob = P.bob || 0;
    const hx = 0, hy = hipY + bob;
    // torso placement: its hip anchor on the hips, leaning the top forward by shifting rows
    const neck = [hx + lean, hy - tr.hip[1]];
    const shN = [neck[0] + tr.shN[0] - tr.ax, neck[1] + tr.shN[1]], shF = [neck[0] + tr.shF[0] - tr.ax, neck[1] + tr.shF[1]];
    // the far side first: back hair, far arm, far leg
    if (CH.back) CH.back(P, neck, t);
    const arm = (A, sh, far) => {
      let el, hd_;
      if (A.hand) { const r = ik(sh[0], sh[1], A.hand[0], A.hand[1], B.arm1, B.arm2, A.bend === undefined ? -1 : A.bend); el = [r[0], r[1]]; hd_ = [r[2], r[3]]; }
      else { const a = A.a === undefined ? 0.15 : A.a, b = A.b === undefined ? 0.3 : A.b; el = [sh[0] + Math.sin(a) * B.arm1, sh[1] + Math.cos(a) * B.arm1]; hd_ = [el[0] + Math.sin(a + b) * B.arm2, el[1] + Math.cos(a + b) * B.arm2]; }
      limb(sh[0], sh[1], el[0], el[1], B.armR + 0.3, B.armR, B.sleeve, B.sleeveB - far);
      limb(el[0], el[1], hd_[0], hd_[1], B.armR, B.armR + 0.2, B.sleeve, B.sleeveB - far);
      if (B.cuff) limb(lerp(el[0], hd_[0], 0.75), lerp(el[1], hd_[1], 0.75), hd_[0], hd_[1], B.armR + 0.3, B.armR + 0.3, B.cuff, 4 - far);
      blob(hd_[0] + (hd_[0] - el[0]) * 0.18, hd_[1] + (hd_[1] - el[1]) * 0.18, 1.6, B.skin, 5 - far);
      return { el, hand: hd_ };
    };
    const leg = (L, ox, far) => {
      const hp = [hx + ox, hy - 1], ft = L.foot || [ox, 0];
      let kn = L.knee; if (!kn) { const r = ik(hp[0], hp[1], ft[0], ft[1] - 1, B.thigh, B.shin, -1); kn = [r[0], r[1]]; }
      limb(hp[0], hp[1], kn[0], kn[1], B.legR + 0.3, B.legR, B.pants, B.pantsB - far);
      limb(kn[0], kn[1], ft[0], ft[1] - 1.5, B.legR, B.legR - 0.3, B.kid ? B.boot : B.pants, (B.kid ? 4 : B.pantsB) - far);
      // the boot: toe forward
      const bt = B.boot, fx = ft[0], fy = ft[1] - 1;
      for (let x = -2; x <= 3; x++) for (let y = -2; y <= 0; y++) if (!(x === 3 && y === -2)) sp(fx + x, fy + y, C(bt, (y === -2 ? 3 : 2) - far + (x < 0 ? 0 : 0)));
      return kn;
    };
    const A = P.arms || [{}, {}], L = P.legs || [{}, {}];
    const aF = arm(A[1], shF, 1);
    if (P.propFar) P.propFar(aF, t);
    leg(L[1], -2, 1); leg(L[0], 2, 0);
    // the torso, the head and its face
    art(tr, neck[0], neck[1], false);
    const hx2 = neck[0] + (P.headX || 0), hy2 = neck[1] + 1 + (P.headY || 0);
    art(hd, hx2, hy2, false); if (!CH.noFace) face(CH, hx2, hy2, false, P.face || {}, CH.key);
    if (CH.front) CH.front(P, [hx2, hy2], t);
    const aN = arm(A[0], shN, 0);
    if (P.prop) P.prop(aN, t);
    return { neck, head: [hx2, hy2 - hd.ay / 2], handN: aN.hand, handF: aF.hand, chest: [neck[0], neck[1] + 6] };
  }
  // draw a character into the frame: feet at (x, y), scale S, facing f (+1 right, -1 left)
  function actor(CH, P, x, y, S, f, o) {
    LIGHTS.x = LIGHT.x * (f < 0 ? -1 : 1); LIGHTS.y = LIGHT.y;
    const r = rig(CH, P, P.t || 0);
    soutline(ENV.edge);
    stamp(x, y, S || 1, f < 0, o);
    const L = (q) => [x + (f < 0 ? -q[0] - 0.5 : q[0] + 0.5) * (S || 1), y + q[1] * (S || 1)];
    return { head: L(r.head), handN: L(r.handN), handF: L(r.handF), chest: L(r.chest), neck: L(r.neck) };
  }
  // Sable's ponytail: a chain of shrinking blobs from the crown, swaying
  SABLE.back = (P, neck, t) => {
    const w = P.wind || 0; let x = neck[0] - 6, y = neck[1] - 19;
    blob(x + 1, y, 2.2, R.crimson, 4);
    for (let k = 0; k < 9; k++) { const sw = Math.sin(t * 2.2 - k * 0.5) * (0.35 + w * 0.2); x += -1.1 - w * 0.5 + sw * 0.4; y += 2.2 - w * 0.25; blob(x, y, Math.max(1, 3 - k * 0.22), R.hair, k % 3 === 1 ? 3 : 2); }
  };
  const ENV = { edge: null };
  // Sable's sword: a long single-edged blade, a gold guard, a red-wrapped grip; ang 0 points straight up
  function swordArt(hx, hy, ang, L, burn) {
    const dx = Math.sin(ang), dy = -Math.cos(ang), nx = -dy, ny = dx;
    for (let u = -4; u <= 0; u += 0.5) sp(hx + dx * u, hy + dy * u, C('crimson', u % 2 === 0 ? 2 : 3), 2);
    for (let q = -3; q <= 3; q += 0.5) sp(hx + dx * 1.5 + nx * q, hy + dy * 1.5 + ny * q, C('gold', q < 0 ? 5 : 3), 2);
    for (let u = 2; u < L; u += 0.5) { const w = u > L - 4 ? (L - u) / 4 : 1; for (let q = -0.6; q <= w * 1.1; q += 0.5) sp(hx + dx * u + nx * q, hy + dy * u + ny * q, burn ? C(q > 0.6 ? 'fire' : 'ember', q > 0.6 ? 6 : 5) : C('steel', q < 0 ? 6 : q > 0.8 ? 3 : 5), burn ? 3 : 2); }
  }
  // Mira's lantern, hanging from her hand
  function lanternArt(hx, hy, t, lit, ang) {
    const sw = ang === undefined ? Math.round(Math.sin(t * 3) * 0.6) : Math.round(Math.sin(ang) * 6);
    for (let y = 0; y < 3; y++) sp(hx + sw * y / 3, hy + y, C('wood', 2), 2);
    for (let y = 3; y < 9; y++) for (let x = -2; x <= 2; x++) sp(hx + sw + x, hy + y, y === 3 || y === 8 ? C('wood', 2) : lit ? (Math.abs(x) < 1 ? C('snow', 7) : C('fire', 5)) : C('stone', 3), lit && y > 3 && y < 8 ? 3 : 2);
  }

  /* ---- Kaira: the courier; swept-back silver hair, an indigo headband with a gold stone, a gold mark on her cheek */
  const KAIRA_KEY = {
    k: k_, H: C('steel', 3), h: C('hush', 3), l: C('hush', 6), L: C('snow', 7), s: C('skin', 5), S: C('skin', 3), t: C('skin', 6), n: C('skin', 2),
    i: C('indigo', 2), I: C('indigo', 4), g: C('gold', 5), G: C('gold', 6), C: C('indigo', 3), D: C('indigo', 5), c: C('indigo', 1), w: C('linen', 6), W: C('linen', 4), r: C('gold', 4),
  };
  const KAIRA = {
    key: KAIRA_KEY, iris: R.gold,
    head: { ax: 11, ay: 23, eyeN: [15, 12], eyeF: [10, 12], mouth: [15, 18], browN: [14, 10], browF: [9, 10], rows: [
      '.......k...kk.........',
      'kk....khk.klhk..k.....',
      'khkk.khhkkhlhkkhk.....',
      '.khhkhlhhhhllhhhk.kk..',
      'kkhhhhllLlhhlhhhkhhk..',
      'kHhhhlhhhhlhhHhhhhhhk.',
      '.kHhhHhhhhhhhhHhhhhhk.',
      '..kHiiiiiiiiiiiiiiiik.',
      '.kHiIIIIIIgGIIIIIIIIk.',
      '.kHhiiiiiiiiiiiiiiiik.',
      'kHhhhhHkssskhsskhsssk.',
      'kHhhhhHksssssssssssssk',
      'kHhhhHksssssssssssssk.',
      'kHhhhHkssssssssssssssk',
      'kHhhhHsSsssssssssssssk',
      '.kHhhHsSsssssssssnssk.',
      '.kHhHkSSssssggssssssk.',
      '..kHHkSSssssgsssssk...',
      '..kHk.kSSssssssssk....',
      '...k..kkSSssssssk.....',
      '.......kkSSsssskk.....',
      '.........kSSSSk.......',
      '.........kSSSSk.......',
      '.........kSSSSk.......',
    ] },
    torso: { ax: 8, ay: 0, shN: [13, 3], shF: [3, 3], hip: [8, 16], rows: [
      '......kssk......',
      '....kkIwIkkk....',
      '..kkDDIwwDCCkk..',
      '.kDDDCCwwCCCcCk.',
      '.kDDCCCCwCCCcCk.',
      'kDDCCwCCCwCCcCCk',
      'kDDCCCwCCCwCcCCk',
      'kDCCCCCwCCCwcCCk',
      'kDCCCCCCwCCCcwk.',
      '.kDCCCCCCwCCcCk.',
      '.kDCCCCCCCwCcCk.',
      '.krrrrrrrrrrrrk.',
      '.kgggggGggggggk.',
      '.krrrrrrrrrrrrk.',
      '.kDCCCCCCCCcCCk.',
      '.kDCCCCCCCCcCCk.',
      '.kDCCCCCCCCckCk.',
      '.kDCCCCCCCck.kk.',
      '.kkkkkkkkkk.....',
    ] },
    body: { leg: 30, thigh: 15.5, shin: 15, legR: 2.2, arm1: 9, arm2: 8.5, armR: 1.7, pants: R.indigo, pantsB: 2, sleeve: R.indigo, sleeveB: 3, skin: R.skin, boot: R.ink, cuff: R.gold },
  };
  KAIRA.head.key = KAIRA.torso.key = KAIRA_KEY;
  KAIRA.back = (P, neck, t) => {
    // the satchel on her hip, behind the far side
    const w = P.wind || 0;
    for (let y = 0; y < 6; y++) for (let x = -3; x <= 3; x++) sp(neck[0] - 7 + x, neck[1] + 15 + y, C('linen', y === 0 ? 5 : x < 0 ? 4 : 3));
    // hair streaming back in the wind
    // (each lock a chain of tapering limbs, so the strands stay solid however far the wind pulls them)
    for (let k = 0; k < 4; k++) { let x = neck[0] - 6, y = neck[1] - 15 - k * 2.6; const n = 3 + (k % 2) + Math.round(w * 0.5), seg = 1.8 + w * 0.5; for (let j = 0; j < n; j++) { const nx = x - seg, ny = y + 0.5 + Math.sin(t * 7 + k * 1.3 + j * 0.9) * (0.4 + w * 0.15), r0 = Math.max(0.7, 1.7 - j * 0.32), r1 = Math.max(0.6, 1.7 - (j + 1) * 0.32); limb(x, y, nx, ny, r0, r1, R.hush, k === 1 ? 5 : k === 3 ? 2 : 3); x = nx; y = ny; } }
  };

  /* ---- Tamo: the dockhand; a teal topknot with a gold ring, rosy cheeks, a linen tunic and a sea-blue band */
  const TAMO_KEY = {
    k: k_, H: C('teal', 2), h: C('teal', 3), l: C('teal', 5), L: C('mint', 6), s: C('tan', 5), S: C('tan', 3), t: C('tan', 6), n: C('tan', 2), p: C('rose', 4),
    g: C('gold', 5), C: C('linen', 5), D: C('linen', 6), c: C('linen', 3), b: C('sea', 3), B: C('sea', 2), o: C('rose', 5), O: C('rose', 3), w: C('wood', 4),
  };
  const TAMO = {
    key: TAMO_KEY, iris: R.ink,
    head: { ax: 11, ay: 24, eyeN: [15, 13], eyeF: [10, 13], mouth: [15, 19], browN: [14, 11], browF: [9, 11], rows: [
      '........kkkk..........',
      '.......khhhhk.........',
      '.......kglgGk.........',
      '.....kkkhhhhkkk.......',
      '...kkHHhhlllhhhkk.....',
      '..kHHhhlLLLLlhhhHk....',
      '.kHhhhhllllllhhhhHk...',
      '.kHhhhhhhhhhhhhhhhhk..',
      'kHhhhhhhHhhhhHhhhhhhk.',
      'kHhhhhhHkhhHhhhHhhhhk.',
      'kHhhhhHksshhsshhshhhk.',
      'kHhhhhksssssssssssshk.',
      '.kHhhksssssssssssssssk',
      '.kHhhkssssssssssssssk.',
      '.kHhhksssssssssssssssk',
      '.kHhhsSsssssssssssssk.',
      '.kHhhsSsspssssspsnssk.',
      '..kHhSSspppsssppsssk..',
      '..kHhSSssssssssssssk..',
      '...kHkSSssssssssssk...',
      '....k.kSSssssssskk....',
      '.......kkSSsssskk.....',
      '.........kSSSSk.......',
      '.........kSSSSk.......',
      '.........kSSSSk.......',
    ] },
    torso: { ax: 9, ay: 0, shN: [16, 3], shF: [3, 3], hip: [9, 17], rows: [
      '.......kssk.......',
      '....kkbBbbBbkk....',
      '..kkDDwDDDwDCCkk..',
      '.kDDDDDwDwDCCCcCk.',
      'kDDDCCCCwCCCCooCCk',
      'kDDCCCCCCCCCoOOoCk',
      'kDDCCCCCCCCCCooCCk',
      'kDCCCCCCCCCCCCCcCk',
      'kDCCCCCCCCCCCCCcCk',
      'kDCCCCCCCCCCCCCcCk',
      '.kDCCCCCCCCCCCcCk.',
      '.kbbbbbbbbbbbbbbk.',
      '.kbBBBBBBBBBBBBbk.',
      '.kbbbbbbbbbbbbbbk.',
      '.kDCCCCCCCCCCCcCk.',
      '.kDCCCCCCCCCCCcCk.',
      '.kDCCCCCCCCCCCcCk.',
      '.kkkkkkkkkkkkkkkk.',
    ] },
    body: { leg: 28, thigh: 14.5, shin: 14, legR: 2.8, arm1: 9, arm2: 8.5, armR: 2.2, pants: R.linen, pantsB: 3, sleeve: R.tan, sleeveB: 4, skin: R.tan, boot: R.wood },
  };
  TAMO.head.key = TAMO.torso.key = TAMO_KEY;

  /* ---- the temple wardens: indigo lacquered lamellar, a rounded steel helm with a white plume and a visor slit that
  // glows; Oren, their captain, in a gold helm with a crimson plume */
  const WARDEN_KEY = { k: k_, H: C('steel', 5), h: C('steel', 4), j: C('steel', 3), J: C('steel', 6), d: C('ink', 0), e: C('cyan', 6), P: C('snow', 7), p: C('hush', 4),
    A: C('steel', 4), a: C('steel', 3), b: C('steel', 2), T: C('indigo', 3), t: C('indigo', 2), G: C('gold', 4), g: C('gold', 5), s: C('tan', 4) };
  const WARDEN = {
    key: WARDEN_KEY, iris: R.indigo, noFace: true,
    head: { ax: 11, ay: 23, eyeN: [15, 15], eyeF: [11, 15], mouth: [15, 19], browN: [14, 13], browF: [10, 13], rows: [
      '......................',
      '.....kkkk.............',
      '...kkPPPPkk...........',
      '..kPPPPpPPPk..........',
      '.kPPPppkkkkkkk........',
      '.kPPpkkJJJJHHhkk......',
      'kPPpkJJJHHHHHHhhk.....',
      'kPpkJJHHHHHHHHHhhk....',
      'kPpkJHHHHHHHHHHHhjk...',
      'kpkJHHHHHHHHHHHHhhjk..',
      '.kkHHHHHHHHHHHHHHhjk..',
      '..kHHHHHHHHHkkkkkkkk..',
      '..kHHHHHHHHkdddddddk..',
      '..kHHHHHHHHkddddeddek.',
      '..khHHHHHHHkkkkkkkkkk.',
      '..khhHHHHHHHHHHHHhhjk.',
      '..khhhHHHHHHHHHHhhjjk.',
      '..kjhhhHHHHHHHHhhjjk..',
      '...kjjhhhhhhhhhhjjk...',
      '....kkjjjjjjjjjjkk....',
      '......kGGGGGGGGk......',
      '......kGgggggggk......',
      '.......kkkkkkkk.......',
      '......................',
    ] },
    torso: { ax: 10, ay: 0, shN: [15, 3], shF: [4, 3], hip: [10, 16], rows: [
      '.......kssssk.......',
      '.....kAAAAAaabk.....',
      '...kAAAAAAAaaaabk...',
      '..kAAAGTTTTTttGbbk..',
      '.kAAAAGTTTTTttGabbk.',
      '.kAAAAGTTTTTttGabbk.',
      '.kaaaaGTTTTTttGbbbk.',
      '.kAAAAGTTTTTttGabbk.',
      '.kAAAAGTTTTTttGabbk.',
      '.kaaaaGTTTTTttGbbbk.',
      '.kAAAAGTTTTTttGabbk.',
      '.kAAAAGTTTTTttGabbk.',
      '.kggggggggggggggggk.',
      '.kGGGGGGGGGGGGGGGGk.',
      '.kAAAAGTTTTTttGabbk.',
      '.kaaaaGTTTTTttGbbbk.',
      '.kAAAAGTTTTTttGabbk.',
      '.kAAAAGTTTTTttGabbk.',
      '..kaaaGTTTTTttGbbk..',
      '..kAAAGTTTTTttGbbk..',
      '..kAAAGTTTTTttGbbk..',
      '..kaaaGTTTTTttGbbk..',
      '..kAAAGTTTTTttGbbk..',
      '..kbbbtttttttttbbk..',
      '..kkkkkkkkkkkkkkkk..',
    ] },
    body: { leg: 30, thigh: 15.5, shin: 15, legR: 2.3, arm1: 9, arm2: 8.5, armR: 2, pants: R.indigo, pantsB: 1, sleeve: R.steel, sleeveB: 3, skin: R.tan, boot: R.ink, cuff: R.indigo },
  };
  WARDEN.head.key = WARDEN.torso.key = WARDEN_KEY;
  const OREN_KEY = Object.assign({}, WARDEN_KEY, { H: C('gold', 5), h: C('gold', 4), j: C('gold', 3), J: C('gold', 6), P: C('crimson', 5), p: C('crimson', 3), e: C('fire', 6), T: C('ink', 3), t: C('ink', 2) });
  const OREN = Object.assign({}, WARDEN, { key: OREN_KEY, head: Object.assign({}, WARDEN.head, { key: OREN_KEY }), torso: Object.assign({}, WARDEN.torso, { key: OREN_KEY }), body: Object.assign({}, WARDEN.body, { pants: R.ink, cuff: R.gold }) });
  // a warden's spear: a long shaft and a leaf-shaped steel head with a red tassel; ang 0 points up
  function spearArt(hx, hy, ang, L, t) {
    const dx = Math.sin(ang), dy = -Math.cos(ang), nx = -dy, ny = dx;
    for (let u = -L * 0.35; u < L; u += 0.5) sp(hx + dx * u, hy + dy * u, C('wood', u % 3 < 1.5 ? 3 : 4), 2);
    for (let u = 0; u < 9; u += 0.5) { const w = u < 4 ? u / 4 * 1.6 : (9 - u) / 5 * 1.6; for (let q = -w; q <= w; q += 0.5) sp(hx + dx * (L + u) + nx * q, hy + dy * (L + u) + ny * q, C('steel', q < 0 ? 6 : 4), 2); }
    for (let k = 0; k < 5; k++) sp(hx + dx * (L - 1) - nx * (1 + k * 0.3) + Math.sin((t || 0) * 5 + k) * 0.4, hy + dy * (L - 1) - ny * 1 + k, C('crimson', 4), 2);
  }

  /* ================================================================ portraits: busts for close-ups */
  // A close-up never magnifies the small sprite: it uses a bust drawn at four times the face detail, built from
  // hand-placed shapes in sprite space (1 px = 1 sprite pixel), banded like hand shading, outlined like the sprites.
  // Coordinates: origin at the bottom centre of the bust, y up is negative, facing right.
  const band = (ramp, v) => ramp * 8 + clamp(Math.round(v), 0, 7);
  function sEll(cx, cy, rx, ry, fn, kind) {
    for (let y = fl(cy - ry) - 1; y <= cy + ry + 1; y++) for (let x = fl(cx - rx) - 1; x <= cx + rx + 1; x++) {
      const u = (x + 0.5 - cx) / rx, v = (y + 0.5 - cy) / ry; if (u * u + v * v > 1) continue;
      const c = typeof fn === 'number' ? fn : fn(x, y, u, v); if (c >= 0) sp(x, y, c, kind);
    }
  }
  function sPoly(pts, fn, kind) {
    let y0 = 1e9, y1 = -1e9; for (const p of pts) { y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
    for (let y = fl(y0); y <= Math.ceil(y1); y++) {
      const xs = [], yy = y + 0.5;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const a = pts[i], b = pts[j]; if ((a[1] > yy) !== (b[1] > yy)) xs.push(a[0] + (yy - a[1]) * (b[0] - a[0]) / (b[1] - a[1])); }
      xs.sort((a, b) => a - b);
      for (let q = 0; q + 1 < xs.length; q += 2) for (let x = Math.round(xs[q]); x < Math.round(xs[q + 1]); x++) { const c = typeof fn === 'number' ? fn : fn(x, y); if (c >= 0) sp(x, y, c, kind); }
    }
  }
  // a lock of hair as a tapering curve: from root (x0,y0) with a bend; w0 root half-width
  function sLock(x0, y0, x1, y1, bend, w0, ramp, base, hiK) {
    const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 1.6) + 2, nx = -(y1 - y0), ny = x1 - x0, nl = Math.hypot(nx, ny) || 1;
    for (let i = 0; i <= n; i++) {
      const u = i / n, b = Math.sin(u * PI) * bend, cx = lerp(x0, x1, u) + nx / nl * b, cy = lerp(y0, y1, u) + ny / nl * b, w = Math.max(0.35, w0 * (1 - u * 0.9));
      for (let q = -w; q <= w; q += 0.5) { const side = q / w, lit = side * (nx / nl * LIGHTS.x + ny / nl * LIGHTS.y); sp(cx + nx / nl * q, cy + ny / nl * q, band(ramp, base + (lit > 0.3 ? 1 : lit < -0.4 ? -1 : 0) + (hiK && Math.abs(u - 0.3) < 0.12 && side > -0.2 ? 2 : 0))); }
    }
  }
  const litOf = (u, v) => u * LIGHTS.x + v * LIGHTS.y;

  /* ---- shared portrait features: eyes, brows, mouths, at close-up size */
  // eyes: rows of an eye, x from its left; I iris, i iris dark, P pupil, o highlight, w white, k lash/lid, l lower lid, s skin
  const PEYE = {
    open: ['.kkkkkk.', 'kkiiPPkk', 'kwiPPoPw', '.wiPPPiw', '.wIIIIiw', '..lllll.'],
    wide: ['..kkkk..', '.kkkkkkk', 'kwiPPoPw', 'kwiPPPiw', 'kwIPPPiw', '.wIIIIiw', '..lllll.'],
    half: ['........', '........', 'kkkkkkkk', 'kwiPPPkk', '.wIIIIiw', '..lllll.'],
    narrow: ['........', '........', '.kkkkkk.', 'kkiPPPkk', '.wIIIiw.', '..llll..'],
    closed: ['........', '........', '........', '.kkkkkk.', '..k..k..', '........'],
    happy: ['........', '........', '..kkkk..', '.k....k.', 'k......k', '........'],
    sad: ['....kkk.', '..kkkkkk', 'kwiPPoPw', '.wiPPPiw', '.wIIIIiw', '..lllll.'],
    shut: ['........', '........', 'kkk..kkk', '..kkkk..', '.k.kk.k.', '........'],
  };
  const PBROW = { n: [[0, 0], [1, -1], [2, -1], [3, -1], [4, -1], [5, 0], [6, 0]], up: [[0, -1], [1, -2], [2, -2], [3, -2], [4, -2], [5, -1], [6, -1]], angry: [[0, -2], [1, -2], [2, -1], [3, -1], [4, 0], [5, 0], [6, 1]], worried: [[0, 1], [1, 0], [2, -1], [3, -1], [4, -2], [5, -2], [6, -2]] };
  // mouths: m dark mouth, t tongue, w teeth, n lip line
  const PMOUTH = {
    closed: ['nnnnn'], smile: ['n...n', '.nnn.'], grin: ['nwwwwwn', '.nmmmn.'], frown: ['.nnn.', 'n...n'],
    o1: ['.nnn.', 'nmmmn', '.nnn.'], o2: ['.nnnn.', 'nwwwwn', 'nmmmmn', '.nttn.'], o3: ['.nnnnn.', 'nwwwwwn', 'nmmmmmn', 'nmtttmn', '.nnnnn.'],
    ee1: ['nnnnnn', '.nmmn.'], ee2: ['.nnnnn.', 'nwwwwwn', '.nmmmn.'],
    scream: ['..nnnnn..', '.nwwwwwn.', 'nmmmmmmmn', 'nmmmmmmmn', 'nmmtttmmn', '.nmmmmmn.', '..nnnnn..'],
  };
  function pFace(P, F, x0, y0, ex1, ex2, mx, my, skinRamp, iris) {
    // F: eyes, brows, mouth (0..1 voice), smile, blush, tear; (ex1, ex2): near/far eye left edges; y0 eye top
    const E = PEYE[F.eyes || 'open'] || PEYE.open, key = { k: C('ink', 0), w: C('snow', 7), I: C(iris, 5), i: C(iris, 3), P: C('ink', 1), o: C('snow', 7), l: C(skinRamp, 4) };
    // gaze: look (sideways) and lookY (up < 0 < down) slide the iris inside the white, the lids staying put
    const look = Math.round(F.look || 0), lookY = Math.round(F.lookY || 0), shifting = (look || lookY) && E !== PEYE.closed && E !== PEYE.happy && E !== PEYE.shut, IRIS = 'PoiI';
    [ex1, ex2].forEach((ex, side) => {
      E.forEach((row, j) => { for (let i = 0; i < row.length; i++) { let ch = row[i]; if (ch === '.') continue; if (side === 1 && (i === 0 || i === row.length - 1) && ch !== 'k') continue;
        if (shifting && (IRIS.includes(ch) || ch === 'w')) { const sc = E[j - lookY] && E[j - lookY][i - look]; ch = sc && IRIS.includes(sc) ? sc : 'w'; }
        sp(x0 + ex + i, y0 + j, key[ch], ch === 'o' ? 3 : 1); } });
      // brows
      const B = PBROW[F.brows || 'n'] || PBROW.n;
      const bu = (F.eyes === 'wide' ? 1 : 0) + Math.round(F.browUp || 0); for (const [bx, by] of B) { if (side === 1 && bx === 6) continue; sp(x0 + ex + bx, y0 - 2 + by - bu, C('hair', 1)); sp(x0 + ex + bx, y0 - 3 + by - bu, C('hair', 2)); }
    });
    if (F.tear) { const ty = y0 + 6 + fl(frac((P.t || 0) * 0.6) * 8); sp(x0 + ex1 + 1, ty, C('sky', 6), 3); sp(x0 + ex1 + 1, ty + 1, C('sky', 5), 3); sp(x0 + ex1 + 1, y0 + 5, C('sky', 7), 3); }
    if (F.blush) for (const ex of [ex1, ex2]) for (let i = 1; i < 5; i++) if ((i + (ex & 1)) % 2 === 0 || F.blush > 0.7) sp(x0 + ex + i, y0 + 7, C('rose', 4));
    if (F.mask) {
      // the mask: a white porcelain plate from brow to lip, two slits, a crack that runs from the near slit to the jaw
      const mx0 = x0 + ex1 - 2, mx1 = x0 + ex2 + 9, my0 = y0 - 5, my1 = my + 1;
      for (let yy = my0; yy <= my1; yy++) for (let xx = mx0; xx <= mx1; xx++) {
        const edge = (yy - my0) < 1 || xx === mx0 || xx === mx1, cornerCut = (yy > my1 - 3 && (xx < mx0 + (yy - (my1 - 3)) * 2 || xx > mx1 - (yy - (my1 - 3)) * 2));
        if (cornerCut) continue;
        const slit = yy >= y0 + 2 && yy <= y0 + 3 && ((xx >= x0 + ex1 + 1 && xx <= x0 + ex1 + 6) || (xx >= x0 + ex2 + 1 && xx <= x0 + ex2 + 5));
        const cr = Math.abs(xx - (x0 + ex1 + 3) - (yy - y0 - 4) * 0.35) < 0.6 && yy > y0 + 3, cr2 = Math.abs(xx - (x0 + ex1 + 1) + (yy - y0 - 8) * 0.5) < 0.5 && yy > y0 + 7 && yy < y0 + 11;
        sp(xx, yy, slit ? (F.mask > 1 ? (yy === y0 + 2 ? C('fire', 6) : C('ember', 5)) : C('ink', 0)) : cr || cr2 ? C('ink', 1) : edge ? C('hush', 3) : C('snow', litOf((xx - mx0) / (mx1 - mx0) - 0.5, 0) > 0.1 ? 7 : 6), slit && F.mask > 1 ? 3 : 1);
      }
      return;
    }
    const m = F.mouth || 0, sm = F.smile || 0;
    const M = F.scream ? PMOUTH.scream : F.ee && m > 0.14 ? (m > 0.45 ? PMOUTH.ee2 : PMOUTH.ee1) : m > 0.72 ? PMOUTH.o3 : m > 0.42 ? PMOUTH.o2 : m > 0.14 ? PMOUTH.o1 : sm > 0.6 ? PMOUTH.grin : sm > 0.25 ? PMOUTH.smile : sm < -0.3 ? PMOUTH.frown : PMOUTH.closed;
    const mk = { n: C(skinRamp, 1), m: C('crimson', 1), t: C('crimson', 4), w: C('snow', 6) };
    M.forEach((row, j) => { for (let i = 0; i < row.length; i++) if (row[i] !== '.') sp(mx - fl(row.length / 2) + i, my + j - (M.length > 2 ? 1 : 0), mk[row[i]]); });
  }

  /* ---- Sable's bust */
  // hair is built from solid masses (a crown, a back curtain, a high ponytail, pointed bangs, two face-framing locks),
  // each with a darker strand line or two and a lit band where the light catches it
  function hairMass(pts, base, hi, strands) {
    let cx = 0, cy = 0; for (const p of pts) { cx += p[0] / pts.length; cy += p[1] / pts.length; }
    sPoly(pts, (x, y) => { const l = (x - cx) * LIGHTS.x * 0.18 + (y - cy) * LIGHTS.y * 0.18; let v = base + (l > 0.5 ? 1 : l < -0.6 ? -1 : 0); if (strands && strands(x, y)) v -= 1; if (hi && hi(x, y)) v += 2; return band(R.hair, v); });
  }
  function sableBust(P, t) {
    const F = P.face || {}, wind = P.wind || 0, sw = Math.sin(t * 1.9) * (0.7 + wind * 0.6), hy = (P.headY || 0), hx = (P.headX || 0), breathe = Math.sin(t * 2.2) > 0.4 ? -1 : 0;
    const HX = 4 + hx, HY = -43 + hy + breathe, s1 = Math.round(sw), TN = P.turn || 0, FX = HX + Math.round(TN * 2.5), OX = HX + Math.round(TN);
    // the ponytail: tied high at the back with a red cord, a thick tail falling and swaying behind
    hairMass([[HX - 10, HY - 16], [HX - 15, HY - 18], [HX - 22 + s1, HY - 10], [HX - 27 + s1 * 2 - wind * 3, HY + 6], [HX - 25 + s1 * 2 - wind * 3, HY + 22], [HX - 21 + s1, HY + 10], [HX - 16, HY - 6]], 1.6, (x, y) => Math.abs((x - (HX - 18)) + (y - HY) * 0.25) < 1 && y < HY + 6, (x, y) => Math.abs((x - (HX - 22)) + (y - HY) * 0.15 - s1) < 0.6);
    sEll(HX - 12, HY - 15, 3.2, 3.6, (x, y, u, v) => band(R.crimson, 4 + (litOf(u, v) > 0.2 ? 1 : litOf(u, v) < -0.3 ? -1 : 0)));
    sLock(HX - 13, HY - 13, HX - 18 + s1, HY - 4, 1, 0.8, R.crimson, 4, false);
    // the back curtain of hair behind the head, falling to the shoulders
    hairMass([[HX - 14, HY - 8], [HX - 4, HY - 15], [HX + 8, HY - 12], [HX + 13, HY], [HX + 12, HY + 15], [HX - 2, HY + 18], [HX - 16, HY + 17], [HX - 17, HY + 4]], 1.4, null, (x, y) => Math.abs(x - (HX - 9) + (y - HY) * 0.1) < 0.5 && y > HY);
    // shoulders: a sloped charcoal coat with a white crossed collar and a crimson cord at the throat
    sPoly([[-21, 0], [-20, -10], [-14, -18], [-4, -21], [11, -21], [19, -18], [24, -10], [25, 0]], (x, y) => { const u = x / 22, v = (y + 10) / 10, l = litOf(u, v); return band(R.ink, 3 + (l > 0.3 ? 1 : l < -0.35 ? -1 : 0) + (Math.abs(x - 3.5) < 0.6 && y > -12 ? -1.4 : 0) + (Math.abs(x + 12 - (y + 18) * 0.2) < 0.6 ? -1 : 0)); });
    sPoly([[-4, -21], [0, -21], [6, -9], [3, -8]], (x, y) => band(R.linen, 6 - (x < -1 ? 1 : 0)));
    sPoly([[12, -21], [8, -21], [3, -8], [6, -8]], (x, y) => band(R.linen, 5 - (x > 9 ? 1 : 0)));
    // neck, shadowed under the jaw
    sPoly([[HX - 5, HY + 9], [HX + 6, HY + 9], [HX + 5, -20], [HX - 5, -20]], (x, y) => band(R.tan, y < HY + 15 ? 3 : 4));
    // the face: an oval whose jaw narrows to a chin turned a little to her right (three-quarter view)
    sEll(OX, HY, 12.5, 14.5, (x, y, u, v) => {
      if (v > 0.05) { const uu = u - 0.18 * (v - 0.05), half = 1 - Math.pow((v - 0.05) / 0.95, 1.6) * 0.62; if (Math.abs(uu) > half) return -1; }
      const l = litOf(u, v * 0.8); let s = 5 + (l > 0.4 ? 1 : l < -0.45 ? -1 : 0);
      if (v > 0.74) s -= 1; if (v < -0.35) s -= 0.6;                // under the bangs, a little shade
      return band(R.tan, s);
    });
    sEll(HX - 11 + Math.round(TN * 1.5), HY + 2, 2.2, 3.4, (x, y, u, v) => band(R.tan, 4 + (u < 0 ? -1 : 0)));
    pFace(P, F, 0, HY - 1, FX - 9, FX + 2, FX + 3, HY + 9, R.tan, R.ember);
    sp(FX + 5, HY + 5, C('tan', 3)); sp(FX + 5, HY + 6, C('tan', 3)); sp(FX + 4, HY + 6, C('tan', 4));
    // the crown, a band of light across it
    sEll(HX - 1, HY - 8, 14, 9.5, (x, y, u, v) => (v > 0.25 ? -1 : band(R.hair, 2 + (Math.abs(Math.hypot(u + 0.2, v + 0.1) - 0.78) < 0.09 && v < 0.05 && u > -0.75 ? 2.5 : 0) + (litOf(u, v) > 0.5 ? 1 : litOf(u, v) < -0.5 ? -1 : 0))));
    // bangs: four pointed clusters swept toward her right, the tips catching light
    const B = [[-10, -5, 7, 2], [-5, -1, 11, 3], [1, 4, 10, 3], [7, 10, 8, 2]];
    const BX = HX + Math.round(TN * 1.6);
    for (const [a, b, len, sweep] of B) hairMass([[BX + a, HY - 11], [BX + b, HY - 11], [BX + b + sweep + s1 * 0.3, HY - 11 + len * 0.6], [BX + (a + b) / 2 + sweep + 1, HY - 11 + len], [BX + a + sweep * 0.4, HY - 11 + len * 0.5]], 2, (x, y) => y > HY - 11 + len * 0.55 && y < HY - 11 + len * 0.75 && x > BX + a + 1, (x, y) => Math.abs(x - (BX + (a + b) / 2) - (y - HY + 11) * 0.25) < 0.5);
    // the locks framing her face: a wide one in front of the ear, a thin one down the cheek
    hairMass([[HX - 13, HY - 8], [HX - 7, HY - 8], [HX - 7, HY + 6], [HX - 9, HY + 16], [HX - 11 + s1 * 0.5, HY + 18], [HX - 14, HY + 8]], 1.8, (x, y) => Math.abs(x - (HX - 9)) < 0.6 && y > HY - 4 && y < HY + 4, (x, y) => Math.abs(x - (HX - 11) - (y - HY) * 0.1) < 0.5);
    hairMass([[HX + 10, HY - 8], [HX + 13, HY - 6], [HX + 13, HY + 8], [HX + 12 + s1 * 0.4, HY + 13], [HX + 11, HY + 4]], 2);
    return { head: [HX, HY - 4], mouth: [FX + 3, HY + 9], chest: [2, -12], neck: [HX - 1, HY + 12] };
  }

  /* ---- Mira's bust: a round face in a peaked yellow hood, a brown fringe, red cheeks */
  function miraBust(P, t) {
    const F = P.face || {}, hy = (P.headY || 0), hx = (P.headX || 0), breathe = Math.sin(t * 2.6) > 0.3 ? -1 : 0;
    const HX = 2 + hx, HY = -33 + hy + breathe, TN = P.turn || 0, FX = HX + Math.round(TN * 2.5), OX = HX + Math.round(TN);
    const gold = (x, y, base) => { const l = litOf((x - HX) / 16, (y - HY) / 16); return band(R.gold, base + (l > 0.3 ? 1 : l < -0.4 ? -1 : 0)); };
    // the raincoat's shoulders, a placket and buttons
    sPoly([[-21, 0], [-19, -10], [-12, -16], [14, -16], [21, -10], [23, 0]], (x, y) => gold(x, y, 4.4));
    sPoly([[2, -16], [4, -16], [4, 0], [2, 0]], C('gold', 3));
    for (let k = 0; k < 3; k++) sEll(6, -11 + k * 5, 1.3, 1.3, (x, y, u, v) => band(R.linen, u + v < 0 ? 7 : 5));
    // the hood: rounded with a soft peak, draping onto the shoulders, its seam down the middle
    sPoly([[HX - 17, HY + 14], [HX - 18, HY - 2], [HX - 13, HY - 14], [HX - 2, HY - 21], [HX + 4, HY - 22], [HX + 13, HY - 15], [HX + 18, HY - 3], [HX + 17, HY + 14], [HX + 10, HY + 18], [HX - 10, HY + 18]], (x, y) => gold(x, y, 4.2) - (Math.abs(x - HX - 2 + (y - HY) * 0.15) < 0.5 && y < HY - 12 ? 1 : 0));
    // face
    sEll(OX, HY, 11.5, 12, (x, y, u, v) => {
      if (v > 0.3) { const uu = u - 0.1 * v, half = 1 - Math.pow((v - 0.3) / 0.7, 2) * 0.35; if (Math.abs(uu) > half) return -1; }
      const l = litOf(u, v * 0.8); return band(R.skin, 5 + (l > 0.38 ? 1 : l < -0.45 ? -1 : 0) - (v > 0.78 ? 1 : 0));
    });
    pFace(P, F, 0, HY - 1, FX - 8, FX + 2, FX + 2, HY + 7, R.skin, R.wood);
    sp(FX + 4, HY + 4, C('skin', 3));
    if (F.blush === undefined || F.blush) for (const bx of [FX - 7, FX + 4]) { sp(bx, HY + 5, C('rose', 4)); sp(bx + 2, HY + 5, C('rose', 4)); sp(bx + 1, HY + 6, C('rose', 4)); }
    // the fringe
    const BX = HX + Math.round(TN * 1.5);
    sEll(BX - 1, HY - 8, 12, 6, (x, y, u, v) => (v > 0.3 ? -1 : band(R.wood, 2.4 + (litOf(u, v) > 0.3 ? 1 : 0) + (Math.abs(v + 0.4) < 0.15 && u > -0.3 && u < 0.4 ? 1.5 : 0))));
    for (const [bx, len] of [[-8, 4], [-4, 6], [0, 5], [4, 6], [8, 4]]) sLock(BX + bx, HY - 9, BX + bx + 1 + Math.round(P.fringe || 0), HY - 9 + len, 0.4, 2, R.wood, 2.4, false);
    // the hood's opening: a thick rolled rim, lit on top
    sEll(HX - 0.5, HY - 1, 15, 15, (x, y, u, v) => { const r = Math.hypot((u - 0.03) / 0.82, (v + 0.02) / 0.85); if (r < 1 || r > 1.18) return -1; return band(R.gold, 5.4 + (litOf(u, v) > 0.25 ? 1 : litOf(u, v) < -0.4 ? -1.4 : 0) + (r > 1.12 ? -1 : 0)); });
    // the drawstrings, swinging a little
    const ds = Math.sin(t * 3) * 0.6;
    const dsw = P.strings === undefined ? ds : P.strings;
    sLock(HX - 6, HY + 13, HX - 7 + dsw, HY + 20, 0, 0.6, R.linen, 5, false); sLock(HX + 8, HY + 13, HX + 8 + dsw, HY + 19, 0, 0.6, R.linen, 5, false);
    // her hands, when she talks with them: raincoat sleeves and small hands
    for (const h of P.hands || []) bustHand(h, R.gold, 4, R.skin);
    return { head: [HX, HY - 4], mouth: [FX + 2, HY + 7], chest: [2, -8], neck: [HX, HY + 11] };
  }
  const BUSTS = { sable: sableBust, mira: miraBust };
  // draw a bust into the frame: bottom centre at (x, y), whole-pixel scale S, facing f; o as for stamp
  function bust(who, P, x, y, S, f, o) {
    LIGHTS.x = LIGHT.x * (f < 0 ? -1 : 1); LIGHTS.y = LIGHT.y;
    sclear(); const r = BUSTS[who](P, P.t || 0); if (P.tilt && r.neck) sprTilt(r.neck[0], r.neck[1], P.tilt); soutline(ENV.edge);
    stamp(x, y, S, f < 0, (P.sx && P.sx !== 1) || (P.sy && P.sy !== 1) ? Object.assign({ sx: P.sx, sy: P.sy, piv: 0 }, o || {}) : o);
    const L = (q) => [x + (f < 0 ? -q[0] - 0.5 : q[0] + 0.5) * S, y + q[1] * S];
    return { head: L(r.head), mouth: L(r.mouth), chest: L(r.chest) };
  }

  /* ================================================================ animation: keys, timing, acting */
  // A character's drawings change on twos (15 a second), the way pixel animation is timed; the camera, the weather
  // and the light keep running on ones, so the world stays smooth while the acting reads as drawn poses.
  const ON2 = (t) => fl(t * 15 + 1e-6) / 15;
  // how a key is arrived at from the one before it
  const EASE = {
    lin: (u) => u, io: (u) => eio(u), out: (u) => eoc(u), in: (u) => u * u * u,
    back: (u) => { const c = 2.2; u -= 1; return 1 + u * u * ((c + 1) * u + c); },       // overshoot, then settle
    snap: (u) => (u < 0.5 ? 0 : 1), hold: () => 0,
  };
  // blend two pose values of the same shape: numbers, arrays, objects; anything else switches halfway
  function mix(a, b, u) {
    if (typeof a === 'number' && typeof b === 'number') return a + (b - a) * u;
    if (Array.isArray(a) && Array.isArray(b)) return a.map((x, i) => mix(x, b[i], u));
    if (a && b && typeof a === 'object' && typeof b === 'object') { const o = {}; for (const k in a) o[k] = k in b ? mix(a[k], b[k], u) : a[k]; for (const k in b) if (!(k in o)) o[k] = b[k]; return o; }
    return u < 0.5 ? a : b;
  }
  // a keyed value: K = [[t, value, ease], ...]; the ease is how the value travels into that key
  function key(K, t) {
    if (t <= K[0][0]) return K[0][1];
    for (let i = 1; i < K.length; i++) if (t < K[i][0]) { const [t0, a] = K[i - 1], [t1, b, e] = K[i]; return mix(a, b, EASE[e || 'io']((t - t0) / (t1 - t0))); }
    return K[K.length - 1][1];
  }
  // the stressed syllables of a speaker's lines (where the voice jumps up), and a pulse that hits on each
  const ACC = {};
  function accentsOf(who) {
    if (ACC[who]) return ACC[who];
    const out = []; for (const l of DLG) if (l.who === who) { let low = true; for (let f = 0; f < l.env.length; f++) { const v = l.env.charCodeAt(f) - 48; if (low && v >= 6) { out.push([l.t0 + f / 30, v / 9]); low = false; } if (v <= 3) low = true; } }
    return (ACC[who] = out);
  }
  function accent(who, t) { let a = 0; for (const [ta, s] of accentsOf(who)) { const d = t - ta; if (d > -0.05 && d < 0.5) a = Math.max(a, s * (d < 0.05 ? (d + 0.05) / 0.1 : Math.exp(-(d - 0.05) * 7))); } return a; }
  const syllable = (who, t) => { let n = 0; for (const [ta] of accentsOf(who)) if (ta <= t) n++; return n; };
  // a natural blink: lids half, shut, shut, half (about a ninth of a second), every few seconds
  function blinkK(t, seed, every) {
    const P = (every || 3.2) + ih(seed, 1, 17) * 1.6, ph = ((t + ih(seed, 2, 17) * P) % P) * 30;
    return ph < 1 ? 'half' : ph < 3 ? 'closed' : ph < 4 ? 'half' : null;
  }
  // little darts of the eyes: a held offset that jumps every so often
  function gaze(t, seed, amp) { const k = fl(t / 0.9 + ih(seed, 3, 18)), j = ih(k, seed, 19); return j < 0.55 ? 0 : Math.round((ih(k, seed, 20) - 0.5) * 2 * (amp || 1)); }
  // a pendulum hanging from a point that moves (x(tt), frame px): returns its swing angle at t, simulated from t0
  function pendulum(xf, t0, t, len, damp) {
    let a = 0, w = 0; const dt = 1 / 120, L = len || 8, g = 260, d = damp || 3;
    let x0 = xf(t0 - 2 * dt), x1 = xf(t0 - dt);
    for (let tt = t0; tt < t; tt += dt) { const x2 = xf(tt), acc = (x2 - 2 * x1 + x0) / (dt * dt); x0 = x1; x1 = x2; w += (-(g / L) * Math.sin(a) - d * w - acc / L) * dt; a += w * dt; }
    return a;
  }
  // a spring that chases a moving target (overlap and follow-through): value at t, simulated from t0
  function springTo(f, t0, t, k, z) {
    let x = f(t0), v = 0; const dt = 1 / 120, K = k || 180, Z = z || 14;
    for (let tt = t0; tt < t; tt += dt) { v += (K * (f(tt) - x) - Z * v) * dt; x += v * dt; }
    return x;
  }

  // ---------------------------------------------------------------- the head on its neck (busts)
  // Tilt the head in the sprite canvas before it is outlined: every pixel above the neck turns about it, the turn
  // fading in over the first rows so the neck bends instead of tearing. ang > 0 nods forward, < 0 lifts the chin.
  const STP = new Int16Array(SW * SH), STK = new Uint8Array(SW * SH);
  function sprTilt(nx, ny, ang) {
    if (Math.abs(ang) < 0.005) return;
    STP.set(SPR); STK.set(SPK);
    const PX = nx + SOX, PY = ny + SOY, y0 = Math.max(0, SBB[1] - 6), x0 = Math.max(0, SBB[0] - 6), x1 = Math.min(SW - 1, SBB[2] + 6), yE = Math.min(SH - 1, PY + 2);
    for (let Y = y0; Y <= yE; Y++) {
      const a = ang * sstep(0, 9, PY + 2 - Y), ca = Math.cos(a), sa = Math.sin(a);
      for (let X = x0; X <= x1; X++) {
        const dx = X + 0.5 - PX, dy = Y + 0.5 - PY, sx = fl(PX + dx * ca + dy * sa), sy = fl(PY - dx * sa + dy * ca), i = Y * SW + X;
        if (sx < 0 || sy < 0 || sx >= SW || sy >= SH || sy > yE) { if (Y < PY - 2) { SPR[i] = -1; SPK[i] = 0; } continue; }
        const j = sy * SW + sx; SPR[i] = STP[j]; SPK[i] = STK[j];
      }
    }
    SBB[0] = x0; SBB[1] = y0; SBB[2] = x1;
  }
  // a hand in a close-up, in bust sprite space: a sleeve from `from` to the wrist `at`, and the hand beyond it, lit;
  // pose: 'point' (index out), 'open' (fingers spread), 'fist', 'flat' (palm down, for a pat)
  function bustHand(h, sleeve, sleeveB, skin) {
    const [ax, ay] = h.from, [bx, by] = h.at, dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 1, ux = h.dir ? h.dir[0] : dx / L, uy = h.dir ? h.dir[1] : dy / L;
    limb(ax, ay, bx, by, h.r0 || 4.4, h.r1 || 3.4, sleeve, sleeveB);
    sEll(bx, by, 3.6, 3.6, (x, y, u, v) => band(sleeve, sleeveB + 1 + (litOf(u, v) > 0.3 ? 1 : 0) - (u * ux + v * uy > 0.5 ? 1 : 0)));
    const hx = bx + ux * 4, hy = by + uy * 4, s = (u, v, base) => band(skin, base + (litOf(u, v) > 0.3 ? 1 : litOf(u, v) < -0.4 ? -1 : 0));
    if (h.pose === 'point') {
      sEll(hx, hy, 3, 2.8, (x, y, u, v) => s(u, v, 4.6));
      for (let q = 0; q < 7; q++) { sp(hx + ux * (2 + q), hy + uy * (2 + q), band(skin, 5 + (q > 4 ? 1 : 0))); sp(hx + ux * (2 + q) + uy * 0.9, hy + uy * (2 + q) - ux * 0.9, band(skin, 4)); }
      sp(hx - uy * 2.4 + ux, hy + ux * 2.4 + uy, band(skin, 4)); sp(hx - uy * 2.4 + ux * 2, hy + ux * 2.4 + uy * 2, band(skin, 4));
    } else if (h.pose === 'open' || h.pose === 'flat') {
      sEll(hx, hy, 3.4, 3.2, (x, y, u, v) => s(u, v, 4.8));
      const spread = h.pose === 'open' ? 0.32 : 0.12;
      for (let f = -1.5; f <= 1.5; f++) { const a = Math.atan2(uy, ux) + f * spread, cx = Math.cos(a), cy = Math.sin(a), n = f === -1.5 || f === 1.5 ? 4 : 5; for (let q = 0; q < n; q++) sp(hx + cx * (3 + q) - uy * f * 0.9, hy + cy * (3 + q) + ux * f * 0.9, band(skin, 5 - (q === n - 1 ? 0 : 0) + (f < 0 ? 0 : -1))); }
    } else sEll(hx, hy, 3.4, 3.4, (x, y, u, v) => s(u, v, 4.6) - (Math.abs((u * -uy + v * ux) * 3.4 % 1.7) < 0.3 && u * ux + v * uy > 0.2 ? 1 : 0));
  }

  /* ================================================================ Act One (a) cast additions: Oren's bust */
  // Oren in close-up: a gold helm with a crimson plume and a visor slit that glows as he speaks; gold pauldrons over
  // indigo lamellar; a crimson cloak behind
  BUSTS.oren = function (P, t) {
    const F = P.face || {}, m = F.mouth || 0, breathe = Math.sin(t * 2) > 0.5 ? -1 : 0, HX = 3 + (P.headX || 0), HY = -42 + (P.headY || 0) + breathe;
    const gold = (u, v, base) => band(R.gold, base + (litOf(u, v) > 0.3 ? 1 : litOf(u, v) < -0.35 ? -1 : 0));
    // the cloak and the plume behind
    sPoly([[-26, 0], [-24, -16], [26, -16], [28, 0]], (x, y) => band(R.crimson, 2.4 + (frac(x / 7) < 0.2 ? -0.8 : 0)));
    for (let k = 0; k < 7; k++) { const sw = Math.sin(t * 2 + k * 0.6) * 1.2; sLock(HX - 2 + k * 0.8, HY - 15 - k * 0.4, HX - 14 - k * 1.5 + sw, HY - 6 + k * 2.4, -2, 2.6 - k * 0.15, R.crimson, 4 + (k % 2), k === 1); }
    // the lamellar body and the gorget
    sPoly([[-20, 0], [-19, -14], [-11, -20], [15, -20], [22, -14], [24, 0]], (x, y) => { const row = ((y + 40) % 4) < 1; return band(R.indigo, 3 + (row ? -1 : 0) + (litOf(x / 22, (y + 10) / 10) > 0.3 ? 1 : 0)); });
    for (let k = 0; k < 6; k++) sPoly([[-3 + k, -20], [-2 + k, -20], [-2 + k, 0], [-3 + k, 0]], k === 0 || k === 5 ? C('gold', 4) : C('indigo', 2));
    // pauldrons: three gold lames each side
    for (const side of [-1, 1]) for (let k = 0; k < 3; k++) sEll(side * 15 + 2, -16 + k * 4, 9 - k, 4, (x, y, u, v) => gold(u * side, v, 4.4 - k * 0.4));
    sEll(HX, HY + 13, 10, 4, (x, y, u, v) => gold(u, v, 3.6));
    // the helm: a rounded dome, a brow ridge, cheek guards, the visor slit
    sEll(HX, HY, 13, 14, (x, y, u, v) => {
      if (v > 0.6 && Math.abs(u) < 0.28) return -1;                                   // the open chin
      let s = 4.6 + (litOf(u, v) > 0.35 ? 1.2 : litOf(u, v) < -0.4 ? -1.2 : 0);
      if (Math.abs(v + 0.18) < 0.07) s -= 1.6;                                         // the brow ridge
      if (Math.abs(u) < 0.06 && v < -0.2) s += 1.4;                                    // a raised crest line
      return band(R.gold, s);
    });
    // the visor: a dark slit across the eyes, burning with his voice
    const glowC = m > 0.3 ? C('fire', 7) : m > 0.08 ? C('fire', 6) : C('fire', 5);
    for (let x = HX - 10; x <= HX + 10; x++) { sp(x, HY - 1, C('ink', 0)); sp(x, HY, C('ink', 0)); sp(x, HY + 1, C('ink', 1)); }
    for (const ex of [HX - 6, HX + 3]) for (let k = 0; k < 4; k++) sp(ex + k, HY, glowC, 3);
    // rivets
    for (const [rx, ry] of [[-9, 6], [9, 6], [-11, 1], [11, 1]]) sp(HX + rx, HY + ry, C('gold', 7));
    return { head: [HX, HY - 4], mouth: [HX, HY + 8], chest: [2, -10] };
  };
  // Kaira in close-up: silver hair swept back off her face and streaming behind in the wind, an indigo headband with a
  // gold stone, a gold courier's mark under her near eye, gold eyes; a high-collared indigo jacket, a satchel strap
  BUSTS.kaira = function (P, t) {
    const F = P.face || {}, wind = P.wind === undefined ? 1 : P.wind, breathe = Math.sin(t * 2.4) > 0.4 ? -1 : 0;
    const HX = 3 + (P.headX || 0), HY = -40 + (P.headY || 0) + breathe, sw = (k) => Math.round(Math.sin(t * (3 + wind) - k * 0.7) * (0.6 + wind * 0.5));
    const silver = (x, y, base, cx, cy) => { const l = (x - cx) * LIGHTS.x * 0.16 + (y - cy) * LIGHTS.y * 0.16; return band(R.hush, base + (l > 0.5 ? 1 : l < -0.6 ? -1 : 0)); };
    // the streaming hair behind: long tapering locks pulled back by the wind, darker underneath
    for (let k = 0; k < 7; k++) { const y0 = HY - 12 + k * 3.6, len = 14 + wind * 7 + (k % 3) * 4; sLock(HX - 8, y0, HX - 8 - len + sw(k), y0 + 4 + k * 0.8 + sw(k + 2), -1.5 + (k % 2) * 3, 3.2 - k * 0.15, R.hush, k > 3 ? 3 : 4, k === 1 || k === 4); }
    // the jacket: indigo, a high standing collar edged in gold, a seam, the satchel's linen strap across the chest
    sPoly([[-22, 0], [-21, -10], [-14, -18], [-4, -21], [12, -21], [20, -18], [24, -10], [25, 0]], (x, y) => { const l = litOf(x / 22, (y + 10) / 10); return band(R.indigo, 3 + (l > 0.3 ? 1 : l < -0.35 ? -1 : 0) + (Math.abs(x - 4) < 0.6 && y > -14 ? -1.4 : 0)); });
    sPoly([[-17, -16], [-13, -19], [20, 0], [14, 0]], (x, y) => band(R.linen, 4.6 + (litOf(x / 20, 0) > 0.2 ? 1 : 0) - ((x + y * 0.6) % 5 < 0.8 ? 1 : 0)));
    sEll(-6, -12, 2, 2, (x, y, u, v) => band(R.gold, u + v < 0 ? 6 : 4));
    sPoly([[HX - 9, -19], [HX - 7, -26], [HX + 9, -26], [HX + 11, -19]], (x, y) => band(R.indigo, y < -24 ? 5 : 4 - (x < HX ? 1 : 0)));
    sPoly([[HX - 9, -19], [HX + 11, -19], [HX + 11, -18], [HX - 9, -18]], C('gold', 5));
    // the neck
    sPoly([[HX - 5, HY + 9], [HX + 6, HY + 9], [HX + 5, -25], [HX - 5, -25]], (x, y) => band(R.skin, y < HY + 15 ? 3 : 4));
    // the face: a narrow three-quarter oval with a pointed chin
    sEll(HX, HY, 12, 14.5, (x, y, u, v) => {
      if (v > 0.05) { const uu = u - 0.2 * (v - 0.05), half = 1 - Math.pow((v - 0.05) / 0.95, 1.5) * 0.66; if (Math.abs(uu) > half) return -1; }
      const l = litOf(u, v * 0.8); let s = 5 + (l > 0.4 ? 1 : l < -0.45 ? -1 : 0); if (v > 0.74) s -= 1; return band(R.skin, s);
    });
    sEll(HX - 11, HY + 2, 2.2, 3.4, (x, y, u, v) => band(R.skin, 4 + (u < 0 ? -1 : 0)));
    pFace(P, F, 0, HY - 1, HX - 9, HX + 2, HX + 3, HY + 9, R.skin, R.gold);
    sp(HX + 5, HY + 5, C('skin', 3)); sp(HX + 5, HY + 6, C('skin', 3));
    // the courier's mark: a small gold chevron under the near eye
    for (const [mx, my] of [[-7, 7], [-6, 8], [-5, 7], [-7, 8]]) sp(HX + mx, HY + my, C('gold', 6), 3);
    // the hair over the crown: swept straight back, lit along its waves
    sPoly([[HX - 14, HY - 2], [HX - 13, HY - 12], [HX - 4, HY - 17], [HX + 7, HY - 16], [HX + 13, HY - 9], [HX + 12, HY - 6], [HX - 6, HY - 7], [HX - 11, HY + 4]], (x, y) => silver(x, y, 4 + (Math.abs(((x - HX) * 0.7 + (y - HY)) % 4) < 0.7 ? -1 : 0) + (Math.abs(y - (HY - 13) + (x - HX) * 0.15) < 0.8 && x > HX - 8 ? 2 : 0), HX, HY - 10));
    // the headband: indigo, a gold stone at the front, its tails flying back
    sPoly([[HX - 13, HY - 6], [HX + 12, HY - 8], [HX + 12.5, HY - 5], [HX - 12, HY - 2]], (x, y) => band(R.indigo, 4 + (y < HY - 6 ? 1 : 0) + (litOf((x - HX) / 12, 0) > 0.3 ? 1 : 0)));
    sEll(HX + 4, HY - 6, 2, 2, (x, y, u, v) => band(R.gold, u + v < -0.3 ? 7 : 5), 3);
    for (const d of [0, 2.4]) sLock(HX - 13, HY - 4 + d, HX - 24 - wind * 4 + sw(5 + d), HY - 1 + d * 2 + sw(7), 1.2, 1.4, R.indigo, 4, false);
    // two loose locks that the wind pulls forward over her brow and down the cheek
    sLock(HX + 4, HY - 8, HX + 11, HY - 1 + sw(3) * 0.5, 1.2, 1.3, R.hush, 5, true);
    hairMass_k(HX, HY);
    return { head: [HX, HY - 4], mouth: [HX + 3, HY + 9], chest: [2, -12] };
  };
  function hairMass_k(HX, HY) { sPoly([[HX - 14, HY - 5], [HX - 9, HY - 4], [HX - 8, HY + 3], [HX - 10, HY + 9], [HX - 13, HY + 4]], (x, y) => band(R.hush, 4 + (x > HX - 10 ? 1 : 0) - (Math.abs(x - (HX - 11) - (y - HY) * 0.2) < 0.5 ? 1 : 0))); }

  /* ================================================================ Act One (b) cast: the harbour — the dockhand, the Hollow,
  // the Bellwether, Vesper, Tamo's anchor, Tamo's bust, and the drawing helpers they need. Everything lives in HB. */
  const HB = {};
  {
    /* ---------------------------------------------------------------- a frame-sized layer: draw big things with the core
    // primitives (fillPoly, fillEll, capsule, ribbon, line all go through TGT), then outline and composite them like a sprite */
    const LYR = new Int16Array(NP).fill(-1), LYK = new Uint8Array(NP), LBB = [W, H, -1, -1];
    const LTGT = { kind: 1, put(x, y, c) { const i = y * W + x; LYR[i] = c; LYK[i] = LTGT.kind; if (x < LBB[0]) LBB[0] = x; if (y < LBB[1]) LBB[1] = y; if (x > LBB[2]) LBB[2] = x; if (y > LBB[3]) LBB[3] = y; } };
    function lyBegin() {
      if (LBB[2] >= 0) for (let y = Math.max(0, LBB[1] - 1); y <= Math.min(H - 1, LBB[3] + 1); y++) { LYR.fill(-1, y * W + Math.max(0, LBB[0] - 1), y * W + Math.min(W, LBB[2] + 2)); LYK.fill(0, y * W + Math.max(0, LBB[0] - 1), y * W + Math.min(W, LBB[2] + 2)); }
      LBB[0] = W; LBB[1] = H; LBB[2] = -1; LBB[3] = -1; TGT = LTGT; LTGT.kind = 1;
    }
    const lk = (k) => { LTGT.kind = k; };
    // o: edge (rim colour on the lit side), outline (false: none), glitch (0..1), seed, t, alpha, color, white, fx(c,x,y,kind), dx
    function lyEnd(o) {
      TGT = FRAME; o = o || {}; if (LBB[2] < 0) return;
      const x0 = Math.max(1, LBB[0] - 1), x1 = Math.min(W - 2, LBB[2] + 1), y0 = Math.max(1, LBB[1] - 1), y1 = Math.min(H - 2, LBB[3] + 1);
      if (o.outline !== false) for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const i = y * W + x; if (LYR[i] >= 0) continue;
        let src = -1, dx = 0, dy = 0;
        for (const [j, ox, oy] of [[i - 1, -1, 0], [i + 1, 1, 0], [i - W, 0, -1], [i + W, 0, 1]]) if (LYR[j] >= 0 && LYK[j] !== 3 && LYK[j] !== 4) { src = LYR[j]; dx = ox; dy = oy; break; }
        if (src < 0) continue;
        const lit = -(dx * LIGHT.x + dy * LIGHT.y) > 0.4;
        LYR[i] = lit && o.edge !== undefined && o.edge !== null ? o.edge : (src >> 3) * 8 + (lit ? 1 : 0); LYK[i] = 4;
        if (x < LBB[0]) LBB[0] = x; if (y < LBB[1]) LBB[1] = y; if (x > LBB[2]) LBB[2] = x; if (y > LBB[3]) LBB[3] = y;
      }
      const g = o.glitch || 0, t = o.t || 0, seed = o.seed || 1, sdx = o.dx || 0;
      for (let y = LBB[1]; y <= LBB[3]; y++) {
        let sh = sdx; if (g > 0) { const band_ = fl(y / 3), r = ih(band_, fl(t * 18), seed); if (r < g * 0.45) sh += Math.round((ih(band_, fl(t * 18), seed + 1) - 0.5) * (4 + g * 14)); }
        for (let x = LBB[0]; x <= LBB[2]; x++) {
          const i = y * W + x; let c = LYR[i]; if (c < 0) continue;
          const X = x + sh; if (X < 0 || X >= W) continue;
          if (o.alpha !== undefined && bay(X, y) >= o.alpha) continue;
          if (o.color !== undefined && LYK[i] !== 3) c = o.color; else if (o.white) c = LYK[i] === 4 ? C('hush', 3) : WHITE;
          if (o.fx) { c = o.fx(c, X, y, LYK[i]); if (c < 0) continue; }
          if (g > 0 && ih(X >> 1, y, fl(t * 24) + seed) < g * 0.05) c = ih(X, y, 5) < 0.7 ? WHITE : C('crimson', 5);
          BUF[y * W + X] = c;
        }
      }
    }
    HB.lyBegin = lyBegin; HB.lyEnd = lyEnd; HB.lk = lk;

    /* ---------------------------------------------------------------- the sprite canvas as a target, so the core primitives draw into it
    // (coordinates in sprite space, offset by (240, 135) so put()'s frame clip doesn't cut them) */
    const SO = [240, 135];
    const STGT = { kind: 1, put(x, y, c) { sp(x - SO[0], y - SO[1], c, STGT.kind); } };
    HB.toSprite = () => { TGT = STGT; STGT.kind = 2; };
    HB.toFrame = () => { TGT = FRAME; };

    /* ---------------------------------------------------------------- stamping a rigged sprite turned (tumbling, lying) or glitched
    // pivot (px, py) in the sprite's own coordinates (feet at 0, 0) lands at (x, y); rot radians clockwise on screen */
    function stampEx(x, y, S, flip, o) {
      o = o || {}; S = S || 1;
      const rot = o.rot || 0, pvx = flip ? -(o.px || 0) : (o.px || 0), pvy = o.py || 0, ca = Math.cos(rot), sa = Math.sin(rot);
      let mnx = 1e9, mny = 1e9, mxx = -1e9, mxy = -1e9;
      for (const i of [SBB[0] - SOX, SBB[2] + 1 - SOX]) for (const j of [SBB[1] - SOY, SBB[3] + 1 - SOY]) {
        const lx = (flip ? -i : i) - pvx, ly = j - pvy, X = x + (lx * ca - ly * sa) * S, Y = y + (lx * sa + ly * ca) * S;
        mnx = Math.min(mnx, X); mny = Math.min(mny, Y); mxx = Math.max(mxx, X); mxy = Math.max(mxy, Y);
      }
      const g = o.glitch || 0, t = o.t || 0;
      for (let Y = Math.max(0, fl(mny) - 1); Y <= Math.min(H - 1, Math.ceil(mxy) + 1); Y++) {
        let sh = 0; if (g > 0) { const b = fl(Y / 3); if (ih(b, fl(t * 18), 7) < g * 0.45) sh = Math.round((ih(b, fl(t * 18), 8) - 0.5) * (4 + g * 12)); }
        for (let X = Math.max(0, fl(mnx) - 1); X <= Math.min(W - 1, Math.ceil(mxx) + 1); X++) {
          const dx = (X + 0.5 - sh - x) / S, dy = (Y + 0.5 - y) / S, lx = dx * ca + dy * sa + pvx, ly = -dx * sa + dy * ca + pvy;
          const ox = fl(lx), oy = fl(ly), i = flip ? -ox - 1 + SOX : ox + SOX, j = oy + SOY;
          if (i < 0 || j < 0 || i >= SW || j >= SH) continue;
          const k = j * SW + i; let c = SPR[k]; if (c < 0) continue;
          if (o.alpha !== undefined && bay(X, Y) >= o.alpha) continue;
          if (o.color !== undefined && SPK[k] !== 3) c = o.color; else if (o.white) c = SPK[k] === 4 ? C('hush', 3) : WHITE;
          if (o.fx) { c = o.fx(c, X, Y, SPK[k]); if (c < 0) continue; }
          if (g > 0 && ih(X >> 1, Y, fl(t * 24)) < g * 0.06) c = ih(X, Y, 5) < 0.7 ? WHITE : C('crimson', 5);
          BUF[Y * W + X] = c;
        }
      }
    }
    // an actor, turned: like actor(), but with o.rot about o.px/o.py (sprite coords) landing at (x, y)
    function actorEx(CH, P, x, y, f, o) {
      if (HB.IMPC !== undefined || HB.IMP) o = Object.assign({}, o || {}, { color: HB.IMPC !== undefined ? HB.IMPC : C('ink', 0) });
      LIGHTS.x = LIGHT.x * (f < 0 ? -1 : 1); LIGHTS.y = LIGHT.y;
      // the light as the sprite sees it, turned back by the rotation so the rim stays on the lit side
      const rot = (o && o.rot) || 0; if (rot) { const lx = LIGHTS.x, ly = LIGHTS.y, a = f < 0 ? rot : -rot; LIGHTS.x = lx * Math.cos(a) - ly * Math.sin(a); LIGHTS.y = lx * Math.sin(a) + ly * Math.cos(a); }
      const r = rig(CH, P, P.t || 0); soutline(ENV.edge); stampEx(x, y, 1, f < 0, o);
      const pvx = (o && o.px) || 0, pvy = (o && o.py) || 0, ca = Math.cos(rot), sa = Math.sin(rot);
      const L = (q) => { const lx = (f < 0 ? -(q[0] - pvx) : q[0] - pvx), ly = q[1] - pvy; return [x + lx * ca - ly * sa, y + lx * sa + ly * ca]; };
      return { head: L(r.head), handN: L(r.handN), handF: L(r.handF), chest: L(r.chest), neck: L(r.neck) };
    }
    HB.stampEx = stampEx; HB.actorEx = actorEx;

    /* ---------------------------------------------------------------- the dockhand: old, gruff, a grey beard, a wool cap, a pipe */
    const DOCK_KEY = {
      k: k_, C: C('olive', 2), c: C('olive', 1), b: C('earth', 1), V: C('olive', 3), s: C('skin', 4), S: C('skin', 3), n: C('skin', 2), e: C('skin', 3), r: C('rose', 3),
      G: C('stone', 5), g: C('stone', 4), q: C('stone', 3), Q: C('stone', 6), H: C('stone', 6),
      J: C('rust', 3), j: C('rust', 2), A: C('earth', 4), a: C('earth', 3), B: C('bronze', 5), R: C('linen', 3),
    };
    const DOCKHAND = {
      key: DOCK_KEY, iris: R.sky,
      head: { ax: 11, ay: 23, eyeN: [15, 12], eyeF: [10, 12], mouth: [15, 18], browN: [14, 11], browF: [9, 11], rows: [
        '......................',
        '.......kkkkkkkk.......',
        '.....kkCCCCCCCCkk.....',
        '....kCCCCVCCCCCCCk....',
        '...kcCCCCCVCCCCCCCk...',
        '...kcCCCCCCCCCCCCCCk..',
        '..kccCCCCCCCCCCCCCCCkk',
        '..kcccccccccccbbbbbbbk',
        '..kGkkkkkkkkkkkkkkkkk.',
        '..kGGQkSSsssssssssssk.',
        '..kGGkSsssssssssssssk.',
        '..kGGeSssssssssssssssk',
        '..kGeeSssssssssssssssk',
        '..kGGeSsssssssssssrnsk',
        '..kGGkSsssssssssssssnk',
        '..kGGGQssssssssssssssk',
        '..kGGGGGQssssGGGGGGGGk',
        '..kgGGGGGQGGGGQQQGGGGk',
        '..kqgGGGGGGGGGGGGGGGk.',
        '...kqgGGGGGGGGGGGGGGk.',
        '...kqqgGGGGGGGGGGGGk..',
        '....kqqgGGGGGGGGGGk...',
        '.....kkqgGGGGGGGkk....',
        '.......kkkkkkkkk......',
      ] },
      torso: { ax: 9, ay: 0, shN: [16, 3], shF: [3, 3], hip: [9, 18], rows: [
        '......kGGGGk......',
        '...kkJJJGGJJJkk...',
        '..kJJJjJJJJJJJJk..',
        '.kJJJAAJJJJJAAJJk.',
        'kJJjJAAJJJJJAAJJJk',
        'kJJjJAAAAAAAAAJJJk',
        'kJJjJAaAAAAAAAAJJk',
        'kJJjJAaAAAAAAAAJJk',
        'kJjJAAaAAAAAAAAAJk',
        'kJjJAAaAAAAAAAAAJk',
        'kJjJAAaAAAAAAAAAJk',
        'kJjJAAaAAAAAAAAAJk',
        'kjRRRRRRRRBRRRRRjk',
        '.kAAaAAAAAAAAAAAk.',
        '.kAAaAAAAAAAAAAAk.',
        '.kAAaAAAAAAAAAAAk.',
        '.kAAaAAAAAAAAAAk..',
        '.kaaaaaaaaaaaaak..',
        '.kkkkkkkkkkkkkkk..',
      ] },
      body: { leg: 25, thigh: 13, shin: 12.5, legR: 2.8, arm1: 9, arm2: 8.5, armR: 2.4, pants: R.earth, pantsB: 2, sleeve: R.rust, sleeveB: 3, skin: R.skin, boot: R.ink },
    };
    DOCKHAND.head.key = DOCKHAND.torso.key = DOCK_KEY;
    HB.DOCKHAND = DOCKHAND;
    // his pipe, clenched in the beard (sprite coords at the head), and the smoke he puffs (frame coords)
    HB.pipeSmoke = (x, y, t, n) => { for (let k = 0; k < (n || 7); k++) { const u = frac(t * 0.35 + k / (n || 7)), sx = x + u * 10 + Math.sin(t * 1.5 + k) * u * 4, sy = y - u * 26; if (u > 0.85) continue; const c = u < 0.3 ? C('stone', 6) : C('stone', 4); put(fl(sx), fl(sy), c); if (u > 0.35) { put(fl(sx) + 1, fl(sy), c); if (u > 0.55) put(fl(sx), fl(sy) - 1, c); } } };

    /* ---------------------------------------------------------------- props */
    // the anchor: a great old iron anchor — a ring, a stock bar, a long shank, two curved arms with spade flukes,
    // barnacles and rust; it glows teal when his power is in it (g 0..1). Drawn with the core primitives at (x, y) = the ring,
    // its crown along ang (0 = straight down), size s (1 ≈ 52 px long). Call inside a layer or toSprite.
    function anchorArt(x, y, ang, s, g, t) {
      g = g || 0; t = t || 0;
      const dx = Math.sin(ang), dy = Math.cos(ang), nx = dy, ny = -dx, L = 52 * s;
      const at = (a, b) => [x + dx * a + nx * b, y + dy * a + ny * b];
      const iron = (v, xx, yy, glow) => { const gl = g * (glow || 1); if (gl > 0.55 && ((xx + yy + fl(t * 12)) % 5 === 0)) return C('mint', 7); return gl > 0.25 ? cel(R.teal, v + gl * 2.4, xx, yy) : cel(R.stone, v - 1.4, xx, yy); };
      const rust = (xx, yy) => vn(xx * 1.3, yy * 1.3, 2, 501) > 0.66;
      // the shank
      const [sx0, sy0] = at(5 * s, 0), [sx1, sy1] = at(L, 0);
      capsule(sx0, sy0, 3.2 * s, sx1, sy1, 3.8 * s, (xx, yy, u, w) => (rust(xx, yy) && g < 0.4 ? cel(R.rust, 2.6 + (w * (nx * LIGHTS.x + ny * LIGHTS.y) > 0.3 ? 1 : 0), xx, yy) : iron(3.4 + (w * (nx * LIGHTS.x + ny * LIGHTS.y) > 0.3 ? 1.4 : w * (nx * LIGHTS.x + ny * LIGHTS.y) < -0.4 ? -1 : 0), xx, yy)));
      // the arms: two curves from the crown up and out, ending in spade flukes
      const RA = 23 * s;
      for (const side of [-1, 1]) {
        let px = sx1, py = sy1;
        for (let q = 1; q <= 10; q++) {
          const a = q / 10 * 1.22, [qx, qy] = at(L - RA + RA * Math.cos(a), side * RA * Math.sin(a));
          capsule(px, py, (3.6 - q * 0.12) * s, qx, qy, (3.5 - q * 0.14) * s, (xx, yy, u, w) => iron(3.2 + (w * side > 0.3 ? 1.2 : w * side < -0.4 ? -0.8 : 0), xx, yy));
          px = qx; py = qy;
        }
        // the fluke: a spade at the tip, pointing back up toward the ring
        const a1 = 1.22, tipA = L - RA + RA * Math.cos(a1), tipB = side * RA * Math.sin(a1);
        const [f0x, f0y] = at(tipA + 7 * s, tipB - side * 1 * s), [f1x, f1y] = at(tipA - 3 * s, tipB + side * 6 * s), [f2x, f2y] = at(tipA - 11 * s, tipB + side * 1.5 * s), [f3x, f3y] = at(tipA - 2 * s, tipB - side * 4.5 * s);
        fillPoly([[f0x, f0y], [f1x, f1y], [f2x, f2y], [f3x, f3y]], (xx, yy) => iron(3.8 + ((xx - f2x) * LIGHTS.x + (yy - f2y) * LIGHTS.y > 0 ? 1.2 : -0.5), xx, yy));
        line(f0x, f0y, f2x, f2y, (xx, yy) => iron(2.4, xx, yy));
        const [tx, ty] = at(tipA - 14 * s, tipB + side * 0.5 * s); capsule(f2x, f2y, 1.2 * s, tx, ty, 0.5 * s, (xx, yy) => iron(5, xx, yy, 1.4));
      }
      // the crown: a heavy knuckle where the arms meet
      const [kx, ky] = at(L + 1 * s, 0); fillEll(kx, ky, 4.6 * s, 4.2 * s, 0, (xx, yy, u, v) => iron(3.4 + (u * LIGHTS.x + v * LIGHTS.y > 0.3 ? 1.4 : u * LIGHTS.x + v * LIGHTS.y < -0.4 ? -1 : 0), xx, yy));
      // the stock: a bar across the shank under the ring, bound with iron bands
      const [b0x, b0y] = at(8 * s, -14 * s), [b1x, b1y] = at(8 * s, 14 * s);
      capsule(b0x, b0y, 2.6 * s, b1x, b1y, 2.6 * s, (xx, yy, u, w) => (Math.abs(u - 0.5) < 0.04 || Math.abs(u - 0.15) < 0.03 || Math.abs(u - 0.85) < 0.03 ? iron(2, xx, yy) : g < 0.3 ? cel(R.wood, 2.4 + (w > 0.3 ? 1 : w < -0.4 ? -1 : 0) + (vn(u * 40, w, 1, 503) > 0.6 ? 0.5 : 0), xx, yy) : iron(3.6 + (w > 0.3 ? 1 : 0), xx, yy)));
      for (const e of [[b0x, b0y], [b1x, b1y]]) fillEll(e[0], e[1], 2.2 * s, 2.2 * s, 0, (xx, yy) => iron(3, xx, yy));
      // the ring
      const [rx, ry] = at(-1 * s, 0);
      for (let a = 0; a < TAU; a += 0.04 / s) { const r1 = 5.6 * s, c = Math.cos(a), sn = Math.sin(a); for (let w = -1.6 * s; w <= 1.6 * s; w += 0.5) { const xx = fl(rx + c * (r1 + w)), yy = fl(ry + sn * (r1 + w)), l = c * LIGHTS.x + sn * LIGHTS.y; put(xx, yy, iron(3.4 + (l > 0.3 ? 1.3 : l < -0.4 ? -1 : 0) + (w > 0.8 * s ? -0.5 : 0), xx, yy)); } }
      // barnacles and weed (cold iron only)
      if (g < 0.3) for (let k = 0; k < 12; k++) { const a = L * (0.35 + ih(k, 1, 505) * 0.6), b = (ih(k, 2, 505) - 0.5) * 6 * s, [bx, by] = at(a, b); put(fl(bx), fl(by), ih(k, 3, 505) < 0.5 ? C('linen', 5) : C('stone', 6)); if (k % 3 === 0) put(fl(bx), fl(by) + 1, C('moss', 3)); }
      return { ring: [rx, ry], crown: [kx, ky] };
    }
    HB.anchorArt = anchorArt;

    // a fish: chunky silver body, dark back, forked tail; (x, y) its middle, len in px, ang on screen, flap -1..1
    function fishArt(x, y, len, ang, flap) {
      const c = Math.cos(ang), s = Math.sin(ang), at = (a, b) => [x + c * a - s * b, y + s * a + c * b], h = len * 0.5;
      for (let a = -h; a <= h; a += 0.5) {
        const u = (a + h) / (2 * h), wd = Math.sin(Math.min(1, u * 1.25) * PI) * len * 0.17 + 0.3;
        for (let b = -wd; b <= wd; b += 0.5) { const [px_, py_] = at(a, b + (u < 0.25 ? (flap || 0) * (0.25 - u) * 6 : 0)); put(fl(px_), fl(py_), b < -wd * 0.35 ? C('sea', 2) : b > wd * 0.45 ? C('hush', 5) : (fl(a) & 1) ? C('steel', 5) : C('steel', 6)); }
      }
      for (const sd of [-1, 1]) for (let q = 0; q < len * 0.25; q += 0.5) { const [px_, py_] = at(-h - q, sd * q * 0.9 + (flap || 0) * len * 0.12); put(fl(px_), fl(py_), C('sea', 3)); }
      const [ex, ey] = at(h * 0.62, -len * 0.04); put(fl(ex), fl(ey), C('ink', 0)); put(fl(ex) + 1, fl(ey), C('snow', 7));
      const [gx, gy] = at(h * 0.4, 0); put(fl(gx), fl(gy), C('crimson', 3));
    }
    HB.fishArt = fishArt;

    /* ---------------------------------------------------------------- the Hollow: shadow people; black, ragged, white eyes, glitching
    // (x, y) feet, s scale (1 ≈ 64 px tall), f facing; o: reach 0..1 (an arm out), crouch 0..1, glitch, alpha, seed, fall (streaking down) */
    function hollowFig(x, y, s, f, t, o) {
      o = o || {}; const seed = o.seed || 1, sw = Math.sin(t * 2.3 + seed) * 1.5 * s, cr = o.crouch || 0, rc = o.reach || 0;
      const X = (a) => x + a * s * f, Yv = (b) => y - b * s;
      lyBegin();
      const ink = (v) => (xx, yy) => cel(R.ink, v + (vn(xx * 0.8, yy * 0.8 + t * 6, 2, seed) > 0.7 ? 0.6 : 0), xx, yy);
      const hipY = 26 - cr * 9, shY = 48 - cr * 12;
      // legs that thin into smoke at the bottom
      for (const sd of [-1, 1]) capsule(X(sd * 3.5), Yv(hipY), 2.6 * s, X(sd * 5 + (o.walk ? Math.sin(o.walk + (sd > 0 ? 0 : PI)) * 5 : 0)), Yv(2), 1.2 * s, (xx, yy, u) => (u > 0.75 && ih(xx, yy, fl(t * 10) + seed) < (u - 0.75) * 3 ? -1 : ink(0.5)(xx, yy)));
      // ragged wisps where the feet should be
      for (let k = 0; k < 6; k++) { const wx = X((k - 2.5) * 2.4), wy = Yv(1), len = (3 + ih(k, 1, seed) * 5) * s; line(wx, wy, wx + Math.sin(t * 4 + k) * 3 * s - 2 * f * s, wy + len * 0.2 - len * 0.6, C('ink', 0)); }
      // the body: a hunched, torn shape
      fillPoly([[X(-11), Yv(shY - 2)], [X(-6), Yv(shY + 2)], [X(7), Yv(shY + 2)], [X(12), Yv(shY - 3)], [X(8), Yv(hipY + 4)], [X(-7), Yv(hipY + 4)]], ink(0.8));
      // tattered strips off the waist, fluttering
      for (let k = 0; k < 7; k++) { const hx = -8 + k * 2.6, len = 7 + ih(k, 2, seed) * 9, fl_ = Math.sin(t * 5 + k * 1.7 + seed) * 2; fillPoly([[X(hx), Yv(hipY + 4)], [X(hx + 2.4), Yv(hipY + 4)], [X(hx + 1.6 + fl_), Yv(hipY + 4 - len)], [X(hx + 0.6 + fl_ * 1.3), Yv(hipY + 2 - len)]], ink(0.4)); }
      // the shoulders fray upward like burning paper
      for (let k = 0; k < 8; k++) { const hx = -11 + k * 3.1, len = 3 + ih(k, 3, seed) * 6 + Math.sin(t * 7 + k) * 1.5; fillPoly([[X(hx - 1.4), Yv(shY + 1)], [X(hx + 1.4), Yv(shY + 1)], [X(hx + Math.sin(t * 6 + k * 2) * 1.5 - 1.5), Yv(shY + 1 + len)]], ink(0.6)); }
      // the long arms, claws
      const sh = [X(-9), Yv(shY - 1)], sh2 = [X(9), Yv(shY - 1)];
      const handB = [X(-11 + sw * 0.3), Yv(hipY - 14 + cr * 4)], handF = rc > 0 ? [X(lerp(13, 34, rc)), Yv(lerp(hipY - 12, shY - 6, rc))] : [X(12 + sw * 0.4), Yv(hipY - 13 + cr * 4)];
      for (const [a, b] of [[sh, handB], [sh2, handF]]) {
        const el = [(a[0] + b[0]) / 2 + (b === handF && rc > 0 ? 0 : -2 * f * s), (a[1] + b[1]) / 2 + (b === handF && rc > 0 ? 3 * s : 0)];
        capsule(a[0], a[1], 2.2 * s, el[0], el[1], 1.6 * s, ink(0.9)); capsule(el[0], el[1], 1.6 * s, b[0], b[1], 1.0 * s, ink(0.9));
        for (let q = -1; q <= 1; q++) line(b[0], b[1], b[0] + (q * 1.6 + (b === handF ? 2 * f : 0)) * s, b[1] + (4 - Math.abs(q)) * s, C('ink', 1));
      }
      // the head: round, pushed forward, two white eyes and a thin white crack of a mouth when it opens
      const hx = X(4 - cr * 2), hy = Yv(shY + 8 - cr * 2);
      fillEll(hx, hy, 6.4 * s, 7.4 * s, 0, ink(1.0));
      for (let k = 0; k < 7; k++) { const a = -PI / 2 + (k - 3) * 0.32, r0 = 6.6 * s, bx = hx + Math.cos(a) * r0, by = hy + Math.sin(a) * r0 * 1.1, len = (2 + ih(k, 4, seed) * 3 + Math.sin(t * 7 + k * 2) * 1.2) * s; line(bx, by, bx + Math.cos(a) * len - f * s * 1.5 + Math.sin(t * 5 + k) * s, by + Math.sin(a) * len, C('ink', k & 1 ? 1 : 0)); }
      lk(3); const blinkE = frac(t * 0.4 + ih(seed, 5, 1)) < 0.03;
      if (!blinkE) for (const ex of [1.5, 4.6]) { const ex_ = fl(hx + ex * s * f - (f < 0 ? 1 : 0)), ey = fl(hy - 1 * s); rectF2(ex_, ey, Math.max(1, Math.round(1.6 * s)), Math.max(1, Math.round(1.4 * s)), WHITE); }
      if (o.mouth) { for (let q = 0; q < 5 * s; q++) put(fl(hx + (1 + q) * f), fl(hy + 3 * s + (q & 1)), C('hush', 6)); }
      lk(1);
      lyEnd({ edge: o.edge === undefined ? C('dusk', 3) : o.edge, glitch: o.glitch || 0.15, t, seed, alpha: o.alpha, white: o.white, fx: o.fx });
      // the eyes' glow
      if (!blinkE) glow(hx + 3 * s * f, hy - s, 7 * s, tab('#e8ecff', true), 0.35);
      return { head: [hx, hy], hand: handF };
    }
    function rectF2(x, y, w, h, c) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) put(x + i, y + j, c); }
    HB.hollowFig = hollowFig;

    /* ---------------------------------------------------------------- the Bellwether: huge, robed, a cracked bronze bell for a head
    // the bell, drawn with any plot(x, y, c, kind): lip centre (cx, ly), size s (1: lip half-width 30, height 58); o.speak 0..1 lights
    // the crack and the slit; o.ring 0..1 makes it shiver */
    function bellDraw(plot, cx, ly, s, t, o) {
      o = o || {}; const sp_ = clamp(o.speak || 0, 0, 1), hum = 0.35 + sp_ * 0.65, shiver = (o.ring || 0) * Math.sin(t * 70) * 0.8;
      const Hh = 58 * s, top = ly - Hh;
      const wOf = (u) => (u < 0.8 ? 22 + 8.5 * Math.exp(-u * 9) - 2.2 * Math.sin(u / 0.8 * PI) * 0.6 : 22 * Math.sqrt(Math.max(0, 1 - Math.pow((u - 0.8) / 0.2, 2)))) * s;
      const lx = LIGHTS.x, lyy = LIGHTS.y;
      // the crack: a jagged path from the lip up toward the crown, and two branches
      const CR = [[8, 0], [6, 0.08], [9, 0.16], [5, 0.26], [6.5, 0.33], [2, 0.42], [3.5, 0.52], [-1, 0.6], [0.5, 0.7]];
      const crackD = (x, u) => { let best = 9; for (let i = 0; i + 1 < CR.length; i++) { const a = CR[i], b = CR[i + 1]; if (u < a[1] || u > b[1]) continue; const k = (u - a[1]) / (b[1] - a[1]), cxx = (a[0] + (b[0] - a[0]) * k) * s; best = Math.min(best, Math.abs(x - cxx) / s); } if (u > 0.14 && u < 0.3) { const bx = (9 - (u - 0.14) * 70) * s; best = Math.min(best, Math.abs(x - bx) / s * 1.3); } if (u > 0.45 && u < 0.58) { const bx = (3 + (u - 0.45) * 90) * s; best = Math.min(best, Math.abs(x - bx) / s * 1.4); } return best; };
      for (let y = fl(top) - 1; y <= ly + 1; y++) {
        const u = (ly - y) / Hh; if (u < -0.02 || u > 1) continue;
        const w = wOf(Math.max(0, u)); if (w <= 0) continue;
        for (let x = fl(cx - w); x <= cx + w; x++) {
          const nxp = (x + 0.5 - cx) / w; if (Math.abs(nxp) > 1) continue;
          const X = x + Math.round(shiver);
          // metal: a hard specular stripe, a dark core, reflected light at the far edge
          const L = -nxp * lx;
          let v = 3.4 + (L > 0.25 ? 1.2 : 0) + (Math.abs(nxp + 0.5 * Math.sign(lx || 1) * -1 * -1) < 0.0 ? 0 : 0);
          const spec = Math.abs(nxp - (lx < 0 ? -0.5 : 0.5)) < 0.1, core = Math.abs(nxp - (lx < 0 ? 0.42 : -0.42)) < 0.25, refl = Math.abs(nxp) > 0.86;
          v = spec ? 6.6 : core ? 1.8 : refl ? 3.4 : 3.6 + (L > 0.2 ? 0.9 : L < -0.2 ? -0.6 : 0);
          if (u > 0.8) v += (0.95 - u) < 0 ? 1 : 0.6 * (lyy < 0 ? 1 : 0);   // the dome catches light from above
          // raised rings
          for (const r of [0.03, 0.09, 0.6, 0.64, 0.79]) { const d = (u - r) * Hh; if (d > -1 && d < 0) v += 1.6; else if (d >= 0 && d < 1.2) v -= 1.4; }
          let c = cel(R.bronze, v, X, y);
          // verdigris in the hollows
          if (!spec && fbm(x * 0.6 / s, y * 0.6 / s, 6, 2, 611) > 0.66 && u > 0.1) c = cel(R.teal, 2.4 + (L > 0 ? 0.8 : 0), X, y);
          // glyphs engraved in the band between the upper rings
          if (u > 0.66 && u < 0.77 && Math.abs(nxp) < 0.85) { const gi = fl((nxp + 1) * 6), gx = fl(((nxp + 1) * 6 - gi) * 5), gy = fl((u - 0.66) / 0.11 * 5); const g = GLY[(gi + 3) % GLY.length]; if (g[gy] && g[gy][gx] === '#') c = sp_ > 0.2 && gi % 3 === 0 ? C('fire', 5) : cel(R.bronze, v - 1.6, X, y); }
          // the slit: a narrow eye across the waist, glowing
          const sy = Math.abs(u - 0.36) * Hh;
          if (sy < 1.6 * s && Math.abs(nxp) < 0.7) { plot(X, y, sy < 0.6 * s ? (hum > 0.7 ? WHITE : C('fire', 6)) : C('fire', hum > 0.6 ? 5 : 4), 3); continue; }
          if (sy < 2.6 * s && Math.abs(nxp) < 0.74) c = C('ink', 0);
          // the crack, glowing from inside
          const cd = crackD(x + 0.5 - cx, u);
          if (cd < 0.5 + (1 - u) * 0.5) { plot(X, y, hum > 0.75 && cd < 0.35 ? WHITE : C('fire', hum > 0.5 ? 6 : 5), 3); continue; }
          if (cd < 1.2 + (1 - u) * 0.6) c = C('ink', 0);
          plot(X, y, c, 1);
        }
      }
      // the lip: the dark mouth of the bell with a faint light deep inside
      for (let x = fl(cx - 31 * s); x <= cx + 31 * s; x++) { const nxp = (x + 0.5 - cx) / (31 * s); if (Math.abs(nxp) > 1) continue; const d = Math.sqrt(1 - nxp * nxp) * 3.4 * s; for (let y = ly; y < ly + d; y++) plot(x, y, y < ly + 1 ? C('bronze', 6) : Math.abs(nxp) < 0.3 && sp_ > 0.4 ? C('ember', 3) : C('ink', 0), 1); }
      // the canon: a loop on the crown
      for (let a = PI; a <= TAU; a += 0.05 / s) for (let w = -1.3 * s; w <= 1.3 * s; w += 0.5) { const r = 5 * s + w, xx = fl(cx + Math.cos(a) * r), yy = fl(top + 1 + Math.sin(a) * r * 1.2); plot(xx, yy, cel(R.bronze, 3.6 + (Math.cos(a) * lx > 0.2 ? 1.4 : -0.4), xx, yy), 1); }
      return { top, slit: [cx, ly - 0.36 * Hh] };
    }
    HB.bellDraw = bellDraw;
    const LPLOT = (x, y, c, k) => { LTGT.kind = k || 1; put(fl(x), fl(y), c); LTGT.kind = 1; };
    // the whole figure, in the frame: hem centre at (x, y), s (1 ≈ 212 px tall); o: arms 0..1 (raised), speak, ring, sway, alpha, white
    function bellwether(x, y, s, t, o) {
      o = o || {}; const sw = Math.sin(t * 0.8) * 2 * s + (o.billow || 0) * Math.sin(t * 9) * 3 * s, raise = o.arms || 0;
      LIGHTS.x = LIGHT.x; LIGHTS.y = LIGHT.y;
      lyBegin();
      const robe = (v, xx, yy) => cel(R.violet, v, xx, yy), lx = LIGHT.x;
      const shY = y - 140 * s, hemW = 60 * s, shW = 38 * s;
      // the sleeves (behind, the far one first): wide cones from the shoulder to a gold cuff, long grey fingers
      const arm = (side, far) => {
        const a0 = lerp(0.14, 2.35, eio(raise)) + (far ? 0.05 : 0) + Math.sin(t * 1.1 + side) * 0.04, sx = x + side * (shW - 2 * s), sy = shY + 8 * s;
        const ang = side * a0, L1 = 52 * s, L2 = 50 * s, bend = side * lerp(0.15, -0.5, raise);
        const ex = sx + Math.sin(ang) * L1, ey = sy + Math.cos(ang) * L1, hx = ex + Math.sin(ang + bend) * L2, hy = ey + Math.cos(ang + bend) * L2;
        capsule(sx, sy, 9 * s, ex, ey, 10 * s, (xx, yy, u, w) => robe(2.4 - far + (w * side * (lx > 0 ? -1 : 1) < -0.3 ? 1.2 : 0) + (frac((w + 1) * 2.5) < 0.2 ? -0.8 : 0), xx, yy));
        capsule(ex, ey, 10 * s, hx, hy, 13 * s, (xx, yy, u, w) => (u > 0.86 ? cel(R.gold, 4 - far + (w > 0 ? 0.8 : 0), xx, yy) : robe(2.6 - far + (w * side * (lx > 0 ? -1 : 1) < -0.3 ? 1.2 : 0) + (frac((w + 1) * 3) < 0.2 ? -0.8 : 0), xx, yy)));
        // the hand: long fingers from inside the cuff
        const dxh = Math.sin(ang + bend), dyh = Math.cos(ang + bend), fx = hx + dxh * 3 * s, fy = hy + dyh * 3 * s;
        for (let q = -1.5; q <= 1.5; q++) { const fa = ang + bend + q * 0.16 + Math.sin(t * 2 + q) * 0.05, l = (17 - Math.abs(q) * 2.5) * s, mx = fx + q * 2.6 * s * dyh + Math.sin(fa) * l * 0.55, my = fy - q * 2.6 * s * dxh + Math.cos(fa) * l * 0.55, tx = mx + Math.sin(fa + side * 0.35 * (1 - raise)) * l * 0.5, ty = my + Math.cos(fa + side * 0.35 * (1 - raise)) * l * 0.5; capsule(fx + q * 2.6 * s * dyh, fy - q * 2.6 * s * dxh, 1.5 * s, mx, my, 1.2 * s, (xx, yy, u, w) => cel(R.stone, 3.2 - far + (w > 0.3 ? 1 : 0), xx, yy)); capsule(mx, my, 1.2 * s, tx, ty, 0.5 * s, (xx, yy) => cel(R.stone, 2.6 - far, xx, yy)); }
        return [hx, hy];
      };
      const hands = [arm(-1, 1), null];
      // the robe: heavy, pleated, flaring wide at the foot and pooling on the planks; a dark front panel with gold bell marks
      const top = shY + 20 * s;
      for (let yy = fl(top); yy <= y + 2; yy++) {
        const v = (y - yy) / (y - top), half = lerp(shW * 0.86, hemW, Math.pow(1 - v, 2.1)), cx_ = x + sw * Math.pow(1 - v, 2);
        for (let xx = fl(cx_ - half - 2); xx <= cx_ + half + 2; xx++) {
          const nxp = (xx + 0.5 - cx_) / half; if (Math.abs(nxp) > 1) continue;
          const hemY = y - 1 * s + Math.sin(xx * 0.31 / s) * 1.2 * s + (Math.abs(nxp) > 0.8 ? (Math.abs(nxp) - 0.8) * 8 * s : 0);
          if (yy > hemY) continue;
          const pleat = frac((nxp * (5 + (1 - v) * 4)) + 0.5 + sw * 0.02);
          let c = 2.6 + (-nxp * lx > 0.25 ? 1.1 : -nxp * lx < -0.35 ? -0.8 : 0) + (pleat < 0.16 ? -1.3 : pleat > 0.78 ? 0.7 : 0) - (v < 0.15 ? 0.6 : 0);
          let col = cel(R.violet, c, xx, yy);
          if (hemY - yy < 6 * s) col = hemY - yy < 1.5 * s ? C('violet', 0) : cel(R.gold, 3.6 + ((fl((xx - x) / (3 * s)) & 1) && hemY - yy > 2.5 * s && hemY - yy < 4.6 * s ? 1.4 : 0) + (-nxp * lx > 0.2 ? 0.8 : 0), xx, yy);
          else if (Math.abs(nxp) < 0.2) {
            col = cel(R.dusk, 1.6 + (pleat < 0.2 ? -0.6 : 0) + (-nxp * lx > 0.2 ? 0.6 : 0), xx, yy);
            const my = (y - yy) / (16 * s), mi = fl(my), mf = my - mi;
            if (Math.abs(nxp) < 0.08 && mf > 0.25 && mf < 0.75 && mi > 0 && mi < 8) col = C('gold', mf < 0.42 ? 6 : 4);
            if (Math.abs(Math.abs(nxp) - 0.19) < 0.02) col = C('gold', 3);
          }
          put(xx, yy, col);
        }
      }
      // the mantle: a heavy shoulder cape with rounded shoulders, falling lower at the middle, gold-scalloped hem
      const mTop = shY - 6 * s, mW = 44 * s;
      for (let yy = fl(mTop); yy < shY + 52 * s; yy++) for (let xx = fl(x - mW - 3); xx <= x + mW + 3; xx++) {
        const nxp = (xx + 0.5 - x) / mW, ay = Math.abs(nxp);
        const shoulderTop = mTop + (ay > 0.55 ? Math.pow((ay - 0.55) / 0.45, 2) * 14 * s : 0) + (ay < 0.3 ? 0 : 0);
        const half = 1 + Math.min(0.08, Math.max(0, (yy - shY) / (50 * s)) * 0.08);
        if (ay > half || yy < shoulderTop) continue;
        const hemY = shY + (30 + 14 * Math.cos(nxp * PI / 2)) * s, sc = Math.abs(Math.sin((xx - x) / (6 * s) * PI)) * 3 * s;
        if (yy > hemY - sc) continue;
        const fold = frac(nxp * 6 + 0.5), shade = -nxp * lx > 0.2 ? 1.1 : -nxp * lx < -0.35 ? -0.7 : 0;
        let col = cel(R.dusk, 2.3 + shade + (fold < 0.14 ? -0.9 : 0) + (yy - shoulderTop < 2.5 * s ? 1.4 : 0), xx, yy);
        if (yy > hemY - sc - 2.4 * s) col = cel(R.gold, 4.4 + shade * 0.6, xx, yy);
        put(xx, yy, col);
      }
      // the clasp
      fillEll(x, shY + 12 * s, 4.6 * s, 4.6 * s, 0, (xx, yy, u, v) => cel(R.gold, 4.4 + (u * lx + v * LIGHT.y > 0.2 ? 1.6 : -0.8) + (Math.hypot(u, v) > 0.8 ? -1.4 : 0), xx, yy));
      fillEll(x, shY + 12 * s, 1.8 * s, 1.8 * s, 0, C('crimson', 5));
      hands[1] = arm(1, 0);
      // the standing collar: stiff fan pleats flaring round the base of the bell
      const colB = shY + 4 * s, colT = shY - 20 * s;
      fillPoly([[x - 20 * s, colB], [x + 20 * s, colB], [x + 33 * s, colT], [x - 33 * s, colT]], (xx, yy) => { const v = (colB - yy) / (colB - colT), nxp = (xx - x) / lerp(20 * s, 33 * s, v), pl = frac(nxp * 6 + 0.5); return pl < 0.13 ? C('violet', 1) : (yy - colT) < 1.6 * s ? cel(R.gold, 5, xx, yy) : cel(R.lav, 2.2 + (pl > 0.55 ? 1 : 0) + (-nxp * lx > 0.3 ? 0.7 : 0) - (1 - v) * 0.8, xx, yy); });
      // the bell
      const r = bellDraw(LPLOT, x, colT + 3 * s, s * 1.05, t, o);
      lyEnd({ edge: o.edge === undefined ? C('fire', 6) : o.edge, alpha: o.alpha, white: o.white, fx: o.fx });
      // the light out of the slit and the crack
      const sp_ = clamp(o.speak || 0, 0, 1);
      glow(r.slit[0], r.slit[1], 26 * s, tab('#ffc060', true), 0.25 + sp_ * 0.35);
      return { slit: r.slit, top: r.top, hands, chest: [x, shY + 10 * s] };
    }
    HB.bellwether = bellwether;
    // the bell in close-up: a bust (sprite space, stamped at S = 3) — the bell over the collar and the shoulders of the robe
    BUSTS.bell = function (P, t) {
      const lx = LIGHTS.x, sw = Math.round(Math.sin(t * 0.8) * 0.6);
      // the shoulders and capelet
      sPoly([[-78, 0], [-74, -18], [-56, -34], [-26, -42], [26, -42], [56, -34], [74, -18], [78, 0]], (x, y) => { const nxp = x / 76, sc = (y + 42) / 42; return band(R.dusk, 2.2 + (-nxp * lx > 0.25 ? 1 : -nxp * lx < -0.3 ? -0.8 : 0) + (frac(x / 9) < 0.14 ? -0.8 : 0) + (sc < 0.1 ? 1 : 0)); });
      for (let x = -76; x <= 76; x++) { const yy = -2 - Math.abs(Math.sin(x / 9 * PI)) * 4; sp(x, fl(yy), C('gold', 5)); sp(x, fl(yy) - 1, C('gold', 4)); }
      sEll(0, -24, 7, 7, (x, y, u, v) => band(R.gold, 4.4 + (u * lx + v * LIGHTS.y > 0.2 ? 1.6 : -0.8) + (Math.hypot(u, v) > 0.8 ? -1.4 : 0)));
      sEll(0, -24, 2.5, 2.5, (x, y, u, v) => band(R.crimson, 4 + (u + v < 0 ? 1 : 0)));
      // the collar
      sPoly([[-24, -38], [24, -38], [33, -54], [-33, -54]], (x, y) => { const nxp = x / 33, pl = frac(nxp * 7 + 0.5); return pl < 0.12 ? C('violet', 1) : y < -52 ? C('gold', 5) : band(R.lav, 2.4 + (pl > 0.6 ? 1 : 0) + (-nxp * lx > 0.3 ? 0.6 : 0) - (y > -44 ? 0.8 : 0)); });
      const r = bellDraw((x, y, c, k) => sp(x, y, c, k), sw, -50, 0.78, t, P);
      return { head: [0, -110], mouth: r.slit, chest: [0, -24], slit: r.slit, top: [0, r.top] };
    };

    /* ---------------------------------------------------------------- Vesper: an armoured knight, a violet crest that streams like flame,
    // a lantern; out of the fog. (x, y) feet, s (1 ≈ 82 px), f facing (+1 right); o: ph (walk phase), step (0..1 the foot lands),
    // sil 0..1 (lost in fog: a silhouette), eyes 0..1 (flare), lamp */
    function vesperFig(x, y, s, t, o) {
      o = o || {}; const f = o.f || 1, ph = o.ph || 0, sil = o.sil || 0, X = (a) => x + a * s * f, Yv = (b) => y - b * s;
      lyBegin();
      const steel = (v) => (xx, yy) => cel(R.steel, v, xx, yy), dark = (v) => (xx, yy) => cel(R.ink, v, xx, yy);
      const bob = Math.abs(Math.sin(ph)) * 1.5;
      const hip = 40 - bob * 0.3, sh = 64 - bob * 0.3;
      // the cloak behind: ragged, long, blown back
      const wv = (k) => Math.sin(t * 3 + k) * 2;
      fillPoly([[X(-8), Yv(sh + 1)], [X(9), Yv(sh + 1)], [X(-4 + wv(1)), Yv(6)], [X(-14 + wv(2)), Yv(2)], [X(-22 + wv(3)), Yv(10)], [X(-18), Yv(sh - 10)]], (xx, yy) => (yy > Yv(14) && ih(fl(xx / 2), 0, 731) < 0.4 ? -1 : cel(R.violet, 0.8 + (yy < Yv(sh - 4) ? 0.8 : 0), xx, yy)));
      // legs: armoured, stepping
      for (const [sd, far] of [[1, 1], [-1, 0]]) {
        const a = Math.sin(ph + (sd > 0 ? 0 : PI)), lift = Math.max(0, Math.cos(ph + (sd > 0 ? 0 : PI))) * 5;
        const hp = [X(sd * 3), Yv(hip)], ft = [X(a * 9), Yv(lift)], kn = [(hp[0] + ft[0]) / 2 + 3 * s * f, (hp[1] + ft[1]) / 2 - lift * 0.3 * s];
        capsule(hp[0], hp[1], 4 * s, kn[0], kn[1], 3.4 * s, steel(2.4 - far)); capsule(kn[0], kn[1], 3.6 * s, ft[0], ft[1] - 2 * s, 3 * s, steel(3 - far));
        fillEll(kn[0], kn[1], 3.6 * s, 3.2 * s, 0, steel(4.2 - far));
        fillPoly([[ft[0] - 4 * s * f, ft[1]], [ft[0] + 6 * s * f, ft[1]], [ft[0] + 5 * s * f, ft[1] - 3 * s], [ft[0] - 3 * s * f, ft[1] - 4 * s]], steel(2 - far));
      }
      // tassets, breastplate
      fillPoly([[X(-9), Yv(hip + 8)], [X(10), Yv(hip + 8)], [X(12), Yv(hip - 8)], [X(-11), Yv(hip - 8)]], (xx, yy) => cel(R.steel, 2.4 + (frac((yy - Yv(hip + 8)) / (4 * s)) < 0.25 ? -1 : 0.3) + ((xx - x) * f > 0 ? 0.6 : 0), xx, yy));
      fillPoly([[X(-10), Yv(sh)], [X(11), Yv(sh)], [X(9), Yv(hip + 6)], [X(-8), Yv(hip + 6)]], (xx, yy) => { const u = ((xx - x) * f) / (11 * s); return cel(R.steel, 3 + (u > 0.25 ? 1.4 : u < -0.4 ? -1 : 0) + (Math.abs(u - 0.1) < 0.06 ? 1.6 : 0), xx, yy); });
      fillPoly([[X(-9), Yv(hip + 9)], [X(10), Yv(hip + 9)], [X(10), Yv(hip + 6)], [X(-9), Yv(hip + 6)]], C('violet', 3));
      // the lantern arm (far side, forward), the near arm with a hand on the hilt at the hip
      const lh = [X(13 + Math.sin(ph) * 2), Yv(hip - 2)];
      capsule(X(7), Yv(sh - 3), 3.4 * s, X(12), Yv(sh - 15), 3 * s, steel(2.2)); capsule(X(12), Yv(sh - 15), 3 * s, lh[0], lh[1] - 2 * s, 2.8 * s, steel(2.4));
      fillEll(X(-7), Yv(sh - 2), 6.6 * s, 5.6 * s, 0, (xx, yy, u, v) => cel(R.steel, 3.4 + (u * f * LIGHT.x + v * LIGHT.y > 0.2 ? 1.4 : -0.6) + (Math.abs(v + 0.1) < 0.12 ? -1 : 0), xx, yy));
      capsule(X(-7), Yv(sh - 6), 3.4 * s, X(-9), Yv(hip + 2), 3 * s, steel(3)); capsule(X(-9), Yv(hip + 2), 3 * s, X(-3), Yv(hip - 2), 2.8 * s, steel(3.2));
      // the sword at his hip
      line(X(-4), Yv(hip - 1), X(-20), Yv(hip - 24), C('steel', 2), Math.max(1, Math.round(2 * s))); line(X(-2), Yv(hip + 1), X(-6), Yv(hip - 5), C('violet', 4), Math.max(1, Math.round(2 * s)));
      fillEll(X(9), Yv(sh - 2), 6.6 * s, 5.6 * s, 0, (xx, yy, u, v) => cel(R.steel, 3.8 + (u * f * LIGHT.x + v * LIGHT.y > 0.2 ? 1.4 : -0.6) + (Math.abs(v + 0.1) < 0.12 ? -1 : 0), xx, yy));
      // the helm: tall, round-topped, a T of a visor slit
      const hx = X(1), hy = Yv(sh + 10);
      fillPoly([[hx - 7 * s, hy + 9 * s], [hx + 7 * s, hy + 9 * s], [hx + 8 * s, hy - 4 * s], [hx + 5 * s, hy - 10 * s], [hx - 5 * s, hy - 10 * s], [hx - 8 * s, hy - 4 * s]], (xx, yy) => { const u = (xx - hx) * f / (8 * s); return cel(R.steel, 3.2 + (u > 0.3 ? 1.4 : u < -0.4 ? -1 : 0) + (Math.abs(u - 0.15) < 0.07 && yy < hy ? 1.6 : 0), xx, yy); });
      fillEll(hx, hy - 9 * s, 5.2 * s, 3 * s, 0, steel(4));
      for (let q = -5; q <= 5; q++) put(fl(hx + q * s * 0.9 + f * s), fl(hy - 1 * s), C('ink', 0));
      for (let q = 0; q < 6; q++) put(fl(hx + f * s * 1.5), fl(hy - 1 * s + q * s), C('ink', 0));
      // the eyes
      const ea = o.eyes === undefined ? 0.6 : o.eyes;
      lk(3); for (const ex of [-2.5, 4]) { const xx = fl(hx + ex * s * f), yy = fl(hy - 1 * s); put(xx, yy, ea > 0.6 ? WHITE : C('violet', 7)); if (s > 1.4) put(xx + 1, yy, C('violet', 6)); } lk(1);
      // the crest: violet strands streaming back from the crown like a flame
      lk(3);
      for (let k = 0; k < 9; k++) { const len = (16 + ih(k, 1, 733) * 14) * s, base = [hx - (1 - k * 0.5) * s * f, hy - 11 * s]; let px = base[0], py = base[1]; for (let q = 0; q < 10; q++) { const u = q / 10, nxp = px - (len / 10) * f * (0.75 + u * 0.3), nyp = py - (len / 10) * (0.5 - u * 0.9) + Math.sin(t * 6 + k + q * 0.7) * 0.9 * s; line(px, py, nxp, nyp, u > 0.75 ? C('violet', 3) : u > 0.4 ? C('violet', 5) : C('lav', 6), Math.max(1, Math.round((1.8 - u * 1.4) * s))); px = nxp; py = nyp; } }
      lk(1);
      // the lantern: iron cage, a cold violet-white flame
      const lx = lh[0], ly = lh[1];
      line(lx, ly - 4 * s, lx, ly, C('ink', 1)); fillPoly([[lx - 3 * s, ly], [lx + 3 * s, ly], [lx + 3.6 * s, ly + 8 * s], [lx - 3.6 * s, ly + 8 * s]], C('ink', 1));
      lk(3); fillEll(lx, ly + 4.2 * s, 2.2 * s, 3 * s, 0, (xx, yy, u, v) => (Math.hypot(u, v) < 0.5 ? WHITE : C('lav', 6))); lk(1);
      // lost in the fog: every colour pulled toward a dark violet-grey (no dither), the rim and the lights kept
      const edgeC = o.edge === undefined ? C('lav', 6) : o.edge, TS = tab('#2a2440'), ls = Math.min(7, fl(sil * 8));
      lyEnd({ edge: edgeC, fx: sil > 0.06 ? (c, xx, yy, k) => (k === 3 || c === edgeC ? c : TS[ls * NPAL + c]) : undefined });
      glow(lx, ly + 4 * s, 16 * s, tab('#c8a0ff', true), 0.4 * (o.lamp === undefined ? 1 : o.lamp));
      if (ea > 0.3) glow(hx + f * s, hy - s, 10 * s * ea, tab('#d0a0ff', true), 0.6 * ea);
      return { head: [hx, hy], lamp: [lx, ly + 4 * s], foot: [x, y] };
    }
    HB.vesperFig = vesperFig;
    // Vesper's helm in close-up (a bust, S = 3): the great helm, the slit, the eyes flaring (P.eyes 0..1), the crest streaming
    BUSTS.vesper = function (P, t) {
      const ea = P.eyes || 0, lx = LIGHTS.x, HX = 2, HY = -46;
      sPoly([[-34, 0], [-30, -14], [-18, -24], [20, -24], [32, -14], [36, 0]], (x, y) => band(R.steel, 2.2 + (-(x / 34) * lx > 0.2 ? 1.2 : -0.4) + (Math.abs(y + 12) < 0.6 ? -1 : 0)));
      for (const sd of [-1, 1]) sEll(sd * 22, -18, 13, 9, (x, y, u, v) => band(R.steel, 2.8 + (u * lx + v * LIGHTS.y > 0.2 ? 1.6 : -0.6) + (Math.abs(v - 0.2) < 0.1 ? -1 : 0)));
      sPoly([[-8, -24], [10, -24], [9, -30], [-7, -30]], (x, y) => band(R.violet, 2 + (x > 2 ? 1 : 0)));
      // the crest, behind the helm
      for (let k = 0; k < 12; k++) { const len = 26 + ih(k, 1, 741) * 22, bx = HX - 4 + k * 0.6, by = HY - 20; let px = bx, py = by; for (let q = 0; q < 12; q++) { const u = q / 12, nx2 = px - len / 12 * (0.8 + u * 0.3), ny2 = py - len / 12 * (0.4 - u * 1.1) + Math.sin(t * 5 + k * 0.9 + q * 0.6) * 1.1; sLock(px, py, nx2, ny2, 0, Math.max(0.5, 2.2 - u * 1.8), u > 0.7 ? R.violet : R.lav, u > 0.7 ? 3 : u > 0.35 ? 4.6 : 5.6, false); px = nx2; py = ny2; } }
      // the helm
      sPoly([[HX - 15, HY + 22], [HX + 15, HY + 22], [HX + 17, HY - 4], [HX + 12, HY - 18], [HX - 12, HY - 18], [HX - 17, HY - 4]], (x, y) => { const u = (x - HX) / 17, v = (y - HY) / 20; let b = 2.2 + (-u * lx > 0.25 ? 1.4 : -u * lx < -0.35 ? -1 : 0) + (Math.abs(u + 0.3 * Math.sign(lx || 1)) < 0.05 ? 2.2 : 0) + (Math.abs(x - HX) < 0.6 ? 1.2 : Math.abs(x - HX - 1) < 0.6 ? -0.6 : 0) + (v < -0.5 ? 0.6 : 0) + (vn(x * 0.9, y * 0.9, 2, 745) > 0.68 ? -0.5 : 0);
        // an engraved border a few pixels in from the edge, and a band across the brow
        const inner = Math.abs(Math.abs(u) - 0.82) < 0.05 || Math.abs(y - (HY - 7)) < 0.5; if (inner) return band(R.lav, 3.4 + (u * -lx > 0 ? 1 : 0)); return band(R.steel, b); });
      sEll(HX, HY - 17, 12, 5, (x, y, u, v) => band(R.steel, 4 + (v < 0 ? 1 : 0)));
      // rivets and breaths
      for (let k = 0; k < 6; k++) { sp(HX - 13 + k * 5.2, HY - 12, C('steel', 6)); }
      for (let k = 0; k < 4; k++) for (let j = 0; j < 4; j++) sp(HX + 4 + k * 2, HY + 8 + j * 2.5, C('ink', 0));
      // the slit: a dark band with a cross bar
      sPoly([[HX - 14, HY - 2], [HX + 15, HY - 2], [HX + 15, HY + 1], [HX - 14, HY + 1]], C('ink', 0));
      sPoly([[HX - 1, HY], [HX + 2, HY], [HX + 2, HY + 12], [HX - 1, HY + 12]], C('ink', 0));
      for (const ex of [HX - 8, HX + 7]) { const r = 0.8 + ea * 1.6; sEll(ex, HY - 0.5, r * 1.8, r * 0.8, (x, y, u, v) => (Math.hypot(u, v) < 0.55 && ea > 0.2 ? C('snow', 7) : C('violet', ea > 0.5 ? 7 : 6)), 3); }
      // the gorget's rivets and a violet cord
      for (let k = 0; k < 5; k++) sp(-8 + k * 4.5, -27, C('steel', 6));
      for (let x = -10; x <= 12; x++) sp(x, -24 + Math.round(Math.sin(x * 0.5)), C('violet', 4));
      return { head: [HX, HY], eyes: [[HX - 8, HY - 0.5], [HX + 7, HY - 0.5]], mouth: [HX, HY + 8], chest: [0, -12] };
    };

    /* ---------------------------------------------------------------- Tamo's bust: a round friendly face, a teal topknot with a gold
    // ring, a spiky fringe, rosy cheeks; broad shoulders in a linen tunic with a sea-blue collar and a coil of rope over one shoulder.
    // P.fish: a fish draped over his head (flap phase); P.glow 0..1: his power lighting him teal; P.sweat */
    function hairT(pts, base, hi, strands) {
      let cx = 0, cy = 0; for (const p of pts) { cx += p[0] / pts.length; cy += p[1] / pts.length; }
      sPoly(pts, (x, y) => { const l = (x - cx) * LIGHTS.x * 0.18 + (y - cy) * LIGHTS.y * 0.18; let v = base + (l > 0.5 ? 1 : l < -0.6 ? -1 : 0); if (strands && strands(x, y)) v -= 1; if (hi && hi(x, y)) v += 1.6; return band(R.teal, v); });
    }
    BUSTS.tamo = function (P, t) {
      const F = P.face || {}, hy = (P.headY || 0), hx = (P.headX || 0), breathe = Math.sin(t * 2.1) > 0.4 ? -1 : 0, gl = P.glow || 0;
      const HX = 3 + hx, HY = -42 + hy + breathe, sw = Math.round(Math.sin(t * 2.3) * 0.6);
      const skin = (v) => band(gl > 0.5 ? R.tan : R.tan, v);
      // the anchor over his shoulder, behind him, crown up (P.anchor: its glow)
      if (P.anchor !== undefined) { HB.toSprite(); anchorArt(-22 + 240, 10 + 135, PI + 0.75, 1.15, P.anchor, t); TGT = FRAME; }
      // shoulders: broad, a linen tunic, darker where it folds
      sPoly([[-27, 0], [-26, -10], [-19, -18], [-7, -21], [13, -21], [24, -18], [30, -10], [31, 0]], (x, y) => { const u = x / 26, v = (y + 10) / 10, l = litOf(u, v); return band(R.linen, 4 + (l > 0.3 ? 1 : l < -0.35 ? -1 : 0) + (Math.abs(x + 15 - (y + 18) * 0.3) < 0.6 ? -1 : 0) + (Math.abs(x - 19 + (y + 16) * 0.25) < 0.6 ? -1 : 0)); });
      // the sea-blue collar band round the neckline
      sPoly([[-7, -21], [13, -21], [10, -15], [3, -12], [-4, -15]], (x, y) => band(R.sea, y < -19 ? 4 : 3));
      // neck
      sPoly([[HX - 6, HY + 9], [HX + 7, HY + 9], [HX + 6, -18], [HX - 6, -18]], (x, y) => skin(y < HY + 15 ? 3 : 4));
      sPoly([[-3, -21], [9, -21], [6, -16], [3, -14], [0, -16]], (x, y) => skin(4));
      // a coil of rope over the near shoulder, twisted
      for (let k = 0; k < 26; k++) { const u = k / 25, rx = lerp(-20, 14, u), ry = lerp(-19, -1, u) - Math.sin(u * PI) * 2; sEll(rx, ry, 2.3, 2.3, (x, y, uu, vv) => band(R.wood, 4 + (uu + vv < -0.3 ? 1 : uu + vv > 0.6 ? -1 : 0) + ((k & 1) && uu > 0 ? -1 : 0))); }
      // ears
      sEll(HX - 12, HY + 2, 2.6, 3.6, (x, y, u, v) => skin(4 + (u < 0 ? -1 : 0) + (Math.abs(u) < 0.3 && Math.abs(v) < 0.4 ? -1 : 0)));
      // the face: round, a soft jaw
      sEll(HX, HY, 13, 14.5, (x, y, u, v) => {
        if (v > 0.15) { const uu = u - 0.12 * (v - 0.15), half = 1 - Math.pow((v - 0.15) / 0.85, 1.8) * 0.48; if (Math.abs(uu) > half) return -1; }
        const l = litOf(u, v * 0.8); let s = 5 + (l > 0.4 ? 1 : l < -0.45 ? -1 : 0); if (v > 0.8) s -= 1; if (v < -0.4) s -= 0.6; return skin(s);
      });
      pFace(P, Object.assign({ blush: F.blush === undefined ? 0.5 : F.blush }, F), 0, HY - 1, HX - 9, HX + 2, HX + 3, HY + 9, R.tan, R.earth);
      sp(HX + 5, HY + 4, C('tan', 3)); sp(HX + 5, HY + 5, C('tan', 3)); sp(HX + 4, HY + 6, C('tan', 4)); sp(HX + 6, HY + 5, C('tan', 6));
      // the topknot: a ball of hair on the crown, bound with a gold ring, a tuft out of the top
      sEll(HX - 3 + sw * 0.3, HY - 21, 5.2, 4.6, (x, y, u, v) => band(R.teal, 3 + (litOf(u, v) > 0.25 ? 1.4 : litOf(u, v) < -0.35 ? -1 : 0) + (Math.abs(u + v * 0.4) < 0.12 ? -1 : 0)));
      sLock(HX - 3, HY - 25, HX - 6 + sw, HY - 30, 0.6, 1.4, R.teal, 4, true); sLock(HX - 2, HY - 25, HX + 1 + sw, HY - 29, -0.5, 1.1, R.teal, 4, false);
      sPoly([[HX - 7, HY - 18], [HX + 1, HY - 18], [HX + 1, HY - 15], [HX - 7, HY - 15]], (x, y) => band(R.gold, 5 + (x < HX - 4 ? 1 : 0) - (y > HY - 16 ? 1 : 0)));
      // the crown of hair: short, a band of light across it
      sEll(HX - 0.5, HY - 7, 14, 10.5, (x, y, u, v) => (v > 0.28 ? -1 : band(R.teal, 2.6 + (Math.abs(Math.hypot(u + 0.1, v + 0.15) - 0.72) < 0.1 && v < 0 && u > -0.6 ? 1.3 : 0) + (litOf(u, v) > 0.5 ? 1 : litOf(u, v) < -0.5 ? -1 : 0) + (Math.abs(u * 6 - fl(u * 6) - 0.5) < 0.08 && v < -0.2 ? -1 : 0))));
      // the fringe: spiky locks falling forward and to his right
      const BG = [[-11, -6, 7, -1], [-7, -1, 9, 1], [-2, 4, 10, 2], [3, 9, 9, 3], [8, 13, 6, 2]];
      for (const [a, b, len, sweep] of BG) hairT([[HX + a, HY - 10], [HX + b, HY - 10], [HX + b + sweep + sw * 0.3, HY - 10 + len * 0.55], [HX + (a + b) / 2 + sweep + 1, HY - 10 + len], [HX + a + sweep * 0.4, HY - 10 + len * 0.45]], 3, (x, y) => y > HY - 10 + len * 0.5 && y < HY - 10 + len * 0.7 && x > HX + a + 1, (x, y) => Math.abs(x - (HX + (a + b) / 2) - (y - HY + 10) * 0.25) < 0.5);
      // short sides: a sideburn in front of the ear
      hairT([[HX - 13, HY - 7], [HX - 9, HY - 7], [HX - 9, HY + 2], [HX - 11, HY + 5], [HX - 13, HY]], 2.4);
      // sweat
      if (P.sweat) for (const [dx, dy, ph] of [[11, -4, 0], [-8, 2, 0.4], [13, 4, 0.7]]) { const u = frac(t * 0.9 + ph), yy = HY + dy + u * 9; if (u < 0.85) { sp(HX + dx, yy, C('sky', 7), 3); sp(HX + dx, yy + 1, C('sky', 5), 3); } }
      // the fish draped over his head
      if (P.fish !== undefined) {
        // a big silver fish draped across the crown: head hanging over his brow on the right, tail flapping off the back
        const fp = Math.sin(P.fish * 22), cx0 = HX + 1, cy0 = HY - 17;
        const spine = (a) => [cx0 + a, cy0 + Math.pow(a / 15, 2) * 9 + (a < -10 ? fp * (-10 - a) * 0.5 : 0)];
        for (let a = -16; a <= 16; a += 0.5) {
          const u = (a + 16) / 32, wd = Math.sin(Math.min(1, u * 1.15) * PI) * 5.2 + 0.5, [qx, qy] = spine(a);
          for (let b = -wd; b <= wd; b += 0.5) sp(qx, qy + b, b < -wd * 0.45 ? C('sea', 2) : b < -wd * 0.1 ? C('steel', 4) : b > wd * 0.55 ? C('hush', 7) : ((fl(a / 2) + fl(b)) & 1) ? C('steel', 6) : C('hush', 5), 2);
        }
        const [tx, ty] = spine(-16); for (const sd of [-1, 1]) for (let q = 0; q < 7; q += 0.5) sp(tx - q * 0.7, ty + sd * q * 0.9 + fp * q * 0.4, C('sea', sd < 0 ? 2 : 4), 2);
        const [ex, ey] = spine(12); sp(ex, ey - 1, C('ink', 0), 2); sp(ex + 1, ey - 1, C('ink', 0), 2); sp(ex, ey - 2, C('snow', 7), 3);
        const [gx, gy] = spine(8); for (let q = -3; q <= 2; q++) sp(gx, gy + q, C('crimson', 3), 2);
        const [mx, my] = spine(16); sp(mx, my + 1, C('ink', 0), 2); sp(mx - 1, my + 2, C('ink', 0), 2);
        const [fx2, fy2] = spine(-2); for (let q = 0; q < 5; q++) sp(fx2 - q, fy2 - 5 - (q < 3 ? 1 : 0), C('sea', 3), 2);
      }
      return { head: [HX, HY - 4], mouth: [HX + 3, HY + 9], chest: [2, -12] };
    };

    /* ---------------------------------------------------------------- the dockhand's bust: a weathered face under a wool cap, a big grey beard,
    // a clay pipe; P.puff 0..1 */
    BUSTS.docker = function (P, t) {
      const F = P.face || {}, HX = 3 + (P.headX || 0), HY = -41 + (P.headY || 0) + (Math.sin(t * 1.6) > 0.5 ? -1 : 0), m = F.mouth || 0;
      sPoly([[-28, 0], [-27, -10], [-20, -19], [-8, -22], [14, -22], [24, -19], [31, -10], [32, 0]], (x, y) => { const u = x / 26, v = (y + 10) / 10, l = litOf(u, v); return band(R.rust, 3 + (l > 0.3 ? 1 : l < -0.35 ? -1 : 0) + ((fl(x / 2) + fl(y / 2)) & 1 ? 0 : -0.5 * 0)); });
      for (let y = -21; y < 0; y += 2) for (let x = -27; x < 31; x++) if (sstep(-1, 1, 1) && ((x + (y >> 1)) % 4 === 0)) sp(x, y, C('rust', 2));
      // apron bib and straps
      sPoly([[-6, -14], [14, -14], [15, 0], [-7, 0]], (x, y) => band(R.earth, 4 + (x < -3 ? -1 : 0)));
      for (const sx of [-6, 13]) sPoly([[sx, -14], [sx + 2, -14], [sx + (sx < 0 ? -4 : 5), -22], [sx + (sx < 0 ? -6 : 3), -22]], C('earth', 3));
      sEll(HX - 12, HY + 2, 2.6, 3.6, (x, y, u, v) => band(R.skin, 3 + (u < 0 ? -1 : 0)));
      sEll(HX, HY, 12.5, 14, (x, y, u, v) => { if (v > 0.3) { const uu = u - 0.1 * v, half = 1 - Math.pow((v - 0.3) / 0.7, 1.6) * 0.4; if (Math.abs(uu) > half) return -1; } const l = litOf(u, v * 0.8); return band(R.skin, 4.4 + (l > 0.4 ? 1 : l < -0.45 ? -1 : 0) + ((Math.abs(v + 0.15) < 0.04 || Math.abs(v - 0.05) < 0.03) && u < 0.4 && u > -0.6 ? -0.8 : 0)); });
      // the beard: a big grey mass from the cheeks down over the chest
      sPoly([[HX - 11, HY + 2], [HX - 6, HY + 6], [HX + 10, HY + 6], [HX + 13, HY + 2], [HX + 13, HY + 12], [HX + 8, HY + 24], [HX + 1, HY + 27], [HX - 6, HY + 23], [HX - 11, HY + 12]], (x, y) => { const l = litOf((x - HX) / 12, (y - HY - 12) / 12); return band(R.stone, 4.4 + (l > 0.3 ? 1 : l < -0.3 ? -1 : 0) - (Math.abs(frac((x - HX) / 3 + (y - HY) * 0.08) - 0.5) < 0.12 ? 1 : 0)); });
      pFace(P, Object.assign({ eyes: 'half' }, F, { mouth: 0, smile: 0 }), 0, HY - 2, HX - 9, HX + 2, HX + 3, HY + 9, R.skin, R.sky);
      // the bushy grey brows (over pFace's)
      for (const ex of [HX - 9, HX + 2]) for (let i = -1; i < 9; i++) { sp(ex + i, HY - 5 - (i > 2 && i < 6 ? 1 : 0), C('stone', 6)); sp(ex + i, HY - 4, C('stone', 5)); }
      // a big nose
      sEll(HX + 6, HY + 4, 3, 3, (x, y, u, v) => band(R.skin, 3.6 + (litOf(u, v) > 0.2 ? 1 : -0.6)));
      // the mustache, and the mouth inside the beard
      sPoly([[HX - 4, HY + 8], [HX + 12, HY + 8], [HX + 13, HY + 11], [HX + 4, HY + 10], [HX - 5, HY + 11]], (x, y) => band(R.stone, 5.4 - (y > HY + 9 ? 1 : 0)));
      if (m > 0.12) sPoly([[HX + 1, HY + 11], [HX + 8, HY + 11], [HX + 7, HY + 11 + m * 4], [HX + 2, HY + 11 + m * 4]], C('crimson', 1));
      // the pipe: a clay stem from the corner of his mouth, the bowl smouldering
      for (let q = 0; q < 10; q++) sp(HX + 9 + q, HY + 11 + q * 0.35, C('linen', 6));
      sPoly([[HX + 17, HY + 7], [HX + 22, HY + 7], [HX + 21, HY + 15], [HX + 18, HY + 15]], (x, y) => band(R.wood, 3 + (x > HX + 19 ? -1 : 0)));
      for (let x = HX + 18; x < HX + 22; x++) sp(x, HY + 7, (P.puff || 0) > 0.5 ? C('fire', 6) : C('ember', 4), 3);
      // the cap: a wool watch cap, rolled brim, ribbed
      sEll(HX - 1, HY - 8, 14.5, 10, (x, y, u, v) => (v > 0.3 ? -1 : band(R.olive, 2.4 + (litOf(u, v) > 0.4 ? 1 : litOf(u, v) < -0.4 ? -1 : 0) + ((x & 1) && v < 0.05 ? -0.6 : 0))));
      sPoly([[HX - 15, HY - 8], [HX + 14, HY - 8], [HX + 14, HY - 4], [HX - 15, HY - 3]], (x, y) => band(R.olive, 3.4 + (y < HY - 7 ? 1 : 0) - ((x & 1) ? 0.6 : 0)));
      // grey hair under the cap at the back
      sPoly([[HX - 14, HY - 4], [HX - 9, HY - 4], [HX - 10, HY + 4], [HX - 13, HY + 2]], C('stone', 5));
      return { head: [HX, HY - 4], mouth: [HX + 4, HY + 10], chest: [2, -12], pipe: [HX + 20, HY + 6] };
    };
  }

  /* ================================================================ the world: painted layers */
  // Scenes are composed in 2D, back to front, like a matte painting: sky, far ridges, the village, the set, figures,
  // then weather and light. Each helper draws at the frame's own pixels with stepped, hand-placed-looking shading.
  // camera: a layer at depth z (1 = the action plane) is offset by the camera position divided by z
  const CAM = { x: 0, y: 0 };
  const px_ = (x, z) => x - CAM.x / (z || 1), py_ = (y, z) => y - CAM.y / (z || 1);
  function vgrad(y0, y1, ramp, v0, v1, x0, x1) { x0 = x0 || 0; x1 = x1 || W; for (let y = Math.max(0, fl(y0)); y < Math.min(H, y1); y++) { const v = lerp(v0, v1, (y - y0) / Math.max(1, y1 - y0)); for (let x = Math.max(0, x0); x < Math.min(W, x1); x++) BUF[y * W + x] = cel(ramp, v, x, y); } }
  // pixel clouds: banks of rounded lumps with a lit top edge and a shadowed belly, 3-4 hard tones
  function cloudBank(y, h, z, ramp, base, seed, t, drift) {
    const ox = CAM.x / z + (t || 0) * (drift || 2);
    for (let x = 0; x < W; x++) {
      const wx = x + ox, top = y - (fbm(wx, seed, 38, 3, seed) - 0.3) * h * 1.6 - Math.max(0, Math.sin(wx / 23 + seed)) * h * 0.35;
      for (let yy = Math.max(0, fl(top)); yy < Math.min(H, y + h * 0.6); yy++) {
        const d = yy - top, n = vn(wx * 0.6, yy * 1.2, 7, seed + 5);
        BUF[yy * W + x] = cel(ramp, base + (d < 1.5 ? 1.6 : d < 4 ? 0.8 : 0) - (yy > y + h * 0.2 ? 0.7 : 0) + (n > 0.62 ? 0.5 : 0), x, yy);
      }
    }
  }
  // a ridge line, filled below: stepped noise, a lit crest
  function ridge(yb, amp, freq, z, ramp, base, seed, crest) {
    const ox = CAM.x / z;
    for (let x = 0; x < W; x++) {
      const wx = x + ox, top = yb - fbm(wx, 0, freq, 4, seed) * amp - Math.abs(Math.sin(wx / freq / 1.7 + seed)) * amp * 0.4;
      for (let y = Math.max(0, fl(top)); y < H; y++) BUF[y * W + x] = cel(ramp, base + (y - top < 1.5 && crest ? crest : 0) - (y - top > 30 ? 0.5 : 0), x, y);
    }
  }
  // a timber house front: plastered or planked walls, a tiled roof with deep eaves, lit paper windows
  // (x, yb: the middle of its base; w, h: wall size; rh: roof height; lit: 0..1 share of lit windows)
  function house(x, yb, w, h, rh, o) {
    o = o || {}; const wall = o.wall === undefined ? R.wood : o.wall, roofR = o.roof === undefined ? R.ink : o.roof, sh = o.shade || 0, seed = o.seed || 1, lit = o.lit === undefined ? 0.6 : o.lit;
    const x0 = Math.round(x - w / 2), x1 = Math.round(x + w / 2), yt = Math.round(yb - h);
    for (let yy = yt; yy < yb; yy++) for (let xx = x0; xx < x1; xx++) {
      if (xx < 0 || xx >= W || yy < 0 || yy >= H) continue;
      const u = xx - x0, v = yy - yt, plank = o.plaster ? 0 : (u % 4 === 0 ? -0.8 : 0), beam = (v === 1 || u === 0 || u === w - 1 || (w > 16 && Math.abs(u - fl(w / 2)) < 1)) ? -1 : 0;
      let c = cel(wall, 2.6 + sh + plank + beam + (u < 2 ? 0.6 : 0), xx, yy);
      // windows: a grid of paper panes, warm when lit
      const cw = Math.max(5, fl(w / 3)), wu = u % cw, wv = v - 3, cell = fl(u / cw) * 7 + seed * 13;
      if (h > 9 && wv >= 0 && wv < Math.min(6, h - 6) && wu >= 2 && wu < cw - 1) { const on = ih(cell, seed, 3) < lit; c = on ? (wu === 2 || wv === 0 ? C('fire', 4) : ((wu + wv) % 3 === 0 ? C('fire', 5) : C('fire', 6))) : C('ink', 2); if (on) LAMPS.push([xx, yy]); }
      BUF[yy * W + xx] = c;
    }
    // the roof: a trapezoid of tile rows with an upswept eave
    const ov = Math.max(2, fl(w * 0.14)), ry = yt - rh;
    for (let yy = ry; yy < yt + 1; yy++) {
      const v = (yy - ry) / Math.max(1, rh), half = lerp(w * 0.22, w / 2 + ov, v) + (v > 0.85 ? 1 : 0);
      for (let xx = Math.round(x - half); xx < Math.round(x + half); xx++) {
        if (xx < 0 || xx >= W || yy < 0 || yy >= H) continue;
        const row = (yy - ry) % 3 === 0, edge = xx === Math.round(x - half) || xx === Math.round(x + half) - 1;
        BUF[yy * W + xx] = edge || yy === yt ? C(roofR, 0) : cel(roofR, 2.2 + sh + (row ? -1 : 0) + (xx < x ? 0.5 : 0) + (v < 0.2 ? 0.8 : 0), xx, yy);
      }
    }
    if (o.chimney) rectF(x + w * 0.2, ry - 4, 3, 6, C('stone', 1 + sh));
  }
  const LAMPS = [];
  // a paper lantern: ribbed, glowing, swinging a little
  function lantern(x, y, r, t, seed, ramp) {
    ramp = ramp === undefined ? R.crimson : ramp; const sw = Math.sin(t * 1.3 + seed) * 1.2;
    x += sw; line(x - sw, y - r * 1.6 - 6, x, y - r * 1.2, C('ink', 1));
    fillEll(x, y, r * 0.9, r * 1.15, 0, (xx, yy, u, v) => cel(ramp, 5.2 - Math.abs(u) * 2.4 - (frac((u + 1) * 2.5) < 0.18 ? 1 : 0) + (Math.abs(v) > 0.82 ? -2 : 0), xx, yy));
    rectF(x - r * 0.5, y - r * 1.2, r, 2, C('ink', 1)); rectF(x - r * 0.5, y + r * 1.05, r, 2, C('ink', 1));
    glow(x, y, r * 4.5, tab('#ff8a3a', true), 0.4);
  }
  // fire: a banded flame field (white core, yellow, orange, red, a wisp of smoke) that licks upward with the noise,
  // sparks that climb and wink out, and the glow it throws around it
  function fire(x, y, s, t, seed, o) {
    o = o || {}; const w = s * 0.75, h = s * 2.0, sp = t * 2.4;
    for (let yy = 0; yy < h; yy++) for (let xx = -fl(w) - 1; xx <= w + 1; xx++) {
      const u = xx / w, tongue = (1 - Math.min(1, Math.abs(u)) ** 1.6) * h * (0.55 + 0.45 * vn(xx * 0.35 + seed * 9, sp * 1.6, 1, seed));
      const n = fbm(xx * 0.9 + seed * 17, yy * 0.55 + sp * s * 0.9, 3.2, 2, seed + 3);
      const heat = 1 - yy / Math.max(1, tongue) + (n - 0.5) * 0.9 - Math.abs(u) * 0.25;
      let c = -1;
      if (heat > 0.82) c = WHITE; else if (heat > 0.6) c = C('fire', 6); else if (heat > 0.42) c = C('fire', 4); else if (heat > 0.26) c = C('ember', 5); else if (heat > 0.13) c = C('ember', 3);
      else if (heat > 0.02 && yy > h * 0.35 && o.smoke !== false && ((xx + yy) & 1)) c = C('stone', 2);
      if (c >= 0) put(fl(x + xx + Math.sin(yy * 0.3 + sp * 3) * yy * 0.06), fl(y - yy), c);
    }
    for (let k = 0; k < (o.sparks === undefined ? 14 : o.sparks); k++) {
      const life = 0.9 + ih(k, 1, seed) * 0.9, u = frac(ih(k, 2, seed) + t / life), sx = x + (ih(k, 3, seed) - 0.5) * w * 1.4 + Math.sin(t * 3 + k) * u * s * 0.5, sy = y - h * 0.4 - u * s * 3.2;
      if (u < 0.85) put(fl(sx), fl(sy), u < 0.3 ? WHITE : u < 0.6 ? C('fire', 6) : C('ember', 4));
    }
    if (o.glow !== false) glow(x, y - s * 0.6, s * 4.5, tab('#ff9040', true), 0.5 + Math.sin(t * 13) * 0.04 + Math.sin(t * 7.3) * 0.04);
  }
  // rain splashes on a floor band: a crown of droplets, then a ring that spreads and fades (frozen: hold them)
  function splashes(t, y0, y1, n, seed, frozen) {
    const tt = frozen === undefined ? t : frozen;
    for (let k = 0; k < n; k++) {
      const per = 0.35 + ih(k, 1, seed) * 0.4, ph = frac(tt / per + ih(k, 2, seed)), cyc = fl(tt / per + ih(k, 2, seed));
      const x = fl(ih(k, cyc, seed + 1) * W), y = fl(lerp(y0, y1, ih(k, cyc, seed + 2))), sc = 0.5 + (y - y0) / Math.max(1, y1 - y0);
      if (ph < 0.25) { put(x, y - 1, C('sky', 6)); put(x - 1, y - 2, C('sky', 5)); put(x + 1, y - 2, C('sky', 5)); }
      else { const r = (ph - 0.15) * 6 * sc; for (let a = 0; a < TAU; a += 0.5 / Math.max(1, r)) { const px = fl(x + Math.cos(a) * r), py = fl(y + Math.sin(a) * r * 0.35); if (py >= 0 && py < H && px >= 0 && px < W && ph < 0.85) tintI(py * W + px, px, py, tab('#9fb8e8', true), 0.35 * (1 - ph)); } }
    }
  }
  // rain: slanted streaks in three depths; drops splash where they hit the floor (y > floorY)
  function rain(t, n, ang, floorY, frozen) {
    for (let k = 0; k < n; k++) {
      const z = 1 + (k % 3), sp = (420 + ih(k, 1, 51) * 160) / z, len = 12 / z + 3, tt = frozen === undefined ? t : frozen;
      const x0 = ih(k, 2, 51) * (W + 80) - 40, y = ((tt * sp + ih(k, 3, 51) * 400) % (H + 40)) - 20, x = x0 + y * ang;
      const c = z === 1 ? C('sky', 5) : z === 2 ? C('night', 5) : C('night', 4);
      for (let j = 0; j < len; j++) put(fl(x - j * ang), fl(y - j), c);
      if (frozen === undefined && floorY && y > floorY && z === 1 && ih(k, fl(t * 6), 52) < 0.3) { put(fl(x) - 1, fl(y) - 1, C('sky', 6)); put(fl(x) + 1, fl(y) - 1, C('sky', 6)); }
    }
  }
  // low drifting fog: a band of soft tint with holes
  function fog(y0, y1, T, a, t, seed) { for (let y = Math.max(0, fl(y0)); y < Math.min(H, y1); y++) for (let x = 0; x < W; x++) { const n = fbm(x + t * 6, y * 2.5, 40, 3, seed); const k = a * sstep(0.35, 0.7, n) * Math.sin((y - y0) / (y1 - y0) * PI); if (k > 0.02) tintI(y * W + x, x, y, T, k); } }
  // embers drifting up from a point
  function embers(x, y, n, spread, t, seed) { for (let k = 0; k < n; k++) { const u = frac(ih(k, 1, seed) + t * (0.25 + ih(k, 2, seed) * 0.3)); const ex = x + (ih(k, 3, seed) - 0.5) * spread + Math.sin(t * 2 + k) * 6 * u, ey = y - u * 90; put(fl(ex), fl(ey), u < 0.3 ? C('fire', 6) : u < 0.7 ? C('ember', 5) : C('ember', 3)); } }
  function letterbox(h) { rectF(0, 0, W, h, BLACK); rectF(0, H - h, W, h, BLACK); }
  // the lens: after a shot has painted its 1× stage, show part of it magnified Z times around (fx, fy), so the
  // characters and the world always share one pixel size (a close-up is the same picture, nearer)
  const ZT = new Uint8Array(NP);
  function view(fx, fy, Z) {
    if (Z <= 1.001 && Math.abs(fx - W / 2) < 0.5 && Math.abs(fy - H / 2) < 0.5) return;
    ZT.set(BUF);
    const x0 = clamp(fx - W / 2 / Z, 0, W - W / Z), y0 = clamp(fy - H / 2 / Z, 0, H - H / Z);
    for (let y = 0; y < H; y++) { const sy = Math.min(H - 1, fl(y0 + (y + 0.5) / Z)), o = sy * W; for (let x = 0; x < W; x++) BUF[y * W + x] = ZT[o + Math.min(W - 1, fl(x0 + (x + 0.5) / Z))]; }
  }
  // depth of field: blur what is behind the subject and put it back into the palette (a 32-level colour cube lookup),
  // so a close-up's background melts into soft bands and its lights into round bokeh. k: blur radius (frame px)
  let LUT = null;
  function lut() {
    if (LUT) return LUT; LUT = new Uint8Array(32768);
    for (let r = 0; r < 32; r++) for (let g = 0; g < 32; g++) for (let b = 0; b < 32; b++) LUT[(r << 10) | (g << 5) | b] = nearest(r * 8.2, g * 8.2, b * 8.2);
    return LUT;
  }
  const DR = new Float32Array(NP), DG = new Float32Array(NP), DB = new Float32Array(NP), DT = new Float32Array(NP);
  function boxPass(A, k, horiz) {
    for (let a = 0; a < (horiz ? H : W); a++) {
      let acc = 0; const n = horiz ? W : H, st = horiz ? 1 : W, o = horiz ? a * W : a;
      for (let i = -k; i <= k; i++) acc += A[o + clamp(i, 0, n - 1) * st];
      for (let i = 0; i < n; i++) { DT[o + i * st] = acc / (2 * k + 1); acc += A[o + clamp(i + k + 1, 0, n - 1) * st] - A[o + clamp(i - k, 0, n - 1) * st]; }
      for (let i = 0; i < n; i++) A[o + i * st] = DT[o + i * st];
    }
  }
  function defocus(k, boost) {
    const L = lut(); boost = boost || 1.25;
    for (let i = 0; i < NP; i++) { const p = PAL[BUF[i]], hot = LUM[BUF[i]] > 170 ? boost : 1; DR[i] = p[0] * hot; DG[i] = p[1] * hot; DB[i] = p[2] * hot; }
    for (const A of [DR, DG, DB]) for (let pass = 0; pass < 2; pass++) { boxPass(A, k, true); boxPass(A, k, false); }
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = y * W + x, d = (bay(x, y) - 0.5) * 6; BUF[i] = L[(clamp(fl((DR[i] + d) / 8.2), 0, 31) << 10) | (clamp(fl((DG[i] + d) / 8.2), 0, 31) << 5) | clamp(fl((DB[i] + d) / 8.2), 0, 31)]; }
  }
  // light shafts: rays from a point, brightening what they cross, broken up so they read as beams through rain
  function rays(cx, cy, n, len, T, a, t, seed) {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const dx = x - cx, dy = y - cy, d = Math.hypot(dx, dy); if (d > len || d < 4) continue;
      const ang = Math.atan2(dy, dx), beam = vn(ang * n + seed, t * 0.3, 1, seed);
      if (beam < 0.55) continue;
      tintI(y * W + x, x, y, T, a * (beam - 0.55) / 0.45 * (1 - d / len));
    }
  }

  /* ================================================================ dialogue: timings and mouth envelopes (generated from audio3) */
  const DLG = [{"id": "L01", "who": "sable_vo", "text": "Everything has a name.", "t0": 3.0, "dur": 1.924, "env": "2310000000000000146655642246555556544567777666655421000000"}, {"id": "L02", "who": "sable_vo", "text": "A name is a promise... that something was here.", "t0": 9.6, "dur": 3.724, "env": "4677777776665555410145443101256776432233432100000000000000000025764233456642013555553100134554311466553332100000"}, {"id": "L03", "who": "mira", "text": "Sable! I wrote it! I wrote my name on the wall, just like you showed me!", "t0": 18.3, "dur": 4.384, "env": "000015776533566542000000013664332235676655653100000001354223665446777777666666533466655310001355312576323454333467765444554310000000"}, {"id": "L04", "who": "sable", "text": "[chuckle] Then the wall will remember you. Even when I'm old and forgetful.", "t0": 24.6, "dur": 4.839, "env": "01342101331000000111000013677777655667777653345544455555555444323344333210000000000000000246645777776666666777766532334310133366642101232221000000"}, {"id": "L05", "who": "king", "text": "Hush now.", "t0": 38.4, "dur": 1.704, "env": "0245544333322100000000002566666654444432000000000000"}, {"id": "L06", "who": "mira", "text": "Sable...?", "t0": 52.4, "dur": 0.725, "env": "0134664356655310000000"}, {"id": "L07", "who": "sable", "text": "Mira, take my hand! Don't let go. Don't let go!", "t0": 55.4, "dur": 4.11, "env": "0245555554200000000012355410146644567654443100000000000013677765577522357777665320000000001467765567763114677777655420000000"}, {"id": "L08", "who": "sable", "text": "No! Mira!", "t0": 60.5, "dur": 2.28, "env": "111000001222356677777776666554310000000000023466666667777653100000000"}, {"id": "L09", "who": "sable_vo", "text": "I don't remember her face anymore.", "t0": 66.2, "dur": 2.644, "env": "36546764467777777766543210000000000000001331013555322333211356666666544431000000"}, {"id": "L10", "who": "sable_vo", "text": "I remember that I swore.", "t0": 77.4, "dur": 2.244, "env": "24655556666666654431000000000000000000145666655553236766544310000000"}, {"id": "L11", "who": "warden", "text": "The Storm Seed... it's gone!", "t0": 104.9, "dur": 1.9, "env": "134442356666655555555544322211113444213577777654333332100"}, {"id": "L12", "who": "oren", "text": "The courier. Kaira was the last one in the vault. Find her!", "t0": 107.0, "dur": 5.7, "env": "132223565443322211110000000001235676665544443334554345545666665543445666554443333234543210000000000000000000003687777767776554433333222111000000000000000000000000000000000"}, {"id": "L13", "who": "kaira", "text": "[gasp] Okay. Okay. Framed, chased, and glowing. Great start to the week.", "t0": 123.0, "dur": 5.259, "env": "01232100000000000000026875456543100000000000002687545776654200000000000014676676431124566553211125654456666655432210000000146752121256542223455566653100000000"}, {"id": "L14", "who": "oren", "text": "Courier! Return the Seed!", "t0": 128.6, "dur": 2.639, "env": "23456777765543200000000000000001356531144346666666656777765555555555543100000000"}, {"id": "L15", "who": "kaira", "text": "I don't HAVE it!", "t0": 131.6, "dur": 1.344, "env": "35655555420000000135666545665310000000000"}, {"id": "L16", "who": "kaira", "text": "[sigh] Okay. I might have it.", "t0": 134.3, "dur": 2.309, "env": "1257887776420000000000001442134210000000000001456554212343235542000000"}, {"id": "L17", "who": "oren", "text": "Five days, courier. That's how long the elders give you before it tears you apart. Come quietly.", "t0": 153.5, "dur": 6.284, "env": "011356666766433577654334431244431000000000000000001467555457754446777665544431257765565554335653334321123323566410233246666544566411235764211100000000013457777765310111136776432001100000000"}, {"id": "L18", "who": "kaira", "text": "Quiet's not really my thing.", "t0": 162.3, "dur": 1.284, "env": "126777521356665666655542113443221000000"}, {"id": "L19", "who": "tamo", "text": "Hey! That was the GOOD crate!", "t0": 182.6, "dur": 1.785, "env": "146666531000001567667753255434676532124554321000000000"}, {"id": "L20", "who": "kaira", "text": "Sorry! Not sorry! You should run.", "t0": 185.0, "dur": 2.265, "env": "01367777765432001467632235555555432000025655542467776654310000000000"}, {"id": "L21", "who": "tamo", "text": "Run from wh-", "t0": 187.6, "dur": 0.86, "env": "14667653356655531000000000"}, {"id": "L22", "who": "tamo", "text": "Three grown-ups... against one girl?", "t0": 191.6, "dur": 2.945, "env": "00135677654677777777631000000000013332100000134334554421113455555434666666654210000000000"}, {"id": "L23", "who": "docker", "text": "Kid, that anchor hasn't moved in a hundred years", "t0": 197.6, "dur": 3.24, "env": "24775200000000000025777666666542355445665445421367776543211454444456654344334566642110011000000000"}, {"id": "L24", "who": "tamo", "text": "That's not very fair... for you.", "t0": 205.6, "dur": 2.49, "env": "122213335776322577776311257776542100000000000000000002454445665431000000000"}, {"id": "L25", "who": "kaira", "text": "Okay. Who ARE you?", "t0": 221.0, "dur": 1.65, "env": "25531246665431000000001467776666677666531000000000"}, {"id": "L26", "who": "tamo", "text": "Tamo! I work here. Well. I did, until you landed on me.", "t0": 222.9, "dur": 4.095, "env": "257766676542100000135666566641002454321000000145554200000000013553247777764432354334565434677666665555555444455543210000000"}, {"id": "L27", "who": "kaira", "text": "What is that?", "t0": 230.6, "dur": 1.68, "env": "357766410110000000000002553246666664200000000000000"}, {"id": "L28", "who": "tamo", "text": "Hollow. They took the lighthouse keeper last week. Nobody even remembers his name.", "t0": 235.6, "dur": 4.745, "env": "14677666542100000000002587545763136767777656666543235411455556654432235654200000000000146665566654345544565555555554454444433455444443210000000"}, {"id": "L29", "who": "oren", "text": "No... not here. Not the harbor.", "t0": 242.2, "dur": 2.715, "env": "2566653210000000002467765324543100000000000000024667777642256544566533321000000000"}, {"id": "L30", "who": "bellwether", "text": "The courier. And the anchor-bearer. Two of four.", "t0": 262.6, "dur": 3.96, "env": "02321122345443221000000000000000001367766555444555445776544443345554433221000000000000013577788766555567655433200000000"}, {"id": "L31", "who": "bellwether", "text": "[chuckle] The King will be so pleased.", "t0": 267.0, "dur": 2.27, "env": "123332100000000244334566666677666655445676544434665554443321100000000"}, {"id": "L32", "who": "tamo", "text": "Kaira! Whatever you've got, now would be a really good time!", "t0": 279.0, "dur": 3.905, "env": "2477776677776531000000146666666556555653125666421000014666677776435667765444455555554234665433456666665542100000000000"}, {"id": "L33", "who": "kaira", "text": "I don't know how to use it!", "t0": 283.8, "dur": 1.9, "env": "356555555556766420000002467766655567777754455310000000000"}, {"id": "L34", "who": "vesper", "text": "Step away from them.", "t0": 296.0, "dur": 1.435, "env": "00002333467545666777765311454323322100000000"}];

  /* ================================================================ the cut: type, captions, lip sync, shots */
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
      for (let j = 0; j < 7; j++) for (let i = 0; i < gw; i++) if (g[j][i] === '#') { const cc = typeof c === 'function' ? c(i, j, k) : c; if (cc >= 0) rectF(cx + i * sc + jx, y + j * sc + jy, sc, sc, cc); }
      cx += (gw + 1) * sc; k++;
    }
  }

  // dialogue (from the voice pass): each line's start, length, text and mouth envelope at 30 fps
  function lineOf(who, t) { for (const l of DLG) if (l.who === who && t >= l.t0 && t < l.t0 + l.dur) return l; return null; }
  function mouth(who, t) { const l = lineOf(who, t); if (!l) return 0; const f = fl((t - l.t0) * 30), e = l.env; if (f < 0 || f >= e.length) return 0; return clamp((e.charCodeAt(f) - 48) / 9, 0, 1); }
  const talking = (who, t) => mouth(who, t) > 0.05;
  const blink = (t, seed) => frac(t / (2.6 + ih(seed, 1, 9) * 1.8) + ih(seed, 2, 9)) < 0.05;
  const LB = 22;
  const CAPCOL = { sable: C('ember', 6), sable_vo: C('ember', 6), mira: C('gold', 6), king: C('hush', 5), oren: C('indigo', 6), warden: C('indigo', 6), kaira: C('gold', 6), tamo: C('teal', 6), docker: C('wood', 6), bellwether: C('gold', 4), vesper: C('violet', 6) };
  const CAPNAME = { sable: 'SABLE', sable_vo: '', mira: 'MIRA', king: '???', oren: 'OREN', warden: 'WARDEN', kaira: 'KAIRA', tamo: 'TAMO', docker: 'DOCKHAND', bellwether: 'THE BELLWETHER', vesper: '???' };
  function captions(t) {
    for (const l of DLG) {
      if (t < l.t0 - 0.05 || t >= l.t0 + l.dur + 0.35) continue;
      const s = l.text.replace(/\[[a-z]+\]\s*/g, '').toUpperCase(), name = CAPNAME[l.who], y = H - LB + 8;
      if (l.who === 'sable_vo') { const w = textWidth(s, 1); text(s, 240 - w / 2, y, C('linen', 6), 1); continue; }
      const tag = name + ':', tw = textWidth(tag, 1), w = tw + 5 + textWidth(s, 1);
      if (w <= 456) { const x0 = 240 - w / 2; text(tag, x0, y, CAPCOL[l.who], 1); text(s, x0 + tw + 5, y, C('hush', 6), 1); continue; }
      let br = -1; for (let i = 0; i < s.length; i++) if (s[i] === ' ' && (br < 0 || Math.abs(i - s.length / 2) < Math.abs(br - s.length / 2))) br = i;
      const a = s.slice(0, br), b = s.slice(br + 1), wa = tw + 5 + textWidth(a, 1), wb = textWidth(b, 1), x0 = 240 - Math.max(wa, wb) / 2;
      text(tag, x0, H - LB + 3, CAPCOL[l.who], 1); text(a, x0 + tw + 5, H - LB + 3, C('hush', 6), 1); text(b, x0 + tw + 5, H - LB + 12, C('hush', 6), 1);
    }
  }
  const SHOTS = [];
  const shot = (t0, t1, fn, opt) => SHOTS.push(Object.assign({ t0, t1, fn }, opt || {}));
  let SHAKE_A = 0, SHX = 0, SHY = 0, T_NOW = 0;
  const shk = (a) => { SHAKE_A = Math.max(SHAKE_A, a); };
  const D = 300;
  function render(t) {
    t = clamp(t, 0, D - 1 / FPS); T_NOW = t; SHAKE_A = 0; BUF.fill(BLACK);
    LIGHT.x = -0.6; LIGHT.y = -0.8; ENV.edge = null; CAM.x = 0; CAM.y = 0; LAMPS.length = 0;
    let S = null; for (const s of SHOTS) if (t >= s.t0 && t < s.t1) S = s;
    if (S) S.fn(t - S.t0, t, S.t1 - S.t0);
    if (!S || !S.nobars) letterbox(LB);
    if (!S || !S.nocaps) captions(t);
    const f = fl(t * FPS); SHX = Math.round((ih(f, 1, 901) - 0.5) * 2 * SHAKE_A); SHY = Math.round((ih(f, 2, 901) - 0.5) * 2 * SHAKE_A);
  }
  const fade = (a) => { if (a > 0) tintAll(tab('#000000'), Math.min(1, a)); };
  const flash = (a) => { if (a > 0) tintAll(tab('#ffffff', true), Math.min(1, a)); };

  /* ================================================================ ACT ONE (a) — Halcyon Spire, now: the vault, the window, the chase, the edge */
  // ---------------------------------------------------------------- the city above the clouds, at dawn
  function skyDawn(t, sunX, sunY) {
    for (let y = 0; y < H; y++) { const u = y / H; for (let x = 0; x < W; x++) { const v = u < 0.45 ? lerp(1.2, 3.6, u / 0.45) : lerp(3.6, 5.6, (u - 0.45) / 0.55); BUF[y * W + x] = u < 0.32 ? soft(R.dusk, v + 1, x, y) : u < 0.62 ? soft(R.rose, v - 0.8, x, y) : soft(R.fire, v - 1.4, x, y); } }
    glow(sunX, sunY, 120, tab('#ffd890', true), 0.5);
    fillEll(sunX, sunY, 14, 14, 0, (x, y, u, v) => cel(R.snow, 7 - Math.hypot(u, v) * 0.6, x, y));
  }
  // a sea of cloud: banks of rounded lumps, lit gold on top, rose and violet in their bellies
  function cloudSea(y0, t, camX, z, seed, lit) {
    const ox = camX / z + t * 3;
    for (let x = 0; x < W; x++) {
      const wx = x + ox, top = y0 - (fbm(wx, seed, 30 * z, 3, seed) - 0.3) * 26 - Math.max(0, Math.sin(wx / (18 * z) + seed)) * 10;
      for (let y = Math.max(0, fl(top)); y < H; y++) { const d = y - top; BUF[y * W + x] = d < 1.5 ? cel(R.fire, 6.4, x, y) : d < 4 ? cel(R.rose, 6 + lit, x, y) : d < 12 ? cel(R.rose, 4.6 + lit + (vn(wx, y, 6, seed) > 0.6 ? 0.6 : 0), x, y) : cel(R.dusk, 4.6 - Math.min(2, (d - 12) / 20) + lit, x, y); }
    }
  }
  // a white tower of the city: a round shaft (shaded as a cylinder lit from the left), rows of gold-framed windows,
  // a gold band, a gold roof in pagoda tiers, a pennant; cx, base: bottom centre; w, h: shaft size; s: detail scale
  function spireTower(cx, base, w, h, o) {
    o = o || {}; const seed = o.seed || 1, fogA = o.fog || 0, t = o.t || 0;
    const x0 = fl(cx - w / 2), x1 = fl(cx + w / 2), top = fl(base - h);
    for (let y = Math.max(0, top); y < Math.min(H, base); y++) for (let x = Math.max(0, x0); x < Math.min(W, x1); x++) {
      const u = (x + 0.5 - cx) / (w / 2), shade = 5.6 - u * 1.8 - Math.abs(u) ** 4 * 1.4, v = y - top;
      const wrow = fl(v / 14), wv = v % 14, wcol = fl((u * 0.5 + 0.5) * Math.max(2, fl(w / 7))), wu = frac((u * 0.5 + 0.5) * Math.max(2, fl(w / 7)));
      let c = cel(R.linen, shade + (v % 6 === 0 ? -0.4 : 0), x, y);
      if (w > 8 && wv > 4 && wv < 11 && wu > 0.3 && wu < 0.7 && Math.abs(u) < 0.85) c = (wv === 5 || wu < 0.38 || wu > 0.62) ? cel(R.gold, 4 + (u < 0 ? 1 : 0), x, y) : ih(wcol, wrow, seed) < 0.25 ? cel(R.fire, 5.4, x, y) : cel(R.indigo, 2 + (wv < 7 ? 1 : 0), x, y);
      if (v > 0 && v % 42 < 2) c = cel(R.gold, 4.6 - u, x, y);
      BUF[y * W + x] = c;
    }
    // the roof: three tiers of upswept gold eaves, a spike, a pennant
    let ry = top;
    for (let k = 0; k < (o.tiers || 3); k++) {
      const rw = w * (0.75 - k * 0.18) + 6, rh = Math.max(3, w * 0.22);
      for (let y = 0; y < rh; y++) { const hw = lerp(rw * 0.3, rw / 2 + 2, y / rh) + (y > rh - 2 ? 2 : 0); for (let x = fl(cx - hw); x < cx + hw; x++) put(x, fl(ry - rh + y), y > rh - 2 ? C('gold', 2) : cel(R.gold, 5 + ((x - cx) / hw) * -1.4 + ((y + x) % 3 === 0 ? -0.6 : 0), x, ry - rh + y)); }
      ry -= rh; if (k < (o.tiers || 3) - 1) { const hw = rw * 0.22; for (let y = 0; y < 3; y++) for (let x = fl(cx - hw); x < cx + hw; x++) put(x, fl(ry - y), cel(R.linen, 5 - (x - cx) / hw, x, ry - y)); ry -= 3; }
    }
    for (let y = 0; y < w * 0.4; y++) put(fl(cx), fl(ry - y), C('gold', 5));
    if (w > 10) { const py = ry - w * 0.4; for (let k = 0; k < w * 0.6; k++) { const wv_ = Math.sin(t * 5 + k * 0.5 + seed) * 1.2 * k / (w * 0.6); for (let j = 0; j < Math.max(1, 3 - k / (w * 0.3)); j++) put(fl(cx + k), fl(py + j + wv_), C('crimson', 4)); } }
    if (fogA > 0) for (let y = Math.max(0, fl(ry - w)); y < Math.min(H, base); y++) for (let x = Math.max(0, fl(cx - w)); x < Math.min(W, cx + w); x++) { const i = y * W + x; if (BUF[i] >> 3 === R.linen || BUF[i] >> 3 === R.gold || BUF[i] >> 3 === R.indigo || BUF[i] >> 3 === R.fire || BUF[i] >> 3 === R.crimson) tintSoft(i, x, y, tab('#f0b8a8'), fogA); }
  }
  // the city's towers in layers of depth; camera (camX, camY) and a push-in k that brings the near layers closer
  // towers by depth layer: [z, count, width, how high the roofs reach (fraction of the frame from the top)]
  const SPIRE_L = [[6, 14, 7, 0.32], [4, 10, 11, 0.24], [2.6, 6, 18, 0.16], [1.7, 4, 30, 0.08]];
  const SPIRE_T = []; SPIRE_L.forEach(([z, n, w, top], li) => { for (let k = 0; k < n; k++) SPIRE_T.push({ x: (k / n - 0.5) * 1100 * (z / 3) + (ih(k, li, 91) - 0.5) * 60, z, w: w * (0.8 + ih(k, 2, 91) * 0.5), top: top + ih(k, 3, 91) * 0.3, seed: k * 7 + li }); });
  function spireCity(t, camX, camY, push, opt) {
    opt = opt || {};
    for (const [z] of SPIRE_L) {
      const m = 1 + push / (z * z);
      if (z === 6) cloudSea(170 - camY / 8, t, camX, 8, 3, -0.6);
      for (const T of SPIRE_T) {
        if (T.z !== z) continue;
        const x = 240 + (T.x - camX / z * 3) * m / z, base = 240 - camY / z, w = T.w * m;
        if (x < -w || x > W + w) continue;
        if (z < 3 && Math.abs(x - 240) < 70) continue;                 // keep the temple clear
        const topY = (T.top * H - camY / z * 0.6) - (m - 1) * 40;
        spireTower(x, base, w, base - topY, { seed: T.seed, t, fog: [0.5, 0.32, 0.16, 0.04][SPIRE_L.findIndex((L) => L[0] === z)], tiers: 2 + (T.seed % 2) });
      }
      if (z === 4) { for (let k = 0; k < 4; k++) { const xa = 240 + ((k - 1.5) * 150 - camX / 4 * 3) * (1 + push / 16) / 4, xb = xa + 50, by = 150 - camY / 4 - k * 9; for (let x = fl(xa); x < xb; x++) { const sag = Math.sin((x - xa) / (xb - xa) * PI) * 4; put(x, fl(by + sag), C('gold', 5)); put(x, fl(by + sag + 1), C('linen', 4)); put(x, fl(by + sag + 2), C('linen', 3)); } } cloudSea(206 - camY / 4, t, camX, 4, 7, 0); }
      if (z === 2.6) { if (opt.temple) opt.temple(push); cloudSea(242 - camY / 2.6, t, camX, 2.6, 11, 0.4); }
    }
    cloudSea(266 - camY / 1.2, t, camX, 1.2, 17, 0.8);
  }
  // birds: little V's wheeling in a loose flock
  function birds(cx, cy, n, t, spread, seed) { for (let k = 0; k < n; k++) { const a = t * (0.3 + ih(k, 1, seed) * 0.2) + ih(k, 2, seed) * TAU, r = spread * (0.4 + ih(k, 3, seed)); const x = cx + Math.cos(a) * r, y = cy + Math.sin(a * 0.7) * r * 0.3 + ih(k, 4, seed) * 20, f = Math.sin(t * 12 + k * 2) > 0 ? 1 : 0; put(fl(x), fl(y), C('dusk', 1)); put(fl(x) - 1, fl(y) - f, C('dusk', 1)); put(fl(x) + 1, fl(y) - f, C('dusk', 1)); if (ih(k, 5, seed) < 0.4) { put(fl(x) - 2, fl(y) - 1 - f, C('dusk', 1)); put(fl(x) + 2, fl(y) - 1 - f, C('dusk', 1)); } } }
  // the temple: the tallest tower, a great dome, a bell tower whose bells toll
  const BELLS = [96.5, 99.5, 102.5];
  function temple(t, cx, base, sc) {
    spireTower(cx, base, 40 * sc, 100 * sc, { seed: 99, t, tiers: 4 });
    // a great rose window halfway up
    const wy = base - 64 * sc; fillEll(cx, wy, 11 * sc, 11 * sc, 0, (x, y, u, v) => { const r = Math.hypot(u, v), a = Math.atan2(v, u); if (r > 0.86) return C('gold', 4); if (Math.abs(frac(a / TAU * 8) - 0.5) > 0.44 || Math.abs(r - 0.5) < 0.06) return C('gold', 3); return cel([R.indigo, R.crimson, R.teal, R.gold][fl((a / TAU + 1) * 8) % 4], 4.6, x, y); });
    for (const bt of BELLS) { const g = t - bt; if (g > 0 && g < 2.4) for (let k = 0; k < 2; k++) { const gg = g - k * 0.25; if (gg <= 0) continue; const r = gg * 140 * sc / 2; for (let a = 0; a < TAU; a += 0.6 / Math.max(4, r)) { const x = cx + Math.cos(a) * r, y = base - 118 * sc + Math.sin(a) * r * 0.35; if (bay(fl(x), fl(y)) < 1 - gg / 2.4) put(fl(x), fl(y), C('gold', 6)); } } }
  }
  // a title card: big letters with a dark outline, typed on, and a subtitle
  function card(t0, t, title, sub, x, y) {
    const a = lin(t0, t0 + 0.4, t); if (a <= 0) return;
    const nv = fl((t - t0) * 30);
    text(title, x, y, C('snow', 7), 2, C('ink', 0), nv);
    if (sub) text(sub, x, y + 20, C('gold', 6), 1, C('ink', 0), Math.max(0, nv - title.length));
  }

  // 15 — HALCYON SPIRE (1:33): up out of the cloud sea at dawn, gliding between the towers toward the temple
  shot(93.0, 104.0, (lt, t) => {
    const u = eio(lt / 11), camX = lerp(-90, 40, u), camY = lerp(120, -10, eio(lin(0, 7, lt))), push = lerp(0, 1.4, u);
    skyDawn(t, 120 - camX * 0.05, 92 + camY * 0.12);
    birds(260, 70 + camY * 0.2, 14, t, 90, 5);
    spireCity(t, camX, camY, push, { temple: (p) => temple(t, 250 + (40 - camX) / 6, 250 - camY / 2.6, 1.25 * (1 + p / 5)) });
    birds(150, 120 + camY * 0.5, 8, t * 1.3, 120, 9);
    card(95.2, t, 'HALCYON SPIRE', 'THE CITY ABOVE THE CLOUDS · NOW', 26, 40);
    fade(1 - lin(0, 0.5, lt));
  }, { nocaps: false });

  // ---------------------------------------------------------------- the temple vault: a long hall in one-point perspective
  const VH = 112;            // the horizon (the vanishing point's y)
  function vault(t, alarm, cx) {
    cx = cx === undefined ? 240 : cx;
    // the back wall and its great window, glowing gold and blue
    for (let y = 0; y < VH + 30; y++) for (let x = 0; x < W; x++) BUF[y * W + x] = cel(R.indigo, 1.2 + (y % 18 < 1 ? -0.6 : 0) + ((x + fl(y / 18) * 9) % 26 < 1 ? -0.6 : 0), x, y);
    fillEll(cx, 60, 30, 46, 0, (x, y, u, v) => {
      if (v > 0.55) return -1; const r = Math.hypot(u, v + 0.15), a = Math.atan2(v + 0.15, u);
      if (Math.abs(r - 0.55) < 0.04 || r > 0.94 || Math.abs(frac(a / TAU * 12) - 0.5) > 0.45) return C('gold', 2);
      if (Math.abs(frac(x / 6) - 0.5) > 0.4 || Math.abs(frac(y / 7) - 0.5) > 0.42) return C('ink', 1);
      return cel(r < 0.55 ? R.gold : [R.indigo, R.crimson, R.teal, R.violet][fl(ih(fl(x / 6), fl(y / 7), 301) * 4)], r < 0.55 ? 6 : 5, x, y);
    });
    // the floor: dark polished stone in perspective, thin gold inlay lines, a gold sunburst only round the pedestal,
    // the window's light lying along it
    for (let y = VH + 1; y < H; y++) { const d = 60 / (y - VH); for (let x = 0; x < W; x++) { const wx = (x - cx) * d, wz = 60 * d, r = Math.hypot(wx, (wz - 32) * 0.9), a = Math.atan2(wx, wz - 32);
      const inlay = frac(wx / 6) < 0.05 || frac(wz / 6) < 0.04, burst = r < 12 && Math.abs(frac(a / TAU * 16) - 0.5) < 0.12, refl = Math.max(0, 1 - Math.abs(x - cx) / (22 + (y - VH) * 0.6)) * 2.2;
      BUF[y * W + x] = burst || (inlay && r < 30) ? cel(R.gold, 2.6 + refl * 0.6 + (y - VH) / 120, x, y) : cel(R.indigo, 1.0 + (y - VH) / 160 + refl + (inlay ? -0.6 : 0), x, y); } }
    // pillars receding in pairs, pale stone with gold capitals, standing in shadow
    for (let k = 5; k >= 0; k--) {
      const z = 24 + k * 13, s = 60 / z;
      for (const side of [-1, 1]) {
        const px = cx + side * 30 * s, pw = 4 * s, top = VH - 100 * s, bot = VH + 60 * s;
        for (let y = Math.max(0, fl(top)); y < Math.min(H, bot); y++) for (let x = fl(px - pw); x < px + pw; x++) { if (x < 0 || x >= W) continue; const u = (x + 0.5 - px) / pw; BUF[y * W + x] = cel(R.lav, 3.4 - u * side * 1.4 - Math.abs(u) ** 4 * 1.6 - k * 0.35 - (y - top) / (bot - top) * 0.8, x, y); }
        for (const yy of [top, bot - 4 * s]) rectF(px - pw * 1.4, yy, pw * 2.8, Math.max(2, 4 * s), C('gold', 3));
      }
    }
    // the pedestal and its smashed glass case, the Storm Seed's cradle empty
    const ps = 60 / 32, py = VH + 60 * ps * 0.48;
    fillPoly([[cx - 14, py - 20], [cx + 14, py - 20], [cx + 18, py + 4], [cx - 18, py + 4]], (x, y) => cel(R.gold, 4.4 - (x - cx) / 18 * 1.4 + (y > py ? -1 : 0), x, y));
    for (let k = 0; k < 9; k++) { const a = -PI / 2 + (k - 4) * 0.28, L = 8 + ih(k, 1, 303) * 10; line(cx + Math.cos(a) * 6, py - 22, cx + Math.cos(a) * L, py - 22 + Math.sin(a) * L, C('cyan', 6)); }
    for (let k = 0; k < 30; k++) { const x = cx + (ih(k, 1, 304) - 0.5) * 90, y = py + 2 + ih(k, 2, 304) * 30; put(fl(x), fl(y), ih(k, fl(t * 4), 305) < 0.3 ? WHITE : C('cyan', 5)); }
    rays(cx, 40, 6, 260, tab('#ffd27a', true), 0.16, t, 7);
    glow(cx, py - 22, 30, tab('#46d2f0', true), 0.3);
    for (let k = 0; k < 40; k++) { const u = frac(ih(k, 1, 306) + t * 0.03); put(fl(cx + (ih(k, 2, 306) - 0.5) * 140), fl(30 + u * 160), C('gold', 6)); }
    // the alarm: red light pulsing through the hall, swinging from lamps high on the walls
    if (alarm) { const p = 0.5 + 0.5 * Math.sin(t * 9); tintAll(tab('#ff2040', true), p * 0.12); for (const side of [-1, 1]) { const lx = cx + side * 190, ly = 26, a = Math.sin(t * 4 * side) * 0.6 + (side < 0 ? 0.6 : PI - 0.6); for (let r = 0; r < 140; r += 1) for (let w = -r * 0.12; w <= r * 0.12; w++) { const x = fl(lx + Math.cos(a) * r - Math.sin(a) * w), y = fl(ly + Math.sin(a) * r + Math.cos(a) * w); if (x >= 0 && x < W && y >= 0 && y < H) tintI(y * W + x, x, y, tab('#ff3050', true), 0.3 * (1 - r / 140)); } fillEll(lx, ly, 4, 4, 0, C('crimson', 6)); } }
  }
  // 16 — the vault (1:44): the alarm, wardens running in, an empty cradle — "The Storm Seed… it's gone!"
  shot(104.0, 107.0, (lt, t) => {
    vault(t, true);
    LIGHT.x = 0; LIGHT.y = -1; ENV.edge = C('gold', 6);
    const order = [[-60, 0.0, 1], [70, 0.25, -1], [-110, 0.5, 1]];
    order.forEach(([x0, d, f], k) => {
      const u = eoc(lin(d, d + 1.3, lt)), x = 240 + x0 * (1 - u * 0.55), y = 250 - u * 26, run = u < 0.98;
      const P = run ? runPose({ t }, t * 14 + k, 5, WARDEN.body) : { t, arms: [{ a: 0.5, b: 0.4 }, { a: 0.1 }], legs: [{ foot: [5, 0] }, { foot: [-5, 0] }] };
      P.prop = (A) => spearArt(A.hand[0], A.hand[1], run ? 0.9 : 0.15, 36, t);
      actor(WARDEN, P, x, y, 1, f);
    });
    ENV.edge = null;
    view(240, 160, 1.5);
  });
  // 16b — Oren, close: "The courier. Kaira was the last one in the vault. Find her!"
  shot(107.0, 112.0, (lt, t) => {
    closeBg(() => vault(t, true, 300), 220, 120, 2.6, 3);
    LIGHT.x = -0.6; LIGHT.y = -0.6; ENV.edge = C('crimson', 6);
    bust('oren', { t, face: { mouth: mouth('oren', t) }, headX: Math.round(Math.sin(t * 1.2) * 0.8) }, 236, H - 22 + 6, 3, 1);
    ENV.edge = null;
    tintAll(tab('#ff2040', true), (0.5 + 0.5 * Math.sin(t * 9)) * 0.1);
  });

  /* ================================================================ ACT ONE (a), part two — the window, the rooftop chase */
  // ---------------------------------------------------------------- the rooftops of Halcyon Spire, side on
  // The chase runs left to right along one line of roofs; world x in frame pixels, the camera scrolls (camX, camY).
  // ROOF: [x0, x1, top, seed], gaps between them that she jumps.
  const ROOF = [];
  const LEAP_X = 262 + (142.6 - 117.4) * 150, LEAP_W = 150;
  (function () { let x = 180, k = 0; while (x < 9000) { let w = 150 + ih(k, 1, 401) * 230, gap = 30 + ih(k, 3, 401) * 34; const y = k === 0 ? 214 : 200 + fl((ih(k, 2, 401) - 0.5) * 30); if (x < LEAP_X && x + w + gap > LEAP_X - 60) { w = LEAP_X - x; gap = LEAP_W; } ROOF.push([x, x + w, y, k]); x += w + gap; k++; } })();
  const K_V = 150, K_X0 = 262, K_T0 = 117.4;                // her running speed (px/s), where and when the run starts
  function roofAt(x) { for (const r of ROOF) if (x >= r[0] && x < r[1]) return r; return null; }
  // where Kaira is at time t: running along the roofs, an arc over every gap
  function kairaAt(t) {
    const x = K_X0 + Math.max(0, t - K_T0) * K_V, r = roofAt(x);
    if (r) return { x, y: r[2], air: false, r };
    let a = null, b = null; for (const q of ROOF) { if (q[1] <= x && (!a || q[1] > a[1])) a = q; if (q[0] > x && (!b || q[0] < b[0])) b = q; }
    if (!a || !b) return { x, y: 200, air: false };
    const u = (x - a[1]) / (b[0] - a[1]); return { x, y: lerp(a[2], b[2], u) - Math.sin(u * PI) * (16 + (b[0] - a[1]) * 0.25), air: true, u };
  }
  const RF_WALL = [R.linen, R.rose, R.linen, R.gold, R.stone, R.tan];
  // one building: plaster facade with arched shuttered windows and flower boxes, a gold cornice, a strip of roof tile
  // seen over the parapet, and its dressing (chimneys, a water tank, herbs, laundry); sx: screen x of x0, sy: of the top
  function building(r, sx, sy, t) {
    const [x0, x1, , seed] = r, w = x1 - x0, ramp = RF_WALL[seed % 6], tile = ih(seed, 4, 402) < 0.5 ? R.crimson : R.teal;
    // the roof surface beyond the parapet: rows of tile receding
    for (let y = fl(sy - 7); y < sy; y++) for (let x = Math.max(0, fl(sx)); x < Math.min(W, sx + w); x++) { if (y < 0 || y >= H) continue; const v = sy - y; BUF[y * W + x] = cel(tile, 2.4 + v * 0.18 + (v % 3 === 0 ? -0.9 : 0) + (((x - sx) + (v % 6 < 3 ? 3 : 0)) % 6 === 0 ? -0.6 : 0), x, y); }
    // dressing on the roof, behind the runner's line
    const dress = (k) => ih(seed, k, 403);
    if (dress(1) < 0.7) { const cx = sx + w * (0.15 + dress(2) * 0.2); rectF(cx, sy - 26, 9, 22, C('ember', 3)); rectF(cx - 1, sy - 28, 11, 3, C('ember', 4)); for (let y = 0; y < 22; y += 3) rectF(cx, sy - 26 + y, 9, 1, C('ember', 2)); rectF(cx + 6, sy - 26, 3, 22, C('ember', 2)); for (let k = 0; k < 5; k++) { const u = frac(t * 0.3 + k / 5), px = cx + 4 + u * 14 + Math.sin(u * 6 + k) * 3, py = sy - 30 - u * 40; if (py > 0) fillEll(px, py, 2 + u * 5, 2 + u * 4, 0, (x, y, uu, vv) => (bay(x, y) < 0.7 - u * 0.6 ? cel(R.linen, 6 - u * 2 + (uu + vv < 0 ? 1 : 0), x, y) : -1)); } }
    if (dress(3) < 0.45) { const cx = sx + w * (0.55 + dress(4) * 0.25); rectF(cx - 1, sy - 30, 2, 26, C('wood', 2)); rectF(cx + 14, sy - 30, 2, 26, C('wood', 2)); fillEll(cx + 8, sy - 34, 11, 6, 0, (x, y, u, v) => cel(R.wood, 3 + (u < -0.2 ? 1 : 0) - (frac((x - cx) / 4) < 0.25 ? 0.8 : 0), x, y)); rectF(cx - 3, sy - 41, 22, 3, C('wood', 1)); }
    if (dress(5) < 0.6) { const lx = sx + w * 0.3, lx2 = sx + w * 0.8; for (let x = fl(lx); x < lx2; x++) { const u = (x - lx) / (lx2 - lx), y = sy - 22 + Math.sin(u * PI) * 5; put(x, fl(y), C('linen', 6)); } for (let k = 0; k < 5; k++) { const u = (k + 0.7) / 5.4, x = lerp(lx, lx2, u), y = sy - 22 + Math.sin(u * PI) * 5, col = [R.crimson, R.teal, R.gold, R.linen, R.indigo][(k + seed) % 5], sw = Math.sin(t * 3 + k) * 2; fillPoly([[x - 4, y], [x + 4, y], [x + 4 + sw, y + 9], [x - 4 + sw, y + 10]], (xx, yy) => cel(col, 4.4 - (xx > x + 1 ? 1 : 0) + ((yy - y) % 4 === 0 ? -0.6 : 0), xx, yy)); } rectF(lx - 1, sy - 24, 2, 20, C('wood', 2)); rectF(lx2 - 1, sy - 24, 2, 20, C('wood', 2)); }
    for (let k = 0; k < 4; k++) { if (dress(10 + k) > 0.5) continue; const px = sx + w * (0.1 + 0.8 * dress(20 + k)); rectF(px - 3, sy - 6, 7, 5, C('ember', 3)); rectF(px - 3, sy - 6, 7, 1, C('ember', 5)); for (let j = 0; j < 7; j++) put(fl(px - 3 + j + Math.sin(t * 2 + j) * 0.6), fl(sy - 7 - (j % 3) - 2), C('moss', 3 + (j % 2) * 2)); if (dress(30 + k) < 0.5) put(fl(px), fl(sy - 11), C('rose', 6)); }
    // the facade
    const y0 = Math.max(0, fl(sy)), cw = 24, rh = 30;
    for (let y = y0; y < H; y++) for (let x = Math.max(0, fl(sx)); x < Math.min(W, sx + w); x++) {
      const u = x - sx, v = y - sy, uu = (u - 6) % cw, vv = (v - 12) % rh, col = fl((u - 6) / cw), row = fl((v - 12) / rh);
      let c;
      if (v < 2) c = C('gold', v === 0 ? 6 : 4);
      else if (v < 5) c = cel(R.gold, 2.6 - (u % 3 === 0 ? 0.8 : 0), x, y);
      else if (v > 12 && uu >= 4 && uu < 16 && vv >= 0 && vv < 20 && u > 6 && u < w - 10) {
        // an arched window: a dark pane (sometimes lamp-lit), shutters, a sill with a flower box
        const ax = uu - 10, top = 5 - Math.sqrt(Math.max(0, 36 - ax * ax)) * 0.8 + 0.5;
        if (vv < top) c = cel(ramp, 4.2, x, y);
        else if (uu === 4 || uu === 15) c = C('ink', 1);
        else if (uu < 7 || uu > 12) c = cel(ih(col, seed, 404) < 0.5 ? R.teal : R.crimson, 3.4 - (vv % 3 === 0 ? 0.8 : 0) + (uu < 7 ? 0.6 : 0), x, y);
        else if (vv > 17) c = vv === 18 ? C('stone', 6) : cel(R.ember, 3, x, y);
        else c = ih(col, row + seed * 9, 405) < 0.2 ? (vv < top + 2 ? C('fire', 6) : C('fire', 5)) : cel(R.indigo, 1.6 + (vv < top + 3 ? 0.8 : 0), x, y);
        if (vv === 17 && (uu === 5 || uu === 8 || uu === 11 || uu === 14) && ih(col, row, seed + 7) < 0.7) c = C(ih(col, uu, 406) < 0.5 ? 'rose' : 'gold', 6);
        if (vv === 16 && (uu === 6 || uu === 10 || uu === 13) && ih(col, row, seed + 7) < 0.7) c = C('moss', 4);
      } else {
        const brick = vn(x - sx, y, 7, seed + 50) > 0.8, joint = brick && (v % 4 === 0 || (u + (fl(v / 4) % 2) * 4) % 8 === 0);
        c = brick ? cel(R.tan, joint ? 2.4 : 3.6, x, y) : cel(ramp, 4.4 + (u < 3 ? 1 : 0) - Math.min(1.6, v / 70) + (vn(u, v, 4, seed) - 0.5) * 0.8 - (u > w - 5 ? 1.4 : 0), x, y);
      }
      BUF[y * W + x] = c;
    }
  }
  // what lies beyond the roofs: dawn sky, distant spires over the cloud sea, a band of far roofs and domes
  function cityBack(t, camX, camY) {
    skyDawn(t, 330 - camX * 0.02, 70 - camY * 0.05);
    birds(300 - camX * 0.05, 60, 10, t, 70, 13);
    for (let k = 0; k < 16; k++) { const z = 8, x = ((k * 97 + ih(k, 1, 411) * 40 - camX / z) % 640 + 640) % 640 - 80, w = 6 + ih(k, 2, 411) * 6; spireTower(x, 200 - camY / z, w, 80 + ih(k, 3, 411) * 70, { seed: k, t, fog: 0.5, tiers: 2 }); }
    cloudSea(176 - camY / 8, t, camX * 0.3, 6, 5, -0.4);
    // the far roofs: domes and flat roofs, hazy rose
    const ox = camX * 0.45;
    for (let x = 0; x < W; x++) { const wx = x + ox, k = fl(wx / 46), u = frac(wx / 46), h = 30 + ih(k, 1, 412) * 30, dome = ih(k, 2, 412) < 0.3 && Math.abs(u - 0.5) < 0.3, top = 190 - camY * 0.45 - h - (dome ? Math.sqrt(0.09 - (u - 0.5) ** 2) * 50 : 0);
      for (let y = Math.max(0, fl(top)); y < H; y++) BUF[y * W + x] = dome && y < top + 3 ? C('gold', 4) : cel(R.rose, 4.2 - (y - top) / 60 + ((y - fl(top)) % 9 === 4 && Math.abs(u - 0.5) < 0.35 && ih(k, y, 413) < 0.3 ? 1.6 : 0), x, y); }
    fog(150 - camY * 0.4, H, tab('#f0b8a8'), 0.25, t, 7);
  }
  // the whole rooftop set at a camera; dark depths in the gaps between buildings
  function roofs(t, camX, camY) {
    cityBack(t, camX, camY);
    for (const r of ROOF) { const sx = r[0] - camX, sy = r[2] - camY; if (sx > W || sx + (r[1] - r[0]) < 0) continue; building(r, sx, sy, t); }
    // prayer flags strung across each gap
    for (let i = 0; i + 1 < ROOF.length; i++) { const a = ROOF[i], b = ROOF[i + 1], xa = a[1] - 20 - camX, xb = b[0] + 20 - camX; if (xb < 0 || xa > W) continue; const ya = a[2] - 34 - camY, yb = b[2] - 34 - camY;
      for (let k = 0; k <= 12; k++) { const u = k / 12, x = lerp(xa, xb, u), y = lerp(ya, yb, u) + Math.sin(u * PI) * 10; if (k < 12) line(x, y, lerp(xa, xb, u + 1 / 12), lerp(ya, yb, u + 1 / 12) + Math.sin((u + 1 / 12) * PI) * 10, C('linen', 5)); if (k > 0 && k < 12) { const col = [R.crimson, R.gold, R.indigo, R.teal, R.linen][(k + i) % 5], f = Math.sin(t * 4 + k) * 1.5; fillPoly([[x - 2, y], [x + 3, y], [x + 0.5 + f, y + 7]], (xx, yy) => cel(col, 4.6, xx, yy)); } } }
  }
  // dust kicked up on landing: a low ring of puffs
  function dust(x, y, g, n, seed) { if (g < 0 || g > 0.8) return; for (let k = 0; k < n; k++) { const s = (k / (n - 1) - 0.5) * 2, r = 2 + g * 10 * (1 - Math.abs(s) * 0.3), px = x + s * (6 + g * 34), py = y - 2 - g * 6 * (1 - Math.abs(s)); fillEll(px, py, r, r * 0.8, 0, (xx, yy, u, v) => (bay(xx, yy) < 1 - g * 1.1 ? cel(R.linen, 6 - g * 3 + (u + v < 0 ? 1 : 0), xx, yy) : -1)); } }
  // speed lines across the frame
  function streaks(t, n, y0, y1, seed, c) { for (let k = 0; k < n; k++) { const y = y0 + ih(k, 1, seed) * (y1 - y0), len = 20 + ih(k, 2, seed) * 60, x = W - ((t * (900 + ih(k, 3, seed) * 600) + ih(k, 4, seed) * 2000) % (W + len * 2)); for (let j = 0; j < len; j++) if (bay(fl(x + j), fl(y)) < 1 - j / len) put(fl(x + j), fl(y), c); } }
  // Kaira in her run: a long-stride sprint, the satchel bouncing, hair streaming
  function kRun(t, k, S, f, extra) {
    const P = runPose(Object.assign({ t, wind: 3 }, extra || {}), t * 17, 6, KAIRA.body);
    if (k.air) { const u = k.u || 0; P.legs = [{ foot: [7, -10 + u * 6] }, { foot: [-8, -4] }]; P.arms = [{ a: 2.2, b: 0.3 }, { a: -1.0, b: 0.4 }]; P.hip = -KAIRA.body.leg + 4; P.lean = 3; }
    return actor(KAIRA, P, k.sx, k.sy, S, f);
  }

  // ---------------------------------------------------------------- the temple's face: white stone, the great window
  const GLASS0 = 113.0, WINX = 40, WINY = 92;
  // story time inside the window shot: a breath of real time, slow motion through the glass, a frozen card, then a snap
  const glassT = (g) => (g < 0.15 ? g : g < 1.0 ? 0.15 + (g - 0.15) * 0.18 : g < 3.0 ? 0.303 : 0.303 + (g - 3.0));
  function facade(t, camX, broken, g) {
    const ox = -camX;
    for (let y = 0; y < H; y++) for (let x = 0; x < Math.min(W, 150 + ox); x++) {
      const wx = x - ox, pc = ((wx + 400) % 44 + 44) % 44, course = y % 9 === 0, joint = ((wx + 400 + (fl(y / 9) % 2) * 11) % 22) === 0;
      let c = cel(R.linen, 4.8 - (pc < 7 ? -0.6 : 0) - (pc === 7 || pc === 0 ? 1.2 : 0) - (course || joint ? 0.7 : 0) + (vn(wx, y, 9, 77) - 0.5) * 0.6 - y / 300 - (wx > 140 ? 1.6 : 0), x, y);
      if (y > 26 && y < 34) c = cel(R.gold, 3.6 + (Math.abs(((wx + 400) % 8) - 4) > (y - 26) / 2 ? 1 : -0.6), x, y);
      BUF[y * W + x] = c;
    }
    // the window: a tall pointed arch of glass, gold-framed; once broken, a ragged hole on the burning-red vault
    const cx = WINX + ox, cy = WINY;
    fillEll(cx, cy, 34, 58, 0, (x, y, u, v) => {
      const ar = v < 0 ? Math.abs(u) + (v * v) * 0.5 > 1.04 : Math.abs(u) > 1; if (ar) return -1;
      const frame = v < 0 ? Math.abs(u) + v * v * 0.5 > 0.9 : Math.abs(u) > 0.86; if (frame) return cel(R.gold, 4.4 - u * 1.2, x, y);
      const hole = broken && Math.hypot(u * 1.2, v + 0.1) < 0.55 + ih(fl(Math.atan2(v, u) * 5), 1, 421) * 0.25;
      if (hole) return cel(R.crimson, 3.6 + (0.5 + 0.5 * Math.sin(t * 9)) * 1.8 - Math.hypot(u, v), x, y);
      const pu = fl((u + 1) * 6), pv = fl((v + 1) * 7);
      if (frac((u + 1) * 6) < 0.12 || frac((v + 1) * 7) < 0.1 || Math.abs(Math.hypot(u, v + 0.3) - 0.42) < 0.03) return C('ink', 1);
      return cel([R.indigo, R.crimson, R.teal, R.gold, R.violet][fl(ih(pu, pv, 422) * 5)], 3.4 + (u < 0 ? 0.8 : 0) + (ih(pu, pv, 423) < 0.2 ? 1.4 : 0), x, y);
    });
    // banners either side
    for (const bx of [-48, 48]) { const x0 = cx + bx, sw = Math.sin(t * 1.4 + bx) * 2; fillPoly([[x0 - 7, 36], [x0 + 7, 36], [x0 + 7 + sw, 150], [x0 + sw, 142], [x0 - 7 + sw, 150]], (x, y) => cel(R.indigo, 3 + (x < x0 + sw * (y - 36) / 114 - 3 ? 1 : 0) - ((y - 36) % 16 === 0 ? 0.6 : 0), x, y)); fillEll(x0 + sw * 0.4, 70, 3, 3, 0, (x, y, u, v) => C('gold', u + v < 0 ? 7 : 5)); }
    // a lower temple roof running under the window to the first house: the ledge
    // a balustrade on the ledge, then the lower temple roof of crimson tile sloping away under it
    for (let y = 156; y < 168; y++) for (let x = 0; x < Math.min(W, 172 + ox); x++) { const bx = ((x - ox) % 10 + 10) % 10, post = bx > 2 && bx < 7 && Math.abs(y - 162) < 4.5 - (bx === 3 || bx === 6 ? 1.5 : 0) * (Math.abs(y - 162) > 2 ? 1 : 0); if (y < 158 || post) BUF[y * W + x] = cel(R.linen, y < 158 ? 6 : 5 - (bx > 4 ? 1 : 0), x, y); }
    for (let y = 168; y < H; y++) for (let x = 0; x < Math.min(W, 180 + ox); x++) { const v = y - 172, row = v % 5 === 0, cu = (x - ox + (fl(v / 5) % 2) * 4) % 8 === 0; BUF[y * W + x] = y < 172 ? C('gold', y === 168 ? 6 : 4) : cel(R.crimson, 3.0 - v / 30 + (row ? -1 : 0) + (cu ? -0.6 : 0) + (v % 5 === 1 ? 0.6 : 0), x, y); }
    if (broken) { glow(cx, cy, 70, tab('#ff4060', true), 0.25 * (0.6 + 0.4 * Math.sin(t * 9))); }
  }
  // a shard of glass: a little spinning sliver, its colour and a white glint
  function shard(x, y, s, a, c, hi) { const dx = Math.cos(a), dy = Math.sin(a); for (let q = -s; q <= s; q++) { const w = Math.max(0, 1 - Math.abs(q) / (s + 0.5)) * s * 0.5; for (let p = -w; p <= w; p += 0.7) put(fl(x + dx * q - dy * p), fl(y + dy * q + dx * p), q === -s + 1 ? hi : c); } }

  // 17 — the window bursts; Kaira, in slow motion, and her card; then she lands and runs (1:52)
  shot(112.0, 122.0, (lt, t) => {
    const g = t - GLASS0, st = Math.max(0, glassT(g)), broken = g > 0, frozen = g >= 1.0 && g < 3.0;
    // her flight: out through the glass, a tucked somersault, down onto the first roof (story time 0 → 1.5)
    const FL = 1.5, u = clamp(st / FL, 0, 1), landX = K_X0, landY = ROOF[0][2];
    let kx = lerp(WINX + 10, landX, u), ky = lerp(WINY + 20, landY, u * u) - Math.sin(u * PI) * 60, rot = u < 0.85 ? eio(u / 0.85) * TAU * 1.0 : 0;
    const k = kairaAt(t), running = t > K_T0;
    if (running) { kx = k.x; ky = k.y; }
    const camX = lerp(-140, k.x - 230, eio(lin(K_T0 - 0.2, K_T0 + 1.2, t))), zoomF = frozen ? eio(lin(1.0, 1.15, g)) : 0;
    roofs(t, camX, 0); facade(t, camX, broken, g);
    LIGHT.x = -0.8; LIGHT.y = -0.5; ENV.edge = C('gold', 6);
    if (g <= 0) { /* before the burst: quiet, banners in the wind, the alarm glows behind the glass */ glow(WINX - camX, WINY, 40 + Math.sin(t * 9) * 4, tab('#ff4060', true), 0.12 + lin(112.0, 113.0, t) * 0.15); }
    else if (!running && st < FL && !frozen) {
      const P = { t, face: { eyes: 'narrow', brows: 'angry' }, wind: 4, hip: -KAIRA.body.leg + 10, legs: [{ foot: [7, -12] }, { foot: [2, -14] }], arms: [{ hand: [8, -26] }, { hand: [4, -24] }], lean: 3 };
      LIGHTS.x = LIGHT.x; LIGHTS.y = LIGHT.y; rig(KAIRA, P, t); soutline(ENV.edge); stamp(kx - camX, ky + 18, 1, false, { rot, piv: 22 });
    } else if (!running && !frozen) {
      // landed: a crouch with one hand down, then up and away
      const c = 1 - lin(K_T0 - 0.2, K_T0, t);
      actor(KAIRA, { t, face: { eyes: 'narrow', brows: 'angry' }, wind: 2, hip: -KAIRA.body.leg + 12 * c, lean: 4 * c, legs: [{ foot: [8, 0] }, { foot: [-7, 0] }], arms: [{ hand: [12, -3 * c - 20 * (1 - c)] }, { a: -0.8, b: 0.6 }] }, kx - camX, ky, 1, 1);
    } else kRun(t, { sx: k.x - camX, sy: k.y, air: k.air, u: k.u }, 1, 1, { face: { eyes: 'narrow', brows: 'angry' } });
    ENV.edge = null;
    dust(landX - camX, landY, t - (GLASS0 + 3.0 + (FL - 0.303)), 7, 1);
    // the glass: a burst of coloured shards flung out and falling, frozen in the card
    if (broken) for (let q = 0; q < 140; q++) {
      const vx = 30 + ih(q, 1, 431) * 160, vy = (ih(q, 2, 431) - 0.65) * 160, tt = st * 1.2, x = WINX + (ih(q, 3, 431) - 0.5) * 50 + vx * tt - camX, y = WINY + (ih(q, 4, 431) - 0.5) * 70 + vy * tt + 120 * tt * tt;
      if (y > H) continue;
      shard(x, y, 1 + fl(ih(q, 5, 431) * 3), ih(q, 6, 431) * TAU + tt * (4 + ih(q, 7, 431) * 8), [C('indigo', 5), C('gold', 6), C('crimson', 5), C('teal', 5), C('violet', 5)][q % 5], WHITE);
    }
    if (g > 0 && g < 0.15) { flash(0.6 * (1 - g / 0.15)); shk(4); }
    // the freeze-frame card: the world pulls in and goes soft and cold; Kaira, close, mid-flight among the shards
    if (frozen) {
      view(lerp(240, kx - camX, zoomF), lerp(135, ky, zoomF), 1 + zoomF * 1.4); defocus(2);
      tintAll(tab('#1a1440', true), 0.35);
      LIGHT.x = -0.8; LIGHT.y = -0.5; ENV.edge = C('crimson', 6);
      bust('kaira', { t: GLASS0 + 1.0, face: { eyes: 'narrow', brows: 'angry', smile: 0.3 }, wind: 3, headY: 2 }, 300 + fl((1 - zoomF) * 40), H - 22 + 4, 3, 1);
      ENV.edge = null;
      for (let q = 0; q < 26; q++) shard(ih(q, 1, 441) * W, LB + ih(q, 2, 441) * 150, 2 + fl(ih(q, 3, 441) * 5), ih(q, 4, 441) * TAU, [C('indigo', 6), C('gold', 6), C('crimson', 6), C('teal', 6), C('violet', 6)][q % 5], WHITE);
      const a = eoc(lin(1.0, 1.25, g));
      for (let y = 190; y < 240; y++) for (let x = 0; x < W; x++) { const xx = x - (y - 190) * 0.6; if (xx > 20 && xx < 20 + 440 * a) BUF[y * W + x] = y < 193 || y > 236 ? C('gold', 5) : cel(R.indigo, 1.6 + ((xx + t * 0) % 40 < 20 ? 0.3 : 0), x, y); }
      text('KAIRA', 40, 197, C('gold', 6), 4, C('ink', 0), fl((g - 1.1) * 30));
      text('COURIER OF THE SKY TEMPLE', 44, 226, C('linen', 7), 1, C('ink', 0), fl((g - 1.4) * 40));
    }
    if (g > 2.98 && g < 3.06) flash(0.4);
  });

  // ---------------------------------------------------------------- the chase
  // a jagged bolt of lightning between two points, re-forked every frame
  function bolt(x0, y0, x1, y1, seed, c, c2) {
    const n = Math.max(3, fl(Math.hypot(x1 - x0, y1 - y0) / 8)); let px = x0, py = y0;
    for (let i = 1; i <= n; i++) { const u = i / n, j = i === n ? 0 : (ih(i, seed, 451) - 0.5) * 12, nx = lerp(x0, x1, u) + j * (y1 - y0) / Math.hypot(x1 - x0, y1 - y0 || 1), ny = lerp(y0, y1, u) - j * (x1 - x0) / Math.hypot(x1 - x0 || 1, y1 - y0); line(px, py, nx, ny, c2 || c, 2); line(px, py, nx, ny, c); px = nx; py = ny; }
  }
  // the pursuers: Oren and his wardens on the same roofs, a little behind her, jumping the same gaps
  function pursuers(t, camX, camY, n, S, o) {
    o = o || {};
    for (let k = n - 1; k >= 0; k--) {
      const d = (o.lag || 0.9) + k * 0.32, q = kairaAt(t - d), CH = k === 0 ? OREN : WARDEN;
      const P = runPose({ t, face: {} }, t * 15 + k * 1.7, 5, WARDEN.body);
      if (q.air) { P.legs = [{ foot: [6, -9] }, { foot: [-7, -3] }]; P.hip = -WARDEN.body.leg + 3; }
      P.prop = (A) => spearArt(A.hand[0], A.hand[1], 1.1, 34, t);
      if (o.throwK === k) { const u = o.throwU; P.arms = [{ a: lerp(-2.6, 1.6, u), b: 0.2 }, { a: 0.9, b: 0.4 }]; if (u > 0.4) P.prop = null; }
      actor(CH, P, q.x - camX, q.y - camY, S || 1, 1);
    }
  }
  // the camera for the chase: Kaira a little left of centre, the horizon steady, a hint of lag
  const chaseCam = (t, lead) => { const k = kairaAt(t); return { k, camX: k.x - (lead || 200), camY: Math.min(0, (kairaAt(t - 0.25).y - 200) * 0.6) }; };
  // the running bust: Kaira close, tracking with her, the rooftops streaming past soft behind her
  function runBust(t, F, o) {
    o = o || {};
    const { camX } = chaseCam(t), f = o.f || 1;
    closeBg(() => roofs(t, camX + (o.bgDX || 0), -30), o.fx || 300, o.fy || 112, 2.0, 3);
    streaks(t, 18, LB, H - LB, 461, C('linen', 6));
    const bob = Math.round(Math.abs(Math.sin(t * 8.5)) * 3);
    LIGHT.x = -0.8; LIGHT.y = -0.5; ENV.edge = C('gold', 6);
    const r = bust('kaira', { t, face: F, wind: 3, headX: o.headX || 0, headY: o.headY || 0 }, o.x || 250, H - LB + 8 - bob, 3, f);
    ENV.edge = null;
    // prayer flags strung between the roofs whip past close to the lens, every so often
    const fp = frac(t * 0.55 + 0.3), fx0 = W + 40 - fp * (W + 400);
    if (fp < 0.9) for (let q = 0; q < 9; q++) { const x = fx0 + q * 40, y = LB + 10 + Math.sin(q / 8 * PI) * 22 + q * 3, col = [R.crimson, R.gold, R.indigo, R.teal, R.linen][q % 5], fl_ = Math.sin(t * 9 + q) * 5; if (x < -30 || x > W + 30) continue; line(x - 20, y - 2, x + 20, y + 2, C('linen', 3), 2); fillPoly([[x - 9, y], [x + 9, y + 1], [x + fl_ * 0.5, y + 22]], (xx, yy) => cel(col, 3.6 + (xx < x ? 1 : 0), xx, yy)); }
    return r;
  }

  // 18 — the chase: a wide, the wardens spilling onto the roofs behind her (2:02)
  shot(122.0, 123.0, (lt, t) => {
    const { k, camX, camY } = chaseCam(t, 260);
    roofs(t, camX, camY);
    LIGHT.x = -0.8; LIGHT.y = -0.5; ENV.edge = C('gold', 6);
    pursuers(t, camX, camY, 4, 1);
    kRun(t, { sx: k.x - camX, sy: k.y - camY, air: k.air, u: k.u }, 1, 1, { face: { eyes: 'wide', brows: 'worried' } });
    ENV.edge = null;
  });
  // 18b — close, running: "[gasp] Okay. Okay. Framed, chased, and glowing. Great start to the week."
  shot(123.0, 128.3, (lt, t) => {
    const back = sstep(123.9, 124.2, t) * (1 - sstep(125.0, 125.3, t)), wry = sstep(126.2, 126.6, t);
    runBust(t, { eyes: blink(t, 7) ? 'closed' : lt < 0.5 ? 'wide' : wry > 0.5 ? 'half' : 'open', brows: wry > 0.5 ? 'up' : 'worried', mouth: mouth('kaira', t), smile: wry * 0.7 - (1 - wry) * 0.2, look: -2 * back }, { headX: -Math.round(back * 2) });
  });
  // 18c — Oren leads the wardens over a gap: "Courier! Return the Seed!"
  shot(128.3, 131.0, (lt, t) => {
    const q = kairaAt(t - 0.9), camX = q.x - 190, camY = Math.min(0, (q.y - 200) * 0.6) - 10;
    roofs(t, camX, camY);
    LIGHT.x = -0.8; LIGHT.y = -0.5; ENV.edge = C('gold', 6);
    pursuers(t, camX, camY, 4, 1);
    ENV.edge = null;
    // Oren's visor flares as he shouts
    const oq = kairaAt(t - 0.9); if (talking('oren', t)) glow(oq.x - camX + 6, oq.y - camY - 58, 10, tab('#ffb040', true), 0.5);
    view(q.x - camX + 10, q.y - camY - 40, 2);
  });

  // 19 — "I don't HAVE it!" shouted back over her shoulder; the chest glows; "[sigh] Okay. I might have it." (2:11)
  shot(131.0, 135.6, (lt, t) => {
    const back = sstep(131.3, 131.5, t) * (1 - sstep(132.7, 132.9, t)), glowA = sstep(132.8, 133.5, t), down = sstep(133.0, 133.3, t) * (1 - sstep(134.1, 134.4, t)), sigh = sstep(134.3, 134.6, t);
    const r = runBust(t, { eyes: blink(t, 5) ? 'closed' : down > 0.5 ? 'half' : sigh > 0.5 ? 'half' : 'wide', brows: back > 0.5 ? 'angry' : sigh > 0.5 ? 'up' : 'worried', mouth: mouth('kaira', t), smile: sigh * 0.5, look: back > 0.5 ? -3 : 0 }, { f: back > 0.5 ? -1 : 1, x: back > 0.5 ? 236 : 250, headY: Math.round(down * 3) });
    if (glowA > 0) {
      // the Storm Seed in her satchel, light leaking through the canvas and her fingers, little arcs crawling over it
      const cx = r.chest[0] - 14, cy = r.chest[1] + 14, p = 0.75 + 0.25 * Math.sin(t * 9);
      tintAll(tab('#ffc060', true), 0.12 * glowA);
      glow(cx, cy, 80 * p, tab('#ffd060', true), 0.7 * glowA);
      glow(cx, cy, 26, tab('#80f0ff', true), 0.9 * glowA);
      fillEll(cx, cy, 4, 3, 0, (x, y) => (glowA > 0.4 ? WHITE : -1));
      for (let b = 0; b < 3; b++) { const a = ih(b, fl(t * 14), 471) * TAU, L = 12 + ih(b, fl(t * 14) + 1, 471) * 22; if (glowA > 0.5) bolt(cx, cy, cx + Math.cos(a) * L, cy + Math.sin(a) * L, fl(t * 14) + b, C('snow', 7), C('cyan', 6)); }
    }
  });
  // 19b — the spear: thrown from behind, it flies at her back; she steps through the air in a flash of lightning
  const STEP_T = 136.3, STEP_D = 70;
  shot(135.6, 140.0, (lt, t) => {
    const { k, camX, camY } = chaseCam(t, 240), stepped = t > STEP_T, sx = k.x - camX + (stepped ? STEP_D * eoc(lin(STEP_T, STEP_T + 0.12, t)) : 0), sy = k.y - camY;
    roofs(t, camX, camY);
    LIGHT.x = -0.8; LIGHT.y = -0.5; ENV.edge = C('gold', 6);
    const th = lin(135.6, 135.85, t);
    pursuers(t, camX, camY, 3, 1, { throwK: 0, throwU: th });
    // the after-images she leaves behind in the step, fading gold
    if (t > STEP_T && t < STEP_T + 0.6) for (let q = 0; q < 4; q++) { const u = q / 4; LIGHTS.x = LIGHT.x; LIGHTS.y = LIGHT.y; rig(KAIRA, runPose({ t: STEP_T, wind: 3, face: {} }, STEP_T * 17, 6, KAIRA.body), STEP_T); soutline(); stamp(k.x - camX + u * STEP_D, sy, 1, false, { color: C(q % 2 ? 'gold' : 'cyan', 6), alpha: (1 - (t - STEP_T) / 0.6) * (0.3 + u * 0.5) }); }
    kRun(t, { sx, sy, air: k.air, u: k.u }, 1, 1, { face: { eyes: 'narrow', brows: stepped ? 'up' : 'angry', smile: stepped ? 0.8 : 0 } });
    ENV.edge = null;
    // the spear: from Oren's hand in a flat arc to exactly where her back was, a hair after she has gone; it buries
    // its head in the roof tiles and quivers
    if (t > 135.85) {
      const o = kairaAt(135.85 - 0.9), w = kairaAt(STEP_T), X0 = o.x + 12, Y0 = o.y - 40, X1 = w.x + 16, Y1 = w.y - 2, T1 = 136.36;
      const at = (tt) => { const u = clamp((tt - 135.85) / (T1 - 135.85), 0, 1); return [lerp(X0, X1, u), lerp(Y0, Y1, u * u) - Math.sin(u * PI) * 8]; };
      const stuck = t >= T1, p = at(t), p0 = at(Math.min(t, T1) - 0.02), ang = stuck ? Math.atan2(at(T1)[1] - at(T1 - 0.02)[1], at(T1)[0] - at(T1 - 0.02)[0]) : Math.atan2(p[1] - p0[1], p[0] - p0[0]);
      const quiv = stuck ? Math.sin((t - T1) * 46) * Math.exp(-(t - T1) * 5) * 0.12 : 0, a2 = ang + quiv, dx = Math.cos(a2), dy = Math.sin(a2), tx = p[0] - camX, ty = p[1] - camY;
      for (let q = 0; q < 44; q++) { put(fl(tx - dx * q), fl(ty - dy * q), C('wood', q % 4 ? 4 : 3)); put(fl(tx - dx * q), fl(ty - dy * q + 1), C('wood', 2)); }
      for (let q = 0; q < 6; q++) for (let j = -1.5 + q * 0.25; j <= 1.5 - q * 0.25; j += 0.5) put(fl(tx + dx * q - dy * j), fl(ty + dy * q + dx * j), C('steel', j < 0 ? 7 : 5));
      if (!stuck) for (let q = 0; q < 34; q++) if (bay(fl(tx - dx * (44 + q)), fl(ty - dy * (44 + q))) < 1 - q / 34) put(fl(tx - dx * (44 + q)), fl(ty - dy * (44 + q)), C('linen', 7));
      if (stuck && t < T1 + 0.4) { const g = (t - T1) / 0.4; for (let q = 0; q < 10; q++) put(fl(tx + 4 + (ih(q, 1, 481) - 0.5) * 30 * g), fl(ty - ih(q, 2, 481) * 18 * g + g * g * 20), C(q % 2 ? 'crimson' : 'ember', 5)); if (g < 0.2) shk(2); }
    }
    // the step itself: a flash and lightning down the line she travelled
    if (t > STEP_T && t < STEP_T + 0.35) { const a = 1 - (t - STEP_T) / 0.35; for (let b = 0; b < 2; b++) bolt(k.x - camX, sy - 28 + b * 10, sx, sy - 26 + b * 6, fl(t * 30) + b, C('snow', 7), C('gold', 6)); glow(sx, sy - 26, 40 * a, tab('#ffe080', true), 0.6 * a); if (t < STEP_T + 0.06) { flash(0.4); shk(3); } }
    // then in close beside her as she runs on, grinning
    if (t > 137.1) view(sx - 20, sy - 44, 2);
  });

  // 20 — the wide: the wardens throwing chains, a long gap between two roofs, her spinning leap over it (2:20)
  const CHAINS = [[141.2, 1], [144.6, 2], [146.0, 1]];
  shot(140.0, 148.0, (lt, t) => {
    const { k, camX, camY } = chaseCam(t, 220), spin = lin(LEAP_X / 1 > 0 ? 142.6 : 0, 143.6, t);
    roofs(t, camX, camY);
    LIGHT.x = -0.8; LIGHT.y = -0.5; ENV.edge = C('gold', 6);
    pursuers(t, camX, camY, 5, 1, { lag: 1.1 });
    const sx = k.x - camX, sy = k.y - camY;
    if (spin > 0 && spin < 1) {
      // tucked tight and turning over the gap; the Seed answering with a spiral of light
      const P = { t, wind: 4, face: { eyes: 'narrow', brows: 'angry' }, hip: -KAIRA.body.leg + 12, legs: [{ foot: [8, -14] }, { foot: [4, -12] }], arms: [{ hand: [9, -24] }, { hand: [5, -22] }], lean: 3 };
      LIGHTS.x = LIGHT.x; LIGHTS.y = LIGHT.y;
      for (const lagT of [0.12, 0.06]) { const s2 = lin(142.6, 143.6, t - lagT), q = kairaAt(t - lagT); if (s2 <= 0) continue; rig(KAIRA, P, t); soutline(); stamp(q.x - camX, q.y - camY + 14, 1, false, { rot: eio(s2) * TAU, piv: 22, color: C('gold', 6), alpha: 0.4 }); }
      rig(KAIRA, P, t); soutline(ENV.edge); stamp(sx, sy + 14, 1, false, { rot: eio(spin) * TAU, piv: 22 });
      for (let q = 0; q < 26; q++) { const a = q / 26 * TAU * 1.5 + t * 14, r = 26 + Math.sin(q * 0.6) * 4; if (bay(fl(sx + Math.cos(a) * r), fl(sy - 10 + Math.sin(a) * r)) < 0.8) put(fl(sx + Math.cos(a) * r), fl(sy - 10 + Math.sin(a) * r), q % 3 ? C('gold', 6) : C('cyan', 6)); }
      glow(sx, sy - 10, 30, tab('#ffd060', true), 0.3);
    } else kRun(t, { sx, sy, air: k.air, u: k.u }, 1, 1, { face: { eyes: 'narrow', brows: 'angry', smile: t > 143.6 && t < 145 ? 0.8 : 0 } });
    ENV.edge = null;
    // chains whipped at her from the wardens: a weighted end on a line of links, falling short or wrapping a post
    for (const [c0, who] of CHAINS) {
      const u = (t - c0) / 0.7; if (u <= 0 || u > 1.8) continue;
      const w = kairaAt(t - 1.1 - who * 0.32), x0 = w.x - camX + 8, y0 = w.y - camY - 40, tgt = kairaAt(c0 + 0.7), tx = tgt.x - camX - 24, ty = tgt.y - camY - 30;
      const reach = Math.min(1, u), drop = Math.max(0, u - 1) * 60;
      for (let c = 0; c <= 40; c++) { const v = c / 40 * reach, x = lerp(x0, tx, v), y = lerp(y0, ty, v) - Math.sin(v * PI) * 30 + drop * v * v; fillEll(x, y, c % 2 ? 2 : 1.4, c % 2 ? 1.4 : 2, 0, (xx, yy, uu, vv) => (Math.hypot(uu, vv) < 0.45 ? -1 : C('steel', uu + vv < 0 ? 6 : 3))); }
      const ex = lerp(x0, tx, reach), ey = lerp(y0, ty, reach) - Math.sin(reach * PI) * 30 + drop; fillEll(ex, ey, 4, 4, 0, (x, y, uu, vv) => C('steel', uu + vv < -0.3 ? 7 : uu + vv < 0.4 ? 5 : 2));
    }
    // a gust of cloud through the long gap
    if (t > 142.0 && t < 144.5) streaks(t, 10, sy - 80, sy + 20, 491, C('linen', 7));
    // in close running with her, pulled wide for the leap and the last chain
    if (t < 142.2 || (t > 144.3 && t < 145.7)) view(sx - 30, sy - 50, 2);
  });

  /* ================================================================ ACT ONE (a), part three — the broken bridge, the drop, the fall */
  // ---------------------------------------------------------------- the broken bridge, side on, with the long drop beyond
  const BY = 156, EDGE = 340, DK = tab('#0c0818'), HAZE = tab('#f4c8c0');
  // the harbour far below, seen past the bridge: haze, a band of tiny roofs, the sea, little ships
  function harbourFar(t, y0, camY) {
    for (let y = Math.max(0, fl(y0 - camY)); y < H; y++) { const wy = y + camY, u = clamp((wy - y0) / 140, 0, 1); for (let x = 0; x < W; x++) BUF[y * W + x] = soft(u < 0.55 ? R.rose : R.sky, u < 0.55 ? lerp(5, 6.4, u / 0.55) : lerp(5.6, 4.4, (u - 0.55) / 0.45), x, y); }
    // the lower town: a band of hazy roofs, the harbour wall, the water with its glints and boats
    const town = y0 + 42 - camY;
    for (let x = 0; x < W; x++) { const k = fl(x / 5), h = 3 + ih(k, 1, 501) * 6; for (let y = Math.max(0, fl(town - h)); y < Math.min(H, town + 6); y++) BUF[y * W + x] = cel(ih(k, 2, 501) < 0.5 ? R.sky : R.lav, 4.4 + (y < town - h + 1 ? 1 : 0) + (ih(k, 3, 501) < 0.15 && y === fl(town - 1) ? 2 : 0), x, y); }
    for (let y = Math.max(0, fl(town + 6)); y < Math.min(H, town + 60); y++) for (let x = 0; x < W; x++) { const g = ih(fl(x / 3), fl(y / 2), fl(t * 2) + 502) < 0.03; BUF[y * W + x] = g ? C('snow', 7) : cel(R.sea, 3.6 + (y - town) / 40 + ((y + fl(x / 9)) % 5 === 0 ? 0.5 : 0), x, y); }
    for (let b = 0; b < 6; b++) { const bx = (b * 83 + t * (3 + b)) % (W + 40) - 20, by = town + 14 + b * 6; rectF(bx, by, 7 + b, 2, C('wood', 3)); put(fl(bx + 3), fl(by - 4), C('linen', 7)); put(fl(bx + 3), fl(by - 3), C('linen', 7)); put(fl(bx + 4), fl(by - 3), C('linen', 6)); put(fl(bx + 3), fl(by - 2), C('linen', 6)); }
    fog(y0 - camY, H, tab('#f0c8c0'), 0.35, t, 9);
  }
  // the bridge: a white stone deck on arches, a balustrade on its far side, iron lamps, and the jagged broken end
  function bridgeStage(t, camX, camY, o) {
    o = o || {};
    skyDawn(t, 380 - camX * 0.05, 64 - camY * 0.1);
    birds(380, 70 - camY * 0.2, 7, t, 50, 21);
    // the city's towers behind on the left, the open sky on the right
    for (let k = 0; k < 9; k++) { const x = -20 + k * 34 + ih(k, 1, 511) * 20 - camX * 0.3; spireTower(x, BY + 40 - camY * 0.5, 8 + ih(k, 2, 511) * 10, 120 + ih(k, 3, 511) * 60, { seed: k + 40, t, fog: 0.45, tiers: 2 + (k % 2) }); }
    cloudSea(BY + 32 - camY * 0.6, t, camX, 3, 23, 0.2);
    harbourFar(t, BY + 22, camY);
    const ox = -camX, oy = -camY, ex = EDGE + ox;
    // wisps of cloud drifting through the drop
    for (let k = 0; k < 4; k++) { const wx = ((k * 140 + t * (10 + k * 4)) % 620) - 70, wy = BY + 50 + k * 22 + oy; fillEll(wx, wy, 50, 6, 0, (x, y, u, v) => (bay(x, y) < 0.6 - Math.hypot(u, v) * 0.5 ? cel(R.linen, 6.4 - v, x, y) : -1)); }
    // the arches under the deck, and their piers falling away out of sight
    for (let y = Math.max(0, BY + 14 + oy); y < H; y++) for (let x = 0; x < Math.min(W, ex - 14); x++) {
      const wx = x - ox, wy = y - oy - BY - 14, ac = ((wx % 90) + 90) % 90, arch = ac > 14 && wy > 4 + 30 - Math.sqrt(Math.max(0, 38 * 38 - (ac - 52) ** 2)) * 0.8;
      if (arch && wy > 0) continue;
      BUF[y * W + x] = cel(R.linen, 4.8 - wy / 60 - (ac < 14 && ac > 11 ? 1 : 0) + (wy % 8 === 0 ? -0.6 : 0) + (ac < 3 ? 0.8 : 0), x, y);
    }
    // the deck: a gold-edged cornice and paving on top
    for (let y = Math.max(0, BY + oy); y < Math.min(H, BY + 15 + oy); y++) for (let x = 0; x < Math.min(W, ex); x++) { const v = y - oy - BY, wx = x - ox; BUF[y * W + x] = v < 2 ? cel(R.linen, 6.2, x, y) : v < 5 ? cel(R.linen, 4.6 - ((wx % 12) === 0 ? 1 : 0), x, y) : v < 7 ? C('gold', v === 5 ? 5 : 3) : cel(R.linen, 4.8 - (v - 7) / 6 - ((wx + (v > 10 ? 6 : 0)) % 12 === 0 ? 0.8 : 0), x, y); }
    // the broken end: jagged stone, cracks, a dangling length of chain
    fillPoly([[ex - 16, BY + oy], [ex, BY + oy], [ex + 4, BY + 3 + oy], [ex - 2, BY + 7 + oy], [ex + 3, BY + 12 + oy], [ex - 6, BY + 20 + oy], [ex - 10, BY + 36 + oy], [ex - 18, BY + 40 + oy], [ex - 16, BY + 14 + oy]], (x, y) => cel(R.linen, 4.4 - (x - ex + 16) / 14 + ((x * 3 + y * 5) % 7 === 0 ? -1 : 0), x, y));
    for (let q = 0; q < 14; q++) { const u = q / 14; put(fl(ex - 6 + Math.sin(t * 1.3) * u * 3), fl(BY + 18 + q * 2 + oy), q % 2 ? C('steel', 5) : C('steel', 2)); }
    // the balustrade behind the walkway, snapped off near the end
    for (let x = 0; x < Math.min(W, ex - 30); x++) { const wx = x - ox, bx = ((wx % 9) + 9) % 9; for (let y = BY - 12 + oy; y < BY + oy; y++) { if (y < 0 || y >= H) continue; const v = y - (BY - 12 + oy); if (v < 2 || (bx > 2 && bx < 6 && !(v > 4 && v < 8 && (bx === 3 || bx === 5)))) BUF[y * W + x] = cel(R.linen, v < 2 ? 6 : 4.6 - (bx === 5 ? 1 : 0), x, y); } }
    for (let k = 0; k < 3; k++) { const px = ex - 26 + k * 7; rectF(px, BY - 6 + k * 2 + oy, 3, 6 - k * 2, C('linen', 4)); }
    // iron lamps on the walkway, their lanterns cold
    for (const lx of [40, 200]) { const x = lx + ox; if (x < -10 || x > W + 10) continue; rectF(x, BY - 44 + oy, 2, 44, C('ink', 2)); rectF(x - 3, BY - 52 + oy, 8, 8, C('ink', 1)); rectF(x - 2, BY - 51 + oy, 6, 6, C('gold', 3)); rectF(x - 4, BY - 54 + oy, 10, 2, C('ink', 2)); }
  }
  // a warden dropping onto the bridge: falling from above, a crouch on landing with a ring of dust
  function wardenLand(CH, x, t, tl, camX, camY, S, f) {
    const g = t - tl; if (g < -0.45) return;
    const y = g < 0 ? BY - (g * g) * 900 : BY, crouch = g > 0 && g < 0.35 ? 1 - g / 0.35 : 0;
    const P = { t, face: {}, hip: -WARDEN.body.leg + 9 * crouch + (g < 0 ? 4 : 0), lean: 2 * crouch, legs: g < 0 ? [{ foot: [5, -6] }, { foot: [-5, -3] }] : [{ foot: [7, 0] }, { foot: [-6, 0] }], arms: [{ a: 1.2 - crouch * 0.4, b: 0.3 }, { a: 0.4 }] };
    P.prop = (A) => spearArt(A.hand[0], A.hand[1], g < 0 ? 0.2 : lerp(0.75, 0.25, crouch), 34, t);
    actor(CH, P, x - camX, y - camY, S || 1, f || 1);
    if (g > 0 && g < 0.6) { dust(x - camX, BY - camY, g * 1.3, 7, 2); if (g < 0.08) shk(2); }
  }
  const LANDS = [[149.0, 100], [149.6, 160], [150.3, 60], [151.0, 214]];
  // Kaira on the bridge: a skid to the brink, arms windmilling over the drop, then turning to face them
  function kairaEdge(t, camX, camY, S, face) {
    const run = t < 148.45, skid = lin(148.45, 148.75, t), wob = lin(148.75, 149.35, t), turn = t > 149.35;
    const x = run ? lerp(120, 300, (t - 148.0) / 0.45) : 300 + eoc(skid) * 18;
    let P;
    if (run) P = runPose({ t, wind: 3, face: { eyes: 'wide', brows: 'worried' } }, t * 17, 6, KAIRA.body);
    else if (!turn) { const w = Math.sin(wob * PI * 4) * (1 - wob); P = { t, wind: 2, face: { eyes: 'wide', brows: 'worried', mouth: 0.3 }, lean: skid < 1 ? -3 : Math.round(w * 3), hip: -KAIRA.body.leg + 2, legs: [{ foot: [5, 0] }, { foot: [-6, 0] }], arms: [{ a: 2.6 + w * 1.4, b: 0.4 }, { a: -2.4 - w * 1.4, b: -0.3 }] }; }
    else P = Object.assign({ t, wind: 2, legs: [{ foot: [4, 0] }, { foot: [-5, 0] }], arms: [{ a: 0.5, b: 0.5 }, { a: -0.2, b: 0.6 }], face: { eyes: blink(t, 9) ? 'closed' : 'open', brows: 'worried' } }, face || {});
    actor(KAIRA, P, x - camX, BY - camY, S || 1, turn ? -1 : 1);
    if (skid > 0 && skid < 1) for (let q = 0; q < 8; q++) put(fl(x - camX - 6 - q * 3), fl(BY - camY - 1 - (q & 1)), C('linen', 7));
    if (wob > 0 && wob < 1) for (let q = 0; q < 5; q++) { const g = (t - 148.75 - q * 0.08); if (g < 0) continue; put(fl(EDGE - camX + 2 + q * 3), fl(BY - camY + 2 + g * g * 300), C('linen', 4)); }
    return x;
  }

  // 21 — the dead end (2:28): she skids to the broken edge; they drop in around her one by one
  shot(148.0, 153.0, (lt, t) => {
    bridgeStage(t, 0, 0);
    LIGHT.x = 0.7; LIGHT.y = -0.6; ENV.edge = C('gold', 6);
    for (const [tl, x] of LANDS) wardenLand(WARDEN, x, t, tl, 0, 0, 1, 1);
    // Oren walks out between them, unhurried
    const ow = lin(150.4, 152.8, t), ox = lerp(-30, 250, eoc(ow));
    const OP = ow < 1 ? runPose({ t, face: {} }, t * 8, 3, WARDEN.body) : { t, face: {}, legs: [{ foot: [5, 0] }, { foot: [-4, 0] }], arms: [{ a: 0.6, b: 0.4 }, { a: 0.2 }] };
    OP.prop = (A) => spearArt(A.hand[0], A.hand[1], 0.3, 36, t);
    if (t > 150.4) actor(OREN, OP, ox, BY, 1, 1);
    kairaEdge(t, 0, 0, 1);
    ENV.edge = null;
  });
  // 22 — Oren, close: "Five days, courier. That's how long the elders give you before it tears you apart. Come quietly." (2:33)
  shot(153.0, 157.6, (lt, t) => {
    closeBg(() => { bridgeStage(t, 0, 0); kairaEdge(t, 0, 0, 1); }, 330, 120, 2.4, 3);
    LIGHT.x = 0.8; LIGHT.y = -0.5; ENV.edge = C('gold', 6);
    bust('oren', { t, face: { mouth: mouth('oren', t) }, headX: Math.round(Math.sin(t * 1.1) * 0.6) }, 190, H - LB + 6, 3, 1);
    ENV.edge = null;
  });
  // 22b — over Oren's shoulder: Kaira at the brink, the whole sky at her back, a glance down
  shot(157.6, 160.0, (lt, t) => {
    bridgeStage(t, 0, 0);
    LIGHT.x = 0.7; LIGHT.y = -0.6; ENV.edge = C('gold', 6);
    const down = sstep(158.8, 159.1, t);
    kairaEdge(t, 0, 0, 1, { face: { eyes: down > 0.5 ? 'wide' : 'open', brows: 'worried', look: down > 0.5 ? 2 : 0 }, headY: Math.round(down * 2) });
    ENV.edge = null;
    view(300, 128, 2);
    // Oren's helm and shoulder, dark against her, filling the left of the frame
    LIGHT.x = 0.8; LIGHT.y = -0.5; ENV.edge = C('gold', 4);
    bust('oren', { t, face: { mouth: mouth('oren', t) } }, 70, H - LB + 60, 4, 1, { fx: (c) => DK[6 * NPAL + c] });
    ENV.edge = null;
  });

  // 23 — the drop: straight down past her heels to the harbour, the world stretching away (vertigo) (2:40)
  shot(160.0, 161.8, (lt, t) => {
    const z = lerp(1, 1.9, eio(lt / 1.8)), cx = 250, cy = 170;
    // the harbour, seen from far above: the sea in a ring of quays and roofs, a town wall, all hazy
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const dx = (x - cx) / z, dy = (y - cy) / z / 0.75, r = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
      let c;
      if (r < 46) c = ih(fl(x / 3), fl(y / 2), fl(t * 3) + 521) < 0.02 ? C('snow', 7) : cel(R.sea, 3.4 + r / 40 + ((fl(r / 3)) % 4 === 0 ? 0.4 : 0), x, y);
      else if (r < 52) c = cel(R.linen, 5 - (frac(a * 8) < 0.1 ? 1.5 : 0), x, y);
      else if (r < 108) { const bk = ih(fl(a * 26), fl(r / 8), 522); c = bk < 0.15 ? cel(R.moss, 3, x, y) : frac(r / 8) < 0.16 || frac(a * 26) < 0.1 ? cel(R.stone, 2.6, x, y) : cel([R.crimson, R.teal, R.gold, R.linen, R.rose][fl(bk * 5)], 4, x, y); }
      else if (r < 114) c = cel(R.stone, 4.6 - (frac(a * 30) < 0.3 ? 1 : 0), x, y);
      else { const bk = ih(fl(a * 22), fl(r / 12), 524); c = frac(r / 12) < 0.12 || frac(a * 22) < 0.08 ? cel(R.stone, 3, x, y) : bk < 0.15 ? cel(R.moss, 3.6, x, y) : cel([R.rose, R.tan, R.linen][fl(bk * 3) % 3], 4.2 + (frac(r / 12) < 0.4 ? 0.8 : 0), x, y); }
      BUF[y * W + x] = c;
      const hz = clamp((Math.hypot(x - cx, (y - cy) / 0.75) - 90) / 220, 0, 0.8); if (hz > 0) tintI(y * W + x, x, y, HAZE, hz);
      continue;
      BUF[y * W + x] = c;
    }
    for (let b = 0; b < 7; b++) { const a = b * 0.9 + t * 0.05, r = 18 + b * 4, bx = cx + Math.cos(a) * r * z, by = cy + Math.sin(a) * r * z * 0.75; fillEll(bx, by, 2 * z, 1 * z, a, C('wood', 3)); put(fl(bx), fl(by - z), C('linen', 7)); }
    tintAll(tab('#f0c8c0'), 0.12);
    // cloud between us and the ground, nearer, so it rushes outward faster than the town
    for (let k = 0; k < 12; k++) { const a = k / 12 * TAU + 0.3, r = (50 + k * 11) * z * z * 0.6, wx = cx + Math.cos(a) * r, wy = cy + Math.sin(a) * r * 0.7; fillEll(wx, wy, 52 * z, 18 * z, a, (x, y, u, v) => (bay(x, y) < 0.95 - Math.hypot(u, v) * 0.7 ? cel(R.linen, 6.4 - v * 0.6, x, y) : -1)); }
    // the bridge's own piers, falling away toward the ground: two long stone shafts converging on it
    for (const [px0, px1] of [[90, 150], [330, 400]]) { const k = 0.82; fillPoly([[px0, 40], [px1, 40], [lerp(px1, cx, k), lerp(40, cy, k)], [lerp(px0, cx, k), lerp(40, cy, k)]], (x, y) => { const u = (y - 40) / (cy - 40), band_ = frac(Math.log(1 - u * 0.95 + 0.001) * -6) < 0.12; return cel(R.linen, 4.6 - u * 2.6 - (band_ ? 1 : 0) + (x < lerp(px0, cx, u * k) + (px1 - px0) * (1 - u * k) * 0.3 ? 0.6 : -0.3), x, y); }); }
    // the broken edge across the top, her boot heels over the brink, a pebble falling and shrinking away
    const EP = [[0, 0], [W, 0], [W, 30], [380, 44], [330, 36], [290, 52], [240, 40], [190, 56], [130, 42], [60, 50], [0, 38]];
    fillPoly(EP, (x, y) => cel(R.linen, 5.2 - y / 30 + ((x * 7 + y * 3) % 13 === 0 ? -1.2 : 0) + ((x + y * 2) % 23 === 0 ? 0.8 : 0), x, y));
    for (let i = 3; i < EP.length - 1; i++) line(EP[i][0], EP[i][1], EP[i + 1][0], EP[i + 1][1], C('linen', 2), 2);
    // her boots from above: toes out over the drop, soles catching the light at the rim
    for (const [bx, by, a] of [[214, 46, 0.25], [256, 44, -0.2]]) { fillEll(bx, by, 7, 13, a, (x, y, u, v) => (v > 0.75 ? C('ink', 3) : cel(R.ink, 1.6 + (u < -0.3 ? 1 : 0) + (v < -0.6 ? 0.8 : 0), x, y))); fillEll(bx, by - 18, 6, 8, a, (x, y, u, v) => cel(R.indigo, 2.4 + (u < 0 ? 1 : 0), x, y)); }
    const pg = frac(lt / 1.2); fillEll(cx + 20, lerp(60, cy, pg), lerp(3, 0.6, pg), lerp(3, 0.6, pg), 0, C('linen', 6));
    // the dolly-zoom stretch: a ripple at the frame edges
    const zz = Math.sin(eio(lt / 1.8) * PI) * 0.6; if (zz > 0.1) { for (let y = LB; y < H - LB; y += 2) for (let x = 0; x < W; x += 2) { const d = Math.hypot(x - cx, y - cy) / 260; if (d > 0.7 && bay(x, y) < (d - 0.7) * zz) put(x, y, C('linen', 7)); } }
  });
  // 23b — the grin: "Quiet's not really my thing."
  shot(161.8, 164.4, (lt, t) => {
    closeBg(() => { bridgeStage(t, 0, 0); LIGHT.x = 0.7; LIGHT.y = -0.6; for (const [tl, x] of LANDS) wardenLand(WARDEN, x, t, tl, 0, 0, 1, 1); actor(OREN, { t, face: {}, legs: [{ foot: [5, 0] }, { foot: [-4, 0] }], arms: [{ a: 0.6, b: 0.4 }, { a: 0.2 }], prop: (A) => spearArt(A.hand[0], A.hand[1], 0.3, 36, t) }, 250, BY, 1, 1); }, 180, 110, 2.4, 3);
    const grin = sstep(162.0, 162.3, t);
    LIGHT.x = -0.8; LIGHT.y = -0.5; ENV.edge = C('gold', 6);
    bust('kaira', { t, face: { eyes: blink(t, 13) ? 'closed' : grin > 0.5 ? 'half' : 'wide', brows: grin > 0.5 ? 'up' : 'worried', mouth: mouth('kaira', t), smile: grin }, wind: 2, headY: -Math.round(grin) }, 300, H - LB + 6, 3, -1);
    ENV.edge = null;
  });
  // 23c — she tips backwards off the edge; Oren lunges and grabs air; the camera drops after her
  shot(164.4, 166.0, (lt, t) => {
    const tip = lin(164.5, 165.1, t), fall = Math.max(0, t - 165.0), camY = eio(lin(165.0, 166.0, t)) * 120;
    bridgeStage(t, 0, camY);
    LIGHT.x = 0.7; LIGHT.y = -0.6; ENV.edge = C('gold', 6);
    for (const [tl, x] of LANDS) wardenLand(WARDEN, x + sstep(164.6, 165.2, t) * 14, t, tl, 0, camY, 1, 1);
    const lunge = sstep(164.7, 165.0, t);
    actor(OREN, { t, face: {}, lean: Math.round(lunge * 4), legs: [{ foot: [5 + lunge * 8, 0] }, { foot: [-6, 0] }], arms: [{ a: 0.6 + lunge * 1.1, b: 0.1 }, { a: 0.2 }] }, 250 + lunge * 24, BY - camY, 1, 1);
    const P = { t, wind: 3 + fall * 3, face: { eyes: 'half', brows: 'up', smile: 1 }, legs: [{ foot: [4, 0] }, { foot: [-5, 0] }], arms: [{ a: lerp(0.5, 2.6, tip), b: 0.3 }, { a: lerp(-0.2, 2.4, tip), b: 0.3 }] };
    LIGHTS.x = -LIGHT.x; LIGHTS.y = LIGHT.y; rig(KAIRA, P, t); soutline(ENV.edge);
    stamp(318 + fall * 30, BY - camY + fall * fall * 260, 1, true, { rot: eio(tip) * 1.6 + fall * 2.2, piv: 2 });
    ENV.edge = null;
  });

  // ---------------------------------------------------------------- the fall through the market awnings, below the cloud
  const AWN = [[169.5, R.crimson], [171.0, R.teal], [172.5, R.gold]];
  // her fall: gravity, and each awning she rips through takes most of her speed
  function fallY(t) { let y = 0, v = 80; for (let tt = 166.0; tt < t; tt += 1 / 120) { v += 340 / 120; for (const [ta] of AWN) if (tt < ta && tt + 1 / 120 >= ta) v *= 0.3; y += v / 120; } return y; }
  const AWN_Y = AWN.map(([ta]) => fallY(ta) + 14);
  function alley(t, camY) {
    // the back wall: warm ochre plaster, rows of shuttered windows, wooden balconies, lanterns on strings across
    for (let y = 0; y < H; y++) { const wy = y + camY; for (let x = 0; x < W; x++) {
      const cw = 40, rh = 46, uu = ((x - 20) % cw + cw) % cw, vv = ((wy % rh) + rh) % rh, col = fl((x - 20) / cw), row = fl(wy / rh);
      let c = cel(R.tan, 3.8 + (vn(x, wy, 60, 531) - 0.5) * 0.6 - (x < 90 || x > 390 ? 0.8 : 0) + (vv === 40 || vv === 41 ? -1.2 : vv === 42 ? 0.8 : 0), x, y);
      if (uu > 10 && uu < 30 && vv > 8 && vv < 34) c = uu < 14 || uu > 26 ? cel(ih(col, row, 532) < 0.5 ? R.teal : R.crimson, 3 - (vv % 3 === 0 ? 0.8 : 0), x, y) : ih(col, row, 533) < 0.25 ? C('fire', vv < 14 ? 6 : 5) : cel(R.indigo, 1.4, x, y);
      if (vv === 34 || vv === 35) c = uu > 8 && uu < 32 ? C('wood', vv === 34 ? 4 : 2) : c;
      BUF[y * W + x] = c;
    } }
    // the two corner buildings framing the shaft, darker, close
    for (let y = 0; y < H; y++) { const wy = y + camY; for (let x = 0; x < W; x++) { const L = x < 60, Rr = x > 420; if (!L && !Rr) continue; const u = L ? x : W - x, by_ = ((wy % 6) + 6) % 6, brick = by_ === 0 || ((u + (fl(wy / 6) % 2) * 6) % 12) === 0; BUF[y * W + x] = cel(R.wood, 2.4 + (u > 54 ? 1.6 : u > 50 ? 0.8 : 0) - (brick ? 0.8 : 0) + (ih(fl(u / 12), fl(wy / 6), 534) < 0.1 ? 0.6 : 0), x, y); } }
    // balconies on the corner houses: a wooden rail, a pot of red flowers, a hanging vine
    for (let k = fl(camY / 92) - 1; k < fl(camY / 92) + 5; k++) { const wy = k * 92 + 40, y = wy - camY; if (y < -30 || y > H + 10) continue; for (const side of [0, 1]) { if (ih(k, side, 535) < 0.3) continue; const x0 = side ? 400 : 40, x1 = side ? 440 : 80; rectF(x0, y, x1 - x0, 2, C('wood', 4)); for (let px = x0; px < x1; px += 4) rectF(px, y + 2, 1, 8, C('wood', 3)); rectF(x0, y + 10, x1 - x0, 2, C('wood', 2)); const fx = x0 + 10 + ih(k, side + 3, 535) * 18; rectF(fx, y - 5, 6, 5, C('ember', 3)); for (let q = 0; q < 6; q++) put(fl(fx + q), fl(y - 6 - (q % 2)), q % 2 ? C('crimson', 6) : C('moss', 4)); for (let q = 0; q < 14; q++) put(fl(x0 + 4 + Math.sin(q * 0.7) * 1.5), fl(y + 12 + q), C('moss', 3 + (q % 2))); } }
    // laundry strung across the shaft
    for (let k = fl(camY / 170) - 1; k < fl(camY / 170) + 3; k++) { const wy = 140 + k * 170, y0 = wy - camY; if (y0 < -30 || y0 > H + 20) continue; for (let x = 60; x < 420; x++) put(x, fl(y0 + Math.sin((x - 60) / 360 * PI) * 10), C('linen', 3)); for (let q = 0; q < 6; q++) { const u = (q + 0.6) / 6.4, lx = 60 + u * 360, ly = y0 + Math.sin(u * PI) * 10, col = [R.crimson, R.sky, R.gold, R.linen, R.moss, R.rose][(q + k) % 6], sw = Math.sin(t * 2 + q) * 2; fillPoly([[lx - 7, ly], [lx + 7, ly], [lx + 7 + sw, ly + 14], [lx - 7 + sw, ly + 15]], (xx, yy) => cel(col, 4.6 - (xx > lx + 3 ? 1 : 0) - ((yy - ly) % 5 === 0 ? 0.6 : 0), xx, yy)); } }
    // strings of paper lanterns across the shaft
    for (let k = fl(camY / 170) - 1; k < fl(camY / 170) + 3; k++) { const wy = 60 + k * 170, y0 = wy - camY; if (y0 < -40 || y0 > H + 20) continue; for (let x = 60; x < 420; x++) { const u = (x - 60) / 360; put(x, fl(y0 + Math.sin(u * PI) * 16), C('wood', 2)); } for (let q = 1; q < 8; q++) { const u = q / 8, lx = 60 + u * 360, ly = y0 + Math.sin(u * PI) * 16 + 2; lantern(lx, ly + 5, 4, t, q + k * 9); } }
  }
  // an awning: striped canvas sloping out from the wall toward us, a scalloped valance; torn open once she is through
  function awning(y, ramp, torn, g, t) {
    const x0 = 150, x1 = 330, d = 30;
    for (let yy = 0; yy < d; yy++) { const sy = fl(y + yy), spread = yy * 0.9; for (let x = fl(x0 - spread); x < x1 + spread; x++) { const u = (x - x0 + spread) / (x1 - x0 + spread * 2); if (torn && Math.abs(u - 0.5) < 0.12 + g * 0.3 + (ih(fl(yy / 3), 1, 541) - 0.5) * 0.1 && yy > 4) continue; put(x, sy, cel(fl(u * 12) % 2 ? R.linen : ramp, (fl(u * 12) % 2 ? 5.6 : 4) + yy / 30 - (yy < 2 ? 1 : 0), x, sy)); } }
    const vy = fl(y + d); for (let x = fl(x0 - d * 0.9); x < x1 + d * 0.9; x++) { const u = (x - x0 + d * 0.9) / (x1 - x0 + d * 1.8); if (torn && Math.abs(u - 0.5) < 0.12 + g * 0.3) continue; const sc = 3 - Math.abs(((x % 8) - 4)) * 0.6; for (let q = 0; q < sc + 2; q++) put(x, vy + q, cel(ramp, 3.2 - q * 0.3, x, vy + q)); }
  }
  // 24 — the fall: down the shaft between the houses, through three awnings (2:46)
  shot(166.0, 176.0, (lt, t) => {
    const ky = fallY(t), camY = ky - 110, cloud = lin(166.0, 167.9, t);
    alley(t, camY);
    // first she drops out through the base of the cloud: white rushing up past her, thinning into the shaft
    if (cloud < 1) {
      const a = cloud < 0.6 ? 1 : 1 - (cloud - 0.6) / 0.4;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const n = fbm(x, y + t * 420, 50, 3, 561); if (bay(x, y) < a * (0.5 + n * 0.9)) BUF[y * W + x] = cel(n > 0.55 ? R.linen : R.rose, 5.6 + n * 1.6, x, y); }
    }
    // awnings behind her are drawn first: those she is about to reach sit below, those she has torn rise away above
    for (let k = 0; k < AWN.length; k++) { const y = AWN_Y[k] - camY; if (y < -40 || y > H + 10) continue; awning(y, AWN[k][1], t > AWN[k][0], Math.min(1, t - AWN[k][0]), t); }
    // Kaira, falling on her back, arms flung up, hair streaming above her; a slow tumble
    const P = { t, wind: 6, face: { eyes: lt < 1.6 ? 'wide' : lt < 3 ? 'shut' : 'narrow', brows: lt < 3 ? 'worried' : 'angry', mouth: lt < 1.2 ? 0.7 : 0 }, legs: [{ foot: [6, -6] }, { foot: [-3, -10] }], arms: [{ a: 2.6 + Math.sin(t * 9) * 0.4, b: 0.4 }, { a: 2.9 + Math.cos(t * 8) * 0.4, b: 0.3 }] };
    LIGHT.x = -0.4; LIGHT.y = -0.9; ENV.edge = C('gold', 6);
    LIGHTS.x = -LIGHT.x; LIGHTS.y = LIGHT.y; rig(KAIRA, P, t); soutline(ENV.edge);
    stamp(240, 110 + 26, 2, true, { rot: -PI / 2 + Math.sin(t * 1.3) * 0.35, piv: 26 });
    ENV.edge = null;
    // the rush of air: long streaks running up the frame
    for (let k = 0; k < 22; k++) { const x = 70 + ih(k, 1, 551) * 340, len = 20 + ih(k, 2, 551) * 50, y = H - ((t * (500 + ih(k, 3, 551) * 400) + ih(k, 4, 551) * 900) % (H + len * 2)); for (let j = 0; j < len; j++) if (bay(fl(x), fl(y + j)) < 1 - j / len) put(fl(x), fl(y + j), C('linen', 7)); }
    // tearing cloth: shreds and threads flung up as she goes through
    for (const [ta, ramp] of AWN) { const g = t - ta; if (g < 0 || g > 1.4) continue; for (let q = 0; q < 26; q++) { const x = 240 + (ih(q, 1, 553) - 0.5) * 140 * (0.3 + g), y = 140 - g * 160 * ih(q, 2, 553) + g * g * 60; shard(x, y, 2 + fl(ih(q, 3, 553) * 3), ih(q, 4, 553) * TAU + g * 9, C(q % 2 ? 'linen' : ['crimson', 'teal', 'gold'][AWN.findIndex((A) => A[0] === ta)], 5), C('linen', 7)); } if (g < 0.1) { shk(5); flash(0.25 * (1 - g / 0.1)); } }
    fade(lin(175.6, 176.0, t) * 0.8);
  });

  /* ================================================================ ACT ONE (b) — the harbour at dawn (2:56–5:00): Tamo, the anchor, the Hush,
  // the Bellwether, Vesper. Everything is in this block; the new cast is in HB (c_cast_b.js). */
  {
    const { lyBegin, lyEnd, lk, stampEx, actorEx, anchorArt, fishArt, hollowFig, bellwether, vesperFig, DOCKHAND } = HB;
    /* ---------------------------------------------------------------- the stage: a side view along the dock
    // Stage pixels at 1×; world x along the dock; CX: the world x at the frame's left edge (for things on the dock, z = 1).
    // The planks are in true perspective toward a vanishing point on the horizon, so they slide past at the right rate. */
    const HOR = 122, DF = 172, DY = 192, DN = 204, WL0 = 230;     // horizon, the deck's far edge, where feet stand, its near edge, the water line
    const HUSH_T = 228.5;
    const sOf = (y) => (y - HOR) / (DY - HOR);
    let CX = 0;
    const sx = (wx) => wx - CX;                                  // a world x on the dock → stage x
    const LAMPS_X = [-170, 60, 268, 520, 760, 990, 1220], BOLL_X = [-60, 170, 420, 650, 880, 1110];
    const AX = 330, IX = 150, BRLX = 478, BELLX = 572, DOCKX = 404;
    // the sky at dawn: violet overhead, rose, then gold at the horizon, the sun just up behind the boats
    function dawnSky(t, o) {
      const sunX = 300 - CX / 40, sunY = 108;
      for (let y = 0; y < HOR; y++) {
        const u = y / HOR;
        for (let x = 0; x < W; x++) {
          const d = Math.hypot((x - sunX) * 0.5, y - sunY) / 160, warm = clamp(u * 1.15 - d * 0.35, 0, 1);
          BUF[y * W + x] = warm < 0.42 ? soft(R.dusk, 1.4 + warm * 4.2, x, y) : warm < 0.74 ? soft(R.rose, 2.6 + (warm - 0.42) * 6.5, x, y) : soft(R.fire, 4.2 + (warm - 0.74) * 6, x, y);
        }
      }
      // long thin clouds lit from below, and a bank of rounded ones higher up
      cloudBank(34, 9, 9, R.dusk, 2.4, 41, o.rt, 1.2);
      for (let k = 0; k < 9; k++) {
        const y = 60 + k * 6 + ih(k, 1, 301) * 4, x0 = ((ih(k, 2, 301) * 700 - CX / 20 + o.rt * (2 + k * 0.3)) % 700) - 110, len = 50 + ih(k, 3, 301) * 120;
        for (let x = fl(x0); x < x0 + len; x++) { if (x < 0 || x >= W) continue; const e = Math.min(x - x0, x0 + len - x); const th = e < 6 ? 1 : 2; for (let j = 0; j < th; j++) BUF[(y + j) * W + x] = j === th - 1 && th > 1 ? C('rose', 5 + (k > 5 ? 1 : 0)) : C(k > 4 ? 'fire' : 'rose', k > 4 ? 5 : 4); }
      }
      glow(sunX, sunY, 150, tab('#ffb070', true), 0.42);
      fillEll(sunX, sunY, 10, 10, 0, (x, y, u, v) => (y > HOR - 1 ? -1 : Math.hypot(u, v) < 0.75 ? WHITE : C('fire', 7)));
      glow(sunX, sunY, 30, tab('#fff0c0', true), 0.5);
      return [sunX, sunY];
    }
    // the far shore: the city on its cliff to the left — a wall, towers and the Spire — and the lighthouse on its headland, right
    function farShore(t, o) {
      const zc = 14, ox = -CX / zc;
      // the cliff and the city wall
      for (let x = 0; x < W; x++) {
        const wx = x - ox, top = HOR - 22 - Math.max(0, 70 - Math.abs(wx - 110) * 0.45) * 0.55 - vn(wx, 0, 18, 311) * 8 + Math.max(0, wx - 230) * 0.4;
        if (top >= HOR) continue;
        for (let y = Math.max(0, fl(top)); y < HOR; y++) BUF[y * W + x] = cel(R.dusk, 2.4 + (y - top < 1.5 ? 1.4 : 0) + (vn(wx * 2, y, 5, 312) > 0.68 ? 0.5 : 0) - (y - top) / 60, x, y);
        // the wall: a band with crenellations along the cliff top, and lit windows
        if (wx > 20 && wx < 250) { const wt = top - 7; for (let y = fl(wt); y < fl(top) + 1; y++) BUF[y * W + x] = (y === fl(wt) && (fl(wx / 3) & 1)) ? BUF[y * W + x] : cel(R.dusk, 3.2 + (y - wt < 2 ? 0.8 : 0), x, y); if (fl(wx) % 11 === 3) BUF[(fl(top) - 3) * W + x] = C('fire', 5); }
      }
      // towers and the Spire
      const towers = [[40, 26, 6], [78, 34, 7], [150, 30, 6], [196, 24, 5], [232, 18, 5]];
      for (const [tx, h, w] of towers) { const x0 = fl(tx + ox), base = HOR - 30; for (let y = base - h; y < base; y++) for (let x = x0; x < x0 + w; x++) if (x >= 0 && x < W) BUF[y * W + x] = cel(R.dusk, 3 + (x === x0 ? 1 : 0), x, y); for (let j = 0; j < 5; j++) for (let x = x0 - 1 + j; x < x0 + w + 1 - j; x++) if (x >= 0 && x < W) BUF[(base - h - j - 1) * W + x] = C('dusk', 2); if (x0 + 2 >= 0 && x0 + 2 < W) BUF[(base - h + 4) * W + x0 + 2] = C('fire', 6); }
      // the Spire: a needle of white stone, rings of balconies, a lit crystal at the top catching the first sun
      const spx = 118 + ox;
      for (let y = 8; y < HOR - 34; y++) { const u = (y - 8) / (HOR - 42), hw = 1.2 + u * 6.5 + (fl(y) % 14 === 0 ? 2.5 : 0); for (let x = fl(spx - hw); x <= spx + hw; x++) if (x >= 0 && x < W) BUF[y * W + x] = cel(R.lav, 3.2 + ((x - spx) / hw < -0.2 ? 1.4 : (x - spx) / hw > 0.4 ? -0.8 : 0.3) + (fl(y) % 14 === 0 ? 1 : 0), x, y); }
      glow(spx, 10, 14, tab('#ffd890', true), 0.6); fillPoly([[spx - 2, 10], [spx + 2, 10], [spx, 2]], (x, y) => (x < spx ? WHITE : C('fire', 6)));
      // the lighthouse headland, right
      const lz = 7, lox = -CX / lz;
      for (let x = 0; x < W; x++) { const wx = x - lox, top = HOR - Math.max(0, 40 - Math.abs(wx - 430) * 0.32) - vn(wx, 3, 10, 313) * 5; if (top >= HOR - 1) continue; for (let y = Math.max(0, fl(top)); y < HOR; y++) BUF[y * W + x] = cel(R.dusk, 1.8 + (y - top < 1.5 ? 1.6 : 0) + (vn(wx * 2, y * 2, 4, 314) > 0.7 ? 0.6 : 0), x, y); }
      const lhx = 432 + lox, lb = HOR - 38, lt = lb - 54;
      for (let y = lt; y < lb; y++) { const u = (y - lt) / (lb - lt), hw = 4 + u * 3; for (let x = fl(lhx - hw); x <= lhx + hw; x++) { if (x < 0 || x >= W) continue; const band_ = fl((y - lt) / 9) % 2 === 1, sh = (x - lhx) / hw; BUF[y * W + x] = cel(band_ ? R.crimson : R.linen, (band_ ? 2.6 : 3.4) + (sh > 0.3 ? 1.4 : sh < -0.5 ? -1 : 0) - (o.hushed ? 1 : 0), x, y); } }
      rectF(lhx - 7, lt - 2, 15, 2, C('ink', 2)); for (let x = fl(lhx - 7); x < lhx + 8; x += 2) put(x, lt - 3, C('ink', 2));
      rectF(lhx - 4, lt - 9, 9, 7, C('ink', 1)); for (let x = fl(lhx - 3); x < lhx + 4; x += 2) rectF(x, lt - 8, 1, 5, o.lamp ? C('fire', 6) : C('stone', 2));
      fillPoly([[lhx - 5, lt - 9], [lhx + 6, lt - 9], [lhx + 0.5, lt - 15]], C('ink', 1));
      if (o.lamp) glow(lhx, lt - 6, 20, tab('#ffd070', true), 0.5);
      return [lhx, lt];
    }
    // the sea out to the horizon: sky colours broken into wave dashes, the sun's glitter path, boats at their moorings
    function farSea(t, o, sun) {
      const rt = o.rt, pull = o.pull || 0, shore = DF - pull * 34;
      for (let y = HOR; y < DF; y++) {
        const d = (y - HOR) / (DF - HOR), per = 3 + d * 14;
        for (let x = 0; x < W; x++) {
          if (y > shore) { // the seabed laid bare: wet sand, weed, stones, puddles catching the sky
            const n = vn(x + CX * 0.8, y * 3, 6, 321); BUF[y * W + x] = n > 0.7 ? cel(R.sky, 3.4, x, y) : cel(R.earth, 2.4 + n * 1.2 - (y - shore < 2 ? -1 : 0) + (ih(fl(x / 3), y, 322) < 0.05 ? 1.5 : 0), x, y); continue;
          }
          const wx = x + CX * (0.25 + d * 0.6), n = vn(wx / per, y * 1.4 + rt * 1.2, 1, 323), n2 = vn(wx / per * 0.5 + rt * 0.3, y * 0.7, 1, 324);
          let c = d < 0.15 ? cel(R.rose, 4.2 - d * 4 + (n > 0.62 ? 1.2 : 0), x, y) : cel(R.sea, 2 + d * 1.4 + (n > 0.66 ? 1.4 : n < 0.25 ? -0.8 : 0) + (n2 > 0.7 ? 0.6 : 0), x, y);
          if (d > 0.15 && n > 0.72 && n2 > 0.45) c = C('rose', 4);
          // the glitter path under the sun
          const gp = Math.abs(x - sun[0]) / (6 + d * 60);
          if (gp < 1 && ih(fl(wx / 2), y, fl(rt * 7)) < (1 - gp) * 0.55 * (1 - d * 0.5)) c = (1 - gp) > 0.6 ? WHITE : C('fire', 6);
          BUF[y * W + x] = c;
        }
      }
      if (pull > 0) for (let x = 0; x < W; x++) { const y = fl(shore); if (y > HOR && y < DF) { BUF[y * W + x] = C('snow', 7); if ((x + fl(rt * 8)) % 5 < 2) BUF[(y - 1) * W + x] = C('sky', 6); } }
    }
    // a boat at its mooring: hull, cabin, mast and a loose sail; (x, y) waterline centre, s scale, its own little bob
    function boat(x, y, s, t, seed, o) {
      o = o || {}; const b = Math.sin(t * 1.4 + seed) * 1.2 * s, r = Math.sin(t * 1.1 + seed * 2) * 0.04 + (o.tilt || 0), L = 30 * s;
      const at = (a, h) => [x + a * Math.cos(r) - h * Math.sin(r), y + b - h * Math.cos(r) - a * Math.sin(r)];
      const hullC = [R.wood, R.crimson, R.sea, R.olive][seed % 4];
      fillPoly([at(-L, 6 * s), at(L + 4 * s, 7 * s), at(L - 4 * s, -2 * s), at(-L + 6 * s, -2.5 * s)], (xx, yy) => cel(hullC, 2.2 + (yy < y + b - 4 * s ? 1.2 : 0) + ((yy - y) % 3 === 0 ? -0.5 : 0), xx, yy));
      line(...at(-L, 6 * s), ...at(L + 4 * s, 7 * s), C('linen', 5));
      fillPoly([at(-L * 0.5, 6 * s), at(-L * 0.05, 6 * s), at(-L * 0.08, 12 * s), at(-L * 0.45, 12 * s)], (xx, yy) => cel(R.linen, 3.4 + (xx > x - L * 0.2 ? -0.6 : 0.4), xx, yy));
      const mt = at(L * 0.15, 6 * s), mtop = at(L * 0.15, 48 * s);
      line(mt[0], mt[1], mtop[0], mtop[1], C('wood', 1), Math.max(1, Math.round(s)));
      line(mtop[0], mtop[1], ...at(-L, 7 * s), C('ink', 3)); line(mtop[0], mtop[1], ...at(L + 4 * s, 8 * s), C('ink', 3));
      const sailC = [R.linen, R.rust, R.linen, R.crimson][(seed + 1) % 4], fullS = o.furled ? 0.3 : 1;
      if (o.furled) line(...at(L * 0.15, 20 * s), ...at(-L * 0.5, 17 * s), C(sailC, 4), 2);
      else fillPoly([at(L * 0.17, 44 * s), at(L * 0.17, 16 * s), at(L * 0.17 + 18 * s + Math.sin(t * 2 + seed) * 2 * s, 18 * s), at(L * 0.17 + 14 * s, 38 * s)], (xx, yy) => cel(sailC, 4.4 + ((xx - mt[0]) > 9 * s ? -0.6 : 0.5) + (frac((yy - mtop[1]) / (6 * s)) < 0.12 ? -0.8 : 0), xx, yy));
      void fullS;
      if (o.pennant !== false) { const p = at(L * 0.15, 48 * s); for (let q = 0; q < 6 * s; q++) put(fl(p[0] + q), fl(p[1] + Math.sin(t * 6 + q * 0.6) * 0.8), C('crimson', 5)); }
    }
    const BOATS = [[-80, 150, 0.75, 1], [70, 158, 0.85, 2, 1], [230, 144, 0.6, 3], [370, 162, 0.95, 4, 1], [520, 150, 0.7, 5], [690, 160, 0.9, 6, 1], [850, 146, 0.65, 7], [1000, 158, 0.85, 8, 1], [1180, 150, 0.75, 9]];
    function boats(t, o) {
      const pull = o.pull || 0, shore = DF - pull * 34;
      for (const [bx, by, s, seed, furled] of BOATS) {
        const z = 1.7 + (DF - by) / 30, x = bx - CX / z; if (x < -60 || x > W + 60) continue;
        const stranded = by > shore - 2, y = stranded ? by + 2 : by;
        boat(x, y, s, o.rt, seed, { furled, tilt: stranded ? (seed & 1 ? 0.18 : -0.15) * Math.min(1, pull * 2) : 0 });
        if (!stranded) for (let k = 0; k < 3; k++) { const rx = x + (k - 1) * 14 * s + Math.sin(o.rt * 2 + k) * 2; put(fl(rx), fl(y + 2 + k), C('sea', 5)); put(fl(rx) + 1, fl(y + 2 + k), C('sea', 5)); }
      }
    }
    // a far pier on stilts with dock workers carrying sacks (they keep working until the world stops)
    function farPier(t, o) {
      const z = 2.6, y0 = 136, ox = -CX / z;
      for (let x = 0; x < W; x++) { const wx = x - ox; if (wx < 340 || wx > 980) continue; BUF[y0 * W + x] = C('wood', 3); BUF[(y0 + 1) * W + x] = C('wood', 1); if (fl(wx) % 18 === 0) for (let y = y0 + 2; y < y0 + 9; y++) BUF[y * W + x] = C('wood', 1); }
      for (let k = 0; k < 7; k++) {
        const span = 560, u = frac(ih(k, 1, 331) + o.rt * (0.012 + ih(k, 2, 331) * 0.01) * (k & 1 ? 1 : -1)), wx = 360 + u * span, x = fl(wx + ox), y = y0 - 1;
        if (x < 0 || x >= W || (o.erase && ih(k, 3, 331) < o.erase)) continue;
        const step = fl(o.rt * 6 + k) & 1, col = C('ink', 3);
        put(x, y - step * 0, col); put(x + 1, y - step, col); for (let j = 1; j < 5; j++) put(x, y - j, col); put(x, y - 5, C('skin', 3)); put(x + 1, y - 4, col);
        if (k % 3 !== 0) { rectF(x - 1, y - 7, 3, 2, C('linen', 3)); }
      }
      // posts and a crane
      const cx = 760 + ox; if (cx > -20 && cx < W + 20) { line(cx, y0, cx, y0 - 28, C('wood', 1)); line(cx, y0 - 28, cx + 16, y0 - 22, C('wood', 1)); const sw = Math.sin(o.rt * 0.8) * 2; line(cx + 16, y0 - 22, cx + 16 + sw, y0 - 10, C('ink', 3)); rectF(cx + 13 + sw, y0 - 10, 7, 5, C('wood', 2)); }
    }
    // gulls: wheeling flocks in the sky, and some perched; frozen with the world (they hang in mid-flap)
    function gulls(t, o, n, cy) {
      const rt = o.rt;
      for (let k = 0; k < n; k++) {
        const a = rt * (0.25 + ih(k, 1, 341) * 0.3) * (k & 1 ? 1 : -1) + ih(k, 2, 341) * TAU, r = 40 + ih(k, 3, 341) * 110;
        const x = fl(((ih(k, 4, 341) * 700 + Math.cos(a) * r - CX / 3) % 700 + 700) % 700 - 110), y = fl(cy + Math.sin(a) * r * 0.25 + ih(k, 5, 341) * 30);
        const fp = Math.sin(rt * (9 + k % 3) + k * 2), up = fp > 0.3 ? -2 : fp < -0.3 ? 1 : 0, big = ih(k, 6, 341) < 0.4;
        const c = C('snow', 7), cd = C('stone', 4);
        put(x, y, c); put(x + 1, y, c); put(x - 1, y + (up < 0 ? -1 : 0), cd); put(x + 2, y + (up < 0 ? -1 : 0), cd);
        put(x - 2, y + up, cd); put(x + 3, y + up, cd); if (big) { put(x - 3, y + up + (up < 0 ? -1 : 1), C('ink', 2)); put(x + 4, y + up + (up < 0 ? -1 : 1), C('ink', 2)); }
        put(x + 2, y + 1, C('gold', 5));
      }
    }
    // the deck: planks in perspective, wet seams, nail rows, the light of the low sun along the boards
    function deck(t, o) {
      const crackAt = o.cracks;
      for (let y = DF; y < DN; y++) {
        const s = sOf(y), row = y - DF;
        for (let x = 0; x < W; x++) {
          const wx = CX + 240 + (x - 240) / s, b = fl(wx / 10), bu = frac(wx / 10), seam = bu * 10 * s < 1.05;
          const grain = vn(wx * 0.35, y * 2.2 + b * 30, 2, 351), tone = (ih(b, 1, 352) - 0.5) * 0.9 + (ih(b, fl(wx / 90), 353) < 0.12 ? -0.8 : 0);
          let v = 2.9 + tone + (grain > 0.62 ? 0.5 : grain < 0.3 ? -0.4 : 0) + (row < 2 ? 1.0 : 0) - row * 0.03;
          if (seam) v = 1.0;
          // a plank end, staggered board to board
          if (Math.abs(frac(wx / 10) - 0.5) < 0.45 && Math.abs(((wx * 0.0 + y * 3 + ih(b, 2, 354) * 300) % 90)) < 1.2) v -= 1.4;
          // nail rows over the joists
          if ((row === 4 || row === 13 || row === 24) && Math.abs(bu - 0.5) < 0.12) v = 4.6;
          // the sun's sheen on wet boards
          if (o.sheen !== false && grain > 0.55 && ih(b, fl(y / 3), 355) < 0.3 && row > 3) v += 0.8;
          BUF[y * W + x] = cel(R.wood, v, x, y);
        }
      }
      // the far edge: a lit rail of the planks' ends against the sea
      for (let x = 0; x < W; x++) { BUF[DF * W + x] = C('wood', 5); BUF[(DF + 1) * W + x] = C('fire', 5); }
      // the near face: a heavy beam with bolts, then the piles going down into the water, braces, dark under the deck
      const wl = WL0 + (o.pull || 0) * 22 - (o.surge || 0) * 10;
      for (let y = DN; y < DN + 8; y++) for (let x = 0; x < W; x++) { const wx = x + CX; BUF[y * W + x] = cel(R.wood, 1.8 + (y === DN ? 1.4 : 0) + (y === DN + 7 ? -1 : 0) + (vn(wx * 0.3, y * 2, 2, 356) > 0.6 ? 0.5 : 0) + ((fl(wx) % 40 === 6 || fl(wx) % 40 === 7) && y === DN + 3 ? 2.6 : 0), x, y); }
      for (let y = DN + 8; y < H; y++) for (let x = 0; x < W; x++) BUF[y * W + x] = cel(R.ink, 1.2 + (frac((x + CX * 0.9) / 46) < 0.08 ? 1.6 : 0) + (y < DN + 11 ? -0.5 : 0), x, y);
      // piles and braces
      for (let k = -2; k < 30; k++) {
        const wx = k * 52 + 14, x = fl(wx - CX); if (x < -12 || x > W + 12) continue;
        for (let y = DN + 8; y < H; y++) for (let q = 0; q < 8; q++) { const xx = x + q; if (xx < 0 || xx >= W) continue; const u = q / 7; let v = 2.2 + (u < 0.3 ? 1.2 : u > 0.75 ? -1 : 0) + (vn(xx * 0.5, y * 0.2, 2, 357) > 0.65 ? -0.6 : 0); let c = cel(R.wood, v, xx, y); if (Math.abs(y - wl) < 7 && ih(xx, y, 358) < 0.4) c = ih(xx, y, 359) < 0.5 ? C('linen', 5) : C('stone', 3); if (y > wl - 2 && y < wl + 14 && ih(xx, y >> 1, 360) < 0.25) c = C('moss', 2); BUF[y * W + xx] = c; }
        if (k % 2 === 0) { line(x + 8, DN + 10, x + 52, Math.min(H, wl - 4), C('wood', 1), 2); line(x + 8, DN + 11, x + 52, Math.min(H, wl - 3), C('wood', 3)); }
      }
      if (crackAt) crackAt();
      return wl;
    }
    // the water under the dock: the sky's colours in broken ripples, piles' reflections, foam round them; it can stop dead,
    // drain away (pull) or come back high (surge)
    function nearWater(t, o, wl) {
      const rt = o.rt;
      for (let y = Math.max(fl(wl), DN + 8); y < H; y++) {
        const d = (y - wl) / 40;
        for (let x = 0; x < W; x++) {
          const wx = x + CX * 1.1, n = vn(wx / (5 + d * 6) + Math.sin(y * 0.7 + rt * 2) * 0.6, y * 1.3 + rt * 1.6, 1, 361);
          const pile = frac((x + CX - 14) / 52) < 8 / 52;
          let c = cel(R.sea, 2.2 + d * 0.6 + (n > 0.68 ? 1.6 : n < 0.22 ? -0.8 : 0), x, y);
          if (n > 0.8) c = C('rose', 5);
          if (pile) c = cel(R.wood, 1.2 + (n > 0.5 ? 0.6 : 0), x, y);
          if (y < wl + 2 && (ih(fl((x + rt * 9) / 2), y, fl(rt * 4)) < 0.5 || pile)) c = C('snow', 7);
          BUF[y * W + x] = c;
        }
      }
    }
    // things on the deck
    function crateArt(x, y, w, h, seed, o) {
      o = o || {}; x = fl(x); y = fl(y);
      for (let yy = y - h; yy < y; yy++) for (let xx = x; xx < x + w; xx++) {
        const u = xx - x, v = yy - (y - h), edge = u === 0 || u === w - 1 || v === 0 || v === h - 1, diag = Math.abs(u / (w - 1) - v / (h - 1)) < 0.09;
        put(xx, yy, edge ? C('wood', u === 0 || v === 0 ? 4 : 1) : diag ? C('wood', 3) : cel(R.wood, 3.2 + (v % 4 === 0 ? -1 : 0) + (u > w * 0.6 ? -0.6 : 0.2), xx, yy));
      }
      if (o.stamp) { put(x + 3, y - h + 3, C('crimson', 3)); put(x + 4, y - h + 3, C('crimson', 3)); put(x + 3, y - h + 4, C('crimson', 3)); }
      shadowE(x + w / 2, y, w * 0.7, 2);
    }
    function barrelArt(x, y, r, h, seed) {
      x = fl(x); y = fl(y);
      fillEll(x, y - h + 1, r, 1.8, 0, (xx, yy, u) => cel(R.wood, 4 + (u < 0 ? 0.5 : 0), xx, yy));
      for (let yy = y - h + 1; yy < y; yy++) { const v = (yy - (y - h)) / h, bulge = r * (0.88 + Math.sin(v * PI) * 0.12); for (let xx = fl(x - bulge); xx <= x + bulge; xx++) { const u = (xx - x) / bulge; const hoop = Math.abs(v - 0.2) < 0.06 || Math.abs(v - 0.8) < 0.06; put(xx, yy, hoop ? C('stone', u < -0.2 ? 4 : 2) : cel(R.wood, 2.8 + (u < -0.3 ? 1 : u > 0.5 ? -1 : 0) + (frac(u * 2.5) < 0.12 ? -0.7 : 0), xx, yy)); } }
      shadowE(x, y, r * 1.2, 2);
    }
    function shadowE(x, y, rx, ry) { for (let yy = fl(y - ry); yy <= y + ry; yy++) for (let xx = fl(x - rx); xx <= x + rx; xx++) { if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue; const d = Math.hypot((xx - x) / rx, (yy - y) / ry); if (d < 1) tintI(yy * W + xx, xx, yy, tab('#1a1028'), 0.45 * (1 - d * 0.6)); } }
    function lampPost(x, y, t, lit) {
      x = fl(x); for (let yy = y - 46; yy < y; yy++) { put(x, yy, C('ink', 2)); put(x + 1, yy, C('ink', 3)); }
      rectF(x - 2, y - 3, 6, 3, C('ink', 2)); line(x + 1, y - 44, x + 7, y - 44, C('ink', 2));
      const sw = Math.sin(t * 1.5 + x) * 0.8, lx = x + 7 + sw, ly = y - 40;
      line(x + 7, y - 44, lx, ly - 3, C('ink', 3));
      fillPoly([[lx - 2.5, ly - 3], [lx + 2.5, ly - 3], [lx + 3, ly + 3], [lx - 3, ly + 3]], (xx, yy) => (xx === fl(lx) - 3 || xx === fl(lx) + 2 ? C('ink', 2) : lit ? C('fire', yy < ly ? 6 : 5) : C('stone', 2)));
      rectF(lx - 3, ly - 4, 7, 1, C('ink', 1)); rectF(lx - 3, ly + 3, 7, 1, C('ink', 1));
      if (lit) glow(lx, ly, 16, tab('#ffb050', true), 0.35);
    }
    function bollard(x, y, rope, t) {
      x = fl(x); fillEll(x, y - 6, 3.4, 2, 0, (xx, yy, u) => C('ink', u < -0.2 ? 3 : 1)); for (let yy = y - 6; yy < y; yy++) for (let xx = x - 3; xx <= x + 3; xx++) put(xx, yy, C('ink', xx < x - 1 ? 3 : 1)); fillEll(x, y - 7, 2.6, 1.4, 0, C('stone', 3));
      if (rope) { const [rx, ry] = rope; for (let q = 0; q <= 30; q++) { const u = q / 30, px_ = lerp(x, rx, u), py_ = lerp(y - 5, ry, u) + Math.sin(u * PI) * 5; put(fl(px_), fl(py_), (q & 1) ? C('linen', 3) : C('wood', 4)); } }
    }
    function ropeCoil(x, y) { for (let k = 0; k < 4; k++) fillEll(x, y - 1 - k * 0.8, 7 - k, 2.2 - k * 0.3, 0, (xx, yy, u, v) => (Math.hypot(u, v) > 0.7 || k === 3 ? cel(R.linen, 2.8 + (u < 0 ? 0.8 : 0) + ((xx + yy) & 1 ? -0.5 : 0), xx, yy) : -1)); shadowE(x, y, 8, 2); }
    function netFrame(x, y, t, rt) {
      for (const px_ of [x, x + 34]) { line(px_, y, px_, y - 40, C('wood', 2), 2); }
      line(x, y - 40, x + 35, y - 40, C('wood', 3), 2);
      for (let j = 0; j < 30; j++) for (let i = 0; i < 34; i++) { const sag = Math.sin(i / 34 * PI) * 4 + Math.sin(rt * 1.4 + i * 0.3) * 0.6; const yy = fl(y - 38 + j + sag * (j / 30)); if ((i % 4 === 0 || j % 4 === 0) && j < 26 + Math.sin(i * 0.7) * 3) put(x + 1 + i, yy, C('linen', (i + j) % 8 === 0 ? 4 : 2)); }
      for (const [fx, fy] of [[x + 8, y - 22], [x + 22, y - 16]]) { rectF(fx, fy, 3, 3, C('gold', 4)); put(fx + 1, fy, C('gold', 6)); }
    }
    // the harbour, all of it: o { cx, rt (world clock — freeze it to stop the world), pull, surge, lamps, hush (0..1 drained), sigil }
    function harbour(t, o) {
      o = o || {}; CX = o.cx || 0; o.rt = o.rt === undefined ? Math.min(t, HUSH_T) : o.rt;
      LAMPS.length = 0;
      const sun = dawnSky(t, o);
      if (o.sky) o.sky(t);
      farShore(t, o);
      farSea(t, o, sun);
      farPier(t, o);
      boats(t, o);
      if (o.surgeFn) o.surgeFn();
      gulls(t, o, 14, 50);
      const wl = deck(t, o);
      nearWater(t, o, wl);
      // the props along the dock
      for (const lx of LAMPS_X) { const x = sx(lx); if (x > -20 && x < W + 20) lampPost(x, DF + 6, o.rt, o.lamps !== false); }
      for (const bx of BOLL_X) { const x = sx(bx); if (x > -30 && x < W + 30) bollard(x, DF + 5, [x - 40 + (bx % 3) * 12, 158], o.rt); }
      const props = o.props || {};
      const P_ = (wx, fn) => { const x = sx(wx); if (x > -60 && x < W + 60) fn(x); };
      P_(-110, (x) => { crateArt(x, DF + 10, 22, 18, 1); crateArt(x + 3, DF - 8, 16, 14, 2); barrelArt(x + 32, DF + 10, 7, 19, 3); });
      P_(30, (x) => ropeCoil(x, DF + 12));
      P_(236, (x) => { barrelArt(x, DF + 9, 7, 18, 4); barrelArt(x + 15, DF + 9, 7, 18, 5); ropeCoil(x + 30, DF + 14); });
      if (!props.noDockStack) P_(DOCKX + 18, (x) => { crateArt(x - 4, DF + 14, 22, 18, 6, { stamp: 1 }); crateArt(x + 19, DF + 12, 18, 16, 7); crateArt(x - 1, DF - 4, 17, 15, 8); });
      P_(560, (x) => netFrame(x, DF + 8, t, o.rt));
      if (!props.noBarrels) P_(BRLX, (x) => { barrelArt(x - 9, DF + 13, 8, 20, 9); barrelArt(x + 9, DF + 14, 8, 20, 10); barrelArt(x, DF - 6, 8, 20, 11); crateArt(x + 19, DF + 9, 20, 17, 12); });
      P_(720, (x) => { crateArt(x, DF + 12, 22, 18, 13); barrelArt(x + 32, DF + 12, 7, 19, 14); });
      P_(860, (x) => ropeCoil(x, DF + 13));
      return wl;
    }
    // after the figures: drifting motes in the low sun, the warm haze
    function harbourAfter(t, o) {
      o = o || {}; const rt = o.rt === undefined ? Math.min(t, HUSH_T) : o.rt;
      for (let k = 0; k < 40; k++) { const x = fl((ih(k, 1, 371) * W + rt * (4 + ih(k, 2, 371) * 6) + Math.sin(rt + k) * 4) % W), y = fl(30 + ih(k, 3, 371) * 200 + Math.sin(rt * 0.7 + k) * 6); if (ih(k, 4, 371) < 0.5) put(x, y, C('fire', 6)); }
    }
    HB.harbour = harbour; HB.harbourAfter = harbourAfter;
    // a whole-frame tint snapped to one of the tint table's levels, so it never lands on a band edge (which would checker the frame)
    HB.tintFlat = (T, a) => { const l = Math.round(a * 8 - 0.5); if (l < 0) return; tintAll(T, (Math.min(7, l) + 0.5) / 8); };
    HB.consts = { HOR, DF, DY, DN, AX, IX, BRLX, BELLX, DOCKX, HUSH_T };
    HB.setCX = (v) => { CX = v; }; HB.sx = (wx) => wx - CX;
    HB.shadowE = shadowE; HB.crateArt = crateArt; HB.barrelArt = barrelArt;
  }
  /* ---------------------------------------------------------------- shot helpers: light, poses, effects */
  {
    const { lyBegin, lyEnd, stampEx, actorEx, fishArt, shadowE } = HB;
    const K = HB.consts;
    // dawn light: the low sun behind the dock — a warm rim on whichever side faces it
    const SUNX = 300;
    function dawnLit(x) { LIGHT.x = x < SUNX ? 0.75 : -0.75; LIGHT.y = -0.55; ENV.edge = C('fire', 6); }
    // a character on the dock at world x: shadow, the actor (or a turned actor with o.rot), the warm rim
    function onDock(CH, P, wx, y, f, o) {
      const x = HB.sx(wx); if (!(o && o.light === false)) dawnLit(x);
      if (HB.IMP || HB.IMPC !== undefined) { o = Object.assign({}, o || {}, { color: HB.IMPC !== undefined ? HB.IMPC : C('ink', 0), noShadow: true }); ENV.edge = null; }
      if (!(o && o.noShadow)) shadowE(x, y === undefined ? K.DY : Math.max(y, K.DF + 4), 10, 2.2);
      // a breath: one pixel of rise and fall, out of step from figure to figure (frozen when the world stops)
      if (P.bob === undefined && !(o && o.rot)) { const bt = Math.min(T_NOW, T_NOW < 228.5 || T_NOW > 240 ? T_NOW : 228.5); P = Object.assign({}, P, { bob: Math.sin(bt * 2.6 + wx * 0.37) > 0.55 ? -1 : 0 }); }
      const r = o && (o.rot || o.glitch || o.px) ? actorEx(CH, Object.assign({ t: T_NOW }, P), x, y, f, o) : actor(CH, Object.assign({ t: T_NOW }, P), x, y, 1, f, o);
      ENV.edge = null; return r;
    }
    // a walk cycle: phase ph, stride k (sprite px)
    function walkP(P, ph, k, B) {
      const s = Math.sin(ph), c = Math.cos(ph);
      P.legs = [{ foot: [s * k, -Math.max(0, c) * k * 0.4] }, { foot: [-s * k, -Math.max(0, -c) * k * 0.4] }];
      if (!P.arms) P.arms = [{ a: -s * 0.5, b: 0.4 }, { a: s * 0.5, b: 0.4 }];
      P.hip = -B.leg + Math.abs(s) * k * 0.08 + (Math.abs(c) > 0.9 ? 0 : 0) - 0.3;
      return P;
    }
    function runP(P, ph, k, B) {
      const s = Math.sin(ph), c = Math.cos(ph);
      P.legs = [{ foot: [s * k, -Math.max(0, c) * k * 0.55] }, { foot: [-s * k, -Math.max(0, -c) * k * 0.55] }];
      if (!P.arms) P.arms = [{ a: -s * 0.95, b: 0.8 }, { a: s * 0.95, b: 0.8 }];
      P.hip = -B.leg + Math.abs(s) * k * 0.12 - 0.5; P.lean = (P.lean || 0) + 2; P.wind = (P.wind || 0) + 1.5;
      return P;
    }
    const stand = (B, w) => ({ hip: -B.leg, legs: [{ foot: [w || 4, 0] }, { foot: [-(w || 4), 0] }] });
    // ballistic things: (x0, y0) launched at (vx, vy) px/s, gravity G, landing on floor (then resting); returns [x, y, landed, age after landing]
    function arc(x0, y0, vx, vy, G, g, floor) {
      const y = y0 + vy * g + 0.5 * G * g * g;
      if (floor === undefined || y < floor || vy + G * g < 0) return [x0 + vx * g, y, false, 0];
      // when it came down to the floor
      const a = 0.5 * G, b = vy, c = y0 - floor, tl = (-b + Math.sqrt(Math.max(0, b * b - 4 * a * c))) / (2 * a);
      return [x0 + vx * tl, floor, true, g - tl];
    }
    // splinters / planks flung out of a burst, tumbling, landing on the planks and staying there
    function debris(x, y, g, n, seed, o) {
      if (g < 0) return; o = o || {}; const sp_ = o.speed || 1, floor = o.floor === undefined ? K.DY : o.floor;
      for (let k = 0; k < n; k++) {
        const a = -PI / 2 + (ih(k, 1, seed) - 0.5) * (o.spread || 2.6), v = (60 + ih(k, 2, seed) * 120) * sp_, fy = floor - 6 + ih(k, 3, seed) * 14;
        const [px, py, landed] = arc(x, y, Math.cos(a) * v, Math.sin(a) * v, 420, g, fy);
        const len = 3 + ih(k, 4, seed) * (o.big ? 9 : 5), ang = landed ? ih(k, 5, seed) * 0.6 - 0.3 : g * (8 + ih(k, 6, seed) * 12) * (k & 1 ? 1 : -1);
        const c = o.ramp ? o.ramp(k) : C('wood', ih(k, 7, seed) < 0.5 ? 4 : 2);
        line(px - Math.cos(ang) * len / 2, py - Math.sin(ang) * len / 2, px + Math.cos(ang) * len / 2, py + Math.sin(ang) * len / 2, c, ih(k, 8, seed) < 0.3 && o.big ? 2 : 1);
      }
    }
    // a ring of dust rolling out across the planks, and puffs climbing off it
    function dustRing(x, y, g, size, seed, ramp) {
      if (g < 0 || g > 1.4) return; const r = size * eoc(g / 0.9) * 40, a = 1 - g / 1.4; ramp = ramp === undefined ? R.linen : ramp;
      for (let k = 0; k < 26; k++) {
        const an = k / 26 * TAU + ih(k, 1, seed) * 0.2, rr = r * (0.8 + ih(k, 2, seed) * 0.35), px = x + Math.cos(an) * rr, py = y + Math.sin(an) * rr * 0.22 - g * 10 * ih(k, 3, seed), pr = (2 + size * 3 * ih(k, 4, seed)) * (0.6 + g);
        if (ih(k, 5, seed) > a * 1.3) continue;
        fillEll(px, py, pr, pr * 0.8, 0, (xx, yy, u, v) => (bay(xx, yy) < a * (1 - Math.hypot(u, v) * 0.5) ? cel(ramp, 4.6 - v * 1.2 + (u < 0 ? 0.6 : 0), xx, yy) : -1));
      }
    }
    // an impact: a white star that shrinks, rays, a ring
    function impactStar(x, y, g, size, col) {
      if (g < 0 || g > 0.35) return; const u = g / 0.35, r = size * (6 + u * 22);
      for (let k = 0; k < 10; k++) { const an = k / 10 * TAU + 0.3, l = r * (k & 1 ? 0.7 : 1.3) * (1 - u * 0.4); line(x + Math.cos(an) * r * 0.3 * u, y + Math.sin(an) * r * 0.3 * u, x + Math.cos(an) * l, y + Math.sin(an) * l, k & 1 ? (col || C('fire', 6)) : WHITE, u < 0.5 ? 2 : 1); }
      if (u < 0.6) { const r0 = size * 9 * (1 - u / 0.6), r1 = r0 * 0.28; const pts = []; for (let k = 0; k < 8; k++) { const an = k / 8 * TAU, rr = k & 1 ? r1 : r0 * (k % 4 === 0 ? 1 : 0.7); pts.push([x + Math.cos(an) * rr, y + Math.sin(an) * rr]); } fillPoly(pts, WHITE); fillEll(x, y, r1 * 1.2, r1 * 1.2, 0, col || C('fire', 6)); fillEll(x, y, r1 * 0.6, r1 * 0.6, 0, WHITE); }
      for (let a = 0; a < TAU; a += 0.04) { const xx = fl(x + Math.cos(a) * r * 1.3), yy = fl(y + Math.sin(a) * r * 0.8); if (bay(xx, yy) < 1 - u) put(xx, yy, WHITE); }
    }
    // the impact frame: the whole picture in two tones for a beat, figures black on white (or inverted)
    function impactFrame(inv, cx, cy) {
      for (let i = 0; i < NP; i++) { const l = LUM[BUF[i]]; BUF[i] = (l < 95) !== !!inv ? C('ink', 0) : WHITE; }
      if (cx !== undefined) for (let k = 0; k < 40; k++) { const an = ih(k, 1, 991) * TAU, r0 = 60 + ih(k, 2, 991) * 60; line(cx + Math.cos(an) * r0, cy + Math.sin(an) * r0, cx + Math.cos(an) * 400, cy + Math.sin(an) * 400, inv ? WHITE : C('ink', 0), ih(k, 3, 991) < 0.3 ? 2 : 1); }
    }
    // a splash: a crown of water thrown up, droplets arcing out, white foam, then rings spreading on the water
    function splash(x, y, g, size, seed) {
      if (g < 0) return;
      if (g < 1.1) {
        const h = size * 46 * Math.sin(Math.min(1, g / 0.7) * PI) * (g < 0.35 ? eoc(g / 0.35) : 1);
        for (let k = -8; k <= 8; k++) { const u = k / 8, cx = x + u * size * 10 * (1 + g), top = y - h * (1 - u * u * 0.7) * (0.75 + ih(k, 1, seed) * 0.4); for (let yy = fl(top); yy < y; yy++) put(fl(cx), yy, (yy - top) < 2 ? WHITE : bay(fl(cx), yy) < 0.5 ? C('sky', 6) : C('sea', 5)); }
        for (let k = 0; k < 30; k++) { const a = -PI / 2 + (ih(k, 2, seed) - 0.5) * 2.2, v = (60 + ih(k, 3, seed) * 110) * size; const [px, py] = arc(x, y - 2, Math.cos(a) * v, Math.sin(a) * v, 380, g); if (py < y + 2) { put(fl(px), fl(py), k % 3 ? WHITE : C('sky', 6)); if (k % 4 === 0) put(fl(px), fl(py) + 1, C('sky', 5)); } }
      }
      for (let q = 0; q < 3; q++) { const gg = g - q * 0.25; if (gg < 0 || gg > 1.6) continue; const r = size * (6 + gg * 30); for (let a = 0; a < TAU; a += 0.6 / r) { const xx = fl(x + Math.cos(a) * r), yy = fl(y + Math.sin(a) * r * 0.2); if (ih(xx, yy, fl(gg * 8)) < 1 - gg / 1.6) put(xx, yy, WHITE); } }
    }
    // music notes from a whistler
    function notes(x, y, t) { for (let k = 0; k < 3; k++) { const u = frac(t * 0.8 + k / 3), nx = x + u * 14 + Math.sin(t * 3 + k) * 2, ny = y - u * 18; if (u > 0.9) continue; const c = C('linen', 7); put(fl(nx), fl(ny), c); put(fl(nx) + 1, fl(ny), c); put(fl(nx), fl(ny) + 1, c); put(fl(nx) + 1, fl(ny) + 1, c); for (let j = 1; j < 5; j++) put(fl(nx) + 2, fl(ny) - j + 1, c); if (k & 1) put(fl(nx) + 3, fl(ny) - 3, c); } }
    // dizzy stars circling a head
    function dizzy(x, y, r, t) { for (let k = 0; k < 4; k++) { const a = t * 6 + k / 4 * TAU, px = fl(x + Math.cos(a) * r), py = fl(y + Math.sin(a) * r * 0.3); const c = Math.sin(a) > 0 ? C('gold', 7) : C('gold', 4); put(px, py, c); put(px - 1, py, c); put(px + 1, py, c); put(px, py - 1, c); put(px, py + 1, c); } }
    // a zig-zag of lightning between two points
    function bolt(x0, y0, x1, y1, seed, w, cIn, cOut) {
      const n = Math.max(3, fl(Math.hypot(x1 - x0, y1 - y0) / 7)); let px = x0, py = y0;
      for (let i = 1; i <= n; i++) { const u = i / n, j = i === n ? 0 : (ih(i, seed, 61) - 0.5) * 14, nx = -(y1 - y0), ny = x1 - x0, nl = Math.hypot(nx, ny) || 1; const qx = lerp(x0, x1, u) + nx / nl * j, qy = lerp(y0, y1, u) + ny / nl * j; line(px, py, qx, qy, cOut || C('gold', 5), (w || 1) + 2); line(px, py, qx, qy, cIn || WHITE, w || 1); px = qx; py = qy; }
    }
    // the hit-stop of a cut: hold the action clock for d at each hit
    const holdClock = (t, hits) => { let T = t; for (const [h, d] of hits) T -= clamp(t - h, 0, d); return T; };
    // speed lines across the frame (a whoosh) or toward a point (a focus)
    function speedLines(t, n, ang, c, seed) { const dx = Math.cos(ang), dy = Math.sin(ang); for (let k = 0; k < n; k++) { const y = ih(k, 1, seed) * H, x = frac(ih(k, 2, seed) + t * 3) * (W + 200) - 100, l = 30 + ih(k, 3, seed) * 80; line(x, y, x + dx * l, y + dy * l, c || WHITE); } }
    Object.assign(HB, { dawnLit, onDock, walkP, runP, stand, arc, debris, dustRing, impactStar, impactFrame, splash, notes, dizzy, bolt, holdClock, speedLines });
  }
  /* ================================================================ 24–25: the crash, the comedy, three wardens (2:56–3:17) */
  {
    const { onDock, walkP, stand, arc, debris, dustRing, impactStar, impactFrame, splash, notes, dizzy, holdClock, shadowE, fishArt, crateArt, actorEx, harbour, harbourAfter, sx } = HB;
    const K = HB.consts, DY = K.DY, IX = K.IX;
    const IMPACT = 178.0, FISH_UP = 180.5, THUDS = [188.6, 188.8, 189.0], WDX = [22, 46, 70], WDY = [DY - 6, DY - 2, DY + 2];
    const TB = TAMO.body, KB = KAIRA.body, WB = WARDEN.body;
    // Tamo's crate in his arms (frame coords, in front of him)
    const heldCrate = (x, y) => { crateArt(x - 2, y, 22, 17, 3, { stamp: 1 }); };
    // the wreck on the planks: splinters, the crate's boards, fish (landed ones flop for a while)
    function fishBurst(t, skipUp) {
      const g = t - IMPACT - 0.05; if (g < 0) return;
      const x0 = sx(IX) + 6, y0 = DY - 20;
      for (let k = 0; k < 9; k++) {
        const a = -PI / 2 + (ih(k, 1, 401) - 0.5) * 2.4, v = 90 + ih(k, 2, 401) * 140, fy = DY - 6 + ih(k, 3, 401) * 16;
        const [px, py, landed, ag] = arc(x0, y0, Math.cos(a) * v, Math.sin(a) * v, 420, g, fy);
        const flop = landed ? Math.sin(t * (13 + k) + k) * Math.max(0, 1 - ag * 0.25) : 0;
        fishArt(px, py - Math.abs(flop) * 3, 9 + ih(k, 4, 401) * 3, landed ? (k & 1 ? 0.1 : PI - 0.1) + flop * 0.5 : g * (9 + k), flop);
      }
    }
    function wreck(t) {
      const g = t - IMPACT; if (g < 0) return;
      debris(sx(IX) + 6, DY - 22, g, 18, 402, { big: true });
      debris(sx(IX) + 4, DY - 4, g, 22, 403, { speed: 0.6 });
      // the crate's lid, spinning high and landing last
      const [lx, ly, landed] = arc(sx(IX) + 10, DY - 26, 70, -260, 420, g, DY + 4);
      const ang = landed ? 0.2 : g * 11; for (let q = -8; q <= 8; q++) for (let w = -1; w <= 1; w++) put(fl(lx + Math.cos(ang) * q - Math.sin(ang) * w), fl(ly + Math.sin(ang) * q + Math.cos(ang) * w), C('wood', w < 0 ? 4 : 3));
      if (landed) shadowE(lx, ly + 1, 8, 1.5);
      fishBurst(t);
    }
    // Tamo flat on his back (rot) or sitting up; Kaira on top; returns his head position
    function tamoDown(t, P, rot, x, y) { return onDock(TAMO, P, x, y, 1, { rot, px: 0, py: -TB.leg, noShadow: true }); }
    const TAMO_SIT = { hip: -7, legs: [{ foot: [24, 0], knee: [13, -5] }, { foot: [21, 0], knee: [11, -6] }], arms: [{ hand: [-6, -4] }, { hand: [-9, -4] }] };
    const fishOnHead = (r, t, lift) => { if (r) fishArt(r.head[0] + 1, r.head[1] - 10 - (lift || 0), 12, Math.PI + 0.12 + Math.sin(t * 20) * 0.04, Math.sin(t * 22)); };

    // 24a — the dock at dawn (2:56): a wide, the camera coming down onto the planks; Tamo whistling along with a crate;
    // a shadow grows round him; he looks up; a streak of gold comes out of the sky
    shot(176.0, 178.0, (lt, t) => {
      harbour(t, { cx: 0 });
      const walking = t < 177.45, wx = lerp(52, IX - 4, eoc(lin(176.0, 177.55, t)) * 0.3 + lin(176.0, 177.55, t) * 0.7), ph = (wx - 52) * 0.42;
      const look = sstep(177.45, 177.62, t), jolt = sstep(177.78, 177.86, t);
      // the falling courier's shadow on the planks, growing
      const fu = lin(177.2, IMPACT, t);
      if (fu > 0) shadowE(sx(IX) + 4, DY, 4 + fu * 14, 1 + fu * 2.6);
      const P = walking ? walkP({ face: { eyes: 'happy', smile: 0.7, mouth: 0.18 } }, ph, 5, TB) : Object.assign(stand(TB, 4), { hip: -TB.leg + (jolt > 0 ? -2 : 0), lean: -look * 2, face: { eyes: look > 0.5 ? 'wide' : 'happy', brows: look > 0.5 ? 'up' : 'n', mouth: look > 0.5 ? 0.8 : 0.18, smile: look > 0.5 ? 0 : 0.7 } });
      P.arms = [{ hand: [10, -38 - jolt * 8] }, { hand: [8, -37 - jolt * 8] }];
      const r = onDock(TAMO, P, wx, DY, 1);
      heldCrate(sx(wx) + 4, r.handN[1] + 8);
      if (walking) notes(r.head[0] + 6, r.head[1] - 6, t);
      if (look > 0.5 && t < 177.9) { const ex = fl(r.head[0] + 3), ey = fl(r.head[1] - 18 - jolt * 3); rectF(ex, ey, 2, 6, C('fire', 6)); rectF(ex, ey + 8, 2, 2, C('fire', 6)); }
      // the courier, falling: a tumbling figure at the head of a gold streak
      if (fu > 0) {
        const e = (q) => Math.pow(q, 1.7), fx = (q) => lerp(sx(IX) + 190, sx(IX) + 6, e(q)), fy = (q) => lerp(-60, DY - 30, e(q));
        for (let j = 16; j >= 1; j--) { const q0 = Math.max(0, fu - j * 0.035), q1 = Math.max(0, fu - (j - 1) * 0.035), w = Math.max(1, 7 - j * 0.4); for (let d = -w; d <= w; d += 1) line(fx(q0) + d * 0.5, fy(q0) + d * 0.8, fx(q1) + d * 0.5, fy(q1) + d * 0.8, Math.abs(d) < w * 0.35 ? WHITE : Math.abs(d) < w * 0.7 ? C('gold', 6) : C('fire', 4)); }
        LIGHT.x = 0; LIGHT.y = -1; ENV.edge = C('gold', 6);
        actorEx(KAIRA, { t, face: { eyes: 'wide', brows: 'worried', mouth: 0.9 }, wind: 6, arms: [{ a: 2.6 + Math.sin(t * 30) * 0.4, b: 0.3 }, { a: 2.2 - Math.sin(t * 30) * 0.4, b: 0.4 }], legs: [{ foot: [8, -6] }, { foot: [-6, -2] }] }, fx(fu), fy(fu), -1, { rot: t * 16, px: 0, py: -40 });
        ENV.edge = null;
        glow(fx(fu), fy(fu), 30, tab('#ffd060', true), 0.5);
      }
      harbourAfter(t);
      // the camera: the whole harbour, coming down to the planks; a snap in on his face as he looks up
      if (t < 177.62) { const u = eio(lin(176.0, 177.55, t)); view(lerp(240, sx(IX) + 20, u), lerp(135, 168, u), lerp(1.0, 1.9, u)); }
      else { view(sx(IX) + 46, 128, 2.1); shk(1); }
    });

    // 24b — the pile-up (2:58): impact frame; the crate bursts; she's sat on him; fish rain down; the last one lands on his face
    shot(178.0, 182.0, (lt, t) => {
      const g = t - IMPACT;
      HB.IMP = g < 0.067;
      if (HB.IMP) { BUF.fill(WHITE); for (let k = 0; k < 60; k++) { const an = ih(k, 1, 991) * TAU, r0 = 30 + ih(k, 2, 991) * 50, cx = sx(IX) + 4, cy = DY - 16; line(cx + Math.cos(an) * r0, cy + Math.sin(an) * r0 * 0.7, cx + Math.cos(an) * 500, cy + Math.sin(an) * 350, C('ink', 0), ih(k, 3, 991) < 0.3 ? 2 : 1); } }
      else harbour(t, { cx: 0 });
      if (!HB.IMP) { wreck(t); dustRing(sx(IX), DY, g - 0.04, 1.2, 404); }
      // Tamo: flat out, arms flung; a jolt when the fish lands; then he pops up sitting
      const sitT = 181.45, fishHit = t >= FISH_UP;
      let rT;
      const lieP = { face: { eyes: fishHit && t < 181.1 ? 'wide' : 'closed', brows: 'worried', mouth: fishHit && t < 181.0 ? 0.6 : 0.3 }, arms: [{ a: 2.9 + Math.sin(t * 3) * 0.1, b: 0.3 }, { a: 2.5, b: 0.4 }], legs: [{ foot: [7, 0] }, { foot: [-5, 0] }] };
      if (t < sitT) rT = tamoDown(t, lieP, -PI / 2 + (g < 0.12 ? 0.04 : 0), IX - 2, DY - 3 + (t > FISH_UP && t < FISH_UP + 0.1 ? 1 : 0));
      else if (t < sitT + 0.08) rT = tamoDown(t, Object.assign({}, TAMO_SIT, { face: { eyes: 'wide', mouth: 0.4 } }), -PI / 4, IX - 4, DY - 6);
      else { rT = onDock(TAMO, Object.assign({}, TAMO_SIT, { face: { eyes: blink(t, 21) ? 'closed' : 'narrow', brows: 'angry', smile: -0.6 } }), IX - 20, DY + 1, 1); }
      if (t >= sitT) fishOnHead(rT, t, t < sitT + 0.2 ? 6 * (1 - (t - sitT) / 0.2) : 0);
      // the last fish, thrown straight up by the crash, comes down on his face
      if (g > 0.05 && t < FISH_UP) { const u = (t - IMPACT - 0.05) / (FISH_UP - IMPACT - 0.05); fishArt(lerp(sx(IX) + 8, sx(IX) - 30, u), lerp(DY - 22, DY - 8, u) - Math.sin(u * PI) * 330, 12, g * 7, 0); }
      if (fishHit && t < sitT) { fishArt(rT.head[0], rT.head[1] - 3, 12, PI + 0.3 + Math.sin(t * 25) * 0.15, Math.sin(t * 25)); if (t < FISH_UP + 0.3) for (let k = 0; k < 12; k++) { const a = -PI * ih(k, 1, 405), v = 40 + ih(k, 2, 405) * 50, gg = t - FISH_UP; put(fl(rT.head[0] + Math.cos(a) * v * gg), fl(rT.head[1] + Math.sin(a) * v * gg + 160 * gg * gg), k & 1 ? WHITE : C('sky', 6)); } }
      // Kaira: squashed by the landing, sat on him seeing stars; shakes it off; hops off onto her knees
      const hop = lin(181.0, 181.35, t);
      if (hop <= 0) {
        const sq = g < 0.08 ? 1 : g < 0.2 ? 0.4 : 0, dazed = t < 180.8;
        const r = onDock(KAIRA, { hip: -9 + sq * 4, lean: dazed ? Math.round(Math.sin(t * 5) * 1.5) : 0, headX: dazed ? Math.round(Math.sin(t * 5)) : 0, legs: [{ knee: [9, -13 + sq * 3], foot: [13, 0] }, { knee: [7, -12 + sq * 3], foot: [10, 0] }], arms: g < 0.25 ? [{ a: 2.4, b: 0.3 }, { a: -0.5 }] : [{ hand: [10, -10] }, { hand: [-6, -6] }], face: { eyes: dazed ? (fl(t * 3) % 2 ? 'closed' : 'half') : blink(t, 22) ? 'closed' : 'open', brows: 'worried', mouth: dazed ? 0.3 : 0, look: t > 180.8 ? (t < 180.92 ? -1 : 1) : 0 }, wind: 1 }, IX - 4, DY - 5, -1, { noShadow: true });
        if (g > 0.35 && dazed) dizzy(r.head[0], r.head[1] - 14, 9, t);
      } else if (hop < 1) {
        onDock(KAIRA, { hip: -KB.leg + 4, legs: [{ foot: [6, -6] }, { foot: [-4, -3] }], arms: [{ a: 2.2, b: 0.3 }, { a: 1.6, b: 0.4 }], face: { eyes: 'open', brows: 'worried' }, wind: 3 }, lerp(IX - 4, IX + 22, hop), DY - Math.sin(hop * PI) * 12, -1);
      } else {
        const sq = lin(181.35, 181.5, t);
        onDock(KAIRA, { hip: lerp(-11, -15, sq), legs: [{ knee: [9, -9], foot: [9, 0] }, { knee: [-3, -1], foot: [-13, -1] }], arms: [{ hand: [8, -18] }, { hand: [5, -17] }], face: { eyes: blink(t, 22) ? 'closed' : 'open', brows: 'worried', smile: 0.3 } }, IX + 22, DY + 1, -1);
        if (sq < 1) HB.dustRing(sx(IX + 22), DY + 1, t - 181.35, 0.4, 406);
      }
      if (t >= sitT && t < sitT + 0.3) HB.dustRing(sx(IX - 20), DY + 1, t - sitT, 0.5, 407);
      if (HB.IMP) { HB.IMP = false; view(sx(IX) + 4, 170, 2.3); return; }
      impactStar(sx(IX) + 4, DY - 16, g, 1.6, C('gold', 6));
      harbourAfter(t);
      view(sx(IX) + 4 + Math.round(lt * 1.5), 170, lerp(2.3, 2.55, eio(lt / 4)));
      shk(g < 0.5 ? 4 * (1 - g / 0.5) : 0);
    });

    // 25a — Tamo, close (3:02): sat in the wreck, the fish on his head — "Hey! That was the GOOD crate!"
    function wreckStage(t, o) { harbour(t, Object.assign({ cx: 0 }, o || {})); wreck(t); }
    shot(182.0, 184.7, (lt, t) => {
      closeBg(() => wreckStage(t), sx(IX) + 20, 166, 3, 3);
      const tk = talking('tamo', t), good = t > 183.35 && t < 184.0;
      const jig = good ? Math.round(Math.sin(t * 40) * 1.2) : 0, bob = tk ? -Math.round(Math.abs(Math.sin(t * 9)) * 2) : 0;
      LIGHT.x = 0.8; LIGHT.y = -0.5; ENV.edge = C('fire', 6);
      bust('tamo', { t, fish: t, face: { eyes: blink(t, 21) ? 'closed' : good ? 'wide' : 'narrow', brows: 'angry', mouth: mouth('tamo', t), smile: -0.5, look: t < 182.5 ? -1 : 0 }, headX: jig, headY: bob }, 188, H - 22 + 6, 3, 1);
      ENV.edge = null;
      // a vein of anger, popping on "GOOD"
      if (good) { const vx = 248, vy = 70; for (const [dx, dy] of [[0, 0], [1, 0], [3, 0], [4, 0], [0, 1], [4, 1], [0, 3], [4, 3], [0, 4], [1, 4], [3, 4], [4, 4]]) rectF(vx + dx * 3, vy + dy * 3, 3, 3, C('crimson', 5)); }
      // a couple of droplets off the fish
      for (let k = 0; k < 4; k++) { const u = frac(t * 1.3 + k / 4); put(fl(150 + k * 30 + Math.sin(k) * 10), fl(60 + u * 200), C('sky', 6)); put(fl(150 + k * 30 + Math.sin(k) * 10), fl(61 + u * 200), C('sky', 5)); }
      shk(good ? 1 : 0);
    });

    // 25b — the two of them (3:04): she springs up — "Sorry! Not sorry! You should run."
    shot(184.7, 187.5, (lt, t) => {
      wreckStage(t);
      const rT = onDock(TAMO, Object.assign({}, TAMO_SIT, { face: { eyes: blink(t, 21) ? 'closed' : t > 186.3 ? 'wide' : 'narrow', brows: t > 186.3 ? 'up' : 'angry', smile: -0.6, look: t > 186.3 ? -1 : 0 } }), IX - 20, DY + 1, 1);
      fishOnHead(rT, t);
      const pop = lin(184.72, 184.95, t), land = lin(184.95, 185.12, t), sorry = t > 185.0 && t < 185.6, notS = t > 185.6 && t < 186.2, run = t > 186.2;
      let P;
      if (t < 184.72) P = { hip: -13 - sstep(184.7, 184.72, t) * 0, legs: [{ knee: [9, -9], foot: [9, 0] }, { knee: [-3, -1], foot: [-13, -1] }], arms: [{ hand: [8, -18] }, { hand: [5, -17] }], face: { eyes: 'open', smile: 0.3 } };
      else if (pop < 1) P = { hip: -KB.leg + 3, legs: [{ foot: [4, -5] }, { foot: [-4, -3] }], arms: [{ a: 2.6, b: 0.2 }, { a: 2.2, b: 0.3 }], face: { eyes: 'open', smile: 0.6 }, wind: 2 };
      else if (land < 1) P = Object.assign(stand(KB, 6), { hip: -KB.leg + 6 * (1 - land), face: { eyes: 'open', smile: 0.6 } });
      else if (sorry) P = Object.assign(stand(KB, 4), { lean: 4, headY: 2, arms: [{ hand: [9, -40] }, { hand: [8, -41] }], face: { eyes: 'closed', brows: 'worried', mouth: mouth('kaira', t), smile: 0.3 } });
      else if (notS) P = Object.assign(stand(KB, 5), { lean: -1, arms: [{ a: 2.6 + Math.sin(t * 14) * 0.15, b: -0.6 }, { a: 0.3 }], face: { eyes: fl(t * 4) % 3 === 0 ? 'happy' : 'narrow', mouth: mouth('kaira', t), smile: 0.9 } });
      else P = Object.assign(stand(KB, 5), { arms: [{ a: 1.65, b: 0.05 }, { a: 0.2 }], face: { eyes: blink(t, 22) ? 'closed' : 'open', brows: 'up', mouth: mouth('kaira', t), smile: 0.2, look: 1 } });
      const kx = IX + 22, ky = DY + 1 - (pop > 0 && pop < 1 ? Math.sin(pop * PI) * 14 : 0);
      onDock(KAIRA, P, kx, ky, -1);
      if (land > 0 && land < 1) HB.dustRing(sx(kx), DY + 1, t - 184.95, 0.4, 408);
      if (notS) { const sx_ = sx(kx) - 14, sy_ = DY - 52; for (let k = 0; k < 4; k++) { const a = t * 5 + k * PI / 2; put(fl(sx_ + Math.cos(a) * 4), fl(sy_ + Math.sin(a) * 4), C('gold', 7)); } }
      harbourAfter(t);
      view(sx(IX) + 4, 166, lerp(2.5, 2.7, eio(lt / 2.8)));
    });

    // the three wardens, dropping onto the planks behind him: a streak, a crouch, a ring of dust and splinters
    function wardenDrop(t, k, P, f) {
      const g = t - THUDS[k], x = WDX[k], y = WDY[k];
      if (g < -0.45) return null;
      if (g < 0) { const yy = y + g * 600; for (let j = 0; j < 40; j++) put(fl(sx(x) + (j & 1)), fl(yy - 40 - j * 2), j < 6 ? WHITE : C('indigo', 6)); return onDock(WARDEN, { hip: -WB.leg + 2, legs: [{ foot: [4, -3] }, { foot: [-4, -2] }], arms: [{ a: 2.6, b: 0.2 }, { a: -0.4 }], prop: (A) => spearArt(A.hand[0], A.hand[1], 0.1, 34, t) }, x, yy, f || 1, { noShadow: true }); }
      const land = eoc(lin(0, 0.32, g)), cr = g < 0.32 ? 1 - land : 0;
      HB.dustRing(sx(x), y, g, 0.9, 411 + k); HB.debris(sx(x), y - 2, g, 8, 415 + k, { speed: 0.6, floor: y });
      if (g < 0.15) HB.impactStar(sx(x), y - 4, g, 0.8, C('indigo', 6));
      return onDock(WARDEN, Object.assign({ hip: -WB.leg + 12 * cr, legs: [{ foot: [7, 0] }, { foot: [-7, 0] }], arms: [{ a: 0.6 + cr * 0.6, b: 0.6 }, { a: -0.3 - cr }], prop: (A) => spearArt(A.hand[0], A.hand[1], lerp(0.1, 0.4, cr), 34, t) }, P || {}), x, y, f || 1);
    }
    // 25c — "run from wh—" (3:07): closer on him; THUD, THUD, THUD behind
    shot(187.5, 189.4, (lt, t) => {
      wreckStage(t);
      const nT = THUDS.filter((h) => t >= h).length, last = nT ? t - THUDS[nT - 1] : 9;
      for (let k = 0; k < 3; k++) wardenDrop(t, k);
      const jump = last < 0.12 ? -2 : 0;
      const rT = onDock(TAMO, Object.assign({}, TAMO_SIT, { hip: TAMO_SIT.hip + jump, face: { eyes: nT ? 'wide' : blink(t, 21) ? 'closed' : 'narrow', brows: nT ? 'up' : 'angry', mouth: nT ? (nT > 2 ? 0.2 : 0.5) : mouth('tamo', t), smile: -0.4, look: nT > 1 ? -1 : 0 } }), IX - 20, DY + 1, 1);
      fishOnHead(rT, t, last < 0.12 ? 3 : 0);
      if (nT) { for (let k = 0; k < nT; k++) { const sx_ = rT.head[0] + 10 + k * 6, sy_ = rT.head[1] - 16 + (k & 1) * 3; rectF(sx_, sy_, 1, 4, C('snow', 7)); } }
      harbourAfter(t);
      view(sx(IX) - 66, 164, 2.6);
      shk(last < 0.3 ? 3 * (1 - last / 0.3) : 0);
    });
    // 25d — over his shoulder (3:09): the three of them rise; the spears come down together; a step
    shot(189.4, 191.6, (lt, t) => {
      wreckStage(t);
      const rise = sstep(189.6, 189.85, t), lower = eoc(lin(189.95, 190.15, t)), step = sstep(190.6, 190.95, t);
      for (let k = 0; k < 3; k++) {
        const x = WDX[k] + step * 8, ph = step * PI;
        const P = { hip: -WB.leg + (1 - rise) * 6, legs: step > 0 && step < 1 ? [{ foot: [5 + Math.sin(ph) * 4, -Math.sin(ph) * 4] }, { foot: [-6, 0] }] : [{ foot: [7, 0] }, { foot: [-7, 0] }], arms: [{ a: lerp(0.6, 1.5, lower), b: lerp(0.6, 0.1, lower) }, { a: -0.3 }], prop: (A) => spearArt(A.hand[0], A.hand[1], lerp(0.1, 1.45, lower), 34, t) };
        const r = onDock(WARDEN, P, x, WDY[k], 1);
        if (lower > 0.6 && lower < 1 || (t > 190.15 && t < 190.4)) { const gx = r.handN[0] + 38, gy = r.handN[1] - 2; put(gx, gy, WHITE); put(gx - 1, gy, C('snow', 7)); put(gx + 1, gy, C('snow', 7)); put(gx, gy - 1, WHITE); put(gx, gy + 1, WHITE); }
        glow(r.head[0] + 3, r.head[1] - 1, 6, tab('#60e0ff', true), 0.5);
        if (step >= 1) HB.dustRing(sx(x), WDY[k], t - 190.95, 0.35, 420 + k);
      }
      harbourAfter(t);
      view(sx(100) + 10, 160, 2.5);
      // Tamo's head and shoulder, close and dark in the right of the frame
      LIGHT.x = 0.7; LIGHT.y = -0.6; ENV.edge = C('fire', 5);
      bust('tamo', { t, fish: t, face: {} }, 420, H - 22 + 30, 3, -1, { color: C('ink', 1) });
      ENV.edge = null;
      if (step >= 1 && t < 191.2) shk(1.2);
    });

    // 25e — he gets up (3:11): "Three grown-ups… against one girl?"
    shot(191.6, 193.5, (lt, t) => {
      closeBg(() => { wreckStage(t); for (let k = 0; k < 3; k++) onDock(WARDEN, { legs: [{ foot: [7, 0] }, { foot: [-7, 0] }], arms: [{ a: 1.5, b: 0.1 }, { a: -0.3 }], prop: (A) => spearArt(A.hand[0], A.hand[1], 1.45, 34, t) }, WDX[k] + 8, WDY[k], 1); }, sx(100), 160, 3, 3);
      // he rises into the frame: a dip, a push, an overshoot
      const dip = sstep(191.85, 192.05, t) * (1 - sstep(192.05, 192.1, t)), rise = eob(lin(192.05, 192.45, t)), y0 = H - 22 + 6 + Math.round(lerp(90, 0, rise) + dip * 8);
      LIGHT.x = 0.8; LIGHT.y = -0.5; ENV.edge = C('fire', 6);
      bust('tamo', { t, fish: t, face: { eyes: blink(t, 23) ? 'closed' : 'narrow', brows: 'angry', mouth: mouth('tamo', t), smile: t > 193.0 ? 0.4 : 0 }, headX: t > 192.9 ? 1 : 0 }, 300, y0, 3, -1);
      ENV.edge = null;
    });

    // 25f — the fish flicked into the sea; a roll of the shoulder; he walks off toward the anchor; she steps back and watches
    shot(193.5, 197.0, (lt, t) => {
      const cam = eio(lin(194.9, 197.0, t)), cx = cam * 120;
      wreckStage(t, { cx });
      for (let k = 0; k < 3; k++) {
        const turn = t > 195.3 + k * 0.15, lookAt = t > 194.0 && t < 194.6 ? 1 : 0;
        const r = onDock(WARDEN, { legs: [{ foot: [7, 0] }, { foot: [-7, 0] }], arms: turn ? [{ a: 0.4, b: 0.4 }, { a: -0.2 }] : [{ a: 1.2, b: 0.1 }, { a: -0.3 }], prop: (A) => spearArt(A.hand[0], A.hand[1], turn ? 0.12 : 1.05, 26, t) }, WDX[k] + 8, WDY[k], lookAt && k === 1 ? -1 : 1);
        glow(r.head[0] + 3, r.head[1] - 1, 6, tab('#60e0ff', true), 0.4);
      }
      // Tamo: stands, flicks the fish off, rolls a shoulder, sets off
      const flick = lin(193.55, 193.8, t), roll = t > 194.2 && t < 194.9, walking = t > 195.0;
      const tx = walking ? IX - 20 + (t - 195.0) * 62 : IX - 20, ph = (tx - IX + 20) * 0.38;
      let P;
      if (walking) P = walkP({ lean: 1, face: { eyes: blink(t, 23) ? 'closed' : 'narrow', brows: 'angry', smile: 0.5 } }, ph, 6, TB);
      else P = Object.assign(stand(TB, 5), { arms: [{ a: flick > 0 && flick < 1 ? lerp(2.6, 3.4, eoc(flick)) : t < 193.55 ? 2.9 : roll ? 0.4 + Math.cos((t - 194.2) * 13) * 0.6 : 0.3, b: roll ? 0.9 : 0.3 }, { a: -0.2 }], face: { eyes: blink(t, 23) ? 'closed' : 'narrow', brows: 'angry', smile: t > 194.0 ? 0.6 : 0, look: t < 194.5 ? -1 : 0 } });
      const rT = onDock(TAMO, P, tx, DY + 1, walking ? 1 : -1);
      if (flick <= 0) fishOnHead(rT, t);
      else if (t < 194.35) { const u = lin(193.65, 194.35, t), p0 = [rT.head[0], rT.head[1] - 10], p1 = [sx(IX - 70), 244]; fishArt(lerp(p0[0], p1[0], u), lerp(p0[1], p1[1], u) - Math.sin(u * PI) * 60, 12, u * 16, 0); }
      HB.splash(sx(IX - 70), 244, t - 194.35, 0.7, 431);
      // Kaira steps back out of his way, then turns to watch him go
      const kx = IX + 22 + sstep(194.5, 195.0, t) * 12, kturn = t > 195.4;
      onDock(KAIRA, Object.assign(stand(KB, 5), { arms: [{ a: 0.3, b: 0.3 }, { a: 0.2 }], face: { eyes: blink(t, 24) ? 'closed' : 'wide', brows: 'up', smile: t > 196 ? 0.3 : 0, look: kturn ? 0 : -1 } }), kx, DY + 4, kturn ? 1 : -1);
      harbourAfter(t);
      view(lerp(sx(IX) - 10, sx(IX + 120) + 10, cam), 164, lerp(2.2, 2.0, cam));
    });
  }
  /* ================================================================ 26: the anchor (3:17–3:34) */
  {
    const { onDock, walkP, stand, arc, debris, dustRing, impactStar, splash, shadowE, crateArt, actorEx, anchorArt, lyBegin, lyEnd, harbour, harbourAfter, sx, bolt, DOCKHAND } = HB;
    const K = HB.consts, DY = K.DY, DF = K.DF, AX = K.AX, DOCKX = K.DOCKX;
    const TB = TAMO.body, KB = KAIRA.body, WB = WARDEN.body;
    const GRIP = 199.5, RIP = 203.0, TAX = AX - 24;
    const WD2 = [96, 118, 140], WDY = [DY - 6, DY - 2, DY + 2];
    // the sea: drawn out of the harbour while he strains, then thrown back in
    const pullOf = (t) => (t < RIP ? sstep(200.3, 202.8, t) : Math.max(0, 1 - eoc(lin(RIP, RIP + 0.7, t))));
    const surgeOf = (t) => (t < RIP + 0.2 ? 0 : Math.sin(lin(RIP + 0.2, RIP + 2.6, t) * PI));
    const glowOf = (t) => clamp(lin(200.2, 202.6, t) + (t > RIP ? 1 : 0), 0, 1);
    // a wave standing up behind the dock as the sea comes back
    function surgeWave(t) {
      const h = surgeOf(t) * 74; if (h < 1) return;
      for (let x = 0; x < W; x++) {
        const yc = DF - h * (0.82 + 0.18 * Math.sin(x * 0.045 + t * 2.5)) - Math.sin(x * 0.13 + t * 6) * 2;
        for (let y = Math.max(0, fl(yc)); y < DF; y++) { const d = y - yc; BUF[y * W + x] = d < 2.5 ? WHITE : d < 5 ? (ih(x, y, fl(t * 12)) < 0.5 ? C('sky', 7) : C('teal', 6)) : cel(R.sea, 4.2 - Math.min(2, d / 30) + (vn(x * 0.3, y * 0.6 - t * 30, 2, 471) > 0.62 ? 1 : 0), x, y); }
        if (ih(x, 1, fl(t * 14)) < 0.25) for (let j = 0; j < 4; j++) put(x + fl(Math.sin(j + t * 9) * 2), fl(yc - 2 - j * 2 - ih(x, j, 472) * 6), j & 1 ? C('sky', 6) : WHITE);
      }
    }
    // spray thrown over the far edge where it breaks, falling back as a salt rain
    function breakSpray(t) {
      const g = t - (RIP + 1.25); if (g < 0 || g > 3.5) return;
      for (let k = 0; k < 160; k++) { const x0 = ih(k, 1, 473) * W, v = 120 + ih(k, 2, 473) * 200, a = -PI / 2 + (ih(k, 3, 473) - 0.5) * 0.9; const [px, py] = HB.arc(x0, DF, Math.cos(a) * v * 0.4, Math.sin(a) * v, 300, g - ih(k, 4, 473) * 0.4); if (py < H && g > ih(k, 4, 473) * 0.4) { put(fl(px), fl(py), k % 3 ? WHITE : C('sky', 6)); if (k % 2) put(fl(px), fl(py) + 1, C('sky', 5)); } }
    }
    function stage(t, cx, o) { return harbour(t, Object.assign({ cx, pull: pullOf(t), surge: surgeOf(t), surgeFn: () => surgeWave(t) }, o || {})); }
    // cracks in the boards round the anchor's foot, growing with the strain
    function cracks(x, y, amt) {
      if (amt <= 0) return;
      for (let k = 0; k < 10; k++) { const a = (k / 10) * TAU + ih(k, 1, 421), L = amt * (12 + ih(k, 2, 421) * 30); let px = x, py = y; for (let s = 1; s <= 6; s++) { const u = s / 6, nx = x + Math.cos(a + (ih(k, s, 422) - 0.5) * 0.8) * L * u, ny = y + Math.sin(a + (ih(k, s, 423) - 0.5) * 0.8) * L * u * 0.28; line(px, py, nx, ny, C('ink', 0), s < 3 ? 2 : 1); if (s === 2) line(px, py - 1, nx, ny - 1, C('wood', 5)); px = nx; py = ny; } }
    }
    // the anchor standing in the planks (lift: how far it has come up out of them)
    function anchorInDeck(t, g, lift, shake) {
      const j = shake ? Math.round((ih(fl(t * 30), 1, 7) - 0.5) * 2 * shake) : 0, x = sx(AX) + j, y = DY - 50 - lift;
      LIGHTS.x = LIGHT.x; LIGHTS.y = LIGHT.y;
      lyBegin(); anchorArt(x, y, 0, 1.05, g, t); lyEnd({ edge: g > 0.3 ? C('mint', 7) : C('fire', 6) });
      if (lift < 16) {
        fillEll(sx(AX), DY + 3, 15, 3.6, 0, (xx, yy, u, v) => (v < -0.3 ? -1 : C('ink', 0)));
        for (let k = 0; k < 9; k++) { const a = PI * (k / 8), ex = sx(AX) + Math.cos(a) * 15, ey = DY + 3 + Math.sin(a) * 3.6 * (k & 1 ? 1 : -1); line(ex, ey, ex + Math.cos(a) * (3 + (k % 3) * 2), ey - 2 - (k & 1), C('wood', 4)); }
      }
      if (g > 0) glow(x, y + 28, 24 + g * 20, tab('#40ffd0', true), 0.15 + g * 0.25);
      return [x, y];
    }
    // the dockhand on his crate with his pipe; drops it when the anchor comes out
    function dockhand(t, P) {
      crateArt(sx(DOCKX) - 11, DY - 2, 22, 15, 15);
      const r = onDock(DOCKHAND, Object.assign({ hip: -15, legs: [{ knee: [9, -16], foot: [11, 0] }, { knee: [7, -15], foot: [8, 0] }], arms: [{ hand: [9, -26] }, { hand: [4, -18] }], face: { eyes: blink(t, 25) ? 'closed' : 'half', mouth: mouth('docker', t) } }, P || {}), DOCKX, DY - 2, -1);
      const dropped = t > RIP + 0.1;
      if (!dropped) { line(r.head[0] - 4, r.head[1] + 6, r.head[0] - 9, r.head[1] + 8, C('linen', 6)); rectF(r.head[0] - 11, r.head[1] + 5, 3, 3, C('wood', 3)); put(r.head[0] - 10, r.head[1] + 5, C('fire', 6)); HB.pipeSmoke(r.head[0] - 10, r.head[1] + 4, t, 6); }
      else { const g = t - RIP - 0.1, [px, py, landed] = arc(r.head[0] - 9, r.head[1] + 7, -20, -60, 420, g, DY + 2); line(px - 3, py, px + 3, py + (landed ? 0 : Math.sin(g * 20) * 2), C('linen', 6)); rectF(px - 4, py - 2, 3, 3, C('wood', 3)); }
      return r;
    }
    // the wardens where they wait, menacing Kaira, and her watching
    function bystanders(t, o) {
      o = o || {};
      for (let k = 0; k < 3; k++) { const P = { legs: [{ foot: [7, 0] }, { foot: [-7, 0] }], arms: o.shield ? [{ a: 2.6, b: 0.6 }, { a: 2.2, b: 0.5 }] : [{ a: 1.2, b: 0.1 }, { a: -0.3 }], lean: o.shield ? -2 : 0, prop: o.shield ? undefined : (A) => spearArt(A.hand[0], A.hand[1], 1.05, 26, t) }; const r = onDock(WARDEN, P, WD2[k], WDY[k], 1); glow(r.head[0] + 3, r.head[1] - 1, 6, tab('#60e0ff', true), 0.4); }
      onDock(KAIRA, Object.assign(stand(KB, 5), { arms: o.shield ? [{ a: 2.5, b: 0.8 }, { a: 2.2, b: 0.6 }] : [{ a: 0.4, b: 0.6 }, { a: 0.2 }], face: { eyes: o.wow ? 'wide' : blink(t, 24) ? 'closed' : 'open', brows: 'up', mouth: o.wow ? 0.5 : 0 }, wind: o.wind || 0 }), 196, DY + 4, 1);
    }
    // Tamo holding the anchor (arms up): prop in sprite space; ang 0 = crown down, PI = crown up
    const heldAnchor = (ang, g, s, dx, dy) => (A, t) => { HB.toSprite(); anchorArt(A.hand[0] + 240 + (dx || 0), A.hand[1] + 135 + (dy || 0), ang, s || 1, g, t); TGT = FRAME; };
    HB.heldAnchor = heldAnchor;

    // 26a — he strides up to the anchor; the dockhand on his crates (3:17)
    shot(197.0, 198.4, (lt, t) => {
      stage(t, 200);
      const tx = lerp(TAX - 60, TAX, eoc(lin(197.0, 198.1, t))), walking = t < 198.0;
      dockhand(t);
      anchorInDeck(t, 0, 0);
      const P = walking ? walkP({ lean: 1, face: { eyes: 'narrow', brows: 'angry', smile: 0.5 } }, (tx - TAX) * 0.38, 6, TB) : Object.assign(stand(TB, 5), { arms: [{ a: 0.9, b: 1.2 }, { a: 0.8, b: 1.3 }], face: { eyes: 'open', brows: 'up', smile: 0.5, look: -1 }, headY: -1 });
      onDock(TAMO, P, tx, DY + 1, 1);
      harbourAfter(t);
      view(sx(AX + 12), 160, 2.5);
    });
    // 26a' — the dockhand, close: "Kid, that anchor hasn't moved in a hundred years"
    shot(198.4, 199.5, (lt, t) => {
      closeBg(() => { stage(t, 200); anchorInDeck(t, 0, 0); onDock(TAMO, Object.assign(stand(TB, 5), { arms: [{ a: 0.9, b: 1.2 }, { a: 0.8, b: 1.3 }] }), TAX, DY + 1, 1); }, sx(AX) - 6, 160, 3, 3);
      LIGHT.x = -0.7; LIGHT.y = -0.5; ENV.edge = C('fire', 6);
      const r = bust('docker', { t, puff: frac(t * 0.7) < 0.3 ? 1 : 0, face: { eyes: blink(t, 25) ? 'closed' : 'half', mouth: mouth('docker', t), brows: 'angry' }, headX: Math.round(Math.sin(t * 2)) }, 330, H - 22 + 6, 3, -1);
      ENV.edge = null;
      for (let k = 0; k < 8; k++) { const u = frac(t * 0.3 + k / 8), x = 268 - u * 30 + Math.sin(t + k) * 6, y = 140 - u * 110; const rr = 2 + u * 6; fillEll(x, y, rr, rr * 0.8, 0, (xx, yy) => (bay(xx, yy) < 0.6 * (1 - u) ? C('stone', 6) : -1)); }
    });

    // 26b — the grip (3:19): he spits on his hands, grips the shank and pulls; the planks groan and split; the sea is drawn
    // back out of the harbour in teal threads toward the iron; it lights up
    function strands(t, p, ax, ay) {
      if (p <= 0) return;
      for (let k = 0; k < 10; k++) {
        const s0 = [ih(k, 1, 481) * W, k < 5 ? 236 + ih(k, 2, 481) * 20 : DF - 6 - ih(k, 3, 481) * 20], head = clamp(p * 1.4 - ih(k, 4, 481) * 0.4, 0, 1);
        let px = s0[0], py = s0[1];
        for (let q = 1; q <= 24; q++) { const u = q / 24 * head, x = lerp(s0[0], ax, u) + Math.sin(u * 9 + t * 4 + k) * 14 * (1 - u), y = lerp(s0[1], ay, u) - Math.sin(u * PI) * 30 + Math.cos(u * 7 + t * 5) * 4 * (1 - u); line(px, py, x, y, q % 3 === 0 ? C('mint', 7) : C('teal', 5), q < 18 ? 2 : 1); px = x; py = y; }
        put(fl(px), fl(py), WHITE);
      }
    }
    shot(GRIP, RIP + 0.2, (lt, t) => {
      const wide = t > 201.4 && t < 202.4, g = glowOf(t), strain = lin(GRIP, RIP, t), p = pullOf(t), ripped = t >= RIP;
      const cx = wide ? 120 : 200;
      stage(t, cx);
      if (wide) { bystanders(t, { wow: true, wind: 2 }); }
      dockhand(t, { face: { eyes: t > 200.5 ? 'wide' : 'half', brows: 'up', mouth: t > RIP ? 0.8 : mouth('docker', t) } });
      cracks(sx(AX), DY + 3, ripped ? 1 : strain * strain);
      const lift = ripped ? eoc(lin(RIP, RIP + 0.2, t)) * 30 : (fl(t * 15) & 1) * strain * 2;
      const [ax, ay] = anchorInDeck(t, g, lift, ripped ? 0 : strain * 1.5);
      // Tamo: a crouch, hands on the shank, shaking with the effort; then the heave
      const shake = ripped ? 0 : Math.round((ih(fl(t * 30), 3, 9) - 0.5) * 2 * strain);
      const spit = t < GRIP + 0.5;
      const P = { hip: ripped ? -TB.leg + 2 : -TB.leg + 8 + shake * 0, lean: ripped ? -3 : 3, legs: [{ foot: [9, 0] }, { foot: [-9, 0] }],
        arms: spit ? [{ hand: [6, -44] }, { hand: [4, -43] }] : [{ hand: [21, ripped ? -62 : -32] }, { hand: [20, ripped ? -58 : -25] }],
        face: { eyes: spit ? 'happy' : strain > 0.5 || ripped ? 'closed' : 'narrow', brows: 'angry', mouth: spit ? 0.3 : ripped ? 0.9 : 0.6, smile: spit ? 0.6 : 0 } };
      const r = onDock(TAMO, P, TAX + shake * 0.5, DY + 1, 1);
      if (spit && t > GRIP + 0.25) for (let k = 0; k < 3; k++) put(r.handN[0] + k - 1, r.handN[1] - 2 - k, C('sky', 6));
      // sweat flying off him
      if (strain > 0.3 && !ripped) for (let k = 0; k < 5; k++) { const u = frac(t * 2 + k / 5); put(fl(r.head[0] + (k & 1 ? 6 : -6) * (1 + u * 2)), fl(r.head[1] - 8 + u * 12 - Math.sin(u * PI) * 6), C('sky', 7)); }
      // splinters springing out of the cracks
      if (strain > 0.4) for (let k = 0; k < 8; k++) { const ph = frac(t * 1.5 + ih(k, 1, 485)), x0 = sx(AX) + (ih(k, 2, 485) - 0.5) * 50; if (ph < 0.4) { const [px, py] = arc(x0, DY + 2, (ih(k, 3, 485) - 0.5) * 50, -90, 420, ph); line(px, py, px + 2, py - 1, C('wood', 5)); } }
      strands(t, p, ax, ay + 20);
      if (g > 0.4) glow(r.head[0], r.head[1] + 8, 20, tab('#40ffd0', true), (g - 0.4) * 0.3);
      if (ripped) { debris(sx(AX), DY, t - RIP, 30, 487, { big: true, speed: 1.5 }); dustRing(sx(AX), DY + 2, t - RIP, 1.4, 488); impactStar(sx(AX), DY - 20, t - RIP, 1.4, C('mint', 7)); }
      harbourAfter(t);
      if (ripped && t < RIP + 0.067) {} else if (wide) view(240, 150, 1.25);
      else { const u = lin(GRIP, 201.4, t); view(sx(AX) - 4 + (t > 202.4 ? 0 : u * 4), lerp(162, 156, u), t > 202.4 ? 3.0 : lerp(2.5, 2.9, u)); }
      shk(ripped ? 4 : strain * strain * 2.2 + (wide ? 1 : 0));
      if (ripped && t < RIP + 0.067) {
        BUF.fill(C('ink', 0)); const cx_ = 240, cy_ = 120;
        for (let k = 0; k < 60; k++) { const an = ih(k, 1, 992) * TAU, r0 = 40 + ih(k, 2, 992) * 60; line(cx_ + Math.cos(an) * r0, cy_ + Math.sin(an) * r0 * 0.7, cx_ + Math.cos(an) * 500, cy_ + Math.sin(an) * 350, C('mint', 6), ih(k, 3, 992) < 0.3 ? 2 : 1); }
        HB.IMPC = WHITE; onDock(TAMO, P, TAX, DY + 1, 1); lyBegin(); anchorArt(sx(AX), DY - 80, 0, 1.05, 1, t); lyEnd({ color: WHITE, outline: false }); HB.IMPC = undefined;
        view(sx(AX) - 4, 150, 2.6);
      }
    });

    // 26c — the hero shot (3:23): low on the planks, the anchor held high and blazing teal, the sea coming back over the dock
    shot(RIP + 0.2, 205.4, (lt, t) => {
      stage(t, 110);
      bystanders(t, { shield: t > 204.2, wow: true, wind: 2 + surgeOf(t) * 2 });
      dockhand(t, { face: { eyes: 'wide', brows: 'up', mouth: 0.8 } });
      const swing = eoc(lin(RIP + 0.2, RIP + 0.55, t));
      const P = { hip: -TB.leg + (swing < 1 ? 3 : 0), lean: 0, legs: [{ foot: [8, 0] }, { foot: [-9, 0] }], arms: [{ hand: [3, -74] }, { hand: [-2, -72] }], face: { eyes: t > 204.3 ? 'narrow' : 'closed', brows: 'angry', mouth: 0, smile: 0.6 }, wind: 1 + surgeOf(t) * 3, prop: heldAnchor(lerp(0.5, PI + 0.2, swing), 1, 1.0, 0, 4) };
      const r = onDock(TAMO, P, TAX, DY + 1, 1);
      LIGHT.x = 0.7;
      glow(r.handN[0], r.handN[1] - 24, 60, tab('#40ffd0', true), 0.5 + Math.sin(t * 14) * 0.05);
      // rings of teal light pulsing out of the iron
      for (let q = 0; q < 3; q++) { const u = frac(t * 1.2 + q / 3), rr = 6 + u * 70; for (let a = 0; a < TAU; a += 0.5 / rr) { const xx = fl(r.handN[0] + Math.cos(a) * rr), yy = fl(r.handN[1] - 24 + Math.sin(a) * rr * 0.7); if (bay(xx, yy) < (1 - u) * 0.8) put(xx, yy, C('mint', 7)); } }
      breakSpray(t);
      HB.harbourAfter(t);
      view(sx(TAX) + 10, 168, 2.1 + lt * 0.06);
      shk(surgeOf(t) * 2.5);
    });

    // 26d — Tamo, close (3:25): the anchor on his shoulder, salt rain falling — "That's not very fair… for you."
    shot(205.4, 208.0, (lt, t) => {
      closeBg(() => { stage(t, 110); bystanders(t, {}); }, sx(TAX) - 120, 150, 3, 3);
      LIGHT.x = 0.6; LIGHT.y = 0.5; ENV.edge = C('mint', 7);
      const tk = talking('tamo', t);
      bust('tamo', { t, anchor: 0.8, glow: 1, face: { eyes: blink(t, 23) ? 'closed' : t > 207.0 ? 'narrow' : 'open', brows: t > 207.0 ? 'angry' : 'n', mouth: mouth('tamo', t), smile: t > 206.8 ? 0.8 : 0.4 }, headY: tk ? -Math.round(Math.abs(Math.sin(t * 8))) : 0 }, 200, H - 22 + 6, 3, -1);
      ENV.edge = null;
      glow(200, 270, 160, tab('#40ffd0', true), 0.3);
      // the salt rain from the wave, big near drops
      for (let k = 0; k < 40; k++) { const sp_ = 200 + ih(k, 1, 491) * 120, x = ih(k, 2, 491) * W, y = ((t * sp_ + ih(k, 3, 491) * 400) % (H + 40)) - 20; for (let j = 0; j < 8; j++) put(fl(x), fl(y - j), j < 2 ? WHITE : C('sky', 5)); }
    });

    // 26e — the wardens look at each other (3:28)
    shot(208.0, 209.5, (lt, t) => {
      stage(t, 0);
      for (let k = 0; k < 3; k++) {
        const look = t > 208.25 + k * 0.12 && t < 209.0 ? (k === 1 ? (fl((t - 208.25) * 4) & 1 ? -1 : 1) : k === 0 ? 1 : -1) : 1, nod = t > 209.05 ? Math.round(Math.sin((t - 209.05) * 14)) : 0;
        const r = onDock(WARDEN, { headY: nod, legs: [{ foot: [7, 0] }, { foot: [-7, 0] }], arms: [{ a: 1.2, b: 0.1 }, { a: -0.3 }], prop: (A) => spearArt(A.hand[0], A.hand[1], 1.05, 26, t) }, WD2[k], WDY[k], look);
        glow(r.head[0] + 3 * look, r.head[1] - 1, 6, tab('#60e0ff', true), 0.45);
        if (k === 1 && t > 208.5) { const u = frac((t - 208.5) * 0.8); put(r.head[0] - 6, fl(r.head[1] - 8 + u * 10), C('sky', 7)); put(r.head[0] - 6, fl(r.head[1] - 7 + u * 10), C('sky', 5)); }
      }
      HB.harbourAfter(t);
      view(sx(WD2[1]) + 4, 156, 3.0);
    });

    // 26f — they come anyway (3:29): spears levelled, a charge; he drags the anchor out to meet them, sparks off the planks
    shot(209.5, 214.0, (lt, t) => {
      const cam = eio(lin(209.5, 213.5, t));
      stage(t, lerp(60, 150, cam));
      const TX = 300, tx = lerp(TAX, TX, eio(lin(210.0, 212.6, t))), dragging = t > 210.0 && t < 212.6;
      // Tamo turns, drags it: the crown scraping behind him
      const P = dragging ? walkP({ lean: -1, face: { eyes: 'narrow', brows: 'angry', smile: 0.6 }, arms: [{ hand: [-6, -30] }, { a: 0.3 }] }, (tx - TAX) * 0.4, 5, TB) : Object.assign(stand(TB, 7), { arms: [{ hand: [-6, -30] }, { a: 0.3 }], face: { eyes: 'narrow', brows: 'angry', smile: 0.6 } });
      P.prop = heldAnchor(-1.0, 1, 1.0, 0, 3);
      const r = onDock(TAMO, P, tx, DY + 1, -1);
      if (dragging) { const cx_ = sx(tx) + 44; for (let k = 0; k < 6; k++) { const u = frac(t * 3 + k / 6), [px, py] = arc(cx_, DY, 30 + ih(k, 1, 495) * 40, -40 - ih(k, 2, 495) * 50, 300, u * 0.4); put(fl(px), fl(py), u < 0.5 ? WHITE : C('mint', 6)); } for (let x = sx(TAX) + 44; x < cx_; x++) if (ih(x, 1, 496) < 0.6) put(x, DY + 1, C('hush', 6)); }
      glow(r.handN[0] - 20, r.handN[1] + 10, 30, tab('#40ffd0', true), 0.35);
      // the wardens: a nod, spears levelled, then they spread out and come at a run
      const go = lin(211.6, 214.0, t);
      for (let k = 0; k < 3; k++) {
        const x = WD2[k] + 30 + go * (k === 0 ? 100 : k === 1 ? 70 : 50), running = go > 0;
        const W_ = running ? HB.runP({ arms: [{ a: 1.35, b: 0.1 }, { a: -0.6 }] }, t * 14 + k, 6, WB) : { legs: [{ foot: [7, 0] }, { foot: [-7, 0] }], arms: [{ a: 1.35, b: 0.1 }, { a: -0.3 }] };
        W_.prop = (A) => spearArt(A.hand[0], A.hand[1], 1.4, 26, t);
        const rw = onDock(WARDEN, W_, x, WDY[k], 1);
        glow(rw.head[0] + 3, rw.head[1] - 1, 6, tab('#60e0ff', true), 0.45);
        if (running && fl(t * 7 + k) % 2 === 0) dustRing(sx(x) - 6, WDY[k], frac(t * 3.5 + k) * 0.4, 0.2, 497 + k);
      }
      // Kaira behind them: draws her blades
      const draw_ = sstep(211.0, 211.3, t);
      onDock(KAIRA, Object.assign(stand(KB, 6), { arms: [{ a: lerp(0.3, 1.2, draw_), b: 0.2 }, { a: lerp(0.2, -0.5, draw_), b: 0.4 }], face: { eyes: 'narrow', brows: 'angry', smile: 0.4 }, wind: 1, prop: draw_ > 0.3 ? (A) => swordArt(A.hand[0], A.hand[1], 0.9, 18, false) : undefined, propFar: draw_ > 0.3 ? (A) => swordArt(A.hand[0], A.hand[1], -0.6, 16, false) : undefined }), 150, DY + 6, 1);
      if (draw_ > 0.3 && draw_ < 1) { const kx = sx(150) + 10; for (let k = 0; k < 4; k++) put(kx + k * 3, DY - 40 - k, WHITE); }
      HB.harbourAfter(t);
      view(lerp(sx(236), sx(262), cam), 162, 1.8);
    });
  }
  /* ================================================================ 27: the fight (3:34–3:41) — an uppercut into the sea, a chain yanked
  // into the barrels, a kick out of a lightning step. Each hit holds the action's clock for a beat (hit-stop) on an impact frame. */
  {
    const { onDock, walkP, runP, stand, arc, debris, dustRing, impactStar, splash, shadowE, actorEx, harbour, harbourAfter, sx, bolt, heldAnchor, barrelArt, crateArt } = HB;
    const K = HB.consts, DY = K.DY, DF = K.DF, BRLX = K.BRLX;
    const TB = TAMO.body, KB = KAIRA.body, WB = WARDEN.body;
    const H1 = 214.8, H2 = 217.2, H3 = 219.6, HOLD = 0.12, HITS = [[H1, HOLD], [H2, HOLD], [H3, HOLD]];
    const clk = (t) => HB.holdClock(t, HITS), A = (e) => clk(e);
    const TX = 300, W1Y = DY - 4, W3Y = DY - 2, W2Y = DY + 2;
    const CRASH = A(H2) + 0.45, W2SPLASH = A(H3) + 0.62;
    // a clean impact frame: a flat field, focus lines, the figures as one-colour silhouettes
    function impactClean(bg, fg, lines_, cx, cy, figs) {
      BUF.fill(bg);
      for (let k = 0; k < 70; k++) { const an = ih(k, 1, 993) * TAU, r0 = 26 + ih(k, 2, 993) * 50; line(cx + Math.cos(an) * r0, cy + Math.sin(an) * r0 * 0.7, cx + Math.cos(an) * 520, cy + Math.sin(an) * 360, lines_, ih(k, 3, 993) < 0.3 ? 2 : 1); }
      HB.IMPC = fg; figs(); HB.IMPC = undefined;
    }
    // the chain: links along a sagging curve
    function chain(x0, y0, x1, y1, sag, t) { const n = Math.max(4, fl(Math.hypot(x1 - x0, y1 - y0) / 3)); for (let i = 0; i <= n; i++) { const u = i / n, x = fl(lerp(x0, x1, u)), y = fl(lerp(y0, y1, u) + Math.sin(u * PI) * sag); if (i & 1) { rectF(x - 1, y - 1, 4, 3, C('ink', 0)); put(x, y, C('snow', 7)); put(x + 1, y, C('steel', 4)); } else { rectF(x - 1, y - 2, 3, 5, C('ink', 0)); put(x, y - 1, C('snow', 7)); put(x, y, C('steel', 5)); put(x, y + 1, C('steel', 3)); } } }
    // Tamo's anchor angle and hands through the fight (in his facing space)
    function tamoPose(T, t) {
      const f = T < A(H2) - 0.5 || T > A(H3) + 0.18 ? -1 : 1;
      let ang = 1.9, hand = [10, -40], hand2 = [7, -38], hip = -TB.leg, lean = 0, face = { eyes: 'narrow', brows: 'angry', smile: 0.5 }, legs = [{ foot: [8, 0] }, { foot: [-8, 0] }];
      if (T < A(H2) - 0.5) {
        const wind = sstep(214.3, 214.72, T), sw = lin(214.72, 214.84, T);
        if (sw <= 0) { ang = lerp(-1.0, -0.5, wind); hand = [lerp(-6, -10, wind), -30]; hand2 = [lerp(-8, -12, wind), -31]; hip = -TB.leg + wind * 5; lean = -wind * 3; face = { eyes: 'narrow', brows: 'angry', smile: wind > 0.5 ? 0.8 : 0.4 }; legs = [{ foot: [10, 0] }, { foot: [-10, 0] }]; }
        else { const e = eoc(sw); ang = lerp(-0.5, 2.7, e); hand = [lerp(-10, 6, e), lerp(-30, -66, e)]; hand2 = [hand[0] - 3, hand[1] + 2]; hip = -TB.leg + lerp(5, -2, e); lean = lerp(-3, 4, e); face = { eyes: 'closed', brows: 'angry', mouth: 0.9 }; legs = [{ foot: [12, -e * 3] }, { foot: [-10, 0] }];
          const settle = lin(214.95, 215.6, T); if (settle > 0) { ang = lerp(2.7, 1.9, eio(settle)); hand = [lerp(6, 10, settle), lerp(-66, -40, eio(settle))]; hand2 = [hand[0] - 3, hand[1] + 2]; hip = -TB.leg; lean = lerp(4, 0, settle); face = { eyes: 'narrow', brows: 'angry', smile: 0.7 }; legs = [{ foot: [8, 0] }, { foot: [-8, 0] }]; } }
      } else {
        // the chain: he leans in, then heaves it back over his shoulder; then turns to watch
        const lean_ = sstep(A(H2) - 0.35, A(H2) - 0.05, T), yank = lin(A(H2) - 0.05, A(H2) + 0.12, T);
        if (T < A(H2) - 0.05) { ang = 1.9 + lean_ * 0.2; hand = [10 + lean_ * 4, -40]; hand2 = [8 + lean_ * 4, -38]; lean = lean_ * 3; hip = -TB.leg + lean_ * 3; face = { eyes: 'narrow', brows: 'angry', smile: 0.8, look: 0 }; }
        else if (yank < 1 || T < A(H2) + 0.6) { const e = eoc(Math.min(1, yank)); ang = lerp(2.1, -2.2, e); hand = [lerp(14, -6, e), lerp(-40, -60, e)]; hand2 = [hand[0] - 2, hand[1] + 2]; lean = lerp(3, -4, e); face = { eyes: 'closed', brows: 'angry', mouth: 0.8 }; legs = [{ foot: [10, 0] }, { foot: [-12, 0] }]; }
        else { const r_ = lin(A(H2) + 0.6, A(H2) + 1.0, T); ang = lerp(-2.2, 1.9, eio(r_)); hand = [lerp(-6, 10, r_), lerp(-60, -40, r_)]; hand2 = [hand[0] - 3, hand[1] + 2]; face = { eyes: T > A(H3) + 0.1 ? 'wide' : 'narrow', brows: T > A(H3) + 0.1 ? 'up' : 'angry', smile: T > A(H3) + 0.6 ? 0.8 : 0.4, look: T > A(H3) + 0.05 ? -1 : 0 }; }
      }
      return { f, P: { hip, lean, legs, arms: [{ hand }, { hand: hand2 }], face, wind: 1, prop: heldAnchor(ang, 1, 1.0, 0, 3) }, ang };
    }
    function fightStage(t, T, cx, o) {
      harbour(t, Object.assign({ cx, props: { noBarrels: T > CRASH } }, o || {}));
      if (T > CRASH) { const x = sx(BRLX); crateArt(x + 19, DF + 9, 20, 17, 12); barrelArt(x + 12, DF + 16, 8, 14, 10); for (let k = 0; k < 7; k++) { const px = x - 18 + k * 6, py = DF + 14 + (k & 1) * 3; line(px, py, px + 5, py - 2 + (k % 3), C('wood', 3), 2); } }
    }
    // the three wardens through the fight
    function w1(t, T) {
      const hitT = A(H1);
      if (T < hitT) { const x = lerp(232, 272, lin(214.0, 214.72, T)); const P = runP({ arms: [{ a: 1.45 + lin(214.5, 214.72, T) * 0.2, b: 0 }, { a: -0.7 }] }, T * 15, 6, WB); P.prop = (Aa) => spearArt(Aa.hand[0], Aa.hand[1], 1.45, 26, t); return onDock(WARDEN, P, x, W1Y, 1); }
      const g = T - hitT, [x, y] = arc(sx(272), W1Y - 30, -160, -255, 600, g);
      if (g > 0.8) return null;
      return HB.actorEx(WARDEN, { t, legs: [{ foot: [5, -4] }, { foot: [-6, 2] }], arms: [{ a: 2.6, b: 0.4 }, { a: -2.2, b: 0.3 }] }, x, y, 1, { rot: -g * 13, px: 0, py: -30 });
    }
    function w3(t, T) {
      const throwT = 216.0, wrapT = 216.25, yankT = A(H2) - 0.05;
      if (T < yankT + 0.02) {
        const pulling = T > wrapT, x = (T < 215.7 ? 186 : 206) - (pulling ? lin(wrapT, yankT, T) * 4 : 0);
        const whirl = T < throwT, thr = lin(throwT, wrapT, T);
        const P = { hip: -WB.leg + (pulling ? 4 : 0), lean: pulling ? -3 : 0, legs: [{ foot: [9, 0] }, { foot: [-9, 0] }], arms: whirl ? [{ a: PI - 0.2, b: 0.2 }, { a: -0.3 }] : [{ a: lerp(2.6, 1.5, thr), b: 0.1 }, { a: 1.3, b: 0.3 }] };
        const r = onDock(WARDEN, P, x, W3Y, 1);
        return { r, x };
      }
      const g = T - yankT;
      if (T < CRASH) { const u = (T - yankT) / (CRASH - yankT), x = lerp(sx(202), sx(BRLX - 4), u), y = lerp(W3Y - 30, DF + 2, u) - Math.sin(u * PI) * 120; return { r: HB.actorEx(WARDEN, { t, legs: [{ foot: [6, -3] }, { foot: [-6, 1] }], arms: [{ a: 1.4, b: 0.2 }, { a: 2.8, b: 0.2 }] }, x, y, 1, { rot: lerp(0, -PI * 1.6, u), px: 0, py: -30 }) }; }
      // in the wreck of the barrels, legs in the air, twitching
      const tw = Math.sin(T * 12) * Math.max(0, 1 - (T - CRASH) * 0.6);
      const r_ = HB.actorEx(WARDEN, { t, legs: [{ foot: [5 + tw * 2, -2] }, { foot: [-5, 0] }], arms: [{ a: 0.3 }, { a: 0.3 }] }, sx(BRLX) + 2, DF - 16, 1, { rot: PI - 0.15, px: 0, py: -30 });
      barrelArt(sx(BRLX) - 2, DF + 14, 9, 13, 21); for (let k = 0; k < 5; k++) line(sx(BRLX) - 12 + k * 5, DF + 2 + (k & 1) * 2, sx(BRLX) - 9 + k * 5, DF - 4 + (k % 3), C('wood', 4), 2);
      return { r: r_ };
    }
    function w2(t, T) {
      const hitT = A(H3);
      if (T < hitT) { const sneak = lin(hitT - 1.5, hitT - 0.6, T), x = lerp(150, 266, sneak), back = sstep(hitT - 0.6, hitT - 0.3, T), thrust = lin(hitT - 0.12, hitT, T);
        if (sneak <= 0) return null;
        const P = sneak < 1 ? walkP({ hip: -WB.leg + 5, lean: 3, arms: [{ a: 1.2, b: 0.2 }, { a: -0.3 }] }, T * 11, 5, WB) : { hip: -WB.leg + 5, lean: 3, legs: [{ foot: [10, 0] }, { foot: [-9, 0] }], arms: [{ a: 1.45, b: 0, }, { a: -0.5 }] };
        const sx_ = -back * 8 + eoc(thrust) * 16;
        P.prop = (Aa) => spearArt(Aa.hand[0] + sx_, Aa.hand[1], 1.5, 26, t);
        return onDock(WARDEN, P, x, W2Y, 1); }
      const g = T - hitT; if (T > W2SPLASH) return null;
      const [x, y] = arc(sx(276), W2Y - 26, -150, -80, 700, g);
      return HB.actorEx(WARDEN, { t, legs: [{ foot: [7, -4] }, { foot: [-5, 1] }], arms: [{ a: -2.4, b: 0.3 }, { a: 2.6, b: 0.3 }] }, x, y, 1, { rot: g * 9, px: 0, py: -30 });
    }
    // Kaira: watching, then the lightning step and the kick, and she lands crackling
    function kaira(t, T) {
      const hitT = A(H3), go = hitT - 0.26, arrive = hitT - 0.12;
      const blades = (A_) => swordArt(A_.hand[0], A_.hand[1], 0.9, 18, false), blades2 = (A_) => swordArt(A_.hand[0], A_.hand[1], -0.6, 16, false);
      if (T < go) { const P = Object.assign(stand(KB, 6), { arms: [{ a: 1.2, b: 0.2 }, { a: -0.5, b: 0.4 }], face: { eyes: T > go - 0.5 ? 'narrow' : 'open', brows: 'angry', smile: 0.3, look: 1 }, wind: 1, prop: blades, propFar: blades2, hip: -KB.leg + sstep(go - 0.3, go - 0.05, T) * 7 }); onDock(KAIRA, P, 160, DY + 6, 1); return [160, DY + 6]; }
      if (T < arrive) {
        const u = lin(go, arrive, T), x0 = sx(160), x1 = sx(296);
        bolt(x0, DY - 20, lerp(x0, x1, u), DY - 24, fl(t * 30), 1, WHITE, C('gold', 5));
        for (let k = 0; k < 3; k++) { const q = Math.max(0, u - (2 - k) * 0.22); onDock(KAIRA, runP({ face: {} }, k * 1.3 + 0.6, 9, KB), lerp(160, 296, q), DY + 6 - k, 1, { color: C('gold', 3 + k * 2), noShadow: true }); }
        return [lerp(160, 296, u), DY];
      }
      // the turn, the kick, the follow-through and a crackling landing
      const wind = lin(arrive, hitT, T), kick = T >= hitT && T < hitT + 0.3, land = lin(hitT + 0.3, hitT + 0.5, T);
      let P;
      if (T < hitT) P = { hip: -KB.leg + 4, lean: -2, legs: [{ foot: [4, 0] }, { foot: [-8 + wind * 4, -wind * 6] }], arms: [{ a: 2.2, b: 0.3 }, { a: -1.2, b: 0.4 }], face: { eyes: 'narrow', brows: 'angry' }, wind: 3 };
      else if (kick) P = { hip: -KB.leg + 1, lean: -6, legs: [{ foot: [24, -32], knee: [12, -30] }, { foot: [-3, 0] }], arms: [{ a: -1.6, b: 0.4 }, { a: 2.0, b: 0.4 }], face: { eyes: 'narrow', brows: 'angry', mouth: 0.5 }, wind: 4 };
      else P = Object.assign(stand(KB, 8), { hip: -KB.leg + (land < 1 ? 6 * (1 - land) : 3), arms: [{ a: 1.3, b: 0.2 }, { a: -0.6, b: 0.4 }], face: { eyes: 'narrow', brows: 'angry', smile: 0.6 }, wind: 1 });
      P.prop = blades; P.propFar = blades2;
      onDock(KAIRA, P, 296, DY + 4, -1);
      // crackles of gold round her
      const cr = Math.max(0, 1 - (T - arrive) * 0.5);
      for (let k = 0; k < 3; k++) if (ih(k, fl(t * 20), 7) < cr) { const a = ih(k, fl(t * 20), 8) * TAU; bolt(sx(296), DY - 30, sx(296) + Math.cos(a) * 20, DY - 30 + Math.sin(a) * 26, fl(t * 30) + k, 1, WHITE, C('gold', 5)); }
      glow(sx(296), DY - 30, 30, tab('#ffd060', true), 0.3 * cr + 0.1);
      return [296, DY + 4];
    }

    shot(214.0, 221.0, (lt, t) => {
      const T = clk(t), inHold = HITS.find(([h, d]) => t >= h && t < h + d), imp = HITS.find(([h]) => t >= h && t < h + 0.067);
      // the camera: three set-ups
      let cx = 150, vx, vy, Z; HB.setCX(cx);
      if (t < 215.7) { const fol = sstep(214.95, 215.4, T); vx = lerp(sx(282), sx(252), fol); vy = lerp(162, 140, fol); Z = lerp(2.6, 2.1, fol); }
      else if (t < 218.4) { const pan = eio(lin(A(H2) + 0.08, CRASH + 0.15, T)); vx = lerp(sx(256), sx(BRLX - 24), pan); vy = 160 - Math.sin(pan * PI) * 20; Z = lerp(2.2, 2.0, Math.sin(pan * PI)); }
      else { const punch = sstep(A(H3) - 0.14, A(H3) - 0.02, T) * (1 - sstep(A(H3) + 0.4, A(H3) + 0.9, T)); vx = lerp(sx(232), sx(284), punch); vy = lerp(162, 160, punch); Z = lerp(2.0, 2.8, punch); }
      if (imp) {
        const k = HITS.indexOf(imp);
        impactClean(k === 2 ? C('ink', 0) : WHITE, k === 2 ? C('gold', 7) : C('ink', 0), k === 2 ? C('gold', 5) : C('ink', 0), 240, 130, () => { harbour(t, { cx }); BUF.fill(k === 2 ? C('ink', 0) : WHITE); impactClean(k === 2 ? C('ink', 0) : WHITE, k === 2 ? C('gold', 7) : C('ink', 0), k === 2 ? C('gold', 5) : C('ink', 0), (vx - 240) / Z + 240, 130, () => {});
          HB.IMPC = k === 2 ? C('gold', 7) : C('ink', 0);
          const tp = tamoPose(T, t); onDock(TAMO, tp.P, TX, DY + 1, tp.f);
          if (k === 0) w1(t, T); if (k === 1) w3(t, T); if (k === 2) { w2(t, T); kaira(t, T); } });
        view(vx, vy, Z); shk(4); return;
      }
      fightStage(t, T, cx);
      // the far splash where the first one went in
      splash(sx(272) - 128, 152, T - (A(H1) + 0.8), 0.8, 501);
      // W1, W3 (whirling the chain), Tamo, W2, Kaira
      const r1 = w1(t, T);
      const r3 = w3(t, T);
      const tp = tamoPose(T, t), rT = onDock(TAMO, tp.P, TX, DY + 1, tp.f);
      // the anchor's light, and a smear where it swung
      const crown = [rT.handN[0] + Math.sin(tp.ang) * 52 * tp.f, rT.handN[1] + Math.cos(tp.ang) * 52];
      glow(crown[0], crown[1], 24, tab('#40ffd0', true), 0.35);
      if ((T > 214.74 && T < 214.92) || (T > A(H2) - 0.03 && T < A(H2) + 0.18)) {
        const up = T < 216; const a0 = up ? -0.5 : 2.1, a1 = up ? lerp(-0.5, 2.7, eoc(lin(214.72, 214.84, T))) : lerp(2.1, -2.2, eoc(lin(A(H2) - 0.05, A(H2) + 0.12, T)));
        for (let q = 0; q <= 24; q++) { const a = lerp(a0, a1, q / 24), rr = 50; for (let w = -4; w <= 4; w++) { const xx = fl(rT.handN[0] + Math.sin(a) * (rr + w) * tp.f), yy = fl(rT.handN[1] + Math.cos(a) * (rr + w)); if (bay(xx, yy) < q / 24) put(xx, yy, Math.abs(w) < 2 ? WHITE : C('mint', 6)); } }
      }
      // the chain: whirling over his head, flying, wrapped round the shank, taut
      if (r3 && r3.x !== undefined && t > 215.7) {
        const hx = r3.r.handN[0], hy = r3.r.handN[1];
        if (T < 216.0) { const a = T * 16; chain(hx, hy, hx + Math.cos(a) * 16, hy - 10 + Math.sin(a) * 5, 2, t); }
        else { const u = eoc(lin(216.0, 216.25, T)), sx2 = rT.handN[0] - 14, sy2 = rT.handN[1] - 4; chain(hx, hy, lerp(hx, sx2, u), lerp(hy, sy2, u), T > 216.25 ? (T > 216.5 ? 0 : 3) : 6, t); if (T > 216.25) for (let q = 0; q < 3; q++) { chain(sx2 - 3, sy2 - 3 + q * 3, sx2 + 3, sy2 - 1 + q * 3, 0, t); } }
      } else if (T < CRASH && T > A(H2)) { const hx = r3.r.handN[0], hy = r3.r.handN[1]; chain(hx, hy, rT.handN[0], rT.handN[1] - 4, 4, t); }
      const r2 = w2(t, T);
      if (T > A(H3) && T < W2SPLASH) { /* speed lines behind him */ for (let k = 0; k < 6; k++) { const y = DY - 50 + k * 8; line(sx(276) + 10, y, sx(276) + 60, y, C('snow', 7)); } }
      splash(sx(276) - 150 * (W2SPLASH - A(H3)), 232, T - W2SPLASH, 1.0, 503);
      kaira(t, T);
      // the hits
      impactStar(sx(266), DY - 40, T - A(H1), 1.6, C('mint', 7));
      if (T > CRASH) { debris(sx(BRLX), DF + 6, T - CRASH, 24, 505, { big: true, speed: 1.1, floor: DF + 14 }); dustRing(sx(BRLX), DF + 12, T - CRASH, 1.2, 506); impactStar(sx(BRLX), DF - 4, T - CRASH, 1.4, C('fire', 6)); }
      impactStar(sx(282), DY - 34, T - A(H3), 1.8, C('gold', 6));
      harbourAfter(t);
      view(vx, vy, Z);
      if (inHold) shk(4);
      else shk(T > CRASH && T < CRASH + 0.3 ? 3 : T > W2SPLASH && T < W2SPLASH + 0.2 ? 1.5 : 0);
    });
  }
  /* ================================================================ 28–29: the breather, then the world goes quiet (3:41–4:06) */
  {
    const { onDock, stand, arc, dustRing, impactStar, splash, shadowE, harbour, harbourAfter, sx, heldAnchor, barrelArt, crateArt, bolt } = HB;
    const K = HB.consts, DY = K.DY, DF = K.DF, BRLX = K.BRLX, HUSH_T = K.HUSH_T;
    const TB = TAMO.body, KB = KAIRA.body, WB = WARDEN.body;
    const KX = 268, TXX = 312;
    // how drained the world is: a chill from the moment it stops, deepening
    const chillOf = (t) => (t < HUSH_T ? 0 : 0.12 + 0.18 * lin(HUSH_T, 236, t));
    HB.chillOf = chillOf;
    const T_CHILL = tab('#dfe3f2');
    // the warden who went into the water: head and an arm out, thrashing (frozen with the world)
    function swimmer(t, wx, wl) {
      const rt = Math.min(t, HUSH_T), x = sx(wx), fl_ = Math.sin(rt * 9);
      onDock(WARDEN, { hip: -WB.leg, arms: [{ a: 2.6 + fl_ * 0.4, b: 0.3 }, { a: 2.2 - fl_ * 0.4, b: 0.4 }], legs: [{ foot: [4, 0] }, { foot: [-4, 0] }] }, wx, wl + 44 + Math.round(Math.sin(rt * 3) * 1.5), 1, { noShadow: true });
      for (let y = wl + 3; y < H; y++) for (let xx = x - 16; xx <= x + 16; xx++) if (xx >= 0 && xx < W) BUF[y * W + xx] = cel(R.sea, 2.6 + (vn(xx * 0.4 + rt * 3, y * 1.3, 1, 611) > 0.65 ? 1.5 : 0), xx, y);
      for (let k = 0; k < 18; k++) { const ph = frac(rt * 1.6 + ih(k, 1, 612)), a = -PI / 2 + (ih(k, 2, 612) - 0.5) * 2.4, v = 40 + ih(k, 3, 612) * 50; const [px, py] = arc(x + (ih(k, 4, 612) - 0.5) * 16, wl + 2, Math.cos(a) * v, Math.sin(a) * v, 300, ph * 0.5); if (py < wl + 3) { put(fl(px), fl(py), WHITE); if (t > HUSH_T) put(fl(px), fl(py) + 1, C('sky', 6)); } }
      for (let xx = x - 15; xx <= x + 15; xx++) if (ih(xx, fl(rt * 8), 613) < 0.6) put(xx, wl + 3, WHITE);
    }
    // the dock after the fight: W3's boots out of the barrels, the anchor on the planks
    function aftermath(t, cx, o) {
      const wl = harbour(t, Object.assign({ cx, props: { noBarrels: true } }, o || {}));
      const x = sx(BRLX); crateArt(x + 19, DF + 9, 20, 17, 12); barrelArt(x + 12, DF + 16, 8, 14, 10); for (let k = 0; k < 7; k++) { const px = x - 18 + k * 6, py = DF + 14 + (k & 1) * 3; line(px, py, px + 5, py - 2 + (k % 3), C('wood', 3), 2); }
      const rt = Math.min(t, HUSH_T), tw = Math.sin(rt * 5) * (rt < HUSH_T ? 1 : 0);
      HB.actorEx(WARDEN, { t, legs: [{ foot: [5 + tw, -2] }, { foot: [-5, 0] }], arms: [{ a: 0.3 }, { a: 0.3 }] }, x + 2, DF - 16, 1, { rot: PI - 0.15, px: 0, py: -30 });
      barrelArt(x - 2, DF + 14, 9, 13, 21);
      swimmer(t, 172, wl);
      return wl;
    }
    HB.aftermath = aftermath;
    function heroes(t, o) {
      o = o || {};
      const kP = Object.assign(stand(KB, 5), o.k || {}); kP.prop = (A) => swordArt(A.hand[0], A.hand[1], 0.5, 18, false); kP.propFar = (A) => swordArt(A.hand[0], A.hand[1], -0.4, 16, false);
      const rK = onDock(KAIRA, kP, o.kx || KX, DY + 3, o.kf || 1);
      const tP = Object.assign(stand(TB, 6), o.t || {}); if (!o.noAnchor && !tP.prop) tP.prop = heldAnchor(-1.0, o.glow === undefined ? 0.5 : o.glow, 1.0, 0, 3);
      const rT = onDock(TAMO, tP, o.tx || TXX, DY + 1, o.tf || -1);
      return { rK, rT };
    }
    HB.heroes = heroes;

    // 28a — Kaira, close (3:41): "Okay. Who ARE you?" — breathing hard, the last of the sparks going out of her
    shot(221.0, 222.8, (lt, t) => {
      closeBg(() => { aftermath(t, 150); heroes(t, { k: {}, t: {} }); }, sx(TXX) - 30, 160, 3, 3);
      LIGHT.x = -0.7; LIGHT.y = -0.5; ENV.edge = C('fire', 6);
      const pant = Math.round(Math.abs(Math.sin(t * 7))) ;
      const r = bust('kaira', { t, wind: 1, face: { eyes: blink(t, 22) ? 'closed' : lt < 0.4 ? 'narrow' : 'open', brows: t > 221.6 ? 'up' : 'n', mouth: mouth('kaira', t), smile: t > 222.0 ? 0.3 : 0 }, headY: -pant }, 280, H - 22 + 6, 3, -1);
      ENV.edge = null;
      const cr = Math.max(0, 1 - lt * 0.7); for (let k = 0; k < 3; k++) if (ih(k, fl(t * 20), 9) < cr * 0.6) { const a = ih(k, fl(t * 20), 8) * TAU, x0 = 240 + Math.cos(a) * 80, y0 = 170 + Math.sin(a) * 60; bolt(x0, y0, x0 + Math.cos(a) * 30, y0 + Math.sin(a) * 30, fl(t * 30) + k, 1, WHITE, C('gold', 5)); }
    });
    // 28b — Tamo, close (3:43): "Tamo! I work here. Well…" — the glow going out of the iron on his shoulder
    shot(222.8, 225.3, (lt, t) => {
      closeBg(() => { aftermath(t, 150); heroes(t, {}); }, sx(KX) - 10, 160, 3, 3);
      LIGHT.x = 0.7; LIGHT.y = -0.5; ENV.edge = C('fire', 6);
      const tk = talking('tamo', t), bounce = t < 223.6 ? -Math.round(Math.abs(Math.sin(t * 9)) * 2) : 0;
      bust('tamo', { t, anchor: Math.max(0, 0.6 - lt * 0.3), face: { eyes: blink(t, 21) ? 'closed' : t < 223.5 ? 'happy' : 'open', brows: t > 224.3 ? 'worried' : 'up', mouth: mouth('tamo', t), smile: t < 224.3 ? 0.9 : 0.3, look: t > 224.5 ? 1 : 0 }, headY: bounce }, 200, H - 22 + 6, 3, 1);
      ENV.edge = null;
    });
    // 28c — the two of them (3:45): "…I did, until you landed on me." She laughs; he grins and rubs his neck
    shot(225.3, 228.0, (lt, t) => {
      aftermath(t, 150);
      const laugh = t > 226.0, hb = laugh ? Math.round(Math.abs(Math.sin(t * 11))) : 0;
      heroes(t, { k: { hip: -KB.leg + hb, lean: laugh ? 2 : 0, arms: laugh ? [{ hand: [6, -26] }, { a: -0.3, b: 0.6 }] : [{ a: 0.4, b: 0.3 }, { a: -0.2 }], face: { eyes: laugh ? 'happy' : blink(t, 22) ? 'closed' : 'open', mouth: laugh ? 0.5 + hb * 0.3 : 0, smile: 0.9 } },
        t: { arms: [{ hand: [-4, -60], bend: 1 }, { a: 0.2 }], face: { eyes: laugh ? 'happy' : 'open', mouth: mouth('tamo', t), smile: 0.8, blush: laugh ? 1 : 0 }, headY: laugh ? -hb : 0, prop: undefined, propFar: undefined }, noAnchor: true });
      HB.anchorFloor(t, TXX + 40);
      harbourAfter(t);
      view(sx(290), 160, lerp(2.5, 2.7, lt / 2.7));
    });
    // the anchor lying on the planks where he put it down
    HB.anchorFloor = (t, wx, g) => { HB.lyBegin(); HB.anchorArt(sx(wx) - 26, DY + 2, PI / 2 - 0.06, 1.0, g || 0.15, t); HB.lyEnd({ edge: C('fire', 6) }); };

    // 29a — the world goes quiet (3:48): gulls stop in the air, the spray hangs, the boats stop; the laughing stops; they look up
    shot(228.0, 231.0, (lt, t) => {
      const ch = chillOf(t), up = sstep(229.4, 229.9, t);
      aftermath(t, 120);
      const laughing = t < HUSH_T + 0.25, hb = laughing ? Math.round(Math.abs(Math.sin(t * 11))) : 0;
      heroes(t, { k: { hip: -KB.leg + hb, lean: laughing ? 2 : 0, headY: -Math.round(up * 2), arms: laughing ? [{ hand: [6, -26] }, { a: -0.3, b: 0.6 }] : [{ a: 0.5, b: 0.4 }, { a: -0.2 }], face: { eyes: laughing ? 'happy' : 'wide', brows: laughing ? 'n' : 'worried', mouth: laughing ? 0.6 : mouth('kaira', t), smile: laughing ? 0.9 : 0, look: t > 228.9 && t < 229.4 ? -1 : 0 } },
        t: { headY: -Math.round(up * 2), arms: laughing ? [{ hand: [-4, -60], bend: 1 }, { a: 0.2 }] : [{ a: 0.3, b: 0.3 }, { a: 0.2 }], face: { eyes: laughing ? 'happy' : 'wide', brows: laughing ? 'n' : 'up', mouth: laughing ? 0.5 : 0, smile: laughing ? 0.8 : 0, look: t > 228.9 && t < 229.4 ? 1 : 0 } }, noAnchor: true });
      HB.anchorFloor(t, TXX + 40);
      if (t < HUSH_T) harbourAfter(t);
      HB.tintFlat(T_CHILL, ch);
      // a held breath: the motes hang too
      if (t > HUSH_T) for (let k = 0; k < 40; k++) { const x = fl((ih(k, 1, 371) * W + HUSH_T * (4 + ih(k, 2, 371) * 6)) % W), y = fl(30 + ih(k, 3, 371) * 200); if (ih(k, 4, 371) < 0.5) put(x, y, WHITE); }
      view(lerp(sx(250), sx(262), lt / 3), lerp(158, 150, up), lerp(2.0, 2.2, lt / 3));
    });

    // the sky over the harbour opening: rings of glyphs, the paper inside, cracks running out across the dawn
    function ringSky(t, cx, cy, r, op) {
      sigil(cx, cy, r, 0.32, t, op, 211);
      hush((x, y) => { const d = Math.hypot((x - cx) / r, (y - cy) / (r * 0.32)); return d < 0.5 ? 0.9 : d < 0.68 ? 0.45 + (0.68 - d) * 2.4 : 0; }, t, true);
      for (let y = Math.max(0, fl(cy - r * 0.32)); y < Math.min(H, cy + r * 0.32); y++) for (let x = Math.max(0, fl(cx - r)); x < Math.min(W, cx + r); x++) { const d = Math.hypot((x - cx) / r, (y - cy) / (r * 0.32)); if (d < 0.66 && d > 0.25 && (x + y * 2) % 7 === 0 && ih(x >> 2, y >> 2, 624) < d) put(x, y, C('hush', 3)); }
      for (let k = 0; k < 10; k++) { const a = k / 10 * TAU + 0.2, len = r * (0.3 + ih(k, 1, 621) * 0.6) * op; let px = cx + Math.cos(a) * r, py = cy + Math.sin(a) * r * 0.32; for (let s = 0; s < 6; s++) { const nx = px + Math.cos(a + (ih(k, s, 622) - 0.5)) * len / 6, ny = py + Math.sin(a + (ih(k, s, 623) - 0.5)) * len / 6 * 0.6; line(px, py, nx, ny, s < 2 ? WHITE : C('hush', 5)); px = nx; py = ny; } }
    }
    HB.ringSky = ringSky;
    // 29b — up at the sky (3:51): from the planks, past the two of them, the ring opening over the harbour
    // a figure dark against the sky, its rim of white kept (a silhouette that still has an edge)
    const silFx = (c, x, y, k) => (k === 4 && c === C('hush', 6) ? c : C('ink', LUM[c] > 140 ? 2 : 1));
    HB.silFx = silFx;
    shot(231.0, 235.4, (lt, t) => {
      const op = eoc(lin(231.0, 234.6, t)), rt = HUSH_T, tilt = eio(lt / 4.4);
      harbour(t, { cx: 60, rt });
      // the camera tipped up: the harbour slides down the frame and the sky above it opens out
      const sh = fl(lerp(70, 118, tilt));
      for (let y = H - 1; y >= sh; y--) BUF.copyWithin(y * W, (y - sh) * W, (y - sh) * W + W);
      for (let y = 0; y < sh; y++) for (let x = 0; x < W; x++) BUF[y * W + x] = soft(R.dusk, 0.9 + y / sh * 0.6, x, y);
      cloudBank(sh - 20, 9, 9, R.dusk, 1.8, 51, rt, 0);
      HB.tintFlat(T_CHILL, chillOf(t) + 0.06);
      ringSky(t, 246, 58 + sh * 0.2, 40 + op * 200, Math.min(1, lt / 1.6));
      rays(246, 60 + sh * 0.2, 9, 300, tab('#e8ecff', true), 0.25 * op, t, 7);
      HB.gullsFrozen(t, sh);
      // the two of them in the foreground, dark against it, looking up
      LIGHT.x = 0; LIGHT.y = -1; ENV.edge = C('hush', 6);
      bust('kaira', { t, wind: 0.5, face: { eyes: 'wide', brows: 'worried', mouth: mouth('kaira', t) }, headY: -3 }, 96, H - 22 + 44 - fl(tilt * 10), 3, 1, { fx: silFx });
      bust('tamo', { t, face: {}, headY: -3 }, 392, H - 22 + 52 - fl(tilt * 10), 3, -1, { fx: silFx });
      ENV.edge = null;
      shk(op * 0.6);
    });
    // gulls hanging in the air, mid-flap
    HB.gullsFrozen = (t, dy) => { for (let k = 0; k < 9; k++) { const x = fl(60 + ih(k, 1, 651) * 360), y = fl(30 + ih(k, 2, 651) * 90 + (dy || 0) * 0.3), up = k & 1 ? -2 : 1; const c = C('snow', 7), cd = C('stone', 4); put(x, y, c); put(x + 1, y, c); put(x - 1, y + (up < 0 ? -1 : 0), cd); put(x + 2, y + (up < 0 ? -1 : 0), cd); put(x - 2, y + up, cd); put(x + 3, y + up, cd); put(x - 3, y + up * 1.5, C('ink', 2)); put(x + 4, y + up * 1.5, C('ink', 2)); } };
    // 29c — Tamo, close (3:55): the dark lighthouse behind him — "Hollow. They took the lighthouse keeper last week.
    // Nobody even remembers his name."
    shot(235.4, 240.4, (lt, t) => {
      closeBg(() => { harbour(t, { cx: 60, rt: HUSH_T }); HB.tintFlat(T_CHILL, chillOf(t) + 0.06); ringSky(t, 300, -6, 150, 1); }, 412, 66, 3, 3);
      LIGHT.x = 0.2; LIGHT.y = -1; ENV.edge = C('hush', 6);
      bust('tamo', { t, face: { eyes: blink(t, 21) ? 'closed' : t > 238.6 ? 'sad' : 'half', brows: 'worried', mouth: mouth('tamo', t), smile: -0.2, look: t < 237 ? 1 : 0 }, headX: t > 238.6 ? -1 : 0 }, 160, H - 22 + 6, 3, 1);
      ENV.edge = null;
      // glyph-flakes drifting down like ash
      for (let k = 0; k < 30; k++) { const u = frac(t * 0.08 + ih(k, 1, 631)), x = fl(ih(k, 2, 631) * W + Math.sin(t + k) * 8), y = fl(u * H); put(x, y, ih(k, 3, 631) < 0.3 ? C('crimson', 5) : WHITE); if (k % 3 === 0) put(x + 1, y, C('hush', 4)); }
    });
    // 29d — Kaira, close (4:00): the mark on her chest stirring gold under her collar
    shot(240.4, 242.0, (lt, t) => {
      closeBg(() => { harbour(t, { cx: 60, rt: HUSH_T }); HB.tintFlat(T_CHILL, chillOf(t) + 0.06); ringSky(t, 250, -6, 150, 1); }, 200, 110, 3, 3);
      LIGHT.x = 0; LIGHT.y = -1; ENV.edge = C('hush', 6);
      const r = bust('kaira', { t, wind: 0.6, face: { eyes: blink(t, 22) ? 'closed' : 'open', brows: 'worried', look: -1 } }, 300, H - 22 + 6, 3, -1);
      ENV.edge = null;
      const p = 0.25 + Math.max(0, Math.sin(t * 5)) * 0.25;
      HB.seedMark(r.chest[0] - 6, r.chest[1] - 18, p * 0.7, t);
      for (let k = 0; k < 8; k++) { const u = frac(t * 0.7 + k / 8); put(fl(r.chest[0] + Math.sin(k * 2 + t) * 26), fl(r.chest[1] + 10 - u * 70), C('gold', 7)); put(fl(r.chest[0] + Math.sin(k * 2 + t) * 26) + 1, fl(r.chest[1] + 10 - u * 70), C('gold', 6)); }
    });

    // 30 — Oren drops in behind them (4:02): a gold flash, a ring of dust; "No… not here. Not the harbour."
    const OREN_LAND = 242.25;
    shot(242.0, 243.4, (lt, t) => {
      aftermath(t, 120, { rt: HUSH_T });
      const g = t - OREN_LAND, turn = t > 242.55;
      const land = eoc(lin(0, 0.3, g)), cr = g > 0 && g < 0.3 ? 1 - land : 0;
      if (g < 0) { const y = DY + 2 + g * 700; for (let j = 0; j < 50; j++) put(fl(sx(200)), fl(y - 40 - j * 2), j < 8 ? WHITE : C('gold', 6)); onDock(OREN, { hip: -WB.leg + 2, arms: [{ a: 2.6, b: 0.2 }, { a: -0.4 }], prop: (A) => spearArt(A.hand[0], A.hand[1], 0.1, 36, t) }, 200, y, 1, { noShadow: true }); }
      else { onDock(OREN, { hip: -WB.leg + 12 * cr, legs: [{ foot: [8, 0] }, { foot: [-8, 0] }], headY: t > 242.8 ? -2 : 0, arms: [{ a: 0.5 + cr, b: 0.5 }, { a: -0.4 - cr }], prop: (A) => spearArt(A.hand[0], A.hand[1], 0.15 + cr * 0.4, 36, t) }, 200, DY + 2, 1); dustRing(sx(200), DY + 2, g, 1.1, 641); HB.debris(sx(200), DY, g, 10, 642, { speed: 0.7 }); impactStar(sx(200), DY - 6, g, 1.2, C('gold', 6)); }
      heroes(t, { kf: turn ? -1 : 1, k: { hip: -KB.leg + (turn ? 4 : 0), arms: turn ? [{ a: 1.2, b: 0.2 }, { a: -0.5, b: 0.4 }] : [{ a: 0.5, b: 0.4 }, { a: -0.2 }], face: { eyes: 'wide', brows: turn ? 'angry' : 'worried' } }, t: { hip: -TB.leg + (turn ? 3 : 0), face: { eyes: 'wide', brows: turn ? 'angry' : 'up' } }, noAnchor: true });
      HB.anchorFloor(t, TXX + 40);
      HB.tintFlat(T_CHILL, chillOf(t));
      view(sx(250), 158, 2.0);
      shk(g > 0 && g < 0.3 ? 3 * (1 - g / 0.3) : 0);
    });
    // Oren, close: he looks up at the ring, the slit of his visor lit as he speaks
    shot(243.4, 246.0, (lt, t) => {
      closeBg(() => { harbour(t, { cx: 60, rt: HUSH_T }); HB.tintFlat(T_CHILL, chillOf(t) + 0.06); ringSky(t, 250, -6, 150, 1); }, 150, 100, 3, 3);
      LIGHT.x = 0; LIGHT.y = -1; ENV.edge = C('hush', 6);
      bust('oren', { t, face: { mouth: mouth('oren', t) }, headY: -2 }, 220, H - 22 + 6, 3, 1);
      ENV.edge = null;
    });
  }
  /* ================================================================ 30–31: the Hollow fall; a warden erased; the Bellwether (4:06–4:36) */
  {
    const { onDock, stand, arc, dustRing, impactStar, splash, shadowE, harbour, harbourAfter, sx, heldAnchor, bolt, hollowFig, bellwether, heroes, aftermath, ringSky, chillOf, silFx } = HB;
    const K = HB.consts, DY = K.DY, DF = K.DF, BRLX = K.BRLX, BELLX = K.BELLX, HUSH_T = K.HUSH_T;
    const TB = TAMO.body, KB = KAIRA.body, WB = WARDEN.body;
    const T_CHILL = tab('#dfe3f2');
    const HL = [247.0, 247.4, 247.7, 248.1, 248.5, 248.8, 249.2, 249.6], HLX = [392, 150, 440, 226, 488, 112, 520, 356], HLY = [DY - 4, DY + 2, DY - 6, DY + 4, DY - 2, DY - 5, DY + 3, DY - 1];
    const ERASE = 252.5, BELL_LAND = 260.0;
    // the white spreading over the far water from under the ring: the boats, the far shore, the sea go to sketch
    const farHushR = (t) => Math.max(0, (t - 245.5) * 46);
    function drained(t, cx, o) {
      o = o || {};
      const wl = aftermath(t, cx, Object.assign({ rt: HUSH_T, props: { noBarrels: true }, sky: (tt) => ringSky(tt, 300 - cx / 30, 4, 200, 1) }, o));
      const R0 = farHushR(t), ox = 300 - cx / 30, oy = 100;
      if (R0 > 0) hush((x, y) => { if (y > DF + 1 || y < 58) return 0; const d = Math.abs(x - ox) + (vn(y * 0.35, t * 2, 1, 807) - 0.5) * 30 + Math.max(0, 80 - y) * 1.5; return d < R0 - 8 ? 1 : d < R0 ? 0.6 : 0; }, t, true);
      // round the Bellwether's feet the planks go pale too
      if (o.footR) { const fx = sx(BELLX); hush((x, y) => { const d = Math.hypot(x - fx, (y - DY) * 3.2); return d < o.footR - 6 ? 1 : d < o.footR ? 0.5 : 0; }, t, true); }
      HB.tintFlat(T_CHILL, chillOf(t));
      return wl;
    }
    HB.drained = drained;
    // a Hollow coming down like a falling star, landing in a burst of black glyph-dust, rising
    function hollowFall(t, k, o) {
      const g = t - HL[k], x = sx(HLX[k]), y = HLY[k];
      if (g < -0.7) return null;
      if (g < 0) {
        // a falling star the wrong way round: a white-hot head, a long black tail torn at the edges
        const u = 1 + g / 0.7, e = u * u, yy = lerp(-40, y - 30, e), xx = x + (1 - e) * 110, dx = 110 / 0.7 * 2 * u, dy = (y + 10) / 0.7 * 2 * u, L = Math.hypot(dx, dy) || 1, nx = dx / L, ny = dy / L;
        for (let j = 0; j < 46; j++) { const px = xx + nx * j * 1.5, py = yy - ny * j * 1.5, w = Math.max(0.8, 5 - j * 0.09); for (let q = -w; q <= w; q += 0.5) { const qx = fl(px - ny * q), qy = fl(py + nx * q); if (j > 30 && ih(qx, qy, fl(t * 20)) < (j - 30) / 16) continue; put(qx, qy, j < 4 ? WHITE : Math.abs(q) > w - 0.6 ? C('hush', 5) : C('ink', 0)); } }
        fillEll(xx, yy, 5, 5, 0, WHITE); glow(xx, yy, 20, tab('#e8ecff', true), 0.6);
        for (let k = 0; k < 6; k++) put(fl(xx - ny * (ih(k, 1, 667) - 0.5) * 14 + nx * ih(k, 2, 667) * 30), fl(yy + nx * (ih(k, 1, 667) - 0.5) * 14 - ny * ih(k, 2, 667) * 30), k & 1 ? WHITE : C('crimson', 5));
        return null; }
      if (g < 0.5) { for (let q = 0; q < 24; q++) { const a = -PI * ih(q, 1, 661 + k), v = 30 + ih(q, 2, 661 + k) * 70, [px, py] = arc(x, y - 4, Math.cos(a) * v, Math.sin(a) * v * 0.7, 200, g); put(fl(px), fl(py), q % 4 === 0 ? WHITE : C('ink', 0)); put(fl(px) + 1, fl(py), C('ink', 1)); } dustRing(x, y, g, 0.6, 671 + k, R.ink); }
      const rise = eoc(lin(0.1, 0.6, g));
      return hollowFig(x, y, 1, (o && o.f) || (HLX[k] > 300 ? -1 : 1), t, Object.assign({ crouch: 1 - rise, seed: k + 3, glitch: g < 0.3 ? 0.8 : 0.15 }, o || {}));
    }
    HB.hollowFall = hollowFall;
    HB.HL = HL; HB.HLX = HLX; HB.HLY = HLY;
    function hollows(t, o) { for (let k = 0; k < 8; k++) hollowFall(t, k, o && o[k]); }
    HB.hollows = hollows;

    // 30a — the Hollow fall like stars (4:06): high and wide; the white sweeping in over the far boats; black streaks onto the dock
    shot(246.0, 250.0, (lt, t) => {
      drained(t, 60);
      onDock(OREN, { legs: [{ foot: [8, 0] }, { foot: [-8, 0] }], arms: [{ a: 1.3, b: 0.1 }, { a: -0.3 }], prop: (A) => spearArt(A.hand[0], A.hand[1], 1.2, 36, t) }, 200, DY + 2, 1);
      heroes(t, { kx: 296, kf: 1, tx: 286, tf: -1, k: { hip: -KB.leg + 3, arms: [{ a: 1.2, b: 0.2 }, { a: -0.5, b: 0.4 }], face: { eyes: 'wide', brows: 'angry' } }, t: { hip: -TB.leg + 3, arms: [{ hand: [10, -40] }, { hand: [7, -38] }], face: { eyes: 'wide', brows: 'angry' }, prop: heldAnchor(1.9, 0.6, 1.0, 0, 3) } });
      hollows(t);
      view(lerp(240, 236, lt / 4), lerp(132, 150, eio(lt / 4)), lerp(1.12, 1.45, eio(lt / 4)));
      shk(HL.some((h) => t > h && t < h + 0.12) ? 1.5 : 0);
    });

    // 30b — fighting shadows (4:10): Oren's spear goes through one and it only tears; they stand back to back
    shot(250.0, 252.2, (lt, t) => {
      drained(t, 100);
      const thrust = lin(250.4, 250.6, t), thrust2 = lin(251.4, 251.55, t);
      const sp_ = thrust > 0 && thrust < 1 ? eoc(thrust) * 14 : thrust2 > 0 && thrust2 < 1 ? eoc(thrust2) * 14 : t > 250.6 && t < 250.9 ? 14 * (1 - lin(250.6, 250.9, t)) : 0;
      onDock(OREN, { lean: sp_ * 0.2, legs: [{ foot: [10, 0] }, { foot: [-9, 0] }], arms: [{ a: 1.5, b: 0.0 }, { a: -0.4 }], face: {}, prop: (A) => spearArt(A.hand[0] + sp_, A.hand[1], 1.5, 36, t) }, 196, DY + 2, 1);
      const torn = (t > 250.55 && t < 251.2) || (t > 251.5 && t < 252.0);
      for (let k = 0; k < 8; k++) {
        if (k === 3) { hollowFig(sx(244), HLY[3], 1, -1, t, { seed: 6, glitch: torn ? 1 : 0.2, reach: lin(251.0, 251.4, t), dx: 0 }); if (torn) for (let q = 0; q < 14; q++) { const a = ih(q, fl(t * 20), 5) * TAU; put(fl(sx(244) + Math.cos(a) * 12), fl(DY - 30 + Math.sin(a) * 18), q & 1 ? WHITE : C('crimson', 5)); } continue; }
        if (k === 4) continue;
        hollowFall(t, k, { reach: k === 0 ? sstep(250.6, 251.4, t) * 0.7 : 0 });
      }
      heroes(t, { kx: 300, kf: 1, tx: 284, tf: -1, k: { hip: -KB.leg + 3, arms: [{ a: 1.25, b: 0.2 }, { a: -0.5, b: 0.4 }], face: { eyes: 'narrow', brows: 'angry' }, wind: 1 }, t: { hip: -TB.leg + 3, arms: [{ hand: [10, -40] }, { hand: [7, -38] }], face: { eyes: 'narrow', brows: 'angry' }, prop: heldAnchor(1.9, 0.7, 1.0, 0, 3) } });
      if (thrust > 0.9 && thrust < 1 || (thrust2 > 0.9 && thrust2 < 1)) HB.impactStar(sx(244), DY - 30, 0.05, 0.8, C('hush', 6));
      view(sx(262), 158, 2.0 + lt * 0.05);
    });
    // 30c — a warden is erased (4:12): staggering out of the barrels, a Hollow's hand on his shoulder; he goes white and comes apart
    shot(252.2, 254.0, (lt, t) => {
      drained(t, 300);
      const g = t - ERASE, wx = 452;
      if (g < 1.1) {
        const P = { legs: [{ foot: [6, 0] }, { foot: [-7, 0] }], lean: g > 0 ? 0 : -2, arms: [{ a: 0.6, b: 0.5 }, { a: -0.3 }], headY: g > 0 ? -1 : 0, prop: g < 0.3 ? (A) => spearArt(A.hand[0], A.hand[1], 0.3, 34, t) : undefined };
        if (g <= 0) onDock(WARDEN, P, wx, DY, -1);
        else { HB.dawnLit(sx(wx)); HB.lyBegin(); HB.toFrame(); actor(WARDEN, Object.assign({ t }, P), sx(wx), DY, 1, -1, { fx: (c, x, y) => (ih(x, y, fl(t * 20)) < g * 1.05 - (DY - y) / 200 ? -1 : LUM[c] > 80 ? WHITE : C('hush', 3)) }); }
      }
      if (g > 0) HB.glyphDustUp(sx(wx), DY - 34, g, 160, 22, 681);
      if (g > 0.25) { const [px, py, landed] = arc(sx(wx) - 6, DY - 34, -20, -40, 420, g - 0.25, DY + 2); line(px - 14, py + (landed ? 0 : -6), px + 14, py, landed ? C('hush', 4) : C('wood', 3)); }
      hollowFig(sx(wx + 24), DY - 2, 1, -1, t, { seed: 11, reach: g < 0 ? sstep(252.2, 252.45, t) : 1 - lin(0.2, 0.8, g), glitch: 0.25 });
      hush((x, y) => (g > 0 ? Math.max(0, 1 - Math.hypot(x - sx(wx), (y - DY) * 3) / (10 + g * 30)) * Math.min(1, g * 2) : 0), t, true);
      view(sx(wx) + 6, 158, 2.6);
      if (g > 0 && g < 0.08) flash(0.5);
    });
    // glyph-dust rising off something that is coming apart (bigger, slower than the cold open's)
    HB.glyphDustUp = (x, y, g, n, spread, seed) => { for (let k = 0; k < n; k++) { const v = 14 + ih(k, 2, seed) * 40, px = x + (ih(k, 3, seed) - 0.5) * spread + Math.sin(g * 3 + k) * 4 * g, py = y + (ih(k, 4, seed) - 0.5) * spread * 2.4 - v * g; if (ih(k, 5, seed) > 1.3 - g * 0.5) continue; if (ih(k, 6, seed) < 0.2) glyph(fl(px), fl(py), k, 1, WHITE); else rectF(fl(px), fl(py), 2, 2, ih(k, 7, seed) < 0.8 ? WHITE : C('crimson', 5)); } };

    // 31 — the Bellwether comes down out of the ring (4:14): huge and slow, riding a falling column of glyphs; it lands, and tolls
    function glyphColumn(x, top, bot, t, a) { for (let k = 0; k < 80; k++) { const u = frac(ih(k, 1, 691) + t * (0.5 + ih(k, 2, 691) * 0.6)), px = x + (ih(k, 3, 691) - 0.5) * 70 * (0.5 + u * 0.5), py = lerp(top, bot, u); if (ih(k, 4, 691) > a) continue; if (k % 5 === 0) glyph(fl(px), fl(py), k, 1, WHITE); else rectF(fl(px), fl(py), 1, 3, k % 7 === 0 ? C('crimson', 5) : C('hush', 6)); } for (let y = Math.max(0, fl(top)); y < Math.min(H, bot); y++) for (let dx = -30; dx <= 30; dx++) { const xx = fl(x + dx); if (xx < 0 || xx >= W) continue; tintI(y * W + xx, xx, y, tab('#e8ecff', true), 0.18 * a * (1 - Math.abs(dx) / 30)); } }
    HB.glyphColumn = glyphColumn;
    const bellY = (t) => DY + 2 - (1 - sstep(254.0, BELL_LAND + 0.4, t) - (t >= BELL_LAND ? 1 : 0) * 0) * 230 * (t < BELL_LAND ? 1 : 0) + (t < BELL_LAND ? 0 : 0);
    shot(254.0, 257.5, (lt, t) => {
      const sh = 70, cx = 200;
      drained(t, cx);
      HB.hollows(t);
      heroes(t, { kx: 300, kf: 1, tx: 284, tf: 1, k: { headY: -2, arms: [{ a: 1.25, b: 0.2 }, { a: -0.5, b: 0.4 }], face: { eyes: 'wide', brows: 'worried' } }, t: { headY: -2, arms: [{ hand: [10, -40] }, { hand: [7, -38] }], face: { eyes: 'wide', brows: 'worried' }, prop: heldAnchor(1.9, 0.4, 1.0, 0, 3) } });
      onDock(OREN, { headY: -2, legs: [{ foot: [8, 0] }, { foot: [-8, 0] }], arms: [{ a: 1.3, b: 0.1 }, { a: -0.3 }], prop: (A) => spearArt(A.hand[0], A.hand[1], 1.2, 36, t) }, 214, DY + 2, 1);
      // tip the camera up: the dock slides down the frame
      for (let y = H - 1; y >= sh; y--) BUF.copyWithin(y * W, (y - sh) * W, (y - sh) * W + W);
      for (let y = 0; y < sh; y++) for (let x = 0; x < W; x++) BUF[y * W + x] = soft(R.hush, 3.4 + y / sh * 1.2, x, y);
      ringSky(t, 330, sh - 40, 260, 1);
      const by = bellY(t) + sh, bx = sx(BELLX);
      glyphColumn(bx, 0, by, t, 1);
      LIGHT.x = 0; LIGHT.y = -1;
      bellwether(bx, by, 0.85, t, { arms: 0.35, billow: 1, speak: 0.3, edge: C('hush', 6) });
      rays(bx, sh - 40, 8, 300, tab('#e8ecff', true), 0.18, t, 9);
      view(260, 135, 1.0);
      shk(0.6);
    });
    shot(257.5, 260.0, (lt, t) => {
      // closer, riding down with it: the camera sinks with the bell; the lighthouse and the drained harbour rise into view behind
      const u = lt / 2.5, sh = fl(lerp(300, 58, eic(u) * 0.75 + u * 0.25));
      drained(t, 380);
      for (let y = H - 1; y >= sh; y--) BUF.copyWithin(y * W + 0, (y - sh) * W, (y - sh) * W + W);
      for (let y = 0; y < sh; y++) for (let x = 0; x < W; x++) BUF[y * W + x] = soft(R.dusk, 0.8 + y / Math.max(1, sh) * 0.9, x, y);
      HB.tintFlat(T_CHILL, 0.2);
      ringSky(t, 240, sh - 150, 260, 1);
      const bx = 250, by = 252 + fl(Math.sin(t * 2) * 1);
      glyphColumn(bx, 0, by, t, 1);
      LIGHT.x = 0.3; LIGHT.y = -1;
      bellwether(bx, by, 1.0, t, { arms: lerp(0.35, 0.2, u), billow: 1.4, speak: 0.4 + Math.sin(t * 6) * 0.2, edge: C('hush', 6) });
      rays(bx, 0, 8, 260, tab('#e8ecff', true), 0.15, t, 9);
      // pale streaks rushing upward past it (we are falling with it)
      for (let k = 0; k < 24; k++) { const x = ih(k, 1, 731) * W, y = H - frac(ih(k, 2, 731) + t * 1.8) * (H + 60); line(x, y, x, y + 14, C('hush', 6)); }
      shk(0.8);
    });
    shot(BELL_LAND, 262.0, (lt, t) => {
      const g = t - BELL_LAND, cx = 200, sh = 40;
      drained(t, cx, { footR: 20 + g * 30 });
      HB.hollows(t);
      // they're knocked staggering by the toll
      const stag = g < 0.6 ? Math.sin(g / 0.6 * PI) : 0;
      heroes(t, { kx: 300 - stag * 6, kf: 1, tx: 284 - stag * 8, tf: 1, k: { hip: -KB.leg + 5 * stag, lean: -3 * stag, arms: [{ a: 1.25 + stag, b: 0.2 }, { a: -0.5, b: 0.4 }], face: { eyes: stag > 0.3 ? 'closed' : 'wide', brows: 'worried' }, wind: 3 * stag }, t: { hip: -TB.leg + 5 * stag, arms: [{ hand: [10, -40] }, { hand: [7, -38] }], face: { eyes: stag > 0.3 ? 'closed' : 'wide', brows: 'worried' }, prop: heldAnchor(1.9, 0.4, 1.0, 0, 3) } });
      onDock(OREN, { hip: -WB.leg + 5 * stag, legs: [{ foot: [8, 0] }, { foot: [-8, 0] }], arms: [{ a: 1.3 + stag, b: 0.1 }, { a: -0.3 }], prop: (A) => spearArt(A.hand[0], A.hand[1], 1.2, 36, t) }, 214 - stag * 8, DY + 2, 1);
      const bx = sx(BELLX);
      dustRing(bx, DY + 2, g, 2.6, 701, R.hush); HB.debris(bx, DY, g, 30, 702, { speed: 1.4, big: true });
      HB.tipUp(sh, t);
      LIGHT.x = -0.4; LIGHT.y = -1;
      // a heavy settle: it comes down a touch below its stance and rises back
      const settle = g < 0.35 ? Math.sin(g / 0.35 * PI) * 4 : 0;
      bellwether(bx, DY + 2 + sh + settle, 0.92, t, { arms: 0.15 + settle * 0.03, speak: g < 0.6 ? 1 : 0.3, ring: Math.max(0, 1 - g), edge: C('hush', 6) });
      // the toll: rings of sound
      for (let q = 0; q < 4; q++) { const gg = g - q * 0.18; if (gg < 0 || gg > 1.2) continue; const rr = 10 + gg * 260; for (let a = 0; a < TAU; a += 0.6 / rr) { const xx = fl(bx + Math.cos(a) * rr), yy = fl(DY + sh - 165 + Math.sin(a) * rr * 0.55); if (bay(xx, yy) < 1 - gg / 1.2) put(xx, yy, WHITE); } }
      view(240, 135, 1.0);
      shk(g < 1 ? 5 * (1 - g) : 0);
      if (g < 0.067) flash(0.9);
    });
    // 32 — "The courier. And the anchor-bearer. Two of four." / "[chuckle] The King will be so pleased." (4:22)
    function bellClose(t, lt, chuckle) {
      closeBg(() => { drained(t, 330, { footR: 120 }); HB.hollows(t); }, 300, 120, 3, 3);
      const m = mouth('bellwether', t);
      LIGHT.x = -0.5; LIGHT.y = -0.8; ENV.edge = C('hush', 6);
      bust('bell', { t, speak: 0.3 + m * 0.9, ring: chuckle ? m * 0.8 : 0 }, 250 + (chuckle ? Math.round(Math.sin(t * 40) * m * 2) : 0), H - 22 + 72 - fl(lt * 2), 3, 1);
      ENV.edge = null;
      glow(250, 120, 120, tab('#ffc060', true), 0.12 + m * 0.25);
      // flakes of bronze and glyph falling from the crack as it speaks
      for (let k = 0; k < 16; k++) { const u = frac(t * 0.6 + ih(k, 1, 711)), x = 250 + (ih(k, 2, 711) - 0.5) * 60 + Math.sin(t + k) * 4, y = 60 + u * 190; if (ih(k, 3, 711) < 0.3 + m) put(fl(x), fl(y), k % 3 ? C('fire', 6) : WHITE); }
    }
    shot(262.0, 266.2, (lt, t) => bellClose(t, lt, false));
    shot(266.2, 267.0, (lt, t) => {
      drained(t, 150, { footR: 120 });
      const d = eoc(lin(0, 0.35, lt));
      heroes(t, { kx: 310, kf: 1, tx: 266, tf: 1, k: { hip: -KB.leg + 4, arms: [{ a: lerp(0.4, 1.35, d), b: 0.1 }, { a: lerp(-0.2, -0.7, d), b: 0.4 }], face: { eyes: 'narrow', brows: 'angry' }, wind: 2 }, t: { hip: -TB.leg + 3, arms: [{ hand: [12, lerp(-36, -58, d)] }, { hand: [9, lerp(-34, -56, d)] }], face: { eyes: 'narrow', brows: 'angry', smile: 0.3 }, prop: heldAnchor(lerp(1.9, 2.6, d), 1, 1.0, 0, 3), wind: 2 } });
      glow(sx(266) + 20, DY - 70, 40, tab('#40ffd0', true), 0.4 * d);
      view(sx(292), 152, 2.5);
    });
    shot(267.0, 270.2, (lt, t) => bellClose(t, lt + 4, true));
    // 32b — the standoff, wide (4:30): their stances; it spreads its arms; the Hollow edge in
    shot(270.2, 276.0, (lt, t) => {
      const cx = 160, sh = 40;
      drained(t, cx, { footR: 140 });
      for (let k = 0; k < 8; k++) { const creep = lt * 3 * (HLX[k] > 300 ? -1 : 1); HB.hollowFig(sx(HLX[k] + creep), HLY[k], 1, HLX[k] > 300 ? -1 : 1, t, { seed: k + 3, reach: 0.2 + Math.sin(t * 1.5 + k) * 0.2 }); }
      onDock(OREN, { legs: [{ foot: [9, 0] }, { foot: [-9, 0] }], arms: [{ a: 1.45, b: 0.0 }, { a: -0.3 }], prop: (A) => spearArt(A.hand[0], A.hand[1], 1.4, 36, t) }, 220, DY + 2, 1);
      heroes(t, { kx: 300, kf: 1, tx: 280, tf: 1, k: { hip: -KB.leg + 4, arms: [{ a: 1.35, b: 0.1 }, { a: -0.7, b: 0.4 }], face: { eyes: 'narrow', brows: 'angry' }, wind: 2 }, t: { hip: -TB.leg + 3, arms: [{ hand: [12, -58] }, { hand: [9, -56] }], face: { eyes: 'narrow', brows: 'angry' }, prop: heldAnchor(2.6, 1, 1.0, 0, 3), wind: 2 } });
      // wind off it: streaks of pale dust along the planks toward them
      for (let k = 0; k < 30; k++) { const u = frac(t * 0.9 + ih(k, 1, 721)), x = sx(BELLX) - u * 300, y = DY - 4 - ih(k, 2, 721) * 60; line(x, y, x + 6, y, C('hush', 5)); }
      HB.tipUp(sh, t);
      LIGHT.x = -0.4; LIGHT.y = -1;
      bellwether(sx(BELLX), DY + 2 + sh, 0.92, t, { arms: lerp(0.15, 0.5, eio(lin(271.5, 274.5, t))), speak: 0.3, edge: C('hush', 6) });
      view(lerp(250, 258, lt / 5.8), lerp(138, 146, lt / 5.8), lerp(1.04, 1.12, eio(lt / 5.8)));
    });
  }
  /* ================================================================ 33–34: the toll and the wall of water; the light in the fog (4:36–5:00) */
  {
    const { onDock, stand, arc, dustRing, impactStar, splash, shadowE, harbour, sx, heldAnchor, bolt, hollowFig, bellwether, heroes, drained, ringSky, chillOf, silFx, anchorArt, lyBegin, lyEnd, actorEx, vesperFig } = HB;
    const K = HB.consts, DY = K.DY, DF = K.DF, BELLX = K.BELLX, HUSH_T = K.HUSH_T;
    const TB = TAMO.body, KB = KAIRA.body, WB = WARDEN.body;
    const TOLL = 276.5, SLAM = 277.25, WALL = 277.5, MEET = 278.5, BREAK = 285.5, THROWN = 286.0, WX = 362;
    const T_CHILL = tab('#dfe3f2');
    // the camera tipped up: the harbour drops down the frame (by sh) so the sky above it opens out for something tall
    function tipUp(sh, t, ring) {
      for (let y = H - 1; y >= sh; y--) BUF.copyWithin(y * W, (y - sh) * W, (y - sh) * W + W);
      for (let y = 0; y < sh; y++) for (let x = 0; x < W; x++) BUF[y * W + x] = soft(R.dusk, 0.9 + y / Math.max(1, sh) * 0.7, x, y);
      if (ring !== false) ringSky(t, 300, sh - 60, 280, 1);
      HB.tintFlat(T_CHILL, 0.12);
    }
    HB.tipUp = tipUp;
    // the Storm Seed's light under Kaira's collar, at close-up pixel size (3 px blocks): a diamond, a white core, pulsing rays
    HB.seedMark = (x, y, p, t) => {
      glow(x, y, 70, tab('#ffd060', true), 0.35 + p * 0.4); glow(x, y, 22, tab('#fff4c0', true), 0.5 + p * 0.4);
      for (let j = -3; j <= 3; j++) for (let i = -3; i <= 3; i++) { const d = Math.abs(i) + Math.abs(j); if (d > 3) continue; rectF(fl(x + i * 3), fl(y + j * 3), 3, 3, d < 1 ? WHITE : d < 2 ? C('gold', 7) : C('gold', 5)); }
      for (let k = 0; k < 8; k++) { const a = k / 8 * TAU + t * 0.5, l = (k & 1 ? 4 : 7) + p * 5; for (let q = 4; q < l; q++) rectF(fl(x + Math.cos(a) * q * 3), fl(y + Math.sin(a) * q * 3), 3, 3, q < l - 2 ? C('gold', 6) : C('gold', 4)); }
    };
    // where the white has got to along the dock (stage x), coming from the Bellwether
    const frontX = (t) => (t < TOLL ? 9999 : t < MEET ? lerp(sx(BELLX) - 30, sx(WX) + 18, eic(lin(TOLL + 0.1, MEET, t)) * 0.4 + lin(TOLL + 0.1, MEET, t) * 0.6) : t < BREAK ? sx(WX) + 18 - lin(MEET, BREAK, t) * 6 : Math.max(sx(WX) - (t - BREAK) * 160, sx(318)));
    function whiteFront(t, dy) {
      const fx = frontX(t); if (fx > W + 20) return;
      hush((x, y) => { if (y < 40 + (dy || 0)) return 0; const n = vn(y * 0.3, t * 4, 1, 801) * 10; return x > fx + 10 + n ? 1 : x > fx + n ? 0.6 : 0; }, t, true);
      for (let y = 40 + (dy || 0); y < H; y++) for (let x = Math.max(0, fl(fx - 16)); x < Math.min(W, fx + 4); x++) tintI(y * W + x, x, y, tab('#ffffff', true), (1 - Math.abs(x - fx + 4) / 16) * 0.7);
      // its edge: a churning seam of glyphs and static
      for (let k = 0; k < 70; k++) { const y = 60 + (dy || 0) + ih(k, 1, fl(t * 14)) * 190, x = fx + (ih(k, 2, fl(t * 14)) - 0.3) * 12; if (k % 6 === 0) glyph(fl(x), fl(y), k, 1, ih(k, 3, 9) < 0.7 ? WHITE : C('crimson', 5)); else put(fl(x), fl(y), k & 1 ? WHITE : C('hush', 4)); }
    }
    // the wall of water: a churning sheet thrown up out of the sea across the dock, a ragged crest leaning over, spray
    function waterWall(t, dy, strain) {
      const up = eob(lin(WALL, WALL + 0.6, t)), brk = t >= BREAK; if (up <= 0 || brk) return;
      const x0 = sx(WX), hTop = 175 * up, bot = 262 + dy, base = DY + dy;
      for (let y = Math.max(0, fl(base - hTop - 10)); y < Math.min(H, bot); y++) {
        const v = (base - y) / Math.max(1, hTop), lean = Math.pow(Math.max(0, v - 0.45), 2) * 90, half = 24 + v * 10 + Math.max(0, v - 0.75) * 40 + (y > base ? (y - base) * 1.2 : 0) - strain * 7 * Math.sin(v * PI);
        const cx = x0 + lean + Math.sin(y * 0.08 + t * 6) * 2;
        for (let x = fl(cx - half - 3); x <= cx + half + 3; x++) {
          if (x < 0 || x >= W) continue;
          const u = (x - cx) / half, edge = Math.abs(u) > 1 - 3 / half;
          if (Math.abs(u) > 1 + (vn(y * 0.5, t * 9 + x, 1, 803) - 0.5) * 0.3) continue;
          if (v > 1 - 0.04) { BUF[y * W + x] = ih(x, y, fl(t * 16)) < 0.6 ? WHITE : C('sky', 6); continue; }
          const flow = vn(x * 0.4, y * 0.25 + t * 40, 1, 804);
          BUF[y * W + x] = edge ? (ih(x, y, fl(t * 20)) < 0.5 ? WHITE : C('teal', 6)) : cel(R.teal, 3.2 + u * -0.8 + (flow > 0.65 ? 1.6 : flow < 0.25 ? -0.8 : 0) + (v > 0.85 ? 1 : 0), x, y);
        }
      }
      // spray thrown off the crest
      for (let k = 0; k < 60; k++) { const ph = frac(t * 1.3 + ih(k, 1, 805)), a = -PI / 2 + (ih(k, 2, 805) - 0.3) * 1.6, v = 60 + ih(k, 3, 805) * 80, [px, py] = arc(x0 + 20, base - hTop + 4, Math.cos(a) * v, Math.sin(a) * v, 260, ph * 0.8); if (py < base) put(fl(px), fl(py), k % 3 ? WHITE : C('sky', 6)); }
      glow(x0, base - hTop * 0.5, 70, tab('#40ffd0', true), 0.25);
      // where the white meets it: static, glyphs flaking off, steam
      if (t > MEET) for (let k = 0; k < 40; k++) { const y = base - ih(k, fl(t * 18), 811) * hTop, x = x0 + 14 + ih(k, 2, fl(t * 18)) * 8; if (k % 5 === 0) glyph(fl(x), fl(y), k, 1, WHITE); else put(fl(x), fl(y), k & 1 ? C('crimson', 5) : WHITE); }
      if (t > MEET) for (let k = 0; k < 10; k++) { const u = frac(t * 0.8 + k / 10), x = x0 + 18 + u * 20, y = base - ih(k, 1, 812) * hTop - u * 30, r = 3 + u * 8; fillEll(x, y, r, r * 0.8, 0, (xx, yy) => (bay(xx, yy) < 0.5 * (1 - u) ? C('hush', 7) : -1)); }
    }
    // Tamo planting the anchor and holding it; Kaira at his back
    function holders(t, dy, o) {
      o = o || {}; const strain = lin(MEET, BREAK, t), sh = Math.round((ih(fl(t * 30), 3, 9) - 0.5) * 2 * strain), slam = lin(SLAM - 0.3, SLAM, t);
      let tP;
      if (t < SLAM - 0.3) tP = { hip: -TB.leg, legs: [{ foot: [8, 0] }, { foot: [-8, 0] }], arms: [{ hand: [12, -58] }, { hand: [9, -56] }], face: { eyes: 'narrow', brows: 'angry' }, prop: heldAnchor(2.6, 1, 1.0, 0, 3), wind: 2 };
      else if (t < SLAM) tP = { hip: -TB.leg + 2, legs: [{ foot: [9, 0] }, { foot: [-9, 0] }], arms: [{ hand: [lerp(6, 18, eic(slam)), lerp(-74, -40, eic(slam))] }, { hand: [lerp(3, 15, eic(slam)), lerp(-72, -38, eic(slam))] }], face: { eyes: 'closed', brows: 'angry', mouth: 0.9 }, prop: heldAnchor(lerp(PI, 0.15, eic(slam)), 1, 1.0, 0, 3), wind: 3 };
      else tP = { hip: -TB.leg + 9 + sh * 0, lean: 4, legs: [{ foot: [12, 0] }, { foot: [-11, 0] }], arms: [{ hand: [21, -30] }, { hand: [20, -24] }], face: { eyes: strain > 0.3 ? 'closed' : 'narrow', brows: 'angry', mouth: mouth('tamo', t) || 0.6 }, wind: 3 };
      const rT = onDock(TAMO, tP, 300 + sh * 0.5, DY + 1 + dy, 1);
      if (t >= SLAM) { lyBegin(); anchorArt(sx(324), DY - 46 + dy, 0.05, 1.0, 1, t); lyEnd({ edge: C('mint', 7) }); glow(sx(324), DY - 20 + dy, 40, tab('#40ffd0', true), 0.4); }
      const kP = { hip: -KB.leg + 6, lean: 5, legs: [{ foot: [10, 0] }, { foot: [-12, 0] }], arms: [{ hand: [14, -36] }, { hand: [12, -30] }], face: { eyes: t > 283.6 ? 'wide' : 'narrow', brows: 'worried', mouth: mouth('kaira', t) }, wind: 3 };
      const rK = onDock(KAIRA, kP, 276, DY + 3 + dy, 1);
      return { rT, rK };
    }
    // 33a — the toll (4:36): it rings; a white wave rolls down the dock; he slams the anchor down; the sea stands up into a wall
    shot(276.0, 278.5, (lt, t) => {
      const sh = 40;
      drained(t, 200, { footR: 150 });
      for (let k = 0; k < 8; k++) if (HB.HLX[k] > 340) hollowFig(sx(HB.HLX[k] + 40), HB.HLY[k], 1, -1, t, { seed: k + 3 });
      onDock(OREN, { legs: [{ foot: [9, 0] }, { foot: [-9, 0] }], arms: [{ a: 2.4, b: 0.6 }, { a: 2.0, b: 0.6 }], lean: -2, face: {} }, 232, DY + 2, 1);
      holders(t, 0);
      if (t > SLAM) { dustRing(sx(324), DY + 2, t - SLAM, 1.4, 821, R.mint); impactStar(sx(324), DY - 4, t - SLAM, 1.4, C('mint', 7)); HB.debris(sx(324), DY, t - SLAM, 16, 822, { speed: 1.2 }); }
      whiteFront(t, 0);
      tipUp(sh, t);
      const g = t - TOLL, bx = sx(BELLX);
      LIGHT.x = -0.4; LIGHT.y = -1;
      bellwether(bx, DY + 2 + sh, 0.92, t, { arms: g > 0 ? lerp(0.5, 0.8, eoc(lin(0, 0.4, g))) : 0.5, speak: g > 0 && g < 1 ? 1 : 0.4, ring: g > 0 ? Math.max(0, 1 - g * 0.7) : 0, edge: C('hush', 6) });
      if (g > 0) for (let q = 0; q < 4; q++) { const gg = g - q * 0.16; if (gg < 0 || gg > 1.4) continue; const rr = 10 + gg * 240; for (let a = 0; a < TAU; a += 0.6 / rr) { const xx = fl(bx + Math.cos(a) * rr), yy = fl(DY + sh - 170 + Math.sin(a) * rr * 0.6); if (bay(xx, yy) < 1 - gg / 1.4) put(xx, yy, WHITE); } }
      waterWall(t, sh, 0);
      // the sea climbing the piles on both sides to make the wall
      if (t > WALL - 0.15 && t < WALL + 0.6) for (let k = 0; k < 60; k++) { const u = lin(WALL - 0.15, WALL + 0.6, t), x = sx(WX) + (ih(k, 1, 823) - 0.5) * 60, y = lerp(262, DY + sh - 90, u) + ih(k, 2, 823) * 50; put(fl(x), fl(y), k & 1 ? WHITE : C('teal', 6)); put(fl(x), fl(y) + 1, C('teal', 4)); }
      view(240, 135, 1.0);
      shk(g > 0 && g < 0.6 ? 3 : t > SLAM && t < SLAM + 0.25 ? 4 : t > MEET - 0.05 ? 3 : 0.5);
      if (t >= MEET - 0.034) flash(0.7);
    });
    // 33b — the wall holds (4:38): close on it, roaring; the white eating its far face; he's down on one knee holding the iron
    shot(278.5, 280.4, (lt, t) => {
      drained(t, 180, { footR: 150 });
      whiteFront(t, 0);
      holders(t, 0);
      waterWall(t, 0, lin(MEET, BREAK, t));
      view(sx(318), 140, 2.1);
      shk(1.6);
      if (t < MEET + 0.06) flash(0.6);
    });
    // 33c — Tamo, close (4:40): "Kaira! Whatever you've got, now would be a really good time!"
    shot(280.4, 283.6, (lt, t) => {
      closeBg(() => { drained(t, 180, { footR: 150 }); whiteFront(t, 0); waterWall(t, 0, 0.5); }, sx(WX) - 20, 140, 3, 3);
      LIGHT.x = 0.4; LIGHT.y = 0.6; ENV.edge = C('mint', 7);
      const sh = Math.round((ih(fl(t * 30), 1, 7) - 0.5) * 2);
      bust('tamo', { t, glow: 1, sweat: 1, face: { eyes: talking('tamo', t) ? 'narrow' : 'closed', brows: 'angry', mouth: mouth('tamo', t) || 0.3 }, headX: sh }, 180, H - 22 + 6, 3, 1);
      ENV.edge = null;
      glow(200, 280, 170, tab('#40ffd0', true), 0.35);
      for (let k = 0; k < 50; k++) { const sp_ = 260 + ih(k, 1, 831) * 120, x = W - ((t * sp_ + ih(k, 2, 831) * 600) % (W + 40)), y = ih(k, 3, 831) * H; line(x, y, x + 10, y - 2, k % 3 ? WHITE : C('sky', 6)); }
      shk(1);
    });
    // 33d — Kaira, close (4:43): "I don't know how to use it!" — the light under her collar flaring, useless
    shot(283.6, 285.4, (lt, t) => {
      closeBg(() => { drained(t, 180, { footR: 150 }); whiteFront(t, 0); waterWall(t, 0, 0.8); }, sx(WX) - 60, 140, 3, 3);
      LIGHT.x = 0.4; LIGHT.y = 0.4; ENV.edge = C('gold', 6);
      const r = bust('kaira', { t, wind: 2.5, face: { eyes: 'wide', brows: 'worried', mouth: mouth('kaira', t) } }, 280, H - 22 + 6, 3, 1);
      ENV.edge = null;
      const p = 0.45 + Math.max(0, Math.sin(t * 9)) * 0.35;
      HB.seedMark(r.chest[0] - 6, r.chest[1] - 18, p, t);
      for (let k = 0; k < 4; k++) if (ih(k, fl(t * 16), 3) < 0.5) bolt(r.chest[0] - 6, r.chest[1] - 18, r.chest[0] + (ih(k, fl(t * 16), 4) - 0.5) * 140, r.chest[1] - 18 - ih(k, fl(t * 16), 5) * 70, fl(t * 30) + k, 1, WHITE, C('gold', 5));
      for (let k = 0; k < 50; k++) { const sp_ = 260 + ih(k, 1, 832) * 120, x = W - ((t * sp_ + ih(k, 2, 832) * 600) % (W + 40)), y = ih(k, 3, 832) * H; line(x, y, x + 10, y - 2, k % 3 ? WHITE : C('sky', 6)); }
      shk(1.2);
    });
    // 33e — the wall breaks (4:45): it bursts toward them; they're thrown back down the dock and land hard; the anchor clatters down
    shot(285.4, 288.0, (lt, t) => {
      const g = t - BREAK, th = t - THROWN, sh = 30;
      drained(t, 120, { footR: 150 });
      whiteFront(t, 0);
      // the two of them: braced, then flung, tumbling, down
      if (t < THROWN) holders(t, 0);
      else {
        const fly = (k, x0, x1, tl, seed) => { const u = clamp(th / tl, 0, 1), x = lerp(x0, x1, eoc(u)), y = DY - Math.sin(u * PI) * 40 * (1 - u * 0.3); return [x, y, u]; };
        const [tx, ty, tu] = fly(0, sx(300), sx(212), 0.6), [kx, ky, ku] = fly(1, sx(276), sx(130), 0.75);
        if (tu < 1) actorEx(TAMO, { t, face: { eyes: 'closed', brows: 'worried', mouth: 0.6 }, arms: [{ a: 2.6, b: 0.3 }, { a: -2.4, b: 0.3 }], legs: [{ foot: [8, -4] }, { foot: [-6, 0] }] }, tx, ty - 30, 1, { rot: -tu * 4.2, px: 0, py: -30 });
        else HB.onDock(TAMO, { face: { eyes: 'closed', brows: 'worried', mouth: 0.2 }, arms: [{ a: 2.9, b: 0.3 }, { a: 2.4, b: 0.4 }], legs: [{ foot: [7, 0] }, { foot: [-5, 0] }] }, 236, DY - 3, 1, { rot: -PI / 2, px: 0, py: -TB.leg, noShadow: true });
        if (ku < 1) actorEx(KAIRA, { t, face: { eyes: 'closed', brows: 'worried', mouth: 0.6 }, arms: [{ a: 2.6, b: 0.3 }, { a: -2.4, b: 0.3 }], legs: [{ foot: [8, -4] }, { foot: [-6, 0] }], wind: 4 }, kx, ky - 30, 1, { rot: -ku * 3.6, px: 0, py: -30 });
        else HB.onDock(KAIRA, { face: { eyes: 'closed', brows: 'worried' }, arms: [{ a: 2.9, b: 0.3 }, { a: 2.4, b: 0.4 }], legs: [{ foot: [7, 0] }, { foot: [-5, 0] }] }, 150, DY + 2, 1, { rot: -PI / 2, px: 0, py: -KB.leg, noShadow: true });
        dustRing(sx(226), DY - 2, th - 0.6, 0.9, 841); dustRing(sx(140), DY + 2, th - 0.75, 0.9, 842);
        // the anchor, spinning down and clattering
        const [ax, ay, landed, ag] = arc(sx(330), DY - 60, -24, -160, 600, th, DY - 2);
        lyBegin(); anchorArt(ax, ay - (landed ? Math.abs(Math.sin(ag * 18)) * 6 * Math.max(0, 1 - ag * 2) : 0), landed ? PI / 2 + 0.05 : th * 9, 0.95, Math.max(0, 0.6 - th), t); lyEnd({ edge: C('hush', 6) });
        if (landed && ag < 0.4) HB.debris(ax, ay, ag, 8, 843, { ramp: () => WHITE, speed: 0.5 });
      }
      // the burst: water and white blown toward them
      if (g >= 0 && g < 1.6) {
        for (let k = 0; k < 220; k++) { const a = PI + (ih(k, 1, 844) - 0.5) * 1.3, v = 120 + ih(k, 2, 844) * 260, [px, py] = arc(sx(WX), DY - 20 - ih(k, 3, 844) * 120, Math.cos(a) * v, Math.sin(a) * v, 300, g); if (py < H) put(fl(px), fl(py), k % 4 === 0 ? C('teal', 6) : k % 4 === 1 ? C('sky', 6) : WHITE); }
        fillEll(sx(WX), DY - 60, 30 + g * 120, 60 + g * 40, 0, (xx, yy) => (bay(xx, yy) < 0.6 * (1 - g / 1.6) ? WHITE : -1));
      }
      if (t < BREAK) waterWall(t, 0, 1);
      view(lerp(sx(300), sx(214), eio(lin(THROWN, THROWN + 0.8, t))), 156, lerp(1.7, 1.9, lin(THROWN, 288, t)));
      shk(g > 0 && g < 0.5 ? 5 : th > 0.55 && th < 0.9 ? 2.5 : 1);
      if (g >= 0 && g < 0.067) flash(0.9);
    });
    // 33f — the last toll, coming (4:48): from the planks behind the fallen two, it looms; its arms rise; light gathers in the bell
    const bellStep = (t) => lerp(BELLX, BELLX - 70, eio(lin(288.0, 291.5, t)));
    HB.bellStep = bellStep;
    function fallen(t, o) {
      HB.onDock(TAMO, { face: { eyes: t > 289.5 ? 'half' : 'closed', brows: 'worried', mouth: 0.1 }, arms: [{ a: 2.9, b: 0.3 }, { a: 2.4, b: 0.4 }], legs: [{ foot: [7, 0] }, { foot: [-5, 0] }], headY: 0 }, 236, DY - 3, 1, { rot: -PI / 2 + (t > 290 ? 0.25 : 0), px: 0, py: -TB.leg, noShadow: true });
      HB.onDock(KAIRA, { face: { eyes: t > 290.5 ? 'half' : 'closed', brows: 'worried' }, arms: [{ a: 2.9, b: 0.3 }, { a: 2.4 + (t > 291 ? Math.sin(t * 2) * 0.2 : 0), b: 0.4 }], legs: [{ foot: [7, 0] }, { foot: [-5, 0] }] }, 150, DY + 2, 1, { rot: -PI / 2, px: 0, py: -KB.leg, noShadow: true });
      lyBegin(); anchorArt(sx(326) - 24, DY - 2, PI / 2 + 0.05, 0.95, 0, t); lyEnd({ edge: C('hush', 6) });
    }
    HB.fallen = fallen;
    shot(288.0, 292.0, (lt, t) => {
      const sh = 30, cx = 130;
      drained(t, cx, { footR: 400 });
      for (let k = 0; k < 8; k++) if (HB.HLX[k] > 300) hollowFig(sx(HB.HLX[k] - 30 - lt * 6), HB.HLY[k], 1, -1, t, { seed: k + 3, reach: 0.3 });
      fallen(t);
      tipUp(sh, t);
      const arms = eio(lin(288.0, 290.6, t)), bx = sx(bellStep(t));
      LIGHT.x = -0.3; LIGHT.y = -1;
      const r = bellwether(bx, DY + 2 + sh, 0.92, t, { arms: lerp(0.5, 1, arms), speak: 0.4 + arms * 0.6, edge: C('hush', 6) });
      // light gathering into the bell: motes drawn in toward it
      for (let k = 0; k < 40; k++) { const u = frac(t * 0.8 + ih(k, 1, 851)), a = ih(k, 2, 851) * TAU, rr = (1 - u) * 120; put(fl(r.slit[0] + Math.cos(a) * rr), fl(r.slit[1] + Math.sin(a) * rr * 0.7), u > 0.7 ? WHITE : C('fire', 6)); }
      glow(r.slit[0], r.slit[1], 30 + arms * 50, tab('#ffd080', true), 0.3 + arms * 0.4);
      shk(arms * 1.2);
    });

    // 34 — the light in the fog (4:52): the Bellwether turns; something walks out of the white — a knight with a lantern,
    // one heavy step at a time — "Step away from them." Close on the helm: the eyes flare. Black.
    const VSTEPS = [292.2, 293.4, 294.6, 295.8], STING = 297.2, BLACK = 298.5;
    function vesperScene(t, cx, sh, o) {
      drained(t, cx, { footR: 400 });
      fallen(t);
      for (let k = 0; k < 8; k++) if (HB.HLX[k] > 300) hollowFig(sx(HB.HLX[k] - 54 + (t > 295 ? (t - 295) * 8 : 0)), HB.HLY[k], 1, -1, t, { seed: k + 3, reach: 0.2, glitch: t > 296 ? 0.5 : 0.2 });
      const n = VSTEPS.filter((s_) => t >= s_).length, last = n ? t - VSTEPS[n - 1] : 9, st = clamp((t - 291.6) / 1.2, 0, 4.4);
      const vx = lerp(40, 128, st / 4.4), vs = lerp(1.15, 1.5, st / 4.4), ph = st * PI;
      // the fog bank on the left: white, rolling, and the knight walking out of it
      const fogEdge = sx(vx) + 30 + Math.sin(t * 0.8) * 6;
      for (let y = 0; y < H; y++) for (let x = 0; x < Math.min(W, fogEdge + 60); x++) { const nn = fbm(x * 0.6 + t * 8, y * 1.2, 30, 2, 861), a = clamp((fogEdge - x) / 70 + (nn - 0.5) * 0.8, 0, 1); if (a > 0) tintI(y * W + x, x, y, tab('#ece8f6', true), a * 0.95); }
      LIGHT.x = 0.6; LIGHT.y = -0.6;
      const r = vesperFig(sx(vx), DY + 4, vs, t, { f: 1, ph, sil: clamp(1 - st / 3.4, 0.45, 1), eyes: t > 296.0 ? 0.7 : 0.35, edge: C('lav', 6) });
      // the fog curling round his legs, in front of him
      for (let y = DY - 26; y < DY + 10; y++) for (let x = fl(sx(vx) - 30); x < sx(vx) + 40; x++) { if (x < 0 || x >= W) continue; const nn = fbm(x * 0.8 + t * 14, y * 1.6, 14, 2, 862), a = clamp((y - (DY - 26)) / 30 * 0.8 + (nn - 0.55) * 1.2, 0, 0.85) * clamp(1 - st / 5, 0.3, 1); if (a > 0.05) tintI(y * W + x, x, y, tab('#ece8f6', true), a); }
      if (last < 0.5) { dustRing(sx(vx) + 6, DY + 4, last, 0.8, 871 + n, R.hush); for (let k = 0; k < 10; k++) { const [px, py] = arc(sx(vx) + 6, DY + 2, (ih(k, 1, 875 + n) - 0.5) * 80, -40 - ih(k, 2, 875 + n) * 40, 300, last); put(fl(px), fl(py), C('hush', 7)); } }
      tipUp(sh, t);
      const turn = sstep(292.6, 294.4, t), bx = sx(bellStep(t));
      LIGHT.x = -0.5 + turn * 0.2; LIGHT.y = -1;
      if (!o || !o.noBell) bellwether(bx, DY + 2 + sh, 0.92, t, { arms: 1 - turn * 0.35, speak: 0.6 - turn * 0.3, edge: C('hush', 6) });
      glow(r.lamp[0], r.lamp[1] + sh, 30, tab('#c8a0ff', true), 0.3);
      return { last, vx, r };
    }
    // the Bellwether stops; turns its bell; far off in the white, a lantern
    shot(292.0, 294.0, (lt, t) => {
      const v = vesperScene(t, 100, 30);
      shk(v.last < 0.25 ? 1.4 * (1 - v.last / 0.25) : 0);
    });
    // closer: the knight walks out of the fog over the fallen two, one heavy step at a time — "Step away from them."
    shot(294.0, STING, (lt, t) => {
      const sh = 30, v = vesperScene(t, 40, sh, { noBell: false });
      view(lerp(sx(v.vx) + 80, sx(v.vx) + 60, eio(lt / 3.2)), lerp(160, 156, eio(lt / 3.2)), lerp(1.3, 1.45, eio(lt / 3.2)));
      shk(v.last < 0.25 ? 2 * (1 - v.last / 0.25) : 0);
    });
    shot(STING, 300, (lt, t) => {
      if (t >= BLACK) { BUF.fill(BLACK); return; }
      BUF.fill(C('ink', 1));
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const nn = fbm(x * 0.5 + t * 10, y * 1.1, 26, 2, 881); BUF[y * W + x] = soft(R.dusk, 0.6 + nn * 1.6 + (1 - Math.abs(y - 135) / 135) * 0.4, x, y); }
      const flare = Math.min(1.25, eob(lin(STING, STING + 0.2, t)) * 1.15) * (1 - lin(STING + 0.7, BLACK, t) * 0.35);
      LIGHT.x = 0.5; LIGHT.y = -0.7; ENV.edge = C('lav', 6);
      const r = bust('vesper', { t, eyes: Math.min(1, flare) }, 244, H - 22 + 10 - fl(lt * 4), 3, 1);
      ENV.edge = null;
      // the flare: a burst of violet light from each eye, a horizontal streak
      for (const e of [[244 + (2 - 8 + 0.5) * 3, r.head[1] - 1.5], [244 + (2 + 7 + 0.5) * 3, r.head[1] - 1.5]]) {
        glow(e[0], e[1], 40 * flare + 4, tab('#c890ff', true), 0.7 * flare);
        const L = 120 * flare; for (let x = -L; x <= L; x++) { const a = 1 - Math.abs(x) / Math.max(1, L); if (ih(fl(x), 1, 891) < a) put(fl(e[0] + x), fl(e[1]), a > 0.6 ? WHITE : C('violet', 6)); }
        for (let k = 0; k < 8; k++) { const an = k / 8 * TAU, l = 30 * flare * (k & 1 ? 0.5 : 1); line(e[0], e[1], e[0] + Math.cos(an) * l, e[1] + Math.sin(an) * l, C('lav', 7)); }
      }
      // embers of violet drifting
      for (let k = 0; k < 30; k++) { const u = frac(t * 0.3 + ih(k, 1, 892)), x = ih(k, 2, 892) * W, y = H - u * H; put(fl(x), fl(y), C('violet', 5 + (k & 1))); }
      fade(lin(STING + 0.9, BLACK, t));
    }, {});
  }

  /* ================================================================ COLD OPEN — the shrine above Emberwick, years ago */
  // poses: a side-view run (or walk) cycle at phase ph, k = stride in sprite px
  function runPose(P, ph, k, B) {
    const s = Math.sin(ph), c = Math.cos(ph);
    P.legs = [{ foot: [s * k, -Math.max(0, c) * k * 0.55] }, { foot: [-s * k, -Math.max(0, -c) * k * 0.55] }];
    P.arms = P.arms || [{ a: -s * 0.95, b: 0.7 }, { a: s * 0.95, b: 0.7 }];
    P.hip = -B.leg + Math.abs(s) * k * 0.12 - 0.5; P.lean = (P.lean || 0) + 1; P.wind = (P.wind || 0) + 1.5;
    return P;
  }
  const FIRE = [205, 206], MIRA_X = 236, SABLE_X = 268, FLOOR = 208;
  const FREEZE = 30.6;
  // the shrine stage at 1×: sky, ridges, the village below, the wet stone platform, the gate, lanterns and the fire
  function shrineStage(t, o) {
    o = o || {}; const rt = o.freeze !== undefined ? Math.min(t, o.freeze) : t;
    vgrad(0, 160, R.night, 0.8, 2.6);
    glow(352, 58, 60, tab('#8fa4d8', true), 0.3);
    fillEll(352, 58, 9, 9, 0, (x, y, u, v) => cel(R.hush, 6 - (u + v) * 0.9 - (Math.hypot(u - 0.3, v + 0.2) < 0.25 ? 1 : 0), x, y));
    cloudBank(78, 10, 6, R.night, 2.0, 3, rt, 1.5); cloudBank(44, 7, 7, R.dusk, 1.6, 5, rt, 1);
    ridge(140, 40, 70, 4, R.night, 1.4, 11, 0.8);
    ridge(160, 26, 50, 3, R.ink, 2.6, 17, 1);
    // three terraces of the village, far to near
    const T3 = [[146, -1.1, 18, 0.5], [162, -0.6, 24, 0.55], [180, 0, 32, 0.6]];
    T3.forEach(([yb, sh, w0, lit], row) => {
      for (let y = yb; y < yb + 30; y++) for (let x = 0; x < W; x++) BUF[y * W + x] = cel(R.ink, 1.6 + sh * 0.6 + (y - yb) / 40, x, y);
      for (let k = 0; k < 18; k++) {
        const x = -10 + k * (w0 * 1.3) + (row % 2) * w0 * 0.6 + ih(k, row, 71) * 8, w = w0 * (0.8 + ih(k, row, 72) * 0.4), h = w * 0.45;
        if (ih(k, row, 75) < 0.22) { fillEll(x, yb - h * 0.6, w * 0.4, h * 0.85, 0, (xx, yy, u, v) => cel(R.moss, 0.6 + sh * 0.5 - v * 0.8 + (vn(xx, yy, 2, 76) > 0.6 ? 0.6 : 0), xx, yy)); continue; }
        house(x, yb, w, h, h * 0.6, { seed: k + row * 19, shade: sh, lit, chimney: ih(k, row, 74) < 0.35 });
      }
    });
    // the lantern-lit stair climbing up to the shrine
    for (let k = 0; k < 9; k++) { const sx = 300 + Math.sin(k * 0.8) * 7, sy = 196 - k * 6; glow(sx, sy, 5, tab('#ffb060', true), 0.6); put(fl(sx), fl(sy), C('fire', 6)); }
    for (const [lx, ly] of LAMPS) if (ih(lx, ly, 9) < 0.04) glow(lx, ly, 6, tab('#ff9a40', true), 0.22);
    fog(132, 168, tab('#4a4f88'), 0.25, rt, 3);
    // the platform: wet stone flags, the fire's light pooled and its reflection broken by the rain
    for (let y = 188; y < H; y++) {
      const d = (y - 184) / 86, rowH = fl(Math.log(y - 182) * 7);
      for (let x = 0; x < W; x++) {
        const u = (x - 240) / (0.5 + d * 2.0), joint = Math.abs(frac(u / 18) - 0.5) > 0.46 || (Math.log(y - 182) * 7) % 1 < 0.13;
        const v = 1.5 + d * 1.2 + (joint ? -1 : 0) + (ih(fl(u / 18), rowH, 81) - 0.5) * 0.6, fd = Math.hypot((x - FIRE[0]) / 1.6, y - FIRE[1]);
        const wob = Math.sin(y * 1.7 + rt * 9) * 2, rx = Math.abs(x - FIRE[0] + wob), rf = o.fire !== 0 && rx < 12 && y > FIRE[1] + 6 && !joint && ih(fl((x + wob) / 2), y, fl(rt * 8)) < 0.55 ? (1 - rx / 12) * (1 - (y - FIRE[1] - 6) / 50) * 3.2 : 0;
        BUF[y * W + x] = rf > 0.5 ? cel(R.ember, 1.4 + rf, x, y) : cel(R.stone, v * 0.8 + (o.fire !== 0 ? Math.max(0, 1 - fd / 70) * 1.2 : 0), x, y);
      }
    }
    // the gate: two red pillars with stone feet, a black lintel with gold caps, paper charms tied on with rope
    for (const x0 of [148, 324]) {
      for (let y = 96; y < 214; y++) for (let x = x0; x < x0 + 10; x++) BUF[y * W + x] = cel(R.crimson, 2.4 - (x - x0) / 10 * 1.6 + (x - x0 < 2 ? 1.6 : 0) + ((y % 30) < 1 ? -1 : 0), x, y);
      for (let y = 206; y < 216; y++) for (let x = x0 - 3; x < x0 + 13; x++) BUF[y * W + x] = cel(R.stone, 2.6 - (x - x0) / 16 + (y === 206 ? 1 : 0), x, y);
      for (let k = 0; k < 3; k++) { const px = x0 + 2 + k * 3, py = 132 + k * 5; for (let y = 0; y < 7; y++) put(px, py + y, y === 0 ? C('linen', 4) : C('linen', 6)); }
    }
    for (let y = 92; y < 104; y++) for (let x = 132; x < 350; x++) BUF[y * W + x] = cel(R.ink, 1.2 + (y < 94 ? 1.4 : 0) + (y > 101 ? -0.6 : 0), x, y);
    for (let y = 106; y < 111; y++) for (let x = 140; x < 342; x++) BUF[y * W + x] = cel(R.ink, 1.6 + (y === 106 ? 1 : 0), x, y);
    for (const x0 of [130, 344]) for (let y = 90; y < 104; y++) for (let x = x0; x < x0 + 8; x++) BUF[y * W + x] = cel(R.gold, 3.6 - (y - 90) / 10, x, y);
    lantern(178, 128, 5, rt, 1); lantern(296, 126, 6, rt, 2);
    fireBowl(rt, o.fire);
  }
  // the fire bowl and its flame (drawn again in front of anyone passing behind it)
  function fireBowl(rt, fo, again) {
    fillPoly([[FIRE[0] - 5, FIRE[1] + 3], [FIRE[0] + 5, FIRE[1] + 3], [FIRE[0] + 7, FIRE[1] + 8], [FIRE[0] - 7, FIRE[1] + 8]], (x, y) => cel(R.stone, 2.4 - (x - FIRE[0]) / 10, x, y));
    fillEll(FIRE[0], FIRE[1], 11, 5, 0, (x, y, u, v) => (v < -0.2 ? -1 : cel(R.bronze, 4 - v * 2.2 - u * 0.8 + (Math.abs(v - 0.1) < 0.15 ? 1.2 : 0), x, y)));
    fillEll(FIRE[0], FIRE[1] - 1, 10, 2, 0, (x, y, u) => cel(R.ember, 3 + (1 - Math.abs(u)) * 2 + ih(x, y, fl(rt * 6)) * 1.2, x, y));
    if (fo !== 0) fire(FIRE[0], FIRE[1] - 1, 14 * (fo === undefined ? 1 : fo), rt, 4, again ? { glow: false, sparks: 0 } : undefined);
  }
  // after the figures: embers, rain (or rain hanging in the air), the night's cool cast
  function shrineAfter(t, o) {
    o = o || {};
    if (o.fire !== 0) embers(FIRE[0], FIRE[1] - 8, 30, 16, t, 7);
    rain(t, 220, 0.18, FLOOR + 6, o.freeze !== undefined && t > o.freeze ? o.freeze : undefined);
  }
  // the two of them by the fire. P0/P1: extra pose fields for Mira and Sable; the fire lights the sides that face it
  function mira(t, P, x, y, S, f) {
    LIGHT.x = x > FIRE[0] ? -1 : 1; LIGHT.y = -0.3; ENV.edge = C('fire', 5);
    const r = actor(MIRA, Object.assign({ t, propFar: (A) => lanternArt(A.hand[0], A.hand[1] + 1, t, P.lamp !== false) }, P), x, y, S || 1, f === undefined ? 1 : f);
    ENV.edge = null; return r;
  }
  function sable(t, P, x, y, S, f) {
    LIGHT.x = x > FIRE[0] ? -1 : 1; LIGHT.y = -0.3; ENV.edge = C('fire', 5);
    const r = actor(SABLE, Object.assign({ t }, P), x, y, S || 1, f === undefined ? -1 : f);
    ENV.edge = null; return r;
  }
  // Sable kneels on one knee, the sword across her lap, tying a red cord round the grip
  const KNEEL = { hip: -15, legs: [{ knee: [9, -9], foot: [9, 0] }, { knee: [-3, -1], foot: [-13, -1] }] };
  const kneelSword = (A, t) => swordArt(A.hand[0] - 1, A.hand[1] + 1, -PI / 2 - 0.55, 28, false);

  // a close-up's background: the stage seen nearer, out of focus (the frame px it covers, the blur radius)
  function closeBg(stage, fx, fy, Z, k) { stage(); view(fx, fy, Z); defocus(k || 3); }
  // rain in front of a close-up: big near drops, a few running down, all in focus (frozen: hang in the air)
  function nearRain(t, n, frozen) {
    const tt = frozen === undefined ? t : frozen;
    for (let k = 0; k < n; k++) {
      const sp = 330 + ih(k, 1, 61) * 160, x0 = ih(k, 2, 61) * (W + 60) - 30, y = ((tt * sp + ih(k, 3, 61) * 500) % (H + 60)) - 30, x = x0 + y * 0.18, len = frozen === undefined ? 16 : 3;
      for (let j = 0; j < len; j++) put(fl(x - j * 0.18), fl(y - j), j < 2 ? C('sky', 7) : C('sky', 5));
      if (frozen !== undefined) { put(fl(x) + 1, fl(y) - 1, C('fire', 6)); put(fl(x), fl(y) + 1, C('sky', 4)); }
    }
  }
  // the bust of a speaker by the fire: firelight from one side (side = +1: the fire is to the right of frame)
  function fireBust(who, t, P, x, y, f, side) {
    LIGHT.x = side; LIGHT.y = -0.25; ENV.edge = C('fire', 5);
    const r = bust(who, Object.assign({ t }, P), x, y, P.S || 3, f);
    ENV.edge = null; return r;
  }


  /* ---------------------------------------------------------------- the shrine scene, acted (0:17–0:32)
     Every character drawing is held on twos (ON2) and every move is keyed: anticipation, action, overshoot, settle. */
  // Mira's run: eight drawings (contact, down, passing, up, then the same off the other foot), two frames each
  const MRUN = [
    { hip: -15, lean: 2, legs: [{ foot: [6, 0] }, { foot: [-6, -4] }], arms: [{ a: -0.9, b: 1.0 }, { a: 1.1, b: 1.0 }] },
    { hip: -13.5, lean: 3, legs: [{ foot: [3, 0] }, { foot: [-4, -6] }], arms: [{ a: -0.6, b: 1.1 }, { a: 0.8, b: 1.1 }] },
    { hip: -14.5, lean: 3, legs: [{ foot: [-1, 0] }, { foot: [1, -7] }], arms: [{ a: 0, b: 1.0 }, { a: 0.1, b: 1.0 }] },
    { hip: -16.5, lean: 2, legs: [{ foot: [-5, -1] }, { foot: [5, -4] }], arms: [{ a: 0.9, b: 1.0 }, { a: -0.8, b: 1.0 }] },
  ];
  const mrun = (i) => { const D = MRUN[i % 4]; if (i % 8 < 4) return D; return Object.assign({}, D, { legs: [D.legs[1], D.legs[0]], arms: [D.arms[1], D.arms[0]] }); };
  // where she is: running in, then the skid
  const MX = [[17.0, 150], [18.1, 226, 'lin'], [18.42, 236, 'out']];
  const miraX = (t) => key(MX, t);
  // the hops of "I wrote it!": [time, height above the floor, squash (hip offset)]
  const MHOP = [[18.42, 0], [19.08, 0], [19.14, 0, 'lin'], [19.26, 5, 'out'], [19.36, 0, 'in'], [19.5, 0], [19.56, 3, 'out'], [19.66, 0, 'in']];
  const MSQ = [[18.1, 0], [18.18, 3, 'out'], [18.42, 2], [18.47, -1.5, 'out'], [18.6, 0], [19.08, 0], [19.14, 2.5, 'out'], [19.2, -1.5], [19.36, 0], [19.4, 3, 'out'], [19.5, 0, 'back'], [19.66, 0], [19.7, 2, 'out'], [19.8, 0, 'back']];

  // 3 — the shrine (0:17): Mira runs up the last steps out of the rain, skids, and bursts out with it
  shot(17.0, 19.95, (lt, t) => {
    const q = ON2(t);
    shrineStage(t);
    // Sable, kneeling, tying the red cord round her grip until she hears her name; her head comes up first, then her shoulders
    const up = key([[18.5, 0], [18.66, 1, 'out']], q), sit = key([[18.6, 0], [18.8, 1, 'back']], q), sm = key([[18.9, 0.15], [19.4, 0.75]], q);
    const tie = (1 - sstep(18.5, 18.6, q)), loop = fl(q * 7.5) % 4;
    const SB = blinkK(q, 3);
    sable(t, Object.assign({}, KNEEL, { lean: Math.round(-1 + sit), headY: Math.round(1 - up), headX: Math.round(up * (q > 19.3 ? 1 : 0)), face: { eyes: SB || (up > 0.5 ? 'open' : 'half'), brows: up > 0.5 ? 'up' : 'n', smile: sm, mouth: mouth('sable', q) }, arms: [{ hand: [10 + [0, 1, 1, 0][loop] * tie, -17 - [0, 0, 1, 1][loop] * tie] }, { hand: [5 + [1, 0, 0, 1][loop] * tie, -16] }], prop: kneelSword }), SABLE_X, FLOOR);
    // Mira
    const x = miraX(q), run = q < 18.1, skid = q >= 18.1 && q < 18.42, hop = key(MHOP, q), sq = key(MSQ, q);
    let P;
    if (run) P = Object.assign({ face: { eyes: 'wide', smile: 0.7, blush: 1 } }, mrun(fl(q * 15)));
    else if (skid) P = { hip: -16 + sq, lean: -3, wind: 2, face: { eyes: 'wide', smile: 0.4, blush: 1, mouth: 0.3 }, legs: [{ foot: [8, 0] }, { foot: [-3, 0] }], arms: [{ a: 2.0, b: 0.3 }, { a: 1.6, b: 0.3 }] };
    else {
      const tk = talking('mira', q), burst = key([[18.42, 0], [18.5, 1, 'out'], [18.9, 1], [19.05, 0.3]], q), air = hop > 0.5;
      P = { hip: -16 + sq, lean: Math.round(burst), face: { eyes: blinkK(q, 4) || (tk || burst > 0.5 ? 'wide' : 'open'), mouth: mouth('mira', q), smile: 0.8, blush: 1 },
        arms: burst > 0.5 ? [{ a: 2.9, b: 0.2 }, { a: 2.4, b: 0.3 }] : air ? [{ a: 2.3, b: 0.4 }, { a: 1.8, b: 0.6 }] : [{ a: 1.5, b: 1.6 }, { a: 0.9, b: 1.2 }],
        legs: air ? [{ foot: [3, -3] }, { foot: [-3, -2] }] : [{ foot: [3, 0] }, { foot: [-3, 0] }] };
    }
    // her lantern swings from her far hand, a pendulum driven by her own run and stop
    const sw = pendulum(miraX, 17.0, q, 7, 2.2);
    P.propFar = (A) => lanternArt(A.hand[0], A.hand[1] + 1, t, true, sw);
    mira(t, P, Math.round(x), FLOOR + 1 - Math.round(hop));
    if (x > 186 && x < 226) fireBowl(t, 1, true);
    if (skid) for (let k = 0; k < 7; k++) { const g = (q - 18.1) / 0.32; put(fl(x - 4 - k * 2 - g * 3), fl(FLOOR + 1 - (k & 1) - ih(k, fl(q * 15), 31) * 4 * (1 - g)), C('sky', 6 + (k & 1))); }
    if (q >= 18.1 && q < 18.2) shk(1);
    shrineAfter(t); splashes(t, FLOOR - 2, H, 18, 3);
    // the camera picks her up on the stair and runs with her, overshooting a touch as she stops
    const cx = key([[17.0, 196], [18.2, 247, 'io'], [18.5, 244, 'back'], [19.95, 246]], t);
    view(cx, 171, 2);
  });

  // 3b — Mira, close (0:20): "…I wrote my name on the wall, just like you showed me!" — she points back at it,
  // swings round to Sable, clasps her hands and bounces
  shot(19.95, 23.4, (lt, t) => {
    const q = ON2(t);
    closeBg(() => shrineStage(t), key([[19.95, 252], [23.4, 260]], t), 168, 3, 3);
    const turn = key([[20.05, 0], [20.3, -1.2, 'out'], [20.4, -1], [21.15, -1], [21.32, 0.5, 'out'], [21.45, 0.2, 'io']], q);
    const point = key([[20.05, 0], [20.38, 1, 'back'], [21.12, 1], [21.35, 0, 'in']], q), pump = accent('mira', q) * (q < 21.2 ? 1 : 0);
    const clasp = key([[21.38, 0], [21.6, 1, 'back'], [22.9, 1], [23.3, 0.7]], q);
    const beam = key([[22.2, 0], [22.3, 1, 'out']], q), tilt = key([[20.0, 0], [21.5, 0], [22.35, 0.13, 'back'], [23.4, 0.09]], q) + accent('mira', q) * 0.05;
    const bounce = q > 21.38 && q < 22.5 ? accent('mira', q) * 4 : 0, land = key([[19.95, -3], [20.02, 1, 'in'], [20.12, 0, 'back']], q);
    const hands = [];
    if (point > 0.02) hands.push({ from: [-14, 8], at: [lerp(-12, -21, point), lerp(8, -20, point) - pump * 2], pose: 'point', dir: [-0.5, -0.86] });
    if (clasp > 0.02) { hands.push({ from: [-12, 8], at: [lerp(-12, -4, clasp), lerp(10, -17, clasp)], pose: 'fist' }); hands.push({ from: [14, 8], at: [lerp(14, 8, clasp), lerp(10, -17, clasp)], pose: 'fist' }); }
    const F = { eyes: blinkK(q, 4) || (beam > 0.5 ? 'happy' : q < 21.3 ? 'wide' : 'wide'), look: q < 21.25 ? -2 : 1, mouth: mouth('mira', q), ee: syllable('mira', q) % 2, smile: beam > 0.5 ? 1 : 0.5, blush: 1, browUp: Math.round(accent('mira', q)) };
    const yb = Math.round(-bounce + land), sqz = q > 21.38 && q < 22.5 ? 1 - Math.max(0, accent('mira', q - 0.12) - 0.5) * 0.1 : land > 0.5 ? 0.95 : 1;
    fireBust('mira', t, { face: F, turn, tilt, hands, sy: sqz, sx: 2 - sqz, strings: Math.round(springTo((tt) => -bounce * 0.3 + turn * 2, 19.95, q, 120, 9)), fringe: Math.round(turn * -0.6) }, 200 + Math.round(key([[19.95, 0], [23.4, -4]], t)), H - 22 + 6 + yb, 1, 1);
    glow(110, 210, 50, tab('#ffb050', true), 0.3);
    nearRain(t, 40);
  });

  // 4 — Sable, close (0:23): she watches, her smile grows, a quiet laugh, then warmly — "Then the wall will remember you."
  function sableClose(t, q, P, o) {
    o = o || {};
    closeBg(() => shrineStage(t, o.stage), o.fx || 226, o.fy || 168, 3, 3);
    fireBust('sable', t, P, 296 + (o.dx || 0), H - 22 + 4 + (o.dy || 0), -1, -1);
    nearRain(t, o.rain || 36, o.frozen);
  }
  shot(23.4, 27.15, (lt, t) => {
    const q = ON2(t);
    const sm = key([[23.4, 0.25], [24.2, 0.6], [24.55, 1, 'out'], [25.3, 1], [25.5, 0.7]], q), laugh = q > 24.55 && q < 25.3;
    const tilt = key([[23.4, 0.02], [24.55, 0.02], [24.7, -0.09, 'out'], [25.25, -0.06], [25.45, 0.07, 'back'], [27.15, 0.06]], q) + accent('sable', q) * 0.05;
    const shake = laugh ? (fl(q * 15) % 2 ? -1 : 0) : 0, breath = key([[24.1, 0], [24.4, -1, 'io'], [24.55, 0]], q);
    const eyes = blinkK(q, 5) || (laugh ? 'happy' : q < 24.4 ? 'open' : 'half');
    sableClose(t, q, { face: { eyes, look: q < 24.5 ? 1 : 0, smile: sm, mouth: laugh ? 0 : mouth('sable', q), ee: syllable('sable', q) % 2, browUp: q > 25.4 ? 1 : 0 }, tilt, turn: key([[25.3, 0], [25.6, -0.5]], q), headY: Math.round(accent('sable', q)) }, { dy: shake + breath, dx: Math.round(key([[23.4, 2], [27.15, -1]], t)) });
  });

  // 4b — the two of them (0:27): "Even when I'm old and forgetful." She reaches over in an arc and pats the hood twice
  const PAT = [[27.15, [9, -17]], [27.35, [7, -14], 'io'], [27.58, [22, -30], 'out'], [27.72, [33, -42], 'out'], [27.82, [32, -39], 'back'],
    [28.0, [32, -42], 'out'], [28.08, [32, -38], 'in'], [28.32, [32, -42], 'out'], [28.4, [32, -38], 'in'],
    [28.6, [30, -39]], [28.8, [34, -39]], [29.0, [31, -39]], [29.2, [33, -39]], [29.45, [32, -40]], [29.75, [21, -28], 'io'], [29.95, [9, -17], 'out']];
  const PAT_HIT = [27.82, 28.08, 28.4];
  shot(27.15, 30.0, (lt, t) => {
    const q = ON2(t);
    shrineStage(t);
    const hand = key(PAT, q), away = q > 27.4 && q < 29.85, reach = key([[27.3, 0], [27.7, 2, 'out'], [29.5, 2], [29.95, 0]], q);
    // each landing pushes her down a pixel and squeezes her eyes shut; she giggles and leans into it
    let hit = 0; for (const h of PAT_HIT) { const d = q - h; if (d >= 0 && d < 0.14) hit = 1; }
    const giggle = q > 28.45 && q < 29.4 ? (fl(q * 7.5) % 2) : 0, after = key([[29.5, 0], [29.8, 1, 'out']], q);
    mira(t, { hip: -16 + hit + giggle, lean: q > 28.5 && q < 29.5 ? 1 : 0, headY: hit, face: { eyes: hit || (q > 27.8 && q < 29.6) ? 'happy' : blinkK(q, 4) || 'open', smile: 1, blush: 1, mouth: giggle ? 0.2 : 0 }, arms: [{ a: 0.5 + after * 0.6, b: 0.6 + after * 0.6 }, { a: 0.3, b: 0.4 }], legs: [{ foot: [3, 0] }, { foot: [-3, 0] }], propFar: (A) => lanternArt(A.hand[0], A.hand[1] + 1, t, true, pendulum((tt) => (giggle ? 0.6 : 0) + hit * 0.8 + tt * 0, 27.15, q, 7, 2) + Math.sin(q * 3) * 0.12) }, MIRA_X, FLOOR + 2);
    const shakeHead = q > 28.9 && q < 29.25 ? (fl(q * 7.5) % 2 ? 1 : -1) : 0;
    sable(t, Object.assign({}, KNEEL, { lean: Math.round(reach), headX: shakeHead, face: { eyes: blinkK(q, 3) || 'half', smile: 0.75, mouth: mouth('sable', q) }, arms: [{ hand, bend: -1 }, { hand: [5, -16] }], prop: away ? undefined : kneelSword, propFar: away ? (A) => swordArt(A.hand[0] - 1, A.hand[1] + 1, -PI / 2 - 0.55, 28, false) : undefined }), SABLE_X, FLOOR);
    shrineAfter(t); splashes(t, FLOOR - 2, H, 18, 3);
    view(key([[27.15, 254], [30.0, 250]], t), key([[27.15, 180], [30.0, 178]], t), 3);
  });

  // 5 — the rain stops in the air (0:30). She hasn't noticed; then she has: the smile goes, the eyes go up, the head follows
  shot(30.0, 32.4, (lt, t) => {
    const q = ON2(t), o = { freeze: FREEZE };
    const sm = key([[30.85, 0.6], [30.95, 0, 'in']], q), alarm = key([[31.05, 0], [31.4, 1, 'back']], q);
    const breathe = q < FREEZE ? (Math.sin(q * 2.4) > 0.3 ? -1 : 0) : 0;
    const F = { eyes: q < 30.95 ? (blinkK(q, 6) || 'half') : q < 31.15 ? 'open' : 'wide', look: q < 30.95 ? 1 : 0, lookY: q >= 30.95 ? -1 : 0, brows: q > 31.15 ? 'worried' : 'n', smile: sm };
    sableClose(t, q, { face: F, tilt: lerp(0.05, -0.15, alarm), turn: alarm * 0.4, headY: -Math.round(alarm * 2) }, { stage: o, frozen: t > FREEZE ? FREEZE : undefined, rain: 60, dy: breathe - Math.round(key([[31.2, 0], [32.4, 3]], t)), dx: Math.round(key([[31.2, 0], [32.4, 2]], t)), fy: key([[30.0, 168], [32.4, 162]], t) });
    if (t > FREEZE) tintAll(tab('#8090c0', true), Math.min(0.12, (t - FREEZE) * 0.08));
  });

  /* ================================================================ COLD OPEN, the beginning: the name on the wall, the run up the hill */
  // 1 — the chalk (0:00): wet planks, the street's lanterns out of focus behind; a small hand writes MIRA, then she steps back
  const NAME = { x0: 214, y0: 74, sc: 9 };
  function plankWall(t, wx0) {
    // the gap to the street: night, lantern light in soft round bokeh
    for (let y = 0; y < H; y++) for (let x = 0; x < wx0 + 30; x++) BUF[y * W + x] = cel(R.night, 0.9 + y / H * 0.9, x, y);
    for (let k = 0; k < 9; k++) {
      const bx = 18 + ih(k, 1, 131) * (wx0 - 20), by = 30 + ih(k, 2, 131) * 210, r = 9 + ih(k, 3, 131) * 15, warm = ih(k, 4, 131) < 0.75;
      fillEll(bx, by, r, r, 0, (x, y, u, v) => { const d = Math.hypot(u, v); return cel(warm ? R.ember : R.sky, (warm ? 3.6 : 2.4) + (d > 0.82 ? 0.9 : 0) - (u + v) * 0.3, x, y); });
      glow(bx, by, r * 1.9, warm ? tab('#ff8a3a', true) : tab('#7aa0e0', true), 0.22);
    }
    // the planks: slanting a little away from us, grain, seams, nail heads, wet streaks, moss at the foot
    for (let y = 0; y < H; y++) for (let x = wx0 + fl((y - 135) * -0.07); x < W; x++) {
      const u = x - wx0 + y * 0.07, plank = fl(u / 38), pu = frac(u / 38), seam = pu < 0.045, grain = vn(u * 0.35, y * 0.045 + plank * 50, 3, 133);
      const streak = vn(u * 0.6, y * 0.012 - t * 0.02, 1, 136) > 0.78 ? 0.7 : 0, moss = y > 236 - vn(u, 0, 9, 137) * 14 ? 1 : 0;
      let v = 1.7 + grain * 1.3 + (ih(plank, 1, 134) - 0.5) * 0.7 - (seam ? 1.4 : pu < 0.09 ? 0.5 : 0) + streak + (x < wx0 + 6 ? 0.8 : 0) + (frac(grain * 5) < 0.12 ? -0.4 : 0);
      BUF[y * W + x] = moss ? cel(R.moss, 0.8 + grain * 0.8, x, y) : cel(R.wood, v, x, y);
      if ((Math.abs(pu - 0.5) < 0.04) && (Math.abs(y - 28) < 1.5 || Math.abs(y - 246) < 1.5)) BUF[y * W + x] = C('stone', Math.abs(y - 28) < 0.6 || Math.abs(y - 246) < 0.6 ? 5 : 3);
    }
    // rainwater running down the boards
    for (let k = 0; k < 26; k++) { const x = wx0 + 14 + ih(k, 1, 135) * 300, sp_ = 22 + ih(k, 2, 135) * 40, y0 = (t * sp_ + ih(k, 3, 135) * 400) % 330 - 30; for (let j = 0; j < 16; j++) put(fl(x + Math.sin((y0 + j) * 0.2) * 0.6), fl(y0 + j), j < 2 ? C('sky', 6) : j < 7 ? C('wood', 5) : C('wood', 4)); }
  }
  // the name in chalk, written stroke by stroke (letters: how many letters are done, 0..4), rough like real chalk
  function chalkName(letters, t, erase) {
    const s = 'MIRA', { x0, y0, sc } = NAME; let cx = x0;
    for (let k = 0; k < 4; k++) {
      const g = FONT[s[k]], gw = g[0].length, prog = clamp(letters - k, 0, 1);
      for (let j = 0; j < 7; j++) for (let i = 0; i < gw; i++) {
        if (g[j][i] !== '#') continue;
        const order = (j * gw + i) / (7 * gw); if (order > prog) continue;
        for (let yy = 0; yy < sc; yy++) for (let xx = 0; xx < sc; xx++) {
          const px = cx + i * sc + xx + Math.round(Math.sin((j * sc + yy) * 0.45 + k) * 0.8), py = y0 + j * sc + yy, n = ih(px, py, 139);
          if (n < 0.16 || (erase && ih(px >> 1, py >> 1, 141) < erase)) continue;
          put(px, py, n < 0.3 ? C('hush', 4) : n < 0.85 ? C('snow', 7) : C('hush', 6));
        }
      }
      cx += (gw + 1) * sc;
    }
    // the little heart she adds at the end
    if (letters > 4.3) for (const [i, j] of [[0, 1], [1, 0], [2, 1], [3, 0], [4, 1], [0, 2], [4, 2], [1, 3], [3, 3], [2, 4]]) { if ((i + j * 5) / 25 > (letters - 4.3) / 0.3) continue; for (let yy = 0; yy < 4; yy++) for (let xx = 0; xx < 4; xx++) if (ih(cx + i * 4 + xx, y0 + 30 + j * 4 + yy, 140) > 0.2) put(cx + 6 + i * 4 + xx, y0 + 30 + j * 4 + yy, C('snow', 7)); }
  }
  // where the chalk is now, as the letters progress
  function penAt(letters) {
    const s = 'MIRA', { x0, y0, sc } = NAME, k = Math.min(3, fl(letters)), u = frac(Math.min(letters, 3.999)); let cx = x0;
    for (let q = 0; q < k; q++) cx += (FONT[s[q]][0].length + 1) * sc;
    const gw = FONT[s[k]][0].length; return [cx + u * gw * sc, y0 + (3.5 + Math.sin(u * PI * 3) * 3) * sc];
  }
  // Mira's hand with the chalk, her yellow raincoat sleeve coming in from the lower right (drawn as a sprite, S = 2)
  function chalkHand(px, py, t) {
    sclear(); LIGHTS.x = 0.5; LIGHTS.y = 0.6;
    const T = [-40, -120], d = [0.62, 0.78], n = [-0.78, 0.62], at = (a, b) => [T[0] + d[0] * a + n[0] * b, T[1] + d[1] * a + n[1] * b];
    // the sleeve: widening down to the frame's edge, a cuff and two folds
    sPoly([at(12, -8), at(12, 9), at(150, 22), at(150, -20)], (x, y) => { const a = (x - T[0]) * d[0] + (y - T[1]) * d[1], b = (x - T[0]) * n[0] + (y - T[1]) * n[1], w = 8 + (a - 12) * 0.1; return band(R.gold, (a < 17 ? 3.4 : 4.6) + (b < -w + 4 ? 1.2 : b > w - 4 ? -1 : 0) + (Math.abs(a - 38 - b * 0.4) < 0.8 || Math.abs(a - 70 + b * 0.3) < 0.8 ? -1.2 : 0)); });
    // the fist: four knuckles toward the wall, a thumb wrapped over the chalk
    sEll(...at(8, 0.5), 8.5, 7.5, (x, y, u, v) => band(R.skin, 5 + (litOf(u, v) > 0.3 ? 1 : litOf(u, v) < -0.35 ? -1 : 0)));
    for (let q = 0; q < 4; q++) { const [kx, ky] = at(2, -5 + q * 3.3); sEll(kx, ky, 1.9, 1.9, (x, y, u, v) => band(R.skin, 5 + (u + v < -0.4 ? 1 : 0))); }
    sEll(...at(3, 6), 3.6, 2.4, (x, y, u, v) => band(R.skin, 5.4 + (v < 0 ? 0.6 : -0.4)));
    // the chalk: a short white stick worn to a blunt point at the wall
    for (let a = -1; a < 7; a += 0.5) for (let b = -1.6; b <= 1.6; b += 0.5) { const [x, y] = at(a, b + 1); sp(x, y, b < -0.6 ? C('snow', 7) : b > 0.8 ? C('hush', 3) : C('hush', 6), 2); }
    soutline(); stamp(px - T[0] * 2, py - T[1] * 2, 2, false);
    glow(px + 70, py + 110, 120, tab('#ffae55', true), 0.28);      // her lantern, just below the frame
  }
  shot(0, 7.5, (lt, t) => {
    const letters = lin(1.6, 6.0, lt) * 4.6, pull = sstep(5.7, 6.6, lt);
    plankWall(t, 150);
    chalkName(letters, t);
    if (lt > 1.4 && lt < 5.9) { const [px, py] = penAt(Math.min(letters, 3.999)); const jit = Math.sin(t * 40) * 0.6; chalkHand(px + jit, py, t); for (let k = 0; k < 6; k++) { const u = frac(ih(k, 1, 241) + t * 1.4); put(fl(px - 3 + (ih(k, 2, 241) - 0.5) * 8 - u * 5), fl(py + 3 + u * 16), u < 0.5 ? C('snow', 6) : C('hush', 3)); } }
    if (pull > 0) {
      // the focus pulls back to her: the wall goes soft, she leans into frame and grins at what she has made
      defocus(Math.round(1 + pull * 3));
      LIGHT.x = -0.8; LIGHT.y = -0.3; ENV.edge = C('fire', 5);
      bust('mira', { t, face: { eyes: lt > 6.7 ? 'happy' : 'open', smile: 1, blush: 1, look: -1 } }, Math.round(lerp(560, 392, eoc(pull))), H - 22 + 8, 3, -1);
      ENV.edge = null; glow(420, 250, 70, tab('#ffae55', true), 0.35 * pull);
    }
    rain(t, 70, 0.18);
    fade(1 - lin(0.4, 2.0, lt));
  });

  // 2 — the run (0:07): alongside her as she climbs the village stair in the rain, lantern swinging; the camera rises
  // until the whole hill is below, and the shrine's fire at the top
  const stairY = (wx) => 200 - fl(Math.max(0, wx) / 16) * 5;
  function villageSide(t, camX, camY) {
    vgrad(0, H, R.night, 0.5, 2.4);
    glow(392, 46 - camY * 0.05, 50, tab('#8fa4d8', true), 0.3); fillEll(392, 46 - camY * 0.05, 8, 8, 0, (x, y, u, v) => cel(R.hush, 6 - (u + v), x, y));
    CAM.x = camX; cloudBank(60 - camY * 0.08, 8, 9, R.night, 2.0, 3, t, 1.2);
    // the hill behind, the shrine on top of it: its red gate against the clouds, its fire, the lit stair winding up
    const HC = 470, Z = 2.5, hy = (lx) => 68 - camY / Z - Math.max(0, 90 - Math.abs(lx - HC) * 0.5) - vn(lx, 0, 30, 9) * 10;
    for (let x = 0; x < W; x++) { const lx = x + camX / Z, top = hy(lx); for (let y = Math.max(0, fl(top)); y < H; y++) BUF[y * W + x] = cel(R.ink, 1.6 + (y - top < 1.5 ? 1.2 : 0) + (vn(lx, y, 6, 12) > 0.7 ? 0.5 : 0), x, y); }
    const sx = HC - camX / Z, sy = hy(HC) + 2;
    for (let k = 0; k < 16; k++) { const u = k / 16, lx = HC + Math.sin(u * 9) * 18 - u * 6, ly = hy(HC) + 4 + u * 90; const x = lx - camX / Z; glow(x, ly, 5, tab('#ffb060', true), 0.5); put(fl(x), fl(ly), C('fire', 6)); }
    glow(sx, sy - 10, 46, tab('#ff9040', true), 0.55);
    for (const gx of [-16, 14]) for (let y = sy - 26; y < sy; y++) for (let x = sx + gx; x < sx + gx + 3; x++) put(fl(x), y, C('crimson', x === fl(sx + gx) ? 4 : 2));
    rectF(sx - 22, sy - 30, 44, 3, C('ink', 0)); rectF(sx - 19, sy - 24, 38, 2, C('ink', 1)); rectF(sx - 23, sy - 31, 4, 2, C('gold', 4)); rectF(sx + 19, sy - 31, 4, 2, C('gold', 4));
    fire(sx, sy - 1, 5, t, 9, { sparks: 6 });
    // the village's upper terraces between
    for (let row = 0; row < 2; row++) { const z = 3.2 - row * 1.0, base = 168 - camY / z + row * 14; for (let k = -2; k < 26; k++) { const lx = k * (34 + row * 10) + ih(k, row, 81) * 10, x = lx - camX / z; if (x < -40 || x > W + 40) continue; house(x, base - (lx / 16) * 5 / z * 0.8, 26 + row * 10, 12 + row * 4, 8 + row * 3, { seed: k * 7 + row, shade: -1 + row * 0.4, lit: 0.55 }); } }
    fog(110, 190, tab('#4a4f88'), 0.22, t, 3);
    // the street: houses lining the stair, eaves, paper lanterns; then the stone steps themselves, wet and shining
    for (let k = -1; k < 12; k++) {
      const hx = k * 84 + 30, x = hx - camX, base = stairY(hx) - camY - 2; if (x < -70 || x > W + 70) continue;
      house(x, base, 70, 44, 18, { seed: k + 40, shade: 0.2, lit: 0.7, chimney: k % 3 === 0 });
      lantern(x + 30, base - 50, 4, t, k);
      // a cloth sign over the door, stirring
      fillPoly([[x - 12, base - 38], [x + 4, base - 38], [x + 4 + Math.sin(t * 2 + k), base - 24], [x - 12 + Math.sin(t * 2 + k), base - 24]], (xx, yy) => cel(k % 2 ? R.indigo : R.crimson, 2.4 + (xx - x + 12 < 3 ? 1 : 0), xx, yy));
    }
    // the stair: worn treads catching the lantern light, dark risers, and the stone retaining wall beneath, in blocks
    for (let x = 0; x < W; x++) {
      const wx = x + camX, top = stairY(wx) - camY, ph = frac(Math.max(0, wx) / 16), riserCol = ph > 15 / 16;
      for (let y = Math.max(0, top); y < H; y++) {
        const d = y - top; let c;
        if (d < 2) c = cel(R.stone, 4.6 - d * 1.2 + (ih(fl(wx / 3), 0, 151) < 0.2 ? 0.8 : 0), x, y);
        else if (d < 5) c = cel(R.stone, 1.6 + (riserCol ? -0.6 : 0), x, y);
        else { const by = fl((y + camY) / 7), bx = fl((wx + (by & 1) * 6) / 12), mortar = ((y + camY) % 7 === 0) || ((wx + (by & 1) * 6) % 12 === 0);
          c = mortar ? C('ink', 2) : cel(R.stone, 1.9 + (ih(bx, by, 152) - 0.5) * 0.8 - d / 140 + (vn(wx * 0.2, y * 0.4, 3, 153) > 0.75 ? 0.7 : 0), x, y); }
        BUF[y * W + x] = c;
      }
    }
  }
  shot(7.5, 17.0, (lt, t) => {
    const mx = lerp(-30, 560, lt / 9.5), crane = eio(lin(5.6, 9.3, lt)), camX = mx - 200 + crane * 60, camY = stairY(mx) - 190 - crane * 90;
    villageSide(t, camX, camY);
    // Mira: running, lantern swinging, the hood bouncing; a splash at each footfall
    const ph = t * 15, my = stairY(mx) - camY + 1, x = mx - camX;
    LIGHT.x = 0.8; LIGHT.y = -0.5; ENV.edge = C('fire', 5);
    actor(MIRA, Object.assign(runPose({ t, face: { eyes: 'open', smile: 0.7, blush: 1 }, propFar: (A) => lanternArt(A.hand[0], A.hand[1] + 1, t, true) }, ph, 4, MIRA.body)), x, my, 1, 1);
    ENV.edge = null; glow(x - 4, my - 12, 22, tab('#ffb050', true), 0.35);
    if (Math.abs(Math.cos(ph)) > 0.9) for (let k = 0; k < 5; k++) put(fl(x + (k - 2) * 2), fl(my - 1 - Math.abs(k - 2) * 0.6 - 1), C('sky', 6));
    // the near posts and lanterns rushing past
    for (let k = -1; k < 8; k++) { const fx = k * 150 + 60 - camX / 0.55; if (fx < -20 || fx > W + 20) continue; rectF(fx, 0, 7, H, C('ink', 0)); rectF(fx + 1, 0, 1, H, C('ink', 2)); lantern(fx + 14, 46 + Math.sin(k) * 10, 7, t, k + 20); }
    rain(t, 240, 0.18);
    view(240, lerp(150, 135, crane), lerp(2, 1, crane));
  });

  /* ---------------------------------------------------------------- the Hush: a crown of glyphs, and what it erases */
  // a glyph tile: a 5×5 mark from a small alphabet of strokes, white with a pale shadow
  const GLY = ['#.#.#|.#.#.|#.#.#|.....|#####', '#####|#...#|#.#.#|#...#|#####', '..#..|.###.|#####|.###.|..#..', '#...#|.#.#.|..#..|.#.#.|#...#', '###..|#.#..|###.#|....#|..###', '.###.|#...#|.....|#...#|.###.'].map((g) => g.split('|'));
  function glyph(x, y, k, sc, c, c2) { const g = GLY[k % GLY.length]; for (let j = 0; j < 5; j++) for (let i = 0; i < 5; i++) if (g[j][i] === '#') { rectF(x + i * sc, y + j * sc, sc, sc, c); if (c2 !== undefined) rectF(x + i * sc + sc, y + j * sc + sc, sc, 1, c2); } }
  // the sigil: rings of glyph tiles on a tilted ellipse, turning; r is the radius, a 0..1 how much has appeared
  function sigil(cx, cy, r, tilt, t, a, seed) {
    if (a <= 0) return;
    glow(cx, cy, r * 1.25, tab('#e8ecff', true), 0.28 * a);
    for (let ring_ = 0; ring_ < 2; ring_++) {
      const rr = r * (1 - ring_ * 0.3), n = fl(8 + rr * 0.09) * 2, rot = t * (ring_ & 1 ? -0.12 : 0.08) + ring_;
      // a thin line joining the tiles
      for (let q = 0; q < 720; q++) { if (ih(q, ring_, seed + 1) > a) continue; const an = q / 720 * TAU; put(fl(cx + Math.cos(an) * rr), fl(cy + Math.sin(an) * rr * tilt), Math.sin(an) > 0 ? C('hush', 5) : C('hush', 3)); }
      for (let k = 0; k < n; k++) {
        if (ih(k, ring_, seed) > a * 1.2) continue;
        const ang = k / n * TAU + rot, x = cx + Math.cos(ang) * rr, y = cy + Math.sin(ang) * rr * tilt, sc = Math.max(1, Math.round(rr / 70 * (0.75 + 0.35 * Math.sin(ang))));
        glyph(fl(x - sc * 2.5), fl(y - sc * 2.5), k + ring_ * 7 + seed, sc, k % 5 === 2 ? C('crimson', 5) : WHITE, C('hush', 3));
      }
    }
  }
  // erase: wherever amt(x, y) ≥ 0.85 the picture loses its colour and becomes a pale unpainted sketch of itself
  // (its edges kept as faint lines); in between it washes toward white; flecks of crimson glyph-dust on the boundary
  const HUB = new Uint8Array(NP);
  function hush(amt, t, flecks) {
    HUB.set(BUF);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const a = amt(x, y); if (a <= 0) continue;
      const i = y * W + x, l = LUM[HUB[i]];
      if (a >= 0.85) {
        const lr = x < W - 1 ? LUM[HUB[i + 1]] : l, ld = y < H - 1 ? LUM[HUB[i + W]] : l, e = Math.max(Math.abs(l - lr), Math.abs(l - ld));
        BUF[i] = e > 60 ? C('hush', e > 110 ? 1 : 3) : cel(R.hush, 3.2 + l / 255 * 4.6, x, y);
      } else tintI(i, x, y, tab('#f4f6fc', true), a * 0.9);
      if (flecks !== false && a > 0.3 && a < 0.85 && ih(x >> 1, y >> 1, fl(t * 14)) < 0.035) BUF[i] = ih(x, y, 3) < 0.6 ? WHITE : C('crimson', 5);
    }
  }
  // glyph dust: tiles flying up and away from a point (a figure coming apart), age g in seconds
  function glyphDust(x, y, g, n, spread, seed) {
    for (let k = 0; k < n; k++) {
      const a = -PI / 2 + (ih(k, 1, seed) - 0.5) * 2.2, v = 20 + ih(k, 2, seed) * 50, d = v * g;
      const px = x + (ih(k, 3, seed) - 0.5) * spread + Math.cos(a) * d - g * g * 18, py = y + (ih(k, 4, seed) - 0.5) * spread * 1.6 + Math.sin(a) * d;
      if (ih(k, 5, seed) > 1.4 - g) continue;
      if (ih(k, 6, seed) < 0.25) glyph(fl(px), fl(py), k, 1, WHITE); else rectF(fl(px), fl(py), 2, 2, ih(k, 7, seed) < 0.8 ? WHITE : C('crimson', 5));
    }
  }

  // 5b — up at the sky (0:32): the clouds part and a crown of glyphs opens over the shrine
  shot(32.4, 36.0, (lt, t) => {
    vgrad(0, H, R.night, 0.6, 2.2);
    const op = eoc(lin(0.2, 3, lt));
    cloudBank(80 - op * 30, 12, 6, R.night, 2.2, 3, FREEZE, 0); cloudBank(200 + op * 30, 14, 6, R.dusk, 1.4, 9, FREEZE, 0);
    sigil(240, 128, 30 + op * 120, 0.42, t, lin(0, 2.4, lt), 161);
    // the shrine's eave at the bottom of the frame, black against it, and the rain hanging in the air
    for (let x = 0; x < W; x++) { const top = 236 - Math.pow(Math.abs(x - 240) / 240, 2) * 18; for (let y = fl(top); y < H; y++) BUF[y * W + x] = cel(R.ink, y - top < 2 ? 2 : 0.6, x, y); }
    rain(t, 260, 0.18, undefined, FREEZE);
    shk(0.5 * lin(0, 2, lt));
  });

  // 6 — the King on the ridge, his back to us, the crown above him (0:36): "hush now"
  // the Hollow King, from behind: a tall cloak that flares to a tattered hem stirring in a wind that isn't there,
  // a deep hood, a collar trimmed with white glyphs, long sleeves with pale hands hanging out of them; his crown floats above
  function king(x, y, s, t, pulse) {
    sclear(); LIGHTS.x = 0; LIGHTS.y = -1;
    const sw = Math.sin(t * 0.9) * 2, ink = (v) => band(R.ink, v);
    // the cloak: folds as darker vertical bands, lit along the shoulders from the crown above
    sPoly([[-11, -96], [11, -96], [22 + sw, -8], [-24 + sw * 1.3, -8]], (xx, yy) => ink(1.2 + (frac((xx + 30) / 6 + yy * 0.01) < 0.22 ? -0.7 : 0) + (yy < -88 ? 1.4 : 0)));
    // the tattered hem: strips of different length, each fluttering on its own
    for (let k = 0; k < 12; k++) { const hx = -23 + k * 4 + sw * 1.2, len = 6 + ih(k, 1, 71) * 10, fl_ = Math.sin(t * 2.4 + k * 1.3) * 2; sPoly([[hx, -9], [hx + 4, -9], [hx + 3 + fl_, -9 + len], [hx + 1 + fl_ * 1.2, -9 + len + 2]], ink(0.9)); }
    // sleeves and long pale hands
    for (const side of [-1, 1]) {
      sPoly([[side * 10, -92], [side * 17, -64], [side * 18, -42], [side * 12, -44], [side * 8, -70]], ink(1.6));
      sEll(side * 15, -42, 2.2, 2.2, band(R.hush, 3)); for (let f = 0; f < 3; f++) sLock(side * 14 + f * side * 1.2, -41, side * 14 + f * side * 1.6 + Math.sin(t + f) * 0.6, -31 - (f === 1 ? 2 : 0), 0, 0.5, R.hush, 3, false);
    }
    // the collar's glyph trim and the hood
    for (let k = 0; k < 9; k++) { const cx = -10 + k * 2.5; sp(cx, -95 + (k % 2), C('snow', 7), 1); sp(cx + 1, -95, C('hush', 5), 1); }
    sEll(0, -104, 10, 11, (xx, yy, u, v) => ink(1.2 + (v < -0.5 ? 1.4 : 0) - (Math.abs(u) < 0.1 && v > -0.2 ? 0.6 : 0)));
    sPoly([[-3, -115], [3, -115], [0, -121]], ink(1.6));          // the hood's peak
    soutline(C('hush', 5)); stamp(x, y, s, false);
    // the crown: glyph tiles in a slow ring, brightening (and some turning red) as he speaks
    const cy = y - 136 * s;
    for (let k = 0; k < 14; k++) { const a = k / 14 * TAU + t * 0.4, gx = x + Math.cos(a) * 20 * s, gy = cy + Math.sin(a) * 5 * s; if (Math.sin(a) < -0.2) { rectF(fl(gx), fl(gy), s, s, C('hush', 3)); continue; } glyph(fl(gx - 2.5 * s), fl(gy - 2.5 * s), k, s, pulse > 0.5 && k % 3 === 0 ? C('crimson', 6) : WHITE); }
    glow(x, cy, 30 * s, tab('#e8ecff', true), 0.25 + pulse * 0.25);
  }
  shot(36.0, 41.0, (lt, t) => {
    vgrad(0, H, R.night, 0.5, 1.8);
    sigil(250, 46, 150, 0.28, t, 1, 161);
    // the valley far below: the village's lights, small, in the rain
    ridge(170, 20, 60, 3, R.night, 1.2, 23, 0.6);
    for (let k = 0; k < 90; k++) { const x = 60 + ih(k, 1, 31) * 360, y = 176 + ih(k, 2, 31) * 30; if (ih(k, 3, 31) < 0.6) put(fl(x), fl(y), C('fire', ih(k, 4, 31) < 0.5 ? 5 : 4)); }
    // the ridge he stands on, black rock with a wet lit edge
    for (let x = 0; x < W; x++) { const top = 214 + Math.sin(x * 0.03) * 8 + vn(x, 0, 14, 41) * 10 - Math.max(0, 40 - Math.abs(x - 250)) * 0.35; for (let y = fl(top); y < H; y++) BUF[y * W + x] = cel(R.ink, y - top < 1.5 ? 2.4 : 0.6 + vn(x, y, 6, 42) * 0.6, x, y); }
    const pulse = talking('king', t) ? 1 : 0;
    rays(250, 46, 7, 220, tab('#c8d4ff', true), 0.22, t, 5);
    king(250, 216, 1, t, pulse);
    rain(t, 160, 0.18, undefined, FREEZE);
    view(250, lerp(132, 126, lt / 5), lerp(1.0, 1.25, eio(lt / 5)));
  });

  // 7 — the wave (0:41): the crown comes down over the village, and everything it touches goes blank
  const WAVE0 = 41.4;
  shot(41.0, 48.0, (lt, t) => {
    vgrad(0, 120, R.night, 0.6, 2.2);
    sigil(240, 40, 200, 0.25, t, 1, 161);
    ridge(118, 30, 70, 4, R.night, 1.3, 11, 0.8);
    // the whole village, terrace on terrace down the hill toward us
    for (let row = 0; row < 7; row++) {
      const yb = 120 + row * 22, sh = -1 + row * 0.25, w0 = 16 + row * 7;
      for (let y = yb; y < yb + 30; y++) for (let x = 0; x < W; x++) BUF[y * W + x] = cel(R.ink, 1.4 + sh * 0.5 + (y - yb) / 50, x, y);
      for (let k = 0; k < 30; k++) { const x = -12 + k * w0 * 1.25 + (row % 2) * w0 * 0.6 + ih(k, row, 61) * 6, w = w0 * (0.8 + ih(k, row, 62) * 0.4); if (x > W + 20) break; if (ih(k, row, 63) < 0.18) { fillEll(x, yb - w * 0.3, w * 0.38, w * 0.38, 0, (xx, yy, u, v) => cel(R.moss, 0.5 + sh * 0.4 - v * 0.6, xx, yy)); continue; } house(x, yb, w, w * 0.45, w * 0.27, { seed: k + row * 31, shade: sh, lit: 0.6 }); }
    }
    for (const [lx, ly] of LAMPS) if (ih(lx, ly, 9) < 0.04) glow(lx, ly, 6, tab('#ff9a40', true), 0.22);
    rain(t, 240, 0.18, undefined, FREEZE);
    // the ring drops onto the village: a white ring spreading out from the top of the hill, erasing as it goes
    const R0 = Math.max(0, (t - WAVE0) * 80), cx = 240, cy = 100;
    hush((x, y) => { const d = Math.hypot(x - cx, (y - cy) * 2.2); return d < R0 - 10 ? 1 : d < R0 ? 0.6 : 0; }, t);
    for (let k = 0; k < 120; k++) { const a = k / 120 * PI + PI * 0, d = R0; const x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d / 2.2; if (y > 100 && y < H) glyph(fl(x - 2), fl(y - 2), k, 1, ih(k, fl(t * 12), 5) < 0.75 ? WHITE : C('crimson', 5)); }
    shk(1.2);
  });

  // 8 — the name on the wall goes blank (0:48)
  shot(48.0, 51.0, (lt, t) => {
    // wet planks in close-up, lantern light from the left, the chalk letters, and the white creeping in from the right
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const u = x + y * 0.05, plank = fl(u / 46), seam = frac(u / 46) < 0.04, grain = vn(u * 0.3, y * 0.05 + plank * 50, 3, 133); BUF[y * W + x] = cel(R.wood, 1.4 + grain * 1.4 + (ih(plank, 1, 134) - 0.5) * 0.6 - (seam ? 1.2 : 0) + Math.max(0, 1 - x / 300) * 1.2, x, y); }
    for (let k = 0; k < 24; k++) { const x = 20 + ih(k, 1, 135) * 440, sp_ = 30 + ih(k, 2, 135) * 50, y0 = (FREEZE * sp_ + ih(k, 3, 135) * 400) % 300 - 20; for (let j = 0; j < 12; j++) put(fl(x), fl(y0 + j), j < 3 ? C('sky', 5) : C('wood', 4)); }
    const sc = 8, s = 'MIRA', w = textWidth(s, sc), x0 = 240 - w / 2, y0 = 100, er = lin(0.9, 2.9, lt);
    text(s, x0, y0, (i, j, k) => { const gone = ih(i + k * 7, j, 140) < er * 1.4 - k * 0.15; if (gone) return -1; return ih(i * 3 + k, j * 5, 141) < 0.12 ? C('hush', 4) : WHITE; }, sc);
    // a little heart she drew after it
    if (er < 0.8) for (const [i, j] of [[0, 1], [1, 0], [2, 1], [3, 0], [4, 1], [0, 2], [4, 2], [1, 3], [3, 3], [2, 4]]) rectF(x0 + w + 16 + i * 5, y0 + 14 + j * 5, 4, 4, C('hush', 6));
    glyphDust(x0 + w * 0.3, y0 + 30, lt * 0.8, fl(er * 60), 140, 142);
    hush((x, y) => clamp((x - W + Math.max(0, lt - 0.6) * 170) / 60, 0, 1), t);
  });

  // 9 — Mira turns toward the light: "Sable...?" (0:51); a cold white light comes over her from the left
  shot(51.0, 55.0, (lt, t) => {
    const o = { freeze: FREEZE, fire: 0.5 }, turn = sstep(0.5, 0.9, lt);
    closeBg(() => shrineStage(t, o), 250, 168, 3, 3);
    hush((x, y) => clamp((lt - 0.8) * 0.3 - x / W * 0.8 + 0.2, 0, 0.75), t);
    LIGHT.x = turn > 0.5 ? -1 : 1; LIGHT.y = -0.2; ENV.edge = turn > 0.5 ? C('hush', 6) : C('fire', 5);
    bust('mira', { t, face: { eyes: lt > 1.4 ? 'wide' : 'open', brows: 'worried', mouth: mouth('mira', t), smile: -0.2, blush: 1, tear: lt > 2.3, look: turn > 0.5 ? 1 : 0 }, headX: Math.round(turn * -1) }, 236 - Math.round(lt * 2), H - 22 + 6, 3, turn > 0.5 ? -1 : 1);
    ENV.edge = null;
    nearRain(t, 50, FREEZE);
    glow(0, 120, 260, tab('#eef1fb', true), 0.15 + lt * 0.08);
  });

  // 10 — her hand in Sable's; the white reaches her; she comes apart into glyphs and is gone (0:55)
  const HIT = 58.2;
  shot(55.0, 60.0, (lt, t) => {
    const o = { freeze: FREEZE, fire: t < HIT ? 0.4 : 0 }, g = t - HIT;
    shrineStage(t, o);
    const reach = sstep(0.2, 0.9, lt);
    sable(t, { hip: lerp(-15, -20, reach), lean: reach * 3, legs: [{ knee: [9, -9 - reach * 3], foot: [9, 0] }, { knee: [-3, -1], foot: [-13, -1] }], face: { eyes: g > 0 ? 'wide' : 'narrow', brows: 'worried', mouth: mouth('sable', t) }, arms: [{ hand: [lerp(10, 24, reach), lerp(-17, -24, reach)] }, { hand: [5, -16] }], propFar: kneelSword }, SABLE_X, FLOOR);
    if (g < 1.2) {
      const MP = { hip: -16, face: { eyes: g > 0.1 ? 'closed' : 'wide', brows: 'worried', mouth: 0.3, blush: 1 }, arms: [{ a: 1.5, b: 0.1 }, { a: 0.3, b: 0.4 }], legs: [{ foot: [3, 0] }, { foot: [-3, 0] }], lamp: g < 0 };
      if (g <= 0) mira(t, MP, MIRA_X, FLOOR + 2, 1, 1);
      else { LIGHT.x = 1; LIGHT.y = -0.3; actor(MIRA, Object.assign({ t }, MP), MIRA_X, FLOOR + 2, 1, 1, { fx: (c, x, y) => (ih(x, y, fl(t * 20)) < g * 1.1 ? -1 : LUM[c] > 90 ? WHITE : C('hush', 3)) }); }
    }
    if (g > 0) glyphDust(MIRA_X, FLOOR - 18, g, 140, 20, 181);
    shrineAfter(t, o);
    // the white wall coming up the steps behind her, then over her
    const front = W * 0.15 + clamp((lt - 0.8) / (HIT - 55.8), 0, 1) * (MIRA_X - W * 0.15 + 4);
    hush((x, y) => (Math.hypot(x - SABLE_X, y - 190) < 26 && g > 0 ? 0 : x < front - 10 ? 1 : x < front ? 0.6 : 0), t);
    view(252, 188, 3);
    if (g > 0 && g < 0.1) flash(0.8);
    shk(g > 0 ? 3 * Math.exp(-g * 3) : lin(1, 3, lt) * 1.2);
  });

  // 11 — the scream (1:00): close on Sable as the white closes round her
  shot(60.0, 65.0, (lt, t) => {
    const o = { freeze: FREEZE, fire: 0 };
    closeBg(() => shrineStage(t, o), 250, 168, 3, 3);
    const scream = lt > 0.35 && lt < 1.75;
    LIGHT.x = -1; LIGHT.y = -0.3; ENV.edge = C('hush', 6);
    const sh = scream ? Math.round((ih(fl(t * 30), 1, 7) - 0.5) * 3) : 0;
    bust('sable', { t, wind: scream ? 2 : 0, face: { eyes: scream ? 'shut' : lt < 0.35 ? 'wide' : 'sad', brows: 'worried', scream, mouth: mouth('sable', t), tear: lt > 1.8 }, headY: scream ? -1 : 0 }, 244 + sh, H - 22 + 6, 3, -1);
    ENV.edge = null;
    // the white closes in round her, its edge ragged with glyph-dust
    hush((x, y) => { const d = Math.hypot(x - 244, (y - 140) * 1.05) + (vn(Math.atan2(y - 140, x - 244) * 8 + 20, lt * 2, 1, 191) - 0.5) * 18; const r0 = 190 - lt * 32; return d > r0 ? 1 : d > r0 - 10 ? 0.6 : 0; }, t);
    if (scream) shk(2.5);
    flash(lin(1.9, 2.7, lt));
    if (lt > 2.7) { BUF.fill(WHITE); for (let k = 0; k < 60; k++) { const x = ih(k, 1, 191) * W, y = (ih(k, 2, 191) * H - (lt - 2.7) * 20 * (1 + ih(k, 3, 191)) + H) % H; put(fl(x), fl(y), C('hush', 3)); } tintAll(tab('#8a90a0'), lin(3.4, 5, lt) * 0.6); }
  });

  /* ================================================================ COLD OPEN, the end: what is left, the oath, the title */
  // the shrine after the Hush: the same place drained to a pale sketch, the rain gone, only the embers keep their colour
  function drainedShrine(t) {
    shrineStage(t, { freeze: FREEZE, fire: 0 });
    hush(() => 1, t, false);
    // the embers in the bowl, the one warm thing left
    fillEll(FIRE[0], FIRE[1] - 1, 10, 2, 0, (x, y, u) => cel(R.ember, 2.4 + (1 - Math.abs(u)) * 2 + ih(x, y, fl(t * 5)) * 1.4, x, y));
    glow(FIRE[0], FIRE[1] - 2, 18, tab('#ff8030', true), 0.35 + Math.sin(t * 3) * 0.05);
  }
  // 12 — after (1:05): Sable alone on her knees by the cold fire; she reaches into the embers and draws the sword — it burns
  const DRAW = 69.0;
  shot(65.0, 74.0, (lt, t) => {
    drainedShrine(t);
    const g = t - DRAW, reach = sstep(-1.4, -0.3, g), pull = sstep(0, 0.35, g), rise = sstep(0.9, 1.9, g), burn = g > 0.15;
    // where the blade lies across the bowl, and then in her hand, burning
    const kneel = { hip: lerp(-15, -30, rise), lean: lerp(2, 0, rise) + reach * 2, legs: rise > 0.5 ? [{ foot: [5, 0] }, { foot: [-6, 0] }] : [{ knee: [9, -9], foot: [9, 0] }, { knee: [-3, -1], foot: [-13, -1] }] };
    LIGHT.x = -1; LIGHT.y = -0.3; ENV.edge = burn ? C('fire', 5) : C('hush', 6);
    const hand = g < 0 ? [lerp(8, 24, reach), lerp(-16, -8, reach)] : [lerp(24, 10, pull), lerp(-8, -24 - rise * 6, pull)];
    actor(SABLE, Object.assign({ t, wind: burn ? 1.5 : 0, face: { eyes: burn ? 'narrow' : g > -1.5 ? 'half' : 'closed', brows: burn ? 'angry' : 'worried', tear: !burn }, arms: [{ hand }, { hand: [4, -16 - rise * 10] }],
      prop: g < 0 ? undefined : (A) => swordArt(A.hand[0], A.hand[1], lerp(-PI / 2 - 0.4, 0.15, pull), 28, burn) }, kneel), SABLE_X - 18, FLOOR, 1, -1);
    ENV.edge = null;
    if (g < 0) { for (let u = 0; u < 28; u++) put(FIRE[0] - 14 + u, FIRE[1] - 3, u > 22 ? C('crimson', 3) : C('stone', 4)); }
    if (burn) {
      // the blade catches: fire runs up it, sparks, and the colour comes back into the world around it
      const r = Math.min(1, (g - 0.15) * 1.5);
      glow(SABLE_X - 30, 180, 60 * r, tab('#ff7a2a', true), 0.4);
      embers(SABLE_X - 30, 186, 50, 30, t, 202);
      if (g < 0.4) { flash(0.5 * (1 - g / 0.4)); shk(3); }
    } else embers(FIRE[0], FIRE[1] - 6, 10, 10, t, 203);
    const z = lerp(1.7, 2.6, eio(lt / 9)), fx = lerp(236, 236, lt / 9);
    view(fx, lerp(170, 172, lt / 9), z);
  });

  // 13 — the mask, then the oath (1:14): a cracked white mask on the stones; she lifts it; masked, burning, she swears
  function maskArt(cx, cy, s, t, lift) {
    // a porcelain face: two slits, a crack running from one slit to the jaw, a bevelled rim
    fillEll(cx, cy, 34 * s, 42 * s, -0.12 + lift * 0.1, (x, y, u, v) => {
      if (v > 0.55 && Math.abs(u) > 1 - (v - 0.55) * 1.6) return -1;
      const slit = Math.abs(v + 0.12) < 0.07 && Math.abs(Math.abs(u) - 0.38) < 0.2, crack = Math.abs(u - 0.33 - (v + 0.1) * 0.45 - Math.sin(v * 9) * 0.04) < 0.035 && v > -0.08;
      if (slit) return C('ink', 0); if (crack) return C('ink', 1);
      const r = Math.hypot(u, v); return cel(R.hush, 6.4 - (r > 0.88 ? 1.6 : 0) + (u * -0.6 + v * -0.6) * 1.2 + (Math.abs(v - 0.15) < 0.05 && Math.abs(u) < 0.2 ? -1 : 0), x, y);
    });
  }
  shot(74.0, 82.0, (lt, t) => {
    if (lt < 2.6) {
      // macro: pale stones, ash, the mask; her hand comes into frame and lifts it
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const u = x + y * 0.3, by = fl(y / 34), bx = fl(u / 52 + (by % 2) * 0.5), gap = frac(u / 52 + (by % 2) * 0.5) < 0.04 || frac(y / 34) < 0.06; BUF[y * W + x] = cel(R.hush, 3.6 + (ih(bx, by, 261) - 0.5) * 0.8 + (vn(x, y, 6, 262) > 0.7 ? 0.5 : 0) - (gap ? 1.4 : 0), x, y); }
      for (let k = 0; k < 50; k++) { const x = ih(k, 1, 263) * W, y = ih(k, 2, 263) * H; rectF(x, y, 2 + ih(k, 3, 263) * 3, 1 + ih(k, 4, 263) * 2, C('hush', 2)); }
      const lift = eio(lin(0.9, 2.5, lt)), mx = 226 + lift * 10, my = 150 - lift * 40;
      fillEll(mx + 10, 200, 52, 12, 0, (x, y) => (bay(x, y) < 0.5 * (1 - lift) ? C('hush', 2) : -1));    // its shadow
      maskArt(mx, my, 1.5 + lift * 0.2, t, lift);
      // her fingers on its rim
      if (lt > 0.5) {
        // her hand: a dark sleeve from the top right, the fingers curled over the mask's rim, the thumb on its face
        const hx = mx + 46 * (1.5 + lift * 0.2), hy = my - 14 - (1 - lin(0.5, 0.85, lt)) * 120;
        sclear(); LIGHTS.x = -0.6; LIGHTS.y = -0.7;
        sPoly([[8, -150], [40, -150], [26, -112], [6, -116]], (x, y) => band(R.ink, 3 + (x < 14 ? 1 : 0) + ((y + 150) % 12 < 1 ? -1 : 0)));
        sPoly([[6, -116], [24, -112], [25, -106], [5, -109]], (x, y) => band(R.crimson, 4));
        sEll(14, -100, 10, 11, (x, y, u, v) => band(R.tan, 5 + (litOf(u, v) > 0.3 ? 1 : litOf(u, v) < -0.4 ? -1 : 0)));
        for (let k = 0; k < 4; k++) { sEll(1 - k * 0.5, -96 + k * 6, 6, 2.6, (x, y, u, v) => band(R.tan, 5 + (v < -0.2 ? 1 : 0) - (u < -0.6 ? 1 : 0))); }
        sEll(4, -108, 3, 5, (x, y, u, v) => band(R.tan, 5.4 + (u < 0 ? 0.6 : -0.4)));
        soutline(); stamp(hx - 4, hy + 200, 2, false);
      }
      for (let k = 0; k < 24; k++) { const u = frac(ih(k, 1, 264) + t * 0.15); put(fl(ih(k, 2, 264) * W), fl(H - u * H), u < 0.5 ? C('ember', 6) : C('ember', 4)); }
      fade(1 - lin(0, 0.4, lt));
    } else if (lt < 5.4) {
      // low, wide: she stands masked in the white, the sword burning, embers climbing round her
      const u = lt - 2.6;
      drainedShrine(t);
      LIGHT.x = 1; LIGHT.y = -0.4; ENV.edge = C('fire', 5);
      actor(SABLE, { t, wind: 2 + Math.sin(t * 2) * 1.5, face: { mask: 2 }, arms: [{ hand: [10, -22] }, { a: 0.2 }], legs: [{ foot: [6, 0] }, { foot: [-6, 0] }], prop: (A) => swordArt(A.hand[0], A.hand[1], 0.5, 28, true) }, 240, FLOOR, 1, 1);
      ENV.edge = null;
      glow(258, FLOOR - 40, 50, tab('#ff8030', true), 0.45);
      embers(240, FLOOR - 4, 90, 60, t, 212);
      view(240, lerp(178, 172, u / 2.8), lerp(2.2, 2.6, eio(u / 2.8)));
    } else {
      // close: the mask, the embers burning in its eyes — "I remember that I swore" — the sword comes up, and down
      const u = lt - 5.4, raise = lin(0.2, 1.1, u), slash = lin(2.0, 2.2, u);
      closeBg(() => drainedShrine(t), 236, 160, 3, 3);
      LIGHT.x = 1; LIGHT.y = -0.4; ENV.edge = C('fire', 5);
      bust('sable', { t, wind: 2, face: { mask: 2 } }, 240, H - 22 + 6, 3, 1);
      ENV.edge = null;
      // the burning blade crossing the frame as she lifts it, then the cut
      if (slash <= 0) {
        // the blade rises into frame beside her face, upright, burning along its edge
        const bx = 340, tip = lerp(300, 34, eio(raise)), base = H;
        for (let y = Math.max(LB, fl(tip)); y < Math.min(H - LB, base); y++) { const q = (y - tip) / 190, wd = q < 0.1 ? Math.max(1, q / 0.1 * 7) : 7; for (let w = -wd; w <= wd; w++) { const x = fl(bx + w + (y - tip) * 0.06); put(x, y, w < -wd + 1.5 ? WHITE : w < -2 ? C('fire', 6) : w < 3 ? C('fire', 5) : w < wd - 1 ? C('ember', 5) : C('ember', 3)); } }
        for (let k = 0; k < 6; k++) if (tip + 20 + k * 34 < H - LB) fire(bx + 8 + (20 + k * 34) * 0.06, tip + 20 + k * 34, 9, t, 31 + k, { sparks: 5, smoke: false });
        glow(bx, (H + tip) / 2, 90, tab('#ff7a2a', true), 0.35);
      }
      embers(240, 250, 70, 300, t, 213);
      if (slash > 0) { BUF.fill(BLACK); const v = eoc(slash); for (let x = 0; x < W * v; x++) { const y = fl(250 - x * 0.48); put(x, y, WHITE); put(x, y + 1, C('fire', 6)); put(x, y - 1, C('fire', 5)); put(x, y + 2, C('ember', 4)); } }
      if (u > 2.2) { BUF.fill(BLACK); const fd = 1 - lin(2.2, 2.6, u); for (let x = 0; x < W; x++) { const y = fl(250 - x * 0.48); if (ih(x, 1, fl(t * 20)) < fd) { put(x, y, C('fire', 5)); put(x, y + 1, C('ember', 4)); } } }
      if (u > 1.7 && u < 2.05) shk(2);
    }
  });

  // 14 — the title (1:22): the letters catch from the cut, burn bright, and settle to embers; then they burn away
  shot(82.0, 93.0, (lt, t) => {
    BUF.fill(BLACK);
    const s = 'UNFORGOTTEN', sc = 6, w = textWidth(s, sc), x0 = fl(240 - w / 2), y0 = 92;
    const burnOut = lin(8.6, 10.6, lt);
    // the letters are windows onto a fire field: each pixel's heat rises with the noise, banded into flame colours
    text(s, x0, y0, (i, j, k) => -2, sc);       // (layout only)
    let cx = x0;
    for (let k = 0; k < s.length; k++) {
      const g = FONT[s[k]] || FONT[' '], gw = g[0].length, catchT = 0.6 + Math.abs(k - 5) * 0.16;
      for (let j = 0; j < 7; j++) for (let i = 0; i < gw; i++) {
        if (g[j][i] !== '#') continue;
        for (let yy = 0; yy < sc; yy++) for (let xx = 0; xx < sc; xx++) {
          const px = cx + i * sc + xx, py = y0 + j * sc + yy, age = lt - catchT - (6 - j) * 0.03;
          if (age < 0) continue;
          if (burnOut > 0 && ih(px >> 1, py >> 1, 222) < burnOut * 1.3 - (py - y0) / 60) continue;
          const n = fbm(px * 0.7, py * 0.5 + t * 26, 3, 2, 225), heat = Math.min(1, age * 2) * (0.55 + n * 0.6) - Math.max(0, age - 1.5) * 0.12 + (j < 2 ? 0.08 : 0);
          put(px, py, heat > 0.95 ? WHITE : heat > 0.78 ? C('fire', 6) : heat > 0.6 ? C('fire', 4) : heat > 0.42 ? C('ember', 5) : C('ember', 3));
        }
      }
      // little flames licking off the tops of the letters
      if (lt > catchT + 0.3 && burnOut < 0.5) fire(cx + gw * sc / 2, y0 + 2, 4 + ih(k, 1, 226) * 3, t, k + 40, { sparks: 3, smoke: false });
      cx += (gw + 1) * sc;
    }
    embers(240, y0 + 40, 70, w, t, 223);
    // the slash line still smouldering at first
    if (lt < 1.4) for (let x = 0; x < W; x++) { const y = fl(250 - x * 0.48); if (ih(x, 2, fl(t * 20)) < 1 - lt / 1.4) put(x, y, C('ember', 4)); }
    if (lt > 3.4) { const s2 = 'EPISODE ONE · THE COURIER', a = lin(3.4, 4.4, lt) * (1 - burnOut); text(s2, 240 - textWidth(s2, 1) / 2, 160, a > 0.5 ? C('linen', 6) : C('linen', 3), 1, undefined, fl((lt - 3.4) * 40)); }
  }, { nocaps: true });

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
    medium: 'Pixel art in 256 colours, 480 × 270, drawn in JavaScript as it plays',
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
