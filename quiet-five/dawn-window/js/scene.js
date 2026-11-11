// Dawn, a Window, a Glass of Water — the scene: layout and the "reference" light study the paint is laid over.
// Units: x in [0,1] across the canvas width, y in [0,1.25] down (canvas is 4:5). Pixel = unit * Wpx.
(function () {
  'use strict';
  const DW = window.DW;
  const { smooth, clamp, mix, fbm, vnoise } = DW;

  const OY = 0.05;
  const DY = OY - 0.035; // layout below was drawn for OY = 0.035
  const LY = {
    OY,
    VP: { x: 0.5, y: 0.65 + OY }, // eye level: the horizon outside sits here
    // wall-face opening
    wx0: 0.16, wx1: 0.84, wy0: 0.10 + OY, wyS: 0.96 + OY,
    k: 0.82, // frame plane = VP + k * (wall face - VP)
    rodY: 0.07 + OY, rodX0: 0.118, rodX1: 0.905, rodR: 0.0042,
    noseY0: 0.968 + OY, noseY1: 0.993 + OY, earX0: 0.122, earX1: 0.878,
    glass: { x: 0.466, yb: 0.968 + DY, rb: 0.0415, rt: 0.0458, yt: 0.806 + DY, yw: 0.853 + DY },
    star: { x: 0.5995, y: 0.352 + DY },
  };
  // derived frame-plane rectangle
  LY.fx0 = LY.VP.x + (LY.wx0 - LY.VP.x) * LY.k;
  LY.fx1 = LY.VP.x + (LY.wx1 - LY.VP.x) * LY.k;
  LY.fy0 = LY.VP.y + (LY.wy0 - LY.VP.y) * LY.k;
  LY.fy1 = LY.VP.y + (LY.wyS - LY.VP.y) * LY.k;
  // members
  const FW = 0.028, FB = 0.014, ST = 0.0244, BR = 0.0174, GB = 0.0078;
  LY.ix0 = LY.fx0 + FW; LY.ix1 = LY.fx1 - FW; LY.iy0 = LY.fy0 + FW; LY.iy1 = LY.fy1 - FB;
  LY.gy = 0.505 + DY; // glazing bar centre
  LY.mx = 0.5;
  LY.pane = { x0: LY.ix0 + ST, x1: LY.ix1 - ST, y0: LY.iy0 + ST, y1: LY.iy1 - BR };
  // member rects: [x0,y0,x1,y1, orient, depth, kind]
  // kind: 0 outer frame, 1 sash
  LY.members = [
    [LY.fx0, LY.fy0, LY.ix0, LY.fy1, 'v', 0.034, 0],
    [LY.ix1, LY.fy0, LY.fx1, LY.fy1, 'v', 0.034, 0],
    [LY.fx0, LY.fy0, LY.fx1, LY.iy0, 'h', 0.034, 0],
    [LY.fx0, LY.iy1, LY.fx1, LY.fy1, 'h', 0.034, 0],
    // left sash
    [LY.ix0, LY.iy0, LY.ix0 + ST, LY.iy1, 'v', 0.024, 1],
    [LY.mx - ST, LY.iy0, LY.mx - 0.0006, LY.iy1, 'v', 0.024, 1],
    [LY.ix0, LY.iy0, LY.mx, LY.iy0 + ST, 'h', 0.024, 1],
    [LY.ix0, LY.iy1 - BR, LY.mx, LY.iy1, 'h', 0.024, 1],
    [LY.ix0, LY.gy - GB, LY.mx, LY.gy + GB, 'h', 0.018, 1],
    // right sash
    [LY.mx + 0.0006, LY.iy0, LY.mx + ST, LY.iy1, 'v', 0.024, 1],
    [LY.ix1 - ST, LY.iy0, LY.ix1, LY.iy1, 'v', 0.024, 1],
    [LY.mx, LY.iy0, LY.ix1, LY.iy0 + ST, 'h', 0.024, 1],
    [LY.mx, LY.iy1 - BR, LY.ix1, LY.iy1, 'h', 0.024, 1],
    [LY.mx, LY.gy - GB, LY.ix1, LY.gy + GB, 'h', 0.018, 1],
  ];
  DW.LY = LY;

  // ---------- outside: sky, distant hills, valley mist, rooftops ----------
  const skyGrad = DW.gradient([
    [-0.47, 20, 27, 66],
    [-0.40, 24, 33, 78],
    [-0.31, 38, 51, 103],
    [-0.22, 70, 79, 130],
    [-0.14, 124, 115, 154],
    [-0.08, 182, 145, 163],
    [-0.04, 226, 173, 167],
    [-0.016, 246, 199, 176],
    [0.0, 247, 205, 180],
    [0.02, 240, 196, 176],
  ]);
  const mistGrad = DW.gradient([
    [0.0, 200, 162, 166],
    [0.04, 186, 150, 158],
    [0.10, 150, 122, 140],
    [0.17, 116, 96, 120],
    [0.26, 90, 76, 102],
  ]);
  const tmp3 = [0, 0, 0];

  // near rooftops / trees. Returns coverage info for (x,y): {a: 0..1 coverage, k: surface kind}
  // kinds: 1 roof slope (slates catching the sky), 2 house wall / chimney (darkest), 3 trees
  function nearAt(x, y, px) {
    y -= DY;
    let a = 0, k = 0;
    const edge = (d) => clamp(0.5 + d / px, 0, 1); // d>0 inside
    // house A (left): ridge, verge falling to the right, chimney with two pots
    {
      const ridge = 0.839 + 0.0015 * Math.sin(x * 60);
      let d = Math.min(y - ridge, 0.379 - x + 0.03);
      if (x > 0.379) d = Math.min(y - (ridge + (x - 0.379) * 1.08), 0.405 - x);
      const ar = edge(d) * (x > 0.24 ? 1 : 0);
      if (ar > a) { a = ar; k = y > 0.868 ? 2 : 1; }
      const dc = Math.min(y - 0.807, x - 0.331, 0.346 - x);
      const ac = edge(dc);
      const dp1 = Math.min(y - 0.8005, x - 0.3325, 0.3372 - x), dp2 = Math.min(y - 0.8022, x - 0.3395, 0.3443 - x);
      const ach = Math.max(ac, edge(dp1), edge(dp2));
      if (ach > 0 && ach >= a) { a = Math.max(a, ach); k = 2; }
    }
    // houses B, C (right) and the trees behind them
    {
      const dB = Math.min(y - 0.861, x - 0.512 - (0.861 - y) * 0 );
      let ab = edge(dB) * (x > 0.51 ? 1 : 0);
      if (x < 0.53) ab = edge(Math.min(y - (0.861 + (0.53 - x) * 1.0), x - 0.505));
      if (ab > a) { a = ab; k = y > 0.882 ? 2 : 1; }
      const dC = Math.min(y - 0.843, x - 0.585);
      const ac = edge(x < 0.6 ? Math.min(y - (0.843 + (0.6 - x) * 1.1), x - 0.578) : dC);
      if (ac > a) { a = ac; k = y > 0.872 ? 2 : 1; }
      const dch = Math.min(y - 0.816, x - 0.622, 0.636 - x);
      if (edge(dch) > a) { a = edge(dch); k = 2; }
      if (x > 0.63) {
        const crown = 0.80 - 0.07 * smooth(0.64, 0.75, x) + (fbm(x * 70, 3.1, 71, 4) - 0.5) * 0.03 + (fbm(x * 18, 5.1, 72, 3) - 0.5) * 0.03;
        const at = edge(y - crown) * smooth(0.63, 0.66, x);
        if (at > a) { a = at; k = 3; }
      }
    }
    return { a, k, top: k === 1 ? (x < 0.45 ? 0.839 : x < 0.585 ? 0.861 : 0.843) + DY : 0 };
  }
  function roofline(x) {
    // approximate top edge, used only to label regions
    for (let y = 0.70; y < 1.0; y += 0.002) if (nearAt(x, y + DY, 1e-4).a > 0.5) return y + DY;
    return 9;
  }
  DW.roofline = roofline;
  DW.nearAt = nearAt;

  // colour of the world outside at screen (x,y); writes linear rgb
  function outside(x, y, out) {
    const h = y - LY.VP.y; // >0 below horizon
    // sky (with a horizontal warmth centred a little left of the glass)
    const warm = Math.exp(-((x - 0.40) * (x - 0.40)) / 0.05);
    skyGrad(h + 0.006 * (1 - warm), out);
    const lift = 1 + 0.10 * warm * smooth(-0.2, -0.01, h);
    out[0] *= lift * (1 + 0.03 * warm); out[1] *= lift; out[2] *= lift * (1 - 0.03 * warm);
    // a faint long stratus streak lit from below, in the rose band
    const cl = Math.exp(-Math.pow((h + 0.105 + 0.012 * Math.sin(x * 7.0) + 0.004 * (x - 0.4)) / 0.0065, 2));
    const clx = smooth(0.2, 0.32, x) * (1 - smooth(0.52, 0.72, x)) * (0.55 + 0.45 * fbm(x * 30, h * 200, 9, 3));
    if (cl * clx > 0.001) {
      const a = cl * clx * 0.32;
      out[0] = mix(out[0], out[0] * 1.35 + 0.05, a); out[1] = mix(out[1], out[1] * 1.12 + 0.02, a); out[2] = mix(out[2], out[2] * 0.98, a);
    }
    // distant hills: a soft, rolling line just under the horizon, sinking into the valley mist
    const hillTop = -0.002 + 0.016 * (fbm(x * 3.2, 1.7, 33, 4) - 0.5) - 0.004 * Math.sin(x * 6 + 1) + 0.006 * (fbm(x * 14, 2.7, 34, 3) - 0.5);
    const hb = smooth(hillTop - 0.0035, hillTop + 0.0025, h);
    if (hb > 0) {
      const d = h - hillTop;
      mistGrad(Math.max(0, d - 0.012) * 0.95, tmp3);
      const band = 0.94 + 0.12 * fbm(x * 5, h * 70, 51, 4);
      const hc0 = DW.s2l(150), hc1 = DW.s2l(120), hc2 = DW.s2l(142);
      const m = smooth(0.0, 0.045, d);
      let r = mix(hc0, tmp3[0] * band, m), g = mix(hc1, tmp3[1] * band, m), b = mix(hc2, tmp3[2] * band, m);
      // belts of trees standing in the mist, darker and crisper as they come nearer
      const belts = [[0.040, 0.18, 0.0016, 81], [0.078, 0.30, 0.0012, 82], [0.118, 0.44, 0.0009, 83]];
      for (const [hb0, dark, soft, sd] of belts) {
        const top = hb0 + 0.010 * (fbm(x * 9, 1.0, sd, 3) - 0.5) + 0.006 * (fbm(x * 55, 2.0, sd + 9, 3) - 0.5);
        const reach = smooth(0.25, 0.6, fbm(x * 4 + 3, 7.0, sd + 4, 3));
        const inB = smooth(top - soft, top + soft, h) * Math.exp(-Math.max(0, h - top) / (0.010 + 0.006 * (sd - 81))) * reach;
        const k2 = 1 - dark * inB;
        r *= k2; g *= k2 * 0.985; b *= k2 * 1.0;
      }
      out[0] = mix(out[0], r, hb); out[1] = mix(out[1], g, hb); out[2] = mix(out[2], b, hb);
    }
    // near rooftops / trees silhouette
    const nr = nearAt(x, y, 0.0006);
    if (nr.a > 0) {
      let cr, cg, cb;
      if (nr.k === 1) {
        // slate roof slope: wet slates mirror the pale sky, brightest just under the ridge; faint courses
        const course = 0.88 + 0.12 * Math.sin((y - DY) * 2600) * (0.5 + 0.5 * vnoise(x * 300, y * 40, 61));
        const nearRidge = Math.exp(-Math.max(0, y - nr.top) / 0.006);
        const v = (0.75 + 0.5 * nearRidge) * course;
        cr = DW.s2l(46 * v); cg = DW.s2l(42 * v); cb = DW.s2l(62 * v);
      } else if (nr.k === 2) { cr = DW.s2l(19); cg = DW.s2l(17); cb = DW.s2l(28); }
      else { const v = 0.8 + 0.4 * fbm(x * 90, y * 90, 62, 3); cr = DW.s2l(24 * v); cg = DW.s2l(21 * v); cb = DW.s2l(33 * v); }
      // a veil of morning haze between us and the houses
      const haze = 0.12;
      out[0] = mix(out[0], mix(cr, out[0], haze), nr.a); out[1] = mix(out[1], mix(cg, out[1], haze), nr.a); out[2] = mix(out[2], mix(cb, out[2], haze), nr.a);
    }
    return out;
  }
  DW.outside = outside;

  // ---------- helpers ----------
  function inRect(x, y, r) { return x >= r[0] && x < r[2] && y >= r[1] && y < r[3]; }
  // signed-ish edge coverage: 1 inside, 0 outside, ramp over px
  function cover(d, px) { return clamp(0.5 - d / px, 0, 1); }
  function rectSD(x, y, r) {
    const dx = Math.max(r[0] - x, x - r[2]), dy = Math.max(r[1] - y, y - r[3]);
    return Math.max(dx, dy);
  }

  // Region ids
  const R = { WALL: 0, ROD: 1, REVL: 2, REVR: 3, SOFFIT: 4, SILL: 5, NOSE: 6, FRAME: 7, FSIDE: 8, SKY: 9, GLOW: 10, DARKOUT: 11, LOWWALL: 12 };
  DW.R = R;

  // ---------- reference image ----------
  // Returns linear RGB image + region map + stroke direction field + paint thickness + "keep sharp" map.
  DW.buildReference = function (Wpx) {
    const Hpx = Math.round(Wpx * 1.25);
    const N = Wpx * Hpx;
    const ref = new Float32Array(N * 3);
    const region = new Uint8Array(N);
    const dir = new Float32Array(N);
    const keep = new Float32Array(N); // 0..1 how much to keep the reference crisp over the paint
    const px = 1 / Wpx;
    const VP = LY.VP;
    const c = [0, 0, 0], o = [0, 0, 0];
    const wallA = DW.srgb(27, 30, 44), wallB = DW.srgb(15, 16, 25);

    for (let j = 0; j < Hpx; j++) {
      const y = (j + 0.5) * px;
      for (let i = 0; i < Wpx; i++) {
        const x = (i + 0.5) * px;
        const p = j * Wpx + i;
        let reg = R.WALL, ang = 0, kp = 0;
        // hand-drawn wobble for architectural edges
        const wob = (vnoise(x * 90, y * 90, 5) - 0.5) * 0.0011 + (vnoise(x * 13, y * 13, 6) - 0.5) * 0.0012;
        const xw = x + wob, yw = y + (vnoise(x * 80 + 9, y * 80, 8) - 0.5) * 0.0011;

        // ===== wall face (default) =====
        {
          const dx = x - 0.5, dy = y - 0.62;
          const glow = Math.exp(-(dx * dx) / 0.16 - (dy * dy) / 0.30);
          const top = smooth(0.0, 0.25, y) * 0.35 + 0.65;
          const n = fbm(x * 5, y * 5, 11, 4);
          const f = clamp(glow * top * (0.85 + 0.3 * n), 0, 1.2);
          c[0] = mix(wallB[0], wallA[0], f); c[1] = mix(wallB[1], wallA[1], f); c[2] = mix(wallB[2], wallA[2], f);
          // strokes curve around the window light (isophotes), loosened by noise
          // loose, mostly upright strokes on the wall; near the opening they turn to follow its edge
          {
            const ddx = Math.max(LY.wx0 - x, x - LY.wx1, 0), ddy = Math.max(LY.wy0 - y, y - LY.noseY1, 0);
            const near = Math.exp(-Math.hypot(ddx, ddy) / 0.05);
            const edgeAng = ddx > ddy ? Math.PI / 2 : 0;
            ang = mix(Math.PI / 2 + 0.25, edgeAng, near) + (fbm(x * 4, y * 4, 12, 3) - 0.5) * 1.3;
          }
          {
            // shadow under the sill nose (only under the board), then the dark lower wall; the floor in front
            // of the window is lit, and a little of that comes back up onto the lower wall
            const under = smooth(LY.earX0 - 0.03, LY.earX0 + 0.01, x) * (1 - smooth(LY.earX1 - 0.01, LY.earX1 + 0.03, x));
            const sh = y > LY.noseY1 ? 1 - 0.55 * Math.exp(-(y - LY.noseY1) / 0.03) * under : 1;
            const fall = 1 - 0.18 * smooth(LY.noseY1 - 0.06, LY.noseY1 + 0.04, y) + 0.5 * smooth(LY.noseY1 + 0.05, 1.25, y) * Math.exp(-((x - 0.52) * (x - 0.52)) / 0.12);
            c[0] *= sh * fall; c[1] *= sh * fall; c[2] *= sh * fall;
          }
          if (y > LY.noseY1 + 0.004 && x > LY.earX0 - 0.01 && x < LY.earX1 + 0.01) {
            reg = R.LOWWALL;
            ang = 0.25 + (fbm(x * 3, y * 6, 13, 3) - 0.5) * 1.2;
          }
        }

        // ===== window opening =====
        const inOpening = xw > LY.wx0 && xw < LY.wx1 && yw > LY.wy0 && yw < LY.wyS;
        const inFrame = xw > LY.fx0 && xw < LY.fx1 && yw > LY.fy0 && yw < LY.fy1;
        if (inOpening && !inFrame) {
          // which reveal face: cast a ray from VP through the point to the wall rect
          const dx = x - VP.x, dy = y - VP.y;
          const tx = dx < 0 ? (LY.wx0 - VP.x) / dx : (LY.wx1 - VP.x) / dx;
          const ty = dy < 0 ? (LY.wy0 - VP.y) / dy : (LY.wyS - VP.y) / dy;
          const t = Math.min(tx, ty);
          const q = clamp((1 / t - LY.k) / (1 - LY.k), 0, 1); // 0 at frame, 1 at room
          const toward = Math.atan2(-dy, -dx);
          ang = toward + (fbm(x * 9, y * 9, 14, 3) - 0.5) * 0.5;
          const nz = fbm(x * 14, y * 14, 15, 4);
          if (tx < ty) {
            // jambs
            reg = dx < 0 ? R.REVL : R.REVR;
            const v = clamp((y - LY.fy0) / (LY.fy1 - LY.fy0), 0, 1);
            const near = [0, 0, 0], far = DW.srgb(40, 41, 58);
            const nTop = DW.srgb(98, 100, 132), nBot = DW.srgb(168, 142, 150);
            const vv = smooth(0.1, 0.95, v);
            for (let k = 0; k < 3; k++) near[k] = mix(nTop[k], nBot[k], vv);
            const dim = dx < 0 ? 1.0 : 0.82;
            const fq = Math.pow(q, 0.65);
            for (let k = 0; k < 3; k++) c[k] = mix(near[k] * dim, far[k], fq) * (0.94 + 0.12 * nz);
            // soft shadow of the frame edge on the jamb, right next to it
            const shf = 1 - 0.35 * Math.exp(-q / 0.05);
            c[0] *= shf; c[1] *= shf; c[2] *= shf;
          } else if (dy < 0) {
            reg = R.SOFFIT;
            const near = DW.srgb(132, 110, 124), far = DW.srgb(38, 38, 54);
            const fq = Math.pow(q, 0.6);
            const side = 1 - 0.25 * smooth(0.55, 0.8, x);
            for (let k = 0; k < 3; k++) c[k] = mix(near[k] * side, far[k], fq) * (0.94 + 0.12 * nz);
          } else {
            reg = R.SILL;
          }
        }
        // sill board top (incl. ears beyond the opening)
        let sillTop = false;
        if (reg === R.SILL) sillTop = true;
        if (!inFrame && yw >= LY.wyS - 0.0005 && yw < LY.noseY0 && xw > LY.earX0 && xw < LY.earX1) sillTop = true;
        if (sillTop) {
          reg = R.SILL;
          // depth param along the board: 0 at frame, 1 at nose edge
          const q = clamp((y - LY.fy1) / (LY.noseY0 - LY.fy1), 0, 1);
          const near = DW.srgb(150, 149, 174), far = DW.srgb(98, 98, 124);
          const nz = fbm(x * 18, y * 30, 16, 4);
          for (let k = 0; k < 3; k++) c[k] = mix(near[k], far[k], Math.pow(q, 0.8)) * (0.95 + 0.1 * nz);
          // light from the window falls across the board; the curtain cuts it on the right
          const cut = 1 - 0.42 * smooth(0.58, 0.72, x);
          const ears = 1 - 0.55 * (smooth(LY.wx0 + 0.003, LY.wx0 - 0.02, x) + smooth(LY.wx1 - 0.003, LY.wx1 + 0.02, x));
          // soft shadow of the glass, cast toward the viewer and a little right (light from back-left)
          const G = LY.glass;
          const sx = (x - (G.x + 0.010)) / 0.050, sy = (y - (G.yb + 0.006)) / 0.020;
          const along = sx * 0.40 + sy * 0.92, across = sx * 0.92 - sy * 0.40;
          let gsh = 0;
          if (along > -0.9) gsh = Math.exp(-across * across / 0.55) * smooth(-0.9, -0.2, along) * Math.exp(-Math.max(0, along) / 2.6);
          const shadow = 1 - 0.62 * gsh;
          const f = cut * ears * shadow;
          c[0] *= f; c[1] *= f; c[2] *= f * 1.02;
          ang = (fbm(x * 6, y * 6, 17, 3) - 0.5) * 0.35;
          kp = 0.0;
        }
        // sill nose (front face)
        if (!inFrame && yw >= LY.noseY0 && yw < LY.noseY1 && xw > LY.earX0 - 0.002 && xw < LY.earX1 + 0.002) {
          reg = R.NOSE;
          const v = (y - LY.noseY0) / (LY.noseY1 - LY.noseY0);
          const base = DW.srgb(40, 41, 57), lit = DW.srgb(150, 148, 170);
          const e = Math.exp(-v / 0.07) * (1 - 0.45 * smooth(0.58, 0.75, x));
          for (let k = 0; k < 3; k++) c[k] = mix(base[k], lit[k], e) * (1 - 0.25 * v);
          ang = 0;
        }

        // ===== frame plane: members, their lit sides, and the panes =====
        if (inFrame) {
          let hit = -1;
          for (let m = 0; m < LY.members.length; m++) {
            if (inRect(xw, yw, LY.members[m])) { hit = m; break; }
          }
          if (hit >= 0) {
            const M = LY.members[hit];
            reg = R.FRAME;
            const front = DW.srgb(50, 52, 69), low = DW.srgb(60, 61, 78);
            const lv = smooth(0.6, 0.94, y);
            for (let k = 0; k < 3; k++) c[k] = mix(front[k], low[k], lv);
            // light catching the moulded inner edges next to the glass
            const P = LY.pane;
            const inPaneX = x > P.x0 - 0.02 && x < P.x1 + 0.02;
            let edgeL = 0;
            // distance to nearest pane edge (approx: the member boundary that borders a pane)
            const dl = x - M[0], dr = M[2] - x, dt = y - M[1], db = M[3] - y;
            const ew = 0.0028;
            // which member edges border glass
            const borders = (xx, yy) => {
              for (let m = 0; m < LY.members.length; m++) if (inRect(xx, yy, LY.members[m])) return false;
              return xx > LY.fx0 && xx < LY.fx1 && yy > LY.fy0 && yy < LY.fy1;
            };
            const cxm = (M[0] + M[2]) / 2, cym = (M[1] + M[3]) / 2;
            if (M[4] === 'v') {
              if (borders(M[0] - 0.003, y)) edgeL = Math.max(edgeL, Math.exp(-dl / ew) * 0.8);
              if (borders(M[2] + 0.003, y)) edgeL = Math.max(edgeL, Math.exp(-dr / ew) * 0.8);
            } else {
              if (borders(x, M[1] - 0.003)) edgeL = Math.max(edgeL, Math.exp(-dt / ew) * 0.9);
              if (borders(x, M[3] + 0.003)) edgeL = Math.max(edgeL, Math.exp(-db / ew) * 0.75);
            }
            const hl = DW.srgb(150, 146, 168);
            for (let k = 0; k < 3; k++) c[k] = mix(c[k], hl[k], edgeL);
            const nz = fbm(x * 25, y * 25, 18, 3);
            c[0] *= 0.95 + 0.1 * nz; c[1] *= 0.95 + 0.1 * nz; c[2] *= 0.95 + 0.1 * nz;
            ang = M[4] === 'v' ? Math.PI / 2 : 0;
            ang += (vnoise(x * 40, y * 40, 19) - 0.5) * 0.12;
            kp = 0.35 * edgeL;
            void cxm; void cym; void inPaneX;
          } else {
            // not on a member front: maybe a member's side face (depth) seen in perspective
            let side = -1, sm = null;
            for (let m = 0; m < LY.members.length; m++) {
              const M = LY.members[m];
              const s = 1 / (1 - M[5]);
              const qx = VP.x + (xw - VP.x) * s, qy = VP.y + (yw - VP.y) * s;
              if (inRect(qx, qy, M)) { side = m; sm = M; break; }
            }
            if (side >= 0) {
              reg = R.FSIDE;
              // orientation of the visible side face
              const dxl = sm[0] - xw, dxr = xw - sm[2], dyt = sm[1] - yw, dyb = yw - sm[3];
              const mx = Math.max(dxl, dxr, dyt, dyb);
              let col;
              if (mx === dyt) col = DW.srgb(150, 152, 182); // top face of a member below eye level: lit by the cold upper sky
              else if (mx === dyb) col = DW.srgb(186, 148, 146); // underside above eye level: lit by the rose glow below
              else col = DW.srgb(140, 130, 152); // left/right faces
              // brighter towards the glass, darker into the room
              const gradF = 0.9 + 0.1 * vnoise(x * 50, y * 50, 20);
              c[0] = col[0] * gradF; c[1] = col[1] * gradF; c[2] = col[2] * gradF;
              ang = mx === dyt || mx === dyb ? 0 : Math.PI / 2;
              kp = 0.5;
            } else {
              // glass pane: the world outside, through slightly wavy old glass
              const pnx = Math.floor((x - 0.2) / 0.25), pny = y < LY.gy ? 0 : 1;
              const sd = 40 + pnx * 3 + pny;
              const wx = (vnoise(x * 7, y * 5, sd) - 0.5) * 0.0028 + (vnoise(x * 23, y * 19, sd + 1) - 0.5) * 0.0008;
              const wy = (vnoise(x * 6, y * 7, sd + 2) - 0.5) * 0.0018;
              outside(x + wx, y + wy, o);
              // glass: a little loss and the faintest cold reflection of the room
              c[0] = o[0] * 0.93 + 0.0006; c[1] = o[1] * 0.93 + 0.0007; c[2] = o[2] * 0.93 + 0.0011;
              const h = y - VP.y;
              const nr = nearAt(x + wx, y + wy, 0.003);
              reg = nr.a > 0.02 ? R.DARKOUT : h > -0.12 ? R.GLOW : R.SKY;
              ang = (vnoise(x * 6, y * 30, 21) - 0.5) * 0.25 + 0.04 * Math.sin(x * 9);
              if (reg === R.DARKOUT) ang = 0;
              kp = 0.0;
            }
          }
        }

        // ===== curtain rod (drawn on the wall above the opening) =====
        {
          const dy = Math.abs(y - LY.rodY);
          if (x > LY.rodX0 - 0.012 && x < LY.rodX1 + 0.012) {
            let a = 0;
            if (x > LY.rodX0 && x < LY.rodX1) a = cover(dy - LY.rodR, px);
            // finials
            for (const fx of [LY.rodX0 - 0.002, LY.rodX1 + 0.002]) {
              const d = Math.hypot(x - fx, (y - LY.rodY) * 0.95) - 0.0085;
              a = Math.max(a, cover(d, px));
            }
            // bracket under the rod
            for (const bx of [0.14, 0.88]) {
              if (Math.abs(x - bx) < 0.0035 && y > LY.rodY && y < LY.rodY + 0.016) a = Math.max(a, 1);
            }
            if (a > 0) {
              const v = (y - LY.rodY) / (LY.rodR * 2);
              const lit = Math.min(0.6, Math.max(0, v) * 0.6) * (y > LY.rodY + LY.rodR * 1.2 ? 0.25 : 1); // underside picks up the window light
              const base = DW.srgb(18, 18, 25), hl = DW.srgb(70, 66, 80);
              for (let k = 0; k < 3; k++) c[k] = mix(c[k], mix(base[k], hl[k], lit), a);
              if (a > 0.5) { reg = R.ROD; ang = 0; kp = 0.6; }
              // shadow of the rod on the wall just under it
            } else if (x > LY.rodX0 && x < LY.rodX1 && y > LY.rodY && y < LY.rodY + 0.02) {
              const s = 1 - 0.3 * Math.exp(-(y - LY.rodY - LY.rodR) / 0.004);
              c[0] *= s; c[1] *= s; c[2] *= s;
            }
          }
        }

        ref[p * 3] = c[0]; ref[p * 3 + 1] = c[1]; ref[p * 3 + 2] = c[2];
        region[p] = reg; dir[p] = ang; keep[p] = kp;
      }
    }
    return { Wpx, Hpx, N, ref, region, dir, keep };
  };
})();
