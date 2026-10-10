/* Ten Hands — 01 · The Deer Who Carried the First Maize
 *
 * Acrylic yarn pressed into beeswax, after the Wixárika (Huichol) yarn-painting tradition.
 *
 * The figures are drawn as vector shapes on a virtual 2048-unit board. They are rasterised into a
 * map of regions, a Euclidean distance transform measures every point's distance to the nearest
 * edge, and iso-contours of that field (one every yarn's width) become the strands: each shape is
 * outlined and then filled inward, contour by contour, and the dark ground echoes every figure
 * outward until the ripples meet in seams — the way a yarn painter actually works. Each strand is
 * then rendered as a twisted, shaded, slightly fuzzy piece of acrylic yarn.
 */
(function () {
  'use strict';

  const B = 2048;                // the board is B×B units
  const SP = 6.2;                // yarn pitch: distance between neighbouring strands
  const D0 = SP * 0.5 + 0.3;     // centre of the first strand, measured from a shape's edge
  const YW = SP * 1.08;          // drawn width of a strand
  const LX = -0.56, LY = -0.83;  // direction towards the light (upper left)
  const NBR = 12;                // strands in the border (even)
  const DBG = (typeof window !== 'undefined' && window.__NIERIKA_DEBUG) || {};

  /* ------------------------------------------------------------------ randomness */
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hash2(a, b) {
    let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul((b + 0x7f4a7c15) | 0, 0xc2b2ae35);
    h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12; h = Math.imul(h, 0x297a2d39); h ^= h >>> 15;
    return h >>> 0;
  }
  function makeNoise(seed) {
    const rnd = mulberry32(seed);
    const p = []; for (let i = 0; i < 256; i++) p.push(i);
    for (let i = 255; i > 0; i--) { const j = (rnd() * (i + 1)) | 0; const t = p[i]; p[i] = p[j]; p[j] = t; }
    const perm = new Uint8Array(512); for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
    const val = new Float32Array(256); for (let i = 0; i < 256; i++) val[i] = rnd() * 2 - 1;
    return function (x, y) {
      const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
      const X = xi & 255, Y = yi & 255;
      const a = val[perm[X + perm[Y]]], b = val[perm[X + 1 + perm[Y]]];
      const c = val[perm[X + perm[Y + 1]]], d = val[perm[X + 1 + perm[Y + 1]]];
      const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
      return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
    };
  }

  /* ------------------------------------------------------------------ yarn colours */
  const RGB = {
    K: [22, 18, 26],    // black
    P: [64, 18, 112],   // deep purple
    I: [30, 28, 112],   // indigo
    N: [16, 34, 120],   // navy
    B: [18, 74, 224],   // cobalt
    R: [56, 128, 255],  // bright blue
    S: [104, 204, 255], // sky
    T: [0, 184, 198],   // turquoise
    G: [12, 150, 66],   // green
    L: [146, 216, 18],  // lime
    Y: [255, 208, 0],   // chrome yellow
    O: [255, 122, 0],   // orange
    V: [255, 60, 22],   // vermilion
    D: [214, 16, 46],   // red
    M: [226, 0, 128],   // magenta
    H: [255, 96, 182],  // hot pink
    U: [130, 42, 210],  // purple
    W: [245, 241, 230], // white
    C: [240, 218, 160], // cream
    A: [196, 106, 48],  // copper
    E: [112, 52, 22],   // brown
    n: [20, 30, 98],    // night blue (ground)
    q: [88, 14, 64],    // wine (ground)
    g: [12, 66, 40],    // deep green (ground)
    z: [6, 64, 78],     // deep teal (ground)
    p: [54, 20, 96],    // deep purple (ground)
  };
  const KEYS = Object.keys(RGB);
  const KI = {}; KEYS.forEach((k, i) => { KI[k] = i; });
  const NV = 3; // dye lots per colour

  function yarnColours(seed) {
    const rnd = mulberry32(seed ^ 0xC0105);
    const cl = (x) => Math.max(0, Math.min(255, Math.round(x)));
    const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
    const css = (a, al) => al == null ? 'rgb(' + cl(a[0]) + ',' + cl(a[1]) + ',' + cl(a[2]) + ')'
      : 'rgba(' + cl(a[0]) + ',' + cl(a[1]) + ',' + cl(a[2]) + ',' + al + ')';
    const out = [];
    for (const key of KEYS) {
      for (let v = 0; v < NV; v++) {
        const f = 1 + (v === 0 ? 0 : (rnd() - 0.5) * 0.12);
        const base = RGB[key].map((x) => x * f + (v === 0 ? 0 : (rnd() - 0.5) * 12));
        const dark = [base[0] * 0.6, base[1] * 0.55, base[2] * 0.6];
        const groundy = key === 'K' || 'nqgzp'.indexOf(key) >= 0;
        const hi = mix(base, [255, 252, 242], groundy ? 0.17 : key === 'W' ? 0.6 : 0.42);
        out.push({
          key,
          base: css(base), dark: css(dark), hi: css(hi),
          shadow: css(mix(base.map((x) => x * 0.16), [10, 6, 4], 0.35)),
          groove: css(base.map((x) => x * 0.3), 0.55),
          ply: css(mix(base, [255, 255, 255], groundy ? 0.3 : 0.55), groundy ? 0.3 : 0.4),
          fuzz: css(mix(base, [255, 255, 255], groundy ? 0.16 : 0.28), 0.5),
          flat: css(base),
        });
      }
    }
    return out;
  }

  /* ------------------------------------------------------------------ vector drawing helpers */
  // Catmull–Rom through control points; every component (x, y, width...) is interpolated.
  function spline(pts, closed, step) {
    const n = pts.length, dim = pts[0].length, out = [];
    const segs = closed ? n : n - 1;
    for (let i = 0; i < segs; i++) {
      const p0 = pts[closed ? (i - 1 + n) % n : Math.max(0, i - 1)];
      const p1 = pts[i], p2 = pts[(i + 1) % n];
      const p3 = pts[closed ? (i + 2) % n : Math.min(n - 1, i + 2)];
      const m = Math.max(1, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / step));
      for (let j = 0; j < m; j++) {
        const t = j / m, t2 = t * t, t3 = t2 * t, q = new Array(dim);
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
  const blob = (pts, step) => spline(pts, true, step || 5);
  // A tapered stroke from control points [x, y, width]; round ends.
  function limb(ctrl, step) {
    const c = spline(ctrl, false, step || 4);
    const n = c.length, Lp = [], Rp = [], T = [];
    for (let i = 0; i < n; i++) {
      const a = c[Math.max(0, i - 1)], b = c[Math.min(n - 1, i + 1)];
      let tx = b[0] - a[0], ty = b[1] - a[1];
      const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl; T.push([tx, ty]);
      const w = Math.max(0.5, c[i][2]) / 2;
      Lp.push([c[i][0] - ty * w, c[i][1] + tx * w]);
      Rp.push([c[i][0] + ty * w, c[i][1] - tx * w]);
    }
    const poly = Lp.slice();
    const cap = (p, t, w, sgn) => {
      for (let j = 1; j < 8; j++) {
        const th = (j / 8) * Math.PI, cs = Math.cos(th), sn = Math.sin(th);
        poly.push([p[0] + sgn * (-t[1] * w * cs + t[0] * w * sn), p[1] + sgn * (t[0] * w * cs + t[1] * w * sn)]);
      }
    };
    cap(c[n - 1], T[n - 1], Math.max(0.5, c[n - 1][2]) / 2, 1);
    for (let i = n - 1; i >= 0; i--) poly.push(Rp[i]);
    cap(c[0], T[0], Math.max(0.5, c[0][2]) / 2, -1);
    return poly;
  }
  function ell(cx, cy, rx, ry, rot, n) {
    rot = rot || 0; n = n || Math.max(14, Math.ceil((rx + ry) * 0.5));
    const cs = Math.cos(rot), sn = Math.sin(rot), out = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2, x = Math.cos(a) * rx, y = Math.sin(a) * ry;
      out.push([cx + x * cs - y * sn, cy + x * sn + y * cs]);
    }
    return out;
  }
  const rev = (p) => p.slice().reverse();
  function lobed(cx, cy, r, lobes, depth, rot) {
    const n = Math.max(48, Math.ceil(r * 0.9)), out = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const f = Math.pow(Math.abs(Math.cos((lobes * (a - rot)) / 2)), 0.45);
      const rr = r * (1 - depth + depth * f);
      out.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
    }
    return out;
  }
  function heart(cx, cy, size, rot) {
    const out = [], cs = Math.cos(rot), sn = Math.sin(rot);
    for (let i = 0; i < 64; i++) {
      const t = (i / 64) * Math.PI * 2;
      const x = 16 * Math.pow(Math.sin(t), 3);
      const y = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
      const X = (x / 17) * size, Y = (y / 17) * size;
      out.push([cx + X * cs - Y * sn, cy + X * sn + Y * cs]);
    }
    return out;
  }
  // place a polygon authored in local coordinates
  const place = (poly, cx, cy, sc, rot) => {
    const cs = Math.cos(rot || 0), sn = Math.sin(rot || 0);
    return poly.map((p) => [cx + (p[0] * cs - p[1] * sn) * sc, cy + (p[0] * sn + p[1] * cs) * sc]);
  };
  // sample along a polyline by arc length → {x, y, tx, ty}
  function along(pl) {
    const acc = [0];
    for (let i = 1; i < pl.length; i++) acc.push(acc[i - 1] + Math.hypot(pl[i][0] - pl[i - 1][0], pl[i][1] - pl[i - 1][1]));
    const total = acc[acc.length - 1];
    const at = (s) => {
      s = Math.max(0, Math.min(total, s));
      let i = 1; while (i < acc.length - 1 && acc[i] < s) i++;
      const a = pl[i - 1], b = pl[i], t = (s - acc[i - 1]) / ((acc[i] - acc[i - 1]) || 1);
      const tl = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      return { x: a[0] + (b[0] - a[0]) * t, y: a[1] + (b[1] - a[1]) * t, tx: (b[0] - a[0]) / tl, ty: (b[1] - a[1]) / tl, w: a[2] != null ? a[2] + (b[2] - a[2]) * t : 0 };
    };
    return { total, at };
  }

  /* ------------------------------------------------------------------ the design */
  // colour rule: outline rings `o` against foreign neighbours, `io` against zones hosted by this region,
  // then fill `f` (a key or a function of the ring index).
  const fig = (o, f, io) => (k, nb, me) => {
    const arr = nb && nb.host === me ? (io || []) : o;
    return k < arr.length ? arr[k] : (typeof f === 'function' ? f(k) : f);
  };

  function design(seed) {
    const rng = mulberry32(seed ^ 0xDEE5);
    const J = (a) => (rng() - 0.5) * 2 * a;
    const R = [], sketch = [];
    const add = (group, polys, col, o) => {
      o = o || {};
      const r = { group, polys, col, ol: o.ol == null ? 1 : o.ol, host: o.host || null, name: o.name || '' };
      R.push(r);
      if (o.sketch !== false) for (const p of polys) sketch.push(p);
      return r;
    };
    const V = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

    /* ---- the Sun Father, upper left */
    const sx = 432, sy = 432;
    const rayRot = J(0.1);
    for (let i = 0; i < 16; i++) {
      const a = rayRot + (i / 16) * Math.PI * 2, hs = Math.PI / 16;
      const tiers = [[222, 262, 0.84], [262, 300, 0.56], [300, 338, 0.27]];
      const P = [], Q = [];
      for (const [r0, r1, f] of tiers) {
        for (let j = 0; j <= 3; j++) {
          const r = r0 + (r1 - r0) * (j / 3);
          P.push([sx + Math.cos(a - hs * f) * r, sy + Math.sin(a - hs * f) * r]);
          Q.push([sx + Math.cos(a + hs * f) * r, sy + Math.sin(a + hs * f) * r]);
        }
      }
      add('sun', [P.concat(Q.reverse())], i % 2 ? fig(['Y'], 'M') : fig(['V'], 'Y'));
    }
    add('sun', [ell(sx, sy, 222, 222, 0, 160)], (k, nb, me, x, y) => {
      const r = Math.hypot(x - sx, y - sy);
      return r > 194 ? 'M' : r > 166 ? 'D' : r > 138 ? 'O' : 'Y';
    });
    const face = add('sun', [ell(sx, sy, 112, 112, 0, 100)], fig(['V'], 'Y', []));
    const eyes = [-1, 1].map((s) => add('sun', [ell(sx + s * 42, sy - 16, 24, 14, s * 0.12)], fig(['K'], 'T'), { host: face }));
    eyes.forEach((e, i) => add('sun', [ell(sx + (i ? 1 : -1) * 42, sy - 16, 8, 8)], fig([], 'K'), { host: e }));
    add('sun', [limb([[sx, sy - 6, 15], [sx + 2, sy + 22, 18]])], fig([], 'O'), { host: face });
    add('sun', [ell(sx, sy + 52, 32, 13)], fig(['K'], 'D'), { host: face });
    [-1, 1].forEach((s) => add('sun', [ell(sx + s * 66, sy + 30, 13, 13)], fig([], 'M'), { host: face }));

    /* ---- deer space → board: the deer is drawn level, then tilted into the leap */
    const DA = -0.16, DK = 1.18, DCX = 925, DCY = 1050;
    const dc = Math.cos(DA), dsn = Math.sin(DA);
    const T = (x, y) => { const u = x - 1000, v = y - 1000; return [DCX + (u * dc - v * dsn) * DK, DCY + (u * dsn + v * dc) * DK]; };
    const TP = (poly) => poly.map((p) => T(p[0], p[1]));
    const dlimb = (c) => TP(limb(c));
    const dblob = (c) => TP(blob(c));
    const dell = (x, y, rx, ry, rot) => TP(ell(x, y, rx, ry, rot));
    // the head is authored at its own scale and pinned to the neck
    const HS = 1.24;
    const Hd = (c) => c.map((p) => [1476 + (p[0] - 1400) * HS, 778 + (p[1] - 712) * HS, p[2] != null ? p[2] * HS : undefined]);
    const Hp = (x, y) => [1476 + (x - 1400) * HS, 778 + (y - 712) * HS];

    /* ---- antlers that become maize (drawn first; the head overlaps their roots) */
    const antlerCol = fig(['O'], 'Y');
    const ant = (c) => add('antler', [dlimb(Hd(c))], antlerCol);
    ant([[1466, 684, 40], [1440, 630, 35], [1404, 590, 30], [1362, 562, 25]]);
    ant([[1496, 674, 40], [1526, 622, 35], [1570, 584, 30], [1622, 556, 25]]);
    ant([[1442, 636, 26], [1446, 592, 22], [1460, 556, 17], [1480, 536, 8]]);
    ant([[1406, 596, 24], [1386, 556, 20], [1382, 522, 15], [1392, 500, 7]]);
    ant([[1524, 628, 26], [1522, 584, 22], [1510, 550, 17], [1492, 532, 8]]);
    ant([[1572, 592, 24], [1592, 552, 20], [1598, 518, 15], [1592, 496, 7]]);
    const tipA = T(...Hp(1362, 562)), tipB = T(...Hp(1622, 556));
    const maize = (base, side, H, reach) => {
      // a stalk rising from the antler tip, leaning outward
      const P = (dx, dy, w) => [base[0] + side * dx, base[1] + dy, w];
      const st = [P(0, 0, 30), P(30, -0.3 * H, 27), P(48, -0.62 * H, 22), P(54, -0.9 * H, 17), P(52, -H, 11)];
      const top = st[st.length - 1];
      const leafCol = fig(['L'], (k) => (k >= 3 ? 'L' : 'G'));
      const n1 = V(st[1], st[2], 0.2), n2 = V(st[2], st[3], 0.6);
      const r = reach;
      add('maize', [limb([[n1[0], n1[1], 10], [n1[0] + side * 84 * r, n1[1] - 36, 60], [n1[0] + side * 168 * r, n1[1] - 14, 52], [n1[0] + side * 226 * r, n1[1] + 44, 26], [n1[0] + side * 250 * r, n1[1] + 92, 3]])], leafCol);
      add('maize', [limb([[n2[0], n2[1], 10], [n2[0] - side * 60, n2[1] - 50, 48], [n2[0] - side * 128, n2[1] - 74, 38], [n2[0] - side * 186, n2[1] - 70, 3]])], leafCol);
      add('maize', [limb(st)], fig(['L'], 'G'));
      for (let j = -3; j <= 3; j++) {
        const a = -Math.PI / 2 + j * 0.3 + side * 0.12 + J(0.05), l = 50 + (3 - Math.abs(j)) * 8;
        add('maize', [limb([[top[0], top[1] + 8, 12], [top[0] + Math.cos(a) * l * 0.6, top[1] + Math.sin(a) * l * 0.6, 12], [top[0] + Math.cos(a) * l, top[1] + Math.sin(a) * l + 10, 5]])],
          fig([], j & 1 ? 'O' : 'Y'), { sketch: false });
      }
      const at = V(st[1], st[2], 0.55);
      return { bx: at[0] + side * 10, by: at[1], a: -Math.PI / 2 + side * 0.62 };
    };
    const cobs = [maize(tipA, -1, 290, 1.2), maize(tipB, 1, 240, 0.74)];
    cobs[0].ker = ['Y', 'Y', 'O', 'Y', 'Y', 'C']; cobs[1].ker = ['M', 'D', 'M', 'U', 'M', 'H'];
    for (const c of cobs) {
      c.len = 236; c.w = 94;
      const ux = Math.cos(c.a), uy = Math.sin(c.a), vx = -uy, vy = ux;
      const cx = c.bx + ux * c.len * 0.5, cy = c.by + uy * c.len * 0.5;
      const cob = add('maize', [ell(cx, cy, c.len / 2, c.w / 2, c.a, 90)], fig(['C'], 'C'));
      const krng = mulberry32(hash2(seed, (c.bx * 7) | 0));
      for (let u = -c.len / 2 + 17; u <= c.len / 2 - 15; u += 15.4) {
        const half = (c.w / 2) * Math.sqrt(Math.max(0, 1 - (u / (c.len / 2)) ** 2)) - 8;
        for (let v = -3; v <= 3; v++) {
          const vv = v * 14.2 + ((Math.round(u / 15.4) & 1) ? 3.5 : -3.5);
          if (Math.abs(vv) > half) continue;
          const key = c.ker[(krng() * c.ker.length) | 0];
          add('maize', [ell(cx + ux * u + vx * vv, cy + uy * u + vy * vv, 7.9, 7.0, c.a, 14)], fig([], key), { host: cob, sketch: false });
        }
      }
      for (const s of [-1, 1]) {
        const p0 = [c.bx - ux * 6, c.by - uy * 6, 12];
        const p1 = [c.bx + ux * c.len * 0.22 + vx * s * c.w * 0.56, c.by + uy * c.len * 0.22 + vy * s * c.w * 0.56, 30];
        const p2 = [c.bx + ux * c.len * 0.5 + vx * s * c.w * 0.52, c.by + uy * c.len * 0.5 + vy * s * c.w * 0.52, 3];
        add('maize', [limb([p0, p1, p2])], fig(['L'], 'G'));
      }
    }

    /* ---- the deer, Kauyumari, leaping */
    const deerCol = fig(['Y', 'B', 'T'], 'B', []);
    const farCol = fig(['Y'], 'N');
    const hoofCol = fig(['Y'], 'K');
    const hoof = (c) => {
      const a = c[c.length - 2], b = c[c.length - 1];
      const l = Math.hypot(b[0] - a[0], b[1] - a[1]), ux = (b[0] - a[0]) / l, uy = (b[1] - a[1]) / l;
      const x = b[0], y = b[1];
      return dlimb([[x - ux * 12, y - uy * 12, 36], [x + ux * 10, y + uy * 10, 33], [x + ux * 30, y + uy * 30, 9]]);
    };
    const thick = (c, f) => c.map(([x, y, w]) => [x, y, w * f]);
    const farFore = thick([[1288, 1100, 96], [1318, 1196, 62], [1392, 1260, 44], [1378, 1330, 36], [1338, 1384, 31], [1318, 1400, 28]], 1.16);
    const farHind = thick([[800, 1080, 150], [780, 1190, 86], [712, 1272, 54], [650, 1334, 40], [604, 1378, 32], [584, 1396, 29]], 1.14);
    const nearFore = thick([[1348, 1080, 116], [1394, 1180, 72], [1480, 1240, 48], [1488, 1318, 37], [1460, 1384, 31], [1446, 1404, 28]], 1.16);
    const nearHind = thick([[724, 1046, 210], [690, 1172, 106], [604, 1238, 60], [520, 1282, 42], [452, 1318, 34], [424, 1334, 30]], 1.14);
    add('deer', [dlimb(farFore)], farCol);
    add('deer', [dlimb(farHind)], farCol);
    add('deer', [hoof(farFore)], hoofCol);
    add('deer', [hoof(farHind)], hoofCol);
    const body = dblob([
      [640, 890], [730, 862], [840, 864], [960, 880], [1070, 872], [1170, 850], [1260, 826], [1340, 796], [1410, 772],
      [1470, 756], [1530, 770], [1560, 850], [1530, 912], [1484, 974], [1466, 1042], [1446, 1116], [1398, 1184],
      [1310, 1226], [1200, 1224], [1090, 1192], [990, 1158], [900, 1146], [820, 1160], [744, 1190], [670, 1186],
      [612, 1134], [590, 1036], [600, 944],
    ]);
    const head = dblob(Hd([
      [1400, 714], [1436, 670], [1496, 650], [1560, 664], [1618, 696], [1672, 734], [1712, 768], [1728, 792],
      [1716, 814], [1684, 824], [1650, 836], [1608, 846], [1560, 846], [1506, 838], [1456, 824], [1420, 786],
    ]));
    const ear = dlimb(Hd([[1452, 702, 56], [1416, 668, 72], [1368, 636, 54], [1328, 612, 22], [1308, 602, 4]]));
    const deer = add('deer', [body, head, ear, dlimb(nearFore), dlimb(nearHind)], deerCol, { name: 'deer' });
    add('deer', [hoof(nearFore)], hoofCol);
    add('deer', [hoof(nearHind)], hoofCol);
    add('deer', [dlimb([[646, 918, 50], [618, 872, 52], [598, 840, 36], [590, 820, 8]])], fig(['Y'], 'W'));
    add('deer', [dlimb(Hd([[1440, 694, 22], [1412, 666, 34], [1372, 640, 20], [1350, 628, 4]]))], fig(['M'], 'H'), { host: deer });
    const eye = add('deer', [TP(ell(...Hp(1538, 742), 34, 23, -0.15))], fig(['K'], 'W'), { host: deer });
    add('deer', [TP(ell(...Hp(1546, 742), 14, 14))], fig([], 'K'), { host: eye });
    add('deer', [TP(ell(...Hp(1712, 791), 14, 11, 0.5))], fig([], 'K'), { host: deer });
    add('deer', [dlimb(Hd([[1578, 752, 10], [1600, 772, 10], [1612, 792, 8]]))], fig([], 'H'), { host: deer, sketch: false });
    add('deer', [TP(heart(1366, 1014, 68, -0.15))], fig(['Y'], (k) => (k >= 3 ? 'V' : 'D')), { host: deer });
    {
      const m1 = Hp(1470, 812), m2 = Hp(1560, 806), m3 = Hp(1640, 826);
      add('deer', [dlimb([[1386, 972, 14], [1426, 920, 14], [m1[0] - 10, m1[1] + 30, 14], [m1[0] + 40, m1[1] + 8, 14], [m2[0], m2[1] + 14, 13], [m3[0], m3[1] + 10, 11]])], fig([], 'Y'), { host: deer, sketch: false });
    }
    {
      const hc = T(720, 1000), hr = 74;
      const ro = add('deer', [lobed(hc[0], hc[1], hr, 8, 0.2, 0.3)], fig(['W'], (k) => (k === 2 ? 'H' : k >= 3 ? 'M' : 'T')), { host: deer });
      add('deer', [ell(hc[0], hc[1], 20, 20)], fig(['Y'], 'V'), { host: ro, sketch: false });
    }
    const bandPts = [[830, 1104, 40], [920, 1094, 52], [1010, 1106, 56], [1110, 1130, 56], [1210, 1150, 52], [1302, 1146, 38]];
    const band = add('deer', [dlimb(bandPts)], fig(['W'], 'T'), { host: deer });
    {
      const pl = along(spline(bandPts, false, 3));
      let flip = 0;
      for (let s = 40; s < pl.total - 30; s += 46) {
        const p = pl.at(s), w = p.w * 0.5 - 9;
        if (w < 10) continue;
        const nx = -p.ty, ny = p.tx, sg = flip++ % 2 ? 1 : -1;
        const tri = [
          [p.x - p.tx * 20 + nx * w * sg, p.y - p.ty * 20 + ny * w * sg],
          [p.x + p.tx * 20 + nx * w * sg, p.y + p.ty * 20 + ny * w * sg],
          [p.x - nx * w * sg, p.y - ny * w * sg],
        ];
        add('deer', [TP(tri)], fig([], sg > 0 ? 'M' : 'Y'), { host: band, sketch: false });
      }
    }
    {
      const back = [[730, 862], [840, 864], [960, 880], [1070, 872], [1170, 850]];
      for (let x = 760; x <= 1160; x += 64) {
        let i = 0; while (i < back.length - 2 && back[i + 1][0] < x) i++;
        const t = (x - back[i][0]) / (back[i + 1][0] - back[i][0]);
        const y = back[i][1] + (back[i + 1][1] - back[i][1]) * t + 52;
        add('deer', [dell(x + J(3), y + J(3), 13, 13)], fig(['W'], 'H'), { host: deer, sketch: false });
      }
    }

    /* ---- the singer, mara'akame, who sings the deer and the maize into being */
    {
      const gx = 194, gy = 1176, sc = 1.0;
      const P = (pl) => place(pl, gx, gy, sc, 0);
      const skin = fig(['E'], 'A');
      add('singer', [P(limb([[-34, 146, 36], [-38, 226, 32]])), P(limb([[34, 146, 36], [38, 226, 32]]))], fig(['K'], 'W'));
      add('singer', [P(limb([[-36, 214, 40], [-38, 222, 40]])), P(limb([[36, 214, 40], [38, 222, 40]]))], fig([], 'M'), { sketch: false });
      add('singer', [P(ell(-44, 240, 28, 12)), P(ell(44, 240, 28, 12))], fig([], 'E'));
      const tunic = add('singer', [P(blob([[-54, -22], [0, -30], [54, -22], [82, 100], [90, 160], [0, 170], [-90, 160], [-82, 100]]))], fig(['K'], 'W'));
      for (let i = -3; i <= 3; i++) {
        const x = i * 23;
        add('singer', [P([[x - 11, 152], [x + 11, 152], [x, 128]])], fig([], i & 1 ? 'T' : 'D'), { host: tunic, sketch: false });
      }
      for (let i = -2; i <= 2; i++) add('singer', [P(ell(i * 26, 88, 8, 8))], fig([], i & 1 ? 'T' : 'M'), { host: tunic, sketch: false });
      add('singer', [P(blob([[-62, -26], [0, -36], [62, -26], [74, 22], [0, 52], [-74, 22]]))], fig(['Y'], 'D'));
      // one arm lifts a prayer arrow; the other rests
      add('singer', [P(limb([[-50, -6, 30], [-72, 50, 26], [-78, 100, 22]])), P(limb([[48, -6, 30], [86, 30, 26], [98, -24, 22]]))], fig(['K'], 'W'));
      add('singer', [P(ell(-78, 112, 14, 14)), P(ell(100, -36, 15, 15))], skin);
      add('singer', [P(ell(0, -74, 44, 52))], skin);
      add('singer', [P(ell(-17, -80, 8, 5.5)), P(ell(17, -80, 8, 5.5))], fig([], 'K'));
      add('singer', [P(limb([[-30, -60, 9], [-20, -50, 9], [-10, -56, 8]])), P(limb([[30, -60, 9], [20, -50, 9], [10, -56, 8]]))], fig([], 'Y'), { sketch: false });
      add('singer', [P(ell(0, -44, 11, 6))], fig([], 'D'), { sketch: false });
      // the hat with its feathers and hanging pendants
      for (let j = -2; j <= 2; j++) {
        const x0 = j * 14, dx = j * 30;
        add('singer', [P(limb([[x0, -190, 10], [x0 + dx * 0.4, -232, 28], [x0 + dx * 0.8, -276, 22], [x0 + dx, -304, 3]]))], fig(['K'], j & 1 ? 'O' : 'W'));
      }
      add('singer', [P(blob([[-50, -124], [-46, -170], [-26, -194], [0, -200], [26, -194], [46, -170], [50, -124]]))], fig(['O'], 'C'));
      add('singer', [P(limb([[-48, -138, 18], [48, -138, 18]]))], fig([], 'M'), { sketch: false });
      add('singer', [P(ell(0, -122, 104, 20))], fig(['O'], 'C'));
      for (const x of [-86, -50, 50, 86]) {
        add('singer', [P(limb([[x, -108, 8], [x, -84, 8]]))], fig([], 'C'), { sketch: false });
        add('singer', [P(ell(x, -74, 11, 11))], fig([], Math.abs(x) > 60 ? 'D' : 'T'), { sketch: false });
      }
      // the arrow he lifts
      const h = P([[100, -36]])[0];
      arrowAt(h[0] - 2, h[1] + 84, h[0] + 3, h[1] - 168, 1);
    }
    function arrowAt(x0, y0, x1, y1, ph) {
      const len = Math.hypot(x1 - x0, y1 - y0), ux = (x1 - x0) / len, uy = (y1 - y0) / len;
      add('arrow', [limb([[x0, y0, 18], [x1, y1, 18]])], (k, nb, me, x, y) => {
        const s = ((x - x0) * ux + (y - y0) * uy) / len;
        return ['D', 'Y', 'T', 'Y'][((s * 9 + ph) | 0) & 3];
      });
      const nx = -uy, ny = ux;
      for (let j = -1; j <= 1; j++) {
        const bx = x1 - ux * 6 + nx * j * 10, by = y1 - uy * 6 + ny * j * 10;
        const dx = -ux * 0.4 + nx * j * 0.55, dy = 0.9;
        add('arrow', [limb([[bx, by, 6], [bx + dx * 46, by + dy * 46, 28], [bx + dx * 88, by + dy * 88, 20], [bx + dx * 110, by + dy * 110, 3]])], fig(['O'], 'W'));
      }
    }

    /* ---- hummingbird, between the sun and the maize */
    {
      const bx = 1474, by = 290, sc = 1.12, rot = -0.06;
      const P = (pl) => place(pl, bx, by, sc, rot);
      add('bird', [P(limb([[-10, -8, 42], [-40, -76, 52], [-62, -130, 32], [-70, -158, 6]]))], fig(['Y'], 'O'));
      add('bird', [P(limb([[-58, 18, 26], [-100, 34, 34], [-130, 52, 24], [-142, 60, 6]])), P(limb([[-58, 20, 22], [-96, 52, 26], [-112, 76, 6]]))], fig(['Y'], 'M'));
      const bd = add('bird', [P(ell(0, 0, 66, 30, -0.2)), P(ell(64, -26, 30, 28))], fig(['Y'], 'T'));
      add('bird', [P(ell(52, -4, 20, 13, -0.4))], fig([], 'M'), { host: bd });
      add('bird', [P(ell(74, -32, 9, 9))], fig(['W'], 'K'), { host: bd });
      add('bird', [P(limb([[90, -36, 13], [140, -46, 12], [176, -52, 9]]))], fig([], 'K'));
    }

    /* ---- the rain serpent: along the bottom, rearing up the right edge, its breath becoming cloud and rain */
    const spine = [[120, 1822, 8], [230, 1760, 50], [370, 1718, 88], [540, 1730, 116], [700, 1800, 132], [860, 1838, 140],
      [1030, 1808, 144], [1190, 1738, 146], [1350, 1704, 146], [1500, 1730, 144], [1640, 1780, 140], [1772, 1750, 132],
      [1846, 1660, 124], [1860, 1560, 116]];
    const SH = (pl) => place(pl.map(([x, y, w]) => [-x, y, w]), 1822, 1470, 1.28, 0.42);
    const serp = add('serpent', [limb(spine), SH(blob([[-82, 0], [-70, -40], [-30, -56], [20, -54], [64, -40], [100, -20], [118, 0], [106, 18], [70, 30], [20, 46], [-30, 52], [-68, 36]]))],
      fig(['L'], 'G', []), { name: 'serpent' });
    {
      const pl = along(spline(spine, false, 3));
      let i = 0;
      for (let s = 170; s < pl.total - 120; s += 98) {
        const p = pl.at(s), hw = Math.min(42, p.w * 0.5 - 20), hl = 42;
        if (hw < 14) continue;
        const nx = -p.ty, ny = p.tx;
        const dia = [[p.x - p.tx * hl, p.y - p.ty * hl], [p.x + nx * hw, p.y + ny * hw], [p.x + p.tx * hl, p.y + p.ty * hl], [p.x - nx * hw, p.y - ny * hw]];
        const d = add('serpent', [dia], fig(['Y'], i++ % 2 ? 'M' : 'V'), { host: serp });
        add('serpent', [ell(p.x, p.y, 8, 8)], fig([], 'Y'), { host: d, sketch: false });
      }
    }
    const seye = add('serpent', [SH(ell(22, -20, 19, 15))], fig(['K'], 'Y'), { host: serp });
    add('serpent', [SH(ell(25, -20, 9, 8))], fig([], 'K'), { host: seye });
    add('serpent', [SH(ell(96, -10, 7, 6))], fig([], 'K'), { host: serp, sketch: false });
    add('serpent', [SH(limb([[104, 14, 11], [134, 22, 10], [152, 12, 8]])), SH(limb([[134, 22, 9], [154, 34, 7]]))], fig([], 'D'));
    // breath rising in scrolls into the cloud
    add('cloud', [limb([[1700, 1364, 13], [1682, 1326, 16], [1694, 1288, 17], [1732, 1278, 16], [1748, 1304, 13], [1730, 1322, 8]])], fig(['S'], 'W'));
    add('cloud', [limb([[1712, 1262, 12], [1700, 1236, 14], [1708, 1208, 12]])], fig(['S'], 'W'));
    const cloud = add('cloud', [blob([[1690, 1170], [1680, 1118], [1712, 1072], [1764, 1066], [1792, 1014], [1852, 998], [1902, 1028], [1944, 1050], [1958, 1108], [1936, 1158], [1880, 1180], [1780, 1186]])],
      (k, nb, me) => (k === 0 ? 'S' : k % 5 === 3 ? 'T' : 'W'));
    for (let i = 0; i < 4; i++) {
      const x = 1810 + i * 40 + J(5);
      add('cloud', [limb([[x, 1206, 13], [x - 8, 1256, 13], [x - 14, 1296 - (i % 2) * 22, 11]])], fig([], i % 2 ? 'T' : 'S'));
    }

    /* ---- hikuri, the peyote that springs where the deer has stepped */
    const hikuri = (cx, cy, r, rot) => {
      const lobes = 6 + ((rng() * 3) | 0);
      const outer = add('hikuri', [lobed(cx, cy, r, lobes, 0.24, rot)], fig(['L'], 'G'));
      const inner = add('hikuri', [lobed(cx, cy, r * 0.56, lobes, 0.2, rot)], fig(['Y'], 'L'), { host: outer });
      add('hikuri', [ell(cx, cy, r * 0.22, r * 0.22)], fig(['W'], 'H'), { host: inner });
      for (let i = 0; i < lobes; i++) {
        const a = rot + (i / lobes) * Math.PI * 2;
        add('hikuri', [ell(cx + Math.cos(a) * r * 0.79, cy + Math.sin(a) * r * 0.79, 8, 8)], fig([], 'W'), { host: outer, sketch: false });
      }
    };
    hikuri(900 + J(10), 1478 + J(10), 100, rng() * 6);
    hikuri(1160 + J(10), 1530 + J(10), 78, rng() * 6);
    hikuri(806 + J(10), 712 + J(10), 76, rng() * 6);

    /* ---- a flower, tutu, above the deer's back */
    {
      const fx = 958 + J(8), fy = 296 + J(8), fr = 96, np = 8, rot = rng() * 2;
      const petals = [];
      for (let i = 0; i < np; i++) {
        const a = rot + (i / np) * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
        petals.push(limb([[fx + ca * fr * 0.25, fy + sa * fr * 0.25, 30], [fx + ca * fr * 0.62, fy + sa * fr * 0.62, 50], [fx + ca * fr * 0.92, fy + sa * fr * 0.92, 30]]));
      }
      add('flower', petals, fig(['H'], 'M'));
      const fc = add('flower', [ell(fx, fy, fr * 0.34, fr * 0.34)], fig(['O'], 'Y'));
      add('flower', [ell(fx, fy, 9, 9)], fig([], 'V'), { host: fc, sketch: false });
    }

    return { R, sketch };
  }

  /* ------------------------------------------------------------------ rasterising the regions */
  function fillPolys(lab, N, s, polys, id) {
    const ex0 = [], ey0 = [], ex1 = [], ey1 = [];
    let ymin = Infinity, ymax = -Infinity;
    for (const poly of polys) {
      for (let i = 0; i < poly.length; i++) {
        const a = poly[i], b = poly[(i + 1) % poly.length];
        const y0 = a[1] * s, y1 = b[1] * s;
        if (y0 === y1) continue;
        ex0.push(a[0] * s); ey0.push(y0); ex1.push(b[0] * s); ey1.push(y1);
        if (y0 < ymin) ymin = y0; if (y0 > ymax) ymax = y0;
        if (y1 < ymin) ymin = y1; if (y1 > ymax) ymax = y1;
      }
    }
    const ne = ex0.length, xs = [], ws = [], ord = [];
    const yA = Math.max(0, Math.ceil(ymin - 0.5)), yB = Math.min(N - 1, Math.floor(ymax - 0.5));
    for (let y = yA; y <= yB; y++) {
      const yc = y + 0.5;
      xs.length = 0; ws.length = 0;
      for (let e = 0; e < ne; e++) {
        const y0 = ey0[e], y1 = ey1[e];
        if ((y0 <= yc && y1 > yc) || (y1 <= yc && y0 > yc)) {
          xs.push(ex0[e] + ((yc - y0) * (ex1[e] - ex0[e])) / (y1 - y0));
          ws.push(y1 > y0 ? 1 : -1);
        }
      }
      ord.length = xs.length; for (let i = 0; i < xs.length; i++) ord[i] = i;
      ord.sort((a, b) => xs[a] - xs[b]);
      let w = 0;
      for (let q = 0; q < ord.length; q++) {
        const i = ord[q], wasIn = w !== 0;
        w += ws[i];
        if (!wasIn && w !== 0) {
          // span start; find its end
          const xa = xs[i];
          let r = q + 1;
          while (r < ord.length) { w += ws[ord[r]]; if (w === 0) break; r++; }
          const xb = r < ord.length ? xs[ord[r]] : xa;
          const i0 = Math.max(0, Math.ceil(xa - 0.5)), i1 = Math.min(N, Math.ceil(xb - 0.5));
          const row = y * N;
          for (let x = i0; x < i1; x++) lab[row + x] = id;
          q = r;
        }
      }
    }
  }

  /* ------------------------------------------------------------------ the heavy part: shapes → strands */
  async function buildStrands(seed, N, pause) {
    const s = N / B;
    const { R, sketch } = design(seed);
    const regs = [null,
      { group: 'border', col: null, ol: 0, host: null, id: 1 },
      { group: 'bg', col: null, ol: 0, host: null, id: 2 }];
    R.forEach((r, i) => { r.id = i + 3; regs.push(r); });
    const brng = mulberry32(seed ^ 0xB0BD);
    // the border stripes, outside → in
    const BORDERS = [
      ['K', 'M', 'M', 'M', 'Y', 'Y', 'K', 'T', 'T', 'T', 'Y', 'K'],
      ['K', 'D', 'D', 'D', 'Y', 'Y', 'K', 'T', 'T', 'T', 'M', 'K'],
      ['K', 'M', 'M', 'O', 'O', 'Y', 'K', 'L', 'L', 'T', 'T', 'K'],
    ];
    const stripes = BORDERS[(brng() * BORDERS.length) | 0];
    regs[1].col = (k, nb) => stripes[Math.max(0, Math.min(NBR - 1, nb ? NBR - 1 - k : k))];
    // the dark ground: black with echoes of deep purple and indigo
    // every figure carries a dark aura of its own colour out into the ground, in bands that thin as they
    // spread; where two figures' ripples meet, their colours meet in a seam
    const AURA = { deer: 'n', antler: 'g', maize: 'g', sun: 'q', serpent: 'z', cloud: 'n', singer: 'q', arrow: 'q',
      hikuri: 'g', flower: 'q', bird: 'z', border: 'p' };
    const bandOf = [];
    for (let k = 0; k < 200; k++) {
      const on = k === 1 || k === 2 || k === 7 || k === 15 || k === 16 || k === 27;
      bandOf.push(on);
    }
    regs[2].col = (k, nb) => (bandOf[k] ? (nb && AURA[nb.group]) || 'p' : 'K');

    const T0 = performance.now(); const tlog = (m) => { if (DBG.log) console.warn('[nierika] ' + m + ' ' + Math.round(performance.now() - T0) + 'ms'); };
    /* 1. region labels */
    const NN = N * N, lab = new Uint16Array(NN);
    const bw = NBR * SP * s;
    for (let y = 0; y < N; y++) {
      const ey = Math.min(y + 0.5, N - y - 0.5), row = y * N;
      for (let x = 0; x < N; x++) {
        const e = Math.min(ey, x + 0.5, N - x - 0.5);
        lab[row + x] = e < bw ? 1 : 2;
      }
    }
    await pause();
    for (const r of R) { for (const poly of r.polys) fillPolys(lab, N, s, [poly], r.id); await pause(); }

    tlog('labels');
    /* 2. edges and the distance transform (Felzenszwalb–Huttenlocher), keeping who is across each edge */
    const other = new Uint16Array(NN);
    for (let y = 0; y < N; y++) {
      const row = y * N;
      for (let x = 0; x < N; x++) {
        const i = row + x, L = lab[i];
        let o = 65535;
        if (x === 0 || y === 0 || x === N - 1 || y === N - 1) o = 0;
        else if (lab[i - 1] !== L) o = lab[i - 1];
        else if (lab[i + 1] !== L) o = lab[i + 1];
        else if (lab[i - N] !== L) o = lab[i - N];
        else if (lab[i + N] !== L) o = lab[i + N];
        other[i] = o;
      }
      if ((y & 255) === 255) await pause();
    }
    const g = new Float32Array(NN), fx = new Int16Array(NN);
    for (let y = 0; y < N; y++) {
      const row = y * N;
      let last = -1e6;
      for (let x = 0; x < N; x++) { if (other[row + x] !== 65535) last = x; g[row + x] = x - last; fx[row + x] = last < 0 ? 0 : last; }
      let next = 1e6;
      for (let x = N - 1; x >= 0; x--) {
        if (other[row + x] !== 65535) next = x;
        if (next - x < g[row + x]) { g[row + x] = next - x; fx[row + x] = next; }
      }
      if ((y & 255) === 255) await pause();
    }
    const D = new Float32Array(NN), nbl = new Uint16Array(NN);
    {
      const v = new Int32Array(N), z = new Float64Array(N + 1), f = new Float64Array(N);
      for (let x = 0; x < N; x++) {
        for (let q = 0; q < N; q++) { const gv = g[q * N + x]; f[q] = gv * gv; }
        let k = 0; v[0] = 0; z[0] = -Infinity; z[1] = Infinity;
        for (let q = 1; q < N; q++) {
          let sx = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
          while (sx <= z[k]) { k--; sx = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]); }
          k++; v[k] = q; z[k] = sx; z[k + 1] = Infinity;
        }
        k = 0;
        for (let q = 0; q < N; q++) {
          while (z[k + 1] < q) k++;
          const p = v[k], i = q * N + x;
          D[i] = Math.sqrt((q - p) * (q - p) + f[p]) + 0.5;
          const F = p * N + fx[p * N + x];
          nbl[i] = lab[F] !== lab[i] ? lab[F] : other[F];
        }
        if ((x & 63) === 63) await pause();
      }
    }

    tlog('edt');
    /* 3. the hand: low-frequency wander in the spacing, so no two rounds are exactly parallel */
    {
      const nz = makeNoise(seed ^ 0x5EED), step = 8, G = Math.ceil(N / step) + 2;
      const cg = new Float32Array(G * G);
      for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) {
        const bx = (i * step) / s, by = (j * step) / s;
        cg[j * G + i] = nz(bx / 74, by / 74) * 0.8 + nz(bx / 23 + 40, by / 23) * 0.35;
      }
      const amp = 1.0 * s, ramp = 1 / (SP * 1.3 * s);
      for (let y = 0; y < N; y++) {
        const gy = y / step, j = gy | 0, fy = gy - j, row = y * N;
        for (let x = 0; x < N; x++) {
          const gx = x / step, i = gx | 0, fxx = gx - i;
          const a = cg[j * G + i], b = cg[j * G + i + 1], c = cg[(j + 1) * G + i], d = cg[(j + 1) * G + i + 1];
          const n = a + (b - a) * fxx + (c - a) * fy + (a - b - c + d) * fxx * fy;
          const dv = D[row + x];
          D[row + x] = dv + amp * n * Math.min(1, Math.max(0, (dv - 0.5 * s) * ramp));
        }
        if ((y & 255) === 255) await pause();
      }
    }

    tlog('noise');
    /* 4. marching squares: every level at once (the field is 1-Lipschitz, so an edge is crossed at most once) */
    const d0 = D0 * s, sp = SP * s;
    let cap = 1 << 20, np = 0;
    let PX = new Float32Array(cap), PY = new Float32Array(cap), LV = new Uint8Array(cap), N0 = new Int32Array(cap), N1 = new Int32Array(cap);
    const grow = () => {
      const c2 = cap * 2;
      const nx = new Float32Array(c2); nx.set(PX); PX = nx;
      const ny = new Float32Array(c2); ny.set(PY); PY = ny;
      const nl = new Uint8Array(c2); nl.set(LV); LV = nl;
      const a = new Int32Array(c2); a.set(N0); N0 = a;
      const b = new Int32Array(c2); b.set(N1); N1 = b;
      cap = c2;
    };
    const kOf = (v) => Math.floor((v - d0) / sp);
    const newPt = (x, y, k) => {
      if (np >= cap) grow();
      PX[np] = x; PY[np] = y; LV[np] = Math.min(255, k); N0[np] = -1; N1[np] = -1;
      return np++;
    };
    const link = (p, q) => {
      if (N0[p] < 0) N0[p] = q; else N1[p] = q;
      if (N0[q] < 0) N0[q] = p; else N1[q] = p;
    };
    const hrow = (y, H) => {
      const row = y * N;
      for (let x = 0; x < N - 1; x++) {
        const a = D[row + x], b = D[row + x + 1], ka = kOf(a), kb = kOf(b);
        if (ka !== kb) { const k = Math.max(ka, kb), L = d0 + k * sp; H[x] = newPt(x + (L - a) / (b - a), y, k); } else H[x] = -1;
      }
    };
    {
      let Hc = new Int32Array(N), Hn = new Int32Array(N);
      const V = new Int32Array(N);
      hrow(0, Hc);
      const e = [0, 0, 0, 0];
      for (let y = 0; y < N - 1; y++) {
        hrow(y + 1, Hn);
        const row = y * N;
        for (let x = 0; x < N; x++) {
          const a = D[row + x], d = D[row + N + x], ka = kOf(a), kd = kOf(d);
          if (ka !== kd) { const k = Math.max(ka, kd), L = d0 + k * sp; V[x] = newPt(x, y + (L - a) / (d - a), k); } else V[x] = -1;
        }
        for (let x = 0; x < N - 1; x++) {
          const t = Hc[x], b = Hn[x], l = V[x], r = V[x + 1];
          let c = 0;
          if (t >= 0) e[c++] = t;
          if (r >= 0) e[c++] = r;
          if (b >= 0) e[c++] = b;
          if (l >= 0) e[c++] = l;
          if (c === 2) { if (LV[e[0]] === LV[e[1]]) link(e[0], e[1]); }
          else if (c === 4) {
            const k = LV[t], L = d0 + k * sp;
            if (LV[r] !== k || LV[b] !== k || LV[l] !== k) continue;
            const A = D[row + x], Bv = D[row + x + 1], C = D[row + N + x + 1], Dd = D[row + N + x];
            const aIn = A >= L, cIn = (A + Bv + C + Dd) * 0.25 >= L;
            if (aIn === cIn) { link(t, r); link(l, b); } else { link(t, l); link(r, b); }
          }
        }
        const tmp = Hc; Hc = Hn; Hn = tmp;
        if ((y & 127) === 127) await pause();
      }
    }

    tlog('march ' + np);
    /* 5. contours → strands of yarn */
    const pieces = [];
    const visited = new Uint8Array(np);
    const order = ['deer', 'antler', 'maize', 'sun', 'serpent', 'cloud', 'singer', 'arrow', 'hikuri', 'flower', 'bird'];
    const gOrder = (g) => { const i = order.indexOf(g); return i < 0 ? order.length : i; };
    let loopId = 0;
    const lx = [], ly = [];
    for (let i0 = 0; i0 < np; i0++) {
      if (visited[i0] || N0[i0] < 0) continue;
      lx.length = 0; ly.length = 0;
      let prev = -1, cur = i0, closed = false;
      while (cur >= 0 && !visited[cur]) {
        visited[cur] = 1; lx.push(PX[cur]); ly.push(PY[cur]);
        const nx = N0[cur] !== prev ? N0[cur] : N1[cur];
        prev = cur; cur = nx;
        if (cur === i0) { closed = true; break; }
      }
      if (lx.length < 4) continue;
      const k = LV[i0];
      const pix = Math.round(ly[0]) * N + Math.round(lx[0]);
      const reg = regs[lab[pix]];
      if (!reg || !reg.col) continue;
      // to board coordinates, resample, smooth
      const n0 = lx.length;
      let len = 0;
      for (let i = 0; i < n0; i++) {
        const j = (i + 1) % n0; if (!closed && j === 0) break;
        len += Math.hypot(lx[j] - lx[i], ly[j] - ly[i]);
      }
      len /= s;
      if (len < 3) continue;
      const m = Math.max(4, Math.round(len / 2.3));
      const X = new Float32Array(m), Y = new Float32Array(m);
      {
        // walk the loop at equal steps
        const stp = (len * s) / m;
        let ii = 0, acc = 0, segL = Math.hypot(lx[1 % n0] - lx[0], ly[1 % n0] - ly[0]);
        for (let q = 0; q < m; q++) {
          const target = q * stp;
          while (acc + segL < target && ii < n0 * 2) { acc += segL; ii++; const a = ii % n0, b = (ii + 1) % n0; segL = Math.hypot(lx[b] - lx[a], ly[b] - ly[a]); }
          const a = ii % n0, b = (ii + 1) % n0, t = segL > 0 ? (target - acc) / segL : 0;
          X[q] = (lx[a] + (lx[b] - lx[a]) * t + 0.5) / s;
          Y[q] = (ly[a] + (ly[b] - ly[a]) * t + 0.5) / s;
        }
      }
      for (let pass = 0; pass < 2; pass++) {
        let px0 = X[m - 1], py0 = Y[m - 1];
        const fx0 = X[0], fy0 = Y[0];
        for (let q = 0; q < m; q++) {
          const nxq = q + 1 < m ? X[q + 1] : fx0, nyq = q + 1 < m ? Y[q + 1] : fy0;
          const cx = X[q], cy = Y[q];
          X[q] = 0.25 * px0 + 0.5 * cx + 0.25 * nxq; Y[q] = 0.25 * py0 + 0.5 * cy + 0.25 * nyq;
          px0 = cx; py0 = cy;
        }
      }
      // the hand wavers a little
      const lr = mulberry32(hash2(seed, loopId * 31 + 7));
      if (len > 30) {
        const f1 = (Math.PI * 2) / (70 + lr() * 60), f2 = (Math.PI * 2) / (24 + lr() * 18), p1 = lr() * 7, p2 = lr() * 7;
        const amp = 0.32 + lr() * 0.25;
        const ox = new Float32Array(m), oy = new Float32Array(m);
        for (let q = 0; q < m; q++) {
          const a = X[(q - 1 + m) % m], b = Y[(q - 1 + m) % m], c = X[(q + 1) % m], d = Y[(q + 1) % m];
          let tx = c - a, ty = d - b; const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
          const sArc = q * 2.3, w = amp * (Math.sin(sArc * f1 + p1) * 0.65 + Math.sin(sArc * f2 + p2) * 0.35);
          ox[q] = X[q] - ty * w; oy[q] = Y[q] + tx * w;
        }
        X.set(ox); Y.set(oy);
      }
      // colour of every vertex
      const keys = new Int16Array(m);
      for (let q = 0; q < m; q++) {
        const gx = Math.min(N - 1, Math.max(0, Math.round(X[q] * s - 0.5))), gy = Math.min(N - 1, Math.max(0, Math.round(Y[q] * s - 0.5)));
        const nb = regs[nbl[gy * N + gx]] || null;
        keys[q] = KI[reg.col(k, nb, reg, X[q], Y[q])];
      }
      // suppress tiny colour flickers
      {
        let run = 0;
        for (let q = 1; q < m; q++) {
          if (keys[q] !== keys[q - 1]) {
            let r = q; while (r < m && keys[r] === keys[q] && r - q < 4) r++;
            if (r - q < 4 && r < m) { for (let t = q; t < r; t++) keys[t] = keys[q - 1]; }
          }
          run++;
        }
      }
      // cut into pieces of yarn: at colour changes and where one length of yarn ran out
      const uni = keys.every((v) => v === keys[0]);
      let start = 0;
      if (!uni) { start = 1; while (start < m && keys[start] === keys[start - 1]) start++; start %= m; }
      else start = (lr() * m) | 0;
      const dyeBase = hash2(seed, reg.id * 131 + k);
      const segs = [];
      if (uni && len < 520) segs.push([0, m, true]);
      else {
        let q0 = start, cnt = 0;
        while (cnt < m) {
          const key = keys[q0 % m];
          const maxLen = Math.round((240 + lr() * 700) / 2.3);
          let c = 1;
          while (cnt + c < m && keys[(q0 + c) % m] === key && c < maxLen) c++;
          segs.push([q0, c, false]);
          q0 += c; cnt += c;
        }
      }
      let seq = 0;
      for (const [q0, c, cl] of segs) {
        if (c < 2) continue;
        const key = keys[q0 % m];
        const cut = cl ? 0 : (lr() < 0.5 ? 1 : 0);
        const cnt = cl ? m : c + 1 - cut;
        if (cnt < 2) continue;
        const pts = new Float32Array(cnt * 2);
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, pl = 0;
        for (let t = 0; t < cnt; t++) {
          const q = (q0 + t) % m;
          pts[t * 2] = X[q]; pts[t * 2 + 1] = Y[q];
          if (X[q] < x0) x0 = X[q]; if (X[q] > x1) x1 = X[q]; if (Y[q] < y0) y0 = Y[q]; if (Y[q] > y1) y1 = Y[q];
          if (t) pl += Math.hypot(X[q] - pts[t * 2 - 2], Y[q] - pts[t * 2 - 1]);
        }
        const dye = (hash2(dyeBase, (seq / 3) | 0) % NV);
        const g2 = reg.group;
        const phase = g2 === 'border' ? 2 : g2 === 'bg' ? 3 : k < reg.ol ? 0 : 1;
        pieces.push({
          p: pts, cl, c: key * NV + dye, sd: hash2(seed, loopId * 977 + seq), len: pl, bb: [x0, y0, x1, y1],
          o: [phase, phase <= 1 ? gOrder(g2) : 0, k, loopId, seq],
        });
        seq++;
      }
      loopId++;
      if ((loopId & 1023) === 1023) await pause();
    }
    tlog('strands ' + pieces.length + ' loops ' + loopId);
    pieces.sort((a, b) => {
      const A = a.o, Bo = b.o;
      for (let i = 0; i < 5; i++) if (A[i] !== Bo[i]) return A[i] - Bo[i];
      return 0;
    });
    // timeline (seconds): outlines, fills, border, then the ground rippling outward
    const DUR = [1.5, 3.3, 0.8, 2.7];
    const tot = [0, 0, 0, 0];
    for (const p of pieces) tot[p.o[0]] += p.len + 30;
    const acc = [0, 0, 0, 0];
    let t0 = 0;
    const starts = [0, DUR[0], DUR[0] + DUR[1], DUR[0] + DUR[1] + DUR[2]];
    for (const p of pieces) {
      const ph = p.o[0];
      p.t = starts[ph] + DUR[ph] * (acc[ph] / (tot[ph] || 1));
      acc[ph] += p.len + 30;
      t0 = p.t;
    }
    void t0;
    return { pieces, sketch, regs };
  }

  /* ------------------------------------------------------------------ rendering yarn */
  function addPath(path, P) {
    const p = P.p, n = p.length >> 1;
    path.moveTo(p[0], p[1]);
    for (let i = 1; i < n; i++) path.lineTo(p[i * 2], p[i * 2 + 1]);
    if (P.cl) path.closePath();
  }
  // twist grooves and ply highlights, then fuzz, for one strand
  function addTwist(gp, hp, P, pitch) {
    const p = P.p, n = p.length >> 1, cl = P.cl;
    const W = YW, slant = 0.3 * W, half = 0.5 * W;
    let acc = (P.sd % 1000) / 1000 * pitch;
    const segs = cl ? n : n - 1;
    for (let i = 0; i < segs; i++) {
      const j = (i + 1) % n;
      const ax = p[i * 2], ay = p[i * 2 + 1], bx = p[j * 2], by = p[j * 2 + 1];
      const L = Math.hypot(bx - ax, by - ay);
      if (L <= 0) continue;
      const tx = (bx - ax) / L, ty = (by - ay) / L, nx = -ty, ny = tx;
      while (acc < L) {
        const x = ax + tx * acc, y = ay + ty * acc;
        gp.moveTo(x - nx * half - tx * slant, y - ny * half - ty * slant);
        gp.lineTo(x + nx * half + tx * slant, y + ny * half + ty * slant);
        if (hp) {
          const hx = x + tx * pitch * 0.48, hy = y + ty * pitch * 0.48;
          hp.moveTo(hx - nx * 0.3 * W - tx * 0.18 * W, hy - ny * 0.3 * W - ty * 0.18 * W);
          hp.lineTo(hx + nx * 0.3 * W + tx * 0.18 * W, hy + ny * 0.3 * W + ty * 0.18 * W);
        }
        acc += pitch;
      }
      acc -= L;
    }
  }
  function addFuzz(fp, P) {
    const p = P.p, n = p.length >> 1;
    const r = mulberry32(P.sd ^ 0xF022);
    const count = Math.round(P.len / 8);
    for (let h = 0; h < count; h++) {
      const i = Math.min(n - 2, (r() * (n - 1)) | 0);
      const ax = p[i * 2], ay = p[i * 2 + 1], bx = p[i * 2 + 2], by = p[i * 2 + 3];
      const L = Math.hypot(bx - ax, by - ay) || 1, tx = (bx - ax) / L, ty = (by - ay) / L;
      const side = r() < 0.5 ? -1 : 1, nx = -ty * side, ny = tx * side;
      const u = r();
      const x = ax + (bx - ax) * u + nx * YW * 0.38, y = ay + (by - ay) * u + ny * YW * 0.38;
      const a = (r() - 0.5) * 1.8, ca = Math.cos(a), sa = Math.sin(a);
      const dx = nx * ca - ny * sa, dy = nx * sa + ny * ca;
      const len = YW * (0.18 + r() * r() * 0.75), bend = (r() - 0.5) * len;
      fp.moveTo(x, y);
      fp.quadraticCurveTo(x + dx * len * 0.5 + tx * bend, y + dy * len * 0.5 + ty * bend, x + dx * len + tx * bend * 0.4, y + dy * len + ty * bend * 0.4);
    }
  }
  function drawPieces(ctx, P, i0, i1, S, ox, oy, cols) {
    const wpx = YW * S;
    const twist = !DBG.fast && wpx >= 1.4, ply = wpx >= 3.2, fuzz = !DBG.fast && wpx >= 2.2;
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    let i = i0;
    while (i < i1) {
      const c = P[i].c;
      let j = i + 1;
      while (j < i1 && P[j].c === c) j++;
      const col = cols[c];
      const path = new Path2D();
      for (let q = i; q < j; q++) addPath(path, P[q]);
      ctx.setTransform(S, 0, 0, S, ox, oy);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'destination-over';
      ctx.strokeStyle = col.shadow; ctx.lineWidth = SP * 1.9; ctx.stroke(path);
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = col.dark; ctx.lineWidth = YW; ctx.stroke(path);
      let m = 0.13 * YW * S;
      ctx.setTransform(S, 0, 0, S, ox + LX * m, oy + LY * m);
      ctx.strokeStyle = col.base; ctx.lineWidth = YW * 0.68; ctx.stroke(path);
      m = 0.27 * YW * S;
      ctx.setTransform(S, 0, 0, S, ox + LX * m, oy + LY * m);
      ctx.strokeStyle = col.hi; ctx.lineWidth = YW * 0.2; ctx.globalAlpha = 0.65; ctx.stroke(path);
      ctx.globalAlpha = 1;
      ctx.setTransform(S, 0, 0, S, ox, oy);
      if (twist) {
        const gp = new Path2D(), hp = ply ? new Path2D() : null;
        const pitch = YW * 0.92;
        for (let q = i; q < j; q++) addTwist(gp, hp, P[q], pitch);
        ctx.lineCap = 'butt';
        ctx.strokeStyle = col.groove; ctx.lineWidth = Math.max(YW * 0.13, 0.7 / S); ctx.stroke(gp);
        if (hp) { ctx.strokeStyle = col.ply; ctx.lineWidth = YW * 0.12; ctx.stroke(hp); }
        ctx.lineCap = 'round';
      }
      if (fuzz) {
        const fp = new Path2D();
        for (let q = i; q < j; q++) addFuzz(fp, P[q]);
        ctx.strokeStyle = col.fuzz; ctx.lineWidth = Math.max(YW * 0.05, 0.55 / S); ctx.stroke(fp);
      }
      i = j;
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  /* ------------------------------------------------------------------ the wax board */
  function drawWax(ctx, S, seed) {
    const r = mulberry32(seed ^ 0x3A7);
    ctx.setTransform(S, 0, 0, S, 0, 0);
    const g = ctx.createLinearGradient(0, 0, B, B);
    g.addColorStop(0, '#9a6a2c'); g.addColorStop(0.5, '#86561f'); g.addColorStop(1, '#6e4518');
    ctx.fillStyle = g; ctx.fillRect(0, 0, B, B);
    for (let i = 0; i < 260; i++) {
      const x = r() * B, y = r() * B, rad = 20 + r() * 160, light = r() < 0.5;
      const rg = ctx.createRadialGradient(x, y, 0, x, y, rad);
      rg.addColorStop(0, light ? 'rgba(214,160,80,0.16)' : 'rgba(60,32,8,0.16)');
      rg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = rg; ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
    // finger-smoothed streaks in the wax
    ctx.lineCap = 'round';
    for (let i = 0; i < 90; i++) {
      const x = r() * B, y = r() * B, a = r() * Math.PI, l = 40 + r() * 200;
      ctx.strokeStyle = r() < 0.5 ? 'rgba(236,190,110,0.07)' : 'rgba(40,20,4,0.08)';
      ctx.lineWidth = 6 + r() * 30;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + Math.cos(a) * l * 0.5 + (r() - 0.5) * 40, y + Math.sin(a) * l * 0.5, x + Math.cos(a) * l, y + Math.sin(a) * l); ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(20,10,2,0.6)'; ctx.lineWidth = 3; ctx.strokeRect(1.5, 1.5, B - 3, B - 3);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }
  // the design scratched into the wax with a stylus, drawn up to `upto` (0..1)
  function drawSketch(ctx, S, sketch, from, upto, total) {
    ctx.setTransform(S, 0, 0, S, 0, 0);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    const a = from * total, b = upto * total;
    const dark = new Path2D();
    let acc = 0;
    for (const poly of sketch) {
      const n = poly.length;
      for (let i = 0; i < n; i++) {
        const p = poly[i], q = poly[(i + 1) % n];
        const L = Math.hypot(q[0] - p[0], q[1] - p[1]);
        if (acc + L > a && acc < b) {
          const t0 = Math.max(0, (a - acc) / L), t1 = Math.min(1, (b - acc) / L);
          dark.moveTo(p[0] + (q[0] - p[0]) * t0, p[1] + (q[1] - p[1]) * t0);
          dark.lineTo(p[0] + (q[0] - p[0]) * t1, p[1] + (q[1] - p[1]) * t1);
        }
        acc += L;
        if (acc > b) break;
      }
      if (acc > b) break;
    }
    ctx.strokeStyle = 'rgba(42,22,6,0.75)'; ctx.lineWidth = 2.6; ctx.stroke(dark);
    ctx.setTransform(S, 0, 0, S, S * 1.1, S * 1.1);
    ctx.strokeStyle = 'rgba(240,196,120,0.35)'; ctx.lineWidth = 1.4; ctx.stroke(dark);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }
  function sketchLength(sketch) {
    let t = 0;
    for (const poly of sketch) for (let i = 0; i < poly.length; i++) {
      const p = poly[i], q = poly[(i + 1) % poly.length]; t += Math.hypot(q[0] - p[0], q[1] - p[1]);
    }
    return t;
  }

  /* ------------------------------------------------------------------ the piece */
  (window.PIECES = window.PIECES || []).push({
    id: 'nierika',
    title: 'The Deer Who Carried the First Maize',
    medium: 'Acrylic yarn pressed into beeswax on plywood, after the Wixárika yarn-painting tradition',
    note: 'Scroll or pinch to look closer.',
    about: 'An homage to the yarn paintings of the Wixárika (Huichol) people of Jalisco and Nayarit, in which coloured yarn is pressed strand by strand into a wax-coated board. Every strand here is laid by code the way a painter lays it: each figure outlined, then filled from its edge inward, the dark ground echoing every shape outward until the ripples meet. It is an admiring imitation made from outside the tradition, not a work of it.',
    tone: 'dark',
    room: '#120f0d',
    mount(el, api) {
      let alive = true;
      const seed = api.seed >>> 0;
      el.style.background = 'radial-gradient(ellipse 80% 70% at 50% 42%, #2b241f 0%, #18130f 60%, #0e0b09 100%)';
      el.style.overflow = 'hidden';
      el.style.touchAction = 'none';
      const view = document.createElement('div');
      view.style.cssText = 'position:absolute;left:0;top:0;transform-origin:0 0;box-shadow:0 0.4vmin 1vmin rgba(0,0,0,.55),0 2.5vmin 6vmin rgba(0,0,0,.6);will-change:transform';
      const wax = document.createElement('canvas'), yarn = document.createElement('canvas');
      for (const c of [wax, yarn]) { c.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%'; view.appendChild(c); }
      el.appendChild(view);
      const wctx = wax.getContext('2d'), yctx = yarn.getContext('2d');

      let Wv = 0, Hv = 0, dpr = 1, bs = 0, bx = 0, by = 0, S = 1;
      let data = null, cols = yarnColours(seed), drawn = 0, tStart = 0, finished = false;
      let sketchT0 = performance.now(), sketchDone = 0, sketchTotal = 1, sketchList = null;
      const SKETCH_DUR = DBG.instant ? 0 : 1600;

      function layout() {
        Wv = el.clientWidth; Hv = el.clientHeight;
        dpr = Math.min(2, window.devicePixelRatio || 1);
        const nbs = Math.round(Math.min(Wv, Hv) * 0.88);
        const changed = nbs !== bs;
        bs = nbs; bx = Math.round((Wv - bs) / 2); by = Math.round((Hv - bs) / 2);
        view.style.width = bs + 'px'; view.style.height = bs + 'px';
        applyView();
        if (changed) {
          const px = Math.round(bs * dpr);
          wax.width = px; wax.height = px; yarn.width = px; yarn.height = px;
          S = px / B;
          drawWax(wctx, S, seed);
          if (sketchList && sketchDone > 0) drawSketch(wctx, S, sketchList, 0, sketchDone, sketchTotal);
          yctx.setTransform(1, 0, 0, 1, 0, 0); yctx.clearRect(0, 0, px, px);
          drawn = 0;
        }
      }

      /* zoom and pan */
      let z = 1, vx = 0, vy = 0; // view: board top-left at (vx, vy) in css px, scale z
      function clampView() {
        const size = bs * z;
        if (size <= Wv) vx = (Wv - size) / 2; else vx = Math.min(Wv * 0.06, Math.max(Wv - size - Wv * 0.06, vx));
        if (size <= Hv) vy = (Hv - size) / 2; else vy = Math.min(Hv * 0.06, Math.max(Hv - size - Hv * 0.06, vy));
      }
      function applyView() {
        if (z <= 1.0001) { z = 1; vx = bx; vy = by; } else clampView();
        view.style.transform = 'translate(' + vx + 'px,' + vy + 'px) scale(' + z + ')';
        hiresOnView();
      }
      const maxZoom = () => Math.max(4, Math.min(24, 32 / (YW * bs / B)));
      function zoomAt(mx, my, f) {
        const nz = Math.max(1, Math.min(maxZoom(), z * f));
        const u = (mx - vx) / (bs * z), v = (my - vy) / (bs * z);
        z = nz; vx = mx - u * bs * z; vy = my - v * bs * z;
        applyView();
      }

      /* hi-resolution re-render of whatever is in view, once the view settles */
      let hiA = null, hiTimer = 0, hiJob = null;
      const hiCanvases = [];
      function hiresOnView() {
        // keep any finished hi-res layers aligned with the moving view
        for (const h of hiCanvases) {
          const f = z / h.z;
          h.c.style.transform = 'translate(' + (vx - h.vx * f) + 'px,' + (vy - h.vy * f) + 'px) scale(' + f + ')';
          if (z <= 1.0001) h.c.style.display = 'none';
        }
        clearTimeout(hiTimer);
        if (hiJob) hiJob.cancel = true;
        if (z > 1.05 && finished) hiTimer = setTimeout(renderHi, 220);
      }
      function renderHi() {
        if (!alive || !data) return;
        const c = document.createElement('canvas');
        c.width = Math.round(Wv * dpr); c.height = Math.round(Hv * dpr);
        c.style.cssText = 'position:absolute;left:0;top:0;width:' + Wv + 'px;height:' + Hv + 'px;transform-origin:0 0;pointer-events:none';
        el.appendChild(c);
        const h = { c, z, vx, vy };
        const ctx = c.getContext('2d');
        const Sh = (bs * z * dpr) / B, ox = vx * dpr, oy = vy * dpr;
        const bx0 = -ox / Sh - 20, by0 = -oy / Sh - 20, bx1 = (c.width - ox) / Sh + 20, by1 = (c.height - oy) / Sh + 20;
        const list = data.pieces.filter((p) => p.bb[2] > bx0 && p.bb[0] < bx1 && p.bb[3] > by0 && p.bb[1] < by1);
        const job = { cancel: false };
        hiJob = job;
        let i = 0;
        const step = () => {
          if (!alive || job.cancel) { if (!h.done) { c.remove(); } return; }
          const t = performance.now();
          while (i < list.length && performance.now() - t < 14) {
            const e = Math.min(list.length, i + 30);
            drawPieces(ctx, list, i, e, Sh, ox, oy, cols);
            i = e;
          }
          if (i < list.length) { requestAnimationFrame(step); return; }
          // the wax beneath everything
          ctx.globalCompositeOperation = 'destination-over';
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          ctx.fillStyle = '#7a4c1c';
          ctx.fillRect(ox, oy, B * Sh, B * Sh);
          ctx.globalCompositeOperation = 'source-over';
          h.done = true;
          for (const o of hiCanvases.splice(0)) o.c.remove();
          hiCanvases.push(h);
          hiresOnView.skipTimer = true;
        };
        requestAnimationFrame(step);
      }

      const ptrs = new Map();
      let pinch = null, lastTap = 0;
      const onWheel = (e) => {
        e.preventDefault();
        const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaMode === 2 ? e.deltaY * 400 : e.deltaY;
        const r = el.getBoundingClientRect();
        zoomAt(e.clientX - r.left, e.clientY - r.top, Math.exp(-dy * 0.0016));
      };
      const onDown = (e) => {
        const r = el.getBoundingClientRect();
        ptrs.set(e.pointerId, { x: e.clientX - r.left, y: e.clientY - r.top });
        try { el.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
        if (ptrs.size === 2) {
          const [a, b] = [...ptrs.values()];
          pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
        }
        if (ptrs.size === 1) {
          const now = performance.now();
          if (now - lastTap < 300) { z = 1; applyView(); }
          lastTap = now;
        }
        el.style.cursor = z > 1 ? 'grabbing' : '';
      };
      const onMove = (e) => {
        if (!ptrs.has(e.pointerId)) return;
        const r = el.getBoundingClientRect();
        const p = ptrs.get(e.pointerId), nx = e.clientX - r.left, ny = e.clientY - r.top;
        if (ptrs.size === 1) {
          if (z > 1) { vx += nx - p.x; vy += ny - p.y; applyView(); }
        } else if (ptrs.size === 2 && pinch) {
          p.x = nx; p.y = ny;
          const [a, b] = [...ptrs.values()];
          const d = Math.hypot(a.x - b.x, a.y - b.y), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
          vx += mx - pinch.mx; vy += my - pinch.my;
          zoomAt(mx, my, d / (pinch.d || d));
          pinch = { d, mx, my };
          return;
        }
        p.x = nx; p.y = ny;
      };
      const onUp = (e) => {
        ptrs.delete(e.pointerId);
        if (ptrs.size < 2) pinch = null;
        el.style.cursor = z > 1 ? 'grab' : '';
      };
      el.addEventListener('wheel', onWheel, { passive: false });
      el.addEventListener('pointerdown', onDown);
      el.addEventListener('pointermove', onMove);
      el.addEventListener('pointerup', onUp);
      el.addEventListener('pointercancel', onUp);

      /* first frame: the bare wax board */
      layout();
      const ro = new ResizeObserver(() => { if (alive) layout(); });
      ro.observe(el);
      api.ready();

      /* the laying of the yarn */
      let raf = 0;
      function frame() {
        raf = 0;
        if (!alive) return;
        const now = performance.now();
        if (sketchList && sketchDone < 1) {
          const u = SKETCH_DUR ? Math.min(1, (now - sketchT0) / SKETCH_DUR) : 1;
          drawSketch(wctx, S, sketchList, sketchDone, u, sketchTotal);
          sketchDone = u;
        }
        if (data && sketchDone >= 1) {
          if (!tStart) tStart = now + (DBG.instant ? -1e9 : 250);
          const t = (now - tStart) / 1000;
          const P = data.pieces;
          let target = drawn;
          while (target < P.length && P[target].t <= t) target++;
          const budget = now + (DBG.instant ? 40 : 12);
          while (drawn < target && performance.now() < budget) {
            const e = Math.min(target, drawn + 24);
            drawPieces(yctx, P, drawn, e, S, 0, 0, cols);
            drawn = e;
          }
          if (drawn >= P.length && !finished) { if (DBG.log) console.warn('[nierika] drawn ' + Math.round(now - tStart) + 'ms'); finished = true; el.dataset.done = '1'; hiresOnView(); }
        }
        if (!finished || drawn < (data ? data.pieces.length : 1)) raf = requestAnimationFrame(frame);
      }
      // resizes after the end redraw everything quickly
      const kick = () => { if (!raf && alive) raf = requestAnimationFrame(frame); };
      const ro2 = new ResizeObserver(() => kick());
      ro2.observe(el);

      if (DBG.flat) {
        const d = design(seed);
        wctx.setTransform(S, 0, 0, S, 0, 0);
        wctx.lineJoin = 'round';
        for (const r of d.R) {
          const f = RGB[r.col(9, null, r, 0, 0)] || [128, 128, 128], o = RGB[r.col(0, null, r, 0, 0)] || f;
          for (const poly of r.polys) {
            wctx.beginPath(); poly.forEach((p, i) => (i ? wctx.lineTo(p[0], p[1]) : wctx.moveTo(p[0], p[1]))); wctx.closePath();
            wctx.fillStyle = 'rgb(' + f.join(',') + ')'; wctx.fill();
            wctx.strokeStyle = 'rgb(' + o.join(',') + ')'; wctx.lineWidth = 6; wctx.stroke();
          }
        }
        wctx.strokeStyle = 'rgba(255,255,255,0.25)'; wctx.lineWidth = 1.5; wctx.font = '22px sans-serif'; wctx.fillStyle = 'rgba(255,255,255,0.6)';
        for (let g = 128; g < B; g += 128) {
          wctx.beginPath(); wctx.moveTo(g, 0); wctx.lineTo(g, B); wctx.moveTo(0, g); wctx.lineTo(B, g); wctx.stroke();
          if (g % 256 === 0) { wctx.fillText(String(g), g + 3, 22); wctx.fillText(String(g), 3, g - 4); }
        }
        el.dataset.done = '1';
        return { destroy() { ro.disconnect(); } };
      }
      sketchList = design(seed).sketch;
      sketchTotal = sketchLength(sketchList);
      sketchT0 = performance.now();
      kick();

      let sliceT = performance.now();
      const pause = () => {
        if (!alive) return Promise.reject(new Error('gone'));
        if (performance.now() - sliceT < 22) return Promise.resolve();
        return new Promise((res) => setTimeout(() => { sliceT = performance.now(); res(); }, 0));
      };
      buildStrands(seed, 2048, pause).then((d) => {
        if (!alive) return;
        data = d;
        kick();
      }).catch((e) => { if (alive) console.error(e); });

      return {
        destroy() {
          alive = false;
          if (raf) cancelAnimationFrame(raf);
          clearTimeout(hiTimer);
          if (hiJob) hiJob.cancel = true;
          ro.disconnect(); ro2.disconnect();
          el.removeEventListener('wheel', onWheel);
          el.removeEventListener('pointerdown', onDown);
          el.removeEventListener('pointermove', onMove);
          el.removeEventListener('pointerup', onUp);
          el.removeEventListener('pointercancel', onUp);
          data = null;
        },
      };
    },
  });
})();
