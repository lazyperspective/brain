// "The Moon Gate" - everything that moves. Every function of time here is periodic in G.D, so frame D == frame 0.
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

  // ------------------------------------------------------------------ the bougainvillea
  function nearest(sk, x, y) {
    let best = null, bd = 1e9;
    for (const k in sk) for (const p of CY.resample(sk[k], 4)) { const d = (p.x - x) ** 2 + (p.y - y) ** 2; if (d < bd) { bd = d; best = [p.x, p.y]; } }
    return best;
  }
  A.buildClusters = function () {
    const G = CY.G, R = CY.rng(500), sk = G.skel, list = [];
    const regions = [
      { x: 205, y: 618, rx: 215, ry: 150, n: 15, r: [52, 74] },
      { x: 405, y: 500, rx: 120, ry: 92, n: 6, r: [44, 62] },
      { x: 72, y: 775, rx: 95, ry: 115, n: 5, r: [40, 58] },
      { x: 520, y: 724, rx: 185, ry: 48, n: 7, r: [38, 54] },
      { x: 806, y: 752, rx: 90, ry: 34, n: 3, r: [32, 44] },
    ];
    const placed = [];
    for (const rg of regions) {
      let tries = 0, made = 0;
      while (made < rg.n && tries++ < 4000) {
        const a = R.f() * TAU, rr = Math.sqrt(R.f());
        const x = rg.x + Math.cos(a) * rg.rx * rr, y = rg.y + Math.sin(a) * rg.ry * rr, r = R.r(rg.r[0], rg.r[1]);
        if (placed.some((p) => Math.hypot(p[0] - x, p[1] - y) < (p[2] + r) * 0.62)) continue;
        placed.push([x, y, r]); made++;
        let q = nearest(sk, x, y);
        let d = Math.hypot(x - q[0], y - q[1]);
        if (d > 130) { q = [x - ((x - q[0]) / d) * 130, y - ((y - q[1]) / d) * 130]; d = 130; }
        list.push({ x: q[0], y: q[1], ang: Math.atan2(y - q[1], x - q[0]) + (d < 8 ? R.g() : 0), len: Math.max(8, d), r, depth: R.r(0.12, 0.9), seed: R.i(1, 1e6), kind: 'mass', elong: R.r(0.9, 1.25) });
      }
    }
    // sprays reaching into the evening sky
    for (const [x, y, ang, r] of [[560, 384, -0.55, 50], [506, 412, -1.05, 46], [446, 452, -1.45, 40], [28, 512, -2.2, 46], [150, 604, -1.9, 44], [340, 556, -1.25, 42]]) {
      const q = nearest(sk, x, y);
      list.push({ x: q[0], y: q[1], ang, len: R.r(26, 44), r, depth: R.r(0.45, 0.8), seed: R.i(1, 1e6), kind: 'spray', dens: 0.55, leaves: 0.16, fs: 0.92 });
    }
    // strands hanging over the plaster and across the top of the gate
    for (const [x, nseg] of [[466, 2], [552, 2], [640, 3], [724, 3], [806, 2], [880, 2]]) {
      const q = nearest({ c: sk.cope }, x, 760);
      let parent = null;
      for (let k = 0; k < nseg; k++) {
        const c = { x: q[0], y: q[1], ang: Math.PI / 2 + R.g() * 0.18 + (k ? 0 : R.g() * 0.1), len: R.r(34, 56), r: R.r(27, 38) * (k === nseg - 1 ? 0.85 : 1), depth: R.r(0.72, 0.98), seed: R.i(1, 1e6), kind: 'hang', elong: 1.45, dens: 1.1, parent, level: k };
        if (parent) parent.child = c;
        list.push(c); parent = c;
      }
    }
    // cascades over the coping on the left, where the vine first tops the wall
    for (const [x, y, nseg] of [[96, 610, 3], [168, 640, 3], [30, 560, 2], [300, 744, 2], [380, 742, 3]]) {
      const q = nearest(sk, x, y);
      let parent = null;
      for (let k = 0; k < nseg; k++) {
        const c = { x: q[0], y: q[1], ang: Math.PI / 2 + R.g() * 0.2, len: k ? R.r(34, 52) : R.r(60, 110), r: R.r(30, 42) * (k === nseg - 1 ? 0.85 : 1), depth: R.r(0.55, 0.95), seed: R.i(1, 1e6), kind: 'hang', elong: 1.4, dens: 1.1, parent, level: k };
        if (parent) parent.child = c;
        list.push(c); parent = c;
      }
    }
    // low sprigs along the trunk
    for (const [px, py, ang, r] of [[40, 1062, 1.9, 38], [282, 948, 0.2, 34], [74, 1074, 2.6, 30]]) {
      list.push({ x: px, y: py, ang, len: 16, r, depth: R.r(0.3, 0.6), seed: R.i(1, 1e6), kind: 'hang', elong: 1.2, dens: 0.9 });
    }
    for (const c of list) {
      CY.makeCluster(c);
      // sway: smaller, stiffer masses move less; hanging strands more, each level lagging its parent
      c.A = c.kind === 'hang' ? 0.05 : c.kind === 'spray' ? 0.085 : 0.06 * Math.sqrt(60 / (c.r + c.len * 0.25));
      c.own = CY.loopFn(G.D, c.seed, 2, 9, 0.8);
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
        rest: R.r(5, 12), fade: R.r(2.2, 3.2), pushK: R.r(0.7, 1.3),
      };
      // where it lands: snap to a step tread, the sill, or the paving; never on the pot
      let yl = 1800, F = 6;
      for (let it = 0; it < 3; it++) {
        F = (yl - y0) / p.v;
        const xl = A.petalX(p, F);
        const r = R.f(), s1 = G.steps[0], s2 = G.steps[1], si = G.sill;
        if (it < 2) {
          if (xl > s2.x0 + 8 && xl < s2.x1 - 8 && r < 0.22) yl = R.r(s2.top + 4, s2.face - 3);
          else if (xl > s1.x0 + 8 && xl < s1.x1 - 8 && r < 0.42) yl = R.r(s1.top + 4, s1.face - 3);
          else if (xl > si.x0 + 8 && xl < si.x1 - 8 && r < 0.5) yl = R.r(si.top + 3, si.face - 3);
          else if (xl < s2.x0 || xl > s2.x1) yl = R.r(1592, 1880);
          else yl = R.r(1722, 1880);
          if (xl > 10 && xl < 290 && yl < 1752) yl = R.r(1756, 1880);
        }
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
    g.fillStyle = rgba(CY.TONES[tone], 0.95);
    g.beginPath(); CY.bractPath(g, -p.s * 0.45, 0, 0, p.s, p.w); g.fill();
    g.strokeStyle = rgba(CY.TONES[Math.max(0, tone - 3)], 0.4); g.lineWidth = 0.7;
    g.beginPath(); g.moveTo(-p.s * 0.45, 0); g.lineTo(p.s * 0.35, 0); g.stroke();
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
        CY.ink(g, CY.smooth([[x0, y], [(x0 + x1) / 2, y + R.g() * 5], [x1, y + R.g() * 4]], 2), { w: R.r(8, 20), col: R.pick([[214, 204, 212], [196, 190, 204], [232, 214, 196]]), a: R.r(0.25, 0.5), dry: 0.55, seed: 951 + k * 10 + i, tin: 0.3, tout: 0.4, wob: 3 });
      }
      A.wisps.push({ c: S.c, x: [520, 640, 880][k], y: [330, 448, 300][k], ph: [2, 11, 19][k], v: [5, 4, 6][k] });
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
  A.SP = { arrive: 4.3, land: 6.0, leave: 19.0, gone: 20.8, perch: [906, 640], hop: [10.6, 10.88, -30], turns: [[8.4, -1], [15.2, 1], [18.55, -1]], pecks: [12.6, 13.25], flicks: [7.2, 11.6, 16.9, 18.3] };
  A.buildSparrow = function () {
    const sc = 2;
    const mk = (fn) => { const S = CY.mk(70 * sc, 56 * sc), g = S.g; g.scale(sc, sc); g.translate(35, 40); fn(g); return S.c; };
    const brown = '#8a6546', dark = '#4f3524', pale = '#e2d5bb', cap = '#6e5a4c', chest = '#b9a68a';
    const body = (g, R) => {
      CY.gouache(g, CY.smooth([[-16, -10], [-6, -14], [8, -12], [16, -6], [18, -2], [10, 4], [-4, 6], [-14, 2], [-18, -4]], 2, true), { col: brown, rough: 0.4, passes: 2, erode: 0.2, eb: 1, seed: 961, pad: 4, mott: 0.1,
        fx: (t) => { t.fillStyle = rgba(chest, 0.9); t.beginPath(); t.ellipse(-9, 0, 9, 6, 0.2, 0, TAU); t.fill(); for (let i = 0; i < 9; i++) { t.strokeStyle = rgba(dark, 0.7); t.lineWidth = 1.2; t.beginPath(); const x = R.r(-4, 14), y = R.r(-12, -3); t.moveTo(x, y); t.lineTo(x + 4, y + 1); t.stroke(); } } });
    };
    const head = (g) => {
      g.fillStyle = rgba(cap, 1); g.beginPath(); g.arc(-17, -14, 7, 0, TAU); g.fill();
      g.fillStyle = rgba(pale, 1); g.beginPath(); g.ellipse(-18, -11, 4.5, 3.4, 0, 0, TAU); g.fill();
      g.fillStyle = rgba('#2a201b', 1); g.beginPath(); g.ellipse(-20, -7.5, 2.5, 3, 0, 0, TAU); g.fill();
      g.fillStyle = '#1b1512'; g.beginPath(); g.arc(-19.5, -15, 1.3, 0, TAU); g.fill();
      g.fillStyle = rgba('#3a3026', 1); g.beginPath(); g.moveTo(-23, -14); g.lineTo(-28, -12.5); g.lineTo(-23, -11); g.fill();
      CY.ink(g, CY.circle(-17, -14, 7, 18, -2.6, 0.6), { w: 1, a: 0.6, dry: 0.3, seed: 962, nb: 2 });
    };
    const wingFolded = (g) => {
      g.fillStyle = rgba(dark, 0.95); g.beginPath(); g.moveTo(-6, -11); g.quadraticCurveTo(8, -12, 20, -4); g.quadraticCurveTo(6, 0, -4, -4); g.fill();
      g.strokeStyle = rgba(pale, 0.9); g.lineWidth = 1.4; g.beginPath(); g.moveTo(-2, -7); g.lineTo(7, -7.5); g.stroke();
    };
    const R = CY.rng(960);
    A.sparrow = {
      sc,
      perch: mk((g) => {
        CY.ink(g, [[-6, 5], [-7, 12]], { w: 1.2, a: 0.9, dry: 0, seed: 963, nb: 1, tin: 0.01, tout: 0.01 });
        CY.ink(g, [[0, 5], [1, 12]], { w: 1.2, a: 0.9, dry: 0, seed: 964, nb: 1, tin: 0.01, tout: 0.01 });
        body(g, R); wingFolded(g); head(g);
        CY.ink(g, [[-18, -4], [-12, 4], [0, 6], [12, 2]], { w: 1.3, a: 0.65, dry: 0.4, seed: 965 });
      }),
      tail: mk((g) => { g.fillStyle = rgba(dark, 0.95); g.beginPath(); g.moveTo(0, 0); g.lineTo(17, -6); g.lineTo(18, -2); g.lineTo(0, 3); g.fill(); CY.ink(g, [[0, 0], [17, -6]], { w: 0.9, a: 0.6, dry: 0.3, seed: 966, nb: 1 }); }),
      fly: [-1, 0, 1].map((ph, k) => mk((g) => {
        body(g, R); head(g);
        const tipY = ph * 20 - 4, tipX = 6 + Math.abs(ph) * 3;
        g.fillStyle = rgba(dark, 0.95); g.beginPath(); g.moveTo(-6, -8); g.quadraticCurveTo(tipX - 6, tipY - 2, tipX + 8, tipY); g.quadraticCurveTo(tipX, tipY * 0.4, 10, -5); g.fill();
        g.strokeStyle = rgba(pale, 0.8); g.lineWidth = 1.2; g.beginPath(); g.moveTo(-2, -7 + tipY * 0.25); g.lineTo(tipX - 2, tipY * 0.7 - 3); g.stroke();
        g.fillStyle = rgba(dark, 0.95); g.beginPath(); g.moveTo(14, -6); g.lineTo(28, -8); g.lineTo(27, -3); g.lineTo(14, -2); g.fill();
      })),
    };
  };
  function bez(p0, p1, p2, p3, u) { const v = 1 - u; return [v * v * v * p0[0] + 3 * v * v * u * p1[0] + 3 * v * u * u * p2[0] + u * u * u * p3[0], v * v * v * p0[1] + 3 * v * v * u * p1[1] + 3 * v * u * u * p2[1] + u * u * u * p3[1]]; }
  // the bird's pose at t: null if away
  A.sparrowState = function (t) {
    const S = A.SP;
    if (t < S.arrive || t >= S.gone) return null;
    let [x, y] = S.perch, rot = 0, face = 1, sprite = 'perch', tail = 0, lift = 0;
    // hop
    const hp = S.hop;
    if (t >= hp[1]) x += hp[2];
    else if (t > hp[0]) { const u = (t - hp[0]) / (hp[1] - hp[0]); x += hp[2] * sm(0, 1, u); lift = Math.sin(Math.PI * u) * 9; }
    // turning: the bird faces left (face 1); a turn squeezes through edge-on over 0.16 s
    for (const [tt, dir] of S.turns) { if (t >= tt) face = dir; }
    for (const [tt, dir] of S.turns) { const d = t - tt; if (d > -0.08 && d < 0.08) { const prev = -dir; face = prev * Math.cos(((d + 0.08) / 0.16) * Math.PI) || 0.02; } }
    // pecking: tip forward about the feet
    for (const pt of S.pecks) { const d = t - pt; if (d > 0 && d < 0.45) rot = -0.5 * Math.sin((Math.PI * d) / 0.45); }
    for (const ft of S.flicks) { const d = t - ft; if (d > 0 && d < 0.5) tail = -0.5 * Math.sin((Math.PI * d) / 0.5) * Math.exp(-d * 3); }
    // flight in and out
    const flap = (tt) => { const ph = Math.sin(tt * TAU * 9); return ph > 0.35 ? 2 : ph < -0.35 ? 0 : 1; };
    if (t < S.land) {
      const u = (t - S.arrive) / (S.land - S.arrive);
      const e = 1 - Math.pow(1 - u, 2.2);
      [x, y] = bez([1150, 470], [1060, 420], [960, 560], S.perch, e);
      sprite = u > 0.86 ? 'perch' : 'fly' + flap(t);
      if (u > 0.72 && u <= 0.86) sprite = 'fly1';
      rot = u <= 0.86 ? -0.15 * (1 - u) : 0;
      lift = 0;
    } else if (t >= S.leave) {
      const u = (t - S.leave) / (S.gone - S.leave);
      const e = Math.pow(u, 1.7);
      const from = [S.perch[0] + hp[2], S.perch[1]];
      [x, y] = bez(from, [from[0] + 10, from[1] - 60], [1040, 380], [1170, 330], e);
      face = -1;
      sprite = u < 0.08 ? 'perch' : 'fly' + flap(t);
      rot = u < 0.08 ? 0 : 0.2;
      lift = u < 0.08 ? -2 * Math.sin((Math.PI * u) / 0.08) : 0;
    }
    return { x, y: y - lift, rot, face, sprite, tail };
  };
  A.drawSparrow = function (g, t) {
    const st = A.sparrowState(t);
    if (!st) return;
    const S = A.sparrow, k = 1 / S.sc;
    const c = Math.cos(st.rot), s = Math.sin(st.rot);
    // feet at the origin of the sprite: local (0, 12) relative to the sprite centre (35, 40)
    g.setTransform(c * st.face, s * st.face, -s, c, st.x, st.y);
    const img = st.sprite === 'perch' ? S.perch : S.fly[+st.sprite.slice(3)];
    if (st.sprite === 'perch') {
      g.save(); g.translate(14, -16); g.rotate(st.tail); g.drawImage(S.tail, -35, -40, 70, 56); g.restore();
    }
    g.drawImage(img, -35, -52, 70, 56);
    void k;
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
    A.drawLantern(g, t);
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.drawImage(L.front.c, 0, 0);
    const T = A.transforms(t);
    const sun = A.sun(t);
    // cast shadows of the flowers on the plaster: flat, cool, gouache-like
    if (!shadowL) shadowL = CY.mk(W, H);
    const s = shadowL.g;
    s.setTransform(1, 0, 0, 1, 0, 0); s.globalCompositeOperation = 'source-over'; s.clearRect(0, 0, shadowL.w, shadowL.h);
    const so = G.shadowOff;
    for (const c of A.clusters) {
      const m = T.get(c);
      s.setTransform(m[0], m[1], -m[1], m[0], m[2] + so[0] * (c.kind === 'hang' ? 0.8 : 1), m[3] + so[1] * (c.kind === 'hang' ? 0.8 : 1));
      s.drawImage(c.sh, -c.ox, -c.oy);
    }
    s.setTransform(1, 0, 0, 1, 0, 0);
    s.globalCompositeOperation = 'source-in'; s.fillStyle = '#5e5a6e'; s.fillRect(0, 0, shadowL.w, shadowL.h);
    s.globalCompositeOperation = 'destination-in'; s.drawImage(L.wallMask.c, 0, 0);
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = 'multiply'; g.globalAlpha = 0.42 * sun;
    g.drawImage(shadowL.c, 0, 0);
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
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
    // warm late sun
    g.globalCompositeOperation = 'soft-light'; g.globalAlpha = 0.85 * sun;
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
    out.sparrow = sp && sp.x < W + 30 ? 1500 * Math.min(1, (W + 30 - sp.x) / 60) : 0;
    A.wisps.forEach((w, k) => { const u = mod(t - w.ph, CY.G.D) / CY.G.D; out['wisp' + k] = Math.pow(Math.sin(Math.PI * u), 2) * 0.85 * 4000; });
    return out;
  };
})();
