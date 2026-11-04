// clouds.js - engraved towering cumulus: recursive billows, each shaded with
// nested crescent contour lines on its shadow side, scalloped ink outlines,
// and a ruled, darker flat base.
(function () {
  'use strict';
  const LW = window.LW, C = LW.C;
  const CREAM = '#efe5c6', SHADE = '#d9cfae', SHADE2 = '#c4c3a4';

  function makeBillow(rnd, cx, cy, r, level, dk) {
    const n = Math.max(48, Math.ceil(r * 0.9));
    const s1 = rnd() * 100, s2 = rnd() * 100;
    const flat = 0.06 + rnd() * 0.06;
    const R = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * LW.TAU;
      const ca = Math.cos(a), sa = Math.sin(a);
      let rr = r * (1 + 0.07 * LW.noise(ca * 1.3 + s1, sa * 1.3 + s2) + 0.025 * LW.noise(ca * 4 + s2, sa * 4 + s1));
      if (sa > 0) rr *= 1 - flat * sa * sa; // slightly flattened underside
      R.push(rr);
    }
    return { cx, cy, r, level, dk, R, n, seed: rnd() * 1000 };
  }
  function billowPts(b, inset = 0, shift = [0, 0]) {
    const pts = [];
    for (let i = 0; i < b.n; i++) {
      const a = (i / b.n) * LW.TAU;
      const rr = Math.max(1, b.R[i] - inset);
      pts.push([b.cx + shift[0] + Math.cos(a) * rr, b.cy + shift[1] + Math.sin(a) * rr]);
    }
    return pts;
  }
  const radAt = (b, a) => {
    let t = ((a / LW.TAU) % 1 + 1) % 1 * b.n;
    const i = Math.floor(t), f = t - i;
    return b.R[i % b.n] * (1 - f) + b.R[(i + 1) % b.n] * f;
  };

  // crescent hatching on the shadow side of a billow
  function crescents(pen, b, rnd, sp) {
    const [lx, ly] = LW.LIGHT2;
    const thS = Math.atan2(-ly, -lx); // shadow direction angle
    const depth = b.r * (0.25 + 0.8 * b.dk);
    const nArcs = Math.max(1, Math.floor(depth / sp));
    for (let k = 1; k <= nArcs; k++) {
      const kk = k / (nArcs + 1);
      const d = k * sp * (1 + 0.12 * LW.noise(b.seed, k * 0.7));
      const shift = d * 0.62;
      const half = (1.85 + 0.35 * b.dk) * Math.pow(1 - kk, 0.55) * (0.92 + 0.16 * rnd());
      if (half < 0.08) continue;
      const a0 = thS - half + 0.12 * rnd.gauss() * (1 - kk), a1 = thS + half + 0.12 * rnd.gauss() * (1 - kk);
      const len = (a1 - a0) * b.r;
      const m = Math.max(4, Math.ceil(len / 3));
      const pts = [];
      for (let j = 0; j <= m; j++) {
        const a = a0 + ((a1 - a0) * j) / m;
        const rr = radAt(b, a) - d + LW.noise3(a * 3 + b.seed, k * 0.5) * 1.2;
        pts.push([b.cx + lx * shift + Math.cos(a) * rr, b.cy + ly * shift + Math.sin(a) * rr]);
      }
      const wmax = (0.9 + 2.3 * b.dk) * (1 - 0.5 * kk) * (b.level === 0 ? 1.1 : 1);
      pen.line(pts, (t) => {
        const a = a0 + (a1 - a0) * t;
        const c = Math.cos(a - thS);
        return wmax * (0.35 + 0.65 * Math.max(0, c));
      }, 0.35, 0.05);
    }
  }

  // a couple of fine contour lines just inside the lit rim
  function litArcs(pen, b, rnd) {
    const [lx, ly] = LW.LIGHT2;
    const thL = Math.atan2(ly, lx);
    const k = b.r > 60 ? 2 : 1;
    for (let m = 1; m <= k; m++) {
      const d = m * 5.5;
      const half = rnd.range(0.5, 1.1);
      const a0 = thL - half + rnd.gauss() * 0.3, a1 = thL + half + rnd.gauss() * 0.3;
      const pts = [];
      for (let a = a0; a <= a1; a += 0.04) {
        const rr = radAt(b, a) - d;
        pts.push([b.cx + Math.cos(a) * rr, b.cy + Math.sin(a) * rr]);
      }
      if (pts.length > 3) pen.line(pts, 0.9, 0.45, 0.05);
    }
  }
  // outline: heavy on the shadow side, thin and broken on the lit side
  function billowOutline(pen, b, rnd) {
    const pts = billowPts(b);
    const [lx, ly] = LW.LIGHT2;
    const n = pts.length;
    let run = [];
    const runs = [];
    const gapSeed = rnd() * 50;
    for (let i = 0; i <= n; i++) {
      const a = ((i % n) / n) * LW.TAU;
      const sh = -(Math.cos(a) * lx + Math.sin(a) * ly); // 1 = shadow side
      const gap = sh < -0.35 && LW.noise3(a * 2.2 + gapSeed, b.seed) > 0.25 - 0.4 * (sh + 0.35);
      if (gap) { if (run.length > 2) runs.push(run); run = []; continue; }
      const w = (b.level === 0 ? 2.6 : 2.0) * (0.35 + 1.25 * Math.max(0, sh + 0.25)) * (0.75 + 0.35 * b.dk);
      run.push([pts[i % n][0], pts[i % n][1], w]);
    }
    if (run.length > 2) runs.push(run);
    for (const r of runs) pen.line(r.map((p) => [p[0], p[1]]), r.map((p) => p[2]), 0.08, 0.2);
  }

  function generate(rnd, lobes, opts) {
    const all = [];
    const { top, base, childLevels = 2 } = opts;
    const cxm = lobes.reduce((a, l) => a + l[0], 0) / lobes.length;
    const dkAt = (y, x = cxm) => LW.clamp(0.16 + 0.7 * Math.pow(LW.clamp((y - top) / (base - top), 0, 1), 1.15) + 0.22 * LW.clamp((x - cxm) / 400, -0.6, 1), 0, 1);
    const add = (cx, cy, r, level) => {
      if (cy - r * 0.2 > base) return;
      const b = makeBillow(rnd, cx, cy, r, level, LW.clamp(dkAt(cy, cx) + rnd.range(-0.12, 0.12), 0.05, 0.97));
      all.push(b);
      if (level >= childLevels || r < 26) return;
      const cnt = Math.round((LW.TAU * r) / (r * 0.62) * (level === 0 ? 0.75 : 0.6));
      for (let i = 0; i < cnt; i++) {
        // favour the upper and side perimeter
        const a = -Math.PI / 2 + rnd.gauss() * 1.25;
        const cr = r * rnd.range(0.3, 0.5) * (level === 0 ? 1 : 0.85);
        const dd = r - cr * rnd.range(0.25, 0.6);
        const x = cx + Math.cos(a) * dd, y = cy + Math.sin(a) * dd;
        if (y + cr * 0.3 > base) continue;
        add(x, y, cr, level + 1);
      }
    };
    for (const l of lobes) add(l[0], l[1], l[2], 0);
    // painter: top first so lower billows overlap the shaded bellies of higher ones
    all.sort((a, b) => a.cy + a.r * 0.35 - (b.cy + b.r * 0.35));
    return all;
  }

  async function drawCloud(rnd, lobes, opts) {
    const base = opts.base;
    const billows = generate(rnd, lobes, opts);
    const g = LW.fill;
    const clip = new Path2D();
    clip.moveTo(-50, -50);
    clip.lineTo(LW.W + 50, -50);
    for (let x = LW.W + 50; x >= -50; x -= 20) clip.lineTo(x, base + LW.noise(x * 0.004, 3.3) * 10);
    clip.closePath();
    const unionPath = new Path2D();
    g.save(); g.clip(clip);
    LW.ink.save(); LW.ink.clip(clip);
    // ---- painter's pass: plates + scalloped contours
    const polys = [];
    for (const b of billows) {
      const pts = billowPts(b);
      polys.push(pts);
      const path = LW.polyPath(pts);
      unionPath.addPath(path);
      LW.occlude(path);
      LW.flat(path, CREAM);
      g.save();
      g.clip(path);
      g.fillStyle = b.dk > 0.72 ? SHADE2 : SHADE;
      g.fill(path);
      const t = b.r * (0.08 + 0.4 * b.dk);
      g.fillStyle = CREAM;
      g.fill(LW.polyPath(billowPts(b, t * 0.35, [LW.LIGHT2[0] * t, LW.LIGHT2[1] * t])));
      g.restore();
      const pen = new LW.Pen();
      billowOutline(pen, b, rnd);
      pen.draw(LW.ink, C.ink);
    }
    // ---- id map of the visible billow (painter's order) at half resolution
    const ub = { x0: opts.x0, y0: opts.top - 140, x1: opts.x1, y1: base + 10 };
    const res = 0.5;
    const iw = Math.ceil((ub.x1 - ub.x0) * res), ih = Math.ceil((ub.y1 - ub.y0) * res);
    const idc = LW.canvas(iw, ih);
    const ig = idc.getContext('2d', { willReadFrequently: true });
    ig.setTransform(res, 0, 0, res, -ub.x0 * res, -ub.y0 * res);
    billows.forEach((b, i) => {
      const k = i + 1;
      ig.fillStyle = `rgb(${k & 255},${(k >> 8) & 255},0)`;
      ig.fill(LW.polyPath(polys[i]));
    });
    const idd = ig.getImageData(0, 0, iw, ih).data;
    const idAt = (x, y) => {
      const i = ((x - ub.x0) * res) | 0, j = ((y - ub.y0) * res) | 0;
      if (i < 0 || j < 0 || i >= iw || j >= ih) return 0;
      const q = (j * iw + i) * 4;
      if (idd[q + 3] < 250) return 0;
      return idd[q] + (idd[q + 1] << 8);
    };
    const L3 = (() => { const v = [-0.45, -0.6, 0.66]; const m = Math.hypot(...v); return v.map((a) => a / m); })();
    const darkAt = (x, y) => {
      const id = idAt(x, y);
      if (!id || id > billows.length) return 0;
      const b = billows[id - 1];
      const a = Math.atan2(y - b.cy, x - b.cx);
      const R = radAt(b, a) * 1.02;
      const dx = (x - b.cx) / R, dy = (y - b.cy) / R;
      const rho = dx * dx + dy * dy;
      if (rho > 1.05) return 0;
      const nz = Math.sqrt(Math.max(0, 1 - rho));
      const lam = Math.max(0, -dx * L3[0] - dy * L3[1] + nz * L3[2]);
      let d = 1 - lam;
      d = 0.95 * d + 0.26 * b.dk - 0.3;
      return LW.clamp(d + 0.06 * LW.noise(x * 0.02, y * 0.02), 0, 1);
    };
    const mask = LW.Mask.fromPath(unionPath, ub, 0.5);
    const lines = LW.streamlines({
      bbox: ub, seed: Math.floor(opts.top),
      inside: (x, y) => mask.in(x, y),
      region: idAt,
      dir: (x, y) => {
        const id = idAt(x, y);
        if (!id || id > billows.length) return null;
        const b = billows[id - 1];
        const dx = x - b.cx, dy = (y - b.cy) * 1.08;
        const l = Math.hypot(dx, dy) || 1;
        if (b.r < 55) return [1, 0.04 * Math.sin(x * 0.02)]; // small lower billows: ruled, not ringed
        if (l < b.r * 0.38) return null;
        return [-dy / l, dx / l];
      },
      sep: (x, y) => { const d = darkAt(x, y); return d < 0.28 ? 0 : (opts.sp0 || 2.5) + 10 * Math.pow(1 - d, 1.6); },
      step: 2.2, minLen: 8, seedGrid: 14, cell: 5, test: 0.62,
    });
    const pen = new LW.Pen();
    LW.drawLines(pen, lines, (x, y) => 0.35 + 1.35 * Math.pow(darkAt(x, y), 1.4), 0.35, 0.05);
    // the flat shadowed base: a ruled band thickening downward, and a firm base line
    const band = opts.baseBand || 70;
    const bb2 = { x0: ub.x0, y0: base - band, x1: ub.x1, y1: base + 12 };
    LW.hatchDither(pen, bb2, 0.0, {
      spacing: 2.7, step: 4, wob: 2.2, seed: 31, inside: (x, y) => mask.in(x, y), jitter: 0.15,
      dark: (x, y) => { const t = LW.clamp((y - (base - band)) / band, 0, 1); return t <= 0 ? 0 : 0.12 + 0.62 * Math.pow(t, 1.5) + 0.08 * LW.noise(x * 0.01, y * 0.03); },
      w: (x, y, d) => 0.5 + 1.6 * d, taper: 0.35,
    });
    pen.draw(LW.ink, C.ink);
    {
      g.save(); g.clip(unionPath);
      const sh = new LW.Pen();
      for (let y = base - band * 0.45; y < base + 12; y += 3) {
        const t = (y - (base - band * 0.45)) / (band * 0.45);
        sh.line([[ub.x0, y], [ub.x1, y]], 3 * Math.min(1, t * 0.9), 0);
      }
      sh.draw(g, SHADE2);
      g.restore();
    }
    LW.ink.restore();
    g.restore();
    await LW.tick();
  }

  LW.drawClouds = async function () {
    const rnd = LW.rng('clouds');
    // distant low bank along the horizon (small, pale, lightly drawn)
    const bank = [];
    for (let x = -60; x < 1500; x += rnd.range(60, 110)) bank.push([x, 2150 - rnd.range(0, 30), rnd.range(40, 75)]);
    await drawCloud(rnd, bank, { top: 2040, base: 2186, childLevels: 1, x0: -80, x1: 1600, sp0: 2.2, baseBand: 26 });
    // the towering cumulus over the sea
    const dx = -100;
    const L = [
      // base row
      [470, 2010, 150], [600, 1975, 185], [780, 1960, 200], [960, 1985, 180], [1120, 2015, 150], [340, 2045, 115], [1260, 2050, 110],
      // lower middle
      [520, 1790, 170], [700, 1760, 205], [890, 1790, 175], [1050, 1840, 140],
      // middle
      [580, 1570, 165], [760, 1540, 185], [920, 1590, 150], [470, 1640, 120],
      // upper
      [650, 1360, 160], [820, 1330, 165], [960, 1400, 120], [540, 1430, 110],
      // crown
      [720, 1170, 150], [860, 1150, 120], [610, 1230, 115], [770, 1030, 105], [900, 1040, 80],
    ].map((l) => [l[0] + dx, l[1], l[2]]);
    await drawCloud(rnd, L, { top: 940, base: 2128, childLevels: 2, x0: 100, x1: 1400, baseBand: 80 });
  };
})();
