/* SHEET 17 — "The Tea Engine": a Gothic tower on a hill, crowned by a heap of machinery.
   True 3D masses for perspective and occlusion; every face then gets dense hand-inked detail projected onto it. */
(window.SCENES = window.SCENES || []).push({
  name: 'Tea Engine', seed: 1234, ink: '#0c0c0c', theme: 'pencil',
  build(P, n, t) {
    const S = Sketch, D = S.D3, V = S.V3, TAU = S.TAU, lerp = S.lerp, K = '#0c0c0c', Wh = '#ffffff', R = (a, b) => P.r(a, b);
    const CAM = D.camera({ eye: [-1050, -1750, 250], target: [20, -60, 300], f: 2050, cx: 830, cy: 350 });
    const faces = [], add = f => { (Array.isArray(f) ? f : [f]).forEach(x => faces.push(x)); return f; };
    const custom = (c, fn, bias = 4) => faces.push({ custom: fn, c, bias });
    const box = (x0, y0, z0, x1, y1, z1, o = {}) => D.extrude([[x0, y0], [x1, y0], [x1, y1], [x0, y1]], z0, z1, Object.assign({ crease: 0.3, bottom: true }, o));
    const face = (fs, nx, ny, nz) => fs.find(f => Math.abs(f.n[0] - nx) + Math.abs(f.n[1] - ny) + Math.abs(f.n[2] - nz) < 0.05);
    /* orient: map local frame (z = axis) to point A along dir */
    const orient = (fs, A, dir) => { const w = V.norm(dir), u = V.norm(V.cross(Math.abs(w[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0], w)), v = V.cross(w, u); const M = p => [A[0] + u[0] * p[0] + v[0] * p[1] + w[0] * p[2], A[1] + u[1] * p[0] + v[1] * p[1] + w[1] * p[2], A[2] + u[2] * p[0] + v[2] * p[1] + w[2] * p[2]], N = p => [u[0] * p[0] + v[0] * p[1] + w[0] * p[2], u[1] * p[0] + v[1] * p[1] + w[1] * p[2], u[2] * p[0] + v[2] * p[1] + w[2] * p[2]]; return fs.map(f => Object.assign({}, f, { v: f.v.map(M), n: N(f.n), hdir: f.hdir ? N(f.hdir) : undefined })); };
    const pipe = (A, B, r, o = {}) => { const d = V.sub(B, A), L = Math.hypot(d[0], d[1], d[2]); add(orient(D.cylinder(0, 0, r, 0, L, o.seg || 16), A, d)); (o.flanges || []).forEach(t2 => add(orient(D.cylinder(0, 0, r * 1.35, t2 * L - 2, t2 * L + 2, o.seg || 16), A, d))); };
    const planeProj = (O, U, Vv) => (u, v) => { const p = CAM.project([O[0] + U[0] * u + Vv[0] * v, O[1] + U[1] * u + Vv[1] * v, O[2] + U[2] * u + Vv[2] * v]); return p ? [p[0], p[1]] : [0, 0]; };
    /* ---------- 2D ink vocabulary used on facades (all in plane coordinates u,v; pr maps to screen) ---------- */
    const black = pts => P.wash(pts, '#060606', 1, { edge: 0, jit: 0, steps: 1 });
    const white = pts => P.occlude(pts, Wh);
    const polyL = (pts, w = 1, c = K, closed = true) => P.path(closed ? pts.concat([pts[0]]) : pts, { w, c, a: 0.95, rough: 0.25, passes: 1 });
    const archUV = (u0, u1, v0, v1, pointed = true, k = 10) => { const w = u1 - u0, rise = pointed ? w * 0.75 : w / 2, sp = v1 - rise, pts = [[u0, v0], [u0, sp]]; if (pointed) { const Rr = (w * w / 4 + rise * rise) / w; for (let i = 1; i <= k; i++) { const th = Math.PI - (Math.PI - Math.atan2(rise, w / 2 - Rr)) * i / k; pts.push([u0 + Rr + Rr * Math.cos(th), sp + Rr * Math.sin(th)]); } for (let i = k - 1; i >= 1; i--) { const th = Math.PI - (Math.PI - Math.atan2(rise, w / 2 - Rr)) * i / k; pts.push([u1 - Rr - Rr * Math.cos(th), sp + Rr * Math.sin(th)]); } } else for (let i = 1; i < 2 * k; i++) { const th = Math.PI - Math.PI * i / (2 * k); pts.push([u0 + w / 2 + Math.cos(th) * w / 2, sp + Math.sin(th) * w / 2]); } pts.push([u1, sp], [u1, v0]); return pts; };
    const lancet = (pr, u0, u1, v0, v1, o = {}) => { const A = archUV(u0, u1, v0, v1, o.round !== true), S2 = A.map(([u, v]) => pr(u, v)); const fr = archUV(u0 - 3, u1 + 3, v0 - 2, v1 + 3, o.round !== true).map(([u, v]) => pr(u, v)); polyL(fr, 0.8); black(S2); polyL(S2, 1.2);
      const um = (u0 + u1) / 2; if (u1 - u0 > 10) { const a = pr(um, v0), b = pr(um, v1 - (u1 - u0) * 0.55); P.line(a[0], a[1], b[0], b[1], { w: 1, c: Wh, passes: 1, over: 0, rough: 0.1 }); const c = pr(um, v1 - (u1 - u0) * 0.35), rr = Math.hypot(pr(u0, v0)[0] - pr(u1, v0)[0], 0) * 0.16; P.circle(c[0], c[1], rr, { w: 0.8, c: Wh, passes: 1 }); for (let v = v0 + 12; v < v1 - (u1 - u0); v += 12) { const l1 = pr(u0 + 1, v), l2 = pr(u1 - 1, v); P.line(l1[0], l1[1], l2[0], l2[1], { w: 0.5, c: Wh, a: 0.7, passes: 1, over: 0 }); } } };
    const dotsAlong = (pr, u0, v0, u1, v1, step = 5, r = 0.9) => { const L = Math.hypot(u1 - u0, v1 - v0), D2 = []; for (let s = 0; s <= L; s += step) { const q = pr(lerp(u0, u1, s / L), lerp(v0, v1, s / L)); D2.push([q[0], q[1], r]); } P.dots(D2, K, 0.9); };
    const lineUV = (pr, u0, v0, u1, v1, w = 0.9, c = K) => { const a = pr(u0, v0), b = pr(u1, v1); P.line(a[0], a[1], b[0], b[1], { w, c, passes: 1, over: 0, rough: 0.25 }); };
    const puffs2D = (poly, n, rMax) => { for (let i = 0; i < n; i++) { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; poly.forEach(([x, y]) => { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }); const x = R(x0, x1), y = R(y0, y1), r = R(3, rMax); if (!S.pip(poly, x, y) || !S.pip(poly, x + r, y) || !S.pip(poly, x - r, y) || !S.pip(poly, x, y + r) || !S.pip(poly, x, y - r)) continue; const b = P.sample(Array.from({ length: 9 }, (_, k) => { const a = k * TAU / 9; return [x + Math.cos(a) * r * R(0.8, 1.15), y + Math.sin(a) * r * R(0.8, 1.15)]; }), true, 2); white(b); for (let q = 0; q < b.length; q += 2) { const [bx, by] = b[q], a = Math.atan2(by - y, bx - x); if (Math.cos(a + 2.3) > -0.2) continue; P.line(bx, by, bx - Math.cos(a) * r * 0.3, by - Math.sin(a) * r * 0.3, { w: 0.5, c: K, passes: 1, over: 0, rough: 0.1 }); } polyL(b, 1); } };

    const cloudCluster = (x, y, z, n, rMax, bias) => custom([x, y, z], (PP, cm) => { const c = cm.project([x, y, z]); if (!c) return; for (let k = 0; k < n; k++) { const cx = c[0] + R(-rMax * 1.6, rMax * 1.6), cy = c[1] + R(-rMax * 1.2, rMax * 1.2) - k * 1.2, r = R(rMax * 0.45, rMax); const pts = P.sample(Array.from({ length: 10 }, (_, q) => { const a = q * TAU / 10; return [cx + Math.cos(a) * r * R(0.85, 1.12), cy + Math.sin(a) * r * R(0.8, 1.08)]; }), true, 2); white(pts); for (let q = 0; q < pts.length; q += 1) { const [px, py] = pts[q], a = Math.atan2(py - cy, px - cx); if (Math.cos(a + 2.4) > -0.25) continue; for (let m = 0; m < 2; m++) PP.line(px - Math.cos(a) * m * 2.5, py - Math.sin(a) * m * 2.5, px - Math.cos(a) * (r * 0.28 + m * 2.5), py - Math.sin(a) * (r * 0.28 + m * 2.5), { w: 0.5, c: K, passes: 1, over: 0, rough: 0.1 }); } PP.stipple(pts, Math.round(r * r * 0.12), { a: 0.85, r: 0.6, c: K, fade: (px, py) => Math.max(0, ((px - cx) + (py - cy)) / (r * 1.5)) }); polyL(pts, 1); } }, bias);
    /* ================= GROUND, HILL, STAIR, TREES ================= */
    { // hill under the chapel: a flat top and a front slope down to the ground
      const x0 = 110, x1 = 400, yb = -60, yt = -300, yf = -400, zt = 70;
      add(D.poly3([[x0, yt, zt], [x1, yt, zt], [x1, yb, zt], [x0, yb, zt]], [290, -180, 500], {}));
      const slope = D.poly3([[x0, yf, 0], [x1, yf, 0], [x1, yt, zt], [x0, yt, zt]], [290, -900, 500], { hdir: [0, 1, 0.5] }); add(slope);
      add(D.poly3([[x0, yf, 0], [x0, yt, zt], [x0, yb, zt], [x0, yb, 0]], [-500, -180, 30], {}));
      // stair up the slope
      // dotted slope texture, pebbles and scattered grass on the hill (drawn on the slope face)
      slope.deco = (PP) => { { const prS = (u, v) => { const p = CAM.project([lerp(x0, x1, u), lerp(yf, yt, v), lerp(0, zt, v)]); return p ? [p[0], p[1]] : [0, 0]; }; const sa = prS(0.55, 0), sb = prS(0.72, 0), sc = prS(0.72, 1), sd = prS(0.55, 1); white([sa, sb, sc, sd]); PP.poly([sa, sb, sc, sd], { w: 1.2, c: K, passes: 1, over: 0 }); for (let k = 1; k < 18; k++) { const a = prS(0.55, k / 18), b = prS(0.72, k / 18), a2 = prS(0.55, (k - 0.35) / 18), b2 = prS(0.72, (k - 0.35) / 18); PP.line(a[0], a[1], b[0], b[1], { w: 1, c: K, passes: 1, over: 0 }); PP.hatch([a, b, b2, a2], { ang: 0, gap: 1.2, a: 0.9, w: 0.4, c: K }); } const f = prS(0.62, 0.45); PP.circle(f[0], f[1] - 16, 2.6, { w: 0.9, c: K, passes: 1 }); PP.line(f[0], f[1] - 13, f[0] + 1, f[1] - 5, { w: 1.4, c: K, passes: 1, over: 0 }); PP.line(f[0] + 1, f[1] - 5, f[0] - 2, f[1], { w: 1, c: K, passes: 1, over: 0 }); PP.line(f[0] + 1, f[1] - 5, f[0] + 4, f[1] - 1, { w: 1, c: K, passes: 1, over: 0 }); } const pr = (u, v) => { const p = CAM.project([lerp(x0, x1, u), lerp(yf, yt, v), lerp(0, zt, v)]); return p ? [p[0], p[1]] : [0, 0]; }; for (let i = 0; i < 14; i++) { const v = i / 14; dotsAlong(pr, 0.02, v, 0.5, v + 0.02, 0.012, 0.7); } for (let i = 0; i < 60; i++) { const q = pr(R(0.02, 0.98), R(0.05, 0.95)); if (q[0] > pr(0.52, 0.5)[0] && q[0] < pr(0.72, 0.5)[0]) continue; PP.curve([[q[0], q[1]], [q[0] + R(-1, 1), q[1] - R(3, 7)]], { w: 0.6, c: K, rough: 0.2, passes: 1 }); } };
      // trees: trunk + lollipop crown
      [[360, -150, zt], [380, -240, zt], [200, -350, 20]].forEach(([x, y, z], i) => { add(D.cylinder(x, y, 2.4, z, z + 38 + i * 6, 6)); add(D.revolve(x, y, Array.from({ length: 9 }, (_, k) => { const a = -Math.PI / 2 + Math.PI * k / 8; return [Math.cos(a) * (14 + i * 2) + 0.01, z + 48 + i * 6 + Math.sin(a) * (14 + i * 2)]; }), { seg: 14 })); });
    }
    /* ================= THE TOWER ================= */
    const TX0 = -110, TX1 = 110, TY0 = -90, TY1 = 90, TH = 330;
    const tower = box(TX0, TY0, 0, TX1, TY1, TH); add(tower);
    // buttresses on the visible corners, stepped
    [[TX0 - 18, TY0 - 18, TX0 + 10, TY0 + 10], [TX1 - 10, TY0 - 18, TX1 + 18, TY0 + 10], [TX0 - 18, TY1 - 10, TX0 + 10, TY1 + 18]].forEach(([a, b, c, d], i) => { add(box(a, b, 0, c, d, 180)); add(box(a + 4, b + 4, 180, c - 4, d - 4, 270)); add(D.poly3([[a + 4, b + 4, 270], [c - 4, b + 4, 270], [(a + c) / 2, (b + d) / 2, 300]], [(a + c) / 2, (b + d) / 2, 200], {})); });
    { // front face (y = TY0): portal full of clouds, stacked lancets, arcade band, bookcase slit
      const F = face(tower, 0, -1, 0), pr = planeProj([TX0, TY0, 0], [1, 0, 0], [0, 0, 1]);
      F.deco = (PP) => {
        // great portal: archivolt rings, black recess, cloud-filled
        [[62, 168, 0, 262, 1.6], [66, 164, 0, 256, 0.8], [72, 158, 0, 246, 1.2]].forEach(([u0, u1, v0, v1, w]) => polyL(archUV(u0, u1, v0, v1).map(([u, v]) => pr(u, v)), w));
        for (let k = 0; k < 22; k++) { const t2 = k / 21, A1 = archUV(66, 164, 0, 256), A2 = archUV(72, 158, 0, 246), i = Math.round(t2 * (A1.length - 1)); const a = pr(...A1[i]), b = pr(...A2[Math.min(A2.length - 1, i)]); PP.line(a[0], a[1], b[0], b[1], { w: 0.6, c: K, passes: 1, over: 0 }); }
        const recess = archUV(76, 154, 0, 240).map(([u, v]) => pr(u, v)); black(recess); puffs2D(recess, 900, 16); polyL(recess, 1.4);
        // columns flanking the portal
        [58, 172].forEach(u => { for (let d = -3; d <= 3; d += 3) lineUV(pr, u + d, 0, u + d, 250, d ? 0.6 : 1.1); lineUV(pr, u - 5, 250, u + 5, 250, 1.4); dotsAlong(pr, u - 5, 6, u - 5, 240, 7); });
        // left: three tiers of lancets
        [[8, 26, 40, 110], [30, 48, 40, 110], [8, 26, 130, 200], [30, 48, 130, 200], [8, 48, 214, 290]].forEach(([u0, u1, v0, v1]) => lancet(pr, u0, u1, v0, v1));
        // right slit with a bookcase inside
        { const A = archUV(180, 212, 20, 230).map(([u, v]) => pr(u, v)); black(A); for (let v = 30; v < 200; v += 13) { lineUV(pr, 182, v, 210, v, 0.9, Wh); let u = 183; while (u < 209) { const bw = R(1.4, 3.2), h = R(7, 11); if (P.R() > 0.15) lineUV(pr, u, v + 0.8, u, v + h, bw * 0.55, Wh); u += bw + 0.6; } } polyL(A, 1.2); }
        // arcade band at the top and a frieze of dots and quatrefoils
        for (let k = 0; k < 10; k++) { const u0 = 6 + k * 21, u1 = u0 + 17; lancet(pr, u0, u1, 272, 316, { round: true }); }
        dotsAlong(pr, 0, 266, 220, 266, 5, 1.1); dotsAlong(pr, 0, 322, 220, 322, 5, 1.1);
        // stone coursing strokes, loose
        for (let v = 8; v < 262; v += 9) { if (P.R() > 0.55) continue; const u0 = R(2, 50); lineUV(pr, u0, v, u0 + R(4, 14), v, 0.45); }
      };
    }
    { // left face (x = TX0): tall lancets, a stair turret line, a balcony with a figure
      const F = face(tower, -1, 0, 0), pr = planeProj([TX0, TY1, 0], [0, -1, 0], [0, 0, 1]);
      F.deco = (PP) => {
        [[14, 50], [66, 102], [118, 154]].forEach(([u0, u1]) => { lancet(pr, u0, u1, 180, 300); lancet(pr, u0 + 4, u1 - 4, 40, 160); });
        for (let k = 0; k < 18; k++) lancet(pr, 6 + k * 9.5, 13 + k * 9.5, 8, 30, { round: true });
        dotsAlong(pr, 0, 170, 180, 170, 5, 1); dotsAlong(pr, 0, 36, 180, 36, 5, 1); dotsAlong(pr, 0, 308, 180, 308, 5, 1);
        for (let v = 50; v < 300; v += 10) { if (P.R() > 0.5) continue; const u0 = R(2, 170); lineUV(pr, u0, v, u0 + R(4, 10), v, 0.45); }
      };
    }
    /* ================= THE CHAPEL ================= */
    const CX0 = 128, CX1 = 300, CY0 = -260, CY1 = -90, CZ = 70, CH = 150;
    { const walls = box(CX0, CY0, CZ, CX1, CY1, CZ + CH, { bottom: false }); add(walls);
      const ridge = CZ + CH + 80, g0 = D.poly3([[CX0, CY0, CZ + CH], [CX1, CY0, CZ + CH], [(CX0 + CX1) / 2, CY0, ridge]], [215, -900, 200], {}); add(g0);
      add(D.poly3([[CX0, CY0, CZ + CH], [(CX0 + CX1) / 2, CY0, ridge], [(CX0 + CX1) / 2, CY1, ridge], [CX0, CY1, CZ + CH]], [-400, -175, 600], { hdir: [0, 0, 1] }));
      add(D.poly3([[CX1, CY0, CZ + CH], [(CX0 + CX1) / 2, CY0, ridge], [(CX0 + CX1) / 2, CY1, ridge], [CX1, CY1, CZ + CH]], [900, -175, 600], {}));
      add(D.cylinder((CX0 + CX1) / 2, CY0 + 6, 2, ridge, ridge + 30, 6)); add(box((CX0 + CX1) / 2 - 10, CY0 + 4, ridge + 18, (CX0 + CX1) / 2 + 10, CY0 + 8, ridge + 22));
      const Ff = face(walls, 0, -1, 0), prF = planeProj([CX0, CY0, CZ], [1, 0, 0], [0, 0, 1]);
      Ff.deco = () => { lancet(prF, 60, 110, 0, 110); [[14, 40], [130, 156]].forEach(([a, b]) => lancet(prF, a, b, 40, 120)); dotsAlong(prF, 4, 4, 4, 146, 6); dotsAlong(prF, 166, 4, 166, 146, 6); for (let k = 0; k < 6; k++) lineUV(prF, 0, 126 + k * 4, 170, 126 + k * 4, 0.5); };
      const gdeco = planeProj([CX0, CY0, CZ + CH], [1, 0, 0], [0, 0, 1]); g0.deco = () => { lancet(gdeco, 72, 98, 6, 60); dotsAlong(gdeco, 10, 4, 85, 76, 5); dotsAlong(gdeco, 160, 4, 85, 76, 5); };
      const Fl = face(walls, -1, 0, 0), prL = planeProj([CX0, CY1, CZ], [0, -1, 0], [0, 0, 1]);
      Fl.deco = () => { for (let k = 0; k < 5; k++) lancet(prL, 12 + k * 32, 30 + k * 32, 40, 118, { round: true }); for (let k = 0; k < 6; k++) { lineUV(prL, 4 + k * 32, 0, 4 + k * 32, 150, 1.1); dotsAlong(prL, 7 + k * 32, 4, 7 + k * 32, 146, 7, 0.8); } dotsAlong(prL, 0, 30, 170, 30, 5); };
    }


    /* ================= THE CROWN: a heap of machinery on an overhanging deck ================= */
    const DZ = TH, DX0 = -220, DX1 = 250, DY0 = -175, DY1 = 170;
    { const deck = box(DX0, DY0, DZ, DX1, DY1, DZ + 16); add(deck);
      const under = face(deck, 0, 0, -1);
      // corbels under the overhang
      for (let x = DX0 + 16; x < DX1; x += 30) { add(box(x - 5, DY0, DZ - 16, x + 5, DY0 + 12, DZ)); add(box(x - 3, DY0 + 2, DZ - 26, x + 3, DY0 + 12, DZ - 16)); }
      for (let y = DY0 + 16; y < DY1; y += 30) { add(box(DX0, y - 5, DZ - 16, DX0 + 12, y + 5, DZ)); add(box(DX0 + 2, y - 3, DZ - 26, DX0 + 12, y + 3, DZ - 16)); }
      // railing posts along the front and left edges
      const railPts = []; for (let x = DX0 + 6; x < DX1; x += 12) railPts.push([x, DY0 + 4]); for (let y = DY0 + 16; y < DY1; y += 12) railPts.push([DX0 + 4, y]);
      custom([0, DY0, DZ + 30], (PP, cm) => { railPts.forEach(([x, y]) => { const a = cm.project([x, y, DZ + 16]), b = cm.project([x, y, DZ + 32]); if (a && b) PP.line(a[0], a[1], b[0], b[1], { w: 0.9, c: K, passes: 1, over: 0, rough: 0.1 }); }); D.polyline3(PP, [[DX1 - 4, DY0 + 4, DZ + 32], [DX0 + 4, DY0 + 4, DZ + 32], [DX0 + 4, DY1 - 4, DZ + 32]], cm, { w: 1.2, c: K }); D.polyline3(PP, [[DX1 - 4, DY0 + 4, DZ + 24], [DX0 + 4, DY0 + 4, DZ + 24], [DX0 + 4, DY1 - 4, DZ + 24]], cm, { w: 0.6, c: K }); }, -30);
    }
    const Z1 = DZ + 16;
    // the dome on a drum with round windows
    { const dc = [40, 30]; add(D.cylinder(dc[0], dc[1], 78, Z1, Z1 + 90, 36));
      add(D.revolve(dc[0], dc[1], Array.from({ length: 13 }, (_, k) => { const a = Math.PI / 2 * k / 12; return [Math.cos(a) * 80 + 0.01, Z1 + 90 + Math.sin(a) * 92]; }), { seg: 36 }));
      add(D.cylinder(dc[0], dc[1], 12, Z1 + 180, Z1 + 200, 12)); add(D.revolve(dc[0], dc[1], [[13, Z1 + 200], [4, Z1 + 226], [0.01, Z1 + 236]], { seg: 12 }));
      custom([dc[0] - 60, dc[1] - 60, Z1 + 20], (PP, cm) => { for (let k = 0; k < 16; k++) { const a = Math.PI * 0.95 + k * Math.PI * 1.1 / 16, x = dc[0] + Math.cos(a) * 78.5, y = dc[1] + Math.sin(a) * 78.5; const pts = Array.from({ length: 12 }, (_, q) => null).filter(Boolean); const c = cm.project([x, y, Z1 + 60]); if (c) { PP.circle(c[0], c[1], 5.6, { w: 1, c: K, passes: 1 }); black(Array.from({ length: 10 }, (_, q) => [c[0] + Math.cos(q * TAU / 10) * 4, c[1] + Math.sin(q * TAU / 10) * 5.2])); } void pts; } for (let k = 0; k < 40; k++) { const a = Math.PI * 0.9 + k * Math.PI * 1.2 / 40; const p0 = cm.project([dc[0] + Math.cos(a) * 80, dc[1] + Math.sin(a) * 80, Z1 + 90]); if (p0) PP.dot(p0[0], p0[1], 1.1, { c: K }); } }, 20);
      // dome ribs with dots (like a melon dome)
      custom([dc[0] - 50, dc[1] - 50, Z1 + 90], (PP, cm) => { for (let k = 0; k < 16; k++) { const a = k * TAU / 16; const pts = []; for (let q = 0; q <= 12; q++) { const e = Math.PI / 2 * q / 12; pts.push([dc[0] + Math.cos(a) * Math.cos(e) * 80.5, dc[1] + Math.sin(a) * Math.cos(e) * 80.5, Z1 + 90 + Math.sin(e) * 92.5]); } const vis = pts.filter(p => (p[0] - dc[0]) * (CAM.eye[0] - p[0]) + (p[1] - dc[1]) * (CAM.eye[1] - p[1]) + (p[2] - Z1 - 90) * (CAM.eye[2] - p[2]) > 0); if (vis.length > 2) { D.polyline3(PP, vis, cm, { w: 0.9, c: K }); vis.forEach((p, i) => { if (i % 2) { const q = cm.project([p[0] + Math.cos(a + 0.2) * 0.5, p[1] + Math.sin(a + 0.2) * 0.5, p[2]]); if (q) PP.dot(q[0] + 4, q[1], 0.9, { c: K }); } }); } } }, 60);
    }
    // the great horizontal engine pipe with flanges, a wheel at its end
    { const A = [DX0 - 150, DY0 + 18, Z1 + 32], B = [DX1 + 30, DY0 + 18, Z1 + 32]; pipe(A, B, 24, { seg: 20, flanges: [0.08, 0.2, 0.36, 0.52, 0.7, 0.86] });
      add(orient(D.cylinder(0, 0, 44, -6, 6, 28), A, [1, 0, 0])); add(orient(D.cylinder(0, 0, 12, -20, -6, 14), A, [1, 0, 0]));
      custom([A[0] - 2, A[1], A[2]], (PP, cm) => { for (let k = 0; k < 12; k++) { const a = k * TAU / 12; D.polyline3(PP, [[A[0] - 6.5, A[1] + Math.cos(a) * 12, A[2] + Math.sin(a) * 12], [A[0] - 6.5, A[1] + Math.cos(a) * 42, A[2] + Math.sin(a) * 42]], cm, { w: 1.4, c: K }); } }, 30);
      pipe([DX0 - 120, DY0 + 18, Z1 + 60], [DX0 - 120, DY0 + 18, Z1 + 150], 8, { flanges: [0.5] }); pipe([DX0 + 20, DY0 + 18, Z1 + 56], [DX0 + 60, DY0 - 40, Z1 + 110], 7, { flanges: [0.5] });
      pipe([DX1 - 10, DY0 + 18, Z1 + 56], [DX1 - 10, DY0 + 18, Z1 + 140], 10, { flanges: [0.3, 0.7] });
    }
    // turrets and small buildings on the deck
    { const turret = (x, y, r, h, roof) => { add(D.cylinder(x, y, r, Z1, Z1 + h, 20)); if (roof === 'cone') add(D.revolve(x, y, [[r + 4, Z1 + h], [0.01, Z1 + h + r * 2.2]], { seg: 20 })); else if (roof === 'bulb') add(D.revolve(x, y, Array.from({ length: 10 }, (_, k) => { const t = k / 9; return [Math.max(0.01, (r + 3) * Math.sin(Math.PI * Math.min(1, t * 1.15)) * (1 - t * 0.6)), Z1 + h + t * r * 2.4]; }), { seg: 20 })); else { add(D.cylinder(x, y, r + 5, Z1 + h, Z1 + h + 5, 20)); } custom([x - r, y - r, Z1 + h / 2], (PP, cm) => { for (let v = Z1 + 14; v < Z1 + h - 10; v += 22) for (let k = 0; k < 7; k++) { const a = Math.PI * 1.05 + k * 0.2, p = cm.project([x + Math.cos(a) * (r + 0.3), y + Math.sin(a) * (r + 0.3), v]); if (p) { PP.rect(p[0] - 1.6, p[1] - 4, 3.2, 8, { w: 0.6, c: K, passes: 1, over: 0 }); } } }, 20); };
      turret(190, 60, 30, 110, 'cone'); turret(-150, 100, 24, 150, 'bulb'); turret(150, -110, 16, 70, 'cap'); turret(-60, 120, 18, 90, 'cone');
      // a little house with a pitched roof
      add(box(170, -150, Z1, 240, -80, Z1 + 50)); add(D.poly3([[170, -150, Z1 + 50], [205, -150, Z1 + 80], [205, -80, Z1 + 80], [170, -80, Z1 + 50]], [-400, -115, 800], {})); add(D.poly3([[170, -150, Z1 + 50], [240, -150, Z1 + 50], [205, -150, Z1 + 80]], [205, -900, Z1 + 60], {}));
    }
    // the clutter: a heightmap-stacked pile of boxes, drums, tanks and bent pipes on the left half of the deck
    { const hm = new Map(), cell = 18, hAt = (x, y) => hm.get(Math.round(x / cell) + ',' + Math.round(y / cell)) || Z1, setH = (x0, y0, x1, y1, z) => { for (let x = x0; x <= x1; x += cell / 2) for (let y = y0; y <= y1; y += cell / 2) { const k = Math.round(x / cell) + ',' + Math.round(y / cell); hm.set(k, Math.max(hm.get(k) || Z1, z)); } };
      for (let i = 0; i < 700; i++) {
        const x = R(DX0 + 10, DX1 - 10), y = R(DY0 + 36, DY1 - 10); if (Math.hypot(x - 40, y - 30) < 92 || Math.hypot(x + 150, y - 100) < 30 || Math.hypot(x - 190, y - 60) < 36 || (x > 165 && y < -75)) continue;
        const kind = P.R(), z = Math.max(hAt(x - 8, y - 8), hAt(x + 8, y + 8), hAt(x, y)), frontOfDome = x > -80 && x < 160 && y < 40; if (z > Z1 + (frontOfDome ? 40 : 250)) continue;
        if (kind < 0.35) { const w = R(8, 28), d = R(8, 28), h = R(8, 36); add(box(x - w / 2, y - d / 2, z, x + w / 2, y + d / 2, z + h)); setH(x - w / 2, y - d / 2, x + w / 2, y + d / 2, z + h); }
        else if (kind < 0.6) { const r = R(5, 16), h = R(10, 44); add(D.cylinder(x, y, r, z, z + h, 14)); if (P.R() > 0.5) add(D.cylinder(x, y, r + 2, z + h, z + h + 3, 14)); setH(x - r, y - r, x + r, y + r, z + h); }
        else if (kind < 0.8) { const r = R(4, 9), L = R(30, 90), a = R(0, TAU), e = R(-0.3, 0.6); pipe([x, y, z + r], [x + Math.cos(a) * Math.cos(e) * L, y + Math.sin(a) * Math.cos(e) * L, z + r + Math.sin(e) * L], r, { flanges: [R(0.2, 0.8)] }); setH(x - 8, y - 8, x + 8, y + 8, z + r * 2); }
        else { const r = R(8, 18); add(D.revolve(x, y, Array.from({ length: 9 }, (_, k) => { const a = -Math.PI / 2 + Math.PI * k / 8; return [Math.cos(a) * r + 0.01, z + r + Math.sin(a) * r]; }), { seg: 16 })); setH(x - r, y - r, x + r, y + r, z + r * 2); }
      }
    }

    // crown life: vertical gear wheels, ladders, a telescope, laundry lines between masts
    { [[-190, DY0 + 60, Z1 + 70, 30, 24], [120, DY0 + 50, Z1 + 50, 22, 18], [-20, DY0 + 44, Z1 + 42, 16, 14]].forEach(([x, y, z, r, zt]) => { add(orient(D.gearMesh(0, 0, r, zt, -3, 3, 0.1, { root: 0.84 }), [x, y, z], [0, 1, 0])); add(orient(D.cylinder(0, 0, r * 0.25, -8, 8, 12), [x, y, z], [0, 1, 0])); });
      custom([-110, DY0 + 30, Z1 + 60], (PP, cm) => { [[-110, DY0 + 36], [-96, DY0 + 36]].forEach(([x, y]) => D.polyline3(PP, [[x, y, Z1], [x, y, Z1 + 140]], cm, { w: 1, c: K })); for (let z = Z1 + 8; z < Z1 + 140; z += 9) D.polyline3(PP, [[-110, DY0 + 36, z], [-96, DY0 + 36, z]], cm, { w: 0.8, c: K }); }, 40);
      pipe([150, DY0 + 70, Z1 + 150], [60, DY0 + 10, Z1 + 205], 9, { flanges: [0.15, 0.5] }); add(orient(D.cylinder(0, 0, 14, 0, 12, 16), [60, DY0 + 10, Z1 + 205], [-90, -60, 55]));
      custom([0, 0, Z1 + 200], (PP, cm) => { const L = [[-150, 100, Z1 + 250], [-90, -60, Z1 + 220], [230, 100, Z1 + 165]]; for (let i = 0; i + 1 < L.length; i++) { const a = L[i], b = L[i + 1], pts = []; for (let k = 0; k <= 20; k++) { const t2 = k / 20; pts.push([lerp(a[0], b[0], t2), lerp(a[1], b[1], t2), lerp(a[2], b[2], t2) - 26 * Math.sin(Math.PI * t2)]); } D.polyline3(PP, pts, cm, { w: 0.7, c: K }); for (let k = 3; k < 18; k += 3) { const p = cm.project(pts[k]); if (!p) continue; const w = R(6, 12), h = R(8, 16), rag = [[p[0] - w / 2, p[1]], [p[0] + w / 2, p[1]], [p[0] + w / 2 + R(-2, 2), p[1] + h], [p[0] - w / 2, p[1] + h * 0.8]]; white(rag); polyL(rag, 0.9); if (k % 2) PP.hatch(rag, { ang: 90, gap: 2, a: 0.8, w: 0.4, c: K }); } } }, 260);
      // rivets and a frieze on the deck front edge
      custom([0, DY0, DZ + 8], (PP, cm) => { for (let x = DX0 + 4; x < DX1 - 2; x += 6) { const p = cm.project([x, DY0 - 0.5, DZ + 11]); if (p) PP.dot(p[0], p[1], 0.9, { c: K }); const q = cm.project([x, DY0 - 0.5, DZ + 5]); if (q && Math.round(x) % 3 === 0) PP.dot(q[0], q[1], 0.9, { c: K }); } }, 12);
    }
    // ground: a line, stippled shadow and tufts around the base
    custom([0, 0, 0], (PP, cm) => { for (let i = 0; i < 40; i++) { const x = R(-600, 520), y = R(-520, -140), p = cm.project([x, y, 0]); if (!p) continue; const r = R(2, 5); PP.ellipse(p[0], p[1], r * 1.4, r * 0.7, { w: 0.8, c: K, passes: 1 }); PP.hatch([[p[0], p[1] - r * 0.7], [p[0] + r * 1.4, p[1]], [p[0], p[1] + r * 0.7]], { ang: 60, gap: 1.2, a: 0.8, w: 0.4, c: K }); } const g = []; for (let x = -420; x <= 520; x += 20) { const p = cm.project([x, -420, 0]); if (p) g.push(p); } const base = [[-150, -130], [120, -130], [110, -420]].map(([x, y]) => cm.project([x, y, 0])); P.stipple([[...cm.project([-160, -120, 0])].slice(0, 2), [...cm.project([140, -120, 0])].slice(0, 2), [...cm.project([140, -260, 0])].slice(0, 2), [...cm.project([-160, -260, 0])].slice(0, 2)], 900, { a: 0.8, r: 0.8, c: K }); void base; void g; for (let i = 0; i < 90; i++) { const x = R(-260, 420), y = R(-470, -120), p = cm.project([x, y, 0]); if (!p) continue; PP.curve([[p[0], p[1]], [p[0] + R(-1.5, 1.5), p[1] - R(3, 8)]], { w: 0.6, c: K, rough: 0.2, passes: 1 }); } }, -2000);

    /* ================= a slender second tower on the left, joined by a bridge; bubbles off the chapel ================= */
    { const sx = -440, sy = -30, sr = 42, sh = 430;
      add(D.cylinder(sx, sy, sr, 0, sh, 28)); add(D.cylinder(sx, sy, sr + 7, sh, sh + 10, 28)); add(D.revolve(sx, sy, [[sr + 4, sh + 10], [sr * 0.4, sh + 70], [0.01, sh + 118]], { seg: 28 }));
      add(D.cylinder(sx, sy, sr + 5, 150, 158, 28)); add(D.cylinder(sx, sy, sr + 5, 300, 308, 28));
      custom([sx - sr, sy - sr, 220], (PP, cm) => { for (let k = 0; k < 40; k++) { const t2 = k / 40, a = Math.PI * 1.05 + t2 * TAU * 2.4, z = 20 + t2 * 400, x = sx + Math.cos(a) * (sr + 0.3), y = sy + Math.sin(a) * (sr + 0.3); if ((CAM.eye[0] - x) * Math.cos(a) + (CAM.eye[1] - y) * Math.sin(a) <= 0) continue; const p = cm.project([x, y, z]); if (!p) continue; const w = [[p[0] - 2.5, p[1] + 6], [p[0] - 2.5, p[1] - 2], [p[0], p[1] - 6], [p[0] + 2.5, p[1] - 2], [p[0] + 2.5, p[1] + 6]]; black(w); } for (let z = 12; z < sh; z += 14) { const pts = []; for (let k = 0; k <= 16; k++) { const a = Math.PI * 0.9 + k * Math.PI / 16; pts.push([sx + Math.cos(a) * (sr + 0.2), sy + Math.sin(a) * (sr + 0.2), z]); } if (P.R() > 0.45) D.polyline3(PP, pts.slice(Math.floor(R(0, 8)), Math.floor(R(9, 17))), cm, { w: 0.45, c: K }); } }, 30);
      // bridge: a slab with an arch below, railing, from the tower's left face to the side tower
      const z0 = 236; add(box(sx + sr - 6, -30, z0, TX0 - 18, 20, z0 + 12)); 
      custom([(sx + TX0) / 2, -30, z0], (PP, cm) => { const pts = []; for (let k = 0; k <= 24; k++) { const t2 = k / 24; pts.push([lerp(sx + sr, TX0 - 18, t2), -31, z0 - 70 * Math.sin(Math.PI * t2) * 0 - 10 - 60 * (1 - Math.pow(2 * t2 - 1, 2))]); } D.polyline3(PP, pts, cm, { w: 1.4, c: K }); for (let k = 0; k <= 24; k += 2) { const a = cm.project([pts[k][0], -31, z0]), b = cm.project(pts[k]); if (a && b) PP.line(a[0], a[1], b[0], b[1], { w: 0.5, c: K, passes: 1, over: 0 }); } for (let x = sx + sr; x < TX0 - 18; x += 9) { const a = cm.project([x, -30, z0 + 12]), b = cm.project([x, -30, z0 + 26]); if (a && b) PP.line(a[0], a[1], b[0], b[1], { w: 0.8, c: K, passes: 1, over: 0 }); } D.polyline3(PP, [[sx + sr, -30, z0 + 26], [TX0 - 18, -30, z0 + 26]], cm, { w: 1.1, c: K }); }, 40);
      cloudCluster(sx - 10, sy - 50, 60, 9, 16, 200); cloudCluster(sx + 20, sy - 60, sh - 20, 5, 12, 200);
    }
    custom([CX1, CY0, CZ + 200], (PP, cm) => { const b = cm.project([CX1 - 20, CY0 + 20, CZ + CH + 60]); if (!b) return; for (let k = 0; k < 9; k++) { const x = b[0] + 30 + k * 16 + Math.sin(k) * 10, y = b[1] - 20 - k * 28, r = 5 + k * 1.3; white(Array.from({ length: 14 }, (_, q) => [x + Math.cos(q * TAU / 14) * r, y + Math.sin(q * TAU / 14) * r])); PP.circle(x, y, r, { w: 1, c: K, passes: 1 }); PP.arc(x, y, r * 0.6, r * 0.6, 3.5, 4.5, { w: 0.6, c: K, passes: 1 }); } }, 400);

    /* ================= DENSITY PASS: every open gap gets something ================= */
    { // a flying balloon-ship tethered to the side tower
      const bx = -560, by = -160, bz = 500; add(D.revolve(bx, by, Array.from({ length: 13 }, (_, k) => { const a = -Math.PI / 2 + Math.PI * k / 12; return [Math.cos(a) * 46 + 0.01, bz + Math.sin(a) * 34]; }), { seg: 24 }));
      add(box(bx - 26, by - 12, bz - 72, bx + 26, by + 12, bz - 56)); add(D.cylinder(bx + 30, by, 5, bz - 66, bz - 62, 10));
      custom([bx, by, bz - 40], (PP, cm) => { [[-30, -8], [30, -8], [-30, 8], [30, 8]].forEach(([dx, dy]) => D.polyline3(PP, [[bx + dx * 1.3, by + dy, bz - 20], [bx + dx * 0.8, by + dy, bz - 56]], cm, { w: 0.6, c: K })); for (let k = 0; k < 10; k++) { const a = k * TAU / 10 + 0.3; const pts = []; for (let q = 0; q <= 10; q++) { const e = -Math.PI / 2 + Math.PI * q / 10; pts.push([bx + Math.cos(a) * Math.cos(e) * 46.5, by + Math.sin(a) * Math.cos(e) * 46.5, bz + Math.sin(e) * 34.5]); } const vis = pts.filter(p => (p[0] - bx) * (CAM.eye[0] - p[0]) + (p[1] - by) * (CAM.eye[1] - p[1]) + (p[2] - bz) * (CAM.eye[2] - p[2]) > 0); if (vis.length > 2) D.polyline3(PP, vis, cm, { w: 0.7, c: K }); } const pts = []; for (let k = 0; k <= 20; k++) { const t2 = k / 20; pts.push([lerp(bx, -440, t2), lerp(by, -30, t2), lerp(bz - 72, 400, t2) - 30 * Math.sin(Math.PI * t2)]); } D.polyline3(PP, pts, cm, { w: 0.6, c: K }); }, 60);
      // birds
      custom([0, 0, 900], (PP, cm) => { for (let k = 0; k < 16; k++) { const x = R(80, 1500), y = R(40, 300); if (x > 480 && x < 1150) continue; const s2 = R(4, 9); PP.curve([[x - s2, y], [x - s2 * 0.4, y - s2 * 0.6], [x, y]], { w: 1, c: K, passes: 1, rough: 0.1 }); PP.curve([[x, y], [x + s2 * 0.4, y - s2 * 0.6], [x + s2, y]], { w: 1, c: K, passes: 1, rough: 0.1 }); } }, -5000);
      // ivy and cracks climbing the tower front and the side tower
      custom([TX0, TY0, 150], (PP, cm) => { const vine = (x0, y0, z0, n, dir) => { let x = x0, z = z0; const pts = []; for (let k = 0; k < n; k++) { x += R(-4, 4) * dir[0]; z += R(4, 9); pts.push([x, y0, z]); } D.polyline3(PP, pts, cm, { w: 0.9, c: K }); pts.forEach((p, i) => { if (i % 2) return; const q = cm.project(p); if (!q) return; const side = i % 4 ? 1 : -1, lf = [[q[0], q[1]], [q[0] + side * 6, q[1] - 3], [q[0] + side * 9, q[1] + 1], [q[0] + side * 4, q[1] + 3]]; black(lf); }); }; vine(TX0 + 8, TY0 - 0.5, 0, 26, [1, 0]); vine(TX0 + 54, TY0 - 0.5, 0, 16, [1, 0]); vine(TX1 - 20, TY0 - 0.5, 0, 22, [1, 0]); }, 20);
      // lamps along the chapel slope and a signpost
      [[180, -420, 0], [280, -420, 0]].forEach(([x, y, z]) => { add(D.cylinder(x, y, 1.6, z, z + 36, 6)); add(box(x - 4, y - 4, z + 36, x + 4, y + 4, z + 46)); });
      // pennants on the dome spire and a weathervane cockerel
      custom([40, 30, Z1 + 236], (PP, cm) => { const p = cm.project([40, 30, Z1 + 236]); if (!p) return; PP.line(p[0], p[1], p[0], p[1] - 40, { w: 1.1, c: K, passes: 1, over: 0 }); const f = [[p[0], p[1] - 40], [p[0] + 30, p[1] - 34], [p[0] + 22, p[1] - 30], [p[0] + 30, p[1] - 26], [p[0], p[1] - 22]]; white(f); PP.hatch(f, { ang: 90, gap: 2, a: 0.9, w: 0.5, c: K }); polyL(f, 1); }, 400);
    }

    { // a stair to nowhere spiralling up out of the chapel roof, and a floating cog cluster to the right
      for (let k = 0; k < 20; k++) { const a = k * 0.5, r = 34, x = 330 + Math.cos(a) * r, y = -60 + Math.sin(a) * r, z = 200 + k * 9; add(box(x - 7, y - 7, z, x + 7, y + 7, z + 3)); }
      add(D.cylinder(330, -60, 4, 180, 390, 8));
      [[420, 60, 420, 34, 22], [470, 60, 470, 22, 14], [440, 60, 510, 14, 10]].forEach(([x, y, z, r, zt]) => { add(orient(D.gearMesh(0, 0, r, zt, -3, 3, 0.2, { root: 0.84 }), [x, y, z], [0, 1, 0])); add(orient(D.cylinder(0, 0, r * 0.25, -6, 6, 10), [x, y, z], [0, 1, 0])); });
      // chimney pots and a string of lanterns on the chapel ridge
      custom([215, -175, CZ + CH + 90], (PP, cm) => { for (let k = 0; k <= 8; k++) { const y = lerp(CY0 + 10, CY1 - 10, k / 8), p = cm.project([(CX0 + CX1) / 2, y, CZ + CH + 80]); if (!p) continue; PP.line(p[0], p[1], p[0], p[1] + 12, { w: 0.5, c: K, passes: 1, over: 0 }); const l = [[p[0] - 3, p[1] + 12], [p[0] + 3, p[1] + 12], [p[0] + 2.4, p[1] + 20], [p[0] - 2.4, p[1] + 20]]; white(l); polyL(l, 0.9); } }, 200);
    }
    // masts, antennas, a weather vane and a smoking chimney
    [[-150, 100, Z1 + 150 + 58, 90], [190, 60, Z1 + 110 + 66, 60], [-90, -60, Z1 + 120, 110], [230, 100, Z1, 170], [-200, 20, Z1 + 60, 140]].forEach(([x, y, z, h], i) => custom([x, y, z + h / 2], (PP, cm) => { D.polyline3(PP, [[x, y, z], [x, y, z + h]], cm, { w: 1.2, c: K }); for (let k = 1; k < 4; k++) { const zz = z + h * k / 4.5, w = (4 - k) * 6; D.polyline3(PP, [[x - w, y, zz], [x + w, y, zz]], cm, { w: 0.8, c: K }); } if (i === 1) { D.polyline3(PP, [[x, y, z + h], [x + 18, y, z + h - 6]], cm, { w: 1, c: K }); } const tp = cm.project([x, y, z + h]); if (tp) PP.dot(tp[0], tp[1], 2, { c: K }); }, 80));
    { const cx = -60, cy = 120, top = Z1 + 90 + 40; custom([cx, cy, top + 60], (PP, cm) => { const b = cm.project([cx, cy, top]); if (!b) return; for (let k = 0; k < 7; k++) { const x = b[0] - 6 + k * 3 + Math.sin(k) * 10, y = b[1] - 16 - k * 16, r = 8 + k * 3.4; const pts = P.sample(Array.from({ length: 10 }, (_, q) => { const a = q * TAU / 10; return [x + Math.cos(a) * r * R(0.8, 1.15), y + Math.sin(a) * r * R(0.75, 1.1)]; }), true, 2); white(pts); for (let q = 0; q < pts.length; q += 2) { const [px, py] = pts[q], a = Math.atan2(py - y, px - x); if (Math.cos(a + 2.3) > -0.2) continue; PP.line(px, py, px - Math.cos(a) * r * 0.35, py - Math.sin(a) * r * 0.35, { w: 0.5, c: K, passes: 1, over: 0, rough: 0.1 }); } polyL(pts, 1); } }, 200); }
    // the underside: dark corbels, hanging tendrils with droplets, and puffs of foliage clinging to the tower
    custom([0, DY0, DZ - 40], (PP, cm) => { for (let x = DX0 + 10; x < DX1 - 10; x += R(8, 16)) { if ((x > TX0 - 20 && x < TX1 + 20 && P.R() > 0.3) || x > CX0 - 10) continue; const L = R(20, 90), a = cm.project([x, DY0 + 2, DZ]), b = cm.project([x + R(-3, 3), DY0 + 2, DZ - L]); if (!a || !b) continue; PP.line(a[0], a[1], b[0], b[1], { w: 0.8, c: K, passes: 1, over: 0, rough: 0.3 }); const dp = P.sample([[b[0], b[1] - 3], [b[0] + 3, b[1] + 2], [b[0], b[1] + 7], [b[0] - 3, b[1] + 2]], true, 2); white(dp); polyL(dp, 0.9); } for (let y = DY0 + 10; y < DY1 - 10; y += R(10, 18)) { if (y > TY0 - 20 && y < TY1 + 20 && P.R() > 0.3) continue; const L = R(20, 80), a = cm.project([DX0 + 2, y, DZ]), b = cm.project([DX0 + 2, y, DZ - L]); if (!a || !b) continue; PP.line(a[0], a[1], b[0], b[1], { w: 0.8, c: K, passes: 1, over: 0, rough: 0.3 }); PP.dot(b[0], b[1] + 2, 2.2, { c: K }); } }, 30);
    cloudCluster(TX0 - 26, TY0 + 30, 230, 9, 16, 120); cloudCluster(TX0 - 20, TY0 + 110, 110, 7, 14, 120); cloudCluster(CX1 + 10, CY0 + 40, CZ + 10, 6, 13, 60); cloudCluster(DX1 + 20, DY0 + 60, DZ + 40, 8, 16, 200); cloudCluster(DX0 - 60, DY0 + 60, DZ + 90, 8, 15, 300); cloudCluster(90, DY0, Z1 + 120, 7, 14, 100);

    /*__PARTS__*/
    D.render(P, faces, CAM, { ink: K, paper: Wh, light: [-0.2, -0.8, 0.45], ambient: 0.04, w: 1.4, rough: 0.3, zw: 0, hatchMin: 0.06, rich: true, darken: 1.35, gap: 3.6, stipple: true, style: 'layered' });

    /* ================= the comic strip along the bottom: three panels ================= */
    { const Y0 = 790, Y1 = 960, pan = [[60, 470], [486, 1110], [1126, 1540]];
      const lettering = (txt, x, y, sz, o = {}) => P.text(txt, x, y, Object.assign({ size: sz, c: K, font: S.HAND }, o));
      P.line(40, Y0 - 16, 1560, Y0 - 16, { w: 1.2, c: K, passes: 1, over: 0, rough: 0.6 });
      for (let x = 44; x < 1556; x += R(4, 9)) P.curve([[x, Y0 - 16], [x + R(-1, 1), Y0 - 16 - R(2, 7)]], { w: 0.6, c: K, rough: 0.2, passes: 1 });
      pan.forEach(([x0, x1]) => { P.rect(x0, Y0, x1 - x0, Y1 - Y0, { w: 2, c: K, rough: 0.35, over: 0.5, passes: 1 }); });
      // panel 1: a tired little engine-keeper with a kettle for a head, wiping his brow
      { const [x0, x1] = pan[0]; P.hatch([[x0 + 2, Y0 + 2], [x1 - 2, Y0 + 2], [x1 - 2, Y0 + 50], [x0 + 2, Y0 + 50]], { ang: 90, gap: 2.4, a: 0.85, w: 0.5, c: K }); for (let k = 0; k < 6; k++) { const cx = x0 + 40 + k * 70, r = R(18, 30), b = P.sample(Array.from({ length: 10 }, (_, q) => [cx + Math.cos(q * TAU / 10) * r * R(0.8, 1.2), Y0 + 50 + Math.sin(q * TAU / 10) * r * 0.55]), true, 2); white(b); polyL(b, 1); }
        const hx = x0 + 120, hy = Y0 + 110; const kettle = P.sample([[hx - 44, hy + 50], [hx - 50, hy - 4], [hx - 30, hy - 36], [hx + 30, hy - 36], [hx + 50, hy - 4], [hx + 44, hy + 50]], true, 3); white(kettle); P.stipple(kettle, 700, { a: 0.9, r: 0.7, c: K, fade: (x) => Math.max(0, (x - hx + 10) / 60) }); polyL(kettle, 1.6); P.arc(hx + 58, hy + 4, 16, 22, -1.2, 1.4, { w: 1.4, c: K, passes: 1 }); P.line(hx - 50, hy - 8, hx - 80, hy - 30, { w: 4, c: K, passes: 1, over: 0 }); P.circle(hx, hy - 42, 7, { w: 1.2, c: K, passes: 1 });
        [[hx - 16, hy - 6], [hx + 14, hy - 8]].forEach(([ex, ey]) => { white(Array.from({ length: 14 }, (_, q) => [ex + Math.cos(q * TAU / 14) * 8, ey + Math.sin(q * TAU / 14) * 8])); P.circle(ex, ey, 8, { w: 1.2, c: K, passes: 1 }); P.dot(ex + 2, ey + 1, 2.6, { c: K }); }); P.curve([[hx - 8, hy + 18], [hx, hy + 22], [hx + 8, hy + 17]], { w: 1.1, c: K, passes: 1, rough: 0.2 }); P.dot(hx + 26, hy + 6, 2, { c: K }); const drop = P.sample([[hx + 30, hy - 26], [hx + 34, hy - 18], [hx + 30, hy - 13], [hx + 26, hy - 18]], true, 2); white(drop); polyL(drop, 0.9);
        for (let k = 0; k < 14; k++) P.line(x0 + 4 + k * 32, Y1 - 12, x0 + 20 + k * 32, Y1 - 2, { w: 0.9, c: K, passes: 1, over: 0 }), P.line(x0 + 20 + k * 32, Y1 - 2, x0 + 36 + k * 32, Y1 - 12, { w: 0.9, c: K, passes: 1, over: 0 });
        lettering('ALL THIS', x0 + 220, Y0 + 104, 26); lettering('MACHINERY...', x0 + 220, Y0 + 138, 26); }
      // panel 2: the engine's inside, a river of steam and pipes flowing to a teacup, with dotted air
      { const [x0, x1] = pan[1]; for (let i = 0; i < 1600; i++) P.dot(R(x0 + 4, x1 - 4), R(Y0 + 4, Y1 - 4), 0.6, { c: K, a: 0.7 });
        for (let k = 0; k < 9; k++) { const y0 = Y0 + 20 + k * 14, pts = []; for (let x = x0 + 4; x < x0 + 400; x += 10) pts.push([x, y0 + Math.sin(x * 0.03 + k) * 10 + (x - x0) * 0.18 * (k % 3 - 1)]); const L = pts, Rr = pts.map(([x, y]) => [x, y + 7]); const poly = L.concat(Rr.slice().reverse()).filter(([x, y]) => y > Y0 + 3 && y < Y1 - 3); if (poly.length > 4) { white(poly); polyL(poly, 1.1); P.dots(pts.filter((_, i) => i % 2).map(([x, y]) => [x, y + 3.5, 1]), K, 0.9); } }
        for (let k = 0; k < 18; k++) { const cx = x0 + R(20, 380), cy = R(Y0 + 20, Y1 - 20), r = R(6, 18); white(Array.from({ length: 16 }, (_, q) => [cx + Math.cos(q * TAU / 16) * r, cy + Math.sin(q * TAU / 16) * r])); for (let m = 1; m <= 4; m++) P.circle(cx, cy, r * m / 4, { w: m === 4 ? 1.2 : 0.6, c: K, passes: 1 }); }
        const cx = x1 - 150, cy = Y1 - 50; const cup = P.sample([[cx - 60, cy - 30], [cx + 60, cy - 30], [cx + 50, cy + 10], [cx + 20, cy + 30], [cx - 20, cy + 30], [cx - 50, cy + 10]], true, 3); white(cup); P.hatch(cup, { ang: 80, gap: 2.2, a: 0.8, w: 0.5, c: K, fade: x => Math.max(0, (x - cx + 20) / 80) }); polyL(cup, 1.6); P.ellipse(cx, cy - 30, 60, 10, { w: 1.4, c: K, passes: 1 }); black(Array.from({ length: 20 }, (_, q) => [cx + Math.cos(q * TAU / 20) * 54, cy - 30 + Math.sin(q * TAU / 20) * 7])); P.arc(cx + 66, cy - 8, 14, 16, -1.4, 1.4, { w: 1.4, c: K, passes: 1 }); P.ellipse(cx, cy + 34, 90, 12, { w: 1.2, c: K, passes: 1 });
        for (let k = 0; k < 3; k++) P.curve([[cx - 20 + k * 20, cy - 40], [cx - 30 + k * 20, cy - 70], [cx - 10 + k * 20, cy - 100], [cx - 20 + k * 20, cy - 125]], { w: 1, c: K, rough: 0.3, passes: 1 });
        const bub = [x1 - 70, Y0 + 30]; white(Array.from({ length: 20 }, (_, q) => [bub[0] + Math.cos(q * TAU / 20) * 30, bub[1] + Math.sin(q * TAU / 20) * 20])); P.ellipse(bub[0], bub[1], 30, 20, { w: 1.2, c: K, passes: 1 }); lettering('...FOR', bub[0] - 22, bub[1] + 6, 15); }
      // panel 3: one cup of tea, steaming; lettering
      { const [x0, x1] = pan[2]; const cx = (x0 + x1) / 2 + 60, cy = Y1 - 44; const cup = P.sample([[cx - 40, cy - 24], [cx + 40, cy - 24], [cx + 34, cy + 6], [cx + 12, cy + 22], [cx - 12, cy + 22], [cx - 34, cy + 6]], true, 3); white(cup); P.stipple(cup, 500, { a: 0.9, r: 0.7, c: K, fade: x => Math.max(0, (x - cx) / 50) }); polyL(cup, 1.5); P.ellipse(cx, cy - 24, 40, 7, { w: 1.3, c: K, passes: 1 }); P.arc(cx + 44, cy - 6, 10, 12, -1.4, 1.4, { w: 1.3, c: K, passes: 1 }); P.ellipse(cx, cy + 26, 60, 8, { w: 1.1, c: K, passes: 1 }); for (let k = 0; k < 2; k++) P.curve([[cx - 8 + k * 16, cy - 32], [cx - 16 + k * 16, cy - 54], [cx + k * 16, cy - 74]], { w: 1, c: K, rough: 0.3, passes: 1 });
        lettering('ONE CUP', x0 + 24, Y0 + 60, 28); lettering('OF TEA.', x0 + 24, Y0 + 96, 28);
        for (let k = 0; k < 40; k++) { const x = R(x0 + 10, x1 - 10), y = R(Y0 + 110, Y1 - 10); if (Math.hypot(x - cx, y - cy) < 70) continue; P.dot(x, y, 0.8, { c: K, a: 0.8 }); } }
      P.text('THE TEA ENGINE', 1540, 776, { size: 11, align: 'right', a: 0.75 });
    }

  }
});
