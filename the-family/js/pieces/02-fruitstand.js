/* The Family — 02 · The Fruit Stand
 * Winter 1945, dusk. Don Vito Corleone buys fruit outside the Genco Pura Olive Oil office; across the wet street
 * two men step off the curb from a dark sedan. Painted in the manner of a 1940s gouache magazine illustration:
 * a ruled perspective street (a small pinhole camera projects every building, car and crate), flat opaque colour
 * masses, warm windows against a cold blue dusk, broken vertical reflections, spatter snow.
 */
(function () {
  'use strict';
  const W = 1080, H = 1350;

  /* ------------------------------------------------------------------ utilities */
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  let R = mulberry32(1);
  const rnd = (a, b) => a + (b - a) * R();
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const HX = {};
  function hx(h) {
    if (HX[h]) return HX[h];
    return (HX[h] = [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]);
  }
  function mix(a, b, t) {
    const A = hx(a), B = hx(b);
    return '#' + A.map((v, i) => clamp(Math.round(v + (B[i] - v) * t), 0, 255).toString(16).padStart(2, '0')).join('');
  }
  function rgba(h, a) { const c = hx(h); return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')'; }

  /* ------------------------------------------------------------------ the camera */
  const CAM = { x: 0.6, y: 1.05, z: 0, yaw: -0.095, F: 1050, cx: 540, hy: 660 };
  let MIR = null; // when set, the world is mirrored in the wet ground at this height (for reflections)
  const CS = Math.cos(CAM.yaw), SN = Math.sin(CAM.yaw), NEAR = 0.4;
  function cam(X, Y, Z) { if (MIR !== null) Y = 2 * MIR - Y; const dx = X - CAM.x, dz = Z - CAM.z; return [dx * CS - dz * SN, Y - CAM.y, dx * SN + dz * CS]; }
  function scr(c) { return [CAM.cx + (CAM.F * c[0]) / c[2], CAM.hy - (CAM.F * c[1]) / c[2]]; }
  function P(X, Y, Z) { return scr(cam(X, Y, Z)); }
  function K(X, Z) { return CAM.F / cam(X, 0, Z)[2]; } // pixels per metre at that spot
  function D(X, Z) { return cam(X, 0, Z)[2]; }
  function proj(pts) { // near-plane clipped projection of a 3-D polygon
    const c = pts.map((p) => cam(p[0], p[1], p[2])), out = [];
    for (let i = 0; i < c.length; i++) {
      const a = c[i], b = c[(i + 1) % c.length], ai = a[2] >= NEAR, bi = b[2] >= NEAR;
      if (ai) out.push(scr(a));
      if (ai !== bi) { const t = (NEAR - a[2]) / (b[2] - a[2]); out.push(scr([lerp(a[0], b[0], t), lerp(a[1], b[1], t), NEAR])); }
    }
    return out;
  }
  // every ruled edge is drawn through a faint, smooth tremor, the way a hand pulls a brush along a ruler
  function warp(x, y) {
    const a = 0.27;
    return [x + a * (Math.sin(y * 0.19 + x * 0.043) + 0.55 * Math.sin(y * 0.51 - x * 0.09 + 1.3)), y + a * (Math.sin(x * 0.17 - y * 0.037 + 0.7) + 0.55 * Math.sin(x * 0.45 + y * 0.11 + 2.1))];
  }
  function path2(pts, close) {
    const p = new Path2D(), n = pts.length, m = close === false ? n - 1 : n;
    if (!n) return p;
    let q = warp(pts[0][0], pts[0][1]); p.moveTo(q[0], q[1]);
    for (let i = 0; i < m; i++) {
      const a = pts[i], b = pts[(i + 1) % n], L = Math.hypot(b[0] - a[0], b[1] - a[1]), k = Math.min(400, Math.max(1, Math.ceil(L / 5)));
      for (let j = 1; j <= k; j++) { q = warp(a[0] + ((b[0] - a[0]) * j) / k, a[1] + ((b[1] - a[1]) * j) / k); p.lineTo(q[0], q[1]); }
    }
    if (close !== false) p.closePath();
    return p;
  }
  function area(pts) { let a = 0; for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; a += p[0] * q[1] - q[0] * p[1]; } return a / 2; }
  function poly3(ctx, pts3, fill) { const p = proj(pts3); if (p.length < 3) return null; ctx.fillStyle = fill; const pa = path2(p); ctx.fill(pa); return pa; }
  function line3(ctx, a, b, col, w) {
    const p = proj([a, b]); if (p.length < 2) return;
    ctx.strokeStyle = col; ctx.lineWidth = w; ctx.stroke(path2(p, false));
  }
  // facade plane helpers: side -1 = left facade (X = XL), +1 = right facade (X = XR). (u = Z along street, v = height, o = outward offset)
  const XL = -4.6, CL = -1.3, CR = 3.6, XR = 6.8, CURB = 0.15;
  function F3(side, u, v, o) { return side < 0 ? [XL + (o || 0), v, u] : [XR - (o || 0), v, u]; }
  function frect(ctx, side, u0, u1, v0, v1, fill, o) { return poly3(ctx, [F3(side, u0, v0, o), F3(side, u1, v0, o), F3(side, u1, v1, o), F3(side, u0, v1, o)], fill); }

  /* ------------------------------------------------------------------ palette */
  const C = {
    skyTop: '#1a2a4c', skyHi: '#2e4876', skyMid: '#4a6e9e', skyLow: '#8eaac2', skyGlow: '#e4b08a',
    haze: '#56687f', hazeWarm: '#8a7f86',
    win: '#ffcf6e', winHot: '#fff0c0', winDeep: '#eb8f2a', winDim: '#c98a3c',
    iron: '#14151b', snow: '#e6edf5', snowShade: '#9fb2c9',
    street: '#232c3a', streetDark: '#161c27', slush: '#7c8a9c', slushLit: '#b5aba0', walk: '#485062', walkDark: '#353b4a',
  };
  function haze(col, z, k) { return mix(col, C.haze, clamp(1 - Math.exp(-z / (k || 60)), 0, 0.82)); }

  /* ------------------------------------------------------------------ a stroke alphabet, lettered by hand */
  const GL = (function () {
    const g = {};
    const arc = (cx, cy, rx, ry, a0, a1, n) => { const o = []; n = n || 14; for (let i = 0; i <= n; i++) { const a = a0 + ((a1 - a0) * i) / n; o.push([cx + rx * Math.cos(a), cy + ry * Math.sin(a)]); } return o; };
    const PI = Math.PI;
    g.A = { w: 0.74, s: [[[0, 1], [0.37, 0], [0.74, 1]], [[0.15, 0.64], [0.59, 0.64]]] };
    g.C = { w: 0.7, s: [arc(0.38, 0.5, 0.38, 0.5, -0.24 * PI, -1.76 * PI, 18)] };
    g.D = { w: 0.7, s: [[[0, 0], [0, 1]], [[0, 0], [0.28, 0]].concat(arc(0.28, 0.5, 0.4, 0.5, -0.5 * PI, 0.5 * PI, 14)).concat([[0, 1]])] };
    g.E = { w: 0.56, s: [[[0.56, 0], [0, 0], [0, 1], [0.56, 1]], [[0, 0.5], [0.44, 0.5]]] };
    g.F = { w: 0.54, s: [[[0.54, 0], [0, 0], [0, 1]], [[0, 0.5], [0.42, 0.5]]] };
    g.G = { w: 0.74, s: [arc(0.38, 0.5, 0.38, 0.5, -0.22 * PI, -1.95 * PI, 18).concat([[0.76, 0.55], [0.44, 0.55]])] };
    g.I = { w: 0.0, s: [[[0, 0], [0, 1]]] };
    g.L = { w: 0.52, s: [[[0, 0], [0, 1], [0.52, 1]]] };
    g.M = { w: 0.84, s: [[[0, 1], [0, 0], [0.42, 0.72], [0.84, 0], [0.84, 1]]] };
    g.N = { w: 0.7, s: [[[0, 1], [0, 0], [0.7, 1], [0.7, 0]]] };
    g.O = { w: 0.8, s: [arc(0.4, 0.5, 0.4, 0.5, 0, 2 * PI, 22)] };
    g.P = { w: 0.6, s: [[[0, 1], [0, 0], [0.32, 0]].concat(arc(0.32, 0.27, 0.28, 0.27, -0.5 * PI, 0.5 * PI, 10)).concat([[0, 0.54]])] };
    g.R = { w: 0.64, s: [[[0, 1], [0, 0], [0.32, 0]].concat(arc(0.32, 0.27, 0.28, 0.27, -0.5 * PI, 0.5 * PI, 10)).concat([[0, 0.54]]), [[0.3, 0.54], [0.64, 1]]] };
    g.S = { w: 0.62, s: [arc(0.32, 0.26, 0.29, 0.25, -0.12 * PI, -1.5 * PI, 12).concat(arc(0.32, 0.75, 0.31, 0.25, -0.5 * PI, 0.88 * PI, 12))] };
    g.T = { w: 0.64, s: [[[0, 0], [0.64, 0]], [[0.32, 0], [0.32, 1]]] };
    g.U = { w: 0.68, s: [[[0, 0]].concat(arc(0.34, 0.66, 0.34, 0.34, PI, 0, 12)).concat([[0.68, 0]])] };
    g.V = { w: 0.72, s: [[[0, 0], [0.36, 1], [0.72, 0]]] };
    g.Z = { w: 0.62, s: [[[0, 0], [0.62, 0], [0, 1], [0.64, 1]]] };
    g.B = { w: 0.6, s: [[[0, 1], [0, 0], [0.3, 0]].concat(arc(0.3, 0.24, 0.25, 0.24, -0.5 * PI, 0.5 * PI, 8)).concat([[0, 0.48], [0.32, 0.48]]).concat(arc(0.32, 0.74, 0.28, 0.26, -0.5 * PI, 0.5 * PI, 8)).concat([[0, 1]])] };
    g.H = { w: 0.66, s: [[[0, 0], [0, 1]], [[0.66, 0], [0.66, 1]], [[0, 0.5], [0.66, 0.5]]] };
    g.K = { w: 0.62, s: [[[0, 0], [0, 1]], [[0.62, 0], [0.02, 0.6]], [[0.2, 0.44], [0.64, 1]]] };
    g.Y = { w: 0.7, s: [[[0, 0], [0.35, 0.5], [0.7, 0]], [[0.35, 0.5], [0.35, 1]]] };
    g.W = { w: 1.0, s: [[[0, 0], [0.24, 1], [0.5, 0.25], [0.76, 1], [1.0, 0]]] };
    g['0'] = { w: 0.58, s: [arc(0.29, 0.5, 0.29, 0.5, 0, 2 * PI, 18)] };
    g['1'] = { w: 0.3, s: [[[0.0, 0.2], [0.26, 0], [0.26, 1]]] };
    g['2'] = { w: 0.58, s: [arc(0.29, 0.29, 0.28, 0.28, -0.92 * PI, 0.18 * PI, 10).concat([[0, 1], [0.6, 1]])] };
    g['3'] = { w: 0.56, s: [arc(0.27, 0.26, 0.27, 0.24, -0.88 * PI, 0.5 * PI, 10).concat(arc(0.27, 0.74, 0.3, 0.26, -0.5 * PI, 0.86 * PI, 10))] };
    g['4'] = { w: 0.6, s: [[[0.46, 1], [0.46, 0], [0, 0.68], [0.62, 0.68]]] };
    g['5'] = { w: 0.58, s: [[[0.56, 0], [0.08, 0], [0.03, 0.44]].concat(arc(0.27, 0.68, 0.31, 0.31, -0.78 * PI, 0.84 * PI, 12))] };
    g['9'] = { w: 0.56, s: [arc(0.28, 0.3, 0.28, 0.3, 0, 2 * PI, 14), [[0.56, 0.3], [0.5, 0.7], [0.3, 1.0], [0.06, 0.96]]] };
    g['¢'] = { w: 0.46, s: [arc(0.24, 0.62, 0.22, 0.27, -0.28 * PI, -1.72 * PI, 12), [[0.25, 0.22], [0.25, 1.04]]] };
    g['.'] = { w: 0.0, s: [[[0, 1], [0, 1.0001]]] };
    g['/'] = { w: 0.4, s: [[[0.4, 0], [0, 1]]] };
    g['-'] = { w: 0.36, s: [[[0, 0.55], [0.36, 0.55]]] };
    g[' '] = { w: 0.32, s: [] };
    return g;
  })();
  // lay out a string; returns strokes in a unit-cap-height box, and total width
  function layout(str, track) {
    track = track === undefined ? 0.2 : track;
    const strokes = []; let x = 0;
    for (const ch of str) {
      const g = GL[ch] || GL[' '];
      for (const s of g.s) strokes.push(s.map((p) => [p[0] + x, p[1]]));
      x += g.w + track;
    }
    return { strokes, w: x - track };
  }
  // draw lettering through a mapping function (u,v) -> screen; the hand wobbles very slightly
  function letter(ctx, str, map, opts) {
    const L = layout(str, opts.track), j = opts.jitter === undefined ? 0.012 : opts.jitter;
    ctx.save();
    ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = opts.color; ctx.lineWidth = opts.width;
    if (opts.shadow) { ctx.shadowColor = opts.shadow; ctx.shadowBlur = opts.shadowBlur || 0; ctx.shadowOffsetX = opts.sx || 0; ctx.shadowOffsetY = opts.sy || 0; }
    for (const s of L.strokes) {
      ctx.beginPath();
      const dj = [rnd(-j, j), rnd(-j, j)];
      for (let i = 0; i < s.length; i++) {
        const t = opts.align === 'center' ? s[i][0] - L.w / 2 : s[i][0];
        const p = map(t + dj[0], s[i][1] + dj[1] * 0.5);
        i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]);
      }
      ctx.stroke();
    }
    ctx.restore();
    return L.w;
  }

  /* ------------------------------------------------------------------ gouache helpers */
  // a soft, opaque "brushed" texture inside a path: a few long strokes a shade lighter and darker, never noise
  function brushed(ctx, pathObj, bbox, col, opts) {
    opts = opts || {};
    const n = opts.n || 10, amt = opts.amt || 0.06, ang = opts.ang || 0, wid = opts.wid || 18;
    ctx.save(); ctx.clip(pathObj);
    for (let i = 0; i < n; i++) {
      const x = rnd(bbox[0], bbox[2]), y = rnd(bbox[1], bbox[3]);
      const len = rnd(0.4, 1.0) * (opts.len || (bbox[2] - bbox[0]));
      ctx.fillStyle = R() < 0.5 ? rgba(mix(col, '#ffffff', 0.5), amt) : rgba(mix(col, '#000000', 0.5), amt);
      ctx.save(); ctx.translate(x, y); ctx.rotate(ang + rnd(-0.06, 0.06));
      ctx.beginPath(); ctx.ellipse(0, 0, len / 2, rnd(0.4, 1) * wid / 2, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }
  function glow(ctx, x, y, r, col, a) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, rgba(col, a)); g.addColorStop(0.35, rgba(col, a * 0.35)); g.addColorStop(1, rgba(col, 0));
    ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  function disc(ctx, x, y, r, col) { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }

  /* ------------------------------------------------------------------ the world: buildings */
  // [z0, z1, height, brick colour, trim colour, ground-floor type, options]
  const LEFT = [
    { z0: -4, z1: 3.6, h: 17.2, brick: '#5d3d38', trim: '#8b7b6a', shop: 'dark', fe: [] },
    { z0: 3.6, z1: 13.4, h: 16.4, brick: '#6a4236', trim: '#a4917a', shop: 'genco', fe: [1, 2], cornice: 'heavy' },
    { z0: 13.4, z1: 20.6, h: 13.6, brick: '#857565', trim: '#b0a48e', shop: 'salumeria', fe: [0, 1] },
    { z0: 20.6, z1: 27, h: 19.6, brick: '#6b4a3a', trim: '#9c8a72', shop: 'barber', fe: [1, 2] },
    { z0: 27, z1: 33.5, h: 13.6, brick: '#6e5a3e', trim: '#a0927a', shop: 'lit', fe: [] },
    { z0: 33.5, z1: 42, h: 16.6, brick: '#644236', trim: '#988673', shop: 'lit', fe: [1] },
    { z0: 42, z1: 50, h: 10.6, brick: '#58463f', trim: '#8a7f73', shop: 'dark', fe: [] },
    { z0: 50, z1: 60, h: 16.6, brick: '#5c4038', trim: '#8a7f73', shop: 'lit', fe: [1] },
    { z0: 60, z1: 72, h: 13.6, brick: '#54443f', trim: '#8a7f73', shop: 'lit', fe: [] },
    { z0: 72, z1: 86, h: 19.6, brick: '#5a4440', trim: '#8a7f73', shop: 'lit', fe: [] },
    { z0: 86, z1: 104, h: 13.6, brick: '#504448', trim: '#8a7f73', shop: 'lit', fe: [] },
  ];
  const RIGHT = [
    { z0: 2, z1: 12.5, h: 16.6, brick: '#4a3c46', trim: '#857a7a', shop: 'caffe', fe: [2] },
    { z0: 12.5, z1: 20.5, h: 16.6, brick: '#523a36', trim: '#8f7f70', shop: 'lit', fe: [1] },
    { z0: 20.5, z1: 28.5, h: 13.6, brick: '#6a6258', trim: '#9a9488', shop: 'pastry', fe: [1], tank: true },
    { z0: 28.5, z1: 37, h: 19.6, brick: '#5a4238', trim: '#96846e', shop: 'lit', fe: [1, 2] },
    { z0: 37, z1: 44, h: 13.6, brick: '#4a4048', trim: '#857e80', shop: 'dark', fe: [] },
    { z0: 44, z1: 54, h: 16.6, brick: '#58403a', trim: '#8a7f73', shop: 'lit', fe: [1], tank: true },
    { z0: 54, z1: 66, h: 13.6, brick: '#4a4048', trim: '#857e80', shop: 'lit', fe: [] },
    { z0: 66, z1: 80, h: 16.6, brick: '#54423e', trim: '#8a7f73', shop: 'lit', fe: [] },
    { z0: 80, z1: 104, h: 13.6, brick: '#4a4048', trim: '#857e80', shop: 'lit', fe: [] },
  ];
  const ZEND = 104; // the cross street, with the El beyond

  function bays(b) { const n = Math.max(2, Math.round((b.z1 - b.z0) / 1.75)), s = (b.z1 - b.z0) / n; const o = []; for (let i = 0; i < n; i++) o.push(b.z0 + s * (i + 0.5)); return o; }

  function drawBuilding(ctx, side, b, litMap) {
    const zm = (b.z0 + b.z1) / 2, hz = (c) => haze(c, zm, side < 0 ? 75 : 60);
    const cold = side > 0 ? 0.12 : 0.04;
    const brick = hz(mix(b.brick, '#2a3654', cold)), trim = hz(mix(b.trim, '#3a4a68', 0.25));
    // wall
    const wp = frect(ctx, side, b.z0, b.z1, 0, b.h, brick);
    const p0 = P(...F3(side, b.z0, 0)), p1 = P(...F3(side, b.z1, b.h));
    if (wp && zm < 40) brushed(ctx, wp, [Math.min(p0[0], p1[0]) - 10, Math.min(p0[1], p1[1]) - 10, Math.max(p0[0], p1[0]) + 10, Math.max(p0[1], p1[1]) + 10], brick, { n: 14, amt: 0.05, ang: Math.PI / 2, wid: 24 });
    // sky light on the upper wall, a darker band at the foot
    const g0 = P(...F3(side, zm, b.h)), g1 = P(...F3(side, zm, 3.6));
    if (wp) {
      const gr = ctx.createLinearGradient(0, g0[1], 0, g1[1]);
      gr.addColorStop(0, rgba('#8da4c8', 0.13)); gr.addColorStop(1, rgba('#8da4c8', 0));
      ctx.fillStyle = gr; ctx.fill(wp);
      if (b.shop !== 'dark') {
        // the shop light climbing the lower wall
        const w0 = P(...F3(side, zm, 3.4)), w1 = P(...F3(side, zm, 9.5));
        const gw = ctx.createLinearGradient(0, w0[1], 0, w1[1]);
        gw.addColorStop(0, rgba('#ffa850', 0.2)); gw.addColorStop(1, rgba('#ffa850', 0));
        ctx.fillStyle = gw; ctx.fill(wp);
      }
    }
    // the wall laid in with opaque strokes of varied brick colour, then a few dry-brush courses
    if (zm < 42) {
      const tints = [mix(brick, '#ffe0c0', 0.16), mix(brick, '#000000', 0.2), mix(brick, '#6a3a5a', 0.22), mix(brick, '#c09048', 0.2), mix(brick, '#3a4a6a', 0.18)];
      const n = Math.round((b.z1 - b.z0) * b.h * 0.85);
      for (let i = 0; i < n; i++) {
        const u = rnd(b.z0, b.z1 - 0.3), v = rnd(3.4, b.h - 0.5), du = rnd(0.35, 1.4), dv = rnd(0.1, 0.32);
        frect(ctx, side, u, Math.min(b.z1, u + du), v, v + dv, rgba(tints[(R() * tints.length) | 0], rnd(0.22, 0.48)), 0.002);
      }
      const m = Math.round((b.z1 - b.z0) * b.h * 0.3);
      for (let i = 0; i < m; i++) {
        const u = rnd(b.z0 + 0.2, b.z1 - 0.6), v = rnd(3.8, b.h - 1.2), len = rnd(0.25, 0.8);
        frect(ctx, side, u, u + len, v, v + 0.05, rgba(R() < 0.55 ? mix(brick, '#ffe8d0', 0.24) : mix(brick, '#000000', 0.32), rnd(0.2, 0.36)), 0.003);
      }
    }
    // windows
    const B = bays(b);
    const floors = Math.floor((b.h - 4.4) / 3.0);
    for (let f = 0; f < floors; f++) {
      const v0 = 4.4 + f * 3.0;
      for (let i = 0; i < B.length; i++) {
        const u = B[i], key = side + ':' + b.z0 + ':' + f + ':' + i;
        const lit = litMap(key, b, f, i);
        drawWindow(ctx, side, u, v0, lit, brick, trim, zm);
      }
    }
    // storefront
    drawShop(ctx, side, b, brick, trim);
    // cornice
    const ch = b.cornice === 'heavy' ? 1.1 : 0.8, co = b.cornice === 'heavy' ? 0.75 : 0.55;
    const cc = hz(mix(b.trim, '#20283a', 0.55)), cu = hz(mix(b.trim, '#141a28', 0.75));
    poly3(ctx, [F3(side, b.z0, b.h - ch), F3(side, b.z1, b.h - ch), F3(side, b.z1, b.h - ch, co), F3(side, b.z0, b.h - ch, co)], cu);
    frect(ctx, side, b.z0, b.z1, b.h - ch, b.h, cc, co);
    frect(ctx, side, b.z0, b.z1, b.h - ch - 0.25, b.h - ch, mix(cc, '#000000', 0.2), co * 0.4);
    // brackets
    if (zm < 60) for (let u = b.z0 + 0.4; u < b.z1 - 0.2; u += 1.1) poly3(ctx, [F3(side, u, b.h - ch - 0.45), F3(side, u + 0.18, b.h - ch - 0.45), F3(side, u + 0.18, b.h - ch, co * 0.9), F3(side, u, b.h - ch, co * 0.9)], mix(cu, '#000000', 0.3));
    // snow on the cornice top: a cool sliver against the sky
    poly3(ctx, [F3(side, b.z0, b.h, co), F3(side, b.z1, b.h, co), F3(side, b.z1, b.h + 0.12, co + 0.05), F3(side, b.z0, b.h + 0.12, co + 0.05)], hz(C.snowShade));
    if (b.tank) drawTank(ctx, side, b, zm);
  }

  function drawWindow(ctx, side, u, v0, lit, brick, trim, zm) {
    const w = 0.5, h = 1.7, vb = v0 + 0.0, hz = (c) => haze(c, zm, 70);
    // lintel and sill
    frect(ctx, side, u - w - 0.1, u + w + 0.1, vb + h, vb + h + 0.28, trim, 0.03);
    frect(ctx, side, u - w - 0.06, u + w + 0.06, vb - 0.12, vb, trim, 0.05);
    // snow banked on the sill and the lintel, laid on thick
    { const pts = [], n = 7, hs = (u * 17.31) % 1;
      for (let i = 0; i <= n; i++) { const t = i / n; pts.push(F3(side, u - w - 0.08 + t * (2 * w + 0.16), vb + 0.03 + 0.07 * Math.sin(Math.PI * t) * (0.7 + 0.3 * Math.sin(t * 9 + hs * 6)), 0.04)); }
      pts.push(F3(side, u + w + 0.08, vb - 0.01, 0.07), F3(side, u - w - 0.08, vb - 0.01, 0.07));
      poly3(ctx, pts, hz(C.snow));
      poly3(ctx, [F3(side, u - w - 0.1, vb + h + 0.28, 0.03), F3(side, u + w + 0.1, vb + h + 0.28, 0.03), F3(side, u + w + 0.05, vb + h + 0.35, 0.02), F3(side, u - w - 0.05, vb + h + 0.36, 0.02)], hz(mix(C.snow, C.snowShade, 0.3))); }
    // the opening
    let glass;
    if (lit) {
      const tone = lit === 2 ? C.winHot : lit === 3 ? C.winDim : C.win;
      glass = hz(mix(tone, '#ffb050', 0.1));
    } else glass = hz(mix('#2a3550', '#0d1220', 0.3 + 0.4 * ((u * 7.3) % 1)));
    frect(ctx, side, u - w, u + w, vb, vb + h, glass);
    if (lit) {
      // drawn shade and curtains, the warm edge
      const shade = mix(glass, '#b06a28', 0.45);
      frect(ctx, side, u - w, u + w, vb + h * (0.55 + 0.35 * ((u * 3.1) % 1)), vb + h, shade);
      frect(ctx, side, u - w, u - w + 0.16, vb, vb + h, mix(glass, '#a04a28', 0.35));
      frect(ctx, side, u + w - 0.16, u + w, vb, vb + h, mix(glass, '#a04a28', 0.35));
      // life inside: a figure, a wreath, a plant, a lamp
      const hsh = Math.abs(Math.sin(u * 12.9898 + v0 * 78.233) * 43758.5453) % 1, kk = K(side < 0 ? XL : XR, u);
      const dk = mix(glass, '#3a1a0a', 0.72);
      if (kk <= 0 || u < 3) { /* behind us */ } else if (zm < 50 && hsh < 0.3) {
        const q = P(...F3(side, u + (hsh - 0.15) * 2, vb + 0.95, -0.25));
        ctx.fillStyle = dk; ctx.beginPath(); ctx.ellipse(q[0], q[1] - 0.2 * kk, 0.1 * kk, 0.13 * kk, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(q[0], q[1] + 0.12 * kk, 0.24 * kk, 0.2 * kk, 0, Math.PI, 0); ctx.fill(); ctx.fillRect(q[0] - 0.24 * kk, q[1] + 0.12 * kk, 0.48 * kk, 0.5 * kk);
      } else if (zm < 50 && hsh < 0.45) {
        const q = P(...F3(side, u, vb + h * 0.72, 0.02));
        ctx.strokeStyle = '#1f4a2a'; ctx.lineWidth = Math.max(0.6, 0.07 * kk); ctx.beginPath(); ctx.ellipse(q[0], q[1], 0.16 * kk * 0.7, 0.16 * kk, 0, 0, Math.PI * 2); ctx.stroke();
        disc(ctx, q[0], q[1] + 0.15 * kk, Math.max(0.6, 0.045 * kk), '#b8201a');
      } else if (zm < 50 && hsh < 0.6) {
        const q = P(...F3(side, u, vb + 0.1, 0.02));
        ctx.fillStyle = '#2a3a1e'; ctx.beginPath(); ctx.ellipse(q[0], q[1] - 0.16 * kk, 0.2 * kk * 0.7, 0.18 * kk, 0, 0, Math.PI * 2); ctx.fill();
      }
    } else {
      // a cold sky reflection in the upper pane
      frect(ctx, side, u - w, u + w, vb + h * 0.62, vb + h, hz(mix(glass, '#4a6890', 0.35)));
    }
    // sash
    frect(ctx, side, u - w, u + w, vb + h * 0.5 - 0.03, vb + h * 0.5 + 0.03, mix(brick, '#000000', 0.35));
    // the visible reveal (the jamb on the far side of the opening, and the head)
    const far = side < 0 ? u + w : u + w; // the jamb facing the camera is always the deeper one
    poly3(ctx, [F3(side, far, vb, 0), F3(side, far, vb + h, 0), F3(side, far - 0.12, vb + h, -0.14), F3(side, far - 0.12, vb, -0.14)], mix(brick, '#000000', 0.45));
    if (vb + h > CAM.y) poly3(ctx, [F3(side, u - w, vb + h, 0), F3(side, u + w, vb + h, 0), F3(side, u + w, vb + h, -0.14), F3(side, u - w, vb + h, -0.14)], mix(brick, '#000000', 0.55));
  }

  function drawTank(ctx, side, b, zm) {
    const u = (b.z0 + b.z1) / 2, o = -3.2, y0 = b.h + 1.6, hh = 3.0, rr = 1.4;
    const col = haze('#2b2f3e', zm, 50);
    // legs
    for (const du of [-1.1, 1.1]) line3(ctx, F3(side, u + du, b.h, o), F3(side, u + du, y0, o), col, 1.2);
    const a = P(...F3(side, u - rr, y0, o)), bb = P(...F3(side, u + rr, y0, o)), t = P(...F3(side, u, y0 + hh + 1.0, o));
    const top = P(...F3(side, u, y0 + hh, o));
    ctx.fillStyle = col; ctx.beginPath();
    ctx.moveTo(a[0], a[1]); ctx.lineTo(bb[0], bb[1]); ctx.lineTo(bb[0], top[1]); ctx.lineTo(t[0], t[1]); ctx.lineTo(a[0], top[1]); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = rgba('#8090a8', 0.4); ctx.lineWidth = 0.6;
    for (let k = 1; k < 4; k++) { const yy = lerp(a[1], top[1], k / 4); ctx.beginPath(); ctx.moveTo(a[0], yy); ctx.lineTo(bb[0], yy); ctx.stroke(); }
    ctx.fillStyle = rgba(C.snowShade, 0.6); ctx.beginPath(); ctx.moveTo(a[0] + 1, top[1]); ctx.lineTo(t[0], t[1]); ctx.lineTo(t[0] + 1, t[1] + 1.5); ctx.lineTo(a[0] + 3, top[1] + 1); ctx.fill();
  }

  /* -------- fire escapes: iron balconies one bay wide, stairs between */
  function drawFireEscape(ctx, side, b, bayIdx) {
    const B = bays(b), floors = Math.floor((b.h - 4.4) / 3.0);
    if (bayIdx >= B.length - 1) bayIdx = B.length - 2;
    const u0 = B[bayIdx] - 0.75, u1 = B[bayIdx + 1] + 0.75, o = 1.05, zm = (u0 + u1) / 2;
    const col = haze(C.iron, zm, 80), lw = Math.max(0.5, K(side < 0 ? XL : XR, zm) * 0.035);
    for (let f = 0; f < floors; f++) {
      const v = 4.4 + f * 3.0 - 0.15;
      // the platform slab seen from below (slatted), then railing
      if (v > CAM.y) { poly3(ctx, [F3(side, u0, v, 0), F3(side, u1, v, 0), F3(side, u1, v, o), F3(side, u0, v, o)], rgba(col, 0.3)); for (let oo = 0.12; oo < o; oo += 0.13) line3(ctx, F3(side, u0, v, oo), F3(side, u1, v, oo), rgba(col, 0.9), lw * 0.7); }
      line3(ctx, F3(side, u0, v, o), F3(side, u1, v, o), col, lw * 1.6);
      line3(ctx, F3(side, u0, v + 0.95, o), F3(side, u1, v + 0.95, o), col, lw * 1.2);
      line3(ctx, F3(side, u0, v + 0.95, o), F3(side, u0, v + 0.95, 0), col, lw);
      line3(ctx, F3(side, u1, v + 0.95, o), F3(side, u1, v + 0.95, 0), col, lw);
      for (let uu = u0; uu <= u1 + 0.01; uu += 0.32) line3(ctx, F3(side, uu, v, o), F3(side, uu, v + 0.95, o), col, lw * 0.55);
      // snow on the rail and on the platform lip
      line3(ctx, F3(side, u0, v + 0.98, o), F3(side, u1, v + 0.98, o), haze(C.snow, zm, 60), lw * 2.2);
      line3(ctx, F3(side, u0, v + 0.03, o), F3(side, u1, v + 0.03, o), haze(mix(C.snow, C.snowShade, 0.4), zm, 60), lw * 2.4);
      // stairs down to the next platform
      if (f > 0) {
        const vl = v - 3.0;
        const sa = F3(side, u0 + 0.3, vl, o - 0.35), sb = F3(side, u1 - 0.7, v, o - 0.35);
        line3(ctx, sa, sb, col, lw * 1.3);
        line3(ctx, [sa[0], sa[1] + 0.85, sa[2]], [sb[0], sb[1] + 0.85, sb[2]], col, lw);
        for (let k = 1; k < 10; k++) { const t = k / 10; const pa = [lerp(sa[0], sb[0], t), lerp(sa[1], sb[1], t), lerp(sa[2], sb[2], t)]; line3(ctx, pa, [pa[0], pa[1] + 0.85, pa[2]], col, lw * 0.5); }
      }
    }
    // drop ladder from the lowest platform
    const v = 4.4 - 0.15;
    line3(ctx, F3(side, u1 - 0.3, v, o - 0.2), F3(side, u1 - 0.3, v - 1.6, o - 0.2), col, lw);
    line3(ctx, F3(side, u1 - 0.75, v, o - 0.2), F3(side, u1 - 0.75, v - 1.6, o - 0.2), col, lw);
    for (let k = 0; k < 6; k++) line3(ctx, F3(side, u1 - 0.75, v - 0.25 * k, o - 0.2), F3(side, u1 - 0.3, v - 0.25 * k, o - 0.2), col, lw * 0.6);
  }

  /* -------- storefronts */
  function drawShop(ctx, side, b, brick, trim) {
    const zm = (b.z0 + b.z1) / 2, hz = (c) => haze(c, zm, 90), base = CURB;
    const pil = hz('#1d2026');
    // the shop band
    if (b.shop === 'dark') {
      frect(ctx, side, b.z0 + 0.3, b.z1 - 0.3, base + 0.5, 3.0, hz('#1a2030'));
      frect(ctx, side, b.z0 + 0.3, b.z1 - 0.3, 3.0, 3.5, hz(mix(brick, '#000000', 0.3)));
      return;
    }
    const interior = b.shop === 'genco' ? '#f6c46a' : b.shop === 'salumeria' ? '#f3c060' : b.shop === 'pastry' ? '#ffd9a0' : b.shop === 'caffe' ? '#f0a85a' : b.shop === 'barber' ? '#e8e0b0' : '#f2b860';
    const glassC = hz(interior);
    // bulkhead
    frect(ctx, side, b.z0 + 0.25, b.z1 - 0.25, base, base + 0.55, hz('#2a2420'));
    // window
    const wz0 = b.z0 + (b.shop === 'barber' ? 2.1 : 0.35), wz1 = b.z1 - (b.shop === 'genco' ? 2.3 : 1.5);
    frect(ctx, side, wz0, wz1, base + 0.55, 2.95, glassC);
    // deeper interior shapes: shelves / goods
    shopGoods(ctx, side, b, wz0, wz1, glassC, zm);
    // mullions
    for (let u = wz0; u <= wz1 + 0.01; u += (wz1 - wz0) / 3) frect(ctx, side, u - 0.04, u + 0.04, base + 0.55, 2.95, pil);
    frect(ctx, side, wz0, wz1, 2.45, 2.52, pil);
    // door
    const dz0 = wz1 + 0.25, dz1 = b.z1 - 0.3;
    frect(ctx, side, dz0, dz1, base, 2.95, hz('#2c2018'));
    frect(ctx, side, dz0 + 0.12, dz1 - 0.12, base + 0.9, 2.6, hz(mix(interior, '#7a4a20', 0.35)));
    if (b.shop === 'barber') {
      // a patch of wall with posters pasted over posters, and the barber's pole
      frect(ctx, side, b.z0 + 0.3, wz0 - 0.1, base + 0.55, 2.95, mix(brick, '#000000', 0.15));
      posters(ctx, side, b.z0 + 0.45, wz0 - 0.25);
      const pz = wz0 - 0.12, pb = P(...F3(side, pz, 2.0, 0.25)), pt = P(...F3(side, pz, 2.8, 0.25)), pk = K(side < 0 ? XL : XR, pz);
      ctx.save(); ctx.fillStyle = '#f2ece0'; ctx.fillRect(pb[0] - 0.06 * pk, pt[1], 0.12 * pk, pb[1] - pt[1]);
      ctx.beginPath(); ctx.rect(pb[0] - 0.06 * pk, pt[1], 0.12 * pk, pb[1] - pt[1]); ctx.clip();
      for (let yy = pt[1] - 0.2 * pk; yy < pb[1]; yy += 0.12 * pk) { ctx.fillStyle = ((yy / pk * 8) | 0) % 2 ? '#b01e1a' : '#1e3a8a'; ctx.beginPath(); ctx.moveTo(pb[0] - 0.06 * pk, yy); ctx.lineTo(pb[0] + 0.06 * pk, yy - 0.08 * pk); ctx.lineTo(pb[0] + 0.06 * pk, yy - 0.04 * pk); ctx.lineTo(pb[0] - 0.06 * pk, yy + 0.04 * pk); ctx.fill(); }
      ctx.restore();
    }
    // pilasters
    frect(ctx, side, b.z0, b.z0 + 0.3, 0, 3.6, pil, 0.06);
    frect(ctx, side, b.z1 - 0.3, b.z1, 0, 3.6, pil, 0.06);
    // sign band
    const sb = hz(b.shop === 'genco' ? '#1f3a2c' : b.shop === 'salumeria' ? '#e7dcc0' : b.shop === 'caffe' ? '#2a1f1c' : b.shop === 'pastry' ? '#5a2430' : '#24262e');
    frect(ctx, side, b.z0 + 0.3, b.z1 - 0.3, 2.98, 3.6, sb, 0.04);
    frect(ctx, side, b.z0 + 0.3, b.z1 - 0.3, 3.55, 3.65, hz(trim), 0.08);
  }

  function posters(ctx, side, z0, z1) {
    const zm = (z0 + z1) / 2, k = K(side < 0 ? XL : XR, zm), mid = lerp(z0, z1, 0.52);
    const map = (ua, ub, va, vb) => (u, v) => P(...F3(side, lerp(ua, ub, u), lerp(va, vb, v), 0.012));
    frect(ctx, side, z0, mid + 0.05, 0.75, 2.35, '#e8dcbc', 0.01);
    frect(ctx, side, z0 + 0.05, mid, 1.85, 2.25, '#a8241c', 0.011);
    let L = layout('OPERA', 0.2); letter(ctx, 'OPERA', (u, v) => map(z0 + 0.08, mid - 0.05, 2.2, 1.9)(u / L.w, v), { color: '#f2e6c8', width: Math.max(0.5, 0.035 * k), track: 0.2, jitter: 0.01 });
    for (let i = 0; i < 6; i++) frect(ctx, side, z0 + 0.08, mid - 0.08 - (i % 3) * 0.08, 1.7 - i * 0.14, 1.66 - i * 0.14, 'rgba(60,40,30,0.55)', 0.012);
    frect(ctx, side, mid - 0.05, z1, 0.95, 2.6, '#2c4a76', 0.014);
    L = layout('PRIZE', 0.2); letter(ctx, 'PRIZE', (u, v) => map(mid + 0.02, z1 - 0.06, 2.5, 2.22)(u / L.w, v), { color: '#f0d870', width: Math.max(0.5, 0.035 * k), track: 0.2, jitter: 0.01 });
    L = layout('FIGHT', 0.2); letter(ctx, 'FIGHT', (u, v) => map(mid + 0.02, z1 - 0.06, 2.15, 1.87)(u / L.w, v), { color: '#f0d870', width: Math.max(0.5, 0.035 * k), track: 0.2, jitter: 0.01 });
    frect(ctx, side, mid + 0.08, z1 - 0.08, 1.15, 1.7, '#e6d8b6', 0.015);
    // a torn corner, and snow-wet streaks
    poly3(ctx, [F3(side, z1 - 0.32, 0.95, 0.016), F3(side, z1, 0.95, 0.016), F3(side, z1, 1.3, 0.016)], '#3a2c28');
  }
  function shopGoods(ctx, side, b, wz0, wz1, glassC, zm) {
    const dark = mix(glassC, '#5a3010', 0.55), mid = mix(glassC, '#9a5a20', 0.35);
    if (b.shop === 'salumeria') {
      // hanging provolone and salami along the top of the window
      for (let u = wz0 + 0.2; u < wz1 - 0.1; u += 0.28) {
        const t = P(...F3(side, u, 2.85, -0.3)), k = K(side < 0 ? XL : XR, u);
        const len = (0.35 + ((u * 13.7) % 1) * 0.35) * k, wid = 0.09 * k;
        ctx.strokeStyle = rgba('#3a2010', 0.6); ctx.lineWidth = Math.max(0.4, k * 0.008); ctx.beginPath(); ctx.moveTo(t[0], t[1]); ctx.lineTo(t[0], t[1] + 0.08 * k); ctx.stroke();
        ctx.fillStyle = ((u * 7) % 1) < 0.5 ? '#9a4a2a' : '#d9a040';
        ctx.beginPath(); ctx.ellipse(t[0], t[1] + 0.08 * k + len / 2, wid / 2, len / 2, 0, 0, Math.PI * 2); ctx.fill();
      }
      for (let u = wz0 + 0.3; u < wz1; u += 0.5) { const p = P(...F3(side, u, 1.0, -0.4)), k = K(XL, u); ctx.fillStyle = '#e8c77a'; ctx.beginPath(); ctx.ellipse(p[0], p[1], 0.18 * k * 0.4, 0.1 * k, 0, 0, Math.PI * 2); ctx.fill(); }
    } else if (b.shop === 'genco') {
      // tins of oil on shelves
      for (const sv of [1.15, 1.75, 2.35]) {
        frect(ctx, side, wz0, wz1, sv - 0.04, sv, mid, -0.4);
        for (let u = wz0 + 0.1; u < wz1 - 0.1; u += 0.2) {
          const c = ((u * 11.3) % 1) < 0.5 ? '#3c6a3a' : '#b8862a';
          frect(ctx, side, u, u + 0.14, sv, sv + 0.32, mix(c, glassC, 0.25), -0.4);
          frect(ctx, side, u, u + 0.14, sv + 0.1, sv + 0.2, mix('#e8d8a0', glassC, 0.3), -0.39);
        }
      }
    } else if (b.shop === 'pastry') {
      for (let u = wz0 + 0.3; u < wz1; u += 0.6) { frect(ctx, side, u, u + 0.4, 1.0, 1.25, mix('#fff4dc', glassC, 0.2), -0.3); frect(ctx, side, u + 0.05, u + 0.35, 1.25, 1.45, mix('#e0a0a8', glassC, 0.2), -0.3); }
      for (let u = wz0 + 0.5; u < wz1; u += 1.3) { const p = P(...F3(side, u, 2.5, -0.3)), k = K(side < 0 ? XL : XR, u); disc(ctx, p[0], p[1], 0.12 * k, mix('#fff8e8', glassC, 0.3)); }
    } else if (b.shop === 'barber') {
      frect(ctx, side, wz0 + 0.2, wz1 - 0.2, 1.7, 2.6, mix(glassC, '#ffffff', 0.25), -0.5);
    } else if (b.shop === 'caffe') {
      // the back bar: a mirror, bottles, the tall espresso urn; men at the counter
      frect(ctx, side, wz0 + 0.2, wz1 - 0.2, 1.75, 2.55, mix(glassC, '#fff0d0', 0.35), -1.2);
      for (let u = wz0 + 0.25; u < wz1 - 0.2; u += 0.13) frect(ctx, side, u, u + 0.06, 1.5, 1.5 + 0.18 + ((u * 9.1) % 1) * 0.14, mix(((u * 5.3) % 1) < 0.5 ? '#3a5a2a' : '#6a2a1a', glassC, 0.35), -1.1);
      frect(ctx, side, wz0 + 0.1, wz1 - 0.1, 1.45, 1.5, dark, -1.1);
      const uu = wz0 + (wz1 - wz0) * 0.62;
      frect(ctx, side, uu, uu + 0.32, 1.5, 2.25, '#c88a3a', -1.0); frect(ctx, side, uu + 0.05, uu + 0.12, 1.55, 2.2, '#ffe2a0', -0.99);
      frect(ctx, side, wz0 + 0.05, wz1 - 0.05, base0(), 1.15, mix(glassC, '#3a1a0a', 0.7), -0.6);
      for (const t of [0.18, 0.42, 0.8]) { const u = lerp(wz0, wz1, t), q = P(...F3(side, u, 1.35, -0.7)), k = K(side < 0 ? XL : XR, u); ctx.fillStyle = mix(glassC, '#2a1408', 0.8); ctx.beginPath(); ctx.ellipse(q[0], q[1] - 0.2 * k, 0.09 * k, 0.11 * k, 0, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.ellipse(q[0], q[1] + 0.06 * k, 0.2 * k, 0.17 * k, 0, Math.PI, 0); ctx.fill(); ctx.fillRect(q[0] - 0.2 * k, q[1] + 0.06 * k, 0.4 * k, 0.22 * k); }
    } else {
      // shelves of tins and jars, a counter, a lamp
      for (const sv of [1.3, 1.95, 2.55]) {
        frect(ctx, side, wz0, wz1, sv - 0.03, sv, mid, -0.6);
        for (let u = wz0 + 0.06; u < wz1 - 0.12; u += 0.15) { const hh = 0.18 + ((u * 7.7) % 1) * 0.16, c = ['#5a3a20', '#7a5a2a', '#4a4a30', '#8a3a20'][Math.floor((u * 3.3) % 4)]; frect(ctx, side, u, u + 0.1, sv, sv + hh, mix(c, glassC, 0.45), -0.6); }
      }
      frect(ctx, side, wz0, wz1, base0(), 1.05, mix(glassC, '#4a2a10', 0.6), -0.4);
    }
  }
  function base0() { return CURB + 0.55; }


  /* ------------------------------------------------------------------ ground */
  function groundPoly(x0, x1, y, z0, z1) { return [[x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1]]; }

  /* ------------------------------------------------------------------ figures: hand-drawn silhouettes in centimetres (feet at 0,0) */
  const PCACHE = {};
  const p2 = (d) => PCACHE[d] || (PCACHE[d] = new Path2D(d));
  const ell = (cx, cy, rx, ry) => 'M ' + (cx - rx) + ' ' + cy + ' A ' + rx + ' ' + ry + ' 0 1 0 ' + (cx + rx) + ' ' + cy + ' A ' + rx + ' ' + ry + ' 0 1 0 ' + (cx - rx) + ' ' + cy + ' Z';
  const FIG = {
    don: {
      rim: { dx: -1.4, dy: 0.2, col: 'rim', of: ['arm', 'coat', 'crown', 'brim'] },
      s: [
        ['legL', 'M -18 -54 C -17 -32 -16 -14 -16 -5 L -6 -5 C -6 -22 -5 -40 -4 -54 Z', 'trou'],
        ['legR', 'M 5 -54 C 6 -38 7 -18 7 -5 L 17 -4 C 17 -20 17 -38 18 -54 Z', 'trou'],
        ['shoeL', 'M -20 0 C -21 -4 -16 -7 -6 -6 L -5 -1 C -9 1 -16 1 -20 0 Z', 'shoe'],
        ['shoeR', 'M 5 -1 C 5 -5 12 -7 18 -5 C 20 -3 20 0 18 0 Z', 'shoe'],
        ['shoeLt', 'M -19 -2.5 C -17 -5.5 -12 -6.2 -8 -5.6 L -8.4 -4.6 C -12 -5 -16 -4.4 -19 -2.5 Z', 'shoeLt'],
        ['cuffL', 'M -16.5 -9 L -6 -9 L -6 -6 L -16.5 -5.5 Z', 'trouDk'],
        ['cuffR', 'M 7 -9 L 17 -8.5 L 17 -5 L 7 -5.5 Z', 'trouDk'],
        ['arm', 'M -17 -139 C -30 -132 -39 -122 -46 -113 C -49 -109 -46 -104 -42 -106 C -35 -112 -28 -118 -20 -121 Z', 'coat'],
        ['hand', 'M -47 -113 C -52 -112 -55 -107 -52 -103 C -49 -101 -44 -103 -43 -107 Z', 'skin'],
        ['coat', 'M -22 -140 C -26 -128 -27 -112 -26 -98 C -27 -80 -29 -64 -31 -48 C -16 -44 12 -44 30 -47 C 29 -66 28 -84 28 -100 C 29 -114 28 -128 24 -138 C 18 -146 6 -149 -4 -149 C -12 -148 -18 -145 -22 -140 Z', 'coat'],
        ['coatLit', 'M -22 -140 C -26 -128 -27 -112 -26 -98 C -27 -80 -29 -64 -31 -48 L -26 -47 C -24 -64 -23 -82 -22 -98 C -22 -114 -20 -128 -15 -144 Z', 'coatLit'],
        ['armLit', 'M -17 -139 C -30 -132 -39 -122 -46 -113 L -45 -110 C -38 -118 -30 -126 -19 -134 Z', 'coatLit'],
        ['blade', 'M 6 -141 C 15 -142 22 -138 25 -130 C 22 -128 16 -127 10 -128 C 10 -133 9 -137 6 -141 Z', 'coatMid'],
        ['sideSh', 'M 17 -110 C 21 -90 23 -70 25 -47 L 30 -47 C 29 -66 28 -84 28 -100 C 28 -106 26 -110 23 -113 Z', 'coatDk'],
        ['fold2', 'M -6 -96 C -8 -80 -10 -64 -13 -45.5 L -9.5 -45 C -7.5 -62 -5.5 -80 -4 -96 Z', 'coatDk'],
        ['fold3', 'M 10 -95 C 11 -80 12 -64 13 -46 L 16 -46.5 C 15 -64 14 -80 13 -95 Z', 'coatDk'],
        ['hem', 'M -31 -48 C -16 -44 12 -44 30 -47 L 30 -49.5 C 12 -46.5 -16 -46.5 -30.6 -50.6 Z', 'coatBounce'],
        ['belt', 'M -15 -101 C -5 -100 6 -100 17 -101 L 17 -97 C 6 -96 -5 -96 -15 -97 Z', 'coatDk'],
        ['btn', ell(-12, -99, 1.3, 1.3), 'coatLit'],
        ['vent', 'M 1 -96 L 2.2 -49 L 0.4 -49 L -0.4 -96 Z', 'coatDk'],
        ['collar', 'M -13 -146 C -11 -154 9 -155 13 -148 C 7 -145 -6 -144 -13 -146 Z', 'collar'],
        ['scarf', 'M -11.5 -147.5 C -10 -152 -3 -152.5 1 -151 L 0 -147 C -4 -146.8 -8.5 -146.6 -11.5 -147.5 Z', 'scarf'],
        ['head', 'M 5 -148 C 9 -151 10.5 -157 9 -163 C 6 -167 -4 -168 -9 -165 C -10.5 -163 -11 -161.5 -11.5 -160 C -12.6 -158.8 -14.4 -157 -15.4 -155.6 C -14.6 -154.8 -13.2 -154.6 -12.4 -154.2 C -12.8 -153 -12.6 -152.2 -12 -151.6 C -12.6 -150.6 -12.4 -149.4 -11 -148.6 C -8 -147.6 -4 -147.2 0 -146.6 Z', 'skin'],
        ['nape', 'M 5 -148 C 9 -151 10.5 -157 9 -163 C 6 -166 1 -166.5 -2 -166 C 0 -161 0 -153 -1.5 -147 Z', 'skinDk'],
        ['hair', 'M 1 -164.5 C 6 -165 9.5 -162 9.8 -158 C 9.5 -155 8 -152.5 6 -151 C 5.5 -155 4 -159 1 -164.5 Z', 'hair'],
        ['ear', 'M 1.2 -161.5 C -1.6 -161 -2 -156 0.8 -155 C 2 -156.8 2.2 -159.6 1.2 -161.5 Z', 'skinDk'],
        ['brow', 'M -10.6 -161.6 C -8.6 -162.4 -6.6 -162.2 -5.2 -161.4 L -5.6 -160.6 C -7.2 -161.2 -8.8 -161.2 -10.4 -160.8 Z', 'hairDk'],
        ['eye', 'M -9.4 -159.6 C -8.4 -160 -7.4 -159.8 -7 -159.2 C -7.8 -158.8 -8.8 -158.9 -9.4 -159.6 Z', 'hairDk'],
        ['stache', 'M -12.6 -154 C -11 -154.4 -9 -154 -8 -153 C -9.6 -152.6 -11.4 -152.8 -12.4 -153.2 Z', 'hair'],
        ['crown', 'M -10 -165 C -11 -172 -9 -180 -3 -183 C 1 -181 4 -181 7 -183 C 12 -180 12 -172 11 -165 Z', 'hat'],
        ['crownLit', 'M -10 -165 C -11 -172 -9 -180 -3 -183 L -2 -181 C -6 -177 -7 -171 -6 -165 Z', 'hatLit'],
        ['band', 'M -11.5 -168.5 L 11.5 -168.5 L 11.2 -165 L -11.2 -165 Z', 'band'],
        ['brim', 'M -22 -162.5 C -15 -168.5 13 -170.5 19 -166 C 15 -162.5 -14 -160 -22 -162.5 Z', 'hat'],
        ['brimTop', 'M -22 -162.5 C -15 -168.5 13 -170.5 19 -166 C 13 -167.8 -13 -166.5 -22 -162.5 Z', 'hatTop'],
        ['brimLit', 'M -22 -162.5 C -18 -161.2 -12 -160.8 -6 -161 L -6 -162 C -12 -162 -17 -162.2 -22 -162.5 Z', 'hatLit'],
        ['shTop', 'M -21 -141 C -14 -147 8 -150 23 -139 C 12 -143.5 -8 -144.5 -21 -141 Z', 'coatTop'],
      ],
    },
    vendor: {
      rim: null,
      s: [
        ['armL', 'M -19 -139 C -26 -134 -32 -126 -33 -117 C -32 -113 -28 -114 -27 -118 C -26 -124 -24 -129 -21 -133 Z', 'sw'],
        ['foreL', 'M -33.5 -119 C -33.5 -126 -32.5 -134 -30.5 -141 L -25.5 -140 C -26.5 -133 -27.5 -125 -27.5 -117 Z', 'sw'],
        ['handL', 'M -32 -140.5 C -35.5 -146 -34 -153 -30 -153 C -27 -152 -25 -147 -25.5 -140.5 Z', 'skin'],
        ['legL', 'M -15 -94 C -15 -60 -14 -30 -14 -5 L -4 -5 C -4 -30 -3 -60 -2 -94 Z', 'trou'],
        ['legR', 'M 3 -94 C 4 -60 5 -30 6 -5 L 16 -5 C 15 -30 15 -60 15 -94 Z', 'trou'],
        ['shoeL', 'M -18 0 C -18 -4 -12 -6 -4 -5 L -3 0 Z', 'shoe'],
        ['shoeR', 'M 5 0 C 5 -4 12 -6 20 -4.5 L 21 0 Z', 'shoe'],
        ['torso', 'M -22 -140 C -24 -128 -24 -112 -22 -92 L 22 -92 C 23 -112 23 -128 21 -140 C 14 -146 -14 -146 -22 -140 Z', 'sw'],
        ['torsoLit', 'M 10 -142 C 18 -138 22 -126 22 -92 L 14 -92 C 15 -112 14 -128 10 -142 Z', 'swLit'],
        ['apron', 'M -11 -138 L 10 -138 L 15 -92 L -15 -92 Z', 'apron'],
        ['apronSh', 'M -11 -138 L -6 -138 L -9 -92 L -15 -92 Z', 'apronSh'],
        ['apronLo', 'M -18 -96 L 18 -96 C 19 -80 20 -64 21 -48 C 8 -45 -8 -45 -20 -48 C -19.5 -64 -19 -80 -18 -96 Z', 'apron'],
        ['apronLoSh', 'M -18 -96 L -10 -96 C -11 -80 -12 -64 -13 -46 C -16 -46.5 -18 -47 -20 -48 C -19.5 -64 -19 -80 -18 -96 Z', 'apronSh'],
        ['apronStr', 'M -18 -97 L 18 -97 L 18 -93.5 L -18 -93.5 Z', 'apronSh'],
        ['strapL', 'M -11 -138 L -13 -145 L -11 -145.5 L -9 -138 Z', 'apron'],
        ['strapR', 'M 8 -138 L 11 -145.5 L 13 -145 L 10 -138 Z', 'apron'],
        ['neck', 'M -4 -149 L 6 -149 L 6 -144 L -4 -144 Z', 'skinDk'],
        ['scarf', 'M -8 -146 C -5 -150 6 -150 9 -146 L 8 -140 C 3 -142 -3 -142 -7 -140 Z', 'scarf'],
        ['head', 'M -5 -150 C -8 -156 -7 -164 0 -167 C 7 -168 12 -163 12 -156 C 12 -150 8 -146 3 -146 C 0 -146 -3 -147 -5 -150 Z', 'skin'],
        ['faceSh', 'M -5 -150 C -8 -156 -7 -164 0 -167 C -3 -162 -3 -155 -1 -147 C -3 -147 -4 -148 -5 -150 Z', 'skinDk'],
        ['ear', 'M -5.5 -159 C -8.5 -158.5 -8.5 -153 -5 -153 Z', 'skinDk'],
        ['nose', 'M 11 -158 L 14 -153.5 L 11 -152.5 Z', 'skinLt'],
        ['eyeL', ell(4.6, -158, 2.3, 1.85), 'eye'],
        ['eyeR', ell(9.9, -158, 1.9, 1.7), 'eye'],
        ['pupL', ell(5.7, -158.1, 0.85, 0.9), 'pupil'],
        ['pupR', ell(10.8, -158.1, 0.8, 0.85), 'pupil'],
        ['browL', 'M 2.2 -162.6 Q 4.8 -165.6 7.2 -163.4 L 7 -162.5 Q 4.8 -164.3 2.4 -161.8 Z', 'stache'],
        ['browR', 'M 8.3 -163 Q 10 -165.2 11.8 -163.2 L 11.6 -162.4 Q 10 -164.2 8.5 -162.2 Z', 'stache'],
        ['stache', 'M 6 -152.5 C 8 -155 12.5 -155 13.5 -152.5 C 11 -151.3 8 -151.3 6 -152.5 Z', 'stache'],
        ['mouth', ell(9.8, -149.4, 1.5, 2.0), 'mouth'],
        ['cap', 'M -7 -162 C -6 -170 8 -172 12 -166 C 16 -165 19.5 -163 18.5 -161 C 11 -161 -1 -161 -7 -161 Z', 'cap'],
        ['capLit', 'M -6 -164 C -4 -170 8 -171 11 -166 C 6 -168 -1 -167 -6 -164 Z', 'capLit'],
        ['armR', 'M 19 -139 C 26 -134 31 -128 35 -121 C 36 -118 33 -116 31 -118 C 27 -123 23 -127 18 -129 Z', 'swLit'],
        ['handR', 'M 34 -124 C 38 -126.5 41.5 -122 39.5 -118 C 37.5 -116 34 -117 32 -119 Z', 'skinLt'],
      ],
    },
    manA: {
      rim: { dx: 1.5, dy: 0, col: 'rim', of: ['legB', 'coat', 'arm', 'head', 'crown', 'brim'] },
      s: [
        ['legB', 'M 4 -54 C 9 -40 13 -28 17 -18 L 25 -20 C 21 -32 17 -44 15 -54 Z', 'trou'],
        ['shoeB', 'M 15 -16 C 18 -22 26 -23 30 -19 L 31 -15 C 25 -14 19 -14 15 -16 Z', 'shoe'],
        ['legF', 'M -24 -54 C -28 -36 -32 -18 -36 -4 L -28 -2 C -25 -18 -20 -36 -14 -54 Z', 'trou'],
        ['shoeF', 'M -45 0 C -45 -5 -37 -7 -28 -5 L -27 0 Z', 'shoe'],
        ['coat', 'M -19 -142 C -23 -126 -25 -108 -27 -90 C -29 -76 -33 -62 -38 -52 C -20 -47 4 -47 25 -52 C 23 -70 22 -90 22 -108 C 23 -122 22 -134 19 -142 C 10 -148 -10 -148 -19 -142 Z', 'coat'],
        ['fold', 'M -10 -128 C -14 -104 -18 -80 -25 -51 L -18 -49.5 C -13 -78 -9 -104 -6 -128 Z', 'coatDk'],
        ['lapel', 'M -3 -108 C 0 -112 2 -118 2 -128 L -6 -130 C -6 -120 -5 -112 -3 -108 Z', 'coatDk'],
        ['arm', 'M 16 -139 C 22 -126 21 -112 13 -104 C 7 -99 0 -102 -3 -108 C 3 -111 9 -115 11 -124 Z', 'coat'],
        ['collar', 'M -13 -146 C -14 -153 -10 -151 -6 -149 L 5 -149 C 9 -151 12 -153 11 -146 Z', 'coat'],
        ['shirt', 'M -7 -148.5 L -1 -148.5 L -4.2 -142 Z', 'shirt'],
        ['tie', 'M -4.6 -147.5 L -3.4 -147.5 L -3.6 -141.5 L -4.5 -142.5 Z', 'coatDk'],
        ['head', 'M -2 -147 C 3 -149 5.5 -154 5 -160 C 4 -166 -4 -168 -9 -166 C -10.5 -164 -11 -162 -11.5 -160.5 C -13 -159.4 -14.6 -157.8 -15.4 -156.4 C -14.4 -155.6 -13 -155.4 -12.4 -155 C -12.8 -153.6 -12.6 -152.6 -12 -152 C -12.8 -151 -12.4 -149.6 -10.6 -148.6 C -8 -147.4 -5 -147 -2 -147 Z', 'face'],
        ['faceLit', 'M 5 -161 C 5.6 -155 3 -150 -1 -148 L 1.5 -150.5 C 3.5 -153 4 -157 3.4 -162 Z', 'faceLit'],
        ['cheek', 'M -11 -158.6 C -9.6 -159.2 -8 -159 -7.4 -158 C -8.6 -157.4 -10 -157.6 -11 -158.6 Z', 'cold'],
        ['crown', 'M -12 -164 C -12 -172 -8 -177 -2 -177 C 4 -177 8 -172 8 -164 Z', 'hat'],
        ['brim', 'M -23 -162 C -14 -167 9 -168 14 -163 C 8 -159 -12 -158 -23 -162 Z', 'hat'],
        ['hatTop', 'M -11 -170 C -8 -176 3 -177 7 -171 C 2 -174 -6 -174 -11 -170 Z', 'top'],
        ['shTop', 'M -18 -142 C -10 -148 10 -148 19 -142 C 10 -145 -10 -145 -18 -142 Z', 'top'],
      ],
    },
    manB: {
      rim: { dx: 1.5, dy: 0, col: 'rim', of: ['legR', 'coat', 'arm', 'head', 'crown', 'brim'] },
      s: [
        ['legL', 'M -14 -54 C -16 -36 -17 -18 -18 -4 L -10 -4 C -9 -20 -8 -38 -6 -54 Z', 'trou'],
        ['legR', 'M 2 -54 C 4 -38 6 -20 8 -4 L 16 -4 C 14 -22 13 -40 12 -54 Z', 'trou'],
        ['shoeL', 'M -25 0 C -25 -4 -18 -6 -10 -5 L -9 0 Z', 'shoe'],
        ['shoeR', 'M 4 0 C 4 -4 10 -6 17 -5 L 18 0 Z', 'shoe'],
        ['coat', 'M -18 -143 C -22 -126 -22 -108 -22 -92 C -22 -78 -23 -64 -25 -52 C -10 -48 10 -48 22 -52 C 21 -68 21 -84 21 -100 C 22 -118 21 -132 18 -143 C 9 -149 -9 -149 -18 -143 Z', 'coat'],
        ['fold', 'M -6 -120 C -8 -100 -10 -76 -12 -50 L -6 -49 C -4 -76 -3 -100 -2 -120 Z', 'coatDk'],
        ['arm', 'M 15 -139 C 21 -124 21 -110 17 -96 L 9 -94 C 11 -108 11 -122 9 -132 Z', 'coat'],
        ['pocket', 'M 7 -98 L 18 -99 L 18 -95 L 7 -94 Z', 'coatDk'],
        ['scarfB', 'M -9 -150 C -4 -152 3 -152 8 -150 L 7 -145 C 3 -146 -3 -146 -8 -145 Z', 'scarf'],
        ['scarfEnd', 'M -6 -146 L -2 -146 L -3 -128 L -7 -129 Z', 'scarf'],
        ['collar', 'M -13 -147 C -15 -155 -10 -153 -6 -150 L 5 -150 C 9 -153 13 -155 11 -147 Z', 'coat'],
        ['head', 'M -1 -148 C 4 -150 6.5 -155 6 -161 C 5 -167 -3 -169 -8 -167 C -9.5 -165 -10 -163 -10.5 -161.5 C -12 -160.4 -13.6 -158.8 -14.4 -157.4 C -13.4 -156.6 -12 -156.4 -11.4 -156 C -11.8 -154.6 -11.6 -153.6 -11 -153 C -11.8 -152 -11.4 -150.6 -9.6 -149.6 C -7 -148.4 -4 -148 -1 -148 Z', 'face'],
        ['faceLit', 'M 6 -162 C 6.6 -156 4 -151 0 -149 L 2.5 -151.5 C 4.5 -154 5 -158 4.4 -163 Z', 'faceLit'],
        ['cheek', 'M -10 -159.6 C -8.6 -160.2 -7 -160 -6.4 -159 C -7.6 -158.4 -9 -158.6 -10 -159.6 Z', 'cold'],
        ['crown', 'M -11 -165 C -11 -173 -7 -178 -1 -178 C 5 -178 9 -173 9 -165 Z', 'hat'],
        ['brim', 'M -21 -163 C -13 -168 10 -169 16 -164 C 10 -160 -11 -159 -21 -163 Z', 'hat'],
        ['hatTop', 'M -10 -171 C -7 -177 4 -178 8 -172 C 3 -175 -5 -175 -10 -171 Z', 'top'],
        ['shTop', 'M -17 -143 C -9 -149 9 -149 18 -143 C 9 -146 -9 -146 -17 -143 Z', 'top'],
      ],
    },
    walker: {
      rim: { dx: 1.2, dy: 0, col: 'rim', of: ['coat', 'canopy'] },
      s: [
        ['legL', 'M -9 -54 L -2 -54 L -3 -4 L -8 -4 Z', 'trou'],
        ['legR', 'M 2 -54 L 9 -54 L 8 -4 L 3 -4 Z', 'trou'],
        ['shoeL', 'M -11 0 L -11 -4 L -2 -4 L -2 0 Z', 'shoe'],
        ['shoeR', 'M 2 0 L 2 -4 L 10 -4 L 10 0 Z', 'shoe'],
        ['coat', 'M -15 -140 C -19 -110 -21 -80 -23 -54 C -8 -50 8 -50 23 -54 C 21 -80 19 -110 15 -140 C 8 -146 -8 -146 -15 -140 Z', 'coat'],
        ['head', ell(0, -153, 8, 10), 'face'],
        ['shaft', 'M -0.9 -200 L 0.9 -200 L 0.9 -126 L -0.9 -126 Z', 'umb'],
        ['handU', 'M -4 -132 L 4 -132 L 4 -123 L -4 -123 Z', 'coatDk'],
        ['canopy', 'M -58 -170 C -48 -204 48 -204 58 -170 C 50 -174 42 -168 29 -172 C 20 -168 10 -172 0 -169 C -10 -172 -20 -168 -29 -172 C -42 -168 -50 -174 -58 -170 Z', 'umb'],
        ['canTop', 'M -50 -182 C -36 -201 36 -201 50 -182 C 34 -195 -34 -195 -50 -182 Z', 'top'],
      ],
    },
  };
  function drawFig(ctx, name, x, y, k, pal, o) {
    o = o || {};
    const f = FIG[name], sx = (o.flip ? -1 : 1) * (o.wide || 1) * k / 100, sy = (o.mirror ? -1 : 1) * k / 100;
    ctx.save(); ctx.translate(x, y); ctx.scale(sx, sy);
    if (o.mono) {
      ctx.fillStyle = o.mono;
      for (const sh of f.s) ctx.fill(p2(sh[1]));
      ctx.restore(); return;
    }
    if (f.rim && pal.rim) {
      ctx.save(); ctx.translate(f.rim.dx, f.rim.dy); ctx.fillStyle = pal.rim;
      for (const sh of f.s) if (f.rim.of.includes(sh[0])) ctx.fill(p2(sh[1]));
      ctx.restore();
    }
    for (const sh of f.s) { const c = pal[sh[2]]; if (!c) continue; ctx.fillStyle = c; ctx.fill(p2(sh[1])); }
    ctx.restore();
  }

  /* ------------------------------------------------------------------ fruit, painted as three flat planes and a touch of light */
  const FR = {
    orange: ['#7c2e04', '#e0700c', '#f7981e', '#ffcf72'],
    apple: ['#4a0a10', '#a01a22', '#c8302c', '#ee7a5c'],
    appleY: ['#5e2410', '#b4481a', '#d8742a', '#f6b860'],
    lemon: ['#7a5a08', '#d8ae16', '#f2d034', '#fff29a'],
    pear: ['#4a5214', '#90a032', '#b6c046', '#e4e690'],
  };
  function fruitPath(x, y, r, type) {
    const p = new Path2D();
    if (type === 'lemon') { p.ellipse(x, y, r * 1.14, r * 0.86, 0.12, 0, Math.PI * 2); p.ellipse(x + r * 1.12, y + r * 0.12, r * 0.18, r * 0.14, 0.12, 0, Math.PI * 2); }
    else if (type === 'pear') { p.arc(x, y + r * 0.22, r * 0.92, 0, Math.PI * 2); p.ellipse(x + r * 0.08, y - r * 0.5, r * 0.56, r * 0.62, 0.1, 0, Math.PI * 2); p.moveTo(x - r * 0.75, y); p.lineTo(x - r * 0.4, y - r * 0.6); p.lineTo(x + r * 0.6, y - r * 0.5); p.lineTo(x + r * 0.86, y); p.closePath(); }
    else p.arc(x, y, r, 0, Math.PI * 2);
    return p;
  }
  function fruit(ctx, x, y, r, type, lit) {
    const c = FR[type], sh = fruitPath(x, y, r, type);
    lit = lit === undefined ? 1 : lit;
    ctx.fillStyle = c[0]; ctx.fill(sh);
    ctx.save(); ctx.clip(sh);
    disc(ctx, x - r * 0.16, y - r * 0.2, r * 0.9, c[1]);
    disc(ctx, x - r * 0.3, y - r * 0.36, r * 0.6, lit > 0.5 ? c[2] : mix(c[2], c[1], 0.5));
    if (lit > 0.3) disc(ctx, x - r * 0.4, y - r * 0.46, r * 0.28, mix(c[3], c[2], 1 - lit));
    ctx.restore();
    if (r > 2.2 && lit > 0.5) disc(ctx, x - r * 0.42, y - r * 0.5, Math.max(0.35, r * 0.09), 'rgba(255,248,226,0.85)');
    if (type === 'pear' && r > 2) { ctx.strokeStyle = '#3a2a14'; ctx.lineWidth = Math.max(0.4, r * 0.1); ctx.beginPath(); ctx.moveTo(x + r * 0.1, y - r * 1.05); ctx.lineTo(x + r * 0.28, y - r * 1.4); ctx.stroke(); }
    if (type === 'apple' && r > 2.5) { ctx.strokeStyle = '#2a1a0a'; ctx.lineWidth = Math.max(0.35, r * 0.08); ctx.beginPath(); ctx.moveTo(x + r * 0.05, y - r * 0.72); ctx.lineTo(x + r * 0.16, y - r * 1.05); ctx.stroke(); }
  }

  /* ------------------------------------------------------------------ the fruit stand under its awning */
  const ST = { z0: 7.4, z1: 12.2, xf: -2.85, yf: 0.88, xb: -3.7, yb: 1.26, xs: -4.12, ys: 1.32 };
  const AW = { z0: 6.9, z1: 13.0, xf: -2.3, yf: 2.42, yb: 3.06, val: 0.27 };
  const DON = { X: -1.2, Z: 5.5 }, VEND = { X: -3.1, Z: 7.0 };
  const BULBZ = [7.9, 9.7, 11.5];
  const ROWF = ['orange', 'apple', 'orange', 'lemon', 'pear', 'orange', 'appleY', 'orange', 'lemon', 'apple'];
  const ROWB = ['apple', 'orange', 'pear', 'orange', 'appleY', 'lemon', 'orange', 'pear', 'apple', 'orange'];
  const PRICE = { orange: ['3/10¢', '2/5¢', '29¢ DOZ'], apple: ['5¢', '10¢'], appleY: ['4/10¢'], lemon: ['2/5¢', '3/10¢'], pear: ['5¢', '10¢'] };
  function sp(t, z, up) { return [lerp(ST.xf, ST.xb, t), lerp(ST.yf, ST.yb, t) + (up || 0), z]; }
  function crateFruits(t0, t1, za, zb, type, layers, base) {
    const r = type === 'lemon' ? 0.04 : type === 'apple' || type === 'appleY' ? 0.046 : type === 'pear' ? 0.046 : 0.05;
    const L = Math.hypot(ST.xb - ST.xf, ST.yb - ST.yf), out = [];
    const nz = Math.max(1, Math.floor((zb - za - 0.05) / (2 * r))), ns = Math.max(1, Math.floor(((t1 - t0) * L - 0.05) / (2 * r)));
    for (let l = 0; l < layers; l++) {
      for (let i = 0; i < nz - l; i++) for (let j = 0; j < ns - l; j++) {
        const z = za + 0.025 + r + (i + l * 0.5) * 2 * r + rnd(-0.1, 0.1) * r;
        let X, Y;
        if (base) { X = lerp(base.x0, base.x1, (j + 0.5 + l * 0.5) / ns); Y = base.y; }
        else { const t = t0 + (0.025 + r + (j + l * 0.5) * 2 * r) / L; const q = sp(t, z); X = q[0]; Y = q[1]; }
        out.push({ X: X + rnd(-0.08, 0.08) * r, Y: Y + r * (1 + l * 1.42), Z: z, r: r * rnd(0.92, 1.06), type });
      }
    }
    return out;
  }
  function drawFruitList(ctx, list) {
    for (const f of list) { const c = cam(f.X, f.Y, f.Z); f.d = c[2]; f.s = scr(c); }
    list.sort((a, b) => b.d - a.d || a.Y - b.Y);
    for (const f of list) {
      const k = CAM.F / f.d;
      // light: the bulbs hang above the front of the stand, the far end is a little dimmer
      const lit = clamp(1.05 - Math.abs(f.Z - 9.7) * 0.06, 0.55, 1);
      fruit(ctx, f.s[0], f.s[1], f.r * k, f.type, lit);
    }
  }
  function priceCard(ctx, X, Y, Z, txt, tilt) {
    const p = P(X, Y, Z), k = K(X, Z), w = 0.16 * k * (txt.length > 4 ? 1.25 : 1), h = 0.1 * k;
    ctx.save(); ctx.translate(p[0], p[1]); ctx.rotate(tilt);
    ctx.strokeStyle = '#3a2a1a'; ctx.lineWidth = Math.max(0.4, 0.008 * k); ctx.beginPath(); ctx.moveTo(0, h * 0.4); ctx.lineTo(0, h * 1.5); ctx.stroke();
    ctx.fillStyle = '#2a2018'; ctx.fillRect(-w / 2 + 0.5, -h / 2 + 0.6, w, h);
    ctx.fillStyle = '#f3ead6'; ctx.fillRect(-w / 2, -h / 2, w, h);
    const ch = h * 0.62, L = layout(txt, 0.16), sc = Math.min(ch, (w * 0.84) / L.w);
    letter(ctx, txt, (u, v) => [-L.w * sc / 2 + u * sc, -sc / 2 + v * sc], { color: txt.includes('DOZ') ? '#1e1a16' : '#a8201a', width: Math.max(0.5, sc * 0.17), track: 0.16, jitter: 0.03 });
    ctx.restore();
  }

  function drawStand(ctx) {
    const wood = '#6e4a2a', woodD = '#2e2016', woodL = '#b08454', board = '#3a2a1c';
    // the sidewalk under the stand: stacked empty crates and shadow
    poly3(ctx, [[ST.xf + 0.05, CURB + 0.001, ST.z0 - 0.1], [ST.xf + 0.05, CURB + 0.001, ST.z1 + 0.1], [XL, CURB + 0.001, ST.z1 + 0.1], [XL, CURB + 0.001, ST.z0 - 0.1]], 'rgba(18,12,10,0.55)');
    // the front of the stand: painted boards
    const fp = poly3(ctx, [[ST.xf, CURB, ST.z0], [ST.xf, ST.yf, ST.z0], [ST.xf, ST.yf, ST.z1], [ST.xf, CURB, ST.z1]], '#2f3a2a');
    for (let y = 0.3; y < ST.yf; y += 0.18) line3(ctx, [ST.xf + 0.002, y, ST.z0], [ST.xf + 0.002, y, ST.z1], 'rgba(10,8,6,0.55)', 0.6);
    for (const z of [ST.z0, (ST.z0 + ST.z1) / 2, ST.z1]) poly3(ctx, [[ST.xf + 0.01, CURB, z - 0.05], [ST.xf + 0.01, ST.yf, z - 0.05], [ST.xf + 0.01, ST.yf, z + 0.05], [ST.xf + 0.01, CURB, z + 0.05]], woodD);
    // warm bounce on the top edge of the boards
    poly3(ctx, [[ST.xf + 0.003, ST.yf - 0.06, ST.z0], [ST.xf + 0.003, ST.yf, ST.z0], [ST.xf + 0.003, ST.yf, ST.z1], [ST.xf + 0.003, ST.yf - 0.06, ST.z1]], '#6a5a38');
    // the display board and the back shelf
    poly3(ctx, [sp(0, ST.z0), sp(1, ST.z0), sp(1, ST.z1), sp(0, ST.z1)], board);
    poly3(ctx, [[ST.xb, ST.yb, ST.z0], [ST.xs, ST.ys, ST.z0], [ST.xs, ST.ys, ST.z1], [ST.xb, ST.yb, ST.z1]], board);
    // back shelf: tall pyramids
    const back = [];
    const nC = 10, dz = (ST.z1 - ST.z0) / nC;
    for (let i = 0; i < nC; i++) {
      const za = ST.z0 + i * dz, zb = za + dz;
      back.push(...crateFruits(0, 1, za, zb, ROWB[(i + 3) % 10] === 'lemon' ? 'orange' : ROWB[(i + 3) % 10], 4, { x0: ST.xb - 0.02, x1: ST.xs + 0.02, y: ST.ys }));
    }
    drawFruitList(ctx, back);
    // two rows of slanted crates, far to near
    for (const row of [[0.5, 1, ROWB], [0, 0.5, ROWF]]) {
      for (let i = nC - 1; i >= 0; i--) {
        const za = ST.z0 + i * dz, zb = za + dz, type = row[2][i];
        const list = crateFruits(row[0], row[1], za, zb, type, 3);
        drawFruitList(ctx, list);
        // the crate's near wall and its front lip, pale wood catching the bulb light
        poly3(ctx, [sp(row[0], za), sp(row[1], za), sp(row[1], za, 0.1), sp(row[0], za, 0.1)], mix(wood, woodL, 0.35));
        poly3(ctx, [sp(row[0], za), sp(row[0], zb), sp(row[0], zb, 0.085), sp(row[0], za, 0.085)], i % 2 ? woodL : mix(woodL, wood, 0.3));
        line3(ctx, sp(row[0], za, 0.085), sp(row[0], zb, 0.085), 'rgba(255,226,170,0.5)', 0.5);
      }
    }
    // price cards
    for (let i = 0; i < nC; i++) {
      if ((i * 7 + 3) % 10 < 4) continue;
      const za = ST.z0 + i * dz + dz * 0.5, type = ROWF[i];
      const q = sp(0.28, za, 0.2), opts = PRICE[type];
      priceCard(ctx, q[0], q[1], q[2], opts[(i >> 1) % opts.length], rnd(-0.12, 0.12));
    }
    for (let i = 1; i < nC; i += 3) {
      const za = ST.z0 + i * dz + dz * 0.45, type = ROWB[i];
      const q = [ST.xs + 0.1, ST.ys + 0.34, za], opts = PRICE[type];
      priceCard(ctx, q[0], q[1], q[2], opts[i % opts.length], rnd(-0.1, 0.1));
    }
  }

  function drawAwning(ctx, under) {
    // stripes run out from the wall; each stripe a quad seen either from below (warm, lit by bulbs) or from above (snow)
    const n = Math.round((AW.z1 - AW.z0) / 0.3), dz = (AW.z1 - AW.z0) / n;
    const G = '#25503c', Cr = '#e9dec4';
    for (let i = n - 1; i >= 0; i--) {
      const za = AW.z0 + i * dz, zb = za + dz, green = i % 2 === 0;
      const q = [[XL, AW.yb, za], [AW.xf, AW.yf, za], [AW.xf, AW.yf, zb], [XL, AW.yb, zb]];
      const pr = proj(q); if (pr.length < 3) continue;
      const fromBelow = area(pr) > 0;
      if (under && fromBelow) {
        // the underside glows where the bulbs are
        const near = clamp(1 - Math.min(Math.abs(za - BULBZ[0]), Math.abs(za - BULBZ[1]), Math.abs(za - BULBZ[2])) / 1.2, 0, 1);
        const col = green ? mix('#1c3428', '#6a7a3a', near * 0.5) : mix('#8a7058', '#f4d49a', 0.35 + near * 0.55);
        ctx.fillStyle = col; ctx.fill(path2(pr));
      } else if (!under && !fromBelow) {
        ctx.fillStyle = green ? mix(G, C.snowShade, 0.55) : mix(Cr, C.snow, 0.6); ctx.fill(path2(pr));
      }
    }
    if (under) return;
    // valance with scallops, stripes continuing
    for (let i = n - 1; i >= 0; i--) {
      const za = AW.z0 + i * dz, zb = za + dz, green = i % 2 === 0;
      const a = P(AW.xf, AW.yf, za), b = P(AW.xf, AW.yf, zb), c = P(AW.xf, AW.yf - AW.val, zb), d = P(AW.xf, AW.yf - AW.val, za);
      const m = P(AW.xf, AW.yf - AW.val - 0.07, (za + zb) / 2);
      ctx.fillStyle = green ? '#1f4433' : '#d9cdb0';
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(c[0], c[1]); ctx.quadraticCurveTo(m[0], m[1] + (m[1] - c[1]) * 0.6, d[0], d[1]); ctx.closePath(); ctx.fill();
    }
    // a soft cold light along the valance's top and its snow lip
    line3(ctx, [AW.xf, AW.yf + 0.015, AW.z0], [AW.xf, AW.yf + 0.015, AW.z1], C.snow, 1.6);
    line3(ctx, [AW.xf, AW.yf - 0.02, AW.z0], [AW.xf, AW.yf - 0.02, AW.z1], 'rgba(20,24,30,0.6)', 0.6);
    // the near end flap, facing us
    const e = [[XL, AW.yb, AW.z0], [AW.xf, AW.yf, AW.z0], [AW.xf, AW.yf - AW.val, AW.z0], [XL, AW.yb - 0.5, AW.z0]];
    poly3(ctx, e, '#1f4433');
    for (let k = 1; k < 7; k += 2) { const t0 = k / 7, t1 = (k + 1) / 7; const xa = lerp(XL, AW.xf, t0), xb2 = lerp(XL, AW.xf, t1); poly3(ctx, [[xa, lerp(AW.yb, AW.yf, t0), AW.z0], [xb2, lerp(AW.yb, AW.yf, t1), AW.z0], [xb2, lerp(AW.yb - 0.5, AW.yf - AW.val, t1), AW.z0], [xa, lerp(AW.yb - 0.5, AW.yf - AW.val, t0), AW.z0]], '#d9cdb0'); }
    // iron frame
    line3(ctx, [AW.xf, AW.yf, AW.z0], [AW.xf, AW.yf, AW.z1], '#16181c', 1.1);
    for (const z of [AW.z0 + 0.05, AW.z1 - 0.05]) line3(ctx, [AW.xf, AW.yf, z], [XL, AW.yb - 0.9, z], 'rgba(20,20,24,0.55)', 0.6);
  }

  function drawBulbs(ctx, stage) {
    for (const z of BULBZ) {
      const top = P(-3.3, AW.yb - (AW.yb - AW.yf) * 0.62 + 0.01, z), b = P(-3.3, 2.5, z), k = K(-3.3, z);
      if (stage === 0) { glow(ctx, b[0], b[1], 0.9 * k, '#ffd890', 0.55); continue; }
      ctx.strokeStyle = '#1a1410'; ctx.lineWidth = Math.max(0.4, k * 0.006); ctx.beginPath(); ctx.moveTo(top[0], top[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
      glow(ctx, b[0], b[1] + 0.04 * k, 0.22 * k, '#fff4cc', 0.9);
      disc(ctx, b[0], b[1] + 0.04 * k, 0.035 * k, '#fffbea');
    }
  }

  function drawScale(ctx) {
    const X = -2.75, Z = 11.4, k = K(X, Z);
    const top = P(X, AW.yf + 0.05, Z), dial = P(X, 2.0, Z), pan = P(X, 1.6, Z);
    ctx.strokeStyle = '#2a2420'; ctx.lineWidth = Math.max(0.4, k * 0.008);
    ctx.beginPath(); ctx.moveTo(top[0], top[1]); ctx.lineTo(dial[0], dial[1]); ctx.stroke();
    disc(ctx, dial[0], dial[1], 0.105 * k, '#7a6a50');
    disc(ctx, dial[0], dial[1], 0.088 * k, '#f2ead2');
    ctx.strokeStyle = '#b02a1a'; ctx.lineWidth = Math.max(0.4, k * 0.008); ctx.beginPath(); ctx.moveTo(dial[0], dial[1]); ctx.lineTo(dial[0] + 0.06 * k, dial[1] - 0.04 * k); ctx.stroke();
    ctx.strokeStyle = 'rgba(40,30,20,0.8)'; ctx.lineWidth = Math.max(0.3, k * 0.004);
    for (const dx of [-0.16, 0, 0.16]) { ctx.beginPath(); ctx.moveTo(dial[0], dial[1] + 0.1 * k); ctx.lineTo(pan[0] + dx * k, pan[1]); ctx.stroke(); }
    ctx.fillStyle = '#a4783a'; ctx.beginPath(); ctx.ellipse(pan[0], pan[1], 0.18 * k, 0.045 * k, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#e8c070'; ctx.beginPath(); ctx.ellipse(pan[0] - 0.03 * k, pan[1] - 0.008 * k, 0.12 * k, 0.022 * k, 0, 0, Math.PI * 2); ctx.fill();
    fruit(ctx, pan[0] + 0.04 * k, pan[1] - 0.05 * k, 0.04 * k, 'pear');
  }

  /* -------- the paper bag slipping, oranges spilling */
  const SPILL = [
    // [X, Y, Z] in metres; the first few are falling from the bag
    [-2.3, 1.0, 6.5], [-2.25, 0.62, 6.3], [-2.15, 0.3, 6.1], [-2.05, CURB + 0.05, 5.8], [-1.85, CURB + 0.05, 5.15],
    [-1.6, CURB + 0.05, 4.55], [-1.38, CURB + 0.17, 4.05], [-1.05, 0.05, 3.65], [-0.55, 0.05, 3.2], [0.15, 0.05, 2.85], [1.25, 0.05, 2.7],
  ];
  function drawBag(ctx, hand) {
    // the bag hangs tipped between the vendor's fingers and the Don's open hand
    const k = K(-3.0, 7.95), x = hand[0], y = hand[1];
    ctx.save(); ctx.translate(x, y); ctx.rotate(1.25);
    const w = 0.2 * k, h = 0.3 * k;
    ctx.fillStyle = '#8a5e34'; ctx.beginPath(); ctx.moveTo(-w / 2, -h / 2); ctx.lineTo(w / 2, -h / 2 - 0.02 * k); ctx.lineTo(w / 2 + 0.01 * k, h / 2); ctx.lineTo(-w / 2 - 0.01 * k, h / 2); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#c48e54'; ctx.beginPath(); ctx.moveTo(-w / 2, -h / 2); ctx.lineTo(0, -h / 2 - 0.01 * k); ctx.lineTo(0.01 * k, h / 2); ctx.lineTo(-w / 2 - 0.01 * k, h / 2); ctx.closePath(); ctx.fill();
    // crumpled open mouth
    ctx.fillStyle = '#3a2410'; ctx.beginPath(); ctx.ellipse(0, h / 2, w * 0.52, 0.035 * k, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#e0b07a'; ctx.lineWidth = Math.max(0.4, 0.01 * k); ctx.beginPath(); ctx.moveTo(-w / 2, h / 2); ctx.lineTo(-w / 4, h / 2 + 0.03 * k); ctx.lineTo(0, h / 2 - 0.01 * k); ctx.lineTo(w / 4, h / 2 + 0.035 * k); ctx.lineTo(w / 2, h / 2); ctx.stroke();
    fruit(ctx, -w * 0.1, h / 2 + 0.02 * k, 0.05 * k, 'orange');
    ctx.restore();
    // two tumbling out of its mouth
    fruit(ctx, x + 0.2 * k, y + 0.08 * k, 0.05 * k, 'orange');
    fruit(ctx, x + 0.27 * k, y + 0.26 * k, 0.05 * k, 'orange');
  }
  function drawSharedString(ctx) {
    const FL = window.FamilyLights; if (!FL) return;
    // the wire: exactly on the shared curve, a dark gouache line with a cold catch-light along its top
    ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); FL.wirePath(ctx); ctx.strokeStyle = '#15161c'; ctx.lineWidth = FL.WIRE_W; ctx.stroke();
    ctx.beginPath(); FL.wirePath(ctx); ctx.strokeStyle = 'rgba(150,170,200,0.35)'; ctx.lineWidth = 0.8; ctx.translate(0, -0.9); ctx.stroke();
    ctx.restore();
    const r = FL.BULB_R;
    for (const b of FL.bulbs()) {
      const col = BULBS[b.i % 5], x = b.x, y = b.y;
      glow(ctx, x, y + r * 0.3, r * 3.2, col, 0.32);
      // socket on the wire, bulb hanging from it
      ctx.fillStyle = '#1c1a18'; ctx.fillRect(x - r * 0.32, y - r * 0.55, r * 0.64, r * 0.6);
      ctx.fillStyle = mix(col, '#000000', 0.25); ctx.beginPath(); ctx.ellipse(x, y + r * 0.35, r * 0.68, r * 0.78, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(x - r * 0.08, y + r * 0.28, r * 0.52, r * 0.62, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = mix(col, '#ffffff', 0.7); ctx.beginPath(); ctx.ellipse(x - r * 0.22, y + r * 0.12, r * 0.18, r * 0.26, -0.3, 0, Math.PI * 2); ctx.fill();
      // a cap of snow on the socket
      ctx.fillStyle = C.snow; ctx.beginPath(); ctx.ellipse(x, y - r * 0.58, r * 0.46, r * 0.2, 0, Math.PI, 0); ctx.fill();
    }
  }
  function drawLitter(ctx) {
    // a morning paper gone soft in the slush
    const cx = 1.3, cz = 2.2, a = 0.42, w = 0.58, h = 0.4, ca = Math.cos(a), sa = Math.sin(a);
    const Wp = (u, v, lift) => [cx + (u - 0.5) * w * ca - (v - 0.5) * h * sa, 0.004 + (lift || 0), cz + (u - 0.5) * w * sa + (v - 0.5) * h * ca];
    poly3(ctx, [Wp(0, 0), Wp(1, 0), Wp(1, 1), Wp(0, 1)], 'rgba(6,8,12,0.5)');
    poly3(ctx, [Wp(0.01, 0.0, 0.02), Wp(1, 0.02, 0.0), Wp(0.98, 1, 0.0), Wp(0.02, 0.97, 0.03)], '#cfc8b6');
    poly3(ctx, [Wp(0.5, 0.0, 0.01), Wp(1, 0.02, 0.0), Wp(0.98, 1, 0.0), Wp(0.5, 0.98, 0.01)], '#b8b2a2');
    poly3(ctx, [Wp(0.55, 0.45), Wp(0.95, 0.5), Wp(0.92, 0.95), Wp(0.6, 0.9)], 'rgba(70,74,84,0.35)');
    poly3(ctx, [Wp(0.06, 0.06, 0.02), Wp(0.92, 0.07), Wp(0.92, 0.17), Wp(0.06, 0.16, 0.02)], '#2a2622');
    poly3(ctx, [Wp(0.08, 0.22, 0.02), Wp(0.42, 0.22, 0.01), Wp(0.42, 0.55, 0.01), Wp(0.08, 0.55, 0.02)], '#7a7468');
    for (let r = 0.25; r < 0.92; r += 0.055) { line3(ctx, Wp(0.5, r), Wp(0.9, r), 'rgba(60,56,50,0.45)', 0.7); if (r > 0.6) line3(ctx, Wp(0.08, r), Wp(0.44, r), 'rgba(60,56,50,0.45)', 0.7); }
    line3(ctx, Wp(0.5, 0.02), Wp(0.5, 0.98), 'rgba(90,86,76,0.6)', 0.8);
    // a cigarette end
    const p0 = P(0.42, 0.012, 1.9), p1 = P(0.47, 0.012, 1.93), k = K(0.45, 1.9);
    ctx.lineCap = 'round'; ctx.strokeStyle = '#e8e2d4'; ctx.lineWidth = 0.012 * k; ctx.beginPath(); ctx.moveTo(p0[0], p0[1]); ctx.lineTo(p1[0], p1[1]); ctx.stroke();
    disc(ctx, p0[0], p0[1], 0.006 * k, '#5a5450');
  }
  function drawSpill(ctx, from, to) {
    for (let i = from; i < to; i++) {
      const s = SPILL[i], p = P(s[0], s[1], s[2]), k = K(s[0], s[2]), r = 0.05 * k;
      if (s[1] <= CURB + 0.055) {
        // contact shadow and a warm reflection in the wet
        ctx.fillStyle = 'rgba(8,6,6,0.55)'; ctx.beginPath(); ctx.ellipse(p[0] + r * 0.2, p[1] + r * 0.9, r * 1.2, r * 0.28, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(240,130,30,0.28)'; ctx.beginPath(); ctx.ellipse(p[0], p[1] + r * 2.2, r * 0.8, r * 1.1, 0, 0, Math.PI * 2); ctx.fill();
      }
      fruit(ctx, p[0], p[1], r, 'orange', i < 4 ? 1 : 0.75);
    }
  }

  /* ------------------------------------------------------------------ 1940s cars */
  // profile (u from the nose, v up) of a fastback sedan, five metres long
  const CARP = [[0, 0.3], [0, 0.56], [0.14, 0.64], [0.3, 0.86], [0.6, 0.99], [1.6, 1.07], [1.7, 1.1], [2.2, 1.56], [2.55, 1.63], [3.35, 1.63], [4.0, 1.38], [4.55, 1.06], [4.95, 0.86], [5.16, 0.62], [5.2, 0.32]];
  function drawCar(ctx, o) {
    const L = 5.2, x0 = o.x0, x1 = o.x1, zf = o.zf, front = o.facing === 'front';
    const U = (u) => (front ? zf + u : zf + (L - u)); // world Z of profile coordinate u (u = 0 at the nose)
    const sideX = CAM.x < x0 ? x0 : x1, out = sideX === x0 ? -1 : 1;
    const body = o.col, k = K(sideX, zf + 2.6), xm = (x0 + x1) / 2;
    const lit = mix(body, '#93a2bc', 0.28), warm = mix(body, '#e8a868', 0.45), dark = mix(body, '#000000', 0.5);
    const chromeDk = '#2e3542', chromeMd = '#6c7686', chromeLt = '#e8eef8';
    const lw = (m) => Math.max(0.35, m * k);
    // shadow pooled under the car
    poly3(ctx, [[x0 - 0.12, 0.003, U(0) - 0.12], [x1 + 0.12, 0.003, U(0) - 0.12], [x1 + 0.12, 0.003, U(L) + 0.12], [x0 - 0.12, 0.003, U(L) + 0.12]], 'rgba(4,6,10,0.85)');
    // tyres first, so the fenders sit over them
    for (const wu of [0.95, 4.05]) {
      const ty = [], hb = [];
      for (let a = 0; a < 22; a++) { const t = (a / 22) * Math.PI * 2; ty.push([sideX, 0.36 + Math.sin(t) * 0.36, U(wu + Math.cos(t) * 0.36)]); hb.push([sideX + out * 0.03, 0.36 + Math.sin(t) * 0.16, U(wu + Math.cos(t) * 0.16)]); }
      poly3(ctx, ty, '#0a0b0e'); poly3(ctx, hb, chromeMd);
      const hc = P(sideX + out * 0.04, 0.42, U(wu - 0.04)); disc(ctx, hc[0], hc[1], 0.04 * k, chromeLt);
    }
    // the body side with its two wheel arches
    const LOWER = [[0, 0.3], [0, 0.56], [0.14, 0.64], [0.3, 0.86], [0.6, 0.99], [1.6, 1.07], [1.75, 1.08], [4.42, 1.08], [4.6, 1.04], [4.95, 0.86], [5.16, 0.62], [5.2, 0.32]];
    const gx = sideX - out * 0.18; // the greenhouse sits inboard of the fenders
    poly3(ctx, [[1.75, 1.06], [2.2, 1.56], [2.55, 1.63], [3.35, 1.63], [4.0, 1.38], [4.44, 1.06]].map((q) => [gx, q[1], U(q[0])]), body);
    const prof = LOWER.map((q) => [sideX, q[1], U(q[0])]);
    const bottom = [[5.2, 0.32]];
    const arch = (c) => { const pts = []; for (let i = 0; i <= 12; i++) { const a = (i / 12) * Math.PI; pts.push([c + 0.45 * Math.cos(a), 0.34 + 0.46 * Math.sin(a)]); } return pts; };
    bottom.push(...arch(4.05)); bottom.push([0.95 + 0.45, 0.32]); bottom.push(...arch(0.95)); bottom.push([0, 0.32]);
    const sideP = prof.concat(bottom.map((q) => [sideX, q[1], U(q[0])]));
    poly3(ctx, sideP, body);
    // fender crowns catch the light; a long sheen along the shoulder; the shadowed sill
    for (const c of [0.95, 4.05]) { const pts = arch(c).map((q) => [sideX + out * 0.01, q[1] + 0.12, U(q[0] + (q[0] - c) * 0.25)]); const inner = arch(c).reverse().map((q) => [sideX + out * 0.01, q[1] + 0.05, U(q[0])]); poly3(ctx, pts.slice(2, 11).concat(inner.slice(2, 11)), o.warmSide ? warm : lit); }
    poly3(ctx, [[sideX, 0.9, U(1.3)], [sideX, 1.0, U(1.5)], [sideX, 1.04, U(4.2)], [sideX, 0.94, U(4.4)]], o.warmSide ? warm : lit);
    poly3(ctx, [[sideX, 0.32, U(1.42)], [sideX, 0.46, U(1.42)], [sideX, 0.46, U(3.58)], [sideX, 0.32, U(3.58)]], dark);
    // windows: the greenhouse, glass holding a little warm light
    const glass = o.glass || '#1a2234';
    poly3(ctx, [[gx, 1.12, U(1.9)], [gx, 1.5, U(2.27)], [gx, 1.55, U(3.3)], [gx, 1.36, U(3.86)], [gx, 1.12, U(3.96)]], glass);
    if (o.dome) { const dc = P(xm, 1.35, U(2.9)); glow(ctx, dc[0], dc[1], 0.75 * k, '#ffcf88', 0.5); }
    poly3(ctx, [[gx, 1.12, U(2.86)], [gx, 1.55, U(2.86)], [gx, 1.55, U(2.97)], [gx, 1.12, U(2.97)]], body);
    line3(ctx, [sideX + out * 0.01, 1.08, U(1.8)], [sideX + out * 0.01, 1.08, U(4.4)], chromeMd, lw(0.012));
    line3(ctx, [sideX + out * 0.01, 0.8, U(0.5)], [sideX + out * 0.01, 0.84, U(4.7)], rgba(chromeLt, 0.55), lw(0.008));
    for (const u of [1.84, 2.92]) line3(ctx, [sideX + out * 0.005, 0.5, U(u)], [sideX + out * 0.005, 1.1, U(u)], 'rgba(0,0,0,0.55)', lw(0.006));
    const zE = U(0), dir = front ? 1 : -1;
    const Zd = (d) => zE + dir * d; // depth behind the near end
    const FP = (pts, dz) => pts.map((q) => [xm + q[0], q[1], Zd(q.length > 2 ? q[2] : dz)]);
    const mirrorX = (pts) => pts.map((q) => [-q[0], q[1], q[2]]);
    // the cabin, a rounded dome set back on the body
    const cab = [[-0.74, 1.05], [-0.73, 1.28], [-0.66, 1.47], [-0.5, 1.58], [-0.25, 1.635], [0.25, 1.635], [0.5, 1.58], [0.66, 1.47], [0.73, 1.28], [0.74, 1.05]];
    const cabZ = front ? 1.95 : 1.15;
    poly3(ctx, FP(cab, cabZ), body);
    const pane = front ? [[-0.64, 1.11], [-0.62, 1.3], [-0.55, 1.44], [-0.4, 1.52], [-0.04, 1.545], [-0.04, 1.11]] : [[-0.5, 1.14], [-0.47, 1.33], [-0.32, 1.45], [0.32, 1.45], [0.47, 1.33], [0.5, 1.14]];
    poly3(ctx, FP(pane, cabZ - 0.02), glass);
    if (front) poly3(ctx, FP(mirrorX(pane), cabZ - 0.02), glass);
    if (o.dome) { const dc = P(xm, 1.32, Zd(cabZ + 0.6)); glow(ctx, dc[0], dc[1], 0.42 * k, '#ffd08a', 0.5); }
    // a cold sheen across the roof and the top of the glass
    poly3(ctx, FP([[-0.5, 1.58], [-0.25, 1.635], [0.25, 1.635], [0.5, 1.58], [0.3, 1.6], [-0.3, 1.6]], cabZ + 0.01), lit);
    // fenders: rounded humps either side, lamps set in them
    const fender = (sx) => { const pts = []; for (let i = 0; i <= 12; i++) { const a = (i / 12) * Math.PI; pts.push([sx * 0.68 + Math.cos(a) * 0.26, 0.44 + Math.sin(a) * 0.52, 0.12 + Math.sin(a) * 0.3]); } return pts; };
    for (const sx of [-1, 1]) {
      poly3(ctx, FP(fender(sx)), mix(body, '#6a7488', 0.1));
      poly3(ctx, FP(fender(sx).slice(3, 10).map((q) => [q[0], q[1] - 0.005, q[2] - 0.01]).concat(fender(sx).slice(3, 10).reverse().map((q) => [q[0] * 0.98 + sx * 0.0136, q[1] - 0.06, q[2] - 0.01]))), o.warmSide && sx < 0 ? warm : lit);
      if (front) {
        const hc = P(xm + sx * 0.68, 0.74, Zd(0.36)), hk = K(xm, Zd(0.36));
        disc(ctx, hc[0], hc[1], 0.115 * hk, chromeMd); disc(ctx, hc[0], hc[1], 0.095 * hk, o.headOn ? '#fff4d0' : '#2c3442');
        disc(ctx, hc[0] - 0.03 * hk, hc[1] - 0.035 * hk, 0.026 * hk, o.headOn ? '#ffffff' : '#9aa8bc');
      } else {
        const tc = P(xm + sx * 0.7, 0.72, Zd(0.3)), tk = K(xm, Zd(0.3));
        ctx.fillStyle = o.tailOn ? '#ff3a22' : '#5a1210'; ctx.beginPath(); ctx.ellipse(tc[0], tc[1], 0.045 * tk, 0.085 * tk, 0, 0, Math.PI * 2); ctx.fill();
        if (o.tailOn) { glow(ctx, tc[0], tc[1], 0.4 * tk, '#ff3a20', 0.55); disc(ctx, tc[0], tc[1] - 0.02 * tk, 0.02 * tk, '#ffd0c0'); }
      }
    }
    if (front) {
      // the long hood rising to the windshield, the tall grille, the ornament
      poly3(ctx, FP([[-0.44, 0.5, 0.3], [-0.44, 0.84, 0.45], [-0.28, 0.99, 0.8], [0, 1.07, 1.2], [0.28, 0.99, 0.8], [0.44, 0.84, 0.45], [0.44, 0.5, 0.3]]), mix(body, '#5a6478', 0.08));
      poly3(ctx, FP([[-0.28, 0.99, 0.8], [0, 1.07, 1.2], [0.28, 0.99, 0.8], [0.1, 1.01, 0.8], [0, 1.03, 0.9], [-0.1, 1.01, 0.8]]), lit);
      poly3(ctx, FP([[-0.23, 0.47], [0.23, 0.47], [0.2, 0.95], [0, 0.99], [-0.2, 0.95]], 0.12), '#07080b');
      for (let i = 0; i <= 8; i++) { const t = i / 8, xx = lerp(-0.21, 0.21, t); line3(ctx, [xm + xx, 0.49, Zd(0.11)], [xm + xx * 0.92, 0.95 - Math.abs(xx) * 0.18, Zd(0.11)], i === 3 ? rgba(chromeLt, 0.8) : rgba(chromeMd, 0.7), lw(0.009)); }
      line3(ctx, [xm, 1.07, Zd(1.1)], [xm, 1.13, Zd(1.25)], chromeLt, lw(0.014));
    } else {
      // the rounded trunk and the plate
      poly3(ctx, FP([[-0.5, 0.48, 0.15], [-0.52, 0.8, 0.3], [-0.38, 0.98, 0.55], [0, 1.04, 0.75], [0.38, 0.98, 0.55], [0.52, 0.8, 0.3], [0.5, 0.48, 0.15]]), mix(body, '#6a7890', 0.12));
      poly3(ctx, FP([[-0.36, 0.97, 0.55], [0, 1.03, 0.75], [0.36, 0.97, 0.55], [0, 1.0, 0.65]]), lit);
      poly3(ctx, FP([[-0.15, 0.5], [0.15, 0.5], [0.15, 0.61], [-0.15, 0.61]], 0.12), '#cfc08a');
    }
    // bumper: dark chrome with one bright edge and a warm glint
    poly3(ctx, FP([[-0.98, 0.31], [0.98, 0.31], [1.0, 0.36], [0.98, 0.45], [-0.98, 0.45], [-1.0, 0.36]], -0.04), chromeDk);
    line3(ctx, [xm - 0.95, 0.44, Zd(-0.045)], [xm + 0.95, 0.44, Zd(-0.045)], rgba(chromeLt, 0.85), lw(0.012));
    for (const t of [-0.5, 0.55]) { const g = P(xm + t, 0.41, Zd(-0.05)); disc(ctx, g[0], g[1], 0.022 * k, '#ffd8a0'); }
    // a cap of snow on the roof and on the fenders
    if (o.snow) {
      const cabZ2 = front ? 1.95 : 1.15;
      poly3(ctx, FP([[-0.5, 1.585], [-0.25, 1.64], [0.25, 1.64], [0.5, 1.585], [0.42, 1.66], [0.2, 1.7], [-0.2, 1.7], [-0.42, 1.66]], cabZ2 + 0.3), mix(C.snow, C.snowShade, 0.2));
      for (const sx of [-1, 1]) poly3(ctx, FP([[sx * 0.68 - 0.2, 0.9], [sx * 0.68, 0.965], [sx * 0.68 + 0.2, 0.9], [sx * 0.68 + 0.12, 0.95], [sx * 0.68 - 0.12, 0.95]], 0.45), rgba(C.snow, 0.8));
    }
  }

  /* ------------------------------------------------------------------ street furniture and light */
  function lamppost(ctx, X, Z, dir, stage) {
    const k = K(X, Z), col = haze('#1a2420', Z, 90), lampY = 4.35, ax = X + dir * 0.95;
    const lc = P(ax, lampY - 0.25, Z);
    if (stage === 0) { glow(ctx, lc[0], lc[1], 2.6 * k, '#ffe2a8', 0.38); glow(ctx, lc[0], lc[1], 0.9 * k, '#fff0cc', 0.55); return; }
    poly3(ctx, [[X - 0.15, CURB, Z], [X + 0.15, CURB, Z], [X + 0.1, 0.95, Z], [X - 0.1, 0.95, Z]], col);
    poly3(ctx, [[X - 0.07, 0.95, Z], [X + 0.07, 0.95, Z], [X + 0.045, 4.0, Z], [X - 0.045, 4.0, Z]], col);
    // the crook
    const pts = []; for (let i = 0; i <= 14; i++) { const t = i / 14; const xx = X + dir * (0.95 * t), yy = 4.0 + Math.sin(t * Math.PI) * 0.55 - t * 0.1; pts.push(P(xx, yy, Z)); }
    ctx.strokeStyle = col; ctx.lineWidth = Math.max(0.5, 0.06 * k); ctx.lineCap = 'round'; ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.stroke();
    // lantern
    const lt = P(ax, lampY, Z);
    ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(lt[0] - 0.16 * k, lt[1] + 0.06 * k); ctx.lineTo(lt[0], lt[1] - 0.08 * k); ctx.lineTo(lt[0] + 0.16 * k, lt[1] + 0.06 * k); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#fff3d4'; ctx.beginPath(); ctx.ellipse(lc[0], lc[1] - 0.06 * k, 0.12 * k, 0.17 * k, 0, 0, Math.PI * 2); ctx.fill();
    glow(ctx, lc[0], lc[1] - 0.06 * k, 0.4 * k, '#ffffff', 0.7);
  }
  function hydrant(ctx, X, Z) {
    const k = K(X, Z), p = P(X, CURB, Z), col = '#7a1a16';
    const w = 0.13 * k, h = 0.6 * k;
    ctx.fillStyle = col; ctx.fillRect(p[0] - w / 2, p[1] - h, w, h);
    ctx.beginPath(); ctx.ellipse(p[0], p[1] - h, w * 0.6, w * 0.45, 0, Math.PI, 0); ctx.fill();
    ctx.fillRect(p[0] - w, p[1] - h * 0.65, w * 2, w * 0.5);
    ctx.fillStyle = '#c0402a'; ctx.fillRect(p[0] - w / 2, p[1] - h, w * 0.3, h);
    ctx.fillStyle = C.snow; ctx.beginPath(); ctx.ellipse(p[0], p[1] - h - w * 0.2, w * 0.62, w * 0.3, 0, 0, Math.PI * 2); ctx.fill();
  }
  const BULBS = ['#ff4030', '#3ad070', '#ffb020', '#4a7aff', '#fff2d0'];
  function xmasString(ctx, Z, idx, stage) {
    const xa = XL + 0.1, xb = XR - 0.1, ya = 6.6 + (idx % 2) * 0.4, yb = 6.9 - (idx % 2) * 0.3, sag = 1.1 + (idx % 3) * 0.15;
    const at = (t) => [lerp(xa, xb, t), lerp(ya, yb, t) - sag * 4 * t * (1 - t), Z];
    const k = K(0, Z);
    if (stage === 1) {
      ctx.strokeStyle = haze('#1a1a1a', Z, 60); ctx.lineWidth = Math.max(0.35, 0.012 * k); ctx.beginPath();
      for (let i = 0; i <= 40; i++) { const p = P(...at(i / 40)); i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); }
      ctx.stroke();
    }
    const n = Math.round((xb - xa) / 0.45);
    for (let i = 1; i < n; i++) {
      const q = at(i / n), p = P(q[0], q[1] - 0.06, q[2]), col = BULBS[(i + idx) % 5];
      if (stage === 0) glow(ctx, p[0], p[1], Math.max(2.2, 0.32 * k), col, 0.4);
      else { disc(ctx, p[0], p[1], Math.max(0.55, 0.045 * k), mix(col, '#ffffff', 0.45)); }
    }
  }

  /* -------- the manhole and its steam */
  const MH = { X: 0.35, Z: 5.4 };
  function drawManhole(ctx) {
    const pts = [], pts2 = [];
    for (let i = 0; i < 28; i++) { const a = (i / 28) * Math.PI * 2; pts.push([MH.X + Math.cos(a) * 0.36, 0.003, MH.Z + Math.sin(a) * 0.36]); pts2.push([MH.X + Math.cos(a) * 0.3, 0.004, MH.Z + Math.sin(a) * 0.3]); }
    poly3(ctx, pts, '#5a6272'); poly3(ctx, pts2, '#2a2e36');
    const c = P(MH.X, 0, MH.Z), k = K(MH.X, MH.Z);
    ctx.strokeStyle = 'rgba(140,150,170,0.5)'; ctx.lineWidth = Math.max(0.4, k * 0.012);
    for (let i = -2; i <= 2; i++) { const a = P(MH.X - 0.26, 0.005, MH.Z + i * 0.1), b = P(MH.X + 0.26, 0.005, MH.Z + i * 0.1); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); }
    return [c, k];
  }
  function drawSteam(ctx, env) {
    // gouache vapour: a cool body, a warm side catching the shop light, a few crisp lit edges, wisps at the top
    const s = env.s, puffs = [];
    for (let i = 0; i < 34; i++) {
      const t = i / 33, h = 0.03 + t * 2.2, lean = t * t * 1.0 + Math.sin(t * 3.1 + 0.4) * 0.08;
      const X = MH.X + lean, Z = MH.Z + t * 1.4, q = P(X, h, Z), kk = K(X, Z);
      puffs.push([q[0] + rnd(-0.08, 0.08) * kk, q[1], (0.3 + t * 0.55 + Math.sin(i * 2.3) * 0.07) * kk, t]);
    }
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const p of puffs) { x0 = Math.min(x0, p[0] - p[2] * 1.6); x1 = Math.max(x1, p[0] + p[2] * 1.6); y0 = Math.min(y0, p[1] - p[2] * 1.6); y1 = Math.max(y1, p[1] + p[2] * 1.2); }
    x0 = Math.max(0, x0); y0 = Math.max(0, y0); x1 = Math.min(W, x1); y1 = Math.min(H, y1);
    const cw = Math.ceil((x1 - x0) * s), chh = Math.ceil((y1 - y0) * s);
    if (cw < 4 || chh < 4) return;
    const mk = () => { const c = document.createElement('canvas'); c.width = cw; c.height = chh; const x = c.getContext('2d'); x.setTransform(s, 0, 0, s, -x0 * s, -y0 * s); return [c, x]; };
    const [A, a] = mk(), [Bc, b] = mk();
    // the body: one opaque union, its density falling off as it rises
    for (const p of puffs) {
      a.fillStyle = rgba('#8c9ab0', 0.55 * (1 - p[3] * 0.85));
      a.beginPath(); a.ellipse(p[0], p[1], p[2], p[2] * 0.82, 0, 0, Math.PI * 2); a.fill();
    }
    // the warm side, inside the body only
    for (const p of puffs) { b.fillStyle = rgba('#efcfa6', 0.9 * (1 - p[3] * 0.7)); b.beginPath(); b.ellipse(p[0] - p[2] * 0.42, p[1] - p[2] * 0.18, p[2] * 0.62, p[2] * 0.58, -0.4, 0, Math.PI * 2); b.fill(); }
    b.globalCompositeOperation = 'destination-in'; b.setTransform(1, 0, 0, 1, 0, 0); b.drawImage(A, 0, 0);
    a.setTransform(1, 0, 0, 1, 0, 0); a.globalCompositeOperation = 'source-atop'; a.globalAlpha = 0.85; a.drawImage(Bc, 0, 0);
    // crisp lit edges along the left of a few billows
    a.setTransform(s, 0, 0, s, -x0 * s, -y0 * s); a.globalAlpha = 1; a.globalCompositeOperation = 'source-atop';
    a.lineCap = 'round';
    for (let i = 2; i < puffs.length - 6; i += 3) { const p = puffs[i]; a.strokeStyle = rgba('#fff0d8', 0.7 * (1 - p[3])); a.lineWidth = Math.max(0.8, p[2] * 0.09); a.beginPath(); a.arc(p[0] + p[2] * 0.05, p[1], p[2] * 0.95, Math.PI * 0.95, Math.PI * 1.45); a.stroke(); }
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.filter = 'blur(' + (1.6 * s).toFixed(1) + 'px)'; ctx.globalAlpha = 0.72;
    ctx.drawImage(A, Math.round(x0 * s), Math.round(y0 * s));
    ctx.restore();
    // wisps tearing off at the top, a few dry strokes
    ctx.save(); ctx.lineCap = 'round';
    for (let i = 0; i < 7; i++) { const p = puffs[puffs.length - 1 - i * 2]; ctx.strokeStyle = rgba(i % 2 ? '#c8d0dc' : '#e6d4bc', 0.08); ctx.lineWidth = p[2] * 0.12; ctx.beginPath(); ctx.moveTo(p[0] - p[2] * 0.6, p[1] - p[2] * 0.4); ctx.quadraticCurveTo(p[0] + p[2] * 0.2, p[1] - p[2] * 1.4, p[0] + p[2] * 1.3, p[1] - p[2] * 1.2); ctx.stroke(); }
    ctx.restore();
  }




  /* ------------------------------------------------------------------ signs on the facades, lettered by hand */
  function bladeSign(ctx) {
    // GENCO stacked, PURA OLIVE OIL beneath, on a green enamel board hanging from the pier past the awning
    const Z = 13.3, xa = XL + 0.12, xb = XL + 1.34, ya = 6.7, yb = 3.7, k = K(xa, Z);
    const M = (u, v) => P(lerp(xa, xb, u), lerp(ya, yb, v), Z);
    line3(ctx, [XL, ya + 0.15, Z], [xb + 0.1, ya + 0.15, Z], '#14161a', Math.max(0.8, 0.04 * k));
    line3(ctx, [XL, ya - 0.7, Z], [xb + 0.05, ya + 0.15, Z], '#14161a', Math.max(0.6, 0.025 * k));
    ctx.fillStyle = '#e4d6b4'; ctx.fill(path2([M(0, 0), M(1, 0), M(1, 1), M(0, 1)]));
    const q2 = [M(0.055, 0.02), M(0.945, 0.02), M(0.945, 0.98), M(0.055, 0.98)];
    ctx.fillStyle = '#1d4030'; ctx.fill(path2(q2));
    const g = ctx.createLinearGradient(M(0, 1)[0], M(0, 1)[1], M(0, 0)[0], M(0, 0)[1]);
    g.addColorStop(0, 'rgba(255,190,110,0.3)'); g.addColorStop(0.45, 'rgba(255,190,110,0)'); ctx.fillStyle = g; ctx.fill(path2(q2));
    const asp = (ya - yb) / (xb - xa); // v units to u units
    const word = 'GENCO', h = 0.112;
    for (let i = 0; i < word.length; i++) {
      const v0 = 0.045 + i * 0.128;
      letter(ctx, word[i], (u, v) => M(0.5 + (u - GL[word[i]].w / 2) * h * asp, v0 + v * h), { color: '#ecc86c', width: 0.07 * k, track: 0, jitter: 0.008, shadow: 'rgba(0,0,0,0.5)', sx: 0.6, sy: 0.6 });
    }
    line3(ctx, [lerp(xa, xb, 0.2), lerp(ya, yb, 0.705), Z], [lerp(xa, xb, 0.8), lerp(ya, yb, 0.705), Z], '#e4d6b4', Math.max(0.5, 0.012 * k));
    const small = (txt, v0, hh) => { const L = layout(txt, 0.2); letter(ctx, txt, (u, v) => M(0.5 + (u - L.w / 2) * hh * asp, v0 + v * hh), { color: '#efe2c0', width: 0.03 * k, track: 0.2, jitter: 0.006 }); };
    small('PURA', 0.74, 0.06);
    small('OLIVE OIL', 0.85, 0.05);
    line3(ctx, [xa, ya + 0.02, Z], [xb, ya + 0.02, Z], C.snow, Math.max(1, 0.05 * k));
  }
  function bandSign(ctx, side, z0, z1, v0, v1, txt, ground, ink, o) {
    const G = frect(ctx, side, z0, z1, v0, v1, ground, o || 0.05);
    const L = layout(txt, 0.22), hh = (v1 - v0) * 0.56, w = L.w * hh, uz0 = (z0 + z1) / 2 - w / 2;
    const k = K(side < 0 ? XL : XR, (z0 + z1) / 2);
    letter(ctx, txt, (u, v) => P(...F3(side, uz0 + u * hh, v1 - (v1 - v0) * 0.22 - v * hh, (o || 0.05) + 0.01)), { color: ink, width: Math.max(0.5, hh * 0.16 * k), track: 0.22, jitter: 0.006 });
    return G;
  }
  function hangSign(ctx, Z, xa, xb, ya, yb, txt, ground, ink, border) {
    const M = (u, v) => P(lerp(xa, xb, u), lerp(ya, yb, v), Z), k = K(xa, Z);
    line3(ctx, [XL, ya + 0.25, Z], [xb, ya + 0.25, Z], '#14161a', Math.max(0.6, 0.03 * k));
    line3(ctx, [xa + 0.2, ya + 0.25, Z], [xa + 0.2, ya, Z], '#14161a', 0.5); line3(ctx, [xb - 0.2, ya + 0.25, Z], [xb - 0.2, ya, Z], '#14161a', 0.5);
    ctx.fillStyle = border; ctx.fill(path2([M(0, 0), M(1, 0), M(1, 1), M(0, 1)]));
    ctx.fillStyle = ground; ctx.fill(path2([M(0.03, 0.1), M(0.97, 0.1), M(0.97, 0.9), M(0.03, 0.9)]));
    const L = layout(txt, 0.2), hh = 0.52, sx = 0.9 / (L.w * 1.0);
    letter(ctx, txt, (u, v) => M(0.05 + u * sx, 0.24 + v * hh), { color: ink, width: Math.max(0.5, 0.035 * k), track: 0.2, jitter: 0.008 });
    line3(ctx, [xa, ya + 0.01, Z], [xb, ya + 0.01, Z], C.snow, Math.max(0.8, 0.03 * k));
  }
  function neonSign(ctx, stage) {
    const Z = NEON.Z, xa = XR - 1.55, xb = XR - 0.15, ya = 4.35, yb = 3.6, k = K(xa, Z);
    const M = (u, v) => P(lerp(xa, xb, u), lerp(ya, yb, v), Z);
    if (stage === 0) { const c = M(0.5, 0.5); glow(ctx, c[0], c[1], 1.3 * k, '#ff4a5a', 0.4); return; }
    line3(ctx, [XR, ya + 0.2, Z], [xa, ya + 0.2, Z], '#14161a', Math.max(0.6, 0.03 * k));
    ctx.fillStyle = '#1a1416'; ctx.fill(path2([M(0, 0), M(1, 0), M(1, 1), M(0, 1)]));
    const map = (u, v) => M(0.1 + u * 0.27, 0.2 + v * 0.6);
    letter(ctx, 'CAFFE', map, { color: '#ff5a6a', width: Math.max(0.8, 0.05 * k), track: 0.3, jitter: 0, shadow: '#ff2040', shadowBlur: 6 });
    letter(ctx, 'CAFFE', map, { color: '#ffd8dc', width: Math.max(0.4, 0.018 * k), track: 0.3, jitter: 0 });
  }

  /* ------------------------------------------------------------------ palettes for the people */
  const PAL = {
    don: { trou: '#2a2727', trouDk: '#161414', shoe: '#0e0c0c', shoeLt: '#5a4a40', coatBounce: '#4a3c34', coatMid: '#352d29', scarf: '#d8d2c4', coat: '#2b2522', coatLit: '#8a5e3a', coatDk: '#191514', collar: '#38302b', skin: '#d0946a', skinDk: '#6e4434', hair: '#b8b2a8', hairDk: '#3a2a22', hat: '#4e4a43', hatLit: '#9a7a52', band: '#1a1816', hatTop: '#7d889c', coatTop: '#4e586c', rim: '#d2965a' },
    vendor: { trou: '#2a2624', shoe: '#120e0c', sw: '#3e3634', swLit: '#7a5e48', apron: '#efe2c4', apronSh: '#bca886', skin: '#dea27a', skinDk: '#9e5e42', skinLt: '#f6c49c', eye: '#f8f4ec', pupil: '#16100c', stache: '#4a4038', mouth: '#3a1610', scarf: '#962e24', cap: '#4e443a', capLit: '#8e7a5c' },
    man: { trou: '#121318', shoe: '#08080a', coat: '#1b1d24', coatDk: '#0e0f14', face: '#1e1718', faceLit: '#a8703e', cold: '#4a5468', shirt: '#b8b4ac', scarf: '#6a6660', hat: '#1f2027', top: '#46506a', rim: '#d89452' },
  };
  function walkerPal(i) {
    const coats = ['#3a2a2c', '#2a3042', '#4a3e30', '#2e3a34', '#3c3040'];
    return { trou: '#16171c', shoe: '#0a0a0c', coat: coats[i % 5], coatDk: '#121216', face: '#5a4034', umb: i % 3 === 1 ? '#3e1618' : '#141519', top: '#5a6680', rim: i % 2 ? '#c89058' : '#7a8aa6' };
  }

  /* ------------------------------------------------------------------ the scene as a list of steps */
  function canvasLike(env) { const c = document.createElement('canvas'); c.width = env.pw; c.height = env.ph; const x = c.getContext('2d'); x.setTransform(env.s, 0, 0, env.s, 0, 0); return [c, x]; }
  function groundClip(ctx) {
    const p = new Path2D();
    for (const q of [groundPoly(CL, CR, 0, NEAR + 0.1, ZEND), groundPoly(XL, CL, CURB, NEAR + 0.1, ZEND), groundPoly(CR, XR, CURB, NEAR + 0.1, ZEND)]) p.addPath(path2(proj(q)));
    ctx.clip(p);
  }
  function wavyStrip(ctx, xa, xb, z0, z1, col, wob, ph) {
    const L = [], Rr = [];
    for (let z = z0; z <= z1 + 0.01; z += Math.max(0.25, z * 0.08)) {
      L.push([xa + wob * Math.sin(z * 0.9 + ph) + wob * 0.5 * Math.sin(z * 2.3 + ph * 2), 0.002, z]);
      Rr.push([xb + wob * Math.sin(z * 0.8 + ph + 1.7) + wob * 0.5 * Math.sin(z * 2.9 + ph), 0.002, z]);
    }
    return poly3(ctx, L.concat(Rr.reverse()), col);
  }

  function buildSteps(ctx, seed, env) {
    R = mulberry32(seed ^ 0x2f1a);
    const steps = [];
    const S = (fn) => steps.push(fn);
    const litRand = mulberry32(seed ^ 0x51);
    const litCache = {};
    const litMap = (key, b, f, i) => {
      if (key in litCache) return litCache[key];
      const r = litRand();
      let v = r < 0.36 ? 1 : r < 0.43 ? 2 : r < 0.5 ? 3 : 0;
      if (b.shop === 'genco' && f === 0) v = 2; // the office upstairs is lit
      return (litCache[key] = v);
    };
    const s = env.s;

    /* ---- sky */
    S(() => {
      const g = ctx.createLinearGradient(0, 0, 0, CAM.hy);
      g.addColorStop(0, C.skyTop); g.addColorStop(0.35, C.skyHi); g.addColorStop(0.72, C.skyMid); g.addColorStop(0.93, C.skyLow); g.addColorStop(1, C.skyGlow);
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, CAM.hy + 2);
      // the sky laid in with broad, opaque horizontal strokes
      const stops = [[0, C.skyTop], [0.35, C.skyHi], [0.72, C.skyMid], [0.93, C.skyLow], [1, C.skyGlow]];
      const skyAt = (y) => { const t = clamp(y / CAM.hy, 0, 1); for (let i = 1; i < stops.length; i++) if (t <= stops[i][0]) return mix(stops[i - 1][1], stops[i][1], (t - stops[i - 1][0]) / (stops[i][0] - stops[i - 1][0])); return C.skyGlow; };
      for (let i = 0; i < 220; i++) {
        const y = rnd(0, CAM.hy), x = rnd(250, 1000), w = rnd(40, 200), h = rnd(3, 12);
        const c = mix(skyAt(y + rnd(-60, 60)), R() < 0.5 ? '#ffffff' : '#0a1020', rnd(0, 0.1));
        ctx.fillStyle = rgba(c, rnd(0.3, 0.6)); ctx.beginPath(); ctx.ellipse(x, y, w / 2, h / 2, rnd(-0.03, 0.03), 0, Math.PI * 2); ctx.fill();
      }
      for (let i = 0; i < 9; i++) {
        const y = rnd(160, CAM.hy - 70), x = rnd(380, 880), w = rnd(140, 380), h = rnd(4, 11);
        const t = y / CAM.hy;
        ctx.fillStyle = rgba(t > 0.75 ? '#c4a08e' : '#4d6890', rnd(0.16, 0.3));
        ctx.beginPath(); ctx.ellipse(x, y, w / 2, h / 2, rnd(-0.02, 0.02), 0, Math.PI * 2); ctx.fill();
      }
    });

    /* ---- the far end: cross street, distant blocks, the El */
    S(() => {
      const zf = ZEND + 22;
      for (let x = -40; x < 45; x += 7) {
        const hgt = 9 + ((x * 3.7 + 100) % 9);
        poly3(ctx, [[x, 0, zf], [x + 7.2, 0, zf], [x + 7.2, hgt, zf], [x, hgt, zf]], haze('#3c4458', 150, 60));
        for (let v = 4; v < hgt - 1; v += 3) for (let xx = x + 0.8; xx < x + 6.5; xx += 1.6) if (R() < 0.45) poly3(ctx, [[xx, v, zf - 0.1], [xx + 0.7, v, zf - 0.1], [xx + 0.7, v + 1.2, zf - 0.1], [xx, v + 1.2, zf - 0.1]], mix(C.win, C.haze, 0.35));
      }
      poly3(ctx, groundPoly(-60, 60, 0, ZEND, zf), mix(C.haze, '#c09070', 0.25));
      const ze = ZEND + 9, deck = 6.2, ironC = haze('#1d2130', 110, 140);
      for (let x = -30; x <= 30; x += 6) poly3(ctx, [[x - 0.25, 0, ze], [x + 0.25, 0, ze], [x + 0.25, deck, ze], [x - 0.25, deck, ze]], ironC);
      poly3(ctx, [[-60, deck, ze], [60, deck, ze], [60, deck + 1.3, ze], [-60, deck + 1.3, ze]], ironC);
      ctx.save(); ctx.strokeStyle = rgba('#6a7a98', 0.5); ctx.lineWidth = 0.5;
      for (let x = -40; x < 40; x += 1.2) { const a = P(x, deck, ze - 0.05), b2 = P(x + 1.2, deck + 1.3, ze - 0.05); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b2[0], b2[1]); ctx.stroke(); }
      ctx.restore();
      const tx0 = -22, tx1 = 26;
      poly3(ctx, [[tx0, deck + 1.3, ze], [tx1, deck + 1.3, ze], [tx1, deck + 4.4, ze], [tx0, deck + 4.4, ze]], '#2a2a36');
      for (let x = tx0 + 0.6; x < tx1 - 0.8; x += 1.25) if ((Math.round(x * 4) % 17) !== 3) poly3(ctx, [[x, deck + 2.5, ze - 0.05], [x + 0.75, deck + 2.5, ze - 0.05], [x + 0.75, deck + 3.7, ze - 0.05], [x, deck + 3.7, ze - 0.05]], '#ffe3a0');
      const sp2 = P(4, deck + 4.6, ze); glow(ctx, sp2[0], sp2[1], 10, '#b8d0ff', 0.7);
    });

    /* ---- street, sidewalks, slush */
    S(() => {
      const road = poly3(ctx, groundPoly(CL, CR, 0, NEAR + 0.1, ZEND), C.street);
      const g = ctx.createLinearGradient(0, CAM.hy, 0, H);
      g.addColorStop(0, rgba('#8a96aa', 0.55)); g.addColorStop(0.16, rgba('#4a5a72', 0.32)); g.addColorStop(1, rgba('#0e1420', 0.0));
      ctx.fillStyle = g; ctx.fill(road);
      poly3(ctx, groundPoly(XL, CL, CURB, NEAR + 0.1, ZEND), C.walk);
      poly3(ctx, groundPoly(CR, XR, CURB, NEAR + 0.1, ZEND), mix(C.walk, '#2a3040', 0.3));
      poly3(ctx, [[CL, 0, 0.5], [CL, CURB, 0.5], [CL, CURB, ZEND], [CL, 0, ZEND]], '#6c7383');
      poly3(ctx, [[CR, 0, 3], [CR, CURB, 3], [CR, CURB, ZEND], [CR, 0, ZEND]], '#4e5464');
      // snow lying along the curbs and the foot of the walls
      line3(ctx, [CL, CURB + 0.01, 0.6], [CL, CURB + 0.01, ZEND], rgba(C.snow, 0.85), 1.1);
      line3(ctx, [CR, CURB + 0.01, 3], [CR, CURB + 0.01, ZEND], rgba(C.snowShade, 0.8), 0.9);
      wavyStrip(ctx, XL, XL + 0.35, 0.6, ZEND, rgba(C.snowShade, 0.55), 0.06, 1);
      wavyStrip(ctx, XR - 0.3, XR, 3, ZEND, rgba(C.snowShade, 0.45), 0.06, 2);
    });
    S(() => {
      // the asphalt itself, laid in with horizontal strokes of near-black blues
      ctx.save(); ctx.clip(path2(proj(groundPoly(CL, CR, 0, NEAR + 0.1, ZEND))));
      const cols = ['#2c3646', '#19212e', '#36425a', '#232b3a', '#3c4658'];
      for (let i = 0; i < 900; i++) {
        const y = CAM.hy + (H - CAM.hy) * Math.pow(R(), 1.25), d = y - CAM.hy;
        const len = 8 + d * 0.4 * rnd(0.4, 1.5), hh = 1 + d * 0.02 * rnd(0.6, 1.5);
        ctx.fillStyle = rgba(cols[(R() * cols.length) | 0], rnd(0.3, 0.6));
        ctx.beginPath(); ctx.ellipse(rnd(-40, W + 40), y, len / 2, hh / 2, rnd(-0.02, 0.02), 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    });
    S(() => {
      // the gutters banked with old slush, the roadway marked by tyre tracks through a thin grey film
      wavyStrip(ctx, CL, CL + 0.45, 0.6, ZEND, rgba('#8e98a8', 0.75), 0.07, 0.3);
      wavyStrip(ctx, CL, CL + 0.2, 0.6, ZEND, rgba('#c3cad4', 0.7), 0.04, 1.3);
      wavyStrip(ctx, CR - 0.5, CR, 3, ZEND, rgba('#7e889a', 0.7), 0.07, 2.3);
      wavyStrip(ctx, CR - 0.22, CR, 3, ZEND, rgba('#aab2c0', 0.6), 0.04, 0.8);
      // lumps of grey slush shovelled to the curb, lit from above
      for (const [X0, z0, z1, dir] of [[CL, 2.2, 60, 1], [CR, 3, 60, -1]]) {
        for (let z = z0; z < z1; z += rnd(0.7, 1.5) * (1 + z * 0.05)) {
          const len = rnd(1.2, 2.6) * (1 + z * 0.03), hgt = rnd(0.05, 0.11), w = rnd(0.22, 0.38);
          const top = [], bot = [], hl = [];
          for (let i = 0; i <= 12; i++) { const t = i / 12, zz = z + len * t, hh = hgt * Math.pow(Math.sin(Math.PI * t), 0.55) * (1 + 0.15 * Math.sin(t * 9 + z)); top.push([X0 + dir * w * 0.45, 0.02 + hh, zz]); bot.push([X0 + dir * w, 0.002, zz]); hl.push([X0 + dir * w * 0.45, 0.02 + hh * 0.72, zz]); }
          poly3(ctx, top.concat(bot.slice().reverse()), rgba(mix('#6e788a', '#9aa4b4', R()), 0.95));
          poly3(ctx, top.concat(hl.slice().reverse()), rgba('#d6dee8', 0.7));
        }
      }
      // slush trodden flat between the tyre tracks, each track a dark glossy groove with a raised lip
      for (const [a0, b0, ph] of [[-1.0, -0.22, 0.7], [0.32, 0.98, 1.9], [1.62, 2.3, 3.1], [2.9, 3.35, 4.2]]) {
        wavyStrip(ctx, a0, b0, 0.6, 40, rgba('#4e5a70', 0.45), 0.035, ph);
        wavyStrip(ctx, a0, a0 + 0.06, 0.6, 40, rgba('#8e9ab0', 0.28), 0.025, ph);
        wavyStrip(ctx, b0 - 0.05, b0, 0.6, 40, rgba('#7e8aa0', 0.22), 0.025, ph + 0.5);
      }
    });

    S(() => {
      // old trolley rails let into the asphalt, catching the sky
      for (const X of [0.55, 1.98]) {
        poly3(ctx, [[X - 0.05, 0.002, 0.85], [X + 0.05, 0.002, 0.85], [X + 0.05, 0.002, ZEND], [X - 0.05, 0.002, ZEND]], rgba('#0c1018', 0.6));
        poly3(ctx, [[X - 0.035, 0.003, 0.85], [X - 0.008, 0.003, 0.85], [X - 0.008, 0.003, ZEND], [X - 0.035, 0.003, ZEND]], rgba('#8a9ab4', 0.3));
      }
    });
    for (let i = RIGHT.length - 1; i >= 0; i--) { const b = RIGHT[i]; S(() => { drawBuilding(ctx, 1, b, litMap); for (const f of b.fe) drawFireEscape(ctx, 1, b, f); }); }
    for (let i = LEFT.length - 1; i >= 0; i--) { const b = LEFT[i]; S(() => { drawBuilding(ctx, -1, b, litMap); for (const f of b.fe) drawFireEscape(ctx, -1, b, f); }); }

    /* ---- warm light thrown out of the shop windows across the wet pavement */
    S(() => {
      for (const [side, list] of [[-1, LEFT], [1, RIGHT]]) for (const b of list) {
        if (b.shop === 'dark' || b.z0 > 70) continue;
        const z0 = b.z0 + 0.3, z1 = b.z1 - 0.3, o = 2.6;
        const a = P(...F3(side, (z0 + z1) / 2, CURB, 0)), c = P(...F3(side, (z0 + z1) / 2, CURB, o));
        const g = ctx.createLinearGradient(a[0], a[1], c[0], c[1]);
        const strength = b.shop === 'genco' ? 0.16 : 0.14;
        g.addColorStop(0, rgba('#ffc070', strength)); g.addColorStop(0.5, rgba('#ff9a40', strength * 0.35)); g.addColorStop(1, rgba('#ff9a40', 0));
        poly3(ctx, [F3(side, z0, CURB + 0.003, 0), F3(side, z1, CURB + 0.003, 0), F3(side, z1 + 0.6, CURB + 0.003, o), F3(side, z0 - 0.4, CURB + 0.003, o)], g);
      }
    });

    /* ---- reflections in the wet street: a dark mirror of the sky and the walls, and the lights smeared in it */
    let RB, RBc, RF, RFc, RS, RSc;
    S(() => {
      [RB, RBc] = canvasLike(env);
      const r = RBc;
      const g = r.createLinearGradient(0, CAM.hy, 0, CAM.hy * 2);
      g.addColorStop(0, '#8a8296'); g.addColorStop(0.07, C.skyLow); g.addColorStop(0.28, C.skyMid); g.addColorStop(0.65, C.skyHi); g.addColorStop(1, C.skyTop);
      r.fillStyle = g; r.fillRect(0, CAM.hy, W, H - CAM.hy);
      MIR = 0;
      const zf = ZEND + 22;
      poly3(r, [[-60, 0, zf], [60, 0, zf], [60, 13, zf], [-60, 13, zf]], haze('#3c4458', 150, 60));
      for (const [side, list] of [[1, RIGHT], [-1, LEFT]]) for (let i = list.length - 1; i >= 0; i--) {
        const b = list[i], zm = (b.z0 + b.z1) / 2;
        frect(r, side, b.z0, b.z1, 0, b.h + 0.1, haze(mix(b.brick, '#10141e', 0.55), zm, 70));
        frect(r, side, b.z0, b.z1, b.h - 0.9, b.h + 0.1, haze('#0e1018', zm, 70), 0.6);
      }
      MIR = null;
    });
    S(() => {
      [RF, RFc] = canvasLike(env);
      MIR = 0;
      const r = RFc;
      for (const [side, list] of [[-1, LEFT], [1, RIGHT]]) for (const b of list) {
        if (b.shop === 'dark') continue;
        const zm = (b.z0 + b.z1) / 2, wz1 = b.z1 - (b.shop === 'genco' ? 2.3 : 1.5);
        frect(r, side, b.z0 + 0.35, wz1, CURB + 0.55, 2.95, rgba(haze(b.shop === 'genco' ? '#ffcf6e' : '#f0b060', zm, 90), b.shop === 'genco' ? 0.6 : 0.72));
        const B = bays(b);
        for (let i = 0; i < B.length; i++) if (litMap(side + ':' + b.z0 + ':0:' + i, b, 0, i)) frect(r, side, B[i] - 0.5, B[i] + 0.5, 4.4, 6.1, rgba('#ffc060', 0.35));
      }
      // the stand under its bulbs: a block of orange light
      poly3(r, [sp(0, ST.z0, 0.0), sp(0, ST.z1, 0.0), sp(1, ST.z1, 0.5), sp(1, ST.z0, 0.5)], '#f08a28');
      poly3(r, [[ST.xf, 0, ST.z0], [ST.xf, ST.yf, ST.z0], [ST.xf, ST.yf, ST.z1], [ST.xf, 0, ST.z1]], '#3a2a1a');
      for (const z of BULBZ) { const b = P(-3.3, 2.5, z); glow(r, b[0], b[1], 14, '#fff0c0', 0.9); }
      for (const L of LAMPS) { const p = P(L[0] + L[2] * 0.95, 4.1, L[1]); glow(r, p[0], p[1], Math.max(5, 0.8 * K(L[0], L[1])), '#fff0c8', 0.95); }
      for (let i = 0; i < XMAS.length; i++) xmasString(r, XMAS[i], i, 0);
      for (const x of [0.55, 1.75]) { const p = P(x, 0.72, ONC.Z); glow(r, p[0], p[1], 9, '#fff2d0', 1); }
      for (const x of [LCAR.x0 + 0.12, LCAR.x1 - 0.12]) { const p = P(x, 0.72, LCAR.zf + 0.2); glow(r, p[0], p[1], 6, '#ff4020', 0.9); }
      { const c = P((NEON.x0 + NEON.x1) / 2, 4.0, NEON.Z); glow(r, c[0], c[1], 16, '#ff4a5a', 0.6); }
      const e = P(1.5, 4, ZEND); glow(r, e[0], e[1], 60, '#e8b088', 0.35);
      MIR = null;
      if (window.FamilyLights) for (const b of window.FamilyLights.bulbs()) glow(r, b.x, 2 * CAM.hy - b.y + 210, 9, BULBS[b.i % 5], 0.8);
    });
    S(() => {
      // smear the mirrored lights downward a little, as a wet, slightly rough road does
      [RS, RSc] = canvasLike(env);
      RSc.setTransform(1, 0, 0, 1, 0, 0);
      RSc.globalCompositeOperation = 'lighter';
      const N = 13;
      for (let i = 0; i < N; i++) { RSc.globalAlpha = 0.2 * Math.pow(1 - i / (N + 1), 1.3); RSc.drawImage(RF, Math.round(rnd(-0.8, 0.8) * s), Math.round((i * 2.2 + i * i * 0.55) * s)); }
    });
    let PL = null;
    S(() => {
      // two still puddles hold an unbroken mirror, their edges soft where the water thins
      let pc; [PL, pc] = canvasLike(env);
      pc.setTransform(1, 0, 0, 1, 0, 0);
      pc.globalAlpha = 0.95; pc.drawImage(RB, 0, 0);
      pc.globalCompositeOperation = 'screen'; pc.globalAlpha = 1; pc.drawImage(RS, 0, 0);
      const [MK, mk] = canvasLike(env);
      mk.fillStyle = '#fff'; for (const pd of PUDDLES) mk.fill(path2(proj(puddle(pd))));
      pc.globalCompositeOperation = 'destination-in'; pc.globalAlpha = 1; pc.filter = 'blur(' + (2.6 * s).toFixed(1) + 'px)'; pc.drawImage(MK, 0, 0); pc.filter = 'none';
    });
    S(() => {
      // keep only horizontal dabs of reflection: the way a painter lays a wet street in broken strokes
      const M = document.createElement('canvas'); M.width = env.pw; M.height = env.ph;
      const m = M.getContext('2d'); m.setTransform(s, 0, 0, s, 0, 0);
      for (let y = CAM.hy + 1; y < H; ) {
        const d = (y - CAM.hy) / (H - CAM.hy), st = 1 + d * 8 * rnd(0.7, 1.3);
        for (let x = rnd(-60, 0); x < W; ) {
          const len = rnd(12, 95) * (0.6 + d * 2), hh = st * rnd(0.9, 1.7), gap = rnd(0, 22) * (0.4 + d * 2.2);
          m.fillStyle = 'rgba(255,255,255,' + rnd(0.5, 1).toFixed(2) + ')';
          m.beginPath(); m.ellipse(x + len / 2, y + rnd(-0.4, 0.4) * st, len / 2, hh / 2, rnd(-0.01, 0.01), 0, Math.PI * 2); m.fill();
          x += len + gap;
        }
        y += st;
      }
      for (const c of [RSc, RBc]) { c.globalCompositeOperation = 'destination-in'; c.setTransform(1, 0, 0, 1, 0, 0); c.drawImage(M, 0, 0); c.setTransform(s, 0, 0, s, 0, 0); c.globalCompositeOperation = 'destination-out'; }
      // reflections are strongest at grazing angles, near the horizon, and fade toward our feet
      for (const c of [RSc, RBc]) {
        const g = c.createLinearGradient(0, CAM.hy + 30, 0, H);
        g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.62)');
        c.fillStyle = g; c.fillRect(0, CAM.hy, W, H - CAM.hy);
      }
    });
    S(() => {
      // the roadway is a mirror; the slushy pavements give back much less
      for (const [clip, f] of [[groundPoly(CL, CR, 0, NEAR + 0.1, ZEND), 0.78], [groundPoly(XL, CL, CURB, NEAR + 0.1, ZEND), 0.3], [groundPoly(CR, XR, CURB, NEAR + 0.1, ZEND), 0.3]]) {
        ctx.save();
        ctx.clip(path2(proj(clip)));
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalAlpha = 0.42 * f; ctx.drawImage(RB, 0, 0);
        ctx.globalCompositeOperation = 'screen';
        ctx.globalAlpha = 0.85 * f; ctx.drawImage(RS, 0, 0);
        ctx.filter = 'blur(' + (5 * s).toFixed(1) + 'px)'; ctx.globalAlpha = 0.3 * f; ctx.drawImage(RF, 0, 3 * s);
        ctx.restore();
      }
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 0.92; ctx.drawImage(PL, 0, 0); ctx.restore();
      RB = RBc = RF = RS = RFc = RSc = PL = null;
      // the puddles' rims: broken touches of slush, not a line
      for (const pd of PUDDLES) {
        const pts = proj(puddle(pd));
        for (let i = 0; i < pts.length; i += 1) {
          if (R() < 0.35) continue;
          const q = pts[i], q2 = pts[(i + 1) % pts.length];
          ctx.fillStyle = rgba(R() < 0.5 ? '#c8d0dc' : '#8a96aa', rnd(0.25, 0.55));
          ctx.beginPath(); ctx.ellipse((q[0] + q2[0]) / 2, (q[1] + q2[1]) / 2 + rnd(-0.6, 0.6), Math.hypot(q2[0] - q[0], q2[1] - q[1]) * rnd(0.4, 0.8), rnd(0.6, 1.6), Math.atan2(q2[1] - q[1], q2[0] - q[0]), 0, Math.PI * 2); ctx.fill();
        }
      }
    });

    /* ---- the lights strung across the street, and the lamps */
    S(() => {
      for (let i = XMAS.length - 1; i >= 0; i--) xmasString(ctx, XMAS[i], i, 0);
      for (const L of LAMPS) lamppost(ctx, L[0], L[1], L[2], 0);
      neonSign(ctx, 0);
      for (let i = XMAS.length - 1; i >= 0; i--) xmasString(ctx, XMAS[i], i, 1);
    });
    S(() => {
      // far traffic and people
      drawCar(ctx, { x0: 0.25, x1: 2.05, zf: ONC.Z, facing: 'front', col: haze('#20242c', ONC.Z, 70), headOn: true, snow: true });
      for (const x of [0.55, 1.75]) { const p = P(x, 0.72, ONC.Z); glow(ctx, p[0], p[1], 7, '#fff2d0', 0.9); }
      drawCar(ctx, { x0: CR - 1.95, x1: CR - 0.15, zf: 33, facing: 'front', col: haze('#2e3a30', 33, 70), snow: true });
      drawCar(ctx, { x0: CL + 0.15, x1: CL + 1.95, zf: 41, facing: 'rear', col: haze('#3a2c2a', 41, 70), snow: true });
      for (let i = LAMPS.length - 1; i >= 0; i--) { const L = LAMPS[i]; if (L[1] > 30) lamppost(ctx, L[0], L[1], L[2], 1); }
      for (const w of WALKERS) if (w[1] > 30) { const p = P(w[0], CURB, w[1]); drawFig(ctx, 'walker', p[0], p[1], K(w[0], w[1]), walkerPal(w[2]), { flip: w[3] }); }
    });
    S(() => {
      // nearer parked cars, people, the right-hand lamps
      drawCar(ctx, { x0: CR - 1.9, x1: CR - 0.1, zf: 17.2, facing: 'front', col: '#3a1e22', snow: true, warmSide: true });
      drawCar(ctx, LCAR);
      for (let i = LAMPS.length - 1; i >= 0; i--) { const L = LAMPS[i]; if (L[1] <= 30) lamppost(ctx, L[0], L[1], L[2], 1); }
      for (const w of WALKERS) if (w[1] <= 30) { const p = P(w[0], CURB, w[1]); drawFig(ctx, 'walker', p[0], p[1], K(w[0], w[1]), walkerPal(w[2]), { flip: w[3] }); }
      neonSign(ctx, 1);
      hangSign(ctx, 13.85, XL + 0.12, XL + 1.95, 3.95, 3.35, 'SALUMERIA', '#efe4c6', '#a42a1e', '#2a2a2a');
      bandSign(ctx, -1, 13.7, 20.3, 2.98, 3.6, 'LATTICINI  FORMAGGI', '#e4d8b8', '#283c2c');
      bandSign(ctx, -1, 8.4, 13.2, 3.08, 3.62, 'GENCO PURA OLIVE OIL CO.', '#1d3a2c', '#e8c060');
      bladeSign(ctx);
    });
    S(() => {
      // the dark sedan, its door open, and the two men stepping off the curb
      const sx0 = CR - 1.88, sx1 = CR - 0.1;
      // its dark reflection
      ctx.save(); groundClip(ctx); MIR = 0;
      poly3(ctx, CARP.map((q) => [sx0, q[1] * 0.9, 10.4 + q[0]]).concat([[sx0, 0.3, 15.6]]), 'rgba(6,8,12,0.55)');
      MIR = null; ctx.restore();
      drawCar(ctx, { x0: sx0, x1: sx1, zf: 10.4, facing: 'front', col: '#11141b', snow: true, door: 0.95, dome: true, glass: '#1e2636' });
      hydrant(ctx, CR + 0.35, 7.6);
      const mb = P(3.75, CURB, 9.9), kb = K(3.75, 9.9);
      const ma = P(2.5, 0, 8.6), ka = K(2.5, 8.6);
      ctx.save(); groundClip(ctx);
      ctx.filter = 'blur(' + (0.8 * s).toFixed(1) + 'px)'; drawFig(ctx, 'manA', ma[0], ma[1], ka, PAL.man, { mono: 'rgba(5,6,10,0.26)', mirror: true }); drawFig(ctx, 'manB', mb[0], mb[1], kb, PAL.man, { mono: 'rgba(5,6,10,0.22)', mirror: true }); ctx.filter = 'none';
      ctx.restore();
      drawFig(ctx, 'manB', mb[0], mb[1], kb, PAL.man);
      drawFig(ctx, 'manA', ma[0], ma[1], ka, PAL.man);
    });
    S(() => { drawManhole(ctx); });
    S(() => {
      // the awning seen from below, the vendor behind his fruit, the bulbs' glow
      drawAwning(ctx, true);
      drawBulbs(ctx, 0);
      drawScale(ctx);
    });
    S(() => { drawStand(ctx); drawAwning(ctx, false); drawBulbs(ctx, 1); });
    S(() => {
      // the Don, and the bag between his hand and the vendor's
      const d = P(DON.X, CURB, DON.Z), kd = K(DON.X, DON.Z);
      const v = P(VEND.X, CURB, VEND.Z), kv = K(VEND.X, VEND.Z);
      const dh = [d[0] - 0.5 * kd, d[1] - 1.06 * kd], vh = [v[0] + 0.37 * kv, v[1] - 1.21 * kv];
      // his reflection on the wet pavement
      ctx.save(); groundClip(ctx);
      ctx.filter = 'blur(' + (0.8 * s).toFixed(1) + 'px)'; drawFig(ctx, 'don', d[0], d[1], kd, PAL.don, { mono: 'rgba(8,6,6,0.2)', mirror: true, wide: 1.12 }); drawFig(ctx, 'vendor', v[0], v[1], kv, PAL.vendor, { mono: 'rgba(8,6,6,0.14)', mirror: true }); ctx.filter = 'none';
      ctx.restore();
      drawFig(ctx, 'vendor', v[0], v[1], kv, PAL.vendor);
      drawSpill(ctx, 1, 3);
      drawBag(ctx, [lerp(vh[0], dh[0], 0.45), lerp(vh[1], dh[1], 0.45) + 0.06 * kd]);
      drawFig(ctx, 'don', d[0], d[1], kd, PAL.don, { wide: 1.12 });
    });
    S(() => { drawLitter(ctx); drawSpill(ctx, 3, SPILL.length); });
    S(() => { drawSteam(ctx, env); });

    /* ---- the unevenness of opaque paint: broad, faint passages a shade lighter or darker */
    S(() => {
      for (let i = 0; i < 260; i++) {
        const x = rnd(-40, W + 40), y = rnd(-40, H + 40), r = rnd(30, 110), light = R() < 0.5, sky = y < CAM.hy - 80;
        const c = light ? (sky ? '#c8d4ea' : '#e8d8c0') : '#060a14', a = rnd(0.02, 0.045) * (sky ? 0.45 : 1);
        ctx.save(); ctx.translate(x, y); ctx.scale(1, rnd(0.12, 0.3)); ctx.rotate(rnd(-0.05, 0.05));
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
        g.addColorStop(0, rgba(c, a)); g.addColorStop(0.6, rgba(c, a * 0.6)); g.addColorStop(1, rgba(c, 0));
        ctx.fillStyle = g; ctx.fillRect(-r, -r, 2 * r, 2 * r); ctx.restore();
      }
    });

    /* ---- the nearest string of Christmas lights: the shared wire that runs through all four drawings */
    S(() => { drawSharedString(ctx); });

    /* ---- falling snow: spatter, the way the magazine painters did it with a stiff brush */
    S(() => {
      for (let i = 0; i < 1100; i++) {
        const x = rnd(-5, W + 5), y = rnd(-5, H + 5), q = R(), r = 0.45 + 2.0 * q * q * q;
        ctx.fillStyle = rgba(i % 7 ? '#eef3f9' : '#d8e2ee', rnd(0.55, 0.95));
        ctx.beginPath(); ctx.ellipse(x, y, r, r * rnd(0.8, 1.15), rnd(0, 3), 0, Math.PI * 2); ctx.fill();
      }
    });
    S(() => {
      const g = ctx.createRadialGradient(W * 0.45, H * 0.5, H * 0.35, W * 0.5, H * 0.5, H * 0.8);
      g.addColorStop(0, 'rgba(10,14,28,0)'); g.addColorStop(1, 'rgba(10,14,28,0.38)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    });
    return steps;
  }
  const XMAS = [24, 34, 48, 68];
  const PUDDLES = [[0.2, 3.7, 0.6, 0.34, 1], [2.25, 6.2, 0.55, 0.36, 2]];
  function puddle(pd) {
    const out = [];
    for (let i = 0; i < 40; i++) {
      const a = (i / 40) * Math.PI * 2, w = 1 + 0.16 * Math.sin(a * 3 + pd[4]) + 0.08 * Math.sin(a * 7 + pd[4] * 2);
      out.push([pd[0] + Math.cos(a) * pd[2] * w, 0.004, pd[1] + Math.sin(a) * pd[3] * w]);
    }
    return out;
  }
  const LAMPS = [[CL - 0.4, 12.2, 1], [CL - 0.4, 38, 1], [CL - 0.4, 64, 1], [CR + 0.4, 21, -1], [CR + 0.4, 47, -1], [CR + 0.4, 73, -1]];
  const ONC = { Z: 56 };
  const LCAR = { x0: CL + 0.15, x1: CL + 1.95, zf: 17.5, facing: 'rear', col: '#3c4434', snow: true, tailOn: true };
  const NEON = { x0: XR - 0.15, x1: XR - 1.55, Z: 19.6 };
  // [X, Z, palette, flip]
  const WALKERS = [[-3.4, 15.8, 0, false], [-2.6, 24.5, 1, true], [6.3, 25.5, 2, true], [5.2, 33, 3, false], [6.6, 45, 4, true], [-3.0, 36, 2, false], [1.2, 52, 1, true]];

  /* ------------------------------------------------------------------ runtime */
  (window.PIECES = window.PIECES || []).push({
    id: 'fruitstand',
    title: 'The Fruit Stand',
    medium: 'Gouache on illustration board, in the manner of 1945',
    note: 'Ninth Avenue, a week before Christmas',
    about: 'An original interpretation of Puzo\'s novel, not the film: the last ordinary moment of a December dusk, when the old man stops to buy fruit and two men step off the curb across the street. Painted as a 1940s magazine cover would be, in flat opaque colour, warm windows against a cold blue street, so the violence stays a held breath.',
    tone: 'dark',
    room: '#15161b',
    mount(el, api) {
      const EXPORT = /[?&]export\b/.test(location.search);
      const TIMING = /[?&]steptime\b/.test(location.search) ? [] : null;
      el.style.background = EXPORT ? '#1a1f2a' : '#15161b';
      el.style.overflow = 'hidden';
      const board = document.createElement('div');
      const cv = document.createElement('canvas');
      board.appendChild(cv); el.appendChild(board);
      cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block';
      let alive = true, job = 0, lastKey = '', timer = 0, readyCalled = false;
      if (EXPORT) { api.ready(); readyCalled = true; }

      function place() {
        const r = el.getBoundingClientRect();
        let w, h;
        if (EXPORT) { w = r.width; h = r.height; board.style.cssText = 'position:absolute;left:0;top:0;width:' + w + 'px;height:' + h + 'px'; }
        else {
          const m = Math.max(14, Math.min(r.width, r.height) * 0.045);
          const s = Math.min((r.width - 2 * m) / W, (r.height - 2 * m) / H);
          w = Math.round(W * s); h = Math.round(H * s);
          board.style.cssText = 'position:absolute;left:' + Math.round((r.width - w) / 2) + 'px;top:' + Math.round((r.height - h) / 2) + 'px;width:' + w + 'px;height:' + h + 'px;box-shadow:0 0 0 ' + Math.max(4, Math.round(w * 0.012)) + 'px #e9e2d2,0 18px 60px rgba(0,0,0,.6)';
        }
        return { w, h };
      }
      async function render(my, w, h) {
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        const pw = Math.round(Math.min(W * 2, w * dpr)), ph = Math.round(pw * H / W);
        const off = document.createElement('canvas'); off.width = pw; off.height = ph;
        const ctx = off.getContext('2d');
        ctx.setTransform(pw / W, 0, 0, ph / H, 0, 0);
        const steps = buildSteps(ctx, api.seed >>> 0, { pw, ph, s: pw / W });
        let t0 = performance.now();
        for (let i = 0; i < steps.length; i++) {
          if (!alive || my !== job) return;
          const ts = performance.now();
          ctx.save(); steps[i](); ctx.restore();
          if (TIMING) TIMING.push([i, Math.round(performance.now() - ts)]);
          if (performance.now() - t0 > 40) { await new Promise((r) => requestAnimationFrame(r)); t0 = performance.now(); }
        }
        if (!alive || my !== job) return;
        cv.width = pw; cv.height = ph; cv.getContext('2d').drawImage(off, 0, 0);
        if (!readyCalled) { readyCalled = true; api.ready(); }
        if (TIMING) console.log('steps ' + JSON.stringify(TIMING.filter((t) => t[1] > 60)) + ' total ' + Math.round(TIMING.reduce((a, t) => a + t[1], 0)));
        if (EXPORT) document.documentElement.dataset.exportReady = '1';
      }
      function schedule() {
        const { w, h } = place();
        const key = Math.round(w / 40) + 'x' + Math.round(h / 40);
        if (key === lastKey) return;
        lastKey = key; job++;
        const my = job;
        clearTimeout(timer);
        timer = setTimeout(() => render(my, w, h), lastKey && job > 1 ? 250 : 0);
      }
      const ro = new ResizeObserver(() => { if (alive) schedule(); });
      ro.observe(el);
      schedule();
      return { destroy() { alive = false; job++; clearTimeout(timer); ro.disconnect(); } };
    },
  });
})();
