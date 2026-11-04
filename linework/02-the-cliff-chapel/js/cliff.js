// cliff.js - the sea cliff as an engraved relief: a displacement field over the
// (leaning) face plane gives buttresses, lumps and bedding ledges; it is shaded
// with streamlines that follow the relief's contour lines (form-following
// hatching), crossed in the darks, outlined with iso-contours on the shadow
// side, and darkened by the cast shadows of the stairs.
(function () {
  'use strict';
  const LW = window.LW, C = LW.C, V = LW.V;
  const ROCK = ['#e6d4a6', '#d9c391', '#c9ae78', '#b09265'];

  LW.cliffGeom = function () {
    if (LW._cliffGeom) return LW._cliffGeom;
    const S = LW.scene;
    // skyline control points (u, h, d)
    const ctrl = [
      [0.25, 5.4, 0], [0.55, 6.3, -0.1], [0.8, 7.7, -0.2], [1.5, 8.2, -0.3], [2.0, 9.5, -0.4], [2.6, 10.2, -0.8],
      [3.4, 11.0, -1.3], [4.3, 11.5, -1.8], [5.2, S.summitH, -2.4], [13.6, S.summitH, -2.4], [14.3, S.summitH + 0.5, -2.1],
      [15.2, S.summitH + 0.9, -1.8], [16.2, S.summitH + 1.2, -1.6], [17.5, S.summitH + 1.5, -1.3], [19.5, S.summitH + 1.8, -1],
    ];
    const sky = [];
    for (let i = 0; i < ctrl.length - 1; i++) {
      const a = ctrl[i], b = ctrl[i + 1];
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const m = Math.max(2, Math.ceil(L / 0.1));
      for (let k = 0; k < m; k++) {
        const t = k / m;
        const u = LW.lerp(a[0], b[0], t);
        let h = LW.lerp(a[1], b[1], t);
        const flat = u > 5.0 && u < 13.8;
        h += (flat ? 0.03 : 0.18) * LW.fbm(u * 1.7, 4.2, 3) + (flat ? 0 : 0.12 * LW.ridge(u * 3.1, 1.1, 2));
        sky.push(S.faceP(u, h, LW.lerp(a[2], b[2], t)));
      }
    }
    // corner profile (the headland's edge against the sea), multi-scale jagged
    const corner = [];
    const beds = LW.cliffBeds();
    const bedP = (h) => {
      for (let j = beds.length - 1; j >= 0; j--) if (h >= beds[j].h0) {
        const b = beds[j], nb = beds[j + 1];
        const t = LW.smooth(b.h0 + b.t - 0.18, b.h0 + b.t, h);
        return LW.lerp(b.p, nb ? nb.p : b.p, t * 0) * 1 + (nb ? (nb.p - b.p) * t : 0);
      }
      return 0;
    };
    for (let h = 5.4; h >= -19; h -= 0.05) {
      const u = 0.25 + 0.6 * Math.max(-0.3, LW.fbm(h * 0.16, 9.1, 2)) + 0.12 * LW.fbm(h * 0.7, 3.3, 2) + 0.03 * LW.noise2(h * 3.5, 1) + (h < -4 ? (h + 4) * -0.03 : 0) - 0.6 * bedP(h);
      corner.push(S.faceP(u, h, 0));
    }
    const poly = sky.concat([[2400, sky[sky.length - 1][1]], [2400, 4000]], [[corner[corner.length - 1][0], 4000]], corner.slice().reverse());
    const path = LW.polyPath(poly);
    const bb = LW.bbox(poly);
    const mask = LW.Mask.fromPath(path, { x0: 600, y0: 0, x1: 2200, y1: 3900 }, 0.5);
    LW._cliffGeom = { poly, path, mask, sky, corner, bb };
    return LW._cliffGeom;
  };

  // ------------------------------------------------------------------ limestone
  // The face is built as bedded limestone: beds (courses metres thick, slightly
  // wavy and tilted) split by vertical joints into big blocks. Each bed stands
  // proud or recessed; where the bed above overhangs there is an undercut shadow
  // band, below eye level the ledge tops catch light. Blocks are faceted (own
  // tilted normal) and hatched with cool umber fall-line strokes, crossed in the
  // darks; pockets and small caves sit along the bedding planes.
  const LIME = ['#ecdcb0', '#e1cd9b', '#d3bc87', '#c3ad82'];
  const HATCH = '#352c28';

  function buildBeds(rnd) {
    const beds = [];
    let h = -22;
    while (h < 16) {
      const t = rnd.range(0.8, 2.5) * (h > 8 ? 0.8 : 1);
      beds.push({ h0: h, t, p: rnd.range(0, 0.55), slope: rnd.gauss() * 0.012, seed: rnd() * 100 });
      h += t;
    }
    return beds;
  }

  LW.cliffBeds = () => LW._beds || (LW._beds = buildBeds(LW.rng('beds')));
  LW.drawCliff = async function () {
    const S = LW.scene;
    const G = LW.cliffGeom();
    const rnd = LW.rng('limestone');
    const shadow = LW.zz.shadowMask();
    const nFace = V.norm(V.add(S.NF, [0, S.LEAN, 0]));
    const fillG = LW.fill, inkG = LW.ink;
    LW.occlude(G.path);
    LW.flat(G.path, LIME[1]);
    fillG.save(); fillG.clip(G.path);
    inkG.save(); inkG.clip(G.path);
    const beds = LW.cliffBeds();
    const bedLine = (j, u) => {
      if (j >= beds.length) return 30;
      const b = beds[j];
      return b.h0 + b.slope * (u - 8) + 0.16 * LW.fbm(u * 0.22 + b.seed, b.seed, 2) + 0.03 * LW.noise2(u * 3, b.seed);
    };
    const fp = (u, h) => S.faceP(u, h, 0);
    const pen = new LW.Pen();
    const hp = new LW.Pen(); // hatch pen (cool umber)
    const lichenFill = [new LW.Pen(), new LW.Pen()], dripFill = new LW.Pen(), sprigFill = new LW.Pen();
    const flush = () => {
      dripFill.draw(fillG, '#a8916a', 0.5);
      lichenFill[0].draw(fillG, '#a8824a', 0.75);
      lichenFill[1].draw(fillG, '#8b9478', 0.8);
      sprigFill.draw(fillG, '#7f9452');
      hp.draw(inkG, HATCH); pen.draw(inkG, C.ink);
    };
    const bedChar = beds.map((_, j) => Math.floor(LW.rng('bedc' + j)() * 4));
    let blocks = 0;
    for (let j = 0; j < beds.length; j++) {
      const bd = beds[j], above = beds[j + 1] || { p: bd.p };
      // joints
      const joints = [];
      let u = -3 - rnd() * 2;
      while (u < 22) { joints.push({ u, lean: rnd.gauss() * 0.06, seed: rnd() * 50, partial: rnd() < 0.25 }); u += rnd.range(0.9, 3.4) * (bd.t > 1.8 ? 1.15 : 1); }
      const jointU = (jt, h) => jt.u + jt.lean * (h - bd.h0) + 0.06 * LW.noise(h * 1.5, jt.seed);
      for (let k = 0; k < joints.length - 1; k++) {
        const J0 = joints[k], J1 = joints[k + 1];
        // quick visibility test
        const mid = fp((J0.u + J1.u) / 2, bd.h0 + bd.t / 2);
        const c0 = fp(J0.u, bd.h0), c1 = fp(J1.u, bd.h0 + bd.t);
        if (Math.max(mid[0], c0[0], c1[0]) < 650 || Math.min(mid[1], c0[1], c1[1]) > 3900 || Math.max(mid[1], c0[1], c1[1]) < 0) continue;
        if (!G.mask.in(mid[0], mid[1]) && !G.mask.in(c0[0], c0[1]) && !G.mask.in(c1[0], c1[1])) continue;
        // polygon in (u,h): bottom, right, top, left
        const poly = [];
        const st = 0.12;
        const hb0 = bedLine(j, J0.u), hb1 = bedLine(j, J1.u);
        for (let uu = jointU(J0, hb0); uu < jointU(J1, hb1); uu += st) poly.push([uu, bedLine(j, uu)]);
        const ht0 = bedLine(j + 1, J1.u);
        for (let hh = bedLine(j, J1.u); hh < ht0; hh += st) poly.push([jointU(J1, hh), hh]);
        for (let uu = jointU(J1, ht0); uu > jointU(J0, bedLine(j + 1, J0.u)); uu -= st) poly.push([uu, bedLine(j + 1, uu)]);
        for (let hh = bedLine(j + 1, J0.u); hh > bedLine(j, J0.u); hh -= st) poly.push([jointU(J0, hh), hh]);
        if (poly.length < 6) continue;
        // chip the corners a little
        const scr = poly.map(([a, b2]) => fp(a, b2));
        const bb = LW.bbox(scr, 2);
        if (bb.w < 2 || bb.h < 2) continue;
        const r = LW.rng(j * 1000 + k * 7 + 11);
        // facet normal & base value
        const ta = r.gauss() * 0.4 - 0.05, tb = r.gauss() * 0.25 + 0.04;
        const n = V.norm(V.add(V.add(nFace, V.mul(S.U, ta)), [0, tb, 0]));
        const lam = V.dot(n, LW.L3);
        const d0 = LW.clamp(0.08 + 1.15 * (0.78 - lam) + 0.55 * (0.3 - bd.p), 0.03, 0.85);
        // a facet split: one side of a diagonal turns away from the sun
        const fa = [LW.lerp(J0.u, J1.u, r.range(0.2, 0.8)), bd.h0 + bd.t], fb = [LW.lerp(J0.u, J1.u, r.range(0.1, 0.9)), bd.h0];
        const fsplit = r() < 0.6 ? r.range(0.12, 0.26) : 0;
        const ctr = fp((J0.u + J1.u) / 2, bd.h0 + bd.t / 2);
        const topH = (uu) => bedLine(j + 1, uu);
        // undercut (bed above overhangs) or lit ledge top (we look down on it)
        const over = above.p - bd.p;
        const hTop = bd.h0 + bd.t;
        const eye = hTop > 0.3; // ledge above eye level -> we see the soffit
        const band = over > 0.14 ? 0.1 + over * 1.1 : 0;
        const ledge = !eye && over < -0.05 ? Math.min(0.35, 0.05 + -over * 0.5 * LW.clamp(-hTop / 8, 0.2, 1)) : 0;
        const toUH = (x, y) => S.unproj(x, y, 0);
        const darkAt = (x, y) => {
          const [uu, hh] = toUH(x, y);
          const dTop = topH(uu) - hh;
          let d = d0;
          d += 0.22 * LW.clamp((x - ctr[0]) / (bb.w * 0.5 + 1), -1, 1) * 0.5; // recess toward the right joint
          d += 0.18 * LW.smooth(0.5, 0.0, (jointU(J1, hh) - uu)); // shadowed right edge
          if (fsplit && (uu - fa[0]) * (fb[1] - fa[1]) - (hh - fa[1]) * (fb[0] - fa[0]) < 0) d += fsplit;
          if (band && dTop < band) return 0; // the undercut band is ruled separately
          d += 0.3 * LW.smooth(band + 0.6, band, dTop) * (band ? 1 : 0);
          d += 0.3 * LW.smooth(1950, 3300, y);
          d += 0.45 * (shadow.at(x, y) / 255);
          d += 0.08 * LW.noise(x * 0.01, y * 0.01);
          if (ledge && dTop < ledge) d = 0.02;
          return LW.clamp(d, 0, 1);
        };
        const path = LW.polyPath(scr);
        const inside = (x, y) => LW.pointInPoly(x, y, scr);
        const dc = darkAt(ctr[0], ctr[1]);
        LW.flat(path, LIME[Math.min(3, Math.floor(LW.clamp(dc, 0, 0.99) * 3.2))]);
        // flats for the undercut band / lit ledge
        if (band || ledge) {
          const bandPoly = [];
          const bh = band || ledge;
          for (let uu = poly[0][0]; uu <= jointU(J1, ht0); uu += 0.1) bandPoly.push(fp(uu, topH(uu)));
          for (let uu = jointU(J1, ht0); uu >= poly[0][0]; uu -= 0.1) bandPoly.push(fp(uu, topH(uu) - bh * (0.92 + 0.12 * LW.noise(uu * 0.6, j))));
          LW.clipDo(fillG, path, () => LW.flat(LW.polyPath(bandPoly), band ? '#a39577' : '#f3e7c4'));
          if (band) {
            const inB = (x, y) => LW.pointInPoly(x, y, bandPoly) && LW.pointInPoly(x, y, scr);
            const b0s = fp(J0.u, bd.h0 + bd.t), b1s = fp(J0.u + 0.3, bd.h0 + bd.t);
            const ang = Math.atan2(b1s[1] - b0s[1], b1s[0] - b0s[0]);
            const bbB = LW.bbox(bandPoly, 1);
            LW.hatchDither(hp, bbB, ang, { spacing: 2.5, step: 3, wob: 0.5, seed: j * 7 + k, inside: inB, dark: () => 0.97, w: () => 1.3, taper: 0.1 });
            LW.hatchDither(hp, bbB, ang + 1.3, { spacing: 3.4, step: 3, wob: 0.5, seed: j * 9 + k, inside: inB, dark: (x, y) => 0.75, w: () => 1.0, taper: 0.2 });
          }
          if (ledge) { // the ledge lip: heavy line under the lit top
            const lip = [];
            for (let uu = poly[0][0]; uu <= jointU(J1, ht0); uu += 0.1) lip.push(fp(uu, topH(uu) - ledge * (0.92 + 0.12 * LW.noise(uu * 0.6, j))));
            pen.line(lip, 2.4, 0.15);
          }
        }
        // fall-line hatching (slightly leaning per block), cross-hatch along the bed in the darks
        const a0 = fp(J0.u, hTop), a1 = fp(J0.u, hTop - 0.3);
        const fall = Math.atan2(a1[1] - a0[1], a1[0] - a0[0]) + r.gauss() * 0.06;
        const b0 = fp(J0.u, bd.h0), b1 = fp(J0.u + 0.3, bd.h0);
        const strike = Math.atan2(b1[1] - b0[1], b1[0] - b0[0]);
        LW.hatchDither(hp, bb, fall, {
          spacing: 3.0, step: 3, wob: 1.2, seed: j * 31 + k, jitter: 0.03, inside, dark: darkAt,
          w: (x, y, d) => 0.5 + 1.5 * d, taper: 0.25,
        });
        LW.hatchDither(hp, bb, strike + r.gauss() * 0.03, {
          spacing: 3.6, step: 3, wob: 0.8, seed: j * 17 + k, inside, dark: (x, y) => darkAt(x, y) - 0.48,
          w: () => 0.9, taper: 0.3,
        });
        if (fsplit) {
          const q = [];
          for (let t = 0; t <= 1.0001; t += 0.1) q.push(fp(LW.lerp(fa[0], fb[0], t) + 0.04 * LW.noise(t * 4, k), LW.lerp(fa[1], fb[1], t)));
          const qi = q.filter((pq) => inside(pq[0], pq[1]));
          if (qi.length > 2) pen.line(qi, 1.2, 0.4);
        }
        // laminations: thin broken partings inside thick beds
        if (bd.t > 1.4) {
          for (let m = 1; m < 3; m++) {
            const hh0 = bd.h0 + bd.t * (m / 3) + r.gauss() * 0.08;
            const q = [];
            for (let uu = J0.u; uu <= J1.u; uu += 0.1) {
              const pq = fp(uu, hh0 + bd.slope * (uu - 8) + 0.03 * LW.noise(uu * 2, m + j));
              if (inside(pq[0], pq[1]) && LW.noise3(uu * 0.8, m * 3 + j) > -0.2) q.push(pq); else { if (q.length > 3) pen.line(q.splice(0), 0.9, 0.4); q.length = 0; }
            }
            if (q.length > 3) pen.line(q, 0.9, 0.4);
          }
        }
        // limestone pitting and short horizontal weathering ticks
        LW.stipple(hp, bb, Math.floor(bb.w * bb.h * 0.0007), { rng: r, inside, r: [0.6, 1.4], dark: (x, y) => 0.3 + darkAt(x, y) * 0.7 });
        LW.flecks(hp, bb, Math.floor(bb.w * bb.h * 0.0005), { rng: r, inside, angle: strike, spread: 0.08, len: [4, 12], w: 1.0, dark: () => 0.8 });
        // ---- surface texture: every bed has its own character
        {
          const tr = LW.rng('ctex' + j + '_' + k);
          const ch = bedChar[j];
          const area = bb.w * bb.h;
          const TX = LW.tex;
          // a third hatch layer deepens the darkest faces (cross-hatch over hatch)
          TX.deepHatch(hp, bb, inside, darkAt, fall, { seed: j * 13 + k, layers: [[fall + 0.95, 0.6, 3.5], [strike - 0.5, 0.8, 4.4]] });
          // plate grain everywhere, thicker in shade
          TX.grain(hp, bb, inside, Math.floor(area * 0.006), tr, [0.45, 1.0], (x, y) => 0.35 + 0.65 * darkAt(x, y));
          // dry broken strokes down the fall line give the lit stone a worked surface
          TX.dry(hp, bb, inside, Math.floor(area * 0.0022), tr, fall, [8, 26], 0.7, (x, y) => 0.55 + 0.45 * (1 - darkAt(x, y)));
          TX.dry(hp, bb, inside, Math.floor(area * 0.0008), tr, strike, [6, 18], 0.65, () => 0.8);
          // pitting: vuggy beds are riddled, others lightly pocked
          TX.pits(hp, bb, inside, Math.floor(area * (ch === 0 ? 0.0016 : 0.00035)), tr, { cluster: ch === 0 ? 8 : 4, r: [1.0, ch === 0 ? 4.2 : 3.0] });
          if (ch === 1) { // shelly bed: fossil traces and broken shell hash
            const nf = Math.max(1, Math.round(area * 0.00011));
            for (let m = 0; m < nf; m++) {
              const x = tr.range(bb.x0, bb.x1), y = tr.range(bb.y0, bb.y1);
              if (inside(x, y) && darkAt(x, y) < 0.8) TX.fossil(hp, x, y, tr.range(4, 9), tr, 0.9);
            }
            TX.shellHash(hp, bb, inside, Math.floor(area * 0.0012), tr, 0.75);
          } else if (ch === 2) { // laminated bed: fine extra partings, brittle fracture networks
            for (let m = 0; m < 5; m++) {
              const hh0 = bd.h0 + bd.t * tr.range(0.08, 0.92);
              let q = [];
              for (let uu = J0.u; uu <= J1.u; uu += 0.06) {
                const pq = fp(uu, hh0 + bd.slope * (uu - 8) + 0.02 * LW.noise(uu * 3, m + j * 3));
                if (inside(pq[0], pq[1]) && LW.noise3(uu * 1.3 + m, j * 5.1) > -0.1) q.push(pq);
                else { if (q.length > 3) hp.line(q, 0.55, 0.45); q = []; }
              }
              if (q.length > 3) hp.line(q, 0.55, 0.45);
            }
            for (let m = 0; m < 3; m++) TX.fracture(hp, tr.range(bb.x0, bb.x1), tr.range(bb.y0, bb.y1), tr() * LW.TAU, tr.range(25, 70), 0.85, tr, 2, inside, 4);
          } else if (ch === 3) { // karst bed: solution runnels from the top down the fall line
            const ng = 1 + Math.floor(bb.w / 160) + (tr() < 0.5 ? 1 : 0);
            for (let m = 0; m < ng; m++) {
              const uu = LW.lerp(J0.u, J1.u, tr.range(0.12, 0.88));
              const s0 = fp(uu, topH(uu) - (band || 0) - 0.08);
              TX.runnels(hp, s0[0], s0[1], fall, tr.int(3, 6), tr.range(28, Math.min(110, bb.h * 0.8)), tr.range(5, 8), tr, inside);
            }
          }
          // hairline fracture network crossing the block
          if (tr() < 0.6) {
            const nfr = tr.int(1, 2);
            for (let m = 0; m < nfr; m++) TX.fracture(hp, tr.range(bb.x0, bb.x1), tr.range(bb.y0, bb.y0 + bb.h * 0.5), fall + tr.gauss() * 0.7, tr.range(40, 120), 1.0, tr, 2, inside, 5);
          }
          // lichen speckle on the upper, lit part of some blocks
          if (tr() < 0.24 && hTop < 12) { // a lichen run along the top of the block, under the parting
            const nl = tr.int(1, 4);
            let x = tr.range(bb.x0 + 10, bb.x1 - 10);
            const uu0 = S.unproj(x, ctr[1], 0)[0];
            for (let m = 0; m < nl; m++) {
              const uu = uu0 + m * tr.range(0.12, 0.3);
              const q = fp(uu, topH(uu) - (band || 0) - tr.range(0.08, 0.35));
              if (inside(q[0], q[1])) TX.lichen(lichenFill, hp, q[0], q[1], tr.range(5, 18) * (m ? 0.7 : 1), tr, 0.42);
            }
          }
          // drip stains run down from the bed parting under an overhang (or at random)
          if ((band && tr() < 0.75) || tr() < 0.18) {
            const nd = tr.int(1, 3);
            for (let m = 0; m < nd; m++) {
              const uu = LW.lerp(J0.u, J1.u, tr.range(0.1, 0.9));
              const s0 = fp(uu, topH(uu) - (band || 0) - 0.02);
              if (inside(s0[0], s0[1] + 3)) TX.drip(dripFill, hp, s0[0], s0[1], tr.range(30, Math.min(160, bb.h)), tr.range(3, 8), tr, inside);
            }
          }
          // a crack-plant rooted in the bed joint
          if (tr() < 0.11 && hTop < 11) {
            const uu = LW.lerp(J0.u, J1.u, tr.range(0.15, 0.85));
            const s0 = fp(uu, bedLine(j, uu) + 0.03);
            if (G.mask.in(s0[0], s0[1])) TX.sprig(sprigFill, hp, s0[0], s0[1], tr.range(12, 24), tr);
          }
        }
        // rounded/chipped edges: bed line heavy where it sits under an overhang, joint lines broken
        LW.inkContour(pen, scr, (nx, ny, x, y) => {
          const sh = LW.shadowSide(nx, ny);
          const [uu, hh] = toUH(x, y);
          const onTop = Math.abs(topH(uu) - hh) < 0.08;
          const onBot = Math.abs(bedLine(j, uu) - hh) < 0.08;
          let w = 0.6 + 2.4 * sh * sh;
          if (onTop) w = band ? 3.6 : 1.4;
          if (onBot) w = 1.6;
          if (!onTop && !onBot && J0.partial && Math.abs(uu - jointU(J0, hh)) < 0.1 && hh > bd.h0 + bd.t * 0.55) return 0;
          if (LW.noise3(x * 0.02 + k, y * 0.02 + j) > 0.55) return 0;
          return w * (0.85 + 0.3 * LW.noise3(x * 0.05, y * 0.05));
        }, { taper: 0.2 });
        if (++blocks % 12 === 0) { flush(); await LW.tick(); }
      }
    }
    flush();
    // ---- pockets and small caves along the bedding planes
    const caves = LW.rng('caves');
    for (let k = 0; k < 26; k++) {
      const j = caves.int(2, beds.length - 2);
      const u0 = caves.range(-0.5, 18);
      const h0 = bedLine(j, u0) + caves.range(-0.05, 0.25);
      const big = caves() < 0.25;
      const rw = big ? caves.range(0.45, 0.9) : caves.range(0.1, 0.32), rh = rw * caves.range(0.45, 0.75);
      const pts = [];
      for (let a = 0; a < LW.TAU; a += 0.2) {
        const flatB = Math.sin(a) < 0 ? 0.35 : 1; // flat floor along the bed
        pts.push(fp(u0 + Math.cos(a) * rw * (1 + 0.18 * LW.noise(a * 2, k)), h0 + Math.sin(a) * rh * flatB * (1 + 0.2 * LW.noise2(a * 2, k))));
      }
      const c = fp(u0, h0);
      if (!G.mask.in(c[0], c[1])) continue;
      const path = LW.polyPath(pts);
      LW.occlude(path);
      LW.flat(path, '#5a4a3c');
      const cbb = LW.bbox(pts, 1);
      const inC = (x, y) => LW.pointInPoly(x, y, pts);
      LW.clipDo(inkG, path, () => {
        LW.hatchDither(hp, cbb, 0.1, { spacing: 2.4, step: 2, wob: 0.4, seed: k, inside: inC, dark: () => 0.95, w: () => 1.2 });
        LW.hatchDither(hp, cbb, 1.2, { spacing: 3.0, step: 2, wob: 0.4, seed: k + 3, inside: inC, dark: (x, y) => 0.4 + 0.6 * LW.clamp((cbb.y1 - y) / cbb.h, 0, 1), w: () => 1.0 });
        hp.draw(inkG, C.ink);
      });
      // lit inner floor lip (lower right) and a heavy brow (upper left)
      LW.inkContour(pen, pts, (nx, ny) => { const lit = 1 - LW.shadowSide(nx, ny); return 0.6 + 3.2 * lit * lit; }, { taper: 0.25 });
      const lipP = new LW.Pen();
      const lipPts = pts.filter((_, i) => { const a = i * 0.2; return Math.sin(a) > 0.35; });
      if (lipPts.length > 2) lipP.line(lipPts.map(([x, y]) => [x, y - 2]), 3.2, 0.4);
      lipP.draw(fillG, '#f3e8c6');
      { // stains weeping from the cave mouth, and a cross-hatched brow above it
        const tr = LW.rng('cavedrip' + k);
        const df = new LW.Pen(), dp = new LW.Pen();
        const inG = (x, y) => G.mask.in(x, y);
        for (let m = 0; m < (big ? 3 : 1); m++) LW.tex.drip(df, dp, tr.range(cbb.x0 + cbb.w * 0.2, cbb.x1 - cbb.w * 0.2), cbb.y1 - 2, tr.range(40, big ? 190 : 90), tr.range(4, big ? 11 : 6), tr, inG);
        df.draw(fillG, '#9c8763', 0.55);
        const brow = pts.filter((_, i) => Math.sin(i * 0.2) < -0.2).map(([x, y]) => [x, y - 3]);
        if (brow.length > 2) dp.line(brow, 1.4, 0.4);
        LW.tex.pits(dp, LW.bbox(pts, 14), (x, y) => inG(x, y) && !inC(x, y), big ? 10 : 4, tr, { cluster: 4, spread: 6 });
        dp.draw(inkG, HATCH);
      }
      if (big && caves() < 0.7) LW.caper(c[0] + caves.range(-20, 20), c[1] + rh * 30, caves.range(36, 60), caves);
    }
    pen.draw(inkG, C.ink);
    inkG.restore();
    fillG.restore();
    // ---- silhouette contour of the headland
    const sp = new LW.Pen();
    LW.inkContour(sp, G.sky, () => 3.0 + rnd() * 0.8, { closed: false, taper: 0.02 });
    LW.inkContour(sp, G.corner, () => 3.6 + rnd() * 1.0, { closed: false, taper: 0.02 });
    sp.draw(inkG, C.ink);
    {
      const rc = LW.rng('capers');
      for (let k = 0; k < 18; k++) {
        const j = rc.int(2, beds.length - 2);
        const u = rc.range(0.5, 16), h = bedLine(j, u) + 0.05;
        const p = S.faceP(u, h, 0);
        if (!G.mask.in(p[0], p[1]) || h < -7 || h > 11) continue;
        LW.caper(p[0], p[1], rc.range(28, 52), rc);
      }
    }
  };
})();

// Generic screen-space engraved rock: poly (screen), relief(x,y) (in px units of height),
// opts: light (3D screen light), base (darkness bias), tones, sp scale.
(function () {
  const LW = window.LW, C = LW.C;
  LW.reliefRock = async function (poly, relief, o = {}) {
    const path = LW.polyPath(poly);
    const bb = LW.bbox(poly, 4);
    const mask = LW.Mask.fromPath(path, bb, 0.5);
    const grid = new LW.Grid(bb.x0, bb.y0, bb.x1, bb.y1, o.cell || 4);
    const R = grid.field(), D = grid.field(), DX = grid.field(), DY = grid.field(), GX = grid.field(), GY = grid.field(), SL = grid.field();
    const L = (() => { const l = o.light || [-0.55, -0.6, 0.6]; const m = Math.hypot(l[0], l[1], l[2]); return [l[0] / m, l[1] / m, l[2] / m]; })();
    const e = 2;
    const k = o.k || 1;
    for (let j = 0; j < grid.h; j++) for (let i = 0; i < grid.w; i++) {
      const q = j * grid.w + i;
      const x = grid.x0 + i * grid.cs, y = grid.y0 + j * grid.cs;
      const r0 = relief(x, y), rx = (relief(x + e, y) - r0) / e * k, ry = (relief(x, y + e) - r0) / e * k;
      R[q] = r0;
      const nl = Math.hypot(rx, ry, 1);
      const lam = (-rx * L[0] - ry * L[1] + L[2]) / nl;
      let d = LW.clamp(1 - (lam - 0.1) / 0.85, 0, 1);
      d = (o.base || 0) + (1 - (o.base || 0)) * Math.pow(d, 1.2);
      if (o.dark) d += o.dark(x, y, r0);
      D[q] = LW.clamp(d, 0, 1);
      const gl = Math.hypot(rx, ry) || 1e-6;
      let tx = -ry / gl, ty = rx / gl;
      const wv = LW.smooth(0.15, 0.0, gl);
      tx = tx * (1 - wv); ty = ty * (1 - wv) + wv;
      const tl = Math.hypot(tx, ty) || 1;
      DX[q] = tx / tl; DY[q] = ty / tl;
      GX[q] = rx / gl; GY[q] = ry / gl;
      SL[q] = gl;
    }
    const dAt = (x, y) => grid.get(D, x, y);
    LW.occlude(path);
    const tones = o.tones || ['#d9c391', '#c9ae78', '#b09265', '#977b52'];
    // flats
    {
      const cw = Math.ceil(bb.w / 2), ch = Math.ceil(bb.h / 2);
      const c = LW.canvas(cw, ch);
      const g = c.getContext('2d');
      const id = g.createImageData(cw, ch);
      const cols = tones.map((h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]);
      for (let j = 0; j < ch; j++) for (let i = 0; i < cw; i++) {
        const x = bb.x0 + i * 2, y = bb.y0 + j * 2;
        const d = dAt(x, y) + 0.05 * LW.noise3(x * 0.03, y * 0.03);
        const t = d < 0.35 ? 0 : d < 0.56 ? 1 : d < 0.76 ? 2 : 3;
        const q = (j * cw + i) * 4;
        id.data[q] = cols[t][0]; id.data[q + 1] = cols[t][1]; id.data[q + 2] = cols[t][2]; id.data[q + 3] = 255;
      }
      g.putImageData(id, 0, 0);
      LW.fill.save(); LW.fill.clip(path); LW.fill.drawImage(c, bb.x0, bb.y0, cw * 2, ch * 2); LW.fill.restore();
    }
    const ink = LW.ink;
    ink.save(); ink.clip(path);
    const pen = new LW.Pen();
    const inside = (x, y) => mask.in(x, y);
    const sps = o.sp || 1;
    const lines = LW.streamlines({
      bbox: bb, seed: o.seed || 5, inside,
      dir: (x, y) => [grid.get(DX, x, y), grid.get(DY, x, y)],
      sep: (x, y) => { const d = dAt(x, y); return d < 0.12 ? 0 : (2.6 + 12 * Math.pow(1 - d, 1.8)) * sps; },
      step: 2.6, minLen: 12, seedGrid: 26, cell: 6,
    });
    LW.drawLines(pen, lines, (x, y) => (0.5 + 1.9 * dAt(x, y)) * (o.lw || 1), 0.3, 0.1);
    pen.draw(ink, C.ink);
    await LW.tick();
    const lines2 = LW.streamlines({
      bbox: bb, seed: (o.seed || 5) + 1, inside,
      dir: (x, y) => [grid.get(GX, x, y), grid.get(GY, x, y)],
      sep: (x, y) => { const d = dAt(x, y); return d < 0.58 ? 0 : (3.2 + 15 * Math.pow(1 - d, 1.4)) * sps; },
      step: 2.6, minLen: 8, seedGrid: 26, cell: 6,
    });
    LW.drawLines(pen, lines2, (x, y) => (0.5 + 1.2 * dAt(x, y)) * (o.lw || 1), 0.35, 0.1);
    pen.draw(ink, C.ink);
    const lv0 = o.isoStep || 0.2;
    let rmin = Infinity, rmax = -Infinity;
    for (let q = 0; q < R.length; q++) { if (R[q] < rmin) rmin = R[q]; if (R[q] > rmax) rmax = R[q]; }
    for (let lv = rmin + lv0; lv < rmax; lv += lv0) {
      const iso = LW.marching(R, grid.w, grid.h, lv, grid.map());
      for (const Lq of iso) {
        if (Lq.length < 4) continue;
        const pts = LW.spline(Lq.filter((_, i) => i % 2 === 0 || i === Lq.length - 1), 3);
        let run = [], ws = [];
        const flush = () => { if (run.length > 3) pen.line(run, ws, 0.25, 0.15); run = []; ws = []; };
        const sd = lv * 13.7;
        for (const p of pts) {
          if (!inside(p[0], p[1])) { flush(); continue; }
          const gx = grid.get(GX, p[0], p[1]), gy = grid.get(GY, p[0], p[1]);
          const sh = LW.shadowSide(-gx, -gy);
          const sl = LW.smooth(0.1, 0.8, grid.get(SL, p[0], p[1]));
          const w = (0.3 + 3.0 * sh * sh * sh) * (0.4 + 0.8 * sl) * (o.lw || 1);
          if (sh < 0.45 || w < 0.5 || LW.noise3(p[0] * 0.012 + sd, p[1] * 0.012) < -0.35) { flush(); continue; }
          run.push(p); ws.push(w);
        }
        flush();
      }
      if (pen.n > 3000) pen.draw(ink, C.ink);
    }
    pen.draw(ink, C.ink);
    ink.restore();
    const op = new LW.Pen();
    LW.outline(op, poly, (o.outlineW || 3.4), 1.0);
    op.draw(ink, C.ink);
    return { path, mask, dAt };
  };
})();
