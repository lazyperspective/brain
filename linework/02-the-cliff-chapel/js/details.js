// details.js - swallows, scrub along the summit, caper tufts and ferns in the
// cliff's crevices, moss on the far stairs.
(function () {
  'use strict';
  const LW = window.LW, C = LW.C;

  // a swallow seen from below: forked tail, scythe wings. ang = heading, s = span (px)
  function swallow(x, y, s, ang, flap, rnd) {
    const ca = Math.cos(ang), sa = Math.sin(ang);
    const T = (u, v) => [x + u * ca - v * sa, y + u * sa + v * ca];
    const body = [];
    // body + head (u forward), wings (v sideways) with scythe curve
    const w = s / 2;
    const pts = [
      [0.42, 0], [0.34, 0.05], [0.12, 0.07],
      [0.0 + flap * 0.1, 0.55], [-0.18 + flap * 0.12, 0.98], [-0.12 + flap * 0.08, 0.6], [-0.1, 0.12],
      [-0.32, 0.07], [-0.62, 0.2], [-0.42, 0.02], [-0.42, -0.02], [-0.62, -0.2], [-0.32, -0.07],
      [-0.1, -0.12], [-0.12 + flap * 0.08, -0.6], [-0.18 + flap * 0.12, -0.98], [0.0 + flap * 0.1, -0.55],
      [0.12, -0.07], [0.34, -0.05],
    ];
    for (const [u, v] of pts) body.push(T(u * w, v * w));
    const sm = LW.spline(body, 2, true);
    const path = LW.polyPath(sm);
    LW.occlude(path);
    LW.flat(path, '#2b2a33');
    const pen = new LW.Pen();
    // tail streamers
    for (const sg of [-1, 1]) pen.line([T(-0.6 * w, sg * 0.19 * w), T(-0.75 * w, sg * 0.25 * w), T(-0.9 * w, sg * 0.3 * w)], 1.1, 0.5, 0.1);
    LW.outline(pen, sm, 1.4, 0.6);
    // flight feathers: paler separations along each wing
    const fpen = new LW.Pen();
    for (const sg of [-1, 1]) {
      for (let k = 0; k < 5; k++) {
        const t = 0.25 + k * 0.15;
        const a = T((-0.02 + flap * 0.1 * t) * w, sg * (0.12 + t * 0.5) * w);
        const b = T((-0.14 + flap * 0.1 * t - 0.12 * t) * w, sg * (0.18 + t * 0.62) * w);
        fpen.line([a, b], 0.7 + 0.004 * s, 0.4);
      }
    }
    fpen.draw(LW.fill, '#57566a');
    // buff belly with a few ink ticks
    const bl = T(0.02 * w, 0);
    const be = new Path2D(); be.ellipse(bl[0], bl[1], w * 0.13, w * 0.05, ang, 0, LW.TAU);
    LW.flat(be, '#d6c49c');
    for (let k = -2; k <= 1; k++) { const q0 = T((-0.03 + k * 0.03) * w, -0.035 * w), q1 = T((-0.03 + k * 0.03) * w, 0.035 * w); pen.line([q0, q1], 0.5, 0.4); }
    // pale throat
    const th = T(0.25 * w, 0);
    const e = new Path2D(); e.ellipse(th[0], th[1], w * 0.08, w * 0.05, ang, 0, LW.TAU);
    LW.flat(e, '#c98a5a');
    pen.draw(LW.ink, C.ink);
    void rnd;
  }

  // small scrub bush (lentisk / juniper) as a cluster of tiny scalloped clumps
  function bush(x, y, r, rnd) {
    const n = rnd.int(3, 6);
    for (let k = 0; k < n; k++) {
      const cx = x + rnd.gauss() * r * 0.6, cy = y - Math.abs(rnd.gauss()) * r * 0.5;
      LW.clump(cx, cy, r * rnd.range(0.45, 0.8), rnd, { under: 0.2, leafScale: 0.6, density: 1.4 });
    }
  }

  // caper plant hanging from a crevice: arching stems with round leaves
  LW.caper = function (x, y, size, rnd) {
    const pen = new LW.Pen();
    const n = rnd.int(4, 7);
    const leaves = [];
    for (let k = 0; k < n; k++) {
      const a0 = -Math.PI / 2 + rnd.gauss() * 1.1;
      let px = x, py = y, a = a0;
      const st = [[px, py]];
      const L = size * rnd.range(0.6, 1.1);
      for (let m = 0; m < 10; m++) {
        a += (Math.PI / 2 - a) * 0.16; // droop
        px += Math.cos(a) * L / 10; py += Math.sin(a) * L / 10;
        st.push([px, py]);
        if (m > 1 && m % 2 === 0) leaves.push([px + rnd.gauss() * 3, py + rnd.gauss() * 2, size * rnd.range(0.09, 0.14)]);
      }
      pen.line(st, 1.3, 0.2);
    }
    for (const [lx, ly, r] of leaves) {
      const pts = [];
      for (let t = 0; t < LW.TAU; t += 0.6) pts.push([lx + Math.cos(t) * r, ly + Math.sin(t) * r * 0.8]);
      const lp = LW.polyPath(pts);
      LW.occlude(lp);
      LW.flat(lp, rnd() < 0.5 ? LW.C.teal : LW.C.tealLight);
      LW.outline(pen, pts, 1.1, 1.2);
    }
    if (rnd() < 0.5) { // a white caper flower
      const [fx, fy] = leaves[Math.floor(rnd() * leaves.length)] || [x, y];
      const fl = new Path2D(); fl.ellipse(fx, fy, size * 0.12, size * 0.1, 0, 0, LW.TAU);
      LW.flat(fl, '#f3ecd6');
      for (let k = 0; k < 5; k++) { const a = rnd() * LW.TAU; pen.line([[fx, fy], [fx + Math.cos(a) * size * 0.16, fy + Math.sin(a) * size * 0.16]], 0.8, 0.3); }
    }
    pen.draw(LW.ink, C.ink);
  };

  // edge darkening by hatching, so the eye goes to the lit chapel and bell
  LW.drawVignette = async function () {
    const pen = new LW.Pen();
    const W = LW.W, H = LW.H;
    const dark = (x, y) => Math.max(0.95 * LW.smooth(3420, 3840, y), 0.7 * LW.smooth(170, 0, x) * LW.smooth(900, 1600, y), 0.75 * LW.smooth(1990, 2160, x) * LW.smooth(1300, 1800, y)) + 0.05 * LW.noise(x * 0.01, y * 0.01);
    LW.hatchDither(pen, { x0: -10, y0: 900, x1: W + 10, y1: H + 10 }, -0.75, {
      spacing: 3.6, step: 4, wob: 1.0, seed: 401, inside: (x, y) => dark(x, y) > 0.03, dark, w: (x, y, d) => 0.6 + 1.2 * d, taper: 0.3,
    });
    LW.hatchDither(pen, { x0: -10, y0: 3300, x1: W + 10, y1: H + 10 }, 0.35, {
      spacing: 4.4, step: 4, wob: 1.0, seed: 402, dark: (x, y) => 0.85 * LW.smooth(3560, 3840, y), w: () => 1.0, taper: 0.3,
    });
    pen.draw(LW.ink, C.ink, 0.85);
  };

  LW.drawDetails = async function () {
    const rnd = LW.rng('details');
    const S = LW.scene;
    // ---- scrub along the summit skyline right of the chapel and on ledges
    const G = LW.cliffGeom();
    for (const p of G.sky) {
      if (p[0] < 1750 || p[0] > 2200) continue;
      if (rnd() < 0.06) bush(p[0], p[1] + 8, rnd.range(26, 46), rnd);
    }
    // bushes near the corner top / on the skyline left of the chapel
    for (const p of G.sky) {
      if (p[0] < 900 || p[0] > 1180) continue;
      if (rnd() < 0.05) bush(p[0], p[1] + 6, rnd.range(20, 34), rnd);
    }
    await LW.tick();
    // ---- ferns at the foot of the parapet and in the floor joints
    const zP = S.parapet.z;
    for (const x of [-1.9, -1.15, -0.75]) {
      const p = LW.proj([x, S.landing.y, zP - 0.02]);
      if (p[0] < -40) continue;
      LW.fern(p[0], p[1], rnd.range(110, 170), -Math.PI / 2 + rnd.gauss() * 0.5, rnd);
    }
    await LW.tick();
    // ---- swallows
    const birds = [
      [1080, 520, 74, -0.35, 0.2], [1180, 640, 52, 0.4, -0.3], [1960, 330, 64, 2.6, 0.4],
      [1880, 520, 40, 3.4, -0.2], [940, 300, 46, 0.1, 0.5], [2040, 760, 34, 2.9, 0.1],
    ];
    for (const [x, y, s, a, f] of birds) swallow(x, y, s * 1.55, a, f, rnd);
    for (const [x, y, s, a, f] of [[1700, 230, 26, 2.2, 0.3], [1580, 410, 22, 0.6, -0.2], [2090, 180, 20, 3.0, 0.2]]) swallow(x, y, s * 1.55, a, f, rnd);
  };
})();
