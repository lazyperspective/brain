/* raster.js: masks, distance transforms, sampled grids, the per-pixel fill
   shader, marching-squares contours and evenly-spaced streamlines. */
(function () {
  'use strict';
  const LW = window.LW;

  function mkCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, w | 0);
    c.height = Math.max(1, h | 0);
    return c;
  }
  LW.mkCanvas = mkCanvas;

  // ---------------------------------------------------------------- Mask
  class Mask {
    // draw(ctx) paints the shape in native coordinates
    constructor(bbox, res, draw) {
      this.x0 = Math.floor(bbox[0]);
      this.y0 = Math.floor(bbox[1]);
      this.res = res;
      this.w = Math.ceil((bbox[2] - this.x0) / res) + 1;
      this.h = Math.ceil((bbox[3] - this.y0) / res) + 1;
      const c = mkCanvas(this.w, this.h);
      const cx = c.getContext('2d', { willReadFrequently: true });
      cx.setTransform(1 / res, 0, 0, 1 / res, -this.x0 / res, -this.y0 / res);
      cx.fillStyle = '#fff';
      cx.strokeStyle = '#fff';
      draw(cx);
      const d = cx.getImageData(0, 0, this.w, this.h).data;
      this.data = new Uint8Array(this.w * this.h);
      for (let i = 0, k = 3; i < this.data.length; i++, k += 4) this.data[i] = d[k];
    }
    at(x, y) {
      const i = Math.round((x - this.x0) / this.res), j = Math.round((y - this.y0) / this.res);
      if (i < 0 || j < 0 || i >= this.w || j >= this.h) return 0;
      return this.data[j * this.w + i] / 255;
    }
    in(x, y) { return this.at(x, y) > 0.5; }
    // bilinear soft value
    soft(x, y) {
      const fx = (x - this.x0) / this.res, fy = (y - this.y0) / this.res;
      const i = Math.floor(fx), j = Math.floor(fy);
      if (i < 0 || j < 0 || i >= this.w - 1 || j >= this.h - 1) return this.at(x, y);
      const tx = fx - i, ty = fy - j, w = this.w, d = this.data;
      const a = d[j * w + i], b = d[j * w + i + 1], c = d[(j + 1) * w + i], e = d[(j + 1) * w + i + 1];
      return ((a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + e * tx) * ty) / 255;
    }
    // Euclidean distance (native px) from inside cells to the nearest outside cell
    edt() {
      if (this._edt) return this._edt;
      const w = this.w, h = this.h, INF = 1e12;
      const f = new Float64Array(Math.max(w, h));
      const g = new Float64Array(w * h);
      for (let i = 0; i < w * h; i++) g[i] = this.data[i] > 127 ? INF : 0;
      const d = new Float64Array(Math.max(w, h));
      const v = new Int32Array(Math.max(w, h));
      const z = new Float64Array(Math.max(w, h) + 1);
      const dt = (n) => {
        let k = 0;
        v[0] = 0; z[0] = -INF; z[1] = INF;
        for (let q = 1; q < n; q++) {
          let s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
          while (s <= z[k]) {
            k--;
            s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
          }
          k++;
          v[k] = q; z[k] = s; z[k + 1] = INF;
        }
        k = 0;
        for (let q = 0; q < n; q++) {
          while (z[k + 1] < q) k++;
          d[q] = (q - v[k]) * (q - v[k]) + f[v[k]];
        }
      };
      for (let x = 0; x < w; x++) {
        for (let y = 0; y < h; y++) f[y] = g[y * w + x];
        dt(h);
        for (let y = 0; y < h; y++) g[y * w + x] = d[y];
      }
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) f[x] = g[y * w + x];
        dt(w);
        for (let x = 0; x < w; x++) g[y * w + x] = d[x];
      }
      const out = new Float32Array(w * h);
      for (let i = 0; i < w * h; i++) out[i] = Math.sqrt(g[i]) * this.res;
      this._edt = out;
      return out;
    }
    edtAt(x, y) {
      const e = this.edt();
      const fx = (x - this.x0) / this.res, fy = (y - this.y0) / this.res;
      const i = Math.floor(fx), j = Math.floor(fy);
      if (i < 0 || j < 0 || i >= this.w - 1 || j >= this.h - 1) return 0;
      const tx = fx - i, ty = fy - j, w = this.w;
      return (e[j * w + i] * (1 - tx) + e[j * w + i + 1] * tx) * (1 - ty) + (e[(j + 1) * w + i] * (1 - tx) + e[(j + 1) * w + i + 1] * tx) * ty;
    }
  }
  LW.Mask = Mask;
  LW.pathMask = (path, bbox, res) => new Mask(bbox, res, (cx) => cx.fill(path));

  // ---------------------------------------------------------------- Grid sampled scalar field
  class Grid {
    constructor(bbox, res, fn) {
      this.x0 = bbox[0]; this.y0 = bbox[1]; this.res = res;
      this.w = Math.ceil((bbox[2] - bbox[0]) / res) + 2;
      this.h = Math.ceil((bbox[3] - bbox[1]) / res) + 2;
      this.v = new Float32Array(this.w * this.h);
      if (fn) for (let j = 0; j < this.h; j++) for (let i = 0; i < this.w; i++) this.v[j * this.w + i] = fn(this.x0 + i * res, this.y0 + j * res);
    }
    at(x, y) {
      let fx = (x - this.x0) / this.res, fy = (y - this.y0) / this.res;
      fx = LW.clamp(fx, 0, this.w - 1.001); fy = LW.clamp(fy, 0, this.h - 1.001);
      const i = Math.floor(fx), j = Math.floor(fy), tx = fx - i, ty = fy - j, w = this.w, v = this.v;
      return (v[j * w + i] * (1 - tx) + v[j * w + i + 1] * tx) * (1 - ty) + (v[(j + 1) * w + i] * (1 - tx) + v[(j + 1) * w + i + 1] * tx) * ty;
    }
  }
  LW.Grid = Grid;

  // ---------------------------------------------------------------- fill shader
  /* Paints a region with a per-pixel shader. path: Path2D in native coords;
     shader(x, y, out) writes rgb into out. off: plate misregistration in native px. */
  LW.shadeFill = function (ctx, S, path, bbox, shader, off) {
    off = off || LW.PLATE_OFF || [0, 0];
    const px0 = Math.max(0, Math.floor(bbox[0] * S) - 1), py0 = Math.max(0, Math.floor(bbox[1] * S) - 1);
    const px1 = Math.min(ctx.canvas.width, Math.ceil(bbox[2] * S) + 1), py1 = Math.min(ctx.canvas.height, Math.ceil(bbox[3] * S) + 1);
    const w = px1 - px0, h = py1 - py0;
    if (w <= 0 || h <= 0) return;
    const c = mkCanvas(w, h);
    const cx = c.getContext('2d', { willReadFrequently: true });
    cx.setTransform(S, 0, 0, S, -px0, -py0);
    cx.fillStyle = '#fff';
    cx.fill(path);
    const id = cx.getImageData(0, 0, w, h);
    const d = id.data;
    const out = [0, 0, 0];
    for (let py = 0; py < h; py++) {
      const y = (py0 + py + 0.5) / S;
      let k = py * w * 4;
      for (let px = 0; px < w; px++, k += 4) {
        if (d[k + 3] === 0) continue;
        shader((px0 + px + 0.5) / S, y, out);
        d[k] = out[0]; d[k + 1] = out[1]; d[k + 2] = out[2];
      }
    }
    cx.putImageData(id, 0, 0);
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(c, Math.round(px0 + off[0] * S), Math.round(py0 + off[1] * S));
    ctx.restore();
  };

  // ---------------------------------------------------------------- contours (marching squares)
  /* o: { bbox, step, field(x,y) (NaN = masked), levelStep, levelOffset }
     emit(points[[x,y]...], levelIndex, closed) */
  LW.contours = function (o, emit) {
    const step = o.step;
    const x0 = o.bbox[0], y0 = o.bbox[1];
    const nx = Math.ceil((o.bbox[2] - x0) / step) + 1;
    const ny = Math.ceil((o.bbox[3] - y0) / step) + 1;
    const V = o.values || new Float32Array(nx * ny);
    if (!o.values) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) V[j * nx + i] = o.field(x0 + i * step, y0 + j * step);
    const ls = o.levelStep, lo = o.levelOffset || 0;
    const IDS = o.ids || null;
    const levelsOnly = o.levels; // optional explicit list of level values
    const segsByLevel = new Map();
    const HOFF = 0, VOFF = nx * ny;
    const addSeg = (lev, e1, x1, y1, e2, x2, y2) => {
      let a = segsByLevel.get(lev);
      if (!a) { a = []; segsByLevel.set(lev, a); }
      a.push(e1, e2, x1, y1, x2, y2);
    };
    for (let j = 0; j < ny - 1; j++) {
      for (let i = 0; i < nx - 1; i++) {
        const v0 = V[j * nx + i], v1 = V[j * nx + i + 1], v2 = V[(j + 1) * nx + i + 1], v3 = V[(j + 1) * nx + i];
        if (v0 !== v0 || v1 !== v1 || v2 !== v2 || v3 !== v3) continue;
        if (IDS) {
          const a = IDS[j * nx + i];
          if (a < 0 || IDS[j * nx + i + 1] !== a || IDS[(j + 1) * nx + i + 1] !== a || IDS[(j + 1) * nx + i] !== a) continue;
        }
        let mn = Math.min(v0, v1, v2, v3), mx = Math.max(v0, v1, v2, v3);
        let kList;
        if (levelsOnly) {
          kList = [];
          for (let q = 0; q < levelsOnly.length; q++) if (levelsOnly[q] > mn && levelsOnly[q] <= mx) kList.push(q);
          if (!kList.length) continue;
        }
        const k0 = levelsOnly ? 0 : Math.floor((mn - lo) / ls) + 1;
        const k1 = levelsOnly ? kList.length - 1 : Math.floor((mx - lo) / ls);
        if (k1 < k0) continue;
        const cx0 = x0 + i * step, cy0 = y0 + j * step;
        const e0 = HOFF + j * nx + i, e1 = VOFF + j * nx + i + 1, e2 = HOFF + (j + 1) * nx + i, e3 = VOFF + j * nx + i;
        for (let kk = k0; kk <= k1; kk++) {
          const k = levelsOnly ? kList[kk] : kk;
          const L = levelsOnly ? levelsOnly[k] : lo + k * ls;
          const c = (v0 > L ? 1 : 0) | (v1 > L ? 2 : 0) | (v2 > L ? 4 : 0) | (v3 > L ? 8 : 0);
          if (c === 0 || c === 15) continue;
          // edge points
          const px = (e) => {
            switch (e) {
              case 0: return [cx0 + step * ((L - v0) / (v1 - v0)), cy0];
              case 1: return [cx0 + step, cy0 + step * ((L - v1) / (v2 - v1))];
              case 2: return [cx0 + step * ((L - v3) / (v2 - v3)), cy0 + step];
              default: return [cx0, cy0 + step * ((L - v0) / (v3 - v0))];
            }
          };
          const E = [e0, e1, e2, e3];
          const seg = (a, b) => {
            const pa = px(a), pb = px(b);
            addSeg(k, E[a], pa[0], pa[1], E[b], pb[0], pb[1]);
          };
          switch (c) {
            case 1: case 14: seg(3, 0); break;
            case 2: case 13: seg(0, 1); break;
            case 3: case 12: seg(3, 1); break;
            case 4: case 11: seg(1, 2); break;
            case 6: case 9: seg(0, 2); break;
            case 7: case 8: seg(3, 2); break;
            case 5: {
              const cen = (v0 + v1 + v2 + v3) / 4;
              if (cen > L) { seg(0, 1); seg(2, 3); } else { seg(3, 0); seg(1, 2); }
              break;
            }
            case 10: {
              const cen = (v0 + v1 + v2 + v3) / 4;
              if (cen > L) { seg(3, 0); seg(1, 2); } else { seg(0, 1); seg(2, 3); }
              break;
            }
          }
        }
      }
    }
    // chain segments per level
    for (const [lev, s] of segsByLevel) {
      const ns = s.length / 6;
      const map = new Map();
      for (let q = 0; q < ns; q++) {
        for (let e = 0; e < 2; e++) {
          const key = s[q * 6 + e];
          const a = map.get(key);
          if (a === undefined) map.set(key, q);
          else if (typeof a === 'number') map.set(key, [a, q]);
        }
      }
      const used = new Uint8Array(ns);
      const other = (key, q) => {
        const a = map.get(key);
        if (a === undefined || typeof a === 'number') return -1;
        return a[0] === q ? a[1] : a[0];
      };
      for (let q = 0; q < ns; q++) {
        if (used[q]) continue;
        used[q] = 1;
        const fwd = [[s[q * 6 + 4], s[q * 6 + 5]]];
        let endKey = s[q * 6 + 1], cur = q, closed = false;
        for (;;) {
          const nq = other(endKey, cur);
          if (nq < 0) break;
          if (used[nq]) { if (nq === q) closed = true; break; }
          used[nq] = 1;
          // orient
          if (s[nq * 6] === endKey) { fwd.push([s[nq * 6 + 4], s[nq * 6 + 5]]); endKey = s[nq * 6 + 1]; }
          else { fwd.push([s[nq * 6 + 2], s[nq * 6 + 3]]); endKey = s[nq * 6]; }
          cur = nq;
        }
        const bwd = [];
        if (!closed) {
          let startKey = s[q * 6];
          cur = q;
          for (;;) {
            const nq = other(startKey, cur);
            if (nq < 0 || used[nq]) break;
            used[nq] = 1;
            if (s[nq * 6] === startKey) { bwd.push([s[nq * 6 + 4], s[nq * 6 + 5]]); startKey = s[nq * 6 + 1]; }
            else { bwd.push([s[nq * 6 + 2], s[nq * 6 + 3]]); startKey = s[nq * 6]; }
            cur = nq;
          }
        }
        bwd.reverse();
        const pts = bwd.concat([[s[q * 6 + 2], s[q * 6 + 3]]], fwd);
        if (closed) pts.push(pts[0].slice());
        emit(pts, lev, closed);
      }
    }
  };

  // ---------------------------------------------------------------- evenly spaced streamlines (Jobard & Lefer)
  /* o: { bbox, dir(x,y)->[vx,vy] (unit or null), inside(x,y), dsep(x,y), dtest (ratio),
          step, maxLen, minLen, rng, seeds:[[x,y]...], extraSeeds:int }
     returns array of polylines */
  LW.streamlines = function (o) {
    const bb = o.bbox;
    const dmin = o.dmin || 6;
    const cs = dmin;
    const gw = Math.ceil((bb[2] - bb[0]) / cs) + 1, gh = Math.ceil((bb[3] - bb[1]) / cs) + 1;
    const cells = new Array(gw * gh);
    const PX = [], PY = [];
    const step = o.step || 2.5;
    const ratio = o.dtest || 0.5;
    const maxSteps = Math.ceil((o.maxLen || 3000) / step);
    const minLen = o.minLen || 20;
    const rng = o.rng;
    const lines = [];
    const cellOf = (x, y) => {
      const i = Math.floor((x - bb[0]) / cs), j = Math.floor((y - bb[1]) / cs);
      if (i < 0 || j < 0 || i >= gw || j >= gh) return -1;
      return j * gw + i;
    };
    const addPt = (x, y) => {
      const c = cellOf(x, y);
      if (c < 0) return;
      const id = PX.length;
      PX.push(x); PY.push(y);
      (cells[c] || (cells[c] = [])).push(id);
    };
    const near = (x, y, d) => {
      const r = Math.ceil(d / cs);
      const ci = Math.floor((x - bb[0]) / cs), cj = Math.floor((y - bb[1]) / cs);
      const d2 = d * d;
      for (let j = cj - r; j <= cj + r; j++) {
        if (j < 0 || j >= gh) continue;
        for (let i = ci - r; i <= ci + r; i++) {
          if (i < 0 || i >= gw) continue;
          const a = cells[j * gw + i];
          if (!a) continue;
          for (let k = 0; k < a.length; k++) {
            const dx = PX[a[k]] - x, dy = PY[a[k]] - y;
            if (dx * dx + dy * dy < d2) return true;
          }
        }
      }
      return false;
    };
    const integrate = (sx, sy, sgn) => {
      const pts = [];
      let x = sx, y = sy;
      let pdx = 0, pdy = 0;
      for (let n = 0; n < maxSteps; n++) {
        const v1 = o.dir(x, y);
        if (!v1) break;
        let dx = v1[0] * sgn, dy = v1[1] * sgn;
        const mx = x + dx * step * 0.5, my = y + dy * step * 0.5;
        const v2 = o.dir(mx, my);
        if (!v2) break;
        dx = v2[0] * sgn; dy = v2[1] * sgn;
        if (n > 0 && dx * pdx + dy * pdy < 0.2) break; // sharp turn
        pdx = dx; pdy = dy;
        x += dx * step; y += dy * step;
        if (!o.inside(x, y)) break;
        if (near(x, y, o.dsep(x, y) * ratio)) break;
        // self intersection guard
        if (pts.length > 24 && (n & 3) === 0) {
          let hit = false;
          const lim = o.dsep(x, y) * ratio;
          for (let k = 0; k < pts.length - 18; k += 2) {
            const ex = pts[k][0] - x, ey = pts[k][1] - y;
            if (ex * ex + ey * ey < lim * lim) { hit = true; break; }
          }
          if (hit) break;
        }
        pts.push([x, y]);
      }
      return pts;
    };
    const queue = [];
    let qh = 0;
    const tryLine = (sx, sy) => {
      if (!o.inside(sx, sy)) return false;
      if (near(sx, sy, o.dsep(sx, sy) * 0.98)) return false;
      const f = integrate(sx, sy, 1);
      const b = integrate(sx, sy, -1);
      b.reverse();
      const pts = b.concat([[sx, sy]], f);
      let len = 0;
      for (let k = 1; k < pts.length; k++) len += Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]);
      if (len < minLen) return false;
      for (const p of pts) addPt(p[0], p[1]);
      lines.push(pts);
      for (let k = 0; k < pts.length; k += 3) {
        const a = pts[Math.max(0, k - 1)], c = pts[Math.min(pts.length - 1, k + 1)];
        let tx = c[0] - a[0], ty = c[1] - a[1];
        const L = Math.hypot(tx, ty) || 1;
        tx /= L; ty /= L;
        const d = o.dsep(pts[k][0], pts[k][1]);
        queue.push([pts[k][0] - ty * d, pts[k][1] + tx * d]);
        queue.push([pts[k][0] + ty * d, pts[k][1] - tx * d]);
      }
      return true;
    };
    const seeds = o.seeds || [];
    for (const s of seeds) tryLine(s[0], s[1]);
    const drain = () => {
      while (qh < queue.length) {
        const s = queue[qh++];
        tryLine(s[0], s[1]);
      }
    };
    drain();
    // fill gaps with a jittered grid of extra seeds
    const gstep = o.gapStep || 24;
    const cand = [];
    for (let y = bb[1]; y < bb[3]; y += gstep) for (let x = bb[0]; x < bb[2]; x += gstep) cand.push([x + rng.next() * gstep, y + rng.next() * gstep]);
    for (let i = cand.length - 1; i > 0; i--) {
      const j = Math.floor(rng.next() * (i + 1));
      const t = cand[i]; cand[i] = cand[j]; cand[j] = t;
    }
    for (const s of cand) {
      if (tryLine(s[0], s[1])) drain();
    }
    return lines;
  };

  // smooth a polyline with Chaikin corner cutting
  LW.chaikin = function (pts, iters = 1, closed = false) {
    let p = pts;
    for (let it = 0; it < iters; it++) {
      const q = [];
      if (!closed) q.push(p[0]);
      const n = p.length;
      const lim = closed ? n : n - 1;
      for (let i = 0; i < lim; i++) {
        const a = p[i], b = p[(i + 1) % n];
        q.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25]);
        q.push([a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
      }
      if (!closed) q.push(p[n - 1]);
      p = q;
    }
    return p;
  };
})();
