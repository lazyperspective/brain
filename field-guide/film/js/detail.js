'use strict';
// ------------------------------------------------------------------
// Living detail: wind in the grass, pond + waterfall, fireflies, moths,
// glowing vines under the island, drifting cloud wisps, leaf blanket,
// banking plane with sparkle trail, dust puffs.
// ------------------------------------------------------------------
const onIsland = (x, y) => { const i = Math.floor(x / 16), j = Math.floor(y / 16); return i >= 0 && j >= 0 && i < 6 && j < 6 && MASK(i, j); };
const POND = { x: 40, y: 76, r: 9 };
const TUFTS = (() => { const R = mulberry(77), out = []; while (out.length < 46) { const x = 4 + R() * 88, y = 4 + R() * 88; if (!onIsland(x, y) || !onIsland(x + 3, y + 3) || !onIsland(x - 3, y - 3)) continue; if (Math.hypot(x - POND.x, y - POND.y) < POND.r + 3 || Math.hypot(x - 56, y - 50) < 13 || Math.hypot(x - 76, y - 74) < 12) continue; out.push([x, y, R()]); } return out; })();
const FLOWERS = [[46, 66, 'flower'], [50, 70, 'cap'], [30, 70, 'flower'], [33, 86, 'boxL'], [60, 28, 'flower'], [64, 32, 'cap'], [86, 44, 'boxL'], [12, 52, 'flower'], [18, 58, 'cap']];

function wind(t, x, y) { return Math.sin(t * 2.1 + x * 0.12 + y * 0.05) * 0.6 + Math.sin(t * 3.7 + x * 0.05) * 0.4; }
function tuftsW(B, t, filt) {
  const k = ISO.k / 1.4;
  for (const [x, y, r] of TUFTS) {
    if (filt && !filt(x + y)) continue;
    const p = P(x, y, 0), w = wind(t, x, y);
    for (let b = -1; b <= 1; b++) {
      const h = Math.round((2 + ((r * 7 + b * 3) % 1) * 2.5 + (b === 0 ? 1 : 0)) * k), sw = w * (h / 3);
      for (let s = 0; s < h; s++) { const u = s / h, xx = Math.round(p[0] + b * 1.6 * k + sw * u * u); B.put(xx, Math.round(p[1]) - s, s > h * 0.6 ? COL.topL : (b ? COL.topD : COL.top)); }
    }
  }
}
function flowersW(B, t, filt) {
  const k = ISO.k / 1.4;
  for (const [x, y, c] of FLOWERS) { if (filt && !filt(x + y)) continue; const p = P(x, y, 0), sw = Math.round(wind(t, x, y) * 1.2), h = Math.round(4 * k);
    for (let s = 0; s < h; s++) B.put(Math.round(p[0] + sw * s / h), Math.round(p[1]) - s, COL.topD);
    const hx = Math.round(p[0] + sw), hy = Math.round(p[1]) - h; B.put(hx, hy - 1, COL[c]); B.put(hx - 1, hy, COL[c]); B.put(hx + 1, hy, COL[c]); B.put(hx, hy + 1, COL[c]); B.put(hx, hy, COL.lampL); }
}
function pondW(B, t) {
  const k = ISO.k, c = P(POND.x, POND.y, 0), rx = POND.r * k * 1.41, ry = rx * 0.5;
  B.ellipse(c[0], c[1] + 1, rx + 2, ry + 1.5, COL.stoneD); B.ellipse(c[0], c[1], rx + 1, ry + 1, COL.stoneL);
  B.ellipse(c[0], c[1] + 0.5, rx - 0.5, ry - 0.5, (x, y) => mix(hex('1c2348'), hex('2f3c78'), clamp((y - c[1] + ry) / (2 * ry), 0, 1)), 18);
  // the moon shimmering in the pond
  for (let r = 0; r < 4; r++) { const yy = Math.round(c[1] - ry * 0.25 + r * 1.5), w = Math.round((5 - r) * k * 0.9 + Math.sin(t * 4 + r * 1.7) * 1.5); B.rect(Math.round(c[0] + rx * 0.3 - w / 2 + Math.sin(t * 2.5 + r) * 1.2), yy, Math.max(1, w), 1, r < 2 ? COL.lampL : COL.lamp); }
  // ripple rings
  for (let q = 0; q < 2; q++) { const ph = (t * 0.35 + q * 0.5) % 1, rr = 0.25 + ph * 0.7; for (let a = 0; a < 40; a++) { const an = a / 40 * 6.283; if (hash(a, q, Math.floor(t * 3)) < 0.45) continue; B.put(c[0] - rx * 0.25 + Math.cos(an) * rx * rr * 0.5, c[1] + 1 + Math.sin(an) * ry * rr * 0.5, ph < 0.6 ? hex('4a5a9a') : hex('2f3c78')); } }
  // lily pad with a flower
  const lp = [c[0] - rx * 0.35, c[1] + ry * 0.15 + Math.sin(t * 1.3) * 0.4]; B.ellipse(lp[0], lp[1], 3.4 * k / 1.4, 1.7 * k / 1.4, COL.leaf); B.put(lp[0] + 1, lp[1], COL.topD); B.put(lp[0], lp[1] - 2, COL.flag); B.put(lp[0] - 1, lp[1] - 2, COL.lampL);
}
function waterfallW(B, t) {
  const k = ISO.k, x = 40, lip = P(x, 96, 0), from = P(x, POND.y + POND.r * 0.85, 0), w = Math.max(3, Math.round(2.6 * k));
  // channel across the grass from the pond to the edge
  for (let s = 0; s <= 1; s += 0.04) { const p = [lerp(from[0], lip[0], s), lerp(from[1], lip[1], s)]; B.rect(Math.round(p[0] - w / 2), Math.round(p[1]) - 1, w, 2, (xx, yy) => ((yy * 3 + Math.floor(t * 20) + xx) % 7 < 2 ? hex('7fd7ff') : hex('4aa3d8'))); }
  // the fall: down the island face and on into the dark
  const top = Math.round(lip[1]), len = Math.round(118 * k / 1.4);
  for (let s = 0; s < len; s++) {
    const fade = s > len * 0.55 ? 1 - (s - len * 0.55) / (len * 0.45) : 1, spread = s * 0.03;
    for (let q = -Math.ceil(w / 2 + spread); q <= Math.ceil(w / 2 + spread); q++) {
      if (hash(q + 50, s, Math.floor(t * 24)) > fade * (Math.abs(q) > w / 2 ? 0.4 : 1)) continue;
      const ph = (s - t * 70 + q * 3 + 400) % 13, c = ph < 2 ? 'c9f1ff' : Math.abs(q) >= w / 2 ? '4aa3d8' : ph < 6 ? '7fd7ff' : '4aa3d8';
      B.put(Math.round(lip[0]) + q, top + s, hex(c));
    }
  }
  // splash at the lip and mist droplets
  for (let q = 0; q < 10; q++) { const ph = (t * 1.4 + q / 10) % 1; B.put(lip[0] + Math.sin(q * 5.3) * (3 + ph * 6), top - ph * 4 + ph * ph * 10, hex('c9f1ff')); }
  for (let q = 0; q < 16; q++) { const ph = (t * 0.6 + q / 16) % 1, s = len * (0.4 + ph * 0.6); if (hash(q, 3, 3) < 0.3) continue; B.put(lip[0] + Math.sin(q * 2.1 + t) * (5 + ph * 10), top + s, hex(ph > 0.6 ? '4aa3d8' : '7fd7ff')); }
}
// glowing vines with pulsing bulbs under the island
const VINES = [[1, 4, 0.3], [2, 5, 0.6], [3, 4, 0.5], [4, 4, 0.7], [5, 3, 0.4], [4, 2, 0.2], [0, 3, 0.8]];
function vinesW(B, t) {
  const k = ISO.k;
  for (const [i, j, f] of VINES) {
    const fx = i * 16 + 16, fy = j * 16 + 4 + f * 10, bp = P(fx, fy, -DEPTH(i, j) + 2), L = Math.round((12 + f * 22) * k / 1.4);
    let x = bp[0];
    for (let s = 0; s < L; s++) { x = bp[0] + Math.round(Math.sin(s * 0.25 + t * 1.2 + i) * 1.2); B.put(x, bp[1] + s, COL.leafD); if (s % 6 === 3) B.put(x + 1, bp[1] + s, COL.leaf); }
    const by = bp[1] + L + 1, pulse = 0.55 + 0.45 * Math.sin(t * 2.2 + i * 1.7 + j);
    B.glow(x - 14, by - 14, x + 15, by + 15, hex('7fd7ff'), (px, py) => 0.55 * pulse * Math.max(0, 1 - Math.hypot(px - x, py - by) / 12));
    B.circle(x + 0.5, by + 0.5, 2.2 * k / 1.4, hex(pulse > 0.6 ? 'c9f1ff' : '7fd7ff'));
  }
}
// glowing crystals studding the island's underside faces
function crystalsW(B, t) {
  for (const [x, y, z, s] of [[48, 96, -30, 1], [16, 80, -22, 0.8], [96, 60, -26, 0.9], [80, 80, -18, 0.7], [96, 40, -14, 0.6]]) {
    const p = P(x, y, z), k = ISO.k / 1.4 * s, gl = 0.6 + 0.4 * Math.sin(t * 1.7 + x);
    B.glow(p[0] - 16, p[1] - 16, p[0] + 16, p[1] + 16, hex('9b8fd6'), (px, py) => 0.4 * gl * Math.max(0, 1 - Math.hypot(px - p[0], py - p[1]) / 13));
    B.poly([[p[0], p[1] - 6 * k], [p[0] + 3 * k, p[1]], [p[0], p[1] + 3 * k], [p[0] - 3 * k, p[1]]], COL.boxL); B.poly([[p[0], p[1] - 6 * k], [p[0] + 3 * k, p[1]], [p[0], p[1] + 3 * k]], COL.box); B.put(p[0] - 1, p[1] - 3 * k, COL.lampL);
  }
}
function fireflyW(B, t, n, cx, cy, rad, seed) {
  for (let q = 0; q < n; q++) {
    const a = t * (0.35 + hash(q, 1, seed) * 0.4) + q * 2.1, x = cx + Math.cos(a) * rad * (0.4 + hash(q, 2, seed) * 0.6) + Math.sin(t * 1.9 + q) * 6, y = cy + Math.sin(a * 1.3) * rad * 0.35 + Math.cos(t * 1.4 + q * 3) * 5;
    const on = Math.pow(0.5 + 0.5 * Math.sin(t * (2 + hash(q, 3, seed) * 2) + q * 1.7), 2); if (on < 0.15) continue;
    B.glow(x - 8, y - 8, x + 9, y + 9, hex('ffe7a3'), (px, py) => 0.55 * on * Math.max(0, 1 - Math.hypot(px - x, py - y) / 7)); B.put(x, y, on > 0.5 ? hex('fff1c4') : hex('ffe7a3'));
  }
}
function mothsW(B, t, L) {
  for (let q = 0; q < 2; q++) { const a = t * (3.2 + q * 0.9) + q * 3, x = Math.round(L[0] + Math.cos(a) * (7 + q * 3)), y = Math.round(L[1] + Math.sin(a * 1.1) * (5 + q * 2) - 2), f = Math.floor(t * 18 + q) % 2;
    B.put(x, y, COL.stoneL); if (f) { B.put(x - 1, y - 1, COL.stoneL); B.put(x + 1, y - 1, COL.stoneL); } else { B.put(x - 1, y, COL.stoneD); B.put(x + 1, y, COL.stoneD); } }
}
function fallingLeaf(B, t, from) {
  const ph = ((t + 1.2) % 5) / 5, x = from[0] + Math.sin(ph * 9) * 8 + ph * 14, y = from[1] + ph * 46; if (ph > 0.9) return;
  const flip = Math.sin(ph * 18) > 0; B.rect(Math.round(x), Math.round(y), flip ? 3 : 2, 1, COL.leafL); B.put(Math.round(x) + (flip ? 1 : 0), Math.round(y) + 1, COL.leaf);
}
// thin dark cloud wisps drifting across the moon (pixel, parallax)
function wispsW(B, t) {
  for (const [qx, qy, w, sp, par, seed] of [[346, 112, 92, 4.2, 0.32, 3], [306, 50, 64, 3.0, 0.28, 9]]) {
    const s = S([qx - t * sp, qy], par);
    pixCloud(B, s[0], s[1], w, { light: hex('b3a6d6'), mid: hex('6a5a8a'), dark: hex('3a2a55') }, seed);
  }
}
// the sleeping creature's leaf blanket: flies off at the bonk and flutters down
function blanketW(B, t, H) {
  if (!H.r) return; let x, y, ang, k = ISO.k / 1.4;
  if (t < 2.4) { x = H.r.top[0] - 2; y = H.r.top[1] - 2; ang = 0; }
  else { const u = clamp((t - 2.4) / 1.4, 0, 1), p0 = PREF(52, 50, 20), p1 = PREF(40, 62, 0); const s = S([lerp(p0[0], p1[0], u) - Math.sin(u * Math.PI) * 10, lerp(p0[1], p1[1], u) - Math.sin(u * Math.PI) * 30 + u * u * 6]); x = s[0]; y = s[1]; ang = Math.sin(u * 14) * 0.6 * (1 - u) + u * 0.3; }
  const ca = Math.cos(ang), sa = Math.sin(ang), T = (u, v) => [x + (u * ca - v * sa) * k, y + (u * sa + v * ca) * k];
  B.poly([T(-12, 0), T(-4, -5), T(8, -4), T(13, 1), T(4, 5), T(-8, 4)], COL.leaf); B.poly([T(-12, 0), T(-4, -5), T(8, -4), T(13, 1)], COL.leafL);
  const a = T(-11, 0), b = T(12, 1); B.line(a[0], a[1], b[0], b[1], COL.leafD);
}
function dustPuff(B, t, t0, at, n = 10) {
  const u = (t - t0) / 0.5; if (u < 0 || u > 1) return;
  for (let q = 0; q < n; q++) { const a = q / n * 6.283, r = (6 + u * 16) * ISO.k / 1.4; if (hash(q, 9, 9) < 0.2) continue; const x = at[0] + Math.cos(a) * r, y = at[1] + Math.sin(a) * r * 0.45 - u * 3; B.put(x, y, u < 0.5 ? COL.stoneL : COL.stoneD); if (u < 0.4) B.put(x + 1, y, COL.stoneL); }
}
// paper plane with banking (roll squashes the wings)
function planeW(B, x, y, ang, roll, cols, s) {
  const ca = Math.cos(ang), sa = Math.sin(ang), fl = Math.cos(roll), T = (u, v) => [x + (u * ca - v * sa) * s, y + (u * sa + v * ca) * s];
  const top = cols.light, under = fl > 0 ? cols.mid : cols.light;
  B.poly([T(7, 0), T(-6, -5 * fl), T(-3, 0)], top);
  B.poly([T(7, 0), T(-3, 0), T(-6, 3.5 * Math.abs(fl) + 0.5)], under);
  B.poly([T(7, 0), T(-3, 0), T(-4, 1.5)], cols.dark);
}
