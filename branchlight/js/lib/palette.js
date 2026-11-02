/* Branchlight — the shared 64-colour palette and the quantiser.
 *
 * Soft pixels: for each colour we pick the best PAIR of nearby palette colours and a
 * mix ratio (Yliluoma-style, in OKLab, with a penalty on mixing far-apart colours so
 * gradients stay calm), then a 4×4 Bayer threshold chooses one of the two. The result
 * is a clean two-colour pattern, never three-colour mud.
 * Crisp pixels: nearest palette colour.
 */
(function () {
  'use strict';
  const BL = window.BL;

  const HEX = [
    // lights & creams
    'ffffff', 'fff8ec', 'fbefd9', 'f3e1c2', 'e9cfa6', 'fde6d0',
    // dawn peach / rose
    'f7e4d8', 'f4cfc0', 'eeb3a0', 'e5927f', 'd4766b',
    // cool greys / slate
    'eef0f2', 'dcdfe4', 'c5cad3', 'a9b0bc', '8b93a3', '6b7385', '4a5164', '2e3344',
    // lilac / violet
    'e6dde8', 'cbbfd3', 'a597b4', '7a6d90',
    // crimson → vermilion
    '6e1420', '9e1c24', 'c8262a', 'e3402c', 'f2643a',
    // orange / ochre
    'f58c3e', 'f8ad5c', 'fbc985', 'd9953a', 'b5762a', 'e9b85a',
    // gold
    'fff0c4', 'fde09a', 'f5c76a',
    // cobalt / blue
    '12245e', '1e3f96', '2f62c0', '5c8fd8', '9dbde6',
    // teal
    '0b4a52', '11727a', '1d9c9a', '58c2b6', 'a6ddd2',
    // umber / near-black
    '120c10', '241519', '3a2020', '5c3020', '7e4528', 'a2643a', 'c48a5a',
    // meadow
    '5e6b3a', '8a9550', 'b9b870', 'd8cf8e',
    // raspberry / pink
    'b8345a', 'e0708a', 'f3a9b5',
    // warm greys
    'd8c8bd', 'b5a397', '8c7a70'
  ];
  const PAL = HEX.map(BL.hex);
  BL.PALETTE = PAL;
  BL.PALETTE_HEX = HEX;

  // Named colours for drawing (all exact palette entries).
  const C = {};
  const names = {
    white: 'ffffff', warmWhite: 'fff8ec', cream: 'fbefd9', cream2: 'f3e1c2', sand: 'e9cfa6', apricotWhite: 'fde6d0',
    blush: 'f7e4d8', peachPale: 'f4cfc0', peach: 'eeb3a0', salmon: 'e5927f', rose: 'd4766b',
    coolWhite: 'eef0f2', paleGrey: 'dcdfe4', grey: 'c5cad3', slateLight: 'a9b0bc', slate: '8b93a3', slateDark: '6b7385', deepSlate: '4a5164', ink: '2e3344',
    lilacWhite: 'e6dde8', lilac: 'cbbfd3', lilacMid: 'a597b4', violet: '7a6d90',
    deepCrimson: '6e1420', crimson: '9e1c24', red: 'c8262a', vermilion: 'e3402c', vermilionLight: 'f2643a',
    orange: 'f58c3e', lightOrange: 'f8ad5c', apricot: 'fbc985', ochre: 'd9953a', darkOchre: 'b5762a', goldOchre: 'e9b85a',
    paleGold: 'fff0c4', goldLight: 'fde09a', gold: 'f5c76a',
    navy: '12245e', cobalt: '1e3f96', blue: '2f62c0', skyBlue: '5c8fd8', paleBlue: '9dbde6',
    deepTeal: '0b4a52', teal: '11727a', tealLight: '1d9c9a', aqua: '58c2b6', paleAqua: 'a6ddd2',
    black: '120c10', plum: '241519', darkUmber: '3a2020', umber: '5c3020', brown: '7e4528', lightBrown: 'a2643a', tan: 'c48a5a',
    olive: '5e6b3a', sage: '8a9550', dryGrass: 'b9b870', paleGrass: 'd8cf8e',
    raspberry: 'b8345a', pink: 'e0708a', palePink: 'f3a9b5',
    warmGrey: 'd8c8bd', warmGreyMid: 'b5a397', warmGreyDark: '8c7a70'
  };
  for (const k in names) C[k] = BL.hex(names[k]);
  BL.C = C;

  /* ------------------------------------------------------------- OKLab */
  const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  function oklab(r, g, b) {
    r = lin(r); g = lin(g); b = lin(b);
    const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
    const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
    const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    return [
      0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
      1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
      0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
    ];
  }
  const LAB = PAL.map((c) => oklab(c[0], c[1], c[2]));
  const NP = PAL.length;
  const LW = 1.4; // lightness weight
  function d2(a, b) {
    const dl = (a[0] - b[0]) * LW, da = a[1] - b[1], db = a[2] - b[2];
    return dl * dl + da * da + db * db;
  }

  // Caches keyed by 6 bits per channel.
  const NEAR = new Int16Array(1 << 18).fill(-1);
  const PAIR = new Int32Array(1 << 18).fill(-1);
  const key = (r, g, b) => ((BL.clamp(r, 0, 255) >> 2) << 12) | ((BL.clamp(g, 0, 255) >> 2) << 6) | (BL.clamp(b, 0, 255) >> 2);
  const keyRGB = (k) => [((k >> 12) & 63) * 4 + 2, ((k >> 6) & 63) * 4 + 2, (k & 63) * 4 + 2];

  function nearest(k) {
    let v = NEAR[k];
    if (v >= 0) return v;
    const c = keyRGB(k), L = oklab(c[0], c[1], c[2]);
    let best = 0, bd = 1e9;
    for (let i = 0; i < NP; i++) { const d = d2(L, LAB[i]); if (d < bd) { bd = d; best = i; } }
    NEAR[k] = best;
    return best;
  }
  BL.nearestIndex = (c) => nearest(key(c[0] | 0, c[1] | 0, c[2] | 0));
  BL.snap = (c) => PAL[BL.nearestIndex(c)];

  const PENALTY = 0.35;
  function pair(k) {
    let v = PAIR[k];
    if (v >= 0) return v;
    const c = keyRGB(k), L = oklab(c[0], c[1], c[2]);
    // 8 nearest candidates
    const cand = [];
    for (let i = 0; i < NP; i++) cand.push([d2(L, LAB[i]), i]);
    cand.sort((a, b) => a[0] - b[0]);
    let best = (cand[0][1]) | (cand[0][1] << 8), bestE = cand[0][0];
    for (let a = 0; a < 8; a++) for (let b = a + 1; b < 8; b++) {
      const A = LAB[cand[a][1]], B = LAB[cand[b][1]];
      const ab = [(B[0] - A[0]) * LW, B[1] - A[1], B[2] - A[2]];
      const ac = [(L[0] - A[0]) * LW, L[1] - A[1], L[2] - A[2]];
      const len2 = ab[0] * ab[0] + ab[1] * ab[1] + ab[2] * ab[2];
      if (len2 < 1e-9) continue;
      let t = (ab[0] * ac[0] + ab[1] * ac[1] + ab[2] * ac[2]) / len2;
      t = BL.clamp(t, 0, 1);
      t = Math.round(t * 8) / 8; // 9 mix levels keep patterns orderly
      const ex = ac[0] - ab[0] * t, ey = ac[1] - ab[1] * t, ez = ac[2] - ab[2] * t;
      const e = ex * ex + ey * ey + ez * ez + PENALTY * len2 * (t * (1 - t));
      if (e < bestE) { bestE = e; best = cand[a][1] | (cand[b][1] << 8) | (Math.round(t * 8) << 16); }
    }
    PAIR[k] = best;
    return best;
  }

  // Quantise a surface into palette indices.
  BL.quantise = function (S) {
    const W = S.W, H = S.H, out = new Uint8Array(W * H), d = S.rgb;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const p = y * W + x, i = p * 3;
      const k = key(d[i] | 0, d[i + 1] | 0, d[i + 2] | 0);
      if (S.mode[p] === 1) { out[p] = nearest(k); continue; }
      const v = pair(k);
      const a = v & 255, b = (v >> 8) & 255, t = ((v >> 16) & 255) / 8;
      out[p] = BL.bayer(x, y) < t ? b : a;
    }
    return out;
  };

  // Indexed 360×640 → canvas at ×scale, nearest-neighbour, written pixel by pixel.
  BL.toCanvas = function (idx, scale, canvas) {
    const W = BL.W, H = BL.H, s = scale || BL.SCALE;
    canvas = canvas || document.createElement('canvas');
    canvas.width = W * s; canvas.height = H * s;
    const ctx = canvas.getContext('2d');
    const img = ctx.createImageData(W * s, H * s);
    const D = img.data, OW = W * s;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const c = PAL[idx[y * W + x]];
      for (let j = 0; j < s; j++) {
        let o = ((y * s + j) * OW + x * s) * 4;
        for (let i = 0; i < s; i++, o += 4) { D[o] = c[0]; D[o + 1] = c[1]; D[o + 2] = c[2]; D[o + 3] = 255; }
      }
    }
    ctx.putImageData(img, 0, 0);
    return canvas;
  };
})();
