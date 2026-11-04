// near.js - the foreground: paved landing, parapet with coping, the votive pier,
// the near flight of big worn steps, iron posts with a hemp rope and their cast
// shadows climbing the steps, the clay pot.
(function () {
  'use strict';
  const LW = window.LW, C = LW.C, V = LW.V;
  const IRON = '#3b332c', IRON_LIT = '#6e6458', HEMP = '#c49a5a';

  // hatch lines in a parametric patch: map(a,b)->screen. Lines run along b at
  // constant a. a-step chosen for ~sp px screen spacing. dark(a,b) in 0..1.
  LW.paramHatch = function (pen, map, a0, a1, b0, b1, o) {
    const sp = o.sp || 5;
    const nb = o.nb || 40;
    let a = a0 + (o.phase ?? 0.5) * 0.001;
    let k = 0;
    while (a < a1) {
      const bm = (b0 + b1) / 2;
      const p0 = map(a, bm), p1 = map(a + (a1 - a0) * 0.01, bm);
      const pxPerA = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) / ((a1 - a0) * 0.01) || 1;
      const da = sp / pxPerA;
      const thr = LW.rank(k % 64) * 0.999;
      let run = [], ws = [];
      const flush = () => { if (run.length > 1) pen.line(run, ws, o.taper ?? 0.25, 0.15); run = []; ws = []; };
      for (let j = 0; j <= nb; j++) {
        const b = b0 + ((b1 - b0) * j) / nb;
        const aa = a + (o.sag ? o.sag(a, b) : 0) + (o.wob ? LW.noise3(a * 31 + k, b * 9) * o.wob * da : 0);
        const d = o.dark(aa, b);
        const brk = o.breaks !== undefined && LW.noise3(aa * (o.bf || 40) + k * 0.77, b * (o.bf2 || 6) + k * 1.3) > o.breaks;
        if (d > thr && !brk) {
          const p = map(aa, b);
          run.push(p); ws.push((o.w ? o.w(d) : 0.6 + 1.4 * d));
        } else flush();
      }
      flush();
      a += da;
      k++;
    }
  };

  LW.drawNear = async function () {
    const S = LW.scene, nr = S.near;
    const rnd = LW.rng('near');
    const ink = LW.ink;
    const Q = (x, y, z) => LW.proj([x, y, z]);
    const F = (s, w, y) => LW.proj(V.add(V.add(V.add(nr.o, V.mul(nr.D, s)), V.mul(nr.N, w)), [0, y, 0]));
    const FW = (s, w, y) => V.add(V.add(V.add(nr.o, V.mul(nr.D, s)), V.mul(nr.N, w)), [0, y, 0]);
    const yF = S.landing.y; // floor
    const zP = S.parapet.z;
    const PIER = { x0: -0.66, x1: -0.2, z: 3.02, top: -0.72 };
    let pen = new LW.Pen();
    const fg = new Path2D(); // vertical foreground faces, for the canopy's dappled shade
    const fgH = new Path2D(); // horizontal foreground surfaces

    // ---------------------------------------------------------- floor paving (x,z) on y = floor
    {
      const fp = (x, z) => Q(x, yF, z);
      const reg = [[-6, 1.85], [3.2, 1.85], [3.2, 2.1], [2.21, 2.34], [-0.2, zP], [-6, zP]];
      LW.fgLast = LW.masonry(fp, reg, {
        rnd, course: [0.38, 0.62], len: [0.45, 0.95], sp: 6.2, lw: 1.9, chisel: 0.0, roundness: 0.1, joint: 0.006, wear: 0.012,
        mortar: '#4a3a28', cracks: 0.45, jitter: 0.06, wob: 0.8, pits: 0.4,
        dark: (x, z) => 0.16 + 0.4 * LW.smooth(2.7, zP, z) + 0.45 * LW.smooth(2.55, 2.05, z) + 0.1 * LW.noise(x * 2, z * 2),
        shadowDir: [0.3, -0.95],
      });
      fgH.addPath(LW.fgLast.path);
    }
    // fallen olive leaves and a few pebbles on the paving
    {
      const lp = new LW.Pen(), lf = new LW.Pen();
      for (let k = 0; k < 70; k++) {
        const x = rnd.range(-3.5, 1.5), z = rnd.range(2.05, zP - 0.05);
        if (x > -0.2 + (zP - z) * 2.5) continue; // stay in front of the flight's first riser
        const p = Q(x, yF, z);
        const k2 = LW.cam.f / z;
        const a = rnd() * Math.PI, L = 0.06 * k2 * rnd.range(0.7, 1.2), W = L * 0.22;
        const ca = Math.cos(a), sa = Math.sin(a) * 0.45;
        const pts = [];
        for (let m = 0; m < 10; m++) {
          const t = (m / 10) * LW.TAU;
          pts.push([p[0] + Math.cos(t) * L * 0.5 * ca - Math.sin(t) * W * 0.5 * 0.9 * sa * 2, p[1] + Math.cos(t) * L * 0.5 * sa + Math.sin(t) * W * 0.5 * 0.5]);
        }
        const path = LW.polyPath(pts);
        LW.occlude(path);
        LW.flat(path, rnd() < 0.5 ? '#9a8a5a' : '#6f8f7e');
        LW.outline(lf, pts, 1.3, 0.8);
        lf.line([[p[0] - ca * L * 0.45, p[1] - sa * L * 0.45], [p[0] + ca * L * 0.45, p[1] + sa * L * 0.45]], 0.8, 0.3);
      }
      lf.draw(ink, C.ink);
      void lp;
    }
    // ---------------------------------------------------------- parapet (front face at z = zP)
    {
      const fp = (x, y) => Q(x, y, zP);
      LW.fgLast = LW.masonry(fp, [[-6, yF], [PIER.x0, yF], [PIER.x0, S.parapet.top], [-6, S.parapet.top]], {
        rnd, course: [0.2, 0.34], len: [0.3, 0.7], sp: 5.4, lw: 1.8, chisel: 1.2, roundness: 0.14, wear: 0.009, jitter: 0.1, wob: 1.1, mortar: '#4a3a28', joint: 0.005,
        dark: (x, y) => 0.3 + 0.35 * LW.smooth(-1.05, -1.6, y) + 0.12 * LW.noise(x * 3, y * 3),
      });
      fg.addPath(LW.fgLast.path);
      // coping: front lip + top surface
      const ct = S.parapet.top + 0.11;
      const lip = [Q(-6, S.parapet.top - 0.01, zP - 0.04), Q(PIER.x0, S.parapet.top - 0.01, zP - 0.04), Q(PIER.x0, ct, zP - 0.04), Q(-6, ct, zP - 0.04)];
      fg.addPath(LW.shadeQuad(lip, { fill: '#e2d2a5', angle: 0, sp: 4.5, dark: (x, y) => 0.38 + 0.3 * LW.clamp((y - lip[2][1]) / 70, 0, 1), lw: 1.6, ow: 2.4 }));
      const topF = (x, z) => Q(x, ct, z);
      LW.fgLast = LW.masonry(topF, [[-6, zP - 0.04], [PIER.x0, zP - 0.04], [PIER.x0, zP + 0.55], [-6, zP + 0.55]], {
        rnd, course: [0.6, 0.6], len: [0.55, 1.0], sp: 6, lw: 1.6, chisel: 0.3, roundness: 0.1, joint: 0.012,
        dark: (x, z) => 0.06 + 0.2 * LW.smooth(zP + 0.2, zP + 0.55, z), shadowDir: [0.2, -0.98],
      });
      fgH.addPath(LW.fgLast.path);
    }
    // ---------------------------------------------------------- the flight (far to near)
    const R = nr.rise, G = nr.go, Wd = nr.width, n = nr.n;
    const steps = [];
    {
      // hand-cut steps: rises and goings vary, middles worn into dips, some corners broken off
      let sAcc = 0, yAcc = 0;
      const sr = LW.rng('steps');
      for (let i = 0; i < n; i++) {
        const go = G * (1 + 0.07 * LW.clamp(sr.gauss(), -1.8, 1.8)), rise = R * (1 + 0.1 * LW.clamp(sr.gauss(), -1.8, 1.8));
        steps.push({
          i, s0: sAcc, s1: sAcc + go, yB: yAcc, yT: yAcc + rise, seed: sr() * 100, joint: sr.range(0.9, 1.7),
          dip: sr.range(0.03, 0.06), dipW: sr.range(0.8, 1.3), corner: sr() < 0.45 ? sr.range(0.05, 0.11) : 0.015,
          replaced: i === 4, cracked: i === 8 || i === 2,
        });
        sAcc += go; yAcc += rise;
      }
    }
    const dipAt = (st, s, w) => st.dip * Math.exp(-(((w - st.dipW) / 0.55) ** 2)) * (1 - 0.65 * LW.clamp((s - st.s0) / (st.s1 - st.s0), 0, 1));
    const cornerAt = (st, w) => st.corner * LW.smooth(0.2, 0, w);
    const FT = (st, s, w) => F(s, w, st.yT - dipAt(st, s, w) - (s < st.s0 + 0.08 ? cornerAt(st, w) * 0.5 : 0));
    const sEnd = steps[n - 1].s1;
    // top landing (hidden top), its far edge with a post
    const landEnd = sEnd + 1.7;
    // stair surface height (relative to floor) for shadows
    const surf = (s) => { if (s < 0) return 0; for (const st of steps) if (s < st.s1) return st.yT; return steps[n - 1].yT; };
    for (let k = n - 1; k >= 0; k--) {
      const st = steps[k];
      const yT = yF + st.yT, yB = yF + st.yB;
      // ---- tread (visible only below eye level)
      if (yT < -0.02) {
        const nosing = [];
        const NW = 26;
        for (let j = 0; j <= NW; j++) {
          const w = (j / NW) * Wd;
          const chip = Math.max(0, LW.noise(w * 3 + st.seed, 1.3)) * 0.035 + cornerAt(st, w);
          nosing.push([st.s0 - 0.025 + chip, w]);
        }
        const back = [[st.s1, Wd], [st.s1, 0]];
        const tp = nosing.concat(back).map(([s, w]) => FT(st, s, w));
        const path = LW.polyPath(tp);
        fgH.addPath(path);
        LW.occlude(path);
        LW.flat(path, st.replaced ? '#e4dcc4' : rnd() < 0.5 ? '#efe4c2' : '#eadcb5');
        if (!st.replaced) { // the polished hollow worn by centuries of feet
          const pol = [];
          for (let a = 0; a < LW.TAU; a += 0.2) pol.push(FT(st, st.s0 + (st.s1 - st.s0) * (0.38 + 0.3 * Math.cos(a)), st.dipW + 0.5 * Math.sin(a)));
          LW.clipDo(LW.fill, path, () => LW.flat(LW.polyPath(pol), '#f5ecd2'));
        }
        // hatch along the nosing, bowed by wear, dark toward the back & the rock side
        const map = (s, w) => FT(st, s, w);
        LW.clipDo(ink, path, () => {
          const p2 = new LW.Pen();
          LW.paramHatch(p2, map, st.s0, st.s1, 0, Wd, {
            sp: 5.4, nb: 60,
            sag: (s, w) => -0.03 * Math.exp(-(((w - 0.75) / 0.45) ** 2)) * LW.smooth(st.s0 + 0.25 * G, st.s0, s) * 0,
            dark: (s, w) => {
              const back = LW.smooth(st.s0 + 0.4 * G, st.s1, s);
              const rock = LW.smooth(1.25, Wd, w);
              const wear = Math.exp(-(((w - 0.75) / 0.38) ** 2)) * 0.16 * LW.smooth(st.s0 + 0.6 * G, st.s0 + 0.1 * G, s);
              const joint = st.replaced ? 0 : Math.exp(-(((w - st.joint) / 0.03) ** 2)) * 0.5;
              const dipSh = 0.25 * LW.smooth(st.dipW - 0.1, st.dipW + 0.45, w) * LW.smooth(st.dipW + 0.9, st.dipW + 0.45, w) * (st.dip / 0.034);
              return LW.clamp(0.08 + 0.55 * back * back + 0.42 * rock + wear + joint + dipSh + 0.12 * LW.noise(s * 9 + st.seed, w * 4), 0, 1);
            },
            w: (d) => 0.7 + 1.9 * d,
            breaks: 0.5, bf: 26, bf2: 3, wob: 0.6,
          });
          // chisel dressing, pitting and lichen
          const bb = LW.bbox(tp);
          const inT = (x, y) => LW.pointInPoly(x, y, tp);
          LW.flecks(p2, bb, Math.floor(bb.w * bb.h * 0.0011), { rng: rnd, inside: inT, angle: -0.6, spread: 0.25, len: [4, 10], w: 1.2, dark: () => 0.7 });
          LW.stipple(p2, bb, Math.floor(bb.w * bb.h * 0.0016), { rng: rnd, inside: inT, r: [0.7, 1.7], dark: (x, y) => 0.5 + 0.5 * LW.noise(x * 0.02, y * 0.03) });
          if (rnd() < 0.45) lichen(bb, inT, rnd, 0.00004);
          // occasional crack
          if (rnd() < 0.5) {
            let s = st.s0 + 0.01, w = rnd.range(0.5, 2.2);
            const cp = [];
            for (let m = 0; m < 9; m++) { cp.push(map(s, w)); s += G / 9; w += rnd.gauss() * 0.05; }
            p2.line(cp, 1.8, 0.4);
          }
          p2.draw(ink, C.ink);
        });
        // tread contour: nosing line + side; joint between the two slabs
        const p3 = new LW.Pen();
        const jt = [];
        if (st.replaced) {
          // a newer slab let into the old step: crisp joints on both sides, a few setting wedges
          for (const jw of [0.85, 1.95]) {
            const q = [];
            for (let m = 0; m <= 8; m++) q.push(FT(st, st.s0 + ((st.s1 - st.s0) * m) / 8, jw));
            p3.line(q, 2.8, 0.05);
          }
        } else {
          for (let m = 0; m <= 8; m++) jt.push(FT(st, st.s0 + ((st.s1 - st.s0) * m) / 8, st.joint + LW.noise(m * 0.4, st.seed) * 0.02));
          p3.line(jt, 2.2, 0.15);
        }
        if (st.cracked) {
          // a crack running across the tread and down the riser, with a branch
          let s2 = st.s1 - 0.02, w2 = rnd.range(0.9, 1.9);
          const cp = [];
          for (let m = 0; m < 14; m++) { cp.push(FT(st, s2, w2)); s2 -= (st.s1 - st.s0) / 13; w2 += rnd.gauss() * 0.04 - 0.012; }
          for (let m = 1; m < 6; m++) cp.push(F(st.s0, w2 + rnd.gauss() * 0.01, st.yT - dipAt(st, st.s0, w2) - m * (st.yT - st.yB) / 5.5));
          p3.line(cp, (t) => 2.6 * (1 - 0.5 * Math.abs(t - 0.5)), 0.2);
          const bi = 6;
          const bq = [cp[bi]];
          let bs = st.s1 - (st.s1 - st.s0) * 0.45, bw = w2 + 0.05;
          for (let m = 0; m < 5; m++) { bs -= 0.02; bw += 0.04 + rnd.gauss() * 0.01; bq.push(FT(st, bs, bw)); }
          p3.line(bq, 1.4, 0.4);
        }
        p3.line(nosing.map(([s, w]) => FT(st, s, w)), (t) => 2.2 + 1.2 * LW.noise(t * 6 + st.seed, 2), 0.05);
        // worn, rounded nosing: a pale polished band just behind the edge, broken by chips
        {
          const hl = new LW.Pen();
          let run = [];
          const flushH = () => { if (run.length > 2) hl.line(run, (t) => 4.5 + 3 * Math.sin(t * Math.PI), 0.3); run = []; };
          for (const [s0n, w] of nosing) {
            if (LW.noise3(w * 6 + st.seed, 7.7) > 0.45) { flushH(); continue; }
            run.push(FT(st, s0n + 0.045, w));
          }
          flushH();
          LW.clipDo(LW.fill, path, () => hl.draw(LW.fill, '#f6efd8'));
          // chips: little dark bites out of the edge
          for (let c = 0; c < 3; c++) {
            const w = rnd.range(0.15, Wd - 0.2), cw = rnd.range(0.05, 0.13);
            const a = F(st.s0 - 0.02, w, st.yT), b = F(st.s0 - 0.02, w + cw, st.yT), m = F(st.s0 + 0.03, w + cw * 0.5, st.yT);
            const bite = [a, m, b, F(st.s0 - 0.02, w + cw * 0.6, st.yT - 0.025), F(st.s0 - 0.02, w + cw * 0.3, st.yT - 0.03)];
            LW.flat(LW.polyPath(bite), '#c9b384');
            p3.line([a, m, b], 1.5, 0.2);
          }
          // grass in the joints at both ends of the step
          for (let g2 = 0; g2 < 2; g2++) {
            if (rnd() < 0.35) continue;
            const w = g2 ? Wd - rnd.range(0.02, 0.2) : rnd.range(0.05, 0.25);
            const c = F(st.s1 - 0.01, w, st.yT);
            LW.grass(c[0], c[1], rnd.range(60, 120) * (LW.cam.f / FW(st.s1, w, 0)[2]) / 600, rnd);
          }
          // moss creeping along the tread/riser joint on the rock side
          for (let m2 = 0; m2 < 3; m2++) {
            const w = 0.06 + Math.abs(rnd.gauss()) * 0.18;
            const c = F(st.s1 - 0.01, w, st.yT);
            mossTuft(c[0], c[1], rnd.range(5, 11), rnd);
          }
        }
        p3.draw(ink, C.ink);
      }
      // ---- riser
      {
        const rp = [];
        const NW = 26;
        for (let j = 0; j <= NW; j++) { const w = (j / NW) * Wd; rp.push([w, st.yT - dipAt(st, st.s0, w) - cornerAt(st, w) * 0.6]); }
        rp.push([Wd, st.yB], [0, st.yB]);
        const map = (y, w) => F(st.s0, w, y);
        const scr = rp.map(([w, y]) => F(st.s0, w, y));
        const path = LW.polyPath(scr);
        fg.addPath(path);
        LW.occlude(path);
        LW.flat(path, st.replaced ? '#d3c9ab' : rnd() < 0.5 ? '#dccb9c' : '#d4c08e');
        if (st.corner > 0.04) { // the broken corner shows raw, darker stone
          const cq = [F(st.s0, 0, st.yT - cornerAt(st, 0) * 0.6), F(st.s0, 0.2, st.yT - dipAt(st, st.s0, 0.2)), F(st.s0, 0.12, st.yT - cornerAt(st, 0.12) * 0.6 - 0.02), F(st.s0, 0, st.yT - cornerAt(st, 0) - 0.03)];
          LW.flat(LW.polyPath(cq), '#b9a477');
        }
        LW.clipDo(ink, path, () => {
          const p2 = new LW.Pen();
          LW.paramHatch(p2, map, st.yB, st.yT, 0, Wd, {
            sp: 4.6, nb: 60, wob: 0.3,
            dark: (y, w) => {
              const top = LW.smooth(st.yT - 0.05, st.yT, y); // nosing shadow
              const bot = LW.smooth(st.yB + 0.05, st.yB, y);
              const rock = LW.smooth(1.6, Wd, w);
              const eye = yF + y > 0 ? 0.15 : 0;
              return LW.clamp(0.56 + 0.4 * top + 0.3 * bot + 0.3 * rock + eye + 0.12 * LW.noise(y * 30, w * 5 + st.seed), 0, 1);
            },
            w: (d) => 0.7 + 1.7 * d,
            breaks: 0.62, bf: 14, bf2: 3,
          });
          // vertical cross-strokes in the darker parts of the riser
          LW.paramHatch(p2, (w, y) => F(st.s0, w + (y - st.yB) * 1.4, y), -0.4, Wd, st.yB, st.yT, {
            sp: 9, nb: 12, wob: 0.5,
            dark: (w, y) => LW.clamp(-0.3 + 0.6 * LW.smooth(st.yT - 0.06, st.yT, y) + 0.5 * LW.smooth(1.3, Wd, w) + 0.45 * LW.noise(w * 2.5 + st.seed, 3), 0, 1),
            w: (d) => 0.6 + 1.2 * d,
          });
          const bb = LW.bbox(scr);
          const inR = (x, y) => LW.pointInPoly(x, y, scr);
          LW.flecks(p2, bb, Math.floor(bb.w * bb.h * 0.0012), { rng: rnd, inside: inR, angle: Math.PI / 2 + 0.25, spread: 0.12, len: [5, 12], w: 1.3, dark: () => 0.8 });
          LW.stipple(p2, bb, Math.floor(bb.w * bb.h * 0.0012), { rng: rnd, inside: inR, r: [0.7, 1.6], dark: () => 0.7 });
          if (rnd() < 0.3) lichen(bb, inR, rnd, 0.00003);
          p2.draw(ink, C.ink);
        });
        const p3 = new LW.Pen();
        // joint at the riser foot (heavy) and the outer end edge
        p3.line([F(st.s0, 0, st.yB), F(st.s0, Wd * 0.5, st.yB), F(st.s0, Wd, st.yB)], 3.2, 0.05);
        p3.line([F(st.s0, 0, st.yB), F(st.s0, 0, st.yT - 0.02)], 2.4, 0.05);
        if (yF + st.yT >= -0.02) p3.line(rp.slice(0, NW + 1).map(([w, y]) => F(st.s0 - 0.02, w, y)), 2.6, 0.05);
        // moss in the joint, toward the rock side
        for (let m = 0; m < 7; m++) {
          const w = Wd - Math.abs(rnd.gauss()) * 0.6;
          const c = F(st.s0 + 0.01, w, st.yB);
          const r = rnd.range(5, 12);
          mossTuft(c[0], c[1], r, rnd);
        }
        p3.draw(ink, C.ink);
      }
    }
    // landing at the top: its far edge post
    // ---------------------------------------------------------- the votive pier
    {
      const { x0, x1, z, top } = PIER;
      const fp = (x, y) => Q(x, y, z);
      const reg = [[x0, yF], [x1, yF], [x1, top], [x0, top]];
      LW.fgLast = LW.masonry(fp, reg, {
        rnd, course: [0.2, 0.3], len: [0.22, 0.46], sp: 5.4, lw: 1.9, chisel: 1.2, roundness: 0.14, wear: 0.008, jitter: 0.1, wob: 1.1, mortar: '#4a3a28', joint: 0.005,
        dark: (x, y) => 0.25 + 0.3 * LW.smooth(-1.1, -1.6, y),
      });
      fg.addPath(LW.fgLast.path);
      // right side face (grazing)
      const side = [Q(x1, yF, z), Q(x1, yF, z + 0.45), Q(x1, top, z + 0.45), Q(x1, top, z)];
      fg.addPath(LW.shadeQuad(side, { fill: '#c9b27f', angle: Math.PI / 2, sp: 4, dark: () => 0.7, lw: 1.6 }));
      // cap stone (top visible)
      const capT = top + 0.09;
      const capF = [Q(x0 - 0.04, top, z - 0.04), Q(x1 + 0.04, top, z - 0.04), Q(x1 + 0.04, capT, z - 0.04), Q(x0 - 0.04, capT, z - 0.04)];
      fg.addPath(LW.shadeQuad(capF, { fill: '#e2d2a5', angle: 0, sp: 4.4, dark: (x, y) => 0.32 + 0.25 * LW.clamp((y - capF[2][1]) / 60, 0, 1), lw: 1.8, ow: 2.6 }));
      const capTop = [Q(x0 - 0.04, capT, z - 0.04), Q(x1 + 0.04, capT, z - 0.04), Q(x1 + 0.04, capT, z + 0.5), Q(x0 - 0.04, capT, z + 0.5)];
      fgH.addPath(LW.shadeQuad(capTop, { fill: '#efe5c4', angle: 0, sp: 6, dark: (x, y) => 0.08 + 0.2 * LW.clamp((capTop[0][1] - y) / 40, 0, 1), lw: 1.6, ow: 2.4 }));
      // the niche: arched recess
      const nc = (x0 + x1) / 2, nw = 0.105, nb = -1.3, ns = -0.98;
      const arch = (r, dz) => {
        const pts = [[nc - r, nb]];
        for (let a = Math.PI; a >= 0; a -= 0.12) pts.push([nc + Math.cos(a) * r, ns + Math.sin(a) * r * 1.05]);
        pts.push([nc + r, nb]);
        return pts.map(([x, y]) => Q(x, y, z + dz));
      };
      const surround = arch(nw + 0.045, -0.006);
      LW.shadeQuad(surround, { fill: '#ece0bb', angle: 0, sp: 4, dark: () => 0.1, lw: 1.8, ow: 2.6 });
      const front = arch(nw, -0.01);
      const fpth = LW.polyPath(front);
      LW.nicheP = fpth;
      LW.occlude(fpth);
      LW.flat(fpth, '#5a4330');
      const p2 = new LW.Pen();
      LW.clipDo(ink, fpth, () => {
        const bb = LW.bbox(front, 1);
        // concave niche: arcs following the vault, plus verticals darkening to the upper left
        const cxn = (bb.x0 + bb.x1) / 2, cyn = bb.y0 + (bb.x1 - bb.x0) / 2;
        for (let r = 6; r < bb.h * 1.2; r += 3.6) {
          const arc = [];
          for (let a = Math.PI; a <= LW.TAU + 0.001; a += 0.05) arc.push([cxn + Math.cos(a) * r * 1.0, cyn + Math.sin(a) * r * 0.9 + (r > (bb.x1 - bb.x0) / 2 ? (r - (bb.x1 - bb.x0) / 2) * 1.8 : 0)]);
          p2.line(arc, 0.8 + 0.8 * LW.clamp(1 - r / bb.h, 0, 1), 0.3);
        }
        LW.hatchDither(p2, bb, Math.PI / 2, { spacing: 3.6, step: 3, wob: 0.5, seed: 42, dark: (x, y) => 0.25 + 0.75 * LW.clamp((bb.x1 - x) / bb.w * 0.8 + (bb.y1 - y) / bb.h * 0.5, 0, 1), w: (x, y, d) => 0.7 + 1.1 * d });
        p2.draw(ink, C.ink);
        // a stub candle with a small flame glow, a tiny jar with a sprig, pebbles
        const cb = Q(nc - 0.035, nb, z + 0.05), ct = Q(nc - 0.035, nb + 0.07, z + 0.05);
        const cw2 = 9;
        LW.flat(LW.polyPath([[cb[0] - cw2, cb[1]], [cb[0] + cw2, cb[1]], [ct[0] + cw2, ct[1]], [ct[0] - cw2, ct[1]]]), '#efe5c6');
        const glow = new Path2D(); glow.ellipse(ct[0], ct[1] - 34, 30, 44, 0, 0, LW.TAU);
        LW.fill.save(); LW.fill.globalAlpha = 0.5; LW.flat(glow, C.ochreLight); LW.fill.restore();
        const fl = new Path2D(); fl.ellipse(ct[0], ct[1] - 18, 6, 15, 0, 0, LW.TAU);
        LW.flat(fl, '#f2c46a');
        const p4 = new LW.Pen();
        p4.line([[cb[0] - cw2, cb[1]], [ct[0] - cw2, ct[1]]], 2, 0.05);
        p4.line([[cb[0] + cw2, cb[1]], [ct[0] + cw2, ct[1]]], 2.4, 0.05);
        p4.line([[ct[0] - cw2, ct[1]], [ct[0] + cw2, ct[1]]], 1.6, 0.1);
        p4.line([[ct[0], ct[1]], [ct[0] + 1, ct[1] - 8]], 1.6, 0.2);
        const jb = Q(nc + 0.045, nb, z + 0.05);
        const jar = [[jb[0] - 14, jb[1]], [jb[0] + 14, jb[1]], [jb[0] + 17, jb[1] - 26], [jb[0] + 9, jb[1] - 40], [jb[0] - 9, jb[1] - 40], [jb[0] - 17, jb[1] - 26]];
        LW.flat(LW.polyPath(jar), C.terracotta);
        LW.outline(p4, LW.spline(jar, 3, true), 2.0, 0.6);
        for (let m = 0; m < 5; m++) {
          const a = -Math.PI / 2 + rnd.gauss() * 0.5;
          const x = jb[0], y = jb[1] - 40;
          const L = rnd.range(30, 55);
          const tip = [x + Math.cos(a) * L, y + Math.sin(a) * L];
          p4.line([[x, y], [(x + tip[0]) / 2 + rnd.gauss() * 4, (y + tip[1]) / 2], tip], 1.5, 0.3);
          for (let q = 0.3; q < 1; q += 0.22) {
            const px = x + (tip[0] - x) * q, py = y + (tip[1] - y) * q;
            p4.line([[px, py], [px + rnd.sign() * 8, py - 6]], 1.2, 0.4);
          }
        }
        p4.draw(ink, C.ink);
      });
      const p5 = new LW.Pen();
      LW.outline(p5, front, 2.8, 0.8);
      p5.draw(ink, C.ink);
    }
    LW.nearSurf = surf;
    LW.nearPier = PIER;
    await LW.tick();

    // ---------------------------------------------------------- iron posts + rope (+ their shadows)
    const postsS = [0.45, 1.95, 3.45, landEnd - 0.15];
    const posts = postsS.map((s) => {
      const base = FW(s, 0.07, surf(s) + 0.0);
      base[1] = yF + surf(s);
      const top = V.add(base, [0, 0.95, 0]);
      return { s, base, top };
    });
    // shadows of posts on the steps: march rays from points on the post along -L3
    const L = LW.L3;
    const castOnStairs = (p) => {
      // returns the hit point on the stair surface, or null
      let q = p.slice();
      for (let it = 0; it < 400; it++) {
        q = [q[0] - L[0] * 0.01, q[1] - L[1] * 0.01, q[2] - L[2] * 0.01];
        const rel = V.sub(q, nr.o);
        const s = V.dot(rel, nr.D), w = V.dot(rel, nr.N);
        if (w < 0 || w > Wd || s > landEnd) return null;
        if (q[1] <= yF + surf(s)) return q;
      }
      return null;
    };
    const shp = new LW.Pen();
    for (const p of posts) {
      const pts = [];
      for (let a = 0; a <= 0.95; a += 0.02) {
        const hit = castOnStairs(V.add(p.base, [0, a, 0]));
        if (hit && hit[1] < -0.02) pts.push(LW.proj(hit));
      }
      if (pts.length > 2) shp.line(pts, 15, 0.12, 0.4);
    }
    // rope sag points (3D) and its shadow
    const ropeStart = [PIER.x1 - 0.05, PIER.top - 0.06, PIER.z + 0.03];
    const ropeNodes = [ropeStart, ...posts.map((p) => V.add(p.top, [0, -0.04, 0]))];
    const rope3 = [];
    for (let k = 0; k < ropeNodes.length - 1; k++) {
      const a = ropeNodes[k], b = ropeNodes[k + 1];
      const span = V.dist ? 0 : Math.hypot(b[0] - a[0], b[2] - a[2]);
      for (let t = 0; t <= 1.0001; t += 0.04) {
        const p = V.lerp(a, b, t);
        p[1] -= (0.08 + span * 0.05) * 4 * t * (1 - t);
        rope3.push(p);
      }
    }
    {
      let run = [];
      for (const p of rope3) {
        const hit = castOnStairs(p);
        if (hit && hit[1] < -0.02) run.push(LW.proj(hit));
        else { if (run.length > 2) shp.line(run, 9, 0.15, 0.3); run = []; }
      }
      if (run.length > 2) shp.line(run, 9, 0.15, 0.3);
    }
    shp.draw(ink, C.ink, 0.82);
    // posts
    for (const p of posts) {
      const b = LW.proj(p.base), t = LW.proj(p.top);
      const z = p.base[2];
      const hw = (0.022 * LW.cam.f) / z;
      const quad = [[b[0] - hw, b[1]], [b[0] + hw, b[1]], [t[0] + hw, t[1]], [t[0] - hw, t[1]]];
      const path = LW.polyPath(quad);
      LW.occlude(path);
      LW.flat(path, IRON);
      const lit = [[b[0] - hw, b[1]], [b[0] - hw * 0.25, b[1]], [t[0] - hw * 0.25, t[1]], [t[0] - hw, t[1]]];
      LW.flat(LW.polyPath(lit), IRON_LIT);
      const pp = new LW.Pen();
      LW.outline(pp, quad, 2.4, 0.6);
      // hatch the shadow side
      for (let x = 0.1; x < 1; x += 0.22) pp.line([[LW.lerp(b[0] - hw, b[0] + hw, 0.35 + x * 0.6), b[1]], [LW.lerp(t[0] - hw, t[0] + hw, 0.35 + x * 0.6), t[1]]], 1.2, 0.1);
      // lead collar at the foot and the eye at the top
      const col = new Path2D(); col.ellipse(b[0], b[1], hw * 1.9, hw * 0.55, 0, 0, LW.TAU);
      LW.occlude(col); LW.flat(col, '#7c746a');
      pp.p.addPath(col); pp.n++;
      LW.outline(pp, Array.from({ length: 24 }, (_, i) => [b[0] + Math.cos(i / 24 * LW.TAU) * hw * 1.9, b[1] + Math.sin(i / 24 * LW.TAU) * hw * 0.55]), 2.0, 0.5);
      const eye = new Path2D(); eye.ellipse(t[0], t[1] - hw * 1.1, hw * 1.5, hw * 1.5, 0, 0, LW.TAU);
      LW.occlude(eye); LW.flat(eye, IRON);
      pp.p.addPath(eye); pp.n++;
      pp.draw(ink, C.ink);
      const hole = new Path2D(); hole.ellipse(t[0], t[1] - hw * 1.1, hw * 0.7, hw * 0.7, 0, 0, LW.TAU);
      LW.occlude(hole);
    }
    // rope: a twisted hemp tube
    {
      const pts = rope3.map((p) => LW.proj(p));
      const rad = rope3.map((p) => (0.019 * LW.cam.f) / p[2]);
      const left = [], right = [];
      for (let i = 0; i < pts.length; i++) {
        const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
        let dx = b[0] - a[0], dy = b[1] - a[1];
        const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
        left.push([pts[i][0] - dy * rad[i], pts[i][1] + dx * rad[i]]);
        right.push([pts[i][0] + dy * rad[i], pts[i][1] - dx * rad[i]]);
      }
      const tube = left.concat(right.slice().reverse());
      const path = LW.polyPath(tube);
      LW.occlude(path);
      LW.flat(path, HEMP);
      const rp = new LW.Pen();
      rp.line(left, rad.map((r) => Math.max(1.6, r * 0.35)), 0.02);
      rp.line(right, rad.map((r) => Math.max(1.2, r * 0.2)), 0.02);
      // strands: diagonal twist marks
      const dense = LW.resample(pts, 3);
      let acc = 0;
      for (let i = 1; i < dense.length - 1; i++) {
        const p = dense[i];
        const z = rope3[Math.min(rope3.length - 1, Math.floor((i / dense.length) * rope3.length))][2];
        const r = (0.019 * LW.cam.f) / z;
        acc += 3;
        if (acc < r * 0.9) continue;
        acc = 0;
        const a = dense[i - 1], b = dense[i + 1];
        let dx = b[0] - a[0], dy = b[1] - a[1];
        const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
        const nx = -dy, ny = dx;
        const p0 = [p[0] + nx * r * 0.95 - dx * r * 0.5, p[1] + ny * r * 0.95 - dy * r * 0.5];
        const p1 = [p[0] - nx * r * 0.95 + dx * r * 0.5, p[1] - ny * r * 0.95 + dy * r * 0.5];
        rp.line([p0, [(p0[0] + p1[0]) / 2 + dx * r * 0.15, (p0[1] + p1[1]) / 2 + dy * r * 0.15], p1], Math.max(1, r * 0.13), 0.3);
      }
      rp.draw(ink, C.ink);
    }
    // ---------------------------------------------------------- clay pot on the pier cap
    {
      // the pot's shadow on the cap stone (falls back and right)
      const c0 = LW.proj([(PIER.x0 + PIER.x1) / 2 + 0.06, PIER.top + 0.09, PIER.z + 0.36]);
      const kk = LW.cam.f / (PIER.z + 0.36);
      const shp2 = new Path2D(); shp2.ellipse(c0[0], c0[1], 0.15 * kk, 0.035 * kk, -0.05, 0, LW.TAU);
      LW.flat(shp2, '#b8a77c');
      const sp3 = new LW.Pen();
      LW.hatchDither(sp3, { x0: c0[0] - 0.15 * kk, y0: c0[1] - 0.035 * kk, x1: c0[0] + 0.15 * kk, y1: c0[1] + 0.035 * kk }, -0.3, { spacing: 3, step: 3, wob: 0.4, seed: 5, inside: (x, y) => ((x - c0[0]) / (0.15 * kk)) ** 2 + ((y - c0[1]) / (0.035 * kk)) ** 2 < 1, dark: () => 0.8, w: () => 1.0 });
      sp3.draw(ink, C.ink);
    }
    LW.drawPot(LW.proj([(PIER.x0 + PIER.x1) / 2 - 0.02, PIER.top + 0.09, PIER.z + 0.24]), (LW.cam.f / (PIER.z + 0.24)), rnd);
    {
      // iron ring-bolt where the rope is tied to the pier
      const rb = LW.proj(ropeStart);
      const kk = LW.cam.f / ropeStart[2];
      const rr = 0.03 * kk;
      const ring = [];
      for (let a = 0; a < LW.TAU; a += 0.3) ring.push([rb[0] + Math.cos(a) * rr * 0.6, rb[1] + Math.sin(a) * rr]);
      const rp2 = new LW.Pen();
      LW.outline(rp2, ring, 3.2, 0.6);
      rp2.dot(rb[0] - rr * 0.7, rb[1], rr * 0.35);
      // the rope's knot: a few wraps
      for (let k = 0; k < 3; k++) rp2.line([[rb[0] - rr * 0.6 + k * 4, rb[1] - rr * 0.9], [rb[0] - rr * 0.2 + k * 4, rb[1] + rr * 0.9]], 2.2, 0.2);
      rp2.draw(ink, C.ink);
    }
    {
      // a wall lizard basking on a sunlit tread
      const st = steps[6];
      const base = FW(st.s0 + 0.17, 0.75, st.yT);
      LW.lizard(base, LW.cam.f / base[2], -0.12, rnd);
    }
    await LW.tick();
    LW.fgPath = fg;
    LW.fgPathH = fgH;
    await drawOutcrop(rnd);
  };

  // dappled shade from the canopy overhead (beyond the frame) over the foreground
  LW.drawShade = async function () {
    const fgV = LW.fgPath, fgH = LW.fgPathH;
    if (!fgV) return;
    const fg = new Path2D(); fg.addPath(fgV); fg.addPath(fgH);
    const x0 = -10, y0 = 2600, w = 2000, h = 1250, res = 0.5;
    const field = (x, y) => 0.95 * LW.smooth(3000, 3650, y) - 0.42 + 0.55 * LW.fbm(x * 0.0026 + 3, y * 0.005, 2) + 0.12 * LW.noise2(x * 0.007, y * 0.012) + 0.07 * LW.noise3(x * 0.03, y * 0.05) + 0.04 * LW.noise(x * 0.08, y * 0.12);
    const mc = LW.canvas(w * res, h * res);
    const mg = mc.getContext('2d');
    const id = mg.createImageData(mc.width, mc.height);
    for (let j = 0; j < mc.height; j++) for (let i = 0; i < mc.width; i++) {
      const v = field(x0 + i / res, y0 + j / res);
      const q = (j * mc.width + i) * 4;
      id.data[q + 3] = v > 0 ? 255 : 0;
    }
    mg.putImageData(id, 0, 0);
    // colour: multiply a cool grey-teal into the fill plate within the dapple
    const S = LW.S;
    const tint = LW.canvas(LW.W * S, LW.H * S);
    const tg = tint.getContext('2d');
    tg.setTransform(S, 0, 0, S, 0, 0);
    const notOut = new Path2D();
    notOut.rect(-100, -100, LW.W + 200, LW.H + 200);
    if (LW.outcropPath) notOut.addPath(LW.outcropPath);
    if (LW.nicheP) notOut.addPath(LW.nicheP);
    tg.save(); tg.clip(fg); tg.clip(notOut, 'evenodd');
    tg.imageSmoothingEnabled = true;
    tg.drawImage(mc, x0, y0, w, h);
    tg.restore();
    tg.globalCompositeOperation = 'source-in';
    tg.fillStyle = '#a7ae9c';
    tg.fillRect(0, 0, LW.W, LW.H);
    const fgc = LW.fill;
    fgc.save();
    fgc.setTransform(1, 0, 0, 1, 0, 0);
    fgc.globalCompositeOperation = 'multiply';
    fgc.drawImage(tint, 0, 0);
    fgc.restore();
    // ink: diagonal hatching inside the shade, edge strokes on the dapple border
    const pen = new LW.Pen();
    const inside = (x, y) => field(x, y) > 0;
    for (const [P2, ang] of [[fgH, -0.5], [fgV, 0.08]]) {
      LW.ink.save(); LW.ink.clip(P2); LW.ink.clip(notOut, 'evenodd');
      LW.hatchDither(pen, { x0, y0, x1: x0 + w, y1: y0 + h }, ang, {
        spacing: 3.4, step: 4, wob: 0.9, seed: 91, jitter: 0.06, inside,
        dark: (x, y) => LW.clamp(0.42 + 0.6 * field(x, y), 0, 0.95),
        w: (x, y, d) => 0.6 + 1.2 * d, taper: 0.25,
      });
      // cross-hatch deepening toward the bottom edge of the picture
      LW.hatchDither(pen, { x0, y0: 3300, x1: x0 + w, y1: y0 + h }, ang + 1.25, {
        spacing: 4.2, step: 4, wob: 0.9, seed: 92, inside,
        dark: (x, y) => LW.smooth(3350, 3840, y) * 0.85,
        w: () => 1.0, taper: 0.3,
      });
      pen.draw(LW.ink, LW.C.ink);
      LW.ink.restore();
    }
    LW.ink.save();
    LW.ink.restore();
  };

  // dark rock buttress framing the right edge (our side of the cove)
  async function drawOutcrop(rnd) {
    const ctrl = [[2240, 1430], [2120, 1470], [2030, 1540], [1985, 1650], [1955, 1780], [1975, 1900], [1925, 2060], [1945, 2240], [1900, 2420], [1915, 2620], [1870, 2830], [1890, 3050], [1845, 3290], [1862, 3560], [1830, 3900], [2240, 3900]];
    const edge = LW.wobble(LW.spline(ctrl.slice(0, -1), 6), 9, 0.012, 4);
    const poly = edge.concat([[2240, 3900]]);
    const path = LW.polyPath(poly);
    LW.outcropPath = path;
    LW.occlude(path);
    LW.flat(path, '#6f5b46');
    const ink = LW.ink;
    // silhouette x at each row, for the sunlit rim
    const edgeX = new Float32Array(4000).fill(2240);
    for (let i = 1; i < edge.length; i++) {
      const [x0, y0] = edge[i - 1], [x1, y1] = edge[i];
      for (let y = Math.ceil(Math.min(y0, y1)); y <= Math.floor(Math.max(y0, y1)); y++) if (y >= 0 && y < 4000) edgeX[y] = Math.min(edgeX[y], LW.lerp(x0, x1, (y - y0) / ((y1 - y0) || 1)));
    }
    const rimW = (y) => 16 + 14 * (0.5 + 0.5 * LW.noise(y * 0.006, 4.4));
    const rimAt = (x, y) => LW.smooth(rimW(y) + 14, rimW(y) * 0.4, x - edgeX[LW.clamp(y | 0, 0, 3999)]);
    LW.fill.save(); LW.fill.clip(path); ink.save(); ink.clip(path);
    // irregular, vertically elongated facets (power diagram)
    const sites = [];
    const sr = LW.rng('outcrop');
    for (let tries = 0; tries < 400 && sites.length < 32; tries++) {
      const c = { x: sr.range(1800, 2240), y: sr.range(1400, 3950), w: sr.range(0, 2500), r: LW.rng(900 + tries) };
      if (sites.every((o2) => (o2.x - c.x) ** 2 + ((o2.y - c.y) * 0.55) ** 2 > 120 * 120)) sites.push(c);
    }
    {
      // base ruling so nothing is left as a bare flat
      const bp = new LW.Pen();
      const bb0 = LW.bbox(poly, 2);
      LW.hatchDither(bp, bb0, Math.PI / 2 - 0.08, { spacing: 3.6, step: 4, wob: 1.2, seed: 3, jitter: 0.1, dark: () => 0.62, w: () => 1.1, taper: 0.2 });
      bp.draw(ink, C.ink);
    }
    const owner = (x, y) => {
      let best = 0, bd = 1e18;
      for (let k = 0; k < sites.length; k++) {
        const s2 = sites[k];
        const d = (x - s2.x) ** 2 + ((y - s2.y) * 0.55) ** 2 - s2.w;
        if (d < bd) { bd = d; best = k; }
      }
      return best;
    };
    const pen = new LW.Pen();
    const L = [-0.6, -0.55, 0.58];
    for (let k = 0; k < sites.length; k++) {
      const s2 = sites[k];
      if (owner(s2.x, s2.y) !== k) continue;
      const pts = [];
      const NR = 28;
      for (let q = 0; q < NR; q++) {
        const a = (q / NR) * LW.TAU;
        let lo = 0, hi = 900;
        for (let it = 0; it < 12; it++) {
          const m = (lo + hi) / 2;
          if (owner(s2.x + Math.cos(a) * m, s2.y + Math.sin(a) * m) === k) lo = m; else hi = m;
        }
        pts.push([s2.x + Math.cos(a) * lo, s2.y + Math.sin(a) * lo]);
      }
      const r = s2.r;
      const nx = -0.2 + r.gauss() * 0.5, ny = r.gauss() * 0.3, nz = 1;
      const lam = (nx * L[0] + ny * L[1] + nz * L[2]) / Math.hypot(nx, ny, nz);
      const d0 = LW.clamp(0.7 + 0.7 * (0.6 - lam) + 0.12 * LW.smooth(2000, 3700, s2.y), 0.5, 0.98);
      const fp = LW.polyPath(pts);
      LW.flat(fp, d0 < 0.62 ? '#8f7856' : d0 < 0.76 ? '#77634b' : d0 < 0.88 ? '#5f4f40' : '#4a3e33');
      const bb = LW.bbox(pts, 2);
      const fall = Math.PI / 2 + nx * 0.5 + r.gauss() * 0.05;
      const inF = (x, y) => LW.pointInPoly(x, y, pts);
      // darker under the facet's top edge (overhang) and toward its shadow side
      const topY = bb.y0;
      const darkF = (x, y) => LW.clamp(d0 + 0.3 * LW.smooth(topY + 70, topY, y) + 0.15 * ((x - s2.x) / (bb.w * 0.5 + 1)) + 0.08 * LW.noise(x * 0.015, y * 0.01) - 0.75 * rimAt(x, y), 0, 1);
      LW.hatchDither(pen, bb, fall, { spacing: 3.0, step: 3, wob: 1.1, seed: k * 13, jitter: 0.08, inside: inF, dark: darkF, w: (x, y, d) => 0.7 + 1.7 * d, taper: 0.2 });
      LW.hatchDither(pen, bb, fall + 0.55, { spacing: 4.0, step: 3, wob: 1.0, seed: k * 7, inside: inF, dark: (x, y) => darkF(x, y) - 0.3, w: () => 0.9, taper: 0.3 });
      if (d0 > 0.7) LW.hatchDither(pen, bb, fall - 0.6, { spacing: 4.6, step: 3, wob: 1.0, seed: k * 5, inside: inF, dark: (x, y) => darkF(x, y) - 0.55, w: () => 0.9, taper: 0.3 });
      // crack networks: branching, tapering fissures
      const crack = (x, y, a, len, w, depth) => {
        const cp = [[x, y]];
        const n = Math.max(3, Math.round(len / 10));
        for (let m = 0; m < n; m++) {
          a += r.gauss() * 0.32; x += Math.cos(a) * 10; y += Math.sin(a) * 10; cp.push([x, y]);
          if (depth > 0 && r() < 0.12) crack(x, y, a + r.sign() * r.range(0.5, 1.1), len * r.range(0.3, 0.6), w * 0.6, depth - 1);
        }
        pen.line(cp, (t) => w * (1 - 0.7 * t), 0.2, 0.2);
      };
      for (let c = 0; c < 2; c++) crack(s2.x + r.gauss() * 40, s2.y + r.gauss() * 80, fall + r.gauss() * 0.6, r.range(90, 220), r.range(2.2, 3.6), 2);
      LW.inkContour(pen, pts, (ex, ey, x, y) => {
        const sh = LW.shadowSide(ex, ey);
        return (0.8 + 4.2 * sh * sh) * (1 + 0.3 * LW.noise3(x * 0.02, y * 0.02));
      }, { taper: 0.2 });
      pen.draw(ink, C.ink);
    }
    {
      // the sunlit rim along the outcrop's edge: pale flat + sparse fine hatching
      const strip = edge.map(([x, y]) => [x, y]).concat(edge.slice().reverse().map(([x, y]) => [x + rimW(y), y]));
      const sp = LW.polyPath(strip);
      LW.clipDo(LW.fill, sp, () => LW.flat(sp, '#d3bd90'));
      const rp = new LW.Pen();
      const sbb = LW.bbox(strip, 2);
      LW.clipDo(ink, sp, () => {
        LW.hatchDither(rp, sbb, Math.PI / 2 - 0.1, { spacing: 4, step: 3, wob: 0.8, seed: 61, dark: (x, y) => 0.08 + 0.45 * LW.smooth(8, 30, x - edgeX[LW.clamp(y | 0, 0, 3999)]), w: () => 0.8 });
        rp.draw(ink, C.ink);
      });
    }
    LW.fill.restore(); ink.restore();
    const op = new LW.Pen();
    LW.outline(op, poly, 4.6, 1.0);
    op.draw(ink, C.ink);
    // a wild fig rooted in a crack, leaning out toward the steps, and a caper lower down
    LW.figBush(edgeX[2080] + 8, 2080, 200, rnd);
    LW.caper(edgeX[2930] + 4, 2930, 70, rnd);
    // ferns and tufts in its crevices
    for (let k = 0; k < 7; k++) {
      const y = rnd.range(1700, 3600);
      let x = 0;
      for (const p of edge) if (Math.abs(p[1] - y) < 8) { x = p[0]; break; }
      if (!x) continue;
      LW.fern(x + rnd.range(-10, 30), y, rnd.range(90, 170), Math.PI + rnd.range(0.3, 0.9), rnd);
    }
  }

  // wild fig: a few woody stems with big lobed leaves; base at (x,y), leaning left
  LW.figBush = function (x, y, size, rnd) {
    const pen = new LW.Pen();
    const leaves = [];
    const stems = new LW.Pen();
    for (let k = 0; k < 3; k++) {
      let a = Math.PI + (k - 1) * 0.55 + rnd.gauss() * 0.12, px = x, py = y;
      const L = size * rnd.range(0.7, 1.1);
      const pts = [[px, py]];
      for (let m = 0; m < 8; m++) { a += rnd.gauss() * 0.15 - 0.03; px += Math.cos(a) * L / 8; py += Math.sin(a) * L / 8; pts.push([px, py]); }
      stems.line(pts, (t) => 9 * (1 - 0.7 * t), 0.05);
      pen.line(pts.map(([qx, qy], i) => [qx + 3.5 * (1 - 0.7 * i / 8), qy + 2]), 2.2, 0.1);
      pen.line(pts.map(([qx, qy], i) => [qx - 3.5 * (1 - 0.7 * i / 8), qy - 2]), 1.2, 0.1);
      for (let m = 5; m <= 8; m += 3) leaves.push([pts[m][0], pts[m][1], a + rnd.gauss() * 0.6 - 0.2 + (m === 8 ? 0 : rnd.sign() * 0.9), size * rnd.range(0.32, 0.42)]);
    }
    stems.draw(LW.fill, '#8a7a62');
    pen.draw(LW.ink, LW.C.ink);
    leaves.sort((a, b) => a[1] - b[1]);
    for (const [lx, ly, la, ls] of leaves) {
      // fig leaf: petiole at the origin, blade along +u with 3 or 5 rounded lobes
      const lobes = rnd() < 0.5 ? 3 : 5;
      const loc = [];
      const N = 90;
      for (let i = 0; i <= N; i++) {
        const t = i / N; // 0..1 around the blade, from the base round the tip and back
        const th = -Math.PI * 0.92 + t * Math.PI * 1.84; // angle from the blade axis
        const k = (th / (Math.PI * 0.92) + 1) / 2 * lobes; // lobe coordinate
        const f = k - Math.floor(k);
        const lobeR = 1 - Math.pow(Math.abs(2 * f - 1), 2.4); // broad lobes, narrow deep sinuses
        const li = Math.min(lobes - 1, Math.floor(k)), mid = (lobes - 1) / 2;
        const lobeLen = 1 - 0.22 * Math.abs(li - mid); // central lobe longest
        const rr = ls * (0.42 + 0.58 * lobeR) * lobeLen * (1 - 0.2 * Math.abs(th) / Math.PI);
        loc.push([ls * 0.15 + Math.cos(th) * rr, Math.sin(th) * rr * 0.9]);
      }
      const ca = Math.cos(la), sa = Math.sin(la);
      const T = (u, v) => [lx + u * ca - v * sa, ly + u * sa + v * ca];
      const sp = loc.map(([u, v]) => T(u, v));
      const lp = LW.polyPath(sp);
      LW.occlude(lp);
      LW.flat(lp, rnd() < 0.5 ? '#3f7262' : '#355f55');
      LW.clipDo(LW.fill, lp, () => {
        const half = [T(-ls, -ls * 1.2), T(ls * 1.5, -ls * 1.2), T(ls * 1.5, 0), T(-ls, 0)];
        LW.flat(LW.polyPath(half), la > Math.PI / 2 && la < 1.5 * Math.PI ? '#6f9c86' : '#2a4d47');
      });
      LW.outline(pen, sp, 2.0, 1.2);
      // midrib and lobe veins
      const base = T(ls * 0.15, 0);
      for (let v = 0; v < lobes; v++) {
        const th = -Math.PI * 0.92 + ((v + 0.5) / lobes) * Math.PI * 1.84;
        const rr = ls * 0.8 * (1 - 0.25 * Math.abs(th) / Math.PI);
        pen.line([base, T(ls * 0.15 + Math.cos(th) * rr * 0.5, Math.sin(th) * rr * 0.45), T(ls * 0.15 + Math.cos(th) * rr, Math.sin(th) * rr * 0.9)], 1.3, 0.3);
      }
      // shade strokes on the darker half
      const sb = LW.bbox(sp);
      LW.hatchDither(pen, sb, la + 0.9, { spacing: 3.4, step: 2, wob: 0.3, seed: lx | 0, inside: (qx, qy) => LW.pointInPoly(qx, qy, sp) && ((qx - lx) * -sa + (qy - ly) * ca) > ls * 0.1, dark: () => 0.62, w: () => 0.9 });
      pen.line([[lx - ca * ls * 0.25, ly - sa * ls * 0.25], base], 1.8, 0.2);
      pen.draw(LW.ink, LW.C.ink);
    }
    pen.draw(LW.ink, LW.C.ink);
  };

  // a fern frond fan: base point, size, main direction
  LW.fern = function (x, y, size, dir, rnd) {
    const pen = new LW.Pen();
    const fronds = rnd.int(3, 6);
    const fillP = new LW.Pen();
    for (let f = 0; f < fronds; f++) {
      const a0 = dir + rnd.gauss() * 0.45;
      const L = size * rnd.range(0.6, 1.1);
      const curl = rnd.gauss() * 0.9 + 0.6;
      const stem = [];
      for (let t = 0; t <= 1.0001; t += 0.05) {
        const a = a0 + curl * t * t * 0.9 * (a0 > Math.PI / 2 && a0 < 1.5 * Math.PI ? -1 : 1);
        const prev = stem.length ? stem[stem.length - 1] : [x, y];
        stem.push(t === 0 ? [x, y] : [prev[0] + Math.cos(a) * L * 0.05, prev[1] + Math.sin(a) * L * 0.05 + t * 1.5]);
      }
      pen.line(stem, 2.2, 0.1);
      for (let k = 2; k < stem.length - 1; k++) {
        const t = k / (stem.length - 1);
        const p = stem[k], q = stem[k + 1];
        const ta = Math.atan2(q[1] - p[1], q[0] - p[0]);
        const ll = L * 0.17 * Math.sin(t * Math.PI) * (1.1 - t * 0.5);
        for (const sd of [-1, 1]) {
          const la = ta + sd * 1.05;
          const tip = [p[0] + Math.cos(la) * ll, p[1] + Math.sin(la) * ll + ll * 0.25];
          const mid = [(p[0] + tip[0]) / 2 - Math.sin(la) * ll * 0.15 * sd, (p[1] + tip[1]) / 2 + Math.cos(la) * ll * 0.15 * sd];
          fillP.line([p, mid, tip], ll * 0.42, 0.5, 0.1);
          pen.line([p, mid, tip], 1.1, 0.4);
        }
      }
    }
    fillP.draw(LW.fill, LW.C.moss);
    pen.draw(LW.ink, LW.C.ink);
  };

  // lichen rosettes: ochre/grey-green rings with a dotted ink rim
  function lichen(bb, inside, rnd, density) {
    const n = Math.floor(bb.w * bb.h * density);
    const pen = new LW.Pen();
    for (let k = 0; k < n; k++) {
      const x = rnd.range(bb.x0, bb.x1), y = rnd.range(bb.y0, bb.y1);
      if (!inside(x, y)) continue;
      const cnt = rnd.int(2, 6);
      for (let m = 0; m < cnt; m++) {
        const cx = x + rnd.gauss() * 14, cy = y + rnd.gauss() * 6;
        const r = rnd.range(4, 13);
        const e = new Path2D(); e.ellipse(cx, cy, r, r * 0.45, 0, 0, LW.TAU);
        LW.fill.save(); LW.fill.globalAlpha = 0.55; LW.flat(e, rnd() < 0.5 ? '#c2a466' : '#a9b394'); LW.fill.restore();
        for (let a = 0; a < LW.TAU; a += 0.7) pen.dot(cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.45, 0.9);
      }
    }
    pen.draw(LW.ink, C.ink);
  }
  LW.lichen = lichen;

  // wall lizard seen from above on a horizontal surface; p3 = world point, k = px per metre
  LW.lizard = function (p3, k, heading, rnd) {
    const c = LW.proj(p3);
    const L = 0.34 * k; // nose to tail tip in px (foreshortened below)
    const sq = 0.72; // vertical squash of a horizontal plane seen from above at this angle
    const ca = Math.cos(heading), sa = Math.sin(heading);
    const T = (u, v) => [c[0] + (u * ca - v * sa) * L, c[1] + (u * sa + v * ca) * L * sq];
    // spine: S-curve
    const spine = [];
    for (let t = 0; t <= 1.0001; t += 0.04) spine.push([0.5 - t, 0.06 * Math.sin(t * 7.5) * t]);
    const width = (t) => 1.25 * (t < 0.08 ? 0.035 * Math.sqrt(t / 0.08) + 0.01 : t < 0.14 ? 0.036 : t < 0.42 ? 0.05 - 0.01 * Math.cos((t - 0.14) / 0.28 * Math.PI) : 0.045 * (1 - (t - 0.42) / 0.58) + 0.003);
    const left = [], right = [];
    for (let i = 0; i < spine.length; i++) {
      const t = i / (spine.length - 1);
      const a = spine[Math.max(0, i - 1)], b = spine[Math.min(spine.length - 1, i + 1)];
      let dx = b[0] - a[0], dy = b[1] - a[1];
      const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
      const w = width(t);
      left.push([spine[i][0] - dy * w, spine[i][1] + dx * w]);
      right.push([spine[i][0] + dy * w, spine[i][1] - dx * w]);
    }
    const body = left.concat(right.reverse()).map(([u, v]) => T(u, v));
    // shadow
    const sh = new LW.Pen();
    sh.line(spine.map(([u, v]) => { const q = T(u, v); return [q[0] + 5, q[1] + 6]; }), spine.map((_, i) => width(i / (spine.length - 1)) * 2 * L * 0.8), 0.2);
    sh.draw(LW.ink, C.ink, 0.35);
    const pen = new LW.Pen();
    const bp = LW.polyPath(body);
    LW.occlude(bp);
    LW.flat(bp, '#8c8a4b');
    // dorsal pattern: dark reticulation and a pale flank stripe
    LW.clipDo(LW.fill, bp, () => {
      const st = new LW.Pen();
      st.line(spine.slice(2, 14).map(([u, v]) => T(u, v + 0.022)), 0.012 * L, 0.3);
      st.line(spine.slice(2, 14).map(([u, v]) => T(u, v - 0.022)), 0.012 * L, 0.3);
      st.draw(LW.fill, '#c7bf86');
    });
    pen.draw(LW.ink, C.ink);
    // legs: splayed with toes
    const legs = [[0.36, 1, -0.6], [0.36, -1, 0.5], [0.08, 1, 0.7], [0.08, -1, -0.5]];
    const legFill = new LW.Pen();
    for (const [u0, side, sw] of legs) {
      const v0 = spine[Math.round((0.5 - u0) / 0.04)][1];
      const knee = [u0 + sw * 0.04, v0 + side * 0.085];
      const foot = [u0 + sw * 0.09, v0 + side * 0.12];
      const pts = [T(u0, v0 + side * 0.03), T(knee[0], knee[1]), T(foot[0], foot[1])];
      legFill.line(pts, 0.026 * L, 0.1);
      pen.line(pts, 1.6, 0.1);
      for (let tt = -1; tt <= 1; tt++) {
        const a = Math.atan2(side, sw) + tt * 0.5;
        pen.line([T(foot[0], foot[1]), T(foot[0] + Math.cos(a) * 0.025 * sw, foot[1] + Math.sin(a) * 0.025)], 1.0, 0.3);
      }
    }
    legFill.draw(LW.fill, '#7d7a43');
    for (const lg of []) void lg;
    LW.stipple(pen, LW.bbox(body), 70, { rng: rnd, inside: (x, y) => LW.pointInPoly(x, y, body), r: [0.8, 1.8], dark: () => 1 });
    LW.outline(pen, body, 1.6, 1.0);
    const eye = T(0.45, 0.015);
    pen.dot(eye[0], eye[1], 1.4);
    pen.draw(LW.ink, C.ink);
  };

  // a tuft of grass blades with a seed head or two; base (x,y), height px
  LW.grass = function (x, y, h, rnd) {
    const pen = new LW.Pen(), fillP = new LW.Pen();
    const nb = rnd.int(6, 12);
    for (let k = 0; k < nb; k++) {
      const a = -Math.PI / 2 + rnd.gauss() * 0.45;
      const L = h * rnd.range(0.45, 1.0), bend = rnd.gauss() * 0.5;
      const pts = [];
      for (let t = 0; t <= 1.0001; t += 0.2) {
        const aa = a + bend * t * t;
        pts.push([x + rnd.gauss() * 0.5 + Math.cos(aa) * L * t + (k - nb / 2) * 1.6, y + Math.sin(aa) * L * t]);
      }
      fillP.line(pts, (t) => 3.2 * (1 - t) + 0.4, 0.05);
      pen.line(pts, (t) => 1.3 * (1 - 0.7 * t), 0.1);
      if (k < 2 && rnd() < 0.6) { const e = pts[pts.length - 1]; for (let m = 0; m < 4; m++) pen.dot(e[0] + rnd.gauss() * 2, e[1] + m * 3, 1.6); }
    }
    fillP.draw(LW.fill, '#8a9a5a');
    pen.draw(LW.ink, C.ink);
  };

  // moss tuft (fill + ink scallops)
  function mossTuft(x, y, r, rnd) {
    const pts = [];
    const n = 9;
    for (let k = 0; k <= n; k++) {
      const a = Math.PI + (k / n) * Math.PI;
      const rr = r * (0.7 + 0.5 * rnd());
      pts.push([x + Math.cos(a) * rr * 1.5, y + Math.sin(a) * rr * 0.8]);
    }
    const path = LW.polyPath(pts);
    LW.occlude(path);
    LW.flat(path, rnd() < 0.5 ? C.moss : C.tealLight);
    const p = new LW.Pen();
    for (let k = 0; k < pts.length - 1; k++) {
      const a = pts[k], b = pts[k + 1];
      p.line([a, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 - r * 0.25], b], 1.1, 0.3);
    }
    for (let k = 0; k < 3; k++) {
      const xx = x + rnd.range(-r, r);
      p.line([[xx, y], [xx + rnd.gauss() * 2, y - r * rnd.range(0.3, 0.8)]], 0.9, 0.4);
    }
    p.draw(LW.ink, C.ink);
  }
  LW.mossTuft = mossTuft;

  // terracotta pot with a flowering geranium; c = screen point of the pot's base centre, k = px per metre
  LW.drawPot = function (c, k, rnd) {
    const H = 0.27 * k, rt = 0.12 * k, rb = 0.08 * k;
    const prof = [];
    for (let t = 0; t <= 1.0001; t += 0.05) {
      const r = LW.lerp(rb, rt, Math.pow(t, 0.85)) + Math.sin(t * Math.PI) * 0.012 * k;
      prof.push([r, c[1] - t * H]);
    }
    const body = prof.map(([r, y]) => [c[0] + r, y]).concat(prof.slice().reverse().map(([r, y]) => [c[0] - r, y]));
    const path = LW.polyPath(body);
    LW.occlude(path);
    LW.flat(path, C.terracotta);
    const p = new LW.Pen();
    // curved vertical hatching, dense on the right (shadow side)
    for (let s = -0.95; s <= 0.95; s += 0.075) {
      const dk = LW.clamp(0.15 + 0.85 * (s * 0.5 + 0.5) ** 1.5, 0, 1);
      if (dk < 0.25) continue;
      const q = prof.slice(1, -2).map(([r, y]) => [c[0] + r * s, y + Math.sqrt(1 - s * s) * 0.04 * k]);
      p.line(q, 0.6 + 1.8 * dk, 0.2);
    }
    LW.outline(p, body, 2.6, 1.2);
    // rim (thick lip) seen from slightly above
    const rimY = c[1] - H;
    const rim = new Path2D(); rim.ellipse(c[0], rimY, rt * 1.12, rt * 0.3, 0, 0, LW.TAU);
    LW.occlude(rim); LW.flat(rim, '#c97a4c');
    const rimIn = new Path2D(); rimIn.ellipse(c[0], rimY - rt * 0.02, rt * 0.9, rt * 0.22, 0, 0, LW.TAU);
    LW.flat(rimIn, '#4a3020');
    const ell = (rx, ry, yy) => Array.from({ length: 40 }, (_, i) => [c[0] + Math.cos((i / 40) * LW.TAU) * rx, yy + Math.sin((i / 40) * LW.TAU) * ry]);
    LW.outline(p, ell(rt * 1.12, rt * 0.3, rimY), 2.4, 0.8);
    LW.outline(p, ell(rt * 0.9, rt * 0.22, rimY - rt * 0.02), 1.6, 0.5);
    const lipB = ell(rt * 1.08, rt * 0.3, rimY + 0.03 * k).filter((q) => q[1] > rimY + 0.03 * k);
    p.line(lipB.sort((a, b) => a[0] - b[0]), 1.8, 0.1);
    p.draw(LW.ink, C.ink);
    // geranium: a dome of round leaves with a few flower heads
    const leaves = [];
    for (let i = 0; i < 26; i++) {
      const a = -Math.PI / 2 + rnd.gauss() * 0.95;
      const d = rnd.range(0.2, 1) * rt * 1.6;
      leaves.push([c[0] + Math.cos(a) * d * 1.3, rimY - rt * 0.2 + Math.sin(a) * d * 0.9, rt * rnd.range(0.28, 0.45)]);
    }
    leaves.sort((a, b) => a[1] - b[1]);
    for (const [x, y, r] of leaves) {
      const pts = [];
      const rot = rnd() * LW.TAU;
      for (let a = 0; a < LW.TAU; a += 0.12) {
        const lobe = 1 + 0.09 * Math.cos(a * 7 + rot) - (Math.abs(((a - rot - Math.PI / 2 + LW.TAU * 2) % LW.TAU) - Math.PI) > 2.9 ? 0.35 : 0);
        pts.push([x + Math.cos(a) * r * lobe, y + Math.sin(a) * r * lobe * 0.72]);
      }
      const lp = LW.polyPath(pts);
      LW.occlude(lp);
      const lowLeaf = y > rimY - rt * 0.5;
      LW.flat(lp, lowLeaf ? C.tealDark : y < rimY - rt * 0.9 ? C.tealLight : C.teal);
      // the dark horseshoe zone
      const q = new LW.Pen();
      const zone = [];
      for (let a = rot + 0.6; a < rot + LW.TAU - 0.6; a += 0.12) zone.push([x + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.55 * 0.72]);
      q.line(zone, r * 0.22, 0.3);
      LW.clipDo(LW.fill, lp, () => q.draw(LW.fill, lowLeaf ? C.tealDeep : C.tealDark, 0.8));
      const ink2 = new LW.Pen();
      LW.outline(ink2, pts, 1.7, 1.5);
      for (let v = 0; v < 6; v++) {
        const a = rot + 0.9 + v * 0.75;
        ink2.line([[x, y], [x + Math.cos(a) * r * 0.85, y + Math.sin(a) * r * 0.85 * 0.72]], 0.9, 0.5);
      }
      // shade the lower half of each leaf
      for (let k = 0; k < 5; k++) {
        const yy = y + r * 0.72 * (0.15 + k * 0.17);
        const half = Math.sqrt(Math.max(0, 1 - ((yy - y) / (r * 0.72)) ** 2)) * r * 0.9;
        ink2.line([[x - half * 0.2, yy], [x + half, yy - 2]], 0.8 + 0.25 * k, 0.4);
      }
      ink2.draw(LW.ink, C.ink);
    }
    for (let f = 0; f < 4; f++) {
      const fx = c[0] + rnd.range(-1.2, 1.2) * rt, fy = rimY - rt * rnd.range(1.0, 1.9);
      const q = new LW.Pen();
      q.line([[fx, fy + rt * 0.6], [fx + rnd.gauss() * 4, fy]], 1.4, 0.2);
      for (let m = 0; m < 7; m++) {
        const a = rnd() * LW.TAU, d = rnd() * rt * 0.28;
        const px = fx + Math.cos(a) * d, py = fy + Math.sin(a) * d * 0.8;
        const pr = rt * rnd.range(0.09, 0.14);
        const fpth = new Path2D(); fpth.ellipse(px, py, pr, pr * 0.85, 0, 0, LW.TAU);
        LW.occlude(fpth); LW.flat(fpth, '#c4513a');
        const cp = Array.from({ length: 12 }, (_, i) => [px + Math.cos(i / 12 * LW.TAU) * pr, py + Math.sin(i / 12 * LW.TAU) * pr * 0.85]);
        LW.outline(q, cp, 1.2, 1.0);
      }
      q.draw(LW.ink, C.ink);
    }
  };
})();
