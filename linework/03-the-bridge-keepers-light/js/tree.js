/* tree.js: a wind-twisted juniper growing out of the left cliff edge.
   Recursive skeleton -> tapered ribbons with helical grain for the limbs,
   inked strokes for the twigs, a few dense foliage pads. */
(function () {
  'use strict';
  const LW = window.LW;
  const P = LW.P;
  const N = new LW.Noise(801);
  const N2 = new LW.Noise(802);

  const ROOT = [770, 1512];

  function grow() {
    const rng = new LW.RNG('juniper-7');
    const branches = [];
    function branch(x, y, ang, w, len, depth, parentT) {
      const pts = [[x, y]], ws = [w];
      let a = ang, s = 0;
      const step = Math.max(3, Math.min(10, w * 0.4));
      const gn = rng.next() * 100;
      const b0 = branches.length;
      const tgt = -0.35 - ((b0 * 0.618) % 1) * 2.3;
      const twistAmp = depth === 0 ? 0.11 : 0.1 + depth * 0.025;
      const up = depth === 0 ? 0.0045 : depth < 3 ? 0.005 : 0.0025;
      while (s < len) {
        // gnarl: noisy turning, kinks
        a += N.n2(gn + s / 60, depth * 3.1) * twistAmp + (rng.next() - 0.5) * 0.05;
        if (rng.next() < 0.015 * (depth + 1)) a += (rng.next() - 0.5) * 0.7;
        // phototropism toward up-right sky, juniper droop on long thin limbs
        const target = depth === 0 && s < len * 0.3 ? -0.5 : depth === 0 ? -1.0 : depth < 3 ? -0.75 + (b0 % 2 ? -0.55 : 0.5) : tgt;
        let da = target - a;
        while (da > Math.PI) da -= Math.PI * 2;
        while (da < -Math.PI) da += Math.PI * 2;
        a += da * up * step * (depth === 0 ? 1.8 : 1);
        x += Math.cos(a) * step;
        y += Math.sin(a) * step;
        s += step;
        pts.push([x, y]);
        ws.push(w * (1 - 0.38 * (s / len)) * (depth === 0 ? 1 + 0.55 * Math.exp(-s / 45) : 1));
      }
      const b = { pts, ws, depth, w };
      branches.push(b);
      const wEnd = ws[ws.length - 1];
      if (wEnd < 0.8 || depth > 9) return;
      // side shoots along the way
      const nSide = depth === 0 ? 3 : depth < 3 ? 2 + rng.int(0, 1) : rng.int(1, 3);
      for (let i = 0; i < nSide; i++) {
        const t = (depth === 0 ? 0.5 : 0.3) + rng.next() * (depth === 0 ? 0.45 : 0.6);
        const k = Math.floor(t * (pts.length - 1));
        const bw = ws[k] * (0.32 + rng.next() * 0.25);
        if (bw < 0.9) continue;
        const sa = Math.atan2(pts[k + 1][1] - pts[k][1], pts[k + 1][0] - pts[k][0]) + rng.sign() * (0.5 + rng.next() * 0.7);
        branch(pts[k][0], pts[k][1], sa, bw, len * (0.32 + rng.next() * 0.28), depth + 1, t);
      }
      // fork at the end
      const ea = Math.atan2(pts[pts.length - 1][1] - pts[pts.length - 2][1], pts[pts.length - 1][0] - pts[pts.length - 2][0]);
      const nf = depth < 2 ? 2 : 2 + (rng.next() < 0.3 ? 1 : 0);
      for (let i = 0; i < nf; i++) {
        const spread = 0.35 + rng.next() * 0.45;
        const fa = ea + (i - (nf - 1) / 2) * spread * 1.4 + (rng.next() - 0.5) * 0.3;
        const fw = wEnd * (i === 0 ? 0.8 : 0.62) * (0.9 + rng.next() * 0.15);
        branch(x, y, fa, fw, len * (0.56 + rng.next() * 0.2), depth + 1, 1);
      }
    }
    // trunk: out of the crack, then up
    branch(ROOT[0], ROOT[1], -0.42, 74, 360, 0, 0);
    return branches;
  }

  function ribbon(b) {
    const L = [], R = [];
    const n = b.pts.length;
    for (let i = 0; i < n; i++) {
      const a = b.pts[Math.max(0, i - 1)], c = b.pts[Math.min(n - 1, i + 1)];
      let tx = c[0] - a[0], ty = c[1] - a[1];
      const l = Math.hypot(tx, ty) || 1;
      tx /= l; ty /= l;
      const w = b.ws[i] / 2 * (1 + 0.08 * N2.n2(b.pts[i][0] / 18, b.pts[i][1] / 18));
      L.push([b.pts[i][0] - ty * w, b.pts[i][1] + tx * w]);
      R.push([b.pts[i][0] + ty * w, b.pts[i][1] - tx * w]);
    }
    return { L, R, poly: L.concat(R.slice().reverse()) };
  }

  LW.drawTree = function (ctx, S) {
    const t0 = performance.now();
    const branches = grow();
    branches.sort((a, b) => a.w - b.w);
    const inkC = P.ink;
    // thin twigs first: plain ink strokes tapering
    const ink = new LW.Ink(803);
    ink.wobble = 0.35;
    const twig = ink.col(inkC);
    for (const b of branches) {
      if (b.w > 5) continue;
      const ws = b.ws;
      ink.line(b.pts, (x, y, i) => ink.st(twig, Math.max(0.7, ws[Math.min(i, ws.length - 1)] * 1.05)), { taper: 10, minScale: 0.35 });
    }
    // fine spurs and dead snags along the twigs
    {
      const sr = new LW.RNG('spurs');
      for (const b of branches) {
        if (b.w > 4 || b.pts.length < 4) continue;
        for (let i = 2; i < b.pts.length - 1; i++) {
          if (sr.next() > 0.22) continue;
          const p = b.pts[i], q = b.pts[i - 1];
          const a = Math.atan2(p[1] - q[1], p[0] - q[0]) + sr.sign() * (0.6 + sr.next() * 0.6);
          const len = 4 + sr.next() * 9;
          const m = [p[0] + Math.cos(a) * len * 0.5, p[1] + Math.sin(a) * len * 0.5];
          const e = [p[0] + Math.cos(a + (sr.next() - 0.5) * 0.6) * len, p[1] + Math.sin(a + (sr.next() - 0.5) * 0.6) * len];
          ink.line([p, m, e], ink.st(twig, 0.85), { taper: len * 0.7, minScale: 0.15, wobble: 0.2 });
        }
      }
    }
    ink.flush(ctx);
    // limbs: ribbons with grain
    for (const b of branches) {
      if (b.w <= 5) continue;
      const r = ribbon(b);
      const path = LW.polyPath(r.poly);
      LW.shadeFill(ctx, S, path, LW.bbox(r.poly, 2), (x, y, o) => {
        // simple cylinder shading: which side of the skeleton are we on (moon from upper right)
        const c = LW.stepPick([LW.mix(P.rock2, P.wood0, 0.5), P.wood0, P.wood1, LW.mix(P.wood1, P.ink, 0.45)], 0.55 + 0.25 * N.fbm(x / 30, y / 30, 2), x, y, 0.08);
        const wv = LW.warm(x, y, 'tree');
        const wb = LW.warmBand(wv, x, y);
        const cc = wb > 0 ? LW.warmFill[Math.min(wb, 4)] : c;
        o[0] = cc[0]; o[1] = cc[1]; o[2] = cc[2];
      });
      const g = new LW.Ink(805 + b.pts.length);
      g.wobble = 0.3;
      // lit band along the moon-facing side
      const litSide = [];
      for (let i = 0; i < b.pts.length; i++) {
        const a = r.L[i], c = r.R[i];
        // pick the side whose normal points up/right
        const nx = a[0] - b.pts[i][0], ny = a[1] - b.pts[i][1];
        const useL = nx * 0.5 - ny * 0.62 > 0;
        const e = useL ? a : c;
        litSide.push([b.pts[i][0] + (e[0] - b.pts[i][0]) * 0.92, b.pts[i][1] + (e[1] - b.pts[i][1]) * 0.92]);
      }
      // helical grain lines
      const nLines = Math.max(3, Math.round(b.w / 3.4));
      const twist = 0.012 + 0.01 * (b.depth === 0 ? 1.5 : 1);
      const cl = g.col(inkC);
      const n = b.pts.length;
      for (let k = 0; k < nLines; k++) {
        const th0 = (k / nLines) * Math.PI * 2;
        const line = [];
        const vis = [];
        let s = 0;
        for (let i = 0; i < n; i++) {
          if (i > 0) s += Math.hypot(b.pts[i][0] - b.pts[i - 1][0], b.pts[i][1] - b.pts[i - 1][1]);
          const th = th0 + twist * s + 0.6 * N.n2(s / 70 + k, b.depth);
          const lat = Math.sin(th) * 0.92;
          const a = r.L[i], c = r.R[i];
          const m = (lat + 1) / 2;
          line.push([a[0] + (c[0] - a[0]) * m, a[1] + (c[1] - a[1]) * m]);
          vis.push(Math.cos(th));
        }
        g.line(line, (x, y, i) => {
          if (vis[Math.min(i, n - 1)] < 0.05) return -1;
          return g.st(cl, 0.8 + Math.min(1.4, b.w / 30));
        }, { taper: 12 });
      }
      // bark: deep broken fissures running with the grain, plate checks between them,
      // cross-hatch and stipple on the shadow side, pale flecks on the lit side
      {
        const br = new LW.RNG('bark' + b.pts.length + '-' + Math.round(b.w));
        const dots = new LW.Dots();
        const nF = Math.max(2, Math.round(b.w / 5.5));
        const fis = g.col(LW.mix(P.ink, [0, 0, 0], 0.25));
        const latAt = [];
        for (let k = 0; k < nF; k++) {
          const lat0 = -0.85 + 1.7 * (k + 0.5) / nF + (br.next() - 0.5) * 0.2;
          latAt.push(lat0);
          const pts = [];
          for (let i = 0; i < n; i++) {
            const lat = lat0 + 0.12 * N2.n2(i / 6 + k * 3.3, b.depth);
            const a = r.L[i], c = r.R[i];
            const m = (lat + 1) / 2;
            pts.push([a[0] + (c[0] - a[0]) * m, a[1] + (c[1] - a[1]) * m]);
          }
          const ph = br.next() * 50;
          g.line(pts, (x, y, i) => {
            if (N.n2(i / 5 + ph, k * 1.9) > 0.15) return -1;
            return g.st(fis, Math.min(2.4, 0.9 + b.w / 26));
          }, { taper: 8, minScale: 0.25 });
        }
        // checks: short cross strokes between neighbouring fissures (bark plates)
        for (let i = 2; i < n - 2; i += 2) {
          if (br.next() > 0.35) continue;
          const k = Math.floor(br.next() * (nF - 1));
          const a = r.L[i], c = r.R[i];
          const m0 = (latAt[k] + 1) / 2, m1 = (latAt[k + 1] + 1) / 2;
          const p0 = [a[0] + (c[0] - a[0]) * m0, a[1] + (c[1] - a[1]) * m0];
          const p1 = [a[0] + (c[0] - a[0]) * m1, a[1] + (c[1] - a[1]) * m1 + 3];
          g.line([p0, p1], g.st(fis, 0.8), { taper: 3, wobble: 0.3 });
        }
        // shadow side: cross-hatch at a slant across the limb + stipple
        const litIsL = [];
        for (let i = 0; i < n; i++) {
          const nx = r.L[i][0] - b.pts[i][0], ny = r.L[i][1] - b.pts[i][1];
          litIsL.push(nx * 0.5 - ny * 0.62 > 0);
        }
        const hs = Math.max(2.6, Math.min(4.2, b.w / 8));
        let acc = 0;
        for (let i = 1; i < n; i++) {
          acc += Math.hypot(b.pts[i][0] - b.pts[i - 1][0], b.pts[i][1] - b.pts[i - 1][1]);
          if (acc < hs) continue;
          acc = 0;
          const sh = litIsL[i] ? r.R[i] : r.L[i];
          const ctr = b.pts[i];
          const j = Math.min(n - 1, i + 2);
          const sh2 = litIsL[j] ? r.R[j] : r.L[j];
          const st = 0.15 + br.next() * 0.25;
          const p0 = [ctr[0] + (sh[0] - ctr[0]) * st, ctr[1] + (sh[1] - ctr[1]) * st];
          g.line([p0, [sh2[0] + (sh[0] - ctr[0]) * 0.1, sh2[1] + (sh[1] - ctr[1]) * 0.1]], (x, y) => {
            const wb = LW.warmBand(LW.warm(x, y, 'tree'), x, y, 0);
            return g.st(wb >= 3 ? g.col(P.warmInk2) : cl, 0.75);
          }, { taper: 4, wobble: 0.2 });
        }
        const bb = LW.bbox(r.poly, 0);
        const area = (bb[2] - bb[0]) * (bb[3] - bb[1]);
        const nd = Math.min(4000, Math.round(area / 18));
        const pale = LW.rgb(LW.mix(P.wood0, P.rock0, 0.6)), dk = LW.rgb(P.ink);
        for (let q = 0; q < nd; q++) {
          const i = Math.floor(br.next() * n);
          const lat = br.next() * 2 - 1;
          const a = r.L[i], c = r.R[i];
          const m = (lat + 1) / 2;
          const x = a[0] + (c[0] - a[0]) * m, y = a[1] + (c[1] - a[1]) * m;
          const shadow = litIsL[i] ? lat > 0.1 : lat < -0.1;
          if (shadow) { if (br.next() < 0.55) dots.dot(x, y, 0.5 + br.next() * 0.6, dk); }
          else if (br.next() < 0.12) dots.flick(x, y, Math.atan2(c[1] - a[1], c[0] - a[0]) + Math.PI / 2, 2 + br.next() * 3, 0.8, pale);
        }
        b._dots = dots;
      }
      // knots on the trunk
      if (b.w > 20) {
        const rng = new LW.RNG('knots' + b.pts.length);
        for (let k = 0; k < 4; k++) {
          const i = Math.floor((0.15 + rng.next() * 0.7) * (n - 1));
          const p = b.pts[i];
          const rr = b.ws[i] * 0.16;
          for (let q = 0; q < 3; q++) {
            const ring = [];
            for (let a = 0; a <= 6.4; a += 0.4) ring.push([p[0] + Math.cos(a) * rr * (1 + q * 0.6), p[1] + Math.sin(a) * rr * 0.6 * (1 + q * 0.6)]);
            g.line(ring, g.st(cl, 1.3 - q * 0.25), { taper: 0 });
          }
        }
      }
      ctx.save();
      ctx.clip(path);
      g.flush(ctx);
      if (b._dots) b._dots.flush(ctx);
      ctx.restore();
      // outlines: heavier on the shadow (lower-left) side
      const o = new LW.Ink(806 + b.pts.length);
      o.wobble = 0.4;
      const wo = Math.min(4.2, 1.6 + b.w / 14);
      const sideW = (side) => (x, y, i) => {
        const p = b.pts[Math.min(i, n - 1)];
        const nx = x - p[0], ny = y - p[1];
        const lit = nx * 0.5 - ny * 0.62 > 0;
        return o.st(o.col(inkC), lit ? wo * 0.7 : wo * 1.35);
      };
      o.line(r.L, sideW(0), { taper: 0 });
      o.line(r.R, sideW(1), { taper: 0 });
      o.flush(ctx);
      void litSide;
    }
    LW.drawJuniperFoliage(ctx, S, branches, 'front');
    LW.log('tree branches', branches.length, 'ms', Math.round(performance.now() - t0));
  };

  /* juniper foliage: a few sprays of scale-leaf lobes strung along the twig
     ends of chosen limbs; near-black mass, moonlit flicks on the upper side. */
  LW.drawJuniperFoliage = function (ctx, S, branches, pass) {
    if (pass !== 'front') return;
    const fr = new LW.RNG('juniper-pads');
    const [mx, my, mr] = LW.L.moon;
    const ends = branches.filter((b) => b.w < 4.5 && b.pts.length > 5);
    const centres = [];
    for (const b of branches) {
      if (b.depth < 3 || b.depth > 6 || b.w < 1.6 || b.w > 7) continue;
      const p = b.pts[b.pts.length - 1];
      if (Math.hypot(p[0] - mx, p[1] - my) < mr + 220) continue;
      if (p[1] > 1430 || p[0] < 760 || p[0] > 1500) continue;
      if (centres.some((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) < 150)) continue;
      if (fr.next() < 0.5) continue;
      centres.push(p);
      if (centres.length >= 5) break;
    }
    const ink = new LW.Ink(862);
    ink.wobble = 0.25;
    const dots = new LW.Dots();
    const dark = LW.mix(P.tealDark, P.ink, 0.72);
    const lit = LW.rgb(LW.mix(P.teal, P.sky3, 0.6)), lit2 = LW.rgb(LW.mix(P.teal, P.sky5, 0.5));
    let lobes = 0;
    for (const c of centres) {
      for (const b of ends) {
        const e = b.pts[b.pts.length - 1];
        if (Math.hypot(e[0] - c[0], e[1] - c[1]) > 70) continue;
        const n = b.pts.length;
        for (let i = Math.floor(n * 0.4); i < n; i += 1) {
          if (fr.next() > 0.55) continue;
          const p = b.pts[i];
          const rx = 4 + fr.next() * 6 * (1 - 0.4 * i / n), ry = rx * (0.5 + fr.next() * 0.2);
          const cx = p[0] + (fr.next() - 0.5) * 4, cy = p[1] - ry * 0.35;
          const pts = [];
          for (let k = 0; k < 14; k++) {
            const a = (k / 14) * Math.PI * 2;
            const sc = 1 + 0.2 * Math.sin(a * 4 + i) + 0.1 * (fr.next() - 0.5);
            pts.push([cx + Math.cos(a) * rx * sc, cy + Math.sin(a) * ry * sc]);
          }
          ink.fill(pts, dark, 0.2);
          lobes++;
          // scale-leaf flicks on the moonlit upper edge, black specks below
          const cnt = Math.round(rx * 1.4);
          for (let q = 0; q < cnt; q++) {
            const a = -Math.PI * (0.05 + 0.75 * fr.next());
            const px = cx + Math.cos(a) * rx * 0.8, py = cy + Math.sin(a) * ry * 0.8;
            dots.flick(px, py, a + (fr.next() - 0.5) * 0.6, 1.6 + fr.next() * 2.2, 1.0, fr.next() < 0.25 ? lit2 : lit);
          }
          if (fr.next() < 0.5) ink.line([[cx - rx, cy + ry * 0.5], [cx, cy + ry * 0.9], [cx + rx, cy + ry * 0.5]], ink.st(ink.col(P.ink), 0.9), { taper: 3 });
        }
      }
    }
    ink.flush(ctx);
    dots.flush(ctx);
    LW.log('juniper sprays', centres.length, 'lobes', lobes);
  };
})();
