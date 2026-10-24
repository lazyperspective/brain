/* The Family — 01. "A Favour on the Wedding Day".
 *
 * Charcoal and white chalk on grey-cream laid paper, in a tenebrist manner. August 1945, the Corleone mall on
 * Long Island. In the shuttered corner study Don Vito Corleone hears the undertaker Bonasera while, through the
 * window, his daughter's wedding blazes in overexposed white. The only light in the room is the sun coming through
 * slatted blinds from a window off the left of the picture: it falls in hard diagonal bars on the back wall, across
 * half of the Don's face and his calm hands, on the desk and on the floor, where one orange has rolled out of the
 * bowl towards the edge of the sheet. That orange is the only colour; it is the thread of the carousel
 * (js/shared/orange.js, drawn last, untouched).
 *
 * Method: everything is drawn into two density layers, charcoal (C) and chalk (K), at the full output resolution.
 * Light is "lifted" out of the charcoal like an eraser through a stripe mask (scratch layer X). A final pass prints
 * both layers onto a laid-paper tooth so that mid-tones break on the grain and the blacks stay velvet.
 */
(function () {
  'use strict';

  const W = 1080, H = 1350;
  const HZ = 535, VPX = 560;                      // eye level and vanishing point of the room
  const FLOOR = 880;                              // back wall meets the floor
  const OPEN = { x0: 60, x1: 440, y0: 166, y1: 690 }; // window opening in the back wall
  const GL = { x0: 95, x1: 440, y0: 192, y1: 679 };   // the glass (far face of the reveal)
  const DESK = { fx0: 238, fx1: 985, bx0: 262, bx1: 958, ty0: 712, ty1: 742, my: 766, by: 1055 };
  const BAR = { ang: 35, per: 26, duty: 0.5 };    // the slatted light on upright planes: angle, period, lit fraction
  const TAU = Math.PI * 2, D2R = Math.PI / 180;
  // the Don and his chair are drawn a little larger than the room's strict perspective (he is the subject)
  const DONM = new DOMMatrix().translate(645, 712).scale(1.25).translate(-625, -712);

  /* ------------------------------------------------------------------ small utilities */
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const TEST = document.createElement('canvas').getContext('2d');
  const inside = (p, x, y) => TEST.isPointInPath(p, x, y);

  // smooth closed/open curve through points (Catmull-Rom as cubic Béziers). A point [x, y, 1] is a hard corner.
  function cr(pts, closed = true, t = 1 / 6) {
    const p = new Path2D(), n = pts.length;
    const P = (i) => (closed ? pts[(i + n) % n] : pts[clamp(i, 0, n - 1)]);
    p.moveTo(pts[0][0], pts[0][1]);
    const m = closed ? n : n - 1;
    for (let i = 0; i < m; i++) {
      const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
      const s1 = p1[2] ? 0 : t, s2 = p2[2] ? 0 : t;
      p.bezierCurveTo(p1[0] + (p2[0] - p0[0]) * s1, p1[1] + (p2[1] - p0[1]) * s1,
        p2[0] - (p3[0] - p1[0]) * s2, p2[1] - (p3[1] - p1[1]) * s2, p2[0], p2[1]);
    }
    if (closed) p.closePath();
    return p;
  }
  function poly(pts, closed = true) {
    const p = new Path2D();
    pts.forEach((q, i) => (i ? p.lineTo(q[0], q[1]) : p.moveTo(q[0], q[1])));
    if (closed) p.closePath();
    return p;
  }
  function ell(cx, cy, rx, ry, rot = 0) { const p = new Path2D(); p.ellipse(cx, cy, Math.abs(rx), Math.abs(ry), rot, 0, TAU); return p; }
  function rect(x, y, w, h) { const p = new Path2D(); p.rect(x, y, w, h); return p; }
  function join(...ps) { const p = new Path2D(); ps.forEach((q) => q && p.addPath(q)); return p; }
  function moved(p, dx, dy) { const q = new Path2D(); q.addPath(p, new DOMMatrix().translate(dx, dy)); return q; }
  function seg(x0, y0, x1, y1) { const p = new Path2D(); p.moveTo(x0, y0); p.lineTo(x1, y1); return p; }
  function vpx(x, y, y2) { return VPX + (x - VPX) * (y2 - HZ) / (y - HZ); } // slide x along a depth line to height y2
  // a limb: a smooth tapered ribbon along a polyline, widths w0 → w1
  function taper(pts, w0, w1) {
    const L = [], R = [], n = pts.length;
    for (let i = 0; i < n; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
      let dx = b[0] - a[0], dy = b[1] - a[1]; const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
      const w = lerp(w0, w1, i / (n - 1)) / 2;
      L.push([pts[i][0] - dy * w, pts[i][1] + dx * w]); R.push([pts[i][0] + dy * w, pts[i][1] - dx * w]);
    }
    const e = pts[n - 1], s = pts[0];
    return cr([...L, [e[0] + (e[0] - pts[n - 2][0]) * 0.15, e[1] + (e[1] - pts[n - 2][1]) * 0.15], ...R.reverse(), [s[0] - (pts[1][0] - s[0]) * 0.12, s[1] - (pts[1][1] - s[1]) * 0.12]]);
  }

  /* ------------------------------------------------------------------ the sheet: density layers */
  function makeSheet(S, seed) {
    const w = Math.round(W * S), h = Math.round(H * S);
    const mk = () => {
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      const g = c.getContext('2d', { willReadFrequently: true });
      g.setTransform(S, 0, 0, S, 0, 0); g.lineCap = 'round'; g.lineJoin = 'round';
      return g;
    };
    return { S, w, h, C: mk(), K: mk(), X: mk(), M: mk(), r: mulberry32(seed), seed, G: null };
  }
  // draw a group (the Don and his chair) under an extra transform
  function setGroup(D, m) {
    D.G = m;
    const base = new DOMMatrix([D.S, 0, 0, D.S, 0, 0]);
    const t = m ? base.multiply(m) : base;
    for (const c of [D.C, D.K, D.X, D.M]) c.setTransform(t);
  }
  const blk = (a) => `rgba(0,0,0,${a})`;
  const wht = (a) => `rgba(255,255,255,${a})`;
  function fillOn(ctx, p, style, blur, S, mode) {
    ctx.save();
    if (mode) ctx.globalCompositeOperation = mode;
    if (blur) ctx.filter = `blur(${(blur * S).toFixed(2)}px)`;
    ctx.fillStyle = style; ctx.fill(p);
    ctx.restore();
  }
  // charcoal tone (it also buries any chalk beneath it), eraser lift, white chalk
  function tone(D, p, a, blur) {
    const st = typeof a === 'number' ? blk(a) : a;
    fillOn(D.C, p, st, blur, D.S);
    fillOn(D.K, p, st, blur, D.S, 'destination-out');
  }
  const lift = (D, p, a, blur) => fillOn(D.C, p, typeof a === 'number' ? blk(a) : a, blur, D.S, 'destination-out');
  const chalk = (D, p, a, blur) => fillOn(D.K, p, typeof a === 'number' ? wht(a) : a, blur, D.S);
  function line(D, p, w, a, ctx, blur) {
    const onK = ctx === D.K;
    for (const c of onK ? [D.K] : [D.C, D.K]) {
      c.save(); if (blur) c.filter = `blur(${(blur * D.S).toFixed(2)}px)`;
      if (!onK && c === D.K) c.globalCompositeOperation = 'destination-out';
      c.lineWidth = w; c.strokeStyle = onK ? wht(a) : blk(a); c.stroke(p); c.restore();
    }
  }
  function eraseLine(D, p, w, a, blur) {
    const c = D.C; c.save(); c.globalCompositeOperation = 'destination-out';
    if (blur) c.filter = `blur(${(blur * D.S).toFixed(2)}px)`;
    c.lineWidth = w; c.strokeStyle = blk(a); c.stroke(p); c.restore();
  }
  function grad(ctx, x0, y0, x1, y1, stops, rgb) {
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    stops.forEach(([t, a]) => g.addColorStop(t, `rgba(${rgb || '0,0,0'},${a})`));
    return g;
  }
  function rgrad(ctx, x, y, r0, r1, stops, rgb) {
    const g = ctx.createRadialGradient(x, y, r0, x, y, r1);
    stops.forEach(([t, a]) => g.addColorStop(t, `rgba(${rgb || '0,0,0'},${a})`));
    return g;
  }
  const W3 = '255,255,255';

  // Parallel hatching inside a region. Lines are traced by sampling the region so that every stroke
  // starts and stops by hand near the contour (not clipped by a ruler). Strokes are batched by alpha/width.
  // o: { ang, sp, w, a, step, jit, spj, bow, af(x,y), mode: 'c' charcoal | 'k' chalk | 'l' lift, clip, maxLen }
  function hatch(D, region, bb, o) {
    const r = D.r;
    const ang = o.ang * D2R, dx = Math.cos(ang), dy = Math.sin(ang), nx = -dy, ny = dx;
    const sp = o.sp, step = o.step || Math.max(1.2, Math.min(4, sp * 0.9));
    const w = o.w || 0.8, a = o.a === undefined ? 0.3 : o.a, jit = o.jit === undefined ? 0.6 : o.jit;
    let n0 = Infinity, n1 = -Infinity, t0 = Infinity, t1 = -Infinity;
    for (const [x, y] of [[bb[0], bb[1]], [bb[2], bb[1]], [bb[0], bb[3]], [bb[2], bb[3]]]) {
      const pn = x * nx + y * ny, pt = x * dx + y * dy;
      n0 = Math.min(n0, pn); n1 = Math.max(n1, pn); t0 = Math.min(t0, pt); t1 = Math.max(t1, pt);
    }
    const buckets = new Map();
    const add2 = (k, s, e) => {
      const mx = k * nx + ((s + e) / 2) * dx, my = k * ny + ((s + e) / 2) * dy;
      const al = a * (0.82 + r() * 0.36) * (o.af ? o.af(mx, my) : 1);
      if (al <= 0.006) return;
      const ab = Math.min(60, Math.max(1, Math.round(al * 60)));
      const wb = Math.max(1, Math.round(w * (0.85 + r() * 0.3) * 10));
      const key = ab * 1000 + wb;
      let pth = buckets.get(key); if (!pth) buckets.set(key, (pth = new Path2D()));
      const bow = (o.bow || 0) * (e - s) * (r() - 0.35);
      pth.moveTo(k * nx + s * dx, k * ny + s * dy);
      if (bow) pth.quadraticCurveTo(mx + nx * bow, my + ny * bow, k * nx + e * dx, k * ny + e * dy);
      else pth.lineTo(k * nx + e * dx, k * ny + e * dy);
    };
    const add = (k, s, e) => {
      s += (r() - 0.5) * jit * step * 2; e += (r() - 0.5) * jit * step * 2;
      if (e - s < (o.min || 1.5)) return;
      if (o.maxLen && e - s > o.maxLen) {
        let p = s;
        while (p < e) { const q = Math.min(e, p + o.maxLen * (0.6 + r() * 0.5)); if (q - p > 2) add2(k, p, q); p = q + 1.2 + r() * 2; }
        return;
      }
      add2(k, s, e);
    };
    let k = n0 + r() * sp;
    while (k < n1) {
      let ins = false, st = 0;
      for (let t = t0; t <= t1 + step; t += step) {
        const now = t <= t1 && inside(region, k * nx + t * dx, k * ny + t * dy);
        if (now && !ins) { ins = true; st = t; } else if (!now && ins) { ins = false; add(k, st, t - step); }
      }
      k += sp * (1 + (r() - 0.5) * (o.spj === undefined ? 0.25 : o.spj));
    }
    const mode = o.mode || 'c';
    const targets = mode === 'k' ? [[D.K, 'source-over', W3]] : mode === 'l' ? [[D.C, 'destination-out', '0,0,0']] : [[D.C, 'source-over', '0,0,0'], [D.K, 'destination-out', '0,0,0']];
    for (const [ctx, gco, rgb] of targets) {
      ctx.save();
      ctx.globalCompositeOperation = gco;
      if (o.clip) ctx.clip(o.clip);
      if (o.blur) ctx.filter = `blur(${(o.blur * D.S).toFixed(2)}px)`;
      for (const [key, pth] of buckets) {
        ctx.lineWidth = (key % 1000) / 10; ctx.strokeStyle = `rgba(${rgb},${Math.floor(key / 1000) / 60})`;
        ctx.stroke(pth);
      }
      ctx.restore();
    }
  }

  // diagonal stripes (the slatted light) covering a box
  function stripes(bb, ang, per, duty, phase) {
    const a = ang * D2R, dx = Math.cos(a), dy = Math.sin(a), nx = -dy, ny = dx;
    let n0 = Infinity, n1 = -Infinity, t0 = Infinity, t1 = -Infinity;
    for (const [x, y] of [[bb[0], bb[1]], [bb[2], bb[1]], [bb[0], bb[3]], [bb[2], bb[3]]]) {
      const pn = x * nx + y * ny, pt = x * dx + y * dy;
      n0 = Math.min(n0, pn); n1 = Math.max(n1, pn); t0 = Math.min(t0, pt); t1 = Math.max(t1, pt);
    }
    const p = new Path2D();
    for (let k = Math.floor((n0 - phase) / per) * per + phase; k < n1; k += per) {
      const k2 = k + per * duty;
      p.moveTo(k * nx + t0 * dx, k * ny + t0 * dy); p.lineTo(k * nx + t1 * dx, k * ny + t1 * dy);
      p.lineTo(k2 * nx + t1 * dx, k2 * ny + t1 * dy); p.lineTo(k2 * nx + t0 * dx, k2 * ny + t0 * dy); p.closePath();
    }
    return p;
  }
  const bars = (bb, phase, per, duty) => stripes(bb, BAR.ang, per || BAR.per, duty || BAR.duty, phase || 0);
  // stripes on a horizontal surface: wedges that run into the depth (towards the vanishing point)
  function flatBars(y0, y1, u0, u1, du, duty, phase) {
    const p = new Path2D();
    for (let u = Math.floor((u0 - phase) / du) * du + phase; u < u1; u += du) {
      const ua = u, ub = u + du * duty;
      p.moveTo(VPX + ua * (y0 - HZ), y0); p.lineTo(VPX + ub * (y0 - HZ), y0);
      p.lineTo(VPX + ub * (y1 - HZ), y1); p.lineTo(VPX + ua * (y1 - HZ), y1); p.closePath();
    }
    return p;
  }

  // Light through the blinds: lift charcoal and lay chalk inside mask ∩ bars, shaped by an intensity gradient.
  function light(D, o) {
    const { S, X } = D, bb = o.bb;
    let qx0 = bb[0], qy0 = bb[1], qx1 = bb[2], qy1 = bb[3];
    if (D.G) {
      const ps = [[bb[0], bb[1]], [bb[2], bb[1]], [bb[0], bb[3]], [bb[2], bb[3]]].map(([x, y]) => D.G.transformPoint(new DOMPoint(x, y)));
      qx0 = Math.min(...ps.map((p) => p.x)); qx1 = Math.max(...ps.map((p) => p.x)); qy0 = Math.min(...ps.map((p) => p.y)); qy1 = Math.max(...ps.map((p) => p.y));
    }
    const sx = clamp(Math.floor(qx0 * S) - 3, 0, D.w), sy = clamp(Math.floor(qy0 * S) - 3, 0, D.h);
    const sw = clamp(Math.ceil(qx1 * S) + 3, 0, D.w) - sx, sh = clamp(Math.ceil(qy1 * S) + 3, 0, D.h) - sy;
    if (sw <= 0 || sh <= 0) return;
    X.save(); X.setTransform(1, 0, 0, 1, 0, 0); X.clearRect(sx, sy, sw, sh); X.restore();
    X.save();
    X.clip(o.mask, o.rule || 'nonzero');
    if (o.foot) X.clip(o.foot);
    if (o.shadow) X.clip(o.shadow, 'evenodd');
    if (o.soft) X.filter = `blur(${(o.soft * S).toFixed(2)}px)`;
    X.fillStyle = '#fff';
    X.fill(o.bars || rect(bb[0] - 20, bb[1] - 20, bb[2] - bb[0] + 40, bb[3] - bb[1] + 40));
    X.restore();
    for (const f of [o.int, o.int2]) {
      if (!f) continue;
      X.save(); X.globalCompositeOperation = 'destination-in'; X.fillStyle = f(X);
      X.fillRect(bb[0] - 4, bb[1] - 4, bb[2] - bb[0] + 8, bb[3] - bb[1] + 8); X.restore();
    }
    if (o.map) { // an arbitrary intensity map, painted with soft white shapes: lets the light model a form
      const M = D.M;
      M.save(); M.setTransform(1, 0, 0, 1, 0, 0); M.clearRect(sx, sy, sw, sh); M.restore();
      M.save(); M.clip(rect(bb[0] - 4, bb[1] - 4, bb[2] - bb[0] + 8, bb[3] - bb[1] + 8)); o.map(M); M.restore();
      X.save(); X.setTransform(1, 0, 0, 1, 0, 0); X.globalCompositeOperation = 'destination-in';
      X.drawImage(M.canvas, sx, sy, sw, sh, sx, sy, sw, sh); X.restore();
    }
    if (o.streak !== false) { // the eraser leaves streaks: lifted light is never perfectly flat
      X.save(); X.setTransform(1, 0, 0, 1, 0, 0); X.globalCompositeOperation = 'destination-in';
      X.fillStyle = streakPattern(D); X.fillRect(sx, sy, sw, sh); X.restore();
    }
    const blit = (ctx, mode, a) => {
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = mode; ctx.globalAlpha = a;
      ctx.drawImage(X.canvas, sx, sy, sw, sh, sx, sy, sw, sh); ctx.restore();
    };
    if (o.lift) blit(D.C, 'destination-out', o.lift);
    if (o.chalk) blit(D.K, 'source-over', o.chalk);
  }
  function streakPattern(D) {
    if (D.streak) return D.streak;
    const N = 256, c = document.createElement('canvas'); c.width = c.height = N;
    const g = c.getContext('2d'), r = mulberry32(D.seed ^ 0x5eed);
    g.fillStyle = 'rgba(255,255,255,0.9)'; g.fillRect(0, 0, N, N);
    const a = BAR.ang * D2R, dx = Math.cos(a), dy = Math.sin(a);
    g.lineCap = 'round';
    for (let i = 0; i < 260; i++) {
      const x = r() * N, y = r() * N, L = (14 + r() * 40) * D.S, w = (0.8 + r() * 2.2) * D.S;
      const al = r() < 0.5 ? 1 : 0.72 + r() * 0.16;
      g.strokeStyle = `rgba(255,255,255,${al})`; g.lineWidth = w;
      g.globalCompositeOperation = al === 1 ? 'source-over' : 'destination-out';
      if (al !== 1) g.strokeStyle = `rgba(0,0,0,${1 - al})`;
      for (const ox of [-N, 0, N]) for (const oy of [-N, 0, N]) { g.beginPath(); g.moveTo(x + ox, y + oy); g.lineTo(x + ox + dx * L, y + oy + dy * L); g.stroke(); }
    }
    D.streak = D.X.createPattern(c, 'repeat');
    return D.streak;
  }
  // a shadow-casting hole: a big box minus a silhouette (use with evenodd clip)
  function holeOf(sil, dx, dy) { const p = rect(-200, -200, W + 400, H + 400); p.addPath(sil, new DOMMatrix().translate(dx, dy)); return p; }

  /* ------------------------------------------------------------------ relief: a form modelled by the light itself */
  // A small heightfield (a sum of soft bumps) is lit per pixel from the slatted window: Lambert shading, the cast
  // shadow of every bump (the nose on the cheek, the brow in the eye), and the bars. The result replaces the charcoal
  // inside the mask: it is how the face and the hands get their weight.
  function bump(x, y, b) {
    let dx = x - b[0], dy = y - b[1];
    if (b[5]) { const c = Math.cos(b[5]), s = Math.sin(b[5]); const tx = dx * c + dy * s; dy = -dx * s + dy * c; dx = tx; }
    const q = (dx * dx) / (b[2] * b[2]) + (dy * dy) / (b[3] * b[3]);
    return q > 9 ? 0 : b[4] * Math.exp(-q);
  }
  function relief(D, o) {
    const S = D.S, G = D.G || new DOMMatrix();
    const g = G.a; // uniform scale (translate + scale only)
    const toDev = (x, y) => [(G.a * x + G.e) * S, (G.d * y + G.f) * S];
    const [ax, ay] = toDev(o.bb[0], o.bb[1]), [bx, by] = toDev(o.bb[2], o.bb[3]);
    const sx = Math.max(0, Math.floor(ax)), sy = Math.max(0, Math.floor(ay));
    const sw = Math.min(D.w, Math.ceil(bx)) - sx, sh = Math.min(D.h, Math.ceil(by)) - sy;
    if (sw <= 2 || sh <= 2) return;
    const mk = () => { const c = document.createElement('canvas'); c.width = sw; c.height = sh; return c.getContext('2d', { willReadFrequently: true }); };
    const raster = (p) => {
      const m = mk(); m.setTransform(S * G.a, 0, 0, S * G.d, S * G.e - sx, S * G.f - sy); m.fillStyle = '#fff'; m.fill(p);
      return m.getImageData(0, 0, sw, sh).data;
    };
    const ma = raster(o.mask), ta = o.texMask ? raster(o.texMask) : null;
    const lu = 1 / (S * g); // local units per device pixel
    const Z = new Float32Array(sw * sh);
    for (let j = 0; j < sh; j++) for (let i = 0; i < sw; i++) {
      const x = ((sx + i + 0.5) / S - G.e) / G.a, y = ((sy + j + 0.5) / S - G.f) / G.d;
      let z = o.base ? o.base(x, y) : 0;
      for (const b of o.bumps) z += bump(x, y, b);
      if (ta && ta[(j * sw + i) * 4 + 3] > 0) z += o.tex(x, y) * ta[(j * sw + i) * 4 + 3] / 255;
      Z[j * sw + i] = z;
    }
    const L = o.light || [-0.62, -0.5, 0.6], ll = Math.hypot(...L), Lx = L[0] / ll, Ly = L[1] / ll, Lz = L[2] / ll;
    const Lxy = Math.hypot(Lx, Ly), rx = Lx / Lxy, ry = Ly / Lxy, rise = Lz / Lxy;
    const A = [0.45, 0.35, 0.82];
    const bar = o.bars, ba = bar ? bar.ang * D2R : 0, bnx = -Math.sin(ba), bny = Math.cos(ba);
    const ic = mk(), ik = mk();
    const dc = ic.createImageData(sw, sh), dk = ik.createImageData(sw, sh);
    const shadowSteps = Math.ceil((o.shadowLen || 18) / lu);
    for (let j = 1; j < sh - 1; j++) for (let i = 1; i < sw - 1; i++) {
      const k = j * sw + i, m = ma[k * 4 + 3] / 255;
      if (m <= 0) continue;
      const zx = (Z[k + 1] - Z[k - 1]) / (2 * lu), zy = (Z[k + sw] - Z[k - sw]) / (2 * lu);
      const nl = Math.hypot(zx, zy, 1), nx = -zx / nl, ny = -zy / nl, nz = 1 / nl;
      let shade = Math.max(0, nx * Lx + ny * Ly + nz * Lz);
      // cast shadow: walk toward the light and see whether the form rises above the ray
      let lit = 1;
      if (shade > 0) {
        const z0 = Z[k];
        for (let t = 2; t <= shadowSteps; t += 2) {
          const qi = Math.round(i + rx * t), qj = Math.round(j + ry * t);
          if (qi < 0 || qj < 0 || qi >= sw || qj >= sh) break;
          const over = Z[qj * sw + qi] - (z0 + rise * t * lu);
          if (over > 0) { lit = Math.max(0, 1 - over * 1.2); if (lit === 0) break; }
        }
      }
      const x = ((sx + i + 0.5) / S - G.e) / G.a, y = ((sy + j + 0.5) / S - G.f) / G.d;
      let b = 1;
      if (bar) {
        const u = ((x * bnx + y * bny - bar.phase) % bar.per + bar.per) % bar.per, w = bar.per * bar.duty, e = 0.55;
        b = u < w ? Math.min(1, u / e, (w - u) / e) : 0;
        b = Math.max(0, Math.min(1, b));
      }
      const direct = shade * lit * b * (o.gain || 1) * (o.int ? o.int(x, y) : 1);
      const amb = Math.max(0, nx * A[0] + ny * A[1] + nz * A[2]);
      const v = (o.floor || 0.03) + 0.95 * direct + (o.amb === undefined ? 0.1 : o.amb) * amb * (0.6 + 0.4 * shade);
      const dens = Math.min(o.dark || 0.95, Math.max(0.03, 1 - v));
      dc.data[k * 4 + 3] = dens * 255 * m;
      const ch = Math.max(0, Math.min(0.85, (direct - (o.chalkFrom || 0.6)) * 2.2));
      dk.data[k * 4 + 0] = dk.data[k * 4 + 1] = dk.data[k * 4 + 2] = 255; dk.data[k * 4 + 3] = ch * 255 * m;
    }
    ic.putImageData(dc, 0, 0); ik.putImageData(dk, 0, 0);
    // replace what was there inside the mask
    for (const c of [D.C, D.K]) { c.save(); c.globalCompositeOperation = 'destination-out'; c.fillStyle = '#000'; c.fill(o.mask); c.restore(); }
    for (const [c, src] of [[D.C, ic], [D.K, ik]]) { c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.drawImage(src.canvas, sx, sy); c.restore(); }
  }

  /* ================================================================== THE ROOM */

  function groundTone(D) {
    const C = D.C;
    C.fillStyle = grad(C, 0, 0, 0, FLOOR, [[0, 0.95], [0.45, 0.9], [1, 0.87]]); C.fillRect(0, 0, W, FLOOR);
    C.fillStyle = grad(C, 0, FLOOR, 0, H, [[0, 0.9], [0.5, 0.88], [1, 0.94]]); C.fillRect(0, FLOOR, W, H - FLOOR);
    // the room is a little less dark around the bright window (bounce light), stumped
    lift(D, rect(0, 0, W, FLOOR), rgrad(C, 250, 470, 60, 430, [[0, 0.4], [0.5, 0.16], [1, 0]]));
    lift(D, rect(0, FLOOR, W, H - FLOOR), rgrad(C, 280, 900, 40, 460, [[0, 0.16], [1, 0]]));
    // the far corners sink into velvet
    tone(D, rect(0, 0, W, H), rgrad(C, 600, 640, 480, 960, [[0, 0], [1, 0.55]]));
  }

  function wallSurface(D) {
    const wall = rect(0, 0, W, FLOOR);
    // the draughtsman's ground: even, quiet diagonal hatching in two directions
    hatch(D, wall, [0, 0, W, FLOOR], { ang: 58, sp: 3.2, w: 0.7, a: 0.15, step: 6, jit: 0.4, maxLen: 130 });
    hatch(D, rect(458, 0, 622, 700), [458, 0, W, 700], { ang: -32, sp: 4.4, w: 0.6, a: 0.1, step: 6, jit: 0.4, maxLen: 110 });
    // crown moulding at the top
    tone(D, rect(0, 0, W, 22), 0.5);
    lift(D, rect(0, 22, W, 3), 0.18, 0.6);
    line(D, seg(0, 30, W, 30), 1.2, 0.5);
    // chair rail and wainscot
    const rail = 702;
    lift(D, rect(0, rail - 3, W, 4), 0.22, 0.5);
    tone(D, rect(0, rail + 1, W, 8), 0.45, 0.6);
    for (const [a, b] of [[8, 120], [140, 252], [272, 430], [470, 630], [650, 800]]) {
      line(D, rect(a, rail + 24, b - a, FLOOR - 50 - rail - 24), 2.2, 0.4);
      eraseLine(D, seg(a + 2, rail + 26, b - 2, rail + 26), 1.2, 0.2);
      eraseLine(D, seg(a + 2, rail + 26, a + 2, FLOOR - 52), 1.2, 0.15);
    }
    tone(D, rect(0, FLOOR - 34, W, 34), 0.5);
    lift(D, rect(0, FLOOR - 36, W, 3), 0.2, 0.5);
    line(D, seg(0, FLOOR, W, FLOOR), 1.6, 0.6);
    // wallpaper: a faint damask lozenge that shows only where the light falls
    const dam = new Path2D();
    for (let y = 40; y < rail - 20; y += 52) {
      for (let x = 470 + ((y / 52) % 2) * 26; x < 820; x += 52) {
        dam.addPath(cr([[x, y - 14], [x + 6, y - 5], [x + 11, y], [x + 6, y + 5], [x, y + 14], [x - 6, y + 5], [x - 11, y], [x - 6, y - 5]]));
        dam.addPath(ell(x, y, 2.2, 2.2)); dam.addPath(ell(x + 26, y, 1.2, 1.2));
      }
    }
    D.damask = dam;
  }

  /* ------------------------------------------------------------------ the window and the wedding */

  function windowFrame(D) {
    const C = D.C;
    const casing = rect(OPEN.x0 - 18, OPEN.y0 - 18, OPEN.x1 - OPEN.x0 + 36, OPEN.y1 - OPEN.y0 + 18);
    tone(D, casing, 0.35);
    line(D, rect(OPEN.x0 - 18, OPEN.y0 - 18, OPEN.x1 - OPEN.x0 + 36, OPEN.y1 - OPEN.y0 + 30), 1.4, 0.6);
    line(D, rect(OPEN.x0 - 9, OPEN.y0 - 9, OPEN.x1 - OPEN.x0 + 18, OPEN.y1 - OPEN.y0 + 18), 0.9, 0.4);
    // the casing catches daylight on its inner lip
    const lipL = rect(OPEN.x0 - 4, OPEN.y0 - 4, 4, OPEN.y1 - OPEN.y0 + 4);
    lift(D, lipL, 0.55, 0.4); lift(D, rect(OPEN.x0 - 4, OPEN.y0 - 4, OPEN.x1 - OPEN.x0 + 8, 4), 0.35, 0.4); chalk(D, lipL, 0.2, 0.5);
    lift(D, rect(OPEN.x1, OPEN.y0 - 4, 4, OPEN.y1 - OPEN.y0 + 4), 0.4, 0.4);
    // left reveal: the thickness of the wall, in daylight
    const revL = poly([[OPEN.x0, OPEN.y0], [GL.x0, GL.y0], [GL.x0, GL.y1], [OPEN.x0, OPEN.y1]]);
    lift(D, revL, 1);
    tone(D, revL, grad(C, OPEN.x0, 0, GL.x0, 0, [[0, 0.45], [1, 0.26]]));
    tone(D, revL, grad(C, 0, OPEN.y0, 0, OPEN.y1, [[0, 0.18], [0.5, 0], [1, 0.12]]));
    hatch(D, revL, [OPEN.x0, OPEN.y0, GL.x0, OPEN.y1], { ang: 90, sp: 2.6, w: 0.6, a: 0.16, jit: 0.3 });
    // top reveal (soffit), cooler and darker
    const revT = poly([[OPEN.x0, OPEN.y0], [OPEN.x1, OPEN.y0], [OPEN.x1, GL.y0], [GL.x0, GL.y0]]);
    lift(D, revT, 1);
    tone(D, revT, 0.55);
    hatch(D, revT, [OPEN.x0, OPEN.y0, OPEN.x1, GL.y0], { ang: 2, sp: 2.4, w: 0.6, a: 0.25, jit: 0.3 });
    line(D, seg(GL.x0, GL.y0, OPEN.x0, OPEN.y0), 1, 0.5);
  }

  function windowSill(D) {
    const top = poly([[GL.x0, GL.y1], [GL.x1, GL.y1], [OPEN.x1 + 10, OPEN.y1 + 2], [OPEN.x0 - 14, OPEN.y1 + 2]]);
    lift(D, top, 1);
    tone(D, top, 0.12);
    chalk(D, top, grad(D.K, 0, GL.y1, 0, OPEN.y1, [[0, 0.75], [1, 0.35]], W3));
    const nose = rect(OPEN.x0 - 16, OPEN.y1 + 2, OPEN.x1 - OPEN.x0 + 30, 11);
    tone(D, nose, 0.55);
    lift(D, rect(OPEN.x0 - 16, OPEN.y1 + 2, OPEN.x1 - OPEN.x0 + 30, 2.5), 0.4, 0.4);
    tone(D, rect(OPEN.x0 - 14, OPEN.y1 + 13, OPEN.x1 - OPEN.x0 + 28, 5), 0.6, 1.2);
    tone(D, poly([[GL.x0, GL.y1], [GL.x0 + 30, GL.y1], [OPEN.x0 + 26, OPEN.y1 + 2], [OPEN.x0 - 14, OPEN.y1 + 2]]), 0.16, 0.8);
  }

  // ----- small figures for the garden, drawn in the bleached key of a sunlit view (light from the left)
  function litFrom(D, p, x0, x1, a) { chalk(D, p, grad(D.K, x0, 0, x1, 0, [[0, a], [0.5, a * 0.45], [1, 0]], W3)); }
  function gHead(D, x, y, hr, o) {
    const d = o.dir || 1;
    const face = ell(x, y, hr * 0.84, hr);
    tone(D, face, o.skin === undefined ? 0.12 : o.skin);
    chalk(D, ell(x - hr * 0.25, y - hr * 0.1, hr * 0.5, hr * 0.72), 0.45);
    const hp = new Path2D();
    if (o.big) { // a woman's rolled 1940s hair
      hp.addPath(ell(x - d * hr * 0.12, y - hr * 0.35, hr * 0.95, hr * 0.72));
      hp.addPath(ell(x - d * hr * 0.6, y + hr * 0.25, hr * 0.5, hr * 0.62));
    } else {
      hp.ellipse(x - d * hr * 0.12, y - hr * 0.2, hr * 0.9, hr * 0.82, 0, Math.PI * 0.92, Math.PI * 2.08);
    }
    tone(D, hp, o.hairT === undefined ? 0.42 : o.hairT);
    if (o.hat) { tone(D, ell(x, y - hr * 0.75, hr * 1.7, hr * 0.3), 0.32); tone(D, ell(x, y - hr * 1.05, hr * 0.85, hr * 0.5), 0.3); chalk(D, ell(x - hr * 0.6, y - hr * 0.85, hr * 0.8, hr * 0.2), 0.5); }
    line(D, face, 0.3, 0.3);
  }
  function gMan(D, x, y, h, o = {}) {
    const u = h, d = o.dir || 1, suit = o.suit === undefined ? 0.45 : o.suit, lean = (o.lean || 0) * u;
    const st = (o.stride === undefined ? 0.05 : o.stride) * u;
    const sh = y - 0.8 * u, hip = y - 0.47 * u;
    if (!o.seated) {
      tone(D, ell(x + 0.17 * u, y, 0.2 * u, 0.022 * u), 0.12, 0.6);
      const lL = taper([[x - 0.045 * u + lean * 0.5, hip], [x - 0.04 * u - st * 0.5, y - 0.25 * u], [x - st, y - 0.03 * u]], 0.085 * u, 0.055 * u);
      const lR = taper([[x + 0.045 * u + lean * 0.5, hip], [x + 0.04 * u + st * 0.4, y - 0.25 * u], [x + st, y - 0.03 * u]], 0.085 * u, 0.055 * u);
      tone(D, join(lL, lR), suit); litFrom(D, join(lL, lR), x - 0.1 * u, x + 0.06 * u, 0.35);
      tone(D, join(ell(x - st + d * 0.02 * u, y - 0.012 * u, 0.05 * u, 0.018 * u), ell(x + st + d * 0.02 * u, y - 0.012 * u, 0.05 * u, 0.018 * u)), suit + 0.25);
    }
    const jac = cr([[x - 0.045 * u + lean, sh - 0.05 * u], [x - 0.11 * u + lean, sh - 0.02 * u], [x - 0.13 * u + lean, sh + 0.04 * u], [x - 0.125 * u + lean * 0.7, y - 0.62 * u],
      [x - 0.115 * u + lean * 0.5, hip + 0.02 * u, 1], [x + 0.115 * u + lean * 0.5, hip + 0.02 * u, 1], [x + 0.125 * u + lean * 0.7, y - 0.62 * u], [x + 0.13 * u + lean, sh + 0.04 * u], [x + 0.11 * u + lean, sh - 0.02 * u], [x + 0.045 * u + lean, sh - 0.05 * u]]);
    tone(D, jac, suit);
    const v = poly([[x - 0.035 * u + lean, sh - 0.045 * u], [x + 0.035 * u + lean, sh - 0.045 * u], [x + lean * 0.9, sh + 0.12 * u]]);
    tone(D, v, 0.02); chalk(D, v, 0.75);
    line(D, seg(x + lean, sh - 0.03 * u, x + lean * 0.9, sh + 0.1 * u), 0.014 * u, 0.6);
    const arms = o.arms || [[[-0.15, 0.2], [-0.14, 0.37]], [[0.15, 0.2], [0.14, 0.37]]];
    for (let ai = 0; ai < arms.length; ai++) {
      const [e, hnd] = arms[ai];
      const sx = x + (ai ? 1 : -1) * 0.11 * u + lean;
      const p = [[sx, sh + 0.0 * u], [x + e[0] * u + lean, sh + e[1] * u], [x + hnd[0] * u + lean, sh + hnd[1] * u]];
      tone(D, taper(p, 0.065 * u, 0.05 * u), suit * 0.96);
      tone(D, ell(p[2][0], p[2][1], 0.022 * u, 0.022 * u), 0.14);
    }
    litFrom(D, jac, x - 0.13 * u + lean, x + 0.08 * u, 0.4);
    line(D, jac, 0.3, 0.28);
    gHead(D, x + lean * 1.1 + d * 0.01 * u, y - 0.915 * u, 0.06 * u, { dir: d, hairT: o.hairT, hat: o.hat });
  }
  function gWoman(D, x, y, h, o = {}) {
    const u = h, d = o.dir || 1, dress = o.dress === undefined ? 0.05 : o.dress, lean = (o.lean || 0) * u, sw = (o.swing || 0) * u;
    const waist = y - 0.6 * u, sh = y - 0.8 * u, hem = y - 0.24 * u;
    tone(D, ell(x + 0.15 * u, y, 0.19 * u, 0.022 * u), 0.12, 0.6);
    const st = (o.stride === undefined ? 0.035 : o.stride) * u;
    const legs = join(taper([[x - 0.03 * u, hem], [x - st, y - 0.02 * u]], 0.038 * u, 0.026 * u), taper([[x + 0.03 * u, hem], [x + st, y - 0.02 * u]], 0.038 * u, 0.026 * u));
    tone(D, legs, 0.13); tone(D, join(ell(x - st, y - 0.01 * u, 0.03 * u, 0.012 * u), ell(x + st, y - 0.01 * u, 0.03 * u, 0.012 * u)), 0.45);
    const skirt = cr([[x - 0.06 * u + lean * 0.6, waist, 1], [x + 0.06 * u + lean * 0.6, waist, 1], [x + 0.12 * u + sw * 0.4, y - 0.42 * u],
      [x + 0.18 * u + sw, hem + sw * 0.1, 1], [x + 0.08 * u + sw * 0.7, hem + 0.03 * u], [x - 0.05 * u + sw * 0.5, hem + 0.035 * u], [x - 0.17 * u + sw, hem - sw * 0.1, 1], [x - 0.12 * u + sw * 0.4, y - 0.43 * u]]);
    const bod = cr([[x - 0.035 * u + lean, sh - 0.04 * u], [x - 0.09 * u + lean, sh], [x - 0.085 * u + lean, sh + 0.06 * u], [x - 0.06 * u + lean * 0.6, waist + 0.01 * u, 1],
      [x + 0.06 * u + lean * 0.6, waist + 0.01 * u, 1], [x + 0.085 * u + lean, sh + 0.06 * u], [x + 0.09 * u + lean, sh], [x + 0.035 * u + lean, sh - 0.04 * u]]);
    const dr = join(skirt, bod);
    tone(D, dr, dress);
    tone(D, skirt, grad(D.C, x - 0.1 * u, 0, x + 0.2 * u, 0, [[0, 0], [0.6, 0.05], [1, 0.2]]));
    if (o.dots) {
      const r = D.r, dp = new Path2D();
      for (let i = 0; i < 18; i++) { const px = x - 0.15 * u + r() * 0.32 * u + sw * 0.5, py = sh + r() * (hem - sh); if (inside(dr, px, py)) dp.addPath(ell(px, py, 0.009 * u, 0.009 * u)); }
      tone(D, dp, 0.32);
    }
    litFrom(D, dr, x - 0.18 * u, x + 0.18 * u, 0.85);
    tone(D, dr, grad(D.C, x - 0.05 * u, 0, x + 0.2 * u, 0, [[0, 0], [1, 0.12]]));
    for (let i = -1; i <= 1; i++) line(D, cr([[x + i * 0.035 * u + lean * 0.6, waist + 0.05 * u], [x + i * 0.08 * u + sw * 0.75, hem + 0.02 * u]], false), 0.35, 0.26);
    line(D, dr, 0.45, 0.45);
    tone(D, ell(x + lean * 0.6, waist + 0.005 * u, 0.06 * u, 0.012 * u), 0.22); // a sash
    const arms = o.arms || [[[-0.12, 0.18], [-0.1, 0.34]], [[0.12, 0.18], [0.1, 0.34]]];
    for (let ai = 0; ai < arms.length; ai++) {
      const [e, hnd] = arms[ai];
      const sx = x + (ai ? 1 : -1) * 0.08 * u + lean;
      tone(D, taper([[sx, sh + 0.01 * u], [x + e[0] * u + lean, sh + e[1] * u], [x + hnd[0] * u + lean, sh + hnd[1] * u]], 0.036 * u, 0.026 * u), 0.15);
    }
    gHead(D, x + lean * 1.1 + d * 0.01 * u, y - 0.915 * u, 0.058 * u, { dir: d, big: true, hairT: o.hairT === undefined ? 0.4 : o.hairT, hat: o.hat });
  }
  function gChild(D, x, y, h, o = {}) {
    const u = h, d = o.dir || 1, run = o.run || 0;
    const hip = y - 0.46 * u, sh = y - 0.74 * u, hr = 0.085 * u, lean = run * d * 0.07 * u;
    tone(D, ell(x + 0.14 * u, y, 0.17 * u, 0.025 * u), 0.12, 0.6);
    const lf = taper([[x + lean * 0.4, hip], [x + d * 0.14 * run * u, y - 0.25 * u], [x + d * 0.2 * run * u, y - 0.02 * u]], 0.075 * u, 0.05 * u);
    const lb = taper([[x + lean * 0.4, hip], [x - d * 0.06 * run * u, y - 0.22 * u], [x - d * 0.22 * run * u, y - 0.13 * u]], 0.075 * u, 0.05 * u);
    tone(D, join(lf, lb), o.girl ? 0.14 : 0.2);
    if (o.girl) {
      const sk = cr([[x - 0.065 * u + lean, sh, 1], [x + 0.065 * u + lean, sh, 1], [x + 0.17 * u - d * run * 0.05 * u, hip + 0.12 * u, 1], [x - 0.16 * u - d * run * 0.12 * u, hip + 0.06 * u, 1]]);
      tone(D, sk, 0.04); litFrom(D, sk, x - 0.16 * u, x + 0.16 * u, 0.95); line(D, sk, 0.3, 0.3);
    } else {
      tone(D, rect(x - 0.08 * u + lean * 0.4, hip - 0.02 * u, 0.16 * u, 0.12 * u), 0.42);
      const sh1 = cr([[x - 0.09 * u + lean, sh, 1], [x + 0.09 * u + lean, sh, 1], [x + 0.08 * u + lean * 0.5, hip, 1], [x - 0.08 * u + lean * 0.5, hip, 1]]);
      tone(D, sh1, 0.04); litFrom(D, sh1, x - 0.1 * u, x + 0.1 * u, 0.9); line(D, sh1, 0.3, 0.3);
    }
    const a1 = [[x - 0.07 * u + lean, sh + 0.02 * u], [x - d * 0.12 * u * run + lean, sh + 0.14 * u], [x - d * 0.2 * u * run + lean, sh + 0.08 * u]];
    const a2 = [[x + 0.07 * u + lean, sh + 0.02 * u], [x + d * 0.14 * u * run + lean, sh + 0.1 * u], [x + d * 0.2 * u * run + lean, sh - 0.02 * u]];
    tone(D, join(taper(a1, 0.045 * u, 0.035 * u), taper(a2, 0.045 * u, 0.035 * u)), 0.14);
    gHead(D, x + lean * 1.3, sh - hr * 1.05, hr, { dir: d, big: !!o.girl, hairT: o.hairT === undefined ? 0.35 : o.hairT });
    if (o.ribbon) tone(D, join(ell(x + lean * 1.3 - d * hr * 1.0, sh - hr * 1.7, hr * 0.45, hr * 0.22, 0.5), ell(x + lean * 1.3 - d * hr * 1.0, sh - hr * 1.7, hr * 0.22, hr * 0.45, 0.5)), 0.3);
  }
  // a couple in a ballroom hold: he faces d, she faces him; joined hands raised between them
  function gCouple(D, x, y, h, o = {}) {
    const d = o.dir || 1, u = h, xw = x + d * 0.15 * u;
    // arms are given per shoulder [left, right]; 'out' hangs on the far side, 'to' reaches toward the partner
    const side = (outArm, toArm, dd) => (dd > 0 ? [outArm, toArm] : [toArm, outArm]);
    const mOut = [[-d * 0.15, 0.17], [-d * 0.12, 0.33]], mTo = [[d * 0.18, 0.12], [d * 0.25, 0.04]];
    const wOut = [[d * 0.04, 0.16], [d * 0.1, 0.06]], wTo = [[-d * 0.06, 0.05], [-d * 0.12, 0.0]];
    const man = () => gMan(D, x, y, u, { suit: o.suit || 0.46, dir: d, stride: 0.06, lean: 0.015 * d, arms: side(mOut, mTo, d) });
    const wom = () => gWoman(D, xw, y + 1, u * 0.93, { dress: o.dress || 0.04, dir: -d, swing: (o.swing || 0.06) * -d, dots: o.dots, lean: -0.015 * d, hairT: o.hairT, arms: side(wTo, wOut, d) });
    if (o.womanFront) { man(); wom(); } else { wom(); man(); }
  }

  function tree(D, cx, top, w, base, o = {}) {
    const r = D.r, C = D.C;
    const tx = o.tx === undefined ? cx : o.tx;
    const tH = base - top;
    const trunk = cr([[tx - w * 0.06, base + 2, 1], [tx - w * 0.045, base - tH * 0.3], [tx - w * 0.07, top + tH * 0.5], [tx - w * 0.16, top + tH * 0.34], [tx - w * 0.14, top + tH * 0.32], [tx - w * 0.03, top + tH * 0.45],
      [tx + w * 0.02, top + tH * 0.36], [tx + w * 0.12, top + tH * 0.3], [tx + w * 0.13, top + tH * 0.32], [tx + w * 0.04, top + tH * 0.46], [tx + w * 0.045, base - tH * 0.25], [tx + w * 0.08, base + 2, 1]]);
    tone(D, trunk, 0.38);
    litFrom(D, trunk, tx - w * 0.07, tx + w * 0.05, 0.55);
    hatch(D, trunk, [tx - w * 0.2, top, tx + w * 0.2, base + 4], { ang: 84, sp: 2, w: 0.5, a: 0.22, jit: 0.3 });
    // crown: clustered lobes, lit from the upper left, darker beneath
    const lobes = [];
    const n = o.n || 18;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + r() * 0.35;
      const rr = Math.sqrt(0.15 + r() * 0.85) * 0.45;
      lobes.push([cx + Math.cos(a) * w * rr * 1.05, top + tH * 0.3 + Math.sin(a) * tH * rr * 0.5, w * (0.14 + r() * 0.08)]);
    }
    lobes.push([cx, top + tH * 0.3, w * 0.3]);
    lobes.sort((a, b) => b[2] - a[2]);
    const crown = new Path2D(); lobes.forEach(([x, y, rr]) => crown.addPath(ell(x, y, rr, rr * 0.84)));
    tone(D, crown, 0.2);
    tone(D, crown, grad(C, 0, top, 0, top + tH * 0.65, [[0, 0], [0.6, 0.08], [1, 0.22]]));
    lobes.sort((a, b) => a[1] - b[1]);
    for (const [x, y, rr] of lobes) {
      const lp = ell(x, y, rr, rr * 0.84);
      tone(D, lp, rgrad(C, x + rr * 0.3, y + rr * 0.45, rr * 0.1, rr * 1.05, [[0, 0.22], [1, 0]]));
      chalk(D, lp, rgrad(D.K, x - rr * 0.38, y - rr * 0.42, 0, rr * 0.95, [[0, 0.85], [0.65, 0.3], [1, 0]], W3));
      const sc = new Path2D();
      for (let k = 0; k < 6; k++) {
        const a0 = 0.25 + k * 0.42 + r() * 0.1; const ex = x + Math.cos(a0) * rr * 0.97, ey = y + Math.sin(a0) * rr * 0.82;
        sc.moveTo(ex + rr * 0.09, ey); sc.arc(ex, ey, rr * 0.09, 0, Math.PI, false);
      }
      line(D, sc, 0.45, 0.35);
    }
    hatch(D, crown, [cx - w * 0.75, top, cx + w * 0.75, base], { ang: 62, sp: 2.2, w: 0.45, a: 0.2, jit: 0.4, af: (x, y) => clamp((x - cx) / w + (y - top) / tH - 0.15, 0, 1) });
    return crown;
  }

  function stringLights(D, x0, y0, x1, y1, sag, n) {
    const r = D.r;
    const pts = [];
    for (let i = 0; i <= 40; i++) { const t = i / 40; pts.push([lerp(x0, x1, t), lerp(y0, y1, t) + sag * 4 * t * (1 - t)]); }
    line(D, cr(pts, false), 0.55, 0.5);
    const shades = [0.05, 0.38, 0.6, 0.0, 0.26]; // white, red, green, yellow, blue: coloured lights, in charcoal
    for (let i = 1; i < n; i++) {
      const t = i / n, x = lerp(x0, x1, t), y = lerp(y0, y1, t) + sag * 4 * t * (1 - t);
      const b = ell(x, y + 2.4, 1.4, 2);
      line(D, seg(x, y, x, y + 0.8), 0.7, 0.55);
      const s = shades[(i + Math.floor(r() * 1.4)) % shades.length];
      tone(D, b, s); if (s < 0.1) chalk(D, b, 0.95); line(D, b, 0.3, 0.4);
    }
  }

  function garden(D) {
    const C = D.C, K = D.K, r = D.r;
    const glass = rect(GL.x0, GL.y0, GL.x1 - GL.x0, GL.y1 - GL.y0);
    lift(D, glass, 1);
    C.save(); K.save(); C.clip(glass); K.clip(glass);
    // the sky and the air: blazing
    chalk(D, glass, grad(K, 0, GL.y0, 0, GL.y1, [[0, 0.92], [0.6, 0.75], [1, 0.6]], W3));
    // distant houses of the mall
    const hy = 514;
    const h1 = poly([[176, hy], [176, 470], [212, 446], [262, 446], [298, 470], [298, hy]]);
    tone(D, h1, 0.07); chalk(D, h1, 0.3);
    const roof1 = poly([[170, 472], [212, 444], [262, 444], [304, 472]]);
    tone(D, roof1, 0.26); hatch(D, roof1, [170, 444, 304, 472], { ang: 0, sp: 1.8, w: 0.4, a: 0.2, jit: 0.2 });
    tone(D, rect(262, 452, 10, 20), 0.3); // chimney
    for (let i = 0; i < 4; i++) { tone(D, rect(186 + i * 28, 482, 8, 11), 0.22); tone(D, rect(186 + i * 28, 499, 8, 9), 0.2); }
    tone(D, rect(176, 470, 6, hy - 470), 0.08);
    const h2 = poly([[318, hy], [318, 484], [346, 466], [392, 466], [420, 484], [420, hy]]);
    tone(D, h2, 0.06); chalk(D, h2, 0.25); tone(D, poly([[312, 486], [346, 464], [392, 464], [426, 486]]), 0.22);
    for (let i = 0; i < 3; i++) tone(D, rect(330 + i * 30, 492, 7, 10), 0.2);
    // a far hedge
    const row = new Path2D();
    for (let x = GL.x0 - 10; x < GL.x1 + 10; x += 9) row.addPath(ell(x + r() * 4, 508 - r() * 6, 7 + r() * 4, 6 + r() * 3));
    tone(D, row, 0.16); chalk(D, rect(GL.x0, 494, GL.x1 - GL.x0, 8), 0.2);
    // lawn
    const lawn = rect(GL.x0, 510, GL.x1 - GL.x0, GL.y1 - 510);
    chalk(D, lawn, 0.3);
    tone(D, lawn, grad(C, 0, 510, 0, GL.y1, [[0, 0.04], [1, 0.12]]));
    hatch(D, lawn, [GL.x0, 510, GL.x1, GL.y1], { ang: 0, sp: 3.4, w: 0.4, a: 0.1, jit: 0.5, maxLen: 22 });
    // the two big trees
    tree(D, 150, GL.y0 - 40, 190, 548, { n: 20, tx: 168 });
    tree(D, 420, GL.y0 - 20, 160, 544, { n: 16, tx: 404 });
    // coloured lights strung between the trees
    stringLights(D, 150, 352, 416, 360, 34, 26);
    stringLights(D, 172, 404, 398, 398, 38, 24);
    stringLights(D, 188, 450, 386, 444, 22, 18);
    // the band on its little stand under the right tree, bunting along its front
    const bs = poly([[334, 547], [444, 547], [444, 560], [334, 560]]);
    tone(D, bs, 0.14); chalk(D, rect(334, 547, 110, 3), 0.6);
    for (let i = 0; i < 6; i++) { const sw = cr([[336 + i * 18, 549], [345 + i * 18, 557], [354 + i * 18, 549]], false); line(D, sw, 0.7, 0.32); }
    gMan(D, 350, 547, 50, { suit: 0.42, arms: [[[-0.14, 0.18], [0.02, 0.24]], [[0.15, 0.17], [0.05, 0.12]]], dir: 1 });   // mandolin
    tone(D, cr([[344, 517], [356, 512], [361, 520], [352, 527]]), 0.34); line(D, seg(357, 515, 372, 503), 0.8, 0.5);
    gMan(D, 377, 547, 48, { suit: 0.48, arms: [[[-0.15, 0.18], [-0.12, 0.3]], [[0.15, 0.18], [0.12, 0.3]]], dir: -1, seated: false });   // accordion
    tone(D, rect(369, 514, 17, 12), 0.3); for (let i = 0; i < 4; i++) line(D, seg(371 + i * 4, 514, 371 + i * 4, 526), 0.35, 0.45);
    chalk(D, rect(369, 514, 4, 12), 0.5);
    const bass = cr([[411, 478], [416, 485], [413, 499], [420, 511], [417, 535], [406, 545], [397, 535], [397, 511], [403, 499], [402, 485]]);
    gMan(D, 418, 547, 51, { suit: 0.42, arms: [[[-0.14, 0.2], [-0.16, 0.3]], [[-0.05, 0.1], [-0.14, 0.03]]], dir: -1 });  // bass
    tone(D, bass, 0.4); litFrom(D, bass, 397, 418, 0.5); line(D, seg(408, 466, 409, 546), 0.6, 0.65);
    // the dance floor: a wooden platform
    const pf = poly([[118, 552], [322, 552], [344, 584], [98, 584]]);
    tone(D, pf, 0.06); chalk(D, pf, 0.6);
    for (let i = 0; i <= 18; i++) { const xb = lerp(98, 344, i / 18); line(D, seg(xb, 584, vpx(xb, 584, 552), 552), 0.35, 0.22); }
    const pfFace = poly([[98, 584], [344, 584], [344, 594], [98, 594]]);
    tone(D, pfFace, 0.26); for (let x = 102; x < 344; x += 7) line(D, seg(x, 584, x, 594), 0.35, 0.3);
    tone(D, ell(221, 596, 128, 4), 0.14, 1.5);
    // dancers: the back row smaller, the front row larger
    const back = [[140, 557, 50], [190, 556, 51], [244, 557, 50], [296, 556, 49]];
    back.forEach(([x, y, h], i) => gCouple(D, x + (r() - 0.5) * 6, y, h, { dir: i % 2 ? -1 : 1, suit: 0.22 + r() * 0.32, dress: 0.03 + r() * 0.2, dots: r() < 0.35, swing: 0.05 + r() * 0.06, womanFront: r() < 0.5 }));
    const front = [[126, 580, 70], [212, 581, 72], [292, 580, 69]];
    front.forEach(([x, y, h], i) => gCouple(D, x + (r() - 0.5) * 5, y, h, { dir: i % 2 ? -1 : 1, suit: [0.5, 0.12, 0.42][i], dress: [0.04, 0.22, 0.1][i], dots: i === 1 || r() < 0.3, swing: 0.08 + r() * 0.05, womanFront: i % 2 === 0 }));
    // a long table with a white cloth, guests seated at it, wine and bread
    for (let i = 0; i < 5; i++) gMan(D, 108 + i * 30 + (r() - 0.5) * 6, 640, 56, { suit: 0.38 + r() * 0.14, seated: true, dir: r() < 0.5 ? 1 : -1, arms: [[[-0.16, 0.18], [-0.08, 0.3]], [[0.16, 0.18], [0.08, 0.3]]] });
    const tbl = poly([[96, 612], [252, 612], [258, 622], [96, 622]]);
    tone(D, tbl, 0.03); chalk(D, tbl, 0.95);
    const cloth = poly([[96, 622], [258, 622], [260, 652], [96, 652]]);
    tone(D, cloth, 0.06); chalk(D, cloth, 0.82);
    for (let x = 100; x < 258; x += 9) line(D, cr([[x, 623], [x + 1.5, 637], [x, 652]], false), 0.35, 0.16);
    tone(D, rect(96, 652, 166, 5), 0.18, 1);
    for (let i = 0; i < 7; i++) {
      const x = 104 + i * 21 + r() * 6;
      if (i % 3 === 0) tone(D, cr([[x - 2, 612], [x - 3.4, 604], [x - 1.2, 597], [x + 1.2, 597], [x + 3.4, 604], [x + 2, 612]]), 0.5);
      else if (i % 3 === 1) { tone(D, ell(x, 609, 4.5, 3), 0.26); chalk(D, ell(x - 1, 608, 2, 1.4), 0.6); }
      else tone(D, rect(x - 1, 599, 2.2, 13), 0.55);
    }
    // guests standing about: women in summer dresses
    gWoman(D, 106, 604, 66, { dress: 0.14, dots: true, dir: 1 });
    gMan(D, 318, 608, 68, { suit: 0.5, dir: -1, arms: [[[-0.15, 0.2], [-0.14, 0.37]], [[0.17, 0.12], [0.1, 0.02]]] });
    gWoman(D, 340, 610, 66, { dress: 0.03, dir: -1, hat: true });
    // children running across the grass
    gChild(D, 280, 668, 56, { run: 1, dir: 1, girl: true, ribbon: true });
    gChild(D, 228, 672, 60, { run: 1, dir: 1 });
    gChild(D, 160, 677, 46, { run: 0.8, dir: -1, girl: true, hairT: 0.2 });
    C.restore(); K.restore();
  }

  function blindAndSash(D) {
    // the venetian blind, let down over the upper sash, its slats tilted open
    const top = GL.y0, bot = 330, per = 10;
    tone(D, rect(GL.x0, top, GL.x1 - GL.x0, 8), 0.75);
    for (let y = top + 12; y < bot - 4; y += per) {
      const t = (y - top) / (bot - top);
      const th = lerp(3.4, 2, t);
      tone(D, rect(GL.x0, y, GL.x1 - GL.x0, th), 0.58);
      lift(D, rect(GL.x0, y + th - 0.7, GL.x1 - GL.x0, 0.7), 0.4);
    }
    tone(D, rect(GL.x0, bot - 4, GL.x1 - GL.x0, 8), 0.7);
    lift(D, rect(GL.x0, bot + 3, GL.x1 - GL.x0, 1), 0.3);
    for (const x of [150, 384]) tone(D, rect(x - 1.2, top, 2.4, bot - top), 0.5);
    line(D, cr([[420, bot], [421, 420], [420, 520]], false), 0.9, 0.7);
    tone(D, cr([[420, 516], [424, 522], [425, 536], [420, 540], [415, 536], [416, 522]]), 0.8);
    // sash bars: interior side in shadow
    const sash = new Path2D();
    sash.rect(GL.x0, GL.y0, 9, GL.y1 - GL.y0); sash.rect(GL.x1 - 9, GL.y0, 9, GL.y1 - GL.y0);
    sash.rect(GL.x0, 430, GL.x1 - GL.x0, 13); sash.rect(GL.x0, GL.y1 - 11, GL.x1 - GL.x0, 11);
    sash.rect(264, GL.y0, 6, GL.y1 - GL.y0); sash.rect(GL.x0, 560, GL.x1 - GL.x0, 5); sash.rect(GL.x0, 312, GL.x1 - GL.x0, 5);
    tone(D, sash, 0.84);
    const lips = new Path2D();
    lips.rect(GL.x0 + 9, GL.y0, 1, GL.y1 - GL.y0); lips.rect(270, GL.y0, 1, GL.y1 - GL.y0);
    lips.rect(GL.x0, 443, GL.x1 - GL.x0, 1); lips.rect(GL.x0, 565, GL.x1 - GL.x0, 1);
    lift(D, lips, 0.45);
    // halation: the bright glass eats the edges of the bars a little
    chalk(D, rect(GL.x0, GL.y0, GL.x1 - GL.x0, GL.y1 - GL.y0), 0.08, 2.4);
  }

  function shutters(D) {
    // folded louvred shutters: one against the wall left of the window, the edge of the other on the right
    const L = rect(4, 160, 36, 540);
    tone(D, L, 0.25);
    line(D, L, 1.2, 0.6);
    for (let y = 172; y < 690; y += 6.5) { tone(D, rect(10, y, 24, 3.2), 0.36); lift(D, rect(10, y + 3.2, 24, 1), 0.25); }
    line(D, seg(10, 166, 10, 694), 0.9, 0.5); line(D, seg(34, 166, 34, 694), 0.9, 0.5);
    tone(D, rect(4, 418, 36, 10), 0.4);
    const R = rect(462, 160, 30, 540);
    tone(D, R, 0.22); line(D, R, 1.2, 0.6);
    for (let y = 172; y < 690; y += 6.5) { tone(D, rect(467, y, 22, 3.2), 0.38); lift(D, rect(467, y + 3.2, 22, 1), 0.2); }
    tone(D, rect(462, 418, 30, 10), 0.4);
    D.shutterR = R;
  }

  function wallObjects(D) {
    // crucifix above the Don's chair
    const cx = 646, cy = 96;
    const cross = join(rect(cx - 4.5, cy, 9, 104), rect(cx - 27, cy + 26, 54, 8.5));
    tone(D, moved(cross, 9, 8), 0.4, 1.6);
    tone(D, cross, 0.94);
    eraseLine(D, seg(cx - 4.5, cy + 1, cx - 4.5, cy + 103), 0.8, 0.25);
    const corpus = cr([[cx, cy + 20], [cx + 3, cy + 24], [cx + 2.5, cy + 32], [cx + 20, cy + 28], [cx + 21, cy + 31], [cx + 3, cy + 36], [cx + 3.4, cy + 56], [cx + 1.5, cy + 74], [cx + 0.6, cy + 82],
      [cx - 1, cy + 82], [cx - 1.8, cy + 66], [cx - 3, cy + 44], [cx - 3.4, cy + 36], [cx - 21, cy + 32], [cx - 20, cy + 28], [cx - 2.5, cy + 32], [cx - 3, cy + 24]]);
    lift(D, corpus, 0.45);
    tone(D, ell(cx - 0.6, cy + 22, 3, 3.6), 0.2);
    tone(D, rect(cx - 5, cy + 9, 10, 5), 0.7);
    D.cross = cross; D.corpus = corpus;
    // a small devotional picture: the Madonna in an oval, on the wall to the right
    const fr = rect(752, 132, 50, 64);
    tone(D, moved(fr, 8, 7), 0.4, 2);
    tone(D, fr, 0.9);
    const ov = ell(777, 164, 17, 24);
    lift(D, ov, 0.35); tone(D, ov, rgrad(D.C, 777, 164, 3, 24, [[0, 0], [1, 0.45]]));
    tone(D, cr([[777, 148], [784, 152], [787, 164], [792, 186], [762, 186], [767, 164], [770, 152]]), 0.55);
    lift(D, ell(776, 157, 4.2, 5.4), 0.4);
    line(D, ell(776, 155, 7, 7), 0.5, 0.25, D.K);
    line(D, rect(754, 134, 46, 60), 1, 0.22, D.K);
    D.saint = fr;
  }

  function bookshelf(D) {
    const r = D.r;
    const x0 = 818, x1 = W, top = 52, boards = [96, 226, 356, 486, 616], base = 880;
    const case_ = rect(x0, top, x1 - x0, base - top);
    tone(D, case_, 0.55);
    tone(D, rect(x0 - 6, top - 10, x1 - x0 + 6, 16), 0.8);
    lift(D, rect(x0 - 6, top + 5, x1 - x0 + 6, 2), 0.2);
    tone(D, rect(x0, top, 14, base - top), 0.4);
    lift(D, rect(x0, top, 2.5, base - top), 0.22);
    D.books = new Path2D();
    let photos = 0;
    for (let s = 0; s < boards.length - 1; s++) {
      const y0 = boards[s] + 9, y1 = boards[s + 1];
      tone(D, rect(x0 + 14, y0, x1 - x0 - 14, y1 - y0), 0.25);
      let x = x0 + 18;
      while (x < x1 - 4) {
        if (r() < 0.06) { x += 6 + r() * 14; continue; }
        if (r() < 0.08) { // a small stack lying flat
          const sw = 46 + r() * 16;
          for (let k = 0; k < 4; k++) { const bh = 6 + r() * 4, yy = y1 - (k + 1) * 10; const b = rect(x + r() * 4, yy, sw - r() * 8, bh); tone(D, b, 0.3 + r() * 0.3); D.books.addPath(b); }
          x += sw + 3; continue;
        }
        if ((s === 0 || s === 2) && x > 900 && photos < 2 && !D['ph' + s]) { // framed family photographs
          D['ph' + s] = 1; photos++;
          const fw = s === 0 ? 40 : 34, fh = s === 0 ? 52 : 44;
          const fp = rect(x, y1 - fh - 2, fw, fh);
          tone(D, fp, 0.72); lift(D, rect(x + 5, y1 - fh + 3, fw - 10, fh - 12), 0.26);
          if (s === 0) { // a wedding portrait, long ago
            tone(D, ell(x + 14, y1 - fh + 14, 3.6, 4.4), 0.5); tone(D, ell(x + 26, y1 - fh + 16, 3.4, 4.2), 0.5);
            tone(D, poly([[x + 8, y1 - 12], [x + 20, y1 - 12], [x + 18, y1 - fh + 20], [x + 10, y1 - fh + 20]]), 0.55);
            lift(D, poly([[x + 21, y1 - 12], [x + 33, y1 - 12], [x + 29, y1 - fh + 22], [x + 24, y1 - fh + 22]]), 0.2);
          } else {
            tone(D, ell(x + 17, y1 - 30, 5, 6), 0.5); tone(D, poly([[x + 9, y1 - 12], [x + 25, y1 - 12], [x + 22, y1 - 24], [x + 12, y1 - 24]]), 0.5);
          }
          D.books.addPath(fp); x += fw + 6; continue;
        }
        const bw = 8 + r() * 13, bh = (y1 - y0) * (0.62 + r() * 0.34);
        const lean = r() < 0.07 ? (r() < 0.5 ? -1 : 1) * (5 + r() * 6) : 0;
        const b = poly([[x, y1], [x + bw, y1], [x + bw + lean, y1 - bh], [x + lean, y1 - bh]]);
        tone(D, b, 0.35 + r() * 0.45);
        const bands = new Path2D(); bands.rect(x + 1 + lean * 0.9, y1 - bh + 6, bw - 2, 1.4); bands.rect(x + 1, y1 - 10, bw - 2, 1.4);
        if (r() < 0.6) bands.rect(x + 1 + lean * 0.7, y1 - bh * 0.72, bw - 2, 1.2);
        lift(D, bands, 0.18);
        line(D, seg(x, y1, x + lean, y1 - bh), 0.6, 0.55);
        D.books.addPath(b);
        x += bw + 0.6;
      }
      tone(D, rect(x0 + 14, y0, x1 - x0 - 14, 14), 0.35, 4); // the shelf above shades the book tops
    }
    for (const b of boards) {
      tone(D, rect(x0, b, x1 - x0, 9), 0.8);
      lift(D, rect(x0, b, x1 - x0, 1.8), 0.3);
      D.books.addPath(rect(x0, b, x1 - x0, 9));
    }
    tone(D, rect(x0, 616, x1 - x0, base - 616), 0.85);
    for (const dx of [834, 958]) {
      line(D, rect(dx, 640, 112, 200), 1.6, 0.5);
      eraseLine(D, seg(dx + 2, 642, dx + 110, 642), 1, 0.16);
      eraseLine(D, seg(dx + 2, 642, dx + 2, 838), 1, 0.14);
    }
    D.shelf = case_;
  }

  async function lightWall(D) {
    // the bars fall across the back wall above and beside the chair, fading out into the dark
    const bb = [456, 30, 900, 880];
    const wallM = rect(456, 30, 362, 850);
    const fall = (X) => rgrad(X, 600, 200, 20, 330, [[0, 0.9], [0.4, 0.7], [0.75, 0.2], [1, 0]], W3);
    const jamb = (X) => grad(X, 452, 0, 560, 0, [[0, 0], [1, 1]], W3); // the light thins out toward the window wall
    light(D, { bb, mask: wallM, bars: bars(bb, 0), int: fall, int2: jamb, lift: 0.5, soft: 0.5 }); await D.tick();
    light(D, { bb, mask: wallM, bars: bars(bb, 0), int: (X) => rgrad(X, 620, 160, 10, 230, [[0, 0.6], [1, 0]], W3), int2: jamb, chalk: 0.28, soft: 0.6 });
    light(D, { bb, mask: D.damask, bars: bars(bb, 0), int: fall, int2: jamb, lift: 0.14 }); await D.tick();
    light(D, { bb, mask: D.corpus, bars: bars(bb, 0), chalk: 0.75, lift: 0.5 });
    light(D, { bb, mask: D.cross, bars: bars(bb, 0), lift: 0.35 });
    light(D, { bb, mask: D.saint, bars: bars(bb, 0), int: fall, lift: 0.4 }); await D.tick();
    light(D, { bb, mask: D.shutterR, bars: bars(bb, 0), int: fall, int2: jamb, lift: 0.4, chalk: 0.1 });
    light(D, { bb, mask: D.books, bars: bars(bb, 0), lift: 0.45, int: (X) => rgrad(X, 818, 200, 10, 230, [[0, 1], [1, 0]], W3) });
  }

  /* ------------------------------------------------------------------ floor and rug */
  function floor(D) {
    const r = D.r;
    const fl = rect(0, FLOOR, W, H - FLOOR);
    const bl = new Path2D();
    for (let u = -2.2; u < 2.4; u += 0.085) { bl.moveTo(VPX + u * (FLOOR - HZ), FLOOR); bl.lineTo(VPX + u * (H - HZ), H); }
    line(D, bl, 1, 0.45);
    const ej = new Path2D();
    for (let u = -2.2; u < 2.4; u += 0.085) {
      for (let y = FLOOR + 20 + r() * 80; y < H; y += 90 + r() * 140) { ej.moveTo(VPX + u * (y - HZ), y); ej.lineTo(VPX + (u + 0.085) * (y - HZ), y); }
    }
    line(D, ej, 0.8, 0.35);
    hatch(D, fl, [0, FLOOR, W, H], { ang: 90, sp: 3, w: 0.6, a: 0.12, jit: 0.5, maxLen: 70 });
    // the rug: a dark Persian carpet before the desk, its edges converging
    const ry0 = 1000, ry1 = H + 40, ul = -0.93, ur = 0.69;
    const X = (u, y) => VPX + u * (y - HZ);
    const rug = poly([[X(ul, ry0), ry0], [X(ur, ry0), ry0], [X(ur, ry1), ry1], [X(ul, ry1), ry1]]);
    tone(D, rug, 0.45);
    const band = (k0, k1) => poly([[X(ul + k0, ry0 + k0 * 160), ry0 + k0 * 160], [X(ur - k0, ry0 + k0 * 160), ry0 + k0 * 160], [X(ur - k0, ry1), ry1], [X(ul + k0, ry1), ry1],
      [X(ul + k1, ry1), ry1], [X(ul + k1, ry0 + k1 * 160), ry0 + k1 * 160], [X(ur - k1, ry0 + k1 * 160), ry0 + k1 * 160], [X(ur - k1, ry1), ry1]]);
    void band;
    const outline = (k) => poly([[X(ul + k, ry0 + k * 160), ry0 + k * 160], [X(ur - k, ry0 + k * 160), ry0 + k * 160], [X(ur - k, ry1), ry1], [X(ul + k, ry1), ry1]]);
    const field = outline(0.17);
    tone(D, field, 0.25);
    for (const k of [0.035, 0.05, 0.15, 0.17]) line(D, outline(k), 1, 0.45);
    // border motif: a running vine of small lozenges and dots
    const motif = new Path2D();
    for (let y = ry0 + 14; y < H; y += 8 + (y - ry0) * 0.04) {
      const s = (y - HZ) / (ry0 - HZ);
      for (const u of [ul + 0.1, ur - 0.1]) { const x = X(u, y); motif.addPath(poly([[x, y - 3 * s], [x + 3.5 * s, y], [x, y + 3 * s], [x - 3.5 * s, y]])); }
    }
    for (let x = X(ul + 0.1, ry0 + 16); x < X(ur - 0.1, ry0 + 16); x += 12) motif.addPath(poly([[x, ry0 + 13], [x + 3.5, ry0 + 16], [x, ry0 + 19], [x - 3.5, ry0 + 16]]));
    lift(D, motif, 0.16);
    // a lattice in the field, and the central medallion
    const lat = new Path2D();
    for (let k = -14; k < 14; k++) {
      const ua = (ul + 0.17) + k * 0.12;
      lat.moveTo(X(ua, ry0 + 28), ry0 + 28); lat.lineTo(X(ua + 0.5, H), H);
      lat.moveTo(X(ua + 0.5, ry0 + 28), ry0 + 28); lat.lineTo(X(ua, H), H);
    }
    D.C.save(); D.C.clip(field); line(D, lat, 0.7, 0.3); D.C.restore();
    const my = 1215, mx = X((ul + ur) / 2, my);
    const med = cr([[mx, my - 50], [mx + 50, my - 26], [mx + 150, my], [mx + 50, my + 30], [mx, my + 62], [mx - 50, my + 30], [mx - 150, my], [mx - 50, my - 26]]);
    tone(D, med, 0.3); line(D, med, 1, 0.5); eraseLine(D, moved(med, 0, -1.5), 0.8, 0.06);
    const med2 = cr([[mx, my - 26], [mx + 70, my], [mx, my + 32], [mx - 70, my]]);
    tone(D, med2, 0.3); line(D, med2, 0.8, 0.45);
    hatch(D, rug, [0, ry0, W, H], { ang: 0, sp: 2.6, w: 0.5, a: 0.14, jit: 0.4, maxLen: 50 });
    // fringe along the far edge, half under the desk
    const fr = new Path2D();
    for (let x = X(ul, ry0) + 2; x < X(ur, ry0); x += 3.2) { fr.moveTo(x, ry0); fr.lineTo(x + (x - VPX) * 0.02, ry0 - 7); }
    eraseLine(D, fr, 0.7, 0.14);
    D.rug = rug; D.rugMotif = motif;
    tone(D, fl, rgrad(D.C, 1020, 1150, 50, 420, [[0, 0], [1, 0.12]]));
  }

  async function lightFloor(D) {
    // the bars on the floor run into the depth and gather towards the orange at the right edge
    const p = flatBars(FLOOR, H, 0.55, 1.7, 0.072, 0.48, 0.008);
    const int = (X) => rgrad(X, 1075, 1080, 20, 290, [[0, 1], [0.35, 0.72], [0.75, 0.2], [1, 0]], W3);
    const bb = [600, FLOOR, W, H];
    const fm = rect(0, FLOOR, W, H - FLOOR);
    light(D, { bb, mask: fm, bars: p, int, lift: 0.66, soft: 0.6 }); await D.tick();
    light(D, { bb, mask: fm, bars: p, int: (X) => rgrad(X, 1070, 1085, 10, 180, [[0, 0.75], [1, 0]], W3), chalk: 0.42, soft: 0.6 });
    light(D, { bb, mask: D.rugMotif, bars: p, int, lift: 0.4 }); await D.tick();
    const bl = new Path2D();
    for (let u = 0.5; u < 1.7; u += 0.085) { bl.moveTo(VPX + u * (FLOOR - HZ), FLOOR); bl.lineTo(VPX + u * (H - HZ), H); }
    D.C.save(); D.C.clip(p); line(D, bl, 0.9, 0.3); D.C.restore();
    hatch(D, fm, [880, 920, W, H], { ang: 90, sp: 5, w: 0.5, a: 0.07, mode: 'k', jit: 0.5, maxLen: 40, clip: p });
  }

  /* ------------------------------------------------------------------ Tom Hagen, in the shadow by the books */
  function hagen(D) {
    const hx = 1018;
    const head = cr([[hx - 8, 404], [hx + 10, 401], [hx + 25, 410], [hx + 31, 428], [hx + 28, 452], [hx + 21, 470], [hx + 8, 482], [hx - 6, 484], [hx - 14, 476], [hx - 18, 464],
      [hx - 24, 458], [hx - 22, 451], [hx - 25, 443], [hx - 20, 436], [hx - 19, 424], [hx - 15, 412]]);
    const body = cr([[hx - 12, 478], [hx + 14, 480], [hx + 18, 500], [hx + 40, 510], [hx + 58, 530], [hx + 66, 600], [hx + 70, 712, 1], [hx - 62, 712, 1], [hx - 58, 620], [hx - 52, 548], [hx - 36, 516], [hx - 14, 504]]);
    const fig = join(head, body);
    tone(D, fig, 0.93);
    hatch(D, fig, [940, 396, 1090, 712], { ang: 65, sp: 3, w: 0.6, a: 0.16, jit: 0.4 });
    // only the line of a lean profile, turned toward the Don, catches the light reflected from the desk
    eraseLine(D, cr([[hx - 18, 420], [hx - 20, 432], [hx - 26, 443], [hx - 23, 451], [hx - 25, 458], [hx - 18, 464], [hx - 14, 476], [hx - 6, 484]], false), 1.1, 0.26, 0.4);
    lift(D, cr([[hx - 16, 434], [hx - 8, 432], [hx - 4, 452], [hx - 10, 470], [hx - 16, 462]]), 0.1, 2);
    tone(D, ell(hx - 11, 442, 3, 1.4), 0.6);
    tone(D, cr([[hx - 15, 412], [hx - 4, 403], [hx + 12, 401], [hx + 26, 411], [hx + 31, 428], [hx + 14, 420], [hx - 4, 416], [hx - 18, 420]]), 0.6); // dark hair
    // a white collar and shirt front, deep in shadow; the dark tie; folded hands, low
    lift(D, poly([[hx - 12, 500], [hx, 512], [hx + 13, 500], [hx + 8, 496], [hx - 8, 496]]), 0.18);
    lift(D, poly([[hx - 6, 508], [hx + 6, 508], [hx + 2, 580], [hx - 2, 580]]), 0.08);
    tone(D, poly([[hx - 3, 508], [hx + 3, 508], [hx + 4, 560], [hx, 572], [hx - 4, 560]]), 0.95);
    eraseLine(D, cr([[hx - 52, 548], [hx - 48, 620], [hx - 34, 680]], false), 1.2, 0.05, 1);
    eraseLine(D, cr([[hx - 12, 506], [hx - 24, 560], [hx - 18, 640]], false), 1, 0.06);
    D.hagen = fig;
  }

  /* ------------------------------------------------------------------ the Don's chair (group coordinates) */
  const CHAIR = cr([[490, 712, 1], [484, 600], [478, 520], [478, 450], [490, 398], [506, 370], [530, 346], [575, 333], [625, 329], [676, 333], [720, 346], [744, 368], [760, 398], [770, 450], [770, 520], [764, 600], [758, 712, 1]]);
  function chair(D) {
    setGroup(D, DONM);
    tone(D, moved(CHAIR, 14, 9), 0.35, 4); // its shadow on the wall
    tone(D, CHAIR, 0.92);
    const back = cr([[512, 712, 1], [508, 560], [506, 430], [520, 384], [560, 360], [625, 354], [690, 360], [730, 384], [744, 430], [742, 560], [738, 712, 1]]);
    lift(D, back, 0.1, 2);
    line(D, back, 1.6, 0.6);
    // tufting: buttons in a diamond lattice with the leather creased between them
    const btn = new Path2D(), crease = new Path2D();
    const pts = [];
    for (let row = 0; row < 7; row++) {
      for (let col = 0; col < 7; col++) {
        const x = 526 + col * 34 + (row % 2) * 17, y = 384 + row * 34;
        if (x > 734 || !inside(back, x, y)) continue;
        pts.push([x, y]); btn.addPath(ell(x, y, 2.6, 2.4));
      }
    }
    for (const [x, y] of pts) for (const [x2, y2] of pts) {
      if (Math.abs(Math.abs(x2 - x) - 17) < 1 && Math.abs(y2 - y - 34) < 1) { crease.moveTo(x, y); crease.quadraticCurveTo((x + x2) / 2 + 2, (y + y2) / 2, x2, y2); }
    }
    line(D, crease, 1.1, 0.55);
    for (const [x, y] of pts) lift(D, ell(x + 2, y + 17, 9, 12), 0.08, 3);
    tone(D, btn, 0.95); lift(D, moved(btn, -0.8, -0.8), 0.15);
    const nails = new Path2D();
    for (let y = 400; y < 712; y += 8.5) { nails.addPath(ell(488 + (y < 450 ? (450 - y) * 0.2 : 0) + 4, y, 1.5, 1.5)); nails.addPath(ell(764 - (y < 450 ? (450 - y) * 0.2 : 0) - 2, y, 1.5, 1.5)); }
    for (let a = 0.05; a < 0.95; a += 0.022) { const x = lerp(500, 752, a), y = 345 - Math.sin(a * Math.PI) * 10 + Math.abs(a - 0.5) * 50; nails.addPath(ell(x, y + 6, 1.5, 1.5)); }
    D.nails = nails; D.chairBtn = btn;
    tone(D, nails, 0.6); lift(D, moved(nails, -0.5, -0.5), 0.2);
    hatch(D, CHAIR, [470, 320, 780, 712], { ang: 70, sp: 3, w: 0.7, a: 0.2, jit: 0.5 });
    setGroup(D, null);
  }

  /* ------------------------------------------------------------------ Don Vito Corleone (group coordinates) */
  const DON_HEAD = cr([
    [622, 442], [650, 445], [667, 458], [673, 476], [671, 496], [666, 512], [662, 526], [654, 536], [638, 545], [620, 549], [604, 547], [593, 539], [588, 529],
    [586, 521], [585, 515, 1], [586, 509], [584, 504], [578, 502, 1], [573, 497], [575, 489], [578, 481], [581, 473], [579, 467], [580, 458], [586, 450], [600, 444]]);
  const DON_FRONT = cr([ // the front plane of the face, turned to the light
    [588, 447], [604, 442], [620, 446], [628, 458], [631, 474], [627, 494], [629, 514], [624, 534], [610, 545], [604, 545], [593, 538], [588, 529],
    [586, 521], [585, 515, 1], [586, 509], [584, 504], [578, 502, 1], [573, 497], [575, 489], [578, 481], [581, 473], [579, 467], [580, 457]]);
  const DON_HAIR = cr([[588, 449], [600, 444], [622, 442], [650, 445], [667, 458], [673, 476], [671, 496], [662, 497], [654, 484], [643, 470], [629, 460], [614, 455], [600, 455], [590, 456]]);
  // the sculpture of the head: a dome turned three-quarters to our left, and the forms of an old, heavy face
  const HEAD_BUMPS = [
    [602, 456, 20, 10, 3], [612, 466, 13, 3.5, 4, 0.08], [587, 466, 7, 3, 3.5], [596, 469, 4, 4, 2.5],          // forehead, brows
    [612, 477, 10, 5.5, -6], [587, 477, 5, 4, -4.5], [612, 477.5, 6, 3, 2.4], [612, 473.5, 8, 2, 1.6],           // sockets, eyeballs, lids
    [613, 485, 9, 3, 2], [613, 488.5, 9, 1, -1.4],                                                               // the bag under the eye
    [580, 476, 3.5, 5, 6], [577, 484, 4, 5, 8.5], [575.5, 491, 4.5, 5, 10], [576, 496.5, 5, 4, 9.5],            // the nose
    [585, 500, 5, 3.5, 4.5], [582, 502.5, 2.5, 1.2, -4],                                                         // its wing and nostril
    [613, 494, 12, 8, 5], [608, 514, 13, 12, 5], [598, 510, 1.6, 11, -3, -0.3],                                 // cheekbone, cheek, nasolabial fold
    [624, 532, 13, 8, 4.5], [612, 530, 1.4, 9, -1.6, -0.4],                                                     // the jowl and its fold
    [592, 510, 8, 3, 2.5], [594, 515.5, 10, 1.1, -3.5, 0.12], [593, 520, 7, 2.6, 2.8], [592, 525, 6, 1.5, -1.8], // lips
    [593, 532, 9, 7, 5], [628, 462, 8, 8, -2.5], [649, 490, 7, 14, 3], [650, 491, 3, 8, -2.5],                  // chin, temple, ear
    [600, 452.5, 14, 0.8, -1], [601, 457, 14, 0.8, -0.9], [627, 474, 4, 0.6, -0.8, -0.4], [628, 478, 4, 0.6, -0.8, 0.2]];
  const headDome = (x, y) => { const dx = (x - 618) / 60, dy = (y - 494) / 62, r2 = dx * dx + dy * dy; return r2 < 1 ? 42 * Math.sqrt(1 - r2) : 0; };
  const hairTex = (x, y) => 1.4 + 0.55 * Math.sin(((-0.3 * x + 0.95 * y) / 2.4) * TAU + Math.sin(x * 0.11) * 1.5);
  const DON_EAR = cr([[640, 478], [647, 472], [655, 476], [657, 490], [653, 503], [646, 509], [641, 503], [643, 490]]);
  const DON_BODY = cr([
    [600, 540], [604, 551], [588, 557], [560, 566], [540, 578], [528, 598], [520, 630], [514, 670], [510, 712, 1], [742, 712, 1],
    [738, 670], [734, 630], [728, 600], [716, 580], [694, 566], [668, 556], [656, 548], [656, 534]]);
  const DON = join(DON_HEAD, DON_BODY);

  function don(D) {
    setGroup(D, DONM);
    const C = D.C;
    tone(D, moved(DON, 14, 9), 0.5, 3); // his shadow thrown on the chair
    tone(D, DON_BODY, 0.97);
    const shirt = cr([[603, 548], [626, 562], [650, 545], [646, 580], [634, 620], [626, 650], [617, 620], [606, 580]]);
    lift(D, shirt, 0.5);
    tone(D, shirt, grad(C, 600, 0, 652, 0, [[0, 0], [0.6, 0.15], [1, 0.4]]));
    const collarL = poly([[603, 547], [627, 563], [612, 572], [598, 556]]);
    const collarR = poly([[650, 544], [627, 563], [640, 572], [654, 553]]);
    lift(D, collarL, 0.6); lift(D, collarR, 0.35);
    const tie = cr([[621, 563], [632, 563], [636, 590], [633, 640], [626, 656], [619, 640], [618, 590]]);
    tone(D, tie, 0.95); lift(D, cr([[622, 566], [631, 566], [628, 574], [624, 574]]), 0.25);
    const lapL = cr([[603, 548], [590, 556], [570, 568], [572, 590], [596, 618], [615, 650], [624, 700], [610, 700], [598, 650], [586, 620]]);
    const lapR = cr([[651, 545], [664, 556], [684, 568], [682, 590], [660, 618], [640, 650], [630, 700], [640, 700], [652, 650], [668, 620]]);
    line(D, cr([[603, 548], [584, 566], [574, 586], [598, 616], [616, 652], [624, 712]], false), 1.3, 0.6);
    line(D, cr([[651, 545], [672, 566], [682, 588], [658, 616], [638, 652], [630, 712]], false), 1.3, 0.6);
    eraseLine(D, cr([[596, 552], [579, 568], [571, 586]], false), 1.3, 0.22, 0.4);
    const fl = new Path2D(); for (let k = 0; k < 9; k++) { const a = k * 0.7; fl.addPath(ell(584 + Math.cos(a) * 4.2, 596 + Math.sin(a) * 3.8, 3.2, 2.6, a)); }
    tone(D, fl, 0.85); D.flower = fl;
    hatch(D, DON_BODY, [505, 540, 745, 712], { ang: 72, sp: 2.6, w: 0.7, a: 0.22, bow: 0.04, jit: 0.4 });
    hatch(D, DON_BODY, [505, 540, 745, 712], { ang: -20, sp: 3.4, w: 0.6, a: 0.15, jit: 0.4, af: (x) => clamp((x - 600) / 140, 0, 1) });
    D.lapL = lapL; D.shirt = shirt; D.collar = join(collarL, collarR);
    tone(D, DON_HEAD, 0.94);
    lift(D, DON_HAIR, 0.14, 1.5);
    lift(D, DON_FRONT, 0.12, 3);
    tone(D, DON_EAR, 0.6); line(D, cr([[645, 482], [651, 480], [652, 492], [647, 501]], false), 0.9, 0.6);
    hatch(D, DON_HEAD, [570, 430, 672, 550], { ang: 60, sp: 2.2, w: 0.55, a: 0.22, jit: 0.3, af: (x) => clamp((x - 612) / 36, 0, 1) });
    hatch(D, DON_HEAD, [570, 430, 672, 550], { ang: -30, sp: 2.8, w: 0.5, a: 0.16, jit: 0.3, af: (x) => clamp((x - 630) / 30, 0, 1) });
    setGroup(D, null);
  }

  async function lightChair(D) {
    setGroup(D, DONM);
    const shadowOnChair = holeOf(DON, 14, 9);
    const cb = [470, 320, 780, 712];
    const chairInt = (X) => grad(X, 480, 0, 640, 0, [[0, 1], [0.3, 0.5], [1, 0]], W3);
    light(D, { bb: cb, mask: CHAIR, shadow: shadowOnChair, bars: bars(cb, 4), int: chairInt, lift: 0.3, soft: 0.5 }); await D.tick();
    light(D, { bb: cb, mask: join(D.nails, D.chairBtn), shadow: shadowOnChair, bars: bars(cb, 4), int: chairInt, chalk: 0.8, lift: 0.5 });
    setGroup(D, null);
  }

  async function lightDon(D) {
    setGroup(D, DONM);
    const bb = [540, 300, 800, 720];
    // the face: lit plane first, then the hard bars across it, modelled from cheekbone and brow
    const fb = bars(bb, 6, 22, 0.56);
    // the head is modelled by the light itself
    relief(D, { mask: DON_HEAD, bb: [566, 436, 678, 554], base: headDome, bumps: HEAD_BUMPS, texMask: DON_HAIR, tex: hairTex,
      bars: { ang: BAR.ang, per: 22, duty: 0.56, phase: 6 }, shadowLen: 16, amb: 0.12, chalkFrom: 0.58 });
    await D.tick();
    hatch(D, DON_HEAD, [566, 436, 678, 554], { ang: 60, sp: 2.2, w: 0.5, a: 0.18, jit: 0.3, af: (x) => clamp((x - 618) / 34, 0, 1) });
    light(D, { bb, mask: D.lapL, bars: fb, int: (X) => grad(X, 570, 0, 620, 0, [[0, 0.8], [1, 0.25]], W3), lift: 0.32, soft: 0.5 });
    light(D, { bb, mask: cr([[540, 578], [566, 564], [590, 556], [575, 586], [548, 610], [528, 640], [522, 610], [530, 590]]), bars: fb, lift: 0.28, soft: 0.6 }); await D.tick();
    light(D, { bb, mask: join(D.shirt, D.collar), int: (X) => grad(X, 600, 0, 650, 0, [[0, 1], [1, 0.3]], W3), lift: 0.25 });
    light(D, { bb, mask: join(D.shirt, D.collar), bars: fb, int: (X) => grad(X, 600, 0, 650, 0, [[0, 1], [1, 0.35]], W3), lift: 0.85, chalk: 0.7, soft: 0.4 });
    light(D, { bb, mask: D.flower, bars: fb, lift: 0.35, chalk: 0.15 });
    setGroup(D, null);
  }

  function donFeatures(D) {
    setGroup(D, DONM);
    // a few accents drawn back into the modelled head: the slit of the hooded eyes, nostril, the long closed mouth
    tone(D, cr([[604, 476.5], [612, 475], [620, 476.5], [612, 479]]), 0.75, 0.35);
    tone(D, cr([[583, 476], [588, 475], [592, 477], [587, 479]]), 0.6, 0.4);
    lift(D, ell(609.5, 476.6, 0.8, 0.6), 0.3);
    line(D, cr([[602, 475], [611, 472.6], [623, 475]], false), 1.2, 0.5, null, 0.35);
    line(D, cr([[582, 467], [591, 463.5], [600, 464.5]], false), 1.6, 0.4, null, 0.5);  // brows, thick and grey
    line(D, cr([[604, 464], [615, 460.5], [628, 465]], false), 1.8, 0.45, null, 0.5);
    line(D, cr([[578.5, 502], [583, 505], [589, 504.5]], false), 1, 0.6);
    tone(D, ell(583.6, 503.4, 2.2, 1.1, 0.2), 0.8);
    line(D, cr([[587, 515], [593, 516], [600, 517.6], [607, 522]], false), 1.2, 0.7);
    line(D, cr([[604, 520], [608, 524.5]], false), 0.9, 0.4);
    line(D, cr([[595, 502], [600, 509], [603, 519], [605, 529]], false), 0.9, 0.22, null, 0.5);
    eraseLine(D, cr([[580, 458], [579, 467], [581, 473], [578, 481], [575.5, 489], [573.5, 497]], false), 0.8, 0.22, 0.3);
    // grey hair combed straight back: a few long strokes on the relief
    const hl = new Path2D(), r = D.r;
    for (let i = 0; i < 18; i++) {
      const t = i / 17, y = 450 + t * 38 + (r() - 0.5) * 2, x0 = 594 + t * 42 + r() * 4;
      hl.moveTo(x0, y + 3 - t * 2); hl.quadraticCurveTo(x0 + 22 - t * 10, y - 3, 668 - t * 6, y + 6 + t * 6);
    }
    D.C.save(); D.C.clip(DON_HAIR); line(D, hl, 0.4, 0.14); D.C.restore();
    setGroup(D, null);
  }

  /* ------------------------------------------------------------------ the desk */
  function desk(D) {
    const C = D.C;
    const { fx0, fx1, bx0, bx1, ty0, ty1, my, by } = DESK;
    const top = poly([[bx0, ty0], [bx1, ty0], [fx1, ty1], [fx0, ty1]]);
    const front = rect(fx0, ty1, fx1 - fx0, by - ty1);
    D.deskTop = top; D.deskFront = front;
    tone(D, front, 0.9);
    // top surface: dark polished walnut, the far edge reflecting the window a little
    tone(D, top, 0.86);
    lift(D, top, grad(C, 0, ty0, 0, ty1, [[0, 0.24], [1, 0.04]]));
    lift(D, top, grad(C, fx0, 0, 600, 0, [[0, 0.25], [1, 0]]));
    hatch(D, top, [fx0, ty0, fx1, ty1], { ang: 0, sp: 1.8, w: 0.5, a: 0.18, jit: 0.4, maxLen: 120 });
    // the moulded edge of the top
    tone(D, rect(fx0 - 6, ty1, fx1 - fx0 + 12, my - ty1), 0.88);
    lift(D, rect(fx0 - 6, ty1, fx1 - fx0 + 12, 2.2), 0.42);
    lift(D, rect(fx0 - 6, ty1 + 9, fx1 - fx0 + 12, 1.4), 0.2);
    tone(D, rect(fx0, my, fx1 - fx0, 8), 0.95, 2);
    // panels: each moulding has a lit upper-left lip and a dark groove (light from the left)
    const pulls = new Path2D();
    const panel = (x0, y0, x1, y1, a) => {
      line(D, rect(x0, y0, x1 - x0, y1 - y0), 1.4, 0.7);
      eraseLine(D, poly([[x0 + 1.5, y1 - 1], [x0 + 1.5, y0 + 1.5], [x1 - 1, y0 + 1.5]], false), 1.1, a);
      eraseLine(D, poly([[x0 + 5, y1 - 4], [x1 - 5, y1 - 4], [x1 - 5, y0 + 5]], false), 0.8, a * 0.4);
    };
    panel(fx0 + 8, my + 10, fx1 - 8, my + 50, 0.22);
    for (const [a, b] of [[fx0 + 4, 452], [770, fx1 - 4]]) {
      panel(a, my + 54, b, by - 22, 0.16);
      for (const [y0, y1] of [[my + 62, 870], [876, 968], [974, 1026]]) {
        panel(a + 8, y0, b - 8, y1, 0.22);
        panel(a + 18, y0 + 9, b - 18, y1 - 9, 0.12);
        const cx = (a + b) / 2, cy = (y0 + y1) / 2 - 4;
        const bail = new Path2D(); bail.moveTo(cx - 12, cy - 2); bail.quadraticCurveTo(cx, cy + 12, cx + 12, cy - 2);
        pulls.addPath(bail); pulls.addPath(ell(cx - 13, cy - 3, 3, 3.6)); pulls.addPath(ell(cx + 13, cy - 3, 3, 3.6));
      }
    }
    for (const [a, b] of [[fx0 + 8, 452], [770, fx1 - 8]]) { const cx = (a + b) / 2, cy = my + 28; pulls.addPath(ell(cx, cy, 4, 4)); }
    // the kneehole, recessed and darkest, with a carved panel at its back
    const knee = rect(460, my + 54, 302, by - my - 76);
    tone(D, knee, 0.97);
    panel(482, my + 80, 740, my + 240, 0.08);
    const carv = cr([[611, my + 100], [650, my + 130], [700, my + 160], [650, my + 190], [611, my + 220], [572, my + 190], [522, my + 160], [572, my + 130]]);
    line(D, carv, 1, 0.45); eraseLine(D, moved(carv, -0.8, -0.8), 0.7, 0.08);
    D.pulls = pulls;
    tone(D, pulls, 0.9);
    line(D, pulls, 1.4, 0.95);
    eraseLine(D, moved(pulls, -0.7, -0.7), 0.7, 0.3);
    // plinth
    tone(D, rect(fx0 - 4, by - 22, fx1 - fx0 + 8, 22), 0.95);
    lift(D, rect(fx0 - 4, by - 22, fx1 - fx0 + 8, 1.6), 0.25);
    // the desk's shadow pooled on the floor and rug
    tone(D, poly([[fx0 - 10, by], [fx1 + 12, by], [fx1 + 30, by + 26], [fx0 - 30, by + 30]]), 0.55, 6);
    hatch(D, front, [fx0, ty1, fx1, by], { ang: 90, sp: 2.4, w: 0.6, a: 0.15, jit: 0.4, maxLen: 90 });
    hatch(D, front, [fx0, ty1, fx1, by], { ang: 30, sp: 3.6, w: 0.6, a: 0.1, jit: 0.4, maxLen: 90 });
  }

  async function lightDesk(D) {
    const bb = [500, 700, 1010, 1060];
    const db = bars(bb, 12);
    // only the top of the right pedestal is grazed; the face of the desk stays in the dark
    const int = (X) => rgrad(X, 960, 770, 10, 170, [[0, 0.8], [0.5, 0.3], [1, 0]], W3);
    light(D, { bb, mask: D.deskFront, bars: db, int, lift: 0.3, soft: 0.5 });
    light(D, { bb, mask: D.pulls, bars: db, int, lift: 0.9, chalk: 0.7 }); await D.tick();
    // the desk top: bars running into the depth
    const tb = flatBars(DESK.ty0, DESK.ty1 + 1, -0.4, 2.4, 0.14, 0.5, 0.02);
    const tint = (X) => rgrad(X, 760, 728, 20, 330, [[0, 1], [0.6, 0.6], [1, 0]], W3);
    light(D, { bb: [238, 700, 1000, 745], mask: D.deskTop, bars: tb, int: tint, lift: 0.5, chalk: 0.15, soft: 0.6 });
    light(D, { bb: [230, 740, 1000, 746], mask: rect(DESK.fx0 - 6, DESK.ty1, DESK.fx1 - DESK.fx0 + 12, 3), bars: db, int: tint, lift: 0.7, chalk: 0.5 });
  }

  /* ------------------------------------------------------------------ on the desk */
  function deskObjects(D) {
    const C = D.C, r = D.r;
    // papers under his hands: a letter, a sheet turned at an angle
    const p1 = poly([[570, 734], [700, 731], [712, 741], [574, 745]]);
    const p2 = poly([[604, 727], [694, 718], [700, 728], [610, 737]]);
    tone(D, p1, 0.4); lift(D, p1, 0.3); tone(D, p2, 0.35); lift(D, p2, 0.32);
    line(D, p2, 0.6, 0.5);
    D.papers = join(p1, p2);
    // a decanter of anisette and a small glass
    const dx = 546;
    const dec = cr([[dx - 10, 738, 1], [dx - 15, 722], [dx - 14, 704], [dx - 7, 694], [dx - 4, 682], [dx - 5, 670], [dx - 7, 666, 1], [dx + 3, 666, 1], [dx + 1, 670], [dx, 682], [dx + 3, 694], [dx + 10, 704], [dx + 11, 722], [dx + 6, 738, 1]]);
    tone(D, dec, 0.55); lift(D, dec, 0.12);
    tone(D, cr([[dx - 13, 718], [dx + 9, 718], [dx + 6, 738], [dx - 10, 738]]), 0.3);
    line(D, dec, 0.9, 0.7);
    tone(D, cr([[dx - 8, 666], [dx + 4, 666], [dx + 4, 658], [dx, 652], [dx - 4, 652], [dx - 8, 658]]), 0.85);
    D.decanter = dec;
    const gl = cr([[564, 739, 1], [563, 725], [574, 725], [573, 739, 1]]);
    tone(D, gl, 0.35); lift(D, gl, 0.15); line(D, gl, 0.7, 0.7);
    D.glass = gl;
    // a cigar box, its lid ajar
    const box = poly([[712, 738], [764, 738], [764, 721], [712, 721]]);
    tone(D, box, 0.75);
    const lid = poly([[710, 721], [766, 721], [770, 709], [714, 707]]);
    tone(D, lid, 0.82); line(D, box, 0.8, 0.8); line(D, lid, 0.8, 0.8);
    const label = rect(728, 725, 20, 9); lift(D, label, 0.25); line(D, label, 0.5, 0.4);
    for (let i = 0; i < 4; i++) tone(D, rect(716 + i * 12, 716, 10, 4), 0.6);
    D.box = join(box, lid);
    // telephone: a black cradle set
    const px = 798;
    const ph = cr([[px - 30, 737, 1], [px - 21, 710], [px + 21, 710], [px + 30, 737, 1]]);
    tone(D, ph, 0.95);
    const dial = ell(px, 725, 10, 6);
    lift(D, dial, 0.18); line(D, dial, 0.8, 0.8);
    for (let k = 0; k < 10; k++) { const a = -2.4 + k * 0.48; tone(D, ell(px + Math.cos(a) * 6.8, 725 + Math.sin(a) * 3.9, 1.1, 0.9), 0.9); }
    tone(D, join(poly([[px - 17, 710], [px - 13, 698], [px - 9, 710]]), poly([[px + 9, 710], [px + 13, 698], [px + 17, 710]])), 0.95);
    const hand = cr([[px - 37, 700], [px - 29, 692], [px - 19, 694], [px + 21, 694], [px + 33, 692], [px + 41, 700], [px + 37, 706], [px + 27, 702], [px - 25, 702], [px - 33, 706]]);
    tone(D, hand, 0.97);
    lift(D, cr([[px - 27, 694], [px + 27, 694], [px + 25, 696], [px - 25, 696]]), 0.35);
    line(D, cr([[px + 30, 734], [px + 36, 744], [px + 30, 760], [px + 38, 790]], false), 1.2, 0.8);
    D.phone = join(ph, hand);
    // the lamp: brass column, fabric shade, switched off
    const lx = 858;
    const base = ell(lx, 738, 22, 5.5);
    const column = cr([[lx - 4, 736, 1], [lx - 5, 700], [lx - 3, 660], [lx - 4, 624, 1], [lx + 4, 624, 1], [lx + 3, 660], [lx + 5, 700], [lx + 4, 736, 1]]);
    const shade = cr([[lx - 22, 574, 1], [lx + 22, 574, 1], [lx + 38, 626, 1], [lx - 38, 626, 1]]);
    tone(D, base, 0.85); tone(D, column, 0.85); tone(D, shade, 0.8);
    lift(D, ell(lx, 735, 21, 2.6), 0.2);
    line(D, shade, 1.1, 0.8);
    hatch(D, shade, [lx - 40, 572, lx + 40, 628], { ang: 95, sp: 3.4, w: 0.6, a: 0.3, jit: 0.3 });
    tone(D, ell(lx, 626, 37, 3.6), 0.9);
    D.shade = shade; D.column = join(column, base);
    // the bowl of oranges, one gone
    const bx = 930;
    const bowl = cr([[bx - 44, 706, 1], [bx + 44, 706, 1], [bx + 38, 718], [bx + 24, 728], [bx + 10, 731], [bx + 7, 738, 1], [bx - 7, 738, 1], [bx - 10, 731], [bx - 24, 728], [bx - 38, 718]]);
    const ors = [[bx - 26, 694, 16], [bx + 2, 690, 16.5], [bx + 27, 696, 15.5], [bx - 13, 671, 15.5], [bx + 15, 671, 15]];
    if (r() < 0.5) ors.push([bx + 1, 652, 14.5]);
    const orP = new Path2D();
    ors.forEach(([x, y, rr]) => orP.addPath(ell(x, y, rr, rr * 0.97)));
    for (const [x, y, rr] of ors) {
      const o = ell(x, y, rr, rr * 0.97);
      tone(D, o, 0.88);
      lift(D, o, rgrad(C, x - rr * 0.4, y - rr * 0.45, rr * 0.05, rr * 1.1, [[0, 0.42], [0.6, 0.16], [1, 0]]));
      line(D, o, 0.8, 0.7);
      tone(D, ell(x + rr * 0.25, y - rr * 0.8, 1.6, 1.1), 0.9); // the stem end
    }
    tone(D, bowl, 0.9);
    lift(D, cr([[bx - 42, 707], [bx + 42, 707], [bx + 40, 710], [bx - 40, 710]]), 0.45);
    line(D, bowl, 0.9, 0.8);
    D.bowl = bowl; D.oranges = ors; D.orP = orP;
    const leaf = cr([[bx + 40, 704], [bx + 50, 697], [bx + 62, 699], [bx + 52, 707]]);
    tone(D, leaf, 0.7); line(D, seg(bx + 41, 704, bx + 60, 699), 0.5, 0.6);
    // contact shadows on the desk top
    tone(D, ell(bx, 739, 36, 3), 0.6, 1.4);
    tone(D, ell(lx, 741, 26, 2.4), 0.6, 1.2);
    tone(D, ell(px, 739, 30, 2.4), 0.6, 1.2);
  }

  async function lightObjects(D) {
    const bb = [500, 560, 1010, 760];
    const db = bars(bb, 12);
    const int = (X) => rgrad(X, 820, 680, 30, 320, [[0, 1], [0.7, 0.75], [1, 0.4]], W3);
    for (const m of [D.orP, D.bowl, D.box, D.phone]) light(D, { bb, mask: m, int, lift: 0.22, streak: false, soft: 1 });
    await D.tick();
    light(D, { bb, mask: D.papers, bars: bars(bb, 9), int: (X) => grad(X, 560, 0, 712, 0, [[0, 0.6], [0.3, 1], [1, 0.9]], W3), lift: 0.9, chalk: 0.65, soft: 0.4 });
    light(D, { bb, mask: D.orP, bars: db, int, lift: 0.85, chalk: 0.55, soft: 0.4 }); await D.tick();
    light(D, { bb, mask: D.bowl, bars: db, int, lift: 0.5, chalk: 0.3, soft: 0.4 });
    light(D, { bb, mask: D.shade, bars: db, int, lift: 0.45, chalk: 0.12, soft: 0.4 });
    light(D, { bb, mask: D.column, bars: db, int, lift: 0.6, chalk: 0.5 }); await D.tick();
    light(D, { bb, mask: D.box, bars: db, int, lift: 0.55, chalk: 0.15, soft: 0.4 });
    light(D, { bb, mask: D.phone, bars: db, int, lift: 0.45, chalk: 0.35 });
    // the glass things glint
    const gl1 = cr([[533, 704], [535, 700], [536, 720], [534, 728]]);
    lift(D, gl1, 0.5, 0.3); chalk(D, gl1, 0.8, 0.3);
    lift(D, cr([[548, 668], [551, 672], [551, 690], [549, 694]]), 0.3, 0.4);
    chalk(D, rect(565, 727, 1.4, 11), 0.65, 0.3);
    chalk(D, ell(542, 672, 1.2, 4), 0.6, 0.3);
    lift(D, cr([[534, 720], [556, 720], [553, 724], [536, 724]]), 0.35, 0.5); // the meniscus of the anisette
    for (const [x, y, rr] of D.oranges) line(D, ell(x - rr * 0.35, y - rr * 0.45, rr * 0.2, rr * 0.12), 0.5, 0.15, D.K);
  }

  // the Don's hands, calm, loosely clasped on the papers (group coordinates)
  function donHands(D) {
    setGroup(D, DONM);
    const sleeveL = cr([[512, 690], [548, 690], [572, 700], [572, 730], [520, 734], [510, 712]]);
    const sleeveR = cr([[744, 690], [710, 688], [672, 698], [672, 728], [740, 730], [746, 712]]);
    tone(D, join(sleeveL, sleeveR), 0.96);
    hatch(D, join(sleeveL, sleeveR), [505, 685, 750, 736], { ang: 15, sp: 2.6, w: 0.6, a: 0.2 });
    const cuffL = cr([[576, 702], [585, 701], [587, 726], [578, 728]]);
    const cuffR = cr([[659, 700], [668, 701], [667, 725], [658, 724]]);
    tone(D, join(cuffL, cuffR), 0.62);
    // the two hands rest on the papers, palms down, fingers loosely curled toward us, the thumbs almost touching
    const handA = cr([[578, 707], [588, 699], [602, 696], [614, 697], [624, 701], [630, 708], [631, 718], [627, 728], [619, 734], [606, 737], [594, 736], [584, 731], [579, 722]]);
    const handB = cr([[668, 705], [658, 698], [646, 696], [636, 698], [629, 703], [627, 710], [629, 720], [635, 729], [645, 735], [656, 735], [664, 730], [668, 720]]);
    tone(D, join(handA, handB), 0.8);
    D.hands = join(handA, handB); D.cuffs = join(cuffL, cuffR);
    D.handLines = () => {
      tone(D, cr([[584, 734], [612, 738], [640, 738], [666, 734], [668, 739], [640, 742], [600, 742]]), 0.5, 1.4); // their shadow on the paper
      line(D, handA, 0.6, 0.45); line(D, handB, 0.6, 0.45);
      const fl = new Path2D(); // the divisions between the curled fingers
      for (const [x, d] of [[603, -0.5], [610, -0.5], [617, -0.55], [643, 0.5], [636, 0.5], [629, 0.55]]) { fl.moveTo(x + d * 8, 716); fl.quadraticCurveTo(x, 726, x + d * -2, 736); }
      line(D, fl, 0.55, 0.4, null, 0.2);
      tone(D, ell(641, 714, 3.2, 1.8, 0.4), 0.92); D.ring = ell(640.3, 713.4, 1.4, 0.8, 0.4); // a heavy gold ring
    };
    setGroup(D, null);
  }
  const HAND_BUMPS = [
    [600, 707, 17, 8, 7], [646, 707, 17, 8, 7],                                                   // the backs of the hands
    [592, 706, 8, 0.9, 1, 0.1], [598, 709, 9, 0.9, 1, 0.15], [652, 706, 8, 0.9, 1, -0.1], [648, 709, 9, 0.9, 1, -0.15], // tendons
    [607, 713, 2.6, 2.6, 2.2], [613, 713, 2.6, 2.6, 2.2], [619, 712, 2.6, 2.6, 2], [639, 713, 2.6, 2.6, 2.2], [633, 713, 2.6, 2.6, 2.2], [627, 712, 2.6, 2.6, 2], // knuckles
    [604, 726, 3.2, 8, 4.2, -0.5], [611, 727, 3.2, 8, 4.2, -0.5], [618, 726, 3, 7, 4, -0.55], [623, 722, 2.8, 5.5, 3.4, -0.6], // fingers, A
    [642, 726, 3.2, 8, 4.2, 0.5], [635, 727, 3.2, 8, 4.2, 0.5], [628, 726, 3, 7, 4, 0.55], [624, 722, 2.8, 5.5, 3.4, 0.6],     // fingers, B
    [616, 701, 9, 3, 4, -0.3], [630, 701, 9, 3, 4, 0.3]];                                         // thumbs
  function lightHands(D) {
    setGroup(D, DONM);
    const bb = [540, 680, 700, 744];
    const hb = bars(bb, 9, 22, 0.56);
    relief(D, { mask: D.hands, bb: [574, 692, 672, 742], bumps: HAND_BUMPS, bars: { ang: BAR.ang, per: 22, duty: 0.56, phase: 9 }, shadowLen: 10, amb: 0.14, gain: 0.95, chalkFrom: 0.62 });
    light(D, { bb, mask: D.cuffs, bars: hb, lift: 0.7, chalk: 0.4, soft: 0.4 });
    light(D, { bb, mask: D.cuffs, lift: 0.2, streak: false });
    D.handLines();
    light(D, { bb, mask: D.ring, lift: 1, chalk: 1, streak: false });
    setGroup(D, null);
  }

  /* ------------------------------------------------------------------ Amerigo Bonasera, bending over the desk */
  // in profile, bending from the hips toward the Don: the bowed face cut out against the bright window,
  // the long curve of the back, both forearms laid on the edge of the desk
  const BON = cr([
    [354, 650], [342, 626], [336, 600], [342, 578], [358, 563], [378, 558], [398, 563], [410, 576], [414, 588], [412, 595, 1], [418, 604], [428, 617], [428, 621, 1],
    [420, 624], [418, 630], [415, 633, 1], [418, 638], [414, 647], [406, 655], [394, 660], [394, 672],                       // the head in profile
    [412, 684], [430, 704], [448, 722], [470, 734], [488, 740], [502, 741], [516, 748], [512, 754], [494, 754], [478, 752], [458, 748], [440, 746], // the near arm on the desk
    [420, 764], [404, 806], [386, 852], [366, 896], [346, 924],                                                            // the belly under the arm
    [338, 972], [334, 1030], [330, 1092], [322, 1160], [318, 1226], [336, 1238], [364, 1252], [366, 1264, 1], [302, 1266, 1], [300, 1246], [302, 1232], [306, 1160], // front leg
    [302, 1110, 1], [290, 1160], [286, 1236], [300, 1250], [314, 1260], [314, 1270, 1], [246, 1272, 1], [246, 1252], [254, 1234], [260, 1160], [266, 1095], [266, 1020], // back leg
    [258, 950], [258, 908], [266, 860], [278, 800], [296, 742], [318, 702], [340, 676]]);                                      // the back
  const BON_HAT = cr([[238, 738, 1], [240, 722], [246, 712], [258, 707], [268, 712], [280, 706], [292, 712], [298, 724], [300, 738, 1]]);

  function bonasera(D) {
    const C = D.C;
    // his hat, left on the corner of the desk
    tone(D, ell(268, 739, 40, 4), 0.85); tone(D, BON_HAT, 0.92);
    eraseLine(D, cr([[230, 739], [268, 735], [308, 739]], false), 1.2, 0.3, 0.4);
    line(D, cr([[241, 728], [268, 725], [297, 728]], false), 2.4, 0.85);
    eraseLine(D, cr([[244, 716], [258, 709], [268, 713]], false), 1, 0.18, 0.6);
    tone(D, ell(310, 1270, 120, 13), 0.55, 6); // where he stands
    tone(D, BON, 0.985);
    hatch(D, BON, [240, 556, 520, 1275], { ang: 68, sp: 2.8, w: 0.6, a: 0.1, jit: 0.4 });
    // seams and folds of the black suit: long, very low lifts, so the black is a body and not a hole
    const folds = [
      [[[356, 664], [372, 690], [396, 712], [430, 732]], 1.5, 0.1],     // the shoulder into the arm
      [[[392, 716], [404, 742], [436, 748]], 1.3, 0.1],                 // elbow
      [[[300, 736], [286, 790], [274, 850], [266, 900]], 2.2, 0.06],    // the long back
      [[[262, 912], [300, 924], [346, 926]], 1.4, 0.1],                 // jacket hem
      [[[322, 960], [316, 1060], [310, 1100]], 1.6, 0.06],              // the near thigh
      [[[296, 1130], [294, 1180], [296, 1228]], 1.4, 0.06],
    ];
    for (const [pts, w, a] of folds) eraseLine(D, cr(pts, false), w, a, 1.2);
    eraseLine(D, cr([[322, 1236], [344, 1244], [362, 1254]], false), 1.4, 0.22, 0.4); // polished shoes
    eraseLine(D, cr([[262, 1250], [286, 1254], [310, 1262]], false), 1.4, 0.18, 0.4);
    // the white collar and cuff
    lift(D, cr([[352, 652], [366, 662], [386, 668], [394, 666], [394, 674], [380, 676], [362, 670], [348, 660]]), 0.42);
    lift(D, cr([[478, 735], [488, 733], [492, 748], [480, 750]]), 0.5);
    const bhand = cr([[490, 736], [504, 738], [516, 746], [512, 753], [498, 755], [486, 750]]);
    lift(D, bhand, 0.3, 0.6);
    line(D, cr([[496, 746], [508, 750]], false), 0.6, 0.6);
    // the ear, hair combed flat with brilliantine
    const ear = cr([[360, 596], [367, 592], [372, 600], [370, 614], [363, 618], [359, 608]]);
    lift(D, ear, 0.16, 0.6); line(D, cr([[363, 599], [368, 600], [366, 611]], false), 0.7, 0.5);
    const hl = new Path2D();
    for (let i = 0; i < 6; i++) { hl.moveTo(400 - i * 4, 566 + i * 3); hl.quadraticCurveTo(366 - i * 2, 568 + i * 5, 346 - i, 600 + i * 6); }
    eraseLine(D, hl, 0.6, 0.12);
    // a little reflected light gives the face a hint of its features, sunk in shadow
    lift(D, cr([[398, 576], [410, 584], [414, 600], [424, 616], [416, 626], [412, 640], [402, 650], [394, 640], [400, 620], [396, 598]]), 0.1, 2);
    tone(D, ell(404, 598, 3.4, 1.6, 0.4), 0.5);
    // the window light behind him burns a rim along the whole profile: brow, nose, lips, chin, the crown and nape
    const rimZone = rect(GL.x0, GL.y0, GL.x1 - GL.x0, OPEN.y1 - GL.y0 + 12);
    for (const [ctx, mode, a] of [[D.C, 'destination-out', 0.9], [D.K, 'source-over', 0.75]]) {
      ctx.save(); ctx.clip(BON); ctx.clip(rimZone); ctx.globalCompositeOperation = mode;
      ctx.filter = `blur(${(0.45 * D.S).toFixed(2)}px)`;
      ctx.lineWidth = 2.2; ctx.strokeStyle = mode === 'source-over' ? wht(1) : blk(1); ctx.globalAlpha = a;
      ctx.stroke(BON); ctx.restore();
    }
    // the reflected light from the floor finds the back of his legs
    eraseLine(D, cr([[262, 1010], [262, 1100], [256, 1236]], false), 1.6, 0.08, 1.2);
    D.bonHand = bhand;
  }

  /* ================================================================== printing onto the paper */
  function makeTooth(seed) {
    const N = 512, r = mulberry32(seed ^ 0x9e3779b9);
    let a = new Float32Array(N * N);
    for (let i = 0; i < a.length; i++) a[i] = r();
    const pass = (src, horiz) => {
      const out = new Float32Array(N * N);
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        let s = 0;
        for (let k = -1; k <= 1; k++) s += (horiz ? src[y * N + ((x + k + N) % N)] : src[((y + k + N) % N) * N + x]) * (k ? 1 : 2);
        out[y * N + x] = s / 4;
      }
      return out;
    };
    a = pass(pass(a, true), false);
    a = pass(pass(a, true), false);
    let mn = 1, mx = 0; for (const v of a) { if (v < mn) mn = v; if (v > mx) mx = v; }
    for (let i = 0; i < a.length; i++) a[i] = (a[i] - mn) / (mx - mn);
    return a;
  }

  async function printSheet(D, out, tick) {
    const { w, h, S } = D;
    const tooth = makeTooth(D.seed);
    const r = mulberry32(D.seed ^ 0x51ed);
    const MG = 24, mott = new Float32Array(MG * MG); for (let i = 0; i < mott.length; i++) mott[i] = r();
    const laid = Math.max(2.4, 1.7 * S);          // laid-line period in device pixels
    const chain = Math.round(52 * S);
    // a hand-drawn edge: every mark is displaced by a slow, small wobble as it is printed onto the tooth
    const DG = 40, dgx = new Float32Array(DG * DG), dgy = new Float32Array(DG * DG);
    for (let i = 0; i < DG * DG; i++) { dgx[i] = r() * 2 - 1; dgy[i] = r() * 2 - 1; }
    const cell = 12 * S, amp = 0.42 * S, M = Math.ceil(amp) + 1;
    const rows = Math.max(16, Math.floor(240000 / w));
    for (let y0 = 0; y0 < h; y0 += rows) {
      const hh = Math.min(rows, h - y0);
      const ya = Math.max(0, y0 - M), yb = Math.min(h, y0 + hh + M), sh = yb - ya;
      const cd = D.C.getImageData(0, ya, w, sh).data;
      const kd = D.K.getImageData(0, ya, w, sh).data;
      const img = out.createImageData(w, hh), od = img.data;
      for (let yy = 0; yy < hh; yy++) {
        const y = y0 + yy;
        const my = (y / h) * (MG - 1), myi = Math.floor(my), myf = my - myi;
        const lw = Math.sin((y / laid) * TAU);
        const gy = y / cell, gyi = Math.floor(gy), gyf = gy - gyi, gy0 = (gyi % DG) * DG, gy1 = ((gyi + 1) % DG) * DG;
        const sy = gyf * gyf * (3 - 2 * gyf);
        for (let x = 0; x < w; x++) {
          const i = (yy * w + x) * 4;
          let t = tooth[(y & 511) * 512 + (x & 511)] * 0.78 + 0.11 + lw * 0.13;
          if (x % chain < 2) t -= 0.12;
          t = t < 0 ? 0 : t > 1 ? 1 : t;
          const gx = x / cell, gxi = Math.floor(gx), gxf = gx - gxi, gx0 = gxi % DG, gx1 = (gxi + 1) % DG;
          const sx = gxf * gxf * (3 - 2 * gxf);
          const ox = ((dgx[gy0 + gx0] * (1 - sx) + dgx[gy0 + gx1] * sx) * (1 - sy) + (dgx[gy1 + gx0] * (1 - sx) + dgx[gy1 + gx1] * sx) * sy) * amp;
          const oy = ((dgy[gy0 + gx0] * (1 - sx) + dgy[gy0 + gx1] * sx) * (1 - sy) + (dgy[gy1 + gx0] * (1 - sx) + dgy[gy1 + gx1] * sx) * sy) * amp;
          let qx = (x + ox + 0.5) | 0, qy = (y + oy + 0.5) | 0;
          qx = qx < 0 ? 0 : qx >= w ? w - 1 : qx; qy = qy < ya ? ya : qy >= yb ? yb - 1 : qy;
          const j = ((qy - ya) * w + qx) * 4;
          const d = cd[j + 3] / 255, k = kd[j + 3] / 255;
          const cov = d <= 0 ? 0 : Math.pow(d, 0.7 + 0.85 * (1 - t));
          const kc = k <= 0 ? 0 : Math.pow(k, 0.62 + 0.9 * (1 - t)) * 0.94;
          const mx = (x / w) * (MG - 1), mxi = Math.floor(mx), mxf = mx - mxi;
          const m00 = mott[myi * MG + mxi], m10 = mott[myi * MG + Math.min(MG - 1, mxi + 1)], m01 = mott[Math.min(MG - 1, myi + 1) * MG + mxi], m11 = mott[Math.min(MG - 1, myi + 1) * MG + Math.min(MG - 1, mxi + 1)];
          const m = (m00 * (1 - mxf) + m10 * mxf) * (1 - myf) + (m01 * (1 - mxf) + m11 * mxf) * myf;
          const pv = 1 + (m - 0.5) * 0.05 + (t - 0.5) * 0.035;
          let R = 203 * pv, G = 196 * pv, B = 181 * pv;
          R = R + (25 - R) * cov; G = G + (23 - G) * cov; B = B + (22 - B) * cov;
          R = R + (250 - R) * kc; G = G + (247 - G) * kc; B = B + (238 - B) * kc;
          od[i] = R; od[i + 1] = G; od[i + 2] = B; od[i + 3] = 255;
        }
      }
      out.putImageData(img, 0, y0);
      if (!(await tick())) return false;
    }
    return true;
  }

  /* ================================================================== the sequence */
  const STEPS = [
    groundTone, wallSurface, windowFrame, garden, blindAndSash, windowSill, shutters, wallObjects, bookshelf, lightWall,
    floor, lightFloor, hagen, chair, lightChair, don, lightDon, donFeatures, desk, lightDesk, deskObjects, lightObjects, donHands, lightHands, bonasera,
  ];

  async function render(S, seed, out, tick) {
    const D = makeSheet(S, seed);
    let alive = true;
    let last = performance.now(), worst = 0, worstAt = '';
    D.tick = async () => {
      const now = performance.now(); if (now - last > worst) { worst = now - last; worstAt = D.at; }
      if (!(await tick())) { alive = false; throw new Error('cancelled'); }
      last = performance.now();
    };
    const times = [];
    try {
      for (const step of STEPS) {
        const t0 = performance.now();
        D.at = step.name;
        await step(D);
        times.push(step.name + ':' + Math.round(performance.now() - t0));
        await D.tick();
      }
    } catch (e) { if (alive) throw e; return null; }
    out.canvas.width = D.w; out.canvas.height = D.h;
    const ok = await printSheet(D, out, tick);
    if (!ok) return null;
    out.setTransform(S, 0, 0, S, 0, 0);
    if (window.FamilyOrange) window.FamilyOrange.drawSeamOranges(out, false, true);
    out.setTransform(1, 0, 0, 1, 0, 0);
    D.C.canvas.width = D.K.canvas.width = D.X.canvas.width = D.M.canvas.width = 1; // free memory
    if (/[?&]debug/.test(location.search)) console.warn('wedding steps', times.join(' '), '| longest block', Math.round(worst), worstAt);
    return D;
  }

  /* ================================================================== registration */
  (window.PIECES = window.PIECES || []).push({
    id: 'wedding',
    title: 'A Favour on the Wedding Day',
    medium: 'Charcoal and white chalk on grey laid paper',
    note: 'One orange has rolled off the desk.',
    about: 'August 1945: while Connie Corleone’s wedding blazes white beyond the window, the Don hears the undertaker Bonasera in the shuttered study, the sun through the slats laid across his face in bars. An original interpretation of Puzo’s novel, not the film, drawn as a tenebrist charcoal: velvet blacks, light lifted out with the eraser, and one orange, the only colour, rolling toward the next picture.',
    tone: 'dark',
    room: '#14110e',
    mount(el, api) {
      const EXPORT = /[?&]export/.test(location.search);
      el.style.cssText += ';background:' + (EXPORT ? '#000' : 'radial-gradient(ellipse at 50% 42%, #2a241e 0%, #15120f 60%, #0c0a08 100%)') + ';overflow:hidden';
      const cv = document.createElement('canvas');
      const out = cv.getContext('2d');
      cv.style.cssText = 'position:absolute;display:block;' + (EXPORT ? '' : 'box-shadow:0 2px 6px rgba(0,0,0,.5),0 18px 60px rgba(0,0,0,.55);');
      el.appendChild(cv);
      let alive = true, job = 0, lastKey = '', readyCalled = false, timer = 0;
      const tick = (my) => () => new Promise((res) => requestAnimationFrame(() => res(alive && my === job && api.isCurrent())));

      function layout() {
        const vw = el.clientWidth || window.innerWidth, vh = el.clientHeight || window.innerHeight;
        let cw, ch;
        if (EXPORT) { cw = vw; ch = vh; }
        else {
          const m = vw < 600 ? 0.94 : 0.86;
          const s = Math.min((vw * m) / W, (vh * (vw < 600 ? 0.8 : 0.9)) / H);
          cw = Math.round(W * s); ch = Math.round(H * s);
        }
        cv.style.width = cw + 'px'; cv.style.height = ch + 'px';
        cv.style.left = Math.round((vw - cw) / 2) + 'px'; cv.style.top = Math.round((vh - ch) / 2 - (EXPORT ? 0 : Math.min(12, vh * 0.01))) + 'px';
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        return Math.min(2, (cw * dpr) / W);
      }
      async function go() {
        const S = layout();
        const key = S.toFixed(2);
        if (key === lastKey) return;
        lastKey = key;
        const my = ++job;
        const seed = api.seed >>> 0;
        if (!EXPORT && !readyCalled) {
          // a quick small proof first, so the room never waits in the dark
          const proof = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
          const res = await render(Math.min(S, 0.4), seed, proof, tick(my));
          if (!res) return;
          cv.width = proof.canvas.width; cv.height = proof.canvas.height; out.drawImage(proof.canvas, 0, 0);
          readyCalled = true; api.ready();
        }
        const buf = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
        const res = await render(S, seed, buf, tick(my));
        if (!res) return;
        cv.width = buf.canvas.width; cv.height = buf.canvas.height; out.drawImage(buf.canvas, 0, 0);
        buf.canvas.width = 1;
        if (!readyCalled) { readyCalled = true; api.ready(); }
        if (EXPORT) document.documentElement.dataset.exportReady = '1';
      }
      const ro = new ResizeObserver(() => {
        layout();
        clearTimeout(timer);
        timer = setTimeout(() => { if (alive) go(); }, 450);
      });
      ro.observe(el);
      go();
      return {
        destroy() { alive = false; job++; clearTimeout(timer); ro.disconnect(); cv.width = cv.height = 1; },
      };
    },
  });
})();
