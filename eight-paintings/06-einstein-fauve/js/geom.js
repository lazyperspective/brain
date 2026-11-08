// Curve helpers and a scanline polygon rasterizer (design space 1000 x 1250).
(function (G) {
  'use strict';
  function cr(p0, p1, p2, p3, t) {
    const t2 = t * t, t3 = t2 * t;
    return [
      0.5 * ((2 * p1[0]) + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
      0.5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
    ];
  }
  function closed(pts, n) {
    n = n || 10; const out = []; const L = pts.length;
    for (let i = 0; i < L; i++) {
      const p0 = pts[(i - 1 + L) % L], p1 = pts[i], p2 = pts[(i + 1) % L], p3 = pts[(i + 2) % L];
      for (let k = 0; k < n; k++) out.push(cr(p0, p1, p2, p3, k / n));
    }
    return out;
  }
  function open(pts, n) {
    n = n || 10; const out = []; const L = pts.length;
    for (let i = 0; i < L - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(L - 1, i + 2)];
      for (let k = 0; k < n; k++) out.push(cr(p0, p1, p2, p3, k / n));
    }
    out.push(pts[L - 1].slice());
    return out;
  }
  function ellipse(cx, cy, rx, ry, n, rot) {
    n = n || 48; rot = rot || 0; const out = [];
    const c = Math.cos(rot), s = Math.sin(rot);
    for (let i = 0; i < n; i++) {
      const a = i / n * Math.PI * 2; const x = Math.cos(a) * rx, y = Math.sin(a) * ry;
      out.push([cx + x * c - y * s, cy + x * s + y * c]);
    }
    return out;
  }
  // Rasterize polygon (design coords) into a Uint8Array mask of size w x h with scale k (px per design unit).
  function rasterPoly(mask, w, h, k, poly, val) {
    let minY = Infinity, maxY = -Infinity;
    for (const p of poly) { minY = Math.min(minY, p[1] * k); maxY = Math.max(maxY, p[1] * k); }
    const y0 = Math.max(0, Math.floor(minY)), y1 = Math.min(h - 1, Math.ceil(maxY));
    const xs = [];
    const L = poly.length;
    for (let y = y0; y <= y1; y++) {
      const yc = y + 0.5; xs.length = 0;
      for (let i = 0; i < L; i++) {
        const a = poly[i], b = poly[(i + 1) % L];
        const ay = a[1] * k, by = b[1] * k;
        if ((ay <= yc && by > yc) || (by <= yc && ay > yc)) {
          xs.push(a[0] * k + (yc - ay) / (by - ay) * (b[0] * k - a[0] * k));
        }
      }
      xs.sort((p, q) => p - q);
      for (let i = 0; i + 1 < xs.length; i += 2) {
        const xa = Math.max(0, Math.ceil(xs[i] - 0.5)), xb = Math.min(w - 1, Math.floor(xs[i + 1] - 0.5));
        for (let x = xa; x <= xb; x++) mask[y * w + x] = val;
      }
    }
  }
  function polyLen(p) { let s = 0; for (let i = 1; i < p.length; i++) s += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]); return s; }
  // resample polyline at spacing d
  function resample(p, d) {
    const out = [p[0].slice()]; let acc = 0;
    for (let i = 1; i < p.length; i++) {
      let ax = p[i - 1][0], ay = p[i - 1][1];
      const bx = p[i][0], by = p[i][1];
      let seg = Math.hypot(bx - ax, by - ay);
      while (acc + seg >= d) {
        const t = (d - acc) / seg; ax = ax + (bx - ax) * t; ay = ay + (by - ay) * t;
        out.push([ax, ay]); seg = Math.hypot(bx - ax, by - ay); acc = 0;
      }
      acc += seg;
    }
    const last = p[p.length - 1];
    if (Math.hypot(last[0] - out[out.length - 1][0], last[1] - out[out.length - 1][1]) > d * 0.3) out.push(last.slice());
    return out;
  }
  G.Geom = { closed, open, ellipse, rasterPoly, polyLen, resample };
})(window);
