/* 1000 Agents — the film, section 6 of 7: BOOT (27.0–32.0 s, rendered 26.6–32.4 s), low-poly flat-shaded 3D.
   Extended from the 3 s style preview. Hand-written WebGL2 renderer, supersampled. The kernel's core sinks into a faceted
   machine; a screen slab rises from the stage; terse abstract boot marks tick by (lilac dashes, teal ticks) and a progress bar
   fills while the camera turns and dollies until it is nearly head-on with the screen. Four streams of agents run into the
   machine's ports along the stage floor. The projection carries a lens shift that pins the hero's anchor to the film's anchor. */
FILM.define('03-low-poly-3d', function (canvasArg, opts) {
  'use strict';
  var W = 1920, H = 1080;
  var SS = (opts && opts.ss) ? Math.max(1, Math.min(4, Math.round(opts.ss))) : ((opts && opts.export) ? 2 : 1);
  // ------------------------------------------------------------ utilities
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
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function ss(a, b, x) { var u = clamp((x - a) / (b - a), 0, 1); return u * u * (3 - 2 * u); }
  function lerp(a, b, u) { return a + (b - a) * u; }
  function outBack(u) { var c = 1.70158; u = clamp(u, 0, 1) - 1; return 1 + (c + 1) * u * u * u + c * u * u; }
  function srgb(hex) {
    var f = function (v) { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return [f((hex >> 16) & 255), f((hex >> 8) & 255), f(hex & 255)];
  }
  function mixc(a, b, u) { return [lerp(a[0], b[0], u), lerp(a[1], b[1], u), lerp(a[2], b[2], u)]; }
  function keys(k, t) { // k = [t0,v0,t1,v1,...] smooth interpolation
    if (t <= k[0]) return k[1];
    for (var i = 2; i < k.length; i += 2) {
      if (t <= k[i]) return lerp(k[i - 1], k[i + 1], ss(k[i - 2], k[i], t));
    }
    return k[k.length - 1];
  }

  // ------------------------------------------------------------ matrices (column-major)
  function mIdent() { return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]; }
  function mMul(a, b) {
    var o = new Array(16);
    for (var c = 0; c < 4; c++) for (var r = 0; r < 4; r++) {
      o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
    }
    return o;
  }
  function mTrans(x, y, z) { var m = mIdent(); m[12] = x; m[13] = y; m[14] = z; return m; }
  function mScale(x, y, z) { var m = mIdent(); m[0] = x; m[5] = y; m[10] = z; return m; }
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
  function vSub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
  function vCross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
  function vDot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  function vNorm(a) { var l = Math.sqrt(vDot(a, a)) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }
  function mLook(eye, at, up) {
    var f = vNorm(vSub(at, eye)), s = vNorm(vCross(f, up)), u = vCross(s, f);
    return [s[0], u[0], -f[0], 0, s[1], u[1], -f[1], 0, s[2], u[2], -f[2], 0,
      -vDot(s, eye), -vDot(u, eye), vDot(f, eye), 1];
  }

  // ------------------------------------------------------------ mesh builder (flat-shaded, world space)
  var STRIDE = 11; // pos3 nor3 col3 emis kind
  function Builder(maxTris) {
    this.a = new Float32Array(maxTris * 3 * STRIDE);
    this.n = 0; // vertex count
    this.m = mIdent();
    this.st = [];
  }
  Builder.prototype.reset = function () { this.n = 0; this.m = mIdent(); this.st.length = 0; };
  Builder.prototype.push = function () { this.st.push(this.m); };
  Builder.prototype.pop = function () { this.m = this.st.pop(); };
  Builder.prototype.mul = function (b) { this.m = mMul(this.m, b); };
  Builder.prototype.xf = function (p) {
    var m = this.m;
    return [m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12],
      m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13],
      m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14]];
  };
  // convex polygon, local points; normal is flipped to face away from local centre ctr
  Builder.prototype.poly = function (pts, col, emis, kind, ctr) {
    var w = [], i;
    for (i = 0; i < pts.length; i++) w.push(this.xf(pts[i]));
    this.polyW(w, col, emis, kind, this.xf(ctr));
  };
  Builder.prototype.polyW = function (w, col, emis, kind, c) {
    var nx = 0, ny = 0, nz = 0, i, k = w.length;
    for (i = 0; i < k; i++) { // Newell
      var p = w[i], q = w[(i + 1) % k];
      nx += (p[1] - q[1]) * (p[2] + q[2]);
      ny += (p[2] - q[2]) * (p[0] + q[0]);
      nz += (p[0] - q[0]) * (p[1] + q[1]);
    }
    var l = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1; nx /= l; ny /= l; nz /= l;
    if (nx * (w[0][0] - c[0]) + ny * (w[0][1] - c[1]) + nz * (w[0][2] - c[2]) < 0) { nx = -nx; ny = -ny; nz = -nz; }
    var a = this.a, o = this.n * STRIDE;
    for (i = 1; i < k - 1; i++) {
      var tri = [w[0], w[i], w[i + 1]];
      for (var j = 0; j < 3; j++) {
        var v = tri[j];
        a[o++] = v[0]; a[o++] = v[1]; a[o++] = v[2];
        a[o++] = nx; a[o++] = ny; a[o++] = nz;
        a[o++] = col[0]; a[o++] = col[1]; a[o++] = col[2];
        a[o++] = emis; a[o++] = kind;
      }
      this.n += 3;
    }
  };
  // frustum box: bottom rect (hx0,hz0) at y0, top rect (hx1,hz1) at y1
  Builder.prototype.frustum = function (cx, cz, y0, y1, hx0, hz0, hx1, hz1, col, emis) {
    var b = [[cx - hx0, y0, cz - hz0], [cx + hx0, y0, cz - hz0], [cx + hx0, y0, cz + hz0], [cx - hx0, y0, cz + hz0]];
    var t = [[cx - hx1, y1, cz - hz1], [cx + hx1, y1, cz - hz1], [cx + hx1, y1, cz + hz1], [cx - hx1, y1, cz + hz1]];
    var c = [cx, (y0 + y1) / 2, cz], e = emis || 0;
    this.poly(b, col, e, 0, c); this.poly(t, col, e, 0, c);
    for (var i = 0; i < 4; i++) { var j = (i + 1) % 4; this.poly([b[i], b[j], t[j], t[i]], col, e, 0, c); }
  };
  Builder.prototype.box = function (cx, cy, cz, hx, hy, hz, col, emis) {
    this.frustum(cx, cz, cy - hy, cy + hy, hx, hz, hx, hz, col, emis);
  };
  // chamfered box: 6 faces + 12 edge bevels + 8 corner triangles
  Builder.prototype.chamfer = function (c, h, ch, col, emis, colTop) {
    var e = emis || 0, self = this, a, b, d, sa, sb;
    function P(v) { return [c[0] + v[0], c[1] + v[1], c[2] + v[2]]; }
    for (a = 0; a < 3; a++) {
      b = (a + 1) % 3; d = (a + 2) % 3;
      for (sa = -1; sa <= 1; sa += 2) {
        var f = [];
        var sg = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
        for (var i = 0; i < 4; i++) { var v = [0, 0, 0]; v[a] = sa * h[a]; v[b] = sg[i][0] * (h[b] - ch); v[d] = sg[i][1] * (h[d] - ch); f.push(P(v)); }
        self.poly(f, (a === 1 && sa > 0 && colTop) ? colTop : col, e, 0, c);
        for (sb = -1; sb <= 1; sb += 2) { // edge bevel between axis a (sign sa) and axis b (sign sb)
          var q = [];
          var v1 = [0, 0, 0]; v1[a] = sa * h[a]; v1[b] = sb * (h[b] - ch); v1[d] = h[d] - ch; q.push(P(v1));
          var v2 = v1.slice(); v2[d] = -(h[d] - ch); q.push(P(v2));
          var v3 = [0, 0, 0]; v3[a] = sa * (h[a] - ch); v3[b] = sb * h[b]; v3[d] = -(h[d] - ch); q.push(P(v3));
          var v4 = v3.slice(); v4[d] = h[d] - ch; q.push(P(v4));
          self.poly(q, col, e, 0, c);
        }
      }
    }
    for (var sx = -1; sx <= 1; sx += 2) for (var sy = -1; sy <= 1; sy += 2) for (var sz = -1; sz <= 1; sz += 2) {
      self.poly([
        P([sx * h[0], sy * (h[1] - ch), sz * (h[2] - ch)]),
        P([sx * (h[0] - ch), sy * h[1], sz * (h[2] - ch)]),
        P([sx * (h[0] - ch), sy * (h[1] - ch), sz * h[2]])], col, e, 0, c);
    }
  };

  // ------------------------------------------------------------ palette (linear)
  var CORAL = srgb(0xd97757), SHADE = srgb(0xa8553b), LIGHT = srgb(0xf2a585), DARK = srgb(0x6e2a1a);
  var LILAC = srgb(0x7d70d6), LILAC_D = srgb(0x4a3f9c), LILAC_HI = srgb(0xa79df0);
  var INK = [0.004, 0.003, 0.006];
  var GROUND = [0.0088, 0.0080, 0.036];
  var STONE = [0.020, 0.017, 0.056];

  // ------------------------------------------------------------ static scenery: rocks (casters) then ground
  var FOLDER = [1.25, 0, 0];
  var staticB = new Builder(16000), staticCasters = 0;
  (function buildStatic() {
    var rnd = mulberry(7341);
    // icosahedron
    var ph = (1 + Math.sqrt(5)) / 2, iv = [], i, j, k;
    for (i = 0; i < 3; i++) for (var s1 = -1; s1 <= 1; s1 += 2) for (var s2 = -1; s2 <= 1; s2 += 2) {
      var v = [0, 0, 0]; v[(i + 1) % 3] = s1; v[(i + 2) % 3] = s2 * ph; iv.push(v);
    }
    var faces = [];
    function d2(a, b) { var d = vSub(a, b); return vDot(d, d); }
    for (i = 0; i < 12; i++) for (j = i + 1; j < 12; j++) for (k = j + 1; k < 12; k++) {
      if (Math.abs(d2(iv[i], iv[j]) - 4) < 0.01 && Math.abs(d2(iv[j], iv[k]) - 4) < 0.01 && Math.abs(d2(iv[i], iv[k]) - 4) < 0.01) faces.push([i, j, k]);
    }
    var rocks = [[-4.6, -3.8, 0.36], [5.6, 2.2, 0.18], [-6.2, 2.6, 0.16], [8.0, -6.0, 0.9], [-8.5, -7.0, 1.1]];
    for (var r = 0; r < rocks.length; r++) {
      var R = rocks[r], pv = [];
      for (i = 0; i < 12; i++) {
        var jit = 0.72 + 0.5 * rnd();
        pv.push([R[0] + iv[i][0] * R[2] * jit * 0.6, R[2] * 0.25 + iv[i][1] * R[2] * jit * 0.42, R[1] + iv[i][2] * R[2] * jit * 0.6]);
      }
      var tint = 0.8 + 0.4 * rnd();
      for (i = 0; i < faces.length; i++) {
        var f = faces[i];
        staticB.polyW([pv[f[0]], pv[f[1]], pv[f[2]]], [STONE[0] * tint, STONE[1] * tint, STONE[2] * tint], 0, 0, [R[0], R[2] * 0.25, R[1]]);
      }
    }
    staticCasters = staticB.n;
    // faceted ground: flat on the stage, gently rolling facets further out
    var NG = 64, CELL = 1.9, half = NG * CELL / 2, gp = [];
    for (j = 0; j <= NG; j++) {
      gp.push([]);
      for (i = 0; i <= NG; i++) {
        var x = -half + i * CELL + (rnd() - 0.5) * CELL * 0.62, z = -half + j * CELL + (rnd() - 0.5) * CELL * 0.62;
        var rr = Math.sqrt(x * x + z * z);
        var y = (rnd() - 0.5) * 0.9 * ss(6.5, 20, rr) + ss(22, 60, rr) * 1.6 * rnd();
        gp[j].push([x, y, z]);
      }
    }
    for (j = 0; j < NG; j++) for (i = 0; i < NG; i++) {
      var a = gp[j][i], b = gp[j][i + 1], c = gp[j + 1][i + 1], d = gp[j + 1][i];
      var t1 = 0.84 + 0.32 * rnd(), t2 = 0.84 + 0.32 * rnd();
      var below = [a[0], -50, a[2]];
      if ((i + j) & 1) {
        staticB.polyW([a, b, c], [GROUND[0] * t1, GROUND[1] * t1, GROUND[2] * t1], 0, 1, below);
        staticB.polyW([a, c, d], [GROUND[0] * t2, GROUND[1] * t2, GROUND[2] * t2], 0, 1, below);
      } else {
        staticB.polyW([a, b, d], [GROUND[0] * t1, GROUND[1] * t1, GROUND[2] * t1], 0, 1, below);
        staticB.polyW([b, c, d], [GROUND[0] * t2, GROUND[1] * t2, GROUND[2] * t2], 0, 1, below);
      }
    }
  })();
  // ------------------------------------------------------------ dynamic scene
  var dynB = new Builder(16000), dynCasters = 0;
  var GSTR = 10; // pos3 uv2 mode1 col3 pad
  var glowA = new Float32Array(3000 * 6 * GSTR), glowN = 0;
  function glowQuad(p0, p1, p2, p3, mode, col, uv) {
    var P = [p0, p1, p2, p0, p2, p3], U = [uv[0], uv[1], uv[2], uv[0], uv[2], uv[3]], o = glowN * GSTR;
    for (var i = 0; i < 6; i++) {
      glowA[o++] = P[i][0]; glowA[o++] = P[i][1]; glowA[o++] = P[i][2];
      glowA[o++] = U[i][0]; glowA[o++] = U[i][1]; glowA[o++] = mode;
      glowA[o++] = col[0]; glowA[o++] = col[1]; glowA[o++] = col[2]; glowA[o++] = 0;
    }
    glowN += 6;
  }
  var UVQ = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  function halo(c, r, col, cr, cu) {
    glowQuad(
      [c[0] - (cr[0] + cu[0]) * r, c[1] - (cr[1] + cu[1]) * r, c[2] - (cr[2] + cu[2]) * r],
      [c[0] + (cr[0] - cu[0]) * r, c[1] + (cr[1] - cu[1]) * r, c[2] + (cr[2] - cu[2]) * r],
      [c[0] + (cr[0] + cu[0]) * r, c[1] + (cr[1] + cu[1]) * r, c[2] + (cr[2] + cu[2]) * r],
      [c[0] - (cr[0] - cu[0]) * r, c[1] - (cr[1] - cu[1]) * r, c[2] - (cr[2] - cu[2]) * r], 0, col, UVQ);
  }

  function buildHero(B, s) {
    var BW = 0.72, BH = 0.46, BD = 0.43, LEG = 0.29, YC = LEG + BH - 0.04;
    var sxz = 1 / Math.sqrt(s.sy);
    B.push();
    B.mul(mTrans(s.x, s.y, s.z)); B.mul(mRotY(s.yaw)); B.mul(mScale(sxz, s.sy, sxz));
    // legs (tapered stubs), splaying a little in the air
    var lx = 0.45, lz = 0.23, i;
    for (i = 0; i < 4; i++) {
      var sx = i & 1 ? 1 : -1, sz = i & 2 ? 1 : -1;
      B.push();
      B.mul(mTrans(sx * lx, LEG + 0.04, sz * lz));
      B.mul(mRotZ(sx * 0.30 * s.air)); B.mul(mRotX(-sz * 0.24 * s.air));
      B.frustum(0, 0, -LEG - 0.04 + 0.0, 0.1, 0.125, 0.125, 0.165, 0.165, sz > 0 ? CORAL : SHADE, 0);
      B.pop();
    }
    // body + face tilt together
    B.mul(mTrans(0, YC, 0)); B.mul(mRotX(s.pitch)); B.mul(mRotZ(s.roll));
    B.chamfer([0, 0, 0], [BW, BH, BD], 0.13, CORAL, 0, LIGHT);
    // arm nubs
    for (i = -1; i <= 1; i += 2) {
      var raise = i > 0 ? s.arm : 0, wig = 0.35 * s.air;
      B.push();
      B.mul(mTrans(i * (BW - 0.05), 0.02 + 0.10 * raise, 0.02));
      B.mul(mRotZ(i * (-0.25 + wig + 1.25 * raise)));
      var len = 0.17 + 0.17 * raise;
      B.chamfer([i * len, 0, 0], [len, 0.125, 0.125], 0.05, mixc(CORAL, SHADE, 0.55), 0);
      B.pop();
    }
    // eyes: black blocks with a glint
    var fz = BD;
    for (i = -1; i <= 1; i += 2) {
      var ex = i * 0.40 + s.eyeShift, ey = 0.185 + s.eyeUp, eh = 0.098 * s.eye;
      B.box(ex, ey, fz + 0.006, 0.07, eh, 0.016, INK, 0);
      if (s.eye > 0.5) B.box(ex - 0.03, ey + eh - 0.034, fz + 0.022, 0.024, 0.024, 0.004, [1, 0.97, 0.93], 0.85);
    }
    if (s.mouth > 0.02) {
      var mh = 0.105 * s.mouth, my = -0.13;
      B.box(0, my, fz + 0.004, 0.19 * (0.6 + 0.4 * s.mouth), mh, 0.014, INK, 0);
      B.box(0, my - mh + 0.03 * s.mouth, fz + 0.012, 0.12 * s.mouth, 0.03 * s.mouth, 0.008, DARK, 0.25);
    }
    B.pop();
  }
  // ------------------------------------------------------------ the film's BOOT: hero, machine, screen, agents
  var A = FILM.ANCHOR, FM = FILM.m;
  var HX = -1.45, HZ = 0.22;
  function heroState(T) {
    var h = FILM.heroAt(T);
    var s = { x: HX + h.dx * 1.44, y: h.lift * 0.92 * 1.45, z: HZ, sy: 1 - h.sq * 0.9, air: h.air };
    s.yaw = 0.30 + 0.35 * h.turn;
    s.pitch = -h.look[1] * 0.14 - h.lean * 0.4;
    s.roll = 0;
    s.eye = 1 - 0.92 * h.blink;
    s.eyeShift = h.look[0] * 0.035; s.eyeUp = h.look[1] * 0.03;
    s.arm = Math.max(h.arm, h.point * 0.6); s.mouth = h.mouth;
    return s;
  }
  // the camera turns from a three-quarter view to almost head-on with the screen, dollying in; the anchor fit holds the hero
  function camState(T) {
    var u = FM.ss(27.0, 32.0, T) * 0.75 + FM.sat((T - 27) / 5) * 0.25;
    var az = lerp(-0.36, -0.05, u), el = lerp(0.2, 0.12, u), dist = lerp(13.4, 11.2, u);
    var tgt = [lerp(0.55, 0.95, u), lerp(1.0, 1.35, u), 0];
    var eye = [tgt[0] + dist * Math.sin(az) * Math.cos(el), tgt[1] + dist * Math.sin(el), tgt[2] + dist * Math.cos(az) * Math.cos(el)];
    return { eye: eye, tgt: tgt, fov: 30 * Math.PI / 180 };
  }
  function anchorFit(VP) {
    function pr(p) { var x = VP[0] * p[0] + VP[4] * p[1] + VP[8] * p[2] + VP[12], y = VP[1] * p[0] + VP[5] * p[1] + VP[9] * p[2] + VP[13], w = VP[3] * p[0] + VP[7] * p[1] + VP[11] * p[2] + VP[15]; return [x / w, y / w]; }
    var pf = pr([HX, 0, HZ + 0.23]), pt = pr([HX, 1.17, HZ + 0.23]);
    var k = (A.h / 1080 * 2) / (pt[1] - pf[1]);
    var tx = (A.x / 1920 * 2 - 1) - pf[0] * k, ty = (1 - A.gy / 1080 * 2) - pf[1] * k;
    var f = mIdent(); f[0] = k; f[5] = k; f[12] = tx; f[13] = ty;
    return mMul(f, VP);
  }

  var MACH = [1.15, 0, -0.15];                                 // the machine's base centre
  var SCR = { x: 1.3, z: -1.05, w: 1.75, h: 1.02, th: 0.11, y: 1.95 };   // screen slab: centre x, z, half w, half h, half thickness, rest height
  var T_SINK = [27.25, 28.05], T_RISE = [27.55, 28.45], T_BAR = [27.8, 31.5];
  var BOOT_ROWS = 8;
  function bootRow(k) { return { t: 28.25 + k * 0.36, n: 2 + Math.floor(FM.hash(k, 77) * 3), lens: [0, 1, 2, 3].map(function (j) { return 0.18 + 0.42 * FM.hash(k * 7 + j, 78); }) }; }
  // the core: a faceted icosahedron, lilac with warm seams, that sinks into the machine
  var ICO = (function () {
    var ph = (1 + Math.sqrt(5)) / 2, v = [], f = [], i, j, k;
    for (i = 0; i < 3; i++) for (var s1 = -1; s1 <= 1; s1 += 2) for (var s2 = -1; s2 <= 1; s2 += 2) { var p = [0, 0, 0]; p[(i + 1) % 3] = s1; p[(i + 2) % 3] = s2 * ph; v.push(vNorm(p)); }
    function d2(a, b) { var d = vSub(a, b); return vDot(d, d); }
    var e2 = d2(v[0], v[1]); for (i = 0; i < 12; i++) for (j = 0; j < 12; j++) if (i !== j) e2 = Math.min(e2, d2(v[i], v[j]));
    for (i = 0; i < 12; i++) for (j = i + 1; j < 12; j++) for (k = j + 1; k < 12; k++) if (Math.abs(d2(v[i], v[j]) - e2) < 1e-3 && Math.abs(d2(v[j], v[k]) - e2) < 1e-3 && Math.abs(d2(v[i], v[k]) - e2) < 1e-3) f.push([i, j, k]);
    return { v: v, f: f };
  })();
  function buildMachine(B, T) {
    // base: a chamfered block with a lit slot on top
    B.chamfer([MACH[0], 0.36, MACH[2]], [0.95, 0.36, 0.62], 0.1, LILAC_D, 0, mixc(LILAC_D, LILAC, 0.35));
    B.chamfer([MACH[0], 0.74, MACH[2]], [0.55, 0.04, 0.36], 0.03, [0.03, 0.02, 0.07], 0.0);
    var live = FM.ss(27.9, 28.4, T);
    B.box(MACH[0], 0.786, MACH[2], 0.42, 0.006, 0.26, [1.0, 0.6, 0.32], 0.25 + 0.55 * live);
    // little feet and vents
    for (var i = -1; i <= 1; i += 2) B.chamfer([MACH[0] + i * 0.7, 0.05, MACH[2] + 0.5], [0.16, 0.05, 0.1], 0.02, LILAC_D, 0);
    for (var v = 0; v < 4; v++) B.box(MACH[0] - 0.45 + v * 0.3, 0.38, MACH[2] + 0.625, 0.1, 0.11, 0.008, [0.03, 0.02, 0.07], 0.35 * live);
    // the core, sinking in
    var sink = FM.eio(FM.sat((T - T_SINK[0]) / (T_SINK[1] - T_SINK[0])));
    if (sink < 1) {
      var r = 0.62 * (1 - 0.25 * sink), cy = lerp(0.74 + 0.66, 0.1, sink), rot = T * 0.4;
      B.push(); B.mul(mTrans(MACH[0], cy, MACH[2])); B.mul(mRotY(rot)); B.mul(mRotX(0.36));
      for (var f = 0; f < ICO.f.length; f++) {
        var F = ICO.f[f], seam = FM.hash(f, 5) < 0.3;
        var col = seam ? mixc(LILAC, [1.0, 0.6, 0.35], 0.6) : (f % 2 ? LILAC : LILAC_HI);
        B.poly([ICO.v[F[0]].map(function (x) { return x * r; }), ICO.v[F[1]].map(function (x) { return x * r; }), ICO.v[F[2]].map(function (x) { return x * r; })], col, seam ? 0.9 : 0.12, 0, [0, 0, 0]);
      }
      B.pop();
    }
  }
  function screenY(T) { var u = FM.sat((T - T_RISE[0]) / (T_RISE[1] - T_RISE[0])); return lerp(-SCR.h - 0.3, SCR.y, outBack(u)); }
  function buildScreen(B, T) {
    var y = screenY(T);
    if (y < -SCR.h - 0.25) return;
    var fz = SCR.z + SCR.th;
    // the slab and its stand
    B.chamfer([SCR.x, y, SCR.z], [SCR.w, SCR.h, SCR.th], 0.07, mixc(LILAC_D, [0.02, 0.015, 0.05], 0.35), 0, mixc(LILAC_D, LILAC, 0.3));
    B.chamfer([SCR.x, Math.min(y - SCR.h, 0.6) / 2 + 0.02, SCR.z - 0.05], [0.16, Math.max(0.02, (y - SCR.h) / 2 + 0.02), 0.07], 0.02, LILAC_D, 0);
    // the glass: a deep indigo inset that lights up
    var on = FM.ss(28.0, 28.35, T);
    B.box(SCR.x, y, fz + 0.004, SCR.w - 0.1, SCR.h - 0.1, 0.004, [0.012, 0.010, 0.04], 0.6 * on);
    if (on <= 0) return;
    // boot marks: short lilac dashes, each row signed off with a teal tick
    var x0 = SCR.x - SCR.w + 0.32, ytop = y + SCR.h - 0.26, rowH = 0.17, z = fz + 0.012;
    for (var k = 0; k < BOOT_ROWS; k++) {
      var R = bootRow(k); if (T < R.t) break;
      var yy = ytop - k * rowH, xx = x0, a = FM.ss(R.t, R.t + 0.12, T);
      for (var j = 0; j < R.n; j++) {
        var len = R.lens[j] * a;
        if (len > 0.005) B.box(xx + len / 2, yy, z, len / 2, 0.022, 0.003, j === 0 ? LILAC_HI : LILAC, 0.9 + (j === 0 ? 0.4 : 0));
        xx += R.lens[j] + 0.07;
      }
      var ok = FM.ss(R.t + 0.2, R.t + 0.3, T);
      if (ok > 0) {                                           // the tick: two short strokes
        var tx = SCR.x + SCR.w - 0.42, s = ok;
        B.push(); B.mul(mTrans(tx, yy, z)); B.mul(mRotZ(-0.8)); B.box(-0.01, 0.0, 0, 0.035 * s, 0.014, 0.003, TEAL, 1.6); B.pop();
        B.push(); B.mul(mTrans(tx + 0.05, yy + 0.03, z)); B.mul(mRotZ(0.9)); B.box(0.0, 0.0, 0, 0.07 * s, 0.014, 0.003, TEAL, 1.6); B.pop();
      }
    }
    // the progress bar along the bottom
    var bu = FM.sat((T - T_BAR[0]) / (T_BAR[1] - T_BAR[0])), be = bu < 1 ? 1 - Math.pow(1 - bu, 1.6) * (1 - 0.15 * Math.sin(bu * 9)) : 1;
    var bw = (SCR.w - 0.32) * 2, by = y - SCR.h + 0.2;
    B.box(SCR.x, by, z - 0.002, bw / 2, 0.035, 0.002, [0.05, 0.04, 0.14], 0.5);
    if (be > 0.002) B.box(SCR.x - bw / 2 + bw * be / 2, by, z, bw * be / 2, 0.03, 0.003, bu >= 1 ? TEAL : mixc(CORAL, LIGHT, 0.4), bu >= 1 ? 1.4 : 1.2);
  }
  var TEAL = srgb(0x5fd6c4);

  // the agents: four streams along the stage floor that run into the machine's ports, plus a slow halo of them round the screen
  var LANES = [
    [[-9, 0.05, 4.5], [-4, 0.05, 2.6], [-0.2, 0.05, 1.3], [MACH[0] - 0.95, 0.12, MACH[2] + 0.2]],
    [[9.5, 0.05, 5.0], [6.5, 0.05, 2.4], [3.6, 0.05, 0.9], [MACH[0] + 0.95, 0.12, MACH[2] + 0.2]],
    [[-7, 0.05, -6.5], [-3, 0.05, -3.2], [0.2, 0.05, -1.4], [MACH[0] - 0.7, 0.12, MACH[2] - 0.6]],
    [[10, 0.05, -5.5], [6, 0.05, -3.4], [3.6, 0.05, -1.6], [MACH[0] + 0.7, 0.12, MACH[2] - 0.6]],
  ];
  function bez(P, u) {
    var a = 1 - u; return [a * a * a * P[0][0] + 3 * a * a * u * P[1][0] + 3 * a * u * u * P[2][0] + u * u * u * P[3][0],
      a * a * a * P[0][1] + 3 * a * a * u * P[1][1] + 3 * a * u * u * P[2][1] + u * u * u * P[3][1],
      a * a * a * P[0][2] + 3 * a * a * u * P[1][2] + 3 * a * u * u * P[2][2] + u * u * u * P[3][2]];
  }
  var AGL = FILM.AG.map(function (g) { return { lane: g.i % 4, ph: g.r[0], sp: 0.085 + 0.03 * g.r[1], off: [(g.r[2] - 0.5) * 0.5, (g.r[3] - 0.5) * 0.5], len: 0.1 + 0.07 * g.r[4], rad: 0.02 + 0.012 * g.r[5], tone: g.r[6], tw: g.r[7] * 6.28 }; });
  function agentP(i, T) {
    var g = AGL[i], u = FM.frac(g.ph + g.sp * (T - 27)), q = bez(LANES[g.lane], u), fade = Math.pow(u, 0.6);
    return [q[0] + g.off[0] * (1 - fade * 0.9), q[1] + 0.06 * Math.abs(Math.sin(T * 9 + g.tw)), q[2] + g.off[1] * (1 - fade * 0.9), u];
  }
  function buildAgents(B, T, cam) {
    var cr = cam.right, cu = cam.up;
    for (var i = 0; i < FILM.N; i++) {
      var g = AGL[i], p = agentP(i, T), q = agentP(i, T + 0.02);
      if (q[3] < p[3]) continue;                               // wrapping round: skip a frame's worth
      var d = vNorm(vSub(q, p)), grow = FM.ss(0, 0.04, p[3]) * (1 - FM.ss(0.96, 1, p[3])), len = g.len * grow, rad = g.rad * grow;
      if (grow <= 0.01) continue;
      var u = vNorm(vCross(d, [0.3, 0.9, 0.1])), v = vCross(d, u);
      var tip = [p[0] + d[0] * len * 0.68, p[1] + d[1] * len * 0.68, p[2] + d[2] * len * 0.68], tail = [p[0] - d[0] * len * 0.32, p[1] - d[1] * len * 0.32, p[2] - d[2] * len * 0.32];
      var ring = [];
      for (var k = 0; k < 3; k++) { var an = T * 8 + g.tw + k * 2.0944, c = Math.cos(an) * rad, s = Math.sin(an) * rad; ring.push([p[0] + u[0] * c + v[0] * s, p[1] + u[1] * c + v[1] * s, p[2] + u[2] * c + v[2] * s]); }
      var tw = 0.85 + 0.15 * Math.sin(T * 17 + g.tw);
      var col = g.tone < 0.5 ? mixc(CORAL, LIGHT, g.tone * 2) : mixc(LIGHT, [1.0, 0.80, 0.50], (g.tone - 0.5) * 2);
      var em = (0.6 + 0.5 * g.tone) * tw;
      for (k = 0; k < 3; k++) { B.polyW([tip, ring[k], ring[(k + 1) % 3]], col, em, 0, [p[0], p[1], p[2]]); B.polyW([tail, ring[k], ring[(k + 1) % 3]], col, em * 0.7, 0, [p[0], p[1], p[2]]); }
      halo([p[0], p[1], p[2]], 0.12 * grow + 0.02, [col[0] * 0.13 * tw, col[1] * 0.095 * tw, col[2] * 0.07 * tw], cr, cu);
    }
  }
  var MOTES = [];
  (function () {
    var rnd = mulberry(4242);
    for (var i = 0; i < 30; i++) MOTES.push([(rnd() - 0.5) * 17, 0.3 + rnd() * 5.5, (rnd() - 0.5) * 9 - 0.5, rnd() * 6.28, 0.5 + rnd(), 0.02 + 0.03 * rnd()]);
  })();
  function buildMotes(t, cam) {
    for (var i = 0; i < MOTES.length; i++) {
      var m = MOTES[i];
      var p = [m[0] + 0.25 * Math.sin(t * 0.9 * m[4] + m[3]), m[1] + 0.16 * t * m[4] + 0.08 * Math.sin(t * 1.7 + m[3]), m[2] + 0.2 * Math.cos(t * 0.7 * m[4] + m[3])];
      var b = 0.55 + 0.45 * Math.sin(t * 2.1 * m[4] + m[3] * 3);
      halo(p, m[5] * 1.6, [0.05 * b, 0.045 * b, 0.13 * b], cam.right, cam.up);
    }
  }
  // ------------------------------------------------------------ GL
  var canvas = canvasArg;
  canvas.width = W; canvas.height = H;
  var gl = canvas.getContext('webgl2', { antialias: false, alpha: false, depth: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
  if (!gl) return { renderAt: function () {}, isReady: function () { return true; } };
  var floatOK = !!gl.getExtension('EXT_color_buffer_float') || !!gl.getExtension('EXT_color_buffer_half_float');
  var maxTex = gl.getParameter(gl.MAX_TEXTURE_SIZE);
  while (SS > 1 && W * SS > maxTex) SS--;
  var FW = W * SS, FH = H * SS, SHADOW = 2048;

  function sh(type, src) {
    var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) + '\n' + src);
    return s;
  }
  function prog(vs, fs, attribs) {
    var p = gl.createProgram();
    gl.attachShader(p, sh(gl.VERTEX_SHADER, '#version 300 es\nprecision highp float;\n' + vs));
    gl.attachShader(p, sh(gl.FRAGMENT_SHADER, '#version 300 es\nprecision highp float;\nprecision highp sampler2DShadow;\n' + fs));
    for (var i = 0; i < attribs.length; i++) gl.bindAttribLocation(p, i, attribs[i]);
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    var u = {}, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (i = 0; i < n; i++) { var info = gl.getActiveUniform(p, i), nm = info.name.replace('[0]', ''); u[nm] = gl.getUniformLocation(p, nm); }
    return { p: p, u: u };
  }

  var SKY = [
    'vec3 sky(vec3 d){',
    '  vec3 hor=vec3(0.0046,0.0036,0.0200), zen=vec3(0.0009,0.0007,0.0046), nad=vec3(0.0016,0.0012,0.0075);',
    '  float h=d.y;',
    '  return h>0. ? mix(hor,zen,pow(smoothstep(0.,.55,h),.6)) : mix(hor,nad,smoothstep(0.,-.22,h));',
    '}'].join('\n');

  var pScene = prog([
    'in vec3 aPos; in vec3 aNor; in vec3 aCol; in vec2 aMat;',
    'uniform mat4 uVP, uLVP;',
    'out vec3 vW; out vec3 vS; flat out vec3 vN; flat out vec3 vC; flat out vec2 vM;',
    'void main(){ vW=aPos; vN=aNor; vC=aCol; vM=aMat;',
    '  vec4 s=uLVP*vec4(aPos+aNor*0.02,1.); vS=s.xyz*.5+.5;',
    '  gl_Position=uVP*vec4(aPos,1.); }'].join('\n'), [
    'in vec3 vW; in vec3 vS; flat in vec3 vN; flat in vec3 vC; flat in vec2 vM;',
    'uniform sampler2DShadow uSh; uniform vec3 uCam, uKeyDir, uKeyCol, uRimDir, uRimCol, uPtPos, uPtCol;',
    'uniform vec4 uOccA[2]; uniform vec4 uOccB[2]; uniform float uShTex;',
    'out vec4 o;', SKY,
    'float hash(vec2 p){ vec3 q=fract(vec3(p.xyx)*.1031); q+=dot(q,q.yzx+33.33); return fract((q.x+q.y)*q.z); }',
    'void main(){',
    '  vec3 N=normalize(vN); float emis=vM.x; float kind=vM.y;',
    '  float ndl=max(dot(N,uKeyDir),0.);',
    '  float shd=1.;',
    '  if(ndl>0. && vS.x>0. && vS.x<1. && vS.y>0. && vS.y<1.){',
    '    float a=hash(gl_FragCoord.xy)*6.2832; float bias=mix(0.0030,0.0010,ndl); shd=0.;',
    '    for(int i=0;i<16;i++){ float fi=float(i)+.5; float r=sqrt(fi/16.)*uShTex; float th=a+fi*2.39996;',
    '      shd+=texture(uSh, vec3(vS.xy+vec2(cos(th),sin(th))*r, vS.z-bias)); }',
    '    shd/=16.; }',
    '  vec3 rel=vW-vec3(0.,0.,0.); float sd=length(rel-uKeyDir*dot(rel,uKeyDir));',
    '  float spot=1.-smoothstep(2.6,8.5,sd); spot=spot*spot*.94+.06;',
    '  vec3 key=uKeyCol*ndl*shd*spot;',
    '  vec3 rim=uRimCol*pow(max(dot(N,uRimDir),0.),1.2);',
    '  vec3 amb=mix(vec3(0.055,0.035,0.070),vec3(0.105,0.110,0.250),N.y*.5+.5);',
    '  vec3 pd=uPtPos-vW; float r2=dot(pd,pd);',
    '  vec3 pt=uPtCol*max(dot(N,pd*inversesqrt(r2)),0.)*min(1./(1.+r2*.22), mix(.32,1.,kind));',
    '  float ao=1.;',
    '  if(kind>.5){ for(int i=0;i<2;i++){ vec2 q=vW.xz-uOccA[i].xy; float c=uOccB[i].x, s=uOccB[i].y;',
    '      q=vec2(c*q.x-s*q.y, s*q.x+c*q.y); float d=length(max(abs(q)-uOccA[i].zw,0.));',
    '      float rr=uOccB[i].w; ao*=1.-uOccB[i].z*exp(-d*d/(rr*rr)); } }',
    '  vec3 c=vC*(amb*ao*mix(1.,.55,kind) + key*mix(1.,ao,.6) + rim*ao*mix(1.,.3,kind) + pt*mix(1.,ao,.5));',
    '  float facet=.62+.38*max(dot(N,normalize(vec3(.35,.8,.5))),0.);',
    '  c+=vC*emis*facet;',
    '  vec3 v=vW-uCam; float dist=length(v);',
    '  float f=1.-exp(-pow(max(dist-9.5,0.)*.062,1.5));',
    '  c=mix(c, sky(vec3(v.x,0.,v.z)/max(length(v.xz),1e-4)), f);',
    '  o=vec4(c,1.); }'].join('\n'), ['aPos', 'aNor', 'aCol', 'aMat']);

  var pShadow = prog('in vec3 aPos; uniform mat4 uLVP; void main(){ gl_Position=uLVP*vec4(aPos,1.); }',
    'out vec4 o; void main(){ o=vec4(1.); }', ['aPos']);

  var pSky = prog('in vec2 aP; out vec2 vP; void main(){ vP=aP; gl_Position=vec4(aP,0.,1.); }', [
    'in vec2 vP; uniform vec3 uF,uR,uU; out vec4 o;', SKY,
    'void main(){ vec3 d=normalize(uF+uR*vP.x+uU*vP.y); o=vec4(sky(d),1.); }'].join('\n'), ['aP']);

  var pGlow = prog([
    'in vec3 aPos; in vec3 aUv; in vec4 aCol; uniform mat4 uVP; out vec3 vUv; out vec3 vC;',
    'void main(){ vUv=aUv; vC=aCol.rgb; gl_Position=uVP*vec4(aPos,1.); }'].join('\n'), [
    'in vec3 vUv; in vec3 vC; out vec4 o;',
    'void main(){ float a;',
    '  if(vUv.z<.5){ float r=clamp(1.-length(vUv.xy),0.,1.); a=r*r*r; }',
    '  else if(vUv.z<1.5){ float x=1.-abs(vUv.x); a=x*x*(1.-vUv.y)*(1.-vUv.y); }',
    '  else { float x=clamp(1.-abs(vUv.x),0.,1.); float y=clamp(1.-vUv.y,0.,1.); a=x*x*(3.-2.*x)*y*y*smoothstep(0.,.08,vUv.y); }',
    '  o=vec4(vC*a,1.); }'].join('\n'), ['aPos', 'aUv', 'aCol']);

  var pPost = prog('in vec2 aP; void main(){ gl_Position=vec4(aP,0.,1.); }', [
    'uniform sampler2D uT; uniform int uSS; uniform vec2 uRes; out vec4 o;',
    'float hash(vec2 p){ vec3 q=fract(vec3(p.xyx)*.1031); q+=dot(q,q.yzx+33.33); return fract((q.x+q.y)*q.z); }',
    'vec3 tone(vec3 x){ vec3 a=vec3(.62); return mix(x, a+(1.-a)*tanh((x-a)/(1.-a)), step(a,x)); }',
    'void main(){ ivec2 b=ivec2(gl_FragCoord.xy)*uSS; vec3 c=vec3(0.);',
    '  for(int j=0;j<uSS;j++) for(int i=0;i<uSS;i++) c+=tone(texelFetch(uT,b+ivec2(i,j),0).rgb);',
    '  c/=float(uSS*uSS);',
    '  float lu=dot(c,vec3(.2126,.7152,.0722)); c=max(mix(vec3(lu),c,1.0),0.);',
    '  vec2 q=(gl_FragCoord.xy/uRes-.5)*vec2(1.,.82); c*=1.-.9*dot(q,q);',
    '  c=pow(max(c,0.),vec3(1./2.2));',
    '  c+=(hash(gl_FragCoord.xy)+hash(gl_FragCoord.yx+17.3)-1.)/255.;',
    '  o=vec4(c,1.); }'].join('\n'), ['aP']);

  var pHud = prog('in vec2 aP; in vec4 aC; uniform vec2 uRes; out vec4 vC; void main(){ vC=aC; gl_Position=vec4(aP.x/uRes.x*2.-1., 1.-aP.y/uRes.y*2., 0., 1.); }',
    'in vec4 vC; out vec4 o; void main(){ o=vC; }', ['aP', 'aC']);

  // buffers / VAOs
  function sceneVAO(buf) {
    var v = gl.createVertexArray(); gl.bindVertexArray(v); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    var B4 = 4 * STRIDE;
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, B4, 0);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, B4, 12);
    gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 3, gl.FLOAT, false, B4, 24);
    gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3, 2, gl.FLOAT, false, B4, 36);
    return v;
  }
  var bufStatic = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, bufStatic);
  gl.bufferData(gl.ARRAY_BUFFER, staticB.a.subarray(0, staticB.n * STRIDE), gl.STATIC_DRAW);
  var vaoStatic = sceneVAO(bufStatic);
  var bufDyn = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, bufDyn);
  gl.bufferData(gl.ARRAY_BUFFER, dynB.a.byteLength, gl.DYNAMIC_DRAW);
  var vaoDyn = sceneVAO(bufDyn);
  var bufGlow = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, bufGlow);
  gl.bufferData(gl.ARRAY_BUFFER, glowA.byteLength, gl.DYNAMIC_DRAW);
  var vaoGlow = gl.createVertexArray(); gl.bindVertexArray(vaoGlow);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 4 * GSTR, 0);
  gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 4 * GSTR, 12);
  gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 4, gl.FLOAT, false, 4 * GSTR, 24);
  var bufQuad = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, bufQuad);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
  var vaoQuad = gl.createVertexArray(); gl.bindVertexArray(vaoQuad);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  var hudA = new Float32Array(400 * 6 * 6), hudN = 0;
  var bufHud = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, bufHud);
  gl.bufferData(gl.ARRAY_BUFFER, hudA.byteLength, gl.DYNAMIC_DRAW);
  var vaoHud = gl.createVertexArray(); gl.bindVertexArray(vaoHud);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 24, 0);
  gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 24, 8);
  gl.bindVertexArray(null);

  // render targets
  var texScene = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, texScene);
  if (floatOK) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, FW, FH, 0, gl.RGBA, gl.HALF_FLOAT, null);
  else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, FW, FH, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  var rbDepth = gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER, rbDepth);
  gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, FW, FH);
  var fbScene = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fbScene);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texScene, 0);
  gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, rbDepth);
  var texSh = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, texSh);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT24, SHADOW, SHADOW, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_FUNC, gl.LEQUAL);
  var fbSh = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fbSh);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, texSh, 0);
  gl.drawBuffers([gl.NONE]); gl.readBuffer(gl.NONE);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);

  var KEY_DIR = vNorm([0.46, 0.80, 0.56]), RIM_DIR = vNorm([-0.74, 0.30, -0.60]);
  var LVP = mMul(mOrtho(-9, 9, -9, 9, 1, 50), mLook([KEY_DIR[0] * 25, KEY_DIR[1] * 25, KEY_DIR[2] * 25], [0, 0, 0], [0, 1, 0]));

  function hudText(str, x, y, px, col, alpha) {
    var cx = x;
    for (var i = 0; i < str.length; i++) {
      var g = GLYPH[str[i]] || GLYPH[' '];
      for (var r = 0; r < 5; r++) for (var c = 0; c < g[r].length; c++) if (g[r][c] === '1') {
        var x0 = cx + c * px, y0 = y + r * px, x1 = x0 + px, y1 = y0 + px;
        var P = [x0, y0, x1, y0, x0, y1, x0, y1, x1, y0, x1, y1], o = hudN * 6;
        for (var k = 0; k < 6; k++) { hudA[o++] = P[k * 2]; hudA[o++] = P[k * 2 + 1]; hudA[o++] = col[0]; hudA[o++] = col[1]; hudA[o++] = col[2]; hudA[o++] = alpha; }
        hudN += 6;
      }
      cx += (g[0].length + 1) * px;
    }
    return cx;
  }
  function renderAt(T) {
    var cs = camState(T), hero = heroState(T);
    var fwd = vNorm(vSub(cs.tgt, cs.eye)), right = vNorm(vCross(fwd, [0, 1, 0])), up = vCross(right, fwd);
    var cam = { fwd: fwd, right: right, up: up };
    var VP0 = mMul(mPersp(cs.fov, W / H, 0.5, 200), mLook(cs.eye, cs.tgt, [0, 1, 0]));
    var VP = anchorFit(VP0), fitK = VP[0] / VP0[0];

    dynB.reset(); glowN = 0;
    buildHero(dynB, hero); buildMachine(dynB, T); buildScreen(dynB, T);
    dynCasters = dynB.n;
    buildAgents(dynB, T, cam);
    buildMotes(T, cam);
    // the machine's slot glows once the core is in; the screen casts a cool light
    var live = FM.ss(27.9, 28.4, T), L = 0.35 + 0.65 * live;
    var fc = [MACH[0], 0.85, MACH[2]];
    halo(fc, 1.6, [0.20 * L, 0.085 * L, 0.035 * L], right, up);
    var on = FM.ss(28.0, 28.35, T), sy = screenY(T);
    if (on > 0) halo([SCR.x, sy, SCR.z + 0.3], 2.6, [0.035 * on, 0.03 * on, 0.09 * on], right, up);
    gl.bindBuffer(gl.ARRAY_BUFFER, bufDyn); gl.bufferSubData(gl.ARRAY_BUFFER, 0, dynB.a.subarray(0, dynB.n * STRIDE));
    gl.bindBuffer(gl.ARRAY_BUFFER, bufGlow); gl.bufferSubData(gl.ARRAY_BUFFER, 0, glowA.subarray(0, glowN * GSTR));

    gl.disable(gl.CULL_FACE); gl.disable(gl.BLEND);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbSh); gl.viewport(0, 0, SHADOW, SHADOW);
    gl.enable(gl.DEPTH_TEST); gl.depthMask(true); gl.clearDepth(1); gl.clear(gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(1.5, 2);
    gl.useProgram(pShadow.p); gl.uniformMatrix4fv(pShadow.u.uLVP, false, LVP);
    gl.bindVertexArray(vaoStatic); gl.drawArrays(gl.TRIANGLES, 0, staticCasters);
    gl.bindVertexArray(vaoDyn); gl.drawArrays(gl.TRIANGLES, 0, dynCasters);
    gl.disable(gl.POLYGON_OFFSET_FILL);

    gl.bindFramebuffer(gl.FRAMEBUFFER, fbScene); gl.viewport(0, 0, FW, FH);
    gl.clear(gl.DEPTH_BUFFER_BIT);
    gl.disable(gl.DEPTH_TEST);
    var th = Math.tan(cs.fov / 2) / fitK, asp = W / H;
    gl.useProgram(pSky.p);
    gl.uniform3fv(pSky.u.uF, fwd); gl.uniform3f(pSky.u.uR, right[0] * th * asp, right[1] * th * asp, right[2] * th * asp);
    gl.uniform3f(pSky.u.uU, up[0] * th, up[1] * th, up[2] * th);
    gl.bindVertexArray(vaoQuad); gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.enable(gl.DEPTH_TEST);
    var u = pScene.u; gl.useProgram(pScene.p);
    gl.uniformMatrix4fv(u.uVP, false, VP); gl.uniformMatrix4fv(u.uLVP, false, LVP);
    gl.uniform3fv(u.uCam, cs.eye); gl.uniform3fv(u.uKeyDir, KEY_DIR); gl.uniform3f(u.uKeyCol, 1.92, 1.57, 1.24);
    gl.uniform3fv(u.uRimDir, RIM_DIR); gl.uniform3f(u.uRimCol, 0.42, 0.52, 1.25);
    gl.uniform3f(u.uPtPos, MACH[0], 1.0, MACH[2] + 0.2);
    gl.uniform3f(u.uPtCol, 3.2 * L, 1.45 * L, 0.6 * L);
    gl.uniform1f(u.uShTex, 7.0 / SHADOW);
    var hs = clamp(1 - hero.y / 0.9, 0, 1);
    gl.uniform4fv(u.uOccA, [hero.x, hero.z, 0.56, 0.30, MACH[0], MACH[2], 0.95, 0.62]);
    gl.uniform4fv(u.uOccB, [Math.cos(hero.yaw), Math.sin(hero.yaw), 0.80 * hs, 0.34 + hero.y * 0.5, 1, 0, 0.85, 0.30]);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, texSh); gl.uniform1i(u.uSh, 0);
    gl.bindVertexArray(vaoStatic); gl.drawArrays(gl.TRIANGLES, 0, staticB.n);
    gl.bindVertexArray(vaoDyn); gl.drawArrays(gl.TRIANGLES, 0, dynB.n);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE); gl.depthMask(false);
    gl.useProgram(pGlow.p); gl.uniformMatrix4fv(pGlow.u.uVP, false, VP);
    gl.bindVertexArray(vaoGlow); gl.drawArrays(gl.TRIANGLES, 0, glowN);
    gl.depthMask(true); gl.disable(gl.BLEND); gl.disable(gl.DEPTH_TEST);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, W, H);
    gl.useProgram(pPost.p); gl.bindTexture(gl.TEXTURE_2D, texScene); gl.uniform1i(pPost.u.uT, 0);
    gl.uniform1i(pPost.u.uSS, SS); gl.uniform2f(pPost.u.uRes, W, H);
    gl.bindVertexArray(vaoQuad); gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.bindVertexArray(null);
    gl.finish();
  }
  return { renderAt: renderAt, isReady: function () { return true; } };
});
