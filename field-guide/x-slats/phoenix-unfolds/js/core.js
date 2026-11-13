// THE PHOENIX UNFOLDS — core utilities: seeded RNG, noise, colour ramps, splines, layers.
(function (G) {
  const PU = (G.PU = G.PU || {});
  PU.W = 4000;
  PU.H = 4000;
  PU.STRIP = 200;
  PU.WATER = 3330; // waterline (logical px)

  function hashStr(s) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }
  PU.hashStr = hashStr;

  class RNG {
    constructor(seed) {
      this.s = seed >>> 0 || 1;
    }
    next() {
      let t = (this.s = (this.s + 0x6d2b79f5) >>> 0);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    r(a = 0, b = 1) {
      return a + (b - a) * this.next();
    }
    i(a, b) {
      return Math.floor(this.r(a, b + 1));
    }
    g() {
      let u = 0;
      while (!u) u = this.next();
      const v = this.next();
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    }
    pick(a) {
      return a[Math.floor(this.next() * a.length)];
    }
    chance(p) {
      return this.next() < p;
    }
  }
  PU.RNG = RNG;
  PU.rngFor = (seed, label) => new RNG(hashStr(String(seed) + ':' + label));

  // 2D gradient noise
  PU.makeNoise = function (seed) {
    const r = new RNG(seed);
    const perm = [];
    for (let i = 0; i < 256; i++) perm[i] = i;
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(r.next() * (i + 1));
      const t = perm[i];
      perm[i] = perm[j];
      perm[j] = t;
    }
    const p = new Uint16Array(512);
    for (let i = 0; i < 512; i++) p[i] = perm[i & 255];
    const gx = new Float32Array(256),
      gy = new Float32Array(256);
    for (let i = 0; i < 256; i++) {
      const a = r.next() * Math.PI * 2;
      gx[i] = Math.cos(a);
      gy[i] = Math.sin(a);
    }
    const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
    function n(x, y) {
      const xi = Math.floor(x),
        yi = Math.floor(y);
      const xf = x - xi,
        yf = y - yi;
      const X = xi & 255,
        Y = yi & 255;
      const u = fade(xf),
        v = fade(yf);
      const h00 = p[p[X] + Y],
        h10 = p[p[X + 1] + Y],
        h01 = p[p[X] + Y + 1],
        h11 = p[p[X + 1] + Y + 1];
      const a = gx[h00] * xf + gy[h00] * yf;
      const b = gx[h10] * (xf - 1) + gy[h10] * yf;
      const c = gx[h01] * xf + gy[h01] * (yf - 1);
      const d = gx[h11] * (xf - 1) + gy[h11] * (yf - 1);
      const ab = a + (b - a) * u,
        cd = c + (d - c) * u;
      return (ab + (cd - ab) * v) * 1.414;
    }
    function fbm(x, y, oct = 4) {
      let s = 0,
        a = 0.5,
        f = 1,
        norm = 0;
      for (let o = 0; o < oct; o++) {
        s += a * n(x * f + o * 17.3, y * f - o * 11.1);
        norm += a;
        f *= 2.03;
        a *= 0.5;
      }
      return s / norm;
    }
    function curl(x, y) {
      const e = 0.05;
      const dx = (n(x, y + e) - n(x, y - e)) / (2 * e);
      const dy = (n(x + e, y) - n(x - e, y)) / (2 * e);
      return [dx, -dy];
    }
    return { n, fbm, curl };
  };

  // math helpers
  PU.lerp = (a, b, t) => a + (b - a) * t;
  PU.clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
  PU.smooth = (a, b, x) => {
    const t = PU.clamp((x - a) / (b - a));
    return t * t * (3 - 2 * t);
  };
  PU.mix3 = (c1, c2, t) => [c1[0] + (c2[0] - c1[0]) * t, c1[1] + (c2[1] - c1[1]) * t, c1[2] + (c2[2] - c1[2]) * t];
  PU.rgba = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a.toFixed(4)})`;
  PU.hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

  function makeRamp(stops) {
    const s = stops.map(([t, h]) => [t, PU.hex(h)]);
    return function (t) {
      t = PU.clamp(t);
      for (let i = 1; i < s.length; i++) {
        if (t <= s[i][0]) {
          const k = (t - s[i - 1][0]) / (s[i][0] - s[i - 1][0]);
          return PU.mix3(s[i - 1][1], s[i][1], k);
        }
      }
      return s[s.length - 1][1];
    };
  }
  PU.makeRamp = makeRamp;
  // heat -> fire colour
  PU.fire = makeRamp([
    [0.0, '#1a0204'],
    [0.14, '#560608'],
    [0.28, '#9e1209'],
    [0.42, '#d8350c'],
    [0.56, '#f76a14'],
    [0.7, '#ffa030'],
    [0.82, '#ffcc66'],
    [0.92, '#ffeab0'],
    [1.0, '#fffaf0'],
  ]);
  // the unburned bird (reflection): cool blues
  PU.ice = makeRamp([
    [0.0, '#03070f'],
    [0.2, '#0b1d36'],
    [0.42, '#16406e'],
    [0.62, '#3b7cb8'],
    [0.8, '#86c0ea'],
    [0.93, '#d2ecff'],
    [1.0, '#f4fbff'],
  ]);

  // geometry
  PU.catmull = function (pts, seg = 16) {
    const out = [];
    const P = [pts[0], ...pts, pts[pts.length - 1]];
    for (let i = 1; i < P.length - 2; i++) {
      const p0 = P[i - 1],
        p1 = P[i],
        p2 = P[i + 1],
        p3 = P[i + 2];
      for (let j = 0; j < seg; j++) {
        const t = j / seg,
          t2 = t * t,
          t3 = t2 * t;
        out.push({
          x: 0.5 * (2 * p1.x + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
          y: 0.5 * (2 * p1.y + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
        });
      }
    }
    out.push({ x: pts[pts.length - 1].x, y: pts[pts.length - 1].y });
    return out;
  };
  PU.polyLen = function (pts) {
    let L = 0;
    for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    return L;
  };
  // resample polyline into n points evenly by arc length (with tangent + normal)
  PU.resample = function (pts, n) {
    const cum = [0];
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
    const L = cum[cum.length - 1];
    const out = [];
    let j = 1;
    for (let k = 0; k < n; k++) {
      const d = (L * k) / (n - 1);
      while (j < cum.length - 1 && cum[j] < d) j++;
      const seg = cum[j] - cum[j - 1] || 1;
      const t = (d - cum[j - 1]) / seg;
      out.push({ x: PU.lerp(pts[j - 1].x, pts[j].x, t), y: PU.lerp(pts[j - 1].y, pts[j].y, t) });
    }
    for (let k = 0; k < n; k++) {
      const a = out[Math.max(0, k - 1)],
        b = out[Math.min(n - 1, k + 1)];
      const dx = b.x - a.x,
        dy = b.y - a.y,
        l = Math.hypot(dx, dy) || 1;
      out[k].tx = dx / l;
      out[k].ty = dy / l;
      out[k].nx = -dy / l;
      out[k].ny = dx / l;
    }
    out.L = L;
    return out;
  };
  PU.at = function (rs, t) {
    const f = PU.clamp(t) * (rs.length - 1);
    const i = Math.min(rs.length - 2, Math.floor(f));
    const k = f - i;
    const a = rs[i],
      b = rs[i + 1];
    return { x: PU.lerp(a.x, b.x, k), y: PU.lerp(a.y, b.y, k), tx: PU.lerp(a.tx, b.tx, k), ty: PU.lerp(a.ty, b.ty, k), nx: PU.lerp(a.nx, b.nx, k), ny: PU.lerp(a.ny, b.ny, k) };
  };

  // layer canvases in logical (4000-space) coordinates
  PU.layer = function (S, w = PU.W, h = PU.H, ox = 0, oy = 0) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w * S));
    c.height = Math.max(1, Math.round(h * S));
    const ctx = c.getContext('2d');
    ctx.setTransform(S, 0, 0, S, -ox * S, -oy * S);
    c.ctx = ctx;
    c.S = S;
    c.ox = ox;
    c.oy = oy;
    c.lw = w;
    c.lh = h;
    return c;
  };
  // draw a layer onto a ctx in device space
  PU.blit = function (ctx, layer, op = 'source-over', alpha = 1, dx = 0, dy = 0) {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = op;
    ctx.globalAlpha = alpha;
    ctx.drawImage(layer, dx, dy);
    ctx.restore();
  };
  PU.poly = function (ctx, pts, close) {
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    if (close) ctx.closePath();
  };
  // a blurred copy at reduced resolution (cheap bloom)
  PU.blurred = function (src, factor, radiusLogical) {
    const S = src.S / factor;
    const c = PU.layer(S, src.lw, src.lh, src.ox, src.oy);
    const t = PU.layer(S, src.lw, src.lh, src.ox, src.oy);
    t.ctx.setTransform(1, 0, 0, 1, 0, 0);
    t.ctx.drawImage(src, 0, 0, t.width, t.height);
    c.ctx.setTransform(1, 0, 0, 1, 0, 0);
    c.ctx.filter = `blur(${Math.max(0.5, radiusLogical * S).toFixed(2)}px)`;
    c.ctx.drawImage(t, 0, 0);
    c.ctx.filter = 'none';
    return c;
  };
  PU.blitScaled = function (ctx, small, op = 'lighter', alpha = 1) {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = op;
    ctx.globalAlpha = alpha;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(small, 0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.restore();
  };
})(typeof window !== 'undefined' ? window : globalThis);
