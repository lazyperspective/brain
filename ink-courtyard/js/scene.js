// "The Blue House" - the static painting, made once at load into layers:
//   sky (teal sky, orange moon) | far (a house further back, a pole and its wires) | front (the blue house, its
//   roofs, door, windows, steps, the jar and the vine's old wood) | dissolve (the paper taking the lower left back)
//   | over (seal, brush marks) | light (moonlight, soft-light) | paper (multiply) | wallMask
// The house is a small model in metres, seen in two-point perspective from a little above the lower roof and off
// to the left, so walls recede, the door and windows are cut into the wall with depth, and the tiles foreshorten.
(function () {
  const CY = window.CY;
  const { W, H, rgba } = CY;

  const G = (CY.G = {
    D: 28,
    moon: { x: 300, y: 470, r: 172 },
    shadowOff: [30, 40],
    skel: null,
  });

  // ------------------------------------------------------------------ the camera
  const CAM = { x: -3.0, y: 4.1, z: -14, yaw: 0.42, f: 2700, cx: 560, cy: 880 };
  const cyw = Math.cos(CAM.yaw), syw = Math.sin(CAM.yaw);
  const zcOf = (x, z) => (x - CAM.x) * syw + (z - CAM.z) * cyw;
  const P = (x, y, z) => {
    const px = x - CAM.x, pz = z - CAM.z, xc = px * cyw - pz * syw, zc = px * syw + pz * cyw;
    return [CAM.cx + (CAM.f * xc) / zc, CAM.cy - (CAM.f * (y - CAM.y)) / zc];
  };
  const ppm = (x, z) => CAM.f / zcOf(x, z); // screen px per metre at that spot
  CY.P = P; CY.ppm = ppm; CY.CAM = CAM;
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]); return [a[0] / l, a[1] / l, a[2] / l]; };
  const facesCam = (n, p) => dot(n, sub([CAM.x, CAM.y, CAM.z], p)) > 0;

  // a planar face: origin O, unit axes U, V (world), extents w x h; at(u, v[, d]) -> screen, d = depth inward
  function face(O, U, V, w, h) {
    const N = cross(U, V); // points into the house for every face used here
    const W3 = (u, v, d) => [O[0] + U[0] * u + V[0] * v + N[0] * (d || 0), O[1] + U[1] * u + V[1] * v + N[1] * (d || 0), O[2] + U[2] * u + V[2] * v + N[2] * (d || 0)];
    const at = (u, v, d) => { const p = W3(u, v, d); return P(p[0], p[1], p[2]); };
    const quad = (u0, v0, u1, v1, d) => [at(u0, v0, d), at(u1, v0, d), at(u1, v1, d), at(u0, v1, d)];
    return { O, U, V, N, w, h, W3, at, quad, poly: quad(0, 0, w, h) };
  }

  // ------------------------------------------------------------------ helpers
  const ink = (g, pts, o) => CY.ink(g, pts, o);
  function lgrad(g, x0, y0, x1, y1, stops) { const gr = g.createLinearGradient(x0, y0, x1, y1); for (const [o, c, a] of stops) gr.addColorStop(o, rgba(c, a)); return gr; }
  function fillPoly(t, q, col, a) { t.fillStyle = rgba(col, a); t.beginPath(); q.forEach((p, i) => (i ? t.lineTo(p[0], p[1]) : t.moveTo(p[0], p[1]))); t.closePath(); t.fill(); }
  // brush blocks laid in the plane of a face, so even the brushwork recedes
  function dabs(t, R, F, n, o) {
    for (let i = 0; i < n; i++) {
      const u = R.r(o.u[0], o.u[1]), v = R.r(o.v[0], o.v[1]), du = R.r(o.du[0], o.du[1]), dv = R.r(o.dv[0], o.dv[1]);
      if (o.keep && !o.keep(u, v)) continue;
      const q = F.quad(u, v, u + du, v + dv);
      const j = o.jit == null ? 2.6 : o.jit;
      for (const p of q) { p[0] += R.g() * j; p[1] += R.g() * j; }
      fillPoly(t, q, CY.jit(R.pick(o.cols), R, o.v2 == null ? 0.07 : o.v2), R.r(o.a[0], o.a[1]));
    }
  }

  // ------------------------------------------------------------------ the sky and the moon
  function paintSky() {
    const L = CY.mk(W, H), g = L.g;
    const top = 1300;
    CY.gouache(g, CY.rect(-10, -10, W + 20, top), {
      col: '#1d6c7e', rough: 0, passes: 1, erode: 0, holes: 0.25, mott: 0.12, grain: 1.5, seed: 11,
      fx: (t, R) => {
        t.fillStyle = lgrad(t, 0, 0, 0, top, [[0, '#155d6f', 1], [0.45, '#1d6e80', 1], [1, '#2a7f8c', 1]]); t.fillRect(-10, -10, W + 20, top);
        // flat gouache laid in broad, barely visible passes
        t.lineCap = 'round';
        for (let i = 0; i < 420; i++) {
          const y = R.r(-10, top), x = R.r(-200, W), len = R.r(140, 560);
          t.strokeStyle = rgba(CY.jit(R.pick(['#1a6577', '#23768a', '#145668', '#2b8090']), R, 0.05), R.r(0.05, 0.14));
          t.lineWidth = R.r(10, 40);
          t.beginPath(); t.moveTo(x, y); t.quadraticCurveTo(x + len / 2, y + R.g() * 5, x + len, y + R.g() * 4); t.stroke();
        }
      },
    });
    const m = G.moon;
    // a faint warm bloom in the teal around the moon
    g.save(); g.globalCompositeOperation = 'screen';
    const hg = g.createRadialGradient(m.x, m.y, m.r * 0.95, m.x, m.y, m.r * 2.1);
    hg.addColorStop(0, 'rgba(120,90,40,0.35)'); hg.addColorStop(1, 'rgba(90,70,40,0)');
    g.fillStyle = hg; g.fillRect(m.x - m.r * 3, m.y - m.r * 3, m.r * 6, m.r * 6);
    g.restore();
    // the moon: a flat, chalky orange disc, a little lighter toward its top
    CY.gouache(g, CY.circle(m.x, m.y, m.r, 160), {
      col: '#f0a24b', rough: 1.2, passes: 3, erode: 0.3, eb: 2, mott: 0.1, holes: 0.3, seed: 12,
      fx: (t, R) => {
        const rg = t.createRadialGradient(m.x - 40, m.y - 60, 10, m.x, m.y, m.r);
        rg.addColorStop(0, 'rgba(250,190,105,0.55)'); rg.addColorStop(1, 'rgba(226,128,52,0.3)');
        t.fillStyle = rg; t.fillRect(m.x - m.r, m.y - m.r, m.r * 2, m.r * 2);
        for (let i = 0; i < 70; i++) { const a = R.f() * 6.283, rr = Math.sqrt(R.f()) * m.r; t.strokeStyle = rgba(R.pick(['#f6b464', '#e8913f', '#f3a957']), R.r(0.1, 0.25)); t.lineWidth = R.r(6, 18); t.beginPath(); t.moveTo(m.x + Math.cos(a) * rr - 30, m.y + Math.sin(a) * rr); t.lineTo(m.x + Math.cos(a) * rr + 30, m.y + Math.sin(a) * rr + R.g() * 3); t.stroke(); }
      },
    });
    return L;
  }

  // ------------------------------------------------------------------ the model
  const GF = { x0: 0, x1: 9.4, z0: 0, z1: 6.5, h: 3.2 };
  const LR = { eaveZ: -0.85, eaveY: 3.05, ridgeZ: 3.25, ridgeY: 5.0, x0: -0.45, x1: 10.2 };
  const US = { x0: 4.4, x1: 9.4, z0: 1.6, z1: 6.2, y0: 3.8, h: 6.5 };
  const UR = { eaveZ: 0.85, eaveY: 6.35, ridgeZ: 3.9, ridgeY: 8.15, x0: 3.75, x1: 10.2 };
  const DOOR = { u0: 2.9, u1: 4.5, v0: 0.62, v1: 2.78, d: 0.42 };
  const WIN1 = { u0: 0.65, u1: 1.85, v0: 1.15, v1: 2.25, d: 0.32 };
  const WIN2 = { u0: 5.0, u1: 6.05, v0: 4.75, v1: 5.75, d: 0.28 };
  const WIN3 = { u0: 2.4, u1: 3.3, v0: 1.3, v1: 2.2, d: 0.3 }; // in the gable end
  const lrY = (z) => LR.eaveY + ((z - LR.eaveZ) * (LR.ridgeY - LR.eaveY)) / (LR.ridgeZ - LR.eaveZ);
  const slopeL = norm([0, LR.ridgeY - LR.eaveY, LR.ridgeZ - LR.eaveZ]), lenL = Math.hypot(LR.ridgeY - LR.eaveY, LR.ridgeZ - LR.eaveZ);
  const slopeU = norm([0, UR.ridgeY - UR.eaveY, UR.ridgeZ - UR.eaveZ]), lenU = Math.hypot(UR.ridgeY - UR.eaveY, UR.ridgeZ - UR.eaveZ);
  const vAtZ = (z) => ((z - LR.eaveZ) / (LR.ridgeZ - LR.eaveZ)) * lenL;

  const F_front = face([GF.x0, 0, GF.z0], [1, 0, 0], [0, 1, 0], GF.x1 - GF.x0, GF.h);
  const F_gable = face([0, 0, GF.z1], [0, 0, -1], [0, 1, 0], GF.z1 - GF.z0, GF.h);
  const F_usFront = face([US.x0, US.y0, US.z0], [1, 0, 0], [0, 1, 0], US.x1 - US.x0, US.h - US.y0);
  const F_usLeft = face([US.x0, US.y0, US.z1], [0, 0, -1], [0, 1, 0], US.z1 - US.z0, US.h - US.y0);
  const F_lroof = face([LR.x0, LR.eaveY, LR.eaveZ], [1, 0, 0], slopeL, LR.x1 - LR.x0, lenL);
  const F_uroof = face([UR.x0, UR.eaveY, UR.eaveZ], [1, 0, 0], slopeU, UR.x1 - UR.x0, lenU);
  const gablePoly = [F_gable.at(0, 0), F_gable.at(6.5, 0), F_gable.at(6.5, lrY(0) + 0.05), F_gable.at(6.5 - LR.ridgeZ, LR.ridgeY - 0.12), F_gable.at(0, lrY(0) + 0.05)];
  const usLeftPoly = [F_usLeft.at(0, 0), F_usLeft.at(4.6, 0), F_usLeft.at(4.6, 2.75), F_usLeft.at(US.z1 - UR.ridgeZ, UR.ridgeY - US.y0 - 0.1), F_usLeft.at(0, 2.75)];

  // a window or door cut into a face: the back plane at depth d, and whichever reveals the eye can see
  function recess(g, F, o, seed, paintBack, light) {
    const { u0, u1, v0, v1, d } = o;
    const back = F.quad(u0, v0, u1, v1, d);
    paintBack(g, back, seed);
    const sides = [
      { q: [F.at(u0, v0), F.at(u0, v1), F.at(u0, v1, d), F.at(u0, v0, d)], n: F.U, p: F.W3(u0, (v0 + v1) / 2, d / 2), kind: 'jamb' },
      { q: [F.at(u1, v0), F.at(u1, v1), F.at(u1, v1, d), F.at(u1, v0, d)], n: F.U.map((c) => -c), p: F.W3(u1, (v0 + v1) / 2, d / 2), kind: 'jamb' },
      { q: [F.at(u0, v0), F.at(u1, v0), F.at(u1, v0, d), F.at(u0, v0, d)], n: F.V, p: F.W3((u0 + u1) / 2, v0, d / 2), kind: 'sill' },
      { q: [F.at(u0, v1), F.at(u1, v1), F.at(u1, v1, d), F.at(u0, v1, d)], n: F.V.map((c) => -c), p: F.W3((u0 + u1) / 2, v1, d / 2), kind: 'head' },
    ];
    sides.forEach((s, k) => {
      if (!facesCam(s.n, s.p)) return;
      const lit = s.n[0] < -0.5 || s.n[2] < -0.5; // facing the moon on the left, or toward us
      const col = s.kind === 'sill' ? '#8fa1a3' : lit ? (light ? '#8db7c6' : '#6b9db2') : '#3b6f8a';
      CY.gouache(g, s.q, { col, rough: 0.8, passes: 2, erode: 0.3, eb: 1.5, seed: seed + 10 + k, mott: 0.2,
        streaks: { dens: 160, ang: s.kind === 'sill' ? 0 : Math.PI / 2, angv: 0.1, len: [6, 30], w: [1, 4], a: [0.1, 0.3], cols: s.kind === 'sill' ? ['#6f8286', '#b3bfbd'] : ['#2f607a', '#a7c7cf', '#5b8fa6'] } });
      CY.inkPoly(g, s.q, { w: 1.3, a: 0.45, dry: 0.55, seed: seed + 20 + k, seg: [30, 90] });
    });
    // the head of the opening throws a shadow down the back plane
    const sh = [F.at(u0, v1, d), F.at(u1, v1, d), F.at(u1, v1 - (v1 - v0) * 0.16, d), F.at(u0, v1 - (v1 - v0) * 0.1, d)];
    CY.wash(g, sh, '#10202a', { a: 0.45, blur: 2, seed: seed + 30, rim: 0, blend: 'multiply' });
    ink(g, [F.at(u0, v1), F.at(u1, v1)], { w: 2.2, a: 0.8, dry: 0.45, seed: seed + 31, tin: 0.03, tout: 0.06 });
    ink(g, [F.at(u0, v0), F.at(u0, v1)], { w: 1.8, a: 0.65, dry: 0.5, seed: seed + 32, tin: 0.03, tout: 0.06 });
    return back;
  }
  // windows: dark interior behind turned wooden bars
  function windowBack(F, o, nbars) {
    return (g, q, seed) => {
      CY.gouache(g, q, { col: '#14212a', rough: 0.6, passes: 2, erode: 0.2, seed, mott: 0.2, fx: (t) => { t.fillStyle = rgba('#2a4250', 0.4); t.fillRect(0, 0, W, H); } });
      const R = CY.rng(seed + 1);
      for (let k = 1; k < nbars; k++) {
        const u = o.u0 + ((o.u1 - o.u0) * k) / nbars;
        fillPoly(g, F.quad(u - 0.025, o.v0, u + 0.025, o.v1, o.d - 0.04), CY.jit('#3a4f5b', R, 0.08), 0.95);
        ink(g, [F.at(u - 0.025, o.v0, o.d - 0.04), F.at(u - 0.025, o.v1, o.d - 0.04)], { w: 1.2, col: [140, 170, 180], a: 0.35, dry: 0.5, seed: seed + 5 + k, nb: 2 });
      }
      for (const v of [o.v0 + 0.04, o.v1 - 0.05]) fillPoly(g, F.quad(o.u0, v - 0.04, o.u1, v + 0.04, o.d - 0.05), '#2e3f49', 0.95);
    };
  }

  // the lime-washed walls: a base coat, broad blue blocks, the courses of the stone showing low down, pale lime
  // where the wash has worn, dark stains and drips. Everything is laid in the face's own plane.
  function plaster(g, F, polys, o) {
    const A = F.w * F.h, vmax = o.vmax || F.h;
    CY.gouache(g, polys, {
      col: o.base, rough: 2.2, passes: 2, erode: 0.5, eb: 3, seed: o.seed, mott: 0.2, grain: 1.2, rule: 'evenodd',
      fx: (t, R) => {
        dabs(t, R, F, A * 16, { u: [-0.4, F.w], v: [-0.2, vmax], du: [0.4, 1.7], dv: [0.12, 0.55], cols: o.cols, a: [0.22, 0.55] });
        // stone courses low down, blocky, some showing through the wash
        const top = o.stones || 0;
        let v = 0;
        while (v < top) {
          const rh = R.r(0.16, 0.28);
          for (let u = -R.r(0, 0.4); u < F.w;) {
            const du = R.r(0.22, 0.62);
            if (R.f() < 0.7 * (1 - (v / top) * 0.6)) {
              const q = F.quad(u + 0.015, v + 0.012, u + du - 0.015, v + rh - 0.012);
              for (const p of q) { p[0] += R.g() * 0.8; p[1] += R.g() * 0.8; }
              fillPoly(t, q, CY.jit(R.pick(o.stoneCols), R, 0.08), R.r(0.35, 0.8));
              if (R.f() < 0.5) fillPoly(t, F.quad(u + 0.015, v + 0.012, u + du - 0.015, v + 0.04), '#0f2230', R.r(0.25, 0.5));
            }
            u += du;
          }
          v += rh;
        }
        // lime where the blue has worn away; worse low down and at the corner
        dabs(t, R, F, A * 4, { u: [-0.2, F.w], v: [0, vmax], du: [0.05, 0.42], dv: [0.03, 0.2], cols: o.lime, a: [0.15, 0.55], jit: 3.5, keep: (u, v) => R.f() < 0.35 + 0.52 * (1 - v / vmax) || u < 0.6 });
        dabs(t, R, F, A * 4, { u: [-0.2, F.w], v: [0, vmax], du: [0.04, 0.32], dv: [0.03, 0.14], cols: o.dark, a: [0.3, 0.75] });
        // drips and damp running down from the eave
        t.lineCap = 'round';
        for (let i = 0; i < A * 1.6; i++) {
          const u = R.r(0, F.w), v1 = vmax - R.r(0, 0.3), v2 = v1 - R.r(0.3, 1.6);
          const a = F.at(u, v1), b = F.at(u + R.g() * 0.02, v2);
          t.strokeStyle = rgba(R.pick(o.dark), R.r(0.08, 0.22)); t.lineWidth = R.r(2, 7);
          t.beginPath(); t.moveTo(a[0], a[1]); t.lineTo(b[0], b[1]); t.stroke();
        }
      },
    });
  }

  // a tiled roof slope: courses of small, uneven tiles laid from the eave up, each course lapping the one below
  function tiles(g, F, polys, o) {
    CY.gouache(g, polys, {
      col: '#252e34', rough: 1.4, passes: 2, erode: 0.35, seed: o.seed, mott: 0.12, rule: 'evenodd',
      fx: (t, R) => {
        const rowH = o.row || 0.22;
        let r = 0;
        for (let v = -0.05; v < F.h; v += rowH * (1 + R.g() * 0.06), r++) {
          let u = -R.r(0, 0.25) - (r % 2) * 0.12;
          while (u < F.w) {
            const tw = R.r(0.17, 0.3);
            const q = F.quad(u + 0.012, v, u + tw - 0.012, v + rowH * 1.35);
            for (const p of q) { p[0] += R.g() * 0.7; p[1] += R.g() * 0.7; }
            const cool = R.f() < 0.78;
            fillPoly(t, q, CY.jit(cool ? R.pick(o.cols) : R.pick(o.warm), R, 0.1), R.r(0.75, 1));
            // the lit upper face of the tile, and the dark shadow under its lip
            fillPoly(t, F.quad(u + 0.03, v + rowH * 0.55, u + tw * R.r(0.5, 0.9), v + rowH * 1.2), R.pick(o.lit), R.r(0.12, 0.35));
            fillPoly(t, F.quad(u, v - 0.035, u + tw, v + 0.008), '#0e1418', R.r(0.45, 0.8));
            if (R.f() < 0.05) fillPoly(t, F.quad(u + 0.03, v + 0.03, u + tw * 0.6, v + rowH), '#0c1216', 0.7); // a broken one
            if (R.f() < 0.06) fillPoly(t, F.quad(u + 0.02, v + rowH * 0.3, u + tw * 0.7, v + rowH), R.pick(['#6f7d55', '#8a8f62']), 0.4); // moss
            u += tw;
          }
        }
        // the slope darkens toward the ridge, away from the moonlight
        fillPoly(t, F.quad(0, F.h * 0.55, F.w, F.h), '#080e14', 0.18);
      },
    });
  }
  // round end tiles along an eave (vertical discs facing the camera), and the dark fascia under them
  function eaveEdge(g, x0, x1, y, z, seed, step) {
    const R = CY.rng(seed);
    const fas = [P(x0, y, z), P(x1, y, z), P(x1, y - 0.2, z), P(x0, y - 0.2, z)];
    CY.gouache(g, fas, { col: '#1e272d', rough: 0.8, passes: 2, erode: 0.3, seed, mott: 0.15 });
    for (let x = x0 + 0.08; x < x1; x += step * (1 + R.g() * 0.05)) {
      const r = 0.085 * R.r(0.9, 1.1), cy = y - 0.03 + R.g() * 0.01;
      const ring = []; for (let k = 0; k < 18; k++) { const a = (k / 18) * 6.283; ring.push(P(x + Math.cos(a) * r, cy + Math.sin(a) * r, z - 0.02)); }
      fillPoly(g, ring, CY.jit('#55626a', R, 0.12), 1);
      const s = ppm(x, z), c = P(x, cy, z - 0.02);
      g.strokeStyle = rgba('#a9b8bc', 0.4); g.lineWidth = 1; g.beginPath(); g.arc(c[0], c[1], r * s * 0.55, 0, 6.283); g.stroke();
      ink(g, ring.concat([ring[0]]), { w: 1.2, a: 0.6, dry: 0.4, seed: seed + Math.round(x * 100), nb: 2, tin: 0.02, tout: 0.04 });
    }
  }
  // a ridge: tiles set on edge along the top, an upturned curl at the open end
  function ridge(g, x0, x1, y, z, seed, curl) {
    const hgt = 0.34;
    const F = face([x0, y - 0.06, z], [1, 0, 0], [0, 1, 0], x1 - x0, hgt);
    CY.gouache(g, F.poly, { col: '#262f35', rough: 1, passes: 2, erode: 0.3, seed, mott: 0.15, fx: (t, R2) => {
      for (let u = 0; u < F.w; u += R2.r(0.06, 0.1)) fillPoly(t, F.quad(u, 0.08, u + 0.04, hgt - 0.08), R2.pick(['#4a565d', '#3a454b', '#5c676c']), 0.85);
      fillPoly(t, F.quad(0, hgt - 0.08, F.w, hgt), '#56636a', 0.9);
    } });
    ink(g, [F.at(0, hgt), F.at(F.w, hgt)], { w: 2.2, a: 0.8, dry: 0.45, seed: seed + 1, tin: 0.01, tout: 0.01, wob: 1 });
    if (curl) {
      // the ridge end sweeps up and out into a curl
      const s = ppm(x0, z), b = F.at(0, hgt * 0.5);
      const pts = []; for (let k = 0; k <= 20; k++) { const u = k / 20; pts.push([b[0] - u * 0.55 * s + Math.sin(u * 2.4) * 0.05 * s, b[1] - Math.pow(u, 1.8) * 0.5 * s]); }
      const e = pts[pts.length - 1];
      for (let k = 0; k < 10; k++) { const a = -1.4 + k * 0.42, r = 0.1 * s * (1 - k / 14); pts.push([e[0] + 0.09 * s + Math.cos(a + Math.PI) * r, e[1] + Math.sin(a + Math.PI) * r]); }
      const thick = pts.map((p, i) => [p[0] + (1 - i / pts.length) * 0.04 * s, p[1] + (1 - i / pts.length) * 0.26 * s + 0.03 * s]);
      fillPoly(g, pts.concat(thick.slice().reverse()), '#262f35', 1);
      ink(g, pts, { w: 2.6, a: 0.85, dry: 0.4, seed: seed + 2, tin: 0.05, tout: 0.3 });
    }
    return F;
  }

  // ------------------------------------------------------------------ the house further back, a pole, its wires
  function paintFar() {
    const L = CY.mk(W, H), g = L.g;
    // a second, lower house behind, its roof crossing the foot of the moon
    const bx0 = -9, bx1 = 6, bz = 12.5, beY = 4.4, brZ = 15.2, brY = 7.1;
    CY.gouache(g, [P(bx0, 0, bz), P(bx1, 0, bz), P(bx1, beY, bz), P(bx0, beY, bz)], { col: '#3f7f95', rough: 2, passes: 2, erode: 0.5, seed: 21, mott: 0.2, streaks: { dens: 300, ang: Math.PI / 2, len: [10, 50], w: [3, 10], a: [0.1, 0.3], cols: ['#5a95a8', '#2f6a80', '#8fb6bf'] } });
    const bR = face([bx0 - 0.4, beY - 0.1, bz - 0.7], [1, 0, 0], norm([0, brY - beY, brZ - bz + 0.7]), bx1 - bx0 + 0.8, Math.hypot(brY - beY, brZ - bz + 0.7));
    tiles(g, bR, [bR.poly], { seed: 22, row: 0.3, cols: ['#3a4a52', '#46565e', '#2f3c43'], warm: ['#5b5550', '#4f4a48'], lit: ['#7d8e94'] });
    ridge(g, bx0 - 0.4, bx1 + 0.4, brY, brZ, 24, false);
    eaveEdge(g, bx0 - 0.4, bx1 + 0.4, beY - 0.1, bz - 0.7, 25, 0.32);
    // the pole and its sagging wires
    ink(g, [P(1.2, 0, 8.5), P(1.2, 9.6, 8.5)], { w: 5, col: [30, 40, 46], a: 0.92, dry: 0.3, seed: 26, tin: 0.01, tout: 0.02, wob: 0.6 });
    ink(g, [P(0.6, 9.0, 8.5), P(1.8, 9.0, 8.5)], { w: 3, col: [30, 40, 46], a: 0.9, dry: 0.3, seed: 27, tin: 0.01, tout: 0.01 });
    const wire = (a, b, sag, seed) => { const pts = []; for (let k = 0; k <= 30; k++) { const u = k / 30; pts.push([a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u + Math.sin(u * Math.PI) * sag]); } ink(g, pts, { w: 1.3, col: [24, 34, 40], a: 0.8, dry: 0.25, seed, nb: 2, tin: 0.01, tout: 0.01 }); };
    const top = P(0.7, 9.0, 8.5), top2 = P(1.7, 9.0, 8.5);
    wire(top, [-20, top[1] + 30], 26, 28);
    wire(top2, [-20, top2[1] + 60], 34, 29);
    wire(top2, P(UR.x0 + 0.4, 6.6, UR.eaveZ + 0.4), 30, 30);
    // the haze of distance: the far things lean toward the colour of the sky
    g.save(); g.globalCompositeOperation = 'source-atop'; g.fillStyle = 'rgba(29,108,126,0.32)'; g.fillRect(0, 0, W, H); g.restore();
    return L;
  }

  // ------------------------------------------------------------------ the blue house
  const LIT = { base: '#5f97ad', cols: ['#77abbe', '#5a91a8', '#8fbccb', '#4b839d', '#6aa1b5'], lime: ['#d9e6e1', '#eef0e4', '#b9d4d8'], dark: ['#2a5670', '#3d6276', '#5b7a80'], stoneCols: ['#6b8c99', '#879fa6', '#5a7a88', '#9fb2b3'] };
  const SHADE = { base: '#336f8f', cols: ['#2b6688', '#3f7fa0', '#4d8eac', '#245b7c', '#5f9ab4', '#1f5272'], lime: ['#a9c9d2', '#c9dcd9', '#88b4c4'], dark: ['#173a52', '#1d4560', '#3a5560'], stoneCols: ['#3f6578', '#567888', '#2f5468', '#6e8b94'] };
  const TILE_COLS = ['#4d5a62', '#5b676e', '#414d55', '#66737a', '#53606a'], TILE_WARM = ['#806a5c', '#8c624c', '#71665d', '#9a7058'], TILE_LIT = ['#a9bbc1', '#ccd2cb'];

  function paintHouse(g) {
    // --- the ground floor: gable end (moonlit) and front
    plaster(g, F_gable, [gablePoly, F_gable.quad(WIN3.u0, WIN3.v0, WIN3.u1, WIN3.v1)], Object.assign({ seed: 301, stones: 1.1, vmax: 4.9 }, LIT));
    recess(g, F_gable, WIN3, 320, windowBack(F_gable, WIN3, 6), true);
    plaster(g, F_front, [F_front.poly, F_front.quad(DOOR.u0, DOOR.v0, DOOR.u1, DOOR.v1), F_front.quad(WIN1.u0, WIN1.v0, WIN1.u1, WIN1.v1)], Object.assign({ seed: 302, stones: 1.3 }, SHADE));
    // the plinth: a course of big dressed stones the wall stands on
    const plinth = face([0, 0, -0.06], [1, 0, 0], [0, 1, 0], GF.x1, 0.5);
    CY.gouache(g, plinth.poly, { col: '#2f4d5c', rough: 1.4, passes: 2, erode: 0.45, seed: 303, mott: 0.2, fx: (t, R2) => {
      for (let u = -0.1; u < plinth.w;) { const du = R2.r(0.5, 1.1); fillPoly(t, plinth.quad(u + 0.02, 0.03, u + du - 0.02, 0.47), CY.jit(R2.pick(['#4a6b7a', '#3b5a68', '#5c7b86', '#33505e']), R2, 0.08), 0.85); fillPoly(t, plinth.quad(u + 0.02, 0.36, u + du - 0.02, 0.47), '#9fb4b8', 0.25); u += du; }
    } });
    ink(g, [plinth.at(0, 0.5), plinth.at(plinth.w, 0.5)], { w: 1.6, a: 0.6, dry: 0.5, seed: 304, tin: 0.01, tout: 0.01 });
    const plG = face([-0.06, 0, GF.z1], [0, 0, -1], [0, 1, 0], GF.z1 + 0.06, 0.5);
    CY.gouache(g, plG.poly, { col: '#5f8494', rough: 1.4, passes: 2, erode: 0.45, seed: 305, mott: 0.2, fx: (t, R2) => { for (let u = 0; u < plG.w;) { const du = R2.r(0.5, 1.1); fillPoly(t, plG.quad(u + 0.02, 0.03, u + du - 0.02, 0.47), CY.jit(R2.pick(['#7a9aa6', '#6a8b97', '#8eaab2']), R2, 0.08), 0.85); u += du; } } });
    // the corner where the two walls meet: a crisp, broken ink edge
    ink(g, [P(0, 0, 0), P(0, lrY(0), 0)], { w: 3.2, a: 0.85, dry: 0.5, seed: 306, dbl: 1.4, tin: 0.02, tout: 0.05, wob: 1 });
    // windows and the door, cut in
    recess(g, F_front, WIN1, 330, windowBack(F_front, WIN1, 8));
    recess(g, F_front, DOOR, 340, (g2, q, seed) => {
      // two leaves of old boards, darker than the wall, a hint of blue in the wood
      const F2 = face(F_front.W3(DOOR.u0, DOOR.v0, DOOR.d), [1, 0, 0], [0, 1, 0], DOOR.u1 - DOOR.u0, DOOR.v1 - DOOR.v0);
      CY.gouache(g2, q, { col: '#25323a', rough: 0.8, passes: 2, erode: 0.25, seed, mott: 0.18, fx: (t, R2) => {
        for (let u = 0; u < F2.w; u += R2.r(0.11, 0.17)) {
          fillPoly(t, F2.quad(u + 0.008, 0, u + R2.r(0.09, 0.15), F2.h), CY.jit(R2.pick(['#2f4049', '#344853', '#28363e', '#3d525c']), R2, 0.08), 0.9);
          const a = F2.at(u, 0), b = F2.at(u, F2.h); t.strokeStyle = 'rgba(10,16,20,0.7)'; t.lineWidth = 1.4; t.beginPath(); t.moveTo(a[0], a[1]); t.lineTo(b[0], b[1]); t.stroke();
        }
        for (let i = 0; i < 40; i++) { const u = R2.r(0, F2.w), v = R2.r(0, F2.h); const a = F2.at(u, v), b = F2.at(u, v - R2.r(0.1, 0.5)); t.strokeStyle = rgba(R2.pick(['#5d7480', '#16222a', '#6e8790']), R2.r(0.15, 0.4)); t.lineWidth = R2.r(1, 3); t.beginPath(); t.moveTo(a[0], a[1]); t.lineTo(b[0], b[1]); t.stroke(); }
        fillPoly(t, F2.quad(0, 0, F2.w, 0.35), '#6d8790', 0.2);
        for (const v of [0.35, 1.25, 1.95]) fillPoly(t, F2.quad(0.03, v, F2.w - 0.03, v + 0.07), '#1d282e', 0.8);
      } });
      ink(g2, [F2.at(F2.w / 2, 0), F2.at(F2.w / 2, F2.h)], { w: 2.6, a: 0.9, dry: 0.3, seed: seed + 3 });
      for (const s of [-1, 1]) { const c = F2.at(F2.w / 2 + s * 0.09, 1.15); g2.fillStyle = '#0f1518'; g2.beginPath(); g2.arc(c[0], c[1], 4, 0, 6.283); g2.fill(); const r = ppm(DOOR.u0 + 0.8, DOOR.d) * 0.05; ink(g2, CY.circle(c[0], c[1] + r, r, 18).concat([[c[0] + r, c[1] + r]]), { w: 1.6, a: 0.8, dry: 0.2, seed: seed + 5 + s, tin: 0.02, tout: 0.04, col: [180, 150, 90] }); }
      // a faded paper notice pasted on one leaf, its writing reduced to a few brush dabs
      CY.gouache(g2, F2.quad(0.18, 1.45, 0.52, 1.9), { col: '#c9b48c', rough: 0.6, passes: 2, erode: 0.7, eb: 1.5, seed: seed + 7, a: 0.7, mott: 0.3 });
      for (let k = 0; k < 3; k++) ink(g2, [F2.at(0.26 + k * 0.09, 1.82), F2.at(0.26 + k * 0.09, 1.52)], { w: 2.4, a: 0.5, dry: 0.6, seed: seed + 8 + k, nb: 3, col: [70, 40, 30] });
    });
    // the lintel beam over the door
    fillPoly(g, F_front.quad(DOOR.u0 - 0.25, DOOR.v1, DOOR.u1 + 0.25, DOOR.v1 + 0.18, -0.03), '#26323a', 0.95);
    ink(g, [F_front.at(DOOR.u0 - 0.25, DOOR.v1 + 0.18, -0.03), F_front.at(DOOR.u1 + 0.25, DOOR.v1 + 0.18, -0.03)], { w: 1.8, a: 0.7, dry: 0.4, seed: 345 });
    fillPoly(g, F_front.quad(DOOR.u0 - 0.25, DOOR.v1 + 0.13, DOOR.u1 + 0.25, DOOR.v1 + 0.18, -0.03), '#7f9aa3', 0.35);

    // --- the upper storey, set back on the lower roof
    plaster(g, F_usLeft, [usLeftPoly], Object.assign({ seed: 350, vmax: 4.3 }, LIT));
    plaster(g, F_usFront, [F_usFront.poly, F_usFront.quad(WIN2.u0 - US.x0, WIN2.v0 - US.y0, WIN2.u1 - US.x0, WIN2.v1 - US.y0)], Object.assign({ seed: 351 }, SHADE));
    const W2 = { u0: WIN2.u0 - US.x0, u1: WIN2.u1 - US.x0, v0: WIN2.v0 - US.y0, v1: WIN2.v1 - US.y0, d: WIN2.d };
    recess(g, F_usFront, W2, 360, windowBack(F_usFront, W2, 7));
    ink(g, [P(US.x0, US.y0, US.z0), P(US.x0, US.h, US.z0)], { w: 3, a: 0.85, dry: 0.5, seed: 361, dbl: 1.3, tin: 0.02, tout: 0.05, wob: 1 });
    // the soffit under the upper eave: dark boards and rafter ends, seen from below
    const sof = [P(UR.x0, UR.eaveY, UR.eaveZ), P(UR.x1, UR.eaveY, UR.eaveZ), P(UR.x1, US.h, US.z0), P(US.x0, US.h, US.z0), P(UR.x0, UR.eaveY + 0.05, US.z0)];
    CY.gouache(g, sof, { col: '#1b252b', rough: 0.8, passes: 2, erode: 0.25, seed: 362, mott: 0.15 });
    for (let x = UR.x0 + 0.15; x < UR.x1; x += 0.32) {
      ink(g, [P(x, UR.eaveY - 0.02, UR.eaveZ + 0.05), P(x, US.h - 0.04, US.z0)], { w: 3.4, col: [58, 72, 80], a: 0.85, dry: 0.3, seed: 363 + Math.round(x * 10), nb: 3, tin: 0.05, tout: 0.05 });
    }
    // the verge soffit at the left end of the upper roof
    CY.gouache(g, [P(UR.x0, UR.eaveY, UR.eaveZ), P(UR.x0, UR.ridgeY, UR.ridgeZ), P(US.x0, UR.ridgeY - 0.12, UR.ridgeZ), P(US.x0, US.h, US.z0)], { col: '#1d282e', rough: 0.8, passes: 2, erode: 0.25, seed: 364, mott: 0.15 });
    // the upper roof
    tiles(g, F_uroof, [F_uroof.poly], { seed: 365, row: 0.21, cols: ['#46535b', '#55626a', '#3a464e', '#606b70', '#4d5960'], warm: ['#7b6457', '#8a5e48', '#6d625a', '#946b52'], lit: ['#9fb1b8', '#c2c9c3'] });
    CY.gouache(g, [P(UR.x0, UR.eaveY, UR.eaveZ), P(UR.x0, UR.ridgeY + 0.05, UR.ridgeZ), P(UR.x0, UR.ridgeY - 0.17, UR.ridgeZ), P(UR.x0, UR.eaveY - 0.22, UR.eaveZ)], { col: '#20292f', rough: 0.6, passes: 2, erode: 0.2, seed: 366 });
    ink(g, [P(UR.x0, UR.eaveY + 0.02, UR.eaveZ), P(UR.x0, UR.ridgeY + 0.06, UR.ridgeZ)], { w: 3, a: 0.85, dry: 0.4, seed: 367, dbl: 1, tin: 0.02, tout: 0.05 });
    eaveEdge(g, UR.x0, UR.x1, UR.eaveY + 0.04, UR.eaveZ, 368, 0.26);
    ridge(g, UR.x0 - 0.1, UR.x1, UR.ridgeY, UR.ridgeZ, 369, true);

    // --- the lower roof, in two parts: beside the upper storey, then the full width in front of it
    const vB = vAtZ(US.z0);
    tiles(g, F_lroof, [F_lroof.quad(0, vB - 0.02, US.x0 - LR.x0, lenL)], { seed: 370, row: 0.22, cols: TILE_COLS, warm: TILE_WARM, lit: TILE_LIT });
    ridge(g, LR.x0 - 0.05, US.x0, LR.ridgeY, LR.ridgeZ, 371, true);
    // where the lower roof meets the upper walls: a lime mortar flashing
    CY.gouache(g, [P(US.x0, lrY(US.z0), US.z0), P(US.x1 + 1, lrY(US.z0), US.z0), P(US.x1 + 1, lrY(US.z0) + 0.14, US.z0), P(US.x0, lrY(US.z0) + 0.14, US.z0)], { col: '#8ea4aa', rough: 0.8, passes: 2, erode: 0.4, seed: 372, mott: 0.2 });
    CY.gouache(g, [P(US.x0, lrY(US.z0), US.z0), P(US.x0, LR.ridgeY, LR.ridgeZ), P(US.x0, LR.ridgeY + 0.12, LR.ridgeZ), P(US.x0, lrY(US.z0) + 0.12, US.z0)], { col: '#a9bfc3', rough: 0.8, passes: 2, erode: 0.4, seed: 373, mott: 0.2 });
    tiles(g, F_lroof, [F_lroof.quad(0, 0, F_lroof.w, vB)], { seed: 374, row: 0.22, cols: TILE_COLS, warm: TILE_WARM, lit: TILE_LIT });
    CY.gouache(g, [P(LR.x0, LR.eaveY, LR.eaveZ), P(LR.x0, LR.ridgeY + 0.05, LR.ridgeZ), P(LR.x0, LR.ridgeY - 0.17, LR.ridgeZ), P(LR.x0, LR.eaveY - 0.22, LR.eaveZ)], { col: '#222c32', rough: 0.6, passes: 2, erode: 0.2, seed: 375 });
    ink(g, [P(LR.x0, LR.eaveY + 0.02, LR.eaveZ), P(LR.x0, LR.ridgeY + 0.06, LR.ridgeZ)], { w: 3, a: 0.85, dry: 0.4, seed: 376, dbl: 1, tin: 0.02, tout: 0.05 });
    eaveEdge(g, LR.x0, LR.x1, LR.eaveY + 0.04, LR.eaveZ, 377, 0.25);
    ink(g, [P(LR.x0, LR.eaveY + 0.06, LR.eaveZ), P(LR.x1, LR.eaveY + 0.06, LR.eaveZ)], { w: 1.6, col: [190, 205, 205], a: 0.35, dry: 0.7, seed: 378, nb: 3, tin: 0.01, tout: 0.01 });

    // --- ground, steps up to the door, a jar
    paintGround(g);
    const steps = [
      { x0: 2.75, x1: 4.65, y: 0.62, z0: -0.48, z1: 0 },
      { x0: 2.5, x1: 4.95, y: 0.41, z0: -0.92, z1: -0.48 },
      { x0: 2.25, x1: 5.25, y: 0.2, z0: -1.38, z1: -0.92 },
    ];
    G.stepTops = [];
    steps.forEach((s, k) => {
      const top = [P(s.x0, s.y, s.z0), P(s.x1, s.y, s.z0), P(s.x1, s.y, s.z1), P(s.x0, s.y, s.z1)];
      const front = [P(s.x0, s.y, s.z0), P(s.x1, s.y, s.z0), P(s.x1, 0, s.z0), P(s.x0, 0, s.z0)];
      const side = [P(s.x0, s.y, s.z1), P(s.x0, s.y, s.z0), P(s.x0, 0, s.z0), P(s.x0, 0, s.z1)];
      CY.gouache(g, side, { col: '#6f8f9c', rough: 1, passes: 2, erode: 0.4, seed: 385 + k, mott: 0.22 });
      const Fr = face([s.x0, 0, s.z0], [1, 0, 0], [0, 1, 0], s.x1 - s.x0, s.y);
      CY.gouache(g, front, { col: '#3f5c69', rough: 1.2, passes: 2, erode: 0.4, seed: 388 + k, mott: 0.22, fx: (t, R2) => {
        for (let u = 0; u < Fr.w;) { const du = R2.r(0.35, 0.8); fillPoly(t, Fr.quad(u + 0.015, 0.01, u + du - 0.015, Fr.h - 0.01), CY.jit(R2.pick(['#4d6b78', '#3c5865', '#577684', '#46616c']), R2, 0.08), 0.85); u += du; }
      } });
      const Ft = face([s.x0, s.y, s.z0], [1, 0, 0], [0, 0, 1], s.x1 - s.x0, s.z1 - s.z0);
      CY.gouache(g, top, { col: '#90a6ac', rough: 1, passes: 2, erode: 0.4, seed: 391 + k, mott: 0.22, fx: (t, R2) => {
        dabs(t, R2, Ft, 40, { u: [0, Ft.w], v: [0, Ft.h], du: [0.1, 0.5], dv: [0.04, 0.2], cols: ['#a7b9bc', '#7f979e', '#b8c5c3', '#6c868f'], a: [0.2, 0.55] });
        fillPoly(t, Ft.quad(Ft.w * 0.35, 0, Ft.w * 0.65, Ft.h * 0.8), '#c3cfcc', 0.25); // worn where feet go
      } });
      ink(g, [top[0], top[1]], { w: 2.4, a: 0.85, dry: 0.5, seed: 394 + k, dbl: 1, tin: 0.04, tout: 0.1, wob: 0.8 });
      ink(g, [top[0], top[3]], { w: 1.6, a: 0.6, dry: 0.5, seed: 397 + k, nb: 3 });
      ink(g, [front[0], front[3]], { w: 1.6, a: 0.6, dry: 0.5, seed: 399 + k, nb: 3 });
      CY.wash(g, CY.blob(front[3][0] + 14, front[3][1] - 4, 12, 5, 400 + k, 0.5, 14), '#6f7d52', { a: 0.5, blur: 1.2, seed: 400 + k, rim: 0.3, blend: null });
      G.stepTops.push(top);
    });
    paintJar(g);
  }

  function paintGround(g) {
    // paving in front of the house: slabs in perspective
    const Fg = face([-3, 0, -6], [1, 0, 0], [0, 0, 1], 14, 6);
    CY.gouache(g, Fg.poly, { col: '#8fa3a8', rough: 0, passes: 1, erode: 0, seed: 410, mott: 0.22, fx: (t, R) => {
      let z = -6;
      while (z < 0) {
        const dz = R.r(0.35, 0.6);
        for (let x = -3 - R.r(0, 0.6); x < 11;) {
          const dx = R.r(0.5, 1.2);
          const slab = Fg.quad(x + 3 + 0.02, z + 6 + 0.02, x + 3 + dx - 0.02, z + 6 + dz - 0.02);
          for (const p of slab) { p[0] += R.g(); p[1] += R.g(); }
          fillPoly(t, slab, CY.jit(R.pick(['#9fb1b4', '#8ea2a7', '#a9b8b8', '#7f959c', '#b3bfbc']), R, 0.06), R.r(0.6, 0.95));
          x += dx;
        }
        const a = P(-3, 0, z), b = P(11, 0, z); t.strokeStyle = 'rgba(40,60,70,0.35)'; t.lineWidth = 1.5; t.beginPath(); t.moveTo(a[0], a[1]); t.lineTo(b[0], b[1]); t.stroke();
        z += dz;
      }
      fillPoly(t, [P(-3, 0, -0.25), P(11, 0, -0.25), P(11, 0, 0), P(-3, 0, 0)], '#1b3646', 0.35);
    } });
    G.ground = Fg.poly;
  }

  // a big glazed jar to the left of the steps
  function paintJar(g) {
    const base = P(1.75, 0, -0.55), s = ppm(1.75, -0.55);
    const prof = [[0, 0.17], [0.03, 0.19], [0.12, 0.27], [0.3, 0.33], [0.48, 0.31], [0.6, 0.25], [0.66, 0.17], [0.7, 0.15], [0.74, 0.17]];
    const pts = CY.smooth(prof.map(([y, r]) => [r, y]), 3);
    const poly = pts.map(([r, y]) => [base[0] + r * s, base[1] - y * s]).concat(pts.slice().reverse().map(([r, y]) => [base[0] - r * s, base[1] - y * s]));
    CY.wash(g, CY.blob(base[0] + 0.25 * s, base[1] - 4, 0.42 * s, 0.07 * s, 420, 0.2), '#14303e', { a: 0.5, blur: 4, rim: 0, seed: 420 });
    CY.gouache(g, poly, { col: '#1f4f5f', rough: 1, passes: 3, erode: 0.35, seed: 421, mott: 0.15, fx: (t, R) => {
      t.fillStyle = lgrad(t, base[0] - 0.35 * s, 0, base[0] + 0.35 * s, 0, [[0, '#7fb0bb', 0.5], [0.3, '#3d7484', 0.2], [0.65, '#000000', 0], [1, '#081820', 0.5]]); t.fillRect(base[0] - s, base[1] - s, 2 * s, s);
      t.strokeStyle = rgba('#cfe3e0', 0.7); t.lineWidth = 3; t.lineCap = 'round'; t.beginPath(); t.moveTo(base[0] - 0.2 * s, base[1] - 0.52 * s); t.quadraticCurveTo(base[0] - 0.27 * s, base[1] - 0.35 * s, base[0] - 0.22 * s, base[1] - 0.2 * s); t.stroke();
      for (let i = 0; i < 30; i++) { const x = base[0] + R.r(-0.25, 0.25) * s, y = base[1] - R.r(0.1, 0.6) * s; t.strokeStyle = rgba('#0c2028', 0.3); t.lineWidth = 0.8; t.beginPath(); t.moveTo(x, y); t.lineTo(x + R.g() * 5, y + R.g() * 5); t.stroke(); }
      t.fillStyle = rgba('#9a8466', 0.9); t.fillRect(base[0] - s, base[1] - 0.06 * s, 2 * s, 0.07 * s);
    } });
    g.fillStyle = 'rgba(10,18,22,0.95)'; g.beginPath(); g.ellipse(base[0], base[1] - 0.74 * s, 0.15 * s, 0.035 * s, 0, 0, 6.283); g.fill();
    CY.inkPoly(g, poly, { w: 2, a: 0.8, dry: 0.45, seed: 422, seg: [60, 160] });
    G.jar = { x: base[0], y: base[1], r: 0.33 * s };
  }

  // ------------------------------------------------------------------ the vine's old wood
  // world skeleton -> screen. It roots right of the door, climbs the front wall, runs out along the lower eave over
  // the door, crosses the lower roof toward the moon, and climbs the upper storey to spill over its eave.
  const SKW = {
    trunk: [[5.85, 0, -0.18], [5.75, 0.7, -0.12], [5.95, 1.4, -0.08], [5.7, 2.1, -0.06], [5.85, 2.7, -0.2], [5.9, 3.15, -0.55], [6.1, 3.55, 0.1], [6.35, 3.9, 0.8], [6.55, 4.25, 1.5], [6.6, 4.9, 1.54], [6.4, 5.5, 1.54], [6.5, 6.1, 1.4], [6.3, 6.5, 1.05]],
    eave: [[5.9, 3.0, -0.6], [5.0, 3.06, -0.82], [4.1, 3.08, -0.86], [3.2, 3.1, -0.87], [2.3, 3.1, -0.86], [1.4, 3.12, -0.8]],
    roof: [[6.1, 3.6, 0.1], [5.2, 3.9, 0.65], [4.3, 4.2, 1.3], [3.4, 4.5, 1.95], [2.5, 4.78, 2.55], [1.7, 5.0, 3.1]],
    upper: [[6.45, 5.6, 1.54], [7.3, 5.85, 1.54], [8.2, 6.05, 1.5], [9.2, 6.2, 1.45]],
    top: [[6.3, 6.5, 1.05], [6.0, 6.95, 1.6], [5.7, 7.35, 2.3], [5.5, 7.7, 2.9]],
  };
  G.SKW = SKW;
  function paintVine(g) {
    const S = (pts) => CY.smooth(pts.map((p) => P(p[0], p[1], p[2])), 3);
    const sk = (G.skel = {});
    for (const k in SKW) sk[k] = S(SKW[k]);
    // static shadows of the wood on the walls
    const sh = CY.mk(W, H), s = sh.g;
    s.strokeStyle = '#000'; s.lineCap = 'round'; s.lineJoin = 'round';
    const so = G.shadowOff;
    const strokeSk = (pts, w) => { s.lineWidth = w; s.beginPath(); pts.forEach((p, i) => (i ? s.lineTo(p[0] + so[0] * 0.5, p[1] + so[1] * 0.5) : s.moveTo(p[0] + so[0] * 0.5, p[1] + so[1] * 0.5))); s.stroke(); };
    strokeSk(sk.trunk, 14); strokeSk(sk.upper, 5); strokeSk(sk.eave, 5);
    s.globalCompositeOperation = 'destination-in'; s.drawImage(paintWallMask().c, 0, 0);
    const b = CY.mk(W, H); b.g.filter = 'blur(2px)'; b.g.drawImage(sh.c, 0, 0);
    b.g.globalCompositeOperation = 'source-in'; b.g.fillStyle = '#1b3448'; b.g.fillRect(0, 0, W, H);
    g.save(); g.globalCompositeOperation = 'multiply'; g.globalAlpha = 0.5; g.drawImage(b.c, 0, 0); g.restore();
    // the trunk: three old stems twisting round each other, thinning upward
    const T = CY.resample(sk.trunk, 3);
    const taper = (q) => 1 - (q / T.L) * 0.55;
    g.save(); g.lineCap = 'round'; g.lineJoin = 'round';
    for (let i = 0; i < T.length - 1; i++) { g.strokeStyle = rgba('#3a2a24', 0.8); g.lineWidth = 17 * taper(T[i].s); g.beginPath(); g.moveTo(T[i].x, T[i].y); g.lineTo(T[i + 1].x, T[i + 1].y); g.stroke(); }
    g.restore();
    for (const front of [false, true]) {
      for (let k = 0; k < 3; k++) {
        const pts = T.map((p) => { const o = 6 * Math.sin(p.s / 34 + k * 2.09) * taper(p.s); return [p.x + p.nx * o, p.y + p.ny * o]; });
        let run = [];
        const flush = (i) => {
          if (run.length > 3) {
            const w = 6.5 * taper(T[i].s);
            CY.ink(g, run, { w, col: front ? [36, 26, 22] : [74, 56, 46], a: front ? 0.95 : 0.8, dry: 0.38, seed: 460 + k * 31 + i, tin: 0.08, tout: 0.08, wob: 0.7 });
            if (front) CY.ink(g, run.map((p) => [p[0] - w * 0.25, p[1] - 0.5]), { w: w * 0.3, col: [168, 150, 128], a: 0.45, dry: 0.6, seed: 470 + k * 31 + i, nb: 2, tin: 0.2, tout: 0.2 });
          }
          run = [];
        };
        for (let i = 0; i < T.length; i++) { const isFront = Math.cos(T[i].s / 34 + k * 2.09) >= 0; if (isFront === front) run.push(pts[i]); else flush(i); }
        flush(T.length - 1);
      }
    }
    const br = (pts, w0, seed) => { CY.ink(g, pts, { w: w0, col: [42, 30, 25], a: 0.9, dry: 0.42, seed, tin: 0.02, tout: 0.35, press: (u) => 1 - u * 0.55, wob: 1, dbl: 0.8 }); CY.ink(g, pts.map((p) => [p[0] - 1.4, p[1] - 1]), { w: 1.2, col: [160, 140, 118], a: 0.35, dry: 0.7, seed: seed + 1, nb: 2 }); };
    br(sk.eave, 5.5, 480); br(sk.roof, 5, 482); br(sk.upper, 4.5, 484); br(sk.top, 4, 486);
    const R = CY.rng(490);
    for (const pts of [sk.trunk, sk.eave, sk.roof, sk.upper]) {
      for (const p of CY.resample(pts, 20)) if (R.f() < 0.5) { const sd = R.sign(); ink(g, [[p.x, p.y], [p.x + p.nx * sd * 6 + R.g(), p.y + p.ny * sd * 6 - 3]], { w: 1.3, a: 0.8, dry: 0.1, seed: R.i(1, 9999), nb: 2, tin: 0.01, tout: 0.9 }); }
    }
  }

  // ------------------------------------------------------------------ the paper taking back the lower left
  // a ragged, blocky edge, as if the painter stopped laying the wash there
  const dissolveLeft = (y) => 70 + (y - 1180) * 0.5;
  const dissolveBottom = (x) => 1800 - Math.max(0, 440 - x) * 0.5 - (x > 900 ? (x - 900) * 0.45 : 0);
  G.dissolveLeft = dissolveLeft; G.dissolveBottom = dissolveBottom;
  function paintDissolve() {
    const L = CY.mk(W, H), g = L.g, F = CY.F;
    const img = g.createImageData(W, H), d = img.data;
    // the edge is dragged dry brush: noise stretched along the stroke (horizontal), on top of the paper's tooth
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const fi = y * W + x;
        const left = dissolveLeft(y) - x, bottom = y - dissolveBottom(x);
        const n = (CY.vnoise(x * 0.012, y * 0.09, 501) - 0.5) * 150 + (CY.vnoise(x * 0.05, y * 0.33, 502) - 0.5) * 60 + (F.edge[fi] - 0.5) * 34 + (F.grain[fi] - 0.5) * 22;
        const dd = Math.max(y > 1150 ? left : -999, bottom) + n;
        const i = fi * 4;
        d[i] = 239; d[i + 1] = 231; d[i + 2] = 212; d[i + 3] = CY.sm(-5, 5, dd) * 255;
      }
    }
    g.putImageData(img, 0, 0);
    // a few strokes of the wash that ran out into the paper: blue dry-brush drags at the edge
    const R = CY.rng(502);
    for (let i = 0; i < 60; i++) {
      const y = R.r(1170, 1880), x = dissolveLeft(y) + R.r(-90, 20);
      if (y > 1700 && R.f() < 0.5) continue;
      CY.ink(g, [[x, y], [x - R.r(20, 90), y + R.g() * 3]], { w: R.r(4, 12), col: R.pick([[51, 111, 143], [95, 151, 173], [43, 102, 136]]), a: R.r(0.3, 0.7), dry: 0.65, seed: 503 + i, tin: 0.05, tout: 0.6, nb: 6 });
    }
    for (let i = 0; i < 40; i++) {
      const x = R.r(260, 1060), y = dissolveBottom(x) + R.r(-40, 30);
      CY.ink(g, [[x, y], [x + R.g() * 4, y + R.r(10, 60)]], { w: R.r(4, 12), col: R.pick([[120, 145, 152], [143, 163, 168], [90, 120, 130]]), a: R.r(0.25, 0.6), dry: 0.65, seed: 600 + i, tin: 0.05, tout: 0.6, nb: 6 });
    }
    return L;
  }

  // ------------------------------------------------------------------ seal and brush marks (invented), on the paper
  function paintOver() {
    const L = CY.mk(W, H), g = L.g;
    const R = CY.rng(190);
    // abstract running script: one continuous flowing line of loops; never separate glyphs, so nothing can read
    // as a real character
    const cx = 92, y0 = 1330, y1 = 1530;
    const pts = [];
    let th = R.f() * 6.28;
    for (let v = y0; v < y1; v += 1.6) {
      th += 0.05 + 0.32 * Math.pow(CY.fbm(v * 0.012, 7.1, 197, 2), 2.2);
      const rad = 3 + 7 * CY.fbm(v * 0.02, 3.3, 198, 2);
      pts.push([cx + (CY.fbm(v * 0.006, 5.7, 199, 3) - 0.5) * 22 + Math.cos(th) * rad, v + Math.sin(th) * rad * 0.8]);
    }
    let i = 0;
    while (i < pts.length - 4) {
      const n = R.i(18, 46);
      CY.ink(g, pts.slice(i, Math.min(pts.length, i + n)), { w: R.r(2.4, 4.2), a: 0.8, dry: 0.5, seed: 191 + i, tin: 0.12, tout: 0.4, press: (q) => 0.55 + 0.45 * Math.sin(q * Math.PI * 2.3 + i), wob: 0.4 });
      i += n + R.i(2, 7);
    }
    // the seal: vermilion, uneven, an invented maze-like glyph cut in white
    const sx = 64, sy = y1 + 26, ss = 56;
    CY.gouache(g, CY.rect(sx, sy, ss, ss), {
      col: '#c2352a', rough: 1.1, passes: 3, erode: 0.5, eb: 2, holes: 0.9, grain: 2, mott: 0.22, seed: 193,
      fx: (t, R2) => {
        t.globalCompositeOperation = 'destination-out';
        t.strokeStyle = 'rgba(0,0,0,0.92)'; t.lineCap = 'square'; t.lineWidth = 4.2;
        const c = (u) => sx + 9 + u * ((ss - 18) / 4), r = (v) => sy + 9 + v * ((ss - 18) / 4);
        const strokes = [[[0, 0], [0, 4]], [[0, 0], [2, 0], [2, 2], [1, 2]], [[4, 0], [3, 0], [3, 3], [4, 3], [4, 4], [2, 4]], [[1, 3], [2, 3]], [[0, 4], [1, 4]]];
        for (const s of strokes) { t.beginPath(); s.forEach((p, k) => (k ? t.lineTo(c(p[0]), r(p[1])) : t.moveTo(c(p[0]), r(p[1])))); t.stroke(); }
        t.lineWidth = 3; t.beginPath(); t.arc(c(1), r(1), 3.5, 0, 6.283); t.stroke();
        for (let k = 0; k < 40; k++) { t.fillStyle = 'rgba(0,0,0,0.6)'; t.fillRect(R2.r(sx, sx + ss), R2.r(sy, sy + ss), R2.r(1, 2.5), R2.r(1, 2.5)); }
      },
    });
    L.box = [40, y0 - 20, 120, sy + ss + 20 - (y0 - 20)];
    return L;
  }

  // ------------------------------------------------------------------ moonlight, and the paper
  function paintLight() {
    const L = CY.mk(W, H), g = L.g, m = G.moon;
    const rg = g.createRadialGradient(m.x, m.y, 60, m.x, m.y, 1300);
    rg.addColorStop(0, 'rgba(255,190,120,0.55)'); rg.addColorStop(0.45, 'rgba(250,180,120,0.22)'); rg.addColorStop(1, 'rgba(240,170,120,0)');
    g.fillStyle = rg; g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = 'destination-out';
    CY.path(g, [CY.circle(m.x, m.y, m.r + 6, 80)]); g.fill();
    return L;
  }
  function paintPaper() {
    const L = CY.mk(W, H), g = L.g, F = CY.F;
    const img = g.createImageData(W, H), d = img.data;
    for (let i = 0, p = 0; p < W * H; p++, i += 4) {
      const x = p % W, y = (p / W) | 0;
      const v = 1 - 0.16 * F.grain[p] - 0.07 * F.mot[p];
      const dx = (x - W / 2) / (W / 2), dy = (y - H * 0.47) / (H / 2);
      const vig = 1 - 0.12 * Math.pow(Math.min(1, Math.sqrt(dx * dx * 0.8 + dy * dy * 0.9)), 2.4);
      d[i] = 255 * v * vig; d[i + 1] = 252 * v * vig * 0.995; d[i + 2] = 246 * v * vig * 0.975; d[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    const R = CY.rng(200);
    g.lineCap = 'round';
    for (let i = 0; i < 4200; i++) {
      const x = R.r(0, W), y = R.r(0, H), a = R.f() * 6.283, l = R.r(4, 26);
      g.strokeStyle = `rgba(150,130,105,${R.r(0.05, 0.14).toFixed(3)})`; g.lineWidth = R.r(0.5, 1.1);
      g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a + 0.5) * l * 0.5, y + Math.sin(a + 0.5) * l * 0.5, x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
    }
    return L;
  }
  // the plaster the flowers' shadows may fall on
  let wallMaskL = null;
  function paintWallMask() {
    if (wallMaskL) return wallMaskL;
    const L = CY.mk(W, H), g = L.g;
    g.fillStyle = '#000';
    for (const poly of [F_front.poly, gablePoly, F_usFront.poly, usLeftPoly]) { CY.path(g, [poly]); g.fill(); }
    g.globalCompositeOperation = 'destination-out';
    CY.path(g, [F_lroof.poly]); g.fill();
    CY.path(g, [F_front.quad(DOOR.u0, DOOR.v0, DOOR.u1, DOOR.v1)]); g.fill();
    return (wallMaskL = L);
  }

  // what the animation needs to know, in screen px
  function exportGeometry() {
    const hk = P(2.25, 2.86, -0.55);
    G.hook = { x: hk[0], y: hk[1] };
    G.hookFrom = P(2.25, LR.eaveY - 0.18, LR.eaveZ + 0.05);
    G.lroof = F_lroof.quad(0, 0, F_lroof.w, vAtZ(US.z0));
    const fa = P(0, 0, -0.3), fb = P(10, 0, -0.3);
    G.footY = (x) => fa[1] + ((fb[1] - fa[1]) * (x - fa[0])) / (fb[0] - fa[0]);
    // the sparrow's perch: the upper ridge, against the sky
    const pa = P(4.75, UR.ridgeY + 0.28, UR.ridgeZ), pb = P(4.4, UR.ridgeY + 0.28, UR.ridgeZ);
    G.perch = { x: pa[0], y: pa[1], hop: pb[0] - pa[0], hopY: pb[1] - pa[1] };
    // eaves whose shadows on the walls move with the light
    G.eaveShadow = [
      { F: F_front, v: GF.h, u0: 0, u1: GF.x1, base: 0.5 },
      { F: F_usFront, v: US.h - US.y0, u0: 0, u1: US.x1 - US.x0, base: 0.45 },
    ];
  }

  CY.paintScene = function () {
    const dbg = /[?&]debug/.test(location.search);
    const stage = (name, fn) => { const t0 = performance.now(); fn(); if (dbg) console.log(name, (performance.now() - t0).toFixed(0) + ' ms'); };
    const L = {};
    stage('sky', () => { L.sky = paintSky(); });
    stage('far', () => { L.far = paintFar(); });
    const F = CY.mk(W, H), g = F.g;
    stage('house', () => { paintHouse(g); });
    stage('vine', () => { paintVine(g); });
    L.front = F;
    stage('dissolve', () => { L.dissolve = paintDissolve(); });
    stage('over', () => { L.over = paintOver(); });
    stage('light', () => { L.light = paintLight(); });
    stage('paper', () => { L.paper = paintPaper(); });
    stage('mask', () => { L.wallMask = paintWallMask(); });
    exportGeometry();
    return L;
  };
})();
