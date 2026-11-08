// Act 2 core: palette, indexed framebuffer, dithering, PRNG, raster primitives.
// Everything is drawn as palette indices into a 480x270 Uint8Array; no anti-aliasing anywhere.
'use strict';
const W = 480, H = 270;

// ---- Shared palette (style bible), every ramp stored dark -> light ----
const RAMPS_HEX = {
  sky:   ['#0b1630', '#12234a', '#1a3566', '#24508a', '#3a6fa8', '#5b8fc4', '#86b0d8', '#b3cfe6', '#dbe8f2', '#f4f7fa'],
  warm:  ['#7a3524', '#b85a2e', '#e0823a', '#f5b04a', '#ffd77a', '#fff0b8', '#fffbe8'],
  steel: ['#0e0f12', '#1c1f25', '#2d323b', '#434a55', '#5f6876', '#828c99', '#a9b2bd', '#cdd4db', '#eef1f4'],
  marsh: ['#1c2416', '#2c3a22', '#44542f', '#66733f', '#8c8a55', '#b3a571', '#d6c99a'],
  water: ['#163042', '#24506a', '#3b7894', '#6aa3bb', '#a9d0dd'],
  dark:  ['#050608', '#0f1216', '#1a1e24'],
};
const PAL = [];            // index -> [r,g,b]
const PALHEX = [];
const R = {};              // ramp name -> array of palette indices (dark -> light)
for (const name of Object.keys(RAMPS_HEX)) {
  R[name] = RAMPS_HEX[name].map(h => {
    PALHEX.push(h);
    PAL.push([parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]);
    return PAL.length - 1;
  });
}
const NC = PAL.length;     // 41
const TRANSP = 255;
// convenient names
const SKY = R.sky, WARM = R.warm, ST = R.steel, MA = R.marsh, WA = R.water, DK = R.dark;

// brighten / darken maps within a ramp (used by lens flares, ghosts, reflections)
const UP = new Uint8Array(NC), DOWN = new Uint8Array(NC);
for (const name of Object.keys(R)) {
  const r = R[name];
  for (let i = 0; i < r.length; i++) {
    UP[r[i]] = r[Math.min(r.length - 1, i + 1)];
    DOWN[r[i]] = r[Math.max(0, i - 1)];
  }
}
UP[SKY[9]] = WARM[6];      // brightest sky blooms into warm white
UP[DK[2]] = ST[2];
UP[WA[4]] = SKY[8];
UP[MA[6]] = WARM[5];
// warm tint: map a colour to a warm colour of similar value (for sun-side flare tinting)
const WARMTINT = new Uint8Array(NC);
(function () {
  for (let i = 0; i < NC; i++) {
    const [r, g, b] = PAL[i];
    const l = 0.3 * r + 0.59 * g + 0.11 * b;
    let best = WARM[0], bd = 1e9;
    for (const w of WARM) {
      const [r2, g2, b2] = PAL[w];
      const l2 = 0.3 * r2 + 0.59 * g2 + 0.11 * b2;
      const d = Math.abs(l2 - l);
      if (d < bd) { bd = d; best = w; }
    }
    WARMTINT[i] = best;
  }
})();

// ---- Ordered dithering ----
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
function bayer(x, y) { return (BAYER[((y & 3) << 2) | (x & 3)] + 0.5) / 16; }
// value v along a ramp (0..len-1); `hard` > 1 squeezes the dithered band so ramps read as clean steps
function rampDither(ramp, v, x, y, hard) {
  const n = ramp.length - 1;
  if (v <= 0) return ramp[0];
  if (v >= n) return ramp[n];
  const i = Math.floor(v);
  let f = v - i;
  if (hard) f = Math.min(1, Math.max(0, (f - 0.5) * hard + 0.5));
  return ramp[f > bayer(x, y) ? i + 1 : i];
}

// ---- Deterministic randomness ----
function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function hash2(x, y, s) {
  let h = (x | 0) * 374761393 + (y | 0) * 668265263 + (s | 0) * 2147483647;
  h = (h ^ (h >>> 13)) * 1274126177;
  h = h ^ (h >>> 16);
  return (h >>> 0) / 4294967296;
}
function vnoise(x, y, s) { // smooth value noise
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi, s), b = hash2(xi + 1, yi, s), c = hash2(xi, yi + 1, s), d = hash2(xi + 1, yi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x, y, s, oct) {
  let sum = 0, amp = 0.5, f = 1, norm = 0;
  for (let i = 0; i < (oct || 4); i++) { sum += amp * vnoise(x * f, y * f, s + i * 17); norm += amp; amp *= 0.5; f *= 2; }
  return sum / norm;
}

// ---- Easing / helpers ----
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = t => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const smoother = t => { t = clamp(t, 0, 1); return t * t * t * (t * (t * 6 - 15) + 10); };
// piecewise-cubic (Catmull-Rom) through keys [[t,v],...]
function keyed(keys, t) {
  if (t <= keys[0][0]) return keys[0][1];
  if (t >= keys[keys.length - 1][0]) return keys[keys.length - 1][1];
  let i = 0; while (t > keys[i + 1][0]) i++;
  const k0 = keys[Math.max(0, i - 1)], k1 = keys[i], k2 = keys[i + 1], k3 = keys[Math.min(keys.length - 1, i + 2)];
  const u = (t - k1[0]) / (k2[0] - k1[0]);
  const m1 = (k2[1] - k0[1]) / (k2[0] - k0[0]) * (k2[0] - k1[0]);
  const m2 = (k3[1] - k1[1]) / (k3[0] - k1[0]) * (k2[0] - k1[0]);
  const u2 = u * u, u3 = u2 * u;
  return (2 * u3 - 3 * u2 + 1) * k1[1] + (u3 - 2 * u2 + u) * m1 + (-2 * u3 + 3 * u2) * k2[1] + (u3 - u2) * m2;
}

// ---- Framebuffer ----
const FB = new Uint8Array(W * H);
function px(x, y, c) { if (x >= 0 && y >= 0 && x < W && y < H) FB[y * W + x] = c; }
function get(x, y) { return (x >= 0 && y >= 0 && x < W && y < H) ? FB[y * W + x] : 0; }
function mapPx(x, y, map) { if (x >= 0 && y >= 0 && x < W && y < H) { const i = y * W + x; FB[i] = map[FB[i]]; } }
function rect(x, y, w, h, c) {
  for (let j = Math.max(0, y); j < Math.min(H, y + h); j++)
    for (let i = Math.max(0, x); i < Math.min(W, x + w); i++) FB[j * W + i] = c;
}
function line(x0, y0, x1, y1, c) {
  x0 |= 0; y0 |= 0; x1 |= 0; y1 |= 0;
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let e = dx + dy;
  for (;;) {
    if (typeof c === 'function') c(x0, y0); else px(x0, y0, c);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * e;
    if (e2 >= dy) { e += dy; x0 += sx; }
    if (e2 <= dx) { e += dx; y0 += sy; }
  }
}
// polygon fill by pixel-centre test (even-odd)
function poly(pts, fn) {
  let minx = 1e9, maxx = -1e9, miny = 1e9, maxy = -1e9;
  for (const p of pts) { minx = Math.min(minx, p[0]); maxx = Math.max(maxx, p[0]); miny = Math.min(miny, p[1]); maxy = Math.max(maxy, p[1]); }
  for (let y = Math.max(0, Math.floor(miny)); y <= Math.min(H - 1, Math.ceil(maxy)); y++) {
    const cy = y + 0.5, xs = [];
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, yi] = pts[i], [xj, yj] = pts[j];
      if ((yi > cy) !== (yj > cy)) xs.push(xi + (cy - yi) / (yj - yi) * (xj - xi));
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      for (let x = Math.max(0, Math.ceil(xs[k] - 0.5)); x <= Math.min(W - 1, Math.floor(xs[k + 1] - 0.5)); x++) fn(x, y);
    }
  }
}
// iterate pixels of a disc / ring
function disc(cx, cy, r, fn) {
  const x0 = Math.floor(cx - r - 1), x1 = Math.ceil(cx + r + 1), y0 = Math.floor(cy - r - 1), y1 = Math.ceil(cy + r + 1);
  for (let y = Math.max(0, y0); y <= Math.min(H - 1, y1); y++)
    for (let x = Math.max(0, x0); x <= Math.min(W - 1, x1); x++) {
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy, d = Math.sqrt(dx * dx + dy * dy);
      if (d <= r) fn(x, y, d);
    }
}

// mask of the last blitted hero sprite (flares skip their fills there)
const MASK = new Uint8Array(W * H);
// blit a sprite {w,h,data(Uint8Array, TRANSP=255)} at integer position
function blit(spr, x, y, mask) {
  x |= 0; y |= 0;
  for (let j = 0; j < spr.h; j++) {
    const yy = y + j; if (yy < 0 || yy >= H) continue;
    for (let i = 0; i < spr.w; i++) {
      const c = spr.data[j * spr.w + i];
      if (c === TRANSP) continue;
      const xx = x + i; if (xx < 0 || xx >= W) continue;
      FB[yy * W + xx] = c;
      if (mask) MASK[yy * W + xx] = 1;
    }
  }
}

function fbToRGBA(out) {
  for (let i = 0, n = W * H; i < n; i++) {
    const p = PAL[FB[i]];
    out[i * 4] = p[0]; out[i * 4 + 1] = p[1]; out[i * 4 + 2] = p[2]; out[i * 4 + 3] = 255;
  }
}
