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
    yellow: { col: [244, 200, 108], goma: 0.30, mott: 0.18, grain: 0.05, wipe: 0.30, pool: 0.30, fib: 0.30, reg: 1.6 },
    shadow: { col: [108, 136, 194], goma: 0.26, mott: 0.16, grain: 0.05, wipe: 0.22, pool: 0.22, fib: 0.30, reg: 1.6 },
    grey: { col: [122, 112, 134], goma: 0.22, mott: 0.14, grain: 0.05, wipe: 0.12, pool: 0.25, fib: 0.25, reg: 1.6 },
    brown: { col: [126, 82, 48], goma: 0.26, mott: 0.16, grain: 0.09, wipe: 0.15, pool: 0.35, fib: 0.25, reg: 1.6 },
    blue: { col: [36, 80, 150], goma: 0.22, mott: 0.12, grain: 0.08, wipe: 0.15, pool: 0.35, fib: 0.20, reg: 1.6 },
    red: { col: [204, 46, 34], goma: 0.24, mott: 0.12, grain: 0.05, wipe: 0.12, pool: 0.40, fib: 0.20, reg: 1.4 },
    cedar: { col: [42, 64, 54], goma: 0.18, mott: 0.14, grain: 0.06, wipe: 0.12, pool: 0.28, fib: 0.20, reg: 1.6 },
    indigo: { col: [30, 40, 86], goma: 0.20, mott: 0.08, grain: 0.035, wipe: 0.1, pool: 0.22, fib: 0.20, reg: 1.6 },
    key: { col: [24, 26, 38], goma: 0.10, mott: 0.05, grain: 0, wipe: 0, pool: 0.12, fib: 0.10, reg: 0 },
    gofun: { col: [250, 249, 244], opaque: true, goma: 0.22, mott: 0.10, grain: 0, wipe: 0, pool: 0, fib: 0, reg: 2.2 },
    seal: { col: [186, 44, 34], goma: 0.55, mott: 0.22, grain: 0, wipe: 0, pool: 0.35, fib: 0.2, reg: 0 },
    fleck: { col: [140, 108, 76], goma: 0, mott: 0, grain: 0, wipe: 0, pool: 0, fib: 0, reg: 0 },
    pencil: { col: [92, 92, 100], pencil: true, reg: 0 },
  };
  const ORDER = ['fleck', 'yellow', 'shadow', 'grey', 'brown', 'blue', 'red', 'cedar', 'indigo', 'key', 'gofun', 'seal', 'pencil'];

  /* ------------------------------------------------------------------ scene */
  const H0 = 900; // eye level
  const um = (y) => 0.484 * (y - H0); // print units per metre on the ground at y
  const ROAD = crPts([[305, 903], [292, 920], [272, 960], [263, 1000], [266, 1040], [287, 1088], [328, 1200], [362, 1300], [404, 1500], [414, 1560]], false, 2);
  function roadX(y) {
    if (y <= ROAD[0][1]) return ROAD[0][0];
    for (let i = 1; i < ROAD.length; i++) {
      if (ROAD[i][1] >= y) { const a = ROAD[i - 1], b = ROAD[i], t = (y - a[1]) / ((b[1] - a[1]) || 1); return a[0] + (b[0] - a[0]) * t; }
    }
    return ROAD[ROAD.length - 1][0];
  }
  const KZ = 2256; // y - H0 = KZ / z (z in metres)
  const MACH = [545, 629, 713], MTOP = 908, MBASE = 1075, MW = 82;
  const FIG = [462, 1088], CAT = [606, 1127], SIGN = [395, 1096];

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

    /* ---- 1. sky: indigo with an ichimonji band wiped across the top */
    {
      const r = R('sky');
      ink('indigo', IMG, 1, LG(0, 0, 0, 780, [[0, 1], [0.1, 0.97], [0.2, 0.86], [0.6, 0.76], [1, 0.62]]));
      const band = 105 + r() * 30;
      ink('indigo', rect(-20, -20, IW + 40, band + 60), 1, LG(0, 0, 0, band + 40, [[0, 0.55], [0.62, 0.5], [1, 0]]));
      ink('grey', IMG, 1, LG(0, 250, 0, 780, [[0, 0], [1, 0.4]]));
      ink('cedar', IMG, 1, LG(0, 0, 0, 500, [[0, 0.12], [1, 0]]));
    }

    /* ---- 2. far ridge, barely separated from the sky */
    {
      const r = R('ridge');
      const top = [[-20, 668], [70, 652], [130, 641], [190, 646], [250, 628], [320, 613], [380, 607], [430, 615], [500, 601], [570, 597], [650, 591], [760, 598], [880, 592], [1020, 600]];
      const p = poly(crPts(top, false).concat([[1020, 820], [-20, 820]]));
      ink('grey', p, 1, LG(0, 595, 0, 800, [[0, 0.66], [1, 0.3]]));
      ink('indigo', p, 0.22);
      for (let i = 0; i < 14; i++) {
        const x = 20 + r() * 520, y = 640 + r() * 60, l = 14 + r() * 26;
        wipe('grey', carve(r, [[x, y], [x + l * 0.5, y + l * 0.55], [x + l * 0.7, y + l]], 1.6 + r() * 2.4, { ts: 6, te: 8, chip: 0 }), 0.32);
      }
    }

    /* ---- 3. snowy hillside under the ridge */
    {
      const r = R('hill');
      const top = [[-20, 772], [50, 764], [110, 770], [170, 758], [240, 766], [300, 754], [360, 760], [430, 748], [500, 756], [560, 746], [700, 752], [1020, 760]];
      const p = poly(crPts(top, false).concat([[1020, 980], [-20, 980]]));
      occ(p);
      ink('shadow', p, 0.58);
      ink('indigo', p, 1, LG(0, 750, 0, 940, [[0, 0.4], [1, 0.22]]));
      ink('grey', p, 1, LG(0, 750, 0, 900, [[0, 0.26], [1, 0.1]]));
      // a soft dark rim where the hill meets the ridge
      ink('indigo', carve(r, top, 7, { ts: 0, te: 0, sw: 0.5, chip: 0 }), 0.18);
      const fields = [[[10, 802], [120, 796], [228, 806]], [[320, 790], [420, 786], [520, 793]], [[60, 852], [170, 843], [262, 850]], [[150, 820], [240, 816]]];
      for (const f of fields) ink('key', key(r, f, 1.3, { brk: 0.06, chip: 0.05 }), 0.28);
      // hedgerow dots
      for (let i = 0; i < 26; i++) ink('key', blob(r, 30 + r() * 480, 778 + r() * 90, 1.6 + r() * 1.6, 1 + r() * 0.8, 6, 0.3), 0.3);
    }

    /* ---- cedars: drooping branch layers, each carrying a pillow of snow ---- */
    function cedar(r, cx, top, bot, hw, o) {
      const parts = [];
      const th0 = o.tier || 30;
      const lean = (r() - 0.5) * (o.lean || 0.04);
      const axis = (y) => cx + lean * (y - top);
      const coreW = Math.max(1.5, hw * 0.12);
      const core = shape([[axis(top) , top - th0 * 1.4], [axis(bot) + coreW, bot + th0 * 0.4], [axis(bot) - coreW, bot + th0 * 0.4]], [0, 1, 2]);
      let y = top;
      let side = r() < 0.5 ? -1 : 1;
      while (y < bot) {
        const t = clamp((y - top) / (bot - top), 0, 1);
        const reach = hw * Math.pow(0.08 + 0.92 * t, 0.5);
        for (const s of [side, -side]) {
          if (t > 0.12 && r() < (o.gap == null ? 0.1 : o.gap)) continue;
          const yy = y + (s === side ? 0 : th0 * (0.2 + r() * 0.4));
          const Lb = Math.max(th0 * 0.5, reach * (0.6 + r() * 0.55));
          const th = th0 * (0.45 + r() * 0.3) * (0.75 + 0.45 * t);
          const d = Lb * (0.1 + r() * 0.24);
          const ax = axis(yy) - s * coreW * 0.4;
          const X = (u) => ax + s * u;
          const pts = [[X(0), yy - th * 0.55], [X(Lb * 0.35), yy - th * 0.62 + d * 0.1], [X(Lb * 0.72), yy - th * 0.34 + d * 0.5], [X(Lb), yy + d]];
          const nj = 2 + Math.round(Lb / 13);
          for (let j = 1; j <= nj; j++) {
            const u = 1 - j / (nj + 1);
            const base = yy + d * Math.pow(u, 1.5) + th * 0.3;
            pts.push([X(Lb * u + (r() - 0.5) * 4), base + (j % 2 ? th * (0.18 + r() * 0.3) : th * 0.02)]);
          }
          pts.push([X(-coreW * 0.5), yy + th * 0.5]);
          const fol = shape(pts, [3]);
          let snow = null;
          if (r() < (o.snowP == null ? 0.9 : o.snowP)) {
            const st = th * (0.3 + Math.pow(r(), 1.5) * 0.95) * (o.load || 1);
            const a = 0.03 + r() * 0.15, b = 0.55 + r() * 0.42;
            const nb = 3 + ((r() * 3) | 0), top = [], bt = [];
            for (let j = 0; j <= nb; j++) {
              const u = a + ((b - a) * j) / nb, env = Math.pow(Math.sin((Math.PI * j) / nb), 0.55);
              top.push([X(Lb * u + (r() - 0.5) * 2), yy - th * 0.52 + d * u * u - st * env * (0.55 + r() * 0.6)]);
            }
            for (let j = nb; j >= 0; j--) {
              const u = a + ((b - a) * j) / nb;
              bt.push([X(Lb * u), yy - th * 0.28 + d * u * u * 0.95 + (r() - 0.3) * th * 0.28]);
            }
            snow = smooth(top.concat(bt));
            if (r() < 0.3) blob(r, X(Lb * (0.75 + r() * 0.2)), yy + d * 0.7 - th * 0.1, th * 0.35 + st * 0.3, th * 0.22 + st * 0.15, 7, 0.25, 0, snow);
          }
          parts.push({ fol, snow, y: yy, th: th * 1.6 });
        }
        side = -side;
        y += th0 * (0.5 + r() * 0.55) * (0.7 + 0.5 * t);
      }
      parts.sort((p, q) => q.y - p.y); // lowest first: each branch above hangs over the snow below
      parts.unshift({ fol: core, snow: null, y: bot, th: th0 });
      return parts;
    }
    function drawCedar(parts, folInks, snowInks) {
      for (const t of parts) {
        occ(t.fol);
        inks(folInks, t.fol);
        if (t.snow) {
          occ(t.snow);
          for (const s of snowInks) ink(s[0], t.snow, 1, LG(0, t.y - t.th * 1.1, 0, t.y + t.th * 0.1, [[0, s[1] * 0.4], [1, s[1]]]));
        }
      }
    }

    /* ---- 4. the shrine grove, far left */
    {
      const r = R('fargrove');
      const fol = [['cedar', 0.5], ['indigo', 0.42], ['grey', 0.25]];
      const sn = [['shadow', 0.55], ['indigo', 0.2]];
      const trees = [[24, 652, 905, 50], [150, 640, 915, 58], [88, 692, 912, 42], [214, 716, 918, 36], [-30, 700, 900, 50]];
      // the grove's dark body behind the trees
      const body = smooth([[-20, 760], [40, 720], [120, 735], [200, 742], [250, 800], [262, 900], [240, 940], [-20, 945]]);
      occ(body); inks([['cedar', 0.45], ['indigo', 0.5], ['grey', 0.25]], body);
      for (const t of trees) drawCedar(cedar(r, t[0], t[1], t[2], t[3], { tier: 11 }), fol, sn);
      // a small shrine roof deep in the grove
      const roof = shape([[70, 905], [84, 893], [124, 892], [138, 905], [130, 907], [78, 907]], [0, 3]);
      occ(roof); ink('shadow', roof, 0.32);
      ink('key', key(r, [[72, 906], [104, 907.5], [136, 906]], 1.2, { chip: 0.04 }), 0.6);
      const wall = rect(82, 907, 46, 9);
      occ(wall); inks([['indigo', 0.75], ['brown', 0.4], ['grey', 0.2]], wall);
    }

    /* ---- 5. the village on the hillside: one lit window */
    {
      const r = R('village');
      // [cx, base, width, gable-end facing us?, lit?]
      const houses = [[192, 822, 34, 0, 0], [252, 842, 60, 1, 0], [322, 826, 46, 0, 0], [398, 852, 70, 1, 1], [470, 824, 44, 0, 0], [528, 838, 40, 1, 0]];
      for (const h of houses) {
        const cx = h[0], base = h[1], w = h[2];
        const wallH = w * 0.3, ov = w * 0.1, ye = base - wallH;
        const wall = rect(cx - w / 2, ye - 1, w, wallH + 1);
        occ(wall); inks([['indigo', 0.75], ['brown', 0.5], ['grey', 0.3]], wall);
        if (h[3]) {
          // gable end toward us: a steep thatched gable under thick snow
          const rh = w * 0.62;
          const gable = poly([[cx - w / 2, ye], [cx, ye - rh + 4], [cx + w / 2, ye]]);
          occ(gable); inks([['indigo', 0.62], ['brown', 0.55], ['grey', 0.25]], gable);
          const snowA = shape([[cx - w / 2 - ov, ye + 3], [cx - 1, ye - rh - 2], [cx + 1, ye - rh - 2], [cx + w / 2 + ov, ye + 3],
            [cx + w / 2 + ov - 5, ye + 3.5], [cx + w * 0.22, ye - rh * 0.45], [cx, ye - rh + 7], [cx - w * 0.22, ye - rh * 0.45], [cx - w / 2 - ov + 5, ye + 3.5]], [0, 3, 4, 8]);
          occ(snowA);
          ink('shadow', snowA, 1, LG(0, ye - rh, 0, ye + 3, [[0, 0.16], [1, 0.4]]));
          ink('indigo', snowA, 0.1);
          ink('key', key(r, [[cx - w / 2 + 2, ye + 0.5], [cx, ye - rh + 7], [cx + w / 2 - 2, ye + 0.5]], 0.9, { chip: 0.06 }), 0.6);
          if (h[4]) {
            const wx = cx - w * 0.12, wy = ye + wallH * 0.18, wwid = w * 0.24, wh = wallH * 0.56;
            const win = rect(wx, wy, wwid, wh);
            occ(win); ink('yellow', win, 0.9);
            for (const f of [1 / 3, 2 / 3]) ink('key', rect(wx + wwid * f - 0.35, wy, kw(0.7), wh), 0.55);
            ink('key', rect(wx, wy + wh / 2 - 0.35, wwid, kw(0.7)), 0.55);
          }
        } else {
          const roofH = w * 0.46;
          const roof = shape([[cx - w / 2 - ov, ye + 2], [cx - w * 0.26, ye - roofH + 2], [cx - w * 0.1, ye - roofH - 1.5], [cx + w * 0.16, ye - roofH - 0.5],
            [cx + w * 0.27, ye - roofH + 2], [cx + w / 2 + ov, ye + 2], [cx, ye + 3.2]], [0, 5, 6]);
          occ(roof);
          ink('shadow', roof, 1, LG(0, ye - roofH, 0, ye + 2, [[0, 0.14], [1, 0.42]]));
          ink('indigo', roof, 0.1);
          ink('key', key(r, [[cx - w / 2 - ov + 1, ye + 2.2], [cx, ye + 3.2], [cx + w / 2 + ov - 1, ye + 2.2]], 1, { chip: 0.05 }), 0.8);
        }
      }
    }

    /* ---- the distance veiled by falling snow: the dark blocks wiped thin toward the horizon */
    {
      const veil = rect(-20, 560, IW + 40, 400);
      for (const p of ['indigo', 'cedar', 'brown', 'key', 'grey']) wipe(p, veil, 1, LG(0, 560, 0, 950, [[0, 0], [0.55, 0.2], [1, 0.32]]));
    }

    /* ---- 6. the near ground: deep snow, the road, ruts, banks, the pool of light */
    const groundTop = [[-20, 938], [60, 940], [130, 944], [200, 937], [258, 918], [305, 903], [350, 907], [420, 911], [520, 914], [700, 917], [1020, 920]];
    {
      const r = R('ground');
      const g = poly(crPts(groundTop, false).concat([[1020, 1520], [-20, 1520]]));
      occ(g);
      ink('shadow', g, 1, LG(0, 902, 0, 1500, [[0, 0.7], [0.2, 0.58], [0.5, 0.52], [0.8, 0.56], [1, 0.68]]));
      ink('shadow', g, 1, LG(0, 0, 560, 0, [[0, 0.26], [1, 0]]));
      ink('shadow', g, 1, LG(1000, 0, 820, 0, [[0, 0.22], [1, 0]]));
      ink('indigo', g, 1, LG(0, 902, 0, 1500, [[0, 0.42], [0.25, 0.24], [0.7, 0.2], [1, 0.36]]));
      ink('grey', g, 1, LG(0, 902, 0, 1040, [[0, 0.32], [1, 0.06]]));
      // a darker band wiped along the foot of the block, to hold the eye up in the picture
      ink('indigo', rect(-20, 1360, IW + 40, 160), 1, LG(0, 1360, 0, 1500, [[0, 0], [0.55, 0.1], [1, 0.26]]));
      // banks along the road: a soft shadow on the road side, a crest of light above it
      for (const side of [-1, 1]) {
        const pts = [];
        for (let y = 906; y <= 1520; y += 8) {
          if (side > 0 && y > 1060 && y < 1160) continue;
          pts.push([roadX(y) + side * 0.726 * (y - H0), y, 0.05 * (y - H0) + 1]);
        }
        if (side > 0) {
          const a = pts.filter((p) => p[1] <= 1060), b = pts.filter((p) => p[1] >= 1160);
          if (a.length > 2) ink('shadow', carve(r, a, 1, { abs: true, chip: 0, sw: 0.4, ts: 10, te: 30 }), 0.3);
          if (b.length > 2) ink('shadow', carve(r, b, 1, { abs: true, chip: 0, sw: 0.4, ts: 40, te: 10 }), 0.3);
        } else ink('shadow', carve(r, pts, 1, { abs: true, chip: 0, sw: 0.4, ts: 10, te: 10 }), 0.3);
      }
      // ruts
      for (const side of [-1, 1]) {
        const pts = [], core = [];
        for (let y = 905; y <= 1530; y += 5) {
          const x = roadX(y) + side * 0.387 * (y - H0);
          pts.push([x, y, 0.17 * (y - H0)]);
          core.push([x - side * 0.02 * (y - H0), y, 0.07 * (y - H0)]);
        }
        ink('shadow', carve(r, pts, 1, { abs: true, chip: 0, sw: 0.25, ts: 2, te: 0 }), 0.27);
        ink('shadow', carve(r, core, 1, { abs: true, chip: 0, sw: 0.35, ts: 2, te: 0 }), 0.2);
        ink('grey', carve(r, core, 1, { abs: true, chip: 0, sw: 0.35, ts: 2, te: 0 }), 0.14);
        // broken carved edges in the near ruts
        const edge = pts.filter((p) => p[1] > 1170).map((p) => [p[0] + side * p[2] * 0.42, p[1]]);
        ink('key', key(r, edge, 1.1, { brk: 0.05, chip: 0.06, ts: 20, te: 4 }), 0.32);
      }

      // wind-shaped drifts: soft bands of shadow under a lit crest, following the lie of the snow
      const drifts = [
        [[-10, 1196], [90, 1172], [190, 1152], [246, 1130]], [[-10, 1336], [120, 1306], [236, 1252]], [[40, 1440], [150, 1420], [240, 1380]],
        [[1010, 1252], [930, 1236], [862, 1240]], [[1010, 1396], [900, 1356], [816, 1336], [752, 1346]], [[40, 1004], [140, 992], [208, 976]],
        [[1010, 1130], [960, 1118], [930, 1104]],
      ];
      for (const d of drifts) {
        const pts = d.map((q) => [q[0], q[1], 0.065 * (q[1] - H0)]);
        ink('shadow', carve(r, pts, 1, { abs: true, chip: 0, sw: 0.5, ts: 40, te: 40, tmin: 0 }), 0.3);
        ink('indigo', carve(r, pts, 1, { abs: true, chip: 0, sw: 0.5, ts: 40, te: 40, tmin: 0 }), 0.08);
        wipe('shadow', carve(r, pts.map((q) => [q[0], q[1] - q[2] * 0.75, q[2] * 0.45]), 1, { abs: true, chip: 0, sw: 0.5, ts: 40, te: 40, tmin: 0 }), 0.3);
      }
      // the pool of light in front of the machines: the snow blocks wiped back in many soft passes,
      // a warm block printed in their place
      const PR = R('pool');
      const poolBase = [[512, 1070], [806, 1066], [884, 1094], [940, 1146], [912, 1200], [796, 1228], [634, 1236], [480, 1222], [372, 1190], [318, 1140], [356, 1100], [440, 1080]];
      const pc = [652, 1074];
      const NP = 16, pw = 0.88 + PR() * 0.24;
      for (let i = 0; i < NP; i++) {
        const f = 1 - i * (0.9 / NP);
        const pts = poolBase.map((q) => [pc[0] + (q[0] - pc[0]) * f + (PR() - 0.5) * 16 * f, pc[1] + (q[1] - pc[1]) * f + (PR() - 0.5) * 8 * f]);
        const pp = smooth(pts);
        wipe('shadow', pp, 0.105 * pw); wipe('indigo', pp, 0.13 * pw); wipe('grey', pp, 0.13 * pw);
        ink('yellow', pp, 0.042 * pw);
      }
      // long shadows thrown by the light
      const shadowWedge = (pts, from, to, a) => {
        const p = smooth(pts);
        ink('shadow', p, 1, LG(from[0], from[1], to[0], to[1], [[0, a], [0.6, a * 0.55], [1, 0]]));
        ink('grey', p, 1, LG(from[0], from[1], to[0], to[1], [[0, a * 0.4], [1, 0]]));
        wipe('yellow', p, 1, LG(from[0], from[1], to[0], to[1], [[0, 0.95], [1, 0.4]]));
      };
      shadowWedge([[451, 1085], [473, 1089], [420, 1098], [340, 1109], [296, 1117], [258, 1127], [222, 1129], [208, 1119], [232, 1107], [296, 1101], [380, 1093], [430, 1086]], [FIG[0], FIG[1]], [210, 1120], 0.6);
      shadowWedge([[SIGN[0] - 2, SIGN[1] - 1], [SIGN[0] + 2, SIGN[1] + 1], [340, 1104], [300, 1108], [284, 1112], [268, 1112], [260, 1106], [274, 1101], [292, 1102], [340, 1101]], [SIGN[0], SIGN[1]], [262, 1108], 0.5);
      shadowWedge([[CAT[0] - 10, CAT[1]], [CAT[0] + 8, CAT[1] + 1], [CAT[0] - 2, CAT[1] + 9], [CAT[0] - 22, CAT[1] + 12], [CAT[0] - 24, CAT[1] + 8]], [CAT[0], CAT[1]], [CAT[0] - 20, CAT[1] + 11], 0.5);
      // light falling on the bank in front of the shelter
      ink('yellow', UNIT, 1, RG([[0, 0.3], [1, 0]]), { m: ellM(850, 1068, 110, 22) });

      // footprints: one walker, from where we stand to the stop
      const fr = R('steps');
      let side = 1;
      for (let z = 3.3; z < 12.0; z += 0.37 + fr() * 0.04) {
        const y = H0 + KZ / z;
        const rutx = roadX(y) + 0.387 * (y - H0);
        const blend = clamp((z - 10.2) / 1.8, 0, 1);
        const x = rutx + (FIG[0] - rutx) * blend * blend + side * 0.11 * um(y) + (fr() - 0.5) * 0.04 * um(y);
        const ry = (KZ / (z - 0.15) - KZ / (z + 0.15)) / 2, rx = 0.06 * um(y);
        const rot = (fr() - 0.5) * 0.2 + side * 0.06;
        const p = blob(fr, x, y, rx, ry, 9, 0.12, rot);
        ink('shadow', p, 0.5); ink('grey', p, 0.26); ink('indigo', p, 0.1);
        const inner = ell(x - rx * 0.1, y - ry * 0.15, rx * 0.62, ry * 0.6, rot);
        ink('shadow', inner, 0.3); ink('indigo', inner, 0.14);
        if (y > 1220) ink('key', key(fr, [[x - rx * 0.8, y - ry * 0.4], [x, y - ry * 0.92], [x + rx * 0.8, y - ry * 0.4]], Math.max(1, rx * 0.12), { chip: 0.05 }), 0.22);
        side = -side;
      }
      // the cat's prints, from the shelter
      const cr = R('catsteps');
      for (let i = 0; i < 16; i++) {
        const t = i / 15, x = 830 + (CAT[0] + 12 - 830) * t + Math.sin(t * 5) * 6, y = 1080 + (CAT[1] + 2 - 1080) * t + Math.sin(t * 3.1) * 3;
        for (const d of [-1.6, 1.6]) ink('shadow', ell(x + d * 0.6, y + d + (cr() - 0.5), 1.4, 0.7, 0), 0.5);
      }
    }

    /* ---- 7. the torii, half-buried at the edge of the grove */
    {
      const r = R('torii');
      const posts = [shape([[66, 884], [72.5, 884], [74.5, 948], [65, 948]], [0, 1, 2, 3]), shape([[128, 884], [134.5, 884], [136, 948], [126.5, 948]], [0, 1, 2, 3])];
      const nuki = rect(57, 895, 86, 5);
      const kasa = shape([[43, 871], [58, 875.5], [100, 876.5], [142, 875.5], [157, 871], [155, 877.5], [142, 881.5], [100, 882.5], [58, 881.5], [45, 877.5]], [0, 4, 5, 9]);
      const shim = rect(52, 882, 96, 3.6);
      const gaku = rect(97.5, 885, 5, 10);
      const all = [posts[0], posts[1], nuki, shim, gaku, kasa];
      const clip = rect(-20, -20, 400, 960);
      for (const p of all) { occ(p, { clip }); inks([['grey', 0.6], ['brown', 0.35], ['indigo', 0.38], ['red', 0.08]], p, { clip }); }
      ink('key', key(r, [[44, 872], [58, 876], [100, 877], [142, 876], [156, 871.5]], 1.1), 0.75);
      ink('key', key(r, [[66.5, 886], [66, 940]], 1, { brk: 0.03 }), 0.6, null, { clip });
      ink('key', key(r, [[134, 886], [135.5, 940]], 1, { brk: 0.03 }), 0.6, null, { clip });
      const sk = blob(r, 100, 868.5, 57, 4.2, 18, 0.12);
      occ(sk); ink('shadow', sk, 0.3);
      const sn = blob(r, 100, 893.4, 44, 2.3, 14, 0.15);
      occ(sn); ink('shadow', sn, 0.3);
      // drift around the feet of the posts
      const drift = smooth([[46, 945], [62, 934], [76, 936], [92, 942], [112, 940], [126, 933], [140, 935], [156, 944], [150, 952], [52, 952]]);
      occ(drift); ink('shadow', drift, 0.55); ink('indigo', drift, 0.3); ink('grey', drift, 0.18);
    }

    /* ---- 8. poles and wires, receding along the road */
    const poles = [
      { x: 300, base: 912, top: 868 }, { x: 272, base: 926, top: 829 }, { x: 222, base: 958, top: 735 }, { x: 160, base: 1030, top: 527 },
    ];
    const arms = [];
    {
      const r = R('poles');
      for (const p of poles) {
        const u = um(p.base), w = Math.max(1.1, 0.26 * u), w2 = w * 0.8;
        const body = shape([[p.x - w2 / 2, p.top], [p.x + w2 / 2, p.top], [p.x + w / 2, p.base], [p.x - w / 2, p.base]], [0, 1, 2, 3]);
        occ(body); inks([['grey', 0.6], ['indigo', 0.5], ['brown', 0.15]], body);
        if (w > 3) ink('key', key(r, [[p.x + w / 2 - 0.4, p.base], [p.x + w2 / 2 - 0.4, p.top]], 1, { brk: 0.02 }), 0.6);
        const al = 1.7 * u, ay = p.top + 0.35 * u, at = Math.max(1, 0.12 * u);
        const arm = rect(p.x - al / 2, ay, al, at);
        occ(arm); inks([['grey', 0.6], ['indigo', 0.55]], arm);
        if (u > 8) ink('key', key(r, [[p.x - al / 2, ay + at], [p.x + al / 2, ay + at]], 0.8), 0.7);
        const sn = blob(r, p.x, ay - at * 0.2, al / 2 + 0.6, Math.max(0.8, at * 0.55), 10, 0.15);
        occ(sn); ink('shadow', sn, 0.3);
        const ins = [];
        for (const f of [-0.42, 0, 0.42]) {
          const ix = p.x + f * al, iy = ay - 0.12 * u;
          if (u > 10) { const pi = ell(ix, iy, 0.07 * u, 0.1 * u, 0); occ(pi); ink('key', pi, 0.6); ink('shadow', pi, 0.4); }
          ins.push([ix, iy]);
        }
        const cy = p.top + 2.1 * u;
        ins.push([p.x + 0.6 * u * 0.2, cy]);
        arms.push(ins);
        if (p.x === 160) {
          // a transformer on the nearer pole
          const tf = smooth([[p.x - 2, cy + 6], [p.x + 9, cy + 5], [p.x + 10, cy + 30], [p.x + 4, cy + 33], [p.x - 1, cy + 30]]);
          occ(tf); inks([['grey', 0.5], ['indigo', 0.3]], tf);
          ink('key', key(r, [[p.x + 9.5, cy + 6], [p.x + 10, cy + 30]], 1), 0.6);
          const ts = blob(r, p.x + 4, cy + 5, 7, 2, 8, 0.2);
          occ(ts); ink('shadow', ts, 0.3);
        }
      }
      // the next pole stands outside the picture, up to the left
      arms.push([[-40, -70], [4, -82], [48, -74], [-20, 60]]);
      // wires: from near to far, snow lying along their upper side
      for (let i = arms.length - 1; i > 0; i--) {
        const A = arms[i], B = arms[i - 1];
        for (let j = 0; j < 4; j++) {
          const a = A[j], b = B[j];
          const span = Math.hypot(b[0] - a[0], b[1] - a[1]);
          const sag = span * (j === 3 ? 0.07 : 0.045) + 2;
          const pts = sagPts(a, b, sag, Math.max(8, Math.round(span / 6)));
          const ww = j === 3 ? 1.5 : 1.05;
          occ(carve(r, pts.map((q) => [q[0], q[1] - ww * 0.95 - 0.5]), kw(1.1), { raw: true, ts: 0, te: 0, sw: 0.5, brk: 0.05, chip: 0.1 }));
          ink('key', key(r, pts, ww, { raw: true, ts: 0, te: 3, sw: 0.15, chip: 0.02, brk: 0.004 }), 0.95);
        }
      }
    }

    /* ---- 9. the dark cedars behind the stop */
    {
      const r = R('grove');
      const body = poly(crPts([[1020, 330], [960, 380], [900, 350], [820, 420], [760, 460], [700, 540], [640, 600], [590, 680], [552, 760], [532, 860], [520, 940], [516, 1040]], false).concat([[1020, 1040]]));
      occ(body);
      inks([['cedar', 0.62], ['indigo', 0.82], ['grey', 0.2]], body);
      // snow on the grove floor, dimly lit
      const floor = poly(crPts([[512, 1004], [560, 998], [620, 1003], [700, 996], [800, 1002], [900, 997], [1020, 1003]], false).concat([[1020, 1060], [512, 1060]]));
      occ(floor);
      inks([['shadow', 0.6], ['indigo', 0.5], ['grey', 0.22]], floor);
      // trunks deep in the grove
      for (let i = 0; i < 12; i++) {
        const x = 540 + r() * 470, w = 3 + r() * 6;
        const p = carve(r, [[x, 820 + r() * 60], [x + (r() - 0.5) * 3, 1004 + r() * 6]], w, { ts: 0, te: 2, sw: 0.1, chip: 0.03 });
        occ(p); inks([['cedar', 0.5], ['indigo', 0.85], ['key', 0.3]], p);
      }
      const back = [['cedar', 0.72], ['indigo', 0.72], ['grey', 0.12]], backS = [['shadow', 0.7], ['indigo', 0.42]];
      const front = [['cedar', 0.9], ['indigo', 0.6]], frontS = [['shadow', 0.56], ['indigo', 0.2]];
      const trees = [
        [662, 30, 880, 96, back, backS, 1], [830, -80, 860, 112, back, backS, 1], [992, -60, 870, 116, back, backS, 1], [706, 280, 880, 66, back, backS, 1],
        [578, 196, 862, 84, front, frontS, 0], [750, -70, 845, 120, front, frontS, 0], [912, -110, 835, 116, front, frontS, 0],
      ];
      for (const t of trees) {
        const tiers = cedar(r, t[0], t[1], t[2], t[3], { tier: 34, snowP: t[6] ? 0.7 : 0.95, load: t[6] ? 0.8 : 1.1 });
        // trunk
        const u = um(1035), tw = 0.42 * u;
        const trunk = shape([[t[0] - tw * 0.4, t[2] - 30], [t[0] + tw * 0.4, t[2] - 30], [t[0] + tw * 0.55, 1036], [t[0] - tw * 0.55, 1036]], [0, 1, 2, 3]);
        occ(trunk); inks([['cedar', 0.6], ['brown', 0.4], ['indigo', 0.8]], trunk);
        const pl = carve(r, [[t[0] - tw * 0.42, t[2]], [t[0] - tw * 0.5, 1030]], 2.4, { ts: 6, te: 2, chip: 0.1, brk: 0.05 });
        occ(pl); ink('shadow', pl, 0.55);
        drawCedar(tiers, t[4], t[5]);
      }
      // the light-halo: the dark blocks wiped thin around the machines
      const hm = ellM(668, 975, 230, 165);
      for (const p of ['indigo', 'cedar']) wipe(p, UNIT, 1, RG([[0, 0.5], [0.45, 0.32], [0.8, 0.08], [1, 0]]), { m: hm });
      ink('yellow', UNIT, 1, RG([[0, 0.3], [0.6, 0.12], [1, 0]]), { m: ellM(668, 1010, 200, 70) });
    }

    // everything standing at the stop is cut off by the snow it stands in
    const snowLine = (x) => (x < 800 ? 1068 : 1054) + 2.4 * Math.sin(x * 0.09) + 1.6 * Math.sin(x * 0.23 + 1);
    const standClip = (() => {
      const pts = [[480, -20], [1020, -20]];
      for (let x = 1020; x >= 480; x -= 4) pts.push([x, snowLine(x)]);
      return poly(pts);
    })();
    const C = { clip: standClip };

    /* ---- 10. the bus shelter */
    {
      const r = R('shelter');
      const X0 = 812, X1 = 975, TOP = 890, BASE = 1062;
      const side = shape([[798, 895], [X0, TOP], [X0, BASE], [798, BASE - 4]], [0, 1, 2, 3]);
      occ(side, C); inks([['brown', 0.5], ['yellow', 0.55], ['grey', 0.1]], side, C);
      for (let y = 904; y < 1060; y += 11) ink('key', key(r, [[798, y + 2], [X0, y]], 0.7, { chip: 0.08, ts: 0, te: 0 }), 0.5, null, C);
      const back = rect(X0 + 6, TOP + 4, X1 - X0 - 12, BASE - TOP);
      occ(back, C);
      inks([['brown', 0.55], ['grey', 0.3]], back, C);
      ink('indigo', back, 1, LG(0, TOP, 0, BASE, [[0, 0.86], [1, 0.62]]), C);
      // light from the machines comes in at the open front and falls on the far part of the back wall
      const lit = poly([[X0 + 70, TOP + 4], [X1 - 6, TOP + 4], [X1 - 6, BASE], [X0 + 34, BASE]]);
      wipe('indigo', lit, 0.42, null, C); ink('yellow', lit, 0.36, null, C);
      for (let y = TOP + 14; y < BASE; y += 12) ink('key', key(r, [[X0 + 6, y], [X1 - 6, y + 0.5]], 0.7, { brk: 0.02, chip: 0.06, ts: 0, te: 0 }), 0.45, null, C);
      const inner = shape([[X1 - 8, TOP + 3], [X1 - 8, BASE], [X1 - 26, BASE - 7], [X1 - 26, TOP + 12]], [0, 1, 2, 3]);
      occ(inner, C); inks([['brown', 0.5], ['yellow', 0.55], ['indigo', 0.12]], inner, C);
      for (let y = TOP + 18; y < BASE - 4; y += 11) ink('key', key(r, [[X1 - 26, y + 4], [X1 - 8, y]], 0.6, { chip: 0.08, ts: 0, te: 0 }), 0.45, null, C);
      // the timetable and a faded poster on the back wall
      const tt = rect(902, 945, 26, 34);
      occ(tt, C); ink('yellow', tt, 0.18, null, C); ink('grey', tt, 0.22, null, C); ink('indigo', tt, 0.18, null, C);
      for (let i = 0; i < 6; i++) ink('key', rect(905, 950 + i * 4.6, 12 + r() * 8, kw(0.7)), 0.45, null, C);
      const po = rect(858, 948, 20, 28);
      occ(po, C); ink('red', po, 0.22, null, C); ink('yellow', po, 0.3, null, C); ink('indigo', po, 0.3, null, C);
      ink('blue', ell(868, 958, 6, 6, 0), 0.25, null, C);
      // bench
      const seat = rect(X0 + 12, 1012, X1 - X0 - 24, 6);
      occ(seat, C); inks([['brown', 0.6], ['yellow', 0.35], ['indigo', 0.2]], seat, C);
      ink('key', key(r, [[X0 + 12, 1018], [X1 - 12, 1018]], 1, { chip: 0.05 }), 0.75, null, C);
      for (const lx of [X0 + 20, X1 - 22]) { const leg = rect(lx, 1018, 4, 28); occ(leg, C); inks([['brown', 0.6], ['indigo', 0.6]], leg, C); }
      // posts and the beam under the roof
      for (const px of [X0, X1 - 9]) {
        const post = rect(px, TOP - 2, 9, BASE - TOP + 2);
        occ(post, C); inks([['brown', 0.72], ['indigo', 0.35]], post, C);
        if (px === X0) ink('yellow', post, 0.4, null, C);
        ink('key', key(r, [[px + 9, TOP], [px + 9, BASE]], 0.9, { brk: 0.01 }), 0.7, null, C);
        ink('key', key(r, [[px, TOP], [px, BASE]], 0.9, { brk: 0.01 }), 0.7, null, C);
      }
      const beam = rect(X0 - 8, TOP - 9, X1 - X0 + 16, 10);
      occ(beam); inks([['brown', 0.72], ['indigo', 0.3]], beam);
      ink('yellow', beam, 1, LG(X0 - 8, 0, X0 + 60, 0, [[0, 0.45], [1, 0]]));
      ink('key', key(r, [[X0 - 8, TOP + 1], [X1 + 8, TOP + 1]], 1.2), 0.8);
      const nb = rect(864, TOP - 7.5, 54, 6.5);
      occ(nb); ink('yellow', nb, 0.15); ink('grey', nb, 0.1);
      ink('key', glyph(r, '宝', 872, TOP - 7.2, 6, 0.8, { jit: 2 }), 0.8);
      ink('key', glyph(r, '来', 887, TOP - 7.2, 6, 0.8, { jit: 2 }), 0.8);
      ink('key', glyph(r, '辻', 902, TOP - 7.2, 6, 0.8, { jit: 2 }), 0.8);
      // icicles
      for (const ix of [826, 841, 852, 879, 905, 921, 944, 960]) {
        const l = 3 + r() * 9, ic = poly([[ix - 1.3, TOP + 1], [ix + 1.3, TOP + 1], [ix + (r() - 0.5), TOP + 1 + l]]);
        occ(ic); ink('shadow', ic, 0.35);
      }
      // the roof's load of snow, with a cornice leaning over the front
      const roof = smooth([[792, 884], [791, 872], [800, 861], [818, 853], [850, 848], [890, 844], [932, 846], [962, 850], [982, 860], [988, 874],
        [984, 884], [968, 886], [938, 884], [900, 887], [860, 885], [826, 887], [804, 888]]);
      occ(roof);
      ink('shadow', roof, 1, LG(0, 846, 0, 888, [[0, 0.14], [0.55, 0.22], [1, 0.5]]));
      ink('indigo', roof, 0.08);
      ink('yellow', roof, 1, LG(790, 0, 860, 0, [[0, 0.3], [1, 0]]));
      ink('shadow', key(r, [[791, 872], [800, 861], [818, 853], [850, 848], [890, 844], [932, 846], [962, 850], [982, 860], [988, 874]], 1.4, { brk: 0.05, chip: 0.05 }), 0.5);
      ink('key', key(r, [[804, 888], [826, 887], [860, 885], [900, 887], [938, 884], [968, 886], [984, 884]], 1, { brk: 0.04, chip: 0.06 }), 0.45);
    }

    /* ---- 11. three vending machines: the only strong light */
    {
      const r = R('machines');
      // the first machine's side
      const side = shape([[532, 913], [MACH[0], MTOP], [MACH[0], MBASE], [532, MBASE - 6]], [0, 1, 2, 3]);
      occ(side, C); inks([['indigo', 0.72], ['blue', 0.62]], side, C);
      ink('key', key(r, [[532, 913], [532, 1070]], 1, { brk: 0.01 }), 0.8, null, C);
      const plaster = smooth([[532, 920], [536, 918], [538, 960], [535, 1000], [537, 1040], [533, 1068], [531, 1040], [531, 960]]);
      occ(plaster, C); ink('shadow', plaster, 0.42, null, C); ink('indigo', plaster, 0.12, null, C);

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
        // header
        const hd = rect(mx + 5, MTOP + 4, MW - 10, 10);
        occ(hd, C); ink('yellow', hd, 0.12, null, C);
        if (B.mark === 'wave') ink('blue', carve(r, [[mx + 10, MTOP + 10], [mx + 22, MTOP + 7], [mx + 34, MTOP + 10], [mx + 46, MTOP + 7]], 2.2, { chip: 0 }), 0.75, null, C);
        if (B.mark === 'dot') { ink('red', ell(mx + 41, MTOP + 9, 3, 3, 0), 0.92, null, C); }
        if (B.mark === 'leaf') { inks([['blue', 0.5], ['yellow', 0.9]], ell(mx + 18, MTOP + 9, 5, 2.4, -0.4), C); ink('key', rect(mx + 28, MTOP + 8, 30, kw(1.2)), 0.5, null, C); }
        // the window with its rows of samples
        const wx = mx + 5, wy = MTOP + 17, ww = MW - 10, wh = 64;
        const win = rect(wx, wy, ww, wh);
        occ(win, C);
        ink('yellow', win, 1, LG(0, wy, 0, wy + wh, [[0, 0.1], [1, 0.04]]), C);
        for (let row = 0; row < 3; row++) {
          const ry0 = wy + 2 + row * 21, rb = ry0 + 16;
          let cur = NAMES[(r() * NAMES.length) | 0], run = 0;
          for (let it = 0; it < 8; it++) {
            if (run <= 0) { cur = NAMES[(r() * NAMES.length) | 0]; run = 1 + ((r() * 3) | 0); }
            run--;
            const cx = wx + 4.5 + it * 9, type = r();
            const P = PAL[cur];
            if (type < 0.45) { // a PET bottle
              const h = 12.5 + r() * 1.5, bw = 5.6;
              const b = shape([[cx - bw / 2, rb], [cx - bw / 2, rb - h + 4], [cx - 1.4, rb - h + 1.4], [cx + 1.4, rb - h + 1.4], [cx + bw / 2, rb - h + 4], [cx + bw / 2, rb]], [0, 5]);
              inks(P.map((q) => [q[0], q[1] * 0.55]), b, C);
              inks(P, rect(cx - bw / 2, rb - h * 0.62, bw, h * 0.34), C);
              ink(r() < 0.5 ? 'red' : 'blue', rect(cx - 1.5, rb - h - 0.4, 3, 2), 0.85, null, C);
            } else if (type < 0.8) { // a can
              const h = 10 + r() * 1.2, bw = 5.8;
              inks(P, rect(cx - bw / 2, rb - h, bw, h), C);
              ink('grey', rect(cx - bw / 2, rb - h, bw, 1.3), 0.5, null, C);
              wipe(P[0][0], rect(cx - bw / 2, rb - h * 0.55, bw, h * 0.18), 0.85, null, C);
            } else { // a small coffee can
              const h = 8.4, bw = 4.8;
              inks(PAL[r() < 0.5 ? 'coffee' : cur], rect(cx - bw / 2, rb - h, bw, h), C);
              ink('yellow', rect(cx - bw / 2, rb - h * 0.6, bw, 1.4), 0.7, null, C);
            }
            // selection button: blue for cold, red for hot (the bottom row, in winter)
            ink(row === 2 ? 'red' : 'blue', rect(cx - 2.6, rb + 1.4, 5.2, 1.9), 0.85, null, C);
          }
          ink('key', rect(wx, rb + 3.8, ww, kw(0.6)), 0.5, null, C);
        }
        ink('key', key(r, [[wx, wy], [wx + ww, wy], [wx + ww, wy + wh], [wx, wy + wh], [wx, wy]], 1, { ts: 0, te: 0, chip: 0.04, raw: true }), 0.85, null, C);
        // middle panel: a lit advertisement and the coin unit
        const ad = rect(mx + 7, 994, 46, 40);
        occ(ad, C);
        inks(B.ad.map((q) => [q[0], q[1], LG(0, 994, 0, 1034, [[0, q[1] * 0.4], [1, q[1]]])]), ad, C);
        if (mi === 0) inks([['blue', 0.8]], ell(mx + 30, 1016, 9, 12, 0.15), C);
        if (mi === 1) inks([['brown', 0.75], ['key', 0.3]], shape([[mx + 26, 1031], [mx + 26, 1012], [mx + 28, 1004], [mx + 32, 1004], [mx + 34, 1012], [mx + 34, 1031]], [0, 5]), C);
        if (mi === 2) for (let i = 0; i < 4; i++) inks([['blue', 0.5], ['yellow', 0.8]], ell(mx + 18 + i * 7, 1022 - (i % 2) * 6, 5, 2.4, -0.6 + i * 0.4), C);
        ink('key', key(r, [[mx + 7, 994], [mx + 53, 994], [mx + 53, 1034], [mx + 7, 1034], [mx + 7, 994]], 0.8, { raw: true, ts: 0, te: 0 }), 0.7, null, C);
        const cu = rect(mx + 57, 994, 19, 40);
        occ(cu, C); ink('shadow', cu, 0.14, null, C); ink('grey', cu, 0.12, null, C);
        ink('key', rect(mx + 62, 999, 8, kw(1.6)), 0.9, null, C);
        ink('key', rect(mx + 59.5, 1004, 13, 4.2), 0.85, null, C);
        ink('yellow', rect(mx + 61, 1005, 6, 2), 0.9, null, C);
        ink('key', rect(mx + 59, 1013, 14, kw(1.8)), 0.9, null, C);
        ink('key', ell(mx + 66, 1024, 2.2, 2.2, 0), 0.8, null, C);
        // the slot
        const sl = rect(mx + 10, 1042, 56, 14);
        occ(sl, C); inks([['key', 0.86], ['indigo', 0.4]], sl, C);
        const flap = rect(mx + 10, 1042, 56, 2.2);
        occ(flap, C); ink('shadow', flap, 0.2, null, C);
        ink('key', key(r, [[mx, MTOP], [mx, MBASE]], 1.1, { brk: 0.01, ts: 0, te: 0 }), 0.85, null, C);
        ink('key', key(r, [[mx + MW, MTOP], [mx + MW, MBASE]], 1.1, { brk: 0.01, ts: 0, te: 0 }), 0.85, null, C);
        ink('key', key(r, [[mx, 1060], [mx + MW, 1060]], 0.9, { brk: 0.02 }), 0.6, null, C);
      }
      // snow heaped on the three tops
      const cap = smooth([[530, 913], [528, 903], [537, 896], [560, 892], [600, 890], [640, 893], [680, 888], [720, 891], [760, 887], [790, 891], [800, 899],
        [797, 909], [780, 909.5], [740, 908.5], [700, 909.5], [660, 908.5], [620, 909.5], [580, 909], [545, 911]]);
      occ(cap);
      ink('shadow', cap, 1, LG(0, 888, 0, 911, [[0, 0.12], [0.6, 0.22], [1, 0.48]]));
      ink('indigo', cap, 0.06);
      ink('key', key(r, [[531, 911], [560, 910], [600, 909.4], [640, 909.6], [680, 908.8], [720, 909.6], [760, 908.8], [796, 909.4]], 1, { brk: 0.03, chip: 0.06 }), 0.5);
      ink('shadow', key(r, [[529, 905], [536, 896], [560, 892], [600, 890], [640, 893], [680, 888], [720, 891], [760, 887], [790, 891], [799, 900]], 1.3, { brk: 0.05, chip: 0.05 }), 0.45);
    }

    /* ---- snow banked against the machines and the shelter */
    {
      const r = R('drifts');
      for (let x = 524; x < 985;) {
        const w = 14 + r() * 26, cx = x + w / 2, y = snowLine(cx) + 1.5;
        const lump = blob(r, cx, y, w * 0.62, 3 + r() * 4.5, 9, 0.18);
        occ(lump);
        if (cx < 805) { ink('yellow', lump, 0.36); ink('shadow', lump, 1, LG(0, y - 6, 0, y + 6, [[0, 0.02], [1, 0.14]])); }
        else { ink('yellow', lump, 0.2); ink('shadow', lump, 1, LG(0, y - 6, 0, y + 6, [[0, 0.2], [1, 0.38]])); ink('indigo', lump, 0.12); }
        x += w * (0.55 + r() * 0.35);
      }
    }

    /* ---- 12. the bus-stop sign */
    {
      const r = R('sign');
      const [sx, sb] = SIGN;
      const pole = rect(sx - 1.6, 918, 3.2, sb - 918);
      occ(pole); inks([['grey', 0.6], ['indigo', 0.55]], pole);
      ink('key', key(r, [[sx + 1.4, 918], [sx + 1.4, sb]], 0.8, { brk: 0.01 }), 0.7);
      ink('yellow', rect(sx + 0.4, 960, 1.2, sb - 962), 0.35);
      const tt = rect(sx - 9, 950, 18, 26);
      occ(tt); ink('grey', tt, 0.22); ink('yellow', tt, 0.12); ink('indigo', tt, 0.1);
      ink('yellow', rect(sx, 950, 9, 26), 0.2);
      for (let i = 0; i < 5; i++) ink('key', rect(sx - 7, 955 + i * 4, 9 + r() * 4, kw(0.6)), 0.5);
      ink('key', key(r, [[sx - 9, 950], [sx + 9, 950], [sx + 9, 976], [sx - 9, 976], [sx - 9, 950]], 0.8, { raw: true, ts: 0, te: 0 }), 0.8);
      const ts = blob(r, sx, 948.6, 10, 2, 8, 0.2);
      occ(ts); ink('shadow', ts, 0.25);
      const disc = ell(sx, 905, 15.5, 15.5, 0);
      occ(disc);
      const ring = new Path2D(); ring.arc(sx, 905, 15.5, 0, TAU); ring.arc(sx, 905, 11, 0, TAU, true);
      ink('blue', ring, 0.9); ink('indigo', ring, 0.15);
      ink('yellow', disc, 0.08);
      ink('key', key(r, [[sx - 6, 905], [sx + 6, 905]], 2.6, { ts: 0, te: 0, chip: 0 }), 0.7);
      ink('key', ell(sx - 3.4, 909, 1.4, 1.4, 0), 0.75); ink('key', ell(sx + 3.4, 909, 1.4, 1.4, 0), 0.75);
      ink('key', key(r, crPts([[sx, 889.4], [sx + 15.6, 905], [sx, 920.6], [sx - 15.6, 905]], true, 1).concat([[sx, 889.4]]), 0.9, { raw: true, ts: 0, te: 0 }), 0.8);
      const sc = smooth([[sx - 14, 900], [sx - 12, 892], [sx - 5, 887.5], [sx + 5, 887.5], [sx + 12, 892], [sx + 14.5, 900], [sx + 8, 896], [sx, 894.6], [sx - 8, 896]]);
      occ(sc); ink('shadow', sc, 0.26);
    }

    /* ---- 13. the figure under the red umbrella */
    {
      const r = R('figure');
      const [fx, fy] = FIG;
      const T = (pts) => tr(pts, fx, fy);
      const fclip = { clip: poly(T([[-60, -260], [60, -260], [60, -3.5], [30, -2], [10, -4.5], [-10, -3], [-30, -4], [-60, -3]])) };
      // legs and boots
      for (const lx of [[-13, -4], [3, 12]]) {
        const leg = shape(T([[lx[0], -20], [lx[1], -20], [lx[1] + 0.8, 0], [lx[0] - 0.8, 0]]), [0, 1, 2, 3]);
        occ(leg, fclip); inks([['indigo', 0.92], ['key', 0.55], ['grey', 0.2]], leg, fclip);
      }
      // coat
      const coatPts = [[-8, -127], [-14, -125.5], [-19.5, -122], [-22.5, -115], [-24, -104], [-25.2, -90], [-26, -76], [-26.4, -66], [-24.6, -62],
        [-24.8, -50], [-26, -36], [-27.6, -22], [-28.4, -17.5], [-14, -15.6], [0, -15], [14, -15.6], [26.5, -17.8], [25.5, -28], [23.6, -46],
        [21.6, -62], [21, -74], [23.6, -86], [26.5, -97], [24.6, -107], [20, -115], [15.5, -121], [9, -125.5], [6, -130], [-5, -131]];
      const coat = shape(T(coatPts), [12, 16]);
      occ(coat, fclip);
      ink('blue', coat, 0.72, null, fclip);
      ink('indigo', coat, 1, LG(fx - 29, 0, fx + 28, 0, [[0, 1], [0.55, 0.9], [0.85, 0.62], [1, 0.3]]), fclip);
      ink('grey', coat, 0.18, null, fclip);
      ink('key', coat, 1, LG(fx - 29, 0, fx + 10, 0, [[0, 0.35], [1, 0]]), fclip);
      // the lit edge on the side facing the machines
      const rim = T([[26, -22], [23.4, -46], [21.4, -62], [20.8, -74], [23.4, -86], [26.2, -97], [24.4, -107], [19.8, -115]]);
      const rimP = carve(r, rim, 3.2, { ts: 6, te: 8, chip: 0, sw: 0.3, off: 1.2 });
      wipe('indigo', rimP, 0.62, null, fclip); wipe('key', rimP, 1, null, fclip); ink('yellow', rimP, 0.35, null, fclip);
      // folds, seam, the arm against the body
      ink('key', key(r, T([[-1, -97], [-0.5, -60], [0.2, -17]]), 1.1, { ts: 6, te: 2, brk: 0.01 }), 0.85, null, fclip);
      ink('key', key(r, T([[-18.5, -116], [-20, -90], [-21, -64]]), 1.0, { ts: 8, te: 8 }), 0.75, null, fclip);
      ink('key', key(r, T([[-24, -84], [-8, -85.5], [10, -85], [23, -83.5]]), 0.9, { ts: 4, te: 4, brk: 0.03 }), 0.6, null, fclip);
      ink('key', key(r, T([[12, -70], [14, -46], [15.5, -22]]), 0.8, { ts: 10, te: 10 }), 0.45, null, fclip);
      ink('key', key(r, T([[-14, -66], [-15, -40], [-15.8, -20]]), 0.8, { ts: 10, te: 10 }), 0.45, null, fclip);
      ink('key', key(r, T(coatPts.slice(0, 14)), 1.3, { ts: 3, te: 3, chip: 0.03 }), 0.9, null, fclip);
      // scarf
      const scarf = smooth(T([[-10, -127], [-8.5, -133.5], [0, -135], [8, -133], [11.5, -127.5], [6, -124.5], [-2, -123.5]]));
      occ(scarf); inks([['yellow', 0.62], ['grey', 0.32], ['red', 0.14]], scarf);
      const tail = smooth(T([[-6, -125], [-9.5, -108], [-5.6, -103.5], [-2.4, -122]]));
      occ(tail, fclip); inks([['yellow', 0.55], ['grey', 0.38], ['red', 0.12], ['indigo', 0.12]], tail, fclip);
      ink('key', key(r, T([[-9, -108], [-5.8, -104]]), 0.7, { ts: 0, te: 0 }), 0.7);
      // head: hair, and the edge of a cheek turned toward the road
      const head = ell(fx - 3, fy - 140, 8.6, 10.4, 0.12);
      occ(head); inks([['key', 0.86], ['indigo', 0.6]], head);
      const cheek = smooth(T([[-11.3, -141], [-10.2, -134], [-7, -130.6], [-8.7, -137]]));
      occ(cheek); ink('yellow', cheek, 0.2); ink('red', cheek, 0.07);
      // the plastic bag from the shop, in the left hand
      ink('key', key(r, T([[-26.4, -60], [-30.5, -52.5]]), 0.7, { ts: 0, te: 0 }), 0.8);
      ink('key', key(r, T([[-25.4, -60], [-23.4, -52.5]]), 0.7, { ts: 0, te: 0 }), 0.8);
      const bagPts = T([[-33.5, -52.5], [-22.2, -52.5], [-20.4, -44], [-19.8, -36], [-22.6, -31], [-31, -30.6], [-34.6, -35.6], [-34.8, -45]]);
      const bag = smooth(bagPts);
      occ(bag); ink('shadow', bag, 0.2); ink('grey', bag, 0.06);
      ink('blue', rect(fx - 35, fy - 46.6, 16, 2), 0.42, null, { clip: bag });
      ink('shadow', bag, 1, LG(fx - 35, 0, fx - 20, 0, [[0, 0.25], [1, 0]]));
      ink('key', key(r, bagPts.concat([bagPts[0]]), 0.75, { ts: 0, te: 0, chip: 0.05 }), 0.75);
      const hand = ell(fx - 25.8, fy - 60, 2.5, 3, 0.2);
      occ(hand); ink('yellow', hand, 0.25); ink('red', hand, 0.08); ink('key', key(r, T([[-30, -61], [-28, -58], [-25.5, -59.5]]), 0.6, { ts: 0, te: 0 }), 0.6);

      // the umbrella, resting on the right shoulder, tilted back toward us
      const ucx = fx + 34, ucy = fy - 160, urx = 43, ury = 33, urot = -0.32;
      ink('key', key(r, T([[9, -131], [13, -119]]), 1.4, { ts: 0, te: 0 }), 0.9);
      const cs = Math.cos(urot), sn = Math.sin(urot);
      const E = (a, s) => { const x = Math.cos(a) * urx * (s || 1), y = Math.sin(a) * ury * (s || 1); return [ucx + x * cs - y * sn, ucy + x * sn + y * cs]; };
      const apex = [ucx + 6, ucy - 6];
      const a0 = 0.25 + r() * 0.2, tips = [], mids = [];
      for (let i = 0; i < 8; i++) { tips.push(E(a0 + (i * TAU) / 8)); mids.push(E(a0 + ((i + 0.5) * TAU) / 8, 1.03)); }
      const canopy = new Path2D();
      canopy.moveTo(tips[0][0], tips[0][1]);
      for (let i = 0; i < 8; i++) { const m = mids[i], t = tips[(i + 1) % 8]; canopy.quadraticCurveTo(m[0], m[1], t[0], t[1]); }
      canopy.closePath();
      occ(canopy);
      ink('red', canopy, 0.93);
      ink('indigo', canopy, 1, LG(ucx - 40, ucy - 30, ucx + 40, ucy + 30, [[0, 0.38], [0.5, 0.18], [1, 0.02]]));
      for (let i = 0; i < 8; i++) {
        const p = new Path2D(); const t1 = tips[i], t2 = tips[(i + 1) % 8], m = mids[i];
        p.moveTo(apex[0], apex[1]); p.lineTo(t1[0], t1[1]); p.quadraticCurveTo(m[0], m[1], t2[0], t2[1]); p.closePath();
        if (i % 2) ink('red', p, 0.25); else ink('indigo', p, 0.07);
      }
      ink('yellow', canopy, 1, LG(ucx + 10, ucy + 10, ucx + 46, ucy + 30, [[0, 0], [1, 0.4]]));
      for (let i = 0; i < 8; i++) ink('key', key(r, [apex, tips[i]], 0.75, { raw: false, ts: 2, te: 6, chip: 0.03 }), 0.7);
      const rimPts = [];
      for (let i = 0; i < 8; i++) {
        const t1 = tips[i], m = mids[i], t2 = tips[(i + 1) % 8];
        for (let j = 0; j < 8; j++) { const t = j / 8, u = 1 - t; rimPts.push([u * u * t1[0] + 2 * u * t * m[0] + t * t * t2[0], u * u * t1[1] + 2 * u * t * m[1] + t * t * t2[1]]); }
      }
      rimPts.push(tips[0]);
      ink('key', key(r, rimPts, 1.0, { raw: true, ts: 0, te: 0, chip: 0.04 }), 0.85);
      ink('key', ell(apex[0], apex[1], 1.6, 1.6, 0), 0.9);
      // snow lying on the upper part of the canopy
      const big = new Path2D(); big.ellipse(ucx, ucy - 1, urx * 1.06, ury * 1.08, urot, 0, TAU);
      const sl = [];
      for (let i = 0; i <= 12; i++) { const t = i / 12; sl.push([ucx - 52 + 104 * t, ucy - 10 + Math.sin(t * Math.PI) * -5 + (t - 0.5) * 18 + (r() - 0.5) * 3.2]); }
      const snowTop = poly(sl.concat([[ucx + 60, ucy - 80], [ucx - 60, ucy - 80]]));
      occ(snowTop, { clip: big });
      ink('shadow', snowTop, 1, LG(0, ucy - 46, 0, ucy - 4, [[0, 0.12], [1, 0.36]]), { clip: big });
      ink('shadow', carve(r, sl, 2.4, { ts: 0, te: 0, chip: 0, sw: 0.5 }), 0.25, null, { clip: big });
    }

    /* ---- 14. the cat, in the light, watching the figure */
    {
      const r = R('cat');
      const [cx, cy] = CAT;
      const T = (pts) => tr(pts, cx, cy);
      const pts = T([[-12.2, -26.4], [-11.2, -29.2], [-8.8, -31.6], [-8.4, -38], [-4.6, -32.8], [-1.2, -33.2], [1.6, -37.4], [3.6, -31], [5, -28], [6.4, -23],
        [9, -18], [11.6, -12], [12.6, -6], [11.6, -1.6], [8, 0], [-2, 0.4], [-8, 0], [-10.5, -1], [-10, -4], [-10.6, -10], [-11, -16], [-9.6, -21], [-10.6, -24]]);
      const body = shape(pts, [3, 6, 0]);
      const tail = carve(r, T([[10, -1.4], [7, 1.4], [0, 2.4], [-7, 2], [-11, 0.6], [-13.8, -2]]), 3.2, { ts: 0, te: 8, tmin: 0.3, chip: 0, sw: 0.1 });
      for (const p of [body, tail]) { occ(p); inks([['grey', 0.5], ['indigo', 0.95], ['key', 0.6]], p); }
      const rim = carve(r, T([[1.8, -36.4], [3.8, -31], [5.3, -27], [6.8, -22], [9.4, -17], [11.9, -11], [12.7, -5.5]]), 1.4, { ts: 2, te: 3, chip: 0, off: 0.5 });
      wipe('key', rim, 0.95); wipe('indigo', rim, 0.55); ink('yellow', rim, 0.45);
      const eye = ell(cx - 7.6, cy - 28.6, 0.9, 0.7, 0);
      occ(eye); ink('yellow', eye, 0.9);
    }

    /* ---- 16. dry grasses in the foreground snow */
    {
      const r = R('grass');
      const tufts = [[118, 1508, 9], [210, 1512, 6], [892, 1510, 8], [962, 1514, 5]];
      for (const tf of tufts) {
        for (let i = 0; i < tf[2]; i++) {
          const x = tf[0] + (r() - 0.5) * 50, y = tf[1];
          const h = 50 + r() * 120, lean = (r() - 0.5) * 70, bend = (r() - 0.3) * 40;
          const pts = [[x, y], [x + lean * 0.3, y - h * 0.45], [x + lean * 0.8 + bend * 0.3, y - h * 0.85], [x + lean + bend, y - h + Math.abs(bend) * 0.4]];
          const st = carve(r, pts, 2.4 + r() * 1.4, { ts: 0, te: 30, tmin: 0.15, chip: 0.04, brk: 0.004 });
          occ(st); inks([['brown', 0.7], ['key', 0.6], ['indigo', 0.2]], st);
          const tip = pts[3];
          if (r() < 0.55) {
            const plume = blob(r, tip[0] - (lean + bend) * 0.05, tip[1] + 8, 3.2, 10, 8, 0.25, Math.atan2(lean + bend, h) * 0.6);
            occ(plume); inks([['brown', 0.45], ['yellow', 0.3], ['key', 0.15]], plume);
          }
          if (r() < 0.7) {
            const q = pts[1 + ((r() * 2) | 0)];
            const sb = blob(r, q[0] + 2, q[1] - 2, 4 + r() * 4, 2 + r() * 1.6, 8, 0.25);
            occ(sb); ink('shadow', sb, 0.3);
          }
        }
      }
    }

    /* ---- 17. falling snow: gofun, printed last over everything */
    const cart = { x: 28, y: 28, w: 64, h: 236 };
    {
      const r = R('flakes');
      const buckets = [new Path2D(), new Path2D(), new Path2D()];
      const avoid = [[CAT[0] - 4, CAT[1] - 22, 22], [FIG[0] - 2, FIG[1] - 140, 16], [670, 950, 0]];
      const n = 420 + ((r() * 220) | 0);
      for (let i = 0; i < n; i++) {
        const x = r() * IW, y = r() * IH;
        let rad = 1.2 + 7.8 * Math.pow(r(), 3.6);
        if (x > cart.x - 4 && x < cart.x + cart.w + 4 && y > cart.y - 4 && y < cart.y + cart.h + 4) continue;
        let skip = false;
        for (const a of avoid) if (rad > 2.2 && Math.hypot(x - a[0], y - a[1]) < a[2] + rad) skip = true;
        if (skip) rad = 1.2;
        const b = r() < 0.55 ? 0 : r() < 0.7 ? 1 : 2;
        blob(r, x, y, rad, rad * (0.8 + r() * 0.3), 7, 0.24, r() * TAU, buckets[b]);
      }
      ink('gofun', buckets[0], 0.95); ink('gofun', buckets[1], 0.8); ink('gofun', buckets[2], 0.6);
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
      // publisher's round seal
      const ps = [36, 1572];
      const ring = new Path2D(); ring.arc(ps[0], ps[1], 18.5, 0, TAU); ring.arc(ps[0], ps[1], 15.2, 0, TAU, true);
      ink('seal', ring, 0.92, null, F);
      const inner = new Path2D();
      glyph(r, '宝', ps[0] - 12, ps[1] - 12, 11.5, 1.9, { jit: 3 }, inner);
      glyph(r, '来', ps[0] + 0.5, ps[1] - 12, 11.5, 1.9, { jit: 3 }, inner);
      glyph(r, '冬', ps[0] - 12, ps[1] + 0.5, 11.5, 1.9, { jit: 3 }, inner);
      glyph(r, '水', ps[0] + 0.5, ps[1] + 0.5, 11.5, 1.9, { jit: 3 }, inner);
      ink('seal', inner, 0.9, null, F);
      // kento: the registration marks, faintly inked
      ink('shadow', key(r, [[1010, 1626], [1040, 1626], [1040, 1598]], 2.4, { raw: true, ts: 0, te: 0, chip: 0.1, brk: 0.03 }), 0.16, null, F);
      ink('shadow', key(r, [[300, 1626], [348, 1626]], 2.4, { ts: 0, te: 0, chip: 0.1, brk: 0.03 }), 0.14, null, F);
      // impression number in pencil
      const num = String(1 + (seed % 200)) + '/200';
      const dh = 15, dw = 9.6, gap = 3.4;
      let x = IW - 4 - num.length * (dw + gap);
      const pen = new Path2D();
      for (const ch of num) {
        const d = DIGITS[ch];
        if (d) carve(r, d.map((p) => [x + p[0] * dw / 10 + (r() - 0.5) * 0.3, 1566 + p[1] * dh / 16 + (r() - 0.5) * 0.3]), 1.05, { ts: 1.5, te: 2.5, tmin: 0.4, sw: 0.25, chip: 0.05, step: 0.5 }, pen);
        x += dw + gap;
      }
      ink('pencil', pen, 0.85, null, F);
      // flecks of bark in the washi
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
    up(smooth([[792, 884], [791, 872], [800, 861], [818, 853], [850, 848], [890, 844], [932, 846], [962, 850], [982, 860], [988, 874], [984, 884], [900, 887], [804, 888]]), 0.55);
    up(smooth([[530, 913], [528, 903], [537, 896], [600, 890], [680, 888], [760, 887], [800, 899], [797, 909], [545, 911]]), 0.55);
    up(blob(r, 100, 868.5, 57, 4.2, 18, 0.12), 0.5);
    const kd = 0.6;
    ops.push(Object.assign({ p: 'relief', path: carve(r, [[1010, 1626], [1040, 1626], [1040, 1598]], 3, { raw: true, ts: 0, te: 0, chip: 0 }), a: kd, erase: true }, F));
    ops.push(Object.assign({ p: 'relief', path: carve(r, [[300, 1626], [348, 1626]], 3, { ts: 0, te: 0, chip: 0 }), a: kd, erase: true }, F));
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
        const cl = 1 + 0.06 * (L[rl + (x >> 2)] / 255 - 0.5) + 0.012 * (M[rm + (x >> 1)] / 255 - 0.5);
        const f = Fib[i] * 7.5;
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
      const ox = ink.reg ? (pr() - 0.5) * 2 * ink.reg : 0, oy = ink.reg ? (pr() - 0.5) * 2 * ink.reg : 0;
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
