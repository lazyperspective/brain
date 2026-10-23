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
  const PX0 = 40, PY0 = 40, PX1 = 960, PY1 = 1316;  // picture area inside the border
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
    const GAPS = [[415 + J(15), 110 + J(20), 62, 92], [668 + J(15), 150 + J(20), 52, 96], [205 + J(15), 60, 80, 40], [858 + J(15), 82, 70, 52], [300 + J(15), 330 + J(30), 34, 40], [770 + J(15), 330 + J(30), 30, 44]];
    const inGap = (x, y) => { for (const [gx, gy, rx, ry] of GAPS) { const d = Math.pow((x - gx) / rx, 2) + Math.pow((y - gy) / ry, 2); if (d < 1 + 0.35 * nz2(x / 18, y / 18)) return true; } return false; };
    const crest = (x) => 936 + 0.00042 * (x - 545) * (x - 545);
    const far = [[92, 34], [368, 30], [655, 32], [912, 36]].map(([x, w]) => { x += J(14);
      return makeTree({ xb: x, yb: crest(x) + 30, wb: w * rr(0.9, 1.1), tier: 0, thL: x < 500 ? 0.7 : -0.7 }); });
    const back = [[172, 60], [418, 50], [702, 55], [872, 64]].map(([x, w]) => { x += J(10);
      return makeTree({ xb: x, yb: crest(x) + 26, wb: w * rr(0.92, 1.08), tier: 1, thL: x < 500 ? 0.65 : -0.65 }); });
    const L1 = makeTree({ xb: 250 + J(8), yb: crest(250) + 14, wb: 122 * rr(0.96, 1.04), tier: 2, thL: 0.7 });
    const R1 = makeTree({ xb: 818 + J(8), yb: crest(818) + 12, wb: 130 * rr(0.96, 1.04), tier: 2, thL: -0.75 });
    const KT = makeTree({ xb: 548 + J(5), yb: 952, wb: 180, tier: 3, thL: -0.5 });

    // flets: y of the underside, R in multiples of the trunk radius
    function flet(T, y, Rm, houses, opt) { const F = Object.assign({ y, Rm, houses: houses || [] }, opt || {}); T.flets.push(F); return F; }
    flet(KT, 806 + J(8), 1.72, [{ phi: -0.75 + J(0.15) }], { off: -0.28 });
    flet(KT, 654 + J(8), 1.5, [{ phi: 0.55 + J(0.1) }], { off: 0.36 });
    flet(KT, 446 + J(4), 1.95, [], { hall: true });
    flet(KT, 268 + J(10), 1.55, [{ phi: -0.35 + J(0.2) }], { off: -0.3 });
    flet(KT, 118 + J(10), 1.45, [], { off: 0.25 });
    flet(L1, 770 + J(12), 1.85, [{ phi: 0.6 + J(0.2) }], { off: 0.3 });
    flet(L1, 530 + J(12), 2.0, [{ phi: -0.45 + J(0.2) }, { phi: 0.85 }], { off: -0.15 });
    flet(L1, 312 + J(12), 1.7, [{ phi: 0.3 + J(0.3) }], { off: 0.2 });
    flet(L1, 135 + J(12), 1.5, []);
    flet(R1, 830 + J(12), 1.8, [{ phi: -0.55 + J(0.2) }], { off: -0.32 });
    flet(R1, 610 + J(12), 1.95, [{ phi: 0.25 + J(0.3) }]);
    flet(R1, 396 + J(12), 1.8, [{ phi: -0.7 + J(0.2) }], { off: 0.28 });
    flet(R1, 205 + J(12), 1.55, [], { off: -0.2 });
    back.forEach((T, i) => {
      flet(T, 700 - i * 22 + J(30), 2.0, chance(0.6) ? [{ phi: J(0.8) }] : [], { off: J(0.3) });
      flet(T, 460 + J(40), 1.9, chance(0.4) ? [{ phi: J(0.8) }] : [], { off: J(0.3) });
      if (chance(0.7)) flet(T, 240 + J(40), 1.8, []);
    });
    far.forEach((T) => { flet(T, 640 + J(60), 2.1, []); if (chance(0.7)) flet(T, 380 + J(50), 2.0, []); });
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
    back.forEach((T) => { T.ladders.push({ y0: T.flets[0].y + 120, y1: T.flets[0].y, side: T.thL > 0 ? 0.7 : -0.7 }); if (T.flets[1]) T.ladders.push({ y0: T.flets[0].y - 3, y1: T.flets[1].y, side: T.thL > 0 ? -0.4 : 0.4 }); });

    /* ---- branches (structure only; leaves are generated as they are drawn) */
    function growLimb(T, y0, side, sc) {
      const r0 = T.r(y0);
      let x = T.cx(y0) + side * r0 * 0.78, y = y0;
      const e0 = rr(-0.12, 0.38), e1 = rr(0.75, 1.3), L = rr(110, 250) * sc;
      const hw0 = r0 * rr(0.26, 0.38);
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
        T.limbs.unshift(growLimb(T, F.y + rr(14, 30), side, rr(1.15, 1.4) * (T === KT ? 1 : 0.85)));
        if (F.hall || chance(0.45)) T.limbs.unshift(growLimb(T, F.y + rr(16, 34), -side, rr(1.0, 1.3) * (T === KT ? 1 : 0.85)));
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
    const FOUNT = { x: 392 + J(6), y: 972 };

    /* ---- lamps */
    // on the flets: on the rail posts and hanging beneath the rim
    for (const T of trees) {
      const tierS = [0.55, 0.75, 1, 1.1][T.tier];
      for (const F of T.flets) {
        const y = F.y, cx = T.cx(y), r = T.r(y), Rr = F.Rm * r, e = ell(y), t = 3 + Rr * 0.03;
        F.R = Rr; F.e = e; F.t = t; F.tcx = cx; F.cx = cx + (F.off || 0) * r; F.r = r;
        if (F.hall) continue;
        const nu = T.tier >= 2 ? Math.round(rr(2, 4)) : Math.round(rr(1, 2.4));
        for (let i = 0; i < nu; i++) {
          const th = (i + 0.5) / nu * 2.6 - 1.3 + J(0.18);
          const ax = F.cx + Rr * 0.96 * Math.sin(th), ay = y - e * Rr * 0.96 * Math.cos(th);
          const s = rr(3.2, 4.4) * tierS;
          lamp(ax, ay + rr(5, 13) * tierS + s, s, pickCol(4, 3, 2), 'hang', ax, ay, 1);
        }
        if (T.tier >= 1) {
          const np = T.tier >= 2 ? Math.round(rr(2, 3)) : 1;
          for (let i = 0; i < np; i++) {
            const th = J(1.25);
            const px = F.cx + Rr * Math.sin(th), py = y - e * Rr * Math.cos(th) - t - 9 * tierS;
            lamp(px, py - 3 * tierS, 2.6 * tierS, pickCol(3, 2, 2), 'post', px, py + 4, 0.8);
          }
        }
      }
      // the hall: lamps round the eaves
    }
    {
      const F = KT.flets.find((f) => f.hall);
      F.isHall = true;
      const Rd = F.R * 0.86, H = 46;
      for (let i = 0; i < 9; i++) {
        const th = (i + 0.5) / 9 * 2.9 - 1.45;
        const ax = F.cx + Rd * 1.08 * Math.sin(th), ay = F.y - F.t - H - ell(F.y) * Rd * 1.08 * Math.cos(th);
        const s = 3.8 + 0.6 * Math.cos(th);
        lamp(ax, ay + 7 + s, s, i % 3 === 1 ? 'g' : (i % 3 === 2 ? 's' : 'y'), 'hang', ax, ay, 1.2);
      }
      for (let i = 0; i < 4; i++) {
        const th = (i + 0.5) / 4 * 2.4 - 1.2;
        const ax = F.cx + F.R * Math.sin(th), ay = F.y - ell(F.y) * F.R * Math.cos(th);
        lamp(ax, ay + 16, 4.2, i % 2 ? 'b' : 'y', 'hang', ax, ay, 1.1);
      }
    }
    // on the stairs, at intervals, on the newel posts
    for (const T of trees) for (const S of T.stairs) {
      const n = Math.round(S.turns * 3.4);
      for (let i = 1; i <= n; i++) {
        const u = (i - 0.5) / n, y = lerp(S.y0, S.y1, u), ph = S.ph0 + S.dir * S.turns * TAU * u;
        if (Math.cos(ph) < 0.15) continue;
        const ro = T.r(y) + S.sw * T.f(y), e = ell(y);
        const px = T.cx(y) + ro * Math.sin(ph), py = y - e * ro * Math.cos(ph) - 9;
        lamp(px, py - 4, 2.9, pickCol(3, 3, 2), 'post', px, py + 3, 0.9);
      }
    }
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
    const gateL = GX - 32, gateR = GX + 32, gTop = 1114;
    lamp(gateL - 8, gTop - 12, 5.4, 'y', 'post', gateL - 8, gTop - 4, 1.3);
    lamp(gateR + 8, gTop - 12, 5.4, 'y', 'post', gateR + 8, gTop - 4, 1.3);
    lamp(GX, gTop + 4, 5.0, 'g', 'hang', GX, gTop - 22, 1.3);
    lamp(GX - 15, gTop + 14, 3.6, 'y', 'hang', GX - 15, gTop - 15, 1);
    lamp(GX + 15, gTop + 14, 3.6, 's', 'hang', GX + 15, gTop - 15, 1);
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
    const fountLamps = [[-26, -36], [24, -40], [-2, -58]].map(([dx, dy]) => lamp(FOUNT.x + dx, FOUNT.y + dy, 3.4, 's', 'hang', FOUNT.x + dx * 0.8, FOUNT.y + dy - 14, 1.1));
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
    addLight(FOUNT.x, FOUNT.y - 20, 0.45, 40);

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
          const th0 = -Math.PI / 2 + Math.PI * (i + 0.5 + off) / n + J(0.18 * Math.PI / n);
          const sd = rr(0, 99);
          let y = yT + rr(-120, 0);
          while (y < yB) {
            const y2 = Math.min(yB, y + rr(120, 340));
            const n2 = Math.max(3, Math.ceil((y2 - y) / 4));
            const pts = [], hws = [];
            let any = false;
            for (let k = 0; k <= n2; k++) {
              const yy = lerp(y, y2, k / n2), u = k / n2;
              const th = rootPull(th0 + 0.02 * nz(sd + yy / 70), yy);
              const tn = trunkLight(T, th, yy) - thr;
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
      lines(N, 0, wmax, 1.15, 0, sil);
      yield;
      // interleaved finer lines in the light only, for the satin of the bark
      lines(N, 0.5, wmax * 0.6, 1.6, 0.58, silHi);
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
      return { er: new Path2D(), ring: [new Path2D(), new Path2D(), new Path2D(), new Path2D()], body: [new Path2D(), new Path2D()], rib: new Path2D(), glint: new Path2D(), n: 0 };
    }
    function addLeaf(G, x, y, a, l, w, Lv, mode) {
      if (y < PY0 - 6 || y > PY1 || x < PX0 - 6 || x > PX1 + 6) return;
      if (mode === 'lit' && G.gaps !== false && inGap(x, y)) return;
      leafShape(G.er, x, y, a, l, w);
      if (mode === 'dark') { if (Lv > 0.25) { leafShape(G.ring[0], x, y, a, l, w); leafHole(G.ring[0], x, y, a, l, w); } G.n++; return; }
      const v = Lv * 1.5 + 0.02 + rr(-0.1, 0.1);
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
      let G = Foliage();
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
        flushFoliage(G, A, mode); G = Foliage();
        sil.flush(); silHi.flush();
        yield;
      }
    }

    /* ---- stairs that wind round the trunk */
    function* drawStair(T, S) {
      const A = tierA[T.tier];
      const steps = Math.max(8, Math.round(S.turns * 30));
      const pos = (u, rad, lift) => {
        const y = lerp(S.y0, S.y1, u), ph = S.ph0 + S.dir * S.turns * TAU * u;
        const rr0 = T.r(y) + rad * T.f(y), e = ell(y);
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

    /* ---- the flets: platforms round the trunk, seen from beneath */
    function* drawFlet(T, F) {
      const A = tierA[T.tier];
      const { y, cx, r, R: Rr, e, t, tcx } = F;
      const ry = e * Rr;
      const railH = (F.isHall ? 9 : 8) * clamp(T.f(y), 0.7, 1) * (T.tier < 2 ? 0.8 : 1);
      // knock out the underside (but not the trunk beneath it) and the rim band
      {
        const U = new Path2D();
        ellipse(U, cx, y, Rr, ry);
        const xs = [], ys = [];
        for (let k = 0; k <= 16; k++) { const q = -Math.PI / 2 + Math.PI * k / 16; xs.push(tcx + r * Math.sin(q)); ys.push(y - e * r * Math.cos(q)); }
        const yLow = (x) => y + ry * Math.sqrt(Math.max(0, 1 - Math.pow((x - cx) / Rr, 2)));
        for (let k = 0; k <= 12; k++) { const x = tcx + r - 2 * r * k / 12; xs.push(x); ys.push(yLow(x) + 0.2); }
        const Tp = new Path2D(); poly(Tp, xs, ys, xs.length);
        U.addPath(Tp);
        erase(U, 1, 'evenodd');
        const band = new Path2D();
        const bx = [], by = [];
        for (let k = 0; k <= 40; k++) { const q = -Math.PI / 2 + Math.PI * k / 40; bx.push(cx + Rr * Math.sin(q)); by.push(y - ry * Math.cos(q) - t - railH * 0.15); }
        for (let k = 40; k >= 0; k--) { const q = -Math.PI / 2 + Math.PI * k / 40; bx.push(cx + Rr * Math.sin(q)); by.push(y - ry * Math.cos(q) + 0.3); }
        poly(band, bx, by, bx.length); erase(band);
      }
      const hidden = (x, yy) => Math.abs(x - tcx) < r && yy > y - e * r * Math.cos(Math.asin(clamp((x - tcx) / r, -1, 1)));
      const Lu = light(cx, y + ry * 0.5);
      // radial joists and ring beams on the underside
      const nj = Math.round(clamp(Rr / 4.5, 8, 22));
      for (let j = 0; j < nj; j++) {
        const q = j / nj * TAU + 0.13;
        let pts = [];
        const flushJ = () => { if (pts.length >= 4) stroke(sil.get(clamp((0.25 + 0.6 * Lu) * A, 0, 1)), pts, 0.32, 0.1, 0.05); pts = []; };
        for (let k = 0; k <= 8; k++) {
          const u = k / 8, x = lerp(tcx + r * Math.sin(q), cx + Rr * 0.97 * Math.sin(q), u), yy = lerp(y - e * r * Math.cos(q), y - e * Rr * 0.97 * Math.cos(q), u);
          if (hidden(x, yy)) flushJ(); else pts.push(x, yy);
        }
        flushJ();
      }
      for (const f of [0.52, 0.78]) {
        let pts = [];
        const flushR = () => { if (pts.length >= 4) stroke(sil.get(clamp((0.2 + 0.5 * Lu) * A, 0, 1)), pts, 0.26, 0.1, 0.1); pts = []; };
        for (let k = 0; k <= 64; k++) {
          const q = k / 64 * TAU, rho = Rr * f, x = cx + rho * Math.sin(q), yy = y - e * rho * Math.cos(q);
          if (hidden(x, yy) || Math.hypot(x - tcx, (yy - y) / Math.max(e, 0.05)) < r + 1) flushR(); else pts.push(x, yy);
        }
        flushR();
      }
      // carved brackets from the trunk below up to the underside
      if (T.tier >= 1) {
        const nb = T.tier >= 2 ? 4 : 2;
        for (let b = 0; b < nb; b++) {
          const q = lerp(-1.05, 1.05, (b + 0.5) / nb) + J(0.12);
          const yb = y + 10 + Rr * 0.32;
          const x0 = T.cx(yb) + T.r(yb) * Math.sin(q), y0 = yb - ell(yb) * T.r(yb) * Math.cos(q);
          const x1 = lerp(tcx + r * Math.sin(q), cx + Rr * Math.sin(q), 0.62), y1 = lerp(y - e * r * Math.cos(q), y - e * Rr * Math.cos(q), 0.62);
          const pts = quad(x0, y0, x0 + (x1 - x0) * 0.1, y1 + (y0 - y1) * 0.25, x1, y1, 10);
          const Pk = new Path2D(); stroke(Pk, pts, 1.6, 0.05, 0.05); erase(Pk);
          stroke(silHi.get(clamp((0.5 + 0.5 * Lu) * A, 0, 1)), pts, 0.42, 0.05, 0.05);
          // the volute at its foot
          const vr = 2.2 * T.f(y), vs = [];
          for (let k = 0; k <= 18; k++) { const a = k / 18 * 5.2, rad = vr * (1 - k / 22); vs.push(x0 + Math.sin(q) * vr + rad * Math.cos(a + 1.6), y0 + rad * Math.sin(a + 1.6) - vr * 0.2); }
          stroke(silHi.get(clamp((0.45 + 0.5 * Lu) * A, 0, 1)), vs, 0.3, 0.1, 0.4);
        }
      }
      // the rim band: lit face with a carved running scroll
      {
        const top = [], bot = [];
        for (let k = 0; k <= 48; k++) { const q = -Math.PI / 2 + Math.PI * k / 48; top.push(cx + Rr * Math.sin(q), y - ry * Math.cos(q) - t); bot.push(cx + Rr * Math.sin(q), y - ry * Math.cos(q)); }
        const Lr = light(cx, y - ry);
        const xs = [], ys = [];
        for (let k = 0; k <= 48; k++) { xs.push(top[2 * k]); ys.push(top[2 * k + 1]); }
        for (let k = 48; k >= 0; k--) { xs.push(bot[2 * k]); ys.push(bot[2 * k + 1]); }
        const Bd = new Path2D(); poly(Bd, xs, ys, xs.length); fill(Bd, INK.silver, (0.12 + 0.2 * Lr) * A, 's', 0.2);
        stroke(silHi.get(clamp((0.6 + 0.4 * Lr) * A, 0, 1)), bot, 0.55, 0.03, 0.03);
        stroke(sil.get(clamp((0.55 + 0.4 * Lr) * A, 0, 1)), top, 0.42, 0.03, 0.03);
        // underside edge seen as a thin ellipse to the back
        let pts = [];
        const flushE = () => { if (pts.length >= 4) stroke(sil.get(clamp((0.22 + 0.4 * Lu) * A, 0, 1)), pts, 0.3, 0.05, 0.05); pts = []; };
        for (let k = 0; k <= 40; k++) { const q = Math.PI / 2 + Math.PI * k / 40, x = cx + Rr * Math.sin(q), yy = y - ry * Math.cos(q); if (hidden(x, yy)) flushE(); else pts.push(x, yy); }
        flushE();
        if (T.tier >= 2 && t > 2.6) {
          const step = 5.5 / Rr;
          for (let q = -1.45; q < 1.45; q += step) {
            const c = Math.cos(q); if (c < 0.12) continue;
            const mx = cx + Rr * Math.sin(q), my = y - ry * Math.cos(q) - t * 0.5;
            const hx = 1.7 * c, hy = t * 0.28;
            const Bm = silHi.get(clamp((0.5 + 0.5 * light(mx, my)) * A, 0, 1));
            stroke(Bm, [mx - hx, my + hy, mx - hx * 0.4, my - hy, mx + hx * 0.3, my + hy * 0.6, mx + hx, my - hy], 0.17, 0.2, 0.2);
            dot(Bm, mx + hx * 1.35, my, 0.22);
          }
        }
      }
      sil.flush(); silHi.flush();
      yield;
      // houses on the platform
      for (const H of F.houses) drawHouse(T, F, H);
      // the rail
      {
        const step = 3.4;
        const n = Math.round(Math.PI * Rr / step);
        for (let k = 0; k <= n; k++) {
          const q = -Math.PI / 2 - 0.05 + (Math.PI + 0.1) * k / n;
          const c = Math.cos(q);
          const x = cx + Rr * 0.985 * Math.sin(q), yb = y - ry * 0.985 * c - t;
          const newel = k % 6 === 0;
          line(white.get(clamp((0.55 + 0.3 * light(x, yb)) * A * (0.6 + 0.4 * Math.max(0, c)), 0, 1)), x, yb, x, yb - railH * (newel ? 1.12 : 1), newel ? 0.42 : 0.2, 0, 0.05, 0.05);
        }
        const hr = [];
        for (let k = 0; k <= 48; k++) { const q = -Math.PI / 2 - 0.05 + (Math.PI + 0.1) * k / 48; hr.push(cx + Rr * 0.985 * Math.sin(q), y - ry * 0.985 * Math.cos(q) - t - railH); }
        stroke(white.get(0.9 * A), hr, 0.5, 0.03, 0.03);
      }
      white.flush(); silHi.flush(); sil.flush(); gold.flush(); goldHi.flush();
      if (F.isHall) yield* drawHall(T, F);
    }

    function drawHouse(T, F, H) {
      const A = tierA[T.tier];
      const { y, r, R: Rr, e, t, tcx } = F;
      const phi = H.phi, dOut = Rr + (F.off || 0) * r * Math.sin(phi);
      const rho = (r + dOut) / 2 + 1;
      const hx = tcx + rho * Math.sin(phi), hb = y - e * rho * Math.cos(phi) - t;
      const hw = Math.max(5, (dOut - r) * 0.42 * (0.75 + 0.25 * Math.cos(phi)));
      const wallH = hw * rr(1.15, 1.6), roofH = hw * rr(1.1, 1.7);
      const eT = ell(hb - wallH) * 0.6;
      const topY = (x) => hb - wallH - eT * hw * Math.sqrt(Math.max(0, 1 - Math.pow((x - hx) / hw, 2)));
      // silhouette: walls + ogee roof
      const xs = [], ys = [];
      xs.push(hx - hw, hx - hw); ys.push(hb + 2, hb - wallH);
      const eave = hw * 1.18;
      xs.push(hx - eave); ys.push(hb - wallH + 1);
      const roof = (s) => { const o = []; for (let k = 0; k <= 12; k++) { const tt = k / 12; const xx = hx + s * eave * (1 - tt) * (1 - 0.25 * Math.sin(tt * Math.PI)); const yy = hb - wallH + 1 - roofH * (tt * tt * (3 - 2 * tt)) * (1 + 0.08 * Math.sin(tt * Math.PI * 2)); o.push(xx, yy); } return o; };
      const rl = roof(-1), rrf = roof(1);
      for (let k = 0; k < rl.length; k += 2) { xs.push(rl[k]); ys.push(rl[k + 1]); }
      for (let k = rrf.length - 2; k >= 0; k -= 2) { xs.push(rrf[k]); ys.push(rrf[k + 1]); }
      xs.push(hx + eave, hx + hw, hx + hw); ys.push(hb - wallH + 1, hb - wallH, hb + 2);
      const P = new Path2D(); poly(P, xs, ys, xs.length); erase(P);
      const Lh = light(hx, hb - wallH * 0.5);
      // walls: vertical hatching, lit toward the trunk's key light
      for (let k = 0; k <= 14; k++) {
        const u = k / 14, x = hx - hw + 2 * hw * u, c = Math.cos((u - 0.5) * Math.PI);
        if (R() > 0.35 + 0.6 * c) continue;
        line(sil.get(clamp((0.3 + 0.5 * Lh * c) * A, 0, 1)), x, hb + 1, x, topY(x) + 0.5, 0.2, 0, 0.1, 0.1);
      }
      stroke(silHi.get(0.8 * A), [hx - hw, hb + 1, hx - hw, hb - wallH], 0.35, 0.02, 0.02);
      stroke(silHi.get(0.8 * A), [hx + hw, hb + 1, hx + hw, hb - wallH], 0.35, 0.02, 0.02);
      // lancet windows glowing
      const nw = hw > 9 ? 2 : 1;
      for (let w = 0; w < nw; w++) {
        const wx = hx + (nw === 1 ? 0 : (w ? 1 : -1) * hw * 0.42), ww = hw * (nw === 1 ? 0.28 : 0.2), wy0 = hb - wallH * 0.22, wy1 = hb - wallH * 0.8;
        const Wp = new Path2D();
        Wp.moveTo((wx - ww) * K, wy0 * K); Wp.lineTo((wx - ww) * K, (wy1 + ww) * K);
        Wp.quadraticCurveTo((wx - ww) * K, (wy1 - ww * 0.4) * K, wx * K, (wy1 - ww * 1.2) * K);
        Wp.quadraticCurveTo((wx + ww) * K, (wy1 - ww * 0.4) * K, (wx + ww) * K, (wy1 + ww) * K);
        Wp.lineTo((wx + ww) * K, wy0 * K); Wp.closePath();
        const col = INK.lamp[H.col || (H.col = pickCol(3, 3, 2))];
        fill(Wp, col, 0.85 * A, 'p', 0.9);
        const Gw = new Path2D(); dot(Gw, wx, (wy0 + wy1) / 2, ww * 0.5); fill(Gw, INK.white, 0.8 * A, 'p', 0.8);
        stroke(gold.get(0.9 * A), [wx - ww - 0.5, wy0, wx - ww - 0.5, wy1 + ww, wx, wy1 - ww * 1.35, wx + ww + 0.5, wy1 + ww, wx + ww + 0.5, wy0], 0.24, 0.02, 0.02);
        line(gold.get(0.7 * A), wx, wy0, wx, wy1 - ww, 0.14, 0, 0.05, 0.05);
      }
      // roof: gold ribs, scales and a finial
      const apX = rl[rl.length - 2], apY = rl[rl.length - 1];
      const Rf = new Path2D(); const fx = [], fy = [];
      for (let k = 0; k < rl.length; k += 2) { fx.push(rl[k]); fy.push(rl[k + 1]); }
      for (let k = rrf.length - 2; k >= 0; k -= 2) { fx.push(rrf[k]); fy.push(rrf[k + 1]); }
      poly(Rf, fx, fy, fx.length); fill(Rf, INK.gold, (0.16 + 0.3 * Lh) * A, 'g', 0.45);
      stroke(goldHi.get(0.95 * A), rl, 0.38, 0.02, 0.1); stroke(goldHi.get(0.95 * A), rrf, 0.38, 0.02, 0.1);
      for (let k = 1; k <= 4; k++) {
        const u = k / 5, bx = lerp(hx - eave, hx + eave, u);
        stroke(gold.get(0.75 * A), quad(bx, hb - wallH + 1, lerp(bx, apX, 0.5) + (bx - hx) * 0.2, lerp(hb - wallH, apY, 0.45), apX, apY, 8), 0.2, 0.05, 0.3);
      }
      for (let row = 1; row <= 4; row++) {
        const v = row / 5;
        const yy = hb - wallH + 1 - roofH * (v * v * (3 - 2 * v)) * 0.95;
        const half = eave * (1 - v) * (1 - 0.25 * Math.sin(v * Math.PI)) * 0.92;
        for (let xx = hx - half + 1.2; xx < hx + half - 0.5; xx += 2.2) stroke(gold.get(0.65 * A), quad(xx - 1.0, yy, xx, yy + 1.2, xx + 1.0, yy, 3), 0.15, 0.2, 0.2);
      }
      stroke(goldHi.get(0.95 * A), [hx - eave, hb - wallH + 1, hx + eave, hb - wallH + 1], 0.45, 0.02, 0.02);
      line(goldHi.get(0.95 * A), apX, apY, apX, apY - roofH * 0.35, 0.3, 0, 0.05, 0.6);
      dot(goldHi.get(1), apX, apY - roofH * 0.15, 0.6);
      sil.flush(); silHi.flush(); gold.flush(); goldHi.flush();
    }

    /* ---- the hall of Celeborn and Galadriel: walls green and silver, a roof of gold */
    function* drawHall(T, F) {
      const { y, R: Rr, t } = F;
      const Rd = Rr * 0.86, H = 46, HR = 34;
      const base = y - t;
      const cxh = (yy) => T.cx(yy);
      const at = (q, h, rad) => { const yy = base - h; return [cxh(yy) + rad * Math.sin(q), yy - ell(yy) * rad * Math.cos(q)]; };
      {
        const gx = cxh(base - 25), gy = base - 30 - ell(base) * Rd;
        const RG = C.createRadialGradient(gx * K, gy * K, 0, gx * K, gy * K, Rd * 2.4 * K);
        RG.addColorStop(0, 'rgba(190,240,205,0.22)'); RG.addColorStop(0.4, 'rgba(230,215,150,0.08)'); RG.addColorStop(1, 'rgba(230,215,150,0)');
        C.globalAlpha = 1; C.fillStyle = RG; C.beginPath(); C.arc(gx * K, gy * K, Rd * 2.4 * K, 0, TAU); C.fill();
      }
      // silhouette of the drum and roof
      {
        const xs = [], ys = [];
        for (let k = 0; k <= 40; k++) { const q = -Math.PI / 2 + Math.PI * k / 40; const p = at(q, 0, Rd); xs.push(p[0]); ys.push(p[1] + 1); }
        const pr = at(Math.PI / 2, H, Rd * 1.1); xs.push(pr[0]); ys.push(pr[1]);
        // roof right flank to the trunk and back
        for (let k = 0; k <= 10; k++) { const u = k / 10; const rad = lerp(Rd * 1.1, T.r(base - H - HR) * 1.15, u); const p = at(Math.PI / 2 * (1 - u * 0.12), H + HR * (u * u * (3 - 2 * u)), rad); xs.push(p[0]); ys.push(p[1]); }
        for (let k = 0; k <= 20; k++) { const q = Math.PI / 2 * 0.88 - Math.PI * 0.88 * k / 20; const p = at(q, H + HR, T.r(base - H - HR) * 1.15); xs.push(p[0]); ys.push(p[1]); }
        for (let k = 10; k >= 0; k--) { const u = k / 10; const rad = lerp(Rd * 1.1, T.r(base - H - HR) * 1.15, u); const p = at(-Math.PI / 2 * (1 - u * 0.12), H + HR * (u * u * (3 - 2 * u)), rad); xs.push(p[0]); ys.push(p[1]); }
        const pl = at(-Math.PI / 2, H, Rd * 1.1); xs.push(pl[0]); ys.push(pl[1]);
        const P = new Path2D(); poly(P, xs, ys, xs.length); erase(P);
      }
      yield;
      // windows between silver pilasters, filled with green-white light
      const nWin = 11;
      for (let i = 0; i < nWin; i++) {
        const q0 = -Math.PI / 2 + Math.PI * i / nWin, q1 = -Math.PI / 2 + Math.PI * (i + 1) / nWin;
        const qm = (q0 + q1) / 2, c = Math.cos(qm);
        // pilaster at q0
        if (i > 0) {
          const pts = []; for (let h = 2; h <= H - 2; h += 4) { const p = at(q0, h, Rd + 0.5); pts.push(p[0], p[1]); }
          stroke(silHi.get(0.95), pts, 0.55 * (0.4 + 0.6 * Math.cos(q0)), 0.02, 0.02);
          const pts2 = []; for (let h = 2; h <= H - 2; h += 4) { const p = at(q0 + 0.03, h, Rd + 0.5); pts2.push(p[0], p[1]); }
          stroke(sil.get(0.7), pts2, 0.22, 0.02, 0.02);
        }
        if (c < 0.1) continue;
        const wq0 = lerp(q0, q1, 0.2), wq1 = lerp(q0, q1, 0.8);
        const hb0 = 7, hb1 = H - 9;
        const wx = [], wy = [];
        for (let k = 0; k <= 6; k++) { const p = at(lerp(wq0, wq1, k / 6), hb0, Rd); wx.push(p[0]); wy.push(p[1]); }
        const pTop = at(qm, hb1 + 7, Rd);
        const pR = at(wq1, hb1, Rd), pL = at(wq0, hb1, Rd);
        const W = new Path2D();
        W.moveTo(wx[0] * K, wy[0] * K); for (let k = 1; k <= 6; k++) W.lineTo(wx[k] * K, wy[k] * K);
        W.lineTo(pR[0] * K, pR[1] * K);
        W.quadraticCurveTo(pR[0] * K, (pTop[1] + 2) * K, pTop[0] * K, pTop[1] * K);
        W.quadraticCurveTo(pL[0] * K, (pTop[1] + 2) * K, pL[0] * K, pL[1] * K);
        W.closePath();
        const col = i % 3 === 1 ? INK.lamp.s : INK.lamp.g;
        fill(W, col, 0.55 + 0.35 * c, 'p', 0.9);
        const pc = at(qm, (hb0 + hb1) / 2, Rd);
        const Gw = new Path2D(); ellipse(Gw, pc[0], pc[1], 2.2 * c, 6); fill(Gw, INK.white, 0.6 * c, 'p', 0.6);
        // tracery: a mullion and a trefoil
        const m0 = at(qm, hb0, Rd), m1 = at(qm, hb1 - 3, Rd);
        line(gold.get(0.85), m0[0], m0[1], m1[0], m1[1], 0.22 * c + 0.08, 0, 0.02, 0.02);
        const tf = at(qm, hb1 + 1, Rd);
        for (let k = 0; k < 3; k++) { const a = k / 3 * TAU - Math.PI / 2; const Tr = gold.get(0.8); dot(Tr, tf[0] + Math.cos(a) * 1.3 * c, tf[1] + Math.sin(a) * 1.3, 0.55); }
        stroke(gold.get(0.9), [pL[0], pL[1], pTop[0], pTop[1], pR[0], pR[1]], 0.3, 0.05, 0.05);
      }
      // the wall's silver hatching between the windows, low and high bands
      for (let k = 0; k <= 160; k++) {
        const q = -Math.PI / 2 + Math.PI * k / 160; const c = Math.cos(q); if (R() > 0.4 + 0.6 * c) continue;
        const a0 = at(q, 0.5, Rd), a1 = at(q, 6, Rd), b0 = at(q, H - 8, Rd), b1 = at(q, H - 1, Rd);
        line(sil.get(0.6), a0[0], a0[1], a1[0], a1[1], 0.18, 0, 0.1, 0.1);
        line(sil.get(0.55), b0[0], b0[1], b1[0], b1[1], 0.18, 0, 0.1, 0.1);
      }
      const ringL = (h, rad, B, w) => { const pts = []; for (let k = 0; k <= 48; k++) { const p = at(-Math.PI / 2 + Math.PI * k / 48, h, rad); pts.push(p[0], p[1]); } stroke(B, pts, w, 0.02, 0.02); return pts; };
      ringL(0.5, Rd, silHi.get(0.95), 0.6);
      ringL(6, Rd, sil.get(0.8), 0.3);
      ringL(H - 8, Rd, sil.get(0.8), 0.3);
      // eave: a gold band with beads
      const eaveB = ringL(H, Rd * 1.1, goldHi.get(1), 0.7);
      ringL(H - 2.4, Rd * 1.08, gold.get(0.9), 0.35);
      for (let k = 2; k < eaveB.length - 2; k += 2) if (k % 4 === 0) dot(goldHi.get(0.95), eaveB[k], eaveB[k + 1] + 1.2, 0.42);
      // the roof: golden ribs to the trunk and rows of scales
      const rTop = T.r(base - H - HR) * 1.15;
      const roofPt = (q, u) => at(q * (1 - u * 0.12), H + HR * (u * u * (3 - 2 * u)), lerp(Rd * 1.1, rTop, u));
      {
        const Rx = [], Ry = [];
        for (let k = 0; k <= 30; k++) { const p = roofPt(-Math.PI / 2 + Math.PI * k / 30, 0); Rx.push(p[0]); Ry.push(p[1]); }
        for (let k = 30; k >= 0; k--) { const p = roofPt(-Math.PI / 2 + Math.PI * k / 30, 1); Rx.push(p[0]); Ry.push(p[1]); }
        const Rf = new Path2D(); poly(Rf, Rx, Ry, Rx.length); fill(Rf, INK.gold, 0.3, 'g', 0.5);
      }
      for (let k = 0; k <= 22; k++) {
        const q = -Math.PI / 2 + Math.PI * k / 22; const pts = [];
        for (let u = 0; u <= 1.001; u += 0.1) { const p = roofPt(q, u); pts.push(p[0], p[1]); }
        stroke(goldHi.get(0.6 + 0.4 * Math.cos(q)), pts, 0.32, 0.02, 0.3);
      }
      for (let row = 1; row < 7; row++) {
        const u = row / 7; const n = Math.round(lerp(60, 26, u));
        for (let k = 0; k < n; k++) {
          const q = -Math.PI / 2 + Math.PI * (k + 0.5) / n; const c = Math.cos(q); if (c < 0.05) continue;
          const p = roofPt(q, u), p2 = roofPt(q + Math.PI / n * 0.9, u), p3 = roofPt(q - Math.PI / n * 0.9, u);
          stroke(gold.get(0.5 + 0.4 * c), quad(p3[0], p3[1], p[0], p[1] + 2.4, p2[0], p2[1], 4), 0.17, 0.2, 0.2);
        }
      }
      ringL(H + HR, rTop, goldHi.get(0.9), 0.5);
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
      // the boughs from which the silver lamps swing
      for (const Lp of fountLamps) {
        const bx = Lp.ax, by = Lp.ay;
        const foot = x + (bx - x) * 2.2;
        stroke(silHi.get(0.85), quad(foot, y + 4, foot + (bx - foot) * 0.1, by - 6, bx, by, 12), 0.45, 0.05, 0.3);
        stroke(sil.get(0.6), quad(foot + 1, y + 4, foot + (bx - foot) * 0.15 + 1, by - 5, bx, by + 0.5, 12), 0.2, 0.05, 0.3);
      }
      white.flush(); sil.flush(); silHi.flush();
    }

    /* ---- the Fellowship, led up the hill by the Elves */
    function figure(x, yf, h, kind, step) {
      // seen from behind, walking up the path; the lamp ahead lights their right-hand side
      const s = h;
      const sh = { elf: 0.12, elfbow: 0.12, man: 0.145, boro: 0.17, dwarf: 0.24, hob: 0.17 }[kind] || 0.14;
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
      const company = [['elf', 19, 'lamp'], ['man', 18.5], ['hob', 10.5], ['hob', 10.2], ['elfbow', 18.4], ['dwarf', 12.2], ['hob', 10], ['hob', 10.1], ['boro', 19], ['elf', 18.6, 'lamp']];
      let d = 30 + J(4);
      const placed = [];
      for (const [kind, h, extra] of company) {
        const [x, y] = at(d);
        placed.push([x, y, kind, h, extra]);
        d += h * 0.5 + rr(1.5, 3.5);
      }
      // draw from the back of the line to the front
      for (let i = placed.length - 1; i >= 0; i--) {
        const [x, y, kind, h, extra] = placed[i];
        figure(x, y + 0.6, h, kind, i % 2 ? 1 : -1);
        if (extra === 'lamp') {
          const lx = x + 0.38 * h, ly = y - 1.18 * h;
          line(silHi.get(0.95), x + 0.08 * h, y, lx, ly + 2, 0.22, 0, 0.02, 0.02);
          drawLamp({ x: lx, y: ly + 4, s: 2.6, c: i === 0 ? 'g' : 'y', kind: 'hang', ax: lx, ay: ly });
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
          if (x > GX - 38 && x < GX + 38) { x = GX + 38; continue; }
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
        const x2 = Math.min(PX1, x + rr(40, 140)); if (x2 > GX - 34 && x < GX + 34) { x = GX + 34; continue; }
        const pts = []; for (let xx = x; xx <= x2; xx += 4) pts.push(xx, WALLTOP(xx) + 0.6 * nz(xx / 5));
        stroke(silHi.get(clamp(0.45 + light((x + x2) / 2, WALLTOP(x)) * 0.5, 0, 1)), pts, 0.42, 0.05, 0.1);
        x = x2 + rr(2, 12);
      }
      sil.flush(); silHi.flush();
      yield;
      // the gate: slender engraved pillars, an ogee arch with a beaded soffit, doors folded back
      const gl = GX - 32, gr = GX + 32, top = 1114, base = WALLBASE(GX);
      const pw = 11;
      {
        const O = new Path2D(); poly(O, [gl - pw / 2 - 1, gr + pw / 2 + 1, gr + pw / 2 + 1, gl - pw / 2 - 1], [base + 1, base + 1, WALLTOP(GX) - 2, WALLTOP(GX) - 2], 4); erase(O);
      }
      // through the gateway: the path running in and up, between dark turf
      {
        const yt = WALLTOP(GX) - 4;
        const pts = [GX, base, GX + 3, yt], hws = [24, 15];
        for (let y = base - 0.8; y > yt + 1; y -= lerp(1.8, 3.6, (y - yt) / (base - yt))) {
          const u = (y - yt) / (base - yt), hw = lerp(15, 24, u), Lm = light(GX, y);
          for (let x = GX - hw; x < GX + hw;) { const x2 = Math.min(GX + hw, x + rr(3, 7) * (0.6 + u)); ribbon(white.get(clamp(0.35 + Lm * 0.45 + u * 0.2, 0, 1)), [x, y, x2, y], [lerp(0.5, 1.0, u), lerp(0.5, 1.0, u)]); x = x2 + rr(0.3, 0.9); }
        }
        for (let k = 0; k < 300; k++) { const y = rr(yt, base), hw = lerp(15, 24, (y - yt) / (base - yt)), x = GX + rr(-1.1, 1.1) * hw; if (Math.abs(x - GX) > hw) flick(sil.get(0.6), x, y, rr(1.5, 3), rr(-0.5, 0.5), 0.12); }
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
      const archPts = (o) => { const a = []; for (let k = 0; k <= 30; k++) { const t = k / 30; const xx = lerp(gl - pw / 2 + 2, gr + pw / 2 - 2, t); const sv = Math.sin(t * Math.PI); const yy = top - o - 30 * Math.pow(sv, 0.7) * (1 - 0.18 * Math.sin(t * TAU) * Math.sign(t - 0.5) * 0) - 6 * Math.pow(sv, 6); a.push(xx, yy); } return a; };
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
        const ox = hx - sg * 11;
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
      const rx = 500, ry = 1372, rad = 40;
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
          const G = Foliage(); G.gaps = false;
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
        // the silver ewer beside it
        const ex = rx - 22, ey = ry + 15;
        const Ew = []; for (let k = 0; k <= 14; k++) { const t = k / 14, a = -Math.PI / 2 + t * Math.PI; Ew.push(ex + Math.cos(a) * 2.6 * Math.sin(t * Math.PI * 0.95 + 0.1), ey - 7 + t * 8); }
        stroke(silHi.get(0.95), Ew, 0.26, 0.05, 0.05);
        stroke(silHi.get(0.95), [ex - 2.4, ey + 1, ex + 2.4, ey + 1], 0.3, 0.05, 0.05);
        stroke(silHi.get(0.9), quad(ex - 0.8, ey - 7, ex - 4.5, ey - 7.5, ex - 5.5, ey - 9.5, 5), 0.2, 0.1, 0.3);
        stroke(silHi.get(0.9), quad(ex + 1.5, ey - 6, ex + 5, ey - 4.5, ex + 2.2, ey - 1, 6), 0.2, 0.1, 0.1);
        // the evening star above, alone
        const sx = rx - 6, sy = ry - 25;
        line(silHi.get(1), sx - 6, sy, sx + 6, sy, 0.22, 0, 0.5, 0.5); line(silHi.get(1), sx, sy - 7, sx, sy + 7, 0.22, 0, 0.5, 0.5);
        line(silHi.get(0.8), sx - 3, sy - 3, sx + 3, sy + 3, 0.14, 0, 0.5, 0.5); line(silHi.get(0.8), sx - 3, sy + 3, sx + 3, sy - 3, 0.14, 0, 0.5, 0.5);
        const Es = new Path2D(); dot(Es, sx, sy, 0.9); fill(Es, INK.white, 1, 'p', 1);
        for (let k = 0; k < 40; k++) { const a = R() * TAU, d = rr(10, 38); const x = rx + Math.cos(a) * d, y = ry - 4 + Math.sin(a) * d * 0.6; if (y < ry - 12 && clipIn(x, y)) dot(sil.get(0.6), x, y, rr(0.15, 0.32)); }
        sil.flush(); silHi.flush(); white.flush(); goldHi.flush();
      }
      // a mallorn leaf to either side of the roundel, on the rule
      for (const s of [-1, 1]) {
        const G = Foliage();
        for (let k = 0; k < 5; k++) addLeaf(G, rx + s * (rad + 6 + k * 7), DH - 27.2 + (k % 2 ? 2.5 : -2.5), s > 0 ? (k % 2 ? 0.5 : -0.5) : Math.PI + (k % 2 ? -0.5 : 0.5), 6.5, 0.36, 1, 'lit');
        flushFoliage(G, 1, 'lit');
      }
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
    const specks = lampsOf((L) => L.kind === 'speck');
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
    tasks.push(drawHill);
    tasks.push(treePass(L1));
    tasks.push(treePass(R1));
    tasks.push(treePass(KT));
    tasks.push(function* () {
      drawFountain();
      for (const L of groundLamps) if (L.y < 1176) drawLamp(L);
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
