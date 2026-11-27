// Hand-ink engine: seeded boil, variable-width brush polygons, cel fills.
// All geometry is authored in "local" coords, pushed through an affine stack,
// then jittered (boil) in world space so line weight never scales with transforms.
'use strict';

const E = (() => {
  // ---------- seeded randomness ----------
  function ihash(x) {
    x |= 0;
    x = Math.imul(x ^ (x >>> 16), 0x7feb352d);
    x = Math.imul(x ^ (x >>> 15), 0x846ca68b);
    return (x ^ (x >>> 16)) >>> 0;
  }
  function rnd(...k) {
    let h = 0x9e3779b9;
    for (const v of k) h = ihash(h ^ ihash(Math.floor(v * 977) | 0));
    return h / 4294967296;
  }
  const srnd = (...k) => rnd(...k) * 2 - 1;
  function noise1(x, seed) {
    const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
    return srnd(seed, i) * (1 - u) + srnd(seed, i + 1) * u;
  }

  // ---------- state ----------
  const S = {
    ctx: null,
    draw: 0,       // drawing index (changes every 2 frames => boil)
    sid: 0,        // stroke id counter, reset each frame
    boil: 2.0,     // px jitter amplitude
    mis: [1.2, 0.8], // fill misregistration offset
    light: [-0.55, -0.83], // direction toward the light (up-left)
    M: [1, 0, 0, 1, 0, 0],
    stack: [],
  };

  const mul = (A, B) => [
    A[0] * B[0] + A[2] * B[1], A[1] * B[0] + A[3] * B[1],
    A[0] * B[2] + A[2] * B[3], A[1] * B[2] + A[3] * B[3],
    A[0] * B[4] + A[2] * B[5] + A[4], A[1] * B[4] + A[3] * B[5] + A[5],
  ];
  function push() { S.stack.push(S.M.slice()); }
  function pop() { S.M = S.stack.pop(); }
  function translate(x, y) { S.M = mul(S.M, [1, 0, 0, 1, x, y]); }
  function rotate(a) { const c = Math.cos(a), s = Math.sin(a); S.M = mul(S.M, [c, s, -s, c, 0, 0]); }
  function scale(x, y = x) { S.M = mul(S.M, [x, 0, 0, y, 0, 0]); }
  function xf(p) {
    const M = S.M;
    return [M[0] * p[0] + M[2] * p[1] + M[4], M[1] * p[0] + M[3] * p[1] + M[5], p[2]];
  }

  // ---------- geometry ----------
  // pts: [[x,y,flag]] (flag truthy => sharp corner). Returns world-space jittered control pts.
  function prep(pts, amp = S.boil, id = S.sid++) {
    return pts.map((p, i) => {
      const w = xf(p);
      const a = amp * (p[3] === undefined ? 1 : p[3]);
      return [w[0] + srnd(S.draw, id, i, 1) * a, w[1] + srnd(S.draw, id, i, 2) * a, p[2]];
    });
  }

  function spline(pts, closed, res = 5) {
    const n = pts.length, out = [];
    if (n < 2) return pts.slice();
    const P = (i) => closed ? pts[((i % n) + n) % n] : pts[Math.max(0, Math.min(n - 1, i))];
    const segs = closed ? n : n - 1;
    for (let i = 0; i < segs; i++) {
      let p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
      if (p1[2] || (!closed && i === 0)) p0 = [2 * p1[0] - p2[0], 2 * p1[1] - p2[1]];
      if (p2[2] || (!closed && i === segs - 1)) p3 = [2 * p2[0] - p1[0], 2 * p2[1] - p1[1]];
      const len = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
      const steps = Math.max(2, Math.ceil(len / res));
      for (let s = 0; s < steps; s++) {
        const t = s / steps, t2 = t * t, t3 = t2 * t;
        const f = (a, b, c, d) => 0.5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
        out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
      }
    }
    if (!closed) out.push([pts[n - 1][0], pts[n - 1][1]]);
    return out;
  }

  function arclen(poly) {
    const s = [0];
    for (let i = 1; i < poly.length; i++) s.push(s[i - 1] + Math.hypot(poly[i][0] - poly[i - 1][0], poly[i][1] - poly[i - 1][1]));
    return s;
  }
  function signedArea(poly) {
    let a = 0;
    for (let i = 0; i < poly.length; i++) { const p = poly[i], q = poly[(i + 1) % poly.length]; a += p[0] * q[1] - q[0] * p[1]; }
    return a / 2;
  }
  // sub-polyline between arclength a..b (b may exceed total for closed loops)
  function subpoly(poly, s, a, b, closed) {
    const L = s[s.length - 1] + (closed ? Math.hypot(poly[0][0] - poly[poly.length - 1][0], poly[0][1] - poly[poly.length - 1][1]) : 0);
    const out = [];
    const step = 3;
    const at = (d) => {
      if (closed) d = ((d % L) + L) % L; else d = Math.max(0, Math.min(L, d));
      let lo = 0, hi = s.length - 1;
      if (closed && d >= s[s.length - 1]) {
        const p = poly[poly.length - 1], q = poly[0], t = (d - s[s.length - 1]) / (L - s[s.length - 1] || 1);
        return [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
      }
      while (hi - lo > 1) { const m = (lo + hi) >> 1; if (s[m] <= d) lo = m; else hi = m; }
      const t = (d - s[lo]) / ((s[hi] - s[lo]) || 1);
      return [poly[lo][0] + (poly[hi][0] - poly[lo][0]) * t, poly[lo][1] + (poly[hi][1] - poly[lo][1]) * t];
    };
    const n = Math.max(2, Math.ceil((b - a) / step));
    for (let i = 0; i <= n; i++) out.push(at(a + (b - a) * i / n));
    return out;
  }

  // ---------- brush ----------
  // poly: dense world polyline. o: {w, t0, t1 (taper px), min, press, side(+1/-1/0 outward normal), shade, color, ext0, ext1}
  function brushPoly(poly, o) {
    if (poly.length < 2) return;
    const ctx = S.ctx;
    const id = S.sid++;
    poly = poly.slice();
    // overshoot / extension along tangent
    const ext = (i0, i1, d) => {
      const a = poly[i0], b = poly[i1];
      const L = Math.hypot(a[0] - b[0], a[1] - b[1]) || 1;
      return [a[0] + (a[0] - b[0]) / L * d, a[1] + (a[1] - b[1]) / L * d];
    };
    const e0 = o.ext0 ?? 0, e1 = o.ext1 ?? 0;
    if (e0) poly.unshift(ext(0, Math.min(2, poly.length - 1), e0));
    if (e1) poly.push(ext(poly.length - 1, Math.max(0, poly.length - 3), e1));
    const s = arclen(poly), L = s[s.length - 1];
    const w = o.w ?? 5, t0 = Math.min(o.t0 ?? 18, L * 0.5), t1 = Math.min(o.t1 ?? 18, L * 0.5);
    const mn = o.min ?? 0.08, press = o.press ?? 0.3, side = o.side ?? 0, shade = o.shade ?? 0.7;
    const Ld = S.light;
    const left = [], right = [];
    for (let i = 0; i < poly.length; i++) {
      const p = poly[i], a = poly[Math.max(0, i - 1)], b = poly[Math.min(poly.length - 1, i + 1)];
      let tx = b[0] - a[0], ty = b[1] - a[1];
      const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
      const nx = -ty, ny = tx;
      const d = s[i];
      let k = 1;
      if (d < t0) { const u = d / t0; k *= mn + (1 - mn) * Math.sin(u * Math.PI / 2); }
      if (L - d < t1) { const u = (L - d) / t1; k *= mn + (1 - mn) * Math.sin(u * Math.PI / 2); }
      k *= 1 + press * noise1(d / 60 + id * 7.3, S.draw * 131 + id);
      if (side) {
        const dot = (nx * side) * Ld[0] + (ny * side) * Ld[1];
        k *= 1 + shade * (-dot) * 0.85;
      }
      // joints: thicken at curvature
      if (o.joint) {
        const a2 = poly[Math.max(0, i - 4)], b2 = poly[Math.min(poly.length - 1, i + 4)];
        const v1x = p[0] - a2[0], v1y = p[1] - a2[1], v2x = b2[0] - p[0], v2y = b2[1] - p[1];
        const c = Math.abs(v1x * v2y - v1y * v2x) / ((Math.hypot(v1x, v1y) * Math.hypot(v2x, v2y)) || 1);
        k *= 1 + o.joint * c;
      }
      const hw = Math.max(0.25, w * k * 0.5);
      left.push([p[0] + nx * hw, p[1] + ny * hw]);
      right.push([p[0] - nx * hw, p[1] - ny * hw]);
    }
    ctx.beginPath();
    ctx.moveTo(left[0][0], left[0][1]);
    for (let i = 1; i < left.length; i++) ctx.lineTo(left[i][0], left[i][1]);
    for (let i = right.length - 1; i >= 0; i--) ctx.lineTo(right[i][0], right[i][1]);
    ctx.closePath();
    ctx.fillStyle = o.color || INK;
    ctx.fill();
  }

  const INK = '#24171b';

  // open ink line from local control points
  function line(pts, o = {}) {
    const P = prep(pts, o.boil ?? S.boil);
    const poly = spline(P, false, 4);
    const id = S.sid;
    brushPoly(poly, Object.assign({
      ext0: (o.over ?? 4) * rnd(S.draw, id, 5),
      ext1: (o.over ?? 4) * rnd(S.draw, id, 6),
    }, o));
  }

  // closed shape -> world dense polygon (jittered)
  function shape(pts, amp) { return spline(prep(pts, amp ?? S.boil), true, 4); }

  function pathOf(poly, ctx = S.ctx) {
    ctx.moveTo(poly[0][0], poly[0][1]);
    for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i][0], poly[i][1]);
    ctx.closePath();
  }
  function fill(poly, color, mis = true) {
    const ctx = S.ctx;
    ctx.save();
    if (mis) ctx.translate(S.mis[0], S.mis[1]);
    ctx.beginPath(); pathOf(poly); ctx.fillStyle = color; ctx.fill();
    ctx.restore();
  }
  // draw fn() clipped to poly(s)
  function clipTo(polys, fn, mis = true) {
    const ctx = S.ctx;
    ctx.save();
    if (mis) ctx.translate(S.mis[0], S.mis[1]);
    ctx.beginPath();
    for (const p of (Array.isArray(polys[0][0]) ? polys : [polys])) pathOf(p);
    ctx.clip();
    if (mis) ctx.translate(-S.mis[0], -S.mis[1]);
    fn();
    ctx.restore();
  }

  // ink a closed world polygon in a few overlapping hand strokes
  function outline(poly, o = {}) {
    const id = S.sid++;
    const s = arclen(poly);
    const L = s[s.length - 1] + Math.hypot(poly[0][0] - poly[poly.length - 1][0], poly[0][1] - poly[poly.length - 1][1]);
    const k = o.pieces ?? Math.max(1, Math.min(4, Math.round(L / 520)));
    const outward = signedArea(poly) > 0 ? -1 : 1; // screen coords (y down)
    // stable-ish break positions, wobbling a little per drawing
    const start = L * (rnd(id, 11) + 0.04 * srnd(S.draw, id, 12));
    for (let j = 0; j < k; j++) {
      const a = start + L * j / k + srnd(S.draw, id, j, 13) * 10;
      const b = start + L * (j + 1) / k + srnd(S.draw, id, j + 1, 13) * 10;
      const ov = o.overlap ?? 4;
      const sub = subpoly(poly, s, a - ov, b + ov + (o.gap ? -o.gap : 0), true);
      brushPoly(sub, Object.assign({ side: outward, t0: 22, t1: 22, min: 0.1 }, o));
    }
  }

  // filled + inked shape convenience
  function blob(pts, fillColor, o = {}) {
    const poly = shape(pts, o.boil);
    if (fillColor) fill(poly, fillColor);
    if (o.inside) clipTo(poly, () => o.inside(poly));
    if (o.ink !== false) outline(poly, o);
    return poly;
  }

  // ellipse control points
  function ell(cx, cy, rx, ry, n = 10, rot = 0, wob = 0, seed = 0) {
    const out = [];
    for (let i = 0; i < n; i++) {
      const a = i / n * Math.PI * 2;
      const r = 1 + wob * srnd(seed, i);
      const x = Math.cos(a) * rx * r, y = Math.sin(a) * ry * r;
      out.push([cx + x * Math.cos(rot) - y * Math.sin(rot), cy + x * Math.sin(rot) + y * Math.cos(rot)]);
    }
    return out;
  }

  return {
    S, rnd, srnd, noise1, push, pop, translate, rotate, scale, xf, prep, spline, arclen, subpoly,
    brushPoly, line, shape, fill, clipTo, outline, blob, pathOf, ell, INK, signedArea,
  };
})();
