/* Fable 5.2: A Field Guide. Core: maths, easing, seeded hashes, matrices, colours, and the flat-shaded mesh builder.
   Everything is a pure function of its inputs: no Math.random, no Date. Loaded as a plain script (window.FG) or with
   require() in node (only the pure parts are used there). */
(function (root) {
  'use strict';
  var FG = root.FG = root.FG || {};
  var PI = Math.PI, TAU = PI * 2;

  /* ------------------------------------------------------------------ scalar maths and easing */
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function sat(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
  function lerp(a, b, u) { return a + (b - a) * u; }
  function ss(a, b, x) { var u = sat((x - a) / (b - a)); return u * u * (3 - 2 * u); }
  function sst(a, b, x) { var u = sat((x - a) / (b - a)); return u * u * u * (u * (u * 6 - 15) + 10); }
  function lin(a, b, x) { return sat((x - a) / (b - a)); }
  function eo(u) { u = sat(u); return 1 - (1 - u) * (1 - u) * (1 - u); }          // ease-out cubic
  function ei(u) { u = sat(u); return u * u * u; }
  function eio(u) { u = sat(u); return u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2; }
  function eo2(u) { u = sat(u); return 1 - (1 - u) * (1 - u); }
  function back(u, c) { c = c == null ? 1.70158 : c; u = sat(u) - 1; return 1 + (c + 1) * u * u * u + c * u * u; }
  // damped spring step response: 0 -> 1 with overshoot; t in seconds since start
  function spring(t, f, z) {
    if (t <= 0) return 0;
    f = f || 3; z = z == null ? 0.35 : z;
    var w = TAU * f, wd = w * Math.sqrt(1 - z * z);
    return 1 - Math.exp(-z * w * t) * (Math.cos(wd * t) + (z * w / wd) * Math.sin(wd * t));
  }
  // damped wobble impulse: 0 at t=0, oscillates and decays (for jiggles); amplitude ~1
  function wob(t, f, d) { if (t <= 0) return 0; return Math.sin(TAU * (f || 4) * t) * Math.exp(-(d || 5) * t); }
  function pulse(a, b, c, d, x) { return ss(a, b, x) * (1 - ss(c, d, x)); }
  function frac(x) { return x - Math.floor(x); }
  function hash(a, b) {
    var h = Math.imul(a | 0, 374761393) ^ Math.imul((b | 0) + 0x9e37, 668265263);
    h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; h = Math.imul(h, 2246822519); h ^= h >>> 13;
    return (h >>> 0) / 4294967296;
  }
  function mulberry(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function vn1(x, s) { var i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return lerp(hash(i, s), hash(i + 1, s), u); }
  function vn2(x, y, s) {
    var ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy, ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
    var h00 = hash(ix * 7919 + iy * 104729, s), h10 = hash((ix + 1) * 7919 + iy * 104729, s);
    var h01 = hash(ix * 7919 + (iy + 1) * 104729, s), h11 = hash((ix + 1) * 7919 + (iy + 1) * 104729, s);
    return lerp(lerp(h00, h10, ux), lerp(h01, h11, ux), uy);
  }
  // keyframes [[t, v], ...] with smoothstep easing between keys
  function keys(K, t) {
    if (t <= K[0][0]) return K[0][1];
    for (var i = 1; i < K.length; i++) if (t < K[i][0]) return lerp(K[i - 1][1], K[i][1], ss(K[i - 1][0], K[i][0], t));
    return K[K.length - 1][1];
  }
  // vector keyframes [[t, [x,y,z]], ...] with Catmull-Rom (uniform) through the values, eased time inside each span
  function vkeys(K, t, easeEnds) {
    var n = K.length;
    if (t <= K[0][0]) return K[0][1].slice();
    if (t >= K[n - 1][0]) return K[n - 1][1].slice();
    var i = 1; while (i < n && t >= K[i][0]) i++;
    var a = K[i - 1], b = K[i], u = (t - a[0]) / (b[0] - a[0]);
    var p0 = (K[i - 2] || a)[1], p1 = a[1], p2 = b[1], p3 = (K[i + 1] || b)[1];
    // time-scaled tangents (so a key spacing change does not jolt the speed)
    var d01 = i - 2 >= 0 ? a[0] - K[i - 2][0] : b[0] - a[0], d12 = b[0] - a[0], d23 = K[i + 1] ? K[i + 1][0] - b[0] : d12;
    var o = [];
    for (var k = 0; k < p1.length; k++) {
      var m1 = (p2[k] - p0[k]) / (d01 + d12) * d12, m2 = (p3[k] - p1[k]) / (d12 + d23) * d12;
      if (i - 2 < 0 && easeEnds) m1 = 0;
      if (!K[i + 1] && easeEnds) m2 = 0;
      var u2 = u * u, u3 = u2 * u;
      o.push((2 * u3 - 3 * u2 + 1) * p1[k] + (u3 - 2 * u2 + u) * m1 + (-2 * u3 + 3 * u2) * p2[k] + (u3 - u2) * m2);
    }
    return o;
  }

  /* ------------------------------------------------------------------ vectors and matrices (column-major) */
  function v3(x, y, z) { return [x, y, z]; }
  function vAdd(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
  function vSub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
  function vMul(a, s) { return [a[0] * s, a[1] * s, a[2] * s]; }
  function vMad(a, b, s) { return [a[0] + b[0] * s, a[1] + b[1] * s, a[2] + b[2] * s]; }
  function vLerp(a, b, u) { return [lerp(a[0], b[0], u), lerp(a[1], b[1], u), lerp(a[2], b[2], u)]; }
  function vDot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  function vCross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
  function vLen(a) { return Math.sqrt(vDot(a, a)); }
  function vNorm(a) { var l = vLen(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }
  function vDist(a, b) { return vLen(vSub(a, b)); }
  function mIdent() { return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]; }
  function mMul(a, b) {
    var o = new Array(16);
    for (var c = 0; c < 4; c++) for (var r = 0; r < 4; r++) {
      o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
    }
    return o;
  }
  function mTrans(x, y, z) { var m = mIdent(); if (x && x.length) { z = x[2]; y = x[1]; x = x[0]; } m[12] = x; m[13] = y; m[14] = z; return m; }
  function mScale(x, y, z) { var m = mIdent(); if (y === undefined) { y = x; z = x; } m[0] = x; m[5] = y; m[10] = z; return m; }
  function mRotX(a) { var c = Math.cos(a), s = Math.sin(a), m = mIdent(); m[5] = c; m[6] = s; m[9] = -s; m[10] = c; return m; }
  function mRotY(a) { var c = Math.cos(a), s = Math.sin(a), m = mIdent(); m[0] = c; m[2] = -s; m[8] = s; m[10] = c; return m; }
  function mRotZ(a) { var c = Math.cos(a), s = Math.sin(a), m = mIdent(); m[0] = c; m[1] = s; m[4] = -s; m[5] = c; return m; }
  function mPersp(fovy, asp, n, f) {
    var t = 1 / Math.tan(fovy / 2);
    return [t / asp, 0, 0, 0, 0, t, 0, 0, 0, 0, (f + n) / (n - f), -1, 0, 0, 2 * f * n / (n - f), 0];
  }
  function mOrtho(l, r, b, t, n, f) {
    return [2 / (r - l), 0, 0, 0, 0, 2 / (t - b), 0, 0, 0, 0, -2 / (f - n), 0,
      -(r + l) / (r - l), -(t + b) / (t - b), -(f + n) / (f - n), 1];
  }
  function mLook(eye, at, up) {
    var f = vNorm(vSub(at, eye)), s = vNorm(vCross(f, up)), u = vCross(s, f);
    return [s[0], u[0], -f[0], 0, s[1], u[1], -f[1], 0, s[2], u[2], -f[2], 0,
      -vDot(s, eye), -vDot(u, eye), vDot(f, eye), 1];
  }
  function mXf(m, p) {
    return [m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12], m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13], m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14]];
  }
  function mXd(m, p) { return [m[0] * p[0] + m[4] * p[1] + m[8] * p[2], m[1] * p[0] + m[5] * p[1] + m[9] * p[2], m[2] * p[0] + m[6] * p[1] + m[10] * p[2]]; }
  // a basis matrix: columns x, y, z axes and origin o
  function mBasis(x, y, z, o) { return [x[0], x[1], x[2], 0, y[0], y[1], y[2], 0, z[0], z[1], z[2], 0, o[0], o[1], o[2], 1]; }

  /* ------------------------------------------------------------------ colour (linear working space) */
  function srgb(hex) {
    var f = function (v) { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return [f((hex >> 16) & 255), f((hex >> 8) & 255), f(hex & 255)];
  }
  function mixc(a, b, u) { return [lerp(a[0], b[0], u), lerp(a[1], b[1], u), lerp(a[2], b[2], u)]; }
  function mulc(a, s) { return [a[0] * s, a[1] * s, a[2] * s]; }
  var C = {
    coral: srgb(0xd97757), shade: srgb(0xa8553b), light: srgb(0xf2a585), dark: srgb(0x6e2a1a),
    ink: srgb(0x120a0c), white: srgb(0xfff8f0), glint: [1.0, 0.97, 0.92],
    cream: srgb(0xf3e3c8), sand: srgb(0xe6cfa6), sand2: srgb(0xd9bc8c), sandD: srgb(0xb8936a), clay: srgb(0xa86f55),
    rock: srgb(0x8f6a68), rockD: srgb(0x5d4258), rockDD: srgb(0x3b2a46),
    sage: srgb(0x9fb98a), sage2: srgb(0x86a978), teal: srgb(0x5fae9e), teal2: srgb(0x4b9a8d), tealD: srgb(0x3a7d74),
    lilac: srgb(0xa99be6), lilac2: srgb(0x8d7fd6), violet: srgb(0x6c5fc4), violetD: srgb(0x4a3f9c), lilacHi: srgb(0xcdc3f5),
    gold: srgb(0xf2c14e), goldD: srgb(0xc98f2a), goldHi: srgb(0xffe08a),
    paper: srgb(0xfbf1df), paperD: srgb(0xe9d8bb), note: srgb(0xf7df7c), noteD: srgb(0xe8c95c), noteL: srgb(0xc9bdf2),
    wood: srgb(0xb07a4f), woodD: srgb(0x7f5235), woodL: srgb(0xcf9a68),
    house: srgb(0xf1e2c6), roof: srgb(0x5fae9e), roofD: srgb(0x468d81), door: srgb(0x7f5235),
    key: srgb(0xf4ecdf), keyS: srgb(0xd8ccbb), keyD: srgb(0xa89b8b),
    crystal: srgb(0xb7a8f0), crystalD: srgb(0x7f6fd0), bubble: srgb(0xcfe8f2)
  };

  /* ------------------------------------------------------------------ mesh builder (flat-shaded, world space)
     vertex: pos3 nor3 col3 mat2 (emissive, flags). flags: 0 object, 1 ground (terrain), 2 unlit (no shadow/ao) */
  var STRIDE = 11;
  function Builder(maxTris) {
    this.a = new Float32Array(maxTris * 3 * STRIDE);
    this.cap = maxTris * 3;
    this.n = 0; this.m = mIdent(); this.st = [];
  }
  Builder.prototype.reset = function () { this.n = 0; this.m = mIdent(); this.st.length = 0; };
  Builder.prototype.push = function (m) { this.st.push(this.m); if (m) this.m = mMul(this.m, m); };
  Builder.prototype.pop = function () { this.m = this.st.pop(); };
  Builder.prototype.mul = function (b) { this.m = mMul(this.m, b); };
  Builder.prototype.xf = function (p) { return mXf(this.m, p); };
  // a convex polygon in local coordinates; ctr (local) tells which side is outside (normal flipped to face away from it)
  Builder.prototype.poly = function (pts, col, emis, flags, ctr) {
    var w = [], i;
    for (i = 0; i < pts.length; i++) w.push(this.xf(pts[i]));
    this.polyW(w, col, emis, flags, ctr ? this.xf(ctr) : null);
  };
  Builder.prototype.polyW = function (w, col, emis, flags, c) {
    var nx = 0, ny = 0, nz = 0, i, k = w.length;
    for (i = 0; i < k; i++) {
      var p = w[i], q = w[(i + 1) % k];
      nx += (p[1] - q[1]) * (p[2] + q[2]); ny += (p[2] - q[2]) * (p[0] + q[0]); nz += (p[0] - q[0]) * (p[1] + q[1]);
    }
    var l = Math.sqrt(nx * nx + ny * ny + nz * nz);
    if (l < 1e-12) return;
    nx /= l; ny /= l; nz /= l;
    if (c && nx * (w[0][0] - c[0]) + ny * (w[0][1] - c[1]) + nz * (w[0][2] - c[2]) < 0) { nx = -nx; ny = -ny; nz = -nz; }
    if (this.n + (k - 2) * 3 > this.cap) return;
    var a = this.a, o = this.n * STRIDE, e = emis || 0, fl = flags || 0;
    for (i = 1; i < k - 1; i++) {
      var tri = [w[0], w[i], w[i + 1]];
      for (var j = 0; j < 3; j++) {
        var v = tri[j];
        a[o++] = v[0]; a[o++] = v[1]; a[o++] = v[2];
        a[o++] = nx; a[o++] = ny; a[o++] = nz;
        a[o++] = col[0]; a[o++] = col[1]; a[o++] = col[2];
        a[o++] = e; a[o++] = fl;
      }
      this.n += 3;
    }
  };
  // triangle (world) with explicit winding: normal from (b-a)x(c-a)
  Builder.prototype.triW = function (A, B, Cc, col, emis, flags) {
    var n = vNorm(vCross(vSub(B, A), vSub(Cc, A)));
    if (this.n + 3 > this.cap) return;
    var a = this.a, o = this.n * STRIDE, P = [A, B, Cc];
    for (var j = 0; j < 3; j++) {
      a[o++] = P[j][0]; a[o++] = P[j][1]; a[o++] = P[j][2];
      a[o++] = n[0]; a[o++] = n[1]; a[o++] = n[2];
      a[o++] = col[0]; a[o++] = col[1]; a[o++] = col[2];
      a[o++] = emis || 0; a[o++] = flags || 0;
    }
    this.n += 3;
  };
  Builder.prototype.tri = function (A, B, Cc, col, emis, flags) { this.triW(this.xf(A), this.xf(B), this.xf(Cc), col, emis, flags); };
  // frustum box: bottom rect (hx0,hz0) at y0, top rect (hx1,hz1) at y1, centred at (cx, cz)
  Builder.prototype.frustum = function (cx, cz, y0, y1, hx0, hz0, hx1, hz1, col, emis, colTop, flags) {
    var b = [[cx - hx0, y0, cz - hz0], [cx + hx0, y0, cz - hz0], [cx + hx0, y0, cz + hz0], [cx - hx0, y0, cz + hz0]];
    var t = [[cx - hx1, y1, cz - hz1], [cx + hx1, y1, cz - hz1], [cx + hx1, y1, cz + hz1], [cx - hx1, y1, cz + hz1]];
    var c = [cx, (y0 + y1) / 2, cz];
    this.poly(b, col, emis, flags, c); this.poly(t, colTop || col, emis, flags, c);
    for (var i = 0; i < 4; i++) { var j = (i + 1) % 4; this.poly([b[i], b[j], t[j], t[i]], col, emis, flags, c); }
  };
  Builder.prototype.box = function (cx, cy, cz, hx, hy, hz, col, emis, colTop, flags) {
    this.frustum(cx, cz, cy - hy, cy + hy, hx, hz, hx, hz, col, emis, colTop, flags);
  };
  // chamfered box (6 faces, 12 bevels, 8 corners); colTop for the +y face, colBot for -y
  Builder.prototype.chamfer = function (c, h, ch, col, emis, colTop, colBot, flags) {
    var self = this, a, b, d, sa, sb;
    function P(v) { return [c[0] + v[0], c[1] + v[1], c[2] + v[2]]; }
    ch = Math.min(ch, h[0] * 0.95, h[1] * 0.95, h[2] * 0.95);
    for (a = 0; a < 3; a++) {
      b = (a + 1) % 3; d = (a + 2) % 3;
      for (sa = -1; sa <= 1; sa += 2) {
        var f = [], sg = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
        for (var i = 0; i < 4; i++) { var v = [0, 0, 0]; v[a] = sa * h[a]; v[b] = sg[i][0] * (h[b] - ch); v[d] = sg[i][1] * (h[d] - ch); f.push(P(v)); }
        var fc = (a === 1 && sa > 0 && colTop) ? colTop : (a === 1 && sa < 0 && colBot) ? colBot : col;
        self.poly(f, fc, emis, flags, c);
        for (sb = -1; sb <= 1; sb += 2) {
          var q = [], v1 = [0, 0, 0]; v1[a] = sa * h[a]; v1[b] = sb * (h[b] - ch); v1[d] = h[d] - ch; q.push(P(v1));
          var v2 = v1.slice(); v2[d] = -(h[d] - ch); q.push(P(v2));
          var v3_ = [0, 0, 0]; v3_[a] = sa * (h[a] - ch); v3_[b] = sb * h[b]; v3_[d] = -(h[d] - ch); q.push(P(v3_));
          var v4 = v3_.slice(); v4[d] = h[d] - ch; q.push(P(v4));
          var bc = ((a === 1 && sa > 0) || (b === 1 && sb > 0)) && colTop ? mixc(col, colTop, 0.5) : col;
          self.poly(q, bc, emis, flags, c);
        }
      }
    }
    for (var sx = -1; sx <= 1; sx += 2) for (var sy = -1; sy <= 1; sy += 2) for (var sz = -1; sz <= 1; sz += 2) {
      self.poly([P([sx * h[0], sy * (h[1] - ch), sz * (h[2] - ch)]), P([sx * (h[0] - ch), sy * h[1], sz * (h[2] - ch)]),
        P([sx * (h[0] - ch), sy * (h[1] - ch), sz * h[2]])], sy > 0 && colTop ? mixc(col, colTop, 0.5) : col, emis, flags, c);
    }
  };
  // rounded box: per-axis grid coordinates g (e.g. [-1,-.8,-.5,.5,.8,1]) pushed onto a rounded-box surface (radius r)
  // h: half extents. colFn(nrm) -> colour (optional)
  var RB_CACHE = {};
  function roundedBoxTris(h, r, g) {
    var key = h.join(',') + '|' + r + '|' + g.join(',');
    if (RB_CACHE[key]) return RB_CACHE[key];
    var tris = [], n = g.length;
    function map(p) {
      var inner = [h[0] - r, h[1] - r, h[2] - r], q = [clamp(p[0], -inner[0], inner[0]), clamp(p[1], -inner[1], inner[1]), clamp(p[2], -inner[2], inner[2])];
      var d = vSub(p, q), l = vLen(d);
      if (l < 1e-9) return p;
      return vAdd(q, vMul(d, r / l));
    }
    for (var a = 0; a < 3; a++) {
      var b = (a + 1) % 3, d = (a + 2) % 3;
      for (var sa = -1; sa <= 1; sa += 2) {
        for (var i = 0; i < n - 1; i++) for (var j = 0; j < n - 1; j++) {
          var Q = [[i, j], [i + 1, j], [i + 1, j + 1], [i, j + 1]].map(function (ij) { var v = [0, 0, 0]; v[a] = sa * h[a]; v[b] = g[ij[0]] * h[b]; v[d] = g[ij[1]] * h[d]; return map(v); });
          if (sa < 0) Q.reverse();
          tris.push([Q[0], Q[1], Q[2]], [Q[0], Q[2], Q[3]]);
        }
      }
    }
    RB_CACHE[key] = tris;
    return tris;
  }
  Builder.prototype.roundedBox = function (h, r, g, colFn, emis, flags) {
    var tris = roundedBoxTris(h, r, g);
    for (var i = 0; i < tris.length; i++) {
      var t = tris[i], A = this.xf(t[0]), B = this.xf(t[1]), Cc = this.xf(t[2]);
      var ln = vNorm(vCross(vSub(t[1], t[0]), vSub(t[2], t[0])));
      var col = typeof colFn === 'function' ? colFn(ln, t) : colFn;
      this.triW(A, B, Cc, col, emis, flags);
    }
  };
  // prism / cylinder with n sides, radius r0 at y0, r1 at y1 (local), around y axis; caps optional
  Builder.prototype.cyl = function (n, r0, r1, y0, y1, col, emis, colTop, flags, phase, noCaps) {
    var ph = phase || 0, i, b = [], t = [];
    for (i = 0; i < n; i++) { var a = ph + i / n * TAU; b.push([Math.cos(a) * r0, y0, Math.sin(a) * r0]); t.push([Math.cos(a) * r1, y1, Math.sin(a) * r1]); }
    var c = [0, (y0 + y1) / 2, 0];
    for (i = 0; i < n; i++) { var j = (i + 1) % n; this.poly([b[i], b[j], t[j], t[i]], col, emis, flags, c); }
    if (!noCaps) { if (r1 > 1e-4) this.poly(t, colTop || col, emis, flags, c); if (r0 > 1e-4) this.poly(b, col, emis, flags, c); }
  };
  // icosphere (subdivision s) with per-vertex jitter function; centred at origin of the current matrix
  var ICO_CACHE = {};
  function icoMesh(sub) {
    if (ICO_CACHE[sub]) return ICO_CACHE[sub];
    var t = (1 + Math.sqrt(5)) / 2;
    var v = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]].map(vNorm);
    var f = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
    for (var s = 0; s < sub; s++) {
      var nf = [], mid = {};
      var M = function (a, b) { var k = a < b ? a + '_' + b : b + '_' + a; if (mid[k] === undefined) { mid[k] = v.length; v.push(vNorm(vMul(vAdd(v[a], v[b]), 0.5))); } return mid[k]; };
      for (var i = 0; i < f.length; i++) { var F = f[i], a = M(F[0], F[1]), b = M(F[1], F[2]), c = M(F[2], F[0]); nf.push([F[0], a, c], [F[1], b, a], [F[2], c, b], [a, b, c]); }
      f = nf;
    }
    ICO_CACHE[sub] = { v: v, f: f };
    return ICO_CACHE[sub];
  }
  Builder.prototype.ico = function (sub, r, col, emis, flags, jit, seed, colFn) {
    var M = icoMesh(sub), vs = [], i;
    for (i = 0; i < M.v.length; i++) {
      var k = 1 + (jit ? (hash(i, seed || 1) - 0.5) * 2 * jit : 0);
      vs.push(this.xf(vMul(M.v[i], r * k)));
    }
    var c = this.xf([0, 0, 0]);
    for (i = 0; i < M.f.length; i++) {
      var F = M.f[i];
      var cc = colFn ? colFn(i, M.v[F[0]]) : col;
      this.polyW([vs[F[0]], vs[F[1]], vs[F[2]]], cc, emis, flags, c);
    }
  };

  FG.m = { PI: PI, TAU: TAU, clamp: clamp, sat: sat, lerp: lerp, ss: ss, sst: sst, lin: lin, eo: eo, ei: ei, eio: eio, eo2: eo2, back: back, spring: spring, wob: wob, pulse: pulse, frac: frac, hash: hash, mulberry: mulberry, vn1: vn1, vn2: vn2, keys: keys, vkeys: vkeys };
  FG.v = { v3: v3, add: vAdd, sub: vSub, mul: vMul, mad: vMad, lerp: vLerp, dot: vDot, cross: vCross, len: vLen, norm: vNorm, dist: vDist };
  FG.mat = { ident: mIdent, mul: mMul, trans: mTrans, scale: mScale, rotX: mRotX, rotY: mRotY, rotZ: mRotZ, persp: mPersp, ortho: mOrtho, look: mLook, xf: mXf, xd: mXd, basis: mBasis };
  FG.col = { srgb: srgb, mix: mixc, mul: mulc };
  FG.C = C;
  FG.Builder = Builder; FG.STRIDE = STRIDE; FG.icoMesh = icoMesh;
  if (typeof module !== 'undefined' && module.exports) module.exports = FG;
})(typeof window !== 'undefined' ? window : globalThis);
