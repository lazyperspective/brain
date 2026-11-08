// The plan: the likeness (face.js) fractured into Cubist planes. A handful of straight cuts cross the canvas;
// every cell they make is a plane with its own small shift of viewpoint (the head is sampled a little displaced in
// some cells, so features step at the cuts), its own tonal ramp (passage: along each cut, one side darkens while the
// other lightens), and, in the ground, its own colour. Two planes are collage: newsprint and painted wood grain.
// Output, at painter resolution: target colour, a 2x2-supersampled region-id map (for clipping strokes to planes)
// and per-region info (kind, hatch direction, cell).
(function (G) {
  'use strict';
  const R = G.R, V = G.V;
  const CX = 1070, CY = 1100, SC = 1.18;

  // cuts in design coordinates; fig: crosses the figure too, otherwise ground only
  // lvl 2: cuts the head too; 1: ground and clothes; 0: ground only
  const LINES = [
    { a: [1092, 0], b: [1030, 2700], lvl: 2, A: 0.22 },
    { a: [0, 470], b: [2160, 1420], lvl: 2, A: 0.16 },
    { a: [2160, 360], b: [140, 2100], lvl: 2, A: 0.16 },
    { a: [0, 1390], b: [2160, 1300], lvl: 2, A: 0.12 },
    { a: [860, 0], b: [740, 2700], lvl: 2, A: 0.16 },
    { a: [1530, 300], b: [1250, 2700], lvl: 2, A: 0.14 },
    { a: [500, 0], b: [1700, 800], lvl: 2, A: 0.14 },
    { a: [600, 1250], b: [1500, 1100], lvl: 2, A: 0.14 },
    { a: [1180, 300], b: [1420, 1800], lvl: 2, A: 0.14 },
    { a: [700, 600], b: [1000, 1800], lvl: 2, A: 0.14 },
    { a: [700, 0], b: [520, 2700], lvl: 1, A: 0.22 },
    { a: [1520, 0], b: [1720, 2700], lvl: 0, A: 0.22 },
    { a: [0, 2050], b: [2160, 1750], lvl: 1, A: 0.2 },
    { a: [0, 820], b: [900, 0], lvl: 0, A: 0.2 },
    { a: [1250, 0], b: [2160, 1000], lvl: 0, A: 0.2 },
    { a: [0, 2500], b: [1100, 1500], lvl: 1, A: 0.18 },
    { a: [1300, 2700], b: [2160, 2050], lvl: 1, A: 0.18 },
    { a: [300, 0], b: [0, 380], lvl: 0, A: 0.2 },
    { a: [1900, 0], b: [2160, 300], lvl: 0, A: 0.2 },
    { a: [380, 2700], b: [900, 1900], lvl: 1, A: 0.2 },
  ];

  function build(W, H, k, opt) {
    opt = opt || {};
    const F = G.FACE.face(CX, CY, SC);
    const shapes = F.shapes, C = F.C;
    // collage planes (behind the figure)
    const news = { name: 'news', kind: 'news', poly: [[50, 150], [600, 60], [700, 800], [130, 880]], col: R.hex('#cfc4a8'), dir: 8 };
    const wood = { name: 'wood', kind: 'wood', poly: [[1720, 840], [2070, 790], [2130, 1980], [1790, 2040]], col: R.hex('#a77b4a'), col2: R.hex('#7a5532'), g: [1720, 840, 2100, 1980], dir: 94 };
    const red = { name: 'redplane', kind: 'red', poly: [[80, 1740], [320, 1620], [390, 2110], [150, 2240]], col: R.hex('#6e463c'), col2: R.hex('#553229'), g: [110, 1660, 350, 2200], dir: 70 };
    const all = [news, wood, red].concat(shapes);
    const gw = 2 * W, gh = 2 * H, K = 2 * k;
    const fid = new Uint16Array(gw * gh);
    all.forEach((s, i) => V.fill(fid, gw, gh, s.poly, K, i + 1));
    // a figure mask (anything that is not ground or collage), at grid resolution
    const isFig = new Uint8Array(all.length + 1), lvlOf = new Uint8Array(all.length + 1);
    all.forEach((s, i) => {
      if (s.kind !== 'news' && s.kind !== 'wood' && s.kind !== 'red') isFig[i + 1] = 1;
      lvlOf[i + 1] = s.kind === 'news' || s.kind === 'wood' || s.kind === 'red' ? 0 : (s.kind === 'cloth' || s.kind === 'white' || s.kind === 'black' || s.kind === 'hat' || s.kind === 'hatlight') ? 1 : 2;
    });

    const L = LINES.map((l0, i) => {
      const tr = (p) => [CX + (p[0] - 1070) * (SC / 1.06), CY + (p[1] - 1000) * (SC / 1.06)];
      const l = { a: tr(l0.a), b: tr(l0.b), lvl: l0.lvl, A: l0.A };
      const dx = l.b[0] - l.a[0], dy = l.b[1] - l.a[1], len = Math.hypot(dx, dy);
      const rr = R.rng(1000 + i * 31);
      return { src: l, nx: -dy / len, ny: dx / len, c: (-dy * l.a[0] + dx * l.a[1]) / len, lvl: l.lvl, A: l.A, sA: rr() < 0.5 ? 1 : -1, lam: 70 + 90 * rr() };
    });
    const nL = L.length;
    // cell parameters keyed by sign bits
    const cellCache = new Map();
    function cellParams(key) {
      let c = cellCache.get(key);
      if (c) return c;
      const rr = R.rng(key * 2654435761 + 77);
      const r1 = rr(), r2 = rr(), r3 = rr(), r4 = rr();
      const shift = r1 < 0.45 ? [(rr() - 0.5) * 40, (rr() - 0.5) * 30] : [0, 0];
      const tint = rr() < 0.35 ? 1 : rr() < 0.3 ? 2 : 0;
      const hatch = [55, 125, 70, 110, 35, 145, 90][Math.floor(r2 * 7)];
      c = { key, shift, tint, hatch, tone: 0.92 + 0.16 * r3, r4, bg: null };
      cellCache.set(key, c);
      return c;
    }
    // ground palette
    const GP = [
      { c: R.hex('#b9b2a2'), w: 3 }, { c: R.hex('#8e8a80'), w: 3 }, { c: R.hex('#717c85'), w: 3 }, { c: R.hex('#a2a6a4'), w: 2 },
      { c: R.hex('#c3a46e'), w: 2 }, { c: R.hex('#8f6f45'), w: 2 }, { c: R.hex('#48505a'), w: 2 }, { c: R.hex('#2c2a2a'), w: 1 },
      { c: R.hex('#d6ccb4'), w: 1.5 },
    ];
    const LIGHTG = R.hex('#b8b6ac'), SLATE = R.hex('#3c4a58'), COOL = R.hex('#7d8d9a'), WARM = R.hex('#a77a4c');
    const gpw = GP.reduce((a, b) => a + b.w, 0);
    function bgColour(cp) {
      if (!cp.bg) {
        let t = cp.r4 * gpw, i = 0;
        while (t > GP[i].w && i < GP.length - 1) { t -= GP[i].w; i++; }
        cp.bg = GP[i].c;
      }
      return cp.bg;
    }
    const regMap = new Map();
    const regs = [null];
    const ids = new Uint16Array(gw * gh);
    const tgt = new Float32Array(W * H * 3);
    const figPix = new Uint8Array(W * H);
    const kindPix = new Uint8Array(W * H);
    const KINDS = ['bg', 'skin', 'shade', 'deep', 'eye', 'hair', 'hairlight', 'beard', 'lip', 'mole', 'white', 'black', 'cloth', 'news', 'wood', 'hat', 'hatlight', 'red'];
    const kindIdx = {}; KINDS.forEach((n, i) => (kindIdx[n] = i));
    const noCells = !!opt.noCells;
    for (let gy = 0; gy < gh; gy++) {
      for (let gx = 0; gx < gw; gx++) {
        const x = (gx + 0.5) / K, y = (gy + 0.5) / K;
        const f0 = fid[gy * gw + gx];
        const fig0 = isFig[f0], lv0 = lvlOf[f0];
        let key = 1;
        let shade = 1;
        if (!noCells) {
          for (let i = 0; i < nL; i++) {
            const l = L[i];
            if (l.lvl < lv0) continue;
            const d = x * l.nx + y * l.ny - l.c;
            const sgn = d >= 0 ? 1 : -1;
            key = (key * 3 + (sgn > 0 ? 1 : 2)) % 1000000007;
            const ad = d < 0 ? -d : d;
            shade *= 1 + l.A * l.sA * sgn * Math.exp(-ad / l.lam) * (fig0 ? 0.8 : 1);
          }
        }
        const cp = cellParams(key);
        let f = f0;
        if (fig0 && !noCells && (cp.shift[0] || cp.shift[1])) {
          const sx = Math.round(gx - cp.shift[0] * K), sy = Math.round(gy - cp.shift[1] * K);
          if (sx >= 0 && sy >= 0 && sx < gw && sy < gh) { const f1 = fid[sy * gw + sx]; if (isFig[f1]) f = f1; }
        }
        const s = f ? all[f - 1] : null;
        let col;
        if (s) {
          col = s.col;
          if (s.col2 && s.g) {
            const g = s.g, dx = g[2] - g[0], dy = g[3] - g[1];
            let t = ((x - g[0]) * dx + (y - g[1]) * dy) / (dx * dx + dy * dy); t = t < 0 ? 0 : t > 1 ? 1 : t;
            col = R.mix3(s.col, s.col2, t);
          }
        } else {
          col = bgColour(cp);
          // value structure of the ground: lighter behind the head, darker toward the lower corners
          const dh = Math.hypot((x - 1080) / 900, (y - 760) / 1100);
          const lift = 1.16 - 0.48 * R.sstep(0.35, 1.4, dh);
          col = R.mix3(col, LIGHTG, 0.55 * (1 - R.sstep(0.3, 0.75, dh)) * R.sstep(0.03, 0.25, 0.3 - R.lum(col)));
          col = R.mul3(col, lift);
        }
        if (fig0 && lv0 === 2 && cp.tint && !noCells && R.lum(col) < 0.4) {
          const lu = R.lum(col);
          col = cp.tint === 1 ? R.mix3(col, R.mul3(COOL, lu / R.lum(COOL)), 0.38) : R.mix3(col, R.mul3(WARM, lu / R.lum(WARM)), 0.3);
        }
        if (s && (s.kind === 'cloth' || s.kind === 'hat') && cp.tint && !noCells) col = cp.tint === 1 ? R.mix3(col, SLATE, 0.38) : R.mix3(col, R.hex('#3a2e28'), 0.3);
        const tone = s ? (fig0 ? 1 : cp.tone) : cp.tone;
        // the oval of light: the periphery sinks a little, so the head carries the picture
        const ve = Math.hypot((x - 1080) / 1150, (y - 1180) / 1450);
        // light from the upper left: the far side of the head turns into shadow
        const vig = lv0 === 2 ? 1 - 0.16 * R.sstep(CX - 60, CX + 420, x) : 1 - 0.26 * R.sstep(0.5, 1.2, ve);
        const m = shade * tone * vig;
        const rk = key * 1024 + f;
        let rid = regMap.get(rk);
        if (rid === undefined) {
          rid = regs.length; regMap.set(rk, rid);
          const kind = s ? s.kind : 'bg';
          regs.push({ id: rid, cell: cp, shape: s, kind, fig: !!(s && isFig[f]), hatch: s && s.dir !== undefined && isFig[f] ? s.dir : cp.hatch, n: 0, sx: 0, sy: 0 });
        }
        ids[gy * gw + gx] = rid;
        const rg = regs[rid]; rg.n++; rg.sx += x; rg.sy += y;
        const px = gx >> 1, py = gy >> 1, p = py * W + px;
        tgt[p * 3] += col[0] * m * 0.25; tgt[p * 3 + 1] += col[1] * m * 0.25; tgt[p * 3 + 2] += col[2] * m * 0.25;
        if ((gx & 1) === 0 && (gy & 1) === 0) { figPix[p] = fig0 ? 1 : 0; kindPix[p] = kindIdx[s ? s.kind : 'bg'] || 0; }
      }
    }
    for (const r of regs) if (r && r.n) { r.cx = r.sx / r.n / 1; r.cy = r.sy / r.n; }
    return { W, H, k, ids, gw, regs, tgt, figPix, kindPix, KINDS, kindIdx, shapes: all, news, wood, C, LINES: L.map((l) => l.src) };
  }
  G.PLAN = { build, CX, CY, SC };
})(typeof window !== 'undefined' ? window : globalThis);
