/* Drawing kit shared by the zoom worlds: noise, cells, packing, colour, and ink helpers bound to a page. */
(function (g) {
  'use strict';
  const S = g.Sketch, TAU = Math.PI * 2, lerp = S.lerp, L = g.SketchZoom.lib;
  L.TAU = TAU; L.lerp = lerp;
  L.rng = seed => { let a = seed | 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  const hash = (x, y, s) => { let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 144665)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  L.noise = (x, y, s = 0) => { const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf); return lerp(lerp(hash(xi, yi, s), hash(xi + 1, yi, s), u), lerp(hash(xi, yi + 1, s), hash(xi + 1, yi + 1, s), u), v); };
  L.fbm = (x, y, oct = 4, s = 0) => { let v = 0, amp = 0.5, f = 1, n = 0; for (let i = 0; i < oct; i++) { v += amp * L.noise(x * f, y * f, s + i * 17); n += amp; f *= 2; amp *= 0.5; } return v / n; };
  /* colour */
  const rgb = h => { h = h.replace('#', ''); if (h.length === 3) h = h.split('').map(c => c + c).join(''); const n = parseInt(h, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const hex = c => '#' + c.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
  L.mix = (a, b, t) => { const A = rgb(a), B = rgb(b); return hex(A.map((v, i) => lerp(v, B[i], t))); };
  L.shade = (a, k) => k < 0 ? L.mix(a, '#000000', -k) : L.mix(a, '#ffffff', k);
  /* shapes */
  L.rect = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
  L.ell = (cx, cy, rx, ry, n = 32, rot = 0, a0 = 0, a1 = TAU) => { const out = [], cr = Math.cos(rot), sr = Math.sin(rot), full = Math.abs(a1 - a0 - TAU) < 1e-9; for (let i = 0; i < (full ? n : n + 1); i++) { const a = a0 + (a1 - a0) * i / n, x = Math.cos(a) * rx, y = Math.sin(a) * ry; out.push([cx + x * cr - y * sr, cy + x * sr + y * cr]); } return out; };
  L.rot = (pts, cx, cy, th) => { const c = Math.cos(th), s = Math.sin(th); return pts.map(([x, y]) => [cx + (x - cx) * c - (y - cy) * s, cy + (x - cx) * s + (y - cy) * c]); };
  L.move = (pts, dx, dy, k = 1) => pts.map(([x, y]) => [dx + x * k, dy + y * k]);
  L.blob = (cx, cy, r, n, jit, R, sq = 1) => Array.from({ length: n }, (_, i) => { const a = i * TAU / n, rr = r * (1 + (R() - 0.5) * 2 * jit); return [cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * sq]; });
  L.bbox = pts => { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; pts.forEach(([x, y]) => { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }); return [x0, y0, x1, y1]; };
  L.area = poly => { let a = 0; for (let i = 0; i < poly.length; i++) { const p = poly[i], q = poly[(i + 1) % poly.length]; a += p[0] * q[1] - q[0] * p[1]; } return a / 2; };
  L.centroid = poly => { let x = 0, y = 0; poly.forEach(p => { x += p[0]; y += p[1]; }); return [x / poly.length, y / poly.length]; };
  L.pip = S.pip;
  L.ribbon = (pts, w0, w1 = w0) => { const Lf = [], Rt = [], n = pts.length; pts.forEach((p, i) => { const q = pts[Math.min(n - 1, i + 1)], o = pts[Math.max(0, i - 1)], tx = q[0] - o[0], ty = q[1] - o[1], l = Math.hypot(tx, ty) || 1, w = lerp(w0, w1, n > 1 ? i / (n - 1) : 0); Lf.push([p[0] - ty / l * w, p[1] + tx / l * w]); Rt.push([p[0] + ty / l * w, p[1] - tx / l * w]); }); return Lf.concat(Rt.reverse()); };
  L.shrink = (poly, k) => { const [cx, cy] = L.centroid(poly); return poly.map(([x, y]) => [cx + (x - cx) * k, cy + (y - cy) * k]); };
  /* Sutherland–Hodgman against a convex clip polygon */
  L.clip = (subj, clip) => { let out = subj; const s0 = Math.sign(L.area(clip)) || 1; for (let i = 0; i < clip.length && out.length; i++) { const A = clip[i], B = clip[(i + 1) % clip.length], side = p => ((B[0] - A[0]) * (p[1] - A[1]) - (B[1] - A[1]) * (p[0] - A[0])) * s0; const res = []; for (let j = 0; j < out.length; j++) { const P1 = out[j], P2 = out[(j + 1) % out.length], d1 = side(P1), d2 = side(P2); if (d1 >= 0) res.push(P1); if ((d1 >= 0) !== (d2 >= 0)) { const t = d1 / (d1 - d2); res.push([lerp(P1[0], P2[0], t), lerp(P1[1], P2[1], t)]); } } out = res; } return out; };
  /* Voronoi cells of seeds inside a convex bound (half-plane clipping; fine for a few hundred seeds) */
  L.voronoi = (seeds, bound) => seeds.map((s, i) => { let cell = bound.slice(); const near = seeds.map((q, j) => [j, (q[0] - s[0]) ** 2 + (q[1] - s[1]) ** 2]).filter(([j]) => j !== i).sort((a, b) => a[1] - b[1]).slice(0, 24);
    for (const [j] of near) { const q = seeds[j], mx = (s[0] + q[0]) / 2, my = (s[1] + q[1]) / 2, nx = q[0] - s[0], ny = q[1] - s[1]; const res = []; for (let k = 0; k < cell.length; k++) { const P1 = cell[k], P2 = cell[(k + 1) % cell.length], d1 = (P1[0] - mx) * nx + (P1[1] - my) * ny, d2 = (P2[0] - mx) * nx + (P2[1] - my) * ny; if (d1 <= 0) res.push(P1); if ((d1 <= 0) !== (d2 <= 0)) { const t = d1 / (d1 - d2); res.push([lerp(P1[0], P2[0], t), lerp(P1[1], P2[1], t)]); } } cell = res; if (!cell.length) break; }
    return cell; });
  /* Poisson-disc sampling inside a test function over a box */
  L.poisson = (box, r, R, inside = () => true, max = 20000) => { const cs = r / Math.SQRT2, gw = Math.ceil((box[2] - box[0]) / cs), gh = Math.ceil((box[3] - box[1]) / cs), grid = new Int32Array(gw * gh).fill(-1), pts = [], act = [];
    const put = p => { pts.push(p); act.push(p); grid[Math.floor((p[1] - box[1]) / cs) * gw + Math.floor((p[0] - box[0]) / cs)] = pts.length - 1; };
    const ok = p => { if (p[0] < box[0] || p[0] >= box[2] || p[1] < box[1] || p[1] >= box[3] || !inside(p)) return false; const gx = Math.floor((p[0] - box[0]) / cs), gy = Math.floor((p[1] - box[1]) / cs); for (let y = Math.max(0, gy - 2); y <= Math.min(gh - 1, gy + 2); y++) for (let x = Math.max(0, gx - 2); x <= Math.min(gw - 1, gx + 2); x++) { const i = grid[y * gw + x]; if (i >= 0 && (pts[i][0] - p[0]) ** 2 + (pts[i][1] - p[1]) ** 2 < r * r) return false; } return true; };
    for (let t = 0; t < 60 && !pts.length; t++) { const p = [lerp(box[0], box[2], R()), lerp(box[1], box[3], R())]; if (ok(p)) put(p); }
    while (act.length && pts.length < max) { const i = Math.floor(R() * act.length), b = act[i]; let found = false; for (let k = 0; k < 20; k++) { const a = R() * TAU, d = r * (1 + R()), p = [b[0] + Math.cos(a) * d, b[1] + Math.sin(a) * d]; if (ok(p)) { put(p); found = true; break; } } if (!found) act.splice(i, 1); }
    return pts; };
  L.blend = (P, mode, fn) => { const i0 = P.ops.length; fn(); for (let i = i0; i < P.ops.length; i++) P.ops[i].blend = mode; };
  /* ink kit bound to a page */
  L.convex = poly => { const n = poly.length; let sg = 0; for (let i = 0; i < n; i++) { const a = poly[i], b = poly[(i + 1) % n], c = poly[(i + 2) % n], cr = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]); if (Math.abs(cr) < 1e-9) continue; const s = Math.sign(cr); if (sg && s !== sg) return false; sg = s; } return true; };
  L.kit = (P, K = '#1a1410', ko = {}) => {
    const RO = ko.rough ?? 0.2, OV = ko.over ?? 0;
    const k = {
      K,
      fill: (poly, c, a = 1) => P.wash(poly, c, a, { edge: 0, jit: 0, steps: 1 }),
      lin: (poly, c0, a0, c1, a1, x0, y0, x1, y1) => P.wash(poly, c0, 1, { edge: 0, jit: 0, steps: 1, grad: { x0, y0, x1, y1, c0, a0, c1, a1 } }),
      rad: (poly, cx, cy, r, c0, a0, c1, a1, r0 = 0) => P.wash(poly, c0, 1, { edge: 0, jit: 0, steps: 1, grad: { x0: cx, y0: cy, x1: cx + r, y1: cy, r0, r1: r, c0, a0, c1, a1 } }),
      glow: (cx, cy, r, c, a = 0.6, mode = 'lighter') => L.blend(P, mode, () => k.rad(L.ell(cx, cy, r, r, 28), cx, cy, r, c, a, c, 0)),
      ink: (pts, w = 1, c = K, a = 0.95, closed = false) => P.path(closed ? pts.concat([pts[0]]) : pts, { w, c, a, rough: RO, passes: 1 }),
      line: (a, b, w = 1, c = K, al = 0.95) => P.line(a[0], a[1], b[0], b[1], { w, c, a: al, passes: 1, over: OV, rough: RO }),
      curve: (pts, w = 1, c = K, a = 0.95) => P.curve(pts, { w, c, a, passes: 1, rough: RO }),
      outline: (poly, w = 1, c = K, a = 0.95) => P.path(poly.concat([poly[0]]), { w, c, a, rough: RO, passes: 1 }),
      hatch: (poly, ang, gap, c = K, a = 0.6, w = 0.45, o = {}) => P.hatch(poly, Object.assign({ ang, gap, c, a, w }, o)),
      stip: (poly, n, c = K, a = 0.8, r = 0.6, fade) => P.stipple(poly, n, { c, a, r, fade }),
      dot: (x, y, r, c = K, a = 1) => P.dot(x, y, r, { c, a }),
      dots: (arr, c = K, a = 1) => P.dots(arr, c, a),
      circle: (x, y, r, w = 1, c = K, a = 0.95) => P.circle(x, y, r, { w, c, a, passes: 1 }),
      text: (s, x, y, sz, c = K, o = {}) => P.text(s, x, y, Object.assign({ size: sz, c }, o)),
      /* a filled leaf with a lit side, midrib and outline */
      leaf: (x, y, ang, len, wid, col, o = {}) => {
        const ca = Math.cos(ang), sa = Math.sin(ang), T = (u, v) => [x + ca * u - sa * v, y + sa * u + ca * v], n = o.n ?? 8, Lp = [], Rp = [];
        for (let i = 0; i <= n; i++) { const u = len * i / n, v = wid * Math.pow(Math.sin(Math.PI * i / n), o.round ?? 0.75); Lp.push(T(u, -v)); Rp.push(T(u, v)); }
        const poly = Lp.concat(Rp.reverse().slice(1, -1)); k.fill(poly, col, o.a ?? 1);
        if (o.lit !== false) k.lin(poly, '#ffffff', o.la ?? 0.22, col, 0, ...T(len * 0.3, -wid), ...T(len * 0.5, wid));
        if (o.vein !== false) k.line(T(0, 0), T(len * 0.85, 0), o.vw ?? 0.25, o.vc || L.shade(col, -0.4), 0.8);
        if (o.ol !== false) k.outline(poly, o.ow ?? 0.3, o.oc || L.shade(col, -0.5), 0.8);
        return poly;
      },
      /* washes that sit on top of what is already there */
      mul: (poly, c, a = 0.5) => L.blend(P, 'multiply', () => k.fill(poly, c, a)),
      scr: (poly, c, a = 0.5) => L.blend(P, 'screen', () => k.fill(poly, c, a)),
      /* watercolour: a flat wash, pigment blooms that stay inside the shape, granulation in noisy patches, a pooled darker edge */
      wc: (poly, col, o = {}) => {
        const a = o.a ?? 1; k.fill(poly, col, a);
        const [x0, y0, x1, y1] = L.bbox(poly), w = x1 - x0, h = y1 - y0, cv = L.convex(poly), m = Math.min(w, h);
        const nb = o.blooms ?? Math.max(1, Math.min(14, Math.round(w * h / 3000)));
        for (let i = 0; i < nb; i++) {
          const cx = lerp(x0, x1, P.R()), cy = lerp(y0, y1, P.R()), r = m * (0.18 + P.R() * 0.45);
          let b = L.blob(cx, cy, r, 12, 0.3, P.R, h < w ? 0.7 : 1.3);
          if (cv) b = L.clip(b, poly); else if (!b.every(p => L.pip(poly, p[0], p[1]))) continue;
          if (b.length > 2) k.fill(b, L.shade(col, P.R() < 0.55 ? -(o.dk ?? 0.13) : (o.lt ?? 0.11)), (o.ba ?? 0.3) * a);
        }
        const gn = o.gran ?? 0.012;
        if (gn > 0) { const s0 = Math.floor(P.R() * 1000), sc = o.gs ?? 30; k.stip(poly, Math.round(w * h * gn), o.gc || L.shade(col, -0.4), (o.ga ?? 0.3) * a, o.gr ?? 0.5, (x, y) => L.fbm(x / sc, y / sc, 3, s0) * 1.8 - 0.5); }
        if (o.edge !== 0) k.outline(poly, o.edge ?? 1.3, L.shade(col, -0.3), (o.ea ?? 0.3) * a);
      }
    };
    return k;
  };
})(window);
