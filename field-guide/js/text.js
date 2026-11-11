/* Fable 5.2: A Field Guide. Fonts (embedded Inter), the glyph atlas for in-scene lettering, text quads, and a faceted
   3D block-letter font (extruded strokes) for the giant "hi", the dial's labels and the sky letters. */
(function (root) {
  'use strict';
  var FG = root.FG, V = FG.v, m = FG.m;

  /* ---------------------------------------------------------------- fonts */
  FG.loadFonts = function () {
    var D = root.FG_FONTS || {}, ps = [];
    Object.keys(D).forEach(function (name) {
      var bin = atob(D[name]), buf = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
      var ff = new FontFace(name, buf.buffer);
      document.fonts.add(ff);
      ps.push(ff.load());
    });
    return Promise.all(ps);
  };

  /* ---------------------------------------------------------------- atlas
     entries: id -> { lines: [...], font, px, align } ; packed into one canvas (alpha = coverage) */
  var AT = { W: 2048, H: 2048, map: {} };
  FG.atlas = AT;
  FG.buildAtlas = function (entries) {
    var cv = document.createElement('canvas'); cv.width = AT.W; cv.height = AT.H;
    var cx = cv.getContext('2d');
    cx.clearRect(0, 0, AT.W, AT.H);
    var x = 4, y = 4, rowH = 0, PAD = 10;
    var ids = Object.keys(entries);
    // tallest first gives a tighter shelf pack
    ids.sort(function (a, b) { var A = entries[a], B = entries[b]; return B.px * B.lines.length - A.px * A.lines.length; });
    ids.forEach(function (id) {
      var e = entries[id], px = e.px || 72, lh = px * (e.lh || 1.12);
      cx.font = (e.weight || '') + ' ' + px + 'px ' + (e.font || 'FGBold');
      var w = 0;
      e.lines.forEach(function (l) { w = Math.max(w, cx.measureText(l).width); });
      var bw = Math.ceil(w + PAD * 2), bh = Math.ceil(lh * e.lines.length + PAD * 2 - (lh - px) + px * 0.28);
      if (x + bw > AT.W) { x = 4; y += rowH + 4; rowH = 0; }
      if (y + bh > AT.H) throw new Error('atlas full at ' + id);
      cx.fillStyle = '#fff'; cx.textBaseline = 'alphabetic';
      e.lines.forEach(function (l, i) {
        var lw = cx.measureText(l).width, al = e.align || 'center';
        var tx = al === 'left' ? x + PAD : al === 'right' ? x + bw - PAD - lw : x + (bw - lw) / 2;
        cx.fillText(l, tx, y + PAD + px * 0.92 + i * lh);
      });
      AT.map[id] = { u0: x / AT.W, v0: y / AT.H, u1: (x + bw) / AT.W, v1: (y + bh) / AT.H, w: bw, h: bh, asp: bw / bh };
      x += bw + 4; rowH = Math.max(rowH, bh);
    });
    return cv;
  };

  /* ---------------------------------------------------------------- text quads: pos3 uv2 col3 light1 */
  function TextBuf(max) { this.a = new Float32Array(max * 6 * 10); this.n = 0; this.cap = max * 6; }
  TextBuf.prototype.reset = function () { this.n = 0; };
  // centre c, unit axes r (reading direction) and u (up), height h (world units of the whole entry box), colour col, light
  TextBuf.prototype.quad = function (id, c, r, u, h, col, light, alpha) {
    var e = AT.map[id]; if (!e) return;
    if (this.n + 6 > this.cap) return;
    var w = h * e.asp, hw = w / 2, hh = h / 2;
    var p00 = [c[0] - r[0] * hw - u[0] * hh, c[1] - r[1] * hw - u[1] * hh, c[2] - r[2] * hw - u[2] * hh];
    var p10 = [c[0] + r[0] * hw - u[0] * hh, c[1] + r[1] * hw - u[1] * hh, c[2] + r[2] * hw - u[2] * hh];
    var p11 = [c[0] + r[0] * hw + u[0] * hh, c[1] + r[1] * hw + u[1] * hh, c[2] + r[2] * hw + u[2] * hh];
    var p01 = [c[0] - r[0] * hw + u[0] * hh, c[1] - r[1] * hw + u[1] * hh, c[2] - r[2] * hw + u[2] * hh];
    var P = [p00, p10, p11, p00, p11, p01], U = [[e.u0, e.v1], [e.u1, e.v1], [e.u1, e.v0], [e.u0, e.v1], [e.u1, e.v0], [e.u0, e.v0]];
    var a = this.a, o = this.n * 10, fa = alpha == null ? 1 : alpha;
    for (var i = 0; i < 6; i++) {
      a[o++] = P[i][0]; a[o++] = P[i][1]; a[o++] = P[i][2]; a[o++] = U[i][0]; a[o++] = U[i][1];
      a[o++] = col[0]; a[o++] = col[1]; a[o++] = col[2]; a[o++] = (light == null ? 1 : light); a[o++] = fa;
    }
    this.n += 6;
    return w;
  };
  // the same, placed with a matrix (local: x right, y up, z out of the face)
  TextBuf.prototype.quadM = function (id, M, lc, h, col, light, alpha) {
    var c = FG.mat.xf(M, lc), r = V.norm(FG.mat.xd(M, [1, 0, 0])), u = V.norm(FG.mat.xd(M, [0, 1, 0]));
    var sx = V.len(FG.mat.xd(M, [0, 1, 0]));
    return this.quad(id, c, r, u, h * sx, col, light, alpha);
  };
  FG.TextBuf = TextBuf;
  FG.textW = function (id, h) { var e = AT.map[id]; return e ? h * e.asp : 0; };

  /* ---------------------------------------------------------------- glow quads: pos3 uv2 col3 (camera-facing) */
  function GlowBuf(max) { this.a = new Float32Array(max * 6 * 8); this.n = 0; this.cap = max * 6; }
  GlowBuf.prototype.reset = function () { this.n = 0; };
  GlowBuf.prototype.halo = function (c, rad, col, cam) {
    if (this.n + 6 > this.cap) return;
    var r = cam.right, u = cam.up, a = this.a, o = this.n * 8;
    var Q = [[-1, -1], [1, -1], [1, 1], [-1, -1], [1, 1], [-1, 1]];
    for (var i = 0; i < 6; i++) {
      var q = Q[i];
      a[o++] = c[0] + (r[0] * q[0] + u[0] * q[1]) * rad; a[o++] = c[1] + (r[1] * q[0] + u[1] * q[1]) * rad; a[o++] = c[2] + (r[2] * q[0] + u[2] * q[1]) * rad;
      a[o++] = q[0]; a[o++] = q[1]; a[o++] = col[0]; a[o++] = col[1]; a[o++] = col[2];
    }
    this.n += 6;
  };
  FG.GlowBuf = GlowBuf;

  /* ---------------------------------------------------------------- faceted block letters
     Each glyph: strokes on a grid (x 0..4, y 0..6; lowercase x-height 4), polylines. Rounded parts are octagonal. */
  var G = {};
  function arc(cx, cy, rx, ry, a0, a1, n) { var p = []; for (var i = 0; i <= n; i++) { var a = (a0 + (a1 - a0) * i / n) * Math.PI / 180; p.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]); } return p; }
  G.h = { w: 3.4, s: [[[0, 0], [0, 7]], [[0, 3.2]].concat(arc(1.7, 2.9, 1.7, 1.3, 180, 0, 5).slice(1)).concat([[3.4, 0]])] };
  G.i = { w: 0, s: [[[0, 0], [0, 4.3]]], dots: [[0, 6.1]] };
  G.L = { w: 3.2, s: [[[0, 6], [0, 0], [3.2, 0]]] };
  G.O = { w: 4, s: [arc(2, 3, 2, 3, 90, 450, 8)] };
  G.W = { w: 5.2, s: [[[0, 6], [1.1, 0], [2.6, 4.2], [4.1, 0], [5.2, 6]]] };
  G.M = { w: 4.6, s: [[[0, 0], [0, 6], [2.3, 2.4], [4.6, 6], [4.6, 0]]] };
  G.E = { w: 3.2, s: [[[3.2, 6], [0, 6], [0, 0], [3.2, 0]], [[0, 3], [2.6, 3]]] };
  G.D = { w: 3.8, s: [[[0, 0], [0, 6], [1.6, 6]].concat(arc(1.6, 3, 2.2, 3, 90, -90, 5).slice(1)).concat([[0, 0]])] };
  G.I = { w: 0, s: [[[0, 0], [0, 6]]] };
  G.U = { w: 3.8, s: [[[0, 6], [0, 2]].concat(arc(1.9, 2, 1.9, 2, 180, 360, 5).slice(1)).concat([[3.8, 6]])] };
  G.H = { w: 3.6, s: [[[0, 0], [0, 6]], [[3.6, 0], [3.6, 6]], [[0, 3], [3.6, 3]]] };
  G.G = { w: 4, s: [arc(2, 3, 2, 3, 40, 340, 7).concat([[4, 2.8], [2.3, 2.8]])] };
  G.X = { w: 4, s: [[[0, 0], [4, 6]], [[0, 6], [4, 0]]] };
  G.A = { w: 4.2, s: [[[0, 0], [2.1, 6], [4.2, 0]], [[0.8, 2.2], [3.4, 2.2]]] };
  G['?'] = { w: 3.4, s: [[[0, 4.6]].concat(arc(1.7, 4.4, 1.7, 1.6, 170, -60, 5).slice(1)).concat([[1.7, 2.6], [1.7, 1.9]])], dots: [[1.7, 0.2]] };
  G['{'] = { w: 2.4, s: [[[2.4, 6.4], [1.4, 6], [1.2, 3.8], [0, 3], [1.2, 2.2], [1.4, 0], [2.4, -0.4]]] };
  G['}'] = { w: 2.4, s: [[[0, 6.4], [1, 6], [1.2, 3.8], [2.4, 3], [1.2, 2.2], [1, 0], [0, -0.4]]] };
  G.K = { w: 3.6, s: [[[0, 0], [0, 6]], [[3.6, 6], [0, 2.4]], [[1.3, 3.5], [3.6, 0]]] };
  G.Q = { w: 4, s: [arc(2, 3, 2, 3, 90, 450, 8), [[2.4, 1.2], [4.1, -0.6]]] };
  G.R = { w: 3.6, s: [[[0, 0], [0, 6], [2, 6]].concat(arc(2, 4.4, 1.6, 1.6, 90, -90, 4).slice(1)).concat([[0, 2.8]]), [[1.6, 2.8], [3.6, 0]]] };
  G.Y = { w: 4, s: [[[0, 6], [2, 3], [4, 6]], [[2, 3], [2, 0]]] };
  G.Z = { w: 3.8, s: [[[0, 6], [3.8, 6], [0, 0], [3.8, 0]]] };
  G['&'] = { w: 4, s: [[[4, 0], [1.2, 3.6]].concat(arc(1.9, 4.8, 1.2, 1.2, 220, -40, 5).slice(1)).concat([[0.6, 2.2]]).concat(arc(1.8, 1.5, 1.4, 1.5, 150, 330, 4).slice(1)).concat([[3.8, 2.4]])] };
  G['@'] = { w: 5, s: [arc(2.5, 3, 2.5, 3, 330, 30 + 360, 9), arc(2.6, 3, 1.1, 1.3, 0, 360, 6)] };
  G['#'] = { w: 4.4, s: [[[1.4, 0], [1.8, 6]], [[2.8, 0], [3.2, 6]], [[0, 2], [4.4, 2]], [[0, 4], [4.4, 4]]] };
  FG.GLYPHS = G;

  // a bar between two points (in the letter plane, z = depth), chamfered prism with 8-sided-ish ends
  function bar(B, a, b, th, dep, col, colTop, emis) {
    var d = [b[0] - a[0], b[1] - a[1]], l = Math.sqrt(d[0] * d[0] + d[1] * d[1]);
    if (l < 1e-6) return;
    var ux = d[0] / l, uy = d[1] / l, nx = -uy, ny = ux, h = th / 2, c = th * 0.28, z = dep / 2;
    // cross-section octagon (in the n/z plane), extended along u by h at each end (so joints overlap)
    var sec = [[-h + c, -z], [h - c, -z], [h, -z + c], [h, z - c], [h - c, z], [-h + c, z], [-h, z - c], [-h, -z + c]];
    var e0 = [a[0] - ux * h * 0.55, a[1] - uy * h * 0.55], e1 = [b[0] + ux * h * 0.55, b[1] + uy * h * 0.55];
    var R0 = sec.map(function (s) { return [e0[0] + nx * s[0], e0[1] + ny * s[0], s[1]]; });
    var R1 = sec.map(function (s) { return [e1[0] + nx * s[0], e1[1] + ny * s[0], s[1]]; });
    var ctr = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, 0];
    for (var i = 0; i < 8; i++) {
      var j = (i + 1) % 8, nz = sec[i][1] + sec[j][1], nn = sec[i][0] + sec[j][0];
      var up = ny * nn > 0.2 * th ? colTop : null;
      B.poly([R0[i], R0[j], R1[j], R1[i]], (nz > dep * 0.9) ? col : (up || col), emis, 0, ctr);
    }
    B.poly(R0, col, emis, 0, ctr); B.poly(R1, col, emis, 0, ctr);
  }
  // build a word: letters left to right in the local XY plane, baseline y=0, height scale s (units per grid unit)
  FG.blockWord = function (B, word, s, opt) {
    opt = opt || {};
    var th = opt.th || 1.15, dep = opt.dep || 1.1, gap = opt.gap || 1.5, col = opt.col, colTop = opt.colTop || col, emis = opt.emis || 0;
    var x = 0, widths = [];
    for (var k = 0; k < word.length; k++) { var g = G[word[k]]; widths.push(g ? g.w : 2); }
    var total = widths.reduce(function (a, b) { return a + b; }, 0) + gap * (word.length - 1);
    x = opt.align === 'left' ? 0 : -total / 2;
    for (k = 0; k < word.length; k++) {
      var gl = G[word[k]];
      if (gl) {
        var lc = typeof col === 'function' ? col(k) : col, lt = typeof colTop === 'function' ? colTop(k) : colTop;
        B.push(FG.mat.scale(s, s, s));
        for (var si = 0; si < gl.s.length; si++) {
          var st = gl.s[si];
          for (var p = 0; p + 1 < st.length; p++) bar(B, [st[p][0] + x, st[p][1]], [st[p + 1][0] + x, st[p + 1][1]], th, dep, lc, lt, emis);
        }
        if (gl.dots) gl.dots.forEach(function (dt) { B.chamfer([dt[0] + x, dt[1], 0], [th * 0.62, th * 0.62, dep / 2], th * 0.25, lc, emis, lt); });
        B.pop();
      }
      x += widths[k] + gap;
    }
    return total * s;
  };
})(typeof window !== 'undefined' ? window : globalThis);
