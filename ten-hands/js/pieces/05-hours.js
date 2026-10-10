/* Ten Hands — 05 · Hours of the Distracted Scribe, fol. 47v
 *
 * A single leaf from a Gothic Book of Hours, lying on green velvet. Everything is drawn
 * at runtime with Canvas 2D into three high-resolution layers (colour, height, material),
 * then lit in WebGL by a lamp that follows the pointer, so that burnished gold on raised
 * gesso glints and punched dots sparkle one by one.
 */
(function () {
  'use strict';

  const PW = 1000, PH = 1420;              // the folio, in page units
  const TAU = Math.PI * 2, PI = Math.PI;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const DBG = (typeof window !== 'undefined' && window.__HOURS) || {};

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hashStr(s) { let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function Rng(seed, name) {
    const r = mulberry32((seed ^ hashStr(name)) >>> 0);
    const f = () => r();
    f.r = (a, b) => a + (b - a) * r();
    f.i = (a, b) => Math.floor(a + (b - a + 1) * r());
    f.pick = (a) => a[Math.floor(r() * a.length)];
    f.ch = (p) => r() < p;
    f.g = () => { let u = 0; while (u === 0) u = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * r()); };
    return f;
  }

  /* ------------------------------------------------------------------ layout */
  const LS = 44, TY0 = 192, NL = 19;
  const COLS = [[236, 523], [559, 846]];
  const XH = 14.5, SS = 5.75, NIB = 3.1, NANG = 38 * PI / 180;
  const ruleY = (i) => TY0 + i * LS;
  const INI = { x0: 236, y0: ruleY(1) - 9, x1: 523, y1: ruleY(7) - 14 };
  const BAR = { x0: 199, x1: 213, y0: INI.y0, y1: ruleY(18) + 26 };

  const C = {
    vellum: '#eee0c3', ink: '#24170f', red: '#bd3a22', redDk: '#7a2112', vermilion: '#d24a2a',
    blue: '#2d4b9c', blueDk: '#17265c', blueLt: '#7f98d6', rose: '#d5878f', roseDk: '#99445a', roseLt: '#f1c6c4',
    green: '#4f8a5d', greenDk: '#24543a', greenLt: '#a2c99a', white: '#f7f2e6', ochre: '#c99b48', ochreDk: '#7d561f',
    flesh: '#f1d9c2', fleshDk: '#c4917a', cheek: '#e0857a', gold: '#c9a24e', bole: '#a4472d', grey: '#8d8c88', greyDk: '#4a4a48',
    brown: '#7b5a43', brownDk: '#3d2a1d', black: '#1c1714', violet: '#6a4a8c',
  };

  /* ======================================================================
   *  THE PAINTER — builds the three layers for one seed and resolution
   * ==================================================================== */
  async function paintFolio(seed, opt, tick) {
    const S = opt.S, rx = opt.rx, ry = opt.ry, rw = opt.rw, rh = opt.rh;
    const TW = Math.round(rw * S), TH = Math.round(rh * S);
    const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
    const cvC = mk(TW, TH), cvH = mk(TW, TH), cvM = mk(TW, TH);
    const GSF = 3, cvG = mk(Math.ceil(TW / GSF), Math.ceil(TH / GSF));
    const cc = cvC.getContext('2d', { alpha: false });
    const hh = cvH.getContext('2d', { alpha: false });
    const mm = cvM.getContext('2d', { alpha: false });
    const gg = cvG.getContext('2d', { alpha: false });
    const setBase = (ctx, s) => ctx.setTransform(s, 0, 0, s, -rx * s, -ry * s);
    setBase(cc, S); setBase(hh, S); setBase(mm, S); setBase(gg, S / GSF);
    for (const [ctx, col] of [[cc, '#1a1612'], [hh, '#808080'], [mm, '#000'], [gg, '#000']]) {
      ctx.fillStyle = col; ctx.fillRect(rx - 10, ry - 10, rw + 20, rh + 20);
    }
    const LOW = S < 1.2; // low-detail pass: skip microscopic things

    /* ---------------------------------------------------------- materials */
    const gray = (v) => { v = Math.round(clamp(v, 0, 255)); return 'rgb(' + v + ',' + v + ',' + v + ')'; };
    const MAT = { vel: 'rgb(0,22,255)', paint: 'rgb(0,48,255)', ink: 'rgb(0,125,255)', gold: 'rgb(255,0,255)', shell: 'rgb(128,40,255)', hole: 'rgb(0,0,0)' };
    function fillAll(path, col, h, mat) {
      if (col) { cc.fillStyle = col; cc.fill(path); }
      if (h != null) { hh.fillStyle = gray(h); hh.fill(path); }
      if (mat) { mm.fillStyle = mat; mm.fill(path); }
    }
    const paint = (path, col, h) => fillAll(path, col, h == null ? 133 : h, MAT.paint);
    const inkF = (path, col) => fillAll(path, col || C.ink, null, MAT.ink);
    function gild(path, shell) {
      fillAll(path, C.gold, 128, shell ? MAT.shell : MAT.gold);
      if (!shell) { gg.fillStyle = '#fff'; gg.fill(path); }
    }
    function wash(path, col, a) { cc.globalAlpha = a; cc.fillStyle = col; cc.fill(path); cc.globalAlpha = 1; }

    /* ------------------------------------------------- matrix for figures */
    let M = [1, 0, 0, 1, 0, 0]; const MST = [];
    const push = () => MST.push(M.slice());
    const pop = () => { M = MST.pop(); };
    const translate = (x, y) => { M[4] += M[0] * x + M[2] * y; M[5] += M[1] * x + M[3] * y; };
    const scale = (sx, sy) => { if (sy === undefined) sy = sx; M[0] *= sx; M[1] *= sx; M[2] *= sy; M[3] *= sy; };
    const rotate = (a) => { const c = Math.cos(a), s = Math.sin(a); const a0 = M[0], b0 = M[1], c0 = M[2], d0 = M[3]; M[0] = a0 * c + c0 * s; M[1] = b0 * c + d0 * s; M[2] = -a0 * s + c0 * c; M[3] = -b0 * s + d0 * c; };
    const mS = () => Math.sqrt(Math.abs(M[0] * M[3] - M[1] * M[2]));
    const TX = (x, y) => M[0] * x + M[2] * y + M[4];
    const TY = (x, y) => M[1] * x + M[3] * y + M[5];
    const tf = (pts) => pts.map((p) => (p[2] ? [TX(p[0], p[1]), TY(p[0], p[1]), 1] : [TX(p[0], p[1]), TY(p[0], p[1])]));

    /* ------------------------------------------------------------ splines */
    function bezSegs(T, closed) {
      const n = T.length, segs = [];
      const get = (i) => (closed ? T[((i % n) + n) % n] : T[Math.max(0, Math.min(n - 1, i))]);
      const m = closed ? n : n - 1;
      for (let i = 0; i < m; i++) {
        const p0 = get(i - 1), p1 = get(i), p2 = get(i + 1), p3 = get(i + 2);
        const c1 = p1[2] ? [p1[0], p1[1]] : [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
        const c2 = p2[2] ? [p2[0], p2[1]] : [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
        segs.push([p1, c1, c2, p2]);
      }
      return segs;
    }
    function shapePath(pts, closed) {
      if (closed === undefined) closed = true;
      const T = tf(pts); const segs = bezSegs(T, closed); const p = new Path2D();
      p.moveTo(T[0][0], T[0][1]);
      for (const s of segs) p.bezierCurveTo(s[1][0], s[1][1], s[2][0], s[2][1], s[3][0], s[3][1]);
      if (closed) p.closePath();
      return p;
    }
    const dist = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);
    function cub(a, b, c, d, t) {
      const u = 1 - t, w0 = u * u * u, w1 = 3 * u * u * t, w2 = 3 * u * t * t, w3 = t * t * t;
      return [a[0] * w0 + b[0] * w1 + c[0] * w2 + d[0] * w3, a[1] * w0 + b[1] * w1 + c[1] * w2 + d[1] * w3];
    }
    function samp(pts, closed, step) {
      step = step || 0.8;
      const T = tf(pts); const segs = bezSegs(T, closed); const out = [];
      for (const s of segs) {
        const len = dist(s[0], s[1]) + dist(s[1], s[2]) + dist(s[2], s[3]);
        const k = Math.max(2, Math.ceil(len / step));
        for (let j = 0; j < k; j++) out.push(cub(s[0], s[1], s[2], s[3], j / k));
      }
      if (!closed) { const l = T[T.length - 1]; out.push([l[0], l[1]]); }
      return out;
    }
    // polygon ribbon around a polyline in page coords; wf(t, s) gives full width
    function ribbon(P, wf, closed) {
      const n = P.length; if (n < 2) return null;
      const L = [0]; for (let i = 1; i < n; i++) L[i] = L[i - 1] + dist(P[i - 1], P[i]);
      const tot = L[n - 1] || 1;
      const lf = [], rt = [];
      for (let i = 0; i < n; i++) {
        const a = P[i === 0 ? (closed ? n - 1 : 0) : i - 1], b = P[i === n - 1 ? (closed ? 0 : n - 1) : i + 1];
        let dx = b[0] - a[0], dy = b[1] - a[1]; const dl = Math.hypot(dx, dy) || 1; dx /= dl; dy /= dl;
        const w = wf(L[i] / tot, L[i]) / 2;
        lf.push([P[i][0] - dy * w, P[i][1] + dx * w]); rt.push([P[i][0] + dy * w, P[i][1] - dx * w]);
      }
      const path = new Path2D();
      if (closed) {
        path.moveTo(lf[0][0], lf[0][1]); for (let i = 1; i < n; i++) path.lineTo(lf[i][0], lf[i][1]); path.closePath();
        path.moveTo(rt[n - 1][0], rt[n - 1][1]); for (let i = n - 2; i >= 0; i--) path.lineTo(rt[i][0], rt[i][1]); path.closePath();
      } else {
        path.moveTo(lf[0][0], lf[0][1]); for (let i = 1; i < n; i++) path.lineTo(lf[i][0], lf[i][1]);
        for (let i = n - 1; i >= 0; i--) path.lineTo(rt[i][0], rt[i][1]); path.closePath();
      }
      return path;
    }
    const rW = Rng(seed, 'wobble');
    function taper(w, a, b, mn, wob) {
      a = a == null ? 0.25 : a; b = b == null ? 0.25 : b; mn = mn == null ? 0.12 : mn; wob = wob == null ? 0.18 : wob;
      const ph = rW() * 100;
      return (t, s) => {
        let k = 1;
        if (a > 0 && t < a) k = Math.sin((t / a) * PI / 2);
        if (b > 0 && t > 1 - b) k = Math.min(k, Math.sin(((1 - t) / b) * PI / 2));
        const n = 1 + wob * (Math.sin(s * 0.23 + ph) * 0.6 + Math.sin(s * 0.071 + ph * 1.3) * 0.4);
        return w * (mn + (1 - mn) * k) * n;
      };
    }
    // ---- drawing verbs (points in local coords through M) -----------------
    function line(pts, w, col, a, b, mn) {
      const P = samp(pts, false, 0.5);
      const path = ribbon(P, taper(w * mS(), a, b, mn), false);
      if (path) inkF(path, col);
      return path;
    }
    function outline(pts, w, col, closed) {
      const P = samp(pts, closed !== false, 0.5);
      const path = ribbon(P, taper(w * mS(), 0, 0, 1, 0.22), closed !== false);
      if (path) inkF(path, col);
    }
    // modelling is laid in as hatching: several fine strokes side by side, each with its own length
    const rH = Rng(seed, 'hatch');
    function hatchPaths(pts, w, a, b, fine) {
      const P = samp(pts, false, 0.5); const n0 = P.length; if (n0 < 2) return [];
      const W = w * mS(); const lw = fine || 0.62;
      const n = Math.max(1, Math.round(W / lw));
      if (n === 1) { const r = ribbon(P, taper(W, a == null ? 0.35 : a, b == null ? 0.35 : b, 0.05), false); return r ? [r] : []; }
      const N = P.map((p, i) => { const q = P[Math.max(0, i - 1)], r = P[Math.min(n0 - 1, i + 1)]; let dx = r[0] - q[0], dy = r[1] - q[1]; const l = Math.hypot(dx, dy) || 1; return [-dy / l, dx / l]; });
      const out = [];
      for (let k = 0; k < n; k++) {
        const u = (k + 0.5) / n - 0.5;                 // -0.5..0.5 across the stroke
        const prof = Math.cos(u * PI);                   // centre strokes run longest
        const o = u * W + rH.g() * lw * 0.18;
        const t0 = (1 - prof) * 0.32 + rH.r(0, 0.1), t1 = 1 - (1 - prof) * 0.32 - rH.r(0, 0.1);
        const i0 = Math.floor(t0 * (n0 - 1)), i1 = Math.ceil(t1 * (n0 - 1));
        if (i1 - i0 < 2) continue;
        const Q = []; for (let i = i0; i <= i1; i++) Q.push([P[i][0] + N[i][0] * o, P[i][1] + N[i][1] * o]);
        const r = ribbon(Q, taper(lw * rH.r(0.65, 0.95), 0.3, 0.3, 0.05, 0.25), false);
        if (r) out.push(r);
      }
      return out;
    }
    function stroke(pts, w, col, alpha, a, b) { // a modelling stroke on the colour layer only
      const ps = hatchPaths(pts, w, a, b);
      cc.globalAlpha = alpha == null ? 1 : alpha; cc.fillStyle = col;
      for (const p of ps) cc.fill(p);
      cc.globalAlpha = 1;
    }
    function hiLite(pts, w, alpha) { // lead-white highlight, slightly raised
      const ps = hatchPaths(pts, w, 0.4, 0.4, 0.42);
      cc.globalAlpha = alpha == null ? 0.92 : alpha; cc.fillStyle = C.white;
      for (const p of ps) { cc.fill(p); hh.fillStyle = gray(137); hh.fill(p); }
      cc.globalAlpha = 1;
    }
    function blob(pts, col, ol, h) {
      const p = shapePath(pts, true); paint(p, col, h);
      // pigment pools a little darker along the edge of a painted field
      if (ol !== 0 && mS() * 1 > 0) {
        const T = tf(pts); let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
        for (const q of T) { x0 = Math.min(x0, q[0]); y0 = Math.min(y0, q[1]); x1 = Math.max(x1, q[0]); y1 = Math.max(y1, q[1]); }
        const d = Math.hypot(x1 - x0, y1 - y0);
        if (d > 9) {
          cc.save(); cc.clip(p);
          cc.globalCompositeOperation = 'multiply'; cc.globalAlpha = 0.32;
          cc.strokeStyle = col; cc.lineWidth = Math.min(3.2, d * 0.08); cc.stroke(p);
          cc.globalAlpha = 0.18; cc.lineWidth = Math.min(7, d * 0.2); cc.stroke(p);
          cc.restore();
        }
      }
      if (ol !== 0) outline(pts, ol || 0.6);
      return p;
    }
    function ellPts(cx, cy, rx_, ry_, n, rot) {
      n = n || 12; rot = rot || 0; const o = [];
      for (let i = 0; i < n; i++) { const a = (i / n) * TAU; const x = Math.cos(a) * rx_, y = Math.sin(a) * ry_; o.push([cx + x * Math.cos(rot) - y * Math.sin(rot), cy + x * Math.sin(rot) + y * Math.cos(rot)]); }
      return o;
    }
    function dot(x, y, r, col, h) { const p = new Path2D(); p.arc(TX(x, y), TY(x, y), r * mS(), 0, TAU); fillAll(p, col, h, col === C.ink ? MAT.ink : MAT.paint); return p; }
    function goldDot(x, y, r) { const p = new Path2D(); p.arc(TX(x, y), TY(x, y), r * mS(), 0, TAU); gild(p); return p; }
    // a Gothic almond eye: heavy upper lid, dot pupil tucked under it (local units of the face)
    function gEye(x, y, w, open, look, lw) {
      lw = lw || 0.07; const h = w * (0.3 + 0.55 * open);
      blob([[x - w, y + h * 0.05], [x - w * 0.35, y - h * 0.95], [x + w * 0.45, y - h * 0.9], [x + w, y - h * 0.05], [x + w * 0.35, y + h * 0.5], [x - w * 0.45, y + h * 0.45]], '#f7f1e3', 0);
      dot(x + look * w * 0.42, y - h * 0.18, Math.min(h * 0.62, w * 0.42), '#1e1612');
      line([[x - w * 1.08, y + h * 0.12], [x - w * 0.4, y - h * 1.05], [x + w * 0.5, y - h * 0.98], [x + w * 1.1, y - h * 0.02]], lw, C.ink, 0.15, 0.2, 0.35);
      line([[x - w * 0.8, y + h * 0.42], [x, y + h * 0.62], [x + w * 0.8, y + h * 0.36]], lw * 0.45, '#8a5a48', 0.2, 0.2, 0.4);
    }

    /* ============================================================ VELLUM */
    const rP = Rng(seed, 'page');
    const pagePoly = (() => {
      const ph = [rP() * 9, rP() * 9, rP() * 9, rP() * 9, rP() * 9, rP() * 9];
      const wob = (t, k) => 1.3 + 1.0 * Math.sin(t * 0.0093 + ph[k]) + 0.45 * Math.sin(t * 0.041 + ph[k + 1]) + 0.2 * Math.sin(t * 0.17 + ph[k + 2]);
      const pts = [];
      for (let x = 10; x <= PW - 6; x += 12) pts.push([x, wob(x, 0)]);
      pts.push([PW - 3.5, 3.5]);
      for (let y = 8; y <= PH - 8; y += 12) pts.push([PW - wob(y, 2), y]);
      pts.push([PW - 4, PH - 4]);
      for (let x = PW - 8; x >= 30; x -= 12) pts.push([x, PH - wob(x, 3)]);
      // worn lower outer corner
      const cx = 24, cy = PH - 24;
      for (let a = PI / 2; a <= PI; a += PI / 14) { const r = 22 + Math.sin(a * 7) * 1.2 + (rP() - 0.5) * 1.6; pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); }
      for (let y = PH - 30; y >= 10; y -= 12) pts.push([wob(y, 1), y]);
      pts.push([4, 4]);
      return pts;
    })();
    const pagePath = new Path2D();
    pagePath.moveTo(pagePoly[0][0], pagePoly[0][1]);
    for (let i = 1; i < pagePoly.length; i++) pagePath.lineTo(pagePoly[i][0], pagePoly[i][1]);
    pagePath.closePath();

    fillAll(pagePath, C.vellum, 128, MAT.vel);
    cc.save(); cc.clip(pagePath);
    // broad tonal blotches
    {
      const tints = ['rgba(214,180,122,', 'rgba(170,150,120,', 'rgba(236,196,168,', 'rgba(252,246,230,', 'rgba(205,170,110,'];
      for (let i = 0; i < 70; i++) {
        const x = rP.r(-50, PW + 50), y = rP.r(-50, PH + 50), r = rP.r(60, 420), a = rP.r(0.03, 0.085);
        const t = rP.pick(tints);
        const g = cc.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, t + a + ')'); g.addColorStop(1, t + '0)');
        cc.fillStyle = g; cc.fillRect(x - r, y - r, 2 * r, 2 * r);
      }
      // the hair side is a little warmer towards the spine side and the bottom
      let g = cc.createLinearGradient(0, 0, PW, 0);
      g.addColorStop(0, 'rgba(250,244,228,0.10)'); g.addColorStop(0.7, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(190,150,95,0.10)');
      cc.fillStyle = g; cc.fillRect(0, 0, PW, PH);
      g = cc.createLinearGradient(0, 0, 0, PH);
      g.addColorStop(0, 'rgba(190,150,95,0.05)'); g.addColorStop(0.5, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(170,130,80,0.08)');
      cc.fillStyle = g; cc.fillRect(0, 0, PW, PH);
    }
    await tick();
    // veins
    {
      const rV = Rng(seed, 'veins');
      const nv = rV.i(3, 5);
      const vpaths = [new Path2D(), new Path2D(), new Path2D()];
      const walk = (x, y, a, len, depth) => {
        const pts = [[x, y]];
        let k = rV.r(-0.01, 0.01);
        for (let s = 0; s < len; s += 7) {
          k += rV.r(-0.006, 0.006); k = clamp(k, -0.03, 0.03); a += k * 7 + rV.r(-0.08, 0.08);
          x += Math.cos(a) * 7; y += Math.sin(a) * 7; pts.push([x, y]);
          if (depth < 3 && rV.ch(0.035)) walk(x, y, a + rV.pick([-1, 1]) * rV.r(0.4, 0.9), len * rV.r(0.3, 0.6), depth + 1);
        }
        for (const vp of vpaths) { vp.moveTo(pts[0][0], pts[0][1]); for (const p of pts) vp.lineTo(p[0], p[1]); }
        vpaths.depthHint = depth;
      };
      for (let i = 0; i < nv; i++) {
        const side = rV.i(0, 3);
        const x = side === 0 ? rV.r(0, 120) : side === 1 ? rV.r(PW - 120, PW) : rV.r(0, PW);
        const y = side < 2 ? rV.r(200, PH - 200) : side === 2 ? rV.r(0, 80) : rV.r(PH - 80, PH);
        const a = Math.atan2(PH / 2 - y, PW / 2 - x) + rV.r(-0.6, 0.6);
        walk(x, y, a, rV.r(180, 420), 0);
      }
      cc.lineCap = 'round'; cc.lineJoin = 'round';
      const vw = [7, 3.4, 1.4], va = [0.018, 0.024, 0.03];
      for (let i = 0; i < 3; i++) { cc.strokeStyle = 'rgba(150,96,88,' + va[i] + ')'; cc.lineWidth = vw[i]; cc.stroke(vpaths[i]); }
      hh.lineCap = 'round'; hh.strokeStyle = 'rgb(131,131,131)'; hh.lineWidth = 2.2; hh.stroke(vpaths[1]);
    }
    // follicles: clustered tiny pits, patchy
    if (!LOW) {
      const rF = Rng(seed, 'follicle');
      const batches = [new Path2D(), new Path2D(), new Path2D(), new Path2D()];
      const hpits = new Path2D();
      const patches = [];
      for (let i = 0; i < 11; i++) patches.push([rF.r(0, PW), rF.r(0, PH), rF.r(90, 300), rF.r(0.4, 1)]);
      for (let i = 0; i < 26000; i++) {
        const x = rF.r(0, PW), y = rF.r(0, PH);
        let dens = 0.13;
        for (const p of patches) { const d = Math.hypot(x - p[0], y - p[1]) / p[2]; if (d < 1) dens += (1 - d * d) * p[3]; }
        if (rF() > dens) continue;
        const n = rF.ch(0.55) ? 3 : rF.ch(0.5) ? 2 : 1;
        const b = batches[rF.i(0, 3)];
        for (let k = 0; k < n; k++) {
          const px = x + rF.r(-1.1, 1.1), py = y + rF.r(-1.1, 1.1), r = rF.r(0.18, 0.5);
          b.moveTo(px + r, py); b.arc(px, py, r, 0, TAU);
          if (k === 0) { hpits.moveTo(px + r, py); hpits.arc(px, py, r, 0, TAU); }
        }
      }
      const al = [0.09, 0.15, 0.22, 0.3];
      batches.forEach((b, i) => { cc.fillStyle = 'rgba(112,82,52,' + al[i] + ')'; cc.fill(b); });
      hh.fillStyle = 'rgb(123,123,123)'; hh.fill(hpits);
      // pale scraped flecks (pumice) and fine fibre marks
      const fl = new Path2D();
      for (let i = 0; i < 2600; i++) {
        const x = rF.r(0, PW), y = rF.r(0, PH), a = rF.r(0, PI), l = rF.r(1.5, 5);
        fl.moveTo(x, y); fl.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
      }
      cc.strokeStyle = 'rgba(255,252,240,0.16)'; cc.lineWidth = 0.6; cc.stroke(fl);
      const fd = new Path2D();
      for (let i = 0; i < 1800; i++) {
        const x = rF.r(0, PW), y = rF.r(0, PH), a = rF.r(0, PI), l = rF.r(1, 4);
        fd.moveTo(x, y); fd.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
      }
      cc.strokeStyle = 'rgba(120,90,60,0.08)'; cc.lineWidth = 0.4; cc.stroke(fd);
    }
    // darkened, oxidised edges
    for (const [w, a] of [[46, 0.035], [22, 0.045], [9, 0.06], [3, 0.09]]) {
      cc.strokeStyle = 'rgba(120,86,48,' + a + ')'; cc.lineWidth = w; cc.stroke(pagePath);
    }
    cc.restore();
    await tick();

    /* ====================================================== TEXTURA ENGINE */
    const MIN = (x) => [[x - 0.36, -0.03], [x, 0.15], [x, 0.86], [x + 0.3, 1.01]];
    const ARCH = (x) => [[x - 0.9, 0.2], [x - 0.42, -0.03], [x, 0.15], [x, 0.86], [x + 0.3, 1.01]];
    const ASC = (x, foot) => (foot ? [[x - 0.34, -0.5], [x, -0.62], [x, 0.86], [x + 0.28, 1]] : [[x - 0.34, -0.5], [x, -0.62], [x, 1.0]]);
    const FORK = (x) => [[x - 0.02, -0.64], [x + 0.27, -0.5]];
    const GL = {
      a: { w: 2, s: [[[0.05, 0.1], [0.55, -0.02], [1, 0.14], [1, 0.86], [1.28, 1]], [[1, 0.44], [0.3, 0.5], [0, 0.64], [0, 0.86], [0.42, 1.02], [0.95, 0.88]]] },
      b: { w: 2, s: [ASC(0, false), FORK(0), [[0.1, 0.16], [0.55, -0.02], [1, 0.14], [1, 0.86], [0.55, 1.02], [0.02, 0.95]]] },
      c: { w: 1.7, s: [[[-0.36, -0.03], [0, 0.15], [0, 0.86], [0.45, 1.03], [1.0, 0.88]], [[0.1, 0.17], [0.55, -0.03], [1.0, 0.1], [1.0, 0.3], [0.86, 0.36]]] },
      d: { w: 2.05, s: [[[-0.28, 0], [0, 0.14], [0, 0.86], [0.42, 1.02], [0.95, 0.86]], [[0.1, 0.16], [0.6, 0.0], [1, 0.12]], [[1.28, 1.0], [1, 0.86], [1, 0.05], [0.78, -0.42], [0.25, -0.62]]] },
      e: { w: 1.7, s: [[[-0.28, 0], [0, 0.14], [0, 0.86], [0.42, 1.02], [0.92, 0.9]], [[0.1, 0.16], [0.55, -0.02], [0.92, 0.12], [0.92, 0.38], [0.08, 0.52]]] },
      f: { w: 1.4, s: [[[0.78, -0.46], [0.4, -0.62], [0, -0.46], [0, 0.86], [0.28, 1]], [[-0.3, 0.04], [0.62, 0.04]]] },
      g: { w: 2, s: [[[-0.28, 0], [0, 0.14], [0, 0.72], [0.42, 0.88], [0.95, 0.76]], [[0.1, 0.16], [0.55, -0.02], [1, 0.14], [1, 1.16], [0.55, 1.4], [0.02, 1.3]]] },
      h: { w: 2, s: [ASC(0, true), FORK(0), [[0.1, 0.18], [0.62, -0.01], [1, 0.14], [1, 1.1], [0.7, 1.42]]] },
      i: { w: 1, s: [MIN(0), [[-0.06, -0.28], [0.26, -0.42]]] },
      l: { w: 1.05, s: [ASC(0, true), FORK(0)] },
      m: { w: 3, s: [MIN(0), ARCH(1), ARCH(2)] },
      n: { w: 2, s: [MIN(0), ARCH(1)] },
      o: { w: 2.05, s: [[[-0.28, 0], [0, 0.14], [0, 0.86], [0.45, 1.02], [1, 0.86]], [[0.1, 0.16], [0.55, -0.02], [1, 0.14], [1, 0.86]]] },
      p: { w: 2, s: [[[-0.28, 0], [0, 0.14], [0, 1.48]], [[-0.32, 1.47], [0.3, 1.5]], [[0.1, 0.16], [0.55, -0.02], [1, 0.14], [1, 0.86], [0.55, 1.02], [0.05, 0.92]]] },
      P: { w: 2, s: [[[-0.28, 0], [0, 0.14], [0, 1.48]], [[-0.5, 1.2], [0.5, 1.16]], [[0.1, 0.16], [0.55, -0.02], [1, 0.14], [1, 0.86], [0.55, 1.02], [0.05, 0.92]]] },
      q: { w: 2, s: [[[-0.28, 0], [0, 0.14], [0, 0.86], [0.45, 1.02], [0.95, 0.9]], [[0.1, 0.16], [0.55, -0.02], [1, 0.12], [1, 1.48]], [[0.7, 1.47], [1.3, 1.5]]] },
      r: { w: 1.55, s: [MIN(0), [[0.1, 0.18], [0.55, -0.02], [0.88, 0.1]]] },
      s: { w: 1.32, s: [[[0.78, -0.46], [0.4, -0.62], [0, -0.46], [0, 0.86], [0.28, 1]]] },
      z: { w: 1.75, s: [[[0.92, 0.12], [0.5, -0.02], [0.05, 0.12], [0.05, 0.36], [0.92, 0.6], [0.92, 0.86], [0.48, 1.02], [-0.02, 0.88]]] }, // round s
      t: { w: 1.55, s: [[[0, -0.32], [0, 0.86], [0.42, 1.02], [0.85, 0.9]], [[-0.3, 0.04], [0.75, 0.04]]] },
      u: { w: 2, s: [[[-0.28, 0], [0, 0.14], [0, 0.86], [0.4, 1.01], [0.95, 0.8]], MIN(1)] },
      x: { w: 1.9, s: [[[-0.15, 0.0], [0.15, 0.12], [0.85, 0.9], [1.15, 1.0]], [[1.0, 0.06], [0.0, 0.96]]] },
      y: { w: 2, s: [[[-0.28, 0], [0, 0.14], [0, 0.86], [0.4, 1.01], [0.95, 0.8]], [[0.72, 0], [1, 0.14], [1, 1.16], [0.6, 1.42], [0.15, 1.34]]] },
      '&': { w: 1.65, s: [[[-0.15, 0.06], [0.88, 0.02], [0.25, 1.38]]] },
      '9': { w: 1.6, s: [[[0.85, 0.18], [0.45, -0.02], [0.05, 0.2], [0.05, 0.62], [0.45, 0.8], [0.85, 0.66]], [[0.85, 0.2], [0.85, 1.1], [0.45, 1.38], [0.05, 1.3]]] },
      R: { w: 1.8, s: [MIN(0), [[0.1, 0.18], [0.55, -0.02], [0.9, 0.12], [0.9, 0.42], [0.3, 0.55]], [[1.25, 0.32], [0.15, 1.35]]] },
      '.': { w: 0.95, s: [[[0.0, 0.44], [0.3, 0.6]]] },
      ':': { w: 1.1, s: [[[0.0, 0.84], [0.3, 1.0]], [[-0.1, 0.36], [0.16, 0.5], [0.62, -0.06]]] },
      '=': { w: 0.9, s: [[[0, 0.3], [0.52, 0.1]], [[0, 0.58], [0.52, 0.38]]] },
    };
    GL.v = GL.u; GL.j = GL.i; GL.k = GL.h; GL.w = GL.m;
    const MACRON = [[-0.15, -0.3], [0.28, -0.44], [0.66, -0.3], [1.05, -0.4]];
    // parse an encoded word into glyph tokens
    function glyphs(word) {
      const out = []; const chars = word.replace(/-/g, '');
      for (let i = 0; i < chars.length; i++) {
        let ch = chars[i];
        if (ch === '~') { if (out.length) out[out.length - 1].mac = true; continue; }
        if (ch === 's') { const nx = chars[i + 1]; if (nx === undefined || nx === '.' || nx === ':' || nx === '~') ch = 'z'; }
        const lc = /[A-Z]/.test(ch) && !GL[ch] ? ch.toLowerCase() : ch;
        const g = GL[lc] || GL[ch.toLowerCase()] || GL.i;
        out.push({ g, ch: lc, mac: false });
      }
      return out;
    }
    const wordWidth = (gs) => gs.reduce((a, t) => a + t.g.w, 0) * SS - 0.3 * SS;
    // nib-swept parallelograms for one polyline (page coords)
    const nx0 = Math.cos(NANG) * NIB / 2, ny0 = -Math.sin(NANG) * NIB / 2;
    function nibQuads(path, pts, nib) {
      const k = nib / NIB, nx = nx0 * k, ny = ny0 * k;
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i], b = pts[i + 1];
        const q = [[a[0] - nx, a[1] - ny], [a[0] + nx, a[1] + ny], [b[0] + nx, b[1] + ny], [b[0] - nx, b[1] - ny]];
        const cr = (q[1][0] - q[0][0]) * (q[2][1] - q[0][1]) - (q[1][1] - q[0][1]) * (q[2][0] - q[0][0]);
        if (cr < 0) q.reverse();
        path.moveTo(q[0][0], q[0][1]); path.lineTo(q[1][0], q[1][1]); path.lineTo(q[2][0], q[2][1]); path.lineTo(q[3][0], q[3][1]); path.closePath();
      }
    }
    // draws a word with its first stem at x, x-height top at y; returns {fill, hair}
    function wordPaths(gs, x, y, rr, scl, nib) {
      scl = scl || 1; nib = nib || NIB;
      const fill = new Path2D(), hair = new Path2D();
      const sx = SS * scl, sy = XH * scl;
      let cx = x;
      for (const t of gs) {
        const jx = rr.g() * 0.05 * sx, jy = rr.g() * 0.025 * sy;
        const strokes = t.mac ? t.g.s.concat([MACRON.map((p) => [p[0] * (t.g.w - 0.4), p[1]])]) : t.g.s;
        for (const st of strokes) {
          const pts = st.map((p) => [cx + jx + p[0] * sx + rr.g() * 0.12, y + jy + p[1] * sy + rr.g() * 0.12]);
          nibQuads(fill, pts, nib * (1 + rr.g() * 0.03));
          hair.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) hair.lineTo(pts[i][0], pts[i][1]);
        }
        cx += t.g.w * sx;
      }
      return { fill, hair, x1: cx };
    }
    function drawWord(ctx, wp, col, matC) {
      ctx.fillStyle = col; ctx.fill(wp.fill);
      ctx.strokeStyle = col; ctx.lineWidth = 0.42; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke(wp.hair);
      if (matC) { mm.fillStyle = matC; mm.fill(wp.fill); }
    }

    /* ------------------------------------------------------- the Latin */
    const HOURS = [
      { rub: 'Ad ma-tu-ti-nas.', first: 'o-mi~-ne la-bi-a me-a a-pe-ri-es.', body: [
        'Et os me-u~ an-nu~-ci-a-bit lau-de~ tu-a~.',
        'De-us in ad-iu-to-ri-u~ me-u~ in-ten-de.',
        'Do~-ne ad ad-iu-uan-du~ me fes-ti-na.',
        'Glo-ri-a pa-tri & fi-li-o & spi-ri-tu-i sanc-to.',
        'Si-cut e-rat in prin-ci-pi-o & nu~c & se~-per: & in se-cu-la se-cu-lo-R a-me~. Al-le-lu-ya. {In-ui-ta-to-ri-u~.}',
        'Aue ma-ri-a gra-ci-a ple-na do~s te-cu~. {Ps.}',
        'Ue-ni-te ex-ul-te-mus do~-no iu-bi-le-mus de-o sa-lu-ta-ri nr~o: pre-oc-cu-pe-mus fa-ci-em e-ius in 9-fes-si-o-ne: & in psal-mis iu-bi-le-mus e-i.',
        'Aue ma-ri-a gra-ci-a ple-na do~s te-cu~.',
        'Quo-ni-am de-us mag-nus do~s & rex mag-nus su-P om~s de-os: quo-ni-am non re-pel-let do~s ple-bem su-am: qui-a in ma-nu e-ius su~t om~s fi-nes ter-re: & al-ti-tu-di-nes mon-ti-u~ ip-se con-spi-cit.',
        'Do~s te-cu~.',
        'Quo-ni-am ip-si-us est ma-re & ip-se fe-cit il-lud: & a-ri-dam fun-da-ue-runt ma-nus e-ius: ue-ni-te a-do-re-mus & pro-ci-da-mus an-te de-u~: plo-re-mus co-ram do~-no qui fe-cit nos: qui-a ip-se est do~s de-us nr~: nos au-te~ po-pu-lus e-ius & o-ues pas-cu-e e-ius.',
        'Aue ma-ri-a gra-ci-a ple-na do~s te-cu~.',
        'Ho-di-e si uo-ce~ e-ius au-di-e-ri-tis no-li-te ob-du-ra-re cor-da ues-tra: si-cut in ex-a-cer-ba-ci-o-ne se-cun-du~ di-em temp-ta-ci-o-nis in de-ser-to: u-bi temp-ta-ue-runt me pa-tres ues-tri: pro-ba-ue-runt & ui-de-runt o-pe-ra me-a.',
        'Do~s te-cu~.',
        'Qua-dra-gin-ta an-nis prox-i-mus fu-i ge-ne-ra-ci-o-ni hu-ic & dix-i: sem-per hi er-rant cor-de: ip-si ue-ro non cog-no-ue-runt ui-as me-as qui-bus iu-ra-ui in i-ra me-a si in-tro-i-bunt in re-qui-em me-a~.',
      ] },
      { rub: 'Ad lau-des.', first: 'e-us in ad-iu-to-ri-u~ me-u~ in-ten-de.', body: [
        'Do~-ne ad ad-iu-uan-du~ me fes-ti-na.',
        'Glo-ri-a pa-tri & fi-li-o & spi-ri-tu-i sanc-to.',
        'Si-cut e-rat in prin-ci-pi-o & nu~c & se~-per: & in se-cu-la se-cu-lo-R a-me~. Al-le-lu-ya. {Ps.}',
        'Do~s reg-na-uit de-co-re~ in-du-tus est: in-du-tus est do~s for-ti-tu-di-ne~ & pre-cinx-it se.',
        'Et-e-nim fir-ma-uit or-be~ ter-re qui non co~-mo-ue-bi-tur.',
        'Pa-ra-ta se-des tu-a ex tunc: a se-cu-lo tu es.',
        'E-le-ua-ue-runt flu-mi-na do~-ne: e-le-ua-ue-runt flu-mi-na uo-ce~ su-a~.',
        'E-le-ua-ue-runt flu-mi-na fluc-tus su-os: a uo-ci-bus a-qua-R mul-ta-R.',
        'Mi-ra-bi-les e-la-ci-o-nes ma-ris: mi-ra-bi-lis in al-tis do~s.',
        'Tes-ti-mo-ni-a tu-a cre-di-bi-li-a fac-ta sunt ni-mis: do-mu~ tu-a~ de-cet sanc-ti-tu-do do~-ne in lon-gi-tu-di-ne~ di-e-R.',
        'Glo-ri-a pa-tri. {Ps.}',
        'Iu-bi-la-te de-o om~s ter-ra: ser-ui-te do~-no in le-ti-ci-a.',
        'In-tro-i-te in con-spec-tu e-ius in ex-ul-ta-ci-o-ne.',
        'Sci-to-te quo-ni-am do~s ip-se est de-us: ip-se fe-cit nos & non ip-si nos.',
        'Po-pu-lus e-ius & o-ues pas-cu-e e-ius: in-tro-i-te por-tas e-ius in con-fes-si-o-ne: a-tri-a e-ius in hym-nis con-fi-te-mi-ni il-li.',
        'Lau-da-te no-men e-ius quo-ni-am su-a-uis est do~s: in e-ter-nu~ mi-se-ri-cor-di-a e-ius.',
      ] },
    ];
    const rT = Rng(seed, 'text');
    const HOUR = HOURS[seed % 2];

    // line slots in reading order
    const ZONES = []; // rectangles where the scribe could not write (the sewn repair)
    const repair = { x: rT.r(330, 440), line: rT.i(13, 15) };
    ZONES.push({ line: repair.line, x0: repair.x - 26, x1: repair.x + 26, col: 0 });
    ZONES.push({ line: repair.line + 1, x0: repair.x - 20, x1: repair.x + 22, col: 0 });
    const slots = [];
    function lineSlots(col, i) {
      const [a, b] = COLS[col]; let parts = [[a, b]];
      for (const z of ZONES) if (z.col === col && z.line === i) {
        const np = [];
        for (const p of parts) { if (z.x1 <= p[0] || z.x0 >= p[1]) { np.push(p); continue; } if (z.x0 - p[0] > 20) np.push([p[0], z.x0]); if (p[1] - z.x1 > 20) np.push([z.x1, p[1]]); }
        parts = np;
      }
      return parts.map((p, k) => ({ x0: p[0], x1: p[1], y: ruleY(i), col, line: i, sub: k, last: k === parts.length - 1 }));
    }
    for (let i = 7; i < NL; i++) slots.push(...lineSlots(0, i));
    for (let i = 0; i < NL; i++) slots.push(...lineSlots(1, i));

    // flow
    const placed = [];     // {gs, x, y, red, touch}
    const initials = [];   // {ch, x, y, kind}
    const fillers = [];    // {x0, x1, y}
    const INIT_GOLD = [];
    const verses = [];
    verses.push({ init: null, text: HOUR.first });
    for (const v of HOUR.body) verses.push({ init: v[0], text: v.slice(1).replace(/^-/, '') });
    let si = 0, cur = null, curWords = [];
    const GAP = 1.0 * SS;
    function flushLine(isVerseEnd) {
      if (!cur) return;
      const natural = curWords.reduce((a, w) => a + w.w, 0) + GAP * Math.max(0, curWords.length - 1);
      const avail = cur.x1 - cur.xs;
      let extra = avail - natural;
      let gapAdd = 0;
      if (!isVerseEnd && curWords.length > 1 && extra > 0) gapAdd = Math.min(extra / (curWords.length - 1), 0.9 * SS);
      let x = cur.xs;
      for (const w of curWords) { placed.push({ gs: w.gs, x: x + 0.28 * SS, y: cur.y, red: w.red, touch: w.touch }); x += w.w + GAP + gapAdd; }
      const end = x - GAP - gapAdd;
      if (isVerseEnd && cur.x1 - end > 15) fillers.push({ x0: end + 4, x1: cur.x1 - 1, y: cur.y });
      curWords = []; cur = null;
    }
    function nextSlot() { if (si >= slots.length) return false; const s = slots[si++]; cur = { x1: s.x1, xs: s.x0, x: s.x0, y: s.y }; curWords = []; return true; }
    outer:
    for (let vi = 0; vi < verses.length; vi++) {
      const v = verses[vi];
      if (!nextSlot()) break;
      if (v.init) { initials.push({ ch: v.init.toUpperCase(), x: cur.x, y: cur.y }); cur.xs += 22; cur.x = cur.xs; }
      const words = v.text.split(' ').filter(Boolean);
      for (let wi = 0; wi < words.length; wi++) {
        let raw = words[wi]; let red = false;
        if (raw[0] === '{') { red = true; raw = raw.slice(1); }
        if (raw.endsWith('}')) { red = true; raw = raw.slice(0, -1); }
        if (wi > 0 && words[wi - 1][0] === '{' && !words[wi - 1].endsWith('}')) red = true;
        const touch = /^[A-Z]/.test(raw) && !red;
        let gs = glyphs(raw), w = wordWidth(gs);
        while (true) {
          const used = curWords.length ? cur.x - cur.xs + GAP : 0;
          if (used + w <= cur.x1 - cur.xs + 2) { curWords.push({ gs, w, red, touch }); cur.x = cur.xs + used + w; break; }
          // try to split at a syllable
          const syl = raw.split('-');
          let done = false;
          if (syl.length > 1) {
            for (let k = syl.length - 1; k >= 1; k--) {
              const head = syl.slice(0, k).join('-');
              const hg = glyphs(head).concat([{ g: GL['='], ch: '=', mac: false }]);
              const hw = wordWidth(hg);
              if (used + hw <= cur.x1 - cur.xs + 1 && head.replace(/[^a-z]/gi, '').length >= 2) {
                curWords.push({ gs: hg, w: hw, red, touch }); raw = syl.slice(k).join('-'); gs = glyphs(raw); w = wordWidth(gs); done = true; break;
              }
            }
          }
          flushLine(false);
          if (!nextSlot()) break outer;
          if (!done && false) break;
        }
      }
      flushLine(true);
    }

    /* ------------------------------------------------- show-through ghost */
    {
      const gs = 0.34;
      const cvS = mk(Math.ceil(TW * gs), Math.ceil(TH * gs));
      const sc = cvS.getContext('2d');
      const s = S * gs;
      sc.setTransform(-s, 0, 0, s, (PW - rx) * s, -ry * s);
      const rG = Rng(seed, 'ghost');
      sc.fillStyle = '#3c2a1c'; sc.strokeStyle = '#3c2a1c';
      const ghostWords = 'be-a-ti im-ma-cu-la-ti in ui-a qui am-bu-lant in le-ge do~-ni be-a-ti qui scru-tan-tur tes-ti-mo-ni-a e-ius in to-to cor-de ex-qui-runt e-um non e-ni~ qui o-pe-ran-tur i-ni-qui-ta-te~ in ui-is e-ius am-bu-la-ue-runt tu man-das-ti man-da-ta tu-a cus-to-di-ri ni-mis'.split(' ');
      let wi = 0;
      for (let c = 0; c < 2; c++) {
        const [a, b] = [PW - COLS[1 - c][1], PW - COLS[1 - c][0]];
        for (let i = 0; i < NL; i++) {
          let x = a + 1;
          if (c === 0 && i >= 1 && i < 4) x += 70;
          while (true) {
            const gsx = glyphs(ghostWords[wi % ghostWords.length]); const w = wordWidth(gsx);
            if (x + w > b) break;
            const wp = wordPaths(gsx, x + 1.6, ruleY(i) + 7, rG);
            sc.fill(wp.fill); wi++;
            x += w + GAP;
          }
        }
      }
      // ghost of the recto's bar border, initial and a few leaves (mirrored into our inner margin)
      sc.fillStyle = '#4b5a86'; sc.fillRect(PW - 150, ruleY(0) + 4, 9, ruleY(17) - ruleY(0));
      sc.fillStyle = '#7a5e2c'; sc.fillRect(PW - 158, ruleY(0) + 4, 6, ruleY(17) - ruleY(0));
      sc.globalAlpha = 0.5; sc.fillStyle = '#4b5a86'; sc.beginPath(); sc.ellipse(PW - 818, ruleY(0) + 30, 26, 24, 0.1, 0, TAU); sc.fill(); sc.globalAlpha = 1;
      for (let i = 0; i < 40; i++) { sc.beginPath(); sc.arc(PW - rG.r(40, 150), rG.r(120, 1300), rG.r(2, 4.5), 0, TAU); sc.fillStyle = rG.ch(0.5) ? '#7a5e2c' : '#4b5a86'; sc.fill(); }
      cc.save(); cc.clip(pagePath);
      cc.setTransform(1, 0, 0, 1, 0, 0);
      cc.globalAlpha = 0.05; cc.globalCompositeOperation = 'multiply';
      cc.drawImage(cvS, 0, 0, TW, TH);
      cc.globalAlpha = 1; cc.globalCompositeOperation = 'source-over';
      cc.restore(); setBase(cc, S);
    }
    await tick();

    /* ------------------------------------------------- ruling & pricking */
    {
      const rr = Rng(seed, 'ruling');
      const ru = new Path2D();
      for (const [a, b] of COLS) for (let i = 0; i < NL; i++) {
        const y = ruleY(i) + rr.g() * 0.15;
        ru.moveTo(a - 4, y); ru.lineTo(b + 4, y + rr.g() * 0.2);
      }
      for (const yy of [ruleY(0), ruleY(NL - 1)]) { ru.moveTo(6, yy - 0.3); ru.lineTo(PW - 6, yy + 0.4); }
      for (const xx of [COLS[0][0], COLS[0][1], COLS[1][0], COLS[1][1]]) { ru.moveTo(xx + rr.g() * 0.2, 5); ru.lineTo(xx + rr.g() * 0.3, PH - 5); }
      cc.save(); cc.clip(pagePath);
      cc.strokeStyle = 'rgba(150,98,70,0.26)'; cc.lineWidth = 0.5; cc.stroke(ru);
      hh.save(); hh.clip(pagePath); hh.strokeStyle = 'rgb(124,124,124)'; hh.lineWidth = 0.7; hh.stroke(ru); hh.restore();
      cc.restore();
      // prick marks in the outer margin, and at head and foot for the verticals
      const pr = new Path2D(), prH = new Path2D();
      const prick = (x, y) => {
        const a = rr.r(-0.6, 0.6) + PI / 2, l = rr.r(0.9, 1.6), w = rr.r(0.35, 0.6);
        const p = new Path2D(); p.ellipse(x, y, l, w, a, 0, TAU); pr.addPath(p); prH.addPath(p);
      };
      for (let i = 0; i < NL; i++) prick(13 + rr.g() * 0.8, ruleY(i) + rr.g() * 0.6);
      for (const xx of [COLS[0][0], COLS[0][1], COLS[1][0], COLS[1][1]]) { prick(xx + rr.g(), 13 + rr.g()); prick(xx + rr.g(), PH - 14 + rr.g()); }
      cc.fillStyle = 'rgba(60,38,22,0.75)'; cc.fill(pr);
      hh.fillStyle = 'rgb(96,96,96)'; hh.fill(prH);
    }

    /* ==================================================== OCCUPANCY GRID */
    const OC = 4, OWc = Math.ceil(PW / OC), OHc = Math.ceil(PH / OC);
    const occ = new Uint8Array(OWc * OHc);
    function occRect(x0, y0, x1, y1, v) { v = v || 1; for (let j = Math.max(0, Math.floor(y0 / OC)); j <= Math.min(OHc - 1, Math.floor(y1 / OC)); j++) for (let i = Math.max(0, Math.floor(x0 / OC)); i <= Math.min(OWc - 1, Math.floor(x1 / OC)); i++) occ[j * OWc + i] = Math.max(occ[j * OWc + i], v); }
    function occCircle(x, y, r, v) { v = v || 1; for (let j = Math.max(0, Math.floor((y - r) / OC)); j <= Math.min(OHc - 1, Math.floor((y + r) / OC)); j++) for (let i = Math.max(0, Math.floor((x - r) / OC)); i <= Math.min(OWc - 1, Math.floor((x + r) / OC)); i++) { const cx = (i + 0.5) * OC, cy = (j + 0.5) * OC; if ((cx - x) ** 2 + (cy - y) ** 2 <= (r + OC * 0.5) ** 2) occ[j * OWc + i] = Math.max(occ[j * OWc + i], v); } }
    function occEll(x, y, ax, ay) { for (let j = Math.max(0, Math.floor((y - ay) / OC)); j <= Math.min(OHc - 1, Math.floor((y + ay) / OC)); j++) for (let i = Math.max(0, Math.floor((x - ax) / OC)); i <= Math.min(OWc - 1, Math.floor((x + ax) / OC)); i++) { const cx = (i + 0.5) * OC, cy = (j + 0.5) * OC; if (((cx - x) / ax) ** 2 + ((cy - y) / ay) ** 2 <= 1) occ[j * OWc + i] = 2; } }
    function occFree(x, y, r, hardOnly) {
      if (x < 26 + r * 0.3 || x > PW - 26 - r * 0.3 || y < 26 + r * 0.3 || y > PH - 26 - r * 0.3) return false;
      const lim = hardOnly ? 2 : 1;
      for (let j = Math.max(0, Math.floor((y - r) / OC)); j <= Math.min(OHc - 1, Math.floor((y + r) / OC)); j++) for (let i = Math.max(0, Math.floor((x - r) / OC)); i <= Math.min(OWc - 1, Math.floor((x + r) / OC)); i++) { const cx = (i + 0.5) * OC, cy = (j + 0.5) * OC; if ((cx - x) ** 2 + (cy - y) ** 2 <= r * r && occ[j * OWc + i] >= lim) return false; }
      return true;
    }
    // text block and things
    occRect(COLS[0][0] - 8, ruleY(0) - 14, COLS[1][1] + 6, ruleY(NL - 1) + XH + 12, 2);
    occRect(BAR.x0 - 3, BAR.y0 - 4, BAR.x1 + 4, BAR.y1 + 4, 2);
    // drolleries' reserved silhouettes
    const RESV = [
      [676, 112, 104, 66],  // monkey bishop on goat (top)
      [676, 66, 20, 24],    // crozier head
      [372, 150, 30, 24],   // goldfinch
      [96, 636, 84, 132],  // bagpiping monk-dragon (outer margin)
      [916, 650, 64, 100],  // fleeing hunter (inner margin)
      [890, 940, 54, 76],   // hare archer
      [904, 790, 14, 18],   // his falling hat
      [190, 1282, 38, 60],  // grylle
      [312, 1228, 108, 118],// knight
      [618, 1232, 210, 112],// snail
      [828, 1330, 54, 10],  // slime trail
    ];
    for (const r of RESV) occEll(r[0], r[1], r[2], r[3]);

    /* ===================================================== BAR BORDER */
    const rB = Rng(seed, 'border');
    {
      const x0 = BAR.x0, x1 = BAR.x1, xm = (x0 + x1) / 2 - 1, y0 = BAR.y0, y1 = BAR.y1;
      // gold half
      const gp = new Path2D(); gp.rect(x0, y0, xm - x0, y1 - y0); gild(gp);
      // coloured half in alternating segments with white tracery
      let y = y0, k = rB.i(0, 1);
      while (y < y1) {
        const len = Math.min(y1 - y, rB.r(56, 84));
        const p = new Path2D(); p.rect(xm, y, x1 - xm, len);
        paint(p, k % 2 ? C.blue : C.rose, 135);
        // shading on the outer edge
        stroke([[x1 - 1, y + 2], [x1 - 1, y + len - 2]], 1.6, k % 2 ? C.blueDk : C.roseDk, 0.6, 0.1, 0.1);
        // white zigzag tracery
        const zz = [];
        for (let yy = y + 3, s = 0; yy < y + len - 3; yy += 3.2, s++) zz.push([s % 2 ? xm + 1.4 : x1 - 1.4, yy]);
        if (zz.length > 1) { const P = zz; const path = ribbon(P, () => 0.5, false); if (path) { cc.fillStyle = C.white; cc.fill(path); } }
        // band
        if (y + len < y1) { const b = new Path2D(); b.rect(xm, y + len - 1.4, x1 - xm, 2.8); gild(b); }
        y += len; k++;
      }
      const ol = new Path2D(); ol.rect(x0, y0, x1 - x0, y1 - y0);
      cc.strokeStyle = C.ink; cc.lineWidth = 0.7; cc.stroke(ol); mm.strokeStyle = MAT.ink; mm.lineWidth = 0.7; mm.stroke(ol);
      cc.beginPath(); cc.moveTo(xm, y0); cc.lineTo(xm, y1); cc.lineWidth = 0.4; cc.stroke();
      // clasps joining the bar to the initial's frame
      for (const yy of [INI.y0 + 22, INI.y1 - 22]) {
        const cp = new Path2D(); cp.rect(x1, yy - 3, INI.x0 - x1, 6); gild(cp);
        cc.strokeStyle = C.ink; cc.lineWidth = 0.6; cc.stroke(cp);
        const kn = shapePath([[x1 + 4, yy - 6], [x1 + 12, yy - 7], [x1 + 18, yy], [x1 + 12, yy + 7], [x1 + 4, yy + 6], [x1 + 8, yy]], true);
        paint(kn, C.blue, 136); outline([[x1 + 4, yy - 6], [x1 + 12, yy - 7], [x1 + 18, yy], [x1 + 12, yy + 7], [x1 + 4, yy + 6], [x1 + 8, yy]], 0.5);
        hiLite([[x1 + 8, yy - 4], [x1 + 13, yy - 3], [x1 + 15, yy]], 0.7);
      }
    }
    // acanthus terminals at both ends of the bar
    const barTerminals = () => {
      acanthusLeaf([[206, BAR.y0 + 4], [205, BAR.y0 - 8], [198, BAR.y0 - 20], [186, BAR.y0 - 26], [176, BAR.y0 - 22], [175, BAR.y0 - 14], [181, BAR.y0 - 11]], 9, C.blue, C.rose, { lobes: 3, turn: 0.5 });
      acanthusLeaf([[206, BAR.y1 - 4], [205, BAR.y1 + 8], [198, BAR.y1 + 20], [186, BAR.y1 + 26], [176, BAR.y1 + 22], [175, BAR.y1 + 14], [181, BAR.y1 + 11]], 9, C.rose, C.blue, { lobes: 3, turn: 0.5 });
      for (const yy of [BAR.y0 - 2, BAR.y1 + 2]) { const g = goldDot(206, yy, 3.4); outline(ellPts(206, yy, 3.4, 3.4, 10), 0.45); void g; }
    };
    await tick();

    /* ================================================== IVY RINCEAUX */
    const leaves = [];     // gold or coloured ivy leaves to draw
    const tendrils = [];   // hairline paths
    const bezants = [];    // little burnished dots
    const sprigs = [];
    const STEMS = [
      // top margin: from the bar's head across the top and into the inner margin
      [[206, 196], [208, 168], [232, 150], [290, 146], [350, 160], [420, 172], [500, 176], [560, 178], [640, 176], [740, 178], [820, 172], [880, 148], [915, 112], [930, 70]],
      // inner margin, descending from the top
      [[880, 148], [908, 190], [922, 260], [916, 360], [921, 470], [922, 560], [918, 640], [924, 700]],
      // the hare's perch
      [[920, 1046], [904, 1018], [884, 1008], [862, 1010]],
      // foot: from the bar's foot through the bas-de-page and up the inner margin
      [[206, 1046], [196, 1100], [178, 1170], [160, 1240], [158, 1296], [176, 1330], [260, 1336], [400, 1337], [560, 1337], [700, 1334], [800, 1330], [870, 1300], [912, 1240], [926, 1150], [918, 1040], [930, 1000], [924, 860], [918, 760], [930, 700]],
      // perch for the bagpiper
      [[199, 606], [182, 640], [160, 684], [132, 718], [100, 733], [66, 735], [42, 726], [34, 712]],
    ];
    const stemPts = STEMS.map((s) => samp(s, false, 2));
    for (const P of stemPts) for (const p of P) occCircle(p[0], p[1], 2.2);
    // grow spiral branches off a polyline
    const rI = Rng(seed, 'ivy');
    function grow(x, y, a, len, k0, k1) {
      const pts = [[x, y]]; let s = 0;
      while (s < len) { const t = s / len; a += lerp(k0, k1, t * t) * 2; x += Math.cos(a) * 2; y += Math.sin(a) * 2; pts.push([x, y]); s += 2; }
      return { pts, a };
    }
    function tryBranch(x, y, a, side, scaleLen) {
      for (let attempt = 0; attempt < 5; attempt++) {
        const len = rI.r(26, 74) * (1 - attempt * 0.17) * (scaleLen || 1);
        const a0 = a + side * rI.r(0.5, 1.15);
        const k0 = side * rI.r(0.004, 0.02), k1 = side * rI.r(0.07, 0.15);
        const g = grow(x, y, a0, len, k0, k1);
        let ok = true;
        for (let i = 2; i < g.pts.length; i++) if (!occFree(g.pts[i][0], g.pts[i][1], 3.2, i < 7)) { ok = false; break; }
        if (!ok) continue;
        // leaves along the outer side of the curl
        const myLeaves = [];
        const nL = len > 50 ? rI.i(2, 3) : len > 30 ? rI.i(1, 2) : 1;
        for (let k = 0; k < nL; k++) {
          const t = nL === 1 ? rI.r(0.45, 0.7) : lerp(0.28, 0.82, k / (nL - 1)) + rI.r(-0.05, 0.05);
          const i = Math.floor(t * (g.pts.length - 1));
          const p = g.pts[i], q = g.pts[Math.min(g.pts.length - 1, i + 1)];
          const ta = Math.atan2(q[1] - p[1], q[0] - p[0]);
          const la = ta - side * rI.r(0.7, 1.3);
          const ll = rI.r(10, 15.5);
          const pl = rI.r(3, 6);
          const bx = p[0] + Math.cos(la) * pl, by = p[1] + Math.sin(la) * pl;
          const cx = bx + Math.cos(la) * ll * 0.5, cy = by + Math.sin(la) * ll * 0.5;
          if (occFree(cx, cy, ll * 0.55)) myLeaves.push({ x: p[0], y: p[1], bx, by, a: la, l: ll, kind: rI() < 0.8 ? 'gold' : rI.pick(['blue', 'rose', 'green']) });
        }
        // a tight hairline curl at the tip + bezant
        const tip = g.pts[g.pts.length - 1];
        for (let i = 3; i < g.pts.length; i++) occCircle(g.pts[i][0], g.pts[i][1], 2.6);
        for (const l of myLeaves) { occCircle(l.bx + Math.cos(l.a) * l.l * 0.5, l.by + Math.sin(l.a) * l.l * 0.5, l.l * 0.5); leaves.push(l); }
        tendrils.push(g.pts);
        if (rI.ch(0.55)) {
          const ba = g.a + side * 1.4;
          const bx = tip[0] + Math.cos(ba) * 4, by = tip[1] + Math.sin(ba) * 4;
          if (occFree(bx, by, 3)) { bezants.push([bx, by, rI.r(1.6, 2.3)]); occCircle(bx, by, 3); }
        }
        return g;
      }
      return null;
    }
    function branchAlong(P, spacing, sideBias) {
      let side = rI.ch(0.5) ? 1 : -1;
      for (let i = 4; i < P.length - 3; i += Math.max(3, Math.round(rI.r(spacing * 0.7, spacing * 1.3) / 2))) {
        const p = P[i], q = P[i + 1];
        const a = Math.atan2(q[1] - p[1], q[0] - p[0]);
        let sd = side; if (sideBias && rI.ch(0.65)) sd = sideBias;
        const g = tryBranch(p[0], p[1], a, sd);
        if (g && rI.ch(0.6)) {
          // a secondary branch from the middle of this one
          const j = Math.floor(g.pts.length * rI.r(0.3, 0.55));
          const pp = g.pts[j], qq = g.pts[j + 1];
          tryBranch(pp[0], pp[1], Math.atan2(qq[1] - pp[1], qq[0] - pp[0]), -sd, 0.6);
        }
        side = -side;
      }
    }
    for (const P of stemPts) branchAlong(P, 21);
    // sprays straight off the bar into the outer margin
    for (let y = BAR.y0 + 10; y < BAR.y1 - 10; y += rI.r(16, 26)) {
      tryBranch(BAR.x0 - 1, y, PI + rI.r(-0.3, 0.3), rI.ch(0.5) ? 1 : -1);
    }
    // secondary sweep to fill holes
    for (let pass = 0; pass < 3; pass++) {
      const T = tendrils.slice();
      for (const P of T) if (P.length > 10 && rI.ch(0.85)) {
        const j = Math.floor(P.length * rI.r(0.15, 0.5));
        const p = P[j], q = P[j + 1];
        tryBranch(p[0], p[1], Math.atan2(q[1] - p[1], q[0] - p[0]), rI.ch(0.5) ? 1 : -1, 0.7);
      }
    }
    // little pen sprigs in the remaining gaps (hairline twig with dot berries)
    for (let i = 0; i < 2600; i++) {
      const x = rI.r(30, PW - 30), y = rI.r(30, PH - 30);
      if (!occFree(x, y, 7)) continue;
      // must be near an existing tendril: test a ring
      let near = null;
      for (const P of tendrils) { for (let k = 0; k < P.length; k += 3) { const d = Math.hypot(P[k][0] - x, P[k][1] - y); if (d < 16 && d > 6) { near = P[k]; break; } } if (near) break; }
      if (!near) continue;
      sprigs.push([near[0], near[1], x, y]); occCircle(x, y, 7);
    }
    // draw stems & tendrils (hairline ink)
    {
      const st = new Path2D();
      for (const P of stemPts) { const path = ribbon(P, taper(1.0, 0.02, 0.15, 0.4, 0.15), false); if (path) st.addPath(path); }
      for (const P of tendrils) { const path = ribbon(P, taper(0.62, 0.0, 0.4, 0.25, 0.15), false); if (path) st.addPath(path); }
      inkF(st);
      // sprigs: tiny twig with three berries or a pen leaf
      const sp = new Path2D(), spB = new Path2D();
      for (const s of sprigs) {
        const [x0, y0, x1, y1] = s; const mx = (x0 + x1) / 2 + (y1 - y0) * 0.25, my = (y0 + y1) / 2 - (x1 - x0) * 0.25;
        sp.moveTo(x0, y0); sp.quadraticCurveTo(mx, my, x1, y1);
        const a = Math.atan2(y1 - my, x1 - mx);
        for (let k = -1; k <= 1; k++) { const bx = x1 + Math.cos(a + k * 0.7) * 2.6, by = y1 + Math.sin(a + k * 0.7) * 2.6; spB.moveTo(bx + 0.9, by); spB.arc(bx, by, 0.9, 0, TAU); }
      }
      cc.strokeStyle = C.ink; cc.lineWidth = 0.5; cc.stroke(sp);
      inkF(spB);
    }
    // leaves
    const LEAF = [[0.06, 0, 1], [0.0, -0.2], [0.12, -0.42], [0.36, -0.44, 1], [0.56, -0.3], [1.0, 0, 1], [0.56, 0.3], [0.36, 0.44, 1], [0.12, 0.42], [0.0, 0.2]];
    for (const l of leaves) {
      // petiole
      line([[l.x, l.y], [(l.x + l.bx) / 2, (l.y + l.by) / 2 + 0.3], [l.bx, l.by]], 0.6, C.ink, 0, 0.1, 0.6);
      push(); translate(l.bx, l.by); rotate(l.a); scale(l.l, l.l * rI.r(0.9, 1.1));
      const p = shapePath(LEAF, true);
      if (l.kind === 'gold') {
        gild(p); outline(LEAF, 0.55 / l.l);
        line([[0.08, 0], [0.45, 0.01], [0.78, 0]], 0.35 / l.l, C.ink, 0, 0.6, 0.2);
      } else {
        const colr = l.kind === 'blue' ? C.blue : l.kind === 'rose' ? C.rose : C.green;
        const dk = l.kind === 'blue' ? C.blueDk : l.kind === 'rose' ? C.roseDk : C.greenDk;
        paint(p, colr, 136);
        stroke([[0.1, 0.12], [0.45, 0.2], [0.85, 0.04]], 0.18, dk, 0.55);
        hiLite([[0.15, -0.05], [0.5, -0.07], [0.8, -0.02]], 0.07);
        outline(LEAF, 0.5 / l.l);
      }
      pop();
    }
    for (const b of bezants) { const p = new Path2D(); p.arc(b[0], b[1], b[2], 0, TAU); gild(p); cc.strokeStyle = C.ink; cc.lineWidth = 0.45; cc.stroke(p); }
    await tick();

    /* ======================================================= LOMBARDS */
    const LOMB = {
      A: [[[0.05, 1.0], [0.08, 0.6], [0.3, 0.2], [0.62, 0.02]], 0.22, [[0.62, 0.0], [0.64, 0.5], [0.66, 1.0]], 0.1, [[0.18, 0.58], [0.66, 0.55]], 0.035, [[0.42, 0.0], [0.86, 0.0]], 0.035, [[0.48, 1.0], [0.84, 1.0]], 0.035],
      D: [[[0.2, 0.02], [0.2, 0.5], [0.2, 0.98]], 0.2, [[0.2, 0.02], [0.62, 0.07], [0.88, 0.5], [0.62, 0.93], [0.2, 0.98]], 0.18, [[0.0, 0.02], [0.32, 0.02]], 0.035, [[0.0, 0.98], [0.32, 0.98]], 0.035],
      E: [[[0.8, 0.12], [0.4, 0.0], [0.08, 0.5], [0.4, 1.0], [0.82, 0.88]], 0.21, [[0.82, 0.04], [0.83, 0.5], [0.82, 0.96]], 0.03, [[0.14, 0.5], [0.62, 0.5]], 0.07],
      G: [[[0.82, 0.15], [0.45, 0.0], [0.08, 0.5], [0.45, 1.0], [0.82, 0.8]], 0.21, [[0.84, 0.82], [0.76, 0.52], [0.48, 0.48]], 0.08, [[0.86, 0.0], [0.86, 0.26]], 0.03],
      S: [[[0.85, 0.12], [0.5, 0.0], [0.14, 0.2], [0.3, 0.46], [0.72, 0.56], [0.86, 0.8], [0.5, 1.0], [0.1, 0.88]], 0.18, [[0.86, 0.0], [0.86, 0.22]], 0.03, [[0.1, 0.78], [0.1, 1.0]], 0.03],
      U: [[[0.18, 0.0], [0.1, 0.55], [0.45, 1.0], [0.76, 0.9]], 0.22, [[0.8, 0.0], [0.8, 1.0]], 0.08, [[0.0, 0.0], [0.34, 0.0]], 0.035, [[0.66, 0.0], [0.96, 0.0]], 0.035],
      Q: [[[0.5, 0.0], [0.08, 0.5], [0.5, 1.0]], 0.22, [[0.5, 0.0], [0.9, 0.5], [0.5, 1.0]], 0.12, [[0.48, 0.96], [0.8, 1.16], [1.08, 1.1]], 0.07],
      H: [[[0.2, 0.0], [0.2, 0.5], [0.2, 1.0]], 0.2, [[0.2, 0.5], [0.6, 0.34], [0.86, 0.6], [0.74, 0.96], [0.52, 1.06]], 0.14, [[0.0, 0.0], [0.34, 0.0]], 0.035],
      P: [[[0.25, 0.0], [0.25, 0.5], [0.25, 1.0]], 0.2, [[0.25, 0.04], [0.72, 0.08], [0.86, 0.34], [0.6, 0.6], [0.26, 0.58]], 0.13, [[0.04, 1.0], [0.46, 1.0]], 0.035],
      I: [[[0.4, 0.0], [0.42, 0.5], [0.4, 1.0]], 0.22, [[0.15, 0.0], [0.65, 0.0]], 0.035, [[0.15, 1.0], [0.65, 1.0]], 0.035],
      T: [[[0.05, 0.14], [0.5, 0.02], [0.95, 0.14]], 0.09, [[0.5, 0.05], [0.3, 0.5], [0.5, 0.95], [0.82, 0.86]], 0.2],
      M: [[[0.08, 1.0], [0.1, 0.3], [0.35, 0.02], [0.5, 0.25]], 0.16, [[0.5, 0.25], [0.65, 0.02], [0.9, 0.3], [0.86, 0.75], [0.7, 1.0]], 0.16, [[0.5, 0.22], [0.5, 1.0]], 0.08],
      O: [[[0.5, 0.0], [0.08, 0.5], [0.5, 1.0]], 0.22, [[0.5, 0.0], [0.92, 0.5], [0.5, 1.0]], 0.22],
      C: [[[0.8, 0.12], [0.45, 0.0], [0.08, 0.5], [0.45, 1.0], [0.8, 0.88]], 0.21, [[0.82, 0.0], [0.82, 0.24]], 0.03, [[0.82, 0.76], [0.82, 1.0]], 0.03],
      N: [[[0.15, 0.0], [0.15, 1.0]], 0.16, [[0.82, 0.0], [0.82, 1.0]], 0.08, [[0.15, 0.04], [0.5, 0.5], [0.82, 0.96]], 0.15],
    };
    LOMB.V = LOMB.U;
    function lombard(ch, x, y, h, kind) {
      const def = LOMB[ch] || LOMB.O;
      const wd = h * 0.92;
      for (let i = 0; i < def.length; i += 2) {
        const pts = def[i].map((p) => [x + p[0] * wd, y + p[1] * h]);
        const wm = def[i + 1] * h;
        const P = samp(pts, false, 0.4);
        const hair = wm < 0.06 * h;
        const path = ribbon(P, (t, s) => (hair ? wm : wm * (0.1 + 0.9 * Math.pow(Math.sin(PI * t), 0.85))), false);
        if (kind === 'gold') { gild(path); } else paint(path, C.blue, 136);
        if (kind === 'gold') { cc.strokeStyle = C.ink; cc.lineWidth = 0.4; cc.stroke(path); }
        else if (!hair) { // white highlight inside the blue
          const Q = P.map((p, k) => p);
          const hp = ribbon(Q, (t) => wm * 0.12 * Math.pow(Math.sin(PI * t), 2), false);
          if (hp) { cc.globalAlpha = 0.7; cc.fillStyle = C.white; cc.fill(hp); cc.globalAlpha = 1; }
        }
      }
    }
    // pen flourishing around a one-line initial
    function penwork(x, y, w, h, col, colIndex, rr) {
      const p = new Path2D();
      const left = x - 3;
      // halo of whiskers to the left
      for (let yy = y + 1; yy < y + h; yy += 2.3) { p.moveTo(left, yy); p.lineTo(left - rr.r(3, 7), yy + rr.r(-0.4, 0.4)); }
      // little circles with dots inside the counter area
      for (let k = 0; k < 3; k++) { const cx = x + w * rr.r(0.35, 0.6), cy = y + h * rr.r(0.25, 0.75); p.moveTo(cx + 1.3, cy); p.arc(cx, cy, 1.3, 0, TAU); }
      // vertical tail running down and up the margin with pearls and curls
      const tx = colIndex === 0 ? x - 12 : x - 14;
      const up = rr.r(18, 46), dn = rr.r(30, 88);
      p.moveTo(tx, y - up); p.lineTo(tx, y + h + dn);
      for (let yy = y - up + 4; yy < y + h + dn - 4; yy += rr.r(5, 8)) {
        const s = rr.ch(0.5) ? 1 : -1;
        p.moveTo(tx, yy); p.quadraticCurveTo(tx + s * 3, yy + 1, tx + s * 4.5, yy + 3.5);
        if (rr.ch(0.4)) { p.moveTo(tx + 1.1, yy + 2); p.arc(tx, yy + 2, 1.1, 0, TAU); }
      }
      // end curls
      for (const [yy, d] of [[y - up, -1], [y + h + dn, 1]]) {
        p.moveTo(tx, yy);
        let a = d * PI / 2, r = 5, cx = tx, cy = yy;
        for (let k = 0; k < 18; k++) { a += 0.42 * d; r *= 0.93; cx += Math.cos(a) * r * 0.42; cy += Math.sin(a) * r * 0.42; p.lineTo(cx, cy); }
      }
      // connector from the letter to the tail
      p.moveTo(left, y + h * 0.5); p.lineTo(tx, y + h * 0.5);
      cc.strokeStyle = col; cc.lineWidth = 0.42; cc.lineCap = 'round'; cc.stroke(p);
      mm.strokeStyle = MAT.ink; mm.lineWidth = 0.42; mm.stroke(p);
    }

    /* ======================================================= LINE FILLERS */
    function filler(f, rr) {
      const y0 = f.y + 1.5, y1 = f.y + XH - 1, x0 = f.x0, x1 = f.x1;
      const kind = rr.i(0, 2);
      const p = new Path2D(); p.rect(x0, y0, x1 - x0, y1 - y0);
      const c1 = rr.ch(0.5) ? C.blue : C.rose, c2 = c1 === C.blue ? C.rose : C.blue;
      if (kind === 0) {
        paint(p, c1, 134);
        const P = []; for (let x = x0 + 1.5, s = 0; x < x1 - 1; x += 3, s++) P.push([x, s % 2 ? y0 + 2 : y1 - 2]);
        if (P.length > 1) { const zp = ribbon(P, () => 0.55, false); cc.fillStyle = C.white; cc.fill(zp); }
        const gx = (x0 + x1) / 2; const g = new Path2D(); g.rect(gx - 3, y0 + 1, 6, y1 - y0 - 2); gild(g);
        cc.strokeStyle = C.ink; cc.lineWidth = 0.35; cc.stroke(g);
      } else if (kind === 1) {
        const mid = (x0 + x1) / 2;
        const a = new Path2D(); a.rect(x0, y0, mid - x0, y1 - y0); paint(a, c1, 134);
        const b = new Path2D(); b.rect(mid, y0, x1 - mid, y1 - y0); paint(b, c2, 134);
        const d = new Path2D();
        for (let x = x0 + 3; x < x1 - 2; x += 4.5) { d.moveTo(x + 0.7, (y0 + y1) / 2); d.arc(x, (y0 + y1) / 2, 0.7, 0, TAU); }
        cc.fillStyle = C.white; cc.fill(d);
        const g = new Path2D(); g.arc(mid, (y0 + y1) / 2, 3.2, 0, TAU); gild(g); cc.strokeStyle = C.ink; cc.lineWidth = 0.35; cc.stroke(g);
      } else {
        paint(p, c1, 134);
        const d = new Path2D();
        for (let x = x0 + 2.5; x < x1 - 2; x += 6) { d.moveTo(x, y0 + 1.5); d.lineTo(x + 3, (y0 + y1) / 2); d.lineTo(x, y1 - 1.5); }
        cc.strokeStyle = C.white; cc.lineWidth = 0.5; cc.stroke(d);
        for (const gx of [x0 + 2.5, x1 - 2.5]) { const g = new Path2D(); g.rect(gx - 1.6, y0 + 1, 3.2, y1 - y0 - 2); gild(g); }
      }
      cc.strokeStyle = C.ink; cc.lineWidth = 0.45; cc.stroke(p);
      mm.strokeStyle = MAT.ink; mm.lineWidth = 0.45; mm.stroke(p);
    }

    /* =================================================== WRITE THE PAGE */
    {
      const rr = Rng(seed, 'scribe');
      // rubric heading above the great initial
      const rubGs = glyphs(HOUR.rub.replace(/^\w/, (m) => m.toLowerCase()));
      const rwp = wordPaths(rubGs, COLS[0][0] + 2, ruleY(0), rr);
      // words with spaces: render separately
      let x = COLS[0][0] + 1.6;
      for (const w of HOUR.rub.toLowerCase().split(' ')) {
        const gsx = glyphs(w); const wp = wordPaths(gsx, x, ruleY(0), rr);
        drawWord(cc, wp, C.red, MAT.ink); x = wp.x1 + GAP;
      }
      void rwp;
      // the text
      let dip = 1, dipLeft = rr.i(6, 12);
      for (let k = 0; k < placed.length; k++) {
        const w = placed[k];
        if (--dipLeft <= 0) { dip = 1; dipLeft = rr.i(6, 14); }
        dip = Math.max(0, dip - rr.r(0.04, 0.09));
        const wp = wordPaths(w.gs, w.x, w.y, rr);
        let col;
        if (w.red) col = C.red;
        else { const t = dip; col = 'rgb(' + Math.round(lerp(70, 26, t)) + ',' + Math.round(lerp(50, 17, t)) + ',' + Math.round(lerp(34, 11, t)) + ')'; }
        drawWord(cc, wp, col, MAT.ink);
        if (w.touch) { const tp = new Path2D(); tp.rect(w.x - 1.8, w.y - 1, 2.2, XH + 1); cc.globalAlpha = 0.45; cc.fillStyle = C.red; cc.fill(tp); cc.globalAlpha = 1; }
        if (k % 40 === 39) await tick();
      }
      // initials with penwork, alternating gold/blue
      let alt = rr.i(0, 1);
      for (const it of initials) {
        const kind = alt++ % 2 ? 'gold' : 'blue';
        const h = XH + 9.5, y = it.y - 8.6;
        const colIndex = it.x > COLS[1][0] - 5 ? 1 : 0;
        penwork(it.x, y, 18, h, kind === 'gold' ? C.blue : C.red, colIndex, rr);
        lombard(it.ch, it.x + 0.5, y, h, kind);
        if (kind === 'gold') INIT_GOLD.push([it.x, y]);
      }
      for (const f of fillers) filler(f, rr);
    }
    await tick();

    /* ===================================================== GREAT INITIAL */
    const PUN = [];       // punch marks to tool into the gold once the gesso is raised
    const noPunch = [];   // painted shapes lying on the gold
    const inPath = (path, x, y) => cc.isPointInPath(path, (x - rx) * S, (y - ry) * S);
    const ident = (fn) => { push(); M = [1, 0, 0, 1, 0, 0]; fn(); pop(); };

    // a lobed acanthus leaf grown along a curling spine (local coords through M)
    function acanthusLeaf(spine, W, colA, colB, opt) {
      opt = opt || {};
      const P = samp(spine, false, 0.6);
      const n = P.length; if (n < 3) return null;
      const L = [0]; for (let i = 1; i < n; i++) L[i] = L[i - 1] + dist(P[i - 1], P[i]);
      const tot = L[n - 1], lobes = opt.lobes || 4, ws = W * mS();
      const lf = [], rt = [], md = [];
      for (let i = 0; i < n; i++) {
        const t = L[i] / tot;
        const a = P[Math.max(0, i - 1)], b = P[Math.min(n - 1, i + 1)];
        let dx = b[0] - a[0], dy = b[1] - a[1]; const dl = Math.hypot(dx, dy) || 1; dx /= dl; dy /= dl;
        const env = Math.pow(Math.sin(PI * Math.min(1, 0.04 + t * 0.97)), 0.6) * (1 - 0.3 * t);
        const u = (lobes * t + 0.15) % 1;
        const lob = 0.28 + 0.72 * Math.pow(u, 0.5) * (u > 0.88 ? (1 - u) / 0.12 * 0.7 + 0.3 : 1);
        const wl = ws * env * lob, wr = ws * env * (opt.turn || 0.5);
        lf.push([P[i][0] - dy * wl, P[i][1] + dx * wl]);
        rt.push([P[i][0] + dy * wr, P[i][1] - dx * wr]);
        md.push([P[i][0] - dy * wl * 0.5, P[i][1] + dx * wl * 0.5]);
      }
      const path = new Path2D(); path.moveTo(lf[0][0], lf[0][1]);
      for (const p of lf) path.lineTo(p[0], p[1]); for (let i = n - 1; i >= 0; i--) path.lineTo(rt[i][0], rt[i][1]); path.closePath();
      paint(path, colA, 138);
      const tp = new Path2D(); tp.moveTo(P[0][0], P[0][1]); for (const p of P) tp.lineTo(p[0], p[1]); for (let i = n - 1; i >= 0; i--) tp.lineTo(rt[i][0], rt[i][1]); tp.closePath();
      paint(tp, colB, 139);
      const dk = colA === C.blue ? C.blueDk : colA === C.rose ? C.roseDk : colA === C.green ? C.greenDk : C.ochreDk;
      ident(() => {
        stroke(P, 1.6 * ws / 9, dk, 0.55, 0.05, 0.5);
        stroke(md.slice(Math.floor(n * 0.08), Math.floor(n * 0.85)), 0.9 * ws / 9, C.white, 0.85, 0.3, 0.5);
        // lobe veins
        for (let k = 1; k < lobes * 2; k += 2) {
          const i = Math.floor((k / (lobes * 2)) * (n - 1));
          if (i > 1 && i < n - 2) stroke([P[i], [(P[i][0] + lf[i][0]) / 2, (P[i][1] + lf[i][1]) / 2], lf[i]], 0.5 * ws / 9, dk, 0.6, 0.1, 0.6);
        }
        const ring = lf.concat(rt.slice().reverse());
        const op = ribbon(ring, () => 0.5, true); if (op) inkF(op);
      });
      noPunch.push(path);
      return path;
    }

    drawGreatInitial();
    barTerminals();
    await tick();

    function drawGreatInitial() {
      const { x0, y0, x1, y1 } = INI;
      const fr = new Path2D(); fr.rect(x0, y0, x1 - x0, y1 - y0);
      gild(fr);
      const sx0 = x0 + 17, sx1 = sx0 + 34, ty = y0 + 13, by = y1 - 13, cy = (ty + by) / 2;
      const ocx = sx1 + 86, orx = x1 - 14 - ocx, ory = (by - ty) / 2;
      const icx = ocx - 6, irx = orx - 38, iry = ory - 27;
      const ell = (cx, rx_, ry_, k0, k1, n) => { const o = []; for (let k = 0; k <= n; k++) { const a = -PI / 2 + PI * (k0 + (k1 - k0) * k / n); o.push([cx + Math.cos(a) * rx_, cy + Math.sin(a) * ry_]); } return o; };
      const outer = [[sx0, ty, 1], [sx1 + 30, ty]].concat(ell(ocx, orx, ory, 0, 1, 18)).concat([[sx1 + 30, by], [sx0, by, 1]]);
      const inner = [[sx1, cy - iry, 1], [icx - 50, cy - iry]].concat(ell(icx, irx, iry, 0, 1, 18)).concat([[icx - 50, cy + iry], [sx1, cy + iry, 1]]);
      INI.counter = { x: sx1, y: cy - iry, icx, irx, iry, cy };
      const outerP = shapePath(outer, true), innerP = shapePath(inner, true);
      gg.fillStyle = '#000'; gg.fill(outerP);
      paint(outerP, C.blue, 141);
      // bowl modelling: dark along the counter, light along the outside
      stroke(ell(icx + 2, irx + 6, iry + 5, 0.02, 0.98, 24), 7, C.blueDk, 0.55, 0.15, 0.15);
      stroke(ell(ocx - 1, orx - 6, ory - 5, 0.04, 0.96, 24), 5, C.blueLt, 0.45, 0.2, 0.2);
      stroke([[sx1 + 4, ty + 6], [ocx, ty + 6]], 3.4, C.blueLt, 0.35, 0.3, 0.05);
      stroke([[sx1 + 4, by - 6], [ocx, by - 6]], 4, C.blueDk, 0.4, 0.3, 0.05);
      // white tracery: a running vine of leaflets along the middle of the bowl
      const mid = [[sx1 + 6, (ty + cy - iry) / 2]].concat(ell((ocx + icx) / 2, (orx + irx) / 2, (ory + iry) / 2, 0, 1, 28)).concat([[sx1 + 6, (by + cy + iry) / 2]]);
      const rr = Rng(seed, 'initial');
      {
        const P = samp(mid, false, 1);
        ident(() => {
          const pth = ribbon(P, () => 0.55, false); cc.fillStyle = C.white; cc.globalAlpha = 0.9; cc.fill(pth); cc.globalAlpha = 1;
          for (let i = 6, sd = 1; i < P.length - 6; i += 7, sd = -sd) {
            const a = P[i], b = P[i + 1]; const ang = Math.atan2(b[1] - a[1], b[0] - a[0]) + sd * 0.9;
            const tip = [a[0] + Math.cos(ang) * 6, a[1] + Math.sin(ang) * 6];
            const c1 = [a[0] + Math.cos(ang + sd * 0.5) * 3.5, a[1] + Math.sin(ang + sd * 0.5) * 3.5];
            stroke([a, c1, tip], 1.3, C.white, 0.85, 0.1, 0.6);
            if ((i / 7) % 3 === 1) for (let k = 0; k < 3; k++) { const q = [a[0] - Math.cos(ang) * (5 + k * 0.1) + Math.cos(ang + 1.6) * (k - 1) * 1.6, a[1] - Math.sin(ang) * 5 + Math.sin(ang + 1.6) * (k - 1) * 1.6]; const d = new Path2D(); d.arc(q[0], q[1], 0.65, 0, TAU); cc.fillStyle = C.white; cc.fill(d); }
          }
        });
      }
      // the stem, in rose
      const stemP = shapePath([[sx0, ty, 1], [sx1, ty, 1], [sx1, by, 1], [sx0, by, 1]], true);
      paint(stemP, C.rose, 142);
      stroke([[sx0 + 4, ty + 4], [sx0 + 4, by - 4]], 5, C.roseDk, 0.55, 0.05, 0.05);
      stroke([[sx1 - 5, ty + 5], [sx1 - 5, by - 5]], 3.5, C.roseLt, 0.75, 0.05, 0.05);
      {
        // white tracery in the stem: a stem with alternating trefoils
        const sxm = (sx0 + sx1) / 2 + 1; const P = [];
        for (let y = ty + 8; y <= by - 8; y += 2) P.push([sxm + Math.sin((y - ty) * 0.16) * 3.2, y]);
        ident(() => {
          const pth = ribbon(P, () => 0.55, false); cc.fillStyle = C.white; cc.fill(pth);
          for (let i = 4, sd = 1; i < P.length - 4; i += 8, sd = -sd) {
            const a = P[i]; const tip = [a[0] + sd * 6.5, a[1] - 3];
            stroke([a, [a[0] + sd * 3, a[1] - 3.5], tip], 1.3, C.white, 0.9, 0.1, 0.6);
            for (let k = 0; k < 3; k++) { const d = new Path2D(); d.arc(a[0] - sd * 5 + (k === 1 ? -sd * 1.4 : 0), a[1] + 2 + (k - 1) * 1.6, 0.6, 0, TAU); cc.fillStyle = C.white; cc.fill(d); }
          }
        });
      }
      // counter: deep blue diaper with a lattice of shell gold and gold-leaf studs
      paint(innerP, '#1d2f6e', 132);
      for (const ctx of [cc, mm, hh, gg]) { ctx.save(); ctx.clip(innerP); }
      {
        const d = 12.5, lat = new Path2D(), studs = new Path2D(), qf = new Path2D();
        const cxm = INI.counter.x, cym = INI.counter.y;
        for (let k = -24; k <= 24; k++) {
          lat.moveTo(cxm + k * d - 200, cym - 200); lat.lineTo(cxm + k * d + 200, cym + 200);
          lat.moveTo(cxm + k * d + 200, cym - 200); lat.lineTo(cxm + k * d - 200, cym + 200);
        }
        for (let i = -16; i <= 16; i++) for (let j = 0; j <= 18; j++) {
          const sx = cxm + i * d + (j % 2) * d / 2, sy = cym + j * d / 2;
          studs.moveTo(sx + 1.15, sy); studs.arc(sx, sy, 1.15, 0, TAU);
          const qx = sx + d / 2, qy = sy;
          for (let k = 0; k < 4; k++) { const ax = qx + Math.cos(k * PI / 2) * 1.5, ay = qy + Math.sin(k * PI / 2) * 1.5; qf.moveTo(ax + 0.75, ay); qf.arc(ax, ay, 0.75, 0, TAU); }
        }
        cc.strokeStyle = '#b8923f'; cc.lineWidth = 0.75; cc.stroke(lat);
        mm.strokeStyle = MAT.shell; mm.lineWidth = 0.75; mm.stroke(lat);
        cc.fillStyle = 'rgba(232,236,246,0.75)'; cc.fill(qf);
        gild(studs);
      }
      for (const ctx of [cc, mm, hh, gg]) ctx.restore();
      INI.innerP = innerP; INI.outerP = outerP;
      outline(outer, 0.85); outline(inner, 0.75);
      outline([[sx0, ty, 1], [sx1, ty, 1], [sx1, by, 1], [sx0, by, 1]], 0.6);
      // in the spandrels: a sprig of painted trefoils growing from the bowl
      const at = (k, rxx, ryy) => { const a = -PI / 2 + PI * k; return [ocx + Math.cos(a) * rxx, cy + Math.sin(a) * ryy]; };
      for (const sg of [1, -1]) {
        const b0 = at(sg > 0 ? 0.16 : 0.84, orx + 1, ory + 1);
        const tip = [x1 - 13, cy - sg * (ory - 2)];
        const mid = [(b0[0] + tip[0]) / 2 + 6, (b0[1] + tip[1]) / 2 - sg * 8];
        line([b0, mid, tip], 0.7, C.ink, 0.05, 0.2, 0.5);
        const tref = (x, y, a, sz, col, dk) => {
          push(); translate(x, y); rotate(a); scale(sz);
          for (const da of [-0.95, 0, 0.95]) {
            push(); rotate(da);
            const lf = [[0, 0, 1], [0.32, -0.3], [0.78, -0.26], [1.0, 0, 1], [0.78, 0.26], [0.32, 0.3]];
            const lp = blob(lf, col, 0.5 / sz); noPunch.push(lp);
            stroke([[0.18, 0.02], [0.6, 0.06], [0.86, 0.02]], 0.12, dk, 0.6);
            hiLite([[0.22, -0.1], [0.55, -0.16], [0.8, -0.08]], 0.06, 0.8);
            pop();
          }
          pop();
          const gp = goldDot(x, y, 1.3); noPunch.push(gp);
        };
        tref(tip[0] - 1, tip[1] + sg * 1, -PI / 2 * sg - 0.5 * sg, 11, sg > 0 ? C.rose : C.blue, sg > 0 ? C.roseDk : C.blueDk);
        tref(mid[0] + 3, mid[1] + sg * 2, -PI / 2 * sg + 0.9 * sg, 7, C.green, C.greenDk);
      }
      // frame
      cc.strokeStyle = C.ink; cc.lineWidth = 1.0; cc.stroke(fr); mm.strokeStyle = MAT.ink; mm.lineWidth = 1.0; mm.stroke(fr);
      // tooling: a row of dots inside the frame, a row following the letter, rosettes in the spandrels
      const ok = (x, y) => !inPath(outerP, x, y) && !noPunch.some((pp) => inPath(pp, x, y));
      for (let x = x0 + 4.5; x < x1 - 3; x += 4.1) { PUN.push([x, y0 + 4.5, 1.1]); PUN.push([x, y1 - 4.5, 1.1]); }
      for (let y = y0 + 8.6; y < y1 - 6; y += 4.1) { PUN.push([x0 + 4.5, y, 1.1]); PUN.push([x1 - 4.5, y, 1.1]); }
      {
        const P = samp(outer, true, 4.0);
        ident(() => {});
        for (let i = 0; i < P.length; i++) {
          const a = P[(i + P.length - 1) % P.length], b = P[(i + 1) % P.length];
          let nx = b[1] - a[1], ny = -(b[0] - a[0]); const l = Math.hypot(nx, ny) || 1; nx /= l; ny /= l;
          let q = [P[i][0] + nx * 4.5, P[i][1] + ny * 4.5];
          if (inPath(outerP, q[0], q[1])) q = [P[i][0] - nx * 4.5, P[i][1] - ny * 4.5];
          if (q[0] > x0 + 7 && q[0] < x1 - 7 && q[1] > y0 + 7 && q[1] < y1 - 7 && ok(q[0], q[1])) PUN.push([q[0], q[1], 1.0]);
        }
      }
      // punched scrolls: dotted spirals tooled into the spandrels
      for (const sg of [1, -1]) {
        for (const [ax, ay, a0, r0] of [[x1 - 34, cy - sg * (ory - 34), 0.4, 15], [x1 - 64, cy - sg * (ory - 8), 2.1, 10]]) {
          let a = a0, r = r0;
          for (let k = 0; k < 40 && r > 2.5; k++) { const px = ax + Math.cos(a) * r, py = ay + sg * Math.sin(a) * r; if (ok(px, py)) PUN.push([px, py, 0.95]); a += 3.2 / r; r *= 0.975; }
        }
      }
      const ros = (cx, cy2, r) => { if (!ok(cx, cy2)) return; PUN.push([cx, cy2, 1.5]); for (let k = 0; k < 6; k++) { const px = cx + Math.cos(k * TAU / 6) * r, py = cy2 + Math.sin(k * TAU / 6) * r; if (ok(px, py)) PUN.push([px, py, 1.05]); } };
      for (let i = 0; i < 70; i++) {
        const px = rr.r(x0 + 12, x1 - 12), py = rr.r(y0 + 12, y1 - 12);
        if (!ok(px, py) || !ok(px + 5, py) || !ok(px - 5, py) || !ok(px, py + 5) || !ok(px, py - 5)) continue;
        if (PUN.some((q) => Math.hypot(q[0] - px, q[1] - py) < 9)) continue;
        ros(px, py, 3.4);
      }
    }

    /* -------------------------------------- the scribe, his desk, his cat */
    scribeScene();
    await tick();
    function scribeScene() {
      const cn = INI.counter;
      for (const ctx of [cc, mm, hh, gg]) { ctx.save(); ctx.clip(INI.innerP); }
      push(); translate(cn.x, cn.y);
      // tiled floor, chequered rose and white
      blob([[-10, 148, 1], [200, 148, 1], [200, 200, 1], [-10, 200, 1]], '#c97f86', 0.6, 134);
      {
        const rr = Rng(seed, 'floor');
        for (let row = 0; row < 3; row++) for (let k = -4; k < 18; k++) {
          if ((k + row) % 2) continue;
          const yA = 148 + row * 9, yB = 148 + (row + 1) * 9;
          const xA = k * 13 - row * 4, xB = xA + 13;
          blob([[xA, yA, 1], [xB, yA, 1], [xB - 4, yB, 1], [xA - 4, yB, 1]], '#efe4d0', 0, 134);
          if (rr.ch(0.5)) dot(xA + 4.5 - row * 2, yA + 4.5, 0.9, '#c97f86');
        }
        for (let row = 0; row <= 3; row++) line([[-10, 148 + row * 9], [200, 148 + row * 9]], 0.35, C.ink, 0, 0, 1);
      }
      stroke([[-10, 148.8], [200, 148.8]], 0.9, '#f6e9e6', 0.7, 0, 0);
      // bench
      const wood = '#a86f37', woodDk = '#5f3a19', woodLt = '#dba868';
      blob([[1, 123, 1], [50, 123, 1], [50, 129, 1], [1, 129, 1]], wood, 0.5);
      blob([[5, 129, 1], [9.5, 129, 1], [9, 149, 1], [4.5, 149, 1]], '#8a5a2b', 0.45);
      blob([[40, 129, 1], [44.5, 129, 1], [45, 149, 1], [40.5, 149, 1]], '#8a5a2b', 0.45);
      stroke([[3, 124.4], [48, 124.4]], 0.9, woodLt, 0.8, 0.1, 0.1);
      // desk: sloped top on a box on a turned column
      blob([[100, 146, 1], [126, 146, 1], [131, 151, 1], [95, 151, 1]], wood, 0.5);
      blob([[109, 110, 1], [118, 109, 1], [117, 122], [119, 128], [117, 134], [118, 146, 1], [109, 146, 1], [110, 134], [108, 128], [110, 122]], wood, 0.5);
      stroke([[115.5, 112], [116, 144]], 1.5, woodDk, 0.5, 0.1, 0.1);
      blob([[84, 99, 1], [146, 76.5, 1], [146, 108, 1], [86, 115, 1]], wood, 0.55);
      stroke([[90, 112], [143, 106]], 1.4, woodDk, 0.5, 0.1, 0.1);
      for (const xx of [104, 124]) { blob([[xx, 95.5 - (xx - 84) * 0.36, 1], [xx + 12, 91.2 - (xx - 84) * 0.36, 1], [xx + 12, 104.5, 1], [xx, 107.4, 1]], '#94602e', 0.4); }
      blob([[78, 96, 1], [150, 70, 1], [152, 73.5, 1], [80, 100, 1]], woodLt, 0.5);
      // the open book
      const bk = [[88, 92.5, 1], [113, 83.5], [139, 74.5, 1], [140, 71, 1], [126, 74.2], [113, 79.5, 1], [100, 82], [87, 89, 1]];
      blob(bk, '#f6efdc', 0.45, 134);
      line([[113, 83.4], [113, 79.6]], 0.4, C.ink, 0, 0, 1);
      for (let k = 0; k < 4; k++) {
        line([[90 + k * 0.6, 89.6 - k * 1.1], [110, 82.6 - k * 1.1]], 0.32, k === 0 ? C.red : C.ink, 0, 0, 1);
        line([[116, 81.4 - k * 1.1], [137, 74.2 - k * 1.1]], 0.32, C.ink, 0, 0, 1);
      }
      line([[118, 81], [119, 92], [117.5, 97]], 0.9, C.red, 0, 0.3, 0.6); // ribbon bookmark
      // the ink: a black flood across the page, a rivulet down the slope, drops
      const ink = '#0f0b08';
      blob([[84.5, 91.6], [90, 88.2], [97, 84.6], [104, 81.4], [109, 79.6], [112.5, 82.6], [109, 86.6], [104, 87.4], [100, 90.6], [94, 93.6], [87, 96.2]], ink, 0, 128);
      blob([[98, 90.6], [101, 91.4], [100.4, 95.6], [98.6, 96]], ink, 0, 128);
      line([[90, 92.8], [85.5, 94.2], [82, 96.2], [80.2, 99.2]], 1.7, ink, 0.05, 0.1, 0.6);
      for (const [dx, dy, r] of [[79.8, 103.4, 0.85], [79.4, 109.6, 0.7], [79.2, 116, 0.6]]) dot(dx, dy, r, C.ink);
      blob([[73, 149.6], [78, 148.8], [83, 149.4], [82, 150.6], [76, 151]], ink, 0, 128);
      stroke([[92, 90.2], [100, 86.6], [106, 83.4]], 0.8, '#8a7c72', 0.85);
      // the inkhorn, rolled over on the book, mouth downhill
      push(); translate(108.5, 81); rotate(-0.36);
      scale(1.25);
      blob([[0, -3.8], [6, -3.4], [12, -2.0], [16.5, -0.2, 1], [12, 1.6], [6, 3.1], [0, 3.6]], '#c9a067', 0.4);
      stroke([[1, 2.4], [8, 2.2], [13, 0.9]], 1.2, '#7d5a2c', 0.7);
      blob(ellPts(0, -0.1, 1.3, 3.6, 10), '#0a0806', 0.3);
      stroke([[2, -2.2], [8, -2.0], [13, -0.9]], 0.9, '#f3dcb0', 0.85);
      line([[5, -3.3], [5, 3.0]], 0.35, '#c9a24e', 0, 0, 1); line([[9, -2.7], [9, 2.4]], 0.35, '#c9a24e', 0, 0, 1);
      pop();
      // the cat, at the high end of the desk, paw still raised, looking straight at us
      const ginger = '#d98b3e', gingerDk = '#9a5121', gingerLt = '#f4c684';
      const tail = [[155.5, 62.5], [161.5, 55.5], [163, 46.5], [160.5, 39.5], [155.5, 37], [153, 39.2]];
      line(tail, 3.6, ginger, 0.05, 0.2, 0.4);
      outline(tail, 0.32, C.ink, false);
      for (const t of [[161.3, 54], [162.6, 47], [160.4, 41]]) line([[t[0] - 1.8, t[1] + 0.2], [t[0] + 1.6, t[1] - 0.4]], 0.7, gingerDk, 0.2, 0.2, 0.3);
      blob([[146, 61], [153, 58.5], [158.4, 63.5], [156, 68], [155, 70.8, 1], [150, 70.8], [151, 67.5], [147, 66.4]], ginger, 0.45); // haunch & hind paw
      blob([[127, 66], [131.5, 66], [132, 74.4], [128, 75.6, 1], [126.3, 72]], ginger, 0.45); // planted fore leg
      const body = [[126, 67], [127.5, 61], [131.5, 57.2], [138, 56.8], [145, 56.4], [151, 55.2], [156, 57.2], [158.2, 62], [156.6, 67.2], [151, 69.2], [146, 67.4], [140, 67.8], [134, 70], [129, 70.6]];
      blob(body, ginger, 0.55);
      stroke([[131, 59.6], [142, 58.6], [153, 60]], 1.7, gingerLt, 0.7);
      for (const sx of [136, 141, 146.5, 151.5]) stroke([[sx, 57.4], [sx + 1.6, 61.4], [sx + 0.6, 65.4]], 1.15, gingerDk, 0.85, 0.15, 0.6);
      stroke([[130, 69.2], [137, 68.6], [144, 66.8]], 1.3, gingerDk, 0.4);
      blob([[129, 62.5], [131, 66.5], [133, 70.4], [129.5, 70.2], [127.4, 66.6]], '#fbead0', 0); // white chest
      // the raised paw that did it
      blob([[127.5, 61.5], [122.5, 58.4], [117.2, 58], [115.6, 60.6], [117.4, 63], [122.8, 64.2], [127.5, 66]], ginger, 0.45);
      line([[116.6, 59.4], [118.6, 59.9]], 0.28, C.ink, 0, 0, 1); line([[116.2, 61.3], [118.2, 61.5]], 0.28, C.ink, 0, 0, 1);
      // head
      blob([[118.5, 50.5], [118.6, 42.4, 1], [122.6, 45.6], [127.6, 45.6], [132, 42.2, 1], [132.2, 50.5], [130.8, 55.6], [125.3, 58.8], [119.8, 55.6]], ginger, 0.5);
      blob([[119.4, 48], [119.4, 44.2, 1], [121.6, 46.2]], '#e9a0a0', 0);
      blob([[131.2, 48], [131.2, 44.1, 1], [129, 46.2]], '#e9a0a0', 0);
      stroke([[122.6, 47.4], [125.3, 49.6], [128, 47.4]], 0.9, gingerDk, 0.9, 0.2, 0.2);
      blob([[121.2, 52.4], [125.3, 50.8], [129.4, 52.4], [128.2, 56], [125.3, 57], [122.4, 56]], '#fbead0', 0);
      for (const ex of [121.9, 128.7]) { blob(ellPts(ex, 49.4, 1.75, 1.45, 10), '#c6d257', 0.3); blob([[ex, 48.1], [ex + 0.5, 49.4], [ex, 50.7], [ex - 0.5, 49.4]], C.ink, 0); }
      blob([[124.4, 51.8], [126.2, 51.8], [125.3, 53]], '#d4767a', 0.2);
      line([[123.2, 54.1], [124.3, 55], [125.3, 54], [126.3, 55], [127.4, 54.1]], 0.36, C.ink, 0, 0, 1);
      for (const k of [-1, 1]) for (const dy of [-0.7, 0.6]) line([[125.3 + k * 2.6, 53.6 + dy], [125.3 + k * 9.5, 52.4 + dy * 2.6]], 0.22, C.ink, 0, 0.3, 0.4);
      pop();
      for (const ctx of [cc, mm, hh, gg]) ctx.restore();
      // the scribe himself
      for (const ctx of [cc, mm, hh, gg]) { ctx.save(); ctx.clip(INI.innerP); }
      push(); translate(cn.x, cn.y);
      const hab = '#8b6143', habDk = '#4b2f1d', habLt = '#c9a07a', hab2 = '#9c7151';
      blob([[27, 80], [29, 64], [39, 55.5], [52, 57], [57, 65], [48, 75], [38, 80]], '#6f4c33', 0.5); // cowl
      stroke([[33, 74], [36, 63], [45, 59]], 1.3, habDk, 0.6);
      const habit = [[18, 150, 1], [14, 134], [15, 117], [20, 99], [28, 84], [38, 72], [49, 65], [58, 66], [63, 76], [65, 92], [67, 105], [72, 113.5], [86, 116], [93, 123.5], [92.5, 140], [98, 150, 1]];
      blob(habit, hab, 0.6);
      for (const f of [[[30, 84], [23, 102], [21, 124], [23, 146]], [[42, 76], [36, 96], [35, 116]], [[66, 108], [78, 116], [90, 120.5]], [[45, 124], [42, 136], [44, 148]], [[60, 122], [58, 134], [61, 148]], [[77, 121], [80, 134], [83, 148]]]) stroke(f, 2.3, habDk, 0.65);
      for (const f of [[[35, 80], [28, 100], [27, 122]], [[51, 123], [49, 136], [51, 146]], [[69, 121], [72, 134], [74, 146]], [[86, 123], [88, 134], [90, 146]]]) hiLite(f, 1.0, 0.6);
      // rope girdle with knotted end
      line([[17, 110], [30, 112], [45, 112.5], [58, 111], [66, 108.5]], 0.9, '#efe6d2', 0, 0, 1);
      line([[58, 111], [59.5, 120], [58, 129], [60, 137]], 0.8, '#efe6d2', 0, 0.1, 0.6);
      for (const ky of [119, 127, 135]) dot(59 + (ky % 2 ? 0.4 : -0.3), ky, 1.0, '#efe6d2');
      blob([[94, 147.6], [101, 146.6], [104, 149], [101, 150.8], [94, 150.8]], '#2a211b', 0.35); // shoe
      // the quill hand in his lap, letting go
      blob([[57, 84], [66, 86], [75, 102], [80, 111], [71, 114.5], [63, 104]], hab2, 0.5);
      stroke([[62, 90], [70, 104], [74, 112]], 1.6, habDk, 0.6);
      blob([[73.5, 110.5], [79, 108.5], [84.5, 110.4], [86.6, 112.6], [85.4, 114.2], [83.4, 113.6], [84.4, 116], [82.6, 117.4], [79, 116.6], [75.5, 116.4]], C.flesh, 0.4);
      line([[80, 113.2], [83.2, 114.4]], 0.25, C.fleshDk, 0, 0.2, 0.5);
      line([[84.5, 113], [90, 122], [96, 134.5], [99, 140]], 0.5, C.ink, 0, 0.1, 0.6);
      blob([[88.5, 117], [92.5, 117.5], [99, 128.5], [99.5, 136], [96.5, 133], [90.5, 123.5]], '#f4efe6', 0.35);
      stroke([[90.6, 119.5], [94.2, 125.5], [97.4, 132]], 0.5, '#9a8e84', 0.8);
      // head, tilted into his hand, fast asleep
      push(); translate(59.5, 47); rotate(0.36); scale(10.2, 11.6);
      const head = [[0, -1.0], [0.68, -0.76], [0.98, -0.08], [0.84, 0.56], [0.36, 1.0], [-0.34, 0.94], [-0.82, 0.5], [-0.98, -0.16], [-0.72, -0.74]];
      blob(head, C.flesh, 0.05);
      blob([[-1.0, -0.12], [-0.86, -0.62], [-0.42, -0.9], [0.18, -0.96], [0.66, -0.76], [0.92, -0.38], [0.64, -0.5], [0.12, -0.66], [-0.44, -0.56], [-0.72, -0.18], [-0.76, 0.3], [-0.9, 0.34]], '#5a3b22', 0.04);
      blob([[-0.38, -0.86], [0.12, -0.98], [0.56, -0.84], [0.5, -0.7], [0.08, -0.74], [-0.32, -0.68]], '#f8e6d2', 0);
      blob([[-0.64, 0.02], [-0.5, -0.12], [-0.4, 0.12], [-0.48, 0.32], [-0.62, 0.26]], C.fleshDk, 0.04);
      line([[-0.04, -0.06], [0.14, 0.05], [0.33, 0.01]], 0.075, C.ink, 0.1, 0.1, 0.4);
      line([[0.47, -0.08], [0.6, 0.01], [0.75, -0.05]], 0.075, C.ink, 0.1, 0.1, 0.4);
      line([[-0.06, -0.31], [0.16, -0.38], [0.33, -0.31]], 0.06, '#5a3b22', 0.2, 0.2, 0.4);
      line([[0.45, -0.33], [0.62, -0.38], [0.77, -0.29]], 0.06, '#5a3b22', 0.2, 0.2, 0.4);
      line([[0.42, 0.0], [0.55, 0.24], [0.63, 0.36], [0.5, 0.42]], 0.06, C.fleshDk, 0.2, 0.2, 0.5);
      blob(ellPts(0.33, 0.66, 0.12, 0.1, 10), '#5b2420', 0.02);
      dot(0.1, 0.42, 0.14, C.cheek);
      pop();
      // zzz-less sleep: a drip of drool, as any illuminator would note
      line([[63.5, 56.4], [63.2, 59.5]], 0.35, '#c8d8e8', 0, 0.2, 0.6);
      // the arm propping the head: sleeve on the desk, hand at the cheek
      blob([[52, 68], [62, 65], [77, 77], [88, 86], [89.5, 95], [79, 98.5], [66, 90], [56, 80]], hab2, 0.55);
      stroke([[58, 72], [72, 84], [85, 93]], 2, habDk, 0.55);
      blob([[80, 92], [89, 92.5], [87, 81], [79.5, 66], [75, 58.5], [69, 61.5], [71, 71], [76, 84]], hab2, 0.55);
      hiLite([[85.5, 89], [82, 78], [77, 67]], 1.0, 0.7);
      stroke([[78, 91], [74, 79], [71, 68]], 1.4, habDk, 0.5);
      blob([[68.5, 62], [68, 55], [69.5, 50.5], [71.5, 49.6], [72.5, 51.5], [73.5, 48.6], [75.4, 48.8], [75.6, 51.6], [77.2, 50.4], [78.6, 51.8], [77.8, 57.5], [74, 62.5]], C.flesh, 0.42);
      line([[72.6, 52], [72.4, 56]], 0.28, C.fleshDk, 0, 0.2, 0.5); line([[75.5, 52], [75.2, 56]], 0.28, C.fleshDk, 0, 0.2, 0.5);
      pop();
      for (const ctx of [cc, mm, hh, gg]) ctx.restore();
    }

    /* ================================================== BAS-DE-PAGE */
    const GY = 1334; // the ground line of the bas-de-page
    // chain mail: grey with rows of tiny rings, clipped to a shape
    function mail(pts, base) {
      const path = shapePath(pts, true);
      paint(path, base || '#9a9c9a', 135);
      const T = tf(pts); let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      for (const p of T) { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); }
      cc.save(); cc.clip(path); hh.save(); hh.clip(path);
      const rg = new Path2D(), hl = new Path2D(); let row = 0;
      for (let y = y0 - 1; y < y1 + 2; y += 1.9, row++) for (let x = x0 - 2 + (row % 2) * 1.05; x < x1 + 2; x += 2.1) {
        rg.moveTo(x + 0.95, y); rg.arc(x, y, 0.95, 0, PI);
        if ((row + Math.round(x)) % 3 === 0) { hl.moveTo(x - 0.6, y - 0.35); hl.lineTo(x + 0.2, y - 0.6); }
      }
      cc.strokeStyle = 'rgba(38,38,40,0.8)'; cc.lineWidth = 0.42; cc.stroke(rg);
      cc.strokeStyle = 'rgba(255,255,255,0.55)'; cc.lineWidth = 0.35; cc.stroke(hl);
      hh.strokeStyle = 'rgb(140,140,140)'; hh.lineWidth = 0.5; hh.stroke(rg);
      cc.restore(); hh.restore();
      outline(pts, 0.55);
      return path;
    }
    function plate(pts, col) {
      const p = blob(pts, col || '#b7bcbf', 0.55, 140);
      return p;
    }
    // ground: a grassy strip for the duel
    {
      const rg = Rng(seed, 'ground');
      const gpts = [[228, GY + 1.5, 1]];
      for (let x = 236; x <= 792; x += 14) gpts.push([x, GY - 4.5 - Math.sin(x * 0.03) * 1.6 - rg.r(0, 1.5)]);
      gpts.push([802, GY + 1.5, 1]);
      gpts.push([600, GY + 3.2], [400, GY + 3.4]);
      blob(gpts, '#5f9a5c', 0.55, 133);
      stroke([[244, GY - 3.5], [500, GY - 4.6], [740, GY - 3.4]], 1.3, '#a9d29a', 0.6, 0.05, 0.05);
      for (let x = 238; x < 794; x += rg.r(7, 13)) {
        const h = rg.r(4, 9), lean = rg.r(-2.5, 2.5);
        line([[x, GY - 2], [x + lean * 0.5, GY - 2 - h * 0.6], [x + lean, GY - 2 - h]], 0.55, '#2f6a3a', 0.1, 0.1, 0.5);
        line([[x + 1.6, GY - 2], [x + 1.6 - lean, GY - 2 - h * 0.7]], 0.45, '#2f6a3a', 0.1, 0.1, 0.5);
        if (rg.ch(0.18)) { const fx = x + lean, fy = GY - 2 - h; for (let k = 0; k < 5; k++) dot(fx + Math.cos(k * 1.256) * 1.3, fy + Math.sin(k * 1.256) * 1.3, 0.8, rg.ch(0.5) ? '#f4efe4' : C.vermilion); dot(fx, fy, 0.6, '#e7c25a'); }
      }
    }
    await tick();
    drawSnail(642, GY);
    await tick();
    drawKnight(316, GY);
    await tick();
    drawGrylle(190, GY);
    await tick();

    function drawSnail(ox, oy) {
      push(); translate(ox, oy); scale(1.42);
      // the slime trail, glinting
      {
        const tr = [[100, -1.0], [124, -1.4], [146, -1.0], [160, -1.2], [168, -0.8]];
        const P = samp(tr, false, 0.8);
        const path = ribbon(P, taper(2.8, 0.02, 0.6, 0.15, 0.3), false);
        gild(path, true);
        cc.globalAlpha = 0.35; cc.fillStyle = '#e8eef0'; cc.fill(path); cc.globalAlpha = 1;
      }
      const skin = '#b5a57c', skinDk = '#6c5f41', skinLt = '#e4dab6';
      line([[-138, -31], [-148, -27], [-154, -22]], 2.6, skin, 0.05, 0.3, 0.5);
      outline([[-138, -31], [-148, -27], [-154, -22]], 0.38, C.ink, false);
      const body = [[112, -1, 1], [101, -6], [74, -11], [36, -13], [-10, -14], [-60, -15.5], [-94, -21], [-114, -33], [-126, -42], [-135, -44], [-142, -37], [-141, -25], [-131, -13], [-110, -3], [-70, -0.5], [0, -0.2]];
      blob(body, skin, 0.55);
      stroke([[-132, -38], [-104, -26], [-60, -16.5], [0, -14], [70, -11]], 2.4, skinLt, 0.75, 0.05, 0.4);
      stroke([[-128, -12], [-84, -3.5], [0, -2.5], [90, -3.5]], 2.6, skinDk, 0.5, 0.1, 0.3);
      for (let x = -116; x < 96; x += 6.5) stroke([[x, -3], [x + 2.5, -7.5], [x + 1, -11.5]], 0.6, skinDk, 0.5, 0.2, 0.4);
      // eye stalks, levelled like lances at the knight
      const st1 = [[-122, -42], [-128, -62], [-137, -82], [-148, -98]];
      const st2 = [[-130, -41], [-143, -54], [-157, -66], [-172, -74]];
      for (const st of [st2, st1]) {
        line(st, 5.2, skin, 0.05, 0.1, 0.45);
        outline(st, 0.4, C.ink, false);
        stroke(st.slice(0, 3), 1.6, skinDk, 0.45);
        const e = st[st.length - 1];
        blob(ellPts(e[0], e[1], 3.6, 3.2, 12), skinDk, 0.42);
        dot(e[0] - 1.4, e[1] + 0.3, 1.6, '#1a1410'); dot(e[0] - 2, e[1] - 0.5, 0.5, C.white);
      }
      hiLite([[-124, -47], [-130, -64], [-139, -82]], 1.0, 0.8);
      line([[-142, -30], [-138, -27.5], [-133.5, -28.5]], 0.45, C.ink, 0.1, 0.2, 0.5); // a small satisfied mouth
      // the shell: three whorls, aperture to the left
      const cx = 14, cy = -62, R = 54;
      const shell = [];
      for (let k = 0; k < 28; k++) { const a = -PI * 0.92 + k / 28 * TAU; const rr = R * (1 - 0.06 * Math.cos(a - 0.6)); shell.push([cx + Math.cos(a) * rr * 1.04, cy + Math.sin(a) * rr * 0.96]); }
      const shP = shapePath(shell, true);
      paint(shP, '#c89c62', 142);
      cc.save(); cc.clip(shP);
      const spiral = (r0, k, turns, ph) => { const o = []; for (let t = 0; t <= turns * TAU; t += 0.1) { const r = r0 * Math.exp(-k * t); o.push([cx + 3 + Math.cos(t + ph) * r * 1.04, cy + 2 + Math.sin(t + ph) * r * 0.96]); } return o; };
      const k = Math.log(2.4) / TAU;
      stroke(spiral(R * 0.83, k, 3.0, 2.4), 13, '#946238', 0.55, 0.02, 0.5);
      stroke(spiral(R * 0.93, k, 3.1, 2.4), 4.5, '#b4664c', 0.7, 0.02, 0.5);
      for (let i = 0; i < 70; i++) { const t = i * 0.27; const r = R * 0.98 * Math.exp(-k * t); const aa = t + 2.4; const px = cx + 3 + Math.cos(aa) * r * 1.04, py = cy + 2 + Math.sin(aa) * r * 0.96; const ia = aa + PI + 0.25; stroke([[px, py], [px + Math.cos(ia) * r * 0.16, py + Math.sin(ia) * r * 0.16], [px + Math.cos(ia + 0.2) * r * 0.3, py + Math.sin(ia + 0.2) * r * 0.3]], 0.55, '#6a3818', 0.5, 0.15, 0.5); }
      hiLite(spiral(R * 0.99, k, 2.6, 2.6), 1.9, 0.7);
      cc.restore();
      line(spiral(R * 0.71, k, 3.1, 2.4), 0.9, C.ink, 0, 0.6, 0.3);
      outline(shell, 0.7);
      hiLite([[cx - 30, cy - 38], [cx - 6, cy - 50], [cx + 22, cy - 47], [cx + 42, cy - 30]], 1.6, 0.8);
      stroke([[cx - 50, cy + 18], [cx - 30, cy + 42], [cx + 10, cy + 52], [cx + 40, cy + 38]], 3, '#6e3a18', 0.45);
      pop();
    }

    function drawKnight(ox, oy) {
      push(); translate(ox, oy); scale(1.27);
      const red = '#c43f28', redDk = '#7a1d10';
      const mailDk = '#7d7f7e';
      // far leg, kneeling: thigh, shin along the ground, toe curled
      mail([[-19, -57], [-3, -55], [-6, -32], [-10, -9], [-22, -5], [-24, -17], [-22, -38]], mailDk);
      mail([[-12, -1], [-18, -11], [-36, -12.5], [-54, -11.5], [-57, -3], [-34, 0]], mailDk);
      plate([[-54, -12], [-62, -14.5], [-70, -10], [-72, -2], [-62, -0.5], [-55, -2]], '#9ea3a6');
      plate(ellPts(-16, -10, 6.2, 5.8, 12), '#9ea3a6');
      line([[-58, -13], [-62, -18]], 0.55, C.ink, 0, 0, 1); goldDot(-62.5, -19, 1.4);
      // empty scabbard behind
      push(); translate(-30, -54); rotate(0.62);
      blob([[-2.3, 0, 1], [2.3, 0, 1], [2, 46], [0, 50, 1], [-2, 46]], '#3a2a20', 0.42);
      gild(shapePath([[-2.5, 44], [2.5, 44], [0, 51, 1]], true), true);
      pop();
      // far arm, flung up behind: "God save me"
      mail([[-37, -103], [-27, -110], [-37, -123], [-45, -137], [-53, -134], [-47, -119]], mailDk);
      blob([[-53.5, -133], [-58, -139], [-58.6, -147], [-56, -147.4], [-55, -141.5], [-54.6, -149.6], [-52, -149.8], [-51.4, -142.4], [-49.4, -148.4], [-47, -147.6], [-48, -140], [-45.4, -143.6], [-43.4, -142], [-45.4, -135], [-48, -131]], C.flesh, 0.42);
      // near leg: thigh, knee up, shin, pointed sabaton
      mail([[-7, -61], [18, -59], [42, -56], [50, -49], [46, -39], [24, -40.5], [2, -42.5], [-9, -47]]);
      mail([[38, -45], [50, -48], [53, -35], [50.5, -15], [51.5, -6], [43, -5], [41, -16], [40, -32]]);
      plate([[41, -9], [51, -10], [60, -5.5], [75, -0.6, 1], [56, 0.8], [41, 0.8]]);
      for (const xx of [48, 54]) line([[xx, -9.4], [xx + 1.5, 0.4]], 0.32, C.ink, 0, 0, 1);
      line([[41, -6], [36, -10]], 0.55, C.ink, 0, 0, 1); goldDot(35, -10.6, 1.5);
      plate([[40, -54], [46, -57], [53, -51], [53, -42], [46, -38], [40, -42]]);
      plate([[39, -51], [34.5, -56], [33.5, -47], [37, -41]], '#a2a7aa');
      hiLite([[43, -54], [49, -52], [51, -46]], 0.9);
      // surcoat (jupon), leaning back away from the beast
      const sur = [[-35, -107], [-37, -92], [-33, -76], [-26, -62], [-30, -50], [-34, -38], [-18, -33], [-2, -36], [12, -40], [25, -44], [16, -55], [6, -65], [0, -80], [-6, -96], [-13, -111], [-24, -115]];
      blob(sur, red, 0.6);
      for (const f of [[[-29, -56], [-32, -40]], [[-19, -58], [-20, -34]], [[-7, -60], [-4, -37]], [[6, -60], [14, -42]]]) stroke(f, 2.6, redDk, 0.6);
      for (const f of [[[-24, -55], [-26, -37]], [[0, -58], [5, -38]], [[11, -56], [19, -44]]]) hiLite(f, 0.9, 0.55);
      stroke([[-33, -104], [-34, -88], [-30, -72]], 3.2, redDk, 0.45);
      hiLite([[-10, -104], [-4, -88], [1, -74]], 1.0, 0.6);
      // his arms: gules, a snail or (the irony is not lost on him)
      push(); translate(-17, -84); rotate(-0.3); scale(0.85);
      const sp = []; for (let t = 0; t <= 2.3 * TAU; t += 0.2) { const r = 6.4 * Math.exp(-0.16 * t); sp.push([Math.cos(t + 1.6) * r, Math.sin(t + 1.6) * r]); }
      gild(ribbon(samp(sp, false, 0.5), taper(1.7, 0.02, 0.3, 0.4), false), true);
      gild(shapePath([[-9, 6], [8, 5.2], [10, 3], [12, -2.5], [13, 0.5], [10, 7.4], [-9, 8]], true), true);
      line([[11, -2.5], [12, -6]], 0.5, C.gold, 0, 0.2, 0.6); line([[12.5, -2], [15, -5]], 0.5, C.gold, 0, 0.2, 0.6);
      pop();
      // low-slung belt with gold plaques
      line([[-30, -58], [-12, -59], [4, -61], [12, -63]], 2.6, '#2b1d16', 0.02, 0.02, 1);
      for (let k = 0; k < 6; k++) goldDot(-27 + k * 7.5, -58.6 - k * 0.7, 1.15);
      // near arm raised, palm out: "mercy!"
      mail([[-21, -101], [-10, -109], [2, -118], [9, -130], [2, -134], [-6, -124], [-17, -114]]);
      blob([[1.5, -132], [3, -139], [2.4, -147.6], [5, -148.2], [6.2, -141.6], [7.2, -150.6], [9.8, -150.8], [9.8, -142.6], [11.8, -149.6], [14.2, -149], [12.8, -141], [15.8, -145], [17.8, -143.6], [14.6, -135], [9.6, -130]], C.flesh, 0.42);
      line([[6.6, -138], [8.6, -136], [11, -136.6]], 0.28, C.fleshDk, 0, 0.2, 0.5);
      // aventail (mail cape) and bascinet
      mail([[-38, -128], [-40, -116], [-38, -104], [-26, -100.5], [-12, -103], [-8, -110], [-9, -118], [-14, -118.5], [-20, -117.5], [-28, -120]]);
      const helm = [[-37, -127], [-38.5, -136], [-34.5, -144], [-29, -150], [-24, -154, 1], [-18.5, -146], [-13.5, -138], [-12.5, -131.5], [-19, -132.5], [-25, -131.5], [-31, -129]];
      plate(helm);
      hiLite([[-33, -138], [-29, -145], [-25, -150]], 1.1, 0.85);
      stroke([[-35, -131], [-25, -133.5], [-15, -134]], 1.2, '#53585b', 0.6);
      for (let k = 0; k < 8; k++) dot(-35.5 + k * 3, -130 - k * 0.4, 0.42, C.gold);
      // the face: wide eyes, brows up, mouth agape
      push(); translate(-17.5, -124.5); scale(7.2, 7.8);
      const fc = [[-0.9, -0.95], [0.1, -1.0], [0.78, -0.86], [1.0, -0.4], [0.94, 0.12], [0.76, 0.52], [0.32, 0.86], [-0.3, 0.88], [-0.8, 0.5], [-1.0, -0.2]];
      blob(fc, C.flesh, 0.05);
      gEye(-0.14, -0.22, 0.2, 0.95, 0.5, 0.075); gEye(0.56, -0.24, 0.22, 0.95, 0.6, 0.075);
      line([[-0.42, -0.62], [-0.18, -0.76], [0.04, -0.7]], 0.075, '#5a3b22', 0.2, 0.2, 0.4);
      line([[0.34, -0.72], [0.56, -0.8], [0.78, -0.68]], 0.075, '#5a3b22', 0.2, 0.2, 0.4);
      line([[0.25, -0.18], [0.38, 0.12], [0.28, 0.22]], 0.065, C.fleshDk, 0.2, 0.2, 0.5);
      blob(ellPts(0.26, 0.52, 0.15, 0.21, 10), '#5b2420', 0.03);
      dot(-0.5, 0.18, 0.13, C.cheek); dot(0.8, 0.2, 0.1, C.cheek);
      pop();
      // the sword he has let fall
      push(); translate(70, -2.2); rotate(-0.025);
      blob([[0, -1.6, 1], [62, -1.1], [70, 0, 1], [62, 1.1], [0, 1.6, 1]], '#c7ccd0', 0.42, 138);
      hiLite([[4, -0.5], [58, -0.4]], 0.6);
      line([[2, 0], [50, 0]], 0.28, '#6d7276', 0, 0.2, 0.6);
      gild(shapePath([[-1.5, -7, 1], [1.5, -7, 1], [1.5, 7, 1], [-1.5, 7, 1]], true)); outline([[-1.5, -7, 1], [1.5, -7, 1], [1.5, 7, 1], [-1.5, 7, 1]], 0.38);
      blob([[-1.5, -1.3, 1], [-12, -1.3, 1], [-12, 1.3, 1], [-1.5, 1.3, 1]], '#3a2a20', 0.38);
      gild(shapePath(ellPts(-14.5, 0, 2.8, 2.8, 10), true)); outline(ellPts(-14.5, 0, 2.8, 2.8, 10), 0.38);
      pop();
      pop();
    }

    function drawGrylle(ox, oy) {
      // a head on two legs, watching with professional disapproval
      push(); translate(ox, oy); scale(1.22);
      const legC = '#d2ab84';
      for (const [x, d] of [[-8, -1], [7, 1]]) {
        const lg = [[x, -30], [x + d * 2.4, -19], [x - d * 0.6, -10], [x + d * 0.5, -2.5]];
        line(lg, 3.0, legC, 0.05, 0.05, 0.7); outline(lg, 0.34, C.ink, false);
        dot(x + d * 2.2, -19, 2.1, legC); // knobbly knee
        line([[x + d * 0.5, -2], [x + d * 0.5 + 6, -0.6], [x + d * 0.5 + 9.5, 0]], 0.95, C.ink, 0.1, 0.1, 0.6);
        line([[x + d * 0.5, -2], [x + d * 0.5 + 5, -4]], 0.75, C.ink, 0.1, 0.1, 0.6);
        line([[x + d * 0.5, -2], [x + d * 0.5 - 4.5, -0.4]], 0.75, C.ink, 0.1, 0.1, 0.6);
      }
      push(); translate(0, -55); scale(26, 27);
      // hood with a long liripipe flopping behind
      line([[-0.7, -0.7], [-1.15, -0.95], [-1.5, -0.7], [-1.6, -0.3]], 0.16, C.green, 0.05, 0.1, 0.5);
      outline([[-0.7, -0.7], [-1.15, -0.95], [-1.5, -0.7], [-1.6, -0.3]], 0.015, C.ink, false);
      blob([[-0.96, 0.62], [-1.02, -0.2], [-0.82, -0.82], [-0.3, -1.08], [0.32, -1.04], [0.76, -0.72], [0.86, -0.24], [0.6, 0.06], [0.62, 0.62], [0.2, 0.98], [-0.5, 0.98]], C.green, 0.026);
      stroke([[-0.82, 0.5], [-0.86, -0.2], [-0.62, -0.7]], 0.14, C.greenDk, 0.6);
      hiLite([[-0.2, -0.94], [0.3, -0.92], [0.6, -0.7]], 0.05, 0.6);
      // the face in profile, a magnificent nose, one brow cocked at the knight
      blob([[-0.32, -0.62], [0.18, -0.7], [0.5, -0.52], [0.6, -0.28], [0.98, 0.08, 1], [0.66, 0.16], [0.64, 0.3], [0.56, 0.38], [0.6, 0.5], [0.44, 0.64], [0.0, 0.72], [-0.38, 0.5], [-0.46, -0.1]], C.flesh, 0.03);
      stroke([[0.62, -0.18], [0.82, 0.04], [0.66, 0.12]], 0.06, C.fleshDk, 0.6);
      blob([[0.54, 0.44], [0.62, 0.64], [0.5, 0.88], [0.22, 1.0], [-0.16, 0.88], [-0.36, 0.52], [-0.1, 0.64], [0.24, 0.64]], '#86684a', 0.026);
      for (const bb of [[[0.42, 0.6], [0.32, 0.86]], [[0.18, 0.66], [0.1, 0.92]], [[-0.06, 0.64], [-0.12, 0.86]]]) stroke(bb, 0.03, '#4c3624', 0.8);
      blob(ellPts(0.36, -0.2, 0.085, 0.065, 8), '#fbf7ee', 0.02); dot(0.41, -0.19, 0.035, C.ink);
      line([[0.2, -0.46], [0.36, -0.58], [0.54, -0.5]], 0.035, '#5a3b22', 0.2, 0.2, 0.4);
      line([[0.48, 0.36], [0.6, 0.38]], 0.028, '#5b2420', 0.2, 0.2, 0.5);
      line([[0.44, 0.33], [0.5, 0.36]], 0.02, C.ink, 0.2, 0.2, 0.5);
      dot(0.36, 0.1, 0.07, C.cheek);
      blob([[-0.34, -0.06], [-0.2, -0.16], [-0.12, 0.04], [-0.2, 0.2], [-0.32, 0.16]], C.fleshDk, 0.02);
      pop();
      pop();
    }

    /* =============================================== THE BAGPIPER */
    drawPiper(96, 733);
    await tick();
    function drawPiper(ox, oy) {
      push(); translate(ox, oy); scale(1.22);
      const grn = '#4f8a62', grnDk = '#24543a', grnLt = '#a6d0a0', belly = '#dcbc72';
      const habit = '#2f2a2c', habitLt = '#8a8284';
      // wing, behind: rose membrane on dark ribs, raised high
      const wing = [[-6, -92], [-18, -118], [-30, -150, 1], [-46, -150], [-68, -146, 1], [-60, -134], [-66, -118, 1], [-54, -112], [-50, -98, 1], [-30, -92]];
      blob(wing, C.rose, 0.5);
      for (const tip of [[-68, -146], [-66, -118], [-50, -98]]) line([[-30, -150], [(tip[0] - 30) / 2 - 3, (tip[1] - 150) / 2 - 1], tip], 0.9, C.roseDk, 0.05, 0.2, 0.4);
      line([[-6, -92], [-18, -118], [-30, -150]], 1.7, C.roseDk, 0.1, 0.1, 0.6);
      stroke([[-26, -102], [-42, -116], [-54, -134]], 4, C.roseDk, 0.3);
      hiLite([[-20, -120], [-28, -142]], 0.8, 0.7);
      // tail coiling round the stem, ending in a trefoil leaf
      const tail = [[-8, -26], [-24, -18], [-34, -4], [-28, 9], [-10, 12], [2, 4], [14, 7], [24, 16]];
      line(tail, 9, grn, 0.02, 0.7, 0.15);
      outline(tail, 0.45, C.ink, false);
      stroke([[-12, -24], [-26, -14], [-32, -2]], 2.4, grnLt, 0.7);
      for (let i = 1; i < 10; i++) { const t = i / 10; const a = Math.floor(t * (tail.length - 1)); const p0 = tail[a], p1 = tail[a + 1]; const u = t * (tail.length - 1) - a; const x = lerp(p0[0], p1[0], u), y = lerp(p0[1], p1[1], u); line([[x - 1.6, y - 1.4], [x + 0.8, y + 0.4], [x - 1.2, y + 2.2]], 0.35, grnDk, 0, 0, 1); }
      blob([[24, 16], [29, 12], [33, 16, 1], [30, 19], [34, 23, 1], [28, 22], [26, 27, 1], [23, 21]], grn, 0.4);
      line([[-46, -1.5], [-20, 0], [6, -0.5]], 1.0, C.ink, 0, 0, 1); // the stem passes in front of the coil
      // bird legs with talons gripping the stem
      for (const [hx, kx, fx, col] of [[-5, 2, -5, '#3f7552'], [7, 15, 8, grn]]) {
        line([[hx, -30], [kx, -16], [fx + 1, -6]], 5, col, 0.05, 0.1, 0.5);
        outline([[hx, -30], [kx, -16], [fx + 1, -6]], 0.4, C.ink, false);
        line([[fx + 1, -6], [fx, -1]], 2.2, '#d8b45c', 0.1, 0.1, 0.6);
        for (const [dx, dy] of [[-5, 2.5], [0, 3.5], [5, 2.5]]) line([[fx, -1], [fx + dx * 0.7, 1 + dy * 0.4], [fx + dx, dy]], 0.8, C.ink, 0.05, 0.1, 0.3);
      }
      // the dragon body: a tapering, scaly S rising from the haunches into the habit
      const db = [[-14, -24], [-18, -38], [-15, -52], [-9, -66], [10, -68], [17, -56], [19, -42], [13, -28], [2, -21]];
      blob(db, grn, 0.55);
      blob([[8, -66], [15, -56], [17, -42], [12, -30], [6, -26], [9, -40], [10, -54]], belly, 0);
      for (let k = 0; k < 5; k++) line([[7.5 + k * 0.6, -61 + k * 7], [16 - k * 0.3, -58 + k * 7]], 0.35, '#8a6a2a', 0, 0, 1);
      for (let r = 0; r < 5; r++) for (let c = 0; c < 3; c++) { const x = -12 + c * 6 + (r % 2) * 3, y = -58 + r * 7; if (x < 5) line([[x - 2.4, y], [x, y + 2.2], [x + 2.4, y]], 0.4, grnDk, 0, 0, 1); }
      hiLite([[-13, -40], [-12, -52], [-8, -62]], 1.0, 0.7);
      // the habit, its skirt cut into dags over the dragon
      const torso = [[-14, -60], [-17, -76], [-14, -92], [-8, -103], [5, -107], [15, -100], [19, -86], [18, -72], [21, -60], [16, -55, 1], [12, -60], [7, -54, 1], [2, -60], [-3, -54, 1], [-8, -60], [-13, -54, 1]];
      blob(torso, habit, 0.55);
      for (const f of [[[-9, -98], [-11, -80], [-9, -64]], [[9, -100], [13, -84], [12, -66]]]) hiLite(f, 0.9, 0.45);
      blob([[-11, -102], [-10, -111], [0, -113], [12, -109], [15, -101], [4, -98], [-4, -98]], '#3b3436', 0.5); // cowl
      stroke([[-8, -105], [2, -107], [12, -104]], 1.0, habitLt, 0.6);
      // drone over the shoulder with a little banner
      line([[-6, -92], [-20, -122], [-28, -140]], 2.6, '#c49a58', 0.05, 0.05, 1);
      outline([[-6, -92], [-20, -122], [-28, -140]], 0.35, C.ink, false);
      blob([[-25, -136], [-33, -144], [-34, -149], [-26, -147], [-24, -140]], '#c49a58', 0.4);
      for (const yy of [-106, -124]) line([[-14.8 + (yy + 106) * 0.45, yy + 1], [-10.8 + (yy + 106) * 0.45, yy - 1]], 1.2, C.ink, 0, 0, 1);
      blob([[-20, -124], [-31, -119], [-27, -115], [-35, -110], [-19, -114]], C.vermilion, 0.4);
      // the bag, squeezed under the arm
      const bag = [[-17, -76], [-19, -88], [-11, -97], [1, -95], [6, -85], [2, -73], [-8, -69]];
      blob(bag, C.vermilion, 0.55);
      stroke([[-13, -73], [-5, -71], [2, -76]], 2.6, '#8a2414', 0.6);
      hiLite([[-14, -89], [-8, -94], [-1, -93]], 1.3, 0.75);
      // blowpipe to the mouth; chanter hanging in front
      line([[1, -94], [8, -103], [13.5, -110]], 1.6, '#c49a58', 0.05, 0.05, 1);
      outline([[1, -94], [8, -103], [13.5, -110]], 0.3, C.ink, false);
      const ch = [[3, -75], [11, -61], [18, -47]];
      line(ch, 2.8, '#c49a58', 0.05, 0.05, 1); outline(ch, 0.35, C.ink, false);
      blob([[15.5, -50], [22, -47], [22, -43], [17, -41.5]], '#c49a58', 0.4);
      for (const t of [0.35, 0.55, 0.75]) dot(lerp(3, 18, t), lerp(-75, -47, t), 0.55, C.ink);
      // sleeves and hands on the chanter
      blob([[9, -100], [17, -92], [17, -80], [13, -67], [8, -67], [10, -81], [6, -93]], habit, 0.5);
      blob([[-3, -97], [3, -89], [7, -73], [5, -65], [0, -67], [1, -81]], '#3b3436', 0.45);
      blob([[4, -69], [8.5, -70], [10, -65], [7, -62], [3.5, -64]], C.flesh, 0.38);
      blob([[10, -63], [15, -62.5], [16, -57], [12, -55], [9, -58]], C.flesh, 0.38);
      // head: tonsured, cheeks like apples, eyes rolled sideways at the reader
      push(); translate(6, -119); rotate(-0.14); scale(8.6, 9.6);
      blob([[0, -1.0], [0.68, -0.8], [0.98, -0.2], [1.1, 0.3], [0.86, 0.8], [0.3, 1.0], [-0.36, 0.92], [-0.84, 0.48], [-0.98, -0.18], [-0.72, -0.76]], C.flesh, 0.05);
      blob([[-1.0, -0.1], [-0.86, -0.62], [-0.42, -0.9], [0.18, -0.98], [0.66, -0.8], [0.94, -0.42], [0.64, -0.52], [0.12, -0.68], [-0.44, -0.58], [-0.72, -0.2], [-0.76, 0.3], [-0.9, 0.34]], '#5d5550', 0.04);
      blob([[-0.38, -0.88], [0.12, -0.99], [0.56, -0.86], [0.5, -0.72], [0.08, -0.76], [-0.32, -0.7]], '#f8e6d2', 0);
      blob(ellPts(0.6, 0.4, 0.4, 0.34, 12), '#f0bba4', 0.03); // the puffed cheek
      dot(0.64, 0.36, 0.17, C.cheek);
      gEye(0.0, -0.18, 0.16, 0.7, -0.9, 0.07); gEye(0.56, -0.2, 0.18, 0.7, -0.9, 0.07);
      line([[-0.16, -0.46], [0.02, -0.54], [0.18, -0.48]], 0.06, '#4a3f3a', 0.2, 0.2, 0.4);
      line([[0.38, -0.5], [0.58, -0.58], [0.76, -0.48]], 0.06, '#4a3f3a', 0.2, 0.2, 0.4);
      line([[0.38, -0.1], [0.46, 0.14], [0.34, 0.2]], 0.055, C.fleshDk, 0.2, 0.2, 0.5);
      blob([[-0.66, 0.0], [-0.52, -0.12], [-0.42, 0.1], [-0.5, 0.3], [-0.64, 0.24]], C.fleshDk, 0.04);
      blob(ellPts(0.84, 0.6, 0.11, 0.09, 8), '#5b2420', 0.03);
      pop();
      pop();
    }

    /* ============================================ HARE AND HUNTER */
    drawHunter(920, 584);
    drawHare(888, 1008);
    await tick();
    function drawHare(ox, oy) {
      push(); translate(ox, oy); scale(1.14);
      const fur = '#b47c45', furDk = '#6b4220', furLt = '#ecd8b2';
      // quiver on the hip, behind
      push(); translate(14, -34); rotate(0.3);
      blob([[-3.4, -14, 1], [3.4, -14, 1], [3, 12], [0, 14, 1], [-3, 12]], '#7a2a1a', 0.4);
      for (const dx of [-1.8, 0.2, 2]) { line([[dx, -14], [dx * 1.4, -22]], 0.45, C.ink, 0, 0, 1); blob([[dx * 1.4 - 1.4, -21], [dx * 1.4, -26, 1], [dx * 1.4 + 1.4, -21]], '#f2ece0', 0.25); }
      pop();
      // far hind leg
      blob([[4, -14], [12, -10], [12, -2], [-8, -1.5, 1], [-7, -4], [2, -5]], '#9a6838', 0.42);
      // body, upright and leaning back to aim
      const body = [[-6, -8], [-10, -22], [-10, -40], [-6, -54], [2, -62], [10, -60], [15, -48], [18, -30], [22, -14], [14, -4], [2, -3]];
      blob(body, fur, 0.55);
      blob([[-8, -12], [-9.5, -26], [-8.5, -42], [-4, -52], [0, -44], [-1, -24], [0, -10]], furLt, 0);
      for (const f of [[[14, -50], [17, -32], [19, -16]], [[8, -56], [11, -40]]]) stroke(f, 2.2, furDk, 0.55);
      for (let k = 0; k < 14; k++) line([[2 + (k % 4) * 3.4, -52 + k * 3.2], [4 + (k % 4) * 3.4, -50 + k * 3.2]], 0.3, furDk, 0, 0, 1);
      // near haunch & long hind foot
      blob([[0, -22], [12, -28], [22, -20], [22, -8], [16, -2], [-10, -0.5, 1], [-11, -3], [2, -6], [0, -12]], fur, 0.5);
      stroke([[14, -24], [20, -16], [17, -6]], 2.2, furDk, 0.55);
      blob([[22, -16], [26, -18], [27, -13], [23, -11]], '#fbf6ec', 0.35); // scut
      // head, tilted back, sighting up the arrow
      push(); translate(0, -66); rotate(-0.55);
      // ears laid back
      blob([[2, -6], [10, -11], [24, -12], [30, -9, 1], [22, -6], [8, -3]], fur, 0.42);
      blob([[8, -7], [20, -9.6], [26, -9], [18, -6.8]], '#e9a7a0', 0);
      blob([[3, -3], [12, -4], [26, -2], [31, 1, 1], [22, 1.6], [8, 1]], '#a06c3c', 0.42);
      const hd = [[-14, 0], [-10, -6], [-2, -8], [6, -6], [9, 0], [6, 6], [-4, 8], [-10, 6]];
      blob(hd, fur, 0.5);
      blob([[-14, 0.5], [-11, 3.5], [-6, 5], [-8, 1]], furLt, 0);
      gEye(-3, -1.5, 2.4, 0.75, -0.8, 0.5);
      dot(-13.6, -0.6, 0.9, '#5b2420');
      line([[-13.6, 0.4], [-12.4, 2.2], [-10.8, 2.8]], 0.3, C.ink, 0, 0.2, 0.6);
      for (const d of [-1, 1]) line([[-12, 1], [-19, 1 + d * 3], [-22, 1 + d * 4.4]], 0.18, C.ink, 0, 0.3, 0.4);
      pop();
      // bow above the head, arrow pointing at the hunter's other buttock
      const grip = [-6, -98];
      blob([[grip[0] - 2.2, grip[1] - 0.5], [grip[0] - 2.2, grip[1] + 3.2], [grip[0] + 1.8, grip[1] + 3.2], [grip[0] + 1.8, grip[1] - 0.5]], '#7a5a2a', 0.3);
      line([[-30, -88], [-18, -96], [grip[0], grip[1]], [10, -96], [20, -88]], 2.0, '#a46a2c', 0.15, 0.15, 0.55);
      outline([[-30, -88], [-18, -96], [grip[0], grip[1]], [10, -96], [20, -88]], 0.3, C.ink, false);
      line([[-30, -88], [-4, -70], [20, -88]], 0.32, '#f2ece0', 0, 0, 1);
      line([[-4, -70], [-6.5, -100], [-8.5, -122]], 0.8, '#8a6a3a', 0, 0, 1);
      blob([[-10, -121], [-8.6, -127, 1], [-7, -121]], '#b9bec2', 0.3);
      for (const dx of [-1.6, 1.6]) blob([[-4.2, -71], [-4.4 + dx, -74], [-4.8 + dx, -79], [-4.8, -77]], C.vermilion, 0.2);
      // forepaws: one holding the bow aloft, one drawing to the cheek
      blob([[2, -58], [-2, -72], [-6, -90], [-3, -96], [1, -88], [6, -70], [7, -60]], fur, 0.45);
      blob([[-1, -60], [-5, -64], [-6, -70], [-3, -72], [0, -67], [4, -63]], '#a06c3c', 0.42);
      pop();
    }
    function drawHunter(ox, oy) {
      // clinging to the vine, an arrow already planted in his seat, looking down in horror
      push(); translate(ox, oy); scale(1.12);
      const tunic = '#3f7a4e', tunicDk = '#1f4a2c', hose = '#c0584a', hoseDk = '#7a2a20';
      // dangling leg
      blob([[-14, 66], [-6, 70], [-8, 92], [-12, 110], [-15, 116], [-22, 118, 1], [-21, 114], [-17, 108], [-17, 90]], hose, 0.45);
      blob([[-15, 113], [-23, 116], [-28, 118, 1], [-20, 120.5], [-13, 118]], '#2a2018', 0.38);
      // leg hooked round the stem
      blob([[-4, 62], [8, 64], [14, 76], [6, 86], [2, 90], [-2, 86], [4, 78], [-2, 72]], hose, 0.45);
      blob([[0, 86], [5, 92], [11, 96, 1], [6, 97.5], [-1, 92]], '#2a2018', 0.38);
      stroke([[6, 66], [11, 76], [5, 84]], 1.6, hoseDk, 0.5);
      // tunic, short, belted
      const tun = [[-16, 26], [-20, 40], [-22, 56], [-26, 68], [-12, 72], [2, 70], [8, 66], [4, 52], [2, 36], [-4, 26]];
      blob(tun, tunic, 0.55);
      for (const f of [[[-18, 52], [-22, 66]], [[-8, 54], [-8, 70]], [[0, 52], [4, 64]]]) stroke(f, 2.2, tunicDk, 0.6);
      hiLite([[-14, 30], [-16, 44], [-15, 56]], 0.9, 0.6);
      line([[-21, 52], [-8, 53], [4, 51]], 1.6, '#3a2618', 0.05, 0.05, 1);
      // the arrow, in the seat of his hose
      line([[-22, 66], [-36, 86], [-44, 98]], 0.75, '#8a6a3a', 0, 0, 1);
      for (const dx of [-2, 2]) blob([[-41.5, 94], [-43 + dx, 96], [-46 + dx, 101], [-44.5, 100]], C.vermilion, 0.2);
      blob([[-23, 64], [-20, 67], [-22.4, 68]], '#b9bec2', 0.2);
      // horn on a baldric, swinging
      line([[-4, 28], [-12, 46], [-20, 58]], 0.8, '#3a2618', 0, 0, 1);
      push(); translate(-24, 62); rotate(0.6);
      blob([[-7, -2.4], [4, -1.4], [9, 0, 1], [4, 1.4], [-7, 2.6], [-8.5, 0]], '#efe6d0', 0.4);
      line([[-2, -2], [-2, 2]], 0.4, C.gold, 0, 0, 1); line([[3, -1.4], [3, 1.4]], 0.4, C.gold, 0, 0, 1);
      pop();
      // arms up round the stem
      blob([[-6, 28], [-2, 16], [2, 4], [6, 2], [6, 8], [2, 20], [-1, 30]], tunic, 0.45);
      blob([[-16, 28], [-12, 14], [-4, 4], [0, 6], [-6, 18], [-9, 30]], tunicDk, 0.45);
      blob([[1, 0], [5, -2], [8, 1], [6, 5], [2, 5]], C.flesh, 0.35);
      blob([[-5, 2], [-1, 0], [1, 4], [-2, 7], [-5, 6]], C.flesh, 0.35);
      line([[0, -14], [0, 20]], 0, C.ink, 0, 0, 1);
      // hooded head, turned to look down past his shoulder
      push(); translate(-14, 20); scale(8.4, 9);
      blob([[-1.1, 0.2], [-1.0, -0.62], [-0.52, -1.08], [0.2, -1.12], [0.82, -0.8], [1.0, -0.1], [0.86, 0.6], [0.3, 1.1], [-0.4, 1.1], [-0.96, 0.8]], '#c94a35', 0.05);
      line([[-0.8, -0.8], [-1.6, -1.4], [-2.1, -2.4], [-2.0, -3.2]], 0.32, '#c94a35', 0.05, 0.3, 0.3);
      blob([[-0.66, -0.28], [-0.2, -0.62], [0.42, -0.6], [0.7, -0.18], [0.72, 0.36], [0.4, 0.78], [-0.1, 0.84], [-0.56, 0.5]], C.flesh, 0.04);
      gEye(-0.18, 0.08, 0.17, 1, 0.3, 0.07); gEye(0.38, 0.08, 0.19, 1, 0.3, 0.07);
      line([[-0.34, -0.22], [-0.16, -0.3], [0.0, -0.24]], 0.06, '#5a3b22', 0.2, 0.2, 0.4);
      line([[0.24, -0.26], [0.42, -0.34], [0.6, -0.26]], 0.06, '#5a3b22', 0.2, 0.2, 0.4);
      blob(ellPts(0.14, 0.56, 0.12, 0.16, 10), '#5b2420', 0.03);
      dot(-0.4, 0.4, 0.12, C.cheek); dot(0.58, 0.4, 0.1, C.cheek);
      pop();
      pop();
      // his hat, tumbling down towards the hare
      push(); translate(902, 792); rotate(2.4);
      blob([[-8, 2], [-6, -4], [0, -7], [6, -4], [8, 2], [0, 3.5]], '#c94a35', 0.45);
      blob([[-10, 2.5], [10, 2.5], [9, 5], [-9, 5]], '#8a2a1e', 0.4);
      line([[2, -6], [4, -12], [8, -15]], 0.6, '#3a6a9a', 0.05, 0.3, 0.6);
      pop();
    }

    /* ================================== MONKEY BISHOP, GOAT, GOLDFINCH */
    drawGoat(676, 177);
    drawFinch(372, 166);
    await tick();
    function drawGoat(ox, oy) {
      push(); translate(ox, oy);
      const g = '#8e7a64', gDk = '#4e3f2f', gLt = '#d8ccb8';
      // far legs
      for (const L of [[[-30, -32], [-34, -16], [-30, -2]], [[30, -32], [36, -18], [40, -6], [44, -10]]]) { line(L, 4.4, '#6e5d4b', 0.05, 0.05, 0.6); outline(L, 0.36, C.ink, false); }
      blob([[-33, -3], [-27, -3], [-26, 0.5, 1], [-34, 0.5, 1]], '#2a2018', 0.3);
      blob([[42, -12], [47, -10], [47, -7], [43, -7]], '#2a2018', 0.3);
      // tail, held as reins
      line([[-44, -50], [-50, -58], [-54, -60]], 3.2, g, 0.1, 0.1, 0.5); outline([[-44, -50], [-50, -58], [-54, -60]], 0.35, C.ink, false);
      // body
      const body = [[-46, -50], [-40, -60], [-20, -63], [10, -61], [34, -59], [46, -51], [48, -40], [40, -30], [20, -27], [-10, -28], [-34, -29], [-46, -38]];
      blob(body, g, 0.55);
      stroke([[-36, -34], [-10, -31], [20, -31], [40, -34]], 3.2, gDk, 0.5);
      for (let k = 0; k < 11; k++) { const x = -38 + k * 8; stroke([[x, -58], [x + 3, -48], [x + 1, -38]], 0.8, gDk, 0.55, 0.2, 0.4); }
      hiLite([[-34, -58], [-10, -60.5], [20, -59]], 1.1, 0.7);
      blob([[-14, -60], [4, -61], [6, -52], [-8, -50]], '#5c4a38', 0); // a dark patch
      // near legs
      for (const L of [[[-40, -34], [-42, -18], [-40, -2]], [[38, -32], [40, -16], [38, -2]]]) { line(L, 5, g, 0.05, 0.05, 0.6); outline(L, 0.38, C.ink, false); }
      blob([[-43, -3], [-37, -3], [-36, 0.5, 1], [-44, 0.5, 1]], '#2a2018', 0.3);
      blob([[35, -3], [41, -3], [42, 0.5, 1], [34, 0.5, 1]], '#2a2018', 0.3);
      // neck, head, beard, horns
      blob([[34, -56], [44, -67], [52, -77], [60, -81], [66, -76], [62, -66], [53, -52], [45, -44]], g, 0.5);
      blob([[54, -75], [59, -85], [67, -83], [74, -72], [76.5, -65], [72, -63], [64, -68], [56, -69]], g, 0.5);
      line([[59, -84], [52, -92], [44, -96], [39, -90]], 3, '#d9c69a', 0.05, 0.1, 0.4);
      outline([[59, -84], [52, -92], [44, -96], [39, -90]], 0.3, C.ink, false);
      for (let k = 0; k < 4; k++) line([[55 - k * 4, -88 - k * 1.6], [57 - k * 4, -86 - k * 1.8]], 0.3, '#7a6a4a', 0, 0, 1);
      blob([[57, -76], [50, -76], [45, -72], [52, -72]], '#7a6652', 0.4);
      blob([[70, -64], [72, -58], [70, -52, 1], [67, -57], [66, -63]], '#ece4d4', 0.35);
      gEye(63.5, -76.5, 2.0, 0.55, 0.6, 0.45);
      dot(75.5, -66.6, 0.6, C.ink);
      line([[72, -63.4], [75, -63.8]], 0.3, C.ink, 0, 0, 1);
      // the monkey, mitred, seated the wrong way round
      push(); translate(-8, -62);
      const fur = '#7a5232', furDk = '#3e2614', face = '#e9b8a0';
      // legs astride
      blob([[2, -2], [10, -4], [18, 2], [16, 10], [10, 6], [2, 4]], fur, 0.42);
      blob([[14, 6], [20, 8], [22, 12], [16, 12]], face, 0.35);
      // cope in rose with a gold orphrey
      const cope = [[-8, -38], [-14, -26], [-18, -10], [-16, 2], [6, 4], [12, -4], [8, -22], [4, -36], [-2, -42]];
      blob(cope, C.rose, 0.5);
      gild(shapePath([[-3, -40], [0, -40], [2, 2], [-2, 2]], true), true);
      for (const f of [[[-12, -24], [-15, -6]], [[6, -20], [9, -4]]]) stroke(f, 2, C.roseDk, 0.6);
      hiLite([[-6, -34], [-11, -20], [-13, -6]], 0.9, 0.7);
      // arm forward with the tail as reins
      blob([[-8, -30], [-16, -24], [-24, -16], [-28, -14], [-26, -10], [-20, -12], [-12, -18], [-6, -22]], fur, 0.42);
      blob([[-28, -15], [-33, -13], [-34, -9], [-29, -9], [-26, -11]], face, 0.35);
      line([[-46, 12], [-40, 2], [-34, -9]], 0.9, '#6e5d4b', 0, 0, 1);
      // arm up with the crozier
      blob([[4, -34], [10, -40], [12, -50], [8, -52], [6, -44], [0, -38]], fur, 0.42);
      blob([[8, -50], [12, -54], [14, -50], [11, -47]], face, 0.35);
      gild(ribbon(samp([[11, 8], [11, -74]], false, 1), () => 1.7, false));
      const crook = []; for (let t = 0; t <= 1.6 * TAU; t += 0.15) { const r = 9 * Math.exp(-0.18 * t); crook.push([11 - 9 + Math.cos(-t) * r + 0, -82 + Math.sin(-t) * r * 1.05]); }
      const ck = [[11, -74]].concat(crook.map((p) => [p[0] + 9 - 9 * Math.cos(0) + 0, p[1]]));
      gild(ribbon(samp(ck, false, 0.6), taper(2.4, 0.02, 0.4, 0.4), false));
      outline(ck, 0.25, C.ink, false);
      gild(shapePath(ellPts(11, -70, 3, 2.2, 10), true)); outline(ellPts(11, -70, 3, 2.2, 10), 0.3);
      // head, facing back down the goat, with a superior expression
      push(); translate(-4, -50); scale(7.4, 8);
      blob([[-1.0, 0.1], [-0.84, -0.62], [-0.2, -0.98], [0.5, -0.86], [0.92, -0.3], [0.86, 0.5], [0.3, 0.96], [-0.5, 0.92]], fur, 0.05);
      blob([[-1.1, 0.12], [-0.9, -0.36], [-0.3, -0.5], [0.2, -0.3], [0.3, 0.3], [0.0, 0.8], [-0.7, 0.8], [-1.06, 0.5]], face, 0.04);
      blob([[0.6, -0.2], [0.98, -0.3], [1.06, 0.14], [0.74, 0.2]], face, 0.04);
      gEye(-0.62, -0.12, 0.16, 0.5, -0.6, 0.07); gEye(-0.14, -0.12, 0.16, 0.5, -0.6, 0.07);
      line([[-0.84, -0.4], [-0.6, -0.48], [-0.4, -0.38]], 0.06, furDk, 0.2, 0.2, 0.4);
      line([[-0.3, -0.38], [-0.12, -0.48], [0.08, -0.42]], 0.06, furDk, 0.2, 0.2, 0.4);
      line([[-0.98, 0.22], [-0.86, 0.3]], 0.06, C.ink, 0.2, 0.2, 0.5);
      line([[-0.86, 0.52], [-0.6, 0.62], [-0.36, 0.56]], 0.06, '#5b2420', 0.2, 0.2, 0.5);
      // mitre
      const mi = [[-0.86, -0.56], [-0.92, -1.3], [-0.5, -2.0], [-0.22, -2.3, 1], [0.08, -1.98], [0.5, -1.3], [0.56, -0.62]];
      blob(mi, '#f6f1e6', 0.04);
      gild(shapePath([[-0.9, -0.74], [0.56, -0.8], [0.56, -0.6], [-0.88, -0.54]], true), true);
      gild(shapePath([[-0.28, -0.6], [-0.12, -0.6], [-0.14, -2.2], [-0.28, -2.18]], true), true);
      stroke([[-0.7, -0.9], [-0.66, -1.5]], 0.12, '#c9c2b4', 0.7);
      line([[0.4, -0.66], [0.64, -0.2], [0.72, 0.4]], 0.08, C.vermilion, 0.05, 0.1, 0.4); // lappet
      pop();
      pop();
      pop();
    }
    function drawFinch(ox, oy) {
      // a goldfinch hauling a tendril straight, as if to tidy the margin
      push(); translate(ox, oy);
      line([[-34, -4], [-24, -14], [-14, -16], [-9, -14]], 0.55, C.ink, 0.02, 0.02, 1);
      for (const [x, d] of [[2, 0], [6, 1]]) { line([[x, -6], [x - 1, -2], [x - 2, 0]], 0.7, '#c9a27c', 0.05, 0.05, 0.6); line([[x - 2, 0], [x - 5, 0.8]], 0.5, C.ink, 0, 0, 1); line([[x - 2, 0], [x + 1.5, 1]], 0.5, C.ink, 0, 0, 1); }
      const body = [[-8, -14], [-4, -18], [4, -18], [12, -14], [22, -10], [24, -8], [14, -6], [4, -4], [-4, -7]];
      blob(body, '#b58a5a', 0.45);
      blob([[-4, -8], [2, -5], [8, -5], [4, -9]], '#f2ead8', 0);
      blob([[2, -16], [10, -15], [20, -10], [12, -9], [4, -11]], '#2a221e', 0.4);
      gild(shapePath([[4, -13.5], [12, -12.5], [13, -11], [5, -11.5]], true), true);
      for (const x of [14, 17, 20]) dot(x, -9.6, 0.45, '#f6f1e6');
      blob([[-12, -16], [-10, -20], [-5, -21], [-2, -18], [-3, -14], [-8, -12]], '#f2ead8', 0.4);
      blob([[-12.5, -16.5], [-10, -19], [-8, -17], [-9, -14.5]], '#c9372a', 0);
      blob([[-8, -20.6], [-4, -21.4], [-2, -18], [-5, -19]], '#2a221e', 0);
      blob([[-12, -16.6], [-15.5, -16], [-12, -15]], '#e8dcc4', 0.25);
      dot(-8.6, -17.4, 0.6, C.ink);
      pop();
    }

    /* ====================================================== ACCIDENTS */
    {
      const rA = Rng(seed, 'accidents');
      // --- the sewn-up hole the scribe had to write around
      {
        const L = repair.line;
        const cx = repair.x, cy = ruleY(L) + XH + 14;
        const ang = rA.r(-0.35, -0.12), len = 38, wid = 2.2;
        push(); translate(cx, cy); rotate(ang);
        // puckered skin around the slit
        for (let i = 0; i < 9; i++) { const t = (i / 8 - 0.5) * len; for (const sd of [-1, 1]) { const px = TX(t, sd * (wid + 2.5)), py = TY(t, sd * (wid + 2.5)); const g = hh.createRadialGradient(px, py, 0, px, py, 3.5); g.addColorStop(0, 'rgba(255,255,255,0.10)'); g.addColorStop(1, 'rgba(255,255,255,0)'); hh.fillStyle = g; hh.fillRect(px - 4, py - 4, 8, 8); } }
        const slit = [[-len / 2, 0, 1], [-len / 4, -wid * 0.8], [0, -wid], [len / 4, -wid * 0.7], [len / 2, 0, 1], [len / 4, wid * 0.8], [0, wid], [-len / 4, wid * 0.7]];
        const sp = shapePath(slit, true);
        cc.globalAlpha = 0.5; cc.strokeStyle = '#8a6a48'; cc.lineWidth = 2.6; cc.stroke(sp); cc.globalAlpha = 1;
        mm.fillStyle = MAT.hole; mm.fill(sp);
        cc.fillStyle = '#3a2c20'; cc.fill(sp);
        // whip stitches in faded green silk
        const silk = '#5d8c7c', silkDk = '#2f5246';
        for (let i = 0; i < 9; i++) {
          const t = (i / 8 - 0.5) * (len - 6);
          const st = [[t - 2.4, -wid - 2.6], [t, 0], [t + 2.4, wid + 2.6]];
          line(st, 1.1, silk, 0.1, 0.1, 0.6); outline(st, 0.22, silkDk, false);
          dot(t - 2.4, -wid - 2.6, 0.45, '#3a2a20'); dot(t + 2.4, wid + 2.6, 0.45, '#3a2a20');
        }
        line([[len / 2 - 2, wid + 2.6], [len / 2 + 4, wid + 6], [len / 2 + 9, wid + 6.5]], 0.9, silk, 0.05, 0.3, 0.4); // the loose end
        pop();
      }
      // --- wormholes, straight through to the velvet
      const holes = [];
      for (let i = 0; i < 3; i++) holes.push([rA.r(946, 972), rA.r(240, 520) + i * rA.r(30, 70), rA.r(1.8, 3.2)]);
      holes.push([rA.r(400, 700), rA.r(1380, 1398), rA.r(2, 3)]);
      holes.push([rA.r(470, 510), rA.r(1060, 1110), rA.r(1.6, 2.4)]);
      for (const [x, y, r] of holes) {
        const pts = []; for (let k = 0; k < 9; k++) { const a = k / 9 * TAU; const rr = r * rA.r(0.75, 1.2); pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr]); }
        const hp = shapePath(pts, true);
        cc.globalAlpha = 0.55; cc.strokeStyle = '#6e4e30'; cc.lineWidth = r * 0.9; cc.stroke(hp); cc.globalAlpha = 1;
        mm.fillStyle = MAT.hole; mm.fill(hp); cc.fillStyle = '#1a1410'; cc.fill(hp);
        hh.fillStyle = 'rgb(110,110,110)'; hh.fill(hp);
      }
      // --- gold rubbed to the red bole where a thumb (or a kiss) has worn it
      {
        const bx = INI.x0 + rA.r(4, 14), by = INI.y1 - rA.r(4, 12);
        for (let i = 0; i < 26; i++) {
          const x = bx + rA.g() * 7, y = by + rA.g() * 4.5, r = rA.r(0.8, 2.8);
          if (x < INI.x0 + 1 || y > INI.y1 - 1) continue;
          const p = new Path2D(); p.ellipse(x, y, r * rA.r(1, 1.8), r, rA.r(0, PI), 0, TAU);
          cc.fillStyle = rA.ch(0.7) ? C.bole : '#c0754a'; cc.fill(p); mm.fillStyle = 'rgb(0,30,255)'; mm.fill(p);
        }
        // and the same on a couple of the small gold initials
        let n = 0;
        for (const it of INIT_GOLD) { if (n > 1 || !rA.ch(0.35)) continue; n++; for (let i = 0; i < 6; i++) { const x = it[0] + rA.r(2, 14), y = it[1] + rA.r(4, 20); const p = new Path2D(); p.arc(x, y, rA.r(0.6, 1.4), 0, TAU); cc.fillStyle = C.bole; cc.fill(p); mm.fillStyle = 'rgb(0,30,255)'; mm.fill(p); } }
      }
      // --- the kitten walked through the ink and across the psalm
      {
        const rp = Rng(seed, 'paws');
        const sx = 572 + rp.r(-6, 10), sy = 1012 + rp.r(-6, 6);
        const ang = rp.r(-0.62, -0.48);
        const ca = Math.cos(ang), sa = Math.sin(ang);
        const N = 5, step = 92, size = 46;
        const PAD = [[-0.3, 0.12], [-0.12, -0.02], [0.0, 0.04], [0.12, -0.02], [0.3, 0.12], [0.34, 0.34], [0.18, 0.5], [0.0, 0.46], [-0.18, 0.5], [-0.34, 0.34]];
        const TOES = [[-0.44, -0.3, 0.13, 0.17], [-0.16, -0.5, 0.14, 0.18], [0.16, -0.5, 0.14, 0.18], [0.44, -0.3, 0.13, 0.17]];
        for (let i = 0; i < N; i++) {
          const along = i * step + rp.r(-4, 4), side = (i % 2 ? 1 : -1) * 9;
          const x = sx + ca * along - sa * side, y = sy + sa * along + ca * side;
          const fade = [1, 0.9, 0.72, 0.52, 0.32][i];
          push(); translate(x, y); rotate(ang + PI / 2 + rp.r(-0.15, 0.15)); scale(size * rp.r(0.95, 1.05));
          const shapes = [PAD.map((q) => [q[0] + rp.g() * 0.015, q[1] + rp.g() * 0.015])];
          for (const t of TOES) shapes.push(ellPts(t[0] + rp.g() * 0.02, t[1] + rp.g() * 0.02, t[2], t[3], 10, rp.r(-0.3, 0.3)));
          for (const sh of shapes) {
            const P = shapePath(sh, true);
            cc.save(); cc.clip(P);
            cc.globalAlpha = 0.72 * fade; cc.fillStyle = '#120b07'; cc.fill(P);
            // stipple: the skin of the pad leaves a broken, grainy impression
            const T = tf(sh); let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
            for (const q of T) { x0 = Math.min(x0, q[0]); y0 = Math.min(y0, q[1]); x1 = Math.max(x1, q[0]); y1 = Math.max(y1, q[1]); }
            const st = new Path2D(); const cnt = Math.round((x1 - x0) * (y1 - y0) * 0.9);
            for (let k = 0; k < cnt; k++) { const px = rp.r(x0, x1), py = rp.r(y0, y1), r = rp.r(0.3, 0.9); st.moveTo(px + r, py); st.arc(px, py, r, 0, TAU); }
            cc.globalAlpha = 0.6 * fade; cc.fill(st);
            cc.restore();
            mm.save(); mm.clip(P); mm.globalAlpha = fade; mm.fillStyle = MAT.ink; mm.fill(st); mm.restore();
            // a blurred halo where the ink spread into the skin
            cc.globalAlpha = 0.1 * fade; cc.strokeStyle = '#2a1a10'; cc.lineWidth = 1.6; cc.stroke(P); cc.globalAlpha = 1;
          }
          pop();
        }
        // where it all began: a smear at the edge of the column
        push(); translate(sx - 18, sy + 10); rotate(0.3);
        const sm = [[-10, -3], [-2, -6], [10, -4], [16, 1], [8, 4], [-4, 5], [-12, 2]];
        const smp = shapePath(sm, true); cc.globalAlpha = 0.55; cc.fillStyle = '#140d09'; cc.fill(smp); cc.globalAlpha = 1;
        for (let k = 0; k < 4; k++) dot(rp.r(-14, 18), rp.r(-8, 9), rp.r(0.5, 1.4), C.ink);
        pop();
      }
    }
    await tick();

    /* ================================================= FINISH THE HEIGHT */
    {
      const g2 = mk(cvG.width, cvG.height); const x2 = g2.getContext('2d');
      if ('filter' in x2) { x2.filter = 'blur(' + (2.0 * S / GSF).toFixed(2) + 'px)'; }
      x2.drawImage(cvG, 0, 0);
      hh.save(); hh.setTransform(1, 0, 0, 1, 0, 0);
      hh.globalCompositeOperation = 'lighter'; hh.globalAlpha = 0.18; hh.imageSmoothingEnabled = true;
      hh.drawImage(g2, 0, 0, TW, TH);
      hh.restore(); setBase(hh, S);
    }
    // tool the punches into the raised gold
    for (const [x, y, r] of PUN) {
      const g = hh.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, 'rgba(0,0,0,0.42)'); g.addColorStop(0.65, 'rgba(0,0,0,0.16)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      hh.fillStyle = g; hh.fillRect(x - r, y - r, 2 * r, 2 * r);
      cc.fillStyle = 'rgba(96,64,22,0.32)'; cc.beginPath(); cc.arc(x, y, r * 0.5, 0, TAU); cc.fill();
    }

    // a reader's thumb, centuries of it, at the lower outer corner
    {
      const rT2 = Rng(seed, 'thumb');
      cc.save(); cc.clip(pagePath);
      cc.globalCompositeOperation = 'multiply';
      let g = cc.createRadialGradient(30, PH - 40, 0, 30, PH - 40, 260);
      g.addColorStop(0, 'rgba(150,118,84,0.55)'); g.addColorStop(0.45, 'rgba(190,160,120,0.25)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      cc.fillStyle = g; cc.fillRect(0, PH - 320, 320, 320);
      for (let i = 0; i < 7; i++) {
        const x = rT2.r(30, 150), y = PH - rT2.r(30, 150), r = rT2.r(18, 40);
        g = cc.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, 'rgba(140,110,80,0.22)'); g.addColorStop(1, 'rgba(255,255,255,0)');
        cc.fillStyle = g; cc.fillRect(x - r, y - r, 2 * r, 2 * r);
      }
      // a faint whorl of a thumbprint
      cc.globalCompositeOperation = 'source-over';
      const fx = rT2.r(70, 110), fy = PH - rT2.r(70, 110), fa = rT2.r(0, PI);
      cc.strokeStyle = 'rgba(90,64,40,0.07)'; cc.lineWidth = 0.7;
      for (let k = 1; k < 16; k++) { cc.beginPath(); const a0 = rT2.r(0, TAU), a1 = a0 + rT2.r(3.5, 5.8); cc.ellipse(fx, fy, k * 1.5, k * 1.9, fa, a0, a1); cc.stroke(); }
      cc.restore();
    }
    return { col: cvC, hgt: cvH, mat: cvM, TW, TH };
  }

  /* ======================================================================
   *  WEBGL — lamp, gold, vellum, velvet
   * ==================================================================== */
  const VS = 'attribute vec2 aP; void main(){ gl_Position = vec4(aP, 0.0, 1.0); }';
  const FS = [
    'precision highp float;',
    'uniform sampler2D uCol; uniform sampler2D uHgt; uniform sampler2D uMat;',
    'uniform sampler2D uDCol; uniform sampler2D uDHgt; uniform sampler2D uDMat; uniform vec4 uDet; uniform vec2 uDDuv; uniform float uDOn;',
    'uniform vec2 uRes; uniform vec2 uCenter; uniform float uScale; uniform vec4 uTex; uniform vec2 uDuv; uniform float uDpage;',
    'uniform vec3 uLight; uniform float uTime; uniform float uHS; uniform float uPix;',
    'float hash(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }',
    'float vn(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.0-2.0*f);',
    '  return mix(mix(hash(i), hash(i+vec2(1.,0.)), u.x), mix(hash(i+vec2(0.,1.)), hash(i+vec2(1.,1.)), u.x), u.y); }',
    'float cockle(vec2 p){ return vn(p*0.0042)*9.0 + vn(p*0.011+17.0)*2.6 + vn(p*0.028+5.0)*0.5; }',
    'float sdBox(vec2 p, vec2 b){ vec2 d = abs(p) - b; return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0); }',
    'void main(){',
    '  vec2 fc = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);',
    '  vec2 p = (fc - 0.5*uRes) / uScale + uCenter;',
    '  vec2 uv = (p - uTex.xy) / uTex.zw;',
    '  vec2 uvd = (p - uDet.xy) / uDet.zw;',
    '  bool useD = uDOn > 0.5 && uvd.x > 0.002 && uvd.x < 0.998 && uvd.y > 0.002 && uvd.y < 0.998;',
    '  float inT = step(0.0, uv.x) * step(uv.x, 1.0) * step(0.0, uv.y) * step(uv.y, 1.0);',
    '  vec3 m; vec3 albS; float hl, hr, hu, hd, h0;',
    '  if (useD) {',
    '    m = texture2D(uDMat, uvd).rgb; albS = texture2D(uDCol, uvd).rgb; h0 = texture2D(uDHgt, uvd).r;',
    '    hl = texture2D(uDHgt, uvd - vec2(uDDuv.x, 0.0)).r; hr = texture2D(uDHgt, uvd + vec2(uDDuv.x, 0.0)).r;',
    '    hu = texture2D(uDHgt, uvd - vec2(0.0, uDDuv.y)).r; hd = texture2D(uDHgt, uvd + vec2(0.0, uDDuv.y)).r;',
    '    inT = 1.0;',
    '  } else {',
    '    m = texture2D(uMat, uv).rgb; albS = texture2D(uCol, uv).rgb; h0 = texture2D(uHgt, uv).r;',
    '    hl = texture2D(uHgt, uv - vec2(uDuv.x, 0.0)).r; hr = texture2D(uHgt, uv + vec2(uDuv.x, 0.0)).r;',
    '    hu = texture2D(uHgt, uv - vec2(0.0, uDuv.y)).r; hd = texture2D(uHgt, uv + vec2(0.0, uDuv.y)).r;',
    '  }',
    '  float cov = inT * m.b;',
    '  vec3 lc = vec3(1.0, 0.91, 0.78);',
    '  // velvet',
    '  vec3 Lv0 = uLight - vec3(p, -2.0); float d0 = length(Lv0); vec3 L0 = Lv0 / d0;',
    '  float att0 = 1.0 / (1.0 + d0*d0/(1150.0*1150.0));',
    '  vec2 pq = vec2(p.x * 0.7 + p.y * 0.25, p.y * 1.4);',
    '  float nap = vn(p*0.004)*0.55 + vn(pq*0.012+3.0)*0.3 + vn(pq*0.05+9.0)*0.15;',
    '  vec3 vel = vec3(0.009, 0.032, 0.022) * (0.8 + 0.4*nap);',
    '  float sheen = pow(1.0 - L0.z, 2.0) * (0.4 + 0.8*nap);',
    '  vec3 velvet = vel * (0.35 + 1.4*att0*L0.z) + vec3(0.03, 0.07, 0.05) * sheen * att0;',
    '  vec2 off = (p - uLight.xy) * (10.0 / uLight.z);',
    '  float sd = sdBox(p - off - vec2(500.0, 710.0), vec2(496.0, 706.0));',
    '  velvet *= mix(0.22, 1.0, smoothstep(-10.0, 40.0, sd));',
    '  float sd0 = sdBox(p - vec2(500.0, 710.0), vec2(500.0, 710.0));',
    '  velvet *= mix(0.45, 1.0, smoothstep(0.0, 6.0, sd0));',
    '  // page',
    '  vec3 col = velvet;',
    '  if (cov > 0.002) {',
    '    vec2 g = vec2(hr - hl, hd - hu) * uHS / (2.0 * uDpage);',
    '    float c0 = cockle(p); g += vec2(cockle(p + vec2(3.0, 0.0)) - c0, cockle(p + vec2(0.0, 3.0)) - c0) / 3.0;',
    '    float gk = m.r;',
    '    if (gk > 0.02) { g += (vec2(vn(p*0.7), vn(p*0.7+41.0)) - 0.5) * 0.10 * gk + (vec2(vn(p*0.09+7.0), vn(p*0.09+3.0)) - 0.5) * 0.12 * gk; }',
    '    vec3 N = normalize(vec3(-g, 1.0));',
    '    vec3 P = vec3(p, (h0 - 0.5) * uHS + c0);',
    '    vec3 Lv = uLight - P; float d = length(Lv); vec3 L = Lv / d;',
    '    vec3 V = normalize(vec3(uCenter, 2600.0) - P);',
    '    vec3 H = normalize(L + V);',
    '    float att = 1.0 / (1.0 + d*d/(1150.0*1150.0));',
    '    float ndl = max(dot(N, L), 0.0), ndh = max(dot(N, H), 0.0);',
    '    vec3 alb = pow(albS, vec3(2.2));',
    '    float pm = smoothstep(0.15, 0.17, m.g) * (1.0 - smoothstep(0.22, 0.25, m.g)) * (1.0 - step(0.02, gk));',
    '    vec2 bq = vec2(p.x * 0.8 + p.y * 0.3, p.y * 0.18 - p.x * 0.07);',
    '    float br = (vn(bq * 1.7) - 0.5) * 0.16 + (vn(p * 1.9 + 11.0) - 0.5) * 0.08 + (vn(p * 0.21) - 0.5) * 0.12;',
    '    alb *= 1.0 + br * pm;',
    '    vec3 amb = vec3(0.40, 0.39, 0.37);',
    '    vec3 c = alb * (amb + lc * att * ndl * 0.95);',
    '    c += lc * att * (pow(ndh, 34.0) * 0.10 * m.g + pow(ndh, 5.0) * 0.025);',
    '    if (gk > 0.02) {',
    '      vec3 tint = clamp(alb / vec3(0.584, 0.356, 0.077), 0.25, 1.6);',
    '      vec3 gc = vec3(1.0, 0.70, 0.27) * tint;',
    '      float leaf = smoothstep(0.6, 0.9, gk);',
    '      vec3 R = reflect(-V, N);',
    '      float env = 0.13 + 0.10 * smoothstep(-0.6, 0.6, R.y) + 0.08 * smoothstep(0.1, 0.7, -R.x * 0.7 + R.y * 0.3);',
    '      float s1 = pow(ndh, 260.0) * 6.0, s2 = pow(ndh, 46.0) * 1.4, s3 = pow(ndh, 9.0) * 0.45 + pow(ndh, 2.5) * 0.18;',
    '      float sh1 = pow(ndh, 40.0) * 0.9, sh2 = pow(ndh, 8.0) * 0.4;',
    '      float spec = mix(sh1 + sh2, s1 + s2 + s3, leaf);',
    '      vec3 gold = gc * (env + 0.22 * ndl * att) + gc * mix(vec3(1.0), vec3(1.0, 0.93, 0.8), 0.5) * lc * att * spec;',
    '      c = mix(c, gold, clamp(gk * 1.25, 0.0, 1.0));',
    '    }',
    '    // holes through the skin show the shadowed velvet',
    '    col = c;',
    '  }',
    '  float inner = step(0.0, -sdBox(p - vec2(500.0, 710.0), vec2(488.0, 698.0)));',
    '  vec3 holeCol = velvet * 0.25;',
    '  col = mix(mix(velvet, holeCol, inner), col, cov);',
    '  vec2 q = fc / uRes - 0.5;',
    '  col *= 1.0 - 0.35 * dot(q * vec2(1.1, 1.0), q * vec2(1.1, 1.0));',
    '  col = pow(clamp(col, 0.0, 1.0), vec3(1.0/2.2));',
    '  col += (hash(fc + fract(uTime)) - 0.5) / 255.0;',
    '  gl_FragColor = vec4(col, 1.0);',
    '}',
  ].join('\n');

  function createGL(canvas) {
    const o = { antialias: false, alpha: false, premultipliedAlpha: false, depth: false, stencil: false };
    let gl = canvas.getContext('webgl2', o), v2 = !!gl;
    if (!gl) gl = canvas.getContext('webgl', o) || canvas.getContext('experimental-webgl', o);
    if (!gl) return null;
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.error(gl.getShaderInfoLog(s)); return null; } return s; };
    const vs = sh(gl.VERTEX_SHADER, VS), fs = sh(gl.FRAGMENT_SHADER, FS);
    if (!vs || !fs) return null;
    const pr = gl.createProgram(); gl.attachShader(pr, vs); gl.attachShader(pr, fs); gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) { console.error(gl.getProgramInfoLog(pr)); return null; }
    gl.useProgram(pr);
    const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(pr, 'aP'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const U = {}; for (const n of ['uCol', 'uHgt', 'uMat', 'uRes', 'uCenter', 'uScale', 'uTex', 'uDuv', 'uDpage', 'uLight', 'uTime', 'uHS', 'uPix', 'uDCol', 'uDHgt', 'uDMat', 'uDet', 'uDDuv', 'uDOn']) U[n] = gl.getUniformLocation(pr, n);
    gl.uniform1i(U.uCol, 0); gl.uniform1i(U.uHgt, 1); gl.uniform1i(U.uMat, 2);
    gl.uniform1i(U.uDCol, 3); gl.uniform1i(U.uDHgt, 4); gl.uniform1i(U.uDMat, 5); gl.uniform1f(U.uDOn, 0);
    const texs = [null, null, null, null, null, null];
    { const z = new Uint8Array(4); for (let u = 3; u < 6; u++) { const t = gl.createTexture(); texs[u] = t; gl.activeTexture(gl.TEXTURE0 + u); gl.bindTexture(gl.TEXTURE_2D, t); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, z); } }
    function upload(unit, src) {
      if (texs[unit]) gl.deleteTexture(texs[unit]);
      const t = gl.createTexture(); texs[unit] = t;
      gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      if (v2) { gl.generateMipmap(gl.TEXTURE_2D); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); }
      else gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    }
    return { gl, U, upload, v2, maxTex: gl.getParameter(gl.MAX_TEXTURE_SIZE), dispose() { const e = gl.getExtension('WEBGL_lose_context'); if (e) e.loseContext(); } };
  }

  /* ======================================================================
   *  MOUNT
   * ==================================================================== */
  (window.PIECES = window.PIECES || []).push({
    id: 'hours',
    title: 'Hours of the Distracted Scribe, fol. 47v',
    medium: 'Iron-gall ink, tempera and burnished gold on calfskin vellum',
    note: 'Move across the page to catch the gold; scroll to lean in',
    about: 'A leaf from a Flemish Book of Hours whose margins have taken over: a knight surrenders to a snail, a hare hunts the hunter, and the scribe sleeps while his cat walks through the wet ink. Every letter, leaf and punched dot is drawn at runtime; the gold is raised on gesso and lit by a lamp that follows your hand.',
    tone: 'dark',
    room: '#0a130e',
    mount(el, api) {
      let alive = true;
      const seed = api.seed >>> 0;
      el.style.background = '#0a130e';
      el.style.touchAction = 'none';
      el.style.cursor = 'grab';
      const canvas = document.createElement('canvas');
      canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block';
      el.appendChild(canvas);
      const G = createGL(canvas);
      let fallback = null;
      if (!G) {
        fallback = canvas.getContext('2d');
      }
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      let vw = el.clientWidth || 1, vh = el.clientHeight || 1;

      // view state
      const view = { z: 1, cx: PW / 2, cy: PH / 2 }, tview = { z: 1, cx: PW / 2, cy: PH / 2 };
      if (DBG.view) { Object.assign(view, DBG.view); Object.assign(tview, DBG.view); }
      const fitS = () => Math.min(vw * 0.92 / PW, vh * 0.935 / PH);
      const s2p = (sx, sy, v) => { v = v || view; const f = fitS() * v.z; return [(sx - vw / 2) / f + v.cx, (sy - vh / 2) / f + v.cy]; };
      function clampView(v) {
        if (DBG.noclamp) return;
        v.z = clamp(v.z, 1, 9);
        const f = fitS() * v.z, hw = vw / 2 / f, hh2 = vh / 2 / f;
        v.cx = hw * 2 >= PW + 80 ? PW / 2 : clamp(v.cx, hw - 40, PW - hw + 40);
        v.cy = hh2 * 2 >= PH + 80 ? PH / 2 : clamp(v.cy, hh2 - 40, PH - hh2 + 40);
      }

      // light
      const light = { x: PW * 0.62, y: PH * 0.3, z: 520 }, tlight = { x: light.x, y: light.y };
      let lastMove = -1e9, t0 = performance.now();
      if (DBG.light) { light.x = tlight.x = DBG.light[0]; light.y = tlight.y = DBG.light[1]; if (DBG.light[2]) light.z = DBG.light[2]; }

      let tex = null, raf = 0, rendering = false, renderedS = 0;
      function resize() {
        vw = el.clientWidth || 1; vh = el.clientHeight || 1;
        canvas.width = Math.round(vw * dpr); canvas.height = Math.round(vh * dpr);
        clampView(view); clampView(tview);
        const want = targetS();
        if (!rendering && (renderedS === 0 || want > renderedS * 1.3)) build();
      }
      function targetS() {
        if (DBG.res) return DBG.res;
        const maxT = G ? Math.min(G.maxTex, 4096) : 4096;
        const s = clamp(fitS() * dpr * 2.4, 1.8, 3.0);
        return Math.min(s, (maxT - 2) / PH);
      }
      async function build() {
        rendering = true;
        const S = targetS();
        const region = DBG.region ? { rx: DBG.region[0], ry: DBG.region[1], rw: DBG.region[2], rh: DBG.region[3] } : { rx: 0, ry: 0, rw: PW, rh: PH };
        let last = performance.now();
        const tick = async () => {
          if (!alive) throw new Error('gone');
          if (performance.now() - last > 28) { await new Promise((r) => requestAnimationFrame(r)); last = performance.now(); if (!alive) throw new Error('gone'); }
        };
        let res;
        const tStart = performance.now();
        try { res = await paintFolio(seed, Object.assign({ S }, region), tick); } catch (e) { if (alive) console.error(e); rendering = false; return; }
        if (!alive) return;
        if (DBG.log) console.warn('paint ms', Math.round(performance.now() - tStart), 'S', S.toFixed(2), res.TW + 'x' + res.TH);
        tex = { S, region, TW: res.TW, TH: res.TH, col: res.col };
        if (G) { G.upload(0, res.col); G.upload(1, res.hgt); G.upload(2, res.mat); }
        res.hgt.width = res.hgt.height = 1; res.mat.width = res.mat.height = 1;
        if (G) { res.col.width = res.col.height = 1; tex.col = null; }
        renderedS = S; rendering = false;
        draw(performance.now());
        requestAnimationFrame(() => { if (alive) api.ready(); });
        if (tview.z > 1.2) scheduleDetail();
      }

      // ---- when the viewer leans in, repaint just the visible part of the leaf at a finer scale
      let det = null, detTimer = 0, detToken = 0;
      function scheduleDetail() { clearTimeout(detTimer); detTimer = setTimeout(buildDetail, 420); }
      async function buildDetail() {
        if (!G || !tex || rendering || !alive) return;
        const f = fitS() * tview.z * dpr;
        const maxT = Math.min(G.maxTex, 4096);
        const hw = canvas.width / 2 / f, hh2 = canvas.height / 2 / f;
        let rx0 = Math.max(-10, tview.cx - hw * 1.3), ry0 = Math.max(-10, tview.cy - hh2 * 1.3);
        let rx1 = Math.min(PW + 10, tview.cx + hw * 1.3), ry1 = Math.min(PH + 10, tview.cy + hh2 * 1.3);
        const rw = rx1 - rx0, rh = ry1 - ry0;
        if (rw <= 0 || rh <= 0) return;
        let S = Math.min(f * 1.1, 14, maxT / rw, maxT / rh);
        if (S <= tex.S * 1.25) { if (det && tview.z < 1.2) { det = null; lastSig = null; } return; }
        if (det && det.S >= S * 0.85 && det.region.rx <= tview.cx - hw && det.region.ry <= tview.cy - hh2 && det.region.rx + det.region.rw >= tview.cx + hw && det.region.ry + det.region.rh >= tview.cy + hh2) return;
        const my = ++detToken;
        let last = performance.now();
        const tick = async () => {
          if (!alive || my !== detToken) throw new Error('stale');
          if (performance.now() - last > 22) { await new Promise((r) => requestAnimationFrame(r)); last = performance.now(); if (!alive || my !== detToken) throw new Error('stale'); }
        };
        let res;
        try { res = await paintFolio(seed, { S, rx: rx0, ry: ry0, rw, rh }, tick); } catch (e) { if (e.message !== 'stale' && e.message !== 'gone') console.error(e); return; }
        if (!alive || my !== detToken) return;
        G.upload(3, res.col); G.upload(4, res.hgt); G.upload(5, res.mat);
        for (const c of [res.col, res.hgt, res.mat]) { c.width = c.height = 1; }
        det = { S, region: { rx: rx0, ry: ry0, rw, rh } };
        lastSig = null;
      }

      function draw(now) {
        if (!tex) return;
        const f = fitS() * view.z * dpr;
        if (G) {
          const gl = G.gl, U = G.U;
          gl.viewport(0, 0, canvas.width, canvas.height);
          gl.uniform2f(U.uRes, canvas.width, canvas.height);
          gl.uniform2f(U.uCenter, view.cx, view.cy);
          gl.uniform1f(U.uScale, f);
          gl.uniform4f(U.uTex, tex.region.rx, tex.region.ry, tex.region.rw, tex.region.rh);
          const e = Math.max(1 / tex.S, 1 / f) * 1.0;
          gl.uniform2f(U.uDuv, e / tex.region.rw, e / tex.region.rh);
          gl.uniform1f(U.uDpage, e);
          gl.uniform3f(U.uLight, light.x, light.y, light.z);
          gl.uniform1f(U.uTime, (now % 100000) / 1000);
          gl.uniform1f(U.uHS, 6.0);
          gl.uniform1f(U.uPix, 1 / f);
          if (det) {
            gl.uniform1f(U.uDOn, 1);
            gl.uniform4f(U.uDet, det.region.rx, det.region.ry, det.region.rw, det.region.rh);
            const ed = Math.max(1 / det.S, 1 / f);
            gl.uniform2f(U.uDDuv, ed / det.region.rw, ed / det.region.rh);
          } else gl.uniform1f(U.uDOn, 0);
          gl.drawArrays(gl.TRIANGLES, 0, 3);
        } else if (fallback && tex.col) {
          const c = fallback; c.setTransform(1, 0, 0, 1, 0, 0);
          c.fillStyle = '#0a130e'; c.fillRect(0, 0, canvas.width, canvas.height);
          const ox = canvas.width / 2 - view.cx * f, oy = canvas.height / 2 - view.cy * f;
          c.shadowColor = 'rgba(0,0,0,0.6)'; c.shadowBlur = 30 * dpr;
          c.drawImage(tex.col, ox + tex.region.rx * f, oy + tex.region.ry * f, tex.region.rw * f, tex.region.rh * f);
          c.shadowBlur = 0;
        }
      }

      // interaction
      const pointers = new Map(); let pinch = null, dragging = false, dragFrom = null, lastTap = 0;
      function onDown(e) {
        el.setPointerCapture && el.setPointerCapture(e.pointerId);
        pointers.set(e.pointerId, [e.clientX, e.clientY]);
        if (pointers.size === 2) {
          const [a, b] = [...pointers.values()];
          pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), z: tview.z, mid: s2p((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, tview) };
        } else {
          dragging = true; dragFrom = [e.clientX, e.clientY, tview.cx, tview.cy];
          el.style.cursor = 'grabbing';
          const now = performance.now();
          if (now - lastTap < 300 && e.pointerType !== 'mouse') zoomToggle(e.clientX, e.clientY);
          lastTap = now;
        }
        setLight(e);
      }
      function setLight(e) {
        const r = el.getBoundingClientRect();
        const p = s2p(e.clientX - r.left, e.clientY - r.top);
        tlight.x = p[0]; tlight.y = p[1]; lastMove = performance.now();
      }
      function onMove(e) {
        if (pointers.has(e.pointerId)) pointers.set(e.pointerId, [e.clientX, e.clientY]);
        if (pinch && pointers.size === 2) {
          const [a, b] = [...pointers.values()];
          const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
          tview.z = clamp(pinch.z * d / pinch.d, 1, 9);
          const r = el.getBoundingClientRect();
          const mx = (a[0] + b[0]) / 2 - r.left, my = (a[1] + b[1]) / 2 - r.top;
          const f = fitS() * tview.z;
          tview.cx = pinch.mid[0] - (mx - vw / 2) / f; tview.cy = pinch.mid[1] - (my - vh / 2) / f;
          clampView(tview);
        } else if (dragging && dragFrom && pointers.size === 1) {
          const f = fitS() * tview.z;
          tview.cx = dragFrom[2] - (e.clientX - dragFrom[0]) / f; tview.cy = dragFrom[3] - (e.clientY - dragFrom[1]) / f;
          clampView(tview);
        }
        setLight(e);
      }
      function onUp(e) {
        pointers.delete(e.pointerId);
        if (pointers.size < 2) pinch = null;
        if (pointers.size === 0) { dragging = false; dragFrom = null; el.style.cursor = 'grab'; }
        scheduleDetail();
      }
      function zoomAt(sx, sy, nz) {
        const r = el.getBoundingClientRect();
        const lx = sx - r.left, ly = sy - r.top;
        const before = s2p(lx, ly, tview);
        tview.z = clamp(nz, 1, 9);
        const f = fitS() * tview.z;
        tview.cx = before[0] - (lx - vw / 2) / f; tview.cy = before[1] - (ly - vh / 2) / f;
        clampView(tview);
      }
      function zoomToggle(sx, sy) { zoomAt(sx, sy, tview.z > 1.3 ? 1 : 3); scheduleDetail(); }
      function onWheel(e) { e.preventDefault(); zoomAt(e.clientX, e.clientY, tview.z * Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0016))); scheduleDetail(); }
      function onDbl(e) { zoomToggle(e.clientX, e.clientY); }
      function onLeave() { lastMove = performance.now() - 2500; }
      el.addEventListener('pointerdown', onDown);
      el.addEventListener('pointermove', onMove);
      el.addEventListener('pointerup', onUp);
      el.addEventListener('pointercancel', onUp);
      el.addEventListener('pointerleave', onLeave);
      el.addEventListener('wheel', onWheel, { passive: false });
      el.addEventListener('dblclick', onDbl);

      let prevT = performance.now();
      function loop(now) {
        if (!alive) return;
        raf = requestAnimationFrame(loop);
        const dt = Math.min(0.1, (now - prevT) / 1000); prevT = now;
        // idle drift of the lamp so the gold breathes
        const idle = now - lastMove > 3000 && !DBG.light;
        if (idle) {
          const t = (now - t0) / 1000;
          tlight.x = PW * (0.5 + 0.36 * Math.sin(t * 0.17 + 0.6) + 0.06 * Math.sin(t * 0.53));
          tlight.y = PH * (0.42 + 0.3 * Math.sin(t * 0.113 + 1.9) + 0.05 * Math.sin(t * 0.41));
        }
        const k = 1 - Math.exp(-dt * (idle ? 1.5 : 9));
        light.x += (tlight.x - light.x) * k; light.y += (tlight.y - light.y) * k;
        const kv = 1 - Math.exp(-dt * 12);
        view.z += (tview.z - view.z) * kv; view.cx += (tview.cx - view.cx) * kv; view.cy += (tview.cy - view.cy) * kv;
        const sig = [light.x, light.y, view.z * 1000, view.cx, view.cy, canvas.width, canvas.height];
        let changed = !lastSig;
        if (lastSig) for (let i = 0; i < sig.length; i++) if (Math.abs(sig[i] - lastSig[i]) > 0.04) { changed = true; break; }
        if (changed && tex) { lastSig = sig; draw(now); }
      }
      let lastSig = null;
      const ro = new ResizeObserver(() => { resize(); });
      ro.observe(el);
      resize();
      raf = requestAnimationFrame(loop);

      return {
        destroy() {
          alive = false; cancelAnimationFrame(raf); ro.disconnect(); clearTimeout(detTimer);
          el.removeEventListener('pointerdown', onDown); el.removeEventListener('pointermove', onMove);
          el.removeEventListener('pointerup', onUp); el.removeEventListener('pointercancel', onUp);
          el.removeEventListener('pointerleave', onLeave); el.removeEventListener('wheel', onWheel); el.removeEventListener('dblclick', onDbl);
          if (G) G.dispose();
        },
      };
    },
  });
})();
