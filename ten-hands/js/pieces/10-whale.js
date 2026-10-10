/* Ten Hands — 10 · Inside the Whale, a Lamp Is Lit
 *
 * A tunnel book: nine sheets of hand-cut paper stood one behind another, lit from the back.
 * Every sheet is cut at runtime with Canvas 2D (jittered "knife" outlines, lace cut-outs, tissue
 * windows) into a mask; a WebGL2 compositor then looks through the stack: parallax by depth,
 * soft shadows of each sheet on the sheets behind (moonlight from the front), warm lamp light
 * from the back transmitted through thin paper (fibres, cloudy formation), cut edges catching light.
 */
(function () {
  'use strict';

  const TAU = Math.PI * 2;
  const NL = 9;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function lin(hex) {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
      v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
  }
  function makeNoise(rnd) {
    const T = new Float32Array(1024);
    for (let i = 0; i < 1024; i++) T[i] = rnd() * 2 - 1;
    return function (x) {
      const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
      return T[i & 1023] * (1 - u) + T[(i + 1) & 1023] * u;
    };
  }

  /* =====================================================================
   * Pen: builds polylines (in layer pixels) from design-unit drawing calls.
   * ===================================================================== */
  function Pen(G) { this.G = G; this.subs = []; this.cur = null; this.m = [1, 0, 0, 1, 0, 0]; this.lx = 0; this.ly = 0; }
  Pen.prototype = {
    at(tx, ty, s, r, flip) {
      s = s == null ? 1 : s; r = r || 0; const f = flip ? -1 : 1;
      const c = Math.cos(r), n = Math.sin(r);
      this.m = [c * s * f, n * s * f, -n * s, c * s, tx, ty]; return this;
    },
    id() { this.m = [1, 0, 0, 1, 0, 0]; return this; },
    T(x, y) {
      const m = this.m, G = this.G;
      return [(m[0] * x + m[2] * y + m[4]) * G.s + G.ox, (m[1] * x + m[3] * y + m[5]) * G.s + G.oy];
    },
    M(x, y) { this.cur = { p: [this.T(x, y)], c: false }; this.subs.push(this.cur); this.lx = x; this.ly = y; return this; },
    L(x, y) { this.cur.p.push(this.T(x, y)); this.lx = x; this.ly = y; return this; },
    C(x1, y1, x2, y2, x, y) {
      const a = this.T(this.lx, this.ly), b = this.T(x1, y1), c = this.T(x2, y2), d = this.T(x, y);
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]) + Math.hypot(c[0] - b[0], c[1] - b[1]) + Math.hypot(d[0] - c[0], d[1] - c[1]);
      const n = clamp(Math.ceil(len / 2.2), 2, 400);
      for (let i = 1; i <= n; i++) {
        const t = i / n, u = 1 - t, w0 = u * u * u, w1 = 3 * u * u * t, w2 = 3 * u * t * t, w3 = t * t * t;
        this.cur.p.push([w0 * a[0] + w1 * b[0] + w2 * c[0] + w3 * d[0], w0 * a[1] + w1 * b[1] + w2 * c[1] + w3 * d[1]]);
      }
      this.lx = x; this.ly = y; return this;
    },
    Q(x1, y1, x, y) {
      const x0 = this.lx, y0 = this.ly;
      return this.C(x0 + 2 / 3 * (x1 - x0), y0 + 2 / 3 * (y1 - y0), x + 2 / 3 * (x1 - x), y + 2 / 3 * (y1 - y), x, y);
    },
    Z() { if (this.cur) this.cur.c = true; return this; },
    ellipse(cx, cy, rx, ry, rot) {
      rot = rot || 0;
      const a = this.T(cx, cy), b = this.T(cx + rx, cy + ry);
      const n = clamp(Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) * 0.9), 10, 160);
      const c = Math.cos(rot), s = Math.sin(rot);
      for (let i = 0; i < n; i++) {
        const t = (i / n) * TAU, x = Math.cos(t) * rx, y = Math.sin(t) * ry;
        const px = cx + x * c - y * s, py = cy + x * s + y * c;
        if (i === 0) this.M(px, py); else this.L(px, py);
      }
      return this.Z();
    },
    circle(cx, cy, r) { return this.ellipse(cx, cy, r, r, 0); },
    poly(a, open) {
      this.M(a[0], a[1]);
      for (let i = 2; i < a.length; i += 2) this.L(a[i], a[i + 1]);
      if (!open) this.Z();
      return this;
    },
    path(d) {
      const tok = d.match(/[a-zA-Z]|-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/g);
      let i = 0, cmd = '', x = 0, y = 0, sx = 0, sy = 0;
      const num = () => parseFloat(tok[i++]);
      while (i < tok.length) {
        if (/[a-zA-Z]/.test(tok[i])) cmd = tok[i++];
        const rel = cmd === cmd.toLowerCase();
        switch (cmd.toUpperCase()) {
          case 'M': { let nx = num(), ny = num(); if (rel) { nx += x; ny += y; } this.M(nx, ny); x = sx = nx; y = sy = ny; cmd = rel ? 'l' : 'L'; break; }
          case 'L': { let nx = num(), ny = num(); if (rel) { nx += x; ny += y; } this.L(nx, ny); x = nx; y = ny; break; }
          case 'H': { let nx = num(); if (rel) nx += x; this.L(nx, y); x = nx; break; }
          case 'V': { let ny = num(); if (rel) ny += y; this.L(x, ny); y = ny; break; }
          case 'C': {
            let a = num(), b = num(), c = num(), e = num(), f = num(), h = num();
            if (rel) { a += x; b += y; c += x; e += y; f += x; h += y; }
            this.C(a, b, c, e, f, h); x = f; y = h; break;
          }
          case 'Q': {
            let a = num(), b = num(), f = num(), h = num();
            if (rel) { a += x; b += y; f += x; h += y; }
            this.Q(a, b, f, h); x = f; y = h; break;
          }
          case 'Z': this.Z(); x = sx; y = sy; if (i < tok.length && !/[a-zA-Z]/.test(tok[i])) i++; break;
          default: i++;
        }
      }
      return this;
    },
    // closed polygon through local points
    pts(a, open) { this.M(a[0][0], a[0][1]); for (let i = 1; i < a.length; i++) this.L(a[i][0], a[i][1]); if (!open) this.Z(); return this; },
    // tapered band along a polyline of local points; wf(t) = width
    ribbon(a, wf, capR) {
      const n = a.length, L = [], R = [];
      for (let i = 0; i < n; i++) {
        const p0 = a[Math.max(0, i - 1)], p1 = a[Math.min(n - 1, i + 1)];
        let dx = p1[0] - p0[0], dy = p1[1] - p0[1]; const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
        const w = wf(i / (n - 1)) / 2;
        L.push([a[i][0] - dy * w, a[i][1] + dx * w]); R.push([a[i][0] + dy * w, a[i][1] - dx * w]);
      }
      const out = L.concat(R.reverse());
      return this.pts(out);
    },
  };

  // Catmull-Rom densify (local coords)
  function spline(pts, closed, per) {
    per = per || 12;
    const out = [], n = pts.length;
    const P = (i) => (closed ? pts[(i + n) % n] : pts[clamp(i, 0, n - 1)]);
    const segs = closed ? n : n - 1;
    for (let i = 0; i < segs; i++) {
      const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
      for (let j = 0; j < per; j++) {
        const t = j / per, t2 = t * t, t3 = t2 * t;
        const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
        out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
      }
    }
    if (!closed) out.push(pts[n - 1].slice());
    return out;
  }
  function bez(p0, p1, p2, p3, n) {
    const out = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n, u = 1 - t, w0 = u * u * u, w1 = 3 * u * u * t, w2 = 3 * u * t * t, w3 = t * t * t;
      out.push([w0 * p0[0] + w1 * p1[0] + w2 * p2[0] + w3 * p3[0], w0 * p0[1] + w1 * p1[1] + w2 * p2[1] + w3 * p3[1]]);
    }
    return out;
  }
  function inPoly(poly, x, y) {
    let c = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const a = poly[i], b = poly[j];
      if ((a[1] > y) !== (b[1] > y) && x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0]) c = !c;
    }
    return c;
  }

  /* =====================================================================
   * Painter: fills pens into the layer canvas. R = paper, G = tissue.
   * ===================================================================== */
  function Painter(ctx, G, noise, rnd) {
    const jitPts = (pts, closed, amp) => {
      // resample at ~1.6px and push along normals with two octaves of knife wobble
      const out = [];
      const n = pts.length; if (n < 2) return pts;
      let per = 0;
      for (let i = 0; i < n - (closed ? 0 : 1); i++) { const a = pts[i], b = pts[(i + 1) % n]; per += Math.hypot(b[0] - a[0], b[1] - a[1]); }
      if (per < 4) return pts;
      const k = amp * clamp(per / 60, 0.25, 1);
      const o1 = rnd() * 900, o2 = rnd() * 900;
      let s = 0;
      for (let i = 0; i < n - (closed ? 0 : 1); i++) {
        const a = pts[i], b = pts[(i + 1) % n];
        const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy);
        if (l < 1e-6) continue;
        const nx = -dy / l, ny = dx / l;
        const steps = Math.max(1, Math.ceil(l / 1.6));
        for (let j = 0; j < steps; j++) {
          const t = j / steps, ss = s + l * t;
          const d = k * (0.75 * noise(ss / (14 * G.res) + o1) + 0.35 * noise(ss / (3.5 * G.res) + o2));
          out.push([a[0] + dx * t + nx * d, a[1] + dy * t + ny * d]);
        }
        s += l;
      }
      if (!closed) out.push(pts[n - 1]);
      return out;
    };
    const trace = (pen, jit) => {
      ctx.beginPath();
      for (const sp of pen.subs) {
        const pts = jit > 0 ? jitPts(sp.p, sp.c, jit * G.jit) : sp.p;
        if (!pts.length) continue;
        ctx.moveTo(pts[0][0], pts[0][1]);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
        if (sp.c) ctx.closePath();
      }
    };
    const run = (fn, style, op, jit, rule) => {
      const pen = new Pen(G); fn(pen);
      ctx.globalCompositeOperation = op; ctx.fillStyle = style;
      trace(pen, jit == null ? 1 : jit);
      ctx.fill(rule || 'nonzero');
      ctx.globalCompositeOperation = 'source-over';
    };
    const line = (fn, w, style, op, jit) => {
      const pen = new Pen(G); fn(pen);
      ctx.globalCompositeOperation = op; ctx.strokeStyle = style;
      ctx.lineWidth = Math.max(0.6, w * G.s); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      trace(pen, jit == null ? 0.4 : jit);
      ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
    };
    return {
      G, rnd,
      paper: (fn, jit, rule) => run(fn, '#ff0000', 'source-over', jit, rule),
      cut: (fn, jit, rule) => run(fn, '#000000', 'source-over', jit, rule),
      tissue: (fn) => run(fn, '#00ff00', 'lighter', 0),
      paperLine: (fn, w, jit) => line(fn, w, '#ff0000', 'source-over', jit),
      cutLine: (fn, w, jit) => line(fn, w, '#000000', 'source-over', jit),
      px: (n) => n / G.U, // css px -> design units
    };
  }

  /* =====================================================================
   * Geometry of the book for a viewport (design units: 1 = U css px, origin at centre).
   * ===================================================================== */
  function geometry(W, H) {
    const U = Math.min(H / 2, W / 1.6);
    const hw = W / 2 / U, hh = H / 2 / U;
    const ex = Math.max(0, hh - 1.05);
    const g = { U, hw, hh, ex };
    g.mw = Math.min(hw - 0.09, 1.06);
    g.corner = -0.12 - ex * 0.15;
    g.apex = -(0.76 + ex * 0.62);
    g.lip = 0.78 + ex * 0.55;
    g.op = [];
    const ts = { 3: 0.18, 4: 0.43, 5: 0.7, 6: 1 };
    for (let k = 3; k <= 6; k++) {
      const t = ts[k];
      g.op[k] = { hw: lerp(g.mw - 0.03, 0.6, t), apex: lerp(g.apex + 0.12, -0.41, t), floor: lerp(g.lip - 0.07, 0.36, (k - 2) / 4) };
    }
    g.room = { x: 0.02, y: 0.32 };
    g.lamp = [g.room.x, g.room.y - 0.305];
    g.z = [0, 0.75, 1.35, 2.25, 3.05, 3.85, 4.6, 5.25, 5.75];
    g.zL = 6.5;
    return g;
  }

  // the mouth: upper jaw edge and lower lip, left halves, corner -> centre
  function mouthCurves(g, d) {
    d = d || 0;
    const mw = g.mw + d, cn = g.corner, ap = g.apex - d * 1.2, lip = g.lip + d;
    return {
      up: bez([-mw, cn], [-mw * 0.98, cn - (cn - ap) * 0.5], [-mw * 0.34, ap + 0.15], [0, ap], 70),
      lo: bez([-mw, cn], [-mw * 0.99, cn + (lip - cn) * 0.75], [-mw * 0.55, lip], [0, lip], 70),
    };
  }
  function mouthPoly(g, d) {
    const { up, lo } = mouthCurves(g, d);
    const a = up.slice();
    for (let i = up.length - 2; i >= 0; i--) a.push([-up[i][0], up[i][1]]);
    for (let i = 1; i < lo.length; i++) a.push([-lo[i][0], lo[i][1]]);
    for (let i = lo.length - 2; i > 0; i--) a.push([lo[i][0], lo[i][1]]);
    return a;
  }
  // where a sheet behind the face may have paper: around the mouth, and all below its corners
  function innerSheet(g, d) {
    const { up } = mouthCurves(g, d);
    const a = up.slice();
    for (let i = up.length - 2; i >= 0; i--) a.push([-up[i][0], up[i][1]]);
    const mw = g.mw + d;
    a.push([mw, g.hh + 2], [-mw, g.hh + 2]);
    return a;
  }
  // the whale's head seen from the front: a pointed rostrum over the mouth, the jowls of the
  // pleated lower jaw spreading below
  function headPoly(g) {
    const mw = g.mw, cn = g.corner, ap = g.apex, hh = g.hh;
    const bx = mw + 0.17, by = cn - 0.1, ty = ap - 0.19;
    const jx = mw + 0.5, jy = cn + 0.44, botY = hh + 1.2;
    const left = [].concat(
      bez([-(jx - 0.08), botY], [-(jx - 0.04), botY - 0.6], [-jx, jy + 0.35], [-jx, jy], 10),
      bez([-jx, jy], [-jx, jy - 0.3], [-(bx + 0.1), by - 0.07], [-bx, by], 16).slice(1),
      bez([-bx, by], [-bx * 0.99, by - (by - ty) * 0.5], [-bx * 0.36, ty + 0.15], [0, ty], 40).slice(1)
    );
    const right = left.slice(0, -1).reverse().map((p) => [-p[0], p[1]]);
    return left.concat(right);
  }
  function curveY(curve, x) {
    const ax = -Math.abs(x);
    for (let i = 1; i < curve.length; i++) {
      const a = curve[i - 1], b = curve[i];
      if (ax >= a[0] && ax <= b[0]) return lerp(a[1], b[1], (ax - a[0]) / ((b[0] - a[0]) || 1e-9));
    }
    return curve[ax < curve[0][0] ? 0 : curve.length - 1][1];
  }

  // half arch (left side), floor -> apex, as points
  function archSide(hw, apex, floorY, bulge, n) {
    n = n || 40; const out = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const y = lerp(floorY, apex, t);
      const sh = (1 - Math.pow(t, 2.4)) * (1 + (bulge || 0) * Math.sin(Math.PI * t) * (1 - t));
      out.push([-hw * sh, y]);
    }
    return out;
  }
  function archPoly(cx, hw, apex, floorY, bulge, below) {
    const L = archSide(hw, apex, floorY, bulge).map((p) => [cx + p[0], p[1]]);
    const R = L.slice(0, -1).reverse().map((p) => [2 * cx - p[0], p[1]]);
    return [[cx - hw * 1.02, floorY + below]].concat(L, R, [[cx + hw * 1.02, floorY + below]]);
  }

  // Shapes ------------------------------------------------------------------
  function crescent(p, cx, cy, r, rot, th) {
    th = th == null ? 0.42 : th;
    const n = 14, c = Math.cos(rot), s = Math.sin(rot);
    const P = (x, y) => [cx + x * c - y * s, cy + x * s + y * c];
    const out = [];
    for (let i = 0; i <= n; i++) { const a = Math.PI + (i / n) * Math.PI; out.push(P(Math.cos(a) * r, Math.sin(a) * r)); }
    for (let i = n - 1; i >= 1; i--) { const a = Math.PI + (i / n) * Math.PI; out.push(P(Math.cos(a) * r * 0.92, Math.sin(a) * r * (1 - th) + r * 0.02)); }
    p.pts(out);
  }
  function fish(p, x, y, len, dir) {
    const s = len / 100;
    p.at(x, y, s, 0, dir < 0);
    p.path('M50 0 C42 -13 20 -19 2 -18 C-14 -17 -26 -9 -33 -3 L-51 -17 C-47 -9 -45 -4 -43 0 C-45 4 -47 9 -51 16 L-33 3 C-26 10 -12 16 3 16 C21 16 41 12 50 0 Z');
    p.path('M8 -17 C4 -28 -9 -29 -17 -15 Z');
    p.path('M-4 15 C-8 22 -14 23 -18 13 Z');
    p.id();
  }
  function fishCuts(D, x, y, len, dir) {
    const s = len / 100;
    D.cut((p) => { p.at(x, y, s, 0, dir < 0); p.circle(33, -3, 4); p.id(); }, 0);
    D.cutLine((p) => { p.at(x, y, s, 0, dir < 0); p.path('M24 -11 C28 -4 28 4 23 10'); p.id(); }, Math.max(1 / D.G.U, len * 0.022));
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 4; c++) {
        const sx = 12 - c * 9 - (r % 2) * 4.5, sy = -7 + r * 7;
        D.cut((p) => { p.at(x, y, s, 0, dir < 0); crescent(p, sx, sy, 3.4, -Math.PI / 2, 0.5); p.id(); }, 0);
      }
    }
  }

  /* =====================================================================
   * The nine sheets.
   * ===================================================================== */
  const LAYERS = [];
  const WAVE = 'M-92 6 C-62 4 -40 -12 -20 -36 C-6 -54 16 -66 38 -65 C56 -64 68 -52 66 -38 C64 -28 54 -22 46 -26 C40 -29 35 -35 27 -35 C17 -33 13 -18 23 -8 C31 -1 45 3 64 5 L64 44 L-92 44 Z';

  // 0 · the night sea in front: big curling waves below, scalloped clouds in the top corners
  LAYERS[0] = function (D, g, R) {
    const hw = g.hw, hh = g.hh;
    const wl = (x) => g.lip + 0.06 - 0.3 * Math.pow(Math.min(1.15, Math.abs(x) / Math.max(1.25, hw)), 2);
    D.paper((p) => {
      const a = [];
      for (let i = 0; i <= 80; i++) { const x = lerp(-hw - 0.6, hw + 0.6, i / 80); a.push([x, wl(x) + 0.035]); }
      a.push([hw + 0.6, hh + 1], [-hw - 0.6, hh + 1]);
      p.pts(a);
    });
    const crests = [];
    const span = hw + 0.3;
    const n = Math.max(3, Math.round((2 * span) / 0.62));
    for (let i = 0; i < n; i++) {
      const x = lerp(-span, span, (i + 0.5) / n) + (R() - 0.5) * 0.1;
      const side = Math.min(1, Math.abs(x) / Math.max(1, hw));
      crests.push({ x, s: (0.0021 + 0.0011 * side) * (0.85 + R() * 0.3), dir: x < 0 ? 1 : -1 });
    }
    const body = WAVE;
    for (const c of crests) {
      const y = wl(c.x) + 0.04;
      D.paper((p) => { p.at(c.x, y, c.s, 0, c.dir < 0); p.path(body); p.id(); });
      // foam claws on the lip
      D.paper((p) => {
        p.at(c.x, y, c.s, 0, c.dir < 0);
        p.path('M52 -60 C60 -70 70 -70 76 -64 C70 -64 64 -60 60 -54 Z');
        p.path('M62 -48 C70 -54 78 -52 82 -46 C76 -46 70 -42 66 -38 Z');
        p.path('M63 -34 C70 -36 76 -32 78 -26 C72 -28 66 -26 62 -24 Z');
        p.id();
      }, 0.5);
    }
    for (const c of crests) {
      const y = wl(c.x) + 0.04;
      const w = 1.3 / g.U;
      D.cutLine((p) => {
        p.at(c.x, y, c.s, 0, c.dir < 0);
        p.path('M-74 4 C-52 1 -34 -14 -16 -38');
        p.path('M-58 8 C-40 5 -26 -6 -10 -26');
        p.path('M4 -54 C20 -62 44 -62 56 -48 C62 -40 56 -32 48 -34');
        p.id();
      }, w, 0.4);
      D.cut((p) => { p.at(c.x, y, c.s, 0, c.dir < 0); p.circle(-2, -30, 3.4); p.circle(8, -38, 2.6); p.circle(-10, -20, 2.2); p.circle(16, -46, 2); p.id(); }, 0);
    }
    // seigaiha scallops cut into the water
    for (let row = 0; row < 8; row++) {
      const r = 0.055;
      for (let x = -hw - 0.3 + (row % 2) * r; x < hw + 0.3; x += r * 2) {
        const y = wl(x) + 0.12 + row * 0.06;
        if (y > hh + 0.1) continue;
        D.cutLine((p) => { p.M(x - r * 0.92, y + 0.012).Q(x, y - r * 1.05, x + r * 0.92, y + 0.012); }, 1.3 / g.U, 0.3);
        D.cutLine((p) => { p.M(x - r * 0.55, y + 0.016).Q(x, y - r * 0.55, x + r * 0.55, y + 0.016); }, 1.1 / g.U, 0.3);
        if (R() < 0.35) D.cut((p) => p.circle(x, y - r * 0.05, 0.005), 0);
      }
    }
    // clouds hanging in the top corners
    for (const sd of [-1, 1]) {
      const cx = sd * (hw + 0.04), cy = -hh;
      const sc = Math.min(1, hw / 1.5) * (0.62 + R() * 0.1);
      const lobes = [[0.0, 0.0, 0.26], [-0.26, 0.05, 0.16], [-0.44, 0.1, 0.11], [-0.57, 0.08, 0.07], [-0.1, 0.17, 0.12]];
      D.paper((p) => {
        for (const l of lobes) p.circle(cx + sd * l[0] * sc, cy + l[1] * sc + 0.02, l[2] * sc);
        p.pts([[cx - 0.62 * sc, cy - 0.5], [cx + 0.62 * sc, cy - 0.5], [cx + 0.62 * sc, cy + 0.05], [cx - 0.62 * sc, cy + 0.05]]);
      });
      for (const l of lobes) {
        const lx = cx + sd * l[0] * sc, ly = cy + l[1] * sc + 0.02, lr = l[2] * sc;
        for (let a = 0.25; a < Math.PI - 0.2; a += 0.34) {
          const px = lx + Math.cos(a) * lr * 0.78, py = ly + Math.sin(a) * lr * 0.78;
          D.cut((p) => crescent(p, px, py, lr * 0.13, a + Math.PI / 2, 0.45), 0);
        }
        D.cutLine((p) => { p.M(lx - lr * 0.55, ly + lr * 0.25).Q(lx, ly + lr * 0.62, lx + lr * 0.55, ly + lr * 0.25); }, 1.2 / g.U, 0.3);
      }
    }
  };

  // 1 · the whale's face, mouth agape: rostrum with tubercles, a curtain of baleen,
  //     the pleated lower jaw, an old eye on each side
  LAYERS[1] = function (D, g, R) {
    const head = headPoly(g);
    D.paper((p) => p.pts(head));
    const mw = g.mw, ap = g.apex, cn = g.corner, lip = g.lip;
    const { up, lo } = mouthCurves(g, 0);
    D.cut((p) => p.pts(mouthPoly(g, 0)), 1.2);
    // baleen: tapered plates hanging from the upper jaw, frayed along their inner edges
    const sp = 0.012;
    for (let x = -mw + 0.035; x <= mw - 0.035; x += sp * (0.9 + R() * 0.2)) {
      const s = Math.abs(x) / mw;
      const y0 = curveY(up, x) - 0.015;
      const room = curveY(lo, x) - curveY(up, x);
      let len = (0.07 + 0.36 * Math.pow(s, 1.1)) * (0.88 + R() * 0.24) * (1 + g.ex * 0.4);
      len = Math.min(len, room * 0.58);
      if (len < 0.02) continue;
      const lean = -Math.sign(x) * (0.04 + 0.1 * s) * len;
      const w = sp * (0.66 + R() * 0.12), inn = -Math.sign(x) || 1;
      D.paper((p) => p.pts([[x - w / 2, y0], [x + w / 2, y0], [x + lean * 0.7 + inn * w * 0.25, y0 + len * 0.7], [x + lean, y0 + len], [x + lean * 0.6 - inn * w * 0.2, y0 + len * 0.55]]), 0.25);
      const nh = 2 + Math.floor(R() * 3);
      for (let h = 0; h < nh; h++) {
        const t = 0.45 + (h / nh) * 0.45 + R() * 0.05;
        const hx = x + lean * t + inn * w * 0.2 * (1 - t), hy = y0 + len * t;
        D.paperLine((p) => p.M(hx, hy).L(hx + inn * w * (0.5 + R() * 0.5) + lean * 0.15, hy + len * (0.12 + R() * 0.1)), 0.8 / g.U, 0);
      }
    }
    // gum line along the jaw, stitched with little crescents
    for (const sd of [-1, 1]) {
      const a = up.slice(3).map((q) => [sd * q[0], q[1] - 0.04]);
      D.cutLine((p) => p.pts(a, true), 1.6 / g.U, 0.5);
      for (let i = 4; i < up.length - 2; i += 3) {
        const q = up[i];
        D.cut((p) => crescent(p, sd * q[0], q[1] - 0.024, 0.008, 0, 0.5), 0);
      }
    }
    // tubercles: knobs in rows up the rostrum
    const knob = (x, y, r) => {
      D.cutLine((p) => { const a = []; for (let i = 0; i <= 18; i++) { const t = 0.35 + (i / 18) * (TAU - 0.7); a.push([x + Math.sin(t) * r, y + Math.cos(t) * r]); } p.pts(a, true); }, 1.2 / g.U, 0);
      D.cut((p) => p.circle(x - r * 0.2, y - r * 0.25, r * 0.22), 0);
    };
    for (let y = ap - 0.05; y > ap - 0.2; y -= 0.045 + R() * 0.02) knob((R() - 0.5) * 0.02, y, 0.009 + R() * 0.006);
    for (const off of [0.075, 0.16]) {
      let acc = off > 0.1 ? 0.03 : 0;
      for (let i = 1; i < up.length; i++) {
        const a = up[i - 1], b = up[i];
        const dl = Math.hypot(b[0] - a[0], b[1] - a[1]);
        acc += dl; if (acc < 0.06 + R() * 0.05) continue; acc = 0;
        if (R() < 0.2) continue;
        const nx = (b[1] - a[1]) / dl, ny = -(b[0] - a[0]) / dl;
        for (const sd of [-1, 1]) {
          const px = sd * (a[0] + nx * off), py = a[1] + ny * off;
          if (!inPoly(head, px, py - 0.03) || !inPoly(head, px + 0.025, py) || !inPoly(head, px - 0.025, py)) continue;
          knob(px + (R() - 0.5) * 0.02, py + (R() - 0.5) * 0.02, 0.007 + R() * 0.008);
        }
      }
    }
    // a garland of cut leaves arching over the mouth, in the middle of the rostrum
    {
      let acc = 0, idx = 0;
      for (let i = 1; i < up.length; i++) {
        const a = up[i - 1], b = up[i];
        const dl = Math.hypot(b[0] - a[0], b[1] - a[1]);
        acc += dl; if (acc < 0.034) continue; acc = 0; idx++;
        const tx = (b[0] - a[0]) / dl, ty = (b[1] - a[1]) / dl, nx = ty, ny = -tx;
        const off = 0.125;
        for (const sd of [-1, 1]) {
          const px = sd * (a[0] + nx * off), py = a[1] + ny * off;
          if (!inPoly(head, px, py - 0.03) || !inPoly(head, px + 0.025, py) || !inPoly(head, px - 0.025, py)) continue;
          const ang = Math.atan2(ty, sd * tx);
          if (idx % 2) {
            D.cut((p) => { p.at(px, py, 0.0011, ang + sd * 0.5); p.path('M-14 0 C-8 -7 4 -8 14 0 C4 8 -8 7 -14 0 Z'); p.id(); }, 0.2);
            D.cut((p) => { p.at(px, py, 0.0011, ang - sd * 0.5); p.path('M-14 0 C-8 -7 4 -8 14 0 C4 8 -8 7 -14 0 Z'); p.id(); }, 0.2);
          } else {
            D.cut((p) => p.circle(px, py, 0.006), 0);
          }
        }
      }
    }
    // scale-crescents finely along the rostrum's outer edge
    for (let i = 4; i < up.length - 1; i += 2) {
      const a = up[i - 1], b = up[i];
      const dl = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const nx = (b[1] - a[1]) / dl, ny = -(b[0] - a[0]) / dl;
      for (const sd of [-1, 1]) {
        const px = sd * (a[0] + nx * 0.23), py = a[1] + ny * 0.23;
        if (!inPoly(head, px, py - 0.03) || !inPoly(head, px + 0.02, py) || !inPoly(head, px - 0.02, py)) continue;
        D.cut((p) => crescent(p, px, py, 0.012, Math.atan2(ny, sd * nx) + Math.PI / 2, 0.5), 0);
      }
    }
    // lower lip: a rim line with small bumps
    for (const sd of [-1, 1]) {
      D.cutLine((p) => p.pts(lo.slice(5).map((q) => [sd * q[0], q[1] + 0.032]), true), 1.8 / g.U, 0.5);
      for (let i = 7; i < lo.length; i += 3) D.cut((p) => p.circle(sd * lo[i][0], lo[i][1] + 0.016, 0.005), 0);
    }
    // throat pleats: long grooves sweeping down from the lip into the sea
    for (let i = 0; i < 14; i++) {
      const off = 0.07 + i * 0.05 + i * i * 0.0015;
      for (const sd of [-1, 1]) {
        const a = lo.slice(2).map((q) => [sd * q[0] * (1 + off * 0.42), q[1] + off]);
        const ext = [sd * -mw * (1 + off * 0.42) + sd * -0.02, cn + off * 0.55];
        D.cutLine((p) => p.pts([ext].concat(a), true), (2.4 - i * 0.07) / g.U, 0.6);
      }
    }
    // eyes, old and kind, in the notch between rostrum and jowl
    for (const sd of [-1, 1]) {
      const ex = sd * (mw + 0.3), ey = cn + 0.07;
      if (Math.abs(ex) > g.hw + 0.12) continue;
      const S = 0.0012;
      D.cut((p) => { p.at(ex, ey, S, 0.08 * sd, sd > 0); p.path('M-56 4 C-34 -24 22 -30 58 -2 C26 16 -26 18 -56 4 Z'); p.id(); }, 0.6);
      D.paper((p) => { p.at(ex, ey, S, 0.08 * sd, sd > 0); p.circle(6, -2, 16); p.pts([[-2, -14], [14, -14], [14, -30], [-2, -30]]); p.id(); }, 0.4);
      D.cut((p) => { p.at(ex, ey, S, 0.08 * sd, sd > 0); p.circle(11, -7, 4.6); p.id(); }, 0);
      D.cutLine((p) => {
        p.at(ex, ey, S, 0.08 * sd, sd > 0);
        p.path('M-66 -8 C-40 -42 30 -48 70 -14');
        p.path('M-60 18 C-26 32 26 30 62 10');
        p.path('M66 -28 C84 -36 98 -32 108 -22');
        p.path('M70 6 C88 6 100 12 110 22');
        p.path('M-70 -2 C-84 -6 -94 -2 -102 6');
        p.id();
      }, 1.7 / g.U, 0.5);
    }
    // barnacles on the jowls and the chin
    for (let i = 0; i < 60; i++) {
      const sd = R() < 0.5 ? -1 : 1;
      const x = sd * lerp(mw + 0.04, mw + 0.48, R()), y = cn + 0.16 + R() * 0.55;
      if (!inPoly(head, x, y) || Math.abs(x) > g.hw + 0.05) continue;
      const r = 0.004 + Math.pow(R(), 2) * 0.012;
      D.cut((p) => p.circle(x, y, r), 0.2);
      if (r > 0.01) D.paper((p) => p.circle(x, y, r * 0.35), 0);
    }
  };

  // 2 · the night behind the whale: pricked stars, a cut moon, the far sea
  LAYERS[2] = function (D, g, R) {
    const hw = g.hw, hh = g.hh;
    D.paper((p) => p.pts([[-hw - 1, -hh - 1], [hw + 1, -hh - 1], [hw + 1, hh + 1], [-hw - 1, hh + 1]]));
    D.cut((p) => p.pts(innerSheet(g, 0.06)), 0.5);
    const head = headPoly(g);
    const hor = 0.16 + g.ex * 0.2;
    const outside = (x, y, m) => !inPoly(head, x, y) && !inPoly(head, x + m, y) && !inPoly(head, x - m, y) && !inPoly(head, x, y + m) && !inPoly(head, x, y - m);
    for (let i = 0; i < 520; i++) {
      const x = lerp(-hw - 0.1, hw + 0.1, R()), y = lerp(-hh - 0.05, hor - 0.04, Math.pow(R(), 1.2));
      if (!outside(x, y, 0.01)) continue;
      const r = (0.45 + Math.pow(R(), 5) * 1.7) / g.U;
      D.cut((p) => p.circle(x, y, r), 0);
    }
    for (let i = 0; i < 14; i++) {
      const x = lerp(-hw, hw, R()), y = lerp(-hh, hor - 0.25, R());
      if (!outside(x, y, 0.03)) continue;
      const r = (4 + R() * 5) / g.U, t = r * 0.16;
      D.cut((p) => p.pts([[x, y - r], [x + t, y - t], [x + r, y], [x + t, y + t], [x, y + r], [x - t, y + t], [x - r, y], [x - t, y - t]]), 0);
    }
    // the moon, a thin crescent
    const cands = [[-(hw + g.mw) / 2 - 0.14, -0.58], [-hw * 0.6, -hh + 0.32], [-(hw + g.mw) / 2, -0.3], [hw * 0.6, -hh + 0.3]];
    for (const c of cands) {
      if (Math.abs(c[0]) > hw - 0.1 || c[1] < -hh + 0.12 || !outside(c[0], c[1], 0.12)) continue;
      D.cut((p) => p.circle(c[0], c[1], 0.07), 0.6);
      D.paper((p) => p.circle(c[0] + 0.03, c[1] - 0.02, 0.064), 0.6);
      break;
    }
    // far sea: rows of short slits below the horizon
    for (let row = 0; row < 16; row++) {
      const y = hor + 0.015 + row * row * 0.004 + row * 0.02;
      for (let x = -hw - 0.1 + R() * 0.05; x < hw + 0.1; x += 0.05 + R() * 0.07) {
        if (!outside(x, y, 0.01)) continue;
        const l = 0.012 + R() * 0.03 + row * 0.003;
        D.cutLine((p) => p.M(x, y).L(x + l, y + (R() - 0.5) * 0.004), (0.9 + row * 0.1) / g.U, 0.2);
      }
    }
  };

  // ribs: an arch of two bones meeting under a vertebra; floor band
  function ribArch(D, g, R, o, opt) {
    const rw = opt.rw, gap = opt.gap, cx = opt.cx || 0;
    D.paper((p) => {
      const a = [];
      for (let i = 0; i <= 90; i++) { const x = lerp(-g.hw - 0.6, g.hw + 0.6, i / 90); a.push([x, o.floor + opt.floorFn(x)]); }
      a.push([g.hw + 0.6, g.hh + 1.5], [-g.hw - 0.6, g.hh + 1.5]);
      p.pts(a);
    }, 0.8);
    if (opt.sea) {
      // a row of stage waves along the water line, curling toward the middle
      const span = o.hw + 0.3, n = Math.max(4, Math.round((2 * span) / opt.seaStep)), crests = [];
      for (let i = 0; i < n; i++) {
        const x = lerp(-span, span, (i + 0.5) / n) + (R() - 0.5) * opt.seaStep * 0.35;
        if (opt.skip && opt.skip(x)) continue;
        crests.push([x, o.floor + opt.floorFn(x) + 0.004, opt.sea * (0.8 + R() * 0.4), x < 0 ? 1 : -1]);
      }
      for (const c of crests) D.paper((p) => { p.at(c[0], c[1], c[2], 0, c[3] < 0); p.path(WAVE); p.id(); }, 0.6);
      for (const c of crests) {
        D.cutLine((p) => { p.at(c[0], c[1], c[2], 0, c[3] < 0); p.path('M-70 4 C-50 1 -32 -14 -14 -38'); p.path('M6 -52 C22 -60 44 -60 54 -46 C58 -40 54 -34 48 -35'); p.id(); }, 1.1 / g.U, 0.4);
        D.cut((p) => { p.at(c[0], c[1], c[2], 0, c[3] < 0); p.circle(-2, -28, 3.6); p.circle(8, -38, 2.8); p.id(); }, 0);
      }
      const r = opt.sea * 24;
      for (let row = 0; row < 4; row++) {
        for (let x = -span + (row % 2) * r; x < span; x += r * 2) {
          if (opt.skip && opt.skip(x)) continue;
          const y = o.floor + opt.floorFn(x) + 0.03 + row * r * 1.1;
          D.cutLine((p) => p.M(x - r * 0.9, y + r * 0.2).Q(x, y - r * 0.95, x + r * 0.9, y + r * 0.2), 1.1 / g.U, 0.3);
        }
      }
    }
    const sides = [];
    for (const sd of [-1, 1]) {
      const side = archSide(o.hw + rw * 0.5, o.apex - rw * 0.55, o.floor + 0.05, opt.bulge, 70);
      const pts = side.map((q) => [sd < 0 ? cx + q[0] : cx - q[0], q[1]]);
      sides.push(pts);
      const w0 = rw * (0.92 + R() * 0.16), ph = R() * 9;
      // the bone: thick near the spine, tapering, with a knuckle where it meets the vertebra
      D.paper((p) => p.ribbon(pts.slice(0, -3), (t) => w0 * (0.75 + 0.45 * t + 0.25 * Math.exp(-Math.pow((t - 0.93) / 0.05, 2))) * (1 + 0.06 * Math.sin(t * 19 + ph))), 0.8);
      // a groove along the bone
      D.cutLine((p) => p.pts(pts.slice(6, -9).map((q, i, arr) => [q[0] - sd * rw * 0.1 * Math.sin((i / arr.length) * Math.PI), q[1]]), true), Math.max(1 / g.U, rw * 0.06), 0.4);
    }
    // vertebra keystone
    const vy = o.apex - rw * 0.5, vs = rw * 0.95;
    D.paper((p) => {
      p.at(cx, vy, vs / 10, 0);
      p.path('M-14 -3 C-14 -9 -8 -11 0 -11 C8 -11 14 -9 14 -3 C14 3 8 6 0 6 C-8 6 -14 3 -14 -3 Z');
      p.path('M-5 -9 C-7 -18 -5 -28 0 -36 C5 -28 7 -18 5 -9 Z');
      p.path('M-12 -5 C-17 -9 -22 -11 -27 -10 C-24 -5 -19 -2 -12 0 Z');
      p.path('M12 -5 C17 -9 22 -11 27 -10 C24 -5 19 -2 12 0 Z');
      p.id();
    }, 0.5);
    return sides;
  }

  // kelp: a stipe, a float, a long ruffled blade
  function kelp(D, g, R, x0, y0, len, dir, w) {
    const n = 9, ph = R() * TAU, amp = 0.02 + R() * 0.025, pts = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      pts.push([x0 + Math.sin(ph + t * 4.2) * amp * t, y0 + dir * len * t]);
    }
    const c = spline(pts, false, 10);
    const ph2 = R() * 9;
    const wf = (t) => w * (0.14 + 0.86 * clamp((t - 0.08) / 0.16, 0, 1)) * (1 - 0.72 * t) * (1 + 0.16 * Math.sin(t * 46 + ph2)) + 0.0015;
    D.paper((p) => p.ribbon(c, wf), 0.6);
    const fq = c[Math.round(c.length * 0.1)];
    D.paper((p) => p.ellipse(fq[0], fq[1], w * 0.34, w * 0.42, 0), 0.4);
    D.cutLine((p) => p.pts(c.slice(Math.round(c.length * 0.22), -8), true), Math.max(0.9 / g.U, w * 0.05), 0.3);
    for (let i = Math.round(c.length * 0.3); i < c.length - 10; i += 7 + Math.floor(R() * 9)) {
      const q = c[i], ww = wf(i / (c.length - 1)), sd = R() < 0.5 ? -1 : 1;
      D.cut((p) => p.ellipse(q[0] + sd * ww * 0.25, q[1], ww * 0.09, ww * 0.16, 0), 0.3);
    }
  }

  // one tread of the driftwood stair that climbs, sheet by sheet, from the water to the room
  function stairStep(D, g, R, k) {
    const f = (k - 3) / 3;
    const y = lerp(g.op[3].floor - 0.095, 0.36, f);
    const hw = lerp(0.2, 0.15, f) * (0.95 + R() * 0.1);
    const tilt = (R() - 0.5) * 0.014, cx = (R() - 0.5) * 0.02 + 0.01;
    const th = 0.017;
    for (const sd of [-1, 1]) {
      const px = cx + sd * (hw - 0.03 - R() * 0.012);
      const top = y - 0.04 - R() * 0.035;
      D.paper((p) => p.pts([[px - 0.008, top + 0.005], [px - 0.003, top - 0.002], [px + 0.004, top + 0.001], [px + 0.008, top + 0.007], [px + 0.01, y + 0.3], [px - 0.009, y + 0.3]]), 0.6);
      D.cutLine((p) => p.M(px - 0.002, top + 0.02).L(px - 0.001, y - 0.006), 0.8 / g.U, 0.3);
      D.cutLine((p) => p.M(px - 0.009, top + 0.013).L(px + 0.009, top + 0.019).M(px - 0.009, top + 0.022).L(px + 0.009, top + 0.028), 1.0 / g.U, 0);
    }
    D.paper((p) => p.ribbon([[cx - hw + 0.035, y + th + 0.004], [cx + hw - 0.035, y + 0.13]], () => 0.007), 0.5);
    D.paper((p) => p.pts([[cx - hw, y - th * 0.5], [cx - hw * 0.3, y - th * 0.56 + tilt * 0.3], [cx + hw, y - th * 0.5 + tilt], [cx + hw + 0.007, y + th * 0.1 + tilt], [cx + hw - 0.002, y + th * 0.5 + tilt], [cx - hw + 0.004, y + th * 0.5], [cx - hw - 0.008, y + th * 0.05]]), 0.9);
    D.cutLine((p) => p.M(cx - hw * 0.85, y - 0.001).Q(cx, y + 0.003 + tilt * 0.5, cx + hw * 0.7, y + tilt * 0.8), 0.9 / g.U, 0.3);
    D.cut((p) => { p.circle(cx - hw + 0.025, y, 0.0022); p.circle(cx + hw - 0.025, y + tilt, 0.0022); }, 0);
  }

  // 3 · first ribs: kelp hanging from the bones, a little school of fish on threads
  LAYERS[3] = function (D, g, R) {
    const o = g.op[3];
    const rw = 0.065, gap = 0.026;
    const sides = ribArch(D, g, R, o, {
      rw, gap, bulge: 0.12, cx: -0.01,
      floorFn: (x) => -0.006 * Math.sin(x * 9 + 1.3),
      sea: 0.00135, seaStep: 0.21,
    });
    // barnacles
    for (const pts of sides) {
      for (let i = 4; i < pts.length - 6; i++) {
        if (R() < 0.6) continue;
        const q = pts[i];
        D.cut((p) => p.circle(q[0] + (R() - 0.5) * rw * 0.5, q[1], rw * (0.06 + R() * 0.09)), 0);
      }
    }
    // kelp hanging from the arch, rising from the floor, always off to the sides
    for (const [si, sd] of [[0, -1], [1, 1]]) {
      const pts = sides[si];
      for (const t of [0.42, 0.6, 0.74]) {
        if (R() < 0.15) continue;
        const q = pts[Math.round((t + (R() - 0.5) * 0.05) * (pts.length - 1))];
        const x0 = q[0] - sd * rw * 0.45;
        if (Math.abs(x0) < 0.64) continue;
        const len = (0.3 + R() * 0.22) * (1 + g.ex * 0.8);
        kelp(D, g, R, x0, q[1] + rw * 0.3, len, 1, 0.048 + R() * 0.016);
      }
      for (let i = 0; i < 2; i++) {
        const x0 = sd * (o.hw - 0.06 - i * 0.1 - R() * 0.03);
        kelp(D, g, R, x0, o.floor + 0.03, 0.26 + R() * 0.2 + g.ex * 0.35, -1, 0.04 + R() * 0.012);
      }
    }
    // a school of fish on threads, swimming in toward the light
    const nf = 4;
    const fx0 = -o.hw * 0.66, fy0 = lerp(o.apex, o.floor, 0.3);
    for (let i = 0; i < nf; i++) {
      const x = fx0 + i * 0.1 + (R() - 0.5) * 0.03, y = fy0 + Math.sin(i * 1.9 + 0.5) * 0.045 + i * 0.015;
      const len = 0.085 + R() * 0.02;
      D.paper((p) => fish(p, x, y, len, 1));
      fishCuts(D, x, y, len, 1);
      D.paperLine((p) => p.M(x + len * 0.04, y - len * 0.18).L(x + len * 0.04 + (R() - 0.5) * 0.02, o.apex - 0.2), 0.9 / g.U, 0);
    }
  };

  // 4 · second ribs and the wreck: a small boat run aground, broken mast, torn sail, lantern
  LAYERS[4] = function (D, g, R) {
    const o = g.op[4];
    const rw = 0.058, gap = 0.024;
    ribArch(D, g, R, o, {
      rw, gap, bulge: 0.1, cx: 0.015,
      floorFn: (x) => -0.006 * Math.sin(x * 7) - 0.01 * Math.exp(-Math.pow((x - o.hw * 0.66) / 0.22, 2)),
      sea: 0.00105, seaStep: 0.17,
    });
    // the wreck: sunk to her gunwales, only the bow and the broken mast above the water
    const k = clamp((o.hw - 0.5) / 0.36, 0.6, 1);
    const mx = o.hw - 0.15 * k, my = o.floor + 0.02;
    const H = Math.min(my + 0.42, 1.05) * (0.85 + 0.15 * k);
    const top = [mx + 0.07 * k, my - H];
    const mpt = (t) => [lerp(mx, top[0], t) + 0.006 * Math.sin(t * 3), lerp(my, top[1], t)];
    // bow and a short length of gunwale breaking the surface
    D.paper((p) => {
      p.at(mx - 0.13 * k, my - 0.03, 0.0042 * k, 0.32);
      p.path('M-58 -40 C-50 -34 -30 -27 0 -26 C22 -25 38 -28 48 -33 L50 20 L-40 20 C-46 -12 -52 -24 -56 -34 Z');
      p.path('M-57 -39 L-82 -51 L-81.5 -48 L-56 -35 Z');
      p.id();
    }, 0.8);
    D.cutLine((p) => { p.at(mx - 0.13 * k, my - 0.03, 0.0042 * k, 0.32); p.path('M-52 -31 C-30 -21 10 -17 46 -25'); p.path('M-48 -21 C-28 -12 8 -9 46 -16'); p.id(); }, 1.1 / g.U, 0.4);
    D.cut((p) => { p.at(mx - 0.13 * k, my - 0.03, 0.0042 * k, 0.32); p.circle(-34, -17, 2.4); p.circle(-23, -15, 2.4); p.path('M2 -22 L10 -25 L14 -18 L22 -23 L28 -14 L20 -8 L12 -11 L4 -9 Z'); p.id(); }, 0.4);
    // the mast, splintered at the top, with a crow's nest
    D.paper((p) => p.ribbon([mpt(0), mpt(0.5), mpt(1)], (t) => (0.019 - 0.008 * t) * k), 0.5);
    D.paper((p) => p.pts([[top[0] - 0.008 * k, top[1] + 0.004], [top[0] - 0.005 * k, top[1] - 0.03 * k], [top[0] - 0.001, top[1] - 0.012 * k], [top[0] + 0.003 * k, top[1] - 0.045 * k], [top[0] + 0.006 * k, top[1] - 0.01 * k], [top[0] + 0.007 * k, top[1] + 0.004]]), 0.3);
    const nest = mpt(0.86);
    D.paper((p) => { p.at(nest[0], nest[1], 0.001 * k, 0.08); p.path('M-30 -14 L30 -14 L26 4 C14 10 -14 10 -26 4 Z'); p.path('M-34 -18 L34 -18 L34 -13 L-34 -13 Z'); p.id(); }, 0.5);
    D.cutLine((p) => { p.at(nest[0], nest[1], 0.001 * k, 0.08); for (const x of [-18, -6, 6, 18]) p.M(x, -10).L(x * 0.92, 5); p.id(); }, 0.9 / g.U, 0);
    // shrouds with ratlines: two triangular nets from the masthead to the hidden chainplates
    for (const [fx, fy, n] of [[-0.19, 0.0, 3], [0.15, 0.01, 3]]) {
      const foot = [mx + fx * k, my + fy];
      const head = mpt(0.8);
      const lines = [];
      for (let i = 0; i < n; i++) {
        const f0 = [foot[0] + (i - (n - 1) / 2) * 0.022 * k, foot[1]];
        lines.push([f0, head]);
        D.paperLine((p) => p.M(f0[0], f0[1]).L(head[0] + (i - 1) * 0.003, head[1]), 1.05 / g.U, 0);
      }
      for (let t = 0.05; t < 0.9; t += 0.045) {
        const a = lines[0], b = lines[n - 1];
        const pa = [lerp(a[0][0], a[1][0], t), lerp(a[0][1], a[1][1], t)], pb = [lerp(b[0][0], b[1][0], t), lerp(b[0][1], b[1][1], t)];
        D.paperLine((p) => p.M(pa[0], pa[1]).Q((pa[0] + pb[0]) / 2, (pa[1] + pb[1]) / 2 + 0.004, pb[0], pb[1]), 0.9 / g.U, 0);
      }
    }
    // a yard hanging askew, a rag of sail, the lantern on the end toward the room
    const yc = mpt(0.72);
    const A = [yc[0] - 0.19 * k, yc[1] + 0.075 * k], B = [yc[0] + 0.15 * k, yc[1] - 0.03 * k];
    D.paper((p) => p.ribbon([A, [lerp(A[0], B[0], 0.5), lerp(A[1], B[1], 0.5) + 0.004], B], (t) => (0.009 - 0.003 * t) * k), 0.4);
    D.paper((p) => {
      const a = [], n = 9;
      for (let i = 0; i <= n; i++) { const u = 0.35 + (i / n) * 0.55; a.push([lerp(A[0], B[0], u), lerp(A[1], B[1], u) + 0.004]); }
      for (let i = n; i >= 0; i--) {
        const u = 0.35 + (i / n) * 0.55;
        const L = (0.08 + 0.07 * Math.sin(((u - 0.35) / 0.55) * Math.PI) + (i % 2 ? 0.03 : -0.01) + R() * 0.025) * k;
        a.push([lerp(A[0], B[0], u) + (i % 2 ? 0.006 : -0.004), lerp(A[1], B[1], u) + L]);
      }
      p.pts(a);
    }, 1);
    D.cut((p) => { const c = [lerp(A[0], B[0], 0.62), lerp(A[1], B[1], 0.62) + 0.04 * k]; p.circle(c[0], c[1], 0.008 * k); p.ellipse(c[0] + 0.035 * k, c[1] - 0.012 * k, 0.006 * k, 0.012 * k, 0.3); }, 0.6);
    const ls = 0.0026 * k, lx = A[0] + 0.004, ly = A[1] + 0.06 * k;
    D.paperLine((p) => p.M(A[0], A[1]).L(lx, ly), 1.0 / g.U, 0);
    D.paper((p) => { p.at(lx, ly, ls); p.path('M-5 0 L5 0 L3.5 2.5 L4.2 13 L2.8 15 L-2.8 15 L-4.2 13 L-3.5 2.5 Z'); p.circle(0, -1.4, 1.8); p.pts([[-1.2, 15], [1.2, 15], [0.8, 17.5], [-0.8, 17.5]]); p.id(); }, 0.3);
    D.cut((p) => { p.at(lx, ly, ls); p.pts([[-2.3, 3.6], [2.3, 3.6], [2.6, 12], [-2.6, 12]]); p.id(); }, 0);
    D.paperLine((p) => { p.at(lx, ly, ls); p.M(0, 3.6).L(0, 12); p.id(); }, 0.7 / g.U, 0);
    D.tissue((p) => { p.at(lx, ly, ls); p.pts([[-2.8, 3], [2.8, 3], [3, 12.5], [-3, 12.5]]); p.id(); });
    // a loose stay
    D.paperLine((p) => { const h = mpt(0.95); p.M(h[0], h[1]).Q(h[0] - 0.16 * k, h[1] + 0.18 * k, mx - 0.24 * k, my - 0.12 * k); }, 0.9 / g.U, 0);
  };

  // 5 · third ribs: a stair of driftwood climbing to the room; barrels
  LAYERS[5] = function (D, g, R) {
    const o = g.op[5];
    const rw = 0.052, gap = 0.021;
    ribArch(D, g, R, o, {
      rw, gap, bulge: 0.08, cx: -0.01,
      floorFn: (x) => -0.003 * Math.sin(x * 13 + 2) + 0.1 * clamp((-0.47 - x) / 0.05, 0, 1),
      sea: 0.0009, seaStep: 0.14, skip: (x) => x < -0.44,
    });
    // a stair of driftwood up to the room: thick uneven treads on a crooked stringer
    const x1 = -0.5, y1 = 0.345, x0 = Math.min(-o.hw + 0.02, -0.76), y0 = o.floor + 0.1;
    const nst = 6, run = (x1 - x0) / nst, rise = (y0 - y1) / nst;
    D.paper((p) => p.ribbon([[x0 - 0.015, y0 + 0.02], [lerp(x0, x1, 0.5), lerp(y0, y1, 0.5) + 0.028], [x1 + 0.01, y1 + 0.025]], (t) => 0.018 - 0.004 * t), 0.7);
    for (let i = 0; i < nst; i++) {
      const sx = x0 + i * run, sy = y0 - (i + 1) * rise;
      const tw = run * (1.45 + R() * 0.3), th = 0.014, tilt = (R() - 0.5) * 0.1;
      D.paper((p) => { p.at(sx + run * 0.6, sy, 1, tilt); p.pts([[-tw / 2 - 0.004, 0.001], [-tw * 0.1, -0.0015], [tw / 2, 0], [tw / 2 + 0.006, th * 0.6], [tw / 2 - 0.002, th], [-tw / 2, th * 1.1], [-tw / 2 - 0.006, th * 0.5]]); p.id(); }, 0.7);
      D.cutLine((p) => p.M(sx + run * 0.1, sy + th * 0.5).Q(sx + run * 0.6, sy + th * 0.25, sx + run * 1.1, sy + th * 0.55), 0.8 / g.U, 0.2);
      D.cut((p) => p.circle(sx + run * 0.55, sy + th * 0.5, 0.002), 0);
    }
    const rails = [];
    for (let i = 0; i <= nst; i += 2) {
      const sx = x0 + i * run + run * 0.5, sy = y0 - i * rise - 0.002;
      const ht = 0.105 + (R() - 0.5) * 0.02, tx = sx + (R() - 0.5) * 0.014;
      rails.push([tx, sy - ht]);
      D.paper((p) => p.ribbon([[sx, sy + 0.01], [lerp(sx, tx, 0.5) + 0.003, sy - ht * 0.5], [tx, sy - ht]], (t) => 0.008 - 0.002 * t), 0.4);
    }
    D.paper((p) => p.ribbon(spline(rails, false, 6), (t) => 0.009 + 0.002 * Math.sin(t * 23)), 0.6);
    const kn = rails[1];
    D.paper((p) => p.ribbon([[kn[0], kn[1]], [kn[0] - 0.012, kn[1] - 0.028], [kn[0] - 0.02, kn[1] - 0.036]], (t) => 0.006 * (1 - t) + 0.0015), 0.3);
    // barrels on the right
    const bs = clamp((o.hw - 0.4) / 0.35, 0.6, 1);
    const bx = o.hw * 0.66, by = o.floor + 0.006;
    D.paper((p) => { p.at(bx, by, 0.00105 * bs); p.path('M-40 0 C-46 -30 -46 -70 -40 -100 L40 -100 C46 -70 46 -30 40 0 Z'); p.id(); });
    D.cutLine((p) => { p.at(bx, by, 0.00105 * bs); p.path('M-43 -18 C-15 -14 15 -14 43 -18'); p.path('M-44 -82 C-15 -86 15 -86 44 -82'); p.path('M-45 -40 C-15 -36 15 -36 45 -40'); p.path('M-45 -60 C-15 -64 15 -64 45 -60'); p.id(); }, 1.4 / g.U);
    D.cutLine((p) => { p.at(bx, by, 0.00105 * bs); for (const sx of [-24, -8, 8, 24]) p.M(sx, -96).Q(sx * 1.15, -50, sx, -4); p.id(); }, 0.9 / g.U);
    const bx2 = bx + 0.115 * bs;
    D.paper((p) => { p.at(bx2, by, 0.00105 * bs); p.ellipse(0, -36, 52, 36, 0); p.id(); });
    D.cut((p) => { p.at(bx2, by, 0.00105 * bs); p.ellipse(34, -36, 12, 28, 0); p.id(); }, 0.4);
    D.paper((p) => { p.at(bx2, by, 0.00105 * bs); p.ellipse(34, -36, 8, 24, 0); p.id(); }, 0.3);
    D.cutLine((p) => { p.at(bx2, by, 0.00105 * bs); p.path('M-30 -68 C-34 -50 -34 -22 -30 -4'); p.path('M10 -70 C6 -50 6 -22 10 -2'); p.id(); }, 1.4 / g.U);
  };

  // 6 · the room's threshold: last ribs, washing line with laundry, a bookshelf
  LAYERS[6] = function (D, g, R) {
    const o = g.op[6];
    const rw = 0.045, gap = 0.018;
    ribArch(D, g, R, o, {
      rw, gap, bulge: 0.06, cx: 0.0,
      floorFn: (x) => -0.002 * Math.sin(x * 40),
    });
    // planks of the floor edge
    for (let x = -o.hw; x < o.hw; x += 0.06 + R() * 0.05) D.cutLine((p) => p.M(x, o.floor + 0.006).L(x + (R() - 0.5) * 0.004, o.floor + 0.05), 1.0 / g.U, 0.2);
    // washing line
    const lx0 = -o.hw + 0.06, ly0 = -0.27, lx1 = o.hw - 0.05, ly1 = -0.25, sag = 0.045;
    const ly = (x) => { const t = (x - lx0) / (lx1 - lx0); return lerp(ly0, ly1, t) + sag * 4 * t * (1 - t); };
    D.paperLine((p) => { const a = []; for (let i = 0; i <= 30; i++) { const x = lerp(lx0 - 0.03, lx1 + 0.03, i / 30); a.push([x, ly(x)]); } p.pts(a, true); }, 1.4 / g.U, 0.2);
    const items = ['shirt', 'socks', 'apron', 'sock'];
    let x = 0.04 + R() * 0.03;
    for (const it of items) {
      const y = ly(x);
      if (it === 'shirt') {
        const s = 0.0011;
        D.paper((p) => { p.at(x + 0.05, y, s, (R() - 0.5) * 0.05); p.path('M-30 0 L-12 -2 C-6 4 6 4 12 -2 L30 0 L46 26 L34 34 L26 22 L26 70 C10 74 -10 74 -26 70 L-26 22 L-34 34 L-46 26 Z'); p.id(); });
        D.cutLine((p) => { p.at(x + 0.05, y, s, 0); p.M(0, 4).L(0, 68); p.path('M-12 -2 C-6 8 6 8 12 -2'); p.id(); }, 0.9 / g.U);
        D.cut((p) => { p.at(x + 0.05, y, s, 0); for (let i = 0; i < 4; i++) p.circle(4, 14 + i * 13, 1.8); p.id(); }, 0);
        x += 0.12;
      } else if (it === 'socks') {
        for (let j = 0; j < 2; j++) {
          const sx = x + j * 0.035;
          D.paper((p) => { p.at(sx, ly(sx), 0.0009, (R() - 0.5) * 0.08); p.path('M-8 0 L8 0 L8 44 C8 52 14 56 22 58 C26 60 26 70 18 70 L2 68 C-6 66 -8 58 -8 50 Z'); p.id(); });
          if (j === 1) for (let i = 0; i < 4; i++) D.cut((p) => { p.at(sx, ly(sx), 0.0009, 0); p.pts([[-8, 8 + i * 9], [8, 8 + i * 9], [8, 12 + i * 9], [-8, 12 + i * 9]]); p.id(); }, 0);
        }
        x += 0.09;
      } else if (it === 'apron') {
        D.paper((p) => { p.at(x + 0.03, ly(x + 0.03), 0.001, 0); p.path('M-24 0 L24 0 C26 20 30 40 34 60 C20 64 -20 64 -34 60 C-30 40 -26 20 -24 0 Z'); p.id(); });
        for (let i = 0; i < 7; i++) D.cut((p) => { p.at(x + 0.03, ly(x + 0.03), 0.001, 0); p.circle(-21 + i * 7, 54, 2.2); p.circle(-17.5 + i * 7, 46, 1.5); p.id(); }, 0);
        x += 0.09;
      } else {
        D.paper((p) => { p.at(x, ly(x), 0.0009, 0.1); p.path('M-8 0 L8 0 L8 40 C8 48 14 52 20 54 C24 56 24 64 16 64 L2 62 C-6 60 -8 54 -8 46 Z'); p.id(); });
      }
    }
    // pegs
    // bookshelf at the right, standing on the threshold
    const bx0 = o.hw - 0.2, bx1 = o.hw - 0.02, by0 = o.floor + 0.004, by1 = -0.12;
    D.paper((p) => p.pts([[bx0, by0], [bx0 + 0.012, by0], [bx0 + 0.012, by1], [bx0, by1]]), 0.4);
    D.paper((p) => p.pts([[bx1 - 0.012, by0], [bx1, by0], [bx1, by1 - 0.01], [bx1 - 0.012, by1 - 0.01]]), 0.4);
    const shelves = [by0 - 0.004, lerp(by0, by1, 0.34), lerp(by0, by1, 0.67), by1];
    for (const sy of shelves) D.paper((p) => p.pts([[bx0 - 0.008, sy], [bx1 + 0.008, sy], [bx1 + 0.008, sy + 0.01], [bx0 - 0.008, sy + 0.01]]), 0.4);
    for (let s = 0; s < 3; s++) {
      const base = shelves[s], top = shelves[s + 1] + 0.01;
      let xx = bx0 + 0.014;
      while (xx < bx1 - 0.03) {
        const w = 0.01 + R() * 0.012, hgt = (base - top) * (0.6 + R() * 0.3);
        if (R() < 0.12) { xx += w; continue; }
        const lean = R() < 0.15 ? 0.25 : 0;
        D.paper((p) => { p.at(xx + w / 2, base, 1, lean); p.pts([[-w / 2, 0], [w / 2, 0], [w / 2, -hgt], [-w / 2, -hgt]]); p.id(); }, 0.3);
        D.cutLine((p) => { p.at(xx + w / 2, base, 1, lean); p.M(-w * 0.35, -hgt * 0.82).L(w * 0.35, -hgt * 0.82); p.M(-w * 0.35, -hgt * 0.18).L(w * 0.35, -hgt * 0.18); p.id(); }, 0.8 / g.U, 0);
        xx += w + 0.002 + (lean ? 0.012 : 0);
      }
    }
  };

  // 7 · the room: stove with a crooked pipe, a cat asleep on a chair, a table, the lamp, the reader
  LAYERS[7] = function (D, g, R) {
    const rx = g.room.x, ry = g.room.y;
    D.paper((p) => p.pts(innerSheet(g, 0.14)));
    const o6 = g.op[6];
    D.cut((p) => p.pts(archPoly(0, o6.hw + 0.05, o6.apex - 0.07, ry, 0.06, 0)), 0.6);
    // the far ribs of the whale, cut as thin slits in the inner wall
    for (let i = 0; i < 4; i++) {
      const side = archSide(o6.hw + 0.13 + i * 0.1, o6.apex - 0.12 - i * 0.09, ry + 0.02, 0.08, 90);
      for (const sd of [-1, 1]) {
        let j = 2 + Math.floor(R() * 6);
        while (j < side.length - 3) {
          const l = 6 + Math.floor(R() * 14);
          const seg = side.slice(j, Math.min(side.length - 2, j + l)).map((q) => [sd * q[0], q[1]]);
          if (seg.length > 1) D.cutLine((p) => p.pts(seg, true), (1.1 + R() * 0.6) / g.U, 0.4);
          j += l + 2 + Math.floor(R() * 5);
        }
      }
    }
    // floor planks
    for (let x = rx - 0.6; x < rx + 0.6; x += 0.05 + R() * 0.05) D.cutLine((p) => p.M(x, ry + 0.012).L(x + 0.01, ry + 0.06), 0.9 / g.U, 0.2);
    // ---- table with lace cloth
    const T = (x, y) => [rx + x, ry + y];
    const tl = -0.12, tr = 0.13, tt = -0.205;
    D.paper((p) => p.pts([T(tl, tt), T(tr, tt), T(tr, tt + 0.014), T(tl, tt + 0.014)]), 0.4);
    D.paper((p) => {
      p.M(...T(tl - 0.006, tt)).L(...T(tr + 0.006, tt)).L(...T(tr + 0.008, tt + 0.05));
      for (let x = tr + 0.008; x > tl - 0.008; x -= 0.0165) p.Q(...T(x - 0.008, tt + 0.062), ...T(x - 0.0165, tt + 0.05));
      p.Z();
    }, 0.4);
    for (let x = tr - 0.0; x > tl; x -= 0.0165) D.cut((p) => p.circle(...T(x - 0.0005, tt + 0.047), 0.0028), 0);
    for (let x = tr - 0.008; x > tl; x -= 0.0165) D.cut((p) => { const c = T(x, tt + 0.03); p.pts([[c[0], c[1] - 0.006], [c[0] + 0.004, c[1]], [c[0], c[1] + 0.006], [c[0] - 0.004, c[1]]]); }, 0);
    for (const lx of [tl + 0.02, tr - 0.02]) {
      D.paper((p) => p.ribbon([T(lx, tt + 0.05), T(lx, -0.0)], (t) => 0.011 + 0.006 * Math.exp(-Math.pow((t - 0.25) / 0.08, 2)) + 0.004 * Math.exp(-Math.pow((t - 0.7) / 0.06, 2))), 0.3);
    }
    D.paper((p) => p.pts([T(tl + 0.02, -0.045), T(tr - 0.02, -0.045), T(tr - 0.02, -0.038), T(tl + 0.02, -0.038)]), 0.3);
    // ---- the lamp
    const L0 = g.lamp[0];
    D.paper((p) => {
      p.at(L0, ry + tt, 0.001);
      p.path('M-16 0 L16 0 L9 -7 L5 -9 L5 -16 C16 -18 22 -26 22 -33 C22 -42 12 -49 0 -49 C-12 -49 -22 -42 -22 -33 C-22 -26 -16 -18 -5 -16 L-5 -9 L-9 -7 Z');
      p.path('M-11 -49 L11 -49 L11 -55 L14 -56 L14 -61 L-14 -61 L-14 -56 L-11 -55 Z');
      p.id();
    }, 0.3);
    D.paperLine((p) => { p.at(L0, ry + tt, 0.001); p.path('M20 -38 C34 -40 36 -26 22 -24'); p.id(); }, 2.2 / g.U, 0);
    D.paperLine((p) => {
      p.at(L0, ry + tt, 0.001);
      p.path('M-9 -61 C-9 -70 -20 -76 -20 -94 C-20 -110 -8 -116 -7 -128 L-7 -150 M9 -61 C9 -70 20 -76 20 -94 C20 -110 8 -116 7 -128 L7 -150');
      p.id();
    }, 1.6 / g.U, 0);
    D.tissue((p) => { p.at(L0, ry + tt, 0.001); p.path('M-9 -61 C-9 -70 -20 -76 -20 -94 C-20 -110 -8 -116 -7 -128 L-7 -150 L7 -150 L7 -128 C8 -116 20 -110 20 -94 C20 -76 9 -70 9 -61 Z'); p.id(); });
    D.cut((p) => { p.at(L0, ry + tt, 0.001); for (let i = -2; i <= 2; i++) p.circle(i * 5, -58, 1.3); p.id(); }, 0);
    // ---- stove with a crooked pipe and a kettle
    const sx = rx - 0.42;
    D.paper((p) => {
      p.at(sx, ry, 0.001);
      p.path('M-44 0 L-38 -40 L-46 -44 L-46 -52 L-40 -54 C-62 -80 -64 -128 -42 -164 L-40 -172 L-50 -174 L-50 -182 L50 -182 L50 -174 L40 -172 L42 -164 C64 -128 62 -80 40 -54 L46 -52 L46 -44 L38 -40 L44 0 L36 0 L28 -40 L-28 -40 L-36 0 Z');
      p.path('M-4 -40 L4 -40 L3 0 L-3 0 Z');
      p.id();
    }, 0.5);
    D.cut((p) => { p.at(sx, ry, 0.001); p.path('M-18 -78 L18 -78 L18 -118 C18 -130 -18 -130 -18 -118 Z'); p.id(); }, 0.4);
    D.paper((p) => { p.at(sx, ry, 0.001); for (const bx of [-9, 0, 9]) p.pts([[bx - 1.8, -76], [bx + 1.8, -76], [bx + 1.8, -126], [bx - 1.8, -126]]); p.pts([[-20, -98], [20, -98], [20, -101], [-20, -101]]); p.id(); }, 0);
    D.tissue((p) => { p.at(sx, ry, 0.001); p.path('M-18 -78 L18 -78 L18 -118 C18 -130 -18 -130 -18 -118 Z'); p.id(); });
    for (let i = 0; i < 9; i++) D.cut((p) => { p.at(sx, ry, 0.001); crescent(p, -40 + i * 10, -146, 3.5, 0, 0.5); p.id(); }, 0);
    // pipe
    D.paper((p) => {
      p.at(sx, ry, 0.001);
      const pts = [[22, -182], [22, -300], [52, -332], [52, -446], [-6, -500], [-6, -900]];
      for (let i = 1; i < pts.length; i++) p.ribbon([pts[i - 1], pts[i]], () => 22);
      for (let i = 1; i < pts.length - 1; i++) p.circle(pts[i][0], pts[i][1], 11);
      p.id();
    }, 0.5);
    D.paper((p) => { p.at(sx, ry, 0.001); for (const q of [[22, -240], [37, -316], [52, -400], [23, -473], [-6, -560]]) p.pts([[q[0] - 15, q[1] - 4], [q[0] + 15, q[1] - 4], [q[0] + 15, q[1] + 4], [q[0] - 15, q[1] + 4]]); p.id(); }, 0.3);
    // kettle + steam
    D.paper((p) => { p.at(sx - 0.015, ry - 0.182, 0.001); p.path('M-24 0 L24 0 C28 -8 26 -24 14 -30 L-14 -30 C-26 -24 -28 -8 -24 0 Z'); p.path('M-4 -30 L4 -30 L3 -36 L-3 -36 Z'); p.path('M22 -14 C32 -16 36 -26 44 -34 L46 -31 C40 -22 36 -10 24 -6 Z'); p.id(); }, 0.3);
    D.paperLine((p) => { p.at(sx - 0.015, ry - 0.182, 0.001); p.path('M-16 -30 C-16 -48 16 -48 16 -30'); p.id(); }, 2 / g.U, 0);
    D.paper((p) => { p.at(sx - 0.015, ry - 0.182, 0.001); p.ribbon(spline([[45, -34], [52, -46], [44, -58], [52, -72], [46, -84]], false, 6), (t) => 4 - 3 * t); p.id(); }, 0.3);
    // ---- a chair with a cat asleep on it
    const cx = rx - 0.215;
    const chair = (x, flip) => {
      D.paper((p) => {
        p.at(x, ry, 0.001, 0, flip);
        p.path('M-58 -126 L-50 -126 L-48 -2 L-54 0 Z');            // back post + back leg
        p.path('M-60 -284 C-56 -290 -50 -290 -48 -284 L-50 -126 L-58 -126 Z');
        p.path('M-56 -132 L54 -132 L54 -122 L-56 -122 Z');         // seat
        p.path('M44 -122 L52 -122 L50 0 L44 0 Z');                 // front leg
        p.path('M-50 -40 L46 -40 L46 -34 L-50 -34 Z');             // stretcher
        p.path('M-54 -250 L-54 -238 L-44 -236 L-44 -248 Z');
        p.path('M-54 -200 L-54 -190 L-44 -188 L-44 -198 Z');
        p.id();
      }, 0.4);
    };
    chair(cx, false);
    D.paper((p) => {
      p.at(cx + 0.004, ry - 0.132, 0.00122, 0, true);
      p.path('M-46 0 C-50 -6 -50 -14 -46 -20 C-50 -26 -50 -34 -45 -38 L-43 -50 L-35 -40 C-31 -42 -27 -42 -23 -41 L-15 -50 L-14 -36 C-6 -36 6 -40 20 -42 C38 -44 52 -34 54 -18 C56 -8 52 -2 46 0 Z');
      p.path('M-52 -4 C-56 -10 -54 -16 -46 -14 C-30 -8 10 -6 46 -6 L46 0 L-46 0 Z');
      p.id();
    }, 0.6);
    D.cutLine((p) => {
      p.at(cx + 0.004, ry - 0.132, 0.00122, 0, true);
      p.path('M-42 -7 C-20 -4 20 -4 46 -8');
      p.path('M-14 -34 C-20 -26 -22 -16 -18 -10');
      p.path('M22 -8 C16 -16 18 -30 32 -32 C42 -32 48 -24 48 -16');
      p.path('M-38 -26 C-35 -23 -32 -23 -30 -26');
      p.id();
    }, 1.0 / g.U, 0);
    // ---- the reader: an old woman in a shawl, spectacles on, book held to the light
    const RX = rx + 0.29, s = 0.0036;
    const her = (p) => p.at(RX, ry, s);
    D.paper((p) => {
      her(p);
      p.path('M-9 -37 L19 -37 L19 -33.6 L-9 -33.6 Z');
      p.path('M-7 -34 L-4.6 -34 L-4.4 0 L-6.8 0 Z');
      p.path('M14 -34 L16.4 -34 L17.6 0 L15.2 0 Z');
      p.path('M15 -34 L17.4 -34 L21.4 -79 L19 -79 Z');
      p.circle(20.4, -80.6, 1.7);
      p.path('M17.6 -76 C19 -78.5 22.5 -78.5 24 -76.5 L23.4 -73.5 L17.6 -73.5 Z');
      p.path('M17 -62 L22.5 -62 L22.5 -60 L17 -60 Z');
      p.path('M16.5 -48 L21.5 -48 L21.5 -46 L16.5 -46 Z');
      p.path('M-6 -12 L16 -12 L16 -10.4 L-6 -10.4 Z');
      p.id();
    }, 0.4);
    const parts = [
      // head and face in profile, chin tipped down to read
      'M4 -82 C8 -85 9 -91 7 -95 C5 -99 0 -101 -4 -100 C-8 -99 -10 -96 -10 -93 C-10 -92 -11 -91 -11.5 -90 L-13.6 -87.4 L-11 -86.9 C-10.8 -86.2 -10.2 -86 -10.4 -85 C-10.6 -84 -10.2 -83.2 -9.6 -82.6 C-9 -81.6 -7 -81 -5 -81.2 L-4 -78 L3 -78 Z',
      // torso under the shawl, the rounded back of an old woman
      'M-5 -80 C-8 -78 -11 -74 -12 -68 C-12.5 -63 -11 -58 -9 -54 L-6 -46 L12 -44 C14 -50 15 -58 15 -64 C15 -72 11 -80 4 -82 Z',
      // the shawl's point over her back
      'M6 -80 C12 -76 16 -66 16 -56 L14 -50 C10 -55 6 -60 0 -64 Z',
      // arm: down from the shoulder, forearm reaching to the book
      'M-3 -74 C-7 -68 -8 -62 -7 -57 C-10 -58 -16 -61 -20.5 -63.5 L-21.8 -60.4 C-16 -58 -9 -54 -4 -53 C-1 -56 1 -64 2 -72 Z',
      // lap and long skirt
      'M-6 -48 C-10 -46 -14 -44.5 -18 -44 C-22 -43.5 -24 -41 -23.6 -37 C-23.6 -28 -25 -16 -26.6 -6 L-27 -5.4 C-20 -4.8 -12 -5 -6 -6 C-6.5 -14 -7 -24 -6 -33 L12 -35 L13 -44 Z',
      // boots
      'M-24 -6 L-23.8 -2.6 C-26 -2.4 -29 -1.6 -30 0 L-21 0 L-20 -6 Z',
      'M-16 -6 L-15.6 -2.6 C-18 -2.3 -20 -1.4 -21.5 0 L-13 0 L-12 -6 Z',
      // the open book, tilted toward the lamp, and her hand
      'M-21.5 -61.5 L-31.6 -69.6 L-30.3 -71.3 L-22 -64.6 Z',
      'M-21.2 -62 L-23.8 -73.8 L-21.7 -74.2 L-20 -63 Z',
    ];
    for (const d of parts) D.paper((p) => { her(p); p.path(d); p.id(); }, 0.35);
    D.paper((p) => { her(p); p.circle(6.4, -96.6, 4.3); p.circle(-21.2, -62.2, 2.1); p.id(); }, 0.3);
    D.paperLine((p) => { her(p); p.M(2.5, -99.5).L(10.5, -95); p.M(4, -101).L(9.5, -93.5); p.id(); }, 0.6 / g.U, 0);
    // what the knife adds inside the silhouette
    D.cutLine((p) => {
      her(p);
      p.path('M-9.4 -94.2 C-6 -92.4 -1 -92 3.6 -93');       // hairline
      p.path('M-11.8 -66 C-4 -63 6 -58 14.6 -52.5');        // shawl's edge
      p.path('M-20 -40 C-21 -28 -22 -16 -23.4 -7.5');       // skirt folds
      p.path('M-13 -42 C-14 -30 -14 -18 -15 -7.5');
      p.path('M-18.4 -64.2 L-19.6 -60.8');                  // cuff
      p.path('M-0.6 -90.8 C0.6 -89.6 0.6 -87.6 -0.6 -86.6'); // ear
      p.id();
    }, 0.6 / g.U, 0);
    D.cutLine((p) => { her(p); p.circle(-8.4, -89.6, 1.75); p.M(-6.7, -89.9).L(-1.6, -90.4); p.id(); }, 0.75 / g.U, 0);
    D.cutLine((p) => { her(p); p.M(-23, -64.5).L(-29.8, -70); p.M(-21.4, -64.6).L(-22.6, -72.4); p.id(); }, 0.5 / g.U, 0);
    for (let i = 0; i < 9; i++) {
      const t = i / 8, fx = lerp(5.5, 14.4, t), fy = lerp(-58.6, -52.8, t);
      D.paperLine((p) => { her(p); p.M(fx, fy).L(fx + 0.9, fy + 3.2 + (i % 2) * 0.8); p.id(); }, 0.5 / g.U, 0);
    }
    // ---- the picture of the sea, hung on a cord
    const px0 = rx - 0.33, px1 = rx - 0.16, py0 = ry - 0.5, py1 = ry - 0.4;
    D.paperLine((p) => p.M(px0 + 0.02, py0).L((px0 + px1) / 2, py0 - 0.06).L(px1 - 0.02, py0).M((px0 + px1) / 2, py0 - 0.06).L((px0 + px1) / 2, ry - 0.9), 1.1 / g.U, 0);
    D.paper((p) => p.pts([[px0, py0], [px1, py0], [px1, py1], [px0, py1]]), 0.4);
    const fi = 0.011;
    D.cut((p) => p.pts([[px0 + fi, py0 + fi], [px1 - fi, py0 + fi], [px1 - fi, py1 - fi], [px0 + fi, py1 - fi]]), 0.2);
    D.paper((p) => {
      const a = [];
      for (let i = 0; i <= 24; i++) { const t = i / 24, x = lerp(px0 + fi, px1 - fi, t); a.push([x, py1 - fi - 0.03 + 0.006 * Math.sin(t * 18)]); }
      a.push([px1 - fi, py1 - fi + 0.001], [px0 + fi, py1 - fi + 0.001]);
      p.pts(a);
      // a tiny whale's tail rising from the painted sea
      const tx = lerp(px0, px1, 0.6), ty = py1 - fi - 0.03;
      p.at(tx, ty, 0.0004);
      p.path('M-4 4 C-4 -10 -2 -20 0 -28 C-10 -34 -24 -36 -34 -46 C-20 -44 -8 -42 0 -34 C8 -42 20 -44 34 -46 C24 -36 10 -34 0 -28 C2 -20 4 -10 4 4 Z');
      p.id();
    }, 0.3);
    D.cut((p) => p.circle(lerp(px0, px1, 0.25), py0 + fi + 0.022, 0.009), 0);
  };

  // 8 · the back wall: thin gold paper; the flame, and the inside of the whale pricked in dots
  LAYERS[8] = function (D, g, R) {
    const hw = g.hw, hh = g.hh;
    D.paper((p) => p.pts([[-hw - 1, -hh - 1], [hw + 1, -hh - 1], [hw + 1, hh + 1], [-hw - 1, hh + 1]]));
    const L = g.lamp;
    D.cut((p) => { p.at(L[0], L[1] + 0.008, 0.001); p.path('M0 -22 C3 -14 7 -6 6 1 C5 6 3 8 0 8 C-3 8 -5 6 -6 1 C-7 -6 -3 -14 0 -22 Z'); p.id(); }, 0);
    // pricked ribs on the far wall
    for (let i = 0; i < 3; i++) {
      const w = 0.4 + i * 0.09, top = -0.48 - i * 0.04;
      const side = archSide(w, top, g.room.y, 0.1, 80);
      for (const sd of [-1, 1]) {
        for (let j = 0; j < side.length - 2; j++) {
          const q = side[j];
          if (j % 2 || R() < 0.2) continue;
          D.cut((p) => p.circle(g.room.x + sd * q[0], q[1], (0.5 + R() * 0.3) / g.U), 0);
        }
      }
    }
  };

  /* =====================================================================
   * Fibre texture: kozo-like strands (R), cloudy formation (G), grain (B).
   * ===================================================================== */
  function makeFibre(rnd) {
    const N = 512;
    const c = document.createElement('canvas'); c.width = c.height = N;
    const g = c.getContext('2d', { willReadFrequently: true });
    g.fillStyle = '#808080'; g.fillRect(0, 0, N, N);
    g.lineCap = 'round';
    for (let i = 0; i < 2400; i++) {
      const x = rnd() * N, y = rnd() * N, a = rnd() * TAU, len = 6 + rnd() * rnd() * 90, bend = (rnd() - 0.5) * 1.2;
      const lt = rnd() < 0.55;
      g.strokeStyle = lt ? 'rgba(255,255,255,' + (0.05 + rnd() * 0.14) + ')' : 'rgba(0,0,0,' + (0.04 + rnd() * 0.12) + ')';
      g.lineWidth = 0.5 + rnd() * rnd() * 2;
      const ex = Math.cos(a) * len, ey = Math.sin(a) * len;
      for (let ox = -N; ox <= N; ox += N) for (let oy = -N; oy <= N; oy += N) {
        const X = x + ox, Y = y + oy;
        if (X + Math.abs(ex) + 4 < 0 || X - Math.abs(ex) - 4 > N || Y + Math.abs(ey) + 4 < 0 || Y - Math.abs(ey) - 4 > N) continue;
        g.beginPath(); g.moveTo(X, Y);
        g.quadraticCurveTo(X + ex * 0.5 - ey * bend * 0.3, Y + ey * 0.5 + ex * bend * 0.3, X + ex, Y + ey);
        g.stroke();
      }
    }
    const fib = g.getImageData(0, 0, N, N).data;
    // periodic value noise
    const vn = (cells) => {
      const v = new Float32Array(cells * cells);
      for (let i = 0; i < v.length; i++) v[i] = rnd();
      return (x, y) => {
        const fx = (x / N) * cells, fy = (y / N) * cells;
        const ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy;
        const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
        const a = v[(iy % cells) * cells + (ix % cells)], b = v[(iy % cells) * cells + ((ix + 1) % cells)];
        const cc = v[((iy + 1) % cells) * cells + (ix % cells)], d = v[((iy + 1) % cells) * cells + ((ix + 1) % cells)];
        return lerp(lerp(a, b, sx), lerp(cc, d, sx), sy);
      };
    };
    const o1 = vn(4), o2 = vn(8), o3 = vn(16), o4 = vn(32), o5 = vn(64), g1 = vn(128);
    const out = new Uint8Array(N * N * 4);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const i = (y * N + x) * 4;
      const cloud = (o1(x, y) * 0.3 + o2(x, y) * 0.28 + o3(x, y) * 0.22 + o4(x, y) * 0.13 + o5(x, y) * 0.07);
      const grain = g1(x, y) * 0.5 + rnd() * 0.5;
      out[i] = fib[i];
      out[i + 1] = clamp(Math.round((cloud - 0.5) * 1.8 * 255 + 128), 0, 255);
      out[i + 2] = Math.round(grain * 255);
      out[i + 3] = Math.round(o1(x, y) * 0.6 * 255 + o2(x, y) * 0.4 * 255);
    }
    return { N, data: out };
  }

  /* =====================================================================
   * GL
   * ===================================================================== */
  const VS = '#version 300 es\nin vec2 aP; void main(){ gl_Position = vec4(aP, 0.0, 1.0); }';
  // light pass: per sheet, at shadow resolution, how much moonlight reaches its face (R)
  // and how much lamp light reaches it from behind (G, sqrt-encoded). Fixed to the box.
  const FS_LIGHT = `#version 300 es
precision highp float;
precision highp sampler2DArray;
uniform sampler2DArray uBlur;
uniform vec2 uLay, uBS, uBDim, uLamp, uMoon;
uniform float uM, uU, uZL;
uniform float uZ[9];
uniform float uTr[9];
uniform int uK;
out vec4 outColor;
float lampField(vec2 X){
  vec2 d = (X - uLamp) / uU;
  float r2 = dot(d, d);
  return 2.0*exp(-r2*10.0) + 0.6*exp(-r2*3.0) + 0.3*exp(-r2*0.4) + 0.05;
}
void main(){
  vec2 bu = gl_FragCoord.xy / uBDim;
  bu.y = 1.0 - bu.y;
  vec2 X = bu / uBS * uLay - uM;
  float zk = uZ[uK];
  float S = 1.0;
  for (int j = 0; j < 9; j++) {
    if (j >= uK) break;
    float gap = zk - uZ[j];
    vec2 q = X - uMoon * gap;
    vec2 b2 = (q + uM) / uLay * uBS;
    float lod = log2(1.0 + gap * 0.9);
    vec2 bb = textureLod(uBlur, vec3(b2, float(j)), lod).rg;
    S *= 1.0 - 0.86 * mix(bb.r, bb.g, clamp(gap * 0.6, 0.0, 1.0));
  }
  float Wl = lampField(X);
  for (int j = 1; j < 9; j++) {
    if (j <= uK) continue;
    float gap = uZ[j] - zk;
    float ratio = (uZL - uZ[j]) / (uZL - zk);
    vec2 q = uLamp + (X - uLamp) * ratio;
    vec2 b2 = (q + uM) / uLay * uBS;
    float lod = log2(1.0 + gap * 0.7);
    vec2 bb = textureLod(uBlur, vec3(b2, float(j)), lod).rg;
    Wl *= 1.0 - (1.0 - uTr[j]) * mix(bb.r, bb.g, clamp(gap * 0.5, 0.0, 1.0));
  }
  outColor = vec4(S, sqrt(Wl * 0.25), 0.0, 1.0);
}`;

  const FS = `#version 300 es
precision highp float;
precision highp sampler2DArray;
uniform sampler2DArray uMask;
uniform sampler2DArray uLight;
uniform sampler2D uFib;
uniform vec2 uView, uBView, uLay, uBS, uTexel, uLamp, uLampSh, uCam;
uniform float uRes, uDpr, uM, uU, uLampI, uT, uMoonI;
uniform vec2 uShift[9];
uniform float uTr[9];
uniform float uBo[9];
uniform float uFv[9];
uniform vec3 uPaper[9];
uniform vec3 uTint[9];
uniform vec3 uTis[9];
uniform vec3 uCore[9];
out vec4 outColor;
float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
float lampField(vec2 X){
  vec2 d = (X - uLamp) / uU;
  float r2 = dot(d, d);
  return uLampI * (2.0*exp(-r2*10.0) + 0.6*exp(-r2*3.0) + 0.3*exp(-r2*0.4)) + 0.035;
}
void main(){
  vec2 p = vec2(gl_FragCoord.x, uView.y*uDpr - gl_FragCoord.y) / uDpr;
  p += (uBView - uView) * 0.5;
  vec3 col = vec3(0.0);
  vec3 T = vec3(1.0);
  const vec3 warm = vec3(1.0, 0.60, 0.26);
  const vec3 moonC = vec3(0.45, 0.58, 1.0);
  vec2 dv = length(uCam) > 0.03 ? normalize(uCam) : vec2(0.6, 0.8);
  float coreAmt = 0.15 + 0.85*clamp(length(uCam)*1.4, 0.0, 1.0);
  for (int k = 0; k < 9; k++) {
    vec2 X = p - uShift[k];
    vec2 uv = (X + uM) / uLay;
    float fk = float(k);
    vec2 m = texture(uMask, vec3(uv, fk)).rg;
    float a = m.r;
    if (a > 0.003) {
      vec2 lm = texture(uLight, vec3(uv * uBS, fk)).rg;
      float S = lm.r;
      float Wl = lm.g * lm.g * 4.0 * uLampI;
      vec4 F = texture(uFib, uv * uLay / 460.0 + vec2(fk * 0.37, fk * 0.61));
      vec4 F2 = texture(uFib, uv * uLay / 2400.0 + vec2(fk * 0.13, fk * 0.29));
      float fib = F.r - 0.5, cloud = F.g, grain = F.b - 0.5, warp = F2.a - 0.5;
      vec3 paper = uPaper[k];
      float surf = 1.0 + 0.16*grain + 0.10*fib + 0.30*warp;
      vec3 moon = moonC * uMoonI * (0.07 + 0.93 * S);
      vec3 front = paper * (moon + warm * Wl * uBo[k]) * surf;
      float thick = mix(1.0, 0.45 + 1.1 * cloud, uFv[k]) * (1.0 + uFv[k] * 1.4 * fib);
      vec3 trans = uTint[k] * warm * Wl * uTr[k] * max(thick, 0.0);
      float aV = texture(uMask, vec3(uv + dv * uTexel * 1.6 * uRes, fk)).r;
      float core = clamp(a - aV, 0.0, 1.0) * coreAmt;
      vec2 dl = uLamp - X; dl = dl / (length(dl) + 1e-3);
      float aL = texture(uMask, vec3(uv + dl * uTexel * 2.0 * uRes, fk)).r;
      float rim = clamp(a - aL, 0.0, 1.0);
      vec3 c = front + trans
             + uCore[k] * (moon * 0.45 + warm * Wl * (0.06 + 0.35 * uBo[k])) * core
             + warm * Wl * rim * (0.25 + 1.2 * uTr[k]);
      col += T * a * c;
      T *= 1.0 - a;
    }
    float ti = m.g * (1.0 - a);
    if (ti > 0.003) T *= mix(vec3(1.0), uTis[k], ti);
    if (max(T.r, max(T.g, T.b)) < 0.002) break;
  }
  col += T * vec3(1.0, 0.80, 0.52) * lampField(p - uLampSh) * 2.4;
  col = vec3(1.0) - exp(-col * 1.15);
  col = pow(col, vec3(1.0/2.2));
  col += (hash(gl_FragCoord.xy + uT) - 0.5) / 255.0;
  outColor = vec4(col, 1.0);
}`;

  function compile(gl, type, src) {
    const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  }

  // sRGB paper colours, front to back
  const PAPER = ['#0b142e', '#162a52', '#0f1a3c', '#1b4466', '#1d5a68', '#2c6e66', '#6d6a3c', '#a6742e', '#ebb866'];
  const TRANS = [0.02, 0.025, 0.04, 0.07, 0.09, 0.12, 0.16, 0.18, 0.62];
  const BOUNCE = [0.0, 0.03, 0.02, 0.16, 0.22, 0.3, 0.38, 0.42, 0.3];
  const FIBV = [0.25, 0.25, 0.25, 0.35, 0.4, 0.45, 0.55, 0.65, 1.0];
  const TISSUE = [null, null, null, null, '#ffb040', null, null, '#ff9a30', null];

  (window.PIECES = window.PIECES || []).push({
    id: 'whale',
    title: 'Inside the Whale, a Lamp Is Lit',
    medium: 'Cut-paper tunnel book, nine layers, lit from behind',
    note: 'Move to look between the layers.',
    about: 'Nine sheets of hand-cut paper stand one behind another: the night sea, the open mouth of a whale with its fringe of baleen, rib after rib, a wreck, a stair of driftwood, and at the very back a small room where someone reads by an oil lamp. Every sheet is cut anew in code; the light comes from behind and finds its way forward through the holes.',
    tone: 'dark',
    room: '#070a14',
    mount(el, api) {
      el.style.background = '#070a14';
      const canvas = document.createElement('canvas');
      canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none';
      el.appendChild(canvas);
      const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, depth: false, stencil: false, premultipliedAlpha: false, powerPreference: 'high-performance' });
      if (!gl) {
        el.textContent = 'This work needs WebGL2.';
        el.style.cssText += ';color:#ccc;display:flex;align-items:center;justify-content:center;font-style:italic';
        api.ready();
        return { destroy() {} };
      }
      let dead = false, raf = 0;
      const alive = () => !dead && api.isCurrent();

      // programs
      const mkProg = (fs) => {
        const pr = gl.createProgram();
        gl.attachShader(pr, compile(gl, gl.VERTEX_SHADER, VS));
        gl.attachShader(pr, compile(gl, gl.FRAGMENT_SHADER, fs));
        gl.bindAttribLocation(pr, 0, 'aP');
        gl.linkProgram(pr);
        if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(pr));
        const u = {};
        const n = gl.getProgramParameter(pr, gl.ACTIVE_UNIFORMS);
        for (let i = 0; i < n; i++) { const info = gl.getActiveUniform(pr, i); u[info.name.replace(/\[0\]$/, '')] = gl.getUniformLocation(pr, info.name); }
        return { pr, u };
      };
      const P1 = mkProg(FS), PL = mkProg(FS_LIGHT);
      const U = P1.u, UL = PL.u;
      const vb = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, vb);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

      const toArr = (list) => new Float32Array(list.flat());
      const paperLin = PAPER.map(lin);
      gl.useProgram(P1.pr);
      gl.uniform1i(U.uMask, 0); gl.uniform1i(U.uLight, 3); gl.uniform1i(U.uFib, 2);
      gl.uniform3fv(U.uPaper, toArr(paperLin));
      gl.uniform3fv(U.uTint, toArr(paperLin.map((c) => c.map((v) => Math.pow(v, 0.55) * 1.1))));
      gl.uniform3fv(U.uCore, toArr(paperLin.map((c) => c.map((v, i) => lerp(v, [0.82, 0.76, 0.62][i], 0.55)))));
      gl.uniform3fv(U.uTis, toArr(TISSUE.map((t) => (t ? lin(t) : [1, 1, 1]))));
      gl.uniform1fv(U.uTr, new Float32Array(TRANS));
      gl.uniform1fv(U.uBo, new Float32Array(BOUNCE));
      gl.uniform1fv(U.uFv, new Float32Array(FIBV));
      gl.useProgram(PL.pr);
      gl.uniform1i(UL.uBlur, 1);
      gl.uniform1fv(UL.uTr, new Float32Array(TRANS));

      // fibre texture
      const fibre = makeFibre(mulberry32(api.seed ^ 0x51f15e));
      const tFib = gl.createTexture();
      gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, tFib);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, fibre.N, fibre.N, 0, gl.RGBA, gl.UNSIGNED_BYTE, fibre.data);
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);

      let B = null; // current build
      let W = 0, H = 0, dpr = 1;
      const texArr = (unit, w, h, levels, fmt, minF) => {
        const t = gl.createTexture();
        gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D_ARRAY, t);
        gl.texStorage3D(gl.TEXTURE_2D_ARRAY, levels, fmt, w, h, NL);
        gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, minF);
        gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        return t;
      };

      async function build(w, h, token) {
        const g = geometry(w, h);
        const M = Math.ceil(g.U * 0.11 + 10);
        const LW = w + 2 * M, LH = h + 2 * M;
        const maxPix = 4.4e6;
        let res = Math.min(2, window.devicePixelRatio || 1);
        res = Math.min(res, Math.sqrt(maxPix / (LW * LH)));
        const max = gl.getParameter(gl.MAX_TEXTURE_SIZE);
        res = Math.min(res, (max - 2) / Math.max(LW, LH));
        const TW = Math.round(LW * res), TH = Math.round(LH * res);
        res = TW / LW;
        const BD = Math.max(1, Math.round(3 * res));
        const bw = Math.ceil(TW / BD), bh = Math.ceil(TH / BD);
        const cv = document.createElement('canvas'); cv.width = TW; cv.height = TH;
        const ctx = cv.getContext('2d', { willReadFrequently: true, alpha: false });
        const G = { U: g.U, s: g.U * res, ox: (w / 2 + M) * res, oy: (h / 2 + M) * res, res, jit: 0.55 * res };
        const maskData = new Uint8Array(TW * TH * 2);
        const noise = makeNoise(mulberry32(api.seed ^ 0xabc123));
        const levels = Math.floor(Math.log2(Math.max(bw, bh))) + 1;
        const tM = texArr(0, TW, TH, 1, gl.RG8, gl.LINEAR);
        const tB = texArr(1, bw, bh, levels, gl.RG8, gl.LINEAR_MIPMAP_LINEAR);
        const tL = texArr(3, bw, bh, 1, gl.RGBA8, gl.LINEAR);
        const drop = () => { gl.deleteTexture(tM); gl.deleteTexture(tB); gl.deleteTexture(tL); return null; };
        gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);

        for (let k = 0; k < NL; k++) {
          await new Promise(requestAnimationFrame);
          if (!alive() || token !== buildToken) return drop();
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          ctx.globalCompositeOperation = 'source-over';
          ctx.fillStyle = '#000'; ctx.fillRect(0, 0, TW, TH);
          const R = mulberry32((api.seed ^ Math.imul(k + 1, 0x9E3779B1)) >>> 0);
          const D = Painter(ctx, G, noise, R);
          LAYERS[k](D, g, R);
          const img = ctx.getImageData(0, 0, TW, TH).data;
          const pap = new Uint8Array(TW * TH);
          for (let i = 0, j = 0; i < pap.length; i++, j += 4) { pap[i] = img[j]; maskData[i * 2] = img[j]; maskData[i * 2 + 1] = img[j + 1]; }
          gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D_ARRAY, tM);
          gl.texSubImage3D(gl.TEXTURE_2D_ARRAY, 0, 0, 0, k, TW, TH, 1, gl.RG, gl.UNSIGNED_BYTE, maskData);
          // downsample + blur for shadows
          const small = new Float32Array(bw * bh);
          for (let by = 0; by < bh; by++) {
            const y0 = by * BD, y1 = Math.min(TH, y0 + BD);
            for (let bx = 0; bx < bw; bx++) {
              const x0 = bx * BD, x1 = Math.min(TW, x0 + BD);
              let s = 0, c = 0;
              for (let y = y0; y < y1; y++) { const row = y * TW; for (let x = x0; x < x1; x++) { s += pap[row + x]; c++; } }
              small[by * bw + bx] = c ? s / c : 0;
            }
          }
          const b1 = boxBlur3(small, bw, bh, 1), b2 = boxBlur3(small, bw, bh, 4);
          const bd = new Uint8Array(bw * bh * 2);
          for (let i = 0; i < bw * bh; i++) { bd[i * 2] = b1[i]; bd[i * 2 + 1] = b2[i]; }
          gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D_ARRAY, tB);
          gl.texSubImage3D(gl.TEXTURE_2D_ARRAY, 0, 0, 0, k, bw, bh, 1, gl.RG, gl.UNSIGNED_BYTE, bd);
        }
        gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D_ARRAY, tB);
        gl.generateMipmap(gl.TEXTURE_2D_ARRAY);
        // light maps, one sheet at a time
        const fb = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
        gl.useProgram(PL.pr);
        gl.uniform2f(UL.uLay, LW, LH);
        gl.uniform2f(UL.uBS, TW / (bw * BD), TH / (bh * BD));
        gl.uniform2f(UL.uBDim, bw, bh);
        gl.uniform2f(UL.uLamp, g.lamp[0] * g.U + w / 2, g.lamp[1] * g.U + h / 2);
        gl.uniform2f(UL.uMoon, g.U * 0.016, g.U * 0.022);
        gl.uniform1f(UL.uM, M); gl.uniform1f(UL.uU, g.U); gl.uniform1f(UL.uZL, g.zL);
        gl.uniform1fv(UL.uZ, new Float32Array(g.z));
        gl.viewport(0, 0, bw, bh);
        for (let k = 0; k < NL; k++) {
          gl.framebufferTextureLayer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, tL, 0, k);
          gl.uniform1i(UL.uK, k);
          gl.drawArrays(gl.TRIANGLES, 0, 3);
        }
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.deleteFramebuffer(fb);
        gl.viewport(0, 0, canvas.width, canvas.height);
        return { g, M, LW, LH, TW, TH, res, BD, bw, bh, w, h, tM, tB, tL };
      }

      function boxBlur3(src, w, h, r) {
        const a = Float32Array.from(src), b = new Float32Array(w * h);
        for (let pass = 0; pass < 3; pass++) {
          for (let y = 0; y < h; y++) {
            const row = y * w; let s = 0;
            for (let x = -r; x <= r; x++) s += a[row + clamp(x, 0, w - 1)];
            for (let x = 0; x < w; x++) {
              b[row + x] = s / (2 * r + 1);
              s += a[row + Math.min(w - 1, x + r + 1)] - a[row + Math.max(0, x - r)];
            }
          }
          for (let x = 0; x < w; x++) {
            let s = 0;
            for (let y = -r; y <= r; y++) s += b[clamp(y, 0, h - 1) * w + x];
            for (let y = 0; y < h; y++) {
              a[y * w + x] = s / (2 * r + 1);
              s += b[Math.min(h - 1, y + r + 1) * w + x] - b[Math.max(0, y - r) * w + x];
            }
          }
        }
        const out = new Uint8Array(w * h);
        for (let i = 0; i < w * h; i++) out[i] = clamp(Math.round(a[i]), 0, 255);
        return out;
      }

      // ---- interaction
      const cam = { x: 0, y: 0, tx: 0, ty: 0, last: -1e9 };
      const onMove = (e) => {
        const r = el.getBoundingClientRect();
        cam.tx = clamp(((e.clientX - r.left) / Math.max(1, r.width)) * 2 - 1, -1, 1);
        cam.ty = clamp(((e.clientY - r.top) / Math.max(1, r.height)) * 2 - 1, -1, 1);
        cam.last = performance.now();
      };
      window.addEventListener('pointermove', onMove, { passive: true });
      window.addEventListener('pointerdown', onMove, { passive: true });

      const fl = makeNoise(mulberry32(api.seed ^ 0x77));
      let buildToken = 0, pending = 0;

      function resize() {
        W = Math.max(1, el.clientWidth); H = Math.max(1, el.clientHeight);
        dpr = Math.min(2, window.devicePixelRatio || 1);
        const px = W * H * dpr * dpr;
        const rdpr = px > 4.2e6 ? dpr * Math.sqrt(4.2e6 / px) : dpr;
        canvas.width = Math.round(W * rdpr); canvas.height = Math.round(H * rdpr);
        gl.viewport(0, 0, canvas.width, canvas.height);
      }

      async function rebuild() {
        const tok = ++buildToken;
        const b = await build(W, H, tok);
        if (!b) return false;
        if (B) { gl.deleteTexture(B.tM); gl.deleteTexture(B.tB); gl.deleteTexture(B.tL); }
        B = b;
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D_ARRAY, B.tM);
        gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D_ARRAY, B.tL);
        gl.useProgram(P1.pr);
        gl.uniform2f(U.uBView, B.w, B.h);
        gl.uniform2f(U.uLay, B.LW, B.LH);
        gl.uniform2f(U.uBS, B.TW / (B.bw * B.BD), B.TH / (B.bh * B.BD));
        gl.uniform2f(U.uTexel, 1 / B.TW, 1 / B.TH);
        gl.uniform1f(U.uRes, B.res);
        gl.uniform1f(U.uM, B.M);
        gl.uniform1f(U.uU, B.g.U);
        gl.uniform2f(U.uLamp, B.g.lamp[0] * B.g.U + B.w / 2, B.g.lamp[1] * B.g.U + B.h / 2);
        rc.x = 9; lastRender = -1e9;
        return true;
      }

      let t0 = performance.now(), last = t0;
      // A very slow GPU (software rendering) gets frames only when the view changes,
      // with breathing room in between, instead of one per vsync.
      let cost = 16, renderedAt = -1, lastRender = -1e9;
      const rc = { x: 9, y: 9 };
      function frame(now) {
        if (!alive()) return;
        raf = requestAnimationFrame(frame);
        if (!B) return;
        if (renderedAt >= 0) { cost = cost * 0.6 + (now - renderedAt) * 0.4; renderedAt = -1; }
        const slow = cost > 140;
        const dt = Math.min(0.1, (now - last) / 1000); last = now;
        const t = (now - t0) / 1000;
        // idle drift when the pointer has been still
        const idle = clamp((now - cam.last - 4000) / 3000, 0, 1) * (slow ? 0 : 1);
        const ix = 0.32 * Math.sin(t * 0.19) + 0.08 * Math.sin(t * 0.53), iy = 0.16 * Math.sin(t * 0.23 + 1.3);
        const gx = lerp(cam.tx, ix, idle), gy = lerp(cam.ty, iy, idle);
        const k = 1 - Math.exp(-dt * 3.2);
        cam.x += (gx - cam.x) * k; cam.y += (gy - cam.y) * k;
        if (slow) {
          if (now - lastRender < cost * 2 + 400) return;
          if (Math.hypot(cam.x - rc.x, cam.y - rc.y) < 0.004) return;
        }
        rc.x = cam.x; rc.y = cam.y;
        gl.useProgram(P1.pr);
        const g = B.g, P = g.U * 0.024, piv = 2.3;
        const sh = new Float32Array(18);
        for (let i = 0; i < NL; i++) { sh[i * 2] = cam.x * P * (g.z[i] - piv); sh[i * 2 + 1] = cam.y * P * 0.6 * (g.z[i] - piv); }
        gl.uniform2fv(U.uShift, sh);
        gl.uniform2f(U.uLampSh, cam.x * P * (g.zL - piv), cam.y * P * 0.6 * (g.zL - piv));
        gl.uniform2f(U.uCam, cam.x, cam.y);
        const f = slow ? 1 : 1 + 0.05 * fl(t * 2.1) + 0.03 * fl(t * 7.3 + 40) + 0.025 * Math.sin(t * 13.0) * Math.max(0, fl(t * 0.7 + 9));
        gl.uniform1f(U.uLampI, 1.0 * f);
        gl.uniform1f(U.uMoonI, 0.5);
        gl.uniform1f(U.uT, t % 100);
        gl.uniform2f(U.uView, W, H);
        gl.uniform1f(U.uDpr, canvas.width / W);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        renderedAt = now; lastRender = now;
      }

      resize();
      const ro = new ResizeObserver(() => {
        const w = el.clientWidth, h = el.clientHeight;
        if (Math.abs(w - W) < 2 && Math.abs(h - H) < 2) return;
        resize();
        clearTimeout(pending);
        pending = setTimeout(() => { if (alive()) rebuild(); }, 350);
      });
      ro.observe(el);

      rebuild().then((ok) => {
        if (!ok || !alive()) return;
        last = performance.now();
        frame(last);
        requestAnimationFrame(() => api.ready());
      }).catch((e) => { console.error(e); api.ready(); });

      return {
        destroy() {
          dead = true;
          cancelAnimationFrame(raf);
          clearTimeout(pending);
          ro.disconnect();
          window.removeEventListener('pointermove', onMove);
          window.removeEventListener('pointerdown', onMove);
          const ext = gl.getExtension('WEBGL_lose_context');
          if (ext) ext.loseContext();
        },
      };
    },
  });
})();
