// "The Blue House" - everything that moves. Every function of time here is periodic in G.D, so frame D == frame 0.
(function () {
  const CY = window.CY;
  const { W, H, rgba, mod, wrapd, sm, clamp } = CY;
  const TAU = Math.PI * 2;
  const A = (CY.A = {});

  // ------------------------------------------------------------------ the air
  // breeze from the right: travelling waves along x, plus one soft gust around GUST_T
  A.GUST_T = 18.6;
  let windK = null;
  A.initWind = function (D) {
    const R = CY.rng(700);
    windK = [2, 3, 5, 7, 11].map((k, i) => ({ k, a: [1, 0.8, 0.55, 0.35, 0.18][i], lam: R.r(260, 520), ph: R.f() * TAU }));
  };
  A.wind = function (t, x) {
    const D = CY.G.D;
    let v = 0;
    for (const w of windK) v += w.a * Math.sin((TAU * w.k * t) / D - x / w.lam + w.ph);
    return v / 1.6;
  };
  A.gust = (t) => { const d = wrapd(t, A.GUST_T, CY.G.D); return Math.exp(-(d * d) / (2 * 1.7 * 1.7)); };
  // the late sun is held steady: a slow global fade of the wall changes every pixel by sub-level amounts per
  // frame, which H.264 cannot carry cleanly (it drifts, then snaps at the keyframe). The lantern breathes instead.
  A.sun = () => 1;
  // instead the light travels: the eaves' shadows on the walls deepen and draw back once a loop, and the vine's
  // shadows on the plaster lengthen with them. Moving crisp edges are what a codec carries well.
  A.sunPhase = (t) => Math.sin((TAU * t) / CY.G.D + 0.6);


  // ------------------------------------------------------------------ the bougainvillea
  // evenly spaced samples along a world polyline: world point, screen point, and scale (1 = 140 px per metre)
  function along(pts, step, from, to) {
    const out = [];
    let need = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
      let s0 = need;
      for (; s0 < L; s0 += step) {
        const u = s0 / L, w = [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u];
        const sp = CY.P(w[0], w[1], w[2]);
        out.push({ w, x: sp[0], y: sp[1], k: CY.ppm(w[0], w[2]) / 140 });
      }
      need = s0 - L;
    }
    const n = out.length;
    return out.slice(Math.floor((from || 0) * n), Math.ceil((to == null ? 1 : to) * n));
  }
  A.buildClusters = function () {
    const G = CY.G, R = CY.rng(500), SK = G.SKW, list = [];
    const mass = (pt, ang, angV, r0, r1, d0, d1, extra) => list.push(Object.assign({ x: pt.x + R.g() * 5 * pt.k, y: pt.y + R.g() * 5 * pt.k, ang: ang + R.g() * angV, len: R.r(10, 30) * pt.k, r: R.r(r0, r1) * pt.k, depth: R.r(d0, d1), seed: R.i(1, 1e6), kind: 'mass', elong: R.r(0.9, 1.3), fs: pt.k }, extra || {}));
    const spray = (pt, ang, r) => list.push({ x: pt.x, y: pt.y, ang: ang + R.g() * 0.25, len: R.r(26, 44) * pt.k, r: r * pt.k, depth: R.r(0.45, 0.8), seed: R.i(1, 1e6), kind: 'spray', dens: 0.55, leaves: 0.16, fs: 0.92 * pt.k });
    const strand = (pt, nseg, d0) => {
      let parent = null;
      for (let k = 0; k < nseg; k++) {
        const c = { x: pt.x, y: pt.y, ang: Math.PI / 2 + R.g() * 0.18 + (k ? 0 : R.g() * 0.1), len: (k ? R.r(30, 48) : R.r(14, 30)) * pt.k, r: R.r(24, 34) * (k === nseg - 1 ? 0.8 : 1) * pt.k, depth: R.r(d0, 0.98), seed: R.i(1, 1e6), kind: 'hang', elong: 1.45, dens: 1.1, fs: pt.k, parent, level: k };
        if (parent) parent.child = c;
        list.push(c); parent = c;
      }
    };
    // on the front wall, the climbing trunk carries a few masses
    for (const pt of along(SK.trunk.slice(0, 6), 0.75, 0.35, 1)) mass(pt, R.sign() * 1.4 + Math.PI / 2, 0.6, 26, 40, 0.55, 0.8);
    // along the lower eave, over the door: masses sitting on the eave, strands falling across the wall
    for (const pt of along(SK.eave, 0.5)) mass(pt, -Math.PI / 2, 0.9, 30, 46, 0.5, 0.85);
    along(SK.eave, 0.85, 0.02, 0.98).forEach((pt) => { const x = pt.w[0]; if (x > 1.7 && x < 2.8) return; strand(pt, x >= 2.8 && x < 4.7 ? 1 : R.i(2, 4), 0.78); });
    // across the lower roof, reaching toward the moon, and lying on the tiles
    for (const pt of along(SK.roof, 0.45)) mass(pt, -2.3, 0.6, 32, 52, 0.25, 0.6);
    const rp = along(SK.roof, 0.9);
    for (const pt of rp.slice(-3)) spray(pt, -2.5, 38);
    spray(rp[1], -2.0, 34);
    // up the face of the upper storey, then along under its eave with strands down its wall
    for (const pt of along(SK.trunk.slice(7), 0.5)) mass(pt, R.sign() * 1.3 - Math.PI / 2, 0.6, 30, 48, 0.4, 0.7);
    for (const pt of along(SK.upper, 0.5)) mass(pt, -Math.PI / 2, 0.8, 28, 44, 0.45, 0.75);
    along(SK.upper, 0.8, 0.1, 1).forEach((pt) => strand(pt, R.i(2, 3), 0.8));
    // over the upper eave and up into the sky
    for (const pt of along(SK.top, 0.4)) mass(pt, -1.9, 0.7, 30, 46, 0.3, 0.6);
    const tp = along(SK.top, 0.7);
    tp.forEach((pt, i) => spray(pt, -1.4 - i * 0.25, 40));
    spray(tp[tp.length - 1], -2.4, 36);
    for (const c of list) {
      CY.makeCluster(c);
      // sway: smaller, stiffer masses move less; hanging strands more, each level lagging its parent
      c.A = c.kind === 'hang' ? 0.05 : c.kind === 'spray' ? 0.085 : 0.06 * Math.sqrt(60 / (c.r + c.len * 0.25));
      c.own = CY.loopFn(CY.G.D, c.seed, 2, 9, 0.8);
      c.lag = (c.level || 0) * 0.32 + (c.kind === 'spray' ? 0.15 : 0);
      c.gustDir = Math.sin(c.ang) >= 0 ? 1 : -1; // so the gust always pushes tips toward the left
      c.flick = CY.rng(c.seed + 7).f() * TAU;
    }
    // draw order: by depth, but a strand's segments stay together in order
    const roots = list.filter((c) => !c.parent).sort((a, b) => a.depth - b.depth);
    A.clusters = [];
    for (const c of roots) { let k = c; while (k) { A.clusters.push(k); k = k.child; } }
  };
  // world transforms of all clusters at time t: [cos, sin, X, Y] per cluster (pivot world position)
  A.transforms = function (t) {
    const out = new Map();
    for (const c of A.clusters) {
      const tl = t - c.lag;
      const gu = A.gust(tl);
      let th = c.A * (0.62 * A.wind(tl, c.x) + 0.5 * c.own(t)) * (1 + 0.8 * gu) + c.A * 1.25 * gu * c.gustDir + c.A * 0.35 * gu * Math.sin((TAU * 10 * t) / CY.G.D + c.flick);
      let X = c.x, Y = c.y;
      if (c.parent) {
        const p = out.get(c.parent);
        X = p[2] + p[0] * c.parent.tip[0] - p[1] * c.parent.tip[1];
        Y = p[3] + p[1] * c.parent.tip[0] + p[0] * c.parent.tip[1];
        th += p[4];
      }
      out.set(c, [Math.cos(th), Math.sin(th), X, Y, th]);
    }
    return out;
  };

  // ------------------------------------------------------------------ falling petals
  A.buildPetals = function () {
    const G = CY.G, D = G.D, R = CY.rng(800);
    const src = A.clusters.filter((c) => c.florets.length > 6);
    const tot = src.reduce((s, c) => s + c.florets.length, 0);
    const pickCluster = () => { let r = R.f() * tot; for (const c of src) { r -= c.florets.length; if (r <= 0) return c; } return src[0]; };
    // a running integral of the wind push, so drift is continuous through the gust
    const dt = 1 / 60, n = Math.ceil((2 * D) / dt) + 2, Wi = new Float32Array(n);
    const push = (t) => 10 + 70 * A.gust(t) + 6 * A.wind(t, 500);
    for (let i = 1; i < n; i++) Wi[i] = Wi[i - 1] + push((i - 0.5) * dt) * dt;
    A.windInt = (t) => { const f = t / dt, i = Math.max(0, Math.min(n - 2, f | 0)), u = f - i; return Wi[i] + (Wi[i + 1] - Wi[i]) * u; };
    // the falling petal, painted once per tone (two variants each) at 4x its size on the screen
    A.petalSpr = CY.TONES.map((col, k) => [0, 1].map((v) => {
      const S = CY.mk(48, 48), R2 = CY.rng(1300 + k * 2 + v);
      S.g.translate(4, 24);
      CY.bract(S.g, 0, 0, 0, 40, 0.5, col, 0.96, R2);
      S.g.strokeStyle = rgba(CY.TONES[Math.max(0, k - 3)], 0.4); S.g.lineWidth = 2.2;
      S.g.beginPath(); S.g.moveTo(2, R2.g()); S.g.quadraticCurveTo(18, R2.g() * 3, 32, R2.g() * 2); S.g.stroke();
      S.g.setTransform(1, 0, 0, 1, 0, 0);
      CY.pigment(S, 1300 + k * 2 + v, { blur: 1.4, bleed: 0, lo: 0.08, hi: 0.3, gran: 0.2 });
      return S.c;
    }));
    const P = [];
    const N = 96, NG = 22;
    for (let i = 0; i < N + NG; i++) {
      const gustBorn = i >= N;
      const t0 = gustBorn ? A.GUST_T - 1.6 + R.f() * 2.6 : ((i + R.f() * 0.85) / N) * D;
      const c = pickCluster();
      const f = c.florets[Math.floor(R.f() * c.florets.length)];
      const tr = A.transforms(t0).get(c);
      const x0 = tr[2] + tr[0] * f.x - tr[1] * f.y, y0 = tr[3] + tr[1] * f.x + tr[0] * f.y;
      const p = {
        t0: mod(t0, D), x0, y0, tone: Math.max(2, f.tone), s: R.r(7, 10.5), w: R.r(0.42, 0.56),
        v: R.r(120, 175), drift: R.r(-8, 4), sw: R.r(10, 30), sf: R.r(1.6, 3.2), sp: R.f() * TAU,
        rot0: R.f() * TAU, spin: R.r(0.8, 2.6) * R.sign(), fw: R.r(2.2, 5.2), fp: R.f() * TAU,
        rest: R.r(5, 12), fade: R.r(2.2, 3.2), pushK: R.r(0.7, 1.3), var: i % 2,
      };
      // where it lands: a step, the lower roof's tiles, or the paving (also where the paving has dissolved
      // into the paper, as if the petals lie on the sheet itself)
      let yl = 1800, F = 6;
      for (let it = 0; it < 3; it++) {
        F = (yl - y0) / p.v;
        const xl = A.petalX(p, F);
        const cand = [];
        for (const s2 of G.stepTops) { const r = yRange(s2, xl); if (r && r[0] > y0 + 10) cand.push([r, 0.25]); }
        const rr = yRange(G.lroof, xl); if (rr && rr[0] > y0 + 10) cand.push([rr, 0.3]);
        const bottom = Math.min(1870, G.dissolveBottom(xl) + 60), gTop = Math.max(y0 + 20, groundTop(xl));
        if (bottom > gTop) cand.push([[gTop, bottom], 1]);
        if (!cand.length) { yl = 1880; continue; }
        let pick = R.f() * cand.reduce((s3, c) => s3 + c[1], 0), ch = cand[0];
        for (const c of cand) { pick -= c[1]; if (pick <= 0) { ch = c; break; } }
        yl = R.r(ch[0][0] + 3, Math.max(ch[0][0] + 4, ch[0][1] - 3));
        // not on the jar, and not on the paving where the steps stand in front of it
        const J = G.jar;
        if (Math.abs(xl - J.x) < J.r && yl < J.y + 4 && yl > J.y - J.r * 2.3) yl = J.y + R.r(6, 30);
        if (ch[1] === 1) for (const s2 of G.stepTops) { const r = yRange(s2, xl); if (r && yl < r[1] + 40 && yl > r[0]) yl = r[1] + 40 + R.r(0, 20); }
      }
      p.yl = yl; p.F = (yl - y0) / p.v;
      p.xl = A.petalX(p, p.F);
      p.rotL = p.rot0 + p.spin * p.F;
      p.flipL = Math.cos(p.fw * p.F + p.fp);
      p.life = p.F + p.rest + p.fade;
      P.push(p);
    }
    A.petals = P;
  };
  // the vertical extent of a convex screen polygon at x (null if x misses it)
  function yRange(poly, x) {
    let lo = Infinity, hi = -Infinity;
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length];
      if ((a[0] - x) * (b[0] - x) > 0 || a[0] === b[0]) continue;
      const y = a[1] + ((b[1] - a[1]) * (x - a[0])) / (b[0] - a[0]);
      lo = Math.min(lo, y); hi = Math.max(hi, y);
    }
    return lo < hi ? [lo, hi] : null;
  }
  // the top of the visible paving at x: just in front of the house's foot
  function groundTop(x) { const r = yRange(CY.G.ground, x); return r ? Math.max(r[0], (CY.G.footY ? CY.G.footY(x) : r[0]) + 6) : 1900; }
  A.petalX = function (p, tau) {
    const s = clamp(tau / Math.max(0.1, p.F || 6), 0, 1);
    return p.x0 + p.drift * tau - (A.windInt(p.t0 + tau) - A.windInt(p.t0)) * p.pushK + p.sw * Math.sin(p.sf * tau + p.sp) * Math.min(1, tau / 1.2);
  };
  function easeFall(s) { const a = 0.1; return (s + a * (Math.exp(-s / a) - 1)) / (1 + a * (Math.exp(-1 / a) - 1)); }
  // state of a petal at time t: null if not in the picture
  A.petalState = function (p, t) {
    const D = CY.G.D;
    const tau = mod(t - p.t0, D);
    if (tau >= p.life) return null;
    let x, y, rot, sx, sy, a = 1, light;
    if (tau < p.F) {
      const s = tau / p.F;
      y = p.y0 + (p.yl - p.y0) * easeFall(s);
      x = A.petalX(p, tau);
      rot = p.rot0 + p.spin * tau;
      const fl = Math.cos(p.fw * tau + p.fp);
      sx = 0.2 + 0.8 * Math.abs(fl); sy = 1;
      light = fl;
      a = sm(0, 0.6, tau);
    } else {
      const r = tau - p.F;
      const settle = sm(0, 0.35, r);
      // a resting petal is nudged a little by the gust
      const nud = -(A.windInt(p.t0 + tau) - A.windInt(p.t0 + p.F) - 10 * r) * 0.05;
      x = p.xl + nud; y = p.yl;
      rot = p.rotL + nud * 0.02;
      sx = (0.2 + 0.8 * Math.abs(p.flipL)) * (1 - settle) + 0.95 * settle; sy = 1 - 0.42 * settle;
      light = p.flipL * (1 - settle) + 0.3 * settle;
      a = 1 - sm(p.rest, p.rest + p.fade, r);
    }
    return { x, y, rot, sx, sy, a, light, landed: tau >= p.F };
  };
  A.drawPetal = function (g, p, st) {
    const tone = clamp(p.tone + (st.light > 0.25 ? 1 : st.light < -0.4 ? -1 : 0), 1, 7);
    g.setTransform(st.sx * Math.cos(st.rot), st.sx * Math.sin(st.rot), -st.sy * Math.sin(st.rot), st.sy * Math.cos(st.rot), st.x, st.y);
    g.globalAlpha = st.a;
    const k = p.s / 40, ky = k * (p.w / 0.5);
    g.drawImage(A.petalSpr[tone][p.var], -p.s * 0.45 - 4 * k, -24 * ky, 48 * k, 48 * ky);
  };

  // ------------------------------------------------------------------ the lantern in the far courtyard
  A.buildLantern = function () {
    const S = CY.mk(90, 140), g = S.g, ox = 45, oy = 6;
    g.translate(ox, oy);
    CY.ink(g, [[0, -6], [0, 30]], { w: 1.6, a: 0.85, dry: 0.15, seed: 901, tin: 0.01, tout: 0.01 });
    const body = CY.circle(0, 72, 1, 60).map((p, i) => { const a = (i / 60) * TAU; return [Math.cos(a) * 30, 72 + Math.sin(a) * 34]; });
    CY.gouache(g, body, {
      col: '#c8382a', rough: 0.8, passes: 3, erode: 0.3, eb: 1.5, seed: 902, mott: 0.15, pad: 6,
      fx: (t) => {
        const rg = t.createRadialGradient(8, 64, 2, 0, 72, 36);
        rg.addColorStop(0, 'rgba(255,170,110,0.55)'); rg.addColorStop(0.6, 'rgba(200,60,40,0)'); rg.addColorStop(1, 'rgba(80,10,10,0.45)');
        t.fillStyle = rg; t.fillRect(-35, 35, 70, 75);
      },
    });
    for (let k = -3; k <= 3; k++) {
      const pts = []; for (let s = 0; s <= 16; s++) { const a = -Math.PI / 2 + (s / 16) * Math.PI; pts.push([Math.sin((k / 4) * Math.PI / 2) * 30 * Math.cos(a), 72 + Math.sin(a) * 34]); }
      CY.ink(g, pts, { w: 0.9, a: 0.5, dry: 0.4, seed: 903 + k, nb: 2, col: [90, 20, 16] });
    }
    CY.ink(g, body.concat([body[0]]), { w: 1.5, a: 0.8, dry: 0.4, seed: 910 });
    for (const [y, w] of [[34, 13], [110, 14]]) {
      CY.gouache(g, CY.rect(-w, y, w * 2, 8), { col: '#3b2a1f', rough: 0.5, passes: 1, erode: 0.2, seed: 911 + y, pad: 4 });
      g.fillStyle = rgba('#c49a52', 0.6); g.fillRect(-w + 1, y + 1, w * 2 - 2, 1.5);
    }
    // the lit version: the candle glowing through the paper
    const Lt = CY.mk(90, 140), l = Lt.g;
    l.translate(ox, oy);
    const rg = l.createRadialGradient(2, 70, 2, 0, 72, 34);
    rg.addColorStop(0, 'rgba(255,214,140,0.95)'); rg.addColorStop(0.45, 'rgba(255,140,80,0.55)'); rg.addColorStop(1, 'rgba(255,90,50,0)');
    l.fillStyle = rg; l.beginPath(); l.ellipse(0, 72, 29, 33, 0, 0, TAU); l.fill();
    // tassel
    const T = CY.mk(30, 60), q = T.g;
    q.translate(15, 2);
    q.fillStyle = rgba('#b6392b', 1); q.beginPath(); q.arc(0, 4, 3.4, 0, TAU); q.fill();
    const R = CY.rng(920);
    for (let i = 0; i < 14; i++) { const x = R.g() * 2.5; CY.ink(q, [[x * 0.5, 7], [x, 30], [x * 1.3 + R.g(), 50]], { w: 1.1, col: R.f() < 0.5 ? [180, 50, 38] : [140, 30, 24], a: 0.9, dry: 0.1, seed: 921 + i, nb: 1, tin: 0.01, tout: 0.2 }); }
    q.fillStyle = rgba('#d8a64e', 0.9); q.fillRect(-4, 8, 8, 2.5);
    A.lantern = { body: S.c, lit: Lt.c, tassel: T.c, ox, oy, sway: CY.loopFn(CY.G.D, 930, 2, 6, 0.7), flick: CY.loopFn(CY.G.D, 931, 9, 15, 0.5) };
  };
  A.lanternAngle = (t) => 0.05 * A.lantern.sway(t) + 0.035 * A.gust(t - 0.9);
  A.drawLantern = function (g, t) {
    const L = A.lantern, G = CY.G, th = A.lanternAngle(t), tht = A.lanternAngle(t - 0.45) * 1.15;
    const glow = 0.8 + 0.1 * Math.sin((TAU * 2 * t) / G.D + 1.1) + 0.05 * L.flick(t);
    const c = Math.cos(th), s = Math.sin(th);
    const bx = G.hook.x - s * 72, by = G.hook.y + c * 72;
    // light on the far wall
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = 'lighter';
    const rg = g.createRadialGradient(bx, by, 10, bx, by, 150);
    rg.addColorStop(0, `rgba(255,160,80,${(0.34 * glow).toFixed(3)})`); rg.addColorStop(0.4, `rgba(240,120,60,${(0.13 * glow).toFixed(3)})`); rg.addColorStop(1, 'rgba(200,80,40,0)');
    g.fillStyle = rg; g.fillRect(bx - 190, by - 190, 380, 380);
    g.globalCompositeOperation = 'source-over';
    // the cord from the eave
    g.strokeStyle = 'rgba(28,24,22,0.9)'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(G.hookFrom[0], G.hookFrom[1]); g.lineTo(G.hook.x, G.hook.y); g.stroke();
    // tassel, lagging behind the body
    const tx = G.hook.x - s * 118, ty = G.hook.y + c * 118;
    g.setTransform(Math.cos(tht), Math.sin(tht), -Math.sin(tht), Math.cos(tht), tx, ty);
    g.drawImage(L.tassel, -15, -2);
    g.setTransform(c, s, -s, c, G.hook.x, G.hook.y);
    g.drawImage(L.body, -L.ox, -L.oy);
    g.globalCompositeOperation = 'screen'; g.globalAlpha = Math.min(1, 1.05 * glow);
    g.drawImage(L.lit, -L.ox, -L.oy);
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  };

  // ------------------------------------------------------------------ wisps of cloud across the moon
  A.buildWisps = function () {
    const R = CY.rng(950);
    A.wisps = [];
    for (let k = 0; k < 3; k++) {
      const w = R.r(320, 480), h = 70, S = CY.mk(w + 40, h), g = S.g;
      for (let i = 0; i < 5; i++) {
        const y = h / 2 + R.g() * 7, x0 = 20 + R.r(0, w * 0.3), x1 = 20 + w - R.r(0, w * 0.3);
        CY.ink(g, CY.smooth([[x0, y], [(x0 + x1) / 2, y + R.g() * 5], [x1, y + R.g() * 4]], 2), { w: R.r(8, 20), col: R.pick([[120, 170, 176], [96, 150, 160], [200, 180, 150]]), a: R.r(0.25, 0.5), dry: 0.55, seed: 951 + k * 10 + i, tin: 0.3, tout: 0.4, wob: 3 });
      }
      const m = CY.G.moon;
      A.wisps.push({ c: S.c, x: m.x + [-60, 110, -170][k], y: m.y + [-40, 80, -130][k], ph: [2, 11, 19][k], v: [5, 4, 6][k] });
    }
  };
  A.drawWisps = function (g, t) {
    const D = CY.G.D;
    g.setTransform(1, 0, 0, 1, 0, 0);
    for (const w of A.wisps) {
      const u = mod(t - w.ph, D) / D;
      g.globalAlpha = Math.pow(Math.sin(Math.PI * u), 2) * 0.85;
      g.drawImage(w.c, w.x - w.c.width / 2 + (u - 0.5) * w.v * D, w.y - w.c.height / 2);
    }
    g.globalAlpha = 1;
  };

  // ------------------------------------------------------------------ a sparrow on the wall's ridge
  // timeline (s): 4.3-6.0 flies in from the right and lands; 6-19 on the ridge (turns, hops, pecks, flicks its
  // tail); 19.0-20.8 flies off up and out to the right. Off the picture otherwise.
  A.SP = { arrive: 4.3, land: 6.0, leave: 19.0, gone: 20.8, perch: [0, 0], hop: [10.6, 10.88, -30, 0], turns: [[8.4, 1], [15.2, -1], [18.55, 1]], pecks: [12.6, 13.25], flicks: [7.2, 11.6, 16.9, 18.3] };
  A.buildSparrow = function () {
    const PG = CY.G.perch;
    A.SP.perch = [PG.x, PG.y]; A.SP.hop[2] = PG.hop; A.SP.hop[3] = PG.hopY;
    const sc = 3, Z = 1.35;
    const mk = (w, h, ox, oy, fn) => { const S = CY.mk(w * sc, h * sc), g = S.g; g.scale(sc, sc); g.translate(ox, oy); fn(g); return S.c; };
    const brown = '#8d6647', dark = '#3f2a1d', buff = '#c9a77a', pale = '#ece2cc', crown = '#80807a', nape = '#8f4f2c', chest = '#b4ad9f';
    const R = CY.rng(960);
    // the body without the head: gouache mass, pale breast, streaked mantle in dry brush, a crisp contour in places
    const body = (g) => {
      const shape = CY.smooth([[-15, -11], [-6, -14.5], [8, -12.5], [16, -6.5], [18.5, -2.5], [10, 4.5], [-4, 6.5], [-14, 2.5], [-17.5, -4]], 2, true);
      CY.gouache(g, shape, { col: brown, rough: 0.35, passes: 2, erode: 0.18, eb: 0.8, seed: 961, pad: 4, mott: 0.14,
        fx: (t) => {
          t.fillStyle = rgba(chest, 0.95); t.beginPath(); t.ellipse(-8, 0.5, 9.5, 6.2, 0.25, 0, TAU); t.fill();
          t.fillStyle = rgba(pale, 0.55); t.beginPath(); t.ellipse(-4, 3.5, 8, 3, 0.1, 0, TAU); t.fill();
          t.fillStyle = rgba('#5e4636', 0.35); t.beginPath(); t.ellipse(6, 2.5, 8, 3.5, 0, 0, TAU); t.fill();
        } });
      // mantle streaks: alternating dark and buff dry-brush dashes
      for (let i = 0; i < 14; i++) {
        const x = R.r(-6, 12), y = R.r(-12.5, -6), L = R.r(3, 6);
        CY.ink(g, [[x, y], [x + L, y + L * 0.22]], { w: i % 3 ? 1.5 : 1.1, col: i % 3 ? [52, 34, 22] : [214, 180, 128], a: 0.85, dry: 0.3, seed: 970 + i, nb: 2, tin: 0.2, tout: 0.4 });
      }
      // breast and flank: soft grey-buff dabs
      for (let i = 0; i < 8; i++) { g.fillStyle = rgba(R.pick(['#a39b8c', '#c4bcab', '#9d8f7c']), 0.35); g.beginPath(); g.ellipse(R.r(-14, 4), R.r(-2, 4), R.r(2, 4), R.r(1, 2), R.g() * 0.4, 0, TAU); g.fill(); }
      CY.ink(g, [[-17.5, -4], [-13, 3], [-2, 6.5], [10, 4.5]], { w: 1.2, a: 0.55, dry: 0.45, seed: 965, nb: 3 });
      CY.ink(g, [[-6, -14.5], [8, -12.5], [16, -6.5]], { w: 1.1, a: 0.5, dry: 0.55, seed: 966, nb: 2 });
    };
    // folded wing: rows of covert feathers, dark centres with buff fringes, a white bar, dark primaries
    const wingFolded = (g) => {
      g.fillStyle = rgba(dark, 0.95); g.beginPath(); g.moveTo(-7, -10.5); g.quadraticCurveTo(8, -12.5, 21, -4); g.quadraticCurveTo(7, 0.5, -5, -3.5); g.fill();
      for (let row = 0; row < 2; row++) for (let j = 0; j < 5; j++) {
        const x = -4 + j * 3.4 + row * 1.6, y = -9.5 + row * 3;
        g.fillStyle = rgba(row ? '#6b4a33' : '#5a3d2a', 0.95); g.beginPath(); g.ellipse(x, y, 2.4, 1.7, 0.3, 0, TAU); g.fill();
        g.strokeStyle = rgba(buff, 0.85); g.lineWidth = 0.6; g.beginPath(); g.arc(x, y, 2.2, 0.1, 2.6); g.stroke();
      }
      g.strokeStyle = rgba(pale, 0.95); g.lineWidth = 1.3; g.lineCap = 'round'; g.beginPath(); g.moveTo(-3, -6.2); g.lineTo(9, -6.8); g.stroke();
      for (let j = 0; j < 4; j++) { g.strokeStyle = rgba(j % 2 ? '#2a1c14' : buff, 0.8); g.lineWidth = 0.8; g.beginPath(); g.moveTo(9 + j * 2, -5.5 + j * 0.4); g.lineTo(20 - j * 0.5, -4 + j * 0.3); g.stroke(); }
    };
    // the head, drawn about the neck pivot so it can turn on its own
    const head = (g, px, py) => {
      g.save(); g.translate(px, py);
      g.fillStyle = rgba(nape, 1); g.beginPath(); g.ellipse(-1.5, -3.5, 6.5, 5.5, 0.4, 0, TAU); g.fill();
      g.fillStyle = rgba(crown, 1); g.beginPath(); g.arc(-4, -4.5, 6.4, Math.PI * 0.95, Math.PI * 2.1); g.fill();
      g.fillStyle = rgba(pale, 1); g.beginPath(); g.ellipse(-5, -0.6, 4.6, 3.3, -0.1, 0, TAU); g.fill();
      g.fillStyle = rgba('#1f1915', 1); g.beginPath(); g.moveTo(-10, -1.5); g.quadraticCurveTo(-9, 5, -5.5, 7); g.quadraticCurveTo(-3, 3, -5, 0.5); g.fill();
      g.fillStyle = rgba('#2a201b', 0.9); g.beginPath(); g.moveTo(-10.5, -5.5); g.lineTo(-3, -4); g.lineTo(-3.5, -3); g.lineTo(-10, -3.6); g.fill();
      g.fillStyle = '#120e0c'; g.beginPath(); g.arc(-6.6, -4.6, 1.35, 0, TAU); g.fill();
      g.fillStyle = 'rgba(255,248,230,0.9)'; g.beginPath(); g.arc(-7, -5, 0.45, 0, TAU); g.fill();
      g.fillStyle = rgba('#34291f', 1); g.beginPath(); g.moveTo(-10, -4.4); g.quadraticCurveTo(-13, -3.4, -15.2, -2.6); g.lineTo(-10, -1.4); g.fill();
      g.strokeStyle = rgba('#8a7a62', 0.6); g.lineWidth = 0.5; g.beginPath(); g.moveTo(-10, -3); g.lineTo(-14.6, -2.6); g.stroke();
      CY.ink(g, CY.circle(-4, -4.5, 6.6, 18, -2.7, 0.2), { w: 1, a: 0.6, dry: 0.35, seed: 962, nb: 2 });
      g.restore();
    };
    A.sparrow = {
      sc, Z,
      perch: mk(70, 56, 35, 40, (g) => {
        CY.ink(g, [[-6, 5], [-7, 12], [-9.5, 12.5]], { w: 1.2, col: [92, 70, 52], a: 0.95, dry: 0, seed: 963, nb: 1, tin: 0.01, tout: 0.01 });
        CY.ink(g, [[0, 5], [1, 12], [-1.5, 12.5]], { w: 1.2, col: [92, 70, 52], a: 0.95, dry: 0, seed: 964, nb: 1, tin: 0.01, tout: 0.01 });
        body(g); wingFolded(g);
      }),
      head: mk(36, 32, 24, 20, (g) => head(g, 0, 0)),
      tail: mk(70, 56, 35, 40, (g) => {
        g.fillStyle = rgba(dark, 0.95); g.beginPath(); g.moveTo(0, 0); g.lineTo(17, -6.5); g.lineTo(18.5, -2); g.lineTo(0, 3); g.fill();
        g.strokeStyle = rgba(buff, 0.6); g.lineWidth = 0.6; g.beginPath(); g.moveTo(2, 0.6); g.lineTo(17.5, -4.5); g.stroke();
        CY.ink(g, [[0, 0], [17, -6.5]], { w: 0.9, a: 0.6, dry: 0.3, seed: 967, nb: 1 });
      }),
      fly: [-1, -0.5, 0, 0.5, 1].map((ph) => mk(70, 56, 35, 40, (g) => {
        body(g); head(g, -13, -10);
        const tipY = ph * 20 - 4, tipX = 6 + Math.abs(ph) * 3;
        g.fillStyle = rgba(dark, 0.95); g.beginPath(); g.moveTo(-6, -8); g.quadraticCurveTo(tipX - 6, tipY - 2, tipX + 8, tipY); g.quadraticCurveTo(tipX, tipY * 0.4, 10, -5); g.fill();
        for (let j = 0; j < 4; j++) { g.strokeStyle = rgba(buff, 0.55); g.lineWidth = 0.6; g.beginPath(); g.moveTo(-2 + j * 2, -7 + tipY * 0.2); g.lineTo(tipX - 2 + j * 2.5, tipY * (0.6 + j * 0.1) - 2); g.stroke(); }
        g.strokeStyle = rgba(pale, 0.85); g.lineWidth = 1.2; g.beginPath(); g.moveTo(-2, -7 + tipY * 0.25); g.lineTo(tipX - 2, tipY * 0.7 - 3); g.stroke();
        g.fillStyle = rgba(dark, 0.95); g.beginPath(); g.moveTo(14, -6); g.lineTo(28, -8); g.lineTo(27, -3); g.lineTo(14, -2); g.fill();
      })),
    };
  };
  function bez(p0, p1, p2, p3, u) { const v = 1 - u; return [v * v * v * p0[0] + 3 * v * v * u * p1[0] + 3 * v * u * u * p2[0] + u * u * u * p3[0], v * v * v * p0[1] + 3 * v * v * u * p1[1] + 3 * v * u * u * p2[1] + u * u * u * p3[1]]; }
  // the bird's pose at t: null if away
  A.sparrowState = function (t) {
    const S = A.SP;
    if (t < S.arrive || t >= S.gone) return null;
    let [x, y] = S.perch, rot = 0, face = -1, sprite = 'perch', tail = 0, lift = 0;
    // hop
    const hp = S.hop;
    if (t >= hp[1]) { x += hp[2]; y += hp[3]; }
    else if (t > hp[0]) { const u = (t - hp[0]) / (hp[1] - hp[0]); x += hp[2] * sm(0, 1, u); y += hp[3] * sm(0, 1, u); lift = Math.sin(Math.PI * u) * 9; }
    // turning: face 1 is beak to the left; it arrives facing right (-1); a turn squeezes through edge-on over 0.16 s
    for (const [tt, dir] of S.turns) { if (t >= tt) face = dir; }
    for (const [tt, dir] of S.turns) { const d = t - tt; if (d > -0.08 && d < 0.08) { const prev = -dir; face = prev * Math.cos(((d + 0.08) / 0.16) * Math.PI) || 0.02; } }
    // pecking: tip forward about the feet
    for (const pt of S.pecks) { const d = t - pt; if (d > 0 && d < 0.45) rot = -0.5 * Math.sin((Math.PI * d) / 0.45); }
    for (const ft of S.flicks) { const d = t - ft; if (d > 0 && d < 0.5) tail = -0.5 * Math.sin((Math.PI * d) / 0.5) * Math.exp(-d * 3); }
    // flight in and out
    const flap = (tt) => Math.max(0, Math.min(4, Math.round((Math.sin(tt * TAU * 9) + 1) * 2)));
    if (t < S.land) {
      const u = (t - S.arrive) / (S.land - S.arrive);
      const e = 1 - Math.pow(1 - u, 2.2);
      const [px, py] = S.perch;
      [x, y] = bez([-120, py - 300], [-20, py - 330], [px - 140, py - 110], S.perch, e);
      face = -1;
      sprite = u > 0.86 ? 'perch' : 'fly' + flap(t);
      if (u > 0.72 && u <= 0.86) sprite = 'fly2';
      rot = u <= 0.86 ? -0.15 * (1 - u) : 0;
      lift = 0;
    } else if (t >= S.leave) {
      const u = (t - S.leave) / (S.gone - S.leave);
      const e = Math.pow(u, 1.7);
      const from = [S.perch[0] + hp[2], S.perch[1] + hp[3]];
      [x, y] = bez(from, [from[0] - 10, from[1] - 60], [-30, from[1] - 330], [-170, from[1] - 380], e);
      face = 1;
      sprite = u < 0.08 ? 'perch' : 'fly' + flap(t);
      rot = u < 0.08 ? 0 : 0.2;
      lift = u < 0.08 ? -2 * (1 - sm(0, 1, u / 0.08)) : 0; // springing up out of the crouch
    }
    // it crouches a little before it springs
    if (sprite === 'perch' && t < S.leave && t > S.leave - 0.3) lift = -2 * sm(S.leave - 0.3, S.leave, t);
    // the head moves in quick little saccades while perched: look about, look up, back
    let head = 0;
    if (sprite === 'perch') {
      const looks = [[6.5, 0], [7.6, -0.22], [9.4, 0.16], [10.3, 0], [11.9, -0.38], [12.45, 0], [14.1, 0.2], [16.0, -0.12], [17.7, 0.28], [18.7, 0]];
      let prev = 0;
      for (const [lt, v] of looks) { const d = t - lt; if (d >= 0.09) prev = v; else if (d > 0) { prev = prev + (v - prev) * sm(0, 0.09, d); break; } else break; }
      head = prev;
    }
    const breathe = sprite === 'perch' ? 0.018 * Math.sin(t * TAU * 2.3) : 0;
    return { x, y: y - lift, rot, face, sprite, tail, head, breathe };
  };
  A.drawSparrow = function (g, t) {
    const st = A.sparrowState(t);
    if (!st) return;
    const S = A.sparrow, Z = S.Z;
    const c = Math.cos(st.rot), s = Math.sin(st.rot);
    // feet at the origin; a unit point (ux, uy) of the sprites lands at (ux * Z, (uy - 12) * Z)
    g.setTransform(c * st.face, s * st.face, -s, c, st.x, st.y);
    if (st.sprite === 'perch') {
      g.save(); g.translate(14 * Z, -16 * Z); g.rotate(st.tail); g.drawImage(S.tail, -35 * Z, -40 * Z, 70 * Z, 56 * Z); g.restore();
      g.save(); g.scale(1, 1 + st.breathe);
      g.drawImage(S.perch, -35 * Z, -52 * Z, 70 * Z, 56 * Z);
      g.translate(-13 * Z, -22 * Z); g.rotate(st.head);
      g.drawImage(S.head, -24 * Z, -20 * Z, 36 * Z, 32 * Z);
      g.restore();
    } else {
      g.drawImage(S.fly[+st.sprite.slice(3)], -35 * Z, -52 * Z, 70 * Z, 56 * Z);
    }
  };

  // ------------------------------------------------------------------ the frame
  let shadowL = null;
  A.render = function (g, L, t) {
    const G = CY.G, D = G.D;
    t = mod(t, D);
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    g.drawImage(L.sky.c, 0, 0);
    A.drawWisps(g, t);
    g.drawImage(L.far.c, 0, 0);
    g.drawImage(L.front.c, 0, 0);
    const T = A.transforms(t);
    const sun = A.sun(t);
    // cast shadows of the flowers on the plaster: flat, cool, gouache-like
    if (!shadowL) shadowL = CY.mk(W, H);
    const s = shadowL.g;
    s.setTransform(1, 0, 0, 1, 0, 0); s.globalCompositeOperation = 'source-over'; s.clearRect(0, 0, shadowL.w, shadowL.h);
    const sk = 1 + 0.16 * A.sunPhase(t), so = [G.shadowOff[0] * sk, G.shadowOff[1] * sk];
    for (const c of A.clusters) {
      const m = T.get(c);
      s.setTransform(m[0], m[1], -m[1], m[0], m[2] + so[0] * (c.kind === 'hang' ? 0.8 : 1), m[3] + so[1] * (c.kind === 'hang' ? 0.8 : 1));
      s.drawImage(c.sh, -c.ox, -c.oy);
    }
    s.setTransform(1, 0, 0, 1, 0, 0);
    // the eaves' shadows, their depth moving with the light, toothed by the rafter ends
    s.fillStyle = '#000';
    for (const e of G.eaveShadow) {
      const dd = e.base + 0.16 * A.sunPhase(t), top = [], bot = [];
      for (let u = e.u0; u <= e.u1 + 0.001; u += 0.08) { top.push(e.F.at(u, e.v + 0.3)); bot.push(e.F.at(u, e.v - dd - 0.06 * Math.abs(Math.sin((u * Math.PI) / 0.32)))); }
      s.beginPath(); top.concat(bot.reverse()).forEach((q, i) => (i ? s.lineTo(q[0], q[1]) : s.moveTo(q[0], q[1]))); s.closePath(); s.fill();
    }
    s.globalCompositeOperation = 'source-in'; s.fillStyle = '#1d3a52'; s.fillRect(0, 0, shadowL.w, shadowL.h);
    s.globalCompositeOperation = 'destination-in'; s.drawImage(L.wallMask.c, 0, 0);
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = 'multiply'; g.globalAlpha = 0.55 * sun;
    g.drawImage(shadowL.c, 0, 0);
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    A.drawLantern(g, t);
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.drawImage(L.dissolve.c, 0, 0);
    // petals resting on the stone
    const states = A.petals.map((p) => A.petalState(p, t));
    for (let i = 0; i < A.petals.length; i++) { const st = states[i]; if (st && st.landed) A.drawPetal(g, A.petals[i], st); }
    g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1;
    A.drawSparrow(g, t);
    g.setTransform(1, 0, 0, 1, 0, 0);
    // the flowers
    for (const c of A.clusters) {
      const m = T.get(c);
      g.setTransform(m[0], m[1], -m[1], m[0], m[2], m[3]);
      g.drawImage(c.c, -c.ox, -c.oy);
    }
    // petals in the air
    for (let i = 0; i < A.petals.length; i++) { const st = states[i]; if (st && !st.landed) A.drawPetal(g, A.petals[i], st); }
    g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1;
    // the warm light of the moon
    g.globalCompositeOperation = 'soft-light'; g.globalAlpha = 0.6 * sun;
    g.drawImage(L.light.c, 0, 0);
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    const b = L.over.box;
    g.drawImage(L.over.c, b[0], b[1], b[2], b[3], b[0], b[1], b[2], b[3]);
    g.globalCompositeOperation = 'multiply';
    g.drawImage(L.paper.c, 0, 0);
    g.globalCompositeOperation = 'source-over';
  };

  // a cheap probe for the pop check: how much of each moving thing is visible at t (alpha x area, px)
  A.probe = function (t) {
    const out = {};
    A.petals.forEach((p, i) => { const st = A.petalState(p, mod(t, CY.G.D)); const on = st ? clamp((st.x + 30) / 60, 0, 1) * clamp((W + 30 - st.x) / 60, 0, 1) * clamp((H + 30 - st.y) / 60, 0, 1) : 0; /* soft frame edge: leaving the picture is motion, not a pop */ out['petal' + i] = st ? st.a * st.sx * st.sy * p.s * p.s * p.w * on : 0; });
    const sp = A.sparrowState(mod(t, CY.G.D));
    out.sparrow = sp && sp.x > -30 ? 1500 * Math.min(1, (sp.x + 30) / 240) : 0; // it flies in across the left edge: entering is motion, not a pop
    A.wisps.forEach((w, k) => { const u = mod(t - w.ph, CY.G.D) / CY.G.D; out['wisp' + k] = Math.pow(Math.sin(Math.PI * u), 2) * 0.85 * 4000; });
    return out;
  };
})();
