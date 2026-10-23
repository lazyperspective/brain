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
  const VPX = 1300;                        // where the gorge vanishes
  const GX = 1318, GY = 2240;              // the low sun, behind the mist at the far end

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
  function kingDesign(side, rnd) {
    const P = [];
    const M = (o) => { P.push(Object.assign({ op: 'max' }, o)); };
    const A = (o, on) => { P.push(Object.assign({ op: 'add', on }, o)); };
    const C = (o, on) => { P.push(Object.assign({ op: 'cut', on }, o)); };
    const lines = [];        // incised lines also drawn in pencil: {p, w, on}
    const mirror = (pts) => pts.map((p) => [-p[0], p[1]]);
    const cutLine = (p, r, d, on, w) => { C({ k: 'cap', p, r: [r, r], b: d }, on); lines.push({ p, w: w || 1, on }); };
    const HELM = 1, CROWN = 2, FACE = 3, BEARD = 4, TORSO = 5, PAUL = 6, CLOAK = 7, ARM = 8, HAND = 9, HAFT = 10, AXE = 11, LEG = 12;
    const bit = (...a) => a.reduce((m, b) => m | (1 << b), 0);
    const R = side < 0; // left king

    /* cloak, hanging behind */
    M({ k: 'poly', p: [[-250, 418], [-326, 520], [-356, 760], [-388, 1080], [-420, 1350], [-470, 1660], [-236, 1660], [-226, 1000]], z: 6, b: 22, rb: 50, part: CLOAK });
    M({ k: 'poly', p: [[250, 418], [326, 520], [346, 800], [370, 1100], [396, 1350], [440, 1660], [236, 1660], [226, 1000]], z: 6, b: 22, rb: 50, part: CLOAK });
    // the cloak falls in deep folds
    for (const sx of [-1, 1]) for (let q = 0; q < 5; q++) {
      const x0 = sx * (262 + q * 20), x1 = sx * (262 + q * 40 + 10);
      A({ k: 'cap', p: [[x0, 620 + q * 40], [x1, 1660]], r: [10, 16], b: 9 }, bit(CLOAK));
    }
    /* body: mailed torso and long hauberk */
    // the recess of the stone behind and between the legs
    M({ k: 'poly', p: [[-226, 1150], [226, 1150], [236, 1700], [-236, 1700]], z: 0, b: 6, rb: 30, part: CLOAK });
    // legs in greaves, standing on the plinth (their feet are hidden by its edge)
    M({ k: 'cap', p: [[-112, 1200], [-126, 1700]], r: [80, 66], z: 70, b: 50, part: LEG });
    M({ k: 'cap', p: [[112, 1200], [126, 1700]], r: [80, 66], z: 70, b: 50, part: LEG });
    for (const sx of [-1, 1]) {
      A({ k: 'ell', c: [sx * 118, 1418], rx: 46, ry: 34, b: 12 }, bit(LEG));
      for (const yy of [1380, 1456, 1540, 1610]) cutLine([[sx * 118 - 62, yy], [sx * 118 + 62, yy + 6]], 2.4, 6, bit(LEG), 0.9);
      cutLine([[sx * 118 + sx * 6, 1470], [sx * 120 + sx * 4, 1690]], 2, 5, bit(LEG), 0.8);
    }
    M({ k: 'poly', p: [[-246, 404], [246, 404], [272, 520], [258, 700], [228, 880], [240, 1060], [262, 1220], [278, 1300], [180, 1312], [60, 1298], [0, 1290], [-60, 1298], [-180, 1312], [-278, 1300], [-262, 1220], [-240, 1060], [-228, 880], [-258, 700], [-272, 520]], z: 40, b: 96, rb: 220, part: TORSO });
    // folds of the hauberk below the belt
    for (let q = -4; q <= 4; q++) A({ k: 'cap', p: [[q * 52 + 14, 960], [q * 58 + 10, 1300]], r: [9, 15], b: 8 }, bit(TORSO));
    // breastplate, belt, buckle, gorget
    A({ k: 'poly', p: [[-196, 560], [196, 560], [205, 700], [170, 860], [-170, 860], [-205, 700]], b: 9, rb: 14 }, bit(TORSO));
    A({ k: 'cap', p: [[0, 590], [0, 850]], r: [26, 30], b: 7 }, bit(TORSO));
    A({ k: 'poly', p: [[-232, 878], [232, 878], [236, 934], [-236, 934]], b: 13, rb: 7 }, bit(TORSO));
    A({ k: 'ell', c: [0, 906], rx: 34, ry: 30, b: 9 }, bit(TORSO));
    A({ k: 'poly', p: [[-120, 405], [120, 405], [140, 470], [-140, 470]], b: 10, rb: 10 }, bit(TORSO));
    /* pauldrons */
    M({ k: 'ell', c: [-236, 452], rx: 122, ry: 74, z: 112, b: 40, part: PAUL });
    M({ k: 'ell', c: [236, 452], rx: 122, ry: 74, z: 112, b: 40, part: PAUL });
    for (const sx of [-1, 1]) {
      for (let k = 1; k <= 4; k++) {
        const pts = [];
        for (let a = 0.1; a <= 0.9; a += 0.04) {
          const t = Math.PI * a;
          pts.push([sx * 236 + Math.cos(t) * 122 * (1 - k * 0.03), 452 - 46 + k * 22 + Math.sin(t) * 34]);
        }
        cutLine(pts, 3.2, 7, bit(PAUL), 1.1);
      }
    }
    /* the raised left hand (+x) */
    M({ k: 'cap', p: [[262, 482], [420, 612]], r: [74, 60], z: 96, b: 52, part: ARM });
    M({ k: 'ell', c: [428, 612], rx: 60, ry: 55, z: 104, b: 40, part: ARM });
    M({ k: 'cap', p: [[430, 600], [452, 350]], r: [58, 46], z: 124, b: 46, part: ARM });
    for (const yy of [565, 520, 420, 372]) cutLine([[384 + (565 - yy) * 0.07, yy + 5], [478 + (565 - yy) * 0.08, yy - 3]], 2.6, 6, bit(ARM), 1);
    M({ k: 'poly', p: [[404, 344], [500, 338], [519, 272], [516, 210], [406, 212], [398, 272]], z: 150, b: 15, rb: 24, part: HAND });
    C({ k: 'ell', c: [460, 268], rx: 30, ry: 28, b: 7 }, bit(HAND));
    A({ k: 'ell', c: [422, 302], rx: 26, ry: 34, b: 7 }, bit(HAND));
    const fingers = [
      [[420, 216], [416, 114], 15, 13],
      [[448, 212], [449, 94], 16, 14],
      [[476, 214], [480, 106], 15, 13],
      [[503, 220], [512, R ? 142 : 160], 13, 11.5],   // the right king has lost the tip of his little finger
    ];
    for (const f of fingers) {
      M({ k: 'cap', p: [f[0], f[1]], r: [f[2], f[3]], z: 156, b: 13, part: HAND });
      for (const u of [0.36, 0.68]) {
        const cx = lerp(f[0][0], f[1][0], u), cy = lerp(f[0][1], f[1][1], u);
        cutLine([[cx - f[2] * 0.7, cy + 1.5], [cx + f[2] * 0.7, cy - 1]], 1.6, 4, bit(HAND), 0.7);
      }
    }
    M({ k: 'cap', p: [[410, 314], [380, 270], [366, 228]], r: [19, 14], z: 162, b: 13, part: HAND });
    cutLine([[372, 252], [388, 246]], 1.6, 4, bit(HAND), 0.7);
    cutLine([[424, 336], [432, 296], [446, 262], [470, 240]], 1.8, 5, bit(HAND), 0.8);   // life line
    cutLine([[420, 246], [458, 236], [500, 238]], 1.6, 4, bit(HAND), 0.7);
    cutLine([[404, 232], [450, 226]], 1.5, 3, bit(HAND), 0.6);
    /* the right arm (-x), holding the axe */
    M({ k: 'cap', p: [[-262, 482], [-344, 742]], r: [76, 63], z: 96, b: 52, part: ARM });
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
    const cheek = [[-110, 176], [-70, 182], [-64, 262], [-72, 318], [-90, 334], [-108, 300], [-116, 236]];
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
      C({ k: 'ell', c: [sx * 31, 210], rx: 21, ry: 12.5, b: 26 }, bit(FACE));
      A({ k: 'ell', c: [sx * 31, 212], rx: 12.5, ry: 6.5, b: 11 }, bit(FACE));
      C({ k: 'ell', c: [sx * 30 + 2, 212], rx: 3.6, ry: 3.6, b: 6 }, bit(FACE));
      cutLine([[sx * 46, 205], [sx * 31, 202], [sx * 17, 206]], 1.5, 3, bit(FACE), 0.8);
      cutLine([[sx * 44, 219], [sx * 31, 222], [sx * 18, 218]], 1.4, 2.5, bit(FACE), 0.6);
      A({ k: 'ell', c: [sx * 41, 238], rx: 21, ry: 16, b: 8 }, bit(FACE));
      cutLine([[sx * 14, 254], [sx * 26, 272], [sx * 30, 292]], 1.6, 4, bit(FACE), 0.8);  // nasolabial fold
    }
    M({ k: 'cap', p: [[0, 192], [0, 254]], r: [8, 12.5], z: 134, b: 15, part: FACE });
    M({ k: 'ell', c: [0, 256], rx: 15, ry: 11, z: 134, b: 16, part: FACE });
    C({ k: 'ell', c: [-8, 265], rx: 4.5, ry: 3, b: 7 }, bit(FACE));
    C({ k: 'ell', c: [8, 265], rx: 4.5, ry: 3, b: 7 }, bit(FACE));
    if (R) C({ k: 'ell', c: [5, 252], rx: 11, ry: 9, b: 10 }, bit(FACE));   // a chipped nose
    // moustache, mouth, beard
    M({ k: 'cap', p: [[-3, 270], [-28, 280], [-50, 304]], r: [9, 6], z: 140, b: 8, part: BEARD });
    M({ k: 'cap', p: [[3, 270], [28, 280], [50, 304]], r: [9, 6], z: 140, b: 8, part: BEARD });
    const beard = [[-62, 274], [-40, 282], [0, 288], [40, 282], [62, 274], [84, 352], [91, 432], [78, 516], [44, 582], [0, 600], [-44, 582], [-78, 516], [-91, 432], [-84, 352]];
    M({ k: 'poly', p: beard, z: 116, b: 34, rb: 60, part: BEARD });
    A({ k: 'ell', c: [0, 296], rx: 15, ry: 6, b: 4 }, bit(BEARD, FACE));
    cutLine([[-17, 290], [0, 292], [17, 290]], 2, 6, bit(BEARD, FACE), 1);
    // beard locks: carved wavy strands, the two forks of the beard
    for (let s = -6; s <= 6; s++) {
      const pts = [];
      const x0 = s * 12.5, ph = rnd() * TAU;
      for (let y = 306; y <= 596 - Math.abs(s) * 9; y += 8) {
        const spread = 1 + (y - 300) / 420;
        pts.push([x0 * spread + Math.sin(y * 0.05 + ph + s * 0.7) * 3.5, y]);
      }
      if (pts.length > 2) cutLine(pts, 2.6, 5.5, bit(BEARD), 0.85);
    }
    C({ k: 'cap', p: [[0, 520], [0, 604]], r: [4, 12], b: 14 }, bit(BEARD));

    /* hem and folds of the hauberk */
    const hem = [];
    for (let x = -272; x <= 272; x += 12) hem.push([x, 1280 + Math.abs(x) * 0.08 + Math.sin(x * 0.12) * 5]);
    cutLine(hem, 3, 7, bit(TORSO), 1.1);
    return { P, lines, parts: { HELM, CROWN, FACE, BEARD, TORSO, PAUL, CLOAK, ARM, HAND, HAFT, AXE, LEG } };
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
          const xne = side < 0 ? 900 : 1600, yne = side < 0 ? 860 : 1060, base = HY + 40;
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
          const far = side < 0 ? [[-80, 1330], [180, 1240], [420, 1150], [650, 1080], [820, 1030], [xne, yne]] : [[RW + 80, 1440], [2240, 1370], [2000, 1290], [1800, 1220], [1640, 1180], [xne, yne]];
          const hill = [];
          for (let q = 0; q + 1 < far.length; q++) hill.push(...jag(far[q], far[q + 1], 3, 0.14, rnd).slice(q ? 1 : 0));
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
        for (const side of [-1, 1]) {
          const d = kingDesign(side, rnd);
          const T = side < 0
            ? { Y0: 118, ky: 1.0, ax0: 682, ax1: 590, sx0: 0.98, sx1: 1.14, cut: 1648 }
            : { Y0: 302, ky: 0.8, ax0: 1788, ax1: 1858, sx0: 0.76, sx1: 0.86, cut: 1530 };
          T.Y1 = T.Y0 + 1660 * T.ky;
          T.fx = (dx, dy) => { const Y = T.Y0 + dy * T.ky, t = (Y - T.Y0) / (T.Y1 - T.Y0); return [lerp(T.ax0, T.ax1, t) + dx * lerp(T.sx0, T.sx1, t), Y]; };
          T.sc = side < 0 ? 1 : 0.78;
          kings.push({ side, d, T, id: side < 0 ? KINGL : KINGR, cracks: [] });
        }
        for (const K of kings) {
          const { T } = K;
          const rowDy = new Float32Array(FH), rowAx = new Float32Array(FH), rowSx = new Float32Array(FH);
          for (let j = 0; j < FH; j++) {
            const Y = (j + 0.5) * F, t = (Y - T.Y0) / (T.Y1 - T.Y0);
            rowDy[j] = (Y - T.Y0) / T.ky; rowAx[j] = lerp(T.ax0, T.ax1, t); rowSx[j] = lerp(T.sx0, T.sx1, t);
          }
          K.rowDy = rowDy; K.rowAx = rowAx; K.rowSx = rowSx;
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
          const a = K.T.fx(x0, y0), b = K.T.fx(x1, y0), c = K.T.fx(x0, y1), e = K.T.fx(x1, y1);
          const X0 = Math.max(0, Math.floor(Math.min(a[0], c[0]) / F) - 2), X1 = Math.min(FW - 1, Math.ceil(Math.max(b[0], e[0]) / F) + 2);
          const J0 = Math.max(0, Math.floor(a[1] / F) - 2), J1 = Math.min(FH - 1, Math.ceil(c[1] / F) + 2);
          const id = K.id, scl = pr.scaled ? 1 : 0;
          for (let j = J0; j <= J1; j++) {
            const dy = K.rowDy[j], ax = K.rowAx[j], sx = K.rowSx[j];
            for (let i = X0; i <= X1; i++) {
              const dx = ((i + 0.5) * F - ax) / sx;
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
        const peds = [
          { id: PEDL, side: -1, top: kings[0].T.cut, inTop: 968, inBase: 1010, outTop: 96, outBase: 36, wl: 2502, sc: 1 },
          { id: PEDR, side: 1, top: kings[1].T.cut, inTop: 1500, inBase: 1476, outTop: 2318, outBase: 2366, wl: 2466, sc: 0.8 },
        ];
        for (const pd of peds) {
          const r = -pd.side, sc = pd.sc, top = pd.top, pH = 96 * sc;
          const X = (edge, u) => edge + r * u;
          // the river face of the pillar turns away from us: its horizontals run down towards the gorge
          pd.cw = (pd.side < 0 ? 86 : 62) * sc; pd.xc = X(pd.inTop, -pd.cw);
          pd.slope = 0.6 * (HY - top) / Math.abs(VPX - pd.xc);
          const drop = pd.cw * pd.slope;
          const pts = [[pd.outTop, top], [pd.xc, top], [X(pd.inTop, -4), top + drop]];
          pts.push([X(pd.inTop, 10 * sc), top + drop + pH * 0.2], [X(pd.inTop, 16 * sc), top + drop + pH * 0.42], [X(pd.inTop, 14 * sc), top + drop + pH * 0.66], [X(pd.inTop, 5 * sc), top + drop + pH * 0.86], [X(pd.inTop, -2 * sc), top + drop + pH]);
          const y0 = top + pH + drop, y1 = pd.wl;
          const ctrl = [];
          const nq = 12;
          for (let q = 0; q <= nq; q++) {
            const f = q / nq, y = lerp(y0, y1, f);
            const u = -8 * sc + (rnd() - 0.5) * 34 * sc * smooth(0, 0.3, f) + smooth(0.7, 1, f) * 50 * sc + Math.sin(f * 9 + rnd() * 2) * 10 * sc;
            ctrl.push([X(lerp(pd.inTop, pd.inBase, f), u), y]);
          }
          for (let q = 0; q + 1 < ctrl.length; q++) pts.push(...jag(ctrl[q], ctrl[q + 1], 3, 0.14, rnd).slice(1));
          // fallen blocks and the foot of the rock in the water
          pts.push([X(pd.inBase, 90 * sc), y1 - 10], [X(pd.inBase, 120 * sc), y1 + 2], [X(pd.inBase, 60 * sc), y1 + 10]);
          // the outer flank, going back up, and its moulding
          pts.push([X(pd.outBase, -70 * sc), y1 + 14], [X(pd.outBase, -40 * sc), y1 - 2]);
          const oc = [];
          for (let q = nq; q >= 0; q--) {
            const f = q / nq, y = lerp(y0, y1, f);
            oc.push([X(lerp(pd.outTop, pd.outBase, f), 8 * sc + (rnd() - 0.5) * 30 * sc * smooth(0, 0.3, f) - smooth(0.7, 1, f) * 30 * sc), y]);
          }
          for (let q = 0; q + 1 < oc.length; q++) pts.push(...jag(oc[q], oc[q + 1], 3, 0.12, rnd).slice(1));
          pts.push([X(pd.outTop, -10 * sc), top + pH * 0.86], [X(pd.outTop, -20 * sc), top + pH * 0.6], [X(pd.outTop, -20 * sc), top + pH * 0.36], [X(pd.outTop, -8 * sc), top + pH * 0.15]);
          pd.pts = pts; pd.edge = ctrl; pd.oedge = oc;
          pd.plinth = top + pH; pd.rowEdge = new Float32Array(FH).fill(NaN);
          pd.ledges = [];
          for (let y = y0 + (90 + rnd() * 80) * sc; y < y1 - 140 * sc; y += (150 + rnd() * 170) * sc) pd.ledges.push({ y, tilt: (rnd() - 0.5) * 0.12, d: (10 + rnd() * 10) * sc, u: (26 + rnd() * 30) * sc });
          fillPoly(pd.pts, (j, i0, i1, xa, xb) => {
            for (let i = i0; i <= i1; i++) {
              const k = j * FW + i; oid[k] = pd.id; dep[k] = 0.04; part[k] = 0;
              aux[k] = pd.side < 0 ? (xb - i) * F : (i - xa) * F;   // distance in from the river edge
              auxX[k] = (xb - xa) * F;                                  // the width of the pillar here
            }
            pd.rowEdge[j] = (pd.side < 0 ? xb : xa) * F;
          });
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
              const s = K.rowSx[j] / F;
              const dx = auxX[k], dy = aux[k];
              // weathering: eroded skin, pits, flaking, rain-runnels
              let h = Hf[k] + (fbm(dx / 26, dy / 26, NS + 3 + o, 3) - 0.5) * 10 + (vn(dx / 5, dy / 5, NS + 9) - 0.5) * 2.4;
              const pit = vn(dx / 3, dy / 3, NS + 21 + o);
              if (pit > 0.82) h -= (pit - 0.82) * 24;
              const flake = fbm(dx / 40, dy / 40, NS + 25 + o, 3);
              if (flake > 0.64) h -= 3.5;
              h -= Math.pow(vn(dx / 7, dy / 90, NS + 33 + o), 4) * 5;
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
                const f1 = facet(x / (130 * sc), y / (520 * sc), NS + 43), f2 = facet(x / (34 * sc), y / (90 * sc), NS + 45);
                const h1 = hash(f1.id, 1, NS), h2 = hash(f1.id, 2, NS), h3 = hash(f2.id, 3, NS), h4 = hash(f2.id, 4, NS);
                nx = (h1 - 0.5) * 0.55 + (h3 - 0.5) * 0.16; ny = (h2 - 0.6) * 0.22 + (h4 - 0.5) * 0.12; nz = 1;
                if (onSide) { nx = nx * 0.35 - pd.side * 1.4; nz = 0.5; }
                else nx -= -pd.side * 0.25 * smooth(300, 800, aux[k] / sc);
                const uo = (auxX[k] - aux[k]) / sc;      // distance from the outer flank
                if (uo < 170) nx -= -pd.side * 0.9 * (1 - uo / 170);
                // ledges of bedding cutting across the columns: lit tops, dark undersides
                for (const L of pd.ledges) {
                  const yl = y - off - (L.y + L.tilt * (x - pd.inTop) + (vn(x / 40, L.y, NS + 47) - 0.5) * 14 * sc);
                  if (yl > -L.d && yl < 0) { ny = -1.2; nx *= 0.4; break; }
                  if (yl >= 0 && yl < L.u) { ny = 0.9 + yl / L.u * -0.6; nz = 0.6; break; }
                }
                cav[k] = (f1.edge < 0.03 ? 1 : 0) + (f2.edge < 0.025 ? 0.4 : 0);
              }
              const l = Math.hypot(nx, ny, nz);
              lam[k] = Math.max(0, (nx * Lx + ny * Ly + nz * Lz) / l);
              gx[k] = nx / l; gy[k] = ny / l;
            } else if (isCliff(o)) {
              // sheer faces, split into tall slabs; one wall in the light, the other in shadow
              const sideL = o < CLIFF + 15, z = aux[k];
              const wy = (HY - y) * z;   // height above the water, as if near
              const f1 = facet(z * 5.5, wy / 260, NS + 51 + o), f2 = facet(z * 16, wy / 70, NS + 53);
              const h1 = hash(f1.id, 1, NS), h2 = hash(f1.id, 2, NS), h3 = hash(f2.id, 3, NS);
              let nx = (sideL ? 0.9 : -0.9) + (h1 - 0.5) * 0.9 + (h3 - 0.5) * 0.4, ny = (h2 - 0.6) * 0.5, nz = 0.7;
              const ob = o - (sideL ? CLIFF : CLIFF + 15);
              if (ob >= 1 && ob <= 8) {   // buttress: its front faces us, its river side turns away
                const dd = Hf[k];
                if (dd < 60) nx = (sideL ? 1.1 : -1.1) + (h1 - 0.5) * 0.5;
                else { nx = (h1 - 0.5) * 0.7; nz = 1; }
              }
              if (ob === 9) { nx = (h1 - 0.5) * 1.2; ny = (h2 - 0.6) * 0.8; nz = 1; }
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
              for (const sp of [[1010, 2502, 1.15, -1], [1476, 2466, 0.85, 1]]) {
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
                t += 0.16 * smooth(0, -380, dx) + 0.12 * smooth(900, 1660, dy);      // the broad turning of the form
                const g2 = sgx[k] * sgx[k] + sgy[k] * sgy[k];
                const contour = Math.atan2(sgy[k], sgx[k]) + Math.PI / 2;
                a = smooth(0.02, 0.2, g2) > 0.5 ? contour : -0.95;
                if (part[k] === 7) a = -1.48;          // cloak: along the folds
                if (part[k] === 10) a = -1.57;         // haft
                if ((part[k] === 5 && dy > 950) || part[k] === 12) a = -1.5;
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
              add(k, PAY, (0.06 + 0.22 * near) * (0.8 + 0.4 * mott));
              add(k, ULT, 0.05 + 0.1 * near + (sideL ? 0 : 0.08));
              add(k, GRN, 0.05 * near);
              add(k, SEP, 0.06 * near);
              add(k, OCH, 0.07 + 0.2 * glow + (sideL ? 0.14 * near * lit : 0));
              add(k, ROS, 0.03 * glow + (sideL ? 0.05 * lit * near : 0));
              const sh = (1 - lit) + (vn(x / 40, y / 90, NS + 99) - 0.5) * 0.3;
              if (sh > 0.5) { const w = smooth(0.5, 0.515, sh), e = Math.exp(-(sh - 0.5) / 0.04); add(k, PAY, w * (0.08 + 0.06 * e) * (0.3 + near)); add(k, ULT, w * 0.07); }
              if (sh > 0.78) { const w = smooth(0.78, 0.79, sh); add(k, SEP, w * 0.12 * near); }
              dry[k] = 0.45 * near * smooth(0.55, 0.66, vn(x / 14, y / 110, NS + 113));
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
              dry[k] = (lit > 0.55 ? 0.55 : 0.15) * smooth(0.58, 0.7, vn(x / 15, y / 120, NS + 111));
            } else if (isKing(o)) {
              const lit = lam[k] * (1 - 0.9 * shd[k]);
              const dyk = aux[k], dxk = auxX[k];
              add(k, GRN, 0.06 + 0.05 * mott);
              add(k, PAY, 0.07 + 0.08 * smooth(700, 1660, dyk));
              add(k, OCH, 0.13 + 0.05 * mott);
              add(k, SIE, 0.03);
              const sh = 1 - lit + 0.14 * smooth(0, -380, dxk) + 0.1 * smooth(900, 1650, dyk) + (vn(x / 60, y / 60, NS + 103) - 0.5) * 0.1;
              if (sh > 0.5) { const w = smooth(0.5, 0.512, sh), e = Math.exp(-(sh - 0.5) / 0.035); add(k, ULT, w * (0.2 + 0.1 * e)); add(k, SEP, w * (0.1 + 0.06 * e)); add(k, PAY, w * 0.1); }
              if (sh > 0.76) { const w = smooth(0.76, 0.772, sh); add(k, SEP, w * 0.2); add(k, PAY, w * 0.12); add(k, ULT, w * 0.06); }
              if (lit > 0.58) { const w = smooth(0.58, 0.62, lit); add(k, OCH, w * 0.14); add(k, ROS, w * 0.07); add(k, SIE, w * 0.03); }
              if (part[k] === 7 && Math.abs(dxk) < 215 && dyk > 1150) { add(k, SEP, 0.16); add(k, PAY, 0.12); add(k, ULT, 0.1); }
              // stains: rain runnels, orange lichen, moss on what faces the sky
              const run = vn(x / 7, y / 150, NS + 105 + o);
              if (run > 0.72) add(k, SEP, (run - 0.72) * 0.5);
              const li = vn(x / 14, y / 14, NS + 107 + o) * 0.6 + vn(x / 5, y / 5, NS + 108) * 0.4;
              if (li > 0.7 && lam[k] > 0.35) { add(k, SIE, (li - 0.7) * 1.0); add(k, OCH, (li - 0.7) * 1.2); }
              const moss = vn(x / 22, y / 22, NS + 109 + o);
              if (moss > 0.62 && -gy[k] > 0.12) add(k, GRN, (moss - 0.62) * 1.2);
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
          { x: 1222, y: 2490, L: 150, a: -0.13, crew: ['aragorn', 'frodo', 'sam'] },
          { x: 1004, y: 2534, L: 172, a: -0.11, crew: ['boromir', 'merry', 'pippin'] },
          { x: 752, y: 2598, L: 198, a: -0.09, crew: ['gimli', 'legolas'] },
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
          [[-70, 100, 1], [238, 372, 1.25], [-470, 188, 0.85], [-300, 1180, 0.7]],
          [[26, 100, 1.1], [-236, 370, 1.1], [470, 640, 0.8]],
        ];
        kings.forEach((K, q) => {
          for (const n of nestAt[q]) {
            const [x, y] = K.T.fx(n[0], n[1]);
            const s = n[2] * K.T.sc;
            nests.push({ K, x, y, s });
            for (let st = 0; st < 5 + ((rnd() * 4) | 0); st++) {
              let dx = n[0] + (rnd() - 0.5) * 40 * n[2], dy = n[1] + 6;
              const L = (40 + rnd() * 170) * n[2], w = 0.6 + rnd() * 0.8;
              for (let t = 0; t < L; t += 3) {
                dx += (rnd() - 0.5) * 2.2; dy += 3;
                const p = K.T.fx(dx, dy), k = idx(p[0], p[1]);
                if (k < 0 || oid[k] !== K.id) break;
                const fall = 1 - t / L;
                lift[k] = Math.max(lift[k], (0.55 + 0.3 * fall) * w);
                if (fall > 0.5 && rnd() < 0.5) { const k2 = idx(p[0] + F, p[1]); if (k2 >= 0 && oid[k2] === K.id) lift[k2] = Math.max(lift[k2], 0.5 * w); }
              }
            }
          }
        });

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
        // tufts and bushes on the ledges of the pillars
        for (const pd of peds) for (const L of pd.ledges) {
          for (let q = 0; q < 7; q++) {
            const x = rnd() * RW, y = L.y + L.tilt * (x - pd.inTop) - 2;
            const k = idx(x, y);
            if (k >= 0 && oid[k] === pd.id && mist[k] < 0.5) trees.push({ x, y, h: (8 + rnd() * 16) * pd.sc, kind: 1, z: 1 });
          }
        }
        for (const t of trees) {
          const w = t.h * (t.kind ? 0.9 : 0.42);
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
          // the facet edges of the rock, felt for with short dark touches
          for (let q = 0; q < 9000 * pd.sc; q++) {
            const x = rnd() * RW, y = lerp(pd.plinth, pd.wl, rnd()), k = idx(x, y);
            if (k < 0 || oid[k] !== pd.id || cav[k] < 0.9) continue;
            const a = -1.57 + (rnd() - 0.5) * 2.6, L = 3 + rnd() * 7;
            ln([x, y, x + Math.cos(a) * L, y + Math.sin(a) * L], 0.28 * fade(k), 1.1);
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
            if (who === 'boromir' || who === 'legolas' || who === 'gimli') {
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
