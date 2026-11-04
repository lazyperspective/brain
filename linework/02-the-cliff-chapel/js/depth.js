// depth.js - planes and air. Each render step draws under a depth profile:
//   wAt(x,y)   line-weight factor (Pen.line / Pen.dot)
//   spAt(x,y)  hatch-spacing factor (hatchDither)
//   detAt(x,y) fraction of small marks kept (stipple / flecks)
//   hazeConst  how far flat colours drift into the air (set per object by the
//              far modules: per cliff block, per stair flight, the whole chapel)
//   inkMix     how far key-line ink is lifted toward the air colour
// After some steps an atmosphere pass runs: ruled haze bands at the horizon and
// under the cumulus, aerial lift of the sea's ink toward the horizon, and a
// band of light between the headland and the sea/cloud behind it.
(function () {
  'use strict';
  const LW = window.LW, C = LW.C;

  const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const toHex = (r, g, b) => '#' + [r, g, b].map((v) => Math.round(LW.clamp(v, 0, 255)).toString(16).padStart(2, '0')).join('');
  const isHex = (c) => typeof c === 'string' && c.length === 7 && c[0] === '#';
  LW.mixHex = function (a, b, t) {
    if (!isHex(a) || !isHex(b) || t <= 0) return a;
    const A = hex(a), B = hex(b);
    return toHex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t);
  };

  // ---------------------------------------------------------------- air colours
  const AIR = {
    stone: '#bcbea7', // the limestone's distance tint: a mid warm grey with a breath of teal
    inkStone: '#9d978b', // far ink drifts toward this warm grey
    inkCloud: '#8f9893',
    haze: '#a9c6bb', // horizon haze
  };
  LW.AIR = AIR;
  LW.inkTo = AIR.inkStone;
  LW.hazeTo = AIR.stone;
  LW.hazeNormal = 0.6; // share of the haze that also dims the lights (0 keeps whites white)
  // haze a flat colour: darks lift toward the air colour ("lighten"), lights dim a little
  LW.hz = function (col) {
    const a = LW.hazeConst;
    if (!(a > 0) || !isHex(col) || col === C.sky) return col; // sky seen through openings stays sky
    const A = hex(col), T = hex(LW.hazeTo);
    const kn = LW.hazeNormal;
    const out = A.map((c, i) => {
      const lit = c + (Math.max(c, T[i]) - c) * a; // lighten
      return lit + (T[i] - lit) * a * kn; // and a little toward the air
    });
    return toHex(out[0], out[1], out[2]);
  };

  // depth amount of a point on the headland from its face height (0 = foot, 1 = summit)
  // (eased so the cliff's foot stays in the middle plane and the summit goes well back)
  LW.cliffDepth = (h) => Math.pow(LW.smooth(-5, 12.5, h), 1.25);

  // ---------------------------------------------------------------- profiles
  const sm = LW.smooth;
  const cliffS = (y) => sm(700, 3000, y); // 0 at the summit, 1 at the cliff's foot
  const PROFILES = {
    clouds: { wAt: () => 0.74, spAt: () => 1.1, inkTo: AIR.inkCloud },
    sea: { wAt: (x, y) => 0.5 + 0.55 * sm(LW.HORIZON, LW.HORIZON + 950, y), spAt: (x, y) => (y < LW.HORIZON + 300 ? 1.2 : 1.05), inkTo: '#4f8586' },
    cliff: {
      wAt: (x, y) => 0.6 + 0.34 * cliffS(y),
      spAt: (x, y) => 1.34 - 0.3 * cliffS(y),
      detAt: (x, y) => 0.25 + 0.7 * cliffS(y),
    },
    chapel: { wAt: () => 0.7, spAt: () => 1.2, detAt: () => 0.4, hazeConst: 0.28, inkMix: 0.26, hazeNormal: 0 },
    zigzag: {
      wAt: (x, y) => 0.62 + 0.3 * cliffS(y),
      spAt: (x, y) => 1.3 - 0.28 * cliffS(y),
      detAt: (x, y) => 0.3 + 0.65 * cliffS(y),
    },
    tree: { wAt: (x, y) => 1.05 + 0.08 * sm(1800, 3200, y) },
    near: { wAt: (x, y) => 1.07 + 0.15 * sm(2500, 3800, y) + 0.08 * sm(1700, 2100, x) },
    roots: { wAt: () => 1.1 },
    details: { wAt: (x, y) => (y < 1500 && x > 800 ? 0.8 : 1.08) },
  };
  LW.depthBegin = function (name) {
    const p = PROFILES[name] || {};
    LW.wAt = p.wAt || null;
    LW.spAt = p.spAt || null;
    LW.detAt = p.detAt || null;
    LW.hazeConst = p.hazeConst || 0;
    LW.inkMix = p.inkMix || 0;
    LW.inkTo = p.inkTo || AIR.inkStone;
    LW.hazeTo = p.hazeTo || AIR.stone;
    LW.hazeNormal = p.hazeNormal ?? 0.6;
  };
  LW.depthEnd = async function (name) {
    LW.wAt = LW.spAt = LW.detAt = null;
    LW.hazeConst = 0;
    LW.inkMix = 0;
    if (name === 'clouds') cloudAir();
    if (name === 'sea') { seaAir(); horizonHaze(); headlandHalo(); }
    if (name === 'near') nearWarmth();
  };

  // ---------------------------------------------------------------- raster helpers
  // a canvas holding `col` with alpha = f(x,y) (0..1) over bb, at resolution res
  function fieldCanvas(bb, res, col, f) {
    const w = Math.ceil((bb.x1 - bb.x0) * res), h = Math.ceil((bb.y1 - bb.y0) * res);
    const c = LW.canvas(w, h);
    const g = c.getContext('2d');
    const id = g.createImageData(w, h);
    const [r, gg, b] = hex(col);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const a = LW.clamp(f(bb.x0 + (i + 0.5) / res, bb.y0 + (j + 0.5) / res), 0, 1);
      const q = (j * w + i) * 4;
      id.data[q] = r; id.data[q + 1] = gg; id.data[q + 2] = b; id.data[q + 3] = a * 255;
    }
    g.putImageData(id, 0, 0);
    return c;
  }
  // lift existing key-line ink: recolour toward `col` by f*kCol, thin its density by f*kFade
  LW.inkLift = function (bb, f, col, kCol, kFade, res = 0.25, clip = null) {
    const fc = fieldCanvas(bb, res, col, f);
    const g = LW.ink;
    g.save();
    if (clip) g.clip(clip);
    g.imageSmoothingEnabled = true;
    g.globalCompositeOperation = 'source-atop';
    g.globalAlpha = kCol;
    g.drawImage(fc, bb.x0, bb.y0, bb.x1 - bb.x0, bb.y1 - bb.y0);
    if (kFade > 0) {
      g.globalCompositeOperation = 'destination-out';
      g.globalAlpha = kFade;
      g.drawImage(fc, bb.x0, bb.y0, bb.x1 - bb.x0, bb.y1 - bb.y0);
    }
    g.restore();
  };

  // ruled transition (the sky's idiom): horizontal lines of `col` whose width
  // shrinks from a full band at y0 to nothing at y1 (y1 may be above y0)
  function ruled(pen, y0, y1, sp, seed, x0 = -20, x1 = LW.W + 20) {
    const n = Math.max(1, Math.round(Math.abs(y1 - y0) / sp));
    const dir = Math.sign(y1 - y0);
    for (let k = 0; k < n; k++) {
      const y = y0 + dir * (k + 0.5) * sp;
      const t = (k + 0.5) / n;
      const w = sp * (1 - t) * 1.05;
      if (w < 0.35) continue;
      const pts = [];
      for (let x = x0; x <= x1; x += 24) pts.push([x, y + LW.noise3(x * 0.004 + seed, y * 0.05) * 1.6 * t]);
      pen.line(pts, w * (0.8 + 0.4 * (0.5 + 0.5 * LW.noise2(y * 0.1 + seed, 0.3))), 0);
    }
  }
  // a flat band [ya, yb] of col plus ruled tails above and below, onto ctx (alpha, op)
  function hazeBand(g, ya, yb, up, down, col, alpha, op, seed, sp = 4.5, x0 = -20, x1 = LW.W + 20) {
    const wAt = LW.wAt; LW.wAt = null;
    const pen = new LW.Pen();
    pen.poly([[x0, ya], [x1, ya], [x1, yb], [x0, yb]]);
    if (up) ruled(pen, ya, ya - up, sp, seed, x0, x1);
    if (down) ruled(pen, yb, yb + down, sp, seed + 7, x0, x1);
    g.save();
    g.globalCompositeOperation = op || 'source-over';
    pen.draw(g, col, alpha);
    g.restore();
    LW.wAt = wAt;
  }

  // ---------------------------------------------------------------- passes
  // the cumulus's base dissolves into the low air: its ink fades toward the base
  function cloudAir() {
    const HY = LW.HORIZON;
    LW.inkLift({ x0: -20, y0: 1500, x1: 1300, y1: HY + 10 }, (x, y) => 0.05 + 0.95 * Math.pow(sm(1550, HY - 40, y), 1.4), AIR.inkCloud, 0.9, 0.45);
  }

  // the sea: ink and tone drift toward the horizon's pale air
  function seaAir() {
    const HY = LW.HORIZON, W = LW.W, H = LW.H;
    // ink: ripples near the horizon go fine and grey-teal, full strength by the foreground
    LW.inkLift({ x0: -20, y0: HY - 60, x1: W + 20, y1: H + 10 }, (x, y) => (y < HY ? 1 : Math.pow(1 - sm(HY, HY + 760, y), 1.5)), '#6f9c98', 0.85, 0.5);
    // tone: stepped lifts toward the horizon (darker cat's-paws fade into the haze)
    const g = LW.fill;
    hazeBand(g, HY, HY + 70, 0, 120, '#6aa29f', 0.55, 'lighten', 11, 5);
    hazeBand(g, HY, HY + 260, 0, 200, '#5f9a99', 0.35, 'lighten', 12, 6);
    hazeBand(g, HY, HY + 480, 0, 240, '#4f8c8f', 0.22, 'lighten', 13, 7);
  }

  // a pale band of air on the horizon: dims the far bank, the island and the
  // cumulus base, with ruled transitions up into the sky and down onto the sea
  function horizonHaze() {
    const HY = LW.HORIZON, g = LW.fill;
    hazeBand(g, HY - 16, HY + 8, 150, 70, AIR.haze, 0.42, 'source-over', 21, 4.5);
    hazeBand(g, HY - 3, HY + 3, 30, 20, '#c9d8c8', 0.55, 'source-over', 22, 3);
    // the island and bank lose their ink almost entirely
    LW.inkLift({ x0: -20, y0: HY - 220, x1: LW.W + 20, y1: HY + 40 }, (x, y) => Math.pow(sm(HY - 220, HY - 10, y), 1.2) * (1 - sm(HY + 10, HY + 40, y)), AIR.haze, 0.6, 0.32);
  }

  // the near plane keeps its warmth (warm near / cool far) and sits a half-tone
  // lower than the white chapel, so the focal point stays the brightest shape
  function nearWarmth() {
    if (!LW.fgPath) return;
    const fg = new Path2D(); fg.addPath(LW.fgPath); if (LW.fgPathH) fg.addPath(LW.fgPathH);
    const g = LW.fill;
    g.save();
    g.clip(fg);
    if (LW.outcropPath) { const notOut = new Path2D(); notOut.rect(-100, -100, LW.W + 200, LW.H + 200); notOut.addPath(LW.outcropPath); g.clip(notOut, 'evenodd'); }
    g.globalCompositeOperation = 'multiply';
    g.globalAlpha = 0.6;
    g.fillStyle = '#f3e1bb';
    g.fillRect(0, 0, LW.W, LW.H);
    g.restore();
  }

  // a band of light between the headland and what lies behind it: the sea's and
  // the cloud's ink stops short of the silhouette, and the tone there lifts a step
  function headlandHalo() {
    const G = LW.cliffGeom();
    const corner = G.corner.filter((p) => p[1] > 1200 && p[1] < 3100);
    if (corner.length < 4) return;
    const band = (d0, d1) => {
      const a = corner.map(([x, y]) => [x + 6 - d0, y]);
      const b = corner.map(([x, y]) => [x + 6 - d1 - 6 * (0.5 + 0.5 * LW.noise(y * 0.008, d1 + 3)), y]);
      return LW.polyPath(a.concat(b.reverse()));
    };
    const HY = LW.HORIZON;
    const g = LW.fill, ink = LW.ink;
    const tone = band(0, 24);
    g.save(); g.clip(tone);
    g.globalAlpha = 0.22;
    g.fillStyle = AIR.haze; g.fillRect(0, HY - 4, LW.W, LW.H);
    g.fillStyle = '#ece7d2'; g.fillRect(0, 0, LW.W, HY - 4);
    g.restore();
    for (const [p, fade] of [[band(0, 16), 0.85], [band(16, 44), 0.45]]) {
      ink.save(); ink.clip(p);
      ink.globalCompositeOperation = 'destination-out';
      ink.globalAlpha = fade;
      ink.fillRect(0, 0, LW.W, LW.H);
      ink.restore();
    }
  }
})();
