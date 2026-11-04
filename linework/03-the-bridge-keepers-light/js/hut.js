/* hut.js: the keeper's bank: scree, ground, stone hut with round window and
   open door, the steps, the landing, the lantern post and lantern, the boat. */
(function () {
  'use strict';
  const LW = window.LW;
  const P = LW.P, L = LW.L;
  const N = new LW.Noise(701);
  const N2 = new LW.Noise(702);
  const VP = L.VP;

  // ---------------------------------------------------------------- shared helpers
  // value -> fill colour for stone-ish things with firelight override
  function stoneFill(d, x, y, kind = 'rock', pal) {
    pal = pal || [P.rock0, P.rock1, P.rock2, P.rock3, P.rock4];
    let c = LW.stepPick(pal, LW.clamp(d, 0, 0.999), x, y, kind === 'boat' ? 0 : 0.03);
    const b = kind === 'boat' ? LW.warmBand(LW.warm(x, y, kind), x, y, 0) : LW.warmBand(LW.warm(x, y, kind), x, y);
    if (b > 0) c = LW.warmFill[b];
    return c;
  }
  LW.stoneFill = stoneFill;
  function inkAt(ink, x, y, kind = 'rock', base = P.ink) {
    const b = LW.warmBand(LW.warm(x, y, kind), x, y);
    return ink.col(LW.warmInkColor(b, base));
  }
  LW.inkAt = inkAt;
  function blob(cx, cy, rx, ry, seed, rough = 0.14, n = 40) {
    const pts = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const k = 1 + rough * N.n2(Math.cos(a) * 1.3 + seed, Math.sin(a) * 1.3 + seed * 0.7) + rough * 0.4 * N2.n2(Math.cos(a) * 4 + seed, Math.sin(a) * 4);
      // flatter base, as stones settle
      let y = Math.sin(a) * ry * k;
      if (y > ry * 0.55) y = ry * 0.55 + (y - ry * 0.55) * 0.4;
      pts.push([cx + Math.cos(a) * rx * k, cy + y]);
    }
    return pts;
  }
  LW.blob = blob;

  /* A pile of rounded stones packed inside a polygon, drawn back-to-front.
     opts: rMin, rMax, seed, dark (base value), kind, squash, wet (cyan rim near y) */
  LW.drawStonePile = function (ctx, S, poly, opts) {
    const rng = new LW.RNG(opts.seed || 'pile');
    const bb = LW.bbox(poly);
    const stones = [];
    const tries = opts.tries || 4000;
    for (let t = 0; t < tries; t++) {
      const x = bb[0] + rng.next() * (bb[2] - bb[0]);
      const y = bb[1] + rng.next() * (bb[3] - bb[1]);
      if (!LW.pointInPoly(x, y, poly)) continue;
      // stones grow toward the viewer
      const persp = opts.persp ? LW.clamp((y - bb[1]) / (bb[3] - bb[1] + 1), 0, 1) : 0.5;
      const r = (opts.rMin + (opts.rMax - opts.rMin) * (0.35 * rng.next() + 0.65 * persp)) * (0.8 + rng.next() * 0.4);
      let ok = true;
      for (const s of stones) {
        const dx = (s.x - x) / ((s.rx + r) * 0.82), dy = (s.y - y) / ((s.ry + r * (opts.squash || 0.62)) * 0.82);
        if (dx * dx + dy * dy < 1) { ok = false; break; }
      }
      if (!ok) continue;
      stones.push({ x, y, rx: r * (0.9 + rng.next() * 0.35), ry: r * (opts.squash || 0.62) * (0.85 + rng.next() * 0.3), seed: rng.next() * 100, tone: (rng.next() - 0.5) * 0.25 });
    }
    stones.sort((a, b) => a.y - b.y);
    const ink = new LW.Ink((opts.seed || 1) + 7);
    ink.wobble = 0.6;
    const kind = opts.kind || 'rock';
    const off = LW.PLATE_OFF;
    const clipPath = opts.clip ? LW.polyPath(poly) : null;
    ctx.save();
    if (clipPath) ctx.clip(clipPath);
    for (const s of stones) {
      const pts = blob(s.x, s.y, s.rx, s.ry, s.seed);
      const path = LW.polyPath(pts);
      // fill: shadow body + lit cap toward the light
      const wv = LW.warm(s.x, s.y - s.ry * 0.3, kind);
      const warmLit = wv > 0.25;
      const d = LW.clamp((opts.dark || 0.45) + s.tone, 0, 1);
      const cShadow = stoneFill(d + 0.28, s.x, s.y + s.ry * 0.4, kind);
      const cLit = stoneFill(d - 0.12, s.x, s.y - s.ry * 0.4, kind);
      ctx.save();
      ctx.translate(off[0], off[1]);
      ctx.fillStyle = LW.rgb(cShadow);
      ctx.fill(path);
      ctx.clip(path);
      // light comes from the lantern (left/below-ish) when firelit, else the moon (upper right)
      const lx = warmLit ? Math.sign(L.lantern[0] - s.x) * 0.3 : 0.32, ly = -0.42;
      ctx.translate(s.x + lx * s.rx * 0.9, s.y + ly * s.ry * 0.9);
      ctx.scale(0.86, 0.8);
      ctx.translate(-s.x, -s.y);
      ctx.fillStyle = LW.rgb(cLit);
      ctx.fill(path);
      ctx.restore();
      // wet cyan rim along the waterline
      if (opts.wetY && s.y + s.ry > opts.wetY(s.x) - 8) {
        ctx.save();
        ctx.clip(path);
        ctx.fillStyle = LW.rgb(LW.mix(P.water2, P.rock2, 0.35));
        ctx.fillRect(s.x - s.rx - 4, opts.wetY(s.x) - 10, s.rx * 2 + 8, 30);
        ctx.restore();
      }
      // ink: contour arcs on the shadow side
      const iCol = inkAt(ink, s.x, s.y, kind);
      const nArcs = Math.max(2, Math.round(s.rx / 7 * (0.4 + d)));
      for (let k = 1; k <= nArcs; k++) {
        const f = 1 - k / (nArcs + 1.2);
        const arc = [];
        for (const p of pts) arc.push([s.x + (p[0] - s.x) * f - (1 - f) * s.rx * lx * 0.8, s.y + (p[1] - s.y) * f - (1 - f) * s.ry * ly * 0.8]);
        arc.push(arc[0]);
        ink.line(arc, (x, y) => {
          // only on the side away from the light
          const nx = (x - s.x) / s.rx, ny = (y - s.y) / s.ry;
          const facing = nx * lx + ny * ly;
          if (facing > -0.15 + (k % 2) * 0.12) return -1;
          return ink.st(iCol, 0.9 + 0.5 * (1 - f));
        }, { taper: 8 });
      }
      // outline: heavy at the base, light on the lit cap
      const ol = pts.concat([pts[0]]);
      ink.line(ol, (x, y) => {
        const ny = (y - s.y) / s.ry;
        return ink.st(iCol, 1.5 + Math.max(0, ny) * 2.2 * (opts.weight || 1));
      }, { taper: 0 });
      // flush per stone so later stones overlap earlier ink properly
      ink.flush(ctx);
    }
    ctx.restore();
    return stones;
  };

  // ---------------------------------------------------------------- masonry in a quad (bilinear)
  function quadPt(q, u, v) {
    const [a, b, c, d] = q; // tl, tr, br, bl
    const tx = a[0] + (b[0] - a[0]) * u, ty = a[1] + (b[1] - a[1]) * u;
    const bx = d[0] + (c[0] - d[0]) * u, by = d[1] + (c[1] - d[1]) * u;
    return [tx + (bx - tx) * v, ty + (by - ty) * v];
  }
  LW.quadPt = quadPt;
  function masonry(q, rows, colsMin, colsMax, rng) {
    const stones = [];
    const wpx = Math.hypot(q[1][0] - q[0][0], q[1][1] - q[0][1]), hpx = Math.hypot(q[3][0] - q[0][0], q[3][1] - q[0][1]);
    const gu = 2.4 / wpx, gv = 2.0 / hpx;
    let v = 0;
    while (v < 1) {
      const h = (1 / rows) * (0.7 + rng.next() * 0.6);
      const v2 = Math.min(1, v + h);
      let u = -rng.next() * 0.1;
      while (u < 1) {
        const w = 1 / (colsMin + rng.next() * (colsMax - colsMin));
        const u2 = Math.min(1.05, u + w);
        const corners = [quadPt(q, u + gu, v + gv), quadPt(q, u2 - gu, v + gv), quadPt(q, u2 - gu, v2 - gv), quadPt(q, u + gu, v2 - gv)];
        stones.push({ corners, u: (u + u2) / 2, v: (v + v2) / 2, tone: (rng.next() - 0.5) * 0.35 });
        u = u2;
      }
      v = v2;
    }
    return stones;
  }
  function roundStone(corners, seed) {
    const pts = [];
    for (let i = 0; i < 4; i++) {
      const a = corners[i], b = corners[(i + 1) % 4];
      const L0 = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const n = Math.max(3, Math.round(L0 / 6));
      for (let k = 0; k < n; k++) {
        let t = k / n;
        if (k === 0) t = Math.min(0.3, 3 / L0);
        const x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t;
        const d = N.n2(x / 7 + seed, y / 7) * 1.3;
        const nx = -(b[1] - a[1]) / L0, ny = (b[0] - a[0]) / L0;
        pts.push([x + nx * d, y + ny * d]);
      }
    }
    return pts;
  }

  // draw a stone wall face: fill per stone + bed hatch + outlines
  function drawWall(ctx, S, clipPath, q, rows, cMin, cMax, seed, baseDark, kind, hatchDir) {
    const rng = new LW.RNG(seed);
    const stones = masonry(q, rows, cMin, cMax, rng);
    const ink = new LW.Ink(LW.hashStr(seed));
    ink.wobble = 0.5;
    const off = LW.PLATE_OFF;
    ctx.save();
    ctx.clip(clipPath);
    // mortar / shadow ground
    ctx.save();
    ctx.translate(off[0], off[1]);
    ctx.fillStyle = LW.rgb(stoneFill(baseDark + 0.35, q[0][0], q[0][1], kind));
    ctx.fill(clipPath);
    ctx.restore();
    for (const s of stones) {
      const out = roundStone(s.corners, s.u * 10 + s.v * 7);
      const cx = (s.corners[0][0] + s.corners[2][0]) / 2, cy = (s.corners[0][1] + s.corners[2][1]) / 2;
      const d = LW.clamp(baseDark + s.tone, 0, 1);
      const path = LW.polyPath(out);
      // per-pixel shading so firelight bands cross stones naturally
      LW.shadeFill(ctx, S, path, LW.bbox(out, 2), (x, y, o) => {
        const c = stoneFill(d, x, y, kind);
        o[0] = c[0]; o[1] = c[1]; o[2] = c[2];
      });
      // hatching inside: lines along the course direction
      const wv = LW.clamp(LW.warm(cx, cy, kind), 0, 1.2);
      const dd = d * (1 - 0.45 * Math.min(1, wv));
      const nl = Math.round(1 + dd * 5);
      for (let k = 1; k <= nl; k++) {
        const t = 0.25 + (0.7 * k) / (nl + 1);
        const p0 = [s.corners[0][0] + (s.corners[3][0] - s.corners[0][0]) * t, s.corners[0][1] + (s.corners[3][1] - s.corners[0][1]) * t];
        const p1 = [s.corners[1][0] + (s.corners[2][0] - s.corners[1][0]) * t, s.corners[1][1] + (s.corners[2][1] - s.corners[1][1]) * t];
        const st = 0.08 + rng.next() * 0.2 * (1 - dd), en = 0.92 - rng.next() * 0.35 * (1 - dd);
        const pts = [];
        for (let m = 0; m <= 6; m++) {
          const tt = st + ((en - st) * m) / 6;
          pts.push([p0[0] + (p1[0] - p0[0]) * tt, p0[1] + (p1[1] - p0[1]) * tt + N.n2(m, k + cx) * 0.6]);
        }
        ink.line(pts, (x, y) => ink.st(inkAt(ink, x, y, kind), 0.8 + dd * 0.9), { taper: 6 });
      }
      ink.line(out.concat([out[0]]), (x, y) => {
        const below = y > cy;
        return ink.st(inkAt(ink, x, y, kind), below ? 2.1 : 1.3);
      }, { taper: 0 });
    }
    ink.flush(ctx);
    ctx.restore();
    void hatchDir;
  }

  // ---------------------------------------------------------------- hut geometry
  const toVP = (p, t) => [p[0] + (VP[0] - p[0]) * t, p[1] + (VP[1] - p[1]) * t];
  const HUT = (LW.hut = {});
  {
    const x0 = 110, x1 = 560, base = 2712, eave = 2414, apexX = 335, apexY = 2206;
    HUT.front = [[x0, base], [x0, eave], [apexX, apexY], [x1, eave], [x1, base]];
    const depth = 0.15; // fraction toward VP for the side wall
    HUT.sideQ = [[x1, eave], toVP([x1, eave], depth), toVP([x1, base], depth), [x1, base]];
    // roof: right slope seen from above
    const eaveF = [x1 + 30, eave + 16];
    const apexF = [apexX, apexY - 14];
    HUT.roofQ = [apexF, toVP(apexF, depth + 0.02), toVP(eaveF, depth + 0.02), eaveF];
    HUT.roofLeft = [[x0 - 28, eave + 16], apexF, [apexX - 4, apexY - 2], [x0 - 10, eave + 18]];
    HUT.door = { x0: 291, x1: 381, y0: 2532, y1: base };
    HUT.win = [335, 2326, 38];
    HUT.base = base;
    HUT.chimney = [[466, 2144], [508, 2132], [508, 2250], [466, 2262]];
  }
  // sync the light model with the actual openings
  L.door = { x0: HUT.door.x0, x1: HUT.door.x1, y0: HUT.door.y0, y1: HUT.door.y1 };
  L.window = [HUT.win[0], HUT.win[1], HUT.win[2]];

  // steps from the door down to the landing
  const STEPS = (LW.steps = []);
  {
    const n = 7;
    for (let k = 0; k < n; k++) {
      const x = 286 + k * 54, y = HUT.base + k * 24;
      const w = 118 + k * 4;
      STEPS.push({ x, y, w, rise: 24, depth: 13 });
    }
  }
  const LANDING = (LW.landing = [[640, 2876], [944, 2884], [984, 2902], [978, 2920], [640, 2922]]);

  // ---------------------------------------------------------------- bank (scree, ground)
  LW.drawBank = function (ctx, S) {
    const t0 = performance.now();
    // the beach in front of the hut: packed sand and grit, tide lines following the shore
    const shoreLine = [[986, 2918], [960, 2990], [880, 3080], [800, 3180], [720, 3300], [600, 3440], [480, 3600]];
    const ground = [[-30, 2880], [400, 2884], [640, 2890], [640, 2925]].concat(shoreLine, [[-30, 3620]]);
    LW.beach = ground;
    const gp = LW.polyPath(ground);
    const gbb = LW.bbox(ground, 4);
    const shoreDist = (x, y) => {
      let best = 1e9;
      for (let i = 0; i < shoreLine.length - 1; i++) {
        const a = shoreLine[i], b = shoreLine[i + 1];
        const vx = b[0] - a[0], vy = b[1] - a[1];
        const t = LW.clamp(((x - a[0]) * vx + (y - a[1]) * vy) / (vx * vx + vy * vy), 0, 1);
        const d = Math.hypot(x - a[0] - vx * t, y - a[1] - vy * t);
        if (d < best) best = d;
      }
      return best;
    };
    const gDark = (x, y) => 0.36 + 0.4 * LW.smooth(2950, 3550, y) + 0.22 * LW.smooth(420, 0, x) + 0.06 * N.fbm(x / 120, y / 60, 2);
    LW.shadeFill(ctx, S, gp, gbb, (x, y, o) => {
      const sd = shoreDist(x, y);
      let c = stoneFill(gDark(x, y), x, y, 'rock', [P.rock0, P.rock1, P.rock2, P.rock3, P.rock4]);
      if (sd < 26 + 8 * N.n2(x / 30, y / 30)) c = LW.mix(c, P.water2, 0.45); // wet sand lap
      o[0] = c[0]; o[1] = c[1]; o[2] = c[2];
    });
    {
      const ink = new LW.Ink(711);
      ink.wobble = 0.8;
      const field = (x, y) => shoreDist(x, y) + 34 * N.fbm(x / 260, y / 170, 3);
      LW.contours({ bbox: gbb, step: 3, field, levelStep: 9 }, (pts, lev) => {
        ink.line(pts, (x, y) => {
          const wv = LW.warm(x, y, 'rock');
          const rank = lev % 4 === 0 ? 0 : lev % 2 === 0 ? 1 : 2;
          const d = gDark(x, y) + 0.1 - 0.3 * Math.min(1, wv);
          if (rank === 2 && d < 0.5) return -1;
          if (rank === 1 && d < 0.32) return -1;
          if (N.n2(x / 90, y / 30 + lev * 0.7) > 0.45) return -1;
          return ink.st(inkAt(ink, x, y), 1.0 + d * 1.0);
        }, { taper: 14 });
      });
      ctx.save();
      ctx.clip(gp);
      ink.flush(ctx);
      ctx.restore();
      // pebbles and grit
      const rng = new LW.RNG('pebbles');
      const ink2 = new LW.Ink(712);
      for (let i = 0; i < 700; i++) {
        const x = gbb[0] + rng.next() * (gbb[2] - gbb[0]), y = gbb[1] + rng.next() * (gbb[3] - gbb[1]);
        if (!LW.pointInPoly(x, y, ground)) continue;
        const big = rng.next() < 0.08;
        const r = (1.6 + rng.next() * 3.5 * LW.smooth(2600, 3500, y) + 1) * (big ? 3.2 : 1);
        const pts = blob(x, y, r, r * 0.6, i, 0.22, big ? 18 : 10);
        const c = stoneFill(0.1 + rng.next() * 0.3, x, y - r);
        ctx.fillStyle = LW.rgb(c);
        ctx.fill(LW.polyPath(pts));
        ink2.line(pts.concat([pts[0]]), (xx, yy) => ink2.st(inkAt(ink2, xx, yy), yy > y ? (big ? 2.2 : 1.3) : 0.8), { taper: 0 });
        if (big) ink2.line([[x - r * 0.8, y + r * 0.25], [x + r * 0.6, y + r * 0.35]], (xx, yy) => ink2.st(inkAt(ink2, xx, yy), 1.0), { taper: 4 });
      }
      ink2.flush(ctx);
    }
    // the rock shelf the hut stands on (its front face drops to the beach)
    {
      const top = [[-40, 2690], [110, 2700], [330, 2708], [560, 2714], [650, 2734], [706, 2800]];
      const poly = top.concat([[700, 2860], [690, 2896], [420, 2902], [180, 2896], [-40, 2904]]);
      const sh = { name: 'SH', poly, edge: top, tier: 2, face: [0.15, 0.99], base: null, seed: 61, kind: 'rock' };
      sh.path = LW.polyPath(poly);
      sh.bbox = LW.bbox(poly, 4);
      LW.drawCliffLayer(ctx, S, sh);
    }
    // scree between the hut and the river under the bridge end
    const scree = [[590, 2290], [700, 2296], [772, 2334], [780, 2420], [756, 2520], [774, 2620], [824, 2730], [880, 2826], [720, 2846], [640, 2760], [606, 2600], [596, 2440]];
    LW.drawStonePile(ctx, S, scree, { rMin: 13, rMax: 30, seed: 'scree1', dark: 0.5, kind: 'rock', persp: true, tries: 5000, wetY: (x) => 1e9 });
    LW.log('bank ms', Math.round(performance.now() - t0));
  };

  // ---------------------------------------------------------------- hut
  LW.drawHut = function (ctx, S) {
    const t0 = performance.now();
    const ink = new LW.Ink(721);
    ink.wobble = 0.6;
    // side wall (receding)
    const sideP = LW.polyPath(HUT.sideQ);
    drawWall(ctx, S, sideP, HUT.sideQ, 13, 3, 4.5, 'hutside', 0.62, 'rock');
    // front wall
    const frontP = LW.polyPath(HUT.front);
    const fq = [[110, 2206], [560, 2206], [560, 2712], [110, 2712]];
    drawWall(ctx, S, frontP, fq, 21, 6, 10, 'hutfront', 0.42, 'hutwall');
    // quoins at the front corner
    {
      const rng = new LW.RNG('quoin');
      let y = 2414;
      let k = 0;
      while (y < 2712) {
        const h = 30 + rng.next() * 8;
        const w = k % 2 ? 34 : 54;
        const q = [[560 - w, y + 2], [560, y + 2], [560, Math.min(2712, y + h) - 2], [560 - w, Math.min(2712, y + h) - 2]];
        const out = roundStone(q, k * 3.1);
        LW.shadeFill(ctx, S, LW.polyPath(out), LW.bbox(out, 2), (x, yy, o) => {
          const c = stoneFill(0.3, x, yy, 'hutwall');
          o[0] = c[0]; o[1] = c[1]; o[2] = c[2];
        });
        ink.line(out.concat([out[0]]), (x, yy) => ink.st(inkAt(ink, x, yy, 'hutwall'), 1.9), { taper: 0 });
        y += h;
        k++;
      }
    }
    // round window: deep reveal, glass glowing, mullion cross
    {
      const [wx, wy, wr] = HUT.win;
      const ring = new Path2D();
      ring.arc(wx, wy, wr + 14, 0, Math.PI * 2);
      LW.shadeFill(ctx, S, ring, [wx - wr - 16, wy - wr - 16, wx + wr + 16, wy + wr + 16], (x, y, o) => {
        const c = stoneFill(0.25, x, y, 'hutwall');
        o[0] = c[0]; o[1] = c[1]; o[2] = c[2];
      });
      // voussoir ring of the window
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        ink.line([[wx + Math.cos(a) * wr, wy + Math.sin(a) * wr], [wx + Math.cos(a) * (wr + 14), wy + Math.sin(a) * (wr + 14)]], (x, y) => ink.st(inkAt(ink, x, y, 'hutwall'), 1.6), { taper: 0 });
      }
      const glass = new Path2D();
      glass.arc(wx, wy, wr, 0, Math.PI * 2);
      LW.shadeFill(ctx, S, glass, [wx - wr - 2, wy - wr - 2, wx + wr + 2, wy + wr + 2], (x, y, o) => {
        const d = Math.hypot(x - wx, y - wy + 6) / wr + N.n2(x / 6, y / 6) * 0.06;
        const c = d < 0.45 ? P.warm6 : d < 0.8 ? P.warm5 : P.warm4;
        o[0] = c[0]; o[1] = c[1]; o[2] = c[2];
      }, [0, 0]);
      // inner reveal shadow (top-left) as a crescent of hatch
      for (let k = 0; k < 6; k++) {
        const rr = wr - 2 - k * 2.2;
        const pts = [];
        for (let a = Math.PI * 0.95; a <= Math.PI * 1.8; a += 0.05) pts.push([wx + Math.cos(a) * rr, wy + Math.sin(a) * rr]);
        ink.line(pts, ink.st(ink.col(P.warmInk2), 1.4 - k * 0.15), { taper: 10 });
      }
      const mc = ink.col(P.warmInk1);
      ink.line([[wx - wr, wy], [wx + wr, wy]], ink.st(mc, 3.2), { taper: 0 });
      ink.line([[wx, wy - wr], [wx, wy + wr]], ink.st(mc, 3.2), { taper: 0 });
      const circ = [];
      for (let a = 0; a <= Math.PI * 2 + 0.05; a += 0.05) circ.push([wx + Math.cos(a) * wr, wy + Math.sin(a) * wr]);
      ink.line(circ, ink.st(ink.col(P.ink), 3.2), { taper: 0 });
      const circ2 = circ.map((p) => [wx + (p[0] - wx) * ((wr + 14) / wr), wy + (p[1] - wy) * ((wr + 14) / wr)]);
      ink.line(circ2, (x, y) => ink.st(inkAt(ink, x, y, 'hutwall'), 2.2), { taper: 0 });
    }
    // open door: arched opening, glowing interior, the leaf swung inward, keeper's silhouette
    {
      const D = HUT.door;
      const cx = (D.x0 + D.x1) / 2, r = (D.x1 - D.x0) / 2;
      const open = [[D.x0, D.y1]];
      for (let a = Math.PI; a <= Math.PI * 2 + 0.001; a += 0.05) open.push([cx + Math.cos(a) * r, D.y0 + r + Math.sin(a) * r]);
      open.push([D.x1, D.y1]);
      const op = LW.polyPath(open);
      // arch stones around the door
      for (let i = 0; i <= 8; i++) {
        const a = Math.PI + (i / 8) * Math.PI;
        const a2 = Math.PI + ((i + 1) / 8) * Math.PI;
        if (i === 8) break;
        const q = [[cx + Math.cos(a) * r, D.y0 + r + Math.sin(a) * r], [cx + Math.cos(a) * (r + 18), D.y0 + r + Math.sin(a) * (r + 18)], [cx + Math.cos(a2) * (r + 18), D.y0 + r + Math.sin(a2) * (r + 18)], [cx + Math.cos(a2) * r, D.y0 + r + Math.sin(a2) * r]];
        const out = roundStone(q, i * 1.7);
        LW.shadeFill(ctx, S, LW.polyPath(out), LW.bbox(out, 2), (x, y, o) => {
          const c = stoneFill(0.22, x, y, 'rock');
          o[0] = c[0]; o[1] = c[1]; o[2] = c[2];
        });
        ink.line(out.concat([out[0]]), (x, y) => ink.st(inkAt(ink, x, y, 'rock'), 1.8), { taper: 0 });
      }
      LW.shadeFill(ctx, S, op, [D.x0 - 2, D.y0 - 2, D.x1 + 2, D.y1 + 2], (x, y, o) => {
        // interior: brightest low and centre (a hearth glow), floor plane visible
        const t = Math.hypot((x - cx) / r, (y - (D.y1 - 40)) / 90) + N.n2(x / 9, y / 9) * 0.08;
        const c = t < 0.55 ? P.warm6 : t < 1.0 ? P.warm5 : P.warm4;
        o[0] = c[0]; o[1] = c[1]; o[2] = c[2];
      }, [0, 0]);
      ctx.save();
      ctx.clip(op);
      // door leaf seen edge-on, swung inward on the left
      const leaf = [[D.x0, D.y0 + r * 0.6], [D.x0 + 16, D.y0 + r * 0.9], [D.x0 + 16, D.y1 - 6], [D.x0, D.y1]];
      ctx.fillStyle = LW.rgb(P.warmInk2);
      ctx.fill(LW.polyPath(leaf));
      for (let k = 0; k < 5; k++) ink.line([[D.x0 + 2 + k * 3, D.y0 + r * 0.7 + k * 4], [D.x0 + 2 + k * 3, D.y1 - 4]], ink.st(ink.col(P.warmInk3), 0.9), { taper: 4 });
      // interior back wall hatch, faint, warm
      for (let y = D.y0; y < D.y1 - 50; y += 7) ink.line([[D.x0 + 18, y], [D.x1, y + 2]], (x, yy) => (Math.hypot(x - cx, yy - (D.y1 - 40)) < 46 ? -1 : ink.st(ink.col(P.warm3), 1.0)), { taper: 6 });
      // the keeper: a small hooded silhouette in the doorway
      const kx = cx + 10, ky = D.y1 - 4;
      const body = [[kx - 13, ky], [kx - 11, ky - 46], [kx - 13, ky - 70], [kx - 9, ky - 86], [kx - 4, ky - 96], [kx + 4, ky - 97], [kx + 9, ky - 88], [kx + 10, ky - 72], [kx + 13, ky - 50], [kx + 15, ky]];
      ctx.fillStyle = LW.rgb(P.warmInk1);
      ctx.fill(LW.polyPath(LW.chaikin(body, 2, true)));
      ctx.restore();
      ink.line(open, ink.st(ink.col(P.ink), 3.4), { taper: 0 });
      // threshold slab
      const th = [[D.x0 - 14, D.y1 - 2], [D.x1 + 14, D.y1 - 2], [D.x1 + 20, D.y1 + 8], [D.x0 - 20, D.y1 + 8]];
      ctx.fillStyle = LW.rgb(P.warm5);
      ctx.fill(LW.polyPath(th));
      ink.line(th.concat([th[0]]), ink.st(ink.col(P.warmInk2), 1.8), { taper: 0 });
    }
    // roof: left (front) eave edge, right slope from above with slate rows
    {
      const rq = HUT.roofQ;
      const rp = LW.polyPath(rq);
      LW.shadeFill(ctx, S, rp, LW.bbox(rq, 2), (x, y, o) => {
        const d = 0.55 + 0.12 * N.fbm(x / 60, y / 60, 2);
        const c = stoneFill(d, x, y, 'hutwall', [P.rock2, P.rock3, P.rock4, LW.mix(P.rock4, P.ink, 0.4)]);
        o[0] = c[0]; o[1] = c[1]; o[2] = c[2];
      });
      const rng = new LW.RNG('slates');
      const rows = 13;
      ctx.save();
      ctx.clip(rp);
      for (let k = 0; k < rows; k++) {
        const v0 = k / rows, v1 = (k + 1) / rows;
        let u = (k % 2) * -0.12 - rng.next() * 0.06;
        while (u < 1) {
          const u2 = u + 0.2 + rng.next() * 0.12;
          const q = [LW.quadPt(rq, u + 0.004, v0), LW.quadPt(rq, u2 - 0.004, v0), LW.quadPt(rq, u2 - 0.004, v1 + 0.012), LW.quadPt(rq, u + 0.004, v1 + 0.012)];
          q[2][1] += (rng.next() - 0.3) * 3; q[3][1] += (rng.next() - 0.3) * 3;
          const tone = 0.22 + (rng.next() - 0.5) * 0.28 + 0.25 * v0;
          LW.shadeFill(ctx, S, LW.polyPath(q), LW.bbox(q, 2), (x, y, o) => {
            const c = stoneFill(tone, x, y, 'hutwall', [P.rock1, P.rock2, P.rock3, P.rock4]);
            o[0] = c[0]; o[1] = c[1]; o[2] = c[2];
          });
          // shading hatch toward each slate's lower (shadowed) edge
          for (let hh = 0; hh < 4; hh++) {
            const vv = v0 + (v1 - v0) * (0.45 + hh * 0.16);
            const s0 = LW.quadPt(rq, u + 0.012, vv), s1 = LW.quadPt(rq, u2 - 0.012, vv);
            if (hh < 2 && tone < 0.45) continue;
            ink.line([s0, s1], (x, y) => ink.st(inkAt(ink, x, y, 'hutwall'), 0.9 + hh * 0.2), { taper: 5 });
          }
          ink.line([q[3], q[2]], (x, y) => ink.st(inkAt(ink, x, y, 'hutwall'), 2.4), { taper: 0 });
          ink.line([q[0], q[3]], (x, y) => ink.st(inkAt(ink, x, y, 'hutwall'), 1.4), { taper: 0 });
          ink.flush(ctx);
          u = u2;
        }
      }
      ctx.restore();
      // front gable edge (barge board) as a thick band
      const barge = [HUT.roofLeft[0], HUT.roofQ[0], HUT.roofQ[3], [HUT.roofQ[3][0] - 6, HUT.roofQ[3][1] + 12], [HUT.roofQ[0][0], HUT.roofQ[0][1] + 16], [HUT.roofLeft[0][0] + 4, HUT.roofLeft[0][1] + 12]];
      LW.shadeFill(ctx, S, LW.polyPath(barge), LW.bbox(barge, 2), (x, y, o) => {
        const c = stoneFill(0.6, x, y, 'hutwall', [P.wood0, P.wood1, P.rock4]);
        o[0] = c[0]; o[1] = c[1]; o[2] = c[2];
      });
      ink.line(barge.concat([barge[0]]), ink.st(ink.col(P.ink), 3.0), { taper: 0 });
      ink.line(rq.concat([rq[0]]), ink.st(ink.col(P.ink), 3.2), { taper: 0 });
    }
    // chimney standing on the roof slope
    {
      const p = LW.polyPath(HUT.chimney);
      drawWall(ctx, S, p, HUT.chimney.map((q) => q.slice()), 6, 1.5, 2.5, 'chimney', 0.55, 'hutwall');
      const cap = [[460, 2134], [514, 2120], [516, 2132], [462, 2146]];
      ctx.fillStyle = LW.rgb(P.rock4);
      ctx.fill(LW.polyPath(cap));
      ink.line(cap.concat([cap[0]]), ink.st(ink.col(P.ink), 2.4), { taper: 0 });
      ink.line(HUT.chimney.concat([HUT.chimney[0]]), ink.st(ink.col(P.ink), 2.6), { taper: 0 });
    }
    // wall outlines
    ink.line(HUT.front.concat([HUT.front[0]]), ink.st(ink.col(P.ink), 3.6), { taper: 0 });
    ink.line(HUT.sideQ.concat([HUT.sideQ[0]]), ink.st(ink.col(P.ink), 3.4), { taper: 0 });
    ink.flush(ctx);
    // steps and landing
    drawSteps(ctx, S);
    drawProps(ctx, S);
    LW.log('hut ms', Math.round(performance.now() - t0));
  };

  // chimney smoke: a drifting ribbon with curling engraved lines
  LW.drawSmoke = function (ctx, S) {
    const rng = new LW.RNG('smoke2');
    const base = [487, 2126];
    const n = 140;
    const cl = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const rise = t * 760;
      cl.push([base[0] - rise * 0.16 - 210 * t * t + 46 * Math.sin(t * 6.2) * t, base[1] - rise + 22 * Math.sin(t * 4 + 1) * t]);
    }
    const wAt = (t) => 16 + 230 * Math.pow(t, 1.1);
    const L = [], R = [];
    for (let i = 0; i <= n; i++) {
      const a = cl[Math.max(0, i - 1)], b = cl[Math.min(n, i + 1)];
      let tx = b[0] - a[0], ty = b[1] - a[1];
      const l = Math.hypot(tx, ty) || 1;
      tx /= l; ty /= l;
      const t = i / n;
      const w = wAt(t);
      // billowing lobes on each edge
      const lobeL = 1 + 0.42 * Math.pow(Math.abs(Math.sin(t * 15 + 0.4)), 0.6) * Math.sqrt(t) + 0.1 * N.n2(t * 8, 3);
      const lobeR = 1 + 0.42 * Math.pow(Math.abs(Math.sin(t * 13 + 2.1)), 0.6) * Math.sqrt(t) + 0.1 * N.n2(t * 8, 9);
      L.push([cl[i][0] - ty * w * 0.5 * lobeL, cl[i][1] + tx * w * 0.5 * lobeL]);
      R.push([cl[i][0] + ty * w * 0.5 * lobeR, cl[i][1] - tx * w * 0.5 * lobeR]);
    }
    // three stepped tints, thinning as the plume rises
    const sections = [[0, 0.5, 0.9], [0.5, 0.8, 0.72], [0.8, 1, 0.45]];
    for (const [s0, s1, alpha] of sections) {
      const i0 = Math.floor(s0 * n), i1 = Math.floor(s1 * n);
      const poly = L.slice(i0, i1 + 1).concat(R.slice(i0, i1 + 1).reverse());
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(LW.PLATE_OFF[0], LW.PLATE_OFF[1]);
      ctx.fillStyle = LW.rgb(LW.mix(P.rock1, P.sky4, 0.35));
      ctx.fill(LW.polyPath(LW.chaikin(poly, 2, true)));
      ctx.restore();
    }
    const ink = new LW.Ink(781);
    ink.wobble = 0.6;
    const cWarm = ink.col(P.warm4), cLight = ink.col(LW.mix(P.rock0, [236, 242, 250], 0.45)), cMid = ink.col(LW.mix(P.rock0, P.sky5, 0.3)), cDark = ink.col(P.inkBlue);
    // flowing lines inside the plume
    for (let k = 0; k < 22; k++) {
      const off = -0.47 + (k / 21) * 0.94;
      const ph = rng.next() * 6;
      const amp = 0.06 + rng.next() * 0.1;
      const pts = [];
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        const o = off + amp * Math.sin(t * (8 + k % 4) + ph) * t;
        pts.push([L[i][0] + (R[i][0] - L[i][0]) * (o + 0.5), L[i][1] + (R[i][1] - L[i][1]) * (o + 0.5)]);
      }
      const t0 = rng.next() * 0.25 * Math.abs(off) * 2, t1 = 0.45 + rng.next() * 0.55;
      const seg = pts.slice(Math.floor(t0 * n), Math.floor(t1 * n));
      const darkSide = off > 0.25; // shadowed underside of the plume
      ink.line(seg, (x, y, i) => {
        const t = (i + t0 * n) / n;
        const c = t < 0.1 ? cWarm : darkSide ? cDark : k % 3 === 0 ? cMid : cLight;
        return ink.st(c, (darkSide ? 2.2 : 1.8) * (1 - t * 0.55));
      }, { taper: 50, minScale: 0.1 });
    }
    // a few big curls rolling inside the billows
    for (let c = 0; c < 5; c++) {
      const t = 0.3 + c * 0.13;
      const i = Math.floor(t * n);
      const side = c % 2 ? L : R;
      const p = side[i];
      const r0 = 16 + t * 46;
      const sp = [];
      const dir = c % 2 ? 1 : -1;
      const cx = p[0] + (cl[i][0] - p[0]) * 0.45, cy = p[1] + (cl[i][1] - p[1]) * 0.45;
      for (let a = 0; a < Math.PI * 1.7; a += 0.08) {
        const r = r0 * (1 - a / (Math.PI * 2.6));
        sp.push([cx + Math.cos(a * dir + 1) * r, cy + Math.sin(a * dir + 1) * r * 0.8]);
      }
      ink.line(sp, ink.st(c % 2 ? cLight : cDark, 2.0), { taper: 30, minScale: 0.15 });
    }
    // edge contour, broken
    for (const side of [L, R]) {
      ink.line(side, (x, y, i) => (N.n2(i / 9, side === L ? 1 : 5) > 0.2 || i / n > 0.85 ? -1 : ink.st(side === L ? cLight : cDark, 1.6)), { taper: 18 });
    }
    ink.flush(ctx);
  };

  function drawProps(ctx, S) {
    const ink = new LW.Ink(791);
    ink.wobble = 0.5;
    // woodpile against the cliff left of the hut: log ends with rings
    const rng = new LW.RNG('logs');
    const logs = [];
    for (let row = 0; row < 4; row++) {
      for (let k = 0; k < 4 - (row > 2 ? 1 : 0); k++) {
        logs.push([18 + k * 24 + (row % 2) * 12 + rng.next() * 3, 2690 - row * 21 - rng.next() * 2, 11 + rng.next() * 3]);
      }
    }
    for (const [x, y, r] of logs) {
      const pts = LW.blob(x, y, r, r * 0.92, x + y, 0.08, 16);
      LW.shadeFill(ctx, S, LW.polyPath(pts), LW.bbox(pts, 2), (xx, yy, o) => {
        const c = stoneFill(0.3, xx, yy, 'rock', [LW.mix(P.wood0, P.rock0, 0.4), P.wood0, P.wood1]);
        o[0] = c[0]; o[1] = c[1]; o[2] = c[2];
      });
      for (let q = 1; q <= 3; q++) {
        const ring = [];
        for (let a = 0; a <= 6.35; a += 0.35) ring.push([x + Math.cos(a) * r * q * 0.24, y + Math.sin(a) * r * q * 0.22]);
        ink.line(ring, (xx, yy) => ink.st(inkAt(ink, xx, yy), 0.9), { taper: 0 });
      }
      ink.line(pts.concat([pts[0]]), (xx, yy) => ink.st(inkAt(ink, xx, yy), yy > y ? 2.2 : 1.4), { taper: 0 });
    }
    // barrel beside the door
    {
      const bx = 228, by = 2712, bw = 50, bh = 74;
      const body = [];
      for (let i = 0; i <= 20; i++) {
        const t = i / 20;
        const bulge = Math.sin(t * Math.PI) * 5;
        body.push([bx - bw / 2 - bulge, by - bh * t]);
      }
      for (let i = 20; i >= 0; i--) {
        const t = i / 20;
        const bulge = Math.sin(t * Math.PI) * 5;
        body.push([bx + bw / 2 + bulge, by - bh * t]);
      }
      LW.shadeFill(ctx, S, LW.polyPath(body), LW.bbox(body, 2), (x, y, o) => {
        const side = (x - bx) / (bw / 2);
        const d = side > 0.35 ? 0.15 : side > -0.4 ? 0.4 : 0.75; // lit from the door on the right
        const c = stoneFill(d, x, y, 'rock', [LW.mix(P.wood0, P.rock0, 0.4), P.wood0, P.wood1, LW.mix(P.wood1, P.ink, 0.4)]);
        o[0] = c[0]; o[1] = c[1]; o[2] = c[2];
      });
      for (let k = -3; k <= 3; k++) {
        const pts = [];
        for (let i = 0; i <= 10; i++) {
          const t = i / 10;
          const bulge = Math.sin(t * Math.PI) * 5;
          pts.push([bx + (bw / 2 + bulge) * Math.sin((k / 4) * Math.PI / 2), by - bh * t]);
        }
        ink.line(pts, (x, y) => ink.st(inkAt(ink, x, y), 1.0), { taper: 0 });
      }
      for (const t of [0.18, 0.82]) {
        const bulge = Math.sin(t * Math.PI) * 5;
        const y = by - bh * t;
        ink.line([[bx - bw / 2 - bulge, y - 2], [bx, y + 2.5], [bx + bw / 2 + bulge, y - 2]], ink.st(ink.col(P.ink), 4.2), { taper: 0 });
      }
      const top = [];
      for (let a = 0; a <= 6.35; a += 0.2) top.push([bx + Math.cos(a) * bw / 2, by - bh + Math.sin(a) * 7]);
      ctx.fillStyle = LW.rgb(stoneFill(0.2, bx, by - bh, 'rock', [LW.mix(P.wood0, P.rock0, 0.5), P.wood0, P.wood1]));
      ctx.fill(LW.polyPath(top));
      ink.line(top, ink.st(ink.col(P.ink), 1.8), { taper: 0 });
      ink.line(body.concat([body[0]]), (x, y) => ink.st(inkAt(ink, x, y), x < bx ? 3.0 : 2.0), { taper: 0 });
    }
    ink.flush(ctx);
  }

  function drawSteps(ctx, S) {
    const ink = new LW.Ink(731);
    ink.wobble = 0.6;
    // landing slab at the water
    {
      const lp = LW.polyPath(LANDING);
      LW.shadeFill(ctx, S, lp, LW.bbox(LANDING, 2), (x, y, o) => {
        const top = y < 2898 + (x - 640) * 0.04;
        const c = stoneFill(top ? 0.25 : 0.6, x, y, 'rock');
        o[0] = c[0]; o[1] = c[1]; o[2] = c[2];
      });
      ink.line(LANDING.concat([LANDING[0]]), (x, y) => ink.st(inkAt(ink, x, y), 2.8), { taper: 0 });
      // slab joints
      for (const jx of [720, 810, 890]) ink.line([[jx, 2878], [jx + 6, 2920]], (x, y) => ink.st(inkAt(ink, x, y), 1.6), { taper: 0 });
      for (let y = 2904; y < 2920; y += 4) ink.line([[642, y], [976, y + 1]], (x, yy) => ink.st(inkAt(ink, x, yy), 1.0), { taper: 10 });
    }
    // steps top-down so lower steps overlap
    for (let k = 0; k < STEPS.length; k++) {
      const s = STEPS[k];
      const back = 9; // tread recedes toward the VP a little
      const tread = [[s.x, s.y], [s.x + s.w, s.y], [s.x + s.w + back, s.y - s.depth], [s.x + back, s.y - s.depth]];
      const riser = [[s.x, s.y], [s.x + s.w, s.y], [s.x + s.w, s.y + s.rise], [s.x, s.y + s.rise]];
      const side = [[s.x + s.w, s.y], [s.x + s.w + back, s.y - s.depth], [s.x + s.w + back, s.y + s.rise - s.depth + 4], [s.x + s.w, s.y + s.rise]];
      const fill = (poly, d, kind = 'rock') => LW.shadeFill(ctx, S, LW.polyPath(poly), LW.bbox(poly, 2), (x, y, o) => {
        const c = stoneFill(d, x, y, kind);
        o[0] = c[0]; o[1] = c[1]; o[2] = c[2];
      });
      fill(side, 0.8, 'hutwall');
      fill(tread, 0.12);
      fill(riser, 0.72, 'hutwall');
      // riser hatch (horizontal), tread left bare where firelit
      for (let y = s.y + 4; y < s.y + s.rise - 2; y += 4.2) {
        ink.line([[s.x + 2, y], [s.x + s.w - 2, y + 0.6]], (x, yy) => {
          const wv = LW.warm(x, yy, 'rock');
          if (wv > 0.95 && (Math.round(y) % 2)) return -1;
          return ink.st(inkAt(ink, x, yy), 1.05);
        }, { taper: 8 });
      }
      // chips / joint on the tread
      const jx = s.x + s.w * (0.35 + 0.3 * ((k * 0.37) % 1));
      ink.line([[jx, s.y], [jx + back * 0.8, s.y - s.depth]], (x, y) => ink.st(inkAt(ink, x, y), 1.3), { taper: 0 });
      ink.line([[jx, s.y], [jx, s.y + s.rise]], (x, y) => ink.st(inkAt(ink, x, y), 1.3), { taper: 0 });
      ink.line(tread.concat([tread[0]]), (x, y) => ink.st(inkAt(ink, x, y), 1.8), { taper: 0 });
      ink.line(riser.concat([riser[0]]), (x, y) => ink.st(inkAt(ink, x, y), y > s.y + s.rise - 2 ? 3.0 : 2.0), { taper: 0 });
      ink.line(side.concat([side[0]]), (x, y) => ink.st(inkAt(ink, x, y), 2.0), { taper: 0 });
      ink.flush(ctx);
    }
  }

  // ---------------------------------------------------------------- lantern post + lantern
  const POST = (LW.post = { x: 896, top: 2572, bot: 2898, w: 17 });
  LW.drawLantern = function (ctx, S) {
    const ink = new LW.Ink(741);
    ink.wobble = 0.4;
    const [lx, ly] = L.lantern;
    const p = POST;
    // post
    const post = [[p.x - p.w / 2, p.top], [p.x + p.w / 2, p.top], [p.x + p.w / 2 + 1, p.bot], [p.x - p.w / 2 - 1, p.bot]];
    LW.shadeFill(ctx, S, LW.polyPath(post), LW.bbox(post, 2), (x, y, o) => {
      const lit = x > p.x + 1; // the lantern hangs to the right
      const c = lit ? stoneFill(0.3, x, y, 'rock', [P.wood0, P.wood1, P.rock4]) : stoneFill(0.8, x, y, 'rock', [P.wood0, P.wood1, P.rock4]);
      o[0] = c[0]; o[1] = c[1]; o[2] = c[2];
    });
    for (let k = 0; k < 4; k++) {
      const x = p.x - p.w / 2 + 3 + k * 3.2;
      const pts = [];
      for (let y = p.top + 4; y < p.bot - 4; y += 8) pts.push([x + N.n2(y / 40, k) * 1.2, y]);
      ink.line(pts, (xx, yy) => ink.st(inkAt(ink, xx, yy), 1.0), { taper: 12 });
    }
    ink.line(post.concat([post[0]]), (x, y) => ink.st(inkAt(ink, x, y), x < p.x ? 3.0 : 2.2), { taper: 0 });
    // arm + brace
    const arm = [[p.x - 4, p.top + 10], [lx + 14, p.top + 6], [lx + 14, p.top + 16], [p.x + 4, p.top + 22]];
    ctx.fillStyle = LW.rgb(P.warmInk2);
    ctx.fill(LW.polyPath(arm));
    ink.line(arm.concat([arm[0]]), ink.st(ink.col(P.ink), 2.0), { taper: 0 });
    ink.line([[p.x + 4, p.top + 58], [p.x + 26, p.top + 19]], ink.st(ink.col(P.warmInk1), 4.0), { taper: 0 });
    // hook + lantern
    ink.line([[lx, p.top + 16], [lx, ly - 34]], ink.st(ink.col(P.ink), 1.8), { taper: 0 });
    const ring = [];
    for (let a = 0; a <= 6.3; a += 0.3) ring.push([lx + Math.cos(a) * 5, ly - 38 + Math.sin(a) * 5]);
    ink.line(ring, ink.st(ink.col(P.ink), 1.8), { taper: 0 });
    const cap = [[lx - 18, ly - 18], [lx - 6, ly - 33], [lx + 6, ly - 33], [lx + 18, ly - 18]];
    const glass = [[lx - 15, ly - 18], [lx + 15, ly - 18], [lx + 13, ly + 20], [lx - 13, ly + 20]];
    const foot = [[lx - 17, ly + 20], [lx + 17, ly + 20], [lx + 14, ly + 28], [lx - 14, ly + 28]];
    LW.shadeFill(ctx, S, LW.polyPath(glass), LW.bbox(glass, 2), (x, y, o) => {
      const t = Math.hypot((x - lx) / 13, (y - ly - 2) / 18) + N.n2(x / 4, y / 4) * 0.1;
      const c = t < 0.55 ? [255, 252, 235] : t < 0.9 ? P.warm6 : P.warm5;
      o[0] = c[0]; o[1] = c[1]; o[2] = c[2];
    }, [0, 0]);
    ctx.fillStyle = LW.rgb(P.ink);
    ctx.fill(LW.polyPath(cap));
    ctx.fill(LW.polyPath(foot));
    // frame bars and a flame
    ink.line(glass.concat([glass[0]]), ink.st(ink.col(P.ink), 2.6), { taper: 0 });
    ink.line([[lx, ly - 18], [lx, ly + 20]], ink.st(ink.col(P.warmInk2), 1.6), { taper: 0 });
    const flame = [[lx - 3, ly + 9], [lx - 3.5, ly + 1], [lx, ly - 8], [lx + 3.5, ly + 1], [lx + 3, ly + 9]];
    ctx.fillStyle = LW.rgb(P.warm3);
    ctx.fill(LW.polyPath(LW.chaikin(flame, 2, true)));
    ink.line(cap.concat([cap[0]]), ink.st(ink.col(P.ink), 1.6), { taper: 0 });
    // rope from the post to the boat's bow
    const bow = LW.boatGeom ? LW.boatGeom.bowRing : [1000, 2950];
    const rp = [];
    const a = [p.x + 6, p.bot - 70];
    for (let t = 0; t <= 1.0001; t += 0.04) {
      const x = a[0] + (bow[0] - a[0]) * t, y = a[1] + (bow[1] - a[1]) * t + Math.sin(t * Math.PI) * 26;
      rp.push([x, y]);
    }
    ink.line(rp, ink.st(ink.col(P.ink), 4.2), { taper: 0, wobble: 0.3 });
    // twist ticks on the rope
    const tc = ink.col(P.warm4);
    for (let i = 1; i < rp.length - 1; i++) {
      const [x0, y0] = rp[i], [x1, y1] = rp[i + 1];
      for (let s = 0; s < 1; s += 0.34) {
        const x = x0 + (x1 - x0) * s, y = y0 + (y1 - y0) * s;
        ink.line([[x - 1.6, y - 1.4], [x + 1.6, y + 1.4]], ink.st(tc, 1.0), { taper: 0, wobble: 0 });
      }
    }
    // coil of rope around the post
    for (let k = 0; k < 4; k++) {
      const y = p.bot - 82 + k * 6;
      ink.line([[p.x - p.w / 2 - 2, y], [p.x + p.w / 2 + 2, y + 3]], ink.st(ink.col(P.ink), 3.2), { taper: 0 });
    }
    ink.flush(ctx);
  };

  // ---------------------------------------------------------------- boat
  const BOAT = (LW.boatGeom = {});
  {
    // a rowboat lying alongside the landing, bow toward the post, seen slightly from above
    const bow = [1004, 2958], stern = [1392, 3036];
    const ax = stern[0] - bow[0], ay = stern[1] - bow[1];
    const Lb = Math.hypot(ax, ay);
    const ux = ax / Lb, uy = ay / Lb; // along the hull
    const vx = -uy, vy = ux; // across (toward the viewer side = +v)
    BOAT.bow = bow; BOAT.stern = stern; BOAT.u = [ux, uy]; BOAT.v = [vx, vy]; BOAT.len = Lb;
    const at = (t, s, lift = 0) => [bow[0] + ux * Lb * t + vx * s, bow[1] + uy * Lb * t + vy * s - lift];
    BOAT.at = at;
    // beam profile along the length (0 at bow point, wide amidships, transom at stern)
    BOAT.beam = (t) => (t < 0.58 ? 92 * Math.pow(Math.sin((Math.PI / 2) * (t / 0.58)), 0.7) : 92 * (1 - 0.3 * Math.pow((t - 0.58) / 0.42, 2))) + 2;
    const near = [], far = [], keel = [];
    for (let i = 0; i <= 40; i++) {
      const t = i / 40;
      const b = BOAT.beam(t);
      const sheer = 16 * Math.pow(1 - t, 3) + 8 * Math.pow(t, 4); // sheer line rises at bow and stern
      near.push(at(t, b * 0.55, sheer + 12));
      far.push(at(t, -b * 0.45, sheer + 18));
      keel.push(at(t, b * 0.3, -30 + 22 * Math.pow(Math.abs(t - 0.5) * 2, 3)));
    }
    BOAT.near = near; BOAT.far = far; BOAT.keel = keel;
    BOAT.hull = near.concat(keel.slice().reverse());
    BOAT.inside = near.concat(far.slice().reverse());
    BOAT.bowRing = at(0.02, 2, 10);
    BOAT.waterY = (x) => bow[1] + (x - bow[0]) * (ay / ax) + 18;
  }
  LW.drawBoat = function (ctx, S) {
    const ink = new LW.Ink(751);
    ink.wobble = 0.5;
    const B = BOAT;
    // reflection: dark broken hull under the boat (on the water already drawn)
    {
      const rng = new LW.RNG('boatrefl');
      const ri = ink.col(P.waterInkDeep);
      for (let k = 0; k < 18; k++) {
        const t0 = 0.05 + rng.next() * 0.15, t1 = 0.85 + rng.next() * 0.12;
        const yy = 8 + k * 4.2 + rng.next() * 2;
        const pts = [];
        for (let i = 0; i <= 12; i++) {
          const t = t0 + ((t1 - t0) * i) / 12;
          const p = B.at(t, B.beam(t) * 0.3, -yy - 20);
          pts.push([p[0] + (rng.next() - 0.5) * 3, p[1]]);
        }
        const shrink = 1 - k / 22;
        ink.line(pts.slice(Math.floor((1 - shrink) * 6), 13 - Math.floor((1 - shrink) * 4)), ink.st(ri, 2.6 - k * 0.08), { taper: 14 });
      }
      ink.flush(ctx);
    }
    // inside of the hull
    const insideP = LW.polyPath(B.inside);
    const ux = B.u[0], uy = B.u[1];
    LW.shadeFill(ctx, S, insideP, LW.bbox(B.inside, 3), (x, y, o) => {
      // across-beam coordinate: + toward the near gunwale
      const s = (x - B.bow[0]) * B.v[0] + (y - B.bow[1]) * B.v[1];
      const t = LW.clamp(((x - B.bow[0]) * ux + (y - B.bow[1]) * uy) / B.len, 0, 1);
      const sn = s / (B.beam(t) * 0.5 + 1);
      const d = sn > 0.5 ? 0.9 : sn > 0.05 ? 0.55 : 0.2;
      const c = stoneFill(d, x, y, 'boat', [LW.mix(P.rock0, P.wood0, 0.4), LW.mix(P.rock1, P.wood0, 0.6), P.wood1, LW.mix(P.wood1, P.ink, 0.5)]);
      o[0] = c[0]; o[1] = c[1]; o[2] = c[2];
    });
    // ribs (frames) curving across the inside
    for (let k = 1; k < 12; k++) {
      const t = 0.06 + k * 0.08;
      if (t > 0.97) break;
      const b = B.beam(t);
      const pts = [];
      for (let q = 0; q <= 8; q++) {
        const f = q / 8;
        const sv = -b * 0.45 + b * f;
        pts.push(B.at(t + Math.sin(f * Math.PI) * 0.01, sv, 18 - Math.sin(f * Math.PI) * 10));
      }
      ink.line(pts, (x, y) => ink.st(inkAt(ink, x, y, 'boat'), 2.0), { taper: 4 });
    }
    // floor boards inside (lines along the length)
    for (let k = 1; k < 6; k++) {
      const s = -0.4 + k * 0.15;
      const pts = [];
      for (let i = 2; i <= 38; i++) {
        const t = i / 40;
        pts.push(B.at(t, B.beam(t) * s, 16));
      }
      ink.line(pts, (x, y) => ink.st(inkAt(ink, x, y), 1.1), { taper: 10 });
    }
    // thwarts (seats)
    for (const t of [0.3, 0.58, 0.84]) {
      const b = B.beam(t);
      const a = B.at(t, b * 0.55, 22), c = B.at(t, -b * 0.45, 26);
      const a2 = B.at(t + 0.035, b * 0.55, 22), c2 = B.at(t + 0.035, -b * 0.45, 26);
      const q = [c, a, a2, c2];
      LW.shadeFill(ctx, S, LW.polyPath(q), LW.bbox(q, 2), (x, y, o) => {
        const col = stoneFill(0.25, x, y, 'rock', [P.wood0, P.wood1, P.rock4]);
        o[0] = col[0]; o[1] = col[1]; o[2] = col[2];
      });
      ink.line(q.concat([q[0]]), (x, y) => ink.st(inkAt(ink, x, y), 1.8), { taper: 0 });
    }
    // oar resting across
    {
      const o0 = B.at(0.16, -B.beam(0.16) * 0.05, 26), o1 = B.at(0.74, B.beam(0.74) * 0.12, 30);
      const ox = o1[0] - o0[0], oy = o1[1] - o0[1], ol = Math.hypot(ox, oy);
      const nx = -oy / ol, ny = ox / ol;
      const shaft = [[o0[0] + nx * 3, o0[1] + ny * 3], [o1[0] + nx * 3, o1[1] + ny * 3], [o1[0] - nx * 3, o1[1] - ny * 3], [o0[0] - nx * 3, o0[1] - ny * 3]];
      const e = [o1[0] + (ox / ol) * 90, o1[1] + (oy / ol) * 90];
      const blade = [[o1[0] + nx * 3, o1[1] + ny * 3], [e[0] + nx * 11, e[1] + ny * 11], [e[0] + (ox / ol) * 8, e[1] + (oy / ol) * 8], [e[0] - nx * 11, e[1] - ny * 11], [o1[0] - nx * 3, o1[1] - ny * 3]];
      for (const poly of [shaft, blade]) {
        ctx.fillStyle = LW.rgb(stoneFill(0.2, poly[0][0], poly[0][1], 'boat', [LW.mix(P.rock0, P.wood0, 0.3), P.wood0, P.wood1]));
        ctx.fill(LW.polyPath(poly));
        ink.line(poly.concat([poly[0]]), (x, y) => ink.st(inkAt(ink, x, y, 'boat'), 1.6), { taper: 0 });
      }
    }
    ink.flush(ctx);
    // hull outside with strakes following the form
    const hullP = LW.polyPath(B.hull);
    LW.shadeFill(ctx, S, hullP, LW.bbox(B.hull, 3), (x, y, o) => {
      const c = stoneFill(0.42, x, y, 'boat', [LW.mix(P.rock1, P.wood0, 0.5), P.wood0, P.wood1, P.rock4]);
      o[0] = c[0]; o[1] = c[1]; o[2] = c[2];
    });
    ctx.save();
    ctx.clip(hullP);
    for (let k = 1; k <= 8; k++) {
      const f = k / 9;
      const pts = B.near.map((p, i) => [p[0] + (B.keel[i][0] - p[0]) * f, p[1] + (B.keel[i][1] - p[1]) * f]);
      ink.line(pts, (x, y) => ink.st(inkAt(ink, x, y), k % 2 ? 1.0 : 1.6), { taper: 0 });
      // planking shadow hatch under each strake lap
      for (let i = 1; i < pts.length - 1; i += 1) {
        const p = pts[i];
        ink.line([[p[0], p[1] + 1], [p[0] - 1.5, p[1] + 5]], (x, y) => ink.st(inkAt(ink, x, y), 0.9), { taper: 0, wobble: 0.2 });
      }
    }
    ink.flush(ctx);
    ctx.restore();
    // gunwales, stem, transom
    // lit rail along the near gunwale
    ink.line(B.near.map((p) => [p[0], p[1] + 3]), (x, y) => ink.st(LW.warm(x, y, 'boat') > 0.2 ? ink.col(P.warm4) : ink.col(P.rock0), 3.2), { taper: 20 });
    ink.line(B.near, (x, y) => ink.st(inkAt(ink, x, y, 'boat'), 3.6), { taper: 0 });
    ink.line(B.far, (x, y) => ink.st(inkAt(ink, x, y), 2.4), { taper: 0 });
    ink.line(B.keel, ink.st(ink.col(P.ink), 3.6), { taper: 0 });
    const n = B.near.length - 1;
    ink.line([B.near[n], B.far[n]], ink.st(ink.col(P.ink), 3.0), { taper: 0 });
    ink.line([B.near[n], B.keel[n]], ink.st(ink.col(P.ink), 3.0), { taper: 0 });
    ink.line([B.near[0], B.keel[0]], ink.st(ink.col(P.ink), 3.0), { taper: 0 });
    // waterline: wet dark band + bright cyan lick
    const wl = [];
    for (let i = 0; i <= 40; i++) {
      const t = i / 40;
      wl.push(B.at(t, B.beam(t) * 0.42, -4 + 8 * Math.pow(Math.abs(t - 0.5) * 2, 3)));
    }
    ink.line(wl, ink.st(ink.col(P.water4), 3.0), { taper: 30 });
    ink.flush(ctx);
    // bow ring
    const [bx, by] = B.bowRing;
    ctx.strokeStyle = LW.rgb(P.ink);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(bx, by, 5, 0, Math.PI * 2);
    ctx.stroke();
  };
})();
