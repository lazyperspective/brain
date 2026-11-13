// THE FIRESTORM TIMELINE — core: seeded RNG, noise, colour, brushes, timeline.
// All drawing code works in MASTER units (0..4000 on both axes); the context
// transform maps master units to canvas pixels (FS.S = canvas px per master unit).
(function () {
  'use strict';
  const FS = (window.FS = window.FS || {});

  FS.W = 4000;
  FS.H = 4000;
  FS.STRIP = 200;
  FS.N = 20;
  FS.HZ = 3300; // shoreline / lake surface
  FS.DECK = 3680; // foreground bridge walking surface

  // ---------------------------------------------------------------- RNG
  function mulberry32(a) {
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hashStr(s) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h;
  }
  class RNG {
    constructor(seed) {
      this.r = mulberry32(seed >>> 0);
    }
    f() {
      return this.r();
    }
    range(a, b) {
      return a + (b - a) * this.r();
    }
    int(a, b) {
      return Math.floor(a + (b - a + 1) * this.r());
    }
    pick(a) {
      return a[Math.floor(this.r() * a.length)];
    }
    chance(p) {
      return this.r() < p;
    }
    sign() {
      return this.r() < 0.5 ? -1 : 1;
    }
    gauss() {
      let u = 0,
        v = 0;
      while (u === 0) u = this.r();
      v = this.r();
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    }
  }
  FS.RNG = RNG;
  FS.rng = (salt) => new RNG((Math.imul(FS.seed | 0, 2654435761) ^ hashStr(salt)) >>> 0);

  // ---------------------------------------------------------------- simplex noise 2D
  const GX = [1, -1, 1, -1, 1, -1, 0, 0],
    GY = [1, 1, -1, -1, 0, 0, 1, -1];
  const F2 = 0.5 * (Math.sqrt(3) - 1),
    G2 = (3 - Math.sqrt(3)) / 6;
  FS.makeNoise = function (seed) {
    const r = mulberry32(seed);
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      const t = p[i];
      p[i] = p[j];
      p[j] = t;
    }
    const perm = new Uint8Array(512);
    for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
    function n2(xin, yin) {
      const s = (xin + yin) * F2;
      const i = Math.floor(xin + s),
        j = Math.floor(yin + s);
      const t = (i + j) * G2;
      const x0 = xin - (i - t),
        y0 = yin - (j - t);
      let i1, j1;
      if (x0 > y0) {
        i1 = 1;
        j1 = 0;
      } else {
        i1 = 0;
        j1 = 1;
      }
      const x1 = x0 - i1 + G2,
        y1 = y0 - j1 + G2,
        x2 = x0 - 1 + 2 * G2,
        y2 = y0 - 1 + 2 * G2;
      const ii = i & 255,
        jj = j & 255;
      let n = 0;
      let t0 = 0.5 - x0 * x0 - y0 * y0;
      if (t0 > 0) {
        const g = perm[ii + perm[jj]] & 7;
        t0 *= t0;
        n += t0 * t0 * (GX[g] * x0 + GY[g] * y0);
      }
      let t1 = 0.5 - x1 * x1 - y1 * y1;
      if (t1 > 0) {
        const g = perm[ii + i1 + perm[jj + j1]] & 7;
        t1 *= t1;
        n += t1 * t1 * (GX[g] * x1 + GY[g] * y1);
      }
      let t2 = 0.5 - x2 * x2 - y2 * y2;
      if (t2 > 0) {
        const g = perm[ii + 1 + perm[jj + 1]] & 7;
        t2 *= t2;
        n += t2 * t2 * (GX[g] * x2 + GY[g] * y2);
      }
      return 70 * n;
    }
    function fbm(x, y, oct = 5, lac = 2.03, gain = 0.5) {
      let a = 1,
        f = 1,
        s = 0,
        norm = 0;
      for (let o = 0; o < oct; o++) {
        s += a * n2(x * f + o * 17.3, y * f - o * 9.1);
        norm += a;
        a *= gain;
        f *= lac;
      }
      return s / norm;
    }
    function ridged(x, y, oct = 5) {
      let a = 1,
        f = 1,
        s = 0,
        norm = 0;
      for (let o = 0; o < oct; o++) {
        s += a * (1 - Math.abs(n2(x * f + o * 31.7, y * f + o * 5.3)));
        norm += a;
        a *= 0.5;
        f *= 2.1;
      }
      return s / norm;
    }
    function billow(x, y, oct = 5) {
      let a = 1,
        f = 1,
        s = 0,
        norm = 0;
      for (let o = 0; o < oct; o++) {
        s += a * Math.abs(n2(x * f + o * 13.7, y * f - o * 3.9));
        norm += a;
        a *= 0.52;
        f *= 2.05;
      }
      return s / norm; // ~0..0.7, puffy lumps
    }
    return { n2, fbm, ridged, billow };
  };

  // ---------------------------------------------------------------- math
  FS.clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
  FS.lerp = (a, b, t) => a + (b - a) * t;
  FS.sstep = (e0, e1, x) => {
    const t = FS.clamp((x - e0) / (e1 - e0));
    return t * t * (3 - 2 * t);
  };
  FS.gauss = (x, mu, sig) => Math.exp(-((x - mu) * (x - mu)) / (2 * sig * sig));
  // push a focal x so that it stays at least `m` from a strip boundary
  FS.safeX = (x, m = 30) => {
    const k = Math.floor(x / FS.STRIP);
    const lo = k * FS.STRIP + m,
      hi = (k + 1) * FS.STRIP - m;
    return FS.clamp(x, lo, hi);
  };
  FS.stripCenter = (i) => i * FS.STRIP + FS.STRIP / 2; // i = 0..19

  // ---------------------------------------------------------------- colour
  FS.hex = (h) => {
    h = h.replace('#', '');
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  };
  FS.mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  FS.mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
  FS.add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  FS.css = (c, a = 1) =>
    `rgba(${Math.round(FS.clamp(c[0], 0, 255))},${Math.round(FS.clamp(c[1], 0, 255))},${Math.round(
      FS.clamp(c[2], 0, 255)
    )},${FS.clamp(a, 0, 1).toFixed(3)})`;
  // stops: [[t, [r,g,b]], ...] sorted by t
  FS.ramp = (stops, t) => {
    if (t <= stops[0][0]) return stops[0][1];
    for (let i = 1; i < stops.length; i++) {
      if (t <= stops[i][0]) {
        const a = stops[i - 1],
          b = stops[i];
        const u = (t - a[0]) / (b[0] - a[0]);
        const k = u * u * (3 - 2 * u);
        return FS.mix(a[1], b[1], k);
      }
    }
    return stops[stops.length - 1][1];
  };
  const H = FS.hex;
  // flame colour by temperature 0..1
  FS.FIRE = [
    [0.0, H('#3a0804')],
    [0.25, H('#8e1d06')],
    [0.5, H('#e0540e')],
    [0.72, H('#ff9a2a')],
    [0.88, H('#ffd36e')],
    [1.0, H('#fff4d6')],
  ];
  FS.fire = (k) => FS.ramp(FS.FIRE, FS.clamp(k));

  // ---------------------------------------------------------------- timeline
  FS.tt = (x) => FS.clamp(x / FS.W);
  // fire intensity: zero on strips 1-3, embers 4-9, full storm 10+
  FS.heat = (x) => FS.sstep(0.15, 0.62, FS.tt(x));
  FS.calm = (x) => 1 - FS.sstep(0.06, 0.42, FS.tt(x));
  FS.vortexW = (x) => FS.sstep(0.68, 0.8, FS.tt(x));

  // sky palette keyed on t (left->right) : top / middle / horizon
  FS.SKY_TOP = [
    [0.0, H('#03040e')],
    [0.18, H('#05061a')],
    [0.38, H('#120a1a')],
    [0.55, H('#1e0b08')],
    [0.72, H('#2a0f06')],
    [0.86, H('#120604')],
    [1.0, H('#0a0405')],
  ];
  FS.SKY_MID = [
    [0.0, H('#0a1034')],
    [0.15, H('#131541')],
    [0.32, H('#341634')],
    [0.48, H('#661f0c')],
    [0.66, H('#80300e')],
    [0.82, H('#3e1408')],
    [1.0, H('#220c06')],
  ];
  FS.SKY_HOR = [
    [0.0, H('#2b2d66')],
    [0.12, H('#3d2f6c')],
    [0.26, H('#7a3a5a')],
    [0.4, H('#c2522a')],
    [0.58, H('#f07a22')],
    [0.78, H('#f39a3a')],
    [1.0, H('#c8601c')],
  ];
  FS.skyAt = (x, y) => {
    const t = FS.tt(x);
    const v = FS.clamp(y / FS.HZ);
    const top = FS.ramp(FS.SKY_TOP, t),
      mid = FS.ramp(FS.SKY_MID, t),
      hor = FS.ramp(FS.SKY_HOR, t);
    if (v < 0.55) return FS.mix(top, mid, Math.pow(v / 0.55, 1.4));
    return FS.mix(mid, hor, Math.pow((v - 0.55) / 0.45, 1.6));
  };

  // ---------------------------------------------------------------- canvas helpers
  FS.canvas = (w, h) => {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  };
  FS.layer = () => {
    const c = FS.canvas(FS.PX, FS.PX);
    const g = c.getContext('2d');
    g.setTransform(FS.S, 0, 0, FS.S, 0, 0);
    return { c, g };
  };
  FS.reset = (g) => {
    g.setTransform(FS.S, 0, 0, FS.S, 0, 0);
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
    g.filter = 'none';
  };

  // polyline stroke
  FS.line = (g, pts) => {
    g.beginPath();
    g.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
  };
  FS.smoothLine = (g, pts) => {
    g.beginPath();
    g.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length - 1; i++) {
      const mx = (pts[i][0] + pts[i + 1][0]) / 2,
        my = (pts[i][1] + pts[i + 1][1]) / 2;
      g.quadraticCurveTo(pts[i][0], pts[i][1], mx, my);
    }
    const l = pts[pts.length - 1];
    g.lineTo(l[0], l[1]);
  };

  // Bristle brush: a stroke made of several parallel hairs with jittered value,
  // alpha and length. pts in master units.
  FS.bristle = (g, pts, w, col, alpha, rng, o = {}) => {
    const n = o.n || Math.max(3, Math.min(9, Math.round(w / 2.2)));
    const len = pts.length;
    if (len < 2) return;
    // normals
    const nx = new Array(len),
      ny = new Array(len);
    for (let i = 0; i < len; i++) {
      const a = pts[Math.max(0, i - 1)],
        b = pts[Math.min(len - 1, i + 1)];
      let dx = b[0] - a[0],
        dy = b[1] - a[1];
      const d = Math.hypot(dx, dy) || 1;
      nx[i] = -dy / d;
      ny[i] = dx / d;
    }
    g.lineCap = 'round';
    g.lineJoin = 'round';
    const jit = o.jitter === undefined ? 0.16 : o.jitter;
    for (let b = 0; b < n; b++) {
      const off = (n === 1 ? 0 : b / (n - 1) - 0.5) * w * (0.8 + 0.35 * rng.f());
      const k = 1 + (rng.f() - 0.5) * 2 * jit;
      const c = o.hue ? FS.mix(col, o.hue, rng.f() * 0.5) : col;
      g.strokeStyle = FS.css([c[0] * k, c[1] * k, c[2] * k], alpha * (0.45 + 0.55 * rng.f()));
      g.lineWidth = Math.max(0.6, (w / n) * (1.3 + 1.2 * rng.f()));
      const s0 = Math.floor(rng.f() * len * 0.22),
        e0 = len - Math.floor(rng.f() * len * 0.22);
      if (e0 - s0 < 2) continue;
      g.beginPath();
      // taper: hairs converge toward the ends
      for (let i = s0; i < e0; i++) {
        const u = i / (len - 1);
        const taper = o.taper === false ? 1 : Math.sin(Math.PI * (0.12 + 0.76 * u));
        const x = pts[i][0] + nx[i] * off * taper,
          y = pts[i][1] + ny[i] * off * taper;
        if (i === s0) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      g.stroke();
    }
  };

  // follow a direction field from (x,y), returning a polyline
  FS.trace = (x, y, len, step, angFn) => {
    const pts = [[x, y]];
    const n = Math.max(2, Math.round(len / step));
    for (let i = 0; i < n; i++) {
      const a = angFn(x, y);
      x += Math.cos(a) * step;
      y += Math.sin(a) * step;
      pts.push([x, y]);
    }
    return pts;
  };

  // A tapered flame tongue rising from (x,y). Filled polygon with a vertical
  // gradient from hot base to dark transparent tip.
  FS.tongue = (g, x, y, h, w, o) => {
    const n = 14;
    const sway = o.sway || 0,
      ph = o.phase || 0,
      lean = o.lean || 0,
      freq = o.freq || 2.2;
    const L = [],
      R = [];
    for (let i = 0; i <= n; i++) {
      const u = i / n;
      const cx = x + sway * Math.sin(ph + u * freq * Math.PI) * Math.pow(u, 1.1) + lean * u * u * h;
      const cy = y - u * h;
      const ww = (w / 2) * Math.pow(1 - u, 0.75) * (0.75 + 0.25 * Math.sin(Math.PI * Math.min(1, u * 1.6)));
      L.push([cx - ww, cy]);
      R.push([cx + ww, cy]);
    }
    g.beginPath();
    g.moveTo(L[0][0], L[0][1]);
    for (let i = 1; i <= n; i++) g.lineTo(L[i][0], L[i][1]);
    for (let i = n; i >= 0; i--) g.lineTo(R[i][0], R[i][1]);
    g.closePath();
    const gr = g.createLinearGradient(0, y, 0, y - h);
    const c0 = o.c0,
      c1 = o.c1,
      c2 = o.c2 || o.c1;
    const a = o.alpha === undefined ? 1 : o.alpha;
    gr.addColorStop(0, FS.css(c0, a * (o.baseA === undefined ? 0.9 : o.baseA)));
    gr.addColorStop(0.35, FS.css(c1, a * 0.85));
    gr.addColorStop(0.75, FS.css(c2, a * 0.45));
    gr.addColorStop(1, FS.css(c2, 0));
    g.fillStyle = gr;
    g.fill();
  };

  FS.glow = (g, x, y, r, col, a, sy = 1) => {
    g.save();
    g.translate(x, y);
    g.scale(1, sy);
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, r);
    gr.addColorStop(0, FS.css(col, a));
    gr.addColorStop(0.35, FS.css(col, a * 0.45));
    gr.addColorStop(1, FS.css(col, 0));
    g.fillStyle = gr;
    g.fillRect(-r, -r, 2 * r, 2 * r);
    g.restore();
  };
})();
