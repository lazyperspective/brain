// "The Moon Gate" - the static painting, made once at load into layers:
//   sky (sky, moon) | far (far roof, the second courtyard seen through the gate) | front (wall, gate, coping,
//   steps, pot, vine trunk) | over (seal, brush marks) | light (warm sun, soft-light) | paper (multiply) | wallMask
(function () {
  const CY = window.CY;
  const { W, H, rgba, mix } = CY;

  const G = (CY.G = {
    D: 28,
    moon: { x: 760, y: 392, r: 156 },
    ridge: 470,
    cope: { top: 640, rb: 668, eave: 774, disc: 786, drip: 808, band: 828 },
    wallBot: 1580,
    gate: { x: 610, y: 1290, r: 300, ring: 26, bx: 586, sill: 1528 },
    sill: { x0: 376, x1: 844, top: 1526, face: 1542, bot: 1578 },
    steps: [{ x0: 348, x1: 872, top: 1578, face: 1595, bot: 1644 }, { x0: 288, x1: 932, top: 1644, face: 1662, bot: 1714 }],
    pot: { x: 150, top: 1438, base: 1746 },
    hook: { x: 474, y: 1224 },
    door: { x0: 532, x1: 700, top: 1242, bot: 1472 },
    shadowOff: [-46, 58],
    skel: null,
  });

  // ------------------------------------------------------------------ shapes
  CY.gatePoly = function (cx, cy, r, sill, n) {
    n = n || 180;
    const a0 = Math.asin(Math.min(1, (sill - cy) / r)), A = Math.PI - a0, B = a0 + 2 * Math.PI, pts = [];
    for (let i = 0; i <= n; i++) { const a = A + ((B - A) * i) / n; pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); }
    return pts;
  };
  const gp = G.gate;
  const FRONT = CY.gatePoly(gp.x, gp.y, gp.r, gp.sill);
  const BACK = CY.gatePoly(gp.bx, gp.y, gp.r, gp.sill);
  const WALL = [[-20, G.cope.top + 10], [W + 20, G.cope.top + 10], [W + 20, G.wallBot], [-20, G.wallBot]];
  G.FRONT = FRONT; G.BACK = BACK;

  // vine skeleton (scene px); the canopy's clusters hang from these
  const S = (p) => CY.smooth(p, 3);
  G.skel = {
    trunk: S([[150, 1442], [170, 1372], [148, 1300], [130, 1222], [158, 1142], [190, 1072], [176, 992], [198, 912], [226, 842], [236, 772], [254, 704], [266, 660]]),
    // the old wood tops the wall and runs both ways along the coping, lying on the tiles
    ridge: S([[262, 664], [306, 650], [372, 642], [450, 643], [532, 647], [612, 651], [690, 653], [760, 659], [818, 668]]),
    left: S([[252, 700], [208, 676], [150, 664], [88, 658], [26, 655], [-20, 654]]),
    cope: S([[236, 768], [318, 748], [418, 742], [520, 748], [622, 757], [720, 762], [800, 771], [880, 781], [930, 790]]),
    low1: S([[164, 1128], [118, 1100], [74, 1074], [40, 1062]]),
    low2: S([[184, 1006], [226, 988], [282, 962], [340, 938], [402, 918]]),
  };

  // ------------------------------------------------------------------ helpers
  const ink = (g, pts, o) => CY.ink(g, pts, o);
  function clipTo(g, polys, rule, fn) { g.save(); CY.path(g, polys); g.clip(rule || 'evenodd'); fn(); g.restore(); }
  function lgrad(g, x0, y0, x1, y1, stops) { const gr = g.createLinearGradient(x0, y0, x1, y1); for (const [o, c, a] of stops) gr.addColorStop(o, rgba(c, a)); return gr; }

  // ------------------------------------------------------------------ the sky and the moon
  function paintSky() {
    const L = CY.mk(W, H), g = L.g;
    const top = 900;
    const poly = CY.rect(-10, -10, W + 20, top);
    CY.gouache(g, poly, {
      col: '#4f7f85', rough: 0, passes: 1, erode: 0, holes: 0.2, mott: 0.14, grain: 1.4, seed: 11,
      fx: (t, R) => {
        t.globalCompositeOperation = 'source-over';
        t.fillStyle = lgrad(t, 0, 0, 0, top, [[0, '#2c5562', 1], [0.28, '#3f6f78', 1], [0.5, '#6d9893', 1], [0.66, '#a7b8a0', 1], [0.78, '#d8cfae', 1], [1, '#e6d8b6', 1]]);
        t.fillRect(-10, -10, W + 20, top);
        // broad horizontal brush passes of gouache
        t.lineCap = 'round';
        for (let i = 0; i < 520; i++) {
          const y = R.r(-10, top), x = R.r(-200, W), len = R.r(120, 520);
          const u = CY.clamp(y / top, 0, 1);
          const c = u < 0.3 ? mix('#2f5966', '#46767d', u / 0.3) : u < 0.62 ? mix('#46767d', '#93ae9c', (u - 0.3) / 0.32) : mix('#93ae9c', '#e2d4b2', (u - 0.62) / 0.38);
          t.strokeStyle = rgba(CY.jit(c, R, 0.07), R.r(0.05, 0.16));
          t.lineWidth = R.r(6, 34);
          t.beginPath(); t.moveTo(x, y); t.quadraticCurveTo(x + len / 2, y + R.g() * 5, x + len, y + R.g() * 4); t.stroke();
        }
      },
    });
    // moon halo
    const m = G.moon;
    g.save(); g.globalCompositeOperation = 'screen';
    const hg = g.createRadialGradient(m.x, m.y, m.r * 0.9, m.x, m.y, m.r * 2.6);
    hg.addColorStop(0, 'rgba(240,222,170,0.42)'); hg.addColorStop(0.35, 'rgba(220,206,160,0.16)'); hg.addColorStop(1, 'rgba(200,190,150,0)');
    g.fillStyle = hg; g.fillRect(m.x - m.r * 3, m.y - m.r * 3, m.r * 6, m.r * 6);
    g.restore();
    // the moon: a flat, chalky disc with faint maria
    CY.gouache(g, CY.circle(m.x, m.y, m.r, 140), {
      col: '#f1e3b8', rough: 1.6, passes: 3, erode: 0.35, eb: 2, mott: 0.08, holes: 0.25, seed: 12,
      fx: (t, R) => {
        for (const [dx, dy, rx, ry, a] of [[-40, -30, 52, 40, 0.16], [30, 18, 38, 30, 0.12], [-12, 52, 44, 26, 0.1], [56, -52, 22, 18, 0.1]]) {
          t.fillStyle = rgba('#cdb98e', a); CY.path(t, [CY.blob(m.x + dx, m.y + dy, rx, ry, R.i(1, 99), 0.35)]); t.fill();
        }
        const rg = t.createRadialGradient(m.x + 50, m.y - 50, 10, m.x, m.y, m.r);
        rg.addColorStop(0, 'rgba(255,248,222,0.5)'); rg.addColorStop(1, 'rgba(232,206,150,0.25)');
        t.fillStyle = rg; t.fillRect(m.x - m.r, m.y - m.r, m.r * 2, m.r * 2);
      },
    });
    // a pale distant roofline far left (mostly behind the flowers)
    const far = [[-20, 600], [60, 590], [180, 578], [300, 574], [330, 586], [330, 700], [-20, 700]];
    CY.gouache(g, far, { col: '#9daaa3', rough: 2, passes: 2, erode: 0.6, seed: 13, a: 0.75, streaks: { dens: 600, ang: 0, len: [20, 80], w: [1, 3], a: [0.1, 0.25], cols: ['#7f8c88', '#b6bfb6'] } });
    ink(g, [[-20, 598], [80, 588], [200, 576], [300, 572], [336, 560]], { w: 2.2, a: 0.45, dry: 0.5, seed: 14 });
    return L;
  }

  // ------------------------------------------------------------------ tile rows (shared by roofs)
  // frontal elevation: convex cover tiles (lit on the right) alternate with dark pan channels; courses overlap
  function tileField(t, R, x0, x1, y0, y1, pitch, cover, o) {
    o = o || {};
    const course = o.course || 13, irr = o.irr == null ? 1 : o.irr;
    // columns: laid by hand, so the spacing wanders and each run leans a little
    let cols = o.cols;
    if (!cols) { cols = []; for (let x = x0; x < x1 + pitch * 2; x += pitch * (1 + R.g() * 0.07 * irr)) cols.push({ x, lean: R.g() * 0.02 * irr }); }
    for (let ci = 0; ci < cols.length - 1; ci++) {
      const C = cols[ci], pi = cols[ci + 1].x - C.x;
      const cv = Math.max(4, cover * (pi / pitch) + R.g() * 1.2 * irr);
      const h = y1 - y0 + (C.dy || 0);
      t.save(); t.translate(C.x, y0); t.transform(1, 0, C.lean || 0, 1, 0, 0);
      const xl = -cv / 2, xr = cv / 2;
      // pan channel to the next run
      t.fillStyle = rgba(o.pan || '#383e42', 0.85); t.fillRect(xr - 1, 0, pi - cv + 2, h);
      // cover strip
      const c0 = C.tone || o.cov || '#6d7478';
      t.fillStyle = rgba(CY.jit(c0, R, 0.07), 1); t.fillRect(xl, 0, cv, h);
      t.fillStyle = rgba(o.dark || '#3f4549', 0.55); t.fillRect(xl, 0, cv * 0.22, h);
      t.fillStyle = rgba(o.lit || '#9ba2a3', 0.65); t.fillRect(xr - cv * 0.34, 0, cv * 0.2, h);
      // courses: each overlapping tile end is a soft arc with a lit lip; tiles differ in tone and length
      for (let y = R.r(2, course); y < h - 3; y += course * (1 + R.g() * 0.12 * irr)) {
        t.fillStyle = rgba(CY.jit(c0, R, 0.18 * irr), 0.45); t.fillRect(xl + 1, y, cv - 2, course);
        if (R.f() < 0.05 * irr) { t.fillStyle = rgba('#24282a', 0.7); t.fillRect(xl + R.r(2, cv * 0.4), y + 2, R.r(3, cv * 0.5), course * R.r(0.5, 1.2)); }
        const sl = R.g() * 1.4 * irr;
        t.strokeStyle = rgba('#202427', (o.courseA || 0.55) * R.r(0.7, 1)); t.lineWidth = (o.courseW || 1.3) * R.r(0.8, 1.2);
        t.beginPath(); t.moveTo(xl, y - sl); t.quadraticCurveTo(0, y + course * R.r(0.25, 0.4), xr, y + sl); t.stroke();
        t.strokeStyle = rgba(o.lit || '#a7adad', 0.35 * R.r(0.5, 1)); t.lineWidth = 1;
        t.beginPath(); t.moveTo(xl + 2, y + 2 - sl); t.quadraticCurveTo(0, y + 2 + course * 0.3, xr - 2, y + 2 + sl); t.stroke();
        t.strokeStyle = rgba('#202426', 0.45);
        t.beginPath(); t.moveTo(xr, y + course / 2); t.quadraticCurveTo(xr + (pi - cv) / 2, y + course / 2 - course * 0.25, xr + pi - cv, y + course / 2 + R.g()); t.stroke();
      }
      t.restore();
    }
  }

  // ------------------------------------------------------------------ the far house: roof over the wall
  function paintFarRoof(g) {
    // the far house's roof, low behind the wall: pale with distance, its ridge just clipping the moon
    const RY = 528, EY = 652;
    const rf = [[436, RY + 10], [W + 20, RY + 10], [W + 20, EY], [372, EY]];
    CY.gouache(g, rf, {
      col: '#7b878b', rough: 1.5, passes: 2, erode: 0.45, seed: 21, mott: 0.14,
      fx: (t, R) => {
        tileField(t, R, 380, W + 30, RY + 10, EY, 16, 9, { course: 8, cov: '#8d999d', lit: '#b3bdbc', pan: '#5f6b71', dark: '#6c787d', irr: 0.6 });
        t.save(); CY.path(t, [[[436, RY + 10], [372, EY], [470, EY], [470, RY + 10]]]); t.clip();
        t.fillStyle = rgba('#66737a', 0.9); t.beginPath(); t.moveTo(436, RY + 10); t.lineTo(372, EY); t.lineTo(404, EY); t.lineTo(450, RY + 10); t.fill();
        t.restore();
        t.fillStyle = rgba('#b4c3bc', 0.5); t.fillRect(360, RY, W, EY - RY);
        t.fillStyle = lgrad(t, 0, RY + 10, 0, RY + 50, [[0, '#e0c08e', 0.3], [1, '#e0c08e', 0]]); t.fillRect(360, RY + 10, W, 50);
      },
    });
    const ridge = CY.smooth([[440, RY - 2], [700, RY - 5], [W + 20, RY - 6], [W + 20, RY + 12], [700, RY + 12], [444, RY + 14], [420, RY + 10], [404, RY - 4], [398, RY - 22], [406, RY - 32], [416, RY - 28], [420, RY - 14], [432, RY - 6]], 2, true);
    CY.gouache(g, ridge, {
      col: '#5d686d', rough: 1, passes: 2, erode: 0.35, seed: 22,
      fx: (t, R) => {
        for (let x = 440; x < W + 20; x += 7) { t.strokeStyle = rgba(R.f() < 0.5 ? '#7c878c' : '#4a5459', 0.6); t.lineWidth = 1.8; t.beginPath(); t.moveTo(x, RY - 2); t.lineTo(x + 5, RY + 10); t.stroke(); }
        t.fillStyle = rgba('#d6c095', 0.35); t.fillRect(420, RY - 8, W, 3);
      },
    });
    const a = 0.45;
    ink(g, [[398, RY - 22], [404, RY - 4], [422, RY + 8], [444, RY - 2], [700, RY - 5], [W + 10, RY - 6]], { w: 2.4, a, dry: 0.5, seed: 23, dbl: 1.2 });
    ink(g, [[420, RY + 12], [444, RY + 15], [700, RY + 13], [W + 10, RY + 12]], { w: 1.8, a: a * 0.85, dry: 0.55, seed: 24 });
    ink(g, [[398, RY - 22], [406, RY - 32], [416, RY - 28], [420, RY - 14]], { w: 1.8, a, dry: 0.3, seed: 25 });
    ink(g, [[438, RY + 16], [404, RY + 80], [370, EY + 4]], { w: 2, dry: 0.55, seed: 26, a: a * 0.85 });
    for (let x = 384; x < W; x += 16) if (CY.hash(x, 3, 1) < 0.4) ink(g, [[x + 4, RY + 20 + CY.hash(x, 1, 2) * 16], [x + 4, EY - 8]], { w: 0.9, a: 0.25, dry: 0.6, seed: 27 + x, nb: 2 });
  }

  // ------------------------------------------------------------------ the second courtyard through the gate
  function paintInner(g) {
    const X0 = 270, X1 = 950, Y0 = 970, GY = 1478, SHADE = 1082;
    // far wall: lit warm above the foreground wall's shadow, cool below
    CY.gouache(g, CY.rect(X0, Y0, X1 - X0, GY - Y0 + 6), {
      col: '#a7aea8', rough: 0, passes: 1, erode: 0, seed: 31, mott: 0.18,
      fx: (t, R) => {
        t.globalCompositeOperation = 'source-over';
        t.fillStyle = rgba('#9ea6a2', 1); t.fillRect(X0, Y0, X1 - X0, GY - Y0 + 6);
        t.lineCap = 'round';
        for (let i = 0; i < 260; i++) { const y = R.r(Y0, GY), x = R.r(X0 - 60, X1); t.strokeStyle = rgba(R.pick(['#8f9894', '#aab1ab', '#949c9a', '#b3b6a8']), R.r(0.12, 0.3)); t.lineWidth = R.r(4, 18); t.beginPath(); t.moveTo(x, y); t.lineTo(x + R.r(40, 160), y + R.g() * 4); t.stroke(); }
        // lit band with a scalloped shadow edge (the coping's drip tiles, cast across the courtyard)
        // the lit band is not painted here: the sunlit version of this whole layer is revealed above a moving
        // shade line at render time (see paintScene, A.sunLine), so the light can travel across the far wall
        G.inner = { X0, X1, Y0, SHADE };
        // rain streaks down the far wall, through light and shade alike
        for (let i = 0; i < 70; i++) { const x = R.r(X0, X1), y = R.r(Y0, GY - 160); t.strokeStyle = rgba(R.pick(['#7c8582', '#8a8e86', '#a39477']), R.r(0.1, 0.24)); t.lineWidth = R.r(2, 9); t.beginPath(); t.moveTo(x, y); t.lineTo(x + R.g() * 2, y + R.r(40, 200)); t.stroke(); }
        // the shade is not empty: old wash marks and a damp foot
        t.fillStyle = lgrad(t, 0, GY - 120, 0, GY, [[0, '#7d8781', 0], [1, '#7d8781', 0.45]]); t.fillRect(X0, GY - 120, X1 - X0, 126);
        // stains and a blue under-layer, weathered
        for (let i = 0; i < 14; i++) { t.fillStyle = rgba(R.pick(['#8b9897', '#7f8a8a', '#b9a986', '#94a2a8']), R.r(0.08, 0.2)); CY.path(t, [CY.blob(R.r(X0, X1), R.r(Y0, GY), R.r(20, 70), R.r(15, 60), R.i(1, 500), 0.4)]); t.fill(); }
        for (let i = 0; i < 40; i++) { const x = R.r(X0, X1), y = R.r(Y0, SHADE); t.strokeStyle = rgba('#a3896a', R.r(0.06, 0.16)); t.lineWidth = R.r(2, 8); t.beginPath(); t.moveTo(x, y); t.lineTo(x + R.g() * 2, y + R.r(20, 90)); t.stroke(); }
      },
    });
    // plinth along the far wall
    CY.gouache(g, CY.rect(X0, 1440, X1 - X0, 40), { col: '#7f8580', rough: 1, passes: 2, erode: 0.3, seed: 32, streaks: { dens: 300, ang: 0, len: [10, 40], w: [1, 3], a: [0.1, 0.3], cols: ['#666c68', '#9aa09a'] } });
    for (let x = X0 + 20; x < X1; x += 74) ink(g, [[x + CY.hash(x, 1, 3) * 10, 1442], [x + CY.hash(x, 1, 3) * 10, 1478]], { w: 1.2, a: 0.4, dry: 0.5, seed: 33 + x, nb: 2 });
    ink(g, [[X0, 1440], [X1, 1440]], { w: 1.6, a: 0.45, dry: 0.5, seed: 34 });

    // lattice window in the lit band
    const wx = 728, wy = 994, ww = 92, wh = 72;
    CY.gouache(g, CY.rect(wx - 8, wy - 8, ww + 16, wh + 16), { col: '#4a3226', rough: 1, passes: 2, erode: 0.3, seed: 35 });
    CY.gouache(g, CY.rect(wx, wy, ww, wh), { col: '#2a2522', rough: 0.8, passes: 1, erode: 0.2, seed: 36 });
    g.save(); CY.path(g, [CY.rect(wx, wy, ww, wh)]); g.clip();
    g.strokeStyle = rgba('#6a4a36', 0.95); g.lineWidth = 2.6;
    for (let k = -6; k < 12; k++) { g.beginPath(); g.moveTo(wx + k * 13, wy); g.lineTo(wx + k * 13 + wh, wy + wh); g.stroke(); g.beginPath(); g.moveTo(wx + k * 13 + wh, wy); g.lineTo(wx + k * 13, wy + wh); g.stroke(); }
    g.strokeStyle = rgba('#a07a56', 0.5); g.lineWidth = 1;
    for (let k = -6; k < 12; k++) { g.beginPath(); g.moveTo(wx + k * 13 + 1.5, wy); g.lineTo(wx + k * 13 + wh + 1.5, wy + wh); g.stroke(); }
    g.restore();
    CY.inkPoly(g, CY.rect(wx - 8, wy - 8, ww + 16, wh + 16), { w: 1.8, a: 0.7, dry: 0.45, seed: 37 });
    CY.inkPoly(g, CY.rect(wx, wy, ww, wh), { w: 1.3, a: 0.6, dry: 0.45, seed: 38 });

    // door hood: a small tiled canopy on two brackets
    const D = G.door, hx0 = D.x0 - 26, hx1 = D.x1 + 24, hy0 = 1190, hy1 = 1230;
    CY.gouache(g, [[hx0 + 6, hy0], [hx1 - 6, hy0], [hx1 + 6, hy1], [hx0 - 6, hy1]], {
      col: '#545b5f', rough: 1, passes: 2, erode: 0.3, seed: 39,
      fx: (t, R) => tileField(t, R, hx0 - 6, hx1 + 8, hy0 + 6, hy1, 13, 8, { course: 8, cov: '#6e777b', lit: '#a4aeae' }),
    });
    CY.gouache(g, CY.rect(hx0 + 2, hy0 - 6, hx1 - hx0 - 4, 9), { col: '#3e4549', rough: 0.8, passes: 1, erode: 0.2, seed: 40 });
    ink(g, [[hx0 - 6, hy1], [hx1 + 6, hy1]], { w: 2.2, a: 0.75, dry: 0.4, seed: 41 });
    ink(g, [[hx0 + 2, hy0 - 6], [hx1 - 2, hy0 - 6]], { w: 1.8, a: 0.7, dry: 0.4, seed: 42 });
    for (let x = hx0; x <= hx1; x += 13) { g.fillStyle = rgba('#5e666a', 1); g.beginPath(); g.arc(x + 4, hy1 + 3, 4, 0, 6.283); g.fill(); g.strokeStyle = rgba(CY.INK, 0.55); g.lineWidth = 1; g.stroke(); }
    // hood shadow on the wall
    CY.wash(g, [[hx0 - 4, hy1 + 4], [hx1 + 4, hy1 + 4], [hx1 - 6, hy1 + 26], [hx0 + 8, hy1 + 22]], '#6f7473', { a: 0.5, blur: 4, seed: 43, rim: 0 });

    // door frame and leaves: red, peeling to grey wood
    CY.gouache(g, CY.rect(D.x0 - 12, D.top - 10, D.x1 - D.x0 + 24, D.bot - D.top + 16), { col: '#3d2a22', rough: 1, passes: 2, erode: 0.25, seed: 44, streaks: { dens: 220, ang: Math.PI / 2, len: [20, 80], w: [1, 2.5], a: [0.1, 0.3], cols: ['#5a4031', '#2a1d18'] } });
    const leafW = (D.x1 - D.x0) / 2;
    for (let k = 0; k < 2; k++) {
      const lx = D.x0 + k * leafW;
      CY.gouache(g, CY.rect(lx + 1, D.top, leafW - 2, D.bot - D.top), {
        col: '#a12a22', rough: 1.4, passes: 3, erode: 0.45, seed: 45 + k, mott: 0.16,
        streaks: { dens: 70, ang: Math.PI / 2, angv: 0.02, len: [40, 180], w: [1, 4], a: [0.12, 0.35], cols: ['#7c1c18', '#bb3a2c', '#8a221c', '#c4553f'] },
        fx: (t, R) => {
          // weather: paint worn to the grey wood, worst near the bottom and the edges
          for (let i = 0; i < 46; i++) {
            const big = Math.pow(R.f(), 0.55), y = D.top + big * (D.bot - D.top) + R.r(-10, 10), x = lx + (R.f() < 0.45 ? R.r(0, 12) : R.f() < 0.3 ? R.r(leafW - 12, leafW) : R.r(0, leafW));
            const h = R.r(10, 50) * (0.4 + big), w = R.r(2, 7) * (0.5 + big);
            const pts = [];
            for (let k = 0; k <= 8; k++) pts.push([x + Math.sin(k * 1.7 + i) * w * 0.3 + R.g() * w * 0.25 - w / 2, y - h / 2 + (k / 8) * h]);
            for (let k = 8; k >= 0; k--) pts.push([x + Math.sin(k * 1.3 + i) * w * 0.3 + R.g() * w * 0.25 + w / 2, y - h / 2 + (k / 8) * h]);
            t.fillStyle = rgba(R.pick(['#8c8577', '#9c958a', '#7b7468', '#a69f90']), 0.92); CY.path(t, [pts]); t.fill();
            t.strokeStyle = rgba('#5a5248', 0.4); t.lineWidth = 0.8; t.beginPath(); t.moveTo(x, y - h / 2); t.lineTo(x + R.g(), y + h / 2); t.stroke();
          }
          for (let i = 0; i < 12; i++) { t.fillStyle = rgba('#c8604a', 0.25); t.fillRect(lx + R.r(0, leafW), D.top + R.r(0, D.bot - D.top), R.r(3, 10), R.r(20, 60)); }
          t.fillStyle = lgrad(t, 0, D.top, 0, D.top + 60, [[0, '#2b1712', 0.45], [1, '#2b1712', 0]]); t.fillRect(lx, D.top, leafW, 60);
        },
      });
      // plank seams
      for (let p = 1; p < 3; p++) ink(g, [[lx + (p * leafW) / 3, D.top + 4], [lx + (p * leafW) / 3 + CY.hash(k, p, 5) * 2, D.bot - 2]], { w: 1.2, a: 0.5, dry: 0.55, seed: 46 + k * 7 + p, nb: 2 });
    }
    ink(g, [[D.x0 + leafW, D.top], [D.x0 + leafW + 1, D.bot]], { w: 2.4, a: 0.85, dry: 0.3, seed: 48 });
    CY.inkPoly(g, CY.rect(D.x0, D.top, D.x1 - D.x0, D.bot - D.top), { w: 2.2, a: 0.8, dry: 0.4, seed: 49, dbl: 1.2 });
    CY.inkPoly(g, CY.rect(D.x0 - 12, D.top - 10, D.x1 - D.x0 + 24, D.bot - D.top + 16), { w: 1.8, a: 0.6, dry: 0.5, seed: 50 });
    // iron ring pulls
    for (const s of [-1, 1]) {
      const cx = D.x0 + leafW + s * 13, cy = 1352;
      g.fillStyle = rgba('#2a2420', 0.9); g.beginPath(); g.arc(cx, cy, 5, 0, 6.283); g.fill();
      ink(g, CY.circle(cx, cy + 12, 9, 24).concat([[cx + 9, cy + 12]]), { w: 1.6, a: 0.8, dry: 0.2, seed: 51 + s, tin: 0.02, tout: 0.05 });
    }
    // threshold and a door stone
    CY.gouache(g, CY.rect(D.x0 - 14, D.bot - 4, D.x1 - D.x0 + 28, 12), { col: '#3a2b24', rough: 0.8, passes: 1, erode: 0.2, seed: 52 });
    CY.gouache(g, [[D.x0 - 30, D.bot + 8], [D.x1 + 30, D.bot + 8], [D.x1 + 40, D.bot + 22], [D.x0 - 40, D.bot + 22]], { col: '#9b9a90', rough: 1, passes: 2, erode: 0.3, seed: 53 });
    ink(g, [[D.x0 - 40, D.bot + 22], [D.x1 + 40, D.bot + 22]], { w: 1.6, a: 0.55, dry: 0.5, seed: 54 });
    // the lantern's iron arm (the lantern itself is animated)
    ink(g, [[D.x0 - 14, 1208], [G.hook.x + 10, 1210], [G.hook.x, G.hook.y - 2]], { w: 2.2, a: 0.85, dry: 0.15, seed: 55, tin: 0.02, tout: 0.05 });
    // a clay jar by the door
    const jx = 776, jy = 1478;
    const jar = [];
    for (let i = 0; i <= 20; i++) { const u = i / 20, y = jy - 58 + u * 58, hw = 14 + 15 * Math.sin(Math.PI * Math.min(1, u * 1.1)) + (u < 0.08 ? 3 : 0); jar.push([jx + hw, y]); }
    for (let i = 20; i >= 0; i--) { const u = i / 20, y = jy - 58 + u * 58, hw = 14 + 15 * Math.sin(Math.PI * Math.min(1, u * 1.1)) + (u < 0.08 ? 3 : 0); jar.push([jx - hw, y]); }
    CY.gouache(g, jar, { col: '#8a5a3e', rough: 1, passes: 2, erode: 0.35, seed: 56, fx: (t) => { t.fillStyle = lgrad(t, jx - 30, 0, jx + 30, 0, [[0, '#4a2e22', 0.5], [0.6, '#000', 0], [0.85, '#d49a6a', 0.35], [1, '#000', 0]]); t.fillRect(jx - 32, jy - 60, 64, 62); } });
    CY.inkPoly(g, jar, { w: 1.5, a: 0.6, dry: 0.45, seed: 57, seg: [40, 90] });
    // courtyard paving, receding
    CY.gouache(g, CY.rect(X0, GY + 4, X1 - X0, 70), {
      col: '#bdb6a6', rough: 0, passes: 1, erode: 0, seed: 58, mott: 0.15,
      fx: (t, R) => {
        t.fillStyle = lgrad(t, 0, GY, 0, GY + 70, [[0, '#8f918b', 1], [1, '#b7b09f', 1]]); t.fillRect(X0, GY, X1 - X0, 80);
      },
    });
    for (const y of [1494, 1514, 1540]) ink(g, [[X0, y], [X1, y + (y - 1490) * 0.02]], { w: 1.2, a: 0.32, dry: 0.6, seed: 59 + y, nb: 2 });
    for (let k = -6; k <= 6; k++) { const x = 610 + k * 64; ink(g, [[610 + (x - 610) * 0.82, 1482], [610 + (x - 610) * 1.25, 1560]], { w: 1.1, a: 0.3, dry: 0.6, seed: 60 + k, nb: 2 }); }
    // a clump of bamboo by the far wall, brushed in ink
    const RB = CY.rng(64);
    const culms = [];
    for (let k = 0; k < 5; k++) {
      const x0 = 834 + k * 15 + RB.g() * 4, lean = RB.r(-0.06, 0.1);
      const pts = []; for (let y = 1474; y > 960; y -= 12) pts.push([x0 + (1474 - y) * lean + Math.sin(y * 0.01 + k) * 2, y]);
      culms.push(pts);
      const col = k % 2 ? [74, 92, 70] : [56, 72, 56];
      CY.ink(g, pts, { w: RB.r(5, 7.5), col, a: 0.85, dry: 0.3, seed: 640 + k, tin: 0.01, tout: 0.05, wob: 0.4 });
      for (let i = 4; i < pts.length; i += RB.i(4, 6)) { const p = pts[i]; g.fillStyle = 'rgba(214,214,190,0.7)'; g.fillRect(p[0] - 4, p[1], 8, 1.5); CY.ink(g, [[p[0] - 5, p[1] + 2], [p[0] + 5, p[1] + 1]], { w: 1.6, col: [30, 36, 30], a: 0.8, dry: 0.2, seed: 650 + k * 40 + i, nb: 2 }); }
    }
    // leaves: lanceolate strokes, fanned in threes and fours from the nodes
    for (let i = 0; i < 26; i++) {
      const c = culms[RB.i(0, 4)], p = c[RB.i(8, c.length - 2)];
      const dir = RB.f() < 0.65 ? Math.PI * RB.r(0.75, 1.05) : RB.r(-0.1, 0.25);
      const nl = RB.i(3, 5);
      for (let j = 0; j < nl; j++) {
        const a = dir + (j - nl / 2) * 0.32 + RB.g() * 0.1 + 0.35, L = RB.r(32, 58);
        const mid = [p[0] + Math.cos(a) * L * 0.5 + Math.cos(a + 1.57) * 3, p[1] + Math.sin(a) * L * 0.5 + Math.sin(a + 1.57) * 3];
        CY.ink(g, [p, mid, [p[0] + Math.cos(a) * L, p[1] + Math.sin(a) * L + 4]], { w: RB.r(5, 8), col: RB.f() < 0.5 ? [38, 52, 40] : [62, 82, 60], a: 0.85, dry: 0.25, seed: 700 + i * 10 + j, tin: 0.3, tout: 0.65, nb: 5, wob: 0.3 });
      }
    }
    // a few long-fallen petals on the far floor
    const R = CY.rng(62);
    for (let i = 0; i < 22; i++) CY.bract(g, R.r(330, 900), R.r(1488, 1540), R.f() * 6.28, R.r(4, 7), 0.5, CY.TONES[R.i(1, 4)], 0.85);
    // aerial perspective: the far courtyard sits a little back in the air
    g.save(); g.globalCompositeOperation = 'source-atop'; g.fillStyle = 'rgba(196,206,200,0.12)'; g.fillRect(X0, Y0, X1 - X0, 600); g.restore();
  }

  function paintFar() {
    const L = CY.mk(W, H), g = L.g;
    paintFarRoof(g);
    paintInner(g);
    return L;
  }

  // ------------------------------------------------------------------ the front wall
  function paintPlaster(g) {
    const polys = [WALL, FRONT];
    CY.gouache(g, polys, {
      col: '#e7dbc2', rough: 0, passes: 1, erode: 0, seed: 70, mott: 0.12, holes: 0.3, grain: 1.2,
      streaks: { dens: 260, ang: 0, angv: 0.25, len: [30, 160], w: [3, 14], a: [0.05, 0.16], cols: ['#efe4cd', '#ddd0b4', '#e9dcc0', '#d6cab2'] },
    });
    clipTo(g, polys, 'evenodd', () => {
      // old blue-grey paint under the lime, surfacing in broad faded patches
      const R = CY.rng(71);
      for (const [x, y, rx, ry] of [[80, 1180, 120, 210], [960, 1180, 130, 260], [860, 900, 160, 70], [330, 900, 120, 60], [1040, 1480, 90, 120]]) {
        CY.wash(g, CY.blob(x, y, rx, ry, R.i(1, 999), 0.45), '#a9b9bb', { a: 0.32, blur: 6, rim: 0.25, seed: R.i(1, 999), blend: 'multiply' });
      }
      // dry-brush scumble: the lime was laid on in broad strokes
      for (let i = 0; i < 120; i++) {
        const x = R.r(-80, W), y = R.r(830, 1560), len = R.r(120, 340), a = R.g() * 0.12;
        CY.ink(g, [[x, y], [x + len * 0.5, y + Math.sin(a) * len * 0.5 + R.g() * 4], [x + len, y + Math.sin(a) * len]], { w: R.r(16, 36), col: R.pick([[246, 238, 220], [244, 234, 212], [214, 202, 178], [226, 214, 190]]), a: R.r(0.12, 0.28), dry: 0.62, seed: 600 + i, tin: 0.2, tout: 0.35, wob: 2 });
      }
      // cool left, warm right (the low sun)
      g.save(); g.globalCompositeOperation = 'multiply';
      g.fillStyle = lgrad(g, 0, 0, W, 0, [[0, '#cfc6bb', 1], [0.45, '#fff', 1], [1, '#fff', 1]]); g.fillRect(0, 640, W, 960);
      g.restore();
      // water streaks from under the coping
      for (let i = 0; i < 34; i++) {
        const x = R.r(0, W), y0 = G.cope.band - 4, len = R.r(60, 420) * (R.f() < 0.25 ? 1.6 : 1), w = R.r(6, 26);
        const pts = [[x - w / 2, y0], [x + w / 2, y0], [x + w * 0.35 + R.g() * 3, y0 + len * 0.6], [x + R.g() * 4, y0 + len], [x - w * 0.3 + R.g() * 3, y0 + len * 0.55]];
        CY.wash(g, CY.smooth(pts, 2, true), R.pick(['#a4957a', '#9c9381', '#a99c84', '#8f9192']), { a: R.r(0.14, 0.32), blur: 3, rim: 0.5, seed: 300 + i });
      }
      // grime around the gate ring and rust under the hook
      for (let i = 0; i < 10; i++) { const a = R.r(3.3, 6.1), r = gp.r + gp.ring + R.r(4, 34); CY.wash(g, CY.blob(gp.x + Math.cos(a) * r, gp.y + Math.sin(a) * r, R.r(14, 40), R.r(10, 30), 400 + i, 0.5), '#a49680', { a: 0.22, blur: 4, seed: 400 + i }); }
      // rising damp along the foot of the wall
      const damp = [[-20, G.wallBot + 10]];
      for (let x = -20; x <= W + 20; x += 14) damp.push([x, 1410 + 40 * CY.fbm(x * 0.012, 0.5, 72, 3) + 30 * Math.sin(x * 0.006)]);
      damp.push([W + 20, G.wallBot + 10]);
      CY.wash(g, damp, '#9c9a84', { a: 0.35, blur: 4, rim: 0.7, rimw: 2, seed: 73 });
      CY.wash(g, damp.map((p) => [p[0], p[1] + 34]).slice(1, -1).concat([[W + 20, G.wallBot + 10], [-20, G.wallBot + 10]]), '#8a8a78', { a: 0.25, blur: 5, rim: 0.4, seed: 74 });
      // general stains
      for (let i = 0; i < 16; i++) CY.wash(g, CY.blob(R.r(0, W), R.r(860, 1500), R.r(20, 70), R.r(16, 60), 500 + i, 0.45), R.pick(['#b4a27e', '#a7a092', '#b9ab8c']), { a: R.r(0.1, 0.22), blur: 4, seed: 500 + i });
    });
  }

  // a peeled patch: the lime gone, the brick or the older blue coat beneath
  function peel(g, cx, cy, rx, ry, seed, under) {
    const R = CY.rng(seed);
    const poly = CY.blob(cx, cy, rx, ry, seed, 0.42, 64).map((p, i) => [p[0] + (i % 3 === 0 ? R.g() * 4 : 0), p[1] + (i % 4 === 0 ? R.g() * 4 : 0)]);
    if (under === 'brick') {
      CY.gouache(g, poly, {
        col: '#a2644a', rough: 1.6, passes: 2, erode: 0.35, seed: seed + 1, mott: 0.2,
        fx: (t, R2) => {
          const bh = 15, bw = 36;
          for (let y = cy - ry - 20, row = 0; y < cy + ry + 20; y += bh, row++) {
            for (let x = cx - rx - 40 + (row % 2) * bw * 0.5; x < cx + rx + 20; x += bw) {
              t.fillStyle = rgba(R2.pick(['#a8684b', '#94573f', '#b27556', '#8a5a48', '#9a8478']), 0.9);
              t.fillRect(x + 1.5, y + 1.5, bw - 3, bh - 3);
            }
            t.strokeStyle = rgba('#d8ccb6', 0.75); t.lineWidth = 2;
            t.beginPath(); t.moveTo(cx - rx - 40, y); t.lineTo(cx + rx + 40, y); t.stroke();
          }
        },
      });
    } else {
      CY.gouache(g, poly, { col: '#9fb2b4', rough: 1.6, passes: 3, erode: 0.4, seed: seed + 1, mott: 0.22, streaks: { dens: 120, ang: 0.3, len: [10, 50], w: [2, 6], a: [0.1, 0.3], cols: ['#7f9799', '#b9c8c6', '#c2b9a2'] } });
    }
    // the broken edge: shadow inside the lower-left lip, a pale raised rim on the upper right
    const P = CY.resample(poly.concat([poly[0]]), 3);
    const lower = [], upper = [];
    for (const p of P) { const nx = p.x - cx, ny = p.y - cy; const lit = (nx * 0.6 - ny * 0.8) / (Math.hypot(nx, ny) + 1); (lit < 0 ? lower : upper).push([p.x, p.y]); }
    ink(g, poly.concat([poly[0]]), { w: 1.5, a: 0.65, dry: 0.45, seed: seed + 2, col: [70, 55, 45] });
    CY.wash(g, poly.map((p) => [cx + (p[0] - cx) * 0.96 + 3, cy + (p[1] - cy) * 0.96 + 3]), '#6d6458', { a: 0.18, blur: 3, rim: 0, seed: seed + 3 });
    g.save(); g.strokeStyle = 'rgba(250,242,224,0.55)'; g.lineWidth = 2.2; g.beginPath();
    poly.forEach((p, i) => { const q = [cx + (p[0] - cx) * 1.04 + 1, cy + (p[1] - cy) * 1.04 - 1]; if (i) g.lineTo(q[0], q[1]); else g.moveTo(q[0], q[1]); });
    g.closePath(); g.stroke(); g.restore();
    // loose flakes about to go
    for (let i = 0; i < 5; i++) { const a = R.f() * 6.28, r = 1.05 + R.f() * 0.2; CY.wash(g, CY.blob(cx + Math.cos(a) * rx * r, cy + Math.sin(a) * ry * r, R.r(3, 8), R.r(2, 6), seed + 10 + i, 0.4, 14), '#8b7f6c', { a: 0.4, blur: 0.8, rim: 0.6, seed: seed + 10 + i }); }
  }

  function paintCopingShadow(g) {
    // under the eave a cool band with the scallops of the drip tiles
    const pts = [[-20, G.cope.band]];
    for (let x = -20; x <= W + 20; x += 5) pts.push([x, G.cope.band + 16 + 9 * Math.abs(Math.sin(((x - 19) * Math.PI) / 38)) + CY.fbm(x * 0.02, 1, 81, 2) * 10]);
    pts.push([W + 20, G.cope.band]);
    CY.wash(g, pts, '#857f8c', { a: 0.42, blur: 3, rim: 0.3, seed: 82 });
    g.save(); g.globalCompositeOperation = 'multiply';
    g.fillStyle = lgrad(g, 0, G.cope.band, 0, G.cope.band + 120, [[0, '#b9b2b6', 0.6], [1, '#fff', 0]]);
    g.fillRect(0, G.cope.band, W, 120); g.restore();
  }

  function paintGate(g) {
    // the reveal: the inner face of the round opening, in shade
    clipTo(g, [FRONT], 'nonzero', () => {
      CY.gouache(g, [FRONT, BACK], {
        col: '#a79f8f', rough: 0, passes: 1, erode: 0, seed: 90, mott: 0.15,
        fx: (t) => {
          t.globalCompositeOperation = 'source-atop';
          const rg = t.createLinearGradient(gp.x, gp.y - gp.r, gp.x + 80, gp.y + gp.r);
          rg.addColorStop(0, 'rgba(70,64,72,0.45)'); rg.addColorStop(0.55, 'rgba(120,112,108,0.1)'); rg.addColorStop(1, 'rgba(220,190,140,0.25)');
          t.fillStyle = rg; t.fillRect(gp.x - gp.r, gp.y - gp.r, gp.r * 2 + 40, gp.r * 2);
        },
      });
    });
    // inner edge of the reveal (the back of the hole)
    const backArc = BACK.filter((p) => p[0] > gp.bx + 40 || p[1] < gp.y - 200);
    ink(g, BACK.slice(60, 181), { w: 1.6, a: 0.55, dry: 0.55, seed: 91 });
    // the stone ring: voussoirs, lighter on the sunny right
    const R = CY.rng(92);
    const r0 = gp.r, r1 = gp.r + gp.ring, a0 = Math.asin((gp.sill - gp.y) / r1), A = Math.PI - a0, B = a0 + 2 * Math.PI;
    const n = 44, cut = (p) => [p[0], Math.min(p[1], gp.sill)];
    const segs = [];
    for (let i = 0; i < n; i++) {
      const a = A + ((B - A) * i) / n, b = A + ((B - A) * (i + 1)) / n, pts = [];
      for (let k = 0; k <= 4; k++) { const u = a + ((b - a) * k) / 4; pts.push(cut([gp.x + Math.cos(u) * r1, gp.y + Math.sin(u) * r1])); }
      for (let k = 4; k >= 0; k--) { const u = a + ((b - a) * k) / 4; pts.push(cut([gp.x + Math.cos(u) * r0, gp.y + Math.sin(u) * r0])); }
      segs.push({ pts, mid: (a + b) / 2 });
    }
    for (const s of segs) {
      const lit = Math.cos(s.mid - 5.6);
      const c = mix('#8e8c84', '#c4bfb1', 0.45 + 0.4 * lit);
      CY.gouache(g, s.pts, { col: CY.jit(c, R, 0.06), rough: 0.9, passes: 2, erode: 0.3, eb: 1.5, seed: 93 + R.i(0, 999), pad: 6, mott: 0.15 });
    }
    for (const s of segs) {
      const p = s.pts;
      ink(g, [p[0], p[p.length - 1]], { w: 1.2, a: 0.55, dry: 0.5, seed: 94 + R.i(0, 999), nb: 2, wob: 0.3 });
    }
    const outer = CY.gatePoly(gp.x, gp.y, r1, gp.sill, 200), inner = FRONT;
    ink(g, outer, { w: 3.6, a: 0.9, dry: 0.5, seed: 95, dbl: 2, tin: 0.02, tout: 0.04, wob: 1.4 });
    ink(g, inner, { w: 3, a: 0.85, dry: 0.5, seed: 96, dbl: 1.6, tin: 0.02, tout: 0.04, wob: 1.2 });
    // grime in the joints along the bottom of the ring
    for (let i = 0; i < 8; i++) { const a = R.r(0.2, 0.9) * (R.f() < 0.5 ? 1 : -1) + (R.f() < 0.5 ? 0 : Math.PI); }
  }

  function paintCoping(g) {
    const c = G.cope;
    // the runs of the coping: uneven spacing, a lean, the odd replaced or darker tile; the eave sags a little
    const RC = CY.rng(4100), cols = [];
    for (let x = -26; x < W + 60; x += RC.r(33, 44)) {
      const st = RC.f();
      cols.push({ x, lean: RC.g() * 0.035, dy: 0, r: RC.r(12.2, 14.8), st, tone: st < 0.07 ? '#8a8f8e' : st > 0.93 ? '#596064' : null, ddy: RC.g() * 1.6 });
    }
    const sag = (x) => 4.5 * Math.sin(Math.PI * CY.clamp((x + 20) / (W + 40), 0, 1)) + 1.6 * Math.sin(x * 0.013 + 1);
    const foot = (C) => C.x + C.lean * (c.eave - c.rb);
    // tile field
    CY.gouache(g, CY.rect(-20, c.rb - 2, W + 40, c.eave - c.rb + 6), {
      col: '#555c60', rough: 1, passes: 2, erode: 0.3, seed: 100, mott: 0.12,
      fx: (t, R) => {
        tileField(t, R, -26, W + 40, c.rb - 2, c.eave + 4, 38, 26, { cols, course: 14, cov: '#737b7f', lit: '#b0b6b5', pan: '#2a2f32', dark: '#3a4044', courseA: 0.8, courseW: 1.8 });
        for (let i = 0; i < 22; i++) { t.fillStyle = rgba(R.pick(['#8e9670', '#a19a6c', '#6f7a5a']), R.r(0.25, 0.5)); CY.path(t, [CY.blob(R.r(0, W), R.r(c.rb + 10, c.eave), R.r(5, 16), R.r(3, 9), R.i(1, 999), 0.5, 16)]); t.fill(); }
        t.fillStyle = lgrad(t, 0, c.rb, 0, c.rb + 40, [[0, '#1f2224', 0.4], [1, '#1f2224', 0]]); t.fillRect(-20, c.rb - 2, W + 40, 40);
        t.fillStyle = lgrad(t, 0, 0, W, 0, [[0, '#2f3437', 0.15], [0.6, '#000', 0], [1, '#e5c18e', 0.18]]); t.fillRect(-20, c.rb - 2, W + 40, 120);
      },
    });
    // ridge: tiles set on edge, capped
    CY.gouache(g, CY.rect(-20, c.top, W + 40, c.rb - c.top + 2), {
      col: '#43494d', rough: 1, passes: 2, erode: 0.3, seed: 101,
      fx: (t, R) => {
        for (let x = -20; x < W + 30; x += 8) { t.strokeStyle = rgba(R.f() < 0.5 ? '#626a6e' : '#2a2f31', 0.75); t.lineWidth = 2.6; t.beginPath(); t.moveTo(x, c.top + 9); t.lineTo(x + 7, c.rb - 2); t.stroke(); }
        t.fillStyle = rgba('#5f676b', 1); t.fillRect(-20, c.top, W + 40, 8);
        for (let x = -20; x < W + 30; x += R.r(12.5, 17.5)) { t.fillStyle = rgba(CY.jit('#6b7377', R, 0.14), 1); t.beginPath(); t.ellipse(x, c.top + 5 + R.g() * 0.8, R.r(7, 9), R.r(4.4, 5.6), R.g() * 0.06, Math.PI, 0); t.fill(); t.strokeStyle = rgba('#24282a', R.r(0.45, 0.7)); t.lineWidth = 1.2; t.stroke(); }
        t.fillStyle = rgba('#cbb38a', 0.35); t.fillRect(-20, c.top, W + 40, 2.5);
      },
    });
    ink(g, [[-10, c.top + 1], [W * 0.3, c.top + 2], [W * 0.7, c.top + 1.5], [W + 10, c.top]], { w: 2.8, a: 0.85, dry: 0.45, seed: 102, dbl: 1.2, tin: 0.01, tout: 0.01, wob: 1.4 });
    ink(g, [[-10, c.top + 9], [W + 10, c.top + 9]], { w: 1.4, a: 0.6, dry: 0.55, seed: 103, tin: 0.01, tout: 0.01 });
    ink(g, [[-10, c.rb], [W + 10, c.rb + 1]], { w: 2.2, a: 0.8, dry: 0.45, seed: 104, tin: 0.01, tout: 0.01 });
    // the cover tiles' edges, following each run's lean
    cols.forEach((C, i) => {
      const hw = 13 * ((cols[i + 1] ? cols[i + 1].x - C.x : 38) / 38), fx = foot(C) - C.x;
      ink(g, [[C.x - hw, c.rb + 2], [C.x - hw + fx + CY.hash(i, 2, 9) * 2 - 1, c.eave + sag(C.x)]], { w: 2, a: 0.8, dry: 0.55, seed: 105 + i * 3, nb: 3, tin: 0.05, tout: 0.1 });
      if (CY.hash(i, 9, 9) < 0.7) ink(g, [[C.x + hw, c.rb + 2], [C.x + hw + fx, c.eave + sag(C.x)]], { w: 1.1, a: 0.5, dry: 0.6, seed: 106 + i * 3, nb: 2 });
    });
    // drip tiles (pointed lips) between the round end tiles; each sits where its run ends, on the sagging eave
    const drips = [], discs = [], gone = [];
    cols.forEach((C, i) => {
      if (!cols[i + 1]) return;
      const N = cols[i + 1], m = (foot(C) + foot(N)) / 2, e = c.eave + sag(m) + C.ddy * 0.5, hw = Math.min(16, (N.x - C.x) / 2.5);
      drips.push(CY.smooth([[m - hw, e - 2], [m + hw, e - 2], [m + hw - 2, e + 10], [m + 4, e + (c.drip - c.eave) - 4], [m + C.ddy * 0.4, e + (c.drip - c.eave) + C.ddy * 0.6], [m - 4, e + (c.drip - c.eave) - 4], [m - hw + 2, e + 10]], 2, true));
      const fx = foot(C), dy = c.disc + sag(fx) + C.ddy;
      if (C.st > 0.5 && C.st < 0.54) gone.push([fx, dy, C.r]); // an end tile lost: the dark socket shows
      else discs.push({ poly: CY.circle(fx, dy, C.r, 30), x: fx, y: dy, r: C.r, i, tone: C.tone });
    });
    CY.gouache(g, drips, { col: '#4c5357', rough: 0.6, passes: 2, erode: 0.25, eb: 1.5, seed: 107, rule: 'nonzero', fx: (t) => { t.fillStyle = lgrad(t, 0, c.eave, 0, c.drip, [[0, '#1d2123', 0.35], [1, '#9aa2a3', 0.2]]); t.fillRect(-40, c.eave - 4, W + 80, 50); } });
    for (const [x, y, r] of gone) { g.fillStyle = rgba('#25292b', 0.85); g.beginPath(); g.ellipse(x, y - 2, r * 0.8, r * 0.6, 0, 0, 6.283); g.fill(); CY.crack(g, x - r * 0.6, y - 4, 0.4, 14, 4200 + x, { w: 1, a: 0.5 }); }
    CY.gouache(g, discs.map((d) => d.poly), { col: '#7b8285', rough: 0.6, passes: 2, erode: 0.25, eb: 1.5, seed: 108, rule: 'nonzero', fx: (t, R2) => {
      t.fillStyle = lgrad(t, 0, 0, W, 0, [[0, '#3c4245', 0.3], [1, '#d9c39c', 0.25]]); t.fillRect(-40, c.eave, W + 80, 50);
      for (const d of discs) { t.fillStyle = rgba(d.tone || CY.jit('#7b8285', R2, 0.12), d.tone ? 0.55 : 0.35); t.beginPath(); t.arc(d.x, d.y, d.r + 2, 0, 6.283); t.fill(); }
    } });
    const R = CY.rng(109);
    drips.forEach((dp, k) => CY.inkPoly(g, dp, { w: 1.4, a: 0.7, dry: 0.45, seed: 110 + k, seg: [40, 80] }));
    for (const d of discs) {
      const k = d.i, x = d.x, y = d.y;
      ink(g, CY.circle(x, y, d.r, 28).concat([[x + d.r, y]]), { w: 1.8, a: 0.8, dry: 0.4, seed: 111 + k * 5, tin: 0.02, tout: 0.04 });
      // the end-tile motif: an inner ring and a small whorl, invented; worn away on some
      if (R.f() < 0.85) ink(g, CY.circle(x, y, d.r * 0.63, 20).concat([[x + d.r * 0.63, y]]), { w: 0.9, a: 0.5 * R.r(0.5, 1), dry: 0.5, seed: 112 + k * 5, nb: 2 });
      const wh = []; for (let s2 = 0; s2 < 14; s2++) { const a = s2 * 0.6 + k, r = 1 + s2 * 0.42; wh.push([x + Math.cos(a) * r, y + Math.sin(a) * r]); }
      if (R.f() < 0.8) ink(g, wh, { w: 1, a: 0.55 * R.r(0.4, 1), dry: 0.3, seed: 113 + k * 5, nb: 2 });
      if (R.f() < 0.12) CY.crack(g, x + R.g() * 4, y - d.r * 0.8, 1.5 + R.g() * 0.3, d.r * 1.4, 4300 + k, { w: 0.9, a: 0.55 });
      if (R.f() < 0.3) CY.wash(g, CY.blob(x + 4, y + 4, 8, 6, 114 + k, 0.3, 16), '#8f9a7c', { a: 0.4, blur: 1.5, seed: 114 + k, rim: 0.4 }); // lichen
    }
    // painted band under the eave, with a running scroll
    CY.gouache(g, CY.rect(-20, c.drip - 2, W + 40, c.band - c.drip + 2), { col: '#d6d0c2', rough: 1, passes: 2, erode: 0.35, seed: 115, streaks: { dens: 300, ang: 0, len: [20, 90], w: [1, 4], a: [0.08, 0.2], cols: ['#bfb8a8', '#e4dfd2'] } });
    ink(g, [[-10, c.band], [W + 10, c.band + 1]], { w: 1.8, a: 0.7, dry: 0.5, seed: 116, tin: 0.01, tout: 0.01 });
    ink(g, [[-10, c.band - 4], [W + 10, c.band - 3]], { w: 0.9, a: 0.4, dry: 0.6, seed: 117, nb: 2, tin: 0.01, tout: 0.01 });
    for (let x = 30, k = 0; x < W; x += 76, k++) {
      const pts = [];
      for (let s = 0; s <= 22; s++) { const a = -Math.PI / 2 + s * 0.42, r = 6.5 - s * 0.24; pts.push([x + s * 1.6 + Math.cos(a) * r * (k % 2 ? -1 : 1), c.drip + 9 + Math.sin(a) * r * 0.75]); }
      ink(g, pts, { w: 1, a: 0.35, dry: 0.4, seed: 118 + k, nb: 2 });
    }
  }

  function paintPlinth(g) {
    const y0 = 1500, y1 = G.wallBot;
    CY.gouache(g, CY.rect(-20, y0, W + 40, y1 - y0 + 4), {
      col: '#9c9a91', rough: 1, passes: 2, erode: 0.3, seed: 120, mott: 0.18,
      fx: (t, R) => {
        for (let row = 0; row < 2; row++) for (let x = -20 + row * 50 + R.r(-10, 10); x < W + 20; x += R.r(90, 150)) {
          t.fillStyle = rgba(CY.jit('#a5a296', R, 0.08), 0.6); t.fillRect(x + 2, y0 + row * 40 + 2, R.r(80, 140), 36);
        }
        t.fillStyle = lgrad(t, 0, y0, 0, y1, [[0, '#ffffff', 0.15], [1, '#3d3a35', 0.25]]); t.fillRect(-20, y0, W + 40, y1 - y0);
      },
    });
    const R = CY.rng(121);
    ink(g, [[-10, y0], [W + 10, y0 + 1]], { w: 1.8, a: 0.65, dry: 0.5, seed: 122, tin: 0.01, tout: 0.01 });
    ink(g, [[-10, y0 + 40], [W + 10, y0 + 41]], { w: 1.1, a: 0.45, dry: 0.6, seed: 123, nb: 2, tin: 0.01, tout: 0.01 });
    for (let row = 0; row < 2; row++) for (let x = R.r(40, 100); x < W; x += R.r(90, 150)) ink(g, [[x, y0 + row * 40 + 2], [x + R.g() * 2, y0 + row * 40 + 38]], { w: 1.1, a: 0.45, dry: 0.5, seed: 124 + x + row, nb: 2 });
  }

  // ------------------------------------------------------------------ ground, steps, sill
  function paintGround(g) {
    const GL = CY.mk(W, H), q = GL.g;
    const top = G.wallBot - 4;
    CY.gouache(q, CY.rect(-20, top, W + 40, H - top + 20), {
      col: '#d7cfbb', rough: 0, passes: 1, erode: 0, seed: 130, mott: 0.16,
      fx: (t) => { t.fillStyle = lgrad(t, 0, top, 0, top + 120, [[0, '#9d9a8f', 0.4], [1, '#9d9a8f', 0]]); t.fillRect(-20, top, W + 40, 120); },
    });
    const R = CY.rng(131);
    const rows = [top, 1626, 1676, 1734, 1802, 1880, 1960];
    for (let r = 0; r < rows.length - 1; r++) {
      const y0 = rows[r] + R.g() * 2, y1 = rows[r + 1];
      let x = -R.r(0, 140);
      while (x < W + 20) {
        const w = R.r(90, 240) * (1 + r * 0.15), x1 = x + w, sk = R.g() * 6;
        const jy0 = y0 + R.g() * 2.5, jy1 = y1 + R.g() * 2.5;
        const slab = [[x + 3 + sk * 0.3, jy0 + 2], [x1 - 2 + sk * 0.3, jy0 + 2 + R.g() * 2], [x1 - 3 - sk * 0.3, jy1 - 2], [x + 2 - sk * 0.3, jy1 - 2 + R.g() * 2]];
        CY.gouache(q, slab, { col: CY.jit(R.pick(['#c6bea9', '#bdb5a2', '#cfc6b0', '#b9b3a3', '#c3b9a0']), R, 0.06), rough: 2.6, passes: 2, erode: 0.75, seed: 132 + r * 50 + (x | 0), a: R.r(0.4, 0.65), mott: 0.24,
          streaks: { dens: 500, ang: R.g() * 0.3, len: [8, 40], w: [1, 3], a: [0.08, 0.2], cols: ['#a59d8a', '#d8d0bc'] } });
        if (R.f() < 0.75) ink(q, [[x1 - 2 + sk * 0.3, jy0 + 3], [x1 - 3 - sk * 0.3, jy1 - 3]], { w: 1.3, a: 0.42, dry: 0.75, seed: 133 + r * 50 + (x | 0), nb: 2 });
        if (R.f() < 0.55) ink(q, [[x + 4, jy1 - 1], [x1 - 6, jy1 - 1 + R.g() * 2]], { w: R.r(1.1, 1.8), a: 0.42, dry: 0.75, seed: 134 + r * 50 + (x | 0), nb: 2 });
        if (R.f() < 0.25) { const cx = R.r(x + 20, x1 - 20), cy = R.r(y0 + 8, y1 - 8); CY.crack(q, cx, cy, R.r(0, 6.28), R.r(20, 50), 135 + r * 50 + (x | 0), { w: 0.9, a: 0.35 }); }
        x = x1;
      }
    }
    // dissolve the ground into the paper toward the bottom of the sheet
    const img = q.getImageData(0, 0, W, H), d = img.data, F = CY.F;
    for (let y = top; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 4, fi = y * W + x;
        const side = Math.min(x, W - x) / W;
        const v = 1 - CY.sm(1700, 1890, y + (F.edge[fi] - 0.5) * 120 + (F.mot[fi] - 0.5) * 160 - side * 200);
        d[i + 3] *= v;
      }
    }
    q.putImageData(img, 0, 0);
    g.drawImage(GL.c, 0, 0);
  }

  function stoneBlock(g, x0, x1, top, face, bot, seed, o) {
    o = o || {};
    const R = CY.rng(seed);
    // shadow cast to the left by the sun on the right
    CY.wash(g, [[x0, face], [x0, bot], [x0 - 36, bot + 4], [x0 - 28, face + 8]], '#6f6a70', { a: 0.42, blur: 3, seed: seed + 40, rim: 0 });
    // the run is laid as separate stones of uneven length, not quite level, with worn and chipped nosings
    const blocks = [];
    for (let x = x0; x < x1 - 1;) { let w = R.f() < 0.2 ? R.r(70, 110) : R.r(130, 250); if (x1 - (x + w) < 70) w = x1 - x; blocks.push([x, x + w]); x += w; }
    blocks.forEach(([a, b], k) => {
      // each stone has settled its own way: tilted, a little proud or sunk, its nosing worn into shallow dips
      // where feet go, and now and then a bite broken out of the edge
      const dyL = R.g() * 1.8, dyR = R.g() * 1.8, fo = R.g() * 2;
      const dy = (dyL + dyR) / 2 + fo;
      const lin = (xx) => dyL + (dyR - dyL) * ((xx - a) / (b - a));
      const bite = R.f() < 0.5 ? [R.r(a + 8, b - 40), R.r(14, 36), R.r(4, 9)] : null;
      const wear = R.r(1, 3.4);
      const nose = [];
      for (let xx = a; xx <= b + 0.1; xx += 5) {
        const u = (xx - a) / (b - a);
        let yy = face + lin(xx) + fo + (CY.vnoise(xx * 0.07, k * 3.1, seed) - 0.5) * 3.2 + (CY.vnoise(xx * 0.31, k * 3.1 + 9, seed) - 0.5) * 1.3 + 1.4 * Math.sin((xx - a) * 0.018 + k * 2.1) + wear * Math.sin(u * Math.PI);
        if (bite && xx > bite[0] && xx < bite[0] + bite[1]) yy += bite[2] * Math.sin(((xx - bite[0]) / bite[1]) * Math.PI);
        // worn, rounded corners
        yy += 3.5 * Math.max(0, 1 - (xx - a) / 9) * (k ? 1 : 0.5) + 3.5 * Math.max(0, 1 - (b - xx) / 9) * (k === blocks.length - 1 ? 0.5 : 1);
        nose.push([Math.min(xx, b), yy]);
      }
      const tread = [[a + (k ? 1.5 : 4), top + lin(a) + R.g() * 0.6], [(a + b) / 2 + R.g() * 20, top + (dyL + dyR) / 2 + R.g() * 0.8], [b - (k === blocks.length - 1 ? 4 : 1.5), top + lin(b)]].concat(nose.slice().reverse());
      const riser = nose.concat([[b, bot + R.g() * 1.2], [b - (b - a) * 0.33, bot + R.g() * 1.6], [a + (b - a) * 0.33, bot + R.g() * 1.6], [a, bot + R.g() * 1.2]]);
      CY.gouache(g, tread, {
        col: CY.jit(o.tread || R.pick(['#c9c1ac', '#cdc3aa', '#c2bcaa', '#c8c0a6']), R, 0.06), rough: 1.4, passes: 3, erode: 0.45, seed: seed + 1 + k * 7, mott: 0.22,
        streaks: { dens: 110, ang: 0, angv: 0.05, len: [14, 70], w: [1, 3.5], a: [0.12, 0.3], cols: ['#a59f90', '#ddd5c2', '#b7ae98'] },
        fx: (t) => { t.fillStyle = lgrad(t, a, 0, b, 0, [[0, '#a7a194', 0.25], [1, '#f2d9a8', 0.35]]); t.fillRect(a - 8, top - 4, b - a + 16, face - top + 14); },
      });
      CY.gouache(g, riser, {
        col: CY.jit(o.riser || R.pick(['#8b887e', '#878a7c', '#938b7d', '#808079', '#8e8a80']), R, 0.08), rough: 1.4, passes: 3, erode: 0.4, seed: seed + 2 + k * 7, mott: 0.24,
        streaks: { dens: 140, ang: 0, angv: 0.15, len: [6, 30], w: [2, 6], a: [0.08, 0.22], cols: ['#6f6c63', '#a7a397', '#7c8770', '#5d5a53'] },
        fx: (t, R2) => {
          t.strokeStyle = rgba('#3e3a36', 0.4); t.lineWidth = 6; t.beginPath(); t.moveTo(a - 4, face + dy + 4); t.lineTo(b + 4, face + dy + 4); t.stroke();
          for (let i = 0; i < 7; i++) { t.fillStyle = rgba(R2.pick(['#5c584f', '#a9a598', '#6d7560']), R2.r(0.12, 0.25)); CY.path(t, [CY.blob(R2.r(a, b), R2.r(face + 8, bot - 4), R2.r(8, 26), R2.r(4, 10), R2.i(1, 999), 0.5, 18)]); t.fill(); }
        },
      });
      CY.ink(g, nose, { w: R.r(1.8, 2.6), a: 0.85, dry: 0.6, seed: seed + 3 + k * 7, dbl: 1.1, tin: R.r(0.04, 0.2), tout: R.r(0.08, 0.3), wob: 0.8 });
      if (R.f() < 0.8) CY.ink(g, [[a + 4, top + dy], [b - 4, top + dy]], { w: 1.3, a: 0.5, dry: 0.65, seed: seed + 4 + k * 7, nb: 2 });
      if (k) {
        // a dark joint, and moss where the joint meets the ground
        g.fillStyle = rgba('#3d3a35', 0.55); g.fillRect(a - 1.2, top + lin(a), 2.6, bot - top - lin(a));
        if (R.f() < 0.6) CY.wash(g, CY.blob(a, bot - R.r(3, 8), R.r(5, 10), R.r(3, 7), seed + 50 + k, 0.5, 14), R.pick(['#6f7d52', '#7e8a5e', '#5f6c48']), { a: 0.55, blur: 1.2, seed: seed + 50 + k, rim: 0.3 });
        CY.ink(g, [[a, face + dy + 3], [a + R.g() * 1.5, bot - 1]], { w: 1.6, a: 0.7, dry: 0.45, seed: seed + 5 + k * 7, nb: 2 });
        CY.ink(g, [[a + 2, top + dy + 1], [a, face + dy - 1]], { w: 1.1, a: 0.45, dry: 0.5, seed: seed + 6 + k * 7, nb: 2 });
      }
      // chips out of the nosing
      for (let i = 0; i < 2; i++) { const x = R.r(a + 15, b - 15); CY.wash(g, [[x - 7, face + dy], [x + 8, face + dy], [x + 1, face + dy + R.r(4, 8)]], '#5e5a52', { a: 0.45, blur: 0.6, seed: seed + 20 + k * 3 + i, rim: 0.5 }); }
    });
    CY.ink(g, [[x0, face], [x0 + R.g(), bot]], { w: 2, a: 0.8, dry: 0.45, seed: seed + 5 });
    CY.ink(g, [[x1, face], [x1, bot]], { w: 1.5, a: 0.55, dry: 0.55, seed: seed + 6 });
    for (let i = 0; i < 6; i++) { const x = R.f() < 0.5 ? R.r(x0, x0 + 60) : R.r(x1 - 60, x1); CY.wash(g, CY.blob(x, bot - R.r(2, 10), R.r(6, 16), R.r(3, 6), seed + 30 + i, 0.4, 16), '#7e8a5e', { a: 0.4, blur: 1.5, seed: seed + 30 + i, rim: 0.2 }); }
  }
  function paintSteps(g) {
    const s = G.sill;
    const R = CY.rng(139);
    for (let k = G.steps.length - 1; k >= 0; k--) { const st = G.steps[k]; stoneBlock(g, st.x0 + R.g() * 5, st.x1 + R.g() * 5, st.top, st.face + R.g(), st.bot, 140 + k * 10); }
    stoneBlock(g, s.x0 + R.g() * 4, s.x1 + R.g() * 4, s.top, s.face, s.bot, 170, { tread: '#c4beae', riser: '#96928a' });
  }

  // ------------------------------------------------------------------ the glazed pot the vine grows from
  function potPoly() {
    const p = G.pot, prof = [[1438, 72], [1444, 75], [1452, 66], [1468, 62], [1492, 90], [1530, 112], [1590, 120], [1650, 110], [1700, 88], [1730, 72], [1746, 68]];
    const pts = CY.smooth(prof.map((q) => [q[1], q[0]]), 3);
    return pts.map((q) => [p.x + q[0], q[1]]).concat(pts.slice().reverse().map((q) => [p.x - q[0], q[1]]));
  }
  function paintPot(g) {
    const p = G.pot, poly = potPoly();
    // shadows: on the ground to the left, and up the wall behind
    CY.wash(g, CY.blob(p.x - 70, p.base + 2, 120, 18, 150, 0.15), '#6d6874', { a: 0.5, blur: 6, rim: 0, seed: 150 });
    CY.wash(g, poly.map((q) => [q[0] - 74, q[1] - 26]), '#7d7884', { a: 0.32, blur: 7, rim: 0, seed: 151 });
    CY.gouache(g, poly, {
      col: '#2c4c56', rough: 1.4, passes: 3, erode: 0.35, seed: 152, mott: 0.14,
      streaks: { dens: 90, ang: Math.PI / 2, angv: 0.08, len: [20, 90], w: [2, 6], a: [0.08, 0.22], cols: ['#1e3740', '#3c6670', '#2a4a50'] },
      fx: (t, R) => {
        t.fillStyle = lgrad(t, p.x - 120, 0, p.x + 120, 0, [[0, '#0f1d22', 0.55], [0.45, '#000', 0], [0.7, '#5d8c8e', 0.55], [0.82, '#88b0aa', 0.55], [0.92, '#355a60', 0.2], [1, '#0f1d22', 0.4]]);
        t.fillRect(p.x - 130, p.top, 260, p.base - p.top);
        // a pale glaze ring at the shoulder, running in drips
        const ring = [[p.x - 120, 1488]];
        for (let x = p.x - 120; x <= p.x + 120; x += 6) ring.push([x, 1506 + 10 * Math.sin(x * 0.11) + (R.f() < 0.15 ? R.r(10, 34) : 0)]);
        ring.push([p.x + 120, 1488]);
        t.fillStyle = rgba('#6f9a9a', 0.45); CY.path(t, [CY.smooth(ring, 2, true)]); t.fill();
        // glints
        t.strokeStyle = rgba('#d6e6dc', 0.75); t.lineWidth = 4; t.lineCap = 'round';
        t.beginPath(); t.moveTo(p.x + 74, 1520); t.quadraticCurveTo(p.x + 86, 1580, p.x + 76, 1640); t.stroke();
        t.strokeStyle = rgba('#d6e6dc', 0.4); t.lineWidth = 2; t.beginPath(); t.moveTo(p.x + 62, 1500); t.lineTo(p.x + 66, 1508); t.stroke();
        // crackle in the glaze
        t.strokeStyle = rgba('#14262c', 0.35); t.lineWidth = 0.8;
        for (let i = 0; i < 40; i++) { const x = p.x + R.r(-90, 90), y = R.r(1520, 1690); t.beginPath(); t.moveTo(x, y); t.lineTo(x + R.g() * 8, y + R.g() * 8); t.lineTo(x + R.g() * 12, y + R.g() * 12); t.stroke(); }
        // unglazed foot
        const foot = [[p.x - 120, 1760]];
        for (let x = p.x - 120; x <= p.x + 120; x += 5) foot.push([x, 1706 + 6 * Math.sin(x * 0.09) + 4 * Math.sin(x * 0.31)]);
        foot.push([p.x + 120, 1760]);
        t.fillStyle = rgba('#a88b6c', 1); CY.path(t, [foot]); t.fill();
        t.fillStyle = lgrad(t, p.x - 80, 0, p.x + 80, 0, [[0, '#4a3a2c', 0.5], [1, '#e2c49a', 0.3]]); CY.path(t, [foot]); t.fill();
      },
    });
    // mouth: dark soil
    g.fillStyle = rgba('#1c1714', 0.95); g.beginPath(); g.ellipse(p.x, p.top + 3, 64, 8, 0, 0, 6.283); g.fill();
    CY.inkPoly(g, poly, { w: 2.6, a: 0.85, dry: 0.45, seed: 153, dbl: 1.6, seg: [80, 200] });
    ink(g, CY.circle(p.x, p.top + 3, 1, 40).map((q, i) => [p.x + Math.cos((i / 40) * 6.283) * 70, p.top + 3 + Math.sin((i / 40) * 6.283) * 9]), { w: 1.8, a: 0.75, dry: 0.4, seed: 154 });
  }

  // ------------------------------------------------------------------ the vine's old wood
  function paintVine(g) {
    const sk = G.skel;
    // static shadows of the wood on the plaster
    const sh = CY.mk(W, H), s = sh.g;
    s.strokeStyle = '#000'; s.lineCap = 'round'; s.lineJoin = 'round';
    const strokeSk = (pts, w) => { s.lineWidth = w; s.beginPath(); pts.forEach((p, i) => (i ? s.lineTo(p[0] + G.shadowOff[0] * 0.6, p[1] + G.shadowOff[1] * 0.6) : s.moveTo(p[0] + G.shadowOff[0] * 0.6, p[1] + G.shadowOff[1] * 0.6))); s.stroke(); };
    strokeSk(sk.trunk, 24); strokeSk(sk.cope, 6); strokeSk(sk.low1, 5); strokeSk(sk.low2, 5); strokeSk(sk.left, 7);
    s.globalCompositeOperation = 'destination-in'; CY.path(s, [WALL, FRONT]); s.fill('evenodd');
    const b = CY.mk(W, H); b.g.filter = 'blur(3px)'; b.g.drawImage(sh.c, 0, 0);
    b.g.globalCompositeOperation = 'source-in'; b.g.fillStyle = '#857e8c'; b.g.fillRect(0, 0, W, H);
    g.save(); g.globalCompositeOperation = 'multiply'; g.globalAlpha = 0.5; g.drawImage(b.c, 0, 0); g.restore();

    // the trunk: four old stems twisting round each other like a rope, thinning upward
    const T = CY.resample(sk.trunk, 3);
    const taper = (s) => 1 - (s / T.L) * 0.45;
    // a brown-grey underpainting for the woody mass, then a lit flank
    g.save(); g.lineCap = 'round'; g.lineJoin = 'round';
    for (let i = 0; i < T.length - 1; i++) {
      g.strokeStyle = rgba('#4a3a30', 0.75); g.lineWidth = 26 * taper(T[i].s);
      g.beginPath(); g.moveTo(T[i].x, T[i].y); g.lineTo(T[i + 1].x, T[i + 1].y); g.stroke();
    }
    g.restore();
    const stems = [0, 1, 2, 3].map((k) => {
      const ph = (s) => s / 46 + k * 1.57;
      const pts = T.map((p) => { const o = 9.5 * Math.sin(ph(p.s)) * taper(p.s); return [p.x + p.nx * o, p.y + p.ny * o]; });
      return { pts, k };
    });
    // draw each stem in short runs, back runs (cos < 0) first, so they pass behind and in front of each other
    for (const front of [false, true]) {
      for (const st of stems) {
        let run = [];
        const flush = (i) => {
          if (run.length > 3) {
            const w = 8.5 * taper(T[i].s);
            CY.ink(g, run, { w, col: front ? [40, 29, 24] : [70, 54, 44], a: front ? 0.95 : 0.8, dry: 0.38, seed: 160 + st.k * 31 + i, tin: 0.08, tout: 0.08, wob: 0.8 });
            if (front) CY.ink(g, run.map((p) => [p[0] + w * 0.28, p[1] - 0.5]), { w: w * 0.3, col: [164, 140, 112], a: 0.5, dry: 0.6, seed: 170 + st.k * 31 + i, nb: 2, tin: 0.2, tout: 0.2 });
          }
          run = [];
        };
        for (let i = 0; i < T.length; i++) {
          const isFront = Math.cos(T[i].s / 46 + st.k * 1.57) >= 0;
          if (isFront === front) run.push(st.pts[i]); else flush(i);
        }
        flush(T.length - 1);
      }
    }
    // knots and old pruning scars
    const RK = CY.rng(185);
    for (let i = 0; i < 9; i++) {
      const p = T[Math.floor(RK.r(0.05, 0.9) * T.length)];
      g.fillStyle = rgba('#2a1e19', 0.8); g.beginPath(); g.ellipse(p.x + RK.g() * 4, p.y, RK.r(3, 6), RK.r(2, 4), RK.g(), 0, 6.283); g.fill();
      g.strokeStyle = rgba('#a48a6c', 0.5); g.lineWidth = 1; g.beginPath(); g.arc(p.x + 1, p.y - 1, 5, 3.6, 5.6); g.stroke();
    }
    // branches (static wood; the flowering twigs are in the cluster sprites)
    const br = (pts, w0, seed) => { CY.ink(g, pts, { w: w0, col: [46, 34, 28], a: 0.9, dry: 0.42, seed, tin: 0.02, tout: 0.35, press: (u) => 1 - u * 0.55, wob: 1, dbl: 1 }); CY.ink(g, pts.map((p) => [p[0] + 1.6, p[1] - 1]), { w: 1.4, col: [150, 128, 104], a: 0.35, dry: 0.7, seed: seed + 1, nb: 2 }); };
    br(sk.ridge, 7, 170); br(sk.left, 6.5, 172); br(sk.cope, 5.5, 174); br(sk.low1, 4, 176); br(sk.low2, 4, 178);
    // thorns and nodes
    const R = CY.rng(180);
    for (const pts of [sk.trunk, sk.ridge, sk.left, sk.cope, sk.low2]) {
      const P = CY.resample(pts, 22);
      for (const p of P) if (R.f() < 0.5) { const sd = R.sign(); ink(g, [[p.x, p.y], [p.x + p.nx * sd * 7 + R.g(), p.y + p.ny * sd * 7 - 3]], { w: 1.4, a: 0.8, dry: 0.1, seed: R.i(1, 9999), nb: 2, tin: 0.01, tout: 0.9 }); }
    }
  }

  // ------------------------------------------------------------------ seal and brush marks (invented)
  function paintOver() {
    const L = CY.mk(W, H), g = L.g;
    const R = CY.rng(190);
    // abstract running script: two continuous flowing lines of loops and pressure swells. Never separate glyphs,
    // so nothing can read as a real character; it carries only the rhythm of a hand.
    let y = 1046;
    const x = 1040;
    for (let col = 0; col < 2; col++) {
      const cx = x - col * 26, y0 = 1046 + col * 30, y1 = col ? 1250 : 1316;
      // a wandering pen: the centre drifts on noise, the nib circles at a rate that itself wanders, so loops
      // come irregularly, tight then open, never repeating as a shape
      const pts = [];
      let th = R.f() * 6.28;
      for (let v = y0; v < y1; v += 1.6) {
        const rate = 0.05 + 0.32 * Math.pow(CY.fbm(v * 0.012, col * 7.1, 197, 2), 2.2);
        th += rate;
        const rad = 3 + 7 * CY.fbm(v * 0.02, col * 3.3, 198, 2);
        pts.push([cx + (CY.fbm(v * 0.006, col * 5.7, 199, 3) - 0.5) * 22 + Math.cos(th) * rad, v + Math.sin(th) * rad * 0.8]);
      }
      // the brush lifts now and then, and the ink runs dry before each reload
      let i = 0;
      while (i < pts.length - 4) {
        const n = R.i(18, 46);
        CY.ink(g, pts.slice(i, Math.min(pts.length, i + n)), { w: R.r(2.4, 4.2), a: 0.82, dry: 0.5, seed: 191 + col * 50 + i, tin: 0.12, tout: 0.4, press: (q) => 0.55 + 0.45 * Math.sin(q * Math.PI * 2.3 + i), wob: 0.4 });
        i += n + R.i(2, 7);
      }
      y = Math.max(y, y1);
    }
    y += 10;
    // the seal: vermilion, uneven, an invented maze-like glyph cut in white
    const sx = 1006, sy = y + 18, ss = 56;
    CY.gouache(g, CY.rect(sx, sy, ss, ss), {
      col: '#bf3328', rough: 1.1, passes: 3, erode: 0.5, eb: 2, holes: 0.9, grain: 2, mott: 0.22, seed: 193,
      fx: (t, R2) => {
        t.globalCompositeOperation = 'destination-out';
        t.strokeStyle = 'rgba(0,0,0,0.92)'; t.lineCap = 'square'; t.lineWidth = 4.2;
        const c = (u) => sx + 9 + u * ((ss - 18) / 4), r = (v) => sy + 9 + v * ((ss - 18) / 4);
        const strokes = [[[0, 0], [0, 4]], [[0, 0], [2, 0], [2, 2], [1, 2]], [[4, 0], [3, 0], [3, 3], [4, 3], [4, 4], [2, 4]], [[1, 3], [2, 3]], [[0, 4], [1, 4]]];
        for (const s of strokes) { t.beginPath(); s.forEach((p, i) => (i ? t.lineTo(c(p[0]), r(p[1])) : t.moveTo(c(p[0]), r(p[1])))); t.stroke(); }
        t.lineWidth = 3; t.beginPath(); t.arc(c(1), r(1), 3.5, 0, 6.283); t.stroke();
        for (let i = 0; i < 40; i++) { t.fillStyle = 'rgba(0,0,0,0.6)'; t.fillRect(R2.r(sx, sx + ss), R2.r(sy, sy + ss), R2.r(1, 2.5), R2.r(1, 2.5)); }
      },
    });
    L.box = [990, 1020, 90, sy + ss + 20 - 1020];
    return L;
  }

  // ------------------------------------------------------------------ warm late sun, and the paper
  function paintLight() {
    const L = CY.mk(W, H), g = L.g;
    const rg = g.createRadialGradient(1180, 820, 60, 1180, 820, 1150);
    rg.addColorStop(0, 'rgba(255,196,120,0.75)'); rg.addColorStop(0.5, 'rgba(255,186,110,0.35)'); rg.addColorStop(1, 'rgba(255,180,110,0)');
    g.fillStyle = rg; g.fillRect(0, 0, W, H);
    // not on the sky or the far courtyard's shade
    g.globalCompositeOperation = 'destination-out';
    g.fillStyle = lgrad(g, 0, 380, 0, 660, [[0, '#000', 1], [1, '#000', 0]]); g.fillRect(0, 0, W, 660);
    return L;
  }
  function paintPaper() {
    const L = CY.mk(W, H), g = L.g, F = CY.F;
    const img = g.createImageData(W, H), d = img.data;
    for (let i = 0, p = 0; p < W * H; p++, i += 4) {
      const x = p % W, y = (p / W) | 0;
      const v = 1 - 0.16 * F.grain[p] - 0.07 * F.mot[p];
      const dx = (x - W / 2) / (W / 2), dy = (y - H * 0.47) / (H / 2);
      const vig = 1 - 0.15 * Math.pow(Math.min(1, Math.sqrt(dx * dx * 0.8 + dy * dy * 0.9)), 2.4);
      d[i] = 255 * v * vig; d[i + 1] = 252 * v * vig * 0.995; d[i + 2] = 246 * v * vig * 0.975; d[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    // fibres
    const R = CY.rng(200);
    g.lineCap = 'round';
    for (let i = 0; i < 4200; i++) {
      const x = R.r(0, W), y = R.r(0, H), a = R.f() * 6.283, l = R.r(4, 26);
      g.strokeStyle = `rgba(150,130,105,${R.r(0.05, 0.14).toFixed(3)})`; g.lineWidth = R.r(0.5, 1.1);
      g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a + 0.5) * l * 0.5, y + Math.sin(a + 0.5) * l * 0.5, x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
    }
    return L;
  }
  function paintWallMask() {
    const L = CY.mk(W, H), g = L.g;
    CY.path(g, [[[-20, G.cope.top], [W + 20, G.cope.top], [W + 20, G.wallBot], [-20, G.wallBot]], CY.gatePoly(gp.x, gp.y, gp.r - 2, gp.sill)]);
    g.fillStyle = '#000'; g.fill('evenodd');
    // the pot is in front of the wall
    CY.path(g, [potPoly()]); g.globalCompositeOperation = 'destination-out'; g.fill();
    return L;
  }

  CY.paintScene = function () {
    const dbg = /[?&]debug/.test(location.search);
    const stage = (name, fn) => { const t0 = performance.now(); if (dbg) console.log('start', name); fn(); if (dbg) console.log(name, (performance.now() - t0).toFixed(0) + ' ms'); };
    const L = {};
    stage('L.sky = paintSky();', () => { L.sky = paintSky(); });
    stage('L.far = paintFar();', () => { L.far = paintFar(); });
    // the far courtyard in the late sun: the same painting, warmed and lifted (colour-dodge brightens in
    // proportion, so the red door turns brighter red and the grey wall warm cream, rather than everything paling)
    stage('L.farLit', () => {
      const Lt = CY.mk(W, H), q = Lt.g, I = G.inner;
      q.drawImage(L.far.c, 0, 0);
      q.globalCompositeOperation = 'color-dodge'; q.fillStyle = 'rgb(78,46,4)'; q.fillRect(0, I.Y0 - 30, W, H - I.Y0 + 30);
      q.globalCompositeOperation = 'multiply'; q.fillStyle = 'rgb(255,250,236)'; q.fillRect(0, I.Y0 - 30, W, H - I.Y0 + 30);
      q.globalCompositeOperation = 'source-over';
      const RL = CY.rng(33);
      const edge = [];
      for (let x = I.X1 + 20; x >= I.X0 - 20; x -= 6) edge.push([x, I.SHADE + 70 - (x - I.X0) * 0.26 + 6 * CY.fbm(x * 0.02, 3, 31, 2) + 4 * Math.abs(Math.sin(((x - 4) * Math.PI) / 31)) + RL.g() * 0.6]);
      G.sunEdge = edge;
      L.farLit = Lt;
    });
    const F = CY.mk(W, H), g = F.g;
    // the paper itself shows below the painting
    g.fillStyle = '#efe6d1'; g.fillRect(0, G.wallBot - 10, W, H);
    stage('paintPlaster(g);', () => { paintPlaster(g); });
    stage("peel(g, 92, 1010, 58, 82, 210, 'brick');", () => { peel(g, 92, 1010, 58, 82, 210, 'brick'); });
    stage("peel(g, 1010, 900, 62, 40, 220, 'brick')", () => { peel(g, 1010, 900, 62, 40, 220, 'brick'); });
    stage("peel(g, 892, 1440, 44, 30, 230, 'blue');", () => { peel(g, 892, 1440, 44, 30, 230, 'blue'); });
    stage("peel(g, 404, 880, 30, 18, 240, 'blue');", () => { peel(g, 404, 880, 30, 18, 240, 'blue'); });
    const R = CY.rng(250);
    clipTo(g, [WALL, FRONT], 'evenodd', () => {
      CY.crack(g, gp.x + 250, gp.y - 210, -0.9, 120, 251, { w: 1.2, a: 0.5 });
      CY.crack(g, gp.x - 270, gp.y - 150, -2.4, 90, 252, { w: 1.1, a: 0.5 });
      CY.crack(g, 960, 840, 1.6, 180, 253, { w: 1.1, a: 0.45 });
      CY.crack(g, 40, 860, 1.4, 160, 254, { w: 1, a: 0.45 });
      CY.crack(g, 1040, 1180, 2.0, 110, 255, { w: 1, a: 0.4 });
      CY.crack(g, gp.x + 328, gp.y + 40, 0.2, 70, 256, { w: 1, a: 0.45 });
      for (let i = 0; i < 6; i++) CY.crack(g, R.r(0, W), R.r(1380, 1490), -1.4 + R.g() * 0.3, R.r(30, 80), 260 + i, { w: 0.9, a: 0.35 });
    });
    stage('paintCopingShadow(g);', () => { paintCopingShadow(g); });
    stage('paintGate(g);', () => { paintGate(g); });
    stage('paintCoping(g);', () => { paintCoping(g); });
    stage('clipTo(g, [CY.rect(-20, 1480, W + 40, 12', () => { clipTo(g, [CY.rect(-20, 1480, W + 40, 120), FRONT], 'evenodd', () => paintPlinth(g)); });
    stage('paintGround(g);', () => { paintGround(g); });
    stage('paintSteps(g);', () => { paintSteps(g); });
    stage('paintPot(g);', () => { paintPot(g); });
    stage('paintVine(g);', () => { paintVine(g); });
    L.front = F;
    stage('L.over = paintOver();', () => { L.over = paintOver(); });
    stage('L.light = paintLight();', () => { L.light = paintLight(); });
    stage('L.paper = paintPaper();', () => { L.paper = paintPaper(); });
    stage('L.wallMask = paintWallMask();', () => { L.wallMask = paintWallMask(); });
    return L;
  };
})();
