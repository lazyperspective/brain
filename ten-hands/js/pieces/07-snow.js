/* 07 — Night Snow at Hōrai Crossing
 *
 * A shin-hanga print pulled at runtime. The picture is cut as a set of "blocks"
 * (alpha plates drawn with Canvas 2D: far to near, each object first clearing the
 * wood behind it on every block, then inking its own). Each block is then printed
 * onto simulated washi: water pigment with baren mottle (goma-zuri), wood grain,
 * pooling at block edges, hand-wiped bokashi, and a misregistration that is
 * different for every impression. Light comes only from paper left bare.
 */
(function () {
  'use strict';

  const TAU = Math.PI * 2;
  // the block (image) area, and the sheet of paper around it, in print units
  const IW = 1000, IH = 1500, ML = 62, MR = 62, MT = 62, MB = 150;
  const SW = IW + ML + MR, SH = IH + MT + MB;
  const ROOM = '#1b1917';

  /* ------------------------------------------------------------------ random */
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hashStr(seed, s) {
    let h = (seed ^ 0x9e3779b9) >>> 0;
    for (let i = 0; i < s.length; i++) {
      h = Math.imul(h ^ s.charCodeAt(i), 0x85ebca6b);
      h ^= h >>> 13;
    }
    h = Math.imul(h ^ (h >>> 16), 0xc2b2ae35);
    return (h ^ (h >>> 15)) >>> 0;
  }
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

  /* ---------------------------------------------------------------- geometry */
  // Catmull–Rom through points ([x, y, ...extra]) sampled roughly every `step` units
  function crPts(pts, closed, step) {
    step = step || 1.6;
    const n = pts.length, out = [];
    if (n < 3 && !closed) return pts.map((p) => p.slice());
    const dim = pts[0].length;
    const P = (i) => (closed ? pts[((i % n) + n) % n] : pts[i < 0 ? 0 : i > n - 1 ? n - 1 : i]);
    const segs = closed ? n : n - 1;
    for (let i = 0; i < segs; i++) {
      const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
      const m = Math.max(1, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / step));
      for (let j = 0; j < m; j++) {
        const t = j / m, t2 = t * t, t3 = t2 * t;
        const q = new Array(dim);
        for (let d = 0; d < dim; d++) {
          q[d] = 0.5 * (2 * p1[d] + (p2[d] - p0[d]) * t + (2 * p0[d] - 5 * p1[d] + 4 * p2[d] - p3[d]) * t2 +
            (3 * p1[d] - p0[d] - 3 * p2[d] + p3[d]) * t3);
        }
        out.push(q);
      }
    }
    if (!closed) out.push(pts[n - 1].slice());
    return out;
  }
  function poly(pts, closed, path) {
    path = path || new Path2D();
    if (!pts.length) return path;
    path.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) path.lineTo(pts[i][0], pts[i][1]);
    if (closed !== false) path.closePath();
    return path;
  }
  const smooth = (pts, path, step) => poly(crPts(pts, true, step), true, path);
  // closed outline, smooth except at the listed corner indices
  function shape(pts, corners, path) {
    if (!corners || !corners.length) return smooth(pts, path);
    const n = pts.length, cs = corners.slice().sort((a, b) => a - b), out = [];
    for (let c = 0; c < cs.length; c++) {
      const a = cs[c], b = cs[(c + 1) % cs.length];
      const cnt = ((b - a + n) % n) || n;
      const run = [];
      for (let j = 0; j <= cnt; j++) run.push(pts[(a + j) % n]);
      const seg = run.length > 2 ? crPts(run, false) : run.map((p) => p.slice());
      seg.pop();
      for (const q of seg) out.push(q);
    }
    return poly(out, true, path);
  }
  function rect(x, y, w, h, path) { path = path || new Path2D(); path.rect(x, y, w, h); return path; }
  function ell(cx, cy, rx, ry, rot, path) {
    path = path || new Path2D();
    path.moveTo(cx + Math.cos(rot || 0) * rx, cy + Math.sin(rot || 0) * rx);
    path.ellipse(cx, cy, rx, ry, rot || 0, 0, TAU);
    path.closePath();
    return path;
  }
  function blobPts(r, cx, cy, rx, ry, n, jit, rot) {
    const pts = [], ph = r() * TAU, c = Math.cos(rot || 0), s = Math.sin(rot || 0);
    for (let i = 0; i < n; i++) {
      const a = ph + (i / n) * TAU, k = 1 + (r() - 0.5) * 2 * jit;
      const x = Math.cos(a) * rx * k, y = Math.sin(a) * ry * k;
      pts.push([cx + x * c - y * s, cy + x * s + y * c]);
    }
    return pts;
  }
  const blob = (r, cx, cy, rx, ry, n, jit, rot, path) => smooth(blobPts(r, cx, cy, rx, ry, n, jit, rot), path);
  const tr = (pts, dx, dy, sx) => pts.map((p) => [dx + p[0] * (sx || 1), dy + p[1] * (sx || 1)].concat(p.slice(2)));

  function resample(src, step) {
    const n = src.length, cum = [0];
    for (let i = 1; i < n; i++) cum.push(cum[i - 1] + Math.hypot(src[i][0] - src[i - 1][0], src[i][1] - src[i - 1][1]));
    const len = cum[n - 1], out = [];
    if (len <= 0) return { pts: [src[0]], len: 0 };
    let j = 1;
    for (let s = 0; s <= len + 1e-6; s += step) {
      while (j < n - 1 && cum[j] < s) j++;
      const a = src[j - 1], b = src[j], seg = cum[j] - cum[j - 1] || 1, t = clamp((s - cum[j - 1]) / seg, 0, 1);
      out.push(a.map((v, d) => v + ((b[d] === undefined ? v : b[d]) - v) * t));
    }
    if (len - (out.length - 1) * step > step * 0.3) out.push(src[n - 1].slice());
    return { pts: out, len };
  }

  // A carved line: a filled outline that swells and tapers like a knife-cut ridge,
  // with occasional chips on one flank and (optionally) small breaks.
  function carve(r, pts, w, o, path) {
    o = o || {};
    path = path || new Path2D();
    const src = o.raw ? pts : crPts(pts, false, 2);
    const step = o.step || 0.9;
    const rs = resample(src, step), P = rs.pts, len = rs.len, N = P.length;
    if (N < 2) return path;
    const ts = Math.min(o.ts == null ? 5 : o.ts, len * 0.45), te = Math.min(o.te == null ? 5 : o.te, len * 0.45);
    const tmin = o.tmin == null ? 0.2 : o.tmin, sw = o.sw == null ? 0.2 : o.sw;
    const f1 = TAU / (25 + r() * 30), f2 = TAU / (7 + r() * 8), p1 = r() * TAU, p2 = r() * TAU;
    const chip = o.chip == null ? 0.025 : o.chip, brk = o.brk || 0;
    let Lp = [], Rp = [];
    const flush = () => { if (Lp.length > 1) { Rp.reverse(); poly(Lp.concat(Rp), true, path); } Lp = []; Rp = []; };
    for (let i = 0; i < N; i++) {
      const s = i * step;
      if (brk && i > 2 && i < N - 3 && r() < brk) { flush(); i += 1 + ((r() * 3) | 0); continue; }
      const a = P[Math.max(0, i - 1)], b = P[Math.min(N - 1, i + 1)];
      let tx = b[0] - a[0], ty = b[1] - a[1];
      const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
      const nx = -ty, ny = tx;
      let wv = o.abs ? P[i][2] : w * (P[i].length > 2 ? P[i][2] : 1);
      let tp = 1;
      if (ts > 0 && s < ts) tp = Math.min(tp, tmin + (1 - tmin) * Math.sqrt(s / ts));
      if (te > 0 && len - s < te) tp = Math.min(tp, tmin + (1 - tmin) * Math.sqrt(Math.max(0, len - s) / te));
      wv *= tp * (1 + sw * (0.6 * Math.sin(f1 * s + p1) + 0.4 * Math.sin(f2 * s + p2)));
      if (o.min) wv = Math.max(wv, o.min);
      let wl = wv / 2, wr = wv / 2;
      if (r() < chip) { if (r() < 0.5) wl *= 0.2 + r() * 0.4; else wr *= 0.2 + r() * 0.4; }
      const ofs = o.off || 0;
      Lp.push([P[i][0] + nx * (wl + ofs), P[i][1] + ny * (wl + ofs)]);
      Rp.push([P[i][0] - nx * (wr - ofs), P[i][1] - ny * (wr - ofs)]);
    }
    flush();
    return path;
  }
  // quadratic sag between two points, sampled
  function sagPts(a, b, sag, n) {
    const out = [], cx = (a[0] + b[0]) / 2, cy = (a[1] + b[1]) / 2 + sag * 2;
    for (let i = 0; i <= n; i++) {
      const t = i / n, u = 1 - t;
      out.push([u * u * a[0] + 2 * u * t * cx + t * t * b[0], u * u * a[1] + 2 * u * t * cy + t * t * b[1]]);
    }
    return out;
  }

  /* ------------------------------------------------------------ calligraphy */
  // Strokes in a 100-unit box, authored against a reference hand.
  const GLYPHS = {
    '宝': [[[51, 11], [52, 25]], [[15, 26], [15, 43]], [[15, 29], [92, 28], [91, 43]], [[23, 47], [82, 47]],
      [[20, 69.5], [86, 69.5]], [[51, 47], [51, 94]], [[9, 94], [96, 94]], [[67, 75], [78, 87]]],
    '来': [[[16, 30], [90, 30]], [[26, 37], [37, 52]], [[80, 36], [68, 54]], [[10, 59], [96, 59]], [[51, 11], [51, 101]],
      [[50, 64], [33, 84], [10, 96]], [[52, 64], [72, 84], [97, 96]]],
    '辻': [[[38, 46], [93, 46]], [[65, 13], [65, 87]], [[16, 16], [30, 28]], [[14, 36], [30, 48]],
      [[9, 62], [30, 62], [30, 84], [10, 99]], [[30, 84], [42, 90], [70, 91], [98, 90]]],
    'の': [[[52, 24], [50, 42], [45, 62], [36, 80], [27, 89], [18, 78], [14, 57], [18, 39], [33, 27], [52, 23], [76, 26],
      [91, 39], [93, 61], [82, 78], [61, 89], [48, 90]]],
    '夜': [[[52, 11], [52, 23]], [[9, 27], [94, 27]], [[34, 33], [9, 74]], [[25, 52], [25, 101]], [[52, 44], [35, 73]],
      [[48, 44], [86, 44], [76, 64], [60, 82], [36, 99]], [[59, 54], [72, 63]], [[52, 72], [70, 86], [100, 99]]],
    '雪': [[[20, 18], [82, 18]], [[13.6, 29], [13.6, 44]], [[13.6, 29], [93, 29], [93, 44]], [[51, 18], [51, 45]],
      [[25, 38], [43, 38]], [[25, 51], [43, 51]], [[61, 38], [80, 38]], [[61, 51], [80, 51]],
      [[21, 64], [87, 64], [87, 99]], [[26, 78], [87, 78]], [[18, 98], [87, 98]]],
    '冬': [[[44, 13], [16, 46]], [[42, 23], [79, 23], [62, 42], [40, 58], [14, 70]], [[40, 34], [62, 50], [96, 66]],
      [[33, 67], [60, 78]], [[26, 82], [75, 99]]],
    '水': [[[52, 13], [52, 95], [43, 97]], [[22, 37], [50, 37], [9, 91]], [[88, 28], [58, 52]], [[56, 50], [76, 72], [99, 88]]],
  };
  function glyph(r, ch, x, y, size, w, o, path) {
    const st = GLYPHS[ch]; path = path || new Path2D();
    if (!st) return path;
    const j = o && o.jit != null ? o.jit : 1.2;
    for (const s of st) {
      const pts = s.map((p) => [x + (p[0] + (r() - 0.5) * j) * size / 100, y + (p[1] + (r() - 0.5) * j) * size / 100]);
      const L = pts.reduce((a, p, i) => (i ? a + Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) : 0), 0);
      if (L < w * 1.2) { blob(r, (pts[0][0] + pts[pts.length - 1][0]) / 2, (pts[0][1] + pts[pts.length - 1][1]) / 2, w * 0.7, w * 0.55, 6, 0.15, 0.6, path); continue; }
      carve(r, pts, w, { ts: w * 0.9, te: w * 1.6, tmin: 0.35, sw: 0.28, chip: 0.01, raw: s.length < 3, step: Math.max(0.3, w * 0.22) }, path);
    }
    return path;
  }
  // pencil numerals in a 10 x 16 box
  const DIGITS = {
    '0': [[5, 0], [1.6, 2], [0.6, 8], [1.6, 14], [5, 16], [8.4, 14], [9.4, 8], [8.4, 2], [5, 0]],
    '1': [[2.6, 3], [5.6, 0], [5.4, 16]],
    '2': [[1, 3.6], [3, 0.7], [6.5, 0.4], [8.8, 3], [8, 6.5], [1, 16], [9.6, 15.8]],
    '3': [[1, 2], [4, 0.3], [8, 1.5], [8.2, 5], [4.6, 7.5], [8.8, 9.6], [9, 13.4], [5, 16], [0.8, 14.5]],
    '4': [[7.2, 16], [7, 0], [0.5, 11], [10, 11]],
    '5': [[9, 0.3], [2.2, 0.4], [1.2, 7], [5, 6], [8.8, 8.5], [9, 13], [5.5, 16], [1, 14.6]],
    '6': [[8.5, 1], [5, 0], [1.8, 3.5], [0.8, 10], [2, 15], [5.5, 16], [8.8, 13.5], [8.5, 9], [5, 7.5], [1.5, 9.5]],
    '7': [[0.5, 0.3], [9.5, 0.4], [4, 16]],
    '8': [[5, 7.5], [1.6, 5], [1.8, 1.5], [5, 0], [8.2, 1.5], [8.5, 5], [5, 7.5], [1, 10.5], [1.5, 14.5], [5, 16], [8.8, 14.5], [9, 10.5], [5, 7.5]],
    '9': [[8.5, 6.5], [5, 8.5], [1.5, 6.5], [1.2, 2.5], [4.5, 0], [8, 1], [9, 5], [8.5, 11], [5.5, 16], [1.5, 15]],
    '/': [[0, 17], [7, -1]],
  };

  /* ------------------------------------------------------------------- inks */
  // goma: baren speckle; mott: baren blotch; grain: mokume; wipe: bokashi irregularity;
  // pool: pigment gathering inside block edges; fib: kozo fibres resisting ink; reg: misregistration
  const INKS = {
    yellow: { col: [244, 200, 108], goma: 0.15, mott: 0.08, grain: 0.04, wipe: 0.12, pool: 0.3, fib: 0.18, reg: 3.2, big: true },
    shadow: { col: [108, 136, 194], goma: 0.13, mott: 0.07, grain: 0.04, wipe: 0.1, pool: 0.24, fib: 0.18, reg: 1.2 },
    grey: { col: [122, 112, 134], goma: 0.11, mott: 0.06, grain: 0.04, wipe: 0.06, pool: 0.25, fib: 0.15, reg: 1.2 },
    brown: { col: [126, 82, 48], goma: 0.13, mott: 0.07, grain: 0.08, wipe: 0.07, pool: 0.32, fib: 0.15, reg: 1.2 },
    blue: { col: [36, 80, 150], goma: 0.11, mott: 0.06, grain: 0.06, wipe: 0.07, pool: 0.32, fib: 0.12, reg: 1.2 },
    red: { col: [204, 46, 34], goma: 0.12, mott: 0.06, grain: 0.04, wipe: 0.06, pool: 0.4, fib: 0.12, reg: 3.0, big: true },
    cedar: { col: [42, 64, 54], goma: 0.09, mott: 0.06, grain: 0.05, wipe: 0.06, pool: 0.26, fib: 0.12, reg: 1.2 },
    indigo: { col: [30, 40, 86], goma: 0.1, mott: 0.04, grain: 0.04, wipe: 0.05, pool: 0.22, fib: 0.12, reg: 1.2 },
    key: { col: [24, 30, 56], goma: 0.06, mott: 0.03, grain: 0, wipe: 0, pool: 0.12, fib: 0.06, reg: 0 },
    gofun: { col: [244, 247, 250], opaque: true, goma: 0.12, mott: 0.05, grain: 0, wipe: 0, pool: 0, fib: 0, reg: 2.0 },
    gofunw: { col: [252, 236, 196], opaque: true, goma: 0.12, mott: 0.05, grain: 0, wipe: 0, pool: 0, fib: 0, reg: 2.0 },
    seal: { col: [186, 44, 34], goma: 0.5, mott: 0.2, grain: 0, wipe: 0, pool: 0.35, fib: 0.2, reg: 0 },
    fleck: { col: [140, 108, 76], goma: 0, mott: 0, grain: 0, wipe: 0, pool: 0, fib: 0, reg: 0 },
    pencil: { col: [92, 92, 100], pencil: true, reg: 0 },
  };
  const ORDER = ['fleck', 'yellow', 'shadow', 'grey', 'brown', 'blue', 'red', 'cedar', 'indigo', 'key', 'gofun', 'gofunw', 'seal', 'pencil'];

  /* ------------------------------------------------------------------ scene */
  // A standing eye looks down the road; the horizon sits at y = H0.
  const H0 = 862;
  const um = (y) => 0.606 * (y - H0); // print units per metre on the ground at y
  const KZ = 1440; // y - H0 = KZ / z, z in metres
  const ROAD = crPts([[205, 866], [190, 885], [165, 930], [142, 990], [126, 1050], [122, 1102], [136, 1200], [162, 1300], [222, 1500], [234, 1560]], false, 2);
  function roadX(y) {
    if (y <= ROAD[0][1]) return ROAD[0][0];
    for (let i = 1; i < ROAD.length; i++) {
      if (ROAD[i][1] >= y) { const a = ROAD[i - 1], b = ROAD[i], t = (y - a[1]) / ((b[1] - a[1]) || 1); return a[0] + (b[0] - a[0]) * t; }
    }
    return ROAD[ROAD.length - 1][0];
  }
  const hwRoad = (y) => 0.758 * (y - H0);
  const MW = 124, MACH = [470, 597, 724], MTOP = 838, MBASE = 1078;
  const FIG = [352, 1102], FS = 1.6, CAT = [592, 1386], CS = 2.8, SIGN = [290, 1108];
  const LIGHT = [660, 1080];

  function buildScene(seed, k) {
    const ops = [];
    const R = (name) => mulberry32(hashStr(seed, name));
    const MIN = 0.8 / k;
    const kw = (w) => Math.max(w, MIN);
    const occ = (path, o) => { ops.push(Object.assign({ t: 'occ', path, a: 1 }, o || {})); };
    const ink = (p, path, a, s, o) => { ops.push(Object.assign({ p, path, a: a == null ? 1 : a, s }, o || {})); };
    const wipe = (p, path, a, s, o) => { ops.push(Object.assign({ p, path, a: a == null ? 1 : a, s, erase: true }, o || {})); };
    const inks = (list, path, o) => { for (const it of list) ink(it[0], path, it[1], it[2], o); };
    const LG = (x0, y0, x1, y1, stops) => ({ lin: [x0, y0, x1, y1], stops });
    const RG = (stops) => ({ rad: [0, 0, 0, 0, 0, 1], stops });
    const UNIT = rect(-1, -1, 2, 2);
    const ellM = (cx, cy, rx, ry, rot) => {
      const c = Math.cos(rot || 0), s = Math.sin(rot || 0);
      return [rx * c, rx * s, -ry * s, ry * c, cx, cy];
    };
    const key = (r, pts, w, o) => carve(r, pts, kw(w), o);
    const IMG = rect(-20, -20, IW + 40, IH + 40);

    /* ---- 1. sky: a flat indigo block, a strong ichimonji band wiped across the top */
    {
      const r = R('sky');
      ink('indigo', IMG, 1, LG(0, 0, 0, 800, [[0, 0.86], [0.5, 0.82], [1, 0.66]]));
      const band = 120 + r() * 40;
      ink('indigo', rect(-20, -20, IW + 40, band + 80), 1, LG(0, 0, 0, band + 50, [[0, 0.95], [0.72, 0.9], [0.86, 0.45], [1, 0]]));
      ink('key', rect(-20, -20, IW + 40, band * 0.55 + 20), 1, LG(0, 0, 0, band * 0.55, [[0, 0.32], [1, 0]]));
      ink('grey', IMG, 1, LG(0, 420, 0, 800, [[0, 0], [1, 0.32]]));
    }

    /* ---- 2. far ridge */
    {
      const r = R('ridge');
      const top = [[-20, 742], [80, 724], [160, 708], [230, 714], [300, 700], [380, 706], [460, 696], [1020, 700]];
      const p = poly(crPts(top, false).concat([[1020, 840], [-20, 840]]));
      ink('grey', p, 1, LG(0, 700, 0, 820, [[0, 0.62], [1, 0.3]]));
      ink('indigo', p, 0.2);
      ink('key', key(r, top, 1.1, { brk: 0.035, chip: 0.06, ts: 0, te: 0 }), 0.42);
    }

    /* ---- 3. the snowy hillside */
    const hillTop = [[-20, 802], [80, 794], [150, 800], [220, 786], [290, 794], [360, 782], [440, 790], [1020, 786]];
    {
      const r = R('hill');
      const p = poly(crPts(hillTop, false).concat([[1020, 960], [-20, 960]]));
      occ(p);
      ink('shadow', p, 0.55);
      ink('indigo', p, 1, LG(0, 785, 0, 900, [[0, 0.36], [1, 0.2]]));
      ink('grey', p, 0.14);
      ink('key', key(r, hillTop, 1, { brk: 0.04, chip: 0.06, ts: 0, te: 0 }), 0.4);
      for (const f of [[[150, 826], [230, 820], [300, 828]], [[330, 812], [400, 808], [450, 814]]]) ink('key', key(r, f, 1, { brk: 0.06, chip: 0.05 }), 0.3);
    }

    /* ---- 4. the village: one lit window */
    {
      const r = R('village');
      // [cx, base, width, gable toward us, lit]
      const houses = [[178, 850, 38, 0, 0], [232, 846, 52, 1, 1], [292, 836, 40, 0, 0], [346, 850, 44, 1, 0], [418, 840, 40, 0, 0]];
      for (const h of houses) {
        const cx = h[0], base = h[1], w = h[2];
        const wallH = w * 0.3, ov = w * 0.1, ye = base - wallH;
        const wall = rect(cx - w / 2, ye - 1, w, wallH + 1);
        occ(wall); inks([['indigo', 0.75], ['brown', 0.5], ['grey', 0.3]], wall);
        if (h[3]) {
          const rh = w * 0.62;
          const gable = poly([[cx - w / 2, ye], [cx, ye - rh + 4], [cx + w / 2, ye]]);
          occ(gable); inks([['indigo', 0.62], ['brown', 0.55], ['grey', 0.25]], gable);
          const sp = [[cx - w / 2 - ov, ye + 3], [cx - 1, ye - rh - 2], [cx + 1, ye - rh - 2], [cx + w / 2 + ov, ye + 3],
            [cx + w / 2 + ov - 5, ye + 3.5], [cx + w * 0.22, ye - rh * 0.45], [cx, ye - rh + 7], [cx - w * 0.22, ye - rh * 0.45], [cx - w / 2 - ov + 5, ye + 3.5]];
          const snowA = shape(sp, [0, 3, 4, 8]);
          occ(snowA);
          ink('shadow', snowA, 1, LG(0, ye - rh, 0, ye + 3, [[0, 0.16], [1, 0.4]]));
          ink('key', key(r, [sp[0], [cx, ye - rh - 2.4], sp[3]], 1, { chip: 0.05, ts: 0, te: 0 }), 0.75);
          ink('key', key(r, [[cx - w / 2 + 2, ye + 0.5], [cx, ye - rh + 7], [cx + w / 2 - 2, ye + 0.5]], 0.9, { chip: 0.06 }), 0.6);
          if (h[4]) {
            const wx = cx - w * 0.13, wy = ye + wallH * 0.18, wwid = w * 0.26, wh = wallH * 0.58;
            const win = rect(wx, wy, wwid, wh);
            occ(win); ink('yellow', win, 0.92);
            for (const f of [1 / 3, 2 / 3]) ink('key', rect(wx + wwid * f - 0.35, wy, kw(0.7), wh), 0.55);
            ink('key', rect(wx, wy + wh / 2 - 0.35, wwid, kw(0.7)), 0.55);
          }
        } else {
          const roofH = w * 0.46;
          const rp = [[cx - w / 2 - ov, ye + 2], [cx - w * 0.26, ye - roofH + 2], [cx - w * 0.1, ye - roofH - 1.5], [cx + w * 0.16, ye - roofH - 0.5],
            [cx + w * 0.27, ye - roofH + 2], [cx + w / 2 + ov, ye + 2], [cx, ye + 3.2]];
          const roof = shape(rp, [0, 5, 6]);
          occ(roof);
          ink('shadow', roof, 1, LG(0, ye - roofH, 0, ye + 2, [[0, 0.14], [1, 0.42]]));
          ink('indigo', roof, 0.1);
          ink('key', key(r, rp.slice(0, 6), 1, { chip: 0.05, ts: 1, te: 1 }), 0.7);
          ink('key', key(r, [[cx - w / 2 - ov + 1, ye + 2.2], [cx, ye + 3.2], [cx + w / 2 + ov - 1, ye + 2.2]], 1, { chip: 0.05 }), 0.8);
        }
      }
    }

    /* ---- cedars (sugi): narrow columns of drooping, layered clumps, each carrying snow ---- */
    function sugi(r, cx, top, bot, w, o) {
      const parts = [];
      const lean = (r() - 0.5) * (o.lean || 0.02);
      const axis = (y) => cx + lean * (y - top);
      const ch = o.clump || 34;
      const width = (y) => {
        const t = (y - top) / (bot - top);
        return w * (t < 0.14 ? 0.18 + 0.82 * Math.sqrt(Math.max(0, t) / 0.14) : 1 - 0.1 * (t - 0.14));
      };
      parts.push({ fol: shape([[axis(top), top - ch * 1.2], [axis(top) + w * 0.06, top + ch], [axis(top) - w * 0.06, top + ch]], [0, 1, 2]), snow: null, y: top });
      let y = top, side = r() < 0.5 ? -1 : 1;
      while (y < bot) {
        const ww = width(y);
        const two = ww > ch * 2.4 && r() < 0.8;
        const list = two ? [side, -side] : [(r() - 0.5) * 0.6];
        for (const s of list) {
          const hw = two ? ww * (0.3 + r() * 0.12) : ww * (0.42 + r() * 0.12);
          const cx0 = axis(y) + (two ? s * ww * (0.28 + r() * 0.08) : s * ww * 0.2);
          const yy = y + (two && s !== side ? ch * (0.2 + r() * 0.3) : 0);
          const h = ch * (0.7 + r() * 0.45);
          const dir = two ? s : (cx0 >= axis(y) ? 1 : -1);
          const dOut = h * (0.35 + r() * 0.35), dIn = h * (0.05 + r() * 0.15);
          const dL = dir < 0 ? dOut : dIn, dR = dir < 0 ? dIn : dOut;
          const pts = [[cx0 - hw, yy + dL], [cx0 - hw * 0.55, yy - h * 0.42 + dL * 0.3], [cx0, yy - h * 0.5], [cx0 + hw * 0.55, yy - h * 0.42 + dR * 0.3], [cx0 + hw, yy + dR]];
          const nsc = 3 + ((r() * 2) | 0);
          for (let j = 1; j <= nsc * 2 - 1; j++) {
            const u = 1 - j / (nsc * 2);
            const x = cx0 - hw + 2 * hw * u;
            const base = yy + h * 0.28 + (u < 0.5 ? dL : dR) * Math.abs(u - 0.5) * 1.6;
            pts.push([x + (r() - 0.5) * 2, base + (j % 2 ? h * (0.22 + r() * 0.22) : -h * 0.02)]);
          }
          const fol = shape(pts, [0, 4]);
          let snow = null, capTop = null;
          if (r() < (o.snowP == null ? 0.9 : o.snowP)) {
            const st = h * (0.28 + Math.pow(r(), 1.4) * 0.45) * (o.load || 1);
            const a = -0.86 + r() * 0.12, b = 0.86 - r() * 0.12;
            const nb = 4 + ((r() * 3) | 0), tp = [], bt = [];
            for (let j = 0; j <= nb; j++) {
              const u = a + ((b - a) * j) / nb, env = Math.pow(Math.max(0, 1 - Math.abs(u) / 0.95), 0.45);
              const dd = (u < 0 ? dL : dR) * Math.pow(Math.abs(u), 2) * 0.9;
              tp.push([cx0 + hw * u + (r() - 0.5) * 2, yy - h * 0.46 + dd - st * env * (0.6 + r() * 0.55)]);
            }
            for (let j = nb; j >= 0; j--) {
              const u = a + ((b - a) * j) / nb;
              const dd = (u < 0 ? dL : dR) * Math.pow(Math.abs(u), 2) * 0.85;
              bt.push([cx0 + hw * u, yy - h * 0.2 + dd + (r() - 0.35) * h * 0.22]);
            }
            snow = smooth(tp.concat(bt));
            capTop = crPts(tp, false);
          }
          parts.push({ fol, snow, capTop, y: yy, h: h + 10 });
        }
        side = -side;
        y += ch * (0.5 + r() * 0.28);
      }
      parts.sort((p, q) => q.y - p.y);
      return parts;
    }
    function drawSugi(r, parts, folInks, snowInks, keyA) {
      for (const t of parts) {
        occ(t.fol);
        inks(folInks, t.fol);
        if (t.snow) {
          occ(t.snow);
          for (const s of snowInks) ink(s[0], t.snow, 1, LG(0, t.y - t.h * 0.9, 0, t.y, [[0, s[1] * 0.35], [1, s[1]]]));
          if (keyA) ink('key', carve(r, t.capTop, kw(0.95), { raw: true, ts: 3, te: 3, tmin: 0.3, chip: 0.05, brk: 0.01 }), keyA);
        }
      }
    }

    /* ---- 5. the shrine grove and its torii, beyond the field on the left */
    {
      const r = R('shrine');
      const body = smooth([[40, 700], [110, 640], [190, 660], [214, 760], [210, 870], [196, 905], [40, 905]]);
      occ(body); inks([['cedar', 0.5], ['indigo', 0.55], ['grey', 0.25]], body);
      for (const t of [[78, 590, 880, 64], [150, 620, 885, 56], [196, 700, 890, 34]]) {
        drawSugi(r, sugi(r, t[0], t[1], t[2], t[3], { clump: 13 }), [['cedar', 0.55], ['indigo', 0.45], ['grey', 0.22]], [['shadow', 0.55], ['indigo', 0.2]], 0.35);
      }
      const clip = rect(-20, -20, 400, 902);
      const posts = [shape([[118, 852], [122.5, 852], [124, 900], [117, 900]], [0, 1, 2, 3]), shape([[164, 852], [168.5, 852], [169.5, 900], [163, 900]], [0, 1, 2, 3])];
      const nuki = rect(112, 860, 64, 3.6);
      const kasa = shape([[102, 843], [114, 846.5], [143, 847.2], [172, 846.5], [184, 843], [182.6, 848], [172, 851], [143, 851.8], [114, 851], [103.4, 848]], [0, 4, 5, 9]);
      for (const p of [posts[0], posts[1], nuki, kasa]) { occ(p, { clip }); inks([['grey', 0.55], ['brown', 0.35], ['indigo', 0.38], ['red', 0.1]], p, { clip }); }
      ink('key', key(r, [[103, 843.5], [114, 847], [143, 847.6], [172, 847], [183.5, 843.5]], 1, { ts: 1, te: 1 }), 0.8);
      ink('key', key(r, [[103, 848.6], [114, 851.3], [143, 852], [172, 851.3], [183, 848.6]], 0.8, { ts: 1, te: 1 }), 0.6);
      for (const px of [[118.3, 117.3], [168.2, 169.2]]) ink('key', key(r, [[px[0], 852], [px[1], 900]], 0.8), 0.6, null, { clip });
      const sk = blob(r, 143, 840.8, 42, 3, 16, 0.12); occ(sk); ink('shadow', sk, 0.3);
      ink('key', key(r, [[102, 842], [120, 838.4], [143, 837.8], [166, 838.4], [184, 842]], 0.8, { brk: 0.05 }), 0.5);
      const sn = blob(r, 144, 859, 33, 1.8, 12, 0.15); occ(sn); ink('shadow', sn, 0.3);
    }

    /* ---- 6. far poles along the road, receding into the dark */
    const poleArms = [];
    {
      const r = R('farpoles');
      for (const p of [{ x: 211, base: 872 }, { x: 218, base: 880 }, { x: 234, base: 900 }, { x: 266, base: 940 }]) {
        const u = um(p.base), w = Math.max(1.1, 0.26 * u), w2 = w * 0.8, top = p.base - 8 * u;
        const body = shape([[p.x - w2 / 2, top], [p.x + w2 / 2, top], [p.x + w / 2, p.base], [p.x - w / 2, p.base]], [0, 1, 2, 3]);
        occ(body); inks([['grey', 0.6], ['indigo', 0.5], ['brown', 0.15]], body);
        if (w > 3) ink('key', key(r, [[p.x + w / 2 - 0.4, p.base], [p.x + w2 / 2 - 0.4, top]], 1, { brk: 0.02 }), 0.7);
        const al = 1.7 * u, ay = top + 0.35 * u, at = Math.max(1, 0.12 * u);
        const arm = rect(p.x - al / 2, ay, al, at);
        occ(arm); inks([['grey', 0.6], ['indigo', 0.55]], arm);
        if (u > 8) ink('key', key(r, [[p.x - al / 2, ay + at], [p.x + al / 2, ay + at]], 0.8), 0.75);
        const sn = blob(r, p.x, ay - at * 0.2, al / 2 + 0.6, Math.max(0.8, at * 0.55), 10, 0.15);
        occ(sn); ink('shadow', sn, 0.3);
        poleArms.push([[p.x - 0.42 * al, ay - 0.1 * u], [p.x, ay - 0.1 * u], [p.x + 0.42 * al, ay - 0.1 * u], [p.x + 0.12 * u, top + 2.1 * u]]);
      }
    }

    /* ---- the distance veiled by falling snow */
    {
      const veil = rect(-20, 560, IW + 40, 400);
      for (const p of ['indigo', 'cedar', 'brown', 'key', 'grey']) wipe(p, veil, 1, LG(0, 560, 0, 940, [[0, 0], [0.5, 0.16], [1, 0.3]]));
    }

    /* ---- 7. the near ground: the road, ruts, banks, footprints, and the pool of light */
    const groundTop = [[-20, 910], [80, 906], [160, 900], [205, 867], [260, 878], [330, 888], [440, 898], [520, 904], [1020, 904]];
    {
      const r = R('ground');
      const g = poly(crPts(groundTop, false).concat([[1020, 1520], [-20, 1520]]));
      occ(g);
      ink('shadow', g, 1, LG(0, 866, 0, 1500, [[0, 0.68], [0.25, 0.56], [0.55, 0.5], [0.85, 0.56], [1, 0.66]]));
      ink('shadow', g, 1, LG(0, 0, 420, 0, [[0, 0.22], [1, 0]]));
      ink('shadow', g, 1, LG(1000, 0, 860, 0, [[0, 0.2], [1, 0]]));
      ink('indigo', g, 1, LG(0, 866, 0, 1500, [[0, 0.42], [0.25, 0.24], [0.7, 0.2], [1, 0.36]]));
      ink('grey', g, 1, LG(0, 866, 0, 1000, [[0, 0.32], [1, 0.06]]));
      ink('indigo', rect(-20, 1380, IW + 40, 140), 1, LG(0, 1380, 0, 1500, [[0, 0], [0.55, 0.1], [1, 0.26]]));
      // the road's banks: a soft shadow under each, a broken key line along the lip
      const left = [], right = [];
      for (let y = 868; y <= 1080; y += 6) left.push([roadX(y) - hwRoad(y), y, 0.06 * (y - H0) + 1]);
      for (let y = 868; y <= 1090; y += 6) right.push([roadX(y) + hwRoad(y), y, 0.06 * (y - H0) + 1]);
      for (const side of [left, right]) {
        ink('shadow', carve(r, side, 1, { abs: true, chip: 0, sw: 0.4, ts: 8, te: 30 }), 0.32);
        ink('key', key(r, side.map((q) => [q[0], q[1] - q[2] * 0.5]), 0.9, { brk: 0.04, chip: 0.06, ts: 4, te: 30 }), 0.45);
      }
      // ruts
      for (const side of [-1, 1]) {
        const pts = [], core = [];
        for (let y = 868; y <= 1530; y += 5) {
          const x = roadX(y) + side * 0.394 * (y - H0);
          pts.push([x, y, 0.15 * (y - H0)]);
          core.push([x - side * 0.02 * (y - H0), y, 0.06 * (y - H0)]);
        }
        ink('shadow', carve(r, pts, 1, { abs: true, chip: 0, sw: 0.25, ts: 2, te: 0 }), 0.27);
        ink('shadow', carve(r, core, 1, { abs: true, chip: 0, sw: 0.35, ts: 2, te: 0 }), 0.2);
        ink('grey', carve(r, core, 1, { abs: true, chip: 0, sw: 0.35, ts: 2, te: 0 }), 0.14);
        const edge = pts.filter((q) => q[1] > 1000).map((q) => [q[0] + side * q[2] * 0.42, q[1]]);
        ink('key', key(r, edge, 1.1, { brk: 0.035, chip: 0.06, ts: 20, te: 4 }), 0.45);
      }
      // wind-shaped drifts
      for (const d of [[[300, 1470], [380, 1430], [440, 1380]], [[-10, 1260], [60, 1236], [120, 1200]], [[-10, 1420], [80, 1380], [160, 1330]]]) {
        const pts = d.map((q) => [q[0], q[1], 0.06 * (q[1] - H0)]);
        ink('shadow', carve(r, pts, 1, { abs: true, chip: 0, sw: 0.5, ts: 40, te: 40, tmin: 0 }), 0.28);
        wipe('shadow', carve(r, pts.map((q) => [q[0], q[1] - q[2] * 0.75, q[2] * 0.45]), 1, { abs: true, chip: 0, sw: 0.5, ts: 40, te: 40, tmin: 0 }), 0.28);
      }

      // the pool of light: the snow blocks wiped back in many soft passes, a warm block printed in their place
      const PR = R('pool');
      const poolBase = [[452, 1080], [866, 1074], [960, 1120], [1012, 1220], [996, 1350], [890, 1460], [690, 1500], [470, 1480], [300, 1420], [150, 1330], [80, 1230], [150, 1150], [300, 1110], [400, 1090]];
      const NP = 18, pwr = 0.9 + PR() * 0.2;
      for (let i = 0; i < NP; i++) {
        const f = 1 - i * (0.92 / NP);
        const pts = poolBase.map((q) => [LIGHT[0] + (q[0] - LIGHT[0]) * f + (PR() - 0.5) * 22 * f, LIGHT[1] + (q[1] - LIGHT[1]) * f + (PR() - 0.5) * 10 * f]);
        const pp = smooth(pts);
        wipe('shadow', pp, 0.095 * pwr); wipe('indigo', pp, 0.12 * pwr); wipe('grey', pp, 0.12 * pwr);
        ink('yellow', pp, 0.04 * pwr);
      }
      // long shadows thrown by the light
      const wedge = (pts, from, to, a) => {
        const p = smooth(pts);
        ink('shadow', p, 1, LG(from[0], from[1], to[0], to[1], [[0, a], [0.6, a * 0.6], [1, 0]]));
        ink('grey', p, 1, LG(from[0], from[1], to[0], to[1], [[0, a * 0.45], [1, 0]]));
        wipe('yellow', p, 1, LG(from[0], from[1], to[0], to[1], [[0, 0.95], [1, 0.5]]));
      };
      wedge([[334, 1098], [370, 1104], [300, 1118], [200, 1136], [120, 1158], [70, 1170], [40, 1160], [60, 1140], [130, 1126], [230, 1108], [300, 1100]], FIG, [50, 1158], 0.6);
      wedge([[287, 1106], [293, 1110], [220, 1118], [150, 1128], [118, 1136], [92, 1134], [96, 1122], [124, 1118], [160, 1118], [220, 1112]], SIGN, [96, 1128], 0.5);
      // footprints, from where we stand to the stop
      const fr = R('steps');
      let side = 1;
      for (let z = 2.3; z < 5.95; z += 0.36 + fr() * 0.04) {
        const y = H0 + KZ / z;
        const rutx = roadX(y) + 0.394 * (y - H0);
        const blend = clamp((z - 4.6) / 1.35, 0, 1);
        const x = rutx + (FIG[0] - rutx) * blend * blend + side * 0.11 * um(y) + (fr() - 0.5) * 0.04 * um(y);
        const ry = (KZ / (z - 0.15) - KZ / (z + 0.15)) / 2, rx = 0.06 * um(y);
        const rot = (fr() - 0.5) * 0.2 + side * 0.06;
        const p = blob(fr, x, y, rx, ry, 9, 0.12, rot);
        ink('shadow', p, 0.5); ink('grey', p, 0.26); ink('indigo', p, 0.12);
        const inner = ell(x - rx * 0.1, y - ry * 0.15, rx * 0.62, ry * 0.6, rot);
        ink('shadow', inner, 0.3); ink('indigo', inner, 0.14);
        ink('key', key(fr, [[x - rx * 0.85, y - ry * 0.3], [x - rx * 0.3, y - ry * 0.9], [x + rx * 0.35, y - ry * 0.9], [x + rx * 0.85, y - ry * 0.3]], Math.max(0.9, rx * 0.07), { chip: 0.05, ts: 3, te: 3 }), 0.45);
        side = -side;
      }
      // the cat's prints, from the shelter
      const cr = R('catsteps');
      for (let i = 0; i < 18; i++) {
        const t = i / 17, x = 850 + (CAT[0] + 30 - 850) * t + Math.sin(t * 5) * 12, y = 1090 + (CAT[1] + 4 - 1090) * t + Math.sin(t * 3.1) * 6;
        const sz = 1 + t * 1.6;
        for (const d of [-1, 1]) ink('shadow', ell(x + d * 2.2 * sz, y + d * 1.4 * sz + (cr() - 0.5), 2.2 * sz, 1.1 * sz, 0), 0.5);
      }
    }

    /* ---- 8. the near cedar at the left edge */
    {
      const r = R('leftcedar');
      const u = um(960), tw = 0.6 * u;
      const trunk = shape([[30 - tw * 0.4, 600], [30 + tw * 0.4, 600], [30 + tw * 0.55, 962], [30 - tw * 0.55, 962]], [0, 1, 2, 3]);
      occ(trunk); inks([['cedar', 0.55], ['brown', 0.45], ['indigo', 0.8]], trunk);
      ink('key', key(r, [[30 + tw * 0.42, 600], [30 + tw * 0.55, 962]], 1.2, { brk: 0.01 }), 0.85);
      const pl = carve(r, [[30 - tw * 0.35, 620], [30 - tw * 0.48, 950]], 4, { ts: 6, te: 2, chip: 0.1, brk: 0.04 });
      occ(pl); ink('shadow', pl, 0.5);
      const dr = blob(r, 30, 962, 60, 8, 10, 0.2); occ(dr); inks([['shadow', 0.55], ['indigo', 0.3]], dr);
      drawSugi(r, sugi(r, 18, -140, 640, 132, { clump: 30 }), [['cedar', 0.9], ['indigo', 0.62]], [['shadow', 0.56], ['indigo', 0.22]], 0.6);
    }

    /* ---- 9. the dark cedars behind the stop */
    {
      const r = R('grove');
      const body = poly(crPts([[446, -20], [440, 200], [446, 420], [436, 640], [432, 860], [428, 1046]], false).concat([[1020, 1046], [1020, -20]]));
      occ(body);
      inks([['cedar', 0.62], ['indigo', 0.84], ['grey', 0.2]], body);
      const floor = poly(crPts([[426, 1006], [520, 998], [620, 1004], [720, 996], [820, 1002], [920, 997], [1020, 1003]], false).concat([[1020, 1060], [426, 1060]]));
      occ(floor);
      inks([['shadow', 0.6], ['indigo', 0.5], ['grey', 0.22]], floor);
      for (let i = 0; i < 9; i++) {
        const x = 450 + r() * 560, w = 6 + r() * 10;
        const p = carve(r, [[x, 700 + r() * 80], [x + (r() - 0.5) * 3, 1004 + r() * 6]], w, { ts: 0, te: 2, sw: 0.1, chip: 0.03 });
        occ(p); inks([['cedar', 0.5], ['indigo', 0.85], ['key', 0.3]], p);
      }
      const back = [['cedar', 0.72], ['indigo', 0.74], ['grey', 0.12]], backS = [['shadow', 0.68], ['indigo', 0.38]];
      const front = [['cedar', 0.9], ['indigo', 0.6]], frontS = [['shadow', 0.55], ['indigo', 0.2]];
      const trees = [
        [604, -160, 690, 112, back, backS, 1], [790, -150, 670, 120, back, backS, 1], [960, -150, 680, 120, back, backS, 1],
        [516, -120, 650, 92, front, frontS, 0], [700, -170, 620, 118, front, frontS, 0], [880, -160, 640, 116, front, frontS, 0],
      ];
      for (const t of trees) {
        const u = um(1040), tw = (t[6] ? 0.42 : 0.55) * u;
        const trunk = shape([[t[0] - tw * 0.4, t[2] - 40], [t[0] + tw * 0.4, t[2] - 40], [t[0] + tw * 0.55, 1044], [t[0] - tw * 0.55, 1044]], [0, 1, 2, 3]);
        occ(trunk); inks([['cedar', 0.6], ['brown', 0.4], ['indigo', 0.8]], trunk);
        if (!t[6]) {
          ink('key', key(r, [[t[0] - tw * 0.42, t[2] - 30], [t[0] - tw * 0.55, 1040]], 1.1, { brk: 0.02 }), 0.75);
          ink('key', key(r, [[t[0] + tw * 0.42, t[2] - 30], [t[0] + tw * 0.55, 1040]], 1.1, { brk: 0.02 }), 0.75);
          const pl = carve(r, [[t[0] - tw * 0.3, t[2] - 20], [t[0] - tw * 0.4, 1030]], 4, { ts: 6, te: 2, chip: 0.1, brk: 0.05 });
          occ(pl); ink('shadow', pl, 0.5);
          // bark: a few long carved strokes
          for (let i = 0; i < 3; i++) { const bx = t[0] + (r() - 0.5) * tw * 0.6; ink('key', key(r, [[bx, t[2] + r() * 60], [bx + (r() - 0.5) * 3, t[2] + 120 + r() * 200]], 0.8, { brk: 0.05 }), 0.4); }
        }
        drawSugi(r, sugi(r, t[0], t[1], t[2], t[3], { clump: 34, snowP: t[6] ? 0.75 : 0.95, load: t[6] ? 0.85 : 1.1 }), t[4], t[5], t[6] ? 0.28 : 0.62);
      }
      // the light-halo: the dark blocks wiped thin around the machines
      const hm = ellM(660, 930, 300, 200);
      for (const p of ['indigo', 'cedar']) wipe(p, UNIT, 1, RG([[0, 0.5], [0.45, 0.32], [0.8, 0.08], [1, 0]]), { m: hm });
      ink('yellow', UNIT, 1, RG([[0, 0.32], [0.6, 0.12], [1, 0]]), { m: ellM(660, 1010, 280, 70) });
    }

    /* ---- 10. the near pole behind the stop, and its wires running off down the road */
    {
      const r = R('nearpole');
      const x = 497, top = 138, base = 1050, u = um(base);
      const w = 0.26 * u, w2 = w * 0.78;
      const body = shape([[x - w2 / 2, top], [x + w2 / 2, top], [x + w / 2, base], [x - w / 2, base]], [0, 1, 2, 3]);
      occ(body); inks([['grey', 0.6], ['indigo', 0.55], ['brown', 0.15]], body);
      ink('indigo', body, 1, LG(x - w / 2, 0, x + w / 2, 0, [[0, 0.1], [0.6, 0], [1, 0.3]]));
      ink('key', key(r, [[x - w2 / 2, top], [x - w / 2, base]], 1.3, { brk: 0.01, chip: 0.04, ts: 0, te: 0 }), 0.9);
      ink('key', key(r, [[x + w2 / 2, top], [x + w / 2, base]], 1.3, { brk: 0.01, chip: 0.04, ts: 0, te: 0 }), 0.9);
      const pl = [];
      for (let y = top; y <= base; y += 16) pl.push([x - w2 / 2 + (y - top) / (base - top) * (w2 - w) / 2 + 1.5 + r() * 5, y]);
      const plaster = poly([[x - w2 / 2 - 0.5, top]].concat(pl).concat([[x - w / 2 - 0.5, base]]));
      occ(plaster); ink('shadow', plaster, 0.36);
      const al = 1.8 * u, ay = top + 0.3 * u, at = 0.12 * u;
      const arm = rect(x - al / 2, ay, al, at);
      occ(arm); inks([['grey', 0.6], ['indigo', 0.55]], arm);
      ink('key', key(r, [[x - al / 2, ay + at], [x + al / 2, ay + at]], 1.1), 0.85);
      ink('key', key(r, [[x - al / 2, ay], [x + al / 2, ay]], 0.9), 0.7);
      const sn = blob(r, x, ay - 2, al / 2 + 2, 4, 14, 0.15); occ(sn); ink('shadow', sn, 0.3);
      ink('key', key(r, [[x - al / 2 - 2, ay - 1], [x - al / 4, ay - 5.5], [x + al / 4, ay - 5.5], [x + al / 2 + 2, ay - 1]], 0.8, { brk: 0.05 }), 0.5);
      const ins = [];
      for (const f of [-0.42, 0, 0.42]) {
        const ix = x + f * al, iy = ay - 0.12 * u;
        const pi = ell(ix, iy, 0.06 * u, 0.09 * u, 0); occ(pi); ink('key', pi, 0.6); ink('shadow', pi, 0.35);
        ins.push([ix, iy - 0.05 * u]);
      }
      const ty = top + 2.2 * u;
      ins.push([x - w / 2, ty]);
      // a transformer
      const tf = shape([[x + w / 2, ty + 20], [x + w / 2 + 34, ty + 18], [x + w / 2 + 36, ty + 70], [x + w / 2 + 18, ty + 76], [x + w / 2, ty + 70]], [0, 1, 4]);
      occ(tf); inks([['grey', 0.48], ['indigo', 0.3]], tf);
      ink('key', key(r, [[x + w / 2 + 34, ty + 18], [x + w / 2 + 36, ty + 70], [x + w / 2 + 18, ty + 76]], 1), 0.8);
      const tsn = blob(r, x + w / 2 + 17, ty + 17, 20, 4, 9, 0.2); occ(tsn); ink('shadow', tsn, 0.3);
      // wires: near to far, each with a thread of snow along its top
      const arms = [ins].concat(poleArms.slice().reverse());
      for (let i = 0; i < arms.length - 1; i++) {
        const A = arms[i], B = arms[i + 1];
        for (let j = 0; j < 4; j++) {
          const a = A[j], b = B[j];
          const span = Math.hypot(b[0] - a[0], b[1] - a[1]);
          const sag = span * (j === 3 ? 0.06 : 0.04) + 2;
          const pts = sagPts(a, b, sag, Math.max(8, Math.round(span / 6)));
          const ww = (j === 3 ? 1.6 : 1.1) * (i === 0 ? 1.15 : 0.9);
          occ(carve(r, pts.map((q) => [q[0], q[1] - ww * 0.95 - 0.6]), kw(1.2), { raw: true, ts: 0, te: 0, sw: 0.5, brk: 0.05, chip: 0.1 }));
          ink('key', key(r, pts, ww, { raw: true, ts: 0, te: 3, sw: 0.15, chip: 0.02, brk: 0.004 }), 0.95);
        }
      }
    }

    // everything standing at the stop is cut off by the snow it stands in
    const snowLine = (x) => (x < 845 ? 1070 : 1058) + 3 * Math.sin(x * 0.07) + 2 * Math.sin(x * 0.19 + 1);
    const standClip = (() => {
      const pts = [[420, -20], [1020, -20]];
      for (let x = 1020; x >= 420; x -= 4) pts.push([x, snowLine(x)]);
      return poly(pts);
    })();
    const C = { clip: standClip };

    /* ---- 11. the bus shelter, cut by the edge of the block */
    {
      const r = R('shelter');
      const X0 = 866, X1 = 1060, TOP = 781, BASE = 1066;
      const side = shape([[846, 788], [X0, TOP], [X0, BASE], [846, BASE - 6]], [0, 1, 2, 3]);
      occ(side, C); inks([['brown', 0.5], ['yellow', 0.55], ['grey', 0.1]], side, C);
      for (let y = 798; y < 1064; y += 15) ink('key', key(r, [[846, y + 3], [X0, y]], 0.8, { chip: 0.08, ts: 0, te: 0 }), 0.55, null, C);
      const back = rect(X0 + 10, TOP + 6, X1 - X0, BASE - TOP);
      occ(back, C);
      inks([['brown', 0.55], ['grey', 0.3]], back, C);
      ink('indigo', back, 1, LG(0, TOP, 0, BASE, [[0, 0.86], [1, 0.6]]), C);
      const lit = poly([[X0 + 60, TOP + 6], [X1, TOP + 6], [X1, BASE], [X0 + 20, BASE]]);
      wipe('indigo', lit, 0.42, null, C); ink('yellow', lit, 0.36, null, C);
      for (let y = TOP + 20; y < BASE; y += 16) ink('key', key(r, [[X0 + 10, y], [X1, y + 0.5]], 0.8, { brk: 0.02, chip: 0.06, ts: 0, te: 0 }), 0.5, null, C);
      const tt = rect(930, 880, 40, 54);
      occ(tt, C); ink('yellow', tt, 0.2, null, C); ink('grey', tt, 0.2, null, C); ink('indigo', tt, 0.15, null, C);
      ink('key', key(r, [[930, 880], [970, 880], [970, 934], [930, 934], [930, 880]], 0.9, { raw: true, ts: 0, te: 0 }), 0.8, null, C);
      for (let i = 0; i < 8; i++) ink('key', rect(934, 886 + i * 5.8, 18 + r() * 12, kw(0.8)), 0.5, null, C);
      const po = rect(890, 884, 28, 40);
      occ(po, C); ink('red', po, 0.2, null, C); ink('yellow', po, 0.3, null, C); ink('indigo', po, 0.28, null, C);
      ink('blue', ell(904, 898, 8, 8, 0), 0.28, null, C);
      ink('key', key(r, [[890, 884], [918, 884], [918, 924], [890, 924], [890, 884]], 0.8, { raw: true, ts: 0, te: 0 }), 0.7, null, C);
      const seat = rect(X0 + 16, 1004, X1 - X0, 8);
      occ(seat, C); inks([['brown', 0.6], ['yellow', 0.38], ['indigo', 0.2]], seat, C);
      ink('key', key(r, [[X0 + 16, 1012], [X1, 1012]], 1.2, { chip: 0.05 }), 0.8, null, C);
      ink('key', key(r, [[X0 + 16, 1004], [X1, 1004]], 0.8, { chip: 0.05 }), 0.6, null, C);
      for (const lx of [X0 + 26, X0 + 110]) { const leg = rect(lx, 1012, 6, 50); occ(leg, C); inks([['brown', 0.6], ['indigo', 0.6]], leg, C); }
      const post = rect(X0, TOP - 2, 13, BASE - TOP + 2);
      occ(post, C); inks([['brown', 0.72], ['indigo', 0.32]], post, C); ink('yellow', post, 0.42, null, C);
      ink('key', key(r, [[X0 + 13, TOP], [X0 + 13, BASE]], 1.1, { brk: 0.01 }), 0.8, null, C);
      ink('key', key(r, [[X0, TOP], [X0, BASE]], 1.1, { brk: 0.01 }), 0.8, null, C);
      const beam = rect(X0 - 10, TOP - 12, 200, 14);
      occ(beam); inks([['brown', 0.72], ['indigo', 0.3]], beam);
      ink('yellow', beam, 1, LG(X0 - 10, 0, X0 + 80, 0, [[0, 0.45], [1, 0]]));
      ink('key', key(r, [[X0 - 10, TOP + 2], [1010, TOP + 2]], 1.3), 0.85);
      ink('key', key(r, [[X0 - 10, TOP - 12], [1010, TOP - 12]], 1), 0.7);
      const nb = rect(900, TOP - 10.5, 80, 9.5);
      occ(nb); ink('yellow', nb, 0.15); ink('grey', nb, 0.1);
      ['宝', '来', '辻'].forEach((ch, i) => ink('key', glyph(r, ch, 918 + i * 15, TOP - 10.2, 8.6, 1, { jit: 2 }), 0.85));
      for (const ix of [880, 896, 912, 942, 958, 984, 998]) {
        const l = 5 + r() * 14, ic = poly([[ix - 1.8, TOP + 2], [ix + 1.8, TOP + 2], [ix + (r() - 0.5), TOP + 2 + l]]);
        occ(ic); ink('shadow', ic, 0.35);
      }
      const rp = [[836, 774], [834, 758], [846, 744], [870, 734], [910, 726], [960, 722], [1020, 724], [1020, 778], [990, 776], [950, 779], [910, 776], [870, 779], [848, 780]];
      const roof = smooth(rp);
      occ(roof);
      ink('shadow', roof, 1, LG(0, 722, 0, 780, [[0, 0.14], [0.55, 0.22], [1, 0.48]]));
      ink('indigo', roof, 0.08);
      ink('yellow', roof, 1, LG(834, 0, 900, 0, [[0, 0.35], [1, 0]]));
      ink('key', key(r, crPts(rp.slice(0, 7), false), 1.2, { raw: true, brk: 0.03, chip: 0.05 }), 0.6);
      ink('key', key(r, [[848, 780], [870, 779], [910, 776], [950, 779], [990, 776], [1012, 777]], 1, { brk: 0.04, chip: 0.06 }), 0.5);
    }

    /* ---- 12. three vending machines: the only strong light */
    {
      const r = R('machines');
      const side = shape([[454, 843], [MACH[0], MTOP], [MACH[0], MBASE], [454, MBASE - 8]], [0, 1, 2, 3]);
      occ(side, C); inks([['indigo', 0.72], ['blue', 0.62]], side, C);
      ink('key', key(r, [[454, 843], [454, 1070]], 1.2, { brk: 0.01 }), 0.9, null, C);
      const plaster = smooth([[454, 852], [459, 849], [461, 900], [458, 960], [460, 1020], [456, 1068], [453, 1020], [453, 900]]);
      occ(plaster, C); ink('shadow', plaster, 0.42, null, C);
      const PAL = {
        red: [['red', 0.92]], blue: [['blue', 0.86]], tea: [['yellow', 0.75], ['blue', 0.32]], barley: [['brown', 0.55], ['yellow', 0.5]],
        coffee: [['brown', 0.85], ['key', 0.4]], water: [['blue', 0.24], ['shadow', 0.2]], orange: [['yellow', 0.95], ['red', 0.45]],
        milk: [['yellow', 0.2], ['grey', 0.1]], black: [['key', 0.82]], green: [['blue', 0.55], ['yellow', 0.9]],
      };
      const NAMES = Object.keys(PAL);
      const bodies = [
        { inks: [['blue', 0.9], ['indigo', 0.22]], ad: [['blue', 0.4], ['yellow', 0.15]], mark: 'wave' },
        { inks: [['shadow', 0.22], ['grey', 0.14]], ad: [['yellow', 0.55], ['red', 0.25]], mark: 'dot' },
        { inks: [['blue', 0.62], ['yellow', 0.92], ['indigo', 0.12]], ad: [['yellow', 0.5], ['blue', 0.2]], mark: 'leaf' },
      ];
      for (let mi = 0; mi < 3; mi++) {
        const mx = MACH[mi], B = bodies[mi];
        const body = rect(mx, MTOP, MW, MBASE - MTOP);
        occ(body, C); inks(B.inks, body, C);
        const hd = rect(mx + 7, MTOP + 6, MW - 14, 14);
        occ(hd, C); ink('yellow', hd, 0.12, null, C);
        ink('key', key(r, [[mx + 7, MTOP + 6], [mx + MW - 7, MTOP + 6], [mx + MW - 7, MTOP + 20], [mx + 7, MTOP + 20], [mx + 7, MTOP + 6]], 0.8, { raw: true, ts: 0, te: 0 }), 0.7, null, C);
        if (B.mark === 'wave') ink('blue', carve(r, [[mx + 14, MTOP + 15], [mx + 30, MTOP + 10], [mx + 46, MTOP + 15], [mx + 62, MTOP + 10], [mx + 76, MTOP + 14]], 3, { chip: 0 }), 0.8, null, C);
        if (B.mark === 'dot') { ink('red', ell(mx + MW / 2, MTOP + 13, 4.4, 4.4, 0), 0.92, null, C); }
        if (B.mark === 'leaf') { inks([['blue', 0.5], ['yellow', 0.9]], ell(mx + 26, MTOP + 13, 7, 3.4, -0.4), C); ink('key', rect(mx + 40, MTOP + 12, 44, kw(1.6)), 0.5, null, C); }
        // the window and its rows of samples
        const wx = mx + 7, wy = MTOP + 24, ww = MW - 14, wh = 98;
        const win = rect(wx, wy, ww, wh);
        occ(win, C);
        ink('yellow', win, 1, LG(0, wy, 0, wy + wh, [[0, 0.1], [1, 0.04]]), C);
        for (let row = 0; row < 3; row++) {
          const ry0 = wy + 3 + row * 32, rb = ry0 + 24;
          let cur = NAMES[(r() * NAMES.length) | 0], run = 0;
          for (let it = 0; it < 8; it++) {
            if (run <= 0) { cur = NAMES[(r() * NAMES.length) | 0]; run = 1 + ((r() * 3) | 0); }
            run--;
            const cx = wx + 6.9 + it * 13.75, type = r();
            const P = PAL[cur];
            if (type < 0.45) {
              const h = 19 + r() * 2.5, bw = 8.6;
              const b = shape([[cx - bw / 2, rb], [cx - bw / 2, rb - h + 6], [cx - 2.2, rb - h + 2], [cx + 2.2, rb - h + 2], [cx + bw / 2, rb - h + 6], [cx + bw / 2, rb]], [0, 5]);
              inks(P.map((q) => [q[0], q[1] * 0.55]), b, C);
              inks(P, rect(cx - bw / 2, rb - h * 0.62, bw, h * 0.34), C);
              ink(r() < 0.5 ? 'red' : 'blue', rect(cx - 2.3, rb - h - 0.6, 4.6, 3), 0.85, null, C);
              ink('key', key(r, [[cx - bw / 2, rb], [cx - bw / 2, rb - h + 6], [cx - 2.2, rb - h + 2]], 0.55, { ts: 0, te: 0, chip: 0 }), 0.35, null, C);
            } else if (type < 0.8) {
              const h = 15 + r() * 1.6, bw = 8.8;
              inks(P, rect(cx - bw / 2, rb - h, bw, h), C);
              ink('grey', rect(cx - bw / 2, rb - h, bw, 2), 0.5, null, C);
              wipe(P[0][0], rect(cx - bw / 2, rb - h * 0.55, bw, h * 0.18), 0.85, null, C);
              ink('key', key(r, [[cx - bw / 2, rb - h], [cx - bw / 2, rb]], 0.55, { ts: 0, te: 0, chip: 0 }), 0.35, null, C);
            } else {
              const h = 12.6, bw = 7.4;
              inks(PAL[r() < 0.5 ? 'coffee' : cur], rect(cx - bw / 2, rb - h, bw, h), C);
              ink('yellow', rect(cx - bw / 2, rb - h * 0.6, bw, 2), 0.7, null, C);
            }
            ink(row === 2 ? 'red' : 'blue', rect(cx - 4, rb + 2, 8, 2.8), 0.88, null, C);
          }
          // the strip under each row: cold rows blue, the hot row red
          ink(row === 2 ? 'red' : 'blue', rect(wx, rb + 5.6, ww, 1.6), 0.5, null, C);
          ink('key', rect(wx, rb + 7.2, ww, kw(0.8)), 0.55, null, C);
        }
        ink('key', key(r, [[wx, wy], [wx + ww, wy], [wx + ww, wy + wh], [wx, wy + wh], [wx, wy]], 1.2, { ts: 0, te: 0, chip: 0.04, raw: true }), 0.9, null, C);
        // lit advertisement and the coin unit
        const ay = wy + wh + 6;
        const ad = rect(mx + 10, ay, 70, 60);
        occ(ad, C);
        inks(B.ad.map((q) => [q[0], q[1], LG(0, ay, 0, ay + 60, [[0, q[1] * 0.4], [1, q[1]]])]), ad, C);
        if (mi === 0) { inks([['blue', 0.8]], ell(mx + 45, ay + 33, 14, 18, 0.15), C); ink('key', key(r, crPts([[mx + 45, ay + 15], [mx + 59, ay + 33], [mx + 45, ay + 51], [mx + 31, ay + 33]], true, 1).concat([[mx + 45, ay + 15]]), 0.7, { raw: true, ts: 0, te: 0 }), 0.5, null, C); }
        if (mi === 1) inks([['brown', 0.75], ['key', 0.3]], shape([[mx + 39, ay + 56], [mx + 39, ay + 28], [mx + 42, ay + 16], [mx + 48, ay + 16], [mx + 51, ay + 28], [mx + 51, ay + 56]], [0, 5]), C);
        if (mi === 2) for (let i = 0; i < 5; i++) inks([['blue', 0.5], ['yellow', 0.8]], ell(mx + 24 + i * 9, ay + 38 - (i % 2) * 9, 7, 3.4, -0.6 + i * 0.35), C);
        ink('key', key(r, [[mx + 10, ay], [mx + 80, ay], [mx + 80, ay + 60], [mx + 10, ay + 60], [mx + 10, ay]], 1, { raw: true, ts: 0, te: 0 }), 0.8, null, C);
        const cu = rect(mx + 86, ay, 28, 60);
        occ(cu, C); ink('shadow', cu, 0.14, null, C); ink('grey', cu, 0.12, null, C);
        ink('key', key(r, [[mx + 86, ay], [mx + 114, ay], [mx + 114, ay + 60], [mx + 86, ay + 60], [mx + 86, ay]], 0.8, { raw: true, ts: 0, te: 0 }), 0.6, null, C);
        ink('key', rect(mx + 93, ay + 6, 12, kw(2.2)), 0.9, null, C);
        ink('key', rect(mx + 90, ay + 13, 20, 6.4), 0.85, null, C);
        ink('red', rect(mx + 92, ay + 14.6, 9, 3), 0.9, null, C);
        ink('key', rect(mx + 89, ay + 27, 22, kw(2.6)), 0.9, null, C);
        ink('key', ell(mx + 100, ay + 43, 3.4, 3.4, 0), 0.8, null, C);
        ink('blue', ell(mx + 100, ay + 54, 4, 2.6, 0), 0.6, null, C);
        // the slot, its flap, the kick plate
        const sy = ay + 66;
        const sl = rect(mx + 16, sy, 84, 22);
        occ(sl, C); inks([['key', 0.86], ['indigo', 0.4]], sl, C);
        const flap = rect(mx + 16, sy, 84, 3.2);
        occ(flap, C); ink('shadow', flap, 0.2, null, C);
        ink('key', key(r, [[mx + 16, sy], [mx + 100, sy], [mx + 100, sy + 22], [mx + 16, sy + 22], [mx + 16, sy]], 0.9, { raw: true, ts: 0, te: 0 }), 0.7, null, C);
        ink('key', key(r, [[mx, MTOP], [mx, MBASE]], 1.4, { brk: 0.01, ts: 0, te: 0 }), 0.92, null, C);
        ink('key', key(r, [[mx + MW, MTOP], [mx + MW, MBASE]], 1.4, { brk: 0.01, ts: 0, te: 0 }), 0.92, null, C);
        ink('key', key(r, [[mx, 1062], [mx + MW, 1062]], 1, { brk: 0.02 }), 0.6, null, C);
      }
      // snow heaped on the tops, warm where the light reaches its lip
      const cp = [[452, 846], [450, 832], [462, 822], [500, 816], [560, 815], [610, 818], [660, 812], [720, 815], [780, 811], [830, 814], [852, 826], [848, 840],
        [820, 841], [770, 840], [720, 841], [670, 840], [620, 841], [570, 840], [520, 841], [480, 841]];
      const cap = smooth(cp);
      occ(cap);
      ink('shadow', cap, 1, LG(0, 811, 0, 842, [[0, 0.1], [0.6, 0.22], [1, 0.42]]));
      ink('yellow', cap, 1, LG(0, 826, 0, 842, [[0, 0], [1, 0.42]]));
      ink('key', key(r, crPts(cp.slice(0, 12), false), 1.2, { raw: true, brk: 0.03, chip: 0.05 }), 0.6);
      ink('key', key(r, [[450, 845], [480, 842], [520, 841.5], [620, 841.5], [720, 841.5], [820, 841.5], [848, 840]], 1, { brk: 0.03, chip: 0.06 }), 0.55);
    }

    /* ---- snow banked against the machines and the shelter, and the bank along the right */
    {
      const r = R('drifts');
      for (let x = 448; x < 1010;) {
        const w = 18 + r() * 36, cx = x + w / 2, y = snowLine(cx) + 2;
        const lump = blob(r, cx, y, w * 0.62, 4 + r() * 6, 9, 0.18);
        occ(lump);
        if (cx < 860) { ink('yellow', lump, 0.36); ink('shadow', lump, 1, LG(0, y - 8, 0, y + 8, [[0, 0.02], [1, 0.14]])); }
        else { ink('yellow', lump, 0.22); ink('shadow', lump, 1, LG(0, y - 8, 0, y + 8, [[0, 0.18], [1, 0.36]])); ink('indigo', lump, 0.1); }
        x += w * (0.55 + r() * 0.35);
      }
      const bankTop = [[870, 1070], [930, 1084], [990, 1104], [1012, 1112]];
      const bank = smooth([[860, 1074]].concat(bankTop).concat([[1012, 1520], [960, 1520], [930, 1420], [948, 1320], [920, 1220], [888, 1140]]));
      occ(bank);
      ink('shadow', bank, 1, LG(870, 0, 1010, 0, [[0, 0.18], [1, 0.42]]));
      ink('indigo', bank, 1, LG(870, 0, 1010, 0, [[0, 0.06], [1, 0.22]]));
      ink('yellow', bank, 1, LG(870, 0, 960, 0, [[0, 0.3], [1, 0]]));
      ink('key', key(r, [[862, 1076], [890, 1140], [922, 1220], [946, 1320], [930, 1420], [956, 1520]], 1.1, { brk: 0.03, chip: 0.05, ts: 6, te: 0 }), 0.5);
    }

    /* ---- 13. the bus-stop sign */
    {
      const r = R('sign');
      const [sx, sb] = SIGN, dy = 812, dr = 29;
      const pole = rect(sx - 2.6, dy + 10, 5.2, sb - dy - 10);
      occ(pole); inks([['grey', 0.6], ['indigo', 0.55]], pole);
      ink('key', key(r, [[sx - 2.6, dy + 10], [sx - 2.6, sb]], 0.9, { brk: 0.01 }), 0.8);
      ink('key', key(r, [[sx + 2.6, dy + 10], [sx + 2.6, sb]], 0.9, { brk: 0.01 }), 0.8);
      ink('yellow', rect(sx + 0.6, 900, 2, sb - 902), 0.4);
      const tt = rect(sx - 15, 880, 30, 46);
      occ(tt); ink('grey', tt, 0.22); ink('yellow', tt, 0.12); ink('indigo', tt, 0.1);
      ink('yellow', rect(sx + 2, 880, 13, 46), 0.25);
      for (let i = 0; i < 7; i++) ink('key', rect(sx - 11, 888 + i * 5.2, 14 + r() * 6, kw(0.8)), 0.55);
      ink('key', key(r, [[sx - 15, 880], [sx + 15, 880], [sx + 15, 926], [sx - 15, 926], [sx - 15, 880]], 1, { raw: true, ts: 0, te: 0 }), 0.85);
      const ts = blob(r, sx, 877.6, 16, 3, 8, 0.2); occ(ts); ink('shadow', ts, 0.25);
      const disc = ell(sx, dy, dr, dr, 0);
      occ(disc);
      const ring = new Path2D(); ring.arc(sx, dy, dr, 0, TAU); ring.arc(sx, dy, dr * 0.72, 0, TAU, true);
      ink('blue', ring, 0.9); ink('indigo', ring, 0.15);
      ink('yellow', disc, 0.1);
      // a little bus in the middle of the sign
      const bus = shape([[sx - 11, dy + 4], [sx - 11, dy - 5], [sx - 8, dy - 8], [sx + 10, dy - 8], [sx + 11, dy - 5], [sx + 11, dy + 4]], [0, 5]);
      ink('key', bus, 0.75);
      wipe('key', rect(sx - 8, dy - 6, 5, 4), 1); wipe('key', rect(sx - 2, dy - 6, 5, 4), 1); wipe('key', rect(sx + 4, dy - 6, 5, 4), 1);
      ink('key', ell(sx - 6, dy + 5, 2.4, 2.4, 0), 0.85); ink('key', ell(sx + 6, dy + 5, 2.4, 2.4, 0), 0.85);
      ink('key', key(r, crPts([[sx, dy - dr], [sx + dr, dy], [sx, dy + dr], [sx - dr, dy]], true, 1).concat([[sx, dy - dr]]), 1.2, { raw: true, ts: 0, te: 0 }), 0.9);
      const sc = smooth([[sx - 26, dy - 10], [sx - 22, dy - 22], [sx - 10, dy - 31], [sx + 10, dy - 31], [sx + 22, dy - 22], [sx + 27, dy - 10], [sx + 14, dy - 17], [sx, dy - 20], [sx - 14, dy - 17]]);
      occ(sc); ink('shadow', sc, 0.26);
      ink('key', key(r, [[sx - 26, dy - 10], [sx - 22, dy - 22], [sx - 10, dy - 31.4], [sx + 10, dy - 31.4], [sx + 22, dy - 22], [sx + 27, dy - 10]], 0.9, { brk: 0.04 }), 0.6);
    }

    /* ---- 14. the figure under the red umbrella */
    {
      const r = R('figure');
      const [fx, fy] = FIG;
      const T = (pts) => tr(pts, fx, fy, FS);
      const fclip = { clip: poly(T([[-60, -260], [60, -260], [60, -3.5], [30, -2], [10, -4.5], [-10, -3], [-30, -4], [-60, -3]])) };
      // legs and boots
      for (const lx of [[-13, -4], [3, 12]]) {
        const leg = shape(T([[lx[0], -20], [lx[1], -20], [lx[1] + 0.8, 0], [lx[0] - 0.8, 0]]), [0, 1, 2, 3]);
        occ(leg, fclip); inks([['indigo', 0.92], ['key', 0.55], ['grey', 0.2]], leg, fclip);
        ink('key', key(r, T([[lx[1] + 0.4, -20], [lx[1] + 0.8, 0]]), 1, { ts: 0, te: 0 }), 0.8, null, fclip);
      }
      // the umbrella's shaft (behind the head)
      const Rm = [fx + 30, fy - 290];
      ink('key', key(r, [[Rm[0] + 2, Rm[1] + 4], [fx + 16, fy - 150]], 2, { ts: 0, te: 0, chip: 0 }), 0.92);
      // coat
      const coatPts = [[-8, -127], [-14, -125.5], [-19.5, -122], [-22.5, -115], [-24, -104], [-25.2, -90], [-26, -76], [-26.4, -66], [-24.6, -62],
        [-24.8, -50], [-26, -36], [-27.6, -22], [-28.4, -17.5], [-14, -15.6], [0, -15], [14, -15.6], [26.5, -17.8], [25.5, -28], [23.6, -46],
        [21.6, -62], [21, -74], [23.6, -86], [26.5, -97], [24.6, -107], [20, -115], [15.5, -121], [9, -125.5], [6, -130], [-5, -131]];
      const coat = shape(T(coatPts), [12, 16]);
      occ(coat, fclip);
      ink('blue', coat, 0.72, null, fclip);
      ink('indigo', coat, 1, LG(fx - 29 * FS, 0, fx + 28 * FS, 0, [[0, 1], [0.55, 0.9], [0.82, 0.6], [1, 0.25]]), fclip);
      ink('grey', coat, 0.18, null, fclip);
      ink('key', coat, 1, LG(fx - 29 * FS, 0, fx + 8 * FS, 0, [[0, 0.32], [1, 0]]), fclip);
      // the side toward the machines takes their light
      const rim = T([[26, -22], [23.4, -46], [21.4, -62], [20.8, -74], [23.4, -86], [26.2, -97], [24.4, -107], [19.8, -115], [15, -121]]);
      const rimP = carve(r, rim, 5.5, { ts: 8, te: 10, chip: 0, sw: 0.3, off: 2 });
      wipe('indigo', rimP, 0.62, null, fclip); wipe('key', rimP, 1, null, fclip); ink('yellow', rimP, 0.5, null, fclip);
      // keyblock: contour, seam and vent, belt, folds, the arm against the body
      ink('key', key(r, T(coatPts.concat([coatPts[0]])), 1.5, { ts: 0, te: 0, chip: 0.03, brk: 0.004 }), 0.95, null, fclip);
      ink('key', key(r, T([[-1, -98], [-0.6, -60], [-0.2, -40]]), 1.2, { ts: 6, te: 2 }), 0.85, null, fclip);
      ink('key', key(r, T([[-0.2, -40], [-2.5, -15.5]]), 1.2, { ts: 2, te: 2 }), 0.85, null, fclip);
      ink('key', key(r, T([[1.2, -40], [3.5, -15.5]]), 1.2, { ts: 2, te: 2 }), 0.85, null, fclip);
      ink('key', key(r, T([[-18.5, -116], [-20, -90], [-21, -64]]), 1.2, { ts: 8, te: 8 }), 0.85, null, fclip);
      ink('key', key(r, T([[-25.6, -66.5], [-21.2, -65.2]]), 1.1, { ts: 1, te: 1 }), 0.8, null, fclip);
      ink('key', key(r, T([[-23.6, -86], [-8, -87.5], [10, -87], [22.6, -85.4]]), 1.1, { ts: 4, te: 4, brk: 0.02 }), 0.8, null, fclip);
      ink('key', key(r, T([[-23.6, -83], [-8, -84.4], [10, -84], [22.4, -82.4]]), 0.8, { ts: 4, te: 4, brk: 0.03 }), 0.55, null, fclip);
      ink('key', key(r, T([[12, -78], [14, -50], [16, -22]]), 1, { ts: 12, te: 12 }), 0.6, null, fclip);
      ink('key', key(r, T([[-12, -80], [-14, -48], [-16.5, -20]]), 1, { ts: 12, te: 12 }), 0.6, null, fclip);
      ink('key', key(r, T([[6, -60], [7.5, -36], [8.4, -20]]), 0.8, { ts: 10, te: 10 }), 0.45, null, fclip);
      ink('key', key(r, T([[18, -110], [23, -98], [24, -90]]), 0.9, { ts: 8, te: 8 }), 0.6, null, fclip);
      // scarf
      const scarf = smooth(T([[-10, -127], [-8.5, -133.5], [0, -135], [8, -133], [11.5, -127.5], [6, -124.5], [-2, -123.5]]));
      occ(scarf); inks([['yellow', 0.62], ['grey', 0.32], ['red', 0.14]], scarf);
      const tailPts = T([[-6, -125], [-9.5, -108], [-5.6, -103.5], [-2.4, -122]]);
      const tail = smooth(tailPts);
      occ(tail, fclip); inks([['yellow', 0.55], ['grey', 0.38], ['red', 0.12], ['indigo', 0.12]], tail, fclip);
      ink('key', key(r, T([[-10, -127], [-8.5, -133.5], [0, -135], [8, -133], [11.5, -127.5]]), 0.9, { ts: 2, te: 2 }), 0.75);
      ink('key', key(r, T([[-6.2, -124], [-9.6, -108], [-5.6, -103.5], [-2.4, -122]]), 0.8, { ts: 2, te: 2 }), 0.7);
      for (const fy2 of [-106, -104.6]) ink('key', key(r, T([[-9.4, fy2], [-5.8, fy2 + 1.2]]), 0.6, { ts: 0, te: 0 }), 0.6);
      // head: hair, an ear, the edge of a cheek turned toward the road
      const head = ell(fx - 3 * FS, fy - 140 * FS, 8.6 * FS, 10.4 * FS, 0.12);
      occ(head); inks([['key', 0.86], ['indigo', 0.6]], head);
      const cheek = smooth(T([[-11.3, -141], [-10.2, -134], [-7, -130.6], [-8.7, -137]]));
      occ(cheek); ink('yellow', cheek, 0.22); ink('red', cheek, 0.08);
      const ear = ell(fx - 10.4 * FS, fy - 138 * FS, 1.3 * FS, 2 * FS, 0.2);
      occ(ear); ink('yellow', ear, 0.25); ink('red', ear, 0.1); ink('key', key(r, T([[-11.2, -139.6], [-11.6, -137.4], [-10.6, -135.8]]), 0.7, { ts: 0, te: 0 }), 0.7);
      for (let i = 0; i < 4; i++) ink('indigo', key(r, T([[-6 + i * 3, -148], [-4 + i * 3.4, -138], [-3 + i * 3.6, -131]]), 0.6, { ts: 3, te: 3 }), 0.5);
      ink('yellow', key(r, T([[4, -149], [6.6, -142], [5.6, -133]]), 1.6, { ts: 3, te: 3 }), 0.35);
      // the shop bag in the left hand, a bottle from the machine inside
      ink('key', key(r, T([[-26.4, -60], [-30.5, -52.5]]), 0.8, { ts: 0, te: 0 }), 0.85);
      ink('key', key(r, T([[-25.4, -60], [-23.4, -52.5]]), 0.8, { ts: 0, te: 0 }), 0.85);
      const bagPts = T([[-33.5, -52.5], [-22.2, -52.5], [-20.4, -44], [-19.8, -36], [-22.6, -31], [-31, -30.6], [-34.6, -35.6], [-34.8, -45]]);
      const bag = smooth(bagPts);
      occ(bag); ink('shadow', bag, 0.18); ink('grey', bag, 0.05);
      ink('blue', rect(fx - 35 * FS, fy - 46.6 * FS, 16 * FS, 2 * FS), 0.42, null, { clip: bag });
      ink('blue', shape(T([[-30, -32], [-30, -43], [-28.6, -46], [-26.8, -46], [-25.4, -43], [-25.4, -32]]), [0, 5]), 0.18, null, { clip: bag });
      ink('shadow', bag, 1, LG(fx - 35 * FS, 0, fx - 20 * FS, 0, [[0, 0.25], [1, 0]]));
      ink('key', key(r, bagPts.concat([bagPts[0]]), 0.9, { ts: 0, te: 0, chip: 0.05 }), 0.85);
      ink('key', key(r, T([[-28, -50], [-27, -41], [-28.6, -33]]), 0.6, { ts: 3, te: 3 }), 0.45);
      const hand = ell(fx - 25.8 * FS, fy - 60 * FS, 2.5 * FS, 3 * FS, 0.2);
      occ(hand); ink('yellow', hand, 0.25); ink('red', hand, 0.08);
      ink('key', key(r, T([[-28.2, -62], [-28.6, -58.4], [-25.6, -57], [-23.4, -59.4]]), 0.8, { ts: 0, te: 0 }), 0.75);

      // the umbrella: held up, the rim just above our eye, so we see its warm-lit underside
      const th = -0.09, cth = Math.cos(th), sth = Math.sin(th);
      const P = (u, v) => [Rm[0] + u * cth + v * sth, Rm[1] + u * sth - v * cth];
      const rx = 76, ryr = 15, H = 52, lean = -10;
      const ribs = 8, a0 = 0.18 + r() * 0.3;
      const tipA = [];
      for (let i = 0; i < ribs; i++) tipA.push(a0 + (i * TAU) / ribs);
      const rimPt = (a, s) => P(rx * Math.cos(a) * (s || 1), ryr * Math.sin(a) * (s || 1));
      // underside: the opening, scalloped between rib tips
      const under = new Path2D();
      const rimLoop = [];
      for (let i = 0; i < ribs; i++) {
        const a1 = tipA[i], a2 = tipA[(i + 1) % ribs] + (i === ribs - 1 ? TAU : 0);
        for (let j = 0; j < 8; j++) {
          const t = j / 8, a = a1 + (a2 - a1) * t;
          rimLoop.push(rimPt(a, 1 - 0.035 * Math.sin(Math.PI * t)));
        }
      }
      poly(rimLoop, true, under);
      // dome: from the left rim end over the crown to the right rim end, back along the near rim
      const dome = [];
      for (let i = 0; i <= 24; i++) {
        const t = i / 24, u = -rx + 2 * rx * t;
        const f = Math.max(0, 1 - Math.pow(Math.abs(u - lean * (1 - Math.abs(u) / rx)) / rx, 2));
        dome.push(P(u, H * Math.pow(f, 0.62)));
      }
      for (let i = 24; i >= 0; i--) {
        const t = i / 24, a = Math.PI * t;
        const sc = 1 - 0.04 * Math.abs(Math.sin(a * 4 + a0 * 4));
        dome.push(P(rx * Math.cos(a) * sc, ryr * Math.sin(a) * sc));
      }
      const domeP = poly(dome);
      occ(under); occ(domeP);
      ink('red', under, 0.85);
      ink('indigo', under, 1, LG(Rm[0] - rx, 0, Rm[0] + rx, 0, [[0, 0.4], [0.5, 0.2], [1, 0]]));
      ink('yellow', under, 1, LG(Rm[0] - rx * 0.2, 0, Rm[0] + rx, 0, [[0, 0], [1, 0.62]]));
      // underside ribs run up toward the hidden crown
      for (let i = 0; i < ribs; i++) {
        const a = tipA[i];
        if (Math.sin(a) > 0) continue;
        ink('key', key(r, [rimPt(a), P(lean * 0.3, ryr * 0.6)], 0.8, { ts: 0, te: 4, chip: 0.02 }), 0.75, null, { clip: under });
      }
      ink('red', domeP, 0.93);
      ink('indigo', domeP, 1, LG(Rm[0] - rx, Rm[1] - H, Rm[0] + rx, Rm[1], [[0, 0.36], [0.5, 0.14], [1, 0]]));
      ink('yellow', domeP, 1, LG(Rm[0] + rx * 0.2, 0, Rm[0] + rx, 0, [[0, 0], [1, 0.22]]));
      // dome ribs: curves from the crown to the near rim tips
      const crown = P(lean, H);
      for (let i = 0; i < ribs; i++) {
        const a = tipA[i];
        if (Math.sin(a) < 0) continue;
        const tip = rimPt(a);
        const mid = P(rx * Math.cos(a) * 0.62 + lean * 0.4, H * 0.7 + ryr * 0.3);
        ink('key', key(r, [crown, mid, tip], 0.85, { ts: 2, te: 4, chip: 0.03 }), 0.75);
        if (i % 2) ink('red', poly([crown, mid, tip, rimPt(tipA[(i + 1) % ribs]), P(rx * Math.cos(tipA[(i + 1) % ribs]) * 0.62 + lean * 0.4, H * 0.7 + ryr * 0.3)]), 0.2, null, { clip: domeP });
      }
      ink('key', key(r, rimLoop.concat([rimLoop[0]]), 1.1, { raw: true, ts: 0, te: 0, chip: 0.04 }), 0.9);
      ink('key', key(r, dome.slice(0, 25), 1.4, { raw: true, ts: 0, te: 0, chip: 0.03 }), 0.95);
      const fer = P(lean, H + 7);
      ink('key', key(r, [crown, fer], 1.8, { ts: 0, te: 2, chip: 0 }), 0.95);
      // snow lying on the crown of the umbrella
      const sl = [];
      for (let i = 0; i <= 14; i++) {
        const t = i / 14, u = -rx * 1.05 + 2.1 * rx * t;
        sl.push(P(u, H * 0.42 + Math.sin(t * Math.PI) * H * 0.18 + (r() - 0.5) * 4 - Math.abs(u) / rx * 6));
      }
      const snowTop = poly(sl.concat([P(rx * 1.3, H * 2), P(-rx * 1.3, H * 2)]));
      const domeBig = poly(dome.slice(0, 25).map((q, i) => (i === 0 || i === 24 ? q : [q[0], q[1] - 3.5])).concat([P(rx, ryr * 0.3), P(-rx, ryr * 0.3)]));
      occ(snowTop, { clip: domeBig });
      ink('shadow', snowTop, 1, LG(0, Rm[1] - H - 4, 0, Rm[1] - H * 0.4, [[0, 0.12], [1, 0.34]]), { clip: domeBig });
      ink('key', key(r, sl, 1, { raw: true, ts: 2, te: 2, chip: 0.05, brk: 0.02 }), 0.55, null, { clip: domeBig });
      ink('key', key(r, dome.slice(2, 23).map((q) => [q[0], q[1] - 3.2]), 1.1, { raw: true, ts: 3, te: 3, chip: 0.04 }), 0.75);
    }

    /* ---- 15. the cat, in the light, looking up at the figure */
    {
      const r = R('cat');
      const [cx, cy] = CAT;
      const T = (pts) => tr(pts, cx, cy, CS);
      const outline = [[-12.4, -28.2], [-11.6, -30.6], [-9.2, -32.6], [-8.8, -38.6], [-4.8, -33.6], [-1.4, -33.6], [1.6, -37.6], [3.4, -31], [5, -28], [6.4, -23],
        [9, -18], [11.6, -12], [12.6, -6], [11.6, -1.6], [8, 0], [-2, 0.4], [-8, 0], [-10.5, -1], [-10, -4], [-10.6, -10], [-11, -16], [-9.6, -21.4], [-10.6, -24.6], [-12.6, -26.2]];
      const pts = T(outline);
      const body = shape(pts, [3, 6, 0]);
      const tailLine = T([[10, -1.4], [7, 1.4], [0, 2.4], [-7, 2], [-11, 0.6], [-13.8, -2]]);
      const tail = carve(r, tailLine, 3.2 * CS, { ts: 0, te: 8 * CS, tmin: 0.3, chip: 0, sw: 0.1 });
      for (const p of [body, tail]) { occ(p); inks([['grey', 0.5], ['indigo', 0.95], ['key', 0.6]], p); }
      const rim = carve(r, T([[1.8, -36.4], [3.8, -31], [5.3, -27], [6.8, -22], [9.4, -17], [11.9, -11], [12.7, -5.5]]), 1.5 * CS, { ts: 4, te: 8, chip: 0, off: 0.5 * CS });
      wipe('key', rim, 0.95); wipe('indigo', rim, 0.6); ink('yellow', rim, 0.55);
      const earIn = poly(T([[-8.6, -37], [-6.4, -33.6], [-8.8, -33.2]]));
      occ(earIn); ink('red', earIn, 0.25); ink('yellow', earIn, 0.3); ink('indigo', earIn, 0.4);
      ink('key', key(r, pts.concat([pts[0]]), 1.3, { raw: false, ts: 0, te: 0, chip: 0.03 }), 0.9);
      ink('key', key(r, T([[-10.4, -2], [-10.6, -9], [-11, -15]]), 0.9, { ts: 2, te: 4 }), 0.5);
      ink('key', key(r, T([[-6.8, -1], [-7, -8]]), 0.8, { ts: 2, te: 4 }), 0.4);
      const eye = ell(cx - 7.8 * CS, cy - 29 * CS, 1.1 * CS, 0.75 * CS, -0.3);
      occ(eye); ink('yellow', eye, 0.9);
      ink('key', ell(cx - 8.1 * CS, cy - 29 * CS, 0.32 * CS, 0.6 * CS, 0), 0.9);
      for (const wy of [-26.4, -25.2]) ink('shadow', key(r, T([[-11.4, wy], [-16, wy - 1.4 + (wy + 26) * 2]]), 0.5, { ts: 0, te: 3 }), 0.6);
      // its shadow, thrown toward us
      const sh = smooth(T([[-9, 0.6], [9, 0.8], [6, 6], [-6, 12], [-18, 15], [-22, 12], [-16, 6]]));
      ink('shadow', sh, 1, LG(cx, cy, cx - 20 * CS, cy + 14 * CS, [[0, 0.6], [1, 0.1]]));
      ink('grey', sh, 0.18); wipe('yellow', sh, 0.7);
    }

    /* ---- 16. dry grasses in the bank, lower right */
    {
      const r = R('grass');
      for (const tf of [[958, 1512, 8], [900, 1516, 5]]) {
        for (let i = 0; i < tf[2]; i++) {
          const x = tf[0] + (r() - 0.5) * 60, y = tf[1];
          const h = 60 + r() * 150, lean = (r() - 0.65) * 70, bend = (r() - 0.3) * 40;
          const pts = [[x, y], [x + lean * 0.3, y - h * 0.45], [x + lean * 0.8 + bend * 0.3, y - h * 0.85], [x + lean + bend, y - h + Math.abs(bend) * 0.4]];
          const st = carve(r, pts, 2.8 + r() * 1.6, { ts: 0, te: 34, tmin: 0.15, chip: 0.04, brk: 0.004 });
          occ(st); inks([['brown', 0.7], ['key', 0.65], ['indigo', 0.2]], st);
          const tip = pts[3];
          if (r() < 0.55) {
            const plume = blob(r, tip[0] - (lean + bend) * 0.05, tip[1] + 10, 4, 13, 8, 0.25, Math.atan2(lean + bend, h) * 0.6);
            occ(plume); inks([['brown', 0.45], ['yellow', 0.3], ['key', 0.15]], plume);
          }
          if (r() < 0.7) {
            const q = pts[1 + ((r() * 2) | 0)];
            const sb = blob(r, q[0] + 2, q[1] - 2, 5 + r() * 5, 2.4 + r() * 2, 8, 0.25);
            occ(sb); ink('shadow', sb, 0.3);
          }
        }
      }
    }

    /* ---- 17. falling snow: gofun, printed last; warm inside the light, cool outside; denser and larger toward us */
    const cart = { x: 28, y: 28, w: 64, h: 236 };
    {
      const r = R('flakes');
      const cool = [new Path2D(), new Path2D(), new Path2D()], warm = [new Path2D(), new Path2D(), new Path2D()];
      const drift = 0.32 + r() * 0.12; // radians off vertical
      const n = 520 + ((r() * 240) | 0);
      const avoid = [[CAT[0] - 22, CAT[1] - 80, 22]];
      const place = (x, y, rad, alphaBucket, soft) => {
        if (x > cart.x - 6 && x < cart.x + cart.w + 6 && y > cart.y - 6 && y < cart.y + cart.h + 6) return;
        for (const a of avoid) if (Math.hypot(x - a[0], y - a[1]) < a[2] + rad) return;
        const dx = (x - LIGHT[0]) / 420, dy = (y - LIGHT[1] + 60) / 360;
        const near = 1 - Math.sqrt(dx * dx + dy * dy);
        const W = near > 0 && r() < Math.pow(near, 0.6) * 1.2;
        const set = W ? warm : cool;
        const rot = -drift + (r() - 0.5) * 0.4;
        if (soft) {
          blob(r, x, y, rad * 0.86, rad * 1.12, 9, 0.2, rot, set[2]);
          blob(r, x, y, rad * 0.7, rad * 0.92, 8, 0.2, rot, set[1]);
          blob(r, x + (r() - 0.5) * rad * 0.2, y, rad * 0.48, rad * 0.62, 8, 0.2, rot, set[0]);
        } else blob(r, x, y, rad * 0.85, rad * (1.05 + r() * 0.2), 7, 0.24, rot, set[alphaBucket]);
      };
      for (let i = 0; i < n; i++) {
        // density and size grow toward the foreground
        const y = IH * Math.sqrt(r());
        const x = r() * IW;
        const depth = y / IH;
        const rad = (1.1 + 3.4 * depth) * (0.6 + 1.6 * Math.pow(r(), 3.2));
        place(x, y, rad, r() < 0.6 ? 0 : r() < 0.7 ? 1 : 2, false);
      }
      for (let i = 0; i < 9; i++) place(r() * IW, IH * (0.62 + r() * 0.36), 9 + r() * 9, 0, true);
      ink('gofun', cool[0], 0.95); ink('gofun', cool[1], 0.62); ink('gofun', cool[2], 0.32);
      ink('gofunw', warm[0], 0.95); ink('gofunw', warm[1], 0.62); ink('gofunw', warm[2], 0.32);
    }

    /* ---- 18. the title cartouche */
    {
      const r = R('cartouche');
      const c = cart;
      const box = rect(c.x, c.y, c.w, c.h);
      occ(box);
      ink('yellow', box, 0.24); ink('grey', box, 0.1); ink('shadow', box, 0.06);
      const o = [[c.x, c.y], [c.x + c.w, c.y], [c.x + c.w, c.y + c.h], [c.x, c.y + c.h], [c.x, c.y]];
      ink('key', key(r, o, 2.4, { raw: true, ts: 0, te: 0, chip: 0.03 }), 0.95);
      const i4 = 5.2;
      ink('key', key(r, [[c.x + i4, c.y + i4], [c.x + c.w - i4, c.y + i4], [c.x + c.w - i4, c.y + c.h - i4], [c.x + i4, c.y + c.h - i4], [c.x + i4, c.y + i4]], 0.9, { raw: true, ts: 0, te: 0, chip: 0.03 }), 0.85);
      const title = ['宝', '来', '辻', 'の', '夜', '雪'];
      const gs = 34, gx = c.x + (c.w - gs) / 2;
      title.forEach((ch, i) => ink('key', glyph(r, ch, gx, c.y + 14 + i * 35, gs, 3.1), 0.95));
    }

    /* ---- 19. signature and artist's seal, lower left inside the block */
    {
      const r = R('signature');
      ink('key', glyph(r, '冬', 16, 1372, 24, 2.3, { jit: 3 }), 0.92);
      ink('key', glyph(r, '水', 17, 1398, 24, 2.3, { jit: 3 }), 0.92);
      const seal = rect(17, 1428, 22, 22);
      ink('seal', seal, 0.95);
      wipe('seal', glyph(r, '冬', 28.2, 1430.5, 10, 1.7, { jit: 4 }), 0.95);
      wipe('seal', glyph(r, '水', 18, 1438.5, 10, 1.7, { jit: 4 }), 0.95);
      wipe('seal', key(r, [[17, 1428], [39, 1428], [39, 1450], [17, 1450], [17, 1428]], 1.2, { raw: true, ts: 0, te: 0, chip: 0.3 }), 0.9, null, { clip: seal });
    }

    /* ---- margin: publisher's seal, kento, the impression number, paper flecks */
    const F = { free: true };
    {
      const r = R('margin');
      const ps = [36, 1572];
      const ring = new Path2D(); ring.arc(ps[0], ps[1], 18.5, 0, TAU); ring.arc(ps[0], ps[1], 15.2, 0, TAU, true);
      ink('seal', ring, 0.92, null, F);
      const inner = new Path2D();
      glyph(r, '宝', ps[0] - 12, ps[1] - 12, 11.5, 1.9, { jit: 3 }, inner);
      glyph(r, '来', ps[0] + 0.5, ps[1] - 12, 11.5, 1.9, { jit: 3 }, inner);
      glyph(r, '冬', ps[0] - 12, ps[1] + 0.5, 11.5, 1.9, { jit: 3 }, inner);
      glyph(r, '水', ps[0] + 0.5, ps[1] + 0.5, 11.5, 1.9, { jit: 3 }, inner);
      ink('seal', inner, 0.9, null, F);
      ink('shadow', key(r, [[1010, 1626], [1040, 1626], [1040, 1598]], 2.4, { raw: true, ts: 0, te: 0, chip: 0.1, brk: 0.03 }), 0.16, null, F);
      ink('shadow', key(r, [[300, 1626], [348, 1626]], 2.4, { ts: 0, te: 0, chip: 0.1, brk: 0.03 }), 0.14, null, F);
      const num = String(1 + (seed % 200)) + '/200';
      const dh = 15, dw = 9.6, gap = 3.4;
      let x = IW - 4 - num.length * (dw + gap);
      const pen = new Path2D();
      for (const ch of num) {
        const d = DIGITS[ch];
        if (d) carve(r, d.map((p) => [x + p[0] * dw / 10 + (r() - 0.5) * 0.3, 1566 + p[1] * dh / 16 + (r() - 0.5) * 0.3]), 1.1, { ts: 1.5, te: 2.5, tmin: 0.4, sw: 0.25, chip: 0.05, step: 0.5 }, pen);
        x += dw + gap;
      }
      ink('pencil', pen, 0.95, null, F);
      const fl = new Path2D();
      for (let i = 0; i < 70; i++) {
        const x2 = -ML + r() * SW, y2 = -MT + r() * SH;
        if (r() < 0.7) blob(r, x2, y2, 0.5 + r() * 0.9, 0.4 + r() * 0.6, 6, 0.3, r() * TAU, fl);
        else carve(r, [[x2, y2], [x2 + (r() - 0.5) * 12, y2 + (r() - 0.5) * 12], [x2 + (r() - 0.5) * 18, y2 + (r() - 0.5) * 18]], 0.45, { chip: 0, step: 0.4 }, fl);
      }
      ink('fleck', fl, 0.55, null, F);
    }
    return ops;
  }

  // relief: the block area pressed down, the snow on the roofs blind-printed up (karazuri), the kento
  function buildRelief(seed) {
    const ops = [];
    const F = { free: true };
    const r = mulberry32(hashStr(seed, 'relief'));
    ops.push(Object.assign({ p: 'relief', path: rect(-ML - 10, -MT - 10, SW + 20, SH + 20), a: 1 }, F));
    ops.push(Object.assign({ p: 'relief', path: rect(0, 0, IW, IH), a: 0.45, erase: true }, F));
    const up = (path, a) => ops.push(Object.assign({ p: 'relief', path, a }, F));
    up(smooth([[836, 774], [834, 758], [846, 744], [870, 734], [910, 726], [960, 722], [1020, 724], [1020, 778], [950, 779], [870, 779], [848, 780]]), 0.55);
    up(smooth([[452, 846], [450, 832], [462, 822], [560, 815], [660, 812], [780, 811], [852, 826], [848, 840], [480, 841]]), 0.55);
    up(blob(r, 143, 840.8, 42, 3, 16, 0.12), 0.5);
    ops.push(Object.assign({ p: 'relief', path: carve(r, [[1010, 1626], [1040, 1626], [1040, 1598]], 3, { raw: true, ts: 0, te: 0, chip: 0 }), a: 0.6, erase: true }, F));
    ops.push(Object.assign({ p: 'relief', path: carve(r, [[300, 1626], [348, 1626]], 3, { ts: 0, te: 0, chip: 0 }), a: 0.6, erase: true }, F));
    return ops;
  }

  /* ---------------------------------------------------------------- printing */
  function grad(ctx, s) {
    const g = s.lin ? ctx.createLinearGradient(s.lin[0], s.lin[1], s.lin[2], s.lin[3])
      : ctx.createRadialGradient(s.rad[0], s.rad[1], s.rad[2], s.rad[3], s.rad[4], s.rad[5]);
    for (const st of s.stops) g.addColorStop(st[0], 'rgba(0,0,0,' + clamp(st[1], 0, 1).toFixed(4) + ')');
    return g;
  }
  function drawPlate(ctx, P, ops, k, ox, oy, W, H) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.clearRect(0, 0, W, H);
    const bx = (ML + ox) * k, by = (MT + oy) * k;
    ctx.save();
    ctx.setTransform(k, 0, 0, k, bx, by);
    ctx.beginPath(); ctx.rect(0, 0, IW, IH); ctx.clip();
    let clipped = true;
    for (let i = 0; i < ops.length; i++) {
      const op = ops[i];
      if (op.free && clipped) { ctx.restore(); ctx.save(); clipped = false; }
      if (op.t === 'occ') {
        if (op.only && op.only.indexOf(P) < 0) continue;
        if (op.except && op.except.indexOf(P) >= 0) continue;
        ctx.globalCompositeOperation = 'destination-out';
      } else {
        if (op.p !== P) continue;
        ctx.globalCompositeOperation = op.erase ? 'destination-out' : 'source-over';
      }
      ctx.setTransform(k, 0, 0, k, bx, by);
      if (op.clip) { ctx.save(); ctx.clip(op.clip); }
      if (op.m) ctx.transform(op.m[0], op.m[1], op.m[2], op.m[3], op.m[4], op.m[5]);
      ctx.globalAlpha = op.a;
      ctx.fillStyle = op.s ? grad(ctx, op.s) : '#000';
      ctx.fill(op.path);
      if (op.clip) ctx.restore();
    }
    ctx.restore();
  }

  function valueNoise(W, H, cell, r) {
    const gw = Math.ceil(W / cell) + 2, gh = Math.ceil(H / cell) + 2;
    const g = new Float32Array(gw * gh);
    for (let i = 0; i < g.length; i++) g[i] = r();
    const out = new Float32Array(W * H), inv = 1 / cell;
    const txs = new Float32Array(W), ixs = new Int32Array(W);
    for (let x = 0; x < W; x++) { const fx = x * inv, ix = fx | 0; let t = fx - ix; t = t * t * (3 - 2 * t); txs[x] = t; ixs[x] = ix; }
    for (let y = 0; y < H; y++) {
      const fy = y * inv, iy = fy | 0; let ty = fy - iy; ty = ty * ty * (3 - 2 * ty);
      const r0 = iy * gw, r1 = r0 + gw, o = y * W;
      for (let x = 0; x < W; x++) {
        const ix = ixs[x], tx = txs[x];
        const a = g[r0 + ix], b = g[r0 + ix + 1], c = g[r1 + ix], d = g[r1 + ix + 1];
        out[o + x] = a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty;
      }
    }
    return out;
  }
  function toU8(f, contrast, f2, w2) {
    const n = f.length, out = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
      let v = f2 ? f[i] * (1 - w2) + f2[i] * w2 : f[i];
      v = 0.5 + (v - 0.5) * contrast;
      out[i] = v <= 0 ? 0 : v >= 1 ? 255 : (v * 255) | 0;
    }
    return out;
  }
  function blurU8(src, W, H, r) {
    if (r < 1) return src.slice();
    const tmp = new Uint8Array(src.length), out = new Uint8Array(src.length), d = 2 * r + 1, inv = 1 / d;
    for (let y = 0; y < H; y++) {
      const o = y * W; let s = 0;
      for (let x = -r; x <= r; x++) s += src[o + clamp(x, 0, W - 1)];
      for (let x = 0; x < W; x++) {
        tmp[o + x] = (s * inv) | 0;
        s += src[o + Math.min(W - 1, x + r + 1)] - src[o + Math.max(0, x - r)];
      }
    }
    for (let x = 0; x < W; x++) {
      let s = 0;
      for (let y = -r; y <= r; y++) s += tmp[clamp(y, 0, H - 1) * W + x];
      for (let y = 0; y < H; y++) {
        out[y * W + x] = (s * inv) | 0;
        s += tmp[Math.min(H - 1, y + r + 1) * W + x] - tmp[Math.max(0, y - r) * W + x];
      }
    }
    return out;
  }

  const SIN = new Float32Array(1024);
  for (let i = 0; i < 1024; i++) SIN[i] = 0.5 + 0.5 * Math.sin((i / 1024) * TAU);

  // Pull one impression: returns a canvas of the whole sheet (throws 'cancelled' if the viewer left).
  async function pull(seed, Wp, Hp, alive, proof) {
    const k = Wp / SW, N = Wp * Hp;
    let t0 = performance.now();
    const breathe = async () => {
      if (performance.now() - t0 > 20) {
        await new Promise((res) => setTimeout(res, 0));
        t0 = performance.now();
        if (!alive()) throw new Error('cancelled');
      }
    };
    const rr = mulberry32(hashStr(seed, 'paper'));
    const ops = buildScene(seed, k).concat(buildRelief(seed));
    await breathe();

    // --- the paper's tooth (shared by every block), baren mottle (half res), cloud (quarter res)
    const T = new Float32Array(N);
    {
      const raw = new Uint8Array(N);
      for (let i = 0; i < N; i++) raw[i] = (rr() * 256) | 0;
      const b = blurU8(raw, Wp, Hp, 1);
      for (let i = 0; i < N; i++) { const v = (b[i] - 128) * (2.6 / 255); T[i] = v < -0.5 ? -0.5 : v > 0.5 ? 0.5 : v; }
    }
    await breathe();
    const Mw = (Wp >> 1) + 1, Mh = (Hp >> 1) + 1;
    const mPx = Math.max(1.25, 1.3 * k);
    const M = toU8(valueNoise(Mw, Mh, mPx * 2.2, rr), 1.8, valueNoise(Mw, Mh, mPx * 6, rr), 0.5);
    await breathe();
    const Lw = (Wp >> 2) + 1, Lh = (Hp >> 2) + 1;
    const L = toU8(valueNoise(Lw, Lh, 17.5 * k, rr), 1.7, valueNoise(Lw, Lh, 52 * k, rr), 0.5);
    await breathe();

    // --- kozo fibres
    const work = document.createElement('canvas');
    work.width = Wp; work.height = Hp;
    const ctx = work.getContext('2d', { willReadFrequently: true });
    ctx.lineCap = 'round';
    const nf = Math.round((SW * SH) / 900);
    for (let i = 0; i < nf; i++) {
      const x = rr() * Wp, y = rr() * Hp, len = (8 + Math.pow(rr(), 2) * 55) * k, a = rr() * TAU, bend = (rr() - 0.5) * len * 0.7;
      ctx.strokeStyle = 'rgba(255,255,255,' + (0.25 + rr() * 0.6).toFixed(3) + ')';
      ctx.lineWidth = Math.max(0.6, (0.25 + rr() * 0.5) * k * 1.6);
      ctx.beginPath(); ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + Math.cos(a) * len * 0.5 - Math.sin(a) * bend, y + Math.sin(a) * len * 0.5 + Math.cos(a) * bend, x + Math.cos(a) * len, y + Math.sin(a) * len);
      ctx.stroke();
    }
    const Fib = new Float32Array(N);
    { const d = ctx.getImageData(0, 0, Wp, Hp).data; for (let i = 0; i < N; i++) Fib[i] = d[i * 4 + 3] / 255; }
    await breathe();

    // --- paper
    const O = new Float32Array(N * 3);
    for (let y = 0; y < Hp; y++) {
      const rl = (y >> 2) * Lw, rm = (y >> 1) * Mw;
      for (let x = 0; x < Wp; x++) {
        const i = y * Wp + x, j = i * 3;
        const cl = 1 + 0.03 * (L[rl + (x >> 2)] / 255 - 0.5) + 0.008 * (M[rm + (x >> 1)] / 255 - 0.5);
        const f = Fib[i] * 5;
        O[j] = 241 * cl + f; O[j + 1] = 235 * cl + f; O[j + 2] = 220 * cl + f * 0.9;
      }
    }
    await breathe();

    const pr = mulberry32(hashStr(seed, 'press'));
    // how hard the printer leaned on the baren for this impression
    // (paper tooth finer than a pixel averages away on small renders)
    const press = (0.8 + pr() * 0.4) * (proof ? 0.5 : 1) * clamp(k * 1.6, 0.45, 1);
    let Relief = null;
    const plates = ORDER.concat(['relief']);
    const rowX0 = new Int32Array(Hp), rowX1 = new Int32Array(Hp);
    for (const P of plates) {
      const ink = INKS[P] || {};
      let ox = ink.reg ? (pr() - 0.5) * 2 * ink.reg : 0, oy = ink.reg ? (pr() - 0.5) * 2 * ink.reg : 0;
      if (ink.big) { const a = pr() * TAU; ox = Math.cos(a) * ink.reg; oy = Math.sin(a) * ink.reg; } // this block slipped on the kento
      drawPlate(ctx, P, ops, k, ox, oy, Wp, Hp);
      await breathe();
      const A = new Uint8Array(N);
      { const d = ctx.getImageData(0, 0, Wp, Hp).data; for (let i = 0; i < N; i++) A[i] = d[i * 4 + 3]; }
      await breathe();
      if (P === 'relief') { Relief = blurU8(blurU8(A, Wp, Hp, Math.max(1, Math.round(1.6 * k))), Wp, Hp, 1); break; }
      const br = Math.max(1, Math.round(1.3 * k));
      const pad = 2 * br + 2;
      // per-row extents of the inked area (padded for pooling and bleed)
      let any = false;
      for (let y = 0; y < Hp; y++) {
        const o = y * Wp; let a0 = -1, a1 = -1;
        for (let x = 0; x < Wp; x++) if (A[o + x]) { a0 = x; break; }
        if (a0 >= 0) { for (let x = Wp - 1; x >= a0; x--) if (A[o + x]) { a1 = x; break; } }
        rowX0[y] = a0; rowX1[y] = a1;
        if (a0 >= 0) any = true;
      }
      if (!any) continue;
      // grow the extents vertically and horizontally by the pad
      const gx0 = new Int32Array(Hp).fill(-1), gx1 = new Int32Array(Hp).fill(-1);
      for (let y = 0; y < Hp; y++) {
        if (rowX0[y] < 0) continue;
        const lo = Math.max(0, rowX0[y] - pad), hi = Math.min(Wp - 1, rowX1[y] + pad);
        for (let yy = Math.max(0, y - pad); yy <= Math.min(Hp - 1, y + pad); yy++) {
          if (gx0[yy] < 0 || lo < gx0[yy]) gx0[yy] = lo;
          if (hi > gx1[yy]) gx1[yy] = hi;
        }
      }
      const Bl = ink.pool ? blurU8(blurU8(A, Wp, Hp, br), Wp, Hp, br) : null;
      await breathe();

      const kr = 1 - ink.col[0] / 255, kg = 1 - ink.col[1] / 255, kb = 1 - ink.col[2] / 255;
      const c0 = ink.col[0], c1 = ink.col[1], c2 = ink.col[2];
      const load = 0.95 + pr() * 0.09;
      const oxM = (pr() * Mw) | 0, oyM = (pr() * Mh) | 0, oxL = (pr() * Lw) | 0, oyL = (pr() * Lh) | 0;
      const gAng = (pr() - 0.5) * 0.1, gSpace = (7 + pr() * 7) * k;
      const ga = (Math.cos(gAng) / gSpace) * 1024, gb = (Math.sin(gAng) / gSpace) * 1024;
      const gWarp = 1024 * (2.5 + pr() * 2.5) / 255, gWarp2 = 1024 * 0.25 / 255;
      const goma2 = (ink.goma || 0) * 2 * press, mott2 = (ink.mott || 0) * 2 / 255, grain = ink.grain || 0, wipe2 = (ink.wipe || 0) * 2 / 255;
      const pool = (ink.pool || 0) / 255, fib = ink.fib || 0;
      const opaque = !!ink.opaque, pencil = !!ink.pencil;
      const bleed = P === 'key' || opaque || pencil ? 0 : 0.07 / 255;
      for (let y = 0; y < Hp; y++) {
        const xa = gx0[y], xb = gx1[y];
        if (xa < 0) continue;
        const rowM = ((((y >> 1) + oyM) % Mh) * Mw), rowL = ((((y >> 2) + oyL) % Lh) * Lw);
        const gy = y * ga;
        for (let x = xa; x <= xb; x++) {
          const i = y * Wp + x;
          const av = A[i];
          let d;
          if (Bl) {
            const bv = Bl[i];
            if ((av | bv) === 0) continue;
            d = av / 255;
            const e = av - bv;
            if (e > 0) d += pool * e * (0.6 + 0.4 * d);
            else if (av < 8) d += bleed * bv;
          } else {
            if (av === 0) continue;
            d = av / 255;
          }
          if (pencil) {
            d *= T[i] > -0.08 ? 0.9 : 0.25;
          } else {
            let xm = (x >> 1) + oxM; if (xm >= Mw) xm -= Mw;
            let xl = (x >> 2) + oxL; if (xl >= Lw) xl -= Lw;
            const mm = M[rowM + xm] - 127.5, ll = L[rowL + xl] - 127.5;
            let f = 1 + goma2 * T[i] * (1.2 - 0.4 * d) + mott2 * mm + wipe2 * ll * (1 - d * 0.5);
            if (grain) {
              const v = SIN[((x * gb + gy + ll * gWarp + mm * gWarp2) | 0) & 1023];
              const v2 = v * v, v4 = v2 * v2;
              const gm = ll * 0.012 + 0.45;
              if (gm > 0) f += grain * gm * (v4 * v4 * 2.4 - 0.27 + (v - 0.5) * 0.3);
            }
            d *= load * f * (1 - fib * Fib[i]);
          }
          if (d <= 0) continue;
          if (d > 1) d = 1;
          const j = i * 3;
          if (opaque) {
            O[j] += (c0 - O[j]) * d; O[j + 1] += (c1 - O[j + 1]) * d; O[j + 2] += (c2 - O[j + 2]) * d;
          } else {
            O[j] *= 1 - d * kr; O[j + 1] *= 1 - d * kg; O[j + 2] *= 1 - d * kb;
          }
        }
        if ((y & 15) === 0) await breathe();
      }
    }

    // --- relief lighting, and out
    const img = ctx.createImageData(Wp, Hp);
    const D = img.data;
    const emb = 0.0011, toothRel = (proof ? 0.025 : 0.055) * clamp(k * 1.6, 0.45, 1);
    for (let y = 0; y < Hp; y++) {
      for (let x = 0; x < Wp; x++) {
        const i = y * Wp + x, j = i * 3, q = i * 4;
        let s = 1;
        if (x > 0 && y > 0 && x < Wp - 1 && y < Hp - 1) {
          if (Relief) s += (Relief[i - Wp - 1] - Relief[i + Wp + 1]) * emb;
          s += (T[i - Wp] - T[i + Wp]) * toothRel;
        }
        D[q] = O[j] * s; D[q + 1] = O[j + 1] * s; D[q + 2] = O[j + 2] * s; D[q + 3] = 255;
      }
      if ((y & 31) === 0) await breathe();
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.putImageData(img, 0, 0);
    return work;
  }

  /* ---------------------------------------------------------------- the room */
  (window.PIECES = window.PIECES || []).push({
    id: 'snow',
    title: 'Night Snow at Hōrai Crossing',
    medium: 'Colour woodblock print, eight blocks with bokashi, on washi',
    note: 'Each visit is a new impression.',
    about: 'A shin-hanga print in the manner of the 1930s Watanabe workshop, pulled afresh at every visit: keyblock, colour blocks, baren, bokashi and registration are simulated, so no two impressions agree. Its subject is today — a snowed-in bus stop, three vending machines, a figure under a red umbrella and a cat who watches.',
    tone: 'dark',
    room: ROOM,
    mount(el, api) {
      const cv = document.createElement('canvas');
      cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block';
      el.style.background = ROOM;
      el.appendChild(cv);
      const g = cv.getContext('2d');
      let dead = false, sheet = null, sheetPx = 0, busy = false, again = false, timer = 0, readyDone = false;
      const seed = api.seed >>> 0;

      // wall plaster, seeded
      const wallTex = document.createElement('canvas');
      wallTex.width = wallTex.height = 256;
      {
        const r = mulberry32(hashStr(seed, 'wall'));
        const wx = wallTex.getContext('2d'), id = wx.createImageData(256, 256);
        const vn = valueNoise(256, 256, 24, r), vf = valueNoise(256, 256, 5, r);
        for (let i = 0; i < 256 * 256; i++) {
          const v = 128 + (vn[i] - 0.5) * 70 + (vf[i] - 0.5) * 40 + (r() - 0.5) * 22;
          id.data[i * 4] = id.data[i * 4 + 1] = id.data[i * 4 + 2] = v; id.data[i * 4 + 3] = 255;
        }
        wx.putImageData(id, 0, 0);
      }

      function layout() {
        const W = Math.max(1, el.clientWidth), H = Math.max(1, el.clientHeight);
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        const gut = Math.max(16, Math.min(W, H) * 0.045);
        const asp = SW / SH;
        let sh = Math.min(H * 0.92, (W - 2 * gut) / asp);
        if (W < 600) sh = Math.min(H - 2 * gut - 40, (W - 2 * gut) / asp);
        const sw = sh * asp;
        return { W, H, dpr, sw, sh, sx: (W - sw) / 2, sy: (H - sh) / 2 - Math.min(H * 0.008, 8) };
      }
      function wantPx(Lo) {
        const w = Math.round(Lo.sw * Lo.dpr);
        const maxW = Math.floor(Math.sqrt((1.5e6 * SW) / SH));
        return clamp(w, 280, maxW);
      }
      let fadeFrom = null, fadeT0 = 0, raf = 0;
      function paint() {
        const Lo = layout();
        const cw = Math.round(Lo.W * Lo.dpr), ch = Math.round(Lo.H * Lo.dpr);
        if (cv.width !== cw || cv.height !== ch) { cv.width = cw; cv.height = ch; }
        g.setTransform(Lo.dpr, 0, 0, Lo.dpr, 0, 0);
        g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
        g.fillStyle = ROOM; g.fillRect(0, 0, Lo.W, Lo.H);
        const pat = g.createPattern(wallTex, 'repeat');
        g.globalAlpha = 0.06; g.globalCompositeOperation = 'overlay';
        g.fillStyle = pat; g.fillRect(0, 0, Lo.W, Lo.H);
        g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
        const lg = g.createRadialGradient(Lo.W / 2, Lo.sy + Lo.sh * 0.3, 0, Lo.W / 2, Lo.sy + Lo.sh * 0.3, Math.max(Lo.W, Lo.H) * 0.75);
        lg.addColorStop(0, 'rgba(255,240,220,0.07)'); lg.addColorStop(0.5, 'rgba(255,240,220,0.025)'); lg.addColorStop(1, 'rgba(0,0,0,0.25)');
        g.fillStyle = lg; g.fillRect(0, 0, Lo.W, Lo.H);
        // the sheet, lifted a hair off the wall
        g.save();
        g.shadowColor = 'rgba(0,0,0,0.55)'; g.shadowBlur = 16; g.shadowOffsetX = 2; g.shadowOffsetY = 7;
        g.fillStyle = '#e9e2d0'; g.fillRect(Lo.sx, Lo.sy, Lo.sw, Lo.sh);
        g.restore();
        g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
        let fading = false;
        if (fadeFrom && sheet) {
          const t = (performance.now() - fadeT0) / 900;
          if (t < 1) {
            g.drawImage(fadeFrom, Lo.sx, Lo.sy, Lo.sw, Lo.sh);
            g.globalAlpha = t * t * (3 - 2 * t);
            fading = true;
          } else fadeFrom = null;
        }
        if (sheet) g.drawImage(sheet, Lo.sx, Lo.sy, Lo.sw, Lo.sh);
        g.globalAlpha = 1;
        // the room's light falls a little off toward the foot of the sheet
        const sg = g.createLinearGradient(0, Lo.sy, 0, Lo.sy + Lo.sh);
        sg.addColorStop(0, 'rgba(255,248,235,0.03)'); sg.addColorStop(1, 'rgba(20,16,10,0.07)');
        g.fillStyle = sg; g.fillRect(Lo.sx, Lo.sy, Lo.sw, Lo.sh);
        if (fading && !raf) raf = requestAnimationFrame(() => { raf = 0; if (!dead) paint(); });
      }
      let target = 0;
      const alive = () => !dead && api.isCurrent();
      function show(canvas, px, fade) {
        if (fade && sheet) { fadeFrom = sheet; fadeT0 = performance.now(); }
        sheet = canvas; sheetPx = px;
        paint();
        if (!readyDone) { readyDone = true; api.ready(); }
      }
      async function renderNow() {
        if (busy) { again = true; return; }
        busy = true;
        try {
          do {
            again = false;
            const Wp = wantPx(layout()), Hp = Math.round((Wp * SH) / SW);
            target = Wp;
            if (!sheet && Wp * Hp > 1.0e6) {
              // a quick proof first, so the room is not left waiting
              const pw = Math.round(Wp * 0.5);
              const pv = await pull(seed, pw, Math.round((pw * SH) / SW), alive, true);
              if (dead) return;
              show(pv, pw, false);
            }
            const out = await pull(seed, Wp, Hp, alive);
            if (dead) return;
            show(out, Wp, true);
          } while (again && !dead);
        } catch (e) {
          if (e && e.message !== 'cancelled') console.error(e);
        } finally { busy = false; }
      }
      paint();
      renderNow();
      const ro = new ResizeObserver(() => {
        if (dead) return;
        paint();
        clearTimeout(timer);
        timer = setTimeout(() => {
          if (dead) return;
          const want = wantPx(layout()), ref = target || sheetPx;
          if (!ref || Math.abs(want - ref) / ref > 0.15) renderNow();
        }, 450);
      });
      ro.observe(el);
      return {
        destroy() { dead = true; clearTimeout(timer); cancelAnimationFrame(raf); ro.disconnect(); sheet = null; fadeFrom = null; },
      };
    },
  });
})();
