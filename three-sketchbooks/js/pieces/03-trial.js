/* 03 — The Goose Trial.
 * A courtroom sketch drawn live, at reportage speed, on toned pastel paper.
 * Every mark is an authored stroke (path, pressure, speed, tool) replayed in order.
 * The defendant will not sit still, so the sheet keeps its earlier necks.
 */
(function () {
  'use strict';
  const TAU = Math.PI * 2;

  /* ------------------------------------------------------------------ util */
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hash2(a, b) {
    let h = (a ^ 0x9e3779b9) >>> 0;
    h = Math.imul(h ^ (b + 0x7f4a7c15), 0x85ebca6b) >>> 0;
    h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
    return (h ^ (h >>> 16)) >>> 0;
  }
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const lerp = (a, b, t) => a + (b - a) * t;
  const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

  // "x,y x,y,p | x,y ..." -> [[ [x,y,p], ... ], ...]
  function parse(s) {
    return s.split('|').map((part) => part.trim().split(/\s+/).filter(Boolean).map((q) => {
      const v = q.split(',').map(Number);
      return [v[0], v[1], v.length > 2 ? v[2] : 1];
    })).filter((l) => l.length);
  }

  // Catmull-Rom through points (with pressure), then resample at even arc length.
  function smoothPath(pts, step) {
    // a sharp turn in the authored polyline is a corner, not a curve
    if (pts.length > 2) {
      const q = [pts[0]];
      for (let i = 1; i < pts.length - 1; i++) {
        const a = pts[i - 1], b = pts[i], c = pts[i + 1];
        const a1 = Math.atan2(b[1] - a[1], b[0] - a[0]), a2 = Math.atan2(c[1] - b[1], c[0] - b[0]);
        let da = Math.abs(a2 - a1); if (da > Math.PI) da = TAU - da;
        q.push(b);
        if (da > 1.05 && (b[0] !== a[0] || b[1] !== a[1]) && (b[0] !== c[0] || b[1] !== c[1])) q.push(b);
      }
      q.push(pts[pts.length - 1]);
      pts = q;
    }
    if (pts.length === 1) return [[pts[0][0], pts[0][1], pts[0][2]], [pts[0][0] + 0.4, pts[0][1] + 0.3, pts[0][2]]];
    const out = [];
    const n = pts.length;
    for (let i = 0; i < n - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(n - 1, i + 2)];
      const seg = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
      const k = Math.max(2, Math.ceil(seg / (step * 0.5)));
      for (let j = 0; j < k; j++) {
        const t = j / k, t2 = t * t, t3 = t2 * t;
        const x = 0.5 * ((2 * p1[0]) + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3);
        const y = 0.5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3);
        out.push([x, y, lerp(p1[2], p2[2], t)]);
      }
    }
    const l = pts[n - 1];
    out.push([l[0], l[1], l[2]]);
    return resample(out, step);
  }
  function resample(pts, step) {
    const out = [pts[0].slice()];
    let acc = 0;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i];
      let d = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (d === 0) continue;
      let t0 = 0;
      while (acc + d * (1 - t0) >= step) {
        const need = step - acc;
        t0 += need / d;
        out.push([lerp(a[0], b[0], t0), lerp(a[1], b[1], t0), lerp(a[2], b[2], t0)]);
        acc = 0;
      }
      acc += d * (1 - t0);
    }
    const l = pts[pts.length - 1], q = out[out.length - 1];
    if (Math.hypot(l[0] - q[0], l[1] - q[1]) > step * 0.25) out.push(l.slice());
    return out;
  }
  function pathLen(d) { let L = 0; for (let i = 1; i < d.length; i++) L += Math.hypot(d[i][0] - d[i - 1][0], d[i][1] - d[i - 1][1]); return L; }
  function pip(poly, x, y) {
    let c = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const a = poly[i], b = poly[j];
      if ((a[1] > y) !== (b[1] > y) && x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0]) c = !c;
    }
    return c;
  }
  function noise1(rnd) {
    const v = []; for (let i = 0; i < 64; i++) v.push(rnd() * 2 - 1);
    return (t) => { const i = Math.floor(t), f = t - i, a = v[((i % 64) + 64) % 64], b = v[(((i + 1) % 64) + 64) % 64]; const s = f * f * (3 - 2 * f); return a + (b - a) * s; };
  }

  /* -------------------------------------------------------- the handwriting
   * Single-stroke glyphs, y up, baseline 0, x-height 1, caps 1.45.
   * Duplicated points make corners. "|" lifts the pen. */
  const GLYPH = {
    a: [0.95, '0.8,0.82 0.55,1 0.22,0.92 0.04,0.52 0.16,0.08 0.45,0 0.72,0.25 0.84,0.62 0.86,1 0.86,1 0.82,0.25 0.88,0.02 1.0,0.06'],
    b: [0.88, '0.12,1.55 0.12,1.55 0.08,0.4 0.1,0.02 | 0.09,0.55 0.35,0.95 0.7,0.9 0.85,0.5 0.7,0.1 0.35,0 0.1,0.12'],
    c: [0.8, '0.8,0.85 0.55,1 0.2,0.9 0.03,0.5 0.18,0.08 0.5,0 0.82,0.18'],
    d: [0.95, '0.8,0.82 0.55,1 0.22,0.92 0.04,0.52 0.16,0.08 0.45,0 0.72,0.25 0.82,0.6 | 0.86,1.55 0.86,1.55 0.82,0.25 0.88,0.02 1.0,0.06'],
    e: [0.85, '0.1,0.5 0.8,0.55 0.75,0.85 0.45,1 0.12,0.85 0.03,0.45 0.2,0.08 0.5,0 0.82,0.15'],
    f: [0.68, '0.75,1.45 0.55,1.58 0.32,1.45 0.25,1 0.22,0.3 0.18,-0.1 | 0,0.95 0.62,1.0'],
    g: [0.92, '0.8,0.82 0.55,1 0.22,0.92 0.05,0.55 0.18,0.15 0.45,0.08 0.72,0.3 0.82,0.65 0.85,1 0.85,1 0.83,0 0.75,-0.4 0.45,-0.55 0.12,-0.42'],
    h: [0.9, '0.1,1.55 0.1,1.55 0.08,0 | 0.1,0.55 0.35,0.92 0.65,0.95 0.78,0.6 0.78,0.25 0.82,0'],
    i: [0.34, '0.12,0.95 0.12,0.95 0.1,0.15 0.18,0 | 0.12,1.35 0.15,1.39'],
    j: [0.42, '0.3,0.95 0.3,0.95 0.28,0 0.2,-0.4 -0.05,-0.55 | 0.32,1.35 0.35,1.39'],
    k: [0.8, '0.1,1.55 0.1,1.55 0.08,0 | 0.7,0.95 0.7,0.95 0.12,0.42 0.12,0.42 0.4,0.5 0.75,0'],
    l: [0.36, '0.12,1.55 0.12,1.55 0.1,0.2 0.2,0 0.3,0.05'],
    m: [1.12, '0.08,0.95 0.08,0.95 0.07,0 | 0.08,0.6 0.25,0.95 0.45,0.9 0.52,0.5 0.52,0 | 0.52,0.6 0.7,0.95 0.9,0.9 0.98,0.5 0.98,0'],
    n: [0.86, '0.08,0.95 0.08,0.95 0.07,0 | 0.08,0.55 0.35,0.95 0.65,0.92 0.75,0.55 0.76,0'],
    o: [0.88, '0.5,1 0.15,0.88 0.03,0.45 0.22,0.04 0.55,0 0.82,0.3 0.84,0.7 0.6,0.98 0.38,0.97'],
    p: [0.86, '0.1,0.95 0.1,0.95 0.07,-0.55 | 0.08,0.6 0.35,0.98 0.7,0.9 0.85,0.5 0.7,0.1 0.35,0.02 0.1,0.15'],
    q: [0.92, '0.8,0.82 0.55,1 0.22,0.92 0.04,0.52 0.16,0.08 0.45,0 0.72,0.25 0.82,0.6 | 0.84,1 0.84,1 0.82,-0.55 0.95,-0.4'],
    r: [0.66, '0.08,0.95 0.08,0.95 0.07,0 | 0.08,0.55 0.3,0.92 0.55,1 0.7,0.92'],
    s: [0.76, '0.72,0.88 0.45,1 0.15,0.9 0.12,0.65 0.45,0.5 0.75,0.32 0.7,0.08 0.4,0 0.05,0.1'],
    t: [0.6, '0.3,1.35 0.3,1.35 0.27,0.25 0.35,0.02 0.55,0.05 | 0.02,0.92 0.6,0.95'],
    u: [0.9, '0.08,0.95 0.08,0.95 0.08,0.35 0.25,0.02 0.55,0.02 0.75,0.35 | 0.78,0.95 0.78,0.95 0.77,0.15 0.85,0'],
    v: [0.8, '0.02,0.95 0.02,0.95 0.4,0 0.4,0 0.78,0.95'],
    w: [1.06, '0.02,0.95 0.02,0.95 0.28,0 0.28,0 0.52,0.75 0.52,0.75 0.76,0 0.76,0 1.02,0.95'],
    x: [0.8, '0.05,0.95 0.05,0.95 0.75,0 | 0.75,0.95 0.75,0.95 0.05,0'],
    y: [0.82, '0.05,0.95 0.05,0.95 0.4,0.05 | 0.78,0.95 0.78,0.95 0.4,0.05 0.25,-0.4 0.05,-0.55'],
    z: [0.85, '0.05,0.92 0.05,0.92 0.75,0.95 0.75,0.95 0.05,0.02 0.05,0.02 0.8,0.03'],
    A: [0.95, '0,0 0,0 0.45,1.45 0.45,1.45 0.9,0 | 0.18,0.55 0.75,0.55'],
    B: [0.92, '0.1,0 0.1,0 0.1,1.45 | 0.1,1.45 0.55,1.42 0.75,1.15 0.55,0.78 0.12,0.75 0.65,0.72 0.85,0.38 0.6,0.03 0.1,0'],
    C: [1.0, '0.95,1.2 0.7,1.45 0.3,1.35 0.05,0.75 0.25,0.1 0.6,0 0.95,0.22'],
    D: [0.98, '0.1,0 0.1,0 0.1,1.45 | 0.1,1.45 0.55,1.4 0.88,1.0 0.88,0.45 0.55,0.05 0.1,0'],
    E: [0.9, '0.82,1.45 0.82,1.45 0.1,1.45 0.1,1.45 0.1,0 0.1,0 0.85,0 | 0.1,0.75 0.65,0.75'],
    F: [0.86, '0.82,1.45 0.82,1.45 0.1,1.45 0.1,1.45 0.1,0 | 0.1,0.75 0.62,0.75'],
    G: [1.0, '0.95,1.2 0.7,1.45 0.3,1.35 0.05,0.75 0.25,0.1 0.6,0 0.92,0.25 0.92,0.65 0.92,0.65 0.55,0.65'],
    H: [0.98, '0.1,1.45 0.1,1.45 0.1,0 | 0.85,1.45 0.85,1.45 0.85,0 | 0.1,0.75 0.85,0.75'],
    I: [0.34, '0.15,1.45 0.15,1.45 0.15,0'],
    J: [0.82, '0.7,1.45 0.7,1.45 0.68,0.35 0.45,0 0.15,0.05 0.02,0.3'],
    K: [0.92, '0.1,1.45 0.1,1.45 0.1,0 | 0.85,1.45 0.85,1.45 0.12,0.6 | 0.35,0.85 0.35,0.85 0.9,0'],
    L: [0.82, '0.1,1.45 0.1,1.45 0.1,0 0.1,0 0.8,0'],
    M: [1.14, '0.05,0 0.05,0 0.12,1.45 0.12,1.45 0.55,0.45 0.55,0.45 0.98,1.45 0.98,1.45 1.05,0'],
    N: [0.98, '0.1,0 0.1,0 0.1,1.45 0.1,1.45 0.85,0 0.85,0 0.85,1.45'],
    O: [1.02, '0.5,1.45 0.15,1.25 0.03,0.7 0.2,0.1 0.55,0 0.9,0.3 0.95,0.85 0.7,1.4 0.4,1.42'],
    P: [0.86, '0.1,0 0.1,0 0.1,1.45 | 0.1,1.45 0.55,1.42 0.8,1.1 0.6,0.72 0.12,0.68'],
    Q: [1.02, '0.5,1.45 0.15,1.25 0.03,0.7 0.2,0.1 0.55,0 0.9,0.3 0.95,0.85 0.7,1.4 0.4,1.42 | 0.55,0.35 0.55,0.35 0.95,-0.1'],
    R: [0.92, '0.1,0 0.1,0 0.1,1.45 | 0.1,1.45 0.55,1.42 0.8,1.1 0.6,0.72 0.12,0.68 | 0.35,0.7 0.35,0.7 0.85,0'],
    S: [0.9, '0.85,1.25 0.55,1.45 0.2,1.35 0.12,1.0 0.45,0.78 0.8,0.55 0.82,0.2 0.5,0 0.05,0.15'],
    T: [0.92, '0.0,1.45 0.0,1.45 0.9,1.45 | 0.45,1.45 0.45,1.45 0.45,0'],
    U: [0.98, '0.1,1.45 0.1,1.45 0.1,0.4 0.3,0.02 0.6,0.02 0.85,0.4 0.85,1.45'],
    V: [0.92, '0,1.45 0,1.45 0.45,0 0.45,0 0.9,1.45'],
    W: [1.24, '0,1.45 0,1.45 0.3,0 0.3,0 0.6,1.0 0.6,1.0 0.9,0 0.9,0 1.2,1.45'],
    X: [0.92, '0.05,1.45 0.05,1.45 0.85,0 | 0.85,1.45 0.85,1.45 0.05,0'],
    Y: [0.92, '0,1.45 0,1.45 0.45,0.7 | 0.9,1.45 0.9,1.45 0.45,0.7 0.45,0.7 0.45,0'],
    Z: [0.96, '0.05,1.45 0.05,1.45 0.85,1.45 0.85,1.45 0.05,0 0.05,0 0.9,0'],
    0: [0.82, '0.45,1.4 0.12,1.15 0.05,0.6 0.2,0.05 0.5,0 0.75,0.35 0.78,0.9 0.6,1.35 0.4,1.38'],
    1: [0.6, '0.15,1.1 0.15,1.1 0.42,1.4 0.42,1.4 0.4,0'],
    2: [0.82, '0.08,1.1 0.35,1.4 0.65,1.32 0.72,1.0 0.4,0.55 0.05,0.0 0.05,0.0 0.8,0.02'],
    3: [0.8, '0.1,1.25 0.4,1.4 0.7,1.25 0.62,0.88 0.32,0.75 0.7,0.62 0.75,0.25 0.45,0 0.05,0.12'],
    4: [0.86, '0.6,0 0.6,0 0.6,1.4 0.6,1.4 0.02,0.4 0.02,0.4 0.85,0.42'],
    5: [0.8, '0.75,1.4 0.75,1.4 0.2,1.4 0.2,1.4 0.12,0.78 0.45,0.85 0.72,0.6 0.72,0.25 0.45,0 0.05,0.1'],
    6: [0.8, '0.7,1.3 0.45,1.4 0.15,1.15 0.05,0.55 0.2,0.05 0.5,0 0.72,0.3 0.65,0.7 0.35,0.78 0.08,0.55'],
    7: [0.8, '0.05,1.4 0.05,1.4 0.8,1.4 0.8,1.4 0.3,0'],
    8: [0.8, '0.42,0.75 0.12,0.95 0.15,1.3 0.45,1.4 0.72,1.25 0.68,0.95 0.4,0.75 0.08,0.5 0.12,0.1 0.45,0 0.75,0.15 0.75,0.5 0.42,0.75'],
    9: [0.8, '0.72,0.95 0.45,0.7 0.12,0.85 0.1,1.25 0.45,1.4 0.72,1.2 0.72,0.6 0.55,0.1 0.2,0.02'],
    '.': [0.3, '0.1,0 0.14,0.04'],
    ',': [0.3, '0.15,0.06 0.04,-0.28'],
    ':': [0.32, '0.12,0.72 0.15,0.76 | 0.1,0.02 0.13,0.06'],
    "'": [0.26, '0.12,1.5 0.08,1.1'],
    '"': [0.42, '0.12,1.5 0.08,1.1 | 0.32,1.5 0.28,1.1'],
    '-': [0.55, '0.05,0.5 0.5,0.53'],
    '~': [0.95, '0.05,1.15 0.3,1.25 0.6,1.1 0.9,1.2'],
    '(': [0.42, '0.36,1.5 0.08,0.6 0.34,-0.3'],
    ')': [0.42, '0.06,1.5 0.34,0.6 0.08,-0.3'],
    '?': [0.72, '0.08,1.15 0.35,1.42 0.65,1.25 0.6,0.9 0.35,0.62 0.33,0.35 | 0.33,0.02 0.35,0.06'],
    '!': [0.32, '0.15,1.45 0.15,1.45 0.13,0.4 | 0.13,0.02 0.15,0.06'],
    '/': [0.62, '0,-0.1 0,-0.1 0.6,1.45'],
    '+': [0.75, '0.05,0.55 0.65,0.57 | 0.35,0.9 0.34,0.2'],
    '=': [0.7, '0.05,0.75 0.6,0.77 | 0.05,0.35 0.6,0.37'],
    '#': [0.9, '0.3,1.2 0.2,0 | 0.65,1.2 0.55,0 | 0.02,0.8 0.85,0.82 | 0.0,0.38 0.82,0.4'],
  };
  const GLYPHS = {};
  for (const k in GLYPH) GLYPHS[k] = { w: GLYPH[k][0], s: parse(GLYPH[k][1]) };

  /* ------------------------------------------------------------- palette */
  const INK = '#1e1915';
  const COL = {
    sienna: '#9b5b37', white: '#f7f2e7', cream: '#ecdfc2', bluegrey: '#6c7c8e', coolgrey: '#8f949c', slate: '#4a5260',
    black: '#1c1b21', navy: '#26303f', charcoal: '#34363b', brownsuit: '#5a4636', greysuit: '#6b6e72',
    skin: '#e2ad8c', skinlt: '#f0c9aa', skinmid: '#c98663', skindk: '#8f5139', blush: '#d07a6a',
    orange: '#ea7f24', orangelt: '#f6b04a', burgundy: '#76212c', crimson: '#a83239', gold: '#c99a3a',
    tie: '#b3302a', khaki: '#b8a072', olive: '#545a3c', yellow: '#e6cf52', green: '#6f9a3c', tomato: '#cf4a33',
    egg: '#e9c24c', plum: '#6b3a5a', teal: '#3c6e6e', mustard: '#c08f2a', hairdk: '#2a211b', hairbr: '#5b3f2b',
    grey: '#9b9ca0', silver: '#cfcdc8', carpet: '#4f6377', denim: '#3d5878',
  };
  const ROOMS = [
    { name: 'mahogany', paper: '#c3a57e', paper2: '#b49671', wood: ['#4f2219', '#7a3a24', '#9c5636', '#c08058'], carpet: '#3f5a52', chair: '#33150f' },
    { name: 'oak', paper: '#a6a399', paper2: '#97948a', wood: ['#5e4122', '#8c6536', '#b08650', '#d1ab72'], carpet: '#5a3c3c', chair: '#46201a' },
    { name: 'walnut', paper: '#8f9ba4', paper2: '#828e98', wood: ['#33261c', '#55402d', '#735a40', '#9a7d5c'], carpet: '#3e5266', chair: '#2e1a16' },
  ];

  /* ------------------------------------------------------------ builder */
  function Builder(seed, layout) {
    const R = mulberry32(seed);
    const B = {
      S: [], sils: [], R, layout, tf: { k: 1, dx: 0, dy: 0 }, z: 5, group: '',
      rnd: (a, b) => a + (b - a) * R(),
      pick: (arr) => arr[Math.floor(R() * arr.length) % arr.length],
      chance: (p) => R() < p,
    };
    const N = noise1(R);
    let noiseOff = 0;
    B.at = function (g) { B.tf = layout.g[g] || { k: 1, dx: 0, dy: 0 }; B.group = g; B.light = null; B.loose = false; return B; };
    // the form's centre (local coords) and size: contours lift on the lit side and press on the shadow side
    B.lightAt = function (x, y, r) { const c = B.X([x, y]); B.light = { x: c[0], y: c[1], r: r * B.tf.k }; };
    B.X = function (p) { const t = B.tf; return [p[0] * t.k + t.dx, p[1] * t.k + t.dy, p[2] === undefined ? 1 : p[2]]; };
    B.toPts = function (path) {
      if (typeof path === 'string') return parse(path).map((l) => l.map(B.X));
      if (path.length && typeof path[0][0] === 'number') return [path.map(B.X)];
      return path.map((l) => l.map(B.X));
    };
    B.sil = function (poly, z, pad) {
      const pts = (typeof poly === 'string' ? parse(poly)[0] : poly).map(B.X);
      // grow by `pad` around the centroid so the background leaves a halo of bare paper
      let cx = 0, cy = 0; pts.forEach((p) => { cx += p[0]; cy += p[1]; }); cx /= pts.length; cy /= pts.length;
      const g = pad || 0;
      const grown = pts.map((p) => { const dx = p[0] - cx, dy = p[1] - cy, d = Math.hypot(dx, dy) || 1; return [p[0] + (dx / d) * g, p[1] + (dy / d) * g]; });
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      grown.forEach((p) => { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); });
      B.sils.push({ poly: grown, z, bb: [x0, y0, x1, y1] });
    };
    function inFront(x, y, z) {
      for (const s of B.sils) {
        if (s.z >= z) continue;
        if (x < s.bb[0] || x > s.bb[2] || y < s.bb[1] || y > s.bb[3]) continue;
        if (pip(s.poly, x, y)) return true;
      }
      return false;
    }
    // split a dense path where it passes behind something nearer
    function cut(d, z) {
      if (z === undefined || z === null || !B.sils.length) return [d];
      const runs = []; let cur = [];
      for (let i = 0; i < d.length; i++) {
        const hidden = inFront(d[i][0], d[i][1], z);
        if (!hidden) cur.push(d[i]);
        else if (cur.length) { runs.push(cur); cur = []; }
      }
      if (cur.length) runs.push(cur);
      // ragged ends: drop a few samples at each cut
      return runs.map((r, i) => {
        const a = (i > 0 || r[0] !== d[0]) ? Math.floor(R() * 3) : 0;
        const b = (r[r.length - 1] !== d[d.length - 1]) ? Math.floor(R() * 3) : 0;
        return r.slice(a, r.length - b);
      }).filter((r) => r.length > 3);
    }
    const PROF = {
      taper: (u, r) => Math.sqrt(clamp(u / 0.02, 0, 1)) * (1 + 0.35 * Math.exp(-u / 0.04)) * (1 - 0.62 * sstep(0.6, 1, u)) * r,
      even: (u, r) => Math.sqrt(clamp(u / 0.04, 0, 1)) * (1 - 0.3 * sstep(0.85, 1, u)) * r,
      flick: (u, r) => Math.sqrt(clamp(u / 0.03, 0, 1)) * (1 - 0.8 * sstep(0.45, 1, u)) * r,
      swell: (u, r) => (0.35 + 0.65 * Math.sin(Math.PI * clamp(u, 0, 1))) * r,
      press: (u, r) => clamp(u / 0.12, 0.3, 1) * (1 - 0.25 * sstep(0.8, 1, u)) * r,
    };
    const DEF = {
      pen: { w: 2.5, a: 0.93, sp: 900, pause: 55, jit: 0.45, pr: 'taper' },
      write: { w: 1.7, a: 0.92, sp: 820, pause: 12, jit: 0.15, pr: 'even' },
      pp: { w: 3.0, a: 0.85, sp: 1300, pause: 40, jit: 0.8, pr: 'swell', lvl: 2 },
      side: { w: 26, a: 0.85, sp: 2200, pause: 18, jit: 1.2, pr: 'even', lvl: 1 },
      smudge: { w: 18, a: 0.35, sp: 900, pause: 60, jit: 1, pr: 'even' },
    };
    // add a stroke. path in local (group) coords.
    B.add = function (tool, path, o) {
      o = Object.assign({}, DEF[tool] || DEF.pen, o || {});
      const k = B.tf.k;
      const lines = B.toPts(path);
      const z = o.z === undefined ? B.z : o.z;
      if (B.loose && tool === 'pen' && !o.keep) {
        // the far figures get the quick version: fewer, lighter marks
        if (o.w < 1.9 && R() < 0.35) return;
        o.a *= 0.85; o.w *= 0.85; o.sp *= 1.4; o.search = 0;
      }
      for (let li = 0; li < lines.length; li++) {
        let pts = lines[li].map((p) => p.slice());
        // a hand never lands exactly where it meant to
        const jx = (R() - 0.5) * o.jit * 1.6 * k, jy = (R() - 0.5) * o.jit * 1.6 * k;
        pts = pts.map((p) => [p[0] + jx + (R() - 0.5) * o.jit * k, p[1] + jy + (R() - 0.5) * o.jit * k, p[2]]);
        if (o.over && pts.length > 1) {
          const a = pts[0], b = pts[1], c = pts[pts.length - 2], e = pts[pts.length - 1];
          const ov0 = o.over * k * R(), ov1 = o.over * k * (0.3 + R());
          const l0 = Math.hypot(a[0] - b[0], a[1] - b[1]) || 1, l1 = Math.hypot(e[0] - c[0], e[1] - c[1]) || 1;
          pts.unshift([a[0] + (a[0] - b[0]) / l0 * ov0, a[1] + (a[1] - b[1]) / l0 * ov0, a[2]]);
          pts.push([e[0] + (e[0] - c[0]) / l1 * ov1, e[1] + (e[1] - c[1]) / l1 * ov1, e[2]]);
        }
        const step = tool === 'side' ? 2.4 : tool === 'write' ? 0.9 : 1.4;
        let d = o.raw ? resample(pts, step) : smoothPath(pts, step);
        const L = pathLen(d);
        if (L < 0.5) continue;
        // pressure profile
        const prof = PROF[o.pr] || PROF.taper;
        let acc = 0;
        const amp = o.p === undefined ? 1 : o.p;
        noiseOff += 7.3;
        // where the hand turns it slows, and a porous point deposits more ink
        const curv = new Float32Array(d.length);
        if (tool === 'pen' || tool === 'write') {
          for (let i = 1; i < d.length - 1; i++) {
            const a1 = Math.atan2(d[i][1] - d[i - 1][1], d[i][0] - d[i - 1][0]);
            const a2 = Math.atan2(d[i + 1][1] - d[i][1], d[i + 1][0] - d[i][0]);
            let da = Math.abs(a2 - a1); if (da > Math.PI) da = TAU - da;
            curv[i] = da / step;
          }
          for (let pass = 0; pass < 2; pass++) for (let i = 1; i < d.length - 1; i++) curv[i] = (curv[i - 1] + curv[i] * 2 + curv[i + 1]) / 4;
        }
        const trem = (o.trem === undefined ? (tool === 'pen' ? 0.55 : tool === 'pp' ? 0.9 : 0) : o.trem) * k;
        const tq = noise1(R);
        for (let i = 0; i < d.length; i++) {
          if (i) acc += Math.hypot(d[i][0] - d[i - 1][0], d[i][1] - d[i - 1][1]);
          const u = acc / L;
          const ck = tool === 'write' ? 1 + clamp(curv[i] * 1.2, 0, 0.5) : 1 + clamp(curv[i] * 4, 0, 0.6);
          let lm = 1;
          if (B.light && tool === 'pen' && !o.nolight) {
            const vx = d[i][0] - B.light.x, vy = d[i][1] - B.light.y, dl = Math.hypot(vx, vy) || 1;
            const sh = (vx * 0.55 + vy * 0.83) / dl;
            lm = lerp(1, lerp(0.2, 1.45, sstep(-0.7, 0.7, sh)), clamp(dl / (B.light.r * 0.45), 0, 1));
          }
          d[i][2] = clamp(d[i][2] * prof(u, amp) * ck * lm * (0.72 + 0.28 * N(noiseOff + acc * 0.045)), 0.04, 1.6);
        }
        if (trem) {
          for (let i = 1; i < d.length - 1; i++) {
            const tx = d[i + 1][0] - d[i - 1][0], ty = d[i + 1][1] - d[i - 1][1], tl = Math.hypot(tx, ty) || 1;
            const off = tq(i * step / 22) * trem + tq(i * step / 5 + 40) * trem * 0.25;
            d[i][0] += (-ty / tl) * off; d[i][1] += (tx / tl) * off;
          }
        }
        let parts = [d];
        // the pen lifts for a moment in the middle of a long line
        if (tool === 'pen' && !o.nobreak && L > 70 * k && R() < 0.3) {
          const g0 = Math.floor(d.length * (0.3 + R() * 0.45)), gl = Math.max(2, Math.floor(d.length * (0.03 + R() * 0.05)));
          parts = [d.slice(0, g0), d.slice(g0 + gl)].filter((q) => q.length > 3);
        }
        const pieces = o.nocut ? parts : [].concat(...parts.map((q) => cut(q, z)));
        pieces.forEach((pc, pi) => {
          const st = {
            tool, d: pc, len: pathLen(pc), col: o.col || (tool === 'pen' || tool === 'write' ? INK : COL.sienna),
            w: o.w * (tool === 'side' || tool === 'smudge' ? k : Math.pow(k, 0.62)) * (tool === 'pen' ? 0.8 + R() * 0.4 : 1), a: o.a, lvl: o.lvl === undefined ? (DEF[tool] || {}).lvl : o.lvl, dry: !!o.dry,
            sp: o.sp * Math.sqrt(k) * (tool === 'pen' ? 0.7 + R() * 0.7 : 1), pause: (li === 0 && pi === 0) ? (o.pause !== undefined ? o.pause : DEF[tool].pause) : 8,
            fade: o.fade || (tool === 'side' ? [0.75 + R() * 0.25, 0.3 + R() * 0.45] : null), streak: o.streak, gran: o.gran, poly: o.poly, edge: o.edge, tag: o.tag,
            mode: o.mode, seedv: R(),
          };
          B.S.push(st);
        });
        // a searching second line: the hand goes back over part of a contour it was not sure of
        if (tool === 'pen' && !o.nosearch && L > 70 * k && R() < (o.search === undefined ? 0.3 : o.search)) {
          const u0 = R() * 0.4, u1 = u0 + 0.3 + R() * 0.4;
          const i0 = Math.floor(u0 * d.length), i1 = Math.min(d.length - 1, Math.floor(u1 * d.length));
          if (i1 - i0 > 6) {
            const off = (1.2 + R() * 1.8) * k * (R() < 0.5 ? -1 : 1);
            const sub = [];
            for (let i = i0; i <= i1; i += 3) {
              const a = d[Math.max(0, i - 1)], b = d[Math.min(d.length - 1, i + 1)];
              const tx = b[0] - a[0], ty = b[1] - a[1], tl = Math.hypot(tx, ty) || 1;
              const f = Math.sin(Math.PI * (i - i0) / (i1 - i0));
              sub.push([d[i][0] - ty / tl * off * f, d[i][1] + tx / tl * off * f, 1]);
            }
            const saveTf = B.tf; B.tf = { k: 1, dx: 0, dy: 0 };
            B.add('pen', [sub], Object.assign({}, o, { w: o.w * k * 0.55, a: o.a * 0.7, sp: o.sp * Math.sqrt(k) * 1.4, pause: 25, over: 0, nosearch: true, jit: 0.2, pr: 'swell', trem: 0.4 }));
            B.tf = saveTf;
          }
        }
      }
    };
    B.pen = (p, o) => B.add('pen', p, o);
    B.pp = (p, o) => B.add('pp', p, o);
    B.side = (p, o) => B.add('side', p, o);
    B.smudge = (p, o) => B.add('smudge', p, o);
    B.pause = (ms) => { B.S.push({ tool: 'pause', d: [], len: 0, pause: ms }); };
    B.mark = (name) => { B.S.push({ tool: 'mark', name, d: [], len: 0, pause: 0 }); };

    // block a region with the side of the stick: parallel strokes, alternating direction
    B.block = function (poly, o) {
      o = Object.assign({ w: 26, gap: 0.78, ang: -80, lvl: 1, a: 0.85, over: 0.35, skip: 0.06, sp: 2600, pr: 'even', angj: 4 }, o || {});
      const P = (typeof poly === 'string' ? parse(poly)[0] : poly);
      const ang = (o.ang * Math.PI) / 180;
      const dx = Math.cos(ang), dy = Math.sin(ang), nx = -dy, ny = dx;
      let n0 = 1e9, n1 = -1e9;
      P.forEach((p) => { const v = p[0] * nx + p[1] * ny; n0 = Math.min(n0, v); n1 = Math.max(n1, v); });
      const step = o.w * o.gap;
      let flip = R() < 0.5;
      for (let c = n0 + step * (0.3 + R() * 0.4); c < n1; c += step * (0.8 + R() * 0.4)) {
        // intersections of the line {p·n = c} with the polygon
        const ts = [];
        for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
          const a = P[j], b = P[i];
          const va = a[0] * nx + a[1] * ny - c, vb = b[0] * nx + b[1] * ny - c;
          if ((va > 0) !== (vb > 0)) {
            const t = va / (va - vb);
            const x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t;
            ts.push(x * dx + y * dy);
          }
        }
        ts.sort((a, b) => a - b);
        for (let i = 0; i + 1 < ts.length; i += 2) {
          if (R() < o.skip) continue;
          let t0 = ts[i] - o.over * o.w * (R() * 1.4 - 0.4), t1 = ts[i + 1] + o.over * o.w * (R() * 1.4 - 0.4);
          if (t1 - t0 < o.w * 0.4) continue;
          const aj = ((R() - 0.5) * o.angj * Math.PI) / 180;
          const cx = c * nx, cy = c * ny;
          const mid = (t0 + t1) / 2, half = (t1 - t0) / 2;
          const ddx = Math.cos(ang + aj), ddy = Math.sin(ang + aj);
          const mx = cx + dx * mid, my = cy + dy * mid;
          const bow = (R() - 0.5) * o.w * 0.25;
          let A = [mx - ddx * half, my - ddy * half], Z = [mx + ddx * half, my + ddy * half];
          if (flip) { const t = A; A = Z; Z = t; }
          flip = !flip;
          const M = [(A[0] + Z[0]) / 2 + nx * bow, (A[1] + Z[1]) / 2 + ny * bow];
          let fa = 1;
          if (o.fadeY) { const [fy0, fy1, fmin] = o.fadeY; fa = lerp(1, fmin, clamp(((A[1] + Z[1]) / 2 - fy0) / (fy1 - fy0), 0, 1)); }
          if (fa < 0.08) continue;
          B.add('side', [[A[0], A[1], 1], [M[0], M[1], 1], [Z[0], Z[1], 1]], {
            w: o.w * (0.85 + R() * 0.3), col: o.col, lvl: o.lvl + (fa < 0.5 ? 1 : 0) > 3 ? 3 : o.lvl + (fa < 0.5 ? 1 : 0), a: o.a * fa * (0.8 + R() * 0.25), sp: o.sp, pr: o.pr, z: o.z,
            pause: o.pause !== undefined ? o.pause : 14, fade: [0.75 + R() * 0.25, 0.35 + R() * 0.5], streak: o.streak,
          });
        }
      }
    };

    // a small watercolour wash: polygon, laid by a brush moving along `brush`
    B.wash = function (poly, o) {
      o = Object.assign({ a: 0.55, col: COL.burgundy, sp: 700 }, o || {});
      const P = (typeof poly === 'string' ? parse(poly)[0] : poly).map(B.X);
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      P.forEach((p) => { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); });
      // brush path: a zigzag across the bounding box
      const bp = []; const rows = Math.max(2, Math.round((y1 - y0) / 14));
      for (let r = 0; r <= rows; r++) {
        const y = y0 + ((y1 - y0) * r) / rows;
        if (r % 2) bp.push([x1, y, 1], [x0, y, 1]); else bp.push([x0, y, 1], [x1, y, 1]);
      }
      const d = resample(bp, 3);
      B.S.push({ tool: 'wash', d, len: pathLen(d), poly: P, col: o.col, a: o.a, sp: o.sp, pause: 200, edge: o.edge || o.col, r: Math.max(16, (y1 - y0) / rows * 1.4), seedv: R() });
    };

    // handwriting in porous pen. x,y = start of baseline (local), size = x-height.
    // A fast hand: each word gets its own slant and drift, each letter its own size and lean,
    // and every point of every glyph is pushed a little off its ideal.
    B.write = function (text, x, y, size, o) {
      o = Object.assign({ slant: 0.22, rot: 0, w: 1.7, sp: 950, gap: 0.12, mess: 1 }, o || {});
      let cx = 0;
      const ca = Math.cos(o.rot), sa = Math.sin(o.rot);
      let drift = 0, wslant = o.slant + (R() - 0.5) * 0.12 * o.mess, wscale = 1;
      const first = B.S.length;
      const wob = noise1(R);
      for (let ci = 0; ci < text.length; ci++) {
        const ch = text[ci];
        if (ch === ' ') {
          cx += size * (0.5 + R() * 0.25);
          drift += (R() - 0.5) * size * 0.14 * o.mess;
          wslant = o.slant + (R() - 0.5) * 0.14 * o.mess;
          wscale = 0.94 + R() * 0.12;
          continue;
        }
        const g = GLYPHS[ch] || GLYPHS[ch.toLowerCase()];
        if (!g) { cx += size * 0.6; continue; }
        const sc = size * wscale * (0.9 + R() * 0.18);
        const sx = sc * (0.92 + R() * 0.16);
        const by = drift + (R() - 0.5) * size * 0.09 * o.mess;
        const lean = wslant + (R() - 0.5) * 0.08 * o.mess;
        const m = 0.045 * o.mess;
        g.s.forEach((stroke) => {
          const pts = stroke.map((p, pi) => {
            const jx = (wob(ci * 3.1 + pi * 0.7) * m + (R() - 0.5) * m * 0.6) * sc;
            const jy = (wob(ci * 3.1 + pi * 0.7 + 20) * m + (R() - 0.5) * m * 0.6) * sc;
            const gx = p[0] * sx + p[1] * sc * lean + cx + jx, gy = -p[1] * sc + by + jy;
            return [x + gx * ca - gy * sa, y + gx * sa + gy * ca, 1];
          });
          B.add('write', [pts], { w: o.w * (0.9 + R() * 0.2), sp: o.sp, pause: 6 + R() * 10, jit: 0.1, z: null, nocut: true, a: o.a || 0.92, dry: o.dry && R() < 0.5 });
        });
        cx += g.w * sx + size * o.gap * (0.6 + R() * 0.8);
      }
      if (B.S[first]) B.S[first].pause = o.pause === undefined ? 380 : o.pause;
      return cx;
    };
    B.textWidth = function (text, size) {
      let cx = 0;
      for (const ch of text) { if (ch === ' ') { cx += size * 0.62; continue; } const g = GLYPHS[ch] || GLYPHS[ch.toLowerCase()]; cx += g ? g.w * size + size * 0.16 : size * 0.6; }
      return cx;
    };
    return B;
  }

  /* ------------------------------------------------------ heads
   * A profile head in local units: height 1 (crown -0.5 .. chin 0.5), facing +x.
   * turn > 0 swings it toward three-quarter: the far eye appears by the bridge. */
  const HAIR = {
    short: [[0.29, -0.28], [0.2, -0.45], [0.0, -0.545], [-0.26, -0.5], [-0.43, -0.32], [-0.46, -0.1], [-0.38, 0.1], [-0.22, 0.1], [-0.15, -0.05], [-0.07, -0.1], [-0.0, -0.03], [0.02, 0.06], [0.05, -0.12], [0.14, -0.23], [0.24, -0.26]],
    quiff: [[0.3, -0.29], [0.33, -0.42], [0.2, -0.56], [-0.04, -0.6], [-0.28, -0.53], [-0.44, -0.35], [-0.47, -0.1], [-0.4, 0.1], [-0.22, 0.1], [-0.15, -0.05], [-0.07, -0.1], [0.0, -0.03], [0.02, 0.06], [0.05, -0.12], [0.14, -0.24], [0.24, -0.27]],
    swept: [[0.06, -0.47], [-0.2, -0.53], [-0.41, -0.37], [-0.46, -0.12], [-0.4, 0.08], [-0.2, 0.03], [-0.12, -0.12], [-0.04, -0.32]],
    bald: [[-0.27, -0.24], [-0.43, -0.1], [-0.39, 0.1], [-0.16, 0.06], [-0.13, -0.08]],
    bob: [[0.31, -0.2], [0.24, -0.43], [0.02, -0.56], [-0.28, -0.52], [-0.47, -0.3], [-0.5, 0.05], [-0.44, 0.38], [-0.22, 0.43], [-0.07, 0.38], [-0.08, 0.1], [0.02, -0.1], [0.17, -0.16], [0.29, -0.12]],
    bun: [[0.29, -0.26], [0.18, -0.46], [0.0, -0.53], [-0.24, -0.49], [-0.4, -0.33], [-0.43, -0.1], [-0.36, 0.06], [-0.18, 0.0], [-0.08, -0.14], [0.08, -0.22], [0.22, -0.25]],
    curly: [[0.3, -0.28], [0.24, -0.5], [0.02, -0.62], [-0.3, -0.58], [-0.52, -0.36], [-0.54, -0.06], [-0.44, 0.16], [-0.2, 0.06], [-0.1, -0.12], [0.08, -0.26], [0.22, -0.3]],
    buzz: [[0.25, -0.33], [0.1, -0.49], [-0.15, -0.525], [-0.38, -0.39], [-0.445, -0.14], [-0.38, 0.03], [-0.17, -0.04], [-0.07, -0.2], [0.1, -0.3]],
  };
  function drawHead(B, H, phase) {
    const X = headXf(H.cx, H.cy, H.h, H.f, H.tilt || 0);
    const M = (arr) => arr.map(X);
    const n = H.nose || 1, ch = H.chin || 1, tn = H.turn || 0;
    const z = H.z;
    const w = H.w || 2.1;
    const hair = HAIR[H.hair || 'short'];
    const hairCol = H.hairCol || COL.hairdk;
    if (phase === 'sil') { B.sil(M(hairOrHead(H)), z, 4); return; }
    if (phase === 'gesture') {
      B.pp([M([[0.05, -0.5], [-0.36, -0.3], [-0.38, 0.1], [0.0, 0.48], [0.34, 0.3], [0.36, -0.1], [0.2, -0.44], [0.0, -0.5]])], { w: 2.2, sp: 1800, p: 0.7, z });
      return;
    }
    if (phase === 'contour') {
      const c0 = X([0.05, -0.05]); const keepL = B.light; B.light = { x: B.X(c0)[0], y: B.X(c0)[1], r: H.h * B.tf.k };
      contourHead(B, H, M, X, n, ch, tn, z, w, hair);
      B.light = keepL;
      return;
    }
    if (phase === 'colour') {
      const sk = H.skin || COL.skin;
      const ang = Math.atan2(Math.cos(H.tilt || 0), -Math.sin(H.tilt || 0) * H.f) * 180 / Math.PI;
      const hh = H.h;
      const eyx = 0.245 - tn * 0.08;
      // the face in planes: a mid tone over it all, the shadowed side of the jaw and neck, the eye socket
      B.block(M([[0.3, -0.27], [0.36, -0.075], [0.45, 0.12], [0.36, 0.2], [0.34, 0.29], [0.32, 0.4], [0.24, 0.49], [0.1, 0.5], [-0.09, 0.36], [-0.13, 0.08], [-0.06, -0.14], [0.08, -0.26]]),
        { col: sk, ang: ang + B.rnd(-8, 8), w: hh * 0.11, gap: 0.75, lvl: 1, a: 0.85, z, over: 0.05, skip: 0, sp: 1400, pause: 10 });
      B.block(M([[-0.12, 0.1], [0.06, 0.12], [0.2, 0.3], [0.18, 0.46], [0.04, 0.48], [-0.1, 0.36]]), { col: COL.skinmid, ang: ang - 20, w: hh * 0.07, gap: 0.8, lvl: 2, a: 0.75, z, over: 0, skip: 0, sp: 1200, pause: 10 });
      B.block(M([[-0.25, 0.32], [0.1, 0.5], [0.15, 0.62], [0.16, 0.74], [-0.22, 0.74]]), { col: COL.skinmid, ang, w: hh * 0.09, gap: 0.8, lvl: 2, a: 0.75, z, over: 0, skip: 0, sp: 1200, pause: 10 });
      B.side([M([[eyx - 0.06, -0.06], [eyx + 0.06, -0.05]])], { col: COL.skindk, w: hh * 0.05, lvl: 2, a: 0.7, z, sp: 500 });
      B.side([M([[0.3, 0.19], [0.36, 0.2]]), M([[0.22, 0.45], [0.28, 0.42]])], { col: COL.skindk, w: hh * 0.035, lvl: 2, a: 0.6, z, sp: 500 });
      B.side([M([[0.12, 0.08], [0.22, 0.14]])], { col: H.blush || COL.blush, w: hh * 0.07, lvl: 2, a: 0.55, z, sp: 500 });
      if (H.hair !== 'bob') B.side([M([[-0.1, -0.02], [-0.08, 0.12]])], { col: H.blush || COL.blush, w: hh * 0.06, lvl: 2, a: 0.6, z, sp: 400 });
      // hair as a mass, the side of the stick following the way it grows
      const hairAng = ang + (H.hair === 'bob' ? 8 : 78) * H.f;
      B.block(M(hair), { col: hairCol, ang: hairAng, w: hh * 0.12, gap: 0.45, lvl: H.hair === 'bald' ? 1 : 0, a: 0.95, z, over: 0.0, skip: 0, sp: 1400, pause: 10, angj: 14, streak: false });
      if (H.hair === 'bun') B.block(M([[-0.36, -0.4], [-0.5, -0.46], [-0.6, -0.36], [-0.56, -0.22], [-0.42, -0.2]]), { col: hairCol, ang: hairAng, w: hh * 0.07, gap: 0.7, lvl: 0, a: 0.9, z, over: 0, skip: 0, sp: 1000, pause: 10 });
      if (H.hairDark) B.side([M(hair.slice(Math.floor(hair.length * 0.45), Math.floor(hair.length * 0.75)))], { col: H.hairDark, w: hh * 0.06, lvl: 1, a: 0.75, z, sp: 900 });
      return;
    }
    if (phase === 'light') {
      const L = H.light || COL.skinlt;
      B.pp([M([[0.26, -0.26], [0.31, -0.12]])], { col: L, w: H.h * 0.045, lvl: 1, a: 0.85, z });
      B.pp([M([[0.36 + 0.02 * n, 0.0], [0.41 + 0.04 * n, 0.1]])], { col: L, w: H.h * 0.035, lvl: 1, a: 0.9, z });
      B.pp([M([[0.14, 0.03], [0.24, 0.07]]), M([[0.29, 0.4], [0.27, 0.45]])], { col: L, w: H.h * 0.03, lvl: 2, a: 0.75, z });
      if (H.hairLight) B.pp([M([[0.14, -0.44], [-0.08, -0.5], [-0.28, -0.42]])], { col: H.hairLight, w: H.h * 0.04, lvl: 1, a: 0.85, z });
      // the eye re-stated last, darkest dark in the face
      const eyx = 0.245 - tn * 0.08;
      if ((H.eyes || 'open') !== 'closed') B.pen([M([[eyx - 0.045, -0.04], [eyx + 0.01, -0.048], [eyx + 0.04, -0.03]])], { w: (H.w || 2.1) * 1.3, sp: 200, pr: 'flick', z });
      return;
    }
  }
  function contourHead(B, H, M, X, n, ch, tn, z, w, hair) {
    const fore = H.hair === 'bob' || H.hair === 'curly' ? [] : [[0.3, -0.27], [0.335, -0.16]];
    const prof1 = fore.concat([[0.36, -0.075], [0.335 - tn * 0.01, -0.02], [0.36 + 0.03 * n, 0.04], [0.40 + 0.05 * n, 0.12], [0.39 + 0.03 * n, 0.15], [0.355, 0.17], [0.34, 0.18]]);
    B.pen([M(prof1)], { w: w * 1.15, sp: 520, pr: 'even', z });
    const mouthOpen = H.mouth === 'open';
    const prof2 = mouthOpen
      ? [[0.345, 0.185], [0.36, 0.225], [0.33, 0.25], [0.3, 0.27], [0.29, 0.3], [0.31, 0.33], [0.305, 0.36], [0.32 * ch, 0.42], [0.29 * ch, 0.47], [0.22, 0.5], [0.1, 0.5]]
      : [[0.345, 0.185], [0.36, 0.225], [0.335, 0.258], [0.345, 0.29], [0.305, 0.335], [0.32 * ch, 0.40], [0.30 * ch, 0.46], [0.23, 0.495], [0.1, 0.5]];
    B.pen([M(prof2)], { w: w * 0.95, sp: 520, pr: 'taper', z });
    if (!H.noJaw) B.pen([M([[0.11, 0.5], [0.0, 0.46], [-0.1 - tn * 0.05, 0.36]])], { w: w * 0.6, a: 0.75, sp: 600, pr: 'flick', z });
    if (H.hair !== 'bob' && !H.noEar) {
      const ex = -tn * 0.12;
      B.pen([M([[-0.02 + ex, -0.06], [-0.09 + ex, -0.085], [-0.135 + ex, 0.0], [-0.11 + ex, 0.12], [-0.05 + ex, 0.165], [-0.03 + ex, 0.11]])], { w: w * 0.7, sp: 300, pr: 'even', z });
      B.pen([M([[-0.06 + ex, -0.02], [-0.09 + ex, 0.04], [-0.07 + ex, 0.09]])], { w: w * 0.5, a: 0.7, sp: 260, pr: 'flick', z });
    }
    // eyes
    const eyx = 0.245 - tn * 0.08;
    const eye = H.eyes || 'open';
    if (eye === 'closed') {
      B.pen([M([[eyx - 0.05, -0.02], [eyx, -0.008], [eyx + 0.045, -0.02]])], { w: w * 0.9, sp: 200, pr: 'flick', z });
    } else if (eye === 'heavy' || eye === 'down') {
      B.pen([M([[eyx - 0.055, -0.03], [eyx, -0.018], [eyx + 0.05, -0.02]])], { w: w * 1.1, sp: 200, pr: 'even', z });
      B.pen([M([[eyx + 0.005, -0.012], [eyx + 0.025, -0.0]])], { w: w * 1.4, sp: 80, pr: 'even', z, trem: 0 });
    } else if (eye === 'wide') {
      // wide with outrage: the lid lifted clear of the iris
      B.pen([M([[eyx - 0.055, -0.028], [eyx - 0.01, -0.06], [eyx + 0.035, -0.058], [eyx + 0.062, -0.03]])], { w: w * 1.2, sp: 220, pr: 'even', z, nolight: true });
      B.pen([M([[eyx - 0.05, -0.022], [eyx + 0.0, -0.004], [eyx + 0.055, -0.012]])], { w: w * 0.6, a: 0.75, sp: 200, pr: 'flick', z });
      B.pen([M([[eyx + 0.022, -0.04], [eyx + 0.028, -0.022]])], { w: w * 2.1, sp: 80, pr: 'even', z, trem: 0, nolight: true });
    } else {
      // profile eye: a '<' opening toward the nose, the iris tucked under the upper lid
      B.pen([M([[eyx - 0.055, -0.03], [eyx - 0.01, -0.052], [eyx + 0.035, -0.048], [eyx + 0.06, -0.03]])], { w: w * 1.15, sp: 220, pr: 'even', z });
      B.pen([M([[eyx - 0.05, -0.024], [eyx + 0.0, -0.008], [eyx + 0.05, -0.014]])], { w: w * 0.55, a: 0.7, sp: 200, pr: 'flick', z });
      B.pen([M([[eyx + 0.026, -0.042], [eyx + 0.034, -0.022]])], { w: w * 1.9, sp: 80, pr: 'even', z, trem: 0 });
    }
    if (tn > 0) {
      // the far eye, tucked behind the bridge of the nose
      B.pen([M([[0.3, -0.035], [0.325, -0.045], [0.338, -0.03]])], { w: w * 0.9, sp: 160, pr: 'even', z });
      B.pen([M([[0.318, -0.03], [0.326, -0.018]])], { w: w * 1.3, sp: 80, pr: 'even', z, trem: 0 });
    }
    const browLift = H.brow || 0, knit = H.knit || 0;
    if (H.bushy) {
      // a heavy old brow: a few short hairs, combed down over the lid
      for (let k = 0; k < 5; k++) { const t = k / 4, bx = eyx - 0.1 + t * 0.17, by = -0.1 - Math.sin(t * Math.PI) * 0.02; B.pen([M([[bx - 0.01, by - 0.012], [bx + 0.025, by + 0.012]])], { w: w * 1.2, sp: 160, pr: 'flick', z, pause: 15, nolight: true }); }
    } else {
      B.pen([M([[eyx - 0.1, -0.085 - browLift * 0.02], [eyx - 0.01, -0.11 - browLift * 0.03], [eyx + 0.075, -0.088 + browLift * 0.02 - knit * 0.035]])], { w: w * (H.browW || 1.3), sp: 280, pr: 'press', z, nolight: true });
    }
    if (knit) {
      // the outraged forehead
      B.pen([M([[0.2, -0.17], [0.27, -0.185]]), M([[0.17, -0.215], [0.25, -0.23]])], { w: w * 0.55, a: 0.7, sp: 300, pr: 'flick', z });
      B.pen([M([[0.31, -0.11], [0.305, -0.075]])], { w: w * 0.6, a: 0.7, sp: 200, pr: 'flick', z });
    }
    if (H.jowl) {
      B.pen([M([[0.24, 0.36], [0.2, 0.46], [0.12, 0.55], [0.0, 0.56], [-0.08, 0.48]])], { w: w * 0.9, sp: 500, pr: 'swell', z });
      B.pen([M([[0.3, 0.14], [0.25, 0.22], [0.23, 0.33]])], { w: w * 0.8, sp: 300, pr: 'swell', z });
      B.pen([M([[eyx - 0.04, 0.02], [eyx + 0.01, 0.04], [eyx + 0.05, 0.025]])], { w: w * 0.6, a: 0.75, sp: 200, pr: 'flick', z });
    }
    B.pen([M([[0.33 + 0.02 * n, 0.14], [0.35 + 0.02 * n, 0.16], [0.37 + 0.02 * n, 0.15]])], { w: w * 0.8, sp: 200, pr: 'flick', z });
    if (mouthOpen) {
      B.pen([M([[0.335, 0.248], [0.285, 0.262], [0.3, 0.3], [0.33, 0.29]])], { w: w * 1.5, sp: 200, pr: 'even', z, nolight: true });
      B.pen([M([[0.31, 0.15], [0.27, 0.22], [0.27, 0.28]])], { w: w * 0.6, a: 0.75, sp: 300, pr: 'flick', z });
    }
    else if (H.mouth === 'down') B.pen([M([[0.335, 0.262], [0.29, 0.268], [0.25, 0.285]])], { w: w * 0.95, sp: 240, pr: 'flick', z });
    else if (H.mouth === 'smirk') B.pen([M([[0.335, 0.262], [0.29, 0.264], [0.255, 0.248]])], { w: w * 0.95, sp: 240, pr: 'flick', z });
    else B.pen([M([[0.335, 0.262], [0.29, 0.27], [0.255, 0.268]])], { w: w * 0.9, sp: 240, pr: 'flick', z });
    if (H.age) {
      B.pen([M([[0.31, 0.12], [0.28, 0.2], [0.275, 0.27]])], { w: w * 0.55, a: 0.7, sp: 300, pr: 'flick', z });
      B.pen([M([[0.2, 0.03], [0.17, 0.06]])], { w: w * 0.5, a: 0.6, sp: 200, pr: 'flick', z });
    }
    if (H.moustache) B.pen([M([[0.36, 0.205], [0.33, 0.235], [0.27, 0.24], [0.24, 0.22]])], { w: w * 2.2, sp: 260, pr: 'swell', z });
    if (H.glasses) {
      const gx = eyx;
      B.pen([M([[gx - 0.07, -0.07], [gx + 0.07, -0.075], [gx + 0.075, 0.02], [gx - 0.06, 0.03], [gx - 0.07, -0.07]])], { w: w * 0.7, sp: 400, pr: 'even', z });
      B.pen([M([[gx - 0.07, -0.05], [-0.06 - tn * 0.1, -0.06]])], { w: w * 0.6, sp: 500, pr: 'flick', z });
      if (H.glasses === 'half') B.pen([M([[gx - 0.07, 0.005], [gx + 0.07, 0.0]])], { w: w * 0.8, sp: 300, z });
    }
    // neck
    B.pen([M([[0.14, 0.49], [0.15, 0.62], [0.17, 0.76]])], { w: w * 0.9, sp: 600, z });
    B.pen([M([[-0.26, 0.3], [-0.25, 0.5], [-0.22, 0.74]])], { w: w * 0.9, sp: 600, z });
    // hair: never a closed outline. The back silhouette in two broken pulls, the edge by the ear
    // barely touched, and a few strands that say which way it grows.
    const ho = hair, L = ho.length;
    if (H.hair === 'bald') {
      B.pen([M([[0.3, -0.27], [0.18, -0.44], [-0.02, -0.505], [-0.24, -0.46]])], { w: w * 0.75, sp: 700, pr: 'taper', z });
      B.pen([M([[-0.26, -0.44], [-0.38, -0.3], [-0.43, -0.12]])], { w: w * 0.8, sp: 700, pr: 'taper', z });
      B.pen([M(ho.slice(1, 4))], { w: w * 0.6, a: 0.8, sp: 600, pr: 'flick', z });
    } else {
      const back = ho.slice(1, Math.ceil(L * 0.6));
      const mid = Math.floor(back.length / 2);
      B.pen([M(back.slice(0, mid + 1))], { w: w * 0.8, sp: 700, pr: 'taper', z });
      B.pen([M(back.slice(mid))], { w: w * 0.9, sp: 700, pr: 'taper', z });
      B.pen([M(ho.slice(Math.ceil(L * 0.6) - 1, L - 1))], { w: w * 0.55, a: 0.7, sp: 700, pr: 'flick', z });
      if (H.hair !== 'bob' && H.hair !== 'curly' && H.hair !== 'quiff') B.pen([M([ho[L - 1], ho[0], ho[1]])], { w: w * 0.7, sp: 400, pr: 'flick', z });
      if (H.hair === 'bob') B.pen([M([[0.31, -0.2], [0.2, -0.24], [0.06, -0.2]])], { w: w * 0.9, sp: 400, pr: 'flick', z });
      const fl = H.hair === 'quiff' ? [[[0.3, -0.36], [0.18, -0.48], [0.0, -0.53]], [[0.2, -0.32], [0.06, -0.42], [-0.14, -0.46]], [[0.08, -0.26], [-0.08, -0.34], [-0.26, -0.36]]] : H.hair === 'short' || H.hair === 'buzz' ? [[[0.24, -0.27], [0.18, -0.3]], [[0.12, -0.24], [0.06, -0.28]]] : H.hair === 'curly'
        ? [[[0.12, -0.5], [0.04, -0.44], [-0.04, -0.52]], [[-0.12, -0.5], [-0.22, -0.44], [-0.3, -0.52]], [[-0.38, -0.34], [-0.46, -0.24], [-0.42, -0.14]], [[0.2, -0.36], [0.12, -0.3]]]
        : [[[0.22, -0.4], [0.05, -0.43], [-0.15, -0.36]], [[0.1, -0.3], [-0.08, -0.32], [-0.26, -0.22]], [[-0.18, -0.45], [-0.32, -0.34], [-0.38, -0.16]]];
      fl.forEach((f) => B.pen([M(f)], { w: w * 0.55, a: 0.7, sp: 600, pr: 'flick', z, pause: 25 }));
    }
    if (H.hair === 'bun') B.pen([M([[-0.36, -0.4], [-0.5, -0.46], [-0.6, -0.36], [-0.56, -0.22], [-0.42, -0.2]])], { w: w * 1.05, sp: 500, z });
  }
  function hairOrHead(H) {
    return [[0.34, -0.32], [0.44, 0.12], [0.36, 0.3], [0.32, 0.5], [0.0, 0.55], [-0.3, 0.45], [-0.5, 0.1], [-0.5, -0.3], [-0.3, -0.55], [0.05, -0.6], [0.25, -0.48]];
  }
  // map head-local -> group coords
  function headXf(cx, cy, h, facing, tilt) {
    const c = Math.cos(tilt), s = Math.sin(tilt);
    return (p) => { const x = p[0] * h * facing, y = p[1] * h; return [cx + x * c - y * s, cy + x * s + y * c, p[2] === undefined ? 1 : p[2]]; };
  }

  /* ============================================================ THE SCENE
   * All coordinates: landscape sheet units (1600 x 1000). Groups can be moved
   * for the portrait sheet by the layout. */

  const GOOSE_POSES = {
    hiss: { spine: [[758, 364], [738, 352], [716, 342], [694, 336], [672, 333], [656, 332]], head: [662, 330], ang: 174, gape: 24, L: 62, note: ['hissed at counsel', 'hisses at own counsel', 'hissed. counsel steps back'] },
    tall: { spine: [[758, 364], [746, 340], [736, 312], [732, 286], [736, 264], [743, 250]], head: [748, 245], ang: 170, gape: 0, L: 62, note: ['rises to full height', 'stares down the bench', 'glares at jury'] },
    honk: { spine: [[758, 364], [757, 340], [753, 314], [754, 290], [760, 270], [768, 256]], head: [758, 250], ang: -26, gape: 30, L: 62, note: ['honks at the bench', 'objects. overruled', 'addresses the court, loudly'] },
    low: { spine: [[758, 366], [738, 360], [718, 358], [702, 360], [688, 364]], head: [694, 361], ang: 156, gape: 10, L: 62, note: ['lowers head. counsel steps back', 'coils. bailiff tenses', 'low, forward, silent'] },
    rear: { spine: [[758, 364], [767, 340], [768, 316], [760, 294], [747, 281], [738, 276]], head: [745, 273], ang: 204, gape: 16, L: 62, note: ['rears back. bailiff tenses', 'draws itself up', 'rears at the jury'] },
  };

  function gooseGeom(pose) {
    const P = GOOSE_POSES[pose];
    const a = (P.ang * Math.PI) / 180, dx = Math.cos(a), dy = Math.sin(a);
    const ux = dx >= 0 ? dy : -dy, uy = dx >= 0 ? -dx : dx;
    const L = P.L, ox = P.head[0], oy = P.head[1];
    const H = (q) => [ox + dx * q[0] * L + ux * q[1] * L, oy + dy * q[0] * L + uy * q[1] * L, q[2] === undefined ? 1 : q[2]];
    const g = P.gape * (Math.PI / 180);
    // the lower mandible hinges at the gape
    const rot = (q) => {
      const px = q[0] - 0.6, py = q[1] + 0.07;
      const c = Math.cos(-g), s = Math.sin(-g);
      return [0.6 + px * c - py * s, -0.07 + px * s + py * c, q[2]];
    };
    const sp = smoothPath(P.spine.map((p) => [p[0], p[1], 1]), 2);
    const n = sp.length;
    const left = [], right = [];
    const w0 = 62, w1 = 0.4 * L;
    for (let i = 0; i < n; i++) {
      const a0 = sp[Math.max(0, i - 1)], a1 = sp[Math.min(n - 1, i + 1)];
      let tx = a1[0] - a0[0], ty = a1[1] - a0[1]; const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
      const u = i / (n - 1);
      const w = (w1 + (w0 - w1) * Math.pow(1 - u, 3.2)) / 2;
      left.push([sp[i][0] - ty * w, sp[i][1] + tx * w, 1]);
      right.push([sp[i][0] + ty * w, sp[i][1] - tx * w, 1]);
    }
    // which edge is the throat (the side under the bill)?
    const probe = H([0.3, -0.5]);
    const dl = Math.hypot(left[n - 1][0] - probe[0], left[n - 1][1] - probe[1]);
    const dr = Math.hypot(right[n - 1][0] - probe[0], right[n - 1][1] - probe[1]);
    const throatSide = dl < dr ? left : right, napeSide = dl < dr ? right : left;
    const head = {
      top: [[0.06, 0.1], [0.02, 0.22], [0.1, 0.33], [0.26, 0.385], [0.42, 0.35], [0.53, 0.28], [0.6, 0.215]].map(H),
      culmen: [[0.6, 0.215], [0.7, 0.16], [0.82, 0.1], [0.93, 0.045], [0.995, 0.0], [1.0, -0.045]].map(H),
      tomium: [[0.985, -0.06], [0.88, -0.07], [0.74, -0.08], [0.6, -0.065]].map(H),
      lower: [[0.6, -0.085], [0.72, -0.1], [0.86, -0.105], [0.955, -0.09], [0.93, -0.125], [0.8, -0.145], [0.66, -0.14]].map((q) => H(rot(q))),
      throat: [[0.58, -0.135], [0.46, -0.185], [0.32, -0.215], [0.18, -0.215], [0.08, -0.18]].map(H),
      feather: [[0.6, 0.215], [0.565, 0.1], [0.575, -0.02], [0.6, -0.07]].map(H),
      eye: H([0.405, 0.165]), eyeR: 0.05 * L,
      brow: [[0.31, 0.255], [0.4, 0.245], [0.5, 0.2]].map(H),
      nostril: [[0.74, 0.08], [0.785, 0.065]].map(H),
      nail: [[0.94, 0.04], [0.985, -0.02]].map(H),
      tongue: P.gape > 4 ? [[0.6, -0.08], [0.72, -0.1], [0.83, -0.105]].map((q) => H(rot([q[0], q[1] + 0.025 * (q[0] - 0.6) / 0.25]))) : null,
      mouthDark: P.gape > 4 ? [[0.62, -0.075], [0.8, -0.075], [0.92, -0.08], [0.8, -0.12], [0.64, -0.1]].map((q, i) => i < 3 ? H(q) : H(rot(q))) : null,
      L, H, dx, dy, ux, uy, ang: P.ang,
      poly: [[0.02, 0.24], [0.26, 0.4], [0.6, 0.22], [1.02, -0.02], [0.97, -0.09], [0.6, -0.15], [0.16, -0.23], [0.0, -0.1]].map(H),
      billPoly: [[0.6, 0.215], [0.82, 0.1], [0.995, 0.0], [0.985, -0.06], [0.74, -0.08], [0.6, -0.065], [0.565, 0.1]].map(H),
      lowerPoly: [[0.6, -0.085], [0.86, -0.105], [0.955, -0.09], [0.8, -0.145], [0.62, -0.135]].map((q) => H(rot(q))),
    };
    return { P, sp, left, right, throatSide, napeSide, head, pose };
  }

  const GOOSE_BODY = {
    breast: '733,360 722,378 712,402 708,426 712,446 724,460 743,468',
    belly: '743,468 762,472 | 790,474 812,473 | 828,471 846,468',
    // wings held a little off the body: the carpal joints rise above the line of the back
    shoulder: '776,352 790,338 810,332 834,336 850,342',
    back: '852,342 870,345 886,350',
    tail: '880,350 897,342 912,334 919,338 913,349 | 913,349 902,360 892,368 | 900,344 914,340',
    rear: '897,364 888,388 876,418 862,446 846,467',
    wing: '768,396 796,410 829,415 859,408 885,392 906,372 928,346',
    prim: '872,394 897,378 921,355 | 881,402 904,385 926,361',
    scal: '800,372 822,378 846,376 | 836,360 856,366 874,362 | 806,386 834,392 862,388 884,376',
    secs: '782,364 800,357 | 846,398 872,396 896,384',
    flank: '770,432 800,444 826,446 | 790,456 818,462',
    poly: '742,366 708,400 704,428 714,456 742,472 846,470 876,420 897,366 924,322 884,346 836,332 790,334 776,344',
    inner: '742,384 718,404 714,430 724,452 746,464 844,462 866,420 886,366 870,354 834,346 790,350 770,364',
  };


  /* --------------------------------------------------------------- layouts */
  function makeLayout(portrait) {
    const G = (k, dx, dy) => ({ k, dx, dy });
    if (!portrait) {
      // cropped in on the moment: the bird and counsel big and near, the judge looming behind,
      // everyone else at the edges, quicker, and partly off the sheet
      return {
        W: 1600, H: 1000, portrait: false,
        g: {
          wall: G(1, 0, 0), goose: G(1.9, -609, -238), floor: G(1.9, -609, -238), lawyer: G(1.32, -347, -128),
          easel: G(0.95, -203, 70), judge: G(1.12, 6, -62), clock: G(1, 120, -46), jury: G(0.8, 0, -134),
          steno: G(0.95, 382, 72), bailiff: G(1.1, -101, -57), pros: G(1, 158, 122), feather: G(1.2, -359, -100),
        },
        wall: { top: 120, bot: 720, x0: 0, x1: 1600 },
        focus: [900, 300],
        notes: { head: [40, 64], A1: [470, 50], A2: [470, 88], B1: [830, 50], B2: [1452, 60], jury: [190, 148], steno: [1186, 882, 190], feather: [626, 978], sig: [40, 986] },
        targets: { juror: [58, 252], feather: [566, 948] },
      };
    }
    // the tall sheet: the bench looming at the top, the bird big in the middle, counsel cropped at the foot
    return {
      W: 1000, H: 1900, portrait: true,
      g: {
        wall: G(1, 0, 0), judge: G(1, -386, 118), clock: G(1, -50, 54), goose: G(2.0, -1150, 60), floor: G(2.0, -1150, 60),
        lawyer: G(1.35, -344, 864), easel: G(0.95, -220, 1045), jury: G(0.8, 0, 56), steno: G(0.95, -158, 232),
        bailiff: G(1, -550, 288), pros: G(1, -412, 902), feather: G(1.2, -218, 748),
      },
      wall: { top: 300, bot: 1150, x0: 0, x1: 1000 },
      focus: [420, 620],
      notes: { head: [40, 78], A1: [40, 170], A2: [40, 210], B1: [40, 250], B2: [700, 110], jury: [24, 598, 220], steno: [770, 1046, 200], feather: [720, 1866], sig: [40, 1884] },
      targets: { juror: [54, 450], feather: [690, 1792] },
    };
  }

  /* ----------------------------------------------------------- the score */
  function buildScore(seed, layout) {
    const B = Builder(seed, layout);
    const R = B.R;
    const room = ROOMS[Math.floor(R() * ROOMS.length)];
    const order = ['hiss', 'tall', 'honk', 'low', 'rear'];
    // pick three distinct poses; the last is where the goose ends up
    const poses = [];
    while (poses.length < 3) { const p = B.pick(order); if (!poses.includes(p)) poses.push(p); }
    const geo = poses.map(gooseGeom);
    const fin = geo[2];

    /* ---- silhouettes (nearer things hide farther ones) */
    B.at('goose');
    B.sil(GOOSE_BODY.poly, 3, 6);
    B.sil(fin.left.concat(fin.right.slice().reverse()), 3, 5);
    B.sil(fin.head.poly, 3, 6);

    /* ---- goose */
    const every = (arr, k) => arr.filter((_, i) => i % k === 0 || i === arr.length - 1);
    function gooseGesture(g) {
      B.at('goose');
      B.pp('704,428 714,384 770,348 850,338 918,336 886,404 846,462 758,470 708,446', { w: 2.4, sp: 1700, p: 0.8, z: 3 });
      B.pp([every(g.sp, 8)], { w: 2.4, sp: 1500, p: 0.85, z: 3 });
      const h = g.head;
      B.pp([[h.H([0.0, 0.05]), h.H([0.5, 0.2]), h.H([1.0, -0.03])]], { w: 2.2, sp: 1400, p: 0.75, z: 3 });
    }
    function gooseNeck(g, o) {
      o = o || {}; const a = o.a || 0.93, w = o.w || 2.4;
      B.at('goose');
      const h = g.head;
      // head first: crown and forehead in one pull, then the bill
      B.pen([h.top], { w, a, sp: 650, pr: 'even', z: 3 });
      B.pen([h.culmen], { w: w * 1.1, a, sp: 520, pr: 'press', z: 3 });
      B.pen([h.tomium], { w: w * 0.85, a, sp: 520, pr: 'flick', z: 3 });
      B.pen([h.lower], { w: w * 0.95, a, sp: 520, pr: 'even', z: 3 });
      B.pen([h.throat], { w: w * 0.9, a, sp: 650, z: 3 });
      B.pen([h.feather], { w: w * 0.55, a: a * 0.8, sp: 420, pr: 'flick', z: 3 });
      const e = h.eye, r = h.eyeR;
      B.pen([[e[0] - r, e[1]], [e[0], e[1] - r * 0.8], [e[0] + r, e[1] - 0.1], [e[0], e[1] + r * 0.8], [e[0] - r * 0.9, e[1] + 0.2]], { w: w * 0.7, a, sp: 160, pr: 'even', z: 3, trem: 0.1 });
      B.pen([[e[0] - r * 0.3, e[1]], [e[0] + r * 0.35, e[1] + 0.2]], { w: w * 1.5, a, sp: 80, pr: 'even', z: 3, trem: 0 });
      B.pen([h.brow], { w: w * 1.5, a, sp: 420, pr: 'flick', z: 3 });
      B.pen([h.nostril], { w: w * 0.8, a, sp: 260, z: 3 });
      if (h.tongue) B.pen([h.tongue], { w: w * 0.7, a, sp: 380, pr: 'flick', z: 3 });
      // the neck: two fast pulls from the head down, stopping where they meet the body
      const inner = parse(GOOSE_BODY.inner)[0];
      const untilBody = (arr) => { const out = []; for (const p of arr) { if (pip(inner, p[0], p[1])) break; out.push(p); } return out; };
      const n = g.sp.length;
      const T = untilBody(g.throatSide.slice().reverse()), Np = untilBody(g.napeSide.slice().reverse());
      if (Np.length > 2) B.pen([every(Np, 3)], { w: w * 1.0, a, sp: 950, pr: 'taper', z: 3 });
      if (T.length > 2) B.pen([every(T, 3)], { w: w * 1.15, a, sp: 950, pr: 'taper', z: 3 });
      // furrows: a few ridged feathers down the back of an angry goose's neck
      const k0 = o.furrows || 5;
      for (let k = 0; k < k0; k++) {
        const i = clamp(Math.floor(n * (0.35 + 0.5 * (k / k0)) + B.rnd(-2, 2)), 0, n - 1);
        const A = g.napeSide[i], C = g.throatSide[clamp(i - 3, 0, n - 1)];
        if (pip(inner, A[0], A[1])) continue;
        const t0 = 0.06 + B.rnd(0, 0.06), t1 = 0.2 + B.rnd(0, 0.12);
        B.pen([[lerp(A[0], C[0], t0), lerp(A[1], C[1], t0)], [lerp(A[0], C[0], t1), lerp(A[1], C[1], t1)]], { w: w * 0.55, a: a * 0.7, sp: 380, pr: 'flick', z: 3, pause: 22, trem: 0.15 });
      }
    }
    function gooseBody() {
      B.at('goose');
      B.pen(GOOSE_BODY.breast, { w: 2.8, sp: 800, z: 3, pr: 'press' });
      B.pen(GOOSE_BODY.shoulder, { w: 1.9, a: 0.85, sp: 800, z: 3 });
      B.pen(GOOSE_BODY.back, { w: 1.5, a: 0.75, sp: 900, z: 3, pr: 'flick' });
      B.pen(GOOSE_BODY.tail, { w: 1.9, sp: 600, pr: 'flick', z: 3 });
      B.pen(GOOSE_BODY.rear, { w: 2.5, sp: 800, z: 3 });
      B.pen(GOOSE_BODY.wing, { w: 2.6, sp: 900, z: 3, pr: 'press' });
      B.pen(GOOSE_BODY.prim, { w: 1.8, sp: 900, pr: 'flick', z: 3 });
      B.pen(GOOSE_BODY.scal, { w: 1.3, sp: 420, pr: 'flick', z: 3, a: 0.7, pause: 16 });
      B.pen(GOOSE_BODY.secs, { w: 1.3, sp: 700, pr: 'flick', z: 3, a: 0.65, pause: 16 });
      B.pen(GOOSE_BODY.flank, { w: 1.1, sp: 700, pr: 'flick', z: 3, a: 0.45, pause: 18 });
      B.pen(GOOSE_BODY.belly, { w: 1.8, sp: 900, z: 3, a: 0.75 });
    }
    function gooseColour(g) {
      B.at('goose');
      // shadow first: cool grey under the wing and round the belly, smudged soft
      B.side('716,450 742,464 790,470 842,463', { col: COL.bluegrey, w: 14, lvl: 1, a: 0.75, z: 3, sp: 1600 });
      B.side('764,440 800,449 846,443 866,430', { col: COL.bluegrey, w: 12, lvl: 2, a: 0.6, z: 3, sp: 1600 });
      B.side('776,406 810,416 852,411 882,395 902,375', { col: COL.slate, w: 8, lvl: 2, a: 0.55, z: 3, sp: 1600 });
      B.smudge('728,454 762,464 810,466 848,455', { col: COL.bluegrey, w: 20, a: 0.35, z: 3 });
      // white with the side of the stick, wrapping the form; then a finger to pull it together
      [['782,350 808,340 836,336 864,342 890,348', 14, 0], ['776,361 806,354 840,351 872,354 896,357', 13, 0], ['770,373 806,367 842,365 876,365', 12, 1],
        ['738,380 724,398 716,420 717,445', 16, 0], ['744,374 731,389', 10, 0], ['751,390 739,412 735,437', 12, 1], ['764,400 756,422 757,447', 9, 2]]
        .forEach(([p, w, lvl]) => { B.side(p, { col: COL.white, w, lvl, a: 0.95, z: 3, sp: 1500, fade: [1, 0.75] }); });
      [['790,346 830,340 870,346', 12], ['744,392 730,416 730,440', 12], ['780,366 830,360 880,362', 11]].forEach(([p, w]) => B.side(p, { col: COL.white, w, lvl: 1, a: 0.9, z: 3, sp: 1500, fade: [0.9, 0.6] }));
      B.side('764,384 800,380 840,377 868,374', { col: COL.cream, w: 11, lvl: 1, a: 0.85, z: 3, sp: 1500 });
      B.side('794,394 826,399 856,393 880,381 902,364', { col: COL.cream, w: 9, lvl: 2, a: 0.75, z: 3, sp: 1500 });
      B.side('886,350 904,340 920,330', { col: COL.white, w: 8, lvl: 1, a: 0.85, z: 3, sp: 1000 });
      B.smudge('766,362 820,356 876,360', { col: COL.white, w: 26, a: 0.3, z: 3 });
      B.smudge('728,400 731,424 738,446', { col: COL.white, w: 22, a: 0.3, z: 3 });
      // a little warm light thrown up from the red cushion
      B.side('732,463 762,470 800,472', { col: '#c98a8a', w: 6, lvl: 3, a: 0.5, z: 3, sp: 1200 });
      // neck: along its length, whitest down the nape
      const n = g.sp.length;
      [[0.14, COL.white, 0, 12], [0.36, COL.white, 0, 11], [0.56, COL.white, 1, 10], [0.74, COL.cream, 2, 9], [0.9, COL.coolgrey, 2, 6]].forEach(([t, col, lvl, w]) => {
        const line = [];
        const i0 = Math.floor(n * B.rnd(0.02, 0.1)), i1 = n - Math.floor(n * B.rnd(0, 0.06));
        for (let i = i0; i < i1; i += 4) line.push([lerp(g.napeSide[i][0], g.throatSide[i][0], t), lerp(g.napeSide[i][1], g.throatSide[i][1], t), 1]);
        if (line.length > 1) B.side([line], { col, w, lvl, a: 0.95, z: 3, sp: 1700, fade: [0.95, 0.8] });
      });
      const h = g.head;
      B.side([[h.H([0.08, 0.16]), h.H([0.28, 0.26]), h.H([0.52, 0.16])]], { col: COL.white, w: 0.2 * h.L, lvl: 0, a: 0.95, z: 3, sp: 1200 });
      B.side([[h.H([0.14, -0.1]), h.H([0.34, -0.12]), h.H([0.54, -0.08])]], { col: COL.coolgrey, w: 0.12 * h.L, lvl: 2, a: 0.6, z: 3, sp: 1200 });
      // bill and the dark of the open mouth
      if (h.mouthDark) B.pp([h.mouthDark], { col: '#5a1f1a', w: 3.2, lvl: 0, a: 0.9, z: 3 });
      B.side([[h.H([0.64, 0.12]), h.H([0.8, 0.05]), h.H([0.95, -0.02])]], { col: COL.orange, w: 0.13 * h.L, lvl: 0, a: 0.95, z: 3, sp: 900 });
      B.side([[h.lowerPoly[0], h.lowerPoly[1], h.lowerPoly[2]]], { col: COL.orange, w: 0.07 * h.L, lvl: 0, a: 0.9, z: 3, sp: 900 });
      B.pp([[h.H([0.66, 0.17]), h.H([0.82, 0.095])]], { col: COL.orangelt, w: 2.4, lvl: 0, a: 0.9, z: 3 });
      B.pp([h.nail], { col: COL.cream, w: 2.6, lvl: 0, a: 0.9, z: 3 });
      // the eye: Embden blue, the pupil re-stated
      const e = h.eye;
      B.pp([[e[0] - 1.6, e[1]], [e[0] + 1.6, e[1]]], { col: '#4f86c0', w: 3.6, lvl: 0, a: 0.95, z: 3, sp: 200 });
      B.pen([[e[0] - 0.7, e[1]], [e[0] + 0.7, e[1] + 0.2]], { w: 2.6, sp: 100, pr: 'even', z: 3, trem: 0 });
      // last, the hardest white: the crest of the back, the front of the breast, the crown
      B.pp('784,344 812,334 842,334 | 728,384 716,404 712,424', { col: COL.white, w: 3.2, lvl: 0, a: 0.95, z: 3 });
      B.pp([[h.H([0.12, 0.3]), h.H([0.3, 0.36]), h.H([0.46, 0.3])]], { col: COL.white, w: 3, lvl: 0, a: 0.95, z: 3 });
    }

    /* ---- the cushion and the box (static, simple for now) */
    function boxContour() {
      B.at('goose');
      // the cushion: plump, tufted, squashed by the defendant
      B.pen('702,466 716,458 744,455 | 850,455 882,458 898,467', { w: 1.9, sp: 900, z: 4 });
      B.pen('702,466 692,474 694,486 708,494 780,498 860,496 892,490 902,479 898,467', { w: 2.2, sp: 900, z: 4, pr: 'press' });
      B.pen('760,481 763,484 | 828,482 831,485', { w: 2.6, sp: 200, z: 4, pause: 30 });
      B.pen('697,488 690,500 692,514 | 688,504 684,516 | 694,505 698,516', { w: 1.5, sp: 500, z: 4, pr: 'flick' });
      // the witness box
      B.pen('640,496 760,498 880,497 970,494', { w: 2.5, sp: 1300, z: 4, over: 10 });
      B.pen('648,482 700,481 | 900,480 962,479 992,486', { w: 1.7, sp: 1300, z: 4 });
      B.pen('646,498 647,600 649,712', { w: 2.4, sp: 1200, z: 4 });
      B.pen('966,496 964,600 963,712', { w: 2.4, sp: 1200, z: 4 });
      B.pen('970,494 992,486 991,600 990,694', { w: 1.8, sp: 1200, z: 4 });
      B.pen('656,520 800,519 958,517', { w: 1.6, sp: 1300, z: 4, a: 0.8 });
    }

    /* ---- the cast varies a little by session */
    const cast = {
      suit: B.pick([COL.navy, COL.charcoal, COL.navy, '#3b3226']),
      tie: B.pick([COL.tie, COL.tie, COL.green, COL.mustard]),
      lawyerHair: B.pick([COL.hairdk, COL.hairbr, '#3a3633']),
      cardA: B.pick([COL.teal, COL.plum, COL.mustard]),
      cardS: B.pick([COL.plum, COL.teal, '#7a3b33']),
      prosSuit: B.pick([COL.charcoal, '#5c2630', COL.greysuit]),
      prosHair: B.pick([COL.hairdk, '#6b3a22', '#c9a560']),
      stenoHair: B.pick(['#8a6a4a', COL.hairdk, COL.silver]),
      judgeHair: B.pick(['swept', 'swept', 'bald']),
      filling: B.pick(['egg', 'ham', 'cress']),
    };
    const W = room.wood;
    // everything the minutes will say is decided now, so a resized sheet tells the same story
    const words = {
      n1: B.pick(['def. sworn in (on cushion)', 'def. declines oath', 'def. takes the stand. sits']),
      n2: B.pick(GOOSE_POSES[poses[1]].note), n3: B.pick(GOOSE_POSES[poses[2]].note),
      d2: 3 + Math.floor(B.rnd(0, 6)), d3: 6 + Math.floor(B.rnd(0, 8)), m0: Math.floor(B.rnd(0, 5)),
      steno: B.pick(['steno asks how many Ks in honk', 'steno: spelling of honk?', 'steno requests honk be repeated']),
      feather: B.pick(['feather - not yet in evidence', 'feather (Exh. D?)', 'one feather. origin disputed']),
      judge: B.pick(['R. Albright', 'M. Okafor', 'J. Whitcombe', 'P. Delacroix']),
    };

    /* ---- figure data (landscape sheet units) */
    const F = {};
    F.judge = {
      g: 'judge', z: 7, lc: [1160, 270, 200],
      sil: ['1086,338 1088,290 1110,266 1124,256 1112,246 1112,190 1150,168 1196,186 1194,240 1182,262 1210,272 1232,296 1240,338'],
      post: {
        skin: [['1150,262 1140,253 1128,250 1116,252 1110,258 1110,266 1114,274 1124,279 1138,280 1150,276', { col: COL.skin, ang: -10, w: 8 }]],
        shade: [['1114,272 1124,277 1138,278', { col: COL.skinmid, w: 6 }], ['1111,262 1112,270', { col: COL.skindk, w: 4 }]],
        pen: [
          ['1152,262 1140,253 1128,250 1116,252', { w: 2.2 }],
          ['1116,252 1110,258 1110,266 1114,274 1124,279', { w: 2.4, pr: 'press' }],
          ['1112,260 1124,262 | 1113,268 1125,270', { w: 1.3, a: 0.8 }],
          ['1124,279 1138,281 1152,277', { w: 2.0 }],
          ['1136,252 1128,247 1121,246', { w: 1.7 }],
        ],
        light: [['1118,254 1134,251', { col: COL.skinlt, w: 2.6 }]],
      },
      head: { cx: 1146, cy: 212, h: 74, f: -1, tilt: -0.08, noJaw: true, hair: cast.judgeHair, hairCol: COL.white, hairLight: COL.white, turn: 0.55, glasses: 'half', eyes: 'heavy', mouth: 'down', age: 1, nose: 1.2, bushy: 1, jowl: 1, z: 7, w: 2.2 },
      gesture: ['1146,176 1150,250 1160,300 1166,336 | 1092,282 1228,292 | 1126,256 1196,334'],
      pen: [
        ['1152,262 1170,286 1190,314 1204,332', { w: 2.4 }],
        ['1152,278 1166,300 1180,322 1186,336', { w: 2.2 }],
        ['1158,268 1166,290', { w: 1.5, a: 0.8 }],
        ['1150,262 1162,282 1152,298', { w: 1.6 }],
        ['1162,282 1180,304 1200,324 1218,338', { w: 2.0 }],
        ['1172,302 1180,336 | 1188,312 1198,338', { w: 1.3, a: 0.75 }],
        ['1180,262 1206,272 1226,292 1236,320 1239,340', { w: 2.6, pr: 'press' }],
        ['1120,262 1101,272 1089,294 1083,338', { w: 2.4 }],
        ['1089,318 1062,322 1038,326 | 1036,326 1022,328 1016,335 1030,339 1044,336', { w: 2.0 }],
        ['1060,316 1064,334', { w: 1.6 }],
        ['1130,258 1141,277 1150,292 | 1162,262 1157,280 1150,292', { w: 1.8 }],
        ['1146,270 1150,300', { w: 2.6, pr: 'swell' }],
        ['1110,292 1113,336 | 1214,302 1222,336', { w: 1.2, a: 0.7 }],
      ],
      blocks: [
        ['1088,338 1088,294 1104,270 1126,258 1150,292 1160,262 1184,262 1210,274 1232,296 1240,338', { col: COL.black, ang: -72, w: 22, lvl: 0, a: 0.92 }],
        ['1156,266 1172,276 1204,326 1216,338 1184,338 1156,286', { col: COL.black, ang: -40, w: 14, lvl: 0, a: 0.9 }],
      ],
      sides: [
        ['1022,332 1040,330', { col: COL.skin, w: 6, lvl: 1, a: 0.8 }],
        ['1146,272 1150,296', { col: COL.white, w: 6, lvl: 1, a: 0.9 }],
        ['1100,282 1110,334', { col: COL.slate, w: 6, lvl: 3, a: 0.6 }],
        ['1210,280 1230,320', { col: COL.slate, w: 7, lvl: 3, a: 0.6 }],
      ],
      lights: [
        ['1138,272 1142,264 | 1158,266 1154,284', { col: COL.white, w: 3, lvl: 1 }],
      ],
    };
    F.chair = {
      g: 'judge', z: 9,
      sil: ['1060,338 1060,170 1072,130 1110,112 1162,106 1214,112 1252,130 1264,170 1262,338'],
      pen: [
        ['1064,338 1062,240 1062,172 1074,136 1110,120 1162,114', { w: 2.2 }],
        ['1162,114 1214,120 1250,136 1262,172 1262,240 1260,338', { w: 2.2 }],
        ['1074,150 1110,136 1162,130 1214,136 1250,150', { w: 1.2, a: 0.6 }],
        ['1100,162 1102,165 | 1162,152 1164,155 | 1224,162 1226,165 | 1131,196 1133,199 | 1193,196 1195,199 | 1086,232 1088,235 | 1238,232 1240,235', { w: 2.4, pause: 30 }],
      ],
      blocks: [
        ['1064,338 1062,172 1074,136 1110,120 1162,114 1214,120 1250,136 1262,172 1260,338', { col: room.chair, ang: -88, w: 30, lvl: 0, a: 0.92 }],
      ],
      lights: [
        ['1080,140 1110,126 1160,120 1210,126 1244,142', { col: COL.crimson, w: 7, lvl: 2, a: 0.7 }],
        ['1074,170 1072,300', { col: COL.crimson, w: 6, lvl: 3, a: 0.6 }],
      ],
    };
    F.bench = {
      g: 'judge', z: 6,
      sil: ['904,330 1600,322 1600,614 904,622'],
      pen: [
        ['922,346 1260,342 1600,337', { w: 2.8, over: 6, sp: 1400 }],
        ['934,334 1100,331 1260,329 1600,324', { w: 1.6, a: 0.8, sp: 1400, z: 8 }],
        ['926,362 1260,358 1600,354', { w: 1.6, a: 0.85, sp: 1400 }],
        ['922,346 905,353 905,620', { w: 2.2, sp: 1200 }],
        ['922,346 923,620', { w: 2.0, sp: 1200 }],
        ['905,620 1250,616 1600,612', { w: 1.7, a: 0.75, sp: 1400 }],
        ['950,388 948,592 | 950,388 1150,385 1152,592', { w: 1.5, a: 0.75, sp: 1300 }],
        ['1172,385 1372,383 1374,590 | 1172,385 1170,590', { w: 1.5, a: 0.75, sp: 1300 }],
        ['1394,383 1590,381 | 1394,383 1392,588', { w: 1.5, a: 0.75, sp: 1300 }],
        ['998,322 1022,318 1025,332 1001,336 998,322 | 1023,326 1052,330', { w: 1.9, z: 6.5 }],
        ['1024,338 1074,333 1088,340 1036,345 1024,338', { w: 1.3, z: 6.5 }],
      ],
      blocks: [
        ['924,346 1600,337 1600,420 924,428', { col: W[1], ang: 1, w: 30, lvl: 1, a: 0.85, gap: 0.8 }],
        ['924,420 1600,412 1600,600 924,610', { col: W[0], ang: 62, w: 32, lvl: 1, a: 0.8, gap: 0.85, skip: 0.15, fadeY: [430, 620, 0.25], angj: 10 }],
        ['950,388 1150,385 1152,592 948,592', { col: W[0], ang: 88, w: 24, lvl: 2, a: 0.6 }],
        ['1172,385 1372,383 1374,590 1170,590', { col: W[0], ang: 88, w: 24, lvl: 2, a: 0.6 }],
        ['905,353 922,346 923,620 905,620', { col: W[0], ang: 90, w: 18, lvl: 1, a: 0.85 }],
      ],
      sides: [
        ['926,340 1260,336 1600,331', { col: W[3], w: 9, lvl: 1, a: 0.85 }],
        ['930,366 1260,362 1600,358', { col: W[2], w: 7, lvl: 2, a: 0.7 }],
      ],
      lights: [
        ['1000,326 1022,322', { col: '#d9a35a', w: 3, lvl: 1 }],
        ['1028,338 1074,334 1084,340', { col: COL.white, w: 6, lvl: 0 }],
      ],
    };
    F.lawyer = {
      g: 'lawyer', z: 2, lc: [575, 480, 420],
      sil: ['296,446 330,424 352,440 424,432 488,376 540,334 536,236 616,232 632,300 616,344 632,368 664,420 676,490 690,410 668,402 672,342 690,346 700,410 704,500 676,512 640,480 620,612 652,820 508,820 512,612 506,470 448,472 360,466 300,476'],
      head: { cx: 566, cy: 286, h: 96, f: 1, tilt: -0.08, hair: 'quiff', hairCol: cast.lawyerHair, hairLight: '#86807a', eyes: 'wide', mouth: 'open', nose: 1.15, chin: 1.05, brow: 1, knit: 1, z: 2, w: 2.3 },
      gesture: ['566,240 560,336 556,450 548,560 540,700 532,820 | 492,380 424,436 300,452 | 492,380 632,370 | 632,372 676,494 696,412 | 560,612 640,730 650,800'],
      pen: [
        ['548,336 556,350 572,356 590,352', { w: 1.8 }],
        ['574,356 586,372 | 597,352 591,372', { w: 1.6 }],
        ['548,340 524,352 500,366 488,386', { w: 2.8 }],
        ['596,348 616,354 632,370', { w: 2.4 }],
        ['488,386 490,422 503,470 511,520 507,566 512,612', { w: 2.8, pr: 'press' }],
        ['632,370 637,402 629,442 619,482 613,522 618,566 616,612', { w: 3.0, pr: 'press' }],
        ['574,358 580,400 590,440 596,472 | 606,362 600,404 598,440 596,472', { w: 1.9 }],
        ['580,384 572,393 582,399', { w: 1.4 }],
        ['597,487 599,490', { w: 3 }],
        ['596,476 588,540 580,614 | 599,478 606,540 612,612', { w: 1.8 }],
        ['512,612 548,621 580,618', { w: 2.0 }],
        ['520,470 548,489 574,487 | 612,452 600,472', { w: 1.1, a: 0.6, pr: 'flick' }],
        ['610,420 627,418', { w: 1.2, a: 0.8 }],
        ['492,380 466,398 444,418 424,436', { w: 2.6 }],
        ['508,432 486,444 464,458 446,468', { w: 2.6 }],
        ['442,420 452,430 446,440 | 458,446 468,454 | 470,440 478,448', { w: 1.3, a: 0.75, pr: 'flick' }],
        ['424,436 398,440 372,442 352,442', { w: 2.4 }],
        ['446,468 418,468 390,466 360,462', { w: 2.4 }],
        ['632,372 652,410 666,452 676,494', { w: 2.8 }],
        ['676,494 682,506 694,504 700,492', { w: 2.6, pr: 'press' }],
        ['700,492 702,460 698,432 696,414', { w: 2.6 }],
        ['676,494 678,470 676,446 674,418', { w: 2.0 }],
        ['678,470 688,476 | 680,452 690,456', { w: 1.2, a: 0.75, pr: 'flick' }],
        ['512,614 512,680 516,740 520,800', { w: 2.6, sp: 1100, pr: 'flick' }],
        ['558,648 554,700 550,760 548,806', { w: 2.0, sp: 1100, pr: 'flick' }],
        ['618,612 630,670 644,730 650,790', { w: 2.8, sp: 1100, pr: 'flick' }],
        ['574,656 586,706 598,756 604,806', { w: 1.9, sp: 1100, pr: 'flick' }],
        ['552,632 566,648 576,660', { w: 1.5 }],
        ['630,722 644,730 | 604,740 616,748 | 540,680 538,740', { w: 1.1, a: 0.6, pr: 'flick' }],
      ],
      blocks: [
        ['488,386 500,366 524,352 548,340 574,358 596,348 632,370 637,402 619,482 618,566 616,612 548,621 512,612 507,566 511,520 503,470 490,422', { col: cast.suit, ang: -76, w: 30, lvl: 0, a: 0.92, gap: 0.62, angj: 12 }],
        ['492,380 424,436 352,442 360,462 446,468 508,432', { col: cast.suit, ang: -15, w: 18, lvl: 0, a: 0.92, gap: 0.6, angj: 10 }],
        ['632,372 676,494 700,492 696,414 672,414 652,410', { col: cast.suit, ang: -75, w: 16, lvl: 0, a: 0.92, gap: 0.6 }],
        ['512,614 558,648 548,806 520,800', { col: cast.suit, ang: -88, w: 20, lvl: 1, a: 0.9, gap: 0.6, fadeY: [650, 820, 0.1] }],
        ['618,612 650,790 604,806 574,656 560,622', { col: cast.suit, ang: -80, w: 20, lvl: 1, a: 0.9, gap: 0.6, fadeY: [650, 820, 0.1] }],
      ],
      sides: [
        ['626,382 622,470 616,560 | 694,430 698,488', { col: COL.black, w: 12, lvl: 1, a: 0.6 }],
        ['590,362 596,400 597,440', { col: COL.white, w: 9, lvl: 0, a: 0.9 }],
        ['550,342 566,352 588,350', { col: COL.white, w: 6, lvl: 0, a: 0.9 }],
        ['590,366 596,402 597,442', { col: cast.tie, w: 6, lvl: 0, a: 0.95 }],
        ['487,920 560,930', { col: COL.black, w: 1, lvl: 3, a: 0.01 }],
      ],
      lights: [
        ['500,372 524,356 546,346 | 492,394 498,446 | 472,402 432,434', { col: COL.coolgrey, w: 4.5, lvl: 1, a: 0.85 }],
        ['356,442 360,460 | 672,406 694,408', { col: COL.white, w: 4, lvl: 0 }],
        ['516,640 518,740', { col: COL.coolgrey, w: 3.5, lvl: 2, a: 0.7 }],
      ],
      post: {
        skin: [
          ['352,442 332,442 300,448 296,462 304,471 320,463 356,462', { col: COL.skin, ang: -5, w: 8 }],
          ['670,404 666,392 670,382 676,380 674,352 678,346 684,350 686,380 690,382 694,394 692,404', { col: COL.skin, ang: -85, w: 7 }],
        ],
        shade: [['322,462 342,464 354,460', { col: COL.skinmid, w: 6 }], ['688,384 692,400', { col: COL.skinmid, w: 5 }]],
        pen: [
          ['356,462 342,466 328,466 320,463', { w: 2.2, pr: 'press' }],
          ['350,442 340,440 332,442', { w: 1.6 }],
          ['344,442 340,432 334,426 329,428 331,434 336,440', { w: 1.7 }],
          ['332,442 320,442 306,444 300,448 306,451 318,450 328,451', { w: 1.6 }],
          ['326,452 312,455 300,458 296,462 302,464 314,462 324,461', { w: 1.7 }],
          ['322,462 310,467 304,471 308,473 318,469', { w: 1.7 }],
          ['352,440 358,462 | 346,441 352,462', { w: 1.5 }],
          ['670,404 666,392 670,382 680,378 690,382 694,394 692,404', { w: 2.2, pr: 'press' }],
          ['676,380 674,366 674,352 678,346 683,350 684,364 686,380', { w: 1.9 }],
          ['670,392 688,390', { w: 1.1, a: 0.7 }],
          ['668,394 680,392 686,398', { w: 1.4 }],
          ['670,410 694,412 | 672,404 694,406', { w: 1.5 }],
        ],
        light: [['310,446 330,444 | 680,350 680,372', { col: COL.skinlt, w: 2.6 }]],
      },
    };
    const dash = (x0, y0, x1, y1, k) => { const out = []; for (let i = 0; i < k; i++) { const a = i / k, b = (i + 0.55) / k; out.push(lerp(x0, x1, a).toFixed(1) + ',' + lerp(y0, y1, a).toFixed(1) + ' ' + lerp(x0, x1, b).toFixed(1) + ',' + lerp(y0, y1, b).toFixed(1)); } return out.join(' | '); };
    F.easel = {
      g: 'easel', z: 2.5,
      sil: ['212,298 410,312 412,590 214,602'],
      silZ: 2.4,
      pen: [
        ['318,312 318,258', { w: 2.0 }],
        ['214,300 408,314', { w: 2.2, over: 5 }],
        ['408,314 410,588', { w: 2.0 }],
        ['410,588 216,600', { w: 2.2 }],
        ['216,600 214,300', { w: 2.0 }],
        ['262,300 236,450 212,620 196,860', { w: 2.2, z: 2.6, sp: 1100 }],
        ['372,306 398,450 420,620 446,860', { w: 2.2, z: 2.6, sp: 1100 }],
        ['318,272 322,450 328,620 334,800', { w: 1.6, a: 0.8, z: 2.6, sp: 1100 }],
        ['200,604 300,598 426,590 | 204,616 300,610 426,601', { w: 1.8 }],
        ['222,760 330,752 432,748', { w: 1.5, a: 0.8, z: 2.6 }],
      ],
      marker: [
        ['242,408 240,488 238,566 316,567 394,565 318,486 242,408', { w: 3.4 }],
        ['254,428 252,556 372,555', { w: 1.8 }],
        ['298,468 304,480 316,488 330,484 336,472', { w: 2.6 }],
        [dash(244, 404, 394, 404, 7) + ' | ' + dash(396, 406, 396, 562, 7), { w: 2.2 }],
      ],
      blocks: [
        ['216,304 406,318 408,586 218,598', { col: COL.white, ang: -86, w: 30, lvl: 2, a: 0.85, gap: 0.7, skip: 0.02 }],
      ],
      sides: [
        ['250,430 252,550 360,552', { col: cast.filling === 'ham' ? '#e7a0a0' : cast.filling === 'cress' ? '#d9c98a' : COL.egg, w: 12, lvl: 1, a: 0.8 }],
        ['318,310 318,264 | 212,620 196,860 | 420,620 446,860', { col: COL.sienna, w: 4, lvl: 2, a: 0.8, z: 2.6 }],
      ],
      lettuce: '248,414 260,420 266,434 280,440 288,456 302,462 308,478 | 336,500 344,506 352,522 366,528 374,544 386,552',
    };
    F.jury = {
      g: 'jury', z: 4, loose: true,
      sil: ['0,580 206,574 210,760 0,780', '0,456 40,440 110,436 120,520 0,540'],
      heads: [
        { cx: 150, cy: 478, h: 68, f: 1, tilt: 0.02, hair: 'curly', hairCol: COL.silver, hairLight: COL.white, glasses: true, eyes: 'open', mouth: 'closed', age: 1, nose: 0.95, z: 4 },
        { cx: 62, cy: 506, h: 70, f: 1, tilt: 0.62, hair: 'bald', hairCol: COL.hairbr, eyes: 'closed', mouth: 'open', nose: 1.1, chin: 0.95, z: 4 },
        { cx: 104, cy: 404, h: 58, f: 1, tilt: 0.0, hair: 'short', hairCol: COL.hairdk, eyes: 'open', turn: 0.4, z: 4.6, w: 1.6 },
      ],
      pen: [
        ['0,590 100,586 206,580', { w: 2.6, sp: 1100 }],
        ['0,604 100,600 206,594', { w: 1.8, sp: 1100 }],
        ['206,580 208,700 | 194,594 196,700', { w: 2.0 }],
        ['20,630 180,626 | 20,630 20,720', { w: 1.4, a: 0.7 }],
        ['122,512 108,530 102,560 100,584', { w: 2.2 }],
        ['166,516 178,530 188,556 192,580', { w: 2.2 }],
        ['150,520 160,548 | 140,522 156,556', { w: 1.4 }],
        ['150,580 168,576 182,580 | 158,586 176,586', { w: 1.6 }],
        ['20,544 10,580 | 92,540 104,558 110,584', { w: 2.0 }],
        ['64,538 72,560 76,584', { w: 2.6, pr: 'swell' }],
        ['56,536 68,546 80,536', { w: 1.6 }],
        ['0,452 40,450', { w: 1.4, a: 0.7, z: 4.6 }],
      ],
      blocks: [
        ['104,524 188,526 192,580 100,584', { col: cast.cardA, ang: -70, w: 15, lvl: 0, a: 0.9 }],
        ['0,580 206,574 208,700 0,716', { col: W[1], ang: 4, w: 22, lvl: 1, a: 0.85 }],
        ['16,546 96,540 110,584 6,586', { col: COL.cream, ang: -70, w: 14, lvl: 2, a: 0.7 }],
      ],
      sides: [
        ['0,586 100,582 206,577', { col: W[3], w: 7, lvl: 1, a: 0.8 }],
        ['66,542 74,580', { col: COL.crimson, w: 5, lvl: 1, a: 0.9 }],
        ['152,580 178,580', { col: COL.skin, w: 6, lvl: 1, a: 0.85 }],
      ],
    };
    F.steno = {
      g: 'steno', z: 3, loose: true,
      sil: ['1030,560 1070,550 1090,580 1098,640 1106,706 1104,790 1040,790 1000,780 966,684 964,656 1004,650 1030,612'],
      head: { cx: 1056, cy: 588, h: 54, f: -1, tilt: -0.35, hair: 'bun', hairCol: cast.stenoHair, glasses: true, eyes: 'down', mouth: 'closed', nose: 1, z: 3, w: 1.8 },
      pen: [
        ['1070,604 1088,628 1096,664 1094,704', { w: 2.2 }],
        ['1040,614 1032,640 1034,668', { w: 2.0 }],
        ['1046,624 1038,650 1026,666 1004,670 990,666', { w: 1.9 }],
        ['1052,640 1046,662 1030,676 1006,678', { w: 1.9 }],
        ['990,666 982,664 978,670 | 1006,678 992,680', { w: 1.6 }],
        ['966,660 1000,654 1006,668 972,674 966,660 | 972,674 974,682 1004,676', { w: 1.8 }],
        ['986,680 974,760 | 988,680 990,770 | 990,680 1004,760', { w: 1.3, a: 0.8 }],
        ['1098,640 1104,706 | 1046,708 1104,706 | 1052,710 1050,780 | 1100,708 1102,780', { w: 1.5, a: 0.8 }],
        ['1042,706 1004,714 1000,770 | 1034,712 1010,722 1008,774', { w: 1.8 }],
      ],
      blocks: [
        ['1040,614 1070,604 1094,664 1094,704 1046,708 1034,668', { col: cast.cardS, ang: -60, w: 13, lvl: 0, a: 0.9 }],
        ['1046,624 990,666 1006,678 1052,640', { col: cast.cardS, ang: -20, w: 9, lvl: 0, a: 0.9 }],
      ],
      sides: [
        ['968,664 1002,660', { col: COL.black, w: 8, lvl: 0, a: 0.85 }],
        ['1042,710 1004,716 1002,766', { col: COL.charcoal, w: 9, lvl: 2, a: 0.7 }],
      ],
    };
    F.bailiff = {
      g: 'bailiff', z: 3, loose: true,
      sil: ['1460,320 1482,300 1530,300 1550,340 1540,382 1560,404 1572,450 1566,560 1550,800 1460,800 1450,560 1446,470 1460,420 1480,392'],
      head: { cx: 1510, cy: 350, h: 74, f: -1, tilt: 0.03, hair: 'buzz', hairCol: COL.grey, eyes: 'open', mouth: 'closed', moustache: true, nose: 1.15, chin: 1.15, age: 1, browW: 1.9, z: 3 },
      pen: [
        ['1488,390 1472,404 1460,432 1452,470 1448,510 1454,550', { w: 2.4, pr: 'press' }],
        ['1534,382 1556,404 1568,440 1568,490 1562,530 1556,560', { w: 2.4 }],
        ['1484,388 1496,398 1506,394', { w: 1.6 }],
        ['1556,438 1560,462 1546,478 1500,482 1468,476 1462,466', { w: 2.3 }],
        ['1556,438 1530,452 1500,458 1470,456', { w: 2.0 }],
        ['1462,466 1456,458 1462,450 1472,452', { w: 1.8 }],
        ['1540,400 1560,420 1562,440', { w: 1.8 }],
        ['1452,548 1506,553 1558,558 | 1454,562 1506,566 1556,570', { w: 2.0 }],
        ['1478,552 1480,566 | 1528,556 1528,578 1542,580 1542,558', { w: 1.6 }],
        ['1456,566 1460,640 1463,700 | 1552,572 1549,640 1547,700', { w: 2.0, sp: 1100, pr: 'flick' }],
        ['1506,600 1504,700', { w: 1.2, a: 0.7 }],
        ['1478,416 1484,410 1490,416 1486,424 1480,424 1478,416', { w: 1.4 }],
        ['1466,430 1490,432', { w: 1.3, a: 0.8 }],
      ],
      blocks: [
        ['1462,404 1534,384 1568,440 1562,548 1452,548 1450,470', { col: COL.khaki, ang: -80, w: 18, lvl: 0, a: 0.9 }],
        ['1454,566 1556,572 1546,760 1462,760', { col: COL.olive, ang: -88, w: 20, lvl: 1, a: 0.85, fadeY: [600, 760, 0.1] }],
      ],
      sides: [
        ['1468,466 1500,474 1546,470', { col: COL.khaki, w: 10, lvl: 0, a: 0.9 }],
        ['1556,420 1562,520', { col: '#7c6a45', w: 8, lvl: 2, a: 0.7 }],
        ['1454,555 1556,563', { col: COL.black, w: 8, lvl: 0, a: 0.9 }],
        ['1482,418 1486,416', { col: COL.gold, w: 6, lvl: 0, a: 0.95 }],
      ],
      lights: [
        ['1470,410 1458,450 1454,500', { col: COL.cream, w: 4, lvl: 2, a: 0.8 }],
        ['1480,553 1480,563', { col: COL.gold, w: 3, lvl: 0 }],
      ],
    };
    F.pros = {
      g: 'pros', z: 1.5, loose: true,
      sil: ['1230,850 1240,806 1256,784 1252,740 1258,700 1300,690 1336,720 1334,780 1360,792 1382,852'],
      head: { cx: 1292, cy: 738, h: 80, f: -1, tilt: -0.2, hair: 'bob', hairCol: cast.prosHair, eyes: 'down', mouth: 'smirk', nose: 0.95, chin: 1, z: 1.5 },
      pen: [
        ['1256,786 1244,806 1238,842', { w: 2.2 }],
        ['1334,782 1356,796 1372,826 1380,850', { w: 2.4 }],
        ['1262,780 1274,792 | 1300,782 1290,794', { w: 1.6 }],
        ['1252,812 1236,834 1222,846 | 1272,820 1250,842 1232,852', { w: 2.0 }],
        ['1222,846 1208,850 1198,856', { w: 1.8 }],
        ['1198,858 1176,846', { w: 2.4, pr: 'even' }],
        ['1168,850 1236,846 1246,860 1176,864 1168,850', { w: 1.4, z: 1.4 }],
        ['1398,812 1400,846 1416,846 1418,812 | 1398,812 1408,808 1418,812 1408,816 1398,812', { w: 1.4, z: 1.4 }],
        ['1330,852 1390,848 1400,856 1340,860', { w: 1.2, a: 0.8, z: 1.4 }],
      ],
      blocks: [
        ['1256,786 1334,782 1380,850 1238,846', { col: cast.prosSuit, ang: -62, w: 16, lvl: 0, a: 0.9 }],
        ['1252,812 1272,820 1232,852 1222,846', { col: cast.prosSuit, ang: -40, w: 9, lvl: 0, a: 0.9 }],
      ],
      sides: [
        ['1172,852 1240,850', { col: COL.yellow, w: 10, lvl: 0, a: 0.9 }],
        ['1200,854 1212,850', { col: COL.skin, w: 6, lvl: 1, a: 0.85 }],
      ],
      lights: [
        ['1402,816 1404,842', { col: COL.white, w: 3, lvl: 0 }],
        ['1334,852 1390,850', { col: COL.white, w: 5, lvl: 1 }],
      ],
    };
    F.table = {
      g: 'pros', z: 1, loose: true,
      sil: ['1070,860 1480,852 1480,1000 1070,1000'],
      pen: [
        ['1072,872 1280,866 1476,860', { w: 2.6, over: 6, sp: 1300 }],
        ['1094,846 1290,840 1456,836', { w: 1.5, a: 0.8, z: 2, sp: 1300 }],
        ['1086,872 1088,990 | 1462,862 1460,990', { w: 1.8, sp: 1200 }],
        ['1080,890 1470,882', { w: 1.3, a: 0.7, sp: 1300 }],
      ],
      blocks: [
        ['1074,872 1476,862 1474,950 1080,960', { col: W[1], ang: 2, w: 24, lvl: 2, a: 0.75 }],
      ],
      sides: [['1076,868 1280,862 1474,857', { col: W[3], w: 6, lvl: 1, a: 0.8 }]],
    };
    F.box = {
      g: 'goose', z: 4,
      sil: ['640,478 994,476 994,712 640,712'],
      blocks: [
        ['648,498 966,496 964,600 649,604', { col: W[1], ang: 70, w: 30, lvl: 1, a: 0.85, gap: 0.8, angj: 10 }],
        ['648,600 966,596 964,712 649,712', { col: W[1], ang: 70, w: 30, lvl: 2, a: 0.7, gap: 1.1, skip: 0.35, angj: 10 }],
        ['966,496 992,486 990,694 964,712', { col: W[0], ang: 88, w: 14, lvl: 1, a: 0.85 }],
      ],
      sides: [
        ['644,489 800,488 968,486', { col: W[3], w: 9, lvl: 1, a: 0.85 }],
        ['656,522 800,521 958,519', { col: W[2], w: 6, lvl: 2, a: 0.7 }],
      ],
    };

    /* ---- silhouettes (nearer things hide farther ones) */
    for (const k in F) {
      const f = F[k]; B.at(f.g);
      (f.sil || []).forEach((poly) => B.sil(poly, f.silZ || f.z, 5));
      if (f.head) drawHead(B, f.head, 'sil');
      (f.heads || []).forEach((h) => drawHead(B, h, 'sil'));
    }
    B.at('goose');
    B.sil(GOOSE_BODY.poly, 3, 6);
    // the final pose hides everything behind it; the abandoned one only keeps the wall off it
    [[geo[2], 3], [geo[1], 9.3]].forEach(([g, zz]) => { B.sil(g.left.concat(g.right.slice().reverse()), zz, 5); B.sil(g.head.poly, zz, 6); });

    /* ---- runners */
    function at(f) { B.at(f.g); B.loose = !!f.loose; if (f.lc) B.lightAt(f.lc[0], f.lc[1], f.lc[2]); }
    function figGesture(f) {
      at(f);
      (f.gesture || []).forEach((p) => B.pp(p, { w: 2.3, sp: 1700, p: 0.75, z: f.z }));
      if (f.head) drawHead(B, f.head, 'gesture');
    }
    function figPen(f, which) {
      at(f);
      if (f.head && which !== 'body') { drawHead(B, f.head, 'contour'); at(f); }
      (f.heads || []).forEach((h) => { drawHead(B, Object.assign({ loose: f.loose }, h), 'contour'); at(f); });
      (f.pen || []).forEach(([p, o]) => B.pen(p, Object.assign({ z: f.z }, o)));
    }
    function figColour(f) {
      at(f);
      const lz = (o) => f.loose ? Object.assign({}, o, { gap: (o.gap || 0.78) * 1.35, a: (o.a || 0.85) * 0.8, skip: (o.skip || 0.06) + 0.2 }) : o;
      (f.blocks || []).forEach(([p, o]) => B.block(p, lz(Object.assign({ z: f.z }, o))));
      (f.sides || []).forEach(([p, o]) => B.side(p, Object.assign({ z: f.z, sp: 1500 }, o)));
    }
    function figSkin(f) {
      at(f);
      if (f.head) drawHead(B, f.head, 'colour');
      (f.heads || []).forEach((h) => drawHead(B, h, 'colour'));
    }
    function figHands(f) {
      if (!f.post) return;
      at(f);
      (f.post.skin || []).forEach(([p, o]) => B.block(p, Object.assign({ z: f.z, lvl: 1, a: 0.9, gap: 0.6, over: 0, skip: 0, sp: 1200, pause: 10 }, o)));
      (f.post.shade || []).forEach(([p, o]) => B.side(p, Object.assign({ z: f.z, lvl: 2, a: 0.75, sp: 900 }, o)));
      (f.post.pen || []).forEach(([p, o]) => B.pen(p, Object.assign({ z: f.z, sp: 500 }, o)));
      (f.post.light || []).forEach(([p, o]) => B.pp(p, Object.assign({ z: f.z, lvl: 1, a: 0.85 }, o)));
    }
    function figLight(f) {
      at(f);
      if (f.head) drawHead(B, f.head, 'light');
      (f.heads || []).forEach((h) => drawHead(B, h, 'light'));
      (f.lights || []).forEach(([p, o]) => B.pp(p, Object.assign({ z: f.z, a: 0.9 }, o)));
    }

    /* ---- the wall behind it all: panelling blocked with the side of the stick */
    function wall() {
      B.at('wall');
      const WL = layout.wall, top = WL.top, bot = WL.bot, LW = layout.W;
      const focus = layout.focus;
      // fewer, bigger sweeps with the side of the stick, each with its own angle and pressure
      const n = layout.portrait ? 13 : 17;
      for (let i = 0; i < n; i++) {
        const t = (i + B.rnd(-0.3, 0.3)) / n;
        const cx = lerp(WL.x0 + 40, WL.x1 - 40, t), cy = lerp(top + 60, bot - 120, B.rnd(0.15, 0.85));
        const d = clamp(Math.hypot((cx - focus[0]) / (LW * 0.55), (cy - focus[1]) / 900), 0, 1);
        if (B.chance(d * 0.45)) continue;
        const ang = (B.chance(0.7) ? -78 : -102) + B.rnd(-10, 10), len = B.rnd(260, 480) * (1 - d * 0.35);
        const dx = Math.cos(ang * Math.PI / 180) * len / 2, dy = Math.sin(ang * Math.PI / 180) * len / 2;
        const bow = B.rnd(-30, 30);
        B.side([[cx - dx, cy - dy, B.rnd(0.6, 1)], [cx + bow, cy, 1], [cx + dx, cy + dy, B.rnd(0.4, 0.9)]],
          { col: B.chance(0.25) ? W[2] : W[1], w: B.rnd(70, 110), lvl: d < 0.35 ? 0 : d < 0.65 ? 1 : 2, a: 0.95 - d * 0.5, z: 10, sp: 2600, pause: 40, fade: [B.rnd(0.7, 1), B.rnd(0.2, 0.7)] });
      }
      // a cornice, two stiles, a rail: just enough to say panelling
      B.side([[WL.x0 + 30, top + 6, 1], [LW * 0.5, top, 1], [WL.x1 - 40, top - 6, 1]], { col: W[0], w: 24, lvl: 1, a: 0.8, z: 10, sp: 3600, fade: [0.9, 0.3] });
      // the darkest wood right behind the bird's head: lightest light against darkest dark
      for (let i = 0; i < 4; i++) {
        const cx = focus[0] + B.rnd(-160, 160), cy = focus[1] + B.rnd(-80, 120);
        B.side([[cx + B.rnd(-20, 20), cy - 170, 1], [cx, cy, 1], [cx + B.rnd(-30, 30), cy + 170, 0.7]], { col: W[0], w: B.rnd(60, 90), lvl: 0, a: 0.85, z: 10, sp: 2400, pause: 40 });
      }
      // a few deliberate accents
      for (let i = 0; i < 5; i++) {
        const x = lerp(WL.x0 + 80, WL.x1 - 80, B.rnd(0, 1));
        B.side([[x, top + 30, 1], [x + B.rnd(-6, 6), top + B.rnd(220, 380), 0.6]], { col: B.chance(0.5) ? W[0] : W[3], w: B.rnd(10, 18), lvl: 1, a: 0.85, z: 10, sp: 3000 });
      }
      B.smudge([[focus[0] - 200, focus[1] - 60, 1], [focus[0] + 220, focus[1] + 20, 1]], { col: W[1], w: 80, a: 0.25, z: 10, sp: 1200 });
      B.smudge([[WL.x0 + 120, top + 160, 1], [WL.x0 + 300, top + 300, 1]], { col: W[1], w: 70, a: 0.2, z: 10, sp: 1200 });
    }
    function wallPen() {
      B.at('wall');
      const WL = layout.wall, top = WL.top, LW = layout.W;
      B.pen([[[WL.x0 + 30, top - 8], [LW * 0.3, top - 10], [LW * 0.46, top - 13]], [[LW * 0.78, top - 16], [WL.x1 - 30, top - 19]]], { w: 1.6, a: 0.75, z: 10, sp: 1500 });
      [0.12, 0.52].forEach((t) => { const x = lerp(WL.x0, WL.x1, t); B.pen([[[x, top + 14], [x + 1, top + 170 + B.rnd(0, 120)]]], { w: 1.4, a: 0.6, z: 10, sp: 1500 }); });
    }
    function floor() {
      B.at('floor');
      // just the shadows things cast, and a hint of boards; the well of the court stays bare paper
      B.side('652,716 800,722 962,716', { col: W[0], w: 16, lvl: 2, a: 0.6, z: 9.5, sp: 2400 });
      B.side('600,716 640,760 | 980,712 1060,740', { col: room.carpet, w: 12, lvl: 3, a: 0.45, z: 9.5, sp: 2400 });
      B.pen('470,958 700,950 | 760,948 900,944 | 980,930 1060,926', { w: 1.2, a: 0.5, z: 9.5, sp: 1800, pr: 'flick' });
    }
    function clock() {
      B.at('clock');
      const cx = 980, cy = 196, r = 28, pts = [];
      for (let i = 0; i <= 26; i++) { const a = -1.4 + (i / 24) * TAU; pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r * 1.02, 1]); }
      B.pen([pts], { w: 2.0, sp: 700, pr: 'even', z: 8 });
      B.pp([[[cx - 18, cy - 14, 1], [cx + 10, cy - 20, 1]]], { col: COL.white, w: 6, lvl: 2, z: 8 });
      return { cx, cy, r };
    }
    function clockHands(c, hh, mm) {
      B.at('clock');
      const am = (mm / 60) * TAU - Math.PI / 2, ah = ((hh % 12 + mm / 60) / 12) * TAU - Math.PI / 2;
      B.pen([[[c.cx, c.cy, 1], [c.cx + Math.cos(am) * c.r * 0.82, c.cy + Math.sin(am) * c.r * 0.82, 1]]], { w: 1.6, sp: 300, pr: 'even', z: 8 });
      B.pen([[[c.cx, c.cy, 1], [c.cx + Math.cos(ah) * c.r * 0.5, c.cy + Math.sin(ah) * c.r * 0.5, 1]]], { w: 2.6, sp: 200, pr: 'even', z: 8 });
      for (let i = 0; i < 12; i += 3) { const a = (i / 12) * TAU; B.pen([[[c.cx + Math.cos(a) * c.r * 0.78, c.cy + Math.sin(a) * c.r * 0.78, 1], [c.cx + Math.cos(a) * c.r * 0.92, c.cy + Math.sin(a) * c.r * 0.92, 1]]], { w: 1.4, sp: 200, z: 8, pause: 20 }); }
    }
    function feather() {
      B.at('feather');
      // one white feather on the floor: quill, the two vanes, a split in the barbs, down at the base
      B.pen('724,891 744,886 766,879 788,870 806,860', { w: 1.4, sp: 500, z: 1, pr: 'flick' });
      B.pen('742,884 752,876 766,870 780,866 794,860 804,858 | 746,892 760,889 774,884 786,878 798,869', { w: 1.0, a: 0.6, sp: 600, z: 1, pr: 'flick' });
      B.side('744,885 760,877 778,870 798,861', { col: COL.white, w: 7, lvl: 0, a: 0.95, z: 1, sp: 700 });
      B.side('748,890 766,886 784,879 800,868', { col: COL.white, w: 5, lvl: 1, a: 0.9, z: 1, sp: 700 });
      B.pp('760,878 756,872 | 772,882 770,890', { col: COL.paperHi || COL.cream, w: 1.6, lvl: 1, a: 0.9, z: 1 });
      B.pp('727,889 716,882 | 728,892 714,893 | 730,890 722,898', { col: COL.white, w: 1.8, lvl: 1, a: 0.8, z: 1 });
      B.side('734,898 800,884', { col: COL.black, w: 5, lvl: 3, a: 0.35, z: 1 });
    }
    function exhibit() {
      B.at('easel');
      F.easel.marker.forEach(([p, o]) => B.pen(p, Object.assign({ z: 2.3, sp: 650 }, o)));
      B.write('EXHIBIT C', 234, 360, 16, { w: 2.8, slant: 0.04, sp: 700, pause: 120 });
      B.write('?', 340, 476, 20, { w: 2.8, slant: 0.1, pause: 60 });
    }
    function exhibitColour() {
      B.at('easel');
      B.pp(F.easel.lettuce, { col: COL.green, w: 4, lvl: 0, a: 0.9, z: 2.3 });
      if (cast.filling === 'ham' || B.chance(0.5)) B.pp('300,476 296,486 | 350,520 346,530', { col: COL.tomato, w: 4, lvl: 0, a: 0.9, z: 2.3 });
    }
    function washes() {
      // two more small washes, laid quick and left to dry with a hard edge
      B.at('goose');
      B.wash('650,712 700,724 820,730 960,724 1000,712 960,716 800,718', { col: '#4a4f5a', a: 0.5, edge: '#30343c' });
      B.at('pros');
      B.wash('1168,850 1236,846 1246,860 1176,864', { col: '#e2c440', a: 0.7, edge: '#b89a20' });
    }
    function cushionColour() {
      B.at('goose');
      B.wash('696,468 716,458 760,454 840,454 882,458 898,468 902,480 892,490 860,496 780,498 708,494 694,486', { col: COL.burgundy, a: 0.75, edge: '#4a121b' });
      B.side('704,486 780,494 860,492 896,482', { col: COL.crimson, w: 9, lvl: 1, a: 0.8, z: 4 });
      B.pp('710,462 760,458 | 840,458 878,462', { col: '#d0606a', w: 4, lvl: 1, a: 0.8, z: 4 });
      B.pp('697,490 690,502 692,514 | 688,504 685,516', { col: COL.gold, w: 2.4, lvl: 0, a: 0.9, z: 4 });
    }
    function coverUp(g) {
      // the artist knocks back an abandoned neck with a few strokes of the wall colour
      B.at('goose');
      const n = g.sp.length;
      const line = [];
      for (let i = Math.floor(n * 0.35); i < n; i += 5) line.push(g.sp[i]);
      line.push(g.head.H([0.5, 0.05]));
      B.side([line], { col: W[1], w: 34, lvl: 1, a: 0.62, z: 9, sp: 1800 });
      B.side([[g.head.H([0.1, 0.1]), g.head.H([0.9, 0.0])]], { col: W[2], w: 22, lvl: 2, a: 0.5, z: 9, sp: 1500 });
    }

    /* ---- notes in the artist's hand */
    let mins = 52 + words.m0, hrs = 10;
    const stamp = (adv) => { mins += adv; while (mins >= 60) { mins -= 60; hrs++; } return hrs + ':' + String(mins).padStart(2, '0'); };
    const slots = layout.notes || {
      head: [40, 66], A1: [470, 52], A2: [470, 92], B1: [920, 52], B2: [1290, 52],
      jury: [26, 806], steno: [880, 800], feather: [830, 930], sig: [1440, 976],
    };
    function note(slot, text, size, o) {
      const p = slots[slot]; if (!p) return;
      B.at('');
      size = size || 12.5;
      // wrap to the slot's width if it has one, the way a note squeezes into the space left
      const lines = [];
      if (p[2]) { let cur = ''; text.split(' ').forEach((wd) => { const t = cur ? cur + ' ' + wd : wd; if (cur && B.textWidth(t, size) > p[2]) { lines.push(cur); cur = wd; } else cur = t; }); lines.push(cur); } else lines.push(text);
      lines.forEach((ln, i) => B.write(ln, p[0] + (i ? size * 0.8 : 0), p[1] + i * size * 2, size, Object.assign({ w: 1.6, sp: 900 }, o || {}, i ? { pause: 60 } : {})));
    }
    function arrow(from, to) {
      B.at('');
      const mx = (from[0] + to[0]) / 2 + (to[1] - from[1]) * 0.15, my = (from[1] + to[1]) / 2 - (to[0] - from[0]) * 0.15;
      B.pen([[from, [mx, my], to]], { w: 1.4, sp: 900, z: null, nocut: true, pr: 'even' });
      const a = Math.atan2(to[1] - my, to[0] - mx);
      B.pen([[[to[0] - Math.cos(a - 0.45) * 12, to[1] - Math.sin(a - 0.45) * 12], to, [to[0] - Math.cos(a + 0.45) * 12, to[1] - Math.sin(a + 0.45) * 12]]], { w: 1.4, sp: 600, z: null, nocut: true, pr: 'even', raw: true });
    }

    // ===================================================== the performance
    B.pause(700);
    // the goose first: it is the subject, and it will not hold still
    gooseGesture(geo[0]);
    gooseNeck(geo[0], { a: 0.8, w: 1.9 });
    gooseBody();
    note('A1', stamp(0) + '  ' + words.n1);
    figGesture(F.lawyer);
    figPen(F.lawyer);
    // it moves
    B.pause(300);
    gooseGesture(geo[1]);
    gooseNeck(geo[1], { a: 0.86, w: 2.1 });
    note('A2', stamp(words.d2) + '  def. ' + words.n2);
    figColour(F.lawyer);
    figGesture(F.judge);
    figPen(F.judge); figPen(F.chair);
    figPen(F.easel); exhibit();
    boxContour(); figPen(F.bench);
    const ck = clock();
    wallPen();
    // blocking in: the room's wood behind, then the robe and the chair
    wall();
    figColour(F.chair); figColour(F.judge); figColour(F.bench); figColour(F.box);
    // and it moves again
    B.pause(500);
    gooseGesture(geo[2]);
    gooseNeck(geo[2], { a: 0.95, w: 2.6 });
    note('B1', stamp(words.d3) + '  def. ' + words.n3);
    coverUp(geo[1]);
    gooseColour(geo[2]);
    cushionColour();
    figColour(F.easel); exhibitColour();
    // the rest of the room, each figure in a breath: line, then colour
    [F.jury, F.steno, F.bailiff].forEach((f) => { figPen(f); figColour(f); });
    figPen(F.pros); figPen(F.table); figColour(F.pros); figColour(F.table);
    floor(); washes();
    [F.judge, F.lawyer, F.jury, F.steno, F.bailiff, F.pros].forEach(figSkin);
    [F.judge, F.lawyer].forEach(figHands);
    [F.judge, F.chair, F.bench, F.lawyer, F.jury, F.bailiff, F.pros].forEach(figLight);
    feather();
    // the margins
    B.at('');
    B.write('juror 9', slots.jury[0], slots.jury[1], 12, { w: 1.5 });
    B.write('asleep since', slots.jury[0], slots.jury[1] + 22, 12, { w: 1.5, pause: 60 });
    B.write('10:15', slots.jury[0], slots.jury[1] + 44, 12, { w: 1.5, pause: 60 });
    arrow([slots.jury[0] + 40, slots.jury[1] - 22], (layout.targets || {}).juror || [58, 548]);
    note('steno', words.steno, 11.5);
    note('feather', words.feather, 11.5);
    arrow([slots.feather[0] - 8, slots.feather[1] - 12], (layout.targets || {}).feather || [800, 874]);
    note('head', 'PEOPLE v. GOOSE', 19, { w: 2.2, slant: 0.08, sp: 800 });
    B.at(''); B.pen([[[slots.head[0] - 4, slots.head[1] + 9], [slots.head[0] + 300, slots.head[1] + 6]]], { w: 1.8, z: null, nocut: true, sp: 1400 });
    B.write('Dept. 9   Hon. ' + words.judge, slots.head[0], slots.head[1] + 36, 11, { w: 1.4 });
    const rec = stamp(Math.max(1, 42 - mins + (hrs === 11 ? 0 : 60)));
    clockHands(ck, hrs, mins);
    note('B2', rec + '  recess', 13, { w: 1.8 });
    note('sig', 'R.H.  22.X', 11, { w: 1.4 });

    return { strokes: B.S, room, poses, layout };
  }

  /* ============================================================ RENDERING */
  // paper tooth: a tileable height field, histogram-equalised so a threshold = coverage
  function makeTooth(T, feat, seed) {
    const rnd = mulberry32(seed);
    const H = new Float32Array(T * T);
    // Mi-Teintes felt side: a regular honeycomb of shallow pits (a hex lattice, barely jittered),
    // a faint weave across it, and only a whisper of random fibre. The same grain for every stroke.
    const cell = Math.max(3.2, feat * 2.0);
    const nx = Math.max(4, Math.round(T / cell)), ny = Math.max(4, Math.round(T / (cell * 0.866) / 2) * 2);
    const cw = T / nx, rh = T / ny;
    const jx = new Float32Array(nx * ny), jy = new Float32Array(nx * ny);
    for (let i = 0; i < nx * ny; i++) { jx[i] = (rnd() - 0.5) * 0.22; jy[i] = (rnd() - 0.5) * 0.22; }
    for (let y = 0; y < T; y++) {
      const ry = Math.floor(y / rh);
      for (let x = 0; x < T; x++) {
        let d1 = 1e9;
        for (let oy = -1; oy <= 1; oy++) {
          const r = ry + oy, rr = ((r % ny) + ny) % ny, off = (rr % 2) * 0.5;
          const cx0 = Math.floor(x / cw - off);
          for (let ox = -1; ox <= 1; ox++) {
            const c = cx0 + ox, cc = ((c % nx) + nx) % nx, k = rr * nx + cc;
            const px = (c + off + 0.5 + jx[k]) * cw, py = (r + 0.5 + jy[k]) * rh;
            const d = (px - x) * (px - x) + (py - y) * (py - y);
            if (d < d1) d1 = d;
          }
        }
        const dn = Math.sqrt(d1) / cw;
        H[y * T + x] = 1 - Math.exp(-dn * dn * 9) + 0.06 * Math.sin((x + y * 0.3) / cw * Math.PI * 2) * Math.sin((y - x * 0.3) / rh * Math.PI);
      }
    }
    const oct = [[feat * 1.1, 0.07], [feat * 6, 0.05], [feat * 30, 0.06]];
    for (const [per, amp] of oct) {
      const n = Math.max(2, Math.round(T / per));
      const g = new Float32Array(n * n); for (let i = 0; i < g.length; i++) g[i] = rnd();
      const sc = n / T;
      for (let y = 0; y < T; y++) {
        const fy2 = y * sc, iy = Math.floor(fy2), ty = fy2 - iy, sy = ty * ty * (3 - 2 * ty);
        const r0 = (iy % n) * n, r1 = ((iy + 1) % n) * n;
        for (let x = 0; x < T; x++) {
          const fx2 = x * sc, ix = Math.floor(fx2), tx = fx2 - ix, sx = tx * tx * (3 - 2 * tx);
          const i0 = ix % n, i1 = (ix + 1) % n;
          H[y * T + x] += lerp(lerp(g[r0 + i0], g[r0 + i1], sx), lerp(g[r1 + i0], g[r1 + i1], sx), sy) * amp;
        }
      }
    }
    // equalise
    const idx = new Uint32Array(T * T); for (let i = 0; i < idx.length; i++) idx[i] = i;
    const arr = Array.from(idx).sort((a, b) => H[a] - H[b]);
    const E = new Float32Array(T * T);
    for (let r = 0; r < arr.length; r++) E[arr[r]] = r / (arr.length - 1);
    return E;
  }
  function maskCanvas(E, T, coverage, soft) {
    const c = document.createElement('canvas'); c.width = c.height = T;
    const x = c.getContext('2d'); const im = x.createImageData(T, T);
    const thr = 1 - coverage;
    for (let i = 0; i < T * T; i++) {
      const a = sstep(thr - soft, thr + soft, E[i]);
      im.data[i * 4] = im.data[i * 4 + 1] = im.data[i * 4 + 2] = 255; im.data[i * 4 + 3] = a * 255;
    }
    x.putImageData(im, 0, 0);
    return c;
  }
  function grainCanvas(E, T) {
    const c = document.createElement('canvas'); c.width = c.height = T;
    const x = c.getContext('2d'); const im = x.createImageData(T, T);
    for (let i = 0; i < T * T; i++) {
      const v = E[i];
      if (v < 0.5) { im.data[i * 4] = 40; im.data[i * 4 + 1] = 30; im.data[i * 4 + 2] = 20; im.data[i * 4 + 3] = Math.pow((0.5 - v) * 2, 1.6) * 30; }
      else { im.data[i * 4] = 255; im.data[i * 4 + 1] = 250; im.data[i * 4 + 2] = 240; im.data[i * 4 + 3] = Math.pow((v - 0.5) * 2, 2) * 22; }
    }
    x.putImageData(im, 0, 0);
    return c;
  }

  function hexA(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  }

  // union-of-quads(+discs) path: every sub-path wound the same way, so one fill = no seams, no double coverage
  function ribbonPath(ctx, P, n, hwL, hwR, discs) {
    ctx.beginPath();
    for (let i = 0; i < n - 1; i++) {
      const a = P[i], b = P[i + 1];
      let dx = b[0] - a[0], dy = b[1] - a[1]; const L = Math.hypot(dx, dy); if (L < 1e-6) continue;
      const nx = -dy / L, ny = dx / L;
      ctx.moveTo(a[0] + nx * hwL[i], a[1] + ny * hwL[i]);
      ctx.lineTo(b[0] + nx * hwL[i + 1], b[1] + ny * hwL[i + 1]);
      ctx.lineTo(b[0] - nx * hwR[i + 1], b[1] - ny * hwR[i + 1]);
      ctx.lineTo(a[0] - nx * hwR[i], a[1] - ny * hwR[i]);
      ctx.closePath();
    }
    if (discs) {
      for (let i = 0; i < n; i++) {
        const r = Math.max(0.3, (hwL[i] + hwR[i]) / 2);
        ctx.moveTo(P[i][0] + r, P[i][1]);
        ctx.arc(P[i][0], P[i][1], r, 0, TAU, true);
      }
    }
  }

  // one closed outline: left edge out, right edge back. Fast to fill; fine for gentle curves.
  function outlinePath(ctx, P, n, hwL, hwR) {
    ctx.beginPath();
    const L = [], Rt = [];
    for (let i = 0; i < n; i++) {
      const a = P[Math.max(0, i - 1)], b = P[Math.min(n - 1, i + 1)];
      let dx = b[0] - a[0], dy = b[1] - a[1]; const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
      L.push(P[i][0] - dy * hwL[i], P[i][1] + dx * hwL[i]);
      Rt.push(P[i][0] + dy * hwR[i], P[i][1] - dx * hwR[i]);
    }
    ctx.moveTo(L[0], L[1]);
    for (let i = 2; i < L.length; i += 2) ctx.lineTo(L[i], L[i + 1]);
    for (let i = Rt.length - 2; i >= 0; i -= 2) ctx.lineTo(Rt[i], Rt[i + 1]);
    ctx.closePath();
  }
  // a line of varying width as short native-stroked runs (round caps hide the joins)
  function strokeRuns(ctx, P, n, hw, k) {
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (let i = 0; i < n - 1; i += k) {
      const j = Math.min(n - 1, i + k);
      let w = 0; for (let q = i; q <= j; q++) w += hw[q]; w = (2 * w) / (j - i + 1);
      ctx.lineWidth = Math.max(0.4, w);
      ctx.beginPath(); ctx.moveTo(P[i][0], P[i][1]);
      for (let q = i + 1; q <= j; q++) ctx.lineTo(P[q][0], P[q][1]);
      ctx.stroke();
    }
  }

  function Renderer(el) {
    const base = document.createElement('canvas');
    const live = document.createElement('canvas');
    const tmp = document.createElement('canvas');
    const tx = tmp.getContext('2d');
    [base, live].forEach((c) => { c.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;display:block'; el.appendChild(c); });
    const bx = base.getContext('2d'), lx = live.getContext('2d');
    const V = { s: 1, ox: 0, oy: 0, W: 0, H: 0, dpr: 1, masks: [], grain: null, sheet: null };
    let dirty = null;

    function setup(cssW, cssH, dpr, layout, room, seed) {
      V.dpr = dpr; V.W = Math.round(cssW * dpr); V.H = Math.round(cssH * dpr);
      base.width = live.width = tmp.width = V.W; base.height = live.height = tmp.height = V.H;
      // the sheet on the board
      const mx = layout.portrait ? 0.035 : 0.045, myT = layout.portrait ? 0.07 : 0.05, myB = layout.portrait ? 0.07 : 0.085;
      const availW = V.W * (1 - 2 * mx), availH = V.H * (1 - myT - myB);
      const s = Math.min(availW / layout.W, availH / layout.H);
      V.s = s; V.ox = Math.round((V.W - layout.W * s) / 2); V.oy = Math.round(V.H * myT + (availH - layout.H * s) / 2);
      const zm = /trialzoom=([\d.]+),([\d.]+),([\d.]+)/.exec(location.search);
      if (zm) { V.s = s * +zm[3]; V.ox = Math.round(V.W / 2 - +zm[1] * V.s); V.oy = Math.round(V.H / 2 - +zm[2] * V.s); }
      V.sheet = [V.ox, V.oy, layout.W * V.s, layout.H * V.s];

      // tooth
      const T = 384;
      const E = makeTooth(T, Math.max(1.4, 1.25 * dpr), seed);
      V.masks = [maskCanvas(E, T, 0.9, 0.12), maskCanvas(E, T, 0.78, 0.14), maskCanvas(E, T, 0.6, 0.15), maskCanvas(E, T, 0.4, 0.14), maskCanvas(E, T, 0.975, 0.03)].map((c) => lx.createPattern(c, 'repeat'));
      V.grain = bx.createPattern(grainCanvas(E, T), 'repeat');
      paintPaper(room, seed);
      lx.setTransform(1, 0, 0, 1, 0, 0);
      lx.save(); lx.beginPath(); lx.rect(V.sheet[0], V.sheet[1], V.sheet[2], V.sheet[3]); lx.clip();
    }

    function paintPaper(room, seed) {
      const rnd = mulberry32(seed ^ 0x5eed);
      const c = bx;
      c.setTransform(1, 0, 0, 1, 0, 0);
      // the wall / drawing board
      const g = c.createRadialGradient(V.W * 0.5, V.H * 0.45, 0, V.W * 0.5, V.H * 0.5, Math.max(V.W, V.H) * 0.75);
      g.addColorStop(0, '#2a2723'); g.addColorStop(1, '#121110');
      c.fillStyle = g; c.fillRect(0, 0, V.W, V.H);
      const [x, y, w, h] = V.sheet;
      c.save();
      c.shadowColor = 'rgba(0,0,0,0.55)'; c.shadowBlur = 28 * V.dpr; c.shadowOffsetY = 8 * V.dpr;
      c.fillStyle = room.paper; c.fillRect(x, y, w, h);
      c.restore();
      c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip();
      // slow colour drift in the sheet
      for (let i = 0; i < 14; i++) {
        const cx = x + rnd() * w, cy = y + rnd() * h, r = (0.15 + rnd() * 0.4) * Math.max(w, h);
        const gg = c.createRadialGradient(cx, cy, 0, cx, cy, r);
        const col = rnd() < 0.5 ? room.paper2 : '#ffffff';
        gg.addColorStop(0, hexA(col, col === '#ffffff' ? 0.05 : 0.22)); gg.addColorStop(1, hexA(col, 0));
        c.fillStyle = gg; c.fillRect(x, y, w, h);
      }
      c.fillStyle = V.grain; c.fillRect(x, y, w, h);
      // a few fibres
      c.lineWidth = 0.6 * V.dpr;
      for (let i = 0; i < 160; i++) {
        const fx = x + rnd() * w, fy = y + rnd() * h, a = rnd() * TAU, l = (3 + rnd() * 9) * V.dpr;
        c.strokeStyle = rnd() < 0.5 ? 'rgba(255,250,235,0.18)' : 'rgba(60,40,25,0.12)';
        c.beginPath(); c.moveTo(fx, fy); c.quadraticCurveTo(fx + Math.cos(a + 1) * l * 0.5, fy + Math.sin(a + 1) * l * 0.5, fx + Math.cos(a) * l, fy + Math.sin(a) * l); c.stroke();
      }
      // edge darkening of handled paper
      const eg = c.createLinearGradient(x, 0, x + w, 0);
      eg.addColorStop(0, 'rgba(60,40,20,0.08)'); eg.addColorStop(0.04, 'rgba(60,40,20,0)'); eg.addColorStop(0.96, 'rgba(60,40,20,0)'); eg.addColorStop(1, 'rgba(60,40,20,0.08)');
      c.fillStyle = eg; c.fillRect(x, y, w, h);
      c.restore();
      // masking tape at the top corners
      const tape = (tx, ty, ang) => {
        c.save(); c.translate(tx, ty); c.rotate(ang);
        const tw = 92 * V.s, th = 30 * V.s;
        c.beginPath(); c.moveTo(-tw / 2, -th / 2);
        for (let k = 0; k <= 6; k++) c.lineTo(-tw / 2 + tw * k / 6, -th / 2 + (rnd() - 0.5) * 2 * V.s);
        for (let k = 0; k <= 5; k++) c.lineTo(tw / 2 + (rnd() - 0.5) * 4 * V.s, -th / 2 + th * k / 5);
        for (let k = 6; k >= 0; k--) c.lineTo(-tw / 2 + tw * k / 6, th / 2 + (rnd() - 0.5) * 2 * V.s);
        for (let k = 5; k >= 0; k--) c.lineTo(-tw / 2 + (rnd() - 0.5) * 4 * V.s, -th / 2 + th * k / 5);
        c.closePath();
        c.fillStyle = 'rgba(226,214,180,0.78)'; c.fill();
        c.fillStyle = V.grain; c.globalAlpha = 0.6; c.fill(); c.globalAlpha = 1;
        c.restore();
      };
      tape(x + 18 * V.s, y + 6 * V.s, -0.6 + rnd() * 0.2);
      tape(x + w - 18 * V.s, y + 6 * V.s, 0.6 - rnd() * 0.2);
    }

    const D = (st, i) => { const p = st.d[i]; return [V.ox + p[0] * V.s, V.oy + p[1] * V.s, p[2]]; };

    function bboxOf(st, n, pad) {
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      const src = st.poly ? st.poly : st.d;
      const m = st.poly ? src.length : n;
      for (let i = 0; i < m; i++) { const p = src[i]; x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); }
      const s = V.s, pd = pad * s;
      const X0 = Math.max(0, Math.floor(V.ox + x0 * s - pd)), Y0 = Math.max(0, Math.floor(V.oy + y0 * s - pd));
      const X1 = Math.min(V.W, Math.ceil(V.ox + x1 * s + pd)), Y1 = Math.min(V.H, Math.ceil(V.oy + y1 * s + pd));
      return [X0, Y0, Math.max(1, X1 - X0), Math.max(1, Y1 - Y0)];
    }

    // draw stroke `st` up to fraction f (0..1) into the live layer (full opacity; alpha is applied on commit)
    function drawLive(st, f) {
      clearLive();
      if (!st.d.length && st.tool !== 'wash') return;
      const total = st.d.length;
      let n = Math.max(2, Math.min(total, Math.ceil(f * (total - 1)) + 1));
      if (st.tool === 'wash') n = total;
      const s = V.s, c = lx;
      const P = new Array(n);
      for (let i = 0; i < n; i++) P[i] = D(st, i);
      const pad = st.tool === 'side' ? st.w : st.tool === 'smudge' ? st.w * 2 : st.tool === 'wash' ? 6 : st.w * 2 + 4;
      const bb = bboxOf(st, n, pad);
      dirty = bb;
      c.globalCompositeOperation = 'source-over';
      if (st.tool === 'pen' || st.tool === 'write') {
        const hw = P.map((p) => 0.5 * st.w * s * (0.38 + 0.62 * p[2]));
        const k = st.tool === 'write' ? 2 : 3;
        if (st.tool === 'pen' && st.w * s > 1.2) {
          // bleed: the porous point feathers slightly into the fibres
          const t = tx;
          t.clearRect(bb[0], bb[1], bb[2], bb[3]);
          t.strokeStyle = st.col;
          strokeRuns(t, P, n, hw.map((h) => h + 0.4 * s + 0.22 * st.w * s), k);
          c.globalAlpha = 0.2; c.drawImage(tmp, bb[0], bb[1], bb[2], bb[3], bb[0], bb[1], bb[2], bb[3]); c.globalAlpha = 1;
        }
        c.strokeStyle = st.col;
        strokeRuns(c, P, n, hw, k);
        if (st.dry) { c.globalCompositeOperation = 'destination-in'; c.fillStyle = V.masks[1]; c.fillRect(bb[0], bb[1], bb[2], bb[3]); }
      } else if (st.tool === 'pp') {
        const hw = P.map((p) => 0.5 * st.w * s * (0.4 + 0.6 * p[2]));
        c.strokeStyle = st.col; strokeRuns(c, P, n, hw, 3);
        c.globalCompositeOperation = 'destination-in'; c.fillStyle = V.masks[st.lvl]; c.fillRect(bb[0], bb[1], bb[2], bb[3]);
      } else if (st.tool === 'side') {
        const r = mulberry32((st.seedv * 4294967296) >>> 0);
        const nz = noise1(r);
        const hwL = [], hwR = [], iL = [], iR = [];
        for (let i = 0; i < n; i++) {
          const base = 0.5 * st.w * s * (0.3 + 0.7 * Math.min(1, P[i][2]));
          const l = base * (0.88 + 0.22 * nz(i * 0.17)), rr = base * (0.88 + 0.22 * nz(i * 0.17 + 30));
          hwL.push(l); hwR.push(rr);
          iL.push(l * (0.5 + 0.25 * nz(i * 0.3 + 60))); iR.push(rr * (0.5 + 0.25 * nz(i * 0.3 + 90)));
        }
        // the outer fringe of the stick only catches the high tooth...
        const t = tx;
        t.globalCompositeOperation = 'source-over';
        t.clearRect(bb[0], bb[1], bb[2], bb[3]);
        t.fillStyle = st.col; outlinePath(t, P, n, hwL, hwR); t.fill();
        t.globalCompositeOperation = 'destination-in'; t.fillStyle = V.masks[Math.min(3, st.lvl + 2)]; t.fillRect(bb[0], bb[1], bb[2], bb[3]);
        c.drawImage(tmp, bb[0], bb[1], bb[2], bb[3], bb[0], bb[1], bb[2], bb[3]);
        // ...the body of it presses into the paper
        t.globalCompositeOperation = 'source-over';
        t.clearRect(bb[0], bb[1], bb[2], bb[3]);
        t.fillStyle = st.col; outlinePath(t, P, n, iL, iR); t.fill();
        // streaks from the uneven edge of the stick
        t.globalCompositeOperation = 'destination-out';
        const ns = st.streak === false ? 0 : 2 + Math.floor(r() * 3);
        for (let k = 0; k < ns; k++) {
          const off = (r() * 1.6 - 0.8) * st.w * s * 0.4, wd = (0.03 + r() * 0.06) * st.w * s;
          t.fillStyle = 'rgba(0,0,0,' + (0.2 + r() * 0.35) + ')';
          const Q = P.map((p, i) => { const a = P[Math.max(0, i - 1)], b = P[Math.min(n - 1, i + 1)]; const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1; return [p[0] - dy / L * off, p[1] + dx / L * off]; });
          const ww = Q.map(() => wd);
          outlinePath(t, Q, n, ww, ww); t.fill();
        }
        t.globalCompositeOperation = 'destination-in'; t.fillStyle = V.masks[st.lvl]; t.fillRect(bb[0], bb[1], bb[2], bb[3]);
        c.drawImage(tmp, bb[0], bb[1], bb[2], bb[3], bb[0], bb[1], bb[2], bb[3]);
        t.globalCompositeOperation = 'source-over';
        // pressure: lighter where the stroke lifts
        if (st.fade && total > 1) {
          const a = D(st, 0), z = D(st, total - 1);
          const gr = c.createLinearGradient(a[0], a[1], z[0], z[1]);
          gr.addColorStop(0, 'rgba(0,0,0,' + (1 - st.fade[0]) + ')');
          gr.addColorStop(1, 'rgba(0,0,0,' + (1 - st.fade[1]) + ')');
          c.globalCompositeOperation = 'destination-out';
          c.fillStyle = gr; c.fillRect(bb[0], bb[1], bb[2], bb[3]);
        }
      } else if (st.tool === 'smudge') {
        const off = 20000;
        c.save();
        c.shadowColor = st.col; c.shadowBlur = st.w * s * 0.8; c.shadowOffsetX = off;
        c.beginPath();
        for (let i = 0; i < n; i += 2) { const r = st.w * s * 0.5 * (0.5 + 0.5 * P[i][2]); c.moveTo(P[i][0] - off + r, P[i][1]); c.arc(P[i][0] - off, P[i][1], r, 0, TAU, true); }
        c.fillStyle = '#000'; c.fill();
        c.restore();
      } else if (st.tool === 'wash') {
        const m = Math.max(2, Math.ceil(f * (total - 1)) + 1);
        const poly = st.poly.map((p) => [V.ox + p[0] * s, V.oy + p[1] * s]);
        c.save();
        if (f < 1) {
          c.beginPath();
          for (let i = 0; i < m; i++) { const p = D(st, i); c.moveTo(p[0] + st.r * s, p[1]); c.arc(p[0], p[1], st.r * s, 0, TAU, true); }
          c.clip();
        }
        const shape = () => { c.beginPath(); poly.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]))); c.closePath(); };
        shape(); c.fillStyle = hexA(st.col, 0.42); c.fill();
        // pigment settles unevenly: a few blooms, and it gathers at the wet edge as it dries
        const r = mulberry32((st.seedv * 4294967296) >>> 0);
        c.save(); shape(); c.clip();
        for (let k = 0; k < 6; k++) {
          const bx0 = bb[0] + r() * bb[2], by0 = bb[1] + r() * bb[3], rr = (0.2 + r() * 0.35) * Math.max(bb[2], bb[3]);
          const gr = c.createRadialGradient(bx0, by0, 0, bx0, by0, rr);
          gr.addColorStop(0, hexA(st.edge, 0.22 * r())); gr.addColorStop(1, hexA(st.edge, 0));
          c.fillStyle = gr; c.fillRect(bb[0], bb[1], bb[2], bb[3]);
        }
        shape(); c.strokeStyle = hexA(st.edge, 0.4); c.lineWidth = 9 * s; c.stroke();
        c.restore();
        if (f >= 1) { shape(); c.strokeStyle = hexA(st.edge, 0.85); c.lineWidth = 1.1 * s + 0.4; c.lineJoin = 'round'; c.stroke(); }
        c.restore();
        c.globalCompositeOperation = 'destination-out'; c.globalAlpha = 0.45; c.fillStyle = V.masks[2]; c.fillRect(bb[0], bb[1], bb[2], bb[3]); c.globalAlpha = 1;
      }
      c.globalCompositeOperation = 'source-over';
      live.style.opacity = st.a;
    }
    function clearLive() {
      if (dirty) { lx.clearRect(dirty[0] - 2, dirty[1] - 2, dirty[2] + 4, dirty[3] + 4); dirty = null; }
    }
    function commit(st) {
      drawLive(st, 1);
      if (dirty) {
        const [x, y, w, h] = dirty;
        const x0 = Math.max(0, x), y0 = Math.max(0, y), x1 = Math.min(V.W, x + w), y1 = Math.min(V.H, y + h);
        if (x1 > x0 && y1 > y0) {
          bx.globalAlpha = st.a;
          bx.drawImage(live, x0, y0, x1 - x0, y1 - y0, x0, y0, x1 - x0, y1 - y0);
          bx.globalAlpha = 1;
        }
      }
      clearLive();
    }
    return { setup, drawLive, commit, clearLive, V, base, live };
  }

  /* ============================================================== PLAYER */
  function timeline(strokes, target) {
    let t = 0;
    for (const st of strokes) {
      st.dur = st.len ? Math.max(30, (st.len / st.sp) * 1000) : 0;
      if (!isFinite(st.dur)) st.dur = 30;
    }
    const raw = strokes.reduce((a, st) => a + st.dur + (st.pause || 0), 0);
    const k = clamp(target / raw, 0.35, 1.8);
    for (const st of strokes) {
      t += (st.pause || 0) * k;
      st.t0 = t; st.dur *= k; t += st.dur;
    }
    return t;
  }

  (window.PIECES = window.PIECES || []).push({
    id: 'trial',
    title: 'The People v. a Goose',
    medium: 'Pastel, porous-point pen and watercolour on toned paper, drawn live',
    note: 'The sketch is drawn as you watch. Tap the finished sheet for the next session.',
    about: 'A courtroom artist, cameras banned, draws a goose on trial at the speed of the hearing. The defendant will not sit still, so the sheet keeps the necks it has already drawn, and the margin keeps the minutes.',
    tone: 'dark',
    room: '#151412',
    mount(el, api) {
      el.style.background = '#151412';
      el.style.cursor = 'default';
      const params = new URLSearchParams(location.search);
      const jump = params.get('trialt');
      const R = Renderer(el);
      let raf = 0, alive = true, session = 0, score = null, total = 0;
      let clock = 0, lastNow = 0, idx = 0, finished = false, catchup = false, readied = false;
      let seed = api.seed >>> 0;
      let cssW = 0, cssH = 0, portrait = false;

      function build() {
        const layout = makeLayout(portrait);
        score = buildScore(seed, layout);
        total = timeline(score.strokes, 52000);
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        R.setup(cssW, cssH, dpr, layout, score.room, seed);
        idx = 0;
      }
      function measure() {
        const r = el.getBoundingClientRect();
        cssW = Math.max(1, r.width); cssH = Math.max(1, r.height);
        portrait = cssW / cssH < 0.9;
      }
      function start() {
        measure(); build();
        clock = jump === 'end' ? total + 1 : (jump ? +jump : 0);
        catchup = clock > 0;
        lastNow = performance.now();
        if (!catchup && !readied) { readied = true; api.ready(); }
        cancelAnimationFrame(raf); raf = requestAnimationFrame(frame);
      }
      function frame(now) {
        if (!alive || !api.isCurrent()) return;
        const dt = Math.min(100, now - lastNow); lastNow = now;
        const S = score.strokes;
        if (catchup) {
          // re-draw everything up to `clock`, in small slices so the page stays responsive
          const t0 = performance.now();
          while (idx < S.length && S[idx].t0 + S[idx].dur <= clock && performance.now() - t0 < 14) {
            if (S[idx].len || S[idx].tool === 'wash') R.commit(S[idx]); idx++;
          }
          if (idx >= S.length || S[idx].t0 + S[idx].dur > clock) {
            catchup = false; if (jump) window.__trialDone = performance.now();
            if (!readied) { readied = true; api.ready(); }
          }
          raf = requestAnimationFrame(frame); return;
        }
        if (!finished) clock += dt;
        while (idx < S.length && S[idx].t0 + S[idx].dur <= clock) {
          if (S[idx].len || S[idx].tool === 'wash') R.commit(S[idx]);
          idx++;
        }
        if (idx < S.length) {
          const st = S[idx];
          if (clock >= st.t0 && (st.len || st.tool === 'wash')) {
            const u = clamp((clock - st.t0) / st.dur, 0, 1);
            const f = 0.55 * u + 0.45 * u * u * (3 - 2 * u);
            R.drawLive(st, f);
          } else R.clearLive();
        } else if (!finished) {
          finished = true; R.clearLive(); onFinished();
        }
        raf = requestAnimationFrame(frame);
      }

      let rsT = 0;
      const ro = new ResizeObserver(() => {
        clearTimeout(rsT);
        rsT = setTimeout(() => {
          const r = el.getBoundingClientRect();
          if (Math.abs(r.width - cssW) < 2 && Math.abs(r.height - cssH) < 2) return;
          measure(); build();
          catchup = true; // replay what has been drawn so far into the new size
        }, 180);
      });
      ro.observe(el);

      // a finished sheet stays up; a tap (or a long pause) turns to a fresh one for the next session
      const hint = document.createElement('div');
      hint.textContent = 'tap the sheet for the next session';
      hint.style.cssText = 'position:absolute;left:0;right:0;bottom:max(14px,2.2vh);text-align:center;font:italic 15px/1 Georgia,serif;letter-spacing:.04em;color:rgba(240,234,222,.5);opacity:0;transition:opacity 1.2s ease;pointer-events:none';
      el.appendChild(hint);
      let idleT = 0;
      function onFinished() {
        hint.style.opacity = '1'; el.style.cursor = 'pointer';
        clearTimeout(idleT);
        idleT = setTimeout(() => { if (alive && finished) newSession(); }, 50000);
      }
      function newSession() {
        if (!alive) return;
        clearTimeout(idleT);
        hint.style.opacity = '0'; el.style.cursor = 'default';
        // the finished sheet is lifted off the board...
        const old = document.createElement('canvas');
        old.width = R.base.width; old.height = R.base.height;
        old.getContext('2d').drawImage(R.base, 0, 0);
        old.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;transition:transform 1.1s cubic-bezier(.5,0,.75,0),opacity 1.1s ease;transform-origin:50% 0';
        el.insertBefore(old, hint);
        requestAnimationFrame(() => requestAnimationFrame(() => { old.style.transform = 'translate(-2%,-6%) rotate(-2.5deg)'; old.style.opacity = '0'; }));
        setTimeout(() => old.remove(), 1300);
        // ...and a fresh one is underneath
        session++;
        seed = hash2(api.seed >>> 0, session);
        build();
        clock = -600; finished = false; catchup = false; lastNow = performance.now();
      }
      el.addEventListener('pointerdown', () => { if (finished) newSession(); });
      start();

      return {
        destroy() { alive = false; cancelAnimationFrame(raf); ro.disconnect(); clearTimeout(rsT); clearTimeout(idleT); el.innerHTML = ''; },
      };
    },
  });
})();
