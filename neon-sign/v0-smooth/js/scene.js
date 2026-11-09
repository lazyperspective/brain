// The city: camera, geometry (triangles with a material id and four parameters per face), static lights,
// aircraft-warning beacons, switchable hotel windows, and the sign's light sample points.
// World units are metres; the camera sits at the origin looking down +z, y up. Verticals stay vertical: the frame
// is a shifted lens (principal point low in the frame), not a tilted camera.
(function () {
  const NS = window.NS || (window.NS = {});

  // material ids (keep in sync with the shader)
  const M = NS.MAT = { SKY: 0, HOTEL: 1, STONE: 2, STEEL: 3, FACE: 4, RETURN: 5, GRATING: 6, TANK: 7, METAL: 8, ROOMWALL: 9,
    GLASS: 10, BRICK: 11, FAR: 12, ROOF: 13, CONCRETE: 14, BALCONY: 15, LAMP: 16, CABLE: 17, COPPER: 18 };

  NS.SIGN = { Zs: 106.0, depth: 0.85, capH: 7.0, y0: 21.0, emblemH: 8.2, emblemGap: 2.2, xc: 0.0 };

  NS.camera = function (W, H) { return { W, H, f: 1.07 * W, cx: 0.5 * W, cy: 0.705 * H, near: 1.0, far: 6000 }; };

  function Geo() { this.v = []; }
  // one triangle; n is the face normal
  Geo.prototype.tri = function (a, b, c, n, mat, p) {
    for (const q of [a, b, c]) this.v.push(q[0], q[1], q[2], n[0], n[1], n[2], mat, p[0], p[1], p[2], p[3]);
  };
  Geo.prototype.quad = function (a, b, c, d, n, mat, p) { this.tri(a, b, c, n, mat, p); this.tri(a, c, d, n, mat, p); };
  // axis-aligned box; skip: string of faces to leave out ('xXyYzZ' = -x,+x,-y,+y,-z,+z)
  Geo.prototype.box = function (x0, y0, z0, x1, y1, z1, mat, p, skip) {
    p = p || [0, 0, 0, 0]; skip = skip || '';
    if (!skip.includes('z')) this.quad([x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [0, 0, -1], mat, p);
    if (!skip.includes('Z')) this.quad([x1, y0, z1], [x0, y0, z1], [x0, y1, z1], [x1, y1, z1], [0, 0, 1], mat, p);
    if (!skip.includes('x')) this.quad([x0, y0, z1], [x0, y0, z0], [x0, y1, z0], [x0, y1, z1], [-1, 0, 0], mat, p);
    if (!skip.includes('X')) this.quad([x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0], [1, 0, 0], mat, p);
    if (!skip.includes('y')) this.quad([x0, y0, z1], [x1, y0, z1], [x1, y0, z0], [x0, y0, z0], [0, -1, 0], mat, p);
    if (!skip.includes('Y')) this.quad([x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1], [0, 1, 0], mat, p);
  };
  // a beam from a to b with a w x h section; up is a hint for the h axis
  Geo.prototype.beam = function (a, b, w, h, mat, p, up) {
    const d = norm(sub(b, a));
    let u = up || (Math.abs(d[1]) > 0.9 ? [0, 0, 1] : [0, 1, 0]);
    let s = norm(cross(d, u)); u = norm(cross(s, d));
    const hw = w / 2, hh = h / 2;
    const c = (o, i, j) => [o[0] + s[0] * i * hw + u[0] * j * hh, o[1] + s[1] * i * hw + u[1] * j * hh, o[2] + s[2] * i * hw + u[2] * j * hh];
    const A = [c(a, -1, -1), c(a, 1, -1), c(a, 1, 1), c(a, -1, 1)], B = [c(b, -1, -1), c(b, 1, -1), c(b, 1, 1), c(b, -1, 1)];
    const ns = [neg(u), s, u, neg(s)];
    for (let k = 0; k < 4; k++) { const k2 = (k + 1) % 4; this.quad(A[k], A[k2], B[k2], B[k], ns[k], mat, p); }
    this.quad(A[3], A[2], A[1], A[0], neg(d), mat, p);
    this.quad(B[0], B[1], B[2], B[3], d, mat, p);
  };
  // vertical cylinder (open), n sides; p carries the centre for the shader
  Geo.prototype.cyl = function (cx, cz, y0, y1, r, n, mat, p) {
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * 2 * Math.PI, a1 = ((i + 1) / n) * 2 * Math.PI, am = (a0 + a1) / 2;
      const P0 = [cx + r * Math.cos(a0), y0, cz + r * Math.sin(a0)], P1 = [cx + r * Math.cos(a1), y0, cz + r * Math.sin(a1)];
      const nn = [Math.cos(am), 0, Math.sin(am)];
      this.quad(P1, P0, [P0[0], y1, P0[2]], [P1[0], y1, P1[2]], nn, mat, p);
    }
  };
  Geo.prototype.cone = function (cx, cz, y0, y1, r, n, mat, p) {
    const s = r / (y1 - y0), k = 1 / Math.hypot(1, s);
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * 2 * Math.PI, a1 = ((i + 1) / n) * 2 * Math.PI, am = (a0 + a1) / 2;
      this.tri([cx + r * Math.cos(a1), y0, cz + r * Math.sin(a1)], [cx + r * Math.cos(a0), y0, cz + r * Math.sin(a0)], [cx, y1, cz], [Math.cos(am) * k, s * k, Math.sin(am) * k], mat, p);
    }
  };
  // extrude a convex polygon in the sign plane: front face at z0 (facing -z), returns back to z1
  Geo.prototype.prism = function (poly, z0, z1, matF, matS, pF, pS) {
    const c = NS.centroid(poly);
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length];
      this.tri([c[0], c[1], z0], [a[0], a[1], z0], [b[0], b[1], z0], [0, 0, -1], matF, pF);
      let nx = b[1] - a[1], ny = -(b[0] - a[0]);
      const l = Math.hypot(nx, ny) || 1; nx /= l; ny /= l;
      // outward normal: away from the centroid
      if ((a[0] - c[0]) * nx + (a[1] - c[1]) * ny < 0) { nx = -nx; ny = -ny; }
      this.quad([a[0], a[1], z0], [b[0], b[1], z0], [b[0], b[1], z1], [a[0], a[1], z1], [nx, ny, 0], matS, pS);
    }
  };

  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
  const neg = (a) => [-a[0], -a[1], -a[2]];

  // a hanging cable (catenary-ish parabola) from a to b with sag s, as thin beams
  function cable(g, a, b, sag, r, n) {
    let prev = a;
    for (let i = 1; i <= n; i++) {
      const u = i / n;
      const q = [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u - 4 * sag * u * (1 - u), a[2] + (b[2] - a[2]) * u];
      g.beam(prev, q, r, r, M.CABLE, [0, 0, 0, 0]);
      prev = q;
    }
  }

  NS.buildScene = function () {
    const g = new Geo();
    const S = NS.SIGN;
    const rnd = NS.mulberry32(20261109);

    // ---------- the hotel ----------
    // main shaft, crown (two set-back top floors), cornice, parapet, corner fins
    g.box(-32, -64, 100, 32, 9.4, 134, M.HOTEL, [1, 0, 0, 0]);
    g.box(-32.4, 9.0, 99.55, 32.4, 9.62, 134, M.STONE, [2, 0, 0, 0]);
    g.box(-32.25, 8.55, 99.75, 32.25, 9.0, 134, M.STONE, [2, 1, 0, 0]);
    g.box(-30.5, 9.62, 101.5, 30.5, 16.0, 132, M.HOTEL, [1, 1, 0, 0]);
    g.box(-30.5, 16.0, 101.5, 30.5, 17.2, 101.85, M.STONE, [3, 0, 0, 0]);
    g.box(-30.65, 17.2, 101.38, 30.65, 17.42, 101.98, M.STONE, [3, 1, 0, 0]);
    for (const sx of [-1, 1]) {
      // stepped deco fins at the crown corners
      g.box(sx < 0 ? -31.0 : 29.4, 9.62, 101.0, sx < 0 ? -29.4 : 31.0, 18.3, 102.6, M.STONE, [4, 0, 0, 0]);
      g.box(sx < 0 ? -30.8 : 29.7, 18.3, 101.2, sx < 0 ? -29.7 : 30.8, 19.4, 102.4, M.STONE, [4, 1, 0, 0]);
      g.box(sx < 0 ? -30.55 : 29.95, 19.4, 101.4, sx < 0 ? -29.95 : 30.55, 20.2, 102.2, M.STONE, [4, 2, 0, 0]);
    }
    // brick piers every second bay, projecting, running up to the cornice
    for (let k = 0; k <= 10; k++) {
      const x = -32 + 6.4 * k, x0 = Math.max(-32, x - 0.42), x1 = Math.min(32, x + 0.42);
      g.box(x0, -64, 99.62, x1, 8.55, 100, M.HOTEL, [1, 2, 0, 0], 'Z');
    }
    // string courses on the main shaft every floor (thin projecting bands)
    for (let k = 14; k <= 20; k++) {
      const y = -59.9 + 3.3 * k;
      g.box(-32, y - 0.12, 99.88, 32, y + 0.05, 100.0, M.STONE, [5, 0, 0, 0], 'Z');
    }
    // stacked balconies on the outer bays (solid deco balustrades)
    for (let k = 14; k <= 20; k++) {
      const y = -59.9 + 3.3 * k;
      for (const [x0, x1] of [[-28.8, -22.4], [22.4, 28.8]]) {
        g.box(x0, y - 0.22, 98.65, x1, y + 0.02, 100, M.BALCONY, [0, k, 0, 0], 'Z');
        g.box(x0, y + 0.02, 98.65, x1, y + 1.02, 98.85, M.BALCONY, [1, k, 0, 0], 'Z');
        g.box(x0, y + 0.02, 98.85, x0 + 0.2, y + 1.02, 100, M.BALCONY, [1, k, 0, 0], 'Z');
        g.box(x1 - 0.2, y + 0.02, 98.85, x1, y + 1.02, 100, M.BALCONY, [1, k, 0, 0], 'Z');
        g.box(x0 - 0.03, y + 1.02, 98.6, x1 + 0.03, y + 1.1, 98.9, M.METAL, [0.5, 0, 0, 0], 'Z');
      }
    }

    // ---------- rooftop: water tank (left), machine room with mast (right), cabinet ----------
    const tx = -28.05, tz = 104.0, tr = 1.95;
    for (const [dx, dz] of [[-1.5, -1.5], [1.5, -1.5], [-1.5, 1.5], [1.5, 1.5]]) g.box(tx + dx - 0.14, 16, tz + dz - 0.14, tx + dx + 0.14, 19.0, tz + dz + 0.14, M.STEEL, [0.6, 0, 0, 0]);
    g.box(tx - 2.0, 18.85, tz - 2.0, tx + 2.0, 19.05, tz + 2.0, M.STEEL, [0.6, 0, 0, 0]);
    g.beam([tx - 1.5, 16.2, tz - 1.5], [tx + 1.5, 18.8, tz - 1.5], 0.09, 0.09, M.STEEL, [0.6, 0, 0, 0]);
    g.beam([tx + 1.5, 16.2, tz - 1.5], [tx - 1.5, 18.8, tz - 1.5], 0.09, 0.09, M.STEEL, [0.6, 0, 0, 0]);
    g.cyl(tx, tz, 19.05, 24.4, tr, 40, M.TANK, [tx, tz, tr, 0]);
    g.cone(tx, tz, 24.4, 25.9, tr + 0.18, 40, M.METAL, [0.35, 1, 0, 0]);
    g.box(tx - 0.12, 25.75, tz - 0.12, tx + 0.12, 26.25, tz + 0.12, M.METAL, [0.35, 0, 0, 0]);
    // ladder up the tank side facing the sign
    for (const dz of [-0.22, 0.22]) g.box(tx + tr + 0.08, 19.0, tz + dz - 0.025, tx + tr + 0.13, 25.0, tz + dz + 0.025, M.STEEL, [0.5, 0, 0, 0]);
    for (let y = 19.25; y < 25; y += 0.32) g.box(tx + tr + 0.08, y, tz - 0.22, tx + tr + 0.12, y + 0.035, tz + 0.22, M.STEEL, [0.5, 0, 0, 0]);
    // machine room and stair bulkhead (right)
    g.box(26.5, 16, 103.2, 30.3, 21.4, 111, M.ROOMWALL, [0, 0, 0, 0]);
    g.box(26.35, 21.4, 103.05, 30.45, 21.65, 111.15, M.STONE, [6, 0, 0, 0]);
    g.box(27.4, 21.65, 104.5, 29.6, 23.1, 107.5, M.METAL, [0.25, 2, 0, 0]); // rooftop unit with fan
    // mast with beacon
    g.box(28.85, 21.65, 108.6, 29.15, 37.5, 108.9, M.STEEL, [0.45, 0, 0, 0]);
    g.box(28.6, 37.5, 108.5, 29.4, 37.75, 109.0, M.STEEL, [0.45, 0, 0, 0]);
    g.beam([29, 30.0, 108.75], [26.7, 21.65, 103.4], 0.02, 0.02, M.CABLE, [0, 0, 0, 0]);
    g.beam([29, 30.0, 108.75], [30.2, 21.65, 104.5], 0.02, 0.02, M.CABLE, [0, 0, 0, 0]);
    // electrical cabinet on the roof behind the parapet, and a conduit stack
    g.box(-15.4, 16, 102.2, -13.6, 18.9, 102.9, M.METAL, [0.55, 0, 0, 0]);
    g.box(-15.5, 18.9, 102.1, -13.5, 19.0, 103.0, M.METAL, [0.5, 0, 0, 0]);
    g.box(12.5, 16, 103.0, 13.9, 18.4, 104.2, M.METAL, [0.4, 3, 0, 0]);

    // ---------- the sign: letters, frame, catwalk, ladder, work light, cables ----------
    const lay = NS.layoutSign({ capH: S.capH, y0: S.y0, emblemH: S.emblemH, emblemGap: S.emblemGap, xc: S.xc });
    lay.sources.forEach((src, k) => src.polys.forEach((poly) => g.prism(poly, S.Zs, S.Zs + S.depth, M.FACE, M.RETURN, [k, 0, 0, 0], [k, 0, 0, 0])));
    // frame: posts behind the letters, girders, cross bracing, raking back struts
    const zp = S.Zs + S.depth + 0.45, posts = [];
    for (let i = 0; i <= 12; i++) posts.push(lay.x0 - 0.4 + (lay.x1 - lay.x0 + 0.8) * i / 12);
    const steel = [0.32, 0, 0, 0];
    posts.forEach((x) => {
      g.box(x - 0.2, 16, zp - 0.2, x + 0.2, 28.25, zp + 0.2, M.STEEL, steel);
      g.beam([x, 27.9, zp + 0.25], [x, 16.1, zp + 7.0], 0.22, 0.22, M.STEEL, steel);
      // catwalk outrigger and knee brace
      g.box(x - 0.11, 19.78, S.Zs - 1.65, x + 0.11, 20.02, zp - 0.2, M.STEEL, steel);
      g.beam([x, 18.4, zp - 0.2], [x, 19.8, S.Zs - 1.45], 0.1, 0.1, M.STEEL, steel);
    });
    const xa = posts[0] - 0.3, xb = posts[12] + 0.3;
    for (const [y0, y1] of [[18.25, 18.55], [20.95, 21.25], [24.5, 24.8], [27.45, 27.75]]) g.box(xa, y0, zp - 0.15, xb, y1, zp + 0.15, M.STEEL, steel);
    for (let i = 0; i < 12; i++) {
      const a = posts[i], b = posts[i + 1];
      const pairs = i % 2 ? [[[a, 18.55, zp + 0.25], [b, 24.5, zp + 0.25]], [[a, 24.8, zp + 0.3], [b, 27.45, zp + 0.3]]]
        : [[[a, 24.5, zp + 0.25], [b, 18.55, zp + 0.25]], [[a, 27.45, zp + 0.3], [b, 24.8, zp + 0.3]]];
      pairs.push([[a, 16.2, zp + 0.25], [b, 18.25, zp + 0.25]]);
      pairs.forEach(([p, q]) => g.beam(p, q, 0.13, 0.13, M.STEEL, steel));
    }
    // catwalk: grating deck, toe board, posts and rails
    const cz0 = S.Zs - 1.75, cz1 = S.Zs - 0.35;
    g.box(xa - 0.4, 20.02, cz0, xb + 0.4, 20.1, cz1, M.GRATING, [0, 0, 0, 0]);
    const galv = [0.32, 1, 0, 0];
    g.box(xa - 0.4, 20.0, cz0 - 0.05, xb + 0.4, 20.25, cz0, M.STEEL, galv);
    for (let x = xa - 0.35; x <= xb + 0.4; x += 1.6) g.box(x - 0.03, 20.1, cz0 + 0.02, x + 0.03, 21.12, cz0 + 0.08, M.STEEL, galv);
    g.box(xa - 0.4, 21.1, cz0 + 0.0, xb + 0.4, 21.17, cz0 + 0.1, M.STEEL, galv);
    g.box(xa - 0.4, 20.6, cz0 + 0.03, xb + 0.4, 20.64, cz0 + 0.07, M.STEEL, galv);
    // ladder from the roof to the catwalk at the right end
    const lx = xb + 0.1, lz = cz0 + 0.5;
    for (const dx of [0, 0.48]) g.box(lx + dx - 0.03, 16.0, lz - 0.03, lx + dx + 0.03, 21.3, lz + 0.03, M.STEEL, [0.45, 0, 0, 0]);
    for (let y = 16.25; y < 20.0; y += 0.3) g.box(lx, y, lz - 0.015, lx + 0.48, y + 0.03, lz + 0.015, M.STEEL, [0.45, 0, 0, 0]);
    // work light: pole on the catwalk at the right end, lamp head aimed back at the letters
    // work light: a caged bulb on a bracket at the right end of the catwalk, left burning
    const wl = [xb - 2.6, 21.75, cz0 + 0.18];
    g.box(wl[0] - 0.025, 21.12, wl[2] - 0.025, wl[0] + 0.025, wl[1] + 0.18, wl[2] + 0.025, M.STEEL, [0.45, 1, 0, 0]);
    g.cyl(wl[0], wl[2], wl[1] - 0.09, wl[1] + 0.09, 0.07, 10, M.LAMP, [1, 0, 0, 0]);
    g.cone(wl[0], wl[2], wl[1] + 0.09, wl[1] + 0.16, 0.08, 10, M.LAMP, [1, 0, 0, 0]);
    for (let a = 0; a < 4; a++) { const an = a * Math.PI / 2 + 0.4; g.beam([wl[0] + 0.12 * Math.cos(an), wl[1] - 0.13, wl[2] + 0.12 * Math.sin(an)], [wl[0] + 0.12 * Math.cos(an), wl[1] + 0.14, wl[2] + 0.12 * Math.sin(an)], 0.012, 0.012, M.STEEL, [0.3, 0, 0, 0]); }
    // cables: conduit sagging under the catwalk, feeds dropping to the cabinet
    for (let i = 0; i < 12; i++) cable(g, [posts[i], 19.7, cz0 + 0.3], [posts[i + 1], 19.7, cz0 + 0.3], 0.22, 0.045, 10);
    cable(g, [posts[3] + 0.4, 19.75, cz0 + 0.5], [-14.5, 19.0, 102.5], 0.55, 0.05, 14);
    cable(g, [posts[3] + 0.9, 19.75, cz0 + 0.6], [-13.9, 19.0, 102.6], 0.75, 0.04, 14);
    cable(g, [posts[9], 19.75, cz0 + 0.4], [13.2, 18.4, 103.6], 0.4, 0.045, 12);
    cable(g, [xb, 21.0, zp], [26.6, 20.2, 104.0], 0.3, 0.04, 10);

    // ---------- the glass tower (right, nearer) ----------
    g.box(27.5, -64, 40, 74, 92, 90, M.GLASS, [0, 0, 0, 0]);
    // ---------- the old brick building (left) and its water tank ----------
    g.box(-90, -64, 55, -31.0, 7.0, 98, M.BRICK, [0, 0, 0, 0]);
    g.box(-90, 7.0, 54.8, -30.8, 7.8, 98.2, M.STONE, [7, 0, 0, 0]);
    const t2x = -38.5, t2z = 88.0;
    for (const [dx, dz] of [[-1.2, -1.2], [1.2, -1.2], [-1.2, 1.2], [1.2, 1.2]]) g.box(t2x + dx - 0.12, 7.8, t2z + dz - 0.12, t2x + dx + 0.12, 10.6, t2z + dz + 0.12, M.STEEL, [0.5, 0, 0, 0]);
    g.box(t2x - 1.7, 10.5, t2z - 1.7, t2x + 1.7, 10.65, t2z + 1.7, M.STEEL, [0.5, 0, 0, 0]);
    g.cyl(t2x, t2z, 10.65, 15.0, 1.8, 32, M.TANK, [t2x, t2z, 1.8, 1]);
    g.cone(t2x, t2z, 15.0, 16.2, 1.95, 32, M.METAL, [0.3, 1, 0, 0]);
    // a mid-distance block between brick building and hotel
    g.box(-60, -64, 112, -35.0, 13.5, 150, M.BRICK, [1, 0, 0, 0]);

    // ---------- mid-ground rooftops between us and the hotel ----------
    g.box(-27, -64, 56, -3, -0.6, 78, M.BRICK, [2, 0, 0, 0]);
    g.box(-27.2, -0.6, 55.8, -2.8, -0.2, 78.2, M.CONCRETE, [0, 0, 0, 0]);
    { // a timber water tank on a tall stand, and a stair bulkhead
      const cx = -14.5, cz = 66.5, r = 1.7, y0 = -0.2;
      for (const [dx, dz] of [[-1.15, -1.15], [1.15, -1.15], [-1.15, 1.15], [1.15, 1.15]]) g.box(cx + dx - 0.1, y0, cz + dz - 0.1, cx + dx + 0.1, y0 + 3.6, cz + dz + 0.1, M.STEEL, [0.5, 0, 0, 0]);
      g.beam([cx - 1.15, y0 + 0.2, cz - 1.15], [cx + 1.15, y0 + 3.4, cz - 1.15], 0.06, 0.06, M.STEEL, [0.5, 0, 0, 0]);
      g.beam([cx + 1.15, y0 + 0.2, cz - 1.15], [cx - 1.15, y0 + 3.4, cz - 1.15], 0.06, 0.06, M.STEEL, [0.5, 0, 0, 0]);
      g.box(cx - 1.55, y0 + 3.6, cz - 1.55, cx + 1.55, y0 + 3.75, cz + 1.55, M.STEEL, [0.5, 0, 0, 0]);
      g.cyl(cx, cz, y0 + 3.75, y0 + 7.6, r, 32, M.TANK, [cx, cz, r, 2]);
      g.cone(cx, cz, y0 + 7.6, y0 + 8.7, r + 0.15, 32, M.METAL, [0.3, 1, 0, 0]);
      g.box(-24.5, -0.2, 70, -20.5, 2.6, 74.5, M.ROOMWALL, [1, 0, 0, 0]);
      g.box(-8.5, -0.2, 60, -6.5, 1.2, 61.5, M.METAL, [0.35, 3, 0, 0]);
      g.cyl(-5.0, 63.0, -0.2, 2.4, 0.28, 16, M.METAL, [0.4, 0, -5.0, 63.0]);
    }
    g.box(5, -64, 62, 27, -2.6, 82, M.BRICK, [3, 0, 0, 0]);
    g.box(4.8, -2.6, 61.8, 27.2, -2.25, 82.2, M.CONCRETE, [0, 0, 0, 0]);
    g.box(9, -2.25, 66, 13.5, -0.6, 69.5, M.METAL, [0.3, 2, 0, 0]);
    g.box(15, -2.25, 66.5, 18.6, -0.9, 69.0, M.METAL, [0.3, 2, 0, 0]);
    g.cyl(22.5, 70.0, -2.25, 3.8, 0.35, 16, M.METAL, [0.4, 0, 22.5, 70.0]);
    g.beam([22.5, 3.8, 70.0], [22.5, 4.4, 69.6], 0.5, 0.5, M.METAL, [0.4, 0, 0, 0]);

    // ---------- the distant city ----------
    const far = (x0, x1, z0, z1, hmin, hmax, n, seedBase) => {
      for (let i = 0; i < n; i++) {
        const z = z0 + (z1 - z0) * Math.pow(rnd(), 0.8), x = x0 + (x1 - x0) * rnd();
        const w = 14 + rnd() * 34, d = 14 + rnd() * 30;
        const h = hmin + (hmax - hmin) * Math.pow(rnd(), 1.6) * (0.6 + 0.5 * (z - z0) / (z1 - z0));
        g.box(x - w / 2, -70, z, x + w / 2, h, z + d, M.FAR, [seedBase + i, 0.12 + 0.3 * rnd(), rnd() < 0.18 ? 1 : 0, 0], 'Z');
      }
    };
    far(-480, -45, 150, 420, 5, 70, 34, 100);
    far(-420, -60, 260, 700, 30, 120, 30, 600);
    far(40, 300, 140, 380, 15, 80, 16, 700);
    far(-900, -120, 420, 1300, 20, 210, 46, 200);
    far(36, 520, 150, 500, 10, 90, 26, 300);
    far(80, 1000, 500, 1400, 20, 230, 40, 400);
    far(-200, 220, 220, 1500, 0, 120, 40, 500);
    // two landmark towers far off, to the left of the hotel and right behind it
    g.box(-330, -70, 980, -282, 330, 1030, M.FAR, [901, 0.10, 1, 0], 'Z');
    g.box(-321, 330, 989, -291, 360, 1021, M.FAR, [902, 0.05, 0, 0], 'Z');
    g.box(-308.5, 360, 1003.5, -304.5, 420, 1007.5, M.STEEL, [0.3, 0, 0, 0]);
    g.box(150, -70, 760, 190, 175, 800, M.FAR, [903, 0.25, 1, 0], 'Z');

    // ---------- our rooftop in the foreground ----------
    g.box(-60, -2.6, 4, 60, -1.6, 30.0, M.ROOF, [0, 0, 0, 0]);
    g.box(-60, -1.6, 29.6, 60, -1.3, 30.15, M.CONCRETE, [0, 0, 0, 0]);
    // a gooseneck vent and a low curb on our roof
    g.cyl(-6.4, 17.0, -1.6, -1.0, 0.13, 18, M.METAL, [0.45, 0, -6.4, 17.0]);
    g.beam([-6.4, -1.05, 17.0], [-6.4, -0.86, 16.8], 0.26, 0.26, M.METAL, [0.45, 0, 0, 0]);
    g.beam([-6.4, -0.86, 16.8], [-6.4, -0.98, 16.45], 0.26, 0.26, M.METAL, [0.45, 0, 0, 0]);

    return { verts: new Float32Array(g.v), layout: lay, wl };
  };

  // Beacons: red aircraft-warning lights. period = D / n; duty is the on share. steady ones have n = 0.
  NS.beacons = [
    { p: [29.0, 37.9, 108.75], n: 10, ph: 0.15, duty: 0.42, size: 0.32 },
    { p: [-306.5, 422, 1005.5], n: 12, ph: 0.55, duty: 0.4, size: 1.6 },
    { p: [170, 177, 780], n: 9, ph: 0.8, duty: 0.4, size: 1.2 },
    { p: [-306, 362, 990], n: 0, ph: 0, duty: 1, size: 1.0 },
    { p: [-286, 332, 982], n: 0, ph: 0, duty: 1, size: 1.0 },
    { p: [29.0, 22.0, 104.2], n: 0, ph: 0, duty: 1, size: 0.0 },
  ];
  // Switchable hotel rooms on the front face: bay, floor, colour index (0 warm, 1 cool, 2 tv)
  NS.dynWindows = [
    { bay: 6, floor: 19, col: 0 },
    { bay: 13, floor: 17, col: 0 },
    { bay: 10, floor: 21, col: 1 },
    { bay: 3, floor: 16, col: 2 },
  ];
})();
