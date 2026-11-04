/* Evenly-spaced streamlines (Jobard & Lefer 1997), variable separation. */
(function () {
  'use strict';
  const LW = window.LW;

  /* opts: field(x,y)->[dx,dy] unit, inDomain(x,y), dsep(x,y), bounds [x0,y0,x1,y1],
   *       step, dtest (ratio), maxLen, minLen, seeds [[x,y],...], maxLines */
  LW.streamlines = function (opts) {
    const [bx0, by0, bx1, by1] = opts.bounds;
    const cell = opts.cell || 12;
    const cols = Math.ceil((bx1 - bx0) / cell) + 1, rows = Math.ceil((by1 - by0) / cell) + 1;
    const grid = new Array(cols * rows);
    const step = opts.step || 2.5;
    const dtestR = opts.dtest || 0.5;
    const maxLen = opts.maxLen || 1e9;
    const minLen = opts.minLen || 10;
    const field = opts.field, inD = opts.inDomain, dsepF = opts.dsep;
    const lines = [];

    function cellIdx(x, y) {
      const cx = Math.floor((x - bx0) / cell), cy = Math.floor((y - by0) / cell);
      if (cx < 0 || cy < 0 || cx >= cols || cy >= rows) return -1;
      return cy * cols + cx;
    }
    function clear(x, y, d, ignore) {
      const cx = Math.floor((x - bx0) / cell), cy = Math.floor((y - by0) / cell);
      const r = Math.ceil(d / cell);
      const d2 = d * d;
      for (let j = cy - r; j <= cy + r; j++) {
        if (j < 0 || j >= rows) continue;
        for (let i = cx - r; i <= cx + r; i++) {
          if (i < 0 || i >= cols) continue;
          const c = grid[j * cols + i];
          if (!c) continue;
          for (let k = 0; k < c.length; k += 3) {
            if (c[k + 2] === ignore) continue;
            const dx = c[k] - x, dy = c[k + 1] - y;
            if (dx * dx + dy * dy < d2) return false;
          }
        }
      }
      return true;
    }
    function add(line, id) {
      for (let k = 0; k < line.length; k += 2) {
        const idx = cellIdx(line[k], line[k + 1]);
        if (idx < 0) continue;
        (grid[idx] || (grid[idx] = [])).push(line[k], line[k + 1], id);
      }
    }
    function integrate(sx, sy, dir) {
      const out = [];
      let x = sx, y = sy, len = 0;
      let pdx = 0, pdy = 0;
      for (let it = 0; it < 100000; it++) {
        let v = field(x, y);
        let dx = v[0] * dir, dy = v[1] * dir;
        if (it > 0 && dx * pdx + dy * pdy < 0) { dx = -dx; dy = -dy; }
        const mx = x + dx * step * 0.5, my = y + dy * step * 0.5;
        v = field(mx, my);
        let ex = v[0], ey = v[1];
        if (ex * dx + ey * dy < 0) { ex = -ex; ey = -ey; }
        const nx = x + ex * step, ny = y + ey * step;
        if (!inD(nx, ny)) break;
        const ds = dsepF(nx, ny);
        if (!clear(nx, ny, ds * dtestR, -1)) break;
        len += step;
        if (len > maxLen) break;
        out.push(nx, ny);
        pdx = ex; pdy = ey; x = nx; y = ny;
      }
      return out;
    }
    function makeLine(sx, sy) {
      const fwd = integrate(sx, sy, 1);
      const bwd = integrate(sx, sy, -1);
      const line = [];
      for (let k = bwd.length - 2; k >= 0; k -= 2) line.push(bwd[k], bwd[k + 1]);
      line.push(sx, sy);
      for (let k = 0; k < fwd.length; k++) line.push(fwd[k]);
      if ((line.length >> 1) * step < minLen) return null;
      return line;
    }
    const queue = [];
    function tryseed(x, y) {
      if (!inD(x, y)) return false;
      if (!clear(x, y, dsepF(x, y) * 0.98, -1)) return false;
      const line = makeLine(x, y);
      if (!line) return false;
      const id = lines.length;
      lines.push(line);
      add(line, id);
      queue.push(id);
      return true;
    }
    function drain() {
      while (queue.length) {
        if (opts.maxLines && lines.length >= opts.maxLines) return;
        const id = queue.shift();
        const L = lines[id];
        const n = L.length >> 1;
        for (let i = 0; i < n; i += 3) {
          const a = Math.max(0, i - 1), b = Math.min(n - 1, i + 1);
          let tx = L[2 * b] - L[2 * a], ty = L[2 * b + 1] - L[2 * a + 1];
          const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
          const x = L[2 * i], y = L[2 * i + 1];
          const d = dsepF(x, y);
          tryseed(x - ty * d, y + tx * d);
          tryseed(x + ty * d, y - tx * d);
        }
      }
    }
    for (const s of opts.seeds) { tryseed(s[0], s[1]); drain(); }
    return lines;
  };
})();
