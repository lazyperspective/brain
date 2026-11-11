/* 1000 Agents — the film, section 4 of 7: KERNEL as a blueprint (16.0–22.0 s, rendered 15.6–22.4 s), glowing 3D vector wireframe.
   Extended from the 3 s style preview. Canvas 2D only: every mark is a 3D line segment, projected by hand, tested for hidden
   lines, drawn additively and bloomed. The five modules lift off the floor, orbit, and dock one by one into a nested wire
   polyhedron (tetrahedron, cube, octahedron, dodecahedron, icosahedron); while it assembles it is drawn x-ray, and when it
   locks its hidden lines resolve. The hero, in thick bright coral with solid eyes, steps back as it grows.
   The projection carries a "lens shift" that keeps the hero's anchor on the film's anchor point at the film's anchor size. */
FILM.define('05-vector-wireframe', function (canvas, opts) {
  'use strict';
  const W = 1920, H = 1080;
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  const L = mk(W, H), lx = L.getContext('2d');
  const G2 = mk(W / 2, H / 2), g2 = G2.getContext('2d');
  const G4 = mk(W / 4, H / 4), g4 = G4.getContext('2d');
  const A = FILM.ANCHOR, FMm = FILM.m;
  const COL = {
    coral: [217, 119, 87], light: [242, 165, 133], shade: [168, 85, 59], cream: [255, 226, 200], hero: [246, 150, 112],
    lilac: [146, 128, 242], lilacHi: [190, 178, 255], lilacDim: [96, 84, 190], teal: [95, 214, 196],
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

  /* ---------------------------------------------------------------- camera: a slow orbit that rests on the same view at both ends,
     plus the anchor fit (a screen-space scale and shift that pins the hero's anchor to the film's anchor) */
  let E, cR, cU, cF, FOC, FIT = { k: 1, ox: 0, oy: 0 };
  const camTarget = [0, 0, 0];
  const HOME = [-1.95, 0.25];
  function setCam(T) {
    const u = FMm.sat((T - 16.0) / 6.0), sw = Math.sin(Math.PI * u);
    const az = (-15 + 14 * sw) * RAD, el = (12.5 + 4.5 * sw) * RAD, d = 19.5 - 1.2 * sw;
    camTarget[0] = 1.1; camTarget[1] = 2.0 + 0.5 * sw; camTarget[2] = -0.2;
    E = [camTarget[0] + d * Math.sin(az) * Math.cos(el), camTarget[1] + d * Math.sin(el), camTarget[2] + d * Math.cos(az) * Math.cos(el)];
    cF = norm(sub(camTarget, E)); cR = norm(cross(cF, [0, 1, 0])); cU = cross(cR, cF);
    FOC = (H / 2) / Math.tan(15.5 * RAD);
    FIT = { k: 1, ox: 0, oy: 0 };
    const pf = scr(toCam([HOME[0], 0, HOME[1] + 0.5])), pt = scr(toCam([HOME[0], BY1, HOME[1] + 0.5]));
    const k = A.h / Math.max(1, pf[1] - pt[1]);
    FIT = { k, ox: A.x - pf[0] * k, oy: A.gy - pf[1] * k };
  }
  const toCam = (p) => { const v = sub(p, E); return [dot(v, cR), dot(v, cU), dot(v, cF)]; };
  const scr = (c) => [(W / 2 + c[0] / c[2] * FOC) * FIT.k + FIT.ox, (H / 2 - c[1] / c[2] * FOC) * FIT.k + FIT.oy];
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
  const GC = [1.6, 0, -0.5];                                // the grid's centre of attention
  function drawGrid(t) {
    const reach = 42.5;       // the grid sweeps outward from the folder
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
          const a = aAt(mx, mz) * (major && !dir || (dir && ((i + 1) % 4) === 0) ? 0.62 : 0.32);
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
    const main = { c: 'hero', w: ghost ? 1.2 : 3.6, a: am, occ: true, hid, dots: !ghost };
    const thin = { c: 'hero', w: ghost ? 1 : 2.7, a: am * 0.95, occ: true, hid, dots: !ghost };
    // body: front and back profiles, and the tangent lines that join them
    for (const z of [BD, -BD]) for (let i = 0; i < PROFILE.length; i++) {
      const a = PROFILE[i], b = PROFILE[(i + 1) % PROFILE.length];
      const st = (i % 6 === 5) ? main : { c: 'hero', w: main.w, a: am, occ: true, hid, step: 0.05 };   // arcs: no dwell dots
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

  // the shared performance in this world: world units, the body is 2.6 wide
  function heroAt(T) {
    const h = FILM.heroAt(T);
    const s = { x: HOME[0] + h.dx * 2.6, y: h.lift * 1.75, z: HOME[1], sq: 1 - h.sq * 0.85, air: h.air };
    s.yaw = (18 + 22 * h.turn) * RAD;
    s.pitch = (-h.look[1] * 6 + h.lean * 20) * RAD;
    s.gx = h.look[0] * 0.08; s.gy = h.look[1] * 0.07;
    s.eye = 1 - h.blink; s.eye = s.eye * s.eye;
    s.mouth = h.mouth; s.arm = Math.max(h.arm, h.point * 0.7);
    return s;
  }

  /* ---------------------------------------------------------------- the kernel: five nested shells */
  const PHI = (1 + Math.sqrt(5)) / 2;
  function polyhedron(kind) {
    let V = [];
    const P = (a) => { for (const v of a) V.push(v); };
    const perms = (x, y, z) => [[x, y, z], [y, z, x], [z, x, y]];
    const signs = (v) => { const o = []; for (const sx of v[0] ? [-1, 1] : [1]) for (const sy of v[1] ? [-1, 1] : [1]) for (const sz of v[2] ? [-1, 1] : [1]) o.push([v[0] * sx, v[1] * sy, v[2] * sz]); return o; };
    if (kind === 'tetra') P([[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]]);
    if (kind === 'cube') P(signs([1, 1, 1]));
    if (kind === 'octa') { for (const p of perms(1, 0, 0)) P(signs(p)); }
    if (kind === 'icosa') { for (const p of perms(0, 1, PHI)) P(signs(p)); }
    if (kind === 'dodeca') { P(signs([1, 1, 1])); for (const p of perms(0, 1 / PHI, PHI)) P(signs(p)); }
    V = V.map((v) => norm(v));
    let dmin = 1e9;
    for (let i = 0; i < V.length; i++) for (let j = i + 1; j < V.length; j++) dmin = Math.min(dmin, Math.hypot(...sub(V[i], V[j])));
    const E2 = [];
    for (let i = 0; i < V.length; i++) for (let j = i + 1; j < V.length; j++) if (Math.hypot(...sub(V[i], V[j])) < dmin * 1.01) E2.push([i, j]);
    // face normals: candidate directions (duals in both orientations), kept when at least three vertices lie on the plane
    const C2 = [];
    for (const t of [[1, 0, 0], [1, 1, 1], [0, 1, PHI], [0, PHI, 1], [0, 1 / PHI, PHI], [0, PHI, 1 / PHI]]) for (const p of perms(t[0], t[1], t[2])) for (const v of signs(p)) C2.push(norm(v));
    const N = [];
    for (const n of C2) {
      let mx = -1e9; for (const v of V) mx = Math.max(mx, dot(v, n));
      let c = 0; for (const v of V) if (Math.abs(dot(v, n) - mx) < 1e-4) c++;
      if (c >= 3 && !N.some((q) => dot(q, n) > 0.9999)) N.push(n);
    }
    const EF = E2.map(([i, j]) => {
      const f = [];
      for (let k = 0; k < N.length; k++) {
        let mx = -1e9; for (const v of V) mx = Math.max(mx, dot(v, N[k]));
        if (Math.abs(dot(V[i], N[k]) - mx) < 1e-4 && Math.abs(dot(V[j], N[k]) - mx) < 1e-4) f.push([N[k], mx]);
      }
      return f;
    });
    return { V, E: E2, EF };
  }
  const SHELLS = [
    { kind: 'tetra', r: 0.42 }, { kind: 'cube', r: 0.70 }, { kind: 'octa', r: 0.98 }, { kind: 'dodeca', r: 1.24 }, { kind: 'icosa', r: 1.55 },
  ].map((s, k) => Object.assign(s, polyhedron(s.kind), { k }));
  const KC = [3.05, 1.85, -0.45];                              // the kernel's centre (world)
  const T_LOCK = 20.85;
  const DOCK = [18.55, 19.0, 19.45, 19.9, 20.35];
  function shellRot(k, T) {
    const lock = FMm.ss(T_LOCK - 0.35, T_LOCK + 0.25, T);
    const free = mmul(rotY(T * (0.5 + 0.23 * k) * (k % 2 ? -1 : 1) + k), rotX(0.4 + 0.3 * Math.sin(T * 0.7 + k)));
    const rest = mmul(rotY((T - T_LOCK) * 0.32 + 0.3), rotX(0.36));
    return lock >= 1 ? rest : lock <= 0 ? free : blendRot(free, rest, lock);
  }
  function blendRot(a, b, u) {                                 // a cheap blend: lerp the matrices and re-orthonormalise
    const m = a.map((v, i) => lerp(v, b[i], u));
    const x = norm([m[0], m[3], m[6]]), y0 = [m[1], m[4], m[7]], z = norm(cross(x, y0)), y = cross(z, x);
    return [x[0], y[0], z[0], x[1], y[1], z[1], x[2], y[2], z[2]];
  }
  function drawShell(k, T) {
    const sh = SHELLS[k], t0 = DOCK[k] + 0.22;
    const rev = sat((T - t0) / 0.55);
    if (rev <= 0) return;
    const R = shellRot(k, T), lock = FMm.ss(T_LOCK - 0.1, T_LOCK + 0.5, T);
    const grow = 1 + 0.06 * Math.exp(-Math.max(0, T - t0 - 0.55) * 6) * Math.sin(Math.max(0, T - t0 - 0.55) * 20);
    const r = sh.r * grow * (1 + 0.04 * lock);
    const Pw = sh.V.map((v) => add(KC, mapply(R, [v[0] * r, v[1] * r, v[2] * r])));
    const hidA = lerp(0.55, 0.1, lock);
    const col = k === 0 ? 'light' : (k === 4 ? 'lilacHi' : 'lilac');
    for (let e = 0; e < sh.E.length; e++) {
      const [i, j] = sh.E[e];
      // visible if either neighbouring face looks toward the eye
      let vis = false;
      for (const [n, h] of sh.EF[e]) { const nw = mapply(R, n), fp = add(KC, [nw[0] * h * r, nw[1] * h * r, nw[2] * h * r]); if (dot(nw, sub(E, fp)) > 0) { vis = true; break; } }
      const er = sat(rev * 1.6 - e / sh.E.length * 0.6);
      const w = (vis ? 1.9 : 1.1) + (k === 4 ? 0.3 : 0), a = vis ? 0.95 : hidA;
      line3(Pw[i], Pw[j], { c: col, w, a, occ: false, rev: er, dots: vis && lock > 0.5 });
    }
  }

  /* ---------------------------------------------------------------- the modules: five wire boxes, each labelled by its shape */
  const MODS = [
    { p: [1.08, 0.70, 0.0], shape: 'circle' }, { p: [3.38, 0.70, 0.0], shape: 'triangle' }, { p: [5.67, 0.70, 0.0], shape: 'square' },
    { p: [2.23, 2.26, -0.05], shape: 'hex' }, { p: [4.53, 2.26, -0.05], shape: 'bars' },
  ];
  const MH = [1.03, 0.69, 0.6];
  const ORBIT_R = 2.75, ORBIT_TILT = mmul(rotX(0.32), rotZ(-0.12));
  function modState(k, T) {
    const m = MODS[k], tl = 16.65 + 0.22 * k, lift = FMm.eio((T - tl) / 1.1);
    const th = k / 5 * 6.28318 + (T - 16.65) * 0.62;
    const orb = add(KC, mapply(ORBIT_TILT, [Math.cos(th) * ORBIT_R, 0.15 * Math.sin(th * 2), Math.sin(th) * ORBIT_R]));
    let p = [lerp(m.p[0], orb[0], lift), lerp(m.p[1], orb[1], lift) + 0.9 * Math.sin(Math.PI * lift), lerp(m.p[2], orb[2], lift)];
    let s = lerp(1, 0.62, lift), a = 1;
    const dk = sat((T - DOCK[k]) / 0.5), de = FMm.eio(dk);
    if (dk > 0) { p = [lerp(p[0], KC[0], de), lerp(p[1], KC[1], de), lerp(p[2], KC[2], de)]; s *= lerp(1, 0.25, de); a = 1 - FMm.ss(0.55, 1, dk); }
    const rot = mmul(rotY(lift * (th * 0.5 + 0.3)), rotX(lift * 0.25 * Math.sin(th)));
    return { p, s, a, rot, lift };
  }
  function shapePts(kind) {
    const o = [], n = 18;
    if (kind === 'circle') for (let i = 0; i <= n; i++) o.push([Math.cos(i / n * 6.28318), Math.sin(i / n * 6.28318)]);
    else if (kind === 'triangle') o.push([0, 1.1], [1.05, -0.75], [-1.05, -0.75], [0, 1.1]);
    else if (kind === 'square') o.push([-0.85, -0.85], [0.85, -0.85], [0.85, 0.85], [-0.85, 0.85], [-0.85, -0.85]);
    else if (kind === 'hex') for (let i = 0; i <= 6; i++) { const a = i / 6 * 6.28318 + Math.PI / 6; o.push([Math.cos(a), Math.sin(a)]); }
    else o.push([-1, 0.6], [1, 0.6], null, [-1, 0], [0.6, 0], null, [-1, -0.6], [0.2, -0.6]);
    return o;
  }
  function drawModule(k, T) {
    const st = modState(k, T);
    if (st.a <= 0.01) return;
    const x = xf(mmul(st.rot, scl(st.s, st.s, st.s)), st.p);
    const stl = { c: 'lilac', w: 1.8, a: 0.9 * st.a, occ: true, hid: 0.25, dots: true };
    box3(x, [-MH[0], -MH[1], -MH[2]], MH, stl);
    // the inner sheets: two inset outlines on the front, like the paper layers
    for (let q = 1; q <= 2; q++) { const e = 0.12 * q; poly3([[-MH[0] + e, -MH[1] + e, MH[2]], [MH[0] - e, -MH[1] + e, MH[2]], [MH[0] - e, MH[1] - e - 0.1, MH[2]], [-MH[0] + e, MH[1] - e - 0.1, MH[2]]], { c: 'lilacDim', w: 1.2, a: 0.7 * st.a, occ: true, hid: 0 }, true, x); }
    // its label shape, top right of the front face
    const sp = shapePts(MODS[k].shape), sc = 0.17, cx = MH[0] - 0.33, cy = MH[1] - 0.3;
    for (let i = 0; i + 1 < sp.length; i++) { if (!sp[i] || !sp[i + 1]) continue; line3(xfP(x, [cx + sp[i][0] * sc, cy + sp[i][1] * sc, MH[2] + 0.01]), xfP(x, [cx + sp[i + 1][0] * sc, cy + sp[i + 1][1] * sc, MH[2] + 0.01]), { c: 'teal', w: 1.5, a: 0.85 * st.a, occ: true, hid: 0 }); }
  }
  function moduleOccluders(T) {
    for (let k = 0; k < 5; k++) { const st = modState(k, T); if (st.a < 0.5) continue; const x = xf(mmul(st.rot, scl(st.s, st.s, st.s)), st.p); const b = inset([-MH[0], -MH[1], -MH[2]], MH, 0.012); occluder(x, b[0], b[1]); }
  }

  /* ---------------------------------------------------------------- the agents: 1000 streaks on three tilted orbits round the kernel */
  const RINGS = [mmul(rotX(0.22), rotZ(0.12)), mmul(rotX(-0.3), rotZ(-0.2)), mmul(rotX(0.5), rotZ(0.35))];
  const AGW = FILM.AG.map((g) => ({ ring: g.i % 3, a0: g.r[0] * 6.28318, w: (0.55 + 0.25 * g.r[1]) * (g.i % 2 ? 1 : 1), dr: (g.r[2] - 0.5) * 0.5, dy: (g.r[3] - 0.5) * 0.22,
    c: ['coral', 'coral', 'light', 'light', 'cream'][Math.floor(g.r[4] * 5)], len: 0.04 + 0.03 * g.r[5] }));
  function agentP(i, T) {
    const g = AGW[i], lock = FMm.ss(T_LOCK, T_LOCK + 1.0, T);
    const R = 2.65 + 0.36 * g.ring + g.dr * 0.7 - 0.3 * lock, th = g.a0 + g.w * (T - 16) * (g.ring === 1 ? -1 : 1);
    return add(add(KC, [0, 0.55, 0]), mapply(RINGS[g.ring], [Math.cos(th) * R, g.dy, Math.sin(th) * R]));
  }
  function drawAgents(T) {
    for (let i = 0; i < FILM.N; i++) {
      const g = AGW[i], p0 = agentP(i, T), p1 = agentP(i, T - g.len), p2 = agentP(i, T - g.len * 2.4);
      line3(p1, p0, { c: g.c, w: 1.7, a: 0.62, occ: false });
      line3(p2, p1, { c: 'coral', w: 1.1, a: 0.2, occ: false });
    }
  }

  /* ---------------------------------------------------------------- one frame */
  function render(T) {
    setCam(T);
    SEG = new Map(); DOTS = []; OCC = [];
    const hs = heroAt(T);
    heroOccluders(hs); moduleOccluders(T);
    drawGrid(99);
    heroShadow(hs);
    for (let k = 0; k < 5; k++) drawModule(k, T);
    for (let k = 0; k < 5; k++) drawShell(k, T);
    drawAgents(T);
    for (let k = 3; k >= 1; k--) { const tg = T - k * 0.03; drawHero(heroAt(tg), 0.22 * Math.pow(0.6, k - 1), true); }
    drawHero(hs, 1, false);

    lx.globalCompositeOperation = 'source-over'; lx.clearRect(0, 0, W, H); lx.globalCompositeOperation = 'lighter';
    lx.lineCap = 'round'; lx.lineJoin = 'round';
    for (const [key, b] of SEG) {
      const k = key.split('|'), c = COL[k[0]];
      lx.strokeStyle = 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + Math.min(1, k[2] / 32) + ')'; lx.lineWidth = +k[1];
      lx.beginPath(); for (let i = 0; i < b.length; i += 4) { lx.moveTo(b[i], b[i + 1]); lx.lineTo(b[i + 2], b[i + 3]); } lx.stroke();
    }
    for (let i = 0; i < DOTS.length; i += 5) {
      const c = COL[DOTS[i + 2]]; lx.fillStyle = 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + Math.min(1, DOTS[i + 4]) + ')';
      lx.beginPath(); lx.arc(DOTS[i], DOTS[i + 1], DOTS[i + 3], 0, 6.28318); lx.fill();
    }
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; ctx.filter = 'none';
    let g = ctx.createRadialGradient(W * 0.55, 600, 0, W * 0.55, 600, 1250);
    g.addColorStop(0, '#1d1748'); g.addColorStop(0.5, '#110e2e'); g.addColorStop(1, '#070614');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter';
    // the kernel's light: lilac while it assembles, warming at the centre once it locks
    const kq = project(KC), built = FMm.ss(18.6, 20.6, T), lock = FMm.ss(T_LOCK - 0.1, T_LOCK + 0.8, T);
    g = ctx.createRadialGradient(kq[0], kq[1], 0, kq[0], kq[1], 420);
    g.addColorStop(0, 'rgba(120,104,230,' + (0.10 + 0.12 * built) + ')'); g.addColorStop(1, 'rgba(60,50,140,0)');
    ctx.fillStyle = g; ctx.fillRect(kq[0] - 420, kq[1] - 420, 840, 840);
    if (lock > 0) {
      g = ctx.createRadialGradient(kq[0], kq[1], 0, kq[0], kq[1], 150);
      g.addColorStop(0, 'rgba(242,165,133,' + 0.32 * lock + ')'); g.addColorStop(1, 'rgba(217,119,87,0)');
      ctx.fillStyle = g; ctx.fillRect(kq[0] - 150, kq[1] - 150, 300, 300);
    }
    g4.globalCompositeOperation = 'copy'; g4.filter = 'blur(7px)'; g4.drawImage(L, 0, 0, W / 4, H / 4); g4.filter = 'none';
    g2.globalCompositeOperation = 'copy'; g2.filter = 'blur(2.6px)'; g2.drawImage(L, 0, 0, W / 2, H / 2); g2.filter = 'none';
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    ctx.globalAlpha = 0.85; ctx.drawImage(G4, 0, 0, W, H);
    ctx.globalAlpha = 0.75; ctx.drawImage(G2, 0, 0, W, H);
    ctx.globalAlpha = 1; ctx.drawImage(L, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    g = ctx.createRadialGradient(W / 2, H / 2, 420, W / 2, H / 2, 1180);
    g.addColorStop(0, 'rgba(2,2,8,0)'); g.addColorStop(1, 'rgba(2,2,8,0.42)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
  return { renderAt: render, isReady: () => true };
});
