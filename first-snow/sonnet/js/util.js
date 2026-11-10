'use strict';
// ---------- seeded PRNG + noise (no Math.random, no Date) ----------
function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
class RNG {
  constructor(seed) { this.f = mulberry32(seed >>> 0); }
  next() { return this.f(); }
  range(a, b) { return a + (b - a) * this.f(); }
  int(a, b) { return a + Math.floor(this.f() * (b - a + 1)); }
  gauss() { let u = 0, v = 0; while (u === 0) u = this.f(); v = this.f(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(6.283185307 * v); }
  pick(arr) { return arr[Math.floor(this.f() * arr.length)]; }
  chance(p) { return this.f() < p; }
}
function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

// 2D gradient noise
class Noise {
  constructor(seed) {
    const r = new RNG(seed);
    this.p = new Uint8Array(512);
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    for (let i = 255; i > 0; i--) { const j = Math.floor(r.next() * (i + 1)); const t = p[i]; p[i] = p[j]; p[j] = t; }
    for (let i = 0; i < 512; i++) this.p[i] = p[i & 255];
    this.gx = new Float32Array(256); this.gy = new Float32Array(256);
    for (let i = 0; i < 256; i++) { const a = r.next() * 6.283185307; this.gx[i] = Math.cos(a); this.gy[i] = Math.sin(a); }
  }
  // returns about [-1,1]
  n2(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const X = xi & 255, Y = yi & 255;
    const p = this.p, gx = this.gx, gy = this.gy;
    const a = p[p[X] + Y], b = p[p[X + 1] + Y], c = p[p[X] + Y + 1], d = p[p[X + 1] + Y + 1];
    const u = xf * xf * xf * (xf * (xf * 6 - 15) + 10), v = yf * yf * yf * (yf * (yf * 6 - 15) + 10);
    const n00 = gx[a] * xf + gy[a] * yf;
    const n10 = gx[b] * (xf - 1) + gy[b] * yf;
    const n01 = gx[c] * xf + gy[c] * (yf - 1);
    const n11 = gx[d] * (xf - 1) + gy[d] * (yf - 1);
    const x1 = n00 + u * (n10 - n00), x2 = n01 + u * (n11 - n01);
    return (x1 + v * (x2 - x1)) * 1.41;
  }
  fbm(x, y, oct, lac, gain) {
    let s = 0, a = 1, f = 1, norm = 0;
    for (let i = 0; i < oct; i++) { s += a * this.n2(x * f + i * 17.3, y * f - i * 9.1); norm += a; a *= gain; f *= lac; }
    return s / norm;
  }
}
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const mix3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const rgb = (r, g, b) => [r / 255, g / 255, b / 255];
const tick = () => new Promise(r => setTimeout(r, 0));
