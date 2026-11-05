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
      let d = o.dark(x, y) + (o.markBias || 0);
      if (k < 0 || ID[k] < 0) return d;
      const c = ID[k];
      d += tone[c];
      if (type[c]) d -= 0.3 * facing(c, x, y);
      return d;
    };
    const pal = o.pal;
    const texO = { cell: o.texCell || 3.6, dark: 0.13, ramp: 0.62, light: 0.04, seed: LW.hashStr('f' + o.seed) & 0xffff, ang: o.texAng === undefined ? Math.PI / 2 : o.texAng, stretch: o.texStretch || 1.7 };
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
      let col = LW.texPick(pal, LW.clamp(crack ? d + 0.3 : d, 0, 0.999), x, y, 0.03, texO);
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
    const dots = new LW.Dots();
    if ((o.tex === undefined ? 1 : o.tex) > 0) LW.rockTexture(o, { ink, dots, ID, ED, nx, ny, g, bb, nC, sx, sy, sr, ay, type, dirx, diry, localDark, colAt, at, kind, w0, w1, step, baseInk, Nw2 });
    ctx.save();
    ctx.clip(o.path);
    ink.flush(ctx);
    dots.flush(ctx);
    ctx.restore();
    LW.log('cellRock', o.seed, 'cells', nC, 'ms', Math.round(performance.now() - t0));
    return { ID, ED, nx, ny, g, type, sx, sy, sr };
  };

  /* Surface texture for a cellular rock: everything is a mark.
     o.tex scales density; options: o.xhatch, o.lichen, o.moss, o.stains, o.strata,
     o.pitStep, o.lichenCol. c: shared state from cellRock. */
  LW.rockTexture = function (o, c) {
    const T = o.tex === undefined ? 1 : o.tex;
    const { ink, dots, ID, ED, nx, ny, g, bb, nC, sx, sy, sr, ay, dirx, diry, localDark, colAt, at, kind, w0, w1, step, baseInk } = c;
    const mask = o.mask;
    const tr = new LW.RNG('tex-' + o.seed);
    const Nt = new LW.Noise(LW.hashStr('t' + o.seed));
    const warmOn = kind !== 'far';
    const wv = (x, y) => (warmOn ? LW.clamp(LW.warm(x, y, kind), 0, 1.1) : 0);
    const dk = (x, y) => localDark(x, y) - 0.28 * wv(x, y);
    const inkStr = [0, 1, 2, 3, 4, 5, 6].map((b) => LW.rgb(LW.warmInkColor(b, baseInk)));
    const dotInk = (x, y) => {
      if (!warmOn) return inkStr[0];
      return inkStr[LW.warmBand(LW.warm(x, y, kind), x, y, 0)];
    };
    const inside = (x, y) => mask.in(x, y) && at(x, y) >= 0 && ID[at(x, y)] >= 0;

    // ---- 1. cross-hatching laid over the hatch in shadow (a second direction per cell)
    if (o.xhatch !== false) {
      const ca = new Float32Array(nC), sa = new Float32Array(nC);
      for (let k = 0; k < nC; k++) {
        const a = Math.atan2(diry[k], dirx[k]) + (tr.next() < 0.5 ? 1 : -1) * (0.95 + tr.next() * 0.35);
        ca[k] = Math.cos(a); sa[k] = Math.sin(a);
      }
      const F2 = new Float32Array(nx * ny);
      for (let j = 0; j < ny; j++) {
        for (let i = 0; i < nx; i++) {
          const k = j * nx + i;
          const cc = ID[k];
          if (cc < 0) { F2[k] = NaN; continue; }
          const x = bb[0] + i * g, y = bb[1] + j * g;
          F2[k] = x * ca[cc] + y * sa[cc] + 4 * c.Nw2.n2(x / 50, y / 50) + cc * 2.31;
        }
      }
      const xs = step * (o.xStep || 1.25);
      const th0 = o.xThresh || 0.64;
      LW.contours({ bbox: bb, step: g, values: F2, ids: ID, levelStep: xs, levelOffset: 0.3 }, (pts, lev) => {
        ink.line(pts, (x, y) => {
          const d = dk(x, y);
          if (d < (lev % 2 ? th0 + 0.16 : th0)) return -1;
          if (Nt.n2(x / 26, y / 26 + lev * 0.3) > 0.58) return -1;
          return ink.st(colAt(x, y), (w0 + (w1 - w0) * LW.clamp(d, 0, 1)) * 0.7);
        }, { taper: 7 });
      });
    }
    // ---- 2. fine fracture lines wandering in from the cell edges
    {
      const fp = (o.fracture === undefined ? 0.6 : o.fracture) * T;
      for (let k = 0; k < nC; k++) {
        if (tr.next() > fp) continue;
        const n = 1 + (tr.next() < 0.35 ? 1 : 0);
        for (let f = 0; f < n; f++) {
          const a0 = tr.next() * Math.PI * 2;
          let x = sx[k] + Math.cos(a0) * sr[k] * 0.3, y = sy[k] * ay + Math.sin(a0) * sr[k] * 0.3 * ay;
          if (!inside(x, y)) continue;
          const id = ID[at(x, y)];
          let a = a0 + Math.PI + (tr.next() - 0.5) * 1.2;
          const pts = [[x, y]];
          const maxL = sr[k] * (0.35 + tr.next() * 0.5);
          for (let s = 0; s < maxL; s += 3.5) {
            a += (tr.next() - 0.5) * 0.9;
            x += Math.cos(a) * 3.5; y += Math.sin(a) * 3.5;
            const kk = at(x, y);
            if (kk < 0 || ID[kk] !== id || ED[kk] < 1.5) break;
            pts.push([x, y]);
            if (tr.next() < 0.06) {
              let bx = x, by = y, ba = a + (tr.next() < 0.5 ? 1 : -1) * (0.7 + tr.next() * 0.5);
              const bp = [[bx, by]];
              for (let q = 0; q < 5; q++) { ba += (tr.next() - 0.5) * 0.7; bx += Math.cos(ba) * 3; by += Math.sin(ba) * 3; const k2 = at(bx, by); if (k2 < 0 || ID[k2] !== id) break; bp.push([bx, by]); }
              if (bp.length > 2) ink.line(bp, (xx, yy) => (dk(xx, yy) < 0.12 ? -1 : ink.st(colAt(xx, yy), 0.7)), { taper: 6, minScale: 0.25 });
            }
          }
          if (pts.length < 3) continue;
          ink.line(pts, (xx, yy) => {
            const d = dk(xx, yy);
            if (d < 0.1) return -1;
            return ink.st(colAt(xx, yy), 0.7 + 0.55 * LW.clamp(d, 0, 1));
          }, { taper: 9, minScale: 0.2 });
        }
      }
    }
    // ---- 3. pitting stipple (density follows value) with tiny shadowed pits
    {
      const ps = o.pitStep || 6.2;
      for (let y = bb[1]; y < bb[3]; y += ps) {
        for (let x = bb[0]; x < bb[2]; x += ps) {
          const px = x + tr.next() * ps, py = y + tr.next() * ps;
          const r0 = tr.next(), r1 = tr.next(), r2 = tr.next();
          if (!inside(px, py)) continue;
          const d = dk(px, py);
          const p = ((o.pitBase || 0.07) + 0.55 * LW.smooth(0.25, 1.0, d)) * T * (0.55 + 0.9 * LW.clamp(0.5 + Nt.n2(px / 80, py / 80), 0, 1));
          if (r0 > p) continue;
          if (r1 < 0.16 && d > 0.2) {
            // a pit: little cup with its shadow on the upper rim
            const rr = 1.4 + r2 * 1.8;
            const arc = [];
            for (let a = Math.PI * 1.05; a <= Math.PI * 1.95; a += 0.3) arc.push([px + Math.cos(a) * rr, py + Math.sin(a) * rr * 0.75]);
            ink.line(arc, ink.st(colAt(px, py), 0.9), { taper: 0, wobble: 0.15 });
          } else dots.dot(px, py, 0.55 + r2 * 0.8 + 0.35 * LW.clamp(d, 0, 1), dotInk(px, py));
        }
      }
    }
    // ---- 4. lichen speckle patches on the lit faces
    if (o.lichen !== false) {
      const ls = o.lichenStep || 3.4;
      const lc = LW.rgb(o.lichenCol || LW.mix(o.pal[0], [196, 204, 184], o.lichenMix || 0.22));
      const lcW = [null, LW.rgb(P.warm2), LW.rgb(P.warm3), LW.rgb(P.warm4), LW.rgb(P.warm5), LW.rgb(P.warm6), LW.rgb(P.warm6)];
      for (let y = bb[1]; y < bb[3]; y += ls) {
        for (let x = bb[0]; x < bb[2]; x += ls) {
          const px = x + tr.next() * ls, py = y + tr.next() * ls;
          const r0 = tr.next(), r1 = tr.next();
          const g0 = Nt.n2(px / 120 + 7, py / 120);
          if (g0 < 0.18) continue;
          const gg = g0 + 0.3 * Nt.n2(px / 22, py / 22) + 0.15 * Nt.n2(px / 7, py / 7);
          if (gg < 0.5) continue;
          if (!inside(px, py)) continue;
          const d = localDark(px, py);
          if (d > 0.58) continue;
          if (r0 > LW.smooth(0.5, 0.8, gg) * 0.8 * T * LW.smooth(0.58, 0.3, d)) continue;
          let col = lc;
          if (warmOn) {
            const b = LW.warmBand(LW.warm(px, py, kind), px, py, 0);
            if (b > 0) col = lcW[b];
          }
          if (r1 < 0.12) {
            const rr = 1.5 + r0 * 1.5;
            const ring = [];
            for (let a = 0; a <= 6.4; a += 0.9) ring.push([px + Math.cos(a) * rr, py + Math.sin(a) * rr * 0.8]);
            ink.line(ring, ink.st(ink.col(col), 0.7), { taper: 0, wobble: 0.1 });
          } else dots.dot(px, py, 0.6 + r1 * 0.9, col);
        }
      }
    }
    // ---- 5. moss and grit packed into the clefts
    if (o.moss) {
      const mc = LW.rgb(LW.texCol.moss), md = LW.rgb(LW.texCol.mossDark), mw = LW.rgb(LW.mix(P.warm1, P.teal, 0.45));
      for (let k = 0; k < nx * ny; k++) {
        if (ID[k] < 0 || ED[k] > 2.4) continue;
        if (tr.next() > 0.05 * T) continue;
        const x = bb[0] + (k % nx) * g, y = bb[1] + Math.floor(k / nx) * g;
        if (Nt.n2(x / 70 + 3, y / 70) < 0.05) continue;
        const d = o.dark(x, y);
        if (d < 0.35) continue;
        const b = warmOn ? LW.warmBand(LW.warm(x, y, kind), x, y, 0) : 0;
        const n = 3 + Math.floor(tr.next() * 5);
        for (let q = 0; q < n; q++) {
          const px = x + (tr.next() - 0.5) * 7, py = y + (tr.next() - 0.5) * 5;
          dots.dot(px, py, 0.8 + tr.next() * 1.0, b > 1 ? mw : tr.next() < 0.6 ? md : mc);
        }
        if (tr.next() < 0.25) {
          for (let q = 0; q < 3; q++) {
            const a = -Math.PI / 2 + (q - 1) * 0.5 + (tr.next() - 0.5) * 0.3;
            dots.flick(x, y, a, 3 + tr.next() * 3, 1.1, b > 1 ? mw : mc);
          }
        }
      }
    }
    // ---- 6. water stains / weathering streaks running down the face
    if (o.stains) {
      const ns = Math.round(((bb[2] - bb[0]) * (bb[3] - bb[1]) / 7000) * T);
      for (let i = 0; i < ns; i++) {
        const x0 = bb[0] + tr.next() * (bb[2] - bb[0]), y0 = bb[1] + tr.next() * (bb[3] - bb[1]);
        const len = 40 + Math.pow(tr.next(), 1.6) * 300;
        const nl = 2 + Math.floor(tr.next() * 4);
        if (!inside(x0, y0)) continue;
        if (Nt.n2(x0 / 55, 3.3) < -0.05) continue;
        if (o.dark(x0, y0) < 0.4) continue;
        for (let q = 0; q < nl; q++) {
          const xo = x0 + q * (2.2 + tr.next() * 2.2);
          const yo = y0 + tr.next() * 12;
          const pts = [];
          for (let y = yo; y < yo + len * (0.6 + tr.next() * 0.4); y += 5) {
            const x = xo + 2.2 * Nt.n2(y / 45, xo) + 0.6 * Nt.n2(y / 9, xo);
            if (!mask.in(x, y)) break;
            pts.push([x, y]);
          }
          if (pts.length < 4) continue;
          const L = pts.length;
          ink.line(pts, (x, y, k) => {
            if (Nt.n2(x / 6, y / 28) > 0.42) return -1;
            const d = dk(x, y);
            if (d < 0.3) return -1;
            const fade = 1 - k / L;
            return ink.st(colAt(x, y), 0.6 + 0.9 * fade * LW.clamp(d, 0, 1));
          }, { taper: 14, minScale: 0.2 });
        }
      }
    }
    // ---- 7. strata: faint bedding lines running across the cells
    if (o.strata) {
      const st = o.strata;
      const V = new Float32Array(nx * ny);
      for (let j = 0; j < ny; j++) {
        for (let i = 0; i < nx; i++) {
          const k = j * nx + i;
          if (ID[k] < 0) { V[k] = NaN; continue; }
          const x = bb[0] + i * g, y = bb[1] + j * g;
          V[k] = y + st.slope * x + (st.amp || 22) * Nt.fbm(x / 340, y / 260, 2) + 4 * Nt.n2(x / 40, y / 40);
        }
      }
      LW.contours({ bbox: bb, step: g, values: V, levelStep: st.sp || 30, levelOffset: 0.5 }, (pts, lev) => {
        ink.line(pts, (x, y) => {
          const d = dk(x, y);
          if (d < 0.22) return -1;
          if (Nt.n2(x / 60 + lev * 1.7, lev * 0.37) > 0.25) return -1;
          return ink.st(colAt(x, y), (st.w || 0.9) * (0.8 + 0.5 * LW.clamp(d, 0, 1)));
        }, { taper: 16, minScale: 0.2 });
      });
    }
  };
})();
