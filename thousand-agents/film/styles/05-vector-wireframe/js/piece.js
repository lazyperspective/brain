/* 1000 Agents — the first 3 seconds as a glowing 3D vector wireframe.
   Canvas 2D only: every mark is a 3D line segment, projected by hand, tested against the scene's solids for
   hidden-line dimming, drawn additively and bloomed. Each frame is a pure function of t. */
(function () {
  'use strict';
  const W = 1920, H = 1080, DUR = 3;
  const params = new URLSearchParams(location.search);
  const canvas = document.getElementById('c');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  const L = mk(W, H), lx = L.getContext('2d');            // the sharp line layer
  const G2 = mk(W / 2, H / 2), g2 = G2.getContext('2d');  // tight phosphor halo
  const G4 = mk(W / 4, H / 4), g4 = G4.getContext('2d');  // wide bloom

  /* ---------------------------------------------------------------- palette */
  const COL = {
    coral: [217, 119, 87], light: [242, 165, 133], shade: [168, 85, 59], cream: [255, 226, 200],
    lilac: [146, 128, 242], lilacHi: [190, 178, 255], lilacDim: [96, 84, 190],
  };

  /* ---------------------------------------------------------------- maths */
  const clamp = (x, a, b) => x < a ? a : x > b ? b : x;
  const sat = (x) => clamp(x, 0, 1);
  const lerp = (a, b, f) => a + (b - a) * f;
  const smooth = (x) => { x = sat(x); return x * x * (3 - 2 * x); };
  const ss = (a, b, x) => smooth((x - a) / (b - a));
  const RAD = Math.PI / 180;
  function mulberry(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function keys(t, k) {                                   // eased keyframes [[t,v],...]
    if (t <= k[0][0]) return k[0][1];
    for (let i = 1; i < k.length; i++) if (t <= k[i][0]) return lerp(k[i - 1][1], k[i][1], smooth((t - k[i - 1][0]) / (k[i][0] - k[i - 1][0])));
    return k[k.length - 1][1];
  }
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const mix3 = (a, b, f) => [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
  // 3x3 matrices, row-major
  const mmul = (a, b) => { const r = new Array(9); for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) r[i * 3 + j] = a[i * 3] * b[j] + a[i * 3 + 1] * b[3 + j] + a[i * 3 + 2] * b[6 + j]; return r; };
  const mapply = (m, v) => [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]];
  const minv = (m) => {
    const a = m[0], b = m[1], c = m[2], d = m[3], e = m[4], f = m[5], g = m[6], h = m[7], i = m[8];
    const A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g, det = a * A + b * B + c * C;
    return [A / det, (c * h - b * i) / det, (b * f - c * e) / det, B / det, (a * i - c * g) / det, (c * d - a * f) / det, C / det, (b * g - a * h) / det, (a * e - b * d) / det];
  };
  const rotY = (a) => { const c = Math.cos(a), s = Math.sin(a); return [c, 0, s, 0, 1, 0, -s, 0, c]; };
  const rotX = (a) => { const c = Math.cos(a), s = Math.sin(a); return [1, 0, 0, 0, c, -s, 0, s, c]; };
  const rotZ = (a) => { const c = Math.cos(a), s = Math.sin(a); return [c, -s, 0, s, c, 0, 0, 0, 1]; };
  const scl = (x, y, z) => [x, 0, 0, 0, y, 0, 0, 0, z];
  const xf = (m, o) => ({ m, o, im: minv(m) });
  const xfP = (x, p) => add(mapply(x.m, p), x.o);
  const xfCompose = (p, c) => xf(mmul(p.m, c.m), add(mapply(p.m, c.o), p.o));

  /* ---------------------------------------------------------------- camera: a slow orbit with a gentle push-in */
  let E, cR, cU, cF, FOC;
  const camTarget = [0, 0, 0];
  function setCam(t) {
    const p = t / DUR;
    const az = lerp(-17, 13, p) * RAD, el = lerp(12.5, 15, p) * RAD, d = lerp(20.0, 18.3, p);
    const rise = ss(1.9, 3.0, t);
    camTarget[0] = 0.55; camTarget[1] = lerp(2.05, 3.0, rise); camTarget[2] = 0;
    E = [camTarget[0] + d * Math.sin(az) * Math.cos(el), camTarget[1] + d * Math.sin(el), camTarget[2] + d * Math.cos(az) * Math.cos(el)];
    cF = norm(sub(camTarget, E)); cR = norm(cross(cF, [0, 1, 0])); cU = cross(cR, cF);
    FOC = (H / 2) / Math.tan(15.5 * RAD);
  }
  const toCam = (p) => { const v = sub(p, E); return [dot(v, cR), dot(v, cU), dot(v, cF)]; };
  const scr = (c) => [W / 2 + c[0] / c[2] * FOC, H / 2 - c[1] / c[2] * FOC];
  const project = (p) => scr(toCam(p));

  /* ---------------------------------------------------------------- hidden-line solids: oriented boxes */
  let OCC = [];
  function occluder(x, mn, mx) { OCC.push({ x, mn, mx, cl: mapply(x.im, sub(E, x.o)) }); }
  function hidden(P) {
    for (let k = 0; k < OCC.length; k++) {
      const o = OCC[k], pl = mapply(o.x.im, sub(P, o.x.o)), c = o.cl;
      let s0 = 0, s1 = 1, ok = true;
      for (let a = 0; a < 3; a++) {
        const d = pl[a] - c[a];
        if (Math.abs(d) < 1e-9) { if (c[a] < o.mn[a] || c[a] > o.mx[a]) { ok = false; break; } continue; }
        let u = (o.mn[a] - c[a]) / d, v = (o.mx[a] - c[a]) / d;
        if (u > v) { const w = u; u = v; v = w; }
        if (u > s0) s0 = u; if (v < s1) s1 = v;
        if (s0 > s1) { ok = false; break; }
      }
      if (ok && s0 < 0.9965 && s1 - s0 > 0.0012) return true;
    }
    return false;
  }

  /* ---------------------------------------------------------------- the display list */
  let SEG = new Map(), DOTS = [];
  function seg2(x1, y1, x2, y2, col, w, a) {
    if (a < 0.012) return;
    const aq = Math.min(40, Math.round(a * 32));
    if (!aq) return;
    const key = col + '|' + w + '|' + aq;
    let b = SEG.get(key);
    if (!b) { b = []; SEG.set(key, b); }
    b.push(x1, y1, x2, y2);
  }
  const dot2 = (x, y, col, r, a) => { if (a > 0.02) DOTS.push(x, y, col, r, a); };
  const NEAR = 0.6;
  /* a 3D line. st: {c, w, a, hid (alpha multiplier for hidden parts; 0 = do not draw), occ (test occlusion), rev (0..1 traced-in
     fraction), dots (bright dwell points at the ends), fade (depth attenuation)} */
  function line3(A, B, st) {
    let rev = st.rev === undefined ? 1 : st.rev;
    if (rev <= 0) return;
    if (rev < 1) B = mix3(A, B, rev);
    let ca = toCam(A), cb = toCam(B);
    if (ca[2] < NEAR && cb[2] < NEAR) return;
    if (ca[2] < NEAR) { const f = (NEAR - ca[2]) / (cb[2] - ca[2]); A = mix3(A, B, f); ca = toCam(A); }
    if (cb[2] < NEAR) { const f = (NEAR - cb[2]) / (ca[2] - cb[2]); B = mix3(B, A, f); cb = toCam(B); }
    const sa = scr(ca), sb = scr(cb);
    const fade = st.fade === false ? 1 : clamp(1.55 - (ca[2] + cb[2]) * 0.5 / 26, 0.25, 1.1);
    const a = st.a * fade, w = st.w;
    if (rev < 1) dot2(sb[0], sb[1], st.c, w * 1.9, Math.min(1, a * 1.6));
    if (!st.occ) { seg2(sa[0], sa[1], sb[0], sb[1], st.c, w, a); return; }
    const len = Math.hypot(B[0] - A[0], B[1] - A[1], B[2] - A[2]);
    const n = clamp(Math.ceil(len / (st.step || 0.09)), 1, 64);
    const hid = st.hid || 0;
    let run = -1, state = false, v0 = false, v1 = false;
    for (let i = 0; i <= n; i++) {
      let h = false;
      if (i < n) { h = hidden(mix3(A, B, (i + 0.5) / n)); if (i === 0) v0 = !h; if (i === n - 1) v1 = !h; }
      if (i === 0) { run = 0; state = h; continue; }
      if (i === n || h !== state) {
        const f0 = run / n, f1 = i / n;
        // interpolate in screen space with perspective-correct parameter
        const p0 = f0 === 0 ? sa : scr([lerp(ca[0], cb[0], f0), lerp(ca[1], cb[1], f0), lerp(ca[2], cb[2], f0)]);
        const p1 = f1 === 1 ? sb : scr([lerp(ca[0], cb[0], f1), lerp(ca[1], cb[1], f1), lerp(ca[2], cb[2], f1)]);
        if (!state) seg2(p0[0], p0[1], p1[0], p1[1], st.c, w, a);
        else if (hid > 0) seg2(p0[0], p0[1], p1[0], p1[1], st.c, 1, a * hid);
        run = i; state = h;
      }
    }
    if (st.dots) {
      if (v0) dot2(sa[0], sa[1], st.c, w * 1.25, a * 0.9);
      if (v1 && rev >= 1) dot2(sb[0], sb[1], st.c, w * 1.25, a * 0.9);
    }
  }
  function poly3(pts, st, closed, x) {
    const n = pts.length, m = closed ? n : n - 1;
    for (let i = 0; i < m; i++) {
      const a = pts[i], b = pts[(i + 1) % n];
      line3(x ? xfP(x, a) : a, x ? xfP(x, b) : b, st);
    }
  }
  function boxPts(mn, mx) {
    return [[mn[0], mn[1], mn[2]], [mx[0], mn[1], mn[2]], [mx[0], mx[1], mn[2]], [mn[0], mx[1], mn[2]],
            [mn[0], mn[1], mx[2]], [mx[0], mn[1], mx[2]], [mx[0], mx[1], mx[2]], [mn[0], mx[1], mx[2]]];
  }
  const BOXE = [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]];
  function box3(x, mn, mx, st, stFn) {
    const p = boxPts(mn, mx).map((q) => xfP(x, q));
    for (let i = 0; i < 12; i++) line3(p[BOXE[i][0]], p[BOXE[i][1]], stFn ? stFn(st) : st);
  }
  const inset = (mn, mx, e) => [[mn[0] + e, mn[1] + e, mn[2] + e], [mx[0] - e, mx[1] - e, mx[2] - e]];

  /* ---------------------------------------------------------------- stroke font (own glyphs, on a 4x6 cell) */
  const GLY = {
    '0': [[[1, 0], [3, 0], [4, 1], [4, 5], [3, 6], [1, 6], [0, 5], [0, 1], [1, 0]]],
    '1': [[[1, 5], [2, 6], [2, 0]], [[1, 0], [3, 0]]],
    '2': [[[0, 5], [1, 6], [3, 6], [4, 5], [4, 3.6], [0, 0], [4, 0]]],
    '3': [[[0, 6], [4, 6], [2, 3.5], [3, 3.5], [4, 2.5], [4, 1], [3, 0], [1, 0], [0, 1]]],
    '4': [[[3, 0], [3, 6], [0, 2], [4, 2]]],
    '5': [[[4, 6], [0, 6], [0, 3.5], [3, 3.5], [4, 2.5], [4, 1], [3, 0], [0, 0]]],
    '6': [[[4, 6], [1, 6], [0, 5], [0, 1], [1, 0], [3, 0], [4, 1], [4, 2.5], [3, 3.5], [0, 3.5]]],
    '7': [[[0, 6], [4, 6], [1.5, 0]]],
    '8': [[[1, 3.2], [0, 4.2], [0, 5], [1, 6], [3, 6], [4, 5], [4, 4.2], [3, 3.2], [1, 3.2], [0, 2.2], [0, 1], [1, 0], [3, 0], [4, 1], [4, 2.2], [3, 3.2]]],
    '9': [[[0, 0], [3, 0], [4, 1], [4, 5], [3, 6], [1, 6], [0, 5], [0, 3.5], [1, 2.5], [4, 2.5]]],
    'A': [[[0, 0], [0, 4], [2, 6], [4, 4], [4, 0]], [[0, 2.4], [4, 2.4]]],
    'G': [[[4, 5], [3, 6], [1, 6], [0, 5], [0, 1], [1, 0], [3, 0], [4, 1], [4, 3], [2.2, 3]]],
    'E': [[[4, 6], [0, 6], [0, 0], [4, 0]], [[0, 3], [3, 3]]],
    'N': [[[0, 0], [0, 6], [4, 0], [4, 6]]],
    'T': [[[0, 6], [4, 6]], [[2, 6], [2, 0]]],
    'S': [[[4, 5], [3, 6], [1, 6], [0, 5], [0, 4], [1, 3], [3, 3], [4, 2], [4, 1], [3, 0], [1, 0], [0, 1]]],
    'I': [[[1, 6], [3, 6]], [[2, 6], [2, 0]], [[1, 0], [3, 0]]],
    'M': [[[0, 0], [0, 6], [2, 3], [4, 6], [4, 0]]],
  };
  const ADV = 5.7;
  const textW = (s) => s.length * ADV - 1.7;
  // text through an arbitrary mapper (gx, gy in glyph units) -> emits segments via cb(a, b, index)
  function text(s, cb) {
    let k = 0;
    for (let i = 0; i < s.length; i++) {
      const g = GLY[s[i]];
      if (g) for (const pl of g) for (let j = 0; j < pl.length - 1; j++) cb([pl[j][0] + i * ADV, pl[j][1]], [pl[j + 1][0] + i * ADV, pl[j + 1][1]], k++);
    }
  }

  /* ---------------------------------------------------------------- the floor: a receding perspective grid */
  const GC = [0.75, 0, 0];                                // the grid's centre of attention
  function drawGrid(t) {
    const reach = 4.5 + 38 * (1 - Math.pow(1 - sat(t / 0.9), 2.2));       // the grid sweeps outward from the folder
    const N = 26;
    const aAt = (x, z) => {
      const d = Math.hypot(x - GC[0], (z - GC[2]) * 1.0);
      return Math.exp(-(d * d) / 150) * ss(reach, reach - 3.5, Math.hypot(x - 3.05, z + 0.15));
    };
    for (let i = -N; i <= N; i++) {
      const major = (i % 4) === 0;
      for (let dir = 0; dir < 2; dir++) {
        for (let j = -N; j < N; j++) {
          const a0 = dir ? [i + 1, 0, j] : [j, 0, i], b0 = dir ? [i + 1, 0, j + 1] : [j + 1, 0, i];
          if (dir && i === N) continue;
          const mx = (a0[0] + b0[0]) / 2, mz = (a0[2] + b0[2]) / 2;
          const a = aAt(mx, mz) * (major && !dir || (dir && ((i + 1) % 4) === 0) ? 0.5 : 0.24);
          if (a < 0.012) continue;
          const nearObj = mx > -11 && mx < 6.5 && mz > -9 && mz < 4;
          line3(a0, b0, { c: 'lilac', w: 1, a, occ: nearObj, hid: 0.3, step: 0.2 });
        }
      }
    }
    // the wavefront of the sweep: one faint ring travelling outward on the floor
    const wf = sat(t / 0.9);
    if (wf < 1) {
      const R = reach - 1.2, n = 96, a = 0.5 * (1 - wf) * (1 - wf);
      for (let i = 0; i < n; i++) {
        const u = i / n * 6.28318, v = (i + 1) / n * 6.28318;
        line3([3.05 + Math.cos(u) * R, 0, -0.15 + Math.sin(u) * R], [3.05 + Math.cos(v) * R, 0, -0.15 + Math.sin(v) * R], { c: 'lilacHi', w: 1.5, a, occ: false });
      }
    }
  }

  /* ---------------------------------------------------------------- the hero: the coral block, as a wireframe solid */
  const BW = 1.3, BY0 = 0.56, BY1 = 2.16, BD = 0.74, BR = 0.34;     // body half-width, bottom, top, half-depth, corner radius
  const PROFILE = (function () {                                    // the rounded-rectangle front profile
    const p = [], n = 5;
    const cs = [[BW - BR, BY1 - BR, 0], [-BW + BR, BY1 - BR, 90], [-BW + BR, BY0 + BR, 180], [BW - BR, BY0 + BR, 270]];
    for (const c of cs) for (let i = 0; i <= n; i++) { const a = (c[2] + 90 * i / n) * RAD; p.push([c[0] + Math.cos(a) * BR, c[1] + Math.sin(a) * BR]); }
    return p;
  })();
  const TANG = [[BW, BY1 - BR], [BW - BR, BY1], [-BW + BR, BY1], [-BW, BY1 - BR], [-BW, BY0 + BR], [-BW + BR, BY0], [BW - BR, BY0], [BW, BY0 + BR]];
  const LEGS = [[-0.9, 0.47], [0.9, 0.47], [-0.9, -0.47], [0.9, -0.47]];
  const T_SIGNAL = 1.95;
  const HOME = [-1.95, 0.25];
  function hop(t, t0, t1, h) {                            // one hop: returns {p: travel 0..1, y, sq}
    const f = sat((t - t0) / (t1 - t0));
    const g0 = 0.16, g1 = 0.86;                           // crouch, air, land
    const a = sat((f - g0) / (g1 - g0));
    let sq = 1;
    if (f < g0) sq = 1 - 0.16 * Math.sin(Math.PI * f / g0 * 0.5 + 0) * (f / g0);
    else if (f > g1) sq = 1 - 0.2 * Math.sin(Math.PI * (f - g1) / (1 - g1));
    else sq = 1 + 0.1 * Math.sin(Math.PI * a) - 0.16 * (1 - sat(a * 6));
    return { p: a - Math.sin(a * 6.28318) * 0.04, y: h * 4 * a * (1 - a), sq, air: a > 0 && a < 1 ? Math.sin(Math.PI * a) : 0 };
  }
  function heroAt(t) {
    const s = { x: HOME[0], y: 0, z: HOME[1], sq: 1, air: 0 };
    const T0 = 0.04, T1 = 1.25, NH = 4, X0 = -10.6;
    if (t < T1) {
      const u = sat((t - T0) / (T1 - T0)) * NH, k = Math.min(NH - 1, Math.floor(u));
      const hs = [1.25, 1.2, 1.05, 0.8];
      const h = hop(u - k, 0, 1, hs[k]);
      // hops shorten as it arrives
      const stops = [0, 0.3, 0.57, 0.81, 1];
      const p = lerp(stops[k], stops[k + 1], h.p);
      s.x = lerp(X0, HOME[0], p); s.y = h.y; s.sq = h.sq; s.air = h.air;
      s.z = HOME[1] + (1 - p) * 0.9;
    } else if (t > T_SIGNAL - 0.11 && t < T_SIGNAL + 0.33) {
      const h = hop(t, T_SIGNAL - 0.11, T_SIGNAL + 0.33, 0.85); s.y = h.y; s.sq = h.sq; s.air = h.air;
    } else if (t > 2.52 && t < 2.86) {
      const h = hop(t, 2.52, 2.86, 0.32); s.y = h.y; s.sq = lerp(1, h.sq, 0.6); s.air = h.air;
    } else if (t >= T1 && t < T1 + 0.2) {
      const f = (t - T1) / 0.2; s.sq = 1 + 0.05 * Math.sin(f * Math.PI * 2) * (1 - f);       // settle
    }
    s.sq += 0.012 * Math.sin(t * 5.2 + 1);                // breathing
    s.yaw = keys(t, [[0, 44], [1.0, 44], [1.3, 60], [1.47, 60], [1.6, -22], [1.72, -22], [1.86, 30], [2.25, 30], [2.6, 44], [3, 46]]) * RAD;
    s.pitch = keys(t, [[1.2, 0], [1.34, 3], [1.5, 0], [2.2, 0], [2.6, -6], [3, -7]]) * RAD;
    s.gx = keys(t, [[1.15, 0], [1.3, 0.08], [1.47, 0.08], [1.58, -0.08], [1.72, -0.08], [1.86, 0.05], [3, 0.05]]);
    s.gy = keys(t, [[2.2, 0], [2.5, 0.07], [3, 0.07]]);
    const bl = (c, w) => 1 - Math.max(0, 1 - Math.abs(t - c) / w);
    s.eye = Math.min(bl(1.8, 0.07), bl(0.72, 0.06), bl(2.74, 0.06));
    s.eye = s.eye * s.eye;
    s.mouth = keys(t, [[1.92, 0], [1.99, 1], [2.3, 1], [2.44, 0]]);
    s.arm = keys(t, [[1.86, 0], [1.98, 1], [2.36, 1], [2.62, 0.3], [3, 0.22]]);
    return s;
  }
  function heroXf(s) {
    const k = 1 / Math.sqrt(s.sq);
    return xf(mmul(rotY(s.yaw), mmul(rotX(s.pitch), scl(k, s.sq, k))), [s.x, s.y, s.z]);
  }
  function armXf(hx, s, side) {                           // side +1: the arm nearest the folder, the one that gives the signal
    const up = side > 0 ? s.arm : 0;
    const ang = (-14 + 72 * up + 6 * s.air) * RAD;
    const m = mmul(scl(side, 1, 1), mmul(rotZ(ang), scl(1 + 0.3 * up, 1, 1)));
    return xfCompose(hx, xf(m, [side * (BW - 0.04), 1.36, 0]));
  }
  const ARM_MN = [0, -0.2, -0.2], ARM_MX = [0.42, 0.2, 0.2];
  function heroOccluders(s) {
    const hx = heroXf(s), e = 0.012;
    occluder(hx, [-BW + e, BY0 + BR, -BD + e], [BW - e, BY1 - BR, BD - e]);
    occluder(hx, [-BW + BR, BY0 + e, -BD + e], [BW - BR, BY1 - e, BD - e]);
    occluder(hx, [-BW + BR * 0.3, BY0 + BR * 0.3, -BD + e], [BW - BR * 0.3, BY1 - BR * 0.3, BD - e]);
    for (let i = 0; i < 4; i++) {
      const lift = legLift(s, i), c = LEGS[i];
      occluder(hx, [c[0] - 0.2, lift + e, c[1] - 0.2], [c[0] + 0.2, BY0 + 0.05, c[1] + 0.2]);
    }
    for (const side of [-1, 1]) { const ax = armXf(hx, s, side); const b = inset(ARM_MN, ARM_MX, e); occluder(ax, b[0], b[1]); }
  }
  const legLift = (s, i) => s.air * (i % 2 ? 0.2 : 0.1) * (i < 2 ? 1 : 0.7);
  function drawHero(s, am, ghost) {
    const hx = heroXf(s);
    const P = (x, y, z) => xfP(hx, [x, y, z]);
    const hid = ghost ? 0 : 0.2;
    const main = { c: 'coral', w: ghost ? 1.2 : 2.5, a: am, occ: true, hid, dots: !ghost };
    const thin = { c: 'coral', w: ghost ? 1 : 1.9, a: am * 0.95, occ: true, hid, dots: !ghost };
    // body: front and back profiles, and the tangent lines that join them
    for (const z of [BD, -BD]) for (let i = 0; i < PROFILE.length; i++) {
      const a = PROFILE[i], b = PROFILE[(i + 1) % PROFILE.length];
      const st = (i % 6 === 5) ? main : { c: 'coral', w: main.w, a: am, occ: true, hid, step: 0.05 };   // arcs: no dwell dots
      line3(P(a[0], a[1], z), P(b[0], b[1], z), st);
    }
    if (ghost) return;
    for (const q of TANG) line3(P(q[0], q[1], BD), P(q[0], q[1], -BD), thin);
    {
      // the seam: a dashed section line around the body, low down, like the stitch on the sprite
      const ys = BY0 + 0.36, sd = { c: 'shade', w: 1.3, a: am * 0.85, occ: true, hid: 0.12, step: 0.05 };
      const loop = [[-BW, BD], [BW, BD], [BW, -BD], [-BW, -BD]];
      for (let e = 0; e < 4; e++) {
        const a = loop[e], b = loop[(e + 1) % 4], len = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.round(len / 0.13);
        for (let i = 0; i < n; i += 2) {
          const f0 = (i + 0.25) / n, f1 = (i + 1.25) / n;
          line3(P(lerp(a[0], b[0], f0), ys, lerp(a[1], b[1], f0)), P(lerp(a[0], b[0], f1), ys, lerp(a[1], b[1], f1)), sd);
        }
      }
    }
    // four leg stubs
    for (let i = 0; i < 4; i++) {
      const c = LEGS[i], lift = legLift(s, i);
      box3(hx, [c[0] - 0.21, lift, c[1] - 0.21], [c[0] + 0.21, BY0, c[1] + 0.21], thin);
    }
    // two arm nubs
    for (const side of [-1, 1]) box3(armXf(hx, s, side), ARM_MN, ARM_MX, thin);
    // the face, drawn on the front plane: two eyes with a glint; a mouth only when it calls out
    const zf = BD + 0.015;
    const eyeSt = { c: 'cream', w: 2.3, a: am, occ: true, hid: 0 };
    for (const sx of [-1, 1]) {
      const ex = sx * 0.6 + s.gx, ey = 1.66 + s.gy, hw = 0.115, hh = Math.max(0.012, 0.175 * s.eye);
      if (s.eye < 0.15) { line3(P(ex - hw * 1.15, ey - 0.1, zf), P(ex + hw * 1.15, ey - 0.1, zf), eyeSt); continue; }
      // a solid eye, filled the way a vector display fills: by tight hatching. The glint is the corner the beam skips.
      const nl = 16;
      for (let k = 0; k <= nl; k++) {
        const y = ey - hh + 2 * hh * k / nl, gl = s.eye > 0.7 && k >= nl - 6 && k < nl - 1;
        line3(P(gl ? ex - hw * 0.05 : ex - hw, y, zf), P(ex + hw, y, zf), eyeSt);
        
      }
      line3(P(ex - hw, ey - hh, zf), P(ex - hw, ey + hh, zf), eyeSt);
    }
    if (s.mouth > 0.03) {
      const m = s.mouth, hw = 0.3 * (0.5 + 0.5 * m), y1 = 1.27, y0 = y1 - 0.34 * m;
      const mst = { c: 'cream', w: 2, a: am * sat(m * 3), occ: true, hid: 0 };
      poly3([[-hw, y0, zf], [hw, y0, zf], [hw, y1, zf], [-hw, y1, zf]], mst, true, hx);
      if (m > 0.5) line3(P(-hw, y0 + 0.09, zf), P(hw, y0 + 0.09, zf), { c: 'coral', w: 1.4, a: am * 0.9, occ: true, hid: 0 });
    }
  }
  function dot3(p, col, r, a) { if (hidden(p)) return; const c = toCam(p); if (c[2] < NEAR) return; const q = scr(c); dot2(q[0], q[1], col, r, a); }
  function heroShadow(s) {                                // a contact ring on the floor: it tightens as the hero leaves the ground
    const k = 1 / (1 + s.y * 0.55), n = 40, c = Math.cos(s.yaw), sn = Math.sin(s.yaw);
    const a = 0.55 * (0.45 + 0.55 * k);
    let prev = null;
    for (let i = 0; i <= n; i++) {
      const u = i / n * 6.28318, lx0 = Math.cos(u) * 1.72 * k, lz0 = Math.sin(u) * 1.12 * k;
      const p = [s.x + lx0 * c + lz0 * sn, 0.004, s.z - lx0 * sn + lz0 * c];
      if (prev && (i % 2)) line3(prev, p, { c: 'lilacHi', w: 1.4, a, occ: true, hid: 0.35, step: 0.1 });
      prev = p;
    }
  }

  /* ---------------------------------------------------------------- the folder: a wireframe object standing on the grid */
  const FX = xf(rotY(-9 * RAD), [3.05, 0, -0.15]);
  const FW = 1.55, FH = 1.86, FB = 2.0, FT = 2.3;         // half-width, cover height, back height, tab height
  const ZB0 = -0.3, ZB1 = -0.2, ZC = 0.26;                // back board slab, cover hinge
  const BACK = [[-FW, 0], [-FW, FT], [-0.42, FT], [-0.16, FB], [FW, FB], [FW, 0]];
  const T_OPEN = 2.1;
  function folderOpen(t) {                                // 0..1 with a small overshoot
    const f = sat((t - T_OPEN) / 0.42);
    return f <= 0 ? 0 : 1 - Math.pow(1 - f, 3) + 0.1 * Math.sin(f * Math.PI) * (1 - f);
  }
  function coverXf(t) { return xfCompose(FX, xf(rotX(folderOpen(t) * 52 * RAD), [0, 0, ZC])); }
  function folderOccluders(t) {
    const e = 0.012;
    occluder(FX, [-FW + e, e, ZB0 + e], [FW - e, FB - e, ZB1 - e]);
    occluder(FX, [-FW + e, FB - 0.05, ZB0 + e], [-0.42, FT - e, ZB1 - e]);
    occluder(coverXf(t), [-FW + e, e, -0.05 + e], [FW - e, FH - e, 0.05 - e]);
    occluder(FX, [-FW + e, 0.0, ZB1], [FW - e, 0.05, ZC]);
  }
  function drawFolder(t) {
    let idx = 0;
    const rev = () => sat((t + 0.02 - idx++ * 0.0105) / 0.2);        // each edge is traced in by the beam, one after another
    const warm = folderOpen(t);
    const st = (w, a) => ({ c: 'lilac', w, a, occ: true, hid: 0.22, dots: true, rev: rev() });
    const F = (x, y, z) => xfP(FX, [x, y, z]);
    // back board with its tab: two outlines and the edges between them
    for (const z of [ZB1, ZB0]) for (let i = 0; i < BACK.length; i++) {
      const a = BACK[i], b = BACK[(i + 1) % BACK.length];
      line3(F(a[0], a[1], z), F(b[0], b[1], z), st(z === ZB1 ? 2 : 1.5, 0.95));
    }
    for (const q of BACK) line3(F(q[0], q[1], ZB0), F(q[0], q[1], ZB1), st(1.5, 0.9));
    // floor of the folder and the cover (hinged along the bottom front edge)
    line3(F(-FW, 0, ZB1), F(-FW, 0, ZC), st(1.5, 0.9));
    line3(F(FW, 0, ZB1), F(FW, 0, ZC), st(1.5, 0.9));
    const cx = coverXf(t);
    const cp = boxPts([-FW, 0, -0.05], [FW, FH, 0.05]).map((q) => xfP(cx, q));
    for (let i = 0; i < 12; i++) line3(cp[BOXE[i][0]], cp[BOXE[i][1]], st(i >= 4 && i < 8 ? 2.1 : 1.5, 0.98));
    // a label line on the cover, like a filing tab strip
    line3(xfP(cx, [-FW + 0.2, FH - 0.28, 0.052]), xfP(cx, [-FW + 1.15, FH - 0.28, 0.052]), st(1.3, 0.6));
    // the gussets: from the back board to the cover's top corners (they fan out when it opens)
    for (const sx of [-1, 1]) line3(F(sx * FW, FH, ZB1), xfP(cx, [sx * FW, FH, -0.05]), st(1.4, 0.85));
    // "0 ITEMS", standing on the floor in front
    const u = 0.068, tw = textW('0 ITEMS') * u, lr = sat((t - 0.2) / 0.3);
    text('0 ITEMS', (a, b, k) => {
      const r = sat(lr * 30 - k * 0.55);
      line3(F(-tw / 2 + a[0] * u, 0.1 + a[1] * u, 2.05), F(-tw / 2 + b[0] * u, 0.1 + b[1] * u, 2.05), { c: 'lilac', w: 1.7, a: 0.9, occ: false, rev: r });
    });
    if (warm > 0) {
      // the warm light inside: the mouth of the folder glows coral, and thin shafts stand in it
      const ct = [xfP(cx, [-FW, FH, -0.05]), xfP(cx, [FW, FH, -0.05])], bt = [F(-FW, FH, ZB1), F(FW, FH, ZB1)];
      const ws = { c: 'coral', w: 2, a: 0.9 * warm, occ: false };
      line3(ct[0], ct[1], ws); line3(bt[0], bt[1], ws); line3(ct[0], bt[0], ws); line3(ct[1], bt[1], ws);
      const n = 13;
      for (let i = 0; i < n; i++) {                       // hatching on the inside of the back board, brightest at the bottom
        const y = 0.12 + (FH - 0.2) * i / (n - 1);
        line3(F(-FW + 0.08, y, ZB1 + 0.01), F(FW - 0.08, y, ZB1 + 0.01), { c: 'coral', w: 1.2, a: warm * lerp(0.75, 0.16, i / (n - 1)), occ: true, hid: 0.5 });
      }
    }
  }
  const MOUTH = () => xfP(FX, [0, FH * 0.8, 0.1]);

  /* ---------------------------------------------------------------- the agents: short bright streaks, a fountain */
  const NA = 248, AG = [];
  (function () {
    const r = mulberry(0xA6E57);
    const gauss = () => (r() + r() + r() + r() - 2) * 1.2;
    for (let i = 0; i < NA; i++) {
      const u = (i + r() * 0.9) / NA;
      AG.push({
        te: T_OPEN + 0.05 + 0.86 * Math.pow(u, 0.72),     // emission accelerates: a trickle, then a rush
        o: [(r() * 2 - 1) * 1.15, FH * 0.55 + r() * 0.3, -0.1 + r() * 0.5],
        v: [gauss() * 2.25, 6.0 + r() * 4.4 + (r() < 0.12 ? 1.0 : 0), gauss() * 1.6 + 0.5],
        c: ['coral', 'coral', 'light', 'light', 'cream'][Math.floor(r() * 5)],
        len: 0.032 + r() * 0.024, w: r() < 0.25 ? 2.6 : 2,
      });
    }
    AG.sort((a, b) => a.te - b.te);
  })();
  const GRAV = 9.2;
  function agentPos(a, tau) {
    const d = 1 - Math.exp(-tau * 0.55);                  // a little drag so the crown of the fountain spreads softly
    const k = d / 0.55;
    return xfP(FX, [a.o[0] + a.v[0] * k, a.o[1] + a.v[1] * tau - 0.5 * GRAV * tau * tau, a.o[2] + a.v[2] * k]);
  }
  function agentCount(t) { let n = 0; for (let i = 0; i < NA; i++) if (AG[i].te <= t) n++; return n; }
  function drawAgents(t) {
    for (let i = 0; i < NA; i++) {
      const a = AG[i], tau = t - a.te;
      if (tau <= 0) continue;
      const born = sat(tau / 0.05);
      const p0 = agentPos(a, tau), p1 = agentPos(a, Math.max(0, tau - a.len)), p2 = agentPos(a, Math.max(0, tau - a.len * 2.3));
      line3(p1, p0, { c: a.c, w: a.w, a: 1 * born, occ: false });
      line3(p2, p1, { c: 'coral', w: 1.2, a: 0.3 * born, occ: false });          // persistence: the beam's afterglow
      const q = project(p0); dot2(q[0], q[1], 'cream', a.w * 0.72, born);
    }
  }

  /* ---------------------------------------------------------------- the signal: a ring from the raised arm */
  function drawSignal(t) {
    const p = (t - (T_SIGNAL + 0.01)) / 0.5;
    if (p <= 0 || p >= 1) return;
    const s = heroAt(T_SIGNAL + 0.05), tip = xfP(armXf(heroXf(s), s, 1), [0.5, 0.05, 0]);
    const e = 1 - Math.pow(1 - p, 2.4), R = 0.2 + 1.5 * e, a = Math.pow(1 - p, 1.3), n = 56;
    for (let i = 0; i < n; i++) {
      const u = i / n * 6.28318, v = (i + 1) / n * 6.28318;
      const A = add(tip, add([cR[0] * Math.cos(u) * R, cR[1] * Math.cos(u) * R, cR[2] * Math.cos(u) * R], [cU[0] * Math.sin(u) * R, cU[1] * Math.sin(u) * R, cU[2] * Math.sin(u) * R]));
      const B = add(tip, add([cR[0] * Math.cos(v) * R, cR[1] * Math.cos(v) * R, cR[2] * Math.cos(v) * R], [cU[0] * Math.sin(v) * R, cU[1] * Math.sin(v) * R, cU[2] * Math.sin(v) * R]));
      line3(A, B, { c: 'coral', w: 1.8, a: a * 0.95, occ: false });
    }
    for (let k = 0; k < 3; k++) {                         // three small ticks, flung toward the folder
      const ang = (62 - k * 26) * RAD, r0 = 0.45 + e * 0.5, r1 = r0 + 0.3;
      const d = add([cR[0] * Math.cos(ang), cR[1] * Math.cos(ang), cR[2] * Math.cos(ang)], [cU[0] * Math.sin(ang), cU[1] * Math.sin(ang), cU[2] * Math.sin(ang)]);
      line3(add(tip, [d[0] * r0, d[1] * r0, d[2] * r0]), add(tip, [d[0] * r1, d[1] * r1, d[2] * r1]), { c: 'cream', w: 2, a: a, occ: false });
    }
  }

  /* ---------------------------------------------------------------- interface: the counter, and blueprint registration marks */
  function drawHud(t) {
    const m = 58, l = 22, a = 0.3;
    for (const [x, y, dx, dy] of [[m, m, 1, 1], [W - m, m, -1, 1], [m, H - m, 1, -1], [W - m, H - m, -1, -1]]) {
      seg2(x, y, x + dx * l, y, 'lilac', 1, a); seg2(x, y, x, y + dy * l, 'lilac', 1, a);
    }
    const n = agentCount(t);
    if (t >= T_OPEN) {
      const u = 4.4, x0 = m + 34, y0 = m + 44, f = sat((t - T_OPEN) / 0.18);
      const s = 'AGENTS ' + String(n).padStart(4, '0');
      text(s, (p, q, k) => {
        const num = p[0] >= 7 * ADV - 0.1;
        if (k / 60 > f * 1.2) return;
        seg2(x0 + p[0] * u, y0 - p[1] * u, x0 + q[0] * u, y0 - q[1] * u, num ? 'light' : 'lilac', 1.8, num ? 1 : 0.9);
      });
    }
  }

  /* ---------------------------------------------------------------- one frame */
  function render(t) {
    t = clamp(t, 0, DUR);
    setCam(t);
    SEG = new Map(); DOTS = []; OCC = [];
    const hs = heroAt(t);
    heroOccluders(hs); folderOccluders(t);
    drawGrid(t);
    heroShadow(hs);
    drawFolder(t);
    for (let k = 4; k >= 1; k--) {                        // phosphor persistence: the hero's last few frames linger
      const tg = t - k * 0.03;
      if (tg > 0) drawHero(heroAt(tg), 0.26 * Math.pow(0.6, k - 1), true);
    }
    drawHero(hs, 1, false);
    drawSignal(t);
    drawAgents(t);
    drawHud(t);

    // ---- the line layer (additive)
    lx.globalCompositeOperation = 'source-over';
    lx.clearRect(0, 0, W, H);
    lx.globalCompositeOperation = 'lighter';
    lx.lineCap = 'round'; lx.lineJoin = 'round';
    for (const [key, b] of SEG) {
      const k = key.split('|'), c = COL[k[0]];
      lx.strokeStyle = 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + Math.min(1, k[2] / 32) + ')';
      lx.lineWidth = +k[1];
      lx.beginPath();
      for (let i = 0; i < b.length; i += 4) { lx.moveTo(b[i], b[i + 1]); lx.lineTo(b[i + 2], b[i + 3]); }
      lx.stroke();
    }
    for (let i = 0; i < DOTS.length; i += 5) {
      const c = COL[DOTS[i + 2]];
      lx.fillStyle = 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + Math.min(1, DOTS[i + 4]) + ')';
      lx.beginPath(); lx.arc(DOTS[i], DOTS[i + 1], DOTS[i + 3], 0, 6.28318); lx.fill();
    }

    // ---- composite: deep background, warm light, bloom, lines
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; ctx.filter = 'none';
    const hz = project([camTarget[0], 0, -60]);
    let g = ctx.createRadialGradient(W * 0.52, hz[1] + 330, 0, W * 0.52, hz[1] + 330, 1250);
    g.addColorStop(0, '#0d0a26'); g.addColorStop(0.45, '#070617'); g.addColorStop(1, '#020208');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter';
    const warm = folderOpen(t);
    if (warm > 0) {
      const q = project(MOUTH()), fl = ss(T_OPEN, 3, t);
      g = ctx.createRadialGradient(q[0], q[1], 0, q[0], q[1], 430);
      g.addColorStop(0, 'rgba(217,119,87,' + 0.3 * warm + ')'); g.addColorStop(0.3, 'rgba(190,90,62,' + 0.12 * warm + ')'); g.addColorStop(1, 'rgba(120,50,40,0)');
      ctx.fillStyle = g; ctx.fillRect(q[0] - 430, q[1] - 430, 860, 860);
      g = ctx.createRadialGradient(q[0], q[1], 0, q[0], q[1], 90);
      g.addColorStop(0, 'rgba(255,200,160,' + 0.42 * warm + ')'); g.addColorStop(1, 'rgba(217,119,87,0)');
      ctx.fillStyle = g; ctx.fillRect(q[0] - 90, q[1] - 90, 180, 180);
      // the fountain's own haze
      const q2 = project(add(MOUTH(), [0, 2.6, 0]));
      g = ctx.createRadialGradient(q2[0], q2[1], 0, q2[0], q2[1], 380);
      g.addColorStop(0, 'rgba(217,119,87,' + 0.1 * fl + ')'); g.addColorStop(1, 'rgba(217,119,87,0)');
      ctx.fillStyle = g; ctx.fillRect(q2[0] - 380, q2[1] - 380, 760, 760);
    }
    g4.globalCompositeOperation = 'copy'; g4.filter = 'blur(7px)'; g4.drawImage(L, 0, 0, W / 4, H / 4); g4.filter = 'none';
    g2.globalCompositeOperation = 'copy'; g2.filter = 'blur(2.6px)'; g2.drawImage(L, 0, 0, W / 2, H / 2); g2.filter = 'none';
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    ctx.globalAlpha = 0.85; ctx.drawImage(G4, 0, 0, W, H);
    ctx.globalAlpha = 0.75; ctx.drawImage(G2, 0, 0, W, H);
    ctx.globalAlpha = 1; ctx.drawImage(L, 0, 0);
    // vignette
    ctx.globalCompositeOperation = 'source-over';
    g = ctx.createRadialGradient(W / 2, H / 2, 420, W / 2, H / 2, 1180);
    g.addColorStop(0, 'rgba(2,2,8,0)'); g.addColorStop(1, 'rgba(2,2,8,0.72)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }

  /* ---------------------------------------------------------------- playback */
  if (params.has('export')) {
    window.__piece = { renderAt: render, duration: DUR, isReady: () => true };
    render(0);
  } else if (params.has('t')) {
    render(parseFloat(params.get('t')) || 0);
  } else {
    const loop = (now) => { render((now / 1000) % DUR); requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  }
})();
