// Painting primitives: dry-brush ink strokes, gouache fills, stain washes, cracks.
// All drawing happens at load into offscreen canvases; nothing here runs per frame.
(function () {
  const CY = window.CY;
  const { clamp, sm } = CY;

  CY.mk = function (w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h));
    return { c, g: c.getContext('2d', { willReadFrequently: false }), w: c.width, h: c.height };
  };
  CY.hex = (h) => { h = h.replace('#', ''); if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2]; return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; };
  CY.C = (c) => (typeof c === 'string' ? CY.hex(c) : c);
  CY.rgba = (c, a) => { c = CY.C(c); return `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a == null ? 1 : (+a).toFixed(3)})`; };
  CY.mix = (a, b, t) => { a = CY.C(a); b = CY.C(b); return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; };
  // vary a colour a little in value and warmth
  CY.jit = (c, R, v) => {
    c = CY.C(c);
    const k = 1 + (R.f() - 0.5) * 2 * v, w = (R.f() - 0.5) * v * 50;
    return [clamp(c[0] * k + w, 0, 255), clamp(c[1] * k + w * 0.2, 0, 255), clamp(c[2] * k - w * 0.6, 0, 255)];
  };
  CY.INK = [33, 28, 26];

  // ---------------------------------------------------------------- geometry helpers
  CY.resample = function (pts, step, closed) {
    const P = closed ? pts.concat([pts[0]]) : pts.slice();
    const cum = [0];
    for (let i = 1; i < P.length; i++) cum.push(cum[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
    const L = cum[cum.length - 1], n = Math.max(2, Math.ceil(L / step) + 1), out = new Array(n);
    let j = 0;
    for (let k = 0; k < n; k++) {
      const s = (L * k) / (n - 1);
      while (j < P.length - 2 && cum[j + 1] < s) j++;
      const seg = cum[j + 1] - cum[j] || 1, u = (s - cum[j]) / seg;
      out[k] = { x: P[j][0] + (P[j + 1][0] - P[j][0]) * u, y: P[j][1] + (P[j + 1][1] - P[j][1]) * u, s };
    }
    for (let k = 0; k < n; k++) {
      const a = out[closed ? (k - 1 + n) % n : Math.max(0, k - 1)], b = out[closed ? (k + 1) % n : Math.min(n - 1, k + 1)];
      const dx = b.x - a.x, dy = b.y - a.y, l = Math.hypot(dx, dy) || 1;
      out[k].nx = -dy / l; out[k].ny = dx / l;
    }
    out.L = L;
    return out;
  };
  CY.smooth = function (pts, it, closed) {
    let p = pts;
    for (let k = 0; k < (it || 2); k++) {
      const q = [], n = p.length;
      if (!closed) q.push(p[0]);
      for (let i = 0; i < (closed ? n : n - 1); i++) {
        const a = p[i], b = p[(i + 1) % n];
        q.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
      }
      if (!closed) q.push(p[n - 1]);
      p = q;
    }
    return p;
  };
  CY.circle = (cx, cy, r, n, a0, a1) => {
    n = n || 96; a0 = a0 || 0; a1 = a1 == null ? Math.PI * 2 : a1;
    const p = [];
    for (let i = 0; i < n; i++) { const a = a0 + ((a1 - a0) * i) / n; p.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); }
    return p;
  };
  CY.rect = (x, y, w, h) => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
  // an irregular closed blob
  CY.blob = function (cx, cy, rx, ry, seed, irr, n) {
    n = n || 48; irr = irr == null ? 0.3 : irr;
    const pts = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const r = 1 + (CY.fbm(Math.cos(a) * 1.6 + seed * 3.1, Math.sin(a) * 1.6 + seed, seed, 3) - 0.5) * 2 * irr;
      pts.push([cx + Math.cos(a) * rx * r, cy + Math.sin(a) * ry * r]);
    }
    return pts;
  };
  CY.path = function (g, polys) {
    g.beginPath();
    for (const p of polys) { g.moveTo(p[0][0], p[0][1]); for (let i = 1; i < p.length; i++) g.lineTo(p[i][0], p[i][1]); g.closePath(); }
  };
  // displace a closed outline along its normals: the hand-cut edge of a brushed shape
  CY.rough = function (poly, amp, seed, step) {
    const P = CY.resample(poly, step || 4, true), out = [];
    for (let k = 0; k < P.length - 1; k++) {
      const p = P[k];
      const d = (CY.vnoise(p.s * 0.03, 0.3, seed) - 0.5) * 2 * amp + (CY.vnoise(p.s * 0.19, 0.7, seed + 1) - 0.5) * amp * 0.7;
      out.push([p.x + p.nx * d, p.y + p.ny * d]);
    }
    return out;
  };

  // ---------------------------------------------------------------- ink: a dry brush
  // A stroke is several bristles across the width; each runs dry in its own places (more toward the end of
  // the stroke and at the brush's flanks), so lines break, skip and streak. Pressure tapers both ends.
  CY.ink = function (g, pts, o) {
    o = Object.assign({ w: 3, col: CY.INK, a: 0.88, dry: 0.3, seed: 1, tin: 0.12, tout: 0.22, wob: 0.7, wobF: 0.022, nb: 0, dbl: 0, step: 1.4, press: null, shift: 0 }, o || {});
    const R = CY.rng(o.seed);
    const P = CY.resample(pts, o.step);
    const L = P.L;
    if (L < 1) return;
    const sx = o.shift ? (R.f() - 0.5) * 2 * o.shift : 0, sy = o.shift ? (R.f() - 0.5) * 2 * o.shift : 0;
    for (const p of P) {
      const off = (CY.vnoise(p.s * o.wobF, 3.3, o.seed) - 0.5) * 2 * o.wob + (CY.vnoise(p.s * o.wobF * 6, 5.1, o.seed) - 0.5) * o.wob * 0.35;
      p.x += p.nx * off + sx; p.y += p.ny * off + sy;
    }
    const tin = Math.max(1, o.tin * L), tout = Math.max(1, o.tout * L);
    const pr = new Float32Array(P.length);
    for (let i = 0; i < P.length; i++) {
      const s = P[i].s;
      let p = Math.min(1, s / tin); p = Math.sqrt(p * (2 - p));
      let q = Math.min(1, (L - s) / tout); q = Math.sqrt(q * (2 - q));
      pr[i] = (o.press ? o.press(s / L) : 1) * Math.min(p, q) * (0.8 + 0.4 * CY.vnoise(s * 0.013, 1.7, o.seed + 5));
    }
    const nb = o.nb || Math.max(2, Math.min(14, Math.round(o.w / 1.15)));
    const col = CY.C(o.col);
    g.lineCap = 'butt'; g.lineJoin = 'round';
    for (let j = 0; j < nb; j++) {
      const off = (j + 0.5) / nb - 0.5 + ((R.f() - 0.5) * 0.3) / nb;
      const bw = Math.max(0.6, (o.w / nb) * 1.8);
      const th = o.dry * (0.2 + 1.6 * Math.abs(off));
      const nf = 0.025 + R.f() * 0.045, ns = o.seed * 31 + j * 7;
      const c = [col[0] + R.r(-7, 7), col[1] + R.r(-7, 7), col[2] + R.r(-7, 7)];
      for (let i = 0; i < P.length - 1; i += 3) {
        const i2 = Math.min(P.length - 1, i + 3), u = P[i].s / L;
        const iv = CY.vnoise(P[i].s * nf, j * 1.37, ns);
        const dryHere = th * (0.5 + 1.0 * u);
        if (iv < dryHere) continue;
        const pm = (pr[i] + pr[i2]) * 0.5;
        if (pm < 0.03) continue;
        const a = o.a * Math.min(1, 0.42 + (0.58 * (iv - dryHere)) / 0.22);
        g.strokeStyle = `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a.toFixed(3)})`;
        g.lineWidth = bw * (0.3 + 0.7 * pm);
        g.beginPath();
        for (let k = i; k <= i2; k++) {
          const p = P[k], ox = p.nx * off * o.w * pr[k], oy = p.ny * off * o.w * pr[k];
          if (k === i) g.moveTo(p.x + ox, p.y + oy); else g.lineTo(p.x + ox, p.y + oy);
        }
        g.stroke();
      }
    }
    if (o.dbl) CY.ink(g, pts, Object.assign({}, o, { dbl: 0, seed: o.seed + 101, a: o.a * 0.42, w: o.w * 0.75, shift: o.dbl, dry: Math.min(0.95, o.dry + 0.25) }));
  };
  // outline a closed polygon as a few separate strokes (a painter lifts the brush at corners)
  CY.inkPoly = function (g, poly, o, closed) {
    const R = CY.rng((o && o.seed) || 1);
    const pts = closed === false ? poly : poly.concat([poly[0]]);
    const P = CY.resample(pts, 2);
    let i = 0;
    while (i < P.length - 1) {
      const len = R.r(o.seg ? o.seg[0] : 60, o.seg ? o.seg[1] : 220);
      let j = i;
      while (j < P.length - 1 && P[j].s - P[i].s < len) j++;
      const part = P.slice(Math.max(0, i - 1), j + 1).map((p) => [p.x, p.y]);
      if (part.length > 1 && R.f() > (o.skip || 0)) CY.ink(g, part, Object.assign({}, o, { seed: (o.seed || 1) * 13 + i }));
      i = j + (R.f() < 0.3 ? 2 : 0);
    }
  };

  // ---------------------------------------------------------------- gouache: flat chalky fills
  // Several slightly different, slightly displaced passes of one colour; optional brush streaks inside;
  // then a pixel pass that mottles the colour, adds chalky tooth, and erodes the edge so the paint stops
  // short in places and breaks up where the paper is rough.
  CY.gouache = function (g, polys, o) {
    o = Object.assign({ col: '#888888', v: 0.04, rough: 2, passes: 3, a: 1, erode: 0.45, eb: 2.5, grain: 1, holes: 0.35, mott: 0.1, streaks: null, seed: 1, pad: 12, blend: null, fx: null, rule: 'evenodd' }, o);
    if (!Array.isArray(polys[0][0])) polys = [polys];
    const R = CY.rng(o.seed);
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const p of polys) for (const q of p) { if (q[0] < x0) x0 = q[0]; if (q[1] < y0) y0 = q[1]; if (q[0] > x1) x1 = q[0]; if (q[1] > y1) y1 = q[1]; }
    x0 = Math.floor(x0 - o.pad - o.rough * 2); y0 = Math.floor(y0 - o.pad - o.rough * 2);
    x1 = Math.ceil(x1 + o.pad + o.rough * 2); y1 = Math.ceil(y1 + o.pad + o.rough * 2);
    const tw = x1 - x0, th = y1 - y0;
    const T = CY.mk(tw, th), t = T.g;
    t.translate(-x0, -y0);
    const base = CY.C(o.col);
    let main = null;
    for (let k = 0; k < o.passes; k++) {
      const rp = o.rough > 0 ? polys.map((p, i) => CY.rough(p, o.rough * (k ? 1.4 : 1), o.seed * 13 + k * 5 + i)) : polys;
      if (k === 0) main = rp;
      t.globalAlpha = k === 0 ? 1 : 0.3;
      t.fillStyle = CY.rgba(k === 0 ? base : CY.jit(base, R, o.v));
      CY.path(t, rp); t.fill(o.rule);
    }
    t.globalAlpha = 1;
    if (o.streaks || o.fx) {
      t.save(); CY.path(t, main); t.clip(o.rule);
      t.globalCompositeOperation = 'source-atop';
      if (o.streaks) {
        const s = o.streaks;
        const n = s.n || Math.round((tw * th) / (s.dens || 900));
        t.lineCap = 'round';
        for (let i = 0; i < n; i++) {
          const cx = R.r(x0, x1), cy = R.r(y0, y1), ang = (s.ang || 0) + R.g() * (s.angv == null ? 0.06 : s.angv);
          const len = R.r(s.len[0], s.len[1]);
          const c = CY.jit(s.cols ? R.pick(s.cols) : base, R, s.v == null ? 0.1 : s.v);
          t.strokeStyle = CY.rgba(c, R.r(s.a[0], s.a[1]));
          t.lineWidth = R.r(s.w[0], s.w[1]);
          const dx = (Math.cos(ang) * len) / 2, dy = (Math.sin(ang) * len) / 2, b = R.g() * len * 0.05;
          t.beginPath(); t.moveTo(cx - dx, cy - dy);
          t.quadraticCurveTo(cx - (dy / len) * b * 2, cy + (dx / len) * b * 2, cx + dx, cy + dy);
          t.stroke();
        }
      }
      if (o.fx) o.fx(t, R, main, [x0, y0, tw, th]);
      t.restore();
    }
    CY.texturize(T, x0, y0, o);
    g.save();
    if (o.blend) g.globalCompositeOperation = o.blend;
    if (o.alpha != null) g.globalAlpha = o.alpha;
    g.drawImage(T.c, x0, y0);
    g.restore();
    return main;
  };
  // the pixel pass shared by gouache and washes: mottle, chalk tooth, eroded edges, pinholes
  CY.texturize = function (T, x0, y0, o) {
    const tw = T.w, th = T.h, W = CY.W, H = CY.H, F = CY.F;
    const img = T.g.getImageData(0, 0, tw, th), d = img.data;
    let ba = null;
    if (o.erode > 0) { const B = CY.mk(tw, th); B.g.filter = `blur(${o.eb}px)`; B.g.drawImage(T.c, 0, 0); ba = B.g.getImageData(0, 0, tw, th).data; }
    const mott = o.mott, gk = 0.09 * o.grain, er = o.erode, hk = 1 - o.holes * 0.11, aa = o.a;
    for (let y = 0; y < th; y++) {
      const gy = clamp(y + y0, 0, H - 1) * W;
      for (let x = 0; x < tw; x++) {
        const i = (y * tw + x) * 4;
        const a = d[i + 3];
        if (!a) continue;
        const fi = gy + clamp(x + x0, 0, W - 1);
        const gr = F.grain[fi], mo = F.mot[fi];
        const k = 1 + (mo - 0.5) * mott * 2 + (gr - 0.5) * gk;
        d[i] = d[i] * k; d[i + 1] = d[i + 1] * k; d[i + 2] = d[i + 2] * k;
        let al = a / 255;
        let inner = 1;
        if (ba) {
          inner = ba[i + 3] / 255;
          const e = inner + (F.edge[fi] - 0.5) * er + (gr - 0.5) * er * 0.4;
          al *= sm(0.34, 0.54, e);
        }
        const hz = gr - hk;
        if (hz > 0) al *= Math.max(0, 1 - hz * 10 * (1.12 - inner));
        d[i + 3] = al * 255 * aa;
      }
    }
    T.g.putImageData(img, 0, 0);
  };

  // a soft stain: a blurred blob with a slightly darker tide line, mottled by the shared fields
  CY.wash = function (g, poly, col, o) {
    o = Object.assign({ a: 0.25, blur: 3, rim: 0.4, rimw: 1.6, seed: 1, blend: 'multiply', erode: 0.6, eb: 3, mott: 0.25, grain: 1.5, holes: 0.2 }, o);
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const q of poly) { x0 = Math.min(x0, q[0]); y0 = Math.min(y0, q[1]); x1 = Math.max(x1, q[0]); y1 = Math.max(y1, q[1]); }
    const pad = o.blur * 3 + 8;
    x0 = Math.floor(x0 - pad); y0 = Math.floor(y0 - pad); x1 = Math.ceil(x1 + pad); y1 = Math.ceil(y1 + pad);
    const T = CY.mk(x1 - x0, y1 - y0), t = T.g;
    t.translate(-x0, -y0);
    const c = CY.C(col);
    t.filter = `blur(${o.blur}px)`;
    t.fillStyle = CY.rgba(c, 1); CY.path(t, [poly]); t.fill();
    if (o.rim > 0) {
      t.filter = `blur(${Math.max(0.6, o.blur * 0.3)}px)`;
      t.strokeStyle = CY.rgba(CY.mix(c, [40, 30, 25], 0.35), o.rim); t.lineWidth = o.rimw; CY.path(t, [poly]); t.stroke();
    }
    t.filter = 'none';
    CY.texturize(T, x0, y0, { erode: o.erode, eb: o.eb, mott: o.mott, grain: o.grain, holes: o.holes, a: 1 });
    g.save();
    g.globalAlpha = o.a;
    if (o.blend) g.globalCompositeOperation = o.blend;
    g.drawImage(T.c, x0, y0);
    g.restore();
  };

  // a hairline crack: a wandering, branching thin ink line
  CY.crack = function (g, x, y, ang, len, seed, o) {
    o = Object.assign({ w: 1.1, a: 0.55, branch: 0.5, depth: 0 }, o);
    const R = CY.rng(seed);
    const pts = [[x, y]];
    let a = ang, px = x, py = y;
    const n = Math.max(3, Math.round(len / 7));
    for (let i = 0; i < n; i++) {
      a += R.g() * 0.35; px += Math.cos(a) * 7; py += Math.sin(a) * 7; pts.push([px, py]);
      if (o.depth < 2 && R.f() < o.branch * 0.08) CY.crack(g, px, py, a + R.sign() * R.r(0.4, 1), len * R.r(0.2, 0.45), seed * 7 + i, Object.assign({}, o, { w: o.w * 0.75, depth: o.depth + 1 }));
    }
    CY.ink(g, pts, { w: o.w, a: o.a, dry: 0.35, seed, nb: 2, tin: 0.05, tout: 0.5, wob: 0.4, col: o.col || [52, 44, 38] });
  };
})();
