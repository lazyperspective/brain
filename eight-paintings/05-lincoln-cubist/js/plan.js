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
    { a: [500, 1500], b: [1700, 1750], lvl: 2, A: 0.16 },
    { a: [1300, 500], b: [1700, 1300], lvl: 2, A: 0.16 },
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
    // stepped facets through the coat and the hat (design coordinates as given)
    { a: [260, 1880], b: [1060, 2700], lvl: 1, A: 0.2, raw: 1 },
    { a: [1480, 1900], b: [1860, 2700], lvl: 1, A: 0.2, raw: 1 },
    { a: [0, 2290], b: [2160, 2420], lvl: 1, A: 0.16, raw: 1 },
    { a: [1240, 1830], b: [1420, 2700], lvl: 1, A: 0.18, raw: 1 },
    { a: [560, 0], b: [1640, 610], lvl: 1, A: 0.18, raw: 1 },
    { a: [1380, 0], b: [880, 720], lvl: 1, A: 0.18, raw: 1 },
    { a: [0, 1830], b: [820, 1700], lvl: 1, A: 0.18, raw: 1 },
  ];
  // transparent planes laid across figure and ground (a glaze through which the forms still show)
  const GLAZES = [
    { poly: [[300, 260], [820, 120], [930, 760], [420, 900]], T: '#d8d0bc', a: 0.2 },
    { poly: [[1300, 1450], [2160, 1240], [2160, 2050], [1450, 2250]], T: '#5a6878', a: 0.3 },
    { poly: [[150, 2050], [900, 1800], [1000, 2700], [260, 2700]], T: '#9a8058', a: 0.18 },
    { poly: [[1500, 300], [2050, 420], [1900, 1000], [1380, 860]], T: '#2c2c30', a: 0.22 },
  ];

  function build(W, H, k, opt) {
    opt = opt || {};
    const F = G.FACE.face(CX, CY, SC);
    const shapes = F.shapes, C = F.C;
    // collage planes (behind the figure)
    // newsprint: two cut pieces of one sheet (frame = the sheet the text is laid out on)
    const frameN = [[60, 120], [640, 40], [740, 820], [150, 900]];
    const news = { name: 'news', kind: 'news', poly: [[96, 236], [338, 150], [512, 196], [560, 420], [470, 590], [300, 560], [150, 640], [118, 430]], col: R.hex('#cfc4a8'), dir: 8, frame: frameN };
    const news2 = { name: 'news2', kind: 'news', poly: [[120, 1180], [300, 1120], [470, 1170], [452, 1360], [330, 1440], [170, 1400]], col: R.hex('#cfc4a8'), dir: 8, frame: [[40, 1040], [620, 960], [720, 1740], [130, 1820]] };
    const wood = { name: 'wood', kind: 'wood', poly: [[1700, 930], [1980, 860], [2060, 1180], [2010, 1560], [2060, 1900], [1780, 1960], [1740, 1500]], col: R.hex('#a58a62'), col2: R.hex('#8a7050'), g: [1720, 840, 2100, 1980], dir: 94, frame: [[1720, 840], [2070, 790], [2130, 1980], [1790, 2040]] };
    const red = { name: 'redplane', kind: 'red', poly: [[80, 1740], [320, 1620], [390, 2110], [150, 2240]], col: R.hex('#6e463c'), col2: R.hex('#553229'), g: [110, 1660, 350, 2200], dir: 70 };
    const all = [news, news2, wood, red].concat(shapes);
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
      const l = l0.raw ? { a: l0.a, b: l0.b, lvl: l0.lvl, A: l0.A } : { a: tr(l0.a), b: tr(l0.b), lvl: l0.lvl, A: l0.A };
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
      const open = rr() < 0.5, openA = 0.55 + 0.35 * rr();
      const mr = rr(), mode = mr < 0.16 ? 'scumble' : mr > 0.74 ? 'loaded' : 'normal';
      const sz = 0.65 + 0.85 * rr(), cross = rr() < 0.12;
      const hatch = [55, 125, 70, 110, 35, 145, 90][Math.floor(r2 * 7)];
      c = { key, shift, tint, open, openA, mode, sz, cross, hatch, tone: 0.92 + 0.16 * r3, r4, bg: null };
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
    const noCells = !!opt.noCells;
    const keyAt = (x, y, lv) => {
      let key = 1, shade = 1;
      for (let i = 0; i < nL; i++) {
        const l = L[i];
        if (l.lvl < lv) continue;
        const d = x * l.nx + y * l.ny - l.c;
        const sgn = d >= 0 ? 1 : -1;
        key = (key * 3 + (sgn > 0 ? 1 : 2)) % 1000000007;
        const ad = d < 0 ? -d : d;
        shade *= 1 + l.A * l.sA * sgn * Math.exp(-ad / l.lam) * (lv === 2 ? 1.25 : lv ? 0.9 : 1);
      }
      return [key, shade];
    };
    const shapeCol = (s, x, y) => {
      if (s.col2 && s.g) {
        const g = s.g, dx = g[2] - g[0], dy = g[3] - g[1];
        let t = ((x - g[0]) * dx + (y - g[1]) * dy) / (dx * dx + dy * dy); t = t < 0 ? 0 : t > 1 ? 1 : t;
        return R.mix3(s.col, s.col2, t);
      }
      return s.col;
    };
    const groundCol = (cp, x, y) => {
      let col = bgColour(cp);
      const dh = Math.hypot((x - 1080) / 900, (y - 760) / 1100);
      const lift = 1.16 - 0.48 * R.sstep(0.35, 1.4, dh);
      col = R.mix3(col, LIGHTG, 0.55 * (1 - R.sstep(0.3, 0.75, dh)) * R.sstep(0.03, 0.25, 0.3 - R.lum(col)));
      return R.mul3(col, lift);
    };
    // passage fields: figure tone and ground tone, blurred, so that in an 'open' plane the one can bleed into the other
    const Q = 8, qw = Math.ceil(2160 / Q), qh = Math.ceil(2700 / Q);
    const FC = new Float32Array(qw * qh * 3), FM = new Float32Array(qw * qh), GC = new Float32Array(qw * qh * 3), GM = new Float32Array(qw * qh);
    for (let j = 0; j < qh; j++) for (let i = 0; i < qw; i++) {
      const x = (i + 0.5) * Q, y = (j + 0.5) * Q;
      const gx = Math.min(gw - 1, Math.floor(x * K)), gy = Math.min(gh - 1, Math.floor(y * K));
      const f0 = fid[gy * gw + gx], q = j * qw + i;
      if (isFig[f0]) { const c = shapeCol(all[f0 - 1], x, y); FC[q * 3] = c[0]; FC[q * 3 + 1] = c[1]; FC[q * 3 + 2] = c[2]; FM[q] = 1; }
      else { const c = groundCol(cellParams(keyAt(x, y, 0)[0]), x, y); GC[q * 3] = c[0]; GC[q * 3 + 1] = c[1]; GC[q * 3 + 2] = c[2]; GM[q] = 1; }
    }
    const blurQ = (A, n, r) => {
      const tmp = new Float32Array(A.length), PB = G.PaintUtil ? null : null;
      for (let pass = 0; pass < 2; pass++) {
        for (let c = 0; c < n; c++) {
          for (let j = 0; j < qh; j++) { let acc = 0; for (let i = -r; i <= r; i++) acc += A[(j * qw + Math.min(qw - 1, Math.max(0, i))) * n + c];
            for (let i = 0; i < qw; i++) { tmp[(j * qw + i) * n + c] = acc / (2 * r + 1); acc += A[(j * qw + Math.min(qw - 1, i + r + 1)) * n + c] - A[(j * qw + Math.max(0, i - r)) * n + c]; } }
          for (let i = 0; i < qw; i++) { let acc = 0; for (let j = -r; j <= r; j++) acc += tmp[(Math.min(qh - 1, Math.max(0, j)) * qw + i) * n + c];
            for (let j = 0; j < qh; j++) { A[(j * qw + i) * n + c] = acc / (2 * r + 1); acc += tmp[(Math.min(qh - 1, j + r + 1) * qw + i) * n + c] - tmp[(Math.max(0, j - r) * qw + i) * n + c]; } }
        }
      }
    };
    blurQ(FC, 3, 11); blurQ(FM, 1, 11); blurQ(GC, 3, 6); blurQ(GM, 1, 6);
    const sampQ = (A, n, x, y, c) => { const i = Math.min(qw - 1, Math.max(0, Math.floor(x / Q))), j = Math.min(qh - 1, Math.max(0, Math.floor(y / Q))); return A[(j * qw + i) * n + c]; };
    // glaze masks (bit per plane)
    const gmask = new Uint8Array(gw * gh);
    GLAZES.forEach((g, i) => V.fill(gmask, gw, gh, g.poly, K, -(1 << i)));
    const GT = GLAZES.map((g) => R.hex(g.T));
    const FACE_C = [CX, CY + 80];
    const regMap = new Map();
    const regs = [null];
    const ids = new Uint16Array(gw * gh);
    const tgt = new Float32Array(W * H * 3);
    const figPix = new Uint8Array(W * H);
    const kindPix = new Uint8Array(W * H);
    const KINDS = ['bg', 'skin', 'shade', 'deep', 'eye', 'hair', 'hairlight', 'beard', 'lip', 'mole', 'white', 'black', 'cloth', 'news', 'wood', 'hat', 'hatlight', 'red'];
    const kindIdx = {}; KINDS.forEach((n, i) => (kindIdx[n] = i));
    const OUTER = { hair: 1, hairlight: 1 };
    for (let gy = 0; gy < gh; gy++) {
      for (let gx = 0; gx < gw; gx++) {
        const x = (gx + 0.5) / K, y = (gy + 0.5) / K;
        const f0 = fid[gy * gw + gx];
        const fig0 = isFig[f0], lv0 = lvlOf[f0];
        let key = 1, shade = 1;
        if (!noCells) { const ks = keyAt(x, y, lv0); key = ks[0]; shade = ks[1]; }
        const gb = noCells ? 0 : gmask[gy * gw + gx];
        const cp = cellParams(key);
        let f = f0;
        if (fig0 && !noCells && (cp.shift[0] || cp.shift[1])) {
          // features stay put; the outer head shifts a little, hat and coat step a lot
          const dF = Math.hypot(x - FACE_C[0], (y - FACE_C[1]) / 1.3);
          const amp = lv0 === 2 ? 0.4 + 1.2 * R.sstep(300, 470, dF) : 2.4;
          const sx = Math.round(gx - cp.shift[0] * amp * K), sy = Math.round(gy - cp.shift[1] * amp * K);
          if (sx >= 0 && sy >= 0 && sx < gw && sy < gh) { const f1 = fid[sy * gw + sx]; if (isFig[f1] || lv0 < 2) f = f1; }
        }
        const s = f ? all[f - 1] : null;
        const figNow = !!(s && isFig[f]);
        let col = s ? shapeCol(s, x, y) : groundCol(cp, x, y);
        if (fig0 && lv0 === 2 && cp.tint && !noCells && R.lum(col) < 0.4 && s.kind !== 'beard' && s.kind !== 'hair') {
          const lu = R.lum(col);
          col = cp.tint === 1 ? R.mix3(col, R.mul3(COOL, lu / R.lum(COOL)), 0.38) : R.mix3(col, R.mul3(WARM, lu / R.lum(WARM)), 0.3);
        }
        if (s && (s.kind === 'cloth' || s.kind === 'hat') && cp.tint && !noCells) { const hk = s.kind === 'hat' ? 0.5 : 1; col = cp.tint === 1 ? R.mix3(col, SLATE, 0.45 * hk) : R.mix3(col, R.hex('#4a3c30'), 0.35 * hk); }
        // passage: in an open plane the figure's tone leaks into the ground, and the ground into the figure's edge
        if (cp.open && !noCells) {
          if (!figNow) {
            const fm = sampQ(FM, 1, x, y, 0);
            if (fm > 0.01) { const fc = [sampQ(FC, 3, x, y, 0) / fm, sampQ(FC, 3, x, y, 1) / fm, sampQ(FC, 3, x, y, 2) / fm]; col = R.mix3(col, fc, cp.openA * R.sstep(0.03, 0.55, fm)); }
          } else if (lv0 < 2 || OUTER[s.kind]) {
            const gm = sampQ(GM, 1, x, y, 0);
            if (gm > 0.01) { const gc = [sampQ(GC, 3, x, y, 0) / gm, sampQ(GC, 3, x, y, 1) / gm, sampQ(GC, 3, x, y, 2) / gm]; col = R.mix3(col, gc, cp.openA * (s.kind === 'hat' || s.kind === 'hatlight' ? 0.3 : 0.75) * R.sstep(0.12, 0.75, gm)); }
          }
        }
        if (gb) for (let i = 0; i < GLAZES.length; i++) if (gb & (1 << i)) {
          // the glaze spares the eyes and mouth so the likeness keeps its anchors
          const feat = s && s.feat && lv0 === 2, hatK = s && (s.kind === 'hat') ? 0.45 : 1;
          col = R.mix3(col, GT[i], GLAZES[i].a * (feat ? 0.3 : 1) * hatK);
        }
        const tone = s ? (fig0 ? 1 : cp.tone) : cp.tone;
        const ve = Math.hypot((x - 1080) / 1150, (y - 1180) / 1450);
        const vig = lv0 === 2 ? 1 - 0.16 * R.sstep(CX - 60, CX + 420, x) : 1 - 0.26 * R.sstep(0.5, 1.2, ve);
        const m = shade * tone * vig;
        const rk = (key * 16 + gb) * 1024 + f;
        let rid = regMap.get(rk);
        if (rid === undefined) {
          rid = regs.length; regMap.set(rk, rid);
          const kind = s ? s.kind : 'bg';
          regs.push({ id: rid, cell: cp, shape: s, kind, fig: figNow, glaze: gb, hatch: s && s.dir !== undefined && figNow ? s.dir : cp.hatch, n: 0, sx: 0, sy: 0 });
        }
        ids[gy * gw + gx] = rid;
        const rg = regs[rid]; rg.n++; rg.sx += x; rg.sy += y;
        const px = gx >> 1, py = gy >> 1, p = py * W + px;
        tgt[p * 3] += col[0] * m * 0.25; tgt[p * 3 + 1] += col[1] * m * 0.25; tgt[p * 3 + 2] += col[2] * m * 0.25;
        if ((gx & 1) === 0 && (gy & 1) === 0) { figPix[p] = fig0 ? 1 : 0; kindPix[p] = kindIdx[s ? s.kind : 'bg'] || 0; }
      }
    }
    for (const r of regs) if (r && r.n) { r.cx = r.sx / r.n / 1; r.cy = r.sy / r.n; }
    return { W, H, k, ids, gw, regs, tgt, figPix, kindPix, KINDS, kindIdx, shapes: all, news, news2, newsPieces: [news, news2], wood, C, LINES: L.map((l) => l.src), cellBg: (cp, x, y) => groundCol(cp, x, y) };
  }
  G.PLAN = { build, CX, CY, SC };
})(typeof window !== 'undefined' ? window : globalThis);
