/* A YEAR, STILL WARM — the hand, for the living things.
 * The original's free-hand line (Catmull-Rom through a few points, with a tremor
 * and a tapering pressure), except that the tremor now belongs to the stroke: the
 * same `seed` always wobbles the same way, so a blade drawn again tomorrow is the
 * same blade and nothing boils.
 */
'use strict';
function createHand(E) {
  const { PX, PY, PP, hash2 } = E;
  function pathPts(pts, o, seed) {
    const step = o.step || 1.4, wob = o.wob === undefined ? 0.3 : o.wob, p0 = o.p0 === undefined ? 0.5 : o.p0, p1 = o.p1 === undefined ? 0.5 : o.p1, pm = o.press === undefined ? 1 : o.press;
    let n = 0; const ph1 = hash2(seed, 1, 51) * 6.28, ph2 = hash2(seed, 2, 51) * 6.28;
    const m = pts.length;
    if (m === 1) { PX[0] = pts[0][0]; PY[0] = pts[0][1]; PP[0] = pm; return 1; }
    let total = 0; for (let i = 0; i < m - 1; i++) total += Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]);
    let acc = 0;
    for (let i = 0; i < m - 1; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[i], c = pts[i + 1], d = pts[Math.min(m - 1, i + 2)];
      const L = Math.hypot(c[0] - b[0], c[1] - b[1]), k = Math.max(1, Math.round(L / step));
      for (let j = 0; j < k + (i === m - 2 ? 1 : 0); j++) {
        const t = j / k, t2 = t * t, t3 = t2 * t;
        const x = 0.5 * ((2 * b[0]) + (-a[0] + c[0]) * t + (2 * a[0] - 5 * b[0] + 4 * c[0] - d[0]) * t2 + (-a[0] + 3 * b[0] - 3 * c[0] + d[0]) * t3);
        const y = 0.5 * ((2 * b[1]) + (-a[1] + c[1]) * t + (2 * a[1] - 5 * b[1] + 4 * c[1] - d[1]) * t2 + (-a[1] + 3 * b[1] - 3 * c[1] + d[1]) * t3);
        const u = (acc + L * t) / (total || 1), sdist = acc + L * t;
        const nx = -(c[1] - b[1]) / (L || 1), ny = (c[0] - b[0]) / (L || 1);
        const wv = wob * (0.6 * Math.sin(sdist * 0.33 + ph1) + Math.sin(sdist * 0.085 + ph2));
        if (n >= E.MAXP - 1) break;
        PX[n] = x + nx * wv; PY[n] = y + ny * wv;
        const tp = Math.min(1, u / 0.12 * (1 - p0) + p0) * Math.min(1, (1 - u) / 0.2 * (1 - p1) + p1);
        PP[n] = pm * tp * (0.9 + 0.2 * hash2(seed, n + 3, 52));
        n++;
      }
      acc += L;
    }
    return n;
  }
  const DL = {}, DP = { wob: 0.15, p0: 0.3, p1: 0.2, step: 0.8 };
  function line(pts, w, T, col, o, seed) { const n = pathPts(pts, o || DL, seed | 0); E.stroke(n, w, T, col, o && o.op !== undefined ? o.op : 1, seed | 0); }
  // the pin: col = null finds the bare paper
  function pin(pts, w, st, col, o, seed) { const n = pathPts(pts, o || DP, seed | 0); E.scratch(n, w, st === undefined ? 0.92 : st, col); }
  function rub(pts, w, st, col) { const n = pathPts(pts, { wob: 0, p0: 1, p1: 1, step: Math.max(1, w * 0.2) }, 1); E.erase(n, w, st, col); }
  function dot(x, y, w, T, col, p, op, seed) { PX[0] = x; PY[0] = y; PP[0] = p === undefined ? 1 : p; E.stroke(1, w, T, col, op === undefined ? 1 : op, seed | 0); }
  function pinDot(x, y, w, st, col) { PX[0] = x; PY[0] = y; PP[0] = 1; E.scratch(1, w, st === undefined ? 0.95 : st, col); }
  function rubDot(x, y, w, st, col) { PX[0] = x; PY[0] = y; PP[0] = 1; E.erase(1, w, st, col); }
  // a three-point stroke without the spline (fast path for blades and small leaves)
  function tri(x0, y0, x1, y1, x2, y2, pa, pb, pc) {
    const k = 6; for (let j = 0; j <= k; j++) { const t = j / k, u = 1 - t; PX[j] = u * u * x0 + 2 * u * t * x1 + t * t * x2; PY[j] = u * u * y0 + 2 * u * t * y1 + t * t * y2; PP[j] = t < 0.5 ? pa + (pb - pa) * t * 2 : pb + (pc - pb) * (t - 0.5) * 2; } return k + 1;
  }
  return { pathPts, line, pin, rub, dot, pinDot, rubDot, tri };
}
module.exports = { createHand };
