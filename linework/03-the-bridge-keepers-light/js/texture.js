/* texture.js: hand-made print texture built from marks.
   - LW.texPick: stepped palette pick with a mezzotint dot screen inside every
     band (dark dots thicken toward the next darker band, rare pale flecks),
     so no fill is ever a smooth digital flat.
   - LW.Dots: batched stipple dots / flecks / tiny rings, grouped per colour.
   - small mark helpers (tufts, fronds, flicks) shared by the layers. */
(function () {
  'use strict';
  const LW = window.LW;
  const P = LW.P;

  function hi(x, y, s) {
    let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 1442695041)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return h >>> 0;
  }
  LW.hashI = hi;

  /* pal: list of colours light->dark; v: value 0..1; jit: band edge raggedness.
     o: { cell (px), dark (base dark-dot rate), ramp (extra rate toward next band),
          light (pale fleck rate), ang (flick direction), stretch, seed } */
  const DEF = { cell: 3.6, dark: 0.12, ramp: 0.55, light: 0.05, ang: 0, stretch: 1, seed: 0 };
  LW.texPick = function (pal, v, x, y, jit, o) {
    o = o || DEF;
    const ln = LW.lnoise;
    const t = LW.clamp(v + (jit ? ln.n2(x / 7.3, y / 7.9) * jit + ln.n2(x / 33, y / 29) * jit : 0), 0, 0.9999);
    const f = t * pal.length;
    let i = Math.floor(f);
    const fr = f - i;
    const c = o.cell || 3.6;
    const gx = Math.floor(x / c), gy = Math.floor(y / c);
    const h = hi(gx, gy, o.seed || 0);
    const h0 = (h & 1023) / 1024, h1 = ((h >>> 10) & 1023) / 1024, h2 = ((h >>> 20) & 1023) / 1024;
    const pd = (o.dark === undefined ? 0.12 : o.dark) + (o.ramp === undefined ? 0.55 : o.ramp) * fr * fr;
    const pl = (o.light === undefined ? 0.05 : o.light) * (1 - fr);
    if (h0 < pd || h0 > 1 - pl) {
      const r = c * (0.2 + 0.17 * h2);
      const cx = (gx + 0.5 + (h1 - 0.5) * 0.3) * c, cy = (gy + 0.5 + (h2 - 0.5) * 0.3) * c;
      let dx = x - cx, dy = y - cy;
      if (o.stretch && o.stretch !== 1) {
        const ca = Math.cos(o.ang), sa = Math.sin(o.ang);
        const u = dx * ca + dy * sa, w = -dx * sa + dy * ca;
        dx = u / o.stretch; dy = w;
      }
      if (dx * dx + dy * dy < r * r) i += h0 < pd ? 1 : -1;
    }
    return pal[LW.clamp(i, 0, pal.length - 1)];
  };

  // ------------------------------------------------------------ dot batcher
  class Dots {
    constructor() { this.m = new Map(); this.n = 0; }
    _p(col) {
      const k = typeof col === 'string' ? col : LW.rgb(col);
      let p = this.m.get(k);
      if (!p) { p = new Path2D(); this.m.set(k, p); }
      return p;
    }
    // irregular little polygon dot
    dot(x, y, r, col, sides) {
      const p = this._p(col);
      const n = sides || (r > 1.4 ? 6 : 4);
      const rot = (x * 1.37 + y * 2.11) % 6.283;
      for (let i = 0; i < n; i++) {
        const a = rot + (i / n) * 6.283;
        const rr = r * (0.78 + 0.4 * (((hi(x * 10 | 0, y * 10 | 0, i) & 255) / 255)));
        const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr;
        if (i === 0) p.moveTo(px, py); else p.lineTo(px, py);
      }
      p.closePath();
      this.n++;
    }
    // a short tapered flick (engraver's lozenge) from (x,y) along angle a
    flick(x, y, a, len, w, col) {
      const p = this._p(col);
      const ca = Math.cos(a), sa = Math.sin(a);
      const nx = -sa * w * 0.5, ny = ca * w * 0.5;
      p.moveTo(x, y);
      p.lineTo(x + ca * len * 0.4 + nx, y + sa * len * 0.4 + ny);
      p.lineTo(x + ca * len, y + sa * len);
      p.lineTo(x + ca * len * 0.4 - nx, y + sa * len * 0.4 - ny);
      p.closePath();
      this.n++;
    }
    flush(ctx) {
      ctx.save();
      for (const [k, p] of this.m) { ctx.fillStyle = k; ctx.fill(p); }
      ctx.restore();
      this.m.clear();
    }
  }
  LW.Dots = Dots;

  // ------------------------------------------------------------ plant marks
  /* a small fern / bush tuft growing from (x,y): arching fronds with leaflet
     ticks. ink: LW.Ink; col: ink colour index; s: size px; rng: LW.RNG */
  LW.fernTuft = function (ink, x, y, s, col, rng, opts) {
    opts = opts || {};
    const n = opts.fronds || (4 + rng.int(0, 4));
    const lean = opts.lean || 0;
    const w = opts.w || 1.1;
    for (let k = 0; k < n; k++) {
      let a = -Math.PI / 2 + lean + (k / (n - 1 || 1) - 0.5) * 2.4 + (rng.next() - 0.5) * 0.4;
      const len = s * (0.55 + rng.next() * 0.6) * (1 - 0.3 * Math.abs(k / (n - 1 || 1) - 0.5));
      const pts = [[x, y]];
      let px = x, py = y;
      const st = len / 7;
      const droop = 0.14 + rng.next() * 0.08;
      for (let i = 0; i < 7; i++) {
        a += Math.cos(a) > 0 ? droop : -droop; // arch outward and down
        px += Math.cos(a) * st; py += Math.sin(a) * st;
        pts.push([px, py]);
        if (opts.leaflets !== false && i > 0 && i < 6) {
          const ll = st * (1.2 - i * 0.14);
          for (const sg of [-1, 1]) {
            const b = a + sg * (1.0 + rng.next() * 0.3);
            ink.line([[px, py], [px + Math.cos(b) * ll, py + Math.sin(b) * ll]], ink.st(col, w * 0.75), { taper: ll * 0.7, minScale: 0.2, wobble: 0.15 });
          }
        }
      }
      ink.line(pts, ink.st(col, w), { taper: len * 0.6, minScale: 0.2, wobble: 0.2 });
    }
  };
  // a round shrub: dense scalloped clump (ink fill) + leaf ticks on top
  LW.shrub = function (ink, dots, x, y, r, rng, cDark, cLit) {
    const pts = [];
    const n = 22;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const k = 1 + 0.22 * Math.sin(a * 5 + rng.next()) + (rng.next() - 0.5) * 0.25;
      let yy = Math.sin(a) * r * 0.72 * k;
      if (yy > r * 0.25) yy = r * 0.25;
      pts.push([x + Math.cos(a) * r * k, y + yy]);
    }
    ink.fill(LW.chaikin(pts, 1, true), cDark, 0.4);
    for (let i = 0; i < r * 1.6; i++) {
      const a = -Math.PI * (0.15 + rng.next() * 0.7);
      const rr = r * (0.3 + rng.next() * 0.7);
      const px = x + Math.cos(a) * rr * 0.95, py = y + Math.sin(a) * rr * 0.6;
      dots.flick(px, py, -Math.PI / 2 + (rng.next() - 0.5) * 1.6, 2 + rng.next() * 3, 1.2, cLit);
    }
  };
  LW.texCol = {
    lichen: LW.mix(P.rock0, [196, 204, 186], 0.35),
    lichenFar: LW.mix(P.far0, [150, 170, 180], 0.3),
    moss: LW.mix(P.teal, P.rock3, 0.35),
    mossDark: LW.mix(P.tealDark, P.ink, 0.35),
  };
})();
