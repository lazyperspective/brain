/* A YEAR, STILL WARM — the clock, the sky's arithmetic, the weather and the ecosystem.
 *
 * One model drives everything on the sheet. Nothing in the film is keyed to a
 * frame number: every stroke asks this model "what is the world like now?".
 *
 *   film second  ->  d (film-days, 0..18)  ->  hour of day + day of year
 *                ->  sun / moon / stars
 *                ->  weather channels (cloud, rain, snow, wind, fog ...)
 *                ->  integrated state (soil water, snow pack, warmth sums,
 *                    leaf-out, autumn, leaf-fall stress, frost, dew ...)
 *
 * A film-day is both one turn of the sun and about twenty calendar days, so the
 * year is watched through eighteen long days whose lengths, light and weather
 * belong to their season. The model is integrated three times round and only the
 * last lap is kept, so the last frame hands the world back to the first one.
 */
'use strict';

const FPS = 30, DUR = 90, F = FPS * DUR, ND = 12, CAL = 18, HOUR0 = 6.5;   // twelve days, one for each month; seasons are counted on an 18-part calendar (`cal`)
const LAT = 40 * Math.PI / 180, RAD = Math.PI / 180;
const KX = 4.5, KY = 14, XC = 820, HOR = 556;      // sky -> sheet (o-units per degree)

const c01 = v => v < 0 ? 0 : v > 1 ? 1 : v;
const sstep = (a, b, x) => { const t = c01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
const frac = x => x - Math.floor(x);
// every oscillation in the film is tuned to a whole number of cycles per film, so the loop closes exactly
const hz = f => Math.round(f * DUR) / DUR;
const pn = (tau, f, sd) => pnoise1(tau * hz(f), Math.max(1, Math.round(DUR * f)), sd);
function hash1(i, sd) { let h = Math.imul(i | 0, 374761393) ^ Math.imul(sd | 0, 1274126177); h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; }
// smooth 1-D noise that closes on itself after `period` lattice cells
function pnoise1(x, period, sd) {
  const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
  const a = hash1(((i % period) + period) % period, sd), b = hash1((((i + 1) % period) + period) % period, sd);
  return a + (b - a) * u;
}

// ---------------------------------------------------------------- the sun
function sunAt(d, o) {
  o = o || {};
  const Y = d / ND, hour = (HOUR0 + 24 * frac(d)) % 24, doy = 59 + 365 * Y;
  const decl = 23.44 * RAD * Math.sin(2 * Math.PI * (doy - 80) / 365);
  const Hh = (hour - 12) * 15 * RAD;
  const sinAlt = Math.sin(LAT) * Math.sin(decl) + Math.cos(LAT) * Math.cos(decl) * Math.cos(Hh);
  const alt = Math.asin(sinAlt);
  let az = Math.atan2(Math.sin(Hh), Math.cos(Hh) * Math.sin(LAT) - Math.tan(decl) * Math.cos(LAT)) + Math.PI;   // from north, clockwise
  let a = az - 1.5 * Math.PI;                              // relative to due west (the way we are looking)
  while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI;
  o.Y = Y; o.hour = hour; o.doy = doy; o.decl = decl; o.alt = alt / RAD; o.a = a / RAD;
  o.lx = Math.cos(alt) * Math.sin(a); o.ly = Math.sin(alt); o.lz = -Math.cos(alt) * Math.cos(a);     // towards the sun; z = towards us
  o.x = XC + KX * o.a; o.y = HOR - KY * o.alt;
  o.dayLen = 24 / Math.PI * Math.acos(Math.max(-1, Math.min(1, -Math.tan(LAT) * Math.tan(decl))));
  o.pm = hour >= 12;
  return o;
}

// ---------------------------------------------------------------- the script of the weather
// at(day, clockHour): a film-day runs from 06:30 to 06:30, so 03:00 is "27".
const at = (day, h) => day + (h - HOUR0) / 24;
function channel(keys, base) {
  keys = keys.slice().sort((p, q) => p[0] - q[0]);
  const n = keys.length;
  return function (d) {
    d = ((d % ND) + ND) % ND;
    if (!n) return base || 0;
    let i = 0; while (i < n && keys[i][0] <= d) i++;
    const k0 = keys[(i - 1 + n) % n], k1 = keys[i % n];
    let d0 = k0[0], d1 = k1[0]; if (i === 0) d0 -= ND; if (i === n) d1 += ND;
    const t = d1 > d0 ? (d - d0) / (d1 - d0) : 0, u = t * t * (3 - 2 * t);
    return k0[1] + (k1[1] - k0[1]) * u;
  };
}
const CH = {
  ovc: channel([
    [at(0, 6.5), 0.08], [at(0, 8.2), 0.12], [at(0, 10.6), 0.70], [at(0, 12), 0.95], [at(0, 15.2), 0.90], [at(0, 16.6), 0.40], [at(0, 18), 0.16], [at(0, 22), 0.06],
    [at(1, 8), 0.06], [at(1, 20), 0.06], [at(2, 6.5), 0.15], [at(2, 12), 0.08], [at(3, 8), 0.03], [at(3, 22), 0.03],
    [at(4, 6.5), 0.05], [at(4, 10.5), 0.10], [at(4, 12.4), 0.55], [at(4, 13.3), 1.0], [at(4, 17.6), 1.0], [at(4, 18.6), 0.5], [at(4, 19.6), 0.16], [at(4, 23), 0.05],
    [at(5, 12), 0.05], [at(6, 8), 0.10], [at(6, 14), 0.06], [at(7, 8), 0.12], [at(7, 12), 0.26], [at(7, 17), 0.14], [at(7, 23), 0.10], [at(7, 27), 0.40],
    [at(8, 6.5), 0.75], [at(8, 8), 0.97], [at(8, 14), 0.95], [at(8, 15.4), 0.5], [at(8, 16.5), 0.2], [at(8, 21), 0.08],
    [at(9, 7), 0.06], [at(9, 12), 0.10], [at(9, 16.4), 0.14], [at(9, 17.6), 0.6], [at(9, 19), 1.0], [at(9, 25.6), 1.0], [at(9, 27.2), 0.5], [at(9, 28.6), 0.06],
    [at(10, 7), 0.04], [at(10, 8.8), 0.3], [at(10, 11.2), 1.0], [at(10, 14.2), 1.0], [at(10, 15.4), 0.45], [at(10, 16.4), 0.14], [at(10, 22), 0.04],
    [at(11, 7), 0.05], [at(11, 9.6), 0.15], [at(11, 12.4), 0.85], [at(11, 15), 0.85], [at(11, 16.3), 0.4], [at(11, 17.4), 0.18], [at(11, 21), 0.08],
  ]),
  rain: channel([
    [at(0, 11.4), 0], [at(0, 12.2), 0.5], [at(0, 14.6), 0.5], [at(0, 15.5), 0],
    [at(4, 13.2), 0], [at(4, 13.9), 1.0], [at(4, 17), 0.9], [at(4, 17.9), 0.2], [at(4, 18.4), 0],
    [at(8, 7.6), 0], [at(8, 8.6), 0.7], [at(8, 12), 0.8], [at(8, 13.6), 0.5], [at(8, 14.6), 0],
    [at(11, 12.3), 0], [at(11, 13), 0.35], [at(11, 14.6), 0.3], [at(11, 15.3), 0],
  ]),
  snow: channel([
    [at(9, 18.6), 0], [at(9, 19.6), 0.4], [at(9, 21.5), 0.8], [at(9, 24.5), 0.9], [at(9, 26.3), 0.3], [at(9, 27.2), 0],
    [at(10, 10.4), 0], [at(10, 11.4), 0.7], [at(10, 13.6), 0.8], [at(10, 14.8), 0],
  ]),
  wind: channel([
    [at(0, 9), 0.2], [at(0, 12.5), 0.4], [at(0, 18), 0.15], [at(1, 12), 0.18], [at(2, 7), 0.05], [at(2, 10), 0.12], [at(2, 12.5), 0.75], [at(2, 16.5), 0.8], [at(2, 18.5), 0.15],
    [at(3, 10), 0.14], [at(3, 18), 0.05], [at(3, 27), 0.05], [at(4, 8), 0.03], [at(4, 11.6), 0.04], [at(4, 12.5), 0.5], [at(4, 13.4), 1.5], [at(4, 15.5), 1.2], [at(4, 17.5), 0.6], [at(4, 19), 0.15], [at(4, 23), 0.08],
    [at(5, 12), 0.28], [at(6, 7), 0.05], [at(6, 10), 0.08], [at(6, 14), 0.3], [at(7, 8), 0.45], [at(7, 10), 1.1], [at(7, 15.5), 1.05], [at(7, 17.5), 0.35], [at(7, 23), 0.15],
    [at(8, 9), 0.6], [at(8, 14), 0.5], [at(8, 18), 0.15], [at(9, 7), 0.04], [at(9, 13), 0.12], [at(9, 20), 0.25], [at(9, 26), 0.05],
    [at(10, 6.6), 0.03], [at(10, 8), 0.0], [at(10, 9.6), -0.4], [at(10, 11.2), -1.2], [at(10, 13.6), -1.1], [at(10, 15.2), -0.3], [at(10, 18), -0.06], [at(10, 26), -0.03],
    [at(11, 6.5), 0.0], [at(11, 10), 0.10], [at(11, 13), 0.3], [at(11, 21), 0.15],
  ]),
  fog: channel([
    [at(0, 6.5), 0.10], [at(0, 8.5), 0], [at(1, 24), 0], [at(1, 27), 0.25], [at(2, 6.5), 0.70], [at(2, 9), 0.5], [at(2, 10.6), 0],
    [at(4, 19.6), 0], [at(4, 22), 0.35], [at(4, 28), 0.3], [at(5, 7.5), 0.12], [at(5, 9), 0], [at(5, 24), 0], [at(5, 27), 0.45], [at(6, 6.5), 0.9], [at(6, 9), 0.7], [at(6, 10.8), 0],
    [at(8, 24), 0], [at(9, 7), 0.22], [at(9, 9.5), 0], [at(11, 11), 0], [at(11, 13), 0.3], [at(11, 15.5), 0.2], [at(11, 17), 0], [at(11, 28), 0.08],
  ]),
  cum: channel([
    [at(0, 8), 0.15], [at(0, 10.5), 0.3], [at(0, 11.6), 0], [at(0, 15.5), 0], [at(0, 16.5), 0.4], [at(0, 19), 0.2], [at(0, 22), 0.03],
    [at(1, 8.5), 0.15], [at(1, 11), 0.5], [at(1, 17), 0.45], [at(1, 21), 0.08], [at(2, 10), 0.1], [at(2, 13), 0.5], [at(2, 18), 0.35], [at(2, 22), 0.08],
    [at(3, 12), 0.14], [at(3, 19), 0.08], [at(4, 9), 0.05], [at(4, 11.5), 0.25], [at(4, 13), 0], [at(4, 18.3), 0], [at(4, 19.2), 0.3], [at(4, 22), 0.05],
    [at(5, 12), 0.4], [at(5, 18), 0.3], [at(5, 21), 0.08], [at(6, 13), 0.16], [at(6, 18), 0.2], [at(7, 10), 0.5], [at(7, 16), 0.55], [at(7, 21), 0.1], [at(8, 8), 0], [at(8, 14.5), 0], [at(8, 15.6), 0.36], [at(8, 18), 0.12], [at(8, 22), 0.03],
    [at(9, 9), 0.1], [at(9, 13), 0.06], [at(9, 16), 0.14], [at(9, 18), 0], [at(10, 7.5), 0.08], [at(10, 9.6), 0], [at(10, 14.6), 0], [at(10, 15.6), 0.3], [at(10, 18.5), 0.1], [at(10, 22), 0],
    [at(11, 9), 0.12], [at(11, 12), 0], [at(11, 15.6), 0], [at(11, 16.4), 0.36], [at(11, 19), 0.14], [at(11, 23), 0.02],
  ]),
  cir: channel([
    [at(0, 7), 0.5], [at(0, 10), 0.2], [at(0, 11.5), 0], [at(3, 8), 0], [at(3, 10), 0.15], [at(3, 16), 0.1], [at(4, 8), 0], [at(5, 10), 0.25], [at(5, 20), 0.1],
    [at(6, 11), 0.2], [at(6, 15), 0.5], [at(7, 8), 0.1], [at(7, 12), 0], [at(9, 7), 0.45], [at(9, 12), 0.3], [at(9, 16), 0.5], [at(9, 18), 0],
    [at(10, 6.8), 0.4], [at(10, 8.4), 0], [at(10, 15), 0], [at(10, 16), 0.3], [at(10, 18), 0.1], [at(11, 7), 0.5], [at(11, 10), 0.3], [at(11, 12), 0],
  ]),
  storm: channel([[at(4, 12.5), 0], [at(4, 13.7), 1], [at(4, 17), 0.9], [at(4, 18.2), 0]]),
  haze: channel([[at(2, 12), 0], [at(3, 12), 0.15], [at(4, 7), 0.5], [at(4, 11.5), 0.7], [at(4, 13.2), 0.2], [at(5, 12), 0.3], [at(6, 12), 0]]),
  tAnom: channel([
    [at(0, 12), -1], [at(1, 12), 0.5], [at(4, 11.5), 3], [at(4, 14.5), -3.5], [at(5, 12), 0.5], [at(8, 12), -1.5],
    [at(9, 6.5), -4], [at(9, 12), -2.5], [at(9, 22), -3.5], [at(10, 7), -5], [at(10, 14), -3], [at(10, 23), -5.5],
    [at(11, 7), -5], [at(11, 10), -1], [at(11, 12.5), 4.0], [at(11, 16), 2.2], [at(11, 22), -1],
  ]),
  // how much each sunset leans away from the original rose-and-peach: towards fire, towards cold lemon
  fire: channel([[at(0, 18), 0.1], [at(2, 19), 0.15], [at(3, 19.5), 0], [at(4, 19.3), 0.45], [at(5, 18.8), 0.7], [at(6, 18), 0.35], [at(7, 17.5), 1.0], [at(8, 17), 0.2], [at(9, 16.5), 0], [at(11, 17.5), 0.1]]),
  cold: channel([[at(0, 18), 0.4], [at(1, 18.5), 0.1], [at(2, 19), 0], [at(7, 17.5), 0], [at(8, 17), 0.4], [at(9, 16.6), 0.8], [at(10, 16.9), 0.9], [at(11, 17.5), 0.55]]),
};
// thunder: clock hours on the storm day, where along the horizon, how bright
const STORM_DAY = 4, LIGHTNING = [[13.85, 700, 0.8], [14.5, 1010, 0.55], [15.1, 640, 1.0], [15.7, 880, 0.7], [16.3, 1240, 0.5], [17.0, 760, 0.8]];
const DAY_MULT = [1.0, 0.95, 0.95, 1.3, 1.1, 0.9, 0.92, 1.05, 0.9, 1.2, 0.95, 0.95];

// ---------------------------------------------------------------- build the year
function buildClock() {
  const so = {};
  // ---- how long the film lingers on each instant (seconds per film-day)
  function dwell(d) {
    sunAt(d, so);
    const i = Math.floor(d - 0.5), t = d - 0.5 - i, u = t * t * (3 - 2 * t);
    const dm = lerp(DAY_MULT[((i % ND) + ND) % ND], DAY_MULT[(((i + 1) % ND) + ND) % ND], u);
    let w = dm * (1 + 3.0 * Math.exp(-Math.pow((so.alt + 2) / 7.5, 2)));                // dawn and dusk are savoured
    w *= 1 + 0.5 * sstep(12.3, 14, so.hour) * sstep(-2, 5, so.alt);                        // the afternoon, when the sun is in the picture
    return w;
  }
  const M = ND * 3000, cum = new Float64Array(M + 1), wv = new Float64Array(M);
  for (let i = 0; i < M; i++) wv[i] = dwell((i + 0.5) / M * ND);
  // the midsummer dusk (the drawing this all came from) and the longest night are held a little
  const special = [];
  for (let i = 0; i < M; i++) { const d = (i + 0.5) / M * ND; if (d > 3.4 && d < 3.7) { sunAt(d, so); if (so.alt < -4.5) { special.push([d, 1.5, 0.024]); break; } } }
  special.push([at(9, 28.8), 0.5, 0.07]);
  for (let i = 0; i < M; i++) { const d = (i + 0.5) / M * ND; let k = 1; for (const s of special) k += s[1] * Math.exp(-Math.pow((d - s[0]) / s[2], 2)); wv[i] *= k; }
  for (let i = 0; i < M; i++) cum[i + 1] = cum[i] + wv[i];
  const tot = cum[M];
  function dAtTau(tau) {
    let x = (((tau % DUR) + DUR) % DUR) / DUR * tot, lo = 0, hi = M;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (cum[m] <= x) lo = m; else hi = m; }
    return (lo + (x - cum[lo]) / (cum[lo + 1] - cum[lo])) / M * ND;
  }
  function tauAtD(d) { const x = (((d % ND) + ND) % ND) / ND * M, i = Math.min(M - 1, Math.floor(x)); return (cum[i] + (cum[i + 1] - cum[i]) * (x - i)) / tot * DUR; }

  const A = name => new Float32Array(F);
  const C = {
    d: new Float64Array(F), cal: A(), hour: A(), Y: A(), alt: A(), az: A(), sx: A(), sy: A(), lx: A(), ly: A(), lz: A(), dayLen: A(), pm: new Uint8Array(F),
    ovc: A(), rain: A(), snowf: A(), windBase: A(), wind: A(), gust: A(), fog: A(), cum: A(), cir: A(), storm: A(), haze: A(), fire: A(), cold: A(),
    T: A(), sun: A(), night: A(), M: A(), wet: A(), puddle: A(), snow: A(), snowB: A(), melt: A(), SP: A(), AP: A(), D: A(), G: A(), Hg: A(), dry: A(), sen: A(),
    frost: A(), dew: A(), flash: A(), flashX: A(), Wint: new Float64Array(F + 1), Wabs: new Float64Array(F + 1), Egale: new Float64Array(F + 1), glow: A(), warm: A(),
    nightLen: A(), moonPhase: A(), moonAlt: A(), moonX: A(), moonUp: A(), rough: A(), dSpeed: A(),
  };
  // ---- forcing
  for (let f = 0; f < F; f++) {
    const tau = f / FPS, d = dAtTau(tau); sunAt(d, so);
    C.d[f] = d; C.cal[f] = d * CAL / ND; C.hour[f] = so.hour; C.Y[f] = so.Y; C.alt[f] = so.alt; C.az[f] = so.a; C.sx[f] = so.x; C.sy[f] = so.y; C.lx[f] = so.lx; C.ly[f] = so.ly; C.lz[f] = so.lz;
    C.dayLen[f] = so.dayLen; C.pm[f] = so.pm ? 1 : 0;
    C.ovc[f] = c01(CH.ovc(d)); C.rain[f] = Math.max(0, CH.rain(d)); C.snowf[f] = Math.max(0, CH.snow(d)); C.fog[f] = c01(CH.fog(d)); C.cum[f] = c01(CH.cum(d));
    C.cir[f] = c01(CH.cir(d)); C.storm[f] = c01(CH.storm(d)); C.haze[f] = c01(CH.haze(d)); C.fire[f] = c01(CH.fire(d)); C.cold[f] = c01(CH.cold(d));
    const wb = CH.wind(d); C.windBase[f] = wb;
    // gusts: a slow swell and a quicker flutter, in real seconds (they close on themselves at the loop)
    const g = 0.55 * pn(tau, 0.22, 11) + 0.30 * pn(tau, 0.6, 12) + 0.15 * pn(tau, 1.7, 13);
    C.gust[f] = g;
    const breath = 0.035 + 0.03 * pn(tau, 0.13, 14);        // the air is never quite still
    C.wind[f] = wb * (0.45 + 1.1 * g) + breath * wb / Math.sqrt(wb * wb + 0.004);
    C.night[f] = 1 - sstep(-9, -1.5, so.alt);
  }
  for (let f = 0; f < F; f++) { C.Wint[f + 1] = C.Wint[f] + C.wind[f] / FPS; C.Wabs[f + 1] = C.Wabs[f] + Math.abs(C.wind[f]) / FPS; const g = Math.max(0, Math.abs(C.wind[f]) - 0.55); C.Egale[f + 1] = C.Egale[f] + Math.sign(C.wind[f]) * g * g / FPS; }
  for (let f = 0; f < F; f++) C.dSpeed[f] = ((C.d[(f + 1) % F] - C.d[f] + ND) % ND);
  // ---- lightning (film seconds)
  for (const L of LIGHTNING) {
    const f0 = Math.round(tauAtD(at(STORM_DAY, L[0])) * FPS);
    const shape = [0.3, 0.62, 0.5, 0.36, 0.5, 0.4, 0.3, 0.22, 0.16, 0.11, 0.07, 0.04, 0.02];   // a flash is a soft double pulse, not a strobe
    for (let k = 0; k < shape.length; k++) { const f = (f0 + k) % F, v = shape[k] * L[2]; if (v > C.flash[f]) { C.flash[f] = v; C.flashX[f] = L[1]; } }
  }
  // ---- the ecosystem, three times round
  let M_ = 0.5, wet = 0, pud = 0, sn = 0, sb = 0, SP = 0, AP = 0, D = 0, G = 0.2, Hg = 0.3, dry = 0, sen = 0.5, frost = 0, dew = 0, warm = 0.3;
  for (let lap = 0; lap < 3; lap++) for (let f = 0; f < F; f++) {
    // (the ecosystem counts time on the 18-part calendar, so its rates do not care how many suns the film shows)
    const dd = C.d[f], d = C.cal[f], dt = C.dSpeed[f] * CAL / ND, Y = C.Y[f], alt = C.alt[f], hour = C.hour[f];
    const dPrev = C.cal[(f - 1 + F) % F], crossed = x => dPrev < x && d >= x;
    const doy = 59 + 365 * Y;
    const ovc = C.ovc[f], rain = C.rain[f], snowf = C.snowf[f], W = Math.abs(C.wind[f]);
    const sunStr = sstep(-1, 14, alt) * (1 - 0.88 * ovc) * (1 - 0.5 * C.fog[f]);
    const Tmean = 10.6 + 12.4 * Math.sin(2 * Math.PI * (doy - 112) / 365);
    const Tdi = (4.6 - 2.6 * ovc) * Math.cos((hour - 14.5) / 24 * 2 * Math.PI);
    const T = Tmean + Tdi + CH.tAnom(dd) - 1.5 * rain - 2 * snowf;
    // water
    const frozen = sstep(1.5, -0.5, T);
    const acc = snowf * 2.3 * sstep(2.2, 0.2, T);
    let melt = sn > 0 ? Math.max(0, T) * 0.37 + sunStr * Math.max(0, T + 2) * 0.05 + rain * Math.max(0, T + 1) * 0.8 : 0;
    melt += sn > 0 && sn < 0.12 ? warm * 1.2 : 0;                       // the first flurries land on ground that still remembers autumn
    const dsn = Math.min(sn, melt * dt);
    sn = Math.max(0, sn + acc * dt - dsn);
    sb = c01(sb + dt * (acc * 1.6 * (1 - sb) - sb * (melt * 5 + W * W * 3.2 + 0.35 + sunStr * 0.8)));
    M_ = c01(M_ + dt * (rain * 7 * (1 - M_) + (dsn / Math.max(dt, 1e-6)) * 1.6 * (1 - M_) - M_ * (0.16 + 1.1 * sunStr * Math.max(0, T) / 24)));
    wet = c01(wet + dt * (rain * 60 * (1 - wet) + (dsn / Math.max(dt, 1e-6)) * 5 * (1 - wet) - wet * (2.2 + 12 * sunStr + 3 * W)));
    pud = Math.max(0, Math.min(1.25, pud + dt * (rain * 7.5 + (dsn / Math.max(dt, 1e-6)) * 2.2 - pud * (1.3 + 3.0 * sunStr * Math.max(0, T) / 20) * (1 - 0.8 * frozen))));
    warm = c01(warm + dt * ((T - 6) / 14 - warm) * 0.9);               // slow thermal memory of the ground
    // spring: warmth above 3 degrees, helped along by water
    if (crossed(14)) SP = 0;
    SP = Math.min(1.4, SP + dt * 0.64 * Math.max(0, T - 3.0) / 10 * (0.5 + 0.5 * M_) * (d < 8 || d > 14 ? 1 : 0));
    // autumn: the days shorten past 12.7 hours, and cold hurries it
    if (crossed(0.5)) { AP = 0; D = 0; }
    const shortness = Math.max(0, 13.0 - C.dayLen[f]) * (d > 6 && d < 15 ? 1 : 0);
    AP = Math.min(1.5, AP + dt * (0.23 * shortness * (1 + 0.07 * Math.max(0, 11 - T)) + 0.02 * dry * (d > 7 && d < 11 ? 1 : 0)));
    D += dt * Math.pow(Math.min(1, AP), 1.8) * (0.20 + 1.9 * W * W + 1.3 * rain);
    // grass
    const chill = sstep(4, -3, T);
    G = c01(G + dt * (Math.max(0, T - 2) / 10 * (0.45 + 0.55 * M_) * 2.2 * (1 - G) * (1 - sen) - G * (0.3 * chill + 0.25 * sen)));
    dry = c01(dry + dt * (sstep(17, 25, T) * (1 - M_) * 1.3 * (1 - dry) - dry * (M_ * 1.6 + rain * 6)));
    sen = c01(sen + dt * (3 * Math.max(0, (d > 7 && d < 15 ? sstep(13.0, 9.6, C.dayLen[f]) : 0) - sen) - sen * 2.4 * (d < 5 || d > 16.6 ? sstep(3, 9, T) : 0)));
    Hg = c01(Hg + dt * (Math.max(0, T - 4) / 12 * (0.4 + 0.6 * M_) * 0.75 * (1 - Hg) * (1 - sen) - Hg * (0.22 * sen + 0.6 * Math.min(1, sn * 2) + 0.05)));
    // frost and dew: clear, still, small hours
    const calmClear = (1 - ovc) * sstep(0.45, 0.1, W) * C.night[f];
    frost = c01(frost + dt * (9 * calmClear * sstep(0.5, -3, T) * (1 - frost) - frost * (14 * sunStr + 4 * sstep(0, 3, T) + 6 * rain)));
    dew = c01(dew + dt * (7 * calmClear * sstep(3, 9, T) * (1 - dew) - dew * (10 * sunStr + 3 * W)));
    if (lap === 2) {
      C.T[f] = T; C.sun[f] = sunStr; C.M[f] = M_; C.wet[f] = wet; C.puddle[f] = pud; C.snow[f] = sn; C.snowB[f] = sb; C.melt[f] = dsn / Math.max(dt, 1e-6);
      C.SP[f] = SP; C.AP[f] = AP; C.D[f] = D; C.G[f] = G; C.Hg[f] = Hg; C.dry[f] = dry; C.sen[f] = sen; C.frost[f] = frost; C.dew[f] = dew; C.warm[f] = warm;
      C.rough[f] = c01(W * 0.8 + 0.3 * rain);
    }
  }
  // ---- the small light in the hollow, and the moon
  for (let f = 0; f < F; f++) {
    const tau = f / FPS, d = C.d[f];
    const season = 0.34 + 0.66 * sstep(0.08, 0.8, C.warm[f]);
    const candle = 1 + (1 - season) * 0.9 * (0.10 * (pn(tau, 2.3, 31) - 0.5) + 0.07 * (pn(tau, 5.1, 32) - 0.5));
    const breathe = 1 + 0.05 * Math.sin(tau * 2 * Math.PI * hz(1 / 6));
    C.glow[f] = sstep(3, -5.5, C.alt[f]) * season * candle * breathe * (1 - 0.35 * C.rain[f]);
    // The moon turns its face three times a year. It keeps the western sky's manners (everything
    // sets, down and a little to the right) but is allowed to take its time about it.
    const dn = Math.floor(d - 4.5 / 24);                               // its face changes at eleven in the morning, when nobody is looking
    const ph = frac((dn - 3) / 4 + 0.15);                              // a thin boat of a moon at the midsummer dusk
    C.moonPhase[f] = ph;
    const hset = 12 + C.dayLen[f] / 2, nightLen = 24 - C.dayLen[f];
    let hs = C.hour[f] - hset; if (C.hour[f] < 11) hs += 24;           // hours since sunset
    C.nightLen[f] = nightLen;
    const tSet = Math.min(nightLen * (ph < 0.45 ? 0.30 + 1.6 * ph : 0.06 + 2.1 * ph), 33.5 - hset);
    let malt = -20;
    // it comes down quickly at first and slows as it nears the sea, so it slips under rather than drops
    const ease = (x, p) => x >= 0 ? Math.pow(x, p) : -Math.pow(-x, 1) * 0.6;
    if (ph > 0.04 && ph < 0.45) malt = (14 + 126 * ph) * ease(1 - hs / tSet, 1.6);
    else if (ph >= 0.45 && ph < 0.72) malt = 52 * ease((tSet - hs) / (0.8 * nightLen), 1.15);
    const vis = sstep(-3.9, -3.0, hs);
    C.moonAlt[f] = malt;
    C.moonX[f] = XC - 90 + 141 * Math.sin(2 * Math.PI * ((59 + 365 * C.Y[f] - 80) / 365 + ph)) - 3.8 * Math.max(0, malt);
    C.moonUp[f] = sstep(-1.2, 1.5, malt) * vis;
  }
  const tauAtCal = cal => tauAtD(cal * ND / CAL);
  return { FPS, DUR, F, ND, CAL, HOUR0, KX, KY, XC, HOR, C, dAtTau, tauAtD, tauAtCal, sunAt, at, CH };
}

module.exports = { buildClock, hz, FPS, DUR, F, ND, CAL, HOUR0, KX, KY, XC, HOR, at, sunAt, c01, sstep, lerp, frac, hash1, pnoise1 };
