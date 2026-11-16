// light.js -- the colours, the lights of the street (all of them out of focus), and what they do to the cloth:
// what falls on its underside, and what comes through it where it has worn thin.
(function (G) {
  'use strict';
  const A = G.ART, hx = A.hex, vn = A.vn, fbm = A.fbm, ss = A.sstep, clamp = A.clamp, mix = A.mix, Wd = A.Wd, N = Wd.N;

  // ------------------------------------------------------------------ colours: the box of an '80s background painter
  const c = (Wd.c = {
    ink: hx('#0a0c2c'), night: hx('#10154a'), indigo: hx('#1b2170'), ultra: hx('#2633a4'), cobalt: hx('#2d5ad0'), azure: hx('#3f8fe6'), cerul: hx('#62bdf0'), aqua: hx('#9fe6ee'),
    dteal: hx('#0f5878'), teal: hx('#1699a8'), jade: hx('#3fc7ae'), mint: hx('#c4f2de'),
    violet: hx('#46309a'), purple: hx('#6a3aa2'), orchid: hx('#9b46ac'), magenta: hx('#cc3f98'), hot: hx('#f04f8e'), rose: hx('#f78fb2'), blush: hx('#fcc6d2'),
    coral: hx('#ff7c6c'), salmon: hx('#ff9a7e'), orange: hx('#ff9950'), amber: hx('#ffbb52'), gold: hx('#ffd067'), lemon: hx('#ffe88e'), cream: hx('#fff4d2'), white: hx('#fffdf5'),
    red: hx('#f0405a'), green: hx('#45d68a'), lav: hx('#b3a5f0'), lilac: hx('#d6ccf8'), ice: hx('#cfe6ff'),
    steelL: hx('#aab4d8'), steel: hx('#6f78a4'), steelD: hx('#3a3f6c'), iron: hx('#1a1c3c'), rust: hx('#b0563a'), rustD: hx('#6e3232'), brass: hx('#d1a857'), brassD: hx('#8a6a3a'),
    graphite: hx('#4a4a5c'), thread: hx('#c9c2b0'), threadD: hx('#7f7a80'), chalkY: hx('#fff0a8'), chalkP: hx('#ffc4d6'), chalkW: hx('#fbf8ee'), chalkB: hx('#bfe6f6'),
    patchCream: hx('#f4ead0'), gingR: hx('#d9485a'), gingW: hx('#f3e9df'), dotT: hx('#5d9aa8'),
  });

  // ------------------------------------------------------------------ the lights of the street
  // x, y on the sheet, r = radius of the blurred disc, c = colour, a = strength
  const L = (Wd.LIGHTS = []);
  const add = (x, y, r, col, a) => L.push({ x, y, r, c: typeof col === 'string' ? hx(col) : col, a: a === undefined ? 1 : a });
  // behind the cloth
  add(1166, 322, 80, '#ffc15a', 1.0);     // the street lamp
  add(905, 612, 66, '#f5508f', 0.95);     // a pink sign
  add(205, 505, 76, '#45cfe0', 0.9);      // a blue-green one
  add(702, 62, 62, '#8f8cf5', 0.85);
  add(246, 66, 52, '#c84fb0', 0.62);
  add(1012, 128, 42, '#d84fb0', 0.72);
  add(418, 152, 48, '#2fb8b0', 0.8);
  add(764, 424, 34, '#ff9a55', 0.6);
  add(1332, 118, 46, '#ffe58a', 0.7);
  add(92, 252, 52, '#f78fb2', 0.75);
  add(542, 688, 40, '#bfe0ff', 0.6);
  add(1092, 522, 30, '#f0405a', 0.62);
  add(330, 332, 26, '#45d68a', 0.5);
  add(1240, 596, 26, '#ffd067', 0.6);
  add(60, 560, 30, '#b3a5f0', 0.5);
  // out in the open
  add(1456, 598, 84, '#ffbb52', 1.0);
  add(1374, 802, 60, '#f04f8e', 0.95);
  add(1548, 762, 46, '#4fd6e4', 0.9);
  add(1502, 438, 34, '#ffe88e', 0.9);
  add(1102, 860, 56, '#ff9950', 0.9);
  add(1236, 884, 38, '#cc3f98', 0.85);
  add(112, 812, 54, '#1fb0b8', 0.8);
  add(346, 884, 40, '#ffbb52', 0.8);
  add(586, 874, 30, '#f78fb2', 0.8);
  add(716, 884, 22, '#ffe88e', 0.85);
  add(1580, 872, 20, '#f0405a', 0.9);
  add(1534, 884, 18, '#f0405a', 0.85);
  add(1422, 500, 20, '#45d68a', 0.8);
  add(1578, 330, 28, '#b3a5f0', 0.75);
  add(1340, 612, 22, '#cfe6ff', 0.85);
  add(1556, 36, 30, '#b3a5f0', 0.7);
  add(1500, 88, 13, '#ffd067', 0.8);
  add(28, 730, 30, '#62bdf0', 0.7);
  add(222, 764, 18, '#ffd067', 0.8);
  add(58, 884, 26, '#f04f8e', 0.7);
  add(952, 878, 26, '#9fe6ee', 0.7);
  add(1460, 716, 24, '#fff4d2', 0.8);
  add(1392, 420, 14, '#ff7c6c', 0.8);
  add(1300, 870, 16, '#ffe88e', 0.8);
  { // and the small far ones
    const R = A.rng(424242), pal = ['#ffbb52', '#ffd067', '#f04f8e', '#f78fb2', '#4fd6e4', '#b3a5f0', '#ffe88e', '#ff9950', '#cfe6ff', '#ff7c6c', '#45d68a', '#cc3f98'];
    for (let i = 0; i < 46; i++) {
      const x = R.r(0, 1600), y = R.r(0, 900), far = R() < 0.6;
      add(x, y, far ? R.r(5, 11) : R.r(11, 20), R.pick(pal), R.r(0.45, 0.85));
    }
  }
  Wd.nMajor = 39;

  // the air of the night, without the lights in it
  const nightRamp = A.ramp([[0, hx('#080b2c')], [0.3, hx('#0f1447')], [0.55, hx('#1c1a66')], [0.76, hx('#33207a')], [0.92, hx('#522a86')], [1.05, hx('#74328a')]]);
  const tealNight = hx('#0b3c60');
  function air(x, y, out) {
    const t = clamp(0.60 * (x / 1600) + 0.52 * (y / 900) - 0.16 + 0.10 * (fbm(x / 420, y / 300, 71, 3) - 0.5), 0, 1.05);
    nightRamp(t, out);
    const tl = ss(820, 60, x) * ss(430, 900, y) * 0.55; out[0] += (tealNight[0] - out[0]) * tl; out[1] += (tealNight[1] - out[1]) * tl; out[2] += (tealNight[2] - out[2]) * tl;
    return out;
  }
  // precomputed at a quarter of the design size: NG = the air with every light's haze in it; BG = the same plus the
  // blurred discs themselves (what stands behind a point of the cloth)
  const QW = 400, QH = 225;
  Wd.buildLight = function () {
    if (Wd.NG) return;
    const NG = (Wd.NG = new Float32Array(QW * QH * 3)), BG = (Wd.BG = new Float32Array(QW * QH * 3)), CG = (Wd.CG = new Float32Array(QW * QH * 3)), o = [0, 0, 0];
    for (let y = 0; y < QH; y++) for (let x = 0; x < QW; x++) {
      const ux = (x + 0.5) * 4, uy = (y + 0.5) * 4; air(ux, uy, o);
      let r = o[0], g = o[1], b = o[2], r2 = 0, g2 = 0, b2 = 0, r3 = 0, g3 = 0, b3 = 0;
      for (let i = 0; i < L.length; i++) {
        const l = L[i], dx = ux - l.x, dy = uy - l.y, d2 = dx * dx + dy * dy, hr = l.r * 2.6 + 26; if (d2 > hr * hr * 6) continue;
        const h = l.a * 0.24 * Math.exp(-d2 / (hr * hr * 0.7)) * (l.r < 12 ? 0.3 : l.r < 21 ? 0.6 : 1);
        r = 1 - (1 - r) * (1 - l.c[0] * h); g = 1 - (1 - g) * (1 - l.c[1] * h); b = 1 - (1 - b) * (1 - l.c[2] * h);
        const d = Math.sqrt(d2), dsc = l.a * (1 - ss(l.r * 0.72, l.r * 1.3 + 4, d)) * 0.9; r2 += l.c[0] * dsc; g2 += l.c[1] * dsc; b2 += l.c[2] * dsc;
        const sf = l.a * Math.exp(-d2 / (l.r * l.r * 2.6 + 300)) * (l.r < 12 ? 0.55 : 0.95); r3 += l.c[0] * sf; g3 += l.c[1] * sf; b3 += l.c[2] * sf;
      }
      const j = (y * QW + x) * 3; NG[j] = r; NG[j + 1] = g; NG[j + 2] = b;
      CG[j] = 1 - (1 - r) * (1 - Math.min(0.97, r3)); CG[j + 1] = 1 - (1 - g) * (1 - Math.min(0.97, g3)); CG[j + 2] = 1 - (1 - b) * (1 - Math.min(0.97, b3));
      BG[j] = 1 - (1 - r) * (1 - Math.min(0.97, r2)); BG[j + 1] = 1 - (1 - g) * (1 - Math.min(0.97, g2)); BG[j + 2] = 1 - (1 - b) * (1 - Math.min(0.97, b2));
    }
  };
  function samp(T, x, y, out) {
    let fx = x / 4 - 0.5, fy = y / 4 - 0.5; if (fx < 0) fx = 0; if (fy < 0) fy = 0; if (fx > QW - 1.001) fx = QW - 1.001; if (fy > QH - 1.001) fy = QH - 1.001;
    const xi = fx | 0, yi = fy | 0, j = (yi * QW + xi) * 3; fx -= xi; fy -= yi; const w00 = (1 - fx) * (1 - fy), w10 = fx * (1 - fy), w01 = (1 - fx) * fy, w11 = fx * fy, j2 = j + QW * 3;
    out[0] = T[j] * w00 + T[j + 3] * w10 + T[j2] * w01 + T[j2 + 3] * w11; out[1] = T[j + 1] * w00 + T[j + 4] * w10 + T[j2 + 1] * w01 + T[j2 + 4] * w11; out[2] = T[j + 2] * w00 + T[j + 5] * w10 + T[j2 + 2] * w01 + T[j2 + 5] * w11;
    return out;
  }
  Wd.night = (x, y, out) => samp(Wd.NG, x, y, out);      // the lit air at a point of the sheet
  Wd.behind = (x, y, out) => samp(Wd.BG, x, y, out);
  Wd.through = (x, y, out) => samp(Wd.CG, x, y, out);     // the same, as a worn cloth would soften it     // air and lamps: what a hole in the cloth would show there

  // ------------------------------------------------------------------ the cloth
  // every gore of an old umbrella has faded a little differently
  const gore = []; { const R = A.rng(1999); for (let g = 0; g < N; g++) gore.push({ k: 0.8 + 0.4 * R(), hue: R() - 0.5, side: R() < 0.5 ? 1 : -1, seed: (R() * 9999) | 0 }); }
  Wd.gore = gore;
  // how thin the cloth has worn (0 sound .. 1 threadbare): along the fold down the middle of each gore, where it
  // rubs on the rib tips and round the crown, and in a few places for no reason anybody remembers
  Wd.wear = function (th, s) {
    const g = Math.floor(th) % N, u = th - Math.floor(th), sd = gore[g].seed;
    const mid = Math.exp(-Math.pow((u - 0.5) / 0.03, 2)) * ss(0.10, 0.3, s) * (0.35 + 0.95 * ss(0.40, 0.70, vn(s * 7 + sd, 1.5, 51)));
    const q1 = Math.exp(-Math.pow((u - 0.25) / 0.02, 2)) + Math.exp(-Math.pow((u - 0.75) / 0.02, 2));
    const quarter = q1 * ss(0.3, 0.6, s) * 0.6 * ss(0.5, 0.75, vn(s * 9 + sd + 40, 3.5, 52));
    const e = Math.min(u, 1 - u), tip = ss(0.80, 0.97, s) * ss(0.2, 0.03, e) * 0.8;
    const crown = ss(0.20, 0.07, s) * 0.5 * (0.5 + vn(th * 5, 2.2, 53));
    const blot = ss(0.60, 0.80, fbm(th * 2.6 + 7, s * 5.2 + sd * 0.01, 54, 3)) * 0.85;
    const blot2 = ss(0.66, 0.8, vn(th * 9 + 3, s * 17, 55)) * 0.35;
    return clamp(mid + quarter + tip + crown + blot + blot2, 0, 1);
  };
  // the light from below: warm from the shop fronts to the right and ahead, cold from the left. (how strongly, 0..1)
  const warmRamp = A.ramp([[0, hx('#090b2b')], [0.16, hx('#0f1444')], [0.34, hx('#181d66')], [0.5, hx('#272884')], [0.63, hx('#432c94')], [0.75, hx('#6d349c')], [0.86, hx('#a63a98')], [0.95, hx('#dc4c8c')], [1.04, hx('#fb7078')], [1.14, hx('#ff9a6e')]]);
  const coolA = hx('#0f4f7e'), coolB = hx('#1c93a8');
  const tb = [0, 0, 0], _n = [0, 0, 0];
  // folds: the cloth gathered at the crown, pulled into the rib tips, and the slow sag between
  Wd.fold = function (th, s) {
    const g = Math.floor(th), u = th - g, sd = gore[g % N].seed;
    let f = 0;
    f += ss(0.30, 0.02, s) * 0.55 * Math.sin(th * 2 * Math.PI * 3.5 + 4 * vn(th * 3, s * 6, 61));
    const e = Math.min(u, 1 - u), dt = Math.hypot(e * 1.6, 1 - s);                                   // near a tip
    f += ss(0.42, 0.04, dt) * 0.5 * Math.sin(Math.atan2(1.02 - s, e * 1.6 + 0.01) * 15 + sd);
    f += 0.5 * (fbm(th * 1.7 + sd, s * 2.6, 62, 3) - 0.5) * 2 * (0.35 + 0.65 * s);
    f += 0.22 * (vn(u * 9 + sd, s * 24, 63) - 0.5) * 2;
    return f;
  };
  // the colour of the underside of the cloth at a point (before anything shines through it). returns the warm measure.
  Wd.under = function (x, y, th, s, out) {
    const g = Math.floor(th) % N, u = th - Math.floor(th), go = gore[g];
    const scr = clamp(0.66 * (x / 1600) + 0.52 * (y / 900) - 0.12, 0, 1.2), hem = Math.pow(clamp(s, 0, 1.05), 1.5);
    let t = (0.05 + 0.20 * scr + 0.86 * scr * hem + 0.05 * hem) * go.k + 0.22 * scr * hem * hem * hem + 0.2 * (go.k - 1);
    t += 0.10 * go.side * (u - 0.5) * (0.4 + 0.6 * s);                                         // one flank of every gore catches a little more
    t += 0.04 * Wd.fold(th, s);
    t -= 0.06 * (Math.exp(-u * u / 0.0009) + Math.exp(-(1 - u) * (1 - u) / 0.0009));            // the seam along each rib, double cloth
    t += 0.05 * (fbm(x / 60, y / 60, 64, 2) - 0.5);
    warmRamp(t, out);
    // the cold light from the left
    const cl = ss(900, 40, x) * (0.25 + 0.75 * hem) * ss(0.2, 0.8, y / 900 + 0.25) * 0.72 * (0.8 + 0.4 * go.hue);
    if (cl > 0.002) { const q = ss(0.2, 0.9, hem * (1.15 - x / 1000)); tb[0] = coolA[0] + (coolB[0] - coolA[0]) * q; tb[1] = coolA[1] + (coolB[1] - coolA[1]) * q; tb[2] = coolA[2] + (coolB[2] - coolA[2]) * q; out[0] += (tb[0] - out[0]) * cl; out[1] += (tb[1] - out[1]) * cl; out[2] += (tb[2] - out[2]) * cl; }
    return t;
  };
  // how much of what is behind it the cloth lets through at a point
  Wd.thru = function (th, s, w) {
    const u = th - Math.floor(th), seam = Math.exp(-u * u / 0.0012) + Math.exp(-(1 - u) * (1 - u) / 0.0012);
    return clamp(0.13 + 0.5 * (w === undefined ? Wd.wear(th, s) : w), 0, 1) * (1 - 0.6 * seam) * ss(0.0, 0.035, Wd.smax(th) - s + 0.012);
  };
  // the cloth as it looks from under it: its own colour, and the street glowing through
  const _b = [0, 0, 0];
  Wd.clothCol = function (x, y, th, s, out) {
    const t = Wd.under(x, y, th, s, out), w = Wd.wear(th, s), tr = Wd.thru(th, s, w);
    Wd.through(x, y, _b);
    // a bright thing behind thin cloth does not just add to it, it takes its place
    const mx = Math.max(_b[0], _b[1], _b[2]), a = tr * (0.3 + 0.9 * mx);
    out[0] += (_b[0] - out[0]) * a; out[1] += (_b[1] * 0.96 - out[1]) * a; out[2] += (_b[2] - out[2]) * a * 0.9;
    return t;
  };
})(typeof self !== 'undefined' ? self : globalThis);
