/* The Family — 04. "I Do Renounce Him"
 *
 * The baptism of Connie's son as a great Gothic window. Michael stands godfather at the font in the central
 * light; in the side lights and the tracery, the hour's other business is told in small dark silhouettes.
 * Below, the church lies in shadow and the window's coloured light falls across the stone floor, where the
 * orange that has rolled through the other drawings comes to rest.
 *
 * Everything is drawn on a fixed 1080 x 1350 design frame. Glass is built piece by piece (pot-metal colour,
 * streaks, seeds, grisaille trace and matting, lead came), then the floor is lit per pixel by tracing each
 * floor point back along the sun's direction to the window it passed through.
 */
(function () {
  'use strict';

  const W = 1080, H = 1350;
  // camera: eye 1.6 m, horizon at y=860, focal 1750 design px; the window wall stands at z = 20 m
  const HZ = 860, F = 1750, EYE = 1.6, Z0 = 20, S = F / Z0, CX = 540;
  const FLOOR_Y = 1000; // where the floor meets the end wall
  const EXPORT = (() => { try { return new URLSearchParams(location.search).has('export'); } catch (e) { return false; } })();

  /* ------------------------------------------------------------------ small utilities */
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const rgb = (c, a) => (a === undefined ? `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})` : `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`);
  const mixc = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
  const mulc = (c, k) => [clamp(c[0] * k, 0, 255), clamp(c[1] * k, 0, 255), clamp(c[2] * k, 0, 255)];
  function hash2(a, b) { let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }

  /* ------------------------------------------------------------------ geometry helpers */
  // Parse an absolute SVG path (M L C Q Z only) and optionally transform it. Returns { p: Path2D, bb }.
  function shape(d, tf) {
    const tok = d.match(/[MLCQZ]|-?\d*\.?\d+(?:e[-+]?\d+)?/g);
    let out = '', i = 0;
    const bb = [1e9, 1e9, -1e9, -1e9];
    while (i < tok.length) {
      const t = tok[i];
      if (/[MLCQZ]/.test(t)) { out += t + ' '; i++; continue; }
      let x = +tok[i], y = +tok[i + 1]; i += 2;
      if (tf) { const q = tf(x, y); x = q[0]; y = q[1]; }
      out += x.toFixed(2) + ' ' + y.toFixed(2) + ' ';
      if (x < bb[0]) bb[0] = x; if (y < bb[1]) bb[1] = y; if (x > bb[2]) bb[2] = x; if (y > bb[3]) bb[3] = y;
    }
    return { p: new Path2D(out), bb, d: out };
  }
  function poly(pts) {
    const p = new Path2D();
    const bb = [1e9, 1e9, -1e9, -1e9];
    pts.forEach((q, i) => {
      if (i) p.lineTo(q[0], q[1]); else p.moveTo(q[0], q[1]);
      if (q[0] < bb[0]) bb[0] = q[0]; if (q[1] < bb[1]) bb[1] = q[1]; if (q[0] > bb[2]) bb[2] = q[0]; if (q[1] > bb[3]) bb[3] = q[1];
    });
    p.closePath();
    return { p, bb, pts };
  }
  function circ(cx, cy, r) { const p = new Path2D(); p.arc(cx, cy, r, 0, Math.PI * 2); return { p, bb: [cx - r, cy - r, cx + r, cy + r] }; }
  function ring(cx, cy, r0, r1, a0, a1) {
    const p = new Path2D(); p.arc(cx, cy, r1, a0, a1); p.arc(cx, cy, r0, a1, a0, true); p.closePath();
    return { p, bb: [cx - r1, cy - r1, cx + r1, cy + r1] };
  }
  // transform helper: local medallion coords -> design coords
  const TF = (ox, oy, s, rot) => {
    const c = Math.cos(rot || 0), sn = Math.sin(rot || 0); s = s || 1;
    return (x, y) => [ox + (x * c - y * sn) * s, oy + (x * sn + y * c) * s];
  };

  function arcPts(cx, cy, r, a0, a1, step) {
    const n = Math.max(2, Math.ceil(Math.abs(a1 - a0) * r / (step || 1.5)));
    const out = [];
    for (let k = 0; k <= n; k++) { const a = a0 + (a1 - a0) * k / n; out.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); }
    return out;
  }
  const norm2pi = (a) => { while (a < 0) a += Math.PI * 2; while (a >= Math.PI * 2) a -= Math.PI * 2; return a; };
  function arc3(P1, P2, P3, step) {
    const ax = P1[0], ay = P1[1], bx = P2[0], by = P2[1], cx = P3[0], cy = P3[1];
    const d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));
    if (Math.abs(d) < 1e-9) return [P1, P3];
    const a2 = ax * ax + ay * ay, b2 = bx * bx + by * by, c2 = cx * cx + cy * cy;
    const ux = (a2 * (by - cy) + b2 * (cy - ay) + c2 * (ay - by)) / d;
    const uy = (a2 * (cx - bx) + b2 * (ax - cx) + c2 * (bx - ax)) / d;
    const r = Math.hypot(ax - ux, ay - uy);
    const t1 = Math.atan2(ay - uy, ax - ux), t2 = Math.atan2(by - uy, bx - ux), t3 = Math.atan2(cy - uy, cx - ux);
    const d2 = norm2pi(t2 - t1), d3 = norm2pi(t3 - t1);
    const sweep = d2 < d3 ? d3 : d3 - Math.PI * 2;
    return arcPts(ux, uy, r, t1, t1 + sweep, step);
  }
  // pointed arch head: list of {p, c} from left springing to right springing
  function archHead(x0, x1, ys, ya) {
    const s = x1 - x0, h = ys - ya, rho = (h * h + s * s / 4) / s, xm = (x0 + x1) / 2;
    const c1 = [x0 + rho, ys], c2 = [x1 - rho, ys];
    const out = [];
    const aL0 = Math.PI, aL1 = Math.atan2(ya - ys, xm - c1[0]) + Math.PI * 2;
    const nL = Math.ceil((aL1 - aL0) * rho / 1.5);
    for (let k = 0; k <= nL; k++) { const a = aL0 + (aL1 - aL0) * k / nL; out.push({ p: [c1[0] + Math.cos(a) * rho, c1[1] + Math.sin(a) * rho], c: c1 }); }
    const aR0 = Math.atan2(ya - ys, xm - c2[0]), aR1 = 0;
    const nR = Math.ceil((aR1 - aR0) * rho / 1.5);
    for (let k = 1; k <= nR; k++) { const a = aR0 + (aR1 - aR0) * k / nR; out.push({ p: [c2[0] + Math.cos(a) * rho, c2[1] + Math.sin(a) * rho], c: c2 }); }
    return { pts: out, rho, c1, c2 };
  }
  function pointedArch(x0, x1, ys, ya, sill) {
    const hd = archHead(x0, x1, ys, ya);
    return [[x0, sill]].concat(hd.pts.map((q) => q.p), [[x1, sill]]);
  }
  // a lancet with a trefoil-cusped head
  function lightOpening(x0, x1, ys, ya, sill, cd) {
    const hd = archHead(x0, x1, ys, ya);
    const P = hd.pts;
    const L = [0];
    for (let i = 1; i < P.length; i++) L.push(L[i - 1] + Math.hypot(P[i].p[0] - P[i - 1].p[0], P[i].p[1] - P[i - 1].p[1]));
    const tot = L[L.length - 1];
    const at = (u) => {
      const s = u * tot; let i = 1; while (i < L.length - 1 && L[i] < s) i++;
      const q = P[i], dx = q.c[0] - q.p[0], dy = q.c[1] - q.p[1], m = Math.hypot(dx, dy);
      return { p: q.p, n: [dx / m, dy / m] };
    };
    const inset = (u, d) => { const q = at(u); return [q.p[0] + q.n[0] * d, q.p[1] + q.n[1] * d]; };
    const A = [x0, ys], B = [x1, ys];
    const k1 = inset(0.355, cd), k2 = inset(0.645, cd);
    const top = [(x0 + x1) / 2, ya + 2.2];
    const l1 = arc3(A, inset(0.19, 1.6), k1), l2 = arc3(k1, top, k2), l3 = arc3(k2, inset(0.81, 1.6), B);
    const pts = [[x0, sill], [x0, ys]].concat(l1, l2, l3, [[x1, ys], [x1, sill]]);
    const o = poly(pts); o.x0 = x0; o.x1 = x1; o.ys = ys; o.ya = ya; o.sill = sill; o.k1 = k1; o.k2 = k2;
    return o;
  }
  function circleX(c1, r1, c2, r2) {
    const dx = c2[0] - c1[0], dy = c2[1] - c1[1], d = Math.hypot(dx, dy);
    const a = (r1 * r1 - r2 * r2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, r1 * r1 - a * a));
    const mx = c1[0] + dx * a / d, my = c1[1] + dy * a / d;
    return [[mx + -dy * h / d, my + dx * h / d], [mx - -dy * h / d, my - dx * h / d]];
  }
  function foilOpening(cx, cy, R, n, rot, lk) {
    const rl = R * lk, d = R - rl, cs = [];
    for (let k = 0; k < n; k++) { const f = rot + Math.PI * 2 * k / n; cs.push([cx + Math.cos(f) * d, cy + Math.sin(f) * d, f]); }
    const cusps = [];
    for (let k = 0; k < n; k++) {
      const a = cs[k], b = cs[(k + 1) % n];
      const X = circleX(a, rl, b, rl);
      const d0 = Math.hypot(X[0][0] - cx, X[0][1] - cy), d1 = Math.hypot(X[1][0] - cx, X[1][1] - cy);
      cusps.push(d0 > d1 ? X[0] : X[1]);
    }
    let pts = [];
    for (let k = 0; k < n; k++) {
      const c = cs[k], p0 = cusps[(k + n - 1) % n], p1 = cusps[k];
      const a0 = Math.atan2(p0[1] - c[1], p0[0] - c[0]);
      const a1 = a0 + norm2pi(Math.atan2(p1[1] - c[1], p1[0] - c[0]) - a0);
      pts = pts.concat(arcPts(c[0], c[1], rl, a0, a1, 1.2));
    }
    const o = poly(pts); o.cx = cx; o.cy = cy; o.R = R; o.cusps = cusps; o.lobes = cs; o.rl = rl;
    return o;
  }

  // Voronoi by half-plane clipping
  function clipHalf(poly0, mx, my, nx, ny) {
    const out = [], n = poly0.length;
    for (let k = 0; k < n; k++) {
      const a = poly0[k], b = poly0[(k + 1) % n];
      const da = (a[0] - mx) * nx + (a[1] - my) * ny, db = (b[0] - mx) * nx + (b[1] - my) * ny;
      if (da <= 0) out.push(a);
      if ((da <= 0) !== (db <= 0)) { const t = da / (da - db); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); }
    }
    return out;
  }
  function voronoi(points, bb, reach) {
    const r2 = reach * reach;
    return points.map((p, i) => {
      let pl = [[bb[0], bb[1]], [bb[2], bb[1]], [bb[2], bb[3]], [bb[0], bb[3]]];
      for (let j = 0; j < points.length; j++) {
        if (j === i) continue;
        const q = points[j], dx = q[0] - p[0], dy = q[1] - p[1];
        if (dx * dx + dy * dy > r2) continue;
        pl = clipHalf(pl, (p[0] + q[0]) / 2, (p[1] + q[1]) / 2, dx, dy);
        if (pl.length < 3) break;
      }
      return pl;
    });
  }
  function jitterGrid(bb, sp, R, jit) {
    const pts = [];
    for (let y = bb[1] + sp * 0.5; y < bb[3]; y += sp * 0.88) {
      const row = Math.round((y - bb[1]) / sp);
      for (let x = bb[0] + sp * (row % 2 ? 0.5 : 0.0); x < bb[2] + sp; x += sp) {
        pts.push([x + (R() - 0.5) * sp * jit, y + (R() - 0.5) * sp * jit]);
      }
    }
    return pts;
  }
  const centroid = (pts) => { let x = 0, y = 0; pts.forEach((q) => { x += q[0]; y += q[1]; }); return [x / pts.length, y / pts.length]; };

  /* ------------------------------------------------------------------ palette (pot-metal glass) */
  const G = {
    blue: [28, 58, 150], blueD: [22, 40, 116], blueL: [70, 110, 190], blueV: [52, 48, 150], blueT: [26, 82, 150],
    ruby: [150, 16, 36], rubyD: [112, 12, 30],
    gold: [228, 164, 44], goldP: [240, 206, 120],
    white: [224, 230, 214], whiteW: [238, 230, 202], whiteB: [204, 220, 228],
    green: [30, 122, 76], greenP: [128, 178, 120],
    flesh: [234, 198, 166], murrey: [116, 38, 74], violet: [64, 46, 104],
    suit: [44, 40, 86], cassock: [40, 30, 52], stone: [150, 138, 150], stoneL: [186, 178, 184],
    aqua: [168, 204, 214], amber: [214, 140, 44],
  };
  const LEAD = '#0c0a09', TRACE = 'rgba(28,17,10,0.93)', LW = 3.0;

  /* ------------------------------------------------------------------ the window plan */
  const OUTER = { x0: 110, x1: 970, ys: 600, ya: 40, sill: 905 };
  function buildPlan() {
    const ops = {};
    ops.C = lightOpening(356, 724, 410, 190, 905, 15);
    ops.L = lightOpening(122, 330, 600, 473, 905, 12);
    ops.R = lightOpening(750, 958, 600, 473, 905, 12);
    ops.SL = foilOpening(262, 372, 74, 6, -Math.PI / 2, 0.37);
    ops.SR = foilOpening(818, 372, 74, 6, -Math.PI / 2, 0.37);
    ops.T = foilOpening(540, 119, 56, 4, -Math.PI / 2, 0.47);
    ops.TL = foilOpening(340, 228, 48, 3, Math.PI / 2, 0.5);
    ops.TR = foilOpening(740, 228, 48, 3, Math.PI / 2, 0.5);
    ops.EL = foilOpening(432, 152, 25, 4, Math.PI / 4, 0.47);
    ops.ER = foilOpening(648, 152, 25, 4, Math.PI / 4, 0.47);
    const outer = poly(pointedArch(OUTER.x0, OUTER.x1, OUTER.ys, OUTER.ya, OUTER.sill));
    return { ops, outer };
  }

  /* ------------------------------------------------------------------ glass & paint */
  function makeGlass(ctx, R, scale, br) {
    let nOps = 0;
    const step = async (k) => { nOps += k || 1; if (nOps >= 24) { nOps = 0; await br(); } };
    // a tile of badgered paint film: soft directional brush marks, very faint
    let FILM = null;
    try {
      const n = Math.max(64, Math.round(110 * scale)), tc = document.createElement('canvas'); tc.width = tc.height = n;
      const tx = tc.getContext('2d');
      for (let i = 0; i < 260; i++) {
        const x = R() * n, y = R() * n, l = (4 + R() * 16) * scale, a = Math.PI / 2 + (R() - 0.5) * 0.5;
        tx.strokeStyle = `rgba(40,24,12,${0.03 + R() * 0.07})`; tx.lineWidth = (0.6 + R() * 2.2) * scale; tx.lineCap = 'round';
        for (const ox of [-n, 0, n]) for (const oy of [-n, 0, n]) { tx.beginPath(); tx.moveTo(x + ox, y + oy); tx.lineTo(x + ox + Math.cos(a) * l, y + oy + Math.sin(a) * l); tx.stroke(); }
      }
      FILM = ctx.createPattern(tc, 'repeat');
      FILM.setTransform(new DOMMatrix([1 / scale, 0, 0, 1 / scale, 0, 0]));
    } catch (e) { FILM = null; }
    function jit(c, v) {
      v = v === undefined ? 1 : v;
      const k = 1 + (R() - 0.5) * 0.26 * v, h = (R() - 0.5) * 0.14 * v;
      return [clamp(c[0] * k * (1 + h), 0, 255), clamp(c[1] * k, 0, 255), clamp(c[2] * k * (1 - h), 0, 255)];
    }
    function lead(sh, lw) {
      ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      ctx.strokeStyle = LEAD; ctx.lineWidth = lw || LW; ctx.stroke(sh.p);
    }
    // one piece of glass: colour, thickness, streaks, seeds, then paint, then its lead
    function glass(sh, base, o) {
      o = o || {};
      const [x0, y0, x1, y1] = sh.bb, w = x1 - x0, h = y1 - y0;
      let c = o.exact ? base : jit(base, o.v);
      if (!o.exact) {
        const my = (y0 + y1) / 2, mx = (x0 + x1) / 2;
        const lum = 1.04 + 0.05 * clamp(1 - my / 700, 0, 1) - 0.1 * clamp((my - 760) / 160, 0, 1) - 0.05 * Math.abs(mx - 540) / 430 - (R() < 0.07 ? 0.16 : 0);
        c = mulc(c, lum);
      }
      ctx.save();
      ctx.clip(sh.p, o.rule || 'nonzero');
      ctx.fillStyle = rgb(c); ctx.fillRect(x0 - 1, y0 - 1, w + 2, h + 2);
      const ang = R() * Math.PI * 2, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, L = Math.max(w, h) * 0.62 + 2;
      const g = ctx.createLinearGradient(cx - Math.cos(ang) * L, cy - Math.sin(ang) * L, cx + Math.cos(ang) * L, cy + Math.sin(ang) * L);
      g.addColorStop(0, rgb(mulc(c, 1.25), 0.55)); g.addColorStop(0.5, rgb(c, 0)); g.addColorStop(1, rgb(mulc(c, 0.7), 0.55));
      ctx.fillStyle = g; ctx.fillRect(x0 - 1, y0 - 1, w + 2, h + 2);
      // a warmer, brighter place where the glass is thinner
      const hx = x0 + w * (0.2 + R() * 0.6), hy = y0 + h * (0.2 + R() * 0.6);
      const hg = ctx.createRadialGradient(hx, hy, 0, hx, hy, Math.max(w, h) * (0.4 + R() * 0.4));
      hg.addColorStop(0, rgb(mulc(c, 1.35), 0.32)); hg.addColorStop(1, rgb(mulc(c, 1.35), 0));
      ctx.fillStyle = hg; ctx.fillRect(x0 - 1, y0 - 1, w + 2, h + 2);
      if (!o.noStreak) {
        // cords and streaks in the pot-metal: a few broad soft bands, a few fine lines, all running one way
        const n = 3 + ((R() * 4) | 0), sa = R() * Math.PI;
        const ux = Math.cos(sa), uy = Math.sin(sa), vx = -uy, vy = ux;
        for (let k = 0; k < n; k++) {
          const off = (R() - 0.5) * L * 1.7, b1 = (R() - 0.5) * L * 0.35, b2 = (R() - 0.5) * L * 0.35;
          const px = cx + vx * off, py = cy + vy * off;
          ctx.beginPath();
          ctx.moveTo(px - ux * L * 1.2, py - uy * L * 1.2);
          ctx.bezierCurveTo(px - ux * L * 0.4 + vx * b1, py - uy * L * 0.4 + vy * b1, px + ux * L * 0.4 + vx * b2, py + uy * L * 0.4 + vy * b2, px + ux * L * 1.2, py + uy * L * 1.2);
          const broad = R() < 0.45;
          ctx.strokeStyle = rgb(mulc(c, R() < 0.5 ? 1.34 : 0.72), broad ? 0.07 + R() * 0.06 : 0.14 + R() * 0.14);
          ctx.lineWidth = broad ? 2.5 + R() * 5 : 0.35 + R() * 1.1; ctx.stroke();
        }
      }
      if (!o.noSeed && R() < 0.5) {
        const k = 1 + ((R() * 2.4) | 0);
        for (let i = 0; i < k; i++) {
          const sx = x0 + R() * w, sy = y0 + R() * h, sr = 0.35 + R() * 0.9;
          ctx.beginPath(); ctx.ellipse(sx, sy, sr * 1.5, sr, R() * 3, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(255,252,236,0.42)'; ctx.fill();
          ctx.lineWidth = 0.3; ctx.strokeStyle = rgb(mulc(c, 0.55), 0.5); ctx.stroke();
        }
      }
      if (o.edge !== false) { // a little painted smear near the edges, as on old glass
        const rg = ctx.createRadialGradient(cx, cy, Math.min(w, h) * 0.2, cx, cy, Math.max(w, h) * 0.75);
        rg.addColorStop(0, 'rgba(40,24,12,0)'); rg.addColorStop(1, `rgba(40,24,12,${(o.edgeA || 0.16) * 0.5})`);
        ctx.fillStyle = rg; ctx.fillRect(x0 - 1, y0 - 1, w + 2, h + 2);
      }
      if (FILM) { ctx.globalAlpha = o.paint ? 0.42 : 0.3; ctx.fillStyle = FILM; ctx.fillRect(x0 - 1, y0 - 1, w + 2, h + 2); ctx.globalAlpha = 1; }
      if (o.paint) o.paint(c, sh);
      if (o.cuts) { ctx.strokeStyle = LEAD; ctx.lineWidth = (o.lw || LW) * 0.9; ctx.lineCap = 'round'; o.cuts.forEach((cp) => ctx.stroke(cp)); }
      ctx.restore();
      if (!o.noLead) lead(sh, o.lw);
      return c;
    }
    // paint helpers (design px)
    const P = {
      tr(d, w, a) { const s = typeof d === 'string' ? new Path2D(d) : d; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = a === undefined ? TRACE : `rgba(28,17,10,${a})`; ctx.lineWidth = w; ctx.stroke(s); },
      fill(d, a) { const s = typeof d === 'string' ? new Path2D(d) : d; ctx.fillStyle = a === undefined ? TRACE : `rgba(28,17,10,${a})`; ctx.fill(s); },
      mat(d, w, a) { // badgered matting along a line: soft-edged
        const s = typeof d === 'string' ? new Path2D(d) : d; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        for (let k = 0; k < 4; k++) { ctx.strokeStyle = `rgba(46,28,14,${a / 4})`; ctx.lineWidth = w * (1 - k * 0.22); ctx.stroke(s); }
      },
      hl(d, w, a) { const s = typeof d === 'string' ? new Path2D(d) : d; ctx.lineCap = 'round'; ctx.strokeStyle = `rgba(255,248,228,${a || 0.35})`; ctx.lineWidth = w; ctx.stroke(s); },
      shade(sh, x0, y0, x1, y1, a0, a1) { const g = ctx.createLinearGradient(x0, y0, x1, y1); g.addColorStop(0, `rgba(46,28,14,${a0})`); g.addColorStop(1, `rgba(46,28,14,${a1})`); ctx.fillStyle = g; ctx.fillRect(sh.bb[0] - 2, sh.bb[1] - 2, sh.bb[2] - sh.bb[0] + 4, sh.bb[3] - sh.bb[1] + 4); },
      rshade(sh, cx, cy, r0, r1, a0, a1) { const g = ctx.createRadialGradient(cx, cy, r0, cx, cy, r1); g.addColorStop(0, `rgba(46,28,14,${a0})`); g.addColorStop(1, `rgba(46,28,14,${a1})`); ctx.fillStyle = g; ctx.fillRect(sh.bb[0] - 2, sh.bb[1] - 2, sh.bb[2] - sh.bb[0] + 4, sh.bb[3] - sh.bb[1] + 4); },
      dot(x, y, r, a) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = a === undefined ? TRACE : `rgba(28,17,10,${a})`; ctx.fill(); },
      clear(x, y, r, a) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = `rgba(255,250,232,${a || 0.5})`; ctx.fill(); },
    };
    // background field of irregular pieces inside an opening
    function field(op, bb, sp, colourOf, R2, o) {
      o = o || {};
      const pts = jitterGrid(bb, sp, R2 || R, 0.7);
      const cells = voronoi(pts, [bb[0] - sp, bb[1] - sp, bb[2] + sp, bb[3] + sp], sp * 3.2);
      cells.forEach((cl) => {
        if (cl.length < 3) return;
        const ct = centroid(cl);
        const col = colourOf(ct[0], ct[1]);
        if (!col) return;
        const sh = poly(cl);
        glass(sh, col, { v: o.v === undefined ? 1.1 : o.v, edgeA: 0.22, lw: o.lw || 2.7, paint: o.paint ? (c) => o.paint(sh, ct, c) : null });
      });
    }
    // a band of glass running along the inside of an opening outline, cut into segments
    function band(op, bw, segLen, cols, o) {
      o = o || {};
      const pts = op.pts.slice(); pts.push(pts[0]);
      const L = [0];
      for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
      const tot = L[L.length - 1];
      const nseg = Math.max(3, Math.round(tot / segLen));
      const pAt = (s) => { let i = 1; while (i < L.length - 1 && L[i] < s) i++; const t = (s - L[i - 1]) / Math.max(1e-6, L[i] - L[i - 1]); return [lerp(pts[i - 1][0], pts[i][0], t), lerp(pts[i - 1][1], pts[i][1], t), i]; };
      ctx.save(); ctx.clip(op.p);
      // dark ground of the band (gives the inner lead line)
      ctx.lineJoin = 'round'; ctx.lineWidth = bw * 2 + LW; ctx.strokeStyle = LEAD; ctx.stroke(op.p);
      const cutPts = [];
      for (let k = 0; k < nseg; k++) {
        const s0 = tot * k / nseg, s1 = tot * (k + 1) / nseg;
        const a = pAt(s0), b = pAt(s1);
        const seg = [[a[0], a[1]]];
        for (let i = a[2]; i < b[2]; i++) seg.push(pts[i]);
        seg.push([b[0], b[1]]);
        const p = new Path2D(); seg.forEach((q, i) => (i ? p.lineTo(q[0], q[1]) : p.moveTo(q[0], q[1])));
        const col = jit(cols[k % cols.length], 0.8);
        ctx.lineCap = 'butt'; ctx.lineJoin = 'round'; ctx.lineWidth = bw * 2 - LW * 0.9; ctx.strokeStyle = rgb(col); ctx.stroke(p);
        ctx.lineWidth = (bw * 2 - LW) * 0.35; ctx.strokeStyle = rgb(mulc(col, 1.25), 0.35); ctx.stroke(p);
        if (o.paint) o.paint(seg, k, col);
        cutPts.push(a);
      }
      // cuts across the band
      ctx.strokeStyle = LEAD; ctx.lineWidth = LW * 0.85; ctx.lineCap = 'butt';
      cutPts.forEach((a) => {
        const i = a[2], q0 = pts[Math.max(0, i - 1)], q1 = pts[Math.min(pts.length - 1, i)];
        let nx = -(q1[1] - q0[1]), ny = q1[0] - q0[0]; const m = Math.hypot(nx, ny) || 1; nx /= m; ny /= m;
        ctx.beginPath(); ctx.moveTo(a[0] - nx * (bw + 2), a[1] - ny * (bw + 2)); ctx.lineTo(a[0] + nx * (bw + 2), a[1] + ny * (bw + 2)); ctx.stroke();
      });
      ctx.restore();
      lead(op, LW * 1.25);
    }
    // a scratched diaper: a matt wash over the glass with a small pattern taken out of it
    function diaper(kind, c, sh) {
      const [x0, y0, x1, y1] = sh.bb;
      ctx.fillStyle = 'rgba(34,20,12,0.3)'; ctx.fillRect(x0 - 1, y0 - 1, x1 - x0 + 2, y1 - y0 + 2);
      const lc = rgb(mulc(c, 1.5), 0.72);
      ctx.strokeStyle = lc; ctx.fillStyle = lc; ctx.lineWidth = 0.8;
      if (kind === 'rose') {
        const p = 17;
        for (let gy = Math.floor(y0 / p) * p; gy < y1 + p; gy += p) {
          const odd = Math.round(gy / p) & 1;
          for (let gx = Math.floor(x0 / p) * p + (odd ? p / 2 : 0); gx < x1 + p; gx += p) {
            ctx.beginPath();
            for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2, ex = gx + Math.cos(a) * 2.3, ey = gy + Math.sin(a) * 2.3; ctx.moveTo(ex + 2.1, ey); ctx.arc(ex, ey, 2.1, 0, Math.PI * 2); }
            ctx.stroke();
            ctx.beginPath(); ctx.arc(gx + p / 2, gy, 0.8, 0, Math.PI * 2); ctx.fill();
          }
        }
      } else if (kind === 'scale') {
        const p = 12;
        for (let gy = Math.floor(y0 / p) * p; gy < y1 + p; gy += p * 0.6) {
          const odd = Math.round(gy / (p * 0.6)) & 1;
          ctx.beginPath();
          for (let gx = Math.floor(x0 / p) * p + (odd ? p / 2 : 0); gx < x1 + p; gx += p) { ctx.moveTo(gx + p / 2, gy); ctx.arc(gx, gy, p / 2, 0, Math.PI); }
          ctx.stroke();
        }
      } else if (kind === 'dots') {
        const p = 10;
        for (let gy = Math.floor(y0 / p) * p; gy < y1 + p; gy += p) for (let gx = Math.floor(x0 / p) * p + ((Math.round(gy / p) & 1) ? p / 2 : 0); gx < x1 + p; gx += p) { ctx.beginPath(); ctx.arc(gx, gy, 1.2, 0, Math.PI * 2); ctx.fill(); }
      }
    }
    // plain quarries: a rough grid as a glazier cuts it, some pairs left whole
    async function quarries(bb, cw, chh, colourOf, o) {
      o = o || {};
      const nx = Math.ceil((bb[2] - bb[0]) / cw) + 1, ny = Math.ceil((bb[3] - bb[1]) / chh) + 1;
      const V = [];
      for (let j = 0; j <= ny; j++) {
        V.push([]);
        for (let i = 0; i <= nx; i++) V[j].push([bb[0] + i * cw + (R() - 0.5) * cw * 0.36, bb[1] + j * chh + (R() - 0.5) * chh * 0.32]);
      }
      for (let j = 0; j < ny; j++) {
        let i = 0;
        while (i < nx) {
          const span = (R() < 0.3 && i + 2 <= nx) ? 2 : 1;
          const pts = [];
          for (let k = 0; k <= span; k++) pts.push(V[j][i + k]);
          for (let k = span; k >= 0; k--) pts.push(V[j + 1][i + k]);
          i += span;
          const ct = centroid(pts);
          const col = colourOf(ct[0], ct[1]);
          if (!col) continue;
          const sh = poly(pts);
          glass(sh, col, { v: o.v === undefined ? 1.15 : o.v, edgeA: 0.24, lw: o.lw || 2.8, paint: o.paint ? (c) => o.paint(c, sh, ct) : null });
          await step(2);
        }
      }
    }
    // the mosaic ground of a medallion window: blue lozenges with small ruby squares at the crossings
    async function trellis(bb, d, cols, node) {
      const h = d / 2;
      for (let j = 0, y = bb[1]; y < bb[3] + d; j++, y += h) {
        for (let x = bb[0] + (j % 2) * h; x < bb[2] + d; x += d) {
          const sh = poly([[x, y - h], [x + h, y], [x, y + h], [x - h, y]]);
          glass(sh, cols[(hash2(x | 0, y | 0) * cols.length) | 0], {
            v: 1.1, edgeA: 0.24, lw: 2.5,
            paint: (c) => { nOps++; ctx.strokeStyle = rgb(mulc(c, 0.35), 0.75); ctx.lineWidth = 0.8; ctx.beginPath(); ctx.arc(x, y, h * 0.32, 0, Math.PI * 2); ctx.stroke(); ctx.fillStyle = rgb(mulc(c, 0.35), 0.8); for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.arc(x + Math.cos(k * Math.PI / 2) * h * 0.55, y + Math.sin(k * Math.PI / 2) * h * 0.55, 0.9, 0, Math.PI * 2); ctx.fill(); } },
          });
          await step();
        }
      }
      const q = h * 0.36;
      for (let j = 0, y = bb[1]; y < bb[3] + d; j++, y += h) {
        for (let x = bb[0] + ((j + 1) % 2) * h; x < bb[2] + d; x += d) {
          glass(poly([[x, y - q], [x + q, y], [x, y + q], [x - q, y]]), node, { v: 0.9, noStreak: true, noSeed: true, edge: false, lw: 2.2 });
          await step();
        }
      }
    }
    // a roundel ground cut like a wheel
    function wheel(cx, cy, R0, n, col, o) {
      o = o || {};
      const rin = R0 * 0.46;
      for (let k = 0; k < n; k++) {
        const a0 = k * Math.PI * 2 / n + (o.rot || 0), a1 = a0 + Math.PI * 2 / n;
        const sh = ring(cx, cy, rin, R0 * 1.6, a0, a1);
        glass(sh, col, { v: 1.1, edgeA: 0.2, paint: o.diaper ? (c) => diaper(o.diaper, c, sh) : null });
      }
      const sh = circ(cx, cy, rin);
      glass(sh, col, { v: 1.0, paint: o.diaper ? (c) => diaper(o.diaper, c, sh) : null });
    }
    return { jit, lead, glass, P, field, band, diaper, quarries, trellis, wheel, step, br };
  }

  /* ------------------------------------------------------------------ figure silhouettes (local coords) */
  // a standing man in a coat and hat, about 54 high, feet at y=0, facing right; used for shadows
  const MAN = 'M -3 -50 C 1 -51.5, 5 -50.5, 6 -47 L 8 -47 L 8 -45 L 5 -44.5 C 5 -42, 4 -40, 2 -39 C 6 -38, 9 -36, 10 -32 L 13 -22 L 20 -24 L 21 -21 L 12 -16 L 11 -12 L 12 -2 L 10 0 L 6 0 L 4 -12 L 1 -12 L 0 -1 L 1 0 L -6 0 L -4 -12 L -6 -14 L -7 -30 C -7 -36, -4 -38, -2 -39 C -4 -41, -5 -43, -5 -45 L -7 -45 L -7 -47 L -4 -47 Z';

  /* ------------------------------------------------------------------ the central light: the baptism */
  async function drawCentral(K, ctx, op, R) {
    const { glass, P, band, quarries, diaper } = K;
    ctx.save(); ctx.clip(op.p);
    // ground: ruby above the canopy, blue in the scene; plain quarries with a scratched diaper
    await quarries([356, 182, 724, 905], 41, 47, (x, y) => (y < 404 ? G.ruby : G.blue), {
      paint: (c, sh, ct) => diaper(ct[1] < 404 ? 'scale' : 'rose', c, sh),
    });

    // glory and dove
    const DY = 250;
    for (let k = 0; k < 16; k++) {
      const a = k * Math.PI * 2 / 16 + 0.2;
      const ax = Math.cos(a), ay = Math.sin(a), bx = -ay, by = ax;
      const r0 = 24, r1 = k % 2 ? 56 : 76, w0 = 3.4, cx = 540, cy = DY + 18;
      const d = `M ${cx + ax * r0 + bx * w0} ${cy + ay * r0 + by * w0} L ${cx + ax * r1} ${cy + ay * r1} L ${cx + ax * r0 - bx * w0} ${cy + ay * r0 - by * w0} Z`;
      glass(shape(d), k % 2 ? G.goldP : G.gold, { lw: 2.4, noSeed: true, paint: () => P.tr(`M ${cx + ax * (r0 + 4)} ${cy + ay * (r0 + 4)} L ${cx + ax * (r1 - 6)} ${cy + ay * (r1 - 6)}`, 0.5, 0.45) });
    }
    const D = (d) => shape(d, (x, y) => [x, y - 262 + DY - 8]);
    glass(circ(540, DY + 36, 16), G.gold, {
      paint: () => { ctx.save(); ctx.fillStyle = 'rgba(150,18,34,0.9)'; ctx.fillRect(536.5, DY + 20, 7, 32); ctx.fillRect(524, DY + 32.5, 32, 7); ctx.restore(); },
    });
    const wings = ['M 536 284 C 524 276, 510 262, 500 244 C 498 240, 503 240, 506 242 C 516 252, 526 262, 538 268 Z', 'M 544 284 C 556 276, 570 262, 580 244 C 582 240, 577 240, 574 242 C 564 252, 554 262, 542 268 Z'];
    wings.forEach((d, i) => glass(D(d), G.white, {
      paint: () => {
        const s = i ? -1 : 1, oy = DY - 270;
        for (let k = 0; k < 5; k++) { const x = 540 - s * (8 + k * 6.5), y = 276 - k * 6.2 + oy; P.tr(`M ${x} ${y} L ${x - s * 7} ${y - 9}`, 0.9); }
        P.mat(shape(i ? 'M 546 280 C 556 272, 566 262, 576 246' : 'M 534 280 C 524 272, 514 262, 504 246', (x, y) => [x, y + oy]).p, 5, 0.4);
      },
    }));
    glass(D('M 535 268 L 531 250 L 540 254 L 549 250 L 545 268 Z'), G.white, { paint: () => { P.tr(D('M 536 266 L 534 254 M 540 266 L 540 255 M 544 266 L 546 254').p, 0.7); } });
    glass(D('M 540 262 C 547 266, 549 280, 547 296 C 546 304, 544 310, 540 316 C 536 310, 534 304, 533 296 C 531 280, 533 266, 540 262 Z'), G.white, {
      paint: (c, sh) => { P.shade(sh, 534, 0, 548, 0, 0.0, 0.42); P.dot(538, DY + 36, 1.1); P.tr(D('M 538 312 L 540 318 L 542 312').p, 0.9); P.tr(D('M 535 290 C 538 294, 542 294, 545 290').p, 0.6, 0.5); },
    });

    await K.br();
    // canopy: crocketed gable, two pinnacles, a cusped arch over the heads
    const archO = archHead(385, 695, 492, 412), archI = archHead(396, 684, 492, 425);
    const gable = [];
    const gL = [388, 472], gA = [540, 330], gR = [692, 472];
    const crock = (a, b) => {
      const n = 6;
      for (let k = 0; k <= n; k++) {
        const t = k / n;
        gable.push([lerp(a[0], b[0], t), lerp(a[1], b[1], t)]);
        if (k < n && k > 0) {
          const nx = (b[1] - a[1]), ny = -(b[0] - a[0]), m = Math.hypot(nx, ny);
          const ox = nx / m * 7.5, oy = ny / m * 7.5;
          gable.push([lerp(a[0], b[0], (k + 0.45) / n) + ox, lerp(a[1], b[1], (k + 0.45) / n) + oy], [lerp(a[0], b[0], (k + 0.72) / n) + ox * 0.35, lerp(a[1], b[1], (k + 0.72) / n) + oy * 0.35]);
        }
      }
    };
    crock(gL, gA); crock(gA, gR);
    archO.pts.slice().reverse().forEach((q) => gable.push(q.p));
    glass(poly(gable), G.gold, {
      paint: () => {
        ctx.save(); ctx.strokeStyle = TRACE;
        ctx.beginPath(); ctx.arc(540, 392, 19, 0, Math.PI * 2); ctx.lineWidth = 1.6; ctx.stroke();
        for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3 - Math.PI / 2; ctx.beginPath(); ctx.arc(540 + Math.cos(a) * 9.5, 392 + Math.sin(a) * 9.5, 7, 0, Math.PI * 2); ctx.lineWidth = 1.1; ctx.stroke(); }
        ctx.restore(); P.dot(540, 392, 3.2);
        P.mat('M 396 470 L 540 342 L 684 470', 10, 0.45);
        [[470, 428], [610, 428]].forEach(([x, y]) => { P.tr(`M ${x - 14} ${y + 26} L ${x - 14} ${y + 6} C ${x - 14} ${y - 6}, ${x + 14} ${y - 6}, ${x + 14} ${y + 6} L ${x + 14} ${y + 26}`, 1.0, 0.75); P.tr(`M ${x} ${y - 3} L ${x} ${y + 26}`, 0.8, 0.6); P.mat(`M ${x - 7} ${y + 4} L ${x - 7} ${y + 24} M ${x + 7} ${y + 4} L ${x + 7} ${y + 24}`, 5, 0.35); });
        P.tr('M 400 468 L 540 346 L 680 468', 1.1, 0.8);
        P.hl('M 410 466 L 540 352 L 670 466', 0.8, 0.3);
      },
    });
    glass(shape('M 540 330 L 535 320 C 531 314, 534 306, 540 302 C 546 306, 549 314, 545 320 Z'), G.gold, { paint: () => P.tr('M 540 308 L 540 324', 0.7) });
    [[368, 385], [695, 712]].forEach(([a, b]) => {
      glass(shape(`M ${a} 500 L ${a} 372 L ${(a + b) / 2} 344 L ${b} 372 L ${b} 500 Z`), G.white, {
        paint: () => {
          const m = (a + b) / 2;
          P.tr(`M ${m} 384 L ${m} 494`, 0.8, 0.7);
          P.tr(`M ${a + 2} 430 L ${b - 2} 430 M ${a + 2} 462 L ${b - 2} 462`, 0.9, 0.8);
          P.tr(`M ${a + 3} 398 C ${a + 3} 390, ${b - 3} 390, ${b - 3} 398`, 0.8, 0.8);
          P.mat(`M ${b - 2} 374 L ${b - 2} 498`, 5, 0.38);
          for (let y = 350; y < 372; y += 6) P.tr(`M ${a + 1} ${y + 4} L ${a - 1} ${y}`, 0.7);
        },
      });
    });
    const bandPts = archO.pts.map((q) => q.p).concat(archI.pts.map((q) => q.p).reverse());
    glass(poly(bandPts), G.whiteW, {
      paint: () => {
        for (let k = 1; k < 10; k++) { const q = archO.pts[Math.floor(archO.pts.length * k / 10)].p; P.dot(q[0] + (540 - q[0]) * 0.035, q[1] + 6.5, 1.6); }
        P.tr(new Path2D(archI.pts.map((q, i) => (i ? 'L ' : 'M ') + q.p[0].toFixed(1) + ' ' + (q.p[1] - 2).toFixed(1)).join(' ')), 0.9, 0.75);
      },
    });

    // ----- the figures, a little elongated in the Gothic way
    const FT = (x, y) => [540 + (x - 540) * 1.08, 842 - (842 - y) * 1.19];
    const sf = (d) => shape(d, FT);
    const T = (d) => shape(d, FT).p;
    const Q = {
      tr: (d, w, a) => P.tr(T(d), w * 1.3, a), fill: (d, a) => P.fill(T(d), a), mat: (d, w, a) => P.mat(T(d), w * 1.15, Math.min(1, a * 1.2)), hl: (d, w, a) => P.hl(T(d), w, a),
      dot: (x, y, r, a) => { const q = FT(x, y); P.dot(q[0], q[1], r, a); },
      shade: (sh, x0, y0, x1, y1, a0, a1) => { const p = FT(x0, y0), q = FT(x1, y1); P.shade(sh, p[0], p[1], q[0], q[1], a0, a1); },
      col: (d, css) => { ctx.fillStyle = css; ctx.fill(T(d)); },
      rect: (x, y, w, h) => `M ${x} ${y} L ${x + w} ${y} L ${x + w} ${y + h} L ${x} ${y + h} Z`,
    };
    const FACE = 1.4; // trace weight on faces

    await K.br();
    // Connie
    glass(sf('M 388 600 C 402 595, 422 598, 432 606 L 430 700 C 432 750, 434 800, 436 842 L 372 842 C 374 792, 377 742, 380 700 C 383 662, 385 628, 388 600 Z'), G.green, {
      cuts: [T('M 404 606 C 403 700, 404 780, 406 842')],
      paint: (c, sh) => {
        Q.shade(sh, 372, 0, 436, 0, 0.48, 0.05);
        Q.mat('M 392 650 C 390 720, 386 780, 382 838', 7, 0.55); Q.tr('M 392 660 C 390 724, 387 784, 384 838', 1.1);
        Q.mat('M 410 690 C 410 750, 412 800, 412 840', 7, 0.45); Q.tr('M 410 700 C 410 754, 412 804, 413 840', 1.0);
        Q.tr('M 424 720 C 424 770, 426 810, 428 840', 1.0);
        Q.tr('M 376 836 C 388 830, 398 842, 410 834 C 420 830, 428 840, 436 836', 1.1);
        Q.hl('M 401 700 C 401 760, 403 800, 404 836', 1.2, 0.3); Q.hl('M 418 712 C 419 770, 420 806, 421 834', 0.9, 0.22);
      },
    });
    glass(sf('M 400 547 C 412 541, 425 548, 427 561 C 421 559, 417 565, 417 574 C 417 587, 421 596, 431 604 C 438 616, 441 640, 438 662 C 420 672, 395 686, 371 692 C 375 660, 383 622, 388 590 C 386 570, 390 554, 400 547 Z'), G.whiteB, {
      cuts: [T('M 404 548 C 398 600, 394 640, 390 686')],
      paint: (c, sh) => {
        Q.shade(sh, 372, 0, 440, 0, 0.42, 0.0);
        Q.tr('M 398 556 C 392 580, 388 620, 382 680', 1.1); Q.mat('M 396 566 C 390 600, 386 640, 380 684', 6, 0.45);
        Q.tr('M 408 560 C 404 600, 400 640, 396 676', 0.9); Q.tr('M 424 604 C 430 624, 432 646, 430 664', 0.9);
        Q.tr('M 372 690 C 386 684, 398 680, 410 676', 0.9, 0.6);
        Q.hl('M 414 566 C 410 600, 412 630, 420 650', 1.0, 0.35);
      },
    });
    glass(sf('M 418 557 C 423 555, 429 559, 430 566 L 433 572 L 430 574 C 431 579, 429 584, 425 587 C 421 589, 418 586, 417 580 C 416 572, 416 562, 418 557 Z'), G.flesh, {
      noStreak: true,
      paint: (c, sh) => {
        Q.shade(sh, 416, 0, 432, 0, 0.55, 0.0);
        Q.mat('M 421 567 C 423.6 565, 427 565, 429 567', 3.4, 0.45);
        Q.tr('M 421.2 562.4 C 423.8 560.8, 427 561, 429.4 563.2', 1.35);
        Q.tr('M 422.4 567 C 424.4 565.6, 427 565.6, 428.6 567.4', 1.15); Q.dot(426.6, 567.1, 1.2);
        Q.tr('M 429 564.6 L 432 571.6 L 429.6 573.2', 1.15);
        Q.tr('M 425.8 578 C 427.2 577.4, 428.6 577.6, 429.6 578.4', 1.05);
      },
    });
    glass(sf('M 405 638 C 407 627, 413 617, 420 613 C 423 618, 421 628, 415 638 Z'), G.flesh, { noStreak: true, paint: (c, sh) => { Q.shade(sh, 405, 0, 422, 0, 0.35, 0); Q.tr('M 409 634 L 417 619 M 412 636 L 419 623', 0.7, 0.75); } });

    await K.br();
    // the priest
    glass(sf('M 604 776 L 706 778 L 710 842 L 600 842 Z'), G.cassock, { paint: () => { Q.hl('M 626 790 L 624 840 M 680 790 L 684 840', 1.0, 0.22); Q.tr('M 652 790 L 654 840', 0.9, 0.8); } });
    glass(sf('M 616 592 C 630 588, 672 588, 690 594 C 700 610, 706 650, 708 700 L 712 790 C 690 798, 630 798, 598 790 L 604 700 C 606 660, 608 620, 616 592 Z'), G.white, {
      cuts: [T('M 630 598 C 628 680, 626 740, 624 797'), T('M 688 600 C 692 670, 696 730, 698 795')],
      paint: (c, sh) => {
        Q.shade(sh, 600, 0, 712, 0, 0.04, 0.42);
        for (let k = 0; k < 9; k++) { const x = 606 + k * 12; Q.tr(`M ${x + 4} ${640 + (k % 2) * 10} C ${x + 2} 700, ${x - 1} 740, ${x - 2} 788`, 0.9, 0.75); if (k % 2) Q.mat(`M ${x + 8} ${650} C ${x + 6} 700, ${x + 3} 740, ${x + 2} 786`, 4, 0.25); }
        Q.mat('M 694 610 C 702 660, 706 720, 708 786', 9, 0.5);
        for (let k = 0; k < 10; k++) { const x = 601 + k * 11; Q.tr(`M ${x} 790 C ${x} 796.5, ${x + 10} 796.5, ${x + 10} 790`, 0.9); Q.dot(x + 5, 791.5, 1.0); }
      },
    });
    [['M 640 594 L 652 596 L 650 786 L 638 786 Z', 645], ['M 664 596 L 676 594 L 681 786 L 669 786 Z', 674.5]].forEach(([d, x]) => glass(sf(d), G.gold, {
      paint: (c, sh) => {
        Q.shade(sh, x - 8, 0, x + 8, 0, 0.0, 0.32);
        [700, 760].forEach((y) => { Q.col(Q.rect(x - 1.6, y - 7, 3.2, 14), 'rgba(150,18,32,0.92)'); Q.col(Q.rect(x - 5, y - 1.6, 10, 3.2), 'rgba(150,18,32,0.92)'); });
        Q.tr(`M ${x - 7} 778 L ${x + 7} 778`, 0.9); for (let k = 0; k < 4; k++) Q.tr(`M ${x - 5 + k * 3.4} 780 L ${x - 5 + k * 3.4} 786`, 0.7);
      },
    }));
    glass(sf('M 652 636 L 680 632 L 684 662 L 656 666 Z'), G.ruby, { paint: () => { Q.tr('M 656 640 L 680 636', 0.8); Q.col(Q.rect(666, 642, 4, 13), 'rgba(236,190,80,0.85)'); Q.col(Q.rect(662, 646, 12, 3), 'rgba(236,190,80,0.85)'); } });
    glass(sf('M 662 652 C 667 648, 676 648, 679 653 L 677 661 L 665 662 Z'), G.flesh, { noStreak: true, paint: () => { Q.tr('M 666 655 L 676 654 M 667 658 L 676 657', 0.6, 0.75); } });
    glass(sf('M 641 539 C 648 534, 660 536, 664 545 L 666 561 C 664 571, 657 579, 648 580 C 643 580, 639 576, 638 571 L 634 567 L 637 564 C 635 559, 635 552, 637 548 C 637 544, 639 541, 641 539 Z'), G.flesh, {
      noStreak: true,
      paint: (c, sh) => {
        Q.shade(sh, 636, 0, 666, 0, 0.0, 0.6);
        Q.mat('M 637 553.6 C 640 551, 645 551, 647 554', 4.5, 0.5);
        Q.mat('M 655 548 C 661 556, 661 567, 655 576', 6, 0.42);
        Q.tr('M 637.6 551 C 640.4 548.6, 644.6 548.6, 647.2 551.2', 1.8);
        Q.tr('M 638.6 556 C 640.8 554.2, 644 554.2, 646.2 556.4', 1.4); Q.dot(640.9, 555.9, 1.45);
        Q.tr('M 639 558.4 C 641 559.2, 643.6 559.2, 645.4 558.4', 0.7, 0.7);
        Q.tr('M 638.4 552.6 L 634.4 566 L 637.8 567.4', 1.4);
        Q.tr('M 638.4 572.2 C 640 571.4, 642.2 571.6, 643.8 572.6', 1.25);
        Q.tr('M 645 576.6 C 648 579.4, 653 579.4, 657 576.4', 0.8, 0.6);
        Q.tr('M 641 543.6 C 645 541.6, 649 541.6, 652 543.6', 0.7, 0.55);
        Q.tr('M 643.6 560 C 645.4 562, 646.2 565, 645.2 568', 0.7, 0.55);
        Q.tr('M 657 553 C 659.6 551, 661.6 555, 658.6 559', 1.0);
      },
    });
    glass(sf('M 655 537 C 664 539, 670 547, 669 558 C 668 567, 665 573, 661 575 L 663 558 C 662 549, 659 543, 652 539 Z'), G.stoneL, { noStreak: true, paint: () => { Q.tr('M 658 544 C 662 550, 664 558, 663 568 M 662 542 C 666 548, 667 556, 666 564', 0.65, 0.75); } });

    await K.br();
    // Michael
    glass(sf('M 430 698 L 500 698 L 503 760 L 501 836 L 484 836 L 478 764 L 470 836 L 450 836 L 440 764 Z'), G.suit, {
      paint: (c, sh) => { Q.shade(sh, 430, 0, 502, 0, 0.38, 0.0); Q.hl('M 492 712 L 494 760 L 492 830 M 458 714 L 456 764 L 460 830', 1.1, 0.3); Q.tr('M 476 720 L 477 764', 0.9, 0.8); },
    });
    glass(sf('M 448 834 L 471 834 C 476 836, 478 840, 476 843 L 446 843 Z'), [22, 18, 24], { noStreak: true, edge: false, paint: () => Q.hl('M 456 836 L 470 836', 0.9, 0.35) });
    glass(sf('M 483 834 L 501 834 C 508 836, 511 840, 509 843 L 482 843 Z'), [22, 18, 24], { noStreak: true, edge: false, paint: () => Q.hl('M 488 836 L 503 836', 0.9, 0.35) });
    glass(sf('M 446 588 C 434 591, 426 600, 425 614 L 426 700 C 444 708, 474 709, 502 702 L 501 664 L 495 628 C 493 609, 488 597, 477 591 L 471 590 L 466 610 L 458 589 Z'), G.suit, {
      cuts: [T('M 448 590 C 446 640, 446 680, 448 708')],
      paint: (c, sh) => {
        Q.shade(sh, 425, 0, 500, 0, 0.45, 0.0);
        Q.hl('M 471 591 L 478 612 L 471 628', 1.1, 0.42); Q.hl('M 458 590 L 455 606 L 464 624', 1.0, 0.32);
        Q.hl('M 432 610 C 431 640, 432 670, 434 700', 1.2, 0.2); Q.hl('M 446 600 C 446 640, 448 676, 450 704', 0.8, 0.14);
        Q.tr('M 466 612 L 466 700', 0.9, 0.85); Q.dot(469, 652, 1.2, 0.9); Q.dot(469, 674, 1.2, 0.9);
        Q.tr('M 438 700 C 456 706, 478 706, 500 700', 0.9, 0.6);
        Q.hl('M 478 680 L 494 679', 1.0, 0.35); Q.hl('M 436 676 C 440 684, 446 690, 452 692', 0.8, 0.2);
        Q.mat('M 488 600 C 496 612, 498 630, 497 650', 7, 0.35);
      },
    });
    glass(sf('M 457 588 L 472 589 L 466 612 Z'), G.white, { noStreak: true, paint: () => { Q.fill('M 463.5 592 L 468 592 L 467 606 L 465.5 609 L 463.5 605 Z', 0.88); } });
    glass(sf('M 456 574 L 471 577 L 472 592 L 455 591 Z'), G.flesh, { noStreak: true, paint: (c, sh) => Q.shade(sh, 455, 576, 455, 592, 0.5, 0.15) });
    glass(sf('M 466 538 C 474 539, 480 545, 481 552 L 484 559 L 481 562 C 482 565, 481 568, 479 570 C 477 575, 471 579, 464 578 C 458 577, 453 572, 452 565 L 452 551 C 455 545, 459 540, 466 538 Z'), G.flesh, {
      noStreak: true,
      paint: (c, sh) => {
        Q.shade(sh, 452, 0, 482, 0, 0.62, 0.0);
        Q.mat('M 467 553 C 471 550, 477 550, 480 553', 4.5, 0.5);
        Q.mat('M 478 558 C 478 562, 476 566, 472 570', 3.5, 0.4);
        Q.mat('M 456 552 C 454 562, 458 572, 466 577', 6, 0.45);
        Q.tr('M 468 548 C 471 545.6, 476 545.6, 480 548', 1.9);
        Q.tr('M 470 553.4 C 472.6 551.4, 476 551.4, 478.6 553.6', 1.5);
        Q.dot(475.6, 553.5, 1.55);
        Q.tr('M 471.4 556 C 473.4 556.8, 476 556.8, 477.6 555.8', 0.7, 0.7);
        Q.tr('M 480 549.6 L 483.8 558.6 L 480.4 561.4', 1.4); Q.dot(480.4, 560.2, 0.8);
        Q.tr('M 473.6 566.2 C 476 565.4, 478.2 565.6, 480 566.6', 1.3);
        Q.tr('M 475 569 C 476.5 569.6, 478 569.6, 479 569', 0.7, 0.7);
        Q.tr('M 457.6 555.6 C 461.4 553, 463.4 558, 459.6 562.4', 1.1);
        Q.hl('M 474 541 C 477 542, 479.5 545, 480.5 548', 0.9, 0.45);
      },
    });
    glass(sf('M 449 558 C 445 546, 449 533, 462 529 C 474 526, 483 534, 483 544 C 478 540, 471 538, 466 538 C 459 540, 455 545, 452 551 L 452 565 C 450 563, 449 561, 449 558 Z'), [44, 32, 28], {
      noStreak: true, edge: false,
      paint: () => { Q.hl('M 456 536 C 462 532, 470 531, 477 534', 0.9, 0.32); Q.hl('M 452 544 C 455 538, 461 535, 467 535', 0.7, 0.24); },
    });
    glass(sf('M 476 598 C 488 597, 496 606, 498 622 L 502 643 C 511 641, 522 640, 532 641 L 533 659 C 519 662, 501 665, 489 663 C 481 659, 477 648, 476 636 Z'), G.suit, {
      paint: () => { Q.hl('M 490 656 C 496 650, 502 648, 508 648', 0.9, 0.3); Q.hl('M 486 604 C 492 612, 495 626, 497 640', 1.0, 0.34); Q.tr('M 492 650 C 498 652, 504 652, 508 650', 0.9, 0.85); Q.hl('M 506 645 L 530 644', 0.9, 0.28); Q.col(Q.rect(528, 641, 4, 18), 'rgba(230,236,226,0.85)'); },
    });
    glass(sf('M 532 641 C 538 639, 545 641, 548 646 C 546 651, 540 655, 533 659 Z'), G.flesh, { noStreak: true, paint: () => Q.tr('M 536 648 L 545 646 M 536 652 L 543 651', 0.65, 0.75) });

    await K.br();
    // the child in the long gown
    glass(sf('M 500 632 C 490 640, 482 652, 478 672 C 473 712, 469 762, 464 806 C 478 813, 496 813, 510 806 C 508 766, 506 718, 506 684 C 506 666, 510 652, 516 644 Z'), G.white, {
      cuts: [T('M 494 646 C 488 700, 484 750, 482 812')],
      paint: (c, sh) => {
        Q.shade(sh, 466, 0, 512, 0, 0.28, 0.0);
        Q.tr('M 492 650 C 486 690, 482 740, 478 804', 0.95); Q.mat('M 490 660 C 485 700, 481 750, 477 800', 5, 0.36);
        Q.tr('M 501 656 C 498 700, 497 750, 497 804', 0.9); Q.tr('M 484 664 C 478 700, 475 750, 471 800', 0.7, 0.6);
        Q.hl('M 497 680 C 495 720, 493 760, 491 800', 1.0, 0.4);
        for (let k = 0; k < 4; k++) { const y = 720 + k * 18; Q.tr(`M ${485 - k} ${y} C ${489 - k} ${y + 3}, ${495 - k} ${y + 3}, ${499 - k} ${y}`, 0.6, 0.55); }
      },
    });
    glass(sf('M 464 800 C 478 807, 496 807, 510 800 L 511 812 C 496 819, 478 819, 463 812 Z'), G.goldP, {
      noStreak: true,
      paint: () => { for (let k = 0; k < 7; k++) { const x = 467 + k * 6.6; Q.dot(x, 809.6, 1.3, 0.85); Q.tr(`M ${x - 3} 814 C ${x - 1} 817, ${x + 1} 817, ${x + 3} 814`, 0.7, 0.8); } },
    });
    glass(sf('M 498 630 C 510 624, 530 623, 545 627 L 548 640 C 532 645, 512 646, 500 642 Z'), G.white, {
      paint: (c, sh) => { Q.shade(sh, 0, 624, 0, 646, 0.0, 0.4); Q.tr('M 512 628 C 512 634, 514 640, 516 643 M 528 626 C 528 632, 530 638, 531 642', 0.8, 0.75); },
    });
    glass(sf('M 508 622 C 514 617, 524 617, 528 621 C 526 626, 518 628, 509 628 Z'), G.flesh, { noStreak: true, paint: () => Q.tr('M 513 621 L 525 620 M 512 624 L 524 624', 0.6, 0.7) });
    glass(sf('M 543 626 C 548 619, 558 618, 564 624 C 567 630, 566 638, 561 643 L 548 642 Z'), G.whiteW, { noStreak: true, paint: () => { Q.tr('M 547 624 C 552 621, 558 621, 562 625', 0.7, 0.7); for (let k = 0; k < 4; k++) Q.dot(548 + k * 4, 625 - (k === 1 || k === 2 ? 1.6 : 0), 0.85, 0.7); } });
    glass(sf('M 551 628 C 555 625, 561 627, 562 632 C 562 637, 559 641, 554 641 C 550 640, 549 633, 551 628 Z'), G.flesh, {
      noStreak: true,
      paint: (c, sh) => {
        Q.shade(sh, 549, 0, 562, 0, 0.4, 0.0);
        Q.tr('M 554.4 631.2 C 555.6 632.4, 557.4 632.4, 558.6 631.2', 1.0);
        Q.tr('M 555 636.2 C 556 637, 557.4 637, 558.2 636.2', 0.8, 0.8);
        Q.mat('M 551 634 C 551 637, 553 640, 556 640', 2.4, 0.35);
      },
    });
    // the font
    glass(sf('M 524 806 L 590 806 L 598 842 L 516 842 Z'), G.stone, { paint: (c, sh) => { Q.shade(sh, 516, 0, 598, 0, 0.0, 0.45); Q.tr('M 522 814 L 592 814', 1.0); Q.tr('M 519 828 L 595 828', 0.7, 0.6); } });
    glass(sf('M 545 746 L 569 746 L 573 808 L 541 808 Z'), G.stone, { paint: (c, sh) => { Q.shade(sh, 541, 0, 573, 0, 0.0, 0.48); Q.tr('M 552 752 L 551 804 M 562 752 L 563 804', 0.8, 0.7); } });
    glass(sf('M 511 702 L 603 702 L 597 726 C 591 740, 576 747, 557 747 C 538 747, 523 740, 517 726 Z'), G.stone, {
      paint: (c, sh) => {
        Q.shade(sh, 511, 0, 603, 0, 0.0, 0.45);
        for (let k = 0; k < 5; k++) { const x = 523 + k * 17; Q.tr(`M ${x} 734 L ${x} 716 C ${x} 708, ${x + 13} 708, ${x + 13} 716 L ${x + 13} 734`, 0.9, 0.85); Q.mat(`M ${x + 3} 714 L ${x + 3} 732`, 3, 0.3); }
        Q.tr('M 518 728 C 530 740, 584 740, 596 728', 0.7, 0.6);
      },
    });
    glass(sf('M 508 692 L 606 692 L 603 702 L 511 702 Z'), G.stoneL, { paint: () => { Q.tr('M 512 697 L 602 697', 0.6, 0.55); } });

    // the priest's raised arm, the shell, the water
    glass(sf('M 622 600 C 606 606, 594 622, 588 640 C 584 652, 584 668, 590 682 C 600 690, 612 690, 620 682 C 618 660, 620 636, 626 618 Z'), G.white, {
      paint: (c, sh) => { Q.shade(sh, 586, 0, 624, 0, 0.0, 0.36); Q.tr('M 604 616 C 598 640, 596 664, 600 684 M 614 620 C 609 646, 609 668, 612 686', 0.85, 0.75); Q.mat('M 592 646 C 590 660, 592 674, 596 684', 5, 0.32); Q.tr('M 588 676 C 596 686, 610 688, 620 680', 0.8, 0.6); },
    });
    glass(sf('M 586 645 L 596 638 L 584 615 L 576 621 Z'), G.cassock, { noStreak: true });
    glass(sf('M 574 612 C 578 607, 585 607, 587 612 L 584 621 L 576 623 Z'), G.flesh, { noStreak: true, paint: () => Q.tr('M 577 612 L 583 611 M 577 615 L 584 615', 0.6, 0.75) });
    glass(sf('M 558 612 C 562 604, 572 602, 578 608 L 572 622 C 566 622, 560 619, 558 612 Z'), G.goldP, { noStreak: true, paint: () => { for (let k = 0; k < 5; k++) Q.tr(`M 571 620 L ${559 + k * 4} ${611 - Math.sin(k * 0.8) * 4}`, 0.6, 0.8); } });
    glass(sf('M 560 620 C 559 623, 557 625, 556 627.5 L 553 627 C 555 624, 557 621, 558 618.5 Z'), G.aqua, { noStreak: true, noSeed: true, lw: 1.8 });

    await K.br();
    // pavement and the inscription
    for (let k = 0; k < 13; k++) {
      const x = 356 + k * 29;
      glass(shape(`M ${x} 842 L ${x + 29} 842 L ${x + 29} 866 L ${x} 866 Z`), k % 2 ? G.gold : G.murrey, {
        paint: () => { const m = x + 14.5; P.tr(`M ${m} 846 L ${m + 8} 854 L ${m} 862 L ${m - 8} 854 Z`, 1.0, 0.85); P.dot(m, 854, 1.7, 0.8); },
      });
    }
    glass(shape('M 356 866 L 724 866 L 724 893 L 356 893 Z'), G.whiteW, {
      paint: () => {
        ctx.save();
        ctx.fillStyle = 'rgba(28,17,10,0.92)';
        ctx.font = 'bold 17px serif'; ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
        const txt = 'ABRENVNTIO', sp = 22.5;
        for (let i = 0; i < txt.length; i++) ctx.fillText(txt[i], 540 + (i - (txt.length - 1) / 2) * sp, 880.5);
        ctx.restore();
        P.tr('M 372 871 L 708 871 M 372 889 L 708 889', 0.7, 0.6);
        [392, 688].forEach((x) => { P.dot(x, 880, 2.2, 0.85); P.dot(x - 8, 880, 1.1, 0.85); P.dot(x + 8, 880, 1.1, 0.85); });
      },
    });
    ctx.restore();
    band(op, 11, 34, [G.ruby, G.ruby, G.goldP]);
  }

  /* ------------------------------------------------------------------ medallion scenes (local coords, field radius 64) */
  const SCENES = {
    stair: {
      ground: [232, 210, 150],
      cuts: [[[-70, -14], [-36, -36], [0, -52], [26, -70]], [[20, -70], [18, -40], [20, -22]]],
      pieces: [
        { d: 'M -70 50 L -56 50 L -56 38 L -39 38 L -39 26 L -22 26 L -22 14 L -5 14 L -5 2 L 12 2 L 12 -10 L 29 -10 L 29 -22 L 70 -22 L 70 70 L -70 70 Z', c: [200, 198, 190],
          paint: (P) => {
            const steps = [[-56, 50], [-39, 38], [-22, 26], [-5, 14], [12, 2], [29, -10]];
            steps.forEach(([x, y]) => { P.tr(`M ${x} ${y - 12} L ${x} ${y}`, 1.0, 0.75); P.mat(`M ${x - 17} ${y - 10} L ${x} ${y - 10}`, 3.6, 0.55); });
            P.mat('M -70 66 L 70 -4', 30, 0.38);
          } },
      ],
      paint: (P) => {
        // the courthouse portico, in half-tone
        P.fill('M 24 -64 L 70 -64 L 70 -57 L 24 -57 Z', 0.55);
        P.fill('M 28 -66 L 48 -78 L 68 -66 Z', 0.5);
        [33, 45, 57, 69].forEach((x) => P.fill(`M ${x - 2.6} -57 L ${x + 2.6} -57 L ${x + 2.6} -22 L ${x - 2.6} -22 Z`, 0.45));
        // the long shadow of a second man, falling across the lower steps
        P.fillT(MAN, (x, y) => [-64 + (x * 0.9 - y * 1.3), 52 + (x * 0.15 + y * 0.36)], 0.5);
        // the man on the stair, a hand at his chest
        const MT = (x, y) => [-13 + (x + 4) * 1.3, 14 + (y - 8) * 1.3];
        P.fillT('M -1 -36 C -1 -38.6, 1 -40.6, 3.4 -40.6 C 5.8 -40.6, 7.6 -38.6, 7.6 -36 C 7.6 -33.4, 5.8 -31.4, 3.4 -31.4 C 1 -31.4, -1 -33.4, -1 -36 Z', MT);
        P.fillT('M -4.5 -38.5 L 11 -39 L 10 -40.6 L 8 -40.9 C 7.4 -45.2, 0.6 -45.8, 0 -41 L -2.6 -40.6 Z', MT);
        P.fillT('M -1 -31 C 3 -32.6, 8 -32, 10 -28.6 L 12 -17 L 14 -3 L 4 -2 L -6 -3 L -4 -16 Z', MT);
        P.fillT('M 9 -27 L 13 -22 L 7 -19 L 5 -21.5 L 9 -23 Z', MT);
        P.fillT('M -4 -4 L 1 -4 L -2 6 L 1 6.4 L 1 8 L -8 8 L -6 5 Z', MT);
        P.fillT('M 4 -4 L 10 -4 L 11 -2.4 L 14.6 -2.6 L 14.6 -1 L 6 -1 Z', MT);
      },
    },
    door: {
      ground: [170, 194, 212],
      cuts: [[[-44, -70], [-44, 34]], [[44, 34], [44, -70]], [[-70, -58], [-20, -62], [30, -60], [70, -64]]],
      pieces: [
        { d: 'M -38 -38 L 38 -38 L 38 34 L -38 34 Z', c: [214, 230, 234], paint: (P) => {
          P.tr('M -38 -38 L -38 34 M 38 -38 L 38 34 M -38 -38 L 38 -38', 3.4);
          P.tr('M 0 -38 L 0 34', 3.0); P.tr('M -20 -36 L -20 32 M 22 -36 L 22 32', 1.6);
          P.tr('M -36 2 L -22 2 M 2 2 L 20 2 M 24 2 L 36 2', 1.2);
          P.mat('M -18 -30 L -2 30', 10, 0.18);
          // the man caught inside, hands on the glass
          P.fill('M -30.5 -22 C -30.5 -25, -28.2 -27, -25.6 -27 C -23 -27, -21 -25, -21 -22 C -21 -19.3, -23 -17.4, -25.6 -17.4 C -28.2 -17.4, -30.5 -19.3, -30.5 -22 Z');
          P.fill('M -32 -15 C -28 -16.5, -23 -16.5, -19.5 -15 L -19 4 L -21 32 L -25 32 L -25.6 10 L -26.6 32 L -30.6 32 L -32 4 Z');
          P.fill('M -32 -14 L -36 -30 L -33.6 -31 L -29.6 -16 Z');
          P.fill('M -19.6 -14 L -16 -30 L -18.4 -31 L -22 -16 Z');
        } },
        { d: 'M -70 34 L 70 34 L 70 70 L -70 70 Z', c: [120, 110, 136], paint: (P) => { P.tr('M -60 46 L 60 46', 0.8, 0.6); P.tr('M -62 58 L 62 58', 0.8, 0.5); } },
      ],
      paint: (P) => {
        P.fill('M -56 -54 L 56 -54 L 50 -44 L -50 -44 Z', 0.85);
        for (let k = 0; k < 12; k++) P.dot(-46 + k * 8.4, -41.5, 1.3, 0.8);
        P.fill('M -70 -70 L -44 -70 L -44 34 L -70 34 Z', 0.4); P.fill('M 44 -70 L 70 -70 L 70 34 L 44 34 Z', 0.4);
        // a man outside, leaning on the door
        P.fillT(MAN, (x, y) => [50 - x, 34 + y], 0.95);
      },
    },
    toll: {
      ground: [176, 34, 46],
      cuts: [[[-70, -26], [-24, -42], [24, -38], [70, -54]], [[-70, 10], [-30, 12], [16, 10], [70, 12]]],
      pieces: [
        { d: 'M -70 22 L 70 22 L 70 70 L -70 70 Z', c: [78, 34, 70], paint: (P) => { P.tr('M -70 40 L 70 40', 0.9, 0.5); for (let k = 0; k < 6; k++) P.tr(`M ${-60 + k * 22} 50 L ${-50 + k * 22} 50`, 1.6, 0.6); } },
        { d: 'M 25 -14 L 39 -14 L 39 0 L 25 0 Z', c: [244, 196, 80], paint: (P) => { P.tr('M 32 -14 L 32 0', 0.8, 0.7); } },
      ],
      paint: (P) => {
        P.mat('M -70 14 C -40 8, -10 12, 20 10 C 40 9, 60 12, 70 10', 10, 0.45);
        // booth
        P.fill('M 20 -20 L 44 -20 L 44 22 L 20 22 Z M 25 -14 L 25 0 L 39 0 L 39 -14 Z', 0.92);
        P.fill('M 14 -28 L 50 -28 L 50 -22 L 14 -22 Z');
        P.fill('M 31 -28 L 33 -36 L 35 -28 Z');
        // gate arm across the road
        P.fill('M -2 2 L 20 1 L 20 4 L -2 4.6 Z');
        // the car, stopped
        P.fill('M -64 18 C -64 11, -60 7, -52 6 L -42 5 C -38 -4, -30 -9, -18 -9 C -9 -9, -3 -5, 1 2 L 10 4 C 15 6, 16 12, 15 18 L 13 21 L -62 21 Z');
        P.fill('M -54 21 C -54 16, -50 13, -46 13 C -42 13, -38 16, -38 21 C -38 26, -42 29, -46 29 C -50 29, -54 26, -54 21 Z');
        P.fill('M -10 21 C -10 16, -6 13, -2 13 C 2 13, 6 16, 6 21 C 6 26, 2 29, -2 29 C -6 29, -10 26, -10 21 Z');
        P.light('M -36 4 C -33 -3, -28 -6, -21 -6 L -21 4 Z M -18 -6 C -11 -6, -6 -3, -3 4 L -18 4 Z', 0.5);
      },
    },
    barber: {
      ground: [120, 176, 128],
      cuts: [[[-70, 6], [-30, 0], [20, -2], [70, 2]], [[28, -70], [30, -20], [26, 36]]],
      pieces: [
        { d: 'M -54 -12 L -54 -44 C -54 -56, -6 -56, -6 -44 L -6 -12 Z', c: [214, 226, 222], paint: (P) => { P.mat('M -46 -46 L -16 -16', 8, 0.25); P.hl('M -44 -40 L -26 -22', 1.4, 0.5); } },
        { d: 'M 40 -54 L 50 -54 L 50 14 L 40 14 Z', c: [228, 226, 214], paint: (P) => { for (let y = -60; y < 20; y += 9) P.fill(`M 40 ${y} L 50 ${y + 7} L 50 ${y + 11} L 40 ${y + 4} Z`, 0.75); P.fill('M 38 -58 L 52 -58 L 52 -54 L 38 -54 Z M 38 14 L 52 14 L 52 18 L 38 18 Z'); } },
        { d: 'M -70 36 L 70 36 L 70 70 L -70 70 Z', c: [182, 170, 140], paint: (P) => { for (let k = -8; k < 9; k++) P.tr(`M ${k * 9} 36 L ${k * 13} 70`, 0.7, 0.6); P.tr('M -70 46 L 70 46 M -70 58 L 70 58', 0.7, 0.6); } },
      ],
      paint: (P) => {
        P.fill('M -14 36 L 14 36 L 10 31 L 4 31 L 3 16 L -3 16 L -4 31 L -10 31 Z');
        P.fill('M -18 10 L 18 10 L 20 16 L -16 16 Z');
        P.fill('M -18 10 L -40 -4 L -44 0 L -20 16 Z');
        P.fill('M -42 -9 L -48 -5 L -45 -1 L -39 -5 Z');
        P.fill('M 18 12 L 34 22 L 36 27 L 31 27 L 16 16 Z');
        P.fill('M -16 6 L 14 6 L 14 9 L -16 9 Z');
        // the sitter under the cape, a towel over his face
        P.fill('M -36 -10 C -26 -12, -6 -6, 10 -1 C 18 1, 25 6, 31 12 L 37 19 L 32 23 L 18 16 L -14 11 L -35 0 Z', 0.8);
        P.light('M -42 -12 C -38 -16, -31 -15, -28 -11 C -28 -6, -32 -3, -37 -3 C -41 -4, -43 -8, -42 -12 Z', 0.9);
      },
    },
    hat: {
      ground: [206, 218, 230],
      pieces: [],
      paint: (P) => {
        // a hand opens; a hat falls
        P.fill('M -10 -68 L 10 -68 L 8.6 -40 L -8.6 -40 Z');
        P.light('M -9 -41 L 9 -41 L 8.8 -36 L -8.8 -36 Z', 0.8);
        P.fill('M -8.8 -36 C -10 -31, -9.6 -26, -7 -21.6 L 7.4 -21.6 C 9.6 -26, 10 -31, 8.8 -36 Z');
        P.tr('M -5.6 -23 L -9.2 -9.4', 4.3); P.tr('M -1.9 -22.4 L -2.9 -6.4', 4.3); P.tr('M 1.9 -22.4 L 3.1 -6.8', 4.1); P.tr('M 5.6 -23 L 9 -11', 3.9);
        P.tr('M -8.2 -31.4 L -15.8 -24.6', 4.5);
        const HT = (x, y) => { const a = 0.45, c = Math.cos(a), sn = Math.sin(a); x *= 1.45; y *= 1.45; return [-2 + x * c - y * sn, 27 + x * sn + y * c]; };
        P.fillT('M -17 4 C -12 0.6, 12 0.6, 17 4 C 12 7, -12 7, -17 4 Z M -9.5 3.4 C -10 -6, -7 -10.4, -1 -9.6 C 2 -11, 4 -11, 6 -9.6 C 9.6 -7, 10 -2, 9.6 3.4 Z', HT);
        P.lightT('M -9.2 0 L 9.4 0 L 9.5 2.2 L -9.4 2.2 Z', HT, 0.4);
      },
    },
  };

  async function drawMedallion(K, ctx, cx, cy, sc, ring1, scene, R) {
    const { glass, P } = K;
    const tf = TF(cx, cy, sc);
    const rf = 64 * sc;
    // field pieces
    const fieldC = circ(cx, cy, rf);
    glass(fieldC, scene.ground, { v: 0.6, noLead: true });
    ctx.save(); ctx.clip(fieldC.p);
    const Pl = localPaint(P, ctx, tf);
    const cuts = (scene.cuts || []).map((c) => c.map(([x, y]) => tf(x, y)));
    cuts.forEach((c, i) => {
      const p = new Path2D(); c.forEach((q, k) => (k ? p.lineTo(q[0], q[1]) : p.moveTo(q[0], q[1])));
      const e = c[c.length - 1], s0 = c[0];
      p.lineTo(e[0] + (e[1] - s0[1]) * 4, e[1] - (e[0] - s0[0]) * 4); p.lineTo(s0[0] + (e[1] - s0[1]) * 4, s0[1] - (e[0] - s0[0]) * 4); p.closePath();
      ctx.fillStyle = R() < 0.5 ? 'rgba(255,250,235,0.13)' : 'rgba(40,20,10,0.12)'; ctx.fill(p);
    });
    scene.pieces.forEach((pc) => {
      const sh = shape(pc.d, tf);
      ctx.save(); ctx.clip(fieldC.p);
      glass(sh, pc.c, { v: 0.6, paint: pc.paint ? () => pc.paint(Pl) : null, lw: 2.4 });
      ctx.restore();
    });
    scene.paint(Pl);
    cuts.forEach((c) => { const p = new Path2D(); c.forEach((q, k) => (k ? p.lineTo(q[0], q[1]) : p.moveTo(q[0], q[1]))); ctx.strokeStyle = LEAD; ctx.lineWidth = 2.4; ctx.lineJoin = 'round'; ctx.stroke(p); });
    ctx.restore();
    K.lead(fieldC, 2.8);
    await K.br();
    // rings: ruby (or given) ring cut into pieces, then a white pearl ring
    const r0 = rf, r1 = rf + 7 * sc, r2 = r1 + 7 * sc;
    for (let k = 0; k < 8; k++) {
      const a0 = k * Math.PI / 4 + 0.2, a1 = a0 + Math.PI / 4;
      glass(ring(cx, cy, r0, r1, a0, a1), ring1, { v: 0.8, noSeed: true, lw: 2.6 });
    }
    for (let k = 0; k < 6; k++) {
      const a0 = k * Math.PI / 3 + 0.5, a1 = a0 + Math.PI / 3;
      glass(ring(cx, cy, r1, r2, a0, a1), G.whiteW, {
        v: 0.6, noSeed: true, lw: 2.6,
        paint: () => { const n = 9; for (let i = 0; i < n; i++) { const a = a0 + (i + 0.5) * (a1 - a0) / n; ctx.beginPath(); ctx.arc(cx + Math.cos(a) * (r1 + r2) / 2, cy + Math.sin(a) * (r1 + r2) / 2, 2.1 * sc, 0, Math.PI * 2); ctx.lineWidth = 0.9; ctx.strokeStyle = TRACE; ctx.stroke(); } },
      });
    }
  }
  // paint helpers that take local medallion coordinates
  function localPaint(P, ctx, tf) {
    const T = (d) => shape(d, tf).p;
    return {
      fill: (d, a) => P.fill(T(d), a),
      fillT: (d, f, a) => P.fill(shape(d, (x, y) => { const q = f(x, y); return tf(q[0], q[1]); }).p, a),
      tr: (d, w, a) => P.tr(T(d), w, a),
      mat: (d, w, a) => P.mat(T(d), w, a),
      hl: (d, w, a) => P.hl(T(d), w, a),
      dot: (x, y, r, a) => { const q = tf(x, y); P.dot(q[0], q[1], r, a); },
      light: (d, a) => { ctx.fillStyle = `rgba(255,236,190,${a})`; ctx.fill(T(d)); },
      lightT: (d, f, a) => { ctx.fillStyle = `rgba(255,236,190,${a})`; ctx.fill(shape(d, (x, y) => { const q = f(x, y); return tf(q[0], q[1]); }).p); },
    };
  }

  /* ------------------------------------------------------------------ side lights */
  async function drawSide(K, ctx, op, R, top, bottom) {
    const { glass, P, field, band } = K;
    const cx = (op.x0 + op.x1) / 2;
    ctx.save(); ctx.clip(op.p);
    await K.trellis([op.x0, 452, op.x1, 905], 30, [mulc(G.blueD, 0.9), mulc(G.blue, 0.85), mulc(G.blueV, 0.85), mulc(G.blueT, 0.85)], mulc(G.ruby, 0.85));
    // fleur-de-lis in the head
    glass(shape(`M ${cx} 494 C ${cx + 6} 502, ${cx + 6} 512, ${cx + 2} 520 L ${cx + 2} 526 L ${cx + 12} 526 C ${cx + 14} 514, ${cx + 22} 508, ${cx + 26} 514 C ${cx + 22} 516, ${cx + 18} 522, ${cx + 18} 530 L ${cx + 4} 532 L ${cx + 4} 538 L ${cx - 4} 538 L ${cx - 4} 532 L ${cx - 18} 530 C ${cx - 18} 522, ${cx - 22} 516, ${cx - 26} 514 C ${cx - 22} 508, ${cx - 14} 514, ${cx - 12} 526 L ${cx - 2} 526 L ${cx - 2} 520 C ${cx - 6} 512, ${cx - 6} 502, ${cx} 494 Z`), G.gold, {
      paint: () => { P.tr(`M ${cx} 500 L ${cx} 524 M ${cx - 14} 529 L ${cx + 14} 529`, 0.8, 0.8); },
    });
    await drawMedallion(K, ctx, cx, 632, 1, top.ring, SCENES[top.scene], R);
    await drawMedallion(K, ctx, cx, 808, 1, bottom.ring, SCENES[bottom.scene], R);
    ctx.restore();
    band(op, 10, 30, [G.ruby, G.ruby, G.gold]);
  }

  /* ------------------------------------------------------------------ roundels in the tracery */
  function drawFoil(K, ctx, op, fieldCol, paintFn, R, n, dia) {
    ctx.save(); ctx.clip(op.p);
    K.wheel(op.cx, op.cy, op.R, n || 8, fieldCol, { diaper: dia, rot: 0.3 });
    paintFn();
    ctx.restore();
    K.lead(op, LW * 1.25);
  }
  function tube(cl, w0, w1) { // centreline points -> outline polygon
    const n = cl.length, L = [], Rt = [];
    for (let i = 0; i < n; i++) {
      const a = cl[Math.max(0, i - 1)], b = cl[Math.min(n - 1, i + 1)];
      let nx = -(b[1] - a[1]), ny = b[0] - a[0]; const m = Math.hypot(nx, ny) || 1; nx /= m; ny /= m;
      const t = i / (n - 1), w = lerp(w0, w1, t) * (0.4 + 0.6 * Math.sin(Math.PI * Math.min(1, t * 1.1 + 0.05)));
      L.push([cl[i][0] + nx * w, cl[i][1] + ny * w]); Rt.push([cl[i][0] - nx * w, cl[i][1] - ny * w]);
    }
    return L.concat(Rt.reverse());
  }
  function catmull(pts, seg) {
    const out = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
      for (let k = 0; k < seg; k++) {
        const t = k / seg, t2 = t * t, t3 = t2 * t;
        out.push([0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
          0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3)]);
      }
    }
    out.push(pts[pts.length - 1]);
    return out;
  }

  async function drawTracery(K, ctx, plan, R) {
    const { glass, P } = K;
    const o = plan.ops;
    // the shell of baptism
    drawFoil(K, ctx, o.SL, G.blue, () => {
      const cx = 262, cy = 366;
      const tf = TF(cx, cy, 1.05);
      glass(shape('M 0 -34 C 20 -34, 33 -20, 33 -3 C 33 6, 27 12, 18 15 L 9 22 L -9 22 L -18 15 C -27 12, -33 6, -33 -3 C -33 -20, -20 -34, 0 -34 Z', tf), G.gold, {
        paint: (c, sh) => {
          for (let k = 0; k < 9; k++) { const a = Math.PI + 0.25 + k * (Math.PI - 0.5) / 8; const q0 = tf(0, 18), q1 = tf(Math.cos(a) * 34, 6 + Math.sin(a) * 38); P.tr(`M ${q0[0]} ${q0[1]} L ${q1[0]} ${q1[1]}`, 0.9); }
          P.rshade(sh, cx, cy + 22, 10, 44, 0.0, 0.35);
        },
      });
      glass(shape('M -12 20 L 12 20 L 16 30 L -16 30 Z', tf), G.gold, { paint: () => { const q = tf(0, 25); P.tr(`M ${q[0] - 12} ${q[1]} L ${q[0] + 12} ${q[1]}`, 0.7); } });
      [[0, 44, 4.4], [-10, 56, 3.4], [9, 60, 3.2]].forEach(([x, y, r]) => glass(shape(`M ${x} ${y - r * 2} C ${x + r} ${y - r * 0.6}, ${x + r} ${y + r}, ${x} ${y + r} C ${x - r} ${y + r}, ${x - r} ${y - r * 0.6}, ${x} ${y - r * 2} Z`, tf), G.aqua, { noStreak: true, lw: 2.2 }));
    }, R, 10, 'rose');
    await K.br();
    // the serpent
    drawFoil(K, ctx, o.SR, G.ruby, () => {
      const cl = catmull([[-50, 30], [-30, 44], [0, 46], [26, 34], [32, 10], [16, -8], [-8, -6], [-18, 10], [-6, 24], [12, 18], [14, -4], [4, -22], [-4, -36], [8, -44]].map(([x, y]) => [818 + x, 372 + y]), 8);
      glass(poly(tube(cl, 4.5, 10.5)), G.green, {
        paint: () => { for (let i = 4; i < cl.length - 6; i += 3) { const q = cl[i]; ctx.beginPath(); ctx.arc(q[0], q[1], 3.2, 0, Math.PI); ctx.lineWidth = 0.6; ctx.strokeStyle = TRACE; ctx.stroke(); } P.mat(new Path2D(cl.map((q, i) => (i ? 'L ' : 'M ') + q[0].toFixed(1) + ' ' + (q[1] + 3).toFixed(1)).join(' ')), 4, 0.4); },
      });
      glass(shape('M 3 -45 C 10 -53, 22 -54, 33 -45 L 35 -42 C 26 -37, 14 -34, 5 -37 Z', TF(818, 372)), G.green, { paint: () => { ctx.save(); ctx.beginPath(); ctx.ellipse(837, 326.5, 2.4, 1.3, -0.25, 0, Math.PI * 2); ctx.fillStyle = 'rgba(240,200,60,0.95)'; ctx.fill(); ctx.restore(); P.tr('M 837 325 L 837.6 328', 0.8); P.tr('M 853 330 L 862 330 L 866 327 M 862 330 L 866 333', 0.9); P.mat('M 824 332 C 832 335, 842 334, 851 331', 3, 0.5); P.tr('M 826 323 C 832 321, 838 321, 844 323', 0.7, 0.6); } });
    }, R, 10, 'scale');
    await K.br();
    // the dropped hat
    ctx.save(); ctx.clip(o.T.p);
    glass(poly([[470, 50], [610, 50], [612, 124], [468, 128]]), [220, 184, 112], { v: 0.6, edgeA: 0.2, noLead: true });
    glass(poly([[468, 128], [612, 124], [610, 190], [470, 190]]), [214, 172, 100], { v: 0.6, edgeA: 0.2, noLead: true });
    SCENES.hat.paint(localPaint(P, ctx, TF(540, 121, 1.0)));
    ctx.beginPath(); ctx.moveTo(468, 128); ctx.lineTo(612, 124); ctx.strokeStyle = LEAD; ctx.lineWidth = 2.6; ctx.stroke();
    ctx.restore(); K.lead(o.T, LW * 1.25);
    await K.br();
    // small trefoils: vine leaves
    [o.TL, o.TR].forEach((op, i) => drawFoil(K, ctx, op, G.ruby, () => {
      const cx = op.cx, cy = op.cy + 2;
      const leaf = (a) => { const tf = TF(cx, cy, 1, a); return shape('M 0 0 C 8 -6, 10 -18, 0 -30 C -10 -18, -8 -6, 0 0 Z', tf); };
      [0, 2.09, -2.09].forEach((a) => glass(leaf(a + Math.PI), i ? G.green : G.gold, { paint: () => { const tf = TF(cx, cy, 1, a + Math.PI); const q0 = tf(0, -2), q1 = tf(0, -26); P.tr(`M ${q0[0]} ${q0[1]} L ${q1[0]} ${q1[1]}`, 0.7); } }));
      glass(circ(cx, cy, 5), G.white, { noStreak: true });
    }, R, 6, 'dots'));
    [o.EL, o.ER].forEach((op) => drawFoil(K, ctx, op, G.blue, () => {
      glass(circ(op.cx, op.cy, 7.5), G.goldP, { noStreak: true, paint: () => P.dot(op.cx, op.cy, 2) });
    }, R, 4));
  }

  /* ------------------------------------------------------------------ stone */
  function drawWall(ctx, R) {
    ctx.fillStyle = '#131110'; ctx.fillRect(0, 0, W, H);
    // ashlar
    for (let y = 0, row = 0; y < FLOOR_Y; y += 46, row++) {
      for (let x = (row % 2) * -48 - 10; x < W; x += 96) {
        const t = 0.9 + hash2(x + 300, row) * 0.2;
        ctx.fillStyle = rgb(mulc([24, 21, 19], t)); ctx.fillRect(x + 1, y + 1, 94, 44);
      }
    }
    ctx.fillStyle = 'rgba(0,0,0,0.0)';
  }
  function drawWindowStone(ctx, plan) {
    const outer = plan.outer;
    // hood mould
    const hood = archHead(OUTER.x0 - 92, OUTER.x1 + 92, OUTER.ys, OUTER.ya - 92 * 1.0);
    const hp = new Path2D(); hood.pts.forEach((q, i) => (i ? hp.lineTo(q.p[0], q.p[1]) : hp.moveTo(q.p[0], q.p[1])));
    ctx.lineCap = 'butt';
    ctx.strokeStyle = '#0b0a09'; ctx.lineWidth = 16; ctx.stroke(hp);
    ctx.strokeStyle = '#2a2420'; ctx.lineWidth = 11; ctx.stroke(hp);
    ctx.strokeStyle = '#3a322b'; ctx.lineWidth = 3; ctx.save(); ctx.translate(0, -3); ctx.stroke(hp); ctx.restore();
    // label stops
    [[OUTER.x0 - 92, OUTER.ys], [OUTER.x1 + 92, OUTER.ys]].forEach(([x, y]) => {
      ctx.fillStyle = '#231e1a'; ctx.beginPath(); ctx.moveTo(x - 10, y); ctx.lineTo(x + 10, y); ctx.lineTo(x + 7, y + 22); ctx.quadraticCurveTo(x, y + 30, x - 7, y + 22); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#3a322b'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(x - 6, y + 8); ctx.quadraticCurveTo(x, y + 14, x + 6, y + 8); ctx.stroke();
    });
    // reveal: mouldings stepping in towards the glass
    const bands = [[86, '#0d0b0a'], [82, '#241f1b'], [78, '#110f0d'], [70, '#1a1714'], [64, '#3a322c'], [60, '#28231e'], [56, '#100e0c']];
    ctx.lineJoin = 'round';
    bands.forEach(([d, c]) => { ctx.strokeStyle = c; ctx.lineWidth = d * 2; ctx.stroke(outer.p); });
    for (let d = 54; d >= 8; d -= 2) {
      const t = (54 - d) / 46;
      ctx.strokeStyle = rgb(mixc([22, 19, 17], [66, 56, 48], Math.pow(t, 1.8))); ctx.lineWidth = d * 2; ctx.stroke(outer.p);
    }
    ctx.strokeStyle = '#0a0908'; ctx.lineWidth = 12; ctx.stroke(outer.p);
    // tracery stone
    const g = ctx.createLinearGradient(0, 40, 0, 905);
    g.addColorStop(0, '#1d1916'); g.addColorStop(1, '#25201c');
    ctx.fillStyle = g; ctx.fill(outer.p);
  }
  function drawChamfers(ctx, plan) {
    const ops = Object.values(plan.ops);
    ctx.save(); ctx.clip(plan.outer.p);
    ops.forEach((op) => { ctx.lineJoin = 'round'; ctx.strokeStyle = '#141210'; ctx.lineWidth = 15; ctx.stroke(op.p); });
    ops.forEach((op) => { ctx.strokeStyle = '#2e2823'; ctx.lineWidth = 11.5; ctx.stroke(op.p); });
    ops.forEach((op) => { ctx.strokeStyle = '#4a4037'; ctx.lineWidth = 7; ctx.stroke(op.p); });
    // circular frames round the roundels
    ['SL', 'SR', 'T', 'TL', 'TR', 'EL', 'ER'].forEach((k) => {
      const op = plan.ops[k];
      ctx.beginPath(); ctx.arc(op.cx, op.cy, op.R + 6, 0, Math.PI * 2); ctx.strokeStyle = '#191613'; ctx.lineWidth = 3; ctx.stroke();
      ctx.beginPath(); ctx.arc(op.cx, op.cy, op.R + 8.5, 0, Math.PI * 2); ctx.strokeStyle = 'rgba(90,78,66,0.55)'; ctx.lineWidth = 1.4; ctx.stroke();
    });
    ops.forEach((op) => { ctx.strokeStyle = 'rgba(120,104,88,0.22)'; ctx.lineWidth = 9; ctx.stroke(op.p); });
    ops.forEach((op) => { ctx.strokeStyle = '#4a4037'; ctx.lineWidth = 7.4; ctx.stroke(op.p); });
    // joints where one carved block of tracery meets the next: across the narrowest stone between openings
    const samp = (pts, n) => { const out = []; const st = Math.max(1, Math.floor(pts.length / n)); for (let i = 0; i < pts.length; i += st) out.push(pts[i]); return out; };
    const all = ops.map((op) => samp(op.pts, 160)).concat([samp(plan.outer.pts, 400)]);
    ctx.lineCap = 'butt';
    for (let a = 0; a < all.length; a++) {
      for (let b = a + 1; b < all.length; b++) {
        let best = 1e9, pa = null, pb = null;
        for (const p of all[a]) for (const q of all[b]) { const d = (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2; if (d < best) { best = d; pa = p; pb = q; } }
        const d = Math.sqrt(best);
        if (d > 46 || d < 4) continue;
        if (b === all.length - 1 && pa[1] > 600) continue;
        const ex = (pb[0] - pa[0]) / d, ey = (pb[1] - pa[1]) / d;
        ctx.beginPath(); ctx.moveTo(pa[0] - ex * 2, pa[1] - ey * 2); ctx.lineTo(pb[0] + ex * 2, pb[1] + ey * 2);
        ctx.strokeStyle = 'rgba(8,7,6,0.75)'; ctx.lineWidth = 1.1; ctx.stroke();
        ctx.beginPath(); ctx.moveTo(pa[0] - ex * 2 + 0.9, pa[1] - ey * 2 + 0.9); ctx.lineTo(pb[0] + ex * 2 + 0.9, pb[1] + ey * 2 + 0.9);
        ctx.strokeStyle = 'rgba(110,96,82,0.18)'; ctx.lineWidth = 0.7; ctx.stroke();
      }
    }
    // mason's joints in the mullions
    ctx.strokeStyle = 'rgba(10,9,8,0.7)'; ctx.lineWidth = 1;
    [[330, 356], [724, 750], [110, 122], [958, 970]].forEach(([a, b]) => {
      for (let y = 640; y < 900; y += 66) { ctx.beginPath(); ctx.moveTo(a, y); ctx.lineTo(b, y); ctx.stroke(); }
    });
    ctx.restore();
  }
  function saddleBars(ctx, plan) {
    const bar = (x0, x1, y) => {
      ctx.fillStyle = '#0b0a09'; ctx.fillRect(x0 - 8, y - 2.1, x1 - x0 + 16, 4.2);
      ctx.fillStyle = 'rgba(80,70,60,0.35)'; ctx.fillRect(x0 - 8, y - 2.1, x1 - x0 + 16, 0.8);
    };
    bar(356, 724, 470); bar(356, 724, 772);
    bar(122, 330, 720); bar(750, 958, 720);
    bar(122, 330, 548); bar(750, 958, 548);
  }

  /* ------------------------------------------------------------------ the interior */
  const proj = (X, Y, Z) => [CX + F * X / Z, HZ + F * (EYE - Y) / Z];
  const FONT = { X: 0.6, Z: 11.2 };
  const STAND = { X: -1.75, Z: 9.05 };
  const LAMP = { x: 737, y: 884 };
  const PEW_X0 = 1.7, PEW_ROWS = [5.6, 6.8, 8.0, 9.2, 10.4, 11.6, 12.8, 14.0, 15.2];

  function makeOccluders() {
    const occ = [];
    occ.push({ c: 1, cx: FONT.X, cz: FONT.Z, r: 0.52, y0: 0.66, y1: 1.0 });
    occ.push({ c: 1, cx: FONT.X, cz: FONT.Z, r: 0.2, y0: 0.2, y1: 0.66 });
    occ.push({ c: 1, cx: FONT.X, cz: FONT.Z, r: 0.42, y0: 0.08, y1: 0.2 });
    PEW_ROWS.forEach((z) => {
      occ.push({ c: 0, x0: PEW_X0, x1: 12, y0: 0.4, y1: 0.98, z0: z - 0.08, z1: z + 0.52 });
      occ.push({ c: 0, x0: PEW_X0 - 0.04, x1: PEW_X0 + 0.05, y0: 0, y1: 1.02, z0: z - 0.12, z1: z + 0.55 });
    });
    return occ;
  }
  // fraction of a ray from point (X,Y,Z) toward the window (direction (-a, 1, b) per unit height) that is blocked
  function blocked(occ, X, Y, Z, a, b) {
    for (let i = 0; i < occ.length; i++) {
      const o = occ[i];
      if (o.c) {
        const dx = X - o.cx, dz = Z - o.cz;
        const A = a * a + b * b, B = 2 * (-a * dx + b * dz), C = dx * dx + dz * dz - o.r * o.r;
        const disc = B * B - 4 * A * C;
        if (disc <= 0) continue;
        const sq = Math.sqrt(disc), t1 = (-B - sq) / (2 * A), t2 = (-B + sq) / (2 * A);
        const lo = Math.max(t1, o.y0 - Y, 0), hi = Math.min(t2, o.y1 - Y);
        if (hi > lo) return true;
      } else {
        if (X < o.x0 - 0.01 && a >= 0) continue;
        let lo = Math.max(0, o.y0 - Y), hi = o.y1 - Y;
        const tz0 = (o.z0 - Z) / b, tz1 = (o.z1 - Z) / b;
        lo = Math.max(lo, tz0); hi = Math.min(hi, tz1);
        if (hi <= lo) continue;
        if (a > 0) { lo = Math.max(lo, (X - o.x1) / a); hi = Math.min(hi, (X - o.x0) / a); } else if (X < o.x0 || X > o.x1) continue;
        if (hi > lo) return true;
      }
    }
    return false;
  }

  // the light that reaches a point (X,Y,Z) through the window: linear RGB, 0..~1
  function makeBeam(lightImgs, sun) {
    const { w, h, x0, y0, sc, A, B } = lightImgs;
    const toLin = new Float32Array(256); for (let i = 0; i < 256; i++) toLin[i] = Math.pow(i / 255, 2.2);
    return function (X, Y, Z, out, sharp) {
      const Yw = Y + (Z0 - Z) / sun.b, Xw = X - sun.a * (Z0 - Z) / sun.b;
      const xw = CX + Xw * S, yw = HZ - (Yw - EYE) * S;
      const u = (xw - x0) * sc - 0.5, v = (yw - y0) * sc - 0.5;
      if (u < 0 || v < 0 || u >= w - 1 || v >= h - 1) { out[0] = out[1] = out[2] = 0; return; }
      const iu = u | 0, iv = v | 0, fu = u - iu, fv = v - iv;
      const m = sharp ? 0 : clamp((Yw - 1) / 9, 0, 1);
      const i00 = (iv * w + iu) * 4, i10 = i00 + 4, i01 = i00 + w * 4, i11 = i01 + 4;
      for (let k = 0; k < 3; k++) {
        const a = toLin[A[i00 + k]] * (1 - fu) * (1 - fv) + toLin[A[i10 + k]] * fu * (1 - fv) + toLin[A[i01 + k]] * (1 - fu) * fv + toLin[A[i11 + k]] * fu * fv;
        const b = toLin[B[i00 + k]] * (1 - fu) * (1 - fv) + toLin[B[i10 + k]] * fu * (1 - fv) + toLin[B[i01 + k]] * (1 - fu) * fv + toLin[B[i11 + k]] * fu * fv;
        out[k] = a + (b - a) * m;
      }
    };
  }

  function drawDado(ctx) {
    // sill, string course, blind arcade, plinth
    const g = ctx.createLinearGradient(0, 905, 0, 1000);
    g.addColorStop(0, '#1d1916'); g.addColorStop(1, '#0f0d0c');
    ctx.fillStyle = g; ctx.fillRect(0, 905, W, FLOOR_Y - 905);
    const sg = ctx.createLinearGradient(0, 905, 0, 918);
    sg.addColorStop(0, '#5a4e43'); sg.addColorStop(1, '#221d19');
    ctx.fillStyle = sg; ctx.fillRect(30, 905, 1020, 13);
    ctx.fillStyle = '#0c0b0a'; ctx.fillRect(0, 918, W, 3);
    ctx.fillStyle = '#2a241f'; ctx.fillRect(0, 921, W, 4);
    for (let k = -1; k < 19; k++) {
      const x = k * 60 + 10;
      ctx.fillStyle = '#0d0c0b';
      ctx.beginPath(); ctx.moveTo(x + 8, 994); ctx.lineTo(x + 8, 948); ctx.quadraticCurveTo(x + 8, 934, x + 30, 930); ctx.quadraticCurveTo(x + 52, 934, x + 52, 948); ctx.lineTo(x + 52, 994); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(70,60,52,0.4)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x + 6, 994); ctx.lineTo(x + 6, 948); ctx.quadraticCurveTo(x + 6, 932, x + 30, 928); ctx.stroke();
      ctx.fillStyle = '#1e1a17'; ctx.fillRect(x - 3, 940, 6, 56);
    }
    ctx.fillStyle = '#191614'; ctx.fillRect(0, 990, W, 10);
    ctx.fillStyle = 'rgba(80,70,60,0.35)'; ctx.fillRect(0, 990, W, 1);
  }

  async function floorPass(ctx, scale, sun, beam, occ, breathe) {
    const cw = ctx.canvas.width, ch = ctx.canvas.height;
    const y0 = Math.floor(FLOOR_Y * scale);
    const tmp = [0, 0, 0];
    const invG = 1 / 2.2;
    const SL = 0.9; // slab size, m
    const offs = [[0, 0], [0.012, 0.01], [-0.012, -0.01], [0.006, -0.014]];
    const CH = Math.max(4, Math.floor(16000 / cw) * 2);
    for (let yb = y0; yb < ch; yb += CH) {
      const hh = Math.min(CH, ch - yb);
      const img = ctx.createImageData(cw, hh), D = img.data;
      for (let j = 0; j < hh; j++) {
        const y = (yb + j + 0.5) / scale;
        const Z = F * EYE / (y - HZ);
        const pxw = Z / (F * scale), pzw = Z * Z / (F * EYE * scale);
        const r = Math.floor(Z / SL), fz = Z / SL - r, off = (r & 1) ? 0.45 : 0;
        const jzp = Math.min(fz, 1 - fz) * SL / pzw;
        const jhw = Math.max(0.5, 0.006 / pzw), jhx = Math.max(0.5, 0.006 / pxw);
        const jfadeZ = clamp(0.006 / pzw / 0.6, 0.25, 1), jfadeX = clamp(0.006 / pxw / 0.6, 0.25, 1);
        const depthDark = clamp(1 - (y - 1180) / 520, 0.55, 1);
        for (let i = 0; i < cw; i++) {
          const x = (i + 0.5) / scale;
          const X = (x - CX) * Z / F;
          const cxi = Math.floor((X + off) / SL), fx = (X + off) / SL - cxi;
          const jxp = Math.min(fx, 1 - fx) * SL / pxw;
          const tone = 0.86 + hash2(cxi * 7 + 3, r * 13 + 1) * 0.22;
          let jt = Math.max(clamp(1 - (jzp - jhw), 0, 1) * jfadeZ, clamp(1 - (jxp - jhx), 0, 1) * jfadeX);
          let alb = 0.30 * tone * (1 - 0.55 * jt);
          // an old ledger stone let into the floor: a cross and a worn inscription
          if (X > -1.2 && X < -0.3 && Z > 7.15 && Z < 8.85) {
            const dx = Math.min(X + 1.2, -0.3 - X), dz = Math.min(Z - 7.15, 8.85 - Z), xc = X + 0.75;
            const lx = (d, hw) => clamp((hw - Math.abs(d)) / pxw + 0.5, 0, 1), lz = (d, hw) => clamp((hw - Math.abs(d)) / pzw + 0.5, 0, 1);
            let cov = 0;
            if (dz > 0.066) cov = Math.max(cov, lx(dx - 0.075, 0.009));
            if (dx > 0.066) cov = Math.max(cov, lz(dz - 0.075, 0.009));
            if (Z > 7.62 && Z < 8.66) cov = Math.max(cov, lx(xc, 0.014));
            if (Math.abs(xc) < 0.2) cov = Math.max(cov, lz(Z - 8.36, 0.014));
            for (const row of [7.34, 7.46]) if (Math.abs(xc) < 0.28 && hash2(Math.floor((xc + 1) / 0.034), row * 100) > 0.22) cov = Math.max(cov, lz(Z - row, 0.022) * 0.8);
            alb = (0.12 + hash2(3, 7) * 0.02) * (1 + 0.9 * cov) * (dx < 0.012 || dz < 0.012 ? 0.4 : 1);
          }
          // light through the window
          let vis = 0;
          for (let s = 0; s < 4; s++) if (!blocked(occ, X, 0, Z, sun.a + offs[s][0], sun.b + offs[s][1])) vis += 0.25;
          let lr = 0, lg = 0, lb = 0;
          if (vis > 0) { beam(X, 0, Z, tmp); lr = tmp[0] * vis; lg = tmp[1] * vis; lb = tmp[2] * vis; }
          // candle warmth and the general dark
          const dx = X - STAND.X, dz = Z - STAND.Z, d2 = dx * dx + dz * dz;
          const cw2 = 0.05 / (0.35 + d2 * 1.4);
          const amb = 0.012 * depthDark;
          const K = 1.25;
          let R1 = alb * (amb * 0.9 + K * lr + cw2 * 1.0);
          let G1 = alb * (amb * 0.95 + K * lg + cw2 * 0.62);
          let B1 = alb * (amb * 1.15 + K * lb + cw2 * 0.3);
          const o = (j * cw + i) * 4;
          const dn = (hash2(i, yb + j) - 0.5) * 1.2;
          D[o] = clamp(255 * Math.pow(R1, invG) + dn, 0, 255);
          D[o + 1] = clamp(255 * Math.pow(G1, invG) + dn, 0, 255);
          D[o + 2] = clamp(255 * Math.pow(B1, invG) + dn, 0, 255);
          D[o + 3] = 255;
        }
      }
      ctx.putImageData(img, 0, yb);
      await breathe();
    }
  }

  // dust in the air: march each view ray through the slanting beam and gather a little of its colour
  async function hazePass(ctx, beam, scale, breathe) {
    const div = 4, cw = ctx.canvas.width, ch = ctx.canvas.height;
    const w = Math.ceil(cw / div), h = Math.ceil(ch / div);
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const x = c.getContext('2d', { willReadFrequently: true });
    const img = x.createImageData(w, h), D = img.data, tmp = [0, 0, 0];
    const NS = 20, ZN = 6.5, DENS = 0.05;
    for (let j = 0; j < h; j++) {
      const y = (j + 0.5) * div / scale, dy = -(y - HZ) / F;
      const zmax = dy < 0 ? Math.min(Z0, EYE / -dy) : Z0;
      for (let i = 0; i < w; i++) {
        const dx = ((i + 0.5) * div / scale - CX) / F;
        let r = 0, g = 0, b = 0;
        if (zmax > ZN) {
          for (let k = 0; k < NS; k++) {
            const Z = ZN + (zmax - ZN) * (k + 0.5) / NS;
            beam(dx * Z, EYE + dy * Z, Z, tmp);
            r += tmp[0]; g += tmp[1]; b += tmp[2];
          }
        }
        const kk = Math.max(0, zmax - ZN) / NS * DENS, o = (j * w + i) * 4;
        D[o] = 255 * Math.pow(Math.min(1, r * kk), 0.75); D[o + 1] = 255 * Math.pow(Math.min(1, g * kk), 0.75); D[o + 2] = 255 * Math.pow(Math.min(1, b * kk), 0.75); D[o + 3] = 255;
      }
      if (j % 6 === 5) await breathe();
    }
    x.putImageData(img, 0, 0);
    const c2 = document.createElement('canvas'); c2.width = w; c2.height = h;
    const x2 = c2.getContext('2d', { willReadFrequently: true }); x2.filter = 'blur(1.5px)'; x2.drawImage(c, 0, 0); x2.filter = 'none';
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'screen'; ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(c2, 0, 0, cw, ch); ctx.restore();
  }

  // shade helper for interior surfaces: base colour (sRGB) under ambient + optional light
  function litColour(base, light, amb) {
    const out = [0, 0, 0];
    for (let k = 0; k < 3; k++) {
      const b = Math.pow(base[k] / 255, 2.2);
      out[k] = 255 * Math.pow(clamp(b * (amb[k] + light[k]), 0, 1), 1 / 2.2);
    }
    return out;
  }

  function drawPew(ctx, z, beam, occ, sun) {
    const x0 = PEW_X0, x1 = 12, P = proj;
    const fill = (pts, col) => { ctx.beginPath(); pts.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]))); ctx.closePath(); ctx.fillStyle = col; ctx.fill(); };
    const strokeP = (pts, col, w) => { ctx.beginPath(); pts.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]))); ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineJoin = 'round'; ctx.stroke(); };
    const wood = [100, 64, 40];
    const L = (light, amb) => rgb(litColour(wood, light, amb));
    const tmp = [0, 0, 0];
    // the aisle floor beside the pew throws a little of the window's colour back up at it
    beam(x0 - 0.7, 0, z - 0.3, tmp);
    const bounce = [tmp[0] * 0.3, tmp[1] * 0.3, tmp[2] * 0.3];
    const ambF = [0.045 + bounce[0], 0.042 + bounce[1], 0.046 + bounce[2]], ambTop = [0.1, 0.09, 0.09];
    // contact shadow on the floor
    fill([P(x0 - 0.08, 0, z - 0.16), P(x1, 0, z - 0.16), P(x1, 0, z + 0.6), P(x0 - 0.08, 0, z + 0.6)], 'rgba(0,0,0,0.38)');
    // seat, back, rail, ledge
    fill([P(x0, 0.46, z + 0.06), P(x1, 0.46, z + 0.06), P(x1, 0.46, z + 0.52), P(x0, 0.46, z + 0.52)], L([0, 0, 0], ambTop));
    const bt = P(x0, 0.98, z), bb = P(x0, 0.42, z);
    const g = ctx.createLinearGradient(0, bt[1], 0, bb[1]);
    g.addColorStop(0, L([0, 0, 0], [0.07, 0.064, 0.066])); g.addColorStop(1, L([0, 0, 0], [0.03, 0.028, 0.03]));
    fill([P(x0, 0.42, z), P(x1, 0.42, z), P(x1, 0.98, z), P(x0, 0.98, z)], g);
    for (let X = x0 + 0.5; X < 7; X += 0.5) {
      strokeP([P(X, 0.47, z), P(X, 0.9, z)], 'rgba(0,0,0,0.5)', 0.9);
      strokeP([P(X + 0.02, 0.47, z), P(X + 0.02, 0.9, z)], 'rgba(150,110,80,0.12)', 0.6);
    }
    strokeP([P(x0, 0.92, z), P(x1, 0.92, z)], 'rgba(0,0,0,0.5)', 0.8);
    fill([P(x0, 0.8, z - 0.13), P(x1, 0.8, z - 0.13), P(x1, 0.8, z), P(x0, 0.8, z)], L([0, 0, 0], ambTop));
    fill([P(x0, 0.77, z - 0.13), P(x1, 0.77, z - 0.13), P(x1, 0.8, z - 0.13), P(x0, 0.8, z - 0.13)], L([0, 0, 0], [0.05, 0.046, 0.05]));
    for (let X = x0; X < 7; X += 0.04) {
      let col = [0, 0, 0];
      if (!blocked(occ, X, 1.0, z + 0.02, sun.a, sun.b)) { beam(X, 1.0, z + 0.03, tmp); col = tmp.slice(); }
      fill([P(X, 1.0, z + 0.05), P(X + 0.045, 1.0, z + 0.05), P(X + 0.045, 0.975, z), P(X, 0.975, z)], L([col[0] * 1.6, col[1] * 1.6, col[2] * 1.6], ambTop));
    }
    // the pew end: an oak board with a pointed, recessed panel; we see its aisle face and its front edge
    const xa = x0 - 0.05, e = (Zz, Y) => P(xa, Y, Zz);
    const zf = z - 0.14, zb = z + 0.56, zm = (zf + zb) / 2;
    const outline = [e(zf, 0), e(zf, 0.95), e(zf + 0.015, 0.99), e(zf + 0.05, 1.005), e(zb - 0.04, 0.99), e(zb, 0.965), e(zb, 0)];
    const eg = ctx.createLinearGradient(0, outline[3][1], 0, outline[0][1]);
    eg.addColorStop(0, L([0, 0, 0], [ambF[0] * 1.5, ambF[1] * 1.5, ambF[2] * 1.5])); eg.addColorStop(1, L([0, 0, 0], [ambF[0] * 2.3, ambF[1] * 2.3, ambF[2] * 2.3]));
    fill(outline, eg);
    fill([P(xa, 0, zf), P(xa, 0.95, zf), P(x0 + 0.03, 0.95, zf), P(x0 + 0.03, 0, zf)], L([0, 0, 0], [ambF[0] * 2.6, ambF[1] * 2.6, ambF[2] * 2.6]));
    const pa = [e(zf + 0.1, 0.12), e(zf + 0.1, 0.66)];
    for (let k = 0; k <= 10; k++) { const t = k / 10; pa.push(e(lerp(zf + 0.1, zm, t), 0.66 + 0.16 * Math.sin(t * Math.PI / 2))); }
    for (let k = 1; k <= 10; k++) { const t = k / 10; pa.push(e(lerp(zm, zb - 0.1, t), 0.82 - 0.16 * (1 - Math.cos(t * Math.PI / 2)))); }
    pa.push(e(zb - 0.1, 0.12));
    fill(pa, 'rgba(0,0,0,0.22)');
    strokeP(pa.concat([pa[0]]), 'rgba(0,0,0,0.6)', 1.0);
    ctx.save(); ctx.translate(0.7, 0.8); strokeP(pa.slice(0, 12), 'rgba(170,130,96,0.16)', 0.8); ctx.restore();
    // the end's top edge, lit if the window reaches it
    const ttop = [e(zf + 0.015, 0.99), e(zf + 0.05, 1.005), e(zb - 0.04, 0.99)];
    let col = [0, 0, 0];
    if (!blocked(occ, x0 - 0.06, 1.04, z + 0.1, sun.a, sun.b)) { beam(x0, 1.04, z + 0.1, tmp); col = tmp.slice(); }
    strokeP(ttop, L([col[0] * 1.8 + 0.03, col[1] * 1.8 + 0.03, col[2] * 1.8 + 0.03], [0.1, 0.09, 0.09]), 1.8);
    strokeP(outline.slice(1, 6), 'rgba(160,120,90,0.18)', 0.7);
  }

  function drawFont3D(ctx, beam, occ, sun) {
    const { X: fx, Z: fz } = FONT;
    const oct = (r, Y) => { const out = []; for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4 + Math.PI / 8; out.push([fx + Math.cos(a) * r, Y, fz + Math.sin(a) * r]); } return out; };
    const marble = [226, 220, 210];
    const camV = (P3) => [0 - P3[0], EYE - P3[1], 0 - P3[2]];
    const tmp = [0, 0, 0];
    // what lies behind the font, glowing: the rim light on its edges
    const rimC = [0, 0, 0];
    for (let k = 0; k < 7; k++) { beam(fx + (k - 3) * 0.25, 0, fz + 1.6, tmp); rimC[0] += tmp[0] / 7; rimC[1] += tmp[1] / 7; rimC[2] += tmp[2] / 7; }
    const RV = mulberry32(911);
    function prism(r0, r1, ya, yb, amb) {
      const A = oct(r0, ya), B = oct(r1, yb);
      const faces = [];
      for (let k = 0; k < 8; k++) {
        const k2 = (k + 1) % 8;
        const mx = (A[k][0] + A[k2][0]) / 2 - fx, mz = (A[k][2] + A[k2][2]) / 2 - fz;
        const cv = camV([fx + mx, (ya + yb) / 2, fz + mz]);
        if (mx * cv[0] + mz * cv[2] <= 0) continue;
        faces.push({ k, k2, mx, mz, depth: fz + mz });
      }
      faces.sort((p, q) => q.depth - p.depth);
      faces.forEach((f) => {
        const pts = [A[f.k], A[f.k2], B[f.k2], B[f.k]].map((q) => proj(q[0], q[1], q[2]));
        const m = Math.hypot(f.mx, f.mz), nx = f.mx / m, nz = f.mz / m;
        const cv = camV([fx + f.mx, (ya + yb) / 2, fz + f.mz]), cm = Math.hypot(cv[0], cv[2]);
        const facing = clamp((nx * cv[0] + nz * cv[2]) / cm, 0, 1), rimW = Math.pow(1 - facing, 2.2) * 1.1;
        // faces turned toward the candles (left) are warmer; faces seen edge-on carry the window's light round
        const warm = clamp(-nx, 0, 1) * 0.07;
        const col = litColour(marble, [warm + rimC[0] * rimW, warm * 0.6 + rimC[1] * rimW, warm * 0.3 + rimC[2] * rimW], amb);
        const path = new Path2D(); pts.forEach((q, i) => (i ? path.lineTo(q[0], q[1]) : path.moveTo(q[0], q[1]))); path.closePath();
        const g = ctx.createLinearGradient(0, pts[2][1], 0, pts[0][1]);
        g.addColorStop(0, rgb(mulc(col, 1.06))); g.addColorStop(1, rgb(mulc(col, 0.7)));
        ctx.fillStyle = g; ctx.fill(path);
        ctx.save(); ctx.clip(path);
        for (let v = 0; v < 2; v++) {
          const y0 = lerp(pts[2][1], pts[0][1], RV()), y1 = lerp(pts[2][1], pts[0][1], RV());
          ctx.beginPath(); ctx.moveTo(pts[0][0] - 2, y0); ctx.bezierCurveTo(lerp(pts[0][0], pts[1][0], 0.3), y0 + (RV() - 0.5) * 12, lerp(pts[0][0], pts[1][0], 0.7), y1 + (RV() - 0.5) * 12, pts[1][0] + 2, y1);
          ctx.strokeStyle = v ? 'rgba(255,248,236,0.05)' : 'rgba(40,36,34,0.06)'; ctx.lineWidth = 0.4 + RV() * 0.5; ctx.stroke();
        }
        ctx.restore();
        ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 0.5; ctx.stroke(path);
        ctx.strokeStyle = 'rgba(255,244,228,0.1)'; ctx.lineWidth = 0.7; ctx.beginPath(); ctx.moveTo(pts[1][0], pts[1][1]); ctx.lineTo(pts[2][0], pts[2][1]); ctx.stroke();
      });
      return faces;
    }
    function topCap(r, Y, colFn) {
      const A = oct(r, Y).map((q) => proj(q[0], q[1], q[2]));
      ctx.beginPath(); A.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]))); ctx.closePath();
      ctx.fillStyle = colFn; ctx.fill();
    }
    const amb = [0.065, 0.066, 0.075];
    // a soft contact shadow, then the step
    const c0 = proj(fx, 0, fz), sr = 0.95 * F / fz;
    const cs = ctx.createRadialGradient(c0[0], c0[1], sr * 0.4, c0[0], c0[1], sr);
    cs.addColorStop(0, 'rgba(0,0,0,0.5)'); cs.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.save(); ctx.translate(c0[0], c0[1]); ctx.scale(1, 0.16); ctx.translate(-c0[0], -c0[1]); ctx.fillStyle = cs; ctx.fillRect(c0[0] - sr, c0[1] - sr, sr * 2, sr * 2); ctx.restore();
    prism(0.66, 0.66, 0, 0.1, amb);
    let lit = [0, 0, 0]; beam(fx, 0.1, fz - 0.5, tmp); if (!blocked(occ, fx, 0.11, fz - 0.55, sun.a, sun.b)) lit = tmp.slice();
    topCap(0.66, 0.1, rgb(litColour(marble, lit.map((v) => v * 0.6 + 0.02), amb)));
    prism(0.44, 0.4, 0.1, 0.2, amb);
    topCap(0.4, 0.2, rgb(litColour(marble, [0.03, 0.03, 0.03], amb)));
    prism(0.32, 0.26, 0.2, 0.28, amb);
    topCap(0.26, 0.28, rgb(litColour(marble, [0.03, 0.03, 0.03], amb)));
    prism(0.17, 0.17, 0.28, 0.58, amb);
    prism(0.23, 0.23, 0.56, 0.62, amb);
    // bowl underside then the bowl and its lip
    prism(0.23, 0.5, 0.62, 0.74, [0.03, 0.03, 0.036]);
    const faces = prism(0.5, 0.5, 0.74, 0.95, amb);
    prism(0.535, 0.535, 0.95, 1.0, amb);
    // carved quatrefoils on the visible bowl faces
    faces.forEach((f) => {
      const a0 = f.k * Math.PI / 4 + Math.PI / 8, a1 = a0 + Math.PI / 4, am = (a0 + a1) / 2;
      const cxw = fx + Math.cos(am) * 0.465, czw = fz + Math.sin(am) * 0.465;
      const tx = -Math.sin(am), tz = Math.cos(am);
      ctx.beginPath();
      for (let k = 0; k <= 64; k++) {
        const t = k / 64 * Math.PI * 2;
        const rr = 0.075 * (0.78 + 0.22 * Math.abs(Math.cos(2 * t)));
        const u = Math.cos(t) * rr, v = Math.sin(t) * rr;
        const q = proj(cxw + tx * u, 0.845 + v, czw + tz * u);
        if (k) ctx.lineTo(q[0], q[1]); else ctx.moveTo(q[0], q[1]);
      }
      ctx.closePath(); ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.fill();
      ctx.strokeStyle = 'rgba(255,240,220,0.08)'; ctx.lineWidth = 0.7; ctx.stroke();
    });
    topCap(0.535, 1.0, rgb(litColour(marble, [0.05, 0.045, 0.04], amb)));
    // rim: catches the coloured light in a thin line
    const rim = oct(0.535, 1.0);
    for (let k = 0; k < 8; k++) {
      const k2 = (k + 1) % 8;
      const n = 6;
      for (let s = 0; s < n; s++) {
        const t0 = s / n, t1 = (s + 1) / n;
        const p0 = [lerp(rim[k][0], rim[k2][0], t0), 1.0, lerp(rim[k][2], rim[k2][2], t0)];
        const p1 = [lerp(rim[k][0], rim[k2][0], t1), 1.0, lerp(rim[k][2], rim[k2][2], t1)];
        const pm = [(p0[0] + p1[0]) / 2, 1.0, (p0[2] + p1[2]) / 2];
        let c = [0.02, 0.02, 0.02];
        beam(pm[0], pm[1], pm[2], tmp); c = [tmp[0] * 1.8 + 0.03, tmp[1] * 1.8 + 0.03, tmp[2] * 1.8 + 0.03];
        const q0 = proj(p0[0], p0[1], p0[2]), q1 = proj(p1[0], p1[1], p1[2]);
        ctx.strokeStyle = rgb(litColour(marble, c, amb)); ctx.lineWidth = 2.2; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(q0[0], q0[1]); ctx.lineTo(q1[0], q1[1]); ctx.stroke();
      }
    }
    // water: a dark sliver holding a reflection of the window
    const wpts = []; for (let k = 0; k <= 48; k++) { const a = k / 48 * Math.PI * 2; wpts.push(proj(fx + Math.cos(a) * 0.43, 0.995, fz + Math.sin(a) * 0.43)); }
    ctx.beginPath(); wpts.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]))); ctx.closePath();
    const wg = ctx.createLinearGradient(wpts[24][0], 0, wpts[0][0], 0);
    wg.addColorStop(0, 'rgb(40,46,70)'); wg.addColorStop(0.35, 'rgb(150,60,70)'); wg.addColorStop(0.55, 'rgb(190,150,80)'); wg.addColorStop(0.8, 'rgb(50,70,130)'); wg.addColorStop(1, 'rgb(30,34,50)');
    ctx.fillStyle = wg; ctx.fill();
  }

  function drawStand(ctx, R) {
    const z = STAND.Z, sx = STAND.X;
    const P = (X, Y, dz) => proj(sx + X, Y, z + (dz || 0));
    const iron = '#080706';
    const line = (pts, w, col) => { ctx.beginPath(); pts.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]))); ctx.strokeStyle = col || iron; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke(); };
    const fillq = (pts, col) => { ctx.beginPath(); pts.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]))); ctx.closePath(); ctx.fillStyle = col; ctx.fill(); };
    const flames = [];
    // back legs
    line([P(-0.4, 0, 0.24), P(-0.37, 1.0, 0.24)], 2.2); line([P(0.4, 0, 0.24), P(0.37, 1.0, 0.24)], 2.2);
    const trays = [{ Y: 1.0, hw: 0.36, dz: 0.24, n: 8 }, { Y: 0.84, hw: 0.5, dz: 0, n: 11 }];
    trays.forEach((t) => {
      const scl = F / (z + t.dz);
      for (let k = 0; k < t.n; k++) {
        const X = -t.hw + 0.05 + (2 * t.hw - 0.1) * k / (t.n - 1) + (R() - 0.5) * 0.03;
        const hgt = R() < 0.07 ? 0 : 0.04 + Math.pow(R(), 1.3) * 0.28, lean = (R() - 0.5) * 0.07;
        if (hgt <= 0) continue;
        const b = P(X, t.Y + 0.02, t.dz + 0.04), tp = P(X + lean * hgt, t.Y + 0.02 + hgt, t.dz + 0.04);
        const w = 0.03 * scl / 2;
        const g = ctx.createLinearGradient(0, tp[1], 0, b[1]);
        g.addColorStop(0, '#f6e8c8'); g.addColorStop(0.18, '#cbb894'); g.addColorStop(0.6, '#6e604c'); g.addColorStop(1, '#241e18');
        fillq([[tp[0] - w, tp[1]], [tp[0] + w, tp[1]], [b[0] + w, b[1]], [b[0] - w, b[1]]], g);
        ctx.fillStyle = 'rgba(255,246,220,0.5)'; ctx.fillRect(tp[0] - w * 0.6, tp[1], w * 0.5, Math.min(6, b[1] - tp[1]));
        if (R() < 0.5) { ctx.fillStyle = 'rgba(240,226,196,0.6)'; ctx.beginPath(); ctx.ellipse(tp[0] + w * 0.7, tp[1] + 2.4, 0.9, 2.4, 0, 0, Math.PI * 2); ctx.fill(); }
        if (R() < 0.88) flames.push([tp[0], tp[1], w * 2]);
        else line([tp, [tp[0], tp[1] - 1.8]], 0.6, '#0a0a0a');
      }
      // the tray: an iron trough of sand, its lip warm in the candlelight
      const a = P(-t.hw, t.Y + 0.035, t.dz), b2 = P(t.hw, t.Y - 0.055, t.dz);
      fillq([[a[0], a[1]], [b2[0], a[1]], [b2[0], b2[1]], [a[0], b2[1]]], iron);
      ctx.fillStyle = 'rgba(255,186,112,0.42)'; ctx.fillRect(a[0], a[1] - 0.2, b2[0] - a[0], 0.9);
      ctx.fillStyle = 'rgba(255,186,112,0.12)'; ctx.fillRect(a[0], a[1] + 1.6, b2[0] - a[0], 0.7);
    });
    // front legs, crossbar, scrolls, feet, and the box for offerings
    line([P(-0.46, 0.0), P(-0.46, 0.8)], 2.8); line([P(0.46, 0.0), P(0.46, 0.8)], 2.8);
    line([P(-0.46, 0.26), P(0.46, 0.26)], 1.8);
    line([P(-0.37, 0.96, 0.24), P(-0.46, 0.8)], 1.6); line([P(0.37, 0.96, 0.24), P(0.46, 0.8)], 1.6);
    [-1, 1].forEach((s) => {
      const f = []; for (let k = 0; k <= 18; k++) { const t = k / 18 * Math.PI * 1.6; f.push(P(s * (0.46 + 0.05 * Math.sin(t)), 0.05 + 0.05 * Math.cos(t), 0)); }
      line(f, 1.8);
      line([P(s * 0.46, 0.0), P(s * 0.56, 0.0)], 2.2);
      const sc = []; for (let k = 0; k <= 24; k++) { const t = k / 24, a = t * Math.PI * 1.8, rr = 0.075 * (1 - t * 0.7); sc.push(P(s * (0.36 - Math.sin(a) * rr), 0.72 - Math.cos(a) * rr + 0.075, 0)); }
      line(sc, 1.3);
    });
    const b0 = P(-0.09, 0.6), b1 = P(0.09, 0.4);
    fillq([[b0[0], b0[1]], [b1[0], b0[1]], [b1[0], b1[1]], [b0[0], b1[1]]], '#0b0908');
    line([P(-0.03, 0.57), P(0.03, 0.57)], 1.0, 'rgba(190,150,90,0.55)');
    line([P(0, 0.6), P(0, 0.8)], 1.4);
    return flames;
  }

  function drawFlames(ctx, flames) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const halo = ctx.createRadialGradient(202, 960, 4, 202, 980, 150);
    halo.addColorStop(0, 'rgba(255,170,80,0.10)'); halo.addColorStop(1, 'rgba(255,150,60,0)');
    ctx.fillStyle = halo; ctx.fillRect(40, 820, 330, 330);
    flames.forEach(([x, y, w]) => {
      const g = ctx.createRadialGradient(x, y - 4, 0.5, x, y - 4, 13);
      g.addColorStop(0, 'rgba(255,214,140,0.35)'); g.addColorStop(1, 'rgba(255,160,70,0)');
      ctx.fillStyle = g; ctx.fillRect(x - 14, y - 18, 28, 28);
    });
    ctx.restore();
    flames.forEach(([x, y, w]) => {
      ctx.beginPath(); ctx.moveTo(x, y - 8.5); ctx.quadraticCurveTo(x + 2.4, y - 3, x, y - 0.6); ctx.quadraticCurveTo(x - 2.4, y - 3, x, y - 8.5);
      ctx.fillStyle = 'rgba(255,236,180,0.95)'; ctx.fill();
      ctx.beginPath(); ctx.ellipse(x, y - 2.6, 0.9, 1.5, 0, 0, Math.PI * 2); ctx.fillStyle = 'rgba(255,255,240,1)'; ctx.fill();
    });
  }

  function drawLamp(ctx) {
    const { x, y } = LAMP;
    // chain up the mullion
    ctx.strokeStyle = '#0a0908'; ctx.lineWidth = 1.3;
    for (let yy = 0; yy < y - 24; yy += 5) { ctx.beginPath(); ctx.ellipse(x, yy + 2.5, (yy / 5) % 2 ? 0.7 : 1.4, 2.6, 0, 0, Math.PI * 2); ctx.stroke(); }
    // three chains to the cup
    [[-9, 0], [0, 0], [9, 0]].forEach(([dx]) => { ctx.beginPath(); ctx.moveTo(x, y - 24); ctx.lineTo(x + dx, y - 6); ctx.stroke(); });
    // the glow
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(x, y + 1, 1, x, y + 1, 40);
    g.addColorStop(0, 'rgba(255,40,30,0.55)'); g.addColorStop(0.3, 'rgba(200,20,20,0.18)'); g.addColorStop(1, 'rgba(160,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(x - 42, y - 40, 84, 84);
    ctx.restore();
    // brass cage and ruby glass
    ctx.beginPath(); ctx.moveTo(x - 10, y - 6); ctx.lineTo(x + 10, y - 6); ctx.quadraticCurveTo(x + 10, y + 8, x, y + 10); ctx.quadraticCurveTo(x - 10, y + 8, x - 10, y - 6);
    const rg = ctx.createRadialGradient(x - 2, y, 1, x, y, 11);
    rg.addColorStop(0, '#ff7a5a'); rg.addColorStop(0.5, '#c8141c'); rg.addColorStop(1, '#4a0508');
    ctx.fillStyle = rg; ctx.fill();
    ctx.strokeStyle = '#1a120a'; ctx.lineWidth = 1.4; ctx.stroke();
    ctx.fillStyle = '#2a1e10'; ctx.fillRect(x - 11, y - 8, 22, 3);
    ctx.fillStyle = 'rgba(200,160,90,0.5)'; ctx.fillRect(x - 11, y - 8, 22, 0.8);
    ctx.beginPath(); ctx.moveTo(x - 3, y + 10); ctx.lineTo(x + 3, y + 10); ctx.lineTo(x, y + 16); ctx.closePath(); ctx.fillStyle = '#20160c'; ctx.fill();
  }

  /* ------------------------------------------------------------------ whole picture */
  async function paint(ctx, scale, seed, breathe) {
    const R = mulberry32(seed ^ 0x5bd1e995);
    const sun = { a: 0.035 + R() * 0.035, b: 1.12 + R() * 0.06 };
    const plan = buildPlan();
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    drawWall(ctx, R);
    drawWindowStone(ctx, plan);
    drawChamfers(ctx, plan);
    await breathe();
    const K = makeGlass(ctx, R, scale, breathe);
    await drawCentral(K, ctx, plan.ops.C, R); await breathe(); 
    await drawSide(K, ctx, plan.ops.L, R, { scene: 'stair', ring: G.ruby }, { scene: 'door', ring: G.green }); await breathe();
    await drawSide(K, ctx, plan.ops.R, R, { scene: 'toll', ring: G.green }, { scene: 'barber', ring: G.ruby }); await breathe();
    await drawTracery(K, ctx, plan, R); await breathe(); 
    saddleBars(ctx, plan);

    // light map: what the window lets through, sampled from the finished glass
    const cv = ctx.canvas;
    const lx0 = 100, ly0 = 30, lx1 = 980, ly1 = 912, lsc = 0.5;
    const lw = Math.ceil((lx1 - lx0) * lsc), lh = Math.ceil((ly1 - ly0) * lsc);
    const mk = () => { const c = document.createElement('canvas'); c.width = lw; c.height = lh; return c; };
    const base = mk(), bctx = base.getContext('2d', { willReadFrequently: true });
    bctx.drawImage(cv, lx0 * scale, ly0 * scale, (lx1 - lx0) * scale, (ly1 - ly0) * scale, 0, 0, lw, lh);
    await breathe();
    const mask = mk(), mctx = mask.getContext('2d', { willReadFrequently: true });
    mctx.fillStyle = '#000'; mctx.fillRect(0, 0, lw, lh);
    mctx.setTransform(lsc, 0, 0, lsc, -lx0 * lsc, -ly0 * lsc); mctx.fillStyle = '#fff';
    Object.values(plan.ops).forEach((op) => mctx.fill(op.p));
    bctx.globalCompositeOperation = 'multiply'; bctx.drawImage(mask, 0, 0); bctx.globalCompositeOperation = 'source-over';
    const blurred = (r) => { const c = mk(), x = c.getContext('2d', { willReadFrequently: true }); x.filter = `blur(${r}px)`; x.drawImage(base, 0, 0); x.filter = 'none'; return x.getImageData(0, 0, lw, lh).data; };
    await breathe();
    const LA = blurred(2.0); await breathe();
    const LB = blurred(4.6); await breathe();
    const lightImgs = { w: lw, h: lh, x0: lx0, y0: ly0, sc: lsc, A: LA, B: LB };
    const beam = makeBeam(lightImgs, sun);
    await breathe();

    // glow of the glass in the dark church
    const bl = (div, r, alpha) => {
      const c = document.createElement('canvas'); c.width = Math.ceil(cv.width / div); c.height = Math.ceil(cv.height / div);
      const x = c.getContext('2d', { willReadFrequently: true }); x.filter = `contrast(1.6) brightness(0.75) blur(${r}px)`; x.drawImage(cv, 0, 0, c.width, c.height); x.filter = 'none';
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = alpha;
      ctx.drawImage(c, 0, 0, cv.width, cv.height); ctx.restore();
    };
    bl(Math.max(1, 2 * scale / 2), 2, 0.3); await breathe();
    bl(Math.max(1, 6 * scale / 2), 4, 0.42); await breathe();
    bl(Math.max(1, 16 * scale / 2), 6, 0.48); await breathe();
    (() => {
      const c = document.createElement('canvas'); c.width = Math.ceil(cv.width / 3); c.height = Math.ceil(cv.height / 3);
      const x = c.getContext('2d', { willReadFrequently: true }); x.filter = 'contrast(2.8) brightness(0.5) blur(2px)'; x.drawImage(cv, 0, 0, c.width, c.height); x.filter = 'none';
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = 0.45; ctx.drawImage(c, 0, 0, cv.width, cv.height); ctx.restore();
    })();
    await breathe();
    await breathe();

    // the church below
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    drawDado(ctx);
    const occ = makeOccluders();
    await floorPass(ctx, scale, sun, beam, occ, breathe); 
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    drawLamp(ctx);
    const items = PEW_ROWS.map((z) => ({ z: z, f: () => drawPew(ctx, z, beam, occ, sun) }));
    items.push({ z: FONT.Z, f: () => drawFont3D(ctx, beam, occ, sun) });
    let flames = [];
    items.push({ z: STAND.Z, f: () => { flames = drawStand(ctx, R); } });
    items.sort((p, q) => q.z - p.z);
    for (const it of items) { it.f(); await breathe(); }
    await hazePass(ctx, beam, scale, breathe);
    drawFlames(ctx, flames);

    // the orange, the last thing in
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    if (window.FamilyOrange) window.FamilyOrange.drawSeamOranges(ctx, true, false);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    return { flames };
  }

  /* ------------------------------------------------------------------ mount */
  (window.PIECES = window.PIECES || []).push({
    id: 'baptism',
    title: 'I Do Renounce Him',
    medium: 'Pot-metal glass, grisaille and lead came, drawn in JavaScript',
    note: 'The orange has come to rest.',
    about: "Connie's son is baptised with Michael as his godfather, told as a great Gothic window: the font and the vows in the central light, and in the tracery around them the hour's other business, as small dark silhouettes. Below, the church is in shadow and the window's coloured light lies on the floor where the orange stops. An original interpretation of Puzo's novel, not the film.",
    tone: 'dark',
    room: '#0b0a09',
    mount(el, api) {
      el.style.background = '#0b0a09';
      const cv = document.createElement('canvas');
      cv.style.cssText = 'position:absolute;display:block;';
      el.appendChild(cv);
      // gallery only: the candles breathe a little
      const ov = EXPORT ? null : document.createElement('canvas');
      if (ov) { ov.style.cssText = 'position:absolute;display:block;pointer-events:none;'; el.appendChild(ov); }
      let job = 0, dead = false, lastPx = 0, timer = 0, flames = [], raf = 0, lastT = 0;
      const FR = mulberry32((api.seed >>> 0) ^ 0x2c1b3c6d);
      const phases = []; for (let i = 0; i < 64; i++) phases.push([FR() * 6.283, FR() * 6.283, 2.1 + FR() * 2.5, 5.3 + FR() * 4]);
      function flicker(t) {
        raf = 0;
        if (dead || !api.isCurrent() || !ov) return;
        raf = requestAnimationFrame(flicker);
        if (t - lastT < 50 || !flames.length) return;
        lastT = t;
        const w = Math.max(1, Math.round(cv.clientWidth * Math.min(2, window.devicePixelRatio || 1) / 2));
        const h = Math.round(w * H / W);
        if (ov.width !== w || ov.height !== h) { ov.width = w; ov.height = h; }
        const c = ov.getContext('2d'), sc = w / W, ts = t / 1000;
        c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, w, h);
        c.setTransform(sc, 0, 0, sc, 0, 0); c.globalCompositeOperation = 'lighter';
        let tot = 0;
        flames.forEach(([x, y], i) => {
          const p = phases[i % 64];
          const f = 0.5 + 0.3 * Math.sin(ts * p[2] + p[0]) + 0.2 * Math.sin(ts * p[3] + p[1]);
          tot += f;
          const g = c.createRadialGradient(x, y - 4, 0.5, x, y - 4, 9 + f * 5);
          g.addColorStop(0, `rgba(255,214,150,${0.05 + 0.14 * f})`); g.addColorStop(1, 'rgba(255,170,80,0)');
          c.fillStyle = g; c.fillRect(x - 16, y - 20, 32, 32);
        });
        const m = tot / flames.length;
        const hg = c.createRadialGradient(202, 975, 4, 202, 990, 140);
        hg.addColorStop(0, `rgba(255,170,90,${0.02 + 0.04 * m})`); hg.addColorStop(1, 'rgba(255,150,60,0)');
        c.fillStyle = hg; c.fillRect(50, 830, 310, 320);
      }
      const CANCEL = {};
      function layout() {
        const r = el.getBoundingClientRect();
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        let cw, ch;
        if (EXPORT) { cw = r.width; ch = r.height; } else {
          const m = Math.min(24, r.width * 0.03, r.height * 0.03);
          const s = Math.min((r.width - 2 * m) / W, (r.height - 2 * m) / H);
          cw = W * s; ch = H * s;
        }
        [cv, ov].forEach((c) => { if (!c) return; c.style.width = cw + 'px'; c.style.height = ch + 'px'; c.style.left = (r.width - cw) / 2 + 'px'; c.style.top = (r.height - ch) / 2 + 'px'; });
        return Math.max(1, Math.round(cw * dpr));
      }
      async function render(pxW) {
        const my = ++job;
        const scale = pxW / W;
        const off = document.createElement('canvas');
        off.width = pxW; off.height = Math.round(H * scale);
        const ctx = off.getContext('2d', { willReadFrequently: true });
        let last = performance.now();
        const breathe = async () => {
          if (performance.now() - last > 22) {
            await new Promise((res) => requestAnimationFrame(() => res()));
            last = performance.now();
          }
          if (dead || my !== job || !api.isCurrent()) throw CANCEL;
        };
        let res;
        try {
          res = await paint(ctx, scale, api.seed >>> 0, breathe);
        } catch (e) { if (e === CANCEL) return; throw e; }
        if (dead || my !== job) return;
        cv.width = off.width; cv.height = off.height;
        cv.getContext('2d').drawImage(off, 0, 0);
        lastPx = pxW;
        flames = (res && res.flames) || [];
        if (ov && !raf) raf = requestAnimationFrame(flicker);
        api.ready();
        if (EXPORT) requestAnimationFrame(() => { document.documentElement.dataset.exportReady = '1'; });
      }
      const ro = new ResizeObserver(() => {
        const px = layout();
        if (lastPx && Math.abs(px - lastPx) / lastPx < 0.12) return;
        clearTimeout(timer);
        timer = setTimeout(() => render(px).catch((e) => console.error(e)), lastPx ? 300 : 0);
      });
      ro.observe(el);
      return {
        destroy() { dead = true; job++; clearTimeout(timer); ro.disconnect(); if (raf) cancelAnimationFrame(raf); raf = 0; },
      };
    },
  });
})();
