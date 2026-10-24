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
    const crest = spline([[250, 600], [330, 548], [400, 498], [440, 468], [490, 436], [540, 412], [600, 394], [660, 381], [740, 371], [820, 365], [900, 363], [980, 365], [1060, 369], [1140, 372]], false, 6);
    const valTop = spline([[-60, 430], [60, 420], [180, 414], [300, 420], [400, 430], [470, 444]], false, 6);

    /* ---- the town: Corleone climbing its hill, a Baroque church with a dome, the castle ruin on the rock */
    const gTown = (x) => 472 - 140 * Math.exp(-(((x - 800) / 230) ** 2)) - 70 * Math.exp(-(((x - 1040) / 70) ** 2));
    const tBot = (x) => 488 - 0.03 * (x - 480);
    const ALLEY = [[585, 478], [690, 372]];
    const alleyD = (x, y) => {
      const [[ax, ay], [bx, by]] = ALLEY, t = clamp(((x - ax) * (bx - ax) + (y - ay) * (by - ay)) / ((bx - ax) ** 2 + (by - ay) ** 2), 0, 1);
      return Math.hypot(x - (ax + t * (bx - ax)), y - (ay + t * (by - ay)));
    };
    const WALLC = ['#f3e4c4', '#e9c98c', '#eec4a8', '#d8d2c6', '#f7efdf', '#efd69a', '#e2b88a'];
    const CH = { x: 640, w: 58, base: 404, top: 332 }, TW = { x: 704, w: 28, base: 404, top: 216 };
    const ROWS = [];
    for (let r = 0; r < 8; r++) {
      const row = [];
      let x = 462 + R(0, 16) + r * R(2, 8);
      while (x < 1100) {
        const w = R(15, 34), cx = x + w / 2, base = gTown(cx) + r * 20 + R(-2.5, 2.5), h = R(19, 34);
        const ok = base <= tBot(cx) && alleyD(cx, base - h / 2) > 12 && !(r <= 1 && cx > CH.x - 8 && cx < TW.x + TW.w + 8) && !(cx > 968 && base < 384);
        if (ok) row.push({ x, w, base, top: base - h, r, col: (rnd() * WALLC.length) | 0, a: rnd() < 0.28 ? R(0.08, 0.16) : R(0.26, 0.52), flat: rnd() < 0.18, roofC: rnd() < 0.3 ? 1 : 0 });
        x += w + R(-1, 2.5);
      }
      ROWS.push(row);
    }
    ROWS.forEach((row, r) => row.forEach((b, i) => {
      const nb = row[i + 1], rh = R(3.5, 6);
      b.depth = 5 + r * 0.1;
      b.front = [[b.x, b.top], [b.x + b.w, b.top], [b.x + b.w, b.base], [b.x, b.base]];
      b.roof = b.flat ? [[b.x - 0.5, b.top + 0.5], [b.x + b.w + 0.5, b.top + 0.5], [b.x + b.w + 0.5, b.top - 2], [b.x - 0.5, b.top - 2]] : [[b.x - 1.5, b.top + 1], [b.x + b.w + 1.5, b.top + 1], [b.x + b.w - 1, b.top - rh], [b.x + 1, b.top - rh]];
      const sw = R(5, 9), touching = nb && nb.x - (b.x + b.w) < 4;
      b.side = !touching ? [[b.x + b.w, b.top], [b.x + b.w + sw, b.top + sw * 0.22], [b.x + b.w + sw, b.base - 1], [b.x + b.w, b.base]] : nb.top > b.top + 5 ? [[b.x + b.w, b.top], [b.x + b.w + sw, b.top + sw * 0.22], [b.x + b.w + sw, nb.top - 3], [b.x + b.w, nb.top - 3]] : null;
      reserve(b.depth, [b.front, b.roof].concat(b.side ? [b.side] : []), 'town');
    }));
    // landmarks
    const church = {
      lower: [[CH.x, CH.base], [CH.x, CH.top + 36], [CH.x + CH.w, CH.top + 36], [CH.x + CH.w, CH.base]],
      upper: spline([[CH.x + 2, CH.top + 37], [CH.x + 8, CH.top + 34], [CH.x + 13, CH.top + 28], [CH.x + 13, CH.top + 8], [CH.x + CH.w / 2, CH.top - 4], [CH.x + CH.w - 13, CH.top + 8], [CH.x + CH.w - 13, CH.top + 28], [CH.x + CH.w - 8, CH.top + 34], [CH.x + CH.w - 2, CH.top + 37]], true, 4),
      drum: [[CH.x + 14, CH.top - 2], [CH.x + 14, CH.top - 16], [CH.x + 44, CH.top - 16], [CH.x + 44, CH.top - 2]],
      dome: polyline((x) => CH.top - 16 - 19 * Math.sqrt(Math.max(0, 1 - ((x - CH.x - 29) / 16.5) ** 2)), CH.x + 12.5, CH.x + 45.5, 1.5),
      lantern: [[CH.x + 26.5, CH.top - 34], [CH.x + 26.5, CH.top - 44], [CH.x + 31.5, CH.top - 44], [CH.x + 31.5, CH.top - 34]],
    };
    const tower = {
      front: [[TW.x, TW.top], [TW.x + TW.w, TW.top], [TW.x + TW.w, TW.base], [TW.x, TW.base]],
      side: [[TW.x + TW.w, TW.top], [TW.x + TW.w + 10, TW.top + 2.2], [TW.x + TW.w + 10, TW.base], [TW.x + TW.w, TW.base]],
      cap: [[TW.x - 2, TW.top + 1], [TW.x + TW.w * 0.55 + 4, TW.top - 30], [TW.x + TW.w * 0.55, TW.top + 1]],
      capSh: [[TW.x + TW.w * 0.55, TW.top + 1], [TW.x + TW.w * 0.55 + 4, TW.top - 30], [TW.x + TW.w + 11, TW.top + 3.2]],
    };
    reserve(5.15, [church.lower, church.upper, church.drum, church.dome, church.lantern], 'town');
    reserve(5.16, [tower.front, tower.side, tower.cap, tower.capSh], 'town');
    const CASTLE = {
      rock: spline([[946, 432], [960, 392], [972, 362], [990, 336], [1012, 312], [1046, 304], [1084, 306], [1130, 312], [1130, 440]], true, 4),
      wall: polyline((x) => 318 - 0.08 * (x - 980) + 3 * Math.sin(x / 9), 978, 1130, 3).concat([[1130, 336], [978, 352]]),
      keep: [[1012, 306], [1012, 262], [1018, 258], [1020, 263], [1027, 262], [1029, 256], [1037, 257], [1039, 264], [1046, 266], [1046, 306]],
      round: spline([[1084, 312], [1084, 284], [1090, 279], [1096, 283], [1101, 278], [1106, 282], [1106, 314]], true, 3),
    };
    reserve(4.97, [CASTLE.wall, CASTLE.keep, CASTLE.round], 'town');
    const FORT = band((x) => tBot(x) - 3, (x) => tBot(x) + 15, 466, 1130, 6);
    reserve(5.9, [FORT], 'town');
    const CYP = [[620, 412, 36, 4.6], [609, 424, 26, 3.8], [962, 384, 32, 4.2], [494, 452, 26, 3.6], [884, 452, 22, 3.4], [760, 470, 18, 3]];

    /* ---- distant land */
    const midPoly = midR.concat([[640, 520], [-60, 520]]);
    const valPoly = valTop.concat(polyline((x) => W2(x) + 3, 470, -60, 20));
    const hillPoly = crest.concat(polyline((x) => W2(x) + 3, 1140, 250, 20));
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
        const n = Math.round((rx * ry) / 38) + 4;
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
    reserve(8.49, [spline([[140, 722], [148, 700], [152, 680], [146, 660], [134, 640], [120, 618], [106, 598], [96, 580], [120, 590], [142, 614], [162, 632], [174, 640], [186, 628], [204, 608], [226, 586], [248, 568], [240, 598], [220, 624], [208, 650], [206, 676], [212, 700], [216, 722]], true, 3)], 'trunk');
    const OLIVE1 = planOlive({ depth: 8.5, fs: 1, clumps: [[34, 498, 80, 44], [150, 448, 84, 46], [270, 480, 70, 40], [94, 584, 64, 32], [298, 572, 54, 30], [208, 538, 46, 28], [-16, 586, 48, 32]] });
    const OLIVE2 = planOlive({ depth: 8.55, fs: 0.8, clumps: [[560, 628, 52, 30], [624, 610, 44, 28], [592, 652, 40, 20]] });
    const SMALLOL = [[470, 568, 26], [700, 556, 28], [880, 542, 26], [1040, 532, 24]].map(([x, y, r], i) => planOlive({ depth: 6 + i * 0.01, fs: 0.6, clumps: [[x - r * 0.3, y, r, r * 0.62], [x + r * 0.5, y + 4, r * 0.7, r * 0.5]], base: [x, y + r * 0.9] }));
    const TREE_F = planCitrus({ x: 1010, base: 680, cx: 1004, cy: 612, rx: 92, ry: 72, depth: 8.6, kind: 'orange', fs: 0.75, nf: 22, nb: 8, pal: ['#a2b844', '#5e8a3a', '#3d6340', '#d9d06a', '#2e5440'] });
    const TREE_C = planCitrus({ x: 846, base: 806, cx: 806, cy: 690, rx: 152, ry: 112, depth: 10.5, kind: 'orange', fs: 0.9, nf: 40, nb: 16, pal: ['#90b02e', '#3a7030', '#1a3e2e', '#e0d468', '#14382c'] });
    const TREE_A = planCitrus({ x: 440, base: 953, cx: 404, cy: 800, rx: 140, ry: 114, depth: 12.5, kind: 'orange', fs: 1.05, nf: 40, nb: 16, pal: ['#94b432', '#3a7030', '#183c2a', '#ddd36a', '#12362a'] });
    const TREE_B = planCitrus({ x: 1006, base: 941, cx: 990, cy: 800, rx: 126, ry: 112, depth: 12.6, kind: 'lemon', fs: 1.05, nf: 36, nb: 14, pal: ['#a2c034', '#467c34', '#1f4630', '#e6dc72', '#173e2c'] });

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
        handF: spline([[25, -160], [31, -162], [33, -152], [30, -146], [25, -149]], true, 3),
        sleeveB: limb([[-30, -234, 17], [-36, -212, 16], [-40, -194, 15], [-41, -186, 14.5]]),
        armB: limb([[-41, -188, 10.5], [-41, -166, 9], [-39, -151, 7.5]]),
        handB: spline([[-44, -152], [-35, -153], [-34, -142], [-37, -136], [-43, -138]], true, 3),
        neck: limb([[2, -244, 13], [5, -257, 12]]),
        head: ell(6, -273, 15, 18.5, -0.3, 30),
        hair: spline([[-9, -266], [-9.5, -281], [-4, -292], [6, -296], [16, -293], [21, -285], [20, -275], [17, -265], [10, -259], [2, -257], [-5, -258]], true, 4),
        hairSh: spline([[12, -262], [17, -268], [20, -277], [21, -285], [18, -284], [15, -274], [10, -264]], true, 3),
        ear: ell(15, -270, 2.4, 4.6, -0.25, 12),
        face: spline([[17, -288], [22.5, -282], [24.5, -270], [23, -258], [17, -251], [14, -256], [17, -268]], true, 3),
        shirtSh: spline([[11, -248], [22, -243], [28, -232], [30, -214], [29, -194], [26, -170], [22, -152], [12, -149], [9, -164], [13, -190], [11, -214], [15, -232]], true, 4),
        spine: limb([[-1, -240, 0.8], [-4, -212, 1.6], [-3, -176, 1.1]]),
        fold: limb([[-29, -210, 1.6], [-21, -186, 3], [-23, -162, 1.8]]),
        armShadow: limb([[-31, -226, 3.5], [-32, -202, 4.5], [-30, -182, 3]]),
        sleeveSh: limb([[-26, -232, 6], [-33, -210, 6], [-36, -190, 5]]),
        legBsh: limb([[1, -146, 7], [-6, -112, 6], [-11, -80, 5], [-21, -44, 4.5], [-28, -18, 4]]),
        legFsh: limb([[9, -148, 24], [15, -112, 21], [21, -80, 16], [26, -44, 13], [30, -14, 11.5]]),
        knee: limb([[-18, -84, 1.6], [-13, -78, 2], [-9, -74, 1.4]]),
        belt: limb([[-26, -151, 3], [0, -148, 3], [23, -153, 3]]),
      };
      const rot = (p, cx, cy, th) => p.map((q) => [cx + (q[0] - cx) * Math.cos(th) - (q[1] - cy) * Math.sin(th), cy + (q[0] - cx) * Math.sin(th) + (q[1] - cy) * Math.cos(th)]);
      for (const k of ['head', 'hair', 'hairSh', 'ear', 'face']) P[k] = rot(P[k], 4, -256, -0.2);
      for (const k in P) P[k] = T0(P[k]);
      FIG.m = P;
      reserve(14.8, [P.legB, P.legF, P.shoeB, P.shoeF, P.hips, P.shirt, P.handF, P.sleeveB, P.armB, P.handB, P.neck, P.head, P.hair], 'fig');
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
      const T0 = tr(706, 808, 1.08);
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
    const PADS = (() => {
      // an Opuntia grows pad from pad: each new joint springs from the rim of the one below
      const out = [];
      const padPoly = (x, y, ang, L, Wd) => { // obovate: narrow at the joint, broad at the top
        const pts = [];
        for (let k = 0; k < 16; k++) {
          const t = (k / 16) * TAU, u = Math.sin(t), v = -Math.cos(t);
          const wdt = Wd * (0.55 + 0.45 * (v * 0.5 + 0.5)) * (0.95 + 0.05 * Math.sin(t * 3));
          const lx = u * wdt, ly = (v * 0.5 + 0.5) * L;
          pts.push([x + lx * Math.cos(ang) + ly * Math.sin(ang), y + lx * Math.sin(ang) - ly * Math.cos(ang)]);
        }
        return spline(pts, true, 3);
      };
      const grow = (x, y, ang, L, lvl) => {
        const edge = rnd() < 0.22 && lvl > 0, Wd = L * (edge ? R(0.16, 0.24) : R(0.36, 0.44));
        const poly = padPoly(x, y, ang, L, Wd);
        const tipx = x + Math.sin(ang) * L, tipy = y - Math.cos(ang) * L;
        out.push({ poly, x, y, ang, L, Wd, edge, cx: (x + tipx) / 2, cy: (y + tipy) / 2, tipx, tipy, lvl });
        if (lvl >= 3 || tipy < 1130) return;
        const n = lvl === 0 ? 2 : rnd() < 0.55 ? 2 : 1;
        for (let i = 0; i < n; i++) {
          const off = n === 1 ? R(-0.35, 0.35) : (i ? 1 : -1) * R(0.3, 0.6);
          const bx = x + Math.sin(ang + off) * L * 0.92, by = y - Math.cos(ang + off) * L * 0.92;
          grow(bx, by, ang + off * 1.3 + R(-0.25, 0.25), L * R(0.8, 0.92), lvl + 1);
        }
      };
      grow(948, 1376, -0.25, 76, 0); grow(1052, 1384, 0.2, 80, 0); grow(870, 1392, -0.75, 64, 1);
      out.sort((p1, p2) => p1.lvl - p2.lvl);
      out.forEach((pd, i) => { pd.depth = 17 + i * 0.01; pd.rot = pd.ang; reserve(pd.depth, [pd.poly], 'fig'); });
      return out;
    })();

    // an orange branch hanging into the top-right corner, close to the eye
    const BR = (() => {
      const twigs = [
        [[1130, -30, 13], [1060, 20, 11], [990, 58, 9], [930, 88, 7], [880, 118, 5], [846, 146, 3]],
        [[1040, 28, 6], [1050, 80, 5], [1040, 130, 4], [1024, 176, 2.5]],
        [[990, 58, 5], [960, 104, 4], [944, 150, 3], [940, 196, 2]],
        [[930, 88, 4], [896, 92, 3], [858, 84, 2]],
        [[1110, 10, 7], [1100, 70, 5], [1088, 120, 3.5], [1078, 160, 2]],
      ];
      const sk = twigs.map((t) => spline(t, false, 6));
      const leaves = [], fruit = [], blos = [];
      sk.forEach((pts, ti) => {
        for (let i = 2; i < pts.length - 1; i += 1) {
          if (rnd() < 0.2) continue;
          const [x, y] = pts[i], [x2, y2] = pts[i + 1], dir = Math.atan2(y2 - y, x2 - x);
          for (const side of [-1, 1]) {
            if (rnd() < 0.08) continue;
            const ang = dir + side * R(0.5, 1.4) + 0.35, len = R(12, 21), wid = len * R(0.34, 0.44);
            const cx = x + Math.cos(ang) * len * 0.9, cy = y + Math.sin(ang) * len * 0.9;
            const tip = [cx + Math.cos(ang) * len, cy + Math.sin(ang) * len], base = [cx - Math.cos(ang) * len, cy - Math.sin(ang) * len];
            const nx = -Math.sin(ang) * wid, ny = Math.cos(ang) * wid;
            const poly = spline([base, [cx - Math.cos(ang) * len * 0.3 + nx, cy - Math.sin(ang) * len * 0.3 + ny], tip, [cx - Math.cos(ang) * len * 0.3 - nx, cy - Math.sin(ang) * len * 0.3 - ny]], true, 4);
            const lit = Math.sin(ang) < -0.1 ? 0.42 : 0.12;
            leaves.push({ poly, v: rnd() < lit ? 0 : rnd() < 0.6 ? 1 : 2, x: cx, y: cy, ang });
          }
        }
      });
      for (const [x, y, r] of [[902, 152, 13], [952, 136, 12], [1016, 196, 14], [1060, 150, 12], [868, 196, 11]]) fruit.push({ x: x + R(-4, 4), y: y + R(-3, 3), r });
      for (let i = 0; i < 7; i++) { const L = leaves[(rnd() * leaves.length) | 0]; blos.push([L.x + R(-6, 6), L.y + R(-6, 6), R(4, 5.5)]); }
      const star = (x, y, r) => { const p = []; for (let k = 0; k < 10; k++) { const a = (k / 10) * TAU - Math.PI / 2, rr = k % 2 ? r * 0.42 : r; p.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr]); } return spline(p, true, 2); };
      const bl = blos.map(([x, y, r]) => star(x, y, r));
      reserve(30, leaves.map((L) => L.poly).concat(fruit.map((f) => ell(f.x, f.y, f.r, f.r, 0, 24))), 'near');
      return { twigs, sk, leaves, fruit, bl, blos };
    })();

    /* ================================================================== PENCIL UNDERDRAWING */
    pen(() => { pencil(farR.filter((p, i) => i % 2 === 0), { a: 0.2, gap: 0.3 }); pencil(midR, { a: 0.16, gap: 0.4 }); pencil(crest, { a: 0.2, gap: 0.2 }); });
    pen(() => { for (const row of ROWS) for (const b of row) outline(b.front, { a: 0.18, wob: 0.4, gap: 0.35 }); outline(church.lower, { a: 0.26 }); outline(church.upper, { a: 0.26 }); pencil(church.dome, { a: 0.26 }); outline(tower.front, { a: 0.24 }); outline(CASTLE.keep, { a: 0.24 }); });
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
      const puff = (x, y, s, n) => { const out = []; let px = x; for (let i = 0; i < n; i++) { const r = R(9, 22) * s; out.push(ell(px, y - r * 0.45 + R(-5, 3), r * R(1.2, 1.9), r * R(0.7, 1), R(-0.25, 0.1), 28)); px += r * R(0.9, 1.7); } out.push(ell(x + (px - x) / 2, y + 3, (px - x) / 2 + 14, 5 * s, -0.02, 36)); return out; };
      clouds.push(...puff(R(-20, 10), R(200, 208), 1.05, 7), ...puff(R(250, 280), R(226, 232), 0.65, 4), ...puff(R(560, 590), R(150, 156), 0.45, 3));
    }
    const skyRegion = [[-60, -60], [1140, -60]].concat(farR.slice().reverse().map((p) => [p[0], p[1] + 4]));
    task(() => wash([[[-60, 140], [1140, 140], [1140, 480], [-60, 480]]], { raw: true, c: '#f3d8a4', a: 0.3, soft: 26, e: 0, flow: 0.2, depth: 0 }));
    task(() => {
      wash([skyRegion], {
        c: { lin: [0, -40, 0, 350], stops: [[0, '#2a5db0'], [0.38, '#4a8fcb'], [0.78, '#8ec0da'], [1, '#c4dde0']] }, a: 0.84, e: 0.12, ew: 3, wob: 2, flow: 0.16, gran: 0, grad: 0.18, gradAngle: 0.5,
        holes: clouds, holeSoft: 5, depth: 0, charges: [{ x: 30, y: 10, r: 360, c: '#33409e', a: 0.45 }, { x: 1040, y: 30, r: 300, c: '#2a68b8', a: 0.3 }, { x: 620, y: 300, r: 280, c: '#d2c0c8', a: 0.35 }],
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
      wash([poly], { c: { lin: [0, 236, 0, 430], stops: [[0, '#737cc4'], [0.45, '#9c9cd0'], [1, '#f4eee6']] }, a: 0.66, e: 0.35, ew: 2.4, depth: 1, wob: 1.2, gran: 0.2, flow: 0.3 });
      wash([spline([[394, 249], [410, 266], [436, 291], [468, 305], [440, 312], [416, 298], [400, 276]], true, 3), limb([[226, 256, 0.5], [236, 280, 7], [246, 316, 3], [250, 334, 0.5]]), limb([[318, 248, 0.5], [326, 270, 6], [334, 302, 2.5], [338, 318, 0.5]]), limb([[160, 276, 0.5], [168, 298, 5], [174, 322, 0.5]])], { c: '#6264a8', a: 0.26, e: 0.3, depth: 1.1, wob: 1, soft: 1.1, flow: 0.4 });
    });
    // ---- middle hills, cobalt going green
    task(() => wash([midPoly], { c: { lin: [0, 352, 0, 470], stops: [[0, '#4a74b4'], [0.55, '#6f94ac'], [1, '#a2b88e']] }, a: 0.62, e: 0.3, depth: 2, wob: 1.6, gran: 0.1, flow: 0.3, soft: 0.9, charges: [{ x: 120, y: 360, r: 120, c: '#4a5c9c', a: 0.35 }] }));
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
      for (const [p, col, a] of F) wash([p], { c: col, a, e: 0.2, ew: 1.6, depth: 3.1, wob: 1, gran: 0.1, flow: 0.35, soft: 1.2 });
      for (const ln of [[[110, 426], [150, 448], [192, 478], [236, 514]], [[250, 422], [282, 444], [322, 472], [360, 514]], [[-60, 464], [150, 448], [282, 444], [420, 452]], [[-60, 496], [192, 478], [322, 472], [452, 484]]]) {
        const pts = spline(ln, false, 8), segs = [];
        for (let i = 0; i < pts.length - 4; i += 4) { if (rnd() < 0.3) continue; segs.push(limb([[pts[i][0], pts[i][1] - 1, R(1.6, 2.6)], [pts[i + 2][0], pts[i + 2][1] - 1.5, R(2.4, 3.6)], [pts[i + 4][0], pts[i + 4][1] - 1, R(1.2, 2.2)]])); }
        wash(segs, { c: '#56723e', a: 0.5, e: 0.3, ew: 1, depth: 3.2, wob: 0.8, rough: 0.5, flow: 0.25, soft: 0.4 });
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
      c: { lin: [600, 380, 760, 640], stops: [[0, '#e6bd72'], [0.5, '#d2c474'], [1, '#a8bf5e']] }, a: 0.58, e: 0.25, depth: 4, wob: 1.4, gran: 0.2, flow: 0.35, holes: [zig],
      charges: [{ x: 780, y: 450, r: 160, c: '#c98a4a', a: 0.35 }, { x: 560, y: 530, r: 110, c: '#9fb860', a: 0.45 }, { x: 960, y: 530, r: 140, c: '#9fb860', a: 0.35 }],
    }));
    // ---- the castle rock, the curtain wall and keep, the ruined round tower
    task(() => {
      wash([CASTLE.rock], { c: { lin: [960, 300, 1100, 440], stops: [[0, '#e8d4a8'], [1, '#c8b08a']] }, a: 0.5, e: 0.4, depth: 4.95, gran: 0.4, flow: 0.4 });
      const fis = []; for (let i = 0; i < 14; i++) { const x = R(968, 1120), y = R(330, 400); fis.push(limb([[x, y, 0.5], [x + R(-3, 3), y + R(10, 26), R(2, 4)], [x + R(-4, 4), y + R(24, 44), 0.5]])); }
      wash(fis.concat([spline([[1060, 320], [1100, 318], [1130, 322], [1130, 430], [1090, 420], [1070, 380]], true, 3)]), { c: '#6a5c8c', a: 0.5, e: 0.4, depth: 4.96, flow: 0.3 });
      wash([CASTLE.wall, CASTLE.keep, CASTLE.round], { c: '#e6d2a8', a: 0.38, e: 0.4, depth: 4.97, gran: 0.4, flow: 0.4, wob: 0.6 });
      wash([[[1038, 266], [1046, 266], [1046, 306], [1038, 304]], spline([[1096, 283], [1101, 278], [1106, 282], [1106, 314], [1097, 312]], true, 2), [[1100, 320], [1130, 318], [1130, 336], [1100, 338]]], { c: '#6e6a9c', a: 0.6, e: 0.4, depth: 4.98, flow: 0.25 });
      wash([[[1024, 272], [1026.5, 272], [1026.5, 284], [1024, 284]], [[1024, 290], [1026.5, 290], [1026.5, 298], [1024, 298]], [[1092, 292], [1094.5, 292], [1094.5, 300], [1092, 300]], spline([[1000, 340], [1000, 332], [1004, 328], [1008, 332], [1008, 340]], true, 2)], { c: '#2a2438', a: 0.85, e: 0.2, wob: 0.2, depth: 4.98, flow: 0 });
    });
    // ---- the town: rows of houses climbing the hill, back to front
    task(() => wash([].concat(...ROWS.map((row) => row.map((b) => b.front))).concat([church.lower, church.upper, tower.front]), { c: '#f0dcb0', a: 0.2, e: 0.2, ew: 1.4, wob: 0.6, rough: 0.3, flow: 0.45, grad: 0.5, gradAngle: -0.4, gran: 0.1 }));
    task(() => { // the stepped street
      const [[ax, ay], [bx, by]] = ALLEY, st = [];
      for (let k = 0; k < 18; k++) { const t = k / 17, x = lerp(ax, bx, t), y = lerp(ay, by, t); st.push([[x - 7, y], [x + 7, y - 0.5], [x + 7, y + 1.6], [x - 7, y + 2]]); }
      wash(st, { c: '#7a74a6', a: 0.6, e: 0.2, wob: 0.3, depth: 4.99, flow: 0.2 });
      wash([limb([[ax + 9, ay, 4], [bx + 9, by, 3]])], { c: '#7a74a6', a: 0.45, e: 0.3, depth: 4.99, flow: 0.3 });
    });
    ROWS.forEach((row, r) => task(() => {
      const d = 5 + r * 0.1;
      if (row.length) {
        for (let ci = 0; ci < WALLC.length; ci++) { const hs = row.filter((b) => b.col === ci); if (hs.length) wash(hs.map((b) => b.front), { c: WALLC[ci], a: hs.reduce((s2, b) => s2 + b.a, 0) / hs.length, e: 0.35, ew: 1.1, wob: 0.6, rough: 0.3, depth: d, gran: 0.25, flow: 0.4, grad: 0.4 }); }
        wash(row.filter((b) => b.side).map((b) => b.side), { c: '#7476b2', a: 0.62, e: 0.45, ew: 1, wob: 0.4, rough: 0.2, depth: d, flow: 0.3, grad: 0.4, gradAngle: Math.PI / 2 });
        for (let rc = 0; rc < 2; rc++) wash(row.filter((b) => b.roofC === rc && !b.flat).map((b) => b.roof), { c: rc ? '#a85236' : '#c8704a', a: 0.82, e: 0.4, ew: 1, wob: 0.3, rough: 0.15, depth: d, gran: 0.3, flow: 0.25 });
        wash(row.filter((b) => b.flat).map((b) => b.roof), { c: '#9a8a7a', a: 0.5, e: 0.3, wob: 0.2, depth: d, flow: 0.2 });
        // eave shadows and shadows cast by taller neighbours
        const sh = [];
        for (const b of row) {
          if (!b.flat) sh.push([[b.x, b.top + 0.8], [b.x + b.w, b.top + 0.8], [b.x + b.w, b.top + 3], [b.x, b.top + 3.4]]);
          if (rnd() < 0.35) { const dx = R(5, 12), dy = R(8, 18); sh.push([[b.x, b.top + 1], [b.x + dx, b.top + 1], [b.x, b.top + dy]]); }
        }
        wash(sh, { c: '#6e6ca8', a: 0.5, e: 0.3, wob: 0.25, depth: d, flow: 0.2 });
        // windows, shutters, arched doors, balconies, laundry strung across the lanes
        const win = [], shut = [], bal = [], lau = [];
        row.forEach((b, i) => {
          const floors = Math.max(1, Math.floor((b.base - b.top) / 11));
          for (let f = 0; f < floors; f++) {
            const n = Math.max(1, Math.floor(b.w / 11)), fy = b.top + 5 + f * 11;
            for (let k = 0; k < n; k++) {
              if (rnd() < 0.3) continue;
              const wx = b.x + (b.w / (n + 1)) * (k + 1) - 1.4 + R(-1, 1);
              if (f === floors - 1 && rnd() < 0.4) { win.push(spline([[wx - 0.6, b.base], [wx - 0.6, b.base - 6], [wx + 1.5, b.base - 8], [wx + 3.6, b.base - 6], [wx + 3.6, b.base]], true, 2)); continue; }
              win.push([[wx, fy], [wx + 2.8, fy], [wx + 2.8, fy + 4.2], [wx, fy + 4.2]]);
              if (rnd() < 0.3) shut.push([[wx - 1.6, fy], [wx - 0.4, fy], [wx - 0.4, fy + 4.2], [wx - 1.6, fy + 4.2]], [[wx + 3.2, fy], [wx + 4.4, fy], [wx + 4.4, fy + 4.2], [wx + 3.2, fy + 4.2]]);
              if (f < floors - 1 && rnd() < 0.18) { bal.push([[wx - 2.5, fy + 4.6], [wx + 5.3, fy + 4.6], [wx + 5.3, fy + 5.6], [wx - 2.5, fy + 5.6]]); for (let q = 0; q < 4; q++) bal.push([[wx - 2 + q * 2.2, fy + 2.4], [wx - 1.5 + q * 2.2, fy + 2.4], [wx - 1.5 + q * 2.2, fy + 4.6], [wx - 2 + q * 2.2, fy + 4.6]]); }
            }
          }
          const nb = row[i + 1];
          if (r >= 2 && nb && rnd() < 0.22) {
            const x0 = b.x + b.w - 4, y0 = b.top + 8, x1 = nb.x + 4, y1 = nb.top + 9;
            if (x1 - x0 > 6 && x1 - x0 < 40) {
              bal.push(limb([[x0, y0, 0.4], [(x0 + x1) / 2, (y0 + y1) / 2 + 2.5, 0.4], [x1, y1, 0.4]]));
              for (let q = 1; q < 4; q++) { const t = q / 4, lx = lerp(x0, x1, t), ly = lerp(y0, y1, t) + 2.5 * Math.sin(t * Math.PI); lau.push({ p: [[lx - 1.2, ly], [lx + 1.2, ly], [lx + 1.2, ly + R(2.5, 4)], [lx - 1.2, ly + R(2.5, 4)]], c: ['#f4f0e6', '#86aed4', '#cc4a3a', '#e8c25a'][(rnd() * 4) | 0] }); }
            }
          }
        });
        wash(win, { c: '#2a2438', a: 0.82, e: 0.25, ew: 0.6, wob: 0.3, rough: 0.2, depth: d, flow: 0.15 });
        wash(shut, { c: '#4f7a62', a: 0.7, e: 0.2, wob: 0.2, depth: d, flow: 0.1 });
        wash(bal, { c: '#3a3040', a: 0.75, e: 0, wob: 0.1, rough: 0, depth: d, flow: 0 });
        for (const L of lau) wash([L.p], { c: L.c, a: L.c === '#f4f0e6' ? 0.2 : 0.8, e: 0.4, wob: 0.1, rough: 0, depth: d, flow: 0 });
      }
      if (r === 1) { // the church and its campanile stand among the second row
        wash([church.lower, church.upper], { c: '#efd8a8', a: 0.4, e: 0.4, ew: 1, wob: 0.4, depth: 5.15, gran: 0.3, flow: 0.35 });
        wash([church.drum, church.dome], { c: { lin: [CH.x + 12, 0, CH.x + 46, 0], stops: [[0, '#8fb4a2'], [0.55, '#5e8e84'], [1, '#2f5856']] }, a: 0.85, e: 0.4, wob: 0.3, depth: 5.15, flow: 0.25 });
        const ribs = []; for (let k = 0; k < 5; k++) { const x = CH.x + 18 + k * 5.5; ribs.push(limb([[x, CH.top - 16, 0.7], [lerp(x, CH.x + 29, 0.6), CH.top - 31, 0.6], [CH.x + 29, CH.top - 35, 0.4]])); }
        wash(ribs, { c: '#d8b04a', a: 0.7, e: 0, wob: 0, depth: 5.15, flow: 0 });
        wash([church.lantern], { c: '#e6d0a0', a: 0.5, e: 0.4, depth: 5.15, flow: 0 });
        const X = CH.x, T = CH.top, Bs = CH.base, det = [];
        det.push([[X - 1, T + 35], [X + CH.w + 1, T + 35], [X + CH.w + 1, T + 38], [X - 1, T + 38]]);
        for (const px of [X + 2, X + 14, X + CH.w - 17, X + CH.w - 5]) det.push([[px, T + 39], [px + 3, T + 39], [px + 3, Bs], [px, Bs]]);
        for (const px of [X + 15, X + CH.w - 18]) det.push([[px, T + 9], [px + 2.4, T + 9], [px + 2.4, T + 34], [px, T + 34]]);
        det.push(limb([[X + 13, T + 8, 1.6], [X + CH.w / 2, T - 3, 1.6], [X + CH.w - 13, T + 8, 1.6]]));
        wash(det, { c: '#9a90b0', a: 0.55, e: 0.3, wob: 0.25, depth: 5.15, flow: 0.2 });
        wash([spline([[X + 23, Bs], [X + 23, Bs - 18], [X + 29, Bs - 25], [X + 35, Bs - 18], [X + 35, Bs]], true, 3), ell(X + 29, T + 20, 4.4, 4.4, 0, 16), spline([[X + 6, T + 62], [X + 6, T + 50], [X + 8, T + 47], [X + 10, T + 50], [X + 10, T + 62]], true, 2), spline([[X + CH.w - 10, T + 62], [X + CH.w - 10, T + 50], [X + CH.w - 8, T + 47], [X + CH.w - 6, T + 50], [X + CH.w - 6, T + 62]], true, 2)], { c: '#2a2438', a: 0.84, e: 0.25, wob: 0.25, depth: 5.15, flow: 0.1 });
        wash([[[X + CH.w - 2, T + 37], [X + CH.w + 7, T + 39], [X + CH.w + 7, Bs], [X + CH.w - 2, Bs]], [[X + CH.w - 13, T + 8], [X + CH.w - 8, T + 34], [X + CH.w - 2, T + 37], [X + CH.w - 13, T + 34]]], { c: '#7476b2', a: 0.55, e: 0.4, depth: 5.15, flow: 0.3 });
        wash([tower.front], { c: '#f2e2bc', a: 0.32, e: 0.35, wob: 0.4, depth: 5.16, gran: 0.25, flow: 0.4 });
        wash([tower.side], { c: '#7476b2', a: 0.6, e: 0.45, wob: 0.3, depth: 5.16, flow: 0.3, grad: 0.4, gradAngle: Math.PI / 2 });
        wash([tower.cap], { c: '#d0743e', a: 0.82, e: 0.35, wob: 0.2, depth: 5.16, flow: 0.2 }); wash([tower.capSh], { c: '#8e4232', a: 0.86, e: 0.35, wob: 0.2, depth: 5.16, flow: 0.1 });
        const to = [], x = TW.x, top = TW.top;
        for (const yy of [top + 12, top + 52]) for (const xx of [x + 6, x + 16]) to.push(spline([[xx, yy + 18], [xx, yy + 4], [xx + 3.2, yy], [xx + 6.4, yy + 4], [xx + 6.4, yy + 18]], true, 3));
        to.push([[x - 1.5, top + 36], [x + TW.w + 1.5, top + 36], [x + TW.w + 1.5, top + 39], [x - 1.5, top + 39]], [[x - 1.5, top + 76], [x + TW.w + 1.5, top + 76], [x + TW.w + 1.5, top + 79], [x - 1.5, top + 79]]);
        to.push([[x + 12, top + 110], [x + 15.5, top + 110], [x + 15.5, top + 118], [x + 12, top + 118]], [[x + 12, top + 140], [x + 15.5, top + 140], [x + 15.5, top + 148], [x + 12, top + 148]]);
        wash(to, { c: '#2a2438', a: 0.82, e: 0.25, wob: 0.25, depth: 5.16, flow: 0.1 });
        wash([ell(x + 9.2, top + 24, 2, 3, 0, 10), ell(x + 19.2, top + 24, 2, 3, 0, 10)], { c: '#b8862e', a: 0.85, e: 0, wob: 0, flow: 0 });
        const cx = tower.cap[1][0], cy = tower.cap[1][1];
        wash([limb([[cx, cy + 1, 1.2], [cx, cy - 12, 1.2]]), limb([[cx - 3.5, cy - 8, 1.1], [cx + 3.5, cy - 8, 1.1]])], { c: '#3a3452', a: 0.8, e: 0, wob: 0, flow: 0 });
      }
    }));
    // ---- the town wall built into the rock, the rock below it, cypresses
    task(() => {
      const rocks = []; for (let x = 470; x < 1120; x += R(30, 70)) { const y = tBot(x) + 14; rocks.push(spline([[x, y], [x + R(20, 40), y - 2], [x + R(30, 60), y + R(10, 24)], [x + R(10, 30), y + R(16, 30)], [x - R(4, 12), y + R(8, 16)]], true, 3)); }
      wash(rocks, { c: '#e0caa0', a: 0.45, e: 0.4, depth: 4.4, gran: 0.4, flow: 0.4 });
      wash(rocks.map((p) => p.map((q) => [q[0] + 4, q[1] + 3])), { c: '#6e6496', a: 0.45, e: 0.35, depth: 4.45, flow: 0.3, holes: rocks });
      wash([FORT], { c: { lin: [0, 460, 0, 500], stops: [[0, '#ead6aa'], [1, '#d4bc8e']] }, a: 0.42, e: 0.4, depth: 5.9, gran: 0.45, flow: 0.4, wob: 0.8 });
      const j = []; for (let x = 470; x < 1120; x += R(8, 20)) { const y = tBot(x) + R(1, 12); j.push([[x, y], [x + R(4, 9), y - 0.4], [x + R(3, 7), y + 1.4]]); }
      const butt = []; for (const x of [540, 700, 860, 1010]) butt.push([[x, tBot(x) - 3], [x + 7, tBot(x) - 3], [x + 12, tBot(x) + 15], [x + 7, tBot(x) + 15]]);
      wash(j.concat(butt), { c: '#6a5c80', a: 0.55, e: 0.2, wob: 0.3, depth: 5.91, flow: 0.3 });
      wash([band((x) => tBot(x) - 3, (x) => tBot(x) - 0.5, 466, 1130, 6)], { c: '#6e6496', a: 0.55, e: 0.3, depth: 5.92, flow: 0.3 });
      wash(CYP.map(([x, y, h, w]) => spline([[x - w * 0.6, y], [x - w, y - h * 0.35], [x - w * 0.5, y - h * 0.8], [x, y - h], [x + w * 0.5, y - h * 0.75], [x + w, y - h * 0.3], [x + w * 0.5, y]], true, 4)), { c: { lin: [0, 360, 40, 470], stops: [[0, '#2a4a36'], [1, '#1a3226']] }, a: 0.88, e: 0.4, wob: 0.4, rough: 0.3, depth: 5.95, flow: 0.2 });
    });
    // ---- terraces on the upper hillside with rows of olives; the mule track zig-zags up to the town
    task(() => {
      for (let k = 0; k < 5; k++) {
        const f = (x) => 480 + 28 * k - 0.045 * (x - 420) + 4 * Math.sin(x / 70 + k * 1.7);
        const x0 = 470 - k * 20, pts = polyline(f, x0, 1130, 10).filter((p) => p[1] > yAt(crest, p[0]) + 22 && p[1] < W2(p[0]) - 10);
        if (pts.length < 3) continue;
        const strip = limb(pts.map((p) => [p[0], p[1], 1.8]), 1);
        wash([strip], { c: '#9a8a8a', a: 0.3, e: 0.2, wob: 0.4, depth: 4.6, flow: 0.3 });
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
        wash(massP, { c: { lin: [bb[0], bb[1], bb[2], bb[3]], stops: [[0, '#b4bc96'], [1, '#8e9a80']] }, a: 0.4, soft: 4, e: 0, flow: 0.35, depth: t.depth });
        wash(dL, { c: { lin: [bb[0], bb[1], bb[2], bb[3]], stops: [[0, '#9fae88'], [1, '#7c8c72']] }, a: 0.8, e: 0.35, ew: 1, wob: 0.5, rough: 0.2, depth: t.depth, gran: 0.2, flow: 0.25 });
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
        wash([sh], { c: '#40408c', a: 0.68, e: 0.4, wob: 3, fr: 0.05, depth: t.depth - 0.25, holes: flecks, flow: 0.25 });
      });
      task(() => wash(lobeP.concat(t.dabs), {
        c: { lin: [t.cx - t.rx, t.cy - t.ry, t.cx + t.rx * 0.5, t.cy + t.ry], stops: [[0, t.pal[0]], [0.5, t.pal[1]], [1, t.pal[2]]] }, a: 0.95, e: 0.3, ew: 2, wob: 2.6, fr: 0.06, grad: 0.08,
        holes: holes.concat(t.gaps), depth: t.depth, gran: 0.08, flow: 0.1, gradAngle: -2.4,
        charges: [{ x: t.cx - t.rx * 0.45, y: t.cy - t.ry * 0.55, r: t.rx * 0.55, c: t.pal[3], a: 0.55 }, { x: t.cx + t.rx * 0.45, y: t.cy + t.ry * 0.35, r: t.rx * 0.6, c: '#1f3f50', a: 0.4 }],
      }));
      task(() => { // shadow mass: the lobes turned from the light, broken where lit lobes come forward, with leafy edges
        const WL = lobeP.map((p) => wob(p, 2.4, 0.06, 0.45));
        const LT = t.lobes.map((L) => wob(ell(L[0] - L[2] * 0.3, L[1] - L[2] * 0.36, L[2] * 0.92, L[2] * 0.84, 0, 26), 4.5, 0.09, 0.8));
        const lit = t.lobes.map((L) => (t.cx - L[0]) / t.rx + (t.cy - L[1]) / t.ry);
        const eIn = [], eOut = [];
        t.lobes.forEach((L, i) => {
          if (lit[i] <= -0.6) return;
          const cx = L[0] - L[2] * 0.3, cy = L[1] - L[2] * 0.36, step = 7 / L[2];
          for (let a = -0.5; a < 2.5; a += step * R(0.7, 1.3)) {
            const x = cx + Math.cos(a) * L[2] * 0.92, y = cy + Math.sin(a) * L[2] * 0.84;
            if (!t.inside(x, y, 0.95)) continue;
            if (rnd() < 0.75) eIn.push(t.leaf(x - Math.cos(a) * R(1, 4), y - Math.sin(a) * R(1, 4), a + Math.PI / 2 + R(-0.8, 0.8)));
            if (rnd() < 0.6) eOut.push(t.leaf(x + Math.cos(a) * R(1.5, 5), y + Math.sin(a) * R(1.5, 5), a + Math.PI / 2 + R(-0.8, 0.8), 0.85));
          }
        });
        wash(null, { bbox: bbx, mask: (g) => { for (let i = 0; i < WL.length; i++) { g.globalCompositeOperation = 'source-over'; if (lit[i] < 0.55) fillPolys(g, [WL[i]]); g.globalCompositeOperation = 'destination-out'; if (lit[i] > -0.6) fillPolys(g, [LT[i]]); } g.globalCompositeOperation = 'source-over'; fillPolys(g, eIn); g.globalCompositeOperation = 'destination-out'; fillPolys(g, eOut); g.globalCompositeOperation = 'source-over'; }, c: t.pal[4], a: 0.76, e: 0.4, holes, depth: t.depth, gran: 0.1, flow: 0.3, gradAngle: -2.3 });
      });
      task(() => { // the dark hollow under the dome, and a few deep pockets
        const WL = lobeP.map((p) => wob(p, 2.2, 0.06, 0.4));
        const under = wob(ell(t.cx + t.rx * 0.12, t.cy + t.ry * 0.72, t.rx * 0.84, t.ry * 0.34, 0, 50), 5, 0.05, 0.8);
        const pockets = []; for (let i = 0; i < 5; i++) { const L = t.lobes[(rnd() * t.lobes.length) | 0]; pockets.push(wob(ell(L[0] + L[2] * 0.55, L[1] + L[2] * 0.6, L[2] * R(0.18, 0.3), L[2] * R(0.12, 0.2), R(-1, 1), 16), 1.5, 0.1, 0.3)); }
        wash(null, { bbox: bbx, mask: (g) => { fillPolys(g, WL); g.globalCompositeOperation = 'destination-in'; fillPolys(g, [under]); g.globalCompositeOperation = 'source-over'; fillPolys(g, pockets); }, c: '#0d1c1c', a: 0.84, e: 0.35, ew: 2, holes: holesF, depth: t.depth, gran: 0.1, flow: 0.3 });
        // leaf touches across the lit side, and twigs in the dark
        const lv = []; for (let i = 0; i < 12; i++) { const L = t.lobes[(rnd() * t.lobes.length) | 0], a = R(-2.6, -0.2), d = L[2] * R(0.75, 1.0); const x = L[0] + Math.cos(a) * d, y = L[1] + Math.sin(a) * d; if (!t.inside(x, y, 0.97)) continue; lv.push(ell(x, y, R(2.5, 4.5) * t.fs, R(1.2, 1.8) * t.fs, a + Math.PI / 2 + R(-0.5, 0.5), 10)); }
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
      const sp = []; for (let i = 0; i < 14; i++) { const x = R(-40, 1120), tt = R(0.15, 0.85), y = lerp(yTop(x), yBot(x), tt); for (let k = 0; k < 3; k++) { const q = []; const L = R(3, 9), hh = R(0.8, 2); for (let j = 0; j < 6; j++) { const a = (j / 6) * TAU; q.push([x + k * R(6, 12) + Math.cos(a) * L * R(0.6, 1.2), y + R(-2, 2) + Math.sin(a) * hh * R(0.6, 1.3)]); } sp.push(q); } }
      wash([region], { c: { lin: [0, yTop(540), 0, yBot(540)], stops: [[0, cols[0]], [1, cols[1]]] }, a: 0.5, e: 0.2, ew: 2, flow: 0.35, gran: 0.15, depth, wob: 1, holes: sp, dry: 1 });
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
      strokesIn(region, strokes, Object.assign({ e: 0.15, ew: 2, flow: 0.35, gran: 0.1, depth, soft: 1.6 }, extra || {}));
    }
    function wallFace(fTop, h, depth, density) {
      task(() => {
        const face = band(fTop, (x) => fTop(x) + h);
        wash([face], { c: { lin: [0, fTop(540), 0, fTop(540) + h], stops: [[0, '#ecd8b0'], [1, '#dcc49c']] }, a: 0.38, e: 0.35, depth, gran: 0.4, wob: 0.8, flow: 0.35 });
        const j = [];
        const rows = Math.max(1, Math.round(h / 11));
        for (let r = 1; r <= rows; r++) {
          for (let x = -40 + R(0, 30); x < 1120; x += R(14, 70) * density) {
            const y = fTop(x) + 2 + (r * (h - 3)) / rows + R(-1.5, 1.5), L = R(5, 18), th = R(1.2, 3) * Math.min(1, h / 20);
            if (r === rows && rnd() < 0.5) continue;
            j.push([[x, y - th * 0.4], [x + L * 0.5, y - th], [x + L, y - th * 0.2], [x + L * 0.7, y + th * 0.3], [x + L * 0.2, y + th * 0.2]]);
            if (rnd() < 0.35) { const yy = y - R(3, h / rows); j.push([[x + L - 1, yy], [x + L + 0.8, yy + 0.5], [x + L + 0.6, y - th], [x + L - 1.2, y - th]]); }
          }
        }
        wash(j, { c: '#584c6c', a: 0.62, e: 0.2, wob: 0.4, rough: 0.2, depth: depth + 0.01, flow: 0.4 });
        wash([band((x) => fTop(x) + 0.4, (x) => fTop(x) + 2.5 + h * 0.08)], { c: '#6e6488', a: 0.5, e: 0.2, depth: depth + 0.02, wob: 0.6, flow: 0.3 });
      });
    }

    // flowering broom: a dark green mound shot with yellow
    function broom(x, y, w, h, depth) {
      task(() => {
        const mass = [];
        for (let i = 0; i < 7; i++) mass.push(ell(x + R(-0.4, 0.4) * w, y - h * 0.45 + R(-0.3, 0.3) * h, w * R(0.22, 0.34), h * R(0.25, 0.38), 0, 20));
        const fl = [];
        for (let i = 0; i < 46; i++) { const a = R(-Math.PI, 0.1), d = Math.sqrt(rnd()); fl.push(ell(x + Math.cos(a) * w * 0.55 * d, y - h * 0.45 + Math.sin(a) * h * 0.6 * d, R(1.4, 2.6), R(1, 1.8), R(0, 3), 8)); }
        wash([ell(x + w * 0.45, y + 2, w * 0.6, 4, 0, 20)], { c: '#4f5098', a: 0.5, e: 0.35, depth: depth - 0.05, flow: 0.2 });
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
        wash(lv, { c: '#5f8a4a', a: 0.82, e: 0.4, wob: 0.3, depth, flow: 0.15, holes: fl });
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
    task(() => ground((x) => W3(x) + H3, W4, ['#e2c48a', '#d6b47c', '#c4c46c', '#ecd04c', '#a8b858', '#d09a66'], 10));
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
    task(() => ground((x) => W4(x) + H4, W5, ['#e6c88c', '#dab47a', '#c8c86c', '#f2d44c', '#a8bc5a', '#d49c64'], 12));
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
      for (let r = 0; r < 4; r++) { let x = -100 - R(0, 80); while (x < 1140) { const len = R(300, 600), t = (r + 0.5) / 4, yy = (xx) => lerp(W5(xx) + H5, FR(xx), t) + R(-4, 4); st.push({ p: limb([[x, yy(x), 20], [x + len / 2, yy(x + len / 2), 30], [x + len, yy(x + len), 18]]), o: { c: ['#e6c68c', '#ecd2a0', '#dcb67a'][(rnd() * 3) | 0], a: R(0.32, 0.46) } }); x += len - R(30, 80); } }
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
      wash(sh, { c: '#44408e', a: 0.66, e: 0.45, depth: 14.2, wob: 1.2, flow: 0.2 });
    });
    /* ---- the figures */
    function paintMan(P, o) {
      task(() => {
        const fx = { wob: 0.5, rough: 0.2, flow: 0.25 };
        if (P.gun) {
          wash([P.gun], Object.assign({}, fx, { c: '#2e2c34', a: 0.88, e: 0.3, ew: 0.8, wob: 0.15, rough: 0.05, holes: o.gunHoles }));
          wash([P.stock], Object.assign({}, fx, { c: '#4e3220', a: 0.9, e: 0.35, ew: 0.8, wob: 0.15, rough: 0.05, holes: o.gunHoles }));
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
      shirtSh: [C.sleeveB, C.shirtSh], dark: [C.vest, C.cap, C.strap], dc: '#2c2630', trSh: [C.legSh, C.legSh2, C.pocket],
      faceSh: [C.brim.map((q) => [q[0], q[1] + 3.5]), C.faceSh],
      accents: [C.stache, C.grin],
    });
    paintMan(Fz, {
      gunHoles: [Fz.jacL, Fz.sleeveB, Fz.head, Fz.neck, Fz.cap, Fz.shirt], skin: [Fz.handB, Fz.handF, Fz.thumb, Fz.ear], trousers: [Fz.legB, Fz.legF, Fz.hips], tc: '#5e6274', shoes: [Fz.shoeB, Fz.shoeF],
      shirtSh: [Fz.shirtSh], dark: [Fz.jacL, Fz.jacR, Fz.sleeveB, Fz.sleeveF, Fz.cap], dc: '#3e2e28', trSh: [Fz.legSh, Fz.legSh2],
      faceSh: [Fz.brim.map((q) => [q[0], q[1] + 3.5]), Fz.faceSh],
      accents: [Fz.grin],
    });
    paintMan(Mi, {
      skin: [Mi.armB, Mi.handB, Mi.handF], trousers: [Mi.legB, Mi.legF, Mi.hips], tc: '#55505e', shoes: [Mi.shoeB, Mi.shoeF],
      shirtSh: [Mi.shirtSh, Mi.spine, Mi.fold, Mi.armShadow, Mi.sleeveSh], trSh: [Mi.legBsh, Mi.legFsh, Mi.knee],
      hair: [Mi.hair], hc: '#3e2c22', hairHoles: [Mi.ear], faceSh: [Mi.face], accents: [Mi.belt],
      after: () => { wash([Mi.hairSh], { c: '#120c0c', a: 0.5, e: 0.2, wob: 0.2, flow: 0 }); wash([tr(362, 1066, 1)(ell(15, -270, 1.2, 2.6, -0.25, 10).map((q) => [4 + (q[0] - 4) * Math.cos(-0.2) - (q[1] + 256) * Math.sin(-0.2), -256 + (q[0] - 4) * Math.sin(-0.2) + (q[1] + 256) * Math.cos(-0.2)]))], { c: '#8a4a3a', a: 0.6, e: 0, wob: 0, flow: 0 }); },
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
      strokesIn(null, st, { e: 0.2, ew: 2, flow: 0.4, gran: 0.2, depth: 16.2, dry: 3 });
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
    task(() => wash(PADS.map((p) => p.poly.map((q) => [q[0] + 18, q[1] + 10])), { c: '#575290', a: 0.4, e: 0.35, depth: 16.5, wob: 1.2, flow: 0.3 }));
    for (const p of PADS) {
      task(() => {
        const bb = bboxOf([p.poly]);
        const litSide = Math.cos(p.ang) > 0 ? -1 : 1;
        wash([p.poly], { c: { lin: [bb[0], bb[1], bb[2], bb[3]], stops: [[0, p.edge ? '#7fa45a' : '#a6c46a'], [0.5, '#5c8c50'], [1, '#2a5844']] }, a: 0.9, e: 0.5, ew: 1.6, wob: 0.8, depth: p.depth, gran: 0.25, flow: 0.3, grad: 0.3, gradAngle: -2.3 });
        // shadow half: the side of the pad turned from the sun
        wash(null, { bbox: [bb[0] - 3, bb[1] - 3, bb[2] + 3, bb[3] + 3], depth: p.depth, mask: (g) => { fillPolys(g, [wob(p.poly, 0.8, 0.05, 0.3)]); g.globalCompositeOperation = 'destination-out'; fillPolys(g, [p.poly.map((q) => [q[0] - p.Wd * 0.55 - 2, q[1] - p.Wd * 0.35 - 2])]); g.globalCompositeOperation = 'source-over'; }, c: '#1c4236', a: 0.7, e: 0.45, flow: 0.25 });
        // areoles: little cushions of spines in a loose diagonal lattice
        const ar = [];
        if (!p.edge) for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
          const u = (i - 1.5) / 2.2 + ((j % 2) * 0.22), v = (j + 0.5) / 4.4 + 0.06;
          if (Math.abs(u) > 0.82 - 0.25 * (1 - v)) continue;
          const lx = u * p.Wd, ly = v * p.L, ax = p.x + lx * Math.cos(p.ang) + ly * Math.sin(p.ang), ay = p.y + lx * Math.sin(p.ang) - ly * Math.cos(p.ang);
          ar.push(ell(ax, ay, 0.9, 0.9, 0, 6), limb([[ax, ay, 0.35], [ax + R(-2.5, 2.5), ay - R(2, 3.5), 0.1]]));
        }
        wash(ar, { c: '#2e3424', a: 0.62, e: 0, wob: 0, flow: 0 });
        void litSide;
      });
    }
    task(() => {
      const fl = [], buds = [];
      for (const p of PADS) {
        if (p.lvl < 2 || p.edge) continue;
        const n = (rnd() * 3) | 0;
        for (let i = 0; i < n; i++) {
          const off = R(-0.55, 0.55), x = p.x + Math.sin(p.ang + off) * p.L * 0.97, y = p.y - Math.cos(p.ang + off) * p.L * 0.97;
          if (rnd() < 0.55) fl.push(spline([[x - 5, y - 2], [x - 3.5, y - 9], [x, y - 6], [x + 3.5, y - 9.5], [x + 5.5, y - 2], [x + 2, y + 1.5], [x - 2, y + 1.5]], true, 3));
          else buds.push(ell(x, y - 4, 3, 5, p.ang + off, 12));
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

    /* ---- the overhanging branch, last of all: the nearest and darkest things in the picture */
    task(() => {
      const B = BR;
      wash(B.twigs.map((t) => limb(t, 6)), { c: { lin: [1100, 0, 860, 160], stops: [[0, '#3a2a26'], [1, '#5a4636']] }, a: 0.86, e: 0.4, wob: 0.5, rough: 0.2, flow: 0.25, depth: 29 });
      const holesB = B.bl.concat(B.fruit.map((f) => ell(f.x, f.y, f.r, f.r, 0, 24)));
      const C3 = ['#5f8c32', '#24502a', '#0e2419'];
      for (let v = 0; v < 3; v++) wash(B.leaves.filter((L) => L.v === v).map((L) => L.poly), { c: C3[v], a: v === 0 ? 0.9 : 0.94, e: 0.45, ew: 1.4, wob: 0.6, rough: 0.2, flow: 0.08, holes: holesB, grad: 0.15 });
      // midribs on the light leaves
      wash(B.leaves.filter((L) => L.v === 0 && rnd() < 0.7).map((L) => limb([[L.x - Math.cos(L.ang) * 12, L.y - Math.sin(L.ang) * 12, 0.9], [L.x + Math.cos(L.ang) * 10, L.y + Math.sin(L.ang) * 10, 0.4]])), { c: '#3c5a2a', a: 0.6, e: 0, wob: 0, flow: 0 });
      // shadow under the light leaves where they overlap the dark
      for (const f of B.fruit) {
        wash([ell(f.x, f.y, f.r, f.r, 0, 30)], { c: { rad: [f.x - f.r * 0.4, f.y - f.r * 0.45, f.r * 0.1, f.x, f.y, f.r * 1.05], stops: [[0, '#fcc35a'], [0.5, '#f39222'], [1, '#d4661a']] }, a: 0.96, e: 0.45, ew: 1.4, wob: 0.6, flow: 0.15, holes: [ell(f.x - f.r * 0.38, f.y - f.r * 0.42, f.r * 0.2, f.r * 0.15, -0.6, 10)] });
        wash(null, { bbox: [f.x - f.r - 3, f.y - f.r - 3, f.x + f.r + 3, f.y + f.r + 3], mask: (g) => { fillPolys(g, [ell(f.x, f.y, f.r, f.r, 0, 30)]); g.globalCompositeOperation = 'destination-out'; fillPolys(g, [ell(f.x - f.r * 0.3, f.y - f.r * 0.36, f.r * 0.92, f.r * 0.92, 0, 30)]); g.globalCompositeOperation = 'source-over'; }, c: '#93361a', a: 0.6, e: 0.3, flow: 0.1 });
        wash([limb([[f.x + f.r * 0.15, f.y - f.r * 0.95, 1.8], [f.x + f.r * 0.3, f.y - f.r * 1.5, 1.4]]), ell(f.x + f.r * 0.12, f.y - f.r * 0.92, 2.2, 1.4, 0, 8)], { c: '#4a5a24', a: 0.85, e: 0, wob: 0.1, flow: 0 });
      }
      wash(B.blos.map(([x, y]) => ell(x, y, 1.3, 1.3, 0, 8)), { c: '#e8c23a', a: 0.9, e: 0, wob: 0, flow: 0 });
      wash(B.blos.map(([x, y, r]) => ell(x + r * 0.3, y + r * 0.35, r * 0.55, r * 0.3, 0.5, 10)), { c: '#a8b0a0', a: 0.35, e: 0, wob: 0, flow: 0 });
    });
    pen(() => { for (const L of BR.leaves) if (rnd() < 0.5) outline(L.poly, { a: 0.24, gap: 0.3, wob: 0.4 }); for (const f of BR.fruit) outline(ell(f.x, f.y, f.r, f.r, 0, 30), { a: 0.28 }); });

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
