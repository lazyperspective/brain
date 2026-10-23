/* The Beacons — a sixty-second animated drawing in ink, watercolour and gouache.
 * Every frame is a pure function of time: drawFrame(t), t in [0, 60].
 * Heavy painted layers are made once (chunked) into offscreen canvases; each frame composites them
 * through a parallax camera and draws the living parts (keeper, fire, sparks, smoke, snow) on top.
 */
(function () {
  'use strict';

  /* ================================================================== constants & small maths */
  const W = 1080, H = 1350, DUR = 60, HOLD = 3.5;
  const PI = Math.PI, TAU = PI * 2;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const fract = (x) => x - Math.floor(x);
  const EZ = {
    lin: (t) => t,
    io: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
    io2: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
    o: (t) => 1 - Math.pow(1 - t, 3),
    o2: (t) => 1 - (1 - t) * (1 - t),
    i: (t) => t * t * t,
    i2: (t) => t * t,
    s: (t) => -(Math.cos(PI * t) - 1) / 2,
    back: (t) => { const c1 = 1.5, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
  };
  // keyframe track: keys = [[t, value, easeName], ...]; ease applies to the segment ending at that key
  function track(keys, t) {
    if (t <= keys[0][0]) return keys[0][1];
    for (let i = 1; i < keys.length; i++) {
      const k = keys[i];
      if (t <= k[0]) {
        const a = keys[i - 1], u = (t - a[0]) / (k[0] - a[0]);
        const e = EZ[k[2] || 'io'](u);
        return lerp(a[1], k[1], e);
      }
    }
    return keys[keys.length - 1][1];
  }
  // pose track: keys = [[t, poseObj, ease], ...]
  function trackObj(keys, t) {
    if (t <= keys[0][0]) return Object.assign({}, keys[0][1]);
    for (let i = 1; i < keys.length; i++) {
      const k = keys[i];
      if (t <= k[0]) {
        const a = keys[i - 1], u = (t - a[0]) / (k[0] - a[0]);
        const e = EZ[k[2] || 'io'](u), o = {};
        for (const key in k[1]) o[key] = lerp(a[1][key] !== undefined ? a[1][key] : k[1][key], k[1][key], e);
        return o;
      }
    }
    return Object.assign({}, keys[keys.length - 1][1]);
  }

  /* ================================================================== seeded randomness & noise */
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  let SEED = 7;
  function hh(n) {
    n = (n ^ 0x9e3779b9) >>> 0;
    n = Math.imul(n ^ (n >>> 16), 0x85ebca6b);
    n = Math.imul(n ^ (n >>> 13), 0xc2b2ae35);
    n ^= n >>> 16;
    return (n >>> 0) / 4294967296;
  }
  const hr = (i, k) => hh((i * 7919 + k * 104729 + SEED * 15485863) | 0);
  let PERM = null, GRAD = null;
  function initNoise(seed) {
    const r = mulberry32(seed ^ 0x5bd1e995);
    PERM = new Uint8Array(512); GRAD = new Float32Array(256);
    const p = []; for (let i = 0; i < 256; i++) p.push(i);
    for (let i = 255; i > 0; i--) { const j = (r() * (i + 1)) | 0; const tmp = p[i]; p[i] = p[j]; p[j] = tmp; }
    for (let i = 0; i < 512; i++) PERM[i] = p[i & 255];
    for (let i = 0; i < 256; i++) GRAD[i] = r() * 2 - 1;
  }
  function n2(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const X = xi & 255, Y = yi & 255;
    const a = GRAD[PERM[PERM[X] + Y]], b = GRAD[PERM[PERM[X + 1] + Y]];
    const c = GRAD[PERM[PERM[X] + Y + 1]], d = GRAD[PERM[PERM[X + 1] + Y + 1]];
    return lerp(lerp(a, b, u), lerp(c, d, u), v);
  }
  const n1 = (x) => n2(x, 17.31);
  function fbm(x, y, o) { let s = 0, a = 0.5, f = 1; for (let i = 0; i < (o || 4); i++) { s += a * n2(x * f, y * f); f *= 2.03; a *= 0.5; } return s; }

  /* ================================================================== colour */
  function hex(h) { h = h.replace('#', ''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; }
  function rgba(c, a) { return 'rgba(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ',' + (a === undefined ? 1 : a) + ')'; }
  const C = (h, a) => rgba(hex(h), a);
  const mixc = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
  const mixh = (a, b, t, al) => rgba(mixc(hex(a), hex(b), t), al);

  /* ================================================================== canvases */
  function mk(w, h) { const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c; }
  // paint in software (fast for thousands of small strokes), composite from GPU copies
  const cpu = (c) => c.getContext('2d', { willReadFrequently: true });
  let ALLCPU = false;
  const ctx2 = (c) => (ALLCPU ? cpu(c) : c.getContext('2d'));
  function gpu(c) { if (ALLCPU) return c; const t = mk(c.width, c.height); t.getContext('2d').drawImage(c, 0, 0); return t; }
  // a painter maps world units -> pixels at resolution R
  function painter(x0, y0, w, h, R) {
    const c = mk(w * R, h * R), g = cpu(c);
    const P = { c, g, R, ox: x0, oy: y0, w, h };
    P.reset = () => { g.setTransform(R, 0, 0, R, -x0 * R, -y0 * R); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; g.filter = 'none'; };
    P.reset();
    return P;
  }
  // split a painter into GPU-friendly tiles; returns a layer
  function toLayer(P, p, extra) {
    const maxPx = 3800, tiles = [];
    const n = Math.max(1, Math.ceil(P.c.width / maxPx));
    if (n === 1) tiles.push({ c: gpu(P.c), x: P.ox, w: P.w });
    else {
      const tw = Math.ceil(P.c.width / n);
      for (let i = 0; i < n; i++) {
        const sx = i * tw, sw = Math.min(tw, P.c.width - sx);
        const t = mk(sw, P.c.height); ctx2(t).drawImage(P.c, -sx, 0);
        tiles.push({ c: t, x: P.ox + sx / P.R, w: sw / P.R });
      }
    }
    return Object.assign({ tiles, x0: P.ox, y0: P.oy, w: P.w, h: P.h, p, R: P.R }, extra || {});
  }

  /* ================================================================== geometry helpers */
  function catmull(pts, seg, closed) {
    const out = [], n = pts.length;
    if (n < 3) return pts.slice();
    const get = (i) => (closed ? pts[(i + n) % n] : pts[clamp(i, 0, n - 1)]);
    const last = closed ? n : n - 1;
    for (let i = 0; i < last; i++) {
      const p0 = get(i - 1), p1 = get(i), p2 = get(i + 1), p3 = get(i + 2);
      for (let s = 0; s < seg; s++) {
        const t = s / seg, t2 = t * t, t3 = t2 * t;
        out.push([
          0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
          0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
        ]);
      }
    }
    if (!closed) out.push(pts[n - 1].slice());
    return out;
  }
  function resample(pts, step, closed) {
    const src = closed ? pts.concat([pts[0]]) : pts;
    const out = [src[0].slice()];
    let acc = 0;
    for (let i = 1; i < src.length; i++) {
      const a = src[i - 1], b = src[i];
      const d = Math.hypot(b[0] - a[0], b[1] - a[1]);
      let pos = step - acc;
      while (pos <= d) { const u = pos / d; out.push([lerp(a[0], b[0], u), lerp(a[1], b[1], u)]); pos += step; }
      acc = (acc + d) % step;
    }
    if (!closed) out.push(src[src.length - 1].slice());
    return out;
  }
  function bbox(pts) {
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const p of pts) { if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0]; if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1]; }
    return [x0, y0, x1, y1];
  }
  function polyPath(g, pts, closed) {
    g.beginPath(); g.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
    if (closed !== false) g.closePath();
  }
  function ellipsePts(cx, cy, rx, ry, n, rng, jit) {
    const o = [];
    for (let i = 0; i < n; i++) { const a = (i / n) * TAU; const k = 1 + (rng ? (rng() - 0.5) * (jit || 0.2) : 0); o.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]); }
    return o;
  }
  function offsetPts(pts, dx, dy) { return pts.map((p) => [p[0] + dx, p[1] + dy]); }

  /* ================================================================== textures */
  const TEX = {}, A = {};
  function makeTextures(rng) {
    const S = 384;
    // granulation: dark pigment settling in the paper's valleys
    const mkTex = (fn, size) => {
      const c = mk(size, size), g = cpu(c);
      const id = g.createImageData(size, size), d = id.data;
      for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
        const v = fn(x, y, size); const i = (y * size + x) * 4;
        d[i] = v[0]; d[i + 1] = v[1]; d[i + 2] = v[2]; d[i + 3] = v[3];
      }
      g.putImageData(id, 0, 0);
      return c;
    };
    // tileable noise via periodic sampling on a torus-ish domain
    const tn = (x, y, size, sc) => {
      const fx = x / size, fy = y / size;
      const a = fbm(fx * sc, fy * sc, 3), b = fbm((fx - 1) * sc, fy * sc, 3), c = fbm(fx * sc, (fy - 1) * sc, 3), d = fbm((fx - 1) * sc, (fy - 1) * sc, 3);
      return lerp(lerp(a, b, fx), lerp(c, d, fx), fy);
    };
    TEX.gran = mkTex((x, y, s) => {
      const valley = sstep(0.0, 0.32, -tn(x, y, s, 48));
      const w = rng();
      const a = clamp(valley * (0.35 + 0.9 * w) * 0.9 + (w > 0.985 ? 0.6 : 0), 0, 1);
      return [20, 16, 30, a * 255];
    }, S);
    TEX.tooth = mkTex((x, y, s) => {
      const peak = sstep(0.05, 0.3, tn(x + 31, y + 7, s, 56));
      const w = rng();
      return [255, 255, 255, clamp(peak * (0.4 + w * 0.8), 0, 1) * 255];
    }, S);
    TEX.bloom = mkTex((x, y, s) => {
      const v = tn(x, y, s, 5) + 0.35 * tn(x + 99, y + 3, s, 22);
      const a = sstep(0.06, 0.22, v) * (1 - sstep(0.22, 0.45, v) * 0.6);
      return [255, 255, 255, a * 255];
    }, S);
    // paper: mostly white; fibres, grain and soft mottling, multiplied over the whole frame
    const PS = 768;
    const paper = mkTex((x, y, s) => {
      const m = tn(x, y, s, 6) * 10 + tn(x + 5, y + 9, s, 40) * 9;
      const g0 = (rng() - 0.5) * 12;
      const v = clamp(246 + m + g0, 200, 255);
      return [v, v - 3, v - 9, 255];
    }, PS);
    const pg = paper.getContext('2d');
    for (let i = 0; i < 420; i++) {
      const x = rng() * PS, y = rng() * PS, a = rng() * TAU, l = 6 + rng() * 22;
      pg.strokeStyle = rng() < 0.5 ? 'rgba(150,135,115,0.16)' : 'rgba(255,255,255,0.35)';
      pg.lineWidth = 0.6 + rng() * 0.6;
      pg.beginPath(); pg.moveTo(x, y);
      pg.quadraticCurveTo(x + Math.cos(a) * l * 0.5 + (rng() - 0.5) * 6, y + Math.sin(a) * l * 0.5 + (rng() - 0.5) * 6, x + Math.cos(a) * l, y + Math.sin(a) * l);
      pg.stroke();
    }
    TEX.paper = gpu(paper);
    // sparkle of paper tooth seen through dark washes (screen)
    TEX.speck = mkTex((x, y, s) => {
      const peak = sstep(0.18, 0.34, tn(x + 3, y + 70, s, 70));
      const w = rng();
      return [255, 248, 236, clamp(peak * w * 0.55, 0, 1) * 255];
    }, S);
    TEX.speck = gpu(TEX.speck);
  }
  function pat(g, tex, scale, rng) {
    const p = g.createPattern(tex, 'repeat');
    const m = new DOMMatrix();
    p.setTransform(m.translate((rng ? rng() : 0.3) * 400, (rng ? rng() : 0.7) * 400).scale(scale || 0.6));
    return p;
  }

  /* ================================================================== brushes */
  let RNG = mulberry32(1);
  // filled, tapering ink stroke along a polyline (world units)
  function inkStroke(g, pts, w, o) {
    o = o || {};
    const n = pts.length; if (n < 2) return;
    const L = [0];
    for (let i = 1; i < n; i++) L.push(L[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    const tot = L[n - 1] || 1;
    const ti = o.ti === undefined ? 0.2 : o.ti, to = o.to === undefined ? 0.3 : o.to;
    const mn = o.min === undefined ? 0.12 : o.min, vr = o.vr === undefined ? 0.35 : o.vr, sd = o.sd === undefined ? RNG() * 100 : o.sd;
    const left = [], right = [];
    for (let i = 0; i < n; i++) {
      const s = L[i] / tot;
      let k = 1;
      if (ti > 0 && s < ti) k *= Math.sin((s / ti) * PI / 2);
      if (to > 0 && s > 1 - to) k *= Math.sin(((1 - s) / to) * PI / 2);
      k = Math.max(k, mn);
      if (o.prof) k *= o.prof(s, pts[i]);
      k *= 1 + vr * n1(sd + L[i] * 0.06);
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
      let nx = -(b[1] - a[1]), ny = b[0] - a[0];
      const nl = Math.hypot(nx, ny) || 1; nx /= nl; ny /= nl;
      const hw = (w * k) / 2;
      left.push([pts[i][0] + nx * hw, pts[i][1] + ny * hw]);
      right.push([pts[i][0] - nx * hw, pts[i][1] - ny * hw]);
    }
    g.beginPath(); g.moveTo(left[0][0], left[0][1]);
    for (let i = 1; i < n; i++) g.lineTo(left[i][0], left[i][1]);
    for (let i = n - 1; i >= 0; i--) g.lineTo(right[i][0], right[i][1]);
    g.closePath();
    if (o.col) g.fillStyle = o.col;
    g.fill();
  }
  // a hand-drawn line made of one or more broken strokes ("lost and found" edges)
  function inkLine(g, pts, w, o) {
    o = o || {};
    const gaps = o.gaps === undefined ? 0.0 : o.gaps;
    if (gaps <= 0 || pts.length < 8) { inkStroke(g, pts, w, o); return; }
    const sd = RNG() * 100;
    let seg = [];
    for (let i = 0; i < pts.length; i++) {
      const on = n1(sd + i * (o.gapFreq || 0.07)) > -1 + 2 * gaps;
      if (on) seg.push(pts[i]);
      else { if (seg.length > 2) inkStroke(g, seg, w, o); seg = []; }
    }
    if (seg.length > 2) inkStroke(g, seg, w, o);
  }
  // bristly dry-brush stroke
  function dryBrush(g, pts, w, col, o) {
    o = o || {};
    const nb = o.n || 7, alpha = o.alpha === undefined ? 0.8 : o.alpha;
    g.save(); g.strokeStyle = col; g.lineCap = 'round';
    const N = pts.length;
    for (let b = 0; b < nb; b++) {
      const off = (b / (nb - 1) - 0.5) * w;
      const s0 = Math.floor(RNG() * N * (o.trim || 0.25)), s1 = N - Math.floor(RNG() * N * (o.trim || 0.25));
      const sd = RNG() * 100;
      g.globalAlpha = alpha * (0.5 + RNG() * 0.5);
      g.lineWidth = (w / nb) * (0.7 + RNG() * 1.1);
      g.beginPath(); let pen = false;
      for (let i = s0; i < s1; i++) {
        const a = pts[Math.max(0, i - 1)], c = pts[Math.min(N - 1, i + 1)];
        let nx = -(c[1] - a[1]), ny = c[0] - a[0]; const nl = Math.hypot(nx, ny) || 1; nx /= nl; ny /= nl;
        const x = pts[i][0] + nx * off, y = pts[i][1] + ny * off;
        const on = n1(sd + i * 0.35) > (o.broken === undefined ? -0.25 : o.broken);
        if (on) { if (!pen) { g.moveTo(x, y); pen = true; } else g.lineTo(x, y); } else pen = false;
      }
      g.stroke();
    }
    g.restore();
  }
  // watercolour wash: layered, wobbling fills, darkened edges, granulation, blooms; glazed with multiply
  function wash(P, poly, fill, o) {
    o = o || {};
    const R = P.R, spread = o.spread === undefined ? 2.2 : o.spread;
    const step = o.step || Math.max(spread * 1.6, 2.5);
    const base = resample(poly, step, true);
    if (base.length < 3) return;
    const bb = bbox(base), m = spread * 4.2 + 4;
    const bx0 = bb[0] - m, by0 = bb[1] - m, bw = bb[2] - bb[0] + 2 * m, bh = bb[3] - bb[1] + 2 * m;
    const pw = Math.ceil(bw * R), ph = Math.ceil(bh * R);
    if (pw < 2 || ph < 2) return;
    const tc = mk(pw, ph), tg = cpu(tc);
    tg.setTransform(R, 0, 0, R, -bx0 * R, -by0 * R);
    const fs = typeof fill === 'function' ? fill(tg) : fill;
    tg.fillStyle = fs;
    const layers = o.layers || 6;
    const la = o.la || Math.min(1, 2.0 / layers);
    const freq = o.freq || 0.11;
    for (let l = 0; l < layers; l++) {
      tg.globalAlpha = la;
      const s = RNG() * 1000, amp = spread * (0.6 + l / layers);
      tg.beginPath();
      for (let i = 0; i < base.length; i++) {
        const x = base[i][0] + n2(i * freq + s, l * 3.7) * amp * 2;
        const y = base[i][1] + n2(i * freq + s + 50, l * 2.3) * amp * 2;
        if (i) tg.lineTo(x, y); else tg.moveTo(x, y);
      }
      tg.closePath(); tg.fill();
    }
    tg.globalAlpha = 1;
    if (o.edge !== 0) {
      tg.globalCompositeOperation = 'source-atop';
      tg.globalAlpha = o.edge === undefined ? 0.3 : o.edge;
      tg.strokeStyle = o.edgeCol || fs; tg.lineWidth = o.edgeW || 1.4; tg.lineJoin = 'round';
      polyPath(tg, base); tg.stroke();
      tg.globalAlpha = 1;
    }
    if (o.gran) { tg.globalCompositeOperation = 'source-atop'; tg.globalAlpha = o.gran; tg.fillStyle = pat(tg, TEX.gran, o.gscale || 0.55, RNG); tg.fillRect(bx0, by0, bw, bh); }
    if (o.bloom) { tg.globalCompositeOperation = 'destination-out'; tg.globalAlpha = o.bloom; tg.fillStyle = pat(tg, TEX.bloom, o.bscale || 1.2, RNG); tg.fillRect(bx0, by0, bw, bh); }
    if (o.tooth) { tg.globalCompositeOperation = 'destination-out'; tg.globalAlpha = o.tooth; tg.fillStyle = pat(tg, TEX.tooth, 0.55, RNG); tg.fillRect(bx0, by0, bw, bh); }
    if (o.after) { tg.globalCompositeOperation = 'source-atop'; tg.globalAlpha = 1; o.after(tg, bx0, by0, bw, bh); }
    const g = P.g;
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalAlpha = o.alpha === undefined ? 1 : o.alpha;
    g.globalCompositeOperation = o.mode || 'multiply';
    g.drawImage(tc, Math.round((bx0 - P.ox) * R), Math.round((by0 - P.oy) * R));
    g.restore();
  }
  // short hatching strokes inside a polygon
  function hatch(P, poly, o) {
    const g = P.g; g.save();
    polyPath(g, poly); g.clip();
    const bb = bbox(poly);
    const ang = o.ang === undefined ? -0.9 : o.ang, ca = Math.cos(ang), sa = Math.sin(ang);
    const gap = o.gap || 5, len = o.len || 18;
    const cxm = (bb[0] + bb[2]) / 2, cym = (bb[1] + bb[3]) / 2, rad = Math.hypot(bb[2] - bb[0], bb[3] - bb[1]) / 2 + len;
    g.strokeStyle = o.col || 'rgba(30,24,40,0.5)'; g.lineCap = 'round';
    for (let v = -rad; v <= rad; v += gap) {
      let u = -rad + RNG() * len;
      while (u < rad) {
        const l = len * (0.55 + RNG() * 0.9);
        const x = cxm + ca * u - sa * v + (RNG() - 0.5) * gap * 0.6, y = cym + sa * u + ca * v + (RNG() - 0.5) * gap * 0.6;
        const d = o.density ? o.density(x, y) : 1;
        if (RNG() < d) {
          g.globalAlpha = (o.alpha || 0.6) * (0.55 + RNG() * 0.45);
          g.lineWidth = (o.w || 0.9) * (0.6 + RNG() * 0.8);
          const bend = (RNG() - 0.5) * l * 0.12;
          g.beginPath(); g.moveTo(x, y);
          g.quadraticCurveTo(x + ca * l * 0.5 - sa * bend, y + sa * l * 0.5 + ca * bend, x + ca * l, y + sa * l);
          g.stroke();
        }
        u += l + gap * (0.4 + RNG() * 1.4);
      }
    }
    g.restore();
  }
  function blob(g, x, y, r, n, jit) {
    g.beginPath();
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * TAU, k = 1 + (RNG() - 0.5) * (jit || 0.5);
      const px = x + Math.cos(a) * r * k, py = y + Math.sin(a) * r * k;
      if (i) g.lineTo(px, py); else g.moveTo(px, py);
    }
    g.closePath(); g.fill();
  }
  function dots(g, poly, n, col, rmin, rmax, alpha) {
    const bb = bbox(poly);
    g.save(); polyPath(g, poly); g.clip(); g.fillStyle = col;
    for (let i = 0; i < n; i++) { g.globalAlpha = (alpha || 0.8) * (0.4 + RNG() * 0.6); blob(g, lerp(bb[0], bb[2], RNG()), lerp(bb[1], bb[3], RNG()), lerp(rmin, rmax, RNG()), 6, 0.5); }
    g.restore();
  }

  /* ================================================================== palettes */
  const INK = '#221c2c', INKC = hex(INK);

  /* ------------------------------------------------------------------ THE PIECE BODY (filled below) */
  /* ================================================================== mountain painter */
  // returns { ry(x): ridge y, summits:[[x,y]] }
  function paintRange(P, o) {
    const g = P.g, step = o.step || 3;
    const sd = RNG() * 1000, freq = o.freq || 0.018, hmax = o.hmax || 300;
    // every peak is asymmetric and shouldered; sub-peaks are added so no two mountains repeat
    const pks = [];
    for (const pk of o.peaks) {
      const wl = pk.w * (0.7 + RNG() * 0.6), wr = pk.w * (0.7 + RNG() * 0.6);
      const shp = pk.shape || (o.shapes ? (RNG() < 0.45 ? 'massif' : RNG() < 0.4 ? 'dome' : 'crag') : 'crag');
      pks.push({ x: pk.x, h: pk.h, wl, wr, sl: (pk.s || 1.4) * (0.8 + RNG() * 0.5), sr: (pk.s || 1.4) * (0.8 + RNG() * 0.5), shp });
      if (o.shoulders !== false) for (let k = 0; k < 2; k++) {
        const side = k ? 1 : -1, d = (0.25 + RNG() * 0.4) * (side > 0 ? wr : wl);
        pks.push({ x: pk.x + side * d, h: pk.h * (0.55 + RNG() * 0.3), wl: pk.w * (0.25 + RNG() * 0.25), wr: pk.w * (0.25 + RNG() * 0.25), sl: 1.1, sr: 1.1, shp: 'crag' });
      }
    }
    const Hf = (x) => {
      let h = (o.floor || 0) + (o.und || 0) * (n1(sd + x * 0.005) * 0.5 + 0.5);
      for (const pk of pks) { const dx = x - pk.x; const u = dx < 0 ? -dx / pk.wl : dx / pk.wr; if (u < 1) { const e = dx < 0 ? pk.sl : pk.sr; const f = pk.shp === 'massif' ? Math.pow(1 - u * u, 0.8 + e * 0.6) * (1 - 0.06 * Math.abs(Math.sin(u * 9 + pk.x))) : pk.shp === 'dome' ? Math.pow(1 - Math.pow(u, 1.5), 1.6 + e * 0.4) : Math.pow(1 - u, e); h = Math.max(h, pk.h * f); } }
      const r = 1 - Math.abs(n1(sd * 0.7 + x * freq)), r2 = 1 - Math.abs(n1(sd * 0.3 + x * freq * 3.3)), r3 = n1(sd * 0.11 + x * freq * 9);
      h += (r * r * 0.6 + r2 * r2 * 0.4 - 0.45) * (o.amp || 20) * (0.35 + (0.65 * h) / hmax) + r3 * (o.amp || 20) * 0.12;
      return Math.max(h, 0);
    };
    const ridge = [];
    for (let x = o.x0; x <= o.x1 + 0.01; x += step) ridge.push([x, o.base - Hf(x)]);
    const bot = o.base + (o.below || 200);
    const sil = ridge.concat([[o.x1, bot], [o.x0, bot]]);
    const ry = (x) => { const i = clamp((x - o.x0) / step, 0, ridge.length - 1.001); const k = Math.floor(i); return lerp(ridge[k][1], ridge[k + 1][1], i - k); };
    // all prominent local summits become facets
    const sums = [];
    const prom = hmax * (o.prom || 0.035), sep = Math.max(4, Math.round(12 / step));
    for (let i = sep; i < ridge.length - sep; i++) {
      const y = ridge[i][1]; let isMax = true;
      for (let j = i - sep; j <= i + sep; j++) if (ridge[j][1] < y) { isMax = false; break; }
      if (!isMax) continue;
      if (o.base - y < hmax * 0.08) continue;
      let lo = y; for (let j = i; j < Math.min(ridge.length, i + sep * 6); j++) lo = Math.max(lo, ridge[j][1]);
      if (lo - y < prom) continue;
      if (sums.length && i - sums[sums.length - 1] < sep) continue;
      sums.push(i);
    }
    const top = o.base - hmax;
    // 1. body: shadow wash
    wash(P, sil, (tg) => { const gr = tg.createLinearGradient(0, top, 0, o.base + 20); gr.addColorStop(0, o.shadeTop || o.shade); gr.addColorStop(0.6, o.shade); gr.addColorStop(1, o.haze); return gr; },
      { mode: 'source-over', layers: 4, spread: o.spread || 1.2, gran: o.gran === undefined ? 0.35 : o.gran, bloom: 0.12, edge: 0.4, step: 4 });
    // 2. lit faces: each summit throws a spur; the face between it and a line falling from the next col catches the light
    const litPolys = [];
    for (let k = 0; k < sums.length; k++) {
      const si = sums[k];
      let vi = k + 1 < sums.length ? sums[k + 1] : ridge.length - 1;
      let best = si, bv = -1e9;
      for (let i = si; i <= vi; i++) if (ridge[i][1] > bv) { bv = ridge[i][1]; best = i; }
      vi = best;
      if (vi - si < 3) continue;
      const lean = (o.lean || 0.45) * (0.5 + RNG() * 1.0);
      const walk = (x, y, ls, ln) => { const pts = []; while (y < bot) { pts.push([x, y]); y += 5; x += -ln * 5 + n1(ls + y * 0.04) * 4.2 + n1(ls * 2 + y * 0.13) * 1.6; } pts.push([x, bot]); return pts; };
      const spur = walk(ridge[si][0], ridge[si][1], sd + k * 13, lean);
      const col = walk(ridge[vi][0], ridge[vi][1], sd + k * 29 + 7, lean * (0.6 + RNG() * 0.5));
      const poly = ridge.slice(si, vi + 1).concat(col.slice(1)).concat(spur.slice().reverse());
      litPolys.push({ poly, spur, si, vi });
      const la = (o.litA || 0.95) * (k % 2 ? 0.82 + RNG() * 0.18 : 1);
      wash(P, poly, (tg) => { const gr = tg.createLinearGradient(0, ridge[si][1], 0, o.base); gr.addColorStop(0, o.lit); gr.addColorStop(0.55, o.litLow || o.lit); gr.addColorStop(1, rgba(hex(o.haze), 0)); return gr; },
        { mode: 'source-over', alpha: la, layers: 5, spread: 1.6, gran: 0.25, edge: 0.25, bloom: 0.1, tooth: 0.25 });
    }
    // 3. rock & couloirs
    const det = o.detail === undefined ? 1 : o.detail;
    g.save(); polyPath(g, sil); g.clip();
    const nrock = Math.floor(((o.x1 - o.x0) / 7) * det);
    for (let i = 0; i < nrock; i++) {
      const x = lerp(o.x0, o.x1, RNG());
      const y0 = ry(x), hgt = o.base - y0;
      if (hgt < 6) continue;
      const y = y0 + 4 + Math.pow(RNG(), 0.8) * hgt * 0.95;
      const l = (6 + RNG() * 26) * (o.rockLen || 1);
      const pts = [[x, y], [x - l * 0.3 + (RNG() - 0.5) * 4, y + l * 0.55], [x - l * 0.55, y + l]];
      g.globalAlpha = (0.25 + RNG() * 0.5) * (o.rockA || 1);
      inkStroke(g, catmull(pts, 4), 1.2 + RNG() * 3.2 * (o.rockW || 1), { col: o.rock, ti: 0.1, to: 0.6, vr: 0.5 });
    }
    // rock buttresses where the slopes are too steep to hold snow
    for (let i = 0; i < Math.floor(((o.x1 - o.x0) / 9) * det); i++) {
      const x = lerp(o.x0, o.x1, RNG()), y0 = ry(x), sl = Math.abs(ry(x + 4) - ry(x - 4)) / 8;
      if (sl < 0.9 || o.base - y0 < hmax * 0.15) continue;
      const l = 20 + RNG() * 90 * (o.rockLen || 1), pts = [];
      let px = x, py = y0 + 3; const s3 = RNG() * 40;
      for (let j = 0; j < 7; j++) { pts.push([px, py]); py += l / 7; px += -(l / 7) * (0.15 + n1(s3 + j * 0.5) * 0.25); }
      g.globalAlpha = 0.35 + RNG() * 0.35;
      inkStroke(g, pts, 3 + RNG() * 6 * (o.rockW || 1), { col: o.rock, ti: 0.1, to: 0.7, vr: 0.6 });
    }
    // couloirs on lit faces
    for (const L of litPolys) {
      for (let i = L.si + 2; i < L.vi - 1; i += 2 + Math.floor(RNG() * 5)) {
        const [x, y] = ridge[i];
        if (RNG() < 0.35) continue;
        const l = (o.base - y) * (0.15 + RNG() * 0.35);
        const pts = []; let px = x, py = y + 2;
        const s2 = RNG() * 50;
        for (let j = 0; j < 8; j++) { pts.push([px, py]); py += l / 8; px -= (l / 8) * (0.35 + n1(s2 + j * 0.4) * 0.3); }
        g.globalAlpha = 0.45 * (o.coulA || 1);
        inkStroke(g, pts, 1 + RNG() * 2.2, { col: o.rockLit || o.rock, ti: 0.05, to: 0.7 });
      }
    }
    g.globalAlpha = 1;
    // 4. hatching in shadow
    if (o.hatchA) {
      // a coarse bitmap of the lit faces, so hatching can stay in the shadows
      const q = 4, mw = Math.ceil((o.x1 - o.x0) / q) + 2, mh = Math.ceil((bot - top) / q) + 2;
      const mc = mk(mw, mh), mg = cpu(mc);
      mg.setTransform(1 / q, 0, 0, 1 / q, -o.x0 / q, -top / q); mg.fillStyle = '#fff';
      for (const L of litPolys) { polyPath(mg, L.poly); mg.fill(); }
      const md = mg.getImageData(0, 0, mw, mh).data;
      const isLit = (x, y) => { const ix = Math.floor((x - o.x0) / q), iy = Math.floor((y - top) / q); if (ix < 0 || iy < 0 || ix >= mw || iy >= mh) return false; return md[(iy * mw + ix) * 4 + 3] > 128; };
      hatch(P, sil, { ang: o.hatchAng || 2.05, gap: o.hatchGap || 4.2, len: o.hatchLen || 14, w: o.hatchW || 0.7, col: o.inkCol || INK, alpha: o.hatchA,
        density: (x, y) => { if (isLit(x, y)) return 0.05; const f = (y - ry(x)) / Math.max(1, o.base - ry(x)); return f < 0 ? 0 : 0.85 * (1 - f * 0.8); } });
    }
    g.restore();
    // 5. gouache on lit ridges
    for (const L of litPolys) {
      const n = Math.max(3, Math.floor((L.vi - L.si) * (0.35 + RNG() * 0.3)));
      const pts = ridge.slice(L.si, L.si + n).map((p) => [p[0], p[1] + 1.6]);
      if (pts.length > 2) dryBrush(g, pts, (o.hiW || 3.2), o.hi || '#fff6ee', { n: 5, alpha: o.hiA || 0.85, broken: -0.1 });
      // a few white strokes along the spur top
      const sp = L.spur.slice(0, Math.floor(L.spur.length * 0.25)).map((p) => [p[0] + 1.5, p[1]]);
      if (sp.length > 2) dryBrush(g, sp, 2.2, o.hi || '#fff6ee', { n: 4, alpha: (o.hiA || 0.85) * 0.6 });
    }
    // 6. ink: ridge contour & spurs
    if (o.inkA) {
      g.save(); g.globalAlpha = o.inkA;
      const prof = (s, p) => { const i = clamp(Math.round((p[0] - o.x0) / step), 1, ridge.length - 2); const sl = ridge[i + 1][1] - ridge[i - 1][1]; return sl < 0 ? 1.25 : 0.55; };
      inkLine(g, ridge, o.inkW || 1.6, { col: o.inkCol || INK, gaps: o.inkGaps === undefined ? 0.18 : o.inkGaps, ti: 0.02, to: 0.02, prof, vr: 0.5, gapFreq: 0.05 });
      for (const L of litPolys) {
        const sp = L.spur.slice(0, Math.floor(L.spur.length * (0.3 + RNG() * 0.3)));
        if (sp.length > 3) inkLine(g, sp, (o.inkW || 1.6) * 0.6, { col: o.inkCol || INK, gaps: 0.3, ti: 0.05, to: 0.8 });
      }
      g.restore();
    }
    // 7. atmosphere: dissolve the base into haze
    g.save(); polyPath(g, sil); g.clip();
    const hg = g.createLinearGradient(0, o.base - hmax * (o.hazeFrom || 0.5), 0, o.base + 10);
    hg.addColorStop(0, rgba(hex(o.haze), 0)); hg.addColorStop(1, rgba(hex(o.haze), o.hazeA === undefined ? 0.92 : o.hazeA));
    g.fillStyle = hg; g.fillRect(o.x0 - 10, top - 10, o.x1 - o.x0 + 20, bot - top + 20);
    g.restore();
    return { ry, ridge, summits: sums.map((i) => ridge[i]) };
  }
  // long horizontal mist / cloud lens
  function lens(cx, cy, L, T, sd, flat) {
    const top = [], botm = [];
    const n = Math.max(8, Math.floor(L / 10));
    for (let i = 0; i <= n; i++) {
      const u = i / n, x = cx - L / 2 + L * u, s = Math.pow(Math.sin(PI * u), 0.6);
      top.push([x, cy - T * s * (0.65 + 0.35 * n1(sd + u * 6)) ]);
      botm.push([x, cy + T * s * (flat || 0.25) * (0.7 + 0.3 * n1(sd + 9 + u * 4))]);
    }
    return top.concat(botm.reverse());
  }
  function mist(P, x0, x1, y, col, n, o) {
    o = o || {};
    for (let i = 0; i < n; i++) {
      const L = (o.L || 300) * (0.6 + RNG() * 0.9), cx = lerp(x0, x1, RNG()), cy = y + (RNG() - 0.5) * (o.dy || 30);
      const T = (o.T || 14) * (0.6 + RNG() * 0.8);
      wash(P, lens(cx, cy, L, T, RNG() * 50, 0.9), col, { mode: 'source-over', alpha: (o.a || 0.5) * (0.35 + RNG() * 0.5), layers: 7, spread: Math.max(3, T * 0.45), edge: 0, bloom: 0.35, bscale: 2 });
    }
  }
  function genPeaks(x0, x1, s0, s1, h0, h1, w0, w1, sh) {
    const out = []; let x = x0 + RNG() * s0;
    while (x < x1) { const big = RNG() < 0.3, q = RNG(); const shape = q < 0.4 ? 'massif' : q < 0.6 ? 'dome' : 'crag'; out.push({ x, h: lerp(h0, h1, Math.pow(RNG(), big ? 0.4 : 1.6)), w: lerp(w0, w1, RNG()) * (shape === 'massif' ? 1.5 : 1), s: (sh || 1.3) * (0.8 + RNG() * 0.5), shape }); x += lerp(s0, s1, RNG()); }
    return out;
  }
  function star(g, x, y, r, a) {
    g.globalAlpha = a; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
    if (r > 0.9) { g.globalAlpha = a * 0.5; g.fillRect(x - r * 3, y - 0.2, r * 6, 0.4); g.fillRect(x - 0.2, y - r * 3, 0.4, r * 6); }
  }

  /* ================================================================== THE SUMMIT (Amon Dîn) — layers */
  const SUM = {
    stoolX: 0, brazierX: -78, pyreX: 1300, cliffX: -430,
  };
  function gY(x) { return -44 * sstep(150, 1250, x) + 8 * Math.sin(x / 190 + 0.6) - 4 * Math.sin(x / 71 + 1.3) + 70 * sstep(1680, 2200, x); }
  // camera keyframe at the dissolve from the eye, and the screen point where the spark must land
  const SPARK_SCREEN = [300, 600];
  const CAM_S2_START = { X: -194, Y: -349, Z: 1.9 };
  function flareWorld() {
    const p = 0.1, Zp = 1 + (CAM_S2_START.Z - 1) * p;
    return [(SPARK_SCREEN[0] - W / 2) / Zp + CAM_S2_START.X * p, (SPARK_SCREEN[1] - H / 2) / Zp + CAM_S2_START.Y * p];
  }

  function buildSkyA() {
    const P = painter(-660, -840, 1360, 1600, R * 0.5), g = P.g;
    const hz = -95, y0 = -840, y1 = 760, f = (y) => (y - y0) / (y1 - y0);
    const gr = g.createLinearGradient(0, y0, 0, y1);
    gr.addColorStop(0, '#121128'); gr.addColorStop(f(-560), '#221d45'); gr.addColorStop(f(-330), '#3b3363');
    gr.addColorStop(f(-190), '#66547f'); gr.addColorStop(f(hz - 20), '#9a7f9b'); gr.addColorStop(f(hz + 10), '#a48aa0'); gr.addColorStop(1, '#5f5876');
    g.fillStyle = gr; g.fillRect(-660, y0, 1360, 1600);
    // the west still remembers the sun
    let rg = g.createRadialGradient(760, hz, 10, 760, hz, 900);
    rg.addColorStop(0, 'rgba(238,166,112,0.7)'); rg.addColorStop(0.35, 'rgba(214,132,120,0.32)'); rg.addColorStop(1, 'rgba(160,100,140,0)');
    g.fillStyle = rg; g.fillRect(-660, y0, 1360, 1600);
    // the east is already night
    rg = g.createRadialGradient(-760, -200, 20, -760, -200, 760);
    rg.addColorStop(0, 'rgba(12,10,26,0.65)'); rg.addColorStop(1, 'rgba(12,10,26,0)');
    g.fillStyle = rg; g.fillRect(-660, y0, 1360, 1600);
    // washes of uneven sky
    for (let i = 0; i < 7; i++) wash(P, lens(lerp(-600, 640, RNG()), lerp(-760, -260, RNG()), 500 + RNG() * 600, 60 + RNG() * 80, RNG() * 40, 0.8), '#2a2450', { alpha: 0.18, layers: 4, spread: 6, edge: 0.1, bloom: 0.5, bscale: 2.4 });
    // stratus, lit from beneath in the west
    for (let i = 0; i < 9; i++) {
      const cx = lerp(-640, 700, RNG()), cy = lerp(-560, -150, Math.pow(RNG(), 0.7)), L = 160 + RNG() * 420, T = 5 + RNG() * 12;
      const poly = lens(cx, cy, L, T, RNG() * 40, 0.3);
      const warm = sstep(-200, 600, cx);
      wash(P, poly, mixh('#3a3058', '#5a4060', warm), { alpha: 0.75, layers: 5, spread: 2.5, edge: 0.4, gran: 0.2, bloom: 0.2 });
      if (warm > 0.15) {
        const b = poly.slice(Math.floor(poly.length / 2) + 2, poly.length - 2);
        g.globalAlpha = 0.55 * warm; inkStroke(g, b, 2.2, { col: '#f0a77e', ti: 0.4, to: 0.4 }); g.globalAlpha = 1;
      }
    }
    // first stars, thickest in the east
    g.fillStyle = '#f6efe2';
    for (let i = 0; i < 140; i++) {
      const x = lerp(-660, 700, Math.pow(RNG(), 1.5)), y = lerp(-840, -200, Math.pow(RNG(), 1.3));
      star(g, x, y, 0.5 + Math.pow(RNG(), 4) * 1.4, (0.35 + RNG() * 0.6) * (1 - sstep(-100, 600, x) * 0.8));
    }
    g.globalAlpha = 1;
    A.skyA = toLayer(P, 0.04);
  }
  function buildFarA() {
    const P = painter(-680, -330, 1480, 1100, R * 0.6);
    const fw = flareWorld(); A.flare = fw;
    // the far east: a long low wall of shadow
    paintRange(P, { x0: -680, x1: 800, base: -86, peaks: [{ x: -600, h: 28, w: 90 }, { x: -520, h: 40, w: 70, s: 1 }, { x: -430, h: 30, w: 80 }], floor: 10, amp: 9, freq: 0.05,
      shade: '#3c3352', shadeTop: '#2e2744', lit: '#57496a', haze: '#8c7895', hmax: 60, inkA: 0.35, inkW: 1.0, detail: 0.2, hazeFrom: 0.2, hazeA: 0.85, below: 900, hiA: 0 });
    // the mountain with the white city on its shoulder
    const city = paintRange(P, { x0: -460, x1: -20, base: -80, peaks: [{ x: -110, h: 96, w: 210, s: 1.3 }, { x: fw[0], h: 16, w: 110, s: 0.5, nolit: true }], floor: 6, amp: 8, freq: 0.035,
      shade: '#4a3f63', shadeTop: '#3f3558', lit: '#c9a7b4', litLow: '#8c7896', haze: '#a08aa2', hmax: 100, inkA: 0.45, inkW: 1.1, detail: 0.3, hazeFrom: 0.35, below: 900, hiA: 0.6, hiW: 2 });
    A.cityGround = city.ry(fw[0]);
    // tiny city: tiers of pale wall and a tower whose head is the flare
    const g = P.g, cx = fw[0], cb = city.ry(fw[0]) + 1;
    g.fillStyle = '#e6dce2';
    for (let k = 0; k < 4; k++) { g.globalAlpha = 0.75 - k * 0.1; const w = 26 - k * 5; g.fillRect(cx - w / 2 + (k % 2) * 1.5, cb - 2 - k * 2.6, w, 1.8); }
    g.globalAlpha = 0.9; g.fillRect(cx - 0.9, fw[1] + 1.5, 1.8, cb - fw[1] - 2);
    g.globalAlpha = 1;
    // the long range westwards, faint and pink
    paintRange(P, { x0: -40, x1: 800, base: -84, peaks: genPeaks(-40, 800, 70, 190, 25, 75, 70, 130), floor: 12, amp: 10, freq: 0.04,
      shade: '#6d5e86', shadeTop: '#5d5079', lit: '#e9c0bd', litLow: '#b79aaf', haze: '#ab90a6', hmax: 75, inkA: 0.25, inkW: 0.9, detail: 0.25, hazeFrom: 0.4, below: 900, hiA: 0.7, hiW: 2 });
    mist(P, -680, 800, -70, '#b7a0b2', 9, { L: 260, T: 7, a: 0.45, dy: 16 });
    A.farA = toLayer(P, 0.1);
  }
  function buildMidA() {
    const P = painter(-800, -160, 1900, 1300, R * 0.75);
    paintRange(P, { x0: -800, x1: 1100, base: 50, peaks: genPeaks(-800, 1100, 120, 300, 60, 150, 110, 220),
      floor: 20, und: 10, amp: 18, freq: 0.03, shade: '#5e5583', shadeTop: '#4d4673', lit: '#e7c6c4', litLow: '#a796b5', haze: '#9b8ba9', hmax: 140, inkA: 0.5, inkW: 1.2, hatchA: 0.18, hatchGap: 4.5, hatchLen: 10, detail: 0.6, hazeFrom: 0.55, below: 1100, hiA: 0.8 });
    mist(P, -800, 1100, 40, '#a898b4', 14, { L: 320, T: 10, a: 0.55, dy: 30 });
    A.midA = toLayer(P, 0.25);
  }
  function buildNearA() {
    const P = painter(-880, -80, 2500, 1500, R * 0.85);
    paintRange(P, { x0: -880, x1: 1620, base: 320, peaks: genPeaks(-880, 1620, 180, 420, 170, 310, 170, 300, 1.25),
      floor: 120, und: 30, amp: 34, freq: 0.022, shade: '#4a4470', shadeTop: '#3a3560', lit: '#e6c3c6', litLow: '#9b8db3', haze: '#867aa0', rock: '#2c2640', rockLit: '#5b4d72', hmax: 300, inkA: 0.75, inkW: 1.8,
      hatchA: 0.3, hatchGap: 3.8, hatchLen: 13, detail: 1.1, hazeFrom: 0.62, hazeA: 0.95, below: 1100, hiA: 0.9, hiW: 4 });
    mist(P, -880, 1620, 300, '#9a8eb0', 16, { L: 380, T: 16, a: 0.6, dy: 40 });
    A.nearA = toLayer(P, 0.55);
  }

  // palette for the summit, cool (dusk) and warm (firelit)
  const PAL_COOL = { snowTop: '#ddd6e8', snowLow: '#aeb2d6', shadow: '#7c80b5', rock: '#4c4662', rockDark: '#29233a', stone: '#837992', wood: '#6e5040', woodDark: '#3b2a26', hi: '#fbf7f2', ink: INK, warmWin: '#f5c26b', straw: '#b49a62' };
  const PAL_WARM = { snowTop: '#ffdcaa', snowLow: '#f5ae7c', shadow: '#c06a52', rock: '#7a4636', rockDark: '#3d1f1c', stone: '#c07f5e', wood: '#9a5530', woodDark: '#4a2418', hi: '#fff3d6', ink: '#3a1a14', warmWin: '#ffd27a', straw: '#e6b45e' };
  function skylineY(x) { return gY(x) - 44 - 16 * sstep(-300, 500, x) + 9 * n1(x * 0.011 + 3.3) + 4 * n1(x * 0.05); }

  function paintGround(P, pal, seed) {
    RNG = mulberry32(seed);
    const g = P.g, x0 = P.ox, x1 = P.ox + P.w, yb = P.oy + P.h;
    const cx = SUM.cliffX;
    const sky = [];
    for (let x = cx; x <= x1; x += 6) sky.push([x, skylineY(x)]);
    const sk0 = skylineY(cx);
    // the western flank falls away in broken buttresses
    const cliff = [];
    for (let k = 0; k <= 14; k++) { const y = sk0 + Math.pow(k / 14, 1.2) * (yb - sk0 + 20); cliff.push([cx - 6 - (y - sk0) * 0.62 - RNG() * 18 + 14 * Math.sin(k * 1.7), y]); }
    cliff[0] = [cx - 8, sk0 + 2];
    const poly = sky.concat([[x1, yb + 20]]).concat(cliff.slice().reverse());
    // 1. snow body
    wash(P, poly, (tg) => { const gr = tg.createLinearGradient(0, -110, 0, yb); gr.addColorStop(0, pal.snowTop); gr.addColorStop(0.3, mixh(pal.snowTop, pal.snowLow, 0.5)); gr.addColorStop(1, pal.snowLow); return gr; },
      { mode: 'source-over', layers: 4, spread: 1.4, gran: 0.16, bloom: 0.18, tooth: 0.12, edge: 0.3, step: 5 });
    // broad modelling: the summit rounds away into shadow towards the cliff and the foreground
    wash(P, poly, (tg) => { const gr = tg.createRadialGradient(900, -60, 100, 700, 0, 1500); gr.addColorStop(0, rgba(hex(pal.shadow), 0)); gr.addColorStop(0.5, rgba(hex(pal.shadow), 0.25)); gr.addColorStop(1, rgba(hex(pal.shadow), 0.75)); return gr; },
      { layers: 3, spread: 3, edge: 0, bloom: 0.3, bscale: 2 });
    // 2. rock face of the flank
    const inner = cliff.map((p, k) => [p[0] + 40 + k * 9 + RNG() * 30, p[1] + 6]);
    const face = cliff.concat(inner.slice().reverse());
    wash(P, face, (tg) => { const gr = tg.createLinearGradient(cx - 300, 0, cx + 100, 0); gr.addColorStop(0, pal.rockDark); gr.addColorStop(1, pal.rock); return gr; }, { mode: 'source-over', layers: 4, spread: 2, gran: 0.45, edge: 0.4 });
    hatch(P, face, { ang: 2.1, gap: 3.2, len: 18, w: 0.85, col: pal.ink, alpha: 0.55 });
    for (let i = 0; i < 7; i++) { const k = 1 + Math.floor(RNG() * 12), u = RNG(), p = cliff[k], q = inner[k], x = lerp(p[0], q[0], u * 0.5) + 4, y = p[1] + RNG() * 20, l = 14 + RNG() * 30; dryBrush(g, [[x, y], [x + l * 0.5, y + l * 0.25], [x + l, y + l * 0.6]], 3 + RNG() * 3, pal.hi, { n: 5, alpha: 0.7 }); }
    // cornice
    const corn = [[cx + 40, sk0 - 3], [cx - 6, sk0 - 5], [cx - 34, sk0 + 1], [cx - 36, sk0 + 9], [cx - 18, sk0 + 15], [cx + 40, sk0 + 22]];
    wash(P, corn, pal.snowTop, { mode: 'source-over', layers: 5, spread: 1, edge: 0.3 });
    // 3. drift bands with gouache crests
    for (let k = 0; k < 16; k++) {
      const x = lerp(cx + 40, x1 - 100, RNG()), L = 160 + RNG() * 480;
      const ys = skylineY(x) + 12 + Math.pow(RNG(), 0.8) * (yb - skylineY(x) - 20);
      const T = 6 + RNG() * 16 * (0.4 + (ys + 60) / 400);
      const band = lens(x, ys, L, T, RNG() * 30, 1.4);
      wash(P, band, pal.shadow, { alpha: 0.55, layers: 6, spread: 3, edge: 0.25, bloom: 0.25 });
      const crest = band.slice(1, Math.floor(band.length / 2) - 1).map((p) => [p[0], p[1] - 1]);
      dryBrush(g, crest, 3.5, pal.hi, { n: 6, alpha: 0.7, broken: -0.35 });
    }
    // 4. outcrops along the skyline
    const avoid = (x) => (x > 220 && x < 600) || (x > 1100 && x < 1500) || (x > -140 && x < 60);
    const rocks = [];
    for (let i = 0; i < 16; i++) {
      const x = lerp(cx + 30, x1 - 80, RNG()); if (avoid(x)) continue;
      const w = 22 + RNG() * 70, h = 10 + RNG() * 40 * (w / 70);
      rocks.push([x, skylineY(x) + 6 + RNG() * 6, w, h]);
    }
    for (let i = 0; i < 10; i++) {
      const x = lerp(cx + 60, x1 - 80, RNG()); if (avoid(x)) continue;
      const y = lerp(skylineY(x) + 40, yb - 60, Math.pow(RNG(), 1.4));
      if (Math.abs(y - gY(x)) < 26) continue;
      rocks.push([x, y, 14 + RNG() * 30, 6 + RNG() * 14]);
    }
    for (const r of rocks) paintRock(P, pal, r[0], r[1], r[2], r[3]);
    // 5. the stool
    paintRock(P, pal, SUM.stoolX + 4, gY(SUM.stoolX) + 4, 50, 40, true);
    // 6. hut, woodpile, chopping block
    paintHut(P, pal, 330, gY(330) - 24);
    // 7. sastrugi and wind marks
    g.save(); polyPath(g, poly); g.clip();
    g.strokeStyle = pal.ink;
    for (let i = 0; i < 520; i++) {
      const x = lerp(cx, x1, RNG());
      const sy = skylineY(x), f = Math.pow(RNG(), 0.9), y = lerp(sy + 4, yb, f);
      const l = 4 + f * 26 * (0.5 + RNG());
      g.globalAlpha = 0.15 + RNG() * 0.3; g.lineWidth = 0.5 + f * 0.9;
      g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + l * 0.5, y - 1.5 - RNG() * 2, x + l, y + (RNG() - 0.3) * 2); g.stroke();
    }
    // glints
    g.fillStyle = pal.hi;
    for (let i = 0; i < 380; i++) { const x = lerp(cx, x1, RNG()), y = lerp(skylineY(x) + 2, yb, RNG()); g.globalAlpha = 0.4 + RNG() * 0.6; g.fillRect(x, y, 0.8 + RNG() * 1.4, 0.8 + RNG() * 1.2); }
    g.restore(); g.globalAlpha = 1;
    // 8. ink skyline
    g.save(); g.globalAlpha = 0.85;
    inkLine(g, sky, 1.5, { col: pal.ink, gaps: 0.32, ti: 0.01, to: 0.01, vr: 0.6, gapFreq: 0.09 });
    inkLine(g, catmull(cliff, 3, false), 2.4, { col: pal.ink, gaps: 0.12, ti: 0.02, to: 0.3 }); inkLine(g, catmull(inner, 3, false), 1.2, { col: pal.ink, gaps: 0.45, ti: 0.1, to: 0.3 });
    g.restore();
  }
  function paintRock(P, pal, x, y, w, h, flat) {
    const g = P.g, pts = [];
    const n = 9;
    for (let i = 0; i <= n; i++) {
      const u = i / n;
      const hx = x - w / 2 + w * u;
      const top = flat ? y - h * (0.85 + 0.15 * Math.sin(u * PI)) - (RNG() - 0.5) * 3 : y - h * Math.pow(Math.sin(PI * clamp(u * 1.05 - 0.02, 0, 1)), 0.6) * (0.75 + RNG() * 0.4);
      pts.push([hx, top]);
    }
    const poly = pts.concat([[x + w / 2, y + 4], [x - w / 2, y + 4]]);
    wash(P, lens(x - w * 0.9, y + 3, w * 1.6, 4 + h * 0.12, RNG() * 9, 0.6), pal.shadow, { alpha: 0.6, layers: 4, spread: 1.5, edge: 0.2 });
    wash(P, poly, (tg) => { const gr = tg.createLinearGradient(x - w / 2, 0, x + w / 2, 0); gr.addColorStop(0, pal.rockDark); gr.addColorStop(0.6, pal.rock); gr.addColorStop(1, mixh(pal.rock, pal.snowTop, 0.3)); return gr; },
      { mode: 'source-over', layers: 4, spread: 0.8, gran: 0.5, edge: 0.5 });
    hatch(P, poly, { ang: 1.9, gap: 2.6, len: 7, w: 0.6, col: pal.ink, alpha: 0.55, density: (px) => 1 - (px - (x - w / 2)) / w });
    // snow cap
    const cap = pts.slice(1, n).map((p, i) => [p[0], p[1] - 1.5]);
    const capB = cap.slice().reverse().map((p) => [p[0], p[1] + 3 + RNG() * (flat ? 6 : 4)]);
    wash(P, cap.concat(capB), pal.hi, { mode: 'source-over', layers: 3, spread: 0.6, edge: 0.2 });
    g.save(); g.globalAlpha = 0.9;
    inkStroke(g, catmull(pts, 3, false), 1.6, { col: pal.ink, ti: 0.1, to: 0.15 });
    g.restore();
    // snow banked at the foot
    wash(P, lens(x, y + 4, w * 1.3, 5, RNG() * 9, 0.5), pal.snowLow, { mode: 'source-over', layers: 4, spread: 1.5, edge: 0.1 });
    // tufts of dead grass
    g.strokeStyle = pal.ink; g.lineCap = 'round';
    for (let k = 0; k < 2; k++) {
      const tx = x + (RNG() < 0.5 ? -1 : 1) * (w / 2 + 3 + RNG() * 6), ty = y + 2;
      for (let j = 0; j < 7; j++) { g.globalAlpha = 0.6; g.lineWidth = 0.6; const a = -PI / 2 + (RNG() - 0.5) * 1.2, l = 5 + RNG() * 8; g.beginPath(); g.moveTo(tx, ty); g.quadraticCurveTo(tx + Math.cos(a) * l * 0.5, ty + Math.sin(a) * l * 0.6, tx + Math.cos(a) * l + 2, ty + Math.sin(a) * l); g.stroke(); }
    }
    g.globalAlpha = 1;
  }
  function paintHut(P, pal, cx, yb) {
    const g = P.g;
    const wl = cx - 85, wr = cx + 82, wt = yb - 66;
    // walls of dry stone
    const wall = [[wl, yb + 2], [wl + 2, wt], [wr - 1, wt + 1], [wr, yb + 2]];
    wash(P, wall, pal.stone, { mode: 'source-over', layers: 4, spread: 0.8, gran: 0.5, edge: 0.4 });
    g.save(); polyPath(g, wall); g.clip();
    for (let y = yb; y > wt - 4; y -= 9 + RNG() * 3) {
      let x = wl - RNG() * 10;
      while (x < wr) {
        const w = 12 + RNG() * 18, h = 7 + RNG() * 3;
        g.fillStyle = mixh(pal.stone, pal.rockDark, RNG() * 0.45, 0.6);
        g.beginPath(); g.ellipse(x + w / 2, y - h / 2, w / 2, h / 2, (RNG() - 0.5) * 0.2, 0, TAU); g.fill();
        g.globalAlpha = 0.65; g.strokeStyle = pal.ink; g.lineWidth = 0.8; g.stroke(); g.globalAlpha = 1;
        x += w + 1;
      }
    }
    // shadow under the eaves
    const sg = g.createLinearGradient(0, wt, 0, wt + 30); sg.addColorStop(0, rgba(hex(pal.rockDark), 0.75)); sg.addColorStop(1, rgba(hex(pal.rockDark), 0));
    g.fillStyle = sg; g.fillRect(wl - 5, wt, wr - wl + 10, 30);
    g.restore();
    // door
    const door = [[cx - 66, yb + 1], [cx - 64, yb - 50], [cx - 36, yb - 51], [cx - 35, yb + 1]];
    wash(P, door, pal.woodDark, { mode: 'source-over', layers: 3, spread: 0.5, edge: 0.4, gran: 0.4 });
    g.strokeStyle = pal.ink; g.lineWidth = 0.8; g.globalAlpha = 0.8;
    for (let i = 1; i < 4; i++) { const x = cx - 64 + i * 7.2; g.beginPath(); g.moveTo(x, yb - 50); g.lineTo(x + 0.4, yb); g.stroke(); }
    // window with a little warm light
    const win = [[cx + 34, yb - 34], [cx + 35, yb - 50], [cx + 51, yb - 50], [cx + 50, yb - 34]];
    wash(P, win, pal.warmWin, { mode: 'source-over', layers: 3, spread: 0.4, edge: 0.6, edgeCol: '#c46a2a' });
    g.globalAlpha = 0.9; g.lineWidth = 1.1; g.beginPath(); g.moveTo(cx + 43, yb - 50); g.lineTo(cx + 43, yb - 34); g.moveTo(cx + 35, yb - 42); g.lineTo(cx + 50, yb - 42); g.stroke();
    g.globalAlpha = 1;
    inkStroke(g, [[wl, yb + 2], [wl + 1, yb - 30], [wl + 2, wt]], 1.8, { col: pal.ink, ti: 0.1, to: 0.1 });
    inkStroke(g, [[wr, yb + 2], [wr - 1, yb - 30], [wr - 1, wt]], 1.6, { col: pal.ink, ti: 0.1, to: 0.1 });
    // chimney
    const ch = [[cx + 44, wt - 30], [cx + 46, wt - 62], [cx + 62, wt - 62], [cx + 63, wt - 30]];
    wash(P, ch, pal.stone, { mode: 'source-over', layers: 3, spread: 0.5, edge: 0.5, gran: 0.5 });
    inkStroke(g, ch.concat([ch[0]]), 1.3, { col: pal.ink, ti: 0.05, to: 0.05 });
    // roof: deep snow
    const roof = catmull([[wl - 16, wt + 6], [wl - 20, wt - 4], [wl + 10, wt - 26], [cx - 10, wt - 52], [cx + 30, wt - 56], [wr - 10, wt - 30], [wr + 18, wt - 6], [wr + 14, wt + 6], [cx + 40, wt + 2], [cx - 40, wt + 3]], 5, true);
    wash(P, roof, (tg) => { const gr = tg.createLinearGradient(0, wt - 60, 0, wt + 8); gr.addColorStop(0, pal.snowTop); gr.addColorStop(1, pal.shadow); return gr; }, { mode: 'source-over', layers: 5, spread: 1, edge: 0.35, gran: 0.15 });
    const ridge = roof.slice(4, 34);
    dryBrush(g, ridge.map((p) => [p[0], p[1] + 2]), 5, pal.hi, { n: 7, alpha: 0.85 });
    g.globalAlpha = 0.9; inkLine(g, roof.slice(0, 40), 1.6, { col: pal.ink, gaps: 0.2, ti: 0.05, to: 0.05 }); g.globalAlpha = 1;
    // icicles
    g.fillStyle = pal.hi;
    for (let x = wl - 8; x < wr + 8; x += 5 + RNG() * 7) { const l = 3 + RNG() * 9; g.globalAlpha = 0.85; g.beginPath(); g.moveTo(x - 1.4, wt + 4); g.lineTo(x + 1.4, wt + 4); g.lineTo(x, wt + 4 + l); g.fill(); }
    g.globalAlpha = 1;
    // woodpile
    const wx = wr + 34, wy = gY(wx) - 14;
    for (let row = 0; row < 4; row++) {
      for (let i = 0; i < 5 - row; i++) {
        const lx = wx + i * 15 + row * 7.5 + (RNG() - 0.5) * 2, ly = wy - row * 13 - 6, r = 6.5 + RNG() * 1.5;
        g.fillStyle = pal.wood; g.beginPath(); g.ellipse(lx, ly, r, r * 0.95, 0, 0, TAU); g.fill();
        g.fillStyle = mixh(pal.wood, '#e8c89a', 0.45); g.beginPath(); g.ellipse(lx + 0.6, ly - 0.4, r * 0.7, r * 0.66, 0, 0, TAU); g.fill();
        g.strokeStyle = pal.ink; g.lineWidth = 0.9; g.globalAlpha = 0.85; g.beginPath(); g.ellipse(lx, ly, r, r * 0.95, 0, 0, TAU); g.stroke();
        g.lineWidth = 0.5; g.beginPath(); g.arc(lx + 0.6, ly - 0.4, r * 0.35, 0, TAU); g.stroke(); g.globalAlpha = 1;
      }
    }
    wash(P, lens(wx + 30, wy - 56, 70, 7, 3, 0.4), pal.hi, { mode: 'source-over', layers: 3, spread: 1, edge: 0.2 });
    // chopping block with an axe
    const bx = wx + 92, by = gY(bx) - 6;
    wash(P, [[bx - 11, by], [bx - 10, by - 18], [bx + 10, by - 19], [bx + 11, by]], pal.wood, { mode: 'source-over', layers: 3, spread: 0.4, edge: 0.5, gran: 0.4 });
    g.strokeStyle = pal.ink; g.lineWidth = 1.1; g.beginPath(); g.ellipse(bx, by - 18.5, 10.5, 2.6, 0, 0, TAU); g.stroke();
    inkStroke(g, [[bx + 2, by - 19], [bx + 12, by - 34], [bx + 22, by - 47]], 2.4, { col: pal.woodDark, ti: 0, to: 0.1, min: 0.6 });
    g.fillStyle = '#4a4655'; g.beginPath(); g.moveTo(bx - 4, by - 22); g.lineTo(bx + 6, by - 17); g.lineTo(bx + 7, by - 24); g.closePath(); g.fill();
  }
  // a thin lip of snow drawn in front of the keeper's feet, stool, brazier and pyre
  function paintLip(P, pal, seed) {
    RNG = mulberry32(seed);
    const g = P.g, top = [], x0 = P.ox, x1 = P.ox + P.w;
    for (let x = x0; x <= x1; x += 5) top.push([x, gY(x) + 3 + 2.2 * n1(x * 0.07) + 1.2 * n1(x * 0.3)]);
    const bot = top.slice().reverse().map((p) => [p[0], p[1] + 34]);
    wash(P, top.concat(bot), (tg) => { const gr = tg.createLinearGradient(0, -60, 0, 40); gr.addColorStop(0, mixh(pal.snowTop, pal.snowLow, 0.45)); gr.addColorStop(1, mixh(pal.snowTop, pal.snowLow, 0.6)); return gr; },
      { mode: 'source-over', layers: 4, spread: 0.8, edge: 0, step: 5,
        after: (tg, bx, by, bw, bh) => { // fade the lip downwards so it melts into the field
          tg.globalCompositeOperation = 'destination-in';
          const gr = tg.createLinearGradient(0, 0, 0, 1); gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
          for (let x = bx; x < bx + bw; x += 40) { const y = gY(x + 20); const lg = tg.createLinearGradient(0, y, 0, y + 34); lg.addColorStop(0, 'rgba(0,0,0,1)'); lg.addColorStop(0.45, 'rgba(0,0,0,0.85)'); lg.addColorStop(1, 'rgba(0,0,0,0)'); tg.fillStyle = lg; tg.fillRect(x, by, 41, bh); }
        } });
    dryBrush(g, top.map((p) => [p[0], p[1] + 1]), 2.6, pal.hi, { n: 5, alpha: 0.75, broken: -0.2 });
    // trodden trail: footprints between hut, stool and pyre
    g.strokeStyle = pal.ink;
    for (let x = -40; x < 1180; x += 22 + RNG() * 10) {
      if (x > 1150) break;
      const y = gY(x) + 5 + (RNG() - 0.5) * 3;
      g.fillStyle = rgba(hex(pal.shadow), 0.5); g.beginPath(); g.ellipse(x, y + 1.5, 6, 2.2, 0, 0, TAU); g.fill();
      g.globalAlpha = 0.55; g.lineWidth = 0.9; g.beginPath(); g.ellipse(x, y + 1.5, 6, 2.2, 0, PI * 1.05, PI * 1.95); g.stroke(); g.globalAlpha = 1;
    }
    g.globalAlpha = 0.6; inkLine(g, top, 1.0, { col: pal.ink, gaps: 0.55, ti: 0.01, to: 0.01, gapFreq: 0.12 }); g.globalAlpha = 1;
  }
  function paintFore(P, pal, seed) {
    RNG = mulberry32(seed);
    const g = P.g, x0 = P.ox, x1 = P.ox + P.w, yb = P.oy + P.h;
    const top = [];
    for (let x = x0; x <= x1; x += 6) top.push([x, -42 + 26 * n1(x * 0.004 + 1) + 12 * n1(x * 0.013 + 5) + 5 * n1(x * 0.05)]);
    const poly = top.concat([[x1, yb], [x0, yb]]);
    wash(P, poly, (tg) => { const gr = tg.createLinearGradient(0, -80, 0, yb); gr.addColorStop(0, mixh(pal.snowLow, pal.shadow, 0.3)); gr.addColorStop(0.35, pal.shadow); gr.addColorStop(1, mixh(pal.shadow, pal.rockDark, 0.6)); return gr; },
      { mode: 'source-over', layers: 4, spread: 1.5, edge: 0.3, gran: 0.25, bloom: 0.2, step: 6 });
    dryBrush(g, top.map((p) => [p[0], p[1] + 1.5]), 5, pal.hi, { n: 8, alpha: 0.85, broken: -0.3 });
    for (let k = 0; k < 18; k++) {
      const x = lerp(x0, x1, RNG()), y = lerp(-10, yb - 20, RNG());
      const band = lens(x, y, 120 + RNG() * 260, 6 + RNG() * 10, RNG() * 30, 1.5);
      wash(P, band, pal.shadow, { alpha: 0.4, layers: 5, spread: 3, edge: 0.15 });
      dryBrush(g, band.slice(1, Math.floor(band.length / 2) - 1), 3, pal.hi, { n: 5, alpha: 0.6 });
    }
    // a few rocks and dead stalks breaking the drift
    for (let i = 0; i < 16; i++) {
      const x = lerp(x0 + 40, x1 - 40, RNG());
      const ty = -42 + 26 * n1(x * 0.004 + 1) + 12 * n1(x * 0.013 + 5);
      if (RNG() < 0.55) paintRock(P, pal, x, ty + 18 + RNG() * 30, 60 + RNG() * 120, 26 + RNG() * 50);
      else {
        g.strokeStyle = pal.ink; g.lineCap = 'round';
        for (let j = 0; j < 14; j++) { g.globalAlpha = 0.75; g.lineWidth = 0.8 + RNG() * 0.8; const a = -PI / 2 + (RNG() - 0.5) * 1.1, l = 14 + RNG() * 30, bx = x + (RNG() - 0.5) * 30; g.beginPath(); g.moveTo(bx, ty + 4); g.quadraticCurveTo(bx + Math.cos(a) * l * 0.4, ty + 4 + Math.sin(a) * l * 0.6, bx + Math.cos(a) * l + 5, ty + 4 + Math.sin(a) * l); g.stroke(); }
        g.globalAlpha = 1;
      }
    }
    g.save(); g.globalAlpha = 0.8; inkLine(g, top, 2.2, { col: pal.ink, gaps: 0.3, ti: 0.01, to: 0.01, gapFreq: 0.06 }); g.restore();
  }
  function buildGround() {
    const x0 = -800, w = 3000;
    let P = painter(x0, -180, w, 560, R); paintGround(P, PAL_COOL, SEED * 7 + 1); A.groundC = toLayer(P, 1);
    P = painter(x0, -180, w, 560, R); paintGround(P, PAL_WARM, SEED * 7 + 1); A.groundW = toLayer(P, 1);
  }
  function buildLipFore() {
    let P = painter(-800, -110, 3000, 110, R); paintLip(P, PAL_COOL, SEED * 5 + 3); A.lipC = toLayer(P, 1);
    P = painter(-800, -110, 3000, 110, R); paintLip(P, PAL_WARM, SEED * 5 + 3); A.lipW = toLayer(P, 1);
    P = painter(-900, -110, 3600, 330, R); paintFore(P, PAL_COOL, SEED * 3 + 9); A.foreC = toLayer(P, 1.35);
    P = painter(-900, -110, 3600, 330, R); paintFore(P, PAL_WARM, SEED * 3 + 9); A.foreW = toLayer(P, 1.35);
  }
  /* ================================================================== the pyre & the brazier (sprites) */
  function paintPyre(P, pal, burn, seed) {
    RNG = mulberry32(seed);
    const g = P.g;
    const snow = !burn;
    // dry-stone platform
    const pw = 340;
    const plat = [[-pw / 2, 8], [-pw / 2 + 5, -38], [pw / 2 - 6, -41], [pw / 2, 8]];
    wash(P, plat, burn ? '#3a2422' : pal.stone, { mode: 'source-over', layers: 4, spread: 0.8, gran: 0.5, edge: 0.4 });
    g.save(); polyPath(g, plat); g.clip();
    for (let y = 8; y > -44; y -= 11 + RNG() * 3) {
      let x = -pw / 2 - RNG() * 12;
      while (x < pw / 2) {
        const w = 16 + RNG() * 26, h = 9 + RNG() * 3;
        g.fillStyle = burn ? mixh('#4a2a24', '#1a1012', RNG() * 0.6, 0.8) : mixh(pal.stone, pal.rockDark, RNG() * 0.5, 0.65);
        g.beginPath(); g.ellipse(x + w / 2, y - h / 2, w / 2, h / 2, (RNG() - 0.5) * 0.2, 0, TAU); g.fill();
        g.globalAlpha = 0.7; g.strokeStyle = pal.ink; g.lineWidth = 0.9; g.stroke(); g.globalAlpha = 1;
        x += w + 1.5;
      }
    }
    g.restore();
    inkStroke(g, [[-pw / 2, 8], [-pw / 2 + 3, -18], [-pw / 2 + 5, -38]], 2, { col: pal.ink, ti: 0.1, to: 0.1 });
    inkStroke(g, [[pw / 2, 8], [pw / 2 - 3, -18], [pw / 2 - 6, -41]], 2, { col: pal.ink, ti: 0.1, to: 0.1 });
    if (snow) dryBrush(g, [[-pw / 2 + 4, -39], [-60, -42], [60, -43], [pw / 2 - 6, -42]], 5, pal.hi, { n: 7, alpha: 0.85 });
    // crib of logs
    let y = -40;
    const woodLit = burn ? '#2a1818' : mixh(pal.wood, '#b9a2a8', 0.25);
    const woodSh = burn ? '#140c0e' : pal.woodDark;
    const tops = [];
    for (let i = 0; i < 13; i++) {
      const wB = 286 - i * 12.5, d = 27 - i * 0.55, cx = (RNG() - 0.5) * 5 + i * 0.5;
      if (i % 2 === 0) {
        // two end-on logs and the stuffed interior between them
        const rl = d / 2 * (0.95 + RNG() * 0.1), rr = d / 2 * (0.95 + RNG() * 0.1);
        const xl = cx - wB / 2 + rl, xr = cx + wB / 2 - rr, yc = y - d / 2;
        // interior
        const inter = [[xl, y + 1], [xl, y - d - 1], [xr, y - d - 1], [xr, y + 1]];
        if (burn) {
          wash(P, inter, (tg) => { const gr = tg.createLinearGradient(0, y - d, 0, y); gr.addColorStop(0, '#ffcf6a'); gr.addColorStop(1, '#ff7a2a'); return gr; }, { mode: 'source-over', layers: 3, spread: 0.6, edge: 0.3, edgeCol: '#c2361c' });
        } else {
          wash(P, inter, '#2e2531', { mode: 'source-over', layers: 3, spread: 0.6, edge: 0.3, gran: 0.4 });
        }
        g.save(); polyPath(g, inter); g.clip(); g.lineCap = 'round';
        for (let k = 0; k < (xr - xl) * 0.9; k++) {
          const tx = lerp(xl, xr, RNG()), ty = lerp(y - d, y, RNG()), a = (RNG() - 0.5) * 2.2, l = 6 + RNG() * 18;
          const straw = RNG() < 0.35;
          g.strokeStyle = burn ? (straw ? '#3a1410' : '#1a0c0c') : straw ? pal.straw : (RNG() < 0.5 ? '#6a5244' : pal.ink);
          g.globalAlpha = burn ? 0.85 : 0.75; g.lineWidth = straw ? 0.7 : 0.9 + RNG() * 1.2;
          g.beginPath(); g.moveTo(tx, ty); g.lineTo(tx + Math.cos(a) * l, ty + Math.sin(a) * l * 0.6); g.stroke();
        }
        g.restore(); g.globalAlpha = 1;
        // end grain
        for (const [ex, er] of [[xl, rl], [xr, rr]]) {
          g.fillStyle = woodSh; g.beginPath(); g.arc(ex, yc, er, 0, TAU); g.fill();
          g.fillStyle = burn ? '#24130f' : mixh('#c9a37c', pal.snowLow, 0.25); g.beginPath(); g.arc(ex + 0.4, yc - 0.3, er * 0.82, 0, TAU); g.fill();
          g.strokeStyle = burn ? '#ff8a3a' : pal.ink; g.globalAlpha = burn ? 0.8 : 0.45; g.lineWidth = 0.6;
          for (let r = er * 0.2; r < er * 0.8; r += er * 0.18) { g.beginPath(); g.arc(ex + 0.4, yc - 0.3, r, 0, TAU); g.stroke(); }
          g.beginPath(); g.moveTo(ex, yc); g.lineTo(ex + er * 0.7, yc - er * 0.4); g.stroke();
          g.globalAlpha = 1; g.strokeStyle = pal.ink; g.lineWidth = 1.5; g.beginPath(); g.arc(ex, yc, er, 0, TAU); g.stroke();
          if (snow) { g.fillStyle = pal.hi; g.globalAlpha = 0.9; g.beginPath(); g.ellipse(ex, yc - er * 0.85, er * 0.75, er * 0.28, 0, PI, TAU); g.fill(); g.globalAlpha = 1; }
          if (burn) { g.strokeStyle = '#ff6a28'; g.globalAlpha = 0.9; g.lineWidth = 1.4; g.beginPath(); g.arc(ex, yc, er * 0.98, 0.2, PI - 0.2); g.stroke(); g.globalAlpha = 1; }
        }
        if (i === 0) A.pyreDoor = [xl + 30, y - d / 2];
        y -= d * 0.9;
      } else {
        // a log lying across
        const L = wB + 18, tilt = (RNG() - 0.5) * 3.5;
        const lx0 = cx - L / 2, lx1 = cx + L / 2;
        const lp = [];
        for (let k = 0; k <= 16; k++) { const u = k / 16; lp.push([lerp(lx0, lx1, u), y - d + tilt * u + n1(i * 9 + u * 5) * 1.2]); }
        const lb = lp.slice().reverse().map((p) => [p[0], p[1] + d]);
        const logp = lp.concat(lb);
        wash(P, logp, (tg) => { const gr = tg.createLinearGradient(0, y - d, 0, y); gr.addColorStop(0, woodLit); gr.addColorStop(1, woodSh); return gr; }, { mode: 'source-over', layers: 3, spread: 0.5, edge: 0.5, gran: 0.45 });
        g.save(); polyPath(g, logp); g.clip();
        g.strokeStyle = burn ? '#0c0606' : pal.ink; g.lineCap = 'round';
        for (let k = 0; k < L / 7; k++) {
          const bx = lerp(lx0, lx1, RNG()), by = y - d * (0.15 + RNG() * 0.8) + tilt * ((bx - lx0) / L), bl = 10 + RNG() * 34;
          g.globalAlpha = 0.35 + RNG() * 0.35; g.lineWidth = 0.6 + RNG() * 0.8;
          g.beginPath(); g.moveTo(bx, by); g.lineTo(bx + bl, by + (RNG() - 0.5) * 1.5); g.stroke();
        }
        if (burn) {
          g.strokeStyle = '#ff7a2e'; g.lineWidth = 1.1;
          for (let k = 0; k < L / 30; k++) { const bx = lerp(lx0, lx1, RNG()), by = y - d * (0.3 + RNG() * 0.6); g.globalAlpha = 0.6 + RNG() * 0.4; g.beginPath(); g.moveTo(bx, by); for (let s = 0; s < 4; s++) g.lineTo(bx + s * 4 + RNG() * 3, by + (RNG() - 0.5) * 4); g.stroke(); }
          const gl = g.createLinearGradient(0, y - 6, 0, y); gl.addColorStop(0, 'rgba(255,110,40,0)'); gl.addColorStop(1, 'rgba(255,120,40,0.85)'); g.globalAlpha = 1; g.fillStyle = gl; g.fillRect(lx0, y - 8, L, 9);
        }
        g.restore(); g.globalAlpha = 1;
        // knot and cut ends
        g.strokeStyle = pal.ink; g.lineWidth = 1;
        g.beginPath(); g.ellipse(lerp(lx0, lx1, 0.2 + RNG() * 0.6), y - d * 0.5, 3, 1.8, 0, 0, TAU); g.stroke();
        inkStroke(g, lp, 1.6, { col: pal.ink, ti: 0.03, to: 0.03 });
        inkStroke(g, lb, 1.9, { col: pal.ink, ti: 0.03, to: 0.03 });
        for (const ex of [lx0, lx1]) { const yy = y - d / 2 + tilt * (ex === lx0 ? 0 : 1); g.fillStyle = burn ? '#3a1a12' : mixh('#c9a37c', pal.snowLow, 0.3); g.beginPath(); g.ellipse(ex, yy, 4, d / 2, 0, 0, TAU); g.fill(); g.lineWidth = 1.3; g.stroke(); }
        if (snow) dryBrush(g, lp.map((p) => [p[0], p[1] + 1]), 4.5, pal.hi, { n: 6, alpha: 0.9, broken: -0.4, trim: 0.15 });
        y -= d * 0.92;
      }
      tops.push(y);
    }
    // crown of brushwood bundles and a pole with a pitch-head
    const crY = y + 4;
    const crown = [];
    for (let k = 0; k <= 20; k++) { const u = k / 20, a = PI + u * PI; crown.push([Math.cos(a) * 92 + (RNG() - 0.5) * 8, crY + Math.sin(a) * 52 + (RNG() - 0.5) * 8]); }
    wash(P, crown, burn ? '#1c1012' : '#3a2e34', { mode: 'source-over', layers: 4, spread: 1.2, edge: 0.4, gran: 0.5 });
    g.save(); polyPath(g, crown); g.clip(); g.lineCap = 'round';
    for (let k = 0; k < 260; k++) {
      const a = PI + RNG() * PI, rr = Math.sqrt(RNG()) * 92;
      const tx = Math.cos(a) * rr, ty = crY + Math.sin(a) * rr * 0.56;
      const ang = a + (RNG() - 0.5) * 0.8, l = 8 + RNG() * 22;
      g.strokeStyle = burn ? (RNG() < 0.3 ? '#ff8a3a' : '#0c0606') : RNG() < 0.3 ? pal.straw : RNG() < 0.5 ? '#6a5244' : pal.ink;
      g.globalAlpha = 0.8; g.lineWidth = 0.7 + RNG() * 1.1;
      g.beginPath(); g.moveTo(tx, ty); g.lineTo(tx + Math.cos(ang) * l, ty + Math.sin(ang) * l * 0.7); g.stroke();
    }
    g.restore(); g.globalAlpha = 1;
    g.lineCap = 'round'; g.strokeStyle = pal.ink;
    for (let k = 0; k < 40; k++) { const a = PI + 0.15 + RNG() * (PI - 0.3); const x0 = Math.cos(a) * 88, y0 = crY + Math.sin(a) * 50; g.lineWidth = 0.8 + RNG(); g.globalAlpha = 0.8; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x0 + Math.cos(a) * (6 + RNG() * 14), y0 + Math.sin(a) * (6 + RNG() * 14)); g.stroke(); }
    g.globalAlpha = 1;
    if (snow) {
      const cap = crown.slice(3, 18).map((p) => [p[0] * 0.92, p[1] + 3]);
      dryBrush(g, cap, 9, pal.hi, { n: 9, alpha: 0.9, broken: -0.5 });
    }
    inkLine(g, crown.slice(0, 21), 1.8, { col: pal.ink, gaps: 0.3, ti: 0.05, to: 0.05 });
    const poleTop = crY - 150;
    inkStroke(g, [[2, crY + 10], [3, crY - 60], [5, poleTop]], 6.5, { col: burn ? '#120a0a' : pal.woodDark, ti: 0, to: 0.05, min: 0.7, vr: 0.1 });
    const head = [[-9, poleTop + 22], [-11, poleTop + 4], [-4, poleTop - 14], [10, poleTop - 12], [17, poleTop + 6], [13, poleTop + 24]];
    wash(P, catmull(head, 3, true), burn ? '#2a1210' : pal.straw, { mode: 'source-over', layers: 3, spread: 0.6, edge: 0.6, gran: 0.4 });
    g.strokeStyle = pal.ink; g.lineWidth = 1.4;
    for (let k = 0; k < 3; k++) { const yy = poleTop + 2 + k * 8; g.beginPath(); g.moveTo(-10, yy); g.quadraticCurveTo(3, yy + 3, 15, yy); g.stroke(); }
    if (snow) dryBrush(g, [[-6, poleTop - 12], [3, poleTop - 15], [11, poleTop - 12]], 4, pal.hi, { n: 5, alpha: 0.9 });
    A.pyreTop = crY; A.pyrePole = poleTop;
  }
  function buildPyre() {
    const r = R * 1.25;
    let P = painter(-230, -640, 460, 660, r); paintPyre(P, PAL_COOL, false, SEED * 11 + 2); A.pyreC = { c: gpu(P.c), x: -230, y: -640, w: 460, h: 660 };
    P = painter(-230, -640, 460, 660, r); paintPyre(P, PAL_COOL, true, SEED * 11 + 2); A.pyreB = { c: gpu(P.c), x: -230, y: -640, w: 460, h: 660 };
    // brazier
    P = painter(-50, -70, 100, 80, R * 1.6); RNG = mulberry32(SEED + 404);
    const g = P.g;
    for (const [a, b] of [[[-15, -36], [-27, 2]], [[15, -36], [29, 2]], [[1, -33], [3, 4]]]) inkStroke(g, [a, [lerp(a[0], b[0], 0.5) + 1, lerp(a[1], b[1], 0.5)], b], 3, { col: '#26202a', ti: 0, to: 0.15, min: 0.5 });
    const bowl = [[-31, -46]]; for (let k = 0; k <= 12; k++) { const a = (k / 12) * PI; bowl.push([-Math.cos(a) * 31, -46 + Math.sin(a) * 15]); }
    wash(P, bowl, (tg) => { const gr = tg.createLinearGradient(0, -46, 0, -31); gr.addColorStop(0, '#5a4a52'); gr.addColorStop(1, '#231c22'); return gr; }, { mode: 'source-over', layers: 3, spread: 0.4, gran: 0.6, edge: 0.5 });
    g.fillStyle = '#7a3e2a'; g.globalAlpha = 0.5; for (let k = 0; k < 14; k++) blob(g, -24 + RNG() * 48, -42 + RNG() * 8, 1 + RNG() * 2.5, 6, 0.5); g.globalAlpha = 1;
    inkStroke(g, bowl.slice(1), 1.8, { col: INK, ti: 0.05, to: 0.05 });
    g.strokeStyle = '#b6a6c6'; g.lineWidth = 1.4; g.globalAlpha = 0.8; g.beginPath(); g.moveTo(-30, -46.5); g.lineTo(30, -46.5); g.stroke();
    g.strokeStyle = INK; g.globalAlpha = 1; g.lineWidth = 1.2; g.beginPath(); g.ellipse(0, -46, 31, 3.5, 0, 0, TAU); g.stroke();
    A.brazier = { c: gpu(P.c), x: -50, y: -70, w: 100, h: 80 };
  }
  function drawSprite(g, s, x, y, sc) {
    sc = sc || 1;
    g.drawImage(s.c, x + s.x * sc, y + s.y * sc, s.w * sc, s.h * sc);
  }
  /* ================================================================== living things: fire, sparks, smoke, snow */
  const FIRE_COLS = [['#b8301e', 0.6, 1.0, 1.0], ['#ee6a28', 0.78, 0.84, 0.82], ['#ffae3c', 0.88, 0.62, 0.62], ['#ffe7a0', 0.92, 0.34, 0.38]];
  function tongue(g, bx, by, tw, th, t, s, lean, sway) {
    const k = 9, L = [], Rr = [];
    for (let j = 0; j <= k; j++) {
      const v = j / k, yy = by - th * v;
      const off = (n2(s, t * 3.1 - v * 2.4) * sway * 0.3 * v * v + lean * v * v) * th;
      const hw = (tw / 2) * Math.pow(1 - v, 1.15) * Math.min(1, v * 2.6 + 0.55) * (1 + 0.12 * n2(s + 3, t * 4 + v * 3));
      L.push([bx + off - hw, yy]); Rr.push([bx + off + hw, yy]);
    }
    g.beginPath(); g.moveTo(Rr[0][0], Rr[0][1]);
    for (let j = 1; j <= k; j++) { const a = Rr[j - 1], b = Rr[j]; g.quadraticCurveTo(a[0], a[1], (a[0] + b[0]) / 2, (a[1] + b[1]) / 2); }
    g.lineTo(L[k][0], L[k][1]);
    for (let j = k - 1; j >= 0; j--) { const a = L[j + 1], b = L[j]; g.quadraticCurveTo(a[0], a[1], (a[0] + b[0]) / 2, (a[1] + b[1]) / 2); }
    g.closePath(); g.fill();
    return [L[k][0], L[k][1]];
  }
  // a fire: base centre (x,y), width w, height h; world units in the current transform
  // low-resolution buffers: big soft things (glows, the great fire) are painted at half or quarter size
  let GLB = null, FXB = null;
  function lowCtx(B, g, x0, y0, x1, y1) {
    const m = g.getTransform(), k = B.k;
    B.g.setTransform(m.a * k, m.b * k, m.c * k, m.d * k, m.e * k, m.f * k);
    const p = [[x0, y0], [x1, y0], [x0, y1], [x1, y1]].map(([x, y]) => [m.a * x + m.c * y + m.e, m.b * x + m.d * y + m.f]);
    for (const q of p) { B.bb[0] = Math.min(B.bb[0], q[0]); B.bb[1] = Math.min(B.bb[1], q[1]); B.bb[2] = Math.max(B.bb[2], q[0]); B.bb[3] = Math.max(B.bb[3], q[1]); }
    B.dirty = true;
    return B.g;
  }
  function flushLow(g, B, mode) {
    if (!B || !B.dirty) return;
    const k = B.k, W0 = FR.c.width, H0 = FR.c.height;
    const x0 = clamp(Math.floor(B.bb[0] * k) - 2, 0, B.c.width), y0 = clamp(Math.floor(B.bb[1] * k) - 2, 0, B.c.height);
    const x1 = clamp(Math.ceil(B.bb[2] * k) + 2, 0, B.c.width), y1 = clamp(Math.ceil(B.bb[3] * k) + 2, 0, B.c.height);
    if (x1 > x0 && y1 > y0) {
      g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = mode || 'source-over';
      g.drawImage(B.c, x0, y0, x1 - x0, y1 - y0, x0 / k, y0 / k, (x1 - x0) / k, (y1 - y0) / k);
      g.restore();
      B.g.setTransform(1, 0, 0, 1, 0, 0); B.g.clearRect(x0, y0, x1 - x0, y1 - y0);
    }
    B.dirty = false; B.bb = [1e9, 1e9, -1e9, -1e9];
    void W0; void H0;
  }
  function fire(g, x, y, w, h, t, sd, o) {
    o = o || {};
    if (FXB && FXB.on && !o.hi && w * Math.abs(g.getTransform().a) > 90) { const gg = lowCtx(FXB, g, x - w * 1.4, y - h * 1.5, x + w * 1.4, y + 10); o = Object.assign({}, o, { hi: true }); fire(gg, x, y, w, h, t, sd, o); return; }
    const n = o.n || Math.max(2, Math.round(w / 16)), lean = o.lean || 0, sway = o.sway === undefined ? 1 : o.sway;
    const a0 = o.alpha === undefined ? 1 : o.alpha;
    g.save();
    const tips = [];
    for (let li = 0; li < FIRE_COLS.length; li++) {
      const [col, al, hs, ws] = FIRE_COLS[li];
      const cc = hex(col); g.globalAlpha = al * a0;
      for (let i = 0; i < n; i++) {
        const u = n === 1 ? 0.5 : i / (n - 1);
        const bx = x + (u - 0.5) * w * 0.8 * ws + n1(sd + i * 3.1) * w * 0.04;
        const bell = 1 - Math.pow(Math.abs(u - 0.5) * 2, 1.5) * 0.62;
        const fl = 0.7 + 0.38 * (n2(sd + i * 1.7, t * 2.6 + li * 0.13) * 0.5 + 0.5) + 0.08 * Math.sin(t * 13 + i * 2.1);
        const th = h * hs * bell * fl;
        const tw = (w / n) * 2.7 * ws;
        const gr = g.createLinearGradient(0, y, 0, y - th); gr.addColorStop(0, rgba(cc, 1)); gr.addColorStop(0.5, rgba(cc, 0.92)); gr.addColorStop(0.85, rgba(cc, 0.35)); gr.addColorStop(1, rgba(cc, 0));
        g.fillStyle = gr;
        const tip = tongue(g, bx, y, tw, th, t, sd + i * 5.3, lean, sway);
        if (li === 0) tips.push([tip, tw, th, i]);
      }
    }
    // licks that tear away above the tongues
    g.fillStyle = '#f37a2c';
    for (const [tip, tw, th, i] of tips) {
      for (let m = 0; m < 2; m++) {
        const ph = fract(t * (1.1 + hr(i, m + 7) * 0.9) + hr(i, m + 3));
        if (ph > 0.55 || th > 260) continue;
        const q = ph / 0.55;
        g.globalAlpha = 0.5 * (1 - q) * a0;
        tongue(g, tip[0] + lean * th * 0.2 * q + (hr(i, m) - 0.5) * tw * 0.4, tip[1] + th * 0.12 - th * 0.22 * q, tw * 0.3 * (1 - q * 0.6), th * 0.16 * (1 - q * 0.5), t, sd + i * 11 + m, lean, sway * 0.5);
      }
    }
    // a few ink flicks: the drawn edge of the fire
    if (o.ink !== false) {
      g.strokeStyle = '#7c2214'; g.lineWidth = o.inkW || 1; g.lineCap = 'round';
      for (const [tip, tw, th, i] of tips) {
        if (hr(i, Math.floor(t * 8)) < 0.55) continue;
        g.globalAlpha = 0.45 * a0;
        g.beginPath(); g.moveTo(tip[0] - tw * 0.3, tip[1] + th * 0.45); g.quadraticCurveTo(tip[0] - tw * 0.15, tip[1] + th * 0.15, tip[0], tip[1]); g.stroke();
      }
    }
    g.restore();
  }
  function glow(g, x, y, r, col, a, mode) {
    if (a <= 0.003 || r <= 0) return;
    if (mode === 'soft-light') { mode = 'screen'; a *= 0.5; }
    if (GLB && GLB.on && (!mode || mode === 'screen') && r * Math.abs(g.getTransform().a) > 60) {
      const gg = lowCtx(GLB, g, x - r, y - r, x + r, y + r);
      gg.save(); gg.globalCompositeOperation = 'lighter';
      const gr = gg.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, rgba(col, a)); gr.addColorStop(0.25, rgba(col, a * 0.55)); gr.addColorStop(0.6, rgba(col, a * 0.16)); gr.addColorStop(1, rgba(col, 0));
      gg.fillStyle = gr; gg.fillRect(x - r, y - r, r * 2, r * 2); gg.restore();
      return;
    }
    g.save(); g.globalCompositeOperation = mode || 'screen';
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, rgba(col, a)); gr.addColorStop(0.25, rgba(col, a * 0.55)); gr.addColorStop(0.6, rgba(col, a * 0.16)); gr.addColorStop(1, rgba(col, 0));
    g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
    g.restore();
  }
  // embers: births at a steady rate from t0; each spark is a pure function of its age
  function sparks(g, src, t, o) {
    const rate = o.rate, life = o.life || 2.2, t0 = o.t0 || 0, t1 = o.t1 === undefined ? 1e9 : o.t1;
    const dt = 1 / rate;
    const i0 = Math.max(0, Math.floor((t - life - t0) / dt)), i1 = Math.floor((Math.min(t, t1) - t0) / dt);
    g.save(); g.lineCap = 'round';
    for (let i = i0; i <= i1; i++) {
      const sid = i + (o.sd || 0) * 1000;
      const b = t0 + i * dt + hr(sid, 1) * dt, age = t - b, L = life * (0.45 + hr(sid, 2) * 0.55);
      if (age < 0 || age > L) continue;
      const q = age / L;
      const vx = (hr(sid, 3) - 0.5) * (o.spreadV || 80) + (o.wind || 0), vy = -(o.up || 160) * (0.5 + hr(sid, 4));
      let x0, y0;
      if (o.srcAt) { const q = o.srcAt(b); if (!q) continue; x0 = q[0]; y0 = q[1]; }
      else { x0 = src.x + (hr(sid, 5) - 0.5) * src.w; y0 = src.y - hr(sid, 6) * (src.h || 0); }
      const curl = Math.sin(age * (2 + hr(sid, 7) * 3) + hr(sid, 8) * 6) * 14 * age;
      const x = x0 + vx * age + curl + (o.windA || 0) * age * age, y = y0 + vy * age + 22 * age * age * (o.grav || 0);
      const vxx = vx + Math.cos(age * 3) * 20 + 2 * (o.windA || 0) * age, vyy = vy;
      const sz = (o.size || 2) * (0.5 + hr(sid, 9));
      const a = (1 - q) * (q < 0.08 ? q / 0.08 : 1) * (o.alpha || 1);
      const flick = 0.6 + 0.4 * Math.sin(age * 30 + i);
      g.globalAlpha = a * flick;
      g.strokeStyle = q < 0.4 ? '#fff4c8' : q < 0.7 ? '#ffc35a' : '#ff7a32';
      g.lineWidth = sz;
      const sl = 0.035;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x - vxx * sl, y - vyy * sl); g.stroke();
    }
    g.restore();
  }
  // soft watercolour smoke puffs
  function smoke(g, src, t, o) {
    if (FXB && FXB.on && !o.hi && (o.r0 || 14) * Math.abs(g.getTransform().a) > 30) { const R0 = (o.r0 || 14) + (o.grow || 18) * (o.life || 5); const gg = lowCtx(FXB, g, src.x - src.w - R0 - 400, src.y - (o.up || 60) * 1.4 * (o.life || 5) - R0 - (o.acc || 0) * 49, src.x + src.w + R0 + 400, src.y + R0); smoke(gg, src, t, Object.assign({}, o, { hi: true })); return; }
    const rate = o.rate, life = o.life || 5, t0 = o.t0 || 0, t1 = o.t1 === undefined ? 1e9 : o.t1, dt = 1 / rate;
    const i0 = Math.max(0, Math.floor((t - life - t0) / dt)), i1 = Math.floor((Math.min(t, t1) - t0) / dt);
    for (let i = i0; i <= i1; i++) {
      const sid = i + (o.sd || 0) * 1000;
      const b = t0 + i * dt + hr(sid, 1) * dt, age = t - b, L = life * (0.7 + hr(sid, 2) * 0.3);
      if (age < 0 || age > L) continue;
      const q = age / L;
      const rise = (o.up || 60) * (0.7 + hr(sid, 3) * 0.6);
      const x = src.x + (hr(sid, 4) - 0.5) * src.w + (o.wind || 0) * age + (o.windA || 0) * age * age + Math.sin(age * 0.9 + i) * 8 * age;
      const y = src.y - rise * age - (o.acc || 0) * age * age;
      const r = (o.r0 || 14) + (o.grow || 18) * age;
      const a = (o.alpha || 0.4) * Math.sin(PI * Math.min(1, q * 1.15)) * (q < 0.1 ? q / 0.1 : 1);
      const spr = A.smoke[(i % A.smoke.length)];
      const warm = o.warm ? clamp(1 - age * (o.warmFade || 0.8), 0, 1) * o.warm : 0;
      g.globalAlpha = a * (1 - warm * 0.6);
      g.drawImage(spr.cool, x - r, y - r, r * 2, r * 2);
      if (warm > 0.02) { g.globalAlpha = a * warm; g.drawImage(spr.warm, x - r, y - r, r * 2, r * 2); }
    }
    g.globalAlpha = 1;
  }
  function buildSmoke() {
    A.smoke = [];
    for (let k = 0; k < 4; k++) {
      const make = (col, dark) => {
        const P = painter(-50, -50, 100, 100, Math.min(1.5, R));
        RNG = mulberry32(SEED * 17 + k);
        wash(P, ellipsePts(0, 0, 36, 33, 18, RNG, 0.35), (tg) => { const gr = tg.createRadialGradient(0, 0, 0, 0, 0, 44); gr.addColorStop(0, col); gr.addColorStop(0.7, rgba(hex(dark), 0.8)); gr.addColorStop(1, rgba(hex(dark), 0)); return gr; },
          { mode: 'source-over', layers: 6, spread: 4, edge: 0.15, bloom: 0.35, bscale: 0.5, gran: 0.2 });
        return gpu(P.c);
      };
      A.smoke.push({ cool: make('#8f87a3', '#6e6684'), warm: make('#e79a6a', '#b86a54') });
    }
  }
  // falling snow in screen space with depth parallax
  function snowfall(g, t, cam, o) {
    g.save(); g.fillStyle = o.col || '#f6f3ee';
    for (let L = 0; L < o.layers.length; L++) {
      const s = o.layers[L], Zp = 1 + (cam.Z - 1) * s.p;
      const spanX = W + 200, spanY = H + 200;
      for (let i = 0; i < s.n; i++) {
        const sid = i + L * 977;
        const sp = s.speed * (0.7 + hr(sid, 2) * 0.6);
        const x0 = hr(sid, 0) * spanX, y0 = hr(sid, 1) * spanY;
        const sway = Math.sin(t * (0.6 + hr(sid, 3)) + hr(sid, 4) * 6) * s.sway;
        let x = x0 + (o.wind || 0) * s.windK * t + sway - cam.X * s.p * Zp;
        let y = y0 + sp * t - cam.Y * s.p * Zp;
        x = ((x % spanX) + spanX) % spanX - 100; y = ((y % spanY) + spanY) % spanY - 100;
        const r = s.size * (0.5 + hr(sid, 5)) * Zp;
        g.globalAlpha = s.alpha * (0.5 + hr(sid, 6) * 0.5);
        if (s.soft) { g.drawImage(A.flake, x - r * 2, y - r * 2, r * 4, r * 4); }
        else { g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); }
      }
    }
    g.restore();
  }
  function buildFlake() {
    const c = mk(64, 64), g = c.getContext('2d');
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(250,248,244,1)'); gr.addColorStop(0.35, 'rgba(250,248,244,0.85)'); gr.addColorStop(0.5, 'rgba(250,248,244,0.25)'); gr.addColorStop(1, 'rgba(250,248,244,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    A.flake = c;
  }

  /* ================================================================== camera & compositing */
  let S = 1, R = 1;
  let FR = null, B2 = null, LT = null, MK = null, CH = null, RM = null;
  function camT(g, cam, p, abs) {
    const Zp = 1 + (cam.Z - 1) * p;
    g.setTransform(S, 0, 0, S, 0, 0);
    g.translate(W / 2, H / 2);
    if (cam.rot) g.rotate(cam.rot);
    g.scale(Zp, Zp);
    g.translate(-cam.X * p, -cam.Y * p);
    if (abs) g.translate(-W / 2, -H / 2);
  }
  function drawLayer(g, L, cam, alpha) {
    if (!L) return;
    camT(g, cam, L.p, L.abs);
    const Zp = 1 + (cam.Z - 1) * L.p, hw = (W / 2) / Zp + 60, ax = L.abs ? W / 2 : 0;
    const vx0 = cam.X * L.p - hw + ax, vx1 = cam.X * L.p + hw + ax;
    if (alpha !== undefined) g.globalAlpha = alpha;
    for (const t of L.tiles) if (t.x < vx1 && t.x + t.w > vx0) g.drawImage(t.c, t.x, L.y0, t.c.width / L.R, L.h);
    g.globalAlpha = 1;
  }
  // screen-space light mask (white where firelight falls), built per frame
  let LIGHTS = [], LBB = null;
  function buildMask(cam) {
    LBB = null;
    const ls = LIGHTS.filter((l) => l.a > 0.01);
    if (!ls.length) return;
    const m = MK.g; m.setTransform(1, 0, 0, 1, 0, 0); m.clearRect(0, 0, MK.c.width, MK.c.height);
    camT(m, cam, 1);
    m.globalCompositeOperation = 'lighter';
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    const Z = cam.Z;
    for (const l of ls) {
      const gr = m.createRadialGradient(l.x, l.y, 0, l.x, l.y, l.r);
      gr.addColorStop(0, 'rgba(255,255,255,' + clamp(l.a, 0, 1) + ')'); gr.addColorStop(0.35, 'rgba(255,255,255,' + clamp(l.a * 0.62, 0, 1) + ')'); gr.addColorStop(0.7, 'rgba(255,255,255,' + clamp(l.a * 0.18, 0, 1) + ')'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      m.fillStyle = gr; m.fillRect(l.x - l.r, l.y - (l.ry || l.r), l.r * 2, (l.ry || l.r) * 2);
      const sx = (W / 2 + Z * (l.x - cam.X)) * S, sy = (H / 2 + Z * (l.y - cam.Y)) * S, sr = l.r * Z * S;
      x0 = Math.min(x0, sx - sr); y0 = Math.min(y0, sy - sr); x1 = Math.max(x1, sx + sr); y1 = Math.max(y1, sy + sr);
    }
    m.globalCompositeOperation = 'source-over';
    x0 = Math.max(0, Math.floor(x0)); y0 = Math.max(0, Math.floor(y0)); x1 = Math.min(FR.c.width, Math.ceil(x1)); y1 = Math.min(FR.c.height, Math.ceil(y1));
    if (x1 > x0 && y1 > y0) LBB = [x0, y0, x1 - x0, y1 - y0];
  }
  function drawLit(g, Lc, Lw, cam, k) {
    drawLayer(g, Lc, cam);
    if (!LBB || !Lw) return;
    const [x, y, w, h] = LBB, l = LT.g;
    l.setTransform(1, 0, 0, 1, 0, 0); l.clearRect(x, y, w, h);
    l.save(); l.beginPath(); l.rect(x, y, w, h); l.clip();
    drawLayer(l, Lw, cam);
    l.setTransform(1, 0, 0, 1, 0, 0);
    l.globalCompositeOperation = 'destination-in';
    l.drawImage(MK.c, x, y, w, h, x, y, w, h);
    l.globalCompositeOperation = 'source-over';
    l.restore();
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = k === undefined ? 1 : k;
    g.drawImage(LT.c, x, y, w, h, x, y, w, h);
    g.restore();
  }
  function shake(t, t0, dur, amp) {
    if (t < t0 || t > t0 + dur) return [0, 0, 0];
    const q = (t - t0) / dur, e = Math.pow(1 - q, 2) * amp;
    return [n2(t * 22, 1) * e, n2(t * 22, 9) * e, n2(t * 17, 5) * e * 0.004];
  }
  function hand(t, a) { return [n2(t * 0.35, 3.3) * a, n2(t * 0.3, 7.7) * a * 0.7, n2(t * 0.25, 11) * a * 0.0011]; }
  /* ================================================================== THE KEEPER — a rigged ink-and-wash figure */
  const up = (a) => [Math.sin(a), -Math.cos(a)];
  const dn = (a) => [Math.sin(a), Math.cos(a)];
  const add = (p, v, k) => [p[0] + v[0] * k, p[1] + v[1] * k];
  function buildCloth() {
    const mkTex = (col, dark, fn) => {
      const P = painter(0, 0, 160, 160, Math.min(R, 2));
      const g = P.g; g.fillStyle = col; g.fillRect(0, 0, 160, 160);
      wash(P, [[-10, -10], [170, -10], [170, 170], [-10, 170]], dark, { alpha: 0.35, layers: 3, spread: 6, edge: 0, bloom: 0.6, bscale: 0.6, gran: 0.6 });
      if (fn) fn(P);
      const gc = gpu(P.c);
      const p = gc.getContext('2d').createPattern(gc, 'repeat');
      return { c: gc, R: P.R, pat: p };
    };
    RNG = mulberry32(SEED * 23 + 1);
    A.cloth = {
      cloak: mkTex('#353b5a', '#1c2036', (P) => { const g = P.g; g.strokeStyle = '#262a3c'; g.lineCap = 'round'; for (let i = 0; i < 260; i++) { const x = RNG() * 160, y = RNG() * 160; g.globalAlpha = 0.25; g.lineWidth = 0.5; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 2 + RNG() * 3, y + 6 + RNG() * 8); g.stroke(); } g.strokeStyle = '#8a93ad'; for (let i = 0; i < 120; i++) { const x = RNG() * 160, y = RNG() * 160; g.globalAlpha = 0.25; g.lineWidth = 0.5; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 1, y + 4); g.stroke(); } }),
      lining: mkTex('#9a3c30', '#5a2020'),
      coat: mkTex('#5a6050', '#2e3428', (P) => { const g = P.g; g.lineCap = 'round'; for (let i = 0; i < 300; i++) { const x = RNG() * 160, y = RNG() * 160; g.strokeStyle = RNG() < 0.6 ? 'rgba(30,34,26,0.35)' : 'rgba(160,170,140,0.3)'; g.lineWidth = 0.5; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 1 + RNG() * 2, y + 5 + RNG() * 6); g.stroke(); } }),
      tunic: mkTex('#4a3a3a', '#262024'),
      skin: mkTex('#d29a7c', '#a86a5c', (P) => { const g = P.g; for (let i = 0; i < 40; i++) { g.fillStyle = RNG() < 0.5 ? 'rgba(190,100,90,0.25)' : 'rgba(120,80,90,0.18)'; blob(g, RNG() * 160, RNG() * 160, 2 + RNG() * 6, 7, 0.5); } }),
      boot: mkTex('#3b2d29', '#1d1517'),
      beard: mkTex('#e9e4dc', '#b4adb5', (P) => { const g = P.g; g.strokeStyle = '#9d97a6'; for (let i = 0; i < 200; i++) { const x = RNG() * 160, y = RNG() * 160; g.globalAlpha = 0.4; g.lineWidth = 0.5; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 0.5, y + 7); g.stroke(); } }),
    };
  }
  function clothFill(g, key, m) {
    const c = A.cloth[key];
    const mat = new DOMMatrix([m.a, m.b, m.c, m.d, m.e, m.f]).scale(1 / c.R);
    c.pat.setTransform(mat);
    return c.pat;
  }
  // boil: hand-drawn line jitter that changes 12 times a second
  let BOIL = 0;
  function jit(pts, amp, k) {
    if (!amp) return pts;
    return pts.map((p, i) => [p[0] + n2(BOIL * 7.13 + i * 0.37, k) * amp, p[1] + n2(BOIL * 5.71 + i * 0.41, k + 3) * amp]);
  }
  function outline(g, pts, w, col, k, closed) {
    const P0 = closed ? pts.concat([pts[0], pts[1]]) : pts;
    const q = jit(P0, 0.35, k);
    g.fillStyle = col || INK;
    inkStroke(g, q, w, { ti: 0.06, to: 0.08, vr: 0.45, sd: k * 3.3, min: 0.25 });
  }
  function limb3(a, b, c, wa, wb, wc) {
    // tapered polygon through three joints
    const pts = catmull([a, b, c], 6, false);
    const L = [], Rr = [];
    for (let i = 0; i < pts.length; i++) {
      const u = i / (pts.length - 1);
      const w = u < 0.5 ? lerp(wa, wb, u * 2) : lerp(wb, wc, (u - 0.5) * 2);
      const p0 = pts[Math.max(0, i - 1)], p1 = pts[Math.min(pts.length - 1, i + 1)];
      let nx = -(p1[1] - p0[1]), ny = p1[0] - p0[0]; const nl = Math.hypot(nx, ny) || 1; nx /= nl; ny /= nl;
      L.push([pts[i][0] + nx * w / 2, pts[i][1] + ny * w / 2]); Rr.push([pts[i][0] - nx * w / 2, pts[i][1] - ny * w / 2]);
    }
    // rounded ends
    const e0 = [], e1 = [];
    const dA = Math.atan2(pts[1][1] - pts[0][1], pts[1][0] - pts[0][0]);
    for (let i = 1; i < 6; i++) { const ang = dA + PI / 2 + (i / 6) * PI; e0.push([a[0] + Math.cos(ang) * wa / 2, a[1] + Math.sin(ang) * wa / 2]); }
    const n = pts.length, dC = Math.atan2(pts[n - 1][1] - pts[n - 2][1], pts[n - 1][0] - pts[n - 2][0]);
    for (let i = 1; i < 6; i++) { const ang = dC - PI / 2 + (i / 6) * PI; e1.push([c[0] + Math.cos(ang) * wc / 2, c[1] + Math.sin(ang) * wc / 2]); }
    return L.concat(e1).concat(Rr.reverse()).concat(e0);
  }
  function fk(p) {
    const Hh = [p.hx, p.hy];
    const M = add(Hh, up(p.tl), 30);
    const ua = p.tl + p.tb;
    const N = add(M, up(ua), 30);
    const Sh = add(add(M, up(ua), 23), [Math.cos(ua), Math.sin(ua)], -2);
    const ha = ua + p.hd;
    const Hc = add(add(N, up(ha), 12), [Math.cos(ha), Math.sin(ha)], 2.5);
    const arm = (a, e) => { const E = add(Sh, dn(a), 29); const Hd = add(E, dn(a + e), 26); return [E, Hd, a + e]; };
    const leg = (l, k, f) => { const K = add(Hh, dn(l), 41); const An = add(K, dn(l - k), 41); const fa = f || 0; const T = [An[0] + Math.cos(fa) * 17, An[1] + Math.sin(fa) * 17]; return [K, An, T, fa]; };
    const [EN, HN, faN] = arm(p.aN, p.eN), [EF, HF, faF] = arm(p.aF, p.eF);
    const [KN, AN, TN, fN] = leg(p.lN, p.kN, p.fN), [KF, AF, TF, fF] = leg(p.lF, p.kF, p.fF);
    return { H: Hh, M, N, Sh, Hc, ha, ua, EN, HN, faN, EF, HF, faF, KN, AN, TN, fN, KF, AF, TF, fF };
  }
  function bootPoly(K, An, T, fa) {
    const d = [An[0] - K[0], An[1] - K[1]], l = Math.hypot(d[0], d[1]) || 1, u = [d[0] / l, d[1] / l], nrm = [-u[1], u[0]];
    const top = [K[0] + d[0] * 0.5, K[1] + d[1] * 0.5];
    const ca = Math.cos(fa), sa = Math.sin(fa);
    const fwd = [ca, sa], upv = [sa, -ca];
    return [
      add(top, nrm, -6.5), add(top, nrm, 6.5),
      add(add(An, nrm, 6), fwd, 2), add(add(T, upv, 6), fwd, -3), add(add(T, upv, 3.5), fwd, 2), add(T, fwd, 2.5), add(add(T, upv, -1.5), fwd, 0),
      add(add(An, upv, -4.5), fwd, -6), add(add(An, upv, 1), fwd, -7.5),
    ];
  }
  function handPoly(E, Hd, fa, fist) {
    const d = dn(fa), nrm = [-d[1], d[0]];
    const c = add(Hd, d, 3);
    if (fist) return ellipsePts(c[0], c[1], 5.5, 5.5, 9).map((q) => q);
    return [add(add(Hd, nrm, 4.5), d, -1), add(add(c, nrm, 5), d, 4), add(c, d, 8.5), add(add(c, nrm, -4.5), d, 5), add(add(Hd, nrm, -4.5), d, 0), add(add(c, nrm, -7), d, -1)];
  }
  // pose → drawing. g has the camera transform; root (x,y) world; dir = ±1 facing.
  function drawKeeper(g, pose, root, dir, mot, t, o) {
    o = o || {};
    const F = fk(pose);
    g.save();
    g.translate(root[0], root[1]);
    g.scale(dir * (o.sc || 1), o.sc || 1);
    const m = g.getTransform();
    const inkW = o.inkW || 2.1;
    // motion-driven cloth: a local wind vector
    const vx = mot.vx * dir;
    const wx = clamp(-vx * 0.26 + (mot.wind || 0) * dir, -78, 78);
    const wy = clamp(-Math.abs(vx) * 0.1 - (mot.lift || 0), -60, 20);
    const flut = (mot.flutter || 0) + Math.min(1, Math.abs(vx) / 200) * 0.8;
    const wave = (d, ph) => Math.sin(t * (6 + flut * 5) - d * 5.5 + ph) * (1.5 + flut * 7) * d;
    const ground = o.ground === undefined ? 0 : o.ground - root[1];
    const fwdT = [Math.cos(F.ua), Math.sin(F.ua)], fwdL = [Math.cos(pose.tl), Math.sin(pose.tl)];
    const fillShape = (pts, key, shade, k, w) => {
      g.fillStyle = clothFill(g, key, m); polyPath(g, pts); g.fill();
      if (shade) { g.fillStyle = shade; g.fill(); }
      outline(g, pts, w || inkW, INK, k, true);
    };
    const deformer = (yTop, yBot, k0) => (p, ph) => {
      const d = clamp((p[1] - yTop) / Math.max(20, yBot - yTop), 0, 1.25);
      const k = Math.pow(d, 1.35) * (k0 || 1);
      return [p[0] + wx * k + wave(d, ph), p[1] + wy * k * d + wave(d, ph + 1.7) * 0.45];
    };
    // ---- 1. the long cape, behind everything
    const capeTop = add(F.Sh, up(F.ua), 4);
    const hemC = Math.min(ground - 2, F.H[1] + 66);
    const capeD = deformer(capeTop[1], hemC, 1);
    const cB = [add(add(F.N, fwdT, -6), up(F.ua), 2), add(add(F.M, fwdT, -16), up(F.ua), 0), add(F.H, [-1, 0.25], 22), [F.H[0] - 28 - Math.max(0, F.H[0] - F.KF[0]) * 0.2, hemC]];
    const cF = [add(F.Sh, fwdT, 6), add(F.M, fwdT, 2), add(F.H, [0.2, 1], 8), [F.H[0] + 2, hemC + 2]];
    const cbp = catmull(cB, 4, false), cfp = catmull(cF, 4, false);
    const cape = [];
    for (const p of cfp) cape.push(capeD(p, 0.3));
    for (let i = 1; i < 6; i++) { const u = i / 6; cape.push(capeD([lerp(cF[3][0], cB[3][0], u), hemC + Math.sin(u * PI * 2.5) * 3], 0.8 + u)); }
    for (let i = cbp.length - 1; i >= 0; i--) cape.push(capeD(cbp[i], 1.6));
    const capeP = catmull(cape, 2, true);
    const capeOpen = clamp((Math.abs(wx) - 18) / 40, 0, 1);
    fillShape(capeP, 'cloak', 'rgba(14,12,28,0.25)', 5, inkW * 1.1);
    g.save(); polyPath(g, capeP); g.clip(); const cg = g.createLinearGradient(0, capeTop[1], 0, hemC); cg.addColorStop(0, 'rgba(170,170,225,0.28)'); cg.addColorStop(1, 'rgba(8,6,18,0.35)'); g.fillStyle = cg; g.fillRect(F.H[0] - 200, capeTop[1] - 20, 400, hemC - capeTop[1] + 60); g.restore();
    if (capeOpen > 0) {
      // the madder lining shows where the cape lifts
      const lin = [capeD(cF[1], 0.3), capeD(cF[3], 0.3), cape[cfp.length + 1], cape[cfp.length + 2]].concat([capeD(lerp2(cF[1], cB[2], 0.5), 1)]);
      g.globalAlpha = capeOpen; g.fillStyle = clothFill(g, 'lining', m); polyPath(g, catmull(lin, 3, true)); g.fill(); g.globalAlpha = 1;
    }
    g.save(); polyPath(g, capeP); g.clip(); g.fillStyle = INK;
    for (let f = 0; f < 4; f++) { const u = 0.2 + f * 0.2, pts = []; for (let s = 0; s <= 8; s++) { const v = s / 8; pts.push(capeD([lerp(lerp(cF[0][0], cF[3][0], v), lerp(cB[0][0], cB[3][0], v), u), lerp(capeTop[1] + 8, hemC, v)], 0.8 + u * 2)); } g.globalAlpha = 0.5; inkStroke(g, jit(pts.slice(2), 0.3, 40 + f), 1.2, { ti: 0.5, to: 0.15, sd: f * 7 }); }
    g.restore(); g.globalAlpha = 1;
    // ---- 2. far arm & far leg
    const sleeve = (S0, E, Hd, k, sh) => { const sl = limb3(S0, E, Hd, 16, 13, 10.5); fillShape(sl, 'coat', sh, k, inkW * 0.9); const cu = dn(pose.aF), d = [Hd[0] - E[0], Hd[1] - E[1]]; return sl; };
    sleeve(F.Sh, F.EF, F.HF, 11, 'rgba(16,14,28,0.45)');
    const hpF = catmull(handPoly(F.EF, F.HF, F.faF, pose.fistF > 0.5), 3, true);
    fillShape(hpF, 'skin', 'rgba(40,20,40,0.35)', 12, inkW * 0.7);
    const legDraw = (K, An, T, fa, k, darkK) => {
      const lg = limb3(F.H, K, An, 18, 14, 11);
      fillShape(lg, 'tunic', darkK ? 'rgba(14,10,22,' + darkK + ')' : null, k, inkW * 0.9);
      const bp = catmull(bootPoly(K, An, T, fa), 3, true);
      fillShape(bp, 'boot', darkK ? 'rgba(8,6,14,' + darkK + ')' : null, k + 1, inkW);
      // bindings and a fur cuff
      g.strokeStyle = INK; g.lineWidth = 0.9; g.globalAlpha = 0.75;
      for (let s = 0; s < 3; s++) { const u = 0.56 + s * 0.11; const p = [lerp(K[0], An[0], u), lerp(K[1], An[1], u)]; g.beginPath(); g.moveTo(p[0] - 6.5, p[1] - 2.5); g.lineTo(p[0] + 6.5, p[1] + 2.5); g.stroke(); }
      g.globalAlpha = 1;
      const cuff = lerp2(K, An, 0.5); g.fillStyle = darkK ? '#6c6058' : '#9a8a78'; g.beginPath(); g.ellipse(cuff[0], cuff[1], 8, 3.4, Math.atan2(An[1] - K[1], An[0] - K[0]) + PI / 2, 0, TAU); g.fill();
    };
    legDraw(F.KF, F.AF, F.TF, F.fF, 21, 0.4);
    legDraw(F.KN, F.AN, F.TN, F.fN, 31, 0);
    // ---- 3. the coat
    const hemK = Math.min(ground - 3, F.H[1] + 40);
    const seatedKnee = F.KN[0] > F.H[0] + 22 && F.KN[1] < F.H[1] + 20;
    const coatD = deformer(F.N[1], hemK, 0.35);
    const knF = lerp2(add(F.H, [0.35, 1], 40), F.KN[0] > F.KF[0] ? F.KN : F.KF, 0.55), knB = lerp2(add(F.H, [-0.4, 1], 40), F.KN[0] > F.KF[0] ? F.KF : F.KN, 0.45);
    const frontC = [add(add(F.N, fwdT, 8), up(F.ua), -2), add(F.M, fwdL, 14), add(add(F.H, fwdL, 15), up(pose.tl), 10)];
    if (seatedKnee) { frontC.push([F.KN[0] - 2, F.KN[1] - 12]); frontC.push([F.KN[0] + 9, F.KN[1] - 2]); frontC.push([F.KN[0] + 9, F.KN[1] + 8]); }
    else frontC.push([Math.max(knF[0] + 8, F.H[0] + 16), Math.min(hemK, knF[1] + 4)]);
    const backC = [add(add(F.N, fwdT, -7), up(F.ua), -1), add(F.M, fwdL, -14), add(F.H, fwdL, -15)];
    if (seatedKnee) backC.push([F.H[0] - 16, F.H[1] + 14]); else backC.push([Math.min(knB[0] - 8, F.H[0] - 15), Math.min(hemK, knB[1] + 4)]);
    const ff = catmull(frontC, 4, false), bf = catmull(backC, 4, false);
    const coat = ff.map((p) => coatD(p, 0.2));
    const fl = frontC[frontC.length - 1], bl = backC[backC.length - 1];
    for (let i = 1; i < 5; i++) { const u = i / 5; coat.push(coatD([lerp(fl[0], bl[0], u), lerp(fl[1], bl[1], u) + Math.sin(u * PI) * 3], 0.5 + u)); }
    for (let i = bf.length - 1; i >= 0; i--) coat.push(coatD(bf[i], 1));
    const coatP = catmull(coat, 2, true);
    fillShape(coatP, 'coat', null, 41, inkW * 1.05);
    g.save(); polyPath(g, coatP); g.clip();
    const lg = g.createLinearGradient(F.H[0] + 20, F.N[1], F.H[0] - 10, F.H[1] + 30); lg.addColorStop(0, 'rgba(190,190,235,0.32)'); lg.addColorStop(0.5, 'rgba(190,190,235,0)'); lg.addColorStop(1, 'rgba(10,8,22,0.4)');
    g.fillStyle = lg; g.fillRect(F.H[0] - 120, F.N[1] - 40, 240, 220);
    const sg = g.createLinearGradient(F.H[0] - 22, 0, F.H[0] + 16, 0); sg.addColorStop(0, 'rgba(14,14,26,0.5)'); sg.addColorStop(1, 'rgba(14,14,26,0)');
    g.fillStyle = sg; g.fillRect(F.H[0] - 120, F.N[1] - 40, 240, 200);
    // belt and buckle
    const b0 = add(add(F.H, up(pose.tl), 10), fwdL, -16), b1 = add(add(F.H, up(pose.tl), 10), fwdL, 17);
    g.fillStyle = '#2a1c18'; inkStroke(g, [b0, lerp2(b0, b1, 0.5), b1], 4.2, { ti: 0, to: 0, min: 0.9, vr: 0.05 });
    g.fillStyle = '#b89a5a'; const bk = lerp2(b0, b1, 0.82); g.fillRect(bk[0] - 2, bk[1] - 2.5, 4, 5);
    g.fillStyle = INK;
    for (let f = 0; f < 3; f++) { const u = 0.3 + f * 0.22; const p0 = lerp2(b0, b1, u), p1 = lerp2(fl, bl, u - 0.05); g.globalAlpha = 0.5; inkStroke(g, jit([p0, lerp2(p0, p1, 0.5), coatD(p1, 0.5 + u)], 0.3, 50 + f), 1.1, { ti: 0.3, to: 0.3 }); }
    g.restore(); g.globalAlpha = 1;
    // ---- 4. head: mantle, face, hood, beard
    const mantle = [add(add(F.N, fwdT, 9), up(F.ua), -1), add(add(F.Sh, fwdT, 13), up(F.ua), -14), add(add(F.Sh, fwdT, 3), up(F.ua), -24), add(add(F.Sh, fwdT, -12), up(F.ua), -22), add(add(F.Sh, fwdT, -17), up(F.ua), -6), add(add(F.N, fwdT, -9), up(F.ua), 3)];
    const mD = deformer(F.N[1], F.N[1] + 30, 0.25);
    const mP = catmull(mantle.map((p, i) => (i > 0 && i < 5 ? mD(p, i) : p)), 4, true);
    fillShape(mP, 'cloak', null, 61, inkW);
    g.save(); g.translate(F.Hc[0], F.Hc[1]); g.rotate(F.ha); g.scale(1.14, 1.14);
    const hm = g.getTransform();
    const hw = wx * 0.12, hwy = wy * 0.05;
    const face = [[4, -9.5], [9, -8.6], [11.4, -5.8], [10.6, -3.6], [11.7, -1.4], [17.4, 3.6], [16.8, 5.2], [13.4, 5.8], [12.8, 7.4], [5, 10], [2, 0]];
    const fp = catmull(face, 3, true);
    g.fillStyle = clothFill(g, 'skin', hm); polyPath(g, fp); g.fill();
    g.fillStyle = 'rgba(70,40,70,0.3)'; g.beginPath(); g.ellipse(4, -1, 6, 9, 0, 0, TAU); g.fill();
    g.fillStyle = 'rgba(206,92,82,0.4)'; g.beginPath(); g.ellipse(12, 2.4, 3.6, 2.4, 0.3, 0, TAU); g.fill();
    outline(g, fp.slice(3, 27), inkW * 0.8, INK, 51, false);
    const open = pose.eye === undefined ? 1 : pose.eye;
    g.fillStyle = INK;
    inkStroke(g, [[6.8, -3.4 + (1 - open) * 0.6], [8.2, -3.9 + (1 - open) * 0.5], [9.6, -3.3]], 1.5 * (0.55 + open * 0.45), { ti: 0.2, to: 0.3 });
    g.strokeStyle = '#f2eee8'; g.lineCap = 'round'; g.lineWidth = 1.5;
    for (let i = 0; i < 6; i++) { const bx = 5 + i * 1.3; g.beginPath(); g.moveTo(bx, -5.6); g.lineTo(bx + 3.4 + hw * 0.1, -7 - (pose.brow || 0) - i * 0.2); g.stroke(); }
    const hood = [[10.6, -10.8], [7, -17.5], [-2, -20.5], [-12 + hw * 0.6, -17], [-18 + hw, -8 + hwy], [-20 + hw * 1.2, 4], [-17, 15], [-8, 19], [-1, 15], [0.6, 7], [1.2, -2], [5, -9]];
    const hp = catmull(hood, 3, true);
    g.fillStyle = clothFill(g, 'cloak', hm); polyPath(g, hp); g.fill();
    const hg = g.createLinearGradient(0, -20, 0, 12); hg.addColorStop(0, 'rgba(170,160,210,0.22)'); hg.addColorStop(1, 'rgba(10,10,24,0.3)');
    g.fillStyle = hg; g.fill();
    outline(g, hp, inkW, INK, 71, true);
    g.fillStyle = INK; g.globalAlpha = 0.65;
    inkStroke(g, jit([[9.5, -12], [2, -14], [-7, -12], [-13, -5]], 0.3, 72), 1.1, { ti: 0.3, to: 0.4 });
    inkStroke(g, jit([[4, -9.5], [1.4, -2], [0.8, 6]], 0.3, 73), 1.4, { ti: 0.2, to: 0.4 });
    g.globalAlpha = 1;
    g.fillStyle = 'rgba(248,246,240,0.9)';
    for (let i = 0; i < 6; i++) { g.beginPath(); g.arc(-10 + i * 4 + hr(i, 9) * 2, -17.5 + Math.abs(i - 2.5) * 1.4, 1 + hr(i, 8) * 1.1, 0, TAU); g.fill(); }
    const bwx = wx * 0.32 + wave(0.8, 2) * 0.6, bwy = wy * 0.15;
    const beard = [[13, 6], [14.6, 10], [13.6, 17], [10 + bwx * 0.4, 27 + bwy * 0.4], [5 + bwx, 38 + bwy], [2.4 + bwx * 0.7, 30 + bwy * 0.6], [0.6, 20], [0, 12], [3, 7.5], [8, 8.6]];
    const bp = catmull(beard, 3, true);
    g.fillStyle = clothFill(g, 'beard', hm); polyPath(g, bp); g.fill();
    g.save(); polyPath(g, bp); g.clip(); g.fillStyle = 'rgba(80,70,110,0.32)'; g.fillRect(-6, 20, 32, 30); g.restore();
    g.strokeStyle = '#fbf8f2'; g.lineWidth = 1; g.globalAlpha = 0.9;
    for (let i = 0; i < 5; i++) { const sx = 4 + i * 2; g.beginPath(); g.moveTo(sx + 2, 9); g.quadraticCurveTo(sx + 1 + bwx * 0.3, 20, sx - 2 + bwx * (0.6 + i * 0.08), 31 + bwy * 0.5 - i); g.stroke(); }
    g.globalAlpha = 1;
    outline(g, bp, inkW * 0.7, INK, 81, true);
    g.fillStyle = '#f4f0ea'; g.beginPath(); g.ellipse(12.6, 6.6, 3.8, 1.8, 0.2, 0, TAU); g.fill();
    g.restore();
    // ---- 5. near arm, hand, brand
    const sl = limb3(F.Sh, F.EN, F.HN, 17, 13.5, 11);
    fillShape(sl, 'coat', null, 91, inkW);
    g.save(); polyPath(g, sl); g.clip(); const ag = g.createLinearGradient(F.Sh[0], F.Sh[1] - 10, F.HN[0], F.HN[1] + 10); ag.addColorStop(0, 'rgba(190,190,235,0.3)'); ag.addColorStop(1, 'rgba(10,8,22,0.25)'); g.fillStyle = ag; g.fillRect(-200, -260, 400, 300); g.restore();
    const cu = dn(F.faN), cp = add(F.HN, cu, -3);
    g.strokeStyle = INK; g.lineWidth = 1.4; g.beginPath(); g.moveTo(cp[0] - cu[1] * 5.5, cp[1] + cu[0] * 5.5); g.lineTo(cp[0] + cu[1] * 5.5, cp[1] - cu[0] * 5.5); g.stroke();
    let brandTip = null;
    if (pose.brand > 0.5) {
      const ba = pose.ba, bu = up(ba);
      const b0 = add(F.HN, bu, -12), b1 = add(F.HN, bu, 52);
      g.fillStyle = '#4a3226'; inkStroke(g, [b0, add(F.HN, bu, 20), b1], 4.6, { ti: 0, to: 0, min: 0.8, vr: 0.1 });
      g.fillStyle = INK; inkStroke(g, [add(b0, [bu[1], -bu[0]], 2.3), add(b1, [bu[1], -bu[0]], 2.3)], 1, { ti: 0.1, to: 0.1 });
      const rh = add(F.HN, bu, 54);
      g.fillStyle = '#2a1a16'; g.beginPath(); g.ellipse(rh[0], rh[1], 6, 8, ba, 0, TAU); g.fill();
      brandTip = add(F.HN, bu, 58);
    }
    const hpN = catmull(handPoly(F.EN, F.HN, F.faN, pose.brand > 0.5 || pose.fistN > 0.5), 3, true);
    fillShape(hpN, 'skin', null, 95, inkW * 0.75);
    const wtip = brandTip ? [root[0] + dir * brandTip[0] * (o.sc || 1), root[1] + brandTip[1] * (o.sc || 1)] : null;
    const out = { brandTip: wtip, hand: [root[0] + dir * F.HN[0], root[1] + F.HN[1]], head: [root[0] + dir * F.Hc[0], root[1] + F.Hc[1]], mouth: [root[0] + dir * (F.Hc[0] + 13), root[1] + F.Hc[1] + 7] };
    g.restore();
    return out;
  }
  function lerp2(a, b, u) { return [lerp(a[0], b[0], u), lerp(a[1], b[1], u)]; }

  /* ------------------------------------------------------------------ the keeper's performance */
  const POSE0 = { hx: 0, hy: -82, tl: 0.1, tb: 0.02, hd: 0, aN: 0.15, eN: 0.2, aF: -0.1, eF: 0.2, lN: 0.05, kN: 0.08, lF: -0.08, kF: 0.05, fN: 0, fF: 0, brand: 0, ba: 0, eye: 1, brow: 0, fistN: 0, fistF: 0 };
  const PZ = (o) => Object.assign({}, POSE0, o);
  const P_SIT = PZ({ hx: 0, hy: -42, tl: 0.42, tb: 0.38, hd: 0.25, aN: 1.0, eN: 0.25, aF: 0.88, eF: 0.38, lN: 1.48, kN: 1.62, lF: 1.36, kF: 1.42, fN: 0, fF: 0.05, eye: 0.35 });
  const P_LOOK = PZ({ hx: 0, hy: -42, tl: 0.36, tb: 0.22, hd: -0.28, aN: 0.95, eN: 0.35, aF: 0.85, eF: 0.45, lN: 1.48, kN: 1.62, lF: 1.36, kF: 1.42, eye: 1 });
  const P_LEAN = PZ({ hx: 4, hy: -47, tl: 0.62, tb: 0.04, hd: -0.5, aN: 1.75, eN: -0.15, aF: 0.55, eF: 1.0, lN: 1.35, kN: 1.65, lF: 1.25, kF: 1.5, eye: 1, brow: 1.5, fistF: 1 });
  const P_JOLT = PZ({ hx: 2, hy: -50, tl: 0.12, tb: -0.06, hd: -0.3, aN: 0.9, eN: 0.5, aF: 0.7, eF: 0.8, lN: 1.2, kN: 1.6, lF: 1.1, kF: 1.5, brow: 1.5 });
  const P_STAND = PZ({ hx: -4, hy: -81, tl: 0.18, tb: 0.04, hd: -0.12, aN: 0.5, eN: 0.6, aF: 0.3, eF: 0.4, lN: 0.25, kN: 0.12, lF: -0.18, kF: 0.1, brow: 1 });
  const P_REACH = PZ({ hx: -6, hy: -72, tl: 0.78, tb: 0.22, hd: -0.25, aN: 0.95, eN: 0.12, aF: 0.2, eF: 0.9, lN: 0.62, kN: 0.75, lF: -0.32, kF: 0.25, fN: 0.1, fistN: 1 });
  const P_LIFT = PZ({ hx: -2, hy: -80, tl: 0.05, tb: -0.08, hd: -0.35, aN: 2.55, eN: -0.25, aF: 0.4, eF: 0.6, lN: 0.3, kN: 0.15, lF: -0.25, kF: 0.15, brand: 1, ba: 0.15, brow: 1.2 });
  const P_TURN = PZ({ hx: -2, hy: -74, tl: 0.3, tb: 0.05, hd: 0, aN: 2.0, eN: -0.2, aF: 0.9, eF: 0.4, lN: 0.5, kN: 0.6, lF: -0.3, kF: 0.4, brand: 1, ba: 0.4 });
  // fixed poses at the pyre (facing right)
  const P_ARRIVE = PZ({ hx: 6, hy: -78, tl: 0.05, tb: 0.05, hd: -0.05, aN: 1.75, eN: -0.15, aF: 0.4, eF: 0.6, lN: 0.45, kN: 0.35, lF: -0.3, kF: 0.25, brand: 1, ba: 0.7 });
  const P_WIND = PZ({ hx: -6, hy: -74, tl: -0.12, tb: 0.0, hd: 0.05, aN: -0.55, eN: 0.55, aF: 0.6, eF: 0.8, lN: 0.55, kN: 0.55, lF: -0.38, kF: 0.32, brand: 1, ba: -0.9, fistF: 1 });
  const P_THRUST = PZ({ hx: 14, hy: -62, tl: 0.78, tb: 0.12, hd: -0.35, aN: 1.42, eN: 0.05, aF: -0.55, eF: 0.4, lN: 0.95, kN: 1.0, lF: -0.62, kF: 0.12, fF: 0.25, brand: 1, ba: 1.95 });
  const P_HOLD = PZ({ hx: 13, hy: -63, tl: 0.72, tb: 0.16, hd: -0.45, aN: 1.38, eN: 0.08, aF: -0.45, eF: 0.5, lN: 0.92, kN: 1.0, lF: -0.6, kF: 0.14, fF: 0.25, brand: 1, ba: 1.93 });
  const P_LETGO = PZ({ hx: 8, hy: -68, tl: 0.5, tb: 0.1, hd: -0.4, aN: 1.1, eN: 0.35, aF: -0.3, eF: 0.5, lN: 0.75, kN: 0.8, lF: -0.5, kF: 0.15, fF: 0.2, brand: 0, fistN: 0 });
  const P_RECOIL = PZ({ hx: -16, hy: -76, tl: -0.32, tb: -0.08, hd: 0.2, aN: 2.3, eN: 1.55, aF: -1.0, eF: 0.4, lN: 0.55, kN: 0.3, lF: -0.42, kF: 0.4, brow: 1.4 });
  const P_BRACE = PZ({ hx: -6, hy: -79, tl: -0.12, tb: -0.04, hd: 0.15, aN: 2.2, eN: 1.6, aF: -0.55, eF: 0.35, lN: 0.42, kN: 0.18, lF: -0.36, kF: 0.12, brow: 1.2, fistF: 1 });
  const P_AWE = PZ({ hx: -4, hy: -80, tl: -0.08, tb: -0.2, hd: -0.55, aN: 0.45, eN: 0.35, aF: -0.2, eF: 0.4, lN: 0.38, kN: 0.12, lF: -0.32, kF: 0.12, brow: 1.6 });

  // the run: distance as a function of time (precomputed integral of a hand-shaped speed curve)
  const RUN = { t0: 8.45, t1: 15.05, x0: 26, tbl: [] };
  function runSpeed(t) {
    if (t < RUN.t0) return 0;
    let v = 205 * EZ.o(clamp((t - RUN.t0) / 0.7, 0, 1));
    v *= 1 - 0.55 * Math.exp(-Math.pow((t - 12.05) / 0.28, 2)); // the stumble
    v *= 1 - EZ.io2(clamp((t - 14.25) / 0.8, 0, 1));
    return v;
  }
  (function () { let x = RUN.x0; for (let i = 0; i <= 800; i++) { const t = RUN.t0 + (i / 800) * (RUN.t1 - RUN.t0 + 0.5); RUN.tbl.push(x); x += runSpeed(t) * ((RUN.t1 - RUN.t0 + 0.5) / 800); } })();
  function runX(t) {
    if (t <= RUN.t0) return RUN.x0;
    const u = clamp((t - RUN.t0) / (RUN.t1 - RUN.t0 + 0.5), 0, 1) * 800, i = Math.floor(u);
    return lerp(RUN.tbl[Math.min(i, 800)], RUN.tbl[Math.min(i + 1, 800)], u - i);
  }
  function runPose(t) {
    const x = runX(t), v = runSpeed(t);
    const ph = (x - RUN.x0) / 150; // one stride pair per 150 units
    const sN = Math.sin(TAU * ph), sF = Math.sin(TAU * ph + PI);
    const kick = (s, c) => 0.25 + 1.25 * Math.max(0, Math.sin(TAU * ph + c + 0.9));
    const stumble = Math.exp(-Math.pow((t - 12.1) / 0.3, 2));
    const k = clamp(v / 205, 0, 1);
    return PZ({
      hx: 4 * k, hy: -74 + 4 * Math.cos(2 * TAU * ph) * k + 10 * stumble,
      tl: 0.12 + 0.3 * k + 0.03 * Math.sin(2 * TAU * ph) + 0.45 * stumble, tb: 0.06 + 0.1 * stumble, hd: -0.18 - 0.2 * stumble,
      aN: 1.7 + 0.12 * sN * k - 0.4 * stumble, eN: -0.2, ba: 0.55 + 0.1 * sN * k, brand: 1,
      aF: 0.35 + 0.65 * sF * k + 1.4 * stumble, eF: 0.8 + 0.2 * sF,
      lN: 0.3 + 0.8 * sN * k, kN: (0.25 + 1.2 * Math.max(0, Math.sin(TAU * ph + 0.9))) * k + 0.08,
      lF: 0.3 + 0.8 * sF * k, kF: (0.25 + 1.2 * Math.max(0, Math.sin(TAU * ph + PI + 0.9))) * k + 0.08,
      fN: -0.15 * Math.max(0, sN), fF: -0.15 * Math.max(0, sF), brow: 1,
    });
  }
  const KEEPER_S2 = [
    [2.6, P_SIT], [3.4, P_SIT, 'io'], [4.4, P_LOOK, 'io'], [4.75, P_LOOK, 'io'], [5.3, P_LEAN, 'io'], [5.55, P_LEAN, 'io'], [5.72, P_JOLT, 'o'],
    [6.45, P_STAND, 'back'], [6.7, P_STAND, 'io'], [7.25, P_REACH, 'io'], [7.45, P_REACH, 'io'], [7.95, P_LIFT, 'back'], [8.25, P_TURN, 'io'],
  ];
  const KEEPER_S4 = [
    [15.0, null], [15.15, P_ARRIVE, 'o'], [15.48, P_WIND, 'io'], [15.72, P_THRUST, 'o2'], [16.2, P_HOLD, 'o'], [17.5, P_HOLD, 'io'], [17.95, P_LETGO, 'io'],
    [18.15, P_LETGO, 'io'], [18.45, P_RECOIL, 'o'], [19.3, P_BRACE, 'io'], [21.6, P_BRACE, 'io'], [23.4, P_AWE, 'io'], [26, P_AWE, 'io'],
  ];
  // root position & facing for the keeper on the summit at time t
  function keeperRoot(t) {
    if (t < 8.3) {
      const x = track([[2.6, 0], [5.5, 0], [6.45, -8], [7.25, -22], [7.95, -14], [8.3, -8]], t);
      return { x, dir: -1 };
    }
    if (t < 15.0) return { x: runX(t), dir: 1 };
    const x = track([[15.0, runX(15.0)], [15.15, runX(15.05) + 4], [15.48, runX(15.05) - 4], [15.72, runX(15.05) + 18], [17.95, runX(15.05) + 14], [18.15, runX(15.05) + 10], [18.45, runX(15.05) - 30, 'o'], [19.3, runX(15.05) - 58, 'io'], [26, runX(15.05) - 62]], t);
    return { x, dir: 1 };
  }
  function keeperPose(t) {
    if (t < 8.3) {
      const p = trackObj(KEEPER_S2, t);
      const br = Math.sin(t * TAU / 3.4) * (t < 4.4 ? 1 : 0.4);
      p.tb += br * 0.02; p.hy += br * 0.6;
      if (t > 7.45) p.brand = 1; else p.brand = 0;
      return p;
    }
    if (t < 15.0) {
      if (t < RUN.t0 + 0.05) return P_TURN;
      return runPose(t);
    }
    const keys = KEEPER_S4.slice(); keys[0] = [15.0, runPose(15.0)];
    const p = trackObj(keys, t);
    p.brand = t < 17.95 ? 1 : 0;
    // breathing / bracing tremor
    p.tb += Math.sin(t * 2.1) * 0.015;
    return p;
  }
  function keeperMotion(t) {
    const a = keeperRoot(t - 0.06).x, b = keeperRoot(t).x;
    let vx = (b - a) / 0.06;
    if (t > 8.2 && t < 8.6) vx = 120;
    return { vx, vy: 0 };
  }
  /* ================================================================== SHOT 1 — THE EYE */
  const EYE = { ci: [338, 728], co: [782, 694], iris: [516, 712], ir: 92, pr: 35, spark: [470, 742] };
  function lidUpper(o) { return [EYE.ci, [430, 728 - 136 * o], [662, 694 - 126 * o], EYE.co]; }
  const LID_LOW = [[338, 728], [420, 800], [662, 796], [782, 694]];
  function bez(b, n) { const out = []; for (let i = 0; i <= n; i++) { const t = i / n, u = 1 - t; out.push([u * u * u * b[0][0] + 3 * u * u * t * b[1][0] + 3 * u * t * t * b[2][0] + t * t * t * b[3][0], u * u * u * b[0][1] + 3 * u * u * t * b[1][1] + 3 * u * t * t * b[2][1] + t * t * t * b[3][1]]); } return out; }
  function buildEye() {
    RNG = mulberry32(SEED * 29 + 3);
    const r = R * 1.3, X0 = -280, Y0 = -180, WW = 1640, HH = 1760;
    const P = painter(X0, Y0, WW, HH, r), g = P.g;
    const full = [[X0, Y0], [X0 + WW, Y0], [X0 + WW, Y0 + HH], [X0, Y0 + HH]];
    const blobW = (cx, cy, rx, ry, col, a, mode, bl, rot) => {
      let pts = ellipsePts(cx, cy, rx, ry, 28, RNG, 0.14);
      if (rot) pts = pts.map(([x, y]) => [cx + (x - cx) * Math.cos(rot) - (y - cy) * Math.sin(rot), cy + (x - cx) * Math.sin(rot) + (y - cy) * Math.cos(rot)]);
      wash(P, pts, col, { alpha: a, layers: 7, spread: Math.max(rx, ry) * 0.08, edge: 0.06, bloom: bl === undefined ? 0.15 : bl, bscale: 2.6, mode: mode || 'multiply', gran: 0.18 });
    };
    // cold night beyond the face, with out-of-focus snow
    g.fillStyle = '#121830'; g.fillRect(X0, Y0, WW, HH);
    wash(P, full, (tg) => { const gr = tg.createRadialGradient(0, 700, 50, 0, 700, 700); gr.addColorStop(0, '#2c3460'); gr.addColorStop(1, '#121830'); return gr; }, { mode: 'source-over', alpha: 0.8, layers: 3, spread: 20, edge: 0, bloom: 0.4, bscale: 3 });
    for (let i = 0; i < 26; i++) { const x = X0 + RNG() * 520, y = 300 + RNG() * 1200, rr = 8 + RNG() * 26; const gr = g.createRadialGradient(x, y, 0, x, y, rr); gr.addColorStop(0, 'rgba(200,210,240,0.35)'); gr.addColorStop(0.7, 'rgba(200,210,240,0.18)'); gr.addColorStop(1, 'rgba(200,210,240,0)'); g.fillStyle = gr; g.fillRect(x - rr, y - rr, rr * 2, rr * 2); }
    // the face: its edge along the nose is a soft turning form, not a cut
    const nose = catmull([[250, 250], [236, 420], [214, 580], [196, 740], [176, 900], [146, 1060], [104, 1240], [50, 1420], [-10, 1600]], 5, false);
    const skin = nose.concat([[X0 + WW, Y0 + HH], [X0 + WW, 250]]);
    wash(P, skin, (tg) => { const gr = tg.createLinearGradient(0, 280, 0, 1400); gr.addColorStop(0, '#3a2a46'); gr.addColorStop(0.18, '#6e4c62'); gr.addColorStop(0.36, '#a27070'); gr.addColorStop(0.56, '#b87c6c'); gr.addColorStop(0.8, '#94606a'); gr.addColorStop(1, '#5a3a52'); return gr; },
      { mode: 'source-over', layers: 6, spread: 4, gran: 0.28, bloom: 0.1, bscale: 3, edge: 0.2 });
    // the far side of the nose falls away into blue shadow
    wash(P, nose.concat(nose.slice().reverse().map(([x, y]) => [x + 150, y])), (tg) => { const gr = tg.createLinearGradient(170, 0, 330, 0); gr.addColorStop(0, 'rgba(36,30,64,0.85)'); gr.addColorStop(1, 'rgba(36,30,64,0)'); return gr; }, { layers: 5, spread: 10, edge: 0, bloom: 0.04 });
    // warm life in the skin: lid rims, cheek, nose
    blobW(560, 735, 270, 105, '#c25a68', 0.38); // rims around the eye
    blobW(760, 1000, 220, 120, '#d06a62', 0.42, 'multiply', 0.2, 0.2); // weathered cheek
    blobW(250, 900, 70, 240, '#c06070', 0.3); // nose
    // the deep socket under the brow
    blobW(430, 620, 260, 80, '#241a3c', 0.6, 'multiply', 0.1, -0.08);
    blobW(760, 640, 200, 70, '#2c2040', 0.45, 'multiply', 0.1, 0.12);
    blobW(340, 760, 110, 120, '#3a2848', 0.3, 'multiply', 0.05); // inner corner toward the nose
    blobW(1080, 760, 220, 440, '#2a2246', 0.55); // temple turning away
    blobW(560, 880, 300, 46, '#3e2a4c', 0.4, 'multiply', 0.1, -0.05); // under the bag
    blobW(620, 1110, 520, 150, '#3a2848', 0.4); // hollow above the scarf
    // the cold key light from the sky: brow ridge, lid, cheekbone, bridge of the nose
    blobW(560, 500, 420, 50, '#8c9ad8', 0.5, 'screen', 0.2, -0.06);
    blobW(600, 600, 240, 34, '#7a86c8', 0.35, 'screen', 0.2, 0.05);
    blobW(760, 930, 230, 60, '#8e98d4', 0.45, 'screen', 0.2, -0.25);
    blobW(560, 935, 260, 22, '#8a90c8', 0.3, 'screen', 0.2, -0.05);
    wash(P, nose.slice(2, 34).map((p) => [p[0] + 6, p[1]]).concat(nose.slice(2, 34).reverse().map((p) => [p[0] + 60, p[1]])), '#8e98d4', { mode: 'screen', alpha: 0.25, layers: 7, spread: 24, edge: 0, bloom: 0.2 });
    // pores, spots, capillaries
    g.strokeStyle = 'rgba(170,50,66,0.32)'; g.lineWidth = 0.9;
    for (let i = 0; i < 40; i++) { let x = 660 + RNG() * 300, y = 940 + RNG() * 140; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 4; k++) { x += (RNG() - 0.3) * 14; y += (RNG() - 0.5) * 10; g.lineTo(x, y); } g.stroke(); }
    for (let i = 0; i < 22; i++) { g.fillStyle = 'rgba(100,60,46,' + (0.12 + RNG() * 0.16) + ')'; blob(g, 320 + RNG() * 800, 860 + RNG() * 220, 3 + RNG() * 9, 8, 0.4); }
    for (let i = 0; i < 3400; i++) { const x = 220 + RNG() * 1100, y = 380 + RNG() * 760; if (Math.hypot((x - 560) / 250, (y - 720) / 100) < 1) continue; g.fillStyle = RNG() < 0.55 ? 'rgba(50,30,50,0.22)' : 'rgba(200,210,250,0.16)'; g.fillRect(x, y, 1.3, 1.3); }
    // stubble on the lower cheek and near the nose
    for (let i = 0; i < 2600; i++) { const x = 150 + RNG() * 1100, y = 960 + RNG() * 200 - (x - 150) * 0.06; const d = RNG(); g.strokeStyle = d < 0.6 ? 'rgba(40,26,40,0.5)' : 'rgba(230,228,236,0.6)'; g.lineWidth = 1; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 1.5, y + 3); g.stroke(); }
    // creases: drawn line, soft shadow below, a cold light ridge beyond
    const crease = (pts, w, a, lift) => {
      const cp = catmull(pts, 8, false);
      g.globalAlpha = a * 0.5; g.fillStyle = '#2a1a36'; inkStroke(g, offsetPts(cp, 0, w * 1.6), w * 3.4, { ti: 0.45, to: 0.45, vr: 0.3 });
      if (lift) { g.globalAlpha = a * 0.4; g.fillStyle = '#b8bcec'; inkStroke(g, offsetPts(cp, 0, w * 4.6), w * 2.2, { ti: 0.5, to: 0.5 }); }
      g.globalAlpha = a; g.fillStyle = INK; inkLine(g, cp, w, { ti: 0.35, to: 0.45, vr: 0.5, gaps: 0.14 }); g.globalAlpha = 1;
    };
    crease([[360, 826], [470, 858], [620, 866], [760, 840], [850, 792]], 3, 0.8, true);
    crease([[430, 904], [580, 928], [740, 912], [870, 862]], 2, 0.45, true);
    for (let i = 0; i < 7; i++) {
      const a = -0.55 + i * 0.18 + (RNG() - 0.5) * 0.1, l = 110 + RNG() * 130, sx = 818 + i * 3, sy = 690 + (i - 3) * 12;
      const bend = (i - 3) * 0.1;
      const pts = [[sx, sy], [sx + Math.cos(a) * l * 0.5, sy + Math.sin(a) * l * 0.5], [sx + Math.cos(a + bend) * l, sy + Math.sin(a + bend) * l]];
      crease(pts, 1.6 + RNG() * 1.3, 0.5 + RNG() * 0.3, true);
      if (RNG() < 0.6) { const m = pts[1]; crease([m, [m[0] + 30, m[1] + (RNG() - 0.5) * 40]], 1, 0.35); }
    }
    crease([[300, 1010], [380, 1080], [440, 1150]], 2.2, 0.4);
    // hatching in the deep shadows
    hatch(P, [[230, 420], [440, 400], [400, 600], [330, 860], [240, 900]], { ang: 0.95, gap: 5, len: 30, w: 1.1, col: INK, alpha: 0.26, density: (x, y) => sstep(200, 300, x) });
    hatch(P, [[260, 520], [900, 500], [900, 600], [300, 640]], { ang: 0.5, gap: 6, len: 22, w: 0.9, col: INK, alpha: 0.22 });
    hatch(P, [[940, 520], [1360, 470], [1360, 1100], [1000, 960]], { ang: 1.2, gap: 6, len: 36, w: 1, col: INK, alpha: 0.3 });
    // lost-and-found nose contour
    g.fillStyle = INK; g.globalAlpha = 0.7; inkLine(g, nose, 2.6, { ti: 0.1, to: 0.4, vr: 0.6, gaps: 0.35, gapFreq: 0.05 }); g.globalAlpha = 1;
    // white hair escaping at the temple
    g.lineCap = 'round';
    for (let i = 0; i < 110; i++) {
      const x = 940 + RNG() * 300, y = 300 + RNG() * 60;
      g.strokeStyle = RNG() < 0.8 ? 'rgba(226,226,236,' + (0.45 + RNG() * 0.4) + ')' : 'rgba(30,26,44,0.5)'; g.lineWidth = 0.8 + RNG() * 1.8;
      g.beginPath(); g.moveTo(x, y); g.bezierCurveTo(x + 10, y + 120, x + 40 + RNG() * 40, y + 220, x + 40 + RNG() * 120, y + 330 + RNG() * 300); g.stroke();
    }
    // a knitted scarf wound up to the cheek
    const scarfTop = catmull([[-280, 1210], [100, 1110], [460, 1050], [760, 1020], [1060, 975], [1360, 930]], 6, false);
    const scarf = scarfTop.concat([[1360, 1580], [-280, 1580]]);
    wash(P, scarf, (tg) => { const gr = tg.createLinearGradient(0, 960, 0, 1500); gr.addColorStop(0, '#94403a'); gr.addColorStop(1, '#3e1820'); return gr; }, { mode: 'source-over', layers: 5, spread: 2.5, gran: 0.55, bloom: 0.25, edge: 0.5 });
    g.save(); polyPath(g, scarf); g.clip();
    for (let row = 0; row < 22; row++) for (let x = -280; x < 1360; x += 18) {
      const y = 1010 + row * 24 - (x * 0.13) + Math.sin(x * 0.012 + row) * 5;
      g.strokeStyle = 'rgba(30,8,16,0.42)'; g.lineWidth = 2; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 8, y + 10); g.lineTo(x + 16, y); g.stroke();
      g.strokeStyle = 'rgba(214,120,96,0.22)'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(x + 2, y - 3); g.lineTo(x + 8, y + 5); g.stroke();
    }
    const fold = g.createLinearGradient(0, 1000, 0, 1200); fold.addColorStop(0, 'rgba(150,160,220,0.25)'); fold.addColorStop(1, 'rgba(150,160,220,0)'); g.fillStyle = fold; g.fillRect(X0, 900, WW, 300);
    g.restore();
    g.fillStyle = INK; inkLine(g, scarfTop, 4, { gaps: 0.15, ti: 0.05, to: 0.05 });
    blobW(560, 1000, 640, 36, '#22122a', 0.45, 'multiply', 0.1, -0.1);
    // the beard spilling over the scarf
    const beardP = catmull([[-120, 1080], [150, 1060], [380, 1110], [520, 1260], [560, 1580], [-120, 1580]], 6, true);
    wash(P, beardP, (tg) => { const gr = tg.createLinearGradient(0, 1050, 0, 1580); gr.addColorStop(0, '#dcd8e0'); gr.addColorStop(1, '#7a7490'); return gr; }, { mode: 'source-over', layers: 6, spread: 8, edge: 0.1, bloom: 0.2, gran: 0.2 });
    g.save(); polyPath(g, beardP); g.clip();
    for (let i = 0; i < 380; i++) {
      const x = -120 + RNG() * 680, y0 = 1030 + RNG() * 400, l = 80 + RNG() * 220;
      g.strokeStyle = RNG() < 0.6 ? 'rgba(248,246,242,' + (0.4 + RNG() * 0.5) + ')' : 'rgba(80,72,100,' + (0.3 + RNG() * 0.3) + ')';
      g.lineWidth = 0.8 + RNG() * 2;
      g.beginPath(); g.moveTo(x, y0); g.bezierCurveTo(x + 20, y0 + l * 0.35, x + 4, y0 + l * 0.7, x + 26 + RNG() * 20, y0 + l); g.stroke();
    }
    g.restore();
    // the hood: dark wool, then a fur trim rimed with frost
    const edge = [[X0, 470], [0, 430], [200, 392], [420, 360], [640, 336], [860, 312], [1080, 262], [1360, 196]];
    const sh = catmull(edge, 6, false);
    wash(P, sh.concat(sh.slice().reverse().map((p) => [p[0], p[1] + 150])), (tg) => { const gr = tg.createLinearGradient(0, 300, 0, 520); gr.addColorStop(0, 'rgba(16,12,32,0.92)'); gr.addColorStop(1, 'rgba(16,12,32,0)'); return gr; }, { layers: 4, spread: 7, edge: 0 });
    const hood = [[X0, Y0], [X0 + WW, Y0]].concat(sh.slice().reverse().map((p) => [p[0], p[1] - 40]));
    wash(P, hood, (tg) => { const gr = tg.createLinearGradient(0, Y0, 0, 420); gr.addColorStop(0, '#171a2c'); gr.addColorStop(1, '#30364e'); return gr; }, { mode: 'source-over', layers: 5, spread: 3, gran: 0.6, bloom: 0.2, edge: 0.3 });
    g.save(); polyPath(g, hood); g.clip();
    g.globalAlpha = 0.5; g.drawImage(A.cloth.cloak.c, X0, Y0, WW, 700); g.globalAlpha = 1;
    for (let f = 0; f < 7; f++) { const off = 80 + f * 46 + RNG() * 20; const pts = sh.map((p, i) => [p[0], p[1] - off + Math.sin(i * 0.12 + f * 2) * 14]).slice(2 + f * 3, sh.length - 2 - f * 2); g.fillStyle = '#0a0a16'; g.globalAlpha = 0.55; inkStroke(g, pts, 3 + RNG() * 3, { ti: 0.3, to: 0.4 }); dryBrush(g, pts.map((p) => [p[0], p[1] - 8]), 7, '#4e5680', { n: 5, alpha: 0.35 }); }
    g.restore(); g.globalAlpha = 1;
    // fur trim: a soft mass, then clumps of hair in every direction
    const band = sh.map((p) => [p[0], p[1] - 46]).concat(sh.slice().reverse().map((p) => [p[0], p[1] + 18]));
    wash(P, band, (tg) => { const gr = tg.createLinearGradient(0, 200, 0, 480); gr.addColorStop(0, '#4a4256'); gr.addColorStop(1, '#7a6e7e'); return gr; }, { mode: 'source-over', layers: 6, spread: 6, edge: 0, bloom: 0.3, gran: 0.4 });
    for (let c = 0; c < 420; c++) {
      const k = Math.floor(RNG() * (sh.length - 1)), p = sh[k];
      const rx = p[0] + (RNG() - 0.5) * 14, ry2 = p[1] - 40 + RNG() * 52;
      const base = PI / 2 + (RNG() - 0.5) * 1.6 + (ry2 < p[1] - 20 ? PI : 0) * (RNG() < 0.3 ? 1 : 0);
      const tone = RNG();
      const col = tone < 0.3 ? [226, 226, 238] : tone < 0.55 ? [160, 140, 132] : tone < 0.85 ? [96, 84, 100] : [26, 20, 34];
      for (let j = 0; j < 9; j++) {
        const a2 = base + (RNG() - 0.5) * 0.9, l = 8 + RNG() * 26;
        g.strokeStyle = rgba(col, 0.35 + RNG() * 0.45); g.lineWidth = 0.7 + RNG() * 1.2;
        g.beginPath(); g.moveTo(rx, ry2); g.quadraticCurveTo(rx + Math.cos(a2 + 0.3) * l * 0.5, ry2 + Math.sin(a2 + 0.3) * l * 0.5, rx + Math.cos(a2) * l, ry2 + Math.sin(a2) * l); g.stroke();
      }
    }
    // frost on the fur
    for (let i = 0; i < 260; i++) { const k = Math.floor(RNG() * sh.length), p = sh[k]; const x = p[0] + (RNG() - 0.5) * 30, y = p[1] - 30 + RNG() * 60; g.fillStyle = 'rgba(246,248,255,' + (0.5 + RNG() * 0.5) + ')'; blob(g, x, y, 0.8 + RNG() * 2.4, 6, 0.5); }
    dryBrush(g, sh.map((p) => [p[0], p[1] + 14]), 6, '#a8b2e6', { n: 6, alpha: 0.4, broken: 0.1 });
    A.eyeFace = { c: gpu(P.c), x: X0, y: Y0, w: WW, h: HH };
    buildEyeBall(); buildBrow();
  }
  function buildEyeBall() {
    const r = R * 1.45, x0 = 300, y0 = 560, w = 520, h = 300;
    const P = painter(x0, y0, w, h, r), g = P.g;
    const sc = g.createRadialGradient(560, 760, 40, 560, 720, 330); sc.addColorStop(0, '#cdc2c6'); sc.addColorStop(0.45, '#a89aa8'); sc.addColorStop(1, '#4e405a');
    g.fillStyle = sc; g.fillRect(x0, y0, w, h);
    // veins
    g.strokeStyle = 'rgba(170,70,80,0.45)';
    for (let i = 0; i < 26; i++) { const left = RNG() < 0.5; let x = left ? 350 + RNG() * 60 : 700 + RNG() * 70, y = 690 + RNG() * 60; g.lineWidth = 0.6 + RNG() * 0.8; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 5; k++) { x += (left ? 1 : -1) * (6 + RNG() * 10); y += (RNG() - 0.5) * 9; g.lineTo(x, y); } g.stroke(); }
    // iris
    const [ix, iy] = EYE.iris, ir = EYE.ir;
    const ig = g.createRadialGradient(ix, iy, 10, ix, iy, ir); ig.addColorStop(0, '#5a6a7a'); ig.addColorStop(0.45, '#7d93a3'); ig.addColorStop(0.82, '#5c6e82'); ig.addColorStop(1, '#2a3040');
    g.fillStyle = ig; g.beginPath(); g.arc(ix, iy, ir, 0, TAU); g.fill();
    g.lineCap = 'round';
    for (let i = 0; i < 230; i++) {
      const a = RNG() * TAU, r0 = EYE.pr + 2 + RNG() * 10, r1 = r0 + 20 + RNG() * (ir - r0 - 18);
      g.strokeStyle = RNG() < 0.5 ? 'rgba(200,214,220,0.35)' : 'rgba(30,38,54,0.45)'; g.lineWidth = 0.7 + RNG() * 1.4;
      const wob = (RNG() - 0.5) * 0.12;
      g.beginPath(); g.moveTo(ix + Math.cos(a) * r0, iy + Math.sin(a) * r0); g.quadraticCurveTo(ix + Math.cos(a + wob) * (r0 + r1) / 2, iy + Math.sin(a + wob) * (r0 + r1) / 2, ix + Math.cos(a) * r1, iy + Math.sin(a) * r1); g.stroke();
    }
    g.strokeStyle = 'rgba(150,120,80,0.35)'; g.lineWidth = 3;
    g.beginPath(); g.arc(ix, iy, EYE.pr + 12, 0, TAU); g.stroke();
    g.strokeStyle = '#1c1e2c'; g.lineWidth = 5; g.beginPath(); g.arc(ix, iy, ir - 2, 0, TAU); g.stroke();
    // pupil
    const pg = g.createRadialGradient(ix, iy, EYE.pr * 0.6, ix, iy, EYE.pr + 3); pg.addColorStop(0, '#0e0b14'); pg.addColorStop(0.85, '#141019'); pg.addColorStop(1, 'rgba(20,16,25,0)');
    g.fillStyle = pg; g.beginPath(); g.arc(ix, iy, EYE.pr + 3, 0, TAU); g.fill();
    // reflected horizon: a dark band of mountains across the lower iris
    g.save(); g.beginPath(); g.arc(ix, iy, ir - 3, 0, TAU); g.clip();
    g.fillStyle = 'rgba(18,14,30,0.35)'; g.beginPath(); g.moveTo(ix - ir, iy + 30);
    for (let x = -ir; x <= ir; x += 8) g.lineTo(ix + x, iy + 30 - Math.abs(Math.sin(x * 0.07)) * 9 + x * 0.06);
    g.lineTo(ix + ir, iy + ir); g.lineTo(ix - ir, iy + ir); g.closePath(); g.fill();
    g.restore();
    // ink: limbus
    g.fillStyle = INK; g.globalAlpha = 0.8;
    inkStroke(g, ellipsePts(ix, iy, ir, ir, 60).concat([[ix + ir, iy]]), 2.4, { ti: 0.05, to: 0.05, vr: 0.5 });
    g.globalAlpha = 1;
    A.eyeBall = { c: gpu(P.c), x: x0, y: y0, w, h };
  }
  function buildBrow() {
    const r = R * 1.45, x0 = 180, y0 = 330, w = 820, h = 360;
    const P = painter(x0, y0, w, h, r), g = P.g;
    g.lineCap = 'round';
    const base = bez([[250, 548], [420, 470], [700, 452], [960, 560]], 40);
    for (let i = 0; i < 520; i++) {
      const u = Math.pow(RNG(), 0.9), k = Math.floor(u * 40), b = base[k];
      const ang = -0.35 - u * 0.4 + (RNG() - 0.5) * 0.8 + (u > 0.75 ? 0.9 : 0);
      const l = 18 + RNG() * 50 * (0.5 + u);
      const x = b[0] + (RNG() - 0.5) * 20, y = b[1] + (RNG() - 0.5) * 22;
      const white = RNG() < 0.62;
      g.strokeStyle = white ? 'rgba(236,232,228,' + (0.6 + RNG() * 0.4) + ')' : 'rgba(34,28,44,' + (0.45 + RNG() * 0.4) + ')';
      g.lineWidth = 0.9 + RNG() * 2;
      const cx2 = x + Math.cos(ang) * l * 0.5, cy2 = y + Math.sin(ang) * l * 0.5 - 4;
      g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(cx2, cy2, x + Math.cos(ang + 0.35) * l, y + Math.sin(ang + 0.35) * l + 6); g.stroke();
    }
    // a few long wild hairs drooping over the lid
    for (let i = 0; i < 9; i++) {
      const b = base[24 + Math.floor(RNG() * 14)];
      g.strokeStyle = 'rgba(240,236,230,0.9)'; g.lineWidth = 1.3;
      g.beginPath(); g.moveTo(b[0], b[1]); g.bezierCurveTo(b[0] + 40, b[1] - 20, b[0] + 70, b[1] + 10, b[0] + 70 + RNG() * 50, b[1] + 50 + RNG() * 40); g.stroke();
    }
    // snow caught in the brow
    g.fillStyle = 'rgba(250,248,244,0.95)';
    for (let i = 0; i < 14; i++) { const b = base[Math.floor(RNG() * 40)]; blob(g, b[0] + (RNG() - 0.5) * 40, b[1] - 10 + (RNG() - 0.5) * 20, 2 + RNG() * 3.5, 7, 0.5); }
    A.eyeBrow = { c: gpu(P.c), x: x0, y: y0, w, h };
  }
  function eyeOpen(t) { return track([[0, 0.36], [0.5, 0.34], [0.8, 0.3, 's'], [1.18, 1.03, 'back'], [1.6, 0.97, 'io'], [2.3, 0.9, 's'], [3.3, 0.96, 's']], t) + 0.01 * Math.sin(t * 7); }
  function sparkI(t) { return t < 0.38 ? 0 : clamp(sstep(0.38, 0.55, t) * (0.45 + 0.55 * sstep(0.6, 3.0, t)), 0, 1) * (0.85 + 0.15 * Math.sin(t * 23) * Math.sin(t * 7)); }
  function renderEye(g, t) {
    const u = EZ.i2(clamp(t / 3.3, 0, 1));
    const Z = lerp(1.28, 1.9, EZ.i(clamp((t - 0.2) / 3.1, 0, 1))) + 0.04 * sstep(0, 1.5, t);
    const hd = hand(t + 3, 3), jolt = shake(t, 0.95, 0.5, 5);
    const sp = EYE.spark, tgt = SPARK_SCREEN;
    const sx = lerp(sp[0], tgt[0], u) + hd[0] + jolt[0], sy = lerp(sp[1], tgt[1], u) + hd[1] + jolt[1];
    const T = (gg) => { gg.setTransform(S, 0, 0, S, 0, 0); gg.translate(sx, sy); gg.rotate(hd[2] + jolt[2] - 0.09 + 0.02 * u); gg.scale(Z, Z); gg.translate(-sp[0], -sp[1]); };
    T(g);
    drawSprite(g, A.eyeFace, 0, 0);
    const o = eyeOpen(t);
    const upB = lidUpper(o), upP = bez(upB, 30), loP = bez(LID_LOW, 30);
    const ap = upP.concat(loP.slice().reverse());
    g.save(); polyPath(g, ap); g.clip();
    const gz = sstep(0.85, 1.3, t);
    g.drawImage(A.eyeBall.c, A.eyeBall.x - 6 * gz, A.eyeBall.y - 3 * gz, A.eyeBall.w, A.eyeBall.h);
    // the spark of the far beacon, mirrored in the eye
    const si = sparkI(t);
    if (si > 0) {
      const px = sp[0] - 6 * gz, py = sp[1] - 3 * gz, gs = 0.6 + 0.9 * sstep(0.5, 3.0, t);
      // the iris warms around the reflected fire
      const ig = g.createRadialGradient(px, py, 0, px, py, 70 + 70 * gs); ig.addColorStop(0, rgba([255, 150, 70], 0.5 * si)); ig.addColorStop(0.5, rgba([230, 120, 60], 0.18 * si)); ig.addColorStop(1, 'rgba(230,120,60,0)');
      g.save(); g.globalCompositeOperation = 'screen'; g.fillStyle = ig; g.fillRect(px - 160, py - 160, 320, 320); g.restore();
      glow(g, px, py, (36 + 40 * si) * gs, [255, 140, 50], 0.85 * si);
      g.fillStyle = rgba([255, 170, 90], si); g.beginPath(); g.ellipse(px, py, (5 + si * 3) * gs, (7 + si * 5) * gs, 0, 0, TAU); g.fill();
      g.fillStyle = rgba([255, 236, 190], si); g.beginPath(); g.ellipse(px, py + 0.5, (2.8 + si * 1.6) * gs, (3.6 + si * 2.2) * gs, 0, 0, TAU); g.fill();
      g.fillStyle = rgba([255, 255, 245], si); g.beginPath(); g.arc(px, py + 1, 1.6 * gs, 0, TAU); g.fill();
      g.globalAlpha = 0.6 * si; g.fillStyle = '#ffa050'; inkStroke(g, [[px, py - 4 * gs], [px + 1, py - (14 + si * 8) * gs], [px - 1, py - (24 + si * 16) * gs]], 3.2 * gs, { ti: 0.1, to: 0.9 }); g.globalAlpha = 1;
    }
    // sky window catchlight
    g.fillStyle = 'rgba(226,232,255,0.9)';
    g.beginPath(); g.ellipse(548 - 6 * gz, 676 - 3 * gz, 15, 11, -0.3, 0, TAU); g.fill();
    // wet glints on the cornea
    g.strokeStyle = 'rgba(236,240,255,0.55)'; g.lineWidth = 2.2; g.beginPath(); g.arc(EYE.iris[0] - 6 * gz, EYE.iris[1] - 3 * gz, EYE.ir - 12, -1.1, -0.35); g.stroke();
    g.fillStyle = 'rgba(240,244,255,0.7)'; g.beginPath(); g.arc(610 - 6 * gz, 745 - 3 * gz, 2.5, 0, TAU); g.fill();
    g.fillStyle = 'rgba(236,236,248,0.5)'; g.beginPath(); g.arc(568 - 6 * gz, 700 - 3 * gz, 4, 0, TAU); g.fill();
    // shadow cast by the upper lid
    const sh = upP.concat(upP.slice().reverse().map((p) => [p[0], p[1] + 44]));
    const lg = g.createLinearGradient(0, 600, 0, 760); lg.addColorStop(0, 'rgba(40,24,50,0.75)'); lg.addColorStop(1, 'rgba(40,24,50,0)');
    g.fillStyle = 'rgba(40,24,50,0.4)'; polyPath(g, sh); g.fill();
    g.restore();
    // lid skin roundness just above the lid edge
    g.save(); const above = upP.concat(upP.slice().reverse().map((p) => [p[0], p[1] - 40])); polyPath(g, above); g.clip();
    g.fillStyle = 'rgba(60,30,50,0.18)'; polyPath(g, above); g.fill(); g.restore();
    // upper lid margin: thick ink, lashes
    BOIL = Math.floor(t * 12);
    g.fillStyle = INK; inkStroke(g, jit(upP, 0.5, 3), 9, { ti: 0.25, to: 0.35, vr: 0.3, sd: 5 });
    g.strokeStyle = INK; g.lineCap = 'round';
    for (let i = 4; i < 28; i += 1.5) {
      const k = Math.floor(i), p = upP[k], q = upP[k + 1], ang = Math.atan2(q[1] - p[1], q[0] - p[0]) + PI / 2 + 0.25 + (i / 30) * 0.6;
      const l = (8 + hr(k, 2) * 9) * (0.5 + 0.5 * Math.sin((i / 30) * PI));
      g.globalAlpha = 0.7; g.lineWidth = 1.1 + hr(k, 3) * 0.8;
      g.beginPath(); g.moveTo(p[0], p[1] + 2); g.quadraticCurveTo(p[0] + Math.cos(ang) * l * 0.6, p[1] + 2 + Math.sin(ang) * l * 0.6, p[0] + Math.cos(ang - 0.6) * l + 3, p[1] + 2 + Math.sin(ang - 0.6) * l); g.stroke();
    }
    g.globalAlpha = 1;
    // crease that rides with the lid
    const cr = upP.map((p, i) => [p[0] + 6, p[1] - 22 - 10 * o * Math.sin((i / 30) * PI)]);
    g.globalAlpha = 0.5; inkStroke(g, jit(cr.slice(2, 29), 0.5, 9), 3, { ti: 0.4, to: 0.4 }); g.globalAlpha = 1;
    // lower lid, wet line
    g.globalAlpha = 0.85; inkStroke(g, jit(loP.slice(1, 30), 0.5, 13), 3.4, { ti: 0.3, to: 0.4 }); g.globalAlpha = 1;
    g.fillStyle = 'rgba(250,236,236,0.75)'; inkStroke(g, loP.slice(4, 26).map((p) => [p[0], p[1] - 3]), 2.4, { ti: 0.4, to: 0.4 });
    g.fillStyle = 'rgba(210,110,120,0.6)'; g.beginPath(); g.ellipse(352, 728, 12, 9, 0.2, 0, TAU); g.fill();
    flushLow(g, GLB, 'screen');
    // brow rides up with the eye
    const by = -16 * sstep(0.85, 1.3, t);
    g.drawImage(A.eyeBrow.c, A.eyeBrow.x, A.eyeBrow.y + by, A.eyeBrow.w, A.eyeBrow.h);
    // breath in the cold
    g.setTransform(S, 0, 0, S, 0, 0);
    smoke(g, { x: 110, y: 1400, w: 60 }, t + 2, { rate: 1.6, life: 2.6, up: 150, wind: 90, r0: 50, grow: 90, alpha: 0.18, sd: 3 });
    flushLow(g, FXB);
    // snow drifting past the face, near and soft
    snowfall(g, t + 5, { X: 0, Y: 0, Z: 1 }, { wind: -40, layers: [{ n: 26, p: 0, size: 3.2, speed: 60, sway: 18, windK: 1, alpha: 0.9 }, { n: 7, p: 0, size: 9, speed: 120, sway: 30, windK: 1.6, alpha: 0.5, soft: true }] });
    // cold grade
    g.save(); g.globalCompositeOperation = 'multiply'; g.fillStyle = 'rgba(176,190,240,0.22)'; g.fillRect(0, 0, W, H); g.restore();
    // the light of the spark spills into the frame as we push into it
    const sp2 = sparkI(t) * sstep(2.2, 3.1, t);
    if (sp2 > 0) glow(g, sx, sy, 80 + 260 * sp2, [255, 160, 80], 0.5 * sp2);
    flushLow(g, GLB, 'screen');
  }
  let DBG = null;
  /* ================================================================== SHOTS 2–4 — THE SUMMIT */
  function camSummit(t) {
    let X, Y, Z;
    const trX = (tt) => runX(tt - 0.12) + 120 * clamp(runSpeed(tt) / 205, 0.3, 1) + 10;
    if (t < 8.25) {
      X = track([[2.6, CAM_S2_START.X], [4.9, -150, 'io'], [8.25, -112, 's']], t);
      Y = track([[2.6, CAM_S2_START.Y], [4.9, -300, 'io'], [8.25, -318, 's']], t);
      Z = track([[2.6, CAM_S2_START.Z], [4.9, 1.05, 'io'], [8.25, 1.13, 's']], t);
    } else if (t < 8.62) {
      const u = EZ.io((t - 8.25) / 0.37);
      X = lerp(-112, trX(8.62), u); Y = lerp(-318, gY(runX(8.62)) - 262, u); Z = lerp(1.13, 1.62, u);
    } else {
      const w = sstep(14.0, 16.0, t);
      const Xs = track([[14.0, trX(14.0)], [16.0, 1165, 'o2'], [18.0, 1180], [19.6, 1190], [22, 1215], [25.6, 1290]], t);
      X = lerp(trX(t), Xs, w);
      Y = lerp(gY(runX(t - 0.2)) - 262 + 3 * Math.sin(t * 5.5), track([[14.0, -332], [17.6, -345], [19.6, -420, 'io'], [22, -470], [23.3, -560, 's'], [25.8, -1750, 'i2']], t), w);
      Z = lerp(1.62, track([[14.0, 1.4], [15.8, 1.24], [17.7, 1.34, 'io'], [19.6, 1.08, 'io'], [22, 1.0], [25.8, 0.92]], t), w);
    }
    const hd = hand(t, 4), sk = shake(t, 18.15, 1.6, 9), sk2 = shake(t, 12.0, 0.4, 3);
    if (DBG && DBG.zoom) { const r = keeperRoot(t); return { X: r.x, Y: gY(r.x) - 95, Z: DBG.zoom, rot: 0 }; }
    return { X: X + hd[0] + sk[0] + sk2[0], Y: Y + hd[1] + sk[1] + sk2[1], Z, rot: hd[2] + sk[2] };
  }
  function pyreState(t) {
    const door = sstep(17.35, 17.95, t);
    const front = clamp((t - 17.95) / 0.6, 0, 1);
    const pillar = t < 18.2 ? 0 : EZ.o(clamp((t - 18.2) / 0.95, 0, 1)) * (1 + 0.22 * Math.exp(-Math.pow((t - 19.0) / 0.45, 2)));
    const light = Math.max(door * 0.22, front * 0.7, pillar);
    return { door, front, pillar, light, burn: sstep(17.95, 19.4, t) };
  }
  let STUCK = null;
  function brandAt(t) {
    // brand tip in world coordinates while held; computed from the rig without drawing
    const p = keeperPose(t); if (!(p.brand > 0.5)) return null;
    const r = keeperRoot(t), F = fk(p), tip = add(F.HN, up(p.ba), 58);
    const sink = t > 8.3 && t < 15.2 ? 9 : 0;
    return [r.x + r.dir * tip[0], gY(r.x) + sink + tip[1]];
  }
  function renderSummit(g, t) {
    const cam = camSummit(t);
    const ps = pyreState(t);
    const flick = 0.85 + 0.15 * n2(t * 6, 1);
    const pyX = SUM.pyreX, pyG = gY(SUM.pyreX);
    const bt = brandAt(t);
    LIGHTS = [{ x: SUM.brazierX, y: gY(SUM.brazierX) - 50, r: 165 * flick, a: 0.62 * flick }];
    if (bt) LIGHTS.push({ x: bt[0], y: bt[1], r: 210 * flick, a: 0.7 * (t > 16.0 ? 1 - 0.6 * sstep(16.0, 17.3, t) : 1) });
    if (ps.light > 0) LIGHTS.push({ x: pyX - 40, y: pyG - 150 - 200 * ps.pillar, r: 380 + 1150 * ps.light, a: Math.min(1, ps.light * 1.05) * flick });
    buildMask(cam);
    drawLayer(g, A.skyA, cam);
    drawLayer(g, A.farA, cam);
    // the far beacon over the white city
    camT(g, cam, 0.1);
    const fw = A.flare, fl = 0.85 + 0.15 * Math.sin(t * 17) * Math.sin(t * 5.3);
    glow(g, fw[0], fw[1] - 2, 34, [255, 150, 70], 0.55 * fl);
    fire(g, fw[0], fw[1] + 0.5, 3.2, 8 * fl, t, 9, { n: 2, ink: false });
    g.globalAlpha = 0.2; g.fillStyle = '#4a3c52'; g.beginPath(); g.ellipse(fw[0] - 6, fw[1] - 14, 4, 8, -0.4, 0, TAU); g.fill(); g.globalAlpha = 1;
    drawLayer(g, A.midA, cam);
    drawLayer(g, A.nearA, cam);
    drawLit(g, A.groundC, A.groundW, cam);
    camT(g, cam, 1);
    // hut: window light and chimney smoke
    glow(g, 373, gY(330) - 66, 34, [255, 190, 100], 0.45);
    smoke(g, { x: 383, y: gY(330) - 24 - 66 - 64, w: 6 }, t, { rate: 2.2, life: 4.5, up: 26, wind: -14, windA: -2, r0: 5, grow: 9, alpha: 0.35, sd: 1 });
    // pyre: pillar behind, sprite, body flames in front
    if (ps.pillar > 0) {
      glow(g, pyX, pyG - 420, 260 + 420 * ps.pillar, [255, 130, 50], 0.55 * ps.pillar, 'screen');
      fire(g, pyX - 4, pyG + A.pyreTop + 40, 250 + 40 * ps.pillar, 220 + 760 * ps.pillar, t, 31, { n: 7, lean: -0.1, sway: 0.9, inkW: 1.6 });
    }
    flushLow(g, FXB); camT(g, cam, 1);
    drawSprite(g, A.pyreC, pyX, pyG + 2);
    if (ps.burn > 0) { g.globalAlpha = ps.burn; drawSprite(g, A.pyreB, pyX, pyG + 2); g.globalAlpha = 1; }
    if (ps.front > 0) {
      for (let j = 0; j < 3; j++) {
        const on = clamp(ps.front * 3 - j, 0, 1); if (on <= 0) continue;
        const yy = pyG - 30 - j * 115, ww = 250 - j * 50;
        fire(g, pyX + (j % 2 ? 10 : -6), yy, ww, (150 + 40 * j) * on * (0.75 + 0.35 * ps.pillar), t + j * 0.37, 50 + j, { n: 6 - j, lean: -0.06, alpha: 0.72, inkW: 1.3 });
      }
    }
    const door = A.pyreDoor ? [pyX + A.pyreDoor[0], pyG + 2 + A.pyreDoor[1]] : [pyX - 110, pyG - 50];
    if (ps.door > 0 && ps.front < 1) fire(g, door[0], door[1] + 10, 30 + 30 * ps.door, 30 + 70 * ps.door, t, 71, { n: 3, lean: -0.05, alpha: 1 - ps.front * 0.5 });
    flushLow(g, FXB); camT(g, cam, 1);
    // the brand left in the pyre
    if (t >= 17.95 && STUCK) {
      g.fillStyle = '#2a1a14'; inkStroke(g, [STUCK.h, STUCK.tip], 4.2, { ti: 0, to: 0, min: 0.8, vr: 0.1 });
    }
    // brazier
    const bx = SUM.brazierX, by = gY(bx) + 2;
    drawSprite(g, A.brazier, bx, by);
    g.fillStyle = '#ff8a3a';
    for (let i = 0; i < 9; i++) { g.globalAlpha = 0.5 + 0.5 * Math.sin(t * 5 + i * 2.3); g.beginPath(); g.arc(bx - 20 + i * 5, by - 47 + Math.sin(i * 3) * 1.5, 1.6, 0, TAU); g.fill(); }
    g.globalAlpha = 1;
    fire(g, bx, by - 46, 34, 26 + 6 * Math.sin(t * 3), t, 81, { n: 3, lean: -0.08 });
    glow(g, bx, by - 52, 70, [255, 140, 60], 0.35 * flick);
    if (t < 7.45) {
      // the brand resting in the coals until he takes it
      const F = fk(P_REACH), r = keeperRoot(7.3), hnd = [r.x + r.dir * F.HN[0], gY(r.x) + F.HN[1]];
      const tip = [bx + 6, by - 46];
      g.fillStyle = '#4a3226'; inkStroke(g, [hnd, tip], 4.2, { ti: 0, to: 0, min: 0.8 });
      g.fillStyle = INK; inkStroke(g, [[hnd[0], hnd[1] - 2], [tip[0], tip[1] - 2]], 0.9, { ti: 0.1, to: 0.1 });
    }
    // the keeper
    const kp = renderKeeper(g, t, cam, ps);
    // brand fire
    if (bt) {
      const v = keeperMotion(t).vx;
      const boost = 1 + 0.7 * Math.exp(-Math.pow((t - 7.75) / 0.2, 2));
      const smother = t > 16.0 ? 1 - 0.65 * sstep(16.0, 17.2, t) : 1;
      camT(g, cam, 1);
      glow(g, bt[0], bt[1] - 8, 60 * boost * smother, [255, 150, 60], 0.5 * smother);
      fire(g, bt[0], bt[1] + 4, 13 * smother, 34 * boost * smother, t, 91, { n: 3, lean: clamp(-v * 0.0035, -0.8, 0.8) - 0.05, sway: 1.4 });
    }
    camT(g, cam, 1);
    if (t > 7.4 && t < 15.6) sparks(g, null, t, { rate: 18, life: 1.1, t0: 7.4, t1: 15.4, up: 50, spreadV: 50, size: 1.6, srcAt: (b) => brandAt(b), sd: 4, alpha: 0.9 });
    drawLit(g, A.lipC, A.lipW, cam);
    drawLit(g, A.foreC, A.foreW, cam);
    camT(g, cam, 1);
    // the smoke-wisp of the beat of nothing; then the column
    smoke(g, { x: door[0] + 6, y: door[1] - 10, w: 6 }, t, { rate: 5, life: 2.6, up: 34, wind: -6, r0: 4, grow: 10, alpha: 0.35, t0: 16.15, t1: 17.6, sd: 6, warm: 0.4 });
    if (t > 18.3) smoke(g, { x: pyX, y: pyG - 700 - 300 * ps.pillar, w: 140 }, t, { rate: 7, life: 7, up: 120, acc: 6, wind: -24, windA: -3, r0: 70, grow: 55, alpha: 0.55, t0: 18.3, sd: 7, warm: 1, warmFade: 0.35 });
    if (t > 18.0) {
      sparks(g, { x: pyX, y: pyG - 380, w: 220, h: 300 }, t, { rate: 70, life: 3.2, t0: 18.05, up: 300, spreadV: 140, wind: -30, windA: -6, size: 2.4, sd: 8 });
      sparks(g, { x: pyX, y: pyG - 200, w: 260, h: 200 }, t, { rate: 420, life: 2.2, t0: 18.15, t1: 18.55, up: 520, spreadV: 520, size: 2.8, sd: 9, grav: 1 });
    }
    flushLow(g, FXB); flushLow(g, GLB, 'screen');
    // falling snow, blown from the west
    const wind = t < 8.6 ? -50 : t < 15 ? -150 : -70 + 140 * ps.pillar;
    g.setTransform(S, 0, 0, S, 0, 0);
    snowfall(g, t, cam, { wind, layers: [{ n: 90, p: 0.35, size: 1.2, speed: 40, sway: 10, windK: 0.6, alpha: 0.75 }, { n: 60, p: 1, size: 2, speed: 70, sway: 16, windK: 1, alpha: 0.85 }, { n: 10, p: 1.7, size: 5, speed: 140, sway: 26, windK: 1.6, alpha: 0.6, soft: true }] });
    // warm air glow over everything when the pyre roars
    if (ps.light > 0) {
      g.save(); camT(g, cam, 1);
      glow(g, pyX, pyG - 300, 900 * ps.light + 200, [255, 120, 50], 0.28 * ps.light, 'soft-light');
      g.restore();
      flushLow(g, GLB, 'screen');
    }
    return cam;
  }
  function renderKeeper(g, t, cam, ps) {
    const pose = keeperPose(t), root = keeperRoot(t), mot = keeperMotion(t);
    if (t >= 18.0) mot.wind = 40 * ps.pillar, mot.lift = 20 * ps.pillar, mot.flutter = 0.7 * ps.pillar;
    else if (t > 8.6 && t < 15) mot.wind = -40;
    else mot.wind = -12;
    const sink = t > 8.3 && t < 15.2 ? 9 : 0;
    const ry = gY(root.x) + sink;
    const Z = cam.Z;
    const sx = (W / 2 + Z * (root.x - cam.X)) * S, sy = (H / 2 + Z * (ry - cam.Y)) * S;
    const hw = 175 * Z * S;
    let x0 = Math.floor(sx - hw), y0 = Math.floor(sy - 245 * Z * S), x1 = Math.ceil(sx + hw), y1 = Math.ceil(sy + 30 * Z * S);
    x0 = Math.max(0, x0); y0 = Math.max(0, y0); x1 = Math.min(FR.c.width, x1); y1 = Math.min(FR.c.height, y1);
    if (x1 <= x0 || y1 <= y0) return null;
    const bw = x1 - x0, bh = y1 - y0;
    const c = CH.g;
    c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(x0, y0, bw, bh);
    c.save(); c.beginPath(); c.rect(x0, y0, bw, bh); c.clip();
    camT(c, cam, 1);
    BOIL = Math.floor(t * 12);
    const out = drawKeeper(c, pose, [root.x, ry], root.dir, mot, t, { ground: gY(root.x) + sink });
    if (t > 17.9 && t < 18.0 && !STUCK) { /* cached below */ }
    // light the figure
    c.globalCompositeOperation = 'source-atop';
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.fillStyle = 'rgba(30,28,66,0.18)'; c.fillRect(x0, y0, bw, bh);
    const sil = 0.55 * sstep(18.0, 18.8, t) * (1 - 0.35 * sstep(21, 23.5, t));
    if (sil > 0) { c.fillStyle = 'rgba(26,14,26,' + sil + ')'; c.fillRect(x0, y0, bw, bh); }
    camT(c, cam, 1);
    for (const l of LIGHTS) {
      const rr = Math.min(l.r, 520);
      const gr = c.createRadialGradient(l.x, l.y, 0, l.x, l.y, rr);
      const a = clamp(l.a * 0.75, 0, 0.85);
      gr.addColorStop(0, 'rgba(255,160,80,' + a + ')'); gr.addColorStop(0.5, 'rgba(255,130,70,' + a * 0.4 + ')'); gr.addColorStop(1, 'rgba(255,120,60,0)');
      c.fillStyle = gr; c.fillRect(l.x - rr, l.y - rr, rr * 2, rr * 2);
    }
    c.restore();
    // rim light from the strongest fire
    const L = ps.light > 0.05 ? LIGHTS[LIGHTS.length - 1] : null;
    if (L) {
      const lx = (W / 2 + Z * (L.x - cam.X)) * S, ly = (H / 2 + Z * (L.y - cam.Y)) * S;
      let dx = sx - lx, dy = (sy - 120 * Z * S) - ly; const dl = Math.hypot(dx, dy) || 1; dx /= dl; dy /= dl;
      const off = 1.6 * Z * S;
      const m = RM.g; m.setTransform(1, 0, 0, 1, 0, 0); m.clearRect(x0, y0, bw, bh);
      m.globalCompositeOperation = 'source-over'; m.drawImage(CH.c, x0, y0, bw, bh, x0, y0, bw, bh);
      m.globalCompositeOperation = 'source-in'; m.fillStyle = 'rgba(255,196,120,1)'; m.fillRect(x0, y0, bw, bh);
      m.globalCompositeOperation = 'destination-out'; m.drawImage(CH.c, x0, y0, bw, bh, x0 + dx * off, y0 + dy * off, bw, bh);
      m.globalCompositeOperation = 'source-over';
      c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.globalCompositeOperation = 'source-atop'; c.globalAlpha = clamp(L.a, 0, 1) * 0.75;
      c.drawImage(RM.c, x0, y0, bw, bh, x0, y0, bw, bh); c.restore();
    }
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(CH.c, x0, y0, bw, bh, x0, y0, bw, bh); g.restore();
    // breath while he sits in the cold
    if (out && t < 6.5) { camT(g, cam, 1); smoke(g, { x: out.mouth[0], y: out.mouth[1], w: 2 }, t, { rate: 0.6, life: 2.2, up: 10, wind: -26, r0: 3, grow: 14, alpha: 0.25, sd: 12 }); }
    return out;
  }
  /* ================================================================== SHOT 5 — THE SWEEP: fire racing west along the range */
  function camSweepX(t) { return track([[24.6, -40], [27.5, 340, 'i2'], [46.5, 5240, 'lin'], [49.9, 5600, 'o2']], t); }
  function camSweep(t) {
    const X = camSweepX(t);
    const Y = track([[24.6, -720], [27.6, 0, 'o2'], [34, -40, 's'], [41, 20, 's'], [49.9, -30, 's']], t);
    const Z = track([[24.6, 1.06], [27.6, 1.0, 'o2'], [49.9, 1.02]], t);
    const hd = hand(t, 3);
    return { X: X + hd[0], Y: Y + hd[1], Z, rot: hd[2] };
  }
  const BEACONS = [
    { name: 'Amon Dîn', x: -173, h: 470, w: 300, s: 1.3, tau: -1 },
    { name: 'Eilenach', x: 525, h: 585, w: 330, s: 1.12, tau: 28.2 },
    { name: 'Nardol', x: 938, h: 505, w: 300, s: 1.3, tau: 31.4 },
    { name: 'Erelas', x: 1350, h: 470, w: 260, s: 1.5, tau: 34.6 },
    { name: 'Min-Rimmon', x: 1763, h: 548, w: 280, s: 1.08, tau: 37.8 },
    { name: 'Calenhad', x: 2176, h: 455, w: 340, s: 1.75, tau: 41.0 },
    { name: 'Halifirien', x: 2900, h: 340, w: 380, s: 2.1, tau: 46.0 },
  ];
  function paintForest(P, ry, x0, x1, o) {
    const g = P.g;
    const n = Math.floor((x1 - x0) * (o.dens || 0.5));
    const trees = [];
    for (let i = 0; i < n; i++) {
      const x = lerp(x0, x1, RNG()), top = ry(x);
      const y = top + (o.from || 4) + Math.pow(RNG(), o.pow || 1.6) * (o.depth || 200);
      trees.push([x, y]);
    }
    trees.sort((a, b) => a[1] - b[1]);
    for (const [x, y] of trees) {
      const s = (o.size || 14) * (0.6 + RNG() * 0.7) * (1 + (y - ry(x)) * (o.grow || 0));
      const wdt = s * 0.38;
      const pts = [[x, y - s]];
      const tiers = 4;
      for (let k = 1; k <= tiers; k++) { const v = k / tiers; pts.push([x + wdt * v * 1.1, y - s + s * v * 0.95]); pts.push([x + wdt * v * 0.55, y - s + s * v * 0.95 - s * 0.08]); }
      pts.push([x, y]);
      const left = pts.slice(1, -1).reverse().map((p) => [2 * x - p[0], p[1]]);
      const poly = pts.concat(left);
      g.fillStyle = mixh(o.col, o.col2 || o.col, RNG()); polyPath(g, poly); g.fill();
      if (o.snow) { g.fillStyle = o.snow; g.globalAlpha = 0.75; for (let k = 1; k < tiers; k++) { const v = k / tiers; g.fillRect(x - wdt * v * 0.8, y - s + s * v * 0.95 - s * 0.1, wdt * v * 0.8, Math.max(0.6, s * 0.05)); } g.globalAlpha = 1; }
      if (o.ink) { g.strokeStyle = o.ink; g.globalAlpha = 0.7; g.lineWidth = Math.max(0.5, s * 0.04); g.beginPath(); g.moveTo(x, y - s); g.lineTo(x, y + s * 0.05); g.stroke(); g.globalAlpha = 1; }
    }
  }
  function buildSkyB() {
    const P = painter(-660, -820, 2000, 1560, R * 0.5), g = P.g;
    const y0 = -820, y1 = 740, f = (y) => (y - y0) / (y1 - y0);
    const gr = g.createLinearGradient(0, y0, 0, y1);
    gr.addColorStop(0, '#141230'); gr.addColorStop(f(-520), '#262050'); gr.addColorStop(f(-330), '#4a3c72'); gr.addColorStop(f(-190), '#7e5c86');
    gr.addColorStop(f(-110), '#bf8486'); gr.addColorStop(f(-60), '#e2a47c'); gr.addColorStop(f(40), '#d89a78'); gr.addColorStop(1, '#8a6a80');
    g.fillStyle = gr; g.fillRect(-660, y0, 2000, 1560);
    let rg = g.createRadialGradient(1450, -70, 10, 1450, -70, 1100);
    rg.addColorStop(0, 'rgba(255,196,120,0.85)'); rg.addColorStop(0.3, 'rgba(240,150,100,0.4)'); rg.addColorStop(1, 'rgba(200,110,120,0)');
    g.fillStyle = rg; g.fillRect(-660, y0, 2000, 1560);
    rg = g.createRadialGradient(-800, -260, 10, -800, -260, 900);
    rg.addColorStop(0, 'rgba(12,10,30,0.7)'); rg.addColorStop(1, 'rgba(12,10,30,0)');
    g.fillStyle = rg; g.fillRect(-660, y0, 2000, 1560);
    for (let i = 0; i < 9; i++) wash(P, lens(lerp(-600, 1300, RNG()), lerp(-780, -300, RNG()), 600 + RNG() * 700, 60 + RNG() * 100, RNG() * 40, 0.8), '#2a2350', { alpha: 0.16, layers: 4, spread: 7, edge: 0.1, bloom: 0.5, bscale: 2.4 });
    for (let i = 0; i < 16; i++) {
      const cx = lerp(-640, 1320, RNG()), cy = lerp(-560, -130, Math.pow(RNG(), 0.8)), L = 180 + RNG() * 520, T = 5 + RNG() * 14;
      const poly = lens(cx, cy, L, T, RNG() * 40, 0.3);
      const warm = sstep(-100, 1100, cx) * sstep(-600, -150, cy);
      wash(P, poly, mixh('#3a3058', '#6a4660', warm), { alpha: 0.7, layers: 5, spread: 2.5, edge: 0.4, gran: 0.2, bloom: 0.2 });
      const b = poly.slice(Math.floor(poly.length / 2) + 2, poly.length - 2);
      g.globalAlpha = 0.35 + 0.5 * warm; inkStroke(g, b, 2.6, { col: mixh('#c98aa0', '#ffc07a', warm), ti: 0.4, to: 0.4 }); g.globalAlpha = 1;
    }
    g.fillStyle = '#f6efe2';
    for (let i = 0; i < 200; i++) { const x = lerp(-660, 1340, Math.pow(RNG(), 1.6)), y = lerp(-820, -220, Math.pow(RNG(), 1.2)); star(g, x, y, 0.5 + Math.pow(RNG(), 4) * 1.5, (0.3 + RNG() * 0.6) * (1 - sstep(0, 1000, x) * 0.85)); }
    g.globalAlpha = 1;
    // a young moon low in the east
    const mx = -260, my = -470;
    glow(g, mx, my, 120, [220, 214, 240], 0.25, 'source-over');
    g.fillStyle = '#f3ecdc'; g.beginPath(); g.arc(mx, my, 19, 0, TAU); g.fill();
    g.fillStyle = '#2a2450'; g.beginPath(); g.arc(mx + 7, my - 4, 18, 0, TAU); g.fill();
    A.skyB = toLayer(P, 0.1);
  }
  function buildFarB() {
    const P = painter(-660, -260, 2200, 420, R * 0.75);
    const pk = genPeaks(-600, 1540, 90, 220, 50, 150, 110, 200, 1.2);
    paintRange(P, { shapes: true, x0: -660, x1: 1540, base: -10, peaks: pk, floor: 20, amp: 12, freq: 0.03, shade: '#7a6a98', shadeTop: '#6c5e8e', lit: '#f0c8c2', litLow: '#c49eb0', haze: '#d0a0a0', hmax: 150, inkA: 0.25, inkW: 0.9, detail: 0.3, hazeFrom: 0.5, hazeA: 0.95, below: 140, hiA: 0.7, hiW: 2 });
    mist(P, -660, 1540, 0, '#dcae9e', 12, { L: 300, T: 9, a: 0.5, dy: 20 });
    A.farB = toLayer(P, 0.15);
  }
  function buildMidB() {
    const P = painter(-680, -200, 2900, 520, R * 0.85);
    const pk = genPeaks(-640, 2200, 140, 320, 90, 240, 150, 260, 1.2);
    paintRange(P, { x0: -680, x1: 2220, base: 150, peaks: pk, floor: 40, und: 20, amp: 18, freq: 0.025, shade: '#5c5288', shadeTop: '#4e4680', lit: '#eebfbc', litLow: '#ab90b0', haze: '#b48ea6', rock: '#3a3260', hmax: 240, inkA: 0.45, inkW: 1.1, hatchA: 0.16, hatchGap: 4.4, hatchLen: 10, detail: 0.6, hazeFrom: 0.5, below: 170, hiA: 0.8, hiW: 2.6 });
    mist(P, -680, 2220, 140, '#c49aa6', 18, { L: 340, T: 12, a: 0.55, dy: 30 });
    A.midB = toLayer(P, 0.3);
  }
  function buildMainB() {
    const P = painter(-720, -220, 4300, 920, R);
    const pk = BEACONS.map((b) => ({ x: b.x, h: b.h, w: b.w, s: b.s, shape: b.shape }));
    for (const [x, h, w, sh] of [[-480, 360, 420, 'massif'], [60, 300, 380, 'massif'], [520, 340, 300, 'dome'], [930, 300, 380, 'massif'], [1350, 360, 300, 'crag'], [1760, 290, 360, 'massif'], [2200, 330, 420, 'massif'], [2400, 260, 300, 'dome'], [2950, 170, 380, 'massif'], [3300, 90, 300, 'dome']]) pk.push({ x, h, w, s: 1.2, shape: sh });
    const rg = paintRange(P, { x0: -720, x1: 3580, base: 440, peaks: pk, floor: 60, und: 30, amp: 26, freq: 0.018, shade: '#4a4478', shadeTop: '#3c3668', lit: '#f2c8be', litLow: '#a891b4', haze: '#8e7aa2', rock: '#2c2648', rockLit: '#6c5a80',
      hmax: 650, inkA: 0.8, inkW: 1.9, hatchA: 0.28, hatchGap: 3.8, hatchLen: 14, detail: 1.0, hazeFrom: 0.5, hazeA: 0.95, below: 260, hiA: 0.95, hiW: 4.2, lean: 0.5, amp: 34, prom: 0.05, rockLen: 1.3 });
    const g = P.g;
    // west warms, east cools
    g.save(); g.globalCompositeOperation = 'source-atop';
    const hgx = g.createLinearGradient(-720, 0, 3580, 0);
    hgx.addColorStop(0, 'rgba(70,70,140,0.28)'); hgx.addColorStop(0.45, 'rgba(120,90,150,0.05)'); hgx.addColorStop(1, 'rgba(255,170,100,0.3)');
    g.fillStyle = hgx; g.fillRect(-720, -220, 4300, 920); g.restore();
    // the Firien Wood clothes the last hill
    const hal = BEACONS[6];
    paintForest(P, rg.ry, hal.x - 300, hal.x + 360, { dens: 0.9, size: 13, depth: 320, pow: 1.3, col: '#2a2a40', col2: '#3a3348', snow: '#d9c6cc', ink: '#161424', from: 10, grow: 0.002 });
    paintForest(P, rg.ry, -720, 3580, { dens: 0.25, size: 10, depth: 140, from: 230, pow: 1, col: '#3a3456', col2: '#2e2a48', snow: '#bfaac0' });
    // tiny pyres on the summits
    A.beaconPts = [];
    for (const b of BEACONS) {
      let bx = b.x, by = 1e9;
      for (let x = b.x - b.w * 0.2; x <= b.x + b.w * 0.2; x += 3) { const y = rg.ry(x); if (y < by) { by = y; bx = x; } }
      A.beaconPts.push([bx, by]);
      g.fillStyle = '#2a1e22'; g.beginPath(); g.moveTo(bx - 7, by + 1); g.lineTo(bx - 4.5, by - 9); g.lineTo(bx + 4.5, by - 9); g.lineTo(bx + 7, by + 1); g.closePath(); g.fill();
      g.fillStyle = '#f6f0ea'; g.fillRect(bx - 4.5, by - 10, 9, 1.6);
      g.strokeStyle = INK; g.lineWidth = 1.5; g.beginPath(); g.moveTo(bx, by - 9); g.lineTo(bx + 0.5, by - 17); g.stroke();
    }
    mist(P, -720, 3580, 420, '#9c86a8', 26, { L: 420, T: 18, a: 0.65, dy: 40 });
    A.mainB = toLayer(P, 0.5);
  }
  function buildNearB() {
    const P = painter(-740, 60, 5960, 720, R);
    const pk = []; for (let x = -700; x < 5200; x += 180 + RNG() * 200) pk.push({ x, h: 460 + RNG() * 160, w: 220 + RNG() * 160, s: 1.6 });
    const rg = paintRange(P, { x0: -740, x1: 5220, base: 780, peaks: pk, floor: 380, und: 60, amp: 30, freq: 0.012, shade: '#2c2846', shadeTop: '#37305a', lit: '#8f7fa8', litLow: '#4c4268', haze: '#3a3352', rock: '#18142a', rockLit: '#2a2440',
      hmax: 640, inkA: 0.85, inkW: 2.2, hatchA: 0.32, hatchGap: 4, hatchLen: 16, detail: 0.9, hazeFrom: 0.3, hazeA: 0.6, below: 120, hiA: 0.55, hiW: 3.5, lean: 0.8, litA: 0.8 });
    paintForest(P, rg.ry, -740, 5220, { dens: 0.5, size: 22, depth: 300, from: 30, pow: 1.4, col: '#1c1a30', col2: '#262238', snow: '#8e82a6', ink: '#0e0c1a', grow: 0.0015 });
    mist(P, -740, 5220, 300, '#8a7ca0', 40, { L: 420, T: 26, a: 0.55, dy: 120 });
    A.nearB = toLayer(P, 0.8);
  }
  function buildForeB() {
    A.foreB = [];
    for (let k = 0; k < 3; k++) {
      const P = painter(-300, -460, 600, 520, R);
      const g = P.g;
      const pts = [];
      const hgt = 220 + k * 70;
      for (let i = 0; i <= 30; i++) { const u = i / 30; pts.push([lerp(-290, 290, u), 40 - hgt * Math.pow(Math.sin(PI * u), 0.7) * (0.8 + 0.3 * n1(k * 9 + u * 5)) + (RNG() - 0.5) * 12]); }
      const poly = pts.concat([[290, 60], [-290, 60]]);
      wash(P, poly, (tg) => { const gr = tg.createLinearGradient(-290, 0, 290, 0); gr.addColorStop(0, '#120f1e'); gr.addColorStop(1, '#2a2440'); return gr; }, { mode: 'source-over', layers: 4, spread: 1.5, gran: 0.5, edge: 0.4 });
      hatch(P, poly, { ang: 1.9, gap: 4, len: 22, w: 1.1, col: '#05040a', alpha: 0.5 });
      dryBrush(g, pts.slice(6, 22).map((p) => [p[0], p[1] + 3]), 8, '#b9aac6', { n: 8, alpha: 0.6 });
      g.fillStyle = INK; inkStroke(g, pts, 3, { ti: 0.05, to: 0.05 });
      const ry = (x) => { const i = clamp(((x + 290) / 580) * 30, 0, 29.99); const j = Math.floor(i); return lerp(pts[j][1], pts[j + 1][1], i - j); };
      paintForest(P, ry, -250, 250, { dens: 0.05 + k * 0.03, size: 70, depth: 40, from: 6, col: '#100d1a', col2: '#181428', snow: '#7c7094', ink: '#05040a' });
      A.foreB.push({ c: gpu(P.c), x: -300, y: -460, w: 600, h: 520 });
    }
  }
  function beaconFire(g, i, t, k) {
    const b = BEACONS[i], p = A.beaconPts[i];
    const age = b.tau < 0 ? 99 : t - b.tau;
    if (age < 0) return 0;
    const grow = b.tau < 0 ? 1 : EZ.o(clamp(age / 0.8, 0, 1));
    const flash = b.tau < 0 ? 0 : Math.exp(-age * 1.2);
    const fl = 0.85 + 0.15 * Math.sin(t * 11 + i) * Math.sin(t * 4.3 + i * 2);
    const sc = k || 1;
    // the fire lights the snow of its summit, and the air around it
    glow(g, p[0], p[1] + 40 * sc, 260 * sc * (0.6 + 0.4 * grow), [255, 150, 80], 0.45 * grow, 'screen');
    glow(g, p[0], p[1] - 40 * sc, (200 + 380 * flash) * sc, [255, 130, 50], (0.55 + 0.6 * flash) * fl * grow);
    smoke(g, { x: p[0], y: p[1] - 120 * sc, w: 16 * sc }, t, { rate: 4, life: 8, up: 48 * sc, wind: -12 * sc, windA: -2.6 * sc, r0: 12 * sc, grow: 18 * sc, alpha: 0.5 * grow, t0: Math.max(0, b.tau), sd: 40 + i, warm: 0.9, warmFade: 0.35 });
    glow(g, p[0], p[1] - 30 * sc, 60 * sc, [255, 210, 130], 0.7 * fl * grow);
    fire(g, p[0], p[1] - 4 * sc, 52 * sc * grow, (150 + 130 * flash) * sc * grow * fl, t, 100 + i, { n: 5, lean: -0.1, inkW: 1 });
    sparks(g, { x: p[0], y: p[1] - 60 * sc, w: 30 * sc, h: 60 * sc }, t, { rate: 30, life: 2.4, t0: Math.max(0, b.tau), up: 120 * sc, spreadV: 70 * sc, wind: -18 * sc, size: 1.8 * sc, sd: 60 + i });
    if (flash > 0.05) sparks(g, { x: p[0], y: p[1] - 40 * sc, w: 40 * sc, h: 40 * sc }, t, { rate: 220, life: 1.6, t0: b.tau, t1: b.tau + 0.35, up: 260 * sc, spreadV: 260 * sc, size: 2 * sc, sd: 80 + i, grav: 1 });
    return grow;
  }
  function renderSweep(g, t) {
    const cam = camSweep(t);
    drawLayer(g, A.skyB, cam);
    drawLayer(g, A.farB, cam);
    drawLayer(g, A.midB, cam);
    drawLayer(g, A.mainB, cam);
    camT(g, cam, 0.5);
    for (let i = 0; i < BEACONS.length; i++) {
      const sx = W / 2 + (A.beaconPts[i][0] - cam.X * 0.5);
      if (sx < -300 || sx > W + 300) continue;
      const on = beaconFire(g, i, t);
      if (on > 0 && BEACONS[i].tau > 0) {
        const pr = clamp((t - BEACONS[i].tau - 0.35) / 1.2, 0, 1);
        if (pr > 0) { const lx = A.beaconPts[i][0], ly = A.beaconPts[i][1] - 215; letter(g, BEACONS[i].name, lx + 1.6, ly + 1.8, 17, pr, { col: '#1a1428', alpha: 0.45, center: true }); letter(g, BEACONS[i].name, lx, ly, 17, pr, { col: '#fbefd9', alpha: 0.97, center: true }); }
      }
    }
    flushLow(g, FXB); flushLow(g, GLB, 'screen');
    drawLayer(g, A.nearB, cam);
    // big dark crags sweeping past in the foreground
    camT(g, cam, 1.3);
    for (let i = 0; i < 9; i++) {
      const ti = 26.8 + i * 2.55, side = i % 2 ? 1 : -1;
      const fx = 1.3 * camSweepX(ti) + side * (350 + hr(i, 4) * 80);
      const sc = 1 + hr(i, 2) * 0.5;
      const sx = W / 2 + (fx - cam.X * 1.3);
      if (sx < -500 || sx > W + 500) continue;
      const spr = A.foreB[i % 3];
      g.save(); g.translate(fx, 700 - cam.Y * 0 ); if (side > 0) g.scale(-1, 1);
      drawSprite(g, spr, 0, 0, sc); g.restore();
    }
    flushLow(g, FXB);
    g.setTransform(S, 0, 0, S, 0, 0);
    // smoke from the crane-up drifting off the lens
    if (t < 27.4) smoke(g, { x: 540, y: 1500, w: 1000 }, t, { rate: 9, life: 3, up: 520, wind: -40, r0: 160, grow: 160, alpha: 0.55 * (1 - sstep(25.6, 27.4, t)), t0: 22.5, sd: 77, warm: 0.6, warmFade: 0.5 });
    flushLow(g, FXB);
    snowfall(g, t, cam, { wind: -60, layers: [{ n: 60, p: 0.5, size: 1.1, speed: 36, sway: 10, windK: 0.6, alpha: 0.6 }, { n: 16, p: 1.2, size: 2.4, speed: 80, sway: 18, windK: 1.2, alpha: 0.7 }] });
  }
  const SWEEP_STEPS = [buildSkyB, buildFarB, buildMidB, buildMainB, buildNearB, buildForeB];

  /* ================================================================== SHOT 6 — THE VISTA: the last fire at the edge of Rohan */
  function camVista(t) {
    const Z = track([[49.4, 1.12], [56.5, 1.0, 'o2'], [60, 0.985]], t);
    const Y = track([[49.4, 30], [60, 0]], t);
    const hd = hand(t, 2);
    return { X: hd[0] + track([[49.4, 30], [60, 0]], t), Y: Y + hd[1], Z, rot: hd[2] * 0.5 };
  }
  const VISTA_B = []; // screen-space positions of the chain of fires, far to near
  function buildSkyC() {
    const P = painter(-120, -120, 1320, 1100, R * 0.5), g = P.g;
    const y0 = -120, y1 = 980, f = (y) => (y - y0) / (y1 - y0);
    const gr = g.createLinearGradient(0, y0, 0, y1);
    gr.addColorStop(0, '#100f28'); gr.addColorStop(f(200), '#221e4a'); gr.addColorStop(f(420), '#4a3a6e'); gr.addColorStop(f(560), '#8a6484'); gr.addColorStop(f(640), '#c88a84'); gr.addColorStop(f(700), '#e8ae80'); gr.addColorStop(1, '#d69a78');
    g.fillStyle = gr; g.fillRect(-120, y0, 1320, 1100);
    let rg = g.createRadialGradient(1250, 660, 10, 1250, 660, 900);
    rg.addColorStop(0, 'rgba(255,200,130,0.8)'); rg.addColorStop(0.35, 'rgba(240,150,110,0.35)'); rg.addColorStop(1, 'rgba(200,110,120,0)');
    g.fillStyle = rg; g.fillRect(-120, y0, 1320, 1100);
    rg = g.createRadialGradient(-150, 450, 10, -150, 450, 700);
    rg.addColorStop(0, 'rgba(14,12,34,0.6)'); rg.addColorStop(1, 'rgba(14,12,34,0)');
    g.fillStyle = rg; g.fillRect(-120, y0, 1320, 1100);
    for (let i = 0; i < 12; i++) {
      const cx = lerp(-100, 1200, RNG()), cy = lerp(380, 610, Math.pow(RNG(), 0.7)), L = 160 + RNG() * 520, T = 4 + RNG() * 10;
      const poly = lens(cx, cy, L, T, RNG() * 40, 0.3), warm = sstep(100, 1100, cx);
      wash(P, poly, mixh('#3a3058', '#6a4660', warm), { alpha: 0.7, layers: 5, spread: 2.5, edge: 0.4, gran: 0.2 });
      const b = poly.slice(Math.floor(poly.length / 2) + 2, poly.length - 2);
      g.globalAlpha = 0.3 + 0.55 * warm; inkStroke(g, b, 2.2, { col: mixh('#c98aa0', '#ffc07a', warm), ti: 0.4, to: 0.4 }); g.globalAlpha = 1;
    }
    g.fillStyle = '#f6efe2';
    for (let i = 0; i < 230; i++) { const x = lerp(-120, 1200, RNG()), y = lerp(-120, 480, Math.pow(RNG(), 1.1)); star(g, x, y, 0.5 + Math.pow(RNG(), 4) * 1.6, (0.3 + RNG() * 0.6) * (1 - sstep(300, 1150, x) * 0.6)); }
    g.globalAlpha = 1;
    const mx = 170, my = 300;
    glow(g, mx, my, 150, [220, 214, 240], 0.22, 'source-over');
    g.fillStyle = '#f3ecdc'; g.beginPath(); g.arc(mx, my, 22, 0, TAU); g.fill();
    g.fillStyle = '#211d48'; g.beginPath(); g.arc(mx + 8, my - 5, 21, 0, TAU); g.fill();
    A.skyC = toLayer(P, 0.0, { abs: true });
  }
  function buildRangeC() {
    const P = painter(-160, 380, 1400, 560, R), g = P.g;
    const segs = [
      { x0: -160, x1: 360, base: 640, h: [24, 38, 30], pal: ['#8a78a6', '#e9c4c0', '#c49a90'], ink: 0.2 },
      { x0: 110, x1: 560, base: 650, h: [38, 58, 46], pal: ['#7c6ca0', '#efc6be', '#c49a90'], ink: 0.28 },
      { x0: 320, x1: 770, base: 668, h: [60, 88, 70], pal: ['#6c5e96', '#f2c8bc', '#c49a90'], ink: 0.38 },
      { x0: 530, x1: 990, base: 700, h: [110, 165, 120], pal: ['#5c5089', '#f4cbbd', '#c49a90'], ink: 0.5 },
      { x0: 740, x1: 1260, base: 752, h: [190, 290, 210], pal: ['#4e4680', '#f6ccbc', '#c49a90'], ink: 0.65 },
    ];
    const beaconAt = [[0, 0.4], [1, 0.55], [2, 0.38], [2, 0.75], [3, 0.5], [4, 0.3]];
    const pts = [];
    for (let si = 0; si < segs.length; si++) {
      const s = segs[si], w = s.x1 - s.x0;
      const pk = [];
      for (let k = 0; k < 6; k++) { const u = (k + 0.5) / 6 + (RNG() - 0.5) * 0.06; pk.push({ x: s.x0 + w * u, h: s.h[k % 3] * (0.75 + RNG() * 0.4), w: w * 0.16, s: 1.2 }); }
      for (const [bs, u] of beaconAt) if (bs === si) pk.push({ x: s.x0 + w * u, h: s.h[1] * 1.15, w: w * 0.18, s: 1.2 });
      const rg = paintRange(P, { x0: s.x0, x1: s.x1, base: s.base, peaks: pk, floor: s.h[0] * 0.3, amp: 6 + si * 3, freq: 0.05 - si * 0.006, shade: s.pal[0], shadeTop: s.pal[0], lit: s.pal[1], litLow: s.pal[2], haze: s.pal[2], hmax: s.h[1] * 1.2,
        inkA: s.ink, inkW: 0.8 + si * 0.25, hatchA: si > 2 ? 0.15 : 0, hatchGap: 3.5, hatchLen: 8, detail: 0.3 + si * 0.15, hazeFrom: 0.45, hazeA: 1, below: Math.max(4, 760 - s.base), hiA: 0.8, hiW: 1.4 + si * 0.5, lean: 0.6 });
      for (const [bs, u] of beaconAt) if (bs === si) {
        const cx = s.x0 + w * u; let bx = cx, by = 1e9;
        for (let x = cx - w * 0.05; x <= cx + w * 0.05; x += 1) { const y = rg.ry(x); if (y < by) { by = y; bx = x; } }
        pts.push([bx, by, 0.25 + si * 0.15]);
      }
      mist(P, s.x0, s.x1, s.base - 4, s.pal[2], 6, { L: 160 + si * 40, T: 5 + si * 2, a: 0.55, dy: 10 });
    }
    A.vistaPts = pts;
    A.rangeC = toLayer(P, 0.12, { abs: true });
  }
  function buildPlainC() {
    const P = painter(-200, 700, 1500, 760, R), g = P.g;
    const top = 744;
    const poly = [[-200, top], [1300, top + 6], [1300, 1460], [-200, 1460]];
    wash(P, poly, (tg) => { const gr = tg.createLinearGradient(0, top, 0, 1460); gr.addColorStop(0, '#c49a90'); gr.addColorStop(0.25, '#9c7c84'); gr.addColorStop(0.6, '#6e5a72'); gr.addColorStop(1, '#4a3e5c'); return gr; }, { mode: 'source-over', layers: 4, spread: 2, gran: 0.3, bloom: 0.04, edge: 0 });
    // bands of land, thinner towards the horizon
    for (let i = 0; i < 46; i++) {
      const f = Math.pow(RNG(), 1.7), y = top + 6 + f * 640, T = 2 + f * 22, L = 140 + RNG() * 600 * (0.4 + f);
      const col = RNG() < 0.5 ? '#b38a6a' : RNG() < 0.6 ? '#5e5070' : '#c8a898';
      wash(P, lens(lerp(-200, 1300, RNG()), y, L, T, RNG() * 40, 0.8), col, { alpha: 0.2 + RNG() * 0.2, layers: 5, spread: 3 + f * 5, edge: 0.1, bloom: 0.3, mode: 'multiply' });
    }
    // snow lying in hollows
    for (let i = 0; i < 20; i++) { const f = Math.pow(RNG(), 1.4), y = top + 10 + f * 600; wash(P, lens(lerp(-200, 1300, RNG()), y, 60 + RNG() * 220 * (0.4 + f), 1.5 + f * 7, RNG() * 9, 0.6), '#d9c2c4', { alpha: 0.45, mode: 'source-over', layers: 3, spread: 1, edge: 0.2 }); }
    // strokes of grass and field-lines
    g.strokeStyle = INK; g.lineCap = 'round';
    for (let i = 0; i < 900; i++) { const f = Math.pow(RNG(), 1.3), y = top + 4 + f * 640, x = lerp(-200, 1300, RNG()), l = 3 + f * 30; g.globalAlpha = 0.12 + 0.3 * f; g.lineWidth = 0.5 + f; g.beginPath(); g.moveTo(x, y); g.lineTo(x + l, y + (RNG() - 0.5) * 1.5); g.stroke(); }
    g.globalAlpha = 1;
    // the near plain sinks into dusk; field lines in ink
    wash(P, poly, (tg) => { const gr = tg.createLinearGradient(0, top + 120, 0, 1400); gr.addColorStop(0, 'rgba(60,44,80,0)'); gr.addColorStop(0.5, 'rgba(60,44,80,0.55)'); gr.addColorStop(1, 'rgba(40,30,60,0.85)'); return gr; }, { layers: 3, spread: 6, edge: 0, bloom: 0.2, bscale: 2.5 });
    hatch(P, [[-200, top + 160], [1300, top + 160], [1300, 1460], [-200, 1460]], { ang: 0.04, gap: 7, len: 60, w: 0.9, col: INK, alpha: 0.28, density: (x, y) => sstep(top + 150, top + 500, y) * 0.7 });
    // the river, holding the last of the sky
    const riv = [];
    for (let i = 0; i <= 60; i++) { const u = i / 60; riv.push([lerp(-150, 760, u) + Math.sin(u * 14) * 90 * (1 - u * 0.6), top + 14 + Math.pow(1 - u, 1.8) * 560]); }
    const rpoly = riv.map((p, i) => [p[0], p[1] - (0.6 + (1 - i / 60) * 6)]).concat(riv.slice().reverse().map((p, i) => [p[0], p[1] + (0.6 + (i / 60) * 6)]));
    wash(P, rpoly, '#e9c09a', { mode: 'source-over', alpha: 0.6, layers: 4, spread: 0.8, edge: 0.5, edgeCol: '#6a4a5a' });
    g.fillStyle = INK; g.globalAlpha = 0.5; inkLine(g, riv.map((p, i) => [p[0], p[1] + 1 + (1 - i / 60) * 6]), 1.0, { gaps: 0.3, ti: 0.1, to: 0.1 }); g.globalAlpha = 1;
    // copses
    for (let i = 0; i < 18; i++) { const f = Math.pow(RNG(), 1.4), y = top + 10 + f * 520, x = lerp(-150, 1250, RNG()); paintForest(P, () => y, x - 20 - f * 60, x + 20 + f * 60, { dens: 0.5, size: 4 + f * 16, depth: 4 + f * 10, from: 0, col: '#2a2236', col2: '#3a2e44' }); }
    A.plainC = toLayer(P, 0.3, { abs: true });
  }
  function buildHillC() {
    const P = painter(560, 640, 700, 460, R), g = P.g;
    const ridge = [];
    for (let i = 0; i <= 60; i++) { const u = i / 60, x = lerp(560, 1260, u); ridge.push([x, 1000 - 190 * Math.pow(Math.sin(PI * clamp((x - 600) / 680, 0, 1)), 0.7) - 6 * n1(u * 9)]); }
    const poly = ridge.concat([[1260, 1000], [560, 1000]]);
    wash(P, poly, (tg) => { const gr = tg.createLinearGradient(0, 800, 0, 990); gr.addColorStop(0, 'rgba(74,62,94,1)'); gr.addColorStop(0.55, 'rgba(60,48,78,0.9)'); gr.addColorStop(1, 'rgba(60,48,78,0)'); return gr; }, { mode: 'source-over', layers: 4, spread: 1.4, gran: 0.4, edge: 0 });
    const ry = (x) => { const i = clamp(((x - 560) / 700) * 60, 0, 59.99), j = Math.floor(i); return lerp(ridge[j][1], ridge[j + 1][1], i - j); };
    paintForest(P, ry, 660, 1250, { dens: 1.3, size: 14, depth: 90, from: 2, pow: 1.8, col: '#1e1a2c', col2: '#2c2438', snow: '#cdb6be', ink: '#0e0c18', grow: 0.004 });
    let bx = 900, by = 1e9; for (let x = 820; x < 980; x++) { const y = ry(x); if (y < by) { by = y; bx = x; } }
    A.halC = [bx, by - 4];
    g.fillStyle = '#1a1218'; g.fillRect(bx - 6, by - 12, 12, 10);
    g.fillStyle = INK; inkLine(g, ridge, 1.6, { gaps: 0.25, ti: 0.05, to: 0.05 });
    mist(P, 760, 1120, 955, '#8a7088', 8, { L: 220, T: 18, a: 0.6, dy: 24 });
    A.hillC = toLayer(P, 0.42, { abs: true });
  }
  function buildForeC() {
    const P = painter(-200, 1080, 1500, 400, R), g = P.g;
    const ridge = [];
    for (let i = 0; i <= 80; i++) { const u = i / 80, x = lerp(-200, 1300, u); ridge.push([x, 1295 - 120 * Math.pow(clamp(1 - u * 1.5, 0, 1), 1.2) + 14 * n1(u * 11) + 6 * n1(u * 40) + 40 * sstep(0.6, 1, u)]); }
    const poly = ridge.concat([[1300, 1480], [-200, 1480]]);
    wash(P, poly, '#15111f', { mode: 'source-over', layers: 4, spread: 1.4, gran: 0.4, edge: 0.4 });
    dryBrush(g, ridge.slice(2, 50).map((p) => [p[0], p[1] + 3]), 6, '#a99ab8', { n: 8, alpha: 0.5, broken: -0.2 });
    g.strokeStyle = '#0a0812'; g.lineCap = 'round';
    for (let i = 0; i < 320; i++) { const x = lerp(-200, 1300, RNG()); const y = ridge[Math.round(((x + 200) / 1500) * 80)][1] + 4; const a = -PI / 2 + 0.35 + (RNG() - 0.5) * 0.7, l = 8 + RNG() * 34; g.lineWidth = 0.8 + RNG(); g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a) * l * 0.4, y + Math.sin(a) * l * 0.6, x + Math.cos(a) * l + 6, y + Math.sin(a) * l); g.stroke(); }
    g.fillStyle = INK; inkLine(g, ridge, 2.4, { gaps: 0.2, ti: 0.02, to: 0.02 });
    A.foreV = toLayer(P, 0.75, { abs: true });
  }
  function renderVista(g, t) {
    const cam = camVista(t);
    drawLayer(g, A.skyC, cam);
    drawLayer(g, A.rangeC, cam);
    camT(g, cam, 0.12, true);
    const pts = A.vistaPts;
    for (let i = 0; i < pts.length; i++) {
      const [x, y, k] = pts[i], fl = 0.8 + 0.2 * Math.sin(t * 9 + i * 3);
      glow(g, x, y - 2, 26 * k + 10, [255, 140, 60], 0.75 * fl);
      fire(g, x, y + 0.5, 5 * k, 14 * k * fl, t, 200 + i, { n: 2, ink: false });
      smoke(g, { x, y: y - 10 * k, w: 2 }, t, { rate: 1.5, life: 8, up: 7 * k, wind: -3 * k, windA: -0.6 * k, r0: 3 * k, grow: 4 * k, alpha: 0.35, sd: 300 + i });
    }
    drawLayer(g, A.plainC, cam);
    drawLayer(g, A.hillC, cam);
    camT(g, cam, 0.42, true);
    const hp = A.halC, fl = 0.85 + 0.15 * Math.sin(t * 11) * Math.sin(t * 3.1);
    glow(g, hp[0], hp[1] - 4, 70, [255, 140, 60], 0.8 * fl);
    glow(g, hp[0], hp[1] + 30, 160, [255, 150, 90], 0.25, 'soft-light');
    smoke(g, { x: hp[0], y: hp[1] - 22, w: 4 }, t, { rate: 2.2, life: 8, up: 18, wind: -6, windA: -1.2, r0: 5, grow: 8, alpha: 0.45, sd: 333, warm: 0.7, warmFade: 0.4 });
    fire(g, hp[0], hp[1], 11, 30 * fl, t, 333, { n: 3, lean: -0.1, inkW: 0.6 });
    sparks(g, { x: hp[0], y: hp[1] - 16, w: 8, h: 10 }, t, { rate: 10, life: 1.8, up: 40, spreadV: 24, wind: -8, size: 1.1, sd: 334 });
    flushLow(g, FXB); flushLow(g, GLB, 'screen');
    drawLayer(g, A.foreV, cam);
    g.setTransform(S, 0, 0, S, 0, 0);
    snowfall(g, t, cam, { wind: -30, layers: [{ n: 40, p: 0.3, size: 1.0, speed: 24, sway: 8, windK: 0.5, alpha: 0.5 }] });
    // the title, written in a broad nib
    const pr = clamp((t - 52.6) / 3.4, 0, 1);
    if (pr > 0) { g.setTransform(S, 0, 0, S, 0, 0); letter(g, 'The Beacons', 540, 236, 31, pr, { col: '#f8ecd6', alpha: 0.96, center: true, glow: true }); }
  }
  const VISTA_STEPS = [buildSkyC, buildRangeC, buildPlainC, buildHillC, buildForeC];
  /* ================================================================== hand lettering: a broad-nib italic, written on stroke by stroke */
  const GLY = {
    T: [9.5, [[[0, -14], [3, -14.6], [6, -14.8], [9.6, -15.5]], [[5, -14.8], [4.6, -8], [4.3, -2], [4.6, 0], [6.5, -0.6]]]],
    h: [7.6, [[[1.8, -16.6], [1.3, -8], [0.8, 0]], [[1.0, -5.5], [2.6, -9.2], [4.8, -10], [6.2, -8.4], [6, -3], [6.3, -0.2], [7.8, -1]]]],
    e: [6.6, [[[1.2, -4.2], [4.2, -5.4], [5.6, -7.8], [4.4, -10], [2, -9.2], [0.6, -5.5], [1, -1.5], [3.2, 0.1], [6, -1.6]]]],
    B: [9, [[[1.8, -15], [1.6, -8], [1.3, 0]], [[0.2, -14.6], [4, -15.4], [7.2, -14.2], [7.4, -11], [5, -8.3], [1.8, -7.9]], [[2, -8], [6.4, -7.6], [8.4, -4.2], [6.8, -0.8], [3, 0], [0, -0.4]]]],
    a: [7.6, [[[5.8, -8.6], [4, -10], [1.8, -9.2], [0.4, -5], [1, -1], [2.8, 0], [5, -2.6], [6.2, -9.8]], [[6.4, -10.2], [5.8, -4], [6, -0.4], [7.6, -1.2]]]],
    c: [6.4, [[[5.8, -8.4], [4.2, -10], [2, -9.3], [0.5, -5.2], [1, -1.2], [3.2, 0.1], [5.9, -1.8]]]],
    o: [7, [[[4, -10], [1.8, -9.2], [0.5, -5.2], [1.2, -1], [3.2, 0.1], [5.4, -1.2], [6.3, -5], [5.6, -8.8], [3.6, -10], [2.4, -9.4]]]],
    n: [7.6, [[[1, -10], [0.8, -5], [0.6, 0]], [[0.9, -5.8], [2.6, -9.2], [4.8, -10], [6.2, -8.4], [6, -3], [6.3, -0.2], [7.8, -1]]]],
    s: [6, [[[5.4, -9], [4, -10.2], [1.8, -9.8], [1.2, -7.6], [2.6, -5.6], [4.6, -4.4], [5.2, -2], [3.8, -0.1], [1.4, -0.1], [0, -1.4]]]],
    m: [11.2, [[[1, -10], [0.8, -5], [0.7, 0]], [[0.9, -5.8], [2.4, -9.4], [4, -10], [5.3, -8.6], [5.2, 0]], [[5.3, -6], [6.8, -9.4], [8.6, -10], [9.9, -8.4], [9.7, -3], [10, -0.2], [11.4, -1]]]],
    i: [4, [[[1.2, -10], [0.9, -3], [1.2, -0.1], [2.8, -1]], [[1.9, -14.6], [1.6, -13.6], [1.3, -12.7]]]],
    'î': [4.2, [[[1.2, -10], [0.9, -3], [1.2, -0.1], [2.8, -1]], [[-0.4, -11.8], [1.4, -14.2], [3.2, -11.8]]]],
    l: [4, [[[2, -16.5], [1.2, -8], [1, -1.5], [1.8, 0.1], [3.4, -1]]]],
    r: [6, [[[1, -10], [0.8, -5], [0.6, 0]], [[0.9, -6.4], [2.6, -9.4], [4.6, -10], [6, -9.2]]]],
    d: [7.8, [[[5.8, -8.6], [4, -10], [1.8, -9.2], [0.4, -5], [1, -1], [2.8, 0], [5, -2.6], [6.2, -9.8]], [[7.2, -16.6], [6.2, -6], [6, -0.4], [7.6, -1.2]]]],
    f: [5.2, [[[6.2, -15.4], [5, -16.6], [3.4, -16], [2.6, -12], [2, -4], [1.4, 3], [0, 5]], [[0.4, -9.8], [5, -10]]]],
    A: [9.8, [[[0, 0], [2.4, -6], [5.6, -15.4]], [[5.6, -15.4], [7, -8], [8.2, -1.4], [9.6, -0.6]], [[2.2, -5.2], [7.4, -5.6]]]],
    D: [9.8, [[[1.8, -14.8], [1.4, 0]], [[0, -14.8], [5, -15.2], [8.6, -12], [8.8, -5.5], [5.6, -0.8], [0, 0]]]],
    E: [8.4, [[[1.6, -14.8], [1.3, 0]], [[0.4, -14.8], [7.6, -15.3]], [[1.6, -7.8], [6, -8.1]], [[0.2, 0], [8, -0.4]]]],
    N: [10.4, [[[1.2, 0.2], [1.6, -15.2]], [[1.6, -15.2], [5, -7.5], [8.6, 0]], [[8.6, 0.2], [9.2, -15.2]]]],
    M: [12.6, [[[0.8, 0], [1.8, -15.2]], [[1.8, -15.2], [6, -2]], [[6, -2], [10.2, -15.2]], [[10.2, -15.2], [10.6, -7], [11, 0], [12.4, -0.8]]]],
    R: [9.4, [[[1.8, -15], [1.4, 0]], [[0, -14.8], [4.6, -15.4], [7.4, -13.8], [7, -10.4], [4, -8.2], [1.8, -8]], [[3.6, -8.2], [6, -4], [8, -0.6], [9.4, -1]]]],
    C: [9, [[[8.4, -12.4], [7, -14.8], [4, -15.2], [1.4, -12], [0.4, -7], [1.6, -2], [4.6, 0.1], [8.4, -2]]]],
    H: [10.2, [[[1.6, -15], [1.2, 0]], [[8.8, -15], [8.4, 0]], [[1.4, -7.8], [8.6, -8]]]],
    '-': [5, [[[0.8, -5], [4, -5.3]]]],
    ' ': [4, []],
  };
  const GCACHE = {};
  function glyphStrokes(ch) {
    if (GCACHE[ch]) return GCACHE[ch];
    const gl = GLY[ch] || GLY[' '];
    const strokes = gl[1].map((s) => (s.length > 2 ? catmull(s, 6, false) : resample(s, 0.6, false)));
    return (GCACHE[ch] = { w: gl[0], strokes });
  }
  function letter(g, text, x, y, size, progress, o) {
    o = o || {};
    const sc = size / 5, slant = 0.2, track = 0.6;
    let tw = 0; for (const ch of text) tw += glyphStrokes(ch).w + track;
    tw -= track;
    let ox = o.center ? x - (tw * sc) / 2 : x;
    // gather strokes in writing order with lengths
    const all = []; let total = 0;
    let cx = 0;
    for (const ch of text) {
      const gs = glyphStrokes(ch);
      for (const s of gs.strokes) {
        const pts = s.map((p) => [ox + (cx + p[0] - p[1] * slant) * sc, y + p[1] * sc]);
        let L = 0; for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
        all.push([pts, L]); total += L;
      }
      cx += gs.w + track;
    }
    const nib = (o.nib || 1.9) * sc, na = -0.72, nx = Math.cos(na) * nib / 2, ny = Math.sin(na) * nib / 2;
    let budget = progress * total;
    g.save();
    g.fillStyle = o.col || '#f4ead8';
    g.globalAlpha = o.alpha === undefined ? 1 : o.alpha;
    for (const [pts, L] of all) {
      if (budget <= 0) break;
      let acc = 0;
      g.beginPath();
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1], b = pts[i];
        const d = Math.hypot(b[0] - a[0], b[1] - a[1]);
        let bb = b;
        if (acc + d > budget) { const u = (budget - acc) / d; bb = [lerp(a[0], b[0], u), lerp(a[1], b[1], u)]; }
        const u0 = acc / L, k = 0.72 + 0.28 * Math.sin(Math.min(1, u0) * PI);
        g.moveTo(a[0] - nx * k, a[1] - ny * k); g.lineTo(a[0] + nx * k, a[1] + ny * k); g.lineTo(bb[0] + nx * k, bb[1] + ny * k); g.lineTo(bb[0] - nx * k, bb[1] - ny * k); g.closePath();
        acc += d;
        if (acc >= budget) break;
      }
      g.fill('nonzero');
      // round the pen-lift with a tiny dot
      budget -= L;
    }
    g.restore();
  }
  /* ================================================================== the whole film: drawFrame(t) */
  function clearFrame(g, col) { g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; g.fillStyle = col || '#0d0c14'; g.fillRect(0, 0, FR.c.width, FR.c.height); }
  function blendIn(g, src, a) { g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = a; g.drawImage(src.c, 0, 0); g.restore(); }
  function post(g, t) {
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
    // paper grain, fibres and the vignette, baked once into a single multiply pass
    if (!post.sheet || post.sheet.width !== FR.c.width || post.sheet.height !== FR.c.height) {
      const c = mk(FR.c.width, FR.c.height), q = ctx2(c);
      const pp = q.createPattern(TEX.paper, 'repeat'); pp.setTransform(new DOMMatrix().scale(Math.max(0.6, S / 1.4)));
      q.fillStyle = pp; q.fillRect(0, 0, c.width, c.height);
      q.globalCompositeOperation = 'multiply'; q.drawImage(VIG, 0, 0, c.width, c.height);
      post.sheet = c;
    }
    g.globalCompositeOperation = 'multiply';
    g.drawImage(post.sheet, 0, 0);
    g.restore();
  }
  let VIG = null;
  function buildVignette() {
    const c = mk(270, 338), g = c.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, 270, 338);
    const gr = g.createRadialGradient(135, 160, 60, 135, 169, 230);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.6, 'rgba(235,228,232,1)'); gr.addColorStop(1, 'rgba(120,110,130,1)');
    g.fillStyle = gr; g.fillRect(0, 0, 270, 338);
    VIG = c;
  }
  function drawFrame(t) {
    t = clamp(t, 0, DUR);
    const g = FR.g;
    g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    GLB.on = true; FXB.on = true;
    if (t < 3.2) {
      renderEye(g, t);
      if (t > 2.6) {
        B2.g.setTransform(1, 0, 0, 1, 0, 0); renderSummit(B2.g, t);
        blendIn(g, B2, EZ.s(clamp((t - 2.6) / 0.6, 0, 1)));
      }
    } else if (t < 24.6) {
      renderSummit(g, t);
    } else if (t < 25.8) {
      renderSummit(g, t);
      B2.g.setTransform(1, 0, 0, 1, 0, 0); renderSweep(B2.g, t);
      blendIn(g, B2, EZ.s(clamp((t - 24.6) / 1.2, 0, 1)));
    } else if (t < 49.4) {
      renderSweep(g, t);
    } else if (t < 50.8) {
      renderSweep(g, t);
      B2.g.setTransform(1, 0, 0, 1, 0, 0); renderVista(B2.g, t);
      blendIn(g, B2, EZ.s(clamp((t - 49.4) / 1.4, 0, 1)));
    } else {
      renderVista(g, t);
    }
    post(g, t);
  }
  /* ================================================================== building, playing, exporting */
  function frameCanvases(pw, ph) {
    const mkF = () => { const c = mk(pw, ph); return { c, g: c.getContext('2d') }; };
    FR = FR && FR.c.width === pw && FR.c.height === ph ? FR : null;
    return mkF;
  }
  const BUILD_STEPS = [
    () => { initNoise(SEED); RNG = mulberry32(SEED * 31 + 5); makeTextures(RNG); buildVignette(); buildFlake(); buildCloth(); buildSmoke(); },
    buildEye,
    buildSkyA, buildFarA, buildMidA, buildNearA, buildGround, buildLipFore, buildPyre,
    () => { const p = keeperPose(17.9), r = keeperRoot(17.9), F = fk(p), tip = add(F.HN, up(p.ba), 58); STUCK = { h: [r.x + F.HN[0], gY(r.x) + F.HN[1]], tip: [r.x + tip[0], gY(r.x) + tip[1]] }; },
  ].concat(SWEEP_STEPS).concat(VISTA_STEPS);
  const STEP_EYE = 2, STEP_SUMMIT = 10, STEP_SWEEP = 10 + SWEEP_STEPS.length, STEP_ALL = BUILD_STEPS.length;
  function needSteps(t) { return STEP_ALL; }

  (window.PIECES = window.PIECES || []).push({
    id: 'beacons',
    title: 'The Beacons',
    medium: 'Ink, watercolour and gouache, animated · 60 s',
    note: 'Click or tap to pause',
    about: 'An old keeper on a snowbound peak sees a far fire flare in the east, and runs with a brand to light his own; then the fire leaps west from summit to summit to the edge of Rohan. An original interpretation of Tolkien’s text in The Return of the King, not of any film: every frame is painted in code as it plays, in ink, washes and white gouache.',
    tone: 'dark',
    room: '#0b0a10',
    mount(el, api) {
      const EXPORT = /[?&]export\b/.test(location.search);
      ALLCPU = EXPORT && !/[?&]gpu\b/.test(location.search);
      SEED = (api.seed >>> 0) % 100000 || 7;
      let alive = true, raf = 0, built = 0, building = false, playing = !EXPORT, clock = 0, last = 0, readyCalled = false;
      el.style.background = '#0b0a10';
      const cv = document.createElement('canvas');
      cv.style.cssText = 'position:absolute;display:block;cursor:pointer;';
      el.appendChild(cv);
      const pauseMark = document.createElement('div');
      pauseMark.style.cssText = 'position:absolute;width:34px;height:34px;opacity:0;transition:opacity .5s;pointer-events:none;';
      pauseMark.innerHTML = '<svg viewBox="0 0 34 34" width="34" height="34"><rect x="10" y="9" width="4" height="16" rx="1.5" fill="rgba(240,232,220,.75)"/><rect x="20" y="9" width="4" height="16" rx="1.5" fill="rgba(240,232,220,.75)"/></svg>';
      el.appendChild(pauseMark);
      let cssW = 0, cssH = 0;
      function layout() {
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        let left = 0, top = 0;
        if (EXPORT) { cssW = 1080; cssH = 1350; cv.style.position = 'fixed'; }
        else {
          const w = el.clientWidth || window.innerWidth, h = el.clientHeight || window.innerHeight;
          cssW = Math.min(w, h * 0.8); cssH = cssW * 1.25;
          left = (w - cssW) / 2; top = (h - cssH) / 2;
        }
        cv.style.left = left + 'px'; cv.style.top = top + 'px'; cv.style.width = cssW + 'px'; cv.style.height = cssH + 'px';
        pauseMark.style.left = (left + cssW - 50) + 'px'; pauseMark.style.top = (top + 16) + 'px';
        const pw = Math.round(cssW * dpr), ph = Math.round(cssH * dpr);
        if (cv.width !== pw || cv.height !== ph) {
          cv.width = pw; cv.height = ph;
          S = pw / W;
          FR = { c: cv, g: ctx2(cv) };
          const mkF = () => { const c = mk(pw, ph); return { c, g: ctx2(c) }; };
          B2 = mkF(); LT = mkF(); MK = mkF(); CH = mkF(); RM = mkF();
          const mkL = (k) => { const c = mk(Math.ceil(pw * k), Math.ceil(ph * k)); return { c, g: ctx2(c), k, bb: [1e9, 1e9, -1e9, -1e9], dirty: false, on: false }; };
          GLB = mkL(0.25); FXB = mkL(0.5);
          post.sheet = null;
        }
      }
      layout();
      R = clamp(S, 0.5, 2);
      async function build() {
        building = true;
        for (let i = built; i < BUILD_STEPS.length; i++) {
          if (!alive) return;
          const _t = performance.now(); BUILD_STEPS[i](); if (EXPORT) console.log('[b] step ' + i + ' ' + Math.round(performance.now() - _t) + 'ms');
          built = i + 1;
          if (!readyCalled && built >= STEP_EYE && !EXPORT) { readyCalled = true; drawFrame(0); api.ready(); }
          await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
        }
        building = false;
        if (EXPORT) { document.documentElement.dataset.ready = 'beacons'; api.ready(); }
      }
      let allDone = null;
      const whenAll = new Promise((res) => { allDone = res; });
      build().then(() => { if (built >= BUILD_STEPS.length) allDone(); });
      if (EXPORT) {
        // keep the room's force-reveal from announcing readiness before the paint is dry
        const mo = new MutationObserver(() => { if (built < BUILD_STEPS.length && document.documentElement.dataset.ready) delete document.documentElement.dataset.ready; });
        mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-ready'] });
        window.__beacons = {
          duration: DUR,
          isReady: () => built >= BUILD_STEPS.length,
          ready: whenAll,
          renderAt(t, dbg) { return whenAll.then(() => { DBG = dbg || null; drawFrame(t); DBG = null; return new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); }); },
          drawFrame: (t) => drawFrame(t),
          dump: (k, i) => { const a = A[k]; const c = a.tiles ? a.tiles[i || 0].c : a.c; return c.toDataURL(); },
        };
      } else {
        window.__beacons = { duration: DUR, isReady: () => built >= BUILD_STEPS.length, ready: whenAll, renderAt(t) { return whenAll.then(() => { playing = false; clock = t; drawFrame(t); }); } };
      }
      function frame(now) {
        if (!alive || !api.isCurrent()) return;
        raf = requestAnimationFrame(frame);
        const dt = last ? Math.min(0.1, (now - last) / 1000) : 0; last = now;
        if (!playing || EXPORT) return;
        if (built < needSteps(clock + dt)) { if (built >= STEP_EYE) drawFrame(Math.min(clock, DUR)); return; }
        clock += dt;
        if (clock > DUR + HOLD) clock = 0;
        drawFrame(Math.min(clock, DUR));
        if (clock > DUR + HOLD - 1.0) { const k = (clock - (DUR + HOLD - 1.0)) / 1.0; FR.g.setTransform(1, 0, 0, 1, 0, 0); FR.g.fillStyle = 'rgba(11,10,16,' + clamp(k, 0, 1) + ')'; FR.g.fillRect(0, 0, FR.c.width, FR.c.height); }
      }
      if (!EXPORT) raf = requestAnimationFrame(frame);
      const onDown = (e) => {
        if (EXPORT) return;
        playing = !playing; last = 0;
        pauseMark.style.opacity = playing ? '0' : '1';
      };
      cv.addEventListener('pointerdown', onDown);
      let rt = 0;
      const ro = new ResizeObserver(() => {
        clearTimeout(rt);
        rt = setTimeout(() => {
          if (!alive) return;
          layout();
          if (built >= STEP_EYE) drawFrame(Math.min(clock, DUR));
        }, 150);
      });
      ro.observe(el);
      return {
        destroy() {
          alive = false; cancelAnimationFrame(raf); ro.disconnect(); cv.removeEventListener('pointerdown', onDown);
          if (window.__beacons) delete window.__beacons;
        },
      };
    },
  });
})();
