// hatch.js - evenly spaced streamlines (Jobard-Lefer, variable density),
// ordered-dither parallel hatching, contour helpers.
(function () {
  'use strict';
  const LW = window.LW;

  // ------------------------------------------------------------------ streamlines
  LW.streamlines = function (o) {
    const bb = o.bbox;
    const rnd = o.rng || LW.rng('sl' + (o.seed || 0));
    const step = o.step || 2.5;
    const testR = o.test || 0.55;
    const minLen = o.minLen || 12;
    const maxLen = o.maxLen || 1e9;
    const cs = o.cell || 6;
    const gx0 = bb.x0 - cs, gy0 = bb.y0 - cs;
    const gw = Math.ceil((bb.x1 - bb.x0) / cs) + 3, gh = Math.ceil((bb.y1 - bb.y0) / cs) + 3;
    const head = new Int32Array(gw * gh).fill(-1);
    let px = new Float32Array(1 << 16), py = new Float32Array(1 << 16), nxt = new Int32Array(1 << 16), lid = new Int32Array(1 << 16), pidx = new Int32Array(1 << 16);
    let np = 0;
    const alive = [];
    const grow = () => {
      const n = px.length * 2;
      const g = (A, T) => { const b = new T(n); b.set(A); return b; };
      px = g(px, Float32Array); py = g(py, Float32Array); nxt = g(nxt, Int32Array); lid = g(lid, Int32Array); pidx = g(pidx, Int32Array);
    };
    const insert = (x, y, line, idx) => {
      const cx = ((x - gx0) / cs) | 0, cy = ((y - gy0) / cs) | 0;
      if (cx < 0 || cy < 0 || cx >= gw || cy >= gh) return;
      if (np >= px.length) grow();
      px[np] = x; py[np] = y; lid[np] = line; pidx[np] = idx;
      const c = cy * gw + cx;
      nxt[np] = head[c]; head[c] = np; np++;
    };
    // true if some live point (not near-self) is within d
    const close = (x, y, d, line, idx, selfGap) => {
      const r = Math.ceil(d / cs);
      const cx = ((x - gx0) / cs) | 0, cy = ((y - gy0) / cs) | 0;
      const d2 = d * d;
      for (let j = cy - r; j <= cy + r; j++) {
        if (j < 0 || j >= gh) continue;
        for (let i = cx - r; i <= cx + r; i++) {
          if (i < 0 || i >= gw) continue;
          for (let k = head[j * gw + i]; k >= 0; k = nxt[k]) {
            const l = lid[k];
            if (!alive[l]) continue;
            if (l === line && Math.abs(pidx[k] - idx) < selfGap) continue;
            const dx = px[k] - x, dy = py[k] - y;
            if (dx * dx + dy * dy < d2) return true;
          }
        }
      }
      return false;
    };
    const inBox = (x, y) => x >= bb.x0 && y >= bb.y0 && x <= bb.x1 && y <= bb.y1;
    const lines = [];
    const queue = [];

    const dirAt = (x, y, pdx, pdy) => {
      const d = o.dir(x, y);
      if (!d) return null;
      let dx = d[0], dy = d[1];
      if (dx * pdx + dy * pdy < 0) { dx = -dx; dy = -dy; }
      return [dx, dy];
    };

    const trace = (sx, sy) => {
      const s0 = o.sep(sx, sy);
      if (!(s0 > 0) || !isFinite(s0)) return null;
      if (!inBox(sx, sy) || !o.inside(sx, sy)) return null;
      if (close(sx, sy, s0, -1, 0, 0)) return null;
      const d0 = o.dir(sx, sy);
      if (!d0) return null;
      const line = alive.length;
      alive.push(true);
      const reg0 = o.region ? o.region(sx, sy) : 0;
      const fwd = [], bwd = [];
      for (let pass = 0; pass < 2; pass++) {
        let x = sx, y = sy;
        let pdx = pass === 0 ? d0[0] : -d0[0], pdy = pass === 0 ? d0[1] : -d0[1];
        const arr = pass === 0 ? fwd : bwd;
        const sgn = pass === 0 ? 1 : -1;
        let len = 0;
        for (let it = 0; it < 4000; it++) {
          const a = dirAt(x, y, pdx, pdy);
          if (!a) break;
          const mx = x + a[0] * step * 0.5, my = y + a[1] * step * 0.5;
          const b = dirAt(mx, my, a[0], a[1]);
          if (!b) break;
          const nx = x + b[0] * step, ny = y + b[1] * step;
          if (b[0] * pdx + b[1] * pdy < 0.5) break; // too sharp a turn
          if (!inBox(nx, ny) || !o.inside(nx, ny)) break;
          if (o.region && o.region(nx, ny) !== reg0) break;
          const sp = o.sep(nx, ny);
          if (!(sp > 0) || !isFinite(sp)) break;
          if (o.stop && o.stop(nx, ny, len)) break;
          const idx = sgn * (arr.length + 1);
          if (close(nx, ny, sp * testR, line, idx, Math.ceil((sp * 2.2) / step) + 2)) break;
          x = nx; y = ny; pdx = b[0]; pdy = b[1];
          arr.push([x, y]);
          insert(x, y, line, idx);
          len += step;
          if (len > maxLen * 0.5) break;
        }
      }
      insert(sx, sy, line, 0);
      const pts = bwd.reverse().concat([[sx, sy]], fwd);
      if ((pts.length - 1) * step < minLen) { alive[line] = false; return null; }
      lines.push(pts);
      queue.push(pts);
      return pts;
    };

    const drain = () => {
      while (queue.length) {
        const L = queue.shift();
        const every = 2;
        for (let i = 0; i < L.length; i += every) {
          const a = L[Math.max(0, i - 1)], b = L[Math.min(L.length - 1, i + 1)];
          let dx = b[0] - a[0], dy = b[1] - a[1];
          const l = Math.hypot(dx, dy) || 1;
          dx /= l; dy /= l;
          const sp = o.sep(L[i][0], L[i][1]);
          if (!(sp > 0) || !isFinite(sp)) continue;
          for (const s of [-1, 1]) trace(L[i][0] - dy * sp * s, L[i][1] + dx * sp * s);
        }
      }
    };

    if (o.seeds) for (const s of o.seeds) { trace(s[0], s[1]); drain(); }
    const gs = o.seedGrid || 24;
    const cand = [];
    for (let y = bb.y0 + gs * 0.5; y < bb.y1; y += gs)
      for (let x = bb.x0 + gs * 0.5; x < bb.x1; x += gs) cand.push([x + (rnd() - 0.5) * gs, y + (rnd() - 0.5) * gs]);
    for (let i = cand.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const t = cand[i]; cand[i] = cand[j]; cand[j] = t; }
    for (const c of cand) { trace(c[0], c[1]); drain(); }
    return lines;
  };

  // draw lines into pen with width from fn(x,y) (full width), with taper
  LW.drawLines = function (pen, lines, wfn, taper = 0.3, minW = 0.15) {
    for (const L of lines) {
      if (L.length < 2) continue;
      const ws = L.map((p) => wfn(p[0], p[1]));
      pen.line(L, ws, taper, minW);
    }
  };

  // ------------------------------------------------------------------ ordered dither hatching
  // bit-reversal rank for line index -> evenly distributed thresholds
  const rank = (i) => {
    let r = 0, b = 0.5;
    i = i + 1;
    while (i > 0) { if (i & 1) r += b; b *= 0.5; i >>= 1; }
    return r;
  };
  LW.rank = rank;
  // Parallel hatching over bbox along direction angle (radians). Lines are drawn only
  // where darkness(x,y) > rank(lineIndex) (so density follows value).
  // opts: spacing (min spacing at full dark), dark(x,y)->0..1, inside(x,y), wob, w(x,y,d)
  LW.hatchDither = function (pen, bb, angle, o) {
    const ca = Math.cos(angle), sa = Math.sin(angle);
    const cx = (bb.x0 + bb.x1) / 2, cy = (bb.y0 + bb.y1) / 2;
    const sp = o.spacing * (LW.spAt ? LW.spAt(cx, cy) : 1); // depth: sparser far away
    const R = Math.hypot(bb.x1 - bb.x0, bb.y1 - bb.y0) / 2 + 2;
    const n = Math.ceil((2 * R) / sp);
    const st = o.step || 3;
    const wob = o.wob ?? 0.8;
    const seed = o.seed || 0;
    const levels = o.levels || 1; // rank modulo (rank repeats every N lines)
    const off = o.offset ?? (LW.noise3(seed * 3.1, 9.7) * 0.5 + 0.5) * sp;
    for (let i = 0; i <= n; i++) {
      const t = -R + i * sp + off;
      const thr = rank(levels > 1 ? i % levels : i % 64) * 0.999;
      // line: center + t*normal + s*dir
      const ox = cx - sa * t, oy = cy + ca * t;
      let cur = null;
      for (let s = -R; s <= R; s += st) {
        let x = ox + ca * s, y = oy + sa * s;
        const w = LW.noise3(x * 0.03 + seed, y * 0.03 + i * 0.37) * wob;
        x += -sa * w; y += ca * w;
        const ok = x >= bb.x0 && x <= bb.x1 && y >= bb.y0 && y <= bb.y1 && (!o.inside || o.inside(x, y));
        const d = ok ? o.dark(x, y) : -1;
        const jit = o.jitter ? (LW.noise2(x * 0.02 + i, y * 0.02) * o.jitter) : 0;
        if (ok && d > thr + jit) {
          if (!cur) cur = [];
          cur.push([x, y, d]);
        } else if (cur) {
          flush(cur);
          cur = null;
        }
      }
      if (cur) flush(cur);
    }
    function flush(c) {
      if (c.length < 2) return;
      const ws = c.map((p) => (o.w ? o.w(p[0], p[1], p[2]) : 1.4));
      pen.line(c.map((p) => [p[0], p[1]]), ws, o.taper ?? 0.2);
    }
  };

  // short random flecks (chisel marks / stipple-ish ticks) inside region
  LW.flecks = function (pen, bb, count, o) {
    const rnd = o.rng;
    // depth: detail falloff (thin the marks without changing the rng sequence)
    const keep = LW.detAt ? LW.detAt((bb.x0 + bb.x1) / 2, (bb.y0 + bb.y1) / 2) : 1;
    for (let i = 0; i < count; i++) {
      const x = rnd.range(bb.x0, bb.x1), y = rnd.range(bb.y0, bb.y1);
      if (o.inside && !o.inside(x, y)) continue;
      const d = o.dark ? o.dark(x, y) : 1;
      if (rnd() > d) continue;
      const a = (o.angle ?? 0) + rnd.gauss() * (o.spread ?? 0.3);
      const L = rnd.range(o.len[0], o.len[1]);
      const x1 = x + Math.cos(a) * L, y1 = y + Math.sin(a) * L;
      const bend = rnd.gauss() * L * 0.15;
      if (keep < 1 && LW.rank(i % 64) > keep) continue;
      pen.line([[x, y], [(x + x1) / 2 - Math.sin(a) * bend, (y + y1) / 2 + Math.cos(a) * bend], [x1, y1]], o.w || 1.2, 0.45);
    }
  };

  // stipple dots
  LW.stipple = function (pen, bb, count, o) {
    const rnd = o.rng;
    const keep = LW.detAt ? LW.detAt((bb.x0 + bb.x1) / 2, (bb.y0 + bb.y1) / 2) : 1;
    for (let i = 0; i < count; i++) {
      const x = rnd.range(bb.x0, bb.x1), y = rnd.range(bb.y0, bb.y1);
      if (o.inside && !o.inside(x, y)) continue;
      const d = o.dark ? o.dark(x, y) : 1;
      if (rnd() > d) continue;
      const r = rnd.range(o.r[0], o.r[1]);
      if (keep < 1 && LW.rank(i % 64) > keep) continue;
      pen.dot(x, y, r);
    }
  };
})();

// ------------------------------------------------------------------ marching squares
// f: Float32Array grid (gw x gh). Returns polylines (arrays of [x,y] via map(i,j)).
(function () {
  const LW = window.LW;
  LW.marching = function (f, gw, gh, level, map) {
    const segs = new Map(); // edgeKey -> [otherEdgeKey,...]
    const pts = new Map();
    const ek = (i, j, o) => (j * gw + i) * 2 + o; // o=0 horizontal edge (i,j)-(i+1,j), o=1 vertical (i,j)-(i,j+1)
    const pt = (k) => {
      if (pts.has(k)) return pts.get(k);
      const o = k & 1, c = k >> 1, i = c % gw, j = (c / gw) | 0;
      const a = f[c], b = o ? f[c + gw] : f[c + 1];
      const t = Math.abs(b - a) < 1e-9 ? 0.5 : (level - a) / (b - a);
      const p = o ? map(i, j + t) : map(i + t, j);
      pts.set(k, p);
      return p;
    };
    const link = (a, b) => {
      if (!segs.has(a)) segs.set(a, []);
      if (!segs.has(b)) segs.set(b, []);
      segs.get(a).push(b);
      segs.get(b).push(a);
    };
    for (let j = 0; j < gh - 1; j++) {
      for (let i = 0; i < gw - 1; i++) {
        const c = j * gw + i;
        const v0 = f[c] > level, v1 = f[c + 1] > level, v2 = f[c + gw + 1] > level, v3 = f[c + gw] > level;
        const idx = (v0 ? 1 : 0) | (v1 ? 2 : 0) | (v2 ? 4 : 0) | (v3 ? 8 : 0);
        if (idx === 0 || idx === 15) continue;
        const T = ek(i, j, 0), B = ek(i, j + 1, 0), L = ek(i, j, 1), R = ek(i + 1, j, 1);
        switch (idx) {
          case 1: case 14: link(L, T); break;
          case 2: case 13: link(T, R); break;
          case 3: case 12: link(L, R); break;
          case 4: case 11: link(R, B); break;
          case 6: case 9: link(T, B); break;
          case 7: case 8: link(L, B); break;
          case 5: link(L, T); link(R, B); break;
          case 10: link(T, R); link(L, B); break;
        }
      }
    }
    const used = new Set();
    const lines = [];
    const walk = (start) => {
      const line = [pt(start)];
      used.add(start);
      let cur = start;
      for (;;) {
        const nb = segs.get(cur).find((x) => !used.has(x));
        if (nb === undefined) {
          if (segs.get(cur).includes(start) && line.length > 2) line.push(pt(start));
          break;
        }
        used.add(nb);
        line.push(pt(nb));
        cur = nb;
      }
      if (line.length > 1) lines.push(line);
    };
    for (const [k, v] of segs) if (v.length === 1 && !used.has(k)) walk(k);
    for (const k of segs.keys()) if (!used.has(k)) walk(k);
    return lines;
  };

  // bilinear sampler for a grid laid over native coords: x = x0 + i*cs
  LW.Grid = class {
    constructor(x0, y0, x1, y1, cs) {
      this.x0 = x0; this.y0 = y0; this.cs = cs;
      this.w = Math.ceil((x1 - x0) / cs) + 1; this.h = Math.ceil((y1 - y0) / cs) + 1;
    }
    field() { return new Float32Array(this.w * this.h); }
    fill(arr, fn) {
      for (let j = 0; j < this.h; j++) for (let i = 0; i < this.w; i++) arr[j * this.w + i] = fn(this.x0 + i * this.cs, this.y0 + j * this.cs);
      return arr;
    }
    get(arr, x, y) {
      let fx = (x - this.x0) / this.cs, fy = (y - this.y0) / this.cs;
      if (fx < 0) fx = 0; if (fy < 0) fy = 0;
      if (fx > this.w - 1.001) fx = this.w - 1.001; if (fy > this.h - 1.001) fy = this.h - 1.001;
      const i = fx | 0, j = fy | 0, tx = fx - i, ty = fy - j, k = j * this.w + i;
      return (arr[k] * (1 - tx) + arr[k + 1] * tx) * (1 - ty) + (arr[k + this.w] * (1 - tx) + arr[k + this.w + 1] * tx) * ty;
    }
    map() { return (i, j) => [this.x0 + i * this.cs, this.y0 + j * this.cs]; }
  };
})();
