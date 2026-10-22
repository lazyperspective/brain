/* Five Strangers — 02 · Under the Picnic
 *
 * An obsessive naturalist's cutaway: a slab of late-August meadow lifted out
 * from under a picnic, painted as opaque gouache over pencil on cream board.
 * Everything that falls from the blanket ends up below: the crumbs go down the
 * shaft to the crumb store, history sinks layer by layer, and at the bottom of
 * it all, in the warm heart of the dark, the queen lays eggs.
 *
 * The ground is painted once (chunked across frames) into a high-resolution
 * offscreen board. The ants live on a second canvas and walk a real tunnel
 * graph with a tripod gait. A loupe shows any part of the board at 3x.
 */
(function () {
  'use strict';

  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function RNG(seed) {
    const f = mulberry32(seed >>> 0);
    const R = {
      f,
      r: (a, b) => a + (b - a) * f(),
      i: (a, b) => Math.floor(a + (b - a + 1) * f()),
      pick: (arr) => arr[Math.floor(f() * arr.length)],
      chance: (p) => f() < p,
      s: () => (f() < 0.5 ? -1 : 1),
      g: () => (f() + f() + f() + f() - 2) * 1.73,
      fork: () => RNG((f() * 4294967296) >>> 0),
    };
    return R;
  }

  /* ------------------------------------------------------------ colour */
  const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const rgba = (c, a) => 'rgba(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ',' + (a === undefined ? 1 : a) + ')';
  const mixc = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
  const jit = (c, R, k) => [clamp(c[0] + R.r(-k, k), 0, 255), clamp(c[1] + R.r(-k, k), 0, 255), clamp(c[2] + R.r(-k, k), 0, 255)];
  const DK = [20, 13, 9], LT = [253, 245, 226];
  const shade = (c, k) => (k < 0 ? mixc(c, DK, -k) : mixc(c, LT, k));

  const P = {
    paper: hex('#efe4c9'), graphite: hex('#4d443c'), chalk: hex('#f1e6c8'),
    humus: hex('#30231a'), clay: hex('#74462a'), gravel: hex('#5a4733'), sand: hex('#8a6a44'),
    sandDeep: hex('#5a4630'), water: hex('#3d4643'), rock: hex('#4b5056'),
    inHumus: hex('#c39d74'), inClay: hex('#d6a26a'), inSand: hex('#d9b27c'), inQueen: hex('#eeb25e'),
    grass: [hex('#6f8a3a'), hex('#879948'), hex('#a7a25a'), hex('#5b7330'), hex('#bfae66'), hex('#7d8f3e'), hex('#94a050')],
    red: hex('#b5302a'), cream: hex('#efe5cf'),
  };

  /* ------------------------------------------------------- noise & paths */
  function noise1(R, spacing) {
    const v = new Float32Array(1024);
    for (let i = 0; i < 1024; i++) v[i] = R.r(-1, 1);
    const off = R.r(0, 600);
    return (x) => {
      const u = x / spacing + off; const i = Math.floor(u); const t = u - i; const s = t * t * (3 - 2 * t);
      return lerp(v[i & 1023], v[(i + 1) & 1023], s);
    };
  }
  function fbm1(R, spacing, oct) {
    const fs = []; let norm = 0;
    for (let k = 0; k < oct; k++) { fs.push(noise1(R, spacing / Math.pow(2.1, k))); norm += 1 / Math.pow(2, k); }
    return (x) => { let s = 0; for (let k = 0; k < oct; k++) s += fs[k](x) / Math.pow(2, k); return s / norm; };
  }
  function closedSmooth(c, pts) {
    const n = pts.length; const a0 = pts[n - 1], b0 = pts[0];
    c.moveTo((a0[0] + b0[0]) / 2, (a0[1] + b0[1]) / 2);
    for (let i = 0; i < n; i++) { const a = pts[i], b = pts[(i + 1) % n]; c.quadraticCurveTo(a[0], a[1], (a[0] + b[0]) / 2, (a[1] + b[1]) / 2); }
    c.closePath();
  }
  function openSmooth(c, pts) {
    c.moveTo(pts[0][0], pts[0][1]);
    if (pts.length < 3) { for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]); return; }
    for (let i = 1; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      c.quadraticCurveTo(a[0], a[1], (a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
    }
    const l = pts[pts.length - 1]; c.lineTo(l[0], l[1]);
  }
  function blobPts(R, cx, cy, rx, ry, rot, rough, n) {
    const p1 = R.r(0, TAU), p2 = R.r(0, TAU), a1 = R.r(0, rough), a2 = R.r(0, rough * 0.7);
    const cr = Math.cos(rot || 0), sr = Math.sin(rot || 0), out = [];
    n = n || 9;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU;
      const k = 1 + a1 * Math.sin(2 * a + p1) + a2 * Math.sin(3 * a + p2) + R.r(-rough, rough) * 0.4;
      const x = Math.cos(a) * rx * k, y = Math.sin(a) * ry * k;
      out.push([cx + x * cr - y * sr, cy + x * sr + y * cr]);
    }
    return out;
  }
  function blob(c, R, cx, cy, rx, ry, rot, rough, n) { closedSmooth(c, blobPts(R, cx, cy, rx, ry, rot, rough, n)); }
  function poly(c, R, cx, cy, r, n, rough) { // angular little stone / crumb
    const a0 = R.r(0, TAU);
    for (let i = 0; i < n; i++) {
      const a = a0 + (i / n) * TAU + R.r(-0.3, 0.3), k = r * R.r(1 - rough, 1 + rough * 0.4);
      if (i === 0) c.moveTo(cx + Math.cos(a) * k, cy + Math.sin(a) * k); else c.lineTo(cx + Math.cos(a) * k, cy + Math.sin(a) * k);
    }
    c.closePath();
  }
  function taper(c, pts, wf) {
    const n = pts.length, Lp = [], Rp = [];
    for (let i = 0; i < n; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
      let tx = b[0] - a[0], ty = b[1] - a[1]; const d = Math.hypot(tx, ty) || 1; tx /= d; ty /= d;
      const w = wf(i / (n - 1)) / 2;
      Lp.push([pts[i][0] - ty * w, pts[i][1] + tx * w]); Rp.push([pts[i][0] + ty * w, pts[i][1] - tx * w]);
    }
    c.moveTo(Lp[0][0], Lp[0][1]);
    for (let i = 1; i < n; i++) c.lineTo(Lp[i][0], Lp[i][1]);
    for (let i = n - 1; i >= 0; i--) c.lineTo(Rp[i][0], Rp[i][1]);
    c.closePath();
  }
  function catmull(ctrl, step) {
    const out = []; const n = ctrl.length;
    for (let i = 0; i < n - 1; i++) {
      const p0 = ctrl[Math.max(i - 1, 0)], p1 = ctrl[i], p2 = ctrl[i + 1], p3 = ctrl[Math.min(i + 2, n - 1)];
      const m = Math.max(2, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / step));
      for (let k = 0; k < m; k++) {
        const t = k / m, t2 = t * t, t3 = t2 * t;
        out.push([
          0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
          0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
        ]);
      }
    }
    out.push(ctrl[n - 1].slice());
    return out;
  }
  function resample(pts, step) {
    const out = [pts[0].slice()];
    let px = pts[0][0], py = pts[0][1], need = step;
    for (let i = 1; i < pts.length; i++) {
      const qx = pts[i][0], qy = pts[i][1];
      let seg = Math.hypot(qx - px, qy - py);
      while (seg >= need) {
        const t = need / seg; px += (qx - px) * t; py += (qy - py) * t;
        out.push([px, py]); seg = Math.hypot(qx - px, qy - py); need = step;
      }
      need -= seg; px = qx; py = qy;
    }
    const l = pts[pts.length - 1], o = out[out.length - 1];
    if (Math.hypot(l[0] - o[0], l[1] - o[1]) > step * 0.5) out.push(l.slice()); else out[out.length - 1] = l.slice();
    return out;
  }
  function cubicPts(a, b, c2, d, n) {
    const out = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n, u = 1 - t;
      out.push([u * u * u * a[0] + 3 * u * u * t * b[0] + 3 * u * t * t * c2[0] + t * t * t * d[0],
        u * u * u * a[1] + 3 * u * u * t * b[1] + 3 * u * t * t * c2[1] + t * t * t * d[1]]);
    }
    return out;
  }
  function polyLen(p) { let s = 0; for (let i = 1; i < p.length; i++) s += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]); return s; }

  /* ------------------------------------------------- hand lettering */
  function handText(c, R, str, x, y, size, col, opt) {
    opt = opt || {};
    c.save();
    c.font = (opt.upright ? '' : 'italic ') + (opt.weight || '') + ' ' + size + 'px serif';
    c.textBaseline = 'alphabetic';
    const sp = opt.spacing || 0;
    let w = 0; const ws = [];
    for (const ch of str) { const m = c.measureText(ch).width + sp * size; ws.push(m); w += m; }
    let px = opt.align === 'center' ? x - w / 2 : opt.align === 'right' ? x - w : x;
    let i = 0, drift = 0;
    for (const ch of str) {
      drift += R.r(-0.03, 0.03) * size;
      drift *= 0.8;
      c.save();
      c.translate(px, y + drift + R.r(-0.04, 0.04) * size);
      c.rotate(R.r(-0.05, 0.05) + (opt.rot || 0));
      c.fillStyle = rgba(jit(col, R, 10), (opt.alpha || 0.92) * R.r(0.82, 1));
      if (opt.shadow) { c.shadowColor = opt.shadow; c.shadowBlur = size * 0.35; }
      c.fillText(ch, 0, 0);
      c.restore();
      px += ws[i++];
    }
    c.restore();
    return w;
  }
  function textWidth(c, str, size, opt) {
    c.save(); c.font = ((opt && opt.upright) ? '' : 'italic ') + size + 'px serif';
    let w = 0; for (const ch of str) w += c.measureText(ch).width + ((opt && opt.spacing) || 0) * size;
    c.restore(); return w;
  }

  /* ================================================================ SCENE */
  function buildScene(W, H, seed) {
    const R = RNG(seed ^ 0x51ed270b);
    const portrait = H > W * 1.05;
    const L = clamp(Math.min(W / 88, H / 56), 9, 18);
    const top = Math.round(portrait ? H * 0.18 : H * 0.25);
    const gh = clamp(top * 0.3, 2.4 * L, 5.5 * L);
    const D = H - top;
    const sc = { W, H, L, top, gh, D, portrait, seed };
    sc.tw = 0.74 * L;
    const nCut = fbm1(R, 11 * L, 3);
    sc.Ex = W * (portrait ? R.r(0.4, 0.48) : R.r(0.4, 0.46));
    sc.craterW = 6.5 * L; sc.craterH = 2.0 * L;
    sc.cutY = (x) => top + nCut(x) * 0.4 * L;
    sc.mound = (x) => { const u = (x - sc.Ex) / sc.craterW; if (Math.abs(u) >= 1) return 0; return sc.craterH * Math.pow(1 - u * u, 1.1) * (1 - 0.5 * Math.exp(-u * u * 30)) * (1 + 0.12 * Math.sin(u * 9)); };
    sc.plane = (x, z) => [x + z * gh * 0.3, sc.cutY(x) - z * gh];

    // strata (fractions of depth)
    const fr = {};
    fr.b1 = R.r(0.19, 0.22); fr.b2 = R.r(0.43, 0.45); fr.b3 = fr.b2 + R.r(0.07, 0.085);
    fr.b4 = R.r(0.785, 0.8); fr.b5 = fr.b4 + R.r(0.045, 0.055); fr.q = R.r(0.67, 0.7);
    if (portrait) { fr.b1 = R.r(0.16, 0.19); fr.b2 = R.r(0.4, 0.42); fr.b3 = fr.b2 + 0.06; fr.q = R.r(0.65, 0.68); fr.b4 = 0.84; fr.b5 = 0.885; }
    sc.fr = fr;
    const bn = [null, fbm1(R, 14 * L, 3), fbm1(R, 18 * L, 3), fbm1(R, 12 * L, 2), fbm1(R, 30 * L, 2), fbm1(R, 22 * L, 2)];
    const amp = [0, 1.8, 1.2, 0.8, 0.7, 0.9];
    sc.by = (k, x) => top + D * fr['b' + k] + bn[k](x) * amp[k] * L;
    sc.yf = (f) => top + D * f;

    // plants & big obstacles
    sc.xd = clamp(sc.Ex + W * (portrait ? R.r(0.2, 0.26) : R.r(0.16, 0.22)), W * 0.55, W * (portrait ? 0.78 : 0.72));
    sc.xb = W * (portrait ? R.r(0.27, 0.31) : R.r(0.26, 0.31)); // blanket right edge
    sc.xs = W * (portrait ? 0.9 : R.r(0.84, 0.88)); // sandal
    buildRoots(sc, R);
    buildMole(sc, R);
    buildNest(sc, R);
    buildSurface(sc, R);
    buildNeighbours(sc, R);
    return sc;
  }

  function buildRoots(sc, R) {
    const { L, D, W } = sc;
    // dandelion taproot
    const x0 = sc.xd, y0 = sc.cutY(x0) - 0.2 * L, y1 = sc.yf(sc.fr.b2) - R.r(2, 4) * L;
    const ctrl = [[x0, y0]]; const n = 6;
    for (let i = 1; i <= n; i++) ctrl.push([x0 + R.r(-1, 1) * L * (0.4 + i * 0.25), lerp(y0, y1, i / n)]);
    sc.taproot = resample(catmull(ctrl, 4), L * 0.3);
    sc.taprootW = (t) => lerp(1.25 * L, 0.12 * L, Math.pow(t, 0.8));
    sc.taprootX = (y) => { let best = sc.taproot[0]; for (const p of sc.taproot) if (Math.abs(p[1] - y) < Math.abs(best[1] - y)) best = p; return best[0]; };
    // oak root from the left edge (from the tree that shades the picnic)
    const ty = sc.yf(R.r(0.11, 0.17)), len = Math.min(W * 0.3, 26 * L);
    const tc = [[-2 * L, ty - 1.5 * L], [len * 0.3, ty + R.r(-0.5, 1) * L], [len * 0.65, ty + R.r(1.5, 3) * L], [len, ty + R.r(3, 6) * L]];
    sc.oak = resample(catmull(tc, 4), L * 0.3);
    sc.oakW = (t) => lerp(3.2 * L, 0.5 * L, Math.pow(t, 0.9));
    sc.obst = [];
    sc.oak.forEach((p, i) => { if (i % 2 === 0) sc.obst.push([p[0], p[1], sc.oakW(i / (sc.oak.length - 1)) / 2 + 0.6 * L]); });
    // a sinker root that goes all the way down to drink at the water table
    const si = Math.floor(sc.oak.length * R.r(0.35, 0.5)), sp = sc.oak[si];
    const yEnd = sc.yf(sc.fr.b4) + 0.6 * L;
    const sk = [[sp[0], sp[1]]]; const nS = 9;
    for (let i = 1; i <= nS; i++) sk.push([sp[0] + R.r(-1, 1) * L * 1.2 + i * R.r(-0.2, 0.5) * L, lerp(sp[1], yEnd, i / nS)]);
    sc.sinker = resample(catmull(sk, 4), L * 0.3);
    sc.sinkerW = (t) => lerp(0.9 * L, 0.18 * L, t);
    sc.sinker.forEach((p, i) => { if (i % 3 === 0) sc.obst.push([p[0], p[1], 0.5 * L + 0.8 * L]); });
  }

  function buildMole(sc, R) {
    const { L, W } = sc;
    const len = Math.min(W * 0.22, 15 * L);
    const y = sc.yf(sc.portrait ? R.r(0.28, 0.34) : R.r(0.2, 0.26));
    const side = 1; // from the right edge
    const pts = [];
    for (let i = 0; i <= 16; i++) { const t = i / 16; pts.push([W + 2 * L - t * (len + 2 * L), y + Math.sin(t * 2.4 + 0.5) * 0.7 * L - t * 0.6 * L]); }
    sc.mole = { pts, r: 1.55 * L, head: pts[pts.length - 1], side };
    pts.forEach((p) => sc.obst.push([p[0], p[1], 1.55 * L + 1.2 * L]));
  }

  /* -------------------------------------------------------------- NEST */
  function buildNest(sc, R) {
    const { W, L, D, top, fr, tw } = sc;
    const yf = sc.yf;
    const Ex = sc.Ex, Ey = sc.cutY(Ex) - sc.mound(Ex) + 0.2 * L;
    const portrait = sc.portrait;
    const Qx = clamp(Ex + W * R.r(0.02, 0.09) * (portrait ? 0.7 : 1), W * 0.32, W * 0.68);
    const Qy = yf(fr.q);
    const hwMax = Math.min(W * (portrait ? 0.4 : 0.31), 34 * L);
    const asym = R.r(-0.12, 0.18);
    const g0 = yf(fr.b2) - 1.4 * L, g1 = yf(fr.b3) + 1.6 * L;
    const fq = fr.q;
    const prof = (f) => {
      if (f < 0.03) return 0.3;
      if (f < 0.16) return lerp(0.3, 1, sstep(0.03, 0.16, f));
      if (f < fr.b2 - 0.02) return lerp(1, 0.5, (f - 0.16) / (fr.b2 - 0.18));
      if (f < fr.b3 + 0.02) return 0.1;
      return 0.5;
    };
    const env = (y) => {
      const f = (y - top) / D, h = prof(f) * hwMax;
      return { c: lerp(Ex, Qx, sstep(0.04, fq, f)), l: h * (1 + asym), r: h * (1 - asym) };
    };
    sc.env = env;
    const chambers = [];
    const floorY = (ch, x) => { const u = clamp((x - ch.cx) / ch.rw, -1, 1); return ch.cy + ch.rh * 0.82 * Math.pow(1 - u * u, 0.11); };
    sc.floorY = floorY;
    const mkCh = (job, cx, cy, rw, rh) => {
      const ch = { id: chambers.length, job, cx, cy, rw, rh, conn: [false, false] };
      ch.pts = [];
      const p1 = R.r(0, TAU), p2 = R.r(0, TAU), a1 = R.r(0.05, 0.1), skew = R.r(-0.25, 0.25);
      // lobes in the domed ceiling, and an alcove dug into one upper corner
      const bumps = [];
      for (let k = 0; k < R.i(1, 2); k++) bumps.push([R.r(Math.PI * 1.3, Math.PI * 1.7), R.r(0.12, 0.2), R.r(0.14, 0.26)]);
      bumps.push([R.chance(0.5) ? Math.PI * R.r(1.08, 1.18) : Math.PI * R.r(1.82, 1.92), R.r(0.1, 0.16), R.r(0.18, 0.3)]);
      for (let i = 0; i < 64; i++) {
        const a = (i / 64) * TAU, s = Math.sin(a), co = Math.cos(a);
        if (s < 0) {
          let k = 1 + a1 * Math.sin(3 * a + p1) + 0.04 * Math.sin(5 * a + p2) + 0.02 * Math.sin(9 * a + p1);
          for (const b of bumps) { let d = a - b[0]; k += b[2] * Math.exp(-(d * d) / (b[1] * b[1])); }
          const x = cx + rw * co * k;
          const y = cy - rh * Math.pow(-s, 0.75) * k * (1 + skew * co);
          ch.pts.push([x, y]);
        } else {
          ch.pts.push([cx + rw * co, cy + rh * 0.82 * Math.pow(s, 0.22)]);
        }
      }
      chambers.push(ch); return ch;
    };
    const overlaps = (x, y, rw, rh, mx, my) => {
      for (const c of chambers) {
        const dx = (x - c.cx) / (rw + c.rw + mx), dy = (y - c.cy) / (rh + c.rh + my);
        if (dx * dx + dy * dy < 1) return true;
      }
      return false;
    };
    const hitsObst = (x, y, rw, rh, list) => {
      for (const o of list) {
        const dx = (x - o[0]) / (rw + o[2]), dy = (y - o[1]) / (rh + o[2]);
        if (dx * dx + dy * dy < 1) return true;
      }
      return false;
    };

    // the queen's chamber: the warm heart
    const Q = mkCh('queen', Qx, Qy, 6.4 * L, 2.5 * L);
    const qside = Qx > Ex ? -1 : 1;

    // main shaft: from the crater down through the gravel to the queen
    const attach = (ch, side) => { const x = ch.cx + side * ch.rw * 0.9; return [x, floorY(ch, x) - tw / 2]; };
    const qa = attach(Q, qside);
    const sx = lerp(Ex, qa[0], 0.6);
    const ctrl = [[Ex, Ey], [Ex + R.r(-0.4, 0.4) * L, sc.cutY(Ex) + 1.5 * L]];
    const fs = [0.1, 0.2, 0.31, fr.b2 - 0.03, (fr.b2 + fr.b3) / 2, fr.b3 + 0.03];
    for (const f of fs) {
      const t = sstep(0.02, fr.b2, f);
      ctrl.push([lerp(Ex, sx, t) + R.r(-1, 1) * 2.4 * L * (1 - Math.abs(t - 0.5)), yf(f)]);
    }
    ctrl.push([qa[0] - qside * 2.6 * L, qa[1] - 2.2 * L]);
    ctrl.push([qa[0] - qside * 0.6 * L, qa[1] - 0.1 * L]);
    ctrl.push(qa);
    const tunnels = [];
    const shaft = { id: 0, pts: resample(catmull(ctrl, 3), tw * 0.4), from: { type: 'E' }, to: { type: 'door', ch: Q.id, side: qside }, junc: [], shaft: true };
    tunnels.push(shaft);
    Q.conn[qside < 0 ? 0 : 1] = true;

    // spatial grid of tunnel points
    const cell = 2 * L, grid = new Map();
    const gkey = (x, y) => ((Math.floor(x / cell) + 1000) * 4000 + (Math.floor(y / cell) + 1000));
    const gadd = (t) => t.pts.forEach((p, i) => { const k = gkey(p[0], p[1]); if (!grid.has(k)) grid.set(k, []); grid.get(k).push([t.id, i]); });
    const gnear = (x, y, r, fn) => {
      const n = Math.ceil(r / cell);
      const cx = Math.floor(x / cell), cy = Math.floor(y / cell);
      for (let i = -n; i <= n; i++) for (let j = -n; j <= n; j++) {
        const a = grid.get((cx + i + 1000) * 4000 + (cy + j + 1000)); if (!a) continue;
        for (const it of a) { const p = tunnels[it[0]].pts[it[1]]; if (Math.hypot(p[0] - x, p[1] - y) < r) if (fn(it, p) === false) return; }
      }
    };
    gadd(shaft);
    const shaftObst = shaft.pts.filter((p, i) => i % 2 === 0).map((p) => [p[0], p[1], tw * 0.5 + 0.7 * L]);

    // connect chambers with galleries
    const inGravel = (y) => y > yf(fr.b2) - tw && y < yf(fr.b3) + tw;
    const validTunnel = (pts, ownCh, tgt) => {
      const tp = tgt.p;
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i];
        const dT = Math.hypot(p[0] - tp[0], p[1] - tp[1]);
        if (p[0] < L || p[0] > W - L) return false;
        if (p[1] < sc.cutY(p[0]) + 1.6 * L) return false;
        if (inGravel(p[1])) return false;
        for (const c of chambers) {
          if (c.id === ownCh.id) {
            if (i < 3) continue;
            const dx = (p[0] - c.cx) / (c.rw * 0.97), dy = (p[1] - c.cy) / (c.rh * 0.97);
            if (dx * dx + dy * dy < 1) return false;
            continue;
          }
          if (tgt.ch === c.id && dT < c.rw * 0.4 + 2 * L) continue;
          const dx = (p[0] - c.cx) / (c.rw + tw * 0.8), dy = (p[1] - c.cy) / (c.rh + tw * 0.8);
          if (dx * dx + dy * dy < 1) return false;
        }
        for (const o of sc.obst) if (Math.hypot(p[0] - o[0], p[1] - o[1]) < o[2]) return false;
        if (dT > 2.6 * L && i > 1) {
          let bad = false;
          gnear(p[0], p[1], tw * 1.55, () => { bad = true; return false; });
          if (bad) return false;
        }
      }
      return true;
    };
    const makeCurve = (A, side, T) => {
      const dx = T[0] - A[0], dy = T[1] - A[1];
      const k1 = clamp(Math.abs(dx) * 0.45, 1.2 * L, 6 * L);
      const c1 = [A[0] + side * k1, A[1] + dy * 0.05];
      const c2 = [T[0] - dx * 0.22, T[1] - dy * 0.42];
      const len = Math.hypot(dx, dy) + k1;
      const raw = cubicPts(A, c1, c2, T, Math.max(8, Math.ceil(len / (L * 0.6))));
      const ph = R.r(0, TAU), fq2 = R.r(0.25, 0.5);
      const wob = raw.map((p, i) => {
        const t = i / (raw.length - 1); const env2 = Math.sin(Math.PI * t);
        const a = raw[Math.max(0, i - 1)], b = raw[Math.min(raw.length - 1, i + 1)];
        let nx = -(b[1] - a[1]), ny = b[0] - a[0]; const d = Math.hypot(nx, ny) || 1; nx /= d; ny /= d;
        const w = Math.sin(i * fq2 + ph) * 0.22 * L * env2;
        return [p[0] + nx * w, p[1] + ny * w];
      });
      return resample(wob, tw * 0.4);
    };
    const connect = (ch, opts) => {
      opts = opts || {};
      let best = null;
      for (const side of [-1, 1]) {
        if (ch.conn[side < 0 ? 0 : 1]) continue;
        const A = attach(ch, side);
        // candidate targets
        let cands = [];
        for (const t of tunnels) {
          if (opts.excludeTunnels && opts.excludeTunnels.has(t.id)) continue;
          const own = [];
          for (let i = 3; i < t.pts.length - 3; i += 2) {
            const p = t.pts[i]; const d = Math.hypot(p[0] - A[0], p[1] - A[1]);
            if (d < 2.4 * L || d > (opts.maxD || 30 * L)) continue;
            if (Math.sign(p[0] - A[0]) !== side && Math.abs(p[0] - A[0]) > 1.5 * L) continue;
            own.push({ p, d, tunnel: t.id, idx: i, ch: -1 });
          }
          own.sort((a, b) => a.d - b.d);
          cands = cands.concat(own.filter((o, j) => j < 3 || j % 4 === 0).slice(0, 8));
        }
        cands.sort((a, b) => a.d - b.d);
        for (let k = 0; k < Math.min(cands.length, 40); k++) {
          const cd = cands[k];
          const pts = makeCurve(A, side, cd.p);
          if (!validTunnel(pts, ch, cd)) continue;
          const cost = polyLen(pts) + (tunnels[cd.tunnel].shaft ? -3 * L : 0);
          if (!best || cost < best.cost) best = { cost, pts, cd, side };
          break;
        }
      }
      if (!best) return false;
      const t = { id: tunnels.length, pts: best.pts, from: { type: 'door', ch: ch.id, side: best.side }, to: { type: 'junc', tunnel: best.cd.tunnel, idx: best.cd.idx }, junc: [] };
      tunnels.push(t); gadd(t);
      tunnels[best.cd.tunnel].junc.push({ idx: best.cd.idx, from: t.id });
      ch.conn[best.side < 0 ? 0 : 1] = true;
      ch.tun = ch.tun || []; ch.tun.push(t.id);
      return true;
    };
    // chambers by job
    const nRest = portrait ? 3 : Math.round(clamp(hwMax / L / 3.2, 3, 9));
    const specs = [
      ['crumbs', 0.04, 0.1, [4.3, 5.2], [1.6, 1.85], 1, { side: 1 }],
      ['alates', 0.04, 0.11, [3.6, 4.3], [1.7, 1.9], 1, {}],
      ['pasture', 0.14, Math.min(0.3, fr.b2 - 0.1), [4.2, 5.0], [1.9, 2.15], 1, { root: true }],
      ['midden', 0.05, 0.15, [3.0, 3.7], [1.25, 1.4], 1, { side: -1, edge: true }],
      ['pupae', 0.16, 0.34, [3.5, 4.4], [1.45, 1.65], 2, {}],
      ['larvae', 0.26, fr.b2 - 0.035, [3.3, 4.2], [1.4, 1.6], 2, {}],
      ['seeds', 0.1, 0.26, [3.1, 4.0], [1.3, 1.5], 2, {}],
      ['eggs', fr.b3 + 0.03, fq + 0.03, [3.0, 3.8], [1.3, 1.5], 2, { low: true }],
      ['rest', 0.07, fr.b2 - 0.04, [2.6, 3.8], [1.15, 1.4], nRest, {}],
      ['larvae', fr.b3 + 0.03, fq + 0.06, [3.0, 3.8], [1.3, 1.5], 1, { low: true }],
      ['rest', fr.b3 + 0.03, fq + 0.07, [2.5, 3.1], [1.1, 1.25], 2, { low: true }],
    ];
    const allObst = sc.obst.concat(shaftObst);
    for (const sp of specs) {
      for (let k = 0; k < sp[5]; k++) {
        const cands = [];
        for (let tr = 0; tr < 320 && cands.length < 14; tr++) {
          const rw = R.r(sp[3][0], sp[3][1]) * L, rh = R.r(sp[4][0], sp[4][1]) * L;
          const f = R.r(sp[1], sp[2]), y = Math.max(yf(f), top + 0.4 * L + 3.0 * L + rh + R.r(0, 1.5) * L * (sp[1] < 0.13 ? 1 : 0)), e = env(y);
          let x;
          const o = sp[6];
          if (o.root) x = sc.taprootX(y) + R.r(-0.25, 0.25) * rw;
          else if (o.side || o.edge) { const sd = o.side && tr < 160 ? o.side : R.s(); x = e.c + sd * R.r(o.edge ? 0.5 : 0.15, 1) * (sd < 0 ? e.l : e.r); }
          else x = e.c + R.r(-e.l, e.r);
          if (x - rw < e.c - e.l - rw * 0.35 || x + rw > e.c + e.r + rw * 0.35) continue;
          if (x - rw < 2.5 * L || x + rw > W - 2.5 * L) continue;
          if (y - rh < sc.cutY(x) + 2.8 * L) continue;
          if (y + rh > g0 && y - rh < g1) continue;
          if (overlaps(x, y, rw, rh, 1.25 * L, 1.35 * L)) continue;
          if (hitsObst(x, y, rw, rh, allObst)) continue;
          if (!o.root) { let hit = false; for (const p of sc.taproot) { const dx = (x - p[0]) / (rw + 1.5 * L), dy = (y - p[1]) / (rh + 1.2 * L); if (dx * dx + dy * dy < 1) { hit = true; break; } } if (hit) continue; }
          let near = false;
          gnear(x, y, rw + tw * 1.4, (it, p) => { const dx = (p[0] - x) / (rw + tw * 1.15), dy = (p[1] - y) / (rh + tw * 1.15); if (dx * dx + dy * dy < 1) { near = true; return false; } });
          if (near) continue;
          let md = 1e9;
          for (const c of chambers) md = Math.min(md, Math.hypot((x - c.cx) / 1.6, y - c.cy) - c.rw * 0.5);
          cands.push({ x, y, rw, rh, score: md + R.r(0, 2 * L) });
        }
        cands.sort((a, b) => b.score - a.score);
        for (const cd of cands) {
          const ch = mkCh(sp[0], cd.x, cd.y, cd.rw, cd.rh);
          if (connect(ch, { maxD: 30 * L })) break;
          chambers.pop();
        }
      }
    }
    const pending = [];
    // chambers that could not be reached are abandoned (filled in again)
    const dead = new Set(pending.map((c) => c.id));
    // a few loops: second doors joined back into the network
    const loopers = chambers.filter((c) => c !== Q && !dead.has(c.id) && (!c.conn[0] || !c.conn[1]));
    let loops = 0;
    for (const ch of loopers) {
      if (loops >= (portrait ? 2 : 4)) break;
      if (R.chance(0.6) && connect(ch, { maxD: 14 * L, excludeTunnels: new Set(ch.tun || []) })) loops++;
    }
    const live = chambers.filter((c) => !dead.has(c.id));
    live.forEach((c, i) => { c.oldId = c.id; });
    // re-index
    const remap = new Map(); live.forEach((c, i) => { remap.set(c.id, i); c.id = i; });
    for (const t of tunnels) { if (t.from.type === 'door') t.from.ch = remap.get(t.from.ch); if (t.to.type === 'door') t.to.ch = remap.get(t.to.ch); }
    sc.chambers = live; sc.tunnels = tunnels; sc.Q = live[remap.get(Q.oldId)];
    sc.E = [Ex, Ey];
    sc.abandoned = pending;
  }

  /* ----------------------------------------------- graph (for the ants) */
  function buildGraph(sc) {
    const V = [], Ed = [];
    const addV = (x, y, tag) => { V.push({ id: V.length, x, y, e: [], tag }); return V.length - 1; };
    const addE = (a, b, pts, kind, extra) => {
      const step = Math.max(1, sc.L * 0.25);
      const rp = pts.length > 1 ? resample(pts, step) : pts;
      const e = Object.assign({ id: Ed.length, a, b, pts: rp, kind, len: polyLen(rp) }, extra || {});
      e.cum = [0]; for (let i = 1; i < rp.length; i++) e.cum.push(e.cum[i - 1] + Math.hypot(rp[i][0] - rp[i - 1][0], rp[i][1] - rp[i - 1][1]));
      Ed.push(e); V[a].e.push(e.id); V[b].e.push(e.id); return e;
    };
    const { L, tw } = sc;
    // chamber floors
    for (const ch of sc.chambers) {
      const x0 = ch.cx - ch.rw * 0.9, x1 = ch.cx + ch.rw * 0.9;
      const pts = []; for (let i = 0; i <= 24; i++) { const x = lerp(x0, x1, i / 24); pts.push([x, sc.floorY(ch, x)]); }
      ch.vl = addV(pts[0][0], pts[0][1], 'door'); ch.vr = addV(pts[24][0], pts[24][1], 'door');
      ch.floor = addE(ch.vl, ch.vr, pts, 'floor', { ch: ch.id, off: 0 }).id;
    }
    sc.vE = addV(sc.E[0], sc.E[1], 'E');
    // tunnels: split at junctions
    for (const t of sc.tunnels) {
      const startV = t.from.type === 'E' ? sc.vE : t.from.type === 'door' ? (t.from.side < 0 ? sc.chambers[t.from.ch].vl : sc.chambers[t.from.ch].vr) : null;
      t.vStart = startV;
    }
    for (const t of sc.tunnels) {
      t.junc.forEach((j) => { j.v = addV(t.pts[j.idx][0], t.pts[j.idx][1], 'junc'); });
    }
    for (const t of sc.tunnels) {
      let endV;
      if (t.to.type === 'door') { const ch = sc.chambers[t.to.ch]; endV = t.to.side < 0 ? ch.vl : ch.vr; }
      else { const pt = sc.tunnels[t.to.tunnel]; endV = pt.junc.find((j) => j.from === t.id).v; }
      const brk = t.junc.slice().sort((a, b) => a.idx - b.idx);
      let lastI = 0, lastV = t.vStart;
      for (const j of brk) {
        if (j.idx <= lastI) { j.v = lastV; continue; }
        addE(lastV, j.v, t.pts.slice(lastI, j.idx + 1), 'tunnel', { off: tw * 0.5 - 0.03 * L });
        lastI = j.idx; lastV = j.v;
      }
      addE(lastV, endV, t.pts.slice(lastI), 'tunnel', { off: tw * 0.5 - 0.03 * L });
    }
    // fix junction vertices that were aliased
    // surface paths
    for (const s of sc.surfPaths) {
      const v = addV(s.pts[s.pts.length - 1][0], s.pts[s.pts.length - 1][1], 'spot');
      const e = addE(sc.vE, v, s.pts, 'surface', { off: 0, flat: true, name: s.name });
      s.edge = e.id; s.v = v;
      if (s.spot) { const v2 = addV(s.spot[s.spot.length - 1][0], s.spot[s.spot.length - 1][1], 'spot'); const e2 = addE(v, v2, s.spot, 'surface', { off: 0, flat: true, name: s.name, spotEdge: true }); s.spotEdge = e2.id; }
    }
    sc.V = V; sc.Ed = Ed;
  }

  /* ------------------------------------------------ the world above */
  function buildSurface(sc, R) {
    const { L, Ex, gh } = sc;
    const pl = sc.plane;
    const mY = (x) => sc.cutY(x) - sc.mound(x);
    sc.crust = { x: Ex + R.r(6.5, 9) * L, z: R.r(0.3, 0.45), len: R.r(5.5, 7) * L, rot: R.r(-0.25, 0.1) };
    sc.apple = { x: sc.xb * R.r(0.72, 0.84), z: R.r(0.42, 0.55) };
    const E = sc.E;
    const paths = [];
    // to the crust
    {
      const c = pl(sc.crust.x, sc.crust.z);
      const pts = catmull([[E[0], E[1]], [E[0] + 1.5 * L, mY(E[0] + 1.5 * L) - 0.1 * L], [E[0] + 3.5 * L, mY(E[0] + 3.5 * L)], pl(E[0] + 5.5 * L, 0.12), pl(sc.crust.x - 2.5 * L, sc.crust.z * 0.7), [c[0] - 1.6 * L, c[1] - 0.2 * L]], 3);
      const spot = []; for (let i = 0; i <= 8; i++) { const t = i / 8; spot.push([c[0] - 1.6 * L + t * 3.2 * L, c[1] - 0.2 * L - Math.sin(t * Math.PI) * 0.7 * L]); }
      paths.push({ name: 'crust', pts, spot });
    }
    // to the apple core, over the blanket
    {
      const a = pl(sc.apple.x, sc.apple.z);
      const bx = sc.xb;
      const lift = 0.7 * L;
      const pts = catmull([[E[0], E[1]], [E[0] - 1.6 * L, mY(E[0] - 1.6 * L)], [E[0] - 3.6 * L, mY(E[0] - 3.6 * L)], pl(lerp(E[0], bx, 0.5), 0.2), pl(bx + 1.2 * L, 0.32), [pl(bx + 0.3 * L, 0.35)[0], pl(bx, 0.35)[1] - lift], [a[0] + 2.4 * L, a[1] - lift]], 3);
      const spot = []; for (let i = 0; i <= 6; i++) { const t = i / 6; spot.push([a[0] + 2.4 * L - t * 1.8 * L, a[1] - lift - t * 0.2 * L]); }
      paths.push({ name: 'apple', pts, spot });
    }
    // seeds under the dandelion
    {
      const s = pl(sc.xd - 2.2 * L, 0.5);
      const pts = catmull([[E[0], E[1]], [E[0] + 1.2 * L, mY(E[0] + 1.2 * L)], pl(E[0] + 4 * L, 0.55), pl(lerp(E[0], sc.xd, 0.6), 0.75), s], 3);
      const spot = []; for (let i = 0; i <= 6; i++) { const t = i / 6; spot.push([s[0] + t * 2 * L, s[1] - Math.sin(t * 3) * 0.1 * L]); }
      paths.push({ name: 'seeds', pts, spot });
    }
    // spoil heap: builders dump their pellets on the crater rim
    {
      const pts = [[E[0], E[1]], [E[0] - 1.2 * L, mY(E[0] - 1.2 * L)], [E[0] - 2.3 * L, mY(E[0] - 2.3 * L)]];
      paths.push({ name: 'dump', pts: catmull(pts, 2) });
    }
    sc.surfPaths = paths;
  }

  /* ------------------------------------------- neighbours & buried things */
  function buildNeighbours(sc, R) {
    const { W, L, fr } = sc;
    const items = [];
    const cav = []; // [x,y,r] cavities to keep clear of
    for (const c of sc.chambers) cav.push([c.cx, c.cy, Math.max(c.rw, c.rh * 1.6) + 1.2 * L, c]);
    for (const t of sc.tunnels) t.pts.forEach((p, i) => { if (i % 3 === 0) cav.push([p[0], p[1], sc.tw + 0.8 * L]); });
    sc.oak.forEach((p, i) => { if (i % 3 === 0) cav.push([p[0], p[1], sc.oakW(i / sc.oak.length) / 2 + 0.6 * L]); });
    sc.taproot.forEach((p, i) => { if (i % 3 === 0) cav.push([p[0], p[1], sc.taprootW(i / sc.taproot.length) / 2 + 0.6 * L]); });
    sc.mole.pts.forEach((p) => cav.push([p[0], p[1], sc.mole.r + 1.2 * L]));
    const place = (name, f0, f1, rad, opts) => {
      opts = opts || {};
      let best = null, bs = -1e9;
      for (let i = 0; i < 160; i++) {
        const x = R.r(opts.x0 !== undefined ? opts.x0 : rad + L, opts.x1 !== undefined ? opts.x1 : W - rad - L);
        const y = Math.max(sc.yf(R.r(f0, f1)), sc.cutY(x) + rad + 1.4 * L);
        let md = 1e9;
        for (const c of cav) md = Math.min(md, Math.hypot(x - c[0], y - c[1]) - c[2] - rad);
        for (const it of items) md = Math.min(md, Math.hypot(x - it.x, y - it.y) - it.rad - rad - 1.5 * L);
        if (opts.bands) for (const k of opts.bands) md = Math.min(md, Math.abs(y - sc.by(k, x)) - rad * 0.7);
        md += R.r(0, 1.5 * L);
        if (md > bs) { bs = md; best = { x, y }; }
      }
      if (!best) best = { x: W / 2, y: sc.yf((f0 + f1) / 2) };
      const it = { name, x: best.x, y: best.y, rad, ok: bs > 0, skip: bs < -0.4 * L, rot: R.r(-0.6, 0.6), flip: R.s() };
      if (it.skip) return it; // no room for it in this slice of meadow
      items.push(it); cav.push([it.x, it.y, rad]);
      return it;
    };
    const b1 = fr.b1, b2 = fr.b2, b3 = fr.b3;
    place('worm', 0.04, b1 - 0.04, 5 * L, { bands: [1] });
    place('grub', b1 - 0.05, b1 + 0.07, 2.4 * L, {});
    place('toad', b1 + 0.07, b2 - 0.1, 4.6 * L, { bands: [2] });
    place('woodlice', 0.0, 0.03, 1.8 * L, { x0: 2 * L, x1: Math.max(4 * L, sc.xb - 2 * L) });
    place('key', 0.03, 0.09, 2.2 * L, {});
    place('cap', 0.07, b1 - 0.03, 1.2 * L, { bands: [1] });
    place('marble', 0.06, b1 - 0.02, 0.9 * L, {});
    place('soldier', b1 + 0.01, b1 + 0.08, 2.4 * L, { bands: [1] });
    place('pipe', b1 + 0.08, b2 - 0.08, 3.0 * L, {});
    place('coin', b2 - 0.08, b2 - 0.025, 1.2 * L, { bands: [2] });
    place('arrow', b2 + 0.015, b3 - 0.015, 1.4 * L, {});
    place('ammonite', fr.b5 + 0.035, Math.min(0.965, fr.b5 + 0.09), 3.0 * L, { x0: W * 0.4, x1: W - 13 * L });
    place('mammoth', b2 - 0.07, b2 - 0.035, 2.3 * L, { bands: [2] });
    place('bottle', b3 + 0.04, fr.b4 - 0.05, 4.2 * L, { x0: W * 0.36, x1: W - 7 * L });
    place('wormball', b1 + 0.08, b2 - 0.06, 2.0 * L, { x1: W - 24 * L });
    place('centipede', b1 + 0.02, b2 - 0.05, 3 * L, {});
    place('oldgallery', b3 + 0.05, fr.b4 - 0.06, 7.5 * L, { x0: W * 0.3, x1: W - 10 * L });
    place('rootchannel', b3 + 0.1, fr.b4 - 0.1, 3.4 * L, { x0: 6 * L, x1: W - 10 * L });
    place('acorn', 0.06, b1 - 0.04, 2.0 * L, { x0: 3 * L, x1: W * 0.5 });
    sc.items = items;
  }

  /* ================================================================ PAINT */
  function paintTasks(sc, c, S) {
    const { W, H, L, top, D, fr } = sc;
    const R = RNG(sc.seed ^ 0x2545f491);
    const T = [];
    const add = (f) => T.push(f);
    const clipPoly = (fn) => { c.save(); c.beginPath(); fn(); c.clip(); };
    const bandPath = (k0, k1) => {
      // polygon between boundary k0 (top) and k1 (bottom); k=0 -> cut edge, k=6 -> bottom
      const step = 6;
      const yk = (k, x) => (k === 0 ? sc.cutY(x) : k === 6 ? H + 4 : sc.by(k, x));
      c.moveTo(-4, yk(k0, -4));
      for (let x = -4; x <= W + 4; x += step) c.lineTo(x, yk(k0, x));
      for (let x = W + 4; x >= -4; x -= step) c.lineTo(x, yk(k1, x));
      c.closePath();
    };
    const area = (x0, y0, w, h, n, fn) => { for (let i = 0; i < n; i++) fn(x0 + R.f() * w, y0 + R.f() * h, i); };

    /* --- paper */
    add(() => {
      c.fillStyle = rgba(P.paper); c.fillRect(0, 0, W, H);
      for (let i = 0; i < 90; i++) {
        c.fillStyle = rgba(R.chance(0.5) ? shade(P.paper, 0.4) : shade(P.paper, -0.08), R.r(0.03, 0.08));
        c.beginPath(); blob(c, R, R.r(0, W), R.r(0, top * 1.1), R.r(20, 120), R.r(10, 50), R.r(0, 3), 0.3, 9); c.fill();
      }
      c.strokeStyle = rgba(shade(P.paper, -0.2), 0.08); c.lineWidth = 0.5;
      for (let i = 0; i < 260; i++) { const x = R.r(0, W), y = R.r(0, top); c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + R.r(-4, 4), y + R.r(-3, 3), x + R.r(-8, 8), y + R.r(-4, 4)); c.stroke(); }
    });

    /* --- the meadow floor beyond the cut (seen a little from above) */
    add(() => paintGroundPlane(c, sc, R));

    /* --- strata */
    const layerCols = [P.humus, P.clay, P.gravel, P.sand, P.water, P.rock];
    add(() => {
      for (let k = 0; k < 6; k++) {
        c.beginPath(); bandPath(k, k + 1); c.fillStyle = rgba(layerCols[k]); c.fill();
      }
      // sand darkens and dampens with depth
      clipPoly(() => bandPath(3, 4));
      const g = c.createLinearGradient(0, sc.yf(fr.b3), 0, sc.yf(fr.b4));
      g.addColorStop(0, rgba(shade(P.sand, 0.06), 0.9)); g.addColorStop(1, rgba(P.sandDeep, 0.95));
      c.fillStyle = g; c.fillRect(0, sc.yf(fr.b3) - 3 * L, W, D * 0.4); c.restore();
    });
    add(() => paintHumus(c, sc, R, bandPath, clipPoly, 0));
    add(() => paintHumus(c, sc, R, bandPath, clipPoly, 1));
    add(() => paintClay(c, sc, R, bandPath, clipPoly));
    add(() => paintGravel(c, sc, R, bandPath, clipPoly));
    add(() => paintSand(c, sc, R, bandPath, clipPoly));
    add(() => paintDeep(c, sc, R, bandPath, clipPoly));
    add(() => {
      // visible brushwork: broad, dry, semi-opaque strokes laid along the strata
      const cols = [[P.humus, hex('#4a3626'), hex('#1f1510')], [P.clay, hex('#8e5634'), hex('#5a321c')], null, [P.sand, hex('#a07e52'), hex('#5e4630')], null, [P.rock, hex('#646a70'), hex('#3a3e44')]];
      for (let k = 0; k < 6; k++) {
        if (!cols[k]) continue;
        clipPoly(() => bandPath(k, k + 1));
        const y0 = k === 0 ? sc.top : sc.yf(fr['b' + k]) - L, y1 = k === 5 ? H : sc.yf(fr['b' + (k + 1)]) + L;
        const n = Math.floor(W * (y1 - y0) / (L * L) * 0.9);
        for (let i = 0; i < n; i++) {
          const x = R.r(-2 * L, W), y = R.r(y0, y1), l = R.r(1.2, 4) * L, w = R.r(0.25, 0.9) * L;
          c.strokeStyle = rgba(R.chance(0.5) ? cols[k][1] : cols[k][2], R.r(0.05, 0.14)); c.lineWidth = w; c.lineCap = 'round';
          c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + l * 0.5, y + R.r(-0.3, 0.3) * L, x + l, y + R.r(-0.4, 0.4) * L); c.stroke();
        }
        c.restore();
      }
    });
    add(() => paintBoundaries(c, sc, R));
    add(() => paintFineRoots(c, sc, R));
    add(() => paintOak(c, sc, R));
    add(() => paintMole(c, sc, R));
    add(() => paintItems(c, sc, R));
    add(() => {
      // the warm heart: a faint glow in the dark sand around the queen's chamber
      const q = sc.Q;
      const g = c.createRadialGradient(q.cx, q.cy, q.rw * 0.5, q.cx, q.cy, q.rw * 3.4);
      g.addColorStop(0, 'rgba(255,170,80,0.42)'); g.addColorStop(0.4, 'rgba(240,145,64,0.18)'); g.addColorStop(1, 'rgba(240,145,64,0)');
      c.save(); c.globalCompositeOperation = 'screen'; c.fillStyle = g; c.fillRect(q.cx - q.rw * 3.5, q.cy - q.rw * 3.5, q.rw * 7, q.rw * 7); c.restore();
      // the oak's sinker root, drinking at the water table: root hairs beaded with water
      const se = sc.sinker[sc.sinker.length - 1];
      for (let k = 0; k < 26; k++) {
        const p = sc.sinker[Math.max(0, sc.sinker.length - 1 - Math.floor(R.f() * 10))];
        let px = p[0], py = p[1]; const a0 = Math.PI / 2 + R.r(-1.4, 1.4);
        c.strokeStyle = rgba(hex('#efe2c4'), 0.75); c.lineWidth = 0.6;
        c.beginPath(); c.moveTo(px, py);
        for (let j = 0; j < 4; j++) { px += Math.cos(a0 + R.r(-0.4, 0.4)) * 0.35 * L; py += Math.sin(a0 + R.r(-0.4, 0.4)) * 0.35 * L; c.lineTo(px, py); }
        c.stroke();
        if (R.chance(0.5)) { c.fillStyle = 'rgba(200,232,236,0.9)'; c.beginPath(); c.arc(px, py, 0.09 * L, 0, TAU); c.fill(); c.fillStyle = rgba(LT); c.beginPath(); c.arc(px - 0.03 * L, py - 0.03 * L, 0.03 * L, 0, TAU); c.fill(); }
      }
      c.fillStyle = rgba(hex('#f4ead0')); c.beginPath(); c.ellipse(se[0], se[1], 0.16 * L, 0.3 * L, 0, 0, TAU); c.fill();
    });
    add(() => paintNestShell(c, sc, R));
    add(() => paintNestContents(c, sc, R));
    add(() => paintTaproot(c, sc, R));
    add(() => paintCutEdge(c, sc, R));
    add(() => paintAbove(c, sc, R, 0));
    add(() => paintAbove(c, sc, R, 1));
    add(() => paintLabels(c, sc, R));
    add(() => finishBoard(c, sc, R, S));
    return T;
  }

  function grainTile(R, size, dark, light, density) {
    const cv = document.createElement('canvas'); cv.width = cv.height = size;
    const x = cv.getContext('2d'); const id = x.createImageData(size, size); const d = id.data;
    for (let i = 0; i < size * size; i++) {
      const r = R.f();
      if (r < density) { const k = R.f() < 0.5; const col = k ? dark : light; d[i * 4] = col[0]; d[i * 4 + 1] = col[1]; d[i * 4 + 2] = col[2]; d[i * 4 + 3] = R.r(20, 110); }
    }
    x.putImageData(id, 0, 0); return cv;
  }

  function paintGroundPlane(c, sc, R) {
    const { W, L, gh } = sc;
    const far = fbm1(R, 6 * L, 3);
    const farY = (x) => sc.cutY(x) - gh * (1 + 0.25 * far(x)) ;
    // base wash
    c.beginPath(); c.moveTo(-4, sc.cutY(-4));
    for (let x = -4; x <= W + 4; x += 5) c.lineTo(x, sc.cutY(x) + 1);
    for (let x = W + 4; x >= -4; x -= 5) c.lineTo(x, farY(x));
    c.closePath();
    const g = c.createLinearGradient(0, sc.top - gh * 1.2, 0, sc.top);
    g.addColorStop(0, rgba(hex('#b4ab78'), 0.0)); g.addColorStop(0.25, rgba(hex('#9d9560'), 0.75)); g.addColorStop(1, rgba(hex('#5c5a2f')));
    c.fillStyle = g; c.fill();
    // thatch: dry straw dashes, soil specks, little clover
    for (let i = 0; i < W * gh / (L * 0.9); i++) {
      const x = R.r(-10, W + 10), z = Math.pow(R.f(), 1.4), p = sc.plane(x, z);
      if (p[1] < farY(p[0]) + 2) continue;
      const col = R.pick([hex('#c9b878'), hex('#8c8a4a'), hex('#a39b5c'), hex('#5f5c30'), hex('#d8c98e'), hex('#6d7a3a')]);
      c.strokeStyle = rgba(jit(col, R, 12), R.r(0.4, 0.85)); c.lineWidth = R.r(0.5, 1.4) * (1 - z * 0.4);
      const a = R.r(-0.4, 0.4) + (R.chance(0.5) ? 0 : Math.PI), l = R.r(0.4, 1.6) * L * (1 - z * 0.5);
      c.beginPath(); c.moveTo(p[0], p[1]); c.quadraticCurveTo(p[0] + Math.cos(a) * l * 0.5, p[1] + Math.sin(a) * l * 0.2 - 1, p[0] + Math.cos(a) * l, p[1] + Math.sin(a) * l * 0.25); c.stroke();
    }
    // clover clumps
    for (let i = 0; i < W / (L * 8); i++) {
      const x = R.r(0, W), z = R.r(0.1, 0.8), p = sc.plane(x, z);
      if (Math.abs(x - sc.Ex) < sc.craterW + 2 * L) continue;
      if (x < sc.xb + L) continue;
      for (let k = 0; k < 3; k++) {
        const a = -Math.PI / 2 + (k - 1) * 1.2 + R.r(-0.2, 0.2), r = L * 0.42 * (1 - z * 0.4);
        c.fillStyle = rgba(jit(hex('#5d7a34'), R, 10), 0.95);
        c.beginPath(); c.ellipse(p[0] + Math.cos(a) * r, p[1] - 0.3 * L + Math.sin(a) * r * 0.5, r, r * 0.55, a, 0, TAU); c.fill();
        c.strokeStyle = rgba(hex('#dfe0bd'), 0.5); c.lineWidth = 0.6;
        c.beginPath(); c.ellipse(p[0] + Math.cos(a) * r, p[1] - 0.3 * L + Math.sin(a) * r * 0.5, r * 0.5, r * 0.25, a, Math.PI, TAU); c.stroke();
      }
    }
    // pencil: the meadow continuing, never painted
    c.strokeStyle = rgba(P.graphite, 0.32); c.lineCap = 'round';
    for (let x = sc.xb + 2 * L; x < W + 10; x += R.r(2, 7)) {
      const y = farY(x) + R.r(0, 3);
      const h = R.r(0.8, 3.2) * L * (0.5 + 0.5 * Math.abs(far(x * 1.7)));
      c.lineWidth = R.r(0.35, 0.8);
      c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + R.r(-2, 2), y - h * 0.6, x + R.r(-6, 6), y - h); c.stroke();
    }
  }

  function crumbField(c, sc, R, x0, x1, ytop, ybot, dens, pal, sizeR, hi) {
    const { L } = sc;
    const n = Math.floor((x1 - x0) * (ybot - ytop) * dens / (L * L));
    for (let i = 0; i < n; i++) {
      const x = R.r(x0, x1), y = R.r(ytop, ybot);
      const r = R.r(sizeR[0], sizeR[1]) * L * (R.chance(0.08) ? 1.8 : 1);
      const col = jit(R.pick(pal), R, 10);
      c.fillStyle = rgba(col, R.r(0.75, 1));
      c.beginPath(); poly(c, R, x, y, r, R.i(5, 7), 0.45); c.fill();
      if (hi && R.chance(hi)) {
        c.fillStyle = rgba(shade(col, 0.35), 0.7);
        c.beginPath(); c.arc(x - r * 0.35, y - r * 0.35, r * 0.28, 0, TAU); c.fill();
        c.fillStyle = rgba(DK, 0.45);
        c.beginPath(); c.arc(x + r * 0.3, y + r * 0.45, r * 0.3, 0, TAU); c.fill();
      }
    }
  }

  function paintHumus(c, sc, R, bandPath, clipPoly, half) {
    const { W, L, fr } = sc;
    const x0 = half ? W / 2 : -4, x1 = half ? W + 4 : W / 2;
    clipPoly(() => bandPath(0, 1));
    const yT = sc.top - L, yB = sc.yf(fr.b1) + 2.5 * L;
    // soft mottles
    for (let i = 0; i < 40; i++) {
      c.fillStyle = rgba(R.chance(0.5) ? hex('#3f2e22') : hex('#221812'), R.r(0.15, 0.35));
      c.beginPath(); blob(c, R, R.r(x0, x1), R.r(yT, yB), R.r(2, 8) * L, R.r(1, 3) * L, R.r(-0.3, 0.3), 0.3, 10); c.fill();
    }
    const pal = [hex('#2a1e16'), hex('#463426'), hex('#57412e'), hex('#221711'), hex('#674d36'), hex('#3a2a1f'), hex('#4f4a3a')];
    crumbField(c, sc, R, x0, x1, yT, yB, 3.2, pal, [0.08, 0.2], 0.5);
    // litter fragments: leaf bits, twigs, husks, charcoal
    const nfr = Math.floor((x1 - x0) / L * 1.6);
    for (let i = 0; i < nfr; i++) {
      const x = R.r(x0, x1), y = R.r(sc.top, lerp(sc.top, yB, R.chance(0.7) ? 0.4 : 1));
      const kind = R.i(0, 4);
      if (kind === 0) { // leaf fragment
        c.fillStyle = rgba(jit(R.pick([hex('#6b4a22'), hex('#8a5f2a'), hex('#4f3a1c')]), R, 12), 0.9);
        c.beginPath(); blob(c, R, x, y, R.r(0.3, 0.7) * L, R.r(0.08, 0.16) * L, R.r(-0.5, 0.5), 0.4, 7); c.fill();
      } else if (kind === 1) { // twig
        const a = R.r(-0.6, 0.6), l = R.r(0.6, 1.8) * L;
        c.strokeStyle = rgba(jit(hex('#5a3d24'), R, 10), 0.95); c.lineWidth = R.r(0.12, 0.22) * L; c.lineCap = 'round';
        c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); c.stroke();
        c.strokeStyle = rgba(hex('#a07a52'), 0.5); c.lineWidth = 0.5;
        c.beginPath(); c.moveTo(x, y - 0.05 * L); c.lineTo(x + Math.cos(a) * l * 0.8, y + Math.sin(a) * l * 0.8 - 0.05 * L); c.stroke();
      } else if (kind === 2) { // charcoal
        c.fillStyle = rgba(hex('#100c0b'), 0.9);
        c.beginPath(); poly(c, R, x, y, R.r(0.1, 0.25) * L, 4, 0.3); c.fill();
        c.fillStyle = rgba(hex('#7c7a80'), 0.5); c.fillRect(x - 0.05 * L, y - 0.06 * L, 0.05 * L, 0.03 * L);
      } else if (kind === 3) { // seed husk
        c.fillStyle = rgba(jit(hex('#b08a50'), R, 12), 0.85);
        c.beginPath(); c.ellipse(x, y, 0.22 * L, 0.09 * L, R.r(0, 3), 0, TAU); c.fill();
      } else { // white fungal threads
        c.strokeStyle = rgba(hex('#e8e2d0'), R.r(0.25, 0.5)); c.lineWidth = 0.45;
        let px = x, py = y;
        c.beginPath(); c.moveTo(px, py);
        for (let k = 0; k < 7; k++) { px += R.r(-0.6, 0.6) * L; py += R.r(-0.3, 0.5) * L; c.lineTo(px, py); }
        c.stroke();
      }
    }
    // tiny life: springtails and mites
    for (let i = 0; i < (x1 - x0) / (L * 22); i++) {
      const x = R.r(x0, x1), y = R.r(sc.top + 2 * L, yB - 2 * L);
      if (R.chance(0.6)) springtail(c, R, x, y, L * 0.35); else mite(c, R, x, y, L * 0.14);
    }
    // worm burrows (empty, lined dark) — old channels
    for (let i = 0; i < (x1 - x0) / (L * 30); i++) {
      let x = R.r(x0, x1), y = R.r(sc.top + 2 * L, yB);
      const pts = [[x, y]]; let a = R.r(0, TAU);
      for (let k = 0; k < 10; k++) { a += R.r(-0.5, 0.5); x += Math.cos(a) * L * 0.8; y += Math.sin(a) * L * 0.8; pts.push([x, y]); }
      c.strokeStyle = rgba(hex('#1a120d'), 0.55); c.lineWidth = 0.55 * L; c.lineCap = 'round'; c.lineJoin = 'round';
      c.beginPath(); openSmooth(c, pts); c.stroke();
      c.strokeStyle = rgba(hex('#4a3626'), 0.6); c.lineWidth = 0.32 * L;
      c.beginPath(); openSmooth(c, pts); c.stroke();
    }
    c.restore();
  }

  function springtail(c, R, x, y, s) {
    const a = R.r(-0.4, 0.4);
    c.save(); c.translate(x, y); c.rotate(a); if (R.chance(0.5)) c.scale(-1, 1);
    c.fillStyle = rgba(hex('#dcd8cc'), 0.9);
    c.beginPath(); c.ellipse(0, 0, s * 0.5, s * 0.18, 0, 0, TAU); c.fill();
    c.beginPath(); c.ellipse(s * 0.48, -s * 0.04, s * 0.14, s * 0.12, 0, 0, TAU); c.fill();
    c.strokeStyle = rgba(hex('#cfc8b8'), 0.85); c.lineWidth = s * 0.05;
    c.beginPath(); c.moveTo(s * 0.55, -s * 0.12); c.lineTo(s * 0.8, -s * 0.38); c.moveTo(s * 0.5, -s * 0.12); c.lineTo(s * 0.62, -s * 0.42);
    c.moveTo(-s * 0.45, s * 0.1); c.lineTo(-s * 0.1, s * 0.22); // furcula
    c.stroke();
    c.fillStyle = rgba(hex('#2a2a3a'), 0.9); c.beginPath(); c.arc(s * 0.55, -s * 0.06, s * 0.04, 0, TAU); c.fill();
    c.restore();
  }
  function mite(c, R, x, y, s) {
    c.fillStyle = rgba(hex('#c0281e'), 0.95);
    c.beginPath(); c.ellipse(x, y, s, s * 0.8, 0, 0, TAU); c.fill();
    c.strokeStyle = rgba(hex('#8a1a14'), 0.9); c.lineWidth = s * 0.18;
    c.beginPath();
    for (let k = 0; k < 4; k++) { const a = -0.6 + k * 0.4; c.moveTo(x - s * 0.6, y + s * 0.2); c.lineTo(x - s * 1.6, y + Math.sin(a) * s * 1.2); c.moveTo(x + s * 0.6, y + s * 0.2); c.lineTo(x + s * 1.6, y + Math.sin(a) * s * 1.2); }
    c.stroke();
    c.fillStyle = rgba(hex('#ffd0c0'), 0.7); c.beginPath(); c.arc(x - s * 0.3, y - s * 0.35, s * 0.25, 0, TAU); c.fill();
  }

  function paintClay(c, sc, R, bandPath, clipPoly) {
    const { W, L, fr } = sc;
    clipPoly(() => bandPath(1, 2));
    const yT = sc.yf(fr.b1) - 3 * L, yB = sc.yf(fr.b2) + 2 * L;
    // deep terracotta wash variation
    for (let i = 0; i < 70; i++) {
      c.fillStyle = rgba(R.pick([hex('#865134'), hex('#683e25'), hex('#7d5030'), hex('#5e3a22')]), R.r(0.2, 0.5));
      c.beginPath(); blob(c, R, R.r(0, W), R.r(yT, yB), R.r(3, 10) * L, R.r(1, 3) * L, R.r(-0.2, 0.2), 0.35, 10); c.fill();
    }
    // gley mottles (blue-grey) and rust
    for (let i = 0; i < W * (yB - yT) / (L * L * 9); i++) {
      const x = R.r(0, W), y = R.r(yT, yB);
      const g = R.chance(0.55);
      c.fillStyle = rgba(jit(g ? hex('#757873') : hex('#a85d2a'), R, 10), R.r(0.25, 0.6));
      c.beginPath(); blob(c, R, x, y, R.r(0.3, 1.4) * L, R.r(0.2, 0.8) * L, R.r(-1, 1), 0.5, 8); c.fill();
    }
    // bleached old root channels
    for (let i = 0; i < W / (L * 6); i++) {
      let x = R.r(0, W), y = R.r(yT, yB - 4 * L);
      const pts = [[x, y]];
      for (let k = 0; k < 8; k++) { x += R.r(-0.4, 0.4) * L; y += R.r(0.5, 1) * L; pts.push([x, y]); }
      c.strokeStyle = rgba(hex('#8e8a80'), 0.35); c.lineWidth = R.r(0.3, 0.6) * L; c.lineCap = 'round';
      c.beginPath(); openSmooth(c, pts); c.stroke();
      c.strokeStyle = rgba(hex('#b06a33'), 0.3); c.lineWidth = 0.6;
      c.beginPath(); openSmooth(c, pts.map((p) => [p[0] + 0.3 * L, p[1]])); c.stroke();
    }
    // fine speckle
    crumbField(c, sc, R, 0, W, yT, yB, 1.2, [hex('#5a3520'), hex('#8f5a36'), hex('#9a6a44'), hex('#4a2c1a')], [0.04, 0.1], 0.15);
    // manganese dots
    for (let i = 0; i < W / L * 2; i++) { c.fillStyle = rgba(hex('#1a110c'), 0.8); c.beginPath(); c.arc(R.r(0, W), R.r(yT, yB), R.r(0.04, 0.12) * L, 0, TAU); c.fill(); }
    // blocky ped cracks
    c.strokeStyle = rgba(hex('#2a170d'), 0.55);
    for (let i = 0; i < W / (L * 2.5); i++) {
      let x = R.r(0, W), y = R.r(yT + 2 * L, yB);
      c.lineWidth = R.r(0.4, 1.1);
      c.beginPath(); c.moveTo(x, y);
      const vert = R.chance(0.6);
      for (let k = 0; k < R.i(3, 7); k++) { x += vert ? R.r(-0.4, 0.4) * L : R.r(0.5, 1.2) * L * R.s(); y += vert ? R.r(0.5, 1.1) * L : R.r(-0.3, 0.3) * L; c.lineTo(x, y); }
      c.stroke();
    }
    // flints
    for (let i = 0; i < W / (L * 18); i++) stone(c, R, R.r(0, W), R.r(yT + 2 * L, yB - L), R.r(0.4, 1.2) * L, R.pick([hex('#2f3540'), hex('#8a8478'), hex('#5a4a3c')]));
    c.restore();
  }

  function stone(c, R, x, y, r, col, opt) {
    opt = opt || {};
    const pts = blobPts(R, x, y, r * R.r(1, 1.5), r * R.r(0.65, 1), R.r(-0.5, 0.5), 0.18, 9);
    c.fillStyle = rgba(DK, 0.55);
    c.beginPath(); closedSmooth(c, pts.map((p) => [p[0] + r * 0.12, p[1] + r * 0.2])); c.fill();
    c.fillStyle = rgba(col);
    c.beginPath(); closedSmooth(c, pts); c.fill();
    c.save(); c.beginPath(); closedSmooth(c, pts); c.clip();
    c.fillStyle = rgba(shade(col, -0.35), 0.75);
    c.beginPath(); c.ellipse(x + r * 0.55, y + r * 0.6, r * 1.3, r * 0.9, -0.5, 0, TAU); c.fill();
    if (opt.cortex) { c.fillStyle = rgba(hex('#e2dccb'), 0.9); c.beginPath(); const a0 = R.r(0, TAU); c.ellipse(x + Math.cos(a0) * r * 1.1, y + Math.sin(a0) * r * 0.9, r * 0.9, r * 0.6, a0, 0, TAU); c.fill(); }
    if (opt.vein) { c.strokeStyle = rgba(LT, 0.5); c.lineWidth = r * 0.1; c.beginPath(); c.moveTo(x - r * 1.4, y + R.r(-r, r)); c.lineTo(x + r * 1.4, y + R.r(-r, r)); c.stroke(); }
    if (opt.bands) { c.strokeStyle = rgba(shade(col, -0.2), 0.5); c.lineWidth = r * 0.08; for (let k = -2; k <= 2; k++) { c.beginPath(); c.moveTo(x - r * 1.5, y + k * r * 0.35 - r * 0.3); c.lineTo(x + r * 1.5, y + k * r * 0.35 + r * 0.3); c.stroke(); } }
    if (opt.spots) { for (let k = 0; k < 5; k++) { c.fillStyle = rgba(shade(col, R.r(-0.4, 0.3)), 0.7); c.beginPath(); c.arc(x + R.r(-r, r), y + R.r(-r, r) * 0.7, r * R.r(0.06, 0.15), 0, TAU); c.fill(); } }
    c.restore();
    c.fillStyle = rgba(shade(col, 0.45), opt.glass ? 0.95 : 0.32);
    c.beginPath(); c.ellipse(x - r * 0.35, y - r * 0.38, r * 0.34, r * 0.13, -0.5, 0, TAU); c.fill();
    if (R.chance(0.2)) { c.fillStyle = rgba(LT, 0.75); c.beginPath(); c.arc(x - r * 0.5, y - r * 0.42, r * 0.07, 0, TAU); c.fill(); }
  }

  function paintGravel(c, sc, R, bandPath, clipPoly) {
    const { W, L, fr } = sc;
    clipPoly(() => bandPath(2, 3));
    const yT = sc.yf(fr.b2) - 2 * L, yB = sc.yf(fr.b3) + 2 * L;
    crumbField(c, sc, R, 0, W, yT, yB, 3, [hex('#6a563f'), hex('#4b3a2a'), hex('#7d6a50'), hex('#59473a')], [0.06, 0.14], 0.2);
    // dart-throw pebbles, big first
    const peb = [];
    const kinds = [
      [hex('#5f6b78'), { cortex: true }], [hex('#3a4048'), { cortex: true }], [hex('#d8d2c4'), { vein: true }], [hex('#c79a86'), { bands: true }],
      [hex('#a2582c'), { spots: true }], [hex('#d9cfb0'), {}], [hex('#2b2a2c'), {}], [hex('#8f8a7c'), { spots: true }], [hex('#b88a4e'), { bands: true }], [hex('#6c7d6a'), {}],
    ];
    for (let i = 0; i < W * (yB - yT) / (L * L) * 5; i++) {
      const r = (R.chance(0.1) ? R.r(1.0, 1.7) : R.r(0.2, 0.75)) * L;
      const x = R.r(-r, W + r), y = R.r(yT, yB);
      let ok = true;
      for (let k = peb.length - 1; k >= 0 && ok; k--) { const p = peb[k]; if (Math.abs(p[0] - x) < (p[2] + r) * 1.4 && Math.hypot(p[0] - x, p[1] - y) < (p[2] + r) * 0.8) ok = false; }
      if (!ok) continue;
      peb.push([x, y, r]);
    }
    peb.sort((a, b) => a[1] - b[1]);
    for (const p of peb) { const k = R.pick(kinds); stone(c, R, p[0], p[1], p[2], jit(k[0], R, 12), k[1]); }
    c.restore();
  }

  function paintSand(c, sc, R, bandPath, clipPoly) {
    const { W, L, fr } = sc;
    clipPoly(() => bandPath(3, 4));
    const yT = sc.yf(fr.b3) - 2 * L, yB = sc.yf(fr.b4) + 2 * L;
    // broad colour bands: iron-stained, bleached, damp
    for (let k = 0; k < 6; k++) {
      const y0 = R.r(yT, yB), n = fbm1(R, 22 * L, 2);
      const col = R.pick([hex('#a0703a'), hex('#b8925a'), hex('#4f3b28'), hex('#c4a470'), hex('#8a5a2c')]);
      for (let j = 0; j < 5; j++) {
        c.strokeStyle = rgba(col, R.r(0.08, 0.16)); c.lineWidth = R.r(0.6, 2.2) * L;
        c.beginPath(); for (let x = -10; x <= W + 10; x += 12) { const y = y0 + n(x) * 1.6 * L + j * 0.3 * L; if (x < 0) c.moveTo(x, y); else c.lineTo(x, y); } c.stroke();
      }
    }
    // cross-bedded sets: the ghost of an old river
    let y = yT;
    while (y < yB) {
      const h = R.r(1.8, 4.2) * L, dir = R.s(), sp = R.r(0.26, 0.42) * L, run = h / R.r(0.45, 0.8);
      const nb = fbm1(R, 26 * L, 2);
      c.save(); c.beginPath(); c.moveTo(-10, y + nb(-10) * 0.6 * L);
      for (let x = -10; x <= W + 10; x += 10) c.lineTo(x, y + nb(x) * 0.6 * L);
      c.lineTo(W + 10, y + h + L); c.lineTo(-10, y + h + L); c.closePath(); c.clip();
      for (let x0 = -run - 10; x0 < W + run; x0 += sp * R.r(0.7, 1.3)) {
        const col = R.chance(0.5) ? hex('#d6ba88') : hex('#3c2a1a');
        c.strokeStyle = rgba(col, R.r(0.2, 0.45)); c.lineWidth = R.r(0.5, 1.3);
        c.beginPath(); c.moveTo(x0, y - 0.2 * L); c.quadraticCurveTo(x0 + dir * run * 0.45, y + h * 0.95, x0 + dir * run, y + h + 0.3 * L); c.stroke();
      }
      c.restore();
      c.strokeStyle = rgba(hex('#2e2216'), 0.4); c.lineWidth = 0.9;
      c.beginPath(); for (let x = -10; x <= W + 10; x += 10) { const yy = y + nb(x) * 0.6 * L; if (x < 0) c.moveTo(x, yy); else c.lineTo(x, yy); } c.stroke();
      y += h;
    }
    crumbField(c, sc, R, 0, W, yT, yB, 2.2, [hex('#a88b5e'), hex('#6b5236'), hex('#c4ab7c'), hex('#4f3c28'), hex('#8a6a44')], [0.025, 0.06], 0);
    // pebble stringers
    for (let k = 0; k < W / (L * 25); k++) {
      const x0 = R.r(0, W), y0 = R.r(yT + 3 * L, yB - 3 * L);
      for (let i = 0; i < R.i(4, 9); i++) stone(c, R, x0 + i * R.r(0.6, 1.4) * L, y0 + R.r(-0.3, 0.3) * L, R.r(0.15, 0.35) * L, R.pick([hex('#d8cdb0'), hex('#8a7a62'), hex('#b07a48'), hex('#5e646c')]));
    }
    // quartz glints
    for (let i = 0; i < W / L * 4; i++) { c.fillStyle = rgba(LT, R.r(0.3, 0.8)); const s = R.r(0.5, 1.3); c.fillRect(R.r(0, W), R.r(yT, yB), s, s); }
    c.restore();
  }

  function paintDeep(c, sc, R, bandPath, clipPoly) {
    const { W, H, L, fr } = sc;
    // capillary fringe: the sand darkens as it wets
    const yw = sc.yf(fr.b4);
    const g0 = c.createLinearGradient(0, yw - 3.5 * L, 0, yw);
    g0.addColorStop(0, 'rgba(20,24,22,0)'); g0.addColorStop(1, 'rgba(20,24,22,0.45)');
    clipPoly(() => bandPath(3, 4)); c.fillStyle = g0; c.fillRect(0, yw - 4 * L, W, 6 * L); c.restore();
    // the water table: saturated sand, every pore full
    clipPoly(() => bandPath(4, 5));
    const yT = sc.yf(fr.b4) - 2 * L, yB = sc.yf(fr.b5) + 2 * L;
    crumbField(c, sc, R, 0, W, yT, yB, 2.4, [hex('#4b524b'), hex('#2f3633'), hex('#5c6258'), hex('#3a3f3a'), hex('#556058')], [0.03, 0.08], 0.15);
    for (let i = 0; i < W / (L * 0.8); i++) {
      const x = R.r(0, W), yy = R.r(yT + L, yB - L), l = R.r(0.3, 2.0) * L;
      c.strokeStyle = rgba(hex('#a9c6c4'), R.r(0.15, 0.5)); c.lineWidth = R.r(0.4, 0.9);
      c.beginPath(); c.moveTo(x, yy); c.lineTo(x + l, yy + R.r(-0.3, 0.3)); c.stroke();
    }
    c.restore();
    // its surface: a still, bright line
    c.strokeStyle = 'rgba(196,224,222,0.55)'; c.lineWidth = 1.1;
    c.beginPath(); for (let x = -4; x <= W + 4; x += 6) { const yy = sc.by(4, x) + 0.15 * L; if (x < 0) c.moveTo(x, yy); else c.lineTo(x, yy); } c.stroke();
    // droplets hanging from grains just above
    for (let i = 0; i < W / (L * 3); i++) {
      const x = R.r(0, W), yy = sc.by(4, x) - R.r(0.4, 2.2) * L;
      c.fillStyle = rgba(hex('#bfd8d6'), 0.75); c.beginPath(); c.ellipse(x, yy, 0.09 * L, 0.13 * L, 0, 0, TAU); c.fill();
      c.fillStyle = rgba(LT, 0.9); c.beginPath(); c.arc(x - 0.03 * L, yy - 0.04 * L, 0.03 * L, 0, TAU); c.fill();
    }
    // limestone bedrock: long irregular beds, joints, pits, shell litter
    clipPoly(() => bandPath(5, 6));
    let y = sc.yf(fr.b5) - 1.5 * L;
    const beds = [];
    while (y < H + 5 * L) { beds.push(y); y += R.r(2.2, 5.2) * L; }
    const nbs = beds.map(() => fbm1(R, R.r(12, 30) * L, 3));
    const bedY = (i, x) => beds[i] + nbs[i](x) * 0.7 * L;
    for (let i = 0; i < beds.length - 1; i++) {
      const col = jit(R.pick([hex('#5a5f64'), hex('#4f5459'), hex('#63666a'), hex('#5f5b55'), hex('#545a5c')]), R, 5);
      c.beginPath(); c.moveTo(-10, bedY(i, -10));
      for (let x = -10; x <= W + 10; x += 8) c.lineTo(x, bedY(i, x));
      for (let x = W + 10; x >= -10; x -= 8) c.lineTo(x, bedY(i + 1, x));
      c.closePath();
      c.fillStyle = rgba(col); c.fill();
      c.save(); c.clip();
      // dry-brush scumble along the bed
      for (let k = 0; k < W / L * 2.2; k++) {
        const x = R.r(-L, W), yy = R.r(beds[i], beds[i + 1]), l = R.r(0.6, 3) * L;
        c.strokeStyle = rgba(shade(col, R.r(-0.25, 0.2)), R.r(0.15, 0.4)); c.lineWidth = R.r(0.5, 2.2);
        c.beginPath(); c.moveTo(x, yy); c.lineTo(x + l, yy + R.r(-0.15, 0.15) * L); c.stroke();
      }
      // pits and pores
      for (let k = 0; k < W / L * 0.8; k++) {
        const x = R.r(0, W), yy = R.r(beds[i], beds[i + 1]), r = R.r(0.05, 0.16) * L;
        c.fillStyle = rgba(hex('#24272a'), 0.7); c.beginPath(); c.arc(x, yy, r, 0, TAU); c.fill();
        c.fillStyle = rgba(shade(col, 0.35), 0.5); c.beginPath(); c.arc(x + r * 0.3, yy + r * 0.5, r * 0.6, 0, Math.PI); c.fill();
      }
      // shell litter
      for (let k = 0; k < W / L * 0.18; k++) {
        const x = R.r(0, W), yy = R.r(beds[i] + 0.4 * L, beds[i + 1] - 0.3 * L);
        c.fillStyle = rgba(hex('#cbc3ae'), R.r(0.45, 0.75));
        c.beginPath(); c.arc(x, yy, R.r(0.15, 0.45) * L, Math.PI + 0.15, TAU - 0.15); c.fill();
        c.strokeStyle = rgba(hex('#8a8270'), 0.5); c.lineWidth = 0.4; c.stroke();
      }
      c.fillStyle = rgba(LT, 0.12); c.beginPath(); for (let x = -10; x <= W + 10; x += 8) { const yy = bedY(i, x) + 0.25 * L; if (x < 0) c.moveTo(x, yy); else c.lineTo(x, yy); } for (let x = W + 10; x >= -10; x -= 8) c.lineTo(x, bedY(i, x) + 0.05 * L); c.fill();
      c.restore();
      // joints: vertical cracks that wander and taper
      for (let x = R.r(0, 14) * L; x < W; x += R.r(7, 22) * L) {
        let px = x, py = bedY(i, x);
        const y2 = bedY(i + 1, x);
        c.strokeStyle = rgba(hex('#1d2023'), 0.85); c.lineWidth = R.r(0.8, 1.8);
        c.beginPath(); c.moveTo(px, py);
        while (py < y2) { py += R.r(0.3, 0.7) * L; px += R.r(-0.25, 0.25) * L; c.lineTo(px, Math.min(py, y2)); }
        c.stroke();
      }
      // the bedding plane: dark seam
      c.strokeStyle = rgba(hex('#1b1e21'), 0.9); c.lineWidth = R.r(1, 2.2);
      c.beginPath(); for (let x = -10; x <= W + 10; x += 8) { const yy = bedY(i, x); if (x < 0) c.moveTo(x, yy); else c.lineTo(x, yy); } c.stroke();
    }
    c.restore();
    // depth darkening
    const g = c.createLinearGradient(0, sc.yf(fr.b2), 0, H);
    g.addColorStop(0, 'rgba(10,6,4,0)'); g.addColorStop(1, 'rgba(10,6,4,0.36)');
    c.fillStyle = g; c.fillRect(0, sc.yf(fr.b2), W, H);
  }

  function paintBoundaries(c, sc, R) {
    const { W, L } = sc;
    // soft transitions & crisp accents along strata boundaries
    for (let k = 1; k <= 5; k++) {
      c.strokeStyle = rgba(DK, k === 2 || k === 3 ? 0.4 : 0.25); c.lineWidth = 0.8;
      c.beginPath(); for (let x = -4; x <= W + 4; x += 5) { const y = sc.by(k, x); if (x < 0) c.moveTo(x, y); else c.lineTo(x, y); } c.stroke();
    }
    // humus tongues reaching into the clay
    for (let i = 0; i < W / (L * 7); i++) {
      const x = R.r(0, W), y = sc.by(1, x);
      c.fillStyle = rgba(P.humus, R.r(0.5, 0.85));
      c.beginPath(); blob(c, R, x, y + R.r(0.5, 1.5) * L, R.r(0.4, 1.1) * L, R.r(1, 2.6) * L, R.r(-0.2, 0.2), 0.3, 9); c.fill();
    }
    // krotovina: an old burrow backfilled with dark soil
    const kx = R.r(0.1, 0.9) * W, ky = sc.yf(sc.fr.b1 + R.r(0.05, 0.12));
    c.fillStyle = rgba(hex('#3b2a1d'), 0.85);
    c.beginPath(); blob(c, R, kx, ky, 1.8 * L, 1.3 * L, R.r(0, 1), 0.2, 10); c.fill();
    crumbField(c, sc, R, kx - 1.5 * L, kx + 1.5 * L, ky - L, ky + L, 1.5, [hex('#57412e'), hex('#2a1e16')], [0.06, 0.12], 0.3);
  }

  function rootPath(c, R, pts, wf, col, opt) {
    opt = opt || {};
    c.fillStyle = rgba(shade(col, -0.45), 0.8);
    c.beginPath(); taper(c, pts.map((p) => [p[0] + 0.6, p[1] + 0.8]), (t) => wf(t) * 1.08); c.fill();
    c.fillStyle = rgba(col);
    c.beginPath(); taper(c, pts, wf); c.fill();
    // highlight side
    c.fillStyle = rgba(shade(col, 0.3), 0.6);
    c.beginPath(); taper(c, pts.map((p, i) => { const w = wf(i / (pts.length - 1)); return [p[0] - w * 0.18, p[1] - w * 0.2]; }), (t) => wf(t) * 0.35); c.fill();
  }

  function paintFineRoots(c, sc, R) {
    const { W, L, fr } = sc;
    const yb = sc.yf(fr.b1);
    // grass roots: a fibrous mat thinning with depth
    c.lineCap = 'round';
    for (let x = -4; x < W + 4; x += R.r(2.5, 8)) {
      if (x < sc.xb && R.chance(0.5)) continue;
      const len = R.r(0.25, 1.0) * (yb - sc.top) * (R.chance(0.15) ? 1.6 : 1);
      let px = x, py = sc.cutY(x) + R.r(-0.2, 0.6) * L; let a = Math.PI / 2 + R.r(-0.5, 0.5);
      const pts = [[px, py]];
      for (let s = 0; s < len; s += 0.5 * L) { a += R.r(-0.3, 0.3); a = lerp(a, Math.PI / 2, 0.1); px += Math.cos(a) * 0.5 * L; py += Math.sin(a) * 0.5 * L; pts.push([px, py]); }
      const col = jit(R.pick([hex('#a8906a'), hex('#c4ae84'), hex('#8a7252'), hex('#d0c098')]), R, 10);
      const w = R.r(0.04, 0.11) * L;
      c.strokeStyle = rgba(col, R.r(0.35, 0.7)); c.lineWidth = w;
      c.beginPath(); openSmooth(c, pts); c.stroke();
      // root hairs
      c.lineWidth = 0.35; c.strokeStyle = rgba(col, 0.35);
      c.beginPath();
      for (let i = 2; i < pts.length; i += 1) { if (R.chance(0.5)) continue; const p = pts[i]; const b = R.r(0, TAU); c.moveTo(p[0], p[1]); c.lineTo(p[0] + Math.cos(b) * 0.25 * L, p[1] + Math.sin(b) * 0.25 * L); }
      c.stroke();
    }
    // a few deeper roots into the clay
    for (let i = 0; i < W / (L * 12); i++) {
      let px = R.r(0, W), py = sc.yf(fr.b1 * R.r(0.5, 0.9)); let a = Math.PI / 2;
      const pts = [[px, py]];
      for (let s = 0; s < R.r(6, 16) * L; s += 0.6 * L) { a += R.r(-0.35, 0.35); a = lerp(a, Math.PI / 2, 0.15); px += Math.cos(a) * 0.6 * L; py += Math.sin(a) * 0.6 * L; pts.push([px, py]); }
      c.strokeStyle = rgba(hex('#c4ad86'), 0.6); c.lineWidth = R.r(0.08, 0.16) * L;
      c.beginPath(); openSmooth(c, pts); c.stroke();
    }
  }

  function paintOak(c, sc, R) {
    const { L } = sc;
    const col = hex('#5b3c26');
    rootPath(c, R, sc.sinker, sc.sinkerW, hex('#6a4630'));
    // root hairs drinking at the bottom
    const se = sc.sinker[sc.sinker.length - 1];
    c.strokeStyle = rgba(hex('#c8b08a'), 0.55); c.lineWidth = 0.45;
    for (let k = 0; k < 40; k++) { let px = se[0] + R.r(-0.8, 0.8) * L, py = se[1] - R.r(0, 3) * L; c.beginPath(); c.moveTo(px, py); for (let j = 0; j < 4; j++) { px += R.r(-0.5, 0.5) * L; py += R.r(0, 0.4) * L; c.lineTo(px, py); } c.stroke(); }
    for (let i = 5; i < sc.sinker.length - 3; i += R.i(3, 6)) {
      const p = sc.sinker[i]; let a = Math.PI / 2 + R.s() * R.r(0.6, 1.2), px = p[0], py = p[1];
      const pts = [[px, py]]; for (let k = 0; k < R.i(3, 7); k++) { a += R.r(-0.3, 0.3); px += Math.cos(a) * 0.5 * L; py += Math.sin(a) * 0.5 * L; pts.push([px, py]); }
      c.strokeStyle = rgba(hex('#7a5a3a'), 0.85); c.lineWidth = 0.12 * L; c.beginPath(); openSmooth(c, pts); c.stroke();
    }
    rootPath(c, R, sc.oak, sc.oakW, col);
    // bark: furrows along the root
    c.save(); c.beginPath(); taper(c, sc.oak, sc.oakW); c.clip();
    for (let k = 0; k < 9; k++) {
      const off = R.r(-0.45, 0.45);
      c.strokeStyle = rgba(k % 2 ? hex('#2e1e13') : hex('#8a6446'), R.r(0.3, 0.6)); c.lineWidth = R.r(0.5, 1.4);
      c.beginPath();
      sc.oak.forEach((p, i) => { const w = sc.oakW(i / (sc.oak.length - 1)); const y = p[1] + off * w + Math.sin(i * 0.9 + k) * 0.08 * L; if (i === 0) c.moveTo(p[0], y); else c.lineTo(p[0], y); });
      c.stroke();
    }
    for (let i = 0; i < sc.oak.length; i += 2) { const p = sc.oak[i], w = sc.oakW(i / (sc.oak.length - 1)); c.fillStyle = rgba(hex('#2a1a10'), 0.5); c.fillRect(p[0], p[1] + R.r(-0.4, 0.4) * w, R.r(0.1, 0.4) * L, 0.6); }
    c.restore();
    // branching fine rootlets with fungal threads
    for (let i = 4; i < sc.oak.length; i += 3) {
      const p = sc.oak[i], w = sc.oakW(i / (sc.oak.length - 1));
      let a = Math.PI / 2 + R.r(-0.8, 0.8) + (R.chance(0.3) ? Math.PI : 0); let px = p[0], py = p[1] + Math.sin(a) * w * 0.4;
      const pts = [[px, py]];
      for (let s = 0; s < R.r(2, 6) * L; s += 0.5 * L) { a += R.r(-0.3, 0.3); px += Math.cos(a) * 0.5 * L; py += Math.sin(a) * 0.5 * L; pts.push([px, py]); }
      rootPath(c, R, pts, (t) => lerp(0.3 * L, 0.05 * L, t), hex('#6e4a30'));
    }
    const end = sc.oak[sc.oak.length - 1];
    c.strokeStyle = rgba(hex('#f0ead8'), 0.4); c.lineWidth = 0.4;
    for (let k = 0; k < 30; k++) {
      let px = end[0] + R.r(-1, 1) * L, py = end[1] + R.r(-1, 1) * L;
      c.beginPath(); c.moveTo(px, py);
      for (let j = 0; j < 5; j++) { px += R.r(-0.5, 0.5) * L; py += R.r(-0.4, 0.4) * L; c.lineTo(px, py); }
      c.stroke();
    }
    // the cut face at the slab's edge: growth rings
    const p0 = sc.oak[2], w0 = sc.oakW(2 / sc.oak.length);
    c.fillStyle = rgba(hex('#c9a77a'));
    c.beginPath(); c.ellipse(Math.max(p0[0], w0 * 0.25), p0[1], w0 * 0.22, w0 * 0.5, 0, 0, TAU); c.fill();
    c.strokeStyle = rgba(hex('#7a5638'), 0.6); c.lineWidth = 0.6;
    for (let k = 1; k < 6; k++) { c.beginPath(); c.ellipse(Math.max(p0[0], w0 * 0.25), p0[1] + k * 0.02 * L, w0 * 0.22 * k / 6, w0 * 0.5 * k / 6, 0, 0, TAU); c.stroke(); }
  }

  function paintTaproot(c, sc, R) {
    const { L } = sc;
    const col = hex('#d2b98a');
    rootPath(c, R, sc.taproot, sc.taprootW, col);
    c.save(); c.beginPath(); taper(c, sc.taproot, sc.taprootW); c.clip();
    // transverse wrinkles
    c.strokeStyle = rgba(hex('#8a7048'), 0.55); c.lineWidth = 0.6;
    for (let i = 1; i < sc.taproot.length - 1; i += R.i(1, 2)) {
      const p = sc.taproot[i], w = sc.taprootW(i / (sc.taproot.length - 1));
      c.beginPath(); c.moveTo(p[0] - w * 0.5, p[1] + R.r(-0.1, 0.1) * L); c.quadraticCurveTo(p[0], p[1] + R.r(0.1, 0.25) * L, p[0] + w * 0.5, p[1] + R.r(-0.1, 0.1) * L); c.stroke();
    }
    // pale core
    c.strokeStyle = rgba(hex('#f1e6c4'), 0.5); c.lineWidth = 0.18 * L;
    c.beginPath(); openSmooth(c, sc.taproot.slice(2, Math.floor(sc.taproot.length * 0.7))); c.stroke();
    c.restore();
    // lateral rootlets
    for (let i = 6; i < sc.taproot.length; i += R.i(3, 6)) {
      const p = sc.taproot[i], s = R.s();
      let a = Math.PI / 2 - s * R.r(0.8, 1.3), px = p[0], py = p[1];
      const pts = [[px, py]];
      for (let k = 0; k < R.i(4, 9); k++) { a += R.r(-0.2, 0.3) * s; px += Math.cos(a) * 0.5 * L; py += Math.sin(a) * 0.5 * L; pts.push([px, py]); }
      c.strokeStyle = rgba(hex('#d8c294'), 0.8); c.lineWidth = 0.08 * L; c.beginPath(); openSmooth(c, pts); c.stroke();
    }
  }

  function paintMole(c, sc, R) {
    const { L } = sc;
    const m = sc.mole, pts = m.pts;
    // tunnel: dark, smooth-walled
    c.lineCap = 'round'; c.lineJoin = 'round';
    c.strokeStyle = rgba(hex('#1a110b'), 0.6); c.lineWidth = m.r * 2 + 0.8 * L; c.beginPath(); openSmooth(c, pts); c.stroke();
    c.strokeStyle = rgba(hex('#6b4a32')); c.lineWidth = m.r * 2; c.beginPath(); openSmooth(c, pts); c.stroke();
    c.strokeStyle = rgba(hex('#8d6a4c')); c.lineWidth = m.r * 1.3; c.beginPath(); openSmooth(c, pts.map((p) => [p[0], p[1] + m.r * 0.3])); c.stroke();
    // loose soil on the tunnel floor
    for (let i = 0; i < 60; i++) {
      const p = R.pick(pts); c.fillStyle = rgba(jit(hex('#4a3424'), R, 15), 0.9);
      c.beginPath(); poly(c, R, p[0] + R.r(-0.5, 0.5) * L, p[1] + m.r * R.r(0.7, 0.95), R.r(0.08, 0.2) * L, 5, 0.4); c.fill();
    }
    // the mole: velvet body heading left, snout and spade hands
    const hd = pts[pts.length - 1], h2 = pts[pts.length - 4];
    const ang = Math.atan2(hd[1] - h2[1], hd[0] - h2[0]);
    c.save();
    c.beginPath(); taper(c, pts.concat([[hd[0] - 4 * L, hd[1]]]), () => m.r * 2.05); c.clip();
    c.translate(hd[0] + 2.0 * L, hd[1] + 0.3 * L); c.rotate(ang + Math.PI);
    c.scale(L * 0.85, L * 0.8);
    const body = new Path2D();
    body.moveTo(-1.5, -0.7);
    body.bezierCurveTo(-0.8, -1.3, 1.2, -1.55, 3.0, -1.4);
    body.bezierCurveTo(5.0, -1.3, 7.0, -1.25, 30.0, -1.2);
    body.lineTo(30.0, 1.25);
    body.bezierCurveTo(6.0, 1.35, 2.0, 1.4, 0.2, 1.1);
    body.bezierCurveTo(-1.0, 0.95, -1.9, 0.5, -2.0, 0.0);
    body.bezierCurveTo(-2.0, -0.35, -1.8, -0.55, -1.5, -0.7);
    body.closePath();
    c.fillStyle = rgba(hex('#353034')); c.fill(body);
    c.save(); c.clip(body);
    // velvet: short strokes laid back along the body, catching light on the shoulders
    for (let i = 0; i < 900; i++) {
      const x = R.r(-2, 16), y = R.r(-1.5, 1.4);
      const top = y < -0.4;
      c.strokeStyle = rgba(top ? hex('#86808a') : y > 0.6 ? hex('#18151a') : hex('#4a444c'), R.r(0.25, 0.6)); c.lineWidth = 0.035;
      c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + 0.15, y - 0.03, x + 0.3, y + R.r(-0.04, 0.04)); c.stroke();
    }
    c.fillStyle = 'rgba(170,168,184,0.2)'; c.beginPath(); c.ellipse(4, -0.95, 6, 0.3, -0.01, 0, TAU); c.fill();
    c.restore();
    // snout
    c.fillStyle = rgba(hex('#eaa89a'));
    c.beginPath(); c.moveTo(-1.7, -0.45); c.quadraticCurveTo(-2.9, -0.35, -3.45, -0.02); c.quadraticCurveTo(-3.0, 0.32, -1.8, 0.35); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(120,60,54,0.8)'; c.lineWidth = 0.05; c.stroke();
    c.strokeStyle = 'rgba(150,90,84,0.6)'; c.lineWidth = 0.03;
    for (let k = 0; k < 6; k++) { const x = -2.0 - k * 0.15; c.beginPath(); c.moveTo(x, -0.3 + k * 0.03); c.lineTo(x - 0.02, -0.18 + k * 0.025); c.stroke(); }
    c.fillStyle = rgba(hex('#f4c8bc'), 0.75); c.beginPath(); c.ellipse(-2.4, -0.16, 0.38, 0.06, 0.05, 0, TAU); c.fill();
    c.fillStyle = rgba(hex('#5a2a28')); c.beginPath(); c.ellipse(-3.38, -0.02, 0.06, 0.09, 0, 0, TAU); c.fill();
    c.strokeStyle = 'rgba(240,232,220,0.65)'; c.lineWidth = 0.025;
    for (let k = 0; k < 9; k++) { c.beginPath(); c.moveTo(-2.7, R.r(-0.1, 0.12)); c.quadraticCurveTo(-3.1, R.r(-0.5, 0.5), -3.1 - R.r(0.2, 0.8), R.r(-0.8, 0.8)); c.stroke(); }
    // a bead of an eye, lost in the fur
    c.fillStyle = '#060608'; c.beginPath(); c.arc(-1.25, -0.42, 0.06, 0, TAU); c.fill();
    c.fillStyle = 'rgba(255,255,255,0.7)'; c.beginPath(); c.arc(-1.27, -0.44, 0.02, 0, TAU); c.fill();
    // the great spade of a hand, palm outward
    c.save(); c.translate(-1.9, 0.62); c.rotate(-0.55); c.scale(1.5, 1.5);
    c.fillStyle = rgba(hex('#f2b4a4')); c.beginPath(); c.ellipse(0, 0, 0.72, 0.5, 0, 0, TAU); c.fill();
    c.strokeStyle = rgba(hex('#8a4e46'), 0.9); c.lineWidth = 0.04; c.stroke();
    c.strokeStyle = rgba(hex('#f6eee2')); c.lineWidth = 0.09; c.lineCap = 'round';
    for (let k = 0; k < 5; k++) { const a = -2.0 + k * 0.32; c.beginPath(); c.moveTo(Math.cos(a) * 0.62, Math.sin(a) * 0.42); c.lineTo(Math.cos(a) * 1.0, Math.sin(a) * 0.7); c.stroke(); }
    c.strokeStyle = 'rgba(160,100,90,0.5)'; c.lineWidth = 0.025;
    for (let k = 0; k < 4; k++) { c.beginPath(); c.moveTo(-0.3 + k * 0.15, -0.25); c.lineTo(-0.2 + k * 0.12, 0.25); c.stroke(); }
    c.restore();
    // a crumb of soil caught on a claw
    c.fillStyle = rgba(hex('#5a3a24')); c.beginPath(); c.arc(-2.45, 0.2, 0.12, 0, TAU); c.fill();
    c.restore();
  }

  /* --- buried things and neighbours */
  function paintItems(c, sc, R) {
    const { L } = sc;
    for (const it of sc.items) {
      c.save(); c.translate(it.x, it.y);
      // every buried thing sits in its own little cavity / imprint
      const f = DRAW[it.name];
      if (f) f(c, R, it, L, sc);
      c.restore();
    }
  }

  const DRAW = {
    worm(c, R, it, L) {
      // its burrow
      const pts = []; const n = 22; const ph = R.r(0, TAU), amp = R.r(1.2, 2) * L, len = 9 * L;
      for (let i = 0; i <= n; i++) { const t = i / n; pts.push([(t - 0.5) * len * it.flip, Math.sin(t * 5 + ph) * amp * (0.6 + t * 0.4) + (t - 0.5) * 2 * L]); }
      c.lineCap = 'round'; c.lineJoin = 'round';
      c.strokeStyle = rgba(hex('#140d09'), 0.75); c.lineWidth = 1.05 * L; c.beginPath(); openSmooth(c, pts); c.stroke();
      c.strokeStyle = rgba(hex('#4b3526')); c.lineWidth = 0.8 * L; c.beginPath(); openSmooth(c, pts); c.stroke();
      const wf = (t) => L * 0.62 * (t < 0.1 ? 0.55 + t * 4.5 : t > 0.85 ? 1 - (t - 0.85) * 3 : 1);
      const body = pts.slice(1, n);
      c.fillStyle = rgba(hex('#a2565a')); c.beginPath(); taper(c, body, wf); c.fill();
      c.save(); c.beginPath(); taper(c, body, wf); c.clip();
      // segments
      const rs = resample(body, 0.16 * L);
      c.strokeStyle = rgba(hex('#6a2e36'), 0.55); c.lineWidth = 0.5;
      for (let i = 1; i < rs.length - 1; i++) {
        const a = rs[i - 1], b = rs[i + 1]; let tx = b[0] - a[0], ty = b[1] - a[1]; const d = Math.hypot(tx, ty) || 1; tx /= d; ty /= d;
        c.beginPath(); c.moveTo(rs[i][0] - ty * L * 0.35, rs[i][1] + tx * L * 0.35); c.lineTo(rs[i][0] + ty * L * 0.35, rs[i][1] - tx * L * 0.35); c.stroke();
      }
      // clitellum
      const ci = Math.floor(rs.length * 0.3);
      c.strokeStyle = rgba(hex('#d07a62'), 0.9); c.lineWidth = 0.75 * L; c.beginPath(); openSmooth(c, rs.slice(ci, ci + 8)); c.stroke();
      // sheen
      c.strokeStyle = rgba(hex('#f4d4cc'), 0.55); c.lineWidth = 0.12 * L; c.beginPath(); openSmooth(c, body.map((p) => [p[0] - 0.08 * L, p[1] - 0.17 * L])); c.stroke();
      c.restore();
      it.anchor = [body[Math.floor(n * 0.5)][0], body[Math.floor(n * 0.5)][1]];
    },
    grub(c, R, it, L) {
      c.fillStyle = rgba(hex('#1d140e'), 0.8); c.beginPath(); c.ellipse(0, 0, 2.3 * L, 1.75 * L, 0, 0, TAU); c.fill();
      c.fillStyle = rgba(hex('#5a4230')); c.beginPath(); c.ellipse(0, 0.1 * L, 2.1 * L, 1.55 * L, 0, 0, TAU); c.fill();
      c.scale(it.flip, 1);
      // C-shaped body
      const pts = []; for (let i = 0; i <= 14; i++) { const a = -2.2 + i / 14 * 3.6; pts.push([Math.cos(a) * 1.05 * L, Math.sin(a) * 0.95 * L]); }
      const wf = (t) => L * (0.55 + 0.45 * Math.sin(t * Math.PI * 0.9 + 0.2)) * (t > 0.85 ? 1.1 : 1);
      c.fillStyle = rgba(hex('#ece2c8')); c.beginPath(); taper(c, pts, wf); c.fill();
      // rear end: dark gut showing through
      c.fillStyle = rgba(hex('#7c8088'), 0.6); c.beginPath(); c.ellipse(pts[2][0], pts[2][1], 0.42 * L, 0.38 * L, 0, 0, TAU); c.fill();
      c.strokeStyle = rgba(hex('#b9a984'), 0.8); c.lineWidth = 0.6;
      for (let i = 2; i < 14; i++) { const p = pts[i]; const a = Math.atan2(p[1], p[0]); const w = wf(i / 14) * 0.5; c.beginPath(); c.moveTo(p[0] - Math.cos(a) * w, p[1] - Math.sin(a) * w); c.lineTo(p[0] + Math.cos(a) * w, p[1] + Math.sin(a) * w); c.stroke(); }
      c.fillStyle = rgba(LT, 0.5); c.beginPath(); c.ellipse(0.2 * L, -1.1 * L, 0.5 * L, 0.1 * L, 0.2, 0, TAU); c.fill();
      // head capsule & legs
      const hp = pts[14];
      c.fillStyle = rgba(hex('#b5682a')); c.beginPath(); c.ellipse(hp[0] - 0.2 * L, hp[1] + 0.1 * L, 0.45 * L, 0.38 * L, 0.4, 0, TAU); c.fill();
      c.fillStyle = rgba(hex('#3a1c0c')); c.beginPath(); c.ellipse(hp[0] - 0.55 * L, hp[1] + 0.2 * L, 0.12 * L, 0.1 * L, 0, 0, TAU); c.fill();
      c.strokeStyle = rgba(hex('#9a5a28')); c.lineWidth = 0.09 * L; c.lineCap = 'round';
      for (let k = 0; k < 3; k++) { const p = pts[11 - k * 1]; c.beginPath(); c.moveTo(p[0] * 0.7, p[1] * 0.7); c.lineTo(p[0] * 0.35 + R.r(-0.1, 0.1) * L, p[1] * 0.35 + 0.15 * L); c.stroke(); }
      it.anchor = [0, 0];
    },
    toad(c, R, it, L) {
      // a snug pocket in the clay, smoothed by a turning body; lit a little so the toad stands clear
      c.fillStyle = rgba(hex('#1a100a'), 0.9); c.beginPath(); blob(c, R, 0, 0.1 * L, 4.5 * L, 2.95 * L, 0, 0.04, 12); c.fill();
      c.fillStyle = rgba(hex('#6e4a32')); c.beginPath(); blob(c, R, 0, 0.25 * L, 4.25 * L, 2.7 * L, 0, 0.03, 12); c.fill();
      c.fillStyle = rgba(hex('#8a6244'), 0.6); c.beginPath(); c.ellipse(-0.4 * L, -0.6 * L, 3.2 * L, 1.6 * L, 0, 0, TAU); c.fill();
      c.fillStyle = rgba(hex('#4a2e1e'), 0.8); c.beginPath(); c.ellipse(0, 2.25 * L, 3.8 * L, 0.45 * L, 0, 0, TAU); c.fill();
      c.scale(it.flip, 1);
      c.scale(L, L);
      const sk = hex('#a07c4a'), skD = hex('#5e4424'), belly = hex('#e2cf9a'), ink = hex('#2a1a0c');
      // squat body, side-on, facing right: low rump, high shoulders, blunt head
      const body = new Path2D();
      body.moveTo(-3.1, 1.95);
      body.bezierCurveTo(-3.75, 1.3, -3.7, 0.2, -3.0, -0.35);
      body.bezierCurveTo(-2.3, -1.0, -1.0, -1.45, 0.4, -1.5);
      body.bezierCurveTo(1.2, -1.55, 1.8, -1.7, 2.3, -1.45);
      body.bezierCurveTo(2.9, -1.15, 3.3, -0.6, 3.45, 0.05);
      body.bezierCurveTo(3.5, 0.45, 3.2, 0.7, 2.7, 0.75);
      body.bezierCurveTo(2.2, 0.85, 1.8, 0.9, 1.6, 1.2);
      body.lineTo(1.5, 1.95);
      body.closePath();
      // hind leg behind the body first (far side)
      c.fillStyle = rgba(shade(sk, -0.3)); c.beginPath(); c.ellipse(-1.6, 1.55, 1.1, 0.45, -0.1, 0, TAU); c.fill();
      c.fillStyle = rgba(sk); c.fill(body);
      c.save(); c.clip(body);
      // blotched back: big dark patches with paler rims
      for (let i = 0; i < 9; i++) {
        const x = R.r(-2.8, 2.0), y = R.r(-1.4, 0.0), rx = R.r(0.3, 0.6), ry = R.r(0.18, 0.32);
        c.fillStyle = rgba(skD, 0.75); c.beginPath(); blob(c, R, x, y, rx, ry, R.r(-0.5, 0.5), 0.25, 8); c.fill();
      }
      // pale belly
      c.fillStyle = rgba(belly); c.beginPath(); c.ellipse(0.3, 1.95, 3.4, 0.85, 0, 0, TAU); c.fill();
      c.strokeStyle = rgba(hex('#c0a46a'), 0.7); c.lineWidth = 0.05;
      for (let k = 0; k < 9; k++) { c.beginPath(); c.arc(-2 + k * 0.45, 1.6, 0.06, 0, TAU); c.stroke(); }
      // warts: raised, each with a dark side and a lit side
      for (let i = 0; i < 70; i++) {
        const x = R.r(-3.2, 2.6), y = R.r(-1.6, 0.9), r = R.r(0.07, 0.17);
        c.fillStyle = rgba(hex('#6a4c26'), 0.85); c.beginPath(); c.arc(x + r * 0.25, y + r * 0.3, r, 0, TAU); c.fill();
        c.fillStyle = rgba(hex('#c09a60'), 0.95); c.beginPath(); c.arc(x, y, r * 0.8, 0, TAU); c.fill();
        c.fillStyle = rgba(LT, 0.5); c.beginPath(); c.arc(x - r * 0.25, y - r * 0.3, r * 0.3, 0, TAU); c.fill();
      }
      c.fillStyle = rgba(LT, 0.25); c.beginPath(); c.ellipse(-0.4, -1.25, 2.0, 0.18, -0.08, 0, TAU); c.fill();
      c.restore();
      c.strokeStyle = rgba(ink, 0.85); c.lineWidth = 0.07; c.stroke(body);
      // near hind leg folded against the flank: thigh, shin, long toes
      c.fillStyle = rgba(shade(sk, -0.05));
      c.beginPath(); c.ellipse(-1.75, 0.85, 1.25, 0.75, -0.3, 0, TAU); c.fill();
      c.strokeStyle = rgba(ink, 0.7); c.lineWidth = 0.06; c.stroke();
      c.fillStyle = rgba(skD, 0.55); c.beginPath(); c.ellipse(-1.9, 0.75, 0.55, 0.25, -0.3, 0, TAU); c.fill();
      c.fillStyle = rgba(shade(sk, -0.12)); c.beginPath(); c.ellipse(-0.75, 1.72, 1.15, 0.27, 0.02, 0, TAU); c.fill(); c.stroke();
      c.strokeStyle = rgba(hex('#7a5a30')); c.lineWidth = 0.12; c.lineCap = 'round';
      for (let k = 0; k < 4; k++) { c.beginPath(); c.moveTo(0.2, 1.85); c.lineTo(0.55 + k * 0.12, 1.95 - k * 0.02); c.stroke(); }
      // front leg: upper arm down, the foot tucked under the chin
      c.fillStyle = rgba(shade(sk, -0.08));
      c.beginPath(); c.moveTo(1.35, 0.55); c.quadraticCurveTo(1.95, 0.9, 1.9, 1.6); c.lineTo(1.5, 1.7); c.quadraticCurveTo(1.45, 1.1, 1.05, 0.85); c.closePath(); c.fill();
      c.strokeStyle = rgba(ink, 0.7); c.lineWidth = 0.06; c.stroke();
      c.fillStyle = rgba(hex('#c8a46a'));
      c.beginPath(); c.ellipse(1.75, 1.82, 0.5, 0.16, 0, 0, TAU); c.fill(); c.stroke();
      c.strokeStyle = rgba(ink, 0.6); c.lineWidth = 0.04;
      for (let k = 0; k < 3; k++) { c.beginPath(); c.moveTo(1.45 + k * 0.25, 1.72); c.lineTo(1.5 + k * 0.28, 1.95); c.stroke(); }
      // parotoid gland
      c.fillStyle = rgba(hex('#b48a52')); c.beginPath(); c.ellipse(1.05, -1.3, 0.75, 0.26, -0.12, 0, TAU); c.fill();
      c.strokeStyle = rgba(ink, 0.45); c.lineWidth = 0.04; c.stroke();
      for (let k = 0; k < 6; k++) { c.fillStyle = rgba(skD, 0.7); c.beginPath(); c.arc(0.6 + k * 0.17, -1.3 + R.r(-0.06, 0.06), 0.045, 0, TAU); c.fill(); }
      // the eye: a raised dome, lid shut, a thread of gold round the lid
      c.fillStyle = rgba(hex('#b08a54')); c.beginPath(); c.ellipse(2.25, -1.2, 0.55, 0.42, -0.15, Math.PI, TAU); c.lineTo(2.8, -1.15); c.fill();
      c.strokeStyle = rgba(hex('#e8b830')); c.lineWidth = 0.07;
      c.beginPath(); c.ellipse(2.25, -1.17, 0.47, 0.34, -0.15, Math.PI * 1.02, Math.PI * 1.98); c.stroke();
      c.strokeStyle = rgba(ink); c.lineWidth = 0.1;
      c.beginPath(); c.moveTo(1.78, -1.12); c.quadraticCurveTo(2.25, -0.98, 2.72, -1.17); c.stroke();
      c.strokeStyle = rgba(ink, 0.5); c.lineWidth = 0.04;
      for (let k = 0; k < 4; k++) { c.beginPath(); c.moveTo(1.95 + k * 0.17, -1.07 + Math.abs(k - 1.5) * 0.02); c.lineTo(1.93 + k * 0.17, -0.97); c.stroke(); }
      // nostril, and a long contented mouth
      c.fillStyle = rgba(ink); c.beginPath(); c.arc(3.15, -0.45, 0.06, 0, TAU); c.fill();
      c.strokeStyle = rgba(ink, 0.9); c.lineWidth = 0.07;
      c.beginPath(); c.moveTo(3.42, 0.2); c.quadraticCurveTo(2.8, 0.5, 1.95, 0.0); c.stroke();
      // a Zzz in pencil, very faint
      c.strokeStyle = rgba(hex('#e8dcc0'), 0.55); c.lineWidth = 0.05;
      const zz = (x, y, s) => { c.beginPath(); c.moveTo(x, y); c.lineTo(x + s, y); c.lineTo(x, y + s); c.lineTo(x + s, y + s); c.stroke(); };
      zz(3.0, -2.0, 0.3); zz(3.45, -2.45, 0.22);
      it.anchor = [0, -1.0 * L];
    },
    mammoth(c, R, it, L) {
      // a horseshoe, cast by a carthorse ploughing this field, rusted to the colour of the clay
      c.rotate(it.rot * 0.6 + 0.4);
      c.fillStyle = rgba(hex('#1a0f08'), 0.55); c.beginPath(); c.ellipse(0.15 * L, 0.2 * L, 2.4 * L, 2.2 * L, 0, 0, TAU); c.fill();
      const shoe = new Path2D();
      shoe.moveTo(-1.6 * L, 1.7 * L);
      shoe.bezierCurveTo(-2.3 * L, 0.2 * L, -1.9 * L, -1.95 * L, 0, -1.95 * L);
      shoe.bezierCurveTo(1.9 * L, -1.95 * L, 2.3 * L, 0.2 * L, 1.6 * L, 1.7 * L);
      shoe.lineTo(0.85 * L, 1.75 * L);
      shoe.bezierCurveTo(1.35 * L, 0.3 * L, 1.1 * L, -1.15 * L, 0, -1.15 * L);
      shoe.bezierCurveTo(-1.1 * L, -1.15 * L, -1.35 * L, 0.3 * L, -0.85 * L, 1.75 * L);
      shoe.closePath();
      c.fillStyle = rgba(hex('#7a3e1c')); c.fill(shoe);
      c.save(); c.clip(shoe);
      for (let k = 0; k < 40; k++) { c.fillStyle = rgba(R.pick([hex('#a85a26'), hex('#4a2410'), hex('#c07a3a'), hex('#5a3a2a')]), R.r(0.4, 0.8)); c.beginPath(); c.arc(R.r(-2, 2) * L, R.r(-2, 1.8) * L, R.r(0.05, 0.22) * L, 0, TAU); c.fill(); }
      c.strokeStyle = rgba(hex('#3a1c0c'), 0.7); c.lineWidth = 0.12 * L;
      c.beginPath(); c.moveTo(-1.25 * L, 1.6 * L); c.bezierCurveTo(-1.85 * L, 0.2 * L, -1.5 * L, -1.55 * L, 0, -1.55 * L); c.bezierCurveTo(1.5 * L, -1.55 * L, 1.85 * L, 0.2 * L, 1.25 * L, 1.6 * L); c.stroke();
      c.restore();
      // nail holes, one nail still in
      for (let k = 0; k < 6; k++) {
        const a = Math.PI * (0.95 + k * 0.22) + (k > 2 ? 0.25 : 0), x = Math.cos(a) * 1.55 * L, y = Math.sin(a) * 1.55 * L * 1.05;
        c.fillStyle = rgba(hex('#1a0c06')); c.fillRect(x - 0.08 * L, y - 0.12 * L, 0.16 * L, 0.24 * L);
        if (k === 4) { c.fillStyle = rgba(hex('#6a6a6a')); c.fillRect(x - 0.1 * L, y - 0.1 * L, 0.2 * L, 0.2 * L); c.strokeStyle = rgba(hex('#555')); c.lineWidth = 0.08 * L; c.beginPath(); c.moveTo(x, y); c.lineTo(x + 0.5 * L, y + 0.4 * L); c.stroke(); }
      }
      c.strokeStyle = rgba(hex('#e0a060'), 0.45); c.lineWidth = 0.1 * L;
      c.beginPath(); c.arc(0, 0.1 * L, 1.85 * L, Math.PI * 1.15, Math.PI * 1.55); c.stroke();
      it.anchor = [0, -1.5 * L];
    },
    bottle(c, R, it, L) {
      // a time capsule: green glass, a cork, a rolled letter tied with ribbon
      c.rotate(it.rot * 0.25);
      c.scale(it.flip, 1);
      c.fillStyle = rgba(hex('#14100c'), 0.55); c.beginPath(); c.ellipse(0.2 * L, 0.35 * L, 4.1 * L, 1.55 * L, 0, 0, TAU); c.fill();
      const glass = new Path2D();
      glass.moveTo(-3.6 * L, -1.1 * L); glass.lineTo(1.2 * L, -1.1 * L); glass.quadraticCurveTo(2.0 * L, -1.1 * L, 2.4 * L, -0.42 * L); glass.lineTo(3.5 * L, -0.38 * L); glass.lineTo(3.5 * L, 0.38 * L); glass.lineTo(2.4 * L, 0.42 * L);
      glass.quadraticCurveTo(2.0 * L, 1.1 * L, 1.2 * L, 1.1 * L); glass.lineTo(-3.6 * L, 1.1 * L); glass.quadraticCurveTo(-3.85 * L, 0, -3.6 * L, -1.1 * L); glass.closePath();
      c.fillStyle = 'rgba(70,120,80,0.55)'; c.fill(glass);
      c.save(); c.clip(glass);
      // sand that got in, settled at the bottom
      c.fillStyle = rgba(hex('#a8885a'), 0.85); c.fillRect(-3.8 * L, 0.6 * L, 6 * L, 0.6 * L);
      // the letter
      c.fillStyle = rgba(hex('#eadfc0')); c.fillRect(-2.6 * L, -0.55 * L, 3.4 * L, 0.95 * L);
      c.strokeStyle = rgba(hex('#b8a882'), 0.9); c.lineWidth = 0.5;
      for (let k = 0; k < 4; k++) { c.beginPath(); c.moveTo(-2.6 * L, -0.4 * L + k * 0.25 * L); c.lineTo(0.8 * L, -0.4 * L + k * 0.25 * L); c.stroke(); }
      c.fillStyle = rgba(hex('#d8cba8')); c.beginPath(); c.ellipse(0.8 * L, -0.08 * L, 0.18 * L, 0.48 * L, 0, 0, TAU); c.fill();
      c.strokeStyle = rgba(hex('#4a3a7a'), 0.6); c.lineWidth = 0.35;
      for (let k = 0; k < 3; k++) { c.beginPath(); c.moveTo(-2.3 * L, -0.33 * L + k * 0.25 * L); for (let j = 0; j < 12; j++) c.lineTo(-2.3 * L + j * 0.22 * L, -0.33 * L + k * 0.25 * L + Math.sin(j * 2.1 + k) * 0.04 * L); c.stroke(); }
      c.fillStyle = rgba(hex('#b5302a')); c.fillRect(-1.0 * L, -0.6 * L, 0.18 * L, 1.05 * L);
      c.restore();
      // cork
      c.fillStyle = rgba(hex('#b98a52')); c.fillRect(3.2 * L, -0.34 * L, 0.65 * L, 0.68 * L);
      c.fillStyle = rgba(hex('#7a5a30'), 0.7); for (let k = 0; k < 5; k++) { c.beginPath(); c.arc(3.3 * L + R.r(0, 0.5) * L, R.r(-0.25, 0.25) * L, 0.04 * L, 0, TAU); c.fill(); }
      // glass highlights
      c.strokeStyle = 'rgba(220,255,230,0.6)'; c.lineWidth = 0.14 * L; c.lineCap = 'round';
      c.beginPath(); c.moveTo(-3.3 * L, -0.8 * L); c.lineTo(1.1 * L, -0.82 * L); c.stroke();
      c.strokeStyle = 'rgba(255,255,255,0.85)'; c.lineWidth = 0.06 * L;
      c.beginPath(); c.moveTo(-3.0 * L, -0.85 * L); c.lineTo(-1.6 * L, -0.86 * L); c.stroke();
      c.strokeStyle = 'rgba(30,60,40,0.8)'; c.lineWidth = 0.6; c.stroke(glass);
      it.anchor = [0, 0];
    },
    wormball(c, R, it, L, sc) {
      // a deep burrow ending in a little chamber where a worm sits out the dry spell, tied in a knot
      const top = sc.by(1, it.x) - it.y - 1.5 * L;
      const pts = []; for (let i = 0; i <= 14; i++) { const t = i / 14; pts.push([Math.sin(t * 5 + it.rot * 3) * 0.6 * L, lerp(top, -1.2 * L, t)]); }
      c.lineCap = 'round';
      c.strokeStyle = rgba(hex('#1a110b'), 0.7); c.lineWidth = 0.9 * L; c.beginPath(); openSmooth(c, pts); c.stroke();
      c.strokeStyle = rgba(hex('#3c2a1e'), 0.95); c.lineWidth = 0.6 * L; c.beginPath(); openSmooth(c, pts); c.stroke();
      c.fillStyle = rgba(hex('#1a110b'), 0.85); c.beginPath(); c.ellipse(0, 0, 1.6 * L, 1.35 * L, 0, 0, TAU); c.fill();
      c.fillStyle = rgba(hex('#4a3222')); c.beginPath(); c.ellipse(0, 0.1 * L, 1.4 * L, 1.15 * L, 0, 0, TAU); c.fill();
      c.strokeStyle = rgba(hex('#e8d8c0'), 0.25); c.lineWidth = 0.08 * L; c.beginPath(); c.ellipse(0, 0.1 * L, 1.3 * L, 1.05 * L, 0, 0, TAU); c.stroke(); // mucus lining
      const coil = []; for (let a = 0; a < 4.2 * Math.PI; a += 0.15) { const r = 0.85 * L - a * 0.035 * L; coil.push([Math.cos(a) * r * 1.05, Math.sin(a) * r * 0.85 + 0.12 * L]); }
      c.strokeStyle = rgba(hex('#6a2e36')); c.lineWidth = 0.5 * L; c.beginPath(); openSmooth(c, coil); c.stroke();
      c.strokeStyle = rgba(hex('#a8585e')); c.lineWidth = 0.38 * L; c.beginPath(); openSmooth(c, coil); c.stroke();
      c.strokeStyle = rgba(hex('#f0c8c0'), 0.5); c.lineWidth = 0.08 * L; c.beginPath(); openSmooth(c, coil.map((p) => [p[0] - 0.05 * L, p[1] - 0.12 * L])); c.stroke();
      c.strokeStyle = rgba(hex('#d07a62'), 0.85); c.lineWidth = 0.42 * L; c.beginPath(); openSmooth(c, coil.slice(8, 14)); c.stroke();
      it.anchor = [0, 0];
    },
    woodlice(c, R, it, L) {
      // two woodlice in the damp under the blanket: one going about its business, one declining to
      c.fillStyle = rgba(hex('#140d08'), 0.75); c.beginPath(); c.ellipse(0, 0.1 * L, 1.9 * L, 0.8 * L, 0, 0, TAU); c.fill();
      c.save(); c.translate(-0.55 * L, 0.05 * L); c.scale(it.flip, 1);
      const g = hex('#7a7c80');
      c.strokeStyle = rgba(hex('#4a4a4e')); c.lineWidth = 0.05 * L; c.lineCap = 'round';
      for (let k = 0; k < 7; k++) { const x = -0.55 * L + k * 0.17 * L; c.beginPath(); c.moveTo(x, 0.1 * L); c.lineTo(x - 0.05 * L, 0.38 * L); c.stroke(); }
      c.fillStyle = rgba(g); c.beginPath(); c.ellipse(0, 0, 0.75 * L, 0.36 * L, 0, Math.PI, TAU); c.lineTo(0.75 * L, 0.12 * L); c.lineTo(-0.75 * L, 0.12 * L); c.fill();
      c.strokeStyle = rgba(hex('#3e3f44'), 0.8); c.lineWidth = 0.035 * L;
      for (let k = 1; k < 8; k++) { const x = -0.75 * L + k * 0.19 * L; c.beginPath(); c.moveTo(x, 0.1 * L); c.quadraticCurveTo(x + 0.03 * L, -0.25 * L, x, -Math.sqrt(Math.max(0, 1 - (x / (0.75 * L)) ** 2)) * 0.36 * L); c.stroke(); }
      c.fillStyle = rgba(LT, 0.35); c.beginPath(); c.ellipse(-0.1 * L, -0.25 * L, 0.45 * L, 0.06 * L, 0, 0, TAU); c.fill();
      c.strokeStyle = rgba(hex('#5a5a60')); c.lineWidth = 0.04 * L;
      c.beginPath(); c.moveTo(0.7 * L, -0.05 * L); c.quadraticCurveTo(1.0 * L, -0.4 * L, 1.15 * L, -0.15 * L); c.moveTo(0.72 * L, 0); c.quadraticCurveTo(1.05 * L, -0.15 * L, 1.2 * L, 0.05 * L); c.stroke();
      c.restore();
      // the rolled-up one
      const bx = 1.05 * L, by = 0.15 * L, r = 0.42 * L;
      c.fillStyle = rgba(hex('#5e6064')); c.beginPath(); c.arc(bx, by, r, 0, TAU); c.fill();
      c.strokeStyle = rgba(hex('#34353a'), 0.85); c.lineWidth = 0.03 * L;
      for (let k = -2; k <= 2; k++) { c.beginPath(); c.ellipse(bx + k * 0.14 * L, by, Math.max(0.02, r * (1 - Math.abs(k) * 0.3)) * 0.35, r * Math.sqrt(1 - (k * 0.3) ** 2), 0, 0, TAU); c.stroke(); }
      c.fillStyle = rgba(LT, 0.4); c.beginPath(); c.arc(bx - r * 0.35, by - r * 0.4, r * 0.18, 0, TAU); c.fill();
      it.anchor = [0, 0];
    },
    oldgallery(c, R, it, L) {
      // a gallery the colony gave up on: the roof slumped and the sand poured back in
      c.scale(it.flip, 1);
      const pts = []; for (let i = 0; i <= 14; i++) { const t = i / 14; pts.push([(t - 0.55) * 11 * L, Math.sin(t * 4 + 0.6) * 0.5 * L + (t - 0.5) * 1.2 * L]); }
      c.lineCap = 'round'; c.lineJoin = 'round';
      c.strokeStyle = rgba(hex('#3a2a1a'), 0.35); c.lineWidth = 0.95 * L; c.beginPath(); openSmooth(c, pts); c.stroke();
      c.strokeStyle = rgba(hex('#b8976a'), 0.75); c.lineWidth = 0.62 * L; c.beginPath(); openSmooth(c, pts); c.stroke();
      // the old walls, now only broken dashes
      c.strokeStyle = rgba(hex('#2a1c10'), 0.6); c.lineWidth = 0.6; c.setLineDash([4, 5, 2, 7]);
      c.beginPath(); openSmooth(c, pts.map((p) => [p[0], p[1] - 0.36 * L])); c.stroke();
      c.beginPath(); openSmooth(c, pts.map((p) => [p[0], p[1] + 0.36 * L])); c.stroke();
      c.setLineDash([]);
      // the collapsed chamber at its end, backfilled and crushed flat
      const e = pts[pts.length - 1];
      c.fillStyle = rgba(hex('#7a5c3c'), 0.85); c.beginPath(); blob(c, R, e[0] + 1.6 * L, e[1] + 0.2 * L, 2.3 * L, 0.65 * L, 0.05, 0.15, 12); c.fill();
      c.strokeStyle = rgba(hex('#2a1c10'), 0.55); c.setLineDash([3, 4]); c.stroke(); c.setLineDash([]);
      for (let i = 0; i < 40; i++) { c.fillStyle = rgba(R.pick([hex('#c4a87a'), hex('#4a3624'), hex('#8a6a44')]), 0.85); c.beginPath(); poly(c, R, e[0] + 1.6 * L + R.r(-2, 2) * L, e[1] + 0.2 * L + R.r(-0.45, 0.45) * L, R.r(0.05, 0.12) * L, 5, 0.4); c.fill(); }
      // what was left behind: two old husks and the ghost of an ant
      for (let k = 0; k < 2; k++) { c.fillStyle = rgba(hex('#a08458'), 0.8); c.beginPath(); c.ellipse(e[0] + (0.6 + k * 1.4) * L, e[1] + 0.35 * L, 0.2 * L, 0.08 * L, R.r(-0.5, 0.5), 0, TAU); c.fill(); }
      c.globalAlpha = 0.45; deadAnt(c, R, e[0] + 2.6 * L, e[1] + 0.3 * L, L * 0.9, 0.2); c.globalAlpha = 1;
      it.anchor = [it.flip * pts[5][0], pts[5][1]];
    },
    rootchannel(c, R, it, L) {
      // an old root rotted away, leaving a channel stained with iron
      const pts = []; for (let i = 0; i <= 12; i++) { const t = i / 12; pts.push([Math.sin(t * 3 + it.rot * 4) * 0.5 * L + t * 0.4 * L, (t - 0.5) * 7 * L]); }
      c.fillStyle = rgba(hex('#b0622c'), 0.35); c.beginPath(); taper(c, pts, (t) => L * lerp(1.2, 0.35, t)); c.fill();
      c.fillStyle = rgba(hex('#c47a3a'), 0.4); c.beginPath(); taper(c, pts, (t) => L * lerp(0.75, 0.22, t)); c.fill();
      c.fillStyle = rgba(hex('#2e2014'), 0.9); c.beginPath(); taper(c, pts, (t) => L * lerp(0.36, 0.08, t)); c.fill();
      for (let k = 0; k < 2; k++) {
        const b = pts[4 + k * 3], s2 = k ? 1 : -1;
        const br = []; for (let i = 0; i <= 5; i++) br.push([b[0] + s2 * i * 0.45 * L, b[1] + i * 0.35 * L + Math.sin(i) * 0.1 * L]);
        c.fillStyle = rgba(hex('#b0622c'), 0.3); c.beginPath(); taper(c, br, (t) => L * lerp(0.6, 0.15, t)); c.fill();
        c.fillStyle = rgba(hex('#2e2014'), 0.85); c.beginPath(); taper(c, br, (t) => L * lerp(0.16, 0.04, t)); c.fill();
      }
      it.anchor = [pts[3][0], pts[3][1]];
    },
    acorn(c, R, it, L) {
      // an acorn a jay buried and forgot, now quietly becoming an oak
      c.rotate(it.rot * 0.4 - 0.3);
      c.fillStyle = rgba(hex('#140d08'), 0.6); c.beginPath(); c.ellipse(0.1 * L, 0.1 * L, 1.0 * L, 0.7 * L, 0, 0, TAU); c.fill();
      // root curling down
      const rt = []; for (let i = 0; i <= 10; i++) { const t = i / 10; rt.push([0.5 * L + Math.sin(t * 2.5) * 0.6 * L, 0.3 * L + t * 3.2 * L]); }
      c.fillStyle = rgba(hex('#f0e6cc')); c.beginPath(); taper(c, rt, (t) => L * lerp(0.22, 0.05, t)); c.fill();
      c.strokeStyle = rgba(hex('#f0e6cc'), 0.5); c.lineWidth = 0.4;
      for (let i = 4; i < 10; i++) { const p = rt[i]; c.beginPath(); c.moveTo(p[0], p[1]); c.lineTo(p[0] + R.r(-0.3, 0.3) * L, p[1] + R.r(0, 0.2) * L); c.stroke(); }
      // shoot, pale and hooked, heading for the light
      c.strokeStyle = rgba(hex('#d8d0a0')); c.lineWidth = 0.14 * L; c.lineCap = 'round';
      c.beginPath(); c.moveTo(0.3 * L, -0.4 * L); c.quadraticCurveTo(0.6 * L, -1.4 * L, 0.2 * L, -1.8 * L); c.stroke();
      // the nut, split
      c.fillStyle = rgba(hex('#8a5a2a')); c.beginPath(); c.ellipse(0, 0, 0.85 * L, 0.55 * L, 0, 0, TAU); c.fill();
      c.fillStyle = rgba(hex('#b07a3a'), 0.8); c.beginPath(); c.ellipse(-0.1 * L, -0.15 * L, 0.6 * L, 0.2 * L, 0, 0, TAU); c.fill();
      c.strokeStyle = rgba(hex('#3a2010')); c.lineWidth = 0.6; c.beginPath(); c.moveTo(0.2 * L, -0.5 * L); c.lineTo(0.45 * L, 0.45 * L); c.stroke();
      c.fillStyle = rgba(LT, 0.6); c.beginPath(); c.ellipse(-0.3 * L, -0.25 * L, 0.3 * L, 0.07 * L, -0.2, 0, TAU); c.fill();
      // cup, scaly
      c.fillStyle = rgba(hex('#7a6a44')); c.beginPath(); c.ellipse(-0.75 * L, 0, 0.35 * L, 0.6 * L, 0, 0, TAU); c.fill();
      c.fillStyle = rgba(hex('#4a3a20'), 0.8); for (let k = 0; k < 10; k++) { c.beginPath(); c.arc(-0.75 * L + R.r(-0.22, 0.22) * L, R.r(-0.45, 0.45) * L, 0.06 * L, 0, TAU); c.fill(); }
      it.anchor = [0, 0];
    },
    key(c, R, it, L) {
      c.rotate(it.rot * 0.5 - 0.15);
      const g = hex('#c9a040');
      c.fillStyle = rgba(hex('#2a1a10'), 0.6); c.beginPath(); c.ellipse(0.2 * L, 0.2 * L, 2.4 * L, 0.9 * L, 0, 0, TAU); c.fill();
      // bow
      c.fillStyle = rgba(g); c.beginPath(); c.arc(-1.4 * L, 0, 0.75 * L, 0, TAU); c.fill();
      c.fillStyle = rgba(hex('#30231a')); c.beginPath(); c.arc(-1.55 * L, 0, 0.26 * L, 0, TAU); c.fill();
      // blade & bits
      c.fillStyle = rgba(g); c.fillRect(-0.75 * L, -0.2 * L, 2.6 * L, 0.42 * L);
      c.beginPath(); c.moveTo(0.2 * L, 0.2 * L);
      const teeth = [0.35, 0.2, 0.4, 0.15, 0.3]; for (let k = 0; k < 5; k++) { c.lineTo((0.25 + k * 0.32) * L, (0.22 + teeth[k]) * L); c.lineTo((0.4 + k * 0.32) * L, 0.22 * L); }
      c.lineTo(1.85 * L, 0.2 * L); c.closePath(); c.fill();
      c.fillStyle = rgba(shade(g, 0.5)); c.fillRect(-0.7 * L, -0.15 * L, 2.4 * L, 0.08 * L);
      c.fillStyle = rgba(LT, 0.8); c.beginPath(); c.arc(-1.75 * L, -0.4 * L, 0.1 * L, 0, TAU); c.fill();
      c.strokeStyle = rgba(shade(g, -0.4)); c.lineWidth = 0.5; c.beginPath(); c.arc(-1.4 * L, 0, 0.75 * L, 0, TAU); c.stroke();
      // ring with a fragment of red tag string
      c.strokeStyle = rgba(hex('#b8b4aa')); c.lineWidth = 0.12 * L; c.beginPath(); c.arc(-2.4 * L, -0.25 * L, 0.5 * L, 0, TAU); c.stroke();
      c.strokeStyle = rgba(hex('#b5302a')); c.lineWidth = 0.1 * L; c.beginPath(); c.moveTo(-2.7 * L, 0.15 * L); c.quadraticCurveTo(-3.1 * L, 0.6 * L, -2.6 * L, 0.9 * L); c.stroke();
      it.anchor = [0, 0];
    },
    cap(c, R, it, L) {
      c.rotate(it.rot);
      const r = 1.0 * L;
      c.fillStyle = rgba(hex('#1a120d'), 0.6); c.beginPath(); c.ellipse(0.1 * L, 0.15 * L, r * 1.15, r * 0.6, 0, 0, TAU); c.fill();
      // seen edge-on, tilted: crimped skirt
      c.fillStyle = rgba(hex('#b02a24'));
      c.beginPath();
      for (let k = 0; k <= 21; k++) { const x = -r + (k / 21) * 2 * r; c.lineTo(x, (k % 2 ? 0.42 : 0.3) * L); }
      c.lineTo(r * 0.95, -0.05 * L); c.quadraticCurveTo(0, -0.45 * L, -r * 0.95, -0.05 * L); c.closePath(); c.fill();
      c.fillStyle = rgba(hex('#d8d0c0')); c.beginPath(); c.ellipse(0, -0.12 * L, r * 0.92, 0.22 * L, 0, Math.PI, TAU); c.fill();
      c.fillStyle = rgba(hex('#b02a24')); c.beginPath(); c.ellipse(0, -0.1 * L, r * 0.6, 0.12 * L, 0, Math.PI, TAU); c.fill();
      c.fillStyle = rgba(hex('#7a4a28'), 0.8); for (let k = 0; k < 5; k++) { c.beginPath(); c.arc(R.r(-r, r), R.r(0, 0.35) * L, R.r(0.05, 0.12) * L, 0, TAU); c.fill(); }
      c.strokeStyle = rgba(LT, 0.6); c.lineWidth = 0.6; c.beginPath(); c.moveTo(-r * 0.7, 0.05 * L); c.lineTo(-r * 0.2, 0.0); c.stroke();
      it.anchor = [0, 0];
    },
    marble(c, R, it, L) {
      const r = 0.72 * L;
      c.fillStyle = rgba(hex('#100a07'), 0.6); c.beginPath(); c.arc(0.1 * L, 0.12 * L, r * 1.08, 0, TAU); c.fill();
      const g = c.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r);
      g.addColorStop(0, rgba(hex('#cfe6ee'))); g.addColorStop(0.6, rgba(hex('#3f8aa8'))); g.addColorStop(1, rgba(hex('#163a52')));
      c.fillStyle = g; c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fill();
      c.save(); c.beginPath(); c.arc(0, 0, r, 0, TAU); c.clip();
      c.strokeStyle = rgba(hex('#f0a020'), 0.9); c.lineWidth = r * 0.28;
      c.beginPath(); c.moveTo(-r, r * 0.3); c.bezierCurveTo(-r * 0.3, -r * 0.6, r * 0.2, r * 0.7, r, -r * 0.2); c.stroke();
      c.strokeStyle = rgba(hex('#ffffff'), 0.7); c.lineWidth = r * 0.1;
      c.beginPath(); c.moveTo(-r, r * 0.5); c.bezierCurveTo(-r * 0.2, -r * 0.4, r * 0.3, r * 0.8, r, 0); c.stroke();
      c.restore();
      c.fillStyle = rgba(LT, 0.95); c.beginPath(); c.ellipse(-r * 0.38, -r * 0.4, r * 0.22, r * 0.12, -0.6, 0, TAU); c.fill();
      c.fillStyle = rgba(LT, 0.4); c.beginPath(); c.ellipse(r * 0.35, r * 0.45, r * 0.15, r * 0.06, -0.6, 0, TAU); c.fill();
      it.anchor = [0, 0];
    },
    soldier(c, R, it, L) {
      // a tin soldier, lying on his back, still at attention
      c.rotate(it.rot * 0.3);
      c.scale(it.flip, 1);
      const s = L * 0.95;
      c.fillStyle = rgba(hex('#1a110b'), 0.6); c.beginPath(); c.ellipse(0, 0.3 * s, 2.5 * s, 0.75 * s, 0, 0, TAU); c.fill();
      const red = hex('#b2302a'), blue = hex('#25304a'), black = hex('#15110f'), skin = hex('#e5b48c'), gold = hex('#d4a640');
      // base plate
      c.fillStyle = rgba(hex('#5c7a3a')); c.fillRect(2.0 * s, -0.55 * s, 0.22 * s, 1.1 * s);
      // legs (blue trousers)
      c.fillStyle = rgba(blue); c.fillRect(0.6 * s, -0.32 * s, 1.45 * s, 0.3 * s); c.fillRect(0.6 * s, 0.02 * s, 1.45 * s, 0.3 * s);
      // tunic
      c.fillStyle = rgba(red); c.beginPath(); c.moveTo(-0.9 * s, -0.42 * s); c.lineTo(0.7 * s, -0.4 * s); c.lineTo(0.7 * s, 0.4 * s); c.lineTo(-0.9 * s, 0.42 * s); c.closePath(); c.fill();
      c.fillStyle = rgba(LT, 0.85); c.fillRect(-0.7 * s, -0.04 * s, 1.3 * s, 0.08 * s); // belt-cross
      c.fillStyle = rgba(gold); for (let k = 0; k < 3; k++) { c.beginPath(); c.arc(-0.5 * s + k * 0.4 * s, 0.22 * s, 0.05 * s, 0, TAU); c.fill(); }
      // head & bearskin hat
      c.fillStyle = rgba(skin); c.beginPath(); c.ellipse(-1.2 * s, 0, 0.32 * s, 0.28 * s, 0, 0, TAU); c.fill();
      c.fillStyle = rgba(black); c.beginPath(); c.ellipse(-1.85 * s, 0, 0.62 * s, 0.4 * s, 0, 0, TAU); c.fill();
      c.fillStyle = rgba(hex('#555'), 0.6); c.beginPath(); c.ellipse(-1.95 * s, -0.15 * s, 0.4 * s, 0.08 * s, 0, 0, TAU); c.fill();
      c.fillStyle = rgba(hex('#111')); c.fillRect(-1.25 * s, -0.12 * s, 0.05 * s, 0.05 * s); c.fillRect(-1.25 * s, 0.06 * s, 0.05 * s, 0.05 * s);
      // rifle at the shoulder
      c.strokeStyle = rgba(hex('#4a3020')); c.lineWidth = 0.13 * s; c.lineCap = 'round';
      c.beginPath(); c.moveTo(1.1 * s, -0.55 * s); c.lineTo(-1.7 * s, -0.55 * s); c.stroke();
      c.strokeStyle = rgba(hex('#9a9a9a')); c.lineWidth = 0.06 * s; c.beginPath(); c.moveTo(-1.7 * s, -0.55 * s); c.lineTo(-2.3 * s, -0.55 * s); c.stroke();
      // chipped paint
      c.fillStyle = rgba(hex('#8a8a86'), 0.85); c.beginPath(); c.arc(0.2 * s, -0.25 * s, 0.1 * s, 0, TAU); c.fill(); c.beginPath(); c.arc(1.3 * s, 0.2 * s, 0.07 * s, 0, TAU); c.fill();
      c.fillStyle = rgba(LT, 0.4); c.fillRect(-0.9 * s, -0.4 * s, 1.5 * s, 0.07 * s);
      it.anchor = [0, 0];
    },
    pipe(c, R, it, L) {
      c.rotate(it.rot * 0.4);
      const w = hex('#e8e0cc');
      c.fillStyle = rgba(hex('#2a170d'), 0.5); c.beginPath(); c.ellipse(0, 0.25 * L, 3.1 * L, 0.6 * L, 0, 0, TAU); c.fill();
      // stem
      c.fillStyle = rgba(w); c.beginPath(); c.moveTo(-2.9 * L, -0.12 * L); c.lineTo(1.2 * L, -0.2 * L); c.lineTo(1.2 * L, 0.12 * L); c.lineTo(-2.9 * L, 0.1 * L); c.closePath(); c.fill();
      c.fillStyle = rgba(hex('#6a5a48')); c.beginPath(); c.ellipse(-2.9 * L, -0.01 * L, 0.04 * L, 0.1 * L, 0, 0, TAU); c.fill(); // broken end, the bore
      // bowl with spur
      c.fillStyle = rgba(w); c.beginPath(); c.moveTo(1.0 * L, -0.2 * L); c.quadraticCurveTo(1.6 * L, 0.2 * L, 2.0 * L, 0.0); c.lineTo(2.6 * L, -1.2 * L); c.quadraticCurveTo(2.1 * L, -1.4 * L, 1.75 * L, -1.15 * L); c.quadraticCurveTo(1.4 * L, -0.4 * L, 1.0 * L, -0.2 * L); c.fill();
      c.fillStyle = rgba(w); c.beginPath(); c.moveTo(1.55 * L, 0.05 * L); c.lineTo(1.7 * L, 0.35 * L); c.lineTo(1.85 * L, 0.05 * L); c.fill();
      c.fillStyle = rgba(hex('#3a2a20')); c.beginPath(); c.ellipse(2.18 * L, -1.27 * L, 0.42 * L, 0.11 * L, 0.25, 0, TAU); c.fill();
      // staining
      c.fillStyle = rgba(hex('#a08060'), 0.4); c.beginPath(); c.ellipse(1.9 * L, -0.6 * L, 0.3 * L, 0.5 * L, -0.4, 0, TAU); c.fill();
      c.fillStyle = rgba(LT, 0.7); c.fillRect(-2.6 * L, -0.12 * L, 3.4 * L, 0.06 * L);
      it.anchor = [0, 0];
    },
    coin(c, R, it, L) {
      c.rotate(it.rot * 0.5);
      const r = 0.95 * L;
      c.fillStyle = rgba(hex('#1a0f08'), 0.6); c.beginPath(); c.ellipse(0.08 * L, 0.12 * L, r * 1.05, r * 0.98, 0, 0, TAU); c.fill();
      c.fillStyle = rgba(hex('#8a5a32')); c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fill();
      c.fillStyle = rgba(hex('#5e9a82'), 0.65);
      for (let k = 0; k < 9; k++) { c.beginPath(); blob(c, R, R.r(-0.6, 0.6) * r, R.r(-0.6, 0.6) * r, R.r(0.1, 0.3) * r, R.r(0.08, 0.2) * r, 0, 0.4, 7); c.fill(); }
      c.strokeStyle = rgba(hex('#c08a50'), 0.8); c.lineWidth = r * 0.08; c.beginPath(); c.arc(0, 0, r * 0.86, 0, TAU); c.stroke();
      // a worn profile
      c.fillStyle = rgba(hex('#a87048'), 0.9);
      c.beginPath(); c.moveTo(0.25 * r, -0.5 * r); c.quadraticCurveTo(-0.2 * r, -0.55 * r, -0.25 * r, -0.1 * r); c.quadraticCurveTo(-0.3 * r, 0.3 * r, -0.05 * r, 0.5 * r); c.lineTo(0.25 * r, 0.45 * r); c.quadraticCurveTo(0.35 * r, 0.1 * r, 0.25 * r, -0.5 * r); c.fill();
      c.fillStyle = rgba(hex('#6a4024'), 0.8); c.beginPath(); c.arc(0.02 * r, -0.12 * r, 0.05 * r, 0, TAU); c.fill();
      c.fillStyle = rgba(LT, 0.5); c.beginPath(); c.ellipse(-0.4 * r, -0.55 * r, 0.3 * r, 0.08 * r, -0.7, 0, TAU); c.fill();
      it.anchor = [0, 0];
    },
    arrow(c, R, it, L) {
      c.rotate(it.rot);
      c.fillStyle = rgba(hex('#14100c'), 0.6); c.beginPath(); c.ellipse(0.1 * L, 0.12 * L, 1.4 * L, 0.8 * L, 0, 0, TAU); c.fill();
      const pts = [[1.3 * L, 0], [-0.4 * L, -0.65 * L], [-0.9 * L, -0.55 * L], [-0.6 * L, -0.15 * L], [-1.05 * L, -0.12 * L], [-1.05 * L, 0.12 * L], [-0.6 * L, 0.15 * L], [-0.9 * L, 0.55 * L], [-0.4 * L, 0.65 * L]];
      c.fillStyle = rgba(hex('#59626e')); c.beginPath(); pts.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]))); c.closePath(); c.fill();
      c.save(); c.clip();
      for (let k = 0; k < 14; k++) { c.fillStyle = rgba(R.chance(0.5) ? hex('#8a94a0') : hex('#3a4048'), 0.6); c.beginPath(); c.ellipse(R.r(-0.9, 1) * L, R.r(-0.6, 0.6) * L, R.r(0.15, 0.3) * L, R.r(0.08, 0.15) * L, R.r(0, 3), 0, TAU); c.fill(); }
      c.restore();
      c.strokeStyle = rgba(LT, 0.5); c.lineWidth = 0.5; c.beginPath(); c.moveTo(1.2 * L, -0.02 * L); c.lineTo(-0.4 * L, -0.6 * L); c.stroke();
      it.anchor = [0, 0];
    },
    ammonite(c, R, it, L) {
      const r = 2.7 * L;
      c.fillStyle = rgba(hex('#2a2c30'), 0.6); c.beginPath(); c.arc(0.1 * L, 0.15 * L, r * 1.06, 0, TAU); c.fill();
      c.fillStyle = rgba(hex('#cfc4a8')); c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fill();
      // spiral whorls
      c.strokeStyle = rgba(hex('#7a6c52'), 0.9); c.lineWidth = 0.08 * L;
      c.beginPath();
      for (let a = 0; a < 6 * Math.PI; a += 0.08) { const rr = r * Math.exp(-0.17 * a) * 0.98; const x = Math.cos(a + it.rot) * rr, y = Math.sin(a + it.rot) * rr; if (a === 0) c.moveTo(x, y); else c.lineTo(x, y); }
      c.stroke();
      // ribs
      c.lineWidth = 0.035 * L; c.strokeStyle = rgba(hex('#8a7c60'), 0.8);
      for (let a = 0; a < 4 * Math.PI; a += 0.22) { const r1 = r * Math.exp(-0.17 * a) * 0.98, r2 = r * Math.exp(-0.17 * (a + 2 * Math.PI)) * 0.98; c.beginPath(); c.moveTo(Math.cos(a + it.rot) * r1, Math.sin(a + it.rot) * r1); c.quadraticCurveTo(Math.cos(a + 0.12 + it.rot) * (r1 + r2) / 2, Math.sin(a + 0.12 + it.rot) * (r1 + r2) / 2, Math.cos(a + it.rot) * r2, Math.sin(a + it.rot) * r2); c.stroke(); }
      c.fillStyle = rgba(LT, 0.35); c.beginPath(); c.arc(-r * 0.3, -r * 0.35, r * 0.45, Math.PI, Math.PI * 1.6); c.fill();
      c.strokeStyle = rgba(hex('#3a362e'), 0.6); c.lineWidth = 0.6; c.beginPath(); c.arc(0, 0, r, 0, TAU); c.stroke();
      it.anchor = [0, 0];
    },
    shell(c, R, it, L) {
      const r = 0.9 * L;
      c.fillStyle = rgba(hex('#d6ccb2'), 0.9);
      c.beginPath(); c.moveTo(0, r * 0.7); c.bezierCurveTo(-r * 1.4, r * 0.2, -r * 0.9, -r, 0, -r); c.bezierCurveTo(r * 0.9, -r, r * 1.4, r * 0.2, 0, r * 0.7); c.fill();
      c.strokeStyle = rgba(hex('#8a7c60'), 0.8); c.lineWidth = 0.5;
      for (let k = -3; k <= 3; k++) { c.beginPath(); c.moveTo(0, r * 0.6); c.lineTo(k * r * 0.28, -r * 0.9); c.stroke(); }
      it.anchor = [0, 0];
    },
    centipede(c, R, it, L) {
      // a lithobius in a crack: the colony's quiet enemy
      c.rotate(it.rot * 0.5);
      c.scale(it.flip, 1);
      const pts = []; for (let i = 0; i <= 15; i++) pts.push([(i / 15 - 0.5) * 4.4 * L, Math.sin(i * 0.5) * 0.3 * L]);
      c.fillStyle = rgba(hex('#1a100a'), 0.6); c.beginPath(); taper(c, pts, () => L * 0.9); c.fill();
      c.strokeStyle = rgba(hex('#a0582a')); c.lineWidth = 0.05 * L; c.lineCap = 'round';
      for (let i = 1; i < 15; i++) { const p = pts[i]; c.beginPath(); c.moveTo(p[0], p[1]); c.lineTo(p[0] - 0.25 * L, p[1] - 0.5 * L); c.moveTo(p[0], p[1]); c.lineTo(p[0] - 0.25 * L, p[1] + 0.5 * L); c.stroke(); }
      c.fillStyle = rgba(hex('#8a4a22')); c.beginPath(); taper(c, pts, (t) => L * (0.32 - 0.06 * Math.abs(t - 0.5))); c.fill();
      c.strokeStyle = rgba(hex('#4a2410'), 0.7); c.lineWidth = 0.5;
      for (let i = 1; i < 15; i++) { const p = pts[i]; c.beginPath(); c.moveTo(p[0], p[1] - 0.15 * L); c.lineTo(p[0], p[1] + 0.15 * L); c.stroke(); }
      const h = pts[15];
      c.strokeStyle = rgba(hex('#8a4a22')); c.lineWidth = 0.05 * L;
      c.beginPath(); c.moveTo(h[0], h[1]); c.quadraticCurveTo(h[0] + 0.8 * L, h[1] - 0.6 * L, h[0] + 1.5 * L, h[1] - 0.3 * L); c.moveTo(h[0], h[1]); c.quadraticCurveTo(h[0] + 0.8 * L, h[1] + 0.5 * L, h[0] + 1.5 * L, h[1] + 0.5 * L); c.stroke();
      c.fillStyle = rgba(hex('#e0b080'), 0.5); c.beginPath(); c.ellipse(0, -0.1 * L, 1.8 * L, 0.05 * L, 0, 0, TAU); c.fill();
      it.anchor = [0, 0];
    },
  };

  /* --- nest cavities */
  function interiorCol(sc, y) {
    const f = (y - sc.top) / sc.D;
    if (f < sc.fr.b1) return mixc(P.inHumus, P.inClay, sstep(sc.fr.b1 - 0.06, sc.fr.b1 + 0.03, f));
    if (f < sc.fr.b3) return mixc(P.inClay, P.inSand, sstep(sc.fr.b2 - 0.03, sc.fr.b3, f));
    return P.inSand;
  }
  function paintNestShell(c, sc, R) {
    const { L, tw } = sc;
    c.lineCap = 'round'; c.lineJoin = 'round';
    const strokeTun = (t, w, colFn, alpha, dy) => {
      const pts = t.pts;
      for (let i = 0; i < pts.length - 1; i += 4) {
        const seg = pts.slice(i, Math.min(pts.length, i + 6));
        c.strokeStyle = rgba(colFn(seg[0][1], i), alpha); c.lineWidth = w;
        c.beginPath(); c.moveTo(seg[0][0], seg[0][1] + dy); for (let k = 1; k < seg.length; k++) c.lineTo(seg[k][0], seg[k][1] + dy); c.stroke();
      }
    };
    const chPath = (ch, k, dy) => { c.beginPath(); closedSmooth(c, ch.pts.map((p) => [ch.cx + (p[0] - ch.cx) * k, ch.cy + (p[1] - ch.cy) * k + dy])); };
    // 1. compressed-earth halo, a little darker than the soil
    for (const t of sc.tunnels) strokeTun(t, tw + 0.7 * L, () => hex('#120b07'), 0.3, 0.06 * L);
    for (const ch of sc.chambers) { c.fillStyle = rgba(hex('#120b07'), 0.3); chPath(ch, 1 + 0.5 * L / ch.rh, 0.12 * L); c.fill(); }
    // 2. crisp dark lip
    for (const t of sc.tunnels) strokeTun(t, tw + 0.18 * L, () => hex('#160d08'), 0.95, 0);
    for (const ch of sc.chambers) { c.fillStyle = rgba(hex('#160d08')); chPath(ch, 1 + 0.09 * L / ch.rh, 0); c.fill(); }
    // 3. interior in shadow
    const sh = (y) => shade(interiorCol(sc, y), -0.38);
    for (const t of sc.tunnels) strokeTun(t, tw, sh, 1, 0);
    for (const ch of sc.chambers) { c.fillStyle = rgba(sh(ch.cy)); chPath(ch, 1, 0); c.fill(); }
    // 4. the lit back wall of each tunnel
    for (const t of sc.tunnels) strokeTun(t, tw * 0.66, (y, i) => jit(interiorCol(sc, y), R, 8), 1, tw * 0.14);
    for (const t of sc.tunnels) strokeTun(t, tw * 0.22, (y) => shade(interiorCol(sc, y), 0.18), 0.55, tw * 0.3);
    // chambers: back wall, packed floor, scumble, grains, ceiling shadow
    for (const ch of sc.chambers) {
      const q = ch.job === 'queen';
      const col = q ? P.inQueen : jit(interiorCol(sc, ch.cy), R, 6);
      c.save(); chPath(ch, 1, 0); c.clip();
      const g = c.createLinearGradient(0, ch.cy - ch.rh, 0, ch.cy + ch.rh);
      g.addColorStop(0, rgba(shade(col, -0.28))); g.addColorStop(0.55, rgba(col)); g.addColorStop(1, rgba(shade(col, 0.12)));
      c.fillStyle = g; chPath(ch, 0.9, ch.rh * 0.12); c.fill();
      // gouache scumble: short dry strokes
      for (let k = 0; k < ch.rw / L * 14; k++) {
        const x = ch.cx + R.r(-1, 1) * ch.rw, y = ch.cy + R.r(-1, 0.9) * ch.rh, l = R.r(0.3, 1.2) * L;
        c.strokeStyle = rgba(shade(col, R.r(-0.25, 0.22)), R.r(0.12, 0.32)); c.lineWidth = R.r(0.6, 2.0);
        c.beginPath(); c.moveTo(x, y); c.lineTo(x + l, y + R.r(-0.1, 0.1) * L); c.stroke();
      }
      // soil grains showing in the wall
      for (let k = 0; k < ch.rw / L * 10; k++) {
        const x = ch.cx + R.r(-1, 1) * ch.rw, y = ch.cy + R.r(-1, 0.5) * ch.rh;
        c.fillStyle = rgba(shade(col, R.r(-0.5, -0.15)), R.r(0.4, 0.8)); c.beginPath(); poly(c, R, x, y, R.r(0.03, 0.09) * L, 5, 0.4); c.fill();
      }
      // mandible scrapes
      c.strokeStyle = rgba(shade(col, -0.35), 0.4); c.lineWidth = 0.55;
      for (let k = 0; k < ch.rw / L * 7; k++) {
        const x = ch.cx + R.r(-0.9, 0.9) * ch.rw, y = ch.cy + R.r(-1.1, 0.2) * ch.rh, a = R.r(0, TAU), r0 = R.r(0.12, 0.25) * L;
        c.beginPath(); c.arc(x, y, r0, a, a + 1.1); c.stroke();
        if (R.chance(0.4)) { c.beginPath(); c.arc(x + 0.08 * L, y + 0.05 * L, r0, a, a + 1.0); c.stroke(); } // paired: two mandibles
      }
      if (q) {
        const rg = c.createRadialGradient(ch.cx, ch.cy + ch.rh * 0.4, 0, ch.cx, ch.cy + ch.rh * 0.2, ch.rw);
        rg.addColorStop(0, 'rgba(255,222,150,0.6)'); rg.addColorStop(0.6, 'rgba(255,196,110,0.18)'); rg.addColorStop(1, 'rgba(255,190,110,0)');
        c.fillStyle = rg; c.fillRect(ch.cx - ch.rw, ch.cy - ch.rh, ch.rw * 2, ch.rh * 2);
      }
      // packed floor: a lighter band where feet have polished it
      // the floor, worn darker and smoother where thousands of feet have passed
      c.fillStyle = rgba(shade(col, -0.2), 0.7);
      c.beginPath();
      for (let i = 0; i <= 24; i++) { const x = lerp(ch.cx - ch.rw * 0.97, ch.cx + ch.rw * 0.97, i / 24); const y = sc.floorY(ch, x) - 0.38 * L * Math.pow(Math.sin(Math.PI * i / 24), 0.4); if (i) c.lineTo(x, y); else c.moveTo(x, y); }
      for (let i = 24; i >= 0; i--) { const x = lerp(ch.cx - ch.rw * 0.97, ch.cx + ch.rw * 0.97, i / 24); c.lineTo(x, sc.floorY(ch, x) + 0.1 * L); }
      c.fill();
      c.strokeStyle = rgba(shade(col, 0.25), 0.55); c.lineWidth = 0.8;
      c.beginPath(); for (let i = 1; i < 24; i++) { const x = lerp(ch.cx - ch.rw * 0.97, ch.cx + ch.rw * 0.97, i / 24); const y = sc.floorY(ch, x) - 0.38 * L * Math.pow(Math.sin(Math.PI * i / 24), 0.4); if (i > 1) c.lineTo(x, y); else c.moveTo(x, y); } c.stroke();
      // a path of footfall: tiny scuffs along the middle of the floor
      c.fillStyle = rgba(shade(col, -0.35), 0.5);
      for (let k = 0; k < ch.rw / L * 5; k++) { const x = ch.cx + R.r(-0.85, 0.85) * ch.rw; c.fillRect(x, sc.floorY(ch, x) - R.r(0.05, 0.3) * L, R.r(0.15, 0.4) * L, 0.6); }
      // ceiling shadow
      const g2 = c.createLinearGradient(0, ch.cy - ch.rh, 0, ch.cy - ch.rh * 0.1);
      g2.addColorStop(0, rgba(DK, 0.5)); g2.addColorStop(1, rgba(DK, 0));
      c.fillStyle = g2; c.fillRect(ch.cx - ch.rw * 1.1, ch.cy - ch.rh * 1.1, ch.rw * 2.2, ch.rh * 1.1);
      c.restore();
    }
    // tunnel grains
    for (const t of sc.tunnels) {
      for (let i = 0; i < t.pts.length; i += 2) {
        const p = t.pts[i];
        c.fillStyle = rgba(shade(interiorCol(sc, p[1]), R.r(-0.45, 0.15)), 0.6);
        c.beginPath(); c.arc(p[0] + R.r(-0.3, 0.3) * tw, p[1] + R.r(-0.25, 0.3) * tw, R.r(0.03, 0.07) * L, 0, TAU); c.fill();
      }
    }
    // crisp floor line in chambers
    for (const ch of sc.chambers) {
      c.strokeStyle = rgba(shade(interiorCol(sc, ch.cy), -0.6), 0.75); c.lineWidth = 0.7;
      c.beginPath(); for (let i = 0; i <= 20; i++) { const x = lerp(ch.cx - ch.rw * 0.96, ch.cx + ch.rw * 0.96, i / 20); const y = sc.floorY(ch, x) + 0.05 * L; if (i) c.lineTo(x, y); else c.moveTo(x, y); } c.stroke();
    }
  }

  /* brood & stores, all sitting on chamber floors */
  function egg(c, R, x, y, s) {
    c.fillStyle = rgba(hex('#f6f1e2')); c.beginPath(); c.ellipse(x, y, s * 0.11, s * 0.075, R.r(-0.5, 0.5), 0, TAU); c.fill();
    c.strokeStyle = rgba(hex('#b8ad90'), 0.6); c.lineWidth = 0.35; c.stroke();
    c.fillStyle = rgba(LT, 0.95); c.beginPath(); c.arc(x - s * 0.04, y - s * 0.03, s * 0.022, 0, TAU); c.fill();
  }
  function larva(c, R, x, y, s, flip) {
    c.save(); c.translate(x, y); c.scale(flip, 1);
    const pts = []; for (let i = 0; i <= 8; i++) { const a = -2.6 + i / 8 * 2.9; pts.push([Math.cos(a) * s * 0.17, Math.sin(a) * s * 0.15]); }
    c.fillStyle = rgba(hex('#f2ead2')); c.beginPath(); taper(c, pts, (t) => s * (0.08 + 0.13 * Math.sin(t * Math.PI * 0.85 + 0.25))); c.fill();
    c.strokeStyle = rgba(hex('#b0a080'), 0.7); c.lineWidth = 0.35; c.stroke();
    c.strokeStyle = rgba(hex('#c4b494'), 0.7);
    for (let i = 2; i < 8; i++) { const p = pts[i]; const a = Math.atan2(p[1], p[0]); c.beginPath(); c.moveTo(p[0] * 0.6, p[1] * 0.6); c.lineTo(p[0] * 1.35 - Math.cos(a) * 0, p[1] * 1.35); c.stroke(); }
    c.fillStyle = rgba(hex('#c0703a')); c.beginPath(); c.arc(pts[8][0], pts[8][1], s * 0.03, 0, TAU); c.fill();
    c.fillStyle = rgba(LT, 0.8); c.beginPath(); c.ellipse(-s * 0.02, -s * 0.12, s * 0.06, s * 0.02, 0, 0, TAU); c.fill();
    c.restore();
  }
  function pupa(c, R, x, y, s, a) {
    c.save(); c.translate(x, y); c.rotate(a);
    c.fillStyle = rgba(jit(hex('#d8bf8a'), R, 10)); c.beginPath(); c.ellipse(0, 0, s * 0.24, s * 0.11, 0, 0, TAU); c.fill();
    c.strokeStyle = rgba(hex('#8a7048'), 0.6); c.lineWidth = 0.4; c.stroke();
    c.fillStyle = rgba(hex('#3a2a1a'), 0.85); c.beginPath(); c.ellipse(-s * 0.19, 0, s * 0.04, s * 0.05, 0, 0, TAU); c.fill(); // meconium spot
    c.strokeStyle = rgba(hex('#b8a070'), 0.5); c.lineWidth = 0.35;
    for (let k = -1; k <= 1; k++) { c.beginPath(); c.moveTo(-s * 0.18, k * s * 0.04); c.lineTo(s * 0.2, k * s * 0.05); c.stroke(); }
    c.fillStyle = rgba(LT, 0.7); c.beginPath(); c.ellipse(s * 0.02, -s * 0.06, s * 0.13, s * 0.025, 0, 0, TAU); c.fill();
    c.restore();
  }
  function seed(c, R, x, y, s, kind) {
    c.save(); c.translate(x, y); c.rotate(R.r(-0.6, 0.6));
    if (kind === 0) { // grass seed
      c.fillStyle = rgba(jit(hex('#c7a660'), R, 12)); c.beginPath(); c.ellipse(0, 0, s * 0.2, s * 0.06, 0, 0, TAU); c.fill();
      c.strokeStyle = rgba(hex('#8a6a30'), 0.7); c.lineWidth = 0.35; c.beginPath(); c.moveTo(-s * 0.18, 0); c.lineTo(s * 0.18, 0); c.stroke();
    } else if (kind === 1) { // violet seed with its oily white elaiosome
      c.fillStyle = rgba(hex('#6a4a2a')); c.beginPath(); c.ellipse(0, 0, s * 0.1, s * 0.075, 0, 0, TAU); c.fill();
      c.fillStyle = rgba(hex('#f4ecd4')); c.beginPath(); c.arc(s * 0.1, 0, s * 0.04, 0, TAU); c.fill();
    } else if (kind === 2) { // plantain: dark and glossy
      c.fillStyle = rgba(hex('#3a2416')); c.beginPath(); c.ellipse(0, 0, s * 0.09, s * 0.06, 0, 0, TAU); c.fill();
    } else { // clover: little kidney
      c.fillStyle = rgba(jit(hex('#c48a3a'), R, 12)); c.beginPath(); c.ellipse(0, 0, s * 0.07, s * 0.055, 0, 0, TAU); c.fill();
    }
    c.fillStyle = rgba(LT, 0.7); c.beginPath(); c.arc(-s * 0.02, -s * 0.025, s * 0.015, 0, TAU); c.fill();
    c.restore();
  }
  function crumb(c, R, x, y, s) {
    const k = R.f();
    if (k < 0.6) { // bread
      const col = jit(hex('#efdcae'), R, 10);
      c.fillStyle = rgba(col); c.beginPath(); poly(c, R, x, y, s * R.r(0.08, 0.16), 6, 0.4); c.fill();
      if (R.chance(0.6)) { c.fillStyle = rgba(hex('#a86426'), 0.9); c.beginPath(); poly(c, R, x + s * 0.05, y - s * 0.03, s * 0.05, 5, 0.3); c.fill(); }
    } else if (k < 0.75) { // crisp shard
      c.fillStyle = rgba(hex('#e6b850')); c.beginPath(); poly(c, R, x, y, s * 0.16, 4, 0.5); c.fill();
      c.fillStyle = rgba(hex('#fff0b0'), 0.7); c.beginPath(); c.arc(x - s * 0.03, y - s * 0.03, s * 0.03, 0, TAU); c.fill();
    } else if (k < 0.88) { // sugar crystal
      c.fillStyle = rgba(hex('#fbf8f0')); c.fillRect(x - s * 0.05, y - s * 0.05, s * 0.1, s * 0.1);
      c.strokeStyle = rgba(hex('#b8c0c8'), 0.8); c.lineWidth = 0.35; c.strokeRect(x - s * 0.05, y - s * 0.05, s * 0.1, s * 0.1);
    } else { // apple fleck
      c.fillStyle = rgba(hex('#e8d090')); c.beginPath(); poly(c, R, x, y, s * 0.1, 5, 0.3); c.fill();
      c.fillStyle = rgba(hex('#b5302a')); c.fillRect(x - s * 0.08, y - s * 0.09, s * 0.12, s * 0.03);
    }
  }
  function aphid(c, R, x, y, s, a) {
    c.save(); c.translate(x, y); c.rotate(a);
    c.fillStyle = rgba(jit(hex('#efe0a6'), R, 8)); c.beginPath(); c.ellipse(0, 0, s * 0.17, s * 0.12, 0, 0, TAU); c.fill();
    c.fillStyle = rgba(hex('#dfcc8a')); c.beginPath(); c.ellipse(s * 0.17, -s * 0.01, s * 0.06, s * 0.055, 0, 0, TAU); c.fill();
    c.strokeStyle = rgba(hex('#a08850'), 0.8); c.lineWidth = 0.35;
    for (let k = 0; k < 3; k++) { c.beginPath(); c.moveTo(s * (0.08 - k * 0.08), s * 0.09); c.lineTo(s * (0.13 - k * 0.12), s * 0.17); c.stroke(); }
    c.beginPath(); c.moveTo(s * 0.2, -s * 0.04); c.quadraticCurveTo(s * 0.28, -s * 0.14, s * 0.18, -s * 0.2); c.stroke();
    c.beginPath(); c.moveTo(-s * 0.1, -s * 0.08); c.lineTo(-s * 0.15, -s * 0.15); c.stroke(); // cornicle
    c.fillStyle = rgba(hex('#7a2a1a')); c.beginPath(); c.arc(s * 0.2, -s * 0.02, s * 0.015, 0, TAU); c.fill();
    c.fillStyle = rgba(LT, 0.75); c.beginPath(); c.ellipse(-s * 0.02, -s * 0.07, s * 0.08, s * 0.025, 0, 0, TAU); c.fill();
    c.restore();
  }
  function deadAnt(c, R, x, y, s, a) {
    c.save(); c.translate(x, y); c.rotate(a); c.scale(s, s);
    c.fillStyle = rgba(hex('#2a1a12'), 0.95);
    c.beginPath(); c.ellipse(-0.3, 0, 0.18, 0.13, 0, 0, TAU); c.fill();
    c.beginPath(); c.ellipse(0.0, 0, 0.13, 0.07, 0, 0, TAU); c.fill();
    c.beginPath(); c.ellipse(0.22, 0, 0.09, 0.08, 0, 0, TAU); c.fill();
    c.strokeStyle = rgba(hex('#2a1a12'), 0.9); c.lineWidth = 0.025;
    for (let k = 0; k < 3; k++) { c.beginPath(); c.moveTo(0.05 - k * 0.06, -0.05); c.quadraticCurveTo(0.1 - k * 0.1, -0.25, 0.0 - k * 0.08, -0.22); c.stroke(); }
    c.restore();
  }
  function pile(sc, R, ch, fc, hw, hMax, n, base, fn) {
    const items = [];
    for (let i = 0; i < n; i++) {
      const u = R.r(-1, 1), hm = hMax * Math.pow(Math.max(0, 1 - u * u), 0.8);
      items.push([clamp(fc + u * hw, 0.02, 0.98), base + R.f() * hm]);
    }
    items.sort((a, b) => b[1] - a[1]);
    for (const it of items) { const q = onFloor(sc, ch, it[0], it[1]); fn(q[0], q[1]); }
  }
  function onFloor(sc, ch, f, lift) { const x = lerp(ch.cx - ch.rw * 0.85, ch.cx + ch.rw * 0.85, f); return [x, sc.floorY(ch, x) - lift]; }

  function paintNestContents(c, sc, R) {
    const { L } = sc;
    for (const ch of sc.chambers) {
      c.save();
      c.beginPath(); closedSmooth(c, ch.pts); c.clip();
      const job = ch.job;
      if (job === 'eggs' || job === 'queen') {
        const piles = job === 'queen' ? 1 : 2;
        for (let p = 0; p < piles; p++) {
          const fc = job === 'queen' ? (sc.Q.cx > sc.E[0] ? 0.36 : 0.64) : R.r(0.25, 0.75);
          pile(sc, R, ch, fc, job === 'queen' ? 0.12 : 0.17, 0.75 * L, job === 'queen' ? 34 : 60, 0.12 * L, (x, y) => egg(c, R, x, y, 1.8 * L));
        }
      } else if (job === 'larvae') {
        // sorted by size, as nurses do
        const n = Math.floor(ch.rw / L * 2.6);
        for (let i = 0; i < n; i++) {
          const f = (i + R.r(0, 0.5)) / n, s = L * lerp(1.0, 2.3, f);
          const q = onFloor(sc, ch, 0.04 + f * 0.92, s * 0.17 + (R.chance(0.25) ? s * 0.22 : 0));
          larva(c, R, q[0], q[1], s, R.s());
        }
      } else if (job === 'pupae') {
        const n = Math.floor(ch.rw / L * 3.0);
        for (let i = 0; i < n; i++) {
          const f = R.r(0.03, 0.97), row = R.chance(0.3) ? 1 : 0;
          const q = onFloor(sc, ch, f, L * (0.18 + row * 0.3));
          pupa(c, R, q[0], q[1], 1.75 * L, R.r(-0.25, 0.25));
        }
        // a callow worker, still pale, climbing out of her cocoon
        const q = onFloor(sc, ch, R.r(0.3, 0.7), L * 0.1);
        pupa(c, R, q[0] - 0.12 * L, q[1] - 0.08 * L, 1.75 * L, 0.1);
        ch.callow = q;
      } else if (job === 'seeds') {
        pile(sc, R, ch, R.r(0.45, 0.55), 0.42, 1.15 * L, Math.floor(ch.rw / L * 26), 0.1 * L, (x, y) => seed(c, R, x, y, 1.7 * L, R.i(0, 3)));
      } else if (job === 'crumbs') {
        pile(sc, R, ch, R.r(0.5, 0.62), 0.36, 1.25 * L, Math.floor(ch.rw / L * 14), 0.15 * L, (x, y) => crumb(c, R, x, y, 1.9 * L));
      } else if (job === 'midden') {
        const n = Math.floor(ch.rw / L * 9);
        for (let i = 0; i < n; i++) {
          const f = R.r(0.05, 0.95), h = Math.pow(R.f(), 2) * 0.7 * L;
          const q = onFloor(sc, ch, f, 0.06 * L + h);
          const k = R.f();
          if (k < 0.25) deadAnt(c, R, q[0], q[1], L * R.r(0.8, 1), R.r(0, TAU));
          else if (k < 0.55) { c.fillStyle = rgba(jit(hex('#9a7a4a'), R, 15), 0.9); c.beginPath(); c.ellipse(q[0], q[1], 0.18 * L, 0.07 * L, R.r(0, 3), 0, TAU); c.fill(); }
          else if (k < 0.62) { // green beetle elytron, iridescent
            c.fillStyle = rgba(hex('#2f6a4a')); c.beginPath(); c.ellipse(q[0], q[1], 0.32 * L, 0.13 * L, R.r(-0.4, 0.4), 0, TAU); c.fill();
            c.fillStyle = rgba(hex('#9ae0b0'), 0.6); c.beginPath(); c.ellipse(q[0] - 0.08 * L, q[1] - 0.05 * L, 0.15 * L, 0.03 * L, 0, 0, TAU); c.fill();
          } else if (k < 0.68) { // a ladybird's wing case
            c.fillStyle = rgba(hex('#c8281e')); c.beginPath(); c.arc(q[0], q[1], 0.2 * L, Math.PI, TAU); c.fill();
            c.fillStyle = rgba(hex('#111')); c.beginPath(); c.arc(q[0] - 0.08 * L, q[1] - 0.08 * L, 0.04 * L, 0, TAU); c.arc(q[0] + 0.07 * L, q[1] - 0.1 * L, 0.035 * L, 0, TAU); c.fill();
          } else { c.fillStyle = rgba(jit(hex('#5a4630'), R, 20), 0.9); c.beginPath(); poly(c, R, q[0], q[1], R.r(0.05, 0.12) * L, 5, 0.4); c.fill(); }
        }
      } else if (job === 'rest') {
        for (let i = 0; i < 5; i++) { const q = onFloor(sc, ch, R.r(0.1, 0.9), 0.06 * L); c.fillStyle = rgba(shade(interiorCol(sc, ch.cy), -0.3), 0.8); c.beginPath(); poly(c, R, q[0], q[1], R.r(0.05, 0.1) * L, 5, 0.4); c.fill(); }
      }
      c.restore();
    }
  }

  function paintPastureAphids(c, sc, R) {
    const ch = sc.chambers.find((c2) => c2.job === 'pasture');
    if (!ch) return;
    const { L } = sc;
    for (let i = 0; i < sc.taproot.length; i++) {
      const p = sc.taproot[i];
      if (Math.abs(p[1] - ch.cy) > ch.rh * 0.9) continue;
      const w = sc.taprootW(i / (sc.taproot.length - 1)) / 2;
      for (const side of [-1, 1]) {
        if (R.chance(0.35)) continue;
        aphid(c, R, p[0] + side * (w + 0.12 * L), p[1] + R.r(-0.1, 0.1) * L, L * R.r(1.3, 1.8), side < 0 ? Math.PI / 2 + 0.2 : -Math.PI / 2 - 0.2);
      }
    }
    // the farmers keep aphid eggs too: a shiny black cluster
    const q = onFloor(sc, ch, ch.cx > sc.taprootX(ch.cy) ? 0.85 : 0.12, 0.08 * L);
    for (let k = 0; k < 9; k++) {
      const x = q[0] + R.r(-0.4, 0.4) * L, y = q[1] - R.r(0, 0.25) * L;
      c.fillStyle = rgba(hex('#16100c')); c.beginPath(); c.ellipse(x, y, 0.07 * L, 0.045 * L, R.r(0, 3), 0, TAU); c.fill();
      c.fillStyle = rgba(LT, 0.8); c.beginPath(); c.arc(x - 0.02 * L, y - 0.015 * L, 0.012 * L, 0, TAU); c.fill();
    }
  }

  /* --- the cut edge: turf, the crater mound */
  function paintCutEdge(c, sc, R) {
    const { W, L, Ex } = sc;
    paintPastureAphids(c, sc, R);
    // turf mat: cut stems and crowns of grass, a tangle of thatch at the very top
    for (let x = -4; x < W + 4; x += R.r(1.2, 4)) {
      if (Math.abs(x - Ex) < sc.craterW * 0.95) continue;
      const y = sc.cutY(x);
      const col = jit(R.pick([hex('#c8c08a'), hex('#a39a62'), hex('#8a8a4a'), hex('#d6cc9a'), hex('#6e6a3a')]), R, 12);
      const l = R.r(0.25, 0.9) * L, a = Math.PI / 2 + R.r(-0.5, 0.5);
      c.strokeStyle = rgba(col, R.r(0.55, 0.9)); c.lineWidth = R.r(0.08, 0.22) * L; c.lineCap = 'round';
      c.beginPath(); c.moveTo(x, y - 0.1 * L); c.quadraticCurveTo(x + Math.cos(a) * l * 0.5 + R.r(-0.1, 0.1) * L, y + Math.sin(a) * l * 0.5, x + Math.cos(a) * l, y + Math.sin(a) * l); c.stroke();
    }
    c.strokeStyle = rgba(hex('#1e150f'), 0.8); c.lineWidth = 0.9;
    c.beginPath(); for (let x = -4; x <= W + 4; x += 4) { const y = sc.cutY(x); if (x < 0) c.moveTo(x, y); else c.lineTo(x, y); } c.stroke();
    // crater mound: clay pellets carried up from below, a little volcano cut in half
    const mx0 = Ex - sc.craterW, mx1 = Ex + sc.craterW;
    const mtop = (x) => sc.cutY(x) - sc.mound(x);
    c.fillStyle = rgba(hex('#7a4a2c'));
    c.beginPath(); c.moveTo(mx0, sc.cutY(mx0));
    for (let x = mx0; x <= mx1; x += 2) c.lineTo(x, mtop(x));
    c.lineTo(mx1, sc.cutY(mx1) + 0.4 * L); c.lineTo(mx0, sc.cutY(mx0) + 0.4 * L); c.closePath(); c.fill();
    const n = Math.floor(sc.craterW * sc.craterH / (L * L) * 24);
    for (let i = 0; i < n; i++) {
      const x = R.r(mx0, mx1); const yt = mtop(x);
      const y = R.r(yt, sc.cutY(x) + 0.25 * L);
      const col = jit(R.pick([hex('#a8683a'), hex('#8e5530'), hex('#b97c48'), hex('#6e4026'), hex('#c4905a'), hex('#7d6a58')]), R, 10);
      const r = R.r(0.09, 0.2) * L;
      c.fillStyle = rgba(col); c.beginPath(); poly(c, R, x, y, r, 6, 0.35); c.fill();
      if (R.chance(0.35)) { c.fillStyle = rgba(LT, 0.35); c.beginPath(); c.arc(x - r * 0.3, y - r * 0.35, r * 0.3, 0, TAU); c.fill(); }
      if (R.chance(0.3)) { c.fillStyle = rgba(DK, 0.4); c.beginPath(); c.arc(x + r * 0.3, y + r * 0.4, r * 0.35, 0, TAU); c.fill(); }
    }
    // the shaft mouth: a dark opening in the floor of the little crater
    const sh = sc.tunnels[0].pts;
    const mouth = sh.filter((p) => p[1] < sc.cutY(p[0]) + 1.2 * L);
    if (mouth.length > 1) {
      c.save();
      c.beginPath(); c.moveTo(mx0, mtop(mx0) - 4 * L); c.lineTo(mx1, mtop(mx1) - 4 * L); c.lineTo(mx1, sc.cutY(mx1) + 3 * L); c.lineTo(mx0, sc.cutY(mx0) + 3 * L); c.closePath(); c.clip();
      c.lineCap = 'butt';
      c.strokeStyle = rgba(hex('#160d08')); c.lineWidth = sc.tw + 0.18 * L; c.beginPath(); openSmooth(c, mouth); c.stroke();
      c.strokeStyle = rgba(shade(P.inHumus, -0.38)); c.lineWidth = sc.tw; c.beginPath(); openSmooth(c, mouth); c.stroke();
      const mg = c.createLinearGradient(0, mouth[0][1], 0, sc.cutY(Ex) + 1.2 * L);
      mg.addColorStop(0, rgba(shade(P.inHumus, -0.62))); mg.addColorStop(1, rgba(shade(P.inHumus, -0.1)));
      c.strokeStyle = mg; c.lineWidth = sc.tw * 0.6; c.beginPath(); openSmooth(c, mouth.map((p) => [p[0], p[1] + 0.12 * L])); c.stroke();
      c.restore();
      // pellets tumbling into the rim of the hole
      for (let i = 0; i < 10; i++) { const x = Ex + R.s() * R.r(0.45, 0.9) * sc.tw, y = mtop(x) + R.r(-0.1, 0.2) * L; c.fillStyle = rgba(jit(hex('#b07040'), R, 15)); c.beginPath(); poly(c, R, x, y, R.r(0.1, 0.17) * L, 6, 0.3); c.fill(); }
    }
  }

  /* --- everything above the ground */
  function grassBlade(c, R, x, y, h, lean, w, col, opt) {
    opt = opt || {};
    const pts = []; const n = 8;
    const droop = opt.droop || 0;
    for (let i = 0; i <= n; i++) { const t = i / n; pts.push([x + lean * t * t + Math.sin(t * 3 + x) * w * 0.3, y - h * t + droop * t * t * t]); }
    c.fillStyle = rgba(col); c.beginPath(); taper(c, pts, (t) => w * (1 - t * 0.92)); c.fill();
    if (opt.dry) { c.fillStyle = rgba(mixc(col, hex('#d8c48a'), 0.7)); c.beginPath(); taper(c, pts.slice(5), (t) => w * (0.4 - t * 0.35)); c.fill(); }
    c.strokeStyle = rgba(shade(col, 0.35), 0.5); c.lineWidth = Math.max(0.4, w * 0.16);
    c.beginPath(); openSmooth(c, pts.slice(0, n).map((p) => [p[0] - w * 0.18, p[1]])); c.stroke();
    c.strokeStyle = rgba(shade(col, -0.35), 0.45); c.lineWidth = Math.max(0.35, w * 0.1);
    c.beginPath(); openSmooth(c, pts.slice(0, n - 1).map((p) => [p[0] + w * 0.3, p[1]])); c.stroke();
    return pts[n];
  }
  function stem(c, x, y, h, lean, w, col) {
    const pts = []; for (let i = 0; i <= 8; i++) { const t = i / 8; pts.push([x + lean * t * t, y - h * t]); }
    c.strokeStyle = rgba(col); c.lineWidth = w; c.lineCap = 'round'; c.beginPath(); openSmooth(c, pts); c.stroke();
    return pts;
  }
  function meadowPlant(c, sc, R, x, y, k, kind, fade, hmax) {
    const L = sc.L;
    const f = (col) => mixc(col, P.paper, fade);
    if (kind === 'tuft') {
      const nb = R.i(4, 9), base = R.r(0.3, 0.8) * L;
      for (let i = 0; i < nb; i++) {
        const h = Math.min(R.r(2.2, 6.5) * L * k, hmax);
        grassBlade(c, R, x + R.r(-base, base), y + R.r(0, 0.15) * L, h, R.r(-0.5, 0.5) * h * 0.55, R.r(0.16, 0.3) * L * k, f(jit(R.pick(P.grass), R, 10)), { dry: R.chance(0.3), droop: R.chance(0.3) ? h * 0.25 : 0 });
      }
    } else if (kind === 'plantain') {
      const h = Math.min(R.r(5, 8.5) * L * k, hmax), pts = stem(c, x, y, h, R.r(-1.5, 1.5) * L, 0.12 * L * k, f(hex('#7d8a44')));
      const tp = pts[8], a = Math.atan2(tp[1] - pts[6][1], tp[0] - pts[6][0]);
      c.save(); c.translate(tp[0], tp[1]); c.rotate(a + Math.PI / 2);
      c.fillStyle = rgba(f(hex('#4a3420'))); c.beginPath(); c.ellipse(0, -0.55 * L * k, 0.22 * L * k, 0.62 * L * k, 0, 0, TAU); c.fill();
      c.fillStyle = rgba(f(hex('#7a5a30')), 0.8); for (let j = 0; j < 8; j++) { c.beginPath(); c.arc(R.r(-0.12, 0.12) * L * k, -R.r(0.1, 1.1) * L * k, 0.05 * L * k, 0, TAU); c.fill(); }
      c.fillStyle = rgba(f(hex('#f6f0dc'))); for (let j = 0; j < 7; j++) { const yy = -0.5 * L * k + R.r(-0.12, 0.12) * L * k; const xx = (j / 6 - 0.5) * 0.7 * L * k; c.beginPath(); c.arc(xx, yy - Math.abs(xx) * 0.3, 0.06 * L * k, 0, TAU); c.fill(); }
      c.restore();
      // the basal leaves: ribbed lances
      for (let j = 0; j < 3; j++) grassBlade(c, R, x, y, Math.min(2.4 * L * k, hmax), R.r(-2, 2) * L * k, 0.45 * L * k, f(jit(hex('#5f7a34'), R, 8)), { droop: L * 0.6 });
    } else if (kind === 'clover') {
      const h = Math.min(R.r(1.6, 3) * L * k, hmax), pts = stem(c, x, y, h, R.r(-0.6, 0.6) * L, 0.09 * L * k, f(hex('#6a8a3a')));
      for (let j = 0; j < 3; j++) { const a = -Math.PI / 2 + (j - 1) * 1.1; c.fillStyle = rgba(f(jit(hex('#4f7030'), R, 8))); c.beginPath(); c.ellipse(x + Math.cos(a) * 0.4 * L * k, y - 0.9 * L * k + Math.sin(a) * 0.25 * L * k, 0.35 * L * k, 0.2 * L * k, a, 0, TAU); c.fill(); }
      const tp = pts[8], r = 0.42 * L * k;
      c.fillStyle = rgba(f(hex('#c9a080'))); c.beginPath(); c.arc(tp[0], tp[1], r, 0, TAU); c.fill();
      for (let j = 0; j < 22; j++) { const a = R.r(Math.PI, TAU + 0.6), rr = R.r(0.2, 1) * r; c.fillStyle = rgba(f(R.chance(0.5) ? hex('#f4eee4') : hex('#e8c6cc'))); c.beginPath(); c.ellipse(tp[0] + Math.cos(a) * rr, tp[1] + Math.sin(a) * rr, 0.09 * L * k, 0.05 * L * k, a, 0, TAU); c.fill(); }
    } else if (kind === 'bent') {
      const h = Math.min(R.r(5.5, 8.5) * L * k, hmax), lean = R.r(-1.6, 1.6) * L, pts = stem(c, x, y, h, lean, 0.07 * L * k, f(hex('#8a8a4a')));
      const tp = pts[8];
      c.strokeStyle = rgba(f(hex('#8a6a5a')), 0.85); c.lineWidth = 0.5;
      for (let j = 0; j < 9; j++) {
        const b = pts[Math.max(5, 8 - (j % 4))], a = -Math.PI / 2 + R.r(-0.9, 0.9), l = R.r(0.6, 1.6) * L * k;
        const ex = b[0] + Math.cos(a) * l, ey = b[1] + Math.sin(a) * l;
        c.beginPath(); c.moveTo(b[0], b[1]); c.quadraticCurveTo(b[0] + Math.cos(a) * l * 0.5, b[1] + Math.sin(a) * l * 0.4, ex, ey); c.stroke();
        c.fillStyle = rgba(f(hex('#a07a6a'))); c.beginPath(); c.ellipse(ex, ey, 0.06 * L, 0.11 * L, a + Math.PI / 2, 0, TAU); c.fill();
      }
      c.fillStyle = rgba(f(hex('#a07a6a'))); c.beginPath(); c.ellipse(tp[0], tp[1], 0.06 * L, 0.13 * L, 0, 0, TAU); c.fill();
    } else if (kind === 'yarrow') {
      const h = Math.min(R.r(4.5, 7) * L * k, hmax), pts = stem(c, x, y, h, R.r(-0.8, 0.8) * L, 0.12 * L * k, f(hex('#6f7f44')));
      const tp = pts[8];
      c.strokeStyle = rgba(f(hex('#6f7f44'))); c.lineWidth = 0.6;
      for (let j = 0; j < 7; j++) { c.beginPath(); c.moveTo(tp[0], tp[1] + 0.4 * L); c.lineTo(tp[0] + (j / 6 - 0.5) * 1.6 * L * k, tp[1] - R.r(0, 0.2) * L); c.stroke(); }
      for (let j = 0; j < 26; j++) { const xx = tp[0] + R.r(-0.85, 0.85) * L * k, yy = tp[1] - R.r(0, 0.35) * L * k - (1 - Math.abs(xx - tp[0]) / (0.85 * L * k)) * 0.25 * L * k; c.fillStyle = rgba(f(R.chance(0.8) ? hex('#f5f1e4') : hex('#e8d8b8'))); c.beginPath(); c.arc(xx, yy, 0.1 * L * k, 0, TAU); c.fill(); }
      // feathery leaf
      c.strokeStyle = rgba(f(hex('#5a7a34')), 0.9); c.lineWidth = 0.5;
      const lb = pts[3]; c.beginPath(); for (let j = 0; j < 9; j++) { const xx = lb[0] + j * 0.18 * L, yy = lb[1] + j * 0.08 * L; c.moveTo(xx, yy); c.lineTo(xx + 0.1 * L, yy - 0.25 * L); c.moveTo(xx, yy); c.lineTo(xx + 0.1 * L, yy + 0.2 * L); } c.stroke();
    } else if (kind === 'hawkbit') {
      const h = Math.min(R.r(4, 7.5) * L * k, hmax), pts = stem(c, x, y, h, R.r(-1.2, 1.2) * L, 0.08 * L * k, f(hex('#7a8a40')));
      const tp = pts[8], r = 0.5 * L * k;
      c.fillStyle = rgba(f(hex('#6a7a34'))); c.beginPath(); c.ellipse(tp[0], tp[1] + 0.15 * L, 0.18 * L * k, 0.28 * L * k, 0, 0, TAU); c.fill();
      for (let j = 0; j < 11; j++) { const a = Math.PI + (j / 10) * Math.PI; c.strokeStyle = rgba(f(jit(hex('#f2c030'), R, 10))); c.lineWidth = 0.16 * L * k; c.beginPath(); c.moveTo(tp[0], tp[1]); c.lineTo(tp[0] + Math.cos(a) * r, tp[1] + Math.sin(a) * r * 0.7); c.stroke(); }
      c.fillStyle = rgba(f(hex('#d89a18'))); c.beginPath(); c.ellipse(tp[0], tp[1] - 0.05 * L, 0.18 * L * k, 0.1 * L * k, 0, 0, TAU); c.fill();
    }
  }

  function paintAbove(c, sc, R, pass) {
    const { W, L, Ex } = sc;
    const pl = sc.plane;
    const hT = sc.top;
    const near = (x, z) =>
      (x < sc.xb + 0.5 * L && z < 1.0) ||
      (Math.abs(x - Ex) < sc.craterW * 1.05 && z < 0.55) ||
      (Math.abs(x - sc.crust.x) < sc.crust.len * 0.65 && Math.abs(z - sc.crust.z) < 0.3) ||
      (Math.abs(x - sc.xd) < 2.2 * L && z < 0.6) ||
      (x > sc.xs - 7 * L && x < sc.xs + 7 * L && z < 0.6);
    const kinds = [['tuft', 0.58], ['plantain', 0.08], ['clover', 0.1], ['bent', 0.11], ['yarrow', 0.04], ['hawkbit', 0.09]];
    const pickKind = () => { let r = R.f(); for (const kk of kinds) { if (r < kk[1]) return kk[0]; r -= kk[1]; } return 'tuft'; };
    if (pass === 0) {
      const nb = Math.floor(W / L * 1.5);
      const plants = [];
      for (let i = 0; i < nb; i++) {
        const x = R.r(-L, W + L), z = R.r(0.3, 1.05);
        if (near(x, z)) continue;
        plants.push([x, z, pickKind()]);
      }
      plants.sort((a, b) => b[1] - a[1]);
      for (const p of plants) {
        const q = pl(p[0], p[1]);
        meadowPlant(c, sc, R, q[0], q[1], 1 - p[1] * 0.3, p[2], clamp((p[1] - 0.5) * 0.7, 0, 0.4), hT * 0.72);
      }
      for (let i = 0; i < (sc.portrait ? 1 : 3); i++) {
        const x = R.r(sc.xb + 2 * L, W * 0.95), z = R.r(0.1, 0.7);
        if (near(x, z + 0.1)) continue;
        oakLeaf(c, R, pl(x, z), L * 1.6, R.r(-0.3, 0.3));
      }
      paintBlanket(c, sc, R);
      paintApple(c, sc, R);
      paintDandelion(c, sc, R);
    } else {
      paintCrust(c, sc, R);
      paintSandal(c, sc, R);
      // near grass in front, at the cut edge
      const plants = [];
      for (let i = 0; i < W / L * 0.6; i++) {
        const x = R.r(-L, W + L), z = R.r(0.02, 0.28);
        if (near(x, z)) continue;
        plants.push([x, z, R.chance(0.8) ? 'tuft' : pickKind()]);
      }
      plants.sort((a, b) => b[1] - a[1]);
      for (const p of plants) { const q = pl(p[0], p[1]); meadowPlant(c, sc, R, q[0], q[1] + 0.15 * L, 0.95, p[2], 0, hT * 0.6); }
    }
  }

  function oakLeaf(c, R, p, s, rot) {
    c.save(); c.translate(p[0], p[1] - s * 0.15); c.rotate(rot); c.scale(1, 0.45);
    const col = jit(hex('#8a6a2a'), R, 15);
    c.fillStyle = rgba(col);
    c.beginPath();
    const lobes = 5;
    for (let side of [-1, 1]) {
      for (let i = 0; i <= lobes; i++) {
        const t = i / lobes, x = lerp(-s, s, t), w = s * 0.45 * Math.sin(t * Math.PI) * (1 + 0.35 * Math.sin(t * Math.PI * lobes * 2));
        if (i === 0 && side < 0) c.moveTo(x, 0); else c.lineTo(side < 0 ? x : lerp(s, -s, t), side * w);
      }
    }
    c.closePath(); c.fill();
    c.strokeStyle = rgba(shade(col, -0.35), 0.8); c.lineWidth = 0.8;
    c.beginPath(); c.moveTo(-s * 1.2, 0); c.lineTo(s, 0); c.stroke();
    c.restore();
  }

  function paintBlanket(c, sc, R) {
    const { L, gh } = sc;
    const pl = sc.plane;
    const xb = sc.xb;
    const lift = 0.7 * L; // lying on the grass tops
    const red = hex('#b8322a'), wht = hex('#f1e7d2'), pink = hex('#d97a66');
    const cellW = 1.9 * L; // check size
    const zN = 0.04, zF = 1.15;
    const fold = (x, z) => Math.sin(x * 0.012 + z * 2) * 0.25 * L + Math.sin(x * 0.031 + 1) * 0.15 * L;
    const P2 = (x, z) => { const p = pl(x, z); return [p[0], p[1] - lift - fold(x, z)]; };
    const right = (z) => xb + z * 2.2 * L + Math.sin(z * 5) * 0.4 * L;
    // shadow under the blanket edge
    c.fillStyle = rgba(hex('#2a2a14'), 0.35);
    c.beginPath(); const s0 = pl(right(0.1) + 0.6 * L, 0.1), s1 = pl(right(1) + 0.6 * L, 1); c.moveTo(s0[0], s0[1]); c.lineTo(s1[0], s1[1]); c.lineTo(s1[0] - 2 * L, s1[1]); c.lineTo(s0[0] - 2 * L, s0[1]); c.fill();
    // top surface: gingham in shallow perspective
    const nz = 7;
    for (let j = 0; j < nz; j++) {
      const z0 = lerp(zN, zF, j / nz), z1 = lerp(zN, zF, (j + 1) / nz);
      for (let i = -1; i * cellW < xb + 3 * L; i++) {
        const x0 = i * cellW, x1 = (i + 1) * cellW;
        const rx0 = Math.min(x0, right(z0)), rx1 = Math.min(x1, right(z0)), rx2 = Math.min(x1, right(z1)), rx3 = Math.min(x0, right(z1));
        if (rx0 >= rx1 - 0.1 && rx3 >= rx2 - 0.1) continue;
        const a = (i & 1) === 0, b = (j & 1) === 0;
        let col = a && b ? red : a || b ? pink : wht;
        col = mixc(col, P.paper, clamp((z0 - 0.75) * 1.2, 0, 0.6));
        c.fillStyle = rgba(jit(col, R, 6));
        c.beginPath();
        const q = [P2(rx0, z0), P2(rx1, z0), P2(rx2, z1), P2(rx3, z1)];
        c.moveTo(q[0][0], q[0][1]); for (let k = 1; k < 4; k++) c.lineTo(q[k][0], q[k][1]); c.closePath(); c.fill();
        // weave texture
        c.strokeStyle = rgba(shade(col, -0.2), 0.25); c.lineWidth = 0.4;
        for (let k = 1; k < 4; k++) { const t = k / 4; const u = [lerp(q[0][0], q[3][0], t), lerp(q[0][1], q[3][1], t)], v = [lerp(q[1][0], q[2][0], t), lerp(q[1][1], q[2][1], t)]; c.beginPath(); c.moveTo(u[0], u[1]); c.lineTo(v[0], v[1]); c.stroke(); }
      }
    }
    // fold shading
    for (let k = 0; k < 6; k++) {
      const x = R.r(0, xb), z = R.r(0.1, 0.9); const p = P2(x, z);
      c.fillStyle = rgba(hex('#3a1010'), 0.12); c.beginPath(); c.ellipse(p[0], p[1], R.r(2, 5) * L, 0.25 * L, R.r(-0.2, 0.2), 0, TAU); c.fill();
      c.fillStyle = rgba(LT, 0.12); c.beginPath(); c.ellipse(p[0] - L, p[1] - 0.35 * L, R.r(2, 4) * L, 0.15 * L, R.r(-0.2, 0.2), 0, TAU); c.fill();
    }
    // the front flap hanging over the cut edge, like a tablecloth over a table
    const hang = (x) => (1.6 + 0.5 * Math.sin(x * 0.02) + 1.6 * sstep(xb - 7 * L, xb, x)) * L;
    const flapTop = (x) => P2(x, zN)[1];
    for (let i = -1; i * cellW < xb; i++) {
      const x0 = Math.max(-2, i * cellW), x1 = Math.min(xb, (i + 1) * cellW);
      for (let j = 0; j < 3; j++) {
        const a = (i & 1) === 0, b = (j & 1) === 0;
        const col = a && b ? red : a || b ? pink : wht;
        c.fillStyle = rgba(shade(jit(col, R, 6), -0.12));
        c.beginPath();
        const ya0 = flapTop(x0) + j * cellW * 0.7, ya1 = flapTop(x1) + j * cellW * 0.7;
        const yb0 = Math.min(flapTop(x0) + (j + 1) * cellW * 0.7, flapTop(x0) + hang(x0)), yb1 = Math.min(flapTop(x1) + (j + 1) * cellW * 0.7, flapTop(x1) + hang(x1));
        if (ya0 >= yb0 && ya1 >= yb1) continue;
        c.moveTo(x0, ya0); c.lineTo(x1, ya1); c.lineTo(x1, Math.max(ya1, yb1)); c.lineTo(x0, Math.max(ya0, yb0)); c.closePath(); c.fill();
      }
    }
    // hem and fringe
    c.strokeStyle = rgba(hex('#7a1a14'), 0.8); c.lineWidth = 0.9;
    c.beginPath(); for (let x = -2; x <= xb; x += 3) { const y = flapTop(x) + hang(x); if (x < 0) c.moveTo(x, y); else c.lineTo(x, y); } c.stroke();
    c.strokeStyle = rgba(hex('#f1e7d2'), 0.85); c.lineWidth = 0.6;
    for (let x = 0; x <= xb; x += 0.35 * L) { const y = flapTop(x) + hang(x); c.beginPath(); c.moveTo(x, y); c.lineTo(x + R.r(-0.1, 0.1) * L, y + R.r(0.4, 0.7) * L); c.stroke(); }
    // shadow cast by the flap on the cut face
    c.fillStyle = rgba(DK, 0.35);
    c.beginPath(); for (let x = -2; x <= xb + 0.5 * L; x += 4) { const y = flapTop(Math.min(x, xb)) + hang(Math.min(x, xb)) + 0.6 * L; if (x < 0) c.moveTo(x, y); else c.lineTo(x, y); }
    for (let x = xb; x >= -2; x -= 4) c.lineTo(x, flapTop(x) + hang(x)); c.fill();
    // fold line along the edge
    c.strokeStyle = rgba(LT, 0.5); c.lineWidth = 1;
    c.beginPath(); for (let x = -2; x <= xb; x += 3) { const y = flapTop(x) - 0.05 * L; if (x < 0) c.moveTo(x, y); else c.lineTo(x, y); } c.stroke();
    // stitching on the right edge
    c.strokeStyle = rgba(hex('#f1e7d2'), 0.8); c.setLineDash([2, 2]); c.lineWidth = 0.6;
    c.beginPath(); for (let z = zN; z < 0.9; z += 0.05) { const p = P2(right(z) - 0.4 * L, z); if (z === zN) c.moveTo(p[0], p[1]); else c.lineTo(p[0], p[1]); } c.stroke(); c.setLineDash([]);
    // crumbs scattered on the cloth
    for (let i = 0; i < 14; i++) { const p = P2(R.r(xb * 0.3, xb), R.r(0.1, 0.8)); crumb(c, R, p[0], p[1], 1.5 * L); }
    sc.blanketTop = P2;
  }

  function paintApple(c, sc, R) {
    const { L } = sc;
    const a = sc.blanketTop(sc.apple.x, sc.apple.z);
    const x = a[0], y = a[1];
    const s = L * (sc.portrait ? 0.85 : 1.05);
    c.save(); c.translate(x, y);
    c.fillStyle = rgba(hex('#3a1010'), 0.3); c.beginPath(); c.ellipse(0.6 * s, 0, 2.6 * s, 0.45 * s, 0, 0, TAU); c.fill();
    const skin = hex('#b8302a'), skin2 = hex('#d8a83a'), flesh = hex('#f0dfae'), brown = hex('#c49a58');
    // bottom cap
    c.fillStyle = rgba(skin); c.beginPath(); c.ellipse(0, -0.9 * s, 1.75 * s, 0.95 * s, 0, 0, Math.PI); c.fill();
    c.beginPath(); c.moveTo(-1.75 * s, -0.9 * s); c.quadraticCurveTo(-1.6 * s, -1.6 * s, -1.0 * s, -1.75 * s); c.lineTo(1.0 * s, -1.75 * s); c.quadraticCurveTo(1.6 * s, -1.6 * s, 1.75 * s, -0.9 * s); c.fill();
    c.fillStyle = rgba(skin2, 0.6); c.beginPath(); c.ellipse(-0.8 * s, -0.9 * s, 0.6 * s, 0.4 * s, 0, 0, TAU); c.fill();
    // bitten waist: scalloped flesh
    c.fillStyle = rgba(flesh);
    c.beginPath(); c.moveTo(-1.0 * s, -1.7 * s);
    for (let k = 0; k <= 6; k++) { const t = k / 6; c.quadraticCurveTo(-0.55 * s + Math.sin(k) * 0.08 * s, -1.7 * s - (t + 0.08) * 2.6 * s, -0.7 * s - (k % 2) * 0.2 * s, -1.7 * s - t * 2.6 * s); }
    c.lineTo(-1.0 * s, -4.4 * s); c.lineTo(1.0 * s, -4.4 * s);
    for (let k = 6; k >= 0; k--) { const t = k / 6; c.quadraticCurveTo(0.55 * s, -1.7 * s - (t - 0.08) * 2.6 * s, 0.68 * s + (k % 2) * 0.2 * s, -1.7 * s - t * 2.6 * s); }
    c.lineTo(1.0 * s, -1.7 * s); c.closePath(); c.fill();
    c.strokeStyle = rgba(brown, 0.9); c.lineWidth = 0.18 * s;
    c.beginPath(); c.moveTo(-0.72 * s, -1.75 * s); c.quadraticCurveTo(-0.5 * s, -3.05 * s, -0.72 * s, -4.35 * s); c.moveTo(0.72 * s, -1.75 * s); c.quadraticCurveTo(0.5 * s, -3.05 * s, 0.72 * s, -4.35 * s); c.stroke();
    // core and pips
    c.fillStyle = rgba(hex('#e2cc90')); c.beginPath(); c.ellipse(0, -3.05 * s, 0.3 * s, 0.85 * s, 0, 0, TAU); c.fill();
    c.fillStyle = rgba(hex('#4a2a14')); c.beginPath(); c.ellipse(-0.1 * s, -3.3 * s, 0.1 * s, 0.22 * s, 0.3, 0, TAU); c.fill(); c.beginPath(); c.ellipse(0.12 * s, -2.8 * s, 0.1 * s, 0.22 * s, -0.3, 0, TAU); c.fill();
    c.fillStyle = rgba(LT, 0.7); c.beginPath(); c.arc(-0.12 * s, -3.4 * s, 0.03 * s, 0, TAU); c.fill();
    // top cap
    c.fillStyle = rgba(skin); c.beginPath(); c.moveTo(-1.0 * s, -4.35 * s); c.quadraticCurveTo(-1.65 * s, -4.6 * s, -1.5 * s, -5.2 * s); c.quadraticCurveTo(-0.8 * s, -5.8 * s, 0, -5.35 * s); c.quadraticCurveTo(0.8 * s, -5.8 * s, 1.5 * s, -5.2 * s); c.quadraticCurveTo(1.65 * s, -4.6 * s, 1.0 * s, -4.35 * s); c.closePath(); c.fill();
    c.fillStyle = rgba(skin2, 0.55); c.beginPath(); c.ellipse(0.8 * s, -4.9 * s, 0.45 * s, 0.25 * s, 0, 0, TAU); c.fill();
    c.fillStyle = rgba(LT, 0.75); c.beginPath(); c.ellipse(-0.9 * s, -5.05 * s, 0.32 * s, 0.1 * s, -0.4, 0, TAU); c.fill();
    c.fillStyle = rgba(LT, 0.6); c.beginPath(); c.ellipse(-1.15 * s, -1.2 * s, 0.25 * s, 0.1 * s, -0.4, 0, TAU); c.fill();
    // stalk & dried calyx
    c.strokeStyle = rgba(hex('#4a3420')); c.lineWidth = 0.16 * s; c.lineCap = 'round';
    c.beginPath(); c.moveTo(0, -5.3 * s); c.quadraticCurveTo(0.1 * s, -6.1 * s, 0.45 * s, -6.5 * s); c.stroke();
    c.strokeStyle = rgba(hex('#3a2a18')); c.lineWidth = 0.1 * s;
    for (let k = -2; k <= 2; k++) { c.beginPath(); c.moveTo(k * 0.12 * s, -0.05 * s); c.lineTo(k * 0.25 * s, 0.15 * s); c.stroke(); }
    c.restore();
    sc.appleTop = [x, y - 5.4 * s];
  }

  function paintCrust(c, sc, R) {
    const { L } = sc;
    const p = sc.plane(sc.crust.x, sc.crust.z);
    c.save(); c.translate(p[0], p[1] - 0.35 * L); c.rotate(sc.crust.rot * 0.4);
    const len = sc.crust.len;
    c.fillStyle = rgba(hex('#2a2a10'), 0.35); c.beginPath(); c.ellipse(0, 0.5 * L, len * 0.55, 0.5 * L, 0, 0, TAU); c.fill();
    // crust: an arc lying on its side
    const outer = [], inner = [];
    for (let i = 0; i <= 20; i++) { const t = i / 20, a = Math.PI * (1.08 + t * 0.84); outer.push([Math.cos(a) * len * 0.5, Math.sin(a) * 1.6 * L + 1.2 * L]); inner.push([Math.cos(a) * len * 0.42, Math.sin(a) * 0.9 * L + 1.2 * L]); }
    c.fillStyle = rgba(hex('#f0e2bc'));
    c.beginPath(); outer.forEach((q, i) => (i ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1]))); inner.slice().reverse().forEach((q) => c.lineTo(q[0], q[1])); c.closePath(); c.fill();
    // bread pores
    c.save(); c.clip();
    for (let i = 0; i < 40; i++) { c.fillStyle = rgba(hex('#cdb88a'), 0.7); c.beginPath(); c.ellipse(R.r(-0.5, 0.5) * len, R.r(-0.6, 1.2) * L, R.r(0.05, 0.14) * L, R.r(0.03, 0.08) * L, R.r(0, 3), 0, TAU); c.fill(); }
    c.restore();
    // baked crust band
    c.strokeStyle = rgba(hex('#9a5a22')); c.lineWidth = 0.5 * L; c.lineCap = 'round';
    c.beginPath(); outer.forEach((q, i) => (i ? c.lineTo(q[0], q[1] + 0.12 * L) : c.moveTo(q[0], q[1] + 0.12 * L))); c.stroke();
    c.strokeStyle = rgba(hex('#5a3010'), 0.8); c.lineWidth = 0.15 * L;
    c.beginPath(); outer.forEach((q, i) => (i ? c.lineTo(q[0], q[1] - 0.05 * L) : c.moveTo(q[0], q[1] - 0.05 * L))); c.stroke();
    c.strokeStyle = rgba(hex('#e8b070'), 0.7); c.lineWidth = 0.08 * L;
    c.beginPath(); outer.slice(3, 12).forEach((q, i) => (i ? c.lineTo(q[0], q[1] + 0.05 * L) : c.moveTo(q[0], q[1] + 0.05 * L))); c.stroke();
    c.restore();
    for (let i = 0; i < 14; i++) { const q = sc.plane(sc.crust.x + R.r(-1, 1) * len * 0.7, sc.crust.z + R.r(-0.25, 0.2)); crumb(c, R, q[0], q[1], 1.5 * L); }
  }

  function paintDandelion(c, sc, R) {
    const { L, top } = sc;
    const base = sc.plane(sc.xd, 0.42);
    // rosette leaves: jagged lion's teeth lying low
    for (let k = 0; k < 4; k++) {
      const dir = k % 2 ? 1 : -1, len = R.r(3.5, 5.5) * L, lift = R.r(0.3, 1.4) * L;
      const col = jit(hex('#5f7f30'), R, 12);
      c.fillStyle = rgba(col);
      c.beginPath(); c.moveTo(base[0], base[1]);
      const n = 6;
      for (let i = 1; i <= n; i++) { const t = i / n; const x = base[0] + dir * len * t, y = base[1] - lift * Math.sin(t * 2.6) - 0.1 * L; c.lineTo(x - dir * 0.4 * L, y - 0.55 * L * (1 - t)); c.lineTo(x, y - 0.15 * L * (1 - t)); }
      for (let i = n; i >= 0; i--) { const t = i / n; c.lineTo(base[0] + dir * len * t, base[1] - lift * Math.sin(t * 2.6) * 0.8 + 0.05 * L); }
      c.closePath(); c.fill();
      c.strokeStyle = rgba(hex('#c8d0a0'), 0.6); c.lineWidth = 0.6;
      c.beginPath(); c.moveTo(base[0], base[1]); for (let i = 1; i <= n; i++) { const t = i / n; c.lineTo(base[0] + dir * len * t, base[1] - lift * Math.sin(t * 2.6) * 0.9 - 0.12 * L); } c.stroke();
    }
    // flower stalk, cut lengthwise: a hollow tube
    const hH = Math.min(top * 0.6, 12.5 * L);
    const lean = R.r(0.5, 2.2) * L;
    const pts = []; for (let i = 0; i <= 10; i++) { const t = i / 10; pts.push([base[0] + lean * t * t, base[1] - hH * t]); }
    const sw = 0.42 * L;
    c.fillStyle = rgba(hex('#6c8a34')); c.beginPath(); taper(c, pts, () => sw); c.fill();
    c.fillStyle = rgba(hex('#e6ecc8')); c.beginPath(); taper(c, pts.slice(0, 10), () => sw * 0.45); c.fill();
    c.fillStyle = rgba(hex('#b0c27a'), 0.6); c.beginPath(); taper(c, pts.slice(0, 10).map((p) => [p[0] + sw * 0.18, p[1]]), () => sw * 0.12); c.fill();
    // a bead of white latex at the cut
    c.fillStyle = rgba(hex('#fbf8ee')); c.beginPath(); c.arc(pts[3][0] + sw * 0.5, pts[3][1], 0.13 * L, 0, TAU); c.fill();
    c.fillStyle = rgba(hex('#b8b0a0'), 0.6); c.beginPath(); c.arc(pts[3][0] + sw * 0.55, pts[3][1] + 0.04 * L, 0.13 * L, 0.2, 2.6); c.fill();
    // head in section
    const hd = pts[10];
    const rw = 1.9 * L;
    // reflexed outer bracts
    c.strokeStyle = rgba(hex('#5a7a2a')); c.lineWidth = 0.18 * L; c.lineCap = 'round';
    for (let k = 0; k < 6; k++) { const s = k % 2 ? 1 : -1, o = (k >> 1) * 0.25 * L; c.beginPath(); c.moveTo(hd[0] + s * (0.4 * L + o), hd[1] - 0.3 * L); c.quadraticCurveTo(hd[0] + s * (1.1 * L + o), hd[1] - 0.1 * L, hd[0] + s * (1.0 * L + o), hd[1] + 0.9 * L + o); c.stroke(); }
    // receptacle
    c.fillStyle = rgba(hex('#8aa040')); c.beginPath(); c.ellipse(hd[0], hd[1] - 0.6 * L, 0.95 * L, 0.6 * L, 0, Math.PI, TAU); c.fill();
    c.fillStyle = rgba(hex('#eef0d0')); c.beginPath(); c.ellipse(hd[0], hd[1] - 0.6 * L, 0.7 * L, 0.35 * L, 0, Math.PI, TAU); c.fill();
    // inner bracts holding the florets
    c.fillStyle = rgba(hex('#6f8f30'));
    for (const s of [-1, 1]) { c.beginPath(); c.moveTo(hd[0] + s * 0.9 * L, hd[1] - 0.6 * L); c.quadraticCurveTo(hd[0] + s * 1.15 * L, hd[1] - 1.6 * L, hd[0] + s * 0.95 * L, hd[1] - 2.3 * L); c.lineTo(hd[0] + s * 0.7 * L, hd[1] - 1.0 * L); c.closePath(); c.fill(); }
    // florets: straps fanning out, sliced through the middle
    const nf = 26;
    for (let i = 0; i < nf; i++) {
      const t = i / (nf - 1), a = -Math.PI / 2 + (t - 0.5) * 2.6;
      const r0 = 0.8 * L, r1 = rw * R.r(1.25, 1.45);
      const b0 = [hd[0] + Math.cos(a) * r0 * 0.8, hd[1] - 0.7 * L + Math.sin(a) * r0 * 0.4];
      const b1 = [hd[0] + Math.cos(a) * r1, hd[1] - 1.0 * L + Math.sin(a) * r1 * 0.95];
      const col = jit(Math.abs(t - 0.5) < 0.25 ? hex('#e8a41c') : hex('#f4c632'), R, 10);
      c.fillStyle = rgba(col);
      c.beginPath(); taper(c, [b0, [lerp(b0[0], b1[0], 0.5) + R.r(-0.1, 0.1) * L, lerp(b0[1], b1[1], 0.5)], b1], (tt) => 0.25 * L * (0.4 + tt * 0.8)); c.fill();
      // toothed tip
      c.fillStyle = rgba(shade(col, -0.15)); c.beginPath(); c.arc(b1[0], b1[1], 0.08 * L, 0, TAU); c.fill();
      // style
      if (i % 3 === 0) { c.strokeStyle = rgba(hex('#b07a10'), 0.8); c.lineWidth = 0.05 * L; c.beginPath(); c.moveTo(b0[0], b0[1]); c.lineTo(lerp(b0[0], b1[0], 0.7), lerp(b0[1], b1[1], 0.7) - 0.15 * L); c.stroke(); }
    }
    c.fillStyle = rgba(LT, 0.4); c.beginPath(); c.ellipse(hd[0] - 0.6 * L, hd[1] - 2.2 * L, 0.6 * L, 0.2 * L, -0.4, 0, TAU); c.fill();
    sc.dandeHead = [hd[0], hd[1] - 1.2 * L];
    // a seed clock behind, half its parachutes gone
    if (!sc.portrait || sc.W > 360) {
      const cb = sc.plane(sc.xd + 4.2 * L, 0.8);
      const ch = Math.min(top * 0.5, hH * 1.05);
      const cpts = []; const lean2 = -R.r(0.5, 1.5) * L;
      for (let i = 0; i <= 10; i++) { const t = i / 10; cpts.push([cb[0] + lean2 * t * t, cb[1] - ch * t]); }
      c.fillStyle = rgba(hex('#8a9a5a')); c.beginPath(); taper(c, cpts, () => 0.3 * L); c.fill();
      const cc = cpts[10]; const rr = 2.3 * L;
      c.strokeStyle = rgba(P.graphite, 0.45); c.lineWidth = 0.4;
      c.fillStyle = rgba(hex('#fbf7ec'), 0.85);
      for (let k = 0; k < 36; k++) {
        const a = R.r(0, TAU); if (a > 0.3 && a < 1.4 && R.chance(0.85)) continue; // the gone ones
        const ex = cc[0] + Math.cos(a) * rr, ey = cc[1] + Math.sin(a) * rr;
        c.beginPath(); c.moveTo(cc[0] + Math.cos(a) * 0.3 * L, cc[1] + Math.sin(a) * 0.3 * L); c.lineTo(ex, ey); c.stroke();
        c.beginPath(); c.arc(ex, ey, 0.45 * L, a - 1.1, a + 1.1); c.stroke();
        for (let j = -2; j <= 2; j++) { c.beginPath(); c.moveTo(ex, ey); c.lineTo(ex + Math.cos(a + j * 0.4) * 0.45 * L, ey + Math.sin(a + j * 0.4) * 0.45 * L); c.stroke(); }
      }
      c.fillStyle = rgba(hex('#7a6040')); c.beginPath(); c.arc(cc[0], cc[1], 0.35 * L, 0, TAU); c.fill();
      // one parachute drifting off
      const fx = cc[0] + 3 * L, fy = cc[1] - 1.4 * L;
      c.beginPath(); c.moveTo(fx, fy); c.lineTo(fx - 0.6 * L, fy + 1.0 * L); c.stroke();
      for (let j = -3; j <= 3; j++) { c.beginPath(); c.moveTo(fx, fy); c.lineTo(fx + Math.sin(j * 0.35) * 0.5 * L, fy - Math.cos(j * 0.35) * 0.5 * L); c.stroke(); }
      c.fillStyle = rgba(hex('#7a6040')); c.beginPath(); c.ellipse(fx - 0.65 * L, fy + 1.1 * L, 0.06 * L, 0.14 * L, 0.5, 0, TAU); c.fill();
    }
  }

  function paintSandal(c, sc, R) {
    const { L, W } = sc;
    const p = sc.plane(sc.xs, 0.35);
    const len = 15 * L, wid = 5.2 * L;
    c.save(); c.translate(p[0], p[1] - wid * 0.5 + 0.2 * L); c.rotate(-0.04);
    // shadow
    c.fillStyle = rgba(hex('#2a2a14'), 0.35); c.beginPath(); c.ellipse(-0.5 * L, wid * 0.52, len * 0.5, 0.5 * L, 0, 0, TAU); c.fill();
    // leather straps behind the sole
    c.strokeStyle = rgba(hex('#6a3a20')); c.lineWidth = 1.0 * L; c.lineCap = 'round';
    c.beginPath(); c.moveTo(-len * 0.35, -wid * 0.45); c.quadraticCurveTo(-len * 0.3, -wid * 1.05, -len * 0.15, -wid * 0.45); c.stroke();
    c.beginPath(); c.moveTo(len * 0.12, -wid * 0.48); c.quadraticCurveTo(len * 0.2, -wid * 1.1, len * 0.32, -wid * 0.45); c.stroke();
    c.strokeStyle = rgba(hex('#a06a40'), 0.6); c.lineWidth = 0.2 * L;
    c.beginPath(); c.moveTo(len * 0.13, -wid * 0.55); c.quadraticCurveTo(len * 0.2, -wid * 1.0, len * 0.3, -wid * 0.55); c.stroke();
    // buckle
    c.strokeStyle = rgba(hex('#c9a040')); c.lineWidth = 0.22 * L; c.strokeRect(-len * 0.29, -wid * 0.98, 0.9 * L, 0.7 * L);
    // the sole outline (foot shape), seen from below as it lies on its side
    const sole = (k) => {
      c.beginPath();
      c.moveTo(-len * 0.5 * k, 0);
      c.bezierCurveTo(-len * 0.5 * k, -wid * 0.42 * k, -len * 0.3 * k, -wid * 0.42 * k, -len * 0.12 * k, -wid * 0.36 * k);
      c.bezierCurveTo(len * 0.1 * k, -wid * 0.3 * k, len * 0.3 * k, -wid * 0.55 * k, len * 0.45 * k, -wid * 0.42 * k);
      c.bezierCurveTo(len * 0.56 * k, -wid * 0.3 * k, len * 0.56 * k, wid * 0.3 * k, len * 0.45 * k, wid * 0.4 * k);
      c.bezierCurveTo(len * 0.3 * k, wid * 0.5 * k, len * 0.1 * k, wid * 0.3 * k, -len * 0.12 * k, wid * 0.36 * k);
      c.bezierCurveTo(-len * 0.3 * k, wid * 0.42 * k, -len * 0.5 * k, wid * 0.42 * k, -len * 0.5 * k, 0);
      c.closePath();
    };
    c.fillStyle = rgba(hex('#c49a62')); sole(1.04); c.fill(); // cork midsole rim
    c.fillStyle = rgba(hex('#3a3532')); sole(1.0); c.fill();
    c.save(); sole(1.0); c.clip();
    // herringbone tread
    c.strokeStyle = rgba(hex('#1e1b19'), 0.9); c.lineWidth = 0.18 * L;
    for (let x = -len * 0.6; x < len * 0.6; x += 0.7 * L) {
      c.beginPath(); c.moveTo(x, -wid); c.lineTo(x + 0.5 * L, 0); c.lineTo(x, wid); c.stroke();
    }
    c.strokeStyle = rgba(hex('#6a6460'), 0.6); c.lineWidth = 0.08 * L;
    for (let x = -len * 0.6; x < len * 0.6; x += 0.7 * L) { c.beginPath(); c.moveTo(x + 0.15 * L, -wid); c.lineTo(x + 0.65 * L, 0); c.lineTo(x + 0.15 * L, wid); c.stroke(); }
    // worn heel patch
    c.fillStyle = rgba(hex('#5a5450'), 0.85); c.beginPath(); c.ellipse(-len * 0.38, wid * 0.05, 1.4 * L, 1.2 * L, 0, 0, TAU); c.fill();
    // the stone that has been annoying someone all afternoon
    stone(c, R, len * 0.18, wid * 0.08, 0.32 * L, hex('#c8bca0'));
    c.restore();
    c.strokeStyle = rgba(hex('#8a6a40')); c.lineWidth = 0.6; sole(1.04); c.stroke();
    c.fillStyle = rgba(LT, 0.18); c.beginPath(); c.ellipse(-len * 0.1, -wid * 0.28, len * 0.35, 0.18 * L, -0.03, 0, TAU); c.fill();
    c.restore();
    sc.sandalPt = [p[0] + len * 0.18, p[1] - wid * 0.5];
  }

  /* --- labels: written in white gouache on the earth, pencil on the paper */
  function paintLabels(c, sc, R) {
    const { W, H, L, fr } = sc;
    const fs = clamp(L * 0.7, 11, 13);
    const boxes = [];
    const pad = 3;
    for (const ch of sc.chambers) boxes.push([ch.cx - ch.rw - 0.2 * L, ch.cy - ch.rh * 1.2 - 0.2 * L, ch.rw * 2 + 0.4 * L, ch.rh * 2.2 + 0.5 * L]);
    const ibox = (it) => it.name === 'oldgallery' ? [it.x - 6.5 * L, it.y - 1.6 * L, 13 * L, 3.2 * L] : it.name === 'rootchannel' ? [it.x - 1.3 * L, it.y - 3.7 * L, 2.6 * L, 7.4 * L] : it.name === 'worm' ? [it.x - 4.8 * L, it.y - 2.2 * L, 9.6 * L, 4.4 * L] : [it.x - it.rad, it.y - it.rad * 0.8, it.rad * 2, it.rad * 1.6];
    for (const it of sc.items) boxes.push(ibox(it));
    const m0 = sc.mole.pts[sc.mole.pts.length - 1];
    boxes.push([m0[0] - 3.5 * L, m0[1] - sc.mole.r - 0.3 * L, W - m0[0] + 4 * L, sc.mole.r * 2 + 0.6 * L]);
    boxes.push([-10, 0, sc.xb + 3 * L, sc.cutY(sc.xb) + 3.8 * L]); // blanket & its flap
    const roots = [];
    sc.oak.forEach((p, i) => { if (i % 3 === 0) { const w = sc.oakW(i / (sc.oak.length - 1)) * 0.5; roots.push([p[0] - w, p[1] - w, 2 * w, 2 * w]); } });
    sc.taproot.forEach((p, i) => { if (i % 3 === 0) { const w = sc.taprootW(i / (sc.taproot.length - 1)) * 0.5 + 0.3 * L; roots.push([p[0] - w, p[1] - w, 2 * w, 2 * w]); } });
    for (const r of roots) boxes.push(r);
    // the gravel is too busy to letter on
    let g0 = 1e9, g1 = -1e9; for (let x = 0; x <= W; x += 20) { g0 = Math.min(g0, sc.by(2, x)); g1 = Math.max(g1, sc.by(3, x)); }
    boxes.push([0, g0 - 0.3 * L, W, g1 - g0 + 0.6 * L]);
    boxes.push([0, 0, W, sc.cutY(W / 2) + 1.4 * L]); // keep labels below the turf
    boxes.push([0, H - 7.5 * L, Math.min(W * 0.45, 30 * L), 7.5 * L]); // the gallery's own label lives here
    // strata key down the right edge: reserve its patches first
    const lxK = W - 8;
    const lay = [['TOPSOIL', 0.03 + fr.b1 * 0.5], ['CLAY', (fr.b1 + fr.b2) / 2], ['GRAVEL', (fr.b2 + fr.b3) / 2], ['SAND', (fr.b3 + fr.b4) / 2], ['WATER TABLE', (fr.b4 + fr.b5) / 2 + 0.008], ['LIMESTONE', Math.min(0.965, fr.b5 + 0.06)]];
    for (const l of lay) { l.w = textWidth(c, l[0], fs * 0.78, { upright: true, spacing: 0.16 }); l.y = sc.yf(l[1]); boxes.push([lxK - l.w - 6, l.y - fs * 0.95, l.w + 12, fs * 1.4]); }
    if (sc.extras) for (const e of sc.extras) boxes.push(e.box);
    { // the loupe rests over the queen: keep lettering out from under it
      const lr = clamp(Math.min(W, H) * 0.12, 62, 132) + 6, q = sc.Q, qx = q.cx - (q.cx > sc.E[0] ? 0.75 : -0.75) * L, qy = sc.floorY(q, q.cx) - 1.05 * L;
      boxes.push([qx - lr, qy - lr, 2 * lr, 2 * lr]);
    }
    const leaders = [], lboxes = [];
    const subj = sc.items.map(ibox);
    const ov = (b, o) => b[0] < o[0] + o[2] && b[0] + b[2] > o[0] && b[1] < o[1] + o[3] && b[1] + b[3] > o[1];
    const hit = (b) => { for (const o of boxes) if (ov(b, o)) return true; return false; };
    const segHitsBox = (x0, y0, x1, y1, b, skip) => { for (let k = 1; k < 12; k++) { const t = k / 12, x = lerp(x0, x1, t), y = lerp(y0, y1, t); if (x > b[0] && x < b[0] + b[2] && y > b[1] && y < b[1] + b[3]) return true; } return false; };
    const nearTunnel = (b) => {
      for (const t of sc.tunnels) for (let i = 0; i < t.pts.length; i += 2) { const p = t.pts[i]; const m = sc.tw * 0.75; if (p[0] > b[0] - m && p[0] < b[0] + b[2] + m && p[1] > b[1] - m && p[1] < b[1] + b[3] + m) return true; }
      return false;
    };
    const patch = (b) => {
      // a clean patch of board left for the lettering: soft-edged, a little irregular
      c.save();
      c.shadowColor = rgba(P.paper, 0.85); c.shadowBlur = fs * 0.9;
      c.fillStyle = rgba(P.paper, 0.86);
      c.beginPath();
      const x0 = b[0] - 2, y0 = b[1] - 1, x1 = b[0] + b[2] + 2, y1 = b[1] + b[3] + 1, rr = b[3] * 0.45;
      c.moveTo(x0 + rr, y0 + R.r(-0.6, 0.6)); c.lineTo(x1 - rr, y0 + R.r(-0.6, 0.6)); c.quadraticCurveTo(x1, y0, x1, y0 + rr); c.lineTo(x1 + R.r(-0.6, 0.6), y1 - rr);
      c.quadraticCurveTo(x1, y1, x1 - rr, y1); c.lineTo(x0 + rr, y1 + R.r(-0.6, 0.6)); c.quadraticCurveTo(x0, y1, x0, y1 - rr); c.lineTo(x0 + R.r(-0.6, 0.6), y0 + rr); c.quadraticCurveTo(x0, y0, x0 + rr, y0);
      c.fill(); c.shadowBlur = 0; c.fill();
      c.restore();
    };
    const pending = [];
    const label = (txt, ax, ay, pri, prefer) => {
      if (sc.portrait && pri > 2) return;
      const w = textWidth(c, txt, fs) + 6, h = fs * 1.35;
      const dirs = prefer || [[1, -1], [-1, -1], [1, 1], [-1, 1], [0, -1], [0, 1], [1, 0], [-1, 0], [1, -0.5], [-1, -0.5], [1, 0.5], [-1, 0.5], [0.5, -1], [-0.5, 1]];
      let best = null;
      for (const dist of [0.6, 1.0, 1.5, 2.1, 2.8, 3.6, 4.6, 5.8, 7.2]) {
        for (const d of dirs) {
          const ox = ax + d[0] * dist * L * 1.3, oy = ay + d[1] * dist * L;
          const bx = d[0] > 0 ? ox : d[0] < 0 ? ox - w : ox - w / 2;
          const by = oy - h / 2;
          const b = [bx - pad, by - pad, w + 2 * pad, h + 2 * pad];
          if (bx < 6 || bx + w > W - 6 || by < 4 || by + h > H - 4) continue;
          if (hit(b) || nearTunnel(b)) continue;
          const lx = d[0] > 0 ? bx : d[0] < 0 ? bx + w : bx + w / 2;
          const ly = d[1] === 0 ? by + h * 0.55 : d[1] < 0 ? by + h : by;
          let bad = false;
          for (const sg of leaders) if (segHitsBox(sg[0], sg[1], sg[2], sg[3], b)) { bad = true; break; }
          if (!bad) for (const o of lboxes) if (segHitsBox(lx, ly, ax, ay, o)) { bad = true; break; }
          if (!bad) for (const o of subj) if (segHitsBox(lx, ly, ax, ay, o)) { const own = ax >= o[0] && ax <= o[0] + o[2] && ay >= o[1] && ay <= o[1] + o[3]; if (!own) { bad = true; break; } }
          if (bad) continue;
          const len = Math.hypot(lx - ax, ly - ay);
          if (!best || len < best.len - 0.5) best = { b, bx, by, lx, ly, len };
        }
        if (best) break;
      }
      if (!best) return;
      boxes.push(best.b); lboxes.push(best.b); leaders.push([best.lx, best.ly, ax, ay]);
      pending.push(() => {
        // leader: a fine cream line with a dark edge so it reads on any ground
        c.lineCap = 'round';
        c.strokeStyle = 'rgba(16,10,6,0.45)'; c.lineWidth = 1.8;
        c.beginPath(); c.moveTo(best.lx, best.ly); c.lineTo(ax, ay); c.stroke();
        c.strokeStyle = rgba(P.paper, 0.9); c.lineWidth = 0.8;
        c.beginPath(); c.moveTo(best.lx, best.ly); c.lineTo(ax, ay); c.stroke();
        c.fillStyle = 'rgba(16,10,6,0.6)'; c.beginPath(); c.arc(ax, ay, 2.2, 0, TAU); c.fill();
        c.fillStyle = rgba(P.paper); c.beginPath(); c.arc(ax, ay, 1.4, 0, TAU); c.fill();
        patch([best.bx, best.by, w, h]);
        handText(c, R, txt, best.bx + 3, best.by + h * 0.76, fs, P.graphite, { alpha: 0.95 });
      });
    };
    const chs = (job) => sc.chambers.filter((c2) => c2.job === job);
    const Q = sc.Q;
    const top = (ch) => [ch.cx + ch.rw * R.r(-0.3, 0.3), ch.cy - ch.rh * 0.8];
    label('Her Majesty', Q.cx + Q.rw * 0.25, Q.cy - Q.rh * 0.75, 0, [[1, -1], [-1, -1], [1, 1], [-1, 1]]);
    const inside = (ch, txt) => {
      // lettered on the chamber's own back wall, above the traffic, when it fits
      let lines = [txt];
      let w = textWidth(c, txt, fs) + 6;
      if (w > ch.rw * 1.85 && txt.indexOf(', ') > 0) { lines = [txt.slice(0, txt.indexOf(', ') + 1), txt.slice(txt.indexOf(', ') + 2)]; w = Math.max(textWidth(c, lines[0], fs), textWidth(c, lines[1], fs)) + 6; }
      if (w > ch.rw * 1.9) return false;
      const h = fs * 1.35 * lines.length - (lines.length - 1) * fs * 0.15;
      const bx = ch.cx - w / 2, by = ch.cy - ch.rh * (lines.length > 1 ? 0.55 : 0.5) - h / 2;
      const b = [bx - 2, by - 2, w + 4, h + 4];
      for (const o of lboxes) if (ov(b, o)) return false;
      lboxes.push(b);
      pending.push(() => { patch([bx, by, w, h]); lines.forEach((ln, k) => handText(c, R, ln, bx + 3, by + fs * 1.03 + k * fs * 1.2, fs, P.graphite, { alpha: 0.95 })); });
      return true;
    };
    const once = (job, txt, pri, short) => { const c2 = chs(job)[0]; if (c2) { if (inside(c2, txt) || (short && inside(c2, short))) return; const t2 = top(c2); label(txt, t2[0], t2[1], pri); } };
    once('alates', 'winged queens and males, waiting for weather', 0, 'flying ants, waiting for weather');
    once('crumbs', 'crumbs (arrived 1.06 pm)', 0);
    once('eggs', 'eggs', 1);
    once('larvae', 'larvae, sorted by size', 1);
    once('pupae', 'pupae in their cocoons', 1);
    once('seeds', 'seed store', 1);
    once('pasture', 'root aphids, kept for honeydew', 1);
    once('midden', 'midden', 2);
    const items = {};
    for (const it of sc.items) items[it.name] = it;
    const il = (n, txt, pri) => { const it = items[n]; if (it) label(txt, it.x + (it.anchor ? it.anchor[0] : 0), it.y + (it.anchor ? it.anchor[1] : 0), pri); };
    il('toad', 'toad, retired for the season', 1);
    label('mole (approaching)', m0[0] - 1.5 * L, m0[1] - 1.0 * L, 1, [[-1, -1], [-1, 1], [0, -1], [0, 1], [-1, 0]]);
    il('key', 'front door key, lost Thursday', 1);
    il('soldier', 'tin soldier, missing since 1953', 1);
    il('coin', 'penny, 1797', 1);
    il('pipe', 'clay pipe, c. 1860', 2);
    il('mammoth', 'horseshoe, c. 1890', 2);
    il('arrow', 'flint arrowhead, c. 2500 BC', 2);
    il('bottle', 'time capsule, buried on Coronation Day, 1911', 2);
    il('ammonite', 'ammonite, 180 million years', 2);
    il('wormball', 'earthworm, knotted up until it rains', 2);
    il('oldgallery', 'old gallery, given up after a wet winter', 1);
    { const se = sc.sinker[sc.sinker.length - 1]; label('oak root, drinking at the water table', se[0], se[1] - 0.6 * L, 1); }
    il('rootchannel', 'old root channel, stained with iron', 2);
    il('acorn', 'acorn, buried by a jay and forgotten', 2);
    il('woodlice', 'woodlice, keeping out of the sun', 2);
    il('worm', 'earthworm', 2);
    il('cap', 'bottle cap, 1987', 3);
    il('marble', 'marble (a good one)', 3);
    il('grub', 'chafer grub', 3);
    il('centipede', 'centipede (not invited)', 3);

    for (const f of pending) f();
    // strata names down the right edge, small caps
    const lx = lxK;
    for (const l of lay) {
      const tw2 = textWidth(c, l[0], fs * 0.78, { upright: true, spacing: 0.16 }), yy = sc.yf(l[1]);
      patch([lx - tw2 - 3, yy - fs * 0.82, tw2 + 6, fs * 1.1]);
      handText(c, R, l[0], lx, yy, fs * 0.78, P.graphite, { upright: true, spacing: 0.16, align: 'right', alpha: 0.85 });
    }
    // title & scale on the paper sky
    const tfs = clamp(L * 1.5, 19, 30);
    const tx = sc.portrait ? 14 : 1.8 * L, al = 'left';
    const ty = clamp(sc.top * 0.2, tfs * 1.1, tfs * 1.8);
    handText(c, R, 'Under the Picnic.', tx, ty, tfs, P.graphite, { align: al, alpha: 0.92 });
    handText(c, R, 'A meadow in section,', tx, ty + tfs * 0.8, fs, P.graphite, { align: al, alpha: 0.85 });
    handText(c, R, 'late August, a quarter past one.', tx, ty + tfs * 0.8 + fs * 1.2, fs, P.graphite, { align: al, alpha: 0.85 });
    // scale bar: ten ant-lengths
    const bw = 10 * L, sy = ty + tfs * 0.8 + fs * 2.3;
    const sx = tx;
    c.strokeStyle = rgba(P.graphite, 0.85); c.lineWidth = 0.8;
    c.strokeRect(sx, sy, bw, 0.28 * L);
    for (let k = 0; k < 10; k += 2) { c.fillStyle = rgba(P.graphite, 0.8); c.fillRect(sx + k * L, sy, L, 0.28 * L); }
    handText(c, R, 'ten ant-lengths', sx, sy + 0.28 * L + fs * 1.05, fs * 0.85, P.graphite, { alpha: 0.75 });
  }

  function finishBoard(c, sc, R, S) {
    const { W, H } = sc;
    // paper grain and pigment granulation over everything
    const t1 = grainTile(R, 256, [40, 28, 20], [255, 248, 230], 0.22);
    c.save(); c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalAlpha = 0.35; c.fillStyle = c.createPattern(t1, 'repeat'); c.fillRect(0, 0, W * S, H * S);
    c.restore();
    // soft vignette on the underground
    const g = c.createRadialGradient(W * 0.5, H * 0.55, Math.min(W, H) * 0.3, W * 0.5, H * 0.55, Math.max(W, H) * 0.85);
    g.addColorStop(0, 'rgba(12,8,5,0)'); g.addColorStop(1, 'rgba(12,8,5,0.35)');
    c.fillStyle = g; c.beginPath(); c.moveTo(0, sc.cutY(0)); for (let x = 0; x <= W; x += 8) c.lineTo(x, sc.cutY(x)); c.lineTo(W, H); c.lineTo(0, H); c.closePath(); c.fill();
  }

  /* ================================================================= ANTS */
  function makeMorph(kind) {
    const m = { kind };
    const el = (p, cx, cy, rx, ry, rot) => p.ellipse(cx, cy, rx, ry, rot, 0, TAU);
    const g = new Path2D(), pet = new Path2D(), meso = new Path2D(), head = new Path2D(), mand = new Path2D();
    let G, H, legs, ant, carry, mesoPts;
    if (kind === 'queen') {
      G = [-0.36, -0.215, 0.27, 0.17, -0.18]; H = [0.215, -0.26, 0.085, 0.075, 0.3];
      mesoPts = [[-0.08, -0.15], [-0.09, -0.24], [-0.03, -0.29], [0.04, -0.31], [0.11, -0.29], [0.15, -0.25], [0.13, -0.18], [0.05, -0.15]];
      legs = [[0.1, -0.165, 0.14, 0.15, 0.21, 1], [0.03, -0.155, 0.15, 0.16, 0.05, -1], [-0.04, -0.158, 0.18, 0.19, -0.18, -1]];
      ant = [0.26, -0.3, 0.13, 0.16]; carry = [0.34, -0.2];
    } else if (kind === 'male') {
      G = [-0.29, -0.21, 0.16, 0.1, -0.25]; H = [0.21, -0.27, 0.07, 0.065, 0.25];
      mesoPts = [[-0.08, -0.16], [-0.08, -0.25], [-0.02, -0.31], [0.05, -0.33], [0.12, -0.3], [0.15, -0.26], [0.12, -0.18], [0.04, -0.16]];
      legs = [[0.1, -0.17, 0.16, 0.18, 0.25, 1], [0.03, -0.16, 0.18, 0.2, 0.06, -1], [-0.04, -0.162, 0.22, 0.24, -0.22, -1]];
      ant = [0.255, -0.31, 0.12, 0.2]; carry = [0.3, -0.22];
    } else if (kind === 'gyne') {
      G = [-0.33, -0.21, 0.23, 0.15, -0.22]; H = [0.215, -0.26, 0.088, 0.077, 0.3];
      mesoPts = [[-0.08, -0.155], [-0.09, -0.245], [-0.03, -0.3], [0.04, -0.32], [0.11, -0.29], [0.15, -0.25], [0.13, -0.18], [0.05, -0.155]];
      legs = [[0.1, -0.165, 0.14, 0.15, 0.21, 1], [0.03, -0.155, 0.15, 0.16, 0.05, -1], [-0.04, -0.158, 0.18, 0.19, -0.18, -1]];
      ant = [0.26, -0.3, 0.13, 0.17]; carry = [0.34, -0.2];
    } else {
      G = [-0.31, -0.2, 0.2, 0.15, -0.3]; H = [0.225, -0.255, 0.095, 0.08, 0.3];
      mesoPts = [[-0.075, -0.16], [-0.08, -0.225], [-0.035, -0.24], [0.0, -0.25], [0.05, -0.285], [0.11, -0.28], [0.15, -0.25], [0.13, -0.19], [0.07, -0.165], [0.0, -0.152]];
      legs = [[0.105, -0.175, 0.17, 0.19, 0.26, 1], [0.035, -0.165, 0.18, 0.2, 0.07, -1], [-0.04, -0.168, 0.22, 0.25, -0.24, -1]];
      ant = [0.28, -0.3, 0.16, 0.2]; carry = [0.38, -0.2];
    }
    el(g, G[0], G[1], G[2], G[3], G[4]);
    el(pet, -0.095, -0.205, 0.026, 0.052, -0.25);
    closedSmooth(meso, mesoPts);
    el(head, H[0], H[1], H[2], H[3], H[4]);
    mand.moveTo(H[0] + H[2] * 0.75, H[1] + H[3] * 0.5); mand.lineTo(H[0] + H[2] * 1.45, H[1] + H[3] * 0.85); mand.lineTo(H[0] + H[2] * 0.9, H[1] + H[3] * 1.0); mand.closePath();
    m.g = g; m.pet = pet; m.meso = meso; m.head = head; m.mand = mand;
    m.G = G; m.H = H;
    // highlights
    const hg = new Path2D(); hg.ellipse(G[0] + 0.02, G[1] - G[3] * 0.25, G[2] * 0.62, G[3] * 0.48, G[4], Math.PI * 1.08, Math.PI * 1.72);
    m.hg = hg;
    const hh = new Path2D(); hh.ellipse(H[0] - 0.01, H[1] - H[3] * 0.45, H[2] * 0.45, H[3] * 0.22, H[4], 0, TAU); m.hh = hh;
    const hm = new Path2D(); hm.ellipse(0.06, -0.27, 0.05, 0.014, -0.3, 0, TAU); m.hm = hm;
    // gaster bands (segment margins)
    const bands = new Path2D();
    for (let k = 1; k <= 3; k++) { const x = G[0] + G[2] * (0.5 - k * 0.33); bands.ellipse(x, G[1] + (x - G[0]) * Math.tan(G[4]) * -0.0, G[2] * 0.12, G[3] * 0.95, G[4], -Math.PI / 2.4, Math.PI / 2.4); }
    m.bands = bands;
    const hairs = new Path2D();
    for (let k = 0; k < 7; k++) { const a = Math.PI * (0.95 + k * 0.12); const x = G[0] + Math.cos(a + G[4]) * G[2], y = G[1] + Math.sin(a + G[4]) * G[3]; hairs.moveTo(x, y); hairs.lineTo(x + Math.cos(a + G[4]) * 0.02, y + Math.sin(a + G[4]) * 0.02 - 0.006); }
    m.hairs = hairs;
    m.eye = [H[0] + H[2] * 0.15, H[1] - H[3] * 0.2, kind === 'male' ? 0.04 : 0.026];
    m.legs = legs; m.ant = ant; m.carry = carry;
    m.wings = kind === 'male' || kind === 'gyne';
    if (m.wings) {
      const w1 = new Path2D(), w2 = new Path2D();
      const wl = kind === 'male' ? 0.72 : 0.78;
      w1.moveTo(0.02, -0.29); w1.bezierCurveTo(-0.15, -0.38, -wl + 0.1, -0.36, -wl, -0.28); w1.bezierCurveTo(-wl + 0.05, -0.22, -0.2, -0.24, 0.02, -0.27); w1.closePath();
      w2.moveTo(0.0, -0.27); w2.bezierCurveTo(-0.15, -0.31, -wl + 0.22, -0.3, -wl + 0.15, -0.24); w2.bezierCurveTo(-wl + 0.2, -0.2, -0.2, -0.22, 0.0, -0.26); w2.closePath();
      const veins = new Path2D();
      veins.moveTo(0.0, -0.29); veins.lineTo(-wl * 0.55, -0.335); veins.lineTo(-wl + 0.08, -0.31);
      veins.moveTo(-0.08, -0.3); veins.lineTo(-wl * 0.45, -0.3); veins.lineTo(-wl * 0.62, -0.27);
      veins.moveTo(-wl * 0.45, -0.3); veins.lineTo(-wl * 0.5, -0.335);
      m.w1 = w1; m.w2 = w2; m.veins = veins; m.stigma = [-wl * 0.52, -0.33];
    }
    if (kind === 'queen') {
      const pb = new Path2D();
      for (let k = 0; k < 4; k++) { const x = G[0] + G[2] * (0.62 - k * 0.38); pb.moveTo(x + 0.03, G[1] - G[3] * 1.1); pb.quadraticCurveTo(x - 0.035, G[1], x + 0.03, G[1] + G[3] * 1.1); }
      m.pale = pb;
    }
    return m;
  }

  function legIK(hx, hy, fx, fy, lf, lt) {
    let dx = fx - hx, dy = fy - hy; let d = Math.hypot(dx, dy);
    const md = (lf + lt) * 0.985;
    if (d > md) { fx = hx + dx / d * md; fy = hy + dy / d * md; dx = fx - hx; dy = fy - hy; d = md; }
    const a = Math.atan2(dy, dx);
    const cb = clamp((lf * lf + d * d - lt * lt) / (2 * lf * d), -1, 1);
    const b = Math.acos(cb);
    const k1x = hx + lf * Math.cos(a - b), k1y = hy + lf * Math.sin(a - b);
    const k2x = hx + lf * Math.cos(a + b), k2y = hy + lf * Math.sin(a + b);
    return k1y < k2y ? [k1x, k1y, fx, fy] : [k2x, k2y, fx, fy];
  }

  const ANT_COL = { body: '#2b1a12', gaster: '#23150e', leg: '#2a1810', far: 'rgba(78,54,38,0.85)', hi: 'rgba(226,182,130,0.72)' };

  function drawAnt(c, a, t, k, pxs) {
    const m = a.m;
    c.save();
    c.translate(a.rx, a.ry); c.rotate(a.rang); if (a.rflip) c.scale(1, -1);
    c.scale(k, k);
    const zoomPx = k * pxs;
    const lw = Math.max(0.034, 0.8 / zoomPx);
    const walking = a.state === 'walk';
    const A = 0.07;
    c.lineCap = 'round'; c.lineJoin = 'round';
    // contact shadow
    c.fillStyle = 'rgba(30,16,8,0.22)'; c.beginPath(); c.ellipse(-0.05, -0.005, 0.38, 0.035, 0, 0, TAU); c.fill();
    const lift = m.kind === 'worker' ? 0.05 : 0.03;
    c.translate(0, -lift);
    // legs
    const legPath = (far) => {
      const p = c; c.beginPath();
      for (let i = 0; i < 3; i++) {
        const L = m.legs[i];
        const tri = (i === 1 ? 1 : 0) ^ (far ? 1 : 0);
        let ph = a.phase + tri * 0.5; ph -= Math.floor(ph);
        let fx, fy;
        if (walking) {
          if (ph < 0.5) { fx = L[4] + A - 4 * A * ph; fy = 0; }
          else { fx = L[4] - A + 4 * A * (ph - 0.5); fy = -0.06 * Math.sin((ph - 0.5) * 2 * Math.PI); }
        } else { fx = L[4] + (far ? -0.02 : 0.015) * (i - 1); fy = 0; }
        fy += lift;
        let hx = L[0], hy = L[1];
        if (far) { hx -= 0.012; hy -= 0.01; fx -= 0.03; fy -= 0.02; }
        if (a.groom && i === 0 && !far) { fx = 0.3; fy = -0.32 + 0.03 * Math.sin(t * 12); }
        const kk = legIK(hx, hy, fx, fy, L[2], L[3]);
        p.moveTo(hx, hy); p.lineTo(kk[0], kk[1]); p.lineTo(kk[2], kk[3]);
        p.lineTo(kk[2] + L[5] * 0.065, kk[3] + 0.004);
      }
    };
    c.strokeStyle = ANT_COL.far; c.lineWidth = lw * 0.9; legPath(true); c.stroke();
    // far antenna
    const an = m.ant;
    const touch = a.state === 'touch' ? 1 : 0;
    const wave = (ph, sp) => Math.sin(t * sp + a.seedPh + ph);
    const antPath = (far) => {
      const p = c; c.beginPath();
      const s1 = -1.1 + 0.14 * wave(far ? 1.3 : 0, 2.3) + touch * 0.45 - (a.state === 'dwell' ? 0.15 : 0);
      const ex = an[0] + Math.cos(s1) * an[2] - (far ? 0.015 : 0), ey = an[1] + Math.sin(s1) * an[2];
      const f1 = s1 + 1.35 + 0.3 * wave(far ? 2.1 : 0.4, 3.1) - touch * 0.45 + touch * 0.25 * wave(far ? 1 : 0, 19);
      const tx = ex + Math.cos(f1) * an[3], ty = ey + Math.sin(f1) * an[3];
      p.moveTo(an[0], an[1]); p.lineTo(ex, ey); p.quadraticCurveTo(ex + Math.cos(f1 - 0.25) * an[3] * 0.55, ey + Math.sin(f1 - 0.25) * an[3] * 0.55, tx, ty);
    };
    c.strokeStyle = ANT_COL.far; c.lineWidth = lw * 0.75; antPath(true); c.stroke();
    // wings sit behind for alates
    if (m.wings && !a.dealate) {
      c.fillStyle = 'rgba(228,232,236,0.28)'; c.fill(m.w2);
    }
    // body
    c.fillStyle = a.col || ANT_COL.gaster; c.fill(m.g);
    if (m.pale) { c.save(); c.clip(m.g); c.strokeStyle = 'rgba(206,176,128,0.9)'; c.lineWidth = 0.028; c.stroke(m.pale); c.strokeStyle = 'rgba(60,36,22,0.9)'; c.lineWidth = 0.012; c.stroke(m.pale); c.restore(); }
    if (a.full) { c.fillStyle = 'rgba(214,150,60,0.45)'; c.fill(m.g); }
    c.fillStyle = a.col || ANT_COL.body; c.fill(m.pet); c.fill(m.meso); c.fill(m.head); c.fill(m.mand);
    // near legs
    c.strokeStyle = a.legCol || ANT_COL.leg; c.lineWidth = lw; legPath(false); c.stroke();
    // highlights
    c.save(); c.globalAlpha = 0.16; c.fillStyle = '#e8c49a'; c.translate(m.G[0], m.G[1] - m.G[3] * 0.3); c.scale(0.7, 0.45); c.translate(-m.G[0], -m.G[1]); c.fill(m.g); c.restore();
    c.strokeStyle = ANT_COL.hi; c.lineWidth = 0.028; c.stroke(m.hg);
    c.fillStyle = 'rgba(222,176,124,0.45)'; c.fill(m.hh); c.fill(m.hm);
    if (zoomPx > 22) {
      c.strokeStyle = 'rgba(160,120,90,0.35)'; c.lineWidth = Math.max(0.01, 0.6 / zoomPx); c.stroke(m.bands);
      c.strokeStyle = 'rgba(60,40,26,0.55)'; c.stroke(m.hairs);
    }
    c.fillStyle = 'rgba(255,244,226,0.9)'; c.beginPath(); c.arc(m.G[0] + 0.03, m.G[1] - m.G[3] * 0.55, 0.018, 0, TAU); c.fill();
    // eye
    c.fillStyle = '#0c0705'; c.beginPath(); c.ellipse(m.eye[0], m.eye[1], m.eye[2], m.eye[2] * 0.78, 0, 0, TAU); c.fill();
    c.fillStyle = 'rgba(255,255,255,0.9)'; c.beginPath(); c.arc(m.eye[0] - m.eye[2] * 0.3, m.eye[1] - m.eye[2] * 0.3, m.eye[2] * 0.3, 0, TAU); c.fill();
    if (m.wings && !a.dealate) {
      c.fillStyle = 'rgba(236,240,244,0.38)'; c.fill(m.w1);
      c.strokeStyle = 'rgba(70,58,46,0.55)'; c.lineWidth = Math.max(0.008, 0.5 / zoomPx); c.stroke(m.w1); c.stroke(m.veins);
      c.fillStyle = 'rgba(70,50,36,0.8)'; c.beginPath(); c.ellipse(m.stigma[0], m.stigma[1], 0.03, 0.01, 0, 0, TAU); c.fill();
      c.fillStyle = 'rgba(255,255,255,0.4)'; c.beginPath(); c.ellipse(-0.25, -0.33, 0.12, 0.008, -0.05, 0, TAU); c.fill();
    }
    // near antenna
    c.strokeStyle = a.legCol || ANT_COL.leg; c.lineWidth = lw * 0.85; antPath(false); c.stroke();
    // the thing she carries
    if (a.carry) drawCarry(c, a.carry, m.carry[0], m.carry[1], a.carrySeed);
    c.restore();
  }

  function drawCarry(c, kind, x, y, sd) {
    c.save(); c.translate(x, y); c.scale(1.5, 1.5);
    if (kind === 'crumb') {
      c.fillStyle = '#efdcae'; c.beginPath(); c.moveTo(-0.06, -0.08); c.lineTo(0.09, -0.1); c.lineTo(0.13, 0.04); c.lineTo(0.02, 0.1); c.lineTo(-0.08, 0.05); c.closePath(); c.fill();
      c.fillStyle = '#a86426'; c.beginPath(); c.moveTo(0.09, -0.1); c.lineTo(0.13, 0.04); c.lineTo(0.08, 0.0); c.closePath(); c.fill();
    } else if (kind === 'seed') {
      c.fillStyle = '#c7a660'; c.beginPath(); c.ellipse(0.04, 0, 0.13, 0.05, 0.3, 0, TAU); c.fill();
      c.fillStyle = 'rgba(255,250,230,0.8)'; c.beginPath(); c.arc(0.0, -0.02, 0.012, 0, TAU); c.fill();
    } else if (kind === 'egg') {
      c.fillStyle = '#f6f1e2'; c.beginPath(); c.ellipse(0.04, 0, 0.06, 0.042, 0.4, 0, TAU); c.fill();
    } else if (kind === 'larva') {
      c.fillStyle = '#f2ead2'; c.beginPath(); c.ellipse(0.06, 0.02, 0.1, 0.07, 0.6, 0, TAU); c.fill();
      c.strokeStyle = 'rgba(176,160,128,0.8)'; c.lineWidth = 0.012; c.stroke();
    } else if (kind === 'pupa') {
      c.fillStyle = '#d8bf8a'; c.beginPath(); c.ellipse(0.1, 0.02, 0.15, 0.065, 0.2, 0, TAU); c.fill();
      c.fillStyle = '#3a2a1a'; c.beginPath(); c.arc(0.22, 0.04, 0.025, 0, TAU); c.fill();
    } else if (kind === 'pellet') {
      c.fillStyle = '#a8683a'; c.beginPath(); c.arc(0.05, 0, 0.075, 0, TAU); c.fill();
      c.fillStyle = 'rgba(255,220,180,0.5)'; c.beginPath(); c.arc(0.03, -0.03, 0.02, 0, TAU); c.fill();
    } else if (kind === 'dead') {
      c.rotate(2.6);
      c.fillStyle = '#2a1a12';
      c.beginPath(); c.ellipse(-0.18, 0, 0.12, 0.085, 0, 0, TAU); c.fill();
      c.beginPath(); c.ellipse(0.0, 0, 0.08, 0.05, 0, 0, TAU); c.fill();
      c.beginPath(); c.ellipse(0.13, 0, 0.06, 0.055, 0, 0, TAU); c.fill();
      c.strokeStyle = '#2a1a12'; c.lineWidth = 0.018;
      c.beginPath(); for (let k = 0; k < 3; k++) { c.moveTo(0.03 - k * 0.05, -0.04); c.quadraticCurveTo(0.06 - k * 0.07, -0.16, -0.02 - k * 0.05, -0.15); } c.stroke();
    }
    c.restore();
  }

  /* ------------------------------------------------------- colony life */
  function makeColony(sc, seed) {
    const R = RNG(seed ^ 0x7f4a7c15);
    const { L, V, Ed } = sc;
    const morphs = { worker: makeMorph('worker'), queen: makeMorph('queen'), male: makeMorph('male'), gyne: makeMorph('gyne') };
    // Dijkstra from a vertex, cached
    const cache = new Map();
    const dij = (src) => {
      if (cache.has(src)) return cache.get(src);
      const n = V.length, dist = new Float64Array(n).fill(1e18), via = new Int32Array(n).fill(-1), done = new Uint8Array(n);
      dist[src] = 0;
      for (;;) {
        let u = -1, best = 1e18;
        for (let i = 0; i < n; i++) if (!done[i] && dist[i] < best) { best = dist[i]; u = i; }
        if (u < 0) break; done[u] = 1;
        for (const ei of V[u].e) { const e = Ed[ei]; const v = e.a === u ? e.b : e.a; const nd = dist[u] + e.len; if (nd < dist[v]) { dist[v] = nd; via[v] = ei; } }
      }
      const r = { dist, via }; cache.set(src, r); return r;
    };
    const chByJob = (job) => sc.chambers.filter((c) => c.job === job);
    const floorOf = (ch) => Ed[ch.floor];
    const surf = {}; for (const s of sc.surfPaths) surf[s.name] = s;

    // route from (edge e, pos s) to (edge te, pos ts)
    const plan = (a, te, ts) => {
      const e = Ed[a.e];
      if (a.e === te) { a.route = [{ e: te, dir: ts >= a.s ? 1 : -1, s1: ts }]; return; }
      const T = Ed[te];
      let best = null;
      for (const w of [T.a, T.b]) {
        const D = dij(w);
        const wcost = w === T.a ? ts : T.len - ts;
        for (const u of [e.a, e.b]) {
          const ucost = u === e.a ? a.s : e.len - a.s;
          const cost = ucost + D.dist[u] + wcost;
          if (!best || cost < best.cost) best = { cost, u, w, D };
        }
      }
      if (!best || best.cost > 1e17) { a.route = []; return; }
      const route = [];
      route.push({ e: a.e, dir: best.u === e.a ? -1 : 1, s1: best.u === e.a ? 0 : e.len });
      let v = best.u, guard = 0;
      while (v !== best.w && guard++ < 500) {
        const ei = best.D.via[v]; const ed = Ed[ei];
        const toB = ed.a === v;
        route.push({ e: ei, dir: toB ? 1 : -1, s1: toB ? ed.len : 0, enter: true });
        v = toB ? ed.b : ed.a;
      }
      route.push({ e: te, dir: best.w === T.a ? 1 : -1, s1: ts, enter: true });
      a.route = route;
    };

    const ants = [];
    const mk = (morph, job, ed, s, opts) => {
      const a = Object.assign({
        m: morphs[morph], morph, job, e: ed, s, dir: R.s(), route: [], state: 'dwell', timer: R.r(0.5, 6), phase: R.f(), seedPh: R.r(0, TAU),
        speed: L * R.r(1.6, 2.6), size: R.r(0.86, 1.1), carry: null, carrySeed: R.f(), cool: R.r(0, 3), zoff: 0, rx: 0, ry: 0, rang: 0, rflip: false, init: true,
      }, opts || {});
      ants.push(a); return a;
    };
    const dens = sc.portrait ? 0.85 : 1;
    // residents
    for (const ch of sc.chambers) {
      const fe = floorOf(ch);
      let n = Math.round((fe.len / L) * ({ crumbs: 1.0, seeds: 0.9, pasture: 0.9, pupae: 1.15, larvae: 1.15, eggs: 1.1, alates: 0.75, midden: 0.45, rest: 0.8, queen: 1.0 }[ch.job] || 0.6) * dens);
      for (let i = 0; i < n; i++) {
        let morph = 'worker', job = 'resident';
        if (ch.job === 'alates') { morph = R.chance(0.45) ? 'gyne' : 'male'; job = 'alate'; }
        if (ch.job === 'queen') job = 'attendant';
        if (ch.job === 'pasture') job = 'herder';
        const a = mk(morph, job, fe.id, R.r(0.05, 0.95) * fe.len, { home: ch.id, zoff: R.chance(0.45) ? R.r(0.15, 0.45) * ch.rh : 0 });
        if (morph === 'gyne') a.size = R.r(1.55, 1.75);
        if (morph === 'male') a.size = R.r(1.1, 1.25);
        if (job === 'herder' && R.chance(0.5)) a.full = true;
        if (ch.job === 'larvae' || ch.job === 'pupae' || ch.job === 'eggs') a.size = R.r(0.8, 0.95);
      }
    }
    // the queen herself
    const Q = sc.Q, qf = floorOf(Q);
    const queen = mk('queen', 'queen', qf.id, qf.len * 0.5, { size: 2.25, dir: Q.cx > sc.E[0] ? 1 : -1, timer: 1e9, zoff: 0, dealate: true, speed: L * 0.4, col: '#3b2317' });
    queen.isQueen = true;
    // travellers
    const nT = Math.round((sc.portrait ? 75 : 165) * clamp(sc.W * sc.H / 1.6e6, 0.6, 1.4));
    const jobs = [['forager', 0.3], ['seeder', 0.12], ['builder', 0.14], ['nurse', 0.2], ['undertaker', 0.05], ['idler', 0.19]];
    const tunnelEdges = Ed.filter((e) => e.kind === 'tunnel');
    const totalLen = tunnelEdges.reduce((s, e) => s + e.len, 0);
    for (let i = 0; i < nT; i++) {
      let r = R.f(), job = 'idler';
      for (const j of jobs) { if (r < j[1]) { job = j[0]; break; } r -= j[1]; }
      let u = R.f() * totalLen, e = tunnelEdges[0];
      for (const te of tunnelEdges) { if (u < te.len) { e = te; break; } u -= te.len; }
      const a = mk('worker', job, e.id, R.r(0, e.len), { state: 'walk', timer: 0 });
      if (job === 'forager' && R.chance(0.5)) a.carry = 'crumb';
      if (job === 'builder' && R.chance(0.5)) a.carry = 'pellet';
      a.wantsNew = true;
    }
    // a gang at the crust and the apple
    for (const nm of ['crust', 'apple', 'seeds']) {
      const s = surf[nm]; if (!s || s.spotEdge === undefined) continue;
      const e = Ed[s.spotEdge];
      for (let i = 0; i < (nm === 'crust' ? 11 : nm === 'apple' ? 6 : 4); i++) mk('worker', nm === 'seeds' ? 'seeder' : 'forager', e.id, R.r(0, e.len), { timer: R.r(0.5, 4), state: 'dwell' });
    }

    const pickFloorSpot = (ch) => { const fe = floorOf(ch); return [fe.id, R.r(0.08, 0.92) * fe.len]; };
    const goto = (a, spot) => { plan(a, spot[0], spot[1]); a.state = a.route.length ? 'walk' : 'dwell'; a.timer = R.r(1, 3); };
    const surfSpot = (nm) => { const s = surf[nm]; const e = Ed[s.spotEdge !== undefined ? s.spotEdge : s.edge]; return [e.id, s.spotEdge !== undefined ? R.r(0.1, 0.9) * e.len : e.len]; };
    const randomChamber = () => R.pick(sc.chambers.filter((c) => c.job !== 'queen' && c.job !== 'alates'));
    const nextTask = (a) => {
      const ch = a.e !== undefined ? Ed[a.e].ch : undefined;
      const here = ch !== undefined ? sc.chambers[ch] : null;
      const at = (job) => here && here.job === job;
      switch (a.job) {
        case 'forager': {
          const food = R.chance(0.65) ? 'crust' : 'apple';
          if (a.carry) { if (at('crumbs')) { a.carry = null; return goto(a, surfSpot(food)); } const c2 = chByJob('crumbs')[0]; return goto(a, c2 ? pickFloorSpot(c2) : surfSpot(food)); }
          const ed = Ed[a.e]; if (ed.kind === 'surface' && ed.spotEdge) { a.carry = 'crumb'; a.carrySeed = R.f(); const c2 = chByJob('crumbs')[0]; return goto(a, c2 ? pickFloorSpot(c2) : surfSpot('crust')); }
          return goto(a, surfSpot(food));
        }
        case 'seeder': {
          const ed = Ed[a.e];
          if (a.carry) { if (at('seeds')) { a.carry = null; return goto(a, surfSpot('seeds')); } const c2 = R.pick(chByJob('seeds').length ? chByJob('seeds') : sc.chambers); return goto(a, pickFloorSpot(c2)); }
          if (ed.kind === 'surface' && ed.spotEdge) { a.carry = 'seed'; const c2 = R.pick(chByJob('seeds').length ? chByJob('seeds') : sc.chambers); return goto(a, pickFloorSpot(c2)); }
          return goto(a, surfSpot('seeds'));
        }
        case 'builder': {
          const ed = Ed[a.e];
          if (a.carry) { if (ed.kind === 'surface') { a.carry = null; return goto(a, pickFloorSpot(randomChamber())); } return goto(a, surfSpot('dump')); }
          if (here) { a.carry = 'pellet'; return goto(a, surfSpot('dump')); }
          return goto(a, pickFloorSpot(randomChamber()));
        }
        case 'nurse': {
          if (a.carry) { a.carry = null; }
          else if (here && ['queen', 'eggs', 'larvae', 'pupae'].includes(here.job)) {
            const map = { queen: ['egg', 'eggs'], eggs: ['egg', 'eggs'], larvae: ['larva', 'larvae'], pupae: ['pupa', 'pupae'] }[here.job];
            const dst = chByJob(map[1]).filter((c2) => c2 !== here);
            if (dst.length) { a.carry = map[0]; return goto(a, pickFloorSpot(R.pick(dst))); }
          }
          const src = R.pick([Q].concat(chByJob('larvae'), chByJob('pupae'), chByJob('eggs')));
          return goto(a, pickFloorSpot(src));
        }
        case 'undertaker': {
          const md = chByJob('midden')[0];
          if (a.carry) { a.carry = null; return goto(a, pickFloorSpot(randomChamber())); }
          if (here && md && here !== md) { a.carry = 'dead'; return goto(a, pickFloorSpot(md)); }
          return goto(a, pickFloorSpot(randomChamber()));
        }
        case 'idler': return goto(a, R.chance(0.15) ? surfSpot(R.pick(['crust', 'apple'])) : pickFloorSpot(randomChamber()));
        default: {
          // residents: shuffle about their own floor; occasionally visit
          if (a.home === undefined) return goto(a, pickFloorSpot(randomChamber()));
          const home = sc.chambers[a.home];
          if (a.job !== 'alate' && a.job !== 'attendant' && R.chance(0.05)) return goto(a, pickFloorSpot(randomChamber()));
          if (here !== home) return goto(a, pickFloorSpot(home));
          const fe = floorOf(home);
          const tgt = a.job === 'attendant' ? queen.s + R.r(-2.6, 2.0) * L * queen.dir : a.s + R.r(-2.5, 2.5) * L;
          plan(a, fe.id, clamp(tgt, 0.05 * fe.len, 0.95 * fe.len)); a.state = 'walk';
        }
      }
    };

    // queen attendants gather near her
    for (const a of ants) if (a.job === 'attendant') { a.s = clamp(queen.s + R.r(-2.6, 2.0) * L * queen.dir, 0.05 * qf.len, 0.95 * qf.len); a.dir = a.s > queen.s ? -1 : 1; a.timer = R.r(4, 14); }

    const life = {
      ants, queen,
      update(dt, t) {
        dt = Math.min(dt, 0.05);
        // traffic: per-edge sort for following and greeting
        const byEdge = new Map();
        for (const a of ants) { if (a.state === 'walk' || a.state === 'touch') { let l = byEdge.get(a.e); if (!l) byEdge.set(a.e, (l = [])); l.push(a); } }
        for (const [, l] of byEdge) {
          if (l.length < 2) continue;
          l.sort((p, q) => p.s - q.s);
          for (let i = 0; i < l.length - 1; i++) {
            const p = l[i], q = l[i + 1];
            const d = q.s - p.s;
            if (p.dir > 0 && q.dir < 0 && d < 0.85 * L && p.state === 'walk' && q.state === 'walk' && p.cool <= 0 && q.cool <= 0) {
              const tt = R.r(0.5, 1.3);
              p.state = q.state = 'touch'; p.timer = q.timer = tt; p.cool = q.cool = R.r(3, 7);
            }
            if (p.dir > 0 && q.dir > 0 && d < 0.95 * L * p.size) p.block = true;
            if (p.dir < 0 && q.dir < 0 && d < 0.95 * L * q.size) q.block = true;
          }
        }
        for (const a of ants) {
          a.cool -= dt;
          if (a.isQueen) { a.timer -= dt; continue; }
          if (a.state === 'touch') { a.timer -= dt; if (a.timer <= 0) a.state = 'walk'; continue; }
          if (a.state === 'dwell') {
            a.timer -= dt;
            a.groom = a.timer > 0 && (a.seedPh * 10 | 0) % 7 === 0 && a.timer < 1.2;
            if (a.timer <= 0) { a.groom = false; nextTask(a); if (a.state === 'dwell') a.timer = R.r(1, 4); }
            continue;
          }
          // walking
          if (a.wantsNew) { a.wantsNew = false; nextTask(a); continue; }
          if (!a.route.length) { a.state = 'dwell'; a.timer = dwellTime(a); continue; }
          const st = a.route[0];
          if (st.enter) { st.enter = false; a.e = st.e; a.s = st.dir > 0 ? 0 : Ed[st.e].len; a.zoff = Ed[st.e].kind === 'floor' ? (R.chance(0.4) ? R.r(0.1, 0.4) * sc.chambers[Ed[st.e].ch].rh : 0) : 0; }
          a.dir = st.dir;
          let v = a.speed * (a.carry ? 0.8 : 1) * (Ed[a.e].kind === 'surface' ? 1.15 : 1);
          if (a.block) { v *= 0.15; a.block = false; }
          const step = v * dt;
          a.s += a.dir * step;
          a.phase += step / (4 * 0.07 * L * a.size);
          if ((a.dir > 0 && a.s >= st.s1) || (a.dir < 0 && a.s <= st.s1)) { a.s = st.s1; a.route.shift(); }
        }
      },
    };
    const dwellTime = (a) => {
      const ed = Ed[a.e];
      if (ed.kind === 'surface') return R.r(0.8, 3);
      if (a.job === 'resident' || a.job === 'herder' || a.job === 'attendant' || a.job === 'alate') return R.r(3, 14);
      return R.r(0.8, 4);
    };
    // initialise: route the walkers
    for (const a of ants) if (a.state === 'walk' && !a.route.length) { a.wantsNew = false; nextTask(a); }
    life.pose = (a) => posOf(sc, a);
    return life;
  }

  function posOf(sc, a) {
    const e = sc.Ed[a.e];
    const s = clamp(a.s, 0, e.len);
    // binary search cumulative lengths
    let lo = 0, hi = e.cum.length - 1;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (e.cum[mid] <= s) lo = mid; else hi = mid; }
    const seg = e.cum[hi] - e.cum[lo] || 1, t = (s - e.cum[lo]) / seg;
    const p = e.pts[lo], q = e.pts[hi];
    const x = lerp(p[0], q[0], t), y = lerp(p[1], q[1], t);
    let ang = Math.atan2(q[1] - p[1], q[0] - p[0]);
    if (a.dir < 0) ang += Math.PI;
    if (e.flat) { const c0 = Math.cos(ang) >= 0 ? 0 : Math.PI; let d = ang - c0; d = Math.atan2(Math.sin(d), Math.cos(d)); ang = c0 + d * 0.35; }
    const flip = Math.cos(ang) < 0;
    // feet toward the wall the ant walks on
    let fx = -Math.sin(ang), fy = Math.cos(ang);
    if (flip) { fx = -fx; fy = -fy; }
    const off = e.off || 0;
    return [x + fx * off, y + fy * off - (a.zoff || 0), ang, flip];
  }

  /* ================================================================ MOUNT */
  (window.PIECES = window.PIECES || []).push({
    id: 'colony',
    title: 'Under the Picnic',
    medium: 'Gouache over pencil on cream board, with ants',
    note: 'Move the loupe over anything. The queen is at the bottom.',
    about: 'A naturalist\'s cutaway of one late-August meadow beneath a picnic blanket: an ant colony of several hundred, its granary, nurseries, aphid pasture and midden, and everything else the ground has quietly kept. Painted once, in detail meant for a magnifying glass, then left to the ants, who walk their own tunnels.',
    tone: 'dark',
    room: '#1b1510',
    mount(el, api) {
      let alive = true, raf = 0, building = 0;
      const dprCap = Math.min(2, window.devicePixelRatio || 1);
      el.style.background = '#1b1510';
      el.style.overflow = 'hidden';
      el.style.cursor = 'none';
      el.style.touchAction = 'none';
      const base = document.createElement('canvas'), live = document.createElement('canvas');
      for (const cv of [base, live]) { cv.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;display:block'; el.appendChild(cv); }
      const lc = live.getContext('2d');
      let sc = null, board = null, S = 1, life = null, W = 0, H = 0, dpr = dprCap, readyCalled = false;
      const M = 3;
      let lensSrc = null, lensCtx = null, lensKey = '';
      // loupe state
      const lens = { x: 0, y: 0, tx: 0, ty: 0, r: 100, user: false, lastMove: -1e9 };

      async function build() {
        const my = ++building;
        W = Math.max(200, el.clientWidth); H = Math.max(200, el.clientHeight);
        dpr = dprCap;
        S = Math.min(3, Math.max(dpr, Math.sqrt(18e6 / (W * H))));
        const scn = buildScene(W, H, api.seed);
        buildGraph(scn);
        const cv = document.createElement('canvas');
        cv.width = Math.round(W * S); cv.height = Math.round(H * S);
        const c = cv.getContext('2d', { willReadFrequently: true }); // CPU-backed: painted once, sampled by the loupe
        c.setTransform(S, 0, 0, S, 0, 0);
        const tasks = paintTasks(scn, c, S);
        let t0 = performance.now();
        for (const task of tasks) {
          if (!alive || my !== building) return;
          task();
          if (performance.now() - t0 > 90) { await new Promise((r) => requestAnimationFrame(r)); t0 = performance.now(); }
        }
        if (!alive || my !== building) return;
        base.width = Math.round(W * dpr); base.height = Math.round(H * dpr);
        const bc = base.getContext('2d');
        bc.imageSmoothingEnabled = true; bc.imageSmoothingQuality = 'high';
        bc.drawImage(cv, 0, 0, base.width, base.height);
        live.width = base.width; live.height = base.height;
        sc = scn; board = cv;
        life = makeColony(sc, api.seed);
        lens.r = clamp(Math.min(W, H) * 0.12, 62, 132);
        const q = sc.Q; const qa = life.queen; const qp = posOf(sc, qa); lens.rest = [qp[0] - (qa.dir > 0 ? 0.75 : -0.75) * sc.L, qp[1] - 1.05 * sc.L];
        if (!lens.user) { lens.x = lens.tx = lens.rest[0]; lens.y = lens.ty = lens.rest[1]; }
        // let the colony settle into motion before the first frame
        for (let i = 0; i < 30; i++) life.update(0.05, i * 0.05);
        frame(performance.now());
        if (!readyCalled) { readyCalled = true; api.ready(); }
      }

      let last = performance.now();
      function frame(now) {
        if (!alive) return;
        raf = requestAnimationFrame(frame);
        if (!life) return;
        if (!api.isCurrent()) return;
        const dt = Math.min(0.05, (now - last) / 1000); last = now;
        const t = now / 1000;
        life.update(dt, t);
        // smooth poses
        for (const a of life.ants) {
          const p = posOf(sc, a);
          if (a.init) { a.rx = p[0]; a.ry = p[1]; a.rang = p[2]; a.rflip = p[3]; a.init = false; }
          else {
            a.rx += (p[0] - a.rx) * 0.45; a.ry += (p[1] - a.ry) * 0.45;
            let d = p[2] - a.rang; d = Math.atan2(Math.sin(d), Math.cos(d)); a.rang += d * 0.35; a.rflip = p[3];
            if (Math.hypot(p[0] - a.rx, p[1] - a.ry) > 3 * sc.L) { a.rx = p[0]; a.ry = p[1]; }
          }
        }
        // lens drift
        if (!lens.user || (lens.touch && now - lens.lastMove > 7000)) { lens.user = false; lens.tx = lens.rest[0]; lens.ty = lens.rest[1]; }
        lens.x += (lens.tx - lens.x) * (lens.user ? 0.35 : 0.06); lens.y += (lens.ty - lens.y) * (lens.user ? 0.35 : 0.06);
        draw(t);
      }

      const order = [];
      function draw(t) {
        const c = lc;
        c.setTransform(1, 0, 0, 1, 0, 0);
        c.clearRect(0, 0, live.width, live.height);
        c.setTransform(dpr, 0, 0, dpr, 0, 0);
        order.length = 0;
        for (const a of life.ants) order.push(a);
        order.sort((p, q) => (q.zoff || 0) - (p.zoff || 0));
        for (const a of order) drawAnt(c, a, t, sc.L * a.size * (1 - (a.zoff || 0) / sc.L * 0.12), dpr);
        drawLens(c, t);
      }

      function drawLens(c, t) {
        const r = lens.r, x = lens.x, y = lens.y;
        c.save();
        // shadow of the lens on the board
        c.fillStyle = 'rgba(10,6,3,0.35)'; c.beginPath(); c.arc(x + r * 0.08, y + r * 0.12, r * 1.06, 0, TAU); c.fill();
        c.beginPath(); c.arc(x, y, r, 0, TAU); c.clip();
        const sw = (2 * r / M), px = Math.ceil(sw * S) + 2;
        // copy just the patch under the glass into a small canvas (cheap to upload), only when it moves
        if (!lensSrc || lensSrc.width !== px) { lensSrc = document.createElement('canvas'); lensSrc.width = lensSrc.height = px; lensCtx = lensSrc.getContext('2d', { willReadFrequently: true }); lensKey = ''; }
        const sx = Math.round((x - sw / 2) * S), sy = Math.round((y - sw / 2) * S), key = sx + ',' + sy;
        if (key !== lensKey) { lensKey = key; lensCtx.fillStyle = '#1b1510'; lensCtx.fillRect(0, 0, px, px); lensCtx.drawImage(board, sx, sy, px, px, 0, 0, px, px); }
        c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high';
        c.drawImage(lensSrc, 0, 0, px, px, x - r - (((x - sw / 2) * S - sx) * M / S), y - r - (((y - sw / 2) * S - sy) * M / S), px * M / S, px * M / S);
        // ants under the glass, drawn again at 3x
        c.translate(x, y); c.scale(M, M); c.translate(-x, -y);
        const rr = r / M + sc.L * 2;
        for (const a of order) { if (Math.abs(a.rx - x) < rr && Math.abs(a.ry - y) < rr) drawAnt(c, a, t, sc.L * a.size * (1 - (a.zoff || 0) / sc.L * 0.12), dpr * M); }
        c.restore();
        // glass: faint reflections
        c.save();
        c.beginPath(); c.arc(x, y, r, 0, TAU); c.clip();
        const g = c.createRadialGradient(x - r * 0.4, y - r * 0.5, r * 0.05, x, y, r);
        g.addColorStop(0, 'rgba(255,255,250,0.22)'); g.addColorStop(0.35, 'rgba(255,255,250,0.03)'); g.addColorStop(0.85, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.3)');
        c.fillStyle = g; c.fillRect(x - r, y - r, 2 * r, 2 * r);
        c.restore();
        // rim: blackened brass
        c.lineWidth = Math.max(5, r * 0.07); c.strokeStyle = '#2a221a'; c.beginPath(); c.arc(x, y, r + c.lineWidth / 2 - 1, 0, TAU); c.stroke();
        c.lineWidth = 1.5; c.strokeStyle = 'rgba(214,170,96,0.9)'; c.beginPath(); c.arc(x, y, r + 0.5, 0, TAU); c.stroke();
        c.lineWidth = 1; c.strokeStyle = 'rgba(255,230,170,0.5)'; c.beginPath(); c.arc(x, y, r + Math.max(5, r * 0.07) - 1, Math.PI * 1.05, Math.PI * 1.6); c.stroke();
      }

      const onMove = (e) => {
        if (!sc) return;
        const rect = el.getBoundingClientRect();
        let x = e.clientX - rect.left, y = e.clientY - rect.top;
        if (e.pointerType === 'touch') y -= lens.r * 1.1;
        lens.tx = x; lens.ty = y; lens.user = true; lens.touch = e.pointerType === 'touch'; lens.lastMove = performance.now();
      };
      const onLeave = (e) => { if (e.pointerType !== 'touch') lens.user = false; };
      el.addEventListener('pointermove', onMove);
      el.addEventListener('pointerdown', onMove);
      el.addEventListener('pointerleave', onLeave);

      let rto = 0, lastW = 0, lastH = 0;
      const ro = new ResizeObserver(() => {
        const w = el.clientWidth, h = el.clientHeight;
        if (!lastW) { lastW = w; lastH = h; return; }
        if (Math.abs(w - lastW) < 24 && Math.abs(h - lastH) < 24) return;
        clearTimeout(rto);
        rto = setTimeout(() => { lastW = el.clientWidth; lastH = el.clientHeight; build(); }, 350);
      });
      ro.observe(el);
      lastW = el.clientWidth; lastH = el.clientHeight;
      build().catch((err) => { console.error(err); api.ready(); });

      return {
        destroy() {
          alive = false; cancelAnimationFrame(raf); clearTimeout(rto); ro.disconnect();
          el.removeEventListener('pointermove', onMove); el.removeEventListener('pointerdown', onMove); el.removeEventListener('pointerleave', onLeave);
          board = null; life = null; sc = null;
        },
      };
    },
  });
})();
