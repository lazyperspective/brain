// The Observatory: the stone drum, ribbed dome with its open, glowing slit and telescope,
// the terrace with iron railing, the stair, the lit window and the door left ajar.
'use strict';
(function () {
  const OB = window.OB;
  const { clamp, smooth, lerp, mix, css } = OB;
  const BR8 = [0, 4, 2, 6, 1, 5, 3, 7];
  const H2 = (h) => OB.hex(h);

  OB.obsGeom = (S) => {
    const o = S.obs;
    o.ring = (R, y, phi) => [o.cx + R * Math.sin(phi), y - R * o.k * Math.cos(phi)];
    o.domePt = (phi, e, Rr) => {
      const R = Rr || o.domeR;
      return [o.cx + R * Math.cos(e) * Math.sin(phi), o.y0 - R * Math.sin(e) - R * o.k * Math.cos(e) * Math.cos(phi)];
    };
    // slit edge point: lateral offset u (3D px), elevation e
    o.slitPt = (u, e) => {
      const R = o.domeR, rr = Math.sqrt(R * R - u * u);
      const X0 = u, Y = rr * Math.sin(e), Z0 = rr * Math.cos(e);
      const c = Math.cos(o.slitPhi), s = Math.sin(o.slitPhi);
      const X = X0 * c + Z0 * s, Z = -X0 * s + Z0 * c;
      return [o.cx + X, o.y0 - Y - o.k * Z];
    };
    const eL = Math.atan(1 / o.k) - 0.02;
    o.eLimb = eL;
    const left = [], right = [];
    for (let e = 0; e <= eL + 1e-6; e += 0.02) { left.push(o.slitPt(-o.slitW, e)); right.push(o.slitPt(o.slitW, e)); }
    o.slitPoly = left.concat(right.reverse());
    o.slitLeft = left;
    o.slitRight = right.slice().reverse();
    // dome silhouette
    const sil = [];
    for (let t = Math.PI; t >= 0; t -= 0.02) sil.push([o.cx + o.domeR * Math.cos(t), o.y0 - o.domeR * Math.sin(t)]);
    for (let p = Math.PI / 2; p >= -Math.PI / 2; p -= 0.03) sil.push(o.domePt(p, 0));
    o.domeSil = sil;
    const base = o.slitPt(0, 0.0), apex = o.slitPt(0, eL);
    o.slitBase = base;
    o.slitApex = apex;
    const mid = o.slitPt(0, 0.65);
    o.slitMid = mid;
  };

  // one stone on a cylinder (screen-projected), hatched with vertical burin lines that
  // compress toward the silhouette and thin out toward the light
  const cylStone = (ctx, o, B, Rcyl, pa, pb, yt, yb, base, rng, tag, lw) => {
    const vis = 1.5;
    pa = Math.max(pa, -vis); pb = Math.min(pb, vis);
    if (pb - pa < 0.004) return;
    const gp = (p) => 2.2 / (Rcyl * Math.max(0.2, Math.cos(p)));
    const qa = pa + gp(pa), qb = pb - gp(pb);
    if (qb <= qa) return;
    const pts = [];
    const n = Math.max(2, Math.ceil((qb - qa) / 0.03));
    for (let i = 0; i <= n; i++) pts.push(o.ring(Rcyl, yt + 1.8, qa + ((qb - qa) * i) / n));
    for (let i = n; i >= 0; i--) pts.push(o.ring(Rcyl, yb - 1.4, qa + ((qb - qa) * i) / n));
    const rp = OB.roughen(pts, true, 0.9, 0.08, Math.floor(rng() * 999), 3);
    const pm = (qa + qb) / 2;
    const dS = (p) => clamp(base(p));
    const dm = dS(pm);
    const m = o.ring(Rcyl, (yt + yb) / 2, pm);
    const wk = OB.warm(m[0], m[1], tag);
    const C = OB.C;
    B.fill.push([OB.path(rp), css(mix(OB.toneOf(C.stoneTones, dm), C.warmStone, Math.min(0.45, wk * 0.5)))]);
    // vertical hatch
    const dp = 0.0088 * (185 / Rcyl) * (0.85 + 0.3 * rng());
    let j = Math.floor(rng() * 8);
    for (let p = qa + dp * 0.5; p < qb; p += dp, j++) {
      const lvl = (BR8[j % 8] + 0.5) / 8;
      const d = dS(p) - 0.45 * OB.warm(m[0], m[1], tag);
      if (d < lvl * 0.85 + 0.04) continue;
      const a = o.ring(Rcyl, yt + 2.5, p), b = o.ring(Rcyl, yb - 2, p);
      const top = d - lvl > 0.25 ? a : [a[0], a[1] + (b[1] - a[1]) * (0.5 - (d - lvl))];
      const ln = OB.wline(top[0], top[1], b[0], b[1], 5, 0.5, p * 300);
      OB.ink(B.get(OB.warmCss(C.ink, m[0], m[1], tag, 1)), ln, lw * lerp(0.8, 1.6, d), { t0: 0.25, t1: 0.08, wn: 0.3, ph: p * 100 });
    }
    // underside shadow lines on darker stones
    if (dm > 0.45) {
      const k = dm > 0.65 ? 3 : 2;
      for (let i = 0; i < k; i++) {
        const yy = yb - 3 - i * 3.2;
        const ln = [];
        for (let p = qa; p <= qb; p += 0.02) ln.push(o.ring(Rcyl, yy, p));
        ln.push(o.ring(Rcyl, yy, qb));
        OB.ink(B.get(OB.warmCss(C.ink, m[0], m[1], tag, 1)), ln, lw * 0.8, { t0: 0.2, t1: 0.2, wn: 0.4, ph: yy + p0(pa) });
      }
    }
    B.outline.push(rp);
    // tooling: chisel pits and a few short strokes, so lit stones are never blank
    {
      const P = B.get(css(C.ink, 0.7));
      const P2 = B.get(css(C.ink, 0.42));
      const ng = Math.floor((qb - qa) * Rcyl * (yb - yt) * 0.03 * (0.6 + dm));
      for (let k = 0; k < ng; k++) {
        const q = o.ring(Rcyl, yt + 3 + (yb - yt - 6) * rng(), qa + (qb - qa) * rng());
        OB.dot(P2, q[0], q[1], 0.35 + 0.45 * rng());
      }
      const np = 3 + Math.floor(rng() * 5);
      for (let k = 0; k < np; k++) {
        const q = o.ring(Rcyl, yt + 4 + (yb - yt - 8) * rng(), qa + (qb - qa) * rng());
        const r = 0.6 + rng() * 0.8;
        P.moveTo(q[0] + r, q[1]);
        P.arc(q[0], q[1], r, 0, OB.TAU);
      }
      if (dm < 0.45) {
        const ns = 1 + Math.floor(rng() * 3);
        for (let k = 0; k < ns; k++) {
          const pp = qa + (qb - qa) * (0.15 + 0.7 * rng());
          const a = o.ring(Rcyl, yb - 3 - rng() * 4, pp), b = o.ring(Rcyl, yb - 3, pp + 0.02 + rng() * 0.03);
          OB.ink(P, [a, b], 0.9, { t0: 0.3, t1: 0.3 });
        }
      }
    }
    // dressing: clusters of short diagonal chisel strokes, and chipped corners
    {
      const P = B.get(css(C.ink, 0.62));
      const ng = 1 + Math.floor(rng() * 3);
      for (let g = 0; g < ng; g++) {
        const c = o.ring(Rcyl, yt + 4 + (yb - yt - 8) * rng(), qa + (qb - qa) * (0.1 + 0.8 * rng()));
        const a = (rng() < 0.5 ? -0.8 : 0.8) + (rng() - 0.5) * 0.3, L = 2.5 + rng() * 3.5;
        for (let k = 0; k < 3 + Math.floor(rng() * 4); k++) {
          const x = c[0] + k * 1.7, y = c[1] + (rng() - 0.5) * 1.2;
          OB.ribbon(P, [[x, y], [x + Math.cos(a) * L, y + Math.sin(a) * L]], [0.55, 0.15]);
        }
      }
      const Pc = B.get(css(C.mortar));
      for (const corner of [[qa, yt + 1.8], [qb, yt + 1.8], [qa, yb - 1.4], [qb, yb - 1.4]]) {
        if (rng() > 0.28) continue;
        const q = o.ring(Rcyl, corner[1], corner[0]), sx = corner[0] === qa ? 1 : -1, sy = corner[1] < (yt + yb) / 2 ? 1 : -1, r = 2 + rng() * 3;
        OB.path([[q[0] - sx, q[1] - sy], [q[0] + sx * r, q[1] - sy], [q[0] - sx, q[1] + sy * r * 0.8]], true, Pc);
      }
    }
    // occasional chip / crack
    if (rng() < 0.18) {
      const c0 = o.ring(Rcyl, yt + (yb - yt) * rng(), qa + (qb - qa) * rng());
      const ln = [c0];
      let x = c0[0], y = c0[1], ang = rng() * Math.PI;
      for (let s = 0; s < 4; s++) { ang += (rng() - 0.5); x += Math.cos(ang) * 3.5; y += Math.sin(ang) * 3.5; ln.push([x, y]); }
      OB.ink(B.get(css(C.ink)), ln, lw * 0.9, { t0: 0, t1: 0.7 });
    }
  };
  const p0 = (p) => p * 77.7;

  const makeStoneBatch = () => {
    const B = new OB.Batch();
    B.fill = [];
    B.outline = [];
    return B;
  };
  const flushStones = (ctx, B, lw, tag) => {
    const C = OB.C;
    ctx.save();
    ctx.translate(OB.MR[0], OB.MR[1]);
    for (const [p, c] of B.fill) { ctx.fillStyle = c; ctx.fill(p); }
    ctx.restore();
    // hatch lines
    for (const [k, p] of B.m) { ctx.fillStyle = k; ctx.fill(p); }
    B.m.clear();
    for (const rp of B.outline) {
      const m = rp[rp.length >> 1];
      OB.outline(ctx, rp, lw, () => OB.warmCss(C.ink, m[0], m[1], tag, 1), { sd: [0.3, 0.95] });
    }
  };

  OB.drawObservatory = (ctx, S) => {
    const o = S.obs, C = OB.C, R = OB.rng(91), N = OB.noise(92);
    const phiL = -1.15;
    const cylD = (p, off) => 0.6 - 0.46 * Math.cos(p - phiL) + off;
    // mortar with grit in it: pale sand grains and dark voids, seen in the joints
    const gritty = (path, bb) => {
      const Rg = OB.rng(93), Pw = new Path2D(), Pk = new Path2D();
      const n = Math.floor((bb[2] - bb[0]) * (bb[3] - bb[1]) * 0.05);
      for (let k = 0; k < n; k++) OB.dot(Rg() < 0.5 ? Pw : Pk, bb[0] + Rg() * (bb[2] - bb[0]), bb[1] + Rg() * (bb[3] - bb[1]), 0.4 + 0.5 * Rg());
      ctx.save();
      ctx.clip(path);
      ctx.fillStyle = css(C.stoneTones[2][1], 0.6);
      ctx.fill(Pw);
      ctx.fillStyle = css(C.crevice, 0.8);
      ctx.fill(Pk);
      ctx.restore();
    };

    // ---------------------------------------------------------- terrace wall
    {
      const Rt = o.terraceR;
      const sil = [];
      for (let p = -Math.PI / 2; p <= Math.PI / 2; p += 0.02) sil.push(o.ring(Rt, o.terraceTop, p));
      for (let p = Math.PI / 2; p >= -Math.PI / 2; p -= 0.02) sil.push(o.ring(Rt, o.terraceBot, p));
      const path = OB.path(sil);
      OB.flatFill(ctx, path, css(C.mortar));
      gritty(path, OB.bbox(sil));
      const B = makeStoneBatch();
      const ch = (o.terraceBot - o.terraceTop) / 3;
      for (let c = 0; c < 3; c++) {
        let p = -Math.PI / 2 - R() * 0.1;
        while (p < Math.PI / 2) {
          const dp = (60 / Rt) * (0.7 + 0.8 * R());
          const off = 0.1 * R.norm() + 0.05;
          cylStone(ctx, o, B, Rt, p, p + dp, o.terraceTop + c * ch, o.terraceTop + (c + 1) * ch, (q) => cylD(q, off), R, 'terrace', 1.3);
          p += dp;
        }
      }
      flushStones(ctx, B, 1.6, 'terrace');
      // coping
      const cop = [];
      for (let p = -Math.PI / 2; p <= Math.PI / 2; p += 0.02) cop.push(o.ring(Rt + 7, o.terraceTop - 13, p));
      for (let p = Math.PI / 2; p >= -Math.PI / 2; p -= 0.02) cop.push(o.ring(Rt + 7, o.terraceTop + 1, p));
      const cp = OB.path(OB.roughen(cop, true, 0.7, 0.06, 4, 3));
      OB.flatFill(ctx, cp, css(C.stoneTones[1][1]));
      ctx.save();
      ctx.clip(cp);
      OB.engrave(ctx, { bbox: OB.bbox(cop), angle: 0, sp: 3.2, D: (x, y) => clamp(0.15 + 0.6 * smooth(o.cx - 200, o.cx + Rt, x) + 0.25 * smooth(o.terraceTop - 13, o.terraceTop, y)), w: 1.2, levels: 4, col: css(C.ink), seed: 9 });
      ctx.restore();
      OB.outline(ctx, OB.roughen(cop, true, 0.7, 0.06, 4, 3), 1.8, () => css(C.ink), { sd: [0.2, 0.98] });
      // contact shadow under coping
      const sh = [];
      for (let p = -Math.PI / 2; p <= Math.PI / 2; p += 0.02) sh.push(o.ring(Rt, o.terraceTop + 3, p));
      const P = new Path2D();
      OB.ink(P, sh, 3.2, { t0: 0, t1: 0, wn: 0.4 });
      ctx.fillStyle = css(C.ink);
      ctx.fill(P);
      o.copingPath = cp;
    }

    // ---------------------------------------------------------- stair (profile flight)
    {
      const st = o.stair;
      const n = st.n, rise = (st.y0 - st.y1) / n, run = (st.x1 - st.x0) / n;
      const prof = [[st.x0 - 6, st.y0 + 4]];
      for (let i = 0; i < n; i++) {
        const x = st.x0 + i * run, y = st.y0 - i * rise;
        prof.push([x, y - rise]);
        prof.push([x + run, y - rise]);
      }
      const body = prof.concat([[st.x1 + 4, st.y0 + 30], [st.x0 - 10, st.y0 + 26]]);
      const rb = OB.roughen(body, true, 0.8, 0.07, 5, 3);
      const bp = OB.path(rb);
      OB.flatFill(ctx, bp, css(C.stoneTones[3][1]));
      ctx.save();
      ctx.clip(bp);
      OB.engrave(ctx, { bbox: OB.bbox(rb), angle: 0.02, sp: 3.4, D: (x, y) => 0.55 + 0.3 * smooth(st.y1, st.y0 + 30, y) - 0.25 * OB.warm(x, y, 'stair'), w: 1.3, levels: 8, colAt: (x, y) => OB.warmCss(C.ink, x, y, 'stair', 1), seed: 12 });
      // side-wall block joints
      const Pj = new Path2D();
      for (let i = 0; i < n; i += 1) {
        const x = st.x0 + (i + 0.5) * run, y = st.y0 - i * rise;
        OB.ink(Pj, OB.wline(x + (R() - 0.5) * 4, y + 2, x + (R() - 0.5) * 4, y + 24, 4, 0.5, i), 1.3);
        OB.ink(Pj, OB.wline(x - run * 0.5, y + 12 + (R() - 0.5) * 3, x + run * 0.6, y + 12 + (R() - 0.5) * 3, 4, 0.5, i + 3), 1.1);
      }
      ctx.fillStyle = css(C.ink);
      ctx.fill(Pj);
      ctx.restore();
      // tread nosings: pale lit lips
      const Pn = new Path2D();
      for (let i = 0; i < n; i++) {
        const x = st.x0 + i * run, y = st.y0 - (i + 1) * rise;
        OB.ink(Pn, OB.wline(x + 1, y + 1.5, x + run - 1, y + 1.5, 4, 0.4, i), 1.6, { t0: 0.2, t1: 0.2 });
      }
      ctx.fillStyle = OB.warmCss(C.rockHi, st.x0, st.y0, 'stair', 1, 0.8);
      ctx.fill(Pn);
      OB.outline(ctx, rb, 2.2, (x, y) => OB.warmCss(C.ink, x, y, 'stair', 1), { sd: [0.3, 0.95] });
      o.stairProf = prof;
    }

    // ---------------------------------------------------------- drum
    const Rd = o.drumR;
    {
      const sil = [];
      for (let p = -Math.PI / 2; p <= Math.PI / 2; p += 0.02) sil.push(o.ring(Rd, o.drumTop, p));
      for (let p = Math.PI / 2; p >= -Math.PI / 2; p -= 0.02) sil.push(o.ring(Rd, o.terraceTop, p));
      const path = OB.path(sil);
      // drum is drawn first, then the coping band is redrawn over its foot
      OB.flatFill(ctx, path, css(C.mortar));
      gritty(path, OB.bbox(sil));
      const B = makeStoneBatch();
      const nc = o.courses;
      const ch = (o.terraceTop - o.drumTop) / nc;
      for (let c = 0; c < nc; c++) {
        let p = -Math.PI / 2 - R() * 0.12;
        while (p < Math.PI / 2) {
          const dp = (46 / Rd) * (0.65 + 0.9 * R());
          const off = 0.09 * R.norm();
          cylStone(ctx, o, B, Rd, p, p + dp, o.drumTop + c * ch, o.drumTop + (c + 1) * ch, (q) => cylD(q, off), R, 'drum', 1.15);
          p += dp;
        }
      }
      flushStones(ctx, B, 1.4, 'drum');
      // silhouette edges
      const Pe = new Path2D();
      OB.ink(Pe, OB.wline(o.cx - Rd, o.drumTop, o.cx - Rd, o.terraceTop - 10, 6, 0.6, 1), 2.6, { t0: 0, t1: 0 });
      OB.ink(Pe, OB.wline(o.cx + Rd, o.drumTop, o.cx + Rd, o.terraceTop - 10, 6, 0.6, 2), 4.2, { t0: 0, t1: 0 });
      ctx.fillStyle = css(C.ink);
      ctx.fill(Pe);
      // a cool sky rim on the lit left edge
      const Pr = new Path2D();
      OB.ink(Pr, OB.wline(o.cx - Rd + 4, o.drumTop + 8, o.cx - Rd + 4, o.terraceTop - 30, 6, 0.6, 3), 1.4, { t0: 0.1, t1: 0.3 });
      ctx.fillStyle = css(C.rockHi, 0.7);
      ctx.fill(Pr);
    }

    // ---------------------------------------------------------- the window
    {
      const p = o.winPhi, cxw = o.cx + Rd * Math.sin(p);
      const yc = o.winY, ww = 30 * Math.cos(p), hh = 40, ar = ww / 2;
      const opening = (g) => {
        const P = new Path2D();
        P.moveTo(cxw - ww / 2, yc + hh / 2);
        P.lineTo(cxw - ww / 2, yc - hh / 2 + ar);
        P.arc(cxw, yc - hh / 2 + ar, ww / 2, Math.PI, 0);
        P.lineTo(cxw + ww / 2, yc + hh / 2);
        P.closePath();
        return P;
      };
      // surround: voussoirs and jambs
      const sur = new Path2D();
      const so = 10;
      sur.moveTo(cxw - ww / 2 - so, yc + hh / 2 + 4);
      sur.lineTo(cxw - ww / 2 - so, yc - hh / 2 + ar);
      sur.arc(cxw, yc - hh / 2 + ar, ww / 2 + so, Math.PI, 0);
      sur.lineTo(cxw + ww / 2 + so, yc + hh / 2 + 4);
      sur.closePath();
      OB.flatFill(ctx, sur, css(mix(C.stoneTones[1][1], C.warmStone, 0.55)));
      const Pv = new Path2D();
      for (let k = 0; k <= 6; k++) {
        const a = Math.PI + (k / 6) * Math.PI;
        const r0 = ww / 2, r1 = ww / 2 + so;
        OB.ink(Pv, [[cxw + Math.cos(a) * r0, yc - hh / 2 + ar + Math.sin(a) * r0], [cxw + Math.cos(a) * r1, yc - hh / 2 + ar + Math.sin(a) * r1]], 1.3, { t0: 0, t1: 0 });
      }
      for (let k = 0; k < 3; k++) {
        const y = yc - hh / 2 + ar + 6 + k * 11;
        OB.ink(Pv, [[cxw - ww / 2 - so, y], [cxw - ww / 2, y]], 1.2, { t0: 0, t1: 0 });
        OB.ink(Pv, [[cxw + ww / 2, y + 4], [cxw + ww / 2 + so, y + 4]], 1.2, { t0: 0, t1: 0 });
      }
      ctx.fillStyle = css(C.ink);
      ctx.fill(Pv);
      ctx.lineWidth = 2;
      ctx.strokeStyle = css(C.ink);
      ctx.stroke(sur);
      // glass
      const op = opening();
      const g = ctx.createLinearGradient(cxw, yc - hh / 2, cxw, yc + hh / 2);
      g.addColorStop(0, css(C.amber));
      g.addColorStop(0.6, css(C.amberHot));
      g.addColorStop(1, css(C.amber));
      ctx.fillStyle = g;
      ctx.fill(op);
      // reveal shadow on the left, mullion and transom
      ctx.save();
      ctx.clip(op);
      ctx.fillStyle = css(C.amberDeep, 0.85);
      ctx.fillRect(cxw - ww / 2, yc - hh, 5, hh * 2);
      ctx.restore();
      ctx.fillStyle = css(C.ink);
      ctx.fillRect(cxw - 1.3, yc - hh / 2 + 2, 2.6, hh - 2);
      ctx.fillRect(cxw - ww / 2, yc - 3, ww, 2.4);
      ctx.lineWidth = 2.4;
      ctx.stroke(op);
      // sill
      ctx.fillStyle = css(mix(C.stoneTones[0][1], C.warmStone, 0.6));
      ctx.fillRect(cxw - ww / 2 - 13, yc + hh / 2 + 3, ww + 26, 6);
      ctx.strokeStyle = css(C.ink);
      ctx.lineWidth = 1.6;
      ctx.strokeRect(cxw - ww / 2 - 13, yc + hh / 2 + 3, ww + 26, 6);
      o.win = { x: cxw, y: yc };
    }

    // ---------------------------------------------------------- the door, left ajar
    {
      const p = o.doorPhi, cxd = o.cx + Rd * Math.sin(p);
      const yb = o.terraceTop - 4, ht = 112, wd = 54 * Math.cos(p) + 6, ar = wd / 2;
      const yt = yb - ht;
      const arch = new Path2D();
      arch.moveTo(cxd - wd / 2 - 9, yb);
      arch.lineTo(cxd - wd / 2 - 9, yt + ar);
      arch.arc(cxd, yt + ar, wd / 2 + 9, Math.PI, 0);
      arch.lineTo(cxd + wd / 2 + 9, yb);
      arch.closePath();
      OB.flatFill(ctx, arch, css(C.stoneTones[1][1]));
      const Pv = new Path2D();
      for (let k = 0; k <= 7; k++) {
        const a = Math.PI + (k / 7) * Math.PI;
        OB.ink(Pv, [[cxd + Math.cos(a) * ar, yt + ar + Math.sin(a) * ar], [cxd + Math.cos(a) * (ar + 9), yt + ar + Math.sin(a) * (ar + 9)]], 1.3, { t0: 0, t1: 0 });
      }
      ctx.fillStyle = css(C.ink);
      ctx.fill(Pv);
      const op = new Path2D();
      op.moveTo(cxd - wd / 2, yb);
      op.lineTo(cxd - wd / 2, yt + ar);
      op.arc(cxd, yt + ar, wd / 2, Math.PI, 0);
      op.lineTo(cxd + wd / 2, yb);
      op.closePath();
      // warm interior seen through the gap
      ctx.fillStyle = css(C.amber);
      ctx.fill(op);
      ctx.save();
      ctx.clip(op);
      // the door leaf, swung slightly inward: dark planks covering most of the opening
      const gap = 11;
      ctx.fillStyle = css(C.door);
      ctx.fillRect(cxd - wd / 2 - 2, yt - 2, wd - gap + 2, ht + 6);
      const Pp = new Path2D();
      for (let x = cxd - wd / 2 + 7; x < cxd + wd / 2 - gap; x += 7) OB.ink(Pp, OB.wline(x, yt, x, yb, 6, 0.5, x), 1.2, { t0: 0, t1: 0 });
      for (const yy of [yt + 30, yb - 28]) OB.ink(Pp, OB.wline(cxd - wd / 2, yy, cxd + wd / 2 - gap, yy, 5, 0.4, yy), 3, { t0: 0, t1: 0 });
      ctx.fillStyle = css(C.ink);
      ctx.fill(Pp);
      // hot edge of the leaf
      ctx.fillStyle = css(C.amberHot);
      ctx.fillRect(cxd + wd / 2 - gap - 1, yt, 2.2, ht);
      ctx.fillStyle = css(C.amberHot, 0.9);
      ctx.fillRect(cxd + wd / 2 - gap + 3, yt, gap - 3, ht);
      ctx.restore();
      ctx.lineWidth = 2.6;
      ctx.strokeStyle = css(C.ink);
      ctx.stroke(op);
      ctx.lineWidth = 2;
      ctx.stroke(arch);
      o.door = { x: cxd + wd / 2 - gap / 2, y: yb - ht * 0.45 };
    }

    // redraw the coping over the drum foot
    {
      const Rt = o.terraceR;
      const cop = [];
      for (let p = -Math.PI / 2; p <= Math.PI / 2; p += 0.02) cop.push(o.ring(Rt + 7, o.terraceTop - 13, p));
      for (let p = Math.PI / 2; p >= -Math.PI / 2; p -= 0.02) cop.push(o.ring(Rt + 7, o.terraceTop + 1, p));
      const rc = OB.roughen(cop, true, 0.7, 0.06, 4, 3);
      const cp = OB.path(rc);
      OB.flatFill(ctx, cp, css(C.stoneTones[1][1]));
      ctx.save();
      ctx.clip(cp);
      OB.engrave(ctx, { bbox: OB.bbox(cop), angle: 0, sp: 3, D: (x, y) => clamp(0.12 + 0.62 * smooth(o.cx - 220, o.cx + Rt, x) + 0.2 * smooth(o.terraceTop - 13, o.terraceTop, y) - 0.6 * OB.warm(x, y, 'rail')), w: 1.2, levels: 4, colAt: (x, y) => OB.warmCss(C.ink, x, y, 'rail', 1), seed: 9 });
      // block joints on the coping
      const Pj = new Path2D();
      for (let p = -1.5; p < 1.5; p += 0.13 + R() * 0.08) {
        const a = o.ring(Rt + 7, o.terraceTop - 13, p), b = o.ring(Rt + 7, o.terraceTop + 1, p);
        OB.ink(Pj, [a, b], 1.4, { t0: 0, t1: 0 });
      }
      ctx.fillStyle = css(C.ink);
      ctx.fill(Pj);
      ctx.restore();
      OB.outline(ctx, rc, 1.9, (x, y) => OB.warmCss(C.ink, x, y, 'rail', 1), { sd: [0.2, 0.98] });
    }

    // ---------------------------------------------------------- cornice + corbels
    {
      const Rc = o.drumR + 16;
      const yT = o.drumTop - 22, yB = o.drumTop;
      // corbels under the cornice
      const Pc = new Path2D(), Ps = new Path2D();
      for (let p = -1.45; p <= 1.45; p += 0.19) {
        const a = o.ring(Rd + 8, yB, p - 0.035), b = o.ring(Rd + 8, yB, p + 0.035);
        const w = b[0] - a[0];
        const poly = [a, b, [b[0] - w * 0.15, b[1] + 15], [a[0] + w * 0.15, a[1] + 15]];
        OB.path(poly, true, Pc);
        OB.path([[a[0] + w * 0.15, a[1] + 15], [b[0] + w * 0.6, b[1] + 15], [b[0] + w * 0.8, b[1] + 20], [a[0] + w * 0.3, a[1] + 20]], true, Ps);
      }
      ctx.fillStyle = css(C.ink, 0.75);
      ctx.fill(Ps);
      ctx.fillStyle = css(C.stoneTones[2][1]);
      ctx.fill(Pc);
      ctx.strokeStyle = css(C.ink);
      ctx.lineWidth = 1.5;
      ctx.stroke(Pc);
      const band = [];
      for (let p = -Math.PI / 2; p <= Math.PI / 2; p += 0.02) band.push(o.ring(Rc, yT, p));
      for (let p = Math.PI / 2; p >= -Math.PI / 2; p -= 0.02) band.push(o.ring(Rc, yB, p));
      const rb = OB.roughen(band, true, 0.7, 0.06, 6, 3);
      const bp = OB.path(rb);
      OB.flatFill(ctx, bp, css(C.stoneTones[1][1]));
      ctx.save();
      ctx.clip(bp);
      // vertical hatch on the cornice (cylindrical), plus moulding lines
      const Bh = new OB.Batch();
      let j = 0;
      for (let p = -1.56; p < 1.56; p += 0.012, j++) {
        const d = cylD(p, 0.05);
        const lvl = (BR8[j % 8] + 0.5) / 8;
        if (d < lvl * 0.9 + 0.08) continue;
        const a = o.ring(Rc, yT, p), b = o.ring(Rc, yB, p);
        OB.ink(Bh.get(css(C.ink)), [a, b], 1.1, { t0: 0.1, t1: 0.1 });
      }
      Bh.fill(ctx);
      const Pm = new Path2D();
      for (const yy of [yT + 6, yT + 9]) {
        const ln = [];
        for (let p = -1.57; p <= 1.57; p += 0.03) ln.push(o.ring(Rc, yy, p));
        OB.ink(Pm, ln, 1.2, { t0: 0, t1: 0, wn: 0.4 });
      }
      ctx.fillStyle = css(C.ink);
      ctx.fill(Pm);
      ctx.restore();
      OB.outline(ctx, rb, 2.2, () => css(C.ink), { sd: [0.2, 0.98] });
    }

    // ---------------------------------------------------------- dome
    {
      const Rm = o.domeR;
      // skirt
      const sk = [];
      for (let p = -Math.PI / 2; p <= Math.PI / 2; p += 0.02) sk.push(o.ring(Rm + 2, o.y0, p));
      for (let p = Math.PI / 2; p >= -Math.PI / 2; p -= 0.02) sk.push(o.ring(Rm + 2, o.y0 + 15, p));
      const skp = OB.path(sk);
      OB.flatFill(ctx, skp, css(C.domeTones[4][1]));
      const Pk = new Path2D();
      for (let p = -1.5; p <= 1.5; p += 0.045) {
        const a = o.ring(Rm + 2, o.y0 + 2, p), b = o.ring(Rm + 2, o.y0 + 14, p);
        OB.ink(Pk, [a, b], 1.1, { t0: 0, t1: 0 });
      }
      ctx.fillStyle = css(C.ink);
      ctx.fill(Pk);
      ctx.lineWidth = 2;
      ctx.strokeStyle = css(C.ink);
      ctx.stroke(skp);

      const sil = OB.roughen(o.domeSil, true, 0.6, 0.06, 8, 3);
      const dp = OB.path(sil);
      o.domePath = dp;
      const Ld = [-0.75, 0.45, 0.5];
      const ll = Math.hypot(...Ld);
      const nrm = (x, y) => {
        const nx = (x - o.cx) / Rm, ny = (o.y0 - y) / Rm;
        const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
        return [nx, ny, nz];
      };
      const Dd = (x, y) => {
        const n = nrm(x, y);
        const lam = (n[0] * Ld[0] + n[1] * Ld[1] + n[2] * Ld[2]) / ll;
        return clamp(1.0 - 0.82 * lam + 0.05 * N(x * 0.01, y * 0.01) - 0.6 * OB.warm(x, y, 'dome'));
      };
      OB.posterFill(ctx, dp, OB.bbox(sil), Dd, C.domeTones, { step: 3, dither: 0.02 });
      ctx.save();
      ctx.clip(dp);
      const inSlit = (p) => Math.abs(p - o.slitPhi) < o.slitW / Rm + 0.012;
      // meridian hatching: panels lined along their curvature
      const B = new OB.Batch();
      let j = 0;
      for (let p = -1.58; p <= 1.58; p += 0.0115, j++) {
        const lvl = (BR8[j % 8] + 0.5) / 8;
        const eMax = j % 4 === 0 ? 1.35 : j % 2 === 0 ? 1.15 : 0.95;
        const pts = [];
        for (let e = 0; e <= eMax; e += 0.02) pts.push(o.domePt(p, e));
        const sl = (i) => {
          const e = i * 0.02;
          // slit test in 3D: lateral distance from the slit meridian plane
          const u = Rm * Math.cos(e) * Math.sin(p - o.slitPhi);
          return Math.abs(u) < o.slitW + 3 && Math.cos(p - o.slitPhi) > 0;
        };
        const m = pts[pts.length >> 1];
        OB.runs(B.get(OB.warmCss(C.ink, m[0], m[1], 'dome', 1)), pts, (i) => lerp(0.7, 1.7, Dd(pts[i][0], pts[i][1])) * (1 - 0.35 * (i * 0.02) / 1.4), (i) => !sl(i) && Dd(pts[i][0], pts[i][1]) > lvl * 0.88 + 0.08, 3);
      }
      B.fill(ctx);
      // seams (latitudes)
      const Bs = new OB.Batch();
      for (const e of [0.06, 0.3, 0.6, 0.9, 1.18]) {
        const pts = [];
        for (let p = -1.57; p <= 1.57; p += 0.015) pts.push([o.domePt(p, e), p]);
        const ln = pts.map((q) => q[0]);
        OB.runs(Bs.get(css(C.ink)), ln, () => (e < 0.1 ? 2.4 : 1.5), (i) => { const p = pts[i][1]; const u = Rm * Math.cos(e) * Math.sin(p - o.slitPhi); return !(Math.abs(u) < o.slitW + 3 && Math.cos(p - o.slitPhi) > 0); }, 2);
        // a pale seam highlight just above
        OB.runs(Bs.get(css(C.domeHi, 0.55)), ln.map((q) => [q[0], q[1] - 2.2]), () => 0.9, (i) => { const p = pts[i][1]; const u = Rm * Math.cos(e) * Math.sin(p - o.slitPhi); return p < 0.3 && !(Math.abs(u) < o.slitW + 3 && Math.cos(p - o.slitPhi) > 0); }, 2);
      }
      Bs.fill(ctx);
      // ribs with rivets and a sky-lit edge
      const Br = new OB.Batch();
      for (let p = -1.5; p <= 1.5; p += 0.2) {
        if (inSlit(p)) continue;
        const pts = [];
        for (let e = 0; e <= 1.46; e += 0.02) pts.push(o.domePt(p, e));
        const vis = Math.cos(p);
        OB.ink(Br.get(OB.warmCss(C.ink, pts[20][0], pts[20][1], 'dome', 1)), pts, 2.2 + 2.2 * vis, { t0: 0, t1: 0.3, wn: 0.2 });
        const hi = pts.map((q, i) => { const e = i * 0.02; return [q[0] - 2.6 * vis * Math.cos(e) * Math.cos(p), q[1]]; });
        if (p < 0.6) OB.ink(Br.get(css(C.domeHi, 0.7 * (1 - Math.max(0, p)))), hi.slice(0, 60), 1.1, { t0: 0.1, t1: 0.4 });
        for (let e = 0.12; e < 1.3; e += 0.1) {
          const q = o.domePt(p + 0.012, e);
          const rp = Br.get(css(C.domeHi, 0.6));
          rp.moveTo(q[0] + 1.2, q[1]);
          rp.arc(q[0], q[1], 1.2, 0, OB.TAU);
        }
      }
      Br.fill(ctx);
      // rivet rows along the seams, each a dark head with a sky-lit glint
      {
        const Rv = OB.rng(95);
        const Pk = new Path2D(), Pw = new Path2D(), Pst = new Path2D(), Ppt = new Path2D(), Pdk = new Path2D(), Pdh = new Path2D();
        const outSlit = (p, e) => { const u = Rm * Math.cos(e) * Math.sin(p - o.slitPhi); return !(Math.abs(u) < o.slitW + 4 && Math.cos(p - o.slitPhi) > 0); };
        for (const e of [0.06, 0.3, 0.6, 0.9, 1.18]) {
          for (let p = -1.52; p <= 1.52; p += 0.055 / Math.max(0.35, Math.cos(e))) {
            if (!outSlit(p, e)) continue;
            const q = o.domePt(p, e - 0.018);
            const r = 1.05 * (0.6 + 0.4 * Math.cos(p));
            OB.dot(Pk, q[0], q[1], r + 0.25);
            if (p < 0.4) OB.dot(Pw, q[0] - 0.5, q[1] - 0.5, r * 0.45);
            // rain streaks running down from some rivets
            if (Rv() < 0.22 && e > 0.2) {
              const pts = [];
              const de = 0.04 + 0.12 * Rv();
              for (let t = 0; t <= 1; t += 0.2) pts.push(o.domePt(p + (Rv() - 0.5) * 0.004, e - 0.03 - de * t));
              OB.ink(Pst, pts, 0.7 + 0.5 * Rv(), { t0: 0.05, t1: 0.7, wn: 0.4, ph: p * 50 });
            }
          }
        }
        // patina: verdigris stipple gathering below the seams and toward the base
        for (let k = 0; k < 9000; k++) {
          const p = -1.55 + Rv() * 3.1, e = Rv() * 1.3;
          if (!outSlit(p, e)) continue;
          const q = o.domePt(p, e);
          const nearSeam = [0.06, 0.3, 0.6, 0.9, 1.18].some((s0) => e < s0 && s0 - e < 0.07);
          if (Rv() > (nearSeam ? 0.55 : 0.08) * smooth(0.35, 0.7, OB.vnoise(q[0], q[1], 12)) * (1 - 0.5 * e)) continue;
          OB.dot(Ppt, q[0], q[1], 0.45 + 0.7 * Rv());
        }
        // dents: a dark crescent on the far side, a glint on the near
        for (let k = 0; k < 16; k++) {
          const p = -1.4 + Rv() * 2.6, e = 0.1 + Rv() * 1.0;
          if (!outSlit(p, e)) continue;
          const q = o.domePt(p, e), r = (4 + 6 * Rv()) * Math.max(0.4, Math.cos(p));
          const a0 = -0.6 + (Rv() - 0.5) * 0.6;
          Pdk.moveTo(q[0] + Math.cos(a0) * r, q[1] + Math.sin(a0) * r * 0.6);
          Pdk.ellipse(q[0], q[1], r, r * 0.6, 0, a0, a0 + 2.2);
          Pdh.moveTo(q[0] + Math.cos(a0 + Math.PI) * r * 0.8, q[1] + Math.sin(a0 + Math.PI) * r * 0.48);
          Pdh.ellipse(q[0], q[1], r * 0.8, r * 0.48, 0, a0 + Math.PI, a0 + Math.PI + 1.8);
        }
        ctx.fillStyle = css(H2('#5f9a8c'), 0.42);
        ctx.fill(Ppt);
        ctx.fillStyle = css(C.ink, 0.65);
        ctx.fill(Pst);
        ctx.lineCap = 'round';
        ctx.lineWidth = 1.3;
        ctx.strokeStyle = css(C.ink, 0.8);
        ctx.stroke(Pdk);
        ctx.lineWidth = 0.9;
        ctx.strokeStyle = css(C.domeHi, 0.55);
        ctx.stroke(Pdh);
        ctx.fillStyle = css(C.ink);
        ctx.fill(Pk);
        ctx.fillStyle = css(C.domeHi, 0.75);
        ctx.fill(Pw);
      }
      ctx.restore();
      // sky rim light along the left limb
      const rim = [];
      for (let t = Math.PI * 0.98; t >= Math.PI * 0.42; t -= 0.02) rim.push([o.cx + (Rm - 4) * Math.cos(t), o.y0 - (Rm - 4) * Math.sin(t)]);
      const Pr = new Path2D();
      OB.ink(Pr, rim, 1.6, { t0: 0.15, t1: 0.5 });
      ctx.fillStyle = css(C.domeHi, 0.8);
      ctx.fill(Pr);
      OB.outline(ctx, sil, 2.6, () => css(C.ink), { sd: [0.6, 0.6] });
    }

    // ---------------------------------------------------------- the slit, interior and telescope
    {
      const sp = OB.path(o.slitPoly);
      const b = o.slitBase, a = o.slitApex;
      const g = ctx.createLinearGradient(b[0], b[1], a[0], a[1]);
      g.addColorStop(0, css(C.amberDeep));
      g.addColorStop(0.22, css(C.amber));
      g.addColorStop(0.5, css(C.amberHot));
      g.addColorStop(0.85, css(C.amber));
      g.addColorStop(1, css(C.amberDeep));
      ctx.fillStyle = g;
      ctx.fill(sp);
      ctx.save();
      ctx.clip(sp);
      // the far interior: ribs of the back wall seen through the opening
      const Pi = new Path2D();
      for (let k = 0; k < 9; k++) {
        const t = (k + 0.5) / 9;
        const q = OB.lerp(b[1], a[1], t);
        const ln = [];
        for (let x = b[0] - 80; x <= b[0] + 80; x += 4) ln.push([x, q + 0.004 * (x - b[0]) * (x - b[0]) - 6]);
        OB.ink(Pi, ln, 1.6, { t0: 0, t1: 0, wn: 0.4, ph: k });
      }
      ctx.fillStyle = css(C.ember, 0.55);
      ctx.fill(Pi);
      // a ladder against the far wall, and shelves of the interior in silhouette
      {
        const Pld = new Path2D();
        const lx = b[0] + 26, ly0 = b[1] - 6, ly1 = OB.lerp(b[1], a[1], 0.55);
        OB.ink(Pld, [[lx, ly0], [lx + 10, ly1]], 2, { t0: 0, t1: 0 });
        OB.ink(Pld, [[lx + 13, ly0], [lx + 23, ly1]], 2, { t0: 0, t1: 0 });
        for (let t = 0.08; t < 1; t += 0.11) OB.ink(Pld, [[lx + 10 * t, OB.lerp(ly0, ly1, t)], [lx + 13 + 10 * t, OB.lerp(ly0, ly1, t)]], 1.3, { t0: 0, t1: 0 });
        ctx.fillStyle = css(C.ember, 0.6);
        ctx.fill(Pld);
      }
      const dir = [o.tel.dx, o.tel.dy];
      const nx = -dir[1], ny = dir[0];
      const P0 = o.tel.p0;
      // hot core of light behind the tube
      const hc = ctx.createRadialGradient(o.slitMid[0], o.slitMid[1] + 20, 0, o.slitMid[0], o.slitMid[1] + 20, 120);
      hc.addColorStop(0, css([255, 246, 220], 0.9));
      hc.addColorStop(1, css(C.amberHot, 0));
      ctx.fillStyle = hc;
      ctx.fillRect(o.slitMid[0] - 140, o.slitMid[1] - 140, 280, 300);
      ctx.restore();
      // tube: inside part clipped to the slit, outside part clipped to the sky above the dome
      const tube = (L0, L1, w) => {
        const p = [P0[0] + dir[0] * L0, P0[1] + dir[1] * L0], q = [P0[0] + dir[0] * L1, P0[1] + dir[1] * L1];
        return [[p[0] + nx * w, p[1] + ny * w], [q[0] + nx * w, q[1] + ny * w], [q[0] - nx * w, q[1] - ny * w], [p[0] - nx * w, p[1] - ny * w]];
      };
      const drawTube = () => {
        const T = o.tel;
        const parts = [tube(-10, T.len - 52, T.w), tube(T.len - 56, T.len, T.w + 3.5)];
        // declination axis with its counterweight, crossing the slit low down
        const ax = [P0[0] + dir[0] * T.len * 0.2, P0[1] + dir[1] * T.len * 0.2];
        parts.push([[ax[0] - nx * 42 - dir[0] * 3, ax[1] - ny * 42 - dir[1] * 3], [ax[0] + nx * 4 - dir[0] * 3, ax[1] + ny * 4 - dir[1] * 3], [ax[0] + nx * 4 + dir[0] * 3, ax[1] + ny * 4 + dir[1] * 3], [ax[0] - nx * 42 + dir[0] * 3, ax[1] - ny * 42 + dir[1] * 3]]);
        const cw = [ax[0] - nx * 40, ax[1] - ny * 40];
        parts.push(Array.from({ length: 16 }, (_, i) => [cw[0] + Math.cos(i / 16 * OB.TAU) * 10, cw[1] + Math.sin(i / 16 * OB.TAU) * 7]));
        const P = new Path2D();
        for (const pt of parts) OB.path(pt, true, P);
        ctx.fillStyle = css(C.telescope);
        ctx.fill(P);
        // bands
        const Pb = new Path2D();
        for (const L of [T.len * 0.18, T.len * 0.42, T.len - 64, T.len - 3]) OB.path(tube(L, L + 4, T.w + (L > T.len - 70 ? 4 : 1)), true, Pb);
        ctx.fillStyle = css(C.ink);
        ctx.fill(Pb);
        // longitudinal engraving on the tube
        const Pl = new Path2D();
        for (let f = -0.8; f <= 0.81; f += 0.27) {
          const s = [P0[0] + nx * T.w * f, P0[1] + ny * T.w * f];
          OB.ink(Pl, [[s[0], s[1]], [s[0] + dir[0] * (T.len - 64), s[1] + dir[1] * (T.len - 64)]], 1, { t0: 0.1, t1: 0.1 });
        }
        ctx.fillStyle = css(C.ink, 0.9);
        ctx.fill(Pl);
        // finder scope riding on the tube, the focuser and eyepiece at the lower end, bolts on the bands
        {
          const Pd = new Path2D(), Pb2 = new Path2D();
          const fo = T.w + 5;
          const f0 = [P0[0] + dir[0] * T.len * 0.48 + nx * fo, P0[1] + dir[1] * T.len * 0.48 + ny * fo];
          const f1 = [f0[0] + dir[0] * 34, f0[1] + dir[1] * 34];
          OB.ribbon(Pd, [f0, f1], [6, 6]);
          for (const t of [0.15, 0.75]) { const q = [f0[0] + dir[0] * 34 * t, f0[1] + dir[1] * 34 * t]; OB.ribbon(Pd, [q, [q[0] - nx * 5, q[1] - ny * 5]], [2, 2]); }
          const e0 = [P0[0] + dir[0] * 8 - nx * T.w, P0[1] + dir[1] * 8 - ny * T.w];
          OB.ribbon(Pd, [e0, [e0[0] - nx * 9, e0[1] - ny * 9]], [7, 6]);
          OB.ribbon(Pd, [[e0[0] - nx * 9, e0[1] - ny * 9], [e0[0] - nx * 15 + dir[0] * 2, e0[1] - ny * 15 + dir[1] * 2]], [4, 4]);
          ctx.fillStyle = css(C.telescope);
          ctx.fill(Pd);
          ctx.lineWidth = 1.2;
          ctx.strokeStyle = css(C.ink);
          ctx.stroke(Pd);
          for (const L of [T.len * 0.18, T.len * 0.42]) for (const f of [-0.7, 0, 0.7]) OB.dot(Pb2, P0[0] + dir[0] * (L + 2) + nx * T.w * f, P0[1] + dir[1] * (L + 2) + ny * T.w * f, 0.9);
          ctx.fillStyle = css(C.amberHot, 0.8);
          ctx.fill(Pb2);
        }
        // rims: amber from the interior below on one side, cool sky light on the other
        const rimA = new Path2D(), rimB = new Path2D();
        const e1 = [P0[0] + nx * (T.w - 2), P0[1] + ny * (T.w - 2)], e2 = [P0[0] - nx * (T.w - 2), P0[1] - ny * (T.w - 2)];
        OB.ink(rimA, [e2, [e2[0] + dir[0] * T.len, e2[1] + dir[1] * T.len]], 2.4, { t0: 0.05, t1: 0.1 });
        OB.ink(rimB, [e1, [e1[0] + dir[0] * T.len, e1[1] + dir[1] * T.len]], 1.4, { t0: 0.05, t1: 0.1 });
        ctx.fillStyle = css(C.amberHot, 0.95);
        ctx.fill(rimA);
        ctx.fillStyle = css(C.domeHi, 0.6);
        ctx.fill(rimB);
        ctx.lineWidth = 2;
        ctx.strokeStyle = css(C.ink);
        ctx.stroke(P);
        // aperture: dark ellipse at the end
        const end = [P0[0] + dir[0] * T.len, P0[1] + dir[1] * T.len];
        ctx.fillStyle = css(C.ink);
        ctx.beginPath();
        ctx.ellipse(end[0], end[1], T.w + 4, 6, Math.atan2(ny, nx), 0, OB.TAU);
        ctx.fill();
      };
      ctx.save();
      ctx.clip(sp);
      drawTube();
      ctx.restore();
      // slit lips: shutter rails
      const Pl = new Path2D(), Ph = new Path2D();
      for (const edge of [o.slitLeft, o.slitRight]) OB.ink(Pl, edge, 4.2, { t0: 0, t1: 0.05, wn: 0.2 });
      const inL = o.slitLeft.map((q) => [q[0] + 4, q[1]]), inR = o.slitRight.map((q) => [q[0] - 4, q[1]]);
      OB.ink(Ph, inL, 1.6, { t0: 0.05, t1: 0.2 });
      OB.ink(Ph, inR, 1.6, { t0: 0.05, t1: 0.2 });
      ctx.fillStyle = css(C.ink);
      ctx.fill(Pl);
      ctx.fillStyle = css(C.amberHot, 0.9);
      ctx.fill(Ph);
      // bottom sill of the slit
      const s0 = OB.path([o.slitLeft[0], o.slitRight[0], [o.slitRight[0][0], o.slitRight[0][1] + 6], [o.slitLeft[0][0], o.slitLeft[0][1] + 6]]);
      ctx.fillStyle = css(C.ink);
      ctx.fill(s0);
    }

    // ---------------------------------------------------------- finial / lightning rod
    {
      const a = [o.cx, o.y0 - o.domeR - 2];
      const P = new Path2D();
      OB.ink(P, [[a[0] - 1, a[1] + 4], [a[0] + 1, a[1] - 60]], 2.6, { t0: 0, t1: 0.5 });
      P.moveTo(a[0] + 7, a[1] - 2);
      P.arc(a[0], a[1] - 2, 7, 0, OB.TAU);
      ctx.fillStyle = css(C.ink);
      ctx.fill(P);
      ctx.fillStyle = css(C.domeHi, 0.8);
      ctx.beginPath();
      ctx.arc(a[0] - 2.5, a[1] - 4.5, 2, 0, OB.TAU);
      ctx.fill();
      // weathervane: compass arms, a ball, and an arrow turned into the wind
      const V = new Path2D(), Vh = new Path2D();
      const yA = a[1] - 44, yV = a[1] - 66;
      OB.ink(V, [[a[0] + 0.8, a[1] - 58], [a[0] + 0.5, a[1] - 80]], 1.8, { t0: 0, t1: 0.2 });
      OB.ink(V, [[a[0] - 16, yA], [a[0] + 16, yA]], 1.5, { t0: 0.05, t1: 0.05 });
      OB.ink(V, [[a[0] - 6, yA + 3], [a[0] + 6, yA - 3]], 1.3, { t0: 0.05, t1: 0.05 });
      for (const [dx, dy] of [[-16, 0], [16, 0], [-6, 3], [6, -3]]) OB.dot(V, a[0] + dx, yA + dy, 1.6);
      OB.dot(V, a[0] + 0.6, yA - 7, 3.2);
      V.moveTo(a[0] - 24, yV); V.lineTo(a[0] - 15, yV - 4.5); V.lineTo(a[0] - 16, yV - 1); V.lineTo(a[0] + 12, yV - 1); V.lineTo(a[0] + 12, yV + 1.2); V.lineTo(a[0] - 16, yV + 1.2); V.lineTo(a[0] - 15, yV + 4.5); V.closePath();
      V.moveTo(a[0] + 8, yV); V.lineTo(a[0] + 22, yV - 9); V.lineTo(a[0] + 20, yV); V.lineTo(a[0] + 22, yV + 7); V.closePath();
      ctx.fillStyle = css(C.ink);
      ctx.fill(V);
      OB.ink(Vh, [[a[0] - 14, yV - 1.6], [a[0] + 10, yV - 1.6]], 0.7, { t0: 0.1, t1: 0.3 });
      OB.dot(Vh, a[0] - 0.6, yA - 8.4, 1);
      ctx.fillStyle = css(mix(C.domeHi, C.amberHot, 0.35), 0.75);
      ctx.fill(Vh);
    }

    // ---------------------------------------------------------- iron railing on the terrace and stair
    {
      const Rt = o.terraceR + 4, yb = o.terraceTop - 13, hRail = 46;
      const B = new OB.Batch();
      const col = (x, y) => OB.warmCss(C.ink, x, y, 'rail', 1);
      const rail = (h, w) => {
        const pts = [];
        for (let p = -1.52; p <= 1.52; p += 0.02) pts.push(o.ring(Rt, yb - h, p));
        for (let i = 0; i < pts.length - 1; i += 10) {
          const seg = pts.slice(i, i + 11);
          OB.ink(B.get(col(seg[0][0], seg[0][1])), seg, w, { t0: 0, t1: 0, wn: 0.15 });
        }
        return pts;
      };
      rail(hRail, 3.2);
      rail(hRail * 0.5, 2);
      rail(4, 2.2);
      const Pf = new Path2D();
      for (let p = -1.5; p <= 1.5; p += 0.09) {
        const a = o.ring(Rt, yb, p), b = o.ring(Rt, yb - hRail - 2, p);
        const major = Math.abs((p + 1.5) / 0.09 - Math.round((p + 1.5) / 0.09)) < 0.01 && Math.round((p + 1.5) / 0.09) % 3 === 0;
        OB.ink(B.get(col(a[0], a[1])), [a, b], major ? 3.2 : 1.7, { t0: 0, t1: 0 });
        if (major) { Pf.moveTo(b[0] + 3.4, b[1] - 2); Pf.arc(b[0], b[1] - 2, 3.4, 0, OB.TAU); }
      }
      // scrollwork: a small iron curl tucked under the top rail in each bay
      for (let p = -1.455; p <= 1.45; p += 0.09) {
        const vis = Math.cos(p);
        if (vis < 0.15) continue;
        const c = o.ring(Rt, yb - hRail + 8, p);
        const r = 4.2 * vis;
        const Ps2 = B.get(col(c[0], c[1]));
        const sc = [];
        for (let t = 0; t <= 1; t += 0.08) { const a = Math.PI * 0.5 + t * 5.2, rr = r * (1 - 0.55 * t); sc.push([c[0] + Math.cos(a) * rr, c[1] + Math.sin(a) * rr * 1.1]); }
        OB.ribbon(Ps2, sc, sc.map((q, i) => 1.3 - 0.06 * i));
      }
      B.fill(ctx);
      ctx.fillStyle = css(C.ink);
      ctx.fill(Pf);
      // warm glints on the rail where the window and door light reach it
      const Pg = new Path2D();
      const top = [];
      for (let p = -1.52; p <= 1.52; p += 0.02) top.push(o.ring(Rt, yb - hRail - 1.6, p));
      OB.runs(Pg, top, (i) => 1.3 * OB.warm(top[i][0], top[i][1], 'rail') + 0.3, (i) => OB.warm(top[i][0], top[i][1], 'rail') > 0.15, 2);
      ctx.fillStyle = css(C.amberHot, 0.9);
      ctx.fill(Pg);
      // stair rail
      const st = o.stair;
      const Ps = new OB.Batch();
      const n = st.n, rise = (st.y0 - st.y1) / n, run = (st.x1 - st.x0) / n;
      const posts = [];
      for (let i = 0; i <= n; i += 2) {
        const x = st.x0 + i * run + run * 0.4, y = st.y0 - Math.min(n, i + 1) * rise;
        posts.push([x, y, y - hRail]);
      }
      for (const [x, y, t] of posts) {
        OB.ink(Ps.get(col(x, y)), [[x, y], [x, t]], 2.6, { t0: 0, t1: 0 });
        Pf.moveTo(x + 3, t - 2);
        Pf.arc(x, t - 2, 3, 0, OB.TAU);
      }
      const tp = posts.map((q) => [q[0], q[2]]);
      OB.ink(Ps.get(col(st.x1, st.y1)), tp, 3, { t0: 0, t1: 0 });
      OB.ink(Ps.get(col(st.x1, st.y1)), posts.map((q) => [q[0], (q[1] + q[2]) / 2]), 1.8, { t0: 0, t1: 0 });
      Ps.fill(ctx);
      ctx.fillStyle = css(C.ink);
      ctx.fill(Pf);
      const Pg2 = new Path2D();
      OB.runs(Pg2, OB.resample(tp, 3).map((q) => [q[0], q[1] - 1.5]), () => 1.2, () => true, 2);
      ctx.fillStyle = OB.warmCss(C.rockHi, st.x1, st.y1, 'rail', 1, 0.8);
      ctx.fill(Pg2);
    }
  };

  // glow passes for the observatory (after everything around it is drawn)
  OB.observatoryGlow = (ctx, S) => {
    const o = S.obs, C = OB.C;
    const m = o.slitMid;
    // the halo lives in the sky behind the building, not on its skin
    ctx.save();
    const sky = new Path2D();
    sky.rect(-10, -10, OB.W + 20, 1770);
    sky.addPath(o.domePath);
    sky.rect(o.cx - o.drumR - 2, o.drumTop - 26, o.drumR * 2 + 4, 400);
    ctx.clip(sky, 'evenodd');
    OB.glow(ctx, m[0], m[1] - 80, 1000, C.amber, 0.17);
    OB.glow(ctx, m[0], m[1] - 40, 420, C.amber, 0.36);
    OB.glow(ctx, m[0], m[1] - 10, 160, C.amberHot, 0.45);
    ctx.restore();
    // light spilling onto the shutter lips and the panels right beside the slit
    ctx.save();
    ctx.clip(o.domePath);
    OB.glow(ctx, m[0], m[1], 110, C.amber, 0.3);
    ctx.restore();
    // engraved halo: fine radial rays fanning from the slit into the sky
    const R = OB.rng(5);
    const P = new Path2D();
    ctx.save();
    const outside = new Path2D();
    outside.rect(0, 0, OB.W, o.y0 + 20);
    outside.addPath(o.domePath);
    ctx.clip(outside, 'evenodd');
    for (let k = 0; k < 140; k++) {
      const a = -Math.PI / 2 + (R() - 0.5) * 2.6;
      const r0 = 230 + R() * 40, r1 = r0 + 60 + R() * 260 * Math.pow(Math.cos(a + Math.PI / 2), 2);
      const cx = m[0], cy = m[1] + 40;
      OB.ribbon(P, [[cx + Math.cos(a) * r0, cy + Math.sin(a) * r0], [cx + Math.cos(a) * (r0 + r1) / 2, cy + Math.sin(a) * (r0 + r1) / 2], [cx + Math.cos(a) * r1, cy + Math.sin(a) * r1]], [0.1, 1.1, 0.1]);
    }
    ctx.fillStyle = css(C.amberHot, 0.22);
    ctx.fill(P);
    ctx.restore();
    OB.glow(ctx, o.win.x, o.win.y, 110, C.amber, 0.3);
    OB.glow(ctx, o.win.x, o.win.y, 40, C.amberHot, 0.35);
    OB.glow(ctx, o.door.x, o.door.y, 150, C.amber, 0.25);
  };
})();
