/* The Family — 05 · Festa
 *
 * One continuous street, 4320 x 1350 design px (four 1080 x 1350 slides side by side): Little Italy, an August
 * dusk in 1920, the feast of San Rocco. Young Vito crosses the rooftops from left to right while, below, the
 * procession, the market and the fireworks fill the street, and Fanucci strolls through the crowd in his white
 * suit. Drawn as a sepia pen-and-ink etching: ruled skies, ordered hatching, brick courses, hand lettering,
 * with only the lights, the lanterns, the fireworks and the oranges picked out in colour.
 *
 * Everything is hand-placed in design coordinates and recorded as a list of drawing operations, which are then
 * played back in time-sliced chunks onto one large canvas (8640 x 2700 for export).
 */
(function () {
  'use strict';

  /* ================================================================ frame & projection */
  const W = 4320, H = 1350, SEAMS = [1080, 2160, 3240];
  const HZ = 761;            // eye level (we stand at a third-floor window across the street)
  const BASE = 905;          // foot of the far facades
  const DV = 740;            // viewing distance to the far facades, in facade pixels
  const GF = 150, FH = 108, CORN = 34;
  const sAt = (d) => DV / (DV - d);                 // scale of something d px in front of the facades
  const yAt = (yw, d) => HZ + (yw - HZ) * sAt(d);   // wall-plane y pushed d px toward us
  const gY = (d) => yAt(BASE, d);                   // ground line at depth d
  const figH = (y) => 0.39 * (y - HZ);              // height of a standing adult whose feet are at y
  const CURB_F = gY(127), CURB_N = gY(445);
  const TAU = Math.PI * 2;
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

  /* ================================================================ colour */
  const INK = [44, 29, 18];
  const ink = (a) => 'rgba(44,29,18,' + a + ')';
  const css = (c, a) => (a == null ? 'rgb(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ')' : 'rgba(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ',' + a + ')');
  const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const PAPER = [240, 231, 210];
  const GOLD = [234, 172, 66], GLOW = [255, 212, 138], WARMRED = [176, 62, 40], ORANGE = [230, 122, 26];
  const STONE = [206, 186, 150];
  const C = {
    white: [244, 238, 222], cream: [230, 217, 188], light: [204, 184, 150], tan: [170, 140, 104], mid: [134, 104, 76],
    brown: [102, 74, 52], dark: [72, 52, 37], black: [46, 34, 26], red: [146, 64, 44], rust: [160, 96, 58],
    straw: [222, 196, 140], skin: [226, 190, 150], gold: [210, 160, 64], slate: [96, 92, 96], olive: [112, 104, 74],
    navy: [62, 60, 70], sage: [172, 182, 150],
  };
  const HAZE = [236, 212, 168];
  const RAMP = [[38, 26, 17], [92, 64, 42], [148, 110, 74], [206, 182, 144], [247, 240, 224]];
  const lum = (c) => clamp((0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2]) / 255, 0, 1);
  function sepify(c, chroma) { const L = lum(c) * 4, i = Math.min(3, Math.floor(L)); return mix(mix(RAMP[i], RAMP[i + 1], L - i), c, chroma); }

  /* ================================================================ randomness */
  function mb32(a) { return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function hh(a, b) { let h = (Math.imul(a | 0, 0x9E3779B1) ^ Math.imul((b | 0) + 0x7F4A7C15, 0x85EBCA77)) >>> 0; h ^= h >>> 15; h = Math.imul(h, 0x2C1B3C6D); h ^= h >>> 12; h = Math.imul(h, 0x297A2D39); h ^= h >>> 15; return h >>> 0; }
  const hf = (n) => hh(n | 0, 77) / 4294967296;
  function Rng(s) { const f = mb32(s); return { r: f, u: (a, b) => a + (b - a) * f(), i: (a, b) => a + Math.floor(f() * (b - a + 1)), p: (arr) => arr[Math.floor(f() * arr.length)], c: (p) => f() < p }; }
  let SEED = 7, RSCALE = 1;
  const FX = (k) => Rng(hh(1920, k));          // fixed: composition
  const SV = (k) => Rng(hh(SEED, k * 31 + 5));  // seeded: small variations
  function vdc(n) { n >>>= 0; let v = 0, d = 0.5; while (n) { if (n & 1) v += d; n >>>= 1; d *= 0.5; } return v; }

  /* ================================================================ path helpers */
  function RP(p) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (let i = 0; i < p.length; i += 2) { if (p[i] < x0) x0 = p[i]; if (p[i] > x1) x1 = p[i]; if (p[i + 1] < y0) y0 = p[i + 1]; if (p[i + 1] > y1) y1 = p[i + 1]; }
    return { bb: [x0, y0, x1, y1], add(c) { c.moveTo(p[0], p[1]); for (let i = 2; i < p.length; i += 2) c.lineTo(p[i], p[i + 1]); c.closePath(); } };
  }
  const RR = (x, y, w, h) => ({ bb: [x, y, x + w, y + h], add(c) { c.rect(x, y, w, h); } });
  const RE = (cx, cy, rx, ry) => ({ bb: [cx - rx, cy - ry, cx + rx, cy + ry], add(c) { c.moveTo(cx + rx, cy); c.ellipse(cx, cy, rx, ry, 0, 0, TAU); } });
  function addP(c, p) { c.moveTo(p[0], p[1]); for (let i = 2; i < p.length; i += 2) c.lineTo(p[i], p[i + 1]); c.closePath(); }
  function addL(c, p) { c.moveTo(p[0], p[1]); for (let i = 2; i < p.length; i += 2) c.lineTo(p[i], p[i + 1]); }
  function fillP(c, p, col) { c.beginPath(); addP(c, p); c.fillStyle = col; c.fill(); }
  function strokeL(c, p, col, lw) { c.beginPath(); addL(c, p); c.strokeStyle = col; c.lineWidth = lw; c.stroke(); }
  function line(c, x0, y0, x1, y1, col, lw) { c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.strokeStyle = col; c.lineWidth = lw; c.stroke(); }
  function rect(c, x, y, w, h, fill, stroke, lw) { if (fill) { c.fillStyle = fill; c.fillRect(x, y, w, h); } if (stroke) { c.strokeStyle = stroke; c.lineWidth = lw || 0.8; c.strokeRect(x, y, w, h); } }
  function chaikin(p, closed, it) {
    for (let k = 0; k < it; k++) {
      const n = p.length / 2, q = [];
      if (!closed) q.push(p[0], p[1]);
      for (let i = 0; i < (closed ? n : n - 1); i++) {
        const j = (i + 1) % n, ax = p[2 * i], ay = p[2 * i + 1], bx = p[2 * j], by = p[2 * j + 1];
        q.push(ax * 0.75 + bx * 0.25, ay * 0.75 + by * 0.25, ax * 0.25 + bx * 0.75, ay * 0.25 + by * 0.75);
      }
      if (!closed) q.push(p[p.length - 2], p[p.length - 1]);
      p = q;
    }
    return p;
  }
  function sag(x0, y0, x1, y1, s, n) { const p = []; for (let i = 0; i <= n; i++) { const t = i / n; p.push(lerp(x0, x1, t), lerp(y0, y1, t) + s * 4 * t * (1 - t)); } return p; }
  function along(p, step, off) {
    const out = []; let next = off || 0, acc = 0;
    for (let i = 2; i < p.length; i += 2) {
      const x0 = p[i - 2], y0 = p[i - 1], x1 = p[i], y1 = p[i + 1], l = Math.hypot(x1 - x0, y1 - y0);
      while (next <= acc + l) { const t = l ? (next - acc) / l : 0; out.push(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t); next += step; }
      acc += l;
    }
    return out;
  }

  /* hatching: parallel lines at angle `ang`, clipped to region R. With `f`, each line is visible only where
   * f(x,y) exceeds that line's threshold (a van der Corput order), so tone grades by lines dropping out cleanly. */
  function hatch(c, R, o) {
    const ang = o.ang || 0, sp = o.sp || 3, ca = Math.cos(ang), sa = Math.sin(ang);
    const b = R.bb;
    let dmin = Infinity, dmax = -Infinity, tmin = Infinity, tmax = -Infinity;
    const cs = [b[0], b[1], b[2], b[1], b[0], b[3], b[2], b[3]];
    for (let i = 0; i < 8; i += 2) { const x = cs[i], y = cs[i + 1], d = -x * sa + y * ca, t = x * ca + y * sa; if (d < dmin) dmin = d; if (d > dmax) dmax = d; if (t < tmin) tmin = t; if (t > tmax) tmax = t; }
    c.save();
    if (!o.noclip) { c.beginPath(); R.add(c); c.clip(); }
    c.beginPath();
    const off = o.off || 0, f = o.f, step = o.step || 4, wob = o.wob || 0, jit = o.jit || 0, ko = o.ko || 0;
    const k0 = Math.ceil((dmin - off) / sp), k1 = Math.floor((dmax - off) / sp);
    for (let k = k0; k <= k1; k++) {
      const thr = f ? vdc(k + 1048576 + ko) : 0;
      let d = off + k * sp;
      if (jit) d += (hf(k * 7 + ko) - 0.5) * sp * jit;
      const bx = -sa * d, by = ca * d;
      if (!f && !wob) { c.moveTo(bx + ca * tmin, by + sa * tmin); c.lineTo(bx + ca * tmax, by + sa * tmax); continue; }
      const ph = hf(k * 13 + 5 + ko) * 6.28;
      let on = false;
      for (let t = tmin; t <= tmax + step; t += step) {
        let x = bx + ca * t, y = by + sa * t;
        if (wob) { const w = wob * Math.sin(t * 0.019 + ph) + wob * 0.45 * Math.sin(t * 0.061 + ph * 2.3); x -= sa * w; y += ca * w; }
        const vis = !f || f(x, y) > thr;
        if (vis) { if (!on) { c.moveTo(x, y); on = true; } else c.lineTo(x, y); } else on = false;
      }
    }
    c.lineWidth = o.lw || 0.5; c.strokeStyle = o.col || ink(0.5); c.lineCap = 'butt'; c.stroke();
    c.restore();
  }
  // ordered stipple: dots on a jittered grid, kept where f(x,y) beats each dot's threshold
  function stipple(c, x0, y0, w, h, f, o) {
    o = o || {}; const sp = o.sp || 1.6, r = o.r || 0.42;
    c.beginPath();
    for (let y = y0; y < y0 + h; y += sp) for (let x = x0; x < x0 + w; x += sp) {
      const k = Math.round(x * 7.13 + y * 131.7), jx = (hf(k) - 0.5) * sp * 0.8, jy = (hf(k + 9) - 0.5) * sp * 0.8;
      const X = x + jx, Y = y + jy;
      if (f(X, Y) > hf(k + 17)) { c.moveTo(X + r, Y); c.arc(X, Y, r, 0, TAU); }
    }
    c.fillStyle = o.col || ink(0.7); c.fill();
  }
  // tone carried by line: up to three hatch layers switched on by darkness f
  function toneHatch(c, R, f, o) {
    o = o || {};
    const a = o.ang == null ? Math.PI / 2 : o.ang, sp = o.sp || 2.2, lw = o.lw || 0.46, col = o.col || ink(0.55), ko = o.ko || 0, step = o.step || 5;
    hatch(c, R, { ang: a, sp, lw, col, f: (x, y) => f(x, y) * 1.6, step, jit: 0.15, ko, noclip: o.noclip });
    hatch(c, R, { ang: a + 0.85, sp: sp * 1.08, lw: lw * 0.95, col, f: (x, y) => (f(x, y) - 0.42) * 2.2, step, jit: 0.15, ko: ko + 111, noclip: o.noclip });
    hatch(c, R, { ang: a - 0.85, sp: sp * 1.12, lw: lw * 0.9, col, f: (x, y) => (f(x, y) - 0.68) * 3, step, jit: 0.15, ko: ko + 222, noclip: o.noclip });
  }
  function glowDot(c, x, y, r, col, a) {
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, css(col, a)); g.addColorStop(0.35, css(col, a * 0.4)); g.addColorStop(1, css(col, 0));
    c.fillStyle = g; c.fillRect(x - r, y - r, 2 * r, 2 * r);
  }

  /* ================================================================ hand lettering (a sign-painter's single-stroke caps) */
  const GLY = {
    A: '0,6 2,0 4,6|0.9,3.9 3.1,3.9', B: '0,6 0,0 2.8,0 3.8,0.8 3.8,2.2 2.8,3 0,3|2.8,3 4,3.8 4,5.2 3,6 0,6',
    C: '4,1.1 3,0 1,0 0,1 0,5 1,6 3,6 4,4.9', D: '0,0 0,6 2.3,6 4,4.3 4,1.7 2.3,0 0,0', E: '4,0 0,0 0,6 4,6|0,3 3,3',
    F: '4,0 0,0 0,6|0,3 3,3', G: '4,1.1 3,0 1,0 0,1 0,5 1,6 3,6 4,5 4,3.4 2.3,3.4', H: '0,0 0,6|4,0 4,6|0,3 4,3', I: '0,0 0,6',
    J: '4,0 4,4.8 3,6 1,6 0,4.8', K: '0,0 0,6|4,0 0,4|1.4,2.9 4,6', L: '0,0 0,6 4,6', M: '0,6 0,0 2.3,4.2 4.6,0 4.6,6',
    N: '0,6 0,0 4,6 4,0', O: '1.2,0 2.8,0 4,1.2 4,4.8 2.8,6 1.2,6 0,4.8 0,1.2 1.2,0', P: '0,6 0,0 3,0 4,1 4,2 3,3 0,3',
    Q: '1.2,0 2.8,0 4,1.2 4,4.8 2.8,6 1.2,6 0,4.8 0,1.2 1.2,0|2.5,4.4 4.2,6.3', R: '0,6 0,0 3,0 4,1 4,2 3,3 0,3|2,3 4,6',
    S: '4,1 3,0 1,0 0,1 0,2 1,3 3,3 4,4 4,5 3,6 1,6 0,5', T: '0,0 4,0|2,0 2,6', U: '0,0 0,4.8 1.2,6 2.8,6 4,4.8 4,0',
    V: '0,0 2,6 4,0', W: '0,0 1.2,6 2.5,1.6 3.8,6 5,0', X: '0,0 4,6|4,0 0,6', Y: '0,0 2,3 4,0|2,3 2,6', Z: '0,0 4,0 0,6 4,6',
    0: '1.1,0 2.9,0 4,1.2 4,4.8 2.9,6 1.1,6 0,4.8 0,1.2 1.1,0', 1: '0,1.1 1.1,0 1.1,6', 2: '0,1.2 1,0 3,0 4,1 4,2.2 0,6 4,6',
    3: '0,1 1,0 3,0 4,1 4,2 3,3 1.6,3|3,3 4,4 4,5 3,6 1,6 0,5', 4: '3,6 3,0 0,4.2 4.2,4.2', 5: '4,0 0.5,0 0.2,2.8 1.4,2.4 3,2.4 4,3.4 4,5 3,6 1,6 0,5',
    6: '3.6,0.3 2,0 1,0 0,1.2 0,4.8 1,6 3,6 4,5 4,3.6 3,2.7 1,2.7 0,3.6', 7: '0,0 4,0 1.6,6', 8: '1,3 0,2 0,1 1,0 3,0 4,1 4,2 3,3 1,3 0,4 0,5 1,6 3,6 4,5 4,4 3,3',
    9: '0.4,5.7 2,6 3,6 4,4.8 4,1.2 3,0 1,0 0,1 0,2.4 1,3.3 3,3.3 4,2.4', '.': '0,5.4 0,6', ',': '0.3,5.4 0,6.8', "'": '0,0 0,1.6',
    '-': '0.3,3.2 2.9,3.2', 'È': '4,0 0,0 0,6 4,6|0,3 3,3|1.2,-2.2 2.6,-0.9', '/': '0,6 3,0', ':': '0,1.6 0,2.2|0,5.4 0,6', '·': '0,3 0,3.4', '¢': '4,1.4 3,0.6 1,0.6 0,1.6 0,4.4 1,5.4 3,5.4 4,4.6|2,-0.4 2,6.4',
  };
  const GW = { I: 0, 1: 1.1, '.': 0, ',': 0.3, "'": 0, ':': 0, M: 4.6, W: 5, ' ': 2.4, '-': 3.2, '/': 3, '·': 0 };
  const SMOOTH = new Set('CGOQSUJ0235689¢'.split(''));
  const GCACHE = {};
  function glyph(ch) {
    if (GCACHE[ch]) return GCACHE[ch];
    const g = GLY[ch]; const out = [];
    if (g) for (const st of g.split('|')) {
      let pts = []; for (const pr of st.split(' ')) { const ab = pr.split(','); pts.push(+ab[0], +ab[1]); }
      if (SMOOTH.has(ch)) pts = chaikin(pts, false, 2);
      out.push(pts);
    }
    return (GCACHE[ch] = out);
  }
  function textW(s, size, o) { o = o || {}; const k = size / 6, tr = o.track == null ? 1.6 : o.track, sx = o.cond || 1; let t = 0; for (const ch of s) t += (GW[ch] != null ? GW[ch] : 4) * sx + tr; return (t - tr) * k; }
  function textPolys(s, x, y, size, o) {
    o = o || {};
    const k = size / 6, tr = o.track == null ? 1.6 : o.track, sx = o.cond || 1, sl = o.slant || 0;
    const tot = textW(s, size, o);
    let cx = o.align === 'left' ? x : o.align === 'right' ? x - tot : x - tot / 2;
    const top = y - size / 2, out = [];
    let i = 0;
    for (const ch of s) {
      const jy = o.jit ? (hf(i * 31 + (o.js || 0)) - 0.5) * o.jit * size : 0;
      const arc = o.arc ? o.arc * Math.pow((cx + 2 * k - x) / (tot / 2 || 1), 2) : 0;
      for (const pts of glyph(ch)) {
        const q = [];
        for (let j = 0; j < pts.length; j += 2) q.push(cx + pts[j] * k * sx + (6 - pts[j + 1]) * k * sl, top + pts[j + 1] * k + jy + arc);
        out.push(q);
      }
      cx += ((GW[ch] != null ? GW[ch] : 4) * sx + tr) * k; i++;
    }
    return out;
  }
  function text(c, s, x, y, size, o) {
    o = o || {};
    const ps = textPolys(s, x, y, size, o);
    c.beginPath();
    for (const q of ps) { c.moveTo(q[0], q[1]); for (let j = 2; j < q.length; j += 2) c.lineTo(q[j], q[j + 1]); }
    c.lineCap = o.cap || 'round'; c.lineJoin = 'round';
    const lw = o.lw || size * 0.15;
    if (o.shadow) { c.save(); c.translate(o.shadow, o.shadow); c.lineWidth = lw; c.strokeStyle = o.shadowCol || ink(0.6); c.stroke(); c.restore(); }
    c.lineWidth = lw; c.strokeStyle = o.col || ink(0.9); c.stroke();
  }

  /* ================================================================ the plan of the street */
  // Buildings, left to right. fl = storeys above the shop; nw = window bays; fe = fire-escape bays [from, to].
  const BLD = [
    { x0: -10, x1: 240, fl: 5, nw: 3, mat: 'brick', tone: 0.62, corn: 'brk', lint: 'seg', fe: [0, 1], store: { sign: 'SALUMERIA', kind: 'salumi', ent: 'R', awn: 1 } },
    { x0: 240, x1: 512, fl: 3, nw: 4, mat: 'stucco', tone: 0.35, corn: 'dent', lint: 'flat', fe: [1, 2], store: { sign: 'LATTERIA', sub: 'LATTE · BURRO · UOVA', kind: 'latte', ent: 'L' } },
    { x0: 512, x1: 760, fl: 4, nw: 3, mat: 'brown', tone: 0.55, corn: 'arc', lint: 'ped', fe: [0, 1], store: { sign: 'BARBIERE', kind: 'barber', ent: 'R', pole: 1 } },
    { x0: 760, x1: 1004, fl: 4, nw: 3, mat: 'brick', tone: 0.7, corn: 'brk', lint: 'hood', fe: [1, 2], parapet: 14, store: { sign: 'PANETTERIA', kind: 'pane', ent: 'L', awn: 2 } },
    { x0: 1004, x1: 1134, xs: [1042, 1104], fl: 5, nw: 2, mat: 'brick', tone: 0.5, corn: 'dent', lint: 'flat', fe: null, store: { sign: 'SARTO', kind: 'sarto', ent: null, signX: [1008, 1072] }, upper: { 2: 'SARTO' } },
    { church: 1, x0: 1134, x1: 1468 },
    { tower: 1, x0: 1468, x1: 1534 },
    { x0: 1534, x1: 1800, fl: 4, nw: 4, mat: 'brick', tone: 0.78, corn: 'brk', lint: 'seg', fe: [1, 2], banner: 'W SAN ROCCO', store: { sign: 'ALIMENTARI', kind: 'grocer', ent: 'R', awn: 1 } },
    { alley: 1, x0: 1800, x1: 1858 },
    { x0: 1858, x1: 2088, fl: 5, nw: 3, mat: 'brick', tone: 0.6, corn: 'dent', lint: 'flat', fe: [0, 1], store: { sign: 'VINI E LIQUORI', kind: 'vini', ent: 'R' } },
    { x0: 2088, x1: 2384, xs: [2126, 2200, 2268, 2336], fl: 4, nw: 4, mat: 'brown', tone: 0.62, corn: 'brk', lint: 'hood', fe: [2, 3], store: { sign: 'GROCERIA ABBANDANDO', kind: 'grocer', ent: 'L', awn: 2, signX: [2172, 2378] }, upper: { 1: 'DENTISTA' } },
    { x0: 2384, x1: 2600, fl: 2, nw: 3, mat: 'stucco', tone: 0.42, corn: 'arc', lint: 'ped', fe: null, billboard: 1, store: { sign: 'FARMACIA', kind: 'farmacia', ent: null } },
    { x0: 2600, x1: 2928, fl: 5, nw: 4, mat: 'iron', tone: 0.75, corn: 'brk', lint: 'iron', fe: null, store: { sign: 'BANCA', sub: 'BIGLIETTI PER L\'ITALIA', kind: 'banca', ent: 'R' }, upper: { 1: 'NOTARO' } },
    { x0: 2928, x1: 3160, fl: 4, nw: 3, mat: 'brick', tone: 0.55, corn: 'dent', lint: 'seg', fe: [0, 1], store: { sign: 'CAFFÈ', sub: 'PASTICCERIA', kind: 'caffe', ent: 'R', awn: 1 } },
    { x0: 3160, x1: 3424, xs: [3198, 3292, 3372], fl: 5, nw: 3, mat: 'brown', tone: 0.66, corn: 'brk', lint: 'hood', fe: [1, 2], store: { sign: 'TABACCHI', kind: 'tabacchi', ent: 'L', signX: [3256, 3416] } },
    { x0: 3424, x1: 3644, fl: 4, nw: 3, mat: 'stucco', tone: 0.48, corn: 'dent', lint: 'flat', fe: null, store: { sign: 'MACELLERIA', kind: 'salumi', ent: 'R', awn: 2 }, upper: { 3: 'LEVATRICE' } },
    { x0: 3644, x1: 3876, fl: 5, nw: 3, mat: 'brick', tone: 0.74, corn: 'brk', lint: 'seg', fe: [0, 1], store: { sign: 'TRATTORIA', kind: 'tratt', ent: 'R' } },
    { x0: 3876, x1: 4154, fl: 4, nw: 4, mat: 'brick', tone: 0.6, corn: 'arc', lint: 'flat', fe: [2, 3], fanucci: 1, store: { sign: 'CALZOLAIO', kind: 'shoes', ent: 'C', signX: [3884, 3982] } },
    { x0: 4154, x1: 4330, fl: 5, nw: 2, mat: 'brown', tone: 0.7, corn: 'dent', lint: 'ped', fe: null, store: { sign: 'SARTORIA', kind: 'sarto', ent: null } },
  ];
  BLD.forEach((b, i) => { if (b.gf == null) b.gf = (i === 2 || i === 3 || b.fanucci) ? GF : 132 + Math.round(hf(i * 5 + 1) * 34); if (b.fh == null) b.fh = (i === 2 || i === 3 || b.fanucci) ? FH : 102 + Math.round(hf(i * 3 + 2) * 12); });
  const bTop = (b) => BASE - (b.gf || GF) - b.fl * (b.fh || FH) - CORN;
  function cols(b) {
    const m = b.nw <= 2 ? 22 : 26, pitch = (b.x1 - b.x0 - 2 * m) / b.nw;
    if (b.xs) return { xs: b.xs, pitch, ww: Math.min(42, pitch * 0.55) };
    if (b.mat === 'iron') { const xs = []; for (let i = 0; i < b.nw; i++) xs.push(b.x0 + m + pitch * (i + 0.5)); return { xs, pitch, ww: pitch * 0.62 }; }
    const xs = []; for (let i = 0; i < b.nw; i++) xs.push(b.x0 + m + pitch * (i + 0.5));
    return { xs, pitch, ww: Math.min(42, pitch * 0.55) };
  }
  const nearSeam = (x, hw) => SEAMS.some((s) => Math.abs(x - s) < hw);
  function offSeam(x, hw) { for (const s of SEAMS) { if (Math.abs(x - s) < hw + 3) x = x < s ? s - hw - 3 : s + hw + 3; } return x; }

  /* ================================================================ figures */
  const BODY = {
    man: { foot: 0.24, shin: 1.72, thigh: 1.86, torso: 2.22, neck: 0.3, sw: 1.02, hip: 0.76, waist: 0.84, ua: 1.45, fa: 1.25, lw: 0.42, aw: 0.35 },
    woman: { foot: 0.2, shin: 1.62, thigh: 1.74, torso: 2.08, neck: 0.32, sw: 0.84, hip: 0.94, waist: 0.66, ua: 1.36, fa: 1.18, lw: 0.36, aw: 0.3 },
    child: { foot: 0.2, shin: 1.25, thigh: 1.3, torso: 1.7, neck: 0.24, sw: 0.76, hip: 0.64, waist: 0.66, ua: 1.08, fa: 0.95, lw: 0.34, aw: 0.28 },
    tot: { foot: 0.16, shin: 0.82, thigh: 0.88, torso: 1.36, neck: 0.2, sw: 0.64, hip: 0.6, waist: 0.62, ua: 0.82, fa: 0.72, lw: 0.3, aw: 0.22 },
  };
  const totH = (B) => B.foot + B.shin + B.thigh + B.torso + B.neck + 1;
  // poses: legs nl/fl (near/far) and arms na/fa as [upper angle, lower angle] (0 = down, + = forward),
  // or {to:[x,y], bend} targets: legs relative to the ground origin, arms relative to the shoulder joint.
  const POSE = {
    stand: { nl: [0.05, 0.02], fl: [-0.05, -0.03], na: [0.08, 0.14], fa: [-0.06, 0.02] },
    stand2: { nl: [0.12, 0.05], fl: [-0.02, 0], na: [0.04, 0.3], fa: [-0.1, -0.05], lean: -0.03 },
    walk: { nl: [0.36, 0.08], fl: [-0.26, -0.56], na: [-0.32, -0.14], fa: [0.3, 0.58], lean: 0.05 },
    walk2: { nl: [-0.22, -0.52], fl: [0.32, 0.1], na: [0.3, 0.6], fa: [-0.28, -0.12], lean: 0.05 },
    stroll: { nl: [0.22, 0.04], fl: [-0.16, -0.38], na: { to: [1.2, 1.3], bend: -1 }, fa: [-0.14, -0.04], lean: -0.05 },
    run: { nl: [0.75, 0.1], fl: [-0.45, -1.3], na: [-0.7, 0.4], fa: [0.8, 1.9], lean: 0.2 },
    gesture: { nl: [0.06, 0.02], fl: [-0.05, -0.03], na: { to: [0.85, 0.75], bend: -1 }, fa: { to: [0.55, 1.15], bend: -1 }, lean: 0.04 },
    shrug: { nl: [0.04, 0.02], fl: [-0.05, -0.03], na: { to: [0.7, 0.55], bend: -1 }, fa: { to: [-0.5, 0.6], bend: 1 }, tilt: -0.1 },
    point: { nl: [0.06, 0.02], fl: [-0.05, -0.03], na: [2.3, 2.45], fa: [-0.05, 0.05], lean: -0.04 },
    lookup: { nl: [0.06, 0.02], fl: [-0.05, -0.03], na: [0.05, 0.1], fa: [-0.05, 0], lean: -0.06, tilt: -0.35 },
    pray: { nl: [0.03, 0.01], fl: [-0.03, -0.02], na: { to: [0.55, 0.8], bend: -1 }, fa: { to: [0.55, 0.85], bend: -1 }, tilt: 0.12 },
    candle: { nl: [0.2, 0.04], fl: [-0.14, -0.34], na: { to: [0.62, 0.95], bend: -1 }, fa: { to: [0.45, 1.05], bend: -1 }, lean: 0.03, tilt: 0.1 },
    pole: { nl: [0.22, 0.05], fl: [-0.16, -0.36], na: { to: [0.4, -0.55], bend: -1 }, fa: [-0.1, 0.1], lean: 0.03 },
    wave: { nl: [0.05, 0.02], fl: [-0.05, -0.03], na: [2.6, 2.95], fa: [-0.05, 0.05] },
    armsUp: { nl: [0.05, 0.02], fl: [-0.05, -0.03], na: [2.5, 2.85], fa: [2.2, 2.7], tilt: -0.3 },
    dance: { nl: [0.75, -0.25], fl: [-0.08, 0], na: [2.45, 2.85], fa: [1.9, 2.5], lean: -0.08 },
    dance2: { nl: [-0.1, -0.02], fl: [0.6, 1.4], na: { to: [0.15, 1.75], bend: 1 }, fa: [1.6, 2.2], lean: 0.05 },
    eat: { nl: [0.05, 0.02], fl: [-0.05, -0.03], na: { to: [0.32, -0.62], bend: -1 }, fa: [-0.05, 0.05], tilt: 0.05 },
    hips: { nl: [0.1, 0.02], fl: [-0.08, -0.03], na: { to: [0.1, 1.75], bend: 1 }, fa: { to: [-0.1, 1.75], bend: 1 }, lean: -0.04 },
    behind: { nl: [0.05, 0.02], fl: [-0.05, -0.03], na: [-0.3, -0.95], fa: [-0.25, -0.9], lean: 0.04 },
    reach: { nl: [0.3, 0.1], fl: [-0.2, -0.4], na: [0.95, 0.55], fa: [-0.1, 0.2], lean: 0.18 },
    carry: { nl: [0.06, 0.02], fl: [-0.05, -0.03], na: { to: [0.62, 1.55], bend: -1 }, fa: [-0.08, 0.05], lean: -0.05 },
    hold: { nl: [0.22, 0.04], fl: [-0.16, -0.36], na: [0.25, 0.32], fa: [-0.12, 0.08], lean: 0.04 },
    sit: { drop: 1.72, nl: { to: [1.7, -0.2], bend: 1 }, fl: { to: [1.5, -0.2], bend: 1 }, na: { to: [0.9, 1.6], bend: -1 }, fa: { to: [0.7, 1.7], bend: -1 } },
    sitTalk: { drop: 1.72, nl: { to: [1.7, -0.2], bend: 1 }, fl: { to: [1.5, -0.2], bend: 1 }, na: [0.8, 1.7], fa: { to: [0.7, 1.7], bend: -1 }, lean: 0.08 },
    crouch: { drop: 2.2, nl: { to: [0.8, -0.2], bend: 1 }, fl: { to: [-0.4, -0.2], bend: 1 }, na: { to: [1.0, 1.9], bend: -1 }, fa: [0.6, 0.4], lean: 0.55, tilt: 0.6 },
    stepUp: { nl: { to: [1.3, -1.3], bend: 1 }, fl: [-0.12, -0.3], na: [-0.42, -0.2], fa: [0.45, 0.8], lean: 0.16 },
    lean: { nl: [0.04, 0.02], fl: [-0.05, -0.03], na: { to: [0.95, 1.05], bend: -1 }, fa: { to: [0.85, 1.1], bend: -1 }, lean: 0.12 },
    trumpet: { nl: [0.22, 0.04], fl: [-0.16, -0.36], na: { to: [0.95, -0.25], bend: -1 }, fa: { to: [0.75, -0.2], bend: -1 }, lean: -0.03 },
    hug: { nl: [0.1, 0.02], fl: [-0.06, -0.03], na: { to: [0.95, 0.45], bend: -1 }, fa: { to: [0.85, 0.3], bend: -1 }, lean: 0.12, tilt: 0.15 },
    pocket: { nl: [0.05, 0.02], fl: [-0.05, -0.03], na: { to: [0.15, 1.85], bend: 1 }, fa: { to: [-0.05, 1.85], bend: 1 }, lean: -0.02 },
    accordion: { nl: [0.1, 0.02], fl: [-0.08, -0.03], na: { to: [0.95, 1.0], bend: -1 }, fa: { to: [-0.15, 1.0], bend: 1 }, lean: -0.04 },
    drum: { nl: [0.2, 0.04], fl: [-0.15, -0.34], na: { to: [1.05, 0.7], bend: -1 }, fa: { to: [0.6, 1.0], bend: -1 } },
    tuba: { nl: [0.2, 0.04], fl: [-0.15, -0.34], na: { to: [0.6, 0.5], bend: -1 }, fa: { to: [0.5, 0.75], bend: -1 } },
    vendor: { nl: [0.05, 0.02], fl: [-0.05, -0.03], na: { to: [0.95, 1.05], bend: -1 }, fa: { to: [0.7, 1.2], bend: -1 }, lean: 0.1 },
  };

  function ik(ax, ay, tx, ty, l1, l2, bend) {
    let dx = tx - ax, dy = ty - ay; let d = Math.hypot(dx, dy); const dm = (l1 + l2) * 0.999;
    if (d > dm) { dx *= dm / d; dy *= dm / d; d = dm; }
    if (d < 1e-4) d = 1e-4;
    const a = Math.atan2(dy, dx), cA = clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1), off = -Math.acos(cA) * bend;
    return [ax + Math.cos(a + off) * l1, ay + Math.sin(a + off) * l1, ax + dx, ay + dy];
  }
  function limb(pts, ws) {
    const n = pts.length / 2, L = [], R = [];
    for (let i = 0; i < n; i++) {
      const a = Math.max(0, i - 1), b = Math.min(n - 1, i + 1);
      let dx = pts[2 * b] - pts[2 * a], dy = pts[2 * b + 1] - pts[2 * a + 1]; const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
      L.push(pts[2 * i] - dy * ws[i], pts[2 * i + 1] + dx * ws[i]);
      R.push(pts[2 * i] + dy * ws[i], pts[2 * i + 1] - dx * ws[i]);
    }
    // round the two ends
    const ex = (i, j, w) => { const dx = pts[2 * i] - pts[2 * j], dy = pts[2 * i + 1] - pts[2 * j + 1], l = Math.hypot(dx, dy) || 1; return [pts[2 * i] + dx / l * w * 0.7, pts[2 * i + 1] + dy / l * w * 0.7]; };
    const e0 = ex(0, 1, ws[0]), e1 = ex(n - 1, n - 2, ws[n - 1]);
    const out = [e0[0], e0[1]];
    out.push(...L, e1[0], e1[1]);
    for (let i = n - 1; i >= 0; i--) out.push(R[2 * i], R[2 * i + 1]);
    return chaikin(out, true, 2);
  }
  const rot = (x, y, a) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];

  /* draw one person. F: {x, y (feet), h, dir (1 right / -1 left), fr (0 profile .. 1 frontal), back, sex 'm'|'f', age 'a'|'c'|'t',
   * pose, w: wardrobe {top, tc, bc, sk, hat, hc, hair, apron, shawl, vest, tie, must}, haze, props[], belly, slim} */
  // a figure is drawn twice: first its outer contour alone, then its parts with fills, hatching and thin inner lines
  function drawFig(c, F) {
    const lt = F.lights; F.lights = null; drawFigPass(c, F, 1); F.lights = lt;
    return drawFigPass(c, F, 2);
  }
  function drawFigPass(c, F, PASS) {
    const body = F.age === 'c' ? 'child' : F.age === 't' ? 'tot' : F.sex === 'f' ? 'woman' : 'man';
    const B = Object.assign({}, BODY[body]);
    if (F.slim) { B.sw *= F.slim; B.waist *= F.slim; B.hip *= F.slim; }
    if (F.broad) B.sw *= F.broad;
    const u = F.h / totH(B), fr = F.fr == null ? 0.45 : F.fr, U = u * (F.pxs || 1), hpx = F.h * (F.pxs || 1);
    const P = F.pose || POSE.stand, w = F.w || {};
    const hz = F.haze || 0, det = hpx > 80 ? 2 : hpx > 46 ? 1 : 0;
    const col = (k) => css(mix(sepify(k, 0.3), HAZE, hz));
    const OUTC = css(mix(INK, HAZE, hz * 0.85), 0.92);
    const ow = Math.min(1.05, 0.32 + hpx * 0.0045) / U;
    const lightLocal = (F.lx == null ? -1 : F.lx) * F.dir; // -1: light comes from local -x
    c.save();
    c.translate(F.x, F.y);
    // ground shadow
    if (!F.noShadow && PASS === 1) {
      c.fillStyle = 'rgba(52,34,22,' + (0.2 * (1 - hz)).toFixed(3) + ')';
      c.beginPath(); c.ellipse(F.h * 0.04 * -lightLocal * F.dir, 0, F.h * 0.2, F.h * 0.035, 0, 0, TAU); c.fill();
    }
    c.scale(u * F.dir, u);
    const lean = P.lean || 0, drop = P.drop || 0;
    const hipY = -(B.foot + B.shin + B.thigh) + drop;
    const hip = [0, hipY];
    const sh = [hip[0] + Math.sin(lean) * B.torso, hip[1] - Math.cos(lean) * B.torso];
    const tilt = (P.tilt || 0) + (F.tilt || 0);
    const nk = [sh[0] + Math.sin(lean + tilt * 0.5) * B.neck, sh[1] - Math.cos(lean + tilt * 0.5) * B.neck];
    const hc = [nk[0] + Math.sin(lean + tilt) * 0.52 + 0.06, nk[1] - Math.cos(lean + tilt) * 0.52];

    function legJ(side, spec) {
      const off = side * B.hip * 0.42 * (0.25 + 0.75 * fr);
      const hx = hip[0] + off, hy = hip[1];
      let kx, ky, ax, ay;
      if (Array.isArray(spec)) { kx = hx + Math.sin(spec[0]) * B.thigh; ky = hy + Math.cos(spec[0]) * B.thigh; ax = kx + Math.sin(spec[1]) * B.shin; ay = ky + Math.cos(spec[1]) * B.shin; }
      else { const r = ik(hx, hy, spec.to[0] + off * 0.5, spec.to[1], B.thigh, B.shin, spec.bend); kx = r[0]; ky = r[1]; ax = r[2]; ay = r[3]; }
      return { hx, hy, kx, ky, ax, ay };
    }
    function armJ(side, spec) {
      const off = side * B.sw * 0.82 * (0.22 + 0.78 * fr);
      const r0 = rot(off, 0.18, lean);
      const sx = sh[0] + r0[0], sy = sh[1] + r0[1];
      let ex, ey, wx, wy;
      if (Array.isArray(spec)) { ex = sx + Math.sin(spec[0]) * B.ua; ey = sy + Math.cos(spec[0]) * B.ua; wx = ex + Math.sin(spec[1]) * B.fa; wy = ey + Math.cos(spec[1]) * B.fa; }
      else { const r = ik(sx, sy, sx + spec.to[0], sy + spec.to[1], B.ua, B.fa, spec.bend); ex = r[0]; ey = r[1]; wx = r[2]; wy = r[3]; }
      return { sx, sy, ex, ey, wx, wy };
    }
    const LN = legJ(1, F.nl || P.nl || POSE.stand.nl), LF = legJ(-1, F.fl || P.fl || POSE.stand.fl);
    const AN = armJ(1, F.na || P.na || POSE.stand.na), AF = armJ(-1, F.fa || P.fa || POSE.stand.fa);
    const J = { u: U, hip, sh, nk, hc, LN, LF, AN, AF, B };

    function group(polys, k, shade, ang, heavy) {
      c.beginPath(); for (const p of polys) addP(c, p);
      c.lineJoin = 'round';
      if (PASS === 1) {
        // one confident outer contour for the whole figure, heavier on the shadow side and under the feet
        c.lineWidth = ow * (heavy ? 3.6 : 2.5); c.strokeStyle = OUTC; c.stroke();
        if (det && !F.solid) { c.save(); c.beginPath(); if (lightLocal < 0) c.rect(0.02, -30, 30, 60); else c.rect(-30.02, -30, 30, 60); c.clip(); c.beginPath(); for (const p of polys) addP(c, p); c.lineWidth = ow * 3.9; c.stroke(); c.restore(); }
        return;
      }
      if (typeof k === 'string') { c.fillStyle = k; c.fill(); }
      else {
        const sk = sepify(k, 0.3), d = 1 - lum(sk), light = d < 0.36;
        const wash = det && !F.solid ? mix(sk, PAPER, light ? 0.62 : clamp(0.3 + d * 0.18, 0, 0.45) * (det > 1 ? 1 : 0.5)) : sk;
        c.fillStyle = css(mix(wash, HAZE, hz)); c.fill();
        if (det && !F.solid) {
          if (!light) penHatch(polys, d, ang == null ? Math.PI / 2 + lean : ang);
          if (shade) shadeIt(polys, shade * (light ? 0.45 : 0.5 + d), light ? 0.2 : d);
        }
      }
      if (det && !F.solid) { c.beginPath(); for (const p of polys) addP(c, p); c.lineWidth = ow * 0.7; c.strokeStyle = OUTC; c.stroke(); }
    }
    function bboxOf(polys) { let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity; for (const p of polys) for (let i = 0; i < p.length; i += 2) { if (p[i] < x0) x0 = p[i]; if (p[i] > x1) x1 = p[i]; if (p[i + 1] < y0) y0 = p[i + 1]; if (p[i + 1] > y1) y1 = p[i + 1]; } return [x0, y0, x1, y1]; }
    function hl(b, ang, sp) {
      const ca = Math.cos(ang), sa = Math.sin(ang), cx = (b[0] + b[2]) / 2, cy = (b[1] + b[3]) / 2, r = Math.hypot(b[2] - b[0], b[3] - b[1]) / 2 + 0.1;
      for (let d = -r; d <= r; d += sp) { const px = cx - sa * d, py = cy + ca * d; c.moveTo(px - ca * r, py - sa * r); c.lineTo(px + ca * r, py + sa * r); }
    }
    function penHatch(polys, d, ang) {
      const b = bboxOf(polys);
      c.save(); c.beginPath(); for (const p of polys) addP(c, p); c.clip();
      const sp = lerp(3.4, 1.3, clamp((d - 0.36) / 0.5, 0, 1)) / U;
      c.beginPath(); hl(b, ang, sp);
      c.lineWidth = 0.42 / U; c.strokeStyle = css(mix(INK, HAZE, hz * 0.8), 0.58); c.stroke();
      c.restore();
    }
    function shadeIt(polys, amt, dd) {
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (const p of polys) for (let i = 0; i < p.length; i += 2) { if (p[i] < x0) x0 = p[i]; if (p[i] > x1) x1 = p[i]; if (p[i + 1] < y0) y0 = p[i + 1]; if (p[i + 1] > y1) y1 = p[i + 1]; }
      c.save(); c.beginPath(); for (const p of polys) addP(c, p); c.clip();
      const mid = (x0 + x1) / 2 + (x1 - x0) * ((dd || 0.4) < 0.3 ? 0.22 : -0.04) * (lightLocal < 0 ? 1 : -1);
      c.beginPath(); if (lightLocal < 0) c.rect(mid, y0 - 1, x1 - mid + 1, y1 - y0 + 2); else c.rect(x0 - 1, y0 - 1, mid - x0 + 1, y1 - y0 + 2); c.clip();
      const sp = Math.max(lerp(2.6, 1.35, clamp(dd || 0.4, 0, 1)) / U, 0.1), hgt = y1 - y0;
      c.beginPath();
      for (let s = x0 - hgt; s < x1 + hgt; s += sp) { c.moveTo(s, y1 + 0.5); c.lineTo(s + hgt * 0.55, y0 - 0.5); }
      if (dd > 0.68) hl([x0, y0, x1, y1], 0, sp * 1.1);
      c.lineWidth = 0.42 / U; c.strokeStyle = css(mix(INK, HAZE, hz), Math.min(0.7, 0.5 * amt)); c.stroke();
      c.restore();
    }
    const legPoly = (L, wmul) => { const mx = lerp(L.hx, L.kx, 0.5), my = lerp(L.hy, L.ky, 0.5), cxx = lerp(L.kx, L.ax, 0.35) - 0.06, cyy = lerp(L.ky, L.ay, 0.35); return limb([L.hx, L.hy, mx, my, L.kx, L.ky, cxx, cyy, L.ax, L.ay], [B.lw * 1.2 * wmul, B.lw * 1.04 * wmul, B.lw * 0.84 * wmul, B.lw * 0.86 * wmul, B.lw * 0.58 * wmul]); };
    function shoe(L, k) {
      const fl = 0.95 * (B.foot / 0.24) * (1 - 0.55 * fr) + 0.12;
      const back = L.ay < -B.foot - 0.12 ? clamp((-B.foot - L.ay) * 0.9, 0, 1.2) : 0;
      const a = back;
      const pts = [-0.2, -0.12, -0.22, B.foot * 0.95, fl, B.foot * 0.95, fl + 0.05, B.foot * 0.45, fl * 0.45, -0.1];
      const q = [];
      for (let i = 0; i < pts.length; i += 2) { const r = rot(pts[i], pts[i + 1], a); q.push(L.ax + r[0], L.ay + r[1]); }
      group([chaikin(q, true, 1)], k, 0, null, true);
    }
    const trouser = w.bc || C.dark;
    const skirt = w.sk || (F.sex === 'f' ? (F.age === 'a' ? 'ankle' : 'knee') : null);
    const top = w.top || (F.sex === 'f' ? 'blouse' : 'jacket');
    const robe = top === 'cassock' || top === 'surplice' || top === 'robe';
    const legC = skirt || robe ? (w.stock || C.black) : trouser;
    // far leg, far arm (behind)
    if (!F.noLegs) {
      group([legPoly(LF, skirt || robe ? 0.7 : 1)], mix(legC, INK, 0.12), 0.6, Math.atan2(LF.ay - LF.hy, LF.ax - LF.hx)); shoe(LF, w.shoe || C.black);
    }
    const farArmBehind = fr < 0.6;
    function armDraw(A, side) {
      const sleeve = w.sleeve || (top === 'shirt' || top === 'blouse' ? (w.tc || C.white) : (w.tc || C.dark));
      const bare = w.bare;
      group([limb([A.sx, A.sy, A.ex, A.ey, A.wx, A.wy], [B.aw * 1.1, B.aw * 0.92, B.aw * 0.75])], side < 0 ? mix(bare ? C.skin : sleeve, INK, 0.1) : (bare ? C.skin : sleeve), 0.7, Math.atan2(A.wy - A.sy, A.wx - A.sx) + Math.PI / 2);
      if (det > 1 && !bare) { const mx = (A.sx + A.wx) / 2, my = (A.sy + A.wy) / 2; fold3(A.ex + (mx - A.ex) * 0.5 - 0.05, A.ey + (my - A.ey) * 0.5, A.ex, A.ey + 0.04, lerp(A.ex, A.wx, 0.28), lerp(A.ey, A.wy, 0.28)); fold3(lerp(A.ex, A.wx, 0.55) - 0.12, lerp(A.ey, A.wy, 0.55), lerp(A.ex, A.wx, 0.62), lerp(A.ey, A.wy, 0.62) + 0.05, lerp(A.ex, A.wx, 0.68) + 0.12, lerp(A.ey, A.wy, 0.68)); }
      { const dx = A.wx - A.ex, dy = A.wy - A.ey, l = Math.hypot(dx, dy) || 1, ux = dx / l, uy = dy / l, nx = -uy, ny = ux, X = A.wx, Y = A.wy, hs = 0.9 + hf(Math.round(F.x * 7 + side * 3)) * 0.25;
        const P0 = (a, b) => [X + (ux * a + nx * b) * hs, Y + (uy * a + ny * b) * hs];
        const q = [].concat(P0(-0.02, 0.1), P0(0.24, 0.12), P0(0.38, 0.05), P0(0.36, -0.06), P0(0.22, -0.09), P0(0.2, -0.17), P0(0.08, -0.15), P0(0.0, -0.09));
        c.beginPath(); addP(c, chaikin(q, true, 2)); c.lineWidth = ow * (PASS === 1 ? 2.2 : 0.8); c.strokeStyle = OUTC; c.lineJoin = 'round'; c.stroke(); if (PASS === 2) { c.fillStyle = col(w.glove || C.skin); c.fill(); c.stroke(); }
        if (det > 1 && PASS === 2) { const f0 = P0(0.12, -0.04), f1 = P0(0.22, -0.13), f2 = P0(0.26, 0.04), f3 = P0(0.37, 0.02); c.beginPath(); c.moveTo(f0[0], f0[1]); c.quadraticCurveTo(f1[0], f1[1] + 0.02, f1[0], f1[1]); c.moveTo(f2[0], f2[1]); c.lineTo(f3[0], f3[1]); c.strokeStyle = css(mix(INK, HAZE, hz), 0.5); c.lineWidth = 0.35 / U; c.stroke(); }
        A.hx = X + ux * 0.22; A.hy = Y + uy * 0.22; }
    }
    const foldC = css(mix(INK, HAZE, hz), 0.55);
    function fold3(x0, y0, x1, y1, x2, y2) { if (det < 2 || PASS === 1) return; c.beginPath(); c.moveTo(x0, y0); c.quadraticCurveTo(x1, y1, x2, y2); c.strokeStyle = foldC; c.lineWidth = 0.5 / U; c.stroke(); }
    function legFolds(Lg) { if (skirt || robe) return; fold3(Lg.kx - 0.22, Lg.ky - 0.12, Lg.kx + 0.02, Lg.ky + 0.06, Lg.kx + 0.2, Lg.ky - 0.08); fold3(Lg.kx - 0.12, Lg.ky + 0.28, Lg.kx + 0.04, Lg.ky + 0.36, Lg.kx + 0.18, Lg.ky + 0.24); fold3(Lg.ax - 0.22, Lg.ay - 0.32, Lg.ax, Lg.ay - 0.22, Lg.ax + 0.22, Lg.ay - 0.34); }
    if (!F.noLegs) legFolds(LF);
    if (farArmBehind && !F.noFarArm) armDraw(AF, -1);
    if (!F.noLegs) { group([legPoly(LN, skirt || robe ? 0.7 : 1)], legC, 0.6, Math.atan2(LN.ay - LN.hy, LN.ax - LN.hx)); shoe(LN, w.shoe || C.black); legFolds(LN); }
    // knickers / trousers detail: crease
    // torso
    const T = B.torso, frw = 0.6 + 0.4 * fr;
    const ws = B.sw * frw, wc = ws * (F.sex === 'f' ? 0.94 : 0.92), wwst = B.waist * frw * (F.belly || 1), whp = B.hip * (0.62 + 0.38 * fr);
    const fwd = 0.14 * (1 - fr), bust = F.sex === 'f' && F.age === 'a' ? 0.12 * (1 - fr) : 0, belly = F.belly ? (F.belly - 1) * 0.9 * (1 - fr * 0.5) : 0;
    let jl = top === 'jacket' || top === 'uniform' ? 0.85 : top === 'coat' ? 2.3 : top === 'surplice' ? 2.0 : 0.3;
    if (w.jl != null) jl = w.jl;
    const torsoPts = (len, wid) => {
      const p = [-whp * wid, len, -wwst * 0.96 * wid, -T * 0.42, -wc * wid, -T * 0.78, -ws * 0.92 * wid, -T * 0.98, -0.26, -T - 0.06, 0.26, -T - 0.06,
        ws * 0.92 * wid + fwd * 0.3, -T * 0.97, wc * wid + fwd + bust, -T * 0.72, wwst * wid + fwd * 0.5 + belly, -T * 0.4, whp * wid + fwd * 0.3 + belly * 0.6, len];
      if (len > 0.9) { p[0] = -whp * wid - len * 0.16; p[p.length - 2] = whp * wid + len * 0.16 + belly * 0.6; }
      const q = [];
      p.push(belly * 0.3 + fwd * 0.2, len + 0.06 + len * 0.05);
      for (let i = 0; i < p.length; i += 2) { const r = rot(p[i], p[i + 1], lean); q.push(hip[0] + r[0], hip[1] + r[1]); }
      return chaikin(q, true, 2);
    };
    // skirt / robe
    if (skirt || robe) {
      const hemY = robe ? -B.foot * 0.6 : skirt === 'ankle' ? -B.foot - 0.35 : skirt === 'calf' ? -B.foot - 0.9 : -B.foot - B.shin * 0.75;
      const spread = Math.max(Math.abs(LN.ax - LF.ax) * 0.5 + 0.35, whp * 1.05);
      const cx = (LN.ax + LF.ax) / 2 + (robe ? 0 : 0.05);
      const wr = rot(0, -T * 0.4, lean);
      const wy = hip[1] + wr[1], wx = hip[0] + wr[0];
      const sw0 = wwst * 1.02;
      const fl2 = robe ? 0.3 : 0.6; const hemR = cx + spread + fl2, hemL = cx - spread - fl2 * 0.9, hem = []; for (let i = 0; i <= 7; i++) { const t = i / 7; hem.push(lerp(hemR, hemL, t), hemY - 0.12 + Math.sin(t * Math.PI) * 0.16 + (i % 2 ? 0.08 : -0.04)); } const p = [wx - sw0, wy, wx + sw0 + fwd * 0.4, wy, wx + sw0 + fwd * 0.4 + 0.12, wy + 0.7].concat(hem, [wx - sw0 - 0.12, wy + 0.7]);
      const sc = robe ? (w.rc || C.black) : (w.bc || C.dark);
      group([chaikin(p, true, 2)], sc, 0.8, Math.PI / 2);
      if (det > 1 && !robe && PASS === 2) { c.beginPath(); for (let i = 1; i < 5; i++) { const t = i / 5, xa = lerp(wx - sw0, wx + sw0, t), xb = lerp(hemL, hemR, 1 - t); c.moveTo(xa, wy + 0.4); c.quadraticCurveTo((xa + xb) / 2 + (t - 0.5) * 0.3, (wy + hemY) / 2, xb, hemY - 0.05); } c.lineWidth = 0.35 / U; c.strokeStyle = css(mix(INK, HAZE, hz), 0.35); c.stroke(); }
    }
    const tc = w.tc || (top === 'shirt' || top === 'blouse' ? C.white : C.dark);
    group([torsoPts(jl, 1)], tc, 0.75);
    if (det > 1 && !F.solid) {
      const R = (x, y) => { const r = rot(x, y, lean); return [hip[0] + r[0], hip[1] + r[1]]; }, sg = lightLocal < 0 ? 1 : -1;
      const a0 = R(sg * ws * 0.62, -T * 0.86), a1 = R(sg * wwst * 0.75, -T * 0.5), a2 = R(sg * whp * 0.55, Math.min(jl, 1.2) * 0.7);
      fold3(a0[0], a0[1], a1[0], a1[1], a2[0], a2[1]);
      const b0 = R(-sg * ws * 0.2, -T * 0.66), b1 = R(-sg * ws * 0.05 + fwd, -T * 0.52), b2 = R(sg * ws * 0.25, -T * 0.6); fold3(b0[0], b0[1], b1[0], b1[1], b2[0], b2[1]);
      if (jl > 0.6) { const c0 = R(fwd * 0.6 - 0.1, -T * 0.3), c1 = R(fwd * 0.8 + 0.1, -T * 0.18), c2 = R(fwd * 0.6 + 0.3, Math.min(jl, 1.5) * 0.5); fold3(c0[0], c0[1], c1[0], c1[1], c2[0], c2[1]); }
    }
    // garment details inside the torso
    if (!det && PASS === 2 && !F.solid) { const R = (x, y) => { const r = rot(x, y, lean); return [hip[0] + r[0], hip[1] + r[1]]; }; const a = R(-wwst, -T * 0.4), b2 = R(wwst + fwd, -T * 0.4); line(c, a[0], a[1], b2[0], b2[1], css(mix(INK, HAZE, hz), 0.5), 0.5 / U); if (top === 'jacket' || top === 'coat') { const t0 = R(fwd * 0.5, -T), t1 = R(fwd * 0.6, Math.min(jl, 1)); line(c, t0[0], t0[1], t1[0], t1[1], css(mix(INK, HAZE, hz), 0.5), 0.5 / U); } }
    if (det && PASS === 2) {
      c.save(); c.beginPath(); addP(c, torsoPts(jl, 1)); c.clip();
      const R = (x, y) => { const r = rot(x, y, lean); return [hip[0] + r[0], hip[1] + r[1]]; };
      if ((top === 'jacket' || top === 'coat') && fr > 0.25 && !F.back) {
        const a = R(0.04 + fwd * 0.6, -T - 0.06), d = R(0.06 + fwd * 0.75 + bust, -T * 0.52);
        fillP(c, [a[0] - 0.24 * fr - 0.04, a[1], a[0] + 0.24 * fr + 0.06, a[1], d[0], d[1]], col(w.shirt || C.white));
        if (det > 1) { const l0 = R(-0.22 * fr + fwd * 0.5, -T - 0.04), l1 = R(-0.42 * fr + fwd * 0.5, -T * 0.78), l2 = R(0.04 + fwd * 0.75, -T * 0.5), m0 = R(0.3 * fr + fwd * 0.7, -T - 0.04), m1 = R(0.5 * fr + fwd * 0.8, -T * 0.8); strokeL(c, [l0[0], l0[1], l1[0], l1[1], l2[0], l2[1]], css(mix(INK, HAZE, hz), 0.55), 0.5 / U); strokeL(c, [m0[0], m0[1], m1[0], m1[1], l2[0], l2[1]], css(mix(INK, HAZE, hz), 0.55), 0.5 / U); for (let i = 0; i < 2; i++) { const q = R(0.08 + fwd * 0.8 + belly * 0.8, -T * (0.42 - i * 0.12)); c.fillStyle = css(INK, 0.6); c.beginPath(); c.arc(q[0], q[1], 0.05, 0, TAU); c.fill(); } }
        if (w.tie !== false) { const t0 = R(0.02 + fwd * 0.5, -T - 0.02), t1 = R(0.02 + fwd * 0.5, -T * 0.6); line(c, t0[0], t0[1], t1[0], t1[1], col(w.tiec || C.black), 0.16); }
        if (det > 1) { const l1 = R(-0.3 * fr + fwd * 0.4, -T - 0.05), l2 = R(-0.1 + fwd * 0.4, -T * 0.4); line(c, l1[0], l1[1], l2[0], l2[1], css(INK, 0.45), 0.6 / U); }
      }
      if (top === 'shirt' && w.vest) {
        const p = []; const pts = [-wc * 0.95, -T * 0.86, -0.02, -T * 0.82, 0.25 + fwd, -T * 0.55, wc + fwd, -T * 0.86, wwst + fwd * 0.5 + belly, -T * 0.32, whp * 0.95, 0.05, -whp * 0.95, 0.05];
        for (let i = 0; i < pts.length; i += 2) { const r = R(pts[i], pts[i + 1]); p.push(r[0], r[1]); }
        fillP(c, chaikin(p, true, 1), col(w.vest));
        if (w.braces) { const a = R(-0.25, -T), b = R(-0.2, -T * 0.2); line(c, a[0], a[1], b[0], b[1], col(C.dark), 0.1); }
      }
      if (top === 'shirt' && w.braces && !w.vest) { const a = R(-0.15 + fwd * 0.5, -T), b = R(-0.1 + fwd * 0.5, -T * 0.25), a2 = R(0.25 + fwd, -T), b2 = R(0.2 + fwd, -T * 0.25); line(c, a[0], a[1], b[0], b[1], col(C.dark), 0.11); if (fr > 0.4) line(c, a2[0], a2[1], b2[0], b2[1], col(C.dark), 0.11); }
      if (top === 'uniform' && det > 1) { const a = R(fwd * 0.6 + 0.05, -T), b = R(fwd * 0.6 + 0.05, 0.6); line(c, a[0], a[1], b[0], b[1], col(C.gold), 0.12); for (let i = 1; i < 5; i++) { const q = R(fwd * 0.6 + 0.12, -T + i * T * 0.22); c.fillStyle = col(C.gold); c.beginPath(); c.arc(q[0], q[1], 0.06, 0, TAU); c.fill(); } }
      if (top === 'coat' && det > 1) { for (let i = 0; i < 5; i++) { const q = R(fwd * 0.6 + 0.18, -T * 0.9 + i * 0.5); c.fillStyle = col(C.gold); c.beginPath(); c.arc(q[0], q[1], 0.07, 0, TAU); c.fill(); } }
      if (w.chain && det > 1) { const a = R(-0.1 + fwd, -T * 0.42), b = R(0.35 + fwd + belly, -T * 0.36); c.beginPath(); c.moveTo(a[0], a[1]); c.quadraticCurveTo((a[0] + b[0]) / 2, a[1] + 0.25, b[0], b[1]); c.strokeStyle = col(C.gold); c.lineWidth = 0.07; c.stroke(); }
      c.restore();
    }
    if (w.apron) {
      const R = (x, y) => { const r = rot(x, y, lean); return [hip[0] + r[0], hip[1] + r[1]]; };
      const a = R(-wwst * 0.6 + fwd * 0.8, -T * 0.42), b = R(wwst + fwd * 0.6 + belly, -T * 0.42);
      const ah = skirt ? -B.foot - 0.6 - (skirt === 'knee' ? 1 : 0) : -B.foot - B.shin * 0.55;
      const p = [a[0], a[1], b[0], b[1], b[0] + 0.25 + Math.max(0, LN.ax) * 0.2, ah, a[0] + 0.1, ah + 0.05];
      if (w.bib) { const t = R(wwst * 0.2 + fwd, -T * 0.92), t2 = R(wwst + fwd, -T * 0.92); p.splice(2, 0, t[0], t[1], t2[0], t2[1]); }
      group([chaikin(p, true, 1)], w.apron === true ? C.white : w.apron, 0.4);
    }
    // neck & head
    const skin = w.skin || C.skin;
    group([limb([sh[0] + Math.sin(lean) * -0.05, sh[1] + 0.1, nk[0], nk[1] - 0.15], [0.2, 0.18])], mix(skin, INK, 0.08), 0);
    if (F.turn) { c.save(); c.translate(2 * hc[0], 0); c.scale(-1, 1); }
    const hrx = 0.43 * (0.9 + 0.1 * fr), hry = 0.54;
    const headPts = [];
    for (let i = 0; i < 18; i++) { const a = (i / 18) * TAU; headPts.push(hc[0] + Math.cos(a) * hrx, hc[1] + Math.sin(a) * hry); }
    const hp = [];
    for (let i = 0; i < headPts.length; i += 2) { const r = rot(headPts[i] - hc[0], headPts[i + 1] - hc[1], tilt); hp.push(hc[0] + r[0], hc[1] + r[1]); }
    const H = (x, y) => { const r = rot(x, y, tilt); return [hc[0] + r[0], hc[1] + r[1]]; };
    const polys = [hp];
    if (fr < 0.8 && !F.back) { const n1 = H(hrx * 0.86, -0.12), n2 = H(hrx + 0.14, 0.12), n3 = H(hrx * 0.8, 0.2); polys.push([n1[0], n1[1], n2[0], n2[1], n3[0], n3[1]]); const j1 = H(hrx * 0.7, 0.3), j2 = H(hrx * 0.55, 0.5), j3 = H(0, 0.4); polys.push([j1[0], j1[1], j2[0], j2[1], j3[0], j3[1]]); }
    group(polys, F.back ? mix(w.hair || C.black, INK, 0.1) : skin, 0);
    // hair
    const hair = w.hair || (F.old ? C.light : C.black);
    if (!F.back) {
      const hb = [];
      const front = F.sex === 'f' ? 0.25 : 0.4;
      for (let i = 0; i <= 12; i++) { const a = Math.PI * (1.0 + i / 12 * (0.5 + front)); hb.push(Math.cos(a) * (hrx + 0.03), Math.sin(a) * (hry + 0.03)); }
      hb.push(-hrx * 0.1, -0.05, -hrx * 0.95, 0.2);
      const q = []; for (let i = 0; i < hb.length; i += 2) { const p = H(hb[i], hb[i + 1]); q.push(p[0], p[1]); }
      if (!w.hat || w.hat === 'veil') fillP(c, q, col(hair));
      if (F.sex === 'f' && F.age !== 't' && !w.shawl && (!w.hat || w.hat === 'bun')) { const bn = H(-hrx * 0.95, -0.15); c.beginPath(); c.arc(bn[0], bn[1], 0.22, 0, TAU); c.fillStyle = col(hair); c.fill(); }
      if (det) {
        // face: eye, ear, shading on the far side
        const e = H(hrx * 0.45 + (fr - 0.5) * 0.1, -0.06);
        if (fr < 0.95) { c.fillStyle = css(mix(INK, HAZE, hz), 0.8); c.beginPath(); c.ellipse(e[0], e[1], 0.055, 0.035, tilt, 0, TAU); c.fill(); }
        if (fr > 0.55) { const e2 = H(-hrx * 0.25, -0.06); c.beginPath(); c.ellipse(e2[0], e2[1], 0.05, 0.035, tilt, 0, TAU); c.fill(); }
        const ea = H(-hrx * 0.12 * (1 - fr), 0.02); if (fr < 0.7 && det > 1) { c.beginPath(); c.arc(ea[0], ea[1], 0.08, -1.2, 1.8); c.strokeStyle = css(mix(INK, HAZE, hz), 0.55); c.lineWidth = 0.4 / U; c.stroke(); }
        if (det > 1 && fr < 0.95) { const b0 = H(hrx * 0.25, -0.17), b1 = H(hrx * 0.75, -0.2); line(c, b0[0], b0[1], b1[0], b1[1], css(mix(INK, HAZE, hz), 0.6), 0.45 / U); if (!w.must) { const m0 = H(hrx * 0.5, 0.3), m1 = H(hrx * 0.82, 0.29); line(c, m0[0], m0[1], m1[0], m1[1], css(mix(INK, HAZE, hz), 0.55), 0.4 / U); } const n0 = H(hrx * 0.82, -0.14), n1 = H(hrx + 0.12, 0.1); line(c, n0[0], n0[1], n1[0], n1[1], css(mix(INK, HAZE, hz), 0.45), 0.4 / U); const ch0 = H(hrx * 0.15, 0.52), ch1 = H(hrx * 0.6, 0.42); line(c, ch0[0], ch0[1], ch1[0], ch1[1], css(mix(INK, HAZE, hz), 0.5), 0.4 / U); }
        if (w.must) { const m0 = H(hrx * 0.55, 0.2), m1 = H(hrx + 0.06, 0.2); c.beginPath(); c.moveTo(m0[0], m0[1]); c.quadraticCurveTo((m0[0] + m1[0]) / 2, m0[1] - 0.07, m1[0], m1[1] + 0.04); c.strokeStyle = col(hair === C.light ? C.mid : C.black); c.lineWidth = 0.11; c.stroke(); }
        c.save(); c.beginPath(); addP(c, hp); c.clip();
        c.beginPath(); const sp = Math.max(1.4 / U, 0.1);
        for (let s = -1.2; s < 1.2; s += sp) { const a0 = H(s, 0.7), a1 = H(s + 0.5, -0.7); c.moveTo(a0[0], a0[1]); c.lineTo(a1[0], a1[1]); }
        c.restore();
        c.save(); c.beginPath(); addP(c, hp); c.clip(); c.beginPath();
        const sx0 = lightLocal < 0 ? hrx * 0.25 : -hrx * 2, sx1 = lightLocal < 0 ? hrx * 2 : -hrx * 0.25;
        const rr = H(sx0, -1); const r2 = H(sx1, -1); const r3 = H(sx1, 1); const r4 = H(sx0, 1);
        c.moveTo(rr[0], rr[1]); c.lineTo(r2[0], r2[1]); c.lineTo(r3[0], r3[1]); c.lineTo(r4[0], r4[1]); c.closePath(); c.clip();
        c.beginPath(); for (let s = -1.5; s < 1.5; s += sp) { const a0 = H(s, 0.7), a1 = H(s + 0.45, -0.7); c.moveTo(a0[0], a0[1]); c.lineTo(a1[0], a1[1]); }
        c.lineWidth = 0.38 / U; c.strokeStyle = css(mix(INK, HAZE, hz), 0.45); c.stroke(); c.restore();
      }
    }
    // headwear
    const hat = w.hat, hcol = w.hc || C.black;
    const HP = (arr) => { const q = []; for (let i = 0; i < arr.length; i += 2) { const p = H(arr[i], arr[i + 1]); q.push(p[0], p[1]); } return q; };
    if (hat === 'cap') group([chaikin(HP([-hrx - 0.06, -0.02, -hrx - 0.02, -0.38, -0.1, -0.66, hrx * 0.8, -0.52, hrx + 0.42, -0.26, hrx + 0.3, -0.18, hrx * 0.4, -0.24, -hrx * 0.4, -0.08]), true, 1)], hcol, 0.5);
    else if (hat === 'fedora') { group([chaikin(HP([-hrx - 0.02, -0.3, -hrx + 0.04, -0.82, -0.1, -0.94, 0.12, -0.84, hrx * 0.95, -0.86, hrx + 0.03, -0.3]), true, 1)], hcol, 0.5); group([HP([-hrx - 0.42, -0.26, -hrx, -0.36, hrx, -0.36, hrx + 0.46, -0.3, hrx + 0.4, -0.2, -hrx - 0.36, -0.18])], hcol, 0.3); fillP(c, HP([-hrx - 0.0, -0.32, hrx + 0.02, -0.32, hrx + 0.02, -0.46, -hrx + 0.0, -0.46]), col(w.band || C.black)); }
    else if (hat === 'bowler') { group([chaikin(HP([-hrx - 0.02, -0.3, -hrx * 0.95, -0.66, -0.1, -0.9, hrx * 0.8, -0.8, hrx + 0.03, -0.3]), true, 2)], hcol, 0.5); group([HP([-hrx - 0.22, -0.28, hrx + 0.24, -0.3, hrx + 0.2, -0.2, -hrx - 0.18, -0.19])], hcol, 0); }
    else if (hat === 'boater') { group([HP([-hrx - 0.02, -0.3, -hrx, -0.68, hrx, -0.68, hrx + 0.02, -0.3])], C.straw, 0.4); fillP(c, HP([-hrx, -0.3, hrx, -0.3, hrx, -0.44, -hrx, -0.44]), col(C.black)); group([HP([-hrx - 0.4, -0.3, hrx + 0.42, -0.31, hrx + 0.38, -0.22, -hrx - 0.36, -0.21])], C.straw, 0.3); }
    else if (hat === 'kepi') { group([HP([-hrx - 0.02, -0.25, -hrx + 0.06, -0.75, hrx + 0.04, -0.72, hrx + 0.04, -0.25])], hcol, 0.5); group([HP([hrx * 0.2, -0.24, hrx + 0.4, -0.16, hrx + 0.3, -0.1, hrx * 0.2, -0.16])], C.black, 0); if (w.badge) { const b = H(hrx * 0.5, -0.5); c.fillStyle = col(C.gold); c.beginPath(); c.arc(b[0], b[1], 0.08, 0, TAU); c.fill(); } }
    else if (hat === 'kerchief') group([chaikin(HP([-hrx - 0.12, 0.25, -hrx - 0.05, -0.35, -0.05, -0.62, hrx * 0.85, -0.4, hrx * 0.7, -0.15, -0.05, -0.2, -hrx * 0.6, 0.35]), true, 1)], hcol, 0.4);
    else if (hat === 'veil') { group([chaikin(HP([-0.1, -0.55, hrx * 0.6, -0.5, hrx * 0.4, -0.2, -hrx * 0.3, 0.2, -hrx - 0.35, 1.6, -hrx - 0.75, 1.5, -hrx - 0.25, -0.2]), true, 1)], C.white, 0.2); const f0 = H(-0.3, -0.5); c.fillStyle = col([235, 225, 190]); c.beginPath(); c.ellipse(f0[0], f0[1], 0.4, 0.09, tilt - 0.2, 0, TAU); c.fill(); }
    else if (hat === 'biretta') group([HP([-hrx * 0.9, -0.3, -hrx * 0.8, -0.72, 0, -0.78, 0, -0.95, 0.12, -0.95, 0.12, -0.78, hrx * 0.8, -0.72, hrx * 0.9, -0.3])], C.black, 0);
    else if (hat === 'chef') group([chaikin(HP([-hrx, -0.3, -hrx - 0.12, -0.85, 0, -1.0, hrx + 0.12, -0.85, hrx, -0.3]), true, 1)], C.white, 0.3);
    if (F.turn) c.restore();
    // shawl over head and shoulders
    if (w.shawl) {
      const R = (x, y) => { const r = rot(x, y, lean); return [sh[0] + r[0], sh[1] + r[1]]; };
      const a = H(-hrx - 0.12, 0.1), b = H(-hrx * 0.7, -0.55), d = H(0.05, -0.66), e = H(hrx * 0.75, -0.42), f = H(hrx * 0.55, 0.0), g = H(hrx * 0.35, 0.5);
      const s1 = R(ws + fwd + 0.1, 0.55), s2 = R(ws * 0.5 + fwd, 1.55), s3 = R(-ws * 0.2, 1.75), s4 = R(-ws - 0.15, 1.2);
      const p = [a[0], a[1], b[0], b[1], d[0], d[1], e[0], e[1], f[0], f[1], g[0], g[1], s1[0], s1[1], s2[0], s2[1], s3[0], s3[1], s4[0], s4[1]];
      group([chaikin(p, true, 1)], w.shawl, 0.8);
    }
    if (!farArmBehind && !F.noFarArm) armDraw(AF, -1);
    if (!F.noNearArm) armDraw(AN, 1);
    // props held in hands
    if (F.props) for (const pr of F.props) PROP[pr.t] && PROP[pr.t](c, F, J, pr, col, OUTC, ow);
    c.restore();
    return J;
  }

  const PROP = {
    candle(c, F, J, pr, col) {
      const A = pr.hand === 'f' ? J.AF : J.AN;
      const x = A.hx + 0.05, y = A.hy;
      rect(c, x - 0.09, y - 1.1, 0.18, 1.3, col(C.white));
      c.fillStyle = css(GOLD, 0.95); c.beginPath(); c.ellipse(x, y - 1.25, 0.08, 0.2, 0, 0, TAU); c.fill();
      c.fillStyle = 'rgba(255,248,220,0.95)'; c.beginPath(); c.ellipse(x, y - 1.22, 0.035, 0.09, 0, 0, TAU); c.fill();
      if (F.lights) { const m = c.getTransform(); F.lights.push({ x: (m.a * x + m.c * (y - 1.25) + m.e) / RSCALE, y: (m.b * x + m.d * (y - 1.25) + m.f) / RSCALE, r: 10 + F.h * 0.06, a: 0.55 }); }
    },
    stick(c, F, J, pr, col) { const A = J.AN; line(c, A.hx, A.hy, A.hx + (pr.dx || 0.6), A.hy + (pr.dy || 2.4), col(pr.col || C.brown), pr.lw || 0.12); },
    hoop(c, F, J, pr, col) { const A = J.AN; const x = A.hx + 1.1, y = -0.95; line(c, A.hx, A.hy, x - 0.3, y - 0.3, col(C.brown), 0.08); c.beginPath(); c.ellipse(x, y, 0.85, 0.95, 0, 0, TAU); c.strokeStyle = col(C.brown); c.lineWidth = 0.1; c.stroke(); },
    food(c, F, J, pr, col) { const A = pr.hand === 'f' ? J.AF : J.AN; c.fillStyle = col(pr.col || C.tan); c.beginPath(); c.ellipse(A.hx + 0.15, A.hy - 0.1, 0.32, 0.14, -0.4, 0, TAU); c.fill(); c.strokeStyle = css(INK, 0.6); c.lineWidth = 0.05; c.stroke(); if (pr.red) { c.fillStyle = css(WARMRED, 0.8); c.fillRect(A.hx, A.hy - 0.16, 0.3, 0.06); } },
    zeppola(c, F, J, pr, col) { const A = pr.hand === 'f' ? J.AF : J.AN; c.beginPath(); c.arc(A.hx + 0.1, A.hy - 0.15, 0.2, 0, TAU); c.fillStyle = col([214, 170, 104]); c.fill(); c.fillStyle = col(C.white); c.beginPath(); c.arc(A.hx + 0.06, A.hy - 0.22, 0.09, 0, TAU); c.fill(); },
    hanky(c, F, J, pr, col) { const A = J.AN; fillP(c, [A.hx, A.hy, A.hx + 0.5, A.hy - 0.5, A.hx + 0.65, A.hy + 0.15, A.hx + 0.15, A.hy + 0.35], col(C.white)); },
    hat(c, F, J, pr, col) { const A = J.AN; c.beginPath(); c.ellipse(A.hx + 0.1, A.hy + 0.1, 0.5, 0.18, 1.2, 0, TAU); c.fillStyle = col(pr.col || C.black); c.fill(); },
    cigar(c, F, J, pr, col) { const A = J.AN; line(c, A.hx + 0.05, A.hy - 0.05, A.hx + 0.45, A.hy - 0.2, col(C.brown), 0.09); c.fillStyle = css(GOLD, 0.9); c.beginPath(); c.arc(A.hx + 0.47, A.hy - 0.21, 0.05, 0, TAU); c.fill(); c.beginPath(); c.moveTo(A.hx + 0.47, A.hy - 0.28); c.bezierCurveTo(A.hx + 0.6, A.hy - 0.7, A.hx + 0.3, A.hy - 0.9, A.hx + 0.5, A.hy - 1.4); c.strokeStyle = 'rgba(230,220,200,0.6)'; c.lineWidth = 0.05; c.stroke(); },
    basket(c, F, J, pr, col) { const A = pr.hand === 'f' ? J.AF : J.AN; const x = A.hx, y = A.hy + 0.55; fillP(c, [x - 0.55, y - 0.4, x + 0.55, y - 0.4, x + 0.42, y + 0.35, x - 0.42, y + 0.35], col(C.tan)); c.beginPath(); c.arc(x, y - 0.4, 0.45, Math.PI, 0); c.strokeStyle = col(C.brown); c.lineWidth = 0.08; c.stroke(); c.beginPath(); for (let i = -2; i <= 2; i++) { c.moveTo(x + i * 0.2, y - 0.4); c.lineTo(x + i * 0.16, y + 0.35); } c.strokeStyle = css(INK, 0.5); c.lineWidth = 0.04; c.stroke(); if (pr.fruit) { for (let i = 0; i < 4; i++) { c.fillStyle = css(ORANGE, 0.95); c.beginPath(); c.arc(x - 0.3 + i * 0.2, y - 0.48, 0.12, 0, TAU); c.fill(); } } },
    headBasket(c, F, J, pr, col) { const x = J.hc[0], y = J.hc[1] - 0.6; fillP(c, [x - 0.8, y - 0.35, x + 0.8, y - 0.35, x + 0.6, y + 0.1, x - 0.6, y + 0.1], col(C.tan)); c.strokeStyle = css(INK, 0.7); c.lineWidth = 0.06; c.stroke(); for (let i = 0; i < 6; i++) { c.fillStyle = css(pr.fruit || [120, 132, 70], 0.95); c.beginPath(); c.arc(x - 0.55 + i * 0.22, y - 0.42, 0.13, 0, TAU); c.fill(); } },
    medal(c, F, J, pr, col) { const A = J.AN; c.fillStyle = css(GOLD); c.beginPath(); c.arc(A.hx + 0.15, A.hy - 0.15, 0.1, 0, TAU); c.fill(); },
    baton(c, F, J, pr, col) { const A = J.AN; line(c, A.hx, A.hy, A.hx + 0.9, A.hy - 0.9, col(C.white), 0.06); },
    trumpet(c, F, J, pr, col) { const m = J.hc; const x0 = m[0] + 0.45, y0 = m[1] + 0.25; fillP(c, [x0, y0 - 0.05, x0 + 1.4, y0 + 0.02, x0 + 1.8, y0 - 0.3, x0 + 1.85, y0 + 0.42, x0 + 1.4, y0 + 0.12, x0, y0 + 0.07], css(GOLD)); c.strokeStyle = css(INK, 0.6); c.lineWidth = 0.04; c.stroke(); },
    trombone(c, F, J, pr, col) { const m = J.hc; const x0 = m[0] + 0.45, y0 = m[1] + 0.25; c.strokeStyle = css(GOLD); c.lineWidth = 0.09; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x0 + 2.6, y0 + 0.05); c.moveTo(x0 + 0.3, y0 + 0.28); c.lineTo(x0 + 2.4, y0 + 0.33); c.stroke(); fillP(c, [x0 + 0.2, y0 - 0.02, x0 - 0.4, y0 - 0.45, x0 - 0.4, y0 + 0.55], css(GOLD)); },
    clarinet(c, F, J, pr, col) { const m = J.hc; line(c, m[0] + 0.35, m[1] + 0.3, m[0] + 0.9, m[1] + 1.9, col(C.black), 0.14); },
    tuba(c, F, J, pr, col) { const s = J.sh; c.beginPath(); c.ellipse(s[0] + 0.2, s[1] + 0.9, 0.85, 1.0, 0.2, 0, TAU); c.fillStyle = css(GOLD); c.fill(); c.strokeStyle = css(INK, 0.7); c.lineWidth = 0.06; c.stroke(); c.beginPath(); c.ellipse(s[0] - 0.3, s[1] - 0.55, 0.85, 0.42, -0.5, 0, TAU); c.fillStyle = css(mix(GOLD, [255, 240, 200], 0.3)); c.fill(); c.stroke(); c.beginPath(); c.ellipse(s[0] - 0.3, s[1] - 0.55, 0.6, 0.26, -0.5, 0, TAU); c.fillStyle = css(mix(GOLD, INK, 0.45)); c.fill(); },
    bassdrum(c, F, J, pr, col) { const s = J.hip; c.beginPath(); c.ellipse(s[0] + 0.85, s[1] - 0.6, 0.35, 1.2, 0, 0, TAU); c.fillStyle = col(C.cream); c.fill(); c.strokeStyle = css(INK, 0.8); c.lineWidth = 0.07; c.stroke(); c.beginPath(); c.ellipse(s[0] + 0.6, s[1] - 0.6, 0.35, 1.2, 0, -Math.PI / 2, Math.PI / 2); c.strokeStyle = css(WARMRED, 0.9); c.lineWidth = 0.18; c.stroke(); },
    snare(c, F, J, pr, col) { const s = J.hip; rect(c, s[0] + 0.2, s[1] - 0.5, 1.1, 0.6, col(C.cream), css(INK, 0.8), 0.06); c.strokeStyle = css(WARMRED, 0.8); c.lineWidth = 0.06; c.beginPath(); for (let i = 0; i < 4; i++) { c.moveTo(s[0] + 0.2 + i * 0.3, s[1] - 0.5); c.lineTo(s[0] + 0.35 + i * 0.3, s[1] + 0.1); } c.stroke(); },
    accordion(c, F, J, pr, col) { const a = J.AN, b = J.AF; const x0 = Math.min(a.hx, b.hx) + 0.1, x1 = Math.max(a.hx, b.hx) - 0.1, y = (a.hy + b.hy) / 2; fillP(c, [x0, y - 0.65, x1, y - 0.75, x1, y + 0.6, x0, y + 0.55], col(C.black)); c.beginPath(); for (let i = 1; i < 6; i++) { const x = lerp(x0, x1, i / 6); c.moveTo(x, y - 0.65); c.lineTo(x, y + 0.55); } c.strokeStyle = css(WARMRED, 0.85); c.lineWidth = 0.07; c.stroke(); rect(c, x1 - 0.1, y - 0.75, 0.3, 1.35, col(C.white)); },
    tambourine(c, F, J, pr, col) { const A = J.AN; c.beginPath(); c.ellipse(A.hx + 0.1, A.hy - 0.3, 0.5, 0.5, 0, 0, TAU); c.fillStyle = col(C.cream); c.fill(); c.strokeStyle = css(INK, 0.8); c.lineWidth = 0.08; c.stroke(); for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; c.fillStyle = css(GOLD); c.beginPath(); c.arc(A.hx + 0.1 + Math.cos(a) * 0.5, A.hy - 0.3 + Math.sin(a) * 0.5, 0.07, 0, TAU); c.fill(); } },
    cross(c, F, J, pr, col) { const A = J.AN; const x = A.hx, top = -11.5; line(c, x, A.hy + 1.2, x, top, col(C.brown), 0.12); fillP(c, [x - 0.06, top - 1.2, x + 0.06, top - 1.2, x + 0.06, top + 0.3, x - 0.06, top + 0.3], css(GOLD)); fillP(c, [x - 0.45, top - 0.75, x + 0.45, top - 0.75, x + 0.45, top - 0.62, x - 0.45, top - 0.62], css(GOLD)); if (F.lights) { const m = c.getTransform(); F.lights.push({ x: (m.a * x + m.c * (top - 0.7) + m.e) / RSCALE, y: (m.b * x + m.d * (top - 0.7) + m.f) / RSCALE, r: 14, a: 0.4 }); } },
    censer(c, F, J, pr, col) { const A = J.AN; const x = A.hx + 0.3, y = A.hy + 1.6; line(c, A.hx, A.hy, x, y - 0.25, col(C.gold), 0.04); c.beginPath(); c.arc(x, y, 0.25, 0, TAU); c.fillStyle = css(GOLD); c.fill(); c.beginPath(); c.moveTo(x, y - 0.3); c.bezierCurveTo(x + 0.6, y - 1.2, x - 0.5, y - 2.0, x + 0.3, y - 3.4); c.strokeStyle = 'rgba(240,232,214,0.55)'; c.lineWidth = 0.22; c.stroke(); },
    tray(c, F, J, pr, col) { const s = J.hip; const x0 = s[0] + 0.1, y0 = s[1] - 1.2; fillP(c, [x0, y0, x0 + 1.9, y0 - 0.1, x0 + 1.95, y0 + 0.35, x0 + 0.05, y0 + 0.4], col(C.brown)); for (let i = 0; i < 9; i++) { c.fillStyle = css(i % 3 ? GOLD : C.white); c.beginPath(); c.arc(x0 + 0.2 + i * 0.2, y0 + 0.08 + (i % 2) * 0.12, 0.07, 0, TAU); c.fill(); } line(c, x0 + 0.1, y0, J.nk[0], J.nk[1], col(C.brown), 0.05); },
    sack(c, F, J, pr, col) { const s = J.sh, x = s[0] - 0.25, y = s[1] - 0.25; const q = chaikin([x - 0.75, y + 0.2, x - 0.6, y - 0.45, x + 0.05, y - 0.62, x + 0.62, y - 0.38, x + 0.55, y + 0.18, x - 0.05, y + 0.32], true, 2); c.beginPath(); addP(c, q); c.fillStyle = col([176, 150, 112]); c.fill(); c.strokeStyle = css(INK, 0.85); c.lineWidth = 0.07; c.stroke(); c.save(); c.clip(); c.beginPath(); for (let k = -1; k < 1.2; k += 0.16) { c.moveTo(x + k, y - 0.8); c.lineTo(x + k + 0.5, y + 0.5); } c.strokeStyle = css(INK, 0.45); c.lineWidth = 0.035; c.stroke(); c.restore(); line(c, x - 0.1, y - 0.6, x + 0.1, y - 0.75, css(INK, 0.8), 0.06); },
    nightstick(c, F, J, pr, col) { const A = J.AN; line(c, A.hx, A.hy, A.hx + 0.2, A.hy + 1.6, col(C.brown), 0.14); },
    child(c, F, J, pr, col) {
      // a small child carried on the arm / hip
      const A = J.AN; const ch = { x: A.hx - 0.25, y: A.hy + 0.15, h: 2.9, pxs: J.u, dir: pr.dir || 1, fr: 0.5, sex: 'm', age: 't', pose: POSE.sit, w: { top: 'shirt', tc: pr.col || C.white, bc: C.light, hair: C.dark }, haze: F.haze, noShadow: 1, lx: F.lx * F.dir };
      drawFigLocal(c, ch);
    },
    shoulders(c, F, J, pr, col) {
      const s = J.sh; const ch = { x: s[0] - 0.1, y: s[1] + 0.5, h: 3.3, pxs: J.u, dir: 1, fr: 0.6, sex: pr.sex || 'm', age: 't', pose: { drop: 1.0, nl: { to: [0.8, 0.4], bend: 1 }, fl: { to: [0.5, 0.6], bend: 1 }, na: [2.6, 3.0], fa: [0.6, 1.0] }, back: F.back, w: { top: 'shirt', tc: pr.col || C.white, bc: C.mid, hair: C.dark, hat: F.back ? 'cap' : null, hc: C.mid }, haze: F.haze, noShadow: 1, lx: F.lx * F.dir };
      drawFigLocal(c, ch);
    },
  };
  // draw a figure inside an already-transformed local frame (units are the parent's head units)
  function drawFigLocal(c, F) { drawFig(c, F); }

  /* ================================================================ wardrobe */
  function dress(rng, sex, age, x) {
    const darkish = [C.dark, C.black, C.brown, C.mid, C.slate, C.navy, C.olive];
    if (age === 'a' && sex === 'm') {
      const r = rng.r();
      const hat = rng.p(['cap', 'cap', 'fedora', 'fedora', 'bowler', 'boater', 'boater', 'cap', null]);
      if (r < 0.55) return { top: 'jacket', tc: rng.p(darkish), bc: rng.p([C.dark, C.mid, C.black, C.brown]), hat, hc: rng.p([C.black, C.dark, C.mid, C.slate]), must: rng.c(0.45), shirt: rng.p([C.white, C.cream]) };
      if (r < 0.85) return { top: 'shirt', tc: rng.p([C.white, C.cream, C.cream, C.light]), vest: rng.c(0.6) ? rng.p([C.dark, C.black, C.brown]) : null, braces: rng.c(0.5), bc: rng.p([C.dark, C.mid, C.brown]), hat, hc: rng.p([C.black, C.dark]), must: rng.c(0.5) };
      return { top: 'shirt', tc: C.white, bc: C.dark, apron: true, hat: rng.p(['cap', null]), must: rng.c(0.6), hc: C.dark };
    }
    if (age === 'a') {
      const r = rng.r();
      if (r < 0.35) return { top: 'blouse', tc: rng.p([C.white, C.cream, C.light]), bc: rng.p([C.black, C.dark, C.brown, C.navy]), sk: rng.p(['ankle', 'calf']), apron: rng.c(0.35) ? rng.p([true, C.cream]) : null, hair: rng.p([C.black, C.dark, C.brown]) };
      if (r < 0.6) return { top: 'dress', tc: rng.p([C.mid, C.brown, C.navy, C.slate, C.rust, C.olive]), bc: null, sk: 'calf', hair: rng.p([C.black, C.dark]), hat: rng.c(0.3) ? 'kerchief' : null, hc: rng.p([C.red, C.cream, C.white]) };
      if (r < 0.85) return { top: 'blouse', tc: C.black, bc: C.black, sk: 'ankle', shawl: rng.p([C.black, C.black, C.dark]), hair: C.black };
      return { top: 'blouse', tc: rng.p([C.white, C.cream]), bc: rng.p([C.dark, C.mid]), sk: 'calf', hat: 'kerchief', hc: rng.p([C.red, C.white, C.light]), apron: rng.c(0.5) ? C.white : null };
    }
    if (sex === 'm') return { top: rng.c(0.6) ? 'shirt' : 'jacket', tc: rng.p([C.white, C.cream, C.mid, C.dark]), bc: rng.p([C.dark, C.mid, C.brown]), stock: C.dark, hat: rng.p(['cap', null, null]), hc: C.dark, jl: 0.4, knick: 1 };
    return { top: 'dress', tc: rng.p([C.white, C.cream, C.light, C.rust, C.mid]), bc: null, sk: 'knee', hair: rng.p([C.black, C.dark, C.brown]), hat: rng.c(0.2) ? 'kerchief' : null, hc: C.white };
  }

  /* ================================================================ the scene */
  function buildScene(seed) {
    SEED = seed >>> 0;
    const L = { sky: [], roofB: [], fac: [], fe: [], roofF: [], street: [], crowd: [], top: [], glow: [], fin: [] };
    const LIGHTS = [];
    L.sky.push(() => { LIGHTS.length = 0; });              // {x,y,r,a,col} soft glows added at the end
    let K = 0;
    const crowdOp = (y, fn) => L.crowd.push({ y, k: K++, fn });

    /* ---------- sky ---------- */
    const CLOUDS = [[420, 150, 330, 15], [1250, 92, 400, 13], [1880, 182, 260, 11], [3640, 140, 430, 15], [4170, 214, 230, 10], [960, 46, 320, 10], [2280, 58, 250, 9], [1620, 210, 180, 8]];
    const sv = SV(1);
    const BURSTS = [
      { x: 2650, y: 128, r: 140 * sv.u(0.94, 1.06), col: GOLD, n: 90 },
      { x: 2830, y: 230, r: 60 * sv.u(0.9, 1.1), col: [236, 210, 150], n: 40 },
      { x: 1760, y: 96, r: 46 * sv.u(0.9, 1.1), col: GOLD, n: 34, willow: 1 },
      { x: 2990, y: 82, r: 96 * sv.u(0.9, 1.1), col: WARMRED, n: 66 },
      { x: 3200, y: 168, r: 78 * sv.u(0.9, 1.1), col: GOLD, n: 52, willow: 1 },
      { x: 2398, y: 198, r: 42 * sv.u(0.9, 1.1), col: WARMRED, n: 32 },
      { x: 3462, y: 62, r: 36 * sv.u(0.9, 1.15), col: GOLD, n: 30 },
    ];
    const MOON = { x: 3982, y: 158, r: 19 };
    const inCres = (x, y) => Math.hypot(x - MOON.x, y - MOON.y) < MOON.r && Math.hypot(x - MOON.x - 8, y - MOON.y + 4) > MOON.r * 0.92;
    function skyTone(x, y) {
      let t = 0.8 * Math.pow(clamp(1 - y / 440, 0, 1), 0.9) * (0.62 + 0.38 * clamp(y / 110, 0, 1));
      t *= 1 - 0.45 * Math.exp(-x / 1000);
      t *= 1 - 0.55 * Math.exp(-((x - 760) * (x - 760)) / 90000 - ((y - 250) * (y - 250)) / 16000);
      t *= 1 - 0.5 * Math.exp(-((x - 3990) * (x - 3990)) / 60000 - ((y - 210) * (y - 210)) / 16000);
      for (const cl of CLOUDS) { const dx = (x - cl[0]) / cl[2], dy = (y - cl[1]) / cl[3], e = dx * dx + dy * dy; if (e < 1) t *= 0.3 + 0.7 * e * e; }
      for (const b of BURSTS) { const d2 = ((x - b.x) * (x - b.x) + (y - b.y) * (y - b.y)) / (b.r * b.r * 2.4); if (d2 < 9) t *= 1 - 0.82 * Math.exp(-d2); }
      const md = Math.hypot(x - MOON.x, y - MOON.y);
      if (md < MOON.r * 5) { t *= 1 - 0.55 * Math.exp(-((md / (MOON.r * 2.2)) ** 2)); if (inCres(x, y)) return 0; }
      return t;
    }
    L.sky.push((c) => {
      const g = c.createLinearGradient(0, 0, 0, 520);
      g.addColorStop(0, '#a9a2a6'); g.addColorStop(0.32, '#c9b3a2'); g.addColorStop(0.66, '#e4c99f'); g.addColorStop(1, '#efd8ac');
      c.fillStyle = g; c.fillRect(0, 0, W, H);
      const r = c.createRadialGradient(-150, 480, 40, -150, 480, 1600);
      r.addColorStop(0, 'rgba(255,212,150,0.6)'); r.addColorStop(1, 'rgba(255,212,150,0)');
      c.fillStyle = r; c.fillRect(0, 0, 1800, 620);
      for (const cl of CLOUDS) { const g2 = c.createRadialGradient(cl[0], cl[1] + cl[3] * 0.3, 0, cl[0], cl[1] + cl[3] * 0.3, cl[2]); g2.addColorStop(0, 'rgba(250,214,176,0.5)'); g2.addColorStop(1, 'rgba(250,214,176,0)'); c.save(); c.translate(cl[0], cl[1]); c.scale(1, cl[3] * 1.6 / cl[2]); c.translate(-cl[0], -cl[1]); c.fillStyle = g2; c.beginPath(); c.arc(cl[0], cl[1], cl[2], 0, TAU); c.fill(); c.restore(); }
    });
    for (let x = 0; x < W; x += 480) {
      L.sky.push((c) => hatch(c, RR(x, 0, 480, 480), { ang: 0, sp: 2.2, lw: 0.46, col: ink(0.42), f: (X, Y) => skyTone(X, Y) * 1.8, step: 6 }));
      L.sky.push((c) => hatch(c, RR(x, 0, 480, 420), { ang: 0, sp: 2.2, off: 1.1, lw: 0.4, col: ink(0.34), f: (X, Y) => (skyTone(X, Y) - 0.4) * 2.4, step: 6, ko: 333 }));
    }
    // cloud undersides: a few ruled contour strokes
    L.sky.push((c) => {
      c.beginPath();
      for (const cl of CLOUDS) {
        for (let k = 0; k < 3; k++) { const yy = cl[1] + cl[3] * (0.55 + k * 0.2), hw = cl[2] * (0.75 - k * 0.2); c.moveTo(cl[0] - hw, yy); c.bezierCurveTo(cl[0] - hw * 0.3, yy + 2, cl[0] + hw * 0.3, yy + 1, cl[0] + hw, yy - 1); }
      }
      c.strokeStyle = ink(0.28); c.lineWidth = 0.6; c.stroke();
    });
    // moon
    L.sky.push((c) => {
      c.save(); c.beginPath(); c.arc(MOON.x, MOON.y, MOON.r, 0, TAU); c.arc(MOON.x + 8, MOON.y - 4, MOON.r * 0.92, 0, TAU, true); c.fillStyle = '#f8efd6'; c.fill('evenodd'); c.restore();
      c.beginPath(); c.arc(MOON.x, MOON.y, MOON.r, Math.PI * 0.42, Math.PI * 1.62); c.strokeStyle = ink(0.35); c.lineWidth = 0.6; c.stroke();
      // the evening star
      c.fillStyle = '#fbf3dc'; c.beginPath(); c.arc(3830, 58, 1.6, 0, TAU); c.fill();
      c.fillStyle = '#fbf3dc'; c.beginPath(); c.arc(640, 70, 1.3, 0, TAU); c.fill();
    });
    // fireworks
    for (const [bi, b] of BURSTS.entries()) {
      L.sky.push((c) => {
        const rng = SV(100 + bi);
        c.save(); c.globalCompositeOperation = 'screen';
        glowDot(c, b.x, b.y, b.r * 1.7, GLOW, 0.5);
        c.restore();
        // rising trail from the roofs
        const tx = b.x + rng.u(-30, 30);
        c.beginPath(); c.moveTo(tx, 330);
        for (let y = 330; y > b.y + b.r * 0.2; y -= 6) c.lineTo(tx + Math.sin(y * 0.09 + bi) * 1.4 + (b.x - tx) * (330 - y) / (330 - b.y), y);
        c.strokeStyle = css(b.col, 0.35); c.lineWidth = 0.7; c.setLineDash([3, 4]); c.stroke(); c.setLineDash([]);
        const tips = [];
        c.beginPath();
        for (let i = 0; i < b.n; i++) {
          const a = (i / b.n) * TAU + rng.u(-0.05, 0.05), rr = b.r * rng.u(0.8, 1.04);
          const droop = b.willow ? 1.0 : 0.2;
          let px = b.x + Math.cos(a) * rr * 0.22, py = b.y + Math.sin(a) * rr * 0.22;
          const seg = 12;
          for (let j = 3; j <= seg; j++) {
            const t = j / seg;
            const x = b.x + Math.cos(a) * rr * t, y = b.y + Math.sin(a) * rr * t + droop * rr * t * t * 0.55;
            if (j % 2 || t > 0.7) { c.moveTo(px, py); c.lineTo(x, y); }
            px = x; py = y;
          }
          tips.push(px, py);
        }
        c.strokeStyle = css(b.col, 0.85); c.lineWidth = 0.75; c.lineCap = 'round'; c.stroke();
        c.fillStyle = css(mix(b.col, [255, 246, 214], 0.55));
        for (let i = 0; i < tips.length; i += 2) { c.beginPath(); c.arc(tips[i], tips[i + 1], 1.5, 0, TAU); c.fill(); }
        // falling sparks
        c.fillStyle = css(b.col, 0.7);
        for (let i = 0; i < b.n * 0.6; i++) { const a = rng.u(0, TAU), rr = b.r * rng.u(0.9, 1.4); c.beginPath(); c.arc(b.x + Math.cos(a) * rr, b.y + Math.sin(a) * rr * 0.8 + rr * 0.35, rng.u(0.5, 1.1), 0, TAU); c.fill(); }
        c.save(); c.globalCompositeOperation = 'screen'; glowDot(c, b.x, b.y, b.r * 0.35, [255, 236, 190], 0.8); c.restore();
      });
    }

    /* ---------- roof furniture (behind the parapets) ---------- */
    function tank(c, x, yb, w, hT) {
      const legH = 30, y1 = yb - legH, y0 = y1 - hT, rx = w / 2;
      c.beginPath();
      for (const fx of [-0.42, -0.14, 0.14, 0.42]) { c.moveTo(x + rx * fx * 2, yb + 10); c.lineTo(x + rx * fx * 1.9, y1); }
      c.moveTo(x - rx * 0.84, y1 + 4); c.lineTo(x + rx * 0.28, yb); c.moveTo(x + rx * 0.84, y1 + 4); c.lineTo(x - rx * 0.28, yb);
      c.moveTo(x - rx * 0.84, y1 + 3); c.lineTo(x + rx * 0.84, y1 + 3);
      c.strokeStyle = ink(0.85); c.lineWidth = 1.5; c.stroke();
      // drum
      c.beginPath(); c.moveTo(x - rx, y0); c.lineTo(x - rx, y1); c.quadraticCurveTo(x, y1 + w * 0.14, x + rx, y1); c.lineTo(x + rx, y0); c.quadraticCurveTo(x, y0 + w * 0.12, x - rx, y0); c.closePath();
      c.fillStyle = css([96, 70, 50]); c.fill();
      c.save(); c.clip();
      const g = c.createLinearGradient(x - rx, 0, x + rx, 0); g.addColorStop(0, 'rgba(255,214,160,0.55)'); g.addColorStop(0.45, 'rgba(255,214,160,0.12)'); g.addColorStop(1, 'rgba(30,18,10,0.35)');
      c.fillStyle = g; c.fillRect(x - rx, y0 - 5, w, hT + 30);
      c.beginPath(); for (let s = -rx + 2.6; s < rx; s += 2.6) { c.moveTo(x + s, y0); c.lineTo(x + s, y1 + 10); }
      c.strokeStyle = ink(0.4); c.lineWidth = 0.45; c.stroke();
      c.beginPath(); for (let k = 0; k < 6; k++) { const yy = lerp(y0 + 6, y1 - 2, k / 5); c.moveTo(x - rx, yy); c.quadraticCurveTo(x, yy + w * 0.13, x + rx, yy); }
      c.strokeStyle = ink(0.8); c.lineWidth = 0.9; c.stroke();
      c.restore();
      c.strokeStyle = ink(0.9); c.lineWidth = 1; c.beginPath(); c.moveTo(x - rx, y0); c.lineTo(x - rx, y1); c.quadraticCurveTo(x, y1 + w * 0.14, x + rx, y1); c.lineTo(x + rx, y0); c.stroke();
      // roof cone
      const ap = y0 - w * 0.42;
      const cone = [x - rx - 4, y0 + 3, x, ap, x + rx + 4, y0 + 3, x, y0 + w * 0.1];
      fillP(c, cone, css([84, 62, 46]));
      c.save(); c.beginPath(); addP(c, cone); c.clip();
      c.beginPath(); for (let k = 0; k < 9; k++) { const yy = lerp(ap, y0 + 4, k / 8); const hw = (yy - ap) / (y0 - ap) * (rx + 4); c.moveTo(x - hw, yy); c.quadraticCurveTo(x, yy + 2.5, x + hw, yy); }
      c.strokeStyle = ink(0.55); c.lineWidth = 0.5; c.stroke();
      c.fillStyle = 'rgba(255,210,150,0.28)'; c.fillRect(x - rx - 4, ap, rx * 0.8, y0 - ap + 4);
      c.restore();
      strokeL(c, [x - rx - 4, y0 + 3, x, ap, x + rx + 4, y0 + 3], ink(0.9), 1);
      line(c, x, ap, x, ap - 7, ink(0.9), 1.2); c.fillStyle = ink(0.9); c.beginPath(); c.arc(x, ap - 8, 1.8, 0, TAU); c.fill();
    }
    function chimney(c, x, yb, w, h, pots) {
      const y0 = yb - h;
      rect(c, x - w / 2, y0, w, h + 10, css([118, 76, 54]));
      c.save(); c.beginPath(); c.rect(x - w / 2, y0, w, h + 10); c.clip();
      c.fillStyle = 'rgba(255,210,150,0.22)'; c.fillRect(x - w / 2, y0, w * 0.4, h + 10);
      c.beginPath(); for (let y = y0 + 3; y < yb + 10; y += 3.2) { c.moveTo(x - w / 2, y); c.lineTo(x + w / 2, y); }
      c.strokeStyle = ink(0.35); c.lineWidth = 0.4; c.stroke();
      hatch(c, RR(x, y0, w / 2, h + 10), { ang: 1.2, sp: 2, lw: 0.4, col: ink(0.35), noclip: 1 });
      c.restore();
      rect(c, x - w / 2 - 2.5, y0 - 4, w + 5, 4.5, css([128, 88, 62]), ink(0.85), 0.8);
      c.strokeStyle = ink(0.85); c.lineWidth = 0.9; c.strokeRect(x - w / 2, y0, w, h + 10);
      for (let i = 0; i < pots; i++) { const px = x - w / 2 + w * (i + 0.5) / pots; fillP(c, [px - 2.6, y0 - 4, px - 2, y0 - 13, px + 2, y0 - 13, px + 2.6, y0 - 4], css([150, 92, 60])); strokeL(c, [px - 2.6, y0 - 4, px - 2, y0 - 13, px + 2, y0 - 13, px + 2.6, y0 - 4], ink(0.8), 0.7); }
    }
    function bulkhead(c, x, yb, w, h, door) {
      const y0 = yb - h;
      const p = [x, yb + 8, x, y0 + 6, x + w, y0, x + w, yb + 8];
      fillP(c, p, css([104, 80, 62]));
      c.save(); c.beginPath(); addP(c, p); c.clip(); hatch(c, RR(x, y0, w, h + 10), { ang: Math.PI / 2, sp: 2.4, lw: 0.4, col: ink(0.3), noclip: 1 }); c.restore();
      strokeL(c, [x - 2, y0 + 7, x + w + 2, y0 - 1], ink(0.9), 1.6);
      strokeL(c, p, ink(0.85), 0.9);
      const dx = x + w * 0.3, dw = w * 0.4;
      if (door === 'ajar') {
        rect(c, dx, y0 + 12, dw, h, css([40, 26, 18]));
        fillP(c, [dx + dw, y0 + 12, dx + dw + dw * 0.55, y0 + 9, dx + dw + dw * 0.55, yb + 8, dx + dw, yb + 8], css([120, 92, 70]));
        strokeL(c, [dx + dw, y0 + 12, dx + dw + dw * 0.55, y0 + 9, dx + dw + dw * 0.55, yb + 8], ink(0.85), 0.8);
        const g = c.createLinearGradient(dx, 0, dx + dw, 0); g.addColorStop(0, 'rgba(240,180,90,0)'); g.addColorStop(1, 'rgba(240,180,90,0.5)');
        c.fillStyle = g; c.fillRect(dx, y0 + 12, dw, h);
      } else { rect(c, dx, y0 + 12, dw, h, css([86, 64, 48]), ink(0.8), 0.7); line(c, dx + dw * 0.8, y0 + 12 + h * 0.5, dx + dw * 0.8, y0 + 14 + h * 0.5, ink(0.9), 1.2); }
    }
    function laundry(c, x0, y0, x1, y1, s, items, rng) {
      const p = sag(x0, y0, x1, y1, s, 24);
      strokeL(c, p, ink(0.75), 0.6);
      const at = (t) => { const i = Math.min(23, Math.floor(t * 24)), f = t * 24 - i; return [lerp(p[2 * i], p[2 * i + 2], f), lerp(p[2 * i + 1], p[2 * i + 3], f)]; };
      for (const it of items) {
        const a = at(it.t), b = at(Math.min(1, it.t + it.w / (x1 - x0)));
        const w = b[0] - a[0], h = it.h, sw = (rng.r() - 0.5) * 3;
        let q;
        if (it.k === 'shirt') q = [a[0], a[1], b[0], b[1], b[0] + 0.15 * w, b[1] + h * 0.45, b[0] - 0.05 * w + sw, b[1] + h * 0.45, b[0] - 0.1 * w + sw, b[1] + h, a[0] + 0.1 * w + sw, a[1] + h, a[0] + 0.05 * w + sw, a[1] + h * 0.45, a[0] - 0.15 * w, a[1] + h * 0.45];
        else if (it.k === 'pants') q = [a[0], a[1], b[0], b[1], b[0] - 0.05 * w + sw, b[1] + h, b[0] - 0.4 * w + sw, b[1] + h, (a[0] + b[0]) / 2 + sw, a[1] + h * 0.3, a[0] + 0.4 * w + sw, a[1] + h, a[0] + 0.05 * w + sw, a[1] + h];
        else if (it.k === 'dress') q = [a[0], a[1], b[0], b[1], b[0] + 0.2 * w + sw, b[1] + h, a[0] - 0.2 * w + sw, a[1] + h];
        else q = [a[0], a[1], b[0], b[1], b[0] + sw, b[1] + h + rng.u(-2, 2), (a[0] + b[0]) / 2 + sw, (a[1] + b[1]) / 2 + h + rng.u(-1, 3), a[0] + sw, a[1] + h];
        fillP(c, q, css(it.col));
        c.save(); c.beginPath(); addP(c, q); c.clip();
        if (it.check) { c.beginPath(); for (let k = a[0] - 40; k < b[0] + 40; k += 4) { c.moveTo(k, a[1] - 5); c.lineTo(k, a[1] + h + 5); } for (let k = Math.min(a[1], b[1]); k < a[1] + h + 5; k += 4) { c.moveTo(a[0] - 5, k); c.lineTo(b[0] + 5, k); } c.strokeStyle = css(WARMRED, 0.5); c.lineWidth = 1.2; c.stroke(); }
        const g = c.createLinearGradient(a[0], 0, b[0], 0); g.addColorStop(0, 'rgba(255,220,160,0.25)'); g.addColorStop(1, 'rgba(40,26,16,0.22)'); c.fillStyle = g; c.fillRect(a[0] - 5, a[1] - 5, w + 10, h + 15);
        c.beginPath(); for (let k = 1; k < 3; k++) { const fx = lerp(a[0], b[0], k / 3) + rng.u(-2, 2); c.moveTo(fx, a[1] + 2); c.lineTo(fx + sw, a[1] + h * rng.u(0.6, 0.95)); } c.strokeStyle = ink(0.3); c.lineWidth = 0.5; c.stroke();
        c.restore();
        strokeL(c, q.concat([q[0], q[1]]), ink(0.6), 0.6);
        c.fillStyle = ink(0.8); c.fillRect(a[0] + 1, a[1] - 1.5, 1.2, 3.5); c.fillRect(b[0] - 2, b[1] - 1.5, 1.2, 3.5);
      }
    }
    function laundryItems(rng, n, span, hMax) {
      const items = []; let t = rng.u(0.02, 0.08);
      for (let i = 0; i < n && t < 0.94; i++) {
        const k = rng.p(['sheet', 'sheet', 'shirt', 'shirt', 'pants', 'dress', 'towel', 'towel']);
        const w = k === 'sheet' ? rng.u(22, 34) : k === 'towel' ? rng.u(8, 13) : rng.u(12, 18);
        const h = k === 'sheet' ? rng.u(0.7, 1) * hMax : k === 'towel' ? rng.u(10, 15) : k === 'pants' ? hMax * 0.75 : hMax * 0.6;
        const col = rng.p([[246, 240, 226], [240, 232, 214], [236, 226, 200], [210, 196, 170], [182, 150, 120], [150, 160, 170], [236, 226, 200]]);
        items.push({ k, t, w, h, col, check: k === 'towel' && rng.c(0.3) });
        t += (w + rng.u(3, 9)) / span;
      }
      return items;
    }
    function pigeon(c, x, y, s, ph, dir) {
      c.save(); c.translate(x, y); c.scale(s * dir, s);
      const up = Math.sin(ph);
      c.beginPath(); c.ellipse(0, 0, 3.2, 1.3, -0.1, 0, TAU); c.moveTo(3, -0.4); c.arc(3.4, -0.6, 1.1, 0, TAU);
      c.moveTo(-0.5, -0.3); c.quadraticCurveTo(-2, -3 * up - 1, -4.5, -6 * up); c.quadraticCurveTo(-1, -2 * up, 1.2, -0.2);
      c.moveTo(0.3, 0.2); c.quadraticCurveTo(1.5, -2.5 * up, 3.5, -5 * up + 0.5); c.quadraticCurveTo(1.6, -1.2 * up, 1.5, 0.2);
      c.moveTo(-3, 0); c.lineTo(-5, -0.6); c.lineTo(-5, 1); c.closePath();
      c.fillStyle = ink(0.82); c.fill(); c.restore();
    }

    /* ---------- buildings ---------- */
    // how much festa light reaches a point of the facades: the arch, the lantern strings, the shop glow, the church door
    function facadeLight(x, y) {
      let v = 0.62 * Math.exp(-((x - 2788) * (x - 2788)) / 170000 - ((y - 600) * (y - 600)) / 70000);
      v += 0.24 * Math.exp(-((y - 735) * (y - 735)) / 5200);
      v += 0.3 * clamp((y - 690) / 70, 0, 1);
      v += 0.35 * Math.exp(-((x - 1630) * (x - 1630)) / 60000 - ((y - 780) * (y - 780)) / 30000);
      return v;
    }
    function wallTone(b, yT) {
      const yB = BASE - b.gf;
      return (x, y) => { const t = clamp((y - yT) / (yB - yT), 0, 1); return 0.36 + b.tone * 0.22 + 0.78 * Math.pow(1 - t, 0.95) - facadeLight(x, y); };
    }
    const STO = (b, tone) => mix([226, 212, 184], [120, 96, 74], (tone || b.tone) * 0.3);
    function wallColor(b) {
      const base = b.mat === 'stucco' ? [226, 210, 178] : b.mat === 'brown' ? [190, 164, 134] : b.mat === 'iron' ? [150, 146, 128] : b.mat === 'stone' ? [210, 192, 160] : [206, 174, 146];
      return mix(base, [120, 90, 66], b.tone * 0.22);
    }
    function drawWindow(c, b, x, y, w, h, o) {
      const x0 = x - w / 2;
      if (o.lit) { const g = c.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, '#f6d27e'); g.addColorStop(1, '#de9a46'); c.fillStyle = g; }
      else c.fillStyle = css(mix([104, 86, 74], [140, 128, 124], o.dim || 0.15));
      c.fillRect(x0, y, w, h);
      if (!o.lit) { const R0 = RR(x0, y, w, h); hatch(c, R0, { ang: 0.8, sp: 1.5, lw: 0.5, col: ink(0.6) }); hatch(c, R0, { ang: -0.8, sp: 1.7, lw: 0.45, col: ink(0.5) }); hatch(c, R0, { ang: 0, sp: 2.4, lw: 0.4, col: ink(0.4), f: (X, Y) => 1 - (Y - y) / h * 0.7 }); }
      else hatch(c, RR(x0, y, w, h), { ang: Math.PI / 2, sp: 2.6, lw: 0.35, col: 'rgba(150,80,30,0.35)' });
      if (o.lit && o.inner) { // a glimpse of the room
        c.fillStyle = 'rgba(120,70,30,0.55)';
        if (o.inner === 1) { c.fillRect(x0 + w * 0.2, y + h * 0.18, w * 0.22, h * 0.16); }
        else if (o.inner === 2) { c.beginPath(); c.arc(x0 + w * 0.65, y + h * 0.3, w * 0.12, 0, TAU); c.fill(); c.fillRect(x0 + w * 0.62, y + h * 0.3, w * 0.06, h * 0.3); }
        else { c.beginPath(); c.ellipse(x0 + w * 0.35, y + h * 0.5, w * 0.12, h * 0.16, 0, 0, TAU); c.fill(); c.fillRect(x0 + w * 0.22, y + h * 0.6, w * 0.26, h * 0.4); }
      }
      if (o.shade > 0.05) { const sh = o.shade * h * 0.5; c.fillStyle = o.lit ? '#f5e0a6' : css(mix([212, 194, 158], [70, 52, 40], b.tone * 0.4)); c.fillRect(x0 + 1, y + 1, w - 2, sh); line(c, x0 + 1, y + sh + 1, x0 + w - 1, y + sh + 1, ink(0.6), 0.8); c.strokeStyle = ink(0.6); c.lineWidth = 0.5; c.beginPath(); c.arc(x, y + sh + 3, 1.2, 0, TAU); c.stroke(); }
      if (o.curt) { c.fillStyle = o.lit ? 'rgba(255,244,214,0.75)' : 'rgba(226,214,190,0.55)'; c.beginPath(); c.moveTo(x0 + 1, y + 1); c.lineTo(x0 + w * 0.32, y + 1); c.quadraticCurveTo(x0 + w * 0.12, y + h * 0.45, x0 + w * 0.2, y + h * 0.62); c.lineTo(x0 + 1, y + h * 0.62); c.fill(); c.beginPath(); c.moveTo(x0 + w - 1, y + 1); c.lineTo(x0 + w * 0.68, y + 1); c.quadraticCurveTo(x0 + w * 0.88, y + h * 0.45, x0 + w * 0.8, y + h * 0.62); c.lineTo(x0 + w - 1, y + h * 0.62); c.fill(); }
      // reveal shadow: the depth of the wall, in close cross-hatching
      hatch(c, RR(x0, y, w, 4), { ang: 0.6, sp: 1.1, lw: 0.5, col: ink(0.75) }); hatch(c, RR(x0, y, 3, h), { ang: -0.6, sp: 1.1, lw: 0.5, col: ink(0.75) }); hatch(c, RR(x0, y, w, 4), { ang: -0.6, sp: 1.3, lw: 0.45, col: ink(0.6) });
      // sashes
      c.strokeStyle = ink(0.85); c.lineWidth = 0.9; c.strokeRect(x0 + 0.5, y + 0.5, w - 1, h - 1);
      c.beginPath(); c.moveTo(x0, y + h * 0.5); c.lineTo(x0 + w, y + h * 0.5); c.lineWidth = 1.5; c.stroke();
      c.beginPath(); c.moveTo(x, y); c.lineTo(x, y + h); c.lineWidth = 0.6; c.stroke();
      c.beginPath(); c.moveTo(x0 + 2.5, y + 2.5); c.lineTo(x0 + w - 2.5, y + 2.5); c.lineTo(x0 + w - 2.5, y + h - 2.5); c.lineTo(x0 + 2.5, y + h - 2.5); c.closePath(); c.lineWidth = 0.4; c.stroke();
      if (o.lit) { c.strokeStyle = 'rgba(255,250,230,0.35)'; c.lineWidth = 0.6; c.beginPath(); c.moveTo(x0 + w * 0.6, y + 4); c.lineTo(x0 + w * 0.4, y + h * 0.45); c.stroke(); }
      // sill
      const st = STO(b);
      rect(c, x0 - 4, y + h, w + 8, 4, css(st), ink(0.8), 0.6);
      stipple(c, x0 - 3, y + h + 4, w + 6, 4.5, (X, Y) => 1.1 - (Y - y - h - 4) / 4.5, { sp: 1.25, r: 0.45, col: ink(0.75) });
      if (o.lint) stipple(c, x0 - 4, y - 0.5, w + 8, 4, (X, Y) => 0.9 - (Y - y) / 4, { sp: 1.3, r: 0.4, col: ink(0.6) });
      // lintel
      const L = o.lint;
      if (L === 'flat') { fillP(c, [x0 - 5, y - 9, x0 + w + 5, y - 9, x0 + w + 5, y, x0 - 5, y], css(st)); fillP(c, [x - 4, y - 11, x + 4, y - 11, x + 3, y, x - 3, y], css(mix(st, [255, 240, 210], 0.2))); strokeL(c, [x0 - 5, y, x0 - 5, y - 9, x0 + w + 5, y - 9, x0 + w + 5, y], ink(0.8), 0.6); strokeL(c, [x - 3, y, x - 4, y - 11, x + 4, y - 11, x + 3, y], ink(0.8), 0.6); }
      else if (L === 'seg') { c.beginPath(); c.arc(x, y + w * 0.9, w * 0.5 / Math.sin(0.6) * 1.0, -Math.PI / 2 - 0.62, -Math.PI / 2 + 0.62); c.lineWidth = 7; c.strokeStyle = css(mix(wallColor(b), [255, 220, 180], 0.12)); c.stroke(); const R0 = w * 0.5 / Math.sin(0.6); c.beginPath(); for (let a = -0.6; a <= 0.6; a += 0.12) { const ca = -Math.PI / 2 + a; c.moveTo(x + Math.cos(ca) * (R0 - 3.5), y + w * 0.9 + Math.sin(ca) * (R0 - 3.5)); c.lineTo(x + Math.cos(ca) * (R0 + 3.5), y + w * 0.9 + Math.sin(ca) * (R0 + 3.5)); } c.lineWidth = 0.5; c.strokeStyle = ink(0.5); c.stroke(); c.beginPath(); c.arc(x, y + w * 0.9, R0 + 3.5, -Math.PI / 2 - 0.62, -Math.PI / 2 + 0.62); c.lineWidth = 0.6; c.strokeStyle = ink(0.7); c.stroke(); }
      else if (L === 'ped') { fillP(c, [x0 - 7, y - 5, x0 + w + 7, y - 5, x0 + w + 7, y, x0 - 7, y], css(st)); const tri = [x0 - 6, y - 5, x, y - 17, x0 + w + 6, y - 5]; fillP(c, tri, css(st)); strokeL(c, [x0 - 7, y, x0 - 7, y - 5, x0 + w + 7, y - 5, x0 + w + 7, y], ink(0.8), 0.6); strokeL(c, tri, ink(0.8), 0.7); strokeL(c, [x0 - 2, y - 6.5, x, y - 14, x0 + w + 2, y - 6.5], ink(0.4), 0.4); c.fillStyle = 'rgba(30,18,12,0.35)'; c.fillRect(x0 - 6, y, w + 12, 2); }
      else if (L === 'iron') {
        c.beginPath(); c.moveTo(x0, y + 1); c.arc(x, y + 1, w / 2, Math.PI, 0); c.closePath();
        c.fillStyle = o.lit ? '#f3cc7a' : css([104, 86, 74]); c.fill();
        if (!o.lit) { c.save(); c.clip(); hatch(c, RR(x0, y - w / 2, w, w / 2 + 2), { ang: 0.8, sp: 1.5, lw: 0.5, col: ink(0.6), noclip: 1 }); hatch(c, RR(x0, y - w / 2, w, w / 2 + 2), { ang: -0.8, sp: 1.7, lw: 0.45, col: ink(0.5), noclip: 1 }); c.restore(); }
        c.beginPath(); c.arc(x, y + 1, w / 2, Math.PI, 0); c.strokeStyle = ink(0.85); c.lineWidth = 0.9; c.stroke();
        c.beginPath(); c.arc(x, y + 1, w / 2 + 4, Math.PI, 0); c.lineWidth = 3.2; c.strokeStyle = css(st); c.stroke();
        c.lineWidth = 0.6; c.strokeStyle = ink(0.7); c.beginPath(); c.arc(x, y + 1, w / 2 + 5.8, Math.PI, 0); c.stroke();
        c.beginPath(); for (let a = 0.2; a < Math.PI; a += 0.5) { c.moveTo(x - Math.cos(a) * w / 2, y + 1 - Math.sin(a) * w / 2); c.lineTo(x, y + 1); } c.lineWidth = 0.5; c.stroke();
        fillP(c, [x - 3, y - w / 2 - 6, x + 3, y - w / 2 - 6, x + 2, y - w / 2 + 2, x - 2, y - w / 2 + 2], css(mix(st, [255, 246, 226], 0.2)));
      }
      else if (L === 'hood') { fillP(c, [x0 - 8, y - 4, x0 + w + 8, y - 4, x0 + w + 6, y - 12, x0 - 6, y - 12], css(st)); strokeL(c, [x0 - 8, y - 4, x0 + w + 8, y - 4, x0 + w + 6, y - 12, x0 - 6, y - 12, x0 - 8, y - 4], ink(0.8), 0.6); for (const bx of [x0 - 6, x0 + w + 2]) { fillP(c, [bx, y - 4, bx + 4, y - 4, bx + 3, y + 6, bx + 1, y + 6], css(st)); strokeL(c, [bx, y - 4, bx + 1, y + 6, bx + 3, y + 6, bx + 4, y - 4], ink(0.7), 0.5); } c.fillStyle = 'rgba(30,18,12,0.32)'; c.fillRect(x0 - 2, y - 4, w + 4, 3); }
      if (o.plant) { const px = x0 + w * o.plant; rect(c, px - 3, y + h - 6, 6, 6, css([150, 90, 58]), ink(0.7), 0.5); c.fillStyle = css([88, 96, 60]); c.beginPath(); c.arc(px, y + h - 9, 4.5, 0, TAU); c.arc(px - 3, y + h - 7, 3, 0, TAU); c.arc(px + 3, y + h - 8, 3, 0, TAU); c.fill(); }
      if (o.flag) {
        const fy = y + 3, fx = x0 + w * 0.1;
        line(c, x0 + w * 0.5, y + h * 0.15, x0 + w * 0.5 + (o.flag > 0 ? 22 : -22), y + h * 0.15 - 14, ink(0.8), 0.8);
        if (o.flagType === 'it') { const bw = w * 0.3; [[110, 132, 92], [242, 236, 220], [176, 70, 52]].forEach((cc, i) => { fillP(c, [fx + i * bw, fy, fx + (i + 1) * bw, fy, fx + (i + 1) * bw + 1, fy + h * 0.55, fx + i * bw + 1, fy + h * 0.55], css(cc, 0.95)); }); }
        else { fillP(c, [fx, fy, fx + w * 0.9, fy, fx + w * 0.9, fy + h * 0.5, fx, fy + h * 0.5], css([236, 228, 210])); c.beginPath(); for (let k = 0; k < 6; k++) { c.moveTo(fx + w * 0.35, fy + k * h * 0.09 + 2); c.lineTo(fx + w * 0.9, fy + k * h * 0.09 + 2); } c.strokeStyle = css(WARMRED, 0.8); c.lineWidth = 1.6; c.stroke(); rect(c, fx, fy, w * 0.33, h * 0.24, css([70, 72, 96])); }
      }
    }
    function cornice(c, b, x0, x1, yT, style) {
      const yW = yT + CORN, tone = b.tone || 0.5;
      if (b.parapet) {
        const py = yT - b.parapet;
        rect(c, x0, py, x1 - x0, b.parapet + 2, css(wallColor(b)));
        c.beginPath(); for (let y = py + 3.3; y < yT; y += 3.3) { c.moveTo(x0, y); c.lineTo(x1, y); } c.strokeStyle = ink(0.3); c.lineWidth = 0.4; c.stroke();
        for (let x = x0 + 20; x < x1 - 20; x += 46) { rect(c, x, py + 3, 26, b.parapet - 5, null, ink(0.5), 0.6); }
        rect(c, x0 - 2, py - 3, x1 - x0 + 4, 3.5, css(STO(b)), ink(0.85), 0.8);
      }
      const cc = mix([186, 168, 142], [70, 54, 40], 0.25 + tone * 0.3);
      // frieze
      rect(c, x0, yW - 15, x1 - x0, 15, css(mix(cc, [40, 28, 20], 0.12)));
      // soffit band (seen from below) and crown
      rect(c, x0 - 3, yT + 9, x1 - x0 + 6, yW - 15 - yT - 9, css(mix(cc, [60, 44, 34], 0.3)));
      { const R0 = RR(x0 - 3, yT + 9, x1 - x0 + 6, yW - 15 - yT - 9); hatch(c, R0, { ang: 0.7, sp: 1.2, lw: 0.5, col: ink(0.7) }); hatch(c, R0, { ang: -0.7, sp: 1.3, lw: 0.5, col: ink(0.65) }); hatch(c, R0, { ang: 0, sp: 1.5, lw: 0.4, col: ink(0.5) }); }
      rect(c, x0 - 4, yT, x1 - x0 + 8, 9, css(cc));
      // crown mouldings
      line(c, x0 - 4, yT + 0.5, x1 + 4, yT + 0.5, ink(0.95), 1.2);
      line(c, x0 - 4, yT + 3.5, x1 + 4, yT + 3.5, ink(0.5), 0.5);
      line(c, x0 - 4, yT + 9, x1 + 4, yT + 9, ink(0.85), 0.9);
      const g = c.createLinearGradient(0, yT, 0, yT + 9); g.addColorStop(0, 'rgba(255,230,190,0.0)'); g.addColorStop(1, 'rgba(40,26,18,0.25)'); c.fillStyle = g; c.fillRect(x0 - 4, yT, x1 - x0 + 8, 9);
      if (style === 'brk' || style === 'arc') {
        const n = Math.max(4, Math.round((x1 - x0) / (style === 'brk' ? 17 : 22)));
        for (let i = 0; i <= n; i++) {
          const bx = lerp(x0 + 6, x1 - 6, i / n);
          if (style === 'brk') { fillP(c, [bx - 3, yT + 9, bx + 3, yT + 9, bx + 2.5, yW - 15, bx - 2.5, yW - 15], css(cc)); strokeL(c, [bx - 3, yT + 9, bx - 2.5, yW - 15, bx + 2.5, yW - 15, bx + 3, yT + 9], ink(0.75), 0.5); }
          else if (i < n) { c.beginPath(); c.arc(bx + (x1 - x0 - 12) / n / 2, yW - 15, (x1 - x0 - 12) / n / 2 - 1, Math.PI, 0); c.strokeStyle = ink(0.6); c.lineWidth = 0.7; c.stroke(); }
        }
      }
      if (style === 'dent' || style === 'arc') { c.beginPath(); for (let x = x0 + 2; x < x1 - 2; x += 4) { c.rect(x, yT + 9.5, 2.2, 2.6); } c.fillStyle = css(cc); c.fill(); }
      // frieze panels
      c.beginPath(); const np = Math.max(2, Math.round((x1 - x0) / 60)); for (let i = 0; i < np; i++) { const a = lerp(x0 + 10, x1 - 10, i / np) + 4, bw = (x1 - x0 - 20) / np - 8; c.rect(a, yW - 12, bw, 8); } c.strokeStyle = ink(0.45); c.lineWidth = 0.5; c.stroke();
      line(c, x0, yW, x1, yW, ink(0.7), 0.8);
      // end consoles
      for (const ex of [x0 + 1, x1 - 9]) { fillP(c, [ex, yT + 9, ex + 8, yT + 9, ex + 7, yW + 6, ex + 4, yW + 9, ex + 1, yW + 6], css(cc)); strokeL(c, [ex, yT + 9, ex + 1, yW + 6, ex + 4, yW + 9, ex + 7, yW + 6, ex + 8, yT + 9], ink(0.8), 0.6); c.beginPath(); c.arc(ex + 4, yW + 1, 2, 0, TAU); c.strokeStyle = ink(0.6); c.lineWidth = 0.5; c.stroke(); }
      // the shadow the cornice throws onto the wall
      { const R0 = RR(x0, yW, x1 - x0, 16); hatch(c, R0, { ang: -0.9, sp: 1.3, lw: 0.5, col: ink(0.6), f: (x, y) => 1.2 - (y - yW) / 16 }); hatch(c, R0, { ang: 0.9, sp: 1.4, lw: 0.45, col: ink(0.55), f: (x, y) => 1 - (y - yW) / 12, ko: 50 }); hatch(c, R0, { ang: 0, sp: 1.6, lw: 0.4, col: ink(0.5), f: (x, y) => 0.8 - (y - yW) / 10, ko: 90 }); }
      // the frieze in light line
      hatch(c, RR(x0, yW - 15, x1 - x0, 15), { ang: Math.PI / 2, sp: 2, lw: 0.4, col: ink(0.35), f: () => 0.6 });
    }

    function storefront(c, b) {
      const st = b.store, y0 = BASE - b.gf, rng = FX(500 + b.x0);
      const tone = b.tone;
      const ironC = css(mix([92, 74, 60], [40, 30, 22], tone * 0.5));
      // storefront cornice
      rect(c, b.x0, y0, b.x1 - b.x0, 7, ironC); line(c, b.x0, y0 + 7, b.x1, y0 + 7, ink(0.9), 1); line(c, b.x0, y0, b.x1, y0, ink(0.9), 1);
      // entrance bay
      const span = b.x1 - b.x0;
      const ex = st.ent === 'L' ? b.x0 + 30 : st.ent === 'R' ? b.x1 - 30 : st.ent === 'C' ? (b.x0 + b.x1) / 2 : null;
      // sign board over the shop part
      let sx0 = b.x0 + 8, sx1 = b.x1 - 8;
      if (ex != null) { if (st.ent === 'L') sx0 = b.x0 + 62; else if (st.ent === 'R') sx1 = b.x1 - 62; }
      if (st.signX) { sx0 = Math.max(sx0, st.signX[0]); sx1 = Math.min(sx1, st.signX[1]); }
      const signY = y0 + 8, signH = 26;
      const dark = rng.c(0.6);
      const boardC = dark ? mix([54, 40, 30], [30, 22, 16], tone * 0.3) : mix([222, 204, 168], [120, 100, 80], tone * 0.25);
      // shop fronts: glass with warm light
      const shops = [];
      if (st.ent === 'C') { shops.push([b.x0 + 10, ex - 34], [ex + 34, b.x1 - 10]); }
      else shops.push([sx0, sx1]);
      for (const [a0, a1] of shops) {
        const gy0 = signY + signH + 4, gy1 = BASE - 22;
        const g = c.createLinearGradient(0, gy0, 0, gy1);
        g.addColorStop(0, '#f4cb76'); g.addColorStop(0.6, '#e3a24e'); g.addColorStop(1, '#c7803c');
        c.fillStyle = g; c.fillRect(a0, gy0, a1 - a0, gy1 - gy0);
        display(c, st.kind, a0, gy0, a1, gy1, rng);
        // mullions and the door
        const dw = 30, dxx = st.ent === 'L' || (st.ent === 'C' && a0 > ex) ? a1 - dw - 6 : a0 + 6;
        c.fillStyle = css(mix([70, 52, 38], [30, 22, 16], tone * 0.4)); c.fillRect(dxx, gy0, dw, BASE - gy0);
        const g2 = c.createLinearGradient(0, gy0, 0, BASE); g2.addColorStop(0, 'rgba(246,206,120,0.85)'); g2.addColorStop(1, 'rgba(200,130,60,0.6)'); c.fillStyle = g2; c.fillRect(dxx + 4, gy0 + 4, dw - 8, (BASE - gy0) * 0.55);
        c.strokeStyle = ink(0.85); c.lineWidth = 0.8; c.strokeRect(dxx, gy0, dw, BASE - gy0); c.strokeRect(dxx + 4, gy0 + 4, dw - 8, (BASE - gy0) * 0.55);
        c.beginPath(); const nm = Math.max(1, Math.round((a1 - a0) / 70)); for (let i = 1; i < nm; i++) { const mx = lerp(a0, a1, i / nm); if (Math.abs(mx - dxx - dw / 2) > dw) { c.moveTo(mx, gy0); c.lineTo(mx, gy1); } } c.lineWidth = 1.6; c.stroke();
        c.beginPath(); c.moveTo(a0, gy0 + 16); c.lineTo(a1, gy0 + 16); c.lineWidth = 0.7; c.stroke();
        // kick panel
        rect(c, a0, gy1, a1 - a0, BASE - gy1, ironC, ink(0.85), 0.8);
        c.beginPath(); for (let x = a0 + 4; x < a1 - 10; x += 22) c.rect(x, gy1 + 5, 16, BASE - gy1 - 9); c.strokeStyle = ink(0.4); c.lineWidth = 0.5; c.stroke();
        c.strokeStyle = ink(0.9); c.lineWidth = 1; c.strokeRect(a0, gy0, a1 - a0, gy1 - gy0);
        // reflections
        c.strokeStyle = 'rgba(255,248,226,0.35)'; c.lineWidth = 1.2; c.beginPath(); for (let k = 0; k < 2; k++) { const rx = lerp(a0, a1, 0.3 + k * 0.4); c.moveTo(rx, gy0 + 20); c.lineTo(rx - 12, gy1 - 6); } c.stroke();
        LIGHTS.push({ x: (a0 + a1) / 2, y: (gy0 + gy1) / 2, r: (a1 - a0) * 0.7, a: 0.22 });
      }
      // sign board
      rect(c, sx0, signY, sx1 - sx0, signH, css(boardC), ink(0.9), 1);
      c.strokeStyle = dark ? 'rgba(220,180,100,0.6)' : ink(0.5); c.lineWidth = 0.6; c.strokeRect(sx0 + 3, signY + 3, sx1 - sx0 - 6, signH - 6);
      const tw = sx1 - sx0 - 16;
      let size = 15; const tw0 = textW(st.sign, size); if (tw0 > tw) size *= tw / tw0;
      text(c, st.sign, (sx0 + sx1) / 2, signY + signH / 2 + 0.5, size, { col: dark ? css([238, 196, 110]) : css([60, 36, 24]), lw: size * 0.16, shadow: dark ? 0.8 : 0.6, shadowCol: dark ? 'rgba(0,0,0,0.6)' : 'rgba(150,110,70,0.5)', jit: 0.03, js: b.x0 });
      // pilasters
      const pil = [b.x0 + 1, b.x1 - 8];
      if (ex != null) pil.push(ex - 30, ex + 22);
      for (const px of pil) { if (px < b.x0 || px > b.x1 - 7) continue; rect(c, px, y0 + 7, 7, b.gf - 7, ironC, ink(0.85), 0.8); line(c, px + 3.5, y0 + 12, px + 3.5, BASE - 6, ink(0.35), 0.5); rect(c, px - 1, y0 + 7, 9, 4, null, ink(0.8), 0.6); }
      // tenement entrance and stoop
      if (ex != null) {
        const dy0 = y0 + 40, dw = 30;
        rect(c, ex - 22, dy0 - 10, 44, BASE - dy0 + 10, css(STO(b)), ink(0.85), 0.8);
        fillP(c, [ex - 26, dy0 - 10, ex + 26, dy0 - 10, ex + 22, dy0 - 18, ex - 22, dy0 - 18], css(STO(b)));
        strokeL(c, [ex - 26, dy0 - 10, ex - 22, dy0 - 18, ex + 22, dy0 - 18, ex + 26, dy0 - 10, ex - 26, dy0 - 10], ink(0.85), 0.8);
        const open = b.fanucci || rng.c(0.4);
        rect(c, ex - dw / 2, dy0, dw, BASE - 27 - dy0, css(open ? [60, 40, 26] : [92, 68, 50]));
        // transom
        const tg = c.createLinearGradient(0, dy0, 0, dy0 + 10); tg.addColorStop(0, '#f2c46e'); tg.addColorStop(1, '#d99848'); c.fillStyle = tg; c.fillRect(ex - dw / 2 + 2, dy0 + 2, dw - 4, 8);
        text(c, String(100 + (b.x0 % 89 | 0)), ex, dy0 + 6.2, 5, { col: ink(0.85), lw: 0.8 });
        if (open) {
          const hg = c.createLinearGradient(0, dy0 + 10, 0, BASE - 27); hg.addColorStop(0, 'rgba(244,190,96,0.9)'); hg.addColorStop(1, 'rgba(160,96,40,0.9)'); c.fillStyle = hg; c.fillRect(ex - dw / 2 + 4, dy0 + 12, dw - 12, BASE - 27 - dy0 - 12);
          // the stair rising inside the hallway
          c.beginPath(); for (let k = 0; k < 6; k++) { c.moveTo(ex - dw / 2 + 6 + k * 3, BASE - 30 - k * 7); c.lineTo(ex - dw / 2 + 9 + k * 3, BASE - 30 - k * 7); c.lineTo(ex - dw / 2 + 9 + k * 3, BASE - 37 - k * 7); } c.strokeStyle = ink(0.55); c.lineWidth = 0.7; c.stroke();
          fillP(c, [ex + dw / 2 - 8, dy0 + 10, ex + dw / 2 + 2, dy0 + 8, ex + dw / 2 + 2, BASE - 27, ex + dw / 2 - 8, BASE - 27], css([100, 72, 50]));
          LIGHTS.push({ x: ex, y: dy0 + 40, r: 40, a: 0.35 });
        } else { c.strokeStyle = ink(0.6); c.lineWidth = 0.6; c.strokeRect(ex - dw / 2 + 4, dy0 + 14, dw / 2 - 6, 30); c.strokeRect(ex + 2, dy0 + 14, dw / 2 - 6, 30); }
        c.strokeStyle = ink(0.9); c.lineWidth = 0.9; c.strokeRect(ex - dw / 2, dy0, dw, BASE - 27 - dy0);
        // stoop: steps projecting toward us (seen from above)
        const steps = 4, top = BASE - 27;
        for (let k = 0; k < steps; k++) {
          const d0 = k * 18, yA = yAt(top + k * 6.75, d0), yB = yAt(top + (k + 1) * 6.75, d0), yC = yAt(top + (k + 1) * 6.75, d0 + 18);
          const wv = 26 * sAt(d0);
          rect(c, ex - wv, yA, wv * 2, yB - yA + 0.5, css(mix(STO(b), [60, 40, 28], 0.35)));
          rect(c, ex - wv, yB, wv * 2, yC - yB + 0.5, css(mix(STO(b), [255, 230, 190], 0.15)));
          line(c, ex - wv, yB, ex + wv, yB, ink(0.7), 0.6);
        }
        // railings
        for (const sd of [-1, 1]) {
          const xa = ex + sd * 25, ya = top - 26, xb = ex + sd * 28, yb = gY(72) - 30;
          line(c, xa, ya, xb, yb, ink(0.9), 1.3);
          c.beginPath(); for (let k = 0; k <= 6; k++) { const t = k / 6; c.moveTo(lerp(xa, xb, t), lerp(ya, yb, t)); c.lineTo(lerp(xa, xb, t), lerp(top, gY(72), t)); } c.strokeStyle = ink(0.75); c.lineWidth = 0.6; c.stroke();
          rect(c, xb - 2, yb - 3, 4, gY(72) - yb + 3, css([50, 36, 26])); c.fillStyle = ink(0.9); c.beginPath(); c.arc(xb, yb - 4, 2.5, 0, TAU); c.fill();
        }
      }
      // awning (seen from above, sloping toward us)
      if (st.awn) {
        const a0 = sx0 - 2, a1 = sx1 + 2, yw = signY + signH + 2, yf = yAt(842, 44);
        const p = [a0, yw, a1, yw, a1 + 2, yf, a0 - 2, yf];
        fillP(c, p, css(st.awn === 1 ? [226, 212, 186] : [214, 194, 160]));
        c.save(); c.beginPath(); addP(c, p); c.clip();
        c.beginPath(); for (let x = a0; x < a1; x += 14) c.rect(x, yw, 7, yf - yw); c.fillStyle = st.awn === 1 ? css(WARMRED, 0.7) : css([96, 110, 84], 0.7); c.fill();
        const g = c.createLinearGradient(0, yw, 0, yf); g.addColorStop(0, 'rgba(30,18,10,0.35)'); g.addColorStop(1, 'rgba(255,220,160,0.15)'); c.fillStyle = g; c.fillRect(a0, yw, a1 - a0, yf - yw);
        c.restore();
        strokeL(c, p.concat([p[0], p[1]]), ink(0.85), 0.8);
        // scalloped valance
        c.beginPath(); c.moveTo(a0 - 2, yf); for (let x = a0 - 2; x < a1 + 2; x += 10) { c.lineTo(x, yf + 8); c.quadraticCurveTo(x + 5, yf + 13, x + 10, yf + 8); } c.lineTo(a1 + 2, yf); c.closePath();
        c.fillStyle = css(st.awn === 1 ? [200, 92, 62] : [120, 128, 96]); c.fill(); c.strokeStyle = ink(0.8); c.lineWidth = 0.6; c.stroke();
        c.fillStyle = 'rgba(30,18,10,0.3)'; c.fillRect(a0, yf + 9, a1 - a0, 10);
      }
      // barber pole
      if (st.pole) {
        const px = b.x0 + 14, py0 = y0 + 46, py1 = y0 + 104;
        rect(c, px - 4, py0, 8, py1 - py0, css([244, 238, 222]));
        c.save(); c.beginPath(); c.rect(px - 4, py0, 8, py1 - py0); c.clip(); c.beginPath(); for (let y = py0 - 10; y < py1 + 10; y += 9) { c.moveTo(px - 5, y); c.lineTo(px + 5, y + 7); c.lineTo(px + 5, y + 10); c.lineTo(px - 5, y + 3); } c.fillStyle = css(WARMRED, 0.85); c.fill(); c.restore();
        c.strokeStyle = ink(0.85); c.lineWidth = 0.8; c.strokeRect(px - 4, py0, 8, py1 - py0); c.fillStyle = ink(0.85); c.beginPath(); c.arc(px, py0 - 3, 4.5, Math.PI, 0); c.fill(); c.fillRect(px - 5, py1, 10, 3);
      }
    }
    function display(c, kind, a0, y0, a1, y1, rng) {
      const w = a1 - a0;
      c.save(); c.beginPath(); c.rect(a0, y0, w, y1 - y0); c.clip();
      const dk = 'rgba(70,36,18,0.8)';
      if (kind === 'salumi') {
        line(c, a0, y0 + 10, a1, y0 + 10, ink(0.7), 0.8);
        for (let x = a0 + 6; x < a1 - 4; x += rng.u(6, 10)) {
          const k = rng.r(), l = rng.u(14, 30);
          line(c, x, y0 + 10, x, y0 + 13, ink(0.6), 0.4);
          if (k < 0.6) { c.fillStyle = dk; c.beginPath(); c.ellipse(x, y0 + 13 + l / 2, 2.4, l / 2, 0, 0, TAU); c.fill(); }
          else { c.fillStyle = 'rgba(214,170,90,0.95)'; c.beginPath(); c.ellipse(x, y0 + 22, 5, 8, 0, 0, TAU); c.fill(); c.strokeStyle = ink(0.5); c.lineWidth = 0.4; c.stroke(); }
        }
        c.fillStyle = 'rgba(214,176,100,0.95)'; for (let x = a0 + 8; x < a1 - 8; x += 16) { c.beginPath(); c.ellipse(x, y1 - 7, 7, 4, 0, 0, TAU); c.fill(); c.strokeStyle = ink(0.5); c.stroke(); }
      } else if (kind === 'latte') {
        for (let x = a0 + 8; x < a1 - 6; x += 12) { rect(c, x - 3.5, y1 - 20, 7, 20, 'rgba(210,206,196,0.95)', ink(0.5), 0.4); c.fillStyle = 'rgba(210,206,196,0.95)'; c.fillRect(x - 2, y1 - 24, 4, 4); }
        for (let x = a0 + 10; x < a1 - 10; x += 7) { c.fillStyle = 'rgba(250,244,230,0.95)'; c.beginPath(); c.ellipse(x, y0 + 30, 2.2, 3, 0, 0, TAU); c.fill(); }
      } else if (kind === 'barber') {
        c.fillStyle = dk; c.fillRect(a0 + w * 0.4, y1 - 30, 18, 4); c.fillRect(a0 + w * 0.4 + 2, y1 - 26, 3, 26); c.fillRect(a0 + w * 0.4 + 14, y1 - 46, 4, 20);
        c.strokeStyle = 'rgba(255,250,236,0.6)'; c.lineWidth = 1; c.strokeRect(a0 + w * 0.15, y0 + 18, 26, 34);
      } else if (kind === 'pane') {
        for (let r = 0; r < 3; r++) for (let x = a0 + 8 + r * 4; x < a1 - 8; x += 13) { c.fillStyle = 'rgba(176,112,52,0.9)'; c.beginPath(); c.ellipse(x, y0 + 22 + r * 20, 5.5, 4, 0, 0, TAU); c.fill(); c.strokeStyle = ink(0.45); c.lineWidth = 0.4; c.stroke(); }
      } else if (kind === 'farmacia') {
        const gx = [a0 + w * 0.22, a0 + w * 0.78], gc = [WARMRED, [96, 132, 104]];
        gx.forEach((x, i) => { c.fillStyle = css(gc[i], 0.85); c.beginPath(); c.arc(x, y0 + 28, 11, 0, TAU); c.fill(); c.fillRect(x - 2, y0 + 38, 4, 12); c.fillStyle = 'rgba(255,250,236,0.6)'; c.beginPath(); c.arc(x - 4, y0 + 24, 3, 0, TAU); c.fill(); });
        c.beginPath(); for (let r = 0; r < 2; r++) { const yy = y1 - 12 - r * 14; c.moveTo(a0, yy); c.lineTo(a1, yy); } c.strokeStyle = ink(0.5); c.lineWidth = 0.6; c.stroke();
        for (let x = a0 + w * 0.35; x < a0 + w * 0.65; x += 6) { rect(c, x, y1 - 22, 4, 10, 'rgba(120,80,50,0.7)'); rect(c, x + 1, y1 - 36, 4, 10, 'rgba(120,80,50,0.6)'); }
      } else if (kind === 'banca') {
        c.strokeStyle = 'rgba(80,50,26,0.6)'; c.lineWidth = 0.8; c.beginPath(); for (let x = a0 + 5; x < a1; x += 6) { c.moveTo(x, y0); c.lineTo(x, y1); } c.stroke();
      } else if (kind === 'caffe') {
        for (let x = a0 + 14; x < a1 - 10; x += 26) { c.fillStyle = 'rgba(120,70,36,0.85)'; c.fillRect(x - 1, y1 - 24, 2, 10); c.fillRect(x - 8, y1 - 25, 16, 2); c.fillStyle = 'rgba(246,230,200,0.95)'; c.beginPath(); c.ellipse(x, y1 - 30, 7, 5, 0, 0, TAU); c.fill(); c.fillStyle = 'rgba(176,70,52,0.8)'; c.beginPath(); c.arc(x, y1 - 35, 1.8, 0, TAU); c.fill(); }
      } else if (kind === 'vini' || kind === 'tratt') {
        for (let r = 0; r < 2; r++) for (let x = a0 + 6; x < a1 - 4; x += 6) { c.fillStyle = r ? 'rgba(80,60,40,0.85)' : 'rgba(70,90,60,0.85)'; c.fillRect(x - 1.6, y0 + 22 + r * 24, 3.2, 14); c.fillRect(x - 0.7, y0 + 18 + r * 24, 1.4, 4); }
        c.fillStyle = 'rgba(150,110,60,0.9)'; c.beginPath(); c.ellipse(a0 + w * 0.8, y1 - 12, 10, 12, 0, 0, TAU); c.fill();
        if (kind === 'tratt') { c.fillStyle = 'rgba(244,236,220,0.9)'; c.fillRect(a0 + 4, y1 - 14, w - 8, 4); }
      } else if (kind === 'grocer') {
        for (let x = a0 + 8; x < a1 - 8; x += 9) rect(c, x - 3, y1 - 14 - (Math.abs(x - (a0 + a1) / 2) < w * 0.3 ? 8 : 0), 6, 8, 'rgba(160,120,70,0.9)', ink(0.4), 0.3);
        for (let x = a0 + 10; x < a1 - 10; x += 18) { c.fillStyle = 'rgba(90,60,30,0.7)'; c.fillRect(x - 1, y0 + 10, 2, 14); c.beginPath(); c.ellipse(x, y0 + 28, 4, 6, 0, 0, TAU); c.fill(); }
      } else if (kind === 'shoes') {
        line(c, a0, y0 + 12, a1, y0 + 12, ink(0.6), 0.6);
        for (let x = a0 + 8; x < a1 - 6; x += 11) { c.fillStyle = dk; c.beginPath(); c.ellipse(x, y0 + 22, 2.5, 7, 0.3, 0, TAU); c.fill(); }
      } else if (kind === 'sarto') {
        c.fillStyle = dk; c.beginPath(); c.ellipse(a0 + w * 0.5, y0 + 30, 8, 12, 0, 0, TAU); c.fill(); c.fillRect(a0 + w * 0.5 - 1, y0 + 40, 2, 20);
      } else if (kind === 'tabacchi') {
        for (let r = 0; r < 3; r++) { line(c, a0, y0 + 20 + r * 16, a1, y0 + 20 + r * 16, ink(0.45), 0.6); for (let x = a0 + 4; x < a1 - 4; x += 5) rect(c, x, y0 + 12 + r * 16, 4, 8, 'rgba(120,80,46,0.75)'); }
      }
      c.restore();
    }

    function fireEscape(c, b, rng, people) {
      const cl = cols(b), ww = cl.ww, A = b.fe[0], Bc = b.fe[1];
      const fx0 = cl.xs[A] - ww / 2 - 16, fx1 = cl.xs[Bc] + ww / 2 + 16;
      const IRON = ink(0.92);
      for (let k = 1; k <= b.fl; k++) {
        const yw = BASE - b.gf - (k - 1) * b.fh - 3;            // platform at the wall
        const yf = yAt(yw, 36);                              // its front edge (we see the underside)
        const rh = 34 * sAt(36);
        // shadow on the wall under the platform and the railing's shadow
        c.fillStyle = 'rgba(28,16,10,0.22)'; c.fillRect(fx0, yw, fx1 - fx0, 14);
        c.beginPath(); for (let x = fx0 + 6; x < fx1; x += 5) { c.moveTo(x + 9, yw - 2); c.lineTo(x + 12, yw - rh + 6); } c.strokeStyle = 'rgba(28,16,10,0.16)'; c.lineWidth = 0.8; c.stroke();
        // people on this platform (behind the railing)
        const ppl = people.filter((p) => p.k === k);
        for (const p of ppl) drawFig(c, Object.assign({}, p, { y: yAt(yw, 18) + (p.dy || 0) }));
        // underside
        fillP(c, [fx0, yw, fx1, yw, fx1 + 1, yf, fx0 - 1, yf], ink(0.55));
        c.beginPath(); for (let j = 1; j < 4; j++) { const yy = lerp(yw, yf, j / 4); c.moveTo(fx0, yy); c.lineTo(fx1, yy); } c.strokeStyle = 'rgba(200,170,130,0.35)'; c.lineWidth = 0.6; c.stroke();
        // brackets
        c.beginPath(); for (const bx of [fx0 + 6, (fx0 + fx1) / 2, fx1 - 6]) { c.moveTo(bx, yw + 10); c.lineTo(bx, yf); } c.strokeStyle = IRON; c.lineWidth = 1; c.stroke();
        // railing
        const top = yf - rh;
        c.beginPath();
        c.moveTo(fx0 - 1, top); c.lineTo(fx1 + 1, top); c.moveTo(fx0 - 1, top + rh * 0.45); c.lineTo(fx1 + 1, top + rh * 0.45); c.moveTo(fx0 - 1, yf); c.lineTo(fx1 + 1, yf);
        c.moveTo(fx0 - 1, top); c.lineTo(fx0 - 1, yf); c.moveTo(fx1 + 1, top); c.lineTo(fx1 + 1, yf);
        c.strokeStyle = IRON; c.lineWidth = 1.2; c.stroke();
        c.beginPath(); for (let x = fx0 + 3; x < fx1; x += 3.6) { c.moveTo(x, top + 1); c.lineTo(x, yf); } c.strokeStyle = ink(0.75); c.lineWidth = 0.55; c.stroke();
        // the railing returns to the wall at both ends
        line(c, fx0 - 1, top, fx0 - 1, top + 3, IRON, 1);
        // things hung over the rail
        const hang = rng.r();
        if (hang < 0.35) { const hx = rng.u(fx0 + 6, fx1 - 40); const q = [hx, top - 1, hx + 34, top - 1, hx + 32, top + rh * 0.8, hx + 2, top + rh * 0.85]; fillP(c, q, css(rng.p([[226, 214, 190], [190, 170, 140], [200, 120, 90], [176, 182, 160]]))); strokeL(c, q.concat([q[0], q[1]]), ink(0.6), 0.6); c.beginPath(); for (let j = 1; j < 4; j++) { c.moveTo(hx + j * 8, top); c.lineTo(hx + j * 8 + 1, top + rh * 0.8); } c.strokeStyle = ink(0.25); c.lineWidth = 0.6; c.stroke(); }
        if (rng.c(0.4)) { const px = rng.u(fx0 + 5, fx1 - 10); rect(c, px, top - 9, 7, 9, css([150, 96, 62]), ink(0.7), 0.5); c.fillStyle = css([92, 100, 62]); c.beginPath(); c.arc(px + 3.5, top - 13, 5.5, 0, TAU); c.arc(px, top - 11, 3.5, 0, TAU); c.fill(); }
        // ladder to the next platform up
        if (k < b.fl) {
          const lft = k % 2 === 1, lx0 = lft ? fx0 + 10 : fx1 - 34, lx1 = lft ? fx1 - 40 : fx0 + 16;
          const ya = yf, yb = yAt(yw - b.fh, 36) - 2;
          const off = 7;
          c.beginPath(); c.moveTo(lx0, ya - 2); c.lineTo(lx1, yb); c.moveTo(lx0 + off * (lft ? 1 : -1) + 6, ya - 2); c.lineTo(lx1 + off * (lft ? 1 : -1) + 6, yb);
          c.strokeStyle = IRON; c.lineWidth = 1.1; c.stroke();
          c.beginPath(); for (let j = 1; j < 12; j++) { const t = j / 12; const x = lerp(lx0, lx1, t), y = lerp(ya - 2, yb, t); c.moveTo(x, y); c.lineTo(x + off * (lft ? 1 : -1) + 6, y); } c.lineWidth = 0.6; c.stroke();
        } else {
          // gooseneck ladder up to the roof
        }
        if (k === 1) {
          // drop ladder hanging above the shop sign
          const lx = fx1 - 18;
          c.beginPath(); c.moveTo(lx, yf); c.lineTo(lx, yf + 46); c.moveTo(lx + 8, yf); c.lineTo(lx + 8, yf + 46); c.strokeStyle = IRON; c.lineWidth = 1; c.stroke();
          c.beginPath(); for (let j = 4; j < 46; j += 6) { c.moveTo(lx, yf + j); c.lineTo(lx + 8, yf + j); } c.lineWidth = 0.6; c.stroke();
        }
      }
    }

    function church(c, b) {
      const x0 = b.x0, x1 = b.x1, cx = (x0 + x1) / 2;
      const stone = [158, 138, 110], sc = css(stone), sd = css(mix(stone, [60, 44, 34], 0.35));
      const top = 300, apex = 196;
      // facade body
      fillP(c, [x0, BASE, x0, top, cx, apex, x1, top, x1, BASE], sc);
      const g = c.createLinearGradient(0, apex, 0, BASE); g.addColorStop(0, 'rgba(40,28,30,0.3)'); g.addColorStop(0.6, 'rgba(40,28,30,0.08)'); g.addColorStop(1, 'rgba(255,200,120,0.25)');
      c.fillStyle = g; c.beginPath(); addP(c, [x0, BASE, x0, top, cx, apex, x1, top, x1, BASE]); c.fill();
      // ashlar coursing
      c.save(); c.beginPath(); addP(c, [x0, BASE, x0, top, cx, apex, x1, top, x1, BASE]); c.clip();
      c.beginPath(); for (let y = top - 100; y < BASE; y += 9) { c.moveTo(x0, y); c.lineTo(x1, y); const r = Math.round(y / 9) % 2; for (let x = x0 + (r ? 10 : 0); x < x1; x += 22) { c.moveTo(x, y); c.lineTo(x, y + 9); } } c.strokeStyle = ink(0.26); c.lineWidth = 0.45; c.stroke();
      hatch(c, RR(x0, apex - 10, x1 - x0, BASE - apex), { ang: Math.PI / 2, sp: 2.1, lw: 0.46, col: ink(0.45), f: (x, y) => 0.85 * Math.pow(clamp(1 - (y - apex) / (BASE - apex - 60), 0, 1), 1.1) + 0.12, step: 5, jit: 0.2, ko: 901, noclip: 1 });
      c.restore();
      // pilasters
      for (const px of [x0 + 6, x0 + 80, x1 - 98, x1 - 24]) { rect(c, px, top + 10, 18, BASE - top - 10, css(mix(stone, [255, 240, 210], 0.12)), ink(0.7), 0.7); hatch(c, RR(px + 12, top + 10, 6, BASE - top - 10), { ang: Math.PI / 2, sp: 1.6, lw: 0.4, col: ink(0.35) }); rect(c, px - 3, top + 4, 24, 8, sc, ink(0.8), 0.7); }
      // entablature and pediment
      rect(c, x0 - 4, top - 4, x1 - x0 + 8, 16, sc, ink(0.85), 0.9);
      hatch(c, RR(x0, top + 12, x1 - x0, 6), { ang: -0.8, sp: 1.8, lw: 0.45, col: ink(0.45) });
      text(c, 'CHIESA DI SAN ROCCO', cx, top + 4, 8.5, { col: ink(0.85), lw: 1.1, track: 2.2 });
      strokeL(c, [x0 - 6, top - 4, cx, apex - 8, x1 + 6, top - 4], ink(0.9), 1.4);
      strokeL(c, [x0 + 14, top - 8, cx, apex + 4, x1 - 14, top - 8], ink(0.6), 0.7);
      // tympanum oculus
      c.beginPath(); c.arc(cx, top - 38, 15, 0, TAU); c.fillStyle = css([70, 50, 40]); c.fill(); c.strokeStyle = ink(0.85); c.lineWidth = 1.5; c.stroke();
      c.beginPath(); for (let a = 0; a < TAU; a += TAU / 8) { c.moveTo(cx, top - 38); c.lineTo(cx + Math.cos(a) * 15, top - 38 + Math.sin(a) * 15); } c.strokeStyle = 'rgba(200,170,120,0.6)'; c.lineWidth = 0.8; c.stroke();
      // cross on the apex
      line(c, cx, apex - 8, cx, apex - 40, ink(0.95), 2.2); line(c, cx - 10, apex - 30, cx + 10, apex - 30, ink(0.95), 2.2);
      // rose window
      const ry = 470;
      c.beginPath(); c.arc(cx, ry, 44, 0, TAU); c.fillStyle = css([150, 98, 58]); c.fill();
      const rg = c.createRadialGradient(cx, ry, 0, cx, ry, 44); rg.addColorStop(0, 'rgba(255,214,130,0.9)'); rg.addColorStop(1, 'rgba(180,90,50,0.6)'); c.fillStyle = rg; c.fill();
      c.beginPath(); for (let a = 0; a < TAU; a += TAU / 16) { c.moveTo(cx + Math.cos(a) * 9, ry + Math.sin(a) * 9); c.lineTo(cx + Math.cos(a) * 42, ry + Math.sin(a) * 42); } c.strokeStyle = ink(0.8); c.lineWidth = 1.2; c.stroke();
      c.beginPath(); for (let a = 0; a < TAU; a += TAU / 16) { c.moveTo(cx + Math.cos(a) * 42, ry + Math.sin(a) * 42); c.arc(cx + Math.cos(a + TAU / 32) * 36, ry + Math.sin(a + TAU / 32) * 36, 6, 0, TAU); } c.lineWidth = 0.8; c.stroke();
      c.beginPath(); c.arc(cx, ry, 9, 0, TAU); c.arc(cx, ry, 44, 0, TAU); c.lineWidth = 2; c.stroke();
      c.beginPath(); c.arc(cx, ry, 50, 0, TAU); c.lineWidth = 5; c.strokeStyle = css(mix(stone, [255, 240, 210], 0.15)); c.stroke(); c.lineWidth = 0.8; c.strokeStyle = ink(0.8); c.beginPath(); c.arc(cx, ry, 52.5, 0, TAU); c.stroke();
      LIGHTS.push({ x: cx, y: ry, r: 70, a: 0.3 });
      // side niches with saints
      for (const nx of [x0 + 45, x1 - 63]) {
        const ny = 560;
        c.beginPath(); c.moveTo(nx - 13, ny + 70); c.lineTo(nx - 13, ny); c.arc(nx, ny, 13, Math.PI, 0); c.lineTo(nx + 13, ny + 70); c.closePath(); c.fillStyle = css(mix(stone, [40, 28, 20], 0.5)); c.fill(); c.strokeStyle = ink(0.8); c.lineWidth = 0.8; c.stroke();
        drawFig(c, { x: nx, y: ny + 68, h: 64, dir: 1, fr: 0.9, sex: 'm', age: 'a', pose: POSE.pray, w: { top: 'robe', tc: mix(stone, [255, 240, 210], 0.2), rc: mix(stone, [255, 240, 210], 0.2), hair: mix(stone, [80, 60, 40], 0.3), skin: mix(stone, [255, 240, 210], 0.25) }, noShadow: 1, lx: -1 });
      }
      // windows high up
      for (const wx of [x0 + 45, x1 - 63]) { const wy = 360; c.beginPath(); c.moveTo(wx - 10, wy + 60); c.lineTo(wx - 10, wy); c.arc(wx, wy, 10, Math.PI, 0); c.lineTo(wx + 10, wy + 60); c.closePath(); c.fillStyle = css([70, 50, 40]); c.fill(); c.strokeStyle = ink(0.85); c.lineWidth = 1; c.stroke(); }
      // the great door, open, candlelit inside
      const dw = 74, dh = 150, dy = BASE - 26 - dh;
      c.beginPath(); c.moveTo(cx - dw / 2 - 14, BASE - 26); c.lineTo(cx - dw / 2 - 14, dy + 10); c.arc(cx, dy + 10, dw / 2 + 14, Math.PI, 0); c.lineTo(cx + dw / 2 + 14, BASE - 26); c.closePath(); c.fillStyle = css(mix(stone, [255, 236, 200], 0.1)); c.fill(); c.strokeStyle = ink(0.85); c.lineWidth = 1; c.stroke();
      c.beginPath(); c.moveTo(cx - dw / 2, BASE - 26); c.lineTo(cx - dw / 2, dy + 10); c.arc(cx, dy + 10, dw / 2, Math.PI, 0); c.lineTo(cx + dw / 2, BASE - 26); c.closePath();
      const ig = c.createRadialGradient(cx, dy + 90, 5, cx, dy + 80, 110); ig.addColorStop(0, '#ffe2a0'); ig.addColorStop(0.4, '#e8a650'); ig.addColorStop(1, '#6a3c1e');
      c.fillStyle = ig; c.fill(); c.strokeStyle = ink(0.9); c.lineWidth = 1.2; c.stroke();
      // nave inside: altar, candles
      c.save(); c.clip();
      rect(c, cx - 16, dy + 92, 32, 16, 'rgba(120,70,30,0.6)');
      for (let i = -3; i <= 3; i++) { rect(c, cx + i * 6 - 0.8, dy + 76, 1.6, 14, 'rgba(250,240,210,0.95)'); c.fillStyle = 'rgba(255,250,220,1)'; c.beginPath(); c.arc(cx + i * 6, dy + 74, 1.3, 0, TAU); c.fill(); }
      c.beginPath(); for (let i = 1; i < 6; i++) { const yy = dy + 100 + i * 8; c.moveTo(cx - dw / 2, yy); c.lineTo(cx + dw / 2, yy); } c.strokeStyle = 'rgba(80,40,20,0.4)'; c.lineWidth = 1.4; c.stroke();
      c.restore();
      // open door leaves
      for (const sd of [-1, 1]) { const ex = cx + sd * dw / 2; fillP(c, [ex, dy + 12, ex + sd * 10, dy + 4, ex + sd * 10, BASE - 24, ex, BASE - 26], css([96, 64, 42])); strokeL(c, [ex, dy + 12, ex + sd * 10, dy + 4, ex + sd * 10, BASE - 24, ex, BASE - 26], ink(0.85), 0.8); }
      LIGHTS.push({ x: cx, y: dy + 90, r: 120, a: 0.5 });
      // steps
      for (let k = 0; k < 4; k++) { const d0 = k * 14, ya = yAt(BASE - 26 + k * 6.5, d0), yb = yAt(BASE - 26 + (k + 1) * 6.5, d0 + 14); rect(c, x0 + 30 - k * 4, ya, x1 - x0 - 60 + k * 8, yb - ya, css(mix(stone, [255, 236, 200], k % 2 ? 0.1 : 0.2))); line(c, x0 + 30 - k * 4, ya, x1 - 30 + k * 4, ya, ink(0.7), 0.7); }
      // festa garlands across the facade
      for (let k = 0; k < 2; k++) { const p = sag(x0 + 10, 640 + k * 40, x1 - 10, 640 + k * 40, 30, 40); strokeL(c, p, ink(0.6), 0.6); along(p, 9).forEach((v, i, arr) => { if (i % 2 === 0) LIGHTS.push({ x: arr[i], y: arr[i + 1], r: 6, a: 0.7, bulb: 1 }); }); }
    }
    function alley(c, b) {
      const x0 = b.x0, x1 = b.x1, vx = (x0 + x1) / 2, sb = DV / (DV + 620);
      const PP = (x, y) => [vx + (x - vx) * sb, HZ + (y - HZ) * sb];
      const iB = BLD.indexOf(b), yTopL = bTop(BLD[iB - 1]), yTopR = bTop(BLD[iB + 1]);
      const bl = PP(x0, yTopL), br = PP(x1, yTopR), fl = PP(x0, BASE), fr2 = PP(x1, BASE);
      // back court: a rear tenement with lamplit windows
      const ry0 = Math.max(bl[1], br[1]) - 10;
      rect(c, bl[0], ry0, br[0] - bl[0], fl[1] - ry0, css([150, 122, 100]));
      hatch(c, RR(bl[0], ry0, br[0] - bl[0], fl[1] - ry0), { ang: 0, sp: 1.9, lw: 0.4, col: ink(0.45) });
      for (let k = 0; k < 7; k++) { const wy = ry0 + 14 + k * 108 * sb; if (wy > fl[1] - 16) break; for (const wx of [bl[0] + 5, br[0] - 11]) { const lit = hf(k * 7 + Math.round(wx)) < 0.55; rect(c, wx, wy, 6, 10, lit ? '#f2c470' : css([70, 56, 48]), ink(0.8), 0.5); if (lit) LIGHTS.push({ x: wx + 3, y: wy + 5, r: 9, a: 0.35 }); } }
      // side walls in steep perspective, deep in shadow
      const lw0 = [x0, yTopL + CORN, bl[0], bl[1] + CORN * sb, fl[0], fl[1], x0, BASE], rw0 = [x1, yTopR + CORN, br[0], br[1] + CORN * sb, fr2[0], fr2[1], x1, BASE];
      for (const q of [lw0, rw0]) {
        fillP(c, q, css([118, 92, 74]));
        c.save(); c.beginPath(); addP(c, q); c.clip(); const bb = RP(q).bb;
        hatch(c, RR(bb[0], bb[1], bb[2] - bb[0], bb[3] - bb[1]), { ang: 0.12 * (q === lw0 ? 1 : -1), sp: 1.5, lw: 0.45, col: ink(0.6), noclip: 1 });
        hatch(c, RR(bb[0], bb[1], bb[2] - bb[0], bb[3] - bb[1]), { ang: Math.PI / 2, sp: 1.8, lw: 0.4, col: ink(0.5), noclip: 1 });
        c.restore(); strokeL(c, q.concat([q[0], q[1]]), ink(0.8), 0.7);
      }
      // the alley floor and a lamp at its end
      fillP(c, [x0, BASE, fl[0], fl[1], fr2[0], fr2[1], x1, BASE], css([214, 190, 150]));
      c.save(); c.globalCompositeOperation = 'screen'; glowDot(c, vx, fl[1] - 30, 46, GLOW, 0.5); c.restore();
      line(c, vx + 6, fl[1], vx + 6, fl[1] - 36, ink(0.85), 1); c.fillStyle = '#ffe6a8'; c.beginPath(); c.arc(vx + 6, fl[1] - 38, 2.2, 0, TAU); c.fill();
      // laundry strung across the gap at every depth
      const rr = SV(7600);
      for (let j = 0; j < 8; j++) {
        const t = j / 8, s2 = lerp(sb, 0.97, t), yw = lerp(360, 700, rr.r());
        const xa = vx + (x0 - vx) * s2, xb = vx + (x1 - vx) * s2, ya = HZ + (yw - HZ) * s2;
        const pts = sag(xa, ya, xb, ya + rr.u(-4, 4), 5 * s2, 10); strokeL(c, pts, ink(0.7), 0.45);
        for (let q = 0; q < 4; q++) { const xx = lerp(xa, xb, 0.1 + q * 0.22), yy = ya + 3 * s2 * Math.sin(q + 1); const w2 = rr.u(4, 8) * s2, h2 = rr.u(6, 13) * s2; fillP(c, [xx, yy, xx + w2, yy, xx + w2 + 0.5, yy + h2, xx + 0.5, yy + h2], css(rr.p([[246, 240, 226], [236, 226, 204], [214, 200, 176]]))); strokeL(c, [xx, yy, xx + 0.5, yy + h2, xx + w2 + 0.5, yy + h2, xx + w2, yy], ink(0.55), 0.35); }
      }
      // an iron gate at the street, one leaf open
      c.beginPath(); for (let x = x0 + 2; x < x0 + 28; x += 3.5) { c.moveTo(x, BASE); c.lineTo(x, BASE - 46); } c.moveTo(x0, BASE - 44); c.lineTo(x0 + 28, BASE - 44); c.moveTo(x0, BASE - 20); c.lineTo(x0 + 28, BASE - 20);
      for (let k = 0; k < 6; k++) { const x = x1 - 2 - k * 2.2; c.moveTo(x, BASE + k * 1.4); c.lineTo(x, BASE - 46 + k * 1.2); } c.moveTo(x1, BASE - 44); c.lineTo(x1 - 13, BASE - 37);
      c.strokeStyle = ink(0.9); c.lineWidth = 0.9; c.stroke();
      c.fillStyle = ink(0.9); for (let x = x0 + 2; x < x0 + 28; x += 3.5) { c.beginPath(); c.moveTo(x - 1.2, BASE - 46); c.lineTo(x, BASE - 50); c.lineTo(x + 1.2, BASE - 46); c.fill(); }
    }
    function tower(c, b) {
      const x0 = b.x0, x1 = b.x1, cx = (x0 + x1) / 2, top = 128;
      const stone = [150, 130, 104], sc = css(stone);
      rect(c, x0, top, x1 - x0, BASE - top, sc);
      const g = c.createLinearGradient(x0, 0, x1, 0); g.addColorStop(0, 'rgba(255,220,170,0.18)'); g.addColorStop(1, 'rgba(30,20,14,0.3)'); c.fillStyle = g; c.fillRect(x0, top, x1 - x0, BASE - top);
      c.beginPath(); for (let y = top + 4; y < BASE; y += 9) { c.moveTo(x0, y); c.lineTo(x1, y); const r = Math.round(y / 9) % 2; for (let x = x0 + (r ? 10 : 0); x < x1; x += 22) { c.moveTo(x, y); c.lineTo(x, y + 9); } } c.strokeStyle = ink(0.22); c.lineWidth = 0.45; c.stroke();
      // belfry
      const by = top + 26;
      c.beginPath(); c.moveTo(cx - 18, by + 64); c.lineTo(cx - 18, by + 16); c.arc(cx, by + 16, 18, Math.PI, 0); c.lineTo(cx + 18, by + 64); c.closePath(); c.fillStyle = css([52, 38, 32]); c.fill(); c.strokeStyle = ink(0.9); c.lineWidth = 1.1; c.stroke();
      c.beginPath(); c.moveTo(cx - 11, by + 46); c.quadraticCurveTo(cx - 10, by + 22, cx, by + 20); c.quadraticCurveTo(cx + 10, by + 22, cx + 11, by + 46); c.closePath(); c.fillStyle = css([186, 140, 70]); c.fill(); c.strokeStyle = ink(0.8); c.lineWidth = 0.8; c.stroke();
      line(c, cx, by + 46, cx, by + 52, ink(0.9), 2);
      rect(c, x0 - 5, top - 6, x1 - x0 + 10, 9, sc, ink(0.9), 1); rect(c, x0 - 3, by + 66, x1 - x0 + 6, 6, sc, ink(0.8), 0.8);
      // pyramidal cap with cross
      fillP(c, [x0 - 4, top - 6, cx, top - 52, x1 + 4, top - 6], css([120, 96, 76]));
      c.save(); c.beginPath(); addP(c, [x0 - 4, top - 6, cx, top - 52, x1 + 4, top - 6]); c.clip(); hatch(c, RR(cx, top - 54, 40, 50), { ang: 1.1, sp: 1.8, lw: 0.5, col: ink(0.5), noclip: 1 }); c.restore();
      strokeL(c, [x0 - 4, top - 6, cx, top - 52, x1 + 4, top - 6], ink(0.9), 1.1);
      line(c, cx, top - 52, cx, top - 78, ink(0.95), 1.8); line(c, cx - 7, top - 70, cx + 7, top - 70, ink(0.95), 1.8);
      // clock
      c.beginPath(); c.arc(cx, 300, 14, 0, TAU); c.fillStyle = css([236, 226, 200]); c.fill(); c.strokeStyle = ink(0.9); c.lineWidth = 1.2; c.stroke();
      line(c, cx, 300, cx - 1, 291, ink(0.9), 1.1); line(c, cx, 300, cx + 6, 302, ink(0.9), 1.1);
      for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; line(c, cx + Math.cos(a) * 11, 300 + Math.sin(a) * 11, cx + Math.cos(a) * 13, 300 + Math.sin(a) * 13, ink(0.8), 0.6); }
      for (const wy of [420, 560, 700]) { c.beginPath(); c.moveTo(cx - 7, wy + 34); c.lineTo(cx - 7, wy); c.arc(cx, wy, 7, Math.PI, 0); c.lineTo(cx + 7, wy + 34); c.closePath(); c.fillStyle = css([60, 44, 36]); c.fill(); c.strokeStyle = ink(0.85); c.lineWidth = 0.8; c.stroke(); }
      hatch(c, RR(x0, top, x1 - x0, BASE - top), { ang: Math.PI / 2, sp: 2.1, lw: 0.46, col: ink(0.45), f: (x, y) => 0.9 * Math.pow(clamp(1 - (y - top) / (BASE - top - 80), 0, 1), 1.1) + 0.15, step: 5, jit: 0.2, ko: 907 });
      line(c, x0, top, x0, BASE, ink(0.8), 0.9); line(c, x1, top, x1, BASE, ink(0.8), 0.9);
    }

    function addBuilding(b, bi) {
      if (b.alley) { L.fac.push((c) => alley(c, b)); return; }
      if (b.church) { L.fac.push((c) => church(c, b)); return; }
      if (b.tower) { L.fac.push((c) => tower(c, b)); return; }
      const yT = bTop(b), rng = FX(1000 + bi), vr = SV(1000 + bi);
      const cl = cols(b);
      L.fac.push((c) => {
        const wc = wallColor(b), yB = BASE - b.gf, top = yT + CORN;
        c.fillStyle = css(wc); c.fillRect(b.x0, yT + 8, b.x1 - b.x0, BASE - yT - 8);
        // the warm festa light as a faint tint on the lower floors
        c.save(); c.globalCompositeOperation = 'multiply';
        const g = c.createLinearGradient(0, yT, 0, yB); g.addColorStop(0, 'rgba(92,76,74,0.95)'); g.addColorStop(0.45, 'rgba(150,128,116,0.8)'); g.addColorStop(0.85, 'rgba(230,210,186,0.4)'); g.addColorStop(1, 'rgba(255,236,200,0)');
        c.fillStyle = g; c.fillRect(b.x0, yT, b.x1 - b.x0, yB - yT);
        c.restore();
        const r2 = FX(2000 + bi), T = wallTone(b, yT);
        if (b.mat === 'iron') {
          // cast iron: a painted front of engaged columns, an entablature at every floor, big arched windows between
          const cl2 = cols(b);
          for (let k = 1; k <= b.fl; k++) {
            const yb = yB - (k - 1) * b.fh, ytop = yb - b.fh;
            rect(c, b.x0, ytop, b.x1 - b.x0, 9, css(mix(wc, [255, 246, 226], 0.15)), ink(0.8), 0.6);
            c.beginPath(); for (let x = b.x0 + 2; x < b.x1 - 2; x += 4) c.rect(x, ytop + 9, 2.2, 2.4); c.fillStyle = css(mix(wc, [90, 70, 52], 0.3)); c.fill();
            for (let i = 0; i <= b.nw; i++) {
              const px = i === 0 ? b.x0 + 9 : i === b.nw ? b.x1 - 9 : (cl2.xs[i - 1] + cl2.xs[i]) / 2;
              rect(c, px - 6, ytop + 12, 12, b.fh - 16, css(mix(wc, [255, 246, 226], 0.1)), ink(0.8), 0.6);
              c.beginPath(); for (let f = -3; f <= 3; f += 2) { c.moveTo(px + f, ytop + 18); c.lineTo(px + f, yb - 8); } c.strokeStyle = ink(0.45); c.lineWidth = 0.45; c.stroke();
              hatch(c, RR(px + 2, ytop + 12, 4, b.fh - 16), { ang: Math.PI / 2, sp: 1.2, lw: 0.4, col: ink(0.5) });
              rect(c, px - 8, ytop + 11, 16, 5, css(mix(wc, [255, 246, 226], 0.2)), ink(0.8), 0.6); rect(c, px - 7.5, yb - 7, 15, 4, css(wc), ink(0.8), 0.6);
              c.beginPath(); c.arc(px - 4, ytop + 16, 2, 0, Math.PI); c.arc(px + 4, ytop + 16, 2, 0, Math.PI); c.strokeStyle = ink(0.6); c.lineWidth = 0.5; c.stroke();
            }
          }
          hatch(c, RR(b.x0, top, b.x1 - b.x0, yB - top), { ang: 0, sp: 2.6, lw: 0.35, col: ink(0.25), f: () => 0.5, ko: bi });
        } else if (b.mat === 'brick' || !b.mat) {
          // brick: every course a row of short strokes broken by mortar joints, half a brick offset each course
          c.beginPath();
          let row = 0;
          for (let y = top + 3.3; y < yB; y += 3.3, row++) {
            const off = (row & 1) * 3.6;
            for (let x = b.x0 - off; x < b.x1; x += 7.2) {
              const k = row * 977 + Math.round(x * 3.1) + bi * 31;
              if (hf(k) < 0.06) continue;
              const xa = Math.max(b.x0, x + 0.5 + hf(k + 1) * 0.4), xb = Math.min(b.x1, x + 6.4 + hf(k + 2) * 0.4);
              if (xb > xa) { c.moveTo(xa, y + (hf(k + 3) - 0.5) * 0.3); c.lineTo(xb, y + (hf(k + 4) - 0.5) * 0.3); }
            }
          }
          c.strokeStyle = ink(0.42); c.lineWidth = 0.5; c.stroke();
          // in places the head joints are drawn too
          c.beginPath(); row = 0;
          for (let y = top + 3.3; y < yB; y += 3.3, row++) {
            const off = (row & 1) * 3.6;
            for (let x = b.x0 - off; x < b.x1; x += 7.2) { const xx = x + 7.0; if (xx > b.x0 && xx < b.x1 && T(xx, y) * 1.1 > hf(row * 313 + Math.round(xx * 5))) { c.moveTo(xx, y); c.lineTo(xx, y + 3.3); } }
          }
          c.strokeStyle = ink(0.35); c.lineWidth = 0.4; c.stroke();
        } else if (b.mat === 'brown') {
          // brownstone ashlar: long courses, staggered joints, a little tooling
          c.beginPath(); let row = 0;
          for (let y = top + 9; y < yB; y += 9, row++) { c.moveTo(b.x0, y); c.lineTo(b.x1, y); for (let x = b.x0 + (row & 1) * 14; x < b.x1; x += 28) { c.moveTo(x, y - 9); c.lineTo(x, y); } }
          c.strokeStyle = ink(0.45); c.lineWidth = 0.55; c.stroke();
          hatch(c, RR(b.x0, top, b.x1 - b.x0, yB - top), { ang: 0, sp: 1.8, lw: 0.35, col: ink(0.25), f: (x, y) => 0.5, ko: bi });
        } else if (b.mat === 'stucco') {
          c.beginPath(); for (let y = top + 18; y < yB; y += 18) { c.moveTo(b.x0, y); c.lineTo(b.x1, y); } c.strokeStyle = ink(0.32); c.lineWidth = 0.5; c.stroke();
          c.beginPath(); for (let i = 0; i < 6; i++) { let x = r2.u(b.x0 + 10, b.x1 - 10), y = r2.u(top, yB - 40); c.moveTo(x, y); for (let j = 0; j < 6; j++) { x += r2.u(-4, 4); y += r2.u(3, 8); c.lineTo(x, y); } } c.strokeStyle = ink(0.35); c.lineWidth = 0.45; c.stroke();
        }
        // dusk: value laid down in hatching, densest under the cornice, lifted where the festa light reaches
        toneHatch(c, RR(b.x0, top, b.x1 - b.x0, yB - top), (x, y) => T(x, y) * (b.mat === 'stucco' ? 0.85 : 1), { sp: 1.9, lw: 0.55, col: ink(0.7), ko: bi * 17 });
        // quoins / party-wall edges
        for (const ex of [b.x0, b.x1]) line(c, ex, yT + CORN, ex, BASE - b.gf, ink(0.7), 0.9);
        if (b.mat === 'brown' || b.mat === 'stucco') {
          for (const [ex, sd] of [[b.x0, 1], [b.x1, -1]]) for (let y = yT + CORN; y < BASE - b.gf - 4; y += 12) { const qw = (Math.round(y / 12) % 2 ? 12 : 8); rect(c, sd > 0 ? ex : ex - qw, y + 1, qw, 10, css(mix(STO(b), [255, 236, 200], 0.08)), ink(0.55), 0.5); }
        }
        // string courses
        for (let k = 1; k <= b.fl; k++) { const y = BASE - b.gf - (k - 1) * b.fh - 18; if (k === 1 || b.mat === 'brown') { rect(c, b.x0, y + 15, b.x1 - b.x0, 4, css(STO(b)), null); line(c, b.x0, y + 19, b.x1, y + 19, ink(0.6), 0.6); } }
        // the shadow cast by the neighbouring building on the right when it is taller
        hatch(c, RR(b.x1 - 10, yT + CORN, 10, BASE - b.gf - yT - CORN), { ang: Math.PI / 2, sp: 2.2, lw: 0.4, col: ink(0.25) });
      });
      // windows
      L.fac.push((c) => {
        const rr = SV(3000 + bi); b._flag = 0;
        for (let k = 1; k <= b.fl; k++) {
          const yb = BASE - b.gf - (k - 1) * b.fh, sill = yb - 24, h = (k === b.fl ? 60 : 64) + (b.fh - FH) * 0.6, y = sill - h;
          for (let i = 0; i < b.nw; i++) {
            const x = cl.xs[i];
            const lit = rr.c(k === 1 ? 0.42 : k === 2 ? 0.3 : 0.2);
            const o = { lit, shade: rr.u(0, 1), curt: rr.c(0.45), lint: k === b.fl && b.lint === 'flat' ? 'seg' : b.lint, inner: lit ? rr.i(0, 3) : 0, plant: rr.c(0.18) ? rr.u(0.25, 0.75) : 0, dim: rr.u(0.05, 0.3) };
            if (b.upper && b.upper[k] && i === 0) o.shade = 0;
            if (k === 2 && !b._flag && rr.c(0.2) && !(b.fe && i >= b.fe[0] && i <= b.fe[1])) { b._flag = 1; o.flag = 1; o.flagType = rr.c(0.6) ? 'it' : 'us'; }
            drawWindow(c, b, x, y, cl.ww, h, o);
            if (lit) LIGHTS.push({ x, y: y + h / 2, r: cl.ww * 1.1, a: 0.16 });
            if (b.upper && b.upper[k] && i === 0) text(c, b.upper[k], x, y + h * 0.36, Math.min(8, cl.ww * 0.95 / (b.upper[k].length * 0.85)), { col: 'rgba(250,226,150,0.95)', lw: 0.9, track: 1.2, arc: -2 });
            if (o.flag) {
              // flag drawn inside drawWindow
            }
          }
        }
        // banner across the facade
        if (b.banner) {
          const y = BASE - b.gf - b.fh - 20, x0 = b.x0 + 14, x1 = b.x1 - 14;
          const p = [x0, y - 2, x1, y - 2, x1 - 4, y + 24, (x0 + x1) / 2, y + 30, x0 + 4, y + 24];
          fillP(c, p, css([232, 218, 186]));
          c.save(); c.beginPath(); addP(c, p); c.clip(); c.fillStyle = css(WARMRED, 0.85); c.fillRect(x0, y - 2, x1 - x0, 4); c.fillRect(x0, y + 22, x1 - x0, 10); c.restore();
          strokeL(c, p.concat([p[0], p[1]]), ink(0.8), 0.8);
          text(c, b.banner, (x0 + x1) / 2, y + 12, 13, { col: css([150, 50, 30]), lw: 2.2, track: 2, arc: 2 });
          line(c, x0, y - 2, x0 - 8, y - 14, ink(0.8), 0.8); line(c, x1, y - 2, x1 + 8, y - 14, ink(0.8), 0.8);
        }
      });
      L.fac.push((c) => cornice(c, b, b.x0, b.x1, yT, b.corn));
      L.fac.push((c) => storefront(c, b));
      if (b.fe) {
        const rr = SV(4000 + bi), people = [];
        const span = cols(b).xs[b.fe[1]] - cols(b).xs[b.fe[0]] + cols(b).ww + 32, fx0 = cols(b).xs[b.fe[0]] - cols(b).ww / 2 - 16;
        for (let k = 1; k <= b.fl; k++) {
          const n = rr.i(0, k <= 3 ? 3 : 2);
          let x = fx0 + rr.u(8, 22);
          for (let j = 0; j < n && x < fx0 + span - 10; j++) {
            const kind = rr.r();
            const age = kind < 0.3 ? 'c' : 'a', sex = rr.c(0.55) ? 'f' : 'm';
            const hh0 = 56 * sAt(18) * (age === 'c' ? 0.66 : sex === 'f' ? 0.95 : 1);
            const xx = offSeam(x, 17);
            const sit = rr.c(0.45);
            const pose = sit ? POSE.sitTalk : rr.p([POSE.lean, POSE.lean, POSE.stand, POSE.pray, POSE.point, POSE.wave]);
            people.push({ k, x: xx, h: hh0, dir: rr.c(0.5) ? 1 : -1, fr: rr.u(0.4, 0.9), sex, age, pose, w: dress(rr, sex, age), dy: sit ? 0 : 0, lx: -1, noShadow: 1, haze: 0.05 });
            x += rr.u(18, 30);
          }
        }
        L.fe.push((c) => fireEscape(c, b, SV(4500 + bi), people));
      }
    }
    BLD.forEach(addBuilding);

    // window watchers: heads and shoulders leaning on pillows over the sills
    L.fe.push((c) => {
      const rr = SV(7100);
      for (const [bi, b] of BLD.entries()) {
        if (b.church || b.tower || b.alley) continue;
        const cl = cols(b);
        for (let k = 1; k <= b.fl; k++) for (let i = 0; i < b.nw; i++) {
          if (b.fe && i >= b.fe[0] && i <= b.fe[1]) continue;
          const x = cl.xs[i]; if (nearSeam(x, 22)) continue;
          if (!rr.c(k <= 2 ? 0.22 : 0.12)) continue;
          const yb = BASE - GF - (k - 1) * FH, sill = yb - 24;
          const sex = rr.c(0.6) ? 'f' : 'm', age = rr.c(0.2) ? 'c' : 'a';
          c.save(); c.beginPath(); c.rect(x - cl.ww / 2, sill - 64, cl.ww, 66); c.clip();
          drawFig(c, { x: x + rr.u(-4, 4), y: sill + 26, h: 54 * (age === 'c' ? 0.75 : 1), dir: rr.c(0.5) ? 1 : -1, fr: rr.u(0.55, 0.95), sex, age, pose: POSE.lean, w: dress(rr, sex, age), noShadow: 1, lx: -1, noLegs: 1 });
          c.restore();
          fillP(c, chaikin([x - cl.ww * 0.42, sill - 3, x + cl.ww * 0.42, sill - 3, x + cl.ww * 0.45, sill + 2, x - cl.ww * 0.45, sill + 2], true, 1), css([240, 232, 214]));
          strokeL(c, chaikin([x - cl.ww * 0.42, sill - 3, x + cl.ww * 0.42, sill - 3, x + cl.ww * 0.45, sill + 2, x - cl.ww * 0.45, sill + 2, x - cl.ww * 0.42, sill - 3], false, 1), ink(0.55), 0.5);
        }
      }
    });

    // laundry between buildings and on roofs
    L.fe.push((c) => {
      const rr = SV(7200);
      const lines = [[30, 600, 236, 612, 26], [266, 490, 500, 506, 30], [530, 390, 742, 400, 22], [790, 600, 990, 590, 28], [1872, 470, 2070, 478, 24], [2950, 600, 3140, 590, 24], [3180, 470, 3410, 480, 26]];
      for (const [x0, y0, x1, y1, s] of lines) laundry(c, x0, y0, x1, y1, s, laundryItems(rr, 12, x1 - x0, 40), rr);
    });

    /* ---------- roofs ---------- */
    const roofY = (x) => { for (const b of BLD) if (x >= b.x0 && x < b.x1 && !b.church && !b.tower && !b.alley) return bTop(b); return 300; };
    L.roofB.push((c) => {
      const rr = SV(7300);
      tank(c, 120, roofY(120) + 4, 64, 66);
      tank(c, 1956, roofY(1956) + 4, 56, 58);
      tank(c, 3300, roofY(3300) + 4, 60, 62);
      tank(c, 2790, roofY(2790) + 4, 46, 48);
      { const bb = BLD.find((q) => q.billboard), y0 = bTop(bb) + 4, bx0 = bb.x0 + 14, bx1 = bb.x1 - 14, top = y0 - 96;
        c.beginPath(); for (let x = bx0 + 10; x < bx1; x += 44) { c.moveTo(x, y0 + 10); c.lineTo(x, top + 8); c.moveTo(x, y0); c.lineTo(x + 22, top + 40); } c.strokeStyle = ink(0.85); c.lineWidth = 1.4; c.stroke();
        rect(c, bx0, top, bx1 - bx0, 62, css([226, 210, 176]), ink(0.9), 1.1);
        hatch(c, RR(bx0, top, bx1 - bx0, 62), { ang: 0, sp: 2.2, lw: 0.4, col: ink(0.25), f: (x, y) => 0.45 + 0.25 * Math.sin(x * 0.05) });
        text(c, "OLIO D'OLIVA", (bx0 + bx1) / 2, top + 20, 18, { col: css([146, 52, 34]), lw: 2.6, track: 1.8 });
        text(c, 'IMPORTATO DA LUCCA', (bx0 + bx1) / 2, top + 44, 9.5, { col: ink(0.85), lw: 1.3, track: 1.6 });
        line(c, bx0 - 2, top + 64, bx1 + 2, top + 64, ink(0.9), 1.6);
        for (const lx of [bx0 + 30, (bx0 + bx1) / 2, bx1 - 30]) { line(c, lx, top + 64, lx, top + 72, ink(0.9), 1); line(c, lx, top + 72, lx + 6, top + 60, ink(0.9), 1); LIGHTS.push({ x: lx + 6, y: top + 58, r: 22, a: 0.4 }); }
      }
      for (const [x, w, h, p] of [[60, 16, 30, 2], [210, 12, 22, 1], [470, 14, 26, 2], [600, 12, 20, 1], [880, 16, 28, 2], [1060, 12, 34, 2], [1600, 14, 26, 2], [1760, 12, 22, 1], [2140, 14, 24, 2], [2330, 12, 22, 1], [2460, 16, 28, 2], [2660, 12, 26, 1], [3000, 14, 24, 2], [3120, 12, 20, 1], [3470, 14, 26, 2], [3700, 16, 30, 2], [3840, 12, 24, 1], [3920, 12, 22, 2], [4200, 14, 30, 2], [4300, 12, 22, 1]]) chimney(c, x, roofY(x) + 6, w, h, p);
      bulkhead(c, 548, roofY(560) + 8, 34, 30);
      bulkhead(c, 2232, roofY(2232) + 8, 34, 30);
      bulkhead(c, 2860, roofY(2860) + 8, 30, 28);
      bulkhead(c, 4064, roofY(4064) + 8, 40, 34, 'ajar');
      // pigeon coop and its keeper
      const cx0 = 300, cy = roofY(320) + 6;
      rect(c, cx0, cy - 40, 74, 40, css([110, 86, 66]), ink(0.85), 0.9);
      fillP(c, [cx0 - 6, cy - 40, cx0 + 37, cy - 56, cx0 + 80, cy - 40], css([90, 70, 54])); strokeL(c, [cx0 - 6, cy - 40, cx0 + 37, cy - 56, cx0 + 80, cy - 40], ink(0.9), 1);
      c.beginPath(); for (let x = cx0 + 4; x < cx0 + 72; x += 4) { c.moveTo(x, cy - 36); c.lineTo(x, cy - 12); } for (let y = cy - 36; y < cy - 10; y += 4) { c.moveTo(cx0 + 4, y); c.lineTo(cx0 + 70, y); } c.strokeStyle = ink(0.5); c.lineWidth = 0.4; c.stroke();
      line(c, cx0 - 10, cy - 12, cx0 + 84, cy - 12, ink(0.9), 1.6);
      for (let i = 0; i < 5; i++) pigeon(c, cx0 + 6 + i * 15, cy - 15, 0.9, 0, i % 2 ? 1 : -1);
      drawFig(c, { x: 410, y: cy + 14, h: 60, dir: -1, fr: 0.4, sex: 'm', age: 'a', pose: { nl: [0.05, 0.02], fl: [-0.05, -0.02], na: [2.75, 2.9], fa: [0.3, 0.6], tilt: -0.3 }, w: { top: 'shirt', tc: C.cream, vest: C.dark, bc: C.dark, hat: 'cap', hc: C.dark, must: 1 }, noShadow: 1, lx: -1 });
      const px = 416, py = cy - 46;
      line(c, px - 8, py + 20, px - 70, py - 110, ink(0.9), 1.2);
      fillP(c, [px - 70, py - 110, px - 52, py - 116, px - 48, py - 104, px - 64, py - 98], css(WARMRED, 0.85));
      // rooftop laundry
      laundry(c, 410, roofY(450) - 2, 505, roofY(505) - 4, 10, laundryItems(rr, 6, 95, 30), rr);
      laundry(c, 800, roofY(820) - 6, 990, roofY(990) - 2, 14, laundryItems(rr, 9, 190, 34), rr);
      line(c, 800, roofY(820) + 8, 800, roofY(820) - 10, ink(0.9), 1.4); line(c, 990, roofY(990) + 8, 990, roofY(990) - 6, ink(0.9), 1.4);
      laundry(c, 3480, roofY(3480) - 4, 3600, roofY(3600) - 2, 10, laundryItems(rr, 6, 120, 30), rr);
      // spectators on the roofs of the market block, watching the fireworks
      const sp = [[2668, 'm', 'a', POSE.point], [2690, 'f', 'a', POSE.lookup], [2708, 'f', 'c', POSE.lookup], [2740, 'm', 'a', POSE.lookup], [3010, 'f', 'a', POSE.lookup], [3028, 'm', 'a', POSE.armsUp], [2480, 'm', 'c', POSE.wave], [1720, 'm', 'c', POSE.wave], [1700, 'f', 'a', POSE.lookup]];
      for (const [x, sex, age, pose] of sp) drawFig(c, { x, y: roofY(x) + 18, h: 58 * (age === 'c' ? 0.7 : sex === 'f' ? 0.95 : 1), dir: rr.c(0.5) ? 1 : -1, fr: 0.6, sex, age, pose, w: dress(rr, sex, age), noShadow: 1, lx: 1, haze: 0.1 });
    });
    // party walls above lower neighbours and roof parapets
    L.roofF.push((c) => {
      // Vito, slide one: stepping up from one roof to the next, a slim silhouette against the afterglow
      const yC = bTop(BLD[2]), yD = bTop(BLD[3]) - BLD[3].parapet;
      const uV = 108 / totH(BODY.man);
      drawFig(c, { x: 744, y: yC + 1, h: 108, solid: 1, dir: 1, fr: 0.12, sex: 'm', age: 'a', slim: 0.82, pose: { nl: { to: [2.1, -(yC - yD + 4) / uV - 0.2], bend: 1 }, fl: [-0.18, -0.42], na: [-0.5, -0.3], fa: [0.55, 1.0], lean: 0.2, tilt: 0.05 }, w: { top: 'jacket', tc: [52, 40, 32], bc: [48, 38, 30], hat: 'cap', hc: [40, 32, 26], tie: false, shirt: C.cream }, noShadow: 1, lx: -1 });
      // Vito, slide four: crouched at the roof edge above Fanucci's door
      const yP = bTop(BLD.find((b) => b.fanucci));
      drawFig(c, { x: 3992, y: yP + 2, h: 120, solid: 1, dir: -1, fr: 0.15, sex: 'm', age: 'a', slim: 0.82, pose: { drop: 2.3, nl: { to: [0.9, -0.2], bend: 1 }, fl: { to: [-0.5, -0.2], bend: 1 }, na: { to: [0.95, 2.05], bend: -1 }, fa: [0.4, 0.2], lean: 0.62, tilt: 0.55 }, w: { top: 'jacket', tc: [52, 40, 32], bc: [48, 38, 30], hat: 'cap', hc: [40, 32, 26], tie: false, shirt: C.cream }, noShadow: 1, lx: 1 });
      // pigeons wheeling over the first roofs
      const rr = SV(7400);
      for (let i = 0; i < 22; i++) { const t = i / 22, a = t * 4.2 + rr.u(-0.15, 0.15); pigeon(c, 330 + Math.cos(a) * (150 + t * 120) + rr.u(-10, 10), 150 + Math.sin(a) * 52 - t * 40 + rr.u(-8, 8), rr.u(0.9, 1.4), rr.u(0, TAU), Math.sin(a) > 0 ? -1 : 1); }
      for (let i = 0; i < 5; i++) pigeon(c, 1210 + i * 23 + rr.u(-5, 5), bTop(BLD[4]) + 12 + 0 * i, 0.8, 0, i % 2 ? 1 : -1);
    });

    /* ---------- the street ---------- */
    L.street.push((c) => {
      // far sidewalk
      const g = c.createLinearGradient(0, BASE, 0, H);
      g.addColorStop(0, '#e2c696'); g.addColorStop(0.1, '#dcc092'); g.addColorStop(0.4, '#ccac80'); g.addColorStop(0.7, '#b8966c'); g.addColorStop(1, '#94744f');
      c.fillStyle = g; c.fillRect(0, BASE, W, H - BASE);
      // paving joints of the far sidewalk
      c.beginPath(); for (let k = 1; k < 4; k++) { const y = gY(k * 32); c.moveTo(0, y); c.lineTo(W, y); } for (let x = 0; x < W; x += 46) { c.moveTo(x, BASE); c.lineTo(x, CURB_F); } c.strokeStyle = ink(0.22); c.lineWidth = 0.5; c.stroke();
      // curb
      rect(c, 0, CURB_F, W, 4, css([170, 140, 104])); line(c, 0, CURB_F, W, CURB_F, ink(0.8), 1); line(c, 0, CURB_F + 4, W, CURB_F + 4, ink(0.5), 0.6);
      // tram rails
      for (const d of [250, 262, 330, 342]) line(c, 0, gY(d), W, gY(d), 'rgba(250,230,190,0.5)', 0.8);
      // near curb and near sidewalk
      rect(c, 0, CURB_N, W, 9, css([150, 120, 88])); line(c, 0, CURB_N, W, CURB_N, ink(0.85), 1.2); line(c, 0, CURB_N + 9, W, CURB_N + 9, ink(0.6), 0.8);
      
    });
    // the etched ground: ruled lines that widen toward us, graded dark at the front and lifted where the festa glows
    const GLOWS = [[1620, 1030, 420, 150, 0.6], [2780, 990, 560, 220, 0.95], [1300, 940, 120, 40, 0.5], [3600, 1080, 420, 180, 0.3], [3600, 1320, 260, 70, 0.8], [560, 990, 520, 140, 0.25], [2200, 1000, 300, 140, 0.3], [4000, 960, 260, 90, 0.3]];
    for (const b of BLD) if (b.store) GLOWS.push([(b.x0 + b.x1) / 2, BASE + 14, (b.x1 - b.x0) * 0.42, 26, 0.38]);
    const depthOf = (y) => DV - DV * (BASE - HZ) / (y - HZ);
    const groundTone = (x, y) => {
      const t = clamp((y - CURB_F) / (H - CURB_F), 0, 1);
      let v = 0.42 + 0.7 * Math.pow(t, 1.1);
      for (const g of GLOWS) { const dx = (x - g[0]) / g[2], dy = (y - g[1]) / g[3]; const e = dx * dx + dy * dy; if (e < 6) v -= g[4] * 1.15 * Math.exp(-e); }
      return v;
    };
    // the roadway in Belgian blocks: irregular stones in courses that bend gently with the street, each block's
    // lower edge in shadow; lit blocks keep a hairline, shadowed ones take hatching. Puddles and litter follow.
    const PUDDLES = [[2706, 1090, 92, 9], [1470, 1178, 66, 7], [3480, 1196, 84, 9], [610, 1062, 58, 6], [4010, 1250, 70, 8], [2020, 1262, 60, 7], [920, 1300, 76, 9]];
    const inPuddle = (x, y) => PUDDLES.some((q) => ((x - q[0]) / q[2]) ** 2 + ((y - q[1]) / q[3]) ** 2 < 1);
    const worn = (x, y) => 0.22 * Math.max(0, Math.sin(x * 0.0061 + y * 0.013) * Math.sin(x * 0.0023 - y * 0.009 + 2));
    for (let band = 0; band < 10; band++) {
      L.street.push((c) => {
        const ya = lerp(CURB_F + 5, H, band / 10), yb2 = lerp(CURB_F + 5, H, (band + 1) / 10);
        const P1 = new Path2D(), P2 = new Path2D(), P3 = new Path2D(), P4 = new Path2D();
        let y = CURB_F + 5, row = 0;
        const rowH = (yy, r) => 3.9 * sAt(depthOf(yy)) * (0.86 + hf(r * 13 + 1) * 0.28);
        while (true) { if (y > CURB_N - 3 && y < CURB_N + 10) { y = CURB_N + 10; row++; continue; } const bh = rowH(y, row); if (y + bh > ya) break; y += bh; row++; }
        for (; y < yb2 && y < H; row++) {
          if (y > CURB_N - 3 && y < CURB_N + 10) { y = CURB_N + 10; continue; }
          const sc = sAt(depthOf(y)), bh = rowH(y, row);
          let x = -hf(row * 31) * 9 * sc;
          while (x < W) {
            const k = row * 7919 + Math.round(x * 3), bw = 8.8 * sc * (0.62 + hf(k) * 0.76), gap = sc * (0.3 + hf(k + 1) * 0.55);
            const wv = (xx) => sc * 1.4 * Math.sin(xx * 0.0019 + row * 0.41);
            const j = (n, amt) => (hf(k + n) - 0.5) * amt;
            const q = [x + gap + j(2, bw * 0.16), y + gap * 0.6 + wv(x) + j(3, bh * 0.2), x + bw - gap + j(4, bw * 0.16), y + gap * 0.6 + wv(x + bw) + j(5, bh * 0.2),
              x + bw - gap + j(6, bw * 0.14), y + bh - gap * 0.6 + wv(x + bw) + j(7, bh * 0.16), x + gap + j(8, bw * 0.14), y + bh - gap * 0.6 + wv(x) + j(9, bh * 0.16)];
            const cx = (q[0] + q[4]) / 2, cy = (q[1] + q[5]) / 2;
            x += bw;
            if (inPuddle(cx, cy)) continue;
            const t = groundTone(cx, cy) - worn(cx, cy);
            const s2 = chaikin(q, true, 1);
            const n = s2.length / 2;
            // top and left edges (lit side): hairline, only where the ground is not in full light
            if (t > 0.12 + hf(k + 10) * 0.3) { P1.moveTo(s2[2 * (n - 2)], s2[2 * (n - 2) + 1]); for (const ii of [n - 1, 0, 1, 2, 3]) P1.lineTo(s2[2 * ii], s2[2 * ii + 1]); }
            // right and bottom edges (shadow side)
            if (t > 0.04) { P2.moveTo(s2[6], s2[7]); for (let ii = 4; ii <= n - 2; ii++) P2.lineTo(s2[2 * ii], s2[2 * ii + 1]); }
            // hatching across the block in shadow, along the course
            const nh = Math.floor(clamp(t - 0.1, 0, 1) * 4.5);
            for (let jj = 0; jj < nh; jj++) { const f = 0.78 - jj * 0.17; P3.moveTo(lerp(q[6], q[0], 1 - f) + bw * 0.12, lerp(q[7], q[1], 1 - f)); P3.lineTo(lerp(q[4], q[2], 1 - f) - bw * 0.1, lerp(q[5], q[3], 1 - f)); }
            // a cracked block now and then
            if (hf(k + 20) < 0.045 && t > 0.15) { P4.moveTo(q[0] + bw * 0.3, q[1]); P4.lineTo(cx - bw * 0.05, cy); P4.lineTo(cx + bw * 0.15, cy + bh * 0.15); P4.lineTo(q[6] + bw * 0.6, q[7]); }
          }
          y += bh;
        }
        c.lineCap = 'round'; c.lineJoin = 'round';
        c.strokeStyle = ink(0.3); c.lineWidth = 0.4; c.stroke(P1);
        c.strokeStyle = ink(0.66); c.lineWidth = 0.6; c.stroke(P2);
        c.strokeStyle = ink(0.4); c.lineWidth = 0.4; c.stroke(P3);
        c.strokeStyle = ink(0.6); c.lineWidth = 0.45; c.stroke(P4);
      });
    }
    // puddles holding the festa lights, horse droppings and straw, paper litter, confetti, orange peel
    L.street.push((c) => {
      for (const [px, py, rx, ry] of PUDDLES) {
        c.save(); c.beginPath(); c.ellipse(px, py, rx, ry, 0, 0, TAU); c.clip();
        c.fillStyle = 'rgba(236,210,160,0.85)'; c.fillRect(px - rx, py - ry, rx * 2, ry * 2);
        const glowA = clamp(1 - groundTone(px, py), 0.2, 1);
        c.globalCompositeOperation = 'screen';
        c.fillStyle = 'rgba(255,224,150,' + (0.7 * glowA).toFixed(2) + ')'; for (let i = 0; i < 9; i++) { const xx = px - rx + (hf(px + i) * 2) * rx; c.fillRect(xx, py - ry, 1.4 + hf(px + i * 3) * 3, ry * 2); }
        c.globalCompositeOperation = 'source-over';
        c.beginPath(); for (let yy = py - ry + 1.5; yy < py + ry; yy += 2.2) { const o2 = hf(Math.round(yy * 7 + px)) * rx; c.moveTo(px - rx + o2 * 0.5, yy); c.lineTo(px + rx - o2 * 0.4, yy); } c.strokeStyle = 'rgba(60,40,24,0.35)'; c.lineWidth = 0.4; c.stroke();
        c.restore();
        c.beginPath(); c.ellipse(px, py, rx, ry, 0, Math.PI * 0.05, Math.PI * 0.95); c.strokeStyle = ink(0.6); c.lineWidth = 0.7; c.stroke();
        c.beginPath(); c.ellipse(px, py, rx, ry, 0, Math.PI * 1.1, Math.PI * 1.9); c.strokeStyle = 'rgba(250,236,200,0.6)'; c.lineWidth = 0.6; c.stroke();
      }
      const rr = FX(8800);
      for (let i = 0; i < 14; i++) {
        const x = rr.u(40, W - 40), d = rr.u(150, 420), y = gY(d), s = sAt(d);
        if (nearSeam(x, 20)) continue;
        c.fillStyle = css([90, 66, 44]); for (let k = 0; k < 4; k++) { c.beginPath(); c.ellipse(x + rr.u(-4, 4) * s, y + rr.u(-1, 1) * s, 2.2 * s, 1.3 * s, 0, 0, TAU); c.fill(); }
        c.beginPath(); for (let k = 0; k < 12; k++) { const a = rr.u(0, Math.PI), l = rr.u(3, 8) * s, x0 = x + rr.u(-12, 12) * s, y0 = y + rr.u(-3, 3) * s; c.moveTo(x0, y0); c.lineTo(x0 + Math.cos(a) * l, y0 - Math.sin(a) * l * 0.35); } c.strokeStyle = css([200, 166, 90]); c.lineWidth = 0.6 * s; c.stroke();
      }
      for (let i = 0; i < 70; i++) {
        const x = rr.u(20, W - 20), d = rr.u(130, 640), y = gY(d), s = sAt(d), a = rr.u(-0.6, 0.6), w = rr.u(4, 8) * s, h = rr.u(1.6, 3) * s;
        c.save(); c.translate(x, y); c.rotate(a);
        fillP(c, [-w / 2, -h / 2, w / 2, -h / 2 + rr.u(-0.5, 0.5), w / 2, h / 2, -w / 2, h / 2], css(rr.p([[244, 238, 222], [236, 226, 200], [226, 214, 184]])));
        strokeL(c, [-w / 2, -h / 2, w / 2, -h / 2, w / 2, h / 2, -w / 2, h / 2, -w / 2, -h / 2], ink(0.5), 0.35);
        if (w > 10) { c.beginPath(); for (let k = 1; k < 3; k++) { c.moveTo(-w * 0.35, -h / 2 + k * h / 3); c.lineTo(w * 0.35, -h / 2 + k * h / 3); } c.strokeStyle = ink(0.35); c.lineWidth = 0.3; c.stroke(); }
        c.restore();
      }
      for (let i = 0; i < 260; i++) {
        const near = i < 160, x = near ? rr.u(1300, 3300) : rr.u(0, W), d = rr.u(130, 600), y = gY(d), s = sAt(d);
        c.fillStyle = css(rr.p([WARMRED, GOLD, [240, 232, 210], [120, 150, 110]]), 0.9); c.fillRect(x, y, 1.2 * s, 0.8 * s);
      }
      for (let i = 0; i < 9; i++) { const x = rr.u(2230, 2560), y = rr.u(1290, 1345), a = rr.u(0, TAU); c.beginPath(); c.arc(x, y, 3.2, a, a + 2.2); c.strokeStyle = css(ORANGE); c.lineWidth = 2; c.stroke(); c.strokeStyle = ink(0.5); c.lineWidth = 0.4; c.stroke(); }
    });
    // the near sidewalk: big flags, ruled and graded darker toward the bottom edge
    L.street.push((c) => {
      let k = 0;
      // the far sidewalk, ruled lightly
      for (let y = BASE + 1; y < CURB_F; y += 1.6, k++) { const thr = vdc(k + 5); c.beginPath(); let on = false; for (let x = 0; x <= W + 8; x += 8) { if (groundTone(x, CURB_F) * 0.8 + 0.1 > thr) { if (!on) { c.moveTo(x, y); on = true; } else c.lineTo(x, y); } else on = false; } c.strokeStyle = ink(0.3); c.lineWidth = 0.4; c.stroke(); }
    });
    // the festa glow pooled in the street
    L.street.push((c) => {
      c.save(); c.globalCompositeOperation = 'screen';
      for (const [x, y, rx, ry, a] of GLOWS.map((g) => [g[0], g[1], g[2] * 1.15, g[3] * 1.2, Math.min(0.85, g[4] * 0.9)])) {
        c.save(); c.translate(x, y); c.scale(1, ry / rx); const g = c.createRadialGradient(0, 0, 0, 0, 0, rx); g.addColorStop(0, 'rgba(255,210,130,' + a + ')'); g.addColorStop(1, 'rgba(255,210,130,0)'); c.fillStyle = g; c.fillRect(-rx, -rx, 2 * rx, 2 * rx); c.restore();
      }
      c.restore();
    });

    /* ---------- lights: strings along the facades and on poles at the curb ---------- */
    const POLES = [140, 470, 820, 1250, 1520, 1890, 2300, 2420, 3120, 3330, 3720, 4080].filter((x) => !nearSeam(x, 14));
    L.street.push((c) => {
      // far strings, fixed to the facades just above the shops
      for (let x = -20; x < W; x += 210) {
        const p = sag(x, 735, x + 210, 735, 22, 30); strokeL(c, p, ink(0.6), 0.6);
        const pts = along(p, 8.5, 3); for (let i = 0; i < pts.length; i += 2) LIGHTS.push({ x: pts[i], y: pts[i + 1] + 1.5, r: 5, a: 0.75, bulb: 1 });
      }
    });
    // poles at the far curb with strings and lanterns between them
    for (const [pi, px] of POLES.entries()) {
      crowdOp(CURB_F - 1, (c) => {
        const top = yAt(BASE - 230, 120), base = CURB_F;
        line(c, px, base, px, top, ink(0.9), 2.4); line(c, px + 0.8, base, px + 0.8, top, 'rgba(255,220,170,0.35)', 0.6);
        line(c, px - 14, top + 8, px + 14, top + 8, ink(0.9), 1.6);
        c.fillStyle = ink(0.9); c.beginPath(); c.arc(px, top - 2, 2.4, 0, TAU); c.fill();
      });
    }
    L.street.push((c) => {
      const rr = SV(7500);
      const top = yAt(BASE - 230, 120) + 8;
      const xs = [-60].concat(POLES, [W + 60]);
      for (let i = 0; i < xs.length - 1; i++) {
        const a = xs[i], b = xs[i + 1], s = (b - a) * 0.13;
        const p = sag(a, top, b, top, s, 40); strokeL(c, p, ink(0.75), 0.7);
        const pts = along(p, 11, 5); for (let j = 0; j < pts.length; j += 2) LIGHTS.push({ x: pts[j], y: pts[j + 1] + 2, r: 7, a: 0.85, bulb: 1.4 });
        // lanterns
        const nl = Math.max(1, Math.round((b - a) / 70));
        for (let j = 1; j <= nl; j++) {
          const t = j / (nl + 1), lx = lerp(a, b, t), ly = lerp(top, top, t) + s * 4 * t * (1 - t);
          if (nearSeam(lx, 10)) continue;
          const colr = rr.p([WARMRED, WARMRED, GOLD, [236, 222, 190], [210, 120, 60]]);
          const lh = rr.u(14, 20), lw = lh * 0.62;
          line(c, lx, ly, lx, ly + 5, ink(0.8), 0.6);
          c.beginPath(); c.ellipse(lx, ly + 5 + lh / 2, lw, lh / 2, 0, 0, TAU); c.fillStyle = css(colr, 0.92); c.fill();
          c.save(); c.clip(); const g = c.createRadialGradient(lx - lw * 0.2, ly + 5 + lh * 0.45, 0, lx, ly + 5 + lh / 2, lw * 1.2); g.addColorStop(0, 'rgba(255,240,190,0.75)'); g.addColorStop(1, 'rgba(255,240,190,0)'); c.fillStyle = g; c.fillRect(lx - lw, ly + 5, lw * 2, lh);
          c.beginPath(); for (let r = 1; r < 6; r++) { const yy = ly + 5 + lh * r / 6; c.moveTo(lx - lw, yy); c.quadraticCurveTo(lx, yy + 1.5, lx + lw, yy); } c.strokeStyle = ink(0.35); c.lineWidth = 0.5; c.stroke(); c.restore();
          rect(c, lx - lw * 0.45, ly + 4, lw * 0.9, 2.2, ink(0.85)); rect(c, lx - lw * 0.4, ly + 4 + lh, lw * 0.8, 2.2, ink(0.85));
          c.beginPath(); c.ellipse(lx, ly + 5 + lh / 2, lw, lh / 2, 0, 0, TAU); c.strokeStyle = ink(0.7); c.lineWidth = 0.6; c.stroke();
          if (rr.c(0.5)) { line(c, lx, ly + 7 + lh, lx, ly + 14 + lh, css(colr), 1.2); }
          LIGHTS.push({ x: lx, y: ly + 5 + lh / 2, r: lh * 1.6, a: 0.45, col: colr === WARMRED ? [255, 150, 100] : GLOW });
        }
      }
    });

    /* ---------- the arch of lights ---------- */
    const ARCH = { cx: 2788, yb: gY(250), w: 560, top: 400 };
    crowdOp(ARCH.yb, (c) => {
      const A = ARCH, s = sAt(250), hw = A.w / 2, pw = 40;
      const yS = 590, bulbs = [];
      const frame = [];
      // pillars: lattice towers
      for (const sd of [-1, 1]) {
        const xo = A.cx + sd * hw, xi = xo - sd * pw;
        frame.push([xo, A.yb, xo, yS - 40], [xi, A.yb, xi, yS - 40]);
        for (let y = A.yb - 30; y > yS - 40; y -= 34) { frame.push([xo, y, xi, y - 34], [xi, y, xo, y - 34], [xo, y, xi, y]); }
        // finial towers
        frame.push([xo, yS - 40, (xo + xi) / 2, yS - 120], [xi, yS - 40, (xo + xi) / 2, yS - 120]);
        frame.push([xo, yS - 40, xi, yS - 40], [(xo + xi) / 2 - 10, yS - 80, (xo + xi) / 2 + 10, yS - 80]);
      }
      // arches
      const arcPts = (r, ry, yc) => { const p = []; for (let i = 0; i <= 40; i++) { const a = Math.PI + (i / 40) * Math.PI; p.push(A.cx + Math.cos(a) * r, yc + Math.sin(a) * ry); } return p; };
      const outer = arcPts(hw - pw / 2, yS - A.top, yS), inner = arcPts(hw - pw - 18, yS - A.top - 52, yS + 10), inner2 = arcPts(hw - pw - 46, yS - A.top - 96, yS + 14);
      // spokes and diamonds between outer and inner arcs
      const spokes = [];
      for (let i = 2; i <= 38; i += 3) spokes.push([outer[2 * i], outer[2 * i + 1], inner[2 * i], inner[2 * i + 1]]);
      for (let i = 1; i <= 39; i += 3) spokes.push([outer[2 * (i)], outer[2 * (i) + 1], inner[2 * (i + 2)], inner[2 * (i + 2) + 1]]);
      // the crown: a star in a ring
      const crx = A.cx, cry = A.top - 14;
      // a lettered plaque hanging from the crown
      const plq = { y: 540, w: 236 };
      // glow behind the whole structure
      c.save(); c.globalCompositeOperation = 'screen';
      c.save(); c.translate(A.cx, 600); c.scale(1, 0.85); glowDot(c, 0, 0, 430, GLOW, 0.5); c.restore();
      c.restore();
      // draw the wooden frame
      c.beginPath();
      for (const f of frame) { c.moveTo(f[0], f[1]); c.lineTo(f[2], f[3]); }
      addL(c, outer); addL(c, inner); addL(c, inner2);
      for (const f of spokes) { c.moveTo(f[0], f[1]); c.lineTo(f[2], f[3]); }
      c.moveTo(crx + 40, cry); c.arc(crx, cry, 40, 0, TAU);
      c.strokeStyle = ink(0.75); c.lineWidth = 1.5; c.stroke();
      // plaque
      const pp = [A.cx - plq.w / 2, plq.y - 22, A.cx + plq.w / 2, plq.y - 22, A.cx + plq.w / 2, plq.y + 22, A.cx - plq.w / 2, plq.y + 22];
      strokeL(c, pp.concat([pp[0], pp[1]]), ink(0.8), 1.4);
      line(c, A.cx - plq.w / 2 + 10, plq.y - 22, A.cx - plq.w / 2 + 20, yS - (yS - A.top - 52) + 40, ink(0.6), 0.8);
      // bulbs along everything
      const addB = (p, st) => { const q = along(p, st || 7, 0); for (let i = 0; i < q.length; i += 2) bulbs.push(q[i], q[i + 1]); };
      for (const f of frame) addB(f, 7.5);
      addB(outer, 6.5); addB(inner, 7); addB(inner2, 8);
      for (const f of spokes) addB(f, 9);
      const ring = []; for (let i = 0; i <= 48; i++) { const a = i / 48 * TAU; ring.push(crx + Math.cos(a) * 40, cry + Math.sin(a) * 40); } addB(ring, 6);
      const star = []; for (let i = 0; i <= 10; i++) { const a = -Math.PI / 2 + i / 10 * TAU, r = i % 2 ? 13 : 32; star.push(crx + Math.cos(a) * r, cry + Math.sin(a) * r); } addB(star, 5);
      for (const tp of textPolys('W SAN ROCCO', A.cx, plq.y, 26, { track: 2.2 })) addB(tp, 4.2);
      addB(pp.concat([pp[0], pp[1]]), 6);
      // garlands of bulbs dropping from the inner arch
      for (let i = 6; i <= 34; i += 7) { const x0 = inner2[2 * i], y0 = inner2[2 * i + 1], x1 = inner2[2 * (i + 3)], y1 = inner2[2 * (i + 3) + 1]; addB(sag(x0, y0, x1, y1, 22, 16), 6.5); }
      c.fillStyle = 'rgba(255,236,170,1)';
      for (let i = 0; i < bulbs.length; i += 2) { c.beginPath(); c.arc(bulbs[i], bulbs[i + 1], 1.6, 0, TAU); c.fill(); }
      for (let i = 0; i < bulbs.length; i += 4) LIGHTS.push({ x: bulbs[i], y: bulbs[i + 1], r: 9, a: 0.55, col: GLOW });
      LIGHTS.push({ x: crx, y: cry, r: 90, a: 0.4 });
    });

    /* ---------- crowd ---------- */
    const FIG = [];
    const rsv = [];           // zones the filler crowd keeps clear: [x0, x1, y0, y1]
    const add = (o) => { o.x = offSeam(o.x, (o.hw || o.h * 0.27)); FIG.push(o); return o; };
    const lxAt = (x) => (x > 2200 && x < 2788 ? 1 : x >= 2788 && x < 3300 ? -1 : -1);
    const P = (x, y, sex, age, pose, dir, extra, rr) => {
      const kb = Math.round(x * 13.7 + y * 3.1), vh = extra && extra.hs ? extra.hs : (age === 'a' ? 0.9 + hf(kb) * 0.17 : 0.85 + hf(kb) * 0.3);
      const h0 = figH(y) * (age === 'c' ? 0.7 : age === 't' ? 0.52 : sex === 'f' ? 0.94 : 1) * vh;
      const build = extra && (extra.slim || extra.broad || extra.belly) ? {} : age === 'a' ? (hf(kb + 1) < 0.25 ? { slim: 0.84 } : hf(kb + 1) < 0.45 ? { broad: 1.1 } : sex === 'm' && hf(kb + 1) < 0.58 ? { belly: 1.25 + hf(kb + 2) * 0.25 } : {}) : {};
      const o = Object.assign({ x, y, h: h0, dir, fr: 0.45, sex, age, pose: POSE[pose] || pose, w: dress(rr || SV(Math.round(x * 7 + y)), sex, age), haze: clamp((1070 - y) / 260, 0, 1) * 0.16, lx: lxAt(x) }, build, extra || {});
      return add(o);
    };
    const R = SV(9000);

    // slide 1 — the quiet end of the street
    rsv.push([280, 420, 915, 940]);
    P(306, 930, 'm', 'a', 'sitTalk', 1, { w: { top: 'shirt', tc: C.white, vest: C.black, bc: C.dark, hat: 'cap', hc: C.dark, must: 1 } });
    P(366, 932, 'm', 'a', 'sitTalk', -1, { old: 1, w: { top: 'jacket', tc: C.dark, bc: C.dark, hat: 'fedora', hc: C.mid, must: 1, hair: C.light } });
    P(392, 926, 'm', 'a', 'behind', -1, { old: 1, w: { top: 'shirt', tc: C.cream, braces: 1, bc: C.mid, hat: 'boater', must: 1 } });
    crowdOp(931, (c) => { rect(c, 322, 912, 30, 3, css([120, 86, 60]), ink(0.8), 0.6); line(c, 326, 915, 326, 931, ink(0.8), 0.9); line(c, 348, 915, 348, 931, ink(0.8), 0.9); for (let i = 0; i < 4; i++) rect(c, 327 + i * 5, 910.5, 3.5, 1.5, css([244, 238, 222])); });
    P(596, 922, 'f', 'a', 'sit', 1, { old: 1, w: { top: 'blouse', tc: C.black, bc: C.black, sk: 'ankle', shawl: C.black } });
    crowdOp(921, (c) => { line(c, 588, 905, 588, 922, ink(0.8), 1); line(c, 606, 912, 606, 922, ink(0.8), 1); rect(c, 586, 908, 22, 3, css([110, 80, 56]), ink(0.8), 0.5); });
    P(512, 1012, 'm', 'c', 'run', 1, { props: [{ t: 'hoop' }], w: { top: 'shirt', tc: C.white, bc: C.mid, hat: 'cap', hc: C.dark } });
    P(470, 1006, 'f', 'c', 'run', 1, { w: { top: 'dress', tc: C.light, sk: 'knee', hair: C.dark } });
    P(700, 1066, 'm', 'a', 'hold', 1, { w: { top: 'jacket', tc: C.dark, bc: C.dark, hat: 'fedora', hc: C.black, must: 1 } });
    P(664, 1060, 'f', 'a', 'carry', 1, { props: [{ t: 'child', col: C.white }], w: { top: 'blouse', tc: C.cream, bc: C.dark, sk: 'ankle', hair: C.black } });
    P(728, 1072, 'f', 'c', 'walk', 1, { na: [-0.6, -0.4], w: { top: 'dress', tc: C.white, sk: 'knee', hair: C.dark } });
    P(160, 1140, 'm', 'a', 'walk', 1, { w: { top: 'jacket', tc: C.slate, bc: C.dark, hat: 'boater' } });
    P(196, 1146, 'f', 'a', 'walk2', 1, { fr: 0.35, w: { top: 'dress', tc: C.rust, sk: 'calf', hat: 'kerchief', hc: C.white } });
    P(920, 1004, 'm', 'a', 'vendor', -1, { w: { top: 'shirt', tc: C.white, bc: C.dark, apron: true, hat: 'cap', must: 1 } });
    crowdOp(1005, (c) => { const x = 870, y = 1004; rect(c, x - 22, y - 44, 44, 26, css([210, 196, 170]), ink(0.85), 0.9); text(c, 'ICES', x, y - 31, 9, { col: css([150, 50, 30]), lw: 1.4 }); c.beginPath(); c.arc(x - 14, y - 10, 9, 0, TAU); c.arc(x + 14, y - 10, 9, 0, TAU); c.strokeStyle = ink(0.85); c.lineWidth = 1.2; c.stroke(); line(c, x + 22, y - 40, x + 40, y - 50, ink(0.8), 1.2); fillP(c, [x - 28, y - 44, x + 28, y - 44, x + 20, y - 68, x - 20, y - 68], css([226, 212, 186])); c.save(); c.beginPath(); addP(c, [x - 28, y - 44, x + 28, y - 44, x + 20, y - 68, x - 20, y - 68]); c.clip(); c.beginPath(); for (let k = -28; k < 28; k += 10) c.rect(x + k, y - 70, 5, 30); c.fillStyle = css(WARMRED, 0.7); c.fill(); c.restore(); strokeL(c, [x - 28, y - 44, x - 20, y - 68, x + 20, y - 68, x + 28, y - 44], ink(0.85), 0.8); line(c, x, y - 68, x, y - 44, ink(0.8), 0.8); });
    rsv.push([840, 940, 960, 1010]);
    P(842, 1012, 'm', 'c', 'eat', 1, { props: [{ t: 'zeppola' }], w: { top: 'shirt', tc: C.cream, bc: C.mid, hat: 'cap' } });
    P(262, 1346, 'm', 'a', 'stand', 1, { fr: 0.55, props: [{ t: 'shoulders', col: C.white, sex: 'f' }], w: { top: 'shirt', tc: C.cream, vest: C.black, bc: C.dark, hat: 'cap', hc: C.black, must: 1 } });
    P(980, 1260, 'f', 'c', 'run', 1, { w: { top: 'dress', tc: C.white, sk: 'knee', hair: C.black, hat: 'kerchief', hc: C.red } });
    P(56, 1270, 'f', 'a', 'stand', 1, { fr: 0.7, old: 1, w: { top: 'blouse', tc: C.black, bc: C.black, sk: 'ankle', shawl: C.black } });
    P(420, 1120, 'm', 'a', 'gesture', -1, { w: { top: 'jacket', tc: C.brown, bc: C.dark, hat: 'cap', must: 1 } });
    P(390, 1116, 'm', 'a', 'pocket', 1, { w: { top: 'shirt', tc: C.white, vest: C.dark, bc: C.mid, hat: 'bowler' } });

    function pushcart(x, y, goods, dir, umb) {
      crowdOp(y, (c) => {
        const s = figH(y) / 150, w = 150 * s, x0 = x - w / 2, top = y - 62 * s;
        const rr = FX(Math.round(x));
        line(c, x0 - 4 * s, top + 6 * s, x0 - 34 * s * dir * -1 - 4 * s, top - 2 * s, ink(0.9), 3 * s);
        fillP(c, [x0, top, x0 + w, top - 4 * s, x0 + w - 6 * s, top + 22 * s, x0 + 6 * s, top + 24 * s], css(sepify([126, 92, 60], 0.5)));
        strokeL(c, [x0, top, x0 + w, top - 4 * s, x0 + w - 6 * s, top + 22 * s, x0 + 6 * s, top + 24 * s, x0, top], ink(0.9), 1);
        c.save(); c.beginPath(); c.rect(x0, top - 4 * s, w, 30 * s); c.clip(); c.beginPath(); for (let k = 1; k < 4; k++) { c.moveTo(x0, top + k * 6 * s); c.lineTo(x0 + w, top + k * 6 * s - 1); } c.strokeStyle = ink(0.4); c.lineWidth = 0.6; c.stroke(); c.restore();
        for (const wx of [x0 + 26 * s, x0 + w - 26 * s]) { c.beginPath(); c.arc(wx, y - 20 * s, 20 * s, 0, TAU); c.strokeStyle = ink(0.9); c.lineWidth = 2.2 * s; c.stroke(); c.beginPath(); for (let a = 0; a < TAU; a += TAU / 10) { c.moveTo(wx, y - 20 * s); c.lineTo(wx + Math.cos(a) * 19 * s, y - 20 * s + Math.sin(a) * 19 * s); } c.lineWidth = 0.8 * s; c.stroke(); }
        for (let row = 0; row < 4; row++) for (let i = 0; i < 16 - row * 2; i++) {
          const fx = x0 + 10 * s + (i + row * 0.5) * 8.4 * s, fy = top - 3 * s - row * 6.5 * s + rr.u(-1, 1) * s;
          if (fx > x0 + w - 8 * s - row * 4 * s) continue;
          const g = goods === 'lemons' ? [222, 196, 86] : goods === 'peppers' ? (rr.c(0.6) ? [170, 60, 40] : [96, 112, 60]) : goods === 'melons' ? [170, 168, 104] : goods === 'onions' ? [214, 178, 130] : [200, 150, 90];
          c.beginPath(); c.ellipse(fx, fy, 4.4 * s * (goods === 'peppers' ? 0.7 : 1), 4 * s, rr.u(-0.5, 0.5), 0, TAU); c.fillStyle = css(sepify(g, 0.55)); c.fill(); c.strokeStyle = ink(0.55); c.lineWidth = 0.45; c.stroke();
        }
        if (umb) { line(c, x, top - 26 * s, x, top - 110 * s, ink(0.9), 1.4 * s); const u = [x - 70 * s, top - 82 * s, x, top - 120 * s, x + 70 * s, top - 82 * s, x, top - 92 * s]; fillP(c, u, css(sepify([214, 196, 160], 0.5))); c.save(); c.beginPath(); addP(c, u); c.clip(); c.beginPath(); for (let k = -6; k < 6; k += 2) { c.moveTo(x, top - 120 * s); c.lineTo(x + k * 12 * s, top - 76 * s); c.lineTo(x + (k + 1) * 12 * s, top - 76 * s); c.closePath(); } c.fillStyle = 'rgba(120,80,50,0.45)'; c.fill(); c.restore(); strokeL(c, u.concat([u[0], u[1]]), ink(0.85), 0.9); }
      });
      rsv.push([x - 80 * figH(y) / 150, x + 80 * figH(y) / 150, y - 18, y + 8]);
    }
    pushcart(150, 1176, 'peppers', 1, 1);
    pushcart(910, 1160, 'onions', -1, 0);
    pushcart(4190, 1236, 'melons', -1, 1);
    P(206, 1168, 'm', 'a', 'vendor', -1, { w: { top: 'shirt', tc: C.white, vest: C.dark, bc: C.dark, apron: true, hat: 'cap', must: 1 } });
    P(96, 1186, 'f', 'a', 'gesture', 1, { props: [{ t: 'basket', hand: 'f' }], w: { top: 'blouse', tc: C.cream, bc: C.black, sk: 'ankle', hat: 'kerchief', hc: C.white } });
    P(4262, 1226, 'm', 'a', 'vendor', -1, { w: { top: 'shirt', tc: C.cream, bc: C.dark, apron: true, hat: 'boater', must: 1 } });

    // slide 2 — the procession, moving right
    rsv.push([1140, 2140, 990, 1225]);
    const proc = [];
    // women in black shawls with candles, behind the statue
    for (let i = 0; i < 22; i++) {
      const row = i % 3, col = Math.floor(i / 3);
      const x = 1180 + col * 46 + row * 14 + R.u(-6, 6), y = 1050 + row * 42 + R.u(-4, 4);
      P(x, y, 'f', 'a', R.c(0.7) ? 'candle' : 'pray', 1, { fr: 0.35, old: R.c(0.4), props: [{ t: 'candle' }], lights: LIGHTS, w: { top: 'blouse', tc: C.black, bc: C.black, sk: 'ankle', shawl: R.p([C.black, C.black, [58, 44, 36]]) } });
    }
    P(1508, 1095, 'm', 'a', 'pray', 1, { fr: 0.4, props: [], w: { top: 'jacket', tc: C.black, bc: C.black, hat: null, hair: C.light, must: 1 }, old: 1 });
    P(1494, 1150, 'm', 'a', 'stand', 1, { fr: 0.4, props: [{ t: 'hat' }], w: { top: 'jacket', tc: C.dark, bc: C.dark, hat: null, hair: C.black, must: 1 } });
    // the statue on its platform, borne on the shoulders of eight men
    const ST = { x: 1630, y: 1150 };
    crowdOp(1100, (c) => {
      const rr = SV(9100);
      for (const dx of [-82, -26, 30, 84]) drawFig(c, { x: ST.x + dx - 10, y: 1102, h: figH(1102), dir: 1, fr: 0.3, sex: 'm', age: 'a', pose: POSE.pole, w: { top: 'shirt', tc: C.white, bc: C.dark, vest: C.black, must: rr.c(0.5) }, haze: 0.15, lx: -1 });
    });
    crowdOp(1152, (c) => {
      const x = ST.x, py = 1004, pw = 210;
      const rr = SV(9200);
      // poles
      line(c, x - pw / 2 - 40, py + 20, x + pw / 2 + 40, py + 20, ink(0.9), 4.5); line(c, x - pw / 2 - 40, py + 20, x + pw / 2 + 40, py + 20, 'rgba(200,160,110,0.6)', 1.5);
      // platform: gilded base with a fringed skirt
      const skirt = [x - pw / 2, py, x + pw / 2, py, x + pw / 2 + 4, py + 40, x - pw / 2 - 4, py + 40];
      fillP(c, skirt, css([170, 64, 44]));
      c.save(); c.beginPath(); addP(c, skirt); c.clip();
      c.beginPath(); for (let i = 0; i < 12; i++) { const sx = x - pw / 2 + i * pw / 11; c.moveTo(sx, py + 6); c.quadraticCurveTo(sx + pw / 22, py + 20, sx + pw / 11, py + 6); } c.strokeStyle = 'rgba(240,200,110,0.9)'; c.lineWidth = 1.2; c.stroke();
      hatch(c, RR(x - pw / 2, py, pw, 40), { ang: Math.PI / 2, sp: 2.4, lw: 0.4, col: ink(0.25), noclip: 1 });
      const g = c.createLinearGradient(0, py, 0, py + 40); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(30,14,8,0.4)'); c.fillStyle = g; c.fillRect(x - pw, py, pw * 2, 40);
      c.restore();
      c.beginPath(); for (let fx = x - pw / 2 - 4; fx < x + pw / 2 + 4; fx += 2.2) { c.moveTo(fx, py + 40); c.lineTo(fx + 0.4, py + 47); } c.strokeStyle = css([226, 176, 80]); c.lineWidth = 0.8; c.stroke();
      strokeL(c, skirt.concat([skirt[0], skirt[1]]), ink(0.85), 1);
      // gilded top rail
      rect(c, x - pw / 2 - 6, py - 10, pw + 12, 10, css([206, 160, 70]), ink(0.9), 1);
      c.beginPath(); for (let fx = x - pw / 2; fx < x + pw / 2; fx += 8) { c.moveTo(fx, py - 9); c.quadraticCurveTo(fx + 4, py - 1, fx + 8, py - 9); } c.strokeStyle = ink(0.55); c.lineWidth = 0.6; c.stroke();
      // flowers at the corners
      for (const fx of [x - pw / 2 + 12, x + pw / 2 - 12]) { for (let k = 0; k < 9; k++) { const a = -Math.PI / 2 + (k - 4) * 0.28, r = 16 + (k % 2) * 6; c.fillStyle = css(k % 3 ? [244, 238, 222] : [226, 196, 120]); c.beginPath(); c.ellipse(fx + Math.cos(a) * r, py - 12 + Math.sin(a) * r, 3.2, 2.2, a, 0, TAU); c.fill(); c.strokeStyle = ink(0.4); c.lineWidth = 0.4; c.stroke(); } }
      // candles at the four corners
      for (const fx of [x - pw / 2 + 2, x - pw / 2 + 32, x + pw / 2 - 32, x + pw / 2 - 2]) { rect(c, fx - 1.8, py - 48, 3.6, 38, css([246, 240, 224]), ink(0.6), 0.5); c.fillStyle = css(GOLD); c.beginPath(); c.ellipse(fx, py - 52, 1.8, 4, 0, 0, TAU); c.fill(); LIGHTS.push({ x: fx, y: py - 52, r: 20, a: 0.7 }); }
      // pedestal
      fillP(c, [x - 26, py - 10, x + 26, py - 10, x + 20, py - 28, x - 20, py - 28], css([196, 176, 140])); strokeL(c, [x - 26, py - 10, x - 20, py - 28, x + 20, py - 28, x + 26, py - 10], ink(0.8), 0.8);
      // San Rocco, painted plaster: a pilgrim's hat turned up in front, a staff with a gourd, a red cape sewn with
      // scallop shells, the robe lifted to show the plague sore on his thigh, and the dog that brought him bread
      const bx = x, by = py - 28;
      const S = (arr) => { const q = []; for (let i = 0; i < arr.length; i += 2) q.push(bx + arr[i], by + arr[i + 1]); return q; };
      const plaster = [226, 206, 164], capeC = [182, 78, 52], gilt = [222, 170, 70];
      const shapeIn = (q, col, sh) => { fillP(c, q, css(col)); if (sh) { c.save(); c.beginPath(); addP(c, q); c.clip(); hatch(c, RR(bx + sh, by - 220, 60, 230), { ang: 1.1, sp: 1.9, lw: 0.45, col: ink(0.42), noclip: 1 }); c.restore(); } strokeL(c, q.concat([q[0], q[1]]), ink(0.85), 0.9); };
      // halo behind the head
      c.save(); c.globalCompositeOperation = 'screen'; glowDot(c, bx, by - 176, 60, GLOW, 0.75); c.restore();
      c.beginPath(); c.arc(bx, by - 176, 30, 0, TAU); c.strokeStyle = css(gilt); c.lineWidth = 2.4; c.stroke();
      c.beginPath(); for (let a = 0; a < TAU; a += TAU / 32) { const r1 = 33, r2 = a % (TAU / 16) < 0.01 ? 46 : 40; c.moveTo(bx + Math.cos(a) * r1, by - 176 + Math.sin(a) * r1); c.lineTo(bx + Math.cos(a) * r2, by - 176 + Math.sin(a) * r2); } c.lineWidth = 1; c.stroke();
      // staff
      line(c, bx - 40, by + 2, bx - 37, by - 212, css([110, 76, 46]), 3.2); line(c, bx - 41.5, by + 2, bx - 38.5, by - 212, ink(0.8), 0.6); line(c, bx - 38.5, by + 2, bx - 35.5, by - 212, ink(0.8), 0.6);
      c.beginPath(); c.ellipse(bx - 33, by - 176, 5, 7, 0.2, 0, TAU); c.ellipse(bx - 34, by - 186, 3.4, 3.8, 0, 0, TAU); c.fillStyle = css([206, 160, 84]); c.fill(); c.strokeStyle = ink(0.8); c.lineWidth = 0.6; c.stroke();
      // bare right leg with the sore, and sandalled feet
      shapeIn(S([8, -50, 20, -52, 19, -8, 9, -6]), [232, 206, 174], 0);
      c.fillStyle = css(WARMRED, 0.9); c.beginPath(); c.ellipse(bx + 15, by - 38, 2.4, 3.4, 0, 0, TAU); c.fill();
      shapeIn(S([4, 0, 6, -7, 22, -7, 28, 0]), [120, 84, 54], 0); shapeIn(S([-24, 0, -22, -6, -6, -6, -2, 0]), [120, 84, 54], 0);
      // robe
      const robe = chaikin(S([-26, -2, -29, -50, -23, -100, -26, -130, -28, -146, -12, -155, 12, -155, 28, -146, 25, -128, 22, -100, 25, -64, 24, -52, 9, -46, 4, -2]), true, 1);
      shapeIn(robe, plaster, 4);
      c.beginPath(); for (const fx of [-16, -6, 2]) { c.moveTo(bx + fx, by - 98); c.quadraticCurveTo(bx + fx - 3, by - 50, bx + fx - 2, by - 4); } c.strokeStyle = ink(0.45); c.lineWidth = 0.7; c.stroke();
      strokeL(c, S([-26, -3, 4, -3]), css(gilt), 1.6); strokeL(c, S([4, -3, 9, -46, 24, -52]), css(gilt), 1.4);
      // rope belt with a hanging end
      strokeL(c, S([-23, -101, 0, -99, 22, -101]), css([150, 110, 64]), 1.8); strokeL(c, S([-6, -99, -8, -80, -5, -66]), css([150, 110, 64]), 1.4);
      // right arm lifting the robe, left arm holding the staff
      shapeIn(chaikin(S([22, -146, 34, -128, 30, -92, 24, -64, 17, -66, 20, -94, 22, -124]), true, 1), plaster, 18);
      c.fillStyle = css([232, 206, 174]); c.beginPath(); c.ellipse(bx + 21, by - 60, 4, 5, 0, 0, TAU); c.fill(); c.strokeStyle = ink(0.8); c.lineWidth = 0.6; c.stroke();
      shapeIn(chaikin(S([-22, -146, -34, -136, -40, -118, -36, -108, -30, -112, -27, -128]), true, 1), plaster, 0);
      c.fillStyle = css([232, 206, 174]); c.beginPath(); c.ellipse(bx - 37.5, by - 112, 4, 5, 0, 0, TAU); c.fill(); c.stroke();
      // cape with shells
      const cape = chaikin(S([-32, -122, -31, -146, -14, -157, 14, -157, 31, -146, 33, -122, 12, -116, -10, -116]), true, 1);
      shapeIn(cape, capeC, 6);
      strokeL(c, cape.slice(0, 2).concat(cape.slice(-16)), css(gilt), 1.2);
      for (const [sx2, sy2] of [[-15, -136], [15, -134], [0, -128]]) { c.beginPath(); c.moveTo(bx + sx2 - 4.5, by + sy2); c.arc(bx + sx2, by + sy2, 4.5, Math.PI, 0); c.lineTo(bx + sx2, by + sy2 + 5); c.closePath(); c.fillStyle = css([246, 238, 216]); c.fill(); c.strokeStyle = ink(0.7); c.lineWidth = 0.5; c.stroke(); c.beginPath(); for (let k = -2; k <= 2; k++) { c.moveTo(bx + sx2, by + sy2 + 4.5); c.lineTo(bx + sx2 + k * 2, by + sy2 - 3.5); } c.stroke(); }
      // head, beard, hat
      shapeIn(chaikin(S([-5, -152, 5, -152, 5, -160, -5, -160]), true, 1), [226, 198, 164], 0);
      c.beginPath(); c.ellipse(bx, by - 170, 9.5, 12, 0, 0, TAU); c.fillStyle = css([234, 208, 176]); c.fill(); c.strokeStyle = ink(0.85); c.lineWidth = 0.8; c.stroke();
      shapeIn(chaikin(S([-9, -170, -8, -160, 0, -150, 8, -160, 9, -170, 6, -164, 0, -162, -6, -164]), true, 1), [120, 84, 54], 0);
      c.fillStyle = ink(0.8); c.beginPath(); c.ellipse(bx - 3.6, by - 172, 1.3, 0.8, 0, 0, TAU); c.ellipse(bx + 3.6, by - 172, 1.3, 0.8, 0, 0, TAU); c.fill();
      strokeL(c, S([-6, -176, -1.5, -175.5]), ink(0.6), 0.6); strokeL(c, S([1.5, -175.5, 6, -176]), ink(0.6), 0.6); strokeL(c, S([0, -172, -1, -166, 1, -166]), ink(0.55), 0.6);
      c.beginPath(); c.ellipse(bx, by - 181, 26, 6, 0, 0, TAU); c.fillStyle = css([150, 108, 66]); c.fill(); c.strokeStyle = ink(0.85); c.lineWidth = 0.9; c.stroke();
      shapeIn(chaikin(S([-9, -182, -8, -192, 0, -195, 8, -192, 9, -182]), true, 1), [140, 100, 62], 0);
      shapeIn(chaikin(S([-18, -182, -16, -196, 0, -201, 16, -196, 18, -182, 0, -186]), true, 1), [162, 120, 74], 0);
      c.beginPath(); c.moveTo(bx - 4.5, by - 190); c.arc(bx, by - 190, 4.5, Math.PI, 0); c.lineTo(bx, by - 185); c.closePath(); c.fillStyle = css([246, 238, 216]); c.fill(); c.strokeStyle = ink(0.7); c.lineWidth = 0.5; c.stroke();
      // the dog with a loaf in its mouth
      const dx = bx + 46, dy = by;
      const dog = chaikin([dx - 16, dy, dx - 15, dy - 13, dx - 3, dy - 17, dx + 7, dy - 17, dx + 11, dy - 28, dx + 19, dy - 27, dx + 21, dy - 19, dx + 15, dy - 12, dx + 13, dy, dx + 9, dy, dx + 7, dy - 9, dx - 6, dy - 9, dx - 9, dy], true, 1);
      shapeIn(dog, [222, 204, 170], 0);
      strokeL(c, [dx - 15, dy - 12, dx - 22, dy - 20], ink(0.8), 1.6);
      rect(c, dx + 18, dy - 23, 8, 5, css([196, 146, 84]), ink(0.6), 0.5);
      // ribbons from the saint's shoulders and hands, heavy with pinned dollar bills
      const rib = [[28, -142, 104, 40, 34, 1], [-28, -142, -106, 40, 30, 0], [22, -92, 66, 74, 26, 0], [-24, -104, -70, 80, 22, 1], [30, -120, 140, 64, 46, 0]];
      for (const [x0, y0, x1, y1, sg, red] of rib) {
        const p = sag(bx + x0, by + y0, bx + x1, by + y1, sg, 30);
        c.beginPath(); addL(c, p); c.strokeStyle = css(red ? WARMRED : gilt); c.lineWidth = 3.6; c.lineCap = 'butt'; c.stroke(); c.strokeStyle = ink(0.55); c.lineWidth = 0.5; c.stroke();
        const q = along(p, 10.5, 6);
        for (let i = 0; i < q.length; i += 2) {
          const j = Math.min(p.length - 4, Math.floor(i / q.length * p.length / 2) * 2), ang = Math.atan2(p[j + 3] - p[j + 1], p[j + 2] - p[j]) + rr.u(-0.5, 0.5) + Math.PI / 2;
          c.save(); c.translate(q[i], q[i + 1]); c.rotate(ang); rect(c, -3, -6, 6.4, 12.5, css(mix(C.sage, [236, 232, 210], rr.u(0, 0.35))), ink(0.75), 0.5); c.strokeStyle = ink(0.4); c.lineWidth = 0.35; c.strokeRect(-1.8, -4.6, 3.8, 9.2); c.beginPath(); c.ellipse(0.2, 0, 1.2, 1.6, 0, 0, TAU); c.stroke(); c.restore();
        }
      }
      // front bearers
      for (const dx2 of [-96, -40, 22, 78]) drawFig(c, { x: x + dx2, y: 1150, h: figH(1150), dir: 1, fr: 0.3, sex: 'm', age: 'a', pose: POSE.pole, w: { top: 'shirt', tc: C.white, bc: C.dark, vest: rr.c(0.6) ? C.black : null, braces: 1, must: rr.c(0.6), hat: null, hair: C.black }, haze: 0.05, lx: -1 });
    });
    P(1752, 1112, 'm', 'a', 'point', -1, { na: [2.6, 2.5], props: [], w: { top: 'jacket', tc: C.brown, bc: C.dark, hat: 'fedora', hc: C.mid, must: 1 } });   // pinning a bill
    P(1520, 1205, 'f', 'a', 'armsUp', 1, { na: [2.4, 2.8], fa: [2.2, 2.6], props: [], w: { top: 'blouse', tc: C.cream, bc: C.dark, sk: 'ankle', hat: 'kerchief', hc: C.white } }); // holding up a baby
    // priests, the cross, the altar boys
    P(1800, 1090, 'm', 'a', 'walk', 1, { fr: 0.35, props: [{ t: 'cross' }], lights: LIGHTS, na: { to: [0.5, -0.3], bend: -1 }, w: { top: 'surplice', tc: C.white, rc: C.black, hat: null, hair: C.dark } });
    P(1786, 1150, 'm', 'a', 'pray', 1, { fr: 0.35, w: { top: 'surplice', tc: C.white, rc: C.black, hat: 'biretta', hair: C.light }, old: 1 });
    P(1842, 1130, 'm', 'c', 'walk', 1, { props: [{ t: 'censer' }], w: { top: 'surplice', tc: C.white, rc: [150, 50, 36], hair: C.dark } });
    // children in white for their first communion
    for (let i = 0; i < 8; i++) {
      const row = i % 2, x = 1880 + Math.floor(i / 2) * 26 + row * 12, y = 1095 + row * 40;
      const girl = i % 3 !== 1;
      P(x, y, girl ? 'f' : 'm', 'c', 'candle', 1, { fr: 0.4, props: [{ t: 'candle' }], lights: LIGHTS, w: girl ? { top: 'dress', tc: C.white, sk: 'knee', hat: 'veil', hair: C.dark, stock: C.white, shoe: C.white } : { top: 'jacket', tc: C.white, bc: C.white, stock: C.white, hair: C.black, shirt: C.white, tie: false } });
    }
    // the band
    const band = [[1996, 1080, 'tuba'], [2026, 1078, 'trumpet'], [2056, 1082, 'trombone'], [1990, 1130, 'bassdrum'], [2024, 1132, 'trumpet'], [2058, 1134, 'clarinet'], [2090, 1100, 'snare'], [2112, 1142, 'baton']];
    for (const [x, y, ins] of band) {
      const pose = ins === 'tuba' ? 'tuba' : ins === 'trumpet' || ins === 'trombone' ? 'trumpet' : ins === 'clarinet' ? 'trumpet' : ins === 'bassdrum' || ins === 'snare' ? 'drum' : 'gesture';
      P(x, y, 'm', 'a', pose, 1, { fr: 0.3, props: [{ t: ins }], w: { top: 'uniform', tc: [56, 54, 66], bc: [56, 54, 66], hat: 'kepi', hc: [56, 54, 66], must: 1, badge: 1, shirt: C.white, tie: false } });
    }
    // spectators on the far sidewalk of slide 2 face the road
    // foreground spectators, backs to us

    // slide 3 — the market
    rsv.push([2196, 2480, 1180, 1400]);
    crowdOp(1262, (c) => {
      // the fruit stand: a pushcart heaped with oranges, under a striped umbrella
      const x0 = 2236, x1 = 2468, y = 1262, top = 1170;
      const rr = SV(9300);
      // umbrella
      line(c, 2360, top - 10, 2356, 955, ink(0.9), 2);
      const um = [2232, 993, 2356, 940, 2482, 991, 2420, 1005, 2356, 1010, 2292, 1005];
      fillP(c, um, css([230, 214, 184]));
      c.save(); c.beginPath(); addP(c, um); c.clip(); c.beginPath(); for (let k = 0; k < 8; k++) { const a = lerp(2232, 2482, k / 8); c.moveTo(2356, 940); c.lineTo(a, 1015); c.lineTo(a + 15.6, 1015); c.closePath(); } c.fillStyle = css(WARMRED, 0.75); c.fill(); c.restore();
      strokeL(c, um.concat([um[0], um[1]]), ink(0.85), 1);
      // cart body
      const body = [x0, top, x1, top, x1 - 6, y - 30, x0 + 6, y - 30];
      fillP(c, body, css([122, 88, 58])); strokeL(c, body.concat([x0, top]), ink(0.9), 1.1);
      c.save(); c.beginPath(); addP(c, body); c.clip(); c.beginPath(); for (let yy = top + 8; yy < y - 30; yy += 8) { c.moveTo(x0, yy); c.lineTo(x1, yy); } c.strokeStyle = ink(0.4); c.lineWidth = 0.6; c.stroke(); c.restore();
      text(c, 'FRUTTA FRESCA', (x0 + x1) / 2, top + 24, 11, { col: css([238, 206, 130]), lw: 1.7 });
      // wheels
      for (const wx of [x0 + 36, x1 - 36]) { c.beginPath(); c.arc(wx, y - 22, 22, 0, TAU); c.strokeStyle = ink(0.9); c.lineWidth = 2.4; c.stroke(); c.beginPath(); for (let a = 0; a < TAU; a += TAU / 10) { c.moveTo(wx, y - 22); c.lineTo(wx + Math.cos(a) * 21, y - 22 + Math.sin(a) * 21); } c.lineWidth = 0.9; c.stroke(); }
      // the heaps: oranges, lemons, grapes
      const fruit = (fx, fy, r, colr) => { c.beginPath(); c.arc(fx, fy, r, 0, TAU); c.fillStyle = css(colr); c.fill(); c.strokeStyle = 'rgba(80,30,10,0.6)'; c.lineWidth = 0.5; c.stroke(); c.fillStyle = 'rgba(255,246,214,0.6)'; c.beginPath(); c.arc(fx - r * 0.35, fy - r * 0.35, r * 0.3, 0, TAU); c.fill(); };
      for (let row = 0; row < 6; row++) {
        const yy = top - 4 - row * 9.5, n = 22 - row * 3;
        for (let i = 0; i < n; i++) { const fx = x0 + 10 + (i + row * 0.5) * 10 + rr.u(-1, 1); if (fx > x1 - 10 - row * 6) continue; const isL = fx > x0 + 150 && fx < x0 + 190 && row < 3; fruit(fx, yy + rr.u(-1, 1), 5.2, isL ? [226, 200, 84] : mix(ORANGE, [250, 160, 50], rr.r() * 0.4)); }
      }
      for (let i = 0; i < 8; i++) { c.fillStyle = css([110, 70, 90]); c.beginPath(); c.arc(x1 - 30 + (i % 3) * 5, top - 8 - Math.floor(i / 3) * 5, 2.6, 0, TAU); c.fill(); }
      // a little price card stuck in the heap
      rect(c, x0 + 88, top - 70, 26, 14, css([244, 238, 222]), ink(0.7), 0.6); text(c, '5¢', x0 + 101, top - 63, 7, { col: ink(0.9), lw: 1 });
      // a hanging scale
      line(c, 2312, 1004, 2312, 1112, ink(0.9), 0.8); c.beginPath(); c.arc(2312, 1118, 6, 0, TAU); c.fillStyle = css([220, 206, 180]); c.fill(); c.strokeStyle = ink(0.8); c.lineWidth = 0.8; c.stroke(); c.beginPath(); c.moveTo(2302, 1132); c.quadraticCurveTo(2312, 1140, 2322, 1132); c.stroke(); line(c, 2306, 1124, 2302, 1132, ink(0.8), 0.5); line(c, 2318, 1124, 2322, 1132, ink(0.8), 0.5);
      LIGHTS.push({ x: 2356, y: 1150, r: 140, a: 0.25 });
    });
    P(2318, 1176, 'm', 'a', 'vendor', 1, { old: 1, fr: 0.6, w: { top: 'shirt', tc: C.white, vest: C.black, bc: C.dark, apron: true, hat: 'cap', hc: C.mid, must: 1, hair: C.light } });
    P(2214, 1300, 'f', 'a', 'gesture', 1, { props: [{ t: 'basket', hand: 'f', fruit: 1 }], w: { top: 'blouse', tc: C.cream, bc: C.black, sk: 'ankle', hat: 'kerchief', hc: C.red } });
    P(2488, 1318, 'm', 'c', 'reach', -1, { w: { top: 'shirt', tc: C.cream, bc: C.mid, hat: 'cap', hc: C.dark } }); // a boy stealing an orange
    // the single full-colour orange, rolled loose onto the cobbles
    crowdOp(1336, (c) => { if (window.FamilyOrange) window.FamilyOrange.drawOrange(c, 2522, 1322, 12); });
    // sausage cart
    rsv.push([2540, 2700, 1060, 1130]);
    crowdOp(1112, (c) => {
      const x = 2610, y = 1112;
      rect(c, x - 44, y - 54, 88, 30, css([120, 86, 58]), ink(0.9), 1);
      text(c, 'SALSICCE', x, y - 39, 9, { col: css([240, 210, 140]), lw: 1.4 });
      for (const wx of [x - 30, x + 30]) { c.beginPath(); c.arc(wx, y - 14, 13, 0, TAU); c.strokeStyle = ink(0.9); c.lineWidth = 1.8; c.stroke(); }
      rect(c, x - 40, y - 64, 60, 10, css([40, 30, 24]));
      c.save(); c.globalCompositeOperation = 'screen'; glowDot(c, x - 10, y - 64, 40, [255, 160, 80], 0.6); c.restore();
      for (let i = 0; i < 7; i++) { c.fillStyle = css([150, 80, 50]); c.beginPath(); c.ellipse(x - 34 + i * 8, y - 66, 3.5, 1.6, 0, 0, TAU); c.fill(); }
      c.beginPath(); c.moveTo(x - 10, y - 70); c.bezierCurveTo(x - 30, y - 110, x + 10, y - 130, x - 20, y - 180); c.moveTo(x, y - 70); c.bezierCurveTo(x + 20, y - 110, x - 14, y - 150, x + 14, y - 190); c.strokeStyle = 'rgba(236,226,206,0.5)'; c.lineWidth = 6; c.stroke(); c.strokeStyle = 'rgba(120,100,80,0.25)'; c.lineWidth = 0.6; c.stroke();
      LIGHTS.push({ x: x - 10, y: y - 64, r: 50, a: 0.4, col: [255, 170, 90] });
    });
    P(2668, 1100, 'm', 'a', 'vendor', -1, { w: { top: 'shirt', tc: C.white, bc: C.dark, apron: true, bib: 1, hat: 'chef', must: 1 } });
    P(2556, 1124, 'm', 'a', 'eat', 1, { props: [{ t: 'food', red: 1 }], w: { top: 'jacket', tc: C.mid, bc: C.dark, hat: 'boater' } });
    P(2534, 1128, 'f', 'a', 'eat', 1, { props: [{ t: 'food' }], w: { top: 'dress', tc: C.rust, sk: 'calf', hair: C.black } });
    // zeppole stand
    rsv.push([2840, 3000, 1100, 1165]);
    crowdOp(1150, (c) => {
      const x = 2920, y = 1150;
      rect(c, x - 50, y - 50, 100, 50, css([132, 98, 66]), ink(0.9), 1);
      text(c, 'ZEPPOLE', x, y - 34, 10, { col: css([240, 210, 140]), lw: 1.5 });
      c.beginPath(); c.ellipse(x + 20, y - 58, 22, 7, 0, 0, TAU); c.fillStyle = css([60, 44, 34]); c.fill(); c.strokeStyle = ink(0.9); c.lineWidth = 1; c.stroke();
      fillP(c, [x - 2, y - 58, x + 42, y - 58, x + 38, y - 50, x + 2, y - 50], css([60, 44, 34]));
      c.save(); c.globalCompositeOperation = 'screen'; glowDot(c, x + 20, y - 46, 36, [255, 150, 70], 0.55); c.restore();
      for (let i = 0; i < 9; i++) { c.beginPath(); c.arc(x - 42 + (i % 5) * 9, y - 56 - Math.floor(i / 5) * 6, 4, 0, TAU); c.fillStyle = css([210, 160, 96]); c.fill(); c.fillStyle = css(C.white); c.beginPath(); c.arc(x - 43 + (i % 5) * 9, y - 58 - Math.floor(i / 5) * 6, 1.6, 0, TAU); c.fill(); }
      c.beginPath(); c.moveTo(x + 18, y - 64); c.bezierCurveTo(x + 6, y - 100, x + 34, y - 120, x + 16, y - 160); c.strokeStyle = 'rgba(236,226,206,0.5)'; c.lineWidth = 5; c.stroke();
      LIGHTS.push({ x: x + 20, y: y - 50, r: 50, a: 0.4, col: [255, 170, 90] });
    });
    P(2958, 1140, 'm', 'a', 'vendor', -1, { w: { top: 'shirt', tc: C.white, bc: C.dark, apron: true, hat: 'chef', must: 1 }, fr: 0.5 });
    P(2876, 1180, 'm', 'c', 'eat', 1, { props: [{ t: 'zeppola' }], w: { top: 'shirt', tc: C.cream, bc: C.mid, hat: 'cap' } });
    P(2898, 1186, 'f', 'c', 'stand', 1, { na: [1.0, 1.6], w: { top: 'dress', tc: C.light, sk: 'knee', hair: C.dark } });
    // the medal seller
    P(3110, 1236, 'm', 'a', 'stand', -1, { fr: 0.6, props: [{ t: 'tray' }], w: { top: 'jacket', tc: C.mid, bc: C.dark, hat: 'bowler', hc: C.black, must: 1 }, old: 1 });
    P(3074, 1244, 'f', 'a', 'gesture', 1, { props: [{ t: 'medal' }], w: { top: 'blouse', tc: C.black, bc: C.black, sk: 'ankle', shawl: C.black }, old: 1 });
    // the balloon man
    crowdOp(1060, (c) => {
      const x = 2440, y = 1060, h = figH(y), top = y - h;
      const rr = SV(9400);
      const bl = [];
      for (let i = 0; i < 9; i++) bl.push([x + rr.u(-26, 26), top - 50 - rr.u(0, 46), rr.u(7, 10)]);
      c.beginPath(); for (const [bx, by] of bl) { c.moveTo(x + 8, top + 26); c.quadraticCurveTo(x + 4, (by + top) / 2, bx, by); } c.strokeStyle = ink(0.5); c.lineWidth = 0.5; c.stroke();
      for (const [bx, by, r] of bl) { c.beginPath(); c.ellipse(bx, by, r * 0.85, r, 0, 0, TAU); c.fillStyle = css(rr.p([WARMRED, GOLD, [236, 226, 200], [200, 120, 70], [140, 150, 120]]), 0.92); c.fill(); c.strokeStyle = ink(0.6); c.lineWidth = 0.6; c.stroke(); c.fillStyle = 'rgba(255,250,230,0.6)'; c.beginPath(); c.arc(bx - r * 0.3, by - r * 0.35, r * 0.22, 0, TAU); c.fill(); }
    });
    P(2448, 1060, 'm', 'a', 'stand', 1, { na: { to: [0.35, -0.1], bend: -1 }, w: { top: 'jacket', tc: C.slate, bc: C.dark, hat: 'bowler', must: 1 } });
    // the pickpocket and his mark, who is watching the fireworks
    P(3040, 1090, 'm', 'a', 'point', 1, { w: { top: 'jacket', tc: C.dark, bc: C.mid, hat: 'boater', must: 1 } });
    P(3016, 1094, 'm', 'c', 'reach', 1, { na: [1.1, 0.7], w: { top: 'shirt', tc: C.mid, bc: C.dark, hat: 'cap', hc: C.black } });
    // a couple kissing in the shadow of the arch's pillar
    P(2486, 990, 'm', 'a', 'hug', 1, { fr: 0.2, w: { top: 'jacket', tc: C.black, bc: C.dark, hat: 'fedora' } });
    P(2504, 990, 'f', 'a', 'hug', -1, { fr: 0.2, tilt: -0.25, w: { top: 'dress', tc: C.cream, sk: 'calf', hair: C.black } });

    // slide 4 — Fanucci
    rsv.push([3410, 3820, 1190, 1400]);
    rsv.push([3250, 3460, 1080, 1150]);
    P(3300, 1104, 'm', 'a', 'accordion', 1, { fr: 0.6, props: [{ t: 'accordion' }], w: { top: 'shirt', tc: C.white, vest: C.red, bc: C.dark, hat: 'cap', must: 1 } });
    P(3362, 1120, 'f', 'a', 'dance', -1, { fr: 0.5, props: [{ t: 'tambourine' }], w: { top: 'blouse', tc: C.white, bc: C.red, sk: 'calf', hat: 'kerchief', hc: C.gold } });
    P(3410, 1116, 'm', 'a', 'dance2', -1, { fr: 0.5, w: { top: 'shirt', tc: C.cream, vest: C.black, bc: C.dark, hat: 'cap', must: 1 } });
    P(3274, 1138, 'f', 'c', 'stand', 1, { w: { top: 'dress', tc: C.white, sk: 'knee', hair: C.dark } });
    P(3440, 1140, 'm', 'a', 'gesture', -1, { w: { top: 'shirt', tc: C.white, braces: 1, bc: C.mid, hat: 'boater' } });
    // Fanucci himself
    const FAN = P(3624, 1328, 'm', 'a', 'stroll', 1, { hs: 1.14, fr: 0.5, belly: 1.55, broad: 1.12, props: [{ t: 'cigar' }], haze: 0, w: { top: 'jacket', tc: [242, 236, 220], bc: [238, 230, 212], hat: 'fedora', hc: [232, 214, 172], band: [70, 50, 36], must: 1, shirt: [250, 246, 236], tiec: [120, 40, 30], chain: 1, shoe: [120, 90, 60] } });
    FAN.fan = 1;
    P(3538, 1172, 'm', 'a', 'stand', 1, { fr: 0.3, w: { top: 'jacket', tc: C.black, bc: C.black, hat: 'fedora', hc: C.black, must: 1 } });
    P(3566, 1176, 'm', 'a', 'gesture', -1, { fr: 0.3, w: { top: 'jacket', tc: C.dark, bc: C.black, hat: 'bowler', hc: C.black } });
    P(3626, 1170, 'f', 'a', 'pray', 1, { fr: 0.5, old: 1, w: { top: 'blouse', tc: C.black, bc: C.black, sk: 'ankle', shawl: C.black } });
    P(3662, 1178, 'm', 'a', 'behind', -1, { fr: 0.2, w: { top: 'coat', tc: C.black, bc: C.black, hat: 'cap', hc: C.black, must: 1 } });
    P(3462, 1262, 'f', 'a', 'walk', -1, { props: [], na: [0.6, 0.9], w: { top: 'blouse', tc: C.cream, bc: C.dark, sk: 'ankle', shawl: C.dark } });
    P(3436, 1276, 'm', 'c', 'walk', -1, { na: [0.9, 1.1], tilt: -0.2, w: { top: 'shirt', tc: C.white, bc: C.mid, hat: 'cap' } });
    P(3790, 1268, 'm', 'a', 'stand', -1, { props: [{ t: 'hat' }], na: { to: [0.5, 0.8], bend: -1 }, pose: Object.assign({}, POSE.stand, { lean: 0.16, tilt: 0.3 }), w: { top: 'jacket', tc: C.dark, bc: C.dark, hair: C.black, must: 1 } });
    P(3712, 1182, 'm', 'a', 'stand', -1, { fr: 0.25, tilt: 0.3, w: { top: 'jacket', tc: C.dark, bc: C.dark, hat: 'cap', hc: C.black } });
    P(3838, 1160, 'm', 'a', 'eat', 1, { props: [{ t: 'zeppola' }], hs: 1.04, w: { top: 'coat', tc: [52, 52, 66], bc: [52, 52, 66], hat: 'kepi', hc: [52, 52, 66], badge: 1, must: 1 } }); // the cop, looking away
    P(3762, 914, 'm', 'a', 'hug', 1, { fr: 0.2, w: { top: 'jacket', tc: C.dark, bc: C.dark, hat: 'cap' } });
    P(3780, 914, 'f', 'a', 'hug', -1, { fr: 0.2, tilt: -0.25, w: { top: 'blouse', tc: C.white, bc: C.dark, sk: 'ankle', hair: C.black } });
    P(4120, 922, 'f', 'a', 'sit', -1, { old: 1, w: { top: 'blouse', tc: C.black, bc: C.black, sk: 'ankle', shawl: C.black } });
    crowdOp(921, (c) => { line(c, 4112, 905, 4112, 922, ink(0.8), 1); line(c, 4128, 910, 4128, 922, ink(0.8), 1); rect(c, 4108, 906, 22, 3, css([110, 80, 56]), ink(0.8), 0.5); });
    P(4190, 1030, 'm', 'a', 'gesture', 1, { w: { top: 'shirt', tc: C.white, vest: C.black, bc: C.dark, hat: 'fedora', must: 1 } });
    P(4236, 1034, 'm', 'a', 'shrug', -1, { w: { top: 'jacket', tc: C.brown, bc: C.dark, hat: 'cap', must: 1 } });
    P(4074, 1318, 'm', 'c', 'run', -1, { w: { top: 'shirt', tc: C.cream, bc: C.mid, hat: 'cap' } });
    P(4250, 1330, 'm', 'a', 'walk', -1, { fr: 0.4, w: { top: 'jacket', tc: C.dark, bc: C.dark, hat: 'fedora', hc: C.mid, must: 1 } });
    P(4290, 1318, 'f', 'a', 'walk', -1, { w: { top: 'dress', tc: C.slate, sk: 'calf', hat: 'kerchief', hc: C.white } });
    rsv.push([3940, 4080, 905, 935]);

    // the filler crowd, in rows from the far sidewalk to the front edge, gathered in clumps with breathing space between
    const rows = []; for (let y = 914; y < 1390; y += figH(y) * 0.15) rows.push(y);
    const dens = (x, y) => {
      let d = x < 1080 ? 0.32 + (x / 1080) * 0.3 : x < 2160 ? 0.78 : x < 3240 ? 0.92 : 0.74 - (x - 3240) / 1080 * 0.36;
      if (y > 1200) d *= 0.42; else if (y > 1120) d *= 0.7;
      if (x > 1140 && x < 2140 && y < 1000) d = 1;
      d *= 0.62 + 0.38 * Math.sin(x * 0.0105 + y * 0.041) * Math.sin(x * 0.0043 - y * 0.02 + 1.3) + 0.2;
      return clamp(d, 0, 1);
    };
    const rf = FX(9500);
    const blocked = (x, y, h) => rsv.some((r) => x > r[0] - h * 0.12 && x < r[1] + h * 0.12 && y > r[2] && y < r[3]) || (Math.abs(y - ARCH.yb) < 14 && (Math.abs(x - (ARCH.cx - ARCH.w / 2 + 20)) < 30 || Math.abs(x - (ARCH.cx + ARCH.w / 2 - 20)) < 30));
    const pickPose = (x, y, rf) => {
      if (y < 1000 && !(x > 1140 && x < 2140)) return rf.p(['stand', 'stand2', 'walk', 'walk2', 'gesture', 'pocket', 'behind', 'hips', 'walk', 'hold', 'stand']);
      if (x > 1140 && x < 2140) return rf.p(['stand', 'stand', 'pray', 'stand2', 'lookup', 'stand2', 'behind', 'hips', 'pray', 'wave', 'pocket', 'stand']);
      if (x > 2300 && x < 3300) return rf.p(['lookup', 'stand', 'walk', 'walk2', 'gesture', 'eat', 'stand2', 'lookup', 'hold', 'walk', 'point', 'hips', 'behind']);
      if (x > 3440 && x < 3800) return rf.p(['stand', 'stand2', 'behind', 'walk2', 'pocket']);
      return rf.p(['stand', 'stand2', 'walk', 'walk2', 'walk', 'gesture', 'pocket', 'behind', 'hips', 'stand', 'walk']);
    };
    for (const y0 of rows) {
      const h = figH(y0);
      let x = rf.u(-10, 30);
      while (x < W + 10) {
        const y = y0 + rf.u(-2, 2) * h / 60;
        const d = dens(x, y);
        x += h * 0.4 / Math.max(0.15, d) * rf.u(0.6, 1.4);
        if (rf.r() > d * 1.15) continue;
        if (blocked(x, y, h)) continue;
        const r = rf.r();
        const sex = rf.c(0.5) ? 'f' : 'm', age = r < 0.15 ? 'c' : 'a';
        const inProc = x > 1140 && x < 2140;
        let dir = rf.c(0.5) ? 1 : -1, pose = pickPose(x, y, rf);
        const props = [];
        if (inProc) { dir = y < 1040 ? (rf.c(0.8) ? (x < 1640 ? 1 : -1) : -dir) : -1; if (pose === 'wave') props.push({ t: 'hanky' }); }
        else if (x > 3440 && x < 3800) dir = x < 3606 ? (rf.c(0.6) ? -1 : 1) : -1;
        if (pose === 'eat') props.push({ t: rf.c(0.5) ? 'zeppola' : 'food', red: rf.c(0.5) });
        const extra = { fr: rf.u(0.2, 0.85), props, turn: rf.c(0.15) };
        if (age === 'a' && sex === 'f' && rf.c(0.1)) { pose = 'carry'; props.push({ t: 'child', col: rf.p([C.white, C.cream, C.light]) }); }
        else if (age === 'a' && sex === 'f' && rf.c(0.08)) props.push({ t: 'basket', hand: 'f', fruit: rf.c(0.4) });
        if (age === 'a' && sex === 'm' && rf.c(0.05) && y < 1100) { props.push({ t: 'shoulders', col: rf.p([C.white, C.cream]) }); pose = 'stand'; }
        if (y > 1200) extra.back = rf.c(0.4) ? 1 : 0;
        P(x, y, sex, age, pose, dir, extra, SV(Math.round(x * 13 + y)));
        // couples walking arm in arm
        if (!inProc && age === 'a' && rf.c(0.12)) {
          const x2 = x - dir * h * 0.15;
          if (!blocked(x2, y, h)) { const last = FIG[FIG.length - 1]; last.sex = 'm'; last.w = dress(SV(Math.round(x * 5 + y)), 'm', 'a'); last.pose = POSE.walk; last.na = { to: [0.5, 1.05], bend: -1 }; last.dir = dir; P(x2, y - 1, 'f', 'a', 'walk2', dir, { fr: last.fr, na: { to: [0.75, 0.95], bend: -1 } }, SV(Math.round(x2 * 9 + y))); }
        } else if (!inProc && age === 'a' && sex === 'm' && rf.c(0.05)) { const last = FIG[FIG.length - 1]; last.pose = POSE.pole; last.props = [{ t: 'sack' }]; }
        // conversations: a second person turned toward the first
        else if (!inProc && rf.c(0.2) && age === 'a') {
          const x2 = x + dir * h * 0.24;
          if (!blocked(x2, y, h)) P(x2, y + rf.u(-1, 2), rf.c(0.5) ? 'f' : 'm', 'a', rf.p(['gesture', 'stand', 'shrug', 'hips']), -dir, { fr: rf.u(0.15, 0.5) }, SV(Math.round(x2 * 11 + y)));
        }
      }
    }
    console.log('[festa] people: ' + FIG.length);
    for (const b of BLD) if (!b.church && !b.tower && !b.alley) { const cl = cols(b); for (const x of cl.xs) for (const sx of SEAMS) if (Math.abs(x - sx) < cl.ww / 2 + 3) console.log('[festa] window on seam', b.store.sign, x); }
    for (const f of FIG) for (const sx of SEAMS) if (Math.abs(f.x - sx) < f.h * 0.25) console.log('[festa] seam risk', Math.round(f.x), Math.round(f.y), Math.round(f.h));
    // large figures cut by the bottom edge, close to us: they frame the scene and give it depth
    P(420, 1530, 'm', 'a', 'stand', 1, { hs: 1.5, back: 1, fr: 0.92, haze: 0, props: [{ t: 'shoulders', col: C.white, sex: 'm' }], w: { top: 'shirt', tc: C.cream, vest: C.black, bc: C.dark, hat: 'cap', hc: [70, 56, 44], hair: C.black }, noShadow: 1 });
    P(1205, 1540, 'f', 'a', 'walk2', 1, { hs: 1.45, fr: 0.3, haze: 0, props: [{ t: 'headBasket', fruit: ORANGE }], na: [2.75, 3.25], w: { top: 'blouse', tc: C.white, bc: C.black, sk: 'ankle', hat: 'kerchief', hc: C.red, hair: C.black }, noShadow: 1 });
    P(3138, 1540, 'm', 'a', 'eat', -1, { hs: 1.45, fr: 0.3, haze: 0, props: [{ t: 'food', red: 1 }], w: { top: 'jacket', tc: C.mid, bc: C.dark, hat: 'boater', must: 1, shirt: C.white }, noShadow: 1 });
    P(4206, 1530, 'f', 'a', 'carry', -1, { hs: 1.45, fr: 0.35, haze: 0, old: 1, props: [{ t: 'child', col: C.white }], w: { top: 'blouse', tc: C.black, bc: C.black, sk: 'ankle', shawl: C.black }, noShadow: 1 });
    // people sitting out on the stoops, and a man leaning on a cart
    for (const b of BLD) {
      if (!b.store || !b.store.ent || b.fanucci) continue;
      const ex = b.store.ent === 'L' ? b.x0 + 30 : b.store.ent === 'R' ? b.x1 - 30 : (b.x0 + b.x1) / 2;
      if (hf(Math.round(ex)) < 0.35 || nearSeam(ex, 30)) continue;
      const sd = hf(Math.round(ex) + 3) < 0.5 ? -1 : 1, sex = hf(Math.round(ex) + 5) < 0.55 ? 'f' : 'm';
      P(ex + sd * 12, 918, sex, hf(Math.round(ex) + 7) < 0.3 ? 'c' : 'a', 'sitTalk', -sd, { fr: 0.5, noShadow: 1, turn: hf(Math.round(ex) + 9) < 0.4 });
    }
    P(966, 1168, 'm', 'a', 'lean', -1, { fr: 0.3, pose: Object.assign({}, POSE.lean, { lean: 0.32 }), w: { top: 'shirt', tc: C.cream, vest: C.dark, bc: C.dark, hat: 'cap', must: 1 } });
    // draw them, back to front
    for (const f of FIG) {
      if (f.lights === undefined) f.lights = LIGHTS;
      crowdOp(f.y, (c) => {
        if (f.fan) { c.save(); c.globalCompositeOperation = 'screen'; c.translate(f.x + 10, f.y - 4); c.scale(1, 0.22); glowDot(c, 0, 0, 190, [255, 214, 150], 0.55); c.restore(); }
        drawFig(c, f);
        if (f.fan) {
          // the clearing Fanucci makes: a soft light on him alone
          c.save(); c.globalCompositeOperation = 'screen'; c.translate(f.x, f.y - f.h * 0.5); c.scale(1, 1.6); glowDot(c, 0, 0, f.h * 0.55, [255, 230, 180], 0.26); c.restore();
        }
      });
    }

    /* ---------- glows, last ---------- */
    L.glow.push((c) => {
      c.save(); c.globalCompositeOperation = 'screen';
      for (const l of LIGHTS) {
        if (l.bulb) { glowDot(c, l.x, l.y, l.r * 1.4, GLOW, l.a * 0.55); continue; }
        glowDot(c, l.x, l.y, l.r, l.col || GLOW, l.a);
      }
      c.restore();
      c.fillStyle = 'rgba(255,244,200,0.95)';
      for (const l of LIGHTS) if (l.bulb) { c.beginPath(); c.arc(l.x, l.y, 1.3 * l.bulb, 0, TAU); c.fill(); }
    });
    // plate tone: a quiet darkening at the bottom edge and the upper corners
    L.fin.push((c) => {
      const g = c.createLinearGradient(0, H - 160, 0, H); g.addColorStop(0, 'rgba(40,24,14,0)'); g.addColorStop(1, 'rgba(40,24,14,0.28)');
      c.fillStyle = g; c.fillRect(0, H - 160, W, 160);
      const g2 = c.createLinearGradient(0, 0, 0, 140); g2.addColorStop(0, 'rgba(40,24,14,0.18)'); g2.addColorStop(1, 'rgba(40,24,14,0)');
      c.fillStyle = g2; c.fillRect(0, 0, W, 140);
    });

    L.crowd.sort((a, b) => a.y - b.y || a.k - b.k);
    return [].concat(L.sky, L.roofB, L.fac, L.fe, L.roofF, L.street, L.crowd.map((o) => o.fn), L.top, L.glow, L.fin);
  }

  /* ================================================================ rendering */
  function nextFrame() { return new Promise((r) => { let done = false; const f = () => { if (!done) { done = true; r(); } }; requestAnimationFrame(f); setTimeout(f, 60); }); }
  async function render(ctx, scale, ops, alive, onTick) {
    let i = 0; RSCALE = scale;
    while (i < ops.length) {
      const t0 = performance.now();
      while (i < ops.length && performance.now() - t0 < 45) {
        ctx.setTransform(scale, 0, 0, scale, 0, 0);
        ctx.save();
        try { ops[i](ctx); } catch (e) { console.error('[festa] op', i, e); }
        ctx.restore();
        i++;
      }
      if (onTick) onTick(i / ops.length);
      await nextFrame();
      if (!alive()) return false;
    }
    return true;
  }

  /* ================================================================ registration */
  (window.PIECES = window.PIECES || []).push({
    id: 'festa',
    title: 'The Feast of San Rocco',
    medium: 'Pen, sepia ink and gold wash, drawn in code',
    note: 'Drag to walk the street · press and hold to look closer',
    about: 'Little Italy, 1920: young Vito crosses the rooftops at dusk while the saint is carried below and Fanucci strolls through the feast in his white suit. One long etching meant to be read left to right, an original interpretation of the novel, not the film.',
    tone: 'dark',
    room: '#17120d',
    mount(el, api) {
      const EXPORT = /[?&]export\b/.test(location.search);
      let alive = true;
      const isAlive = () => alive && api.isCurrent();
      el.style.background = '#17120d';
      el.style.overflow = 'hidden';
      el.style.touchAction = 'none';
      el.style.userSelect = 'none';
      const ops = buildScene(api.seed);
      if (EXPORT) {
        const dpr = window.devicePixelRatio || 1;
        const cw = Math.round(el.clientWidth * dpr), chh = Math.round(el.clientHeight * dpr);
        const cv = document.createElement('canvas');
        cv.width = cw; cv.height = chh;
        const ctx = cv.getContext('2d', { willReadFrequently: true });
        api.ready();
        const t0 = performance.now();
        render(ctx, cw / W, ops, isAlive).then((ok) => {
          if (!ok) return;
          // the compositor cannot show one canvas wider than 8192 px, so the plate is shown as vertical strips
          const n = Math.ceil(cw / 4096), tw = Math.ceil(cw / n);
          for (let i = 0; i < n; i++) {
            const x0 = i * tw, w = Math.min(tw, cw - x0);
            const t = document.createElement('canvas'); t.width = w; t.height = chh;
            t.style.cssText = 'position:absolute;top:0;height:100%;display:block;left:' + (x0 / cw * 100) + '%;width:' + (w / cw * 100) + '%';
            t.getContext('2d').drawImage(cv, x0, 0, w, chh, 0, 0, w, chh);
            el.appendChild(t);
          }
          console.log('[festa] rendered in ' + Math.round(performance.now() - t0) + ' ms, ' + ops.length + ' ops');
          setTimeout(() => { document.documentElement.dataset.exportReady = '1'; }, 900);
        });
        return { destroy() { alive = false; } };
      }
      return mountGallery(el, api, ops, isAlive, () => { alive = false; });
    },
  });

  /* ================================================================ the gallery viewer: pan + magnifying lens */
  function mountGallery(el, api, ops, isAlive, kill) {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const wrap = document.createElement('div');
    wrap.style.cssText = 'position:absolute;left:0;top:0;will-change:transform';
    el.appendChild(wrap);
    let tiles = [];
    const lens = document.createElement('canvas');
    lens.style.cssText = 'position:absolute;left:0;top:0;border-radius:50%;pointer-events:none;display:none;box-shadow:0 10px 40px rgba(0,0,0,.55),0 0 0 1.5px rgba(240,226,196,.8)';
    el.appendChild(lens);
    let master = null, mctx = null, mScale = 0, rendering = false, renderedOnce = false;
    let vw = 0, vh = 0, dispScale = 1, panX = 0, panMax = 0, offX = 0;
    function layout() {
      vw = el.clientWidth; vh = el.clientHeight;
      dispScale = vh / H;
      const dw = W * dispScale;
      panMax = Math.max(0, dw - vw); offX = dw < vw ? (vw - dw) / 2 : 0;
      panX = clamp(panX, 0, panMax);
      const bw = Math.round(dw * dpr), bh = Math.round(vh * dpr), n = Math.ceil(bw / 4096), tw = Math.ceil(bw / n);
      for (const t of tiles) t.cv.remove();
      tiles = [];
      for (let i = 0; i < n; i++) {
        const cv = document.createElement('canvas'), x0 = i * tw, w = Math.min(tw, bw - x0);
        cv.width = w; cv.height = bh;
        cv.style.cssText = 'position:absolute;top:0;display:block;left:' + (x0 / dpr) + 'px;width:' + (w / dpr) + 'px;height:' + vh + 'px';
        wrap.appendChild(cv); tiles.push({ cv, x0, w, bw, bh });
      }
      applyPan();
      if (master) blit();
    }
    function applyPan() { wrap.style.transform = 'translate3d(' + (offX - panX) + 'px,0,0)'; }
    function blit() {
      for (const t of tiles) {
        const d = t.cv.getContext('2d');
        d.imageSmoothingEnabled = true; d.imageSmoothingQuality = 'high';
        const k = master.width / t.bw;
        d.drawImage(master, t.x0 * k, 0, t.w * k, master.height, 0, 0, t.w, t.bh);
      }
    }
    async function draw() {
      const need = clamp(2.1 * dispScale * dpr, 0.6, 1.6);
      if (master && mScale >= need * 0.86) { blit(); return; }
      if (rendering) return;
      rendering = true;
      mScale = need;
      const m = document.createElement('canvas');
      m.width = Math.round(W * mScale); m.height = Math.round(H * mScale);
      const mc = m.getContext('2d', { willReadFrequently: true });
      mc.fillStyle = '#efe5cf'; mc.fillRect(0, 0, m.width, m.height);
      let last = 0;
      const ok = await render(mc, mScale, ops, isAlive, () => {
        const now = performance.now();
        if (now - last > 900 && !renderedOnce) { last = now; master = m; blit(); }
      });
      rendering = false;
      if (!ok) return;
      master = m; mctx = mc; blit();
      if (!renderedOnce) { renderedOnce = true; api.ready(); }
    }
    layout(); draw();
    let rt = 0;
    const ro = new ResizeObserver(() => { clearTimeout(rt); rt = setTimeout(() => { layout(); draw(); }, 200); });
    ro.observe(el);
    // panning: drag, wheel, inertia; a slow drift until the viewer touches it
    let drag = null, vel = 0, raf = 0, drift = true, holdT = 0, lensOn = false, lastPt = null;
    const t0 = performance.now();
    function tick() {
      raf = requestAnimationFrame(tick);
      if (drag) return;
      if (Math.abs(vel) > 0.05) { panX = clamp(panX + vel, 0, panMax); vel *= 0.94; applyPan(); }
      else if (drift && renderedOnce && performance.now() - t0 > 2500 && panX < panMax) { panX = clamp(panX + 0.35, 0, panMax); applyPan(); }
    }
    raf = requestAnimationFrame(tick);
    function showLens(px, py, touch) {
      if (!master) return;
      const R = Math.round(Math.min(150, Math.max(90, vh * 0.16)));
      const mag = 2.6;
      lens.width = Math.round(R * 2 * dpr); lens.height = Math.round(R * 2 * dpr);
      lens.style.width = R * 2 + 'px'; lens.style.height = R * 2 + 'px';
      const cy = touch ? py - R - 40 : py - R;
      lens.style.left = (px - R) + 'px'; lens.style.top = cy + 'px';
      lens.style.display = 'block';
      const dx = (px - offX + panX) / dispScale, dy = py / dispScale;   // design point under the pointer
      const half = R / (dispScale * mag);                               // design px visible across the lens radius
      const lc = lens.getContext('2d');
      lc.imageSmoothingEnabled = true; lc.imageSmoothingQuality = 'high';
      lc.fillStyle = '#efe5cf'; lc.fillRect(0, 0, lens.width, lens.height);
      lc.drawImage(master, (dx - half) * mScale, (dy - half) * mScale, half * 2 * mScale, half * 2 * mScale, 0, 0, lens.width, lens.height);
    }
    function down(e) {
      drift = false; vel = 0;
      el.setPointerCapture && el.setPointerCapture(e.pointerId);
      drag = { x: e.clientX, y: e.clientY, pan: panX, t: performance.now(), lx: e.clientX, moved: false, touch: e.pointerType === 'touch' };
      lastPt = e;
      clearTimeout(holdT);
      holdT = setTimeout(() => { if (drag && !drag.moved) { lensOn = true; const r = el.getBoundingClientRect(); showLens(lastPt.clientX - r.left, lastPt.clientY - r.top, drag.touch); } }, 260);
    }
    function move(e) {
      lastPt = e;
      if (!drag) return;
      const r = el.getBoundingClientRect();
      if (lensOn) { showLens(e.clientX - r.left, e.clientY - r.top, drag.touch); return; }
      const dx = e.clientX - drag.x;
      if (Math.abs(dx) > 5 || Math.abs(e.clientY - drag.y) > 5) drag.moved = true;
      if (drag.moved) {
        const now = performance.now();
        vel = vel * 0.5 + (-(e.clientX - drag.lx)) * 0.5;
        drag.lx = e.clientX; drag.t = now;
        panX = clamp(drag.pan - dx, 0, panMax); applyPan();
      }
    }
    function up() { clearTimeout(holdT); if (lensOn) { lensOn = false; lens.style.display = 'none'; vel = 0; } drag = null; }
    function wheel(e) { drift = false; const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY; panX = clamp(panX + d, 0, panMax); vel = 0; applyPan(); e.preventDefault(); }
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('wheel', wheel, { passive: false });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    el.style.cursor = 'grab';
    return {
      destroy() {
        kill(); cancelAnimationFrame(raf); clearTimeout(holdT); clearTimeout(rt); ro.disconnect();
        el.removeEventListener('pointerdown', down); el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up); el.removeEventListener('wheel', wheel);
        master = null; mctx = null;
      },
    };
  }
})();
