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
      // grain: pitting stipple heavier on the shadow side, a few pale flecks on the cap
      {
        const pd = new LW.Dots();
        const nd = Math.round(s.rx * s.ry * 0.16);
        const ic = ink.colors[iCol];
        const pale = LW.rgb(stoneFill(d - 0.3, s.x, s.y - s.ry * 0.4, kind));
        for (let k = 0; k < nd; k++) {
          const a = rng.next() * 6.283, rr = Math.sqrt(rng.next());
          const px = s.x + Math.cos(a) * s.rx * rr * 0.92, py = s.y + Math.sin(a) * s.ry * rr * 0.85;
          const facing = Math.cos(a) * lx + Math.sin(a) * ly;
          if (facing < -0.1 || rng.next() < 0.3) pd.dot(px, py, 0.45 + rng.next() * 0.5, ic);
          else if (rng.next() < 0.12) pd.dot(px, py, 0.5, pale);
        }
        ctx.save();
        ctx.clip(path);
        pd.flush(ctx);
        ctx.restore();
      }
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
    const wdots = new LW.Dots();
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
      // stone texture: pitting stipple, chisel flicks, an occasional spall line
      {
        const xs = out.map((p) => p[0]), ys = out.map((p) => p[1]);
        const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
        const nd = Math.round((x1 - x0) * (y1 - y0) / 26 * (0.3 + dd));
        for (let k = 0; k < nd; k++) {
          const px = x0 + rng.next() * (x1 - x0), py = y0 + rng.next() * (y1 - y0);
          if (!LW.pointInPoly(px, py, out)) continue;
          wdots.dot(px, py, 0.45 + rng.next() * 0.6, ink.colors[inkAt(ink, px, py, kind)]);
        }
        const nc = rng.int(0, 2);
        for (let k = 0; k < nc; k++) {
          const px = x0 + 4 + rng.next() * Math.max(1, x1 - x0 - 10), py = y0 + 3 + rng.next() * Math.max(1, y1 - y0 - 8);
          for (let q = 0; q < 3; q++) {
            const a = -1.0, l = 2.5 + rng.next() * 2.5;
            const qx = px + q * 2.4;
            if (LW.pointInPoly(qx, py, out)) ink.line([[qx, py], [qx + Math.cos(a) * l, py + Math.sin(a) * l]], (x, y) => ink.st(inkAt(ink, x, y, kind), 0.65), { taper: 2, wobble: 0.1 });
          }
        }
      }
      ink.line(out.concat([out[0]]), (x, y) => {
        const below = y > cy;
        return ink.st(inkAt(ink, x, y, kind), below ? 2.1 : 1.3);
      }, { taper: 0 });
    }
    // mortar grit over the whole face
    {
      const xs = q.map((p) => p[0]), ys = q.map((p) => p[1]);
      const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
      const nd = Math.round((x1 - x0) * (y1 - y0) / 70);
      for (let k = 0; k < nd; k++) {
        const px = x0 + rng.next() * (x1 - x0), py = y0 + rng.next() * (y1 - y0);
        wdots.dot(px, py, 0.4 + rng.next() * 0.5, ink.colors[inkAt(ink, px, py, kind)]);
      }
    }
    ink.flush(ctx);
    wdots.flush(ctx);
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
      const jr = new LW.RNG('step' + k);
      STEPS.push({ x: x + (jr.next() - 0.5) * 10, y, w: w + (jr.next() - 0.5) * 16, rise: 24, depth: 13, tilt: (jr.next() - 0.5) * 3, seed: k });
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
    const gDark = (x, y) => 0.5 + 0.38 * LW.smooth(2950, 3500, y) + 0.22 * LW.smooth(420, 0, x) + 0.06 * N.fbm(x / 120, y / 60, 2);
    // firelight on the beach is stepped per cobble cell, so the light breaks along stones, not a stencil edge
    const VC = 30, vx0 = gbb[0] - VC, vy0 = gbb[1] - VC;
    const vnx = Math.ceil((gbb[2] - vx0) / VC) + 2, vny = Math.ceil((gbb[3] - vy0) / VC) + 2;
    const VSX = new Float32Array(vnx * vny), VSY = new Float32Array(vnx * vny), VB = new Int8Array(vnx * vny);
    {
      const vr = new LW.RNG('beach-cells');
      for (let j = 0; j < vny; j++) for (let i = 0; i < vnx; i++) {
        const k = j * vnx + i;
        VSX[k] = vx0 + (i + 0.1 + 0.8 * vr.next()) * VC;
        VSY[k] = vy0 + (j + 0.1 + 0.8 * vr.next()) * VC * 0.8 + j * VC * 0.2;
        VB[k] = LW.warmBand(LW.warm(VSX[k], VSY[k], 'rock') * 1.06, VSX[k], VSY[k], 0);
      }
    }
    const bandAt = (x, y) => {
      const ci = Math.floor((x - vx0) / VC), cj = Math.floor((y - vy0) / VC);
      let best = -1, bd = 1e18;
      for (let j = cj - 1; j <= cj + 1; j++) {
        if (j < 0 || j >= vny) continue;
        for (let i = ci - 1; i <= ci + 1; i++) {
          if (i < 0 || i >= vnx) continue;
          const k = j * vnx + i, dx = VSX[k] - x, dy = (VSY[k] - y) * 1.5;
          const d = dx * dx + dy * dy;
          if (d < bd) { bd = d; best = k; }
        }
      }
      return best < 0 ? 0 : VB[best];
    };
    const bInk = (ink, x, y) => ink.col(LW.warmInkColor(bandAt(x, y), P.ink));
    LW.shadeFill(ctx, S, gp, gbb, (x, y, o) => {
      const sd = shoreDist(x, y);
      let c = LW.stepPick([P.rock0, P.rock1, P.rock2, P.rock3, P.rock4], LW.clamp(gDark(x, y), 0, 0.999), x, y, 0.03);
      const bb = bandAt(x, y);
      if (bb > 0) c = LW.warmFill[bb];
      if (sd < 26 + 8 * N.n2(x / 30, y / 30)) c = LW.mix(c, P.water2, 0.45); // wet sand lap
      o[0] = c[0]; o[1] = c[1]; o[2] = c[2];
    });
    {
      const ink = new LW.Ink(711);
      ink.wobble = 0.8;
      // tide lines: long, gently curving, widely spaced, following the shore
      const field = (x, y) => shoreDist(x, y) + 22 * N.fbm(x / 340, y / 220, 2);
      LW.contours({ bbox: gbb, step: 3, field, levelStep: 21 }, (pts, lev) => {
        ink.line(pts, (x, y) => {
          const wv = LW.warm(x, y, 'rock');
          const rank = lev % 3 === 0 ? 0 : 1;
          const d = gDark(x, y) + 0.1 - 0.3 * Math.min(1, wv);
          if (rank === 1 && d < 0.45) return -1;
          if (N.n2(x / 190, y / 60 + lev * 0.9) > 0.3) return -1;
          return ink.st(bInk(ink, x, y), 0.9 + d * 0.9);
        }, { taper: 24 });
      });
      // sand stipple: dot density follows value
      {
        const sr = new LW.RNG('sand');
        for (let i = 0; i < 26000; i++) {
          const x = gbb[0] + sr.next() * (gbb[2] - gbb[0]), y = gbb[1] + sr.next() * (gbb[3] - gbb[1]);
          if (!LW.pointInPoly(x, y, ground)) continue;
          const d = gDark(x, y) - 0.35 * Math.min(1, LW.warm(x, y, 'rock'));
          if (sr.next() > 0.15 + d * 0.8) continue;
          const r = 0.7 + sr.next() * 1.0;
          ink.fill([[x - r, y], [x, y - r * 0.8], [x + r, y], [x, y + r * 0.8]], LW.warmInkColor(bandAt(x, y), P.ink), 0);
        }
      }
      // a second, finer grain of sand and grit, plus pale shell/quartz flecks
      const sdots = new LW.Dots();
      {
        const sr = new LW.RNG('sand2');
        const pale = LW.rgb(LW.mix(P.rock0, P.paper, 0.25));
        for (let i = 0; i < 70000; i++) {
          const x = gbb[0] + sr.next() * (gbb[2] - gbb[0]), y = gbb[1] + sr.next() * (gbb[3] - gbb[1]);
          const u = sr.next(), r = sr.next();
          if (!LW.pointInPoly(x, y, ground)) continue;
          const wv = LW.warm(x, y, 'rock');
          const d = gDark(x, y) - 0.35 * Math.min(1, wv);
          if (u < 0.1 + d * 0.5) sdots.dot(x, y, 0.4 + r * 0.5, LW.rgb(LW.warmInkColor(bandAt(x, y), P.ink)));
          else if (u > 0.992) sdots.dot(x, y, 0.6 + r * 0.6, bandAt(x, y) >= 3 ? LW.rgb(P.warm5) : pale);
        }
      }
      ctx.save();
      ctx.clip(gp);
      ink.flush(ctx);
      sdots.flush(ctx);
      ctx.restore();
      // a loose scatter of cobbles over the beach: each takes its own firelight step,
      // so the light breaks across the stones in stepped bands
      LW.drawStonePile(ctx, S, [[40, 2935], [560, 2935], [930, 2930], [960, 2990], [880, 3080], [800, 3180], [720, 3300], [620, 3400], [300, 3330], [40, 3200]],
        { rMin: 6, rMax: 30, seed: 'beach-cobbles', dark: 0.42, persp: true, tries: 250, clip: true, kind: 'stone' });
      // grass tufts along the foot of the shelf and the back of the beach
      {
        const gr = new LW.RNG('grass');
        const gi = new LW.Ink(714);
        gi.wobble = 0.3;
        const tuft = (x, y, h) => {
          const n = 4 + gr.int(0, 6);
          const wb = LW.warmBand(LW.warm(x, y - h * 0.5, 'rock'), x, y, 0);
          const col = gi.col(wb >= 3 ? P.warmInk2 : wb >= 1 ? P.warmInk1 : P.ink);
          const hl = gi.col(wb >= 3 ? P.warm5 : wb >= 1 ? P.warm3 : LW.mix(P.teal, P.rock1, 0.5));
          for (let k = 0; k < n; k++) {
            const lean = (gr.next() - 0.5) * 1.3;
            const hh = h * (0.5 + gr.next() * 0.6);
            const bx = x + (gr.next() - 0.5) * 8;
            const pts = [];
            for (let t = 0; t <= 1.0001; t += 0.2) pts.push([bx + lean * hh * t * t, y - hh * t]);
            gi.line(pts, gi.st(k % 3 === 0 ? hl : col, 1.3), { taper: hh * 0.8, minScale: 0.12 });
          }
        };
        for (let i = 0; i < 46; i++) {
          const x = 10 + gr.next() * 620;
          tuft(x, 2904 + gr.next() * 22, 12 + gr.next() * 16);
        }
        for (let i = 0; i < 40; i++) {
          const t = gr.next();
          const x = 40 + t * 560, y = 3180 + t * 170 + (gr.next() - 0.5) * 60;
          if (!LW.pointInPoly(x, y, ground)) continue;
          tuft(x, y, 14 + gr.next() * 18);
        }
        gi.flush(ctx);
      }
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
    {
      // a fractured rock buttress under the bridge end (cellular rock, firelit)
      const sc = { name: 'SC', poly: scree, edge: scree.slice(0, 4), tier: 2, face: [0.5, 0.86], base: null, seed: 63, kind: 'rock' };
      sc.path = LW.polyPath(LW.chaikin(scree, 2, true));
      sc.poly = LW.chaikin(scree, 2, true);
      sc.bbox = LW.bbox(sc.poly, 4);
      sc.edge = sc.poly;
      LW.drawCliffLayer(ctx, S, sc);
      // a few loose stones at its foot
      LW.drawStonePile(ctx, S, [[700, 2800], [880, 2826], [860, 2862], [700, 2870]], { rMin: 9, rMax: 18, seed: 'foot', dark: 0.45, persp: true, tries: 90 });
    }
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
      // the keeper, leaning on the door frame: brimmed hat, coat, an arm up on the jamb
      const body = [[328, 2712], [330, 2690], [324, 2662], [321, 2632], [324, 2612], [330, 2604], [337, 2601], [338, 2593],
        [334, 2591], [327, 2588], [329, 2584], [340, 2582], [342, 2566], [347, 2562], [356, 2563], [358, 2581], [368, 2582], [371, 2586], [362, 2590],
        [360, 2600], [368, 2603], [373, 2597], [376, 2586], [379, 2578], [383, 2577], [383, 2592], [380, 2602], [376, 2616], [373, 2640],
        [372, 2664], [369, 2690], [367, 2712], [354, 2712], [352, 2695], [347, 2695], [345, 2712]];
      const fig = LW.chaikin(body, 1, true);
      ctx.fillStyle = LW.rgb(LW.mix(P.warmInk1, P.ink, 0.5));
      ctx.fill(LW.polyPath(fig));
      // backlit rim: a thin warm line hugging the silhouette
      const rimI = new LW.Ink(729);
      rimI.wobble = 0.15;
      rimI.line(fig.concat([fig[0]]), (x, y) => rimI.st(rimI.col(P.warm5), 1.6), { taper: 0 });
      rimI.line(fig.concat([fig[0]]), (x, y) => rimI.st(rimI.col(P.warmInk1), 0.8), { taper: 0 });
      // coat seam and sleeve fold catching a little light
      rimI.line([[350, 2606], [349, 2640], [350, 2688]], rimI.st(rimI.col(P.warmInk2), 1.2), { taper: 10 });
      rimI.line([[365, 2606], [368, 2616], [371, 2630]], rimI.st(rimI.col(P.warmInk3), 1.1), { taper: 6 });
      rimI.flush(ctx);
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
          // slate texture: cleavage speckle and a nail hole near the head
          {
            const sd = new LW.Dots();
            const nd = 10 + Math.round(tone * 20);
            for (let m = 0; m < nd; m++) {
              const pp = LW.quadPt(q, 0.05 + rng.next() * 0.9, 0.05 + rng.next() * 0.9);
              sd.dot(pp[0], pp[1], 0.45 + rng.next() * 0.55, ink.colors[inkAt(ink, pp[0], pp[1], 'hutwall')]);
            }
            const nh = LW.quadPt(q, 0.5 + (rng.next() - 0.5) * 0.2, 0.18);
            sd.dot(nh[0], nh[1], 1.3, LW.rgb(P.ink));
            if (rng.next() < 0.3) {
              const a = LW.quadPt(q, rng.next(), 0.3), b = LW.quadPt(q, rng.next(), 0.95);
              ink.line([a, [(a[0] + b[0]) / 2 + 2, (a[1] + b[1]) / 2], b], (x, y) => ink.st(inkAt(ink, x, y, 'hutwall'), 0.7), { taper: 6 });
            }
            ink.flush(ctx);
            sd.flush(ctx);
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

  // chimney smoke in white-line engraving: no fill, only fine pale strands that braid, twist and break up as the
  // plume rises and drifts left across the dark cliff, like smoke cut into the block
  LW.drawSmoke = function (ctx, S) {
    const rng = new LW.RNG('smoke4');
    const base = [487, 2126];
    const n = 220;
    const cl = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const rise = t * 820;
      cl.push([base[0] - rise * 0.1 - 230 * t * t + 70 * Math.sin(t * 8.5 - 0.6) * Math.min(1, t * 2.2), base[1] - rise + 26 * Math.sin(t * 5 + 1) * t]);
    }
    const wAt = (t) => 8 + 230 * Math.pow(t, 0.9);
    const ink = new LW.Ink(782);
    ink.wobble = 0.5;
    const pale = (a) => { const c = LW.mix(P.rock0, P.sky5, 0.25); return `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a.toFixed(2)})`; };
    const warm = (a) => { const c = P.warm3; return `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a.toFixed(2)})`; };
    const cols = [0.25, 0.4, 0.55, 0.72, 0.88].map((a) => ink.col(pale(a)));
    const wcol = [ink.col(warm(0.55)), ink.col(warm(0.8))];
    const K = 26;
    for (let k = 0; k < K; k++) {
      const off0 = (k / (K - 1) - 0.5) * 1.0 + (rng.next() - 0.5) * 0.15, ph = rng.next() * 6.28, fr = 5 + rng.next() * 5, sd = rng.next() * 40;
      const t0 = rng.next() * 0.05, t1 = 0.7 + rng.next() * 0.3;
      const pts = [], ts = [];
      for (let i = Math.floor(t0 * n); i <= Math.floor(t1 * n); i++) {
        const t = i / n, w = wAt(t);
        const a = cl[Math.min(n, i + 1)], b = cl[Math.max(0, i - 1)];
        let tx = a[0] - b[0], ty = a[1] - b[1];
        const L = Math.hypot(tx, ty) || 1; tx /= L; ty /= L;
        // strands converge at the pot, spread and twist about each other higher up
        // the ribbon twists as one (all strands share the twist), so the plume pinches and swells like real smoke
        const tw = Math.cos(1.1 + t * 7.2);
        const o = w * (off0 * (0.12 + 0.88 * Math.abs(tw) * Math.min(1, t * 3)) + 0.06 * Math.sin(ph + t * fr) * t);
        pts.push([cl[i][0] - ty * o, cl[i][1] + tx * o]);
        ts.push(t);
      }
      ink.line(pts, (x, y, i) => {
        const t = ts[i];
        // broken: the strand dissolves into dashes and gaps as it rises
        if (t > 0.2 && N.n2(i / (16 - 8 * t), sd) > 0.62 - 0.55 * t) return -1;
        if (t > 0.92) return -1;
        if (t < 0.07) return ink.st(wcol[i % 2], 1.4);
        const lv = Math.max(0, Math.min(4, Math.round(4.2 - t * 3.6 + N.n2(i / 9, sd + 3))));
        return ink.st(cols[lv], 1.1 + 1.2 * (1 - t));
      }, { taper: 20, minScale: 0.15 });
    }
    // a few curls where the draught rolls the plume over
    for (let c = 0; c < 9; c++) {
      const t = 0.25 + c * 0.075 + rng.next() * 0.04, i = Math.floor(t * n), w = wAt(t);
      const cx = cl[i][0] + (rng.next() - 0.5) * w * 0.5, cy = cl[i][1] + (rng.next() - 0.5) * w * 0.3;
      const r0 = w * (0.18 + rng.next() * 0.12), dir = c % 2 ? 1 : -1, sp = [];
      for (let a = 0; a < Math.PI * 2.4; a += 0.07) { const r = r0 * (1 - a / (Math.PI * 3)); sp.push([cx + Math.cos(a * dir + c) * r, cy + Math.sin(a * dir + c) * r * 0.7]); }
      ink.line(sp, (x, y, j) => (N.n2(j / 7, c * 9) > 0.4 ? -1 : ink.st(cols[Math.max(0, 3 - Math.round(t * 3))], 1.1)), { taper: 18, minScale: 0.1 });
    }
    // a scatter of fine pale stipple where the plume thins out at the top
    for (let k = 0; k < 900; k++) {
      const t = 0.55 + Math.pow(rng.next(), 0.7) * 0.42, i = Math.floor(t * n), w = wAt(t);
      const x = cl[i][0] + (rng.next() - 0.5) * w * 1.1, y = cl[i][1] + (rng.next() - 0.5) * w * 0.5;
      ink.line([[x, y], [x + 1.4, y + 0.3]], ink.st(cols[rng.next() < 0.5 ? 0 : 1], 1.3), { taper: 0, wobble: 0 });
    }
    ink.flush(ctx);
  };

  function drawProps(ctx, S) {
    const ink = new LW.Ink(791);
    ink.wobble = 0.5;
    // a fishing net hung to dry between two pegs on the front wall, cork floats along the head rope
    {
      const p0 = [138, 2452], p1 = [268, 2446];
      const sag = (u) => Math.sin(Math.PI * u);
      const at = (u, v) => {
        const x = p0[0] + (p1[0] - p0[0]) * u + Math.sin(v * 3 + u * 5) * 3 * v;
        const top = p0[1] + (p1[1] - p0[1]) * u + 16 * sag(u);
        const drop = 70 + 46 * sag(u) + 10 * Math.sin(u * 9);
        return [x + v * (u - 0.5) * 18, top + drop * v];
      };
      const netI = ink.col(LW.mix(P.warmInk1, P.ink, 0.3));
      const M = 14;
      for (let d = -M; d <= M; d++) {
        const a = [], b = [];
        for (let s = 0; s <= 30; s++) {
          const v = s / 30;
          const u1 = d / M + v * 0.55, u2 = d / M - v * 0.55 + 0.55;
          if (u1 >= 0 && u1 <= 1) a.push(at(u1, v));
          if (u2 >= 0 && u2 <= 1) b.push(at(u2, v));
        }
        if (a.length > 1) ink.line(a, ink.st(netI, 0.9), { taper: 4, wobble: 0.3 });
        if (b.length > 1) ink.line(b, ink.st(netI, 0.9), { taper: 4, wobble: 0.3 });
      }
      const head = [];
      for (let s = 0; s <= 30; s++) head.push(at(s / 30, 0));
      ink.line(head, ink.st(ink.col(P.ink), 2.4), { taper: 0 });
      const foot = [];
      for (let s = 0; s <= 30; s++) foot.push(at(s / 30, 1));
      ink.line(foot, ink.st(netI, 1.6), { taper: 10 });
      for (let s = 1; s < 8; s++) {
        const [fx, fy] = at(s / 8, 0);
        const fl = LW.blob(fx, fy + 1, 5, 3.6, s, 0.1, 12);
        ctx.fillStyle = LW.rgb(stoneFill(0.15, fx, fy, 'hutwall', [P.warm3, P.warm2, P.wood0]));
        ctx.fill(LW.polyPath(fl));
        ink.line(fl.concat([fl[0]]), ink.st(ink.col(P.ink), 1.2), { taper: 0 });
      }
      for (const p of [p0, p1]) {
        ctx.fillStyle = LW.rgb(P.ink);
        ctx.beginPath(); ctx.arc(p[0], p[1], 4, 0, Math.PI * 2); ctx.fill();
      }
    }
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
      // worn block: every edge resampled and nudged, front corners rounded off
      const wr = new LW.RNG('wear' + k);
      const worn = (poly, amp) => {
        const out = [];
        for (let i = 0; i < poly.length; i++) {
          const a = poly[i], b = poly[(i + 1) % poly.length];
          const L0 = Math.hypot(b[0] - a[0], b[1] - a[1]);
          const n = Math.max(2, Math.round(L0 / 7));
          for (let q = 0; q < n; q++) {
            const t = q / n;
            out.push([a[0] + (b[0] - a[0]) * t + (wr.next() - 0.5) * amp, a[1] + (b[1] - a[1]) * t + (wr.next() - 0.5) * amp + (wr.next() < 0.06 ? 2.5 : 0)]);
          }
        }
        return LW.chaikin(out, 2, true);
      };
      const tl = s.tilt;
      const tread = worn([[s.x, s.y], [s.x + s.w, s.y + tl], [s.x + s.w + back, s.y - s.depth + tl], [s.x + back, s.y - s.depth]], 1.6);
      const riser = worn([[s.x, s.y], [s.x + s.w, s.y + tl], [s.x + s.w, s.y + s.rise + tl], [s.x, s.y + s.rise]], 1.6);
      const side = worn([[s.x + s.w, s.y + tl], [s.x + s.w + back, s.y - s.depth + tl], [s.x + s.w + back, s.y + s.rise - s.depth + 4 + tl], [s.x + s.w, s.y + s.rise + tl]], 1.2);
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
      // worn nosing: a rounded highlight along the front edge, chipped in places
      {
        const rr = new LW.RNG('nose' + k);
        let xa = s.x + 4;
        while (xa < s.x + s.w - 6) {
          const xb = Math.min(s.x + s.w - 4, xa + 14 + rr.next() * 40);
          ink.line([[xa, s.y - 2.2], [xb, s.y - 2.0]], (x, y) => ink.st(ink.col(LW.warm(x, y, 'rock') > 0.45 ? P.warm6 : P.rock0), 1.6), { taper: 6 });
          xa = xb + 4 + rr.next() * 10;
          if (rr.next() < 0.45) {
            // a chip bitten out of the nosing
            const cx = xa - 2, cw = 4 + rr.next() * 6;
            const chip = [[cx - cw, s.y], [cx - cw * 0.4, s.y + 3 + rr.next() * 3], [cx + cw * 0.5, s.y + 2], [cx + cw, s.y]];
            ink.fill(chip, LW.warmInkColor(LW.warmBand(LW.warm(cx, s.y, 'rock'), cx, s.y, 0), P.ink), 0.2);
          }
        }
        // moss in the shadowed inner corner where tread meets the step above
        const nm = rr.next() < 0.5 ? 0 : rr.int(1, 4);
        const mx0 = s.x + 6 + rr.next() * (s.w - 30);
        for (let m = 0; m < nm; m++) {
          const mx = mx0 + rr.next() * 18, my = s.y - s.depth + 3 + rr.next() * 6;
          const tuft = LW.blob(mx, my, 5 + rr.next() * 5, 3 + rr.next() * 2, mx, 0.35, 10);
          ink.fill(tuft, m % 2 ? P.teal : P.tealDark, 0.3);
          ink.line(tuft.slice(0, 6), ink.st(ink.col(P.ink), 0.9), { taper: 3 });
        }
      }
      ink.line(LW.chaikin(tread, 1, true).concat([tread[0]]), (x, y) => ink.st(inkAt(ink, x, y), 1.8), { taper: 0 });
      ink.line(riser.concat([riser[0]]), (x, y) => ink.st(inkAt(ink, x, y), y > s.y + s.rise - 4 ? 3.0 : 2.0), { taper: 0 });
      ink.line(side.concat([side[0]]), (x, y) => ink.st(inkAt(ink, x, y), 2.0), { taper: 0 });
      // a crack and pitting on the riser face
      if (wr.next() < 0.6) {
        let cx = s.x + 20 + wr.next() * (s.w - 40), cy = s.y + 2;
        const cp = [[cx, cy]];
        while (cy < s.y + s.rise - 2) { cy += 3 + wr.next() * 3; cx += (wr.next() - 0.5) * 5; cp.push([cx, cy]); }
        ink.line(cp, (x, y) => ink.st(inkAt(ink, x, y), 1.4), { taper: 6 });
      }
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
    // a short chain and a small brass bell hanging under the lantern
    {
      const cx = lx, top = ly + 28;
      for (let k = 0; k < 4; k++) {
        const yy = top + 3 + k * 5.5;
        const link = [];
        for (let a = 0; a <= 6.35; a += 0.4) link.push([cx + Math.cos(a) * (k % 2 ? 1.6 : 2.8), yy + Math.sin(a) * 3.4]);
        ink.line(link, ink.st(ink.col(P.ink), 1.3), { taper: 0, wobble: 0 });
      }
      const by = top + 26;
      const bell = [[cx - 5, by], [cx + 5, by], [cx + 8, by + 12], [cx + 12, by + 19], [cx - 12, by + 19], [cx - 8, by + 12]];
      const bs = LW.chaikin(bell, 2, true);
      LW.shadeFill(ctx, S, LW.polyPath(bs), LW.bbox(bs, 2), (x, y, o) => {
        const c = x > cx + 3 ? P.warm6 : y < by + 9 ? P.warm4 : P.warm2;
        o[0] = c[0]; o[1] = c[1]; o[2] = c[2];
      });
      const bi = new LW.Ink(742);
      bi.wobble = 0.15;
      bi.line(bs.concat([bs[0]]), bi.st(bi.col(P.warmInk2), 1.6), { taper: 0 });
      bi.line([[cx - 11, by + 16], [cx + 11, by + 16]], bi.st(bi.col(P.warmInk2), 1.0), { taper: 3 });
      ctx.fillStyle = LW.rgb(P.warmInk2);
      ctx.beginPath(); ctx.arc(cx, by + 21.5, 2.4, 0, Math.PI * 2); ctx.fill();
      // moths circling the light, with dotted flight loops
      const mr = new LW.RNG('moths');
      for (let m = 0; m < 7; m++) {
        const a = mr.next() * Math.PI * 2, r = 46 + mr.next() * 80;
        const mx = lx + Math.cos(a) * r, my = ly + Math.sin(a) * r * 1.05;
        const rot = mr.next() * Math.PI * 2, sz = 5 + mr.next() * 4;
        const tr = (u, v) => [mx + Math.cos(rot) * u - Math.sin(rot) * v, my + Math.sin(rot) * u + Math.cos(rot) * v];
        const wing1 = [tr(0, 0), tr(-sz * 1.3, -sz * 0.9), tr(-sz * 1.1, sz * 0.4)];
        const wing2 = [tr(0, 0), tr(sz * 1.3, -sz * 0.9), tr(sz * 1.1, sz * 0.4)];
        for (const wg of [wing1, wing2]) {
          ctx.fillStyle = LW.rgb(P.warmInk1);
          ctx.fill(LW.polyPath(LW.chaikin(wg, 1, true)));
          bi.line([wg[1], wg[2]], bi.st(bi.col(P.warm5), 1.0), { taper: 0, wobble: 0 });
        }
        bi.line([tr(0, -sz * 0.4), tr(0, sz * 0.7)], bi.st(bi.col(P.ink), 1.6), { taper: 0, wobble: 0 });
        if (m % 3 === 0) {
          const loop = [];
          for (let q = 0; q < 26; q++) {
            const aa = a + 0.5 + q * 0.14, rr = r - 8 + Math.sin(q * 0.6) * 10;
            if (q % 2) continue;
            const px = lx + Math.cos(aa) * rr, py = ly + Math.sin(aa) * rr * 1.05;
            loop.push([px, py]);
          }
          for (const pt of loop) { ctx.fillStyle = LW.rgb(P.warm5, 0.85); ctx.beginPath(); ctx.arc(pt[0], pt[1], 1.1, 0, Math.PI * 2); ctx.fill(); }
        }
      }
      bi.flush(ctx);
    }
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
    const near = [], far = [], keel = [], wline = [];
    for (let i = 0; i <= 40; i++) {
      const t = i / 40;
      const b = BOAT.beam(t);
      const sheer = 24 * Math.pow(1 - t, 2.5) + 9 * Math.pow(t, 4); // sheer line sweeps up to the stem, a little at the transom
      near.push(at(t, b * 0.55, sheer + 12));
      far.push(at(t, -b * 0.45, sheer + 18));
      // a rockered keel: deep amidships, rising hard to the stem, so the planking curves
      keel.push(at(t, b * 0.3, -74 + 64 * Math.pow(Math.abs(t - 0.45) / 0.55, 2)));
      wline.push(at(t, b * 0.5, -24 + 12 * Math.pow(Math.abs(t - 0.5) * 2, 3)));
    }
    BOAT.near = near; BOAT.far = far; BOAT.keel = keel; BOAT.wline = wline;
    // only the planking above the water is seen
    BOAT.hull = near.concat(wline.slice().reverse());
    BOAT.inside = near.concat(far.slice().reverse());
    BOAT.bowRing = at(0.02, 2, 10);
    BOAT.waterY = (x) => bow[1] + (x - bow[0]) * (ay / ax) + 18;
  }
  LW.drawBoat = function (ctx, S) {
    const ink = new LW.Ink(751);
    ink.wobble = 0.5;
    const B = BOAT;
    // reflection: the hull mirrored under the waterline, broken into horizontal dashes; the firelit
    // gunwale shows as a row of orange dashes at the bottom of it, the cyan lick at the top
    {
      const rng = new LW.RNG('boatrefl');
      const rh = ink.col(LW.mix(P.wood1, P.waterInkDeep, 0.45)), rh2 = ink.col(LW.mix(P.wood1, P.ink, 0.5)), rw = ink.col(P.warm3), rw2 = ink.col(P.warm4);
      const sp = 3.4;
      for (let k = 0; k < 15; k++) {
        const pts = [];
        for (let i = 0; i <= 40; i++) {
          const t = i / 40;
          // height of the hull side above water at t, mirrored below the waterline
          const h = B.near[i][1] - B.wline[i][1]; // negative: gunwale above
          const depth = k * sp;
          if (depth > -h + 2) continue;
          const w = B.wline[i];
          pts.push([w[0] + (rng.next() - 0.5) * 2.5, w[1] + depth + 4 + Math.sin(t * 9 + k) * 0.8]);
        }
        if (pts.length < 3) continue;
        const last = k >= 9;
        ink.line(pts, (x, y, i) => {
          if (N.n2(i / 2.2 + k * 3.7, k * 1.9) > (last ? 0.15 : 0.32)) return -1;
          if (last && LW.warm(x, y - 2 * (y - B.waterY(x)), 'boat') > 0.25) return ink.st(k % 2 ? rw : rw2, 2.4);
          return ink.st(k % 3 === 0 ? rh2 : rh, 3.2 - k * 0.08);
        }, { taper: 8, minScale: 0.3 });
      }
      ink.flush(ctx);
    }
    // wake: broken current lines peeling off the hull, the river running past toward us
    {
      const wr = new LW.RNG('wake');
      const cW = [ink.col(P.waterInk), ink.col(P.water5), ink.col(LW.mix(P.waterInk, P.water2, 0.4))];
      for (let k = 1; k <= 7; k++) {
        const pts = [];
        for (let i = 0; i <= 30; i++) {
          const t = 0.04 + i / 30 * 0.98;
          const p = B.at(t, B.beam(t) * 0.5 + k * 9 + t * k * 6 + 22, -24 - k * 2.5);
          pts.push([p[0] + k * 5 * t, p[1] + Math.sin(i * 0.7 + k) * 1.5]);
        }
        ink.line(pts, (x, y, i) => {
          if (N.n2(i / 4 + k * 3.1, k) > 0.25) return -1;
          return ink.st(k % 3 === 2 ? cW[1] : k > 4 ? cW[2] : cW[0], 2.2 - k * 0.18);
        }, { taper: 14 });
      }
      // ripple rings where the bow and stern touch the water
      for (const [t, rr] of [[0.03, 26], [0.97, 34]]) {
        const p = B.at(t, B.beam(t) * 0.5, -24);
        for (let k = 1; k <= 3; k++) {
          const ring = [];
          for (let a = -0.2; a <= Math.PI + 0.2; a += 0.06) ring.push([p[0] + Math.cos(a) * rr * k * 0.6, p[1] + Math.sin(a) * rr * k * 0.16]);
          ink.line(ring, (x, y, i) => (N.n2(i / 5, k + t * 9) > 0.3 ? -1 : ink.st(cW[0], 1.6)), { taper: 10 });
        }
      }
      void wr;
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
        pts.push(B.at(t + Math.sin(f * Math.PI) * 0.018, sv, 18 - Math.sin(f * Math.PI) * 14));
      }
      ink.line(pts, (x, y) => ink.st(inkAt(ink, x, y, 'boat'), 1.5), { taper: 6 });
      ink.line(pts.map((p) => [p[0] + 2.2, p[1] + 0.6]), (x, y, i) => (i < 1 || i > 6 ? -1 : ink.st(inkAt(ink, x, y, 'boat'), 0.7)), { taper: 4 });
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
      // grain on the floor boards
      const g2 = [];
      for (let i = 3; i <= 37; i++) {
        const t = i / 40;
        g2.push(B.at(t, B.beam(t) * (s + 0.07) + 0.8 * N.n2(i / 3, k), 16));
      }
      ink.line(g2, (x, y, i) => (N2.n2(i / 3 + k * 4, 3.3) > 0.25 ? -1 : ink.st(inkAt(ink, x, y, 'boat'), 0.6)), { taper: 6, wobble: 0.2 });
    }
    // thwarts (seats)
    for (const t of [0.3, 0.58, 0.84]) {
      const b = B.beam(t);
      const a = B.at(t, b * 0.55, 22), c = B.at(t, -b * 0.45, 26);
      const a2 = B.at(t + 0.035, b * 0.55, 22), c2 = B.at(t + 0.035, -b * 0.45, 26);
      const q = [c, a, a2, c2];
      // the seat's shadow on the floor boards
      const sh = q.map((p) => [p[0] + 3, p[1] + 9]);
      ctx.fillStyle = LW.rgb(LW.mix(P.wood1, P.ink, 0.55));
      ctx.fill(LW.polyPath(sh));
      LW.shadeFill(ctx, S, LW.polyPath(q), LW.bbox(q, 2), (x, y, o) => {
        const col = stoneFill(0.45, x, y, 'boat', [P.wood0, P.wood1, LW.mix(P.wood1, P.ink, 0.4)]);
        o[0] = col[0]; o[1] = col[1]; o[2] = col[2];
      });
      for (const g of [0.3, 0.55, 0.78]) {
        const g0 = [a[0] + (a2[0] - a[0]) * g, a[1] + (a2[1] - a[1]) * g], g1 = [c[0] + (c2[0] - c[0]) * g, c[1] + (c2[1] - c[1]) * g];
        ink.line([g0, [(g0[0] + g1[0]) / 2, (g0[1] + g1[1]) / 2 + 0.8], g1], (x, y, i) => ink.st(inkAt(ink, x, y, 'boat'), 0.6), { taper: 6, wobble: 0.3 });
      }
      ink.line(q.concat([q[0]]), (x, y) => ink.st(inkAt(ink, x, y), 1.6), { taper: 0 });
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
      // the hull rounds under toward the keel: darker the lower it is on the side
      const t = LW.clamp(((x - B.bow[0]) * ux + (y - B.bow[1]) * uy) / B.len, 0, 1);
      const i = Math.round(t * 40);
      const top = B.near[i][1], bot = B.keel[i][1];
      const q = LW.clamp((y - top) / (bot - top || 1), 0, 1);
      const c = stoneFill(0.3 + 0.75 * q, x, y, 'boat', [LW.mix(P.rock1, P.wood0, 0.5), P.wood0, P.wood1, P.rock4, LW.mix(P.rock4, P.ink, 0.5)]);
      o[0] = c[0]; o[1] = c[1]; o[2] = c[2];
    });
    ctx.save();
    ctx.clip(hullP);
    for (let k = 1; k <= 8; k++) {
      const f = k / 9;
      const pts = B.near.map((p, i) => [p[0] + (B.keel[i][0] - p[0]) * f, p[1] + (B.keel[i][1] - p[1]) * f]);
      ink.line(pts, (x, y) => ink.st(inkAt(ink, x, y), 1.7), { taper: 0 });
      // clinker lap: the lower edge of the plank above catches the light
      ink.line(pts.map((p) => [p[0], p[1] - 2.2]), (x, y, i) => (N.n2(i / 4, k * 2.3) > 0.35 ? -1 : ink.st(LW.warm(x, y, 'boat') > 0.2 ? ink.col(P.warm4) : ink.col(LW.mix(P.rock0, P.wood0, 0.3)), 1.0)), { taper: 10 });
      // wood grain within the strake: fine wavering lines with the odd knot
      for (let gl = 1; gl <= 2; gl++) {
        const f2 = f - (gl / 3) / 9;
        const gp2 = B.near.map((p, i) => [p[0] + (B.keel[i][0] - p[0]) * f2, p[1] + (B.keel[i][1] - p[1]) * f2 + 0.7 * N.n2(i / 3, k * 5 + gl)]);
        ink.line(gp2, (x, y, i) => (N2.n2(i / 4 + k * 3, gl * 7) > 0.3 ? -1 : ink.st(inkAt(ink, x, y), 0.6)), { taper: 6, wobble: 0.2 });
      }
      if (k % 3 === 1) {
        const i = Math.floor(pts.length * (0.25 + 0.5 * ((k * 0.37) % 1)));
        const p = pts[Math.min(pts.length - 1, i)];
        const knot = [];
        for (let a = 0; a <= 6.4; a += 0.5) knot.push([p[0] + Math.cos(a) * 3.5, p[1] + 4 + Math.sin(a) * 1.6]);
        ink.line(knot, (x, y) => ink.st(inkAt(ink, x, y), 0.8), { taper: 0, wobble: 0.1 });
      }
      // planking shadow hatch under each strake lap
      for (let i = 1; i < pts.length - 1; i += 1) {
        const p = pts[i];
        ink.line([[p[0], p[1] + 1], [p[0] - 1.2, p[1] + 4]], (x, y) => ink.st(inkAt(ink, x, y), 0.7), { taper: 0, wobble: 0.2 });
      }
    }
    ink.flush(ctx);
    ctx.restore();
    // gunwales, stem, transom
    // lit rail along the near gunwale
    ink.line(B.near.map((p) => [p[0], p[1] + 3]), (x, y) => ink.st(LW.warm(x, y, 'boat') > 0.2 ? ink.col(P.warm4) : ink.col(P.rock0), 3.2), { taper: 20 });
    ink.line(B.near, (x, y) => ink.st(inkAt(ink, x, y, 'boat'), 3.6), { taper: 0 });
    ink.line(B.far, (x, y) => ink.st(inkAt(ink, x, y), 2.4), { taper: 0 });
    const n = B.near.length - 1;
    ink.line([B.near[n], B.far[n]], ink.st(ink.col(P.ink), 3.0), { taper: 0 });
    ink.line([B.near[n], B.wline[n]], ink.st(ink.col(P.ink), 3.0), { taper: 0 });
    ink.line([B.near[0], B.wline[0]], ink.st(ink.col(P.ink), 3.0), { taper: 0 });
    // waterline: dark wet line + broken bright lick
    ink.line(B.wline, ink.st(ink.col(P.ink), 2.6), { taper: 10 });
    ink.line(B.wline.map((p) => [p[0], p[1] + 3]), (x, y, i) => (N2.n2(i / 3, 5.5) > 0.3 ? -1 : ink.st(ink.col(P.water4), 2.4)), { taper: 20 });
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
