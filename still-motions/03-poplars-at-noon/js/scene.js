// The motif, as a painter's plan: what is where, its local colour, how it is lit, which way the touches run.
// Coordinates are master-canvas pixels (2160 x 2700, y down). Colours here are sRGB 0..1 "targets": the colour
// the eye should read at that spot once the dabs mix optically. paint.js turns targets into pure-colour dabs.
(function (G) {
  'use strict';
  const R = G.RNG;
  const W = 2160, H = 2700, B = 62, YH = 1290;
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const mix = (a, b, t) => a + (b - a) * t;
  const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const mix3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const mul3 = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
  const lum = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  const PI = Math.PI;

  // ---------- curves -------------------------------------------------------------------------------------------
  function curve(pts) {
    return function (x) {
      const n = pts.length;
      if (x <= pts[0][0]) return pts[0][1] + ((x - pts[0][0]) * (pts[1][1] - pts[0][1])) / (pts[1][0] - pts[0][0]);
      if (x >= pts[n - 1][0]) return pts[n - 1][1] + ((x - pts[n - 1][0]) * (pts[n - 1][1] - pts[n - 2][1])) / (pts[n - 1][0] - pts[n - 2][0]);
      let i = 0;
      while (i < n - 2 && x > pts[i + 1][0]) i++;
      const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(n - 1, i + 2)];
      const dx = p2[0] - p1[0], t = (x - p1[0]) / dx, t2 = t * t, t3 = t2 * t;
      const m1 = ((p2[1] - p0[1]) / (p2[0] - p0[0])) * dx, m2 = ((p3[1] - p1[1]) / (p3[0] - p1[0])) * dx;
      return (2 * t3 - 3 * t2 + 1) * p1[1] + (t3 - 2 * t2 + t) * m1 + (-2 * t3 + 3 * t2) * p2[1] + (t3 - t2) * m2;
    };
  }
  function tab(fn, a, b) {
    const n = b - a + 1, t = new Float32Array(n);
    for (let i = 0; i < n; i++) t[i] = fn(a + i);
    return (v) => { let f = v - a; if (f < 0) f = 0; if (f > n - 1.001) f = n - 1.001; const i = f | 0, r = f - i; return t[i] + (t[i + 1] - t[i]) * r; };
  }
  // far (left) bank water line, y as a function of x
  // an S-bend: the far bank comes toward us on a broad swell (left of centre), then sweeps steeply away and flattens
  // into the distance toward the village
  const yFB = tab(curve([[-300, 1800], [0, 1690], [200, 1650], [380, 1640], [540, 1622], [680, 1574], [820, 1506], [960, 1442], [1090, 1398], [1220, 1366], [1350, 1340], [1480, 1321], [1600, 1310], [1760, 1304], [2500, 1300]]), -400, 2600);
  // near (right) bank water line, x as a function of y
  // the near bank swells out into the river in the middle distance and falls back toward us
  const xNB = tab(curve([[1296, 1820], [1304, 1760], [1312, 1680], [1324, 1580], [1345, 1470], [1378, 1372], [1420, 1318], [1480, 1300], [1560, 1318], [1680, 1380], [1840, 1430], [2000, 1420], [2180, 1440], [2400, 1530], [2800, 1640]]), 1280, 2800);
  // natural bank edges: grass tufts leaning into the water, small inlets, never a ruled line
  function edgeNoise(t, seed, amp) {
    const roll = (R.fbm(t / 46, 1.7, seed, 3) - 0.5) * 1.8;
    const tuft = Math.pow(R.vnoise(t / 11, 2.3, seed + 2), 4) * 2.2;
    const inlet = -Math.pow(R.vnoise(t / 85, 3.1, seed + 4), 6) * 4.5;
    return amp * (roll + tuft + inlet);
  }
  const yEdgeT = tab((x) => yFB(x) + edgeNoise(x, 171, 1.2 + 0.05 * Math.max(0, yFB(x) - YH)), -400, 2600);
  const yEdge = (x) => yEdgeT(x);
  const xEdgeT = tab((y) => xNB(y) - edgeNoise(y * 1.6, 181, 1.5 + 12 * Math.max(0, y - YH) / (H - YH)), 1280, 2800);
  const xEdge = (y) => xEdgeT(y);
  const RIVER_TOP = 1303;

  function bank(x) {
    const yb = yFB(x), d = Math.max(0, yb - YH);
    const bw = 0.035 * d + 1.5, tw = 0.085 * d + 2.5, vw = 0.07 * d + 2;
    return { yb, bw, tw, vw, d };
  }

  // ---------- the poplars --------------------------------------------------------------------------------------
  const TREES = [];
  {
    const spec = [ // x, height ratio, crown width ratio, lean, profile power, profile fullness, crown base fraction
      [232, 5.12, 0.158, -0.012, 2.1, 0.62, 0.11], [522, 4.86, 0.172, 0.012, 2.6, 0.7, 0.13], [702, 5.42, 0.132, -0.004, 1.9, 0.55, 0.1],
      [888, 5.2, 0.152, 0.01, 2.3, 0.66, 0.12], [998, 4.5, 0.165, -0.008, 2.5, 0.72, 0.15], [1112, 5.6, 0.142, 0.006, 2.0, 0.58, 0.1],
      [1190, 5.3, 0.15, -0.01, 2.2, 0.64, 0.12], [1246, 5.0, 0.16, 0.004, 2.4, 0.66, 0.13], [1293, 5.5, 0.15, 0.0, 2.1, 0.6, 0.11],
      [1331, 5.1, 0.17, -0.006, 2.3, 0.66, 0.12],
    ];
    const TOPS = [106, 458, 522, 733, 908, 896, 989, 1054, 1065, 1113]; // the receding rhythm of the crowns
    const rnd = R.mulberry32(77);
    spec.forEach((s, i) => {
      const g = bank(s[0]);
      const base = g.yb - g.bw - 0.72 * g.tw;
      const h = base - TOPS[i];
      TREES.push({ i, x: s[0], base, h, top: base - h, cb: base - s[6] * h, cw: s[2] * h, lean: s[3], pa: s[4], pb: s[5], seed: rnd() * 100, iseed: 31 + i * 7, wob: (rnd() - 0.5) * 0.014 * h, phase: rnd() });
    });
  }
  // depth cue of a tree: 0 near .. 1 far
  const treeFar = (T) => clamp(1 - (T.h - 220) / (TREES[0].h - 220), 0, 1);

  function crownGeom(T, y) {
    const s = (T.cb - y) / (T.cb - T.top);
    const xc = T.x + T.lean * T.h * s * s + T.wob * Math.sin(s * 4.2 + T.seed);
    const prof = sstep(-0.32, 0.32, s) * Math.pow(Math.max(0, 1 - Math.pow(Math.max(s, 0), T.pa)), T.pb);
    return { s, xc, prof };
  }
  // crown half-width at height y on one side, with foliage clumps breaking the silhouette
  function crownHalf(T, s, side, prof) {
    const k = T.h / 30;
    const lump = R.fbm(s * k, side * 5.3 + T.seed, T.iseed, 3);
    const tuft = Math.pow(R.vnoise(s * k * 1.9, side * 9.1 + T.seed, T.iseed + 3), 2.5);
    return 0.5 * T.cw * prof * (0.76 + 0.36 * lump + 0.36 * tuft);
  }
  // foliage masses: jittered clump centres (a cellular field); within its clump a point is lit toward the upper right
  function clumpLight(T, x, y) {
    const cw = 0.034 * T.h + 5, ch = 0.05 * T.h + 6;
    const gx = x / cw, gy = y / ch, ix = Math.floor(gx), iy = Math.floor(gy);
    let sw = 0, sl = 0;
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
      const cx = ix + i + 0.15 + 0.7 * R.hash2(ix + i, iy + j, T.iseed + 41), cy = iy + j + 0.15 + 0.7 * R.hash2(ix + i, iy + j, T.iseed + 43);
      const dx = gx - cx, dy = (gy - cy) * 1.2, d = dx * dx + dy * dy;
      const w = Math.exp(-d / 0.08);  // soft blend of neighbouring clumps: no facet edges
      sw += w; sl += w * (0.5 + 0.4 * dx - 0.6 * dy - 0.6 * d);
    }
    return clamp(sl / Math.max(sw, 1e-9) + 0.25 * (R.vnoise(x / 9, y / 9, T.iseed + 47) - 0.5), 0, 1);
  }
  const FOL = { deep: [0.03, 0.08, 0.1], shade: [0.06, 0.15, 0.15], mid: [0.22, 0.37, 0.16], lit: [0.58, 0.66, 0.22], hi: [0.88, 0.85, 0.42] };
  function foliageColour(light) {
    if (light < 0.25) return mix3(FOL.deep, FOL.shade, light / 0.25);
    if (light < 0.5) return mix3(FOL.shade, FOL.mid, (light - 0.25) / 0.25);
    if (light < 0.8) return mix3(FOL.mid, FOL.lit, (light - 0.5) / 0.3);
    return mix3(FOL.lit, FOL.hi, (light - 0.8) / 0.2);
  }
  const AIR = [0.6, 0.68, 0.78];
  function aerial(c, f) { // distance haze: lift and cool
    return mix3(c, AIR, f);
  }

  // topmost tree at (x,y): returns a sample or null. margin > 0 also reports points just outside a crown
  function poplarAt(x, y, onlyTree) {
    for (let k = 0; k < TREES.length; k++) {
      const T = TREES[k];
      if (onlyTree !== undefined && k !== onlyTree) continue;
      if (y < T.top - 4 || y > T.base + 3) continue;
      if (Math.abs(x - T.x) > T.cw + 0.2 * T.h * Math.abs(T.lean) + 20) continue;
      const far = treeFar(T);
      // crown
      if (y <= T.cb + 0.02 * T.h) {
        const g = crownGeom(T, y);
        if (g.s <= 1 && g.s > -0.06) {
          const side = x < g.xc ? -1 : 1;
          const hw = crownHalf(T, g.s, side, g.prof);
          const u = (x - g.xc) / Math.max(1, hw);
          // sky shows through the feathery outer foliage here and there
          const hole = Math.abs(u) > 0.7 && R.fbm(x / (0.01 * T.h + 3), y / (0.016 * T.h + 3), T.iseed + 23, 2) > 0.7 - 0.3 * (Math.abs(u) - 0.7);
          if (Math.abs(u) <= 1 && hw > 0.5 && !hole) {
            // light: the sun is high and to the right; the foliage hangs in upward-sweeping masses, each lit on top
            const sideLit = sstep(-0.75, 0.85, u + 0.12);
            const cl = R.fbm(x / (0.02 * T.h + 4), y / (0.034 * T.h + 4), T.iseed + 11, 3);
            const top = 0.6 * (clumpLight(T, x, y) - 0.45);
            const cl2 = R.vnoise(x / (0.05 * T.h + 6), y / (0.035 * T.h + 5), T.iseed + 19);
            let light = 0.08 + 0.68 * sideLit + 0.75 * (cl - 0.5) + 0.3 * (cl2 - 0.5) + top * (0.35 + 0.65 * sideLit);
            light += 0.12 * sstep(0.45, 0.95, g.s) - 0.25 * sstep(0.18, 0.0, g.s); // top catches more, bottom tucks under
            light -= 0.22 * sstep(0.55, 1.0, -u); // the shadowed flank goes deepest at its edge
            light = clamp(light, 0, 1);
            let col = foliageColour(light);
            col = aerial(col, 0.55 * far * far + 0.12 * far);
            const ang = PI / 2 + 0.35 * u * (1 - g.s * 0.5) + 0.25 * (R.vnoise(x / 20, y / 20, 5) - 0.5);
            return { fam: 'foliage', col, lit: light, ang, tree: k, u, s: g.s, part: 'crown', far };
          }
        }
      }
      // trunk (visible between the crown's lower edge and the ground)
      if (y > T.cb - 0.03 * T.h && y <= T.base + 2) {
        const r = (y - T.cb) / (T.base - T.cb);
        const tw = Math.max(2.2, 0.016 * T.h * (1.15 - 0.25 * (1 - r)));
        const xc = T.x + 0.004 * T.h * Math.sin(T.seed + r * 3);
        const u = (x - xc) / tw;
        if (Math.abs(u) <= 1) {
          const light = clamp(0.15 + 0.55 * sstep(-0.2, 0.9, u) * (0.4 + 0.6 * r), 0, 1);
          let col = mix3([0.12, 0.1, 0.16], [0.62, 0.52, 0.42], light);
          col = aerial(col, 0.5 * far * far);
          return { fam: 'trunk', col, lit: light, ang: PI / 2, tree: k, u, s: -r, part: 'trunk', far };
        }
      }
    }
    return null;
  }
  // two rounded willows on the near meadow, right: a counterweight to the poplar row
  const WILLOWS = [];
  {
    const rnd = R.mulberry32(303);
    for (const [x, base, h, w] of [[1952, 1690, 360, 1.0], [1818, 1622, 250, 0.92]]) {
      const lobes = [];
      for (let i = 0; i < 9; i++) {
        const a = -Math.PI * (0.08 + 0.84 * rnd());
        lobes.push({ dx: Math.cos(a) * 0.3 * h * w * (0.6 + 0.5 * rnd()), dy: Math.sin(a) * 0.22 * h * (0.5 + 0.6 * rnd()), r: (0.12 + 0.08 * rnd()) * h });
      }
      WILLOWS.push({ x, base, h, w, cy: base - 0.58 * h, rx: 0.36 * h * w, ry: 0.34 * h, lobes, seed: rnd() * 100, phase: rnd(), top: base - h - 10, cb: base - 0.28 * h });
    }
  }
  function willowAt(x, y, only) {
    for (let k = 0; k < WILLOWS.length; k++) {
      if (only !== undefined && k !== only) continue;
      const T = WILLOWS[k];
      if (y < T.top || y > T.base + 2 || Math.abs(x - T.x) > T.rx * 1.6 + 10) continue;
      // a weeping willow: a domed head that falls in a curtain of hanging strands, feathery and broken at the edge
      const below = sstep(T.cy - 0.2 * T.ry, T.cy + 0.9 * T.ry, y);
      const strand = R.fbm(x / 5.5, y / 70, 331 + k, 3) - 0.5;
      const n = (R.fbm(x / 22, y / 26, 311 + k, 3) - 0.5) * 0.45 + strand * (0.25 + 0.9 * below);
      let best = -1, lit = 0;
      const dx0 = (x - T.x) / T.rx, dy0 = (y - T.cy) / (T.ry * (y > T.cy ? 1.22 : 1));
      const d0 = 1 - (dx0 * dx0 + dy0 * dy0) + n;
      let sw = Math.exp(6 * d0), sl = sw * (0.55 + 0.42 * dx0 - 0.5 * dy0);
      best = d0;
      for (const L of T.lobes) {
        const lx = (x - (T.x + L.dx)) / L.r, ly = (y - (T.cy + L.dy)) / (L.r * (y > T.cy + L.dy ? 1.25 : 0.9));
        const d = 1 - (lx * lx + ly * ly) + n * 0.8;
        if (d > best) best = d;
        const w = Math.exp(6 * d); sw += w; sl += w * (0.58 + 0.42 * lx - 0.5 * ly); // soft blend: no seams between lobes
      }
      lit = sl / sw;
      // sky through the feathery outer foliage
      const hole = best < 0.4 && R.fbm(x / 9, y / 16, 337 + k, 2) > 0.62;
      if (best > 0 && !hole) {
        const cl = R.fbm(x / 13, y / 17, 317 + k, 3);
        let light = lit - 0.12 + 0.6 * (cl - 0.5) + 0.35 * strand - 0.2 * below - 0.18 * sstep(0.3, 0.0, best) * (dx0 < 0 ? 1 : 0);
        light = clamp(light, 0, 1);
        const WS = [0.14, 0.2, 0.36], WM = [0.28, 0.42, 0.32], WL = [0.6, 0.7, 0.32], WH = [0.86, 0.84, 0.44];
        const col = light < 0.4 ? mix3(WS, WM, light / 0.4) : light < 0.8 ? mix3(WM, WL, (light - 0.4) / 0.4) : mix3(WL, WH, (light - 0.8) / 0.2);
        return { fam: 'willow', col, lit: light, ang: PI / 2 + 0.12 * dx0 + 0.15 * (R.vnoise(x / 15, y / 15, 7) - 0.5), willow: k, part: 'crown', far: 0.15, droop: 1 };
      }
      if (best > 0) continue;
      // short thick trunk
      const r = (y - T.cb) / (T.base - T.cb);
      if (r >= 0 && r <= 1) {
        const tw = 0.05 * T.h * (1.1 - 0.2 * r);
        const u = (x - T.x) / tw;
        if (Math.abs(u) <= 1) {
          const light = clamp(0.1 + 0.6 * sstep(-0.1, 0.9, u) * r, 0, 1);
          return { fam: 'trunk', col: mix3([0.08, 0.07, 0.12], [0.5, 0.42, 0.36], light), lit: light, ang: PI / 2, willow: k, part: 'trunk', far: 0.15 };
        }
      }
    }
    return null;
  }
  function willowShadow(x, y) {
    let sh = 0;
    for (const T of WILLOWS) {
      const dx = (x - (T.x - 0.45 * T.rx)) / (1.3 * T.rx), dy = (y - (T.base - 0.03 * T.h)) / (0.11 * T.h);
      sh = Math.max(sh, sstep(1.05, 0.3, dx * dx + dy * dy + 0.35 * (R.vnoise(x / 12, y / 8, 321) - 0.5)));
    }
    return sh;
  }
  // how far inside a crown (in px), for culling dabs that no sway would ever reveal
  function insideCrownBy(x, y) {
    let best = -1e9;
    for (const T of TREES) {
      if (y < T.top || y > T.cb) continue;
      const g = crownGeom(T, y);
      if (g.s < 0 || g.s > 1) continue;
      const hw = 0.5 * T.cw * g.prof * 0.8;
      best = Math.max(best, hw - Math.abs(x - g.xc));
    }
    for (const T of WILLOWS) {
      const dx = (x - T.x) / (T.rx * 0.8), dy = (y - T.cy) / (T.ry * 0.8);
      const v = 1 - Math.sqrt(dx * dx + dy * dy);
      if (v > 0) best = Math.max(best, v * T.rx * 0.8);
    }
    return best;
  }
  // shade cast on the ground of the far bank by the poplars (sun high, right, a little behind us)
  function treeShadow(x, y) {
    let sh = 0;
    for (const T of TREES) {
      const cx = T.x - 0.55 * T.cw, cy = T.base - 0.012 * T.h;
      const rx = 0.95 * T.cw + 4, ry = 0.035 * T.h + 3;
      const dx = (x - cx) / rx, dy = (y - cy) / ry;
      const e = dx * dx + dy * dy;
      const n = 0.25 * (R.vnoise(x / 9, y / 6, 41) - 0.5);
      sh = Math.max(sh, sstep(1.05, 0.55, e + n));
    }
    return sh;
  }

  // ---------- sky and clouds -----------------------------------------------------------------------------------
  const CLOUDS = [];
  {
    const rnd = R.mulberry32(9);
    const addCumulus = (cx, base, wid, hgt, n, flat) => {
      for (let i = 0; i < n; i++) {
        const a = rnd(), b = rnd();
        const x = cx + (a - 0.5) * wid * (0.9 - 0.35 * b);
        const env = Math.sqrt(Math.max(0.05, 1 - Math.pow((2 * (x - cx)) / wid, 2)));
        const y = base - (0.15 + 0.85 * b) * hgt * env * (0.55 + 0.45 * rnd());
        const r = (0.18 + 0.22 * rnd()) * hgt * (0.6 + 0.6 * env);
        CLOUDS.push({ x, y, rx: r * (1.25 + 0.3 * rnd()), ry: r * flat, base, s: rnd() * 50 });
      }
    };
    addCumulus(1640, 735, 900, 560, 26, 0.9);   // the big noon cumulus, upper right
    addCumulus(1180, 820, 380, 210, 10, 0.8);   // its smaller companion
    addCumulus(640, 930, 520, 190, 12, 0.7);    // behind the poplars
    addCumulus(300, 1120, 600, 90, 8, 0.55);    // low, flattened by distance
    addCumulus(1100, 1150, 460, 70, 7, 0.5);
    addCumulus(1900, 1170, 520, 80, 8, 0.5);
    addCumulus(1460, 1215, 300, 40, 5, 0.45);
  }
  function skyBase(x, y) {
    const t = y / YH; // 0 top .. 1 horizon (negative above the frame, for reflections)
    const top = [0.26, 0.47, 0.8], mid = [0.48, 0.68, 0.9], low = [0.78, 0.87, 0.92], hz = [0.98, 0.94, 0.8];
    let c;
    if (t < 0.45) c = mix3(top, mid, sstep(-0.3, 0.45, t));
    else if (t < 0.85) c = mix3(mid, low, sstep(0.45, 0.85, t));
    else c = mix3(low, hz, sstep(0.85, 1.0, t));
    // deeper toward the upper left, a little warmer near the sun side
    const k = sstep(1300, 0, x) * sstep(0.7, 0.0, t);
    c = mix3(c, [0.2, 0.36, 0.74], 0.35 * k);
    const v = (R.fbm(x / 260, y / 160, 3, 3) - 0.5) * 0.06;
    c = [c[0] + v, c[1] + v, c[2] + v * 0.6];
    // irradiation: next to the pale village and tower the sky is pushed deeper and bluer
    const tdx = Math.max(0, Math.abs(x - 1593) - 18), tdy = Math.max(0, 1082 - y);
    const tower = Math.exp(-(tdx * tdx + tdy * tdy) / (2 * 34 * 34));
    const band = sstep(1150, 1265, y) * sstep(1400, 1500, x) * sstep(2120, 2030, x) * (y > YH ? 0 : 1);
    const halo = Math.max(0.4 * tower, 0.42 * band);
    return mix3(c, [0.56, 0.7, 0.9], halo);
  }
  function cloudField(x, y) {
    let best = 0, bi = -1, e = 0;
    const n = (R.fbm(x / 70, y / 55, 13, 4) - 0.5) * 0.7 + (R.fbm(x / 25, y / 22, 17, 2) - 0.5) * 0.18;
    for (let i = 0; i < CLOUDS.length; i++) {
      const c = CLOUDS[i];
      const dx = (x - c.x) / c.rx, dy = (y - c.y) / c.ry;
      if (dx > 1.6 || dx < -1.6 || dy > 1.6 || dy < -1.6) continue;
      let v = 1 - (dx * dx + dy * dy) + n;
      v *= sstep(c.base + 18, c.base - 26, y + n * 30);
      if (v > best) { best = v; bi = i; }
      e += Math.max(0, v);
    }
    return { d: best, i: bi, sum: e };
  }
  function skyAt(x, y) {
    const base = skyBase(x, y);
    const cf = y > -50 ? cloudField(x, y) : { d: 0, i: -1 };
    let col = base, fam = 'sky', lit = 0.8;
    const a = sstep(0.0, 0.32, cf.d);
    if (a > 0) {
      const c = CLOUDS[cf.i];
      const nx = (x - c.x) / c.rx, ny = (y - c.y) / c.ry;
      let l = 0.62 + 0.3 * nx - 0.5 * ny + 0.5 * (R.fbm(x / 45, y / 40, 23, 3) - 0.5);
      l -= 0.45 * sstep(c.base - 0.6 * (c.base - c.y) - 10, c.base, y); // flat grey-violet bases
      l = clamp(l + 0.25 * sstep(0.35, 0.05, cf.d), 0, 1); // thin edges glow
      const distant = sstep(950, 1250, y);
      const litC = mix3([1.0, 0.97, 0.9], [0.98, 0.93, 0.86], distant);
      const shC = mix3([0.66, 0.67, 0.8], [0.8, 0.8, 0.84], distant);
      const cc = mix3(shC, litC, sstep(0.0, 1.0, l));
      col = mix3(base, cc, a * (0.92 - 0.25 * distant));
      fam = a > 0.5 ? 'cloud' : 'sky';
      lit = l;
    }
    const ang = -0.55 + 0.5 * (R.vnoise(x / 60, y / 60, 29) - 0.5);
    if (fam === 'sky' && y > 0.7 * YH) fam = 'skyLow';
    return { fam, col, lit, ang, layer: 0, ch: 'sky' };
  }

  // ---------- horizon: wood line, village, church --------------------------------------------------------------
  function woodTop(x) {
    let h = 16 + 26 * R.fbm(x / 55, 1.5, 51, 3) + 20 * Math.pow(R.vnoise(x / 130, 2.5, 53), 2);
    h += 34 * sstep(1000, 300, x) * R.fbm(x / 80, 3.3, 55, 2); // a heavier wood far behind the poplars
    h += 22 * sstep(1950, 2150, x);
    h += 18 * sstep(1430, 1500, x) * sstep(2090, 2020, x); // trees behind the village
    return YH + 3 - h;
  }
  // the village: houses clustered round the church at several depths (nearer = lower on the page and a little larger),
  // varied in width, height and roof (hipped, gable end on, ridge on), some roofs turned from the sun, garden trees between
  const CH = { x0: 1556, x1: 1668, wt: 1262, rt: 1238, tx0: 1576, tx1: 1610, tt: 1172, st: 1082, gy: 1307 };
  const VIL = [];
  {
    const rnd = R.mulberry32(505);
    const walls = [[0.98, 0.92, 0.8], [0.96, 0.82, 0.68], [0.99, 0.92, 0.7], [0.92, 0.88, 0.86], [0.94, 0.78, 0.66]];
    const spread = () => (rnd() + rnd() + rnd() - 1.5) / 1.5; // -1..1, crowded toward 0
    for (let i = 0; i < 46; i++) {
      const wide = rnd() < 0.35;
      let cx = 1630 + spread() * (wide ? 470 : 230);
      cx = clamp(cx, 1462, 2075);
      const gy = 1299 + 11 * rnd();
      const sc = 0.62 + 0.042 * (gy - 1299);
      if (Math.abs(cx - 1593) < 26 && gy > 1305) continue; // keep the foot of the tower clear
      const w = (20 + 38 * rnd()) * sc, wh = (10 + 20 * rnd()) * sc * (rnd() < 0.15 ? 1.5 : 1) * (wide ? 0.8 : 1), rh = (7 + 16 * rnd()) * sc;
      const r = rnd();
      VIL.push({ kind: 'house', x0: cx - w / 2, x1: cx + w / 2, gy, wt: gy - wh, rt: gy - wh - rh,
        roof: r < 0.42 ? 'hip' : r < 0.72 ? 'gable' : 'ridge', slate: rnd() < 0.28, roofShade: rnd() < 0.3,
        side: rnd() < 0.75 ? 0.18 + 0.3 * rnd() : 0, wallC: walls[(rnd() * walls.length) | 0], win: rnd() < 0.6 });
    }
    for (let i = 0; i < 18; i++) {
      const cx = clamp(1630 + spread() * (rnd() < 0.4 ? 480 : 260), 1455, 2080), gy = 1299 + 11 * rnd();
      if (Math.abs(cx - 1593) < 30) continue;
      const tall = rnd() < 0.3, r = (tall ? 4.5 + 2 * rnd() : 9 + 9 * rnd()) * (0.75 + 0.03 * (gy - 1299));
      VIL.push({ kind: 'tree', cx, gy, rx: r, ry: tall ? r * (2.6 + 0.6 * rnd()) : r * (0.95 + 0.25 * rnd()), cy: gy - (tall ? r * 2.5 : r * 0.9), s: rnd() * 40 });
    }
    VIL.push({ kind: 'church', gy: CH.gy });
    VIL.sort((a, b) => b.gy - a.gy); // nearest first
  }
  const hazeV = (c) => mix3(c, AIR, 0.05);
  function churchAt(x, y) {
    if (x >= CH.tx0 - 1 && x <= CH.tx1 + 1 && y >= CH.st && y <= CH.gy) {
      const tc = (CH.tx0 + CH.tx1) / 2, half = (CH.tx1 - CH.tx0) / 2;
      if (y >= CH.tt) {
        const u = (x - tc) / half;
        const lit = u > -0.15 ? 0.85 : 0.2;
        const col = lit > 0.5 ? [1.0, 0.9, 0.72] : [0.54, 0.57, 0.8];
        return { fam: 'wall', col, lit, ang: PI / 2, layer: 3, ch: 'vil', fine: 1 };
      }
      const f = (y - CH.st) / (CH.tt - CH.st);
      if (Math.abs(x - tc) <= half * 1.05 * f + 0.5) {
        const lit = x > tc - 1 ? 0.75 : 0.15;
        const col = lit > 0.5 ? [0.66, 0.6, 0.72] : [0.3, 0.3, 0.5];
        return { fam: 'slate', col, lit, ang: PI / 2, layer: 3, ch: 'vil', fine: 1 };
      }
    }
    if (x >= CH.x0 && x <= CH.x1 && y >= CH.rt && y <= CH.gy) {
      if (y < CH.wt) {
        const f = (y - CH.rt) / (CH.wt - CH.rt);
        return { fam: 'slate', col: f < 0.4 ? [0.62, 0.6, 0.72] : [0.46, 0.46, 0.62], lit: 0.6, ang: 0.1, layer: 3, ch: 'vil', fine: 1 };
      }
      return { fam: 'wall', col: x > CH.x1 - 22 ? [0.68, 0.66, 0.8] : [0.96, 0.9, 0.8], lit: 0.8, ang: 0, layer: 3, ch: 'vil', fine: 1 };
    }
    return null;
  }
  function houseAt(h, x, y) {
    const w = h.x1 - h.x0, cx = (h.x0 + h.x1) / 2;
    if (x < h.x0 - 1 || x > h.x1 + 1 || y < h.rt || y > h.gy) return null;
    const S = (fam, col, lit, ang) => ({ fam, col: hazeV(col), lit, ang, layer: 3, ch: 'vil', fine: 1 });
    const tile = h.slate ? [[0.62, 0.62, 0.74], [0.4, 0.42, 0.6]] : [[0.92, 0.52, 0.36], [0.66, 0.32, 0.32]];
    const rf = h.slate ? 'slate' : 'roof';
    if (y < h.wt) {
      const f = (y - h.rt) / (h.wt - h.rt); // 0 ridge .. 1 eaves
      if (h.roof === 'gable') { // gable end toward us: a wall triangle edged with roof
        const half = w * 0.5 * f;
        if (Math.abs(x - cx) > half + 1.6) return null;
        if (Math.abs(x - cx) > half - 2.2) return S(rf, x < cx ? tile[1] : tile[0], 0.5, x < cx ? -0.7 : 0.7);
        const shade = x < h.x0 + h.side * w;
        return S('wall', shade ? [0.58, 0.58, 0.8] : h.wallC, shade ? 0.2 : 0.85, PI / 2);
      }
      const half = h.roof === 'hip' ? w * 0.5 * (0.45 + 0.6 * f) : w * 0.5 * (0.88 + 0.14 * f);
      if (Math.abs(x - cx) > half) return null;
      const dark = h.roofShade || (h.roof === 'hip' && x < cx - 0.35 * half * (1 - f) - 0.25 * half);
      const c = dark ? mix3(tile[1], [0.36, 0.3, 0.52], 0.35) : mix3(tile[0], tile[1], 0.6 * f);
      return S(rf, c, dark ? 0.25 : 0.75, 0.05);
    }
    const shade = x < h.x0 + h.side * w;
    if (h.win && !shade && y > h.wt + 0.3 * (h.gy - h.wt) && y < h.wt + 0.6 * (h.gy - h.wt) && ((x - h.x0) % 11) > 7.5)
      return S('slate', [0.36, 0.36, 0.52], 0.2, PI / 2); // a shuttered window
    return S('wall', shade ? [0.58, 0.58, 0.8] : h.wallC, shade ? 0.2 : 0.85, PI / 2);
  }
  function vTreeAt(t, x, y) {
    const dx = (x - t.cx) / t.rx, dy = (y - t.cy) / t.ry;
    if (dx * dx + dy * dy > 1 + 0.35 * (R.vnoise(x / 4, y / 4, 61 + t.s) - 0.5)) {
      // trunk
      if (Math.abs(x - t.cx) < 1.4 && y > t.cy && y <= t.gy) return { fam: 'trunk', col: [0.3, 0.26, 0.36], lit: 0.3, ang: PI / 2, layer: 3, ch: 'vil', fine: 1 };
      return null;
    }
    const lit = clamp(0.5 + 0.5 * dx - 0.45 * dy + 0.3 * (R.vnoise(x / 5, y / 5, 63) - 0.5), 0, 1);
    return { fam: 'fartree', col: hazeV(mix3([0.18, 0.26, 0.38], [0.56, 0.64, 0.4], lit)), lit, ang: PI / 2, layer: 3, ch: 'vil', fine: 1 };
  }
  function villageAt(x, y) {
    if (x < 1440 || x > 2100 || y < CH.st - 2 || y > 1312) return null;
    for (const it of VIL) {
      const r = it.kind === 'house' ? houseAt(it, x, y) : it.kind === 'tree' ? vTreeAt(it, x, y) : churchAt(x, y);
      if (r) return r;
    }
    return null;
  }
  function woodAt(x, y) {
    const top = woodTop(x);
    if (y < top || y > YH + 6) return null;
    const lit = clamp(0.45 + 0.6 * (R.fbm(x / 22, y / 14, 57, 3) - 0.5) + 0.25 * sstep(top + 14, top, y), 0, 1);
    const behindVillage = sstep(1420, 1500, x) * sstep(2100, 2020, x);
    let col = mix3([0.3, 0.36, 0.5], [0.56, 0.64, 0.6], lit);
    col = mix3(col, [0.2, 0.28, 0.36], 0.55 * behindVillage);
    const sh = mul3(col, 0.78);
    return { fam: 'fartree', col, col2: sh, lit, ang: PI / 2 + 0.3 * (R.vnoise(x / 9, y / 9, 3) - 0.5), layer: 2, ch: 'far', shadowable: 1, fine: 3 };
  }

  // ---------- land ---------------------------------------------------------------------------------------------
  const FIELD_COLS = [[0.9, 0.84, 0.52], [0.66, 0.76, 0.44], [0.86, 0.76, 0.58], [0.58, 0.7, 0.5], [0.8, 0.8, 0.46], [0.92, 0.8, 0.62]];
  function farFields(x, y, d) {
    // fields laid out on the ground plane: lateral X and depth Z from screen position
    const dz = y - YH + 6;
    const X = (x - 1400) / dz, Z = 600 / dz;
    const fx = X * 0.42 + 0.6 * R.vnoise(Z * 0.3, 1, 71), fz = Z * 0.11 + 0.4 * R.vnoise(X * 0.2, 2, 73);
    const ix = Math.floor(fx), iz = Math.floor(fz);
    let col = FIELD_COLS[(R.hash2(ix, iz, 75) * FIELD_COLS.length) | 0];
    const hedge = Math.min(Math.abs(fx - ix - 0.5), Math.abs(fz - iz - 0.5)) > 0.47;
    let lit = 0.85;
    if (hedge) { col = [0.28, 0.38, 0.32]; lit = 0.3; }
    col = mix3(col, [0.84, 0.86, 0.86], 0.35 * sstep(70, 0, dz)); // haze at the horizon
    return { col, lit };
  }
  function shadowOf(col) { // the same ground under a passing cloud: lower, cooler, bluer
    return [col[0] * 0.66, col[1] * 0.72, col[2] * 0.86 + 0.06];
  }
  // cloud shadows sweep the far land; their effect fades out toward the middle distance (no hard line)
  const CS_FULL = YH + 140, CS_END = YH + 330;
  function withCloudShadow(o, y) {
    if (y >= CS_END) return o;
    o.shadowable = 1;
    o.col2 = mix3(o.col, shadowOf(o.col), sstep(CS_END, CS_FULL, y));
    return o;
  }
  function landBeyond(x, y) { // between the horizon and the far bank strip
    const d = (y - YH) / (H - YH);
    const ff = farFields(x, y, d);
    let col = ff.col, lit = ff.lit;
    // fade from patchwork to meadow as it comes closer (toward the towpath)
    const near = sstep(20, 140, y - YH);
    if (near > 0) {
      const g = mix3([0.62, 0.72, 0.36], [0.74, 0.76, 0.42], R.fbm(x / 90, y / 25, 81, 3));
      col = mix3(col, g, near * 0.85);
    }
    // round copses on the far meadow, behind the poplar row
    const cp = R.fbm(x / 50, y / 16, 83, 3);
    if (cp > 0.66 && y < YH + 120) {
      const l = clamp((cp - 0.66) * 4, 0, 1);
      col = mix3(col, [0.22, 0.32, 0.28], l * 0.8); lit = mix(lit, 0.25, l);
    }
    const sh = treeShadow(x, y);
    if (sh > 0) { col = mix3(col, [0.12, 0.16, 0.3], sh * 0.75); lit = mix(lit, 0.15, sh); }
    return withCloudShadow({ fam: 'field', col, lit, ang: 0.08 * (R.vnoise(x / 40, y / 40, 5) - 0.5), layer: 2, ch: 'land' }, y);
  }
  function farBankAt(x, y) {
    const g = bank(x);
    const yTow = g.yb - g.bw, yVer = yTow - g.tw, yTop = yVer - g.vw, ye = yEdge(x);
    if (y < yTop || y > ye + 0.5) return null;
    const sh = treeShadow(x, y);
    let col, lit, fam;
    const n = R.fbm(x / 14, y / 6, 91, 3);
    // clumps of reeds and rank grass at the water's edge, rising over the bank face
    const clump = sstep(0.58, 0.72, R.fbm(x / 70, 4.2, 187, 2));
    const reedH = clump * (5 + 0.12 * g.d) * (0.6 + 0.6 * R.vnoise(x / 6, 1.1, 189));
    if (reedH > 2 && y > ye - reedH) {
      const stalk = R.vnoise(x / 2.6, y / 30, 191);
      const lit2 = clamp(0.25 + 0.6 * stalk + 0.3 * sstep(ye - 0.3 * reedH, ye - reedH, y), 0, 1);
      let c = mix3([0.12, 0.2, 0.14], [0.66, 0.7, 0.34], lit2);
      if (R.vnoise(x / 9, 7.7, 193) > 0.72) c = mix3(c, [0.72, 0.56, 0.32], 0.5); // a few dry, ochre blades
      c = mix3(c, [0.06, 0.12, 0.18], 0.7 * sh);
      return { fam: lit2 < 0.4 ? 'bank' : 'meadow', col: aerial(c, 0.45 * sstep(260, 30, g.d)), lit: lit2, ang: PI / 2 + 0.25 * (R.vnoise(x / 5, 3.3, 195) - 0.5), layer: 3, ch: 'land' };
    }
    if (y >= yTow) { // grassy bank sloping to the water, lit from above, darker at its foot
      const f = clamp((y - yTow) / Math.max(1, ye - yTow), 0, 1);
      col = mix3([0.5, 0.62, 0.26], [0.14, 0.22, 0.14], sstep(0.3, 1.0, f));
      col = mix3(col, [0.62, 0.48, 0.32], 0.25 * (n > 0.6 ? 1 : 0));
      lit = 0.6 - 0.4 * f; fam = 'bank';
    } else if (y >= yVer) { // the towpath: pale, warm, sun-baked
      col = mix3([0.95, 0.84, 0.66], [0.9, 0.74, 0.6], n);
      lit = 0.9; fam = 'towpath';
    } else { // grass verge under the trees
      col = mix3([0.5, 0.62, 0.26], [0.66, 0.7, 0.32], n);
      lit = 0.75; fam = 'meadow';
    }
    if (sh > 0) {
      const dark = fam === 'towpath' ? [0.2, 0.18, 0.36] : [0.06, 0.12, 0.16];
      col = mix3(col, dark, sh * 0.88); lit = mix(lit, 0.1, sh);
      if (fam === 'towpath' && sh > 0.45) fam = 'towpathShade';
    }
    // aerial perspective toward the far end of the row
    col = aerial(col, 0.45 * sstep(260, 30, g.d));
    return { fam, col, lit, ang: 0.04 * (n - 0.5), layer: 3, ch: 'land' };
  }

  // the boat moored at the far bank, and the walker with a parasol on the towpath
  const BOAT = { x: 716, y: 0, len: 128, ang: -0.09 };
  BOAT.y = yFB(BOAT.x) + 22;
  function boatAt(x, y) {
    const c = Math.cos(BOAT.ang), s = Math.sin(BOAT.ang);
    const dx = x - BOAT.x, dy = y - BOAT.y;
    const u = (dx * c + dy * s) / (BOAT.len / 2), v = -dx * s + dy * c; // v px, + downward
    const au = Math.abs(u);
    if (au > 1.04) return null;
    const g = -7 - 7 * u * u;                                   // near gunwale, rising to bow and stern
    const w = 7 * (1 - Math.pow(au, 2.4)) + 1;                  // waterline
    const top = g - 13 * Math.pow(Math.max(0, 1 - u * u), 0.75); // far gunwale: the open boat seen from a little above
    if (v < top - 1.5 || v > w) return null;
    if (au > 0.9 && v > g + (w - g) * (1 - (au - 0.9) * 7)) return null; // the stem rakes in
    let col, lit;
    if (v < top + 2.2) { col = [0.22, 0.36, 0.66]; lit = 0.5; }                              // far gunwale rail
    else if (v < g - 1.5) {                                                                // the inside: warm wood
      const thwart = Math.abs(u - 0.32) < 0.05 || Math.abs(u + 0.28) < 0.05;
      const f = (v - top) / Math.max(1, g - top);
      col = thwart ? [0.5, 0.26, 0.16] : mix3([0.86, 0.52, 0.28], [0.58, 0.3, 0.2], f); lit = 0.6;
    } else if (v < g + 2.2) { col = [0.2, 0.34, 0.66]; lit = 0.5; }                      // near gunwale strake, blue
    else { const f = (v - g) / Math.max(1, w - g); col = mix3([0.98, 0.96, 0.9], [0.6, 0.63, 0.8], sstep(0.25, 1.0, f)); lit = 0.9 - 0.6 * f; }
    return { fam: 'boat', col, lit, ang: BOAT.ang, layer: 6, ch: 'obj', fine: 2 };
  }
  const FIG = { x: 803, y: 0 };
  { const g = bank(FIG.x); FIG.y = g.yb - g.bw - 0.45 * g.tw; }
  function figureAt(x, y) {
    const fx = FIG.x, fy = FIG.y;
    if (x < fx - 34 || x > fx + 26 || y < fy - 92 || y > fy + 2) return null;
    // parasol: a shallow dome tipped toward the sun
    const pcx = fx - 7, pcy = fy - 70, pr = 21;
    const pdx = (x - pcx) / pr, pdy = (y - pcy) / (pr * 0.55);
    if (pdx * pdx + pdy * pdy < 1 && y < pcy + 4) {
      const lit = clamp(0.55 + 0.5 * pdx - 0.3 * pdy, 0, 1);
      return { fam: 'parasol', col: mix3([0.62, 0.16, 0.24], [0.98, 0.46, 0.2], lit), lit, ang: 0, layer: 7, ch: 'obj', fine: 2 };
    }
    // head
    const hx = fx, hy = fy - 56;
    if ((x - hx) * (x - hx) + (y - hy) * (y - hy) * 0.8 < 30) return { fam: 'figure', col: [0.78, 0.56, 0.44], lit: 0.6, ang: PI / 2, layer: 7, ch: 'obj', fine: 2 };
    // dress: narrow bodice to a bell skirt
    if (y > fy - 51 && y <= fy) {
      const f = (y - (fy - 51)) / 51;
      const half = 3.6 + 9.5 * Math.pow(f, 1.4);
      if (Math.abs(x - fx) < half) {
        const u = (x - fx) / half;
        const lit = clamp(0.3 + 0.7 * sstep(-0.6, 0.6, u), 0, 1);
        return { fam: 'figure', col: mix3([0.6, 0.62, 0.8], [1.0, 0.97, 0.9], lit), lit, ang: PI / 2, layer: 7, ch: 'obj', fine: 2 };
      }
    }
    return null;
  }

  // haystacks in the meadow on the near side, right
  const HAY = [ // shape: profile power (high = rounded loaf), fullness, lean
    { x: 1606, y: 1396, w: 50, h: 44, pa: 1.9, pb: 0.5, lean: 0.04 }, { x: 1712, y: 1436, w: 88, h: 70, pa: 3.2, pb: 0.4, lean: -0.05 },
    { x: 1562, y: 1486, w: 100, h: 100, pa: 1.35, pb: 0.68, lean: 0.06 },
  ];
  function hayAt(x, y) {
    for (let i = HAY.length - 1; i >= 0; i--) {
      const s = HAY[i];
      const v = (s.y - y) / s.h; // 0 ground .. 1 top
      if (v < -0.02 || v > 1.05) continue;
      const prof = Math.pow(Math.max(0, 1 - Math.pow(Math.max(v, 0), s.pa)), s.pb) * (1 + 0.12 * Math.sin(v * 3.1));
      const half = 0.5 * s.w * prof * (1 + 0.08 * (R.vnoise(y / 4, i, 97) - 0.5));
      const u = (x - s.x - s.lean * s.w * v) / Math.max(half, 0.1);
      if (Math.abs(u) > 1) continue;
      const nz = Math.sqrt(Math.max(0, 1 - u * u));
      // sun from the right and high: a warm lit flank, a cool violet-blue shade flank, the straw in loose streaks
      const straw = R.fbm(x / 5 + u * 3, y / 14, 99 + i, 3) - 0.5;
      let lit = clamp(0.18 + 0.82 * sstep(-0.4, 0.7, u * 0.95 + 0.4 * v + 0.12 * nz) + 0.3 * straw - 0.25 * sstep(0.12, 0.0, v), 0, 1);
      const col = lit < 0.45 ? mix3([0.34, 0.32, 0.6], [0.62, 0.48, 0.52], lit / 0.45) : mix3([0.86, 0.6, 0.34], [1.0, 0.86, 0.44], (lit - 0.45) / 0.55);
      return withCloudShadow({ fam: lit < 0.42 ? 'hayShade' : 'hay', col, lit, ang: PI / 2 - 1.1 * u * (1 - 0.5 * v), layer: 7, ch: 'obj', fine: 4 }, y);
    }
    return null;
  }
  function hayShadow(x, y) {
    let sh = 0;
    for (const s of HAY) {
      const dx = (x - (s.x - 0.48 * s.w)) / (0.68 * s.w), dy = (y - (s.y - 0.05 * s.h)) / (0.17 * s.h + 2);
      sh = Math.max(sh, sstep(1.05, 0.35, dx * dx + dy * dy + 0.3 * (R.vnoise(x / 6, y / 5, 341) - 0.5)));
    }
    return sh;
  }

  // the shade of trees behind us falls across the near meadow, with sun flecks through the leaves
  function foreShadow(x, y) {
    const edge = 2470 - 170 * sstep(1500, 2160, x) + 150 * (R.fbm(x / 190, 3, 131, 3) - 0.5) + 70 * Math.pow(R.vnoise(x / 70, 5, 135), 2) + 34 * (R.fbm(x / 40, 7, 133, 2) - 0.5);
    let s = sstep(edge - 18, edge + 18, y);
    const fleck = R.fbm(x / 34, y / 22, 137, 3);
    s *= 1 - 0.95 * sstep(0.62, 0.7, fleck) * sstep(edge + 60, edge + 160, y);
    return s;
  }
  function rightLand(x, y) {
    const d = (y - YH) / (H - YH);
    let col, lit = 0.85, fam = 'meadow';
    const out0 = {};
    if (y < YH + 135) {
      const ff = farFields(x, y, d);
      col = ff.col; lit = ff.lit; fam = 'field';
      const toMeadow = sstep(60, 135, y - YH);
      if (toMeadow > 0) col = mix3(col, [0.6, 0.68, 0.4], toMeadow);
    } else {
      const n1 = R.fbm(x / 220, y / 90, 101, 4), n2 = R.fbm(x / 45, y / 22, 103, 3);
      const sun = [0.6, 0.7, 0.3], warm = [0.84, 0.78, 0.42], cool = [0.28, 0.46, 0.33];
      col = mix3(cool, sun, sstep(0.28, 0.62, n1));
      col = mix3(col, warm, 0.7 * sstep(0.5, 0.72, n2) * sstep(0.3, 0.6, n1));
      lit = 0.45 + 0.5 * sstep(0.28, 0.62, n1);
      // grass tufts throw small shadows nearer to us
      const tuft = R.fbm(x / (10 + 30 * d), y / (6 + 20 * d), 107, 3);
      if (tuft < 0.36) { const k = sstep(0.36, 0.22, tuft) * sstep(0.15, 0.5, d); col = mix3(col, [0.1, 0.22, 0.14], 0.7 * k); lit = mix(lit, 0.2, k); }
      // the bank drops to the water: a shadowed lip
      const e = x - xEdge(y);
      const lip = 8 + 70 * d;
      if (e < lip) { const k = sstep(lip, 0, e); col = mix3(col, [0.16, 0.24, 0.16], 0.85 * k); lit = mix(lit, 0.2, k); }
      col = aerial(col, 0.38 * sstep(0.42, 0.03, d));
    }
    const fs = foreShadow(x, y);
    if (fs > 0) {
      // shade under trees behind us: deep but alive, tufts catching sky light, darker hollows
      const t2 = R.fbm(x / 26, y / 15, 141, 3), t3 = R.vnoise(x / 90, y / 50, 143);
      const sc = mix3([0.03, 0.08, 0.14], [0.1, 0.24, 0.2], sstep(0.35, 0.7, t2));
      col = mix3(col, mix3(sc, [0.08, 0.1, 0.22], 0.4 * t3), 0.88 * fs); lit = mix(lit, 0.06 + 0.2 * t2, fs);
      if (fs > 0.5) fam = 'meadowShade';
    }
    const ws = willowShadow(x, y);
    if (ws > 0) { col = mix3(col, mix3([0.1, 0.18, 0.3], [0.14, 0.26, 0.24], R.fbm(x / 20, y / 12, 323, 2)), 0.78 * ws); lit = mix(lit, 0.12, ws); if (ws > 0.5) fam = 'meadowShade'; }
    const hs = hayShadow(x, y);
    if (hs > 0) { col = mix3(col, [0.14, 0.16, 0.36], 0.85 * hs); lit = mix(lit, 0.1, hs); }
    const out = { fam, col, lit, ang: (d > 0.12 ? PI / 2 : 0) + 0.5 * (R.vnoise(x / 30, y / 30, 109) - 0.5) * sstep(0.1, 0.4, d), layer: 5, ch: 'land' };
    if (d > 0.3) out.grass = 1;
    return withCloudShadow(out, y);
  }

  // wildflowers in the near meadow: poppies, ox-eye daisies, buttercups, a few cornflowers
  function flowerAt(x, y) {
    const d = (y - YH) / (H - YH);
    if (d < 0.32 || y >= yFB(x) && x < xEdge(y) + 30) return null;
    const patch = R.fbm(x / 160, y / 90, 151, 3);
    const n = R.hash2(Math.floor(x / 3), Math.floor(y / 3), 153);
    const dens = sstep(0.5, 0.72, patch) * sstep(0.32, 0.55, d);
    if (n > 0.5 * dens) return null;
    const kind = R.fbm(x / 70, y / 50, 157, 2);
    const shade = Math.max(foreShadow(x, y), willowShadow(x, y));
    const p = kind < 0.42 ? 'VER' : kind < 0.55 ? 'OR' : kind < 0.72 ? 'W' : kind < 0.88 ? 'CYL' : 'COB';
    return { p, shade };
  }

  // ---------- water --------------------------------------------------------------------------------------------
  // what the river mirrors at water point (x,y): tall things on the far bank mirror about their own waterline,
  // the sky and the horizon mirror about the horizon (flat water, eye a little above it)
  function above(x, y, yb, bankH) {
    const ym = yb - bankH * 0.5 - (y - yb);
    const p = poplarAt(x, ym);
    if (p) return p.col;
    if (y - yb < bankH * 1.3) return [0.16, 0.26, 0.14]; // the shaded face of the bank
    const ys = 2 * YH - y;
    const v = villageAt(x, ys); if (v) return v.col;
    const wd = woodAt(x, ys); if (wd) return wd.col;
    return skyAt(x, ys).col;
  }
  function waterAt(x, y, variant) {
    const yb = yFB(x);
    const d = (y - YH) / (H - YH);
    const depthBelow = y - yb;
    const sd = variant ? 211 : 0;
    // ripples: horizontal bands that displace and break the reflection, wider nearer to us
    const band = 3 + 22 * d;
    const rx = (R.fbm(x / (120 + 200 * d), y / band, 201 + sd, 3) - 0.5) * (6 + 46 * d);
    const ry = (R.fbm(x / 300, y / (band * 1.3), 203 + sd, 2) - 0.5) * (2 + 16 * d);
    const bankH = bank(x).bw;
    let refl = above(x + rx, y + ry, yb, bankH);
    // the boat and its reflection
    const bm = boatAt(x, 2 * (BOAT.y + 6) - y);
    if (bm && y > BOAT.y + 5) refl = mul3(bm.col, 0.78);
    const body = mix3([0.12, 0.24, 0.24], [0.1, 0.2, 0.22], d);
    const fres = 0.9 - 0.32 * sstep(0.05, 1.0, d);
    let col = mix3(body, mul3(refl, 0.92), fres);
    // the dark line under the bank where the reflection of the shaded bank lies
    const edge = sstep(bankH * 1.6 + 3, 0, y - yEdge(x));
    col = mix3(col, [0.08, 0.14, 0.14], 0.6 * edge);
    // wind ripples nearer to us: horizontal bands whose facets tilt up and catch more of the sky
    const rf = R.fbm(x / 300, y / (7 + 9 * d), 221 + sd, 3), near = sstep(0.2, 0.7, d);
    const rip = near * sstep(0.56, 0.78, rf), trough = near * sstep(0.42, 0.25, rf);
    if (rip > 0) col = mix3(col, [0.62, 0.74, 0.92], 0.6 * rip);
    if (trough > 0) col = mul3(col, 1 - 0.2 * trough);
    const L = lum(col);
    return { fam: L < 0.22 ? 'waterDark' : 'water', col, lit: clamp(L * 1.4, 0, 1), ang: 0.05 * (R.vnoise(x / 50, y / 20, 207) - 0.5), layer: 4, ch: 'water', water: 1, refl: L };
  }

  // ---------- the scene (everything but the poplars) ------------------------------------------------------------
  function sceneAt(x, y, noWater) {
    if (y < 1313) {
      const v = villageAt(x, y);
      if (v) return v;
    }
    if (y < YH + 6) {
      const wd = woodAt(x, y);
      if (wd) return wd;
      if (y < YH) return skyAt(x, y);
    }
    if (y >= yEdge(x) && y >= RIVER_TOP) {
      const hay = hayAt(x, y);
      if (hay) return hay;
      if (x >= xEdge(y) + 1.5 * (R.vnoise(x / 6, y / 6, 113) - 0.5) * (2 + 6 * (y - YH) / (H - YH)) || noWater) return rightLand(x, y);
      if (!noWater) {
        const f = figureAt(x, y); if (f) return f;
        const b = boatAt(x, y); if (b) return b;
      }
      return waterAt(x, y, 0);
    }
    if (!noWater) {
      const f = figureAt(x, y); if (f) return f;
    }
    const fb = farBankAt(x, y);
    if (fb) return fb;
    return landBeyond(x, y);
  }

  // dab size (px on the master canvas) for a sample at (x,y): smaller toward the horizon
  function dabSize(s, x, y) {
    if (s.fine === 2) return 2.9;
    if (s.fine === 1) return 3.7;
    if (s.fine === 3) return 4.6;
    if (s.fine === 4) return 6.2;
    if (y < YH) return mix(11.5, 7.5, sstep(200, YH, y));
    const d = (y - YH) / (H - YH);
    let z = mix(5.2, 17, Math.pow(d, 0.72));
    if (s.water) z *= 1.0;
    return z;
  }

  G.SCENE = { W, H, B, YH, sceneAt, flowerAt, waterAt, poplarAt, willowAt, WILLOWS, insideCrownBy, TREES, CLOUDS, yFB, xNB, bank, dabSize, treeFar, crownGeom, FIG, BOAT, HAY, sstep, clamp, mix, mix3, lum, aerial };
})(window);
