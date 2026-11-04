// chapel.js - the whitewashed hermitage on the summit: retaining terrace, the
// final flight climbing into the cliff, facade with arched door, bell-cote with a
// bronze bell, shaded side wall with tile eaves, weathering and plaster losses.
(function () {
  'use strict';
  const LW = window.LW, C = LW.C, V = LW.V;
  const WHITE = '#f4ecd2', WHITE_SH = '#ddd0ad', WHITE_DEEP = '#c4b48a';

  LW.drawChapel = async function () {
    const S = LW.scene, ch = S.chapel, fl = S.final;
    const rnd = LW.rng('chapel');
    const AB = (u, h, dd) => S.faceP(u, h, dd + S.LEAN * (h - fl.h0)); // vertical planes anchored at the landing
    // the chapel is turned to face the sea (left-front); its right flank is in shadow
    const Fn = V.norm([-0.5, 0, -0.86]); // facade normal
    const Ax = [-Fn[2], 0, Fn[0]]; // along the facade, to the right
    const Pc = S.face(ch.uc, ch.h, ch.d + S.LEAN * (ch.h - fl.h0));
    const W3 = (u, h, dd = 0) => V.add(V.add(V.add(Pc, V.mul(Ax, u - ch.uc)), [0, h - ch.h, 0]), V.mul(Fn, dd));
    const P = (u, h, dd = 0) => LW.proj(W3(u, h, dd));
    const h0 = ch.h, hE = ch.h + ch.wallH, hA = hE + ch.gableH;
    const uc = ch.uc;
    const ink = LW.ink;
    let pen = new LW.Pen();
    // ---------------------------------------------------------- terrace retaining wall (d = dEnd)
    const dT = fl.dEnd;
    const TP = (u, h) => AB(u, h, dT);
    const tw = (a, b) => [[a, S.summitH], [b, S.summitH], [b, fl.h0 - 0.5 + 0.2 * LW.noise(b, 3)], [(a + b) / 2, fl.h0 - 0.8], [a, fl.h0 - 0.4]];
    const shade = (top) => (u, h) => 0.18 + 0.5 * LW.clamp((top - h) / 1.8, 0, 1);
    LW.masonry(TP, tw(5.0, fl.u0 - 0.25), { rnd, course: [0.24, 0.42], len: [0.3, 0.9], sp: 4.0, chisel: 0.5, roundness: 0.12, joint: 0.018, mortar: '#b09668', jitter: 0.2, dark: shade(S.summitH) });
    LW.masonry(TP, tw(fl.u1 + 0.25, 13.8), { rnd, course: [0.24, 0.42], len: [0.3, 0.9], sp: 4.0, chisel: 0.5, roundness: 0.12, joint: 0.018, mortar: '#b09668', jitter: 0.2, dark: shade(S.summitH) });

    // ---------------------------------------------------------- final flight into the cliff
    {
      const R = S.RISE;
      // left cheek wall face (facing left/front) - visible
      const cw = null;
      for (let i = fl.n - 1; i >= 0; i--) {
        const dd = -i * fl.go, h = fl.h0 + i * R;
        const q = [AB(fl.u0, h, dd), AB(fl.u1, h, dd), AB(fl.u1, h + R, dd), AB(fl.u0, h + R, dd)];
        LW.shadeQuad(q, { fill: '#efe4c2', angle: 0, sp: 3.2, dark: (x, y) => 0.25 + 0.4 * LW.clamp((y - q[3][1]) / 12, 0, 1), ow: 1.4, seed: i });
      }
      void cw;
    }

    // ---------------------------------------------------------- chapel side wall (in shadow)
    const D = ch.depth;
    const sideQ0 = [P(ch.u1, h0, 0), P(ch.u1, h0, -D), P(ch.u1, hE, -D), P(ch.u1, hE, 0)];
    // the far end of the flank sinks behind the summit rock: cut its base level with the front corner
    const cutY = sideQ0[0][1] + 25;
    const sideQ = sideQ0;
    const cutClip = new Path2D();
    cutClip.rect(-100, -100, LW.W + 200, cutY + 100);
    LW.fill.save(); LW.fill.clip(cutClip); ink.save(); ink.clip(cutClip);
    {
      const path = LW.polyPath(sideQ);
      LW.occlude(path);
      LW.flat(path, WHITE_DEEP);
      const bb = LW.bbox(sideQ, 2);
      const a0 = P(ch.u1, h0 + 1, 0), a1 = P(ch.u1, h0 + 1, -1);
      const ang = Math.atan2(a1[1] - a0[1], a1[0] - a0[0]);
      LW.hatchDither(pen, bb, ang, { spacing: 3.4, step: 3, wob: 0.7, seed: 3, inside: (x, y) => LW.pointInPoly(x, y, sideQ), dark: (x, y) => 0.72 + 0.2 * LW.clamp((y - bb.y0) / bb.h, 0, 1), w: (x, y, d) => 0.7 + 1.0 * d });
      LW.hatchDither(pen, bb, Math.PI / 2 + 0.05, { spacing: 4.2, step: 3, wob: 0.6, seed: 4, inside: (x, y) => LW.pointInPoly(x, y, sideQ), dark: () => 0.66, w: () => 0.8 });
      // small arched window in the side wall
      const win = [];
      for (let a = Math.PI; a <= LW.TAU; a += 0.2) win.push([-2.6 + Math.cos(a) * 0.32, hE - 1.6 + Math.sin(-a) * -0.32 + 0.0]);
      const wpts = [[-2.6 + 0.32, hE - 1.6], ...win.map(([dd, h]) => [dd, h]).reverse(), [-2.6 - 0.32, hE - 1.6], [-2.6 - 0.32, hE - 2.7], [-2.6 + 0.32, hE - 2.7]];
      const wscr = wpts.map(([dd, h]) => P(ch.u1, h, dd));
      const wp = LW.polyPath(wscr);
      LW.occlude(wp);
      LW.flat(wp, '#3a2c22');
      LW.outline(pen, wscr, 2.6, 0.5);
      pen.draw(ink, C.ink);
      // eave with a row of tile ends
      const e0 = P(ch.u1 + 0.25, hE + 0.05, 0.35), e1 = P(ch.u1 + 0.25, hE + 0.05, -D);
      const e2 = P(ch.u1 + 0.25, hE + 0.32, -D), e3 = P(ch.u1 + 0.25, hE + 0.32, 0.35);
      const ep = LW.polyPath([e0, e1, e2, e3]);
      LW.occlude(ep);
      LW.flat(ep, C.terracotta);
      const nt = 26;
      for (let k = 0; k < nt; k++) {
        const t0 = k / nt, t1 = (k + 1) / nt;
        const a = [LW.lerp(e0[0], e1[0], t0), LW.lerp(e0[1], e1[1], t0)], b = [LW.lerp(e0[0], e1[0], t1), LW.lerp(e0[1], e1[1], t1)];
        const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 - Math.hypot(b[0] - a[0], b[1] - a[1]) * 0.55];
        pen.line([a, m, b], 1.6, 0.1);
        pen.line([[m[0], m[1]], [LW.lerp(e3[0], e2[0], (t0 + t1) / 2), LW.lerp(e3[1], e2[1], (t0 + t1) / 2)]], 0.9, 0.3);
      }
      LW.outline(pen, [e0, e1, e2, e3], 2.2, 0.8);
      // shadow band under the eave on the side wall
      const sb = [P(ch.u1, hE, 0), P(ch.u1, hE, -D), P(ch.u1, hE - 0.45, -D), P(ch.u1, hE - 0.45, 0)];
      LW.hatchDither(pen, LW.bbox(sb, 1), ang + 0.6, { spacing: 2.8, step: 3, wob: 0.4, seed: 5, inside: (x, y) => LW.pointInPoly(x, y, sb), dark: () => 0.95, w: () => 1.0 });
      LW.outline(pen, sideQ, 2.8, 1.0);
      pen.draw(ink, C.ink);
    }
    LW.fill.restore(); ink.restore();

    // ---------------------------------------------------------- bell-cote (behind the facade's top)
    const bw = 1.45, bTop = hA + 2.9;
    const cote = [[uc - bw, hA - 0.9], [uc + bw, hA - 0.9], [uc + bw, bTop - 0.35], [uc + bw * 0.55, bTop - 0.35], [uc, bTop + 0.25], [uc - bw * 0.55, bTop - 0.35], [uc - bw, bTop - 0.35]];
    const coteS = cote.map(([u, h]) => P(u, h, 0.05));
    {
      // the bell-cote's right flank (its thickness), in shadow
      const fl = [P(uc + bw, hA - 0.9, 0.05), P(uc + bw, hA - 0.9, -0.7), P(uc + bw, bTop - 0.35, -0.7), P(uc + bw, bTop - 0.35, 0.05)];
      LW.shadeQuad(fl, { fill: WHITE_DEEP, angle: Math.PI / 2, sp: 3.0, dark: () => 0.78, ow: 2.2 });
      const fl2 = [P(uc + bw * 0.55, bTop - 0.35, 0.05), P(uc + bw * 0.55, bTop - 0.35, -0.7), P(uc, bTop + 0.25, -0.7), P(uc, bTop + 0.25, 0.05)];
      LW.shadeQuad(fl2, { fill: WHITE_SH, angle: 0.6, sp: 3.0, dark: () => 0.5, ow: 1.8 });
    }
    {
      const path = LW.polyPath(coteS);
      LW.occlude(path);
      LW.flat(path, WHITE);
      // light vertical plaster hatch, darker to the right
      const bb = LW.bbox(coteS, 2);
      LW.hatchDither(pen, bb, Math.PI / 2 + 0.02, { spacing: 4.2, step: 3, wob: 0.8, seed: 8, inside: (x, y) => LW.pointInPoly(x, y, coteS), dark: (x, y) => 0.12 + 0.3 * LW.clamp((x - bb.x0) / bb.w, 0, 1) ** 2, w: (x, y, d) => 0.6 + d });
      LW.outline(pen, coteS, 3.0, 1.2);
      // quoins on the bell-cote edges
      for (const [eu, sg] of [[uc - bw, 1], [uc + bw, -1]]) {
        for (let h = hA - 0.6, k = 0; h < bTop - 0.6; h += 0.36, k++) {
          const w = k % 2 ? 0.22 : 0.38;
          pen.line([P(eu, h, 0.06), P(eu + sg * w, h, 0.06), P(eu + sg * w, h + 0.34, 0.06)], 1.1, 0.1);
        }
      }
      // coping steps
      for (const [u0, u1, h] of [[uc - bw - 0.08, uc - bw * 0.55, bTop - 0.35], [uc + bw * 0.55, uc + bw + 0.08, bTop - 0.35]]) {
        const q = [P(u0, h, 0.12), P(u1, h, 0.12), P(u1, h - 0.16, 0.12), P(u0, h - 0.16, 0.12)];
        LW.shadeQuad(q, { fill: WHITE_SH, angle: 0, sp: 3, dark: () => 0.5, ow: 1.8 });
      }
      // arched opening with the sky behind
      const ow = 0.64, oB = hA - 0.1, oT = bTop - 1.05;
      const op = [];
      op.push([uc - ow, oB]);
      for (let a = Math.PI; a >= 0; a -= 0.12) op.push([uc + Math.cos(a) * ow, oT + Math.sin(a) * ow * 0.95]);
      op.push([uc + ow, oT]); op.push([uc + ow, oB]);
      const opS = op.map(([u, h]) => P(u, h, 0.05));
      const opP = LW.polyPath(opS);
      pen.draw(ink, C.ink); // commit the cote's hatching before cutting the opening
      LW.occlude(opP);
      LW.flat(opP, C.sky);
      // reveal: the part of the front opening not covered by the opening 0.5m behind (wall thickness)
      const th = op.map(([u, h]) => P(u, h, -0.5));
      const thP = LW.polyPath(th);
      LW.clipDo(LW.fill, opP, () => {
        LW.flat(opP, WHITE_DEEP);
        LW.flat(thP, C.sky);
      });
      LW.clipDo(ink, opP, () => {
        const p2 = new LW.Pen();
        const bb2 = LW.bbox(opS, 1);
        LW.hatchDither(p2, bb2, Math.PI / 2 + 0.3, { spacing: 2.6, step: 2, wob: 0.3, seed: 9, inside: (x, y) => LW.pointInPoly(x, y, opS) && !LW.pointInPoly(x, y, th), dark: () => 0.8, w: () => 1.0 });
        LW.outline(p2, th, 1.6, 0.6);
        p2.draw(ink, C.ink);
      });
      // voussoirs round the opening
      for (let a = Math.PI; a >= -0.001; a -= Math.PI / 9) {
        const r0 = ow * 0.98, r1 = ow + 0.22;
        const p0 = P(uc + Math.cos(a) * r0, oT + Math.sin(a) * r0 * 0.95, 0.06), p1 = P(uc + Math.cos(a) * r1, oT + Math.sin(a) * r1 * 0.95, 0.06);
        pen.line([p0, p1], 1.3, 0.2);
      }
      const arcO = [];
      for (let a = Math.PI; a >= 0; a -= 0.1) arcO.push(P(uc + Math.cos(a) * (ow + 0.22), oT + Math.sin(a) * (ow + 0.22) * 0.95, 0.06));
      pen.line(arcO, 1.6, 0.1);
      LW.outline(pen, opS, 2.8, 1.0);
      pen.draw(ink, C.ink);
      // ---- the bell
      const yokeH = oT + ow * 0.62;
      const y0 = P(uc - ow - 0.05, yokeH, -0.2), y1 = P(uc + ow + 0.05, yokeH, -0.2);
      const y2 = P(uc + ow + 0.05, yokeH - 0.14, -0.2), y3 = P(uc - ow - 0.05, yokeH - 0.14, -0.2);
      LW.shadeQuad([y0, y1, y2, y3], { fill: C.wood, angle: 0, sp: 2.4, dark: () => 0.7, ow: 1.8 });
      const bellTop = yokeH - 0.14, bh = 0.88, bwid = 0.48;
      const prof = []; // half profile (x from centre, y down from top), bell shape
      for (let t = 0; t <= 1.0001; t += 0.05) {
        const y = t * bh;
        const x = 0.13 + 0.17 * Math.pow(t, 0.7) + 0.13 * Math.pow(Math.max(0, t - 0.7) / 0.3, 2.2);
        prof.push([x * bwid / 0.43, y]);
      }
      const bell = [];
      for (const [x, y] of prof) bell.push(P(uc + x, bellTop - y, -0.2));
      bell.push(P(uc + prof[prof.length - 1][0] * 0.5, bellTop - bh - 0.025, -0.2));
      bell.push(P(uc - prof[prof.length - 1][0] * 0.5, bellTop - bh - 0.025, -0.2));
      for (let k = prof.length - 1; k >= 0; k--) bell.push(P(uc - prof[k][0], bellTop - prof[k][1], -0.2));
      const bpath = LW.polyPath(bell);
      LW.occlude(bpath);
      LW.flat(bpath, C.bronze);
      // patina streaks + curved hatching following the bell's flare
      LW.clipDo(LW.fill, bpath, () => {
        for (let k = 0; k < 6; k++) {
          const xx = rnd.range(-0.3, 0.3);
          const q = [];
          for (let t = 0.1; t <= 1; t += 0.1) q.push(P(uc + xx * (0.4 + t), bellTop - t * bh, -0.2));
          const pp = new LW.Pen(); pp.line(q, rnd.range(2, 5), 0.3); pp.draw(LW.fill, C.patina, 0.8);
        }
      });
      const bp = new LW.Pen();
      for (let k = -9; k <= 9; k++) {
        const s = k / 9.5;
        const q = [];
        for (let t = 0.04; t <= 0.97; t += 0.06) {
          const pr = prof[Math.round(t * (prof.length - 1))][0];
          q.push(P(uc + pr * s, bellTop - t * bh, -0.2));
        }
        const dk = LW.clamp(0.25 + 0.75 * s, 0, 1);
        if (dk < 0.15) continue;
        bp.line(q, 0.5 + 1.4 * dk, 0.2);
      }
      // lip bands
      for (const t of [0.83, 0.9, 0.22]) {
        const q = [];
        const pr = prof[Math.round(t * (prof.length - 1))][0];
        for (let s = -1; s <= 1.001; s += 0.1) q.push(P(uc + pr * s, bellTop - t * bh - 0.02 * (1 - s * s), -0.2));
        bp.line(q, 1.4, 0.1);
      }
      LW.outline(bp, bell, 2.6, 1.3);
      // clapper & rope hanging through the opening
      const cl = P(uc + 0.02, bellTop - bh - 0.08, -0.2);
      bp.dot(cl[0], cl[1], 4);
      bp.line([P(uc + 0.18, bellTop - 0.5, -0.2), P(uc + 0.24, oB + 0.05, -0.15)], 1.4, 0.05);
      bp.draw(ink, C.ink);
      // iron finial
      const ft = P(uc, bTop + 0.25, 0.05), fu = P(uc, bTop + 0.95, 0.05);
      pen.line([ft, fu], 3.0, 0.05);
      pen.dot(fu[0], fu[1], 4.5);
      const fb = P(uc, bTop + 0.45, 0.05);
      pen.dot(fb[0], fb[1], 3.2);
      pen.draw(ink, C.ink);
    }

    // ---------------------------------------------------------- facade
    const fac = [[ch.u0, h0], [ch.u1, h0], [ch.u1, hE], [uc, hA], [ch.u0, hE]];
    const facS = fac.map(([u, h]) => P(u, h, 0));
    const fpath = LW.polyPath(facS);
    LW.occlude(fpath);
    LW.flat(fpath, WHITE);
    const fbb = LW.bbox(facS, 2);
    const inFac = (x, y) => LW.pointInPoly(x, y, facS);
    // plaster losses revealing stonework
    LW.fill.save(); LW.fill.clip(fpath); ink.save(); ink.clip(fpath);
    for (const [pu, ph, r] of [[ch.u0 + 0.9, h0 + 2.3, 0.45], [ch.u1 - 0.8, h0 + 3.1, 0.42], [ch.u0 + 0.5, hE - 0.7, 0.3]]) {
      const blob = [];
      for (let a = 0; a < LW.TAU; a += 0.18) {
        const rr = r * (0.7 + 0.3 * LW.noise(Math.cos(a) * 1.5 + pu, Math.sin(a) * 1.5 + ph) + 0.15 * LW.noise2(Math.cos(a) * 5 + pu, Math.sin(a) * 5));
        blob.push([pu + Math.cos(a) * rr * 1.2, ph + Math.sin(a) * rr * 0.75]);
      }
      LW.masonry((u, h) => P(u, h, -0.02), blob, { rnd, course: [0.2, 0.32], len: [0.25, 0.6], sp: 3.8, chisel: 0.2, roundness: 0.3, dark: () => 0.3, outline: false });
      const bs = blob.map(([u, h]) => P(u, h, 0));
      LW.inkContour(pen, bs, (nx, ny) => 0.6 + 1.8 * (1 - LW.shadowSide(nx, ny)), { taper: 0.2 }); // broken plaster edge (shadow on upper-left inside)
    }
    // weathering: streaks below the eave, darker damp at the base
    LW.hatchDither(pen, fbb, Math.PI / 2 + 0.01, {
      spacing: 4.6, step: 3, wob: 0.9, seed: 21, inside: inFac, levels: 7,
      dark: (x, y) => {
        const [u, h] = [x, y];
        void u; void h;
        const top = LW.clamp(1 - (y - fbb.y0) / (fbb.h * 0.55), 0, 1);
        const base = LW.clamp((y - (fbb.y1 - fbb.h * 0.22)) / (fbb.h * 0.22), 0, 1);
        const streak = Math.max(0, LW.noise(x * 0.045, 3.1)) * 0.6;
        return LW.clamp(0.04 + 0.35 * top * streak * 2 + 0.42 * base + 0.06 * LW.noise(x * 0.01, y * 0.02), 0, 1);
      },
      w: (x, y, d) => 0.5 + 1.0 * d,
    });
    // shadow under the eave/cornice on the facade gable
    {
      const band = [P(ch.u0, hE, 0), P(uc, hA, 0), P(ch.u1, hE, 0), P(ch.u1, hE - 0.35, 0), P(uc, hA - 0.38, 0), P(ch.u0, hE - 0.35, 0)];
      LW.hatchDither(pen, LW.bbox(band, 1), 0.35, { spacing: 3, step: 3, wob: 0.4, seed: 22, inside: (x, y) => LW.pointInPoly(x, y, band) && inFac(x, y), dark: () => 0.55, w: () => 0.9 });
    }
    pen.draw(ink, C.ink);
    LW.fill.restore(); ink.restore();
    // corner quoins
    for (const [cu, sgn] of [[ch.u0, 1], [ch.u1, -1]]) {
      let h = h0;
      let k = 0;
      while (h < hE - 0.2) {
        const hh = rnd.range(0.32, 0.42);
        const w = k % 2 ? 0.32 : 0.55;
        const q = [[cu, h + 0.02], [cu + sgn * w, h + 0.02], [cu + sgn * w, h + hh - 0.02], [cu, h + hh - 0.02]].map(([u, hv]) => P(u, hv, 0.01));
        LW.shadeQuad(q, { fill: '#ece2c2', angle: 0, sp: 3.6, dark: () => 0.18 + 0.15 * rnd(), ow: 1.6 });
        h += hh; k++;
      }
    }
    // plinth course
    LW.shadeQuad([P(ch.u0 - 0.06, h0, 0.08), P(ch.u1 + 0.06, h0, 0.08), P(ch.u1 + 0.06, h0 + 0.45, 0.08), P(ch.u0 - 0.06, h0 + 0.45, 0.08)], { fill: '#e2d4aa', angle: 0, sp: 3.4, dark: (x, y) => 0.35, ow: 2.0 });
    // gable cornice (raking coping with tile edge)
    for (const [a, b] of [[[ch.u0 - 0.25, hE - 0.05], [uc, hA + 0.08]], [[uc, hA + 0.08], [ch.u1 + 0.25, hE - 0.05]]]) {
      const q = [P(a[0], a[1], 0.1), P(b[0], b[1], 0.1), P(b[0], b[1] + 0.26, 0.1), P(a[0], a[1] + 0.26, 0.1)];
      LW.shadeQuad(q, { fill: C.terracotta, angle: Math.atan2(q[1][1] - q[0][1], q[1][0] - q[0][0]), sp: 2.8, dark: () => 0.35, ow: 2.2 });
      const tp = new LW.Pen();
      const nt = 16;
      for (let k = 0; k < nt; k++) {
        const t0 = k / nt, t1 = (k + 1) / nt;
        const A = [LW.lerp(q[0][0], q[1][0], t0), LW.lerp(q[0][1], q[1][1], t0)], B = [LW.lerp(q[0][0], q[1][0], t1), LW.lerp(q[0][1], q[1][1], t1)];
        const M = [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2 + Math.hypot(B[0] - A[0], B[1] - A[1]) * 0.45];
        tp.line([A, M, B], 1.4, 0.1);
        const T2 = [LW.lerp(q[3][0], q[2][0], (t0 + t1) / 2), LW.lerp(q[3][1], q[2][1], (t0 + t1) / 2)];
        tp.line([[(A[0] + B[0]) / 2, (A[1] + B[1]) / 2], T2], 0.8, 0.3);
      }
      tp.draw(ink, C.ink);
    }
    // ---- door
    {
      const dw = 0.68, dB = h0 + 0.45, dS = h0 + 2.05; // springline
      const arch = (r, dd) => {
        const pts = [[uc - r, dB]];
        for (let a = Math.PI; a >= 0; a -= 0.1) pts.push([uc + Math.cos(a) * r, dS + Math.sin(a) * r]);
        pts.push([uc + r, dB]);
        return pts.map(([u, h]) => P(u, h, dd));
      };
      // stone surround (voussoirs)
      const outer = arch(dw + 0.32, 0.02);
      LW.shadeQuad(outer, { fill: '#e9ddb8', angle: 0, sp: 3, dark: () => 0.12, ow: 2.4 });
      const sp = new LW.Pen();
      const nv = 11;
      for (let k = 0; k <= nv; k++) {
        const a = Math.PI - (k / nv) * Math.PI;
        sp.line([P(uc + Math.cos(a) * dw, dS + Math.sin(a) * dw, 0.02), P(uc + Math.cos(a) * (dw + 0.32), dS + Math.sin(a) * (dw + 0.32), 0.02)], 1.6, 0.1);
      }
      for (let h = dB + 0.35; h < dS; h += 0.4) {
        for (const s of [-1, 1]) sp.line([P(uc + s * dw, h, 0.02), P(uc + s * (dw + 0.32), h, 0.02)], 1.5, 0.1);
      }
      // keystone
      const ks = [P(uc - 0.12, dS + dw - 0.02, 0.04), P(uc + 0.12, dS + dw - 0.02, 0.04), P(uc + 0.16, dS + dw + 0.38, 0.04), P(uc - 0.16, dS + dw + 0.38, 0.04)];
      sp.draw(ink, C.ink);
      LW.shadeQuad(ks, { fill: '#efe5c6', angle: 0, sp: 3, dark: () => 0.2, ow: 2.0 });
      // reveal (deep recess), visible on the right and the soffit
      const front = arch(dw, 0.0);
      const back = arch(dw - 0.02, -0.35);
      const rp = LW.polyPath(front);
      LW.occlude(rp);
      LW.flat(rp, WHITE_DEEP);
      const p3 = new LW.Pen();
      LW.hatchDither(p3, LW.bbox(front, 1), 0.7, { spacing: 2.8, step: 2, wob: 0.4, seed: 30, inside: (x, y) => LW.pointInPoly(x, y, front), dark: () => 0.8, w: () => 1.0 });
      p3.draw(ink, C.ink);
      // the door leaf (wood planks)
      const leaf = back;
      const lp = LW.polyPath(leaf);
      LW.occlude(lp);
      LW.flat(lp, C.wood);
      const lbb = LW.bbox(leaf, 1);
      const inLeaf = (x, y) => LW.pointInPoly(x, y, leaf);
      const dp = new LW.Pen();
      // planks
      const np = 6;
      for (let k = 1; k < np; k++) {
        const u = uc - dw + (2 * dw * k) / np;
        const top = Math.sqrt(Math.max(0, dw * dw - (u - uc) ** 2)) + dS;
        dp.line([P(u, dB, -0.35), P(u, top - 0.02, -0.35)], 1.8, 0.05);
      }
      // grain + shading
      LW.hatchDither(dp, lbb, Math.PI / 2 - 0.08, { spacing: 2.6, step: 3, wob: 1.0, seed: 31, inside: inLeaf, dark: (x, y) => 0.42 + 0.35 * LW.clamp((x - lbb.x0) / lbb.w, 0, 1) + 0.15 * LW.noise(x * 0.2, y * 0.01), w: (x, y, d) => 0.6 + 0.9 * d });
      // strap hinges with studs
      for (const hh of [dB + 0.4, dB + 1.3]) {
        const a = P(uc - dw + 0.04, hh, -0.34), b = P(uc + dw * 0.55, hh, -0.34);
        dp.line([a, b], 5.0, 0.0);
        const c2 = P(uc + dw * 0.55 + 0.08, hh + 0.04, -0.34);
        dp.line([b, c2], 3.0, 0.4);
        for (let k = 0; k < 5; k++) {
          const s = P(uc - dw + 0.12 + k * 0.22, hh + 0.12, -0.34);
          dp.dot(s[0], s[1], 2.2);
        }
      }
      const ring = P(uc + dw * 0.45, dB + 0.95, -0.34);
      dp.p.moveTo(ring[0] + 7, ring[1]);
      dp.p.arc(ring[0], ring[1], 7, 0, LW.TAU, true);
      dp.p.arc(ring[0], ring[1], 5, 0, LW.TAU, false);
      dp.n++;
      LW.outline(dp, leaf, 2.4, 0.6);
      LW.outline(dp, front, 3.2, 1.0);
      dp.draw(ink, C.ink);
    }
    // ---- oculus above the door
    {
      const oc = [];
      for (let a = 0; a < LW.TAU; a += 0.15) oc.push(P(uc + Math.cos(a) * 0.3, hE - 0.55 + Math.sin(a) * 0.3, 0));
      const op = LW.polyPath(oc);
      LW.occlude(op);
      LW.flat(op, '#2f2219');
      const p4 = new LW.Pen();
      LW.outline(p4, oc, 2.6, 1.0);
      const oc2 = [];
      for (let a = 0; a < LW.TAU; a += 0.15) oc2.push(P(uc + Math.cos(a) * 0.46, hE - 0.55 + Math.sin(a) * 0.46, 0));
      LW.outline(p4, oc2, 1.4, 0.8);
      for (let k = 0; k < 12; k++) {
        const a = (k / 12) * LW.TAU;
        p4.line([P(uc + Math.cos(a) * 0.3, hE - 0.55 + Math.sin(a) * 0.3, 0), P(uc + Math.cos(a) * 0.46, hE - 0.55 + Math.sin(a) * 0.46, 0)], 1.0, 0.1);
      }
      p4.draw(ink, C.ink);
    }
    // plaster texture: sparse short strokes (denser right/low), hairline cracks
    {
      const tp = new LW.Pen();
      LW.clipDo(ink, fpath, () => {
        LW.flecks(tp, fbb, Math.floor(fbb.w * fbb.h * 0.0016), {
          rng: rnd, inside: inFac, angle: Math.PI / 2 + 0.1, spread: 0.25, len: [4, 11], w: 0.9,
          dark: (x, y) => 0.15 + 0.6 * LW.clamp((x - fbb.x0) / fbb.w, 0, 1) ** 1.5 + 0.35 * LW.clamp((y - fbb.y0) / fbb.h, 0, 1) ** 2,
        });
        LW.stipple(tp, fbb, Math.floor(fbb.w * fbb.h * 0.0012), { rng: rnd, inside: inFac, r: [0.5, 1.2], dark: (x) => 0.3 + 0.5 * LW.clamp((x - fbb.x0) / fbb.w, 0, 1) });
        for (let k = 0; k < 5; k++) {
          let x = rnd.range(fbb.x0 + 40, fbb.x1 - 40), y = rnd.range(fbb.y0 + fbb.h * 0.3, fbb.y1 - 40);
          const cp = [];
          let a = Math.PI / 2 + rnd.gauss() * 0.4;
          for (let m = 0; m < 14; m++) { cp.push([x, y]); a += rnd.gauss() * 0.35; x += Math.cos(a) * 7; y += Math.sin(a) * 7; }
          tp.line(cp, 1.0, 0.5);
        }
        tp.draw(ink, C.ink);
      });
    }
    // damp band at the base and rain streaks from the cornice and the oculus sill
    {
      const wp = new LW.Pen();
      LW.clipDo(ink, fpath, () => {
        for (let k = 0; k < 26; k++) {
          const u = LW.lerp(ch.u0 + 0.3, ch.u1 - 0.3, rnd());
          const top = k < 6 ? hE - 0.6 : hE - rnd.range(0.0, 0.4);
          const L = rnd.range(0.4, 1.6);
          const q = [];
          for (let t = 0; t <= 1.0001; t += 0.1) q.push(P(u + 0.02 * LW.noise(t * 3, k), top - t * L, 0));
          wp.line(q, rnd.range(0.6, 1.4), 0.6, 0.05);
        }
        const db = [];
        for (let u = ch.u0; u <= ch.u1 + 0.001; u += 0.1) db.push([u, h0 + 0.45 + 0.35 + 0.18 * LW.noise(u * 2.3, 4)]);
        const dpoly = db.concat([[ch.u1, h0], [ch.u0, h0]]).map(([u, h]) => P(u, h, 0));
        LW.clipDo(LW.fill, fpath, () => { LW.fill.save(); LW.fill.globalAlpha = 0.55; LW.flat(LW.polyPath(dpoly), '#cfc6a2'); LW.fill.restore(); });
        LW.stipple(wp, LW.bbox(dpoly), 260, { rng: rnd, inside: (x, y) => LW.pointInPoly(x, y, dpoly), r: [0.6, 1.5], dark: () => 0.7 });
        wp.line(db.map(([u, h]) => P(u, h, 0)), 0.9, 0.1);
        wp.draw(ink, C.ink);
      });
      // wrought-iron lantern on a bracket, right of the door
      const lb = P(uc + 1.25, h0 + 2.55, 0.02), le = P(uc + 1.25, h0 + 2.55, 0.42);
      const lp = new LW.Pen();
      lp.line([lb, [(lb[0] + le[0]) / 2, (lb[1] + le[1]) / 2 - 4], le], 2.6, 0.05);
      lp.line([P(uc + 1.25, h0 + 2.2, 0.02), P(uc + 1.25, h0 + 2.55, 0.3)], 1.6, 0.05);
      const lt = P(uc + 1.25, h0 + 2.42, 0.42), lbt = P(uc + 1.25, h0 + 1.98, 0.42);
      const hw = Math.abs(lt[1] - lbt[1]) * 0.36;
      const lant = [[lt[0] - hw * 0.8, lt[1]], [lt[0] + hw * 0.8, lt[1]], [lbt[0] + hw, lbt[1] - hw * 0.4], [lbt[0] + hw * 0.6, lbt[1]], [lbt[0] - hw * 0.6, lbt[1]], [lbt[0] - hw, lbt[1] - hw * 0.4]];
      const lpath = LW.polyPath(lant);
      LW.occlude(lpath);
      LW.flat(lpath, '#d9a24a');
      LW.clipDo(LW.fill, lpath, () => LW.flat(LW.polyPath([[lt[0] - hw, lt[1]], [lt[0] - hw * 0.1, lt[1]], [lbt[0] - hw * 0.1, lbt[1]], [lbt[0] - hw, lbt[1]]]), '#f0d79a'));
      LW.outline(lp, lant, 2.6, 0.5);
      lp.line([[lt[0], lt[1]], [lbt[0], lbt[1]]], 1.6, 0.05);
      lp.line([[LW.lerp(lt[0], lbt[0], 0.5) - hw * 0.9, LW.lerp(lt[1], lbt[1], 0.5)], [LW.lerp(lt[0], lbt[0], 0.5) + hw * 0.9, LW.lerp(lt[1], lbt[1], 0.5)]], 1.2, 0.05);
      LW.hatchDither(lp, LW.bbox(lant), Math.PI / 2, { spacing: 2.2, step: 2, wob: 0.2, seed: 77, inside: (x, y) => LW.pointInPoly(x, y, lant) && x > lt[0], dark: () => 0.7, w: () => 0.8 });
      const cap = [[lt[0] - hw, lt[1]], [lt[0], lt[1] - hw * 0.9], [lt[0] + hw, lt[1]]];
      lp.poly(cap.concat([[lt[0], lt[1] + 1]]));
      lp.line([[lt[0], lt[1] - hw * 0.9], le], 1.4, 0.05);
      lp.draw(ink, C.ink);
    }
    // facade contour (heavier on the right/shadow side)
    pen = new LW.Pen();
    LW.outline(pen, facS, 3.2, 1.3);
    pen.draw(ink, C.ink);

    await LW.tick();
  };
})();
