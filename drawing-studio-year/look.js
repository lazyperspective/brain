/* A YEAR, STILL WARM — the light, and the colours it is allowed to be.
 *
 * The original drawing reached for its colours through ramps that slide from an
 * inky indigo through teal and green to butter and bare paper. A year needs more
 * than one dusk, so here the same philosophy is written as a small lighting model:
 *
 *   colour = grade( albedo x (sun x how-it-falls x what-shades-it  +  sky  +  the small light) )
 *
 * where `grade` is the artist's eye: darks are never grey, they sink into the ink
 * of the hour (indigo at night, blue-teal by day, violet at dusk); lights roll off
 * into the cream of the paper; and every stroke leans towards one of the sticks in
 * the box, so the sheet is always made of crayons and never of a gradient.
 */
'use strict';
const { c01, sstep, lerp, KX, KY, XC, HOR } = require('./clock.js');

const hex = h => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];
const mix3 = (a, b, k, o) => { o[0] = a[0] + (b[0] - a[0]) * k; o[1] = a[1] + (b[1] - a[1]) * k; o[2] = a[2] + (b[2] - a[2]) * k; return o; };

// ---------- the box. The first 41 are the original's; the rest were bought for the other seasons.
const BOX = {
  lastBusIndigo: '#141a52', schoolInk: '#1c2f7c', tinTrunkCobalt: '#25509e', kiteString: '#2f7fae', peppermintDusk: '#5fb0b4',
  unripeGuava: '#c4cfaa', jaggeryLight: '#ffd596', papaya: '#ff9c70', roseSherbet: '#ee7288', periwinkle: '#565cb2',
  jacaranda: '#8672c4', bougainvillea: '#cc78b6', guavaPink: '#f5859c', peachSkin: '#ffb48e', butter: '#ffe4b0',
  lemonDrop: '#ffe066', newLeaf: '#b4d862', grass: '#86b85a', parrot: '#3f9466', pondGreen: '#1c6c60',
  wellWater: '#144d5a', deepTeal: '#123358', turquoiseBead: '#5cc0ae', sandalwood: '#c79a6a', terracotta: '#bf6a44',
  tamarind: '#7a3e50', aubergine: '#3c2852', inkPlum: '#221a3e', marigold: '#f7dc6a', turmeric: '#eda653',
  farHill: '#5b56a6', dusk: '#27408f', mauve: '#a476b6', paleSky: '#8088dc', seaGlass: '#6fa6cf', moth: '#fff1bd',
  moss: '#7d9a45', oldGold: '#c9a942', nightGreen: '#10304e', duskRose: '#c97cac', slate: '#45457f',
  // --- for noon, for rain, for October, for snow
  schoolShirt: '#a9d3ee', swimmingPool: '#63aee6', afternoonBlue: '#3f86d6', inkwellNoon: '#2f6cc4', milkTeeth: '#f3ead9',
  rainOnTin: '#8c94b4', pigeon: '#b8bccc', wetSlate: '#4c547c', monsoon: '#343b66', coldTea: '#9aa8d4',
  persimmon: '#e8743b', rustGate: '#b5492c', chilli: '#cf3f36', gulmohar: '#f08a3c', dryLeaf: '#9a6a3c',
  jute: '#c2a36b', straw: '#dcc98a', teaStain: '#8a6f52', wetBark: '#4b3a44', mangoLeaf: '#2f8a4a',
  limeSoda: '#d2e47a', shellPink: '#f6c6c0', lilacMist: '#c9bfe6', iceLolly: '#dfe9f2', plumJam: '#6a2f5c',
};
const STICKS = Object.keys(BOX).map(k => hex(BOX[k]));
const PAPER = hex('#f3ead9');

// every colour leans towards its nearest sticks (soft, so a stroke slides from one stick to the next)
const LN = 33, LUT = new Float32Array(LN * LN * LN * 3);
(function () {
  const sig = 0.115, pull = 0.62;
  for (let bi = 0; bi < LN; bi++) for (let gi = 0; gi < LN; gi++) for (let ri = 0; ri < LN; ri++) {
    const r = ri / (LN - 1), g = gi / (LN - 1), b = bi / (LN - 1);
    let sr = 0, sg = 0, sb = 0, sw = 0, best = 9;
    for (const s of STICKS) {
      const dr = r - s[0], dg = g - s[1], db = b - s[2], d2 = dr * dr * 0.9 + dg * dg * 1.3 + db * db * 0.8;
      if (d2 < best) best = d2;
      const w = Math.exp(-d2 / (sig * sig)); sr += w * s[0]; sg += w * s[1]; sb += w * s[2]; sw += w;
    }
    const i = ((bi * LN + gi) * LN + ri) * 3;
    // far from every stick the pull weakens, so nothing is dragged a long way
    const k = pull * Math.exp(-best / 0.05) * (sw > 1e-9 ? 1 : 0);
    LUT[i] = r + (sr / (sw || 1) - r) * k; LUT[i + 1] = g + (sg / (sw || 1) - g) * k; LUT[i + 2] = b + (sb / (sw || 1) - b) * k;
  }
})();
function crayon(r, g, b, o, oi) {
  r = r < 0 ? 0 : r > 1 ? 1 : r; g = g < 0 ? 0 : g > 1 ? 1 : g; b = b < 0 ? 0 : b > 1 ? 1 : b;
  const fr = r * (LN - 1), fg = g * (LN - 1), fb = b * (LN - 1);
  let ri = fr | 0, gi = fg | 0, bi = fb | 0; if (ri > LN - 2) ri = LN - 2; if (gi > LN - 2) gi = LN - 2; if (bi > LN - 2) bi = LN - 2;
  const tr = fr - ri, tg = fg - gi, tb = fb - bi;
  const i000 = ((bi * LN + gi) * LN + ri) * 3, i010 = i000 + LN * 3, i100 = i000 + LN * LN * 3, i110 = i100 + LN * 3;
  for (let c = 0; c < 3; c++) {
    const a = LUT[i000 + c] + (LUT[i000 + 3 + c] - LUT[i000 + c]) * tr, bq = LUT[i010 + c] + (LUT[i010 + 3 + c] - LUT[i010 + c]) * tr;
    const cq = LUT[i100 + c] + (LUT[i100 + 3 + c] - LUT[i100 + c]) * tr, d = LUT[i110 + c] + (LUT[i110 + 3 + c] - LUT[i110 + c]) * tr;
    const lo = a + (bq - a) * tg, hi = cq + (d - cq) * tg;
    o[oi + c] = lo + (hi - lo) * tb;
  }
}

// ---------- the sky's ramps: colour by height above the sea, in degrees
const NA = 141;                                   // 0 .. 70 degrees in half degrees
function ramp(stops) {
  const t = new Float32Array(NA * 3), s = stops.map(p => [p[0], hex(p[1])]);
  for (let i = 0; i < NA; i++) {
    const a = i * 0.5; let j = 0; while (j < s.length - 1 && s[j + 1][0] < a) j++;
    const p = s[j], q = s[Math.min(s.length - 1, j + 1)], k = q[0] > p[0] ? c01((a - p[0]) / (q[0] - p[0])) : 0, u = k * k * (3 - 2 * k);
    for (let c = 0; c < 3; c++) t[i * 3 + c] = p[1][c] + (q[1][c] - p[1][c]) * (0.5 * k + 0.5 * u);
  }
  return t;
}
const SKY = {
  NIGHT_S: ramp([[0, '#3a5aa2'], [3, '#32509c'], [8, '#2a4592'], [16, '#233a86'], [28, '#1e3078'], [45, '#1a2868'], [70, '#161f58']]),
  NIGHT_W: ramp([[0, '#35509a'], [3, '#2e4692'], [8, '#273c88'], [16, '#21327c'], [28, '#1c2a6e'], [45, '#18235f'], [70, '#141c50']]),
  // the original drawing's dusk, near the glow and far from it
  DUSK_N: ramp([[0, '#ee7288'], [1.8, '#ff9c70'], [4.7, '#ffd596'], [8.4, '#c4cfaa'], [13.6, '#5fb0b4'], [21, '#2f7fae'], [30.5, '#25509e'], [41, '#1c2f7c'], [52.5, '#141a52'], [105, '#10143f']]),
  DUSK_F: ramp([[0, '#c66c94'], [1.4, '#d87a9c'], [3.8, '#c97cac'], [7.4, '#a476b6'], [12.6, '#7068b4'], [20, '#4458a8'], [29, '#27408f'], [39.5, '#1a2a72'], [52.5, '#121747'], [105, '#0f133c']]),
  SET_N: ramp([[0, '#ff8c5a'], [2.2, '#ffad6a'], [5.8, '#ffd28c'], [11.6, '#f0dca4'], [18.8, '#a8d0b8'], [29, '#5aa8c4'], [43.5, '#3478b8'], [63.8, '#26539f'], [70, '#1c3a86']]),
  SET_F: ramp([[0, '#e88a94'], [3.6, '#e8a0ac'], [8.7, '#c8a0c4'], [15.9, '#8f96cc'], [27.6, '#5a80c4'], [43.5, '#3a64b0'], [63.8, '#274c9c'], [70, '#1c3a86']]),
  GOLD_N: ramp([[0, '#ffe0a4'], [4.3, '#fbe2b0'], [11.6, '#d6e4c4'], [20.3, '#9cd0d8'], [31.9, '#62aee0'], [49.3, '#4088d2'], [72.5, '#2f6cc0'], [70, '#2659ae']]),
  GOLD_F: ramp([[0, '#f0cdb8'], [5.8, '#d8ccd4'], [14.5, '#a8c4e0'], [26.1, '#74ace2'], [43.5, '#4a8cd4'], [69.6, '#316ec2'], [70, '#2659ae']]),
  DAY_S: ramp([[0, '#cfe4e6'], [3, '#b0d8ec'], [8, '#86c4ee'], [16, '#5ea8e6'], [28, '#4590da'], [44, '#3478cc'], [70, '#2c66bc']]),
  DAY_W: ramp([[0, '#e2e6e0'], [3, '#c8dcea'], [8, '#a8cce8'], [16, '#88b8e2'], [28, '#70a4da'], [44, '#5e92d0'], [70, '#5486c6']]),
  PRE: ramp([[0, '#34407e'], [3, '#3c4688'], [7, '#4a4c94'], [12, '#3e4a94'], [20, '#2b3a84'], [32, '#1d2a6c'], [50, '#141e56'], [70, '#101846']]),
  DAWN: ramp([[0, '#6c7ab4'], [1.8, '#8086bf'], [4, '#c898c0'], [7, '#f0b4c0'], [11, '#f4cdc6'], [16, '#c8cfe4'], [24, '#90b2e2'], [36, '#6394d6'], [52, '#4476c4'], [70, '#3764b4']]),
  MORN: ramp([[0, '#e6d6d4'], [3, '#dcdce6'], [8, '#b4d2ec'], [16, '#84bcec'], [28, '#5ea2e2'], [44, '#4486d2'], [70, '#356fc2']]),
  FDUSK_N: ramp([[0, '#e8505a'], [1.8, '#ff7a4a'], [4.7, '#ffb060'], [8.4, '#f0c890'], [13.6, '#a8a8b0'], [21, '#5878b0'], [30.5, '#2f4c98'], [41, '#1e2f78'], [52.5, '#151a52'], [105, '#10143f']]),
  FDUSK_F: ramp([[0, '#b8507c'], [1.4, '#d05c80'], [3.8, '#c86490'], [7.4, '#a060a8'], [12.6, '#6c58ac'], [20, '#4450a0'], [29, '#283c8a'], [39.5, '#1a2a70'], [52.5, '#121747'], [105, '#0f133c']]),
  FSET_N: ramp([[0, '#ff6a3c'], [2.2, '#ff8c48'], [5.8, '#ffb866'], [11.6, '#ffd48c'], [18.8, '#d8c8a8'], [29, '#7ea4c0'], [43.5, '#4070b4'], [63.8, '#284e9c'], [70, '#1c3884']]),
  FSET_F: ramp([[0, '#e06478'], [3.6, '#ec8090'], [8.7, '#d890b0'], [15.9, '#a088c4'], [27.6, '#6478c0'], [43.5, '#3e5eac'], [63.8, '#284a98'], [70, '#1c3884']]),
  CDUSK_N: ramp([[0, '#e8a0a8'], [1.8, '#f4c0a8'], [4.7, '#f6e0b4'], [8.4, '#cfdcc4'], [13.6, '#8cbcc8'], [21, '#5890b8'], [30.5, '#3460a0'], [41, '#223c80'], [52.5, '#16225a'], [105, '#101642']]),
  CDUSK_F: ramp([[0, '#a890b8'], [1.4, '#b49cc0'], [3.8, '#a898c4'], [7.4, '#8a8cc0'], [12.6, '#6878b4'], [20, '#4860a4'], [29, '#2c468c'], [39.5, '#1c3070'], [52.5, '#131c4c'], [105, '#0f143c']]),
  CSET_N: ramp([[0, '#ffc890'], [2.2, '#ffd8a0'], [5.8, '#fae8bc'], [11.6, '#dce8cc'], [18.8, '#acd0d8'], [29, '#74a8d4'], [43.5, '#4c80c4'], [63.8, '#345fac'], [70, '#284a94']]),
  CSET_F: ramp([[0, '#d8b0c0'], [3.6, '#d4bcd0'], [8.7, '#b8b8d8'], [15.9, '#94a8d8'], [27.6, '#6c90cc'], [43.5, '#4a74bc'], [63.8, '#345ca8'], [70, '#284a94']]),
  OVC: ramp([[0, '#c8cad4'], [4, '#babece'], [12, '#a8aec6'], [25, '#9aa1be'], [45, '#8e96b6'], [70, '#8890b2']]),
  STORM: ramp([[0, '#9aa08e'], [2.5, '#7c84a0'], [6, '#646c90'], [14, '#4c547c'], [26, '#3c4470'], [45, '#343b66'], [70, '#30365e']]),
};

function createLook(K) {
  const C = K.C, F = K.F;
  const skyN = new Float32Array(NA * 3), skyF = new Float32Array(NA * 3), tmpA = new Float32Array(NA * 3), tmpB = new Float32Array(NA * 3);
  function blendInto(dst, a, b, k) { for (let i = 0; i < NA * 3; i++) dst[i] = a[i] + (b[i] - a[i]) * k; }
  // piecewise blend over the sun's height
  function keyed(dst, alt, keys) {
    if (alt <= keys[0][0]) { dst.set(keys[0][1]); return; }
    for (let i = 1; i < keys.length; i++) if (alt <= keys[i][0]) { const t = (alt - keys[i - 1][0]) / (keys[i][0] - keys[i - 1][0]); blendInto(dst, keys[i - 1][1], keys[i][1], t * t * (3 - 2 * t)); return; }
    dst.set(keys[keys.length - 1][1]);
  }
  const mixT = (a, b, k) => { const o = new Float32Array(NA * 3); blendInto(o, a, b, k); return o; };
  const st = {
    f: 0, tau: 0, sunCol: [1, 1, 1], Sv: [0, 0, 0], Av: [0, 0, 0], Gv: [0, 0, 0], INK: [0, 0, 0], fogCol: [0, 0, 0], horizon: [0, 0, 0], zenith: [0, 0, 0], moonCol: [0, 0, 0],
    skyN, skyF,
  };
  const tt = [0, 0, 0], t2 = [0, 0, 0];

  // ---------- everything a stroke may ask about this instant
  function frameState(f) {
    f = ((f % F) + F) % F;
    st.f = f; st.tau = f / K.FPS;
    for (const k in C) { const a = C[k]; if (a.length >= F) st[k] = a[f]; }   // (scalars only: d, hour, alt, ovc, snow, G, ...)
    const alt = st.alt, pm = st.pm, warm = st.warm, fire = st.fire, cold = st.cold;
    // --- the clear-sky ramps for this hour and this season
    const NIGHT = mixT(SKY.NIGHT_W, SKY.NIGHT_S, warm), DAY = mixT(SKY.DAY_W, SKY.DAY_S, sstep(0.05, 0.75, warm));
    const wN = Math.max(0, 1 - fire - cold);
    const tri = (a, b, c) => { const o = new Float32Array(NA * 3); for (let i = 0; i < NA * 3; i++) o[i] = (a[i] * wN + b[i] * fire + c[i] * cold) / (wN + fire + cold); return o; };
    if (pm || alt < -30) {
      const DN = tri(SKY.DUSK_N, SKY.FDUSK_N, SKY.CDUSK_N), DF = tri(SKY.DUSK_F, SKY.FDUSK_F, SKY.CDUSK_F), SN = tri(SKY.SET_N, SKY.FSET_N, SKY.CSET_N), SF = tri(SKY.SET_F, SKY.FSET_F, SKY.CSET_F);
      keyed(skyN, alt, [[-24, NIGHT], [-12, mixT(NIGHT, DN, 0.42)], [-4.2, DN], [0, SN], [6, SKY.GOLD_N], [17, DAY]]);   // the afterglow is let go slowly: night's clock runs fast
      keyed(skyF, alt, [[-24, NIGHT], [-12, mixT(NIGHT, DF, 0.42)], [-4.2, DF], [0, SF], [6, SKY.GOLD_F], [17, DAY]]);
    } else {
      keyed(skyN, alt, [[-22, NIGHT], [-8, SKY.PRE], [-0.5, SKY.DAWN], [7, SKY.MORN], [17, DAY]]);
      skyF.set(skyN);
    }
    // --- the sun as a lamp
    const hi = sstep(2, 22, alt), lo = sstep(-1.5, 4, alt);
    const cHi = [1.0, 0.975, 0.90], cMid = mix3([1.0, 0.80, 0.52], [1.0, 0.70, 0.40], fire, tt), cLo = mix3([1.0, 0.56, 0.36], [1.0, 0.42, 0.28], fire, t2);
    mix3(cLo, cMid, sstep(-0.5, 6, alt), st.sunCol); mix3(st.sunCol, cHi, hi, st.sunCol);
    if (cold > 0) mix3(st.sunCol, [1.0, 0.93, 0.80], cold * 0.5 * (1 - hi), st.sunCol);
    const direct = sstep(-2.2, 8.5, alt) * (1 - 0.92 * st.ovc) * (1 - 0.55 * st.fog) * (1 - 0.3 * st.haze);
    st.direct = direct;
    const sI = direct * (0.80 + 0.20 * hi);
    const sK = 0.80;
    st.Sv[0] = st.sunCol[0] * sI * sK; st.Sv[1] = st.sunCol[1] * sI * sK; st.Sv[2] = st.sunCol[2] * sI * sK;
    // --- the sky as a lamp: taken from the ramp itself, greyed by cloud
    const day = sstep(-6, 8, alt); st.day = day;
    const z = 2 * 44 * 3, hz = 2 * 3 * 3;
    for (let c = 0; c < 3; c++) { st.zenith[c] = 0.5 * (skyN[z + c] + skyF[z + c]); st.horizon[c] = 0.5 * (skyN[hz + c] + skyF[hz + c]); }
    const ovc = st.ovc, storm = st.storm;
    const ovcB = (0.30 + 0.70 * day + 0.06 * c01(st.snow * 2) * (1 - day)) * (1 - 0.45 * storm);
    const oc = [SKY.OVC[25 * 6] * ovcB, SKY.OVC[25 * 6 + 1] * ovcB, SKY.OVC[25 * 6 + 2] * ovcB * (1 + 0.25 * (1 - day))];
    st.ovcB = ovcB;
    // night sky light is boosted: the artist never lets the night go black
    const nightK = 1 - day;
    const moonL = st.moonUp * sstep(0.3, 7, st.moonAlt);
    const ambK = 0.42 * day + 0.50 * nightK + 0.30 * moonL * (1 - 0.9 * st.ovc) * nightK * (0.3 + 0.7 * Math.sin(Math.PI * Math.min(1, st.moonPhase * 2)) );
    for (let c = 0; c < 3; c++) {
      const sky = (0.80 * st.zenith[c] + 0.20 * st.horizon[c]) * (1 + 0.5 * nightK) + 0.10 * day;
      st.Av[c] = lerp(sky * ambK, oc[c] * 0.62, ovc);
    }
    // --- the small light in the hollow
    st.Gv[0] = 0.97 * st.glow; st.Gv[1] = 0.88 * st.glow; st.Gv[2] = 0.42 * st.glow;
    // --- the ink of the hour
    const tw = Math.exp(-Math.pow((alt + 2) / 7, 2)) * (1 - ovc);
    const inkN = [0.082, 0.132, 0.325], inkD = [0.070, 0.170, 0.300], inkT = [0.120, 0.105, 0.300];
    mix3(inkN, inkD, day, st.INK); mix3(st.INK, inkT, tw * 0.8, st.INK);
    if (ovc > 0) mix3(st.INK, [0.13, 0.15, 0.27], ovc * 0.5 * day, st.INK);
    // --- what distance dissolves into
    mix3(st.horizon, oc, ovc, st.fogCol);
    mix3(st.fogCol, [0.90 * (0.25 + 0.75 * day), 0.90 * (0.27 + 0.73 * day), 0.92 * (0.34 + 0.66 * day)], 0.55 * Math.max(st.fog, st.snowf * 0.8), st.fogCol);
    st.veil = c01(st.fog * 1.15 + st.rain * 0.55 + st.snowf * 0.85 + st.haze * 0.35);
    // snow thrown light back up under things
    st.bounce = c01(st.snow * 2.5) * 0.22;
    st.moonI = moonL * (1 - st.day) * (1 - 0.9 * ovc) * (0.25 + 0.75 * Math.sin(Math.PI * Math.min(1, st.moonPhase * 2)));
    st.flashK = st.flash;
    return st;
  }

  // ---------- the artist's eye
  function grade(o, oi, r, g, b) {
    const ink = st.INK, lum = 0.3 * r + 0.5 * g + 0.2 * b, k = Math.exp(-lum / 0.13);
    // dim things lean to teal before they sink into the ink (the original's ramp: indigo, teal, green, gold)
    const tk = Math.exp(-lum / 0.19) * (0.60 - 0.36 * st.day);
    r += (lum * 0.40 - r) * tk; g += (lum * 1.42 - g) * tk; b += (lum * 1.50 - b) * tk;
    r += ink[0] * k; g += ink[1] * k; b += ink[2] * k;
    // lights roll off into the cream of the paper
    if (r > 0.72) r = 0.72 + 0.26 * Math.tanh((r - 0.72) / 0.26);
    if (g > 0.72) g = 0.72 + 0.23 * Math.tanh((g - 0.72) / 0.23);
    if (b > 0.66) b = 0.66 + 0.21 * Math.tanh((b - 0.66) / 0.21);
    o[oi] = r; o[oi + 1] = g; o[oi + 2] = b;
  }

  // ---------- sky colour at a point of the sheet (o-units)
  const sk = [0, 0, 0];
  function skyAt(x, y, o, ovcLocal) {
    let a = (HOR - y) / KY; if (a < 0) a = 0;
    const fi = Math.min(NA - 1.001, a * 2), i0 = fi | 0, t = fi - i0, i3 = i0 * 3;
    const dx = (x - st.sx) / 400, gl = Math.exp(-dx * dx);
    for (let c = 0; c < 3; c++) {
      const n = skyN[i3 + c] + (skyN[i3 + 3 + c] - skyN[i3 + c]) * t, fr = skyF[i3 + c] + (skyF[i3 + 3 + c] - skyF[i3 + c]) * t;
      o[c] = fr + (n - fr) * gl;
    }
    // the white of the air round a high sun
    if (st.alt > -2) {
      const ry = (y - st.sy), r2 = (x - st.sx) * (x - st.sx) + ry * ry;
      const k = (0.55 * Math.exp(-r2 / (95 * 95)) + 0.22 * Math.exp(-r2 / (300 * 300))) * st.direct * sstep(-2, 6, st.alt);
      if (k > 0.004) { const sc = st.sunCol; o[0] += (0.6 + 0.4 * sc[0] - o[0]) * k; o[1] += (0.6 + 0.38 * sc[1] - o[1]) * k; o[2] += (0.6 + 0.3 * sc[2] - o[2]) * k; }
    }
    // the moon's breath on the air
    if (st.moonI > 0.01) {
      const my = HOR - KY * st.moonAlt, r2 = (x - st.moonX) * (x - st.moonX) + (y - my) * (y - my);
      const k = 0.20 * st.moonI * Math.exp(-r2 / (120 * 120));
      o[0] += (0.62 - o[0]) * k; o[1] += (0.70 - o[1]) * k; o[2] += (0.92 - o[2]) * k;
    }
    const oc = ovcLocal === undefined ? st.ovc : ovcLocal;
    if (oc > 0.002) {
      const src = st.storm > 0 ? null : SKY.OVC, B = st.ovcB;
      let r = SKY.OVC[i3] + (SKY.OVC[i3 + 3] - SKY.OVC[i3]) * t, g = SKY.OVC[i3 + 1] + (SKY.OVC[i3 + 4] - SKY.OVC[i3 + 1]) * t, b = SKY.OVC[i3 + 2] + (SKY.OVC[i3 + 5] - SKY.OVC[i3 + 2]) * t;
      if (!src) { const s = st.storm; r += (SKY.STORM[i3] - r) * s; g += (SKY.STORM[i3 + 1] - g) * s; b += (SKY.STORM[i3 + 2] - b) * s; }
      // cloud lit from beneath by a low sun, on the side where the sun is
      const warmU = gl * sstep(7, 0, Math.abs(st.alt - 1)) * (st.pm ? 1 : 0.4) * Math.exp(-a / 14);
      r = r * B + 0.02; g = g * B + 0.025; b = b * B * (1 + 0.3 * (1 - st.day)) + 0.05 * (1 - st.day);
      r += (st.sunCol[0] * 0.95 - r) * warmU * 0.5; g += (st.sunCol[1] * 0.75 - g) * warmU * 0.5; b += (st.sunCol[2] * 0.6 - b) * warmU * 0.5;
      o[0] += (r - o[0]) * oc; o[1] += (g - o[1]) * oc; o[2] += (b - o[2]) * oc;
    }
    // mist, rain and falling snow close the distance in
    if (st.veil > 0.01) { const k = st.veil * (0.25 + 0.75 * Math.exp(-a / 9)) * 0.8, fc = st.fogCol; o[0] += (fc[0] - o[0]) * k; o[1] += (fc[1] - o[1]) * k; o[2] += (fc[2] - o[2]) * k; }
    if (st.flashK > 0) { const dx2 = (x - st.flashX) / 420, k = st.flashK * (0.25 + 0.6 * Math.exp(-dx2 * dx2) * Math.exp(-a / 40)); o[0] += (0.86 - o[0]) * k; o[1] += (0.88 - o[1]) * k; o[2] += (1.0 - o[2]) * k; }
    return o;
  }

  return { st, frameState, grade, skyAt, crayon, SKY, NA };
}

module.exports = { createLook, BOX, STICKS, PAPER, hex, mix3, crayon };
