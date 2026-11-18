'use strict';
const { T, rng32, hex, clamp, lerp, mixc, sstep, vnoise, fbm } = require('./engine');

// wobbly hand-drawn line between two points
function wob(x0, y0, x1, y1, rng, amp, bow) {
  const L = Math.hypot(x1 - x0, y1 - y0);
  const n = Math.max(2, Math.ceil(L / 7) + 1);
  amp = amp === undefined ? 0.5 : amp; bow = bow === undefined ? 0.01 : bow;
  const nx = -(y1 - y0) / (L || 1), ny = (x1 - x0) / (L || 1);
  const ph1 = rng() * 6.283, ph2 = rng() * 6.283, f1 = 0.02 + rng() * 0.03, f2 = 0.07 + rng() * 0.08;
  const b = (rng() - 0.5) * 2 * bow * L;
  const pts = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1), d = t * L;
    const env = Math.sin(Math.PI * t);
    const o = amp * (Math.sin(ph1 + d * f1) * 0.7 + Math.sin(ph2 + d * f2) * 0.3) * (0.4 + 0.6 * env) + b * env;
    pts.push([x0 + (x1 - x0) * t + nx * o, y0 + (y1 - y0) * t + ny * o]);
  }
  return pts;
}
function wobPath(P, rng, amp, bow) { // polyline through points
  let out = [];
  for (let i = 0; i < P.length - 1; i++) {
    const s = wob(P[i][0], P[i][1], P[i + 1][0], P[i + 1][1], rng, amp, bow);
    if (i) s.shift(); out = out.concat(s);
  }
  return out;
}
function arc(cx, cy, rx, ry, a0, a1, rng, amp) {
  const n = Math.max(4, Math.ceil(Math.abs(a1 - a0) * Math.max(rx, ry) / 5));
  const pts = []; amp = amp || 0; const ph = rng ? rng() * 6.283 : 0;
  for (let i = 0; i <= n; i++) {
    const a = a0 + (a1 - a0) * i / n, k = 1 + (amp ? amp * Math.sin(ph + a * 3.1) / Math.max(rx, ry) : 0);
    pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]);
  }
  return pts;
}
// smooth curve through control points (Catmull-Rom)
function curve(P, seg) {
  seg = seg || 10; const out = [];
  for (let i = 0; i < P.length - 1; i++) {
    const p0 = P[Math.max(0, i - 1)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(P.length - 1, i + 2)];
    for (let k = 0; k < seg; k++) {
      const t = k / seg, t2 = t * t, t3 = t2 * t;
      out.push([0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
      0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3)]);
    }
  }
  out.push(P[P.length - 1].slice(0, 2));
  return out;
}
// hatch runs clipped to polygon
function hatchRuns(poly, ang, spacing, rng, jit) {
  const c = Math.cos(-ang), s = Math.sin(-ang), n = poly.length;
  const rx = new Array(n), ry = new Array(n);
  let miny = 1e9, maxy = -1e9;
  for (let i = 0; i < n; i++) { rx[i] = poly[i][0] * c - poly[i][1] * s; ry[i] = poly[i][0] * s + poly[i][1] * c; if (ry[i] < miny) miny = ry[i]; if (ry[i] > maxy) maxy = ry[i]; }
  const runs = []; jit = jit === undefined ? 0.25 : jit;
  const c2 = Math.cos(ang), s2 = Math.sin(ang);
  for (let y = miny + spacing * (0.2 + 0.5 * rng()); y < maxy; y += spacing * (1 + (rng() - 0.5) * 2 * jit)) {
    const xs = [];
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n, y0 = ry[i], y1 = ry[j];
      if ((y0 <= y && y1 > y) || (y1 <= y && y0 > y)) xs.push(rx[i] + (rx[j] - rx[i]) * (y - y0) / (y1 - y0));
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const xa = xs[k], xb = xs[k + 1]; if (xb - xa < 0.3) continue;
      runs.push([xa * c2 - y * s2, xa * s2 + y * c2, xb * c2 - y * s2, xb * s2 + y * c2]);
    }
  }
  return runs;
}
function jit(col, a, rng) { const d = (rng() - 0.5) * 2 * a; return [clamp(col[0] + d + (rng() - 0.5) * a, 0, 1), clamp(col[1] + d + (rng() - 0.5) * a, 0, 1), clamp(col[2] + d + (rng() - 0.5) * a, 0, 1)]; }

// fill polygon with hatching strokes
function fillPoly(cv, poly, o, rng) {
  const tool = o.tool || T.pencil, w = o.w || 2;
  const sp = (o.sp || 0.8) * w;
  const runs = hatchRuns(poly, o.ang || 0, sp, rng, o.jit);
  const over = o.over === undefined ? 0.5 : o.over, maxLen = o.maxLen || 220;
  const flatInset = tool.flat ? 0 : w * 0.35;
  for (const r of runs) {
    let [x0, y0, x1, y1] = r;
    const L = Math.hypot(x1 - x0, y1 - y0); if (L < 0.2) continue;
    const ux = (x1 - x0) / L, uy = (y1 - y0) / L;
    const e0 = -flatInset + (rng() - 0.35) * over * 2, e1 = -flatInset + (rng() - 0.35) * over * 2;
    x0 -= ux * e0; y0 -= uy * e0; x1 += ux * e1; y1 += uy * e1;
    const L2 = Math.hypot(x1 - x0, y1 - y0); if (L2 < 0.4) { continue; }
    const np = Math.max(1, Math.ceil(L2 / (maxLen * (0.7 + 0.6 * rng()))));
    for (let k = 0; k < np; k++) {
      const ta = k / np - (k ? 0.03 * rng() : 0), tb = (k + 1) / np + (k < np - 1 ? 0.03 * rng() : 0);
      let ax = x0 + ux * L2 * ta, ay = y0 + uy * L2 * ta, bx = x0 + ux * L2 * tb, by = y0 + uy * L2 * tb;
      if (rng() < 0.5) { const tx = ax, ty = ay; ax = bx; ay = by; bx = tx; by = ty; }
      let col = o.colFn ? o.colFn((ax + bx) / 2, (ay + by) / 2) : o.col;
      if (o.cj) col = jit(col, o.cj, rng);
      cv.stroke(wob(ax, ay, bx, by, rng, o.wob === undefined ? 0.35 : o.wob, o.bow === undefined ? 0.008 : o.bow),
        { ...tool, w: w * (0.85 + 0.3 * rng()), col, P: (o.P || 0.8) * (0.88 + 0.24 * rng()) });
    }
  }
}
// hand-drawn outline of a polyline / polygon
function outline(cv, P, o, rng, closed) {
  const n = P.length, tool = o.tool || T.pencil;
  for (let i = 0; i < (closed ? n : n - 1); i++) {
    if (o.skip && rng() < o.skip) continue;
    const a = P[i], b = P[(i + 1) % n];
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 0.5) continue;
    const ux = (b[0] - a[0]) / L, uy = (b[1] - a[1]) / L, ov = (o.over === undefined ? 1 : o.over);
    const e0 = (rng() - 0.3) * ov, e1 = (rng() - 0.3) * ov;
    cv.stroke(wob(a[0] - ux * e0, a[1] - uy * e0, b[0] + ux * e1, b[1] + uy * e1, rng, o.wob === undefined ? 0.4 : o.wob, 0.006),
      { ...tool, w: (o.w || 1.3) * (0.85 + 0.3 * rng()), col: o.col, P: (o.P || 0.8) * (0.85 + 0.3 * rng()) });
  }
}
// pick a stick from a set by dithering between the two nearest
function pick(target, sticks, rng, sharp) {
  let b1 = -1, b2 = -1, d1 = 1e9, d2 = 1e9;
  for (let i = 0; i < sticks.length; i++) {
    const s = sticks[i], d = (s[0] - target[0]) ** 2 * 0.9 + (s[1] - target[1]) ** 2 * 1.2 + (s[2] - target[2]) ** 2;
    if (d < d1) { d2 = d1; b2 = b1; d1 = d; b1 = i; } else if (d < d2) { d2 = d; b2 = i; }
  }
  if (b2 < 0) return sticks[b1];
  const p = Math.pow(d1 / (d1 + d2 + 1e-9), sharp || 1) ;
  return rng() < p ? sticks[b2] : sticks[b1];
}
function grad(stops, t) { // stops [[t,col]...]
  if (t <= stops[0][0]) return stops[0][1];
  for (let i = 1; i < stops.length; i++) if (t <= stops[i][0]) { const a = stops[i - 1], b = stops[i]; return mixc(a[1], b[1], (t - a[0]) / (b[0] - a[0])); }
  return stops[stops.length - 1][1];
}
module.exports = { wob, wobPath, arc, curve, hatchRuns, fillPoly, outline, pick, grad, jit };
