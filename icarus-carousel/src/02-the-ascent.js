// II. THE ASCENT — heavy impasto, every mark a loaded brushstroke following the
// wind. Ecstatic, vertical, cool blues breaking into gold. Far below, the
// labyrinth he escaped; above, a sun he cannot stop looking at.
window.paint = async function (canvas, W, H) {
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  const hc = L.canvas(W, H), hctx = hc.getContext('2d');
  const S = W / 1000, DH = H / S;
  const R = new L.Rand(2207), N = L.noise2(5), N2 = L.noise2(6), N3 = L.noise2(7);
  const P = (h) => L.hex(h);

  const SUN = [770, -60];
  const FIG = [430, 830], FANG = -0.98; // figure position and heading
  const seaTop = (x) => 1440 + 0.00022 * (x - 520) ** 2 + 10 * N(x / 200, 3);
  const ISLE = [215, 1625];
  const trail = L.resample(L.catmull([[ISLE[0], ISLE[1] - 20], [330, 1520], [205, 1360], [255, 1200], [380, 1150], [330, 1010], [FIG[0] - 70, FIG[1] + 95]], 14), 3);

  // ---------- direction field ----------
  const vortex = (x, y, cx, cy, r, sgn) => { const dx = x - cx, dy = y - cy, d = Math.hypot(dx, dy); const w = Math.exp(-(((d - r * 0.6) / r) ** 2)) * 1.4 * L.smooth(r * 0.1, r * 0.55, d); return [(-dy / (d + 1)) * sgn * w, (dx / (d + 1)) * sgn * w]; };
  function trailNear(x, y) {
    let best = 1e9, bi = 0;
    for (let i = 0; i < trail.length; i += 3) { const d = (trail[i][0] - x) ** 2 + (trail[i][1] - y) ** 2; if (d < best) { best = d; bi = i; } }
    return [Math.sqrt(best), bi];
  }
  function field(x, y) {
    if (y > seaTop(x) - 10) {
      const a = 0.1 * Math.sin(x / 60 + y / 30) + 0.25 * N(x / 140, y / 50);
      return a;
    }
    const dx = x - SUN[0], dy = y - SUN[1], d = Math.hypot(dx, dy);
    const ws = 2.2 * Math.exp(-d / 520);
    let vx = (-dy / d) * ws, vy = (dx / d) * ws;
    const base = -0.35 + 1.7 * L.fbm(N, x / 520, y / 520, 3);
    vx += Math.cos(base) * 0.7; vy += Math.sin(base) * 0.7;
    for (const v of [vortex(x, y, 230, 520, 210, 1), vortex(x, y, 770, 1080, 190, -1), vortex(x, y, 610, 1330, 120, 1)]) { vx += v[0]; vy += v[1]; }
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
  const haloC = [P('#fffbe8'), P('#fff1a6'), P('#f8de6a'), P('#f1c43e'), P('#d7ecf2'), P('#fff7cf')];
  const seaC = [P('#0f2255'), P('#16306c'), P('#1e4384'), P('#284f93')];
  function cloudAmt(x, y) {
    const wx = x + 120 * N2(x / 400, y / 400), wy = y + 120 * N2(x / 400 + 9, y / 400);
    return L.fbm(N3, wx / 430, wy / 260, 4) + 0.22 * L.smooth(700, 1350, y) - 0.12;
  }
  function colourAt(x, y) {
    if (y > seaTop(x)) {
      const isl = ((x - ISLE[0]) / 190) ** 2 + ((y - ISLE[1]) / 82) ** 2 + 0.25 * N(x / 60, y / 40);
      if (isl < 1) { const lit = L.clamp(0.5 - (y - ISLE[1]) / 120 + (x - ISLE[0]) / 500 + R.gauss(0, 0.2)); return lit > 0.55 ? R.pick([P('#e0b866'), P('#d9a64c'), P('#f0cf7e')]) : lit > 0.3 ? R.pick([P('#c98f3a'), P('#8d8a3c'), P('#a8853a')]) : R.pick([P('#8a4a26'), P('#6b3d22'), P('#56602e')]); }
      if (isl < 1.35) return R.pick([P('#e7eef2'), P('#bcd6e6'), P('#5a86b8')]);
      if (R.chance(0.025)) return P('#dfeaf2');
      const k = L.smooth(seaTop(x), DH, y);
      return L.mix(R.pick(seaC), P('#0a1840'), k * 0.4);
    }
    const dx = x - SUN[0], dy = y - SUN[1], d = Math.hypot(dx, dy);
    if (d < 250 + 20 * N(x / 40, y / 40)) return R.pick(haloC.slice(0, 3));
    if (d < 620) {
      const ring = Math.sin(d / 46 * Math.PI * 2 + N(x / 90, y / 90) * 1.4);
      const fade = L.smooth(620, 300, d);
      if (R.chance(fade * 0.9)) return ring > 0.2 ? R.pick(haloC.slice(1, 4)) : ring > -0.4 ? R.pick([haloC[4], haloC[5], haloC[0]]) : R.pick(sky.slice(3));
    }
    const dF = Math.hypot(x - FIG[0], (y - FIG[1]) * 0.85);
    if (dF < 300 && R.chance(L.smooth(300, 90, dF) * 0.9)) return R.pick([P('#cfe3f1'), P('#a9cbe8'), P('#e8f0ec'), P('#fff3c4'), P('#bcd8ee')]);
    const c = cloudAmt(x, y);
    if (c > 0.22) { const under = cloudAmt(x, y - 40) - c; if (y < 800) return R.pick([P('#9fc3e6'), P('#c9def0'), P('#7fa9dc'), P('#eef2ea')]); return under > 0.04 && R.chance(0.7) ? R.pick(cloudC.slice(2, 4)) : R.pick(cloudC); }
    if (c > 0.17 && R.chance(0.5)) return R.pick(sky.slice(3, 5));
    const glow = L.smooth(1400, 200, Math.hypot(dx * 0.8, dy));
    const mist = L.smooth(seaTop(x) - 180, seaTop(x), y);
    let idx = L.clamp(Math.floor((glow * glow * 0.9 + 0.12 * R.next() + 0.2 * N2(x / 160, y / 160)) * sky.length), 0, sky.length - 1);
    let col = sky[idx];
    if (mist > 0) col = L.mix(col, R.pick([P('#c2d6ea'), P('#9ebfe0'), P('#e6eef0')]), mist * 0.8);
    if (R.chance(0.05)) col = R.pick([P('#f1d675'), P('#a9d0e6'), P('#122a6b')]);
    return col;
  }

  // ---------- painting ----------
  ctx.setTransform(S, 0, 0, S, 0, 0); hctx.setTransform(S, 0, 0, S, 0, 0);
  const g0 = ctx.createLinearGradient(0, 0, 0, DH);
  g0.addColorStop(0, '#f4e7a6'); g0.addColorStop(0.25, '#5d8fd0'); g0.addColorStop(0.7, '#244a9c'); g0.addColorStop(0.82, '#a7c2e0'); g0.addColorStop(0.85, '#17306c'); g0.addColorStop(1, '#0d1e4c');
  ctx.fillStyle = g0; ctx.fillRect(0, 0, 1000, DH);
  hctx.fillStyle = '#202020'; hctx.fillRect(0, 0, 1000, DH);

  function pass(spacing, wmin, wmax, lmin, lmax, o = {}) {
    const pts = [];
    for (let y = -20; y < DH + 20; y += spacing) for (let x = -20; x < 1020; x += spacing) pts.push([x + R.r(0, spacing), y + R.r(0, spacing)]);
    for (let i = pts.length - 1; i > 0; i--) { const j = Math.floor(R.next() * (i + 1)); [pts[i], pts[j]] = [pts[j], pts[i]]; }
    for (const [x, y] of pts) {
      if (o.where && !o.where(x, y)) continue;
      const line = L.trace(x, y, R.r(lmin, lmax), 3, field);
      L.bristle(ctx, hctx, line, { R, width: R.r(wmin, wmax), color: colourAt(x, y), height: o.height ?? R.r(0.45, 0.85), dry: o.dry ?? 0.3, alpha: o.alpha ?? 1, dl: 0.045 });
    }
  }
  pass(16, 18, 26, 45, 80, { dry: 0.15 });
  pass(11, 11, 16, 28, 50);
  const nearSun = (x, y) => Math.hypot(x - SUN[0], y - SUN[1]) < 680;
  const edgy = (x, y) => { const c = cloudAmt(x, y); return (c > 0.14 && c < 0.38) || nearSun(x, y) || y > seaTop(x) - 40; };
  pass(8, 7, 10, 18, 32, { where: edgy, height: 0.9 });

  // dark rhythmic dashes in the deep sky, as contour-memory of the wind
  for (let i = 0; i < 1600; i++) {
    const x = R.r(0, 1000), y = R.r(0, 1400);
    if (cloudAmt(x, y) > 0.1 || nearSun(x, y)) continue;
    L.bristle(ctx, hctx, L.trace(x, y, R.r(14, 26), 2.5, field), { R, width: R.r(3, 5), color: R.pick([P('#101f5c'), P('#16307a')]), height: 0.95, dry: 0.1 });
  }

  // ---------- the island and its labyrinth ----------
  {
    const walls = L.labyrinth(ISLE[0] + 10, ISLE[1] - 5, 105, 6, new L.Rand(31), 0.42);
    for (const w of walls) {
      const r = L.resample(w, 3);
      for (let i = 0; i < r.length - 1; i += 5) L.bristle(ctx, hctx, r.slice(i, i + 7), { R, width: 5.5, color: R.pick([P('#4a2614'), P('#5b301a'), P('#3a2010')]), height: 1, dry: 0.1, taperA: 0.05, taperB: 0.05 });
    }
    // sunlight on the walls
    for (const w of walls) {
      const r = L.resample(w, 3).map(([x, y]) => [x + 1.5, y - 2]);
      for (let i = 0; i < r.length - 1; i += 9) if (R.chance(0.6)) L.bristle(ctx, hctx, r.slice(i, i + 4), { R, width: 2.6, color: P('#f2cd7e'), height: 1, dry: 0.2 });
    }
  }

  // ---------- the wake: the path he has flown ----------
  for (let k = 0; k < 22; k++) {
    const off = R.gauss(0, 16), s0 = Math.floor(R.r(0, trail.length * 0.5)), e0 = Math.min(trail.length, s0 + Math.floor(R.r(30, 90)));
    const seg = trail.slice(s0, e0); const nr = L.normals(seg);
    const line = seg.map((p, i) => [p[0] + nr[i][0] * off * (0.4 + i / seg.length), p[1] + nr[i][1] * off * (0.4 + i / seg.length)]);
    L.bristle(ctx, hctx, line, { R, width: R.r(4, 9) * (0.6 + s0 / trail.length), color: R.pick([P('#fffaf0'), P('#f8f0d0'), P('#fde9a0'), P('#e4eef6')]), height: 0.95, dry: 0.35 });
  }
  for (let k = 0; k < 30; k++) {
    const s0 = Math.floor(R.r(trail.length * 0.4, trail.length - 10)), seg = trail.slice(s0, s0 + Math.floor(R.r(12, 40))), nr = L.normals(seg), off = R.gauss(0, 14);
    L.bristle(ctx, hctx, seg.map((p, i) => [p[0] + nr[i][0] * off, p[1] + nr[i][1] * off]), { R, width: R.r(5, 10), color: R.pick([P('#ffffff'), P('#fff4c4'), P('#f6d66e')]), height: 1, dry: 0.4 });
  }

  // ---------- Icarus ----------
  {
    const dx = Math.cos(FANG), dy = Math.sin(FANG), nx = -dy, ny = dx;
    const FS = 1.2, at = (a, b) => [FIG[0] + (dx * a + nx * b) * FS, FIG[1] + (dy * a + ny * b) * FS];
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
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  L.relief(ctx, hc, { blur: 0.6 * S, depth: 3.2, strength: 0.55, spec: 0.22, specPow: 30, lx: 0.45, ly: -0.7, lz: 0.55 });
  L.weave(ctx, { amount: 0.025, grain: 5, seed: 22 });
  // warm bloom from the sun
  ctx.globalCompositeOperation = 'screen';
  const bloom = ctx.createRadialGradient(SUN[0] * S, SUN[1] * S, 0, SUN[0] * S, SUN[1] * S, 700 * S);
  bloom.addColorStop(0, 'rgba(255,240,190,0.55)'); bloom.addColorStop(0.5, 'rgba(255,225,150,0.12)'); bloom.addColorStop(1, 'rgba(255,220,150,0)');
  ctx.fillStyle = bloom; ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = 'multiply';
  const vg = ctx.createRadialGradient(W * 0.55, H * 0.4, W * 0.4, W * 0.5, H * 0.5, W * 1.2);
  vg.addColorStop(0, 'rgba(255,255,255,0)'); vg.addColorStop(1, 'rgba(20,30,70,0.45)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = 'source-over';
};
