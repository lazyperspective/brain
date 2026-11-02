/* Branchlight — strand branches.
 *
 * A limb is a BUNDLE of 1-px strands. Each strand keeps its own colour from trunk to
 * twig tip. Along a limb the strands are laid side by side and braid (each oscillates
 * across the bundle with its own phase), so they cross and weave. At a fork the bundle
 * splits by position: the strands on one side peel off into the side branch, the rest
 * carry on. When a bundle is down to a single strand it becomes a twig and forks
 * recursively into a fine web. Limb headings are steered by a flow field, which is how
 * whole trees sweep, arch over a path or curl around a light.
 */
(function () {
  'use strict';
  const BL = window.BL;
  const { clamp, lerp, smooth, angDiff, mix } = BL;

  const DEF = {
    n: 32, angle: -Math.PI / 2, trunkLen: 80, unit: 7, lenExp: 0.45, wp: 0.6, taper: 0.3, flare: 0.6,
    depth: 0, wander: 0.004, curl: 0.004, field: null, pull: 0.012,
    twigGens: 5, twigLen: 14, twigDecay: 0.8, twigSpread: [0.25, 0.65], twigFade: 0.06,
    split: [0.18, 0.48], spread: [0.35, 0.85], braid: 0.55,
    roots: 0, rootLen: [8, 26], stray: 0.0, strayLen: [40, 140],
    mutate: 0.07, rim: null, back: null, backMin: 8, backW: 0.7, bounds: 90, light: null, marks: 0.25, minLen: 2.5
  };

  BL.tree = function (S, seed, opts) {
    const o = Object.assign({}, DEF, opts);
    const rnd = BL.rng(seed);
    const W = S.W, H = S.H;
    let sid = 0;
    const pickCol = () => rnd.weighted(o.colours);
    const newStrand = (col) => ({
      id: sid++, col: col || pickCol(),
      ph: rnd() * Math.PI * 2, fr: rnd.range(0.05, 0.16), am: rnd.range(0.15, 1) * o.braid, pos: null
    });

    const L = (n) => o.unit * Math.pow(n, o.lenExp) * rnd.range(0.7, 1.25);

    function colourFn(st, gen, lateral) {
      const base = st.col;
      return function (x, y, t) {
        let c = base;
        if (o.rim && lateral != null) {
          // lit edge of thick bundles
          const k = lateral * o.rim.side;
          if (k > 0.25) c = mix(c, o.rim.col, o.rim.amt * (k - 0.25) / 0.75);
        }
        let f = o.depth + gen * o.twigFade + (o.tipFade ? o.tipFade * t : 0);
        if (o.depthFn) f += o.depthFn(x, y);
        return f > 0 ? S.fade(c, x, y, f) : c;
      };
    }

    function stray(st, x, y, a) {
      const len = rnd.range(o.strayLen[0], o.strayLen[1]);
      const pts = [];
      let cv = rnd.range(-0.012, 0.012), cx = x, cy = y;
      for (let s = 0; s < len; s += 0.5) {
        pts.push(cx, cy);
        a += cv * 0.5;
        if (o.field) { const t = o.field(cx, cy, 1); if (t != null) a += angDiff(t, a) * o.pull * 0.5 * 0.5; }
        cx += Math.cos(a) * 0.5; cy += Math.sin(a) * 0.5;
      }
      const fadeFn = colourFn(st, 1, null);
      S.polyline(pts, (px, py, t) => S.fade(fadeFn(px, py, t), px, py, t * 0.6));
    }

    function limb(x, y, ang, len, strands, twigGen, isRoot) {
      if (x < -o.bounds || x > W + o.bounds || y < -o.bounds || y > H + o.bounds) return;
      if (len < o.minLen) return;
      const n = strands.length;
      const step = 0.5;
      const curv = twigGen === -1 && o.trunkCurv != null ? o.trunkCurv : rnd.range(-1, 1) * o.curl;
      const wf = rnd.range(0.03, 0.09), wph = rnd() * 6.283;
      const pullK = o.pull * (0.55 + 0.9 * (1 - Math.min(n, 24) / 24));
      // centreline
      const CL = [];
      let cx = x, cy = y, a = ang;
      for (let s = 0; s <= len; s += step) {
        CL.push(cx, cy, a);
        a += (curv + Math.sin(s * wf + wph) * o.wander) * step;
        if (o.field && !isRoot) { const t = o.field(cx, cy, n); if (t != null) a += angDiff(t, a) * pullK * step; }
        if (o.gravity && !isRoot) a += angDiff(Math.PI / 2, a) * o.gravity * step * (1 / (1 + n));
        cx += Math.cos(a) * step; cy += Math.sin(a) * step;
      }
      const m = CL.length / 3;
      const nx0 = -Math.sin(ang), ny0 = Math.cos(ang);
      // order strands by where they arrive, so peeling and braiding stay coherent
      const inh = strands.map((st) => (st.pos ? (st.pos[0] - x) * nx0 + (st.pos[1] - y) * ny0 : null));
      const order = strands.map((st, i) => i).sort((i, j) => (inh[i] == null ? 0 : inh[i]) - (inh[j] == null ? 0 : inh[j]));
      const blendLen = Math.min(10, len * 0.6);
      const width = (s) => {
        let w = n * o.wp * (1 - o.taper * s / len);
        if (twigGen === -1 && o.flare) w *= 1 + o.flare * Math.exp(-s / 7);
        return n === 1 ? 0 : w;
      };
      const drawOrder = order.slice();
      for (let i = drawOrder.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const t = drawOrder[i]; drawOrder[i] = drawOrder[j]; drawOrder[j] = t; }
      // a dark backing under thick bundles, so trunks read as mass with streaks on top
      if (n >= o.backMin && o.back) {
        for (let i = 0; i < m; i += 1) {
          const s = i * step, px = CL[i * 3], py = CL[i * 3 + 1], pa = CL[i * 3 + 2];
          const hw = width(s) * o.backW * 0.5 * Math.min(1, (n - o.backMin + 2) / 8);
          const sx = -Math.sin(pa), sy = Math.cos(pa);
          for (let q = -hw; q <= hw; q += 0.5) {
            const qx = px + sx * q, qy = py + sy * q;
            const c = o.depth > 0 ? S.fade(o.back, qx, qy, o.depth) : o.back;
            S.px(qx, qy, c);
          }
        }
      }
      const ends = new Array(n);
      const rank = new Array(n);
      order.forEach((si, k) => { rank[si] = k; });
      for (const si of drawOrder) {
        const st = strands[si], k = rank[si];
        const pts = [];
        let lat = 0, ex = x, ey = y;
        for (let i = 0; i < m; i++) {
          const s = i * step, px = CL[i * 3], py = CL[i * 3 + 1], pa = CL[i * 3 + 2];
          const w = width(s);
          const base = n === 1 ? 0 : ((k + 0.5) / n - 0.5) * w;
          const br = n === 1 ? 0 : st.am * w * 0.5 * Math.sin(s * st.fr + st.ph);
          const lay = base + br;
          const off = inh[si] == null ? lay : lerp(inh[si], lay, smooth(0, blendLen, s));
          ex = px - Math.sin(pa) * off; ey = py + Math.cos(pa) * off;
          pts.push(ex, ey);
          if (i === m - 1 && w > 0) lat = clamp(off / (w * 0.5), -1, 1);
        }
        const gen = twigGen < 0 ? 0 : twigGen;
        const lateral = n > 3 ? ((k + 0.5) / n - 0.5) * 2 : null;
        S.polyline(pts, colourFn(st, gen, lateral));
        ends[si] = [ex, ey];
        st.pos = [ex, ey];
      }
      // splatter anchors
      if (o.marks > 0) for (let i = 0; i < m; i += 8) if (rnd() < o.marks) S.marks.push([CL[i * 3], CL[i * 3 + 1], strands[Math.floor(rnd() * n)].col, o.depth]);

      const ea = CL[(m - 1) * 3 + 2];
      const exC = CL[(m - 1) * 3], eyC = CL[(m - 1) * 3 + 1];

      if (o.stray && n >= 3 && rnd() < o.stray) {
        const st = strands[Math.floor(rnd() * n)];
        stray(st, st.pos[0], st.pos[1], ea + rnd.range(-0.35, 0.35));
      }

      if (n >= 2) {
        const nx = -Math.sin(ea), ny = Math.cos(ea);
        const sorted = strands.slice().sort((p, q) => ((p.pos[0] - exC) * nx + (p.pos[1] - eyC) * ny) - ((q.pos[0] - exC) * nx + (q.pos[1] - eyC) * ny));
        let ns = Math.round(n * rnd.range(o.split[0], o.split[1]));
        ns = clamp(ns, 1, n - 1);
        const leftSide = rnd() < 0.5;
        const side = leftSide ? sorted.slice(0, ns) : sorted.slice(n - ns);
        const main = leftSide ? sorted.slice(ns) : sorted.slice(0, n - ns);
        const sign = leftSide ? -1 : 1;
        const sa = ea + sign * rnd.range(o.spread[0], o.spread[1]);
        const ma = ea - sign * rnd.range(0.04, 0.28) * (0.5 + ns / n);
        const centre = (arr) => { let sx = 0, sy = 0; for (const s of arr) { sx += s.pos[0]; sy += s.pos[1]; } return [sx / arr.length, sy / arr.length]; };
        const cs = centre(side), cm = centre(main);
        const kids = [
          () => limb(cs[0], cs[1], sa, side.length === 1 ? twigLength(0) : L(side.length), side, side.length === 1 ? 0 : 1, isRoot),
          () => limb(cm[0], cm[1], ma, main.length === 1 ? twigLength(0) : L(main.length), main, main.length === 1 ? 0 : 1, isRoot)
        ];
        if (rnd() < 0.5) kids.reverse();
        kids[0](); kids[1]();
      } else if (twigGen < o.twigGens) {
        const st = strands[0];
        const kidsN = twigGen === 0 && rnd() < 0.35 ? 3 : 2;
        for (let c = 0; c < kidsN; c++) {
          let col = st.col;
          if (rnd() < o.mutate) col = pickCol();
          const ns = newStrand(col);
          ns.pos = [exC, eyC];
          const sp = rnd.range(o.twigSpread[0], o.twigSpread[1]);
          const da = kidsN === 2 ? (c === 0 ? -sp : sp * rnd.range(0.4, 1)) : (c - 1) * sp;
          limb(exC, eyC, ea + da + rnd.range(-0.1, 0.1), twigLength(twigGen + 1), [ns], twigGen + 1, isRoot);
        }
      }
    }
    function twigLength(g) { return o.twigLen * Math.pow(o.twigDecay, g) * rnd.range(0.55, 1.2); }

    // trunk
    const strands = [];
    for (let i = 0; i < o.n; i++) strands.push(newStrand());
    limb(o.x, o.y, o.angle, o.trunkLen, strands, -1, false);

    // roots: single strands spilling sideways into the ground
    for (let r = 0; r < o.roots; r++) {
      const side = rnd() < 0.5 ? -1 : 1;
      const w = o.n * o.wp * (1 + o.flare) * 0.5;
      const st = newStrand();
      const sx = o.x + side * rnd.range(0, w), sy = o.y - rnd.range(0, 3);
      st.pos = [sx, sy];
      const a = side > 0 ? rnd.range(0.05, 0.6) : Math.PI - rnd.range(0.05, 0.6);
      limb(sx, sy, a, rnd.range(o.rootLen[0], o.rootLen[1]), [st], 2, true);
    }
  };

  /* ---------------------------------------------------- long sky lines */
  // Thrown-thread arcs: a heading, a slowly changing curvature, optional flow field.
  BL.arcPoints = function (x, y, a, len, curv, dcurv, field, pull) {
    const pts = [];
    for (let s = 0; s < len; s += 0.5) {
      pts.push(x, y);
      a += (curv + dcurv * s) * 0.5;
      if (field) { const t = field(x, y); if (t != null) a += angDiff(t, a) * pull * 0.5; }
      x += Math.cos(a) * 0.5; y += Math.sin(a) * 0.5;
    }
    return pts;
  };

  BL.skyLines = function (S, seed, o) {
    const rnd = BL.rng(seed);
    for (let i = 0; i < o.count; i++) {
      const st = o.start(rnd, i);
      const len = rnd.range(o.len[0], o.len[1]);
      const curv = rnd.range(o.curv[0], o.curv[1]);
      const dcurv = o.dcurv ? rnd.range(-o.dcurv, o.dcurv) : 0;
      const pts = BL.arcPoints(st[0], st[1], st[2], len, curv, dcurv, o.field, o.pull || 0);
      const col = rnd.weighted(o.colours);
      const fade = rnd.range(o.fade[0], o.fade[1]);
      const dotted = rnd() < (o.dotted || 0);
      const keep = rnd.range(0.35, 0.7);
      const fadeEnds = o.fadeEnds == null ? 0.5 : o.fadeEnds;
      S.polyline(pts, (x, y, t) => {
        if (dotted && BL.bayer(x, y) > keep) return null;
        const e = Math.min(t, 1 - t) * 2; // 0 at ends, 1 mid
        let f = fade + (1 - e) * fadeEnds;
        if (o.fadeFn) f += o.fadeFn(x, y);
        if (o.clipY != null && y > o.clipY) f += (y - o.clipY) / 12;
        if (f >= 0.97) return null;
        return S.fade(col, x, y, f);
      });
    }
  };
})();
