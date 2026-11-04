/* Trees: canopy clumps by dart throwing inside a domed envelope, limbs grown toward clump
 * clusters, bark grain that flows round knots, scalloped foliage with nested contours and rim light. */
(function () {
  'use strict';
  const LW = window.LW, SC = LW.SC, P = LW.P;

  function gnarl(rng, x0, y0, x1, y1, segs, amp) {
    const ctrl = [[x0, y0]];
    const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy) || 1;
    const nx = -dy / L, ny = dx / L;
    for (let i = 1; i < segs; i++) {
      const t = i / segs;
      const o = rng.range(-amp, amp) * L * Math.sin(Math.PI * t);
      ctrl.push([x0 + dx * t + nx * o, y0 + dy * t + ny * o]);
    }
    ctrl.push([x1, y1]);
    return LW.resample(LW.spline(ctrl, 8), 3);
  }
  function closestOn(pts, x, y) {
    let best = 0, bd = 1e18;
    for (let i = 0; i < pts.length; i += 2) {
      const d = (pts[i] - x) ** 2 + (pts[i + 1] - y) ** 2;
      if (d < bd) { bd = d; best = i >> 1; }
    }
    return best;
  }

  LW.makeTree = function (seed, o) {
    const rng = new LW.RNG(seed);
    const { bx, by, H, spread } = o;
    const fx = bx + (o.lean || 0) * H * 0.12, fy = by - H * (o.trunkFrac || 0.34);
    const cx = bx + (o.canopyDx || 0), cy = by - H * (o.canopyY || 0.64);
    const rx = spread / 2, ry = H * (o.canopyRy || 0.34);
    const cr = o.clumpR;
    const clumps = [];
    const tries = 6000;
    for (let i = 0; i < tries && clumps.length < (o.maxClumps || 400); i++) {
      const x = cx + rng.range(-rx * 1.15, rx * 1.15), y = cy + rng.range(-ry * 1.2, ry * 1.15);
      const ux = (x - cx) / rx, uy = (y - cy) / ry;
      const a = Math.atan2(uy, ux);
      const edge = 1 + 0.18 * LW.N1(Math.cos(a) * 1.6 + seed.length, Math.sin(a) * 1.6) + 0.1 * LW.N2(Math.cos(a) * 4, Math.sin(a) * 4);
      let rr = Math.hypot(ux, uy * (uy > 0 ? 1.25 : 1));
      if (rr > edge || uy < -0.97) continue;
      // holes for sky gaps
      const hole = LW.fbm(LW.N3, x * 0.0065 + seed.length, y * 0.0065, 3);
      if (hole > (o.holes || 0.3) && rr > 0.25) continue;
      const r = cr * rng.range(0.62, 1.12) * (1.05 - 0.25 * rr);
      let ok = true;
      for (const c of clumps) { if ((c.x - x) ** 2 + (c.y - y) ** 2 < ((c.r + r) * 0.52) ** 2) { ok = false; break; } }
      if (!ok) continue;
      clumps.push({ x, y, r, back: rng.next() < 0.35, rr });
    }
    // main limbs: cluster clumps by angle seen from the fork
    const K = o.limbs || 5;
    const angs = clumps.map((c) => Math.atan2(c.y - fy, c.x - fx));
    const sorted = clumps.map((c, i) => i).sort((a, b) => angs[a] - angs[b]);
    const groups = [];
    for (let k = 0; k < K; k++) groups.push(sorted.slice(Math.floor((k * sorted.length) / K), Math.floor(((k + 1) * sorted.length) / K)));
    const branches = [];
    const tw = o.trunkW;
    // trunk
    const trunk = gnarl(rng, bx, by + 4, fx, fy, 3, 0.05);
    branches.push({ pts: trunk, w0: tw * 0.5, w1: tw * 0.36, trunk: true });
    // roots
    for (let k = 0; k < (o.roots || 0); k++) {
      const side = k % 2 ? 1 : -1;
      const len = tw * rng.range(0.6, 1.2);
      const pts = gnarl(rng, bx + side * tw * 0.2, by - tw * 0.35, bx + side * (tw * 0.45 + len), by + rng.range(2, 8), 2, 0.1);
      branches.push({ pts, w0: tw * 0.22, w1: 1.5 });
    }
    for (const g of groups) {
      if (!g.length) continue;
      let mx = 0, my = 0;
      for (const i of g) { mx += clumps[i].x; my += clumps[i].y; }
      mx /= g.length; my /= g.length;
      const tx = fx + (mx - fx) * 0.82, ty = fy + (my - fy) * 0.82;
      const sx = fx + rng.range(-tw * 0.18, tw * 0.18), sy = fy + rng.range(0, tw * 0.3);
      const limb = gnarl(rng, sx, sy, tx, ty, 4, 0.16);
      const lw0 = tw * rng.range(0.24, 0.32), lw1 = Math.max(2, tw * 0.06);
      branches.push({ pts: limb, w0: lw0, w1: lw1 });
      for (const i of g) {
        const c = clumps[i];
        const j = closestOn(limb, c.x, c.y);
        const t = j / (limb.length / 2);
        const px = limb[2 * j], py = limb[2 * j + 1];
        const ex = px + (c.x - px) * 0.8, ey = py + (c.y - py) * 0.8;
        const wb = Math.max(1.4, (lw0 + (lw1 - lw0) * t) * 0.5);
        if (Math.hypot(ex - px, ey - py) < 8) continue;
        branches.push({ pts: gnarl(rng, px, py, ex, ey, 2, 0.14), w0: wb, w1: Math.max(1, wb * 0.35) });
      }
    }
    // twigs that break the silhouette
    const twigs = [];
    for (const c of clumps) {
      if (c.rr < 0.78 || rng.next() > 0.55) continue;
      const a = Math.atan2(c.y - cy, c.x - cx) + rng.range(-0.5, 0.5);
      const L = c.r * rng.range(0.7, 1.4);
      const x0 = c.x + Math.cos(a) * c.r * 0.5, y0 = c.y + Math.sin(a) * c.r * 0.5;
      const pts = gnarl(rng, x0, y0, x0 + Math.cos(a) * L, y0 + Math.sin(a) * L, 2, 0.3);
      twigs.push(pts);
      if (rng.next() < 0.6) {
        const k = Math.floor(pts.length / 4) * 2;
        const a2 = a + rng.sign() * rng.range(0.4, 0.9);
        twigs.push(gnarl(rng, pts[k], pts[k + 1], pts[k] + Math.cos(a2) * L * 0.5, pts[k + 1] + Math.sin(a2) * L * 0.5, 2, 0.3));
      }
    }
    return { clumps, branches, twigs, o, cx, cy, rx, ry, fx, fy };
  };

  function sunDir(x, y) {
    const dx = SC.sun.x - x, dy = SC.sun.y - 60 - y, l = Math.hypot(dx, dy) || 1;
    return [dx / l, dy / l];
  }
  // how warm is the light reaching this silhouette: the horizon glow at this x
  function edgeWarmth(x) { return LW.clamp(SC.glow(x, SC.yh - 70) * 1.25, 0, 1); }

  function kmeans(cl, K, rng) {
    K = Math.min(K, cl.length);
    const cs = [];
    for (let k = 0; k < K; k++) { const c = cl[Math.floor((k + rng.next()) * cl.length / K)]; cs.push([c.x, c.y]); }
    const asg = new Int32Array(cl.length);
    for (let it = 0; it < 8; it++) {
      for (let i = 0; i < cl.length; i++) {
        let best = 0, bd = 1e18;
        for (let k = 0; k < K; k++) { const d = (cl[i].x - cs[k][0]) ** 2 + ((cl[i].y - cs[k][1]) * 1.3) ** 2; if (d < bd) { bd = d; best = k; } }
        asg[i] = best;
      }
      for (let k = 0; k < K; k++) { let sx = 0, sy = 0, n = 0; for (let i = 0; i < cl.length; i++) if (asg[i] === k) { sx += cl[i].x; sy += cl[i].y; n++; } if (n) cs[k] = [sx / n, sy / n]; }
    }
    const masses = [];
    for (let k = 0; k < K; k++) { const m = cl.filter((c, i) => asg[i] === k); if (m.length) masses.push({ clumps: m, cx: cs[k][0], cy: cs[k][1] }); }
    return masses;
  }

  function prepClumps(cl, rng, opts) {
    for (const c of cl) {
      if (c.pts) continue;
      const pts = LW.scallop(c.x, c.y, c.r, rng, { bumpSize: Math.max(4, c.r * (opts.bump || 0.24)), depth: 0.16, per: 6 });
      c.pts = LW.wobble(pts, 0.5, 0.08, c.x * 0.1, true);
    }
  }
  function makeCovered(cl) {
    return (x, y, except) => {
      for (const c of cl) { if (c === except) continue; const dx = c.x - x, dy = c.y - y; if (dx * dx + dy * dy < (c.r * 0.9) ** 2) return true; }
      return false;
    };
  }

  // draw one foliage mass: union outline, nested inner contours, leaf marks, rim on true silhouette edges
  function drawMass(ctx, m, rng, opts, covered) {
    const union = new Path2D();
    for (const c of m.clumps) LW.polyPath(union, c.pts, true);
    ctx.lineJoin = 'round';
    ctx.strokeStyle = P.ink; ctx.lineWidth = (opts.ink || 1.3) * 2.3; ctx.stroke(union);
    ctx.fillStyle = m.back ? opts.backCol : opts.fillCol;
    LW.offset(ctx, LW.REG.cool, () => ctx.fill(union));
    ctx.fill(union);
    const marks = new LW.FillBatch();
    const sorted = m.clumps.slice().sort((a, b) => a.y - b.y);
    // lit caps: each sub-clump gets a lighter crescent on top (cool sky light), stacked downward
    const baseCol = m.back ? opts.backCol : opts.fillCol, capCol = m.back ? (opts.backCap || '#19343f') : (opts.capCol || '#25525c');
    for (const c of sorted) {
      const cp = new Path2D(); LW.polyPath(cp, c.pts, true);
      ctx.save(); ctx.clip(cp);
      ctx.fillStyle = capCol; ctx.fill(cp);
      ctx.translate(c.r * 0.07, c.r * (m.back ? 0.22 : 0.3)); ctx.fillStyle = baseCol; ctx.fill(cp);
      ctx.restore();
    }
    const own = makeCovered(m.clumps);
    // inner contours: the lower edge of each sub-clump that lies inside the mass
    for (const c of sorted) {
      const n = c.pts.length >> 1;
      let run = [];
      const flushRun = () => { if (run.length >= 8) LW.ribbon(marks.p(m.back ? '#0d1923' : '#0c1720'), run, (t) => (opts.ink || 1.3) * 0.7 * LW.taper(t, 0.15, 0.15)); run = []; };
      for (let i = 0; i < n; i++) {
        const x = c.pts[2 * i], y = c.pts[2 * i + 1];
        if (y > c.y - c.r * 0.1 && own(x, y, c)) run.push(x, y); else flushRun();
      }
      flushRun();
    }
    // nested contours on the shadowed underside of each sub-clump (engraved form shading)
    for (const c of m.clumps) {
      const n = c.pts.length >> 1;
      const rings = c.r > 30 ? 3 : c.r > 16 ? 2 : 1;
      for (let k = 1; k <= rings; k++) {
        const sc = 1 - (k * 5.2 * (opts.markScale || 1)) / c.r;
        if (sc < 0.35) break;
        let run = [];
        const flushRun = () => { if (run.length >= 6) LW.ribbon(marks.p(m.back ? '#0b161e' : '#0d1a22'), run, (t) => (0.9 - k * 0.15) * (opts.markScale || 1) * LW.taper(t, 0.3, 0.3)); run = []; };
        const lim = c.r * (0.05 + k * 0.12);
        for (let i = 0; i < n; i++) {
          const px = c.x + (c.pts[2 * i] - c.x) * sc, py = c.y + (c.pts[2 * i + 1] - c.y) * sc;
          if (py - c.y > lim && (px - c.x) * (SC.sun.x - c.x) < c.r * c.r * 0.6) run.push(px, py); else flushRun();
        }
        flushRun();
      }
    }
    // leaf marks: little scalloped arcs, warmer where light bleeds through a sun-facing edge
    if (!m.back || true) {
      for (const c of m.clumps) {
        const nm = Math.round((c.r * c.r) / (opts.markDensity || 95));
        const sd = sunDir(c.x, c.y);
        const warm = edgeWarmth(c.x);
        for (let i = 0; i < nm; i++) {
          const a = rng.range(0, 6.283), d = Math.sqrt(rng.next()) * c.r * 0.86;
          const x = c.x + Math.cos(a) * d, y = c.y + Math.sin(a) * d;
          const probe = 9 * (opts.markScale || 1) + 4;
          const nearLit = !covered(x + sd[0] * probe, y + sd[1] * probe);
          const nearLit2 = !covered(x + sd[0] * probe * 2.2, y + sd[1] * probe * 2.2);
          const up = -Math.sin(a) * (d / c.r);
          let col;
          if (nearLit && warm > 0.25) col = warm > 0.6 ? P.amber : P.orange;
          else if (nearLit) col = P.sea;
          else if (nearLit2 && warm > 0.3) col = P.rust;
          else if (m.back) { if (up > 0.2 && rng.next() < 0.4) col = '#1d3946'; else continue; }
          else if (up > 0.2 && rng.next() < 0.8) col = up > 0.55 ? P.sea : P.teal;
          else if (up > -0.2 && rng.next() < 0.45) col = '#24495a';
          else continue;
          const ar = rng.range(3, 6.5) * (opts.markScale || 1);
          const a0 = Math.PI + rng.range(0.1, 0.5), a1 = 2 * Math.PI - rng.range(0.1, 0.5);
          const arc = [];
          for (let t = a0; t <= a1; t += 0.3) arc.push(x + Math.cos(t) * ar, y + Math.sin(t) * ar * 0.75);
          LW.ribbon(marks.p(col), arc, (t) => 0.7 * (opts.markScale || 1) * LW.taper(t, 0.25, 0.25) + 0.15);
        }
      }
    }
    marks.flush(ctx, ['#0c1720', '#0d1923', '#24495a', P.teal, P.sea, P.rust, P.orange, P.amber]);
    // rim light: only on silhouette edges (outward probe hits sky) that face the sun
    const rim = new LW.FillBatch();
    for (const c of m.clumps) {
      const n = c.pts.length >> 1;
      const sd = sunDir(c.x, c.y);
      const warm = edgeWarmth(c.x);
      let run = [], lits = [];
      const flushRun = () => {
        if (run.length >= 8) {
          const col = m.back ? (warm > 0.3 ? P.rust : '#1f4450') : warm > 0.62 ? P.straw : warm > 0.34 ? P.amber : warm > 0.18 ? P.orange : P.sea;
          const L = lits.slice();
          LW.ribbon(rim.p(col), run, (t, i) => (opts.rimW || 1.6) * LW.smooth(0.1, 0.7, L[i]) * (m.back ? 0.6 : 1) * LW.taper(t, 0.15, 0.15));
        }
        run = []; lits = [];
      };
      for (let i = 0; i < n; i++) {
        const x = c.pts[2 * i], y = c.pts[2 * i + 1];
        let nx = x - c.x, ny = y - c.y;
        const l = Math.hypot(nx, ny) || 1; nx /= l; ny /= l;
        const lit = nx * sd[0] + ny * sd[1];
        const probe = 7 + c.r * 0.12;
        if (lit > 0.12 && !(opts.topOnly && ny > -0.3) && !covered(x + nx * probe, y + ny * probe) && !own(x - nx * 1.5, y - ny * 1.5, c)) {
          run.push(x - nx * 2.3, y - ny * 2.3); lits.push(lit);
        } else flushRun();
      }
      flushRun();
    }
    rim.flush(ctx);
  }

  // ---------------------------------------------------------------- branches
  function drawBranches(ctx, tree, opts) {
    const fillP = new Path2D(), outline = new Path2D();
    const all = tree.branches;
    const hw = (b) => (t) => LW.lerp(b.w0, b.w1, Math.pow(t, 0.8)) * (b.trunk ? 1 + 0.9 * Math.pow(1 - t, 5) : 1);
    for (const b of all) {
      const f = hw(b);
      LW.ribbon(outline, b.pts, (t) => f(t) + 2.4);
      LW.ribbon(fillP, b.pts, (t) => f(t));
    }
    for (const tw of tree.twigs) {
      LW.ribbon(outline, tw, (t) => (1.6 * (1 - t) + 0.5) * LW.taper(t, 0.02, 0.4) + 0.6);
    }
    ctx.fillStyle = P.ink; ctx.fill(outline);
    ctx.fillStyle = opts.barkCol;
    LW.offset(ctx, LW.REG.cool, () => ctx.fill(fillP));
    ctx.fillStyle = opts.barkCol; ctx.fill(fillP);
    // grain lines along each branch, flowing round knots on the trunk
    const rng = new LW.RNG('grain' + opts.seed);
    const grain = new LW.FillBatch();
    for (const b of all) {
      const f = hw(b);
      const n = b.pts.length >> 1;
      const maxW = Math.max(b.w0, b.w1) * (b.trunk ? 1.9 : 1);
      const lines = Math.max(1, Math.round(maxW / (b.trunk ? 3.6 : 4.2)));
      // normals
      const nx = new Float64Array(n), ny = new Float64Array(n);
      for (let i = 0; i < n; i++) {
        const a = Math.max(0, i - 1), c = Math.min(n - 1, i + 1);
        let tx = b.pts[2 * c] - b.pts[2 * a], ty = b.pts[2 * c + 1] - b.pts[2 * a + 1];
        const l = Math.hypot(tx, ty) || 1; nx[i] = -ty / l; ny[i] = tx / l;
      }
      const knots = [];
      if (b.trunk) for (let k = 0; k < 3; k++) knots.push({ t: rng.range(0.25, 0.85), s: rng.range(-0.5, 0.5), r: rng.range(0.1, 0.18) });
      for (let L = 0; L < lines; L++) {
        const s0 = -0.85 + (1.7 * (L + 0.5)) / lines + rng.range(-0.05, 0.05);
        const pts = [];
        for (let i = 0; i < n; i++) {
          const t = i / (n - 1);
          let s = s0 + 0.06 * LW.N1(i * 0.05 + L, b.w0);
          for (const kn of knots) {
            const dt = (t - kn.t) / kn.r, ds = s - kn.s;
            const fall = Math.exp(-dt * dt * 2);
            if (fall > 0.01) s += Math.sign(ds || 1) * fall * 0.35 * Math.max(0, 0.5 - Math.abs(ds));
          }
          s = LW.clamp(s, -0.92, 0.92);
          const w = f(t);
          pts.push(b.pts[2 * i] + nx[i] * w * s, b.pts[2 * i + 1] + ny[i] * w * s);
        }
        LW.dashes(pts, rng, 25, 160, 2, 9, (sub) => {
          const k = (sub.length >> 2) * 2;
          const sd = sunDir(sub[k], sub[k + 1]);
          // which side of the branch faces the sun?
          const ii = closestOn(b.pts, sub[k], sub[k + 1]);
          const side = nx[ii] * sd[0] + ny[ii] * sd[1];
          const lit = side * s0;
          const g = SC.glow(sub[k] + 200 * sd[0], sub[k + 1] + 200 * sd[1]);
          let col = '#2a4f5a';
          if (lit > 0.45) col = g > 0.2 ? P.amber : P.sea;
          else if (lit > 0.2) col = g > 0.25 ? P.orange : P.teal;
          else if (lit < -0.3) col = '#1d3944';
          LW.ribbon(grain.p(col), sub, (t) => (b.trunk ? 0.95 : 0.7) * LW.taper(t, 0.2, 0.2) * (lit > 0.45 ? 1.4 : 1));
        });
      }
      for (const kn of knots) {
        const i = Math.round(kn.t * (n - 1));
        const w = f(kn.t);
        const kx = b.pts[2 * i] + nx[i] * w * kn.s, ky = b.pts[2 * i + 1] + ny[i] * w * kn.s;
        for (let ring = 1; ring <= 3; ring++) {
          const rr = ring * 2.4;
          const arc = [];
          for (let a = 0; a <= 6.4; a += 0.4) arc.push(kx + Math.cos(a) * rr * 0.7, ky + Math.sin(a) * rr * 1.5);
          LW.ribbon(grain.p(ring === 1 ? P.ink : '#2a4f5a'), arc, () => 0.6);
        }
      }
    }
    grain.flush(ctx, ['#1d3944', '#2a4f5a', P.teal, P.sea, P.orange, P.amber, P.ink]);
  }

  LW.drawTree = function (ctx, tree, opts) {
    opts = Object.assign({ fillCol: '#173340', backCol: '#10212c', barkCol: '#14242f', seed: 't' }, opts || {});
    const rng = new LW.RNG('clumps' + opts.seed);
    prepClumps(tree.clumps, rng, opts);
    const covered = makeCovered(tree.clumps);
    const masses = kmeans(tree.clumps, opts.masses || Math.max(3, Math.round(tree.clumps.length / 9)), rng);
    for (const m of masses) m.back = rng.next() < (opts.backFrac || 0.3);
    const back = masses.filter((m) => m.back).sort((a, b) => a.cy - b.cy);
    const front = masses.filter((m) => !m.back).sort((a, b) => a.cy - b.cy);
    for (const m of back) drawMass(ctx, m, rng, opts, covered);
    drawBranches(ctx, tree, opts);
    for (const m of front) drawMass(ctx, m, rng, opts, covered);
  };

  // hedgerow segment: a mound of small clumps standing on the ground
  LW.drawHedgeClump = function (ctx, x, gy, r, h, rng, opts) {
    opts = Object.assign({ fillCol: '#152c38', backCol: '#10212c' }, opts);
    const n = 3 + Math.floor(rng.next() * 3);
    const cl = [];
    for (let i = 0; i < n; i++) cl.push({ x: x + rng.range(-r * 0.75, r * 0.75), y: gy - h + r * rng.range(0.6, 1.4) + i * r * 0.12, r: r * rng.range(0.55, 0.95) });
    cl.push({ x, y: gy - r * 0.55, r: r * 0.9 });
    // stems below
    const st = new Path2D();
    for (let i = 0; i < 3 + r / 6; i++) {
      const sx = x + rng.range(-r, r);
      LW.ribbon(st, [sx, gy + 2, sx + rng.range(-r * 0.3, r * 0.3), gy - h * 0.5], (t) => Math.max(0.8, r * 0.05) * (1 - t * 0.6));
    }
    ctx.fillStyle = P.ink; ctx.fill(st);
    prepClumps(cl, rng, opts);
    const covered = makeCovered(cl);
    drawMass(ctx, { clumps: cl, back: false }, rng, opts, covered);
  };
})();
