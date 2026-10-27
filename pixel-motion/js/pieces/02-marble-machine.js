/* Marble Machine — piece 2 of Perpetual Motion.
 *
 * An 18-second seamless loop. A wall-mounted kinetic sculpture of brass, wood and glass keeps 36 glass
 * marbles in perpetual circulation: a screw lift, zigzag rails with gap jumps, a chime-bar staircase, a
 * glass vortex funnel, a bucket catch wheel geared to a train of brass gears, a see-saw that tips under
 * two marbles, a pendulum escapement and a counterweight elevator.
 *
 * Every marble runs the same closed circuit, offset by 0.5 s. The circuit is integrated once at start-up
 * (rolling on slopes, ballistic jumps, bounces, queues behind gates) on a clock whose stations are all
 * periodic with periods that divide 18 s, then every frame looks positions up as a pure function of t.
 * Drawn into a 270 × 338 indexed buffer (46 colours, Bayer-dithered) and scaled up 4× nearest-neighbour.
 */
(function () {
  'use strict';

  /* ================================================================ constants & helpers */
  const W = 270, H = 338, NP = W * H;
  const D = 18, DT = 0.5, NMB = 36;             // loop length, marble spacing, marble count (D / DT)
  const TAU = Math.PI * 2, PI = Math.PI;
  const fl = Math.floor;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, u) => a + (b - a) * u;
  const sstep = (a, b, x) => { const u = clamp((x - a) / (b - a), 0, 1); return u * u * (3 - 2 * u); };
  const mod = (a, b) => ((a % b) + b) % b;
  const frac = (x) => x - Math.floor(x);
  let SEED = 7;
  function ih(a, b, c) {
    let h = Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x165667b1) ^ Math.imul(((c | 0) + SEED * 7919) | 0, 0x85ebca77);
    h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
    h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
    h ^= h >>> 15;
    return (h >>> 0) / 4294967296;
  }
  const BAY = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
  const bay = (x, y) => BAY[((y & 3) << 2) | (x & 3)];

  /* ================================================================ palette (46) */
  const PAL_HEX = [
    '0e0705', '160c08', '1f110b', '2a170f', '372014', '472a1a',             // 0-5 walnut
    '5e3a20', '83532c', 'a8733c',                                           // 6-8 light wood
    '2a1c0a', '4a3312', '70501a', '9a7424', 'c29a36', 'e2c25e', 'fff0b0',   // 9-15 brass
    '6a2a18', 'a8502c',                                                     // 16-17 copper
    '1b1e23', '363b44', '636a75', 'a3aab4',                                 // 18-21 steel
    '1d3335', '37615f', '7fb0a6', 'cfeee3',                                 // 22-25 glass
    '420816', '8e1530', 'd8394f', 'ff95a0',                                 // 26-29 ruby
    '0b1448', '1f3da4', '4f84f4', 'b0ceff',                                 // 30-33 sapphire
    '06331c', '0f7a44', '3ccf7e', 'b0f2c8',                                 // 34-37 emerald
    '2e0e52', '6c30ae', 'b886f2',                                           // 38-40 amethyst
    '05485a', '14a2b4', '8eeaea',                                           // 41-43 teal
    'ff9a2e', 'fffdf4',                                                     // 44 amber, 45 white
  ];
  const PAL = PAL_HEX.map((h) => [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]);
  const NPAL = PAL.length;
  const WAL = [0, 1, 2, 3, 4, 5], WOOD = [6, 7, 8];
  const BR = [9, 10, 11, 12, 13, 14, 15], CU = [16, 17], ST = [18, 19, 20, 21], GL = [22, 23, 24, 25];
  const C_WHITE = 45, C_AMBER = 44;
  function nearest(r, g, b) {
    let best = 0, bd = 1e18;
    for (let k = 0; k < NPAL; k++) {
      const p = PAL[k], dr = r - p[0], dg = g - p[1], db = b - p[2];
      const rm = (r + p[0]) * 0.5;
      const d = (2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db;
      if (d < bd) { bd = d; best = k; }
    }
    return best;
  }
  // index -> darker index (cast shadows), glass-tinted index (seen through glass)
  const DARK = new Uint8Array(NPAL), DARK2 = new Uint8Array(NPAL), THRU = new Uint8Array(NPAL);
  function buildTables() {
    for (let k = 0; k < NPAL; k++) {
      const p = PAL[k];
      DARK[k] = nearest(p[0] * 0.62, p[1] * 0.58, p[2] * 0.55);
      DARK2[k] = nearest(p[0] * 0.42, p[1] * 0.38, p[2] * 0.36);
      THRU[k] = nearest(p[0] * 0.78 + 14, p[1] * 0.84 + 24, p[2] * 0.82 + 22);
    }
    // keep walnut shadows inside the walnut ramp
    for (let k = 1; k < 6; k++) { DARK[k] = Math.max(0, k - 2); DARK2[k] = Math.max(0, k - 3); }
    DARK[0] = 0; DARK2[0] = 0;
  }
  // ordered dither of v in [0,1] over a ramp
  function rampI(rmp, v, x, y) {
    const n = rmp.length - 1;
    let f = v * n; if (f < 0) f = 0; if (f > n) f = n;
    let i = f | 0;
    if (f - i > bay(x, y) && i < n) i++;
    return rmp[i];
  }

  /* ================================================================ buffers */
  const OUT = new Uint8Array(NP);   // palette indices
  const ZH = new Uint8Array(NP);    // relief height over the panel (0 = panel), for cast shadows
  const ST_OUT = new Uint8Array(NP), ST_ZH = new Uint8Array(NP); // pre-rendered static layer
  const PANEL = new Uint8Array(NP); // bare walnut panel (for marble refraction)
  const FO = new Uint8Array(NP), FOZ = new Uint8Array(NP); // static front overlay (255 = clear)
  let BUF = OUT, ZB = ZH;
  function put(x, y, c, h) {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const i = y * W + x; BUF[i] = c; ZB[i] = h;
  }

  // light: from upper left, towards the viewer
  const LX = -0.48, LY = -0.70, LZ = 0.53;
  const HXv = LX, HYv = LY, HZv = LZ + 1, HN = Math.hypot(HXv, HYv, HZv);
  const HX = HXv / HN, HY = HYv / HN, HZ = HZv / HN;
  // shade a round tube / sphere normal into a ramp, with dithered specular
  function tubeShade(nx, ny, rmp, x, y, specMul) {
    const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
    const dif = Math.max(0, nx * LX + ny * LY + nz * LZ);
    const sp = Math.pow(Math.max(0, nx * HX + ny * HY + nz * HZ), 18) * (specMul === undefined ? 1 : specMul);
    const v = 0.12 + 0.72 * dif + 0.5 * sp;
    if (sp > 0.55 + 0.3 * bay(x, y)) return rmp === BR ? 15 : rmp === ST ? 21 : rmp === WOOD ? 8 : rmp[rmp.length - 1];
    return rampI(rmp, v, x, y);
  }
  // draw a shaded tube along segment (x0,y0)-(x1,y1), radius r
  function tubeSeg(x0, y0, x1, y1, r, rmp, h, specMul) {
    const minx = fl(Math.min(x0, x1) - r - 1), maxx = Math.ceil(Math.max(x0, x1) + r + 1);
    const miny = fl(Math.min(y0, y1) - r - 1), maxy = Math.ceil(Math.max(y0, y1) + r + 1);
    const dx = x1 - x0, dy = y1 - y0, L2 = dx * dx + dy * dy || 1e-9;
    for (let y = Math.max(0, miny); y <= Math.min(H - 1, maxy); y++) {
      for (let x = Math.max(0, minx); x <= Math.min(W - 1, maxx); x++) {
        const px = x + 0.5, py = y + 0.5;
        let u = ((px - x0) * dx + (py - y0) * dy) / L2; u = u < 0 ? 0 : u > 1 ? 1 : u;
        const qx = px - (x0 + dx * u), qy = py - (y0 + dy * u);
        const d2 = qx * qx + qy * qy;
        if (d2 > r * r) continue;
        put(x, y, tubeShade(qx / r, qy / r, rmp, x, y, specMul), h);
      }
    }
  }
  function tubePoly(xs, ys, r, rmp, h, specMul) {
    for (let k = 0; k + 1 < xs.length; k++) tubeSeg(xs[k], ys[k], xs[k + 1], ys[k + 1], r, rmp, h, specMul);
  }
  // shaded disc (sphere-ish dome)
  function dome(cx, cy, r, rmp, h, flat) {
    for (let y = fl(cy - r - 1); y <= cy + r + 1; y++) for (let x = fl(cx - r - 1); x <= cx + r + 1; x++) {
      const qx = x + 0.5 - cx, qy = y + 0.5 - cy, d2 = qx * qx + qy * qy;
      if (d2 > r * r) continue;
      put(x, y, tubeShade(qx / r * (flat || 1), qy / r * (flat || 1), rmp, x, y), h);
    }
  }
  function rectFill(x0, y0, x1, y1, c, h) { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) put(x, y, c, h); }
  // slotted brass screw head
  function screwHead(cx, cy, ang, h) {
    for (let y = -2; y <= 2; y++) for (let x = -2; x <= 2; x++) {
      const d2 = x * x + y * y; if (d2 > 5) continue;
      let c = tubeShade(x / 2.6, y / 2.6, BR, cx + x, cy + y, 0.8);
      const sl = Math.abs(x * Math.sin(ang) - y * Math.cos(ang));
      if (sl < 0.6 && d2 < 5) c = BR[1];
      put(cx + x, cy + y, c, h);
    }
  }

  /* ================================================================ track geometry */
  const R = 4, ROFF = 5.5, SP = 9;          // marble radius, rail-centre offset from marble centre, queue spacing
  const G = 1500, GR = 0.72 * G;            // px/s^2 free fall, rolling on rails
  const DRAG1 = 0.08, DRAG2 = 0.0016;
  const RAILS = [];                         // static rail pieces {type:'L'|'A', ...}
  function PB(x, y) { this.px = [x]; this.py = [y]; this.cx = x; this.cy = y; }
  PB.prototype.to = function (x, y, rail) {
    const x0 = this.cx, y0 = this.cy, L = Math.hypot(x - x0, y - y0), n = Math.max(1, Math.ceil(L / 0.2));
    for (let k = 1; k <= n; k++) { this.px.push(lerp(x0, x, k / n)); this.py.push(lerp(y0, y, k / n)); }
    if (rail !== false) {
      let nx = -(y - y0) / L, ny = (x - x0) / L; if (ny < 0) { nx = -nx; ny = -ny; }
      RAILS.push({ type: 'L', x0: x0 + nx * ROFF, y0: y0 + ny * ROFF, x1: x + nx * ROFF, y1: y + ny * ROFF });
    }
    this.cx = x; this.cy = y; return this;
  };
  PB.prototype.arc = function (cx, cy, r, a0, a1, rail) {
    const n = Math.max(2, Math.ceil(Math.abs(a1 - a0) * r / 0.2));
    for (let k = 1; k <= n; k++) { const a = lerp(a0, a1, k / n); this.px.push(cx + r * Math.cos(a)); this.py.push(cy + r * Math.sin(a)); }
    if (rail !== false) RAILS.push({ type: 'A', cx, cy, r: r + ROFF, a0, a1 });
    this.cx = this.px[this.px.length - 1]; this.cy = this.py[this.py.length - 1]; return this;
  };
  // resample to uniform arc length (0.25 px)
  const PSTEP = 0.25;
  PB.prototype.done = function () {
    const n = this.px.length, cs = new Float64Array(n);
    for (let k = 1; k < n; k++) cs[k] = cs[k - 1] + Math.hypot(this.px[k] - this.px[k - 1], this.py[k] - this.py[k - 1]);
    const L = cs[n - 1], m = Math.floor(L / PSTEP) + 2;
    const X = new Float64Array(m), Y = new Float64Array(m);
    let k = 0;
    for (let i = 0; i < m; i++) {
      const s = Math.min(L, i * PSTEP);
      while (k < n - 2 && cs[k + 1] < s) k++;
      const u = (s - cs[k]) / Math.max(1e-9, cs[k + 1] - cs[k]);
      X[i] = lerp(this.px[k], this.px[k + 1], u); Y[i] = lerp(this.py[k], this.py[k + 1], u);
    }
    return new Path(X, Y, L);
  };
  function Path(X, Y, L) { this.X = X; this.Y = Y; this.L = L; this.n = X.length; }
  Path.prototype.at = function (s, o) {
    let f = s / PSTEP; if (f < 0) f = 0; if (f > this.n - 1.001) f = this.n - 1.001;
    const i = f | 0, u = f - i;
    o.x = lerp(this.X[i], this.X[i + 1], u); o.y = lerp(this.Y[i], this.Y[i + 1], u);
    const j0 = Math.max(0, i - 2), j1 = Math.min(this.n - 1, i + 3);
    const dx = this.X[j1] - this.X[j0], dy = this.Y[j1] - this.Y[j0], dl = Math.hypot(dx, dy) || 1;
    o.tx = dx / dl; o.ty = dy / dl; return o;
  };
  Path.prototype.sAtX = function (x, s0) { // first s (after s0) whose x passes x
    for (let i = Math.max(1, Math.ceil((s0 || 0) / PSTEP)); i < this.n; i++) if ((this.X[i - 1] - x) * (this.X[i] - x) <= 0) return i * PSTEP;
    return -1;
  };

  // --- screw lift
  const XS = 250, YIN = 322, YOUT = 17, VS = 144, PITCH = 24, TROT = 1 / 6;
  // --- funnel
  const FX = 106, FY = 116, FR = 42, FAS = 0.24, FRS = 4.5, FH = 38;
  const fy = (r) => FY + FH * (FR / r - 1) / (FR / FRS - 1);
  const FSPOUT = 161;
  // --- catch wheel
  const WX = 124, WY = 185, WRP = 21, WRIM = 26, WNP = 9, WPER = 4.5, WW = TAU / WPER;
  const WTC = -Math.asin((WX - FX) / WRP), WTD = -200 * PI / 180;
  // --- see-saw
  const SSX = 188, SSY = 222, A0 = 5 * PI / 180, AT = 33 * PI / 180;
  const ARM_IN = -16, ARM_END = 28, SPOT_L = 23, SPOT_F = 14;
  const armPt = (s, a, o) => { o.x = SSX + s * Math.cos(a) + ROFF * Math.sin(a); o.y = SSY + s * Math.sin(a) - ROFF * Math.cos(a); return o; };
  // --- C catch after the see-saw
  const CCX = 222, CCY = 244, CCR = 10, CA0 = -60 * PI / 180;
  // --- metronome gate & elevator
  const GATEX = 204, DOORX = 178, CARDK = 44, FLOOR_M = -0.2, CART = 26, PEND_A = 0.36;
  const DROPX = 148, DROPY = 266, DROPR = 6.5, SPOT0 = 3.5;
  const DOORY = DROPY + 2 * DROPR + (DOORX - DROPX) * 0.2;
  const BOTX = 182;
  const PUL_R = 16, PUL_X = 140, PUL_Y = 236, CW_X = 124, CW_Y0 = 296, PEND_Y = 268, PEND_L = 17;

  const tmp = { x: 0, y: 0, tx: 0, ty: 0 }, tmp2 = { x: 0, y: 0, tx: 0, ty: 0 };
  // path A: screw top, R1, C-bend, R2a with kicker
  const R2Y = (x) => 43 + (x - 24) * (61 - 43) / (226 - 24);
  const PA = new PB(XS, YOUT).to(243, 18.5, false).to(236, 21).to(24, 30).arc(24, 36.5, 6.5, -PI / 2, -3 * PI / 2)
    .to(104, R2Y(104)).to(109, R2Y(104) - 3.5).done();
  // path B: R2b, C-bend, chime staircase, C-bend, R4 into funnel rim
  const R2B0 = 146;
  const PBp = new PB(R2B0, R2Y(R2B0) + 1.3).to(226, 61).arc(226, 67.5, 6.5, -PI / 2, PI / 2)
    .to(34, 92, false).arc(34, 98.5, 6.5, -PI / 2, -3 * PI / 2).to(FX - FR, FY).done();
  const XYL0 = PBp.sAtX(226) + 6.5 * PI + 1; // chime run starts after the right bend
  // path L1: under the wheel to the see-saw
  armPt(ARM_IN, A0, tmp);
  const PL1 = new PB(126, 207.4).to(tmp.x, tmp.y).done();
  // path G: C catch, L3, into the car (car floor not a static rail)
  const B0 = Math.atan(FLOOR_M);
  const RAIL_FRONT0 = RAILS.length;
  const PG = new PB(CCX + CCR * Math.cos(CA0), CCY + CCR * Math.sin(CA0)).arc(CCX, CCY, CCR, CA0, PI / 2)
    .to(DROPX, DROPY).arc(DROPX, DROPY + DROPR, DROPR, -PI / 2, -3 * PI / 2)
    .to(DOORX, DOORY, false).done();
  const RAIL_FRONT1 = RAILS.length;
  const G_SA = PG.sAtX(GATEX), G_SFLAP = PG.sAtX(DROPX + 2), G_SDOOR = PG.L;
  // bottom rail (static) from the car door to the screw inlet
  const PBOT = new PB(BOTX, DOORY + CART + 1.2).to(XS - 3, YIN - 0.4).to(XS, YIN, false).done();

  // chime bars along the staircase
  const NBAR = 12, BARS = [];
  (function () {
    const x0 = 214, x1 = 44;
    for (let k = 0; k < NBAR; k++) {
      const x = lerp(x0, x1, k / (NBAR - 1));
      const s = PBp.sAtX(x, XYL0); PBp.at(s, tmp);
      BARS.push({ x, y: tmp.y + R + 0.5, w: Math.round(lerp(14, 10, k / (NBAR - 1))), s, u: 0, col: k });
    }
  })();

  /* ================================================================ mechanism clocks (all periodic, periods divide D) */
  let TC0 = 0, TIP0 = Infinity, RS0 = 0, W0 = 0, RS_SET = false, W_SET = false;
  const screwAng = (t) => TAU * t / TROT;
  const threadY = (t) => mod(YIN + R + 1 - VS * t, PITCH);    // crest phase in y
  const wheelAng = (t) => WTC - WW * (t - TC0);                // pocket 0
  const pendAng = (t) => -PEND_A * Math.cos(TAU * (t - RS0) / DT);
  function ssAlpha(t) {
    if (!isFinite(TIP0)) return A0;
    const c = mod(t - TIP0, 1);
    if (c < 0.085) { const u = c / 0.085; return A0 + (AT - A0) * u * u; }
    if (c < 0.27) { const d = c - 0.085; return AT - 0.07 * Math.abs(Math.sin(d * 26)) * Math.exp(-d * 16); }
    if (c < 0.39) { const u = (c - 0.27) / 0.12; return AT + (A0 - AT) * u * u; }
    const d = c - 0.39; return A0 + 0.06 * Math.abs(Math.sin(d * 24)) * Math.exp(-d * 11);
  }
  const EL_TOP = 0.85, EL_DOWN = 1.15, EL_BOT = 1.75;
  function carOff(t) {
    const c = mod(t - W0, 2);
    if (c < EL_TOP) return 0;
    if (c < EL_DOWN) { const u = (c - EL_TOP) / (EL_DOWN - EL_TOP); return CART * u * u * (3 - 2 * u) ; }
    if (c < EL_BOT) { const d = c - EL_DOWN; return CART - 1.6 * Math.abs(Math.sin(d * 22)) * Math.exp(-d * 14); }
    const u = (c - EL_BOT) / (2 - EL_BOT); return CART * (1 - u * u * (3 - 2 * u));
  }
  const TILT_D = -0.5;
  function carTilt(t) { // floor angle (positive: low at far wall)
    const c = mod(t - W0, 2), b0 = B0;
    if (c < EL_DOWN + 0.01 || c > EL_BOT) return b0;
    if (c < EL_DOWN + 0.06) return lerp(b0, TILT_D, sstep(EL_DOWN + 0.01, EL_DOWN + 0.06, c));
    if (c < EL_BOT - 0.07) return TILT_D;
    return lerp(TILT_D, b0, sstep(EL_BOT - 0.07, EL_BOT - 0.01, c));
  }
  const doorOpen = (t) => W_SET && mod(t - W0, 2) < 0.66;
  function carSpot(dk, t, o) { const b = carTilt(t), oy = carOff(t); o.x = DOORX - dk * Math.cos(b); o.y = DOORY + oy + dk * Math.sin(b); return o; }
  // dump path: tilted floor from the far wall to the door, then the bottom rail
  const PDUMP = (function () {
    const b = TILT_D, y0 = DOORY + CART;
    const pb = new PB(DOORX - CARDK * Math.cos(b), y0 + CARDK * Math.sin(b)).to(DOORX, y0, false);
    for (let i = 1; i < PBOT.n; i += 4) pb.to(PBOT.X[i], PBOT.Y[i], false);
    pb.to(XS, YIN, false);
    return pb.done();
  })();

  /* ================================================================ circuit simulation */
  const SDT = 1 / 960, RECN = 4, RHZ = 240, NREC = D * RHZ;
  let S = null;
  const EV = { bar: [], warn: [] };
  function simBegin(j) {
    S = { j, t0: j * DT, n: 0, x: XS, y: YIN, rot: 0, spin: 1, lay: 2, X: new Float32Array(NREC + 1), Y: new Float32Array(NREC + 1),
      RT: new Float32Array(NREC + 1), LY: new Uint8Array(NREC + 1), done: false, info: { ev: [] } };
    rec0();
  }
  function rec0() { const k = S.n / RECN; S.X[k] = S.x; S.Y[k] = S.y; S.RT[k] = S.rot; S.LY[k] = S.lay; }
  const now = () => S.t0 + S.n * SDT;
  const uNow = () => S.n * SDT;
  function tick() {
    S.n++;
    if (S.n % RECN === 0) { const k = S.n / RECN; if (k <= NREC) { S.X[k] = S.x; S.Y[k] = S.y; S.RT[k] = S.rot; S.LY[k] = S.lay; } else S.done = true; }
  }
  function spinBy(dist, tx) { if (tx > 0.25) S.spin = 1; else if (tx < -0.25) S.spin = -1; S.rot += S.spin * dist / R; }
  // roll along a path; o.target(t) caps s (queues / stops), o.until(t,s,v) ends early
  function roll(P, s, v, o) {
    o = o || {};
    const sEnd = o.sEnd !== undefined ? o.sEnd : P.L;
    P.at(s, tmp); S.x = tmp.x; S.y = tmp.y;
    for (;;) {
      if (S.done) return { s, v };
      const t = now();
      if (o.until && o.until(t, s, v)) return { s, v };
      let tg = o.target ? o.target(t) : 1e9;
      let lv = -1;
      if (o.lead) { const ls = o.lead(t); if (ls - SP < tg) { tg = ls - SP; lv = Math.max(0, (ls - o.lead(t - SDT)) / SDT); if (lv > 2000) lv = 0; } }
      if (o.rec) o.rec.push(s);
      P.at(s, tmp);
      v += (GR * tmp.ty - DRAG1 * v - DRAG2 * v * Math.abs(v)) * SDT;
      if (v < 0 && s <= 0.01) v = 0;
      let ns = s + v * SDT;
      if (ns >= tg) { ns = Math.max(s, tg); v = lv >= 0 ? Math.min(v, lv) : 0; }
      if (o.onS) o.onS(s, ns, t);
      spinBy(ns - s, tmp.tx);
      s = ns;
      if (s >= sEnd) { P.at(sEnd, tmp); S.x = tmp.x; S.y = tmp.y; return { s: sEnd, v, tx: tmp.tx, ty: tmp.ty }; }
      P.at(s, tmp); S.x = tmp.x; S.y = tmp.y;
      tick();
    }
  }
  function hold(until, posFn) { while (!S.done && now() < until) { posFn(now()); tick(); } }
  // ballistic flight; land(x,y,vx,vy) returns {s,v} on contact (or null)
  function fly(x, y, vx, vy, land) {
    for (;;) {
      if (S.done) return null;
      vy += G * SDT; x += vx * SDT; y += vy * SDT;
      S.x = x; S.y = y; S.rot += S.spin * Math.hypot(vx, vy) * SDT / R * 0.6;
      const L = land(x, y, vx, vy);
      if (L) {
        if (L.bounce) { x = L.x; y = L.y; vx = L.vx; vy = L.vy; S.x = x; S.y = y; tick(); continue; }
        return L;
      }
      tick();
    }
  }
  // land on the first straight piece of a path (with one or two small bounces)
  function lineLand(P) {
    P.at(0, tmp2);
    const x0 = tmp2.x, y0 = tmp2.y, tx = tmp2.tx, ty = tmp2.ty;
    let nx = -ty, ny = tx; if (ny < 0) { nx = -nx; ny = -ny; }
    return (x, y, vx, vy) => {
      const u = (x - x0) * tx + (y - y0) * ty, d = (x - x0) * nx + (y - y0) * ny;
      if (d < 0 || u < -1 || u > 90) return null;
      const vt = vx * tx + vy * ty, vn = vx * nx + vy * ny;
      if (vn > 90) { const b = -0.32 * vn; return { bounce: true, x: x - d * nx, y: y - d * ny, vx: tx * vt + nx * b, vy: ty * vt + ny * b }; }
      return { s: Math.max(0, u), v: Math.max(0, vt) * 0.92 };
    };
  }
  function circLand() {
    let inside = false;
    return (x, y, vx, vy) => {
      const dx = x - CCX, dy = y - CCY, d = Math.hypot(dx, dy);
      if (d < CCR - 0.5) inside = true;
      if (!inside || d < CCR) return null;
      const a = Math.atan2(dy, dx);
      if (a < CA0 || a > PI / 2) return null;
      const tx = -dy / d, ty = dx / d; // clockwise tangent
      return { s: (a - CA0) * CCR, v: Math.max(30, vx * tx + vy * ty) * 0.9 };
    };
  }
  // gate & door bookkeeping across marbles
  const REL = [], ADV = [], DROPT = [], BATCH = [], INCAR = [];
  const PROBE = { mode: true };
  const RECS = { PG: [], PD: [] };
  function leadFn(store, j) {
    const L = store[j - 1];
    if (!L) return null;
    return (t) => { if (t < L.t0) return 1e9; const k = Math.round((t - L.t0) / SDT); return k < L.s.length ? L.s[k] : 1e9; };
  }
  function evt(k) { S.info.ev.push({ u: uNow(), x: S.x, y: S.y, k }); }
  function warn(m) { if (EV.warn.length < 40) EV.warn.push(m); }

  function runMarble(j, upTo) {
    simBegin(j);
    // 1. screw lift
    const tUp = (YIN - YOUT) / VS;
    S.lay = 2;
    hold(S.t0 + tUp, (t) => { const u = t - S.t0; S.x = XS; S.y = YIN - VS * u; S.rot += 0.004; });
    // 2. R1, bend, R2a, kicker
    S.lay = 0;
    let r = roll(PA, 0, 55);
    S.info.kickV = r.v;
    let L = fly(S.x, S.y, r.v * r.tx, r.v * r.ty, lineLand(PBp));
    S.info.landX = S.x; evt(0);
    // 3. R2b, bend, chime staircase, bend, R4
    const barHit = BARS.map(() => -1);
    r = roll(PBp, L.s, L.v, { onS: (s0, s1, t) => { for (let k = 0; k < NBAR; k++) if (s0 < BARS[k].s && s1 >= BARS[k].s) barHit[k] = t - S.t0; } });
    if (j === 0) for (let k = 0; k < NBAR; k++) BARS[k].u = barHit[k];
    // 4. vortex funnel
    S.lay = 1;
    let fr = FR, ph = PI;
    const vin = Math.max(60, r.v), w0 = vin / FR, c1 = 9;
    S.info.funIn = uNow(); S.info.vin = vin;
    while (!S.done && fr > FRS) {
      fr -= c1 * Math.pow(FR / fr, 0.9) * SDT;
      if (fr < FRS) fr = FRS;
      const w = w0 * Math.pow(FR / fr, 0.85);
      ph -= w * SDT;
      S.x = FX + fr * Math.cos(ph); S.y = fy(fr) + FAS * fr * Math.sin(ph);
      S.rot += w * fr * SDT / R;
      tick();
    }
    S.info.funT = uNow() - S.info.funIn; S.info.funRev = (PI - ph) / TAU;
    // 5. drop through the spout into a bucket
    const yC = WY - WRP * Math.cos(WTC);
    let vy = 45, y = S.y;
    while (!S.done && y < yC) { vy += G * SDT; y = Math.min(yC, y + vy * SDT); S.x = FX; S.y = y; S.lay = y < FSPOUT ? 1 : 3; tick(); }
    const tc = now(); evt(1);
    if (PROBE.mode && j === 0) TC0 = tc;
    if (!PROBE.mode) { const e = mod(wheelAng(tc) + TAU * j / WNP - WTC + PI, TAU) - PI; if (Math.abs(e) > 0.02) warn('wheel miss ' + j + ' ' + e.toFixed(3)); }
    if (upTo === 'catch') return;
    S.lay = 3;
    const tdump = tc + (WTC - WTD) / WW;
    hold(tdump, (t) => { const a = wheelAng(t) + TAU * j / WNP; S.x = WX + WRP * Math.sin(a); S.y = WY - WRP * Math.cos(a); S.rot -= WW * SDT; });
    // 6. tip out of the bucket onto L1
    S.lay = 0;
    {
      const a = WTD;
      const vx = WRP * Math.cos(a) * -WW + 14, vy2 = WRP * Math.sin(a) * -WW + 10;
      L = fly(S.x, S.y, vx, vy2, lineLand(PL1)); evt(0);
      r = roll(PL1, L.s, L.v);
    }
    // 7. see-saw: roll along the arm to the stop, wait for the tip, roll off the end
    {
      const leader = (j % 2) === 0, spot = leader ? SPOT_L : SPOT_F;
      let s = ARM_IN, v = r.v, landed = -1, tip = Infinity;
      if (!PROBE.mode) tip = TIP0 + Math.floor(j / 2) * 1.0;
      while (!S.done) {
        const t = now(), a = ssAlpha(t);
        const pinUp = t < tip || mod(t - TIP0, 1) > 0.5;   // stop pin effective while the arm is near rest
        v += (GR * Math.sin(a) - DRAG1 * v) * SDT;
        let ns = s + v * SDT;
        if (pinUp && ns >= spot) { ns = spot; v = 0; if (landed < 0) landed = t; }
        if (!pinUp && t < tip) { /* never */ }
        spinBy(ns - s, 1); s = ns;
        armPt(s, a, tmp); S.x = tmp.x; S.y = tmp.y;
        if (s >= ARM_END) break;
        if (PROBE.mode && landed >= 0 && !leader) { S.info.spotT = landed - S.t0; return S; }
        tick();
      }
      const t = now(), a = ssAlpha(t), da = (ssAlpha(t + 0.002) - ssAlpha(t - 0.002)) / 0.004;
      const vx = v * Math.cos(a) - da * s * Math.sin(a), vy3 = v * Math.sin(a) + da * s * Math.cos(a);
      S.info.offArm = t - (isFinite(tip) ? tip : 0);
      if (!PROBE.mode && mod(t - TIP0, 1) > 0.27) warn('late off arm ' + j + ' ' + mod(t - TIP0, 1).toFixed(3));
      L = fly(S.x, S.y, vx, vy3, circLand()); evt(0);
    }
    // 8. C catch, L3, metronome gate, door queue, into the car
    {
      // free arrival time at the gate stop (look-ahead copy of the physics)
      let s = L.s, v = L.v, ta = now();
      { let ss = s, vv = v; P_loop: for (let k = 0; k < 20000; k++) { PG.at(ss, tmp); vv += (GR * tmp.ty - DRAG1 * vv - DRAG2 * vv * vv) * SDT; ss += vv * SDT; ta += SDT; if (ss >= G_SA) break P_loop; } }
      if (!RS_SET) { RS0 = ta + 0.28; RS_SET = true; }
      const prev = REL[j - 1];
      let adv = -1e9, rel;
      if (prev !== undefined && prev > ta - 0.02) { adv = prev + 0.19; rel = prev + DT; }
      else { const n = Math.ceil((ta + 0.08 - RS0) / DT); rel = RS0 + n * DT - 0.06; }
      REL[j] = rel; ADV[j] = adv;
      S.info.gateWait = rel - ta;
      let passed = false, idx = -1, b = -999;
      const tgt = (t) => {
        if (t < rel) return t < adv ? G_SA - SP : G_SA;
        if (passed) return G_SDOOR - SPOT0 - SP * idx;
        if (doorOpen(t)) return 1e9;
        let k = 0;
        for (let i = j - 1; i >= Math.max(0, j - 8); i--) if (DROPT[i] === undefined || DROPT[i] > t) k++;
        return G_SFLAP - SP * k;
      };
      RECS.PG[j] = { t0: now(), s: [] };
      r = roll(PG, s, v, {
        target: tgt, lead: leadFn(RECS.PG, j), rec: RECS.PG[j].s,
        onS: (s0, s1, t) => {
          if (!W_SET && j === 0 && s1 >= G_SFLAP - 0.01) { W0 = t + 1.3; W_SET = true; }
          if (!passed && s1 > G_SFLAP + 0.5) {
            passed = true; DROPT[j] = t; S.lay = 4;
            b = Math.floor((t - W0 + 1e-6) / 2); BATCH[j] = b;
            idx = 0; for (let i = j - 1; i >= Math.max(0, j - 8); i--) if (BATCH[i] === b) idx++;
            INCAR[j] = idx;
          }
        },
        until: (t) => passed && mod(t - W0, 2) >= EL_TOP && mod(t - W0, 2) < 1.9,
      });
      const sSpot = G_SDOOR - SPOT0 - SP * idx;
      if (!passed || idx > 3) warn('boarding ' + j + ' idx ' + idx);
      if (Math.abs(r.s - sSpot) > 0.6) warn('not settled ' + j + ' s=' + r.s.toFixed(2) + ' want ' + sSpot.toFixed(2) + ' t=' + mod(now() - W0, 2).toFixed(3));
      S.info.car = idx;
      // 9. ride down, tip out through the door
      const dk = SPOT0 + SP * idx;
      const cyc0 = W0 + 2 * b;
      const tRoll = cyc0 + EL_DOWN + 0.06;
      hold(tRoll, (t) => carSpot(dk, t, S));
      const E = S.t0 + D;
      const tq = (t) => { const k = Math.max(0, Math.ceil((E - t) / DT - 1e-6) - 1); return PDUMP.L - SP * k; };
      RECS.PD[j] = { t0: now(), s: [] };
      r = roll(PDUMP, CARDK - dk, 0, { target: tq, lead: leadFn(RECS.PD, j), rec: RECS.PD[j].s, until: (t) => t >= E - SDT * 0.5, onS: (s0, s1, t) => { S.lay = s1 < CARDK + 2 ? 4 : 0; if (S.info.qT === undefined && s1 === s0 && s1 > CARDK) S.info.qT = t - S.t0; } });
      if (mod(now() - W0, 2) < EL_BOT && S.lay === 4) warn('still in car ' + j);
      S.info.queueAt = r.s; S.info.endS = PDUMP.L;
    }
    // finish the record at the inlet
    while (!S.done) tick();
    return S;
  }

  let TRACK = null; // per class: {X,Y,RT,LY}
  function simulate() {
    // probes: catch phase, then follower spot time
    PROBE.mode = true;
    runMarble(0, 'catch');
    const pr = runMarble(1);
    TIP0 = 1 * DT + pr.info.spotT + 0.06;
    PROBE.mode = false;
    const M = 40, runs = [];
    for (let j = 0; j < M; j++) runs.push(runMarble(j));
    TRACK = [];
    for (let c = 0; c < 4; c++) TRACK.push(runs[36 + c]);
    // periodicity check against the previous cycle of the same class
    let md = 0;
    for (let c = 0; c < 4; c++) { const a = runs[36 + c], b = runs[32 + c]; for (let k = 0; k <= NREC; k++) md = Math.max(md, Math.abs(a.X[k] - b.X[k]) + Math.abs(a.Y[k] - b.Y[k])); }
    EV.classDiff = md;
    EV.info = TRACK.map((r) => r.info);
    EV.endJump = TRACK.map((r) => Math.hypot(r.X[NREC] - r.X[0], r.Y[NREC] - r.Y[0]));
  }

  /* ================================================================ static scene */
  function vnoise(x, y, s) {
    const xi = fl(x), yi = fl(y), fx = x - xi, fy2 = y - yi;
    const a = ih(xi, yi, s), b = ih(xi + 1, yi, s), c = ih(xi, yi + 1, s), d = ih(xi + 1, yi + 1, s);
    const ux = fx * fx * (3 - 2 * fx), uy = fy2 * fy2 * (3 - 2 * fy2);
    return lerp(lerp(a, b, ux), lerp(c, d, ux), uy);
  }
  function buildPanel() {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const warp = 10 * vnoise(x * 0.011, y * 0.025, 11) + 3 * vnoise(x * 0.05, y * 0.07, 12);
      const g = y * 0.5 + warp * 2.0;
      const ring = 0.5 + 0.5 * Math.sin(g * 1.25 + 2.5 * vnoise(x * 0.02, y * 0.02, 13));
      const streak = vnoise(x * 0.12, y * 1.1, 14);
      const fig = vnoise(x * 0.008, y * 0.012, 15);
      const dxn = (x - W / 2) / (W / 2), dyn = (y - H / 2) / (H / 2);
      const lamp = Math.exp(-((x - 120) * (x - 120) + (y - 150) * (y - 150)) / (2 * 120 * 120));
      let v = 0.34 + 0.24 * lamp + 0.22 * ring * ring + 0.2 * (streak - 0.5) + 0.16 * (fig - 0.5) - 0.2 * (dxn * dxn * 0.8 + dyn * dyn * 0.6);
      // plank seams
      const seam = (y + fl(warp * 0.2)) % 85;
      if (seam === 0) v = 0.02; else if (seam === 1) v += 0.08;
      PANEL[y * W + x] = rampI([0, 1, 2, 3, 4], v, x, y);
    }
  }
  function arcPts(cx, cy, r, a0, a1) {
    const n = Math.max(2, Math.ceil(Math.abs(a1 - a0) * r / 1.2)), xs = [], ys = [];
    for (let k = 0; k <= n; k++) { const a = lerp(a0, a1, k / n); xs.push(cx + r * Math.cos(a)); ys.push(cy + r * Math.sin(a)); }
    return { xs, ys };
  }
  function tubeArc(cx, cy, r, a0, a1, rad, rmp, h) { const p = arcPts(cx, cy, r, a0, a1); tubePoly(p.xs, p.ys, rad, rmp, h); }
  function bracket(x, y, dx, dy, len) { // brass strap from a rail to a screwed plate on the panel
    for (let k = 0; k <= len; k++) {
      const px = Math.round(x + dx * k), py = Math.round(y + dy * k);
      put(px, py, k < len * 0.5 ? BR[3] : BR[2], 1);
      put(px + (Math.abs(dy) > 0.5 ? 1 : 0), py + (Math.abs(dy) > 0.5 ? 0 : 1), BR[1], 1);
    }
    const ex = Math.round(x + dx * len), ey = Math.round(y + dy * len);
    for (let yy = -1; yy <= 1; yy++) for (let xx = -2; xx <= 2; xx++) put(ex + xx, ey + yy, yy < 0 ? BR[3] : yy > 0 ? BR[1] : BR[2], 1);
    put(ex, ey, BR[0], 1); put(ex - 1, ey - 1, BR[4], 1);
  }
  function drawRails() {
    for (const rp of RAILS) {
      if (rp.type === 'L') {
        const L = Math.hypot(rp.x1 - rp.x0, rp.y1 - rp.y0), n = Math.floor(L / 46);
        for (let k = 0; k < n; k++) { const u = (k + 0.5) / n; bracket(lerp(rp.x0, rp.x1, u), lerp(rp.y0, rp.y1, u) + 1, 0, 1, 4); }
      } else {
        const am = (rp.a0 + rp.a1) / 2;
        bracket(rp.cx + rp.r * Math.cos(am), rp.cy + rp.r * Math.sin(am), Math.cos(am), Math.sin(am), 4);
      }
    }
    RAILS.forEach((rp, k) => { if (k < RAIL_FRONT0 || k >= RAIL_FRONT1) railDraw(rp); });
  }
  function railDraw(rp) {
    if (rp.type === 'L') tubeSeg(rp.x0, rp.y0, rp.x1, rp.y1, 1.6, BR, 2);
    else tubeArc(rp.cx, rp.cy, rp.r, rp.a0, rp.a1, 1.6, BR, 2);
  }
  // funnel silhouette helpers
  const FUN_BACK = new Float32Array(NP); // back-surface radius (0 = none)
  const FUN_SIL = new Uint8Array(NP);
  function funnelInside(dx, py) {
    if (Math.abs(dx) <= FRS + 0.6 && py >= fy(FR * 0.999) && py <= FSPOUT + 0.5 && py >= fy(FRS) - 1) return true;
    for (let r = Math.max(FRS, Math.abs(dx)); r <= FR; r += 0.25) {
      const e = FAS * Math.sqrt(Math.max(0, r * r - dx * dx));
      if (Math.abs(py - fy(r)) <= e + 0.35) return true;
    }
    return false;
  }
  function buildFunnel() {
    const x0 = FX - FR - 2, x1 = FX + FR + 2, y0 = FY - 14, y1 = FSPOUT + 2;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const i = y * W + x, dx = x + 0.5 - FX, py = y + 0.5;
      if (!funnelInside(dx, py)) continue;
      FUN_SIL[i] = 1;
      // back surface: yb(r) = fy(r) - e(r), decreasing in r
      const rmin = Math.max(FRS, Math.abs(dx) + 0.01);
      const yb = (r) => fy(r) - FAS * Math.sqrt(Math.max(0, r * r - dx * dx));
      if (py >= yb(FR) && py <= yb(rmin)) {
        let a = rmin, b = FR;
        for (let k = 0; k < 30; k++) { const m = (a + b) / 2; if (yb(m) > py) a = m; else b = m; }
        FUN_BACK[i] = (a + b) / 2;
      }
    }
    // static back: glass seen through, with contour rings of the vortex
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const i = y * W + x; if (!FUN_SIL[i]) continue;
      const rb = FUN_BACK[i];
      let c = THRU[DARK[PANEL[i]]];
      if (rb > 0) {
        for (const rk of [9, 15, 22, 30, 37]) if (Math.abs(rb - rk) < 0.32 + rk * 0.004) c = GL[1];
        if (rb < 7) c = GL[1];
      } else c = THRU[PANEL[i]];
      put(x, y, c, 1);
    }
    // back half of the brass rim
    const pts = arcPts(FX, FY, FR, PI, TAU);
    const xs = pts.xs, ys = pts.ys.map((v) => FY + (v - FY) * FAS);
    tubePoly(xs, ys, 1.3, BR, 2);
  }
  function buildFunnelFront() {
    const x0 = FX - FR - 2, x1 = FX + FR + 2, y0 = FY - 14, y1 = FSPOUT + 2;
    for (let y = y0; y <= y1; y++) {
      let l = -1, r = -1;
      for (let x = x0; x <= x1; x++) if (FUN_SIL[y * W + x]) { if (l < 0) l = x; r = x; }
      if (l < 0) continue;
      const half = (r - l + 1) / 2, cx = (l + r + 1) / 2;
      if (y > FY + 2) { put(l, y, GL[3], 2); put(r, y, GL[2], 2); }
      for (let x = l + 1; x < r; x++) {
        const dx = x + 0.5 - cx;
        if (Math.abs(dx + half * 0.62) < 0.7 && y > FY + 1 && bay(x, y) < 0.55) put(x, y, GL[3], 2);
        else if (Math.abs(dx + half * 0.5) < 0.6 && y > FY + 3 && bay(x, y) < 0.18) put(x, y, C_WHITE, 2);
        else if (Math.abs(dx - half * 0.55) < 0.6 && y > FY + 4 && bay(x, y) < 0.15) put(x, y, GL[2], 2);
      }
    }
    // front glass ring highlights (sparse)
    for (const rr of [16, 28]) {
      const yc = fy(rr);
      for (let a = 0.15; a < PI - 0.15; a += 0.02) {
        const x = Math.floor(FX + rr * Math.cos(a)), y = Math.floor(yc + FAS * rr * Math.sin(a));
        if (bay(x, y) < 0.4) put(x, y, GL[2], 2);
      }
    }
    const pts = arcPts(FX, FY, FR, 0, PI);
    const xs = pts.xs, ys = pts.ys.map((v) => FY + (v - FY) * FAS);
    tubePoly(xs, ys, 1.4, BR, 2);
    // spout collar
    for (let y = FSPOUT - 3; y <= FSPOUT; y++) for (let x = FX - 6; x <= FX + 5; x++) {
      const nx = (x + 0.5 - FX) / 6.2;
      put(x, y, tubeShade(nx, (y - FSPOUT + 1.5) / 4, BR, x, y), 2);
    }
  }
  function buildScrewTube() {
    for (let y = 6; y <= 333; y++) for (let x = XS - 11; x <= XS + 11; x++) {
      const dx = x + 0.5 - XS, i = y * W + x;
      if (Math.abs(dx) > 10.5) continue;
      let c = THRU[DARK[PANEL[i]]];
      if (Math.abs(dx) > 9.2) c = dx < 0 ? GL[1] : GL[2];
      put(x, y, c, 1);
    }
  }
  function buildScrewFront() {
    for (let y = 10; y <= 330; y++) {
      const open = (y < 25) || (y > 312);
      for (let x = XS - 10; x <= XS + 10; x++) {
        const dx = x + 0.5 - XS;
        if (Math.abs(dx) > 9.2 && !(open && dx < 0)) { put(x, y, dx < 0 ? GL[2] : GL[1], 2); continue; }
        if (open && dx < -2) continue;
        if (Math.abs(dx + 6.5) < 0.6) put(x, y, (ih(x, y >> 2, 5) < 0.3) ? C_WHITE : GL[3], 2);
        else if (Math.abs(dx - 7.5) < 0.6 && ih(x, y >> 3, 6) < 0.25) put(x, y, GL[2], 2);
      }
    }
    // caps and clamps
    for (const [ya, yb] of [[5, 10], [329, 334]]) for (let y = ya; y <= yb; y++) for (let x = XS - 11; x <= XS + 11; x++)
      put(x, y, tubeShade((x + 0.5 - XS) / 11.5, (y + 0.5 - (ya + yb + 1) / 2) / 4.5, BR, x, y), 2);
    for (let cy = 64; cy < 300; cy += 62) {
      for (let y = cy; y <= cy + 2; y++) for (let x = XS - 11; x <= XS + 11; x++) put(x, y, tubeShade((x + 0.5 - XS) / 11.5, (y - cy - 1) / 2.2, BR, x, y), 2);
      for (const sx of [-14, 14]) {
        for (let y = cy - 1; y <= cy + 3; y++) for (let x = XS + sx - 3; x <= XS + sx + 3; x++) put(x, y, (y === cy - 1 || x === XS + sx - 3) ? BR[4] : BR[2], 1);
        screwHead(XS + sx, cy + 1, ih(cy, sx, 9) * PI, 1);
      }
    }
  }
  function buildMisc() {
    // xylophone frame: a wooden beam under the bars, with pins
    const b0 = BARS[0], b1 = BARS[NBAR - 1];
    const wx = [], wy = [];
    for (let k = 0; k <= 20; k++) { const u = k / 20; wx.push(lerp(b0.x + 9, b1.x - 7, u)); wy.push(lerp(b0.y + 6, b1.y + 6, u)); }
    tubePoly(wx, wy, 1.7, [5, 6, 7, 8], 1);
    for (let k = 0; k < NBAR; k++) {
      const b = BARS[k];
      for (const ex of [-b.w / 2 + 1.5, b.w / 2 - 1.5]) { const px = Math.round(b.x + ex); put(px, Math.round(b.y + 4), ST[2], 1); put(px, Math.round(b.y + 5), ST[1], 1); }
    }
    bracket(lerp(b0.x, b1.x, 0.25), lerp(b0.y, b1.y, 0.25) + 7.5, 0, 1, 5);
    bracket(lerp(b0.x, b1.x, 0.75), lerp(b0.y, b1.y, 0.75) + 7.5, 0, 1, 5);
    // see-saw pivot post, stops and the fixed stop pin
    for (let y = SSY; y <= SSY + 14; y++) for (let x = SSX - 3; x <= SSX + 3; x++) put(x, y, rampI([5, 6, 7], 0.6 - (x - SSX) * 0.12 + 0.1 * vnoise(x, y * 0.3, 5), x, y), 1);
    bracket(SSX, SSY + 14, 0, 1, 3);
    armPt(SPOT_L, A0, tmp);
    const pinX = tmp.x + R + 1.2;
    tubeSeg(pinX, tmp.y - 9, pinX, tmp.y + 0.2, 0.9, BR, 2);
    bracket(pinX, tmp.y - 9, 0, -1, 3);
    // bumpers under the arm ends
    for (const [s, a] of [[-21, A0 - 0.035], [24, AT + 0.02]]) {
      const bx = SSX + s * Math.cos(a), by = SSY + s * Math.sin(a) + 6.5;
      for (let y = 0; y < 3; y++) for (let x = -2; x <= 2; x++) put(Math.round(bx + x), Math.round(by + y), y === 0 ? ST[2] : ST[1], 1);
      bracket(bx, by + 3, 0, 1, 3);
    }
    // elevator shaft guides and counterweight guides
    for (const gx of [DOORX - CARDK - 5, DOORX + 5, CW_X - 6, CW_X + 6]) tubeSeg(gx, PUL_Y + 6, gx, 330, 0.8, ST, 1);
    for (const gy of [PUL_Y + 18, 326]) for (const gx of [DOORX - CARDK - 5, DOORX + 5, CW_X - 6, CW_X + 6]) screwHead(Math.round(gx), gy, ih(gx, gy, 2) * 3, 1);
    // pulley bracket
    for (let y = PUL_Y - 4; y <= PUL_Y + 4; y++) for (let x = PUL_X - 3; x <= PUL_X + 3; x++) put(x, y, BR[2], 1);
    // metronome pin guides
    PG.at(G_SA, tmp);
    for (const ex of [-4.5, 4.5]) for (let y = 0; y < 4; y++) for (let x = -1; x <= 1; x++) put(Math.round(tmp.x + ex) + x, Math.round(tmp.y + 8) + y, y === 0 ? BR[4] : BR[2], 2);
    for (let y = -2; y <= 2; y++) for (let x = -3; x <= 3; x++) put(GATEX + x, PEND_Y + y, Math.abs(x) + Math.abs(y) < 4 ? BR[3] : BR[1], 1);
    // a few panel screws
    for (const [x, y] of [[229, 331], [8, 120], [60, 18], [180, 40], [140, 110], [58, 200], [228, 150], [196, 180]]) screwHead(x, y, ih(x, y, 1) * PI, 1);
  }
  function cornerPiece(cx, cy, sx, sy) {
    for (let k = 0; k < 22; k++) for (let w = 0; w < 3; w++) {
      const c = w === 0 ? BR[4] : w === 1 ? BR[3] : BR[1];
      put(cx + sx * k, cy + sy * w, c, 1); put(cx + sx * w, cy + sy * k, c, 1);
    }
    for (let a = 0; a <= 16; a++) {
      const an = a / 16 * PI / 2, x = Math.round(cx + sx * (3 + 9 * (1 - Math.cos(an)))), y = Math.round(cy + sy * (3 + 9 * (1 - Math.sin(an))));
      put(x, y, BR[3], 1); put(x + sx, y + sy, BR[1], 1);
    }
    screwHead(cx + sx * 5, cy + sy * 5, 0.7, 1);
    put(cx + sx * 21, cy + sy * 1, BR[5], 1); put(cx + sx * 1, cy + sy * 21, BR[5], 1);
  }
  function buildWheelGuide() {
    const r = WRP + R + 1.8;
    tubeArc(WX, WY, r, WTC - 0.2 - PI / 2, WTD + 0.04 - PI / 2, 1.3, BR, 2);
  }
  function buildStatic() {
    buildPanel();
    BUF = OUT; ZB = ZH;
    OUT.set(PANEL); ZH.fill(0);
    buildScrewTube();
    buildMisc();
    drawRails();
    buildFunnel();
    for (const [x0, x1] of [[FX - FR + 3, FX - FR - 10], [FX + FR - 3, FX + FR + 12]]) { tubeSeg(x0, FY + 2.5, x1, FY + 18, 1, BR, 2); bracket(x1, FY + 18, 0, 1, 2); }
    cornerPiece(1, 1, 1, 1); cornerPiece(1, H - 2, 1, -1);
    ST_OUT.set(OUT); ST_ZH.set(ZH);
    // front overlay
    OUT.fill(255); ZH.fill(0);
    buildFunnelFront();
    buildScrewFront();
    buildWheelGuide();
    for (let k = RAIL_FRONT0; k < RAIL_FRONT1; k++) railDraw(RAILS[k]);
    FO.set(OUT); FOZ.set(ZH);
    OUT.set(ST_OUT); ZH.set(ST_ZH);
  }

  /* ================================================================ gears */
  const GM = 1.5, GEARS = [];
  function gearMk(o) {
    o.Rp = GM * o.T / 2; o.Rt = o.Rp + 0.95 * GM; o.Rr = o.Rp - 1.15 * GM;
    o.Ri = o.Rr - Math.max(2, GM * 1.4); o.sw = o.T >= 24 ? 1.5 : 1.15;
    GEARS.push(o); return o;
  }
  function buildGears() {
    const g1 = gearMk({ x: WX, y: WY, T: 36, sp: 6, hub: 3, k: 1, a0: wheelAng(0) });
    const mesh = (par, T, phiDeg, sp, hub) => {
      const ph = phiDeg * PI / 180, d = GM * (par.T + T) / 2;
      const g = gearMk({ x: par.x + d * Math.cos(ph), y: par.y + d * Math.sin(ph), T, sp, hub });
      const uA = frac((ph - par.a0) * par.T / TAU);
      g.a0 = ph + PI - (0.5 - uA) * TAU / T; g.k = -par.k * par.T / T; return g;
    };
    const axle = (par, T, hub) => gearMk({ x: par.x, y: par.y, T, sp: 0, hub, a0: par.a0, k: par.k, small: true });
    const g2 = mesh(g1, 12, 140, 4, 2.5);
    const g2b = axle(g2, 8, 2);
    const g3 = mesh(g2b, 48, 125, 6, 5);
    const g4 = mesh(g3, 16, 200, 5, 3);
    const g5 = mesh(g3, 24, 70, 5, 3.5);
    mesh(g5, 12, 140, 4, 2.5);
    const g7 = mesh(g4, 24, 283, 5, 3.5);
    const g8 = mesh(g7, 16, 255, 5, 3);
    const g9 = mesh(g8, 12, 300, 4, 2.5);
    FLY.g = g9;
    buildChain();
  }
  /* chain drive from the wheel axle to the Geneva drive, and the Geneva (Maltese cross) wheel */
  const FLY = { g: null, R: 15 };
  const CH_A = { x: WX, y: WY, r: 9 }, CH_B = { x: 204, y: 166, r: 6 }, CH_Q = PI;
  const GEN = { x: 204, y: 138, a: 14, C: 28, Rg: 24, lock: 6.6 };
  let CHAIN = null;
  function buildChain() {
    const dx = CH_B.x - CH_A.x, dy = CH_B.y - CH_A.y, d = Math.hypot(dx, dy), be = Math.atan2(dy, dx);
    const ga = Math.acos((CH_A.r - CH_B.r) / d);
    const pb = new PB(CH_A.x + CH_A.r * Math.cos(be + ga), CH_A.y + CH_A.r * Math.sin(be + ga));
    pb.to(CH_B.x + CH_B.r * Math.cos(be + ga), CH_B.y + CH_B.r * Math.sin(be + ga), false);
    pb.arc(CH_B.x, CH_B.y, CH_B.r, be + ga, be - ga, false);
    pb.to(CH_A.x + CH_A.r * Math.cos(be - ga), CH_A.y + CH_A.r * Math.sin(be - ga), false);
    pb.arc(CH_A.x, CH_A.y, CH_A.r, be - ga, be + ga - TAU, false);
    CHAIN = pb.done();
  }
  // chain advance = rim travel of the wheel-axle sprocket (wheel turns counter-clockwise)
  const chainOff = (t) => -CH_A.r * (wheelAng(t) - wheelAng(0));
  const driveAng = (t) => wheelAng(0) * 0 + (wheelAng(t) - wheelAng(0)) * CH_A.r / CH_B.r;
  function drawChain(t) {
    const off = chainOff(t), P = CHAIN;
    for (let s = 0; s < P.L; s += 0.5) {
      P.at(s, tmp);
      const ph = mod(s - off, CH_Q) / CH_Q, nx = -tmp.ty, ny = tmp.tx;
      const x0 = fl(tmp.x), y0 = fl(tmp.y);
      const c = ph < 0.3 ? ST[1] : ph < 0.65 ? ST[3] : ST[2];
      put(x0, y0, c, 2);
      put(fl(tmp.x + nx * 0.9), fl(tmp.y + ny * 0.9), ph < 0.3 ? ST[0] : ST[1], 2);
    }
  }
  function sprocket(cx, cy, r, ang, n) {
    for (let y = fl(cy - r - 2); y <= cy + r + 2; y++) for (let x = fl(cx - r - 2); x <= cx + r + 2; x++) {
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy, rr = Math.hypot(dx, dy);
      if (rr > r + 1.2) continue;
      if (rr > r - 0.6) { const u = frac((Math.atan2(dy, dx) - ang) * n / TAU); if (Math.abs(u - 0.5) > 0.22) continue; }
      put(x, y, rr < 2 ? ST[2] : tubeShade(dx / (r + 2) * 0.8, dy / (r + 2) * 0.8, BR, x, y), 2);
    }
  }
  function genevaAng(t) {
    // drive turns with the chain; the pin engages the cross for 120 degrees of each turn
    const phi = -PI / 2 + PI / 3 + driveAng(t) * -1;          // clockwise drive, engagement centred on "up"
    const rel = phi - (-PI / 2 - PI / 3);
    const n = Math.floor(rel / TAU), dk = rel - n * TAU;
    let psi = n * (-PI / 3);
    if (dk < 2 * PI / 3) {
      const px = CH_B.x + GEN.a * Math.cos(phi), py = CH_B.y + GEN.a * Math.sin(phi);
      const ang = Math.atan2(py - GEN.y, px - GEN.x);
      const a0 = Math.atan2(CH_B.y + GEN.a * Math.sin(-PI / 2 - PI / 3) - GEN.y, CH_B.x + GEN.a * Math.cos(-PI / 2 - PI / 3) - GEN.x);
      let da = ang - a0; da = mod(da + PI, TAU) - PI;
      psi += da;
    } else psi += -PI / 3;
    return { psi, phi };
  }
  function genIn(x, y, base) {
    const dx = x + 0.5 - GEN.x, dy = y + 0.5 - GEN.y, r = Math.hypot(dx, dy);
    if (r > GEN.Rg) return 0;
    if (r < 7) return 1;
    const a = Math.atan2(dy, dx) - base, sec = PI / 3;
    const q = mod(a + sec / 2, sec) - sec / 2;
    if (r > GEN.C - GEN.a - 1.5 && Math.abs(r * Math.sin(q)) < 1.9) return 0;
    const qm = mod(a, sec) - sec / 2;
    if (Math.hypot(r * Math.cos(qm) - GEN.C, r * Math.sin(qm)) < GEN.lock + 1.6) return 0;
    return 1;
  }
  function drawGeneva(t) {
    const g = genevaAng(t), psi = g.psi, phi = g.phi;
    const a0 = Math.atan2(CH_B.y + GEN.a * Math.sin(-PI / 2 - PI / 3) - GEN.y, CH_B.x + GEN.a * Math.cos(-PI / 2 - PI / 3) - GEN.x);
    const base = a0 + psi;
    for (let y = fl(GEN.y - GEN.Rg - 1); y <= GEN.y + GEN.Rg + 1; y++) for (let x = fl(GEN.x - GEN.Rg - 1); x <= GEN.x + GEN.Rg + 1; x++) {
      if (!genIn(x, y, base)) continue;
      const dx = x + 0.5 - GEN.x, dy = y + 0.5 - GEN.y, r = Math.hypot(dx, dy);
      let c;
      if (r < 3.2) c = tubeShade(dx / 3.6, dy / 3.6, ST, x, y);
      else if (!genIn(x - 1, y - 1, base)) c = BR[5];
      else if (!genIn(x + 1, y + 1, base)) c = BR[1];
      else {
        const an = Math.cos(2 * (Math.atan2(dy, dx) + 2.35));
        c = (an > 0.95 && bay(x, y) < 0.5) ? BR[6] : rampI(BR, 0.5 + 0.2 * an + (r < 7 ? 0.08 : 0), x, y);
      }
      put(x, y, c, 1);
    }
    const lockR = GEN.lock;
    for (let y = fl(CH_B.y - lockR - 1); y <= CH_B.y + lockR + 1; y++) for (let x = fl(CH_B.x - lockR - 1); x <= CH_B.x + lockR + 1; x++) {
      const dx = x + 0.5 - CH_B.x, dy = y + 0.5 - CH_B.y, r = Math.hypot(dx, dy);
      if (r > lockR) continue;
      const rx = CH_B.x + (lockR + 2.5) * Math.cos(phi), ry = CH_B.y + (lockR + 2.5) * Math.sin(phi);
      if (Math.hypot(x + 0.5 - rx, y + 0.5 - ry) < lockR * 0.8) continue;
      put(x, y, r > lockR - 1 ? ST[1] : tubeShade(dx / (lockR + 3), dy / (lockR + 3), ST, x, y), 2);
    }
    sprocket(CH_B.x, CH_B.y, CH_B.r, -driveAng(t), 12);
    const px = CH_B.x + GEN.a * Math.cos(phi), py = CH_B.y + GEN.a * Math.sin(phi);
    tubeSeg(CH_B.x, CH_B.y, px, py, 1.7, BR, 2);
    dome(px, py, 2.3, BR, 2);
    dome(CH_B.x, CH_B.y, 1.8, BR, 2);
  }
  // flyball governor, belt-driven from the 16-tooth gear's axle
  const GOV = { x: 31, y: 289, L: 14, per: 1.5 };
  function drawGovernor(t) {
    const g4 = GEARS[4], boff = gearAng(g4, t) * 3;
    for (const bx of [g4.x - 3, g4.x + 3]) for (let y = Math.round(g4.y); y <= 329; y++) {
      const ph = mod(y + (bx < g4.x ? boff : -boff), PI) / PI;
      put(Math.round(bx), y, ph < 0.35 ? WAL[5] : 6, 1);
    }
    const phi = TAU * t / GOV.per;
    const balls = [0, PI].map((o) => ({ s: Math.sin(phi + o), z: Math.cos(phi + o) }));
    const drawArm = (b) => {
      const bx = GOV.x + 0.5 + GOV.L * b.s, by = GOV.y + 13;
      tubeSeg(GOV.x + 0.5, GOV.y + 0.5, bx, by, 0.6, b.z > 0 ? BR : ST, 2);
      tubeSeg(GOV.x + 0.5, GOV.y + 22, lerp(GOV.x + 0.5, bx, 0.5), lerp(GOV.y, by, 0.5), 0.5, ST, 2);
      dome(bx, by, b.z > 0 ? 4.2 : 3.6, b.z > 0 ? BR : [9, 10, 11, 12], 2);
    };
    for (const b of balls) if (b.z <= 0) drawArm(b);
    tubeSeg(GOV.x + 0.5, GOV.y - 3, GOV.x + 0.5, 330, 1, ST, 2);
    for (let y = GOV.y + 21; y <= GOV.y + 23; y++) for (let x = GOV.x - 2; x <= GOV.x + 3; x++) put(x, y, y === GOV.y + 21 ? BR[5] : BR[2], 2);
    for (const b of balls) if (b.z > 0) drawArm(b);
    dome(GOV.x + 0.5, GOV.y - 3, 2, BR, 2);
    for (let y = 326; y <= 333; y++) for (let x = GOV.x - 7; x <= GOV.x + 8; x++) {
      const band = y === 328 && mod(x - phi * 3, 3) < 1.2;
      put(x, y, band ? BR[6] : tubeShade((x + 0.5 - GOV.x - 0.5) / 9, (y - 329.5) / 5, BR, x, y), 2);
    }
  }
  // balance wheel with hairspring, pallet fork and a 12-tooth escape wheel (one beat every quarter second)
  const BAL = { x: 165, y: 103, R: 9.5 }, ESC = { x: 189, y: 101, R: 7, T: 12 }, FORK = { x: 177.5, y: 101 };
  function drawBalance(t) {
    const th = 2.3 * Math.sin(TAU * t / DT);
    const beat = t / (DT / 2), bi = Math.floor(beat), bf = beat - bi;
    const ea = -(bi + sstep(0, 0.12, bf)) * (TAU / ESC.T) / 2;
    // escape wheel: pointed, hooked teeth
    for (let y = fl(ESC.y - ESC.R - 2); y <= ESC.y + ESC.R + 2; y++) for (let x = fl(ESC.x - ESC.R - 2); x <= ESC.x + ESC.R + 2; x++) {
      const dx = x + 0.5 - ESC.x, dy = y + 0.5 - ESC.y, r = Math.hypot(dx, dy);
      if (r > ESC.R + 1.6) continue;
      const u = frac((Math.atan2(dy, dx) - ea) * ESC.T / TAU);
      let c = -1;
      if (r > ESC.R - 1.2) { if (u < 0.45 * (1 - (r - ESC.R + 1.2) / 2.8)) c = r > ESC.R + 0.6 ? BR[5] : BR[4]; }
      else if (r > ESC.R - 2.6 || r < 2.2) c = tubeShade(dx / (ESC.R + 2), dy / (ESC.R + 2), BR, x, y);
      else { const q = mod(Math.atan2(dy, dx) - ea, TAU / 4) - PI / 4; if (Math.abs(r * Math.sin(q)) < 0.8) c = BR[3]; }
      if (c >= 0) put(x, y, c, 2);
    }
    // pallet fork rocking with the balance
    const fa = 0.22 * Math.sin(TAU * t / DT);
    const ca = Math.cos(fa), sa = Math.sin(fa);
    const P = (vx, vy) => [FORK.x + 0.5 + vx * ca - vy * sa, FORK.y + 0.5 + vx * sa + vy * ca];
    const e1 = P(7.5, -3.5), e2 = P(7.5, 3.5), tail = P(-7, 0);
    tubeSeg(...P(0, 0), ...e1, 0.7, BR, 2); tubeSeg(...P(0, 0), ...e2, 0.7, BR, 2); tubeSeg(...P(0, 0), ...tail, 0.7, BR, 2);
    for (const e of [e1, e2]) { put(fl(e[0]), fl(e[1]), CU[1], 2); }
    dome(FORK.x + 0.5, FORK.y + 0.5, 1.4, BR, 2);
    // balance wheel
    for (let y = fl(BAL.y - BAL.R - 1); y <= BAL.y + BAL.R + 1; y++) for (let x = fl(BAL.x - BAL.R - 1); x <= BAL.x + BAL.R + 1; x++) {
      const dx = x + 0.5 - BAL.x, dy = y + 0.5 - BAL.y, r = Math.hypot(dx, dy);
      if (r > BAL.R) continue;
      let c = -1;
      if (r > BAL.R - 1.8) c = tubeShade(dx / (BAL.R + 1), dy / (BAL.R + 1), BR, x, y);
      else if (r < 1.6) c = CU[1];
      else { const q = mod(Math.atan2(dy, dx) - th, TAU / 3) - PI / 3; if (Math.abs(r * Math.sin(q)) < 0.75) c = BR[3]; }
      if (c >= 0) put(x, y, c, 2);
    }
    for (let k = 0; k <= 140; k++) {
      const u = k / 140, r = 2.2 + u * 4.6, a = th * (1 - u) + u * TAU * 2 + 0.4;
      const x = fl(BAL.x + 0.5 + r * Math.cos(a)), y = fl(BAL.y + 0.5 + r * Math.sin(a));
      if (k % 2 === 0) put(x, y, u > 0.9 ? ST[2] : ST[3], 2);
    }
    // timing screws on the rim
    for (let k = 0; k < 6; k++) { const a = th + k * TAU / 6 + 0.5; put(fl(BAL.x + 0.5 + (BAL.R + 0.6) * Math.cos(a)), fl(BAL.y + 0.5 + (BAL.R + 0.6) * Math.sin(a)), BR[6], 2); }
  }
  function drawFlywheel(t) {
    const g = FLY.g, ang = gearAng(g, t), R0 = FLY.R;
    for (let y = fl(g.y - R0 - 1); y <= g.y + R0 + 1; y++) for (let x = fl(g.x - R0 - 1); x <= g.x + R0 + 1; x++) {
      const dx = x + 0.5 - g.x, dy = y + 0.5 - g.y, r = Math.hypot(dx, dy);
      if (r > R0) continue;
      let c = -1;
      if (r > R0 - 3.4) c = r > R0 - 0.8 ? ST[1] : tubeShade(dx / (R0 + 1) * 0.9, dy / (R0 + 1) * 0.9, ST, x, y);
      else if (r < 3) c = tubeShade(dx / 3.4, dy / 3.4, ST, x, y);
      else { const q = mod(Math.atan2(dy, dx) - ang, TAU / 6) - PI / 6; if (Math.abs(r * Math.sin(q)) < 1.1 + (R0 - r) * 0.05) c = rampI(ST, 0.75 - 0.35 * (dx + dy) / R0, x, y); }
      if (c >= 0) put(x, y, c, 2);
    }
  }
  function gearIn(g, x, y, ang) {
    const dx = x + 0.5 - g.x, dy = y + 0.5 - g.y, r2 = dx * dx + dy * dy;
    if (r2 > g.Rt * g.Rt) return 0;
    const r = Math.sqrt(r2);
    if (r <= g.hub) return 2;
    if (r > g.Rr) {
      const u = frac((Math.atan2(dy, dx) - ang) * g.T / TAU);
      const hw = 0.27 - 0.1 * (r - g.Rr) / (g.Rt - g.Rr);
      return Math.abs(u - 0.5) < hw ? 1 : 0;
    }
    if (r >= g.Ri || !g.sp) return 1;
    if (r <= g.hub + 1.6) return 1;
    const sec = TAU / g.sp, q = mod(Math.atan2(dy, dx) - ang, sec) - sec / 2;
    return Math.abs(r * Math.sin(q)) < g.sw ? 1 : 0;
  }
  function drawGear(g, ang) {
    const x0 = fl(g.x - g.Rt - 1), x1 = Math.ceil(g.x + g.Rt + 1), y0 = fl(g.y - g.Rt - 1), y1 = Math.ceil(g.y + g.Rt + 1);
    for (let y = Math.max(0, y0); y <= Math.min(H - 1, y1); y++) for (let x = Math.max(0, x0); x <= Math.min(W - 1, x1); x++) {
      const m = gearIn(g, x, y, ang);
      if (!m) continue;
      const dx = x + 0.5 - g.x, dy = y + 0.5 - g.y, r = Math.hypot(dx, dy);
      let c;
      if (m === 2) {
        c = tubeShade(dx / (g.hub + 0.6), dy / (g.hub + 0.6), r < 1.3 ? ST : BR, x, y);
      } else if (!gearIn(g, x - 1, y - 1, ang)) c = BR[5];
      else if (!gearIn(g, x + 1, y + 1, ang)) c = BR[1];
      else {
        const sa = Math.atan2(dy, dx), an = Math.cos(2 * (sa + 2.35));
        let v = 0.47 + 0.2 * an + 0.06 * Math.sin(r * 2.3) - (r > g.Rr ? 0.06 : 0) + (g.small ? 0.08 : 0);
        if (r < g.Ri && r > g.hub + 1.6) v -= 0.08;
        c = (an > 0.95 && bay(x, y) < 0.55) ? BR[6] : rampI(BR, v, x, y);
      }
      put(x, y, c, 1);
    }
  }
  const gearAng = (g, t) => g.a0 + g.k * (wheelAng(t) - wheelAng(0));

  /* ================================================================ moving parts */
  function drawWheel(t) {
    const ang = wheelAng(t), sec = TAU / WNP;
    for (let y = fl(WY - WRIM - 1); y <= WY + WRIM + 1; y++) for (let x = fl(WX - WRIM - 1); x <= WX + WRIM + 1; x++) {
      const dx = x + 0.5 - WX, dy = y + 0.5 - WY, r = Math.hypot(dx, dy);
      if (r > WRIM) continue;
      const al = Math.atan2(dx, -dy) - ang;              // CW from up, in wheel frame
      const q = mod(al + sec / 2, sec) - sec / 2;
      const pd2 = r * r + WRP * WRP - 2 * r * WRP * Math.cos(q);
      let c = -1;
      if (r <= 4.5) c = tubeShade(dx / 5, dy / 5, BR, x, y);
      else if (r >= 16.5) {
        if (pd2 < (R + 0.9) * (R + 0.9)) continue;      // notch
        if (pd2 < (R + 2) * (R + 2)) c = BR[(dx + dy < 0) ? 3 : 2];
        else if (r > WRIM - 1.3) c = tubeShade(dx / (WRIM + 1) * 0.6, dy / (WRIM + 1) * 0.6, BR, x, y);
        else {
          const g = 0.5 + 0.18 * Math.sin(r * 2.1 + 3 * vnoise(al * 8, r * 0.3, 21)) - 0.25 * (dx + dy) / WRIM;
          c = rampI([5, 6, 7, 8], g, x, y);
          if (r < 17.6) c = 5;
        }
      } else {
        const q2 = mod(al, sec) - sec / 2;              // spokes between notches
        if (Math.abs(r * Math.sin(q2)) < 1.3 || r < 6.2) c = rampI([5, 6, 7, 8], 0.55 - 0.3 * (dx + dy) / 18 + 0.1 * Math.sin(r * 1.3), x, y);
        else continue;
      }
      put(x, y, c, 2);
    }
  }
  function drawScrew(t) {
    const ph = threadY(t), K = PITCH / TAU;
    for (let y = 11; y <= 328; y++) {
      const py = y + 0.5;
      for (let x = XS - 8; x <= XS + 7; x++) {
        const dx = x + 0.5 - XS;
        let c = -1;
        for (let rho = 8; rho >= 2.6; rho -= 0.45) {
          if (Math.abs(dx) > rho) break;
          const phi = Math.asin(dx / rho);
          const dd = mod(py - ph - K * phi, PITCH);
          if (dd < 2.1) {
            const v = 0.78 - 0.3 * dd / 2.1 - 0.28 * dx / 8 + 0.1 * (rho - 5) / 3;
            c = (rho > 7.4 && dd < 0.8 && dx < 1) ? BR[6] : rampI(BR, v, x, y);
            break;
          }
        }
        if (c < 0) {
          if (Math.abs(dx) < 2.7) c = tubeShade(dx / 2.9, 0, ST, x, y);
          else {
            for (let rho = Math.abs(dx); rho <= 8; rho += 0.6) {
              const phi = PI - Math.asin(clamp(dx / rho, -1, 1));
              if (mod(py - ph - K * phi, PITCH) < 2.1) { c = dx < 0 ? BR[1] : BR[0]; break; }
            }
          }
        }
        if (c >= 0) put(x, y, c, 1);
      }
    }
  }
  function drawSeesaw(t) {
    const a = ssAlpha(t), ca = Math.cos(a), sa = Math.sin(a);
    const x0 = SSX - 30, x1 = SSX + 32, y0 = SSY - 12, y1 = SSY + 30;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const dx = x + 0.5 - SSX, dy = y + 0.5 - SSY;
      const s = dx * ca + dy * sa, n = -dx * sa + dy * ca;
      let c = -1;
      if (s >= -25 && s <= 29 && Math.abs(n) <= 1.5) c = tubeShade(0, n / 1.7, BR, x, y);
      else if (s >= -23 && s <= 27.5 && n > 1.5 && n <= 5.2) c = rampI([5, 6, 7, 8], 0.62 - (n - 1.5) * 0.12 + 0.12 * Math.sin(s * 0.9 + 2 * vnoise(s * 0.3, n, 31)), x, y);
      else if (s >= -25 && s <= -16 && n > 5.2 && n <= 14) c = (n > 12.6) ? BR[2] : tubeShade((s + 20.5) / 5, 0, BR, x, y);
      if (c >= 0) put(x, y, c, 2);
    }
    dome(SSX + 0.5, SSY + 0.5, 3, BR, 2);
    put(SSX, SSY, ST[1], 2);
  }
  function drawElevator(t, front) {
    const off = carOff(t), b = carTilt(t), cyc = mod(t - W0, 2);
    const px = DOORX, py = DOORY + off, fxv = -Math.cos(b), fyv = Math.sin(b), ux = -Math.sin(b), uy = -Math.cos(b);
    const at = (u, w) => [px + u * fxv + w * ux, py + u * fyv + w * uy];
    const doorUp = sstep(EL_DOWN + 0.01, EL_DOWN + 0.06, cyc) * (1 - sstep(EL_BOT - 0.08, EL_BOT - 0.02, cyc)) * 11;
    if (!front) {
      // counterweight, cables, pulley
      const cwy = CW_Y0 - off;
      for (let y = fl(cwy - 8); y <= cwy + 8; y++) for (let x = CW_X - 4; x <= CW_X + 4; x++) {
        const nx = (x + 0.5 - CW_X) / 5, band = (y - fl(cwy - 8)) % 6 < 1;
        put(x, y, band ? tubeShade(nx, 0, BR, x, y) : tubeShade(nx, 0, ST, x, y), 2);
      }
      const apex = at(22, 18);
      for (const [cx0, x1, y1, dir] of [[PUL_X - PUL_R, PUL_X - PUL_R, cwy - 8, -1], [PUL_X + PUL_R, apex[0], apex[1], 1]]) {
        for (let y = PUL_Y; y <= y1; y++) {
          const u = (y - PUL_Y) / Math.max(1, y1 - PUL_Y), x = Math.round(lerp(cx0, x1, u) - 0.5);
          put(x, y, (mod(y + dir * off, 3) < 1) ? ST[1] : ST[3], 2);
        }
      }
      const pa = off / PUL_R;
      for (let y = PUL_Y - PUL_R - 1; y <= PUL_Y + PUL_R + 1; y++) for (let x = PUL_X - PUL_R - 1; x <= PUL_X + PUL_R + 1; x++) {
        const dx = x + 0.5 - PUL_X, dy = y + 0.5 - PUL_Y, r = Math.hypot(dx, dy);
        if (r > PUL_R + 0.6) continue;
        let c = -1;
        if (r > PUL_R - 0.9) c = BR[1];
        else if (r > PUL_R - 3.2) c = tubeShade(dx / (PUL_R + 2), dy / (PUL_R + 2), BR, x, y);
        else if (r < 3.4) c = tubeShade(dx / 3.6, dy / 3.6, BR, x, y);
        else { const q = mod(Math.atan2(dy, dx) - pa, TAU / 6) - PI / 6; if (Math.abs(r * Math.sin(q)) < 1.3) c = rampI(BR, 0.55 - 0.3 * (dx + dy) / PUL_R, x, y); }
        if (c >= 0) put(x, y, c, 2);
      }
      // stop pin at the end of L3 (down while the car takes on marbles)
      PG.at(G_SFLAP, tmp);
      const fx = Math.round(tmp.x - 4.5 - 0.5), fy0 = tmp.y, openU = doorOpen(t) ? 1 : 0;
      const ou = cyc > 1.9 ? 0 : sstep(0, 0.04, cyc) * (1 - sstep(0.63, 0.67, cyc));
      const top = Math.round(fy0 - 1.5 + ou * 6.5);
      for (let y = top; y <= fy0 + 10; y++) { put(fx, y, y === top ? BR[5] : ST[3], 2); put(fx + 1, y, y === top ? BR[3] : ST[1], 2); }
      void openU;
    }
    const cs = [[-5, -9], [48, -9], [-5, 23], [48, 23]].map(([u, w]) => at(u, w));
    const bx0 = fl(Math.min(...cs.map((p) => p[0]))), bx1 = Math.ceil(Math.max(...cs.map((p) => p[0])));
    const by0 = fl(Math.min(...cs.map((p) => p[1]))) - 12, by1 = Math.ceil(Math.max(...cs.map((p) => p[1])));
    for (let y = by0; y <= by1; y++) for (let x = bx0; x <= bx1; x++) {
      const dx = x + 0.5 - px, dy = y + 0.5 - py;
      const u = dx * fxv + dy * fyv, w = dx * ux + dy * uy;
      let c = -1;
      if (!front) {
        const bw = 10 + 8 * Math.sin(PI * clamp((u + 2) / 48, 0, 1));
        if (u >= -2 && u <= 46 && Math.abs(w - bw) < 0.75) c = (u < 22 ? BR[4] : BR[3]);
        else if (u >= -1 && u <= 44 && w > -4.6 && w <= 8.5) {
          const plank = mod(u + 3, 9) < 0.9;
          c = plank ? 3 : rampI([3, 4, 5, 6], 0.45 + 0.25 * vnoise(u * 0.25, w * 1.2, 41) - w * 0.015, x, y);
        } else if (u >= -1.5 && u <= 45 && w >= -7.4 && w <= -4.6) c = tubeShade(0, (w + 6) / 1.8, BR, x, y);
      } else {
        if (u >= 0.5 && u <= 43.5 && w > -4.7 && w <= -2.9) c = tubeShade(0, (w + 3.8) / 1.2, BR, x, y);
        else if (u >= 44 && u <= 47 && w >= -7.4 && w <= 10) c = w > 8.6 ? BR[4] : rampI([5, 6, 7, 8], 0.75 - (u - 44) * 0.15, x, y);
        else if (u >= -1 && u <= 44 && w > 8.4 && w <= 10) c = tubeShade(0, (w - 9.2) / 1.1, BR, x, y);
        else if (u >= -3.6 && u <= -0.6 && w >= -7.4 + doorUp && w <= 10 + doorUp) c = (w > 8.6 + doorUp) ? BR[4] : rampI([5, 6, 7, 8], 0.8 - (u + 3.6) * 0.13, x, y);
        else if (Math.abs(u - 22) < 1.6 && w > 17 && w < 20) c = BR[2];
      }
      if (c >= 0) put(x, y, c, 2);
    }
  }
  function drawGate(t) {
    const th = pendAng(t);
    PG.at(G_SA, tmp);
    const xa = tmp.x, ym = tmp.y;
    const up1 = sstep(-0.15 * PEND_A, 0.35 * PEND_A, th), up2 = sstep(-0.15 * PEND_A, 0.35 * PEND_A, -th);
    // pins
    for (const [ex, up] of [[-4.5, up1], [4.5, up2]]) {
      const x = Math.round(xa + ex - 0.5), top = Math.round(ym - 1.5 + (1 - up) * 6.5);
      for (let y = top; y <= ym + 11; y++) { put(x, y, y === top ? BR[5] : ST[3], 2); put(x + 1, y, y === top ? BR[3] : ST[1], 2); }
    }
    // pendulum: rocker on top, rod and bob below the pivot (rotated clockwise by th)
    const cth = Math.cos(th), sth = Math.sin(th);
    const rx = (vx, vy) => GATEX + 0.5 + vx * cth - vy * sth, ry = (vx, vy) => PEND_Y + 0.5 + vx * sth + vy * cth;
    tubeSeg(rx(-5.5, -2), ry(-5.5, -2), rx(5.5, -2), ry(5.5, -2), 0.9, BR, 2);
    for (const ex of [-4.5, 4.5]) tubeSeg(rx(ex, -2), ry(ex, -2), xa + ex, ym + 11, 0.5, ST, 2);
    tubeSeg(rx(0, -2), ry(0, -2), rx(0, PEND_L), ry(0, PEND_L), 0.75, ST, 2);
    dome(rx(0, PEND_L), ry(0, PEND_L), 3.4, BR, 2);
    dome(GATEX + 0.5, PEND_Y + 0.5, 1.6, BR, 2);
  }
  const BAR_RAMPS = [[26, 27, 28, 29], [16, 17, 44, 15], [34, 35, 36, 37], [41, 42, 43, 25], [30, 31, 32, 33], [38, 39, 40, 29]];
  function drawBars(t) {
    for (let k = 0; k < NBAR; k++) {
      const b = BARS[k], s = mod(t - b.u, DT), rp = BAR_RAMPS[k % 6];
      const vib = s < 0.25 ? Math.round(Math.sin(s * 70) * Math.exp(-s * 14) * 1.3) : 0;
      const x0 = Math.round(b.x - b.w / 2), x1 = x0 + b.w - 1, y0 = Math.round(b.y) + vib;
      const glow = s < 0.07 ? 2 : s < 0.16 ? 1 : 0;
      for (let y = y0 - 1; y <= y0 + 3; y++) for (let x = x0 - 1; x <= x1 + 1; x++) {
        const row = y - y0, ex = x < x0 || x > x1, ey = row < 0 || row > 2;
        if (ex || ey) { if (glow === 2 && !(ex && ey) && bay(x, y) < 0.6) put(x, y, rp[3], 2); continue; }
        if ((x === x0 || x === x1) && (row === 0 || row === 2)) continue;    // rounded ends
        let c = row === 0 ? rp[2] : row === 1 ? rp[1] : rp[0];
        if (row === 0 && (x === x0 + 1 || x === x0 + 2)) c = rp[3];
        if (glow === 2) c = row === 2 ? rp[2] : C_WHITE;
        else if (glow === 1) c = row === 0 ? C_WHITE : row === 1 ? rp[3] : rp[1];
        put(x, y, c, 2);
      }
      if (!glow) { put(x0 + 2, y0 + 1, rp[0], 2); put(x1 - 2, y0 + 1, rp[0], 2); }
    }
  }
  function ring(cx, cy, s, dur, rmax, sq, cols) {
    if (s < 0 || s > dur) return;
    const u = s / dur, rr = 1.5 + rmax * Math.sqrt(u), fade = 1 - u;
    const n = Math.ceil(rr * 6);
    for (let q = 0; q < n; q++) {
      const a = (q / n) * TAU;
      const x = Math.floor(cx + rr * Math.cos(a)), y = Math.floor(cy + rr * Math.sin(a) * sq);
      if (x < 0 || y < 0 || x >= W || y >= H || bay(x, y) > fade) continue;
      OUT[y * W + x] = u < 0.3 ? cols[0] : cols[1];
    }
  }
  function drawRings(t) {
    for (let i = 0; i < NMB; i++) {
      const ev = TRACK[i & 3].info.ev;
      for (const e of ev) {
        const s = mod(t - i * DT - e.u, D);
        if (s < 0.25) ring(e.x, e.y + (e.k === 1 ? 3 : 4), s, e.k === 1 ? 0.22 : 0.18, e.k === 1 ? 7 : 6, 0.45, e.k === 1 ? [C_WHITE, BR[5]] : [BR[6], BR[4]]);
      }
    }
    { const s = mod(t - TIP0 - 0.085, 1); armPt(24, AT, tmp); ring(tmp.x, tmp.y + 8, s, 0.2, 7, 0.4, [BR[6], BR[4]]); }
    for (let k = 0; k < NBAR; k++) {
      const b = BARS[k], s = mod(t - b.u, DT);
      if (s > 0.34) continue;
      const rr = 2.5 + 30 * s, fade = 1 - s / 0.34;
      const n = Math.ceil(rr * 3);
      for (let q = 0; q <= n; q++) {
        const a = -PI + (q / n) * PI;
        const x = Math.floor(b.x + rr * Math.cos(a)), y = Math.floor(b.y + 0.5 + rr * Math.sin(a) * 0.8);
        if (x < 0 || y < 0 || x >= W || y >= H) continue;
        if (bay(x, y) > fade * 0.9) continue;
        OUT[y * W + x] = s < 0.1 ? C_WHITE : s < 0.2 ? BR[6] : BR[5];
      }
    }
  }

  /* ================================================================ marbles */
  const MK_DEF = [
    { tint: [205, 28, 58], tw: 1, sw: [24, 25, 45] },
    { tint: [36, 76, 225], tw: 1, sw: [13, 14, 15] },
    { tint: [28, 175, 96], tw: 1, sw: [24, 25, 45] },
    { tint: [215, 238, 232], tw: 0, sw: [26, 27, 28, 29] },
    { tint: [255, 150, 40], tw: 1, sw: [26, 27, 28] },
    { tint: [132, 58, 205], tw: 1, sw: [24, 25, 45] },
    { tint: [18, 168, 182], tw: 1, sw: [13, 14, 15] },
    { tint: [215, 238, 232], tw: 0, sw: [30, 31, 32, 33], sw2: [41, 42, 43] },
  ];
  function buildMarbleKinds() {
    for (const K of MK_DEF) {
      K.tintL = new Uint8Array(NPAL); K.tintH = new Uint8Array(NPAL);
      const clear = K.tw < 0.5;
      for (let c = 0; c < NPAL; c++) {
        const p = PAL[c];
        const f = (k, hi) => clear ? Math.min(255, p[k] * (hi ? 0.75 : 0.55) + K.tint[k] * (hi ? 0.32 : 0.16) + (hi ? 16 : 4))
          : Math.min(255, p[k] * 0.22 + K.tint[k] * (hi ? 0.98 : 0.68) + (hi ? 34 : 4));
        K.tintL[c] = nearest(f(0, 0), f(1, 0), f(2, 0));
        K.tintH[c] = nearest(f(0, 1), f(1, 1), f(2, 1));
      }
      K.rimHi = clear ? GL[2] : nearest(Math.min(255, K.tint[0] * 0.7 + 90), Math.min(255, K.tint[1] * 0.7 + 90), Math.min(255, K.tint[2] * 0.7 + 90));
      K.caus = clear ? K.sw[K.sw.length - 1] : nearest(Math.min(255, K.tint[0] * 0.6 + 120), Math.min(255, K.tint[1] * 0.6 + 110), Math.min(255, K.tint[2] * 0.6 + 100));
      K.trail = clear ? K.sw[1] : nearest(K.tint[0] * 0.8 + 20, K.tint[1] * 0.8 + 20, K.tint[2] * 0.8 + 20);
    }
  }
  const MKIND = []; for (let i = 0; i < NMB; i++) MKIND.push((i * 5) % 8);
  const NB = new Uint8Array(17 * 17);
  function drawMarble(x, y, rot, kind, thru) {
    const cx = fl(x), cy = fl(y), K = MK_DEF[kind];
    for (let j = -8; j <= 8; j++) for (let i = -8; i <= 8; i++) NB[(j + 8) * 17 + i + 8] = OUT[clamp(cy + j, 0, H - 1) * W + clamp(cx + i, 0, W - 1)];
    const cr = Math.cos(rot), sr = Math.sin(rot);
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
      const d2 = dx * dx + dy * dy;
      if (d2 > 17) continue;
      const nx = dx / 4.4, ny = dy / 4.4, nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
      const sx = Math.round(-dx * 1.75), sy = Math.round(-dy * 1.75);
      const bgc = NB[(sy + 8) * 17 + sx + 8];
      let c = (dx + dy <= -2) ? K.tintH[bgc] : K.tintL[bgc];
      if (d2 <= 10) {
        const u = nx * cr + ny * sr, v = -nx * sr + ny * cr;
        const ph = 3 * Math.atan2(v, u) + 2.2 * nz + 1.3 * Math.hypot(u, v);
        const f = Math.cos(ph);
        if (f > 0.3) {
          let sw = K.sw;
          if (K.sw2 && (Math.round(ph / TAU * 3) & 1)) sw = K.sw2;
          c = rampI(sw, 0.62 - 0.34 * nx - 0.42 * ny + 0.3 * (f - 0.3), cx + dx, cy + dy);
        }
      }
      if (d2 >= 13) c = dx + dy > 0 ? DARK[c] : (dx + dy < -3 ? K.rimHi : c);
      else if (dx + dy >= 4) c = DARK[c];
      if ((dx === 1 && dy === 2) || (dx === 2 && dy === 1)) c = K.caus;
      if (dx === -2 && dy === -2) c = C_WHITE;
      else if ((dx === -1 && dy === -2) || (dx === -2 && dy === -1)) c = GL[3];
      if (thru) c = THRU[c];
      put(cx + dx, cy + dy, c, 3);
    }
  }
  const MP = { x: 0, y: 0, r: 0, l: 0 }, MQ = { x: 0, y: 0, r: 0, l: 0 };
  function mpos(i, t, o) {
    const T = TRACK[i & 3];
    const u = mod(t - i * DT, D) * RHZ;
    let k = u | 0; if (k >= NREC) k = NREC - 1;
    const f = u - k;
    o.x = lerp(T.X[k], T.X[k + 1], f); o.y = lerp(T.Y[k], T.Y[k + 1], f); o.r = lerp(T.RT[k], T.RT[k + 1], f); o.l = T.LY[f < 0.5 ? k : k + 1];
    return o;
  }
  const MSX = new Float32Array(NMB), MSY = new Float32Array(NMB), MSR = new Float32Array(NMB), MSL = new Uint8Array(NMB), MSV = new Float32Array(NMB);
  function placeMarbles(t) {
    for (let i = 0; i < NMB; i++) {
      mpos(i, t, MP); mpos(i, t - 0.01, MQ);
      MSX[i] = MP.x; MSY[i] = MP.y; MSR[i] = MP.r; MSL[i] = MP.l;
      MSV[i] = MQ.l === MP.l ? Math.hypot(MP.x - MQ.x, MP.y - MQ.y) / 0.01 : 0;
    }
  }
  function drawTrail(i, t) {
    const v = MSV[i]; if (v < 150) return;
    const amt = clamp((v - 150) / 170, 0, 1), K = MK_DEF[MKIND[i]];
    for (let k = 6; k >= 1; k--) {
      mpos(i, t - k * 0.0065, MQ);
      if (MQ.l !== MSL[i]) continue;
      const fade = amt * (1 - k / 7.5), rr = 3.6 * (1 - k / 9);
      const cx = MQ.x, cy = MQ.y;
      for (let y = fl(cy - rr); y <= cy + rr; y++) for (let x = fl(cx - rr); x <= cx + rr; x++) {
        if (x < 0 || y < 0 || x >= W || y >= H) continue;
        const qx = x + 0.5 - cx, qy = y + 0.5 - cy;
        if (qx * qx + qy * qy > rr * rr) continue;
        if (bay(x + k, y) > fade * 0.75) continue;
        OUT[y * W + x] = k < 3 ? K.trail : DARK[K.trail];
      }
    }
  }
  function drawLayer(t, lay, thru) {
    for (let i = 0; i < NMB; i++) if (MSL[i] === lay) drawTrail(i, t);
    for (let i = 0; i < NMB; i++) if (MSL[i] === lay) {
      drawMarble(MSX[i], MSY[i], MSR[i], MKIND[i], thru);
      // a brief star glint every few turns of a rolling marble
      const g = frac(Math.abs(MSR[i]) / (TAU * 5) + i * 0.37);
      if (MSV[i] > 40 && g < 0.03) {
        const cx = fl(MSX[i]) - 2, cy = fl(MSY[i]) - 2, arm = g < 0.015 ? 3 : 2;
        for (let k = 1; k <= arm; k++) for (const [ox, oy] of [[k, 0], [-k, 0], [0, k], [0, -k]]) {
          const x = cx + ox, y = cy + oy;
          if (x >= 0 && y >= 0 && x < W && y < H) OUT[y * W + x] = k === arm ? GL[3] : C_WHITE;
        }
      }
    }
  }

  /* ================================================================ frame */
  function applyFO() { for (let i = 0; i < NP; i++) { const c = FO[i]; if (c !== 255) { OUT[i] = c; ZH[i] = FOZ[i]; } } }
  function shadows() {
    for (let y = 4; y < H; y++) for (let x = 4; x < W; x++) {
      const i = y * W + x;
      if (ZH[i] !== 0) continue;
      let s = 0;
      if (ZH[i - W - 1] >= 1) s = 1;
      if (ZH[i - 2 * W - 2] >= 2 || ZH[i - 3 * W - 2] >= 3) s = 2;
      else if (!s && (ZH[i - 3 * W - 3] >= 2 || ZH[i - 4 * W - 3] >= 3) && bay(x, y) < 0.5) s = 1;
      if (s) OUT[i] = s === 2 ? DARK2[OUT[i]] : DARK[OUT[i]];
    }
  }
  function drawFrame(t, g, cw, ch) {
    t = mod(t, D);
    BUF = OUT; ZB = ZH;
    OUT.set(ST_OUT); ZH.set(ST_ZH);
    placeMarbles(t);
    drawFlywheel(t);
    for (let k = GEARS.length - 1; k >= 0; k--) if (k !== 2) drawGear(GEARS[k], gearAng(GEARS[k], t));
    drawGear(GEARS[2], gearAng(GEARS[2], t));
    drawBalance(t);
    drawGovernor(t);
    drawChain(t);
    sprocket(CH_A.x, CH_A.y, CH_A.r, wheelAng(t), 18);
    drawGeneva(t);
    drawElevator(t, false);
    drawWheel(t);
    drawLayer(t, 3, false);
    drawScrew(t);
    drawLayer(t, 2, false);
    drawSeesaw(t);
    drawLayer(t, 4, false);
    drawElevator(t, true);
    drawBars(t);
    drawLayer(t, 1, true);
    drawLayer(t, 0, false);
    applyFO();
    drawGate(t);
    drawRings(t);
    shadows();
    present(g, cw, ch);
  }

  /* ================================================================ present */
  let IMG = null, SMALL = null, SG = null;
  function present(g, cw, ch) {
    if (!SMALL) { SMALL = document.createElement('canvas'); SMALL.width = W; SMALL.height = H; SG = SMALL.getContext('2d'); IMG = SG.createImageData(W, H); }
    const d = IMG.data;
    for (let i = 0, j = 0; i < NP; i++, j += 4) { const p = PAL[OUT[i]]; d[j] = p[0]; d[j + 1] = p[1]; d[j + 2] = p[2]; d[j + 3] = 255; }
    SG.putImageData(IMG, 0, 0);
    if (!g) return;
    g.imageSmoothingEnabled = false;
    g.setTransform(1, 0, 0, 1, 0, 0);
    const k = Math.max(cw / W, ch / H);
    const dw = W * k, dh = H * k;
    g.drawImage(SMALL, Math.round((cw - dw) / 2), Math.round((ch - dh) / 2), dw, dh);
  }

  /* ================================================================ mount */
  let BUILT = false;
  function init() {
    if (BUILT) return;
    buildTables(); simulate(); buildGears(); buildMarbleKinds(); buildStatic();
    BUILT = true;
  }

  (window.PIECES = window.PIECES || []).push({
    id: 'marble-machine',
    title: 'Marble Machine',
    medium: 'Pixel art in 46 colours, 270 × 338, drawn in JavaScript · 18 s loop',
    note: 'Thirty-six marbles, one circuit · tap to pause',
    about: 'A wall-mounted kinetic sculpture of brass, walnut and glass keeps thirty-six glass marbles in perpetual circulation. A screw lift carries them up, they race down zigzag rails and leap the gaps, ring a staircase of chime bars, whirl down a glass vortex funnel and drop into a bucket wheel that turns a train of brass gears. A see-saw tips under every pair, a pendulum escapement lets them through one at a time, and a counterweight elevator lowers them four at a time back to the lift, while a chain turns a Geneva wheel and a balance wheel ticks. Every marble runs the same circuit, half a second apart, and every mechanism is timed to them.',
    tone: 'dark',
    room: '#0e0705',
    mount(el, api) {
      const EXPORT = /[?&]export\b/.test(location.search);
      let alive = true, raf = 0, playing = !EXPORT, clock = 0, last = 0;
      el.style.background = '#0e0705';
      const cv = document.createElement('canvas');
      cv.style.cssText = 'position:absolute;display:block;cursor:pointer;image-rendering:pixelated;image-rendering:crisp-edges;';
      el.appendChild(cv);
      const g = cv.getContext('2d', { alpha: false });
      const pauseMark = document.createElement('div');
      pauseMark.style.cssText = 'position:absolute;width:34px;height:34px;opacity:0;transition:opacity .4s;pointer-events:none;';
      pauseMark.innerHTML = '<svg viewBox="0 0 34 34" width="34" height="34"><rect x="10" y="9" width="5" height="16" fill="rgba(255,240,200,.8)"/><rect x="19" y="9" width="5" height="16" fill="rgba(255,240,200,.8)"/></svg>';
      el.appendChild(pauseMark);
      let CW = W * 4, CH = H * 4;
      function layout() {
        let left = 0, top = 0, cssW, cssH;
        if (EXPORT) {
          cssW = 1080; cssH = 1350; CW = 1080; CH = 1350;
          cv.style.position = 'fixed';
          cv.width = CW; cv.height = CH;
        } else {
          const dpr = Math.min(2, window.devicePixelRatio || 1);
          const w = el.clientWidth || window.innerWidth, h = el.clientHeight || window.innerHeight;
          const fit = Math.min(w * dpr / W, h * dpr / H) * 0.97;
          let k = Math.max(1, Math.floor(fit));
          if (k < fit * 0.86) k = fit;
          CW = Math.round(W * k); CH = Math.round(H * k);
          cssW = CW / dpr; cssH = CH / dpr;
          left = Math.round((w - cssW) / 2); top = Math.round((h - cssH) / 2);
          if (cv.width !== CW || cv.height !== CH) { cv.width = CW; cv.height = CH; }
        }
        cv.style.left = left + 'px'; cv.style.top = top + 'px'; cv.style.width = cssW + 'px'; cv.style.height = cssH + 'px';
        pauseMark.style.left = (left + cssW - 48) + 'px'; pauseMark.style.top = (top + 14) + 'px';
      }
      layout();
      SEED = 7;
      init();
      drawFrame(0, g, CW, CH);
      const hook = {
        duration: D,
        isReady: () => {
          if (!BUILT) return false;
          if (!EXPORT) return true;
          const st = el.parentElement;
          return !st || parseFloat(getComputedStyle(st).opacity) >= 0.999;
        },
        renderAt(t) {
          return new Promise((res) => {
            playing = false; clock = t;
            const t0 = performance.now();
            drawFrame(t, g, CW, CH);
            hook.lastMs = performance.now() - t0;
            requestAnimationFrame(() => requestAnimationFrame(res));
          });
        },
        lastMs: 0,
        debug: EV,
      };
      window.__marblemachine = hook;
      if (EXPORT) document.documentElement.dataset.ready = 'marble-machine';
      api.ready();
      function frame(now) {
        if (!alive || !api.isCurrent()) return;
        raf = requestAnimationFrame(frame);
        const dt = last ? Math.min(0.1, (now - last) / 1000) : 0; last = now;
        if (!playing) return;
        clock = (clock + dt) % D;
        drawFrame(clock, g, CW, CH);
      }
      if (!EXPORT) raf = requestAnimationFrame(frame);
      const onDown = () => { if (EXPORT) return; playing = !playing; last = 0; pauseMark.style.opacity = playing ? '0' : '1'; };
      cv.addEventListener('pointerdown', onDown);
      let rt = 0;
      const ro = new ResizeObserver(() => { clearTimeout(rt); rt = setTimeout(() => { if (!alive) return; layout(); drawFrame(clock, g, CW, CH); }, 120); });
      ro.observe(el);
      return {
        destroy() {
          alive = false; cancelAnimationFrame(raf); ro.disconnect(); clearTimeout(rt);
          cv.removeEventListener('pointerdown', onDown);
          if (window.__marblemachine === hook) delete window.__marblemachine;
        },
      };
    },
  });
})();
