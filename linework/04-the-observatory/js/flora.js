// The Observatory: wind-bent pines and twisted junipers, built from a tapered spine, bark
// lines that follow the wood, flat cloud-pads of foliage made of thousands of needle tufts.
'use strict';
(function () {
  const OB = window.OB;
  const { clamp, smooth, lerp, mix, css } = OB;

  const spineOf = (x, y, h, lean, R, segs = 26, twist = 0.18) => {
    const pts = [];
    let a = -Math.PI / 2 + lean * 0.15;
    const sl = h / segs;
    for (let i = 0; i <= segs; i++) {
      pts.push([x, y]);
      const t = i / segs;
      a += lean * 0.075 * (0.4 + t) + (R() - 0.5) * twist;
      a = Math.max(-Math.PI / 2 - 0.5, Math.min(-Math.PI / 2 + 1.3, a));
      x += Math.cos(a) * sl;
      y += Math.sin(a) * sl;
    }
    return pts;
  };

  // wood: tapered body with bark lines along it
  const drawWood = (ctx, pts, ws, o) => {
    const C = OB.C;
    const P = new Path2D();
    OB.ribbon(P, pts, ws);
    ctx.save();
    ctx.translate(OB.MR[0] * 0.6, OB.MR[1] * 0.6);
    ctx.fillStyle = css(o.fill);
    ctx.fill(P);
    ctx.restore();
    const n = pts.length;
    const nr = pts.map((p, i) => {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
      let nx = -(b[1] - a[1]), ny = b[0] - a[0];
      const l = Math.hypot(nx, ny) || 1;
      return [nx / l, ny / l];
    });
    // orient so +normal points right-ish (shadow side)
    const sgn = nr[n >> 1][0] >= 0 ? 1 : -1;
    const Bd = new Path2D(), Bl = new Path2D();
    const lines = o.lines || 9;
    for (let k = 0; k < lines; k++) {
      const f = -0.9 + (1.8 * (k + 0.5)) / lines;
      const sw = o.spiral || 0;
      const ln = pts.map((p, i) => {
        const ff = clamp(f + sw * Math.sin(i * 0.35 + k) * 0.3, -0.95, 0.95);
        return [p[0] + nr[i][0] * sgn * ws[i] * 0.5 * ff, p[1] + nr[i][1] * sgn * ws[i] * 0.5 * ff];
      });
      const lit = f < -0.35;
      OB.runs(lit ? Bl : Bd, ln, (i) => Math.max(0.5, ws[i] * 0.035 + 0.6) * (lit ? 0.9 : 1.2), (i) => OB.N(i * 0.11 + k * 3.7, k + o.seed) > (lit ? 0.0 : -0.45 + 0.4 * (1 - (f + 1) / 2)), 3);
    }
    // transverse bark plate cracks on the shadow side
    for (let i = 2; i < n - 2; i += 2) {
      if (OB.hash(i, o.seed) < 0.55) continue;
      const w = ws[i] * 0.5;
      const f0 = 0.1 + OB.hash(i + 9, o.seed) * 0.5;
      const a = [pts[i][0] + nr[i][0] * sgn * w * f0, pts[i][1] + nr[i][1] * sgn * w * f0];
      const b = [pts[i][0] + nr[i][0] * sgn * w * 0.95, pts[i][1] + nr[i][1] * sgn * w * 0.95];
      OB.ribbon(Bd, [a, b], [0.5, Math.max(0.8, w * 0.07)]);
    }
    ctx.fillStyle = css(C.ink);
    ctx.fill(Bd);
    ctx.fillStyle = css(o.hi, 0.85);
    ctx.fill(Bl);
    // outline, heavier on the shadow side
    const Lp = pts.map((p, i) => [p[0] - nr[i][0] * sgn * ws[i] * 0.5, p[1] - nr[i][1] * sgn * ws[i] * 0.5]);
    const Rp = pts.map((p, i) => [p[0] + nr[i][0] * sgn * ws[i] * 0.5, p[1] + nr[i][1] * sgn * ws[i] * 0.5]);
    const Po = new Path2D();
    OB.ink(Po, Lp, o.olw * 0.7, { t0: 0, t1: 0.1, wn: 0.4, ph: o.seed });
    OB.ink(Po, Rp, o.olw * 1.4, { t0: 0, t1: 0.1, wn: 0.4, ph: o.seed + 1 });
    ctx.fillStyle = css(C.ink);
    ctx.fill(Po);
  };

  // a cloud-pad of needles
  const drawPad = (ctx, pad, o, R) => {
    const C = OB.C;
    const { x, y, w, h } = pad;
    const circles = [];
    const nc = Math.max(3, Math.round(w / (h * 0.7)));
    for (let i = 0; i < nc; i++) {
      const t = nc === 1 ? 0.5 : i / (nc - 1);
      const cx = x - w / 2 + w * t + (R() - 0.5) * h * 0.3;
      const arch = -Math.sin(t * Math.PI) * h * 0.25;
      const r = h * (0.45 + 0.35 * Math.sin(t * Math.PI) + R() * 0.2);
      circles.push([cx, y + arch + (R() - 0.5) * h * 0.2, r]);
    }
    const inside = (px, py) => {
      if (py > y + h * (0.42 - 0.18 * ((px - x) / w) ** 2)) return false;
      for (const c of circles) if ((px - c[0]) ** 2 + (py - c[1]) ** 2 < c[2] * c[2]) return true;
      return false;
    };
    const shape = new Path2D();
    for (const c of circles) { shape.moveTo(c[0] + c[2], c[1]); shape.arc(c[0], c[1], c[2], 0, OB.TAU); }
    // lumpy underside, never a ruled line
    const clipBottom = new Path2D();
    clipBottom.moveTo(x - w, y - h * 3);
    clipBottom.lineTo(x + w, y - h * 3);
    for (let px = x + w; px >= x - w; px -= 4) {
      const t = (px - x) / w;
      const lump = h * (0.42 - 0.18 * t * t + 0.07 * OB.N(px * 0.05, y * 0.01) + 0.05 * Math.abs(Math.sin(px * 0.045 + y)));
      clipBottom.lineTo(px, y + lump);
    }
    clipBottom.closePath();
    ctx.save();
    ctx.clip(clipBottom);
    ctx.save();
    ctx.translate(OB.MR[0], OB.MR[1]);
    ctx.fillStyle = css(o.padFill);
    ctx.fill(shape);
    ctx.restore();
    // underside shadow band: dense curved lines
    ctx.save();
    ctx.clip(shape);
    const bb = [x - w, y - h * 1.5, x + w, y + h * 0.5];
    OB.engrave(ctx, { bbox: bb, angle: 0.06 * o.wind, sp: Math.max(1.8, h * 0.035), D: (px, py) => smooth(y - h * 0.55, y + h * 0.35, py) * 1.1 + 0.1, w: Math.max(0.9, h * 0.022), levels: 4, col: css(C.ink), wob: 0.8, seed: Math.floor(x + y), warp: (u) => -Math.abs(Math.sin(u / (h * 0.7))) * h * 0.12 });
    ctx.restore();
    ctx.restore();
    // needle tufts
    const s = o.needle;
    const dark = new Path2D(), mid = new Path2D(), light = new Path2D();
    const step = s * 0.55;
    for (let py = y - h * 1.3; py < y + h * 0.5; py += step) {
      for (let px = x - w * 0.75; px < x + w * 0.75; px += step) {
        const qx = px + (R() - 0.5) * step, qy = py + (R() - 0.5) * step;
        if (!inside(qx, qy)) continue;
        // vertical position within the pad -> light at top, dark beneath
        let top = qy;
        for (let t = 0; t < 4; t++) { if (inside(qx, top - s * 0.6)) top -= s * 0.6; else break; }
        const depth = (qy - top) / (h * 0.6);
        const tgt = depth < 0.35 && R() < 0.85 - depth ? light : depth < 0.9 && R() < 0.55 ? mid : dark;
        const nn = 7 + Math.floor(R() * 7);
        const out = Math.atan2((qy - y) * 1.8 - h * 0.6, qx - x) * 0.35 + (-Math.PI / 2) * 0.65 + o.wind * 0.35;
        for (let k = 0; k < nn; k++) {
          const a = out + (k / (nn - 1) - 0.5) * 2.0 + (R() - 0.5) * 0.2;
          const L = s * (0.6 + 0.55 * R());
          const bx = qx + Math.cos(a) * L * 0.08, by = qy + Math.sin(a) * L * 0.08;
          tgt.moveTo(bx, by);
          tgt.quadraticCurveTo(qx + Math.cos(a - 0.12 * o.wind) * L * 0.6, qy + Math.sin(a - 0.12 * o.wind) * L * 0.6, qx + Math.cos(a) * L, qy + Math.sin(a) * L);
        }
      }
    }
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(0.8, s * 0.06);
    ctx.strokeStyle = css(C.ink);
    ctx.stroke(dark);
    ctx.strokeStyle = css(o.midCol);
    ctx.stroke(mid);
    ctx.lineWidth = Math.max(0.7, s * 0.055);
    ctx.strokeStyle = css(o.hiCol);
    ctx.stroke(light);
    // a few dark twigs showing beneath the pad
    const tw = new Path2D();
    for (let k = 0; k < 4; k++) {
      const tx = x + (R() - 0.5) * w * 0.7;
      OB.ink(tw, [[pad.bx || x, pad.by || y + h * 0.3], [tx, y + h * 0.2 + R() * h * 0.2]], Math.max(1, h * 0.03), { t0: 0, t1: 0.6 });
    }
    ctx.fillStyle = css(C.ink);
    ctx.fill(tw);
  };

  OB.drawPine = (ctx, S, t) => {
    const C = OB.C, R = OB.rng(t.seed);
    const spine = OB.resample(OB.chaikin(t.spine || spineOf(t.x, t.y, t.h, t.lean, R), 2, false), Math.max(3, t.h / 120), false);
    const n = spine.length;
    const w0 = t.h * (t.thick || 0.05);
    const ws = spine.map((p, i) => w0 * (1 - 0.82 * Math.pow(i / (n - 1), 0.8)) * (1 + 0.08 * OB.N(i * 0.2, t.seed)) * (i < 3 ? 1.25 - i * 0.08 : 1));
    const pads = [];
    const branches = [];
    // branches, mostly streaming downwind: droop from the trunk, kink, then lift at the tips
    const nb = t.branches || 7;
    for (let b = 0; b < nb; b++) {
      const f = 0.3 + (0.64 * (b + 0.2 + R() * 0.6)) / nb;
      const i0 = Math.min(n - 2, Math.floor(f * n));
      const p0 = spine[i0];
      const up = R() < 0.22;
      const dirx = up ? -Math.sign(t.lean) : Math.sign(t.lean);
      const len = t.h * (up ? 0.1 + 0.06 * R() : 0.16 + 0.2 * Math.sin(Math.min(1, f * 1.1) * Math.PI) * (0.6 + 0.6 * R())) * (t.spread || 1);
      const pts = [p0];
      let a = Math.atan2(0.15 + R() * 0.35, dirx);
      let x = p0[0], y = p0[1];
      const segs = 12;
      const k1 = 2 + Math.floor(R() * 3), k2 = 6 + Math.floor(R() * 3);
      for (let k = 0; k < segs; k++) {
        if (k === k1) a += (R() - 0.5) * 1.1;
        if (k === k2) a -= dirx * (0.35 + R() * 0.4);
        a += (R() - 0.5) * 0.18 - (k > segs * 0.6 ? dirx * 0.08 : 0);
        x += (Math.cos(a) * len) / segs;
        y += (Math.sin(a) * len) / segs;
        pts.push([x, y]);
      }
      const bw = ws[i0] * (0.5 + 0.15 * R());
      branches.push({ pts, w: bw });
      const ph = t.h * (0.06 + 0.03 * R()) * (t.padScale || 1);
      pads.push({ x: x + dirx * ph * 0.5, y: y - ph * 0.35, w: ph * (2.6 + R() * 1.6), h: ph, bx: x, by: y });
      if (len > t.h * 0.18 && R() < 0.85) {
        const q = pts[k2];
        pads.push({ x: q[0] + dirx * ph * 0.2, y: q[1] - ph * 0.5, w: ph * (1.8 + R()), h: ph * 0.8, bx: q[0], by: q[1] });
      }
      // a short side twig with its own small pad
      if (!up && R() < 0.6) {
        const q = pts[k1 + 1];
        const tw = [q];
        let tx = q[0], ty = q[1], ta = a - dirx * 0.9;
        for (let k = 0; k < 5; k++) { ta += (R() - 0.5) * 0.3; tx += (Math.cos(ta) * len * 0.3) / 5; ty += (Math.sin(ta) * len * 0.3) / 5 - 2; tw.push([tx, ty]); }
        branches.push({ pts: tw, w: bw * 0.45 });
        pads.push({ x: tx, y: ty - ph * 0.3, w: ph * (1.5 + R() * 0.8), h: ph * 0.7, bx: tx, by: ty });
      }
    }
    // crown pad
    const tip = spine[n - 1];
    const cph = t.h * 0.065 * (t.padScale || 1);
    pads.push({ x: tip[0] + Math.sign(t.lean) * cph * 0.8, y: tip[1] + cph * 0.1, w: cph * 3.6, h: cph * 1.1, bx: tip[0], by: tip[1] });
    // draw: back pads (upwind/higher) first, then wood, then pads in front
    pads.sort((a, b) => a.y - b.y);
    const opts = { padFill: t.padFill || C.pineFill, midCol: t.midCol || C.pineMid, hiCol: t.hiCol || C.pineHi, needle: t.needle || t.h * 0.018, wind: Math.sign(t.lean) };
    const back = pads.filter((p, i) => i % 3 === 0), front = pads.filter((p, i) => i % 3 !== 0);
    for (const p of back) drawPad(ctx, p, opts, R);
    for (const br of branches) {
      const bws = br.pts.map((p, i) => br.w * (1 - 0.75 * (i / (br.pts.length - 1))));
      drawWood(ctx, br.pts, bws, { fill: t.wood || C.bark, hi: t.woodHi || C.barkHi, olw: Math.max(1.2, br.w * 0.12), lines: 4, seed: t.seed + br.pts.length });
    }
    drawWood(ctx, spine, ws, { fill: t.wood || C.bark, hi: t.woodHi || C.barkHi, olw: Math.max(1.6, w0 * 0.07), lines: t.barkLines || 11, seed: t.seed, spiral: t.spiral || 0 });
    for (const p of front) drawPad(ctx, p, opts, R);
    // roots gripping the rock
    if (t.roots) {
      const P = new Path2D();
      for (let k = 0; k < t.roots; k++) {
        const dir = (k / (t.roots - 1) - 0.5) * 2.6;
        const pts = [[t.x + dir * w0 * 0.2, t.y - w0 * 0.2]];
        let x = pts[0][0], y = pts[0][1], a = Math.PI / 2 - dir * 0.55;
        for (let s = 0; s < 8; s++) { a += (R() - 0.5) * 0.4; x += Math.cos(a) * w0 * 0.22; y += Math.sin(a) * w0 * 0.12 + 1; pts.push([x, y]); }
        OB.ribbon(P, pts, pts.map((p, i) => w0 * 0.28 * (1 - i / pts.length)));
      }
      ctx.fillStyle = css(t.wood || C.bark);
      ctx.fill(P);
      ctx.lineWidth = 1.6;
      ctx.strokeStyle = css(C.ink);
      ctx.stroke(P);
    }
  };

  // juniper: twisted silver deadwood strands and dense scale-leaf clumps
  OB.drawJuniper = (ctx, S, t) => {
    const C = OB.C;
    OB.drawPine(ctx, S, Object.assign({}, t, {
      wood: C.juniperWood, woodHi: C.juniperHi, padFill: C.junFill, midCol: C.junMid, hiCol: C.junHi,
      needle: t.h * 0.03, thick: 0.085, branches: t.branches || 6, spread: 0.8, padScale: 1.25, spiral: 1, barkLines: 9,
    }));
  };
})();
