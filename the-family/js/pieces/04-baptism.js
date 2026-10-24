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
    ops.SL = foilOpening(262, 372, 80, 6, -Math.PI / 2, 0.37);
    ops.SR = foilOpening(818, 372, 80, 6, -Math.PI / 2, 0.37);
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
    // a tile of stippled matt: the paint dabbed on with the tip of a brush
    let STIP = null;
    try {
      const n = Math.max(48, Math.round(72 * scale)), tc = document.createElement('canvas'); tc.width = tc.height = n;
      const tx = tc.getContext('2d');
      for (let i = 0; i < 700; i++) {
        const x = R() * n, y = R() * n, r = (0.3 + R() * 0.75) * scale;
        tx.fillStyle = `rgba(34,20,10,${0.22 + R() * 0.5})`;
        for (const ox of [-n, 0, n]) for (const oy of [-n, 0, n]) { tx.beginPath(); tx.arc(x + ox, y + oy, r, 0, Math.PI * 2); tx.fill(); }
      }
      STIP = ctx.createPattern(tc, 'repeat');
      STIP.setTransform(new DOMMatrix([1 / scale, 0, 0, 1 / scale, 0, 0]));
    } catch (e) { STIP = null; }
    const LF = [R() * 6.28, R() * 6.28, R() * 6.28];
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
        // uneven light: outside, a parapet and a tree soften parts of the window; some pieces are simply older and darker
        const lum = (1.0 + 0.05 * clamp(1 - my / 700, 0, 1) - 0.1 * clamp((my - 760) / 160, 0, 1) - 0.05 * Math.abs(mx - 540) / 430 - (R() < 0.08 ? 0.17 : 0))
          * (1 + 0.08 * Math.sin(mx * 0.013 + LF[0]) * Math.sin(my * 0.011 + LF[1]) + 0.045 * Math.sin((mx + my) * 0.021 + LF[2]));
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
      // flashed ruby: a thin red skin on white, here and there abraded back toward the white
      const ruby = c[0] > 1.7 * c[1] && c[0] > 80 && c[2] < c[0] * 0.65;
      if (ruby && !o.noFlash) {
        for (let k = 0; k < 2; k++) { ctx.beginPath(); const yy = y0 + R() * h; ctx.moveTo(x0 - 2, yy); ctx.bezierCurveTo(x0 + w * 0.3, yy + (R() - 0.5) * 8, x0 + w * 0.7, yy + (R() - 0.5) * 8, x1 + 2, yy + (R() - 0.5) * 6); ctx.strokeStyle = `rgba(70,0,12,${0.12 + R() * 0.12})`; ctx.lineWidth = 0.8 + R() * 2.5; ctx.stroke(); }
        if (R() < 0.15) {
          const ax = x0 + w * (0.25 + R() * 0.5), ay = y0 + h * (0.25 + R() * 0.5), ar = 1.6 + R() * 2.6;
          ctx.strokeStyle = 'rgba(255,214,200,0.42)'; ctx.lineWidth = 0.9 + R() * 0.8;
          ctx.beginPath(); if (R() < 0.5) ctx.arc(ax, ay, ar, 0, Math.PI * 2); else { ctx.moveTo(ax - ar, ay); ctx.quadraticCurveTo(ax, ay - ar * 1.2, ax + ar, ay); } ctx.stroke();
        }
      }
      // weathering: pitting, a little bloom of corrosion, the patina that gathers along the leads
      if (!o.clean && R() < 0.3) {
        const k = 4 + ((R() * 10) | 0);
        for (let i = 0; i < k; i++) { ctx.beginPath(); ctx.arc(x0 + R() * w, y0 + R() * h, 0.25 + R() * 0.5, 0, Math.PI * 2); ctx.fillStyle = `rgba(30,20,12,${0.25 + R() * 0.25})`; ctx.fill(); }
        if (R() < 0.3) { const bx = x0 + R() * w, by = y0 + R() * h, br2 = 3 + R() * 5; const bg = ctx.createRadialGradient(bx, by, 0, bx, by, br2); bg.addColorStop(0, 'rgba(226,220,204,0.16)'); bg.addColorStop(1, 'rgba(226,220,204,0)'); ctx.fillStyle = bg; ctx.fillRect(bx - br2, by - br2, br2 * 2, br2 * 2); }
      }
      if (o.patina !== false) {
        ctx.lineJoin = 'round'; ctx.strokeStyle = 'rgba(32,22,12,0.1)';
        ctx.lineWidth = 10; ctx.stroke(sh.p); ctx.lineWidth = 5.5; ctx.stroke(sh.p); ctx.strokeStyle = 'rgba(32,22,12,0.14)'; ctx.lineWidth = 3.6; ctx.stroke(sh.p);
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
      shade(sh, x0, y0, x1, y1, a0, a1) {
        const g = ctx.createLinearGradient(x0, y0, x1, y1); g.addColorStop(0, `rgba(46,28,14,${a0})`); g.addColorStop(1, `rgba(46,28,14,${a1})`); ctx.fillStyle = g; ctx.fillRect(sh.bb[0] - 2, sh.bb[1] - 2, sh.bb[2] - sh.bb[0] + 4, sh.bb[3] - sh.bb[1] + 4);
        // stippled matt toward the dark side
        const am = Math.max(a0, a1);
        if (STIP && am > 0.12) {
          const d = a0 >= a1 ? [x0, y0, x1, y1] : [x1, y1, x0, y0];
          let dx = d[2] - d[0], dy = d[3] - d[1]; const len = Math.hypot(dx, dy) || 1; const ux = dx / len, uy = dy / len, vx = -uy, vy = ux, BIG = 3000;
          [[0.5, 0.35], [0.26, 0.5]].forEach(([t, al]) => {
            const px = d[0] + dx * t, py = d[1] + dy * t;
            ctx.save(); ctx.beginPath(); ctx.moveTo(px + vx * BIG, py + vy * BIG); ctx.lineTo(px - vx * BIG, py - vy * BIG); ctx.lineTo(px - vx * BIG - ux * BIG, py - vy * BIG - uy * BIG); ctx.lineTo(px + vx * BIG - ux * BIG, py + vy * BIG - uy * BIG); ctx.closePath(); ctx.clip();
            ctx.globalAlpha = am * al; ctx.fillStyle = STIP; ctx.fillRect(sh.bb[0] - 2, sh.bb[1] - 2, sh.bb[2] - sh.bb[0] + 4, sh.bb[3] - sh.bb[1] + 4); ctx.restore();
          });
        }
      },
      stip(sh, a) { if (!STIP) return; ctx.globalAlpha = a; ctx.fillStyle = STIP; ctx.fillRect(sh.bb[0] - 2, sh.bb[1] - 2, sh.bb[2] - sh.bb[0] + 4, sh.bb[3] - sh.bb[1] + 4); ctx.globalAlpha = 1; },
      // a drapery fold as a glass painter makes it: a trace line, matting pushed to one side, hatching in the hollow, a scratched highlight on the ridge
      fold(pts, side, wt, depth) {
        side = side || 1; wt = wt || 1; depth = depth === undefined ? 1 : depth;
        const cl = catmull(pts, 6), n = cl.length;
        const path = new Path2D(); cl.forEach((q, i) => (i ? path.lineTo(q[0], q[1]) : path.moveTo(q[0], q[1])));
        const off = (d) => { const p2 = new Path2D(); cl.forEach((q, i) => { const a = cl[Math.max(0, i - 1)], b = cl[Math.min(n - 1, i + 1)]; let nx = -(b[1] - a[1]), ny = b[0] - a[0]; const m = Math.hypot(nx, ny) || 1; const x = q[0] + nx / m * d * side, y = q[1] + ny / m * d * side; if (i) p2.lineTo(x, y); else p2.moveTo(x, y); }); return p2; };
        if (depth > 0) P.mat(off(3.2), 7 * depth, 0.42 * depth);
        let acc = 0;
        for (let i = 1; i < n - 1; i++) {
          acc += Math.hypot(cl[i][0] - cl[i - 1][0], cl[i][1] - cl[i - 1][1]);
          if (acc < 3.2 || depth <= 0) continue; acc = 0;
          const t = i / (n - 1), a = cl[i - 1], b = cl[i + 1];
          let nx = -(b[1] - a[1]), ny = b[0] - a[0]; const m = Math.hypot(nx, ny) || 1; nx = nx / m * side; ny = ny / m * side;
          const l = (2.5 + 4.5 * Math.sin(Math.PI * t)) * depth;
          ctx.beginPath(); ctx.moveTo(cl[i][0] + nx * 0.8, cl[i][1] + ny * 0.8); ctx.lineTo(cl[i][0] + nx * l + (b[0] - a[0]) * 0.15, cl[i][1] + ny * l + (b[1] - a[1]) * 0.15);
          ctx.strokeStyle = 'rgba(28,17,10,0.55)'; ctx.lineWidth = 0.55; ctx.lineCap = 'round'; ctx.stroke();
        }
        P.tr(path, 1.25 * wt);
        P.hl(off(-2.2), 0.9, 0.32);
      },
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
    // the border of a lancet: a band of foliage scroll in segments, then a string of pearls
    async function border(op, o) {
      o = o || {};
      const bw = o.bw || 12, pw = o.pw || 5.5;
      const src = op.pts.concat([op.pts[0]]);
      const Ls = [0];
      for (let i = 1; i < src.length; i++) Ls.push(Ls[i - 1] + Math.hypot(src[i][0] - src[i - 1][0], src[i][1] - src[i - 1][1]));
      const tot = Ls[Ls.length - 1], N = Math.round(tot / 1.5), pts = [];
      let si = 1;
      for (let k = 0; k < N; k++) { const sv = tot * k / N; while (si < Ls.length - 1 && Ls[si] < sv) si++; const t = (sv - Ls[si - 1]) / Math.max(1e-6, Ls[si] - Ls[si - 1]); pts.push([lerp(src[si - 1][0], src[si][0], t), lerp(src[si - 1][1], src[si][1], t)]); }
      const ctr = centroid(op.pts);
      const nrm = pts.map((p, i) => { const a = pts[(i - 3 + N) % N], b = pts[(i + 3) % N]; let nx = -(b[1] - a[1]), ny = b[0] - a[0]; const m = Math.hypot(nx, ny) || 1; nx /= m; ny /= m; if (nx * (ctr[0] - p[0]) + ny * (ctr[1] - p[1]) < 0) { nx = -nx; ny = -ny; } return [nx, ny]; });
      const at = (i, d) => [pts[i][0] + nrm[i][0] * d, pts[i][1] + nrm[i][1] * d];
      const segN = Math.max(4, Math.round(tot / (o.seg || 46)));
      const cols = o.cols || [G.ruby, G.whiteW, G.blue, G.goldP];
      ctx.save(); ctx.clip(op.p);
      ctx.lineJoin = 'round'; ctx.strokeStyle = LEAD; ctx.lineWidth = (bw + pw) * 2 + LW * 1.5; ctx.stroke(op.p);
      for (let k = 0; k < segN; k++) {
        const i0 = Math.floor(N * k / segN), i1 = Math.floor(N * (k + 1) / segN);
        const sp = new Path2D(); for (let i = i0; i <= i1; i++) { const q = pts[i % N]; if (i === i0) sp.moveTo(q[0], q[1]); else sp.lineTo(q[0], q[1]); }
        const base = cols[k % cols.length], col = jit(base, 0.8), light = base === G.whiteW || base === G.goldP;
        ctx.lineCap = 'butt'; ctx.lineWidth = bw * 2 - LW * 0.9; ctx.strokeStyle = rgb(col); ctx.stroke(sp);
        ctx.lineWidth = bw * 0.7; ctx.strokeStyle = rgb(mulc(col, 1.25), 0.3); ctx.stroke(sp);
        // the scroll: on clear glass the ground is painted out and the stem left clear; on coloured glass the stem is traced
        if (light) { ctx.lineWidth = bw * 2 - LW * 1.6; ctx.strokeStyle = 'rgba(30,18,10,0.72)'; ctx.stroke(sp); }
        const vine = new Path2D();
        for (let i = i0; i <= i1; i++) { const ii = i % N, ph = Math.sin(i * 1.5 / 24 * Math.PI * 2) * bw * 0.22, q = at(ii, bw / 2 + ph); if (i === i0) vine.moveTo(q[0], q[1]); else vine.lineTo(q[0], q[1]); }
        const vc = light ? rgb(mulc(col, 1.1), 0.95) : 'rgba(28,17,10,0.85)';
        ctx.strokeStyle = vc; ctx.fillStyle = vc; ctx.lineWidth = 1.5; ctx.lineCap = 'round'; ctx.stroke(vine);
        for (let i = i0 + 4; i < i1 - 2; i += 8) {
          const ii = i % N, sgn = Math.sin(i * 1.5 / 24 * Math.PI * 2) >= 0 ? 1 : -1, q = at(ii, bw / 2 + sgn * bw * 0.2);
          const tx = -nrm[ii][1], ty = nrm[ii][0];
          ctx.beginPath(); ctx.ellipse(q[0] + tx * 1.4, q[1] + ty * 1.4, 2.4, 1.3, Math.atan2(ty, tx) + sgn * 0.6, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.arc(q[0] - tx * 1.2, q[1] - ty * 1.2, 1.1, 0, Math.PI * 2); ctx.fill();
        }
        // cut across the band
        const a = at(i0 % N, -2), b = at(i0 % N, bw + 0.5);
        ctx.strokeStyle = LEAD; ctx.lineWidth = LW * 0.85; ctx.lineCap = 'butt'; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
      }
      // pearls
      const pp = new Path2D(); for (let i = 0; i <= N; i++) { const q = at(i % N, bw + pw / 2 + LW * 0.25); if (i) pp.lineTo(q[0], q[1]); else pp.moveTo(q[0], q[1]); }
      ctx.lineJoin = 'round'; ctx.lineCap = 'butt'; ctx.lineWidth = pw - LW * 0.35; ctx.strokeStyle = rgb(jit(G.whiteW, 0.4)); ctx.stroke(pp);
      ctx.strokeStyle = 'rgba(30,18,10,0.62)'; ctx.stroke(pp);
      ctx.fillStyle = 'rgba(246,238,214,0.95)';
      for (let i = 0; i < N; i += 4) { const q = at(i, bw + pw / 2 + LW * 0.25); ctx.beginPath(); ctx.arc(q[0], q[1], 1.55, 0, Math.PI * 2); ctx.fill(); }
      ctx.restore();
      lead(op, LW * 1.3);
      await br();
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
        for (let i = 0; i <= nx; i++) V[j].push([bb[0] + i * cw + (R() - 0.5) * cw * (o.jx || 0.36), bb[1] + j * chh + (R() - 0.5) * chh * (o.jy || 0.32)]);
      }
      for (let j = 0; j < ny; j++) {
        let i = 0;
        while (i < nx) {
          const span = (R() < (o.merge === undefined ? 0.3 : o.merge) && i + 2 <= nx) ? 2 : 1;
          const pts = [];
          for (let k = 0; k <= span; k++) pts.push(V[j][i + k]);
          for (let k = span; k >= 0; k--) pts.push(V[j + 1][i + k]);
          i += span;
          const parts = (span === 1 && R() < (o.split || 0)) ? (R() < 0.5 ? [[pts[0], pts[1], pts[2]], [pts[0], pts[2], pts[3]]] : [[pts[0], pts[1], pts[3]], [pts[1], pts[2], pts[3]]]) : [pts];
          for (const pp of parts) {
            const ct = centroid(pp);
            const col = colourOf(ct[0], ct[1]);
            if (!col) continue;
            const sh = poly(pp);
            glass(sh, col, { v: o.v === undefined ? 1.15 : o.v, edgeA: 0.24, lw: o.lw || 2.8, paint: o.paint ? (c) => o.paint(c, sh, ct) : null });
            await step(2);
          }
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
          glass(poly([[x, y - q], [x + q, y], [x, y + q], [x - q, y]]), Array.isArray(node[0]) ? node[(hash2((x | 0) + 7, (y | 0) + 3) * node.length) | 0] : node, { v: 0.9, noStreak: true, noSeed: true, edge: false, lw: 2.2 });
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
    return { jit, lead, glass, P, field, band, border, diaper, quarries, trellis, wheel, step, br };
  }

  /* ------------------------------------------------------------------ figure silhouettes (local coords) */
  // a standing man in a coat and hat, about 54 high, feet at y=0, facing right; used for shadows
  const MAN = 'M -3 -50 C 1 -51.5, 5 -50.5, 6 -47 L 8 -47 L 8 -45 L 5 -44.5 C 5 -42, 4 -40, 2 -39 C 6 -38, 9 -36, 10 -32 L 13 -22 L 20 -24 L 21 -21 L 12 -16 L 11 -12 L 12 -2 L 10 0 L 6 0 L 4 -12 L 1 -12 L 0 -1 L 1 0 L -6 0 L -4 -12 L -6 -14 L -7 -30 C -7 -36, -4 -38, -2 -39 C -4 -41, -5 -43, -5 -45 L -7 -45 L -7 -47 L -4 -47 Z';

  /* ------------------------------------------------------------------ Lombardic capitals, drawn stroke by stroke (box 14 x 16) */
  const LOMB = {
    A: [['M 2.4 16 C 2.2 9, 4.2 3.2, 8.4 1.2', 3.3], ['M 8.4 1.2 C 10.2 6, 11.4 11, 12.4 16', 1.2], ['M 3.6 10.2 L 10.6 10.2', 1.0], ['M 3.8 1.2 L 11 1.2', 1.5], ['M 0.4 16 L 4.6 16 M 10.6 16 L 14 16', 1.1]],
    B: [['M 3 1 L 3 16', 3.3], ['M 3 1.2 C 10.6 0.6, 11.6 8.2, 3 8.2', 1.6], ['M 3 8.2 C 12.8 7.8, 12.8 16.6, 3 16', 2.4], ['M 0.4 1 L 5.4 1 M 0.4 16 L 5.4 16', 1.1]],
    R: [['M 3 1 L 3 16', 3.3], ['M 3 1.2 C 10.8 0.8, 11.2 8.8, 3 8.8', 1.8], ['M 4.6 8.8 C 7.6 10, 9.6 14, 12.6 16', 2.6], ['M 0.4 1 L 5.4 1 M 0.4 16 L 5.4 16', 1.1]],
    E: [['M 11.6 3.2 C 9 0.2, 1.8 0.8, 1.8 8.5 C 1.8 16.2, 9 16.8, 11.6 13.6', 1.3], ['M 3.4 3.6 C 2.2 6.6, 2.2 10.6, 3.4 13.4', 3.6], ['M 2.4 8.4 L 9.2 8.4', 1.2], ['M 11.6 1.2 L 11.6 15.6', 0.9]],
    N: [['M 2.4 1 L 2.4 16', 1.2], ['M 2.6 1.2 C 5 5, 8.4 11, 11.4 15.6', 3.2], ['M 11.6 1 L 11.6 16', 1.2], ['M 0.4 1 L 4.4 1 M 9.6 16 L 13.6 16 M 0.4 16 L 4.4 16 M 9.6 1 L 13.6 1', 1.0]],
    V: [['M 3 1 L 3 9.6 C 3 14, 4.8 16, 7.2 16', 3.3], ['M 7.2 16 C 10.2 16, 11.8 13, 11.8 9.2 L 11.8 1', 1.2], ['M 0.6 1 L 5.4 1 M 9.6 1 L 14 1', 1.1]],
    T: [['M 1 2.6 L 13 2.6', 1.5], ['M 1 2.6 C -0.4 5.2, 0.8 7.6, 3.2 6.8', 1.2], ['M 7 2.6 L 7 12.2 C 7 15.2, 8.6 16.2, 11.2 15', 3.3]],
    I: [['M 7 1 L 7 16', 3.5], ['M 3.8 1 L 10.2 1 M 3.8 16 L 10.2 16', 1.2]],
    O: [['M 7 0.8 C 0.8 0.8, 0.8 16.2, 7 16.2 C 13.2 16.2, 13.2 0.8, 7 0.8 Z', 1.2], ['M 3.4 4 C 2.2 7, 2.2 10, 3.4 13', 3.2], ['M 10.6 4 C 11.8 7, 11.8 10, 10.6 13', 3.2]],
  };
  function lombardic(ctx, txt, cx, cy, h, sp, col) {
    const k = h / 16;
    ctx.save(); ctx.strokeStyle = col; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (let i = 0; i < txt.length; i++) {
      const g = LOMB[txt[i]]; if (!g) continue;
      const ox = cx + (i - (txt.length - 1) / 2) * sp - 7 * k, oy = cy - 8 * k;
      g.forEach(([d, w]) => { ctx.lineWidth = w * k; ctx.stroke(shape(d, (x, y) => [ox + x * k, oy + y * k]).p); });
    }
    ctx.restore();
  }

  /* ------------------------------------------------------------------ the central light: the baptism */
  const RUBIES = [[100, 8, 28], [124, 12, 32], [146, 16, 36], [170, 24, 38], [190, 38, 40], [134, 14, 46], [158, 20, 30]];
  const BLUES = [[18, 34, 104], [24, 46, 128], [28, 58, 150], [40, 52, 162], [26, 80, 150], [50, 46, 148], [20, 62, 138], [34, 70, 170]];
  async function drawCentral(K, ctx, op, R) {
    const { glass, P, quarries, diaper } = K;
    const pick = (a) => a[(R() * a.length) | 0];
    const stain = (d, a) => { ctx.fillStyle = `rgba(228,158,28,${a || 0.55})`; ctx.fill(typeof d === 'string' ? new Path2D(d) : d); };
    const box = (x0, y0, x1, y1) => `M ${x0} ${y0} L ${x1} ${y0} L ${x1} ${y1} L ${x0} ${y1} Z`;
    ctx.save(); ctx.clip(op.p);
    // the ground: a mosaic of small irregular pieces, ruby round the canopy and blue behind the figures
    await quarries([356, 182, 724, 905], 30, 34, (x, y) => ((y > 506 || (y > 440 && x > 398 && x < 682)) ? pick(BLUES) : pick(RUBIES)), {
      split: 0.32, jx: 0.5, jy: 0.42, merge: 0.12, v: 0.7,
      paint: (c, sh, ct) => diaper((ct[1] > 506 || (ct[1] > 440 && ct[0] > 398 && ct[0] < 682)) ? 'rose' : 'scale', c, sh),
    });
    await K.br();

    // ----- the canopy: a tower of micro-architecture in white glass and yellow stain
    const crocketed = (pts, size) => { // a polyline with crockets bulging outward on its left
      const out = [];
      for (let s = 0; s < pts.length - 1; s++) {
        const a = pts[s], b = pts[s + 1], n = Math.max(2, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / (size * 2.6)));
        const nx = (b[1] - a[1]), ny = -(b[0] - a[0]), m = Math.hypot(nx, ny), ox = nx / m * size, oy = ny / m * size;
        for (let k = 0; k < n; k++) {
          const t0 = k / n, t1 = (k + 0.5) / n, t2 = (k + 0.78) / n;
          out.push([lerp(a[0], b[0], t0), lerp(a[1], b[1], t0)], [lerp(a[0], b[0], t1) + ox, lerp(a[1], b[1], t1) + oy], [lerp(a[0], b[0], t2) + ox * 0.3, lerp(a[1], b[1], t2) + oy * 0.3]);
        }
      }
      out.push(pts[pts.length - 1]);
      return out;
    };
    const white = () => mixc(G.whiteW, G.white, R());
    const archPaint = (x0, y0, x1, y1) => { // tiny painted windows and courses on a stone face of glass
      for (let y = y0 + 8; y < y1; y += 9) P.tr(`M ${x0 + 1} ${y} L ${x1 - 1} ${y}`, 0.45, 0.45);
    };
    // flying buttresses from the outer pinnacles to the turrets
    [[398, 1], [682, -1]].forEach(([x, sd]) => glass(shape(`M ${x} 344 C ${x + 14 * sd} 328, ${x + 28 * sd} 318, ${x + 42 * sd} 312 L ${x + 42 * sd} 320 C ${x + 30 * sd} 326, ${x + 16 * sd} 336, ${x} 354 Z`), mixc(G.whiteW, G.white, 0.5), { lw: 2.2, noStreak: true, paint: () => { P.tr(`M ${x + 6 * sd} 342 C ${x + 18 * sd} 330, ${x + 30 * sd} 322, ${x + 40 * sd} 318`, 0.6, 0.6); } }));
    // side turrets with tall spirelets
    [[438, 464], [616, 642]].forEach(([a, b]) => {
      const m = (a + b) / 2;
      glass(shape(box(a, 292, b, 330)), white(), { paint: (c, sh) => { P.shade(sh, a, 0, b, 0, 0.0, 0.45); archPaint(a, 292, b, 330); P.fill(`M ${m - 4} 326 L ${m - 4} 306 C ${m - 4} 300, ${m} 297, ${m} 297 C ${m} 297, ${m + 4} 300, ${m + 4} 306 L ${m + 4} 326 Z`, 0.85); stain(box(a, 292, b, 297)); P.tr(`M ${a} 297 L ${b} 297`, 0.8); } });
      glass(poly(crocketed([[a - 3, 294], [m, 242]], 2.8).concat(crocketed([[m, 242], [b + 3, 294]], 2.8))), G.goldP, { paint: (c, sh) => { P.shade(sh, a, 0, b, 0, 0.0, 0.42); P.tr(`M ${m} 248 L ${m} 292`, 0.6, 0.5); } });
      glass(circ(m, 239, 3.4), G.goldP, { lw: 1.8, noStreak: true });
    });
    // the lantern: two lights with gablets, and the spire
    glass(shape(box(510, 266, 570, 328)), white(), {
      paint: (c, sh) => { P.shade(sh, 510, 0, 570, 0, 0.0, 0.42); archPaint(510, 266, 570, 328); P.tr('M 540 268 L 540 326', 0.8, 0.6); },
    });
    [[514, 536], [544, 566]].forEach(([a, b]) => {
      const m = (a + b) / 2;
      glass(shape(`M ${a} 322 L ${a} 288 C ${a} 280, ${m} 276, ${m} 276 C ${m} 276, ${b} 280, ${b} 288 L ${b} 322 Z`), pick(BLUES), { lw: 2.2, paint: () => { P.tr(`M ${m} 280 L ${m} 322`, 1.1); ctx.beginPath(); ctx.arc(m, 288, 3, 0, Math.PI * 2); ctx.strokeStyle = TRACE; ctx.lineWidth = 0.8; ctx.stroke(); P.tr(`M ${a + 2} 304 L ${b - 2} 304`, 0.5, 0.6); } });
      glass(poly(crocketed([[a - 2, 276], [m, 258]], 2.2).concat(crocketed([[m, 258], [b + 2, 276]], 2.2)).concat([[b + 2, 280], [a - 2, 280]])), G.whiteW, { lw: 2.2, noStreak: true, paint: (c, sh) => { stain(sh.p, 0.42); P.tr(`M ${a + 1} 276 L ${m} 262 L ${b - 1} 276`, 0.7, 0.8); } });
    });
    glass(poly(crocketed([[510, 268], [540, 198]], 3.4).concat(crocketed([[540, 198], [570, 268]], 3.4))), G.goldP, {
      paint: (c, sh) => { P.shade(sh, 522, 0, 570, 0, 0.0, 0.48); P.tr('M 540 204 L 540 264', 0.7, 0.6); for (let y = 214; y < 266; y += 8) P.tr(`M ${540 - (y - 198) * 0.4} ${y} L ${540 + (y - 198) * 0.4} ${y}`, 0.5, 0.42); },
    });
    // the gallery: a frieze of quatrefoils over a pointed arcade
    glass(shape(box(404, 328, 676, 356)), white(), {
      paint: (c, sh) => {
        P.shade(sh, 0, 328, 0, 356, 0.05, 0.42);
        stain(box(404, 328, 676, 336), 0.5);
        for (let x = 410; x < 672; x += 11) { ctx.beginPath(); for (let k = 0; k < 4; k++) { const an = k * Math.PI / 2; ctx.moveTo(x + 5.5 + Math.cos(an) * 1.6 + 1.5, 332 + Math.sin(an) * 1.6); ctx.arc(x + 5.5 + Math.cos(an) * 1.6, 332 + Math.sin(an) * 1.6, 1.5, 0, Math.PI * 2); } ctx.strokeStyle = TRACE; ctx.lineWidth = 0.6; ctx.stroke(); }
        P.tr('M 404 336.5 L 676 336.5', 0.9);
        for (let x = 408; x < 672; x += 10) P.fill(`M ${x + 2} 354 L ${x + 2} 344 C ${x + 2} 340, ${x + 5} 338.5, ${x + 5} 338.5 C ${x + 5} 338.5, ${x + 8} 340, ${x + 8} 344 L ${x + 8} 354 Z`, 0.8);
      },
    });
    // pinnacles at either side
    [[374, 398], [682, 706]].forEach(([a, b]) => {
      const m = (a + b) / 2;
      glass(shape(box(a, 320, b, 524)), white(), {
        paint: (c, sh) => {
          P.shade(sh, a, 0, b, 0, 0.0, 0.5); archPaint(a, 320, b, 524);
          [348, 410, 470].forEach((y) => { P.fill(`M ${m - 4.5} ${y + 26} L ${m - 4.5} ${y + 6} C ${m - 4.5} ${y}, ${m + 4.5} ${y}, ${m + 4.5} ${y + 6} L ${m + 4.5} ${y + 26} Z`, 0.85); P.tr(`M ${a + 1} ${y - 4} L ${m} ${y - 12} L ${b - 1} ${y - 4}`, 0.9); stain(`M ${a} ${y - 4} L ${m} ${y - 12} L ${b} ${y - 4} L ${b} ${y - 1} L ${a} ${y - 1} Z`, 0.5); });
          P.hl(`M ${a + 3} 330 L ${a + 3} 520`, 0.9, 0.4);
        },
      });
      glass(poly(crocketed([[a - 3, 322], [m, 266]], 3).concat(crocketed([[m, 266], [b + 3, 322]], 3))), G.goldP, { paint: (c, sh) => { P.shade(sh, a, 0, b, 0, 0.0, 0.45); P.tr(`M ${m} 272 L ${m} 320`, 0.6, 0.5); } });
      glass(circ(m, 262, 4), G.goldP, { lw: 1.8, noStreak: true });
    });
    // the gable, its quatrefoil window with the dove, its finial
    const archO = archHead(398, 682, 506, 432), archI = archHead(409, 671, 506, 446);
    const gable = crocketed([[402, 480], [540, 354]], 5.5).concat(crocketed([[540, 354], [678, 480]], 5.5));
    archO.pts.slice().reverse().forEach((q) => gable.push(q.p));
    glass(poly(gable), G.goldP, {
      paint: (c, sh) => {
        P.mat('M 408 476 L 540 362 L 672 476', 10, 0.5); P.tr('M 412 474 L 540 366 L 668 474', 1.1, 0.85); P.hl('M 420 472 L 540 372 L 660 472', 0.8, 0.35);
        [[468, 448], [612, 448]].forEach(([x, y]) => { P.tr(`M ${x - 11} ${y + 18} L ${x - 11} ${y + 4} C ${x - 11} ${y - 6}, ${x + 11} ${y - 6}, ${x + 11} ${y + 4} L ${x + 11} ${y + 18}`, 1.0, 0.8); P.mat(`M ${x - 5} ${y + 2} L ${x - 5} ${y + 16} M ${x + 5} ${y + 2} L ${x + 5} ${y + 16}`, 4, 0.4); P.tr(`M ${x} ${y - 3} L ${x} ${y + 18}`, 0.7, 0.6); });
        P.shade(sh, 402, 0, 678, 0, 0.0, 0.3);
      },
    });
    const qf = foilOpening(540, 418, 31, 4, -Math.PI / 4, 0.47);
    glass(qf, pick(BLUES), { lw: 2.6, paint: (c, sh) => diaper('dots', c, sh) });
    const DV = (d) => shape(d, (x, y) => [540 + (x - 540) * 0.64, 420 + (y - 282) * 0.64]);
    ['M 536 284 C 524 276, 510 262, 500 244 C 498 240, 503 240, 506 242 C 516 252, 526 262, 538 268 Z', 'M 544 284 C 556 276, 570 262, 580 244 C 582 240, 577 240, 574 242 C 564 252, 554 262, 542 268 Z'].forEach((d) => glass(DV(d), G.white, { lw: 1.8, noStreak: true, paint: (c, sh) => P.shade(sh, 0, 404, 0, 430, 0.0, 0.35) }));
    glass(DV('M 540 262 C 547 266, 549 280, 547 296 C 546 304, 544 310, 540 316 C 536 310, 534 304, 533 296 C 531 280, 533 266, 540 262 Z'), G.white, { lw: 1.8, noStreak: true, paint: (c, sh) => { P.shade(sh, 534, 0, 548, 0, 0, 0.4); P.dot(538.8, 438.6, 0.9); P.tr('M 538.8 442 L 540 445 L 541.2 442', 0.7); } });
    glass(shape('M 540 354 L 534 342 C 530 336, 534 328, 540 324 C 546 328, 550 336, 546 342 Z'), G.goldP, { paint: () => P.tr('M 540 330 L 540 350', 0.7) });
    // the cusped arch over the heads
    glass(poly(archO.pts.map((q) => q.p).concat(archI.pts.map((q) => q.p).reverse())), G.whiteW, {
      paint: () => {
        for (let k = 1; k < 12; k++) { const q = archO.pts[Math.floor(archO.pts.length * k / 12)].p; P.dot(q[0] + (540 - q[0]) * 0.03, q[1] + 6.5, 1.5); }
        P.tr(new Path2D(archI.pts.map((q, i) => (i ? 'L ' : 'M ') + q.p[0].toFixed(1) + ' ' + (q.p[1] - 2).toFixed(1)).join(' ')), 0.9, 0.75);
        stain(new Path2D(archO.pts.map((q, i) => (i ? 'L ' : 'M ') + q.p[0].toFixed(1) + ' ' + (q.p[1] + 1).toFixed(1)).join(' ') + ' ' + archO.pts.slice().reverse().map((q) => 'L ' + q.p[0].toFixed(1) + ' ' + (q.p[1] + 4).toFixed(1)).join(' ') + ' Z'), 0.45);
      },
    });
    [[0.3, 1], [0.7, -1]].forEach(([u, sd]) => {
      const q = archI.pts[Math.floor(archI.pts.length * u)].p, x = q[0], y = q[1];
      glass(shape(`M ${x - 11 * sd} ${y - 3} C ${x - 5 * sd} ${y + 1}, ${x - 1.5 * sd} ${y + 5}, ${x} ${y + 10} C ${x + 2 * sd} ${y + 5}, ${x + 6 * sd} ${y}, ${x + 13 * sd} ${y - 6} Z`), G.whiteW, { lw: 2.0, noStreak: true, paint: () => { P.dot(x, y + 8.5, 1.8, 0.9); P.clear(x, y + 8.5, 0.8, 0.6); } });
    });
    await K.br();

    // ----- Connie: veiled, hands joined, swaying in the Gothic way
    glass(shape('M 404 562 C 418 556, 436 560, 444 572 C 446 600, 438 630, 430 660 C 428 700, 438 760, 452 842 L 380 842 C 384 790, 388 740, 392 700 C 396 660, 394 620, 396 590 C 396 576, 398 566, 404 562 Z'), G.green, {
      cuts: [new Path2D('M 420 566 C 422 620, 420 680, 430 740')],
      paint: (c, sh) => {
        P.shade(sh, 380, 0, 452, 0, 0.5, 0.05);
        P.fold([[422, 590], [424, 630], [426, 668]], 1); P.fold([[410, 600], [408, 640], [410, 680]], -1, 0.8, 0.7);
        P.fold([[438, 700], [442, 760], [448, 838]], -1); P.fold([[444, 720], [447, 780], [451, 838]], 1, 0.8, 0.6);
        P.tr('M 384 836 C 400 830, 420 842, 452 836', 1.1);
      },
    });
    glass(shape('M 400 566 C 392 600, 388 660, 386 720 C 384 770, 384 805, 386 834 C 400 838, 416 834, 428 826 C 436 810, 444 760, 446 720 C 446 700, 444 684, 440 676 C 426 680, 412 668, 404 650 C 402 620, 402 590, 400 566 Z'), pick(RUBIES.slice(2, 5)), {
      cuts: [new Path2D('M 388 740 C 404 736, 422 724, 440 700')],
      paint: (c, sh) => {
        P.shade(sh, 386, 0, 446, 0, 0.45, 0.0);
        P.fold([[438, 692], [420, 724], [406, 770], [396, 826]], 1); P.fold([[430, 706], [414, 744], [402, 800]], 1, 0.9, 0.8);
        P.fold([[398, 604], [392, 680], [390, 760], [390, 828]], -1, 0.9, 0.7);
        P.tr('M 440 684 L 434 700 L 444 716 L 436 734 L 444 752 L 436 772 L 442 792 L 432 812 L 428 826', 1.1);
        P.hl('M 418 712 C 410 740, 402 780, 400 820', 1.0, 0.3);
      },
    });
    glass(shape('M 404 522 C 410 508, 432 506, 438 520 C 442 530, 440 544, 436 552 L 440 584 C 442 604, 438 622, 432 634 C 418 644, 404 652, 394 662 C 392 632, 394 600, 396 574 C 396 550, 398 534, 404 522 Z'), G.whiteB, {
      paint: (c, sh) => {
        P.shade(sh, 394, 0, 442, 0, 0.48, 0.0);
        P.fold([[410, 520], [404, 560], [400, 610], [398, 652]], 1); P.fold([[422, 566], [430, 590], [436, 616]], -1, 0.8, 0.6);
        P.fold([[400, 530], [398, 580], [396, 630]], 1, 0.7, 0.5);
      },
    });
    glass(shape('M 416 534 C 424 530, 433 534, 435 542 L 437 549 L 434 551 C 435 556, 433 561, 429 564 C 425 567, 419 566, 416 561 C 413 554, 413 540, 416 534 Z'), G.flesh, {
      noStreak: true, clean: true,
      paint: (c, sh) => {
        P.shade(sh, 414, 0, 436, 0, 0.55, 0.0);
        P.mat('M 424 545.5 C 426.6 543.6, 430 543.8, 432 545.8', 3.4, 0.45); P.mat('M 418 548 C 419 554, 422 559, 428 562', 4, 0.35);
        P.tr('M 422 540 C 425 538.4, 429 538.6, 432 540.6', 1.45);
        P.tr('M 423.4 545 C 425.6 543.4, 428.6 543.6, 430.8 545.4', 1.3); P.dot(428.3, 545.3, 1.25);
        P.tr('M 424.4 547.4 C 426.4 548.2, 429 548.2, 430.4 547.2', 0.6, 0.7);
        P.tr('M 432 541 L 436.2 548.6 L 433.4 550.4', 1.15);
        P.tr('M 428.4 555.6 C 430 554.8, 431.6 555, 432.6 555.8', 1.15); P.tr('M 429.4 557.8 C 430.4 558.4, 431.6 558.4, 432.2 557.8', 0.5, 0.6);
        P.hl('M 426 536 C 429 535.6, 432 537.4, 433.6 540', 0.8, 0.4);
      },
    });
    glass(shape('M 430 612 C 432 602, 436 594, 442 588 C 446 592, 444 602, 438 612 Z'), G.flesh, { noStreak: true, clean: true, paint: (c, sh) => { P.shade(sh, 430, 0, 446, 0, 0.35, 0); P.tr('M 434 608 L 441 593 M 437 610 L 443 597', 0.6, 0.75); } });
    glass(shape('M 442 836 L 454 836 C 458 838, 458 842, 456 844 L 440 844 Z'), [26, 20, 26], { noStreak: true, clean: true });
    await K.br();

    // ----- the priest, in alb and gold cope, the book in one hand
    glass(shape('M 616 560 C 630 554, 668 554, 684 560 C 690 600, 696 680, 704 760 L 708 842 L 604 842 C 606 780, 610 700, 612 640 C 612 600, 612 578, 616 560 Z'), G.white, {
      cuts: [new Path2D('M 650 600 C 652 700, 652 780, 654 842')],
      paint: (c, sh) => {
        P.shade(sh, 604, 0, 708, 0, 0.05, 0.45);
        P.fold([[632, 610], [630, 700], [628, 780], [624, 840]], 1); P.fold([[644, 620], [644, 720], [644, 840]], -1, 0.8, 0.7);
        P.fold([[662, 610], [666, 710], [670, 840]], 1, 0.9, 0.8); P.fold([[676, 620], [684, 720], [692, 840]], -1);
      },
    });
    glass(shape('M 634 812 L 672 812 L 674 838 L 632 838 Z'), pick(RUBIES.slice(3)), { lw: 2.4, paint: () => { for (let k = 0; k < 4; k++) { const x = 639 + k * 10; ctx.beginPath(); ctx.arc(x, 825, 3.2, 0, Math.PI * 2); ctx.strokeStyle = 'rgba(240,196,90,0.85)'; ctx.lineWidth = 1.1; ctx.stroke(); } P.tr('M 634 816 L 672 816 M 633 834 L 673 834', 0.8); } });
    glass(shape('M 618 558 C 606 570, 598 600, 596 650 C 594 700, 598 760, 606 800 L 626 804 C 622 740, 624 660, 630 600 C 632 580, 634 566, 640 558 Z'), G.gold, {
      paint: (c, sh) => { P.shade(sh, 596, 0, 632, 0, 0.45, 0.05); P.fold([[612, 590], [604, 660], [604, 740], [608, 796]], 1); P.fold([[622, 610], [618, 700], [620, 790]], -1, 0.8, 0.6); P.tr('M 598 790 C 606 798, 616 804, 626 804', 1.0); },
    });
    glass(shape('M 660 556 C 674 556, 690 566, 698 590 C 706 640, 710 720, 712 800 L 690 806 C 686 740, 680 660, 672 610 C 668 588, 664 570, 660 556 Z'), mulc(G.gold, 0.9), {
      paint: (c, sh) => { P.shade(sh, 664, 0, 712, 0, 0.0, 0.5); P.fold([[684, 590], [694, 670], [702, 760], [704, 800]], -1); P.fold([[676, 620], [684, 700], [690, 800]], 1, 0.8, 0.6); },
    });
    [['M 624 562 L 636 560 C 630 620, 628 700, 630 804 L 618 804 C 616 700, 618 620, 624 562 Z', 627], ['M 664 558 L 676 562 C 684 620, 690 700, 694 806 L 682 806 C 678 700, 672 620, 664 558 Z', 680]].forEach(([d, x]) => glass(shape(d), pick(RUBIES.slice(1, 4)), {
      paint: (c, sh) => {
        P.shade(sh, x - 8, 0, x + 8, 0, 0.0, 0.3);
        for (let y = 584; y < 800; y += 26) { const xx = x + (y - 584) * (x < 650 ? -0.01 : 0.06); ctx.beginPath(); ctx.arc(xx, y, 3.4, 0, Math.PI * 2); ctx.fillStyle = 'rgba(240,198,90,0.9)'; ctx.fill(); ctx.strokeStyle = TRACE; ctx.lineWidth = 0.7; ctx.stroke(); P.dot(xx, y, 1.0, 0.8); }
        P.tr(`M ${x - 5} 570 L ${x - 5} 800 M ${x + 5} 570 L ${x + 5} 800`, 0.5, 0.5);
      },
    }));
    glass(circ(650, 570, 7.5), G.goldP, { lw: 2.2, paint: () => { ctx.beginPath(); ctx.arc(650, 570, 3.4, 0, Math.PI * 2); ctx.fillStyle = 'rgba(150,20,30,0.9)'; ctx.fill(); P.clear(649, 569, 1, 0.6); } });
    glass(shape('M 656 626 L 684 622 L 688 652 L 660 656 Z'), pick(RUBIES.slice(1, 4)), { paint: () => { P.tr('M 660 630 L 684 626', 0.8); ctx.fillStyle = 'rgba(236,190,80,0.85)'; ctx.fillRect(670, 631, 4, 14); ctx.fillRect(666, 636, 12, 3); P.dot(661, 640, 1.4); P.dot(683, 637, 1.4); } });
    glass(shape('M 666 642 C 671 638, 680 638, 683 643 L 681 651 L 669 652 Z'), G.flesh, { noStreak: true, clean: true, paint: () => { P.tr('M 670 645 L 680 644 M 671 648 L 680 647', 0.6, 0.75); } });
    glass(shape('M 640 512 C 648 507, 658 510, 660 518 L 661 534 C 659 543, 653 549, 645 549 C 640 549, 637 545, 636 541 L 632 537 L 635 534 C 633 529, 633 522, 635 518 C 636 515, 638 513, 640 512 Z'), G.flesh, {
      noStreak: true, clean: true,
      paint: (c, sh) => {
        P.shade(sh, 632, 0, 662, 0, 0.0, 0.58);
        P.mat('M 636 526.6 C 639 524.4, 643 524.4, 645.4 527', 4, 0.48); P.mat('M 655 520 C 660 528, 660 538, 654 546', 6, 0.42);
        P.tr('M 636 521.6 C 638.6 519.6, 642.6 519.6, 645.4 521.8', 1.5);
        P.tr('M 637 526.4 C 639.2 524.8, 642.4 524.8, 644.6 526.8', 1.3); P.dot(639.3, 526.5, 1.3);
        P.tr('M 637.6 528.8 C 639.6 529.6, 642.4 529.6, 644.2 528.8', 0.6, 0.7);
        P.tr('M 636.6 523 L 632.6 536.4 L 636 537.8', 1.25);
        P.tr('M 636.8 542 C 638.4 541.4, 640.4 541.6, 642 542.4', 1.15);
        P.tr('M 640 515.2 C 644 513.4, 648 513.4, 652 515.4', 0.6, 0.55); P.tr('M 642 530 C 644 533, 645 537, 644 540', 0.6, 0.55);
        P.tr('M 655 524 C 658 522, 660 526, 657 530', 0.9);
        P.hl('M 641 511 C 646 509, 652 510, 656 513', 0.8, 0.4);
      },
    });
    glass(shape('M 650 507 C 660 508, 666 516, 665 526 C 664 535, 661 541, 657 543 L 659 527 C 658 518, 655 512, 648 509 Z'), G.stoneL, { noStreak: true, clean: true, paint: () => { for (let k = 0; k < 4; k++) P.tr(`M ${653 + k * 2.6} ${510 + k} C ${657 + k * 2.4} ${516 + k}, ${659 + k * 1.6} ${526}, ${658 + k * 1.2} ${536 - k * 2}`, 0.55, 0.75); } });
    await K.br();

    // ----- Michael: the dark suit drawn the Gothic way, head bowed to the child
    glass(shape('M 448 688 L 504 688 L 506 750 L 503 836 L 488 836 L 482 756 L 476 836 L 460 836 L 452 750 Z'), G.suit, {
      paint: (c, sh) => { P.shade(sh, 448, 0, 506, 0, 0.42, 0.0); P.hl('M 498 700 L 500 760 L 497 830 M 466 702 L 462 760 L 466 830', 1.1, 0.3); P.tr('M 482 704 L 482 752', 0.9, 0.8); P.hl('M 492 760 C 494 790, 494 812, 492 832', 0.7, 0.2); },
    });
    glass(shape('M 458 834 L 478 834 C 482 836, 484 840, 482 843 L 456 843 Z'), [22, 18, 24], { noStreak: true, clean: true, edge: false, paint: () => P.hl('M 464 836 L 478 836', 0.9, 0.35) });
    glass(shape('M 487 834 L 503 834 C 510 836, 512 840, 510 843 L 486 843 Z'), [22, 18, 24], { noStreak: true, clean: true, edge: false, paint: () => P.hl('M 492 836 L 505 836', 0.9, 0.35) });
    glass(shape('M 470 552 C 458 554, 450 562, 449 576 C 446 610, 442 650, 444 690 C 460 698, 486 698, 506 690 C 508 660, 506 630, 504 600 C 503 578, 498 562, 488 556 L 484 556 L 479 580 L 474 554 Z'), G.suit, {
      cuts: [new Path2D('M 462 560 C 458 610, 456 650, 458 694')],
      paint: (c, sh) => {
        P.shade(sh, 444, 0, 506, 0, 0.48, 0.0);
        P.hl('M 484 557 L 491 580 L 482 600', 1.1, 0.45); P.hl('M 474 555 L 470 574 L 478 596', 1.0, 0.34);
        P.hl('M 452 580 C 450 620, 450 660, 452 690', 1.2, 0.22); P.hl('M 496 620 C 498 640, 499 660, 500 686', 0.9, 0.2);
        P.tr('M 480 600 L 480 690', 0.9, 0.85); P.dot(483, 636, 1.2, 0.9); P.dot(483, 660, 1.2, 0.9);
        P.hl('M 488 664 L 502 663', 1.0, 0.35); P.tr('M 450 690 C 468 698, 488 698, 506 690', 0.9, 0.6);
      },
    });
    glass(shape('M 473 553 L 485 555 L 479 580 Z'), G.white, { noStreak: true, clean: true, paint: () => { P.fill('M 477.6 557 L 481.4 557 L 480.6 571 L 479.2 574 L 477.6 570 Z', 0.88); } });
    glass(shape('M 472 540 L 486 542 L 486 556 L 471 554 Z'), G.flesh, { noStreak: true, clean: true, paint: (c, sh) => P.shade(sh, 471, 540, 471, 556, 0.55, 0.15) });
    glass(shape('M 470 510 C 479 507, 488 512, 490 520 L 494 527 L 490 529 C 491 534, 489 539, 485 542 C 480 545, 474 544, 470 540 C 466 534, 465 518, 470 510 Z'), G.flesh, {
      noStreak: true, clean: true,
      paint: (c, sh) => {
        P.shade(sh, 466, 0, 494, 0, 0.6, 0.0);
        P.mat('M 477 521 C 480 518.6, 484 518.6, 487 521', 4.4, 0.48); P.mat('M 489 526 C 489 530, 487 534, 483 538', 3.5, 0.4); P.mat('M 469 524 C 469 532, 473 540, 480 543', 6, 0.45);
        P.tr('M 476 516 C 479.4 514, 483.4 514.2, 487 516.4', 1.6);
        P.tr('M 477.6 521 C 480 519.4, 483.4 519.6, 485.8 521.6', 1.4); P.dot(483.1, 521.3, 1.35);
        P.tr('M 478.4 523.6 C 480.4 524.4, 483.4 524.4, 485.2 523.4', 0.6, 0.7);
        P.tr('M 488 517.4 L 493.2 526.6 L 489.6 528.6', 1.3); P.dot(489.8, 527.6, 0.7);
        P.tr('M 484 534 C 486.2 533.2, 488.4 533.6, 489.8 534.6', 1.2); P.tr('M 485.4 536.8 C 486.8 537.4, 488.4 537.4, 489.2 536.8', 0.55, 0.65);
        P.tr('M 472.4 524 C 475.6 521.6, 477.4 526, 474 530', 0.95);
        P.hl('M 482 509 C 485 510, 488 513, 489.4 517', 0.8, 0.45);
      },
    });
    glass(shape('M 466 528 C 461 516, 464 502, 476 498 C 488 495, 496 504, 494 514 C 490 510, 484 508, 478 509 C 472 511, 470 516, 470 522 L 470 536 C 467 534, 466 531, 466 528 Z'), [46, 32, 28], {
      noStreak: true, clean: true, edge: false,
      paint: () => { ['M 470 503 C 476 499, 484 499, 491 504', 'M 466 511 C 471 505, 479 503, 487 506', 'M 465 520 C 467 512, 473 508, 479 508', 'M 467 528 C 466 522, 468 516, 472 513'].forEach((d, i) => P.hl(d, 0.7, 0.28 - i * 0.03)); },
    });
    glass(shape('M 494 562 C 504 564, 510 576, 512 594 L 514 612 C 524 610, 536 608, 546 609 L 547 626 C 532 628, 516 632, 504 632 C 498 626, 494 612, 492 596 Z'), G.suit, {
      paint: () => { P.hl('M 502 570 C 507 580, 510 594, 511 608', 1.0, 0.34); P.tr('M 508 620 C 514 622, 520 622, 526 620', 0.9, 0.85); P.hl('M 518 614 L 544 612', 0.9, 0.28); ctx.fillStyle = 'rgba(230,236,226,0.85)'; ctx.fillRect(542, 609, 4.5, 17); },
    });
    glass(shape('M 545 609 C 552 607, 558 610, 560 615 C 558 621, 552 625, 546 626 Z'), G.flesh, { noStreak: true, clean: true, paint: () => P.tr('M 549 616 L 558 614 M 549 620 L 556 619', 0.65, 0.75) });

    // ----- the child, in the long christening gown
    glass(shape('M 514 610 C 506 620, 500 634, 497 654 C 493 700, 490 750, 486 800 C 500 808, 520 808, 534 800 C 531 760, 528 710, 528 670 C 528 650, 530 634, 536 622 Z'), G.white, {
      cuts: [new Path2D('M 516 624 C 512 680, 510 740, 510 806')],
      paint: (c, sh) => {
        P.shade(sh, 486, 0, 536, 0, 0.3, 0.0);
        P.fold([[510, 640], [506, 700], [502, 760], [498, 800]], 1, 0.9, 0.8); P.fold([[520, 650], [518, 710], [516, 770], [515, 800]], -1, 0.8, 0.6);
        P.fold([[528, 640], [528, 700], [527, 760], [527, 798]], 1, 0.7, 0.5);
        for (let k = 0; k < 5; k++) { const y = 690 + k * 20; P.tr(`M ${500 - k * 0.6} ${y} C ${506} ${y + 3}, ${516} ${y + 3}, ${526} ${y}`, 0.6, 0.5); }
      },
    });
    glass(shape('M 486 794 C 500 802, 520 802, 534 794 L 535 808 C 520 816, 500 816, 485 808 Z'), G.goldP, {
      noStreak: true,
      paint: () => { for (let k = 0; k < 7; k++) { const x = 489 + k * 7; P.dot(x, 804, 1.3, 0.85); P.tr(`M ${x - 3} 809 C ${x - 1} 812, ${x + 1} 812, ${x + 3} 809`, 0.7, 0.8); } P.tr('M 487 799 C 500 806, 520 806, 534 799', 0.6, 0.6); },
    });
    glass(shape('M 512 606 C 526 598, 548 597, 564 602 L 566 618 C 548 622, 528 624, 514 620 Z'), G.white, {
      paint: (c, sh) => { P.shade(sh, 0, 598, 0, 624, 0.0, 0.42); P.fold([[524, 602], [526, 612], [528, 621]], 1, 0.7, 0.5); P.fold([[542, 600], [544, 610], [545, 620]], 1, 0.7, 0.5); },
    });
    glass(shape('M 528 596 C 534 591, 544 591, 548 595 C 546 600, 538 602, 529 602 Z'), G.flesh, { noStreak: true, clean: true, paint: () => P.tr('M 533 595 L 545 594 M 532 598 L 544 598', 0.6, 0.7) });
    glass(shape('M 562 602 C 566 594, 578 593, 584 600 C 587 607, 585 615, 580 619 L 566 618 Z'), G.whiteW, { noStreak: true, clean: true, paint: () => { P.tr('M 566 600 C 571 596, 578 596, 582 601', 0.7, 0.7); for (let k = 0; k < 5; k++) P.dot(566 + k * 4, 600 - Math.sin(k * 0.8) * 1.4, 0.8, 0.7); } });
    glass(shape('M 569 604 C 573 601, 580 603, 581 609 C 581 614, 578 618, 573 618 C 569 617, 567 610, 569 604 Z'), G.flesh, {
      noStreak: true, clean: true,
      paint: (c, sh) => { P.shade(sh, 567, 0, 582, 0, 0.42, 0.0); P.tr('M 572.4 607.8 C 573.8 609, 575.6 609, 576.8 607.8', 1.0); P.tr('M 573.2 613.6 C 574.4 614.4, 575.8 614.4, 576.6 613.6', 0.8, 0.8); P.mat('M 569 610 C 569 614, 571 617, 574 617', 2.4, 0.35); },
    });

    // ----- the font in the glass
    glass(shape('M 541 806 L 605 806 L 613 842 L 533 842 Z'), G.stone, { paint: (c, sh) => { P.shade(sh, 533, 0, 613, 0, 0.0, 0.48); P.tr('M 539 814 L 607 814', 1.0); P.tr('M 536 828 L 610 828', 0.7, 0.6); P.stip(sh, 0.12); } });
    glass(shape('M 561 738 L 585 738 L 589 808 L 557 808 Z'), G.stone, { paint: (c, sh) => { P.shade(sh, 557, 0, 589, 0, 0.0, 0.5); P.tr('M 568 744 L 567 804 M 578 744 L 579 804', 0.8, 0.7); } });
    glass(shape('M 530 692 L 616 692 L 610 716 C 604 730, 590 738, 573 738 C 556 738, 542 730, 536 716 Z'), G.stone, {
      paint: (c, sh) => {
        P.shade(sh, 530, 0, 616, 0, 0.0, 0.48);
        for (let k = 0; k < 5; k++) { const x = 540 + k * 16.4; P.tr(`M ${x} 726 L ${x} 706 C ${x} 698, ${x + 12} 698, ${x + 12} 706 L ${x + 12} 726`, 0.9, 0.85); P.mat(`M ${x + 3} 705 L ${x + 3} 724`, 3, 0.3); P.dot(x + 6, 712, 1.1, 0.7); }
        P.tr('M 537 720 C 550 732, 596 732, 609 720', 0.7, 0.6);
      },
    });
    glass(shape('M 527 682 L 619 682 L 616 692 L 530 692 Z'), G.stoneL, { paint: () => { for (let x = 531; x < 616; x += 6) P.tr(`M ${x} 690 L ${x + 3} 684`, 0.6, 0.6); } });

    // ----- the priest's hand and the shell, the water falling
    glass(shape('M 630 590 C 620 594, 610 596, 600 590 L 596 600 C 604 608, 612 618, 618 632 C 624 634, 630 628, 632 618 Z'), G.white, {
      paint: (c, sh) => { P.shade(sh, 596, 0, 632, 0, 0.0, 0.35); P.fold([[604, 598], [612, 610], [618, 626]], 1, 0.8, 0.6); P.tr('M 598 598 C 600 602, 603 604, 606 604', 0.8, 0.7); },
    });
    glass(shape('M 588 586 C 592 582, 600 583, 601 589 L 598 597 L 590 597 Z'), G.flesh, { noStreak: true, clean: true, paint: () => P.tr('M 591 587 L 598 586 M 591 591 L 598 591', 0.6, 0.75) });
    glass(shape('M 572 588 C 576 580, 586 578, 591 584 L 586 598 C 580 598, 574 595, 572 588 Z'), G.goldP, { noStreak: true, clean: true, paint: () => { for (let k = 0; k < 6; k++) P.tr(`M 585 596 L ${573 + k * 3.4} ${587 - Math.sin(k * 0.62) * 5}`, 0.55, 0.8); } });
    glass(shape('M 576 596 C 575.4 599, 574.6 601.6, 574.4 604.4 L 571.2 604 C 571.8 601.2, 572.8 598.6, 574 596 Z'), G.aqua, { noStreak: true, noSeed: true, clean: true, lw: 1.8 });

    await K.br();
    // ----- pavement and the inscription in Lombardic capitals
    for (let k = 0; k < 16; k++) {
      const x = 356 + k * 23;
      glass(shape(`M ${x} 842 L ${x + 23} 842 L ${x + 23} 866 L ${x} 866 Z`), [G.gold, G.murrey, G.green][k % 3], {
        paint: () => { const m = x + 11.5; P.tr(`M ${m} 845.5 L ${m + 7.5} 854 L ${m} 862.5 L ${m - 7.5} 854 Z`, 1.0, 0.85); P.dot(m, 854, 1.6, 0.8); },
      });
    }
    glass(shape('M 356 866 L 724 866 L 724 893 L 356 893 Z'), G.whiteW, {
      paint: (c, sh) => {
        lombardic(ctx, 'ABRENVNTIO', 540, 879.5, 16.5, 22.5, 'rgba(28,17,10,0.92)');
        P.tr('M 372 870.5 L 708 870.5 M 372 889 L 708 889', 0.7, 0.6);
        [404, 676].forEach((x) => { P.dot(x, 880, 2.1, 0.85); P.dot(x - 7, 880, 1.1, 0.85); P.dot(x + 7, 880, 1.1, 0.85); });
        P.stip(sh, 0.08);
      },
    });
    ctx.restore();
    await K.border(op, { bw: 12, pw: 5.5, seg: 44 });
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
    await K.trellis([op.x0, 452, op.x1, 905], 30, BLUES.map((c) => mulc(c, 0.88)), RUBIES);
    // fleur-de-lis in the head
    glass(shape(`M ${cx} 494 C ${cx + 6} 502, ${cx + 6} 512, ${cx + 2} 520 L ${cx + 2} 526 L ${cx + 12} 526 C ${cx + 14} 514, ${cx + 22} 508, ${cx + 26} 514 C ${cx + 22} 516, ${cx + 18} 522, ${cx + 18} 530 L ${cx + 4} 532 L ${cx + 4} 538 L ${cx - 4} 538 L ${cx - 4} 532 L ${cx - 18} 530 C ${cx - 18} 522, ${cx - 22} 516, ${cx - 26} 514 C ${cx - 22} 508, ${cx - 14} 514, ${cx - 12} 526 L ${cx - 2} 526 L ${cx - 2} 520 C ${cx - 6} 512, ${cx - 6} 502, ${cx} 494 Z`), G.gold, {
      paint: () => { P.tr(`M ${cx} 500 L ${cx} 524 M ${cx - 14} 529 L ${cx + 14} 529`, 0.8, 0.8); },
    });
    await drawMedallion(K, ctx, cx, 632, 1, top.ring, SCENES[top.scene], R);
    await drawMedallion(K, ctx, cx, 808, 1, bottom.ring, SCENES[bottom.scene], R);
    ctx.restore();
    await K.border(op, { bw: 11, pw: 5, seg: 40 });
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
    ctx.fillStyle = '#121010'; ctx.fillRect(0, 0, W, H);
    // ashlar: dressed blocks, each a little different, with the mason's tooling and a worn arris
    for (let y = 0, row = 0; y < FLOOR_Y; y += 46, row++) {
      for (let x = (row % 2) * -48 - 10, col = 0; x < W; x += 96, col++) {
        const t = 0.86 + hash2(x + 300, row) * 0.26, c = mulc([25, 22, 19], t);
        const g = ctx.createLinearGradient(0, y, 0, y + 46);
        g.addColorStop(0, rgb(mulc(c, 1.12))); g.addColorStop(1, rgb(mulc(c, 0.88)));
        ctx.fillStyle = g; ctx.fillRect(x + 1.2, y + 1.2, 93.6, 43.6);
        ctx.save(); ctx.beginPath(); ctx.rect(x + 1.2, y + 1.2, 93.6, 43.6); ctx.clip();
        const ang = (hash2(col, row + 9) < 0.5 ? 1 : -1) * (0.9 + hash2(col + 3, row) * 0.3);
        ctx.strokeStyle = 'rgba(0,0,0,0.11)'; ctx.lineWidth = 0.6;
        for (let k = -10; k < 26; k++) { ctx.beginPath(); ctx.moveTo(x + k * 4.2, y); ctx.lineTo(x + k * 4.2 + 46 * ang, y + 46); ctx.stroke(); }
        ctx.restore();
        ctx.fillStyle = 'rgba(120,104,88,0.1)'; ctx.fillRect(x + 1.2, y + 1.2, 93.6, 1.1);
        ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(x + 1.2, y + 43.6, 93.6, 1.2);
      }
    }
  }
  // a carved head at the end of the hood mould
  function carvedHead(ctx, x, y, kind, side) {
    const lit = (x0, y0, x1, y1) => { const g = ctx.createLinearGradient(x0, y0, x1, y1); g.addColorStop(0, '#5c4e42'); g.addColorStop(0.55, '#33291f'); g.addColorStop(1, '#16120f'); return g; };
    const L = (x0) => lit(x + side * 12, y, x - side * 12, y + 20);
    const fp = (d) => { const p = new Path2D(d); return p; };
    ctx.save();
    ctx.fillStyle = '#0c0a09'; ctx.fillRect(x - 13, y - 2, 26, 4);
    if (kind === 'king') {
      ctx.fillStyle = L(); ctx.fill(fp(`M ${x - 9} ${y + 27} C ${x - 9.5} ${y + 40}, ${x - 3} ${y + 47}, ${x} ${y + 48} C ${x + 3} ${y + 47}, ${x + 9.5} ${y + 40}, ${x + 9} ${y + 27} C ${x + 5} ${y + 32}, ${x - 5} ${y + 32}, ${x - 9} ${y + 27} Z`));
      ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 0.7; for (let k = -2; k <= 2; k++) { ctx.beginPath(); ctx.moveTo(x + k * 3, y + 32); ctx.quadraticCurveTo(x + k * 3.4, y + 40, x + k * 1.6, y + 46); ctx.stroke(); }
    }
    ctx.fillStyle = L(); ctx.beginPath(); ctx.ellipse(x, y + 22, 9.6, 12.6, 0, 0, Math.PI * 2); ctx.fill();
    if (kind === 'king') { ctx.fillStyle = L(); ctx.fill(fp(`M ${x - 11} ${y + 13} L ${x - 11} ${y + 2} L ${x - 7} ${y + 7} L ${x - 3.5} ${y - 1} L ${x} ${y + 6} L ${x + 3.5} ${y - 1} L ${x + 7} ${y + 7} L ${x + 11} ${y + 2} L ${x + 11} ${y + 13} Z`)); }
    else { ctx.fillStyle = L(); ctx.fill(fp(`M ${x - 10.5} ${y + 13} C ${x - 11} ${y + 4}, ${x - 5} ${y - 5}, ${x} ${y - 9} C ${x + 5} ${y - 5}, ${x + 11} ${y + 4}, ${x + 10.5} ${y + 13} Z`)); ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(x, y - 7); ctx.lineTo(x, y + 12); ctx.moveTo(x - 10, y + 10); ctx.lineTo(x + 10, y + 10); ctx.stroke(); }
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    [-4, 4].forEach((dx) => { ctx.beginPath(); ctx.ellipse(x + dx, y + 20, 2.2, 1.0, 0, 0, Math.PI * 2); ctx.fill(); });
    ctx.strokeStyle = 'rgba(120,100,84,0.6)'; ctx.lineWidth = 1.1; ctx.beginPath(); ctx.moveTo(x + side * 0.5, y + 19); ctx.lineTo(x + side * 1.6, y + 27); ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,0.65)'; ctx.lineWidth = 0.9; ctx.beginPath(); ctx.moveTo(x - 3, y + 30); ctx.quadraticCurveTo(x, y + 31, x + 3, y + 30); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x - 5, y + 16); ctx.quadraticCurveTo(x - 3, y + 15, x - 1.5, y + 16.4); ctx.moveTo(x + 1.5, y + 16.4); ctx.quadraticCurveTo(x + 3, y + 15, x + 5, y + 16); ctx.stroke();
    ctx.restore();
  }
  function drawWindowStone(ctx, plan) {
    const outer = plan.outer;
    // hood mould
    const hood = archHead(OUTER.x0 - 92, OUTER.x1 + 92, OUTER.ys, OUTER.ya - 92 * 1.0);
    const hp = new Path2D(); hood.pts.forEach((q, i) => (i ? hp.lineTo(q.p[0], q.p[1]) : hp.moveTo(q.p[0], q.p[1])));
    ctx.lineCap = 'butt';
    // the hood mould: a roll between two hollows, its upper edge weathered, its underside in shadow
    ctx.strokeStyle = '#090807'; ctx.lineWidth = 20; ctx.stroke(hp);
    ctx.strokeStyle = '#211c18'; ctx.lineWidth = 15; ctx.stroke(hp);
    ctx.strokeStyle = '#100e0c'; ctx.lineWidth = 9; ctx.stroke(hp);
    ctx.strokeStyle = '#3a3129'; ctx.lineWidth = 5; ctx.stroke(hp);
    ctx.strokeStyle = 'rgba(110,92,76,0.55)'; ctx.lineWidth = 1.2; ctx.save(); ctx.translate(0, -1.6); ctx.stroke(hp); ctx.restore();
    ctx.strokeStyle = 'rgba(90,76,64,0.4)'; ctx.lineWidth = 1.2; ctx.save(); ctx.translate(0, -8.6); ctx.stroke(hp); ctx.restore();
    // label stops: a crowned king and a mitred bishop
    carvedHead(ctx, OUTER.x0 - 92, OUTER.ys + 6, 'king', 1);
    carvedHead(ctx, OUTER.x1 + 92, OUTER.ys + 6, 'bishop', -1);
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
    // where the stone is broad, the mason has carved blind trefoils into it
    const sc = ctx.getTransform().a, bpts = [];
    all.forEach((a) => a.forEach((q, i) => { if (i % 3 === 0) bpts.push(q); }));
    const cand = [];
    for (let y = 60; y < 600; y += 7) for (let x = 120; x < 960; x += 7) {
      if (!ctx.isPointInPath(plan.outer.p, x * sc, y * sc)) continue;
      if (ops.some((op) => ctx.isPointInPath(op.p, x * sc, y * sc))) continue;
      let d = 1e9; for (const q of bpts) { const dd = (q[0] - x) ** 2 + (q[1] - y) ** 2; if (dd < d) d = dd; }
      d = Math.sqrt(d); if (d > 21) cand.push([x, y, d]);
    }
    cand.sort((p, q) => q[2] - p[2]);
    const placed = [];
    for (const [x, y, d] of cand) {
      const r = Math.min(26, d - 9);
      if (placed.some(([px, py, pr]) => Math.hypot(px - x, py - y) < pr + r + 10)) continue;
      if (placed.length > 14) break;
      placed.push([x, y, r]);
    }
    placed.forEach(([x, y, r]) => {
      const f = foilOpening(x, y, r, 3, -Math.PI / 2 + (x < 540 ? 0.3 : -0.3), 0.5);
      ctx.beginPath(); ctx.arc(x, y, r + 3, 0, Math.PI * 2); ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = 1.2; ctx.stroke();
      ctx.fillStyle = '#141110'; ctx.fill(f.p);
      ctx.save(); ctx.clip(f.p); ctx.translate(1.4, 1.4); ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 3; ctx.stroke(f.p); ctx.restore();
      ctx.save(); ctx.translate(-0.8, -0.8); ctx.strokeStyle = 'rgba(98,84,70,0.4)'; ctx.lineWidth = 0.9; ctx.stroke(f.p); ctx.restore();
    });
    // a roll moulding down the face of each mullion
    [[343, 410, 905], [737, 410, 905]].forEach(([x, y0, y1]) => {
      ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(x - 5, y0 + 120, 10, y1 - y0 - 120);
      const g = ctx.createLinearGradient(x - 4, 0, x + 4, 0); g.addColorStop(0, '#2a241f'); g.addColorStop(0.45, '#5a4d42'); g.addColorStop(1, '#1a1613');
      ctx.fillStyle = g; ctx.fillRect(x - 4, y0 + 120, 8, y1 - y0 - 120);
    });
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
    // memorial tablets: a marble one under a pediment, a small brass one, an oval cartouche
    const lines = (x0, x1, y0, n, gap, col) => { ctx.strokeStyle = col; ctx.lineWidth = 0.7; for (let i = 0; i < n; i++) { const w = (x1 - x0) * (i === 0 ? 0.7 : 0.55 + hash2(i, x0) * 0.4); const xm = (x0 + x1) / 2; ctx.beginPath(); ctx.setLineDash([1.6, 0.9]); ctx.moveTo(xm - w / 2, y0 + i * gap); ctx.lineTo(xm + w / 2, y0 + i * gap); ctx.stroke(); } ctx.setLineDash([]); };
    ctx.fillStyle = '#0a0908'; ctx.beginPath(); ctx.moveTo(376, 942); ctx.lineTo(400, 928); ctx.lineTo(424, 942); ctx.lineTo(424, 990); ctx.lineTo(376, 990); ctx.closePath(); ctx.fill();
    let g2 = ctx.createLinearGradient(380, 0, 420, 0); g2.addColorStop(0, '#4a4540'); g2.addColorStop(1, '#6c665e');
    ctx.fillStyle = g2; ctx.fillRect(381, 946, 38, 38);
    ctx.fillStyle = '#3a3530'; ctx.beginPath(); ctx.moveTo(379, 942); ctx.lineTo(400, 931); ctx.lineTo(421, 942); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(150,140,128,0.45)'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(379, 942); ctx.lineTo(400, 931); ctx.lineTo(421, 942); ctx.stroke();
    ctx.strokeStyle = '#2a2622'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(400, 922); ctx.lineTo(400, 931); ctx.moveTo(396.5, 925); ctx.lineTo(403.5, 925); ctx.stroke();
    lines(384, 416, 952, 7, 4.4, 'rgba(20,16,12,0.7)');
    ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 0.8; ctx.strokeRect(381, 946, 38, 38);
    g2 = ctx.createLinearGradient(0, 950, 0, 978); g2.addColorStop(0, '#4c3c24'); g2.addColorStop(1, '#2e2414');
    ctx.fillStyle = '#090807'; ctx.fillRect(491, 949, 42, 30);
    ctx.fillStyle = g2; ctx.fillRect(493, 951, 38, 26);
    ctx.strokeStyle = 'rgba(170,140,90,0.45)'; ctx.lineWidth = 0.7; ctx.strokeRect(494.5, 952.5, 35, 23);
    lines(497, 527, 957, 5, 4, 'rgba(14,10,6,0.75)');
    ctx.fillStyle = '#0a0908'; ctx.beginPath(); ctx.ellipse(91, 962, 15, 20, 0, 0, Math.PI * 2); ctx.fill();
    g2 = ctx.createLinearGradient(78, 0, 104, 0); g2.addColorStop(0, '#3e3a35'); g2.addColorStop(1, '#5c5750');
    ctx.fillStyle = g2; ctx.beginPath(); ctx.ellipse(91, 962, 12, 17, 0, 0, Math.PI * 2); ctx.fill();
    lines(84, 98, 953, 5, 4.2, 'rgba(20,16,12,0.65)');
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
          let tr = 1, tg = 1, tb = 1;
          // an encaustic pavement down the middle: red and buff tiles with inlaid quatrefoils and lozenges, framed in black
          if (X > -0.2 && X < 1.55 && Z > 5.4 && Z < 18.6) {
            const TS = 0.19, ti = Math.floor((X + 0.2) / TS), tj = Math.floor((Z - 5.4) / TS);
            const u = (X + 0.2) / TS - ti, v = (Z - 5.4) / TS - tj;
            const tpx = TS / Math.max(pxw, pzw), detail = clamp((tpx - 3) / 6, 0, 1);
            const edge = ti === 0 || ti === 8 || X > 1.52;
            let cr, cg, cb;
            if (edge) { cr = 0.06; cg = 0.055; cb = 0.05; }
            else if ((ti + tj) & 1) {
              // buff tile, black lozenge, red centre
              const dd = Math.abs(u - 0.5) + Math.abs(v - 0.5);
              const loz = clamp(1 - Math.abs(dd - 0.32) / 0.06, 0, 1) * detail, ctr = clamp(1 - (dd - 0.1) / 0.04, 0, 1) * detail;
              cr = lerp(lerp(0.5, 0.07, loz), 0.42, ctr); cg = lerp(lerp(0.38, 0.06, loz), 0.12, ctr); cb = lerp(lerp(0.22, 0.05, loz), 0.07, ctr);
              const mr = 0.42, mg = 0.31, mb = 0.18; cr = lerp(mr, cr, detail); cg = lerp(mg, cg, detail); cb = lerp(mb, cb, detail);
            } else {
              // red tile, buff quatrefoil
              let q = 0;
              for (const [ox, oy] of [[0.18, 0], [-0.18, 0], [0, 0.18], [0, -0.18]]) { const d0 = Math.hypot(u - 0.5 - ox, v - 0.5 - oy); q = Math.max(q, clamp(1 - Math.abs(d0 - 0.16) / 0.05, 0, 1)); }
              q *= detail;
              cr = lerp(0.4, 0.46, q); cg = lerp(0.14, 0.33, q); cb = lerp(0.08, 0.2, q);
            }
            const gu = Math.min(u, 1 - u) * TS / pxw, gv = Math.min(v, 1 - v) * TS / pzw;
            const grout = clamp(1.2 - Math.min(gu, gv), 0, 1) * clamp(tpx / 4, 0, 1) * 0.6;
            const tt = 0.92 + hash2(ti + 51, tj + 17) * 0.14;
            alb = 0.62 * tt * (1 - grout); tr = cr; tg = cg; tb = cb;
          }
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
          let R1 = alb * tr * (amb * 0.9 + K * lr + cw2 * 1.0);
          let G1 = alb * tg * (amb * 0.95 + K * lg + cw2 * 0.62);
          let B1 = alb * tb * (amb * 1.15 + K * lb + cw2 * 0.3);
          if (tr !== 1) { R1 *= 1.25; G1 *= 1.25; B1 *= 1.25; }
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
    // a poppyhead finial on the front post, carved in the round
    const fb = P(xa + 0.03, 0.995, zf + 0.06), fk = F / (zf + 0.06);
    const pp = [[-0.03, 0], [-0.034, 0.04], [-0.068, 0.068], [-0.062, 0.1], [-0.032, 0.086], [-0.016, 0.13], [0, 0.17], [0.016, 0.13], [0.032, 0.086], [0.062, 0.1], [0.068, 0.068], [0.034, 0.04], [0.03, 0]].map(([u, v]) => [fb[0] + u * fk, fb[1] - v * fk]);
    const fgr = ctx.createLinearGradient(fb[0] - 0.07 * fk, 0, fb[0] + 0.07 * fk, 0);
    fgr.addColorStop(0, L([col[0] * 1.2 + 0.02, col[1] * 1.2 + 0.02, col[2] * 1.2 + 0.02], [ambF[0] * 2.6, ambF[1] * 2.6, ambF[2] * 2.6])); fgr.addColorStop(1, L([0, 0, 0], [0.03, 0.028, 0.03]));
    fill(pp, fgr);
    strokeP([[fb[0], fb[1] - 0.02 * fk], [fb[0], fb[1] - 0.15 * fk]], 'rgba(0,0,0,0.45)', 0.7);
    strokeP([[fb[0] - 0.05 * fk, fb[1] - 0.075 * fk], [fb[0] - 0.02 * fk, fb[1] - 0.06 * fk]], 'rgba(0,0,0,0.45)', 0.6);
    strokeP([[fb[0] + 0.05 * fk, fb[1] - 0.075 * fk], [fb[0] + 0.02 * fk, fb[1] - 0.06 * fk]], 'rgba(0,0,0,0.45)', 0.6);
    // the near rows: a hassock pushed out into the aisle, and now and then a prayer book left on it
    if (z === 6.8 || z === 9.2 || z === 11.6) {
      const hs = hash2(Math.round(z * 10), 5);
      const kc = hs < 0.5 ? [116, 26, 32] : [38, 66, 48];
      const hx0 = x0 - 0.3 - hs * 0.16, hx1 = hx0 + 0.26, hz0 = z + 0.02 + hs * 0.12, hz1 = hz0 + 0.26, hy = 0.11;
      fill([P(hx0, 0.01, hz0), P(hx0, hy, hz0), P(hx0, hy, hz1), P(hx0, 0.01, hz1)], rgb(litColour(kc, bounce, [0.05, 0.045, 0.045])));
      fill([P(hx0, 0.01, hz0), P(hx1, 0.01, hz0), P(hx1, hy, hz0), P(hx0, hy, hz0)], rgb(litColour(kc, bounce, [0.07, 0.06, 0.06])));
      const top = [P(hx0, hy, hz0), P(hx1, hy, hz0), P(hx1, hy, hz1), P(hx0, hy, hz1)];
      fill(top, rgb(litColour(kc, [bounce[0] * 1.5, bounce[1] * 1.5, bounce[2] * 1.5], [0.12, 0.1, 0.1])));
      const m0 = P((hx0 + hx1) / 2, hy, hz0 + 0.04), m1 = P((hx0 + hx1) / 2, hy, hz1 - 0.04), n0 = P(hx0 + 0.05, hy, (hz0 + hz1) / 2), n1 = P(hx1 - 0.05, hy, (hz0 + hz1) / 2);
      strokeP([m0, m1], 'rgba(214,180,110,0.4)', 0.9); strokeP([n0, n1], 'rgba(214,180,110,0.4)', 0.9);
      strokeP(top.concat([top[0]]), 'rgba(0,0,0,0.5)', 0.6);
      if (hs > 0.35) {
        const bx0 = hx0 + 0.04, bx1 = bx0 + 0.14, bz0 = hz0 + 0.03, bz1 = bz0 + 0.2, by = hy + 0.03;
        fill([P(bx0, hy, bz0), P(bx1, hy, bz0), P(bx1, by, bz0), P(bx0, by, bz0)], 'rgba(214,200,172,0.45)');
        fill([P(bx0, by, bz0), P(bx1, by, bz0), P(bx1, by, bz1), P(bx0, by, bz1)], rgb(litColour([36, 26, 24], [0.02, 0.02, 0.02], [0.1, 0.09, 0.09])));
        strokeP([P(bx0 + 0.07, by, bz0), P(bx0 + 0.074, by - 0.05, bz0 - 0.005)], 'rgba(170,30,30,0.75)', 0.8);
        strokeP([P(bx0 + 0.02, by + 0.001, bz0 + 0.03), P(bx1 - 0.02, by + 0.001, bz0 + 0.03)], 'rgba(200,170,100,0.35)', 0.6);
      }
    }
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
    // four slender shafts round the stem, the near ones
    for (let k = 0; k < 4; k++) {
      const a = k * Math.PI / 2 + Math.PI / 4, sx = fx + Math.cos(a) * 0.205, sz = fz + Math.sin(a) * 0.205;
      if (sz > fz + 0.02) continue;
      const p0 = proj(sx, 0.3, sz), p1 = proj(sx, 0.56, sz), wpx = 0.034 * F / sz;
      const g = ctx.createLinearGradient(p0[0] - wpx / 2, 0, p0[0] + wpx / 2, 0);
      g.addColorStop(0, rgb(litColour(marble, [0.02, 0.02, 0.02], amb))); g.addColorStop(0.4, rgb(litColour(marble, [0.06, 0.055, 0.05], amb))); g.addColorStop(1, rgb(litColour(marble, [0, 0, 0], [0.03, 0.03, 0.035])));
      ctx.fillStyle = g; ctx.fillRect(p0[0] - wpx / 2, p1[1], wpx, p0[1] - p1[1]);
      ctx.fillStyle = rgb(litColour(marble, [0.04, 0.04, 0.04], amb));
      ctx.fillRect(p0[0] - wpx * 0.8, p1[1] - 1.2, wpx * 1.6, 2.4); ctx.fillRect(p0[0] - wpx * 0.8, p0[1] - 1.2, wpx * 1.6, 2.4);
    }
    prism(0.23, 0.23, 0.56, 0.62, amb);
    // bowl underside then the bowl and its lip
    prism(0.23, 0.5, 0.62, 0.74, [0.03, 0.03, 0.036]);
    const faces = prism(0.5, 0.5, 0.74, 0.95, amb);
    prism(0.535, 0.535, 0.95, 1.0, amb);
    // dogtooth carved along the top of the bowl
    faces.forEach((f) => {
      const a0 = f.k * Math.PI / 4 + Math.PI / 8;
      for (let t = 0.1; t < 0.95; t += 0.16) {
        const a = a0 + Math.PI / 4 * t, r = 0.5 / Math.cos(Math.PI / 8 - Math.abs(Math.PI / 4 * t - Math.PI / 8));
        const cxw = fx + Math.cos(a) * r, czw = fz + Math.sin(a) * r, tx = -Math.sin(a) * 0.02, tz = Math.cos(a) * 0.02;
        const c = proj(cxw, 0.915, czw), l = proj(cxw - tx, 0.915, czw - tz), rr = proj(cxw + tx, 0.915, czw + tz), up = proj(cxw, 0.935, czw), dn = proj(cxw, 0.895, czw);
        ctx.beginPath(); ctx.moveTo(up[0], up[1]); ctx.lineTo(rr[0], rr[1]); ctx.lineTo(dn[0], dn[1]); ctx.lineTo(l[0], l[1]); ctx.closePath(); ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fill();
        ctx.beginPath(); ctx.moveTo(up[0], up[1]); ctx.lineTo(l[0], l[1]); ctx.lineTo(c[0], c[1]); ctx.closePath(); ctx.fillStyle = 'rgba(255,244,228,0.12)'; ctx.fill();
      }
    });
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
    bl(Math.max(1, 40 * scale / 2), 6, 0.4); await breathe();
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
