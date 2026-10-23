/* Drawings from Middle-earth — 02 · "The Pillars of the Kings"
 *
 * The Argonath on the Anduin, as a graphite drawing with Romantic watercolour washes.
 * Nothing is an image: the two kings are built as a carved relief (a height field made of
 * hand-placed capsules, ellipses and slabs, then cracked and eroded), lit by a low sun, and
 * drawn over with tens of thousands of pencil strokes: hatching that follows the stone's form,
 * contour lines traced from the carved parts, cracks, lichen, nests and birds. Transparent washes
 * are mixed as optical densities of seven pigments, with hard drying edges, granulation in the
 * tooth of a cold-pressed sheet, blooms, dry-brush on the rock and lifted lights; the white paper
 * is left for the mist and the spray. All randomness is seeded; seeds vary only small things.
 */
(function () {
  'use strict';

  /* ================================================================== utilities */
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  // a lattice hash from a fixed permutation table (fast; its period of 1024 cells is far beyond the sheet)
  const PERM = new Int32Array(2048), RVAL = new Float32Array(1024);
  (() => {
    const r = mulberry32(0x51ab17);
    for (let i = 0; i < 1024; i++) { PERM[i] = i; RVAL[i] = r(); }
    for (let i = 1023; i > 0; i--) { const j = (r() * (i + 1)) | 0; const t = PERM[i]; PERM[i] = PERM[j]; PERM[j] = t; }
    for (let i = 0; i < 1024; i++) PERM[i + 1024] = PERM[i];
  })();
  function hash(ix, iy, s) {
    return RVAL[PERM[PERM[(ix + Math.imul(s, 59)) & 1023] + (iy & 1023)]];
  }
  function vn(x, y, s) {
    const xi = Math.floor(x), yi = Math.floor(y);
    let xf = x - xi, yf = y - yi;
    xf = xf * xf * (3 - 2 * xf); yf = yf * yf * (3 - 2 * yf);
    const a = hash(xi, yi, s), b = hash(xi + 1, yi, s), c = hash(xi, yi + 1, s), d = hash(xi + 1, yi + 1, s);
    return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf;
  }
  function fbm(x, y, s, o) {
    let t = 0, amp = 0.5, n = 0;
    for (let i = 0; i < o; i++) { t += amp * vn(x, y, s + i * 101); n += amp; x = x * 2.03 + 17.1; y = y * 2.03 - 9.7; amp *= 0.5; }
    return t / n;
  }
  function vnP(x, y, s, per) {
    const xi = Math.floor(x), yi = Math.floor(y);
    let xf = x - xi, yf = y - yi;
    xf = xf * xf * (3 - 2 * xf); yf = yf * yf * (3 - 2 * yf);
    const x0 = ((xi % per) + per) % per, y0 = ((yi % per) + per) % per, x1 = (x0 + 1) % per, y1 = (y0 + 1) % per;
    const a = hash(x0, y0, s), b = hash(x1, y0, s), c = hash(x0, y1, s), d = hash(x1, y1, s);
    return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf;
  }

  /* ================================================================== the sheet */
  const RW = 2400, RH = 3200;              // the drawing, in render pixels (3:4, upright)
  const F = 2, FW = RW / F, FH = RH / F, N = FW * FH;   // analysis fields at half resolution
  const HY = 2440;                         // eye level, just above the water
  const VPX = 1440;                        // where the gorge vanishes
  const GX = 1456, GY = 2250;              // the low sun, behind the mist at the far end

  const SKY = 0, WATER = 1, CLIFF = 10, PEDL = 40, PEDR = 41, KINGL = 50, KINGR = 51;
  const isKing = (o) => o === KINGL || o === KINGR;
  const isPed = (o) => o === PEDL || o === PEDR;
  const isCliff = (o) => o >= CLIFF && o < CLIFF + 30;

  // light: from the right, low and warm, raking across the faces of the kings
  const LV = (() => { const v = [0.74, -0.36, 0.52]; const l = Math.hypot(v[0], v[1], v[2]); return v.map((c) => c / l); })();

  // pigments: optical density per unit in R,G,B, and how much each granulates
  const PIG = [
    [0.07, 0.24, 0.80, 0.45], // 0 yellow ochre
    [0.82, 0.58, 0.15, 1.00], // 1 French ultramarine
    [0.24, 0.60, 0.98, 0.35], // 2 burnt sienna
    [0.60, 0.28, 0.56, 0.12], // 3 terre verte
    [0.66, 0.80, 0.98, 0.65], // 4 sepia
    [0.05, 0.46, 0.38, 0.00], // 5 light red / rose
    [0.84, 0.72, 0.56, 0.20], // 6 Payne's grey
  ];
  const OCH = 0, ULT = 1, SIE = 2, GRN = 3, SEP = 4, ROS = 5, PAY = 6;
  const PAPER = [247, 241, 227];
  const GCOL = [0.16, 0.17, 0.2];   // graphite, as a multiplier at full pressure

  /* ------------------------------------------------ polygon spans in field space */
  function fillPoly(pts, fn) {
    let y0 = Infinity, y1 = -Infinity;
    for (const p of pts) { if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1]; }
    const j0 = Math.max(0, Math.floor(y0 / F)), j1 = Math.min(FH - 1, Math.ceil(y1 / F));
    const n = pts.length, xs = [];
    for (let j = j0; j <= j1; j++) {
      const yc = (j + 0.5) * F;
      xs.length = 0;
      for (let i = 0; i < n; i++) {
        const a = pts[i], b = pts[(i + 1) % n];
        if ((a[1] <= yc && b[1] > yc) || (b[1] <= yc && a[1] > yc)) xs.push(a[0] + (yc - a[1]) * (b[0] - a[0]) / (b[1] - a[1]));
      }
      xs.sort((p, q) => p - q);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const xa = xs[k] / F, xb = xs[k + 1] / F;
        const i0 = Math.max(0, Math.ceil(xa - 0.5)), i1 = Math.min(FW - 1, Math.floor(xb - 0.5));
        if (i1 >= i0) fn(j, i0, i1, xa, xb);
      }
    }
  }

  // midpoint-displaced line from a to b (rock edges)
  function jag(a, b, levels, rough, rnd, vert) {
    let pts = [a, b];
    let amp = Math.hypot(b[0] - a[0], b[1] - a[1]) * rough;
    for (let l = 0; l < levels; l++) {
      const out = [pts[0]];
      for (let i = 0; i + 1 < pts.length; i++) {
        const p = pts[i], q = pts[i + 1];
        const dx = q[0] - p[0], dy = q[1] - p[1], len = Math.hypot(dx, dy) || 1;
        const o = (rnd() - 0.5) * amp;
        let mx = (p[0] + q[0]) / 2 - dy / len * o, my = (p[1] + q[1]) / 2 + dx / len * o;
        if (vert) { mx = (p[0] + q[0]) / 2 + o; my = (p[1] + q[1]) / 2 + (rnd() - 0.5) * amp * 0.2; }
        out.push([mx, my], q);
      }
      pts = out; amp *= 0.55;
    }
    return pts;
  }

  /* ================================================================ the two kings
   * Designed in "king units": x across (0 = the axis), y down from the top of the crown.
   * The king's own left hand (raised) is on the viewer's right (+x); the right hand holds the
   * axe (-x). Heights z are in the same units (towards the viewer).
   */
  function kingDesign(side, rnd, turn, headScale) {
    const P = [];
    const M = (o) => { P.push(Object.assign({ op: 'max' }, o)); };
    const A = (o, on) => { P.push(Object.assign({ op: 'add', on }, o)); };
    const C = (o, on) => { P.push(Object.assign({ op: 'cut', on }, o)); };
    const lines = [];        // incised lines also drawn in pencil: {p, w, on}
    const mirror = (pts) => pts.map((p) => [-p[0], p[1]]);
    const cutLine = (p, r, d, on, w) => { C({ k: 'cap', p, r: [r, r], b: d }, on); lines.push({ p, w: w || 1, on }); };
    const HELM = 1, CROWN = 2, FACE = 3, BEARD = 4, TORSO = 5, PAUL = 6, CLOAK = 7, ARM = 8, HAND = 9, HAFT = 10, AXE = 11, LEG = 12, PLINTH = 13;
    const bit = (...a) => a.reduce((m, b) => m | (1 << b), 0);
    const R = side < 0; // left king

    /* the mantle, hanging behind from the shoulders to the feet */
    M({ k: 'poly', p: [[-250, 418], [-330, 520], [-366, 760], [-396, 1080], [-418, 1380], [-404, 1720], [-236, 1720], [-226, 1000]], z: 6, b: 24, rb: 60, part: CLOAK });
    M({ k: 'poly', p: [[250, 418], [330, 520], [352, 800], [376, 1100], [392, 1380], [384, 1720], [236, 1720], [226, 1000]], z: 6, b: 24, rb: 60, part: CLOAK });
    for (const sx of [-1, 1]) for (let q = 0; q < 6; q++) {
      const x0 = sx * (258 + q * 18), x1 = sx * (254 + q * 38);
      A({ k: 'cap', p: [[x0, 600 + q * 40], [x1, 1720]], r: [10, 20], b: 12 }, bit(CLOAK));
    }
    /* the body: a mail coat under a long robe that falls to the feet in deep folds */
    M({ k: 'poly', p: [[-262, 404], [262, 404], [300, 520], [282, 700], [240, 880], [240, 1060], [256, 1260], [270, 1480], [284, 1720], [-284, 1720], [-270, 1480], [-256, 1260], [-240, 1060], [-240, 880], [-282, 700], [-300, 520]], z: 40, b: 100, rb: 230, part: TORSO });
    // drapery: folds of every width hang from the belt, fan out over the advanced left knee, are swept
    // aside by the axe arm, and break and pool where the hem meets the plinth
    A({ k: 'ell', c: [122, 1390], rx: 86, ry: 150, b: 22 }, bit(TORSO));
    const folds = [];
    for (let x = -262; x < 262;) {
      const w = 12 + rnd() * rnd() * 46, xc = x + w / 2;
      folds.push({ xc, w });
      x += w + 2 + rnd() * 10;
    }
    for (const f of folds) {
      const top = 948 + rnd() * 50 + (Math.abs(f.xc) > 200 ? 30 : 0);
      const knee = f.xc > 20 && f.xc < 240 ? (f.xc - 122) * 0.55 : 0;            // radiating from the knee
      const sweep = f.xc < -150 ? -26 - rnd() * 20 : 0;                            // pushed by the axe arm
      const bx = f.xc * 1.08 + knee + sweep + (rnd() - 0.5) * 10;
      const mid = [lerp(f.xc, bx, 0.45) + knee * 0.4 + (rnd() - 0.5) * 12, lerp(top, 1720, 0.5)];
      const deep = rnd() < 0.3 ? 4 + rnd() * 4 : 9 + rnd() * 12;                   // some broad and flat, some tight
      A({ k: 'cap', p: [[f.xc, top], mid, [bx, 1712]], r: [f.w * 0.32, f.w * 0.62], b: deep }, bit(TORSO));
      if (rnd() < 0.75) C({ k: 'cap', p: [[f.xc + f.w * 0.55, top + 40], [mid[0] + f.w * 0.6, mid[1]], [bx + f.w * 0.66, 1716]], r: [2.4, 5 + rnd() * 3], b: 6 + rnd() * 8 }, bit(TORSO));
    }
    for (let q = 0; q < 7; q++) A({ k: 'ell', c: [-250 + q * 82 + (rnd() - 0.5) * 30, 1706 + rnd() * 10], rx: 26 + rnd() * 26, ry: 16 + rnd() * 8, b: 8 + rnd() * 6 }, bit(TORSO));
    // breastplate, belt, buckle, gorget
    A({ k: 'poly', p: [[-196, 560], [196, 560], [205, 700], [170, 860], [-170, 860], [-205, 700]], b: 9, rb: 14 }, bit(TORSO));
    A({ k: 'cap', p: [[0, 590], [0, 850]], r: [26, 30], b: 7 }, bit(TORSO));
    A({ k: 'poly', p: [[-232, 878], [232, 878], [236, 934], [-236, 934]], b: 13, rb: 7 }, bit(TORSO));
    A({ k: 'ell', c: [0, 906], rx: 34, ry: 30, b: 9 }, bit(TORSO));
    A({ k: 'poly', p: [[-120, 405], [120, 405], [140, 470], [-140, 470]], b: 10, rb: 10 }, bit(TORSO));
    /* pauldrons */
    M({ k: 'ell', c: [-252, 452], rx: 140, ry: 78, z: 112, b: 42, part: PAUL });
    M({ k: 'ell', c: [252, 452], rx: 140, ry: 78, z: 112, b: 42, part: PAUL });
    for (const sx of [-1, 1]) {
      for (let k = 1; k <= 4; k++) {
        const pts = [];
        for (let a = 0.1; a <= 0.9; a += 0.04) {
          const t = Math.PI * a;
          pts.push([sx * 252 + Math.cos(t) * 140 * (1 - k * 0.03), 452 - 48 + k * 23 + Math.sin(t) * 36]);
        }
        cutLine(pts, 3.2, 7, bit(PAUL), 1.1);
      }
    }
    /* the raised left hand (+x): the arm lifted high, the palm turned outward above the crown */
    M({ k: 'cap', p: [[270, 482], [476, 372]], r: [84, 70], z: 96, b: 56, part: ARM });
    M({ k: 'ell', c: [482, 368], rx: 70, ry: 64, z: 104, b: 44, part: ARM });
    M({ k: 'cap', p: [[484, 360], [502, 56]], r: [68, 54], z: 124, b: 50, part: ARM });
    for (const f of [0.18, 0.34, 0.72, 0.86]) { const yy = lerp(360, 56, f), xx = lerp(480, 500, f); cutLine([[xx - 50, yy + 5], [xx + 46, yy - 4]], 2.6, 6, bit(ARM), 1); }
    M({ k: 'poly', p: [[452, 44], [548, 38], [567, -28], [564, -90], [454, -88], [446, -28]], z: 150, b: 15, rb: 24, part: HAND });
    C({ k: 'ell', c: [508, -32], rx: 30, ry: 28, b: 7 }, bit(HAND));
    A({ k: 'ell', c: [470, 2], rx: 26, ry: 34, b: 7 }, bit(HAND));
    const fingers = [
      [[468, -84], [464, -186], 15, 13],
      [[496, -88], [497, -206], 16, 14],
      [[524, -86], [528, -194], 15, 13],
      [[551, -80], [560, R ? -158 : -140], 13, 11.5],   // the right king has lost the tip of his little finger
    ];
    for (const f of fingers) {
      M({ k: 'cap', p: [f[0], f[1]], r: [f[2], f[3]], z: 156, b: 13, part: HAND });
      for (const u of [48.36, -299.32]) {
        const cx = lerp(f[0][0], f[1][0], u), cy = lerp(f[0][1], f[1][1], u);
        cutLine([[cx - f[2] * 0.7, cy + 1.5], [cx + f[2] * 0.7, cy - 1]], 1.6, 4, bit(HAND), 0.7);
      }
    }
    M({ k: 'cap', p: [[458, 14], [428, -30], [414, -72]], r: [67, -286], z: 162, b: 13, part: HAND });
    cutLine([[420, -48], [436, -54]], 1.6, 4, bit(HAND), 0.7);
    cutLine([[472, 36], [480, -4], [494, -38], [518, -60]], 1.8, 5, bit(HAND), 0.8);   // life line
    cutLine([[468, -54], [506, -64], [548, -62]], 1.6, 4, bit(HAND), 0.7);
    cutLine([[452, -68], [498, -74]], 1.5, 3, bit(HAND), 0.6);
    /* the right arm (-x), holding the axe */
    M({ k: 'cap', p: [[-272, 482], [-350, 742]], r: [84, 68], z: 96, b: 54, part: ARM });
    M({ k: 'cap', p: [[-344, 742], [-328, 868]], r: [63, 56], z: 126, b: 40, part: ARM });
    for (const yy of [790, 832]) cutLine([[-392, yy - 4], [-282, yy + 4]], 2.6, 6, bit(ARM), 1);
    // haft
    M({ k: 'cap', p: [[-326, 140], [-326, 1660]], r: [15, 17], z: 140, b: 14, part: HAFT });
    M({ k: 'ell', c: [-326, 140], rx: 22, ry: 20, z: 146, b: 16, part: HAFT });
    for (const yy of [470, 492, 514, 1000, 1022, 1360, 1382]) cutLine([[-346, yy], [-306, yy + 4]], 2.2, 5, bit(HAFT), 0.9);
    // fist round the haft
    M({ k: 'ell', c: [-328, 900], rx: 58, ry: 50, z: 150, b: 30, part: HAND });
    for (const yy of [878, 900, 922]) cutLine([[-374, yy - 2], [-288, yy + 3]], 2.2, 6, bit(HAND), 0.9);
    M({ k: 'cap', p: [[-292, 870], [-286, 898], [-300, 918]], r: [15, 12], z: 168, b: 10, part: HAND });
    // the axe
    M({ k: 'poly', p: [[-348, 222], [-304, 222], [-300, 432], [-352, 432]], z: 152, b: 12, rb: 9, part: AXE });
    const blade = [[-348, 244], [-384, 236], [-432, 210], [-480, 184], [-522, 190], [-548, 262], [-554, 342], [-540, 422], [-508, 494], [-472, 508], [-436, 474], [-388, 436], [-350, 418]];
    M({ k: 'poly', p: blade, z: 146, b: 12, rb: 46, part: AXE });
    M({ k: 'poly', p: [[-304, 272], [-262, 292], [-248, 316], [-262, 340], [-304, 362]], z: 150, b: 9, rb: 10, part: AXE });
    cutLine([[-398, 250], [-444, 236], [-490, 220], [-514, 236], [-528, 300], [-528, 380], [-510, 448], [-480, 476], [-446, 452]], 2.2, 5, bit(AXE), 0.9);
    cutLine([[-372, 300], [-400, 330], [-404, 372], [-380, 398]], 1.8, 4, bit(AXE), 0.8);
    cutLine([[-420, 300], [-450, 340], [-452, 384], [-428, 414]], 1.8, 4, bit(AXE), 0.8);

    /* the head: helm, crown, face, beard */
    M({ k: 'ell', c: [0, 156], rx: 112, ry: 134, z: 50, b: 80, part: HELM });
    const cheek = [[-100, 180], [-70, 184], [-64, 262], [-72, 316], [-86, 328], [-98, 298], [-104, 238]];
    M({ k: 'poly', p: cheek, z: 104, b: 14, rb: 16, part: HELM });
    M({ k: 'poly', p: mirror(cheek), z: 104, b: 14, rb: 16, part: HELM });
    M({ k: 'poly', p: [[-68, 172], [68, 172], [70, 236], [62, 300], [-62, 300], [-70, 236]], z: 108, b: 24, rb: 40, part: FACE });
    M({ k: 'poly', p: [[-84, 158], [84, 158], [80, 180], [-80, 180]], z: 114, b: 18, rb: 8, cyl: 92, part: HELM });
    // crown: circlet, jewels, tines (some broken)
    M({ k: 'poly', p: [[-118, 106], [118, 106], [116, 152], [-116, 152]], z: 104, b: 26, rb: 7, cyl: 124, part: CROWN });
    for (const gx of [-74, -37, 0, 37, 74]) A({ k: 'ell', c: [gx, 129], rx: 9, ry: 9, b: 6 }, bit(CROWN));
    cutLine([[-114, 114], [114, 114]], 1.6, 3, bit(CROWN), 0.7);
    cutLine([[-114, 144], [114, 144]], 1.6, 3, bit(CROWN), 0.7);
    const tines = [[-92, 52], [-48, 24], [0, 0], [48, 24], [92, 52]];
    const broken = R ? [2, 0] : [4];
    tines.forEach((t, i) => {
      let top = t[1];
      const br = broken.indexOf(i) >= 0;
      if (br) top = lerp(108, t[1], 0.38 + rnd() * 0.2);
      const w = 17;
      const pts = br
        ? [[t[0] - w, 108], [t[0] - w * 0.55, top + 8], [t[0] - 4, top + 2 + rnd() * 6], [t[0] + 3, top + 10], [t[0] + w * 0.5, top], [t[0] + w, 108]]
        : [[t[0] - w, 108], [t[0] - 5, top + 10], [t[0], top], [t[0] + 5, top + 10], [t[0] + w, 108]];
      M({ k: 'poly', p: pts, z: 100, b: 16, rb: 9, part: CROWN });
      cutLine([[t[0], 104], [t[0], top + (br ? 14 : 12)]], 1.4, 3, bit(CROWN), 0.6);
    });
    // brow (stern, drawn down at the centre), eyes, nose, cheeks
    M({ k: 'cap', p: [[-62, 182], [-30, 186], [-8, 197]], r: [11, 13], z: 130, b: 11, part: FACE });
    M({ k: 'cap', p: [[8, 197], [30, 186], [62, 182]], r: [13, 11], z: 130, b: 11, part: FACE });
    for (const sx of [-1, 1]) {
      C({ k: 'ell', c: [sx * 31, 212], rx: 19, ry: 10, b: 9 }, bit(FACE));
      A({ k: 'ell', c: [sx * 31, 212], rx: 13, ry: 6.5, b: 9 }, bit(FACE));
      A({ k: 'cap', p: [[sx * 46, 207], [sx * 31, 205], [sx * 17, 209]], r: [5, 5], b: 8 }, bit(FACE));   // heavy, hooding lid
      cutLine([[sx * 8, 176], [sx * 6, 194]], 1.4, 3, bit(FACE), 0.7);
      cutLine([[sx * 48, 228], [sx * 56, 236]], 1.2, 2.5, bit(FACE), 0.5);
      cutLine([[sx * 46, 205], [sx * 31, 202], [sx * 17, 206]], 1.5, 3, bit(FACE), 0.8);
      cutLine([[sx * 44, 219], [sx * 31, 222], [sx * 18, 218]], 1.4, 2.5, bit(FACE), 0.6);
      A({ k: 'ell', c: [sx * 41, 238], rx: 21, ry: 16, b: 8 }, bit(FACE));
      cutLine([[sx * 14, 254], [sx * 26, 272], [sx * 30, 292]], 1.6, 4, bit(FACE), 0.8);  // nasolabial fold
    }
    M({ k: 'cap', p: [[0, 192], [0, 254]], r: [9, 15], z: 134, b: 15, part: FACE });
    M({ k: 'ell', c: [0, 256], rx: 18, ry: 12, z: 134, b: 16, part: FACE });
    C({ k: 'ell', c: [-8, 265], rx: 4.5, ry: 3, b: 7 }, bit(FACE));
    C({ k: 'ell', c: [8, 265], rx: 4.5, ry: 3, b: 7 }, bit(FACE));
    C({ k: 'ell', c: [R ? 5 : -4, 254], rx: R ? 11 : 8, ry: R ? 9 : 6, b: R ? 10 : 6 }, bit(FACE));   // the noses are worn away
    // moustache, mouth, beard
    M({ k: 'cap', p: [[-3, 270], [-30, 282], [-50, 310], [-58, 356]], r: [10, 6], z: 150, b: 9, part: BEARD });
    M({ k: 'cap', p: [[3, 270], [30, 282], [50, 310], [58, 356]], r: [10, 6], z: 150, b: 9, part: BEARD });
    const beard = [[-62, 274], [-40, 282], [0, 288], [40, 282], [62, 274], [84, 352], [91, 432], [78, 516], [44, 582], [0, 600], [-44, 582], [-78, 516], [-91, 432], [-84, 352]];
    M({ k: 'poly', p: beard, z: 132, b: 34, rb: 60, part: BEARD });
    A({ k: 'ell', c: [0, 296], rx: 15, ry: 6, b: 4 }, bit(BEARD, FACE));
    cutLine([[-17, 290], [0, 292], [17, 290]], 2, 6, bit(BEARD, FACE), 1);
    // beard: rows of carved ringlets, each a small coiled lock, in layers down to the two forks
    for (let y = 318, row = 0; y < 590; y += 23, row++) {
      const half = y < 360 ? 70 : y < 500 ? 86 : 86 - (y - 500) * 0.55;
      for (let x = -half + (row % 2) * 11; x <= half; x += 22) {
        if (Math.abs(x) < 6 && y > 540) continue;
        A({ k: 'ell', c: [x, y], rx: 10.5, ry: 11, b: 5 }, bit(BEARD));
        const pts = [];
        for (let a = 0; a < TAU * 1.25; a += 0.45) { const r = 9 * (1 - a / (TAU * 1.6)); pts.push([x + Math.cos(a + row) * r, y + Math.sin(a + row) * r * 1.05]); }
        lines.push({ p: pts, w: 0.75, on: bit(BEARD) });
        C({ k: 'cap', p: [[x - 9, y + 10], [x, y + 12], [x + 9, y + 10]], r: [2, 2], b: 4 }, bit(BEARD));
      }
    }
    C({ k: 'cap', p: [[0, 520], [0, 604]], r: [4, 12], b: 14 }, bit(BEARD));

    /* hem and folds of the hauberk */
    const hem = [];
    for (let x = -264; x <= 264; x += 12) hem.push([x, 1250 + Math.abs(x) * 0.06 + Math.sin(x * 0.12) * 5]);
    cutLine(hem, 3, 7, bit(TORSO), 1.1);

    /* the head may be carved a little larger, so that the face carries from far below */
    if (headScale && headScale !== 1) {
      const HP = (1 << HELM) | (1 << CROWN) | (1 << FACE) | (1 << BEARD);
      const hs = (p) => [p[0] * headScale, 330 + (p[1] - 330) * headScale];
      for (const pr of P) {
        const head = pr.op === 'max' ? (HP & (1 << pr.part)) : ((pr.on & HP) && !(pr.on & ~HP));
        if (!head) continue;
        if (pr.k === 'ell') { pr.c = hs(pr.c); pr.rx *= headScale; pr.ry *= headScale; }
        else { pr.p = pr.p.map(hs); if (pr.k === 'cap') pr.r = pr.r.map((r) => r * headScale); if (pr.rb) pr.rb *= headScale; if (pr.cyl) pr.cyl *= headScale; }
      }
      for (const L of lines) if ((L.on & HP) && !(L.on & ~HP)) L.p = L.p.map(hs);
    }
    /* proportion: the body below the shoulders is drawn out, so the kings stand eight heads high */
    const SK = 1.5, st = (y) => (y <= 400 ? y : 400 + (y - 400) * SK);
    for (const pr of P) {
      if (pr.k === 'ell') { const big = pr.c[1] > 600; pr.c = [pr.c[0], st(pr.c[1])]; if (big) pr.ry *= SK; }
      else pr.p = pr.p.map((p) => [p[0], st(p[1])]);
    }
    for (const L of lines) L.p = L.p.map((p) => [p[0], st(p[1])]);
    // the haft rests on the plinth; the feet show beneath the robe; the plinth is carved from the pillar's head
    const foot = st(1720);
    M({ k: 'cap', p: [[-326, foot - 40], [-326, foot + 70]], r: [17, 18], z: 140, b: 14, part: HAFT });
    for (const sx of [-1, 1]) {
      M({ k: 'ell', c: [sx * 128, foot + 26], rx: 80, ry: 40, z: 70, b: 30, part: LEG });
      cutLine([[sx * 128 - 70, foot + 22], [sx * 128 + 70, foot + 26]], 2, 5, bit(LEG), 0.8);
    }
    M({ k: 'poly', p: [[-520, foot + 54], [520, foot + 54], [540, foot + 110], [530, foot + 190], [-530, foot + 190], [-540, foot + 110]], z: 0, b: 30, rb: 30, part: PLINTH });
    for (const yy of [foot + 78, foot + 110, foot + 150]) cutLine([[-530, yy], [530, yy]], 2.6, 7, bit(PLINTH), 1);
    // a worn inscription in an old script runs along the band, and a running scroll below it
    for (let x = -500; x < 500; x += 24 + rnd() * 10) {
      if (rnd() < 0.16) { x += 30; continue; }                       // lost to the weather
      const y0 = foot + 86, y1 = foot + 104, kind = (rnd() * 4) | 0;
      cutLine([[x, y0 - (kind === 1 ? 4 : 0)], [x + 1, y1 + (kind === 2 ? 5 : 0)]], 2, 6, bit(PLINTH), 1.4);
      const bow = [];
      for (let a = -1.4; a <= 1.4; a += 0.35) bow.push([x + 2 + Math.cos(a) * 8, (kind % 2 ? y0 + 6 : y1 - 6) + Math.sin(a) * 6]);
      cutLine(bow, 1.8, 5, bit(PLINTH), 1.2);
      if (kind === 3) { const b2 = bow.map((p) => [p[0] + 9, p[1]]); cutLine(b2, 1.8, 5, bit(PLINTH), 1.2); }
      if (rnd() < 0.4) cutLine([[x - 2, y0 - 5], [x + 5, y0 - 8], [x + 10, y0 - 5]], 1, 2, bit(PLINTH), 0.5);
    }
    {
      const pts = [];
      for (let x = -520; x <= 520; x += 3) { const ph = (x + 520) / 44 * TAU; pts.push([x + Math.sin(ph) * 6, foot + 168 + Math.cos(ph) * 10]); }
      cutLine(pts, 1.8, 4, bit(PLINTH), 0.8);
    }

    /* three-quarter turn: the nearer a part stands out, the further it slides; the far side narrows */
    const sn = Math.sin(turn), cf = Math.cos(turn * 1.6), cn = 1 + Math.abs(sn) * 0.1;
    const tx = (x, z) => (x * Math.sign(turn) > 0 ? x * cf : x * cn) + z * sn;
    const ZP = [0, 120, 125, 135, 145, 110, 140, 20, 140, 160, 150, 155, 90, 20];
    const zOn = (on) => { let z = 0; for (let b = 1; b < ZP.length; b++) if (on & (1 << b)) z = Math.max(z, ZP[b]); return z || 120; };
    // the head turns as one piece, its features sliding only a little within it
    const HEADP = (1 << HELM) | (1 << CROWN) | (1 << FACE) | (1 << BEARD);
    const hx = (x, z) => x * 0.9 + 125 * sn + (z - 120) * sn * 0.35;
    const isHead = (pr) => (pr.op === 'max' ? (HEADP & (1 << pr.part)) : ((pr.on & HEADP) && !(pr.on & ~HEADP))) && (pr.k === 'ell' ? pr.c[1] : Math.min(...pr.p.map((p) => p[1]))) < 330;
    for (const pr of P) {
      const z = pr.op === 'max' ? (pr.z || 0) + pr.b * 0.6 : zOn(pr.on);
      if (isHead(pr)) {
        if (pr.k === 'ell') { pr.c = [hx(pr.c[0], z), pr.c[1]]; pr.rx *= 0.9; }
        else { pr.p = pr.p.map((p) => [hx(p[0], z), p[1]]); if (pr.k === 'cap') pr.r = [pr.r[0] * 0.9, pr.r[1] * 0.9]; if (pr.cyl) pr.cyl *= 0.9; }
        continue;
      }
      if (pr.k === 'ell') { const c = pr.c[0] * Math.sign(turn) > 0 ? cf : cn; pr.c = [tx(pr.c[0], z), pr.c[1]]; pr.rx *= c; }
      else {
        pr.p = pr.p.map((p) => [tx(p[0], z), p[1]]);
        if (pr.k === 'cap') { const c = pr.p[0][0] * Math.sign(turn) > 0 ? cf : cn; pr.r = [pr.r[0] * c, pr.r[1] * c]; }
        if (pr.cyl) pr.cyl *= cf;
      }
    }
    for (const L of lines) {
      const z = zOn(L.on), head = (L.on & HEADP) && !(L.on & ~HEADP) && Math.min(...L.p.map((p) => p[1])) < 330;
      L.p = L.p.map((p) => [head ? hx(p[0], z) : tx(p[0], z), p[1]]);
    }
    return { P, lines, foot, parts: { HELM, CROWN, FACE, BEARD, TORSO, PAUL, CLOAK, ARM, HAND, HAFT, AXE, LEG, PLINTH } };
  }

  /* Voronoi facets: the nearest of a jittered grid of points, for fractured rock */
  function facet(x, y, s) {
    const xi = Math.floor(x), yi = Math.floor(y);
    let best = 9, id = 0, second = 9;
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
      const cx = xi + i, cy = yi + j;
      const px = cx + hash(cx, cy, s), py = cy + hash(cx, cy, s + 7);
      const d = (px - x) * (px - x) + (py - y) * (py - y);
      if (d < best) { second = best; best = d; id = (Math.imul(cx, 73856093) ^ Math.imul(cy, 19349663)) >>> 0; } else if (d < second) second = d;
    }
    return { id, edge: Math.sqrt(second) - Math.sqrt(best) };
  }

  /* The per-pixel finish of one band of the sheet. Pure (it also runs inside a worker):
   * A: transmittance of the non-granulating washes, B: granulating density, C: dry-brush, all RGBA
   * at field resolution; G: graphite alpha at sheet resolution; tA/tB: the paper's tooth. */
  function composeBand(m) {
    const { y0, y1, RW, FW, FH, F, j0, A, B, C, G, tA, tB, PAPER, GCOL } = m;
    const H = y1 - y0, out = new Uint8ClampedArray(H * RW * 4);
    const expT = new Float32Array(2049); for (let q = 0; q <= 2048; q++) expT[q] = Math.exp(-q / 120);
    for (let yy = 0; yy < H; yy++) {
      const y = y0 + yy;
      let fy = y / F - 0.5; if (fy < 0) fy = 0;
      let ja = Math.floor(fy); const ty = fy - ja; let jb = ja + 1;
      if (ja > FH - 1) ja = FH - 1; if (jb > FH - 1) jb = FH - 1;
      const ra = (ja - j0) * FW * 4, rb = (jb - j0) * FW * 4;
      const pa = (y % 480) * 480, pb = (y % 336) * 336;
      let xa = 0, xb = 0;
      for (let x = 0, q = yy * RW * 4; x < RW; x++, q += 4) {
        let fx = x / F - 0.5; if (fx < 0) fx = 0;
        const ia = fx | 0, tx = fx - ia; const ib = ia + 1 > FW - 1 ? FW - 1 : ia + 1;
        const w00 = (1 - tx) * (1 - ty), w10 = tx * (1 - ty), w01 = (1 - tx) * ty, w11 = tx * ty;
        const o00 = ra + ia * 4, o10 = ra + ib * 4, o01 = rb + ia * 4, o11 = rb + ib * 4;
        const ph = tA[pa + xa] * 0.62 + tB[pb + xb] * 0.38;
        if (++xa === 480) xa = 0;
        if (++xb === 336) xb = 0;
        const pk = 1 - ph, gran = 0.68 + 0.75 * pk * pk;
        const dr = (C[o00] * w00 + C[o10] * w10 + C[o01] * w01 + C[o11] * w11) / 255;
        const dryf = dr > 0.004 ? 1 - dr * (pk < 0.45 ? 0 : pk > 0.6 ? 1 : (pk - 0.45) * 6.67) * 0.85 : 1;
        const ga = G[yy * RW + x] / 255;
        let tooth = ga > 0 ? 0.28 + (ph - 0.42) * 2.3 + ga * 0.75 : 0; tooth = tooth < 0 ? 0 : tooth > 1 ? 1 : tooth;
        const gk = ga * tooth * 0.9, pap = 0.965 + ph * 0.05;
        for (let ch = 0; ch < 3; ch++) {
          const av = A[o00 + ch] * w00 + A[o10 + ch] * w10 + A[o01 + ch] * w01 + A[o11 + ch] * w11;
          const bv = (B[o00 + ch] * w00 + B[o10 + ch] * w10 + B[o01 + ch] * w01 + B[o11 + ch] * w11) * gran;
          let tr = (av / 255) * (bv >= 2048 ? expT[2048] : expT[bv | 0]);
          tr = 1 - (1 - tr) * dryf;
          out[q + ch] = PAPER[ch] * pap * tr * (1 - gk * (1 - GCOL[ch]));
        }
        out[q + 3] = 255;
      }
    }
    return out;
  }

  /* ================================================================== mount */
  window.PIECES = window.PIECES || [];
  window.PIECES.push({
    id: 'argonath',
    title: 'The Pillars of the Kings',
    medium: 'Graphite and watercolour on cold-pressed paper',
    note: 'Press and hold to look closer',
    about: 'An original interpretation of Tolkien\'s text, not of any film: the Argonath, the two stone kings with their left hands ' +
      'raised in warning, seen from the water of Anduin as the three grey boats of the Fellowship are swept between them into the gorge. ' +
      'Worked the way a nineteenth-century topographical artist would have worked it: a full pencil drawing of the weathered stone, ' +
      'transparent washes floated over it, and the white of the paper kept for the mist and the spray.',
    tone: 'dark',
    room: '#1c1a17',
    mount(el, api) {
      let alive = true;
      const rnd = mulberry32(api.seed ^ 0x9e3779b9);
      const NS = (api.seed % 9973) | 0;   // noise seed offset

      el.style.background = '#1c1a17';
      el.style.touchAction = 'none';
      el.style.cursor = 'zoom-in';
      const view = document.createElement('canvas');
      view.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block';
      el.appendChild(view);
      const lens = document.createElement('canvas');
      lens.style.cssText = 'position:absolute;pointer-events:none;border-radius:50%;display:none;z-index:3;' +
        'box-shadow:0 0 0 1px rgba(70,58,44,.55),0 0 0 7px rgba(24,21,18,.42),0 18px 54px rgba(0,0,0,.6)';
      el.appendChild(lens);

      let sheet = null;          // the finished drawing (RW x RH)
      const workers = [];
      let preview = null;        // something to look at while it is being made
      let disp = null, dispKey = '';
      let layout = null;
      const wallTex = makeWallTexture();

      /* ---------------------------------------------------------- presenting the sheet */
      function computeLayout() {
        const w = el.clientWidth || 1, h = el.clientHeight || 1;
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        const aspect = RW / RH, narrow = w / h < 0.66;
        let sh, sw;
        if (narrow) {          // phone portrait: the sheet nearly edge to edge
          sw = w - 2 * Math.max(8, w * 0.03); sh = sw / aspect;
          if (sh > h * 0.88) { sh = h * 0.88; sw = sh * aspect; }
        } else {
          sh = h * 0.9; sw = sh * aspect;
          if (sw > w * 0.9) { sw = w * 0.9; sh = sw / aspect; }
        }
        const sx = Math.round((w - sw) / 2), sy = Math.round((h - sh) / 2 - (narrow ? h * 0.035 : h * 0.005));
        return { w, h, dpr, sx, sy, sw: Math.round(sw), sh: Math.round(sh) };
      }
      function scaledSheet(src, W, H) {
        // halve repeatedly for a clean reduction, then the last step
        let c = src, cw = src.width, ch = src.height;
        while (cw / 2 > W * 1.4) {
          const n = document.createElement('canvas'); n.width = Math.round(cw / 2); n.height = Math.round(ch / 2);
          const g = n.getContext('2d'); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
          g.drawImage(c, 0, 0, n.width, n.height); c = n; cw = n.width; ch = n.height;
        }
        const n = document.createElement('canvas'); n.width = W; n.height = H;
        const g = n.getContext('2d'); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
        g.drawImage(c, 0, 0, W, H);
        return n;
      }
      function present() {
        if (!alive) return;
        layout = computeLayout();
        const { w, h, dpr, sx, sy, sw, sh } = layout;
        const W = Math.round(w * dpr), H = Math.round(h * dpr);
        if (view.width !== W || view.height !== H) { view.width = W; view.height = H; }
        const g = view.getContext('2d');
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
        // the wall: warm dark plaster with a soft light falling on the sheet
        g.fillStyle = '#1c1a17'; g.fillRect(0, 0, w, h);
        g.globalAlpha = 0.5; g.fillStyle = g.createPattern(wallTex, 'repeat'); g.fillRect(0, 0, w, h); g.globalAlpha = 1;
        const rg = g.createRadialGradient(w / 2, sy + sh * 0.4, sh * 0.1, w / 2, sy + sh * 0.5, Math.max(w, h) * 0.8);
        rg.addColorStop(0, 'rgba(255,236,205,0.09)'); rg.addColorStop(0.5, 'rgba(255,230,200,0.03)'); rg.addColorStop(1, 'rgba(0,0,0,0.38)');
        g.fillStyle = rg; g.fillRect(0, 0, w, h);
        g.save();
        g.shadowColor = 'rgba(0,0,0,0.55)'; g.shadowBlur = 24; g.shadowOffsetX = 3; g.shadowOffsetY = 9;
        g.fillStyle = '#efe8da'; sheetPath(g, sx, sy, sw, sh); g.fill();
        g.restore();
        g.save(); sheetPath(g, sx, sy, sw, sh); g.clip();
        const src = sheet || preview;
        if (src) {
          const key = (sheet ? 's' : 'p') + sw + 'x' + sh + '@' + dpr;
          if (dispKey !== key) { disp = scaledSheet(src, Math.round(sw * dpr), Math.round(sh * dpr)); dispKey = key; }
          g.drawImage(disp, sx, sy, sw, sh);
        } else { g.fillStyle = 'rgb(247,241,227)'; g.fillRect(sx, sy, sw, sh); }
        const lg = g.createLinearGradient(sx, sy, sx + sw * 0.4, sy + sh);
        lg.addColorStop(0, 'rgba(255,248,235,0.04)'); lg.addColorStop(1, 'rgba(30,20,10,0.06)');
        g.fillStyle = lg; g.fillRect(sx, sy, sw, sh);
        g.restore();
        // hinges of tape at the top corners
        for (const tx of [sx + sw * 0.07, sx + sw * 0.93]) {
          g.save(); g.translate(tx, sy + 1); g.rotate(tx < w / 2 ? -0.06 : 0.05);
          g.fillStyle = 'rgba(226,216,190,0.72)'; g.fillRect(-sw * 0.045, -sh * 0.011, sw * 0.09, sh * 0.024);
          g.fillStyle = 'rgba(110,90,60,0.1)'; g.fillRect(-sw * 0.045, sh * 0.012, sw * 0.09, 1);
          g.restore();
        }
      }
      function sheetPath(g, x, y, w, h) {
        const r = mulberry32(77);
        g.beginPath();
        const n = 40;
        for (let i = 0; i <= n; i++) g.lineTo(x + w * i / n, y + (r() - 0.5) * 0.8);
        for (let i = 0; i <= n; i++) g.lineTo(x + w + (r() - 0.5) * 0.8, y + h * i / n);
        for (let i = n; i >= 0; i--) g.lineTo(x + w * i / n, y + h + (r() - 0.5) * 1.1);
        for (let i = n; i >= 0; i--) g.lineTo(x + (r() - 0.5) * 0.8, y + h * i / n);
        g.closePath();
      }
      function makeWallTexture() {
        const c = document.createElement('canvas'); c.width = c.height = 256;
        const g = c.getContext('2d'); const im = g.createImageData(256, 256);
        for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
          const v = vnP(x / 2, y / 2, 5, 128) * 0.35 + vnP(x / 8, y / 8, 6, 32) * 0.35 + vnP(x / 32, y / 32, 7, 8) * 0.3;
          const k = (y * 256 + x) * 4, a = (v - 0.5) * 2;
          im.data[k] = a > 0 ? 255 : 0; im.data[k + 1] = a > 0 ? 244 : 0; im.data[k + 2] = a > 0 ? 228 : 0;
          im.data[k + 3] = Math.abs(a) * 16;
        }
        g.putImageData(im, 0, 0);
        return c;
      }

      /* ---------------------------------------------------------- the lens */
      let lensOn = false, lensX = 0, lensY = 0, holdT = 0, pointerType = 'mouse';
      function drawLens() {
        if (!lensOn || !sheet || !layout) { lens.style.display = 'none'; return; }
        const { sx, sy, sw, dpr, w, h } = layout;
        const D = Math.round(clamp(Math.min(w, h) * 0.42, 170, 380));
        const touch = pointerType === 'touch';
        const px = lensX, py = lensY - (touch ? D * 0.66 : 0);
        lens.style.display = 'block';
        if (lens.width !== D * dpr) { lens.width = D * dpr; lens.height = D * dpr; }
        lens.style.width = D + 'px'; lens.style.height = D + 'px';
        lens.style.left = (px - D / 2) + 'px'; lens.style.top = (py - D / 2) + 'px';
        const k = RW / sw;                       // sheet px per css px
        const u = (lensX - sx) * k, v = (lensY - sy) * k;
        // one sheet pixel to one device pixel, but never less than 2.2x the wall view
        const mag = Math.max(2.2, k / dpr);
        const span = D * k / mag;               // sheet px shown across the lens
        const g = lens.getContext('2d');
        g.setTransform(1, 0, 0, 1, 0, 0);
        g.fillStyle = '#1c1a17'; g.fillRect(0, 0, lens.width, lens.height);
        g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
        g.drawImage(sheet, u - span / 2, v - span / 2, span, span, 0, 0, lens.width, lens.height);
        const vg = g.createRadialGradient(lens.width / 2, lens.height / 2, lens.width * 0.38, lens.width / 2, lens.height / 2, lens.width * 0.5);
        vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(40,30,20,0.16)');
        g.fillStyle = vg; g.fillRect(0, 0, lens.width, lens.height);
      }
      function localXY(e) { const r = el.getBoundingClientRect(); lensX = e.clientX - r.left; lensY = e.clientY - r.top; }
      function onDown(e) {
        pointerType = e.pointerType || 'mouse';
        localXY(e);
        clearTimeout(holdT);
        holdT = setTimeout(() => { lensOn = true; drawLens(); }, pointerType === 'touch' ? 160 : 90);
        try { el.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
      }
      function onMove(e) { localXY(e); if (lensOn) drawLens(); }
      function onUp() { clearTimeout(holdT); lensOn = false; drawLens(); }
      const noMenu = (e) => e.preventDefault();
      el.addEventListener('pointerdown', onDown);
      el.addEventListener('pointermove', onMove);
      el.addEventListener('pointerup', onUp);
      el.addEventListener('pointercancel', onUp);
      el.addEventListener('contextmenu', noMenu);

      let lastW = 0, lastH = 0, roT = 0;
      const ro = new ResizeObserver(() => {
        clearTimeout(roT);
        roT = setTimeout(() => {
          const w = el.clientWidth, h = el.clientHeight;
          if (Math.abs(w - lastW) < 2 && Math.abs(h - lastH) < 2) return;
          lastW = w; lastH = h; present(); drawLens();
        }, 80);
      });
      ro.observe(el);

      /* ---------------------------------------------------------- make the drawing */
      let lastYield = performance.now();
      // yield to the page between chunks of work (a message channel is not throttled like nested timers)
      const chan = new MessageChannel(), waiting = [];
      chan.port1.onmessage = () => { const r = waiting.shift(); if (r) r(); };
      const yieldNow = () => new Promise((r) => { waiting.push(r); chan.port2.postMessage(0); }).then(() => { lastYield = performance.now(); if (!alive) throw new Error('gone'); });
      const breathe = () => (performance.now() - lastYield > 60 ? yieldNow() : Promise.resolve());

      const t0 = performance.now();
      const TL = [];
      const mark = (n) => { TL.push(n + ' ' + Math.round(performance.now() - t0)); };
      render().then(() => {
        if (!alive) return;
        present();
        api.ready();
        window.__argonathTime = Math.round(performance.now() - t0);
      }).catch((e) => { if (alive) { console.error(e); api.ready(); } });

      async function render() {
        present();
        /* ------------------------------------------------------------ fields */
        const oid = new Uint8Array(N);
        const Hf = new Float32Array(N);
        const part = new Uint8Array(N);
        const pid = new Int16Array(N).fill(-1);
        const dep = new Float32Array(N).fill(1);
        const aux = new Float32Array(N);     // kings: design y; cliffs: depth z
        const auxX = new Float32Array(N);    // kings: design x
        const lam = new Float32Array(N), shd = new Float32Array(N), cav = new Float32Array(N), gx = new Float32Array(N), gy = new Float32Array(N);
        const idx = (x, y) => { const i = (x / F) | 0, j = (y / F) | 0; return (x < 0 || y < 0 || i >= FW || j >= FH) ? -1 : j * FW + i; };

        /* water: everything below the eye line */
        for (let j = Math.floor(HY / F); j < FH; j++) for (let i = 0; i < FW; i++) { const k = j * FW + i; oid[k] = WATER; dep[k] = clamp(1 - ((j * F - HY) / 700), 0.05, 1); }

        /* the gorge: two sheer walls running away to the light, with buttresses and a crest of trees */
        const walls = [];
        for (const side of [-1, 1]) {
          const xne = side < 0 ? 1130 : 1730, yne = side < 0 ? 1250 : 420, base = HY + 40;
          const r = -side;                                   // towards the river
          const zx = (z) => VPX + (xne - VPX) / z;
          const topAt = (z) => HY - (HY - yne) / z;
          const W = { side, xne, yne, zx, topAt, id: CLIFF + (side < 0 ? 0 : 15), crest: [], butt: [], trees: [] };
          // the crest of the wall, receding
          const zs = [1, 1.12, 1.3, 1.55, 1.9, 2.4, 3.1, 4.2, 6, 9, 15, 30];
          const ctrl = zs.map((z, q) => [zx(z), topAt(z) + (q ? (rnd() - 0.5) * 120 / z : 0)]);
          for (let q = 0; q + 1 < ctrl.length; q++) W.crest.push(...jag(ctrl[q], ctrl[q + 1], 3, 0.16, rnd).slice(q ? 1 : 0));
          W.crest.push([VPX, HY - 6]);
          const nearEdge = jag([xne, yne], [xne + r * 6, base], 5, 0.02, rnd, true);
          const face = [...nearEdge.slice().reverse(), ...W.crest, [VPX, HY + 2], [zx(2), HY + 40 / 2], [xne, base]];
          W.face = face; W.nearEdge = nearEdge;
          fillPoly(face, (j, i0, i1) => {
            for (let i = i0; i <= i1; i++) {
              const k = j * FW + i, x = (i + 0.5) * F;
              const dv = side < 0 ? Math.min(x - VPX, -0.5) : Math.max(x - VPX, 0.5);
              const z = Math.min(60, Math.max(1, (xne - VPX) / dv));
              oid[k] = W.id; aux[k] = z; dep[k] = clamp(0.22 + 0.78 * (1 - 1 / z), 0, 1);
            }
          });
          // buttresses standing out from the wall, far ones first
          const bz = [7.5, 5, 3.4, 2.4, 1.7, 1.28];
          for (let q = 0; q < bz.length; q++) {
            const z = bz[q] * (1 + (rnd() - 0.5) * 0.1);
            const xin = zx(z) + r * (26 + rnd() * 30) / z;
            const xback = zx(z / (1.22 + rnd() * 0.15));
            const tIn = topAt(z) - (rnd() * 80 - 10) / z, tBack = topAt(z / 1.25) + (rnd() * 60) / z;
            const edge = jag([xin, tIn], [xin + r * 3 / z, HY + 40 / z], 4, 0.03, rnd, true);
            const crest = jag([xback, tBack], [xin, tIn], 3, 0.12, rnd);
            const pts = [...crest, ...edge.slice(1), [xback, HY + 40 / z]];
            const id = W.id + 1 + q;
            const B = { z, xin, edge, crest, pts, id };
            W.butt.push(B);
            fillPoly(pts, (j, i0, i1, xa, xb) => {
              for (let i = i0; i <= i1; i++) {
                const k = j * FW + i;
                oid[k] = id; aux[k] = z; dep[k] = clamp(0.22 + 0.78 * (1 - 1 / z), 0, 1);
                Hf[k] = side < 0 ? (xb - i) * F * z : (i - xa) * F * z;   // distance from the buttress' river edge, as if near
              }
            });
          }
          // the shoulder of crag behind the king, falling away to the edge of the sheet
          const far = side < 0 ? [[-80, 1520], [260, 1450], [560, 1380], [860, 1310], [1000, 1280], [xne, yne]] : [[RW + 80, 40], [2280, 110], [2120, 190], [1960, 280], [1830, 360], [xne, yne]];
          const hill = [];
          for (let q = 0; q + 1 < far.length; q++) hill.push(...jag(far[q], far[q + 1], 4, side > 0 ? 0.32 : 0.14, rnd).slice(q ? 1 : 0));
          W.hill = hill;
          const hid = W.id + 9;
          fillPoly([...hill, ...nearEdge.slice(1), [far[0][0], base + 30]], (j, i0, i1) => {
            for (let i = i0; i <= i1; i++) { const k = j * FW + i; oid[k] = hid; aux[k] = 1; dep[k] = 0.26; }
          });
          walls.push(W);
        }
        await breathe();

        /* the kings */
        mark('kings');
        const kings = [];
        // the near king fills the left of the sheet and is cut by its edge; the far one stands across the water.
        // Both are seen from far below: verticals converge upward, horizontals sag, the heads are foreshortened.
        const KT = [
          { side: -1, turn: 0.4, Ya: 190, Yb: 2060, ax0: 700, ax1: 540, sx0: 0.7, sx1: 0.98, sag0: 70, sag1: 26, sc: 1 },
          { side: 1, turn: -0.4, Ya: 760, Yb: 1700, ax0: 1968, ax1: 2006, sx0: 0.32, sx1: 0.42, sag0: 22, sag1: 9, sc: 0.42 },
        ];
        for (const T of KT) {
          const d = kingDesign(T.side, rnd, T.turn, T.side < 0 ? 1.1 : 1);
          T.H = d.foot + 190;
          const GA = 0.78, GB = 0.22;
          T.g = (t) => GA * t + GB * t * t;
          T.sag = (t, dx) => { const u = Math.min(2, (dx / 380) * (dx / 380)); return lerp(T.sag0, T.sag1, clamp(t, 0, 1)) * (1 - u); };
          T.fx = (dx, dy) => { const t = dy / T.H; return [lerp(T.ax0, T.ax1, t) + dx * lerp(T.sx0, T.sx1, t), T.Ya + (T.Yb - T.Ya) * T.g(t) + T.sag(t, dx)]; };
          T.inv = (X, Y) => {
            let t = (Y - T.Ya) / (T.Yb - T.Ya), dx = 0;
            for (let it = 0; it < 4; it++) {
              dx = (X - lerp(T.ax0, T.ax1, t)) / lerp(T.sx0, T.sx1, t);
              const v = (Y - T.sag(t, dx) - T.Ya) / (T.Yb - T.Ya), disc = GA * GA + 4 * GB * v;
              t = disc > 0 ? (-GA + Math.sqrt(disc)) / (2 * GB) : -GA / (2 * GB);
            }
            return [(X - lerp(T.ax0, T.ax1, t)) / lerp(T.sx0, T.sx1, t), t * T.H];
          };
          T.scaleAt = (dy) => lerp(T.sx0, T.sx1, dy / T.H);
          kings.push({ side: T.side, d, T, id: T.side < 0 ? KINGL : KINGR, cracks: [] });
        }
        for (const K of kings) {
          const T = K.T;
          K.J0 = Math.max(0, Math.floor((T.fx(0, -300)[1] - 80) / F)); K.J1 = Math.min(FH - 1, Math.ceil((T.Yb + 80) / F));
          const n = (K.J1 - K.J0 + 1) * FW;
          K.DX = new Float32Array(n); K.DY = new Float32Array(n);
          for (let j = K.J0; j <= K.J1; j++) {
            const r = (j - K.J0) * FW, Y = (j + 0.5) * F;
            for (let i = 0; i < FW; i++) { const q = T.inv((i + 0.5) * F, Y); K.DX[r + i] = q[0]; K.DY[r + i] = q[1]; }
            if ((j & 63) === 63) await breathe();
          }
          const P = K.d.P;
          for (let pi = 0; pi < P.length; pi++) { applyPrim(K, P[pi], pi); if ((pi & 7) === 7) await breathe(); }
        }
        function primBox(pr) {
          let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
          const pad = pr.k === 'cap' ? Math.max(pr.r[0], pr.r[1]) : 0;
          const pts = pr.k === 'ell' ? [[pr.c[0] - pr.rx, pr.c[1] - pr.ry], [pr.c[0] + pr.rx, pr.c[1] + pr.ry]] : pr.p;
          for (const p of pts) { x0 = Math.min(x0, p[0] - pad); x1 = Math.max(x1, p[0] + pad); y0 = Math.min(y0, p[1] - pad); y1 = Math.max(y1, p[1] + pad); }
          return [x0, y0, x1, y1];
        }
        function primEval(pr, x, y) {
          if (pr.k === 'ell') {
            const qx = (x - pr.c[0]) / pr.rx, qy = (y - pr.c[1]) / pr.ry, q = qx * qx + qy * qy;
            if (q >= 1) return NaN;
            return (pr.z || 0) + pr.b * Math.sqrt(1 - q);
          }
          if (pr.k === 'cap') {
            const p = pr.p; let best = Infinity, bt = 0, acc = 0;
            for (let i = 0; i + 1 < p.length; i++) {
              const ax = p[i][0], ay = p[i][1], bx = p[i + 1][0] - ax, by = p[i + 1][1] - ay;
              const L2 = bx * bx + by * by || 1;
              let t = ((x - ax) * bx + (y - ay) * by) / L2; t = t < 0 ? 0 : t > 1 ? 1 : t;
              const ex = x - ax - bx * t, ey = y - ay - by * t, dd = ex * ex + ey * ey;
              const sl = Math.sqrt(L2);
              if (dd < best) { best = dd; bt = (acc + t * sl) / pr._len; }
              acc += sl;
            }
            const r = lerp(pr.r[0], pr.r[1], bt), dist = Math.sqrt(best);
            if (dist >= r) return NaN;
            const q = dist / r;
            return (pr.z || 0) + pr.b * Math.sqrt(1 - q * q);
          }
          const p = pr.p; let inside = false, best = Infinity;
          for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
            const xi = p[i][0], yi = p[i][1], xj = p[j][0], yj = p[j][1];
            if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) inside = !inside;
            const bx = xi - xj, by = yi - yj, L2 = bx * bx + by * by || 1;
            let t = ((x - xj) * bx + (y - yj) * by) / L2; t = t < 0 ? 0 : t > 1 ? 1 : t;
            const ex = x - xj - bx * t, ey = y - yj - by * t, dd = ex * ex + ey * ey;
            if (dd < best) best = dd;
          }
          if (!inside) return NaN;
          const pp = Math.min(1, Math.sqrt(best) / pr.rb);
          let prof = Math.sqrt(1 - (1 - pp) * (1 - pp));
          if (pr.cyl) { const u = x / pr.cyl; prof *= Math.sqrt(Math.max(0, 1 - u * u)) * 0.6 + 0.4; }
          return (pr.z || 0) + pr.b * prof;
        }
        function applyPrim(K, pr, pi) {
          if (pr.k === 'cap' && pr._len === undefined) {
            let L = 0; for (let i = 0; i + 1 < pr.p.length; i++) L += Math.hypot(pr.p[i + 1][0] - pr.p[i][0], pr.p[i + 1][1] - pr.p[i][1]);
            pr._len = L || 1;
          }
          const [x0, y0, x1, y1] = primBox(pr);
          let bx0 = Infinity, bx1 = -Infinity, by0 = Infinity, by1 = -Infinity;
          for (let u = 0; u <= 2; u++) for (let v = 0; v <= 2; v++) {
            const q = K.T.fx(lerp(x0, x1, u / 2), lerp(y0, y1, v / 2));
            bx0 = Math.min(bx0, q[0]); bx1 = Math.max(bx1, q[0]); by0 = Math.min(by0, q[1]); by1 = Math.max(by1, q[1]);
          }
          const X0 = Math.max(0, Math.floor(bx0 / F) - 3), X1 = Math.min(FW - 1, Math.ceil(bx1 / F) + 3);
          const J0 = Math.max(K.J0, Math.floor(by0 / F) - 3), J1 = Math.min(K.J1, Math.ceil(by1 / F) + 3);
          const id = K.id, scl = pr.scaled ? 1 : 0;
          for (let j = J0; j <= J1; j++) {
            const r = (j - K.J0) * FW;
            for (let i = X0; i <= X1; i++) {
              const dx = K.DX[r + i], dy = K.DY[r + i], sx = K.T.scaleAt(dy);
              const v = primEval(pr, dx, dy);
              if (v !== v) continue;
              const k = j * FW + i;
              if (pr.op === 'max') {
                if (oid[k] !== id || v > Hf[k]) { Hf[k] = v; oid[k] = id; part[k] = pr.part; pid[k] = pi; dep[k] = 0.06; aux[k] = dy; auxX[k] = dx; }
              } else if (oid[k] === id && (pr.on & (1 << part[k]))) {
                const dv = v - (pr.z || 0);
                Hf[k] += (pr.op === 'add' ? dv : -dv) * (scl ? sx / F : 1);
              }
            }
          }
        }

        /* the pedestals: a carved plinth, then the raw pinnacle of rock going down into the river */
        mark('peds');
        const peds = [];
        for (const K of kings) {
          const T = K.T, sc = K.side < 0 ? 1.25 : 0.5;
          const wl = K.side < 0 ? 2700 : 2486;
          const topDy = K.d.foot + 168, top = [];
          for (let dx = -560; dx <= 560; dx += 16) top.push(T.fx(dx, topDy + (rnd() - 0.5) * 10));
          const inner = K.side < 0 ? top[top.length - 1] : top[0];
          const innerBase = [inner[0] + (K.side < 0 ? 26 : -70), wl];
          // the sheer river face of the pinnacle, split and stepped
          const ctrl = [inner];
          for (let q = 1; q <= 9; q++) { const f = q / 9; ctrl.push([lerp(inner[0], innerBase[0], f) + (rnd() - 0.5) * 50 * sc * (f < 0.9 ? 1 : 0.3), lerp(inner[1], wl, f)]); }
          const edge = [inner];
          for (let q = 0; q + 1 < ctrl.length; q++) edge.push(...jag(ctrl[q], ctrl[q + 1], 3, 0.1, rnd).slice(1));
          const foot = [[innerBase[0] - K.side * 110 * sc, wl + 4], [innerBase[0] - K.side * 160 * sc, wl + 12]];
          let pts;
          if (K.side < 0) pts = [[-80, top[0][1] + 10], ...top, ...edge.slice(1), ...foot, [-80, wl + 24]];
          else {
            const e = top[top.length - 1];
            pts = [...top, ...jag(e, [RW + 80, e[1] - 150], 3, 0.15, rnd).slice(1), [RW + 80, wl + 24], ...foot.slice().reverse(), ...edge.slice(1).reverse()];
          }
          const pd = { id: K.side < 0 ? PEDL : PEDR, side: K.side, sc, wl, cw: 0, slope: 0, pts, edge, inTop: inner[0], inBase: innerBase[0], rowEdge: new Float32Array(FH).fill(NaN) };
          pd.top = Math.min(...top.map((p) => p[1])); pd.plinth = pd.top + 10;
          // the beds of the rock all dip one way; joints cross them at right angles
          pd.dip = K.side < 0 ? 0.11 : 0.09;
          pd.ledges = [];
          for (let y = pd.top + (100 + rnd() * 50) * sc; y < wl - 100 * sc; y += (110 + rnd() * 150) * sc) pd.ledges.push({ y, tilt: pd.dip + (rnd() - 0.5) * 0.03, d: (8 + rnd() * 12) * sc, u: (18 + rnd() * 34) * sc, js: (50 + rnd() * 90) * sc, jo: rnd() });
          // blocks fallen from the pinnacle into the river at its foot
          pd.blocks = [];
          for (let q = 0; q < (K.side < 0 ? 7 : 4); q++) {
            const w = (50 + rnd() * 110) * sc, h = (30 + rnd() * 70) * sc;
            const bx = innerBase[0] - K.side * (rnd() * 280 - 60) * sc, by = wl + (rnd() * 26 - 4) * sc;
            const a = (rnd() - 0.5) * 0.5;
            const pts2 = [[-w / 2, 0], [-w * 0.45, -h * 0.8], [-w * 0.1, -h], [w * 0.4, -h * 0.9], [w / 2, -h * 0.3], [w * 0.48, 0]].map((p) => [bx + p[0] * Math.cos(a) - p[1] * Math.sin(a), by + p[0] * Math.sin(a) + p[1] * Math.cos(a)]);
            pd.blocks.push(pts2);
          }
          fillPoly(pts, (j, i0, i1, xa, xb) => {
            for (let i = i0; i <= i1; i++) {
              const k = j * FW + i; oid[k] = pd.id; dep[k] = K.side < 0 ? 0.03 : 0.12; part[k] = 0;
              aux[k] = pd.side < 0 ? (xb - i) * F : (i - xa) * F;
              auxX[k] = (xb - xa) * F;
            }
            pd.rowEdge[j] = (pd.side < 0 ? xb : xa) * F;
          });
          for (const bp of pd.blocks) fillPoly(bp, (j, i0, i1, xa, xb) => { for (let i = i0; i <= i1; i++) { const k = j * FW + i; oid[k] = pd.id; dep[k] = 0.03; aux[k] = (i - xa) * F + 300; auxX[k] = (xb - xa) * F; } });
          peds.push(pd);
        }
        await breathe();
        const pOff = (pd, k) => aux[k] < pd.cw ? (pd.cw - aux[k]) * pd.slope : 0;
        // dark water-stains running down from under each ledge of the pillars
        function stainAt(pd, x, yv) {
          let top = pd.plinth + 60 * pd.sc, seed = 1;
          for (const L of pd.ledges) { if (L.y + L.u < yv) { top = L.y + L.u; seed = L.y | 0; } }
          const dd = yv - top, reach = (120 + 200 * vn(x / 23, seed, NS + 117)) * pd.sc;
          if (dd < 0 || dd > reach) return 0;
          const c = vn(x / 5.5, seed * 0.1, NS + 115) * 0.7 + vn(x / 2, seed, NS + 116) * 0.3;
          return c > 0.6 ? (c - 0.6) * 1.2 * (1 - dd / reach) : 0;
        }

        /* ------------------------------------------------------- relief and light */
        mark('relief');
        const Lx = LV[0], Ly = LV[1], Lz = LV[2];
        for (let j = 0; j < FH; j++) {
          const y = (j + 0.5) * F;
          for (let i = 0; i < FW; i++) {
            const k = j * FW + i, o = oid[k], x = (i + 0.5) * F;
            if (isKing(o)) {
              const K = o === KINGL ? kings[0] : kings[1];
              const s = K.T.scaleAt(aux[k]) / F;
              const dx = auxX[k], dy = aux[k];
              // weathering: eroded skin, pits, flaking, rain-runnels
              let h = Hf[k] + (fbm(dx / 30, dy / 30, NS + 3 + o, 3) - 0.5) * 6 + (vn(dx / 5, dy / 5, NS + 9) - 0.5) * 1.6;
              const pit = vn(dx / 3, dy / 3, NS + 21 + o);
              if (pit > 0.86) h -= (pit - 0.86) * 24;
              const flake = fbm(dx / 40, dy / 40, NS + 25 + o, 3);
              if (flake > 0.7) h -= 3;
              h -= Math.pow(vn(dx / 7, dy / 90, NS + 33 + o), 4) * 5;
              if (part[k] === 13) h = Hf[k] + (h - Hf[k]) * 0.3;   // the plinth's carving is better kept
              Hf[k] = h * s;
            } else if (isPed(o)) {
              // fractured rock: planar facets at two scales; the plinth is a worn moulding
              const pd = o === PEDL ? peds[0] : peds[1], sc = pd.sc;
              let nx, ny, nz;
              const onSide = aux[k] < pd.cw, off = onSide ? (pd.cw - aux[k]) * pd.slope : 0;
              if (y - off < pd.plinth) {
                const ry = (y - off - pd.top) / sc;
                const band = ry < 19 ? -0.5 : ry < 40 ? 0.15 : ry < 64 ? 0.55 : ry < 82 ? -0.1 : 0.5;
                nx = (fbm(x / 30, y / 10, NS + 41, 2) - 0.5) * 0.6 + (onSide ? -pd.side * 1.4 : 0); ny = band; nz = onSide ? 0.5 : 1;
              } else {
                // which bed, and which jointed block of it, this point lies in
                let li = 0, Lb = null;
                for (const L of pd.ledges) { if (L.y + L.tilt * (x - pd.inTop) < y) { li++; Lb = L; } }
                const js = Lb ? Lb.js : 90 * sc, jo = Lb ? Lb.jo : 0.3;
                const jx = (x + (y - pd.top) * pd.dip * -1) / js + jo + (vn(y / 60, li, NS + 44) - 0.5) * 0.25;
                const bid = li * 977 + Math.floor(jx);
                const h1 = hash(bid, 1, NS), h2 = hash(bid, 2, NS);
                nx = (h1 - 0.5) * 0.45; ny = (h2 - 0.55) * 0.25 - pd.dip; nz = 1;
                const fj = jx - Math.floor(jx);
                const joint = fj < 0.035 || fj > 0.985;
                if (fj < 0.12) nx += -0.35 * (1 - fj / 0.12);   // the block's edge is rounded by the weather
                // the pinnacle turns like a rough column: lit on the sun side, falling into shadow on the other
                const W = Math.min(auxX[k], 1400 * sc), q = pd.side < 0 ? 1 - 2 * Math.min(1, aux[k] / W) : -1 + 2 * Math.min(1, aux[k] / W);
                nx += q * 0.9 + (aux[k] < 40 * sc ? -pd.side * 0.8 : 0);
                // ledges of bedding cutting across the columns: lit tops, dark undersides
                for (const L of pd.ledges) {
                  const yl = y - off - (L.y + L.tilt * (x - pd.inTop) + (vn(x / 40, L.y, NS + 47) - 0.5) * 14 * sc);
                  if (yl > -L.d && yl < 0) { ny = -1.2; nx *= 0.4; break; }
                  if (yl >= 0 && yl < L.u) { ny = 0.9 + yl / L.u * -0.6; nz = 0.6; break; }
                }
                cav[k] = joint ? 1 : 0;
              }
              const l = Math.hypot(nx, ny, nz);
              lam[k] = Math.max(0, (nx * Lx + ny * Ly + nz * Lz) / l);
              gx[k] = nx / l; gy[k] = ny / l;
            } else if (isCliff(o)) {
              // sheer faces, split into tall slabs; one wall in the light, the other in shadow
              const sideL = o < CLIFF + 15, z = aux[k];
              const wy = (HY - y) * z;   // height above the water, as if near
              const f1 = facet(z * 4, wy / 420, NS + 51 + o), f2 = facet(z * 11, wy / 140, NS + 53);
              const h1 = hash(f1.id, 1, NS), h2 = hash(f1.id, 2, NS), h3 = hash(f2.id, 3, NS);
              let nx = (sideL ? 0.9 : -0.9) + (h1 - 0.5) * 0.22 + (vn(z * 9, wy / 900, NS + 57) - 0.5) * 0.5 + (h3 - 0.5) * 0.1, ny = (h2 - 0.6) * 0.15, nz = 0.7;
              const ob = o - (sideL ? CLIFF : CLIFF + 15);
              if (ob >= 1 && ob <= 8) {   // buttress: its front faces us, its river side turns away
                const dd = Hf[k];
                if (dd < 40) nx = (sideL ? 1.2 : -1.2) + (h1 - 0.5) * 0.4;   // only its river edge turns; the rest is of a piece with the wall
              }
              if (ob === 9) { nx = (sideL ? 0 : -0.55) + (h1 - 0.5) * (sideL ? 1.0 : 0.45) + (h3 - 0.5) * 0.15; ny = (h2 - 0.6) * 0.3; nz = 1; }
              const l = Math.hypot(nx, ny, nz);
              lam[k] = Math.max(0, (nx * Lx + ny * Ly + nz * Lz) / l);
              cav[k] = f1.edge < 0.04 ? 1 : f2.edge < 0.05 ? 0.5 : 0;
            }
          }
          if ((j & 31) === 31) await breathe();
        }

        /* cracks through the kings: angular, branching, mostly falling */
        mark('cracks');
        for (const K of kings) {
          const n = 11 + ((rnd() * 5) | 0);
          for (let c = 0; c < n; c++) {
            let tries = 0, x, y, k;
            do { x = 80 + rnd() * 2240; y = 100 + rnd() * 1500; k = idx(x, y); tries++; } while ((k < 0 || oid[k] !== K.id) && tries < 500);
            if (tries >= 500) continue;
            let dx = auxX[k], dy = aux[k];
            const pts = [[dx, dy]];
            let a = Math.PI / 2 + (rnd() - 0.5) * 1.4;
            const len = 80 + rnd() * 380;
            for (let s = 0; s < len;) {
              const st = 8 + rnd() * 18;
              a += (rnd() - 0.5) * 1.1; a = lerp(a, Math.PI / 2, 0.15);
              dx += Math.cos(a) * st; dy += Math.sin(a) * st; s += st;
              pts.push([dx, dy]);
              if (rnd() < 0.08 && pts.length > 2) K.cracks.push({ p: branch(pts[pts.length - 1], a), w: 0.7 });
            }
            K.cracks.push({ p: pts, w: 1 + rnd() * 0.5 });
          }
          K.cracks.push({ p: K.side < 0 ? [[392, 650], [410, 604], [436, 566], [446, 520], [470, 486], [474, 436], [494, 404], [486, 360]] : [[-74, 150], [-52, 190], [-40, 206], [-14, 224], [6, 262], [22, 300], [30, 350], [22, 410], [42, 470], [36, 540]], w: 2 });
          for (const cr of K.cracks) applyPrim(K, { k: 'cap', p: cr.p, r: [2.2 * cr.w, 1.6 * cr.w], b: 7 * cr.w, op: 'cut', on: 0xffff, scaled: true }, -1);
          await breathe();
        }
        function branch(p0, a) {
          const pts = [p0]; let x = p0[0], y = p0[1]; a += (rnd() < 0.5 ? -1 : 1) * (0.6 + rnd() * 0.6);
          const L = 20 + rnd() * 80;
          for (let s = 0; s < L;) { const st = 6 + rnd() * 12; a += (rnd() - 0.5) * 0.9; x += Math.cos(a) * st; y += Math.sin(a) * st; s += st; pts.push([x, y]); }
          return pts;
        }

        /* light on the kings: normals from the relief, cast shadows, crevices */
        mark('light');
        for (let j = 1; j < FH - 1; j++) {
          for (let i = 1; i < FW - 1; i++) {
            const k = j * FW + i, o = oid[k];
            if (!isKing(o)) continue;
            const h = Hf[k];
            const hl = oid[k - 1] === o ? Hf[k - 1] : h, hr = oid[k + 1] === o ? Hf[k + 1] : h;
            const hu = oid[k - FW] === o ? Hf[k - FW] : h, hd = oid[k + FW] === o ? Hf[k + FW] : h;
            const dx = (hr - hl) * 0.5, dy = (hd - hu) * 0.5;
            gx[k] = dx; gy[k] = dy;
            const il = 1 / Math.sqrt(dx * dx + dy * dy + 1);
            lam[k] = Math.max(0, (-dx * Lx - dy * Ly + Lz) * il);
          }
          if ((j & 63) === 63) await breathe();
        }
        {
          const sl = Math.hypot(Lx, Ly), ux = Lx / sl, uy = Ly / sl, rise = Lz / sl;
          for (let j = 0; j < FH; j++) {
            for (let i = 0; i < FW; i++) {
              const k = j * FW + i, o = oid[k];
              if (!isKing(o)) continue;
              const h0 = Hf[k];
              let s = 0;
              for (let t = 1.5; t < 110; t += 1.5) {
                const xi = (i + ux * t) | 0, yj = (j + uy * t) | 0;
                if (xi < 0 || yj < 0 || xi >= FW) break;
                const kk = yj * FW + xi;
                if (oid[kk] !== o) continue;
                const over = Hf[kk] - (h0 + t * rise);
                if (over > 0.4) { s = Math.min(1, s + over / 2.5); if (s >= 1) break; }
              }
              shd[k] = s;
            }
            if ((j & 15) === 15) await breathe();
          }
          const b1 = boxBlur(Hf, 4), b2 = boxBlur(b1, 4);
          for (let k = 0; k < N; k++) if (isKing(oid[k])) cav[k] = clamp((b2[k] - Hf[k]) * 0.2, -1, 1.5);
          // the big planes of light and shade, before the detail
          const ls = boxBlur(lam, 5);
          for (let k = 0; k < N; k++) if (isKing(oid[k])) { const pt = part[k], w = pt >= 1 && pt <= 4 ? 0.15 : pt === 9 ? 0.25 : 0.6; lam[k] = ls[k] * w + lam[k] * (1 - w); }
        }
        await breathe();
        function boxBlur(src, r) {
          const out = new Float32Array(N), mid = new Float32Array(N), inv = 1 / (2 * r + 1);
          for (let j = 0; j < FH; j++) {
            let acc = 0; const row = j * FW;
            for (let i = -r; i <= r; i++) acc += src[row + clamp(i, 0, FW - 1)];
            for (let i = 0; i < FW; i++) { mid[row + i] = acc * inv; acc += src[row + Math.min(FW - 1, i + r + 1)] - src[row + Math.max(0, i - r)]; }
          }
          for (let i = 0; i < FW; i++) {
            let acc = 0;
            for (let j = -r; j <= r; j++) acc += mid[clamp(j, 0, FH - 1) * FW + i];
            for (let j = 0; j < FH; j++) { out[j * FW + i] = acc * inv; acc += mid[Math.min(FH - 1, j + r + 1) * FW + i] - mid[Math.max(0, j - r) * FW + i]; }
          }
          return out;
        }

        /* ------------------------------------------------------- mist: where the paper stays white */
        mark('mist');
        const mist = new Float32Array(N);
        {
          const Q = 4, QW = RW / Q, QH = RH / Q, mq = new Float32Array(QW * QH);
          const banks = [[2390, 70, 0.95, 61], [2250, 52, 0.8, 63], [2090, 40, 0.62, 65], [1930, 30, 0.45, 67]];
          const bankTop = banks.map((b) => { const t = new Float32Array(QW); for (let i = 0; i < QW; i++) t[i] = b[0] + (fbm((i + 0.5) * Q / 210, b[0], NS + b[3], 3) - 0.5) * 110; return t; });
          const riverTop = new Float32Array(QW);
          for (let i = 0; i < QW; i++) { const x = (i + 0.5) * Q; riverTop[i] = 2230 + (vn(x / 260, 3.3, NS + 71) - 0.5) * 150 + (vn(x / 70, 4.1, NS + 72) - 0.5) * 40; }
          for (let j = 0; j < QH; j++) {
            const y = (j + 0.5) * Q;
            for (let i = 0; i < QW; i++) {
              const x = (i + 0.5) * Q;
              let m = 0;
              // the far gorge dissolves into luminous haze
              const dvp = Math.hypot((x - VPX) * 0.9, (y - HY) * 1.5);
              m = Math.exp(-dvp / 230) * 0.98;
              // banks lying in the gorge, lit on top, trailing off below
              const gz = smooth(560, 120, Math.abs(x - VPX - (y - HY) * 0.05));
              if (gz > 0) for (let bi = 0; bi < 4; bi++) {
                const b = banks[bi], top = bankTop[bi][i];
                const d = y - top;
                if (d > -10 && d < b[1] * 4) {
                  const v = smooth(-10, 4, d) * smooth(b[1] * 4, b[1] * 0.5, d) * (0.6 + 0.55 * vn(x / 60, y / 24, NS + b[3] + 1));
                  m = Math.max(m, v * b[2] * gz);
                }
              }
              // the river mist drifting across the feet of the pillars, torn into holes
              {
                const top = riverTop[i];
                const d = y - top;
                if (d > -12 && d < 420) {
                  const hole = smooth(0.36, 0.62, vn(x / 150, y / 50, NS + 73) * 0.7 + vn(x / 40, y / 18, NS + 74) * 0.3);
                  const v = smooth(-12, 10, d) * smooth(420, 90, d) * hole;
                  m = Math.max(m, v * (0.62 + 0.3 * gz));
                }
              }
              // spray thrown up at the feet of the pillars
              for (const sp of [[peds[0].inBase, peds[0].wl, 1.5, -1], [peds[1].inBase, peds[1].wl, 0.7, 1]]) {
                const ux = (x - sp[0]) * -sp[3];   // + towards the river
                const ddx = (ux - 40 * sp[2]) / (190 * sp[2]), ddy = (y - sp[1] + 30) / ((y < sp[1] ? 300 : 70) * sp[2]);
                const rr = ddx * ddx + ddy * ddy;
                if (rr < 5) m = Math.max(m, Math.exp(-rr * 1.3) * (0.45 + 0.7 * fbm(x / 34, y / 60, NS + 69, 4)));
              }
              mq[j * QW + i] = clamp(m, 0, 1);
            }
            if ((j & 63) === 63) await breathe();
          }
          for (let j = 0; j < FH; j++) {
            const fy = clamp((j + 0.5) * F / Q - 0.5, 0, QH - 1.001), j0 = fy | 0, ty = fy - j0;
            for (let i = 0; i < FW; i++) {
              const fx = clamp((i + 0.5) * F / Q - 0.5, 0, QW - 1.001), i0 = fx | 0, tx = fx - i0;
              const a = mq[j0 * QW + i0], b = mq[j0 * QW + i0 + 1], c = mq[(j0 + 1) * QW + i0], d = mq[(j0 + 1) * QW + i0 + 1];
              let m = (a + (b - a) * tx) * (1 - ty) + (c + (d - c) * tx) * ty;
              const k = j * FW + i, o = oid[k];
              if (isCliff(o)) m = Math.max(m, smooth(0.5, 1.0, dep[k]) * 0.72);
              if (isKing(o) || isPed(o)) m *= 0.9;
              mist[k] = m;
            }
          }
        }
        await breathe();

        /* ------------------------------------------------------- pencil tone and hatch direction */
        mark('tone');
        const tone = new Float32Array(N), ang = new Float32Array(N);
        {
          const sgx = boxBlur(gx, 5), sgy = boxBlur(gy, 5);
          for (let j = 0; j < FH; j++) {
            const y = (j + 0.5) * F;
            for (let i = 0; i < FW; i++) {
              const k = j * FW + i, o = oid[k], x = (i + 0.5) * F;
              let t = 0, a = -0.95;
              if (isKing(o)) {
                const lit = lam[k] * (1 - 0.9 * shd[k]);
                const dx = auxX[k], dy = aux[k];
                t = 0.08 + 0.78 * (1 - lit) + clamp(cav[k] * 0.3, -0.1, 0.35);
                t += 0.22 * smooth(-40, -380, dx) - 0.12 * smooth(60, 330, dx) + 0.06 * smooth(1500, 2500, dy);      // the broad turning of the form: sun on the right, shadow round the left
                const g2 = sgx[k] * sgx[k] + sgy[k] * sgy[k];
                const contour = Math.atan2(sgy[k], sgx[k]) + Math.PI / 2;
                a = smooth(0.02, 0.2, g2) > 0.5 ? contour : -0.95;
                if (part[k] === 7) a = -1.48;          // cloak: along the folds
                if (part[k] === 13) t = t * 0.65 + 0.04;   // the plinth face, in the low sun
                if (part[k] === 10) a = -1.57;         // haft
                if (part[k] === 12) a = -1.5;
                if (part[k] === 7 && Math.abs(dx) < 215 && dy > 1150) t += 0.4;
              } else if (isPed(o)) {
                const pd = o === PEDL ? peds[0] : peds[1];
                const yv = y - pOff(pd, k);
                t = 0.12 + 0.74 * (1 - lam[k]) + cav[k] * 0.25 + smooth(pd.plinth + 200, pd.wl, y) * 0.16 + stainAt(pd, x, yv) * 0.5;
                if (yv > pd.plinth && yv < pd.plinth + 70 * pd.sc) t += 0.3 * smooth(pd.plinth + 70 * pd.sc, pd.plinth, yv);   // under the plinth
                a = yv < pd.plinth ? (aux[k] < pd.cw ? Math.atan(pd.slope) * -pd.side : 0.03) : -1.38 + (vn(x / 60, y / 200, NS + 83) - 0.5) * 0.5;
              } else if (isCliff(o)) {
                t = 0.14 + 0.66 * (1 - lam[k]) + cav[k] * 0.15;
                t *= (1 - dep[k] * 0.6);
                a = -1.54 + (vn(x / 40, y / 300, NS + 85) - 0.5) * 0.25;
              } else if (o === SKY) {
                t = 0; a = -0.6;
              }
              t *= (1 - mist[k] * 0.95);
              tone[k] = clamp(t, 0, 1); ang[k] = a;
            }
            if ((j & 63) === 63) await breathe();
          }
        }

        /* ------------------------------------------------------- watercolour: pigment concentrations */
        mark('wash');
        const Cn = []; for (let p = 0; p < 7; p++) Cn.push(new Float32Array(N));
        const lift = new Float32Array(N), dry = new Float32Array(N);
        const add = (k, p, v) => { Cn[p][k] += v; };
        for (let j = 0; j < FH; j++) {
          const y = (j + 0.5) * F;
          for (let i = 0; i < FW; i++) {
            const k = j * FW + i, o = oid[k], x = (i + 0.5) * F;
            if (o === WATER) continue;
            const glow = Math.exp(-(((x - GX) / 700) ** 2 + ((y - GY) / 620) ** 2));
            const mott = vn(x / 130, y / 130, NS + 91) * 0.6 + vn(x / 47, y / 47, NS + 92) * 0.4;
            if (o === SKY) {
              const top = smooth(1900, 0, y);
              const opening = Math.exp(-(((x - GX) / 520) ** 2 + ((y - 1500) / 900) ** 2));
              add(k, PAY, (0.04 + 0.26 * top * top) * (0.93 + 0.14 * mott) * (1 - 0.6 * opening));
              add(k, ULT, (0.03 + 0.09 * top) * (1 - glow) * (1 - 0.5 * opening));
              add(k, OCH, 0.05 + 0.32 * glow + 0.1 * opening);
              add(k, ROS, 0.07 * glow + 0.06 * top * (1 - top) + 0.04 * opening);
              // clouds: wet shapes with hard, darker dried rims, lit from below
              const cf = vn(x / 720, y / 250, NS + 93) * 0.6 + vn(x / 260, y / 110, NS + 94) * 0.28 + vn(x / 80, y / 40, NS + 95) * 0.12 + 0.14 * top - 0.22 * glow - 0.3 * opening;
              const hard = vn(x / 420, y / 300, NS + 96) > 0.56;
              if (cf > 0.5) {
                const e = hard ? Math.exp(-(cf - 0.56) / 0.018) : 0, w = hard ? smooth(0.56, 0.566, cf) : smooth(0.5, 0.68, cf);
                add(k, PAY, w * (0.07 + 0.09 * e + 0.14 * top) * (1 - 0.5 * opening));
                add(k, ULT, w * (0.03 + 0.05 * e));
                add(k, SEP, w * 0.04 * top);
                add(k, ROS, w * 0.04 * (1 - top));
              }
              if (cf > 0.46 && cf < 0.58) add(k, ROS, 0.04 * smooth(0.46, 0.53, cf) * smooth(0.6, 0.53, cf) * (1 - top * 0.5));
              const ra = Math.atan2(y - GY, x - GX), rd = Math.hypot(x - GX, y - GY);
              const ray = vn(ra * 11, 0.5, NS + 97) * 0.7 + vn(ra * 31, 0.5, NS + 98) * 0.3;
              if (ra < -0.4 && ra > -2.7) lift[k] = Math.max(lift[k], smooth(0.58, 0.72, ray) * 0.6 * smooth(2300, 500, rd) * smooth(100, 500, rd));
            } else if (isCliff(o)) {
              const dd = dep[k], near = 1 - smooth(0.22, 1, dd);
              const sideL = o < CLIFF + 15, lit = lam[k];
              add(k, PAY, (0.06 + 0.22 * near) * (0.92 + 0.16 * mott));
              add(k, ULT, 0.05 + 0.1 * near + (sideL ? 0 : 0.08));
              add(k, GRN, 0.05 * near);
              add(k, SEP, 0.06 * near);
              add(k, OCH, 0.07 + 0.2 * glow + (sideL ? 0.14 * near * lit : 0));
              add(k, ROS, 0.03 * glow + (sideL ? 0.05 * lit * near : 0));
              const sh = (1 - lit) + (vn(x / 40, y / 90, NS + 99) - 0.5) * 0.3;
              if (sh > 0.5) { const w = smooth(0.5, 0.515, sh), e = Math.exp(-(sh - 0.5) / 0.04); add(k, PAY, w * (0.08 + 0.06 * e) * (0.3 + near)); add(k, ULT, w * 0.07); }
              if (sh > 0.78) { const w = smooth(0.78, 0.79, sh); add(k, SEP, w * 0.12 * near); }
              dry[k] = 0.25 * near * smooth(0.62, 0.7, vn(x / 14, y / 110, NS + 113));
            } else if (isPed(o)) {
              const pd = o === PEDL ? peds[0] : peds[1];
              const low = smooth(pd.plinth + 120, pd.wl, y), yv = y - pOff(pd, k);
              const lit = lam[k];
              add(k, GRN, 0.07 + 0.04 * mott);
              add(k, PAY, 0.12 + 0.18 * low);
              add(k, SEP, 0.08 + 0.22 * low);
              add(k, OCH, 0.13 * (1 - low) + 0.03);
              add(k, SIE, 0.03);
              const sh = 1 - lit;
              if (sh > 0.5) { const w = smooth(0.5, 0.515, sh), e = Math.exp(-(sh - 0.5) / 0.04); add(k, ULT, w * (0.17 + 0.08 * e)); add(k, SEP, w * (0.07 + 0.06 * e)); add(k, PAY, w * 0.06); }
              if (sh > 0.76) { const w = smooth(0.76, 0.775, sh); add(k, SEP, w * 0.2); add(k, PAY, w * 0.12); }
              // the wet, dark foot of the rock, with a line of foam where the river breaks on it
              const wet = smooth(pd.wl - 70 * pd.sc, pd.wl - 8, y);
              if (wet > 0) { add(k, SEP, 0.22 * wet); add(k, PAY, 0.16 * wet); add(k, GRN, 0.06 * wet); }
              if (y > pd.wl - 10 - vn(x / 9, 1, NS + 119) * 10) lift[k] = Math.max(lift[k], 0.75);
              const stn = stainAt(pd, x, yv);
              if (stn > 0) { add(k, SEP, stn * 0.5); add(k, GRN, stn * 0.25); add(k, PAY, stn * 0.2); }
              if (yv > pd.plinth && yv < pd.plinth + 60 * pd.sc) { const u = smooth(pd.plinth + 60 * pd.sc, pd.plinth + 3, yv); add(k, SEP, 0.22 * u); add(k, ULT, 0.14 * u); }
              if (Math.abs(aux[k] - pd.cw) < 5 && pd.side < 0) lift[k] = Math.max(lift[k], 0.35);   // the lit arris
              if (lit > 0.72) { add(k, OCH, 0.12); add(k, ROS, 0.04); }
              dry[k] = (lit > 0.6 ? 0.35 : 0) * smooth(0.64, 0.72, vn(x / 15, y / 120, NS + 111));
            } else if (isKing(o)) {
              const lit = lam[k] * (1 - 0.9 * shd[k]);
              const dyk = aux[k], dxk = auxX[k];
              add(k, GRN, 0.06 + 0.05 * mott);
              add(k, PAY, 0.07 + 0.08 * smooth(700, 1660, dyk));
              add(k, OCH, 0.13 + 0.05 * mott);
              add(k, SIE, 0.03);
              const sh = 1 - lit + 0.22 * smooth(-40, -380, dxk) - 0.14 * smooth(60, 330, dxk) + (vn(x / 60, y / 60, NS + 103) - 0.5) * 0.06;
              if (sh > 0.5) { const w = smooth(0.5, 0.512, sh), e = Math.exp(-(sh - 0.5) / 0.035); add(k, ULT, w * (0.2 + 0.1 * e)); add(k, SEP, w * (0.1 + 0.06 * e)); add(k, PAY, w * 0.1); }
              if (sh > 0.76) { const w = smooth(0.76, 0.772, sh); add(k, SEP, w * 0.2); add(k, PAY, w * 0.12); add(k, ULT, w * 0.06); }
              if (lit > 0.58) { const w = smooth(0.58, 0.62, lit); add(k, OCH, w * 0.14); add(k, ROS, w * 0.07); add(k, SIE, w * 0.03); }
              // rain has run down the troughs of the folds, and moss has taken the upturned palm
              if (part[k] === 5 && dyk > 1300 && cav[k] > 0.25) { const s2 = vn(x / 4, y / 200, NS + 118); if (s2 > 0.45) { add(k, SEP, (s2 - 0.45) * 0.5 * Math.min(1, cav[k])); add(k, GRN, 0.04); } }
              if (part[k] === 9 && dyk < 90) { const ms = vn(x / 7, y / 7, NS + 119) * 0.6 + vn(x / 2.5, y / 2.5, NS + 120) * 0.4; if (ms > 0.52) { add(k, GRN, (ms - 0.52) * 1.2); add(k, OCH, (ms - 0.52) * 0.5); } }
              // stains: rain runnels, orange lichen, moss on what faces the sky
              const run = vn(x / 7, y / 150, NS + 105 + o);
              if (run > 0.8) add(k, SEP, (run - 0.8) * 0.5);
              const li = vn(x / 14, y / 14, NS + 107 + o) * 0.6 + vn(x / 5, y / 5, NS + 108) * 0.4;
              if (li > 0.76 && lam[k] > 0.4) { add(k, SIE, (li - 0.7) * 1.0); add(k, OCH, (li - 0.7) * 1.2); }
              const moss = vn(x / 22, y / 22, NS + 109 + o);
              if (moss > 0.7 && -gy[k] > 0.12) add(k, GRN, (moss - 0.7) * 1.2);
              dry[k] = 0.55 * smooth(0.6, 0.7, vn(x / 12, y / 70, NS + 112));
            }
            const m = mist[k], keep = 1 - m;
            for (let p = 0; p < 7; p++) Cn[p][k] *= keep;
            Cn[OCH][k] += 0.04 * m * glow;
          }
          if ((j & 31) === 31) await breathe();
        }

        /* ------------------------------------------------------- the water */
        mark('water');
        const baseRow = new Int32Array(FW);
        for (let i = 0; i < FW; i++) { let j = FH - 1; while (j > 0 && oid[j * FW + i] === WATER) j--; baseRow[i] = j; }
        const wlum = new Float32Array(N);   // how dark the water reads, for the pencil
        for (let j = Math.floor(HY / F); j < FH; j++) {
          const y = (j + 0.5) * F, dyw = y - HY + 4;
          const Z = 70 / dyw, LZ = Math.log(dyw);
          for (let i = 0; i < FW; i++) {
            const k = j * FW + i;
            if (oid[k] !== WATER) continue;
            const x = (i + 0.5) * F, X = (x - VPX) * Z;
            const deep = smooth(HY, RH, y);
            const wv = vn(X / 30, LZ * 40, NS + 121) * 0.62 + vn(X / 9, LZ * 95, NS + 124) * 0.38;   // long ripples
            const chop = vn(X / 3, LZ * 130, NS + 122);
            add(k, GRN, 0.08 + 0.2 * deep);
            add(k, PAY, 0.05 + 0.36 * deep * deep);
            add(k, ULT, 0.04 + 0.1 * deep);
            add(k, SEP, 0.1 * deep * deep);
            add(k, OCH, 0.07 * (1 - deep));
            const by = (baseRow[i] + 0.5) * F;
            if (y > by) {
              const ys = 2 * by - y - (wv - 0.5) * (12 + deep * 80) - chop * 10 * deep;
              const xs = x + (chop - 0.5) * (4 + deep * 16);
              const ks = idx(xs, ys);
              if (ks >= 0 && oid[ks] !== WATER) {
                const os = oid[ks];
                const brk = smooth(0.28, 0.5, wv) * (0.75 + 0.25 * chop);
                const f = (isPed(os) || isKing(os) ? 0.85 : isCliff(os) ? 0.7 : 0.45) * brk * (1 - smooth(by, by + 900, y) * 0.35);
                for (let p = 0; p < 7; p++) Cn[p][k] += Cn[p][ks] * f;
                if (isPed(os)) { add(k, SEP, 0.12 * brk); add(k, GRN, 0.06 * brk); }
              }
            }
            if (wv > 0.62) { const w = smooth(0.62, 0.626, wv); add(k, PAY, w * (0.05 + 0.16 * deep)); add(k, GRN, w * (0.03 + 0.08 * deep)); add(k, SEP, w * 0.06 * deep); }
            if (wv < 0.33 && chop > 0.55) lift[k] = Math.max(lift[k], 0.5 * (1 - deep * 0.2));
            // swell in the foreground: long lit crests over dark troughs
            if (deep > 0.45) {
              const sw = vn(X / 60, LZ * 16, NS + 129) * 0.7 + vn(X / 18, LZ * 40, NS + 130) * 0.3;
              const fw = smooth(0.45, 0.8, deep);
              if (sw > 0.64) lift[k] = Math.max(lift[k], smooth(0.64, 0.65, sw) * 0.62 * fw);
              else if (sw < 0.4) { const w = smooth(0.4, 0.39, sw) * fw; add(k, PAY, w * 0.16); add(k, SEP, w * 0.06); add(k, ULT, w * 0.05); }
            }
            // the path of light from the far end, broken into dashes
            const pw = 16 + (y - HY) * 0.36, px = VPX + 10 + (vn(LZ * 3, 1.3, NS + 125) - 0.5) * 40 * (1 - deep) + (y - HY) * 0.04;
            const inP = smooth(pw, pw * 0.15, Math.abs(x - px));
            const glit = vn(X / 3, LZ * 60, NS + 127) * 0.65 + vn(X / 1.2, LZ * 140, NS + 128) * 0.35;
            const pl = inP * (0.2 + 0.9 * smooth(0.45, 0.58, glit));
            lift[k] = Math.max(lift[k], clamp(pl, 0, 1) * (1 - deep * 0.4));
            const m = mist[k];
            for (let p = 0; p < 7; p++) Cn[p][k] *= (1 - m);
            let sum = 0; for (let p = 0; p < 7; p++) sum += Cn[p][k];
            wlum[k] = clamp(sum * (1 - lift[k]) * 1.25, 0, 1);
          }
          if ((j & 31) === 31) await breathe();
        }

        /* ------------------------------------------------------- the boats, their figures and reflections */
        mark('boats');
        const boats = [
          { x: 1300, y: 2500, L: 250, a: -0.1, crew: ['aragorn', 'frodo', 'sam'] },
          { x: 1180, y: 2610, L: 310, a: -0.08, crew: ['boromir', 'merry', 'pippin'] },
          { x: 1430, y: 2770, L: 380, a: -0.07, crew: ['gimli', 'legolas'] },
        ];
        for (const b of boats) { b.x += (rnd() - 0.5) * 10; b.y += (rnd() - 0.5) * 5; b.a += (rnd() - 0.5) * 0.03; }
        const stampPoly = (pts, fn) => fillPoly(pts, (j, i0, i1) => { for (let i = i0; i <= i1; i++) fn(j * FW + i, (i + 0.5) * F, (j + 0.5) * F); });
        function hullPts(b, reflect) {
          const ux = Math.cos(b.a), uy = Math.sin(b.a), L = b.L, top = [], bot = [];
          for (let q = 0; q <= 16; q++) {
            const t = q / 16, x = b.x + ux * L * t, y = b.y + uy * L * t;
            const sheer = L * (0.055 + 0.07 * Math.pow(Math.abs(2 * t - 1), 3) + (t > 0.5 ? 0.02 * Math.pow(2 * t - 1, 6) : 0));
            const keel = L * 0.018 * Math.sin(Math.PI * t);
            top.push([x, y - (reflect ? -sheer * 0.8 : sheer)]);
            bot.push([x, y + (reflect ? -keel : keel)]);
          }
          return [top, bot];
        }
        for (const b of boats) {
          const [top, bot] = hullPts(b, false);
          stampPoly([...top, ...bot.slice().reverse()], (k) => { Cn[PAY][k] = 0.42; Cn[ULT][k] = 0.1; Cn[GRN][k] = 0.1; Cn[OCH][k] = 0.03; Cn[SEP][k] = 0.08; lift[k] = 0; });
          const [rt, rb] = hullPts(b, true);
          stampPoly([...rt, ...rb.slice().reverse()], (k, x, y) => { if (vn(x / 30, y / 2.4, NS + 141) > 0.34) { Cn[PAY][k] += 0.3; Cn[SEP][k] += 0.1; lift[k] *= 0.2; } });
        }

        // foam at the bows and where the paddles bite
        for (const b of boats) {
          const ux = Math.cos(b.a), uy = Math.sin(b.a);
          const bx = b.x + ux * b.L, byy = b.y + uy * b.L;
          for (let q = 0; q < 26; q++) {
            const t = rnd(), x = bx - ux * t * b.L * 0.5 + (rnd() - 0.5) * 6, y = byy - uy * t * b.L * 0.5 + 2 + rnd() * 5;
            const k = idx(x, y); if (k >= 0) lift[k] = Math.max(lift[k], 0.7 * (1 - t));
          }
        }

        /* nests on the kings, and what the birds leave below them */
        const nests = [];
        const nestAt = [
          [[2, -70, 100, 1], [2, 48, 0, 0.75], [6, 238, 380, 1.3], [11, -470, 190, 0.9], [6, -236, 380, 1]],
          [[2, 26, 100, 1.1], [6, -236, 380, 1.1], [6, 236, 380, 0.9]],
        ];
        kings.forEach((K, q) => {
          const tn = KT[q].turn, sn = Math.sin(tn), cf = Math.cos(tn * 1.6);
          for (const n of nestAt[q]) {
            const dxt = (n[1] * Math.sign(tn) > 0 ? n[1] * cf : n[1] * 1.04) + 130 * sn;
            const p0 = K.T.fx(dxt, n[2]);
            let x = p0[0], y = -1;
            for (let yy = p0[1] - 80; yy < p0[1] + 160; yy += 2) { const k = idx(x, yy); if (k >= 0 && oid[k] === K.id && part[k] === n[0]) { y = yy + 3; break; } }
            if (y < 0) continue;
            const s = n[3] * K.T.sc;
            nests.push({ K, x, y, s });
            for (let st = 0; st < 5 + ((rnd() * 4) | 0); st++) {
              let sx = x + (rnd() - 0.5) * 34 * s, sy = y + 4;
              const L = (50 + rnd() * 200) * s, w = 0.6 + rnd() * 0.8;
              for (let t = 0; t < L; t += 3) {
                sx += (rnd() - 0.5) * 2; sy += 3;
                const k = idx(sx, sy);
                if (k < 0 || oid[k] !== K.id) break;
                const fall = 1 - t / L;
                lift[k] = Math.max(lift[k], (0.55 + 0.3 * fall) * w);
              }
            }
          }
        });

        /* a thread of falling water down the far cliff, lost in the mist below */
        const fall = [];
        {
          let x = 2160 + (rnd() - 0.5) * 60, y = 0;
          for (let yy = 40; yy < 1200; yy += 4) { const k = idx(x, yy); if (k >= 0 && isCliff(oid[k])) { y = yy + 6; break; } }
          if (y > 0) {
            for (; y < 2300; y += 1) {
              x += ((vn(y / 90, 3, NS + 161) - 0.5) * 1.6 + (y > 1500 ? 0.15 : 0)) / 3;
              const k = idx(x, y); if (k < 0) break;
              if (isKing(oid[k]) || isPed(oid[k])) break;
              const w = 1.2 + (y - 300) / 800, flick = 0.75 + 0.25 * vn(y / 7, 1, NS + 162);
              for (let o = -w - 1; o <= w + 1; o += 0.5) { const k2 = idx(x + o * F, y); if (k2 >= 0) lift[k2] = Math.max(lift[k2], 0.9 * flick * clamp(1 - Math.abs(o) / (w + 1), 0, 1)); }
              if ((y & 3) === 0) fall.push([x, y]);
            }
          }
        }

        /* standing waves where the river is squeezed between the pinnacles, and the currents drawn into the gorge */
        const waves = [];
        for (let q = 0; q < 26; q++) {
          const t = rnd(), y = lerp(2470, 3050, t * t), dyw = y - HY;
          const cx = VPX + (y - HY) * 0.05 + (rnd() - 0.5) * dyw * 0.9;
          const w = dyw * (0.12 + rnd() * 0.16), hgt = dyw * 0.03;
          waves.push({ cx, y, w, hgt });
          for (let s2 = -1; s2 <= 1; s2 += 2) for (let u = 0; u < 1; u += 0.02) {
            const x = cx + s2 * u * w, yy = y + u * hgt * 2 - Math.sin(u * Math.PI) * hgt * 0.4;
            const k = idx(x, yy); if (k >= 0 && oid[k] === WATER) lift[k] = Math.max(lift[k], 0.55 * (1 - u));
          }
        }

        /* trees clinging to the crests and ledges of the gorge */
        const trees = [];
        for (const W of walls) {
          const zOf = (x) => { const dv = W.side < 0 ? Math.min(x - VPX, -0.5) : Math.max(x - VPX, 0.5); return Math.max(1, (W.xne - VPX) / dv); };
          const walk = (line, zf, dense) => {
            let acc = 0;
            for (let q = 0; q + 1 < line.length; q++) {
              const a = line[q], b = line[q + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
              acc += L;
              const z = zf(a[0]);
              if (z > 3.4) continue;
              const step = (10 + rnd() * 26) / z / dense;
              while (acc > step) {
                acc -= step;
                const t = rnd(), x = lerp(a[0], b[0], t), y = lerp(a[1], b[1], t);
                if (rnd() < 0.45) continue;
                const h = (18 + rnd() * 40) / z;
                if (h < 4) continue;
                trees.push({ x, y: y + 2, h, kind: rnd() < 0.7 ? 0 : 1, z });
              }
            }
          };
          walk(W.crest, zOf, 1);
          walk(W.hill, () => 1, 0.8);
          for (const B of W.butt) walk(B.crest, () => B.z, 1);
          // a few on ledges of the near faces
          for (let q = 0; q < 26; q++) {
            const z = 1 + rnd() * 2.5, x = W.zx(z) - W.side * (rnd() * 30) / z;
            const y = lerp(W.topAt(z), HY, 0.1 + rnd() * 0.6);
            const k = idx(x, y);
            if (k >= 0 && isCliff(oid[k]) && mist[k] < 0.5) trees.push({ x, y, h: (10 + rnd() * 18) / z, kind: 1, z, ledge: true });
          }
        }
        // ferns, tufts and small birches rooted in the ledges and joints of the pinnacles
        for (const pd of peds) for (const L of pd.ledges) {
          for (let q = 0; q < 9; q++) {
            const x = rnd() * RW, y = L.y + L.tilt * (x - pd.inTop) - 2;
            const k = idx(x, y);
            if (k < 0 || oid[k] !== pd.id || mist[k] > 0.55) continue;
            const r = rnd();
            trees.push({ x, y, h: (r < 0.2 ? 60 + rnd() * 70 : 12 + rnd() * 22) * pd.sc, kind: r < 0.2 ? 3 : r < 0.6 ? 2 : 1, z: 1, lean: pd.side < 0 ? 0.35 : -0.35 });
          }
        }
        for (const t of trees) {
          if (t.kind >= 2) {
            // ferns and birch crowns: a few small soft dabs rather than a shape
            const cx = t.x + (t.kind === 3 ? (t.lean || 0) * t.h : 0), cy = t.y - (t.kind === 3 ? t.h : t.h * 0.4);
            for (let q = 0; q < 6; q++) {
              const dx = (rnd() - 0.5) * t.h * 0.5, dy = (rnd() - 0.5) * t.h * 0.3, r = t.h * (0.08 + rnd() * 0.08);
              const pts = []; for (let a = 0; a < 7; a++) { const ang = a / 7 * TAU; pts.push([cx + dx + Math.cos(ang) * r * (0.7 + rnd() * 0.6), cy + dy + Math.sin(ang) * r * 0.7]); }
              stampPoly(pts, (k) => { const f = 1 - mist[k] * 0.9; Cn[GRN][k] += 0.16 * f; Cn[OCH][k] += (t.kind === 3 ? 0.08 : 0.03) * f; Cn[SEP][k] += 0.04 * f; });
            }
            continue;
          }
          const w = t.h * (t.kind === 0 ? 0.42 : 0.9);
          stampPoly([[t.x - w / 2, t.y], [t.x + w / 2, t.y], [t.x + w * 0.1, t.y - t.h], [t.x - w * 0.1, t.y - t.h]], (k) => {
            const f = 1 - mist[k] * 0.9;
            Cn[GRN][k] += 0.22 * f; Cn[SEP][k] += 0.1 * f; Cn[PAY][k] += 0.08 * f; Cn[OCH][k] += 0.03;
          });
        }

        /* vignette: the washes stop short of the paper's edge, raggedly */
        for (let j = 0; j < FH; j++) {
          const y = (j + 0.5) * F;
          for (let i = 0; i < FW; i++) {
            const k = j * FW + i, x = (i + 0.5) * F;
            const e = Math.min(x * 1.2, (RW - x) * 1.2, y * 1.8, (RH - y) * 1.1) + (vn(x / 90, y / 50, NS + 131) * 0.55 + vn(x / 23, y / 13, NS + 132) * 0.3 + vn(x / 6, y / 5, NS + 133) * 0.15 - 0.5) * 110;
            const v = smooth(16, 80, e);
            if (v < 1) for (let p = 0; p < 7; p++) Cn[p][k] *= v;
          }
        }
        await breathe();

        /* the washes alone, shown while the pencil is worked over them */
        const cA = document.createElement('canvas'); cA.width = FW; cA.height = FH;
        let WA, WB, WC;
        {
          const ia = cA.getContext('2d').createImageData(FW, FH), ib = new ImageData(FW, FH), ic = new ImageData(FW, FH);
          const da = ia.data, db = ib.data, dc = ic.data;
          for (let k = 0; k < N; k++) {
            const lf = 1 - lift[k];
            let n0 = 0, n1 = 0, n2 = 0, g0 = 0, g1 = 0, g2 = 0;
            for (let p = 0; p < 7; p++) {
              const c = Cn[p][k] * lf; if (c === 0) continue;
              const pg = PIG[p], gr = pg[3];
              n0 += c * pg[0] * (1 - gr); n1 += c * pg[1] * (1 - gr); n2 += c * pg[2] * (1 - gr);
              g0 += c * pg[0] * gr; g1 += c * pg[1] * gr; g2 += c * pg[2] * gr;
            }
            const q = k * 4;
            da[q] = 255 * Math.exp(-n0); da[q + 1] = 255 * Math.exp(-n1); da[q + 2] = 255 * Math.exp(-n2); da[q + 3] = 255;
            db[q] = Math.min(255, g0 * 120); db[q + 1] = Math.min(255, g1 * 120); db[q + 2] = Math.min(255, g2 * 120); db[q + 3] = 255;
            dc[q] = dry[k] * 255; dc[q + 3] = 255;
          }
          cA.getContext('2d').putImageData(ia, 0, 0);
          WA = da; WB = db; WC = dc;
          const pv = document.createElement('canvas'); pv.width = FW; pv.height = FH;
          const pg = pv.getContext('2d'); pg.fillStyle = 'rgb(247,241,227)'; pg.fillRect(0, 0, FW, FH);
          pg.globalCompositeOperation = 'multiply'; pg.drawImage(cA, 0, 0);
          preview = pv; present();
        }
        await breathe();

        mark('pencil');
        /* ------------------------------------------------------- pencil */
        const gcan = document.createElement('canvas'); gcan.width = RW; gcan.height = RH;
        const gctx = gcan.getContext('2d', { willReadFrequently: true });
        gctx.lineCap = 'round'; gctx.lineJoin = 'round'; gctx.strokeStyle = '#000'; gctx.fillStyle = '#000';
        const pen = makePen();
        const fade = (k) => 1 - mist[k] * 0.85;
        const ln = (pts, a, w) => pen.add(pts, a, w);

        /* underdrawing: the construction the artist left in */
        for (let x = 30; x < RW - 30;) { const L = 80 + rnd() * 260; ln([x, HY + (rnd() - 0.5) * 2, x + L, HY + (rnd() - 0.5) * 2], 0.12, 1); x += L + 10 + rnd() * 50; }
        for (const tgt of [[0, 3200], [380, 3200], [800, 3200], [1650, 3200], [2100, 3200], [2400, 3050], [0, 2900], [0, 1700], [2400, 1800], [700, 0], [1800, 0], [0, 900], [2400, 1100]]) {
          const L = 0.25 + rnd() * 0.5, s0 = 0.04 + rnd() * 0.1;
          ln([lerp(VPX, tgt[0], s0), lerp(HY, tgt[1], s0), lerp(VPX, tgt[0], L), lerp(HY, tgt[1], L)], 0.08, 0.9);
        }
        for (const K of kings) {
          const a = K.T.fx(0, -50), b = K.T.fx(0, 1500);
          ln([a[0], a[1], b[0], b[1]], 0.09, 0.9);
          for (const yy of [0, 300, 600, 950, 1300]) { const p = K.T.fx(-70, yy), q = K.T.fx(70, yy); ln([p[0], p[1], q[0], q[1]], 0.09, 0.9); }
          const sh = [K.T.fx(-360, 440), K.T.fx(360, 440)]; ln([sh[0][0], sh[0][1], sh[1][0], sh[1][1]], 0.08, 0.9);
          // a first, looser try at the head and the raised hand, left in
          const c = K.T.fx(6, 210), r = 130 * K.T.sc, pts = [];
          for (let q = 0; q <= 40; q++) { const t = q / 40 * TAU * 1.05; pts.push(c[0] + Math.cos(t) * r * 0.86, c[1] + Math.sin(t) * r * 1.12); }
          ln(pts, 0.07, 0.9);
          const h0 = K.T.fx(458, 360), h1 = K.T.fx(470, 70); ln([h0[0] + 8, h0[1], h1[0] + 6, h1[1]], 0.08, 0.9);
        }
        await pen.flush(gctx);

        /* hatching: patches of parallel strokes that follow the planes of the stone */
        async function hatch(o) {
          const S = o.S, thr = o.thr;
          for (let gy = -S; gy < RH; gy += S) {
            for (let gx = -S; gx < RW; gx += S) {
              const cx = gx + rnd() * S, cy = gy + rnd() * S;
              const k = idx(cx, cy); if (k < 0) continue;
              const t = tone[k]; if (t < thr) continue;
              const ob = oid[k]; if (ob === SKY || ob === WATER) continue;
              const pt = part[k];
              const st = clamp((t - thr) / (1 - thr), 0, 1);
              const th = (o.fixed !== undefined && (isKing(ob) || isPed(ob)) ? o.fixed : ang[k] + o.off) + (rnd() - 0.5) * 0.22;
              const ux = Math.cos(th), uy = Math.sin(th), nx = -uy, ny = ux;
              const sc = isKing(ob) ? (ob === KINGL ? 1 : 0.8) : isCliff(ob) ? 0.5 + 0.5 * (1 - dep[k]) : 1;
              const sp = lerp(o.sp0, o.sp1, st) * sc;
              const len = S * (1.15 + rnd() * 0.7) * (isCliff(ob) ? 1.4 * sc : sc);
              const wid = S * (0.95 + rnd() * 0.5) * sc;
              const n = Math.max(1, Math.round(wid / sp));
              const bow = (rnd() - 0.5) * 0.12 * len;
              const a = (o.a0 + o.a1 * st) * fade(k) * (isCliff(ob) ? 1 - dep[k] * 0.55 : 1);
              const w = (o.w0 + o.w1 * st) * (0.65 + 0.35 * sc);
              const slip = (rnd() - 0.5) * 0.5;
              for (let q = 0; q < n; q++) {
                const off = (q - (n - 1) / 2) * sp + (rnd() - 0.5) * sp * 0.35;
                const L = len * (0.68 + rnd() * 0.45);
                const sx = cx + nx * off - ux * L * (0.5 + slip * q / n), sy = cy + ny * off - uy * L * (0.5 + slip * q / n);
                const pts = [];
                for (let m = 0; m <= 5; m++) {
                  const u = m / 5, b = bow * 4 * u * (1 - u);
                  const px = sx + ux * L * u + nx * b, py = sy + uy * L * u + ny * b;
                  const kk = idx(px, py);
                  if (kk < 0 || oid[kk] !== ob || (isKing(ob) && part[kk] !== pt) || tone[kk] < thr * 0.8) { if (pts.length >= 4) break; pts.length = 0; continue; }
                  pts.push(px, py);
                }
                if (pts.length >= 4) pen.add(pts, a * (0.7 + rnd() * 0.55), w);
              }
            }
            if ((gy & 127) < S) await breathe();
          }
        }
        await hatch({ S: 26, thr: 0.2, off: 0, fixed: -0.98, sp0: 6.0, sp1: 2.8, a0: 0.18, a1: 0.42, w0: 1.0, w1: 0.9 });
        await pen.flush(gctx);
        await hatch({ S: 24, thr: 0.34, off: 0.95, sp0: 5.2, sp1: 2.6, a0: 0.18, a1: 0.42, w0: 1.0, w1: 0.8 });
        await pen.flush(gctx);
        await hatch({ S: 22, thr: 0.54, off: -0.6, fixed: -0.3, sp0: 4.6, sp1: 2.4, a0: 0.2, a1: 0.44, w0: 1.0, w1: 0.8 });
        await pen.flush(gctx);
        await hatch({ S: 20, thr: 0.72, off: 1.57, sp0: 4.0, sp1: 2.2, a0: 0.22, a1: 0.46, w0: 1.0, w1: 0.8 });
        await pen.flush(gctx);
        mark('hatch');

        /* contour lines of the carving, traced from the parts themselves */
        function outlineOf(pr) {
          const loops = [];
          if (pr.k === 'ell') {
            const n = Math.max(24, Math.round(TAU * Math.max(pr.rx, pr.ry) / 3)), L = [];
            for (let q = 0; q < n; q++) { const a = q / n * TAU; L.push([pr.c[0] + Math.cos(a) * pr.rx, pr.c[1] + Math.sin(a) * pr.ry]); }
            loops.push(L);
          } else if (pr.k === 'poly') {
            const L = [];
            for (let q = 0; q < pr.p.length; q++) {
              const a = pr.p[q], b = pr.p[(q + 1) % pr.p.length], n = Math.max(1, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / 3));
              for (let m = 0; m < n; m++) L.push([lerp(a[0], b[0], m / n), lerp(a[1], b[1], m / n)]);
            }
            loops.push(L);
          } else {
            const p = pr.p, sm = [];
            for (let q = 0; q + 1 < p.length; q++) {
              const a = p[q], b = p[q + 1], n = Math.max(1, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / 3));
              for (let m = 0; m < n; m++) sm.push([lerp(a[0], b[0], m / n), lerp(a[1], b[1], m / n)]);
            }
            sm.push(p[p.length - 1]);
            const tot = sm.length - 1, left = [], right = [];
            for (let q = 0; q <= tot; q++) {
              const a = sm[Math.max(0, q - 1)], b = sm[Math.min(tot, q + 1)];
              const tx = b[0] - a[0], ty = b[1] - a[1], tl = Math.hypot(tx, ty) || 1;
              const r = lerp(pr.r[0], pr.r[1], q / tot) * 0.985;
              left.push([sm[q][0] - ty / tl * r, sm[q][1] + tx / tl * r]);
              right.push([sm[q][0] + ty / tl * r, sm[q][1] - tx / tl * r]);
            }
            const cap = (c, r, a0) => { const o = []; for (let q = 1; q < 12; q++) { const a = a0 + Math.PI * q / 12; o.push([c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r]); } return o; };
            const e0 = sm[0], e1 = sm[tot];
            const t0 = Math.atan2(sm[Math.min(1, tot)][1] - e0[1], sm[Math.min(1, tot)][0] - e0[0]);
            const t1 = Math.atan2(e1[1] - sm[Math.max(0, tot - 1)][1], e1[0] - sm[Math.max(0, tot - 1)][0]);
            loops.push([...left, ...cap(e1, pr.r[1] * 0.985, t1 - Math.PI / 2), ...right.reverse(), ...cap(e0, pr.r[0] * 0.985, t0 + Math.PI / 2)]);
          }
          return loops;
        }
        function drawRun(run, sc) {
          if (run.length < 3) return;
          let q = 0;
          while (q < run.length - 1) {
            const L = 5 + ((rnd() * 14) | 0), e = Math.min(run.length - 1, q + L);
            const pts = []; let wsum = 0;
            const jx = (rnd() - 0.5) * 1.2, jy = (rnd() - 0.5) * 1.2;
            for (let m = q; m <= e; m++) { pts.push(run[m][0] + jx, run[m][1] + jy); wsum += run[m][2]; }
            const wv = wsum / (e - q + 1);
            pen.add(pts, clamp(0.18 + 0.55 * wv, 0, 0.85) * run[q][3], (0.9 + 1.5 * wv) * sc);
            q = e - (rnd() < 0.3 ? 1 : 0);
          }
        }
        for (const K of kings) {
          const P = K.d.P, sc = K.T.sc;
          for (let pi = 0; pi < P.length; pi++) {
            const pr = P[pi]; if (pr.op !== 'max') continue;
            for (const loop of outlineOf(pr)) {
              let run = [];
              const n = loop.length;
              for (let q = 0; q <= n; q++) {
                const pnt = loop[q % n], pn = loop[(q + 1) % n], pp = loop[(q - 1 + n) % n];
                const tx = pn[0] - pp[0], ty = pn[1] - pp[1], tl = Math.hypot(tx, ty) || 1;
                let nx = ty / tl, ny = -tx / tl;
                if (!isNaN(primEval(pr, pnt[0] + nx * 4, pnt[1] + ny * 4))) { nx = -nx; ny = -ny; }
                const S0 = K.T.fx(pnt[0], pnt[1]);
                const Si = K.T.fx(pnt[0] - nx * 5, pnt[1] - ny * 5), So = K.T.fx(pnt[0] + nx * 6, pnt[1] + ny * 6);
                const ki = idx(Si[0], Si[1]), ko = idx(So[0], So[1]);
                let w = 0;
                if (ki >= 0 && pid[ki] === pi && oid[ki] === K.id) {
                  if (ko < 0 || oid[ko] !== K.id) w = 1;
                  else w = clamp((Hf[ki] - Hf[ko]) / 5, 0, 1) * 0.9;
                }
                const shadowSide = clamp(-(nx * LV[0] + ny * LV[1]) / 0.7, 0, 1);
                w *= 0.5 + 0.65 * shadowSide;
                if (w > 0.12) run.push([S0[0], S0[1], w, ki >= 0 ? fade(ki) : 1]);
                else { drawRun(run, sc); run = []; }
              }
              drawRun(run, sc);
            }
          }
          for (const L of K.d.lines) {
            let run = [];
            for (let q = 0; q < L.p.length - 1; q++) {
              const a = L.p[q], b = L.p[q + 1], n = Math.max(1, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / 3));
              for (let m = 0; m <= n; m++) {
                const S0 = K.T.fx(lerp(a[0], b[0], m / n), lerp(a[1], b[1], m / n));
                const k = idx(S0[0], S0[1]);
                if (k >= 0 && oid[k] === K.id && (L.on & (1 << part[k]))) run.push([S0[0], S0[1], 0.3 + 0.4 * L.w * (1 - lam[k] * 0.6), fade(k)]);
                else { drawRun(run, sc * 0.8); run = []; }
              }
            }
            drawRun(run, sc * 0.8);
          }
          for (const cr of K.cracks) {
            let run = [];
            for (let q = 0; q < cr.p.length - 1; q++) {
              const a = cr.p[q], b = cr.p[q + 1], n = Math.max(1, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / 3));
              for (let m = 0; m < n; m++) {
                const S0 = K.T.fx(lerp(a[0], b[0], m / n) + (rnd() - 0.5) * 1.6, lerp(a[1], b[1], m / n) + (rnd() - 0.5) * 1.6);
                const k = idx(S0[0], S0[1]);
                if (k >= 0 && oid[k] === K.id) run.push([S0[0], S0[1], clamp(0.25 + 0.28 * cr.w, 0, 1), fade(k)]);
                else { drawRun(run, sc * 0.75); run = []; }
              }
            }
            drawRun(run, sc * 0.75);
          }
          await pen.flush(gctx);
        }

        // pedestals: outline, plinth mouldings, fissures
        for (const pd of peds) {
          let run = [];
          for (let q = 0; q < pd.pts.length; q++) {
            const a = pd.pts[q], b = pd.pts[(q + 1) % pd.pts.length];
            const n = Math.max(1, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / 4));
            for (let m = 0; m < n; m++) {
              const x = lerp(a[0], b[0], m / n), y = lerp(a[1], b[1], m / n);
              const k = idx(x, y);
              if (x > 4 && x < RW - 4 && y > 4 && y < RH - 4 && k >= 0 && y < pd.wl - 6) run.push([x, y, 0.8, fade(k)]);
              else { drawRun(run, 1); run = []; }
            }
          }
          drawRun(run, 1);
          for (const r of [19, 40, 64, 82, 96]) hline(pd, pd.top + r * pd.sc, r === 96 ? 0.75 : 0.45);
          // the corner where the river face turns away
          {
            let run = [];
            for (let j = Math.floor(pd.top / F); j < Math.floor(pd.wl / F); j += 2) {
              const e = pd.rowEdge[j]; if (e !== e) continue;
              const x = e + pd.side * pd.cw + (rnd() - 0.5) * 1.4, y = (j + 0.5) * F, k = idx(x, y);
              if (k >= 0 && oid[k] === pd.id) run.push([x, y, 0.55, fade(k)]); else { drawRun(run, 1); run = []; }
            }
            drawRun(run, 1);
          }
          for (const L of pd.ledges) {
            for (const [off, w] of [[0, 0.8], [L.u, 0.35]]) {
              let run = [];
              for (let x = 0; x < RW; x += 4) {
                let y = L.y + L.tilt * (x - pd.inTop) + (vn(x / 40, L.y, NS + 47) - 0.5) * 14 * pd.sc + off;
                const k0 = idx(x, y);
                if (k0 >= 0 && oid[k0] === pd.id && aux[k0] < pd.cw) y += (pd.cw - aux[k0]) * pd.slope;
                const k = idx(x, y);
                if (k >= 0 && oid[k] === pd.id && rnd() > 0.04) run.push([x, y + (rnd() - 0.5), w, fade(k)]);
                else { drawRun(run, 0.95); run = []; }
              }
              drawRun(run, 0.95);
            }
          }
          for (let f = 0; f < 110; f++) {
            let x = rnd() * RW, y = lerp(pd.plinth + 10, pd.wl - 20, rnd());
            let k = idx(x, y); if (k < 0 || oid[k] !== pd.id) continue;
            const run2 = []; let a = -Math.PI / 2 + (rnd() - 0.5) * 0.6;
            const L = (30 + rnd() * 240) * pd.sc;
            for (let t = 0; t < L;) { const st = 5 + rnd() * 9; a += (rnd() - 0.5) * 0.9; a = lerp(a, -Math.PI / 2, 0.2); x += Math.cos(a) * st; y += Math.sin(a) * st; t += st; k = idx(x, y); if (k < 0 || oid[k] !== pd.id) break; run2.push([x, y, 0.35 + rnd() * 0.4, fade(k)]); }
            drawRun(run2, 0.85);
          }
          // joints crossing each bed at right angles to its dip
          const beds = [{ y: pd.top, tilt: pd.dip, js: 90 * pd.sc, jo: 0.3 }, ...pd.ledges];
          for (let b = 0; b < beds.length; b++) {
            const L0 = beds[b], L1 = beds[b + 1] || { y: pd.wl, tilt: pd.dip };
            const js = L0.js, jo = L0.jo;
            for (let n = -40; n < 80; n++) {
              if (rnd() < 0.3) continue;
              const run = [];
              for (let y = L0.y; y < L1.y + 40; y += 4) {
                const x = (n - jo) * js + (y - pd.top) * pd.dip - (vn(y / 60, b, NS + 44) - 0.5) * 0.25 * js;
                const yt = L0.y + L0.tilt * (x - pd.inTop), yb = L1.y + L1.tilt * (x - pd.inTop);
                if (y < yt || y > yb) continue;
                const k = idx(x, y);
                if (k >= 0 && oid[k] === pd.id) run.push([x + (rnd() - 0.5), y, 0.55, fade(k)]); else if (run.length) break;
              }
              drawRun(run, 0.9);
            }
          }
          for (const bp of pd.blocks) {
            const run = [];
            for (let q = 0; q < bp.length; q++) { const a = bp[q], c = bp[(q + 1) % bp.length]; for (let u = 0; u < 1; u += 0.1) { const x = lerp(a[0], c[0], u), y = lerp(a[1], c[1], u), k = idx(x, y); run.push([x, y, 0.85, k >= 0 ? fade(k) : 1]); } }
            drawRun(run, 1);
          }
          // roots and hanging growth under the overhangs
          for (const L of pd.ledges) for (let q = 0; q < 6; q++) {
            let x = rnd() * RW, y = L.y + L.tilt * (x - pd.inTop) + 2;
            const k0 = idx(x, y); if (k0 < 0 || oid[k0] !== pd.id) continue;
            const pts = []; const n = 6 + ((rnd() * 12) | 0);
            for (let s2 = 0; s2 < n; s2++) { pts.push(x, y); x += (rnd() - 0.5) * 3; y += 3 + rnd() * 2; }
            ln(pts, 0.5 * fade(k0), 0.9);
          }
        }
        function hline(pd, y, w) {
          let run = [];
          for (let x = 0; x < RW; x += 4) {
            let yy = y + Math.sin(x * 0.01) * 1.5 + (rnd() - 0.5) * 0.8;
            const k0 = idx(x, yy);
            if (k0 >= 0 && oid[k0] === pd.id && aux[k0] < pd.cw) yy += (pd.cw - aux[k0]) * pd.slope;
            const k = idx(x, yy);
            if (k >= 0 && oid[k] === pd.id) run.push([x, yy, w * (0.6 + 0.4 * (1 - lam[k])), fade(k)]);
            else { drawRun(run, 0.9); run = []; }
          }
          drawRun(run, 0.9);
        }

        // the gorge: crests, sheer edges, strata running to the vanishing point, fissures
        for (const W of walls) {
          const lines = [W.crest, W.nearEdge, W.hill];
          for (const B of W.butt) lines.push(B.crest, B.edge);
          for (const line of lines) {
            let run = [];
            for (let q = 0; q < line.length; q++) {
              const [x, y] = line[q], k = idx(x, y);
              const kk = idx(x - W.side * 3, y + 3);
              if (k >= 0 && kk >= 0 && isCliff(oid[kk]) && y > 2 && x > 2 && x < RW - 2) {
                const w = (1 - dep[kk]) * 0.95;
                run.push([x, y, w, fade(k)]);
              } else { drawRun(run, 0.85); run = []; }
            }
            drawRun(run, 0.85);
          }
          // strata
          for (let s = 0; s < 46; s++) {
            const y0 = lerp(W.yne + 30, HY + 30, Math.pow(rnd(), 0.8));
            const t0 = rnd() * 0.15, t1 = t0 + 0.15 + rnd() * 0.6;
            const run = [];
            for (let t = t0; t < t1; t += 0.006) {
              const x = lerp(W.xne, VPX, t), y = lerp(y0, HY, t) + (vn(t * 60, s, NS + 151) - 0.5) * 8 * (1 - t);
              const k = idx(x, y);
              if (k >= 0 && isCliff(oid[k])) run.push([x, y, 0.4 * (1 - dep[k]), fade(k)]);
              else if (run.length) break;
            }
            drawRun(run, 0.8);
          }
          // fissures and joints, falling sheer
          for (let s = 0; s < 70; s++) {
            const z = 1 + Math.pow(rnd(), 1.5) * 5;
            let x = W.zx(z) - W.side * rnd() * 20 / z, y = lerp(W.topAt(z), HY, rnd() * 0.5);
            const run = []; const L = (200 + rnd() * 700) / z;
            for (let t = 0; t < L; t += 5) {
              x += (rnd() - 0.5) * 1.4; y += 5;
              const k = idx(x, y);
              if (k < 0 || !isCliff(oid[k])) break;
              run.push([x, y, 0.5 * (1 - dep[k]), fade(k)]);
            }
            drawRun(run, 0.75);
          }
        }
        // trees: small conifers and shrubs, the scale of the cliffs
        for (const t of trees) {
          const k = idx(t.x, t.y); if (k < 0) continue;
          const f = fade(k) * (1 - smooth(1, 6, t.z) * 0.5), h = t.h;
          if (t.kind === 0) {
            ln([t.x, t.y, t.x + (rnd() - 0.5) * 1, t.y - h], 0.5 * f, 1);
            const pts = [];
            for (let q = 0; q <= 9; q++) { const u = q / 9, wd = (1 - u) * h * 0.24 + 0.6; pts.push(t.x + (q % 2 ? wd : -wd), t.y - h * (0.12 + u * 0.88)); }
            ln(pts, 0.55 * f, 1.1);
          } else if (t.kind === 2) {
            // a fern: arching fronds, each with its row of little leaflets
            for (let q = 0; q < 7; q++) {
              const a0 = -Math.PI / 2 + (q - 3) * 0.38 + (rnd() - 0.5) * 0.2, L = h * (0.6 + rnd() * 0.5), pts = [];
              let px = t.x, py = t.y, a = a0;
              for (let s2 = 0; s2 <= 8; s2++) {
                pts.push(px, py);
                if (s2 > 1 && s2 < 8) { const ll = L * 0.11 * (1 - s2 / 9); ln([px, py, px + Math.cos(a - 1.2) * ll, py + Math.sin(a - 1.2) * ll], 0.4 * f, 0.8); ln([px, py, px + Math.cos(a + 1.2) * ll, py + Math.sin(a + 1.2) * ll], 0.4 * f, 0.8); }
                px += Math.cos(a) * L / 8; py += Math.sin(a) * L / 8; a += (a0 < -Math.PI / 2 ? -0.12 : 0.12);
              }
              ln(pts, 0.5 * f, 0.9);
            }
          } else if (t.kind === 3) {
            // a small birch leaning out from a crack: pale trunk with dark marks, a light crown
            const lean = t.lean || 0.3, tx2 = t.x + lean * h, ty2 = t.y - h;
            const tr = [t.x, t.y, lerp(t.x, tx2, 0.5) + 2, lerp(t.y, ty2, 0.5), tx2, ty2];
            ln(tr, 0.55 * f, 1.4); ln([t.x + 2.2, t.y, tx2 + 1.5, ty2], 0.35 * f, 0.9);
            for (let q = 0; q < 6; q++) { const u = 0.1 + rnd() * 0.8, bx = lerp(t.x, tx2, u), by = lerp(t.y, ty2, u); ln([bx - 1.5, by, bx + 1.5, by + 0.5], 0.7 * f, 1); }
            for (let q = 0; q < 26; q++) {
              const cx = tx2 + (rnd() - 0.5) * h * 0.55, cy = ty2 + (rnd() - 0.3) * h * 0.4, r = 2 + rnd() * 3;
              ln([cx - r, cy, cx, cy - r * 0.6, cx + r, cy], 0.38 * f, 0.9);
            }
            for (let q = 0; q < 3; q++) { const pts = []; let rx = t.x, ry = t.y; for (let s2 = 0; s2 < 9; s2++) { pts.push(rx, ry); rx += (rnd() - 0.5) * 6 - lean * 2; ry += 4 + rnd() * 3; } ln(pts, 0.45 * f, 1); }
          } else {
            for (let q = 0; q < 6; q++) {
              const cx = t.x + (rnd() - 0.5) * h * 0.8, cy = t.y - rnd() * h * 0.7, r = h * (0.15 + rnd() * 0.2);
              const pts = []; for (let m = 0; m <= 6; m++) { const a = m / 6 * TAU + rnd(); pts.push(cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.8); }
              ln(pts, 0.4 * f, 1);
            }
          }
        }
        await pen.flush(gctx);
        mark('contours');

        /* texture of the stone: pits, lichen rosettes, a little stipple in the darks */
        for (const K of kings) {
          const sc = K.T.sc;
          for (let q = 0; q < 26000 * sc; q++) {
            const x = rnd() * RW, y = rnd() * 1800, k = idx(x, y);
            if (k < 0 || oid[k] !== K.id) continue;
            const t = tone[k];
            if (rnd() < t * 0.9) {
              const L = 1 + rnd() * 2.2, a = rnd() * TAU;
              ln([x, y, x + Math.cos(a) * L, y + Math.sin(a) * L], (0.25 + 0.35 * t) * fade(k), 1.1);
            } else if (lam[k] > 0.45 && rnd() < 0.06) {
              const r = (1.4 + rnd() * 3.2) * sc, pts = [];
              for (let m = 0; m <= 8; m++) { const a = m / 8 * TAU; pts.push(x + Math.cos(a) * r, y + Math.sin(a) * r * 0.85); }
              ln(pts, 0.3 * fade(k), 0.8);
            }
          }
        }
        // the scales of the armour on the breast, and the rings of the mail below
        for (const K of kings) {
          const sc = K.T.sc;
          for (let row = 0; row < 14; row++) {
            const dy = 575 + row * 20;
            for (let col = -9; col <= 9; col++) {
              const dx = col * 22 + (row % 2) * 11;
              const p = K.T.fx(dx, dy), k = idx(p[0], p[1]);
              if (k < 0 || oid[k] !== K.id || part[k] !== 5) continue;
              const pts = [];
              for (let m = 0; m <= 6; m++) { const a = Math.PI * m / 6; const q = K.T.fx(dx - Math.cos(a) * 11, dy + Math.sin(a) * 10); pts.push(q[0], q[1]); }
              ln(pts, (0.18 + 0.3 * tone[k]) * fade(k), 0.9 * sc);
            }
          }
          for (let row = 0; row < 30; row++) {
            const dy = 950 + row * 14;
            for (let col = -16; col <= 16; col++) {
              const dx = col * 15 + (row % 2) * 7.5;
              const p = K.T.fx(dx, dy), k = idx(p[0], p[1]);
              if (k < 0 || oid[k] !== K.id || part[k] !== 5 || rnd() < 0.25) continue;
              const r = 3.6 * sc;
              ln([p[0] - r, p[1], p[0] - r * 0.3, p[1] + r * 0.7, p[0] + r * 0.4, p[1] + r * 0.6, p[0] + r, p[1]], (0.12 + 0.28 * tone[k]) * fade(k), 0.8);
            }
          }
        }
        await pen.flush(gctx);
        mark('texture');

        /* the water: ripples drawn as short horizontal strokes, closer together towards the eye line */
        for (let y = HY + 3; y < RH - 16;) {
          const dyw = y - HY;
          for (let x = 10 + rnd() * 30; x < RW - 10;) {
            const L = (4 + dyw * 0.12) * (0.5 + rnd());
            const k = idx(x, y);
            if (k >= 0 && oid[k] === WATER) {
              const t = wlum[k];
              if (rnd() < 0.2 + t * 1.3) {
                const near = Math.min(1, dyw * 0.004 + 0.4);
                const pts = [], bend = (rnd() - 0.3) * (1 + dyw * 0.014);
                for (let m = 0; m <= 3; m++) { const u = m / 3; pts.push(x + L * u, y - bend * 4 * u * (1 - u)); }
                pen.add(pts, (0.06 + 0.4 * t) * near * fade(k), 0.9 + Math.min(1.3, dyw * 0.0018));
              }
            }
            x += L + (2 + dyw * 0.05) * (0.4 + rnd() * 1.6);
          }
          y += 1.2 + dyw * 0.02 * (0.7 + rnd() * 0.6);
          await breathe();
        }
        // eddies and boils off the feet of the pillars
        for (const pd of peds) {
          const cx0 = pd.inBase - pd.side * 60 * pd.sc;
          for (let e = 0; e < 9; e++) {
            const cx = cx0 + (rnd() - 0.5) * 300 * pd.sc - pd.side * rnd() * 150, cy = pd.wl + 20 + rnd() * 200 * pd.sc;
            const k = idx(cx, cy); if (k < 0 || oid[k] !== WATER) continue;
            const R = (14 + rnd() * 26) * (0.6 + (cy - HY) / 400), pts = [];
            for (let t = 0; t < TAU * 1.6; t += 0.2) { const r = R * (1 - t / (TAU * 2)); pts.push(cx + Math.cos(t) * r, cy + Math.sin(t) * r * 0.28); }
            ln(pts, 0.3 * fade(k) + 0.1, 1);
          }
        }
        await pen.flush(gctx);
        // the waterfall thread: two faint edges
        for (let q = 0; q + 6 < fall.length; q += 6) {
          const a = fall[q], b = fall[q + 6], k = idx(a[0], a[1]), w = 2 + (a[1] - 300) / 450;
          if (k < 0) continue;
          ln([a[0] - w, a[1], b[0] - w, b[1]], 0.18 * fade(k), 0.8);
          if (rnd() < 0.5) ln([a[0] + w, a[1], b[0] + w, b[1]], 0.14 * fade(k), 0.8);
        }
        // standing waves: chevrons pointing up the gorge, and the currents drawn in long lines
        for (const wv of waves) {
          for (const s2 of [-1, 1]) {
            const pts = [];
            for (let u = 0; u <= 1.001; u += 0.1) pts.push(wv.cx + s2 * u * wv.w, wv.y + u * wv.hgt * 2 - Math.sin(u * Math.PI) * wv.hgt * 0.4);
            ln(pts, 0.5, 1 + (wv.y - HY) * 0.002);
            ln(pts.map((v, i) => v + (i % 2 ? wv.hgt * 0.5 : 0)), 0.25, 1);
          }
        }
        for (let q = 0; q < 40; q++) {
          const x0 = VPX + (rnd() - 0.5) * 1800, pts = [];
          for (let t = 0; t <= 1; t += 0.04) {
            const y = lerp(RH - 40, HY + 20, t), x = lerp(x0, VPX + (x0 - VPX) * 0.08, Math.pow(t, 0.6)) + Math.sin(t * 9 + q) * 6 * (1 - t);
            const k = idx(x, y); if (k < 0 || oid[k] !== WATER) { if (pts.length > 6) break; pts.length = 0; continue; }
            pts.push(x, y);
          }
          if (pts.length > 6) ln(pts, 0.12 + rnd() * 0.1, 0.9);
        }
        // moss on the raised palm
        for (const K of kings) for (let q = 0; q < 2500; q++) {
          const x = rnd() * RW, y = rnd() * 900, k = idx(x, y);
          if (k < 0 || oid[k] !== K.id || part[k] !== 9 || aux[k] > 90) continue;
          if (vn(x / 7, y / 7, NS + 119) * 0.6 + vn(x / 2.5, y / 2.5, NS + 120) * 0.4 < 0.54) continue;
          ln([x, y, x + 1.2, y - 1.2], 0.45, 1.1);
        }
        mark('waterlines');

        /* the boats and the Fellowship */
        for (const b of boats) {
          const [top, bot] = hullPts(b, false);
          const ux = Math.cos(b.a), uy = Math.sin(b.a), L = b.L;
          const flat = (pts) => { const o = []; for (const p of pts) o.push(p[0], p[1]); return o; };
          ln(flat(top), 0.75, 1.5); ln(flat(bot), 0.85, 1.7);
          ln(flat(top.slice(2, 15).map((p) => [p[0], p[1] - L * 0.014])), 0.4, 1);   // the far gunwale
          ln(flat(top.slice(1, 16).map((p, q) => [p[0], lerp(p[1], bot[q + 1][1], 0.5)])), 0.3, 1);   // a strake
          for (let q = 1; q < 64; q++) { const u = q / 64, tp = top[Math.floor(u * 16)], bp = bot[Math.floor(u * 16)]; const x = b.x + ux * L * u; ln([x, lerp(tp[1], top[Math.min(16, Math.floor(u * 16) + 1)][1], u * 16 % 1) + 1.5, x + 0.6, lerp(bp[1], bot[Math.min(16, Math.floor(u * 16) + 1)][1], u * 16 % 1) - 1], 0.26, 1); }
          // reflection: broken dark dashes below the hull
          for (let q = 0; q < 16; q++) {
            const t = rnd(), x = b.x + ux * L * t, y = b.y + uy * L * t + 3 + rnd() * L * 0.12;
            const w = L * (0.06 + rnd() * 0.14);
            ln([x - w / 2, y, x + w / 2, y + (rnd() - 0.5)], 0.42, 1.2);
          }
          // wake running back towards us
          for (const sgn of [-1, 1]) {
            const pts = [];
            for (let q = 0; q < 10; q++) { const t = q / 9; pts.push(b.x + ux * L * (0.1 - t * 0.9) + (rnd() - 0.5) * 3, b.y + uy * L * (0.1 - t * 0.9) + 3 + sgn * 0 + t * L * 0.1 * (sgn > 0 ? 1 : 0.35)); }
            ln(pts, 0.22, 1);
          }
          // the crew
          const slots = b.crew.length === 3 ? [0.2, 0.5, 0.74] : [0.26, 0.7];
          b.crew.forEach((who, q) => {
            const t = slots[q], x = b.x + ux * L * t, yb = b.y + uy * L * t - L * 0.05;
            drawFigure(who, x, yb, L);
          });
        }
        function drawFigure(who, x, y, L) {
          const hob = who === 'frodo' || who === 'sam' || who === 'merry' || who === 'pippin';
          const H = L * (who === 'aragorn' ? 0.34 : who === 'gimli' ? 0.11 : hob ? 0.085 : 0.13);
          const P = (pts) => { const o = []; for (const p of pts) o.push(x + p[0] * H, y + p[1] * H); return o; };
          const fillShape = (pts, a) => {
            // dense pencil filling of a small dark shape
            let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
            for (const p of pts) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
            for (let yy = y0; yy <= y1; yy += 1.3) {
              const xs = [];
              for (let q = 0; q < pts.length; q++) {
                const a2 = pts[q], b2 = pts[(q + 1) % pts.length];
                if ((a2[1] <= yy && b2[1] > yy) || (b2[1] <= yy && a2[1] > yy)) xs.push(a2[0] + (yy - a2[1]) * (b2[0] - a2[0]) / (b2[1] - a2[1]));
              }
              xs.sort((p, q) => p - q);
              for (let q = 0; q + 1 < xs.length; q += 2) ln([xs[q], yy, xs[q + 1], yy + 0.6], a, 1.2);
            }
          };
          const abs = (pts) => pts.map((p) => [x + p[0] * H, y + p[1] * H]);
          if (who === 'aragorn') {
            // standing in the stern, his hood cast back, looking up at the kings; the cloak blown back
            const cloak = [[-0.09, -0.83], [-0.15, -0.7], [-0.2, -0.45], [-0.27, -0.2], [-0.36, -0.02], [-0.18, 0.02], [0.1, 0.02], [0.12, -0.3], [0.11, -0.6], [0.1, -0.82], [0.02, -0.86]];
            fillShape(abs(cloak), 0.62);
            ln(P([...cloak, cloak[0]]), 0.8, 1.2);
            // head tilted back, hair blowing
            const hc = [0.02, -0.93], hp = [];
            for (let q = 0; q <= 12; q++) { const a = q / 12 * TAU; hp.push([hc[0] + Math.cos(a) * 0.06, hc[1] + Math.sin(a) * 0.07]); }
            fillShape(abs(hp), 0.45); ln(P(hp), 0.8, 1.1);
            for (let q = 0; q < 4; q++) ln(P([[0.0, -0.97 + q * 0.02], [-0.08, -0.96 + q * 0.03], [-0.15 - q * 0.02, -0.92 + q * 0.04]]), 0.55, 0.9);
            ln(P([[0.06, -0.96], [0.1, -1.0]]), 0.6, 0.9);    // the lifted face
            ln(P([[-0.1, -0.86], [-0.13, -0.8], [-0.05, -0.79], [0.04, -0.83]]), 0.7, 1);   // the hood, cast back
            ln(P([[-0.08, -0.44], [-0.3, -0.06]]), 0.85, 1.4);                              // the sword at his side
            ln(P([[-0.13, -0.45], [-0.03, -0.41]]), 0.8, 1.1);
            ln(P([[-0.09, -0.46], [-0.06, -0.52]]), 0.8, 1.2);
            for (const fx2 of [-0.12, -0.04, 0.05]) ln(P([[fx2, -0.7], [fx2 - 0.06, -0.3], [fx2 - 0.1, -0.03]]), 0.35, 0.8);   // folds of the grey cloak
            // the paddle held upright as a staff
            ln(P([[0.17, -1.12], [0.14, 0.15]]), 0.8, 1.3);
            ln(P([[0.1, -0.74], [0.17, -0.62], [0.16, -0.56]]), 0.7, 1.1);
            ln(P([[0.155, -1.12], [0.19, -1.25], [0.17, -1.32], [0.145, -1.24], [0.155, -1.12]]), 0.7, 1);
          } else {
            const hump = [[-0.46, 0], [-0.44, -0.32], [-0.33, -0.6], [-0.15, -0.8], [0.0, -0.86], [0.06, -0.97], [0.12, -0.8], [0.27, -0.66], [0.4, -0.38], [0.46, 0]];
            fillShape(abs(hump), hob ? 0.55 : 0.62);
            ln(P(hump), 0.85, 1.2);
            // the hood's opening, and a lit edge of grey cloak towards the sun
            ln(P([[0.02, -0.84], [0.14, -0.74], [0.16, -0.6]]), 0.35, 0.8);
            ln(P([[-0.2, -0.55], [-0.28, -0.25], [-0.32, -0.02]]), 0.3, 0.8);
            if (who === 'gimli') ln(P([[-0.1, -0.5], [0.0, -0.2], [0.1, -0.5]]), 0.5, 0.9);   // the beard over the cloak
            if (who === 'boromir' || who === 'legolas' || who === 'gimli' || who === 'sam' || who === 'merry') {
              const s = who === 'legolas' ? 1 : -1;
              ln(P([[0.2 * s, -0.6], [0.7 * s, -0.25], [1.25 * s, 0.75]]), 0.75, 1.2);
              ln(P([[1.2 * s, 0.7], [1.32 * s, 1.05], [1.38 * s, 0.98], [1.27 * s, 0.66]]), 0.6, 1);
            }
          }
        }

        /* birds about the heads of the kings, and their nests */
        for (const n of nests) {
          const k = idx(n.x, n.y); if (k < 0) continue;
          const w = 30 * n.s, h = 11 * n.s;
          for (let q = 0; q < 46; q++) {
            const a = rnd() * TAU, r = rnd(), cx = n.x + Math.cos(a) * w * 0.5 * r, cy = n.y + Math.sin(a) * h * 0.5 * r;
            const ta = (rnd() - 0.5) * 1.2, tl = (5 + rnd() * 9) * n.s;
            ln([cx - Math.cos(ta) * tl / 2, cy - Math.sin(ta) * tl / 2, cx + Math.cos(ta) * tl / 2, cy + Math.sin(ta) * tl / 2], 0.5, 0.9);
          }
          ln([n.x - w * 0.3, n.y - h * 0.1, n.x, n.y + h * 0.15, n.x + w * 0.3, n.y - h * 0.1], 0.8, 1.8 * n.s);
          // the young, beaks open, over the rim
          for (let q = 0; q < 3; q++) {
            const cx = n.x + (q - 1) * w * 0.22, cy = n.y - h * 0.45 - rnd() * h * 0.2, r = 2.2 * n.s + 0.6;
            const hd = []; for (let m2 = 0; m2 <= 8; m2++) { const a = m2 / 8 * TAU; hd.push(cx + Math.cos(a) * r, cy + Math.sin(a) * r); }
            ln(hd, 0.7, 1.1);
            ln([cx - r * 0.5, cy - r * 0.7, cx + (q - 1) * r * 0.4, cy - r * 2.4, cx + r * 0.5, cy - r * 0.7], 0.75, 0.9);
          }
        }
        const birds = [];
        for (let q = 0; q < 22; q++) {
          const near = q < 8;
          const x = near ? lerp(340, 1250, rnd()) : lerp(700, 2200, rnd());
          const y = near ? lerp(60, 640, rnd()) : lerp(260, 1200, rnd());
          birds.push({ x, y, s: near ? 13 + rnd() * 13 : 6 + rnd() * 8, ph: rnd(), a: (rnd() - 0.5) * 0.6 });
        }
        for (const bd of birds) {
          const s = bd.s, ca = Math.cos(bd.a), sa = Math.sin(bd.a);
          const R = (px, py) => [bd.x + px * ca - py * sa, bd.y + px * sa + py * ca];
          const lift2 = (bd.ph - 0.5) * 0.9;
          const L1 = [R(-s, -s * lift2), R(-s * 0.5, -s * (0.2 + lift2 * 0.5)), R(0, 0)], L2 = [R(s, -s * lift2), R(s * 0.5, -s * (0.2 + lift2 * 0.5)), R(0, 0)];
          ln([...L1[0], ...L1[1], ...L1[2]], 0.72, 1.4 + s * 0.05);
          ln([...L2[0], ...L2[1], ...L2[2]], 0.72, 1.4 + s * 0.05);
          const b0 = R(-s * 0.12, s * 0.05), b1 = R(s * 0.18, s * 0.1);
          ln([...b0, ...b1], 0.8, 2 + s * 0.08);
        }
        await pen.flush(gctx);
        mark('figures');

        mark('final');
        /* ------------------------------------------------------- final pass: paper + washes + graphite */
        // the washes are resolved at field resolution; paper grain, granulation, dry-brush and the
        // graphite are worked per sheet pixel, in parallel workers when the browser allows it.
        const out = document.createElement('canvas'); out.width = RW; out.height = RH;
        const octx = out.getContext('2d');
        const G = new Uint8Array(RW * RH);
        for (let y0 = 0; y0 < RH; y0 += 400) {
          const gd = gctx.getImageData(0, y0, RW, 400).data, base = y0 * RW;
          for (let i = 0, n = RW * 400; i < n; i++) G[base + i] = gd[i * 4 + 3];
          await breathe();
        }
        const tA = paperTile(480, NS + 201), tB = paperTile(336, NS + 203);
        const jobs = [];
        for (let y0 = 0; y0 < RH; y0 += 200) jobs.push(y0);
        const mk = (y0) => {
          const y1 = Math.min(RH, y0 + 200);
          const j0 = Math.max(0, Math.floor(y0 / F) - 1), j1 = Math.min(FH - 1, Math.ceil(y1 / F) + 1);
          return { y0, y1, RW, FW, FH, F, j0, A: WA.slice(j0 * FW * 4, (j1 + 1) * FW * 4), B: WB.slice(j0 * FW * 4, (j1 + 1) * FW * 4), C: WC.slice(j0 * FW * 4, (j1 + 1) * FW * 4), G: G.slice(y0 * RW, y1 * RW), tA, tB, PAPER, GCOL };
        };
        const putBand = (y0, buf) => { octx.putImageData(new ImageData(new Uint8ClampedArray(buf.buffer || buf), RW, buf.length / 4 / RW), 0, y0); };
        let pool = null;
        try {
          const n = clamp((navigator.hardwareConcurrency || 2) - 1, 1, 4);
          const url = URL.createObjectURL(new Blob(['const composeBand = ' + composeBand.toString() + ';\nself.onmessage = (e) => { const out = composeBand(e.data); self.postMessage({ y0: e.data.y0, out }, [out.buffer]); };'], { type: 'text/javascript' }));
          pool = []; for (let q = 0; q < n; q++) pool.push(new Worker(url));
          workers.push(...pool);
          setTimeout(() => URL.revokeObjectURL(url), 5000);
        } catch (e) { pool = null; }
        let done = false;
        if (pool) {
          done = await new Promise((resolve) => {
            let next = 0, left = jobs.length, failed = false;
            const t = setTimeout(() => { failed = true; resolve(false); }, 60000);
            const feed = (w) => {
              if (next >= jobs.length) return;
              const m = mk(jobs[next++]);
              w.postMessage(m, [m.A.buffer, m.B.buffer, m.C.buffer, m.G.buffer]);
            };
            for (const w of pool) {
              w.onmessage = (e) => { if (failed || !alive) return; putBand(e.data.y0, e.data.out); left--; if (left === 0) { clearTimeout(t); resolve(true); } else feed(w); };
              w.onerror = () => { if (!failed) { failed = true; clearTimeout(t); resolve(false); } };
              feed(w); feed(w);
            }
          });
          for (const w of pool) w.terminate();
        }
        if (!alive) return;
        if (!done) {
          for (const y0 of jobs) { const m = mk(y0); putBand(y0, composeBand(m)); await breathe(); }
        }

        sheet = out;
        mark('done'); if (/argodebug/.test(location.search)) console.warn(TL.join(' | '));

        function paperTile(P, s) {
          const t = new Float32Array(P * P);
          for (let y = 0; y < P; y++) for (let x = 0; x < P; x++) {
            let v = vnP(x / 4, y / 4, s, P / 4) * 0.42 + vnP(x / 8, y / 8, s + 1, P / 8) * 0.33 + vnP(x / 16, y / 16, s + 2, P / 16) * 0.17 + vnP(x / 48, y / 48, s + 3, P / 48) * 0.08;
            t[y * P + x] = smooth(0.12, 0.88, v);
          }
          return t;
        }
      }

      /* ---------------------------------------------------------- the pencil */
      function makePen() {
        const buckets = new Map();
        return {
          add(pts, a, w) {
            if (pts.length < 4 || a <= 0.004) return;
            const ai = clamp(Math.round(a * 40), 1, 40), wi = clamp(Math.round(w * 5), 2, 40);
            const key = ai * 64 + wi;
            let b = buckets.get(key); if (!b) { b = []; buckets.set(key, b); }
            b.push(pts);
          },
          async flush(ctx) {
            for (const [key, list] of buckets) {
              ctx.globalAlpha = Math.floor(key / 64) / 40; ctx.lineWidth = (key % 64) / 5;
              for (let s = 0; s < list.length; s += 3000) {
                ctx.beginPath();
                const e = Math.min(list.length, s + 3000);
                for (let q = s; q < e; q++) {
                  const p = list[q]; ctx.moveTo(p[0], p[1]);
                  for (let m = 2; m < p.length; m += 2) ctx.lineTo(p[m], p[m + 1]);
                }
                ctx.stroke();
                await breathe();
              }
            }
            buckets.clear();
            ctx.globalAlpha = 1;
          },
        };
      }

      return {
        destroy() {
          alive = false;
          ro.disconnect();
          clearTimeout(holdT); clearTimeout(roT);
          el.removeEventListener('pointerdown', onDown);
          el.removeEventListener('pointermove', onMove);
          el.removeEventListener('pointerup', onUp);
          el.removeEventListener('pointercancel', onUp);
          el.removeEventListener('contextmenu', noMenu);
          sheet = null; preview = null; disp = null;
          for (const w of workers) { try { w.terminate(); } catch (_) { /* gone */ } }
          chan.port1.onmessage = null; chan.port1.close();
        },
      };
    },
  });
})();
