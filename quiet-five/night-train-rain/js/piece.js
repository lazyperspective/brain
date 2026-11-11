/* Rain on the Night Train Window — a 12 s loop.
   Everything is deterministic: seeded PRNG + integer hashes, no Math.random, no Date.
   Units: frame height = 1, frame width = 0.8, y grows downward. */
(function () {
'use strict';

const Q = new URLSearchParams(location.search);
const EXPORT = Q.has('export');
const WPX = parseInt(Q.get('w') || '1080', 10);
const HPX = parseInt(Q.get('h') || '1350', 10);
const L = 12, HZ = 240, NS = L * HZ;
const FW = 0.8;
const PX = 1 / HPX;                    // units per output pixel

// ------------------------------------------------------------------ randomness
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function hash2(i, j) { let h = (Math.imul(i | 0, 374761393) + Math.imul(j | 0, 668265263)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; h = Math.imul(h, 2246822519); h ^= h >>> 13; return (h >>> 0) / 4294967296; }
function hash3(i, j, k) { return hash2(i * 7919 + k * 104729, j * 15485863 + k); }
function smooth(f) { return f * f * (3 - 2 * f); }
function vnoise1(x, s) { const i = Math.floor(x), f = x - i; const a = hash2(i, s) * 2 - 1, b = hash2(i + 1, s) * 2 - 1; return a + (b - a) * smooth(f); }
function vnoise2(x, y, s) {
  const i = Math.floor(x), j = Math.floor(y), fx = smooth(x - i), fy = smooth(y - j);
  const a = hash3(i, j, s), b = hash3(i + 1, j, s), c = hash3(i, j + 1, s), d = hash3(i + 1, j + 1, s);
  return (a + (b - a) * fx) + ((c + (d - c) * fx) - (a + (b - a) * fx)) * fy;
}
const clamp = (x, a, b) => x < a ? a : x > b ? b : x;
const lerp = (a, b, t) => a + (b - a) * t;

// ------------------------------------------------------------------ the city
// layer 0: static (very far), layer 1: mid (shifts one domain per loop), layer 2: near (two per loop)
const DOM = 0.9, DOM0 = -0.05;          // wrap domain for moving layers
const SHIFT = [0, 1, 2];
const HORIZON = 0.535;
const SODIUM = [1.0, 0.36, 0.055];
const WARM = [1.0, 0.46, 0.14];
const CREAM = [1.0, 0.57, 0.25];
const EMBER = [1.0, 0.34, 0.07];
const CYAN = [0.0, 0.78, 1.0];

// a reflection on wet asphalt, broken by ripples: a column of overlapping discs fading downwards
function reflColumn(list, x, y0, len, I, col, R) {
  const n = 18;
  for (let k = 0; k < n; k++) {
    const f = k / (n - 1);
    list.push({ x: x + (R() - 0.5) * 0.010, y: y0 + f * len + (R() - 0.5) * 0.008, R: 0.021 + R() * 0.006, col, I: I * 0.5 * Math.pow(1 - f * 0.9, 1.6) * (0.35 + 0.9 * R() * R()), len: 0, fade: 0.12, refl: true, sharpW: 0.0011 });
  }
}
function buildCity() {
  const rng = mulberry32(90210);
  const R = () => rng();
  const L0 = [], L1 = [], L2 = [];
  const mix3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
  // --- far static lights (extend beyond the frame for the drop miniatures)
  for (let i = 0; i < 26; i++) {
    const x = -0.45 + R() * 1.7;
    const y = HORIZON - 0.03 + R() * 0.045;
    const inFrame = x > -0.02 && x < 0.82;
    if (inFrame && rng() < 0.45) continue;
    const c = mix3(WARM, EMBER, R());
    L0.push({ x, y, R: 0.021 + R() * 0.004, col: c, I: 0.05 + R() * 0.10, len: 0, fade: 1 });
  }
  // the distant tower and its cyan sign
  L0.push({ x: 0.585, y: 0.33, R: 0.025, col: CYAN, I: 0.62, len: 0.055, fade: 0.85, sharpW: 0.0042, sign: true });
  L0.push({ x: 0.585, y: 0.455, R: 0.022, col: CREAM, I: 0.05, len: 0, fade: 1 });
  // --- mid layer: building facades (window grids) along the horizon
  const blocks = [
    { x: 0.00, n: 3, m: 3 }, { x: 0.20, n: 2, m: 4 }, { x: 0.40, n: 4, m: 2 }, { x: 0.62, n: 3, m: 3 }, { x: 0.78, n: 2, m: 3 }];
  for (const b of blocks) {
    const sx = 0.034 + R() * 0.012, sy = 0.036 + R() * 0.01;
    const y0 = HORIZON - 0.04 - (b.m - 1) * sy * 0.6 + R() * 0.03;
    const tint = R();
    for (let i = 0; i < b.n; i++) for (let j = 0; j < b.m; j++) {
      if (R() < 0.45) continue;
      const c = mix3(tint < 0.5 ? WARM : CREAM, EMBER, R() * 0.6);
      const q = R(); L1.push({ x: b.x + i * sx + (R() - 0.5) * 0.004, y: y0 + j * sy, R: 0.019 + R() * 0.014, col: c, I: 0.05 + 0.36 * q * q, len: 0, fade: 1 });
    }
  }
  // a few cool fluorescent windows and different sizes, so it reads as a city and not a pattern
  const FLUO = [0.80, 0.90, 1.0], PALE = [1.0, 0.86, 0.66];
  for (let i = 0; i < 9; i++) {
    const cool = i < 4;
    L1.push({ x: DOM0 + (i + R() * 0.8) / 9 * DOM, y: HORIZON - 0.06 + R() * 0.075, R: 0.015 + R() * 0.02, col: cool ? FLUO : PALE, I: cool ? 0.035 + R() * 0.05 : 0.06 + R() * 0.10, len: 0, fade: 1, sharpW: 0.0014 });
  }
  // the dense fabric of small windows: faint as bokeh, but each a bright point for the drop lenses
  for (let i = 0; i < 150; i++) {
    const q = R();
    L1.push({ x: DOM0 + R() * DOM, y: HORIZON - 0.075 + Math.pow(R(), 0.7) * 0.10, R: 0.022 + R() * 0.008, col: mix3(WARM, q < 0.3 ? EMBER : CREAM, R()), I: 0.006 + 0.022 * R() * R(), len: 0, fade: 1, sharpW: 0.0012 + R() * 0.001 });
  }
  for (let i = 0; i < 160; i++) {
    const x = -0.45 + R() * 1.7;
    L0.push({ x, y: HORIZON - 0.035 + Math.pow(R(), 0.8) * 0.06, R: 0.02 + R() * 0.006, col: mix3(WARM, EMBER, R()), I: 0.004 + 0.016 * R() * R(), len: 0, fade: 1, sharpW: 0.0009 + R() * 0.0008 });
  }
  for (let i = 0; i < 5; i++) L1.push({ x: R() * DOM + DOM0, y: HORIZON + 0.02 + R() * 0.06, R: 0.023 + R() * 0.006, col: mix3(EMBER, SODIUM, R()), I: 0.08 + R() * 0.12, len: 0, fade: 1 });
  // --- near layer: sodium streetlights on poles, with long wet-road reflections
  const lampX = [0.07, 0.52];
  for (let i = 0; i < lampX.length; i++) {
    const x = lampX[i] + (R() - 0.5) * 0.03;
    L2.push({ x, y: 0.285 + (R() - 0.5) * 0.01, R: 0.036, col: SODIUM, I: 0.72, len: 0, fade: 1, sharpW: 0.0095 });
    reflColumn(L2, x, 0.705, 0.20, 0.10, SODIUM, R);
  }
  // two cars' tail lights on the road below, small red discs
  for (const [x, y] of [[0.16, 0.612], [0.69, 0.618]]) {
    L2.push({ x, y, R: 0.015, col: [1.0, 0.035, 0.02], I: 0.22, len: 0, fade: 1, sharpW: 0.0011 });
    L2.push({ x: x + 0.019, y: y + 0.001, R: 0.015, col: [1.0, 0.035, 0.02], I: 0.18, len: 0, fade: 1, sharpW: 0.0011 });
  }
  // a lower, dimmer lamp further along the road
  L2.push({ x: 0.30, y: 0.395, R: 0.031, col: mix3(SODIUM, EMBER, 0.5), I: 0.30, len: 0, fade: 1, sharpW: 0.0075 });
  reflColumn(L2, 0.30, 0.665, 0.13, 0.05, SODIUM, R);
  // the wet ground mirrors the window lights, dimmer and broken
  const GY = HORIZON + 0.05;
  for (const l of L1.slice()) {
    if (l.I < 0.03 || R() < 0.35) continue;
    const y = GY + (GY - l.y) * 0.9 + 0.01 + R() * 0.02;
    L1.push({ x: l.x + (R() - 0.5) * 0.006, y, R: l.R * 0.95, col: l.col, I: l.I * (0.10 + 0.10 * R()), len: 0.01 + R() * 0.04, fade: 0.2, refl: true });
  }
  return { L0, L1, L2 };
}

// ------------------------------------------------------------------ the passing signal box (the "flash")
const BOX = { W: 0.20, TOP: 0.44, BOT: 0.66, WX: 0.05, WY: 0.484, WW: 0.10, WH: 0.083, V: -0.45, TC: 7.25 };
function boxLeft(t) { return 0.4 - BOX.W * 0.5 + BOX.V * (t - BOX.TC); }

// ------------------------------------------------------------------ rain simulation
const R_CRIT = 0.0122;
const WIND = 0.20;          // slant of runners (radians), drops drift left/back
const VS = 0.48, VMAX = 0.30, ABS_T = 0.07;
const SPAN = 0.32;          // field of view of a drop lens, in frame units
function pinField(x, y) { return clamp(0.15 + 0.85 * vnoise2(x * 34, y * 34, 11) * 0.9 + 0.3 * (vnoise2(x * 95, y * 95, 12) - 0.5), 0, 1); }

// The simulation is built so that the loop closes exactly:
//  1. every runner (sliding drop) is simulated on its own against the field of pinned beads, so its whole
//     life is a pure function of its seed — the same every loop;
//  2. the pinned beads, the trail residue and the rain that re-lands in the cleared tracks are then laid out
//     on the circle of loop time from those tracks (a swept bead re-lands from the rain before it is needed again).
const SEEDS = [
  { t: 0.20, x: 0.64, y: 0.22, grow: 3, r0: 0.0105 },
  { t: 1.55, x: 0.36, y: -0.04, enter: 0.0162 },
  { t: 3.10, x: 0.50, y: 0.33, grow: 4 },
  { t: 4.60, x: 0.79, y: -0.04, enter: 0.0155 },
  { t: 6.00, x: 0.26, y: 0.17, grow: 3 },
  { t: 7.90, x: 0.71, y: 0.42, grow: 3 },
  { t: 9.40, x: 0.47, y: -0.04, enter: 0.0170 },
  { t: 10.70, x: 0.13, y: 0.40, grow: 3, r0: 0.0105 },
];
function simulate() {
  const rng = mulberry32(1234567);
  const R = () => rng();
  const GRID = 0.025, grid = new Map();
  function gridAdd(b) { const k = (Math.floor(b.y / GRID) + 20) * 1000 + (Math.floor(b.x / GRID) + 20); let a = grid.get(k); if (!a) grid.set(k, a = []); a.push(b); }
  function near(x, y, rad, fn) {
    const i0 = Math.floor((x - rad) / GRID), i1 = Math.floor((x + rad) / GRID), j0 = Math.floor((y - rad) / GRID), j1 = Math.floor((y + rad) / GRID);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const a = grid.get((j + 20) * 1000 + i + 20); if (a) for (const b of a) fn(b); }
  }
  const seeds = SEEDS.map((s, i) => Object.assign({ id: i }, s));
  // --- pinned beads: Poisson-ish placement, large first
  const classes = [
    { n: 15, r0: 0.0085, r1: 0.0128 }, { n: 120, r0: 0.0036, r1: 0.0085 },
    { n: 650, r0: 0.0014, r1: 0.0036 }, { n: 2600, r0: 0.0005, r1: 0.0014 }];
  const free = (x, y, r) => { let ok = true; near(x, y, r + 0.02, b => { if (ok && Math.hypot(b.x - x, b.y - y) < (b.r + r) * 1.25 + 0.0012) ok = false; }); return ok; };
  for (const s of seeds) gridAdd({ x: s.x, y: Math.max(s.y, 0), r: 0.017, phantom: true });
  const slots = [];
  for (let tries = 0, placed = 0; placed < 9 && tries < 4000; tries++) {
    const x = 0.12 + R() * 0.68, y = 0.05 + R() * 0.28;
    const r = 0.0068 + R() * 0.0048;
    if (!free(x, y, r * 2.2)) continue;
    const b = { id: slots.length, x, y, r, sweeps: [] }; gridAdd(b); slots.push(b); placed++;
  }
  for (const c of classes) {
    let placed = 0, tries = 0;
    while (placed < c.n && tries < c.n * 40) {
      tries++;
      const x = 0.055 + R() * 0.78, y = -0.03 + R() * 1.06;
      const r = c.r0 * Math.pow(c.r1 / c.r0, Math.pow(R(), 1.6));
      if (!free(x, y, r)) continue;
      const b = { id: slots.length, x, y, r, sweeps: [] };
      gridAdd(b); slots.push(b); placed++;
    }
  }
  // water gathers along the seal at the bottom and the left of the glass
  for (let tries = 0, placed = 0; placed < 140 && tries < 6000; tries++) {
    const along = R();
    let x, y;
    if (along < 0.75) { x = 0.17 + R() * 0.66; y = 0.958 - 0.004 - Math.pow(R(), 2) * 0.03; }
    else { x = 0.072 + 0.003 + Math.pow(R(), 2) * 0.025; y = 0.05 + R() * 0.8; }
    const r = 0.0012 * Math.pow(0.0075 / 0.0012, Math.pow(R(), 1.3));
    if (!free(x, y, r)) continue;
    const b = { id: slots.length, x, y, r, sweeps: [] }; gridAdd(b); slots.push(b); placed++;
  }
  for (const [k, a] of grid) grid.set(k, a.filter(b => !b.phantom));

  // --- 1. each runner alone
  const dt = 1 / HZ;
  function runOne(s) {
    const taken = new Set();
    const ru = { x: s.x, y: s.y, V: s.enter ? s.enter ** 3 : (s.r0 || 0.0088) ** 3, v: s.enter ? 0.12 : 0, moving: !!s.enter, tStop: 0, nPause: 0, nDep: 0, sAcc: 0, nextDep: 0.008,
      dirx: 0, diry: -1, tail: s.enter ? s.enter * 1.5 : 0 };
    const SC = R_CRIT / 0.0086;
    const track = [], absorbs = [], deps = [], imps = [];
    const absorbing = [];
    let lastx = ru.x, lasty = ru.y;
    for (let k = 0; k < (L - 0.6) * HZ; k++) {
      const t = k * dt;
      let r = Math.cbrt(ru.V);
      const rc = R_CRIT * (1 + 0.26 * pinField(ru.x, ru.y));
      if (!ru.moving) {
        const pd = ((s.grow && ru.nPause < s.grow) ? 0.35 + hash3(s.id, ru.nPause, 9) * 0.5 : 0.5 + hash3(s.id, ru.nPause, 10) * 1.3) * Math.max(0.3, 1 - t / 11);
        if (t - ru.tStop > pd) {
          // a raindrop lands right beside the stalled drop and they coalesce
          const kk = ru.nPause;
          const a = -Math.PI * 0.5 + (hash3(s.id, kk, 3) - 0.5) * 3.6;
          const ri = (0.0050 + hash3(s.id, kk, 4) * 0.0028) * SC, d = r + ri * 0.75;
          const im = { x: ru.x + Math.cos(a) * d, y: ru.y + Math.sin(a) * d, r: ri, t0: t, tA: t + 0.09 + hash3(s.id, kk, 5) * 0.06 };
          imps.push(im); ru.nPause++; ru.tStop = t;
        }
        if (r > rc * 1.07) { ru.moving = true; ru.v = 0; }
      }
      for (const im of imps) if (!im.started && t >= im.tA) { im.started = true; absorbing.push({ V0: im.r ** 3, prog: 0, x: im.x, y: im.y }); }
      if (ru.moving) {
        let vt = r > rc * 0.95 ? VS * Math.pow((r - rc * 0.95) / R_CRIT, 0.75) : 0;
        vt = Math.min(vt, VMAX);
        ru.v += (vt - ru.v) * Math.min(1, dt / (vt > ru.v ? 0.16 : 0.07));
        if (vt === 0 && ru.v < 0.006) { ru.moving = false; ru.v = 0; ru.tStop = t; }
        const th = WIND + 0.16 * vnoise1(ru.y * 7.0 + s.id * 13.17, 5) + 0.07 * vnoise1(ru.y * 26 + s.id * 3.1, 6 + s.id);
        const dx = -Math.sin(th), dy = Math.cos(th);
        ru.x += dx * ru.v * dt; ru.y += dy * ru.v * dt;
        ru.sAcc += ru.v * dt;
        if (ru.sAcc > ru.nextDep && r > 0.004 * SC) {
          const h = (q) => hash3(s.id, ru.nDep, q);
          const rr = r * (0.10 + 0.12 * h(1));
          const px = -dy, py = dx, off = (h(2) - 0.5) * 0.7 * r;
          deps.push({ x: ru.x - dx * r * 0.8 + px * off, y: ru.y - dy * r * 0.8 + py * off, r: rr, t });
          ru.V -= rr * rr * rr; ru.nDep++; ru.sAcc = 0; ru.nextDep = (0.0045 + h(3) * 0.010) * SC;
        }
      }
      r = Math.cbrt(ru.V);
      near(ru.x, ru.y, r + 0.012, b => {
        if (taken.has(b.id)) return;
        if (Math.hypot(b.x - ru.x, b.y - ru.y) < (r + b.r) * 0.96) { taken.add(b.id); absorbs.push({ id: b.id, t }); absorbing.push({ V0: b.r ** 3, prog: 0, x: b.x, y: b.y }); }
      });
      for (const ab of absorbing) {
        if (ab.prog >= 1) continue;
        const p0 = ab.prog; ab.prog = Math.min(1, ab.prog + dt / ABS_T);
        const dV = ab.V0 * (ab.prog - p0); ru.V += dV;
        const w = dV / ru.V; ru.x += (ab.x - ru.x) * w * 0.9; ru.y += (ab.y - ru.y) * w * 0.55;
        if (!ru.moving && ru.V > (rc * 1.07) ** 3) { /* will start next step */ }
      }
      // shape: the tail grows with speed and trails back along the motion
      const sp = clamp(ru.v / 0.25, 0, 1);
      if (ru.v > 0.001) {
        const mx = lastx - ru.x, my = lasty - ru.y, ml = Math.hypot(mx, my);
        if (ml > 1e-7) { ru.dirx = lerp(ru.dirx, mx / ml, 0.08); ru.diry = lerp(ru.diry, my / ml, 0.08); }
      } else { ru.dirx = lerp(ru.dirx, 0, 0.02); ru.diry = lerp(ru.diry, -1, 0.02); }
      ru.tail = lerp(ru.tail, r * (0.28 + 2.3 * sp), 0.05);
      lastx = ru.x; lasty = ru.y;
      const dl = Math.hypot(ru.dirx, ru.diry) || 1;
      track.push(ru.x, ru.y, Math.cbrt(ru.V), ru.tail, ru.dirx / dl, ru.diry / dl);
      if (ru.y - r > 0.975 || ru.x + r < 0.03) break;
    }
    return { seed: s, ts: s.t, track, n: track.length / 6, absorbs, deps, imps, exited: track[track.length - 5] - track[track.length - 4] > 1.0 || track[track.length - 6] < -0.05 };
  }
  const runs = seeds.map(runOne);
  const wrap = (t) => ((t % L) + L) % L;
  // --- 2. lay everything out on the circle of loop time
  for (const ru of runs) for (const a of ru.absorbs) slots[a.id].sweeps.push({ t: wrap(ru.ts + a.t), run: ru });
  const stat = [];   // {x,y,r,iv:[[a,b]...], h.., sweeps:[{t,run,present}]}
  for (const b of slots) {
    const e = { x: b.x, y: b.y, r: b.r, h: hash2(b.id, 1), h2: hash2(b.id, 2), h3: hash2(b.id, 3), grows: b.r > 0.0036, iv: [], abs: [] };
    if (!b.sweeps.length) e.iv.push([-1, 2 * L]);
    else {
      const sw = b.sweeps.slice().sort((p, q) => p.t - q.t);
      for (let i = 0; i < sw.length; i++) {
        const s0 = sw[i].t, s1 = i + 1 < sw.length ? sw[i + 1].t : sw[0].t + L;
        const gap = s1 - s0;
        if (gap > 0.6) {
          const land = s0 + ABS_T + clamp(gap * (0.12 + 0.4 * hash2(b.id, 40 + i)), 0.3, gap - ABS_T - 0.25);
          e.iv.push([wrap(land), wrap(land) + (s1 - land)]);
          sw[(i + 1) % sw.length].present = true;
        }
      }
      for (const s of sw) if (s.present) e.abs.push([s.t, s.run]);
    }
    stat.push(e);
  }
  stat.sort((a, b) => a.r - b.r);
  // residue left in the tracks: stays until the next drop (any drop, any loop) runs through it
  const resid = [];
  for (const ru of runs) for (const d of ru.deps) {
    const td = wrap(ru.ts + d.t);
    let best = L, by = null;
    for (const m of runs) {
      for (let k = 0; k < m.n; k++) {
        const x = m.track[k * 6], y = m.track[k * 6 + 1];
        if (Math.abs(x - d.x) > 0.03 || Math.abs(y - d.y) > 0.03) continue;
        if (m === ru && k / HZ >= d.t) continue;
        if (Math.hypot(x - d.x, y - d.y) < (m.track[k * 6 + 2] + d.r) * 0.96) {
          const dtt = wrap(m.ts + k / HZ - td) || L;
          if (dtt < best) { best = dtt; by = m; }
          break;
        }
      }
    }
    resid.push({ x: d.x, y: d.y, r: d.r, a: td, b: td + best, by, h: hash2(Math.round(d.x * 1e5), Math.round(d.y * 1e5)) });
  }
  // runner-runner contacts (should be none: the seeds are chosen so the paths never meet in time)
  let contacts = 0; const contactList = [];
  for (let i = 0; i < runs.length; i++) for (let j = i + 1; j < runs.length; j++) {
    const A = runs[i], B = runs[j];
    for (let k = 0; k < A.n; k++) {
      const t = wrap(A.ts + k / HZ); const kb = Math.round(wrap(t - B.ts) * HZ);
      if (kb >= B.n) continue;
      if (Math.hypot(A.track[k * 6] - B.track[kb * 6], A.track[k * 6 + 1] - B.track[kb * 6 + 1]) < A.track[k * 6 + 2] + B.track[kb * 6 + 2] + 0.004) { contacts++; contactList.push([i, j, t.toFixed(2)]); break; }
    }
  }
  return { stat, resid, runs, contacts, contactList, durations: runs.map(r => (r.n / HZ).toFixed(2) + (r.exited ? '' : '!')), nSlots: slots.length, nDeps: resid.length };
}
function runPos(ru, t) { const k = Math.round(((((t - ru.ts) % L) + L) % L) * HZ); if (k >= ru.n) return null; return k; }

// ------------------------------------------------------------------ WebGL plumbing
const canvas = document.getElementById('c');
canvas.width = WPX; canvas.height = HPX;
if (EXPORT) document.body.classList.add('export');
const gl = canvas.getContext('webgl2', { antialias: false, preserveDrawingBuffer: true, premultipliedAlpha: false, alpha: false });
gl.getExtension('EXT_color_buffer_float');
gl.getExtension('EXT_float_blend');
gl.getExtension('OES_texture_float_linear');

function sh(type, src) { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) + '\n' + src.split('\n').map((l, i) => (i + 1) + ': ' + l).join('\n')); return s; }
function prog(vs, fs) { const p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p); if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p)); p.u = {}; const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS); for (let i = 0; i < n; i++) { const info = gl.getActiveUniform(p, i); p.u[info.name.replace(/\[0\]$/, '')] = gl.getUniformLocation(p, info.name); } return p; }
function tex(w, h, fmt, opts) {
  opts = opts || {};
  const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
  const F = { rgba16f: [gl.RGBA16F, gl.RGBA, gl.HALF_FLOAT], rgba8: [gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE], r8: [gl.R8, gl.RED, gl.UNSIGNED_BYTE] }[fmt];
  if (opts.mip) { const lv = Math.floor(Math.log2(Math.max(w, h))) + 1; gl.texStorage2D(gl.TEXTURE_2D, lv, F[0], w, h); }
  else gl.texImage2D(gl.TEXTURE_2D, 0, F[0], w, h, 0, F[1], F[2], opts.data || null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, opts.mip ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, opts.repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, opts.repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE);
  t.w = w; t.h = h; return t;
}
function fbo(texs) { const f = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, f); texs.forEach((t, i) => gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0 + i, gl.TEXTURE_2D, t, 0)); gl.drawBuffers(texs.map((_, i) => gl.COLOR_ATTACHMENT0 + i)); f.w = texs[0].w; f.h = texs[0].h; const st = gl.checkFramebufferStatus(gl.FRAMEBUFFER); if (st !== gl.FRAMEBUFFER_COMPLETE) throw new Error('fbo ' + st); return f; }
function bindT(p, name, t, unit) { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t); gl.uniform1i(p.u[name], unit); }
function target(f) { gl.bindFramebuffer(gl.FRAMEBUFFER, f); if (f) gl.viewport(0, 0, f.w, f.h); else gl.viewport(0, 0, WPX, HPX); }

const quadBuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
const fsVAO = gl.createVertexArray(); gl.bindVertexArray(fsVAO); gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
function drawFS() { gl.bindVertexArray(fsVAO); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); }

// instanced VAO with nAttr vec4 per-instance attributes
function instVAO(nAttr) {
  const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  for (let i = 0; i < nAttr; i++) { gl.enableVertexAttribArray(1 + i); gl.vertexAttribPointer(1 + i, 4, gl.FLOAT, false, nAttr * 16, i * 16); gl.vertexAttribDivisor(1 + i, 1); }
  vao.buf = buf; vao.stride = nAttr * 4; return vao;
}
function drawInst(vao, data, count) { if (!count) return; gl.bindVertexArray(vao); gl.bindBuffer(gl.ARRAY_BUFFER, vao.buf); gl.bufferData(gl.ARRAY_BUFFER, data.subarray(0, count * vao.stride), gl.DYNAMIC_DRAW); gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, count); }

// ------------------------------------------------------------------ shaders
const HDR = `#version 300 es
precision highp float; precision highp int;
uvec3 pcg3d(uvec3 v){ v=v*1664525u+1013904223u; v.x+=v.y*v.z; v.y+=v.z*v.x; v.z+=v.x*v.y; v^=v>>16u; v.x+=v.y*v.z; v.y+=v.z*v.x; v.z+=v.x*v.y; return v; }
vec3 h3(ivec2 c, int s){ return vec3(pcg3d(uvec3(ivec3(c.x + 4096, c.y + 4096, s)))) * (1.0/4294967295.0); }
float vn(vec2 p, int s){ vec2 i=floor(p), f=p-i; f=f*f*(3.0-2.0*f); ivec2 c=ivec2(i);
  float a=h3(c,s).x, b=h3(c+ivec2(1,0),s).x, d=h3(c+ivec2(0,1),s).x, e=h3(c+ivec2(1,1),s).x; return mix(mix(a,b,f.x),mix(d,e,f.x),f.y); }
float fbm(vec2 p, int s){ float a=0.5, r=0.0; for(int i=0;i<5;i++){ r+=a*vn(p,s+i*17); p=p*2.03+vec2(1.7,9.2); a*=0.5; } return r; }
`;
// fullscreen vertex shader: vP = unit position inside region uReg (x0, y0, w, h)
const VS_FS = `#version 300 es
layout(location=0) in vec2 aQ; uniform vec4 uReg; out vec2 vP; out vec2 vUV;
void main(){ vUV = aQ*0.5+0.5; vP = vec2(uReg.x + vUV.x*uReg.z, uReg.y + (1.0-vUV.y)*uReg.w); gl_Position = vec4(aQ,0,1); }`;

const FS_SKY = HDR + `
in vec2 vP; out vec4 o;
uniform float uHz;
void main(){
  vec2 p = vP; float y = p.y;
  vec3 col = mix(vec3(0.0011,0.0017,0.0052), vec3(0.0034,0.0050,0.0128), smoothstep(-0.4, uHz, y));
  float n = fbm(p*vec2(2.2,6.0)+vec2(3.0,1.0), 3);
  float n2 = fbm(p*vec2(5.0,11.0), 7);
  float gl = exp(-pow(max(uHz - y, 0.0)/0.20, 1.4));
  col += vec3(0.016, 0.0068, 0.0024) * gl * (0.45 + 0.9*n*n2*1.6);
  col += vec3(0.0010,0.0012,0.0022) * smoothstep(0.35,0.75,n) * (1.0-gl);
  float gnd = smoothstep(uHz - 0.004, uHz + 0.035, y);
  vec3 g = vec3(0.0014, 0.0016, 0.0034) * (0.8 + 0.4*fbm(p*vec2(3.0,9.0), 21));
  g += vec3(0.0060,0.0026,0.0008) * exp(-pow((y-(uHz+0.17))/0.07,2.0)) * (0.5+0.8*fbm(p*vec2(1.6,26.0), 31));
  g *= 1.0 - 0.5*smoothstep(uHz+0.25, uHz+0.6, y);
  col = mix(col, g, gnd);
  o = vec4(col, 1.0);
}`;

const VS_BOKEH = `#version 300 es
layout(location=0) in vec2 aQ; layout(location=1) in vec4 aI0; layout(location=2) in vec4 aI1;
uniform vec4 uReg; uniform float uPadPx;
out vec2 vP; flat out vec4 vI0; flat out vec4 vI1;
void main(){
  float R = aI0.z, len = aI0.w; float pad = R*0.12 + uPadPx;
  vec2 mn = aI0.xy - vec2(R) - pad, mx = aI0.xy + vec2(R, R + len) + pad;
  vec2 p = mix(mn, mx, aQ*0.5+0.5);
  vP = p; vI0 = aI0; vI1 = aI1;
  vec2 c = (p - uReg.xy)/uReg.zw;
  gl_Position = vec4(c.x*2.0-1.0, 1.0-c.y*2.0, 0.0, 1.0);
}`;
const FS_BOKEH = HDR + `
in vec2 vP; flat in vec4 vI0; flat in vec4 vI1; out vec4 o;
uniform float uPx, uCat, uCA, uRing, uLensAmt; uniform vec2 uFC; uniform float uFD; uniform sampler2D uLens;
float cov(float d, float R, float e){ return smoothstep(R+e, R-e, d); }
void main(){
  vec2 c = vI0.xy; float R = vI0.z, len = vI0.w; vec3 col = vI1.rgb;
  float e = uPx*0.8 + R*uRing*(0.035 + (len > 0.0 ? 0.0 : 0.16*(1.0 - vI1.w)));
  vec3 val;
  if(len > 0.0){
    float dx = abs(vP.x - c.x);
    float h = sqrt(max(R*R - dx*dx, 0.0));
    float lo = clamp(vP.y - h, c.y, c.y+len), hi = clamp(vP.y + h, c.y, c.y+len);
    float ov = clamp(max(hi-lo, 0.0)/min(2.0*R, len), 0.0, 1.0);
    float side = smoothstep(R+e*3.0, R-e*6.0, dx);
    float al = clamp((vP.y - c.y)/len, 0.0, 1.0);
    float f = mix(1.0, vI1.w, al);
    float ripple = 1.0 + uRing*1.1*(vn(vec2(c.x*50.0 + vP.x*20.0, vP.y*30.0), 41)-0.5);
    val = col * ov * f * side * ripple;
  } else {
    vec2 d = vP - c; float r = length(d);
    vec2 rad = (c - uFC)/uFD;
    vec2 off = rad * uCat * R;
    float r2 = length(d + off);
    vec3 sc = vec3(1.0 + uCA, 1.0, 1.0 - uCA);
    vec3 m = vec3(cov(r,R*sc.r,e)*cov(r2,R*1.04*sc.r,e), cov(r,R*sc.g,e)*cov(r2,R*1.04*sc.g,e), cov(r,R*sc.b,e)*cov(r2,R*1.04*sc.b,e));
    float rn = r/R;
    float rs = uRing*vI1.w;
    float ring = 1.0 + rs*(0.045*sin(rn*36.0+1.0)*smoothstep(0.15,0.5,rn) + 0.17*smoothstep(0.6,0.985,rn) - 0.05);
    float tx = 1.0 + uLensAmt*(texture(uLens, d/R*0.5+0.5).r - 0.5);
    val = col * m * ring * tx;
  }
  o = vec4(val, 1.0);
}`;

// the passing signal box with its lit window (premultiplied over)
const FS_BOX = HDR + `
in vec2 vP; out vec4 o;
uniform float uBx, uBv, uShut, uBlur, uWBlur, uWinI; uniform sampler2D uWin;
uniform vec4 uBox; uniform vec4 uWinR; // box (W, top, -, -), window (x off, y, w, h)
vec4 boxAt(vec2 p, float bx){
  // the facade is just a little more night: a soft dark mass, as out of focus as everything else,
  // the same colour as the dark ground, so only the lit window reads
  float x0 = bx, x1 = bx + uBox.x;
  float sx = 0.03, sy = 0.035;
  float ax = smoothstep(x0 - sx, x0 + sx, p.x) * smoothstep(x1 + sx, x1 - sx, p.x);
  float top = uWinR.y - 0.05, bot = uWinR.y + uWinR.w + 0.05;
  float ay = smoothstep(top - sy, top + sy, p.y) * smoothstep(bot + sy, bot - sy, p.y);
  float a = ax*ay*0.88;
  vec3 col = vec3(0.0013, 0.0015, 0.0030);
  vec2 wp = (p - vec2(x0 + uWinR.x, uWinR.y))/uWinR.zw;
  float ew = uWBlur/uWinR.z, eh = uWBlur/uWinR.w;
  float wa = smoothstep(-ew, ew, wp.x)*smoothstep(1.0+ew, 1.0-ew, wp.x)*smoothstep(-eh, eh, wp.y)*smoothstep(1.0+eh, 1.0-eh, wp.y);
  if(wa > 0.0){
    vec3 w = texture(uWin, vec2(clamp(wp.x,0.0,1.0), 1.0-clamp(wp.y,0.0,1.0)), uWBlur > 0.002 ? 0.6 : 0.0).rgb; w = pow(w, vec3(2.2))*uWinI;
    col = mix(col, w, wa); a = mix(a, 1.0, wa);
  }
  return vec4(col*a, a);
}
void main(){ vec4 acc = vec4(0.0); for(int i=0;i<10;i++){ float s = (float(i)/9.0-0.5)*uShut; acc += boxAt(vP, uBx + uBv*s); } o = acc/10.0; }`;

const FS_COPY = `#version 300 es
precision highp float; in vec2 vUV; out vec4 o; uniform sampler2D uT; void main(){ o = texture(uT, vUV); }`;
const FS_DOWN = `#version 300 es
precision highp float; in vec2 vUV; out vec4 o; uniform sampler2D uT; uniform vec2 uTexel;
uniform float uK;
void main(){ vec4 s = vec4(0.0); for(int j=0;j<2;j++) for(int i=0;i<2;i++) s += texture(uT, vUV + (vec2(i,j)*2.0-1.0)*uTexel*uK); o = s*0.25; }`;
const FS_MIPDOWN = `#version 300 es
precision highp float; in vec2 vUV; out vec4 o; uniform sampler2D uT; uniform vec2 uTexel; uniform float uLod;
void main(){ vec4 s = vec4(0.0); for(int j=0;j<2;j++) for(int i=0;i<2;i++) s += textureLod(uT, vUV + (vec2(i,j)*2.0-1.0)*0.75*uTexel, uLod); o = s*0.25; }`;
const FS_BLUR = `#version 300 es
precision highp float; in vec2 vUV; out vec4 o; uniform sampler2D uT; uniform vec2 uDir; uniform float uSig;
void main(){ int n = int(ceil(uSig*3.0)); vec4 s = vec4(0.0); float ws = 0.0;
  for(int i=-n;i<=n;i+=2){ float a = float(i), b = float(i+1); float wa = exp(-a*a/(2.0*uSig*uSig)), wb = exp(-b*b/(2.0*uSig*uSig)); float w = wa+wb; float off = (a*wa + b*wb)/w; s += texture(uT, vUV + uDir*off)*w; ws += w; }
  o = s/ws; }`;

// fog mask: trails (strips) and bead halos, MIN-blended into an R channel (1 = untouched mist)
const VS_TRAIL = `#version 300 es
layout(location=0) in vec2 aP; layout(location=1) in vec2 aV; uniform vec4 uReg; out vec2 vP; out vec2 vV;
void main(){ vP = aP; vV = aV; vec2 c = (aP - uReg.xy)/uReg.zw; gl_Position = vec4(c.x*2.0-1.0, 1.0-c.y*2.0, 0.0, 1.0); }`;
const FS_TRAIL = HDR + `
in vec2 vP; in vec2 vV; out vec4 o; uniform float uT, uL; uniform sampler2D uMist;
void main(){
  float age = mod(uT - vV.y + 1e-4, uL); float a = age/uL;
  float g = 1.0 - pow(smoothstep(0.0, 0.62, a), 0.75);
  vec4 m = texture(uMist, vec2(vP.x/0.8, 1.0-vP.y));
  float n = m.a;
  float clr = smoothstep(n - 0.10, n + 0.10, g*1.18 - 0.09);
  float en = vn(vP*vec2(160.0, 60.0), 61);
  float edge = smoothstep(1.0, 0.82, abs(vV.x) + (en-0.5)*0.22);
  o = vec4(1.0 - 0.97*clr*edge);
}`;
const VS_HALO = `#version 300 es
layout(location=0) in vec2 aQ; layout(location=1) in vec4 aI0; uniform vec4 uReg; out vec2 vL; flat out float vS;
void main(){ float R = aI0.z*1.75; vec2 p = aI0.xy + aQ*R; vL = aQ*1.75; vS = aI0.w; vec2 c = (p - uReg.xy)/uReg.zw; gl_Position = vec4(c.x*2.0-1.0, 1.0-c.y*2.0, 0.0, 1.0); }`;
const FS_HALO = `#version 300 es
precision highp float; in vec2 vL; flat in float vS; out vec4 o;
void main(){ float d = length(vL); o = vec4(1.0 - vS*smoothstep(1.75, 1.08, d)); }`;

// water drops: MRT (displacement, rim) + (highlight, radial)
const VS_DROP = `#version 300 es
layout(location=0) in vec2 aQ; layout(location=1) in vec4 aA; layout(location=2) in vec4 aB; layout(location=3) in vec4 aC; layout(location=4) in vec4 aD;
uniform vec4 uReg; uniform float uPx;
out vec2 vP; flat out vec4 vA; flat out vec4 vB; flat out vec4 vC; flat out vec4 vD;
void main(){
  vec2 dir = aB.xy; vec2 perp = vec2(-dir.y, dir.x);
  float r1 = aA.z, h = aA.w; float m = 1.0 + abs(aC.x) + abs(aC.z);
  float ex = r1*m*1.05 + 2.0*uPx;
  float y0 = -ex, y1 = h + r1*aB.z*m + 2.0*uPx;
  vec2 q = aQ*0.5+0.5;
  vec2 p = aA.xy + perp*mix(-ex, ex, q.x) + dir*mix(y0, y1, q.y);
  vP = p; vA = aA; vB = aB; vC = aC; vD = aD;
  vec2 c = (p - uReg.xy)/uReg.zw; gl_Position = vec4(c.x*2.0-1.0, 1.0-c.y*2.0, 0.0, 1.0);
}`;
const FS_DROP = `#version 300 es
precision highp float;
in vec2 vP; flat in vec4 vA; flat in vec4 vB; flat in vec4 vC; flat in vec4 vD;
uniform float uPx, uSDen;
layout(location=0) out vec4 o0; layout(location=1) out vec4 o1;
float sdUC(vec2 p, float r1, float r2, float h){
  p.x = abs(p.x); float b = (r1-r2)/h; float a = sqrt(max(1.0-b*b, 0.0)); float k = dot(p, vec2(-b,a));
  if(k < 0.0) return length(p) - r1; if(k > a*h) return length(p-vec2(0.0,h)) - r2; return dot(p, vec2(a,b)) - r1; }
void main(){
  vec2 head = vA.xy; float r1 = vA.z, h = vA.w;
  vec2 dir = vB.xy; vec2 perp = vec2(-dir.y, dir.x);
  float r2 = r1*vB.z; float alpha = vB.w;
  vec2 q = vP - head;
  vec2 lq = vec2(dot(q, perp), dot(q, dir));
  float th = atan(q.y, q.x);
  float pert = 1.0 + vC.x*cos(2.0*th + vC.y) + vC.z*cos(3.0*th + vC.w);
  vec2 pq = lq/pert;
  float hh = max(h, (r1 - r2)*1.02 + 1e-6);
  float sd = (h < 1e-7) ? length(pq) - r1 : sdUC(pq, r1, r2, hh);
  sd *= pert;
  float a = clamp(-sd/uPx + 0.5, 0.0, 1.0) * alpha;
  if(a <= 0.0) discard;
  float s = (h > 1e-7) ? clamp(lq.y/hh, 0.0, 1.0) : 0.0;
  float rho = mix(r1, r2, s)*pert;
  vec2 A = head + dir*(s*hh);
  float ur = clamp(1.0 - max(-sd, 0.0)/rho, 0.0, 1.0);
  vec2 e = vP - A; float el = length(e); e = el > 1e-9 ? e/el : vec2(0.0, 1.0);
  float f = ur*(0.78 + 0.22*ur*ur*ur);
  vec2 samp = A - e*(vD.x*0.5)*f;
  vec2 D = samp - vP;
  float rim = smoothstep(0.76, 1.0, ur); rim *= rim*(3.0-2.0*rim);
  // reflection of the carriage's ceiling light tube: a small, crisp, slightly elongated glint
  vec2 hc = head + vec2(-0.28, -0.44)*r1;
  vec2 sg = vec2(0.105, 0.042)*r1; vec2 se = max(sg, vec2(0.55*uPx));
  vec2 dh = (vP - hc)/se;
  float hl = vD.y * 1.6 * exp(-0.5*dot(dh,dh)) * (sg.x*sg.y)/(se.x*se.y);
  vec2 dh3 = (vP - hc)/max(sg*2.6, vec2(0.8*uPx));
  hl += vD.y * 0.06 * exp(-0.5*dot(dh3,dh3));
  o0 = vec4(D, rim, 1.0)*a;
  float mag = (vD.x*0.5/rho) * sqrt((0.78 + 0.88*ur*ur*ur)*(0.78 + 0.22*ur*ur*ur)) * uPx * uSDen;
  float lod = log2(max(mag, 1.0));
  o1 = vec4(hl, ur, lod, 1.0)*a;
}`;

// static mist base: R density, G micro-droplet coverage, B micro glint, A refog threshold noise
const FS_MIST = HDR + `
in vec2 vP; out vec4 o; uniform sampler2D uPatch; uniform float uPx;
void main(){
  vec2 p = vP;
  float lf = fbm(p*vec2(4.0, 3.0), 101);
  float d = mix(0.55, 1.0, smoothstep(0.25, 0.75, lf));
  float mf = fbm(p*vec2(11.0, 7.0) + vec2(5.0, 1.0), 103);
  d *= mix(0.72, 1.12, smoothstep(0.3, 0.75, mf));
  d *= 1.0 + 0.12*smoothstep(0.35, 0.0, p.y);   // the mist is a little heavier high on the glass
  d = min(d, 1.0);
  float pt = texture(uPatch, vec2(p.x/0.8, 1.0-p.y)).r;
  d *= mix(0.05, 1.0, pt);
  // micro droplets: jittered grid, three overlapping scales
  float cov = 0.0, gl = 0.0;
  for(int lvl=0; lvl<2; lvl++){
    float cs = lvl==0 ? 0.0024 : 0.0042;
    vec2 g = p/cs; ivec2 ci = ivec2(floor(g));
    for(int j=-1;j<=1;j++) for(int i=-1;i<=1;i++){
      ivec2 c = ci + ivec2(i,j);
      vec3 hA = h3(c, 200+lvl); vec3 hB = h3(c, 300+lvl);
      if(hA.z > (lvl==0 ? 0.80 : 0.45)*(0.35+0.65*d)) continue;
      vec2 ctr = (vec2(c) + 0.1 + 0.8*hA.xy)*cs;
      float r = (lvl==0 ? mix(0.00022, 0.00060, hB.x*hB.x) : mix(0.00055, 0.00110, hB.x*hB.x*hB.x));
      float dd = length(p - ctr);
      float cv = clamp((r - dd)/uPx + 0.5, 0.0, 1.0) * clamp(r/uPx*1.6, 0.0, 1.0);
      cov = max(cov, cv);
      vec2 uv = (p - ctr)/r - vec2(-0.3, -0.35);
      float se = max(0.25, uPx/r*0.6);
      gl = max(gl, cv*exp(-dot(uv,uv)/(2.0*se*se))*min(1.0, 0.0625/(se*se)));
    }
  }
  float n = clamp(vn(p*vec2(260.0), 401)*0.25 + vn(p*vec2(70.0, 45.0), 402)*0.75, 0.0, 1.0);
  o = vec4(d, cov, gl, n);
}`;

// final composite
const FS_COMP = HDR + `
in vec2 vP; in vec2 vUV; out vec4 o;
uniform sampler2D uC, uFs, uFl, uS, uFog, uMist, uW0, uW1;
uniform vec4 uSReg; uniform float uPx, uT, uExp, uFrame, uDbg;
uniform vec4 uWin; // frame opening: XL, YB, RC, GW
vec3 sampS(vec2 p, float lod){ vec2 uv = vec2((p.x - uSReg.x)/uSReg.z, 1.0 - (p.y - uSReg.y)/uSReg.w); return textureLod(uS, uv, lod).rgb; }
float frameSD(vec2 p){
  vec2 q = vec2(uWin.x + uWin.z - p.x, p.y - (uWin.y - uWin.z));
  if(q.x > 0.0 && q.y > 0.0) return length(q) - uWin.z;
  return max(uWin.x - p.x, p.y - uWin.y);
}
void main(){
  vec2 p = vP;
  vec3 C = texture(uC, vUV).rgb;
  vec3 Fs = texture(uFs, vUV).rgb, Fl = texture(uFl, vUV).rgb;
  vec4 mb = texture(uMist, vUV);
  float k = texture(uFog, vUV).r;
  float m = mb.r * k;
  vec3 scat = Fs*0.55 + Fl*0.45;
  float T = mix(1.0, 0.26, m);
  vec3 veil = vec3(0.00045, 0.00060, 0.0011);
  vec3 bg = C*T + scat*(1.0 - T)*1.05 + veil*m;
  // micro droplets in the mist: darker lens bodies with tiny back-lit glints
  float mc = mb.g*m, mg = mb.b*m;
  bg = mix(bg, bg*0.6 + scat*0.25, mc*0.5) + scat*mg*2.4 + veil*mg*16.0 + veil*mc*1.5;
  // water drops
  vec4 w0 = texture(uW0, vUV); vec4 w1 = texture(uW1, vUV);
  float a = w0.a;
  vec2 D = a > 1e-4 ? w0.xy/a : vec2(0.0);
  vec3 refr = sampS(p + D, a > 1e-4 ? w1.z/a : 0.0);
  if(a > 1e-4){
    float rim = w0.z/a, hl = w1.x/a, ur = w1.y/a;
    vec3 wc = refr*0.96*(1.0 - 0.88*rim) + vec3(0.0016,0.0021,0.0036)*rim*(1.0+2.0*rim) + hl*vec3(0.86,0.92,1.0);
    // the thinnest outer edge picks up a little of the glow behind it
    wc += scat*0.10*smoothstep(0.94, 1.0, ur);
    bg = mix(bg, wc, a);
  }
  // the carriage window frame (inside, in front of everything)
  float sd = frameSD(p);
  if(sd > -uPx*1.5){
    float fa = smoothstep(-uPx, uPx, sd);
    vec3 fc;
    float gw = uWin.w;
    vec2 inward = normalize(vec2(1.0, -0.6));
    vec3 pick = texture(uFs, vUV + vec2(0.04/0.8, 0.0)).rgb;
    if(sd < gw){
      float n = sd/gw;
      fc = vec3(0.0011,0.0012,0.0016) * (0.8 + 0.4*n);
      float prof = exp(-pow((n-0.30)/0.13, 2.0));
      fc += vec3(0.010,0.011,0.014)*prof*(0.7 + 0.5*vn(p*vec2(30.0, 3.0), 71));
      fc += pick*0.22*exp(-pow((n-0.12)/0.10, 2.0));
      fc *= 0.9 + 0.2*vn(p*900.0, 72);
    } else {
      float s2 = sd - gw;
      float shade = mix(1.25, 0.55, smoothstep(0.0, 1.0, p.y));
      fc = vec3(0.0026, 0.0028, 0.0038) * shade;
      // painted steel: orange-peel grain, a few greasy smudges, a soft sheen from the ceiling light
      float peel = fbm(p*vec2(700.0), 81);
      float smudge = smoothstep(0.45, 0.8, fbm(p*vec2(9.0, 14.0) + vec2(2.0, 5.0), 83));
      fc *= 0.80 + 0.32*peel + 0.18*smudge + 0.08*vn(p*vec2(6.0, 30.0), 82);
      fc *= 0.94 + 0.12*vn(gl_FragCoord.xy*0.5, 84);
      float sheen = exp(-pow((s2 - 0.022)/0.018, 2.0)) * (0.6 + 0.4*smudge);
      fc += vec3(0.0016, 0.0018, 0.0024) * sheen * shade;
      float bev = exp(-pow((s2 - 0.0035)/0.0016, 2.0));
      fc += vec3(0.010,0.0105,0.013)*bev*shade + pick*0.05*bev;
      fc += pick*0.03*exp(-s2/0.02);
    }
    bg = mix(bg, fc, fa);
  }
  if(uDbg > 0.5 && uDbg < 1.5) bg = sampS(p, 0.0);
  if(uDbg > 1.5 && uDbg < 2.5) bg = vec3(length(D)*2.0, a, w1.x/max(a,1e-4)*0.1)*0.2;
  if(uDbg > 2.5 && uDbg < 3.5) bg = refr*a;
  if(uDbg > 3.5) bg = textureLod(uS, vUV, uDbg - 4.0).rgb;
  // gentle lens vignette
  vec2 vq = (p - vec2(0.4, 0.5))/vec2(0.4, 0.5);
  bg *= 1.0 - 0.18*dot(vq, vq)*0.5;
  // tone map (filmic shoulder, linear toe), sRGB encode, dither
  vec3 x = bg*uExp;
  float lx = dot(x, vec3(0.2126, 0.7152, 0.0722));
  float lt = lx*(1.0 + lx/16.0)/(1.0 + lx);
  vec3 hp = x*(lt/max(lx, 1e-6));
  vec3 pc = x*(1.0 + x/16.0)/(1.0 + x);
  vec3 tm = mix(hp, pc, 0.4);
  float mx = max(tm.r, max(tm.g, tm.b));
  tm = mx > 1.0 ? mix(tm/mx, vec3(1.0), clamp((mx-1.0)*0.5, 0.0, 1.0)) : tm;
  tm = clamp(tm, 0.0, 1.0);
  float lt2 = dot(tm, vec3(0.2126, 0.7152, 0.0722));
  tm = clamp(mix(vec3(lt2), tm, 1.12), 0.0, 1.0);
  vec3 srgb = mix(tm*12.92, 1.055*pow(tm, vec3(1.0/2.4)) - 0.055, step(0.0031308, tm));
  vec3 dz = h3(ivec2(gl_FragCoord.xy), 11) + h3(ivec2(gl_FragCoord.xy), 18) - 1.0;
  o = vec4(srgb + dz/255.0, 1.0);
}`;

// ------------------------------------------------------------------ static assets drawn with canvas 2D
function makeLensTex() {
  const n = 128, d = new Uint8Array(n * n * 4);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const x = i / n * 2 - 1, y = j / n * 2 - 1, r = Math.hypot(x, y);
    let v = 0.5 + 0.35 * (vnoise2(i * 0.09, j * 0.09, 7) - 0.5) + 0.25 * (vnoise2(i * 0.3, j * 0.3, 8) - 0.5);
    v += 0.12 * Math.sin(r * 23 + vnoise2(i * 0.05, j * 0.05, 9) * 3);
    // a couple of dust specks inside the lens
    for (const s of [[0.31, -0.22, 0.05], [-0.42, 0.18, 0.04], [0.05, 0.5, 0.03]]) { const dd = Math.hypot(x - s[0], y - s[1]); if (dd < s[2]) v -= 0.35 * (1 - dd / s[2]); }
    const b = clamp(v, 0, 1) * 255;
    d.set([b, b, b, 255], (j * n + i) * 4);
  }
  return tex(n, n, 'rgba8', { data: d });
}

function makeWindowTex() {
  const w = 768, h = 640;
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const c = cv.getContext('2d');
  const rng = mulberry32(4242); const R = () => rng();
  const lx = w * 0.40, ly = h * 0.20;
  // back wall lit by a low pendant lamp
  let g = c.createRadialGradient(lx, ly + h * 0.06, 6, lx, ly + h * 0.12, w * 0.62);
  g.addColorStop(0, '#ffe7b0'); g.addColorStop(0.16, '#f2b45e'); g.addColorStop(0.45, '#a8561f'); g.addColorStop(0.8, '#4a1f0a'); g.addColorStop(1, '#2a1006');
  c.fillStyle = g; c.fillRect(0, 0, w, h);
  // wallpaper stripes, very faint
  c.globalAlpha = 0.07; c.fillStyle = '#2a1006';
  for (let x = 0; x < w; x += 22) c.fillRect(x, 0, 6, h);
  c.globalAlpha = 0.05;
  for (let i = 0; i < 2600; i++) { c.fillStyle = R() < 0.5 ? '#2a1006' : '#ffe9c0'; c.fillRect(R() * w, R() * h, 1 + R() * 3, 1 + R() * 3); }
  c.globalAlpha = 1;
  // a framed picture on the wall (no text)
  c.fillStyle = '#3a1a09'; c.fillRect(w * 0.07, h * 0.24, w * 0.15, h * 0.2);
  g = c.createLinearGradient(0, h * 0.26, 0, h * 0.42); g.addColorStop(0, '#d79a52'); g.addColorStop(1, '#8a4a1c');
  c.fillStyle = g; c.fillRect(w * 0.085, h * 0.26, w * 0.12, h * 0.16);
  c.fillStyle = 'rgba(40,16,6,0.6)'; c.beginPath(); c.moveTo(w * 0.085, h * 0.42); c.lineTo(w * 0.13, h * 0.33); c.lineTo(w * 0.16, h * 0.37); c.lineTo(w * 0.205, h * 0.30); c.lineTo(w * 0.205, h * 0.42); c.fill();
  // shelf with a kettle, a teapot and jars
  c.fillStyle = '#2b1207'; c.fillRect(w * 0.30, h * 0.60, w * 0.36, h * 0.02);
  c.fillStyle = '#1e0c05';
  c.beginPath(); c.ellipse(w * 0.36, h * 0.565, w * 0.04, h * 0.04, 0, 0, Math.PI * 2); c.fill();
  c.fillRect(w * 0.32, h * 0.555, w * 0.08, h * 0.045);
  c.fillRect(w * 0.395, h * 0.545, w * 0.03, h * 0.012);
  c.fillRect(w * 0.45, h * 0.545, w * 0.03, h * 0.055); c.fillRect(w * 0.49, h * 0.53, w * 0.035, h * 0.07); c.fillRect(w * 0.54, h * 0.56, w * 0.025, h * 0.04);
  c.fillStyle = 'rgba(255,214,140,0.65)'; c.beginPath(); c.ellipse(w * 0.348, h * 0.548, w * 0.008, h * 0.012, 0, 0, 7); c.fill();
  c.fillRect(w * 0.492, h * 0.535, 3, h * 0.06);
  // table edge in the lower part, catching the lamp
  g = c.createLinearGradient(0, h * 0.70, 0, h); g.addColorStop(0, '#5c2a0e'); g.addColorStop(0.05, '#2d1206'); g.addColorStop(1, '#140702');
  c.fillStyle = g; c.fillRect(0, h * 0.70, w, h * 0.30);
  c.fillStyle = 'rgba(255,196,120,0.55)'; c.fillRect(0, h * 0.70, w * 0.70, h * 0.006);
  // pendant: cord, conical shade, bright underside
  c.strokeStyle = '#1b0a04'; c.lineWidth = 3; c.beginPath(); c.moveTo(lx, 0); c.lineTo(lx, ly - h * 0.06); c.stroke();
  c.fillStyle = '#1f0d05'; c.beginPath(); c.moveTo(lx - w * 0.03, ly - h * 0.06); c.lineTo(lx + w * 0.03, ly - h * 0.06); c.lineTo(lx + w * 0.085, ly + h * 0.035); c.lineTo(lx - w * 0.085, ly + h * 0.035); c.closePath(); c.fill();
  g = c.createRadialGradient(lx, ly + h * 0.04, 2, lx, ly + h * 0.06, w * 0.16);
  g.addColorStop(0, 'rgba(255,255,236,1)'); g.addColorStop(0.2, 'rgba(255,236,180,0.75)'); g.addColorStop(1, 'rgba(255,190,110,0)');
  c.fillStyle = g; c.fillRect(lx - w * 0.2, ly + h * 0.03, w * 0.4, h * 0.3);
  c.fillStyle = '#fffbea'; c.beginPath(); c.ellipse(lx, ly + h * 0.037, w * 0.082, h * 0.012, 0, 0, 7); c.fill();
  // a plant on the inner sill, dark against the glow
  c.fillStyle = '#120703';
  c.fillRect(w * 0.08, h * 0.66, w * 0.08, h * 0.08);
  for (let i = 0; i < 9; i++) {
    const a = -Math.PI * 0.5 + (i - 4) * 0.28 + (R() - 0.5) * 0.2, L2 = h * (0.12 + R() * 0.12);
    c.beginPath(); c.ellipse(w * 0.12 + Math.cos(a) * L2 * 0.5, h * 0.66 + Math.sin(a) * L2 * 0.5, L2 * 0.5, w * 0.012, a, 0, 7); c.fill();
  }
  // curtain half drawn on the right: front-lit folds
  for (let i = 0; i < 8; i++) {
    const x0 = w * (0.70 + i * 0.038);
    const gg = c.createLinearGradient(x0, 0, x0 + w * 0.04, 0);
    gg.addColorStop(0, '#5a220b'); gg.addColorStop(0.5, i < 3 ? '#d9873e' : '#b86a2c'); gg.addColorStop(1, '#4a1b08');
    c.fillStyle = gg;
    c.beginPath(); c.moveTo(x0, 0); c.lineTo(x0 + w * 0.041, 0); c.lineTo(x0 + w * 0.041 + i * 2, h); c.lineTo(x0 - 3 + i * 1.6, h); c.closePath(); c.fill();
  }
  // condensation and grime on this window's glass
  c.globalAlpha = 0.12;
  for (let i = 0; i < 50; i++) { c.fillStyle = '#2b1709'; c.beginPath(); c.ellipse(R() * w, h * (0.6 + R() * 0.4), 6 + R() * 30, 2 + R() * 8, R() * 3, 0, 7); c.fill(); }
  c.globalAlpha = 1;
  // window frame: four panes
  c.fillStyle = '#100703';
  const fb = w * 0.05;
  c.fillRect(0, 0, w, fb); c.fillRect(0, h - fb * 1.3, w, fb * 1.3); c.fillRect(0, 0, fb, h); c.fillRect(w - fb, 0, fb, h);
  c.fillRect(w * 0.5 - fb * 0.33, 0, fb * 0.66, h); c.fillRect(0, h * 0.47 - fb * 0.3, w, fb * 0.6);
  c.fillStyle = 'rgba(255,190,110,0.32)'; c.fillRect(w * 0.5 + fb * 0.33 - 3, fb, 3, h - 2 * fb); c.fillRect(fb, h * 0.47 + fb * 0.3 - 3, w - 2 * fb, 3);
  c.fillStyle = 'rgba(255,200,130,0.5)'; c.fillRect(fb, h - fb * 1.3, w - 2 * fb, 3);
  const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, cv);
  gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return t;
}

// the clear patch in the mist: old, wide, half re-misted runner tracks
function makePatchTex() {
  const w = 640, h = 800;
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const c = cv.getContext('2d');
  const rng = mulberry32(777); const R = () => rng();
  c.fillStyle = '#fff'; c.fillRect(0, 0, w, h);
  const U = h; // px per unit
  c.lineCap = 'round'; c.lineJoin = 'round';
  // one irregular cleared area where the drops have merged and run off, at the height of the passing window,
  // with an old wide track leaving it downwards
  c.filter = 'blur(10px)';
  c.fillStyle = 'rgba(0,0,0,0.88)';
  for (const e of [[0.575, 0.528, 0.125, 0.062, -0.12], [0.505, 0.548, 0.07, 0.045, 0.3], [0.645, 0.512, 0.07, 0.05, -0.4], [0.60, 0.575, 0.06, 0.035, 0.2]]) {
    c.beginPath(); c.ellipse(e[0] * U, e[1] * U, e[2] * U, e[3] * U, e[4], 0, 7); c.fill();
  }
  c.filter = 'blur(3px)';
  c.strokeStyle = 'rgba(0,0,0,0.75)';
  {
    let x = 0.585, y = 0.58; c.beginPath(); c.moveTo(x * U, y * U);
    for (let i = 0; i < 30; i++) {
      const th = WIND + 0.16 * vnoise1(y * 7 + 3.3, 15) + 0.07 * vnoise1(y * 26, 16);
      x -= Math.sin(th) * 0.32 / 30; y += Math.cos(th) * 0.32 / 30;
      c.lineWidth = 0.026 * U * (1 - i / 40) * (0.85 + 0.3 * vnoise1(i * 0.4, 17));
      c.lineTo(x * U, y * U); c.stroke(); c.beginPath(); c.moveTo(x * U, y * U);
    }
  }
  c.filter = 'none';
  // speckled re-misting near the edges
  const id = c.getImageData(0, 0, w, h), d = id.data;
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const k = (j * w + i) * 4; let v = d[k] / 255;
    const nn = vnoise2(i * 0.35, j * 0.35, 19) * 0.6 + vnoise2(i * 0.08, j * 0.08, 20) * 0.4;
    v = clamp(v + (nn - 0.5) * 0.35 * (v * (1 - v) * 4), 0, 1);
    d[k] = d[k + 1] = d[k + 2] = v * 255;
  }
  c.putImageData(id, 0, 0);
  const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, cv);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return t;
}

// ------------------------------------------------------------------ setup
const P = {
  sky: prog(VS_FS, FS_SKY), bokeh: prog(VS_BOKEH, FS_BOKEH), box: prog(VS_FS, FS_BOX), copy: prog(VS_FS, FS_COPY),
  down: prog(VS_FS, FS_DOWN), mipdown: prog(VS_FS, FS_MIPDOWN), blur: prog(VS_FS, FS_BLUR), trail: prog(VS_TRAIL, FS_TRAIL), halo: prog(VS_HALO, FS_HALO),
  drop: prog(VS_DROP, FS_DROP), mist: prog(VS_FS, FS_MIST), comp: prog(VS_FS, FS_COMP),
};
const REG_F = [0, 0, FW, 1];
const SREG = [-0.45, -0.55, 1.7, 2.1];
const SW = Math.round(SREG[2] * HPX * 0.5), SH = Math.round(SREG[3] * HPX * 0.5);
const Wq = Math.ceil(WPX / 4), Hq = Math.ceil(HPX / 4), We = Math.ceil(WPX / 8), He = Math.ceil(HPX / 8);

const T = {
  Cst: tex(WPX, HPX, 'rgba16f'), C: tex(WPX, HPX, 'rgba16f'),
  Sst: tex(SW, SH, 'rgba16f'), S: tex(SW, SH, 'rgba16f', { mip: true }),
  q1: tex(Wq, Hq, 'rgba16f'), q2: tex(Wq, Hq, 'rgba16f'), e1: tex(We, He, 'rgba16f'), e2: tex(We, He, 'rgba16f'),
  fog: tex(WPX, HPX, 'rgba8'), mist: tex(WPX, HPX, 'rgba8'),
  w0: tex(WPX, HPX, 'rgba16f'), w1: tex(WPX, HPX, 'rgba16f'),
};
const FB = {
  Cst: fbo([T.Cst]), C: fbo([T.C]), Sst: fbo([T.Sst]), S: fbo([T.S]), q1: fbo([T.q1]), q2: fbo([T.q2]), e1: fbo([T.e1]), e2: fbo([T.e2]),
  fog: fbo([T.fog]), mist: fbo([T.mist]), water: fbo([T.w0, T.w1]),
};
const lensTex = makeLensTex(), winTex = makeWindowTex(), patchTex = makePatchTex();
const city = buildCity();
const sim = simulate();
console.log('sim: contacts', sim.contacts, 'durations', sim.durations.join(' '), 'slots', sim.nSlots, 'residue', sim.nDeps);

const bokehVAO = instVAO(2), dropVAO = instVAO(4), haloVAO = instVAO(1);
const bokehData = new Float32Array(8 * 4000);
const dropData = new Float32Array(16 * 20000);
const haloData = new Float32Array(4 * 20000);

// trail strips: built once
const trailVAO = gl.createVertexArray(); let trailCount = 0;
(function buildTrails() {
  const v = [];
  for (const ru of sim.runs) {
    const pts = [];
    let lx = -9, ly = -9;
    for (let k = 0; k < ru.n; k++) {
      const x = ru.track[k * 6], y = ru.track[k * 6 + 1];
      if (Math.hypot(x - lx, y - ly) < 0.0016 && k + 1 < ru.n) continue;
      pts.push([x, y, ru.ts + k / HZ, ru.track[k * 6 + 2]]); lx = x; ly = y;
    }
    const n = pts.length; if (n < 2) continue;
    const mrg = 2.5 * PX;
    for (let i = 0; i < n - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      const tx = b[0] - a[0], ty = b[1] - a[1], tl = Math.hypot(tx, ty) || 1;
      const nx = -ty / tl, ny = tx / tl;
      const wa = a[3] * 0.74 + mrg, wb = b[3] * 0.74 + mrg;
      const sa = wa / (a[3] * 0.74), sb = wb / (b[3] * 0.74);
      const ex = 0.0006 * tx / tl, ey = 0.0006 * ty / tl;
      const A1 = [a[0] - ex + nx * wa, a[1] - ey + ny * wa, sa, a[2]], A2 = [a[0] - ex - nx * wa, a[1] - ey - ny * wa, -sa, a[2]];
      const B1 = [b[0] + ex + nx * wb, b[1] + ey + ny * wb, sb, b[2]], B2 = [b[0] + ex - nx * wb, b[1] + ey - ny * wb, -sb, b[2]];
      v.push(...A1, ...A2, ...B1, ...A2, ...B2, ...B1);
    }
    const a = pts[0], r = a[3] * 0.74 + mrg, sc = r / (a[3] * 0.74);
    for (let k = 0; k < 16; k++) {
      const t0 = k / 16 * Math.PI * 2, t1 = (k + 1) / 16 * Math.PI * 2;
      v.push(a[0], a[1], 0, a[2], a[0] + Math.cos(t0) * r, a[1] + Math.sin(t0) * r, sc, a[2], a[0] + Math.cos(t1) * r, a[1] + Math.sin(t1) * r, sc, a[2]);
    }
  }
  gl.bindVertexArray(trailVAO);
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(v), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 16, 0);
  gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 16, 8);
  trailCount = v.length / 4;
})();

function setReg(p, r) { gl.uniform4f(p.u.uReg, r[0], r[1], r[2], r[3]); }

// bokeh instances for a list of lights at time t
function fillLights(list, t, sharp, reg, out, off) {
  let n = off;
  for (const l of list) {
    const lay = l.layer;
    let xs = [l.x];
    if (l.boxOff !== undefined) xs = [boxLeft(t) + l.boxOff];
    else if (lay === 0) xs = [l.x + SWAY(t)];
    if (lay) {
      const s = SHIFT[lay];
      let x = l.x - s * DOM * t / L;
      x = ((x - DOM0) % DOM + DOM) % DOM + DOM0;
      xs = [x - DOM, x, x + DOM];
    }
    const R = sharp ? (l.sharpW || 0.0022) : l.R;
    const len = l.len;
    let I = l.I;
    if (sharp) {
      // conserve power: the in-focus source is much smaller and far brighter
      if (len > 0) I = l.refl ? I * 0.25 * (l.R / R) : I * Math.min(l.R / R, 8);
      else I = I * Math.min((l.R * l.R) / (R * R), 600);
    }
    for (const x of xs) {
      if (x + R + 0.02 < reg[0] || x - R - 0.02 > reg[0] + reg[2]) continue;
      out[n * 8] = x; out[n * 8 + 1] = l.y; out[n * 8 + 2] = R; out[n * 8 + 3] = len;
      out[n * 8 + 4] = l.col[0] * I; out[n * 8 + 5] = l.col[1] * I; out[n * 8 + 6] = l.col[2] * I; out[n * 8 + 7] = l.fade;
      n++;
    }
  }
  return n;
}
city.L0.forEach(l => l.layer = 0); city.L1.forEach(l => l.layer = 1); city.L2.forEach(l => l.layer = 2);

// the very far layer is not pinned: a slight periodic drift as the line curves (a few px, closes on itself)
function SWAY(t) { return -0.0026 * Math.sin(2 * Math.PI * t / L) - 0.0008 * Math.sin(4 * Math.PI * t / L + 0.7); }
const boxRefl = [];
(function () { const rng = mulberry32(5151); reflColumn(boxRefl, 0, 0.615, 0.16, 0.10, [1.0, 0.52, 0.18], () => rng()); boxRefl.forEach(l => { l.boxOff = BOX.WX + BOX.WW * 0.5 + (l.x - 0); l.x = 0; }); })();
function bokehPass(list, t, sharp, reg, pxu) {
  const p = P.bokeh; gl.useProgram(p);
  setReg(p, reg);
  gl.uniform1f(p.u.uPadPx, 3 * pxu); gl.uniform1f(p.u.uPx, pxu);
  gl.uniform1f(p.u.uCat, sharp ? 0 : 0.55); gl.uniform1f(p.u.uCA, sharp ? 0 : 0.012); gl.uniform1f(p.u.uRing, sharp ? 0 : 1); gl.uniform1f(p.u.uLensAmt, sharp ? 0 : 0.22);
  gl.uniform2f(p.u.uFC, 0.4, 0.5); gl.uniform1f(p.u.uFD, Math.hypot(0.4, 0.5));
  bindT(p, 'uLens', lensTex, 0);
  const n = fillLights(list, t, sharp, reg, bokehData, 0);
  gl.enable(gl.BLEND); gl.blendEquation(gl.FUNC_ADD); gl.blendFunc(gl.ONE, gl.ONE);
  drawInst(bokehVAO, bokehData, n);
  gl.disable(gl.BLEND);
}

function boxPass(t, sharp, reg, pxu) {
  const bx = boxLeft(t);
  if (bx + BOX.W < reg[0] - 0.06 || bx > reg[0] + reg[2] + 0.06) return;
  const p = P.box; gl.useProgram(p); setReg(p, reg);
  gl.uniform1f(p.u.uBx, bx); gl.uniform1f(p.u.uBv, BOX.V); gl.uniform1f(p.u.uShut, 1 / 90);
  gl.uniform1f(p.u.uBlur, sharp ? 1.0 * pxu : 9.0 * PX); gl.uniform1f(p.u.uWBlur, sharp ? 1.0 * pxu : 2.4 * PX);
  gl.uniform1f(p.u.uWinI, sharp ? 2.2 : 1.55);
  gl.uniform4f(p.u.uBox, BOX.W, BOX.TOP, BOX.BOT, 0); gl.uniform4f(p.u.uWinR, BOX.WX, BOX.WY, BOX.WW, BOX.WH);
  bindT(p, 'uWin', winTex, 0);
  gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  drawFS();
  gl.disable(gl.BLEND);
}

// a tent-filtered pyramid (smoother than box mipmaps: the minified scene in the drops does not shimmer)
const mipFB = gl.createFramebuffer();
function buildMips(tx) {
  const p = P.mipdown; gl.useProgram(p); setReg(p, REG_F);
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tx); gl.uniform1i(p.u.uT, 0);
  gl.bindFramebuffer(gl.FRAMEBUFFER, mipFB); gl.drawBuffers([gl.COLOR_ATTACHMENT0]);
  let w = tx.w, h = tx.h, lv = 0;
  while (w > 1 || h > 1) {
    const sw = w, sh = h; w = Math.max(1, w >> 1); h = Math.max(1, h >> 1); lv++;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_BASE_LEVEL, lv - 1); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAX_LEVEL, lv - 1);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tx, lv);
    gl.viewport(0, 0, w, h);
    gl.uniform2f(p.u.uTexel, 1 / sw, 1 / sh); gl.uniform1f(p.u.uLod, lv - 1);
    drawFS();
  }
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_BASE_LEVEL, 0); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAX_LEVEL, lv);
}

function copyTo(src) { const p = P.copy; gl.useProgram(p); setReg(p, REG_F); bindT(p, 'uT', src, 0); drawFS(); }

// static layers (once)
(function buildStatic() {
  gl.disable(gl.BLEND);
  target(FB.Cst); gl.useProgram(P.sky); setReg(P.sky, REG_F); gl.uniform1f(P.sky.u.uHz, HORIZON); drawFS();
  target(FB.Sst); gl.useProgram(P.sky); setReg(P.sky, SREG); gl.uniform1f(P.sky.u.uHz, HORIZON); drawFS();
  target(FB.mist); gl.useProgram(P.mist); setReg(P.mist, REG_F); gl.uniform1f(P.mist.u.uPx, PX); bindT(P.mist, 'uPatch', patchTex, 0); drawFS();
})();
const moving = city.L0.concat(city.L1, city.L2);

// drops at time t
// a fresh drop swells over two or three frames as it spreads on impact, then settles with a small wobble
function swell(t0) {
  const SW = 0.085, x = Math.min(1, t0 / SW);
  const e = 1 - Math.pow(1 - x, 2.2);
  const w = t0 > SW ? 0.08 * Math.exp(-(t0 - SW) / 0.07) * Math.sin((t0 - SW) * 45) : 0;
  return e * (1 + w);
}
function landScale(tau, grows, h) {
  if (tau < 0) return 0;
  if (grows) {
    const g1 = 0.35 + h * 0.4, g2 = g1 + 0.3 + h * 0.5;
    const base = tau < g1 ? 0.55 : tau < g2 ? 0.8 : 1.0;
    const t0 = tau < g1 ? tau : tau < g2 ? tau - g1 : tau - g2;
    const prev = tau < g1 ? 0 : tau < g2 ? 0.55 : 0.8;
    return prev + (base - prev) * swell(t0);
  }
  return swell(tau);
}
function inIv(t, a, b) { if (t >= a && t < b) return t - a; if (t + L >= a && t + L < b) return t + L - a; if (t - L >= a && t - L < b) return t - L - a; return -1; }
function fillDrops(t) {
  const d = dropData; let n = 0;
  const hl = 1.0;
  const halo = haloData; let nh = 0;
  const put = (x, y, r, h, dx, dy, r2, a2, p2, a3, p3, span) => {
    const o = n * 16;
    d[o] = x; d[o + 1] = y; d[o + 2] = r; d[o + 3] = h; d[o + 4] = dx; d[o + 5] = dy; d[o + 6] = r2; d[o + 7] = 1;
    d[o + 8] = a2; d[o + 9] = p2; d[o + 10] = a3; d[o + 11] = p3; d[o + 12] = span; d[o + 13] = hl; d[o + 14] = 0; d[o + 15] = 0;
    n++;
    if (r > 0.0015) { halo[nh * 4] = x; halo[nh * 4 + 1] = y + h * 0.3; halo[nh * 4 + 2] = r * (1 + h / r * 0.4); halo[nh * 4 + 3] = 0.55; nh++; }
  };
  const absorbAnim = (x, y, r, age, ru, h) => {
    const k = runPos(ru, t); const p = Math.min(1, age / ABS_T), e = p * p * 0.85;
    const tx = k === null ? x : ru.track[k * 6], ty = k === null ? y : ru.track[k * 6 + 1];
    const rr = r * Math.cbrt(Math.max(0, 1 - p)); if (rr <= 0) return;
    put(lerp(x, tx, e), lerp(y, ty, e), rr, 0, 0, -1, 1, 0.02 * h, h * 6.283, 0, 0, SPAN);
  };
  for (const b of sim.stat) {
    let tau = -1;
    for (const iv of b.iv) { tau = inIv(t, iv[0], iv[1]); if (tau >= 0) break; }
    if (tau >= 0) {
      const sc = tau < 2 ? landScale(tau, b.grows, b.h) : 1;
      const r = b.r * sc;
      if (r > 0) {
        const big = b.r > 0.0034;
        const sag = big ? b.r * (0.18 + 0.25 * b.h2) : 0;
        put(b.x, b.y + sag * 0.3, r, sag, 0, -1, big ? 0.78 : 1,
          big ? 0.02 + 0.06 * b.h : 0.015 * b.h, b.h2 * 6.283, big ? 0.04 * b.h3 : 0, b.h3 * 6.283, clamp(0.30 + 40 * (b.r - 0.004), 0.30, 0.60) * (0.92 + 0.16 * b.h2));
      }
    }
    for (const [s0, ru] of b.abs) { const age = inIv(t, s0, s0 + ABS_T); if (age >= 0) absorbAnim(b.x, b.y, b.r, age, ru, b.h); }
  }
  for (const q of sim.resid) {
    const tau = inIv(t, q.a, q.b);
    if (tau >= 0) put(q.x, q.y, q.r * Math.min(1, tau / 0.03 + 0.3), 0, 0, -1, 1, 0.02 * q.h, q.h * 6.283, 0, 0, SPAN);
    if (q.by && q.b - q.a < L) { const age = inIv(t, q.b % L, q.b % L + ABS_T); if (age >= 0) absorbAnim(q.x, q.y, q.r, age, q.by, q.h); }
  }
  for (const ru of sim.runs) {
    for (const im of ru.imps) {
      const a = ru.ts + im.t0, b = ru.ts + im.tA;
      const tau = inIv(t, a % L, a % L + (b - a));
      if (tau >= 0) put(im.x, im.y, im.r * landScale(tau, false, 0.5), 0, 0, -1, 1, 0.03, im.t0 * 7, 0, 0, SPAN);
      const age = inIv(t, b % L, b % L + ABS_T);
      if (age >= 0) absorbAnim(im.x, im.y, im.r, age, ru, 0.5);
    }
    const k = runPos(ru, t);
    if (k === null) continue;
    const o = k * 6, h = hash2(ru.seed.id, 77);
    const sc = ru.seed.enter ? 1 : landScale(k / HZ, false, h);
    const r = ru.track[o + 2] * sc * 0.97; if (r <= 0) continue;
    put(ru.track[o], ru.track[o + 1], r, ru.track[o + 3] * sc, ru.track[o + 4], ru.track[o + 5], 0.42, 0.03 + 0.03 * h, h * 6.283, 0.02, h * 3.1, SPAN);
  }
  return [n, nh];
}

// ------------------------------------------------------------------ render
let PROF = null;
function renderAt(t, opts) {
  if (opts && opts.prof) { PROF = [performance.now()]; } else PROF = null;
  t = ((t % L) + L) % L;
  const frameNo = Math.round(t * 30);
  gl.disable(gl.BLEND);
  // 1. fog mask
  target(FB.fog); gl.clearColor(1, 1, 1, 1); gl.clear(gl.COLOR_BUFFER_BIT);
  gl.enable(gl.BLEND); gl.blendEquation(gl.MIN);
  gl.useProgram(P.trail); setReg(P.trail, REG_F); gl.uniform1f(P.trail.u.uT, t); gl.uniform1f(P.trail.u.uL, L); bindT(P.trail, 'uMist', T.mist, 0);
  gl.bindVertexArray(trailVAO); gl.drawArrays(gl.TRIANGLES, 0, trailCount);
  const [nd, nh] = fillDrops(t);
  gl.useProgram(P.halo); setReg(P.halo, REG_F); drawInst(haloVAO, haloData, nh);
  gl.blendEquation(gl.FUNC_ADD); gl.disable(gl.BLEND);
  if (PROF) { gl.finish(); PROF.push(performance.now()); }
  // 2. the scene, as the lens sees it (bokeh)
  target(FB.C); copyTo(T.Cst);
  bokehPass(moving, t, false, REG_F, PX);
  boxPass(t, false, REG_F, PX);
  bokehPass(boxRefl, t, false, REG_F, PX);
  if (PROF) { gl.finish(); PROF.push(performance.now()); }
  // 3. scattered light for the mist
  target(FB.q1); gl.useProgram(P.down); setReg(P.down, REG_F); bindT(P.down, 'uT', T.C, 0); gl.uniform2f(P.down.u.uTexel, 1 / WPX, 1 / HPX); gl.uniform1f(P.down.u.uK, 1.0); drawFS();
  const blur = (src, dstF, dir, sig) => { target(dstF); gl.useProgram(P.blur); setReg(P.blur, REG_F); bindT(P.blur, 'uT', src, 0); gl.uniform2f(P.blur.u.uDir, dir[0], dir[1]); gl.uniform1f(P.blur.u.uSig, sig); drawFS(); };
  blur(T.q1, FB.q2, [1 / Wq, 0], 5.0); blur(T.q2, FB.q1, [0, 1 / Hq], 5.0);   // q1 = small scatter
  target(FB.e1); gl.useProgram(P.down); bindT(P.down, 'uT', T.q1, 0); gl.uniform2f(P.down.u.uTexel, 1 / Wq, 1 / Hq); gl.uniform1f(P.down.u.uK, 0.5); drawFS();
  blur(T.e1, FB.e2, [1 / We, 0], 8.0); blur(T.e2, FB.e1, [0, 1 / He], 8.0);   // e1 = wide scatter
  if (PROF) { gl.finish(); PROF.push(performance.now()); }
  // 4. the sharp scene, for the drop lenses
  target(FB.S); copyTo(T.Sst);
  bokehPass(moving, t, true, SREG, SREG[3] / SH);
  boxPass(t, true, SREG, SREG[3] / SH);
  bokehPass(boxRefl, t, true, SREG, SREG[3] / SH);
  buildMips(T.S);
  if (PROF) { gl.finish(); PROF.push(performance.now()); }
  // 5. water
  target(FB.water); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
  gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  gl.useProgram(P.drop); setReg(P.drop, REG_F); gl.uniform1f(P.drop.u.uPx, PX); gl.uniform1f(P.drop.u.uSDen, SH / SREG[3]);
  drawInst(dropVAO, dropData, nd);
  gl.disable(gl.BLEND);
  if (PROF) { gl.finish(); PROF.push(performance.now()); }
  // 6. composite
  target(null);
  const p = P.comp; gl.useProgram(p); setReg(p, REG_F);
  bindT(p, 'uC', T.C, 0); bindT(p, 'uFs', T.q1, 1); bindT(p, 'uFl', T.e1, 2); bindT(p, 'uS', T.S, 3); bindT(p, 'uFog', T.fog, 4); bindT(p, 'uMist', T.mist, 5); bindT(p, 'uW0', T.w0, 6); bindT(p, 'uW1', T.w1, 7);
  gl.uniform4f(p.u.uSReg, SREG[0], SREG[1], SREG[2], SREG[3]);
  gl.uniform1f(p.u.uPx, PX); gl.uniform1f(p.u.uT, t); gl.uniform1f(p.u.uDbg, (opts && opts.dbg) || 0); gl.uniform1f(p.u.uExp, (opts && opts.exp) || 3.2); gl.uniform1f(p.u.uFrame, frameNo);
  gl.uniform4f(p.u.uWin, 0.072, 0.958, 0.10, 0.013);
  drawFS();
  if (PROF) { gl.finish(); PROF.push(performance.now()); window.__prof = PROF.map((v, i) => i ? (v - PROF[i - 1]).toFixed(0) : 0).join(' '); }
}

function grab() {
  const px = new Uint8Array(WPX * HPX * 4);
  gl.readPixels(0, 0, WPX, HPX, gl.RGBA, gl.UNSIGNED_BYTE, px);
  // flip to top-down rows
  const row = WPX * 4, out = new Uint8Array(px.length);
  for (let y = 0; y < HPX; y++) out.set(px.subarray((HPX - 1 - y) * row, (HPX - y) * row), y * row);
  let s = ''; const CH = 0x8000;
  for (let i = 0; i < out.length; i += CH) s += String.fromCharCode.apply(null, out.subarray(i, i + CH));
  return btoa(s);
}

window.__piece = {
  L, renderAt, ready: true, info: { contacts: sim.contacts, durations: sim.durations },
  frame(t, opts) { renderAt(t, opts); gl.finish(); return grab(); },
  drops(t) { const r = fillDrops(t); return Array.from(dropData.subarray(0, r[0] * 16)); },
};

if (!EXPORT) {
  if (Q.has('t')) renderAt(parseFloat(Q.get('t')));
  else {
    let t0 = null;
    const loop = (ts) => { if (t0 === null) t0 = ts; renderAt(((ts - t0) / 1000) % L); requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  }
} else if (Q.has('t')) renderAt(parseFloat(Q.get('t')));
})();
