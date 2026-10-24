/* The Family — 03 · The Thunderbolt
 *
 * Sicily, spring 1947. Michael Corleone, in exile, stops dead on a mule track above Corleone: among the
 * orange and lemon trees of a terraced grove stands a village girl with a basket. Calo and Fabrizio, his
 * shepherd bodyguards, grin behind him with their luparas on their shoulders.
 *
 * Painted as a travelling watercolourist's sheet: a pencil underdrawing, then transparent washes laid back to
 * front and multiplied onto the paper. Every wash is a shape whose edge is wobbled like a brush edge; pigment
 * flows unevenly inside it, pools at the edge as it dries, granulates in the tooth of the paper, and sometimes
 * blooms. The brightest lights are paper that was never painted (reserves: walls in the sun, blossom, the
 * girl's dress, Michael's shirt).
 */
(function () {
  'use strict';
  const DW = 1080, DH = 1350, TAU = Math.PI * 2;
  const QS = new URLSearchParams(location.search);
  const EXPORT = QS.has('export');
  const ROOM = '#e6e1d6';
  const CTX = { willReadFrequently: true }; // software canvas: much faster for many small filtered layers

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const lerp = (a, b, t) => a + (b - a) * t;
  const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  function rgba(hex, a) { const n = parseInt(hex.slice(1), 16); return 'rgba(' + (n >> 16) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')'; }
  function mk(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  const frame = () => new Promise((r) => requestAnimationFrame(() => r()));

  /* ------------------------------------------------------------------ geometry (design units) */
  function ell(cx, cy, rx, ry, rot, n) {
    rot = rot || 0; n = n || Math.max(12, Math.ceil((rx + ry) * 0.7));
    const c = Math.cos(rot), s = Math.sin(rot), p = [];
    for (let i = 0; i < n; i++) { const a = (i / n) * TAU, x = Math.cos(a) * rx, y = Math.sin(a) * ry; p.push([cx + x * c - y * s, cy + x * s + y * c]); }
    return p;
  }
  function spline(pts, closed, seg) {
    seg = seg || 8; const out = [], n = pts.length;
    const P = (i) => (closed ? pts[(i + n) % n] : pts[clamp(i, 0, n - 1)]);
    const last = closed ? n : n - 1;
    for (let i = 0; i < last; i++) {
      const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
      for (let j = 0; j < seg; j++) {
        const t = j / seg, t2 = t * t, t3 = t2 * t;
        const f = (k) => 0.5 * (2 * p1[k] + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3);
        out.push([f(0), f(1)]);
      }
    }
    if (!closed) out.push(pts[n - 1].slice(0, 2));
    return out;
  }
  function resample(pts, step, closed) {
    const n = pts.length; if (n < 2) return pts.slice();
    const out = [pts[0]]; let carry = 0;
    const segs = closed ? n : n - 1;
    for (let i = 0; i < segs; i++) {
      const a = pts[i], b = pts[(i + 1) % n], dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy);
      if (L < 1e-6) continue;
      let d = step - carry;
      while (d <= L) { out.push([a[0] + (dx * d) / L, a[1] + (dy * d) / L]); d += step; }
      carry = L - (d - step);
    }
    if (!closed) { const z = pts[n - 1], q = out[out.length - 1]; if (q[0] !== z[0] || q[1] !== z[1]) out.push(z); }
    return out;
  }
  function perim(p) { let s = 0; for (let i = 0; i < p.length; i++) { const a = p[i], b = p[(i + 1) % p.length]; s += Math.hypot(b[0] - a[0], b[1] - a[1]); } return s; }
  function bboxOf(polys) {
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const p of polys) for (const q of p) { if (q[0] < x0) x0 = q[0]; if (q[0] > x1) x1 = q[0]; if (q[1] < y0) y0 = q[1]; if (q[1] > y1) y1 = q[1]; }
    return [x0, y0, x1, y1];
  }
  // a tapered stroke along a skeleton [[x,y,width],...] -> closed polygon with round caps
  function limb(sk, seg) {
    seg = seg || 5;
    const pts = sk.length > 2 ? spline(sk, false, seg) : [sk[0].slice(0, 2), sk[1].slice(0, 2)];
    const ws = [];
    if (sk.length > 2) { for (let i = 0; i < sk.length - 1; i++) for (let j = 0; j < seg; j++) ws.push(lerp(sk[i][2], sk[i + 1][2], j / seg)); ws.push(sk[sk.length - 1][2]); }
    else ws.push(sk[0][2], sk[1][2]);
    const n = pts.length, Lf = [], Rt = [];
    const dir = (i) => { const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)]; let dx = b[0] - a[0], dy = b[1] - a[1]; const d = Math.hypot(dx, dy) || 1; return [dx / d, dy / d]; };
    for (let i = 0; i < n; i++) { const [dx, dy] = dir(i), w = ws[i] / 2; Lf.push([pts[i][0] - dy * w, pts[i][1] + dx * w]); Rt.push([pts[i][0] + dy * w, pts[i][1] - dx * w]); }
    const cap = (i, fwd) => {
      const [dx0, dy0] = dir(i), dx = fwd ? dx0 : -dx0, dy = fwd ? dy0 : -dy0, w = ws[i] / 2, out = [];
      const nx = -dy, ny = dx;
      for (let k = 1; k < 6; k++) { const t = (k / 6) * Math.PI; out.push([pts[i][0] + (nx * Math.cos(t) + dx * Math.sin(t)) * w, pts[i][1] + (ny * Math.cos(t) + dy * Math.sin(t)) * w]); }
      return out;
    };
    return Lf.concat(cap(n - 1, true), Rt.reverse(), cap(0, false));
  }
  function fillPolys(g, polys) {
    for (const p of polys) {
      if (!p || p.length < 3) continue;
      g.beginPath(); g.moveTo(p[0][0], p[0][1]);
      for (let i = 1; i < p.length; i++) g.lineTo(p[i][0], p[i][1]);
      g.closePath(); g.fill();
    }
  }
  const tr = (ox, oy, k) => (p) => p.map((q) => (q.length > 2 ? [ox + q[0] * k, oy + q[1] * k, q[2] * k] : [ox + q[0] * k, oy + q[1] * k]));
  function polyline(f, x0, x1, step) {
    const n = Math.max(1, Math.ceil(Math.abs(x1 - x0) / Math.abs(step || 10))), p = [];
    for (let i = 0; i <= n; i++) { const x = x0 + ((x1 - x0) * i) / n; p.push([x, f(x)]); }
    return p;
  }
  function band(f1, f2, x0, x1, step) { x0 = x0 === undefined ? -50 : x0; x1 = x1 === undefined ? 1130 : x1; return polyline(f1, x0, x1, step || 12).concat(polyline(f2, x1, x0, step || 12)); }
  function yAt(pts, x) {
    if (x <= pts[0][0]) return pts[0][1];
    for (let i = 0; i < pts.length - 1; i++) if (x <= pts[i + 1][0]) { const t = (x - pts[i][0]) / (pts[i + 1][0] - pts[i][0] || 1); return lerp(pts[i][1], pts[i + 1][1], t); }
    return pts[pts.length - 1][1];
  }

  /* ------------------------------------------------------------------ the painting */
  async function paint(cv, S, seed, alive, onFirst) {
    const W = cv.width, H = cv.height;
    const rnd = mulberry32((seed ^ 0x9e3779b9) >>> 0);
    const R = (a, b) => a + (b - a) * rnd();
    const NT = new Float32Array(1024); for (let i = 0; i < 1024; i++) NT[i] = rnd() * 2 - 1;
    const N1 = (x) => { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return NT[i & 1023] * (1 - u) + NT[(i + 1) & 1023] * u; };
    const m = cv.getContext('2d', CTX);
    const MG = Math.ceil(60 * S);

    /* ---- scratch layers, pooled by size so filters only ever touch the area of one wash */
    const POOL = new Map();
    function layers(bw, bh) {
      const q = (v) => (v <= 128 ? 128 : v <= 256 ? 256 : v <= 512 ? 512 : Math.ceil(v / 384) * 384);
      const w = q(bw), h = q(bh), key = w + 'x' + h;
      let p = POOL.get(key);
      if (!p) { p = [0, 1, 2].map(() => { const cv2 = mk(w, h); return { cv: cv2, g: cv2.getContext('2d', CTX) }; }); if (w * h <= 1600 * 1600) POOL.set(key, p); }
      return p;
    }

    /* ---- paper tooth and pigment-flow tiles (periodic value noise) */
    function periodic(cells, TS) {
      const g = new Float32Array(cells * cells); for (let i = 0; i < g.length; i++) g[i] = rnd();
      return (x, y) => {
        const fx = (x / TS) * cells, fy = (y / TS) * cells, ix = Math.floor(fx), iy = Math.floor(fy);
        let tx = fx - ix, ty = fy - iy; tx = tx * tx * (3 - 2 * tx); ty = ty * ty * (3 - 2 * ty);
        const x0 = ix % cells, y0 = iy % cells, x1 = (ix + 1) % cells, y1 = (iy + 1) % cells;
        const a = g[y0 * cells + x0], b = g[y0 * cells + x1], cc = g[y1 * cells + x0], d = g[y1 * cells + x1];
        return (a * (1 - tx) + b * tx) * (1 - ty) + (cc * (1 - tx) + d * tx) * ty;
      };
    }
    const TS = 512, fpx = Math.max(1.6, 1.3 * S);
    const nA = periodic(Math.max(8, Math.round(TS / fpx)), TS), nB = periodic(Math.max(4, Math.round(TS / (fpx * 3.2))), TS), nC = periodic(Math.max(2, Math.round(TS / (fpx * 10))), TS);
    const grainT = mk(TS, TS), dryT = mk(TS, TS), paperT = mk(TS, TS);
    {
      const gg = grainT.getContext('2d'), dg = dryT.getContext('2d'), pg = paperT.getContext('2d');
      const gi = gg.createImageData(TS, TS), di = dg.createImageData(TS, TS), pi = pg.createImageData(TS, TS);
      for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) {
        const t = 0.52 * nA(x, y) + 0.3 * nB(x, y) + 0.18 * nC(x, y), k = (y * TS + x) * 4;
        const gv = 255 * (1 - 0.34 * sstep(0.48, 0.18, t));
        gi.data[k] = gi.data[k + 1] = gi.data[k + 2] = gv; gi.data[k + 3] = 255;
        di.data[k] = di.data[k + 1] = di.data[k + 2] = 255; di.data[k + 3] = 255 * sstep(0.57, 0.65, t);
        const pv = 255 * (1 - 0.04 * (1 - t) * (1 - t));
        pi.data[k] = pv; pi.data[k + 1] = pv * 0.997; pi.data[k + 2] = pv * 0.988; pi.data[k + 3] = 255;
      }
      gg.putImageData(gi, 0, 0); dg.putImageData(di, 0, 0); pg.putImageData(pi, 0, 0);
    }
    const FS = Math.round(360 * S); // pigment flow: features ~70 design px
    const flowT = mk(FS, FS);
    {
      const f1 = periodic(5, FS), f2 = periodic(18, FS), fg = flowT.getContext('2d'), fi = fg.createImageData(FS, FS);
      for (let y = 0; y < FS; y++) for (let x = 0; x < FS; x++) {
        const v = 0.7 * f1(x, y) + 0.3 * f2(x, y), k = (y * FS + x) * 4;
        fi.data[k] = fi.data[k + 1] = fi.data[k + 2] = 255; fi.data[k + 3] = 255 * sstep(0.26, 0.84, v);
      }
      fg.putImageData(fi, 0, 0);
    }
    const PAT = { grain: m.createPattern(grainT, 'repeat'), dry: m.createPattern(dryT, 'repeat'), flow: m.createPattern(flowT, 'repeat') };

    /* ---- reserves: shapes left as white paper by every wash behind them */
    const RES = [];
    function reserve(depth, polys, kind) { RES.push({ depth, polys, bb: bboxOf(polys), kind: kind || 'solid' }); }

    function wobble(pts, amp, fr, rough, closed) {
      const n = pts.length; if (n < 3) return pts;
      const s = new Float32Array(n);
      for (let i = 1; i < n; i++) s[i] = s[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      const tot = s[n - 1] + (closed ? Math.hypot(pts[0][0] - pts[n - 1][0], pts[0][1] - pts[n - 1][1]) : 0);
      const o1 = rnd() * 500, o2 = rnd() * 500, out = new Array(n);
      const D = (u) => amp * N1(u * fr + o1) + rough * N1(u * 0.21 + o2);
      for (let i = 0; i < n; i++) {
        const a = pts[closed ? (i - 1 + n) % n : Math.max(0, i - 1)], b = pts[closed ? (i + 1) % n : Math.min(n - 1, i + 1)];
        let nx = a[1] - b[1], ny = b[0] - a[0]; const L = Math.hypot(nx, ny) || 1; nx /= L; ny /= L;
        let d = D(s[i]);
        if (closed) { const w = sstep(tot * 0.8, tot, s[i]); if (w > 0) d = d * (1 - w) + w * D(s[i] - tot); }
        out[i] = [pts[i][0] + nx * d, pts[i][1] + ny * d];
      }
      return out;
    }
    function wob(p, amp, fr, rough) {
      const P = perim(p), k = Math.min(1, P / 160), kr = Math.min(1, P / 50);
      const step = P < 120 ? 0.9 : P < 700 ? 1.6 : 2.6;
      return wobble(resample(p, step, true), amp * k, fr || 0.035, rough * kr, true);
    }
    function fillOf(g, col) {
      if (typeof col === 'string') return col;
      const gr = col.lin ? g.createLinearGradient(col.lin[0], col.lin[1], col.lin[2], col.lin[3]) : g.createRadialGradient(col.rad[0], col.rad[1], col.rad[2], col.rad[3], col.rad[4], col.rad[5]);
      for (const s of col.stops) gr.addColorStop(s[0], s[1]);
      return gr;
    }
    function patFill(g, pat, X0, Y0, bw, bh, alpha, ox, oy) {
      g.save(); g.setTransform(1, 0, 0, 1, -X0 + (ox || 0), -Y0 + (oy || 0)); g.globalAlpha = alpha; g.fillStyle = pat; g.fillRect(X0 - (ox || 0), Y0 - (oy || 0), bw, bh); g.restore();
    }

    /* ---- one transparent wash
       o.c colour (string or {lin|rad, stops}); o.a strength; o.e edge darkening; o.ew edge width; o.soft wet edge;
       o.flow uneven pigment; o.gran granulation; o.dry dry-brush passes; o.blooms; o.holes (+o.holeSoft);
       o.depth: subtract reserves in front; o.skip: reserve kinds to ignore; o.mask: custom mask painter */
    function wash(polys, o) {
      const wb = o.wob === undefined ? 1.2 : o.wob, rough = o.rough === undefined ? 0.4 : o.rough;
      const P = polys ? (o.raw ? polys : polys.map((p) => wob(p, wb, o.fr, rough))) : null;
      const bb = o.bbox || bboxOf(P);
      const soft = o.soft || 0, ew = o.ew || 1.7, edge = o.e === undefined ? 0.4 : o.e * 1.3, A = o.a === undefined ? 0.6 : o.a;
      const flow = o.flow === undefined ? 0.36 : Math.min(0.7, o.flow * 1.3), grad = o.grad === undefined ? 0.3 : o.grad;
      const pad = soft * 2.6 + ew * 2 + 3 + (o.holeSoft || 0) * 2;
      const X0 = Math.max(-MG, Math.floor((bb[0] - pad) * S)), Y0 = Math.max(-MG, Math.floor((bb[1] - pad) * S));
      const X1 = Math.min(W + MG, Math.ceil((bb[2] + pad) * S)), Y1 = Math.min(H + MG, Math.ceil((bb[3] + pad) * S));
      const bw = X1 - X0, bh = Y1 - Y0;
      if (bw < 1 || bh < 1 || X1 <= 0 || Y1 <= 0 || X0 >= W || Y0 >= H) return;
      const [Ls, Cs, Es] = layers(bw, bh), l = Ls.g, c = Cs.g, e = Es.g;
      const D = [X0 / S, Y0 / S, bw / S, bh / S];
      // mask
      l.setTransform(1, 0, 0, 1, 0, 0); l.globalCompositeOperation = 'source-over'; l.globalAlpha = 1; l.filter = 'none';
      l.clearRect(0, 0, bw, bh);
      l.setTransform(S, 0, 0, S, -X0, -Y0); l.fillStyle = '#fff';
      if (soft) l.filter = 'blur(' + (soft * S).toFixed(2) + 'px)';
      if (o.mask) o.mask(l); else fillPolys(l, P);
      l.filter = 'none'; l.globalCompositeOperation = 'destination-out';
      if (o.holes && o.holes.length) { if (o.holeSoft) l.filter = 'blur(' + (o.holeSoft * S).toFixed(2) + 'px)'; fillPolys(l, o.holes); l.filter = 'none'; }
      if (o.depth !== undefined) {
        for (const r of RES) {
          if (r.depth <= o.depth || (o.skip && o.skip.indexOf(r.kind) >= 0)) continue;
          if (r.bb[0] < bb[2] + pad && r.bb[2] > bb[0] - pad && r.bb[1] < bb[3] + pad && r.bb[3] > bb[1] - pad) fillPolys(l, r.polys);
        }
      }
      l.setTransform(1, 0, 0, 1, 0, 0); l.globalCompositeOperation = 'source-over';
      // edge ring: pigment pooled where the wash dried
      e.setTransform(1, 0, 0, 1, 0, 0); e.globalAlpha = 1; e.filter = 'none'; e.globalCompositeOperation = 'source-over';
      e.clearRect(0, 0, bw, bh);
      if (edge > 0 || o.dry) {
        e.drawImage(Ls.cv, 0, 0, bw, bh, 0, 0, bw, bh);
        e.globalCompositeOperation = 'destination-out'; e.filter = 'blur(' + (ew * S).toFixed(2) + 'px)';
        e.drawImage(Ls.cv, 0, 0, bw, bh, 0, 0, bw, bh); e.filter = 'none';
      }
      c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1; c.filter = 'none';
      if (o.dry) { // dry brush: the tooth of the paper breaks the edge
        c.globalCompositeOperation = 'source-over'; c.clearRect(0, 0, bw, bh); c.drawImage(Es.cv, 0, 0, bw, bh, 0, 0, bw, bh);
        c.globalCompositeOperation = 'source-in'; patFill(c, PAT.dry, X0, Y0, bw, bh, 1);
        l.globalCompositeOperation = 'destination-out';
        for (let k = 0; k < o.dry; k++) l.drawImage(Cs.cv, 0, 0, bw, bh, 0, 0, bw, bh);
        l.globalCompositeOperation = 'source-over';
        e.globalCompositeOperation = 'destination-in'; e.drawImage(Ls.cv, 0, 0, bw, bh, 0, 0, bw, bh);
      }
      if (edge > 0) {
        e.globalCompositeOperation = 'destination-out'; patFill(e, PAT.flow, X0, Y0, bw, bh, 0.6, R(0, 900), R(0, 900));
        if (o.blooms) for (const b of o.blooms) { e.globalCompositeOperation = 'source-over'; e.setTransform(S, 0, 0, S, -X0, -Y0); e.strokeStyle = 'rgba(255,255,255,0.7)'; e.lineWidth = 1.1; e.filter = 'blur(' + (0.5 * S).toFixed(2) + 'px)'; e.beginPath(); const pp = wobble(ell(b[0], b[1], b[2], b[2] * 0.8, 0, 40), b[2] * 0.12, 0.2, 0.4, true); e.moveTo(pp[0][0], pp[0][1]); for (const q of pp) e.lineTo(q[0], q[1]); e.closePath(); e.stroke(); e.filter = 'none'; e.setTransform(1, 0, 0, 1, 0, 0); }
        e.globalCompositeOperation = 'destination-in'; e.drawImage(Ls.cv, 0, 0, bw, bh, 0, 0, bw, bh);
        e.save(); e.setTransform(S, 0, 0, S, -X0, -Y0); e.globalCompositeOperation = 'source-in'; e.fillStyle = fillOf(e, o.ec || o.c); e.fillRect(D[0], D[1], D[2], D[3]); e.restore();
      }
      // pigment
      c.globalCompositeOperation = 'source-over'; c.clearRect(0, 0, bw, bh);
      c.save(); c.setTransform(S, 0, 0, S, -X0, -Y0);
      c.fillStyle = fillOf(c, o.c); c.fillRect(D[0], D[1], D[2], D[3]);
      if (o.charges) for (const h of o.charges) {
        const g = c.createRadialGradient(h.x, h.y, 0, h.x, h.y, h.r);
        g.addColorStop(0, rgba(h.c, h.a)); g.addColorStop(0.5, rgba(h.c, h.a * 0.6)); g.addColorStop(1, rgba(h.c, 0));
        c.fillStyle = g; c.fillRect(D[0], D[1], D[2], D[3]);
      }
      c.restore();
      if (o.gran) { c.globalCompositeOperation = 'multiply'; patFill(c, PAT.grain, X0, Y0, bw, bh, o.gran); }
      if (flow > 0) { c.globalCompositeOperation = 'destination-out'; patFill(c, PAT.flow, X0, Y0, bw, bh, flow, R(0, 900), R(0, 900)); }
      if (grad > 0) { // the wash is never even: one side carries more pigment than the other
        const an = o.gradAngle === undefined ? R(0, TAU) : o.gradAngle, cxp = bw / 2, cyp = bh / 2, rr = Math.max(bw, bh) / 2;
        const g = c.createLinearGradient(cxp - Math.cos(an) * rr, cyp - Math.sin(an) * rr, cxp + Math.cos(an) * rr, cyp + Math.sin(an) * rr);
        g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,' + grad + ')');
        c.globalCompositeOperation = 'destination-out'; c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = g; c.fillRect(0, 0, bw, bh);
      }
      if (o.blooms) for (const b of o.blooms) {
        c.save(); c.setTransform(S, 0, 0, S, -X0, -Y0); c.globalCompositeOperation = 'destination-out';
        const g = c.createRadialGradient(b[0], b[1], 0, b[0], b[1], b[2]); g.addColorStop(0, 'rgba(0,0,0,0.6)'); g.addColorStop(0.75, 'rgba(0,0,0,0.45)'); g.addColorStop(1, 'rgba(0,0,0,0)');
        c.fillStyle = g; c.fillRect(b[0] - b[2], b[1] - b[2], b[2] * 2, b[2] * 2); c.restore();
      }
      c.globalCompositeOperation = 'destination-in'; c.drawImage(Ls.cv, 0, 0, bw, bh, 0, 0, bw, bh);
      c.globalCompositeOperation = 'source-over';
      // lay it on the paper
      const sx = Math.max(0, -X0), sy = Math.max(0, -Y0), sw = Math.min(bw, W - X0) - sx, sh = Math.min(bh, H - Y0) - sy;
      if (sw < 1 || sh < 1) return;
      m.save(); m.setTransform(1, 0, 0, 1, 0, 0); m.globalCompositeOperation = o.op || 'multiply';
      m.globalAlpha = A; m.drawImage(Cs.cv, sx, sy, sw, sh, X0 + sx, Y0 + sy, sw, sh);
      if (edge > 0) { m.globalAlpha = Math.min(1, A * edge); m.drawImage(Es.cv, sx, sy, sw, sh, X0 + sx, Y0 + sy, sw, sh); }
      m.restore();
    }
    // brush strokes clipped to a region: each stroke is its own wash so overlaps glaze darker
    function strokesIn(region, strokes, o) {
      for (const s of strokes) wash(null, Object.assign({}, o, s.o || {}, { bbox: bboxOf([s.p]), mask: (g) => { fillPolys(g, [wob(s.p, 2, 0.03, 0.5)]); if (region) { g.globalCompositeOperation = 'destination-in'; fillPolys(g, [region]); g.globalCompositeOperation = 'source-over'; } } }));
    }

    /* ---- graphite */
    function pencil(pts, o) {
      o = o || {};
      if (pts.length < 2) return;
      let P = resample(pts, 2, !!o.closed);
      P = wobble(P, o.wob === undefined ? 0.6 : o.wob, 0.04, 0.12, !!o.closed);
      if (o.closed) P.push(P[0]);
      m.save(); m.setTransform(S, 0, 0, S, 0, 0); m.globalCompositeOperation = 'multiply'; m.lineCap = 'butt'; m.lineJoin = 'round';
      m.lineWidth = o.w || 0.7;
      const a = o.a === undefined ? 0.3 : o.a, off = rnd() * 300, gap = o.gap || 0;
      for (let i = 0; i < P.length - 1; i += 5) {
        if (gap && rnd() < gap) continue;
        const pr = 0.5 + 0.5 * (0.5 + 0.5 * N1(i * 0.07 + off));
        m.strokeStyle = 'rgba(66,62,72,' + (a * pr).toFixed(3) + ')';
        m.beginPath(); m.moveTo(P[i][0], P[i][1]);
        for (let j = i + 1; j <= Math.min(i + 5, P.length - 1); j++) m.lineTo(P[j][0], P[j][1]);
        m.stroke();
      }
      m.restore();
    }
    const outline = (p, o) => pencil(p, Object.assign({ closed: true }, o || {}));

    const TASKS = [], PENCIL = [];
    const task = (f) => TASKS.push(f);
    const pen = (f) => PENCIL.push(f);

    /* ================================================================== THE PLACE */
    // terrace walls: y of the top edge of each retaining wall (the hill rises towards the town on the right)
    const W2 = (x) => 628 - 0.055 * x + 5 * Math.sin(x / 150 + 1);
    const W3 = (x) => 728 - 0.048 * x + 9 * Math.sin(x / 230 + 2.2);
    const W4 = (x) => 848 - 0.03 * x + 10 * Math.sin(x / 260 + 0.2);
    const W5 = (x) => 962 - 0.01 * x + 4 * Math.sin(x / 230 + 0.5);
    const FR = (x) => 1092 + 1.2 * Math.sin(x / 90) + 0.6 * Math.sin(x / 31 + 1);
    const H2 = 11, H3 = 17, H4 = 26, H5 = 36;

    const farR = spline([[-60, 336], [0, 328], [50, 316], [110, 296], [165, 268], [215, 250], [290, 242], [350, 239], [390, 245], [410, 263], [436, 288], [500, 303], [580, 313], [660, 324], [760, 334], [880, 340], [1000, 342], [1140, 345]], false, 6);
    const midR = spline([[-60, 384], [0, 374], [60, 362], [130, 354], [200, 360], [262, 372], [330, 384], [400, 397], [450, 407], [500, 414], [560, 409], [640, 402]], false, 6);
    const crest = spline([[400, 492], [440, 466], [490, 436], [540, 412], [600, 394], [660, 381], [740, 371], [820, 365], [900, 363], [980, 365], [1060, 369], [1140, 372]], false, 6);
    const valTop = spline([[-60, 430], [60, 420], [180, 414], [300, 420], [400, 430], [470, 444]], false, 6);

    /* ---- the town: Corleone on its rock, church tower above the roofs */
    const BLD = [
      [1022, 30, 296, 364, 10, 0, 'keep'],
      [560, 38, 372, 408, 10, 0, 'f'], [600, 46, 356, 396, 12, 0, 'g'], [648, 50, 328, 396, 14, 0, 'church'], [700, 30, 204, 396, 12, 0, 'tower'],
      [744, 56, 344, 390, 12, 0, 'f'], [802, 40, 334, 388, 10, 0, 'g'], [846, 62, 348, 388, 14, 0, 'f'], [912, 44, 340, 390, 10, 0, 'f'],
      [960, 52, 352, 392, 12, 0, 'g'],
      [520, 44, 406, 442, 10, 1, 'f'], [568, 60, 398, 436, 12, 1, 'g'], [632, 40, 394, 432, 10, 1, 'f'], [676, 66, 388, 430, 14, 1, 'f'],
      [748, 46, 382, 426, 10, 1, 'g'], [798, 58, 386, 424, 12, 1, 'f'], [860, 48, 380, 422, 10, 1, 'f'], [912, 66, 384, 424, 14, 1, 'g'],
      [984, 54, 388, 428, 12, 1, 'f'], [1042, 60, 390, 430, 12, 1, 'f'],
      [478, 36, 432, 462, 8, 2, 'f'], [598, 40, 430, 462, 10, 2, 'f'], [700, 52, 426, 456, 12, 2, 'g'], [800, 36, 424, 452, 9, 2, 'f'], [858, 44, 420, 452, 10, 2, 'f'], [958, 40, 424, 454, 10, 2, 'f'],
    ];
    const TOWN = BLD.map((b, i) => {
      const [x, w, top, base, side, row, kind] = b;
      const sk = side * 0.22;
      const front = [[x, top], [x + w, top], [x + w, base], [x, base]];
      const sideP = [[x + w, top], [x + w + side, top + sk], [x + w + side, base - side * 0.1], [x + w, base]];
      let roof = null, gable = null, roofSide = null, cap = null, capSh = null;
      if (kind === 'g' || kind === 'church') {
        const gh = w * (kind === 'church' ? 0.3 : 0.24);
        gable = [[x - 1, top + 0.5], [x + w / 2, top - gh], [x + w + 1, top + 0.5]];
        roofSide = [[x + w / 2, top - gh], [x + w + 1.5, top + 0.5], [x + w + side + 1, top + sk + 0.5], [x + w / 2 + side, top - gh + sk]];
      } else if (kind === 'tower') {
        cap = [[x - 2, top + 1], [x + w * 0.55 + side * 0.4, top - 30], [x + w * 0.55, top + 1]];
        capSh = [[x + w * 0.55, top + 1], [x + w * 0.55 + side * 0.4, top - 30], [x + w + side + 1, top + sk + 1]];
      } else if (kind !== 'keep') {
        const rh = 5 + (w / 60) * 3;
        roof = [[x - 2.5, top + 1.5], [x + w + side + 1, top + sk + 1.5], [x + w + side - 2, top + sk - rh * 0.7], [x + 2, top - rh]];
      }
      const sil = [front, sideP].concat(roof ? [roof] : [], gable ? [gable] : [], roofSide ? [roofSide] : [], cap ? [cap, capSh] : []);
      const depth = 5 + row * 0.1 + i * 0.001;
      reserve(depth, sil, 'town');
      return { x, w, top, base, side, row, kind, sk, front, sideP, roof, gable, roofSide, cap, capSh, sil, depth };
    });

    /* ---- distant land */
    const midPoly = midR.concat([[640, 520], [-60, 520]]);
    const valPoly = valTop.concat(polyline((x) => W2(x) + 3, 470, -60, 20));
    const hillPoly = crest.concat(polyline((x) => W2(x) + 3, 1140, 400, 20));
    reserve(3, [valPoly], 'land'); reserve(4, [hillPoly], 'land');

    /* ---- trees */
    function planCitrus(o) {
      const t = Object.assign({}, o), mn = Math.min(o.rx, o.ry);
      const lobes = [];
      const nr = 11;
      for (let i = 0; i < nr; i++) {
        const a = (i / nr) * TAU + R(-0.22, 0.22), k = R(0.56, 0.72);
        lobes.push([o.cx + Math.cos(a) * o.rx * k, o.cy + Math.sin(a) * o.ry * k * (Math.sin(a) > 0 ? 0.86 : 1), mn * R(0.26, 0.5) * (i % 4 === 1 ? 0.75 : 1)]);
        if (i % 3 === 0) lobes.push([o.cx + Math.cos(a + 0.2) * o.rx * (k + 0.2), o.cy + Math.sin(a + 0.2) * o.ry * (k + 0.16), mn * R(0.14, 0.22)]);
      }
      for (let i = 0; i < 6; i++) lobes.push([o.cx + R(-0.42, 0.42) * o.rx, o.cy + R(-0.45, 0.3) * o.ry, mn * R(0.36, 0.52)]);
      lobes.sort((a, b) => a[1] - b[1]);
      t.lobes = lobes;
      t.inside = (x, y, k) => lobes.some((L) => (x - L[0]) ** 2 + (y - L[1]) ** 2 < (L[2] * (k || 0.95)) ** 2);
      t.dabs = []; t.gaps = [];
      const leaf = (x, y, rot, k) => { const len = R(3.6, 7) * o.fs * (k || 1), wid = R(1.7, 2.8) * o.fs * (k || 1); return ell(x, y, len, wid, rot, 10); };
      for (let a = 0; a < TAU; a += R(0.03, 0.08)) {
        let rr = 0.3; while (rr < 1.7 && t.inside(o.cx + Math.cos(a) * o.rx * rr, o.cy + Math.sin(a) * o.ry * rr, 1)) rr += 0.012;
        const x = o.cx + Math.cos(a) * o.rx * rr, y = o.cy + Math.sin(a) * o.ry * rr;
        if (Math.sin(a) > 0.7 && rnd() < 0.75) continue;
        const nrm = Math.atan2(Math.sin(a) * o.rx, Math.cos(a) * o.ry);
        const n = 1 + ((rnd() * 3) | 0);
        for (let k = 0; k < n; k++) { const rot = nrm + R(-1, 1), out = R(-1, 5) * o.fs; t.dabs.push(leaf(x + Math.cos(nrm) * out + R(-2, 2), y + Math.sin(nrm) * out + R(-2, 2), rot)); }
        if (rnd() < 0.25) t.gaps.push(leaf(x - Math.cos(nrm) * R(5, 12) * o.fs, y - Math.sin(nrm) * R(5, 12) * o.fs, nrm + R(-1, 1), 0.9));
      }
      t.leaf = leaf;
      // fruit hangs in loose clusters near the surface of the dome
      t.fruit = [];
      const nCl = Math.max(3, Math.round(o.nf / 3.2));
      for (let ci = 0; ci < nCl; ci++) {
        const L = lobes[(rnd() * lobes.length) | 0], a0 = R(-0.3, Math.PI + 0.3);
        const cx0 = L[0] + Math.cos(a0) * L[2] * R(0.4, 0.85), cy0 = L[1] + Math.sin(a0) * L[2] * R(0.4, 0.85);
        const k = 1 + ((rnd() * 4) | 0);
        for (let j = 0; j < k && t.fruit.length < o.nf; j++) {
          const x = cx0 + R(-9, 9) * o.fs, y = cy0 + R(-6, 9) * o.fs;
          if (!t.inside(x, y, 0.88)) continue;
          const r = (o.kind === 'lemon' ? R(4.2, 5.4) : R(4.6, 6.8)) * o.fs;
          if (t.fruit.some((f) => Math.hypot(f.x - x, f.y - y) < f.r + r + 1)) continue;
          t.fruit.push({ x, y, r, rot: R(-0.9, 0.9) + (o.kind === 'lemon' ? 1.3 : 0), lit: (o.cx - x) / o.rx + (o.cy - y) / o.ry });
        }
      }
      t.blos = [];
      for (let i = 0; i < o.nb; i++) {
        const L = lobes[(rnd() * lobes.length) | 0], a = R(-Math.PI * 0.95, -0.15), d = L[2] * R(0.55, 0.98);
        const x = L[0] + Math.cos(a) * d, y = L[1] + Math.sin(a) * d;
        if (!t.inside(x, y, 1.02)) continue;
        if (t.fruit.some((f) => Math.hypot(f.x - x, f.y - y) < f.r + 5)) continue;
        const k = 2 + ((rnd() * 4) | 0);
        for (let j = 0; j < k; j++) t.blos.push({ x: x + R(-3.5, 3.5) * o.fs, y: y + R(-2.5, 2.5) * o.fs, r: R(1.1, 1.9) * o.fs });
      }
      reserve(o.depth, lobes.map((L) => ell(L[0], L[1], L[2] * 0.97, L[2] * 0.93, 0, 24)), 'canopy');
      return t;
    }
    function planOlive(o) {
      const t = Object.assign({}, o);
      t.cl = o.clumps.map(([cx, cy, rx, ry]) => {
        const sprays = [], dabsL = [], dabsD = [];
        const n = Math.round((rx * ry) / 60) + 4;
        for (let i = 0; i < n; i++) {
          const a = R(0, TAU), d = Math.pow(rnd(), 0.6) * 0.92;
          const sx = cx + Math.cos(a) * rx * d, sy = cy + Math.sin(a) * ry * d;
          sprays.push([sx, sy]);
          const k = 4 + ((rnd() * 4) | 0), base = R(-Math.PI, 0), lower = sy > cy + ry * 0.12 || sx > cx + rx * 0.45;
          for (let j = 0; j < k; j++) {
            const ang = base + R(-1.1, 1.1) + (rnd() < 0.3 ? Math.PI : 0), len = R(4.5, 8) * o.fs, dd = R(1, 8) * o.fs;
            const p = ell(sx + Math.cos(ang) * dd, sy + Math.sin(ang) * dd * 0.8, len, R(1.3, 2.1) * o.fs, ang + R(-0.4, 0.4), 10);
            (lower && rnd() < 0.7 ? dabsD : dabsL).push(p);
          }
        }
        const mass = ell(cx, cy, rx * 0.86, ry * 0.78, R(-0.1, 0.1), 40);
        return { cx, cy, rx, ry, sprays, dabsL, dabsD, mass };
      });
      return t;
    }

    // Big olive on terrace 3, top-left: silver against the blue distance
    const OLIVE1 = planOlive({ depth: 8.5, fs: 1, clumps: [[34, 498, 80, 44], [150, 448, 84, 46], [270, 480, 70, 40], [94, 584, 64, 32], [298, 572, 54, 30], [208, 538, 46, 28], [-16, 586, 48, 32]] });
    const OLIVE2 = planOlive({ depth: 8.55, fs: 0.8, clumps: [[560, 628, 52, 30], [624, 610, 44, 28], [592, 652, 40, 20]] });
    const SMALLOL = [[470, 568, 26], [700, 556, 28], [880, 542, 26], [1040, 532, 24]].map(([x, y, r], i) => planOlive({ depth: 6 + i * 0.01, fs: 0.6, clumps: [[x - r * 0.3, y, r, r * 0.62], [x + r * 0.5, y + 4, r * 0.7, r * 0.5]], base: [x, y + r * 0.9] }));
    const TREE_F = planCitrus({ x: 1010, base: 680, cx: 1004, cy: 612, rx: 92, ry: 72, depth: 8.6, kind: 'orange', fs: 0.75, nf: 22, nb: 8, pal: ['#b8c463', '#6e9442', '#3d6340', '#d9d06a', '#2e5440'] });
    const TREE_C = planCitrus({ x: 846, base: 806, cx: 806, cy: 690, rx: 152, ry: 112, depth: 10.5, kind: 'orange', fs: 0.9, nf: 40, nb: 16, pal: ['#a9c05a', '#4f8038', '#244a34', '#e0d468', '#1f4232'] });
    const TREE_A = planCitrus({ x: 440, base: 953, cx: 404, cy: 800, rx: 140, ry: 114, depth: 12.5, kind: 'orange', fs: 1.05, nf: 40, nb: 16, pal: ['#b2c45c', '#4f8038', '#22472f', '#ddd36a', '#1d402e'] });
    const TREE_B = planCitrus({ x: 1006, base: 941, cx: 990, cy: 800, rx: 126, ry: 112, depth: 12.6, kind: 'lemon', fs: 1.05, nf: 36, nb: 14, pal: ['#bccb64', '#5d8c40', '#2a5236', '#e6dc72', '#22462f'] });

    /* ---- figures (local coords: origin between the feet, y up is negative) */
    const FIG = {};
    // Michael, seen from behind: stopped mid-stride, jacket hooked over his shoulder, head up and turned to the girl
    {
      const T0 = tr(362, 1066, 1);
      const P = {
        legF: limb([[9, -148, 24], [15, -112, 21], [21, -80, 16], [26, -44, 13], [30, -14, 11.5]]),
        legB: limb([[-9, -148, 25], [-15, -112, 22], [-19, -80, 17], [-27, -44, 14], [-33, -17, 12]]),
        shoeB: limb([[-37, -17, 9.5], [-28, -7, 9], [-14, -2, 7]]),
        shoeF: limb([[24, -7, 10.5], [36, -3.5, 9], [49, -2, 7]]),
        hips: spline([[-25, -160], [24, -158], [25, -136], [10, -124], [-10, -124], [-26, -136]], true, 4),
        shirt: spline([[-4, -249], [-17, -246], [-29, -240], [-35, -229], [-34, -208], [-31, -184], [-28, -165], [-27, -151], [-10, -147], [8, -148], [22, -152], [26, -170], [29, -194], [30, -214], [28, -232], [22, -243], [10, -249]], true, 4),
        sleeveF: limb([[23, -237, 14], [30, -214, 13], [33, -196, 12]]),
        armF: limb([[33, -198, 9], [36, -176, 8], [37, -161, 7]]),
        handF: spline([[33, -162], [40, -161], [42, -151], [39, -145], [34, -148]], true, 3),
        sleeveB: limb([[-30, -234, 17], [-36, -212, 16], [-40, -194, 15], [-41, -186, 14.5]]),
        armB: limb([[-41, -188, 10.5], [-41, -166, 9], [-39, -151, 7.5]]),
        handB: spline([[-44, -152], [-35, -153], [-34, -142], [-37, -136], [-43, -138]], true, 3),
        neck: limb([[2, -244, 13], [5, -257, 12]]),
        head: ell(7, -272, 13.5, 16.5, -0.3, 28),
        hair: spline([[-6, -266], [-7, -279], [-2, -288], [7, -291], [16, -288], [19, -280], [16, -272], [12, -264], [6, -262], [0, -259], [-4, -260]], true, 4),
        hairSh: spline([[2, -262], [8, -270], [14, -278], [17, -286], [19, -280], [16, -272], [12, -264], [6, -262]], true, 3),
        ear: ell(4, -267, 2.6, 4.4, -0.2, 12),
        face: spline([[14, -287], [21, -282], [23.5, -271], [22, -259], [16, -252], [11, -257], [13, -271]], true, 3),
        shirtSh: spline([[11, -248], [22, -243], [28, -232], [30, -214], [29, -194], [26, -170], [22, -152], [12, -149], [9, -164], [13, -190], [11, -214], [15, -232]], true, 4),
        sleeveFsh: limb([[27, -236, 7], [32, -214, 7], [34, -198, 6]]),
        tension: limb([[-26, -238, 1.4], [-10, -212, 2.4], [8, -184, 1.6]]),
        spine: limb([[-1, -244, 1.4], [-4, -212, 2.2], [-3, -172, 1.8]]),
        fold: limb([[-29, -210, 1.6], [-21, -186, 3], [-23, -162, 1.8]]),
        armShadow: limb([[-31, -226, 3.5], [-32, -202, 4.5], [-30, -182, 3]]),
        sleeveSh: limb([[-26, -232, 6], [-33, -210, 6], [-36, -190, 5]]),
        legBsh: limb([[1, -146, 7], [-6, -112, 6], [-11, -80, 5], [-21, -44, 4.5], [-28, -18, 4]]),
        legFsh: limb([[9, -148, 24], [15, -112, 21], [21, -80, 16], [26, -44, 13], [30, -14, 11.5]]),
        knee: limb([[-18, -84, 1.6], [-13, -78, 2], [-9, -74, 1.4]]),
        belt: limb([[-26, -151, 3], [0, -148, 3], [23, -153, 3]]),
      };
      for (const k in P) P[k] = T0(P[k]);
      FIG.m = P;
      reserve(14.8, [P.legB, P.legF, P.shoeB, P.shoeF, P.hips, P.shirt, P.sleeveF, P.armF, P.handF, P.sleeveB, P.armB, P.handB, P.neck, P.head, P.hair], 'fig');
    }
    // Calo: stocky, cap, waistcoat, one hand in his pocket, the other on the strap of the lupara
    {
      const T0 = tr(66, 1034, 1);
      const P = {
        gun: limb([[-1, -262, 4.2], [-16, -212, 4.6], [-30, -172, 6]]),
        stock: limb([[-30, -174, 7], [-38, -152, 9.5], [-44, -138, 10]]),
        legB: limb([[-9, -132, 22], [-13, -100, 19], [-12, -70, 16], [-15, -40, 14], [-18, -10, 13]]),
        legF: limb([[10, -132, 22], [14, -100, 19], [16, -70, 16], [18, -40, 14], [20, -10, 13]]),
        shoeB: limb([[-22, -6, 9.5], [-6, -3, 8]]),
        shoeF: limb([[15, -6, 9.5], [31, -3, 8]]),
        hips: spline([[-25, -144], [25, -144], [26, -118], [-26, -118]], true, 3),
        shirt: spline([[-6, -224], [-22, -219], [-30, -206], [-32, -182], [-30, -156], [-27, -136], [27, -136], [31, -156], [32, -182], [30, -206], [22, -219], [6, -224]], true, 4),
        vest: [[-23, -215], [-6, -219], [2, -194], [6, -194], [10, -219], [24, -215], [30, -196], [31, -160], [28, -136], [-28, -136], [-31, -160], [-30, -196]],
        sleeveB: limb([[-28, -212, 13], [-38, -188, 12], [-38, -172, 11]]),
        armB: limb([[-38, -174, 9], [-31, -154, 8], [-25, -143, 7.5]]),
        sleeveF: limb([[27, -212, 13], [35, -192, 12], [33, -180, 11]]),
        armF: limb([[33, -182, 8.5], [25, -190, 8], [19, -195, 7]]),
        handF: ell(15, -196, 5, 5.5, 0, 14),
        strap: limb([[-16, -219, 2.6], [-2, -200, 2.6], [10, -182, 2.6], [24, -150, 2.4]]),
        neck: limb([[1, -222, 11], [2, -231, 11]]),
        head: ell(4, -237, 12, 15, 0.1, 26),
        cap: spline([[-11, -241], [-10, -249], [-2, -254], [9, -253], [16, -248], [24, -243], [22, -239.5], [9, -241], [-11, -238]], true, 4),
        brim: spline([[-8, -241], [12, -241], [22, -239], [12, -236.5], [-8, -237]], true, 3),
        stache: [[4, -228.6], [8.5, -229.8], [13.5, -228], [12.5, -226.4], [8.5, -227.4], [4.6, -226.4]],
        grin: [[5, -225.2], [9, -223.6], [13.4, -225.4], [12.8, -222.8], [9, -221.4], [5.4, -223]],
        ear: ell(-7, -236, 2.4, 4, 0, 10),
        faceSh: spline([[-8, -238], [-2, -237], [-2, -224], [-6, -223]], true, 3),
        shirtSh: spline([[-22, -219], [-30, -206], [-32, -182], [-24, -186], [-18, -210]], true, 3),
        legSh: limb([[10, -132, 22], [14, -100, 19], [16, -70, 16], [18, -40, 14], [20, -10, 13]]),
        legSh2: limb([[-2, -130, 6], [-6, -100, 5], [-5, -70, 4.5], [-9, -40, 4], [-12, -12, 4]]),
        pocket: limb([[-27, -140, 2], [-20, -137, 2]]),
      };
      for (const k in P) P[k] = T0(P[k]);
      FIG.c = P;
      reserve(14.5, [P.gun, P.stock, P.legB, P.legF, P.shoeB, P.shoeF, P.hips, P.shirt, P.sleeveB, P.armB, P.sleeveF, P.armF, P.handF, P.neck, P.head, P.cap], 'fig');
    }
    // Fabrizio: younger, lean, open jacket; grinning at Calo and jerking a thumb towards Michael
    {
      const T0 = tr(176, 1028, 1);
      const P = {
        gun: limb([[-12, -272, 4], [-26, -222, 4.5], [-38, -188, 6]]),
        stock: limb([[-38, -190, 7], [-45, -168, 9], [-50, -154, 10]]),
        legB: limb([[-8, -138, 20], [-12, -104, 18], [-14, -72, 15], [-17, -40, 12], [-21, -12, 11]]),
        legF: limb([[9, -138, 20], [16, -104, 18], [20, -72, 15], [24, -40, 12], [28, -12, 11]]),
        shoeB: limb([[-27, -8, 8.5], [-13, -3, 7.5]]),
        shoeF: limb([[24, -7, 8.5], [39, -3, 7.5]]),
        hips: spline([[-22, -148], [22, -148], [23, -126], [-23, -126]], true, 3),
        shirt: [[-10, -232], [10, -232], [7, -152], [-7, -152]],
        jacL: spline([[-25, -226], [-10, -232], [-5, -200], [-7, -152], [-12, -130], [-25, -134], [-30, -167], [-31, -200]], true, 4),
        jacR: spline([[10, -232], [25, -226], [31, -200], [30, -167], [25, -134], [12, -130], [7, -152], [5, -200]], true, 4),
        sleeveB: limb([[-26, -222, 13], [-32, -192, 12], [-33, -166, 10.5]]),
        handB: ell(-33, -157, 5, 6, 0, 14),
        sleeveF: limb([[26, -222, 13], [40, -198, 12], [50, -182, 10]]),
        handF: ell(55, -177, 5, 4.6, 0.4, 14),
        thumb: limb([[57, -180, 2.6], [64, -185, 2]]),
        neck: limb([[-1, -230, 9.5], [-3, -239, 9.5]]),
        head: ell(-5, -249, 11.5, 14.5, 0.22, 26),
        cap: spline([[-19, -252], [-16, -260], [-8, -265], [4, -263], [10, -257], [6, -252], [-6, -250], [-18, -249]], true, 4),
        brim: spline([[-21, -251], [-6, -252], [7, -250], [-6, -248], [-20, -248]], true, 3),
        grin: [[-14, -238.6], [-9, -235.4], [-3.5, -238], [-4, -234.6], [-9, -231.8], [-13.4, -235.6]],
        ear: ell(5, -249, 2.4, 3.8, 0, 10),
        faceSh: spline([[1, -253], [6, -247], [4, -237], [0, -239]], true, 3),
        shirtSh: spline([[2, -232], [10, -232], [7, -152], [2, -152]], true, 2),
        legSh: limb([[9, -138, 20], [16, -104, 18], [20, -72, 15], [24, -40, 12], [28, -12, 11]]),
        legSh2: limb([[-2, -138, 6], [-6, -104, 5], [-8, -72, 4.5], [-11, -40, 4], [-15, -12, 4]]),
      };
      for (const k in P) P[k] = T0(P[k]);
      FIG.f = P;
      reserve(14.6, [P.gun, P.stock, P.legB, P.legF, P.shoeB, P.shoeF, P.hips, P.shirt, P.jacL, P.jacR, P.sleeveB, P.handB, P.sleeveF, P.handF, P.thumb, P.neck, P.head, P.cap], 'fig');
    }
    // the girl among the trees: white dress, basket on her hip, face turned towards him
    {
      const T0 = tr(706, 808, 1);
      const P = {
        skirt: spline([[-8, -66], [8, -66], [12, -40], [16, -10], [18, -5], [6, -3], [-6, -4], [-18, -6], [-14, -30]], true, 5),
        bodice: spline([[-9, -98], [-3, -100], [6, -99], [10, -88], [8, -68], [-8, -67], [-10, -84]], true, 4),
        armL: limb([[-9, -95, 5], [-13, -80, 4.4], [-12, -63, 3.6]]),
        handL: ell(-12, -60, 2.5, 3, 0, 10),
        armR: limb([[8, -95, 5], [14, -82, 4.4], [12, -70, 3.6]]),
        sleeveL: ell(-9, -94, 4.5, 4, 0.4, 12),
        sleeveR: ell(8.5, -94, 4.5, 4, -0.4, 12),
        basket: spline([[6, -74], [24, -76], [23, -66], [16, -60], [8, -62]], true, 4),
        handle: limb([[8, -75, 1.6], [14, -88, 1.6], [22, -77, 1.6]]),
        legL: limb([[-5, -6, 3], [-6, 0, 2.6]]),
        legR: limb([[5, -5, 3], [7, 0, 2.6]]),
        neck: limb([[-1, -99, 4.2], [-2, -104, 4.2]]),
        head: ell(-3, -110, 6.2, 7.6, -0.15, 20),
        hair: spline([[-6, -117], [0, -118.5], [5, -115], [7, -109], [5, -104], [2, -106], [1, -112], [-5, -114]], true, 4),
        bun: ell(5.5, -110, 3.4, 3.2, 0, 12),
        sash: spline([[-8.5, -69], [8.5, -70], [8.6, -66.5], [-8.2, -65.5]], true, 2),
        dressSh: spline([[3, -99], [10, -88], [8, -68], [12, -40], [16, -10], [18, -5], [8, -4], [6, -30], [5, -66], [6, -86]], true, 4),
        folds: [limb([[-2, -64, 1], [-3, -30, 1.3], [-5, -6, 1]]), limb([[6, -62, 0.9], [9, -26, 1.2]])],
        lemons: [ell(12, -73, 2.8, 2.3, 0, 10), ell(17, -74, 2.6, 2.1, 0, 10), ell(21.5, -72.5, 2.4, 2, 0, 10)],
        cheek: spline([[-8.6, -110], [-6.6, -104.6], [-3.6, -103.4], [-5, -107.6]], true, 2),
        eye: ell(-6.4, -110.8, 0.9, 0.6, 0, 8),
        shoes: [ell(-6, 0, 3, 1.4, 0, 8), ell(7, 0, 3, 1.4, 0, 8)],
      };
      for (const k in P) P[k] = Array.isArray(P[k][0][0]) ? P[k].map((q) => T0(q)) : T0(P[k]);
      FIG.g = P;
      reserve(10.8, [P.skirt, P.bodice, P.armL, P.handL, P.armR, P.sleeveL, P.sleeveR, P.basket, P.legL, P.legR, P.neck, P.head, P.hair, P.bun], 'fig');
    }
    // the stone well in the sunlit gap
    const WELL = (() => {
      const cx = 594, top = 906, base = 948, rx = 34;
      const curve = (y0, k) => (x) => y0 + k * Math.sqrt(Math.max(0, 1 - ((x - cx) / rx) ** 2));
      const body = polyline(curve(top, 7.5), cx - rx, cx + rx, 3).concat(polyline(curve(base, 7), cx + rx, cx - rx, 3));
      const rim = ell(cx, top, rx + 2.5, 8.5, 0, 40), hole = ell(cx, top - 0.5, rx - 7, 5, 0, 32);
      const posts = [limb([[cx - rx + 4, top - 2, 6], [cx - rx + 5, top - 50, 5.5]]), limb([[cx + rx - 4, top - 2, 6], [cx + rx - 5, top - 50, 5.5]])];
      const beam = limb([[cx - rx - 2, top - 50, 5], [cx + rx + 2, top - 50, 5]]);
      reserve(12.8, [body, rim].concat(posts, [beam]), 'fig');
      return { cx, top, base, rx, body, rim, hole, posts, beam, curve };
    })();
    // prickly pear in front of the wall, lower right
    const PADS = [[1018, 1128, 30, 23, 0.25], [958, 1138, 28, 22, -0.45], [1066, 1152, 30, 24, 0.55], [905, 1194, 34, 26, -0.85], [986, 1184, 40, 30, -0.15], [1046, 1192, 36, 28, 0.35], [935, 1258, 44, 34, -0.55], [1005, 1250, 48, 36, 0.1], [1074, 1240, 40, 32, 0.5], [962, 1332, 54, 40, -0.2], [1050, 1314, 52, 40, 0.3], [880, 1292, 40, 32, -1.0]]
      .map((p, i) => { const poly = ell(p[0], p[1], p[2], p[3], p[4], 40); const pad = { cx: p[0], cy: p[1], rx: p[2], ry: p[3], rot: p[4], poly, depth: 17 + i * 0.01 }; reserve(pad.depth, [poly], 'fig'); return pad; });

    /* ================================================================== PENCIL UNDERDRAWING */
    pen(() => { pencil(farR.filter((p, i) => i % 2 === 0), { a: 0.2, gap: 0.3 }); pencil(midR, { a: 0.16, gap: 0.4 }); pencil(crest, { a: 0.2, gap: 0.2 }); });
    pen(() => { for (const b of TOWN) { outline(b.front, { a: 0.28, wob: 0.3 }); outline(b.sideP, { a: 0.2, wob: 0.3, gap: 0.3 }); if (b.gable) outline(b.gable, { a: 0.24, wob: 0.3 }); if (b.cap) outline(b.cap.concat([b.capSh[2]]), { a: 0.24, wob: 0.3 }); } });
    pen(() => {
      for (const f of [W2, W3, W4, W5]) pencil(polyline(f, -20, 1100, 16), { a: 0.22, gap: 0.25 });
      pencil(polyline(FR, -20, 1100, 14), { a: 0.3 });
      for (const t of [TREE_A, TREE_B, TREE_C]) pencil(ell(t.cx, t.cy, t.rx * 0.95, t.ry * 0.92, 0, 60).slice(4, 44), { a: 0.16, gap: 0.3 });
      outline(WELL.rim, { a: 0.34 }); outline(WELL.body, { a: 0.28 });
    });
    pen(() => {
      for (const k of ['m', 'c', 'f', 'g']) { const P = FIG[k]; for (const n in P) { if (/sh$|grin|stache|spine|fold|belt|folds|lemons|cheek|eye|shoes/i.test(n)) continue; outline(P[n], { a: k === 'g' ? 0.3 : 0.32, wob: 0.5, w: 0.6, gap: 0.35 }); } }
      pencil([[356, 772], [358, 1072]], { a: 0.1, wob: 0.8 });
      pencil([[316, 1068], [420, 1066]], { a: 0.13 });
      pencil([[690, 690], [700, 812]], { a: 0.1 });
    });

    /* ================================================================== WASHES, BACK TO FRONT */
    // ---- sky: wet-into-wet, the hot blue laid in broad strokes around a few clouds and the town
    const clouds = [];
    {
      const puff = (x, y, s, n) => { const out = []; let px = x; for (let i = 0; i < n; i++) { const r = R(12, 24) * s; out.push(ell(px, y - r * 0.5 + R(-4, 3), r * R(1.1, 1.5), r, R(-0.2, 0.2), 28)); px += r * R(0.9, 1.5); } out.push(ell(x + (px - x) / 2, y + 2, (px - x) / 2 + 8, 7 * s, 0, 36)); return out; };
      clouds.push(...puff(R(-20, 10), R(200, 208), 1.05, 7), ...puff(R(250, 280), R(226, 232), 0.65, 4), ...puff(R(860, 900), R(126, 134), 0.5, 4));
    }
    const skyRegion = [[-60, -60], [1140, -60]].concat(farR.slice().reverse().map((p) => [p[0], p[1] + 4]));
    task(() => wash([[[-60, 140], [1140, 140], [1140, 480], [-60, 480]]], { raw: true, c: '#f3d8a4', a: 0.3, soft: 26, e: 0, flow: 0.2, depth: 0 }));
    task(() => {
      wash([skyRegion], {
        c: { lin: [0, -40, 0, 350], stops: [[0, '#2a5db0'], [0.38, '#4a8fcb'], [0.78, '#8ec0da'], [1, '#c4dde0']] }, a: 0.84, e: 0.12, ew: 3, wob: 2, flow: 0.16, gran: 0, grad: 0.18, gradAngle: 0.5,
        holes: clouds, holeSoft: 3.5, depth: 0, charges: [{ x: 30, y: 10, r: 360, c: '#33409e', a: 0.45 }, { x: 1040, y: 30, r: 300, c: '#2a68b8', a: 0.3 }, { x: 620, y: 300, r: 280, c: '#d2c0c8', a: 0.35 }],
      });
      strokesIn(skyRegion, [
        { p: limb([[-100, 40, 120], [500, 18, 90], [1180, -6, 130]]), o: { c: '#2846a6', a: 0.26 } },
        { p: limb([[260, 158, 50], [700, 132, 64], [1180, 112, 44]]), o: { c: '#3d7cc2', a: 0.16 } },
        { p: limb([[-60, 262, 30], [300, 252, 40], [560, 246, 26]]), o: { c: '#6aa2cc', a: 0.16 } },
      ], { soft: 11, e: 0, flow: 0.3, grad: 0, holes: clouds, holeSoft: 3.5, depth: 0 });
    });
    task(() => { // cloud shadows, wet
      const sh = []; for (let i = 0; i < clouds.length; i++) { const b = bboxOf([clouds[i]]); if (rnd() < 0.6) sh.push(ell((b[0] + b[2]) / 2 + R(-4, 4), b[3] - (b[3] - b[1]) * 0.25, (b[2] - b[0]) * 0.42, (b[3] - b[1]) * 0.22, 0, 24)); }
      wash(sh, { c: '#9690b4', a: 0.32, soft: 2.8, e: 0.1, flow: 0.3, depth: 0.2 });
    });
    // ---- far mountains: the long limestone ridge with its cliff, fading into haze
    task(() => {
      const poly = farR.concat([[1140, 480], [-60, 480]]);
      wash([poly], { c: { lin: [0, 236, 0, 430], stops: [[0, '#7f86be'], [0.45, '#a3a3cb'], [1, '#f4eee6']] }, a: 0.66, e: 0.35, ew: 2.4, depth: 1, wob: 1.2, gran: 0.2, flow: 0.3 });
      wash([[[392, 245], [410, 263], [436, 288], [462, 300], [446, 306], [420, 296], [402, 274]], [[214, 251], [232, 266], [228, 290], [214, 272]], [[150, 274], [170, 290], [160, 304], [146, 290]], [[300, 243], [322, 260], [312, 274]], [[560, 314], [600, 320], [580, 330]]], { c: '#6566a2', a: 0.4, e: 0.3, depth: 1.1, wob: 1, soft: 0.6 });
    });
    // ---- middle hills, cobalt going green
    task(() => wash([midPoly], { c: { lin: [0, 352, 0, 470], stops: [[0, '#5b7cab'], [0.55, '#7c98a8'], [1, '#a7b79e']] }, a: 0.62, e: 0.35, depth: 2, wob: 1.6, gran: 0.15, flow: 0.3, charges: [{ x: 120, y: 360, r: 120, c: '#4a5c9c', a: 0.35 }] }));
    task(() => wash([[[200, 361], [262, 373], [330, 385], [300, 396], [250, 388], [220, 376]], [[440, 406], [500, 415], [470, 424]], [[60, 364], [100, 360], [96, 376], [70, 380]]], { c: '#4e5f94', a: 0.32, e: 0.3, depth: 2.1, soft: 0.8 }));
    // ---- the valley: fields of young wheat, fallow, a field of poppies, hedgerows, a farmhouse
    task(() => wash([valPoly], { c: { lin: [0, 420, 0, 620], stops: [[0, '#b7c27e'], [1, '#d1c88a']] }, a: 0.5, e: 0.25, depth: 3, wob: 1.4, gran: 0.15, flow: 0.3, charges: [{ x: 380, y: 450, r: 120, c: '#d8b26a', a: 0.4 }] }));
    task(() => {
      const F = [
        [[[-60, 438], [110, 426], [150, 448], [-60, 464]], '#93b452', 0.4], [[[110, 426], [250, 422], [282, 444], [150, 448]], '#dcb066', 0.42],
        [[[250, 422], [390, 430], [420, 452], [282, 444]], '#8fb04e', 0.38], [[[-60, 464], [150, 448], [192, 478], [-60, 496]], '#e2725a', 0.3],
        [[[150, 448], [282, 444], [322, 472], [192, 478]], '#7d9c46', 0.42], [[[282, 444], [420, 452], [452, 484], [322, 472]], '#e2c07a', 0.38],
        [[[-60, 496], [192, 478], [236, 514], [-60, 532]], '#a6b85e', 0.36], [[[322, 472], [452, 484], [480, 522], [360, 514]], '#9cb459', 0.38],
      ];
      for (const [p, col, a] of F) wash([p], { c: col, a, e: 0.25, ew: 1.6, depth: 3.1, wob: 1, gran: 0.15, flow: 0.35, skip: ['canopy'] });
      for (const ln of [[[110, 426], [150, 448], [192, 478], [236, 514]], [[250, 422], [282, 444], [322, 472], [360, 514]], [[-60, 464], [150, 448], [282, 444], [420, 452]], [[-60, 496], [192, 478], [322, 472], [452, 484]]]) {
        const pts = resample(ln, 9, false); const blobs = pts.map((q) => ell(q[0] + R(-2, 2), q[1] - 1, R(2, 3.6), R(1.4, 2.3), 0, 10));
        wash(blobs, { c: '#56723e', a: 0.55, e: 0.3, ew: 1, depth: 3.2, wob: 0.4, flow: 0.15 });
      }
      const x = 386, y = 460;
      wash([[[x, y], [x + 26, y], [x + 26, y + 13], [x, y + 13]]], { c: '#efd8b0', a: 0.22, e: 0.2, wob: 0.3, depth: 3.3, flow: 0 });
      wash([[[x + 26, y], [x + 33, y + 1.5], [x + 33, y + 12.5], [x + 26, y + 13]]], { c: '#8682b6', a: 0.6, e: 0.3, wob: 0.2, depth: 3.3, flow: 0 });
      wash([[[x - 1.5, y + 0.5], [x + 34, y + 2], [x + 31, y - 3], [x + 1, y - 4]]], { c: '#c56a40', a: 0.75, e: 0.3, wob: 0.2, depth: 3.3, flow: 0 });
      wash([[[x + 6, y + 6], [x + 9, y + 6], [x + 9, y + 13], [x + 6, y + 13]]], { c: '#3b3550', a: 0.7, e: 0, wob: 0.1, depth: 3.3, flow: 0 });
      wash([spline([[x + 44, y + 15], [x + 40, y + 2], [x + 42, y - 16], [x + 45, y - 26], [x + 48, y - 14], [x + 50, y + 2], [x + 47, y + 15]], true, 4)], { c: '#2f4a3a', a: 0.82, e: 0.35, wob: 0.4, depth: 3.3, flow: 0.1 });
    });
    // ---- the hill under the town, the rock it stands on
    const zigPts = [[640, 610], [520, 586], [646, 556], [566, 528], [690, 500], [646, 476], [732, 454]];
    const zig = limb(zigPts.map((p, i) => [p[0], p[1], 7 - i * 0.5]), 6);
    task(() => wash([hillPoly], {
      c: { lin: [600, 380, 760, 640], stops: [[0, '#e3c487'], [0.5, '#cdc580'], [1, '#aebe6c']] }, a: 0.55, e: 0.25, depth: 4, wob: 1.4, gran: 0.2, flow: 0.35, holes: [zig], skip: ['canopy'],
      charges: [{ x: 780, y: 450, r: 160, c: '#c98a4a', a: 0.35 }, { x: 560, y: 530, r: 110, c: '#9fb860', a: 0.45 }, { x: 960, y: 530, r: 140, c: '#9fb860', a: 0.35 }],
    }));
    task(() => {
      const rocks = [spline([[470, 462], [520, 452], [560, 434], [620, 450], [660, 464], [600, 474], [530, 470]], true, 4), spline([[700, 454], [760, 444], [830, 450], [860, 462], [790, 474], [720, 472]], true, 4), spline([[890, 446], [960, 450], [1010, 444], [1090, 450], [1120, 464], [1000, 474], [920, 470]], true, 4), spline([[980, 348], [1020, 338], [1070, 344], [1120, 354], [1120, 404], [1060, 400], [1000, 384]], true, 4)];
      wash(rocks, { c: '#e2cfa6', a: 0.4, e: 0.35, depth: 4.4, gran: 0.3, flow: 0.3 });
      wash([[[530, 470], [600, 474], [660, 464], [610, 478], [560, 478]], [[720, 472], [790, 474], [860, 462], [820, 480], [740, 482]], [[920, 470], [1000, 474], [1120, 464], [1120, 482], [960, 484]], [[1000, 384], [1060, 400], [1120, 404], [1120, 414], [1040, 412]], [[996, 360], [1010, 372], [1004, 384]]], { c: '#7e78a8', a: 0.5, e: 0.4, depth: 4.5, flow: 0.2 });
    });
    // ---- the town itself
    const LIT = ['#f2e0bb', '#efd3b0', '#f6ead4', '#ecd2a6', '#f1dccb', '#f5e6c6'];
    task(() => {
      for (const b of TOWN) {
        const lc = LIT[(rnd() * LIT.length) | 0];
        wash([b.front].concat(b.gable ? [b.gable] : []), { c: lc, a: b.kind === 'tower' || b.kind === 'church' || b.kind === 'keep' ? 0.32 : R(0.14, 0.42), e: 0.3, ew: 1.2, wob: 0.8, rough: 0.35, depth: b.depth, gran: 0.15, flow: 0.4, grad: 0.5 });
      }
    });
    task(() => {
      for (const b of TOWN) {
        wash([b.sideP], { c: '#7f82b8', a: R(0.45, 0.6), e: 0.45, ew: 1.2, wob: 0.6, rough: 0.3, depth: b.depth + 0.0001, flow: 0.3, grad: 0.45, gradAngle: Math.PI / 2 });
        if (b.roof) wash([b.roof], { c: rnd() < 0.3 ? '#b8664a' : '#cc7a50', a: R(0.55, 0.72), e: 0.35, ew: 1.2, wob: 0.3, rough: 0.12, depth: b.depth + 0.0002, gran: 0.3, flow: 0.25 });
        if (b.roofSide) {
          wash([b.roofSide], { c: '#b65d3a', a: 0.78, e: 0.35, ew: 1.2, wob: 0.25, rough: 0.12, depth: b.depth + 0.0002, gran: 0.3, flow: 0.25 });
          const g = b.gable; wash([limb([[g[0][0], g[0][1], 2.6], [g[1][0], g[1][1] - 0.5, 2.6]]), limb([[g[1][0], g[1][1] - 0.5, 2.6], [g[2][0] + 0.5, g[2][1], 2.6]])], { c: '#c0623a', a: 0.85, e: 0.2, wob: 0.15, rough: 0.05, flow: 0.1 });
        }
        if (b.cap) { wash([b.cap], { c: '#d0743e', a: 0.8, e: 0.35, wob: 0.2, rough: 0.1, depth: b.depth + 0.0002, flow: 0.2 }); wash([b.capSh], { c: '#8e4232', a: 0.85, e: 0.35, wob: 0.2, rough: 0.1, depth: b.depth + 0.0002, flow: 0.1 }); }
      }
    });
    task(() => {
      for (const b of TOWN) {
        const { x, w, top, base } = b, ops = [];
        if (b.kind !== 'tower' && b.kind !== 'keep') ops.push([[x, top + 0.8], [x + w, top + 0.8], [x + w, top + 3.2], [x, top + 3.6]]);
        if (b.kind === 'tower') {
          for (const yy of [top + 12, top + 52]) for (const xx of [x + 6, x + 17]) ops.push(spline([[xx, yy + 18], [xx, yy + 4], [xx + 3.5, yy], [xx + 7, yy + 4], [xx + 7, yy + 18]], true, 3));
          ops.push([[x - 1, top + 36], [x + w + 1, top + 36], [x + w + 1, top + 38.5], [x - 1, top + 38.5]]);
          ops.push([[x + 12, top + 110], [x + 16, top + 110], [x + 16, top + 117], [x + 12, top + 117]]);
        } else if (b.kind === 'church') {
          ops.push(ell(x + w / 2, top + 8, 5, 5, 0, 16));
          ops.push(spline([[x + w / 2 - 7, base], [x + w / 2 - 7, base - 20], [x + w / 2, base - 27], [x + w / 2 + 7, base - 20], [x + w / 2 + 7, base]], true, 3));
        } else if (b.kind === 'keep') {
          ops.push([[x + 11, top + 14], [x + 16, top + 14], [x + 16, top + 22], [x + 11, top + 22]]);
          for (let k = 0; k < 4; k++) ops.push([[x + k * 8, top - 6], [x + k * 8 + 4.5, top - 6], [x + k * 8 + 4.5, top], [x + k * 8, top]]);
        } else {
          const nwin = Math.max(1, Math.floor(w / 18));
          for (let k = 0; k < nwin; k++) {
            if (rnd() < 0.3) continue;
            const wx = x + (w / (nwin + 1)) * (k + 1) - 2 + R(-2, 2), wy = top + R(8, 12);
            ops.push([[wx, wy], [wx + 3.6, wy], [wx + 3.6, wy + 5.5], [wx, wy + 5.5]]);
            if (base - top > 34 && rnd() < 0.5) ops.push([[wx, wy + 16], [wx + 3.6, wy + 16], [wx + 3.6, wy + 21.5], [wx, wy + 21.5]]);
          }
          if (rnd() < 0.5) { const dx = x + R(4, w - 10); ops.push([[dx, base - 11], [dx + 5, base - 11], [dx + 5, base], [dx, base]]); }
        }
        wash(ops, { c: '#4a4466', a: 0.58, e: 0.25, ew: 0.8, wob: 0.5, rough: 0.35, flow: 0.25, grad: 0.4 });
      }
      wash([[[676, 388], [690, 388], [676, 404]], [[744, 344], [760, 344], [744, 366]], [[912, 384], [925, 384], [912, 397]], [[598, 430], [614, 430], [598, 444]]], { c: '#7377b4', a: 0.4, e: 0.3, wob: 0.2, flow: 0.1 });
      const tw = TOWN.find((b) => b.kind === 'tower'), cx = tw.cap[1][0], cy = tw.cap[1][1];
      wash([limb([[cx, cy + 1, 1.2], [cx, cy - 12, 1.2]]), limb([[cx - 3.5, cy - 8, 1.1], [cx + 3.5, cy - 8, 1.1]])], { c: '#3a3452', a: 0.8, e: 0, wob: 0, flow: 0 });
      // two dark cypresses by the church
      wash([spline([[640, 400], [636, 380], [639, 358], [642, 350], [645, 360], [647, 382], [645, 400]], true, 4), spline([[656, 402], [653, 386], [656, 368], [658, 362], [661, 372], [662, 388], [660, 402]], true, 4)], { c: '#2c4636', a: 0.85, e: 0.35, wob: 0.4, depth: 5.35, flow: 0.15 });
    });
    // ---- terraces on the upper hillside with rows of olives; the mule track zig-zags up to the town
    task(() => {
      for (let k = 0; k < 5; k++) {
        const f = (x) => 480 + 28 * k - 0.045 * (x - 420) + 4 * Math.sin(x / 70 + k * 1.7);
        const x0 = 470 - k * 20, pts = polyline(f, x0, 1130, 10).filter((p) => p[1] > yAt(crest, p[0]) + 22 && p[1] < W2(p[0]) - 10);
        if (pts.length < 3) continue;
        const strip = limb(pts.map((p) => [p[0], p[1], 1.8]), 1);
        wash([strip], { c: '#9a8a8a', a: 0.3, e: 0.2, wob: 0.4, depth: 4.6, skip: ['canopy'], flow: 0.3 });
        const dots = [];
        for (let x = pts[0][0] + R(0, 20); x < pts[pts.length - 1][0]; x += R(22, 38)) {
          const y = f(x) - 5;
          const r = R(3.5, 5.5) * (1 + k * 0.06);
          dots.push(ell(x, y - r * 0.4, r * 1.2, r * 0.9, 0, 14));
        }
        wash(dots, { c: '#7c8a5c', a: 0.72, e: 0.35, ew: 1, wob: 0.6, depth: 4.7, flow: 0.2 });
        wash(dots.map((d) => { const b = bboxOf([d]); return ell((b[0] + b[2]) / 2 + 3, b[3] - 0.5, (b[2] - b[0]) * 0.45, 1.6, 0, 10); }), { c: '#5c5a86', a: 0.4, e: 0.2, wob: 0.3, depth: 4.8, flow: 0 });
      }
      wash([limb(zigPts.map((p, i) => [p[0], p[1], 8 - i * 0.6]), 6)], { c: '#ecd3a0', a: 0.22, e: 0.25, depth: 4.9, flow: 0.3 });
    });
    pen(() => { pencil(spline(zigPts, false, 6).map((p) => [p[0], p[1] - 3.5]), { a: 0.2, gap: 0.2 }); pencil(spline(zigPts, false, 6).map((p) => [p[0], p[1] + 3.5]), { a: 0.18, gap: 0.35 }); });

    /* ---- olive painter: sprays of narrow silver leaves, the sky showing through */
    function paintOlive(t, trunk) {
      const massP = t.cl.map((k) => k.mass), dL = [].concat(...t.cl.map((k) => k.dabsL)), dD = [].concat(...t.cl.map((k) => k.dabsD));
      const bb = bboxOf(massP);
      if (trunk) trunk();
      task(() => {
        wash(massP, { c: { lin: [bb[0], bb[1], bb[2], bb[3]], stops: [[0, '#bcc4a2'], [1, '#97a48a']] }, a: 0.55, soft: 3, e: 0.1, flow: 0.35, depth: t.depth });
        wash(dL, { c: { lin: [bb[0], bb[1], bb[2], bb[3]], stops: [[0, '#a9b597'], [1, '#86947c']] }, a: 0.78, e: 0.35, ew: 1, wob: 0.5, rough: 0.2, depth: t.depth, gran: 0.2, flow: 0.25 });
        wash(dD, { c: { lin: [bb[0], bb[1], bb[2], bb[3]], stops: [[0, '#68766a'], [1, '#4c5850']] }, a: 0.78, e: 0.4, ew: 1, wob: 0.5, rough: 0.2, depth: t.depth, gran: 0.2, flow: 0.2 });
        wash(t.cl.map((k) => ell(k.cx + k.rx * 0.15, k.cy + k.ry * 0.45, k.rx * 0.5, k.ry * 0.18, 0, 24)), { c: '#3c463e', a: 0.4, soft: 2, e: 0, flow: 0.4, depth: t.depth });
      });
    }
    function paintCitrus(t) {
      const litF = t.fruit.filter((f) => f.lit > -0.35), shF = t.fruit.filter((f) => f.lit <= -0.35);
      const fshape = (f, k) => (t.kind === 'lemon' ? ell(f.x, f.y, f.r * 1.32 * k, f.r * 0.92 * k, f.rot, 16) : ell(f.x, f.y, f.r * k, f.r * k, 0, 16));
      const holesF = litF.map((f) => fshape(f, 1));
      const holesB = t.blos.map((b) => ell(b.x, b.y, b.r, b.r, 0, 7));
      const holes = holesF.concat(holesB);
      const bbx = [t.cx - t.rx * 1.35, t.cy - t.ry * 1.35, t.cx + t.rx * 1.35, t.cy + t.ry * 1.35];
      const lobeP = t.lobes.map((L) => ell(L[0], L[1], L[2], L[2] * 0.94, 0, 30));
      // cast shadow on the ground, falling right
      task(() => {
        const sh = ell(t.x + t.rx * 0.55, t.base + 6 * t.fs, t.rx * 1.15, 14 * t.fs + t.ry * 0.08, 0.02, 48);
        const flecks = []; for (let i = 0; i < 6; i++) flecks.push(ell(t.x + t.rx * R(0, 1.1), t.base + R(-4, 9) * t.fs, R(3, 8) * t.fs, R(1.2, 2.4) * t.fs, 0, 12));
        wash([sh], { c: '#4f5098', a: 0.62, e: 0.4, wob: 3, fr: 0.05, depth: t.depth - 0.25, holes: flecks, flow: 0.25 });
      });
      task(() => wash(lobeP.concat(t.dabs), {
        c: { lin: [t.cx - t.rx, t.cy - t.ry, t.cx + t.rx * 0.5, t.cy + t.ry], stops: [[0, t.pal[0]], [0.5, t.pal[1]], [1, t.pal[2]]] }, a: 0.9, e: 0.3, ew: 2, wob: 2.6, fr: 0.06,
        holes: holes.concat(t.gaps), depth: t.depth, gran: 0.08, flow: 0.3, gradAngle: -2.4,
        charges: [{ x: t.cx - t.rx * 0.45, y: t.cy - t.ry * 0.55, r: t.rx * 0.55, c: t.pal[3], a: 0.55 }, { x: t.cx + t.rx * 0.45, y: t.cy + t.ry * 0.35, r: t.rx * 0.6, c: '#1f3f50', a: 0.4 }],
      }));
      task(() => { // shadow mass: the lobes turned from the light, broken where lit lobes come forward, with leafy edges
        const WL = lobeP.map((p) => wob(p, 2.4, 0.06, 0.45));
        const LT = t.lobes.map((L) => wob(ell(L[0] - L[2] * 0.3, L[1] - L[2] * 0.36, L[2] * 0.92, L[2] * 0.84, 0, 26), 2.2, 0.06, 0.45));
        const lit = t.lobes.map((L) => (t.cx - L[0]) / t.rx + (t.cy - L[1]) / t.ry);
        const eIn = [], eOut = [];
        t.lobes.forEach((L, i) => {
          if (lit[i] <= -0.6) return;
          const cx = L[0] - L[2] * 0.3, cy = L[1] - L[2] * 0.36, step = 7 / L[2];
          for (let a = -0.5; a < 2.5; a += step * R(0.7, 1.3)) {
            const x = cx + Math.cos(a) * L[2] * 0.92, y = cy + Math.sin(a) * L[2] * 0.84;
            if (!t.inside(x, y, 0.95)) continue;
            if (rnd() < 0.55) eIn.push(t.leaf(x - Math.cos(a) * R(1, 4), y - Math.sin(a) * R(1, 4), a + Math.PI / 2 + R(-0.8, 0.8)));
            if (rnd() < 0.45) eOut.push(t.leaf(x + Math.cos(a) * R(1.5, 5), y + Math.sin(a) * R(1.5, 5), a + Math.PI / 2 + R(-0.8, 0.8), 0.85));
          }
        });
        wash(null, { bbox: bbx, mask: (g) => { for (let i = 0; i < WL.length; i++) { g.globalCompositeOperation = 'source-over'; if (lit[i] < 0.55) fillPolys(g, [WL[i]]); g.globalCompositeOperation = 'destination-out'; if (lit[i] > -0.6) fillPolys(g, [LT[i]]); } g.globalCompositeOperation = 'source-over'; fillPolys(g, eIn); g.globalCompositeOperation = 'destination-out'; fillPolys(g, eOut); g.globalCompositeOperation = 'source-over'; }, c: t.pal[4], a: 0.68, e: 0.4, holes, depth: t.depth, gran: 0.1, flow: 0.3, gradAngle: -2.3 });
      });
      task(() => { // the dark hollow under the dome, and a few deep pockets
        const WL = lobeP.map((p) => wob(p, 2.2, 0.06, 0.4));
        const under = wob(ell(t.cx + t.rx * 0.12, t.cy + t.ry * 0.72, t.rx * 0.84, t.ry * 0.34, 0, 50), 5, 0.05, 0.8);
        const pockets = []; for (let i = 0; i < 5; i++) { const L = t.lobes[(rnd() * t.lobes.length) | 0]; pockets.push(wob(ell(L[0] + L[2] * 0.55, L[1] + L[2] * 0.6, L[2] * R(0.18, 0.3), L[2] * R(0.12, 0.2), R(-1, 1), 16), 1.5, 0.1, 0.3)); }
        wash(null, { bbox: bbx, mask: (g) => { fillPolys(g, WL); g.globalCompositeOperation = 'destination-in'; fillPolys(g, [under]); g.globalCompositeOperation = 'source-over'; fillPolys(g, pockets); }, c: '#132624', a: 0.75, e: 0.35, ew: 2, holes: holesF, depth: t.depth, gran: 0.1, flow: 0.3 });
        // leaf touches across the lit side, and twigs in the dark
        const lv = []; for (let i = 0; i < 26; i++) { const L = t.lobes[(rnd() * t.lobes.length) | 0], a = R(-2.6, -0.2), d = L[2] * R(0.75, 1.0); const x = L[0] + Math.cos(a) * d, y = L[1] + Math.sin(a) * d; if (!t.inside(x, y, 0.97)) continue; lv.push(ell(x, y, R(2.5, 4.5) * t.fs, R(1.2, 1.8) * t.fs, a + Math.PI / 2 + R(-0.5, 0.5), 10)); }
        wash(lv, { c: t.pal[1], a: 0.6, e: 0.4, ew: 0.8, wob: 0.3, depth: t.depth, flow: 0.15, holes });
      });
      // trunk under the canopy
      task(() => {
        const ty = t.cy + t.ry * 0.6, x = t.x, b = t.base, w0 = 11 * t.fs;
        const trunk = [limb([[x - 1, b + 2, w0], [x + 3, (b + ty) / 2, w0 * 0.75], [x - 4, ty, w0 * 0.65]]), limb([[x - 2, ty + 6, w0 * 0.45], [x - 22 * t.fs, ty - 14 * t.fs, w0 * 0.3]]), limb([[x + 1, ty + 4, w0 * 0.45], [x + 20 * t.fs, ty - 16 * t.fs, w0 * 0.3]])];
        wash(trunk, { c: '#6a5c56', a: 0.82, e: 0.35, wob: 0.6, depth: t.depth + 0.001, gran: 0.3, flow: 0.2 });
        wash([limb([[x + 2, b + 2, w0 * 0.45], [x + 5, (b + ty) / 2, w0 * 0.35], [x - 1, ty, w0 * 0.3]])], { c: '#2a2434', a: 0.6, e: 0.3, wob: 0.4, depth: t.depth + 0.001, flow: 0.1 });
      });
      // fruit
      task(() => {
        const hl = litF.filter((f) => f.lit > 0.1).map((f) => ell(f.x - f.r * 0.36, f.y - f.r * 0.38, f.r * 0.26, f.r * 0.2, -0.6, 8));
        const C1 = t.kind === 'lemon' ? '#f4d53a' : '#f59a22', C2 = t.kind === 'lemon' ? '#c8b03a' : '#d0661c', C3 = t.kind === 'lemon' ? '#8f862a' : '#9a3a18';
        wash(litF.map((f) => fshape(f, 1.05)), { c: C1, a: 0.95, e: 0.45, ew: 1.1, wob: 0.6, holes: hl, flow: 0.1, depth: t.depth });
        wash(shF.map((f) => fshape(f, 1.0)), { c: C2, a: 0.75, e: 0.4, ew: 1.1, wob: 0.6, flow: 0.15, depth: t.depth });
        const cres = litF.map((f) => [fshape(f, 1.0), t.kind === 'lemon' ? ell(f.x - f.r * 0.35, f.y - f.r * 0.4, f.r * 1.25, f.r * 0.85, f.rot, 16) : ell(f.x - f.r * 0.32, f.y - f.r * 0.38, f.r * 0.92, f.r * 0.92, 0, 16)]);
        wash(null, { bbox: bbx, mask: (g) => { for (const [a, b] of cres) { g.globalCompositeOperation = 'source-over'; fillPolys(g, [a]); g.globalCompositeOperation = 'destination-out'; fillPolys(g, [b]); } g.globalCompositeOperation = 'source-over'; }, c: C3, a: 0.55, e: 0.2, flow: 0, depth: t.depth });
        wash(t.blos.filter(() => rnd() < 0.5).map((b) => ell(b.x + b.r * 0.35, b.y + b.r * 0.45, b.r * 0.6, b.r * 0.4, 0, 8)), { c: '#9aa88a', a: 0.4, e: 0, wob: 0, flow: 0, depth: t.depth });
      });
    }
    // ground strokes for a terrace: overlapping horizontal brush strokes inside the band
    function ground(f1, f2, cols, depth, extra) {
      const region = band(f1, f2, -60, 1140, 14);
      const strokes = [];
      const yTop = (x) => f1(x), yBot = (x) => f2(x);
      // one unifying wash, then a few long strokes of other greens and ochres dropped into it
      wash([region], { c: { lin: [0, yTop(540), 0, yBot(540)], stops: [[0, cols[0]], [1, cols[1]]] }, a: 0.46, e: 0.2, ew: 2, flow: 0.35, gran: 0.15, depth, skip: ['canopy'], wob: 1 });
      const nRows = Math.max(1, Math.round((yBot(540) - yTop(540)) / 44));
      for (let r = 0; r < nRows; r++) {
        let x = -80 - R(0, 200);
        while (x < 1140) {
          const len = R(220, 420), x2 = x + len, t = (r + 0.5) / nRows;
          const yy = (xx) => lerp(yTop(xx), yBot(xx), t) + R(-3, 3);
          const w = ((yBot(540) - yTop(540)) / nRows) * R(0.6, 1.0);
          if (rnd() < 0.7) strokes.push({ p: limb([[x, yy(x), w * 0.5], [x + len * 0.35, yy(x + len * 0.35), w], [x + len * 0.7, yy(x + len * 0.7), w * 0.85], [x2, yy(x2), w * 0.4]]), o: { c: cols[2 + ((rnd() * (cols.length - 2)) | 0)], a: R(0.22, 0.36) } });
          x = x2 + R(40, 160);
        }
      }
      strokesIn(region, strokes, Object.assign({ e: 0.15, ew: 2, flow: 0.35, gran: 0.1, depth, soft: 1.6, skip: ['canopy'] }, extra || {}));
    }
    function wallFace(fTop, h, depth, density) {
      task(() => {
        const face = band(fTop, (x) => fTop(x) + h);
        wash([face], { c: { lin: [0, fTop(540), 0, fTop(540) + h], stops: [[0, '#ecd8b0'], [1, '#dcc49c']] }, a: 0.38, e: 0.35, depth, gran: 0.4, wob: 0.8, flow: 0.35, skip: ['canopy'] });
        const j = [];
        const rows = Math.max(1, Math.round(h / 11));
        for (let r = 1; r <= rows; r++) {
          for (let x = -40 + R(0, 30); x < 1120; x += R(12, 46) * density) {
            const y = fTop(x) + 2 + (r * (h - 3)) / rows + R(-1.5, 1.5), L = R(5, 18), th = R(1.2, 3) * Math.min(1, h / 20);
            if (r === rows && rnd() < 0.5) continue;
            j.push([[x, y - th * 0.4], [x + L * 0.5, y - th], [x + L, y - th * 0.2], [x + L * 0.7, y + th * 0.3], [x + L * 0.2, y + th * 0.2]]);
            if (rnd() < 0.35) { const yy = y - R(3, h / rows); j.push([[x + L - 1, yy], [x + L + 0.8, yy + 0.5], [x + L + 0.6, y - th], [x + L - 1.2, y - th]]); }
          }
        }
        wash(j, { c: '#584c6c', a: 0.62, e: 0.2, wob: 0.4, rough: 0.2, depth: depth + 0.01, flow: 0.4, skip: ['canopy'] });
        wash([band((x) => fTop(x) + 0.4, (x) => fTop(x) + 2.5 + h * 0.08)], { c: '#6e6488', a: 0.5, e: 0.2, depth: depth + 0.02, wob: 0.6, flow: 0.3, skip: ['canopy'] });
      });
    }

    // flowering broom: a dark green mound shot with yellow
    function broom(x, y, w, h, depth) {
      task(() => {
        const mass = [];
        for (let i = 0; i < 7; i++) mass.push(ell(x + R(-0.4, 0.4) * w, y - h * 0.45 + R(-0.3, 0.3) * h, w * R(0.22, 0.34), h * R(0.25, 0.38), 0, 20));
        const fl = [];
        for (let i = 0; i < 46; i++) { const a = R(-Math.PI, 0.1), d = Math.sqrt(rnd()); fl.push(ell(x + Math.cos(a) * w * 0.55 * d, y - h * 0.45 + Math.sin(a) * h * 0.6 * d, R(1.4, 2.6), R(1, 1.8), R(0, 3), 8)); }
        wash([ell(x + w * 0.45, y + 2, w * 0.6, 4, 0, 20)], { c: '#4f5098', a: 0.5, e: 0.35, depth: depth - 0.05, flow: 0.2, skip: ['canopy'] });
        wash(mass, { c: { lin: [x - w / 2, y - h, x + w / 2, y], stops: [[0, '#8fa448'], [1, '#3c5a30']] }, a: 0.8, e: 0.4, wob: 1.4, depth, flow: 0.3, holes: fl });
        const st = []; for (let i = 0; i < 9; i++) { const sx = x + R(-0.35, 0.35) * w; st.push(limb([[sx, y, 1.2], [sx + R(-8, 8), y - h * R(0.6, 1.05), 0.4]])); }
        wash(st, { c: '#3a4a26', a: 0.6, e: 0, wob: 0.1, depth, flow: 0.1 });
        wash(fl, { c: '#f4cf22', a: 0.95, e: 0.35, wob: 0.1, depth, flow: 0 });
      });
    }
    // capers growing out of the wall face
    function caper(x, y, k, depth) {
      task(() => {
        const lv = [], fl = [];
        for (let i = 0; i < 16; i++) { const a = R(-0.4, Math.PI + 0.4), d = R(3, 16) * k; lv.push(ell(x + Math.cos(a) * d * 1.3, y + Math.sin(a) * d * 0.8, R(2, 3.2) * k, R(1.8, 2.8) * k, 0, 10)); }
        for (let i = 0; i < 3; i++) fl.push(ell(x + R(-14, 14) * k, y + R(2, 12) * k, 3 * k, 2.6 * k, 0, 10));
        wash(lv, { c: '#5f8a4a', a: 0.82, e: 0.4, wob: 0.3, depth, flow: 0.15, holes: fl, skip: ['canopy'] });
        wash(fl, { c: '#f0d6e0', a: 0.5, e: 0.3, wob: 0.1, depth, flow: 0 });
        wash(fl.map((f) => { const b = bboxOf([f]); return ell((b[0] + b[2]) / 2, (b[1] + b[3]) / 2, 0.9, 0.9, 0, 6); }), { c: '#8a3a7a', a: 0.7, e: 0, wob: 0, flow: 0 });
      });
    }

    /* ---- terrace 2 (upper hill) olives and wall */
    task(() => {
      for (const t of SMALLOL) {
        const [bx, by] = t.base;
        wash([ell(bx + 18, by + 2, 24, 4, 0, 24)], { c: '#6a68a0', a: 0.4, e: 0.3, depth: 5.9, flow: 0.2 });
        wash([limb([[bx, by + 2, 4], [bx + 1, by - 10, 3]])], { c: '#6a6058', a: 0.7, e: 0.3, depth: 5.95, flow: 0.1 });
      }
    });
    for (const t of SMALLOL) paintOlive(t);
    wallFace(W2, H2, 7, 1);
    /* ---- terrace 3: grass, big olive, small olive, an orange tree, and its wall */
    task(() => ground((x) => W2(x) + H2, W3, ['#cfcf80', '#b8c464', '#e6d050', '#9fb45a'], 8));
    task(() => wash([ell(256, 724, 96, 8, 0, 30), ell(642, 696, 62, 6, 0, 30)], { c: '#55579a', a: 0.48, e: 0.35, depth: 8.2, wob: 2, flow: 0.25 }));
    const olive1Trunk = () => task(() => {
      const trunk = spline([[138, 722], [146, 702], [152, 682], [146, 662], [136, 642], [122, 620], [106, 598], [92, 576], [104, 568], [122, 590], [142, 614], [162, 632], [174, 640], [186, 628], [204, 608], [226, 586], [246, 564], [260, 572], [242, 598], [220, 624], [208, 650], [206, 676], [212, 700], [218, 722], [226, 728], [130, 728]], true, 3);
      const br = [limb([[100, 576, 9], [74, 548, 6], [44, 520, 3.5]]), limb([[108, 580, 7], [126, 530, 5], [150, 488, 3]]), limb([[252, 566, 8], [276, 528, 5], [300, 494, 3]]), limb([[244, 570, 6], [232, 530, 4], [212, 486, 2.6]]), limb([[96, 580, 5], [70, 586, 3.5], [44, 594, 2]]), limb([[150, 488, 3], [160, 462, 2]]), limb([[44, 520, 3.5], [20, 504, 2.2]])];
      wash([trunk].concat(br), { c: { lin: [120, 600, 220, 600], stops: [[0, '#aaa292'], [1, '#7c7468']] }, a: 0.78, e: 0.4, wob: 1.2, depth: 8.49, gran: 0.4, flow: 0.3 });
      const shade = spline([[180, 640], [200, 612], [222, 590], [246, 566], [258, 574], [240, 600], [218, 626], [206, 652], [204, 678], [210, 702], [216, 724], [196, 726], [190, 700], [188, 670]], true, 3);
      wash([shade], { c: '#584e66', a: 0.62, e: 0.35, depth: 8.49, gran: 0.2, flow: 0.2 });
      wash([spline([[170, 662], [178, 676], [176, 700], [168, 688]], true, 3), spline([[128, 616], [136, 628], [130, 640], [122, 628]], true, 3), limb([[150, 704, 2.2], [158, 676, 2], [154, 650, 1.6]]), limb([[132, 700, 1.8], [140, 680, 1.6]]), limb([[110, 590, 1.6], [124, 606, 2], [140, 622, 1.4]])], { c: '#2c2630', a: 0.75, e: 0.3, wob: 0.5, depth: 8.49, flow: 0.1 });
    });
    paintOlive(OLIVE1, olive1Trunk);
    paintOlive(OLIVE2, () => task(() => {
      wash([limb([[588, 690, 9], [584, 668, 7], [592, 646, 5]]), limb([[586, 664, 4], [566, 640, 2.5]]), limb([[590, 650, 3], [616, 626, 2]])], { c: '#867c70', a: 0.78, e: 0.4, depth: 8.54, gran: 0.3, flow: 0.2 });
    }));
    paintCitrus(TREE_F);
    broom(372, W3(372) - 2, 56, 30, 8.7);
    wallFace(W3, H3, 9, 1);
    /* ---- terrace 4: the big orange tree, the girl */
    task(() => ground((x) => W3(x) + H3, W4, ['#d2cc7c', '#b4c460', '#ecd44a', '#9cb256', '#d8b870'], 10));
    task(() => { // oxalis drifts
      const d = []; for (let i = 0; i < 24; i++) { const x = R(480, 690), y = R(760, 818); d.push(ell(x, y, R(3, 9), R(1.4, 3), R(-0.2, 0.2), 12)); }
      for (let i = 0; i < 16; i++) { const x = R(20, 280), y = R(770, 840); d.push(ell(x, y, R(3, 8), R(1.4, 2.6), 0, 12)); }
      wash(d, { c: '#f0cf2a', a: 0.6, e: 0.3, wob: 0.6, depth: 10.1, flow: 0.15 });
    });
    paintCitrus(TREE_C);
    // the girl
    task(() => {
      const P = FIG.g;
      wash([ell(746, 810, 46, 4.2, 0.04, 30)], { c: '#55579a', a: 0.55, e: 0.35, depth: 10.7, flow: 0.15 });
      wash([P.armL, P.handL, P.armR, P.neck, P.head, P.legL, P.legR], { c: '#d99a72', a: 0.6, e: 0.35, ew: 1, wob: 0.15, rough: 0.1, flow: 0.1 });
      wash([P.dressSh, P.sleeveR], { c: '#9a9ccc', a: 0.55, e: 0.4, ew: 1, wob: 0.3, rough: 0.15, flow: 0.15 });
      wash(P.folds, { c: '#a8a8cc', a: 0.45, e: 0, wob: 0.1, rough: 0, flow: 0 });
      wash([P.sash], { c: '#c8384a', a: 0.88, e: 0.3, ew: 0.8, wob: 0.2, rough: 0.1, flow: 0.1 });
      wash([P.hair, P.bun], { c: '#241c1c', a: 0.9, e: 0.35, ew: 0.8, wob: 0.2, rough: 0.1, flow: 0.05 });
      wash([P.basket], { c: '#c49452', a: 0.75, e: 0.4, ew: 0.8, wob: 0.2, rough: 0.1, holes: P.lemons, flow: 0.15 });
      wash([P.handle], { c: '#8a6034', a: 0.8, e: 0, wob: 0.1, rough: 0, flow: 0 });
      wash(P.lemons, { c: '#f2c832', a: 0.9, e: 0.3, wob: 0.1, rough: 0, flow: 0 });
      wash([P.cheek], { c: '#b86a52', a: 0.45, e: 0.2, wob: 0, rough: 0, flow: 0 });
      wash([P.eye], { c: '#2a1c1c', a: 0.85, e: 0, wob: 0, rough: 0, flow: 0 });
      wash(P.shoes, { c: '#3a2c2c', a: 0.6, e: 0, wob: 0.1, rough: 0, flow: 0 });
    });
    broom(548, W4(548) - 3, 64, 34, 10.6);
    wallFace(W4, H4, 11, 1);
    caper(452, W4(452) + 10, 0.9, 11.05);
    /* ---- terrace 5: two trees and the well framing the light */
    task(() => ground((x) => W4(x) + H4, W5, ['#dcd27e', '#c0ca62', '#f2d850', '#a8bc5a', '#e0c070'], 12));
    task(() => {
      const d = []; for (let i = 0; i < 28; i++) { const x = R(560, 860), y = R(866, 950); d.push(ell(x, y, R(3.5, 10), R(1.6, 3.4), R(-0.2, 0.2), 12)); }
      for (let i = 0; i < 18; i++) { const x = R(0, 220), y = R(880, 950); d.push(ell(x, y, R(3.5, 10), R(1.6, 3.4), 0, 12)); }
      wash(d, { c: '#f0cc28', a: 0.62, e: 0.3, wob: 0.6, depth: 12.1, flow: 0.15 });
      const pop = []; for (const [px, py, n] of [[668, 902, 6], [760, 930, 5], [812, 892, 3]]) for (let i = 0; i < n; i++) { const x = px + R(-26, 26), y = py + R(-8, 8), r = R(2.4, 3.8), q = []; for (let k = 0; k < 6; k++) { const a = (k / 6) * TAU; q.push([x + Math.cos(a) * r * R(0.8, 1.15), y + Math.sin(a) * r * 0.75 * R(0.8, 1.2)]); } pop.push(spline(q, true, 3)); }
      wash(pop, { c: '#e0381e', a: 0.88, e: 0.4, wob: 0.4, depth: 12.15, flow: 0.05 });
    });
    paintCitrus(TREE_A);
    paintCitrus(TREE_B);
    // the well
    task(() => {
      const w = WELL;
      wash([ell(w.cx + 42, w.base + 4, 48, 6, 0.03, 30)], { c: '#55579a', a: 0.55, e: 0.4, depth: 12.7, flow: 0.15 });
      wash([w.body, w.rim].concat(w.posts, [w.beam]), { c: '#e7d4ae', a: 0.35, e: 0.35, gran: 0.45, wob: 0.6, flow: 0.3 });
      const sh = polyline(w.curve(w.top, 7.5), w.cx + 8, w.cx + w.rx, 2).concat(polyline(w.curve(w.base, 7), w.cx + w.rx, w.cx + 8, 2));
      wash([sh, limb([[w.cx + w.rx - 2, w.top - 2, 2.6], [w.cx + w.rx - 3, w.top - 48, 2.4]]), limb([[w.cx - w.rx + 6, w.top - 2, 2.6], [w.cx - w.rx + 7, w.top - 48, 2.4]]), limb([[w.cx - w.rx, w.top - 48, 2], [w.cx + w.rx, w.top - 48, 2]])], { c: '#7c78a8', a: 0.6, e: 0.4, gran: 0.2, wob: 0.6, flow: 0.2 });
      wash([w.hole], { c: '#2a2836', a: 0.85, e: 0.3, wob: 0.4, flow: 0.1 });
      const joints = [];
      for (const yy of [918, 931]) joints.push(limb(polyline(w.curve(yy, 7.2), w.cx - w.rx + 2, w.cx + w.rx - 2, 6).map((p) => [p[0], p[1], 1.1]), 1));
      for (const [xx, yy] of [[572, 914], [604, 914], [560, 927], [590, 928], [616, 926], [576, 941], [606, 940]]) joints.push(limb([[xx, yy, 1.1], [xx, yy + 10, 1.1]]));
      wash(joints, { c: '#6c5f74', a: 0.5, e: 0, wob: 0.2, flow: 0.2 });
      wash([ell(w.cx, w.top - 46, 4.5, 4.5, 0, 14)], { c: '#4a3c36', a: 0.8, e: 0.3, wob: 0.1, flow: 0 });
      wash([limb([[w.cx + 3.5, w.top - 44, 0.9], [w.cx + 3, w.top - 4, 0.9]])], { c: '#6a5444', a: 0.7, e: 0, wob: 0.1, flow: 0 });
      wash([spline([[w.cx - 26, w.top - 4], [w.cx - 15, w.top - 4], [w.cx - 16, w.top + 9], [w.cx - 25, w.top + 9]], true, 2)], { c: '#8a6a4a', a: 0.75, e: 0.4, wob: 0.2, flow: 0.1 });
      wash([ell(w.cx - 20, w.base + 5, 14, 3, 0, 14), ell(w.cx + 10, w.base + 7, 10, 2.4, 0, 12)], { c: '#6f8a40', a: 0.5, e: 0.3, wob: 0.6, flow: 0.2 });
    });
    wallFace(W5, H5, 13, 1.3);
    caper(236, W5(236) + 12, 1, 13.04);
    caper(724, W5(724) + 14, 1.1, 13.04);
    broom(858, W5(858) - 3, 58, 30, 12.3);
    task(() => { // grass hanging over the coping of the wall behind the track
      const blades = [];
      for (let x = 10; x < 1070; x += R(14, 44)) { const y = W5(x) + 1; for (let k = 0; k < 4; k++) blades.push(limb([[x + k * 2.5, y + 2, 2], [x + k * 2.5 + R(-5, 6), y - R(6, 14), 0.3]])); }
      wash(blades, { c: '#6f8a3c', a: 0.6, e: 0.2, wob: 0.2, depth: 13.03, flow: 0.2 });
    });
    /* ---- the mule track */
    task(() => {
      const region = band((x) => W5(x) + H5, (x) => FR(x) + 0.5, -60, 1140, 12);
      const st = [];
      for (let r = 0; r < 4; r++) { let x = -100 - R(0, 80); while (x < 1140) { const len = R(300, 600), t = (r + 0.5) / 4, yy = (xx) => lerp(W5(xx) + H5, FR(xx), t) + R(-4, 4); st.push({ p: limb([[x, yy(x), 20], [x + len / 2, yy(x + len / 2), 30], [x + len, yy(x + len), 18]]), o: { c: ['#e3c998', '#e9d3a6', '#d9bb88'][(rnd() * 3) | 0], a: R(0.3, 0.45) } }); x += len - R(30, 80); } }
      strokesIn(region, st, { e: 0.25, ew: 2.4, flow: 0.4, gran: 0.4, depth: 14, dry: 1 });
      wash([band((x) => W5(x) + H5 - 0.5, (x) => W5(x) + H5 + 9 + 3 * Math.sin(x / 40))], { c: '#8a80a8', a: 0.35, e: 0.3, depth: 14.05, wob: 1, flow: 0.35 });
      wash([limb(polyline((x) => 1036 + 6 * Math.sin(x / 160 + 1), -20, 1100, 30).map((p) => [p[0], p[1], 3]), 2), limb(polyline((x) => 1068 + 5 * Math.sin(x / 140), -20, 1100, 30).map((p) => [p[0], p[1], 2.4]), 2)], { c: '#c2a274', a: 0.28, soft: 1.5, e: 0, depth: 14.1, flow: 0.5 });
      const peb = [[260, 1080], [300, 1046], [480, 1074], [530, 1020], [610, 1064], [690, 1040], [760, 1082], [820, 1030], [900, 1072], [950, 1048], [128, 1070], [440, 1050]];
      wash(peb.map(([x, y]) => ell(x, y, R(2.5, 5), R(1.6, 2.8), R(-0.3, 0.3), 12)), { c: '#d8c6a2', a: 0.5, e: 0.4, depth: 14.15, wob: 0.4, flow: 0.1 });
      wash(peb.map(([x, y]) => ell(x + 3, y + 2.2, R(2.5, 4.5), 1.2, 0, 10)), { c: '#5d5a94', a: 0.5, e: 0.2, depth: 14.16, wob: 0.3, flow: 0 });
    });
    // the figures' shadows on the dust, falling right
    task(() => {
      const sh = [
        spline([[328, 1062], [360, 1068], [420, 1076], [470, 1086], [500, 1090], [496, 1094], [462, 1094], [420, 1086], [372, 1078], [340, 1070]], true, 4),
        spline([[384, 1064], [420, 1070], [440, 1078], [430, 1080], [400, 1074]], true, 3),
        spline([[48, 1030], [90, 1034], [150, 1044], [196, 1052], [200, 1058], [160, 1056], [100, 1046], [56, 1038]], true, 4),
        spline([[150, 1024], [200, 1030], [260, 1040], [302, 1046], [300, 1052], [252, 1048], [196, 1040], [154, 1032]], true, 4),
      ];
      wash(sh, { c: '#55529a', a: 0.58, e: 0.45, depth: 14.2, wob: 1.2, flow: 0.2 });
    });
    /* ---- the figures */
    function paintMan(P, o) {
      task(() => {
        const fx = { wob: 0.5, rough: 0.2, flow: 0.25 };
        if (P.gun) {
          wash([P.gun], Object.assign({}, fx, { c: '#2e2c34', a: 0.88, e: 0.3, ew: 0.8, wob: 0.15, rough: 0.05, holes: o.gunHoles }));
          wash([P.stock], Object.assign({}, fx, { c: '#6e4a2e', a: 0.88, e: 0.35, ew: 0.8, wob: 0.15, rough: 0.05, holes: o.gunHoles }));
        }
        wash([P.neck, P.head].concat(o.skin), Object.assign({}, fx, { c: '#d8956a', a: 0.62, e: 0.35, ew: 1 }));
        wash(o.trousers, Object.assign({}, fx, { c: o.tc, a: 0.82, e: 0.35, ew: 1.2, wob: 0.4, gran: 0.25 }));
        wash(o.shoes, Object.assign({}, fx, { c: '#2a2228', a: 0.9, e: 0.3, ew: 1 }));
        if (o.shirtSh) wash(o.shirtSh, Object.assign({}, fx, { c: '#9ea2cc', a: 0.58, e: 0.4, ew: 1.2, wob: 0.4 }));
        if (o.dark) wash(o.dark, Object.assign({}, fx, { c: o.dc, a: 0.86, e: 0.35, ew: 1.2, gran: 0.2 }));
        if (o.trSh) wash(o.trSh, Object.assign({}, fx, { c: '#2c2834', a: 0.45, e: 0.35, ew: 1, wob: 0.6 }));
        if (o.hair) wash(o.hair, Object.assign({}, fx, { c: o.hc || '#211a18', a: 0.88, e: 0.35, ew: 1, holes: o.hairHoles }));
        if (o.faceSh) wash(o.faceSh, Object.assign({}, fx, { c: '#8e4e3e', a: 0.55, e: 0.3, ew: 0.8, wob: 0.2 }));
        if (o.accents) wash(o.accents, Object.assign({}, fx, { c: '#2a1c1c', a: 0.85, e: 0.2, ew: 0.6, wob: 0.05, rough: 0.03, flow: 0 }));
        if (o.after) o.after();
      });
    }
    const C = FIG.c, Fz = FIG.f, Mi = FIG.m;
    const tc = tr(66, 1034, 1), tf = tr(176, 1028, 1);
    paintMan(C, {
      gunHoles: [C.shirt, C.sleeveB, C.head, C.neck, C.cap], skin: [C.armB, C.armF, C.handF, C.ear], trousers: [C.legB, C.legF, C.hips], tc: '#7a5a3e', shoes: [C.shoeB, C.shoeF],
      shirtSh: [C.sleeveB, C.shirtSh], dark: [C.vest, C.cap, C.strap], dc: '#38323a', trSh: [C.legSh, C.legSh2, C.pocket],
      faceSh: [C.brim.map((q) => [q[0], q[1] + 3.5]), C.faceSh],
      accents: [C.stache, C.grin],
    });
    paintMan(Fz, {
      gunHoles: [Fz.jacL, Fz.sleeveB, Fz.head, Fz.neck, Fz.cap, Fz.shirt], skin: [Fz.handB, Fz.handF, Fz.thumb, Fz.ear], trousers: [Fz.legB, Fz.legF, Fz.hips], tc: '#5e6274', shoes: [Fz.shoeB, Fz.shoeF],
      shirtSh: [Fz.shirtSh], dark: [Fz.jacL, Fz.jacR, Fz.sleeveB, Fz.sleeveF, Fz.cap], dc: '#4a3a32', trSh: [Fz.legSh, Fz.legSh2],
      faceSh: [Fz.brim.map((q) => [q[0], q[1] + 3.5]), Fz.faceSh],
      accents: [Fz.grin],
    });
    paintMan(Mi, {
      skin: [Mi.armB, Mi.handB, Mi.armF, Mi.handF], trousers: [Mi.legB, Mi.legF, Mi.hips], tc: '#625e6a', shoes: [Mi.shoeB, Mi.shoeF],
      shirtSh: [Mi.shirtSh, Mi.spine, Mi.fold, Mi.armShadow, Mi.sleeveSh, Mi.sleeveFsh, Mi.tension], trSh: [Mi.legBsh, Mi.legFsh, Mi.knee],
      hair: [Mi.hair], hc: '#3e2c22', hairHoles: [Mi.ear], faceSh: [Mi.face], accents: [Mi.belt],
      after: () => { wash([Mi.hairSh], { c: '#120c0c', a: 0.6, e: 0.2, wob: 0.2, flow: 0 }); },
    });
    /* ---- the front wall: dry stone in sunlight; below it a strip of wild meadow dissolving into the paper */
    const WB = (x) => 1190 + 9 * Math.sin(x / 80) + 5 * Math.sin(x / 27 + 1) + 4 * Math.sin(x / 13);
    const STONES = [];
    {
      let x = -30 - R(0, 30);
      while (x < 1110) { const w = R(70, 150), x2 = x + w; STONES.push({ p: spline([[x + 1.5, FR(x) + 0.8], [x + w / 2, FR(x + w / 2) - 0.6], [x2 - 1.5, FR(x2) + 0.8], [x2 - 1, FR(x2) + R(13, 17)], [x + w / 2, FR(x + w / 2) + R(15, 19)], [x + 1, FR(x) + R(13, 17)]], true, 4), y: 1100, g: (rnd() * 4) | 0 }); x = x2 + R(1.5, 3.5); }
      let y = 1112;
      while (y < 1200) {
        const h = R(20, 32);
        x = -40 - R(0, 40);
        while (x < 1110) {
          // flat bedded limestone: wide, angular, a little tilted
          const w = R(40, 130), hh = h * R(0.78, 1), oy = R(0, h - hh), tl = R(-0.06, 0.06) * w, jt = () => R(-2.2, 2.2);
          const pts = [[x + R(0, 4), y + oy + jt() - tl / 2], [x + w * R(0.3, 0.6), y + oy + jt() * 0.5], [x + w - R(0, 4), y + oy + jt() + tl / 2], [x + w + jt() * 0.4, y + oy + hh * R(0.4, 0.6)], [x + w - R(2, 6), y + oy + hh + jt() + tl / 2], [x + w * R(0.35, 0.65), y + oy + hh + jt() * 0.5], [x + R(2, 6), y + oy + hh + jt() - tl / 2], [x + jt() * 0.4, y + oy + hh * R(0.4, 0.6)]];
          if (y + oy < WB(x + w / 2) - 6) STONES.push({ p: spline(pts, true, 2), y: y + h / 2, g: (rnd() * 4) | 0 });
          if (rnd() < 0.3) { const cx2 = x + w + 2; STONES.push({ p: spline([[cx2 - 2, y + oy + hh * 0.3], [cx2 + 3, y + oy + hh * 0.25], [cx2 + 3.5, y + oy + hh * 0.7], [cx2 - 2, y + oy + hh * 0.75]], true, 2), y: y + h / 2, g: (rnd() * 4) | 0 }); x += 5; }
          x += w + R(1.5, 4);
        }
        y += h + R(1.5, 3.5);
      }
    }
    task(() => {
      const top = polyline((x) => FR(x) + 0.8, -60, 1140, 10), bot = polyline((x) => WB(x) + 4, 1140, -60, 10);
      wash([top.concat(bot)], { c: { lin: [0, 1092, 0, 1200], stops: [[0, '#5c5068'], [1, '#7a7080']] }, a: 0.48, e: 0.35, depth: 16, gran: 0.35, wob: 1.5, fr: 0.05, flow: 0.45, holes: STONES.map((s) => s.p) });
    });
    task(() => {
      const COL = ['#e3cfa6', '#d9c39a', '#ebdcbc', '#d8bfa0'];
      for (let g = 0; g < 4; g++) wash(STONES.filter((s) => s.g === g).map((s) => s.p), { c: COL[g], a: 0.55, e: 0.35, ew: 2, depth: 16.05, gran: 0.45, wob: 1, dry: 1, flow: 0.45 });
      wash(null, {
        bbox: [-60, 1086, 1140, 1220], depth: 16.1,
        mask: (g) => { for (const s of STONES) { g.globalCompositeOperation = 'source-over'; fillPolys(g, [s.p]); g.globalCompositeOperation = 'destination-out'; fillPolys(g, [s.p.map((q) => [q[0] - 3.2, q[1] - 3.6])]); } g.globalCompositeOperation = 'source-over'; },
        c: '#5e5890', a: 0.5, e: 0.3, flow: 0.35,
      });
      const li = [[140, 1146], [312, 1124], [470, 1170], [742, 1140], [640, 1176], [210, 1172]].map(([x, y]) => ell(x + R(-8, 8), y, R(4, 8), R(3, 5), R(0, 3), 14));
      wash(li, { c: '#e8a632', a: 0.5, soft: 1, e: 0.2, depth: 16.15, flow: 0.3 });
    });
    // the meadow at the foot of the wall: a wash that runs out before the bottom of the sheet
    task(() => {
      const top = polyline((x) => WB(x) - 2, -60, 1140, 10);
      const bot = polyline((x) => 1262 + 10 * Math.sin(x / 47 + 1) + 6 * Math.sin(x / 17), 1140, -60, 8);
      wash([top.concat(bot)], { c: { lin: [0, 1190, 0, 1270], stops: [[0, '#a9b856'], [1, '#c6c66a']] }, a: 0.5, e: 0.3, depth: 16.2, gran: 0.25, wob: 2, fr: 0.06, flow: 0.4, dry: 2,
        charges: [{ x: 300, y: 1230, r: 160, c: '#e6cc4a', a: 0.45 }, { x: 760, y: 1240, r: 140, c: '#8faa4c', a: 0.4 }] });
      const st = [];
      for (const [y0, x0, x1, w] of [[1262, -80, 420, 26], [1270, 380, 900, 22], [1290, -60, 260, 18], [1296, 470, 700, 14], [1316, 120, 330, 10], [1252, 820, 1160, 24]]) st.push({ p: limb([[x0, y0 + R(-3, 3), w * 0.6], [lerp(x0, x1, 0.4), y0 + R(-4, 4), w], [x1, y0 + R(-3, 3), w * 0.35]]), o: { c: rnd() < 0.5 ? '#b8bf62' : '#cfc070', a: R(0.3, 0.42) } });
      strokesIn(null, st, { e: 0.2, ew: 2, flow: 0.4, gran: 0.2, depth: 16.2, dry: 3, skip: ['canopy'] });
      // shadow along the foot of the wall
      wash([band((x) => WB(x) - 3, (x) => WB(x) + 6 + 4 * Math.sin(x / 33))], { c: '#5e5890', a: 0.4, e: 0.3, depth: 16.25, wob: 1.2, flow: 0.3 });
    });
    pen(() => {
      for (let x = 30; x < 860; x += R(30, 70)) { const y = R(1300, 1335); pencil([[x, y + 14], [x + R(-6, 6), y - R(10, 26)]], { a: 0.22 }); pencil([[x + 6, y + 14], [x + 6 + R(-8, 8), y - R(8, 20)]], { a: 0.18 }); }
      for (const s of STONES) if (rnd() < 0.3) outline(s.p, { a: 0.2, gap: 0.4 });
    });
    // lizards basking on sunlit stones
    function lizard(x, y, k, rot, depth) {
      const tf2 = (p) => p.map((q) => { const cx = q[0] * k, cy = q[1] * k; return [x + cx * Math.cos(rot) - cy * Math.sin(rot), y + cx * Math.sin(rot) + cy * Math.cos(rot)]; });
      const body = tf2(limb([[0, 0, 0.5], [5, 0.4, 5], [12, 1, 6.2], [24, 2, 7.4], [36, 3, 7], [44, 5, 5], [58, 10, 3.2], [74, 16, 2], [90, 17, 1.1], [102, 13, 0.3]], 5));
      const legs = [[[16, 0, 2.2], [12, -7, 1.8], [7, -11, 1.2]], [[16, 4, 2.2], [14, 11, 1.8], [9, 15, 1.2]], [[38, 2, 2.4], [43, -6, 2], [50, -9, 1.2]], [[38, 6, 2.4], [42, 13, 2], [49, 16, 1.2]]].map((s) => tf2(limb(s, 3)));
      const all = [body].concat(legs);
      task(() => {
        wash(all.map((p) => p.map((q) => [q[0] + 2.4 * k, q[1] + 3 * k])), { c: '#55528a', a: 0.5, e: 0.3, wob: 0.15, rough: 0.05, depth, flow: 0.1 });
        wash(all, { c: { lin: [x, y, x + 80 * k, y + 20 * k], stops: [[0, '#6f8a3a'], [1, '#7a7046']] }, a: 0.88, e: 0.5, ew: 1, wob: 0.15, rough: 0.05, depth: depth + 0.01, gran: 0.3, flow: 0.15 });
        wash([tf2(limb([[6, 1.2, 1.6], [24, 2.6, 2.6], [40, 4.6, 2], [60, 11, 1], [80, 16.5, 0.5]], 4))], { c: '#2e3a22', a: 0.6, e: 0.2, wob: 0.1, rough: 0.05, flow: 0.1 });
        wash([tf2(ell(5.5, -1.2, 1, 0.9, 0, 8))], { c: '#141010', a: 0.9, e: 0, wob: 0, flow: 0 });
      });
    }
    lizard(548, 1140, 0.82, -0.12, 16.3);
    lizard(668, 974, 0.32, 0.08, 13.05);
    /* ---- prickly pear */
    task(() => wash(PADS.map((p) => ell(p.cx + 16, p.cy + 9, p.rx, p.ry, p.rot, 30)), { c: '#575290', a: 0.42, e: 0.35, depth: 16.5, wob: 1.2, flow: 0.3 }));
    for (const p of PADS.slice().reverse()) {
      task(() => {
        wash([p.poly], { c: { lin: [p.cx - p.rx, p.cy - p.ry, p.cx + p.rx, p.cy + p.ry], stops: [[0, '#b8cc92'], [0.5, '#7ea47c'], [1, '#4a786c']] }, a: 0.86, e: 0.45, ew: 2, wob: 1.2, depth: p.depth, gran: 0.25, flow: 0.35, blooms: rnd() < 0.4 ? [[p.cx + R(-8, 8), p.cy + R(-6, 6), p.rx * 0.35]] : undefined });
        wash(null, { bbox: [p.cx - p.rx - 4, p.cy - p.ry - 4, p.cx + p.rx + 4, p.cy + p.ry + 4], depth: p.depth, mask: (g) => { fillPolys(g, [wob(p.poly, 1, 0.05, 0.3)]); g.globalCompositeOperation = 'destination-out'; fillPolys(g, [ell(p.cx - p.rx * 0.2, p.cy - p.ry * 0.24, p.rx * 0.96, p.ry * 0.9, p.rot, 30)]); g.globalCompositeOperation = 'source-over'; }, c: '#2c564c', a: 0.62, e: 0.35, flow: 0.25 });
        const ar = []; for (let i = 0; i < 10; i++) { const a = R(0, TAU), d = Math.sqrt(R(0.05, 0.75)); const lx = Math.cos(a) * p.rx * d, ly = Math.sin(a) * p.ry * d; const ax = p.cx + lx * Math.cos(p.rot) - ly * Math.sin(p.rot), ay = p.cy + lx * Math.sin(p.rot) + ly * Math.cos(p.rot); ar.push(ell(ax, ay, 0.9, 0.9, 0, 6), limb([[ax, ay, 0.4], [ax + R(-3, 3), ay - R(2, 4), 0.1]])); }
        wash(ar, { c: '#3a3a2a', a: 0.6, e: 0, wob: 0, flow: 0 });
      });
    }
    task(() => {
      const fl = [], buds = [];
      for (const p of PADS.slice(0, 6)) {
        const n = 1 + ((rnd() * 3) | 0);
        for (let i = 0; i < n; i++) {
          const a = p.rot - Math.PI / 2 + R(-0.9, 0.9), x = p.cx + Math.cos(a) * p.rx * 0.95, y = p.cy + Math.sin(a) * p.ry * 0.95;
          if (rnd() < 0.55) fl.push(spline([[x - 5, y - 3], [x - 3, y - 9], [x, y - 6], [x + 3, y - 9.5], [x + 5.5, y - 3], [x + 2, y + 1], [x - 2, y + 1]], true, 3));
          else buds.push(ell(x, y - 3.5, 3, 4.6, a + Math.PI / 2, 12));
        }
      }
      wash(fl, { c: '#f6c62e', a: 0.95, e: 0.45, ew: 1, wob: 0.3, depth: 18, flow: 0.1 });
      wash(fl.map((f) => { const b = bboxOf([f]); return ell((b[0] + b[2]) / 2, b[3] - 3, 1.8, 1.4, 0, 8); }), { c: '#d4782a', a: 0.8, e: 0, wob: 0, flow: 0 });
      wash(buds, { c: '#c85a3a', a: 0.85, e: 0.4, ew: 1, wob: 0.3, depth: 18, flow: 0.1 });
    });
    pen(() => { for (const p of PADS) outline(p.poly, { a: 0.26, gap: 0.2 }); });
    /* ---- wild flowers along the edge of the track and in the meadow below the wall */
    task(() => {
      const blades = [], poppies = [], daisies = [], borage = [], buds = [];
      const poppy = (x, y, r) => { const pts = []; for (let k = 0; k < 7; k++) { const a = (k / 7) * TAU + R(-0.2, 0.2); pts.push([x + Math.cos(a) * r * R(0.8, 1.15), y + Math.sin(a) * r * 0.8 * R(0.8, 1.15)]); } poppies.push(spline(pts, true, 3)); };
      for (const [cx, cy] of [[250, 1090], [300, 1088], [520, 1092], [720, 1090], [880, 1088]]) {
        for (let k = 0; k < 9; k++) { const x = cx + R(-16, 16); blades.push(limb([[x, cy + 4, 2], [x + R(-8, 8), cy - R(8, 22), 0.3]])); }
        for (let k = 0; k < 4; k++) daisies.push(ell(cx + R(-14, 14), cy - R(2, 12), R(2, 3.2), R(1.6, 2.6), 0, 10));
        if (rnd() < 0.7) poppy(cx + R(-10, 10), cy - R(10, 20), R(4, 5.5));
      }
      // tufts hiding the foot of the wall
      for (let x = -10; x < 1090; x += R(16, 34)) { const y = WB(x) + 2; const n = 3 + ((rnd() * 5) | 0); for (let k = 0; k < n; k++) blades.push(limb([[x + k * 2.4, y + 6, 2.2], [x + k * 2.4 + R(-9, 9), y - R(8, 26), 0.3]])); }
      // drifts of flowers in the meadow, densest near the wall
      const drifts = [[120, 1222, 90], [360, 1232, 110], [560, 1214, 70], [720, 1238, 100]];
      for (const [dx, dy, r] of drifts) {
        for (let k = 0; k < 9; k++) { const a = R(0, TAU), d = Math.sqrt(rnd()) * r; daisies.push(ell(dx + Math.cos(a) * d, dy + Math.sin(a) * d * 0.35, R(2.2, 3.6), R(1.6, 2.8), 0, 10)); }
        for (let k = 0; k < 4; k++) { const a = R(0, TAU), d = Math.sqrt(rnd()) * r * 0.8; poppy(dx + Math.cos(a) * d, dy + Math.sin(a) * d * 0.3 - 4, R(4.2, 6.5)); }
        for (let k = 0; k < 3; k++) { const a = R(0, TAU), d = Math.sqrt(rnd()) * r; borage.push(ell(dx + Math.cos(a) * d, dy + Math.sin(a) * d * 0.3 + 6, 2.6, 2.6, 0, 5)); }
        for (let k = 0; k < 14; k++) { const x = dx + R(-r, r), y = dy + R(-10, 30); blades.push(limb([[x, y + 10, 2], [x + R(-10, 10), y - R(12, 30), 0.3]])); }
      }
      for (const p of poppies) { const b = bboxOf([p]); if (rnd() < 0.8) blades.push(limb([[(b[0] + b[2]) / 2, b[3], 0.9], [(b[0] + b[2]) / 2 + R(-4, 4), b[3] + R(10, 22), 0.9]])); if (rnd() < 0.4) buds.push(ell(b[2] + R(2, 6), b[1] + R(0, 8), 1.6, 2.4, R(-0.5, 0.5), 8)); }
      wash(blades, { c: '#5a8638', a: 0.72, e: 0.25, wob: 0.2, depth: 18.2, flow: 0.25 });
      wash(daisies, { c: '#f2c62a', a: 0.95, e: 0.35, wob: 0.2, depth: 18.3, flow: 0.05 });
      wash(daisies.filter(() => rnd() < 0.6).map((d) => { const b = bboxOf([d]); return ell((b[0] + b[2]) / 2, (b[1] + b[3]) / 2, 0.9, 0.8, 0, 6); }), { c: '#b06a1a', a: 0.8, e: 0, wob: 0, flow: 0 });
      wash(poppies, { c: '#e2341e', a: 0.92, e: 0.5, ew: 1.2, wob: 0.4, depth: 18.3, flow: 0.15 });
      wash(poppies.map((p) => { const b = bboxOf([p]); return ell((b[0] + b[2]) / 2 + 0.6, (b[1] + b[3]) / 2 + 0.6, 1.4, 1.2, 0, 8); }), { c: '#1e1820', a: 0.9, e: 0, wob: 0, flow: 0 });
      wash(buds, { c: '#6a8a3a', a: 0.8, e: 0.2, wob: 0, flow: 0 });
      wash(borage, { c: '#4a62c8', a: 0.85, e: 0.3, wob: 0.1, depth: 18.3, flow: 0.05 });
    });

    /* ================================================================== RUN */
    m.setTransform(1, 0, 0, 1, 0, 0); m.globalCompositeOperation = 'source-over'; m.globalAlpha = 1;
    m.fillStyle = '#fbf8f0'; m.fillRect(0, 0, W, H);
    m.globalCompositeOperation = 'multiply'; m.fillStyle = PAT.grain ? m.createPattern(paperT, 'repeat') : '#fff'; m.fillRect(0, 0, W, H);
    {
      const mw = 40, mh = 50, mo = mk(mw, mh), mc = mo.getContext('2d'), id = mc.createImageData(mw, mh);
      for (let i = 0; i < mw * mh; i++) { const v = 255 * (1 - 0.035 * rnd()); id.data[i * 4] = v; id.data[i * 4 + 1] = v; id.data[i * 4 + 2] = v * 0.995; id.data[i * 4 + 3] = 255; }
      mc.putImageData(id, 0, 0); m.imageSmoothingEnabled = true; m.drawImage(mo, 0, 0, W, H);
    }
    m.globalCompositeOperation = 'source-over';
    let t0 = performance.now();
    const all = PENCIL.concat(TASKS);
    for (let i = 0; i < all.length; i++) {
      if (!alive()) return false;
      all[i]();
      if (i === PENCIL.length - 1) onFirst();
      if (performance.now() - t0 > 24) { await frame(); t0 = performance.now(); }
    }
    if (!alive()) return false;
    // the orange, rolling through
    m.save(); m.setTransform(S, 0, 0, S, 0, 0); m.globalCompositeOperation = 'source-over'; m.globalAlpha = 1;
    if (window.FamilyOrange) window.FamilyOrange.drawSeamOranges(m, true, true);
    m.restore();
    return true;
  }

  /* ------------------------------------------------------------------ registration */
  (window.PIECES = window.PIECES || []).push({
    id: 'sicily',
    title: 'The Thunderbolt',
    medium: 'Transparent watercolour over pencil, drawn in JavaScript',
    note: 'Near Corleone, spring 1947',
    about: 'Michael Corleone, in exile in Sicily, stops dead on a mule track: among the orange and lemon trees of a terraced grove stands a village girl with a basket, and his shepherd guards grin behind him. Painted like a travelling watercolourist’s sheet, with the white paper kept for the sunlight. An original interpretation of Puzo’s novel, not of the film.',
    tone: 'light',
    room: ROOM,
    mount(el, api) {
      el.style.background = EXPORT ? '#fbf8f0' : ROOM;
      el.style.overflow = 'hidden';
      const cv = document.createElement('canvas');
      cv.setAttribute('role', 'img');
      cv.setAttribute('aria-label', 'Watercolour: Michael Corleone stops on a mule track in a Sicilian orange grove as he sees a girl among the trees.');
      el.appendChild(cv);
      let gen = 0, curS = 0, timer = 0, readyDone = false, dead = false;
      const ready = () => { if (!readyDone) { readyDone = true; api.ready(); } };
      function layout() {
        const vw = el.clientWidth || window.innerWidth, vh = el.clientHeight || window.innerHeight;
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        let w, h;
        if (EXPORT) { w = vw; h = vh; cv.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;object-fit:cover;display:block'; }
        else {
          const mg = Math.max(16, Math.min(vw, vh) * 0.045);
          h = Math.min(vh - 2 * mg, (vw - 2 * mg) * 1.25); w = h * 0.8;
          const x = (vw - w) / 2, y = (vh - h) / 2;
          cv.style.cssText = 'position:absolute;display:block;left:' + x + 'px;top:' + y + 'px;width:' + w + 'px;height:' + h + 'px;box-shadow:0 1px 2px rgba(40,30,20,.16),0 14px 44px rgba(40,30,20,.20)';
        }
        return Math.max(0.25, Math.min(2, Math.min((w * dpr) / DW, (h * dpr) / DH)));
      }
      function start(S) {
        const my = ++gen; curS = S;
        cv.width = Math.round(DW * S); cv.height = Math.round(DH * S);
        delete document.documentElement.dataset.exportReady;
        paint(cv, S, api.seed >>> 0, () => !dead && my === gen && api.isCurrent(), ready).then((ok) => {
          if (ok && my === gen) { ready(); if (EXPORT) document.documentElement.dataset.exportReady = '1'; }
        }).catch((err) => { console.error(err); ready(); });
      }
      start(layout());
      const ro = new ResizeObserver(() => {
        const S = layout();
        if (Math.abs(S / curS - 1) > 0.12) { clearTimeout(timer); timer = setTimeout(() => start(S), 450); }
      });
      ro.observe(el);
      return { destroy() { dead = true; gen++; clearTimeout(timer); ro.disconnect(); } };
    },
  });
})();
