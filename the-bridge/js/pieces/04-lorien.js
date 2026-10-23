/* Drawings from Middle-earth — 04 · "Caras Galadhon by Lamplight"
 * A presentation drawing in metallic silver and gold ink with white gouache on midnight-blue
 * paper, made at runtime. Everything is laid out first (trees, flets, stairs, lamps), the lamps
 * are summed into a light map, and then every mark is drawn as a tapered pen stroke whose weight
 * and density follow that light: the night is the bare paper, light is the ink. Ink and a separate
 * map of where the metal lies are uploaded to WebGL, where the metal catches a moving light as
 * the pointer tilts the sheet. Press and hold to look through a lens. All randomness is seeded.
 */
(function () {
  'use strict';

  /* ================================================================ constants & utilities */
  const TAU = Math.PI * 2;
  const DW = 1000, DH = 1430;                       // design units of the sheet
  const PX0 = 40, PY0 = 40, PX1 = 960, PY1 = 1332;  // picture area inside the border
  const YE = 1222;                                  // eye level
  const VPX = 500, VPY = -1700;                     // vanishing point of the verticals (looking up)

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
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const ell = (y) => Math.max(0.035, 0.5 * (1 - Math.exp(-(YE - y) / 600)));

  function noise1(R) {
    const t = new Float32Array(256);
    for (let i = 0; i < 256; i++) t[i] = R() * 2 - 1;
    return (x) => { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return t[i & 255] * (1 - u) + t[(i + 1) & 255] * u; };
  }
  function noise2(R) {
    const P = new Uint16Array(512), G = new Float32Array(256);
    for (let i = 0; i < 256; i++) { P[i] = i; G[i] = R() * 2 - 1; }
    for (let i = 255; i > 0; i--) { const j = (R() * (i + 1)) | 0; const t = P[i]; P[i] = P[j]; P[j] = t; }
    for (let i = 0; i < 256; i++) P[i + 256] = P[i];
    return (x, y) => {
      const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
      const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
      const X = xi & 255, Y = yi & 255;
      const a = G[P[X + P[Y]]], b = G[P[X + 1 + P[Y]]], c = G[P[X + P[Y + 1]]], d = G[P[X + 1 + P[Y + 1]]];
      return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
    };
  }

  /* inks (on a transparent layer that is laid over the paper) */
  const INK = {
    silver: '#b9c4d8', silverHi: '#e2e8f3', silverDim: '#8d9bb8',
    gold: '#d6a851', goldHi: '#f3d48a', goldDeep: '#ad8640',
    white: '#f6f2e6', mist: '#c8d4ea',
    lamp: { y: '#ffd68a', g: '#a2ecbc', b: '#b4d8ff', s: '#e6eeff' },
    glow: { y: [255, 206, 120], g: [150, 230, 175], b: [165, 205, 255], s: [215, 228, 255] },
  };

  /* ================================================================ the drawing */
  function makeArt(seed, K) {
    const R = mulberry32(seed ^ 0x51a7e);
    const rr = (a, b) => a + (b - a) * R();
    const chance = (p) => R() < p;
    const nz = noise1(R);
    const nz2 = noise2(R);

    const CW = Math.round(DW * K), CH = Math.round(DH * K);
    const ink = document.createElement('canvas'); ink.width = CW; ink.height = CH;
    const met = document.createElement('canvas'); met.width = Math.ceil(CW / 2); met.height = Math.ceil(CH / 2);
    const C = ink.getContext('2d', { willReadFrequently: true });
    const M = met.getContext('2d', { willReadFrequently: true });
    M.setTransform(0.5, 0, 0, 0.5, 0, 0);

    /* ---------------------------------------------------------- mark primitives */
    function poly(P, xs, ys, n) {
      let a = 0;
      for (let i = 0, j = n - 1; i < n; j = i++) a += xs[j] * ys[i] - xs[i] * ys[j];
      if (a >= 0) { P.moveTo(xs[0] * K, ys[0] * K); for (let i = 1; i < n; i++) P.lineTo(xs[i] * K, ys[i] * K); }
      else { P.moveTo(xs[n - 1] * K, ys[n - 1] * K); for (let i = n - 2; i >= 0; i--) P.lineTo(xs[i] * K, ys[i] * K); }
      P.closePath();
    }
    // a pen stroke along pts (flat [x,y,...]) with half-width w that swells and tapers
    function stroke(P, pts, w, ti, to) {
      const n = pts.length >> 1; if (n < 2) return;
      if (ti === undefined) ti = 0.18; if (to === undefined) to = 0.35;
      const cum = new Float64Array(n); let total = 0;
      for (let i = 1; i < n; i++) { total += Math.hypot(pts[2 * i] - pts[2 * i - 2], pts[2 * i + 1] - pts[2 * i - 1]); cum[i] = total; }
      if (total < 1e-4) return;
      const xs = new Float64Array(2 * n), ys = new Float64Array(2 * n);
      for (let i = 0; i < n; i++) {
        const i0 = i > 0 ? i - 1 : i, i1 = i < n - 1 ? i + 1 : i;
        let tx = pts[2 * i1] - pts[2 * i0], ty = pts[2 * i1 + 1] - pts[2 * i0 + 1];
        const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
        const t = cum[i] / total;
        let a = ti > 0 ? Math.min(1, t / ti) : 1; a = a < 1 ? Math.pow(a, 0.6) : 1;
        let b = to > 0 ? Math.min(1, (1 - t) / to) : 1; b = b < 1 ? Math.pow(b, 0.6) : 1;
        const hw = Math.max(0.06, w * a * b);
        xs[i] = pts[2 * i] - ty * hw; ys[i] = pts[2 * i + 1] + tx * hw;
        xs[2 * n - 1 - i] = pts[2 * i] + ty * hw; ys[2 * n - 1 - i] = pts[2 * i + 1] - tx * hw;
      }
      poly(P, xs, ys, 2 * n);
    }
    // a band of explicit per-point half-widths
    function ribbon(P, pts, hws) {
      const n = pts.length >> 1; if (n < 2) return;
      const xs = new Float64Array(2 * n), ys = new Float64Array(2 * n);
      for (let i = 0; i < n; i++) {
        const i0 = i > 0 ? i - 1 : i, i1 = i < n - 1 ? i + 1 : i;
        let tx = pts[2 * i1] - pts[2 * i0], ty = pts[2 * i1 + 1] - pts[2 * i0 + 1];
        const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
        const hw = hws[i];
        xs[i] = pts[2 * i] - ty * hw; ys[i] = pts[2 * i + 1] + tx * hw;
        xs[2 * n - 1 - i] = pts[2 * i] + ty * hw; ys[2 * n - 1 - i] = pts[2 * i + 1] - tx * hw;
      }
      poly(P, xs, ys, 2 * n);
    }
    function quad(x0, y0, cx, cy, x1, y1, n) {
      const o = [];
      for (let i = 0; i <= n; i++) {
        const t = i / n, u = 1 - t;
        o.push(u * u * x0 + 2 * u * t * cx + t * t * x1, u * u * y0 + 2 * u * t * cy + t * t * y1);
      }
      return o;
    }
    function line(P, x0, y0, x1, y1, w, bow, ti, to) {
      const mx = (x0 + x1) / 2, my = (y0 + y1) / 2, dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy) || 1;
      const b = bow || 0;
      const n = clamp(Math.ceil(l / 3), 2, 24);
      stroke(P, quad(x0, y0, mx - dy / l * b, my + dx / l * b, x1, y1, n), w, ti, to);
    }
    // a blade of grass: a thin triangle from its root to its tip
    function flick(P, x, y, h, lean, w) {
      P.moveTo((x - w) * K, y * K); P.lineTo((x + lean) * K, (y - h) * K); P.lineTo((x + w) * K, y * K); P.closePath();
    }
    function dot(P, x, y, r) { P.moveTo((x + r) * K, y * K); P.arc(x * K, y * K, r * K, 0, TAU); }
    function ellipse(P, x, y, rx, ry) { P.moveTo((x + rx) * K, y * K); P.ellipse(x * K, y * K, rx * K, ry * K, 0, 0, TAU); }

    const MET = { s: '#ff0000', g: '#00ff00', p: '#000000' };
    function fill(P, col, a, metal, ma) {
      if (a > 0) { C.globalAlpha = Math.min(1, a); C.fillStyle = col; C.fill(P); }
      if (metal) { M.globalAlpha = Math.min(1, ma === undefined ? a : ma); M.fillStyle = MET[metal]; M.fill(P); }
    }
    function erase(P, a, rule) {
      C.globalCompositeOperation = 'destination-out'; M.globalCompositeOperation = 'destination-out';
      C.globalAlpha = a === undefined ? 1 : a; M.globalAlpha = C.globalAlpha;
      C.fillStyle = '#000'; M.fillStyle = '#000';
      C.fill(P, rule || 'nonzero'); M.fill(P, rule || 'nonzero');
      C.globalCompositeOperation = 'source-over'; M.globalCompositeOperation = 'source-over';
    }
    // quantised buckets so thousands of marks become a handful of fills
    function Buckets(col, metal, levels) {
      const n = levels || 6; const ps = [];
      for (let i = 0; i < n; i++) ps.push(null);
      return {
        get(a) { const i = clamp(Math.round(a * (n - 1)), 0, n - 1); return ps[i] || (ps[i] = new Path2D()); },
        flush(mul, metalMul) {
          const m = mul === undefined ? 1 : mul;
          for (let i = 0; i < n; i++) if (ps[i]) { const a = i / (n - 1) * m; fill(ps[i], col, a, metal, a * (metalMul === undefined ? 1 : metalMul)); ps[i] = null; }
        },
      };
    }

    /* ---------------------------------------------------------- light map */
    const LS = 5, LW = Math.ceil(DW / LS) + 1, LH = Math.ceil(DH / LS) + 1;
    const LI = new Float32Array(LW * LH);
    function addLight(x, y, I, sig) {
      const rad = sig * 2.8, k = -1 / (2 * sig * sig);
      const i0 = Math.max(0, Math.floor((x - rad) / LS)), i1 = Math.min(LW - 1, Math.ceil((x + rad) / LS));
      const j0 = Math.max(0, Math.floor((y - rad) / LS)), j1 = Math.min(LH - 1, Math.ceil((y + rad) / LS));
      for (let j = j0; j <= j1; j++) {
        const dy = j * LS - y;
        for (let i = i0; i <= i1; i++) { const dx = i * LS - x; LI[j * LW + i] += I * Math.exp((dx * dx + dy * dy) * k); }
      }
    }
    function light(x, y) {
      const fx = clamp(x / LS, 0, LW - 1.001), fy = clamp(y / LS, 0, LH - 1.001);
      const i = fx | 0, j = fy | 0, u = fx - i, v = fy - j, o = j * LW + i;
      return (LI[o] * (1 - u) + LI[o + 1] * u) * (1 - v) + (LI[o + LW] * (1 - u) + LI[o + LW + 1] * u) * v;
    }

    /* ================================================================ LAYOUT */
    const lamps = [];
    function lamp(x, y, s, c, kind, ax, ay, I) {
      const L = { x, y, s, c, kind: kind || 'hang', ax: ax === undefined ? x : ax, ay: ay === undefined ? y - s * 3 : ay, I: I === undefined ? 1 : I };
      lamps.push(L); return L;
    }
    const pickCol = (wy, wg, wb) => { const t = R() * (wy + wg + wb); return t < wy ? 'y' : t < wy + wg ? 'g' : (chance(0.5) ? 'b' : 's'); };

    const stairU = (S, u) => u + (S.wob || 0) * Math.sin(TAU * u * (S.wf || 1) + (S.wp || 0)) * Math.sin(Math.PI * u);
    /* ---- trees */
    const trees = [];
    function makeTree(o) {
      const T = Object.assign({ tier: 2, thL: 0, flets: [], stairs: [], ladders: [], limbs: [], lampsOwn: [] }, o);
      const fb = T.yb - VPY;
      const bend = (T.tier === 3 ? (chance(0.5) ? 1 : -1) * rr(0.08, 0.13) : rr(-1, 1) * 0.07) * T.wb, ph = rr(0, 50);
      T.f = (y) => (y - VPY) / fb;
      T.cx = (y) => VPX + (T.xb - VPX) * T.f(y) + bend * Math.sin(clamp((T.yb - y) / 900, 0, 1) * Math.PI);
      T.r = (y) => {
        const h = Math.max(0, T.yb - y);
        let r = 0.5 * T.wb * T.f(y) * (1 - 0.11 * h / 800);
        r *= 1 + 0.34 * Math.exp(-h / 14) + 0.12 * Math.exp(-h / 50);
        return r * (1 + 0.014 * nz(h / 45 + ph) + (T.tier >= 2 ? 0.045 * nz(h / 210 + ph * 2) : 0));
      };
      trees.push(T); return T;
    }
    const J = (a) => rr(-a, a);
    const GAPS = [[412 + J(15), 112 + J(20), 66, 98], [672 + J(15), 150 + J(20), 56, 104], [215 + J(15), 58, 86, 44], [860 + J(15), 84, 74, 58],
      [300 + J(15), 330 + J(30), 40, 48], [772 + J(15), 330 + J(30), 36, 52], [165 + J(10), 250 + J(30), 30, 46], [905 + J(10), 260 + J(30), 30, 50], [560 + J(20), 52, 34, 22]];
    const gapVal = (x, y) => { let m = 9; for (const [gx, gy, rx, ry] of GAPS) { const d = Math.pow((x - gx) / rx, 2) + Math.pow((y - gy) / ry, 2) - 1 - 0.35 * nz2(x / 18, y / 18); if (d < m) m = d; } return m; };
    const inGap = (x, y) => gapVal(x, y) < 0;
    const crest = (x) => 936 + 0.00042 * (x - 545) * (x - 545);
    const far = [[92, 34], [368, 30], [655, 32], [912, 36]].map(([x, w]) => { x += J(14);
      return makeTree({ xb: x, yb: crest(x) + 30, wb: w * rr(0.9, 1.1), tier: 0, thL: x < 500 ? 0.7 : -0.7 }); });
    const back = [[172, 60], [418, 50], [702, 55], [872, 64]].map(([x, w]) => { x += J(10);
      return makeTree({ xb: x, yb: crest(x) + 26, wb: w * rr(0.92, 1.08), tier: 1, thL: x < 500 ? 0.65 : -0.65 }); });
    const L1 = makeTree({ xb: 250 + J(8), yb: crest(250) + 14, wb: 122 * rr(0.96, 1.04), tier: 2, thL: 0.7 });
    const R1 = makeTree({ xb: 818 + J(8), yb: crest(818) + 12, wb: 130 * rr(0.96, 1.04), tier: 2, thL: -0.75 });
    const KT = makeTree({ xb: 548 + J(5), yb: 952, wb: 180, tier: 3, thL: -0.5 });

    // flets: y of the underside, R in multiples of the trunk radius
    // flets: y of the underside, R in multiples of the trunk radius, [pa, pb] the arc of the trunk it
    // rests against (0 faces us); most lie on one side, in the fork of a great limb
    function flet(T, y, Rm, pa, pb, houses, opt) { const F = Object.assign({ y, Rm, pa, pb, houses: houses || [] }, opt || {}); T.flets.push(F); return F; }
    const sw = (c, w) => [c - w / 2, c + w / 2];
    flet(KT, 812 + J(8), 2.15, ...sw(-0.95 + J(0.15), 2.1), [{ phi: -0.7 }]);
    flet(KT, 664 + J(10), 1.85, ...sw(1.0 + J(0.15), 1.9), [{ phi: 0.75 }]);
    flet(KT, 448 + J(4), 1.72, -2.0, 2.0, [], { hall: true });
    flet(KT, 270 + J(10), 1.75, ...sw(-0.9 + J(0.2), 1.9), [{ phi: -0.55 }]);
    flet(KT, 120 + J(10), 1.6, ...sw(0.8, 2.2), []);
    flet(L1, 776 + J(12), 2.1, ...sw(0.9 + J(0.2), 2.2), [{ phi: 0.7 }]);
    flet(L1, 536 + J(12), 2.2, ...sw(-0.3 + J(0.2), 2.5), [{ phi: -0.6 }, { phi: 0.55 }]);
    flet(L1, 314 + J(12), 1.9, ...sw(0.8 + J(0.2), 2.4), [{ phi: 0.6 }]);
    flet(L1, 140 + J(12), 1.6, ...sw(-0.5, 2.6), []);
    flet(R1, 836 + J(12), 2.0, ...sw(-0.9 + J(0.2), 2.0), [{ phi: -0.6 }]);
    flet(R1, 614 + J(12), 2.15, ...sw(0.2 + J(0.3), 2.4), [{ phi: 0.35 }]);
    flet(R1, 398 + J(12), 1.95, ...sw(-0.8 + J(0.2), 2.0), [{ phi: -0.6 }]);
    flet(R1, 208 + J(12), 1.7, ...sw(0.6, 2.4), []);
    back.forEach((T, i) => {
      flet(T, 700 - i * 22 + J(30), 2.1, ...sw(J(1.2), rr(1.7, 2.6)), chance(0.6) ? [{ phi: 0 }] : []);
      flet(T, 460 + J(40), 2.0, ...sw(J(1.2), rr(1.7, 2.6)), chance(0.4) ? [{ phi: 0 }] : []);
      if (chance(0.7)) flet(T, 240 + J(40), 1.9, ...sw(J(1.2), rr(1.7, 2.6)), []);
    });
    far.forEach((T) => { flet(T, 640 + J(60), 2.2, ...sw(J(1.2), rr(2.4, 3.6)), []); if (chance(0.7)) flet(T, 380 + J(50), 2.1, ...sw(J(1.2), rr(2.4, 3.6)), []); });
    trees.forEach((T) => T.flets.sort((a, b) => b.y - a.y));

    // stairs and ladders
    {
      let ph = -1.25 + J(0.2);
      const ys = [KT.yb - 2].concat(KT.flets.filter((F) => F.y > 400).map((F) => F.y));
      const turns = [0.85, 0.9, 1.25];
      for (let i = 0; i < ys.length - 1; i++) {
        const tn = turns[i] + J(0.08);
        KT.stairs.push({ y0: ys[i] - (i ? 4 : 0), y1: ys[i + 1], ph0: ph, turns: tn, dir: 1, sw: 15 });
        ph += tn * TAU + 2.4 + J(0.4);
      }
      // the top lookout is reached from the hall by a short spiral
      KT.stairs.push({ y0: KT.flets[2].y - 84, y1: KT.flets[3].y, ph0: ph, turns: 0.85, dir: 1, sw: 13 });
      KT.ladders.push({ y0: KT.flets[3].y - 4, y1: KT.flets[4].y, side: 0.45 });
    }
    {
      L1.ladders.push({ y0: L1.yb - 2, y1: L1.flets[0].y, side: 0.62 });
      let ph = 0.4;
      for (let i = 0; i < 2; i++) { L1.stairs.push({ y0: L1.flets[i].y - 4, y1: L1.flets[i + 1].y, ph0: ph, turns: 1.0 + J(0.1), dir: -1, sw: 12 }); ph -= 1.05 * TAU + 2.2; }
      L1.ladders.push({ y0: L1.flets[2].y - 4, y1: L1.flets[3].y, side: 0.5 });
    }
    {
      R1.stairs.push({ y0: R1.yb - 2, y1: R1.flets[0].y, ph0: 1.3, turns: 1.1, dir: -1, sw: 13 });
      R1.stairs.push({ y0: R1.flets[0].y - 4, y1: R1.flets[1].y, ph0: -0.3, turns: 0.95, dir: -1, sw: 12 });
      R1.ladders.push({ y0: R1.flets[1].y - 4, y1: R1.flets[2].y, side: -0.45 });
      R1.ladders.push({ y0: R1.flets[2].y - 4, y1: R1.flets[3].y, side: 0.55 });
    }
    for (const T of trees) for (const S of T.stairs) { S.wob = rr(0.03, 0.06); S.wf = rr(1, 2.2); S.wp = rr(0, TAU); }
    back.forEach((T) => { T.ladders.push({ y0: T.flets[0].y + 120, y1: T.flets[0].y, side: T.thL > 0 ? 0.7 : -0.7 }); if (T.flets[1]) T.ladders.push({ y0: T.flets[0].y - 3, y1: T.flets[1].y, side: T.thL > 0 ? -0.4 : 0.4 }); });

    /* ---- branches (structure only; leaves are generated as they are drawn) */
    function growLimb(T, y0, side, sc, great) {
      const r0 = T.r(y0);
      let x = T.cx(y0) + side * r0 * 0.78, y = y0;
      const e0 = great ? rr(-0.05, 0.15) : rr(-0.12, 0.38), e1 = rr(0.75, 1.3), L = rr(110, 250) * sc;
      const hw0 = r0 * (great ? rr(0.36, 0.44) : rr(0.26, 0.38));
      const pts = [x, y], hw = [hw0];
      const n = Math.ceil(L / 5), sd = rr(0, 50);
      for (let i = 1; i <= n; i++) {
        const t = i / n, el = lerp(e0, e1, Math.pow(t, 0.75)) + 0.16 * nz(sd + t * 3);
        x += side * Math.cos(el) * L / n; y -= Math.sin(el) * L / n;
        if (i > 3 && T.tier >= 1 && inGap(x, y)) break;
        pts.push(x, y); hw.push(Math.max(0.5, hw0 * Math.pow(1 - 0.8 * t, 1.1)));
      }
      const nn = (pts.length >> 1) - 1;
      const limb = { pts, hw, side, subs: [], L };
      if (nn < 2) return limb;
      const ns = Math.round(rr(4, 7) * (0.4 + 0.6 * nn / n));
      for (let k = 0; k < ns; k++) {
        const t = rr(0.22, 0.98), i = Math.round(t * nn);
        const ang = Math.atan2(pts[2 * i + 1] - pts[2 * Math.max(0, i - 1) + 1], pts[2 * i] - pts[2 * Math.max(0, i - 1)]);
        const up = k % 2 === 0 ? -1 : 1;
        const a = ang + side * up * rr(0.35, 0.95) * -1;
        limb.subs.push(growSub(pts[2 * i], pts[2 * i + 1], a, L * rr(0.3, 0.55), hw[i] * 0.6, sc));
      }
      limb.subs.push(growSub(pts[2 * nn], pts[2 * nn + 1], Math.atan2(pts[2 * nn + 1] - pts[2 * nn - 1], pts[2 * nn] - pts[2 * nn - 2]), L * 0.35, hw[nn], sc));
      return limb;
    }
    function growSub(x, y, a, L, hw0, sc) {
      const n = Math.max(3, Math.ceil(L / 5)), pts = [x, y], hw = [hw0];
      const curl = rr(-0.5, 0.5) / n, sd = rr(0, 50);
      let ang = a;
      for (let i = 1; i <= n; i++) {
        ang += curl + 0.06 * nz(sd + i * 0.4);
        // a gentle pull upward
        ang += (Math.atan2(-1, Math.cos(ang) >= 0 ? 0.7 : -0.7) - ang) * 0.02;
        x += Math.cos(ang) * L / n; y += Math.sin(ang) * L / n;
        if (i > 1 && inGap(x, y)) break;
        pts.push(x, y); hw.push(Math.max(0.3, hw0 * (1 - 0.85 * i / n)));
      }
      const m = (pts.length >> 1) - 1;
      const twigs = [];
      const nt = Math.round(rr(4, 7) * clamp(L / 70, 0.6, 1.4));
      for (let k = 0; k < nt && m >= 1; k++) {
        const t = rr(0.15, 1), i = Math.min(m, Math.round(t * m));
        const i0 = Math.max(0, i - 1);
        const base = Math.atan2(pts[2 * i + 1] - pts[2 * i0 + 1], pts[2 * i] - pts[2 * i0]);
        const ta = base + (k % 2 ? 1 : -1) * rr(0.45, 1.2);
        twigs.push({ x: pts[2 * i], y: pts[2 * i + 1], a: ta, L: rr(12, 30) * Math.sqrt(sc) });
      }
      twigs.push({ x: pts[2 * m], y: pts[2 * m + 1], a: ang, L: rr(10, 20) * Math.sqrt(sc) });
      return { pts, hw, twigs };
    }
    const limbPlan = [[KT, 24, 760, 1.0], [L1, 18, 700, 0.88], [R1, 18, 730, 0.9]]
      .concat(back.map((T) => [T, 12, 660, 0.62])).concat(far.map((T) => [T, 8, 620, 0.45]));
    for (const [T, n, yLow, sc] of limbPlan) {
      for (let i = 0; i < n; i++) {
        const y0 = lerp(yLow, 70, Math.pow((i + rr(0, 0.9)) / n, 0.85));
        const side = (i % 2 ? 1 : -1) * (chance(0.15) ? -1 : 1);
        T.limbs.push(growLimb(T, y0, side, sc * rr(0.85, 1.15)));
      }
    }
    // great limbs spring from beneath the flets, as a telain sits in the fork of a mallorn
    for (const T of [KT, L1, R1]) {
      let side = T === L1 ? 1 : T === R1 ? -1 : (chance(0.5) ? 1 : -1);
      for (const F of T.flets) {
        if (F.y < 150) continue;
        const m = Math.sin((F.pa + F.pb) / 2);
        if (Math.abs(m) > 0.25) side = m > 0 ? 1 : -1;
        T.limbs.unshift(growLimb(T, F.y + rr(8, 18), side, rr(1.2, 1.45) * (T === KT ? 1 : 0.85), true));
        if (F.hall || chance(0.55)) T.limbs.unshift(growLimb(T, F.y + rr(14, 30), -side, rr(1.0, 1.3) * (T === KT ? 1 : 0.85), true));
        side = -side;
      }
    }
    // a pair of limbs from the near trunks, lit from behind
    const F1 = makeTree({ xb: -16, yb: 1440, wb: 236, tier: 4, thL: 1.3 });
    F1.cx = (y) => lerp(-16, 52, (1440 - y) / 1440) + 6 * Math.sin(y / 300);
    F1.r = (y) => lerp(118, 88, (1440 - y) / 1440) * (1 + 0.5 * Math.exp(-(1400 - y) / 26)) * (1 + 0.012 * nz(y / 40));
    const F2 = makeTree({ xb: 1030, yb: 1440, wb: 170, tier: 4, thL: -1.3 });
    F2.cx = (y) => lerp(1032, 990, (1440 - y) / 1440);
    F2.r = (y) => lerp(86, 66, (1440 - y) / 1440) * (1 + 0.012 * nz(y / 40 + 9));
    trees.splice(trees.indexOf(F1), 1); trees.splice(trees.indexOf(F2), 1);
    const nearLimbs = [growLimb(F1, 250 + J(30), 1, 1.15), growLimb(F1, 95 + J(20), 1, 0.95), growLimb(F2, 160 + J(30), -1, 0.85)];
    for (const L of nearLimbs) { for (let i = 0; i < L.hw.length; i++) L.hw[i] *= 0.45; for (const S of L.subs) for (let i = 0; i < S.hw.length; i++) S.hw[i] *= 0.5; }

    /* ---- ground: the hill, the path, the wall, the gate */
    const WALLTOP = (x) => 1184 - 12 * (1 - Math.pow((x - 500) / 470, 2));
    const WALLBASE = (x) => 1250 + 2 * Math.pow((x - 500) / 470, 2);
    const BANK = 1288;
    const GX = 476;                       // gate centre
    const KX = KT.cx(950);
    const PATH = [[GX, 1190], [GX + 6, 1150], [GX + 18, 1104], [GX + 34, 1058], [GX + 44, 1012], [KX - 22, 972], [KX - 30, 952]];
    const pathW = (y) => lerp(13, 40, smooth(945, 1192, y));
    const FOUNT = { x: 388 + J(6), y: 1000 };
    // winding side paths across the lawn, each with its little lamps
    const SIDE = [
      [[494, 1112], [446, 1102], [392, 1088], [346, 1064], [352, 1036], [384, 1014]],
      [[386, 1008], [338, 998], [292, 994], [262, 990]],
      [[512, 1062], [578, 1052], [644, 1048], [700, 1030], [742, 1006], [784, 988]],
      [[506, 1150], [580, 1146], [660, 1138], [730, 1120], [800, 1112], [860, 1098]],
    ];
    // elves gathered on the lawn in twos and threes, some carrying small lights
    const GROUPS = [[318, 1086, 3], [612, 1084, 3], [710, 1152, 2], [210, 1148, 3], [452, 992, 2], [826, 1064, 2]].map(([x, y, n]) => ({ x: x + J(6), y: y + J(3), n }));

    // plan of a flet: its outline radius at angle ph, a leaf- or kidney-shaped deck in the fork
    function fletRo(F, ph) {
      const lobe = 1 + 0.14 * Math.sin(2 * ph + F.s1) + 0.1 * Math.sin(3 * ph + F.s2);
      const u = (ph - F.pa) / (F.pb - F.pa);
      if (u <= 0 || u >= 1) return F.r;
      return F.r + (F.R * lobe - F.r) * Math.pow(Math.sin(Math.PI * Math.pow(u, F.sk || 1)), 0.62);
    }
    function fletP(F, ph, rho, lift) { return [F.tcx + rho * Math.sin(ph), F.y - F.e * rho * Math.cos(ph) - (lift || 0)]; }

    /* ---- lamps */
    // on the flets: on the rail posts and hanging beneath the rim
    for (const T of trees) {
      const tierS = [0.55, 0.75, 1, 1.1][T.tier];
      for (const F of T.flets) {
        const y = F.y, cx = T.cx(y), r = T.r(y), Rr = F.Rm * r, e = ell(y), t = 3 + Rr * 0.03;
        F.R = Rr; F.e = e; F.t = t; F.tcx = cx; F.cx = cx; F.r = r; F.s1 = rr(0, TAU); F.s2 = rr(0, TAU); F.sk = F.hall ? 1 : rr(0.75, 1.35);
        for (const H of F.houses) H.col = chance(0.25) ? 'g' : 'y';
        for (const H of F.houses) H.phi = clamp(H.phi, Math.max(F.pa + 0.5, -1.2), Math.min(F.pb - 0.5, 1.2));
        if (F.hall) continue;
        const qa = Math.max(F.pa + 0.25, -1.4), qb = Math.min(F.pb - 0.25, 1.4);
        if (qb - qa < 0.3) continue;
        const nu = T.tier >= 2 ? Math.round(rr(2, 4)) : Math.round(rr(1, 2.4));
        for (let i = 0; i < nu; i++) {
          const th = lerp(qa, qb, (i + 0.5) / nu) + J(0.1);
          const [ax, ay] = fletP(F, th, fletRo(F, th) * 0.96);
          const s = rr(3.2, 4.4) * tierS;
          lamp(ax, ay + rr(5, 13) * tierS + s, s, pickCol(4, 3, 2), 'hang', ax, ay, 1);
        }
        if (T.tier >= 1) {
          const np = T.tier >= 2 ? Math.round(rr(2, 3)) : 1;
          for (let i = 0; i < np; i++) {
            const th = lerp(qa, qb, R());
            const [px, py0] = fletP(F, th, fletRo(F, th)), py = py0 - t - 9 * tierS;
            lamp(px, py - 3 * tierS, 2.6 * tierS, pickCol(3, 2, 2), 'post', px, py + 4, 0.8);
          }
        }
      }
      // the hall: lamps round the eaves
    }
    {
      const F = KT.flets.find((f) => f.hall);
      F.isHall = true;
      const Rd = F.r * 1.5, H = 54;
      for (let i = 0; i < 8; i++) {
        const th = (i + 0.5) / 8 * 2.8 - 1.4;
        const yy = F.y - F.t - H;
        const ax = KT.cx(yy) + Rd * 1.14 * Math.sin(th), ay = yy - ell(yy) * Rd * 1.14 * Math.cos(th) + 3;
        const s = 3.4 + 0.6 * Math.cos(th);
        lamp(ax, ay + 7 + s, s, i % 3 === 1 ? 'g' : (i % 3 === 2 ? 's' : 'y'), 'hang', ax, ay, 1.1);
      }
      for (let i = 0; i < 5; i++) {
        const th = (i + 0.5) / 5 * 2.8 - 1.4;
        const [ax, ay] = fletP(F, th, fletRo(F, th) * 0.97);
        lamp(ax, ay + 16, 4.2, i % 2 ? 'b' : 'y', 'hang', ax, ay, 1.1);
      }
    }
    // on the stairs, at intervals, on the newel posts
    for (const T of trees) for (const S of T.stairs) {
      const n = Math.round(S.turns * 3.4);
      for (let i = 1; i <= n; i++) {
        const u = (i - 0.5) / n, y = lerp(S.y0, S.y1, stairU(S, u)), ph = S.ph0 + S.dir * S.turns * TAU * u;
        if (Math.cos(ph) < 0.15) continue;
        const ro = T.r(y) + S.sw * T.f(y) * (1 + 0.22 * Math.sin(TAU * u * 1.3 + S.wp)), e = ell(y);
        const px = T.cx(y) + ro * Math.sin(ph), py = y - e * ro * Math.cos(ph) - 9;
        lamp(px, py - 4, 2.9, pickCol(3, 3, 2), 'post', px, py + 3, 0.9);
      }
    }
    // slender bridges from flet to flet, between the trees
    const bridges = [];
    const bridgeAt = (B, u) => [lerp(B.a[0], B.b[0], u), lerp(B.a[1], B.b[1], u) + B.sag * Math.sin(Math.PI * u)];
    function span(Ta, ia, qa, Tb, ib, qb) {
      const Fa = Ta.flets[ia], Fb = Tb.flets[ib];
      if (!Fa || !Fb || Fa.R === undefined || Fb.R === undefined) return;
      qa = clamp(qa, Fa.pa + 0.25, Fa.pb - 0.25); qb = clamp(qb, Fb.pa + 0.25, Fb.pb - 0.25);
      const B = { a: fletP(Fa, qa, fletRo(Fa, qa) * 0.94, Fa.t), b: fletP(Fb, qb, fletRo(Fb, qb) * 0.94, Fb.t), sag: rr(5, 11), tier: Math.min(Ta.tier, Tb.tier) };
      bridges.push(B);
      for (const u of [0.33, 0.67]) { const [x, y] = bridgeAt(B, u); lamp(x, y + 10, 2.9, pickCol(3, 3, 2), 'hang', x, y + 1.6, 0.9); }
    }
    span(L1, 0, 1.6, KT, 0, -1.6);
    span(KT, 1, 1.6, R1, 1, -1.3);
    span(L1, 1, 1.2, KT, 2, -1.75);
    span(KT, 3, 1.4, R1, 2, -1.0);
    // the constellation in the canopy: lamps hung from the boughs at every level
    for (const T of trees) {
      const n = [7, 14, 30, 46][T.tier];
      let made = 0, guard = 0;
      while (made < n && guard++ < 400) {
        const L = T.limbs[(R() * T.limbs.length) | 0];
        const S = L.subs[(R() * L.subs.length) | 0];
        const i = (R() * (S.pts.length / 2)) | 0;
        const ax = S.pts[2 * i], ay = S.pts[2 * i + 1];
        if (ay < PY0 + 8 || ax < PX0 + 10 || ax > PX1 - 10) continue;
        const s = rr(2.6, 4.2) * [0.5, 0.7, 0.95, 1.05][T.tier];
        lamp(ax, ay + rr(6, 22) * [0.5, 0.7, 1, 1][T.tier] + s, s, pickCol(5, 3, 2), 'hang', ax, ay, 1);
        made++;
      }
    }
    // far specks among the distant trees
    for (let i = 0; i < 46; i++) {
      const x = rr(PX0 + 20, PX1 - 20), y = rr(160, 760);
      lamp(x, y, rr(0.9, 1.6), pickCol(3, 3, 2), 'speck', x, y, 0.4);
    }
    // the gate, the wall, the bridge
    const gateL = GX - 42, gateR = GX + 42, gTop = 1094;
    lamp(gateL - 8, gTop - 12, 5.4, 'y', 'post', gateL - 8, gTop - 4, 1.3);
    lamp(gateR + 8, gTop - 12, 5.4, 'y', 'post', gateR + 8, gTop - 4, 1.3);
    lamp(GX, gTop + 2, 5.4, 'g', 'hang', GX, gTop - 30, 1.4);
    lamp(GX - 18, gTop + 12, 3.6, 'y', 'hang', GX - 18, gTop - 18, 1);
    lamp(GX + 18, gTop + 12, 3.6, 's', 'hang', GX + 18, gTop - 18, 1);
    for (const dx of [-60, -52, 52, 60]) lamp(GX + dx, WALLTOP(GX + dx) - 10, 3.0, pickCol(3, 2, 2), 'post', GX + dx, WALLTOP(GX + dx) - 1, 0.9);
    for (const dx of [-400, -310, -220, -140, -76, 76, 140, 220, 310, 400]) {
      const x = GX + dx + J(6); if (x > 930 || x < 70) continue;
      lamp(x, WALLTOP(x) - 13, 3.4, pickCol(3, 2, 2), 'post', x, WALLTOP(x) - 2, 0.9);
    }
    const bridge = { x0a: GX - 24, x0b: GX + 24, y0: 1250, x1a: GX - 96, x1b: GX + 96, y1: PY1 + 6 };
    {
      const bt = (y) => (y - bridge.y0) / (bridge.y1 - bridge.y0);
      const xl = (y) => lerp(bridge.x0a, bridge.x1a, bt(y)), xr = (y) => lerp(bridge.x0b, bridge.x1b, bt(y));
      for (const [y, s, h] of [[BANK + 6, 5.0, 30], [1268, 3.8, 18], [1252, 3.0, 12]]) {
        lamp(xl(y) - 2, y - h, s, 'y', 'post', xl(y) - 2, y - h + s * 2.2, 1.1);
        lamp(xr(y) + 2, y - h, s, y > 1270 ? 'g' : 's', 'post', xr(y) + 2, y - h + s * 2.2, 1.1);
      }
    }
    // along the path on the hill
    {
      let acc = 18;
      for (let k = 0; k < PATH.length - 1; k++) {
        const [xa, ya] = PATH[k], [xb, yb] = PATH[k + 1], l = Math.hypot(xb - xa, yb - ya);
        for (; acc < l; acc += rr(30, 38)) {
          const t = acc / l, x = lerp(xa, xb, t), y = lerp(ya, yb, t);
          if (y > 1182) continue;
          const w = pathW(y) * 0.5;
          const sc = lerp(0.6, 1.05, smooth(950, 1185, y));
          const c = pickCol(3, 3, 2);
          for (const side of [-1, 1]) lamp(x + side * (w + 5 * sc), y - 14 * sc, 3.0 * sc, c, 'post', x + side * (w + 5 * sc), y + 1, 0.85);
        }
        acc -= l;
      }
    }
    // silver lamps that swing over the fountain
    const fountLamps = [[-40, -48], [37, -52], [-4, -80], [62, -26], [-64, -24]].map(([dx, dy]) => lamp(FOUNT.x + dx, FOUNT.y + dy, 3.6, 's', 'hang', FOUNT.x + dx * 0.8, FOUNT.y + dy - 15, 1.2));
    for (const P of SIDE) {
      let acc = 6;
      for (let k = 0; k < P.length - 1; k++) {
        const [xa, ya] = P[k], [xb, yb] = P[k + 1], l = Math.hypot(xb - xa, yb - ya);
        for (; acc < l; acc += rr(15, 20)) {
          const t = acc / l, x = lerp(xa, xb, t), y = lerp(ya, yb, t), sc = lerp(0.55, 0.9, smooth(980, 1180, y));
          const side = (Math.floor(acc + k * 7) % 2) ? 1 : -1;
          lamp(x, y - 8 * sc + side * 4, 1.9 * sc, pickCol(3, 3, 2), 'post', x, y + side * 4 + 1, 0.6);
        }
        acc -= l;
      }
    }
    for (const G of GROUPS) {
      G.figs = [];
      const sc = lerp(15, 23, smooth(980, 1190, G.y));
      for (let i = 0; i < G.n; i++) {
        const f = { x: G.x + (i - (G.n - 1) / 2) * sc * 0.42 + J(1.5), y: G.y + J(2.5), h: sc * rr(0.92, 1.06) };
        G.figs.push(f);
        if (i % 2 === 0) { const L = lamp(f.x + f.h * 0.22, f.y - f.h * 0.5, 1.5, pickCol(3, 3, 2), 'speck', f.x, f.y, 0.5); L.late = true; }
      }
    }
    // the guide's lamp
    const guideLamp = { x: 0, y: 0 };

    /* ---- the light map */
    for (const L of lamps) {
      if (L.kind === 'speck') { addLight(L.x, L.y, 0.12, 10); continue; }
      addLight(L.x, L.y, 0.55 * L.I, 9 + L.s * 4.5);
      addLight(L.x, L.y, 0.1 * L.I, 24 + L.s * 6);
    }
    { const F = KT.flets.find((f) => f.hall); addLight(F.cx, F.y - 60, 0.9, 95); addLight(F.cx, F.y - 30, 0.5, 190); }
    addLight(GX, 1170, 0.5, 70);
    addLight(FOUNT.x, FOUNT.y - 24, 0.6, 52);
    for (const G of GROUPS) addLight(G.x, G.y - 8, 0.35, 22);
    for (const L of lamps) if (L.late) addLight(L.x, L.y, 0.25, 12);

    /* ================================================================ DRAWING */
    const sil = Buckets(INK.silver, 's', 7);
    const silHi = Buckets(INK.silverHi, 's', 7);
    const gold = Buckets(INK.gold, 'g', 7);
    const goldHi = Buckets(INK.goldHi, 'g', 7);
    const white = Buckets(INK.white, 'p', 6);
    const flushAll = () => { sil.flush(); silHi.flush(); gold.flush(); goldHi.flush(); white.flush(); };
    const tierA = [0.42, 0.62, 0.95, 1, 1];

    /* ---- stars, between the leaves */
    function* drawStars() {
      for (let i = 0; i < 1500; i++) {
        let x = rr(PX0, PX1), y = rr(PY0, 900);
        if (i < 500) { const g = GAPS[i % GAPS.length]; x = g[0] + rr(-1, 1) * g[2]; y = g[1] + rr(-1, 1) * g[3]; }
        else if (R() > Math.pow(1 - (y - PY0) / 880, 1.3)) continue;
        const m = Math.pow(R(), 3);
        const r = 0.32 + m * 0.85;
        const P = (m > 0.3 ? silHi : sil).get(clamp(0.55 + m * 0.6 + rr(-0.1, 0.1), 0, 1)); dot(P, x, y, r);
        if (m > 0.55 || chance(0.035)) {
          const l = 2.4 + m * 5.5, P2 = silHi.get(0.75);
          line(P2, x - l, y, x + l, y, 0.22, 0, 0.5, 0.5); line(P2, x, y - l * 1.1, x, y + l * 1.1, 0.22, 0, 0.5, 0.5);
          if (m > 0.8) { const d = l * 0.5; line(P2, x - d, y - d, x + d, y + d, 0.14, 0, 0.5, 0.5); line(P2, x - d, y + d, x + d, y - d, 0.14, 0, 0.5, 0.5); }
        }
        if (i % 80 === 0) yield;
      }
      sil.flush(); silHi.flush();
    }

    /* ---- a trunk: engraved like a column. Lines run up the bark at even angles round the
       cylinder and swell where the light falls, thinning to nothing in the shadow; satin
       cross-hatching only in the brightest band; lenticels, the eyes of old boughs, roots. */
    function trunkLight(T, th, y) {
      const key = Math.max(0, Math.cos(th - T.thL));
      const side = T.cx(y) + Math.sin(T.thL) * T.r(y) * 1.25;
      const lo = light(side, y);
      return (0.06 + 0.94 * Math.pow(key, 1.5)) * clamp(0.42 + lo * 0.75, 0, 1.25);
    }
    function* drawTrunk(T) {
      const A = tierA[T.tier];
      const yT = 28, yB = T.yb + 2;
      const nS = Math.ceil((yB - yT) / 3);
      {
        const xs = [], ys = [];
        for (let i = 0; i <= nS; i++) { const y = lerp(yT, yB, i / nS); xs.push(T.cx(y) - T.r(y)); ys.push(y); }
        for (let i = nS; i >= 0; i--) { const y = lerp(yT, yB, i / nS); xs.push(T.cx(y) + T.r(y)); ys.push(y); }
        const P = new Path2D(); poly(P, xs, ys, xs.length); erase(P);
        for (const [sp, a] of [[1.0, 0.035], [0.6, 0.04]]) {
          const bx = [], by = [];
          for (let i = 0; i <= nS; i++) { const y = lerp(yT, yB, i / nS); bx.push(T.cx(y) + T.r(y) * Math.sin(clamp(T.thL - sp, -1.5, 1.5))); by.push(y); }
          for (let i = nS; i >= 0; i--) { const y = lerp(yT, yB, i / nS); bx.push(T.cx(y) + T.r(y) * Math.sin(clamp(T.thL + sp, -1.5, 1.5))); by.push(y); }
          const W = new Path2D(); poly(W, bx, by, bx.length); fill(W, INK.silver, a * A, 's', a * 0.6);
        }
      }
      yield;
      const N = [18, 34, 84, 108][T.tier];
      const wmax = [0.34, 0.42, 0.5, 0.53][T.tier];
      T.roots = [];
      for (let i = 0; i < 6; i++) T.roots.push(lerp(-1.3, 1.3, (i + rr(0.3, 0.7)) / 6));
      const rootPull = (th, yy) => {
        const h = T.yb - yy; if (T.tier < 2 || h > 90) return th;
        let best = T.roots[0]; for (const q of T.roots) if (Math.abs(q - th) < Math.abs(best - th)) best = q;
        return th + (best - th) * 0.8 * Math.pow(1 - h / 90, 1.7);
      };
      const lines = (n, off, wm, gamma, thr, B) => {
        for (let i = 0; i < n; i++) {
          const th0 = -Math.PI / 2 - 0.5 + (Math.PI + 1.0) * (i + 0.5 + off) / n + J(0.18 * Math.PI / n);
          const sd = rr(0, 99);
          let y = yT + rr(-120, 0);
          while (y < yB) {
            const y2 = Math.min(yB, y + rr(120, 340));
            const n2 = Math.max(3, Math.ceil((y2 - y) / 4));
            const pts = [], hws = [];
            let any = false;
            for (let k = 0; k <= n2; k++) {
              const yy = lerp(y, y2, k / n2), u = k / n2;
              const th = rootPull(th0 + 0.02 * nz(sd + yy / 70) + T.twA * (T.yb - yy), yy);
              const flute = T.tier >= 2 ? 0.6 + 0.4 * (0.5 + 0.5 * Math.cos(T.nF * th + T.twF * (T.yb - yy))) : 1;
              const tn = Math.abs(th) > 1.56 ? -1 : trunkLight(T, th, yy) * flute - thr;
              let w = tn > 0 ? wm * Math.pow(tn / (1 - thr), gamma) * (0.8 + 0.3 * nz(sd * 3 + yy / 23)) * (0.62 + 0.38 * nz(sd * 7 + yy / 3.2)) : 0;
              w *= Math.pow(Math.min(1, u / 0.07, (1 - u) / 0.07), 0.6);
              if (w > 0.1) any = true;
              pts.push(T.cx(yy) + T.r(yy) * Math.sin(th), yy); hws.push(Math.max(0.025, w));
            }
            if (any) ribbon(B.get(clamp(0.92 * A, 0, 1)), pts, hws);
            y = y2 + rr(-2, 7);
          }
        }
      };
      T.nF = 7; T.twF = (chance(0.5) ? 1 : -1) * 0.006; T.twA = (T.twF > 0 ? 1 : -1) * (T.tier >= 2 ? 0.00042 : 0.0002);
      lines(Math.round(N * (Math.PI + 1.0) / Math.PI), 0, wmax, 1.15, 0, sil);
      yield;
      // interleaved finer lines in the light only, for the satin of the bark
      lines(Math.round(N * (Math.PI + 1.0) / Math.PI), 0.5, wmax * 0.6, 1.6, 0.58, silHi);
      yield;
      // satin cross-hatching: contour arcs across the brightest band
      for (let y = yT + rr(0, 3); y < yB - 6; y += rr(3.2, 6.5) * (T.tier < 2 ? 1.7 : 1)) {
        const e = ell(y), r = T.r(y), cx = T.cx(y);
        let run = null;
        const flushRun = () => {
          if (run && run.length >= 8) stroke(sil.get(clamp(0.45 * A, 0, 1)), run, 0.18, 0.3, 0.3);
          run = null;
        };
        for (let q = -1.5; q <= 1.5; q += 0.06) {
          if (trunkLight(T, q, y) > 0.86 + 0.14 * nz(y / 13 + q)) { (run || (run = [])).push(cx + r * Math.sin(q), y - e * r * Math.cos(q)); }
          else flushRun();
        }
        flushRun();
        if (((y | 0) % 24) < 3) yield;
      }
      // lenticels: tiny dashes round the bark
      const nT = Math.round((yB - yT) * T.wb * [0.002, 0.004, 0.008, 0.009][T.tier]);
      for (let i = 0; i < nT; i++) {
        const y = rr(yT, yB), th = rr(-1.4, 1.4), Lm = trunkLight(T, th, y);
        if (Lm < 0.18 || R() > Lm) continue;
        const e = ell(y), r = T.r(y), cx = T.cx(y), d = rr(0.025, 0.06);
        const pts = [];
        for (let k = 0; k <= 3; k++) { const q = th - d + 2 * d * k / 3; pts.push(cx + r * Math.sin(q), y - e * r * Math.cos(q)); }
        stroke(silHi.get(clamp(0.8 * A, 0, 1)), pts, rr(0.2, 0.34), 0.3, 0.4);
        if (i % 300 === 0) yield;
      }
      // the eyes of the bark, where boughs fell long ago
      const nE = [0, 2, 5, 8][T.tier];
      for (let i = 0; i < nE; i++) {
        const y = rr(yT + 40, yB - 80), th = clamp(T.thL + rr(-0.9, 0.9), -1.25, 1.25);
        const Lm = trunkLight(T, th, y), e = ell(y), r = T.r(y), cx = T.cx(y);
        const ew = rr(6, 13) * Math.cos(th), eh = rr(1.6, 2.8);
        const x0 = cx + r * Math.sin(th), y0 = y - e * r * Math.cos(th);
        const E = new Path2D(); ellipse(E, x0, y0, ew * 0.62, eh * 1.6); erase(E);
        const Bk = silHi.get(clamp((0.5 + 0.5 * Lm) * A, 0, 1));
        stroke(Bk, quad(x0 - ew * 0.55, y0, x0, y0 - eh * 1.3, x0 + ew * 0.55, y0, 7), 0.32, 0.25, 0.25);
        stroke(Bk, quad(x0 - ew * 0.5, y0 + 0.2, x0, y0 + eh * 1.0, x0 + ew * 0.5, y0 + 0.2, 7), 0.26, 0.25, 0.25);
        for (let k = 1; k <= 2; k++) stroke(sil.get(clamp((0.4 + 0.4 * Lm) * A, 0, 1)), quad(x0 - ew * (0.6 + k * 0.3), y0 - k * 0.5, x0, y0 - eh * (1.5 + k * 1.0), x0 + ew * (0.6 + k * 0.3), y0 - k * 0.5, 8), 0.17, 0.3, 0.3);
      }
      // silhouette contours and the rim of light on the shadowed edge
      for (const sgn of [-1, 1]) {
        const lit = Math.sin(T.thL) * sgn > 0;
        let y = yT;
        while (y < yB) {
          const y2 = Math.min(yB, y + rr(90, 320));
          const pts = [];
          for (let yy = y; yy <= y2; yy += 5) pts.push(T.cx(yy) + sgn * T.r(yy) * 0.997, yy);
          pts.push(T.cx(y2) + sgn * T.r(y2) * 0.997, y2);
          stroke((lit ? silHi : sil).get(clamp((lit ? 0.9 : 0.5) * A, 0, 1)), pts, lit ? 0.5 : 0.32, 0.05, 0.08);
          y = y2 + rr(-6, 4);
        }
        if (!lit) {
          let y3 = yT;
          while (y3 < yB) {
            const y4 = Math.min(yB, y3 + rr(60, 220)), ym = (y3 + y4) / 2;
            const back = light(T.cx(ym) + sgn * T.r(ym) * 1.3, ym);
            if (R() < 0.45 + back) {
              const pts = [];
              for (let yy = y3; yy <= y4; yy += 5) pts.push(T.cx(yy) + sgn * (T.r(yy) - 2.2 - 0.5 * nz(yy / 30)), yy);
              stroke(silHi.get(clamp((0.55 + back * 0.6) * A, 0, 1)), pts, 0.34, 0.2, 0.3);
            }
            y3 = y4 + rr(10, 50);
          }
        }
      }
      yield;
      // buttress roots spreading into the lawn
      if (T.tier >= 2) {
        for (let i = 0; i < T.roots.length; i++) {
          const th = T.roots[i];
          const ys = T.yb - rr(36, 60) * T.wb / 150;
          const x0 = T.cx(ys) + T.r(ys) * Math.sin(th);
          const spread = (Math.abs(Math.sin(th)) * 0.9 + 0.25) * rr(14, 30) * T.wb / 150;
          const x1 = T.cx(T.yb) + T.r(T.yb) * Math.sin(th) + Math.sign(th) * spread, y1 = T.yb + rr(3, 9) * Math.cos(th);
          const Lm = trunkLight(T, th, T.yb - 20);
          const rp = quad(x0, ys, x0 + (x1 - x0) * 0.15, y1 - 6, x1, y1, 12);
          stroke(silHi.get(clamp((0.45 + 0.55 * Lm) * A, 0, 1)), rp, 0.5, 0.1, 0.5);
          for (let k = 1; k <= 4; k++) {
            const o = k * 1.6 * -Math.sign(T.thL || 1);
            stroke(sil.get(clamp(0.9 * Lm * A, 0, 1)), quad(x0 + o * 0.5, ys + 8 * k, x0 + (x1 - x0) * 0.25 + o, y1 - 5, x1 + o * 0.6, y1 - 0.5, 8), 0.2 + 0.12 * Lm, 0.2, 0.4);
          }
        }
      }
      sil.flush(); silHi.flush();
    }

    /* ---- boughs, twigs, leaves */
    function leafShape(P, x, y, a, l, w) {
      const ca = Math.cos(a), sa = Math.sin(a);
      const X = (u, v) => (x + u * ca - v * sa) * K, Y = (u, v) => (y + u * sa + v * ca) * K;
      P.moveTo(X(0, 0), Y(0, 0));
      P.quadraticCurveTo(X(0.4 * l, -w * l * 1.0), Y(0.4 * l, -w * l * 1.0), X(l, 0), Y(l, 0));
      P.quadraticCurveTo(X(0.52 * l, w * l * 0.9), Y(0.52 * l, w * l * 0.9), X(0, 0), Y(0, 0));
      P.closePath();
    }
    function leafHole(P, x, y, a, l, w) {
      const ca = Math.cos(a), sa = Math.sin(a);
      const X = (u, v) => (x + u * ca - v * sa) * K, Y = (u, v) => (y + u * sa + v * ca) * K;
      const th = Math.min(0.42, 0.55 / (w * l));
      P.moveTo(X(0.13 * l, 0), Y(0.13 * l, 0));
      P.quadraticCurveTo(X(0.52 * l, w * l * 0.9 * (1 - th)), Y(0.52 * l, w * l * 0.9 * (1 - th)), X(0.86 * l, 0), Y(0.86 * l, 0));
      P.quadraticCurveTo(X(0.42 * l, -w * l * (1 - th)), Y(0.42 * l, -w * l * (1 - th)), X(0.13 * l, 0), Y(0.13 * l, 0));
      P.closePath();
    }
    function leafRib(P, x, y, a, l) {
      const ca = Math.cos(a), sa = Math.sin(a);
      const X = (u, v) => (x + u * ca - v * sa) * K, Y = (u, v) => (y + u * sa + v * ca) * K;
      P.moveTo(X(0.06 * l, -0.11), Y(0.06 * l, -0.11)); P.lineTo(X(0.82 * l, -0.03), Y(0.82 * l, -0.03));
      P.lineTo(X(0.82 * l, 0.03), Y(0.82 * l, 0.03)); P.lineTo(X(0.06 * l, 0.11), Y(0.06 * l, 0.11)); P.closePath();
    }
    // a group of leaves, drawn with occlusion: cut the paper clean, then ink
    function Foliage() {
      return { er: new Path2D(), ring: [new Path2D(), new Path2D(), new Path2D(), new Path2D()], body: [new Path2D(), new Path2D()], rib: new Path2D(), glint: new Path2D(),
        sb: new Path2D(), sr: new Path2D(), edge: new Path2D(), n: 0, depth: 1 };
    }
    function addLeaf(G, x, y, a, l, w, Lv, mode) {
      if (!G.free && (y < PY0 - 6 || y > PY1 || x < PX0 - 6 || x > PX1 + 6)) return;
      let gv = 9;
      if (mode === 'lit' && G.gaps !== false) { gv = gapVal(x, y); if (gv < 0) return; }
      leafShape(G.er, x, y, a, l, w);
      if (mode === 'dark') { if (Lv > 0.25) { leafShape(G.ring[0], x, y, a, l, w); leafHole(G.ring[0], x, y, a, l, w); } G.n++; return; }
      const v = Lv * 1.75 * G.depth + 0.01 + rr(-0.1, 0.1);
      if (gv < 0.5) { leafShape(G.er, x, y, a, l, w); leafShape(G.edge, x, y, a, l, w); leafHole(G.edge, x, y, a, l, w); leafRib(G.edge, x, y, a, l); G.n++; return; }
      if (v > 0.2 && R() < 0.1 + 0.18 * Math.min(1, v)) { leafShape(G.sb, x, y, a, l, w); leafShape(G.sr, x, y, a, l, w); leafHole(G.sr, x, y, a, l, w); leafRib(G.rib, x, y, a, l); G.n++; return; }
      if (v < 0.15) { leafShape(G.ring[0], x, y, a, l, w); }
      else if (v < 0.34) { leafShape(G.ring[1], x, y, a, l, w); leafHole(G.ring[1], x, y, a, l, w); if (chance(0.5)) leafRib(G.ring[1], x, y, a, l); }
      else if (v < 0.62) { leafShape(G.body[0], x, y, a, l, w); leafShape(G.ring[2], x, y, a, l, w); leafHole(G.ring[2], x, y, a, l, w); leafRib(G.rib, x, y, a, l); }
      else { leafShape(G.body[1], x, y, a, l, w); leafShape(G.ring[3], x, y, a, l, w); leafHole(G.ring[3], x, y, a, l, w); leafRib(G.rib, x, y, a, l); if (v > 0.95 && chance(0.25)) dot(G.glint, x + Math.cos(a) * l * 0.4, y + Math.sin(a) * l * 0.4, 0.32); }
      G.n++;
    }
    function flushFoliage(G, A, mode) {
      if (!G.n) return;
      erase(G.er);
      if (mode === 'dark') { fill(G.ring[0], INK.goldDeep, 0.3 * A, 'g', 0.2); return; }
      fill(G.ring[0], INK.goldDeep, 0.3 * A, 'g', 0.2);
      fill(G.ring[1], INK.gold, 0.78 * A, 'g', 0.6);
      fill(G.body[0], INK.gold, 0.4 * A, 'g', 0.45);
      fill(G.ring[2], INK.gold, 0.95 * A, 'g', 0.8);
      fill(G.body[1], INK.goldHi, 0.82 * A, 'g', 0.85);
      fill(G.ring[3], INK.goldHi, 1 * A, 'g', 1);
      fill(G.sb, INK.silver, 0.42 * A, 's', 0.5);
      fill(G.sr, INK.silverHi, 0.95 * A, 's', 0.9);
      fill(G.edge, INK.goldHi, 0.95 * A, 'g', 0.9);
      erase(G.rib, 0.85);
      fill(G.glint, INK.white, 0.85 * A, 'p', 0.6);
    }
    function spray(G, x, y, a, L, sc, mode, A) {
      if (mode !== 'dark' && G.gaps !== false && inGap(x + Math.cos(a) * L * 0.5, y + Math.sin(a) * L * 0.5)) return;
      // a twig with alternate leaves, drooping a little
      const n = Math.round(rr(5, 9));
      const bend = rr(-0.25, 0.25);
      const pts = [];
      let px = x, py = y, ang = a;
      const steps = 6;
      pts.push(px, py);
      for (let i = 1; i <= steps; i++) { ang += bend / steps + 0.05 * (Math.sin(ang) < 0.9 ? 1 : 0) * 0.3; px += Math.cos(ang) * L / steps; py += Math.sin(ang) * L / steps + 0.25; pts.push(px, py); }
      const Lv = light(x + Math.cos(a) * L * 0.5, y + Math.sin(a) * L * 0.5);
      if (mode !== 'dark') stroke(gold.get(clamp((0.3 + 0.6 * Lv) * A, 0, 1)), pts, 0.26 * sc, 0.05, 0.6);
      else stroke(sil.get(0.12), pts, 0.26 * sc, 0.05, 0.6);
      for (let i = 0; i < n; i++) {
        const t = (i + 1) / (n + 0.6), k = Math.min(steps - 1, Math.floor(t * steps));
        const f = t * steps - k;
        const lx = lerp(pts[2 * k], pts[2 * k + 2], f), ly = lerp(pts[2 * k + 1], pts[2 * k + 3], f);
        const ta = Math.atan2(pts[2 * k + 3] - pts[2 * k + 1], pts[2 * k + 2] - pts[2 * k]);
        const side = i % 2 ? 1 : -1;
        let la = ta + side * rr(0.55, 1.05);
        la += (Math.PI / 2 - la) * 0.12 * (Math.cos(la - Math.PI / 2) < 0.95 ? 1 : 0); // a little droop
        const l = rr(6.2, 9.2) * sc * (1 - 0.22 * t);
        addLeaf(G, lx, ly, la, l, rr(0.3, 0.4), light(lx, ly), mode);
      }
      addLeaf(G, px, py, ang + rr(-0.2, 0.2), rr(7, 9.5) * sc, 0.34, light(px, py), mode);
    }
    function* drawBough(T, limb, mode) {
      const A = tierA[T.tier] * (mode === 'dark' ? 1 : 1);
      const sc = [0.62, 0.75, 0.95, 1, 1.25][T.tier];
      // the limb body
      const body = (pts, hw, lineW, hatch) => {
        const P = new Path2D(); ribbon(P, pts, hw); erase(P);
        const n = pts.length >> 1;
        const lower = [], upper = [];
        for (let i = 0; i < n; i++) {
          const i0 = Math.max(0, i - 1), i1 = Math.min(n - 1, i + 1);
          let tx = pts[2 * i1] - pts[2 * i0], ty = pts[2 * i1 + 1] - pts[2 * i0 + 1];
          const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
          let nx = -ty, ny = tx; if (ny < 0) { nx = -nx; ny = -ny; }
          lower.push(pts[2 * i] + nx * hw[i] * 0.95, pts[2 * i + 1] + ny * hw[i] * 0.95);
          upper.push(pts[2 * i] - nx * hw[i] * 0.95, pts[2 * i + 1] - ny * hw[i] * 0.95);
        }
        const Lv = light(pts[n], pts[n + 1]);
        if (mode === 'dark') {
          stroke(silHi.get(clamp(0.25 + Lv * 0.6, 0, 0.8)), lower, lineW * 0.45, 0.02, 0.3);
          for (let i = 2; i < n - 1; i += 2) if (R() < 0.5) { const lx = lower[2 * i], ly = lower[2 * i + 1]; line(sil.get(0.3), lx, ly, lerp(lx, upper[2 * i], 0.3), lerp(ly, upper[2 * i + 1], 0.3), 0.16, 0.3, 0.1, 0.5); }
          return;
        }
        stroke(silHi.get(clamp((0.5 + 0.5 * Lv) * A, 0, 1)), lower, lineW, 0.03, 0.3);
        stroke(sil.get(clamp((0.3 + 0.4 * Lv) * A, 0, 1)), upper, lineW * 0.65, 0.03, 0.3);
        if (hatch && hw[0] > 3) {
          for (const f of [0.72, 0.5, 0.28]) {
            const ln = [];
            for (let i = 0; i < n; i++) ln.push(lerp(pts[2 * i], lower[2 * i], f), lerp(pts[2 * i + 1], lower[2 * i + 1], f));
            stroke(sil.get(clamp((0.25 + 0.6 * Lv) * A * (1.2 - f * 0.6), 0, 1)), ln, lineW * 0.45, 0.15, 0.5);
          }
        }
        if (hatch) {
          for (let i = 1; i < n - 1; i++) {
            const lx = lower[2 * i], ly = lower[2 * i + 1], Lh = light(lx, ly);
            if (R() > 0.3 + Lh) continue;
            const ux = upper[2 * i], uy = upper[2 * i + 1];
            const f = clamp(0.25 + Lh * 0.5, 0.2, 0.75) * rr(0.6, 1);
            for (let s = 0; s < 2; s++) {
              const o = s * 0.5 + rr(-0.15, 0.15);
              const bx = lerp(lx, lower[2 * i + 2], o), by = lerp(ly, lower[2 * i + 3], o);
              line(sil.get(clamp((0.35 + 0.5 * Lh) * A, 0, 1)), bx, by, bx + (ux - lx) * f, by + (uy - ly) * f, 0.22, rr(-0.6, 0.6), 0.1, 0.5);
            }
          }
        }
      };
      body(limb.pts, limb.hw, 0.7, true);
      let G = Foliage(); G.depth = rr(0.3, 1.25);
      for (const S of limb.subs) {
        body(S.pts, S.hw, 0.42, S.hw[0] > 2);
        for (const tw of S.twigs) {
          const ex = tw.x + Math.cos(tw.a) * tw.L, ey = tw.y + Math.sin(tw.a) * tw.L;
          if (ey < PY0 - 30 || ex < PX0 - 30 || ex > PX1 + 30) continue;
          stroke(sil.get(clamp((mode === 'dark' ? 0.12 : 0.4) * A, 0, 1)), quad(tw.x, tw.y, (tw.x + ex) / 2, (tw.y + ey) / 2 - 1.5, ex, ey, 5), 0.3 * sc, 0.05, 0.6);
          const nsp = Math.round(rr(1.4, 2.6));
          for (let k = 0; k < nsp; k++) {
            const t = k === 0 ? 1 : rr(0.35, 0.85);
            const sx = lerp(tw.x, ex, t), sy = lerp(tw.y, ey, t);
            const sa = tw.a + (k === 0 ? rr(-0.3, 0.3) : (k % 2 ? 1 : -1) * rr(0.5, 1.0));
            spray(G, sx, sy, sa, rr(18, 30) * sc, sc, mode, A);
          }
        }
        flushFoliage(G, A, mode); G = Foliage(); G.depth = Math.pow(R(), 0.8) * 1.0 + 0.25;
        sil.flush(); silHi.flush();
        yield;
      }
    }

    /* ---- stairs that wind round the trunk */
    function* drawStair(T, S) {
      const A = tierA[T.tier];
      const steps = Math.max(8, Math.round(S.turns * 30));
      const pos = (u, rad, lift) => {
        const y = lerp(S.y0, S.y1, stairU(S, u)), ph = S.ph0 + S.dir * S.turns * TAU * u;
        const rr0 = T.r(y) + rad * T.f(y) * (1 + 0.22 * Math.sin(TAU * u * 1.3 + S.wp)), e = ell(y);
        return [T.cx(y) + rr0 * Math.sin(ph), y - e * rr0 * Math.cos(ph) - lift, ph, y];
      };
      const sw = S.sw, railH = 8.5, st = 2.4;
      const vis = (u, rad) => { const p = pos(u, rad, 0); const y = p[3]; return Math.cos(p[2]) > -0.02 || Math.abs(p[0] - T.cx(y)) > T.r(y) + 0.5; };
      const front = (u) => Math.cos(pos(u, sw, 0)[2]) > -0.02;
      // walk the helix in runs of visible steps
      let u = 0;
      const du = 1 / steps;
      const runs = [];
      let cur = null;
      for (let i = 0; i <= steps; i++) {
        const uu = i * du;
        const f = front(uu), v = vis(uu, sw);
        const kind = f ? 'f' : v ? 'b' : null;
        if (kind && cur && cur.kind === kind) cur.u1 = uu;
        else { if (cur) runs.push(cur); cur = kind ? { kind, u0: uu, u1: uu } : null; }
      }
      if (cur) runs.push(cur);
      for (const run of runs) {
        if (run.u1 - run.u0 < du * 0.9) continue;
        const n = Math.max(2, Math.round((run.u1 - run.u0) / du * 2));
        const inner = [], outer = [], outTop = [], rail = [];
        for (let k = 0; k <= n; k++) {
          const uu = lerp(run.u0, run.u1, k / n);
          const pi = pos(uu, 0, 0), po = pos(uu, sw, 0), pt = pos(uu, sw, st), pr = pos(uu, sw - 1, st + railH);
          inner.push(pi[0], pi[1]); outer.push(po[0], po[1]); outTop.push(pt[0], pt[1]); rail.push(pr[0], pr[1]);
        }
        if (run.kind === 'f') {
          // cut out the underside of the flight, the stringer and the rail
          const xs = [], ys = [];
          for (let k = 0; k <= n; k++) { xs.push(inner[2 * k]); ys.push(inner[2 * k + 1]); }
          for (let k = n; k >= 0; k--) { xs.push(rail[2 * k]); ys.push(rail[2 * k + 1] - 0.6); }
          const P = new Path2D(); poly(P, xs, ys, xs.length); erase(P, 0.92);
          // the soffit: risers seen from below
          const Lm = light((inner[0] + outer[2 * n]) / 2, (inner[1] + outer[2 * n + 1]) / 2);
          const sx = [], sy = [];
          for (let k = 0; k <= n; k++) { sx.push(inner[2 * k]); sy.push(inner[2 * k + 1]); }
          for (let k = n; k >= 0; k--) { sx.push(outer[2 * k]); sy.push(outer[2 * k + 1]); }
          const Sf = new Path2D(); poly(Sf, sx, sy, sx.length); fill(Sf, INK.silver, (0.07 + 0.12 * Lm) * A, 's', 0.1);
          for (let k = 0; k <= n; k += 2) line(sil.get(clamp((0.35 + 0.45 * light(outer[2 * k], outer[2 * k + 1])) * A, 0, 1)), inner[2 * k], inner[2 * k + 1], outer[2 * k], outer[2 * k + 1], 0.24, 0, 0.1, 0.2);
          // stringer: white, with a run of carved dots
          const sxs = [], sys = [];
          for (let k = 0; k <= n; k++) { sxs.push(outer[2 * k]); sys.push(outer[2 * k + 1]); }
          for (let k = n; k >= 0; k--) { sxs.push(outTop[2 * k]); sys.push(outTop[2 * k + 1]); }
          const St = new Path2D(); poly(St, sxs, sys, sxs.length); fill(St, INK.white, 0.8 * A, 'p', 0.8);
          for (let k = 1; k < n; k += 2) dot(sil.get(0.8 * A), (outer[2 * k] + outTop[2 * k]) / 2, (outer[2 * k + 1] + outTop[2 * k + 1]) / 2, 0.32);
          for (let k = 0; k < n; k += 2) {
            const x0 = outTop[2 * k], y0 = outTop[2 * k + 1], x1 = outTop[2 * k + 2], y1 = outTop[2 * k + 3];
            const up = S.y1 < S.y0 ? -2.0 : 2.0;
            stroke(white.get(0.95 * A), [x0, y0, x0, y0 + up, x1, y1 + up * 0.15], 0.24, 0.02, 0.02);
          }
          // balusters and the handrail
          for (let k = 0; k <= n; k += 2) {
            const bx = outTop[2 * k], by = outTop[2 * k + 1];
            line(white.get(0.85 * A), bx, by, rail[2 * k], rail[2 * k + 1], k % 8 === 0 ? 0.45 : 0.22, 0, 0.05, 0.05);
          }
          stroke(white.get(0.95 * A), rail, 0.55, 0.02, 0.02);
        } else {
          // the far side, glimpsed past the trunk: only the rail and stringer
          stroke(white.get(0.5 * A), rail, 0.35, 0.05, 0.05);
          stroke(white.get(0.4 * A), outer, 0.5, 0.05, 0.05);
          for (let k = 0; k <= n; k += 3) line(white.get(0.35 * A), outTop[2 * k], outTop[2 * k + 1], rail[2 * k], rail[2 * k + 1], 0.18, 0, 0.05, 0.05);
        }
        yield;
      }
      white.flush(); sil.flush();
    }
    function drawLadder(T, Ld) {
      const A = tierA[T.tier];
      const y0 = Ld.y0, y1 = Ld.y1;
      const th = Ld.side;
      const px = (y, dx) => T.cx(y) + (T.r(y) + 3.5 * T.f(y)) * Math.sin(th) + dx * Math.cos(th);
      const pyy = (y) => y - ell(y) * (T.r(y) + 3.5) * Math.cos(th);
      const wd = 3.2 * T.f(y0) * (T.tier >= 2 ? 1 : 0.7);
      const B = white.get(0.85 * A);
      for (const s of [-1, 1]) {
        const pts = []; for (let k = 0; k <= 10; k++) { const y = lerp(y0, y1, k / 10); pts.push(px(y, s * wd), pyy(y)); }
        stroke(B, pts, 0.42, 0.02, 0.02);
      }
      for (let y = y0 - 3; y > y1 + 2; y -= 4.6) line(white.get(0.7 * A), px(y, -wd), pyy(y), px(y, wd), pyy(y) - 0.4, 0.26, 0, 0.1, 0.1);
      white.flush();
    }

    /* ---- the flets: wooden decks resting in the forks, seen from beneath */
    function clipErase(clipP, P, rule) {
      C.save(); M.save(); C.clip(clipP); M.clip(clipP); erase(P, 1, rule); C.restore(); M.restore();
    }
    function* drawFlet(T, F) {
      const A = tierA[T.tier];
      const { y, r, e, t, tcx } = F;
      const railH = (F.isHall ? 9 : 8) * clamp(T.f(y), 0.7, 1) * (T.tier < 2 ? 0.8 : 1);
      const nO = 84;
      const outer = [];
      for (let k = 0; k <= nO; k++) { const ph = lerp(F.pa, F.pb, k / nO), ro = fletRo(F, ph), p = fletP(F, ph, ro); outer.push({ ph, ro, x: p[0], y: p[1] }); }
      const hidden = (x, yy) => Math.abs(x - tcx) < r && yy > y - e * r * Math.cos(Math.asin(clamp((x - tcx) / r, -1, 1)));
      // the underside, cut clean except where the trunk stands in front of it
      {
        const xs = [], ys = [];
        for (const o of outer) { xs.push(o.x); ys.push(o.y); }
        for (let k = 24; k >= 0; k--) { const p = fletP(F, lerp(F.pa, F.pb, k / 24), r * 0.97); xs.push(p[0]); ys.push(p[1]); }
        const U = new Path2D(); poly(U, xs, ys, xs.length);
        const Ex = new Path2D(); Ex.rect(-50, -50, (DW + 100) * K, (DH + 100) * K);
        const cx_ = [], cy_ = [];
        for (let k = 0; k <= 16; k++) { const q = -Math.PI / 2 + Math.PI * k / 16; cx_.push(tcx + r * Math.sin(q)); cy_.push(y - e * r * Math.cos(q)); }
        cx_.push(tcx + r, tcx - r); cy_.push(y + 900, y + 900);
        poly(Ex, cx_, cy_, cx_.length);
        clipErase(U, Ex, 'evenodd');
      }
      // the visible front edge, in runs
      const runs = []; let cur = null;
      for (const o of outer) {
        const v = Math.cos(o.ph) > -0.35 && !hidden(o.x, o.y);
        if (v) (cur || (cur = [])).push(o); else if (cur) { runs.push(cur); cur = null; }
      }
      if (cur) runs.push(cur);
      const Lu = light(tcx, y + 10);
      // joists radiating from the trunk, and beams that follow the outline
      const nj = F.isHall ? -1 : Math.max(4, Math.round((F.pb - F.pa) * F.R / 10));
      for (let j = 0; j <= nj; j++) {
        const q = lerp(F.pa, F.pb, (j + 0.5) / (nj + 1)), ro = fletRo(F, q);
        let pts = [];
        const fl = () => { if (pts.length >= 4) stroke(sil.get(clamp((0.25 + 0.6 * Lu) * A, 0, 1)), pts, 0.3, 0.1, 0.05); pts = []; };
        for (let k = 0; k <= 8; k++) { const p = fletP(F, q, lerp(r, ro * 0.97, k / 8)); if (hidden(p[0], p[1])) fl(); else pts.push(p[0], p[1]); }
        fl();
      }
      for (const f of (F.isHall ? [0.7] : [0.48, 0.76])) {
        let pts = [];
        const fl = () => { if (pts.length >= 4) stroke(sil.get(clamp((0.2 + 0.5 * Lu) * A, 0, 1)), pts, 0.24, 0.1, 0.1); pts = []; };
        for (let k = 1; k < 48; k++) { const q = lerp(F.pa, F.pb, k / 48), p = fletP(F, q, lerp(r, fletRo(F, q), f)); if (hidden(p[0], p[1])) fl(); else pts.push(p[0], p[1]); }
        fl();
      }
      {
        let pts = [];
        const fl = () => { if (pts.length >= 4) stroke(sil.get(clamp((0.25 + 0.4 * Lu) * A, 0, 1)), pts, 0.3, 0.05, 0.05); pts = []; };
        for (const o of outer) { if (hidden(o.x, o.y)) fl(); else pts.push(o.x, o.y); }
        fl();
      }
      // carved brackets from the trunk below, curling at the foot
      if (T.tier >= 1 && !F.isHall) {
        const qa = Math.max(F.pa + 0.35, -1.2), qb = Math.min(F.pb - 0.35, 1.2);
        const nb = T.tier >= 2 ? 3 : 2;
        if (qb > qa) for (let b = 0; b < nb; b++) {
          const q = lerp(qa, qb, (b + 0.5) / nb) + J(0.1);
          const yb = y + 12 + F.R * 0.3;
          const x0 = T.cx(yb) + T.r(yb) * Math.sin(q), y0 = yb - ell(yb) * T.r(yb) * Math.cos(q);
          const [x1, y1] = fletP(F, q, lerp(r, fletRo(F, q), 0.62));
          const pts = quad(x0, y0, x0 + (x1 - x0) * 0.1, y1 + (y0 - y1) * 0.25, x1, y1, 10);
          const Pk = new Path2D(); stroke(Pk, pts, 1.5, 0.05, 0.05); erase(Pk);
          stroke(silHi.get(clamp((0.5 + 0.5 * Lu) * A, 0, 1)), pts, 0.4, 0.05, 0.05);
          const vr = 2.2 * T.f(y), vs = [];
          for (let k = 0; k <= 18; k++) { const a = k / 18 * 5.2, rad = vr * (1 - k / 22); vs.push(x0 + Math.sin(q) * vr + rad * Math.cos(a + 1.6), y0 + rad * Math.sin(a + 1.6) - vr * 0.2); }
          stroke(silHi.get(clamp((0.45 + 0.5 * Lu) * A, 0, 1)), vs, 0.3, 0.1, 0.4);
        }
      }
      // the rim: a lit face carved with a running scroll
      for (const run of runs) {
        if (run.length < 3) continue;
        const top = [], bot = [], xs = [], ys = [];
        for (const o of run) { bot.push(o.x, o.y); top.push(o.x, o.y - t); xs.push(o.x); ys.push(o.y - t - railH * 0.12); }
        for (let k = run.length - 1; k >= 0; k--) { xs.push(run[k].x); ys.push(run[k].y + 0.3); }
        const Bd = new Path2D(); poly(Bd, xs, ys, xs.length); erase(Bd);
        const Lr = light(run[run.length >> 1].x, run[run.length >> 1].y);
        fill(Bd, INK.silver, (0.05 + 0.08 * Lr) * A, 's', 0.15);
        stroke(sil.get(clamp((0.35 + 0.4 * Lr) * A, 0, 1)), bot.map((v, k) => (k % 2 ? v - t * 0.5 : v)), 0.16, 0.05, 0.05);
        stroke(silHi.get(clamp((0.6 + 0.4 * Lr) * A, 0, 1)), bot, 0.5, 0.04, 0.04);
        stroke(sil.get(clamp((0.55 + 0.4 * Lr) * A, 0, 1)), top, 0.38, 0.04, 0.04);
        if (T.tier >= 2 && t > 2.6) {
          let acc = 0;
          for (let k = 1; k < run.length; k++) {
            const a = run[k - 1], b = run[k]; acc += Math.hypot(b.x - a.x, b.y - a.y);
            if (acc < 5.5) continue; acc = 0;
            const c = clamp(Math.abs(b.x - a.x) / (Math.hypot(b.x - a.x, b.y - a.y) || 1), 0.2, 1);
            const mx = b.x, my = b.y - t * 0.5, hx = 1.7 * c, hy = t * 0.28;
            const Bm = silHi.get(clamp((0.5 + 0.5 * light(mx, my)) * A, 0, 1));
            stroke(Bm, [mx - hx, my + hy, mx - hx * 0.4, my - hy, mx + hx * 0.3, my + hy * 0.6, mx + hx, my - hy], 0.17, 0.2, 0.2);
            dot(Bm, mx + hx * 1.35, my, 0.22);
          }
        }
      }
      sil.flush(); silHi.flush();
      yield;
      for (const H of F.houses) drawHouse(T, F, H);
      // the rail: a handrail over a row of leaf-shaped panels, with carved posts
      for (const run of runs) {
        if (run.length < 3) continue;
        const hr = [], lr = [];
        for (const o of run) { hr.push(o.x, o.y - t - railH); lr.push(o.x, o.y - t - 0.9); }
        const fA = (o) => clamp(A * (0.55 + 0.45 * Math.max(0, Math.cos(o.ph))), 0, 1);
        stroke(white.get(0.92 * A), hr, 0.46, 0.04, 0.04);
        stroke(white.get(0.7 * A), lr, 0.26, 0.04, 0.04);
        let acc = 3, post = 0;
        const Lf = new Path2D();
        for (let k = 1; k < run.length; k++) {
          const a = run[k - 1], b = run[k]; acc += Math.hypot(b.x - a.x, b.y - a.y);
          if (acc < 4.4) continue; acc = 0; post++;
          const yb = b.y - t - 0.9;
          if (post % 5 === 0) {
            line(white.get(fA(b)), b.x, yb + 0.6, b.x, yb - railH * 1.35, 0.42, 0, 0.03, 0.03);
            dot(goldHi.get(fA(b)), b.x, yb - railH * 1.4, 0.55);
            stroke(goldHi.get(fA(b)), quad(b.x - 1.1, yb - railH * 1.05, b.x, yb - railH * 1.25, b.x + 1.1, yb - railH * 1.05, 4), 0.16, 0.2, 0.2);
          } else {
            const l = railH * 0.82;
            leafShape(Lf, b.x, yb - railH * 0.06, -Math.PI / 2 + J(0.06), l, 0.3);
            leafHole(Lf, b.x, yb - railH * 0.06, -Math.PI / 2 + J(0.06), l, 0.3);
          }
        }
        fill(Lf, INK.white, 0.82 * A, 'p', 0.7);
      }
      white.flush(); silHi.flush(); sil.flush(); gold.flush(); goldHi.flush();
      if (F.isHall) { yield* drawHall(T, F); cradle(T, F); }
    }
    // the crown of boughs that holds the hall: limbs from the trunk below sweeping out under the
    // floor and up past its edge, like fingers round a cup
    function cradle(T, F) {
      const qs = [-1.45, -1.05, -0.35, 0.3, 1.0, 1.42];
      for (const q0 of qs) {
        const q = q0 + J(0.06), side = Math.abs(q0) > 0.8;
        const yb = F.y + rr(44, 62), rb = T.r(yb);
        const x0 = T.cx(yb) + rb * Math.sin(q) * 0.95, y0 = yb - ell(yb) * rb * Math.cos(q);
        const ro = fletRo(F, q);
        const sg = Math.sign(Math.sin(q));
        const [xm0, ym0] = fletP(F, q, ro * (side ? 1.25 : 0.8), side ? -10 : -4);
        const xm = xm0 + sg * (side ? 14 : 0), ym = ym0;
        const [x10, y10] = side ? fletP(F, q, ro * 1.5, rr(30, 46)) : fletP(F, q, ro * 0.98, -1);
        const x1 = x10 + sg * (side ? 16 : 0), y1 = y10;
        const pts = [];
        for (let k = 0; k <= 24; k++) {
          const t = k / 24, u = 1 - t;
          pts.push(u * u * x0 + 2 * u * t * xm + t * t * x1, u * u * y0 + 2 * u * t * (ym + 6) + t * t * y1);
        }
        const hws = []; for (let k = 0; k <= 24; k++) hws.push(lerp(4.2, side ? 1.1 : 1.6, Math.pow(k / 24, 0.7)) * (0.65 + 0.35 * Math.abs(Math.cos(q))));
        const P = new Path2D(); ribbon(P, pts, hws); erase(P);
        const L = light(xm, ym);
        const n = pts.length >> 1, lo = [], up = [], mid = [];
        for (let k = 0; k < n; k++) {
          const i0 = Math.max(0, k - 1), i1 = Math.min(n - 1, k + 1);
          let tx = pts[2 * i1] - pts[2 * i0], ty = pts[2 * i1 + 1] - pts[2 * i0 + 1]; const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
          let nx = -ty, ny = tx; if (ny < 0) { nx = -nx; ny = -ny; }
          lo.push(pts[2 * k] + nx * hws[k] * 0.9, pts[2 * k + 1] + ny * hws[k] * 0.9);
          up.push(pts[2 * k] - nx * hws[k] * 0.9, pts[2 * k + 1] - ny * hws[k] * 0.9);
          mid.push(pts[2 * k] + nx * hws[k] * 0.35, pts[2 * k + 1] + ny * hws[k] * 0.35);
        }
        stroke(silHi.get(clamp(0.6 + 0.4 * L, 0, 1)), lo, 0.5, 0.03, 0.3);
        stroke(sil.get(clamp(0.4 + 0.4 * L, 0, 1)), up, 0.32, 0.03, 0.3);
        stroke(sil.get(clamp(0.35 + 0.5 * L, 0, 1)), mid, 0.22, 0.2, 0.4);
        // a spray at the tip, lit by the hall
        if (side) {
          const G = Foliage(); G.gaps = false;
          for (let k = 0; k < 4; k++) spray(G, x1 + rr(-4, 4), y1 + rr(-4, 4), -Math.PI / 2 + sg * rr(0.2, 1.3), rr(20, 30), 1, 'lit', 1);
          flushFoliage(G, 1, 'lit');
        }
      }
      sil.flush(); silHi.flush(); gold.flush();
    }

    function drawHouse(T, F, H) {
      const A = tierA[T.tier];
      const { y, r, e, t, tcx } = F;
      const phi = H.phi, dOut = fletRo(F, phi);
      const rho = (r + dOut) / 2 + 1;
      const hx = tcx + rho * Math.sin(phi), hb = y - e * rho * Math.cos(phi) - t;
      const hw = Math.max(5, (dOut - r) * 0.4 * (0.75 + 0.25 * Math.cos(phi)));
      const wallH = hw * rr(1.1, 1.45), roofH = hw * rr(1.2, 1.5);
      const top = hb - wallH;
      // the roof: folded golden leaves, a tall one in the middle and two leaning in to it
      const petals = [];
      for (const [da, lf, dx] of [[-1.15, 0.62, -0.75], [1.15, 0.62, 0.75], [-0.62, 0.8, -0.4], [0.62, 0.8, 0.4], [0, 0.9, 0]]) petals.push([hx + dx * hw, top + 1.2, -Math.PI / 2 + da + J(0.05), roofH * lf * 0.85, 0.4]);
      const P = new Path2D(); poly(P, [hx - hw, hx + hw, hx + hw * 0.92, hx - hw * 0.92], [hb + 2, hb + 2, top, top], 4);
      for (const [x, yy, a, l, w] of petals) leafShape(P, x - Math.cos(a) * l * 0.12, yy - Math.sin(a) * l * 0.12, a, l, w);
      erase(P);
      const Lh = light(hx, top + wallH * 0.5);
      // walls of pale wood: fine vertical lines, two slender corner posts
      for (let k = 0; k <= 12; k++) {
        const u = k / 12, x = lerp(hx - hw * 0.96, hx + hw * 0.96, u), c = Math.cos((u - 0.5) * Math.PI);
        if (R() > 0.35 + 0.6 * c) continue;
        line(sil.get(clamp((0.3 + 0.5 * Lh * c) * A, 0, 1)), x, hb + 1, lerp(x, hx, 0.08), top + 1, 0.18, 0, 0.1, 0.1);
      }
      stroke(silHi.get(0.85 * A), [hx - hw, hb + 1, hx - hw * 0.92, top], 0.34, 0.02, 0.02);
      stroke(silHi.get(0.85 * A), [hx + hw, hb + 1, hx + hw * 0.92, top], 0.34, 0.02, 0.02);
      // a doorway of warm light under a pointed leaf arch
      {
        const ww = hw * 0.36, wy0 = hb + 0.5, wy1 = hb - wallH * 0.62, ap = hb - wallH * 0.95;
        const Wp = new Path2D();
        Wp.moveTo((hx - ww) * K, wy0 * K); Wp.lineTo((hx - ww) * K, wy1 * K);
        Wp.bezierCurveTo((hx - ww) * K, (wy1 - (wy1 - ap) * 0.6) * K, (hx - ww * 0.15) * K, (ap + (wy1 - ap) * 0.2) * K, hx * K, ap * K);
        Wp.bezierCurveTo((hx + ww * 0.15) * K, (ap + (wy1 - ap) * 0.2) * K, (hx + ww) * K, (wy1 - (wy1 - ap) * 0.6) * K, (hx + ww) * K, wy1 * K);
        Wp.lineTo((hx + ww) * K, wy0 * K); Wp.closePath();
        const g = C.createRadialGradient(hx * K, wy0 * K, 0, hx * K, wy0 * K, (wy0 - ap) * 1.1 * K);
        const c0 = H.col === 'g' ? '210,250,220' : '255,240,205', c1 = H.col === 'g' ? '150,226,180' : '255,206,130';
        g.addColorStop(0, `rgba(${c0},1)`); g.addColorStop(1, `rgba(${c1},0.75)`);
        C.globalAlpha = 0.95 * A; C.fillStyle = g; C.fill(Wp); M.globalAlpha = 1; M.fillStyle = '#000'; M.fill(Wp);
        stroke(gold.get(0.9 * A), [hx - ww - 0.5, wy0, hx - ww - 0.5, wy1, hx - ww * 0.5, ap + (wy1 - ap) * 0.45, hx, ap - 0.6, hx + ww * 0.5, ap + (wy1 - ap) * 0.45, hx + ww + 0.5, wy1, hx + ww + 0.5, wy0], 0.22, 0.02, 0.02);
      }
      for (const [x, yy, a, l, w] of petals) {
        const bx = x - Math.cos(a) * l * 0.12, by = yy - Math.sin(a) * l * 0.12;
        const B = new Path2D(); leafShape(B, bx, by, a, l, w); fill(B, INK.gold, (0.3 + 0.35 * Lh) * A, 'g', 0.6);
        const Rg = new Path2D(); leafShape(Rg, bx, by, a, l, w); leafHole(Rg, bx, by, a, l, w); fill(Rg, INK.goldHi, 0.95 * A, 'g', 1);
        const Rb = new Path2D(); leafRib(Rb, bx, by, a, l); erase(Rb, 0.6);
        for (let v = 1; v <= 4; v++) {
          const f = v / 5.4, mx = bx + Math.cos(a) * l * f, my = by + Math.sin(a) * l * f, sp = l * w * 0.55 * Math.sin(Math.PI * Math.min(1, f + 0.1));
          for (const sd of [-1, 1]) line(goldHi.get(0.6 * A), mx, my, mx + Math.cos(a + sd * 0.8) * sp, my + Math.sin(a + sd * 0.8) * sp, 0.1, 0, 0.1, 0.5);
        }
      }
      stroke(goldHi.get(0.95 * A), [hx - hw * 1.08, top + 1, hx + hw * 1.08, top + 1], 0.4, 0.02, 0.02);
      sil.flush(); silHi.flush(); gold.flush(); goldHi.flush();
    }

    /* ---- the hall of Celeborn and Galadriel: a pavilion of slender pillars and pointed leaf arches
       round the living trunk, under a roof of folded golden leaves, warm light spilling out */
    function* drawHall(T, F) {
      const { y, r, t } = F;
      const Rd = r * 1.5, H = 54, HR = 46;
      const base = y - t;
      const at = (q, h, rad) => { const yy = base - h; return [T.cx(yy) + rad * Math.sin(q), yy - ell(yy) * rad * Math.cos(q)]; };
      const rTop = T.r(base - H - HR) * 1.06;
      const roofPt = (q, u) => at(q * (1 - u * 0.06), H + HR * Math.pow(u, 1.7), lerp(Rd * 1.18, rTop, u));
      // warm light spilling into the crown
      {
        const [gx, gy] = at(0, 26, Rd);
        const RG = C.createRadialGradient(gx * K, gy * K, 0, gx * K, gy * K, Rd * 2.8 * K);
        RG.addColorStop(0, 'rgba(255,222,160,0.30)'); RG.addColorStop(0.35, 'rgba(255,200,120,0.10)'); RG.addColorStop(1, 'rgba(255,200,120,0)');
        C.globalAlpha = 1; C.fillStyle = RG; C.beginPath(); C.arc(gx * K, gy * K, Rd * 2.8 * K, 0, TAU); C.fill();
      }
      // silhouette of the colonnade and its roof
      {
        const xs = [], ys = [];
        for (let k = 0; k <= 40; k++) { const p = at(-Math.PI / 2 + Math.PI * k / 40, 0, Rd); xs.push(p[0]); ys.push(p[1] + 1); }
        for (let k = 0; k <= 12; k++) { const p = roofPt(Math.PI / 2, k / 12); xs.push(p[0]); ys.push(p[1]); }
        for (let k = 0; k <= 20; k++) { const p = roofPt(Math.PI / 2 - Math.PI * k / 20, 1); xs.push(p[0]); ys.push(p[1]); }
        for (let k = 12; k >= 0; k--) { const p = roofPt(-Math.PI / 2, k / 12); xs.push(p[0]); ys.push(p[1]); }
        const P = new Path2D(); poly(P, xs, ys, xs.length); erase(P);
      }
      yield;
      // the openings: pointed leaf-shaped arches full of warm light
      const nA = 7, hs = H * 0.6, ha = H * 0.93;
      const qs = []; for (let i = 0; i <= nA; i++) qs.push(lerp(-1.5, 1.5, i / nA));
      const openings = [];
      for (let i = 0; i < nA; i++) {
        const qa = qs[i] + 0.04, qb = qs[i + 1] - 0.04, qm = (qa + qb) / 2, c = Math.cos(qm);
        if (c < 0.12) continue;
        const W = new Path2D();
        const b0 = at(qa, 1.5, Rd);
        W.moveTo(b0[0] * K, b0[1] * K);
        for (let k = 1; k <= 6; k++) { const p = at(lerp(qa, qb, k / 6), 1.5, Rd); W.lineTo(p[0] * K, p[1] * K); }
        const pR = at(qb, hs, Rd), pL = at(qa, hs, Rd), ap = at(qm, ha, Rd);
        W.lineTo(pR[0] * K, pR[1] * K);
        W.bezierCurveTo(pR[0] * K, (pR[1] - (pR[1] - ap[1]) * 0.55) * K, ap[0] * K + (pR[0] - ap[0]) * 0.1 * K, (ap[1] + (pR[1] - ap[1]) * 0.25) * K, ap[0] * K, ap[1] * K);
        W.bezierCurveTo(ap[0] * K + (pL[0] - ap[0]) * 0.1 * K, (ap[1] + (pL[1] - ap[1]) * 0.25) * K, pL[0] * K, (pL[1] - (pL[1] - ap[1]) * 0.55) * K, pL[0] * K, pL[1] * K);
        W.closePath();
        const bm = at(qm, 2, Rd);
        const g = C.createRadialGradient(bm[0] * K, bm[1] * K, 0, bm[0] * K, bm[1] * K, (bm[1] - ap[1]) * 1.15 * K);
        g.addColorStop(0, 'rgba(255,244,214,1)'); g.addColorStop(0.45, 'rgba(255,218,150,0.9)'); g.addColorStop(1, 'rgba(226,160,84,0.7)');
        C.globalAlpha = 0.55 + 0.45 * c; C.fillStyle = g; C.fill(W);
        M.globalAlpha = 1; M.fillStyle = '#000'; M.fill(W);
        openings.push({ W, qm, c, ap, bm });
      }
      // within: the living trunk, a lamp, and in the midmost arch the Lord and Lady
      for (const o of openings) {
        C.save(); M.save(); C.clip(o.W); M.clip(o.W);
        const yy = base - H * 0.4, tx = T.cx(yy), tr = T.r(yy);
        for (let k = 0; k < 14; k++) { const q = -1.4 + 2.8 * k / 13; const x = tx + tr * Math.sin(q); line(sil.get(0.55), x, base, x, base - H, 0.22 + 0.2 * Math.cos(q), 0, 0.05, 0.05); }
        sil.flush();
        const lp = at(o.qm, H * 0.62, Rd * 0.9);
        const Lg = new Path2D(); dot(Lg, lp[0], lp[1], 1.1); fill(Lg, INK.white, 0.95, 'p', 1);
        line(gold.get(0.8), lp[0], lp[1] - 1, lp[0], lp[1] - 7, 0.12, 0, 0.05, 0.05); gold.flush();
        C.restore(); M.restore();
      }
      {
        const o = openings.reduce((a, b) => (b.c > a.c ? b : a), openings[0]);
        if (o) {
          for (const [dx, hh] of [[-3.2, 15], [3.4, 15.8]]) {
            const x = o.bm[0] + dx, yf = o.bm[1];
            const P = new Path2D(); const s = hh;
            P.moveTo((x - 0.05 * s) * K, (yf - s) * K);
            P.quadraticCurveTo((x + 0.15 * s) * K, (yf - 0.9 * s) * K, (x + 0.13 * s) * K, (yf - 0.62 * s) * K);
            P.quadraticCurveTo((x + 0.26 * s) * K, (yf - 0.2 * s) * K, (x + 0.24 * s) * K, yf * K);
            P.lineTo((x - 0.24 * s) * K, yf * K);
            P.quadraticCurveTo((x - 0.24 * s) * K, (yf - 0.2 * s) * K, (x - 0.12 * s) * K, (yf - 0.62 * s) * K);
            P.quadraticCurveTo((x - 0.16 * s) * K, (yf - 0.9 * s) * K, (x - 0.05 * s) * K, (yf - s) * K);
            P.closePath(); erase(P, 0.92);
            stroke(goldHi.get(0.9), [x + 0.13 * s, yf - 0.9 * s, x + 0.15 * s, yf - 0.6 * s, x + 0.25 * s, yf - 0.02 * s], 0.16, 0.1, 0.1);
            const Cr = new Path2D(); dot(Cr, x, yf - s * 1.02, 0.55); fill(Cr, INK.white, 0.9, 'p', 1);
          }
          goldHi.flush();
        }
      }
      // light falling out of the arches onto the boughs below
      for (const o of openings) {
        const gx = o.bm[0], gy = o.bm[1];
        const LG = C.createLinearGradient(0, gy * K, 0, (gy + 60) * K);
        LG.addColorStop(0, 'rgba(255,215,150,0.16)'); LG.addColorStop(1, 'rgba(255,215,150,0)');
        const w0 = 9 * o.c, w1 = 22 * o.c;
        const Tz = new Path2D(); poly(Tz, [gx - w0, gx + w0, gx + w1, gx - w1], [gy + 2, gy + 2, gy + 60, gy + 60], 4);
        C.globalAlpha = 1; C.fillStyle = LG; C.fill(Tz);
      }
      // slender pillars with leaf capitals
      for (let i = 0; i <= nA; i++) {
        const q = qs[i], c = Math.cos(q); if (c < 0.04) continue;
        const w = 0.5 + 0.9 * c;
        for (const d of [-1, 1]) { const qq = q + d * w / Rd * 0.5; const a = at(qq, 0.5, Rd), b = at(qq, hs, Rd); stroke(silHi.get(0.95), [a[0], a[1], b[0], b[1]], 0.26, 0.02, 0.02); }
        const cp = at(q, hs, Rd);
        for (const d of [-1, 1]) stroke(goldHi.get(0.95), quad(cp[0], cp[1] + 1.5, cp[0] + d * 1.6, cp[1], cp[0] + d * 2.6 * (0.4 + 0.6 * c), cp[1] - 2.4, 5), 0.24, 0.1, 0.5);
        const bp = at(q, 0.8, Rd); dot(gold.get(0.9), bp[0], bp[1], 0.6 * (0.5 + c));
      }
      // the spandrels: a carved line echoing each arch, a gold leaf rising over each crown
      for (const o of openings) {
        const i = qs.findIndex((q) => q > o.qm) - 1, qa = qs[i] + 0.04, qb = qs[i + 1] - 0.04;
        const pR = at(qb, hs + 1.5, Rd * 1.005), pL = at(qa, hs + 1.5, Rd * 1.005), ap = at(o.qm, ha + 1.8, Rd * 1.005);
        stroke(silHi.get(0.8), [pL[0], pL[1], lerp(pL[0], ap[0], 0.5) - (ap[0] - pL[0]) * 0.1, lerp(pL[1], ap[1], 0.75), ap[0], ap[1], lerp(pR[0], ap[0], 0.5) + (pR[0] - ap[0]) * 0.1, lerp(pR[1], ap[1], 0.75), pR[0], pR[1]], 0.2, 0.05, 0.05);
        const Lf = new Path2D(); leafShape(Lf, ap[0], ap[1] - 0.5, -Math.PI / 2, 4.6, 0.32); fill(Lf, INK.goldHi, 0.95, 'g', 1);
      }
      // the floor and the eave
      const ringL = (h, rad, B, w) => { const pts = []; for (let k = 0; k <= 48; k++) { const p = at(-Math.PI / 2 + Math.PI * k / 48, h, rad); pts.push(p[0], p[1]); } stroke(B, pts, w, 0.02, 0.02); return pts; };
      ringL(0.5, Rd, silHi.get(0.95), 0.55);
      ringL(H, Rd * 1.04, goldHi.get(1), 0.6);
      const eav = ringL(H + 0.8, Rd * 1.18, gold.get(0.95), 0.4);
      sil.flush(); silHi.flush(); gold.flush(); goldHi.flush();
      // the roof: two courses of folded golden leaves, overlapping, sides first
      const Lh = 0.9;
      for (const [u0, u1, n, wf] of [[0.0, 0.62, 19, 0.6], [0.42, 1.0, 14, 0.52]]) {
        const order = []; for (let k = 0; k < n; k++) order.push(k);
        order.sort((a, b) => Math.abs(b - (n - 1) / 2) - Math.abs(a - (n - 1) / 2));
        for (const k of order) {
          const q = -Math.PI / 2 + Math.PI * (k + (u0 > 0 ? 1 : 0.5)) / (n + (u0 > 0 ? 1 : 0)); const c = Math.cos(q); if (c < 0.06) continue;
          const b = roofPt(q, u0), tp = roofPt(q, u1);
          const l = Math.hypot(tp[0] - b[0], tp[1] - b[1]), a = Math.atan2(tp[1] - b[1], tp[0] - b[0]);
          const span = Math.PI / n * Rd * 1.18 * c;
          const w = clamp(span * wf / l * 1.6, 0.18, 0.55);
          const E = new Path2D(); leafShape(E, b[0] - Math.cos(a) * l * 0.12, b[1] - Math.sin(a) * l * 0.12, a, l * 1.12, w); erase(E);
          fill(E, INK.gold, (0.34 + 0.3 * c) * Lh, 'g', 0.7);
          const Rg = new Path2D(); leafShape(Rg, b[0] - Math.cos(a) * l * 0.12, b[1] - Math.sin(a) * l * 0.12, a, l * 1.12, w); leafHole(Rg, b[0] - Math.cos(a) * l * 0.12, b[1] - Math.sin(a) * l * 0.12, a, l * 1.12, w);
          fill(Rg, INK.goldHi, 0.95, 'g', 1);
          const Rb = new Path2D(); leafRib(Rb, b[0] - Math.cos(a) * l * 0.12, b[1] - Math.sin(a) * l * 0.12, a, l * 1.05); erase(Rb, 0.6);
          // veins
          for (let v = 1; v <= 3; v++) {
            const f = v / 4, mx = lerp(b[0], tp[0], f), my = lerp(b[1], tp[1], f);
            for (const sd of [-1, 1]) line(goldHi.get(0.55), mx, my, mx + Math.cos(a + sd * 0.9) * span * 0.22, my + Math.sin(a + sd * 0.9) * span * 0.22, 0.1, 0, 0.1, 0.5);
          }
        }
        goldHi.flush();
      }
      // the scalloped eave: leaf-tips hanging out over the arches
      for (let k = 2; k < eav.length - 2; k += 4) {
        const Lf = new Path2D(); leafShape(Lf, eav[k], eav[k + 1] - 0.4, Math.PI / 2 + (eav[k] - T.cx(base - H)) / (Rd * 6), 4.2, 0.3);
        erase(Lf); fill(Lf, INK.goldHi, 0.9, 'g', 1);
      }
      ringL(H + HR, rTop, goldHi.get(0.95), 0.5);
      sil.flush(); silHi.flush(); gold.flush(); goldHi.flush();
    }

    /* ---- lamps: a gouache flame in a gold lantern, a breath of wash, a ring of stipple */
    function drawLamp(Lp, A) {
      A = A === undefined ? 1 : A;
      const { x, y, c } = Lp;
      const s = Lp.kind === 'speck' ? Lp.s : Lp.s * 1.2;
      const g = INK.glow[c], col = INK.lamp[c];
      const hr = (Lp.kind === 'speck' ? 8 : 7.5) * s;
      const RG = C.createRadialGradient(x * K, y * K, 0, x * K, y * K, hr * K);
      RG.addColorStop(0, `rgba(${g[0]},${g[1]},${g[2]},${0.5 * A})`);
      RG.addColorStop(0.12, `rgba(${g[0]},${g[1]},${g[2]},${0.32 * A})`);
      RG.addColorStop(0.35, `rgba(${g[0]},${g[1]},${g[2]},${0.1 * A})`);
      RG.addColorStop(1, `rgba(${g[0]},${g[1]},${g[2]},0)`);
      C.globalAlpha = 1; C.fillStyle = RG;
      C.beginPath(); C.arc(x * K, y * K, hr * K, 0, TAU); C.fill();
      const MG = M.createRadialGradient(x * K, y * K, 0, x * K, y * K, hr * K * 0.8);
      MG.addColorStop(0, 'rgba(0,0,255,0.9)'); MG.addColorStop(1, 'rgba(0,0,255,0)');
      M.globalCompositeOperation = 'lighter'; M.globalAlpha = A; M.fillStyle = MG;
      M.beginPath(); M.arc(x * K, y * K, hr * K * 0.8, 0, TAU); M.fill(); M.globalCompositeOperation = 'source-over';
      // stipple halo
      const St = new Path2D(), St2 = new Path2D();
      const nd = Math.round(8 + s * 5);
      for (let i = 0; i < nd; i++) {
        const a = R() * TAU, d = s * (1.7 + Math.pow(R(), 0.7) * 2.8);
        dot(d < s * 2.8 ? St : St2, x + Math.cos(a) * d, y + Math.sin(a) * d, rr(0.14, 0.3) * Math.min(1.2, s / 3));
      }
      fill(St, col, 0.75 * A, 'g', 0.3); fill(St2, col, 0.4 * A, 'g', 0.15);
      if (Lp.kind === 'speck') {
        const Cp = new Path2D(); dot(Cp, x, y, s * 0.42); fill(Cp, INK.white, 0.95 * A, 'p', 1);
        return;
      }
      // rays
      if (s > 2.4) {
        const Ry = new Path2D(); const nr = 12;
        for (let i = 0; i < nr; i++) { const a = i / nr * TAU + 0.13; const r0 = s * 1.45, r1 = s * (i % 2 ? 2.1 : 2.6); line(Ry, x + Math.cos(a) * r0, y + Math.sin(a) * r0, x + Math.cos(a) * r1, y + Math.sin(a) * r1, 0.12, 0, 0.3, 0.6); }
        fill(Ry, col, 0.5 * A, 'g', 0.3);
      }
      // chain or post
      const Ch = new Path2D();
      if (Lp.kind === 'hang') {
        const x0 = x, y0 = y - s * 1.12, l = Math.hypot(Lp.ax - x0, Lp.ay - y0), n = Math.max(1, Math.floor(l / 0.9));
        for (let i = 0; i <= n; i++) { const t = i / n; dot(Ch, lerp(x0, Lp.ax, t), lerp(y0, Lp.ay, t), i % 2 ? 0.2 : 0.26); }
        fill(Ch, INK.silver, 0.85 * A, 's', 0.8);
      } else if (Lp.kind === 'post') {
        line(Ch, x, y + s * 0.8, Lp.ax, Lp.ay, 0.32 * Math.min(1.4, s / 3), 0, 0.02, 0.02);
        line(Ch, x - s * 0.5, y + s * 0.95, x + s * 0.5, y + s * 0.95, 0.22, 0, 0.1, 0.1);
        fill(Ch, INK.silverHi, 0.85 * A, 's', 0.8);
      }
      // the lantern
      const body = (P, k) => {
        P.moveTo((x + 0.16 * s * k) * K, (y - 0.78 * s * k) * K);
        P.quadraticCurveTo((x + 0.62 * s * k) * K, (y - 0.4 * s * k) * K, (x + 0.46 * s * k) * K, (y + 0.06 * s * k) * K);
        P.quadraticCurveTo((x + 0.32 * s * k) * K, (y + 0.55 * s * k) * K, x * K, (y + 0.86 * s * k) * K);
        P.quadraticCurveTo((x - 0.32 * s * k) * K, (y + 0.55 * s * k) * K, (x - 0.46 * s * k) * K, (y + 0.06 * s * k) * K);
        P.quadraticCurveTo((x - 0.62 * s * k) * K, (y - 0.4 * s * k) * K, (x - 0.16 * s * k) * K, (y - 0.78 * s * k) * K);
        P.closePath();
      };
      const B = new Path2D(); body(B, 1); erase(B);
      fill(B, col, 0.92 * A, 'p', 1);
      const Fr = new Path2D(); body(Fr, 1.04);
      const In = new Path2D(); body(In, 0.8);
      const Ring = new Path2D(); Ring.addPath(Fr); Ring.addPath(In);
      C.globalAlpha = 0.95 * A; C.fillStyle = INK.gold; C.fill(Ring, 'evenodd');
      M.globalAlpha = 0.9 * A; M.fillStyle = MET.g; M.fill(Ring, 'evenodd');
      const Rb = new Path2D();
      line(Rb, x, y - 0.76 * s, x, y + 0.84 * s, 0.1 + 0.03 * s, 0, 0.02, 0.02);
      stroke(Rb, quad(x - 0.12 * s, y - 0.76 * s, x - 0.62 * s, y, x - 0.05 * s, y + 0.84 * s, 6), 0.08 + 0.02 * s, 0.05, 0.05);
      stroke(Rb, quad(x + 0.12 * s, y - 0.76 * s, x + 0.62 * s, y, x + 0.05 * s, y + 0.84 * s, 6), 0.08 + 0.02 * s, 0.05, 0.05);
      // cap and finial
      const Cp = new Path2D();
      const cp = [x - 0.36 * s, y - 0.74 * s, x + 0.36 * s, y - 0.74 * s, x + 0.06 * s, y - 1.0 * s, x, y - 1.2 * s, x - 0.06 * s, y - 1.0 * s];
      const cx_ = [], cy_ = []; for (let i = 0; i < cp.length; i += 2) { cx_.push(cp[i]); cy_.push(cp[i + 1]); }
      poly(Cp, cx_, cy_, cx_.length);
      dot(Cp, x, y + 0.98 * s, 0.14 * s);
      fill(Cp, INK.goldHi, 0.95 * A, 'g', 1); fill(Rb, INK.gold, 0.8 * A, 'g', 0.6);
      const Core = new Path2D(); ellipse(Core, x, y + 0.08 * s, 0.2 * s, 0.3 * s); fill(Core, INK.white, 0.95 * A, 'p', 1);
    }

    /* ---- the hill, the path, the fountain */
    function* drawHill() {
      // the hill hides the feet of the trees behind the crest
      const xs = [], ys = [];
      for (let x = PX0 - 10; x <= PX1 + 10; x += 10) { xs.push(x); ys.push(crest(x)); }
      xs.push(PX1 + 10, PX0 - 10); ys.push(1215, 1215);
      const P = new Path2D(); poly(P, xs, ys, xs.length); erase(P);
      // the lawn: rows of grass flicks following the curve of the hill, thick in the lamplight
      const levels = 64;
      for (let k = 0; k < levels; k++) {
        const f = Math.pow((k + rr(0.2, 0.8)) / levels, 1.1);
        const ly = (x) => lerp(crest(x), WALLTOP(x) + 2, f) + 1.4 * nz(x / 23 + k * 7.1);
        const Bk = [];
        for (let x = PX0 - 4; x < PX1 + 4;) {
          const y = ly(x), Lm = light(x, y);
          const v = 0.03 + Lm * 0.9 + 0.1 * (1 - f) + 0.07 * nz2(x / 40, f * 9);
          if (R() < 0.02 + v * 1.1) {
            const h = (1.1 + 2.6 * R()) * (0.7 + 0.7 * f) * (0.8 + 0.4 * Math.min(1, v));
            flick(sil.get(clamp(0.3 + v * 0.7, 0, 1)), x, y + rr(-0.8, 0.8), h, rr(-0.8, 0.8), 0.1 + 0.16 * Math.min(1, v));
          }
          x += rr(0.9, 2.8) * (1.3 - 0.6 * Math.min(1, v));
        }
        if (k % 8 === 0) yield;
      }
      // a few long contour lines give the swell of the hill
      for (let k = 1; k < 9; k++) {
        const f = k / 9;
        const ly = (x) => lerp(crest(x), WALLTOP(x) + 2, f) + 1.2 * nz(x / 23 + k * 3.3);
        for (let x = PX0; x < PX1;) {
          const x2 = Math.min(PX1, x + rr(20, 80)), xm = (x + x2) / 2, Lm = light(xm, ly(xm));
          if (R() < 0.3 + Lm) { const pts = []; for (let xx = x; xx <= x2; xx += 4) pts.push(xx, ly(xx)); stroke(sil.get(clamp(0.3 + Lm * 0.6, 0, 1)), pts, 0.2 + 0.2 * Math.min(1, Lm), 0.2, 0.2); }
          x = x2 + rr(8, 40);
        }
      }
      // the crest, broken where it passes behind the boles
      for (let x = PX0; x < PX1;) {
        const x2 = Math.min(PX1, x + rr(30, 110)); const pts = [];
        for (let xx = x; xx <= x2; xx += 4) pts.push(xx, crest(xx) + 0.5 * nz(xx / 9));
        stroke(silHi.get(clamp(0.35 + light((x + x2) / 2, crest(x)) * 0.6, 0, 1)), pts, 0.32, 0.1, 0.2);
        x = x2 + rr(3, 18);
      }
      // tufts in the lamplight
      for (let i = 0; i < 2600; i++) {
        const x = rr(PX0, PX1), cy = crest(x), y = rr(cy + 2, WALLTOP(x));
        const Lm = light(x, y);
        if (R() > Lm * 1.1 - 0.05) continue;
        const h = rr(1.6, 3.6) * lerp(0.8, 1.3, (y - cy) / (1190 - cy));
        const lean = rr(-0.7, 0.7);
        stroke(silHi.get(clamp(0.3 + Lm * 0.6, 0, 1)), [x, y, x + lean * 0.4, y - h * 0.6, x + lean, y - h], 0.16, 0.1, 0.7);
        if (i % 600 === 0) yield;
      }
      // star flowers in the lawn: elanor (gold) and niphredil (white)
      for (let i = 0; i < 420; i++) {
        const x = rr(PX0, PX1), cy = crest(x), y = rr(cy + 4, WALLTOP(x) - 2), Lm = light(x, y);
        if (R() > 0.1 + Lm) continue;
        const g = chance(0.55);
        const B = g ? goldHi.get(0.95) : white.get(0.85);
        const rf = rr(0.55, 1.0);
        for (let p = 0; p < 5; p++) { const a = p / 5 * TAU + rr(0, 1); dot(B, x + Math.cos(a) * rf, y + Math.sin(a) * rf * 0.6, 0.3); }
      }
      sil.flush(); silHi.flush(); goldHi.flush(); white.flush();
      yield;
      // the little side paths, white and winding
      for (const P of SIDE) {
        const pts = [], hws = [];
        for (let k = 0; k < P.length - 1; k++) {
          const [xa, ya] = P[k], [xb, yb] = P[k + 1], n = Math.ceil(Math.hypot(xb - xa, yb - ya) / 3);
          for (let i = 0; i < n; i++) { const t = i / n; pts.push(lerp(xa, xb, t), lerp(ya, yb, t)); hws.push(lerp(1.6, 3.4, smooth(980, 1180, lerp(ya, yb, t)))); }
        }
        for (let it = 0; it < 4; it++) for (let i = 2; i < pts.length - 2; i += 2) { pts[i] = (pts[i - 2] + 2 * pts[i] + pts[i + 2]) / 4; pts[i + 1] = (pts[i - 1] + 2 * pts[i + 1] + pts[i + 3]) / 4; }
        const Sp = new Path2D(); ribbon(Sp, pts, hws); erase(Sp); fill(Sp, INK.white, 0.5, 'p', 0.5);
        const Db = new Path2D(); for (let i = 0; i < pts.length; i += 2) dot(Db, pts[i] + rr(-1.5, 1.5), pts[i + 1] + rr(-0.6, 0.6), rr(0.15, 0.4)); erase(Db, 0.5);
        for (let i = 0; i < pts.length; i += 6) if (chance(0.6)) dot(silHi.get(0.75), pts[i] + rr(-1, 1), pts[i + 1] + hws[i >> 1] * (chance(0.5) ? 1.1 : -1.1), rr(0.25, 0.45));
        silHi.flush();
      }
      yield;
      // the white path, climbing in turns to the foot of the great tree
      const pts = [], hws = [];
      for (let k = 0; k < PATH.length - 1; k++) {
        const [xa, ya] = PATH[k], [xb, yb] = PATH[k + 1];
        const n = Math.ceil(Math.hypot(xb - xa, yb - ya) / 4);
        for (let i = 0; i < n; i++) { const t = i / n; const x = lerp(xa, xb, t), y = lerp(ya, yb, t); pts.push(x, y); hws.push(pathW(y) * 0.5); }
      }
      pts.push(PATH[PATH.length - 1][0], PATH[PATH.length - 1][1]); hws.push(pathW(950) * 0.5);
      // smooth the corners
      for (let it = 0; it < 3; it++) for (let i = 2; i < pts.length - 2; i += 2) { pts[i] = (pts[i - 2] + 2 * pts[i] + pts[i + 2]) / 4; pts[i + 1] = (pts[i - 1] + 2 * pts[i + 1] + pts[i + 3]) / 4; }
      PATH.dense = pts;
      const Pp = new Path2D(); ribbon(Pp, pts, hws); erase(Pp);
      fill(Pp, INK.white, 0.62, 'p', 0.7);
      // dry-brush texture: the paper biting through
      const Db = new Path2D();
      for (let i = 0; i < pts.length; i += 2) for (let k = 0; k < 3; k++) { const hw = hws[i >> 1]; dot(Db, pts[i] + rr(-hw, hw), pts[i + 1] + rr(-hw, hw) * 0.5, rr(0.15, 0.45)); }
      erase(Db, 0.5);
      // edging stones
      for (const sgn of [-1, 1]) {
        const ed = [];
        for (let i = 0; i < pts.length; i += 2) {
          const i0 = Math.max(0, i - 2), i1 = Math.min(pts.length - 2, i + 2);
          let tx = pts[i1] - pts[i0], ty = pts[i1 + 1] - pts[i0 + 1]; const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
          const hw = hws[i >> 1] * 1.04;
          ed.push(pts[i] - ty * hw * sgn, pts[i + 1] + tx * hw * sgn);
        }
        stroke(silHi.get(0.75), ed, 0.3, 0.01, 0.01);
        for (let i = 0; i < ed.length; i += 4) if (chance(0.6)) dot(silHi.get(0.8), ed[i], ed[i + 1], rr(0.3, 0.55));
      }
      // flights of shallow white steps where the path climbs a terrace
      for (const [i0, nSt] of [[0.18, 7], [0.46, 6], [0.72, 6]]) {
        const n = pts.length >> 1;
        for (let k = 0; k < nSt; k++) {
          const i = Math.min(n - 2, Math.round((i0 + k * 0.012) * n));
          const x = pts[2 * i], y = pts[2 * i + 1], hw = hws[i];
          line(sil.get(0.85), x - hw * 0.98, y + 0.6, x + hw * 0.98, y + 0.6, lerp(0.25, 0.5, hw / 20), 0, 0.03, 0.03);
          line(white.get(0.9), x - hw * 0.98, y - 0.5, x + hw * 0.98, y - 0.5, lerp(0.2, 0.4, hw / 20), 0, 0.03, 0.03);
        }
      }
      silHi.flush(); sil.flush(); white.flush();
      yield;
      // the stream from the fountain, down to the wall
      {
        // glints of the white stream running away through the grass
        for (let i = 0; i < 70; i++) {
          const t = i / 69;
          const x = lerp(FOUNT.x - 22, 250, t) + 14 * Math.sin(t * 7 + 1), y = lerp(FOUNT.y + 6, 1182, Math.pow(t, 1.1));
          const hw = lerp(0.8, 2.6, t);
          if (R() < 0.75) line(white.get(clamp(0.75 - t * 0.35, 0, 1)), x - hw * rr(0.6, 1.4), y, x + hw * rr(0.6, 1.4), y + rr(-0.3, 0.3), rr(0.16, 0.3), rr(-0.3, 0.3), 0.3, 0.3);
          if (R() < 0.5) line(sil.get(0.6), x - hw * 1.8, y + 1.2, x + hw * 1.6, y + 1.0, 0.12, 0.3, 0.3, 0.3);
        }
        white.flush(); sil.flush();
      }
    }

    function drawFountain() {
      const { x, y } = FOUNT;
      {
        const RG = C.createRadialGradient(x * K, (y - 16) * K, 0, x * K, (y - 16) * K, 70 * K);
        RG.addColorStop(0, 'rgba(215,228,255,0.2)'); RG.addColorStop(0.4, 'rgba(215,228,255,0.06)'); RG.addColorStop(1, 'rgba(215,228,255,0)');
        C.globalAlpha = 1; C.fillStyle = RG; C.beginPath(); C.arc(x * K, (y - 16) * K, 70 * K, 0, TAU); C.fill();
      }
      const FS = 1.55;
      C.save(); M.save();
      for (const X of [C, M]) { X.translate(x * K, (y + 14) * K); X.scale(FS, FS); X.translate(-x * K, -(y + 14) * K); }
      const e = ell(y), bw = 24, bh = bw * e * 1.4;
      // pedestal: a stem carved like a branching tree
      const ped = new Path2D();
      ribbon(ped, [x, y + 14, x, y + 8, x, y + 2], [3.4, 2.0, 2.6]); erase(ped);
      fill(ped, INK.silver, 0.25, 's', 0.3);
      stroke(silHi.get(0.9), [x - 3.4, y + 14, x - 2, y + 8, x - 2.6, y + 2], 0.3, 0.05, 0.05);
      stroke(silHi.get(0.9), [x + 3.4, y + 14, x + 2, y + 8, x + 2.6, y + 2], 0.3, 0.05, 0.05);
      for (const s of [-1, 1]) stroke(sil.get(0.8), quad(x, y + 9, x + s * 3, y + 5, x + s * 9, y + 2, 5), 0.25, 0.1, 0.4);
      // basin
      const Bs = new Path2D();
      Bs.moveTo((x - bw) * K, (y - 0.5) * K);
      Bs.quadraticCurveTo((x - bw * 0.9) * K, (y + bh * 1.6) * K, x * K, (y + bh * 1.5) * K);
      Bs.quadraticCurveTo((x + bw * 0.9) * K, (y + bh * 1.6) * K, (x + bw) * K, (y - 0.5) * K);
      Bs.quadraticCurveTo(x * K, (y - bh) * K, (x - bw) * K, (y - 0.5) * K); Bs.closePath();
      erase(Bs);
      fill(Bs, INK.silver, 0.35, 's', 0.8);
      for (let k = 0; k < 14; k++) { const u = (k + 0.5) / 14; const xx = lerp(x - bw * 0.95, x + bw * 0.95, u); const yb = y + bh * 1.5 * Math.sin(u * Math.PI) * 0.95; line(silHi.get(0.8), xx, y + 0.4, lerp(xx, x, 0.12), yb, 0.2, 0, 0.1, 0.2); }
      stroke(silHi.get(1), quad(x - bw, y - 0.5, x, y + bh, x + bw, y - 0.5, 16), 0.65, 0.05, 0.05);
      stroke(silHi.get(1), quad(x - bw, y - 0.5, x, y - bh, x + bw, y - 0.5, 16), 0.45, 0.05, 0.05);
      // jets falling back into the basin
      const Jt = white.get(0.9);
      stroke(Jt, [x, y - 1, x + 0.3, y - 14, x, y - 26], 0.55, 0.05, 0.5);
      for (const s of [-1, 1]) for (let k = 0; k < 3; k++) {
        const top = y - 22 + k * 5, ex = x + s * (8 + k * 5);
        stroke(white.get(0.7 - k * 0.12), quad(x + s * 0.5, top, x + s * (4 + k * 3), top - 6, ex, y - 1 - k, 10), 0.22, 0.1, 0.6);
      }
      for (let k = 0; k < 30; k++) { const a = rr(-Math.PI, 0), d = rr(3, 14); dot(white.get(0.8), x + Math.cos(a) * d, y - 12 + Math.sin(a) * d * 0.7, rr(0.15, 0.35)); }
      // the spill
      stroke(white.get(0.8), quad(x - bw + 2, y + 1, x - bw - 3, y + 5, x - bw + 4, y + 12, 6), 0.7, 0.1, 0.3);
      // reflections of the lamps trembling in the basin
      for (const Lp of fountLamps) { const rxx = x + (Lp.x - x) * 0.3 / FS; for (let k = 0; k < 4; k++) line(white.get(0.8 - k * 0.15), rxx - 1.6 + k * 0.2, y - 0.8 + k * 0.9, rxx + 1.6 - k * 0.2, y - 0.8 + k * 0.9, 0.14, 0, 0.3, 0.3); }
      white.flush(); sil.flush(); silHi.flush();
      C.restore(); M.restore();
      // the boughs from which the silver lamps swing
      for (const Lp of fountLamps) {
        const bx = Lp.ax, by = Lp.ay;
        const foot = x + (bx - x) * 1.5;
        stroke(silHi.get(0.85), quad(foot, y + 10, foot + (bx - foot) * 0.1, by - 8, bx, by, 14), 0.5, 0.05, 0.3);
        stroke(sil.get(0.6), quad(foot + 1, y + 10, foot + (bx - foot) * 0.15 + 1, by - 7, bx, by + 0.5, 14), 0.22, 0.05, 0.3);
        const Lf = new Path2D(); leafShape(Lf, bx, by, -Math.PI / 2 + (bx > x ? 0.6 : -0.6), 4.2, 0.32); fill(Lf, INK.silverHi, 0.85, 's', 0.9);
      }
      white.flush(); sil.flush(); silHi.flush();
    }

    /* ---- the Fellowship, led up the hill by the Elves */
    function figure(x, yf, h, kind, step) {
      // seen from behind, walking up the path; the lamp ahead lights their right-hand side
      const s = h;
      const sh = { elf: 0.1, elfbow: 0.1, man: 0.145, boro: 0.17, dwarf: 0.24, hob: 0.17 }[kind] || 0.14;
      const hem = kind === 'hob' ? -0.2 : (kind === 'dwarf' ? -0.08 : -0.03);
      const hr = kind === 'hob' ? 0.1 : (kind === 'dwarf' ? 0.1 : 0.068);
      const X = (u) => x + u * s, Y = (v) => yf + v * s;
      const sway = (step || 0) * 0.03;
      // cloak: shoulders, a little flare, a hem that swings with the stride
      const P = new Path2D();
      const Q = (a, b, c, d) => P.quadraticCurveTo(a * K, b * K, c * K, d * K);
      P.moveTo(X(-0.05) * K, Y(-0.86) * K);
      Q(X(sh * 0.9), Y(-0.86), X(sh), Y(-0.76));
      Q(X(sh * 1.25 + sway), Y(-0.4), X(sh * 1.42 + sway), Y(hem));
      Q(X(sway * 0.5), Y(hem + 0.03), X(-sh * 1.32 + sway), Y(hem - 0.01));
      Q(X(-sh * 1.2), Y(-0.42), X(-sh * 0.95), Y(-0.76));
      Q(X(-sh * 0.8), Y(-0.86), X(-0.05), Y(-0.86));
      P.closePath();
      const Hd = new Path2D();
      ellipse(Hd, X(0.005), Y(-0.86 - hr * 0.75), hr * s, hr * 1.12 * s);
      const Ft = new Path2D();
      if (kind === 'hob') {
        // hobbits: short cloaks, bare feet below
        ribbon(Ft, [X(-0.05), Y(hem), X(-0.06), Y(-0.01)], [0.035 * s, 0.03 * s]);
        ribbon(Ft, [X(0.06), Y(hem), X(0.07 + step * 0.02), Y(-0.04)], [0.035 * s, 0.03 * s]);
        ellipse(Ft, X(-0.07), Y(0), 0.05 * s, 0.022 * s);
      } else {
        ellipse(Ft, X(-0.06), Y(0), 0.045 * s, 0.02 * s);
        ellipse(Ft, X(0.07), Y(-0.02), 0.045 * s, 0.02 * s);
      }
      const Acc = new Path2D();
      if (kind === 'boro') ellipse(Acc, X(-0.02), Y(-0.55), 0.16 * s, 0.17 * s);
      if (kind === 'hob' && step > 0) ellipse(Acc, X(-0.01), Y(-0.55), 0.14 * s, 0.17 * s);
      if (kind === 'dwarf') { const Ax = []; ribbon(Acc, [X(0.12), Y(-0.45), X(-0.16), Y(-1.18)], [0.02 * s, 0.02 * s]); ellipse(Acc, X(-0.2), Y(-1.13), 0.1 * s, 0.07 * s); }
      if (kind === 'elfbow') stroke(Acc, quad(X(-0.06), Y(-1.12), X(-0.2), Y(-0.6), X(-0.02), Y(-0.12), 8), 0.025 * s, 0.1, 0.1);
      if (kind === 'man') ribbon(Acc, [X(0.08), Y(-0.5), X(0.22), Y(-0.12)], [0.022 * s, 0.018 * s]);
      // cut the figures out of the white path, so they stand dark against it
      erase(P); erase(Hd); erase(Ft); erase(Acc);
      fill(P, INK.silverDim, 0.05, 's', 0.05); fill(Hd, INK.silverDim, 0.05, 's', 0.05);
      fill(Acc, INK.silver, 0.35, 's', 0.4); fill(Ft, INK.silver, 0.5, 's', 0.3);
      // rim light on the lamp side
      const rimB = silHi.get(0.95);
      stroke(rimB, quad(X(0.01), Y(-0.86), X(sh * 0.95), Y(-0.86), X(sh), Y(-0.76), 5).concat(quad(X(sh), Y(-0.76), X(sh * 1.25 + sway), Y(-0.4), X(sh * 1.42 + sway), Y(hem), 8)), 0.028 * s, 0.1, 0.25);
      const hp = []; for (let k = 0; k <= 8; k++) { const a = -Math.PI * 0.85 + k / 8 * Math.PI * 1.1; hp.push(X(0.005) + Math.cos(a) * hr * s, Y(-0.86 - hr * 0.75) + Math.sin(a) * hr * 1.12 * s); }
      stroke(rimB, hp, 0.026 * s, 0.2, 0.2);
      // folds of the cloak on the lit side
      for (let k = 0; k < 3; k++) {
        const u = lerp(0.0, sh * 0.95, (k + 0.5) / 3);
        stroke(sil.get(0.75), quad(X(u * 0.8), Y(-0.72), X(u * 1.1 + sway * 0.5), Y(-0.4), X(u * 1.3 + sway), Y(hem + 0.02), 6), 0.016 * s, 0.25, 0.2);
      }
      if (kind === 'boro') { const sp = []; for (let k = 0; k <= 10; k++) { const a = -Math.PI / 2 + k / 10 * Math.PI; sp.push(X(-0.02) + Math.cos(a) * 0.16 * s, Y(-0.55) + Math.sin(a) * 0.17 * s); } stroke(silHi.get(0.85), sp, 0.02 * s, 0.1, 0.1); dot(goldHi.get(0.9), X(-0.02), Y(-0.55), 0.025 * s); }
      if (kind === 'dwarf') { const ah = []; for (let k = 0; k <= 6; k++) { const a = -0.3 + k / 6 * 2.4; ah.push(X(-0.2) + Math.cos(a + Math.PI) * 0.1 * s, Y(-1.13) + Math.sin(a + Math.PI) * 0.07 * s); } stroke(silHi.get(0.95), ah, 0.018 * s, 0.1, 0.1); }
      if (kind === 'elfbow') stroke(silHi.get(0.85), quad(X(-0.06), Y(-1.12), X(-0.2), Y(-0.6), X(-0.02), Y(-0.12), 8), 0.014 * s, 0.1, 0.1);
      if (kind === 'elf' || kind === 'elfbow') { const Gl = new Path2D(); dot(Gl, X(0.03), Y(-0.93), 0.02 * s); fill(Gl, INK.white, 0.8, 'p', 0.8); }
    }
    function drawFellowship() {
      const pts = PATH.dense;
      // walk back along the path from its top to place the company
      const n = pts.length >> 1;
      const cum = [0]; for (let i = n - 2; i >= 0; i--) cum.push(cum[cum.length - 1] + Math.hypot(pts[2 * i] - pts[2 * i + 2], pts[2 * i + 1] - pts[2 * i + 3]));
      const at = (d) => { let k = 0; while (k < cum.length - 1 && cum[k + 1] < d) k++; const i = n - 1 - k; const f = (d - cum[k]) / ((cum[k + 1] - cum[k]) || 1); return [lerp(pts[2 * i], pts[2 * i - 2], f), lerp(pts[2 * i + 1], pts[2 * i - 1], f)]; };
      const company = [['elf', 28, 'lamp'], ['man', 27.5], ['hob', 15.5], ['hob', 15.2], ['elfbow', 27.4], ['dwarf', 18], ['hob', 15], ['hob', 15.1], ['boro', 28.2], ['elf', 27.6, 'lamp']];
      let d = 36 + J(4);
      const placed = [];
      for (const [kind, h, extra] of company) {
        const [x0, y] = at(d);
        const x = x0 + (placed.length % 2 ? 1 : -1) * pathW(y) * 0.16;
        placed.push([x, y, kind, h, extra]);
        d += h * 0.78 + rr(1, 3);
      }
      // draw from the back of the line to the front
      for (let i = placed.length - 1; i >= 0; i--) {
        const [x, y, kind, h, extra] = placed[i];
        figure(x, y + 0.6, h, kind, i % 2 ? 1 : -1);
        if (extra === 'lamp') {
          const lx = x + 0.38 * h, ly = y - 1.18 * h;
          line(silHi.get(0.95), x + 0.08 * h, y, lx, ly + 2, 0.22, 0, 0.02, 0.02);
          drawLamp({ x: lx, y: ly + 4, s: 3.0, c: i === 0 ? 'g' : 'y', kind: 'hang', ax: lx, ay: ly });
        }
        sil.flush(); silHi.flush(); white.flush();
      }
    }

    /* ---- the wall, the gate, the fosse, the bridge, the near bank */
    function* drawWall() {
      const xs = [], ys = [];
      for (let x = PX0 - 10; x <= PX1 + 10; x += 8) { xs.push(x); ys.push(WALLTOP(x)); }
      for (let x = PX1 + 10; x >= PX0 - 10; x -= 8) { xs.push(x); ys.push(WALLBASE(x)); }
      const P = new Path2D(); poly(P, xs, ys, xs.length); erase(P);
      // the face of the green wall: turf, hanging in rows, brighter where the lamps stand
      for (let y0 = 0; y0 < 1; y0 += rr(0.022, 0.034)) {
        const ly = (x) => lerp(WALLTOP(x) + 1, WALLBASE(x), y0) + 0.8 * nz(x / 17 + y0 * 40);
        for (let x = PX0 - 4; x < PX1 + 4;) {
          if (x > GX - 50 && x < GX + 50) { x = GX + 50; continue; }
          const y = ly(x), Lm = light(x, y - 16);
          const v = (0.06 + Lm * 0.95) * (1 - 0.7 * y0);
          if (R() < 0.12 + v * 1.4) {
            const h = (1.5 + 2.4 * R()) * (0.8 + 0.5 * Math.min(1, v));
            flick(sil.get(clamp(0.28 + v * 0.72, 0, 1)), x, y - h * 0.2, -h, rr(-0.6, 0.6), 0.1 + 0.15 * Math.min(1, v));
          }
          x += rr(0.8, 2.6) * (1.25 - 0.6 * Math.min(1, v));
        }
        yield;
      }
      // the lip of the wall: tufts against the hill
      for (let x = PX0; x < PX1; x += rr(1.2, 3)) {
        if (x > GX - 34 && x < GX + 34) continue;
        const y = WALLTOP(x), Lm = light(x, y);
        const h = rr(2, 5.5);
        stroke((chance(0.3) ? silHi : sil).get(clamp(0.35 + Lm * 0.6, 0, 1)), [x, y + 1, x + rr(-1, 1), y - h * 0.5, x + rr(-1.5, 1.5), y - h], 0.24, 0.05, 0.7);
      }
      for (let x = PX0; x < PX1;) {
        const x2 = Math.min(PX1, x + rr(40, 140)); if (x2 > GX - 50 && x < GX + 50) { x = GX + 50; continue; }
        const pts = []; for (let xx = x; xx <= x2; xx += 4) pts.push(xx, WALLTOP(xx) + 0.6 * nz(xx / 5));
        stroke(silHi.get(clamp(0.45 + light((x + x2) / 2, WALLTOP(x)) * 0.5, 0, 1)), pts, 0.42, 0.05, 0.1);
        x = x2 + rr(2, 12);
      }
      sil.flush(); silHi.flush();
      yield;
      // the gate: slender engraved pillars, an ogee arch with a beaded soffit, doors folded back
      const gl = GX - 42, gr = GX + 42, top = 1094, base = WALLBASE(GX);
      const pw = 15;
      {
        const O = new Path2D(); poly(O, [gl - pw / 2 - 1, gr + pw / 2 + 1, gr + pw / 2 + 1, gl - pw / 2 - 1], [base + 1, base + 1, WALLTOP(GX) - 2, WALLTOP(GX) - 2], 4); erase(O);
      }
      // through the gateway: the path running in and up, between dark turf
      {
        const yt = WALLTOP(GX) - 4;
        const pts = [GX, base, GX + 3, yt], hws = [30, 19];
        for (let y = base - 0.8; y > yt + 1; y -= lerp(1.8, 3.6, (y - yt) / (base - yt))) {
          const u = (y - yt) / (base - yt), hw = lerp(19, 30, u), Lm = light(GX, y);
          for (let x = GX - hw; x < GX + hw;) { const x2 = Math.min(GX + hw, x + rr(3, 7) * (0.6 + u)); ribbon(white.get(clamp(0.35 + Lm * 0.45 + u * 0.2, 0, 1)), [x, y, x2, y], [lerp(0.5, 1.0, u), lerp(0.5, 1.0, u)]); x = x2 + rr(0.3, 0.9); }
        }
        for (let k = 0; k < 300; k++) { const y = rr(yt, base), hw = lerp(19, 30, (y - yt) / (base - yt)), x = GX + rr(-1.1, 1.1) * hw; if (Math.abs(x - GX) > hw) flick(sil.get(0.6), x, y, rr(1.5, 3), rr(-0.5, 0.5), 0.12); }
      }
      for (const px of [gl, gr]) {
        const x0 = px - pw / 2, x1 = px + pw / 2;
        const Pl = new Path2D(); poly(Pl, [x0, x1, x1 - 0.8, x0 + 0.8], [base, base, top, top], 4); erase(Pl);
        const toC = px < GX ? 1 : -1;
        const Lm = light(px + toC * 8, 1150);
        for (let k = 0; k <= 12; k++) {
          const u = k / 12, q = (u - 0.5) * Math.PI, tn = Math.max(0, Math.cos(q - toC * 0.8)) * clamp(0.35 + Lm, 0, 1.2);
          const xx = lerp(x0 + 0.5, x1 - 0.5, u);
          if (tn > 0.08) ribbon(sil.get(0.92), [xx, base, xx + (0.4 - u * 0.8) * 0.6, top + 6], [0.35 * tn + 0.04, 0.3 * tn + 0.04]);
        }
        stroke(silHi.get(0.95), [x0, base, x0 + 0.8, top + 6], 0.36, 0.02, 0.02); stroke(silHi.get(0.95), [x1, base, x1 - 0.8, top + 6], 0.36, 0.02, 0.02);
        // capital of gold leaves
        for (const sg of [-1, 1]) for (let k = 0; k < 3; k++) {
          const lx = px + sg * (1 + k * 1.6), ly = top + 6 - k * 1.2;
          stroke(goldHi.get(0.95), quad(px, top + 8, lx + sg * 2, ly + 1, lx + sg * 3.6, ly - 3.2, 6), 0.3, 0.1, 0.5);
        }
        stroke(goldHi.get(0.95), [x0 - 2.4, top, x1 + 2.4, top], 0.6, 0.02, 0.02);
        stroke(gold.get(0.9), [x0 - 1.2, top + 2.2, x1 + 1.2, top + 2.2], 0.3, 0.02, 0.02);
        // a carved vine climbing the shaft
        let ph = rr(0, TAU);
        const vine = [];
        for (let yy = base - 4; yy > top + 12; yy -= 1.5) vine.push(px + Math.sin(ph + yy * 0.22) * pw * 0.28, yy);
        stroke(silHi.get(0.75), vine, 0.2, 0.05, 0.05);
        for (let yy = base - 8; yy > top + 14; yy -= 6.8) { const vx = px + Math.sin(ph + yy * 0.22) * pw * 0.28, sg = Math.cos(ph + yy * 0.22) > 0 ? 1 : -1; const Lf = new Path2D(); leafShape(Lf, vx, yy, sg > 0 ? -0.5 : Math.PI + 0.5, 3.2, 0.34); fill(Lf, INK.silverHi, 0.8, 's', 0.8); }
      }
      // ogee arch: two curves with beading between, a star at the crown
      const archPts = (o) => { const a = []; for (let k = 0; k <= 30; k++) { const t = k / 30; const xx = lerp(gl - pw / 2 + 2, gr + pw / 2 - 2, t); const sv = Math.sin(t * Math.PI); const yy = top - o - 38 * Math.pow(sv, 0.7) * (1 - 0.18 * Math.sin(t * TAU) * Math.sign(t - 0.5) * 0) - 6 * Math.pow(sv, 6); a.push(xx, yy); } return a; };
      const A0 = archPts(0), A1 = archPts(5);
      stroke(silHi.get(0.95), A0, 0.5, 0.02, 0.02); stroke(gold.get(0.9), A1, 0.4, 0.02, 0.02);
      for (let k = 2; k < A0.length - 2; k += 2) dot(goldHi.get(0.9), (A0[k] + A1[k]) / 2, (A0[k + 1] + A1[k + 1]) / 2, 0.55);
      {
        const cx = GX, cy = A1[31] - 5; const St = new Path2D(); const xs2 = [], ys2 = [];
        for (let k = 0; k < 16; k++) { const a = k / 16 * TAU - Math.PI / 2, rad = k % 2 ? 1.6 : (k % 4 === 0 ? 5 : 3.2); xs2.push(cx + Math.cos(a) * rad); ys2.push(cy + Math.sin(a) * rad); }
        poly(St, xs2, ys2, 16); erase(St); fill(St, INK.goldHi, 0.95, 'g', 1);
      }
      // the doors, folded back, each carved with a mallorn
      for (const sg of [-1, 1]) {
        const hx = sg < 0 ? gl + pw / 2 : gr - pw / 2;
        const ox = hx - sg * 15;
        const Dp = new Path2D(); poly(Dp, [hx, ox, ox, hx], [base - 1, base - 7, top + 16, top + 10], 4); erase(Dp);
        stroke(silHi.get(0.95), [hx, base - 1, ox, base - 7, ox, top + 16, hx, top + 10, hx, base - 1], 0.3, 0.01, 0.01);
        const mx = (hx + ox) / 2, Ld = light(mx, 1160);
        for (let k = 0; k < 5; k++) { const u = (k + 0.5) / 5; line(sil.get(clamp(0.25 + Ld * 0.5, 0, 1)), lerp(hx, ox, u), lerp(base - 1, base - 7, u) - 1, lerp(hx, ox, u), lerp(top + 10, top + 16, u) + 1, 0.14, 0, 0.05, 0.05); }
        const Tr = silHi.get(0.9);
        line(Tr, mx, base - 9, mx, top + 30, 0.3, 0, 0.05, 0.4);
        for (let k = 0; k < 7; k++) { const yy = lerp(base - 16, top + 30, k / 6), l = lerp(4.5, 2.2, k / 6); line(Tr, mx, yy, mx - l, yy - l * 1.3, 0.17, 0.6, 0.1, 0.6); line(Tr, mx, yy, mx + l, yy - l * 1.3, 0.17, -0.6, 0.1, 0.6); }
        for (let k = 0; k < 9; k++) dot(goldHi.get(0.8), mx + rr(-4, 4), rr(top + 22, top + 44), 0.35);
      }
      // the end of the inner wall, overlapping behind
      stroke(silHi.get(0.6), [gr + pw / 2 + 1, WALLTOP(gr) - 7, gr + pw / 2 + 30, WALLTOP(gr + 30) - 6], 0.3, 0.05, 0.3);
      sil.flush(); silHi.flush(); gold.flush(); goldHi.flush(); white.flush();
    }
    function* drawFosse() {
      // still water at the bottom of the fosse, holding the lamps of the wall and gate
      const rb = {};
      for (const c of ['y', 'g', 'b', 's']) rb[c] = Buckets(INK.lamp[c], null, 6);
      // the fosse, lost in soft shadow
      const xs = [], ys = [];
      for (let x = PX0 - 10; x <= PX1 + 10; x += 10) { xs.push(x); ys.push(WALLBASE(x) - 0.5); }
      xs.push(PX1 + 10, PX0 - 10); ys.push(BANK + 4, BANK + 4);
      const P = new Path2D(); poly(P, xs, ys, xs.length); erase(P);
      // far slope of the ditch: long horizontal strokes, sparse
      for (let i = 0; i < 260; i++) {
        const x = rr(PX0, PX1), y = rr(WALLBASE(x) + 1, BANK - 6), l = rr(6, 30), Lm = light(x, y - 20);
        if (R() > 0.2 + Lm) continue;
        line(sil.get(clamp(0.12 + Lm * 0.4, 0, 0.6)), x, y, x + l, y + rr(-0.3, 0.3), 0.18, rr(-0.3, 0.3), 0.3, 0.3);
      }
      sil.flush();
      {
        const g = C.createLinearGradient(0, 1256 * K, 0, BANK * K);
        g.addColorStop(0, 'rgba(10,14,34,0)'); g.addColorStop(1, 'rgba(10,14,34,0)');
        for (const L of lamps) {
          if (L.y < 1060 || L.y > 1262 || L.kind === 'speck' || L.x < PX0 || L.x > PX1) continue;
          const top = 1262, n = Math.round(lerp(8, 14, L.s / 5));
          for (let k = 0; k < n; k++) {
            const yy = top + k * 1.7 + rr(-0.3, 0.3); if (yy > BANK - 1) break;
            const w = (1.2 + 2.6 * R()) * (L.s / 4) * (1 + k * 0.06), xx = L.x + 1.4 * Math.sin(k * 1.7 + L.x);
            line(rb[L.c].get(clamp(0.85 * (1 - k / n), 0, 1)), xx - w, yy, xx + w, yy, rr(0.18, 0.4), 0, 0.3, 0.3);
          }
        }
        for (const c in rb) rb[c].flush();
      }
      yield;
      // mist lying in the ditch: dry-brush white gouache
      {
        const g = C.createLinearGradient(0, 1252 * K, 0, BANK * K);
        g.addColorStop(0, 'rgba(200,214,236,0)'); g.addColorStop(0.55, 'rgba(200,214,236,0.13)'); g.addColorStop(1, 'rgba(200,214,236,0.04)');
        C.globalAlpha = 1; C.fillStyle = g; C.fillRect(PX0 * K, 1250 * K, (PX1 - PX0) * K, (BANK - 1250 + 4) * K);
      }
      const mist = Buckets(INK.mist, 'p', 6);
      for (let i = 0; i < 3400; i++) {
        const x = rr(PX0 - 20, PX1), y = 1258 + Math.pow(R(), 0.8) * 30 + 4 * nz(x / 60);
        const band = 0.5 + 0.5 * nz2(x / 70, y / 12);
        if (R() > band) continue;
        const l = rr(6, 34), Lm = light(x, y - 6);
        line(mist.get(clamp(0.15 + 0.3 * band + Lm * 0.3, 0, 1)), x, y, x + l, y + rr(-0.4, 0.4), rr(0.3, 1.0), 0, 0.4, 0.4);
        if (i % 500 === 0) yield;
      }
      mist.flush(0.7, 0.4);
    }
    function* drawBridge() {
      const b = bridge;
      const xL = (y) => lerp(b.x0a, b.x1a, (y - b.y0) / (b.y1 - b.y0)), xR = (y) => lerp(b.x0b, b.x1b, (y - b.y0) / (b.y1 - b.y0));
      const P = new Path2D(); poly(P, [b.x0a, b.x0b, b.x1b, b.x1a], [b.y0, b.y0, b.y1, b.y1], 4); erase(P);
      fill(P, INK.white, 0.12, 'p', 0.2);
      // planks across the span, each a stroke of white gouache, brighter by the lamps
      for (let y = b.y0 + 0.8; y < b.y1; y += lerp(1.5, 4.2, (y - b.y0) / (b.y1 - b.y0))) {
        const t = (y - b.y0) / (b.y1 - b.y0), xl = xL(y), xr = xR(y);
        for (let x = xl; x < xr;) {
          const x2 = Math.min(xr, x + rr(12, 60) * (0.5 + t)), Lm = light((x + x2) / 2, y - 6);
          ribbon(white.get(clamp(0.55 + Lm * 0.5, 0, 1)), [x, y, x2, y + rr(-0.15, 0.15)], [lerp(0.45, 1.25, t) * (0.7 + 0.3 * Math.min(1, Lm)), lerp(0.45, 1.25, t)]);
          x = x2 + rr(0.2, 1.2);
        }
      }
      for (let k = 1; k < 4; k++) { const u = k / 4; line(sil.get(0.5), lerp(b.x0a, b.x0b, u), b.y0, lerp(b.x1a, b.x1b, u), b.y1, 0.16, 0, 0.1, 0.1); }
      // the edges and rails
      for (const [fx, sgn] of [[xL, -1], [xR, 1]]) {
        stroke(silHi.get(0.95), [fx(b.y0), b.y0, fx(b.y1), b.y1], 0.6, 0.02, 0.02);
        const posts = [];
        for (let t = 0; t <= 1.0001; t += 1 / 7) {
          const y = lerp(b.y0, b.y1, Math.pow(t, 1.25)), x = fx(y), hgt = lerp(9, 22, (y - b.y0) / (b.y1 - b.y0));
          posts.push([x + sgn * 1.5, y, hgt]);
          line(white.get(0.95), x + sgn * 1.5, y, x + sgn * 1.5, y - hgt, lerp(0.4, 0.9, t), 0, 0.02, 0.02);
          dot(goldHi.get(0.95), x + sgn * 1.5, y - hgt - 0.6, lerp(0.5, 1.0, t));
        }
        const rail = []; for (const [x, y, hgt] of posts) rail.push(x, y - hgt);
        stroke(white.get(0.95), rail, 0.55, 0.02, 0.02);
        const rail2 = []; for (const [x, y, hgt] of posts) rail2.push(x, y - hgt * 0.55);
        stroke(white.get(0.7), rail2, 0.35, 0.02, 0.02);
        // carved lattice between
        for (let i = 0; i < posts.length - 1; i++) {
          const [x0, y0, h0] = posts[i], [x1, y1, h1] = posts[i + 1];
          line(sil.get(0.75), x0, y0 - h0 * 0.55, x1, y1 - h1, 0.18, 0, 0.1, 0.1);
          line(sil.get(0.75), x0, y0 - h0, x1, y1 - h1 * 0.55, 0.18, 0, 0.1, 0.1);
        }
      }
      sil.flush(); silHi.flush(); white.flush(); goldHi.flush();
      yield;
    }
    function* drawNearBank() {
      // the brink: a lip of grass, then the near bank to the bottom of the frame
      const xs = [], ys = [];
      for (let x = PX0 - 10; x <= PX1 + 10; x += 8) { xs.push(x); ys.push(BANK + 2 * nz(x / 40)); }
      xs.push(PX1 + 10, PX0 - 10); ys.push(PY1 + 10, PY1 + 10);
      const P = new Path2D(); poly(P, xs, ys, xs.length);
      const b = bridge;
      const BrP = new Path2D(); poly(BrP, [b.x1a - 1, b.x1b + 1, b.x1b + 1, b.x1a - 1], [BANK - 4, BANK - 4, PY1 + 10, PY1 + 10], 4);
      const xL = (y) => lerp(b.x0a, b.x1a, (y - b.y0) / (b.y1 - b.y0)), xR = (y) => lerp(b.x0b, b.x1b, (y - b.y0) / (b.y1 - b.y0));
      const onBridge = (x, y) => x > xL(y) - 2 && x < xR(y) + 2;
      // blades of grass along the brink and over the bank
      // dark against the mist, each blade rimmed on its lamp side
      erase(P);
      const ER = new Path2D();
      for (let i = 0; i < 4200; i++) {
        const x = rr(PX0 - 4, PX1 + 4), y = rr(BANK - 2, PY1 + 6);
        if (onBridge(x, y)) continue;
        const Lm = light(x, y - 8), near = (y - BANK) / (PY1 - BANK);
        const h = rr(5, 15) * (0.7 + near * 1.1), bend = rr(-1, 1) * h * 0.45;
        const w = rr(0.3, 0.55) * (0.8 + near * 0.8);
        const pts = quad(x, y, x + bend * 0.2, y - h * 0.6, x + bend, y - h, 6);
        stroke(ER, pts, w * 1.5, 0.05, 0.85);
        if (R() < 0.2 + Lm * 1.2) {
          const off = (x < GX ? 1 : -1) * w * 0.8;
          const rim = pts.map((v, k) => (k % 2 ? v : v + off));
          stroke((chance(0.3) ? silHi : sil).get(clamp(0.3 + Lm * 0.7, 0, 1)), rim, w * 0.4, 0.1, 0.8);
        }
        if (i % 600 === 0) yield;
      }
      erase(ER);
      // flowers on the bank: elanor, gold stars; niphredil, white bells
      for (let i = 0; i < 90; i++) {
        const x = rr(PX0 + 10, PX1 - 10), y = rr(BANK + 3, PY1 - 2);
        if (onBridge(x, y) || (x > 452 && x < 548)) continue;
        const Lm = light(x, y);
        const near = (y - BANK) / (PY1 - BANK), sz = lerp(1.1, 2.4, near);
        const sh = rr(5, 13) * (0.7 + near);
        stroke(sil.get(clamp(0.35 + Lm * 0.5, 0, 1)), quad(x, y, x + rr(-1, 1), y - sh * 0.5, x + rr(-2, 2), y - sh, 5), 0.2, 0.05, 0.3);
        const fx = x + rr(-2, 2) * 0, fy = y - sh;
        if (chance(0.55)) {
          const St = new Path2D(); const xs2 = [], ys2 = [];
          for (let k = 0; k < 10; k++) { const a = k / 10 * TAU - Math.PI / 2, rad = k % 2 ? sz * 0.42 : sz; xs2.push(fx + Math.cos(a) * rad); ys2.push(fy + Math.sin(a) * rad * 0.8); }
          poly(St, xs2, ys2, 10); erase(St); fill(St, INK.goldHi, 0.9, 'g', 0.9);
          const Ct = new Path2D(); dot(Ct, fx, fy, sz * 0.22); fill(Ct, INK.white, 0.9, 'p', 1);
        } else {
          const Bl = new Path2D(); const bw = sz * 0.55;
          Bl.moveTo((fx - bw) * K, fy * K); Bl.quadraticCurveTo((fx - bw) * K, (fy + sz * 1.3) * K, fx * K, (fy + sz * 1.3) * K); Bl.quadraticCurveTo((fx + bw) * K, (fy + sz * 1.3) * K, (fx + bw) * K, fy * K); Bl.quadraticCurveTo(fx * K, (fy - 0.4 * sz) * K, (fx - bw) * K, fy * K); Bl.closePath();
          erase(Bl); fill(Bl, INK.white, 0.85, 'p', 0.9);
          stroke(sil.get(0.7), [fx - bw, fy, fx, fy - 0.3 * sz, fx + bw, fy], 0.12, 0.1, 0.1);
        }
      }
      sil.flush(); silHi.flush();
    }

    /* ---- the near trunks: dark, rimmed with light, framing the city */
    function* drawNear(T) {
      const yT = 28, yB = 1440;
      const nS = 120;
      const xs = [], ys = [];
      for (let i = 0; i <= nS; i++) { const y = lerp(yT, yB, i / nS); xs.push(T.cx(y) - T.r(y)); ys.push(y); }
      for (let i = nS; i >= 0; i--) { const y = lerp(yT, yB, i / nS); xs.push(T.cx(y) + T.r(y)); ys.push(y); }
      const P = new Path2D(); poly(P, xs, ys, xs.length); erase(P);
      const sgn = T.thL > 0 ? 1 : -1;  // the lit edge faces the city
      // a hint of the dark bark: very faint long strokes over the whole column
      for (let i = 0; i < 70; i++) {
        const th = rr(-1.4, 1.4), lit = Math.max(0, Math.sin(th) * sgn);
        let y = yT + rr(-100, 50);
        while (y < yB) {
          const y2 = Math.min(yB, y + rr(60, 300));
          if (R() < 0.25 + lit * 0.8) {
            const pts = []; for (let yy = y; yy <= y2; yy += 8) pts.push(T.cx(yy) + T.r(yy) * Math.sin(th + 0.02 * nz(yy / 50 + i)), yy);
            stroke(sil.get(clamp(0.08 + Math.pow(lit, 3) * 0.55, 0, 1)), pts, 0.3 + lit * 0.25, 0.1, 0.2);
          }
          y = y2 + rr(4, 40);
        }
        if (i % 10 === 0) yield;
      }
      // fine ticks near the lit edge
      for (let i = 0; i < 2600; i++) {
        const y = rr(yT, yB), u = Math.pow(R(), 2.2), th = sgn * (1.5 - u * 1.3);
        const r = T.r(y), cx = T.cx(y), e = ell(y);
        const lit = Math.pow(Math.max(0, Math.sin(th) * sgn), 3);
        const pts = []; for (let k = 0; k <= 3; k++) { const q = th - 0.03 + 0.06 * k / 3; pts.push(cx + r * Math.sin(q), y - e * r * Math.cos(q)); }
        stroke(sil.get(clamp(0.1 + lit * 0.6, 0, 1)), pts, 0.22, 0.3, 0.4);
        if (i % 500 === 0) yield;
      }
      // the rim of light
      let y = yT;
      while (y < yB) {
        const y2 = Math.min(yB, y + rr(90, 280));
        const pts = []; for (let yy = y; yy <= y2; yy += 5) pts.push(T.cx(yy) + sgn * (T.r(yy) - 0.6), yy);
        stroke(silHi.get(0.95), pts, 0.7, 0.04, 0.06);
        const pts2 = []; for (let yy = y + 10; yy <= y2 - 10; yy += 5) pts2.push(T.cx(yy) + sgn * (T.r(yy) - 3 - 0.8 * nz(yy / 20)), yy);
        stroke(silHi.get(0.6), pts2, 0.3, 0.2, 0.3);
        y = y2 + rr(-4, 4);
      }
      sil.flush(); silHi.flush();
    }

    /* ---- leaves falling through the night, in silver */
    function drawFalling() {
      const Sp = new Path2D(), Hl = new Path2D(), Er = new Path2D();
      for (let i = 0; i < 64; i++) {
        const x = rr(PX0 + 40, PX1 - 40), y = rr(260, 1230);
        const a = rr(0, TAU), l = rr(4.5, 7), w = rr(0.3, 0.4) * rr(0.25, 1);
        leafShape(Er, x, y, a, l, w);
        const Lm = light(x, y);
        if (Lm > 0.45) leafShape(Hl, x, y, a, l, w);
        else { leafShape(Sp, x, y, a, l, w); leafHole(Sp, x, y, a, l, w); }
      }
      erase(Er); fill(Sp, INK.silverHi, 0.9, 's', 0.9); fill(Hl, INK.silverHi, 0.85, 's', 1);
    }

    /* ---- the border of the sheet and the Mirror of Galadriel */
    function* drawBorder() {
      // trim everything to the picture
      const O = new Path2D(); O.rect(-10, -10, (DW + 20) * K, (DH + 20) * K); O.rect(PX0 * K, PY0 * K, (PX1 - PX0) * K, (PY1 - PY0) * K);
      erase(O, 1, 'evenodd');
      const rect = (B, inset, w, bottomExtra) => {
        const x0 = inset, y0 = inset, x1 = DW - inset, y1 = DH - inset - (bottomExtra || 0);
        stroke(B, [x0, y0, x1, y0], w, 0.002, 0.002); stroke(B, [x1, y0, x1, y1], w, 0.002, 0.002);
        stroke(B, [x1, y1, x0, y1], w, 0.002, 0.002); stroke(B, [x0, y1, x0, y0], w, 0.002, 0.002);
      };
      rect(goldHi.get(0.95), 18, 0.9);
      rect(sil.get(0.8), 23.5, 0.3);
      rect(gold.get(0.9), 31, 0.5);
      // picture edge
      stroke(silHi.get(0.9), [PX0, PY0, PX1, PY0], 0.5, 0.002, 0.002); stroke(silHi.get(0.9), [PX1, PY0, PX1, PY1], 0.5, 0.002, 0.002);
      stroke(silHi.get(0.9), [PX1, PY1, PX0, PY1], 0.5, 0.002, 0.002); stroke(silHi.get(0.9), [PX0, PY1, PX0, PY0], 0.5, 0.002, 0.002);
      // beading between the rules
      for (let x = 30; x <= DW - 30; x += 3.6) { dot(goldHi.get(0.8), x, 27.2, 0.42); dot(goldHi.get(0.8), x, DH - 27.2, 0.42); }
      for (let y = 30; y <= DH - 30; y += 3.6) { dot(goldHi.get(0.8), 27.2, y, 0.42); dot(goldHi.get(0.8), DW - 27.2, y, 0.42); }
      gold.flush(); goldHi.flush(); sil.flush(); silHi.flush();
      // small stars at the corners
      const star = (x, y, s) => {
        const St = new Path2D(); const xs = [], ys = [];
        for (let k = 0; k < 16; k++) { const a = k / 16 * TAU - Math.PI / 2, rad = k % 2 ? s * 0.32 : (k % 4 === 0 ? s : s * 0.62); xs.push(x + Math.cos(a) * rad); ys.push(y + Math.sin(a) * rad); }
        poly(St, xs, ys, 16); erase(St); fill(St, INK.goldHi, 0.95, 'g', 1);
        const Ct = new Path2D(); dot(Ct, x, y, s * 0.18); fill(Ct, INK.white, 0.9, 'p', 1);
      };
      for (const [x, y] of [[27.2, 27.2], [DW - 27.2, 27.2], [27.2, DH - 27.2], [DW - 27.2, DH - 27.2]]) {
        const Bx = new Path2D(); Bx.rect((x - 6) * K, (y - 6) * K, 12 * K, 12 * K); erase(Bx);
        star(x, y, 7);
      }
      // mallorn sprays at the top corners of the picture
      // the roundel: the Mirror, a silver basin in a hollow, holding one star
      // a frieze in the lower margin: a gold vine with mallorn leaves and elanor in its curls
      for (const [x0, x1] of [[46, 440], [560, 954]]) {
        const vy = (x) => 1371 + 10 * Math.sin((x - x0) / 30 * Math.PI) * smooth(x0, x0 + 20, x) * smooth(x1, x1 - 20, x);
        const vine = []; for (let x = x0; x <= x1; x += 2) vine.push(x, vy(x));
        stroke(gold.get(0.95), vine, 0.5, 0.05, 0.05);
        stroke(sil.get(0.5), [x0, 1345, x1, 1345], 0.25, 0.01, 0.01); stroke(sil.get(0.5), [x0, 1397, x1, 1397], 0.25, 0.01, 0.01);
        const G = Foliage(); G.gaps = false; G.free = true;
        for (let x = x0 + 14, k = 0; x < x1 - 10; x += 10.5, k++) {
          const y = vy(x), sg = k % 2 ? 1 : -1, a = Math.atan2(vy(x + 1) - y, 1) + sg * 0.9;
          stroke(gold.get(0.8), [x, y, x + Math.cos(a) * 2.5, y + Math.sin(a) * 2.5], 0.2, 0.05, 0.3);
          addLeaf(G, x + Math.cos(a) * 2, y + Math.sin(a) * 2, a, 8.5, 0.34, 1, 'lit');
        }
        flushFoliage(G, 1, 'lit');
        for (let x = x0 + 15; x < x1 - 15; x += 30) {
          const up = Math.sin((x - x0) / 30 * Math.PI + Math.PI / 2) > 0 ? 1 : -1;
          const fx = x + 15, fy = 1371 + (Math.sin((x + 15 - x0) / 30 * Math.PI) > 0 ? -1 : 1) * 2;
          const cy = 1371 - 10 * (Math.sin((fx - x0) / 30 * Math.PI) > 0 ? -0.55 : 0.55);
          if (fx > x1 - 18) break;
          const St = new Path2D(); const sx2 = [], sy2 = [];
          for (let q = 0; q < 10; q++) { const a = q / 10 * TAU - Math.PI / 2, rad2 = q % 2 ? 1.1 : 2.6; sx2.push(fx + Math.cos(a) * rad2); sy2.push(cy + Math.sin(a) * rad2); }
          poly(St, sx2, sy2, 10); erase(St); fill(St, INK.goldHi, 0.95, 'g', 1);
          const Ct = new Path2D(); dot(Ct, fx, cy, 0.55); fill(Ct, INK.white, 0.95, 'p', 1);
          for (let q = 0; q < 3; q++) dot(silHi.get(0.7), x + rr(4, 26), 1371 + (up > 0 ? 1 : -1) * rr(9, 16), rr(0.25, 0.5));
        }
        gold.flush(); sil.flush(); silHi.flush();
      }
      const rx = 500, ry = 1371, rad = 40, RS = 1.18;
      C.save(); M.save();
      for (const X of [C, M]) { X.translate(rx * K, ry * K); X.scale(RS, RS); X.translate(-rx * K, -ry * K); }
      const Rd = new Path2D(); dot(Rd, rx, ry, rad + 4); erase(Rd);
      const ring = (r0, w, B) => { const pts = []; for (let k = 0; k <= 120; k++) { const a = k / 120 * TAU; pts.push(rx + Math.cos(a) * r0, ry + Math.sin(a) * r0); } stroke(B, pts, w, 0.001, 0.001); };
      ring(rad + 3, 0.8, goldHi.get(0.95)); ring(rad - 0.5, 0.35, gold.get(0.9));
      for (let k = 0; k < 72; k++) { const a = k / 72 * TAU; dot(goldHi.get(0.85), rx + Math.cos(a) * (rad + 1.3), ry + Math.sin(a) * (rad + 1.3), 0.45); }
      gold.flush(); goldHi.flush();
      // inside: a deep green hollow, a stair down into it, the basin on its branching pedestal
      {
        const clipIn = (x, y) => Math.hypot(x - rx, y - ry) < rad - 2.5;
        // the hollow's sides: terraces of turf
        for (let k = 0; k < 7; k++) {
          const w = 44 - k * 5.4, yy = ry - 6 + k * 3.6;
          const pts = []; for (let q = -1; q <= 1.0001; q += 0.05) { const x = rx + q * w, y = yy + (1 - q * q) * (5 - k * 0.4); if (clipIn(x, y)) pts.push(x, y); }
          if (pts.length > 4) stroke(sil.get(0.45 + k * 0.06), pts, 0.28, 0.1, 0.1);
          for (let q = -1; q <= 1; q += 0.035) { const x = rx + q * w + rr(-0.5, 0.5), y = yy + (1 - q * q) * (5 - k * 0.4); if (clipIn(x, y - 1.5) && R() < 0.7) flick(sil.get(0.5 + k * 0.05), x, y, rr(0.8, 1.8), rr(-0.3, 0.3), 0.09); }
        }
        // the stair down the right side
        for (let k = 0; k < 10; k++) { const yy = ry - 22 + k * 2.7, xx = rx + 24 - k * 1.3, w = 2.6 + k * 0.25; if (clipIn(xx + w, yy)) line(white.get(0.75), xx - w, yy, xx + w, yy, 0.22, 0, 0.05, 0.05); }
        // a few trees at the rim of the hollow, in silhouette
        for (const [tx, th] of [[rx - 30, 22], [rx - 21, 28], [rx + 33, 18]]) {
          stroke(silHi.get(0.75), [tx, ry - 4, tx + 0.5, ry - 4 - th], 0.35, 0.05, 0.3);
          const G = Foliage(); G.gaps = false; G.free = true;
          for (let k = 0; k < 7; k++) addLeaf(G, tx + rr(-4, 4), ry - 4 - th + rr(-2, 10), rr(0, TAU), 2.6, 0.36, 0.7, 'lit');
          flushFoliage(G, 1, 'lit');
        }
        // the pedestal, carved like a branching tree
        const py0 = ry + 27, py1 = ry + 12;
        stroke(silHi.get(0.95), [rx, py0, rx, py1 + 3], 0.75, 0.05, 0.05);
        for (const sg of [-1, 1]) for (let k = 0; k < 3; k++) {
          const yy = py1 + 2 + k * 3.5, l = 11 - k * 3;
          stroke(silHi.get(0.9 - k * 0.1), quad(rx, yy + 3, rx + sg * l * 0.3, yy, rx + sg * l, yy - 3 + k * 0.6, 8), 0.34 - k * 0.06, 0.1, 0.4);
          dot(goldHi.get(0.9), rx + sg * l, yy - 3 + k * 0.6, 0.32);
        }
        stroke(silHi.get(0.9), [rx - 5, py0 + 0.5, rx + 5, py0 + 0.5], 0.5, 0.05, 0.05);
        // the basin: wide and shallow, its water dark, one star in it
        const Bs = new Path2D(); ellipse(Bs, rx, ry + 9, 15, 3.6); erase(Bs); fill(Bs, INK.silver, 0.3, 's', 1);
        stroke(silHi.get(1), quad(rx - 15, ry + 9, rx, ry + 16.5, rx + 15, ry + 9, 16), 0.55, 0.05, 0.05);
        const Wt = new Path2D(); ellipse(Wt, rx, ry + 8.7, 13, 2.5); erase(Wt);
        stroke(silHi.get(0.95), quad(rx - 13, ry + 8.7, rx, ry + 3.8, rx + 13, ry + 8.7, 14), 0.26, 0.05, 0.05);
        const Sr = new Path2D(); dot(Sr, rx + 3, ry + 8.6, 0.55); fill(Sr, INK.white, 1, 'p', 1);
        line(white.get(0.95), rx + 3 - 3.2, ry + 8.6, rx + 3 + 3.2, ry + 8.6, 0.12, 0, 0.5, 0.5);
        line(white.get(0.95), rx + 3, ry + 7.5, rx + 3, ry + 9.7, 0.1, 0, 0.5, 0.5);
        // the Lady, pouring water from the silver ewer; the Ring-bearer on the step, looking in
        {
          const gx = rx - 21, gy = ry + 27, h = 38;
          const Rb = new Path2D();
          const Q = (a, b, c, d) => Rb.quadraticCurveTo(a * K, b * K, c * K, d * K);
          Rb.moveTo((gx - 1.2) * K, (gy - h * 0.84) * K);
          Q(gx + 2.2, gy - h * 0.86, gx + 2.6, gy - h * 0.76);
          Q(gx + 1.8, gy - h * 0.55, gx + 2.4, gy - h * 0.3);
          Q(gx + 3.6, gy - h * 0.08, gx + 4.6, gy);
          Q(gx - 2, gy + 0.8, gx - 7, gy + 0.6);
          Q(gx - 11, gy + 0.6, gx - 14, gy + 1.2);
          Q(gx - 6, gy - 1.5, gx - 3.4, gy - h * 0.35);
          Q(gx - 2.4, gy - h * 0.65, gx - 2.6, gy - h * 0.76);
          Q(gx - 2.6, gy - h * 0.82, gx - 1.2, gy - h * 0.84);
          Rb.closePath();
          erase(Rb); fill(Rb, INK.white, 0.5, 'p', 0.7);
          for (let k = 0; k < 6; k++) { const u = k / 5; stroke((k % 2 ? sil : silHi).get(0.85), quad(lerp(gx - 2, gx + 2.2, u), gy - h * 0.74, lerp(gx - 3.2, gx + 2.0, u), gy - h * 0.35, lerp(gx - 8, gx + 4.2, u), gy - 0.2, 8), 0.12, 0.2, 0.2); }
          stroke(white.get(0.95), [gx + 2.4, gy - h * 0.76, gx + 2.0, gy - h * 0.5, gx + 2.6, gy - h * 0.3, gx + 4.4, gy], 0.18, 0.05, 0.05);
          stroke(silHi.get(0.8), quad(gx - 3, gy - 0.5, gx - 9, gy - 0.4, gx - 13.5, gy + 0.9, 6), 0.12, 0.1, 0.3);
          // a long sleeve falling from the outstretched arm
          stroke(white.get(0.7), quad(gx + 4, gy - h * 0.63, gx + 5.5, gy - h * 0.45, gx + 4.2, gy - h * 0.36, 6), 0.4, 0.2, 0.5);
          const Hd = new Path2D(); ellipse(Hd, gx + 0.4, gy - h * 0.9, 1.9, 2.3); erase(Hd); fill(Hd, INK.white, 0.9, 'p', 1);
          for (let k = 0; k < 7; k++) stroke((k % 2 ? goldHi : silHi).get(0.9), quad(gx - 0.8 + k * 0.25, gy - h * 0.95, gx - 3.6 - k * 0.3, gy - h * 0.7, gx - 3.2 - k * 0.45, gy - h * 0.42 + k * 0.5, 8), 0.13, 0.1, 0.5);
          stroke(goldHi.get(0.95), quad(gx - 1.8, gy - h * 0.96, gx + 0.4, gy - h * 1.0, gx + 2.4, gy - h * 0.95, 5), 0.16, 0.1, 0.1);
          stroke(white.get(0.95), quad(gx + 2.8, gy - h * 0.74, gx + 6, gy - h * 0.62, gx + 9.2, gy - h * 0.58, 6), 0.32, 0.1, 0.1);
          // the ewer, tipped, and its thread of water
          const ex = gx + 10.5, ey = gy - h * 0.58;
          const Ew = new Path2D(); ellipse(Ew, ex, ey, 1.8, 2.4); erase(Ew); fill(Ew, INK.silverHi, 0.7, 's', 1);
          stroke(silHi.get(0.95), [ex + 1.2, ey + 1.6, ex + 3.4, ey + 3.3], 0.22, 0.05, 0.2);
          stroke(white.get(0.9), quad(ex + 3.4, ey + 3.4, ex + 5, ey + 7, ex + 4.8, ry + 8.4, 8), 0.14, 0.05, 0.1);
          figure(rx + 19, ry + 25.5, 17, 'hob', 0);
          sil.flush(); silHi.flush(); white.flush(); goldHi.flush();
        }
        // the evening star above, alone
        const sx = rx - 6, sy = ry - 25;
        line(silHi.get(1), sx - 6, sy, sx + 6, sy, 0.22, 0, 0.5, 0.5); line(silHi.get(1), sx, sy - 7, sx, sy + 7, 0.22, 0, 0.5, 0.5);
        line(silHi.get(0.8), sx - 3, sy - 3, sx + 3, sy + 3, 0.14, 0, 0.5, 0.5); line(silHi.get(0.8), sx - 3, sy + 3, sx + 3, sy - 3, 0.14, 0, 0.5, 0.5);
        const Es = new Path2D(); dot(Es, sx, sy, 0.9); fill(Es, INK.white, 1, 'p', 1);
        for (let k = 0; k < 40; k++) { const a = R() * TAU, d = rr(10, 38); const x = rx + Math.cos(a) * d, y = ry - 4 + Math.sin(a) * d * 0.6; if (y < ry - 12 && clipIn(x, y)) dot(sil.get(0.6), x, y, rr(0.15, 0.32)); }
        sil.flush(); silHi.flush(); white.flush(); goldHi.flush();
      }
      C.restore(); M.restore();
      // the top: a small star of Eärendil in a lozenge
      { const Lz = new Path2D(); poly(Lz, [500, 509, 500, 491], [16, 27.2, 38.4, 27.2], 4); erase(Lz); stroke(goldHi.get(0.95), [500, 16, 509, 27.2, 500, 38.4, 491, 27.2, 500, 16], 0.5, 0.001, 0.001); goldHi.flush(); star(500, 27.2, 6); }
      yield;
    }

    /* ================================================================ ORDER OF WORK */
    const tasks = [];
    tasks.push(drawStars);
    const lampsOf = (pred) => lamps.filter(pred);
    const assigned = new Set();
    // assign each lamp to the pass that draws it (nearest owning tree by position)
    function treeLamps(T) {
      const out = [];
      for (const Lp of lamps) {
        if (assigned.has(Lp) || Lp.kind === 'speck') continue;
        if (Lp.y > T.yb + 6) continue;
        // lamps hung from this tree's flets, stairs, boughs
        const dx = Math.abs(Lp.ax - T.cx(Lp.ay));
        let own = dx < T.r(Lp.ay) + (T.flets.length ? Math.max(...T.flets.map((F) => F.R)) : 0) + 4;
        if (!own) for (const L of T.limbs) { for (const S of L.subs) { for (let i = 0; i < S.pts.length; i += 2) if (S.pts[i] === Lp.ax && S.pts[i + 1] === Lp.ay) { own = true; break; } if (own) break; } if (own) break; }
        if (own) { out.push(Lp); assigned.add(Lp); }
      }
      return out;
    }
    const specks = lampsOf((L) => L.kind === 'speck' && !L.late);
    tasks.push(function* () { for (const L of specks) drawLamp(L, 0.8); yield; });
    const treePass = (T) => function* () {
      yield* drawTrunk(T);
      for (const L of T.limbs) yield* drawBough(T, L, 'lit');
      for (const S of T.stairs) yield* drawStair(T, S);
      for (const Ld of T.ladders) drawLadder(T, Ld);
      yield;
      for (const F of T.flets) yield* drawFlet(T, F);
      if (T.tier >= 2) yield* frontFoliage(T);
      for (const Lp of T.myLamps) drawLamp(Lp, [0.6, 0.8, 1, 1][T.tier]);
      yield;
    };
    // sprays that hang in front of the trunk, so the column is lost in its crown
    function* frontFoliage(T) {
      const hall = T.flets.find((f) => f.hall);
      const n = T === KT ? 34 : 12;
      const sc = T === KT ? 1 : 0.95;
      for (let i = 0; i < n; i++) {
        const top = T === KT ? Math.pow(R(), 1.5) : R();
        const y = lerp(PY0 - 10, T === KT ? 520 : 420, top);
        if (hall && y > hall.y - 120 && y < hall.y + 40) continue;
        if (T.flets.some((F) => y > F.y - 34 && y < F.y + F.R * F.e + 6)) continue;
        const x = T.cx(y) + T.r(y) * rr(-1.15, 1.15);
        const G = Foliage(); G.gaps = false;
        const k = Math.round(rr(5, 9));
        const tw = [x, y - rr(4, 10)];
        stroke(sil.get(0.6), quad(x - rr(-20, 20), y - 26, x, y - 14, tw[0], tw[1], 6), 0.4, 0.05, 0.4);
        for (let j = 0; j < k; j++) spray(G, x + rr(-12, 12), y + rr(-10, 14), Math.PI / 2 + rr(-1.25, 1.25), rr(20, 34) * sc, sc, 'lit', 1);
        flushFoliage(G, 1, 'lit');
        if (i % 4 === 0) { sil.flush(); gold.flush(); yield; }
      }
      sil.flush(); gold.flush();
    }
    // claim lamps from the front trees first
    for (const T of [KT, L1, R1].concat(back, far)) T.myLamps = treeLamps(T);
    for (const T of far) tasks.push(treePass(T));
    for (const T of back) tasks.push(treePass(T));
    const groundLamps = lamps.filter((L) => !assigned.has(L) && L.kind !== 'speck');
    const handLamps = lamps.filter((L) => L.late);
    tasks.push(drawHill);
    tasks.push(treePass(L1));
    tasks.push(treePass(R1));
    tasks.push(treePass(KT));
    tasks.push(function* drawBridges() {
      for (const B of bridges) {
        const A = tierA[B.tier], n = 48;
        const deck = []; for (let k = 0; k <= n; k++) { const p = bridgeAt(B, k / n); deck.push(p[0], p[1]); }
        const railH = 7;
        const P = new Path2D(); ribbon(P, deck, new Array(n + 1).fill(1.7)); erase(P);
        const Rl = new Path2D(); ribbon(Rl, deck.map((v, k) => (k % 2 ? v - railH * 0.5 : v)), new Array(n + 1).fill(railH * 0.5)); erase(Rl, 0.55);
        stroke(white.get(0.95 * A), deck, 0.9, 0.01, 0.01);
        stroke(sil.get(0.7 * A), deck.map((v, k) => (k % 2 ? v + 1.4 : v)), 0.3, 0.02, 0.02);
        stroke(white.get(0.9 * A), deck.map((v, k) => (k % 2 ? v - railH : v)), 0.4, 0.01, 0.01);
        const Lf = new Path2D();
        for (let k = 1; k < n; k++) {
          const x = deck[2 * k], y = deck[2 * k + 1] - 0.9;
          if (k % 6 === 0) { line(white.get(0.95 * A), x, y + 0.9, x, y - railH * 1.3, 0.36, 0, 0.03, 0.03); dot(goldHi.get(0.95 * A), x, y - railH * 1.35, 0.5); }
          else { leafShape(Lf, x, y, -Math.PI / 2, railH * 0.82, 0.3); leafHole(Lf, x, y, -Math.PI / 2, railH * 0.82, 0.3); }
        }
        fill(Lf, INK.white, 0.78 * A, 'p', 0.6);
        // a cord of silver hung beneath, carrying the lamps
        stroke(silHi.get(0.6 * A), deck.map((v, k) => (k % 2 ? v + 2 + 3 * Math.sin(Math.PI * (k >> 1) / n) : v)), 0.18, 0.05, 0.05);
        white.flush(); sil.flush(); silHi.flush(); goldHi.flush();
        yield;
      }
    });
    tasks.push(function* () {
      drawFountain();
      for (const L of groundLamps) if (L.y < 1176) drawLamp(L);
      for (const G of GROUPS) for (const f of G.figs.slice().sort((a, b) => a.y - b.y)) figure(f.x, f.y, f.h, chance(0.3) ? 'elfbow' : 'elf', 0);
      sil.flush(); silHi.flush(); white.flush(); goldHi.flush();
      for (const L of handLamps) drawLamp(L, 1);
      drawFellowship();
      yield;
    });
    tasks.push(drawWall);
    tasks.push(drawFosse);
    tasks.push(drawBridge);
    tasks.push(function* () { for (const L of groundLamps) if (L.y >= 1176) drawLamp(L); yield; });
    tasks.push(drawNearBank);
    tasks.push(function* () { yield* drawNear(F2); yield* drawNear(F1); });
    tasks.push(function* () {
      yield* drawBough(F1, nearLimbs[0], 'dark');
      yield* drawBough(F1, nearLimbs[1], 'dark');
      yield* drawBough(F2, nearLimbs[2], 'dark');
    });
    tasks.push(function* () { drawFalling(); yield; });
    tasks.push(drawBorder);

    return { ink, met, tasks, CW, CH };
  }

  /* ================================================================ the viewer (WebGL2) */
  const VS = `#version 300 es
in vec2 p; void main(){ gl_Position = vec4(p, 0., 1.); }`;
  const FS = `#version 300 es
precision highp float;
uniform sampler2D uInk, uMet;
uniform vec2 uRes, uTex, uLight;
uniform vec4 uSheet;
uniform vec3 uLens;
uniform float uZoom, uTime, uBreath, uReady;
out vec4 o;
float h21(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
float vn(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.-2.*f);
  return mix(mix(h21(i),h21(i+vec2(1,0)),u.x), mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),u.x),u.y); }
float fbm(vec2 p){ float s=0., a=.5; for(int i=0;i<4;i++){ s+=a*vn(p); p=p*2.03+17.1; a*=.5; } return s; }
vec3 paper(vec2 uv){
  vec2 p = uv*vec2(1000.,1430.);
  float m = fbm(p/110.)*0.65 + fbm(p/26.+7.)*0.35;
  vec3 c = vec3(0.058,0.074,0.192) * (0.82 + 0.36*m);
  c += vec3(-0.006,0.0,0.012)*(fbm(p/300.+3.)-.5)*4.;
  float g = h21(floor(uv*uTex)) - .5;
  c *= 1. + g*0.06;
  vec2 e = min(uv, 1.-uv)*vec2(1000.,1430.);
  c *= 0.8 + 0.2*smoothstep(0., 26., min(e.x,e.y));
  return c;
}
vec3 wall(vec2 fc){
  vec2 q = (fc - (uSheet.xy + uSheet.zw*vec2(0.5,0.22))) / uSheet.w;
  float pool = exp(-dot(q*vec2(0.85,0.7), q*vec2(0.85,0.7))*1.5);
  vec3 c = mix(vec3(0.016,0.018,0.027), vec3(0.074,0.072,0.088), pool);
  // the sheet's shadow
  vec2 d = abs(fc - (uSheet.xy + uSheet.zw*.5) - vec2(0., uSheet.w*0.012)) - uSheet.zw*.5;
  float sd = length(max(d,0.)) + min(max(d.x,d.y),0.);
  c *= 1. - 0.75*exp(-max(sd,0.)/(uSheet.w*0.018));
  return c;
}
vec3 sheet(vec2 uv, vec2 gx, vec2 gy, float sk){
  vec4 ink = textureGrad(uInk, uv, gx, gy) * uReady;
  vec4 m = textureGrad(uMet, uv, gx, gy) * uReady;
  vec3 col = ink.rgb + paper(uv)*(1.-ink.a);
  vec2 o1 = vec2(max(length(gx), 1./uTex.x)*1.6, 0.), o2 = vec2(0., max(length(gy), 1./uTex.y)*1.6);
  float hL = dot(textureGrad(uMet, uv-o1, gx, gy).rg, vec2(1.)), hR = dot(textureGrad(uMet, uv+o1, gx, gy).rg, vec2(1.));
  float hU = dot(textureGrad(uMet, uv-o2, gx, gy).rg, vec2(1.)), hD = dot(textureGrad(uMet, uv+o2, gx, gy).rg, vec2(1.));
  vec3 N = normalize(vec3((hL-hR)*1.6, (hU-hD)*1.6, 1.));
  vec2 asp = vec2(1., 1.43);
  vec3 L = normalize(vec3((uLight-uv)*asp, 0.42));
  vec3 H = normalize(L + vec3(0.,0.,1.));
  float spec = pow(max(dot(N,H),0.), 26.);
  float d = length((uv-uLight)*asp);
  float band = exp(-d*d*7.);
  float s = m.r*uReady, g = m.g*uReady;
  float flake = step(0.8, h21(floor(uv*uTex*0.5)+3.1));
  float sh = (band*0.5 + spec*0.55*(0.4+band) + flake*band*0.4) * sk;
  col *= 1. - min(s+g,1.)*0.09*(1.-band);
  col += (s*vec3(0.78,0.85,1.0) + g*vec3(1.0,0.74,0.36))*sh*0.25;
  col *= 1. + m.b*uBreath*0.10*sin(uTime*0.85 + fbm(uv*vec2(14.,20.))*14.);
  return col;
}
void main(){
  vec2 fc = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
  vec2 uv = (fc - uSheet.xy)/uSheet.zw;
  vec2 gx = dFdx(uv), gy = dFdy(uv);
  gy = -gy;
  float dl = length(fc - uLens.xy);
  float lm = uLens.z > 0. ? step(dl, uLens.z) : 0.;
  vec2 c = (uLens.xy - uSheet.xy)/uSheet.zw;
  vec2 suv = mix(uv, c + (uv-c)/uZoom, lm);
  vec2 sgx = gx / mix(1., uZoom, lm), sgy = gy / mix(1., uZoom, lm);
  float edge = (vn(suv*vec2(70.,100.))-.5)*0.0016;
  vec2 e2 = min(suv, 1.-suv);
  float pw = length(sgx)*1.2 + 1e-5;
  float inside = smoothstep(-pw, pw, min(e2.x, e2.y*1.43) + edge);
  vec3 col = mix(wall(lm > 0.5 ? uLens.xy + (fc-uLens.xy)/uZoom : fc), sheet(clamp(suv,0.,1.), sgx, sgy, 1. - 0.6*lm), inside);
  if (uLens.z > 0.) {
    float ring = smoothstep(2.2, 0.6, abs(dl - uLens.z));
    float sh = (1.-lm) * exp(-max(dl-uLens.z,0.)/14.) * 0.55;
    col *= 1. - sh;
    col = mix(col, vec3(0.80,0.84,0.92), ring*0.85);
  }
  col += (h21(fc+fract(uTime))-.5)/255.;
  o = vec4(col, 1.);
}`;

  function makeViewer(canvas) {
    const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, premultipliedAlpha: false, preserveDrawingBuffer: false });
    if (!gl) return null;
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
    const pr = gl.createProgram();
    gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS));
    gl.bindAttribLocation(pr, 0, 'p'); gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(pr));
    gl.useProgram(pr);
    const vb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vb);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    const U = {}; for (const n of ['uInk', 'uMet', 'uRes', 'uTex', 'uLight', 'uSheet', 'uLens', 'uZoom', 'uTime', 'uBreath', 'uReady']) U[n] = gl.getUniformLocation(pr, n);
    const aniso = gl.getExtension('EXT_texture_filter_anisotropic');
    const tex = [gl.createTexture(), gl.createTexture()];
    const blank = new Uint8Array([0, 0, 0, 0]);
    tex.forEach((t) => { gl.bindTexture(gl.TEXTURE_2D, t); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, blank); });
    gl.uniform1i(U.uInk, 0); gl.uniform1i(U.uMet, 1);
    let texSize = [1, 1], ready = 0;
    return {
      gl,
      upload(ink, met) {
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
        [[0, ink], [1, met]].forEach(([i, cv]) => {
          gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, tex[i]);
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, cv);
          gl.generateMipmap(gl.TEXTURE_2D);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
          if (aniso) gl.texParameterf(gl.TEXTURE_2D, aniso.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(8, gl.getParameter(aniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
        });
        texSize = [ink.width, ink.height]; ready = 1;
      },
      render(st) {
        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex[0]);
        gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, tex[1]);
        gl.uniform2f(U.uRes, canvas.width, canvas.height);
        gl.uniform2f(U.uTex, texSize[0], texSize[1]);
        gl.uniform2f(U.uLight, st.light[0], st.light[1]);
        gl.uniform4f(U.uSheet, st.sheet[0], st.sheet[1], st.sheet[2], st.sheet[3]);
        gl.uniform3f(U.uLens, st.lens[0], st.lens[1], st.lens[2]);
        gl.uniform1f(U.uZoom, st.zoom);
        gl.uniform1f(U.uTime, st.time);
        gl.uniform1f(U.uBreath, st.breath);
        gl.uniform1f(U.uReady, ready);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      },
      destroy() {
        tex.forEach((t) => gl.deleteTexture(t)); gl.deleteBuffer(vb); gl.deleteProgram(pr);
        const ext = gl.getExtension('WEBGL_lose_context'); if (ext) ext.loseContext();
      },
    };
  }

  /* ================================================================ mount */
  function mount(el, api) {
    el.style.background = '#05060a';
    el.style.touchAction = 'none';
    el.style.userSelect = 'none';
    el.style.webkitUserSelect = 'none';
    const cv = document.createElement('canvas');
    cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block';
    el.appendChild(cv);
    const ov = document.createElement('canvas');
    ov.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none';
    el.appendChild(ov);
    const octx = ov.getContext('2d');

    let dead = false, raf = 0;
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let viewer = null, fallback = null;
    try { viewer = makeViewer(cv); } catch (e) { console.warn(e); viewer = null; }
    if (!viewer) { cv.remove(); fallback = document.createElement('canvas'); fallback.style.cssText = cv.style.cssText; el.insertBefore(fallback, ov); }

    // layout of the sheet on the wall
    const st = { sheet: [0, 0, 1, 1], light: [0.55, 0.3], lens: [0, 0, 0], zoom: 3, time: 0, breath: reduce ? 0 : 1 };
    let W = 1, H = 1, dpr = 1, css = { x: 0, y: 0, w: 1, h: 1 };
    let art = null;
    function layout() {
      const r = el.getBoundingClientRect();
      W = Math.max(1, r.width); H = Math.max(1, r.height);
      dpr = Math.min(2, window.devicePixelRatio || 1);
      const target = viewer ? cv : fallback;
      target.width = Math.round(W * dpr); target.height = Math.round(H * dpr);
      ov.width = target.width; ov.height = target.height;
      const portrait = W / H < 0.8;
      const mx = portrait ? Math.max(12, W * 0.035) : Math.max(24, W * 0.03), my = portrait ? Math.max(16, H * 0.03) : Math.max(22, H * 0.04);
      const asp = DW / DH;
      let h = H - 2 * my, w = h * asp;
      if (w > W - 2 * mx) { w = W - 2 * mx; h = w / asp; }
      css = { x: (W - w) / 2, y: (H - h) / 2 - (portrait ? 0 : H * 0.004), w, h };
      st.sheet = [css.x * dpr, css.y * dpr, css.w * dpr, css.h * dpr];
      st.zoom = art ? clamp(art.CW / (css.w * dpr), 2.5, 4) : 3;
      need = true;
    }
    let need = true;

    // pointer: the light follows it; press and hold for the lens
    let ptr = null, lastMove = -1e9, lensOn = false, lensPt = [0, 0], lensTouch = false, holdTimer = 0;
    const tgtLight = [0.55, 0.28];
    function toSheet(x, y) { return [(x - css.x) / css.w, (y - css.y) / css.h]; }
    function onMove(e) {
      const r = el.getBoundingClientRect();
      const x = e.clientX - r.left, y = e.clientY - r.top;
      ptr = [x, y]; lastMove = performance.now();
      const s = toSheet(x, y);
      tgtLight[0] = clamp(s[0], -0.3, 1.3); tgtLight[1] = clamp(s[1], -0.3, 1.3);
      if (lensOn) { lensPt = [x, y]; need = true; }
    }
    function onDown(e) {
      if (e.button !== undefined && e.button !== 0) return;
      onMove(e);
      lensTouch = e.pointerType === 'touch' || e.pointerType === 'pen';
      clearTimeout(holdTimer);
      holdTimer = setTimeout(() => { lensOn = true; lensPt = ptr.slice(); need = true; }, lensTouch ? 160 : 90);
      try { el.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
    }
    function onUp() { clearTimeout(holdTimer); lensOn = false; need = true; }
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onUp);
    el.addEventListener('pointerleave', () => { if (!lensOn) ptr = null; });
    const noMenu = (e) => e.preventDefault();
    el.addEventListener('contextmenu', noMenu);

    // a few leaves drifting down through the picture
    const RL = mulberry32(api.seed ^ 0xbeef);
    const drift = [];
    function spawn(d, first) {
      d.x = 120 + RL() * 760; d.y = first ? 120 + RL() * 900 : 60 + RL() * 120;
      d.vy = 7 + RL() * 6; d.ph = RL() * TAU; d.sw = 8 + RL() * 14; d.fr = 0.25 + RL() * 0.3;
      d.rot = RL() * TAU; d.spin = (RL() - 0.5) * 0.9; d.flip = RL() * TAU; d.fs = 0.8 + RL() * 1.2;
      d.l = 5 + RL() * 2.4; d.gold = RL() < 0.3; d.age = 0;
    }
    for (let i = 0; i < 9; i++) { const d = {}; spawn(d, true); drift.push(d); }
    function drawDrift(dt) {
      octx.setTransform(1, 0, 0, 1, 0, 0);
      octx.clearRect(0, 0, ov.width, ov.height);
      if (!art || reduce) return;
      const s = st.sheet[2] / DW;
      octx.save();
      octx.beginPath();
      octx.rect(st.sheet[0] + PX0 * s, st.sheet[1] + PY0 * s, (PX1 - PX0) * s, (PY1 - PY0) * s);
      if (st.lens[2] > 0) { octx.moveTo(st.lens[0] + st.lens[2] + 3, st.lens[1]); octx.arc(st.lens[0], st.lens[1], st.lens[2] + 3, 0, TAU, true); }
      octx.clip();
      for (const d of drift) {
        d.age += dt; d.y += d.vy * dt; d.ph += dt * d.fr * TAU * 0.25; d.rot += d.spin * dt; d.flip += d.fs * dt;
        const x = d.x + Math.sin(d.ph) * d.sw;
        if (d.y > 1180) spawn(d, false);
        const fade = Math.min(1, d.age / 3) * clamp((1180 - d.y) / 60, 0, 1);
        const face = Math.cos(d.flip);
        const px = st.sheet[0] + x * s, py = st.sheet[1] + d.y * s;
        octx.setTransform(1, 0, 0, 1, px, py);
        octx.rotate(d.rot);
        octx.scale(1, Math.max(0.12, Math.abs(face)));
        const l = d.l * s;
        octx.beginPath();
        octx.moveTo(-l / 2, 0); octx.quadraticCurveTo(-l * 0.1, -l * 0.36, l / 2, 0); octx.quadraticCurveTo(0, l * 0.32, -l / 2, 0); octx.closePath();
        const shine = 0.35 + 0.65 * Math.pow(Math.abs(face), 3);
        octx.globalAlpha = fade * (0.35 + 0.5 * shine);
        octx.fillStyle = d.gold ? INK.goldHi : INK.silverHi;
        octx.fill();
        octx.globalAlpha = fade * 0.9;
        octx.lineWidth = Math.max(0.5, 0.35 * s);
        octx.strokeStyle = d.gold ? INK.gold : INK.silver;
        octx.stroke();
        octx.setTransform(1, 0, 0, 1, 0, 0);
      }
      octx.restore();
    }

    // fallback presentation without WebGL2
    function drawFallback() {
      const c = fallback.getContext('2d');
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.fillStyle = '#05060a'; c.fillRect(0, 0, fallback.width, fallback.height);
      c.fillStyle = '#10153a'; c.fillRect(st.sheet[0], st.sheet[1], st.sheet[2], st.sheet[3]);
      if (art) { c.imageSmoothingQuality = 'high'; c.drawImage(art.ink, st.sheet[0], st.sheet[1], st.sheet[2], st.sheet[3]); }
      if (art && st.lens[2] > 0) {
        c.save(); c.beginPath(); c.arc(st.lens[0], st.lens[1], st.lens[2], 0, TAU); c.clip();
        const u = (st.lens[0] - st.sheet[0]) / st.sheet[2], v = (st.lens[1] - st.sheet[1]) / st.sheet[3];
        const sw = st.sheet[2] * st.zoom, sh = st.sheet[3] * st.zoom;
        c.fillStyle = '#10153a'; c.fillRect(st.lens[0] - u * sw, st.lens[1] - v * sh, sw, sh);
        c.drawImage(art.ink, st.lens[0] - u * sw, st.lens[1] - v * sh, sw, sh);
        c.restore();
        c.strokeStyle = '#ccd3e0'; c.lineWidth = 1.5 * dpr; c.beginPath(); c.arc(st.lens[0], st.lens[1], st.lens[2], 0, TAU); c.stroke();
      }
    }

    let t0 = performance.now(), lastT = t0, lastDraw = 0;
    function frame(now) {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.1, (now - lastT) / 1000); lastT = now;
      st.time = (now - t0) / 1000;
      // the light: follows the pointer; when idle it wanders slowly
      const idle = now - lastMove > 4000;
      if (idle) { const t = st.time * 0.05; tgtLight[0] = 0.5 + 0.32 * Math.sin(t * 1.3); tgtLight[1] = 0.32 + 0.22 * Math.sin(t * 0.9 + 1); }
      const k = 1 - Math.exp(-dt * (idle ? 1.2 : 5));
      const dx = tgtLight[0] - st.light[0], dy = tgtLight[1] - st.light[1];
      st.light[0] += dx * k; st.light[1] += dy * k;
      const moving = Math.abs(dx) + Math.abs(dy) > 0.002;
      if (lensOn && ptr) {
        const R0 = Math.min(170, Math.max(80, Math.min(W, H) * 0.2));
        const lx = ptr[0], ly = ptr[1] - (lensTouch ? R0 + 24 : 0);
        st.lens = [lx * dpr, ly * dpr, R0 * dpr];
      } else st.lens = [0, 0, 0];
      const animate = !reduce && art && !art.partial;
      if (!(need || (moving && art && !art.partial) || animate)) return;
      if (now - lastDraw < 30 && !need) return;
      lastDraw = now; need = false;
      if (viewer) viewer.render(st); else drawFallback();
      drawDrift(Math.min(0.1, dt * 2));
    }

    const ro = new ResizeObserver(() => { layout(); });
    ro.observe(el);
    layout();
    raf = requestAnimationFrame(frame);

    (async () => {
      const t0r = performance.now();
      const big = Math.max(screen.width || 0, screen.height || 0) * Math.min(2, window.devicePixelRatio || 1);
      let K = 2.24;
      if (viewer) { const mx = viewer.gl.getParameter(viewer.gl.MAX_TEXTURE_SIZE); if (DH * K > mx) K = (mx - 2) / DH; }
      if (big && big < 900) K = 1.8;
      const A = makeArt(api.seed >>> 0, K);
      const nf = () => new Promise((r) => requestAnimationFrame(() => r()));
      let tb = performance.now();
      let lastUp = 0;
      for (const task of A.tasks) {
        const it = task();
        for (;;) {
          const r = it.next();
          if (r.done) break;
          if (performance.now() - tb > 40) {
            await nf(); if (dead || !api.isCurrent()) return; tb = performance.now();
            // if the drawing is slow (a weak device), let it be seen coming in, as if being inked
            if (viewer && tb - t0r > 5200 && tb - lastUp > 1600) { viewer.upload(A.ink, A.met); art = art || { CW: A.CW, ink: A.ink, met: A.met, partial: true }; need = true; lastUp = performance.now(); tb = lastUp; }
          }
        }
      }
      if (dead) return;
      art = A;
      if (viewer) viewer.upload(A.ink, A.met);
      layout();
      need = true;
      // make sure a finished frame is on screen before announcing it
      await nf(); await nf();
      if (dead) return;
      el.dataset.renderMs = String(Math.round(performance.now() - t0r));
      api.ready();
    })().catch((e) => { if (!dead) { console.error(e); api.ready(); } });

    return {
      destroy() {
        dead = true;
        cancelAnimationFrame(raf);
        clearTimeout(holdTimer);
        ro.disconnect();
        el.removeEventListener('pointermove', onMove);
        el.removeEventListener('pointerdown', onDown);
        el.removeEventListener('pointerup', onUp);
        el.removeEventListener('pointercancel', onUp);
        el.removeEventListener('contextmenu', noMenu);
        if (viewer) viewer.destroy();
        if (art) { art.ink.width = art.ink.height = 1; art.met.width = art.met.height = 1; }
        art = null;
      },
    };
  }

  (window.PIECES = window.PIECES || []).push({
    id: 'lorien',
    title: 'Caras Galadhon by Lamplight',
    medium: 'Silver and gold ink with white gouache on midnight-blue paper',
    note: 'Move to tilt the sheet · press and hold to look closer',
    about: 'The Fellowship is led up the hill of Caras Galadhon at nightfall, between the great grey trunks of the mallorns, toward the lamps of the hall of Celeborn and Galadriel. It is an original interpretation of Tolkien’s text, drawn from the book and not from any film, as a presentation sheet in metallic silver and gold ink with white gouache. The night is the bare blue paper; every light is ink, and the metal catches the light as you move.',
    tone: 'dark',
    room: '#05060a',
    mount,
  });
})();
