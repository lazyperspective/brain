// The Observatory: wind-flagged pines and junipers. A gnarled tapered trunk with bark lines,
// limbs streaming to the leeward side, foliage as clusters of radiating needle tufts with sky
// showing between them, and silver dead snags.
'use strict';
(function () {
  const OB = window.OB;
  const { clamp, smooth, lerp, mix, css } = OB;

  // wood: tapered body with bark lines that follow it
  const drawWood = (ctx, pts, ws, o) => {
    const C = OB.C;
    const n = pts.length;
    if (n < 2) return;
    const P = new Path2D();
    OB.ribbon(P, pts, ws);
    ctx.save();
    ctx.translate(OB.MR[0] * 0.6, OB.MR[1] * 0.6);
    ctx.fillStyle = css(o.fill);
    ctx.fill(P);
    ctx.restore();
    const nr = pts.map((p, i) => {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
      let nx = -(b[1] - a[1]), ny = b[0] - a[0];
      const l = Math.hypot(nx, ny) || 1;
      return [nx / l, ny / l];
    });
    // +normal toward the lower-right (shadow side)
    const sgn = nr[n >> 1][0] + nr[n >> 1][1] >= 0 ? 1 : -1;
    const Bd = new Path2D(), Bl = new Path2D();
    const lines = o.lines || 9;
    for (let k = 0; k < lines; k++) {
      const f = -0.9 + (1.8 * (k + 0.5)) / lines;
      const ln = pts.map((p, i) => {
        const ff = clamp(f + (o.spiral || 0) * 0.28 * Math.sin(i * 0.3 + k * 0.9), -0.95, 0.95);
        return [p[0] + nr[i][0] * sgn * ws[i] * 0.5 * ff, p[1] + nr[i][1] * sgn * ws[i] * 0.5 * ff];
      });
      const lit = f < -0.3;
      OB.runs(lit ? Bl : Bd, ln, (i) => Math.max(0.5, ws[i] * 0.03 + 0.55) * (lit ? 0.9 : 1.2), (i) => OB.N(i * 0.11 + k * 3.7, k + o.seed) > (lit ? 0.05 : -0.5 + 0.45 * (1 - (f + 1) / 2)), 3);
    }
    // bark plates: short transverse fissures between the long lines, a few pale plate edges
    {
      const step = Math.max(1, Math.round(4 / (OB.dist(pts[0], pts[Math.min(n - 1, 1)]) || 4)));
      for (let i = 1; i < n - 1; i += step) {
        const w = ws[i] * 0.5;
        if (w < 3) continue;
        const nf = Math.max(1, Math.round(w / 5));
        for (let k = 0; k < nf; k++) {
          if (OB.hash(i * 7 + k, o.seed + 11) < 0.45) continue;
          const f = -0.85 + 1.7 * OB.hash(i + k * 13, o.seed + 5);
          const lit = f < -0.35;
          const g = 0.1 + 0.12 * OB.hash(k, i);
          const t = Math.min(n - 1, i + 1);
          const a = [pts[i][0] + nr[i][0] * sgn * w * f, pts[i][1] + nr[i][1] * sgn * w * f];
          const b = [pts[t][0] + nr[t][0] * sgn * w * Math.min(0.95, f + g), pts[t][1] + nr[t][1] * sgn * w * Math.min(0.95, f + g)];
          OB.ribbon(lit ? Bl : Bd, [a, b], [Math.max(0.5, w * 0.03 + 0.3), 0.2]);
        }
      }
    }
    // knots on old and dead wood
    if (o.knots) {
      for (let i = 4; i < n - 4; i += 3) {
        if (OB.hash(i, o.seed + 21) > o.knots) continue;
        const w = ws[i] * 0.5;
        if (w < 2.5) continue;
        const f = (OB.hash(i, o.seed + 22) - 0.5) * 1.2;
        const c = [pts[i][0] + nr[i][0] * sgn * w * f, pts[i][1] + nr[i][1] * sgn * w * f];
        const ang = Math.atan2(pts[i + 1][1] - pts[i - 1][1], pts[i + 1][0] - pts[i - 1][0]);
        const kr = Math.min(w * 0.3, 9);
        Bd.moveTo(c[0] + Math.cos(ang) * kr, c[1] + Math.sin(ang) * kr);
        Bd.ellipse(c[0], c[1], kr, kr * 0.45, ang, 0, OB.TAU);
        Bd.moveTo(c[0] + Math.cos(ang) * kr * 1.7, c[1] + Math.sin(ang) * kr * 1.7);
        Bd.ellipse(c[0], c[1], kr * 1.7, kr * 0.85, ang, 0, OB.TAU);
        Bd.ellipse(c[0], c[1], kr * 1.45, kr * 0.68, ang, OB.TAU, 0, true);
      }
    }
    for (let i = 2; i < n - 2; i += 2) {
      if (OB.hash(i, o.seed) < 0.5) continue;
      const w = ws[i] * 0.5;
      const f0 = 0.05 + OB.hash(i + 9, o.seed) * 0.5;
      const a = [pts[i][0] + nr[i][0] * sgn * w * f0, pts[i][1] + nr[i][1] * sgn * w * f0];
      const b = [pts[i][0] + nr[i][0] * sgn * w * 0.95, pts[i][1] + nr[i][1] * sgn * w * 0.95];
      OB.ribbon(Bd, [a, b], [0.5, Math.max(0.8, w * 0.08)]);
    }
    ctx.fillStyle = css(C.ink);
    ctx.fill(Bd);
    ctx.fillStyle = css(o.hi, 0.85);
    ctx.fill(Bl);
    const Lp = pts.map((p, i) => [p[0] - nr[i][0] * sgn * ws[i] * 0.5, p[1] - nr[i][1] * sgn * ws[i] * 0.5]);
    const Rp = pts.map((p, i) => [p[0] + nr[i][0] * sgn * ws[i] * 0.5, p[1] + nr[i][1] * sgn * ws[i] * 0.5]);
    const Po = new Path2D();
    OB.ink(Po, Lp, o.olw * 0.7, { t0: 0, t1: 0.1, wn: 0.4, ph: o.seed });
    OB.ink(Po, Rp, o.olw * 1.4, { t0: 0, t1: 0.1, wn: 0.4, ph: o.seed + 1 });
    ctx.fillStyle = css(C.ink);
    ctx.fill(Po);
  };

  // a cluster of needle tufts: a small dark core, then fans of short radiating strokes,
  // darker beneath and catching sky-light on top
  const cluster = (L, c, o, R) => {
    const { x, y, r } = c;
    const core = L.core;
    const nb = 3 + Math.floor(R() * 3);
    for (let k = 0; k < nb; k++) {
      const bx = x + (R() - 0.5) * r * 1.2 * (1 + 0.5 * o.wind), by = y + r * 0.15 + (R() - 0.5) * r * 0.35;
      const br = r * (0.2 + 0.18 * R());
      core.moveTo(bx + br, by);
      core.ellipse(bx, by, br * 1.3, br * 0.75, (R() - 0.5) * 0.6, 0, OB.TAU);
      // needle texture inside the pad, so the mass is never a flat fill
      const ns = 5 + Math.floor(R() * 6);
      for (let q = 0; q < ns; q++) {
        const a = R() * OB.TAU, rr = Math.sqrt(R());
        const sx = bx + Math.cos(a) * br * 1.1 * rr, sy = by + Math.sin(a) * br * 0.6 * rr;
        const na = -Math.PI / 2 + o.wind * 0.4 + (R() - 0.5) * 2.4, nl = br * (0.35 + 0.4 * R());
        const tgt = sy < by ? L.mid : L.dark;
        tgt.moveTo(sx, sy);
        tgt.lineTo(sx + Math.cos(na) * nl, sy + Math.sin(na) * nl * 0.7);
      }
      if (L.cones && R() < (o.cones || 0)) L.cones.push([bx + (R() - 0.5) * br, by + br * 0.7, r * 0.16]);
    }
    const nt = 5 + Math.floor(R() * 6);
    const tufts = [];
    for (let k = 0; k < nt; k++) {
      const a = R() * OB.TAU, rr = Math.sqrt(R());
      tufts.push([x + Math.cos(a) * r * 1.25 * rr + o.wind * r * 0.25, y + Math.sin(a) * r * 0.6 * rr]);
    }
    tufts.sort((a, b) => b[1] - a[1]);
    for (const [tx, ty] of tufts) {
      const rel = (ty - (y - r * 0.6)) / (r * 1.2);
      const tgt = rel > 0.6 ? L.dark : rel > 0.3 ? (R() < 0.6 ? L.mid : L.dark) : R() < 0.75 ? L.light : L.mid;
      const nn = 12 + Math.floor(R() * 9);
      const base = -Math.PI / 2 + o.wind * 0.35;
      for (let k = 0; k < nn; k++) {
        const a = base + (k / (nn - 1) - 0.5) * 4.4 + (R() - 0.5) * 0.18;
        const up = Math.max(0, -Math.sin(a));
        const len = o.needle * (0.45 + 0.35 * R() + 0.35 * up);
        const a2 = a + o.wind * 0.12 * (1 - up);
        tgt.moveTo(tx + Math.cos(a) * len * 0.12, ty + Math.sin(a) * len * 0.12);
        tgt.quadraticCurveTo(tx + Math.cos(a) * len * 0.6, ty + Math.sin(a) * len * 0.6, tx + Math.cos(a2) * len, ty + Math.sin(a2) * len);
      }
    }
  };

  OB.drawFlagPine = (ctx, S, t) => {
    const C = OB.C, R = OB.rng(t.seed);
    const wind = t.wind || 1;
    // spine
    let ctrl = t.spine;
    if (!ctrl) {
      ctrl = [];
      let x = t.x, y = t.y, a = -Math.PI / 2 + (R() - 0.5) * 0.2;
      const segs = 8;
      for (let i = 0; i <= segs; i++) {
        ctrl.push([x, y]);
        const f = i / segs;
        a += wind * t.lean * 0.16 * (0.3 + f) + (R() - 0.5) * 0.35;
        a = clamp(a, -Math.PI / 2 - 0.6, -Math.PI / 2 + 1.25);
        x += (Math.cos(a) * t.h) / segs;
        y += (Math.sin(a) * t.h) / segs;
      }
    }
    const spine = OB.resample(OB.chaikin(ctrl, t.smooth || 3, false), Math.max(2.5, t.h / 140), false);
    const n = spine.length;
    const w0 = t.h * (t.thick || 0.06);
    const ws = spine.map((p, i) => {
      const f = i / (n - 1);
      return w0 * (1 - (t.taper || 0.8) * Math.pow(f, 0.9)) * (1 + 0.14 * OB.N(i * 0.15, t.seed)) * (f < 0.06 ? 1.35 - f * 5 : 1);
    });
    const woodOpt = (dead, w) => ({ fill: dead ? C.snag : t.wood || C.bark, hi: dead ? C.snagHi : t.woodHi || C.barkHi, olw: Math.max(1.1, w * 0.1), lines: dead ? 8 : 4, seed: t.seed + Math.round(w * 10), spiral: dead ? 1 : 0.3, knots: dead ? 0.25 : 0 });
    const limbs = [], clusters = [];
    const nl = t.limbs || 7;
    const needle = t.needle || t.h * 0.022;
    for (let b = 0; b < nl; b++) {
      const f = (t.f0 || 0.32) + ((1 - (t.f0 || 0.32)) * (b + 0.25 + R() * 0.5)) / nl;
      const i0 = Math.min(n - 2, Math.floor(f * (n - 1)));
      const p0 = spine[i0];
      const lee = R() > (t.upwind || 0.12);
      const dead = R() < (t.dead || 0.16);
      const dir = lee ? wind : -wind;
      // the flag: lower/mid limbs longest, streaming leeward
      const env = Math.sin(Math.min(1, (f - 0.15) * 1.25) * Math.PI) * 0.6 + 0.4;
      const len = t.h * (lee ? (0.18 + 0.28 * env) * (0.7 + 0.5 * R()) : 0.06 + 0.07 * R()) * (t.spread || 1);
      let a = Math.atan2(0.12 + R() * 0.3, dir);
      let x = p0[0], y = p0[1];
      const pts = [[x, y]];
      const segs = 14, kink = 3 + Math.floor(R() * 5);
      for (let k = 0; k < segs; k++) {
        if (k === kink) a += (R() - 0.5) * 1.0;
        a += (R() - 0.5) * 0.22 - (k > segs * 0.55 ? dir * 0.07 : 0);
        x += (Math.cos(a) * len) / segs;
        y += (Math.sin(a) * len) / segs;
        pts.push([x, y]);
      }
      const bw = Math.max(1.5, ws[i0] * (0.42 + 0.15 * R()));
      limbs.push({ pts, w: bw, dead });
      if (dead) {
        // broken twigs
        for (let k = 0; k < 3; k++) {
          const q = pts[4 + Math.floor(R() * (segs - 5))];
          const ta = a - dir * (0.6 + R() * 0.8) - 0.5;
          const tl = len * (0.08 + 0.12 * R());
          limbs.push({ pts: [q, [q[0] + Math.cos(ta) * tl * 0.5, q[1] + Math.sin(ta) * tl * 0.5], [q[0] + Math.cos(ta - 0.2) * tl, q[1] + Math.sin(ta - 0.2) * tl]], w: bw * 0.3, dead: true });
        }
        continue;
      }
      // twigs rising from the limb, each tipped with a needle cluster; gaps left between
      const ntw = 2 + Math.floor(len / (needle * (t.twigGap || 3.2)));
      for (let k = 0; k < ntw; k++) {
        const j = Math.min(segs, 3 + Math.floor(((segs - 3) * (k + 0.5 + (R() - 0.5) * 0.6)) / ntw));
        const q = pts[j];
        const ta = -Math.PI / 2 + dir * (0.5 + R() * 0.6) + (R() - 0.5) * 0.4;
        const tl = needle * (0.6 + R() * 1.1);
        const tip = [q[0] + Math.cos(ta) * tl, q[1] + Math.sin(ta) * tl];
        limbs.push({ pts: [q, [(q[0] + tip[0]) / 2 + (R() - 0.5) * 3, (q[1] + tip[1]) / 2], tip], w: bw * 0.35, dead: false, twig: true });
        if (R() < 0.88) clusters.push({ x: tip[0], y: tip[1], r: needle * (0.9 + 0.7 * R()) * (t.clusterScale || 1) });
      }
      clusters.push({ x: x + dir * needle * 0.3, y: y - needle * 0.2, r: needle * (1.2 + 0.6 * R()) * (t.clusterScale || 1) });
    }
    // leader: a living crown cluster or a silver dead spike
    const tip = spine[n - 1];
    if (t.deadTop) {
      const L = t.h * 0.22;
      const a0 = -Math.PI / 2 - wind * 0.15;
      limbs.push({ pts: [spine[n - 6] || tip, tip, [tip[0] + Math.cos(a0) * L * 0.5, tip[1] + Math.sin(a0) * L * 0.5], [tip[0] + Math.cos(a0 + 0.1) * L, tip[1] + Math.sin(a0 + 0.1) * L]], w: ws[n - 1] * 1.4, dead: true });
    } else clusters.push({ x: tip[0] + wind * needle * 0.6, y: tip[1] - needle * 0.2, r: needle * 1.6 * (t.clusterScale || 1) });

    // draw: limbs behind, trunk, then foliage
    for (const L of limbs) {
      const lws = L.pts.map((p, i) => L.w * (1 - 0.8 * (i / (L.pts.length - 1))));
      if (L.twig) {
        const P = new Path2D();
        OB.ribbon(P, L.pts, lws);
        ctx.fillStyle = css(C.ink);
        ctx.fill(P);
      } else {
        const sm = OB.resample(OB.chaikin(L.pts, 2, false), 3, false);
        drawWood(ctx, sm, sm.map((p, i) => L.w * (1 - 0.82 * (i / (sm.length - 1)))), woodOpt(L.dead, L.w));
      }
    }
    drawWood(ctx, spine, ws, { fill: t.wood || C.bark, hi: t.woodHi || C.barkHi, olw: Math.max(1.6, w0 * 0.07), lines: (t.barkLines || 11) + (t.dead === 1 ? 6 : 0), seed: t.seed, spiral: t.spiral || 0.3, knots: t.dead === 1 ? 0.3 : 0.06 });
    if (t.roots) {
      const P = new Path2D();
      for (let k = 0; k < t.roots; k++) {
        const d = (k / (t.roots - 1) - 0.5) * 2.4;
        const pts = [[t.x + d * w0 * 0.25, t.y - w0 * 0.3]];
        let x = pts[0][0], y = pts[0][1], a = Math.PI / 2 - d * 0.6;
        for (let s = 0; s < 9; s++) { a += (R() - 0.5) * 0.45; x += Math.cos(a) * w0 * 0.24; y += Math.sin(a) * w0 * 0.12 + 1; pts.push([x, y]); }
        OB.ribbon(P, pts, pts.map((p, i) => w0 * 0.3 * (1 - i / pts.length)));
      }
      ctx.fillStyle = css(t.wood || C.bark);
      ctx.fill(P);
      ctx.lineWidth = 1.8;
      ctx.strokeStyle = css(C.ink);
      ctx.stroke(P);
    }
    clusters.sort((a, b) => a.y - b.y);
    const opts = { wind, needle, cones: t.cones === undefined ? 0.05 : t.cones };
    const cones = [];
    // foliage in a few passes so clusters overlap naturally
    const chunk = 6;
    for (let i = 0; i < clusters.length; i += chunk) {
      const L = { core: new Path2D(), dark: new Path2D(), mid: new Path2D(), light: new Path2D(), cones };
      for (const c of clusters.slice(i, i + chunk)) cluster(L, c, opts, R);
      ctx.fillStyle = css(t.padFill || C.pineFill);
      ctx.fill(L.core);
      ctx.lineCap = 'round';
      ctx.lineWidth = Math.max(0.75, needle * 0.065);
      ctx.strokeStyle = css(C.ink);
      ctx.stroke(L.dark);
      ctx.strokeStyle = css(t.midCol || C.pineMid);
      ctx.stroke(L.mid);
      ctx.lineWidth = Math.max(0.7, needle * 0.055);
      ctx.strokeStyle = css(t.hiCol || C.pineHi);
      ctx.stroke(L.light);
    }
    // cones hanging under the foliage: dark ovals with pale scale ticks
    if (cones.length) {
      const Pc = new Path2D(), Ps = new Path2D();
      for (const [x, y, r] of cones) {
        const rr = Math.max(2.2, r);
        Pc.moveTo(x + rr * 0.6, y);
        Pc.ellipse(x, y, rr * 0.6, rr, 0.25, 0, OB.TAU);
        for (let k = -1; k <= 1; k++) OB.ribbon(Ps, [[x - rr * 0.4, y + k * rr * 0.45 - rr * 0.1], [x, y + k * rr * 0.45 + rr * 0.12], [x + rr * 0.4, y + k * rr * 0.45 - rr * 0.1]], [0.3, Math.max(0.5, rr * 0.12), 0.3]);
      }
      ctx.fillStyle = css(C.bark);
      ctx.fill(Pc);
      ctx.lineWidth = 1;
      ctx.strokeStyle = css(C.ink);
      ctx.stroke(Pc);
      ctx.fillStyle = css(C.barkHi, 0.75);
      ctx.fill(Ps);
    }
  };

  OB.drawPine = OB.drawFlagPine;
  OB.drawJuniper = (ctx, S, t) => {
    const C = OB.C;
    OB.drawFlagPine(ctx, S, Object.assign({
      wood: C.juniperWood, woodHi: C.juniperHi, padFill: C.junFill, midCol: C.junMid, hiCol: C.junHi,
      thick: 0.1, limbs: 6, spread: 0.9, spiral: 1, barkLines: 9, dead: 0.25, needle: t.h * 0.03, clusterScale: 1.1, cones: 0,
    }, t));
  };
})();
