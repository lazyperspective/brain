// THE PHOENIX UNFOLDS — the phoenix: geometry (shared by the fire bird and its cool reflection) and renderers.
(function (G) {
  const PU = G.PU;
  const { lerp, clamp, smooth } = PU;
  const TAU = Math.PI * 2;

  // focal anchors — all kept inside single strips
  PU.EYE = { x: 2096, y: 1082 }; // strip 11 (2000–2200)
  PU.HEART = { x: 1900, y: 1770 }; // strip 10 (1800–2000)
  PU.MOON = { x: 700, y: 900, r: 74 }; // strip 4 (600–800)

  const ramp1 = (arr) => (s) => {
    if (s <= arr[0][0]) return arr[0][1];
    for (let i = 1; i < arr.length; i++)
      if (s <= arr[i][0]) {
        const k = (s - arr[i - 1][0]) / (arr[i][0] - arr[i - 1][0]);
        return lerp(arr[i - 1][1], arr[i][1], k);
      }
    return arr[arr.length - 1][1];
  };

  function buildFeather(rng, noise, o) {
    const N = Math.max(14, Math.round(o.L / 12));
    const pts = [];
    let x = o.x,
      y = o.y,
      a = o.ang;
    const step = o.L / (N - 1);
    const wob = rng.r(0, 200);
    for (let i = 0; i < N; i++) {
      pts.push({ x, y });
      const t = i / (N - 1);
      a += (o.bend / (N - 1)) * (0.6 + 0.8 * t) + 0.05 * noise.n(wob, t * 2.5) * (o.wobble == null ? 1 : o.wobble);
      x += Math.cos(a) * step;
      y += Math.sin(a) * step;
    }
    const f = Object.assign({}, o);
    f.c = PU.resample(pts, N);
    const W = o.W;
    const tipK = o.tipK || 0.5;
    f.wAt = (t) =>
      W * (t < 0.14 ? 0.42 + 0.58 * smooth(0, 0.14, t) : t < tipK ? 1 : Math.pow(Math.max(0, 1 - (t - tipK) / (1 - tipK)), 0.8));
    f.seed = rng.i(0, 1e9);
    return f;
  }

  PU.phoenixGeometry = function (seed) {
    const rng = PU.rngFor(seed, 'phx-geo');
    const noise = PU.makeNoise(PU.hashStr(seed + 'geo-noise'));
    const g = { feathers: [] };
    const F = (o) => {
      const f = buildFeather(rng, noise, o);
      g.feathers.push(f);
      return f;
    };

    // ---- arms (leading edges)
    const armLpts = [
      { x: 1800, y: 1610 },
      { x: 1690, y: 1340 },
      { x: 1515, y: 1010 },
      { x: 1265, y: 705 },
      { x: 955, y: 488 },
      { x: 600, y: 368 },
      { x: 255, y: 306 },
      { x: -140, y: 276 },
    ];
    const armRpts = [
      { x: 2030, y: 1615 },
      { x: 2200, y: 1360 },
      { x: 2410, y: 1035 },
      { x: 2650, y: 720 },
      { x: 2950, y: 480 },
      { x: 3330, y: 362 },
      { x: 3710, y: 300 },
      { x: 4150, y: 268 },
    ];
    g.armL = PU.resample(PU.catmull(armLpts, 24), 240);
    g.armR = PU.resample(PU.catmull(armRpts, 24), 240);

    const angL = ramp1([
      [0, 1.72],
      [0.25, 1.98],
      [0.5, 2.3],
      [0.72, 2.62],
      [1, 2.92],
    ]);
    const lenF = ramp1([
      [0, 470],
      [0.25, 720],
      [0.5, 930],
      [0.75, 960],
      [1, 800],
    ]);

    // wing builder
    function wing(side) {
      const arm = side < 0 ? g.armL : g.armR;
      const out = [];
      const mirror = (a) => (side < 0 ? a : Math.PI - a);
      const sz = side < 0 ? 1 : 1.04;
      // flight feathers (primaries + secondaries)
      const nF = 30;
      for (let i = 0; i < nF; i++) {
        const s = 0.03 + (0.97 * (i + rng.r(-0.3, 0.3))) / (nF - 1);
        const p = PU.at(arm, s);
        const L = lenF(s) * sz * rng.r(0.9, 1.08);
        const ang = mirror(angL(s) + rng.r(-0.05, 0.05));
        out.push({
          x: p.x,
          y: p.y + 14,
          ang,
          L,
          W: L * rng.r(0.12, 0.145),
          bend: side * -0.22 * rng.r(0.6, 1.3),
          heat: (0.8 - 0.26 * s) * rng.r(0.9, 1.06),
          kind: 'flight',
          side,
          s,
          occl: 0.6,
          alpha: 1,
          tipK: 0.52,
        });
      }
      // greater coverts
      const nG = 46;
      for (let i = 0; i < nG; i++) {
        const s = 0.02 + (0.95 * (i + rng.r(-0.3, 0.3))) / (nG - 1);
        const p = PU.at(arm, s);
        const L = lenF(s) * sz * rng.r(0.48, 0.56);
        out.push({
          x: p.x,
          y: p.y + 6,
          ang: mirror(angL(s) - 0.1 + rng.r(-0.05, 0.05)),
          L,
          W: L * rng.r(0.24, 0.28),
          bend: side * -0.18,
          heat: (0.84 - 0.2 * s) * rng.r(0.92, 1.05),
          kind: 'greater',
          side,
          s,
          occl: 0.62,
          alpha: 0.95,
          tipK: 0.48,
        });
      }
      // lesser coverts
      const nL = 64;
      for (let i = 0; i < nL; i++) {
        const s = 0.0 + (0.9 * (i + rng.r(-0.3, 0.3))) / (nL - 1);
        const p = PU.at(arm, s);
        const L = (lenF(s) * 0.24 + 40) * sz * rng.r(0.9, 1.1);
        out.push({
          x: p.x,
          y: p.y,
          ang: mirror(angL(s) - 0.25 + rng.r(-0.08, 0.08)),
          L,
          W: L * rng.r(0.38, 0.45),
          bend: side * -0.12,
          heat: (0.88 - 0.14 * s) * rng.r(0.94, 1.04),
          kind: 'lesser',
          side,
          s,
          occl: 0.55,
          alpha: 0.9,
          tipK: 0.45,
        });
      }
      // marginal scales along the leading edge (pointing along the arm, outward)
      const nM = 70;
      for (let i = 0; i < nM; i++) {
        const s = (0.92 * (i + rng.r(-0.3, 0.3))) / (nM - 1);
        const p = PU.at(arm, s);
        const along = Math.atan2(p.ty, p.tx);
        const down = mirror(angL(s));
        const a = along + 0.55 * angDiff(down, along);
        const L = rng.r(80, 150) * (1 - 0.3 * s);
        out.push({ x: p.x - p.nx * side * 4, y: p.y, ang: a, L, W: L * 0.5, bend: 0, heat: 0.9 - 0.08 * s, kind: 'marginal', side, s, occl: 0.6, alpha: 0.85, tipK: 0.45, wobble: 0.4 });
      }
      return out;
    }
    function angDiff(a, b) {
      let d = a - b;
      while (d > Math.PI) d -= TAU;
      while (d < -Math.PI) d += TAU;
      return d;
    }

    // ---- tail (behind everything): long streamers falling behind the city
    const tailBase = { x: 1912, y: 2120 };
    g.tailBase = tailBase;
    const tails = [
      { ang: 1.9, L: 1300, bend: 0.12 },
      { ang: 1.8, L: 1380, bend: 0.05 },
      { ang: 1.7, L: 1250, bend: -0.02 },
      { ang: 1.62, L: 1400, bend: -0.06 },
      { ang: 1.52, L: 1300, bend: -0.1 },
      { ang: 1.42, L: 1200, bend: -0.16 },
      { ang: 2.02, L: 1150, bend: 0.2 },
      { ang: 1.3, L: 1100, bend: -0.22 },
      { ang: 1.75, L: 1500, bend: -0.03 },
    ];
    const tailF = [];
    for (const t of tails) {
      tailF.push({
        x: tailBase.x + rng.r(-40, 40),
        y: tailBase.y - 30,
        ang: t.ang,
        L: t.L,
        W: rng.r(110, 140),
        bend: t.bend,
        heat: 0.72,
        kind: 'tail',
        side: 0,
        s: 0,
        occl: 0.35,
        alpha: 0.9,
        tipK: 0.3,
        wobble: 0.7,
      });
    }

    // ---- crest plumes from the back of the head
    const crest = [];
    const crestDefs = [
      { x: 2000, y: 1000, ang: -2.75, L: 560, bend: 0.5 },
      { x: 1985, y: 1035, ang: -2.95, L: 640, bend: 0.6 },
      { x: 1975, y: 1075, ang: -3.12, L: 580, bend: 0.55 },
      { x: 2030, y: 975, ang: -2.5, L: 420, bend: 0.3 },
      { x: 1975, y: 1120, ang: 2.95, L: 460, bend: 0.5 },
    ];
    for (const c of crestDefs)
      crest.push({ x: c.x, y: c.y, ang: c.ang, L: c.L, W: rng.r(110, 140), bend: c.bend, heat: 0.88, kind: 'crest', side: 0, s: 0, occl: 0.3, alpha: 1, tipK: 0.25, wobble: 1.5 });

    // ---- body: spine and scale feathers
    g.spine = PU.resample(
      PU.catmull(
        [
          { x: 2066, y: 1190 },
          { x: 2022, y: 1320 },
          { x: 1952, y: 1455 },
          { x: 1905, y: 1640 },
          { x: 1898, y: 1860 },
          { x: 1912, y: 2120 },
        ],
        16
      ),
      80
    );
    g.hw = ramp1([
      [0, 84],
      [0.18, 92],
      [0.32, 140],
      [0.5, 215],
      [0.66, 205],
      [0.85, 140],
      [1, 80],
    ]);
    const body = [];
    for (let u = 0.99; u >= 0.0; u -= 0.02) {
      const p = PU.at(g.spine, u);
      const hw = g.hw(u);
      const nAcross = Math.max(3, Math.round(hw / 26));
      for (let j = 0; j < nAcross; j++) {
        const v = (j + 0.5) / nAcross * 2 - 1 + rng.r(-0.06, 0.06);
        const x = p.x + p.nx * v * hw * 0.92;
        const y = p.y + p.ny * v * hw * 0.92 - 10;
        const base = Math.atan2(p.ty, p.tx);
        const L = rng.r(80, 130) * (0.7 + hw / 300);
        const dH = Math.hypot(x - PU.HEART.x, y - PU.HEART.y);
        body.push({
          x,
          y,
          ang: base - v * 0.55 + rng.r(-0.08, 0.08),
          L,
          W: L * 0.55,
          bend: -v * 0.2,
          heat: 0.76 + 0.22 * Math.exp(-dH / 200),
          kind: 'body',
          side: 0,
          s: u,
          occl: 0.5,
          alpha: 0.95,
          tipK: 0.45,
          wobble: 0.5,
        });
      }
    }
    // mane: long flaring flame feathers around the neck base
    const mane = [];
    for (let i = 0; i < 18; i++) {
      const u = 0.2 + rng.r(0, 0.25);
      const p = PU.at(g.spine, u);
      const side = i % 2 ? 1 : -1;
      const hw = g.hw(u);
      const base = Math.atan2(p.ty, p.tx);
      mane.push({
        x: p.x + p.nx * side * hw * 0.7,
        y: p.y + p.ny * side * hw * 0.7,
        ang: base + side * rng.r(0.35, 0.8) * -1,
        L: rng.r(220, 340),
        W: rng.r(55, 75),
        bend: side * 0.4,
        heat: 0.9,
        kind: 'mane',
        side,
        s: u,
        occl: 0.35,
        alpha: 0.9,
        tipK: 0.3,
        wobble: 1.4,
      });
    }

    const wl = wing(-1),
      wr = wing(1);
    const order = (arr, kind) => arr.filter((f) => f.kind === kind).sort((a, b) => b.s - a.s);
    const all = [];
    for (const o of tailF) all.push(o);
    for (const k of ['flight', 'greater', 'lesser', 'marginal']) {
      for (const o of order(wl, k)) all.push(o);
      for (const o of order(wr, k)) all.push(o);
    }
    for (const o of crest) all.push(o);
    for (const o of mane) all.push(o);
    for (const o of body) all.push(o);
    for (const o of all) F(o);

    // head outline (beak to the right)
    g.head = [
      { x: 1984, y: 1128 },
      { x: 1990, y: 1068 },
      { x: 2022, y: 1026 },
      { x: 2075, y: 1004 },
      { x: 2128, y: 1012 },
      { x: 2163, y: 1040 },
      { x: 2172, y: 1062 },
      { x: 2150, y: 1112 },
      { x: 2128, y: 1142 },
      { x: 2096, y: 1166 },
      { x: 2080, y: 1205 },
      { x: 2000, y: 1200 },
    ];
    g.beakUp = [
      { x: 2150, y: 1036 },
      { x: 2196, y: 1046 },
      { x: 2236, y: 1066 },
      { x: 2262, y: 1096 },
      { x: 2266, y: 1124 },
      { x: 2252, y: 1140 },
      { x: 2246, y: 1116 },
      { x: 2224, y: 1102 },
      { x: 2190, y: 1098 },
      { x: 2158, y: 1100 },
    ];
    g.beakLo = [
      { x: 2158, y: 1102 },
      { x: 2196, y: 1104 },
      { x: 2230, y: 1112 },
      { x: 2214, y: 1124 },
      { x: 2180, y: 1130 },
      { x: 2140, y: 1134 },
    ];
    // feathers that turn into the river, the stairway and the liquid fall burn hotter
    const mark = (side, x, y) => {
      let best = null,
        bd = 1e9;
      for (const f of g.feathers) {
        if (f.kind !== 'flight' || f.side !== side) continue;
        const t = f.c[f.c.length - 1];
        const d = Math.hypot(t.x - x, t.y - y);
        if (d < bd) {
          bd = d;
          best = f;
        }
      }
      if (best) {
        best.heat = Math.min(0.95, best.heat + 0.18);
        best.alpha = 1.6;
        best.special = true;
      }
    };
    mark(-1, 222, 1040);
    mark(-1, 1500, 2005);
    mark(1, 2500, 1915);
    const HS = 1.45;
    const hs = (p) => ({ x: PU.EYE.x + (p.x - PU.EYE.x) * HS, y: PU.EYE.y + (p.y - PU.EYE.y) * HS });
    g.head = g.head.map(hs);
    g.beakUp = g.beakUp.map(hs);
    g.beakLo = g.beakLo.map(hs);
    return g;
  };

  // ------------------------------------------------------------------ fire rendering
  function outline(f) {
    const c = f.c,
      N = c.length;
    const L = [],
      R = [];
    for (let i = 0; i < N; i++) {
      const t = i / (N - 1),
        w = f.wAt(t) / 2;
      L.push({ x: c[i].x + c[i].nx * w, y: c[i].y + c[i].ny * w });
      R.push({ x: c[i].x - c[i].nx * w, y: c[i].y - c[i].ny * w });
    }
    return L.concat(R.reverse());
  }

  // tapered flame tongue (filled), rising and curling
  PU.flameLick = function (ctx, noise, rng, x, y, ang, len, w, heat, alpha, upPull = 0.12) {
    const n = 12;
    const pts = [];
    let a = ang;
    const st = len / (n - 1);
    const sd = rng.r(0, 300);
    for (let i = 0; i < n; i++) {
      pts.push({ x, y });
      // pull toward up (-PI/2)
      let d = -Math.PI / 2 - a;
      while (d > Math.PI) d -= TAU;
      while (d < -Math.PI) d += TAU;
      a += d * upPull + 0.5 * noise.n(sd + i * 0.35, x * 0.004);
      x += Math.cos(a) * st;
      y += Math.sin(a) * st;
    }
    const rs = PU.resample(pts, n);
    const Lp = [],
      Rp = [];
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      const ww = (w / 2) * Math.pow(1 - t, 0.9) * (0.6 + 0.4 * Math.sin(Math.min(1, t * 3) * Math.PI * 0.5));
      Lp.push({ x: rs[i].x + rs[i].nx * ww, y: rs[i].y + rs[i].ny * ww });
      Rp.push({ x: rs[i].x - rs[i].nx * ww, y: rs[i].y - rs[i].ny * ww });
    }
    const gr = ctx.createLinearGradient(rs[0].x, rs[0].y, rs[n - 1].x, rs[n - 1].y);
    gr.addColorStop(0, PU.rgba(PU.fire(heat), alpha * 0.6));
    gr.addColorStop(0.45, PU.rgba(PU.fire(heat * 0.8), alpha * 0.45));
    gr.addColorStop(1, PU.rgba(PU.fire(heat * 0.5), 0));
    ctx.fillStyle = gr;
    PU.poly(ctx, Lp.concat(Rp.reverse()), true);
    ctx.fill();
    // a few bristle strokes inside the tongue so it reads as a brush mark, not a flat shard
    ctx.strokeStyle = gr;
    ctx.lineCap = 'round';
    for (let b = 0; b < 3; b++) {
      const o = (b - 1) * 0.28 + rng.r(-0.08, 0.08);
      ctx.lineWidth = Math.max(1, w * rng.r(0.08, 0.16));
      ctx.beginPath();
      const end = Math.floor(n * rng.r(0.6, 0.95));
      for (let i = 0; i < end; i++) {
        const t = i / (n - 1);
        const ww = (w / 2) * Math.pow(1 - t, 0.9) * o;
        const x = rs[i].x + rs[i].nx * ww,
          y = rs[i].y + rs[i].ny * ww;
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.stroke();
    }
    return rs;
  };

  function moonDim(x, y) {
    const d = Math.hypot(x - PU.MOON.x, y - PU.MOON.y);
    return 0.45 + 0.55 * smooth(PU.MOON.r * 0.6, PU.MOON.r * 3.4, d);
  }

  // dissolve amount by position (right wing breaks into ember rain)
  function dissolveAt(x, y) {
    return smooth(2600, 3600, x) * smooth(400, 1000, y) + 0.1 * (1 - smooth(2600, 3600, x));
  }

  function drawFeatherFire(ctx, f, noise, out, S) {
    const rng = new PU.RNG(f.seed);
    const c = f.c,
      N = c.length,
      L = c.L,
      W = f.W;
    const ol = outline(f);
    const tip = c[N - 1];
    const dis = f.special ? 0 : f.kind === 'flight' || f.kind === 'greater' ? dissolveAt(tip.x, tip.y) : f.kind === 'tail' ? 0.25 : 0.05;
    const md = f.kind === 'flight' || f.kind === 'greater' ? moonDim((c[0].x + tip.x) / 2, (c[0].y + tip.y) / 2) : 1;
    const A = f.alpha * md * (1 - 0.45 * dis * dis);

    // 1 occlusion of what lies beneath (feather depth)
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = `rgba(0,0,0,${f.occl * (md < 1 ? md : 1)})`;
    PU.poly(ctx, ol, true);
    ctx.fill();

    ctx.globalCompositeOperation = 'lighter';
    // 2 base ember body (gradient along feather)
    {
      const gr = ctx.createLinearGradient(c[0].x, c[0].y, tip.x, tip.y);
      gr.addColorStop(0, PU.rgba(PU.fire(f.heat * 0.62), 0.2 * A));
      gr.addColorStop(0.5, PU.rgba(PU.fire(f.heat * 0.45), 0.12 * A * (1 - 0.7 * dis)));
      gr.addColorStop(1, PU.rgba(PU.fire(0.2), 0.0));
      ctx.fillStyle = gr;
      PU.poly(ctx, ol, true);
      ctx.fill();
    }
    // 3 barbs, each ending in a little tongue of flame
    const isScale = f.kind === 'marginal';
    const spacing = Math.max(3.2, Math.min(9, W / 22));
    const nb = Math.floor((L * 0.92) / spacing);
    const barbTan = 0.75;
    ctx.lineCap = 'round';
    for (let side = -1; side <= 1; side += 2) {
      for (let k = 0; k < (isScale ? 0 : nb); k++) {
        const ts = 0.03 + (0.92 * (k + rng.r(-0.4, 0.4))) / nb;
        const w0 = f.wAt(ts) / 2;
        if (w0 < 1.5) continue;
        const dt = w0 / (L * barbTan);
        const te = Math.min(1, ts + dt);
        const ps = PU.at(c, ts),
          pe = PU.at(c, te),
          pm = PU.at(c, ts + dt * 0.55);
        const we = (f.wAt(te) / 2) * rng.r(0.82, 1.12);
        const ex = pe.x + pe.nx * side * we,
          ey = pe.y + pe.ny * side * we;
        const cx = pm.x + pm.nx * side * w0 * 0.42,
          cy = pm.y + pm.ny * side * w0 * 0.42;
        // fade toward tip when dissolving
        const fadeTip = 1 - smooth(lerp(0.55, 0.2, dis), 1.0, ts) * (0.35 + 0.65 * dis);
        if (rng.next() > fadeTip + 0.15) continue;
        let hb = f.heat * (1 - 0.62 * Math.pow(ts, 1.2)) + rng.r(-0.06, 0.05);
        if (rng.chance(0.04)) hb += 0.12;
        const a = A * rng.r(0.08, 0.16) * (0.4 + 0.6 * fadeTip);
        ctx.strokeStyle = PU.rgba(PU.fire(hb * 0.95), a);
        ctx.lineWidth = spacing * rng.r(0.45, 0.75);
        ctx.beginPath();
        ctx.moveTo(ps.x, ps.y);
        ctx.quadraticCurveTo(cx, cy, ex, ey);
        // edge tongue continues the barb outward then curls upward
        const pTongue = 0.28 + 0.5 * ts;
        if (rng.chance(pTongue)) {
          let dx = ex - cx,
            dy = ey - cy;
          const dl = Math.hypot(dx, dy) || 1;
          let ang = Math.atan2(dy / dl, dx / dl);
          const tl = (w0 * rng.r(0.25, 0.8) + 8) * (0.6 + ts * 0.9);
          let x = ex,
            y = ey;
          const steps = 5;
          for (let i = 0; i < steps; i++) {
            let d = -Math.PI / 2 - ang;
            while (d > Math.PI) d -= TAU;
            while (d < -Math.PI) d += TAU;
            ang += d * 0.18 + 0.6 * noise.n(x * 0.01, y * 0.01);
            x += (Math.cos(ang) * tl) / steps;
            y += (Math.sin(ang) * tl) / steps;
            ctx.lineTo(x, y);
          }
        }
        ctx.stroke();
      }
    }
    // 4 inner luminous strands (body of fire)
    const nS = Math.round(4 + W / 18);
    for (let i = 0; i < nS; i++) {
      const o = rng.r(-0.45, 0.45);
      const t0 = rng.r(0, 0.15),
        t1 = rng.r(0.45, 0.85) * (1 - Math.abs(o) * 0.4);
      ctx.strokeStyle = PU.rgba(PU.fire(f.heat * rng.r(0.85, 1.05)), A * rng.r(0.03, 0.07));
      ctx.lineWidth = W * rng.r(0.06, 0.14);
      ctx.beginPath();
      for (let k = 0; k <= 14; k++) {
        const t = lerp(t0, t1, k / 14);
        const p = PU.at(c, t);
        const w = (f.wAt(t) / 2) * o;
        const x = p.x + p.nx * w,
          y = p.y + p.ny * w;
        k ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.stroke();
    }
    // 5 rachis
    if (f.kind === 'flight' || f.kind === 'greater' || f.kind === 'tail') {
      const tEnd = 0.86;
      ctx.lineWidth = Math.max(1.4, W * 0.04);
      ctx.strokeStyle = PU.rgba(PU.fire(Math.min(1, f.heat + 0.1)), 0.4 * A);
      ctx.beginPath();
      for (let k = 0; k <= 24; k++) {
        const p = PU.at(c, (tEnd * k) / 24);
        k ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y);
      }
      ctx.stroke();
      ctx.lineWidth = Math.max(0.8, W * 0.015);
      ctx.strokeStyle = PU.rgba(PU.fire(1), 0.3 * A);
      ctx.beginPath();
      for (let k = 0; k <= 16; k++) {
        const p = PU.at(c, (0.5 * k) / 16);
        k ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y);
      }
      ctx.stroke();
    }
    if (isScale) {
      // flame scale: a few overlapping tongues flowing along the feather
      for (let i = 0; i < 4; i++) {
        const p = PU.at(c, rng.r(0, 0.2));
        PU.flameLick(ctx, noise, rng, p.x + rng.r(-W, W) * 0.3, p.y + rng.r(-W, W) * 0.3, Math.atan2(p.ty, p.tx) + rng.r(-0.3, 0.3), L * rng.r(0.8, 1.3), W * rng.r(0.5, 0.9), f.heat * rng.r(0.85, 1.05), 0.2 * A, 0.06);
      }
    }
    // 6 larger flame licks peeling off the upper edge
    if (f.kind !== 'body') {
      const nl = Math.round((L / 140) * (f.kind === 'marginal' ? 1.5 : 1));
      for (let i = 0; i < nl; i++) {
        const t = rng.r(0.15, 0.9);
        const p = PU.at(c, t);
        // choose the side whose normal points more upward
        const sgn = p.ny < 0 ? 1 : -1;
        const w = f.wAt(t) / 2;
        const x = p.x + p.nx * sgn * w * 0.9,
          y = p.y + p.ny * sgn * w * 0.9;
        PU.flameLick(ctx, noise, rng, x, y, Math.atan2(p.ny * sgn, p.nx * sgn), w * rng.r(0.6, 1.6) + 20, w * rng.r(0.3, 0.6), f.heat * 0.9, 0.12 * A, 0.15);
      }
    }
    // 7 tip: smoke + embers
    if (out && f.kind !== 'body' && f.kind !== 'marginal' && f.kind !== 'lesser') {
      const nE = Math.round((L / 22) * (0.25 + 2.2 * dis * dis));
      for (let i = 0; i < nE; i++) {
        const t = rng.r(0.6, 1.0);
        const p = PU.at(c, t);
        const w = f.wAt(t) / 2;
        const off = rng.r(-1, 1) * w * 1.2;
        const drift = rng.r(0, 1) * L * 0.5 * (0.3 + dis);
        let x = p.x + p.nx * off + p.tx * drift * 0.5,
          y = p.y + p.ny * off + p.ty * drift * 0.5;
        y += drift * dis * 1.2 * rng.next();
        x += noise.n(x * 0.003, y * 0.003) * 60;
        out.embers.push({ x, y, r: rng.r(1, 3.4) * (rng.chance(0.08) ? 2 : 1), heat: rng.r(0.65, 1), vy: dis, a: rng.r(0.4, 1) });
      }
      // dissolving feathers shed falling streams of embers (the right wing becomes rain)
      if (dis > 0.35) {
        const nStr = Math.round(dis * 14);
        for (let k = 0; k < nStr; k++) {
          const p = PU.at(c, rng.r(0.35, 1));
          let x = p.x + p.nx * rng.r(-1, 1) * f.wAt(0.5) * 0.5,
            y = p.y;
          const len = rng.r(150, 700) * dis;
          const drift = rng.r(-0.15, 0.25);
          for (let d = 0; d < len; d += rng.r(14, 46)) {
            out.embers.push({ x: x + d * drift + noise.n(x * 0.01, (y + d) * 0.01) * 14, y: y + d, r: rng.r(0.8, 2.6) * (1 - (d / len) * 0.5), heat: rng.r(0.6, 1), vy: 1, a: rng.r(0.4, 1) * (1 - (d / len) * 0.6) });
          }
        }
      }
      const nSm = f.kind === 'tail' ? 2 : 3;
      for (let i = 0; i < nSm; i++) {
        const t = rng.r(0.7, 0.98);
        const p = PU.at(c, t);
        const w = f.wAt(t) / 2;
        let x = p.x + p.nx * rng.r(-1, 1) * w,
          y = p.y + p.ny * rng.r(-1, 1) * w;
        let ang = Math.atan2(p.ty, p.tx);
        const pts = [];
        const len = rng.r(180, 420) * (f.kind === 'flight' ? 1 : 0.6);
        const steps = 18;
        for (let k = 0; k < steps; k++) {
          pts.push({ x, y });
          let d = -Math.PI / 2 - ang;
          while (d > Math.PI) d -= TAU;
          while (d < -Math.PI) d += TAU;
          ang += d * 0.1 + 0.5 * noise.n(x * 0.004 + 50, y * 0.004);
          x += (Math.cos(ang) * len) / steps;
          y += (Math.sin(ang) * len) / steps;
        }
        if (Math.hypot(pts[0].x - PU.HEART.x, (pts[0].y - PU.HEART.y) * 0.6) > 420) out.smoke.push({ pts, w: rng.r(10, 34), a: rng.r(0.05, 0.12) });
      }
    }
  }

  function drawFeatherGhost(ctx, f, rng) {
    // the unburned bird: crisp cool feathers, no flame
    const c = f.c,
      N = c.length,
      L = c.L,
      W = f.W;
    const ol = outline(f);
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = `rgba(3,8,18,${0.3})`;
    PU.poly(ctx, ol, true);
    ctx.fill();
    ctx.globalCompositeOperation = 'lighter';
    const heat = f.heat;
    const gr = ctx.createLinearGradient(c[0].x, c[0].y, c[N - 1].x, c[N - 1].y);
    gr.addColorStop(0, PU.rgba(PU.ice(heat * 0.75), 0.42));
    gr.addColorStop(1, PU.rgba(PU.ice(heat * 0.5), 0.14));
    ctx.fillStyle = gr;
    PU.poly(ctx, ol, true);
    ctx.fill();
    const spacing = Math.max(6, W / 12);
    const nb = Math.floor((L * 0.9) / spacing);
    ctx.lineWidth = spacing * 0.5;
    for (let side = -1; side <= 1; side += 2)
      for (let k = 0; k < nb; k++) {
        const ts = 0.04 + (0.9 * k) / nb;
        const w0 = f.wAt(ts) / 2;
        if (w0 < 2) continue;
        const te = Math.min(1, ts + w0 / (L * 0.9));
        const ps = PU.at(c, ts),
          pe = PU.at(c, te);
        const we = f.wAt(te) / 2;
        ctx.strokeStyle = PU.rgba(PU.ice(heat * (0.9 - 0.4 * ts) + rng.r(-0.05, 0.05)), 0.22);
        ctx.beginPath();
        ctx.moveTo(ps.x, ps.y);
        ctx.lineTo(pe.x + pe.nx * side * we, pe.y + pe.ny * side * we);
        ctx.stroke();
      }
    ctx.strokeStyle = PU.rgba(PU.ice(0.95), 0.5);
    ctx.lineWidth = Math.max(2, W * 0.04);
    ctx.beginPath();
    for (let k = 0; k <= 16; k++) {
      const p = PU.at(c, (0.9 * k) / 16);
      k ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y);
    }
    ctx.stroke();
  }

  // -------------------------------------------------------------- head
  function drawHeadFire(ctx, g, noise, rng) {
    ctx.globalCompositeOperation = 'source-over';
    // shadow around the head so it separates from the crest and wings
    const bbh = bbox(g.head);
    const hcx = (bbh.x0 + bbh.x1) / 2, hcy = (bbh.y0 + bbh.y1) / 2;
    const sh = ctx.createRadialGradient(hcx, hcy, 60, hcx, hcy, 260);
    sh.addColorStop(0, 'rgba(0,0,0,0.75)');
    sh.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = sh;
    ctx.fillRect(hcx - 260, hcy - 260, 520, 520);
    // dark-ember base so the head reads as a solid form
    const gr = ctx.createRadialGradient(PU.EYE.x + 10, PU.EYE.y + 10, 10, PU.EYE.x - 20, PU.EYE.y + 20, 190);
    gr.addColorStop(0, PU.rgba(PU.fire(0.56), 1));
    gr.addColorStop(0.55, PU.rgba(PU.fire(0.4), 1));
    gr.addColorStop(1, PU.rgba(PU.fire(0.2), 1));
    ctx.fillStyle = gr;
    PU.poly(ctx, PU.catmull(g.head.concat([g.head[0]]), 8), true);
    ctx.fill();
    ctx.globalCompositeOperation = 'lighter';
    // small scale strokes flowing from the beak back to the nape
    ctx.lineCap = 'round';
    const bb = bbox(g.head);
    for (let i = 0; i < 1100; i++) {
      const x = rng.r(bb.x0, bb.x1),
        y = rng.r(bb.y0, bb.y1);
      if (!inPoly(g.head, x, y)) continue;
      const ang = Math.PI + 0.25 * (y - PU.EYE.y) / 140 + rng.r(-0.15, 0.15) + 0.4 * noise.n(x * 0.02, y * 0.02);
      const len = rng.r(18, 46);
      const dE = Math.hypot(x - PU.EYE.x, y - PU.EYE.y);
      // light from above: crown and brow hotter, throat cooler
      const up = clamp((PU.EYE.y + 60 - y) / 160);
      const h = 0.44 + 0.2 * up + 0.22 * Math.exp(-dE / 60) + rng.r(-0.08, 0.08);
      ctx.strokeStyle = PU.rgba(PU.fire(h), rng.r(0.1, 0.22));
      ctx.lineWidth = rng.r(3, 7);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + Math.cos(ang) * len * 0.5, y + Math.sin(ang) * len * 0.5 - 4, x + Math.cos(ang) * len, y + Math.sin(ang) * len);
      ctx.stroke();
    }
    // modelling: shade the throat and back of the head, crimson mask under the eye, hot rim on the crown
    ctx.save();
    PU.poly(ctx, PU.catmull(g.head.concat([g.head[0]]), 8), true);
    ctx.clip();
    ctx.globalCompositeOperation = 'source-over';
    const shd = ctx.createLinearGradient(PU.EYE.x + 40, PU.EYE.y - 60, PU.EYE.x - 60, PU.EYE.y + 150);
    shd.addColorStop(0, 'rgba(0,0,0,0)');
    shd.addColorStop(0.55, 'rgba(40,4,2,0.15)');
    shd.addColorStop(1, 'rgba(40,4,2,0.55)');
    ctx.fillStyle = shd;
    ctx.fillRect(bb.x0, bb.y0, bb.x1 - bb.x0, bb.y1 - bb.y0);
    ctx.globalCompositeOperation = 'lighter';
    // crimson-to-gold malar stripe sweeping back beneath the eye
    for (let i = 0; i < 40; i++) {
      const t = rng.r(0, 1);
      const x = lerp(PU.EYE.x + 20, PU.EYE.x - 130, t),
        y = lerp(PU.EYE.y + 32, PU.EYE.y + 60, t) + rng.r(-10, 10);
      ctx.strokeStyle = PU.rgba(PU.fire(0.4 + 0.15 * (1 - t)), 0.25);
      ctx.lineWidth = rng.r(3, 7);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - rng.r(20, 40), y + rng.r(-3, 6));
      ctx.stroke();
    }
    ctx.restore();
    ctx.globalCompositeOperation = 'lighter';
    const crown = PU.resample(PU.catmull(g.head.slice(1, 6), 10), 40);
    for (const [lw, a] of [[16, 0.12], [8, 0.2], [3, 0.45]]) {
      ctx.strokeStyle = PU.rgba(PU.fire(0.96), a);
      ctx.lineWidth = lw;
      ctx.beginPath();
      crown.forEach((q, i) => (i ? ctx.lineTo(q.x + q.nx * 3, q.y + q.ny * 3 + 3) : ctx.moveTo(q.x, q.y + 3)));
      ctx.stroke();
    }
    // feathery edge: short flame strokes crossing the outline, swept back
    const edge = PU.resample(PU.catmull(g.head.concat([g.head[0]]), 10), 120);
    for (let i = 0; i < edge.length; i++) {
      const q = edge[i];
      if (q.x > PU.EYE.x + 50) continue; // leave the beak base clean
      for (let k = 0; k < 2; k++) {
        const len = rng.r(14, 34);
        const a = Math.PI + rng.r(-0.5, 0.5) + (q.y - PU.EYE.y) * 0.003;
        ctx.strokeStyle = PU.rgba(PU.fire(rng.r(0.5, 0.8)), rng.r(0.12, 0.3));
        ctx.lineWidth = rng.r(2, 5);
        ctx.beginPath();
        ctx.moveTo(q.x + rng.r(-6, 6), q.y + rng.r(-6, 6));
        ctx.quadraticCurveTo(q.x + Math.cos(a) * len * 0.5, q.y + Math.sin(a) * len * 0.5 - 4, q.x + Math.cos(a) * len, q.y + Math.sin(a) * len);
        ctx.stroke();
      }
    }
    // beak (molten gold)
    ctx.globalCompositeOperation = 'source-over';
    const bu = bbox(g.beakUp);
    const bg = ctx.createLinearGradient(bu.x0, bu.y0, bu.x1, bu.y1);
    bg.addColorStop(0, PU.rgba(PU.fire(0.74), 1));
    bg.addColorStop(0.55, PU.rgba(PU.fire(0.58), 1));
    bg.addColorStop(1, PU.rgba(PU.fire(0.36), 1));
    ctx.fillStyle = bg;
    PU.poly(ctx, PU.catmull(g.beakUp, 6), true);
    ctx.fill();
    ctx.fillStyle = PU.rgba(PU.fire(0.55), 1);
    PU.poly(ctx, PU.catmull(g.beakLo, 6), true);
    ctx.fill();
    // painterly beak: strokes following its curve, shadow beneath, hot culmen highlight
    ctx.save();
    PU.poly(ctx, PU.catmull(g.beakUp, 6), true);
    ctx.clip();
    const bsh = ctx.createLinearGradient(0, bu.y0, 0, bu.y1);
    bsh.addColorStop(0, 'rgba(0,0,0,0)');
    bsh.addColorStop(0.6, 'rgba(60,8,0,0.1)');
    bsh.addColorStop(1, 'rgba(60,8,0,0.5)');
    ctx.fillStyle = bsh;
    ctx.fillRect(bu.x0, bu.y0, bu.x1 - bu.x0, bu.y1 - bu.y0);
    ctx.lineCap = 'round';
    for (let i = 0; i < 70; i++) {
      const o = rng.r(0, 1);
      const B0 = g.beakUp;
      const sx = lerp(B0[0].x, B0[9].x, o),
        sy = lerp(B0[0].y, B0[9].y, o);
      ctx.strokeStyle = rng.chance(0.5) ? PU.rgba(PU.fire(rng.r(0.75, 0.95)), 0.18) : 'rgba(90,20,0,0.12)';
      ctx.lineWidth = rng.r(2, 5);
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.quadraticCurveTo(lerp(sx, B0[2].x, 0.7), lerp(sy, B0[2].y, 0.7) + o * 30, B0[4].x - 10 + rng.r(-6, 6), B0[4].y - 8 + o * 26);
      ctx.stroke();
    }
    ctx.restore();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = PU.rgba(PU.fire(1), 0.7);
    ctx.lineWidth = 3;
    ctx.beginPath();
    const B = g.beakUp;
    ctx.moveTo(B[0].x + 6, B[0].y + 4);
    ctx.bezierCurveTo(B[1].x, B[1].y + 2, B[2].x, B[2].y + 2, B[3].x, B[3].y + 4);
    ctx.stroke();
  }

  function bbox(pts) {
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const p of pts) {
      x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y);
    }
    return { x0, y0, x1, y1 };
  }

  function inPoly(poly, x, y) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i].x,
        yi = poly[i].y,
        xj = poly[j].x,
        yj = poly[j].y;
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }
  PU.inPoly = inPoly;

  // eye + dark accents, drawn on the final canvas (source-over) so the pupil is truly dark
  PU.drawEye = function (ctx, g) {
    const e = PU.EYE;
    ctx.save();
    // white-hot brow streak sweeping back
    ctx.globalCompositeOperation = 'lighter';
    const sg = ctx.createLinearGradient(e.x + 30, e.y, e.x - 110, e.y - 20);
    sg.addColorStop(0, 'rgba(255,250,230,0.9)');
    sg.addColorStop(1, 'rgba(255,160,60,0)');
    ctx.fillStyle = sg;
    ctx.beginPath();
    ctx.moveTo(e.x + 34, e.y - 14);
    ctx.quadraticCurveTo(e.x - 20, e.y - 40, e.x - 120, e.y - 22);
    ctx.quadraticCurveTo(e.x - 40, e.y - 22, e.x + 30, e.y - 4);
    ctx.closePath();
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    // socket
    ctx.fillStyle = 'rgba(30,4,2,0.92)';
    ctx.beginPath();
    ctx.ellipse(e.x, e.y, 30, 24, -0.2, 0, TAU);
    ctx.fill();
    // iris
    const ig = ctx.createRadialGradient(e.x - 3, e.y - 3, 2, e.x, e.y, 21);
    ig.addColorStop(0, '#fffbe8');
    ig.addColorStop(0.35, '#ffd25a');
    ig.addColorStop(0.75, '#f26a10');
    ig.addColorStop(1, '#6a0c06');
    ctx.fillStyle = ig;
    ctx.beginPath();
    ctx.ellipse(e.x, e.y, 21, 19, -0.2, 0, TAU);
    ctx.fill();
    // pupil
    ctx.fillStyle = '#080102';
    ctx.beginPath();
    ctx.ellipse(e.x + 2, e.y, 6.5, 11, 0, 0, TAU);
    ctx.fill();
    // catchlight
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.beginPath();
    ctx.arc(e.x - 6, e.y - 7, 3.6, 0, TAU);
    ctx.fill();
    // mouth line
    ctx.strokeStyle = 'rgba(40,6,2,0.85)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    const lo = g.beakLo;
    ctx.moveTo(lo[0].x - 14, lo[0].y + 2);
    ctx.quadraticCurveTo(lo[1].x, lo[1].y - 3, lo[2].x, lo[2].y - 4);
    ctx.stroke();
    ctx.restore();
  };

  // ------------------------------------------------------------ full renders
  PU.renderPhoenixFire = function (S, seed, g) {
    const noise = PU.makeNoise(PU.hashStr(seed + 'phx-noise'));
    const L = PU.layer(S);
    const ctx = L.ctx;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, PU.W, PU.H);
    const out = { embers: [], smoke: [] };
    // deep under-glow
    ctx.globalCompositeOperation = 'lighter';
    const halo = (x, y, r, col, a) => {
      const gr = ctx.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, PU.rgba(col, a));
      gr.addColorStop(0.4, PU.rgba(col, a * 0.35));
      gr.addColorStop(1, PU.rgba(col, 0));
      ctx.fillStyle = gr;
      ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
    };
    halo(PU.HEART.x, PU.HEART.y, 900, [150, 40, 10], 0.35);
    for (const f of g.feathers) {
      if (f.kind === 'body' && f === g.feathers.find((q) => q.kind === 'body')) {
        // just before body: hot core
        halo(PU.HEART.x, PU.HEART.y, 420, [255, 150, 50], 0.35);
        halo(PU.HEART.x, PU.HEART.y, 160, [255, 235, 190], 0.5);
      }
      drawFeatherFire(ctx, f, noise, out, S);
    }
    // hot leading-edge ridge along each arm
    const rr = PU.rngFor(seed, 'ridge');
    ctx.globalCompositeOperation = 'lighter';
    for (const arm of [g.armL, g.armR]) {
      for (let k = 0; k < 3; k++) {
        const pts = [];
        for (let i = 0; i <= 40; i++) {
          const p = PU.at(arm, 0.14 + (0.78 * i) / 40);
          pts.push({ x: p.x, y: p.y + 10 });
        }
        PU.bristleStroke(ctx, rr, pts, 70 - k * 18, (o) => PU.fire(0.8 + 0.15 * (0.5 - Math.abs(o)) + k * 0.05), 0.09, 26);
      }
    }
    const hr = PU.rngFor(seed, 'head');
    drawHeadFire(ctx, g, noise, hr);
    // leading-edge flame licks
    const lr = PU.rngFor(seed, 'licks');
    ctx.globalCompositeOperation = 'lighter';
    for (const arm of [g.armL, g.armR]) {
      for (let i = 0; i < 70; i++) {
        const s = lr.r(0, 0.95);
        const p = PU.at(arm, s);
        const up = p.ny < 0 ? 1 : -1;
        PU.flameLick(ctx, noise, lr, p.x, p.y - 10, Math.atan2(p.ny * up, p.nx * up) * 0.5 - Math.PI / 4, lr.r(80, 260) * (1 - 0.4 * s), lr.r(25, 60), 0.92 - 0.2 * s, 0.22, 0.14);
      }
    }
    // heart flare
    halo(PU.HEART.x, PU.HEART.y, 110, [255, 250, 235], 0.4);
    out.layer = L;
    return out;
  };

  PU.renderGhostBird = function (ctx, seed, g, headOnly) {
    const rng = PU.rngFor(seed, 'ghost');
    for (const f of g.feathers) {
      if (f.kind === 'marginal' && rng.chance(0.5)) continue;
      const head = f.kind === 'crest' || (f.kind === 'body' && f.s < 0.22);
      if (headOnly ? !head : f.kind === 'crest') continue;
      drawFeatherGhost(ctx, f, rng);
    }
    if (!headOnly) return;
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = PU.rgba(PU.ice(0.66), 1);
    PU.poly(ctx, PU.catmull(g.head.concat([g.head[0]]), 8), true);
    ctx.fill();
    ctx.fillStyle = PU.rgba(PU.ice(0.62), 1);
    PU.poly(ctx, PU.catmull(g.beakUp, 6), true);
    ctx.fill();
  };

  // embers + smoke from the bird (drawn after compositing)
  PU.drawEmbers = function (ctx, embers) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const e of embers) {
      const c = PU.fire(e.heat);
      const tr = e.vy * 14 + 2;
      ctx.strokeStyle = PU.rgba(c, 0.35 * e.a);
      ctx.lineWidth = e.r * 1.4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(e.x, e.y - tr);
      ctx.lineTo(e.x, e.y);
      ctx.stroke();
      ctx.fillStyle = PU.rgba(PU.fire(Math.min(1, e.heat + 0.15)), 0.9 * e.a);
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.r * 0.7, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  };
})(typeof window !== 'undefined' ? window : globalThis);
