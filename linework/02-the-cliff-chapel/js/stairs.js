// stairs.js - masonry engine + the zig-zag flights on the far cliff + the near
// flight, landing, parapet and votive pier in the foreground.
(function () {
  'use strict';
  const LW = window.LW, C = LW.C, V = LW.V;
  const STONE = ['#eadcb2', '#e3d3a5', '#ddca98', '#efe3bf'];
  const STONE_SH = ['#cdb684', '#c6ad78', '#d3bd8c'];
  const MORTAR = '#a88f63';

  // ---------------------------------------------------------------- masonry
  // fp(u,v) -> screen. region: polygon in (u,v). Courses along u, stacked in v.
  // opts: rnd, course [min,max], len [min,max], dark(u,v), lw (line scale), sp (hatch spacing),
  //       shadowDir (screen dir of shade gradient), roundness, chisel
  LW.masonry = function (fp, region, o) {
    const rnd = o.rnd;
    const lw = o.lw || 1;
    const sp = o.sp || 4.4;
    let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
    for (const [u, v] of region) { u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v); }
    const scr = region.map((q) => fp(q[0], q[1]));
    const regPath = LW.polyPath(scr);
    const fillG = LW.fill, inkG = LW.ink;
    LW.occlude(regPath);
    LW.flat(regPath, o.mortar || MORTAR);
    fillG.save(); fillG.clip(regPath);
    inkG.save(); inkG.clip(regPath);
    const pen = new LW.Pen();
    const jg = o.joint ?? 0.025;
    let v = v0 - rnd() * 0.2;
    let row = 0;
    const blocks = [];
    while (v < v1) {
      const ch = rnd.range(o.course[0], o.course[1]);
      let u = u0 - rnd() * o.len[1];
      while (u < u1) {
        const L = rnd.range(o.len[0], o.len[1]) * (row % 2 ? 1 : 0.92);
        blocks.push([u, v, u + L, v + ch]);
        u += L;
      }
      v += ch;
      row++;
    }
    for (const [a0, b0, a1, b1] of blocks) {
      const cu = (a0 + a1) / 2, cv = (b0 + b1) / 2;
      // skip blocks well outside the region (cheap test on corners+centre)
      const inside = [[cu, cv], [a0, b0], [a1, b0], [a0, b1], [a1, b1]].some((q) => LW.pointInPoly(q[0], q[1], region));
      if (!inside) continue;
      // rounded, worn block outline in (u,v)
      const r = Math.min(a1 - a0, b1 - b0) * (o.roundness ?? 0.18) * rnd.range(0.6, 1.4);
      const A0 = a0 + jg, A1 = a1 - jg, B0 = b0 + jg, B1 = b1 - jg;
      const pts = [];
      const corner = (cx, cy, s0) => { for (let k = 0; k <= 4; k++) { const t = s0 + (k / 4) * (Math.PI / 2); pts.push([cx + Math.cos(t) * r, cy + Math.sin(t) * r]); } };
      corner(A1 - r, B0 + r, -Math.PI / 2);
      corner(A1 - r, B1 - r, 0);
      corner(A0 + r, B1 - r, Math.PI / 2);
      corner(A0 + r, B0 + r, Math.PI);
      // resample & wear
      const dense = LW.resample(pts.concat([pts[0]]), Math.max(0.02, (b1 - b0) / 10));
      dense.pop();
      const seed = rnd() * 100;
      const amp = (o.wear ?? 0.012) * (1 + rnd());
      const worn = dense.map(([x, y]) => [x + LW.noise(x * 7 + seed, y * 7) * amp, y + LW.noise2(x * 7, y * 7 + seed) * amp]);
      const sp2 = worn.map((q) => fp(q[0], q[1]));
      const path = LW.polyPath(sp2);
      const bdark = LW.clamp(o.dark(cu, cv) + rnd.range(-0.13, 0.13), 0, 1);
      const pal = bdark > 0.55 ? STONE_SH : STONE;
      LW.flat(path, pal[Math.floor(rnd() * pal.length)]);
      // hatching inside the block along the course direction
      const c0 = fp(cu, cv), c1 = fp(cu + 0.1, cv);
      const ang = Math.atan2(c1[1] - c0[1], c1[0] - c0[0]);
      const bb = LW.bbox(sp2, 1);
      const rad = Math.max(bb.w, bb.h) * 0.5;
      const sd = o.shadowDir || [0.45, 0.89];
      if (bdark > 0.08) {
        LW.hatchDither(pen, bb, ang + rnd.gauss() * 0.09, {
          spacing: sp * rnd.range(0.85, 1.15), step: 3, wob: 1.1 * (o.wob || 1), seed: seed, jitter: o.jitter ?? 0.12,
          inside: (x, y) => LW.pointInPoly(x, y, sp2),
          dark: (x, y) => {
            const t = ((x - c0[0]) * sd[0] + (y - c0[1]) * sd[1]) / rad;
            return LW.clamp(bdark + 0.28 * t + 0.08 * LW.noise(x * 0.05, y * 0.05 + seed), 0, 1);
          },
          w: (x, y, d) => (0.55 + 1.3 * d) * lw,
          taper: 0.3,
        });
      }
      if (bdark > 0.6) {
        LW.hatchDither(pen, bb, ang + 0.62 + rnd.gauss() * 0.1, {
          spacing: sp * 1.25, step: 3, wob: 0.9, seed: seed + 7,
          inside: (x, y) => LW.pointInPoly(x, y, sp2),
          dark: (x, y) => {
            const t = ((x - c0[0]) * sd[0] + (y - c0[1]) * sd[1]) / rad;
            return LW.clamp(bdark - 0.35 + 0.3 * t, 0, 1);
          },
          w: () => 0.8 * lw, taper: 0.35,
        });
      }
      // pitting
      LW.stipple(pen, bb, Math.floor(bb.w * bb.h * 0.0004 * (o.pits ?? 1)), { rng: rnd, inside: (x, y) => LW.pointInPoly(x, y, sp2), r: [0.6 * lw, 1.4 * lw], dark: () => 0.4 + bdark * 0.6 });
      // chisel marks
      if (o.chisel && rnd() < 0.55) {
        LW.flecks(pen, bb, Math.floor(bb.w * bb.h * 0.0035 * o.chisel), {
          rng: rnd, inside: (x, y) => LW.pointInPoly(x, y, sp2), angle: ang + 1.0 + rnd.gauss() * 0.2, spread: 0.12,
          len: [3 * lw, 7 * lw], w: 1.0 * lw, dark: () => 0.85,
        });
      }
      // cracks
      if (rnd() < (o.cracks ?? 0.12)) {
        const p = [];
        let x = rnd.range(A0, A1), y = B1, a = -Math.PI / 2 + rnd.gauss() * 0.5;
        const step = (b1 - b0) / 6;
        for (let k = 0; k < 8 && y > B0 - step; k++) { p.push(fp(x, y)); a += rnd.gauss() * 0.5; x += Math.cos(a) * step; y += Math.sin(a) * step; }
        if (p.length > 2) pen.line(p, 1.3 * lw, 0.45);
      }
      // joint outline: heavy on the shadow side
      LW.inkContour(pen, sp2, (nx, ny, x, y) => {
        const s = LW.shadowSide(nx, ny);
        const w = (0.45 + 2.2 * s * s) * lw * (0.8 + 0.4 * bdark) * (1 + 0.3 * LW.noise3(x * 0.04, y * 0.04));
        return s < 0.25 && LW.noise3(x * 0.03 + seed, y * 0.03) > 0.35 ? 0 : w;
      }, { taper: 0.2 });
      if (pen.n > 400) pen.draw(inkG, C.ink);
    }
    pen.draw(inkG, C.ink);
    inkG.restore();
    fillG.restore();
    if (o.outline !== false) {
      const p2 = new LW.Pen();
      LW.outline(p2, scr, 2.2 * lw, 1.4);
      p2.draw(inkG, C.ink);
    }
    return { path: regPath, scr };
  };

  // simple quad (screen pts) shaded with dither lines along an angle
  LW.shadeQuad = function (pts, o) {
    const path = LW.polyPath(pts);
    LW.occlude(path);
    LW.flat(path, o.fill);
    const pen = new LW.Pen();
    const bb = LW.bbox(pts, 1);
    if (o.dark) {
      LW.hatchDither(pen, bb, o.angle, {
        spacing: o.sp || 4, step: 3, wob: 0.6, seed: o.seed || 0,
        inside: (x, y) => LW.pointInPoly(x, y, pts),
        dark: o.dark,
        w: (x, y, d) => (0.55 + 1.3 * d) * (o.lw || 1),
        taper: 0.3,
      });
    }
    if (o.outline !== false) LW.outline(pen, pts, (o.ow || 1.6) * (o.lw || 1), 1.2);
    pen.draw(LW.ink, C.ink);
    return path;
  };

  // ---------------------------------------------------------------- zig-zag geometry
  const S = LW.scene;
  const ZZ = (LW.zz = {});
  function flightWall(f, rnd) {
    const R = S.RISE, G = S.GO;
    const top = [];
    for (let i = 0; i < f.n; i++) {
      const u = f.u0 + f.dir * i * G, h = f.h0 + i * R;
      top.push([u, h], [u, h + R]);
    }
    top.push([f.u1, f.h1]);
    const depth0 = 1.15 + rnd() * 0.3, depth1 = 1.35 + rnd() * 0.3;
    const bottom = [];
    const m = 14;
    for (let k = 0; k <= m; k++) {
      const t = k / m;
      const u = LW.lerp(f.u1, f.u0, t);
      const h = LW.lerp(f.h1 - depth1, f.h0 - depth0, t) + LW.noise(u * 1.3, f.h0) * 0.3 + 0.12 * LW.noise2(u * 5, f.h0);
      bottom.push([u, h]);
    }
    return { top, poly: top.concat(bottom) };
  }
  ZZ.build = function () {
    if (ZZ.parts) return ZZ.parts;
    const rnd = LW.rng('zzgeom');
    const parts = [];
    S.flights.forEach((f, i) => parts.push({ kind: 'flight', f, i, ...flightWall(f, rnd) }));
    S.landings.forEach((l, i) => {
      const d = 1.5 + rnd() * 0.3;
      const poly = [[l.u0, l.h], [l.u1, l.h], [l.u1, l.h - d + 0.2], [LW.lerp(l.u1, l.u0, 0.5), l.h - d - 0.2], [l.u0, l.h - d]];
      parts.push({ kind: 'landing', l, i, poly });
    });
    ZZ.parts = parts;
    return parts;
  };
  // shadow offset in face coords for a point at offset d
  ZZ.shadowDelta = function (d) {
    const n = V.norm(V.add(S.NF, [0, S.LEAN, 0]));
    const L = LW.L3;
    const t = (d * V.dot(S.NF, n)) / V.dot(L, n);
    const w = V.sub(V.mul(S.NF, d), V.mul(L, t));
    const VA = [-S.LEAN * S.NF[0], 1, -S.LEAN * S.NF[2]];
    return [V.dot(w, S.U), V.dot(w, VA) / V.dot(VA, VA)];
  };
  // mask (screen) of shadows cast by the stair structures onto the rock face
  ZZ.shadowMask = function () {
    if (ZZ._mask) return ZZ._mask;
    const parts = ZZ.build();
    const [du, dh] = ZZ.shadowDelta(S.WIDTH);
    const m = new LW.Mask(900, 500, 1300, 1900, 0.5);
    m.paint((g) => {
      g.fillStyle = '#fff';
      for (const p of parts) {
        for (let t = 0; t <= 1.0001; t += 0.1) {
          const pts = p.poly.map(([u, h]) => S.faceP(u + du * t, h + dh * t, 0));
          g.fill(LW.polyPath(pts));
        }
      }
      // the chapel terrace/final flight block
      const fl = S.final;
      for (let t = 0; t <= 1.0001; t += 0.1) {
        const pts = [[fl.u0 - 0.3, S.summitH], [fl.u1 + 0.3, S.summitH], [fl.u1 + 0.3, fl.h0 - 2], [fl.u0 - 0.3, fl.h0 - 2]].map(([u, h]) => S.faceP(u + du * t, h + dh * t, 0));
        g.fill(LW.polyPath(pts));
      }
    });
    ZZ._mask = m;
    return m;
  };

  // ---------------------------------------------------------------- rails (posts + rope)
  function railPost(pen, base, top, w) {
    pen.line([base, [(base[0] + top[0]) / 2, (base[1] + top[1]) / 2], top], [w * 1.15, w, w * 0.9], 0.04);
    pen.dot(top[0], top[1], w * 0.95);
  }
  function rope(pen, a, b, sag, w, seed) {
    const pts = [];
    const n = Math.max(6, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 4));
    for (let k = 0; k <= n; k++) {
      const t = k / n;
      pts.push([LW.lerp(a[0], b[0], t), LW.lerp(a[1], b[1], t) + sag * 4 * t * (1 - t)]);
    }
    pen.line(pts, w, 0.02);
    return pts;
  }
  LW.railPost = railPost;
  LW.rope = rope;

  // ---------------------------------------------------------------- draw the zig-zag
  LW.drawZigzag = async function () {
    const parts = ZZ.build();
    const rnd = LW.rng('zigzag');
    const W = S.WIDTH;
    // draw from the top (furthest) down
    const order = parts.slice().sort((a, b) => {
      const ha = a.kind === 'flight' ? a.f.h1 : a.l.h, hb = b.kind === 'flight' ? b.f.h1 : b.l.h;
      return hb - ha || (a.kind === 'landing' ? -1 : 1);
    });
    const fp = (u, h) => S.faceP(u, h, W);
    const darkWall = (u, h, top, bot) => {
      const t = LW.clamp((top - h) / Math.max(0.5, top - bot), 0, 1);
      return 0.12 + 0.62 * Math.pow(t, 1.4);
    };
    for (const p of order) {
      if (p.kind === 'flight') {
        const f = p.f;
        // risers (visible only on flights rising to the right)
        if (f.dir > 0) {
          for (let i = f.n - 1; i >= 0; i--) {
            const u = f.u0 + i * S.GO, h = f.h0 + i * S.RISE;
            const q = [S.faceP(u, h, W), S.faceP(u, h + S.RISE, W), S.faceP(u, h + S.RISE, 0.1), S.faceP(u, h, 0.1)];
            LW.shadeQuad(q, { fill: '#efe5c4', angle: 0, sp: 3.6, dark: (x, y) => 0.32 + 0.4 * LW.clamp((y - q[1][1]) / 18, 0, 1), ow: 1.1, seed: i });
          }
        }
        const topH = (u) => f.h0 + Math.abs(u - f.u0) / S.GO * S.RISE;
        LW.masonry(fp, p.poly, {
          rnd, course: [0.24, 0.5], len: [0.3, 1.1], sp: 4.0, lw: 1, chisel: 0.6, roundness: 0.12, joint: 0.018, mortar: '#b09668', jitter: 0.2,
          dark: (u, h) => darkWall(u, h, topH(u), topH(u) - 1.5),
        });
        // step-end stones along the sawtooth (worn nosings)
        const pen = new LW.Pen();
        for (let i = 0; i < f.n; i++) {
          const u = f.u0 + f.dir * i * S.GO, h = f.h0 + (i + 1) * S.RISE;
          const a = fp(u, h), b = fp(u + f.dir * S.GO, h);
          // nosing highlight edge / shadow under the step-stone
          const c = fp(u, h - 0.2), d = fp(u + f.dir * S.GO, h - 0.2);
          pen.line([c, [(c[0] + d[0]) / 2, (c[1] + d[1]) / 2 + 0.6], d], 1.1, 0.3);
          void a; void b;
        }
        // sawtooth top contour (heavier)
        LW.inkContour(pen, p.top.map(([u, h]) => fp(u, h)), () => 2.4 + rnd() * 0.6, { closed: false, taper: 0.05 });
        pen.draw(LW.ink, C.ink);
        // iron posts + rope along the outer edge
        const rp = new LW.Pen();
        const posts = [];
        const L = f.n * S.GO;
        const np = Math.round(L / 1.45);
        const kmax = p.i === 2 ? -1 : np;
        for (let k = 0; k <= kmax; k++) {
          const s = (k / np) * L;
          const u = f.u0 + f.dir * s;
          const h = topH(u) + 0.02;
          const b = S.faceP(u, h, W - 0.08), t = S.faceP(u, h + 0.95, W - 0.08);
          posts.push(t);
          railPost(rp, b, t, 3.4);
        }
        for (let k = 0; k < posts.length - 1; k++) rope(rp, posts[k], posts[k + 1], 9, 2.0, k);
        void 0;
        rp.draw(LW.ink, C.ink);
      } else {
        const l = p.l;
        // the visible end face of left-hand landings
        if (p.i === 1) {
          const q = [S.faceP(l.u0, l.h, W), S.faceP(l.u0, l.h, 0.0), S.faceP(l.u0, l.h - 2.3, 0.0), S.faceP(l.u0, l.h - 2.3, W)];
          LW.masonry((a, b) => S.faceP(l.u0, b, a), [[W, l.h], [0, l.h], [0, l.h - 1.6], [W, l.h - 1.6]], {
            rnd, course: [0.32, 0.5], len: [0.4, 0.8], sp: 4.0, chisel: 0.4, dark: () => 0.42, roundness: 0.12, joint: 0.018, mortar: '#b09668',
          });
          void q;
        }
        LW.masonry(fp, p.poly, {
          rnd, course: [0.32, 0.5], len: [0.45, 1.05], sp: 4.2, chisel: 0.6, roundness: 0.12, joint: 0.018, mortar: '#b09668', jitter: 0.2,
          dark: (u, h) => darkWall(u, h, l.h, l.h - 1.7),
        });
        // coping line + corner posts
        const pen = new LW.Pen();
        const a = fp(l.u0, l.h), b = fp(l.u1, l.h);
        pen.line([a, b], 2.6, 0.05);
        const c = fp(l.u0, l.h - 0.22), d = fp(l.u1, l.h - 0.22);
        pen.line([c, d], 1.2, 0.2);
        const pa = S.faceP(l.u0 + 0.1, l.h, W - 0.08), pb = S.faceP(l.u1 - 0.1, l.h, W - 0.08);
        const ta = S.faceP(l.u0 + 0.1, l.h + 0.95, W - 0.08), tb = S.faceP(l.u1 - 0.1, l.h + 0.95, W - 0.08);
        if (p.i !== 2) {
          railPost(pen, pa, ta, 3.4);
          railPost(pen, pb, tb, 3.4);
          rope(pen, ta, tb, 8, 2.0, 0);
        }
        pen.draw(LW.ink, C.ink);
      }
      await LW.tick();
    }
  };
})();
