/* rock.js: the cellular rock language.
   A warped, anisotropic Voronoi crack network with variable cell size (big
   blocky cells on the faces, small cells in clefts). Each cell is either a
   rounded lump (concentric contour crescents on its shadow side) or a flat
   facet (parallel hatch in its own direction). Crack lines are weighted by
   which way the cell edge faces; black undercut wedges sit under blocks in shadow. */
(function () {
  'use strict';
  const LW = window.LW;
  const P = LW.P;

  /* o: { path, bbox, mask, dark(x,y), size(x,y) (seed spacing px), aniso, seed,
          kind, pal, ink, lineW:[w0,w1], step, light:[lx,ly], lumpRatio,
          wedge, rim(x,y)->0..1, flow(x,y)->angle, fillOnly } */
  LW.cellRock = function (ctx, S, o) {
    const t0 = performance.now();
    const bb = o.bbox;
    const ay = o.aniso || 1.4;
    const rng = new LW.RNG('cells-' + o.seed);
    const Nw = new LW.Noise(LW.hashStr('w' + o.seed));
    const Nw2 = new LW.Noise(LW.hashStr('v' + o.seed));
    const mask = o.mask;
    const kind = o.kind || 'rock';
    const [Lx, Ly] = o.light || [0.6, -0.8];
    const warp = (x, y) => [
      x + 15 * Nw.n2(x / 75, y / 75) + 5 * Nw2.n2(x / 21, y / 21),
      y + 15 * Nw2.n2(x / 75 + 9, y / 75) + 5 * Nw.n2(x / 21 + 4, y / 21),
    ];
    // ---- seeds: variable-radius dart throwing in anisotropic space
    const sx = [], sy = [], sr = [];
    const maxSp = o.maxSize || 140;
    const hc = maxSp;
    const hx0 = bb[0] - 40, hy0 = (bb[1] - 40) / ay;
    const hw = Math.ceil((bb[2] - bb[0] + 80) / hc) + 1, hh = Math.ceil(((bb[3] - bb[1] + 80) / ay) / hc) + 1;
    const hash = new Array(hw * hh);
    const hkey = (x, yy) => {
      const i = Math.floor((x - hx0) / hc), j = Math.floor((yy - hy0) / hc);
      if (i < 0 || j < 0 || i >= hw || j >= hh) return -1;
      return j * hw + i;
    };
    {
      const cand = [];
      const g = 9;
      for (let yy = (bb[1] - 30) / ay; yy < (bb[3] + 30) / ay; yy += g)
        for (let x = bb[0] - 30; x < bb[2] + 30; x += g) cand.push([x + rng.next() * g, yy + rng.next() * g]);
      for (let i = cand.length - 1; i > 0; i--) {
        const j = Math.floor(rng.next() * (i + 1));
        const t = cand[i]; cand[i] = cand[j]; cand[j] = t;
      }
      for (const [x, yy] of cand) {
        const y = yy * ay;
        if (!mask.in(LW.clamp(x, bb[0] + 2, bb[2] - 2), LW.clamp(y, bb[1] + 2, bb[3] - 2)) && !mask.in(x, y)) {
          // allow a margin of seeds just outside so edge cells are complete
          if (mask.edtAt(x, y) <= 0 && rng.next() < 0.7) continue;
        }
        const r = Math.min(maxSp, o.size(x, y));
        const k = hkey(x, yy);
        if (k < 0) continue;
        const ci = k % hw, cj = Math.floor(k / hw);
        let ok = true;
        for (let j = cj - 1; j <= cj + 1 && ok; j++) {
          if (j < 0 || j >= hh) continue;
          for (let i = ci - 1; i <= ci + 1 && ok; i++) {
            if (i < 0 || i >= hw) continue;
            const a = hash[j * hw + i];
            if (!a) continue;
            for (const s of a) {
              const dx = sx[s] - x, dy = sy[s] - yy;
              const lim = 0.5 * (r + sr[s]);
              if (dx * dx + dy * dy < lim * lim) { ok = false; break; }
            }
          }
        }
        if (!ok) continue;
        const id = sx.length;
        sx.push(x); sy.push(yy); sr.push(r);
        (hash[k] || (hash[k] = [])).push(id);
      }
    }
    const nC = sx.length;
    // ---- per-cell attributes
    const type = new Uint8Array(nC), tone = new Float32Array(nC), dirx = new Float32Array(nC), diry = new Float32Array(nC);
    for (let c = 0; c < nC; c++) {
      type[c] = rng.next() < (o.lumpRatio === undefined ? 0.62 : o.lumpRatio) ? 1 : 0;
      // facet tilt -> lambert delta
      const tx = (rng.next() - 0.5) * 0.9, ty = (rng.next() - 0.5) * 0.9;
      tone[c] = -(tx * Lx + ty * Ly) * 0.32 + (rng.next() - 0.5) * 0.08;
      const base = o.flow ? o.flow(sx[c], sy[c] * ay) : Math.PI / 2;
      const a = base + (rng.next() - 0.5) * 1.4 + (rng.next() < 0.3 ? Math.PI / 2 : 0);
      dirx[c] = Math.cos(a); diry[c] = Math.sin(a);
    }
    // ---- grid: nearest cell id + edge distance
    const g = o.grid || 3;
    const nx = Math.ceil((bb[2] - bb[0]) / g) + 1, ny = Math.ceil((bb[3] - bb[1]) / g) + 1;
    const ID = new Int32Array(nx * ny).fill(-1);
    const ED = new Float32Array(nx * ny);
    for (let j = 0; j < ny; j++) {
      const y = bb[1] + j * g;
      for (let i = 0; i < nx; i++) {
        const x = bb[0] + i * g;
        if (!mask.in(x, y)) continue;
        const q = warp(x, y);
        const qx = q[0], qy = q[1] / ay;
        const k = hkey(qx, qy);
        if (k < 0) continue;
        const ci = k % hw, cj = Math.floor(k / hw);
        let b1 = -1, d1 = 1e18, b2 = -1, d2 = 1e18;
        for (let jj = cj - 1; jj <= cj + 1; jj++) {
          if (jj < 0 || jj >= hh) continue;
          for (let ii = ci - 1; ii <= ci + 1; ii++) {
            if (ii < 0 || ii >= hw) continue;
            const a = hash[jj * hw + ii];
            if (!a) continue;
            for (const s of a) {
              const dx = sx[s] - qx, dy = sy[s] - qy;
              const d = dx * dx + dy * dy;
              if (d < d1) { d2 = d1; b2 = b1; d1 = d; b1 = s; }
              else if (d < d2) { d2 = d; b2 = s; }
            }
          }
        }
        if (b1 < 0) continue;
        let ed = 60;
        if (b2 >= 0) {
          const ex = sx[b2] - sx[b1], ey = sy[b2] - sy[b1];
          ed = (d2 - d1) / (2 * Math.hypot(ex, ey));
        }
        ID[j * nx + i] = b1;
        ED[j * nx + i] = ed;
      }
    }
    const at = (x, y) => {
      const i = Math.round((x - bb[0]) / g), j = Math.round((y - bb[1]) / g);
      if (i < 0 || j < 0 || i >= nx || j >= ny) return -1;
      return j * nx + i;
    };
    const facing = (c, x, y) => {
      const q = warp(x, y);
      const dx = q[0] - sx[c], dy = q[1] / ay - sy[c];
      const L = Math.hypot(dx, dy) || 1;
      return (dx * Lx + dy * Ly) / L * Math.min(1, L / (sr[c] * 0.35));
    };
    // local value: global value + facet tone + lump roundness
    const localDark = (x, y) => {
      const k = at(x, y);
      let d = o.dark(x, y);
      if (k < 0 || ID[k] < 0) return d;
      const c = ID[k];
      d += tone[c];
      if (type[c]) d -= 0.3 * facing(c, x, y);
      return d;
    };
    const pal = o.pal;
    // ---- fill
    LW.shadeFill(ctx, S, o.path, bb, (x, y, out) => {
      const k = at(x, y);
      let d = o.dark(x, y);
      let crack = false;
      if (k >= 0 && ID[k] >= 0) {
        const c = ID[k];
        d += tone[c] * 0.8;
        if (type[c]) d -= 0.14 * facing(c, x, y);
        if (ED[k] < 1.3) crack = true;
      }
      let col = LW.stepPick(pal, LW.clamp(crack ? d + 0.3 : d, 0, 0.999), x, y, 0.03);
      if (o.rim) {
        const r = o.rim(x, y);
        if (r > 0.5) col = LW.mix(col, o.rimCol || P.water2, 0.55);
      }
      if (kind !== 'far') {
        const b = LW.warmBand(LW.warm(x, y, kind), x, y);
        if (b > 0) col = crack ? LW.warmFill[Math.max(1, b - 2)] : LW.warmFill[b];
      }
      out[0] = col[0]; out[1] = col[1]; out[2] = col[2];
    });
    if (o.fillOnly) return;
    const ink = new LW.Ink(LW.hashStr('ri' + o.seed));
    ink.wobble = o.wobble === undefined ? 0.8 : o.wobble;
    const baseInk = o.ink || P.ink;
    const warmInks = [0, 1, 2, 3, 4, 5, 6].map((b) => ink.col(LW.warmInkColor(b, baseInk)));
    const rimInk = ink.col(LW.mix(baseInk, P.water1, 0.75));
    const colAt = (x, y) => {
      if (kind !== 'far') {
        const b = LW.warmBand(LW.warm(x, y, kind), x, y);
        if (b > 0) return warmInks[b];
      }
      if (o.rim && o.rim(x, y) > 0.5) return rimInk;
      return warmInks[0];
    };
    const [w0, w1] = o.lineW || [1.2, 2.6];
    const step = o.step || 5.5;
    // ---- black undercut wedges along the upper edges of cells in shadow
    if (o.wedge !== false) {
      const WV = new Float32Array(nx * ny);
      const maxW = o.wedgeW || 11;
      for (let j = 0; j < ny; j++) {
        for (let i = 0; i < nx; i++) {
          const k = j * nx + i;
          const c = ID[k];
          if (c < 0) { WV[k] = -5; continue; }
          const x = bb[0] + i * g, y = bb[1] + j * g;
          if (i === 0 || j === 0 || i === nx - 1 || j === ny - 1) { WV[k] = -5; continue; }
          const q = warp(x, y);
          const up = (q[1] / ay - sy[c]) / sr[c]; // negative = upper half of the cell
          const dn = LW.smooth(0.05, -0.45, up);
          let d = o.dark(x, y) + tone[c];
          if (kind !== 'far') d -= 0.3 * LW.clamp(LW.warm(x, y, kind), 0, 1);
          const w = maxW * LW.smooth(0.5, 0.95, d) * dn * (0.6 + 0.8 * (0.5 + 0.5 * Nw.n2(x / 40, y / 40)));
          WV[k] = w - ED[k];
        }
      }
      const path = new Path2D();
      let any = false;
      LW.contours({ bbox: bb, step: g, values: WV, levels: [0] }, (pts) => {
        if (pts.length < 4) return;
        const sm = LW.chaikin(pts, 1, true);
        path.moveTo(sm[0][0], sm[0][1]);
        for (let i = 1; i < sm.length; i++) path.lineTo(sm[i][0], sm[i][1]);
        path.closePath();
        any = true;
      });
      if (any) ink.fillPath(path, o.black || P.ink, 'evenodd');
    }
    // ---- hatching: lumps = concentric contours of edge distance; facets = own-direction parallels
    {
      const F = new Float32Array(nx * ny);
      for (let j = 0; j < ny; j++) {
        for (let i = 0; i < nx; i++) {
          const k = j * nx + i;
          const c = ID[k];
          if (c < 0) { F[k] = NaN; continue; }
          const x = bb[0] + i * g, y = bb[1] + j * g;
          if (type[c]) F[k] = ED[k] + 0.6 * Nw.n2(x / 9, y / 9);
          else F[k] = x * dirx[c] + y * diry[c] + 8 * Nw2.n2(x / 60, y / 60) + 2.5 * Nw.n2(x / 17, y / 17) + c * 1.618;
        }
      }
      LW.contours({ bbox: bb, step: g, values: F, ids: ID, levelStep: step, levelOffset: 0.5 }, (pts, lev) => {
        const k0 = at(pts[0][0], pts[0][1]);
        const c = k0 >= 0 ? ID[k0] : -1;
        const isLump = c >= 0 && type[c] === 1;
        const L = isLump ? lev + 1 : lev; // ring index from the crack for lumps
        const rank = L % 4 === 0 ? 0 : L % 2 === 0 ? 1 : 2;
        ink.line(pts, (x, y) => {
          let d = localDark(x, y);
          if (kind !== 'far') d -= 0.24 * LW.clamp(LW.warm(x, y, kind), 0, 1.1);
          // the first ring next to the crack carries the edge of the block
          if (isLump && L === 1) {
            if (d < 0.18) return -1;
          } else {
            if (rank === 2 && d < 0.62) return -1;
            if (rank === 1 && d < 0.4) return -1;
            if (rank === 0 && d < 0.2) return -1;
          }
          const w = w0 + (w1 - w0) * LW.clamp(d, 0, 1);
          return ink.st(colAt(x, y), w);
        }, { taper: 9 });
      });
    }
    // ---- crack lines: both sides of every cell edge; thick where the edge faces away from the light
    {
      LW.contours({ bbox: bb, step: g, values: ED.map((v, k) => (ID[k] < 0 ? NaN : v)), ids: null, levels: [1.1] }, (pts) => {
        if (pts.length < 3) return;
        ink.line(pts, (x, y) => {
          const k = at(x, y);
          const c = k >= 0 ? ID[k] : -1;
          if (c < 0) return -1;
          const f = facing(c, x, y);
          let d = o.dark(x, y);
          if (kind !== 'far') d -= 0.4 * LW.clamp(LW.warm(x, y, kind), 0, 1);
          const w = (o.crackW || 1) * (0.9 + Math.max(0, -f) * 2.1 + 0.9 * LW.clamp(d, 0, 1));
          return ink.st(colAt(x, y), w);
        }, { taper: 6 });
      });
    }
    ctx.save();
    ctx.clip(o.path);
    ink.flush(ctx);
    ctx.restore();
    LW.log('cellRock', o.seed, 'cells', nC, 'ms', Math.round(performance.now() - t0));
    return { ID, ED, nx, ny, g, type, sx, sy, sr };
  };
})();
