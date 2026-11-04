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
    LW.log('tree branches', branches.length, 'ms', Math.round(performance.now() - t0));
  };
})();
