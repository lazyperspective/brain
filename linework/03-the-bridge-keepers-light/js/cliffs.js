/* cliffs.js: gorge walls from the far bend to the near framing cliffs.
   Each wall = flat stepped fill + evenly-spaced streamline hatching that flows
   down the rock and merges in Y-junctions + crack cross-strokes + black crevices. */
(function () {
  'use strict';
  const LW = window.LW;
  const P = LW.P;

  function edgeFrom(ctrl, seed, amp, freq, fine = 4) {
    const n = new LW.Noise(seed);
    let pts = LW.spline(ctrl, 14);
    pts = LW.resample(pts, 5);
    pts = LW.roughen(pts, n, amp, freq, 5, seed * 0.01);
    if (fine) pts = LW.roughen(pts, new LW.Noise(seed + 1), fine, 1 / 14, 3, 1.3);
    return pts;
  }

  // ---------------------------------------------------------------- layer specs
  function buildLayers() {
    const layers = [];
    // far wall at the bend
    {
      const edge = edgeFrom([[1060, 1930], [1110, 1880], [1170, 1862], [1230, 1878], [1300, 1930]], 41, 8, 1 / 60, 2);
      const poly = edge.concat([[1300, 2088], [1060, 2088]]);
      layers.push({ name: 'F', poly, edge, tier: 0, face: [0.1, 0.99], base: [[1060, 2087], [1300, 2087]], seed: 41 });
    }
    {
      const edge = edgeFrom([[880, 1540], [960, 1600], [1030, 1690], [1085, 1800], [1125, 1930], [1148, 2040], [1160, 2083]], 42, 16, 1 / 70, 3);
      const base = [[1160, 2083], [1110, 2092], [1020, 2100], [900, 2104]];
      const poly = edge.concat(base.slice(1), [[860, 2104], [860, 1540]]);
      layers.push({ name: 'L2', poly, edge, tier: 0, face: [0.62, 0.78], base, seed: 42 });
    }
    {
      const edge = edgeFrom([[1430, 1530], [1350, 1620], [1285, 1740], [1235, 1860], [1205, 1980], [1192, 2060], [1190, 2084]], 43, 16, 1 / 70, 3);
      const base = [[1190, 2084], [1250, 2092], [1350, 2100], [1450, 2106]];
      const poly = edge.concat(base.slice(1), [[1460, 2106], [1460, 1530]]);
      layers.push({ name: 'R2', poly, edge, tier: 0, face: [-0.6, 0.8], base, seed: 43 });
    }
    {
      const edge = edgeFrom([[760, 1210], [850, 1270], [925, 1370], [985, 1500], [1025, 1630], [1055, 1760], [1078, 1880], [1095, 1990], [1100, 2075], [1092, 2102]], 44, 24, 1 / 80, 4);
      const base = [[1092, 2102], [1040, 2128], [960, 2152], [880, 2172], [800, 2186]];
      const poly = edge.concat(base.slice(1), [[640, 2186], [640, 1210]]);
      layers.push({ name: 'L1', poly, edge, tier: 1, face: [0.6, 0.8], base, seed: 44 });
    }
    {
      const edge = edgeFrom([[1520, 1150], [1440, 1260], [1375, 1400], [1322, 1550], [1285, 1700], [1258, 1840], [1240, 1960], [1232, 2050], [1240, 2098]], 45, 24, 1 / 80, 4);
      const base = [[1240, 2098], [1300, 2116], [1390, 2140], [1480, 2162], [1560, 2172]];
      const poly = edge.concat(base.slice(1), [[1720, 2172], [1720, 1150]]);
      layers.push({ name: 'R1', poly, edge, tier: 1, face: [-0.62, 0.78], base, seed: 45 });
    }
    // near left cliff (moonlit face, warm at the foot)
    {
      const edge = edgeFrom([
        [705, -30], [668, 140], [716, 330], [688, 520], [748, 700], [726, 880], [790, 1060], [772, 1230],
        [828, 1400], [806, 1560], [866, 1700], [884, 1810], [862, 1868],
      ], 46, 34, 1 / 110, 6);
      // under the ledge the cliff steps back to where the bridge is keyed in
      const under = edgeFrom([[862, 1868], [790, 1898], [720, 1930], [690, 2020], [676, 2130], [664, 2230], [650, 2262]], 47, 10, 1 / 50, 3);
      const shore = edgeFrom([[650, 2262], [700, 2290], [770, 2330], [776, 2420], [752, 2520], [770, 2620], [820, 2730], [905, 2840], [960, 2905], [930, 2990], [860, 3080], [780, 3180], [700, 3320]], 48, 8, 1 / 60, 3);
      const poly = edge.concat(under.slice(1), shore.slice(1), [[600, 3500], [-40, 3500], [-40, -30]]);
      layers.push({ name: 'L0', poly, edge: edge.concat(under.slice(1)), shore, tier: 2, face: [0.58, 0.81], base: null, seed: 46, kind: 'rock' });
    }
    // near right cliff (shadow side, black rim against the sky)
    {
      const edge = edgeFrom([
        [1565, -30], [1612, 150], [1548, 330], [1588, 520], [1506, 700], [1560, 880], [1496, 1060], [1534, 1240],
        [1466, 1400], [1506, 1560], [1566, 1700], [1610, 1820], [1648, 1930], [1664, 2050], [1668, 2180], [1660, 2262],
      ], 49, 34, 1 / 110, 6);
      const base = edgeFrom([[1660, 2262], [1760, 2330], [1880, 2430], [2010, 2560], [2120, 2690], [2200, 2760]], 50, 10, 1 / 60, 3);
      const poly = edge.concat(base.slice(1), [[2200, -30]]);
      layers.push({ name: 'R0', poly, edge, tier: 2, face: [-0.62, 0.78], base, seed: 49, kind: 'rightcliff' });
    }
    for (const l of layers) {
      l.path = LW.polyPath(l.poly);
      l.bbox = LW.bbox(l.poly, 4);
      l.bbox[0] = Math.max(l.bbox[0], -10); l.bbox[1] = Math.max(l.bbox[1], -10);
      l.bbox[2] = Math.min(l.bbox[2], LW.W + 10); l.bbox[3] = Math.min(l.bbox[3], LW.H + 10);
    }
    return layers;
  }
  LW.cliffLayers = buildLayers();
  LW.cliff = (name) => LW.cliffLayers.find((l) => l.name === name);

  // ---------------------------------------------------------------- tier parameters
  const TIER = [
    { dsep: [11, 30], w: [0.9, 1.5], ink: P.inkFar2, pal: [P.far0, P.far1, P.far2], pocket: 1.0, crack: 0, outline: 2.4, rim: 0.9 },
    { dsep: [8, 24], w: [1.1, 2.0], ink: P.inkFar, pal: [P.far1, P.far2, P.far3, LW.mix(P.far3, P.ink, 0.35)], pocket: 0.98, crack: 0.6, outline: 3.4, rim: 1 },
    { dsep: [5.5, 22], w: [1.3, 2.9], ink: P.ink, pal: [P.rock0, P.rock1, P.rock2, P.rock3, P.rock4], pocket: 1.0, crack: 1, outline: 5.5, rim: 1 },
  ];

  // ---------------------------------------------------------------- per-layer fields
  function layerFields(l) {
    const n = new LW.Noise(l.seed * 13 + 5);
    const n2 = new LW.Noise(l.seed * 17 + 9);
    const T = TIER[l.tier];
    const mask = new LW.Mask(l.bbox, 4, (cx) => cx.fill(l.path));
    mask.edt();
    const scale = l.tier === 2 ? 1 : l.tier === 1 ? 0.7 : 0.5;
    // big form: vertical buttresses / columns (drives value); medium lumps drive line meander
    const formBig = (x, y) => {
      const wx = x + 160 * n.fbm(x / 700, y / 700, 2) * scale;
      return n.fbm(wx / (400 * scale), y / (980 * scale), 3);
    };
    const form = (x, y) => formBig(x, y) + 0.3 * n2.fbm(x / (130 * scale), y / (240 * scale), 3);
    const res = 6;
    const F = new LW.Grid(l.bbox, res, form);
    const FB = new LW.Grid(l.bbox, res, formBig);
    const baseY = l.base ? (x) => LW.yAt(l.base, x) : () => 1e9;
    // recess field: long vertical clefts between buttresses (shadowed), plus strata ledges
    const ledges = l.name === 'L0' ? [[700, -0.12], [1340, 0.1]] : l.name === 'R0' ? [[560, 0.16], [1250, -0.12]] : [];
    const ledgeY = (ly, sl, x) => ly + sl * (x - 900) + 70 * n.fbm(x / 300, ly, 3);
    const ledgeGate = (ly, x) => LW.smooth(-0.15, 0.25, n2.fbm(x / 340, ly * 0.01, 2));
    const cleftAt = (x, y) => {
      const wx = x + 90 * n.fbm(x / 400, y / 400, 2) * scale;
      return LW.smooth(0.12, 0.45, n2.fbm(wx / (210 * scale), y / (1400 * scale) + 3.3, 2));
    };
    const dark = new LW.Grid(l.bbox, res, (x, y) => {
      const e = 6;
      const gx = (FB.at(x + e, y) - FB.at(x - e, y)) / (2 * e);
      const gy = (FB.at(x, y + e) - FB.at(x, y - e)) / (2 * e);
      const k = 55 * scale;
      const nx = l.face[0] - gx * k, ny = -gy * k * 0.5, nz = l.face[1];
      const lit = LW.lambert(nx, ny, nz);
      let d = 0.12 + (1 - lit) * 0.62;
      // clefts
      const wx = x + 90 * n.fbm(x / 400, y / 400, 2) * scale;
      const cl = n2.fbm(wx / (210 * scale), y / (1400 * scale) + 3.3, 2);
      d += 0.3 * LW.smooth(0.12, 0.45, cl) * (l.tier === 0 ? 0.5 : 1);
      // ledges: a lit lip then a shadow band under it
      for (const [ly, sl] of ledges) {
        const yy = ledgeY(ly, sl, x);
        const gate = ledgeGate(ly, x);
        if (gate <= 0) continue;
        const t = y - yy;
        const len = 70 + 90 * (0.5 + 0.5 * n.n2(x / 180, ly));
        if (t > -12 && t < 0) d -= 0.22 * gate;
        else if (t >= 0 && t < len) d += 0.32 * gate * Math.pow(1 - t / len, 1.6);
      }
      // gorge depth: lower = darker; far tiers lighter overall
      if (l.tier === 2) d += 0.2 * LW.smooth(900, 2600, y);
      if (l.tier === 1) d += 0.14 * LW.smooth(1500, 2150, y);
      if (l.tier === 0) d -= 0.08;
      d += 0.05 * n2.fbm(x / 160, y / 240, 2);
      // black rim band along the right cliff's sky edge (its turned face)
      if (l.name === 'R0') {
        const ed = mask.edtAt(x, y);
        const band = 14 + 34 * Math.max(0, 0.5 + 0.7 * n.fbm(y / 300, 1.5, 3));
        if (ed < band && y < 2240) d = 1.05;
        else if (ed < band * 2.2) d = Math.max(d, 0.85);
      }
      if (l.name === 'L0') {
        const ed = mask.edtAt(x, y);
        const band = 4 + 16 * Math.max(0, n.fbm(y / 220, 4.5, 3) + 0.15);
        if (ed < band && y < 1880) d = 1.02;
      }
      // the right wall's cast shadow falls diagonally across the lower left wall
      if (l.name === 'L0') {
        const sx = (x - 860) / 600, sy = (y - 1500) / 780;
        d += 0.42 * (1 - Math.exp(-(sx * sx + sy * sy))) * LW.smooth(2000, 1250, y);
        const ys = 1880 - 0.6 * x + 70 * n.fbm(x / 240, 7.7, 3) + 25 * n2.n2(x / 60, 2.2);
        const t = y - ys;
        if (t > 0) d += 0.3 * LW.smooth(0, 26, t);
        else d -= 0.06;
      }
      // print-like falloff into the top corners
      if (l.tier === 2) d += 0.26 * LW.smooth(900, 0, y) + 0.12 * LW.smooth(300, 0, Math.min(x, LW.W - x));
      // under-ledge shadow
      if (l.name === 'L0' && y > 1860 && y < 2010 && x > 600) d += 0.3 * LW.smooth(2000, 1878, y);
      if (l.name === 'SC') d += 0.28;
      // grade the left wall darker toward the frame edges so the brightest rock sits by the bridge and hut
      if (l.name === 'L0') d += 0.22 * LW.smooth(1500, 150, y) + 0.2 * LW.smooth(520, 0, x);
      // the waterline is darker (wet rock)
      const by = baseY(x);
      if (y < by) d += 0.12 * LW.smooth(by - 70, by - 8, y);
      return LW.clamp(d, 0, 1.1);
    });
    // flow direction: down the face, hugging the silhouette, meandering
    const dirG = { vx: new LW.Grid(l.bbox, res), vy: new LW.Grid(l.bbox, res) };
    const tilt = l.face[0] > 0 ? 0.18 : -0.18;
    for (let j = 0; j < dirG.vx.h; j++) {
      for (let i = 0; i < dirG.vx.w; i++) {
        const x = l.bbox[0] + i * res, y = l.bbox[1] + j * res;
        const e = mask.edtAt(x, y);
        const gx = mask.edtAt(x + 8, y) - mask.edtAt(x - 8, y);
        const gy = mask.edtAt(x, y + 8) - mask.edtAt(x, y - 8);
        let tx = gy, ty = -gx;
        const tl = Math.hypot(tx, ty);
        if (tl > 1e-6) { tx /= tl; ty /= tl; } else { tx = 0; ty = 1; }
        if (ty < 0) { tx = -tx; ty = -ty; }
        const we = Math.exp(-e / (170 * scale + 40));
        let a = tilt + 0.55 * n.fbm(x / 520, y / 900, 2);
        let bx = Math.sin(a), byy = Math.cos(a);
        let vx = bx * (1 - we) + tx * we, vy = byy * (1 - we) + ty * we;
        // meander: rotate by a smooth noise angle; wider swings on the form slopes
        const fx = (F.at(x + 6, y) - F.at(x - 6, y)) / 12;
        const r = 0.6 * n2.fbm(x / (260 * scale + 40), y / (420 * scale + 60), 2) + fx * 55 * scale;
        const c = Math.cos(r), s = Math.sin(r);
        const rx = vx * c - vy * s, ry = vx * s + vy * c;
        const L = Math.hypot(rx, ry) || 1;
        dirG.vx.v[j * dirG.vx.w + i] = rx / L;
        dirG.vy.v[j * dirG.vx.w + i] = ry / L;
      }
    }
    const dir = (x, y) => {
      const vx = dirG.vx.at(x, y), vy = dirG.vy.at(x, y);
      const L = Math.hypot(vx, vy);
      if (L < 1e-4) return null;
      return [vx / L, vy / L];
    };
    return { mask, dark, dir, F, n, n2, T, baseY, ledges, ledgeY, ledgeGate, cleftAt, scale };
  }

  // ---------------------------------------------------------------- cellular rock wall (mid + near tiers)
  function drawCellCliff(ctx, S, l, f, kind, pal, T, rimCol) {
    const near = l.tier === 2;
    const sc = near ? 1 : 0.62;
    const rim = l.base ? (x, y) => {
      const rimD = f.baseY(x) - y;
      if (rimD > 34 * T.rim || rimD < -2) return 0;
      return LW.smooth(34, 4, rimD + LW.lnoise.n2(x / 9, y / 9) * 7);
    } : null;
    const tilt = l.face[0] > 0 ? 0.15 : -0.15;
    LW.cellRock(ctx, S, {
      path: l.path, bbox: l.bbox, mask: f.mask, seed: l.name,
      dark: (x, y) => f.dark.at(x, y),
      size: (x, y) => {
        const cl = f.cleftAt(x, y);
        let s = (112 - 76 * cl) * (0.75 + 0.5 * (0.5 + 0.5 * f.n.n2(x / 260, y / 260)));
        // smaller, busier cells along the silhouette and at the foot
        s *= 0.7 + 0.3 * LW.smooth(0, 90, f.mask.edtAt(x, y));
        return s * sc;
      },
      maxSize: 140 * sc,
      aniso: near ? 1.45 : 1.6,
      kind, pal,
      ink: T.ink,
      lineW: near ? [1.15, 2.7] : [0.95, 1.8],
      step: near ? 5.6 : 6.4,
      lumpRatio: l.name === 'R0' ? 0.55 : 0.74,
      light: [0.62, -0.78],
      flow: () => Math.PI / 2 + tilt,
      wedgeW: near ? 12 : 7,
      black: near ? P.ink : LW.mix(P.inkFar, P.ink, 0.6),
      rim, rimCol,
    });
    const ink = new LW.Ink(l.seed + 900);
    ink.wobble = 0.9;
    // vertical fissures and deep pockets (contour fills)
    const cn = new LW.Noise(l.seed + 77);
    const bb = l.bbox;
    const blackField = (x, y) => {
      if (x < bb[0] + 9 || y < bb[1] + 9 || x > bb[2] - 9 || y > bb[3] - 9) return -1;
      if (!f.mask.in(x, y)) return -1;
      const d = f.dark.at(x, y);
      let v = d - T.pocket;
      const wx = x + 40 * cn.fbm(x / 200, y / 200, 2);
      const r = cn.ridged(wx / 52, y / 520, 2);
      const env = LW.smooth(0.1, 0.6, cn.fbm(x / 170 + 9, y / 340, 2));
      const g = 0.3 + 0.7 * LW.smooth(0.3, 0.85, d);
      v = Math.max(v, (r - 0.945) * 4 * env * g - 0.006);
      if (kind !== 'far') v -= 0.4 * LW.clamp(LW.warm(x, y, kind), 0, 1);
      return v;
    };
    const black = near ? P.ink : LW.mix(P.inkFar, P.ink, 0.6);
    LW.contours({ bbox: bb, step: 4, field: blackField, levels: [0] }, (pts) => {
      if (pts.length < 4) return;
      let area = 0;
      for (let i = 0; i < pts.length - 1; i++) area += pts[i][0] * pts[i + 1][1] - pts[i + 1][0] * pts[i][1];
      if (Math.abs(area) < 60) return;
      const sm = LW.chaikin(pts, 1, true);
      const cx = sm[0][0], cy = sm[0][1];
      const b = kind !== 'far' ? LW.warmBand(LW.warm(cx, cy, kind), cx, cy, 0) : 0;
      ink.fill(sm, b >= 3 ? P.warmInk2 : b >= 1 ? P.warmInk1 : black, 0.8);
    });
    // strata ledges: a lit lip line with an undercut black shadow beneath
    for (const [ly, sl] of f.ledges) {
      let run = [];
      const flushRun = () => {
        if (run.length > 6) {
          ink.line(run, (x, y) => ink.st(ink.col(P.ink), 3.2), { taper: 30 });
          const under = run.map((p, i) => [p[0], p[1] + 4 + 12 * Math.pow(Math.sin(Math.PI * i / (run.length - 1)), 0.7) * (0.6 + 0.4 * cn.n2(p[0] / 50, ly))]);
          ink.fill(run.concat(under.slice().reverse()), P.ink, 0.6);
        }
        run = [];
      };
      for (let x = bb[0]; x <= bb[2]; x += 6) {
        const y = f.ledgeY(ly, sl, x);
        if (f.ledgeGate(ly, x) > 0.35 && f.mask.in(x, y) && f.mask.edtAt(x, y) > 14) run.push([x, y]);
        else flushRun();
      }
      flushRun();
    }
    ctx.save();
    ctx.clip(l.path);
    ink.flush(ctx);
    ctx.restore();
    // silhouette outline
    const ink2 = new LW.Ink(l.seed + 901);
    ink2.wobble = 0.6;
    const oc = ink2.col(P.ink);
    const wn = new LW.Noise(l.seed + 55);
    ink2.line(l.edge, (x, y) => (l.name === 'SC' && x < 700 ? -1 : ink2.st(l.kind === 'rock' ? ink2.col(LW.warmInkColor(LW.warmBand(LW.warm(x, y, 'rock'), x, y, 0), P.ink)) : oc, T.outline * (0.75 + 0.5 * (0.5 + 0.5 * wn.n2(x / 60, y / 60))))), { taper: 0 });
    if (l.base) ink2.line(l.base, ink2.st(oc, T.outline * 0.7), { taper: 20 });
    ink2.flush(ctx);
  }

  // ---------------------------------------------------------------- draw one layer
  LW.drawCliffLayer = function (ctx, S, l) {
    const t0 = performance.now();
    const T = TIER[l.tier];
    const f = layerFields(l);
    const kind = l.kind || (l.tier === 2 ? 'rock' : 'far');
    const pal = l.name === 'R0' ? [P.rock2, P.rock3, P.rock4, LW.mix(P.rock4, P.ink, 0.3), LW.mix(P.rock4, P.ink, 0.55)] : l.tier === 2 ? [P.rock0, P.rock1, P.rock2, P.rock3, P.rock4, LW.mix(P.rock4, P.ink, 0.4)] : T.pal;
    const rimCol = l.tier === 0 ? P.water3 : P.water2;
    if (l.tier >= 1) {
      drawCellCliff(ctx, S, l, f, kind, pal, T, rimCol);
      LW.log('cliff', l.name, 'ms', Math.round(performance.now() - t0));
      return;
    }
    // ---- fill
    LW.shadeFill(ctx, S, l.path, l.bbox, (x, y, out) => {
      let d = f.dark.at(x, y);
      const by = f.baseY(x);
      let c = LW.stepPick(pal, LW.clamp(d, 0, 0.999), x, y, 0.05);
      // cyan bounce from the river along the foot of the wall
      const rimD = by - y;
      if (rimD < 34 * T.rim && rimD > -2) {
        const t = LW.smooth(34, 4, rimD + LW.lnoise.n2(x / 9, y / 9) * 7);
        if (t > 0.5) c = LW.mix(c, rimCol, 0.55);
      }
      if (kind !== 'far') {
        const wv = LW.warm(x, y, kind);
        const b = LW.warmBand(wv, x, y);
        if (b > 0) c = LW.warmFill[b];
      }
      out[0] = c[0]; out[1] = c[1]; out[2] = c[2];
    });

    const ink = new LW.Ink(l.seed + 900);
    ink.wobble = l.tier === 2 ? 1.1 : 0.8;
    // ---- black crevices and pockets (contour fills)
    const cn = new LW.Noise(l.seed + 77);
    const bb = l.bbox;
    const blackField = (x, y) => {
      if (x < bb[0] + 9 || y < bb[1] + 9 || x > bb[2] - 9 || y > bb[3] - 9) return -1;
      if (!f.mask.in(x, y)) return -1;
      const d = f.dark.at(x, y);
      let v = d - T.pocket;
      if (T.crack > 0) {
        const wx = x + 40 * cn.fbm(x / 200, y / 200, 2);
        const r = cn.ridged(wx / 46, y / 430, 2);
        const env = LW.smooth(0.05, 0.55, cn.fbm(x / 160 + 9, y / 300, 2));
        const g = 0.35 + 0.65 * LW.smooth(0.25, 0.8, d);
        v = Math.max(v, (r - 0.94) * 4 * env * g * T.crack - 0.004);
      }
      if (kind !== 'far') v -= 0.1 * LW.clamp(LW.warm(x, y, kind), 0, 1);
      return v;
    };
    const black = l.tier === 2 ? P.ink : l.tier === 1 ? LW.mix(P.inkFar, P.ink, 0.6) : P.inkFar;
    LW.contours({ bbox: l.bbox, step: 4, field: blackField, levels: [0] }, (pts) => {
      if (pts.length < 4) return;
      let area = 0;
      for (let i = 0; i < pts.length - 1; i++) area += pts[i][0] * pts[i + 1][1] - pts[i + 1][0] * pts[i][1];
      if (Math.abs(area) < 60) return;
      const sm = LW.chaikin(pts, 1, true);
      // warm-lit crevices are dark rust rather than navy
      const cx = sm[0][0], cy = sm[0][1];
      const b = kind !== 'far' ? LW.warmBand(LW.warm(cx, cy, kind), cx, cy, 0) : 0;
      ink.fill(sm, b >= 3 ? P.warmInk2 : b >= 1 ? P.warmInk1 : black, 0.8);
    });

    // ---- streamline hatching
    const rng = new LW.RNG('cliff-' + l.name);
    const [ds0, ds1] = T.dsep;
    const dsep = (x, y) => {
      let d = LW.clamp(f.dark.at(x, y), 0, 1);
      if (kind !== 'far') d *= 1 - 0.35 * LW.clamp(LW.warm(x, y, kind), 0, 1);
      return ds1 + (ds0 - ds1) * Math.pow(d, 0.85);
    };
    const lines = LW.streamlines({
      bbox: l.bbox,
      dir: f.dir,
      inside: (x, y) => f.mask.in(x, y),
      dsep,
      dtest: 0.5,
      dmin: ds0,
      step: 2.6,
      maxLen: l.tier === 2 ? 1400 : 700,
      minLen: l.tier === 2 ? 26 : 18,
      rng,
      gapStep: ds1 * 0.8,
    });
    const baseInk = ink.col(T.ink);
    const rimInk = ink.col(LW.mix(T.ink, P.water1, 0.75));
    const warmInks = [0, 1, 2, 3, 4, 5, 6].map((b) => ink.col(LW.warmInkColor(b, T.ink)));
    const wn = new LW.Noise(l.seed + 55);
    const style = (x, y) => {
      const d = LW.clamp(f.dark.at(x, y), 0, 1);
      let w = T.w[0] + (T.w[1] - T.w[0]) * d;
      w *= 0.85 + 0.3 * (0.5 + 0.5 * wn.n2(x / 40, y / 40));
      let ci = baseInk;
      const by = f.baseY(x);
      if (by - y < 30 && by - y > -2) ci = rimInk;
      if (kind !== 'far') {
        const b = LW.warmBand(LW.warm(x, y, kind), x, y);
        if (b > 0) ci = warmInks[b];
      }
      return ink.st(ci, w);
    };
    for (const pts of lines) ink.line(pts, style, { taper: 16 });

    // ---- crack cross-strokes making the cell network
    if (T.crack > 0) {
      const perp = (x, y) => {
        const v = f.dir(x, y);
        if (!v) return null;
        const a = 1.1 + 0.6 * wn.n2(x / 90, y / 90);
        const c = Math.cos(a), s = Math.sin(a);
        return [v[0] * c - v[1] * s, v[0] * s + v[1] * c];
      };
      const cracks = LW.streamlines({
        bbox: l.bbox,
        dir: perp,
        inside: (x, y) => f.mask.in(x, y) && f.dark.at(x, y) > 0.3,
        dsep: (x, y) => (l.tier === 2 ? 30 : 52) + 44 * (1 - LW.clamp(f.dark.at(x, y), 0, 1)),
        dtest: 0.5,
        dmin: 28,
        step: 2.5,
        maxLen: l.tier === 2 ? 52 : 30,
        minLen: 10,
        rng: new LW.RNG('crack-' + l.name),
        gapStep: 50,
      });
      for (const pts of cracks) {
        if (rng.next() < 0.15) continue;
        ink.line(pts, (x, y) => {
          const s = style(x, y);
          const ci = Math.floor(s / 512);
          return ink.st(ci, ((s % 512) / 16) * 0.8);
        }, { taper: 10 });
      }
    }
    ctx.save();
    ctx.clip(l.path);
    ink.flush(ctx);
    ctx.restore();

    // ---- silhouette outline, heavier on shadow side
    const ink2 = new LW.Ink(l.seed + 901);
    ink2.wobble = 0.6;
    const oc = ink2.col(l.tier === 0 ? P.inkFar : P.ink);
    const ow = T.outline;
    ink2.line(l.edge, (x, y) => {
      const v = 0.75 + 0.5 * (0.5 + 0.5 * wn.n2(x / 60, y / 60));
      return ink2.st(oc, ow * v);
    }, { taper: 0 });
    if (l.base && l.tier > 0) {
      ink2.line(l.base, ink2.st(oc, ow * 0.7), { taper: 20 });
    }
    ink2.flush(ctx);
    LW.log('cliff', l.name, 'lines', lines.length, 'ms', Math.round(performance.now() - t0));
  };
})();
