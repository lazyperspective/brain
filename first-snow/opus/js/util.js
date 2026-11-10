'use strict';
// Deterministic helpers: PRNG, hash noise, blur.

function PRNG(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash2(x, y, s) {
  let h = (Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(y | 0, 0x165667b1) ^ Math.imul(s | 0, 0x9e3779b1)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

function vnoise(x, y, s) {
  const ix = Math.floor(x), iy = Math.floor(y);
  let fx = x - ix, fy = y - iy;
  fx = fx * fx * (3 - 2 * fx);
  fy = fy * fy * (3 - 2 * fy);
  const a = hash2(ix, iy, s), b = hash2(ix + 1, iy, s), c = hash2(ix, iy + 1, s), d = hash2(ix + 1, iy + 1, s);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}

function fbm(x, y, oct, s) {
  let v = 0, amp = 0.5, tot = 0;
  for (let i = 0; i < oct; i++) {
    v += amp * vnoise(x, y, s + i * 101);
    tot += amp;
    x = x * 2.03 + 17.1; y = y * 2.01 - 9.7;
    amp *= 0.5;
  }
  return v / tot;
}

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
function smooth(a, b, x) {
  let t = (x - a) / (b - a);
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return t * t * (3 - 2 * t);
}
function gauss(rng) {
  let u = rng(); if (u < 1e-9) u = 1e-9;
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(6.283185307 * rng());
}
function mixc(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
function css(c, al) {
  const r = Math.round(clamp(c[0], 0, 1) * 255), g = Math.round(clamp(c[1], 0, 1) * 255), b = Math.round(clamp(c[2], 0, 1) * 255);
  return al == null ? `rgb(${r},${g},${b})` : `rgba(${r},${g},${b},${al})`;
}

// separable box blur, run 3x for ~gaussian. src: Float32Array with ch channels interleaved
function blurPass(src, dst, W, H, ch, r, horiz) {
  const n = horiz ? W : H, m = horiz ? H : W;
  const step = horiz ? ch : W * ch, lstep = horiz ? W * ch : ch;
  const inv = 1 / (2 * r + 1);
  for (let l = 0; l < m; l++) {
    const base = l * lstep;
    for (let c = 0; c < ch; c++) {
      let acc = 0;
      for (let k = -r; k <= r; k++) {
        const kk = k < 0 ? 0 : k >= n ? n - 1 : k;
        acc += src[base + kk * step + c];
      }
      for (let i = 0; i < n; i++) {
        dst[base + i * step + c] = acc * inv;
        const ia = i + r + 1, ir = i - r;
        acc += src[base + (ia >= n ? n - 1 : ia) * step + c] - src[base + (ir < 0 ? 0 : ir) * step + c];
      }
    }
  }
}
function gaussBlur(src, W, H, ch, sigma) {
  const out = new Float32Array(src);
  if (sigma < 0.5) return out;
  const tmp = new Float32Array(src.length);
  const r = Math.max(1, Math.round((Math.sqrt(4 * sigma * sigma + 1) - 1) / 2));
  for (let it = 0; it < 3; it++) {
    blurPass(out, tmp, W, H, ch, r, true);
    blurPass(tmp, out, W, H, ch, r, false);
  }
  return out;
}
