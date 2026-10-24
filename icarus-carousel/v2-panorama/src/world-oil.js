// II. THE ASCENT (panorama) — the impasto sky. On its left it is still wet
// against the torn page (and spills onto it); on its right its sun-rings run
// straight on into the hard gouache of III.
SC.WORLD.oil = async function (S) {
  const DH = SC.DH, HZ = SC.HZ, SUN = SC.SUN, FIG = SC.FIG;
  const X0 = 700, X1 = 2320;
  const Ly = SC.layer(X0, X1, S, true);
  const ctx = Ly.ctx, hctx = Ly.hctx;
  const R = new L.Rand(2207), N = L.noise2(5), N2 = L.noise2(6), N3 = L.noise2(7);
  const P = (h) => L.hex(h);
  const FANG = Math.atan2(655 - FIG[1], 1800 - FIG[0]);
  const trail = SC.ASCENT;
  const I = SC.ISLE;

  // ---------- direction field ----------
  const vortex = (x, y, cx, cy, r, sgn) => { const dx = x - cx, dy = y - cy, d = Math.hypot(dx, dy); const w = Math.exp(-(((d - r * 0.6) / r) ** 2)) * 1.4 * L.smooth(r * 0.1, r * 0.55, d); return [(-dy / (d + 1)) * sgn * w, (dx / (d + 1)) * sgn * w]; };
  function trailNear(x, y) {
    let best = 1e9, bi = 0;
    for (let i = 0; i < trail.length; i += 3) { const d = (trail[i][0] - x) ** 2 + (trail[i][1] - y) ** 2; if (d < best) { best = d; bi = i; } }
    return [Math.sqrt(best), bi];
  }
  function field(x, y) {
    if (y > HZ - 6) return 0.08 * Math.sin(x / 60 + y / 30) + 0.22 * N(x / 140, y / 50);
    const dx = x - SUN[0], dy = y - SUN[1], d = Math.hypot(dx, dy);
    const ws = 2.6 * Math.exp(-Math.max(0, d - 420) / 420);
    let vx = (-dy / d) * ws, vy = (dx / d) * ws;
    const base = -0.3 + 1.6 * L.fbm(N, x / 520, y / 520, 3);
    vx += Math.cos(base) * 0.7; vy += Math.sin(base) * 0.7;
    for (const v of [vortex(x, y, 1170, 430, 220, 1), vortex(x, y, 1720, 1150, 170, -1)]) { vx += v[0]; vy += v[1]; }
    const [td, ti] = trailNear(x, y);
    if (td < 70) {
      const a = trail[Math.max(0, ti - 2)], b = trail[Math.min(trail.length - 1, ti + 2)];
      const tl = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, w = 3 * (1 - td / 70);
      vx += ((b[0] - a[0]) / tl) * w; vy += ((b[1] - a[1]) / tl) * w;
    }
    return Math.atan2(vy, vx);
  }

  // ---------- colour field ----------
  const sky = [P('#1b3784'), P('#24489c'), P('#2f5fb8'), P('#3c75c6'), P('#5b93d2'), P('#86b4df')];
  const cloudC = [P('#f6f1dc'), P('#eef0ea'), P('#d6e0ee'), P('#b9c9e4'), P('#f3e3b0')];
  const seaC = [P('#0f2255'), P('#16306c'), P('#1e4384'), P('#284f93')];
  function cloudAmt(x, y) {
    const wx = x + 120 * N2(x / 400, y / 400), wy = y + 120 * N2(x / 400 + 9, y / 400);
    return L.fbm(N3, wx / 430, wy / 260, 4) + 0.22 * L.smooth(700, 1300, y) - 0.12 - 0.3 * L.smooth(1500, 1900, x);
  }
  const isleK = (x, y) => ((x - I.cx) / I.rx) ** 2 + ((y - I.cy) / I.ry) ** 2 + 0.2 * N(x / 60, y / 40);
  function colourAt(x, y) {
    if (y > HZ) {
      const isl = isleK(x, y);
      if (isl < 1) { const lit = L.clamp(0.55 - (y - I.cy) / 80 + (x - I.cx) / 600 + R.gauss(0, 0.2)); return lit > 0.55 ? R.pick([P('#e0b866'), P('#d9a64c'), P('#f0cf7e')]) : lit > 0.3 ? R.pick([P('#c98f3a'), P('#8d8a3c'), P('#a8853a')]) : R.pick([P('#8a4a26'), P('#6b3d22'), P('#56602e')]); }
      if (isl < 1.3) return R.pick([P('#e7eef2'), P('#bcd6e6'), P('#5a86b8')]);
      const gold = L.smooth(1500, 2150, x) * 0.25;
      if (R.chance(gold)) return R.pick([P('#f1c43e'), P('#f8de6a'), P('#fff1a6')]);
      if (R.chance(0.03)) return P('#dfeaf2');
      return L.mix(R.pick(seaC), P('#0a1840'), L.smooth(HZ, DH, y) * 0.4);
    }
    const dx = x - SUN[0], dy = y - SUN[1], d = Math.hypot(dx, dy);
    const warm = L.smooth(1260, 520, d);
    if (R.chance(warm * 0.8)) return R.pick([P('#fff1a6'), P('#fbe7a0'), P('#d7ecf2'), P('#fff7cf'), P('#a9cbe8'), P('#f8de6a'), P('#86b4df')]);
    const dF = Math.hypot(x - FIG[0], (y - FIG[1]) * 0.85);
    if (dF < 320 && R.chance(L.smooth(320, 100, dF) * 0.9)) return R.pick([P('#cfe3f1'), P('#a9cbe8'), P('#e8f0ec'), P('#fff3c4'), P('#bcd8ee')]);
    // morning: the sky pales as it nears the page
    const morning = L.smooth(1330, 960, x);
    if (R.chance(morning * 0.7)) return R.pick([P('#cfe3f1'), P('#e9eee8'), P('#a9cbe8'), P('#f4ead0'), P('#86b4df')]);
    const c = cloudAmt(x, y);
    if (c > 0.22) { const under = cloudAmt(x, y - 40) - c; return under > 0.04 && R.chance(0.7) ? R.pick(cloudC.slice(2, 4)) : R.pick(cloudC); }
    if (c > 0.17 && R.chance(0.5)) return R.pick(sky.slice(3, 5));
    const mist = L.smooth(HZ - 170, HZ, y);
    let idx = L.clamp(Math.floor((0.25 + 0.12 * R.next() + 0.25 * N2(x / 160, y / 160) + 0.35 * (1 - y / HZ) * 0.6) * sky.length), 0, sky.length - 1);
    let col = sky[idx];
    if (mist > 0) col = L.mix(col, R.pick([P('#c2d6ea'), P('#9ebfe0'), P('#e6eef0')]), mist * 0.8);
    if (R.chance(0.05)) col = R.pick([P('#f1d675'), P('#a9d0e6'), P('#122a6b')]);
    return col;
  }

  // ---------- painting ----------
  const g0 = ctx.createLinearGradient(0, 0, 0, DH);
  g0.addColorStop(0, '#6c9ad6'); g0.addColorStop(0.5, '#2f5fb8'); g0.addColorStop(0.76, '#a7c2e0'); g0.addColorStop(0.78, '#17306c'); g0.addColorStop(1, '#0d1e4c');
  ctx.fillStyle = g0; ctx.fillRect(X0, 0, X1 - X0, DH);
  hctx.fillStyle = '#202020'; hctx.fillRect(X0, 0, X1 - X0, DH);

  function pass(spacing, wmin, wmax, lmin, lmax, o = {}) {
    const pts = [];
    for (let y = -20; y < DH + 20; y += spacing) for (let x = X0 - 20; x < X1 + 20; x += spacing) pts.push([x + R.r(0, spacing), y + R.r(0, spacing)]);
    for (let i = pts.length - 1; i > 0; i--) { const j = Math.floor(R.next() * (i + 1)); [pts[i], pts[j]] = [pts[j], pts[i]]; }
    for (const [x, y] of pts) {
      if (o.where && !o.where(x, y)) continue;
      const line = L.trace(x, y, R.r(lmin, lmax), 3, field);
      L.bristle(ctx, hctx, line, { R, width: R.r(wmin, wmax), color: colourAt(x, y), height: o.height ?? R.r(0.45, 0.85), dry: o.dry ?? 0.3, alpha: o.alpha ?? 1, dl: 0.045 });
    }
  }
  pass(16, 18, 26, 45, 80, { dry: 0.15 });
  pass(11, 11, 16, 28, 50);
  const edgy = (x, y) => { const c = cloudAmt(x, y); return (c > 0.14 && c < 0.38) || Math.hypot(x - SUN[0], y - SUN[1]) < 1100 || Math.abs(y - HZ) < 40 || isleK(x, y) < 1.5; };
  pass(8, 7, 10, 18, 32, { where: edgy, height: 0.9 });
  for (let i = 0; i < 2400; i++) {
    const x = R.r(X0, X1), y = R.r(0, HZ - 30);
    if (cloudAmt(x, y) > 0.1 || Math.hypot(x - SUN[0], y - SUN[1]) < 1150 || x < 1250) continue;
    L.bristle(ctx, hctx, L.trace(x, y, R.r(14, 26), 2.5, field), { R, width: R.r(3, 5), color: R.pick([P('#101f5c'), P('#16307a')]), height: 0.95, dry: 0.1 });
  }

  // ---------- the sun's rings, laid on in thick paint: they carry straight on into III ----------
  for (const [r0, r1, hex] of SC.HALO) {
    const rm = (r0 + r1) / 2, w = r1 - r0, col = P(hex);
    const step = 34 / rm;
    for (let a = -Math.PI; a < Math.PI; a += step * R.r(0.7, 1)) {
      const pts = [];
      for (let k = 0; k <= 8; k++) { const aa = a + step * 1.35 * k / 8; pts.push([SUN[0] + Math.cos(aa) * rm, SUN[1] + Math.sin(aa) * rm]); }
      const mid = pts[4];
      if (mid[0] < X0 - 20 || mid[1] > HZ - 4) continue;
      L.bristle(ctx, hctx, pts, { R, width: w * R.r(1.0, 1.15), color: col, height: 0.95, dry: 0.12, dl: 0.04, taperA: 0.08, taperB: 0.1 });
    }
  }

  // ---------- the island: the oil half of the labyrinth ----------
  {
    const walls = L.labyrinth(SC.LAB.cx, SC.LAB.cy, SC.LAB.r, SC.LAB.rings, new L.Rand(SC.LAB.seed), SC.LAB.sy);
    for (const w of walls) {
      const r = L.resample(w, 3);
      for (let i = 0; i < r.length - 1; i += 5) L.bristle(ctx, hctx, r.slice(i, i + 7), { R, width: 5.5, color: R.pick([P('#4a2614'), P('#5b301a'), P('#3a2010')]), height: 1, dry: 0.1, taperA: 0.05, taperB: 0.05 });
    }
    for (const w of walls) {
      const r = L.resample(w, 3).map(([x, y]) => [x + 1.5, y - 2]);
      for (let i = 0; i < r.length - 1; i += 9) if (R.chance(0.6)) L.bristle(ctx, hctx, r.slice(i, i + 4), { R, width: 2.6, color: P('#f2cd7e'), height: 1, dry: 0.2 });
    }
  }

  // ---------- the wake ----------
  for (let k = 0; k < 26; k++) {
    const off = R.gauss(0, 14), s0 = Math.floor(R.r(0, trail.length * 0.6)), e0 = Math.min(trail.length - 8, s0 + Math.floor(R.r(30, 90)));
    const seg = trail.slice(s0, e0); if (seg.length < 3) continue; const nr = L.normals(seg);
    const line = seg.map((p, i) => [p[0] + nr[i][0] * off * (0.3 + i / seg.length), p[1] + nr[i][1] * off * (0.3 + i / seg.length)]);
    L.bristle(ctx, hctx, line, { R, width: R.r(4, 9) * (0.6 + s0 / trail.length), color: R.pick([P('#fffaf0'), P('#f8f0d0'), P('#fde9a0'), P('#e4eef6')]), height: 0.95, dry: 0.35 });
  }
  for (let k = 0; k < 30; k++) {
    const s0 = Math.floor(R.r(trail.length * 0.4, trail.length - 14)), seg = trail.slice(s0, s0 + Math.floor(R.r(12, 40))), nr = L.normals(seg), off = R.gauss(0, 14);
    L.bristle(ctx, hctx, seg.map((p, i) => [p[0] + nr[i][0] * off, p[1] + nr[i][1] * off]), { R, width: R.r(5, 10), color: R.pick([P('#ffffff'), P('#fff4c4'), P('#f6d66e')]), height: 1, dry: 0.4 });
  }

  // ---------- the flock, now in paint ----------
  for (const [bx, by, ph] of SC.BIRDS) {
    if (bx < 930) continue;
    const s = 1.25 + (bx - 930) / 900, rot = -0.38 + Math.sin(ph) * 0.08, c = Math.cos(rot), sn = Math.sin(rot);
    const T = ([px, py]) => [bx + (px * c - py * sn) * s, by + (px * sn + py * c) * s];
    const lift = Math.sin(ph), fold = 0.5 + 0.5 * Math.cos(ph);
    for (const sd of [-1, 1]) {
      const wing = L.catmull([[0, 0], [sd * 5, -4 - lift * 5], [sd * (11 + fold * 2), -2 - lift * 8], [sd * (19 + fold * 3), 2 - lift * 6 + fold * 3]], 6).map(T);
      L.bristle(ctx, hctx, wing, { R, width: 5.5 * s, color: P('#13204e'), height: 1, dry: 0.1, taperA: 0.05, taperB: 0.6 });
      L.bristle(ctx, hctx, wing.slice(0, 5).map(([x, y]) => [x - 0.8, y - 1.2]), { R, width: 2 * s, color: P('#fff3d0'), height: 1, dry: 0.3 });
    }
    L.bristle(ctx, hctx, [T([-1, 0.5]), T([2, 0.5])], { R, width: 5 * s, color: P('#13204e'), height: 1, dry: 0.1 });
  }

  // ---------- Icarus ----------
  {
    const dx = Math.cos(FANG), dy = Math.sin(FANG), nx = -dy, ny = dx;
    const FS = 1.35, at = (a, b) => [FIG[0] + (dx * a + nx * b) * FS, FIG[1] + (dy * a + ny * b) * FS];
    const stroke = (pts, w, col, h = 1, dry = 0.15) => L.bristle(ctx, hctx, L.catmull(pts, 8), { R, width: w, color: col, height: h, dry });
    // broken, overlapping strokes: n jittered passes in a family of colours
    const daub = (pts, w, cols, n = 3, j = 2, dry = 0.35) => {
      for (let k = 0; k < n; k++) {
        const jx = R.gauss(0, j), jy = R.gauss(0, j), cut0 = R.r(0, 0.15), cut1 = R.r(0.85, 1);
        const sm = L.catmull(pts.map(([x, y]) => [x + jx, y + jy]), 8);
        const sl = sm.slice(Math.floor(cut0 * sm.length), Math.ceil(cut1 * sm.length));
        L.bristle(ctx, hctx, sl, { R, width: w * R.r(0.75, 1.05), color: R.pick(cols), height: R.r(0.8, 1), dry, dl: 0.06 });
      }
    };
    // a few warm flecks of radiance, swept along by the wind
    for (let k = 0; k < 40; k++) {
      const a = R.r(0, Math.PI * 2), r0 = R.r(90, 260);
      const p = [FIG[0] + Math.cos(a) * r0, FIG[1] + Math.sin(a) * r0];
      L.bristle(ctx, hctx, L.trace(p[0], p[1], R.r(16, 30), 3, field), { R, width: R.r(5, 8), color: R.pick([P('#fbe8a0'), P('#cfe3f1'), P('#f6d66e')]), height: 0.9, dry: 0.3 });
    }
    const DARK = P('#122059'), CREAM = [P('#fffdf4'), P('#f7efd6'), P('#fbe9b0'), P('#ffffff'), P('#e3ecf4'), P('#f2dc9a')];
    const GOLD = [P('#e9b244'), P('#d99a2e'), P('#f3cd6a'), P('#c9852a')];
    const SKIN = [P('#c67a44'), P('#b7683a'), P('#d68d50'), P('#a85d33')];
    for (const sd of [-1, 1]) {
      const arm = L.resample(L.catmull([at(22, sd * 10), at(42, sd * 85), at(78, sd * 165), at(70, sd * 250)], 10), 4);
      const feathers = [];
      for (let i = 2; i < arm.length; i += 1) {
        const u = i / (arm.length - 1);
        const back = Math.atan2(-dy, -dx) + sd * (-0.45 + 1.5 * u * u) + R.gauss(0, 0.03);
        const len = (85 + 70 * L.smooth(0.3, 0.95, u) - 20 * L.smooth(0.92, 1, u)) * R.r(0.93, 1.05);
        feathers.push({ p: arm[i], a: back, len, u });
      }
      const tipsLine = feathers.map((f) => [f.p[0] + Math.cos(f.a) * f.len * 0.9, f.p[1] + Math.sin(f.a) * f.len * 0.9]);
      const poly = arm.slice(2).concat(tipsLine.slice().reverse());
      ctx.fillStyle = L.css(P('#dcd8c4')); L.path(ctx, poly, true); ctx.fill();
      hctx.fillStyle = '#777'; L.path(hctx, poly, true); hctx.fill();
      // shadowed trailing edge
      for (let i = 0; i < tipsLine.length - 2; i += 2) daub([tipsLine[i], tipsLine[i + 2]].map(([x, y]) => [x + 3, y + 4]), 9, [DARK, P('#1d3a8a')], 1, 1, 0.2);
      for (let i = feathers.length - 1; i >= 0; i--) {
        const f = feathers[i], b = f.p, t = [b[0] + Math.cos(f.a) * f.len, b[1] + Math.sin(f.a) * f.len];
        const m = [(b[0] + t[0]) / 2 + Math.cos(f.a + sd * 1.57) * 6, (b[1] + t[1]) / 2 + Math.sin(f.a + sd * 1.57) * 6];
        daub([b, m, t], 14, f.u > 0.7 && sd > 0 ? CREAM.concat([P('#b9c9e4'), P('#9fb6dc')]) : CREAM, 2, 1.5, 0.3);
      }
      // sunlit coverts
      for (let i = 0; i < arm.length - 3; i += 1) {
        const b = arm[i], a = Math.atan2(-dy, -dx) + sd * 0.25;
        daub([b, [b[0] + Math.cos(a) * 36, b[1] + Math.sin(a) * 36]], 11, [P('#f6e6b8'), P('#efd590'), P('#fff6dc'), P('#ffffff')], 1, 2, 0.3);
      }
      // the leading edge: wax and wood, in short golden daubs
      L.bristle(ctx, hctx, arm.map(([x, y]) => [x + 2, y + 3]), { R, width: 11, color: DARK, height: 0.9, dry: 0.05, taperA: 0.05, taperB: 0.1 });
      for (let i = 0; i < arm.length - 3; i += 2) daub(arm.slice(i, i + 8), 8, GOLD, 1, 0.6, 0.25);
      for (let i = 0; i < arm.length - 2; i += 6) daub(arm.slice(i, i + 3).map(([x, y]) => [x - 2, y - 2]), 3.5, [P('#fff0b0'), P('#ffffff')], 1, 0.5, 0.3);
    }
    // body: backlit — he flies straight into the sun — a deep silhouette with a burning rim
    const hw = (a) => a > 25 ? 21 - (a - 25) * 0.3 : a > -15 ? L.lerp(13, 21, (a + 15) / 40) : L.lerp(15, 13, (a + 15) / -40);
    const SIL = [P('#141f52'), P('#1d2a63'), P('#2a2f6a'), P('#33285a'), P('#1a2c66')];
    const torso = [];
    for (let a = -58; a <= 48; a += 4) torso.push(at(a, -hw(a)));
    for (let a = 48; a >= -58; a -= 4) torso.push(at(a, hw(a)));
    ctx.fillStyle = L.css(SIL[0]); L.path(ctx, torso, true); ctx.fill();
    hctx.fillStyle = '#999'; L.path(hctx, torso, true); hctx.fill();
    for (let k = -2; k <= 2; k++) daub([at(-58, k * 4), at(-20, k * 3.5), at(20, k * 6), at(46, k * 5)], 9, SIL, 1, 1, 0.25);
    daub([at(46, -12), at(20, -20), at(-15, -12), at(-50, -13)], 6, [P('#f0a44a'), P('#e98a3a'), P('#f7c46a')], 2, 0.6, 0.3);
    daub([at(44, -6), at(25, -12)], 4, [P('#ffe2a0')], 1, 0.4, 0.3);
    // legs, bent at the knee, trailing in the slipstream
    for (const [sd, kx, ky, fx, fy] of [[-1, -98, -15, -142, -6], [1, -96, 14, -128, 30]]) {
      daub([at(-50, sd * 8), at(kx, ky), at(fx, fy)], 14, SIL, 2, 0.8, 0.1);
      daub([at(fx, fy), at(fx - 10, fy + sd * 5)], 9, SIL, 1, 0.5, 0.1);
      if (sd < 0) daub([at(-54, -14), at(kx, ky - 6), at(fx, fy - 5)], 4, [P('#f0a44a'), P('#e98a3a')], 1, 0.4, 0.3);
    }
    // head, round, crowned with light where the sun strikes it
    const hc0 = at(72, 0);
    ctx.fillStyle = L.css(SIL[1]); ctx.beginPath(); ctx.arc(hc0[0], hc0[1], 17 * FS, 0, 7); ctx.fill();
    hctx.fillStyle = '#aaa'; hctx.beginPath(); hctx.arc(hc0[0], hc0[1], 17 * FS, 0, 7); hctx.fill();
    for (let k = 0; k < 4; k++) daub([at(60 + k * 6, -12), at(62 + k * 6, 12)], 8, SIL, 1, 0.6, 0.2);
    const toSun = Math.atan2(SUN[1] - hc0[1], SUN[0] - hc0[0]);
    const rim = []; for (let a = toSun - 1.3; a <= toSun + 1.3; a += 0.2) rim.push([hc0[0] + Math.cos(a) * 16 * FS, hc0[1] + Math.sin(a) * 16 * FS]);
    daub(rim, 6, [P('#ffd27a'), P('#f7b04a'), P('#fff0c0')], 2, 0.5, 0.2);
    // a single feather already loosening, drifting behind
    const lf = at(-190, 150);
    stroke([lf, [lf[0] + 12, lf[1] + 10], [lf[0] + 30, lf[1] + 12]], 7, P('#fff5d8'), 1, 0.2);
    stroke([[lf[0] + 2, lf[1] + 2], [lf[0] + 26, lf[1] + 13]], 1.8, P('#1a2c66'), 1, 0);
  }


  // ---------- relief, light and surface ----------
  L.relief(ctx, Ly.hc, { blur: 0.6 * S, depth: 3.2, strength: 0.55, spec: 0.22, specPow: 30, lx: 0.45, ly: -0.7, lz: 0.55 });
  L.weave(ctx, { amount: 0.025, grain: 5, seed: 22, S });
  ctx.globalCompositeOperation = 'screen';
  const bloom = ctx.createRadialGradient(SUN[0], SUN[1], 300, SUN[0], SUN[1], 1250);
  bloom.addColorStop(0, 'rgba(255,240,190,0.45)'); bloom.addColorStop(0.5, 'rgba(255,225,150,0.12)'); bloom.addColorStop(1, 'rgba(255,220,150,0)');
  ctx.fillStyle = bloom; ctx.fillRect(X0, 0, X1 - X0, DH);
  ctx.globalCompositeOperation = 'source-over';

  // ---------- wet paint spilling across the tear onto the page ----------
  const Sp = SC.layer(840, 1130, S, true);
  {
    const sx = Sp.ctx, sh = Sp.hctx;
    for (const [cy, n] of [[250, 9], [470, 12], [690, 8], [1000, 7], [1210, 10]]) {
      for (let i = 0; i < n; i++) {
        const y = cy + R.gauss(0, 45), x = SC.tearX(y) + R.r(4, 24), len = R.r(22, 75);
        const pts = []; for (let k = 0; k <= 8; k++) pts.push([x - len * k / 8, y + Math.sin(k / 8 * 2) * R.r(-6, 6)]);
        L.bristle(sx, sh, pts, { R, width: R.r(6, 15), color: colourAt(x + 30, y), height: R.r(0.6, 0.9), dry: 0.55, taperA: 0.1, taperB: 0.5 });
      }
    }
    // three runs of ultramarine trickling down the paper
    for (const [y0, len, w] of [[560, 170, 4.5], [610, 95, 3.2], [1040, 140, 4]]) {
      const x = SC.tearX(y0) - 6, pts = [[x + 8, y0 - 4], [x, y0 + 6], [x - 1.5, y0 + len * 0.5], [x - 2, y0 + len]];
      const c = P('#1d3a8a');
      sx.fillStyle = L.css(c); L.ribbon(sx, L.catmull(pts, 10), (t) => w * (1.4 - 0.7 * t));
      sx.beginPath(); sx.arc(x - 2, y0 + len, w * 0.75, 0, 7); sx.fill();
      sh.fillStyle = '#bbb'; L.ribbon(sh, L.catmull(pts, 10), (t) => w * (1.4 - 0.7 * t) * 0.8); sh.beginPath(); sh.arc(x - 2, y0 + len, w * 0.6, 0, 7); sh.fill();
    }
    L.relief(sx, Sp.hc, { blur: 0.6 * S, depth: 3.2, strength: 0.55, spec: 0.3, specPow: 30, lx: 0.45, ly: -0.7, lz: 0.55 });
  }
  Ly.spill = Sp;
  return Ly;
};
