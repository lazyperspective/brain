// Phosphor: the beam program. build(t) returns the XY "display list" at time t: an ordered list of strokes the
// single electron beam traces, in drawing units (x right, y up, 1 = radius of the visible screen). The renderer
// inserts the retrace jumps between strokes and converts beam dwell (1/speed) into deposited energy.
//
// Stroke: { pts:[[x,y],...], b: brightness (energy per unit length, ~1/beam speed), ta/tb: taper lengths at the
//           start/end (the beam accelerates there, so the line thins and fades like a brush stroke),
//           tmin: weight left at the very tip, slot: fixed energy (for figures whose length swings, e.g. the
//           lighthouse beams, so that the rest of the drawing does not dim when they lengthen), prof: optional
//           per-point weight function of arc-length fraction, hidden: true if it runs behind the bezel }
(function () {
  const PH = window.PH;
  const { TAU, catmull, clamp, smooth, lerp } = PH;
  const D = 18; // loop length (s)
  const LAP = 9; // the bright head (camera/refresh beat) laps the whole display list every 9 s
  const YH = -0.03; // horizon
  const LAMP = [0.42, 0.523];

  const S = (x) => Math.sin(x), C = (x) => Math.cos(x);
  const w = (t, n) => (TAU * n * t) / D; // phase for n whole cycles per loop

  function line(pts, o) { return Object.assign({ pts, b: 1, ta: 0, tb: 0, tmin: 0.25 }, o || {}); }
  const rev = (a) => a.slice().reverse();

  // ---------------------------------------------------------------- gulls
  // a gliding gull: one M-shaped stroke, wing tips tapered, body slightly heavier
  function gull(cx, cy, span, flex, bank, dir) {
    const s = span / 2;
    // right half-wing (body at origin): up to the wrist, then a long slightly drooping hand to the tip
    const half = (sg) => {
      const lift = 1 + 0.25 * bank * sg;
      return [[0.0, 0.0], [0.09, 0.075 * lift], [0.22, 0.165 * lift + 0.03 * flex], [0.36, 0.205 * lift + 0.05 * flex],
        [0.55, 0.19 * lift + 0.04 * flex], [0.78, 0.12 * lift + 0.02 * flex], [1.0, 0.035 + 0.05 * flex - 0.04 * bank * sg]];
    };
    const R = half(1), L = half(-1).map(([x, y]) => [-x, y]).reverse();
    const p = L.concat([[0, -0.035]], R.slice(1));
    const r = 0.16 * bank, cr = Math.cos(r), sr = Math.sin(r);
    let pts = catmull(p.map(([x, y]) => [cx + s * (x * cr - y * sr), cy + s * (x * sr + y * cr)]), 8);
    if (dir < 0) pts = rev(pts);
    return line(pts, { b: 0.62, jb: 0.0035, ta: span * 0.3, tb: span * 0.3, tmin: 0.1, prof: (f) => 1 + 0.6 * Math.exp(-Math.pow((f - 0.5) / 0.06, 2)) });
  }
  function gulls(t) {
    const out = [];
    const G = [
      // cx, cy, span, loop radius x/y, phase, flex cycles, bank amplitude
      [-0.60, 0.40, 0.150, 0.035, 0.016, 0.0, 3, 0.5],
      [-0.36, 0.56, 0.112, 0.03, 0.015, 2.1, 4, 0.45],
      [-0.17, 0.37, 0.086, 0.026, 0.013, 4.0, 3, 0.4],
    ];
    G.forEach((g, i) => {
      const ph = w(t, 1) + g[5];
      const cx = g[0] + g[3] * C(ph), cy = g[1] + g[4] * S(ph);
      const flex = 0.5 + 0.5 * S(w(t, g[6]) + g[5] * 1.7);
      const bank = g[7] * S(ph); // banks with the turn of its slow circle
      out.push(gull(cx, cy, g[2], flex, bank, i % 2 ? -1 : 1));
    });
    return out;
  }

  // ---------------------------------------------------------------- headland, lighthouse, cottage
  const FACE = [
    [0.064, -0.426], [0.092, -0.37], [0.087, -0.31], [0.112, -0.245], [0.108, -0.18], [0.137, -0.11],
    [0.134, -0.06], [0.158, 0.0], [0.168, 0.058], [0.188, 0.094], [0.214, 0.108],
  ];
  const TOP_L = [[0.212, 0.108], [0.262, 0.119], [0.315, 0.127], [0.368, 0.133]];
  const tx = (y) => 0.034 + 0.018 * Math.pow(clamp((0.452 - y) / 0.319, 0, 1), 1.35); // tower half-width

  function lighthouse(t, beams) {
    const X = LAMP[0];
    const strokes = [];
    // cliff top from the corner to the tower foot
    strokes.push(line(catmull(TOP_L, 8), { b: 1.0, jb: 0.0035 }));
    // door: along the foot to the door, a small arch, back
    const left = [];
    for (let k = 0; k <= 30; k++) { const y = 0.133 + (0.452 - 0.133) * (k / 30); left.push([X - tx(y), y]); }
    // left wall up, with two painted bands drawn as quick hatching (fast beam: faint)
    const band = (y0, y1, n) => {
      const pts = [];
      for (let k = 0; k <= n; k++) {
        const y = lerp(y0, y1, k / n), hw = tx(y) * 0.98;
        pts.push([X + (k % 2 ? hw : -hw), y + (k % 2 ? -0.0015 : 0.0015)]);
      }
      return pts;
    };
    const seg = (y0, y1) => left.filter((p) => p[1] >= y0 - 1e-9 && p[1] <= y1 + 1e-9);
    strokes.push(line(seg(0.133, 0.19), { b: 1.05 }));
    strokes.push(line(band(0.19, 0.245, 14), { b: 0.13, tmin: 1, noCorner: true }));
    strokes.push(line(seg(0.245, 0.31), { b: 1.05 }));
    strokes.push(line(band(0.31, 0.365, 14), { b: 0.13, tmin: 1, noCorner: true }));
    strokes.push(line(seg(0.365, 0.452), { b: 1.05 }));
    // corbel out, railing, lantern
    const XL = X - 0.026, XR = X + 0.026, YB = 0.492, YT = 0.556;
    strokes.push(line(catmull([[X - tx(0.452), 0.452], [X - 0.050, 0.458], [X - 0.057, 0.463]], 6), { b: 1.1 }));
    strokes.push(line([[X - 0.057, 0.463], [X - 0.056, 0.478], [X - 0.055, YB]], { b: 0.9 }));
    strokes.push(line([[X - 0.055, YB], [XL, YB]], { b: 0.9 }));
    strokes.push(line([[XL, YB], [XL, YT]], { b: 1.0 }));
    // eave and dome with its finial
    const dome = [];
    for (let k = 0; k <= 24; k++) { const a = Math.PI - (Math.PI * k) / 24; dome.push([X + 0.029 * Math.cos(a), YT + 0.003 + 0.028 * Math.sin(a)]); }
    strokes.push(line([[XL, YT], [XL - 0.004, YT + 0.003]].concat(dome.slice(0, 13)), { b: 1.05 }));
    strokes.push(line([[X, YT + 0.031], [X, YT + 0.047], [X + 0.0035, YT + 0.052], [X, YT + 0.057], [X - 0.0035, YT + 0.052], [X, YT + 0.047]], { b: 0.8 }));
    strokes.push(line(dome.slice(12).concat([[XR + 0.004, YT + 0.003], [XR, YT]]), { b: 1.05 }));
    strokes.push(line([[XR, YT], [XR, YB]], { b: 1.0 }));
    // lantern floor to the centre, the lamp pedestal, the lamp, the beams
    strokes.push(line([[XR, YB], [X, YB]], { b: 0.55 }));
    strokes.push(line([[X, YB], [X, LAMP[1] - 0.006]], { b: 0.5 }));
    beams.forEach((s) => strokes.push(s));
    strokes.push(line([[X, LAMP[1] - 0.006], [X, YB]], { b: 0.5 }));
    strokes.push(line([[X, YB], [XR, YB]], { b: 0.55 }));
    strokes.push(line([[XR, YB], [X + 0.055, YB]], { b: 0.9 }));
    strokes.push(line([[X + 0.055, YB], [X + 0.056, 0.478], [X + 0.057, 0.463]], { b: 0.9 }));
    strokes.push(line(catmull([[X + 0.057, 0.463], [X + 0.050, 0.458], [X + tx(0.452), 0.452]], 6), { b: 1.1 }));
    const right = rev(left).map(([x, y]) => [2 * X - x, y]);
    strokes.push(line(right, { b: 1.05 }));
    // ground, the keeper's cottage, ground out to the edge of the screen and behind the bezel
    strokes.push(line([[X + tx(0.133), 0.134], [0.503, 0.134]], { b: 1.0 }));
    strokes.push(line([[0.503, 0.134], [0.503, 0.167], [0.497, 0.166], [0.546, 0.2], [0.595, 0.166], [0.589, 0.167], [0.589, 0.132]], { b: 1.0 }));
    strokes.push(line(catmull([[0.589, 0.132], [0.64, 0.128], [0.72, 0.12], [0.80, 0.108], [0.88, 0.09], [0.95, 0.07], [1.05, 0.05]], 10), { b: 1.0 }));
    return strokes;
  }

  // the lighthouse beams: two opposed cones turning once per loop, drawn in perspective as fast fans of rays
  function beamFans(t) {
    const ZL = 2.0, XL = LAMP[0] * ZL, YL = (LAMP[1] - YH) * ZL;
    const th0 = w(t, 1) + 2.35;
    const fans = [];
    for (const off of [0, Math.PI]) {
      const th = th0 + off;
      const pts = [];
      const deltas = []; for (let k = 0; k < 22; k++) deltas.push(-0.055 + (0.11 * k) / 21);
      deltas.forEach((dl, k) => {
        const a = th + dl, dx = Math.cos(a), dz = -Math.sin(a); // dz < 0: away from the camera
        let smax = 5.5;
        if (dz > 0) smax = Math.min(smax, 0.16 / dz); // toward the camera: the beam foreshortens into a flare
        const ray = [];
        const n = 40;
        for (let i = 0; i <= n; i++) {
          const s = 0.012 + (smax - 0.012) * Math.pow(i / n, 1.6);
          const X = XL + s * dx, Y = YL, Zd = ZL - s * dz;
          ray.push([X / Zd, YH + Y / Zd, s]);
        }
        (k % 2 ? rev(ray) : ray).forEach((p) => pts.push(p));
      });
      const P = pts.map((p) => [p[0], p[1]]);
      const sArr = pts.map((p) => p[2]);
      // over the land the beam passes behind the headland's skyline: let it fade there
      const occl = (p) => (p[0] < 0.17 ? 1 : smooth(0.0, 0.035, p[1] - interp(GROUND, Math.min(1.05, Math.max(0.212, p[0])), 0, 1) - 0.004));
      fans.push(line(P, { b: 1, slot: 0.34, tmin: 1, noCorner: true, profPts: sArr.map((s, i) => Math.max(0.03, occl(P[i])) * Math.exp(-s / 1.7) * (0.25 + 0.75 * smooth(0, 0.08, s))) }));
    }
    // the lamp: the beam circles on the spot, dwelling (the brightest point of the drawing)
    const lamp = [];
    const r = 0.0028;
    for (let k = 0; k <= 48; k++) { const a = (TAU * k) / 16; lamp.push([LAMP[0] + r * Math.cos(a), LAMP[1] + r * 0.8 * Math.sin(a)]); }
    const lampStroke = line(lamp, { b: 1, slot: 0.8, tmin: 1, noCorner: true });
    return [lampStroke, fans[0], line([[LAMP[0], LAMP[1]]], { b: 1, slot: 0.0 }), fans[1]];
  }

  const WL = [[1.05, -0.395], [0.94, -0.393], [0.86, -0.4], [0.78, -0.398], [0.73, -0.372], [0.68, -0.366], [0.645, -0.398],
    [0.56, -0.405], [0.47, -0.402], [0.415, -0.38], [0.37, -0.378], [0.335, -0.408], [0.25, -0.412],
    [0.19, -0.41], [0.15, -0.388], [0.118, -0.39], [0.098, -0.414], [0.064, -0.426]];

  // piecewise-linear lookups of the headland's outline (for the hatching)
  const GROUND = [[0.212, 0.108], [0.262, 0.119], [0.315, 0.127], [0.368, 0.133], [0.472, 0.134], [0.503, 0.134], [0.589, 0.132],
    [0.64, 0.128], [0.72, 0.12], [0.80, 0.108], [0.88, 0.09], [0.95, 0.07], [1.05, 0.05]];
  function interp(tab, x, ix, iy) {
    for (let i = 0; i < tab.length - 1; i++) {
      const a = tab[i], b = tab[i + 1];
      if ((x - a[ix]) * (x - b[ix]) <= 0) { const f = (x - a[ix]) / (b[ix] - a[ix] || 1e-9); return a[iy] + (b[iy] - a[iy]) * f; }
    }
    return x < tab[0][ix] === tab[0][ix] < tab[tab.length - 1][ix] ? tab[0][iy] : tab[tab.length - 1][iy];
  }
  // cliff body: the rock is shaded by fast hatching, parallel to the face, drawn as one zig-zag from behind the
  // right bezel toward the face; brightest on the flank by the face, fading round the headland; ragged ends and
  // faint bands (the beam's speed wanders) suggest strata
  function cliffBody() {
    const s = [];
    s.push(line([[1.05, 0.05], [1.08, -0.2], [1.05, -0.35]], { hidden: true, b: 0.05 }));
    const rn = PH.rng(5);
    const lines = [];
    // lean follows the face near it and straightens round the headland; spacing opens out as the light fades
    const leanAt = (x) => lerp(0.27, 0.06, smooth(0.12, 0.8, x));
    const spAt = (x) => lerp(0.0105, 0.024, smooth(0.15, 0.95, x));
    for (let xb = 1.03, i = 0; xb > 0.07; i++) {
      const lean = leanAt(xb), bow = 0.012 * smooth(0.1, 0.5, xb) * (1 - smooth(0.6, 1.0, xb));
      const yb = interp(WL, xb, 0, 1) + 0.022 + 0.014 * rn();
      const X = (y) => xb + lean * (y - yb) + bow * Math.sin(Math.PI * clamp((y - yb) / 0.5, 0, 1));
      let yt = yb + 0.6;
      for (let it = 0; it < 4; it++) yt = interp(GROUND, Math.min(1.05, X(yt)), 0, 1) - 0.03 - 0.022 * rn();
      let y0 = yb;
      while (y0 < yt && X(y0) < interp(FACE, y0, 1, 0) + 0.013) y0 += 0.003;
      let y1 = yt;
      while (y1 > y0 && X(y1) < interp(FACE, y1, 1, 0) + 0.013) y1 -= 0.003;
      // ledges: some lines stop short, leaving a ragged lower edge
      if (rn() < 0.3) y0 += 0.02 + 0.08 * rn();
      if (y1 - y0 > 0.03) lines.push([xb, y0, y1, X]);
      xb -= spAt(xb) * (0.85 + 0.3 * rn());
    }
    lines.forEach(([xb, y0, y1, X], k) => {
      const seg = [];
      const n = Math.max(4, Math.ceil((y1 - y0) * 120));
      for (let m = 0; m <= n; m++) { const y = lerp(y0, y1, m / n); seg.push([X(y), y]); }
      if (k % 2) seg.reverse();
      const bx = X(lerp(y0, y1, 0.5));
      const bright = 0.02 + 0.17 * Math.exp(-Math.max(0, bx - 0.16) / 0.3);
      s.push(line(seg, { b: bright, tmin: 0.0, ta: 0.07, tb: 0.07, noCorner: true, jb: bright * 0.2,
        prof: (f) => { const y = lerp(y0, y1, k % 2 ? 1 - f : f); return 0.5 + 0.5 * smooth(-0.35, 0.55, PH.vnoise(y * 24, xb * 7, 9)); } }));
    });
    return s;
  }

  // ---------------------------------------------------------------- the sea
  const TB = 6; // a wave breaks on the rocks every 6 s (3 per loop)
  const Y0 = -0.43; // water level at the foot of the cliff
  const FOOT = [0.064, -0.426];
  function breaker(t) {
    const ph = ((t % TB) + TB) % TB / TB;
    // the crest runs in, rises, throws its lip and collapses into foam; it slides back out while the water is flat
    const xc = ph < 0.84 ? -0.30 + 0.33 * smooth(0, 0.68, ph) : lerp(0.03, -0.30, smooth(0.84, 1, ph));
    const h = 0.15 * smooth(0.0, 0.55, ph) * (1 - smooth(0.6, 0.8, ph)) + 0.004;
    const curl = smooth(0.28, 0.58, ph) * (1 - smooth(0.62, 0.78, ph));
    const surge = smooth(0.58, 0.7, ph) * (1 - smooth(0.72, 1.0, ph)); // white water after the impact
    // W1: from the calm water, up the long back of the wave, over the crest, the lip curling forward into a spiral
    const p1 = [];
    const back = 0.10 + 1.4 * h;
    const XL = -0.47;
    const nb = 46;
    for (let k = 0; k <= nb; k++) {
      const x = lerp(XL, xc, k / nb);
      const u = clamp((x - (xc - back)) / back, 0, 1);
      const y = Y0 + h * Math.pow(u, 2.3) + 0.003 * S(x * 31 + w(t, 3)) * (1 - u);
      p1.push([x, y]);
    }
    const R = 0.008 + 0.32 * h;
    const turn = 0.8 + 4.6 * curl;
    const ccx = xc + R * 0.15, ccy = Y0 + h - R;
    for (let k = 1; k <= 48; k++) {
      const f = k / 48, a = Math.PI / 2 - turn * f, rr = R * (1 - 0.8 * Math.pow(f, 0.8) * curl);
      p1.push([ccx + rr * Math.cos(a) * (1 + 0.25 * curl) + 0.25 * R * curl * f, ccy + rr * Math.sin(a) * (1 - 0.15 * curl * f)]);
    }
    // W2: the steep face under the lip, down into the trough and on to the rocks
    const fx = Math.min(xc + R * (1.05 + 0.35 * curl), 0.05), fy = Y0 + h * (0.55 - 0.15 * curl);
    const tx = Math.min(fx + 0.025 + 0.4 * h, 0.058);
    const w2 = catmull([[fx, fy], [fx + 0.004, Y0 + h * 0.3], [lerp(fx, tx, 0.5), Y0 + h * 0.05], [tx, Y0 - 0.004], [0.064, Y0 + 0.004]], 10);
    // spray: dwell points flung up the rocks after the impact, falling back into the foam
    const spray = [];
    const rr = PH.rng(77);
    const NS = 18;
    for (let i = 0; i < NS; i++) {
      const v = 0.32 + 0.42 * rr(), ang = 1.45 + 0.7 * rr(), launch = 0.6 + 0.07 * rr();
      const bx = -0.02 + 0.08 * rr();
      const rest = [-0.2 + 0.25 * (i / (NS - 1)), Y0 - 0.026 - 0.006 * rr()];
      const g = 1.6;
      const tf = (2 * v * Math.sin(ang)) / g; // seconds in the air (lands back at water level)
      const age = (((ph - launch) % 1) + 1) % 1 * TB;
      let x, y;
      if (age < tf) {
        // leaves the foam at its rest point, launched from the impact
        const k = smooth(0, 0.12, age);
        const fx0 = lerp(rest[0], bx, k), fy0 = lerp(rest[1], Y0, k);
        x = fx0 + v * Math.cos(ang) * age * 0.55; y = fy0 + v * Math.sin(ang) * age - 0.5 * g * age * age;
        y = Math.max(y, Y0 - 0.03);
      } else {
        // lands, then drifts back to its rest point in the foam
        const lx = bx + v * Math.cos(ang) * tf * 0.55, ly = Y0;
        const k = smooth(0, 0.6, (age - tf) / TB);
        x = lerp(lx, rest[0], k); y = lerp(ly, rest[1], k);
      }
      spray.push([x, y]);
    }
    // foam lace in front of the wave: an irregular cursive scribble, swelling after the impact
    const foam = [];
    const fr = 0.003 + 0.010 * surge;
    const rf = PH.rng(19);
    const lp = []; for (let k = 0; k < 24; k++) lp.push(0.5 + rf());
    for (let k = 0; k <= 220; k++) {
      const f = k / 220, x = lerp(0.055, -0.25 - 0.08 * surge, f);
      const env = Math.sin(Math.PI * Math.pow(f, 0.75));
      const li = Math.min(23, Math.floor(f * 24)), sz = lp[li] * (0.6 + 0.4 * S(f * 9 + w(t, 2)));
      const a = f * 40 + 2.0 * S(f * 13) + w(t, 2);
      foam.push([x + fr * env * sz * 1.4 * Math.sin(a), Y0 - 0.03 - 0.006 * f + fr * env * sz * Math.cos(a) + 0.004 * S(f * 7 + 1)]);
    }
    return { p1, w2, spray, foam, ph };
  }

  // the turning beam lights the swells beneath it: a patch of brighter crests that sweeps across the sea
  const HE = 0.8; // eye height above the sea (lamp at depth 2, so the cliff foot sits at y = -0.43)
  function beamGlint(t, x, y) {
    if (y > YH - 0.004) return 0;
    const Zd = HE / (YH - y), X = x * Zd, XL = LAMP[0] * 2.0;
    const dx = X - XL, dz = Zd - 2.0, dist = Math.hypot(dx, dz);
    const ap = Math.atan2(dz, dx), th = w(t, 1) + 2.35;
    let g = 0;
    for (const off of [0, Math.PI]) {
      let d = ap - (th + off);
      d = Math.atan2(Math.sin(d), Math.cos(d));
      g = Math.max(g, Math.exp(-Math.pow(d / 0.1, 2)));
    }
    return 2.6 * g * Math.exp(-dist / 7.0) * smooth(0.1, 0.6, dist);
  }

  // one sea stroke: a low, tapering crest line; nearer ones larger; undulations drift toward the cliff, and the
  // whole stroke sways a little to and fro
  function seaStroke(t, y, x0, x1, A, lam, cyc, phs, b, hook, tilt) {
    const pts = [];
    const L = Math.abs(x1 - x0);
    const n = Math.max(8, Math.ceil(L * 170));
    const k = TAU / lam;
    const sway = 0.012 * S(w(t, 1) + phs * 2.3) * (0.5 + 4 * A / 0.016);
    for (let j = 0; j <= n; j++) {
      const f = j / n;
      const x = lerp(x0, x1, f) + sway;
      const e = Math.sin(Math.PI * f);
      const yy = y + (tilt || 0) * (x + 0.2) + A * (0.9 * S(k * x - w(t, cyc) + phs) + 0.28 * S(2.3 * k * x - w(t, cyc * 2) + phs * 1.7)) * (0.3 + 0.7 * e) + 0.25 * A * e;
      pts.push([x, yy]);
    }
    if (hook) {
      // the leading end feathers into a small curl
      const [ex, ey] = pts[pts.length - 1], dir = Math.sign(x1 - x0);
      for (let j = 1; j <= 16; j++) { const a = Math.PI * 0.5 - (j / 16) * 3.4; pts.push([ex + dir * hook * Math.cos(a) * 0.9, ey - hook + hook * Math.sin(a)]); }
    }
    const tl = Math.min(0.16, L * 0.35);
    return line(pts, { b, ta: tl, tb: tl, tmin: 0.03, jb: 0.005, profPts: pts.map((p) => 1 + beamGlint(t, p[0], p[1])) });
  }

  function sea(t) {
    const out = [];
    const bk = breaker(t);
    // foam lace from the rocks, the breaking wave (back, crest, curl), its face down to the rocks, the spray
    out.push(line(bk.foam, { b: 0.5, ta: 0.05, tb: 0.08, tmin: 0.1, jb: 0.006 }));
    out.push(line(bk.p1, { b: 1.0, ta: 0.12, tmin: 0.08, jb: 0.008 }));
    out.push(line(bk.w2, { b: 0.9 }));
    out.push({ spray: bk.spray });
    // the rocky waterline along the foot of the headland, out behind the right bezel
    out.push(line(rev(catmull(WL, 7)), { b: 0.9 }));
    out.push(line([[1.05, -0.395], [1.1, -0.53], [1.05, -0.53]], { hidden: true, b: 0.0 }));
    // foreground rows (zig-zag down; the first enters from behind the right bezel, the last leaves behind the left)
    const FG = [
      // y, x0, x1, amp, wavelength, cycles, phase, b, hook, tilt
      [-0.545, 1.05, 0.26, 0.012, 0.75, 1, 0.4, 0.5, 0, 0.02],
      [-0.565, -0.04, -0.5, 0.013, 0.6, 1, 2.2, 0.46, 0, 0.025],
      [-0.69, -0.8, -0.16, 0.022, 0.85, 1, 1.9, 0.56, 0, 0.03],
      [-0.69, 0.05, 0.6, 0.02, 0.8, 1, 4.4, 0.58, 0, 0.02],
      [-0.845, 0.46, -0.16, 0.026, 0.95, 1, 2.6, 0.62, 0, 0.035],
      [-0.86, -0.3, -1.05, 0.024, 0.9, 1, 5.1, 0.6, 0, 0.03],
    ];
    FG.forEach((q) => out.push(seaStroke(t, ...q)));
    out.push(line([[-1.05, -0.88], [-1.1, -0.8], [-1.1, -0.335], [-1.05, -0.335]], { hidden: true, b: 0.0 }));
    // rows above the breaker, shorter and closer toward the horizon (zig-zag up)
    const UP = [
      [-0.335, -1.05, -0.5, 0.011, 0.55, 1, 0.9, 0.48, 0, 0.015],
      [-0.32, -0.37, -0.12, 0.009, 0.45, 2, 3.0, 0.44, 0, 0.01],
      [-0.245, -0.02, -0.32, 0.007, 0.4, 2, 4.1, 0.42, 0, 0.012],
      [-0.25, -0.46, -0.84, 0.007, 0.4, 2, 1.4, 0.4, 0, 0.01],
      [-0.18, -0.78, -0.52, 0.005, 0.32, 2, 5.3, 0.36, 0, 0.008],
      [-0.176, -0.4, 0.0, 0.0055, 0.34, 3, 2.7, 0.36, 0, 0.008],
      [-0.125, 0.06, -0.3, 0.0042, 0.26, 3, 3.3, 0.32, 0, 0.006],
      [-0.128, -0.45, -0.7, 0.004, 0.26, 3, 0.2, 0.3, 0, 0.005],
      [-0.088, -0.86, -0.6, 0.0032, 0.2, 3, 1.1, 0.27, 0, 0.004],
      [-0.085, -0.46, -0.16, 0.0032, 0.2, 2, 4.8, 0.27, 0, 0.004],
      [-0.058, 0.1, -0.2, 0.0024, 0.15, 3, 3.9, 0.23, 0, 0.003],
      [-0.06, -0.36, -0.58, 0.0022, 0.15, 3, 0.7, 0.21, 0, 0.003],
    ];
    UP.forEach((q) => out.push(seaStroke(t, ...q)));
    // the horizon, a quiet line fading out toward the open sea
    out.push(line(catmull([[0.12, YH], [-0.2, YH + 0.0004], [-0.6, YH], [-0.94, YH - 0.0004]], 30), { b: 0.42, tb: 0.5, tmin: 0.03, ta: 0.04 }));
    return out;
  }

  // ---------------------------------------------------------------- the whole display list
  function build(t) {
    const list = [];
    const bm = beamFans(t);
    gulls(t).forEach((s) => list.push(s));
    lighthouse(t, bm).forEach((s) => list.push(s));
    cliffBody().forEach((s) => list.push(s));
    // the face of the headland, from its top corner down to the foot
    list.push(line(rev(catmull(FACE, 9)), { b: 1.0, jb: 0.008 }));
    sea(t).forEach((s) => list.push(s));
    return list;
  }

  PH.scene = { D, LAP, YH, LAMP, build, TB };
})();
