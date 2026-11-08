// Tiny vector toolkit for the plan: Catmull-Rom paths with optional corners, and an exact even-odd scanline
// rasteriser that writes shape ids into a sample grid (later shapes cover earlier ones).
(function (G) {
  'use strict';
  // pts: [[x, y] smooth | [x, y, 1] corner, ...]; returns a dense closed (or open) polyline
  function path(pts, closed, step) {
    if (closed === undefined) closed = true;
    step = step || 5;
    const n = pts.length, out = [];
    const P = (i) => (closed ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))]);
    const segs = closed ? n : n - 1;
    for (let i = 0; i < segs; i++) {
      const p1 = P(i), p2 = P(i + 1);
      let p0 = P(i - 1), p3 = P(i + 2);
      if (p1[2]) p0 = p1;
      if (p2[2]) p3 = p2;
      const len = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
      const k = Math.max(2, Math.ceil(len / step));
      for (let j = 0; j < k; j++) {
        const t = j / k, t2 = t * t, t3 = t2 * t;
        const a = -0.5 * t3 + t2 - 0.5 * t, b = 1.5 * t3 - 2.5 * t2 + 1, c = -1.5 * t3 + 2 * t2 + 0.5 * t, d = 0.5 * t3 - 0.5 * t2;
        out.push([a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0], a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1]]);
      }
    }
    if (!closed) out.push([pts[n - 1][0], pts[n - 1][1]]);
    return out;
  }
  function ellipse(cx, cy, rx, ry, rot, n) {
    n = n || 48; rot = rot || 0;
    const c = Math.cos(rot), s = Math.sin(rot), out = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2, x = Math.cos(a) * rx, y = Math.sin(a) * ry;
      out.push([cx + x * c - y * s, cy + x * s + y * c]);
    }
    return out;
  }
  // even-odd fill of polyline `poly` (design coords * k) into ids (gw x gh) with value v
  function fill(ids, gw, gh, poly, k, v) {
    const n = poly.length;
    let ymin = Infinity, ymax = -Infinity;
    const xs0 = new Float64Array(n), ys0 = new Float64Array(n);
    for (let i = 0; i < n; i++) { xs0[i] = poly[i][0] * k; ys0[i] = poly[i][1] * k; if (ys0[i] < ymin) ymin = ys0[i]; if (ys0[i] > ymax) ymax = ys0[i]; }
    const r0 = Math.max(0, Math.ceil(ymin - 0.5)), r1 = Math.min(gh - 1, Math.floor(ymax - 0.5));
    const hits = [];
    for (let r = r0; r <= r1; r++) {
      const sy = r + 0.5;
      hits.length = 0;
      for (let i = 0, j = n - 1; i < n; j = i++) {
        const ya = ys0[j], yb = ys0[i];
        if ((ya <= sy && yb > sy) || (yb <= sy && ya > sy)) hits.push(xs0[j] + ((sy - ya) * (xs0[i] - xs0[j])) / (yb - ya));
      }
      hits.sort((a, b) => a - b);
      const row = r * gw;
      for (let h = 0; h + 1 < hits.length; h += 2) {
        const c0 = Math.max(0, Math.ceil(hits[h] - 0.5)), c1 = Math.min(gw - 1, Math.floor(hits[h + 1] - 0.5));
        if (v < 0) { for (let c = c0; c <= c1; c++) ids[row + c] |= -v; } else for (let c = c0; c <= c1; c++) ids[row + c] = v;
      }
    }
  }
  function inside(poly, x, y) {
    let c = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
    }
    return c;
  }
  // distance from point to polyline (open)
  function distPoly(poly, x, y, closed) {
    let best = Infinity;
    const n = poly.length, m = closed ? n : n - 1;
    for (let i = 0; i < m; i++) {
      const a = poly[i], b = poly[(i + 1) % n];
      const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy || 1;
      let t = ((x - a[0]) * dx + (y - a[1]) * dy) / l2; t = t < 0 ? 0 : t > 1 ? 1 : t;
      const d = Math.hypot(x - a[0] - t * dx, y - a[1] - t * dy);
      if (d < best) best = d;
    }
    return best;
  }
  G.V = { path, ellipse, fill, inside, distPoly };
})(typeof window !== 'undefined' ? window : globalThis);
