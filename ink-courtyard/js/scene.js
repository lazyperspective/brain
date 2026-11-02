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
          t.strokeStyle = rgba(CY.jit(R.pick(['#1a6577', '#23768a', '#145668', '#2b8090', '#0f4f60']), R, 0.06), R.r(0.06, 0.2));
          t.lineWidth = R.r(6, 46);
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
      col: '#f0a24b', rough: 2.6, passes: 3, erode: 0.55, eb: 3, mott: 0.16, holes: 0.5, grain: 1.6, seed: 12,
      fx: (t, R) => {
        const rg = t.createRadialGradient(m.x - 40, m.y - 60, 10, m.x, m.y, m.r);
        rg.addColorStop(0, 'rgba(250,190,105,0.55)'); rg.addColorStop(1, 'rgba(226,128,52,0.3)');
        t.fillStyle = rg; t.fillRect(m.x - m.r, m.y - m.r, m.r * 2, m.r * 2);
        // the limb a touch deeper, a few faint seas, so it reads as a painted moon, not a disc
        const lg = t.createRadialGradient(m.x, m.y, m.r * 0.7, m.x, m.y, m.r);
        lg.addColorStop(0, 'rgba(200,100,40,0)'); lg.addColorStop(1, 'rgba(200,100,40,0.28)');
        t.fillStyle = lg; t.fillRect(m.x - m.r, m.y - m.r, m.r * 2, m.r * 2);
        for (const [dx, dy, rx, ry] of [[-50, -20, 46, 34], [36, 30, 34, 24], [-10, 70, 40, 20], [60, -60, 22, 16]]) { t.fillStyle = rgba('#d9823a', 0.18); CY.path(t, [CY.blob(m.x + dx, m.y + dy, rx, ry, R.i(1, 99), 0.4)]); t.fill(); }
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
      if (s.kind === 'jamb') {
        const u = k ? u1 : u0, hh = v1 - v0;
        // the reveal darkens toward the back of the opening and under its head
        fillPoly(g, [F.at(u, v0, d * 0.45), F.at(u, v1, d * 0.45), F.at(u, v1, d), F.at(u, v0, d)], '#0b1922', 0.32);
        fillPoly(g, [F.at(u, v1 - hh * 0.16), F.at(u, v1), F.at(u, v1, d), F.at(u, v1 - hh * 0.3, d)], '#0b1922', 0.4);
        fillPoly(g, [F.at(u, v0), F.at(u, v0 + hh * 0.12), F.at(u, v0 + hh * 0.1, d), F.at(u, v0, d)], '#0b1922', 0.2);
      }
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

  // the lime-washed walls. Weathering with causes: the wash laid in long low strokes; damp rising from the ground
  // to a ragged tide line; plaster fallen away at the corners, around the openings and along the foot, the stone
  // behind showing; stains run down from the eave; cracks start from the openings' corners.
  function plaster(g, F, polys, o) {
    const vmax = o.vmax || F.h, A = F.w * vmax, op = o.openings || [];
    const uvPoly = (pts) => pts.map(([u, v]) => F.at(u, v));
    CY.gouache(g, polys, {
      col: o.base, rough: 2.2, passes: 2, erode: 0.5, eb: 3, seed: o.seed, mott: 0.22, grain: 1.2, rule: 'evenodd',
      fx: (t, R) => {
        // the wash, in long low strokes
        dabs(t, R, F, A * 9, { u: [-0.6, F.w], v: [-0.2, vmax], du: [0.6, 2.4], dv: [0.05, 0.2], cols: o.cols, a: [0.16, 0.4], jit: 2.2 });
        dabs(t, R, F, A * 2, { u: [-0.6, F.w], v: [vmax * 0.35, vmax], du: [0.3, 1.2], dv: [0.08, 0.3], cols: o.fresh || o.cols, a: [0.15, 0.35], jit: 3 });
        // rising damp: darker below a ragged tide line, a pale salt bloom just above it
        const damp = o.damp || 0.9, tide = [];
        for (let u = -0.4; u <= F.w + 0.4; u += 0.08) tide.push([u, damp + 0.32 * (CY.vnoise(u * 1.1, 1.5, o.seed) - 0.5) + 0.1 * (CY.vnoise(u * 4.5, 2.5, o.seed) - 0.5)]);
        fillPoly(t, uvPoly(tide.concat([[F.w + 0.4, -0.2], [-0.4, -0.2]])), o.dark[1], 0.38);
        fillPoly(t, uvPoly(tide.map(([u, v]) => [u, v * 0.55]).concat([[F.w + 0.4, -0.2], [-0.4, -0.2]])), o.dark[0], 0.22);
        CY.ink(t, uvPoly(tide.map(([u, v]) => [u, v + 0.04])), { w: 4, col: CY.C(o.lime[1]), a: 0.14, dry: 0.75, seed: o.seed + 5, nb: 4, tin: 0.02, tout: 0.02, wob: 1 });
        // where the plaster has fallen away
        const spots = [];
        const add = (u, v, ru, rv) => spots.push([u, v, ru, rv]);
        add(R.r(0, 0.3), R.r(0.3, damp + 0.4), R.r(0.3, 0.6), R.r(0.25, 0.55));
        add(F.w - R.r(0, 0.3), R.r(0.6, vmax - 0.4), R.r(0.25, 0.5), R.r(0.3, 0.6));
        for (const w of op) { add(w.u1 + R.r(0.05, 0.3), w.v1 + R.r(-0.2, 0.25), R.r(0.2, 0.45), R.r(0.15, 0.35)); if (R.f() < 0.7) add(w.u0 - R.r(0.05, 0.3), w.v0 + R.r(-0.25, 0.3), R.r(0.18, 0.4), R.r(0.15, 0.32)); }
        for (let k = 0; k < (o.extra || 2); k++) add(R.r(0.5, F.w - 0.5), R.r(0.15, vmax * 0.8), R.r(0.18, 0.5), R.r(0.12, 0.35));
        spots.forEach(([u, v, ru, rv], k) => {
          const bl = CY.blob(u, v, ru, rv, o.seed * 13 + k, 0.5, 13).map(([a2, b3]) => [a2 + R.g() * ru * 0.13, b3 + R.g() * rv * 0.13]); // plaster breaks in angular chunks
          const sp = uvPoly(bl);
          t.save(); CY.path(t, [sp]); t.clip();
          fillPoly(t, uvPoly([[u - ru * 1.5, v - rv * 1.5], [u + ru * 1.5, v - rv * 1.5], [u + ru * 1.5, v + rv * 1.5], [u - ru * 1.5, v + rv * 1.5]]), '#4a585c', 1);
          for (let vv = v - rv * 1.4; vv < v + rv * 1.4;) {
            // rubble stone laid in rough courses: every stone its own size, none square
            const rh = R.r(0.12, 0.22);
            for (let uu = u - ru * 1.5 - R.r(0, 0.3); uu < u + ru * 1.5;) {
              const du = R.r(0.14, 0.46), sh = rh * R.r(0.6, 1), dy = R.r(0, rh - sh);
              const q = F.quad(uu + 0.02, vv + dy + 0.02, uu + du - 0.02, vv + dy + sh - 0.02);
              for (const p of q) { p[0] += R.g() * 2.4; p[1] += R.g() * 2.4; }
              fillPoly(t, q, CY.jit(R.pick(o.stoneCols), R, 0.12), R.r(0.75, 0.95));
              fillPoly(t, F.quad(uu + 0.03, vv + dy + sh - 0.06, uu + du * R.r(0.4, 0.9), vv + dy + sh - 0.025), '#d6dcd4', R.r(0.04, 0.14));
              uu += du;
            }
            vv += rh;
          }
          t.restore();
          // the broken edge of the plaster: a pale rim, its shadow falling inside
          t.lineJoin = 'round';
          t.strokeStyle = rgba('#0b1a24', 0.28); t.lineWidth = 3; t.beginPath(); uvPoly(bl.map(([a, b2]) => [a + 0.02, b2 - 0.03])).forEach((p, j) => (j ? t.lineTo(p[0], p[1]) : t.moveTo(p[0], p[1]))); t.closePath(); t.stroke();
          CY.ink(t, sp.concat([sp[0]]), { w: 2, col: CY.C(R.pick(o.lime)), a: 0.5, dry: 0.55, seed: o.seed * 31 + k, nb: 3, tin: 0.02, tout: 0.05, wob: 0.6 });
        });
        // stains from the eave: long soft runs
        t.lineCap = 'round';
        for (let i = 0; i < F.w * 3; i++) {
          const u = R.r(0, F.w), v1 = vmax - R.r(0, 0.15), v2 = v1 - R.r(0.4, 1.8);
          const a = F.at(u, v1), b2 = F.at(u + R.g() * 0.02, v2);
          t.strokeStyle = rgba(R.pick(o.dark), R.r(0.06, 0.16)); t.lineWidth = R.r(3, 12);
          t.beginPath(); t.moveTo(a[0], a[1]); t.lineTo(b2[0], b2[1]); t.stroke();
        }
      },
    });
    // cracks from the openings' upper corners, and one or two wandering ones
    const RC = CY.rng(o.seed + 77);
    for (const w of op) {
      const a = F.at(w.u1, w.v1), b2 = F.at(w.u1 + 0.3, w.v1 + 0.3);
      CY.crack(g, a[0], a[1], Math.atan2(b2[1] - a[1], b2[0] - a[0]) + RC.g() * 0.2, RC.r(30, 70), o.seed + 78, { w: 1.1, a: 0.55, col: [16, 32, 44] });
      if (RC.f() < 0.6) { const c = F.at(w.u0, w.v1), d2 = F.at(w.u0 - 0.3, w.v1 + 0.3); CY.crack(g, c[0], c[1], Math.atan2(d2[1] - c[1], d2[0] - c[0]) + RC.g() * 0.2, RC.r(25, 55), o.seed + 79, { w: 1, a: 0.5, col: [16, 32, 44] }); }
    }
  }

  // a tiled roof slope, pan and cover: columns run down the slope, a dark channel of concave pan tiles between
  // rounded cover tiles, every course ending in a curved lip with its shadow under it. Returns the columns, so the
  // eave can end each cover column with a round end tile and each channel with a pointed drip tile.
  function tiles(g, F, polys, o) {
    const pitch = o.pitch || 0.24, cw = pitch * 0.48, rowH = o.row || 0.24;
    const cols = [];
    for (let u = -R0(o.seed).r(0, pitch); u < F.w + pitch; u += pitch * (1 + R0(o.seed + u * 100).g() * 0.05)) cols.push(u);
    CY.gouache(g, polys, {
      col: '#1a2227', rough: 1.4, passes: 2, erode: 0.35, seed: o.seed, mott: 0.12, rule: 'evenodd',
      fx: (t, R) => {
        // the channels: pan tiles, their lower ends showing as pale arcs in the dark
        for (let i = 0; i < cols.length - 1; i++) {
          const u0 = cols[i] + cw / 2, u1 = cols[i + 1] - cw / 2;
          fillPoly(t, F.quad(u0, 0, u1, F.h), CY.jit(o.pan || '#2b353b', R, 0.1), 1);
          for (let v = R.r(0, rowH); v < F.h; v += rowH * (1 + R.g() * 0.08)) {
            const arc = []; for (let k = 0; k <= 6; k++) { const q = k / 6; arc.push(F.at(u0 + (u1 - u0) * q, v - 0.035 * Math.sin(q * Math.PI))); }
            t.strokeStyle = rgba(R.pick(o.lit), R.r(0.12, 0.3)); t.lineWidth = 1.2; t.beginPath(); arc.forEach((p, k) => (k ? t.lineTo(p[0], p[1]) : t.moveTo(p[0], p[1]))); t.stroke();
          }
        }
        // the cover tiles: a rounded column, lit on the moon's side, a course at a time from the eave up
        for (let i = 0; i < cols.length; i++) {
          const uc = cols[i], u0 = uc - cw / 2, u1 = uc + cw / 2;
          let v = -0.02 - R.r(0, rowH * 0.5);
          while (v < F.h) {
            const h = rowH * R.r(0.92, 1.1);
            const warm = R.f() < 0.16, base = CY.jit(warm ? R.pick(o.warm) : R.pick(o.cols), R, 0.09);
            const body = F.quad(u0, v, u1, v + h * 1.25);
            for (const p of body) { p[0] += R.g() * 0.5; p[1] += R.g() * 0.5; }
            fillPoly(t, body, base, 1);
            fillPoly(t, F.quad(u0 + cw * 0.08, v + 0.02, u0 + cw * 0.42, v + h * 1.2), R.pick(o.lit), R.r(0.25, 0.5)); // lit flank
            fillPoly(t, F.quad(u1 - cw * 0.25, v, u1, v + h * 1.25), '#0b1115', R.r(0.3, 0.5)); // shaded flank
            // the lip: a little curved edge, pale, with a dark shadow under it on the tile below
            const lip = [], sh = [];
            for (let k = 0; k <= 8; k++) { const q = k / 8, u = u0 + (u1 - u0) * q, b = 0.03 * Math.sin(q * Math.PI); lip.push(F.at(u, v - b)); sh.push(F.at(u, v - b - 0.05)); }
            fillPoly(t, lip.concat(sh.slice().reverse()), '#05090c', R.r(0.45, 0.75));
            t.strokeStyle = rgba(R.pick(o.lit), R.r(0.35, 0.7)); t.lineWidth = 1.3; t.beginPath(); lip.forEach((p, k) => (k ? t.lineTo(p[0], p[1]) : t.moveTo(p[0], p[1]))); t.stroke();
            if (R.f() < 0.035) fillPoly(t, F.quad(u0, v + h * 0.3, u1, v + h * 1.1), '#0a0f12', 0.85); // a lost tile, the channel showing
            if (R.f() < 0.05) fillPoly(t, F.quad(u0 + 0.01, v + h * 0.2, u1 - 0.01, v + h * 0.9), R.pick(['#5f6d45', '#77804f', '#4f5a3c']), R.r(0.4, 0.7)); // moss
            v += h;
          }
        }
        // a few tufts of grass in the channels, and the slope darkening away from the moon toward the ridge
        for (let k = 0; k < F.w * 0.6; k++) {
          const u = R.pick(cols) + pitch / 2, v = R.r(F.h * 0.3, F.h), a = F.at(u, v);
          for (let j = 0; j < 5; j++) { t.strokeStyle = rgba(R.pick(['#6b7a48', '#8a925a', '#4d5a36']), 0.8); t.lineWidth = 1.2; t.beginPath(); t.moveTo(a[0], a[1]); t.lineTo(a[0] + R.g() * 4, a[1] - R.r(5, 12)); t.stroke(); }
        }
        fillPoly(t, F.quad(0, F.h * 0.5, F.w, F.h), '#060b10', 0.22);
      },
    });
    return { cols, cw };
  }
  const R0 = (s) => CY.rng(Math.round(s * 7919) | 0);
  // the eave: a dark board, a round end tile on every cover column (an invented whorl on each, worn), a pointed
  // drip tile under every channel
  function eaveEdge(g, F, cols, seed) {
    const R = CY.rng(seed);
    const y = F.O[1], z = F.O[2], x0 = F.O[0];
    const fas = [P(x0, y, z), P(x0 + F.w, y, z), P(x0 + F.w, y - 0.17, z), P(x0, y - 0.17, z)];
    CY.gouache(g, fas, { col: '#151d22', rough: 0.8, passes: 2, erode: 0.3, seed, mott: 0.15 });
    const { cols: cs, cw } = cols;
    for (let i = 0; i < cs.length - 1; i++) {
      const xm = x0 + (cs[i] + cs[i + 1]) / 2;
      if (xm < x0 || xm > x0 + F.w) continue;
      const hw = (cs[i + 1] - cs[i] - cw) * 0.55;
      fillPoly(g, [P(xm - hw, y - 0.01, z - 0.01), P(xm + hw, y - 0.01, z - 0.01), P(xm + hw * 0.4, y - 0.11, z - 0.01), P(xm, y - 0.15, z - 0.01), P(xm - hw * 0.4, y - 0.11, z - 0.01)], CY.jit('#323c42', R, 0.1), 1);
    }
    for (const u of cs) {
      const x = x0 + u;
      if (x < x0 + 0.02 || x > x0 + F.w - 0.02) continue;
      const r = cw * 0.52 * R.r(0.92, 1.06), cy = y - 0.005 + R.g() * 0.008;
      if (R.f() < 0.05) continue; // lost
      const ring = []; for (let k = 0; k < 16; k++) { const a = (k / 16) * 6.283; ring.push(P(x + Math.cos(a) * r, cy + Math.sin(a) * r, z - 0.02)); }
      fillPoly(g, ring, CY.jit(R.pick(['#3a454b', '#434e54', '#30393e']), R, 0.1), 1);
      // moonlight on its upper left rim only
      const arc = []; for (let k = 0; k <= 6; k++) { const a = Math.PI * (0.5 + k * 0.08); arc.push(P(x + Math.cos(a) * r * 0.86, cy + Math.sin(a) * r * 0.86, z - 0.025)); }
      g.strokeStyle = rgba('#9fb2b6', 0.55); g.lineWidth = 1.2; g.beginPath(); arc.forEach((p, k) => (k ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.stroke();
      if (R.f() < 0.7) { const c = P(x, cy, z - 0.025), s2 = ppm(x, z) * r * 0.45; g.strokeStyle = rgba('#1a2125', 0.6); g.lineWidth = 1; g.beginPath(); g.arc(c[0], c[1], s2, R.r(0, 3), R.r(3.5, 6)); g.stroke(); }
    }
  }
  // a ridge: a lumpy built-up mass of tiles set on edge, capped, with a solid sweep up at the open end
  function ridge(g, x0, x1, y, z, seed, curl) {
    const R = CY.rng(seed), hgt = 0.36;
    const F = face([x0, y - 0.06, z], [1, 0, 0], [0, 1, 0], x1 - x0, hgt);
    // an uneven top line: it has settled
    const topV = (u) => hgt + 0.025 * (CY.vnoise(u * 1.6, 0.5, seed) - 0.5) * 2;
    const outline = [F.at(0, 0)];
    for (let u = 0; u <= F.w + 0.001; u += 0.1) outline.push(F.at(u, topV(u)));
    outline.push(F.at(F.w, 0));
    CY.gouache(g, outline, { col: '#20292e', rough: 1, passes: 2, erode: 0.3, seed, mott: 0.18, fx: (t, R2) => {
      // tiles stacked on edge, leaning, in irregular runs
      let lean = 0.5;
      for (let u = 0; u < F.w;) {
        const w = R2.r(0.05, 0.09);
        if (R2.f() < 0.06) lean = -lean;
        const q = [F.at(u, 0.06), F.at(u + w * 0.7, 0.06), F.at(u + w * 0.7 + lean * 0.06, topV(u) - 0.09), F.at(u + lean * 0.06, topV(u) - 0.09)];
        fillPoly(t, q, R2.pick(['#3b464c', '#2e373c', '#4a555a', '#343e43']), R2.r(0.6, 0.95));
        u += w;
      }
      // the cap: a row of half-round tiles, their lips catching the moon
      for (let u = 0; u < F.w; u += R2.r(0.2, 0.26)) {
        const cap = []; for (let k = 0; k <= 8; k++) { const q = k / 8; cap.push(F.at(u + q * 0.24, topV(u) - 0.075 + 0.07 * Math.sin(q * Math.PI))); }
        cap.push(F.at(u + 0.24, topV(u) - 0.09), F.at(u, topV(u) - 0.09));
        fillPoly(t, cap, R2.pick(['#4c585e', '#56626a', '#434e54']), 1);
      }
      fillPoly(t, F.quad(0, 0, F.w, 0.07), '#0c1114', 0.6);
    } });
    const top = []; for (let u = 0; u <= F.w; u += 0.1) top.push(F.at(u, topV(u)));
    ink(g, top, { w: 2.4, a: 0.75, dry: 0.5, seed: seed + 1, tin: 0.01, tout: 0.01, wob: 0.8 });
    if (curl) {
      // the ridge end sweeps up: a solid horn, thick at the root, tapering to a point, its top edge lit
      const s = ppm(x0, z), b0 = F.at(0.02, 0.06), b1 = F.at(0.02, topV(0));
      const cl = [], len = 0.75 * s;
      for (let k = 0; k <= 24; k++) {
        const q = k / 24;
        cl.push([b0[0] - q * len * 0.62 - Math.sin(q * 1.2) * 0.04 * s, (b0[1] + b1[1]) / 2 - Math.pow(q, 2.1) * len * 0.78]);
      }
      const wid = (q) => (b0[1] - b1[1]) * 0.55 * Math.pow(1 - q, 1.3) + 1.2;
      const upper = cl.map((p, k) => { const q = k / 24, n = k < 24 ? [cl[k + 1][1] - p[1], -(cl[k + 1][0] - p[0])] : [cl[k][1] - cl[k - 1][1], -(cl[k][0] - cl[k - 1][0])], l = Math.hypot(n[0], n[1]) || 1; return [p[0] + (n[0] / l) * wid(q), p[1] + (n[1] / l) * wid(q)]; });
      const lower = cl.map((p, k) => { const q = k / 24, n = k < 24 ? [cl[k + 1][1] - p[1], -(cl[k + 1][0] - p[0])] : [cl[k][1] - cl[k - 1][1], -(cl[k][0] - cl[k - 1][0])], l = Math.hypot(n[0], n[1]) || 1; return [p[0] - (n[0] / l) * wid(q), p[1] - (n[1] / l) * wid(q)]; });
      const horn = upper.concat(lower.slice().reverse());
      CY.gouache(g, horn, { col: '#20292e', rough: 0.6, passes: 2, erode: 0.2, seed: seed + 3, pad: 6 });
      ink(g, upper.slice(2), { w: 1.8, col: [150, 172, 178], a: 0.5, dry: 0.5, seed: seed + 4, nb: 2, tin: 0.05, tout: 0.4 });
      ink(g, lower, { w: 2.2, a: 0.8, dry: 0.4, seed: seed + 2, tin: 0.05, tout: 0.5 });
      void R;
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
    const bc = tiles(g, bR, [bR.poly], { seed: 22, row: 0.3, pitch: 0.3, cols: ['#3a4a52', '#46565e', '#2f3c43'], warm: ['#5b5550', '#4f4a48'], lit: ['#7d8e94'] });
    ridge(g, bx0 - 0.4, bx1 + 0.4, brY, brZ, 24, false);
    eaveEdge(g, bR, bc, 25);
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
  const LIT = { base: '#5f97ad', cols: ['#77abbe', '#5a91a8', '#8fbccb', '#4b839d', '#6aa1b5'], fresh: ['#9cc6d3', '#86b8c8'], lime: ['#d9e6e1', '#eef0e4', '#b9d4d8'], dark: ['#2a5670', '#3d6276', '#5b7a80'], stoneCols: ['#7d8c8c', '#8f9893', '#6f8288', '#9a9a8e', '#848a84', '#a39a88'] };
  const SHADE = { base: '#336f8f', cols: ['#2b6688', '#3f7fa0', '#4d8eac', '#245b7c', '#5f9ab4', '#1f5272'], fresh: ['#5a98b6', '#4d8fae'], lime: ['#a9c9d2', '#c9dcd9', '#88b4c4'], dark: ['#173a52', '#12324a', '#3a5560'], stoneCols: ['#5f737a', '#6f7c7c', '#56686f', '#7d8580', '#677276', '#8a8274'] };
  const TILE_COLS = ['#4d5a62', '#5b676e', '#414d55', '#66737a', '#53606a'], TILE_WARM = ['#806a5c', '#8c624c', '#71665d', '#9a7058'], TILE_LIT = ['#a9bbc1', '#ccd2cb'];

  function paintHouse(g) {
    // --- the ground floor: gable end (moonlit) and front
    plaster(g, F_gable, [gablePoly, F_gable.quad(WIN3.u0, WIN3.v0, WIN3.u1, WIN3.v1)], Object.assign({ seed: 301, vmax: 4.9, openings: [WIN3], extra: 3 }, LIT));
    recess(g, F_gable, WIN3, 320, windowBack(F_gable, WIN3, 6), true);
    plaster(g, F_front, [F_front.poly, F_front.quad(DOOR.u0, DOOR.v0, DOOR.u1, DOOR.v1), F_front.quad(WIN1.u0, WIN1.v0, WIN1.u1, WIN1.v1)], Object.assign({ seed: 302, openings: [WIN1, DOOR], extra: 3 }, SHADE));
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
    // the door's surround: faded red paper strips pasted either side and over the lintel, their brushwork
    // reduced to a few round dabs (no strokes that could make a character)
    const RD = CY.rng(339);
    const strip = (q0, seed, n, horiz) => {
      // pasted by hand: a little crooked, over the faded ghost of last year's strip, the bottom torn
      const q = q0.map((p) => [p[0] + RD.g() * 2.5, p[1] + RD.g() * 2.5]);
      if (!horiz) { const b0 = q[3], b1 = q[2]; const torn = []; for (let k = 0; k <= 6; k++) { const u = k / 6; torn.push([b0[0] + (b1[0] - b0[0]) * u, b0[1] + (b1[1] - b0[1]) * u - RD.r(0, 22) * (k % 2)]); } q.splice(2, 2, ...torn.reverse()); }
      const ghost = q0.map((p, k) => [p[0] + (k % 3 ? 7 : -4), p[1] + (k < 2 ? -10 : 18)]);
      CY.gouache(g, ghost, { col: '#c4968a', rough: 1.6, passes: 2, erode: 1, eb: 3, holes: 1.6, seed: seed + 50, a: 0.35, mott: 0.5, grain: 2 });
      CY.gouache(g, q, { col: '#9c3a2e', rough: 1.4, passes: 3, erode: 0.9, eb: 3, holes: 1.4, seed, a: 0.78, mott: 0.45, grain: 2,
        fx: (t, R4) => { t.fillStyle = 'rgba(214,160,130,0.22)'; t.fillRect(0, 0, W, H); for (let i = 0; i < 30; i++) { t.fillStyle = rgba(R4.pick(['#c8a088', '#6e2a22', '#d9b49a']), R4.r(0.1, 0.35)); t.fillRect(R4.r(0, W), R4.r(0, H), R4.r(2, 9), R4.r(4, 26)); } } });
      for (let k = 0; k < n; k++) {
        const u = (k + 0.5) / n, c = horiz ? [q[0][0] + (q[1][0] - q[0][0]) * u, (q[0][1] + q[3][1]) / 2 + (q[1][1] - q[0][1]) * u] : [(q[0][0] + q[1][0]) / 2 + (q[3][0] - q[0][0]) * u, q[0][1] + (q[3][1] - q[0][1]) * u];
        g.fillStyle = rgba('#2a1512', RD.r(0.35, 0.6)); g.beginPath(); g.ellipse(c[0] + RD.g(), c[1] + RD.g(), RD.r(3, 6), RD.r(3, 5.5), RD.f() * 3, 0, 6.283); g.fill();
      }
    };
    strip(F_front.quad(DOOR.u0 - 0.36, 0.95, DOOR.u0 - 0.1, 2.6, -0.005), 335, 6);
    strip(F_front.quad(DOOR.u1 + 0.1, 0.95, DOOR.u1 + 0.36, 2.6, -0.005), 336, 6);
    recess(g, F_front, DOOR, 340, (g2, q, seed) => {
      // two leaves of old boards in a heavy frame, iron studs in rows, knockers; paler and scuffed low down
      const F2 = face(F_front.W3(DOOR.u0, DOOR.v0, DOOR.d), [1, 0, 0], [0, 1, 0], DOOR.u1 - DOOR.u0, DOOR.v1 - DOOR.v0);
      CY.gouache(g2, q, { col: '#1c262c', rough: 0.6, passes: 2, erode: 0.2, seed, mott: 0.2, fx: (t, R2) => {
        for (let u = 0.1; u < F2.w - 0.1;) {
          const bw = R2.r(0.12, 0.17), col = CY.jit(R2.pick(['#2c3c45', '#33454f', '#283740', '#3a4d57', '#2f4049']), R2, 0.07);
          fillPoly(t, F2.quad(u + 0.006, 0, u + bw - 0.006, F2.h), col, 0.95);
          for (let k = 0; k < 4; k++) { const uu = u + R2.r(0.02, bw - 0.02), a = F2.at(uu, R2.r(0, 0.6)), b2 = F2.at(uu + R2.g() * 0.01, R2.r(1.2, F2.h)); t.strokeStyle = rgba(R2.pick(['#4c616b', '#1a242a']), R2.r(0.15, 0.35)); t.lineWidth = R2.r(0.8, 1.6); t.beginPath(); t.moveTo(a[0], a[1]); t.lineTo(b2[0], b2[1]); t.stroke(); }
          u += bw;
        }
        // scuffed, rain-splashed foot
        dabs(t, R2, F2, 14, { u: [0, F2.w], v: [0, 0.4], du: [0.03, 0.12], dv: [0.01, 0.05], cols: ['#6d838c', '#57707a', '#8a9ea4'], a: [0.1, 0.28], jit: 1.5 });
        // frame: posts and head, heavier timber, lit on the moon side
        for (const [u0, u1] of [[0, 0.1], [F2.w - 0.1, F2.w]]) { fillPoly(t, F2.quad(u0, 0, u1, F2.h), '#20292e', 1); fillPoly(t, F2.quad(u0 + 0.01, 0, u0 + 0.03, F2.h), '#6f8790', 0.35); }
        fillPoly(t, F2.quad(0, F2.h - 0.12, F2.w, F2.h), '#1a2328', 1);
      } });
      const mid = F2.w / 2;
      ink(g2, [F2.at(mid, 0), F2.at(mid, F2.h - 0.12)], { w: 2.2, a: 0.9, dry: 0.25, seed: seed + 3 });
      // iron studs in rows on each leaf
      const R3 = CY.rng(seed + 9);
      for (let r = 0; r < 5; r++) for (const side of [0, 1]) for (let c = 0; c < 4; c++) {
        const u = (side ? mid + 0.08 : 0.16) + c * ((mid - 0.24) / 3), v = 0.35 + r * 0.38, p = F2.at(u, v), rr = ppm(DOOR.u0 + u, DOOR.d) * 0.018;
        g2.fillStyle = rgba('#0d1215', 0.9); g2.beginPath(); g2.arc(p[0], p[1], rr, 0, 6.283); g2.fill();
        if (R3.f() < 0.8) { g2.fillStyle = rgba('#8fa0a4', 0.5); g2.beginPath(); g2.arc(p[0] - rr * 0.35, p[1] - rr * 0.35, rr * 0.4, 0, 6.283); g2.fill(); }
      }
      // knockers: round backplates and dull bronze rings
      for (const sd of [-1, 1]) {
        const c = F2.at(mid + sd * 0.1, 1.15), rp = ppm(DOOR.u0 + 0.8, DOOR.d) * 0.055;
        g2.fillStyle = rgba('#3b3426', 0.95); g2.beginPath(); g2.arc(c[0], c[1], rp, 0, 6.283); g2.fill();
        g2.strokeStyle = rgba('#a88a52', 0.6); g2.lineWidth = 1.2; g2.beginPath(); g2.arc(c[0], c[1], rp * 0.85, 3.4, 5.2); g2.stroke();
        ink(g2, CY.circle(c[0], c[1] + rp * 1.25, rp * 0.95, 20).concat([[c[0] + rp * 0.95, c[1] + rp * 1.25]]), { w: 2, a: 0.85, dry: 0.15, seed: seed + 5 + sd, tin: 0.02, tout: 0.04, col: [150, 120, 72] });
      }
    });
    // the lintel beam over the door, and the red strip pasted across it
    fillPoly(g, F_front.quad(DOOR.u0 - 0.3, DOOR.v1, DOOR.u1 + 0.3, DOOR.v1 + 0.2, -0.04), '#1f2a30', 0.97);
    fillPoly(g, F_front.quad(DOOR.u0 - 0.3, DOOR.v1 + 0.15, DOOR.u1 + 0.3, DOOR.v1 + 0.2, -0.04), '#7f9aa3', 0.35);
    ink(g, [F_front.at(DOOR.u0 - 0.3, DOOR.v1, -0.04), F_front.at(DOOR.u1 + 0.3, DOOR.v1, -0.04)], { w: 2, a: 0.8, dry: 0.4, seed: 345 });
    for (const sd of [0, 1]) { const u = sd ? DOOR.u1 + 0.3 : DOOR.u0 - 0.3; fillPoly(g, [F_front.at(u, DOOR.v1, -0.04), F_front.at(u, DOOR.v1 + 0.2, -0.04), F_front.at(u, DOOR.v1 + 0.2, 0), F_front.at(u, DOOR.v1, 0)], '#111a1f', 0.9); }
    strip(F_front.quad(DOOR.u0 + 0.25, DOOR.v1 + 0.24, DOOR.u1 - 0.25, DOOR.v1 + 0.48, -0.005), 337, 4, true);

    // --- the upper storey, set back on the lower roof
    plaster(g, F_usLeft, [usLeftPoly], Object.assign({ seed: 350, vmax: 4.3, damp: 0.55, extra: 2 }, LIT));
    const W2 = { u0: WIN2.u0 - US.x0, u1: WIN2.u1 - US.x0, v0: WIN2.v0 - US.y0, v1: WIN2.v1 - US.y0, d: WIN2.d };
    plaster(g, F_usFront, [F_usFront.poly, F_usFront.quad(W2.u0, W2.v0, W2.u1, W2.v1)], Object.assign({ seed: 351, damp: 0.75, openings: [W2], extra: 2 }, SHADE));
    recess(g, F_usFront, W2, 360, windowBack(F_usFront, W2, 7));
    ink(g, [P(US.x0, US.y0, US.z0), P(US.x0, US.h, US.z0)], { w: 3, a: 0.85, dry: 0.5, seed: 361, dbl: 1.3, tin: 0.02, tout: 0.05, wob: 1 });
    // the soffit under the upper eave: dark boards and rafter ends, seen from below
    const sof = [P(UR.x0, UR.eaveY, UR.eaveZ), P(UR.x1, UR.eaveY, UR.eaveZ), P(UR.x1, US.h, US.z0), P(US.x0, US.h, US.z0), P(UR.x0, UR.eaveY + 0.05, US.z0)];
    CY.gouache(g, sof, { col: '#1b252b', rough: 0.8, passes: 2, erode: 0.25, seed: 362, mott: 0.15 });
    for (let x = UR.x0 + 0.15; x < UR.x1; x += 0.32) {
      ink(g, [P(x, UR.eaveY - 0.02, UR.eaveZ + 0.05), P(x, US.h - 0.04, US.z0)], { w: 3.4, col: [58, 72, 80], a: 0.85, dry: 0.3, seed: 363 + Math.round(x * 10), nb: 3, tin: 0.05, tout: 0.05 });
    }
    // under both halves of the upper gable's overhang: boards, and the purlins running out from the wall to the
    // barge board, each a beam with its underside, its face and its end grain
    const bEZ = UR.ridgeZ + (UR.ridgeZ - UR.eaveZ), sl = (UR.ridgeY - UR.eaveY) / (UR.ridgeZ - UR.eaveZ);
    const yUnder = (z) => (z <= UR.ridgeZ ? UR.eaveY + (z - UR.eaveZ) * sl : UR.ridgeY - (z - UR.ridgeZ) * sl) - 0.06;
    const sofPoly = [P(UR.x0, yUnder(UR.eaveZ), UR.eaveZ), P(UR.x0, yUnder(UR.ridgeZ), UR.ridgeZ), P(UR.x0, yUnder(bEZ), bEZ), P(US.x0, yUnder(US.z1), US.z1), P(US.x0, yUnder(UR.ridgeZ) - 0.1, UR.ridgeZ), P(US.x0, yUnder(US.z0), US.z0)];
    CY.gouache(g, sofPoly, { col: '#38403f', rough: 0.8, passes: 2, erode: 0.25, seed: 364, mott: 0.22, fx: (t, R2) => {
      for (let z = UR.eaveZ + 0.05; z < bEZ; z += R2.r(0.11, 0.16)) { const a2 = P(UR.x0, yUnder(z), z), b2 = P(US.x0, yUnder(z), z); t.strokeStyle = rgba(R2.pick(['#1e2424', '#4a524f']), R2.r(0.25, 0.5)); t.lineWidth = R2.r(1, 2.2); t.beginPath(); t.moveTo(a2[0], a2[1]); t.lineTo(b2[0], b2[1]); t.stroke(); }
      t.fillStyle = 'rgba(10,16,20,0.35)'; CY.path(t, [[P(US.x0, yUnder(US.z0), US.z0), P(US.x0, yUnder(UR.ridgeZ) - 0.1, UR.ridgeZ), P(US.x0, yUnder(US.z1), US.z1), P(US.x0 - 0.25, yUnder(US.z1), US.z1), P(US.x0 - 0.25, yUnder(US.z0), US.z0)]]); t.fill();
    } });
    for (const z of [UR.ridgeZ, UR.ridgeZ - 1.0, UR.ridgeZ - 2.0, UR.ridgeZ + 1.0, UR.ridgeZ + 2.0]) {
      const yb = yUnder(z) - 0.02, h = 0.17, wz = 0.08, x1 = UR.x0 - 0.06;
      const under = [P(US.x0, yb - h, z - wz), P(x1, yb - h, z - wz), P(x1, yb - h, z + wz), P(US.x0, yb - h, z + wz)];
      const side = [P(US.x0, yb, z - wz), P(x1, yb, z - wz), P(x1, yb - h, z - wz), P(US.x0, yb - h, z - wz)];
      const end = [P(x1, yb, z - wz), P(x1, yb, z + wz), P(x1, yb - h, z + wz), P(x1, yb - h, z - wz)];
      CY.gouache(g, side, { col: '#3b2f27', rough: 0.4, passes: 2, erode: 0.2, seed: 383 + Math.round(z * 10), mott: 0.2, pad: 4 });
      fillPoly(g, under, '#251c18', 0.95);
      CY.gouache(g, end, { col: '#7a644e', rough: 0.4, passes: 2, erode: 0.2, seed: 390 + Math.round(z * 10), mott: 0.25, pad: 4 });
      ink(g, side.concat([side[0]]), { w: 1.2, a: 0.6, dry: 0.4, seed: 395 + Math.round(z * 10), nb: 2 });
    }
    // the barge board of the back slope
    CY.gouache(g, [P(UR.x0, UR.ridgeY + 0.05, UR.ridgeZ), P(UR.x0, UR.eaveY + 0.05, bEZ), P(UR.x0, UR.eaveY - 0.18, bEZ), P(UR.x0, UR.ridgeY - 0.17, UR.ridgeZ)], { col: '#20292f', rough: 0.6, passes: 2, erode: 0.2, seed: 381 });
    ink(g, [P(UR.x0, UR.ridgeY + 0.06, UR.ridgeZ), P(UR.x0, UR.eaveY + 0.06, bEZ)], { w: 2.6, a: 0.8, dry: 0.4, seed: 382, tin: 0.02, tout: 0.1 });
    // the upper roof
    const ucols = tiles(g, F_uroof, [F_uroof.poly], { seed: 365, row: 0.22, cols: ['#46535b', '#55626a', '#3a464e', '#606b70', '#4d5960'], warm: ['#7b6457', '#8a5e48', '#6d625a', '#946b52'], lit: ['#9fb1b8', '#c2c9c3'] });
    CY.gouache(g, [P(UR.x0, UR.eaveY, UR.eaveZ), P(UR.x0, UR.ridgeY + 0.05, UR.ridgeZ), P(UR.x0, UR.ridgeY - 0.17, UR.ridgeZ), P(UR.x0, UR.eaveY - 0.22, UR.eaveZ)], { col: '#20292f', rough: 0.6, passes: 2, erode: 0.2, seed: 366 });
    ink(g, [P(UR.x0, UR.eaveY + 0.02, UR.eaveZ), P(UR.x0, UR.ridgeY + 0.06, UR.ridgeZ)], { w: 3, a: 0.85, dry: 0.4, seed: 367, dbl: 1, tin: 0.02, tout: 0.05 });
    eaveEdge(g, F_uroof, ucols, 368);
    ridge(g, UR.x0 - 0.1, UR.x1, UR.ridgeY, UR.ridgeZ, 369, true);

    // --- the lower roof, in two parts: beside the upper storey, then the full width in front of it
    const vB = vAtZ(US.z0);
    tiles(g, F_lroof, [F_lroof.quad(0, vB - 0.02, US.x0 - LR.x0, lenL)], { seed: 370, cols: TILE_COLS, warm: TILE_WARM, lit: TILE_LIT });
    ridge(g, LR.x0 - 0.05, US.x0, LR.ridgeY, LR.ridgeZ, 371, true);
    // where the lower roof meets the upper walls: a lime mortar flashing
    CY.gouache(g, [P(US.x0, lrY(US.z0), US.z0), P(US.x1 + 1, lrY(US.z0), US.z0), P(US.x1 + 1, lrY(US.z0) + 0.14, US.z0), P(US.x0, lrY(US.z0) + 0.14, US.z0)], { col: '#8ea4aa', rough: 0.8, passes: 2, erode: 0.4, seed: 372, mott: 0.2 });
    CY.gouache(g, [P(US.x0, lrY(US.z0), US.z0), P(US.x0, LR.ridgeY, LR.ridgeZ), P(US.x0, LR.ridgeY + 0.12, LR.ridgeZ), P(US.x0, lrY(US.z0) + 0.12, US.z0)], { col: '#a9bfc3', rough: 0.8, passes: 2, erode: 0.4, seed: 373, mott: 0.2 });
    const lcols = tiles(g, F_lroof, [F_lroof.quad(0, 0, F_lroof.w, vB)], { seed: 370, cols: TILE_COLS, warm: TILE_WARM, lit: TILE_LIT });
    CY.gouache(g, [P(LR.x0, LR.eaveY, LR.eaveZ), P(LR.x0, LR.ridgeY + 0.05, LR.ridgeZ), P(LR.x0, LR.ridgeY - 0.17, LR.ridgeZ), P(LR.x0, LR.eaveY - 0.22, LR.eaveZ)], { col: '#222c32', rough: 0.6, passes: 2, erode: 0.2, seed: 375 });
    ink(g, [P(LR.x0, LR.eaveY + 0.02, LR.eaveZ), P(LR.x0, LR.ridgeY + 0.06, LR.ridgeZ)], { w: 3, a: 0.85, dry: 0.4, seed: 376, dbl: 1, tin: 0.02, tout: 0.05 });
    eaveEdge(g, F_lroof, lcols, 377);
    ink(g, [P(LR.x0, LR.eaveY + 0.06, LR.eaveZ), P(LR.x1, LR.eaveY + 0.06, LR.eaveZ)], { w: 1.6, col: [190, 205, 205], a: 0.35, dry: 0.7, seed: 378, nb: 3, tin: 0.01, tout: 0.01 });

    // --- ground, steps up to the door, a jar
    paintGround(g);
    const steps = [
      { x0: 2.75, x1: 4.65, y: 0.62, z0: -0.48, z1: 0 },
      { x0: 2.5, x1: 4.95, y: 0.41, z0: -0.92, z1: -0.48 },
      { x0: 2.25, x1: 5.25, y: 0.2, z0: -1.38, z1: -0.92 },
    ];
    G.stepTops = [];
    // the steps sit on the paving: a dark contact under the bottom step, and a shadow thrown to the right
    { const s0 = steps[steps.length - 1];
      CY.wash(g, [P(s0.x0 - 0.08, 0, s0.z0 - 0.1), P(s0.x1 + 0.05, 0, s0.z0 - 0.1), P(s0.x1 + 0.05, 0, s0.z0), P(s0.x0 - 0.08, 0, s0.z0)], '#10222e', { a: 0.6, blur: 2.5, seed: 386, rim: 0 });
      for (const st of steps) CY.wash(g, [P(st.x1, 0, st.z0), P(st.x1 + 0.4, 0, st.z0 + 0.12), P(st.x1 + 0.4, 0, st.z1), P(st.x1, 0, st.z1)], '#10222e', { a: 0.45, blur: 3, seed: 387, rim: 0 }); }
    steps.forEach((s, k) => {
      const RS = CY.rng(380 + k);
      // each step is two or three slabs that have each settled their own way
      const cuts = [s.x0];
      for (let x = s.x0 + RS.r(0.7, 1.2); x < s.x1 - 0.5; x += RS.r(0.8, 1.4)) cuts.push(x);
      cuts.push(s.x1);
      const side = [P(s.x0, s.y, s.z1), P(s.x0, s.y, s.z0), P(s.x0, 0, s.z0), P(s.x0, 0, s.z1)];
      CY.gouache(g, side, { col: '#6f8f9c', rough: 1.4, passes: 2, erode: 0.45, seed: 385 + k, mott: 0.25, streaks: { dens: 120, ang: 0, len: [5, 25], w: [1, 4], a: [0.1, 0.3], cols: ['#58747f', '#93acb3'] } });
      for (let j = 0; j < cuts.length - 1; j++) {
        const xa = cuts[j], xb = cuts[j + 1], dy = RS.g() * 0.012, dz = RS.g() * 0.02;
        const Ft = face([xa, s.y + dy, s.z0 + dz], [1, 0, 0], [0, 0, 1], xb - xa, s.z1 - s.z0 - dz);
        // the nosing: worn into a shallow dip where feet go, chipped here and there
        const nose = [];
        for (let x = xa; x <= xb + 1e-6; x += 0.05) {
          const q = (x - xa) / (xb - xa);
          let ny = s.y + dy - 0.012 * Math.sin(q * Math.PI) - 0.008 * (CY.vnoise(x * 9, k, 389) - 0.5) * 2;
          nose.push([x, ny]);
        }
        const front = nose.map(([x, y]) => P(x, y, s.z0 + dz)).concat([P(xb, 0, s.z0 + dz), P(xa, 0, s.z0 + dz)]);
        const top = nose.map(([x, y]) => P(x, y, s.z0 + dz)).concat([P(xb, s.y + dy, s.z1), P(xa, s.y + dy, s.z1)]).reverse();
        CY.gouache(g, front, { col: CY.jit('#3f5c69', RS, 0.08), rough: 1.4, passes: 2, erode: 0.45, seed: 388 + k * 10 + j, mott: 0.26,
          streaks: { dens: 90, ang: 0, angv: 0.2, len: [8, 40], w: [2, 6], a: [0.08, 0.22], cols: ['#2f4652', '#5a7581', '#6b7a5a'] } });
        CY.gouache(g, top, { col: CY.jit('#93a8ad', RS, 0.06), rough: 1.4, passes: 2, erode: 0.45, seed: 391 + k * 10 + j, mott: 0.26, fx: (t, R2) => {
          dabs(t, R2, Ft, 30, { u: [0, Ft.w], v: [0, Ft.h], du: [0.1, 0.6], dv: [0.03, 0.15], cols: ['#a7b9bc', '#7f979e', '#b8c5c3', '#6c868f'], a: [0.15, 0.45], jit: 2 });
          fillPoly(t, Ft.quad(Ft.w * 0.25, 0, Ft.w * 0.75, Ft.h * 0.7), '#c6d2cf', 0.18);
          fillPoly(t, Ft.quad(0, Ft.h * 0.72, Ft.w, Ft.h), '#1d3240', 0.5); // where the step above shades it
        } });
        ink(g, nose.map(([x, y]) => P(x, y, s.z0 + dz)), { w: 2.2, a: 0.8, dry: 0.6, seed: 394 + k * 10 + j, dbl: 0.8, tin: 0.05, tout: 0.1, wob: 0.6 });
        // a chip out of the nosing
        if (RS.f() < 0.7) { const x = RS.r(xa + 0.1, xb - 0.2), w2 = RS.r(0.06, 0.16); fillPoly(g, [P(x, s.y + dy, s.z0 + dz), P(x + w2, s.y + dy, s.z0 + dz), P(x + w2 * 0.6, s.y + dy - RS.r(0.03, 0.07), s.z0 + dz), P(x + w2 * 0.2, s.y + dy - 0.02, s.z0 + dz)], '#24363f', 0.8); }
        if (j) {
          ink(g, [P(xa, s.y + dy, s.z0 + dz), P(xa, 0, s.z0 + dz)], { w: 2, a: 0.7, dry: 0.4, seed: 397 + k * 10 + j, nb: 3 });
          ink(g, [P(xa, s.y + dy, s.z0 + dz), P(xa, s.y + dy, s.z1)], { w: 1.6, a: 0.6, dry: 0.4, seed: 398 + k * 10 + j, nb: 2 });
          const m = P(xa, 0.02, s.z0 - 0.02);
          CY.wash(g, CY.blob(m[0], m[1] - 3, 9, 5, 400 + k * 10 + j, 0.5, 14), R0(k + j).pick(['#6f7d52', '#5f6d45', '#7e8a5e']), { a: 0.6, blur: 1, seed: 400 + k * 10 + j, rim: 0.3, blend: null });
        }
      }
      ink(g, [side[1], side[2]], { w: 1.6, a: 0.6, dry: 0.5, seed: 399 + k, nb: 3 });
      G.stepTops.push([P(s.x0, s.y, s.z0), P(s.x1, s.y, s.z0), P(s.x1, s.y, s.z1), P(s.x0, s.y, s.z1)]);
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
          fillPoly(t, slab, CY.jit(R.pick(['#9fb1b4', '#8ea2a7', '#a9b8b8', '#7f959c', '#b3bfbc', '#71878e']), R, 0.07), 1);
          if (R.f() < 0.25) fillPoly(t, Fg.quad(x + 3 + 0.1, z + 6 + 0.05, x + 3 + dx * R.r(0.4, 0.9), z + 6 + dz * R.r(0.4, 0.9)), '#3f5a66', R.r(0.15, 0.3)); // damp
          t.strokeStyle = 'rgba(28,46,56,0.55)'; t.lineWidth = 1.4; t.beginPath(); slab.forEach((p, k) => (k ? t.lineTo(p[0], p[1]) : t.moveTo(p[0], p[1]))); t.closePath(); t.stroke();
          if (R.f() < 0.12) { const m = slab[R.i(0, 3)]; t.fillStyle = rgba(R.pick(['#6f7d52', '#5f6d45']), 0.55); t.beginPath(); t.ellipse(m[0], m[1], R.r(4, 10), R.r(2, 4), 0, 0, 6.283); t.fill(); }
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
    const taper = (q) => 1 - (q / T.L) * 0.62;
    g.save(); g.lineCap = 'round'; g.lineJoin = 'round';
    for (let i = 0; i < T.length - 1; i++) { g.strokeStyle = rgba('#3a2a24', 0.8); g.lineWidth = 26 * taper(T[i].s); g.beginPath(); g.moveTo(T[i].x, T[i].y); g.lineTo(T[i + 1].x, T[i + 1].y); g.stroke(); }
    g.restore();
    for (const front of [false, true]) {
      for (let k = 0; k < 3; k++) {
        const pts = T.map((p) => { const o = 8.5 * Math.sin(p.s / 34 + k * 2.09) * taper(p.s); return [p.x + p.nx * o, p.y + p.ny * o]; });
        let run = [];
        const flush = (i) => {
          if (run.length > 3) {
            const w = 9 * taper(T[i].s);
            CY.ink(g, run, { w, col: front ? [36, 26, 22] : [74, 56, 46], a: front ? 0.95 : 0.8, dry: 0.38, seed: 460 + k * 31 + i, tin: 0.08, tout: 0.08, wob: 0.7 });
            if (front) CY.ink(g, run.map((p) => [p[0] - w * 0.25, p[1] - 0.5]), { w: w * 0.3, col: [168, 150, 128], a: 0.45, dry: 0.6, seed: 470 + k * 31 + i, nb: 2, tin: 0.2, tout: 0.2 });
          }
          run = [];
        };
        for (let i = 0; i < T.length; i++) { const isFront = Math.cos(T[i].s / 34 + k * 2.09) >= 0; if (isFront === front) run.push(pts[i]); else flush(i); }
        flush(T.length - 1);
      }
    }
    // the root: it flares into the ground inside a little ring of loose stones
    const RR = CY.rng(495), rx = SKW.trunk[0][0], rz = SKW.trunk[0][2];
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * 6.283 + RR.g() * 0.3, L2 = RR.r(0.25, 0.5);
      ink(g, [P(rx, 0.04, rz), P(rx + Math.cos(a) * L2 * 0.5, 0.01, rz + Math.sin(a) * L2 * 0.5), P(rx + Math.cos(a) * L2, 0, rz + Math.sin(a) * L2)], { w: RR.r(4, 8), col: [44, 32, 26], a: 0.85, dry: 0.4, seed: 496 + k, tin: 0.02, tout: 0.7 });
    }
    const sp0 = P(rx, 0, rz - 0.1), soil = CY.blob(sp0[0], sp0[1], ppm(rx, rz) * 0.55, ppm(rx, rz) * 0.13, 498, 0.35, 24);
    CY.gouache(g, soil, { col: '#2a2a24', rough: 1.2, passes: 2, erode: 0.6, eb: 3, seed: 498, mott: 0.3, a: 0.75, fx: (t, R2) => { for (let i = 0; i < 20; i++) { const p = R2.pick(soil); t.fillStyle = rgba(R2.pick(['#5f6d45', '#6f7d52', '#3e3a30']), 0.5); t.beginPath(); t.ellipse(p[0] + R2.g() * 8, p[1] + R2.g() * 3, R2.r(3, 8), R2.r(1.5, 3), 0, 0, 6.283); t.fill(); } } });
    for (const [dx, dz, r] of [[-0.42, -0.12, 0.1], [0.38, -0.22, 0.12], [0.12, -0.3, 0.07], [-0.15, -0.28, 0.06]]) {
      const c = P(rx + dx, 0.03, rz + dz), r2 = ppm(rx, rz) * r;
      const st = CY.blob(c[0], c[1], r2, r2 * 0.45, 499 + Math.round(dx * 100), 0.4, 12).map(([x, y]) => [x + RR.g() * 1.5, Math.min(y, c[1] + r2 * 0.15)]);
      CY.gouache(g, st, { col: CY.jit('#6f8790', RR, 0.12), rough: 0.6, passes: 2, erode: 0.35, seed: 500 + Math.round(dx * 100), mott: 0.3, fx: (t) => { t.fillStyle = 'rgba(190,205,205,0.25)'; t.fillRect(c[0] - r2, c[1] - r2, r2 * 0.9, r2 * 0.5); } });
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
      CY.ink(g, [[x, y], [x + R.r(30, 120) * R.sign(), y + R.g() * 3]], { w: R.r(5, 14), col: R.pick([[120, 145, 152], [143, 163, 168], [90, 120, 130]]), a: R.r(0.25, 0.55), dry: 0.7, seed: 600 + i, tin: 0.05, tout: 0.6, nb: 7 });
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
      { F: F_front, v: GF.h, u0: 0, u1: GF.x1, base: 0.85 },
      { F: F_usFront, v: US.h - US.y0, u0: 0, u1: US.x1 - US.x0, base: 0.7 },
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
