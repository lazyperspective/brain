/* Five Strangers — 05 — "Mammy Wagon from Hell, Part 2"
 *
 * A hand-painted mobile-cinema poster in the Ghanaian tradition of the 1980s–90s:
 * enamel and oil on two stitched flour sacks, nailed to a cement wall and lit by
 * one bare bulb running off the generator. The painter (invented) never saw the film.
 *
 * Everything is drawn at runtime: the sacks, the weave, the ghost of the mill print,
 * the paint (brush by brush), the sign-painter lettering (stroke skeletons, no fonts),
 * the figures (hand-placed spline and limb shapes), the wall and the light.
 */
(function () {
  'use strict';

  const PW = 1000, PH = 1500, TAU = Math.PI * 2, D2R = Math.PI / 180;

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const frame = () => new Promise((r) => requestAnimationFrame(r));

  /* ------------------------------------------------------------------ state */
  let R = Math.random;          // seeded rng for the current render
  let g = null;                 // poster context (poster units via transform)
  let K = 1;                    // device px per poster unit
  const rr = (a, b) => a + (b - a) * R();
  const pick = (arr) => arr[Math.floor(R() * arr.length)];
  const LIGHT = [-0.55, -0.83]; // unit vector pointing toward the key light (up-left)

  /* ----------------------------------------------------------------- colour */
  function rgb(h) {
    if (Array.isArray(h)) return h;
    h = h.replace('#', '');
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  function css(c, a) {
    c = rgb(c);
    const r = Math.max(0, Math.min(255, c[0] | 0)), gg = Math.max(0, Math.min(255, c[1] | 0)), b = Math.max(0, Math.min(255, c[2] | 0));
    return a === undefined ? 'rgb(' + r + ',' + gg + ',' + b + ')' : 'rgba(' + r + ',' + gg + ',' + b + ',' + a + ')';
  }
  function mix(a, b, t) { a = rgb(a); b = rgb(b); return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
  function lit(c, t) { return t >= 0 ? mix(c, [255, 248, 228], t) : mix(c, [18, 8, 16], -t); }
  function jit(c, j) { c = rgb(c); return [c[0] + (R() - 0.5) * j, c[1] + (R() - 0.5) * j, c[2] + (R() - 0.5) * j]; }

  /* --------------------------------------------------------------- geometry */
  function bboxOf(pts) {
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const p of pts) { if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0]; if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1]; }
    return [x0, y0, x1, y1];
  }
  // Catmull-Rom spline through points. A point [x, y, 1] is a sharp corner.
  function splinePath(pts, closed, ten, path) {
    const p = path || new Path2D();
    const n = pts.length;
    ten = ten === undefined ? 1 : ten;
    const P = (i) => closed ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))];
    p.moveTo(pts[0][0], pts[0][1]);
    const segs = closed ? n : n - 1;
    for (let i = 0; i < segs; i++) {
      const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
      const s1 = p1[2] ? 0 : ten / 6, s2 = p2[2] ? 0 : ten / 6;
      p.bezierCurveTo(p1[0] + (p2[0] - p0[0]) * s1, p1[1] + (p2[1] - p0[1]) * s1,
        p2[0] - (p3[0] - p1[0]) * s2, p2[1] - (p3[1] - p1[1]) * s2, p2[0], p2[1]);
    }
    if (closed) p.closePath();
    return p;
  }
  function S(pts, ten) { return { path: splinePath(pts, true, ten), bb: bboxOf(pts), pts }; }
  function Pg(pts) { const p = new Path2D(); p.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) p.lineTo(pts[i][0], pts[i][1]); p.closePath(); return { path: p, bb: bboxOf(pts), pts }; }
  function El(cx, cy, rx, ry, rot) { const p = new Path2D(); p.ellipse(cx, cy, rx, ry, rot || 0, 0, TAU); const r = Math.max(rx, ry); return { path: p, bb: [cx - r, cy - r, cx + r, cy + r], c: [cx, cy] }; }
  // A tapered body along a centre line: cs = [[x, y, halfWidth], ...]. tipA/tipB = sharp ends.
  function limbPts(cs, tipA, tipB) {
    const n = cs.length, L = [], Rt = [];
    for (let i = 0; i < n; i++) {
      const a = cs[Math.max(0, i - 1)], b = cs[Math.min(n - 1, i + 1)];
      let tx = b[0] - a[0], ty = b[1] - a[1];
      const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
      const w = cs[i][2];
      L.push([cs[i][0] - ty * w, cs[i][1] + tx * w]);
      Rt.push([cs[i][0] + ty * w, cs[i][1] - tx * w]);
    }
    const e = cs[n - 1], e0 = cs[n - 2], s = cs[0], s1 = cs[1];
    let tx = e[0] - e0[0], ty = e[1] - e0[1]; let l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
    const endTip = [e[0] + tx * e[2] * (tipB ? 1.6 : 0.9), e[1] + ty * e[2] * (tipB ? 1.6 : 0.9), tipB ? 1 : 0];
    let ux = s[0] - s1[0], uy = s[1] - s1[1]; l = Math.hypot(ux, uy) || 1; ux /= l; uy /= l;
    const startTip = [s[0] + ux * s[2] * (tipA ? 1.6 : 0.9), s[1] + uy * s[2] * (tipA ? 1.6 : 0.9), tipA ? 1 : 0];
    if (tipA) { L[0] = s.slice(0, 2); Rt[0] = s.slice(0, 2); }
    if (tipB) { L[n - 1] = e.slice(0, 2); Rt[n - 1] = e.slice(0, 2); }
    const out = [];
    if (!tipA) out.push(startTip); else out.push(startTip);
    for (let i = 0; i < n; i++) if (!(tipA && i === 0) && !(tipB && i === n - 1)) out.push(L[i]);
    out.push(endTip);
    for (let i = n - 1; i >= 0; i--) if (!(tipA && i === 0) && !(tipB && i === n - 1)) out.push(Rt[i]);
    return out;
  }
  function Limb(cs, tipA, tipB) { return S(limbPts(cs, tipA, tipB)); }
  function T(pts, dx, dy, s, rot) { // transform point list
    s = s || 1; const c = Math.cos(rot || 0), sn = Math.sin(rot || 0);
    return pts.map((p) => { const x = p[0] * s, y = p[1] * s; const q = [dx + x * c - y * sn, dy + x * sn + y * c]; if (p[2] !== undefined) q.push(p[2]); return q; });
  }
  function lerp(a, b, t) { return a + (b - a) * t; }

  /* ---------------------------------------------------------------- painting */
  function crescent(sh, dx, dy, col, a, blur) {
    const [x0, y0, x1, y1] = sh.bb, m = Math.abs(dx) + Math.abs(dy) + (blur || 0) * 3 + 6;
    const p = new Path2D(); p.rect(x0 - m, y0 - m, x1 - x0 + 2 * m, y1 - y0 + 2 * m);
    p.addPath(sh.path, new DOMMatrix([1, 0, 0, 1, dx, dy]));
    g.globalAlpha = a; g.fillStyle = css(col);
    if (blur && blur * K > 0.6) g.filter = 'blur(' + (blur * K).toFixed(2) + 'px)';
    g.fill(p, 'evenodd');
    g.filter = 'none'; g.globalAlpha = 1;
  }
  // Fill a shape the way a sign painter would: flat colour, blended modelling, brushwork, flicked lights, outline.
  function paint(sh, col, o) {
    o = o || {};
    const c = rgb(col);
    const [x0, y0, x1, y1] = sh.bb, w = x1 - x0, h = y1 - y0;
    const sz = Math.max(3, Math.min(w, h)), cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    const Lv = o.L || LIGHT;
    g.save();
    if (o.alpha) g.globalAlpha = o.alpha;
    g.fillStyle = css(c); g.fill(sh.path);
    g.clip(sh.path);
    if (o.flat !== true) {
      const sd = o.sd === undefined ? 0.14 : o.sd;
      if (sd > 0) {
        const shc = o.shc ? rgb(o.shc) : lit(c, -0.5);
        crescent(sh, Lv[0] * sz * sd * 2.2, Lv[1] * sz * sd * 2.2, shc, 0.42, sz * sd * 0.9);
        crescent(sh, Lv[0] * sz * sd * 0.7, Lv[1] * sz * sd * 0.7, lit(shc, -0.3), 0.45, sz * sd * 0.18);
      }
      const hi = o.hi === undefined ? 0.07 : o.hi;
      if (hi > 0) {
        const hic = o.hic ? rgb(o.hic) : lit(c, 0.42);
        crescent(sh, -Lv[0] * sz * hi * 2.4, -Lv[1] * sz * hi * 2.4, hic, (o.hia || 0.55) * 0.7, sz * hi * 0.9);
        crescent(sh, -Lv[0] * sz * hi * 0.7, -Lv[1] * sz * hi * 0.7, lit(hic, 0.3), (o.hia || 0.55) * 0.6, sz * hi * 0.12);
      }
      if (o.rim) { // reflected firelight on the lower right
        const d = sz * (o.rimw || 0.08);
        crescent(sh, -0.75 * d, -0.6 * d, rgb(o.rim), o.rima || 0.6, d * 0.3);
      }
      // brush strokes
      const bw = o.bw || Math.max(2, Math.min(9, sz * 0.11));
      const len = o.len || Math.max(6, Math.min(52, sz * 0.55));
      const dens = o.n === undefined ? 1 : o.n;
      const n = Math.min(900, Math.round(dens * w * h / (bw * len) * 0.55));
      const dir = o.dir === undefined ? 'round' : o.dir;
      const mixc = o.mixc ? o.mixc.map(rgb) : null;
      g.lineCap = 'round';
      for (let i = 0; i < n; i++) {
        const px = x0 + R() * w, py = y0 + R() * h;
        let ang;
        if (dir === 'round') ang = Math.atan2(py - cy, px - cx) + Math.PI / 2 + rr(-0.3, 0.3);
        else if (dir === 'radial') ang = Math.atan2(py - cy, px - cx) + rr(-0.2, 0.2);
        else ang = dir + rr(-0.22, 0.22);
        const nx = (px - cx) / (w / 2 + 1), ny = (py - cy) / (h / 2 + 1);
        const bias = -(nx * Lv[0] + ny * Lv[1]) * 0.3 * (o.model === undefined ? 1 : o.model);
        let cc = lit(c, (R() - 0.5) * (o.var === undefined ? 0.34 : o.var) - bias);
        if (mixc && R() < 0.3) cc = mix(cc, pick(mixc), rr(0.3, 0.7));
        const l = len * rr(0.5, 1.3), ca = Math.cos(ang), sa = Math.sin(ang), bend = rr(-0.25, 0.25) * l;
        g.strokeStyle = css(cc, rr(0.16, 0.42) * (o.sa || 1));
        g.lineWidth = bw * rr(0.45, 1.25);
        g.beginPath();
        g.moveTo(px - ca * l / 2, py - sa * l / 2);
        g.quadraticCurveTo(px - sa * bend, py + ca * bend, px + ca * l / 2, py + sa * l / 2);
        g.stroke();
        if (R() < 0.18) { // bristle streaks: the brush running dry
          g.lineWidth = Math.max(0.5, bw * 0.12); g.strokeStyle = css(lit(cc, rr(-0.3, 0.3)), 0.5);
          for (let b = -1; b <= 1; b += 2) { const ox = -sa * bw * 0.3 * b, oy = ca * bw * 0.3 * b; g.beginPath(); g.moveTo(px - ca * l / 2 + ox, py - sa * l / 2 + oy); g.quadraticCurveTo(px - sa * bend + ox, py + ca * bend + oy, px + ca * l * 0.6 + ox, py + sa * l * 0.6 + oy); g.stroke(); }
        }
      }
      if (o.flick) { // fine highlights flicked on with a small brush
        const fc = o.fc ? rgb(o.fc) : lit(c, 0.75);
        for (let i = 0; i < o.flick; i++) {
          const px = cx + Lv[0] * w * rr(0.12, 0.36) + (R() - 0.5) * w * 0.45;
          const py = cy + Lv[1] * h * rr(0.12, 0.36) + (R() - 0.5) * h * 0.45;
          const ang = Math.atan2(py - cy, px - cx) + Math.PI / 2 + rr(-0.4, 0.4);
          const l = sz * rr(0.08, 0.24);
          g.strokeStyle = css(fc, rr(0.55, 0.95)); g.lineWidth = rr(0.8, 2.2);
          g.beginPath(); g.moveTo(px, py); g.quadraticCurveTo(px + Math.cos(ang) * l * 0.5 + rr(-1, 1), py + Math.sin(ang) * l * 0.5 + rr(-1, 1), px + Math.cos(ang) * l, py + Math.sin(ang) * l); g.stroke();
        }
      }
    }
    g.restore();
    if (o.line !== null && o.line !== false) outline(sh, o.line || '#160c0a', o.lw || 2.4);
  }
  // Outline heavier on the shadow side, thin on the lit side, like a brush pulled by hand.
  function outline(sh, col, lw) {
    g.save();
    g.lineJoin = 'round'; g.lineCap = 'round';
    g.strokeStyle = css(col); g.lineWidth = lw * 0.6; g.stroke(sh.path);
    const [x0, y0, x1, y1] = sh.bb, m = lw * 4;
    const p = new Path2D(); p.rect(x0 - m, y0 - m, x1 - x0 + 2 * m, y1 - y0 + 2 * m); p.addPath(sh.path);
    g.clip(p, 'evenodd');
    g.translate(-LIGHT[0] * lw * 0.5, -LIGHT[1] * lw * 0.5);
    g.lineWidth = lw * 1.25; g.globalAlpha = 0.92; g.stroke(sh.path);
    g.restore();
  }
  function flat(sh, col, a) { g.save(); if (a !== undefined) g.globalAlpha = a; g.fillStyle = css(col); g.fill(sh.path); g.restore(); }
  function strokeLine(pts, col, lw, a, cap) {
    g.save(); g.globalAlpha = a === undefined ? 1 : a; g.strokeStyle = css(col); g.lineWidth = lw; g.lineCap = cap || 'round'; g.lineJoin = 'round';
    g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]); g.stroke(); g.restore();
  }
  function curve(pts, col, lw, a) {
    g.save(); g.globalAlpha = a === undefined ? 1 : a; g.strokeStyle = css(col); g.lineWidth = lw; g.lineCap = 'round'; g.lineJoin = 'round';
    g.stroke(splinePath(pts, false)); g.restore();
  }
  function glow(x, y, r, col, a, op) {
    g.save(); g.globalCompositeOperation = op || 'lighter';
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, css(col, a)); gr.addColorStop(1, css(col, 0));
    g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); g.restore();
  }
  function dabs(x0, y0, x1, y1, cols, n, bw, len, dir, a) { // loose brushwork in a box
    g.save(); g.lineCap = 'round';
    for (let i = 0; i < n; i++) {
      const px = rr(x0, x1), py = rr(y0, y1), ang = dir + rr(-0.35, 0.35), l = len * rr(0.5, 1.4);
      g.strokeStyle = css(jit(pick(cols), 20), a * rr(0.6, 1.2)); g.lineWidth = bw * rr(0.5, 1.3);
      g.beginPath(); g.moveTo(px, py); g.quadraticCurveTo(px + Math.cos(ang) * l * 0.5 + rr(-3, 3), py + Math.sin(ang) * l * 0.5 + rr(-3, 3), px + Math.cos(ang) * l, py + Math.sin(ang) * l); g.stroke();
    }
    g.restore();
  }

  /* ---------------------------------------------------------------- lettering
   * Skeleton glyphs in a box 1 unit tall (y down). Painted with butt caps and
   * mitred joins, clipped flat at cap height and baseline, then outlined,
   * extruded and brushed like a sign painter's block letter.            */
  const GL = (function () {
    const a = (cx, cy, rx, ry, a0, a1) => { const n = Math.max(4, Math.ceil(Math.abs(a1 - a0) / 10)); const o = []; for (let i = 0; i <= n; i++) { const t = (a0 + (a1 - a0) * i / n) * D2R; o.push([cx + rx * Math.cos(t), cy + ry * Math.sin(t)]); } return o; };
    const G = {}, UP = -0.6, DN = 1.6;
    const d = (ch, adv, s) => { G[ch] = { a: adv, s }; };
    d('A', .66, [[[-.03, 1.25], [.33, -.12], [.69, 1.25]], [[.12, .66], [.54, .66]]]);
    d('B', .59, [[[0, UP], [0, DN]], [[0, 0], [.32, 0], ...a(.32, .24, .23, .24, -90, 90).slice(1), [0, .48]], [[0, .48], [.34, .48], ...a(.34, .74, .25, .26, -90, 90).slice(1), [0, 1]]]);
    d('C', .62, [a(.33, .5, .33, .5, -42, -318)]);
    d('D', .62, [[[0, UP], [0, DN]], [[0, 0], [.22, 0], ...a(.22, .5, .4, .5, -90, 90).slice(1), [0, 1]]]);
    d('E', .54, [[[.54, 0], [0, 0], [0, 1], [.54, 1]], [[0, .5], [.44, .5]]]);
    d('F', .54, [[[.54, 0], [0, 0], [0, DN]], [[0, .48], [.44, .48]]]);
    d('G', .68, [[...a(.34, .5, .34, .5, -40, -360), [.4, .52]], [[.68, .5], [.68, DN]]]);
    d('H', .56, [[[0, UP], [0, DN]], [[.56, UP], [.56, DN]], [[0, .5], [.56, .5]]]);
    d('I', 0, [[[0, UP], [0, DN]]]);
    d('J', .46, [[[.46, UP], [.46, .66], ...a(.23, .66, .23, .34, 0, 180).slice(1)]]);
    d('K', .6, [[[0, UP], [0, DN]], [[.64, -.08], [.02, .6]], [[.22, .4], [.66, 1.12]]]);
    d('L', .5, [[[0, UP], [0, 1], [.5, 1]]]);
    d('M', .76, [[[0, DN], [0, -.04], [.38, .72], [.76, -.04], [.76, DN]]]);
    d('N', .6, [[[0, DN], [0, -.08], [.6, 1.08], [.6, UP]]]);
    d('O', .7, [a(.35, .5, .35, .5, -90, 270)]);
    d('P', .55, [[[0, UP], [0, DN]], [[0, 0], [.28, 0], ...a(.28, .27, .27, .27, -90, 90).slice(1), [0, .54]]]);
    d('Q', .72, [a(.35, .5, .35, .5, -90, 270), [[.42, .66], [.8, 1.12]]]);
    d('R', .58, [[[0, UP], [0, DN]], [[0, 0], [.28, 0], ...a(.28, .27, .27, .27, -90, 90).slice(1), [0, .54]], [[.22, .54], [.62, 1.15]]]);
    d('S', .6, [[...a(.3, .26, .29, .26, -20, -270), ...a(.3, .755, .31, .245, -90, 160).slice(1)]]);
    d('T', .64, [[[0, 0], [.64, 0]], [[.32, 0], [.32, DN]]]);
    d('U', .58, [[[0, UP], [0, .62], ...a(.29, .62, .29, .38, 180, 0).slice(1), [.58, UP]]]);
    d('V', .64, [[[-.02, UP], [.32, 1.12], [.66, UP]]]);
    d('W', .88, [[[-.02, UP], [.21, 1.1], [.44, .12], [.67, 1.1], [.9, UP]]]);
    d('X', .62, [[[0, -.12], [.62, 1.12]], [[.62, -.12], [0, 1.12]]]);
    d('Y', .62, [[[-.02, -.15], [.31, .5], [.64, -.15]], [[.31, .48], [.31, DN]]]);
    d('Z', .56, [[[.0, 0], [.56, 0], [0, 1], [.58, 1]]]);
    d('0', .56, [a(.28, .5, .28, .5, -90, 270)]);
    d('1', .32, [[[0, .2], [.3, -.04], [.3, DN]]]);
    d('2', .56, [[...a(.28, .28, .28, .28, -165, 15), [0, 1], [.58, 1]]]);
    d('3', .56, [a(.27, .25, .26, .25, -160, 90), a(.27, .74, .3, .26, -90, 160)]);
    d('4', .62, [[[.44, DN], [.44, -.02], [0, .7], [.62, .7]]]);
    d('5', .56, [[[.54, 0], [.04, 0], [.02, .44], ...a(.27, .68, .3, .31, -120, 155)]]);
    d('6', .58, [[[.5, -.02], [.18, .3], ...a(.29, .68, .29, .32, 200, 560)]]);
    d('7', .58, [[[0, 0], [.58, 0], [.2, DN]]]);
    d('8', .58, [a(.29, .25, .24, .25, 90, 450), a(.29, .74, .29, .26, -90, 270)]);
    d('9', .58, [[...a(.29, .32, .29, .32, 20, 380), [.56, .45], [.42, .75], [.12, 1.02]]]);
    d('!', 0, [[[0, UP], [0, .64]], [[0, .84], [0, DN]]]);
    d("'", 0, [[[.03, -0.4], [-.03, .3]]]);
    d('.', 0, [[[0, .84], [0, DN]]]);
    d(',', 0, [[[0, .84], [0, DN]]]);
    d(':', 0, [[[0, .18], [0, .44]], [[0, .84], [0, DN]]]);
    d('-', .34, [[[0, .54], [.34, .54]]]);
    d('·', 0, [[[0, .42], [0, .64]]]);
    d('?', .52, [[...a(.26, .26, .26, .26, -165, 60), [.26, .54], [.26, .66]], [[.26, .84], [.26, DN]]]);
    d(' ', .32, []);
    return G;
  })();

  const SW = { willReadFrequently: true }; // software raster: predictable cost, cheap readback
  function mkCanvas(w, h) { const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c; }
  function tint(src, col) {
    const c = mkCanvas(src.width, src.height), x = c.getContext('2d', SW);
    x.drawImage(src, 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = css(col); x.fillRect(0, 0, c.width, c.height);
    return c;
  }
  function dilate(src, r) {
    const c = mkCanvas(src.width, src.height), x = c.getContext('2d', SW);
    x.drawImage(src, 0, 0);
    if (r > 0.3) for (const f of [1, 0.55]) for (let i = 0; i < 16; i++) { const a = i / 16 * TAU; x.drawImage(src, Math.cos(a) * r * f, Math.sin(a) * r * f); }
    return c;
  }

  // Paint a line of lettering. Returns layout info.
  function letters(str, x, y, h, o) {
    o = o || {};
    const wt = o.w || 0.22, s0 = h / (1 + wt);
    const chars = [...str];
    const gs = chars.map((ch) => {
      const gl = GL[ch] || GL[' '];
      return { ch, gl, sc: 1 + (R() - 0.5) * 0.08 * (o.jit === undefined ? 1 : o.jit), rot: (R() - 0.5) * 0.06 * (o.jit === undefined ? 1 : o.jit) + (o.rot || 0), dy: (R() - 0.5) * 0.05 * h * (o.jit === undefined ? 1 : o.jit), gap: (o.track === undefined ? 0.1 : o.track) * h * rr(0.55, 1.45), f: 1 };
    });
    let s = s0;
    const adv = (gd, f) => gd.ch === ' ' ? GL[' '].a * s * (0.7 + 0.3 * f) : (gd.gl.a * s * gd.sc * f + wt * s * gd.sc + gd.gap * (0.5 + 0.5 * f));
    const total = (fmin, k0) => { let t = 0; gs.forEach((gd, i) => { const f = i < k0 ? 1 : 1 - (1 - fmin) * Math.pow((i - k0 + 1) / (gs.length - k0), 0.8); gd.f = f; t += adv(gd, f); }); return t; };
    const k0 = Math.floor(gs.length * (o.k0 === undefined ? 0.45 : o.k0));
    let tw = total(1, gs.length);
    if (o.maxW && tw > o.maxW) {
      const FM = o.fmin || 0.56;
      if (total(FM, k0) > o.maxW) { const t0 = total(FM, k0); s = s * o.maxW / t0; gs.forEach((gd) => { gd.gap *= o.maxW / t0; }); tw = total(FM, k0); }
      else { let lo = FM, hi = 1; for (let it = 0; it < 22; it++) { const m = (lo + hi) / 2; if (total(m, k0) > o.maxW) hi = m; else lo = m; } tw = total(lo, k0); }
    } else gs.forEach((gd) => { gd.f = 1; });
    let cx = o.align === 'center' ? x - tw / 2 : o.align === 'right' ? x - tw : x;
    const startX = cx;
    // geometry per glyph
    for (const gd of gs) {
      const sc = s * gd.sc, gw = gd.gl.a * sc * gd.f;
      gd.s = sc; gd.lw = wt * sc;
      gd.cx = cx + (gd.ch === ' ' ? 0 : gd.lw / 2 + gw / 2); gd.cy = y + h / 2 + gd.dy;
      gd.gw = gw;
      gd.lines = gd.gl.s.map((st) => st.map((p) => [(p[0] * gd.f) * sc - gw / 2 + (R() - 0.5) * 0.012 * sc, p[1] * sc - sc / 2 + (R() - 0.5) * 0.012 * sc]));
      cx += adv(gd, gd.f);
    }
    const pad = h * (0.12 + (o.ext ? o.ext[2] : 0)) + (o.ol || 0) * h + (o.ol2 || 0) * h + 6;
    const dripMax = o.drip ? h * 1.0 : 0;
    const bx0 = startX - pad, by0 = y - pad, bw = tw + pad * 2, bh = h + pad * 2 + dripMax;
    const kk = K * (o.res || 1);
    const M = mkCanvas(bw * kk, bh * kk), m = M.getContext('2d', SW);
    m.setTransform(kk, 0, 0, kk, -bx0 * kk, -by0 * kk);
    m.fillStyle = m.strokeStyle = '#fff';
    const capStyle = o.cap || 'butt';
    for (const gd of gs) {
      if (gd.ch === ' ') continue;
      m.save(); m.translate(gd.cx, gd.cy); m.rotate(gd.rot);
      m.save();
      m.beginPath(); m.rect(-9999, -gd.s / 2 - gd.lw / 2, 19999, gd.s + gd.lw); m.clip();
      m.lineWidth = gd.lw; m.lineCap = capStyle; m.lineJoin = 'miter'; m.miterLimit = 2.4;
      for (const ln of gd.lines) { m.beginPath(); m.moveTo(ln[0][0], ln[0][1]); for (let i = 1; i < ln.length; i++) m.lineTo(ln[i][0], ln[i][1]); m.stroke(); }
      m.restore();
      if (o.drip) {
        const base = gd.s / 2 + gd.lw / 2 - 1;
        const cands = [];
        for (const ln of gd.lines) for (let i = 1; i < ln.length; i++) {
          const p = ln[i - 1], q = ln[i];
          if ((p[1] - base) * (q[1] - base) < 0) cands.push(p[0] + (q[0] - p[0]) * (base - p[1]) / (q[1] - p[1]));
          else if (Math.abs(p[1] - base + gd.lw / 2) < gd.lw * 0.6 && Math.abs(q[1] - base + gd.lw / 2) < gd.lw * 0.6 && Math.abs(q[0] - p[0]) > gd.lw) cands.push(rr(Math.min(p[0], q[0]), Math.max(p[0], q[0])));
        }
        for (const dx of cands) {
          if (R() > o.drip) continue;
          const dw = gd.lw * rr(0.18, 0.4), L = h * rr(0.12, 0.75) * (R() < 0.25 ? 1.5 : 1);
          const ddx = dx + rr(-gd.lw * 0.25, gd.lw * 0.25);
          const p = new Path2D();
          p.moveTo(ddx - dw * 1.6, base - 2);
          p.bezierCurveTo(ddx - dw * 0.5, base + L * 0.15, ddx - dw * 0.42, base + L * 0.6, ddx - dw * 0.4, base + L);
          p.arc(ddx, base + L, dw * 0.62, Math.PI, 0, true);
          p.bezierCurveTo(ddx + dw * 0.42, base + L * 0.6, ddx + dw * 0.5, base + L * 0.15, ddx + dw * 1.6, base - 2);
          p.closePath(); m.fill(p);
          gd.drips = gd.drips || []; gd.drips.push([ddx, base, L, dw]);
        }
      }
      m.restore();
    }
    const draw = (cv, dx, dy) => g.drawImage(cv, bx0 + (dx || 0), by0 + (dy || 0), bw, bh);
    const r1 = (o.ol || 0) * h * kk, r2 = ((o.ol || 0) + (o.ol2 || 0)) * h * kk;
    if (o.ext) {
      const E = tint(dilate(M, r2), o.extc || '#140806');
      const n = Math.max(2, Math.round(o.ext[2] * h * 1.2));
      for (let i = n; i >= 1; i--) draw(E, o.ext[0] * o.ext[2] * h * i / n, o.ext[1] * o.ext[2] * h * i / n);
    }
    if (o.shadow) { const E = tint(dilate(M, r2), o.shadowc || '#000'); g.save(); g.globalAlpha = o.shadowa || 0.9; draw(E, o.shadow[0] * h, o.shadow[1] * h); g.restore(); }
    if (o.ol2) draw(tint(dilate(M, r2), o.ol2c || '#111'));
    if (o.ol) draw(tint(dilate(M, r1), o.olc || '#ffd21a'));
    // fill + brushwork
    const F = tint(M, o.fill || '#fff'), f = F.getContext('2d', SW);
    if (o.paint !== false) {
      f.setTransform(kk, 0, 0, kk, -bx0 * kk, -by0 * kk);
      f.globalCompositeOperation = 'source-atop';
      const fc = rgb(o.fill || '#fff');
      if (o.grad) { // painter's blended fill, e.g. yellow into red
        const gr = f.createLinearGradient(0, y, 0, y + h); o.grad.forEach((st, i) => gr.addColorStop(i / (o.grad.length - 1), css(st))); f.fillStyle = gr; f.fillRect(bx0, by0, bw, bh);
      }
      for (const gd of gs) {
        if (gd.ch === ' ') continue;
        f.save(); f.translate(gd.cx, gd.cy); f.rotate(gd.rot); f.lineCap = 'round'; f.lineJoin = 'round';
        for (const ln of gd.lines) {
          const pass = (dx, dy, col, lw, a) => { f.strokeStyle = css(col, a); f.lineWidth = lw; f.beginPath(); f.moveTo(ln[0][0] + dx, ln[0][1] + dy); for (let i = 1; i < ln.length; i++) f.lineTo(ln[i][0] + dx, ln[i][1] + dy); f.stroke(); };
          const lw = gd.lw;
          pass(lw * 0.34, lw * 0.34, lit(fc, -0.35), lw * 0.4, 0.28);
          for (let k = 0; k < 5; k++) { const off = rr(-0.42, 0.42) * lw; pass(off, off * rr(-0.5, 0.5), lit(fc, rr(-0.25, 0.3)), rr(0.4, 0.14 * lw + 0.6), rr(0.2, 0.45)); }
        }
        if (gd.drips) for (const d of gd.drips) { f.strokeStyle = css(lit(fc, 0.5), 0.6); f.lineWidth = d[3] * 0.35; f.beginPath(); f.moveTo(d[0] - d[3] * 0.25, d[1]); f.lineTo(d[0] - d[3] * 0.2, d[1] + d[2] * 0.9); f.stroke(); }
        if (o.flick !== false && R() < 0.8) { // flicked highlight
          const ln = pick(gd.lines), p = pick(ln);
          f.strokeStyle = css(o.flickc || [255, 255, 240], 0.85); f.lineWidth = Math.max(0.8, gd.lw * 0.12);
          f.beginPath(); f.moveTo(p[0] - gd.lw * 0.3, p[1] - gd.lw * 0.25); f.lineTo(p[0] - gd.lw * 0.05, p[1] - gd.lw * 0.32); f.stroke();
        }
        f.restore();
      }
    }
    draw(F);
    return { x0: startX, x1: startX + tw, gs, s };
  }

  /* ------------------------------------------------------------- the poster */
  const SKY = [[0, '#0f0a2e'], [0.2, '#24135a'], [0.4, '#4d1767'], [0.56, '#8c1d4a'], [0.7, '#cc3a1e'], [0.82, '#f0781a'], [0.92, '#ffb83c'], [1, '#ffd770']];
  function skyCol(y) {
    const t = Math.max(0, Math.min(1, y / 1060));
    for (let i = 1; i < SKY.length; i++) if (t <= SKY[i][0]) { const a = SKY[i - 1], b = SKY[i]; return mix(a[1], b[1], (t - a[0]) / (b[0] - a[0])); }
    return rgb(SKY[SKY.length - 1][1]);
  }

  // side of the wagon in perspective: t 0 (front corner) → 1 (rear), v 0 (roof) → 1 (chassis)
  const SHIFT = 34;
  const SIDE = { nx: 410, fx: 18, nt: 452, nb: 1004, ft: 392, fb: 760 };
  function sideP(t, v) {
    const e = (1 - 1 / (1 + t * 1.15)) / (1 - 1 / 2.15); // foreshortening
    const x = lerp(SIDE.nx, SIDE.fx, e);
    const top = lerp(SIDE.nt, SIDE.ft, e), bot = lerp(SIDE.nb, SIDE.fb, e);
    return [x, lerp(top, bot, v)];
  }
  function sideQuad(t0, t1, v0, v1) { return Pg([sideP(t0, v0), sideP(t1, v0), sideP(t1, v1), sideP(t0, v1)]); }

  function buildSteps(st) {
    const steps = [];
    const add = (f) => steps.push(f);
    const seamY = st.seamY;

    /* ---- the sacks */
    add(() => {
      g.fillStyle = css(st.sack); g.fillRect(-20, -20, PW + 40, PH + 40);
      dabs(0, 0, PW, PH, [lit(st.sack, 0.08), lit(st.sack, -0.08)], 900, 18, 60, 0, 0.18);
      millLogo(500, seamY * 0.5 + 10, 1, 0, 1);
      millLogo(500, seamY + (PH - seamY) * 0.5, 1, Math.PI, 1);
    });
    add(() => { g.save(); g.clip(st.paintArea); st.clipOn = true; });

    /* ---- sky */
    add(() => {
      const gr = g.createLinearGradient(0, 0, 0, 1060);
      SKY.forEach(([t, c]) => gr.addColorStop(t, c));
      g.fillStyle = gr; g.fillRect(0, 0, PW, 1080);
    });
    for (let b = 0; b < 6; b++) add(() => {
      g.save(); g.lineCap = 'round';
      for (let i = 0; i < 260; i++) {
        const y = rr(-20, 1060), x = rr(-40, PW);
        const c = lit(skyCol(y + rr(-60, 60)), rr(-0.2, 0.22));
        const ang = -0.38 + rr(-0.25, 0.2) + (x - 500) * 0.0002, l = rr(50, 170);
        g.strokeStyle = css(c, rr(0.18, 0.4)); g.lineWidth = rr(8, 26);
        g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + l * 0.5, y + Math.sin(ang) * l * 0.5 + rr(-14, 14), x + Math.cos(ang) * l, y + Math.sin(ang) * l); g.stroke();
      }
      g.restore();
    });
    add(() => {
      dry(() => { g.save(); g.lineCap = 'round';
        for (let i = 0; i < 140; i++) {
          const y = rr(-20, 1040), x = rr(-40, PW), c = lit(skyCol(y), rr(0.1, 0.4)), l = rr(60, 200), ang = -0.38 + rr(-0.2, 0.2);
          g.strokeStyle = css(c, rr(0.3, 0.7)); g.lineWidth = rr(6, 22);
          g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + l * 0.5, y + Math.sin(ang) * l * 0.5 + rr(-10, 10), x + Math.cos(ang) * l, y + Math.sin(ang) * l); g.stroke();
        }
        g.restore(); });
      flushDry();
    });
    // storm clouds
    add(() => { cloud(150, 330, 260, 120, '#2a1d5a', 0); cloud(860, 360, 220, 120, '#2e1f5e', 1); });
    add(() => { cloud(520, 395, 300, 70, '#3a2464', 2); cloud(90, 600, 200, 170, '#1d1438', 3); });
    add(() => { lightning(st); });
    /* ---- ground */
    add(() => ground(st));
    add(() => { fireLine(st, 0); });
    add(() => { g.save(); g.translate(0, SHIFT); smoke(st); });
    /* ---- the wagon */
    add(() => wagonSide(st));
    add(() => wagonWindows(st));
    for (let i = 0; i < 4; i++) add(() => passenger(st, i));
    add(() => luggage(st));
    add(() => goat(st));
    add(() => wheels(st));
    add(() => wagonFront(st));
    add(() => wagonFace(st));
    add(() => wagonMouth(st));
    add(() => { snake(st); g.restore(); });
    add(() => fireLine(st, 1));
    add(() => tinyFolk(st));
    /* ---- the people */
    add(() => hero(st));
    add(() => heroHead(st));
    add(() => heroArms(st));
    add(() => bubble(st));
    add(() => woman(st));
    add(() => pot(st));
    /* ---- words */
    add(() => titleBlock(st));
    add(() => partTwo(st));
    add(() => bottomBlock(st));
    add(() => credits(st));
    add(() => { g.restore(); st.clipOn = false; });
    add(() => { // brush ends dragged past the painted edge, catching only the threads
      dry(() => { g.save(); g.lineCap = 'round';
        for (let i = 0; i < 260; i++) {
          const side = Math.floor(R() * 4);
          let x, y, ang;
          if (side < 2) { x = side ? PW - rr(10, 22) : rr(10, 22); y = rr(0, PH); ang = side ? 0 : Math.PI; }
          else { y = side === 2 ? rr(10, 22) : PH - rr(12, 24); x = rr(0, PW); ang = side === 2 ? -Math.PI / 2 : Math.PI / 2; }
          ang += rr(-0.5, 0.5);
          const c = y > 1336 ? rgb('#1a1210') : y > 980 ? rgb('#9a3a1a') : skyCol(y);
          const l = rr(6, 22);
          g.strokeStyle = css(lit(c, rr(-0.1, 0.15)), rr(0.5, 0.95)); g.lineWidth = rr(4, 12);
          g.beginPath(); g.moveTo(x - Math.cos(ang) * 6, y - Math.sin(ang) * 6); g.lineTo(x + Math.cos(ang) * l, y + Math.sin(ang) * l); g.stroke();
        }
        g.restore(); });
      flushDry();
    });
    /* ---- the material */
    add(() => material(st, 0));
    add(() => material(st, 1));
    add(() => seam(st));
    add(() => creases(st));
    return steps;
  }

  /* ----------------------------------------------------------- mill print */
  function millLogo(cx, cy, s, rot, alpha) {
    g.save(); g.translate(cx, cy); g.rotate(rot + rr(-0.04, 0.04)); g.scale(s, s); g.globalAlpha = alpha;
    const blue = '#2c4a9a', red = '#b8302c';
    g.strokeStyle = blue; g.lineWidth = 9; g.beginPath(); g.arc(0, 0, 175, 0, TAU); g.stroke();
    g.lineWidth = 3; g.beginPath(); g.arc(0, 0, 160, 0, TAU); g.stroke();
    // wheat sheaf
    g.strokeStyle = red; g.fillStyle = red; g.lineWidth = 4;
    for (let i = -3; i <= 3; i++) {
      const a = i * 0.13;
      g.save(); g.rotate(a);
      g.beginPath(); g.moveTo(0, 70); g.lineTo(0, -60); g.stroke();
      for (let k = 0; k < 6; k++) { g.beginPath(); g.ellipse(-6, -60 - k * 11, 4, 8, -0.4, 0, TAU); g.fill(); g.beginPath(); g.ellipse(6, -60 - k * 11, 4, 8, 0.4, 0, TAU); g.fill(); }
      g.restore();
    }
    g.fillStyle = blue; g.fillRect(-40, 10, 80, 12);
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = 'bold 30px sans-serif';
    const txt = 'HAPPY SHEAF FLOUR MILLS LTD';
    for (let i = 0; i < txt.length; i++) {
      const a = -Math.PI / 2 + (i - (txt.length - 1) / 2) * 0.105;
      g.save(); g.rotate(a + Math.PI / 2); g.fillText(txt[i], 0, -128); g.restore();
    }
    g.font = 'bold 40px sans-serif'; g.fillStyle = red; g.fillText('BAKERS FLOUR', 0, 100);
    g.font = 'bold 26px sans-serif'; g.fillStyle = blue; g.fillText('50 KG NET  ·  SEKONDI', 0, 138);
    g.font = 'bold 54px sans-serif'; g.fillText('HAPPY SHEAF', 0, 235);
    g.font = '22px sans-serif'; g.fillText('NOT FOR RESALE · KEEP DRY · BATCH 0417', 0, -205);
    g.restore();
  }

  /* -------------------------------------------------------------- sky parts */
  function cloud(cx, cy, w, h, col, k) {
    const n = 22, pts = [];
    const ph1 = rr(0, TAU), ph2 = rr(0, TAU);
    for (let i = 0; i < n; i++) {
      const a = i / n * TAU;
      const bump = 1 + 0.16 * Math.sin(a * 5 + ph1) + 0.1 * Math.sin(a * 9 + ph2) + (Math.sin(a) < 0 ? 0.08 : -0.05);
      pts.push([cx + Math.cos(a) * w * bump, cy + Math.sin(a) * h * bump * (Math.sin(a) > 0 ? 0.7 : 1)]);
    }
    const sh = S(pts);
    paint(sh, col, { dir: 'round', sd: 0.2, shc: '#120a26', hi: 0.12, hic: '#8f7bc8', hia: 0.6, line: null, bw: 12, len: 60, n: 1.4, var: 0.35 });
    // fire-lit underbelly
    g.save(); g.clip(sh.path);
    crescent(sh, 0, -h * 0.25, [230, 90, 50], 0.32);
    // swirls
    g.lineCap = 'round';
    for (let i = 0; i < 14; i++) {
      const r = rr(0.2, 0.9), a0 = rr(0, TAU);
      g.strokeStyle = css(lit(col, rr(0.1, 0.4)), rr(0.2, 0.45)); g.lineWidth = rr(3, 9);
      g.beginPath(); g.ellipse(cx + rr(-w, w) * 0.4, cy + rr(-h, h) * 0.3, w * r * 0.5, h * r * 0.45, rr(-0.2, 0.2), a0, a0 + rr(1.5, 3.5)); g.stroke();
    }
    g.restore();
    dry(() => { g.save(); g.clip(sh.path); dabs(cx - w, cy - h * 1.1, cx + w, cy - h * 0.2, [lit(col, 0.5), '#b8a0e8', '#e890b0'], 50, 10, 70, -0.3, 0.7); g.restore(); });
    flushDry();
    void k;
  }
  function bolt(x0, y0, x1, y1, wd, seg) {
    const pts = [[x0, y0]];
    for (let i = 1; i < seg; i++) {
      const t = i / seg;
      const nx = -(y1 - y0), ny = x1 - x0, l = Math.hypot(nx, ny);
      const off = (i % 2 ? 1 : -1) * rr(0.35, 1) * wd;
      pts.push([lerp(x0, x1, t) + nx / l * off, lerp(y0, y1, t) + ny / l * off]);
    }
    pts.push([x1, y1]);
    return pts;
  }
  function drawBolt(pts, w) {
    g.save();
    g.globalCompositeOperation = 'lighter';
    strokeLine(pts, [160, 60, 200], w * 5, 0.25);
    strokeLine(pts, [255, 120, 160], w * 2.6, 0.3);
    g.restore();
    strokeLine(pts, '#1a0820', w * 1.9 + 3, 1, 'butt');
    strokeLine(pts, '#ffe23a', w * 1.6, 1, 'butt');
    strokeLine(pts, '#fffbe0', w * 0.55, 1, 'butt');
  }
  function lightning(st) {
    glow(930, 560, 300, [200, 120, 255], 0.28);
    const a = bolt(1010, 300, 912, 935, 34, 9);
    drawBolt(a, 8);
    const br = bolt(a[4][0], a[4][1], a[4][0] - 90, a[4][1] + 150, 16, 4); drawBolt(br, 3.5);
    const br2 = bolt(a[2][0], a[2][1], a[2][0] + 60, a[2][1] + 90, 12, 3); drawBolt(br2, 2.5);
    const b = bolt(330, 0, 470, 330, 22, 6); drawBolt(b, 4.5);
    glow(912, 935, 120, [255, 230, 140], 0.6);
    void st;
  }

  /* ------------------------------------------------------------------ ground */
  function ground(st) {
    const gr = g.createLinearGradient(0, 900, 0, 1350);
    gr.addColorStop(0, '#d0602a'); gr.addColorStop(0.4, '#9a3418'); gr.addColorStop(1, '#4a140a');
    const gsh = Pg([[0, 930], [PW, 900], [PW, 1360], [0, 1360]]);
    g.fillStyle = gr; g.fill(gsh.path);
    dabs(0, 940, PW, 1350, ['#b5461f', '#7a2510', '#d86a30', '#5a1a0a'], 700, 9, 50, 0.05, 0.3);
    dry(() => dabs(0, 940, PW, 1350, ['#e08040', '#f0a050', '#c05020'], 260, 14, 70, 0.05, 0.7));
    flushDry();
    // the road, lighter, fanning toward us
    const road = Pg([[420, 990], [830, 980], [990, 1360], [250, 1360]]);
    paint(road, '#c26a35', { dir: 0.0, sd: 0, hi: 0, line: null, bw: 8, len: 60, var: 0.3, n: 1.2 });
    g.save(); g.clip(road.path);
    for (let i = 0; i < 6; i++) strokeLine([[560 + i * 30, 1000], [480 + i * 70, 1360]], '#7a3018', 5, 0.25);
    g.restore();
    void st;
  }
  function flame(x, y, h, w, lean, cols) {
    cols = cols || ['#c4140e', '#ff5a10', '#ffb21c', '#fff2a0'];
    const sc = [1, 0.74, 0.5, 0.26];
    for (let k = 0; k < cols.length; k++) {
      const hh = h * sc[k], ww = w * (0.4 + sc[k] * 0.6);
      const by = y, tips = 3;
      const pts = [[x - ww / 2, by]];
      for (let i = 0; i < tips; i++) {
        const t = (i + 0.5) / tips;
        const tx = x - ww / 2 + ww * t + lean * hh * rr(0.7, 1.1);
        const th = hh * (i === 1 ? 1 : rr(0.5, 0.8));
        pts.push([lerp(x - ww / 2, x + ww / 2, t - 0.2) + lean * th * 0.35, by - th * 0.45]);
        pts.push([tx, by - th, 1]);
        pts.push([lerp(x - ww / 2, x + ww / 2, t + 0.2) + lean * th * 0.3, by - th * 0.4]);
      }
      pts.push([x + ww / 2, by]); pts.push([x, by + h * 0.08]);
      const sh = S(pts, 0.9);
      paint(sh, cols[k], { dir: -Math.PI / 2 + lean * 0.6, sd: 0, hi: 0, line: k === 0 ? '#5a0806' : null, lw: 2, bw: 4, len: 30, var: 0.25 });
    }
    dry(() => { dabs(x - w * 0.6, y - h * 1.05, x + w * 0.6, y - h * 0.2, ['#ffe060', '#ff8a20', '#ffc040'], 6, 5, h * 0.3, -Math.PI / 2 + lean * 0.5, 0.8); });
  }
  function fireLine(st, which) {
    if (which === 0) { // distant fires on the horizon and around the rear of the wagon
      glow(150, 900, 260, [255, 120, 30], 0.45);
      glow(880, 930, 200, [255, 140, 40], 0.4);
      for (let i = 0; i < 9; i++) flame(rr(0, 300), 960 + rr(-30, 20), rr(60, 130), rr(40, 80), -0.35, null);
      for (let i = 0; i < 5; i++) flame(rr(830, 1000), 930 + rr(-20, 20), rr(40, 90), rr(30, 60), -0.2);
    } else { // foreground flames along the bottom
      glow(500, 1300, 360, [255, 120, 20], 0.35);
      for (let i = 0; i < 16; i++) { const x = rr(-20, 1020); flame(x, 1350 + rr(-10, 10), rr(80, 190) * (Math.abs(x - 560) > 250 ? 1 : 0.3), rr(50, 100), rr(-0.3, 0.1)); }
    }
    flushDry();
  }
  function smoke(st) {
    for (let i = 0; i < 9; i++) {
      const x = rr(-30, 220), y = rr(560, 860), r = rr(50, 110);
      const pts = []; const n = 14;
      for (let k = 0; k < n; k++) { const a = k / n * TAU; const b = 1 + 0.15 * Math.sin(a * 4 + i); pts.push([x + Math.cos(a) * r * b, y + Math.sin(a) * r * 0.8 * b]); }
      paint(S(pts), mix('#2a1a24', '#5a3a3a', R()), { dir: 'round', sd: 0.2, hi: 0.1, hic: '#a0603a', line: null, bw: 10, len: 40 });
    }
    void st;
  }

  /* -------------------------------------------------------------- the wagon */
  function wagonSide(st) {
    // whole side, then bands
    const all = sideQuad(0, 1, 0, 1);
    paint(all, st.wood, { dir: Math.atan2(SIDE.ft - SIDE.nt, SIDE.fx - SIDE.nx), sd: 0, hi: 0, line: '#140a06', lw: 3 });
    const bands = st.bands;
    for (let i = 0; i < bands.length; i++) {
      const v0 = 0.5 + i * 0.075, v1 = v0 + 0.075;
      paint(sideQuad(0, 1, v0, v1), bands[i], { dir: Math.atan2(SIDE.fb - SIDE.nb, SIDE.fx - SIDE.nx), sd: 0, hi: 0, line: '#140a06', lw: 1.5, bw: 4, len: 40, var: 0.18 });
    }
    // roof rail and mid rail
    paint(sideQuad(0, 1, 0, 0.06), '#1d3fa0', { dir: 3.0, sd: 0, hi: 0.2, line: '#0a0a14', lw: 2 });
    paint(sideQuad(0, 1, 0.43, 0.5), '#e8c21a', { dir: 3.0, sd: 0, hi: 0.15, line: '#140a06', lw: 2 });
    paint(sideQuad(0, 1, 0.88, 1), '#1a1210', { dir: 3.0, sd: 0, hi: 0.1, line: null });
    // diamonds along the mid rail
    for (let i = 0; i < 9; i++) {
      const t = (i + 0.5) / 9, a = sideP(t - 0.03, 0.465), b = sideP(t, 0.435), c = sideP(t + 0.03, 0.465), d = sideP(t, 0.495);
      paint(Pg([a, b, c, d]), i % 2 ? '#d01c1c' : '#1a7a34', { flat: true, line: null });
    }
    // slogan on the side panel, in naive perspective
    const o = sideP(0.97, 0.54), p1 = sideP(0.3, 0.54), q = sideP(0.97, 0.84), q1 = sideP(0.3, 0.84);
    const ux = (p1[0] - o[0]), uy = (p1[1] - o[1]), vx = ((q[0] - o[0]) + (q1[0] - p1[0])) / 2, vy = ((q[1] - o[1]) + (q1[1] - p1[1])) / 2;
    g.save();
    g.transform(ux / 600, uy / 600, vx / 100, vy / 100, o[0], o[1]);
    letters('SEA NEVER DRY', 0, 16, 64, { maxW: 610, k0: 0.85, fill: '#fff4d8', ol: 0.06, olc: '#141010', w: 0.2, jit: 0.8 });
    g.restore();
  }
  function wagonWindows(st) {
    const ts = st.posts;
    // window band: dark interior
    paint(sideQuad(0, 1, 0.06, 0.43), '#1a0e10', { flat: true, line: null });
    // people heads are drawn later; posts now
    for (const t of ts) {
      const w = 0.018 + (1 - t) * 0.012;
      paint(sideQuad(t - w, t + w, 0.06, 0.43), '#7a4a26', { dir: Math.PI / 2, sd: 0.2, hi: 0.2, line: '#140a06', lw: 1.6 });
    }
  }
  function passenger(st, i) {
    const t = [0.12, 0.36, 0.6, 0.82][i];
    const top = sideP(t, 0.06), bot = sideP(t, 0.43);
    const s = (bot[1] - top[1]) / 200;
    const x = top[0], y = lerp(top[1], bot[1], 0.48);
    const skins = ['#5a3220', '#3e2216', '#6e3e24', '#4a2a1a'];
    const shirts = ['#e0b21c', '#c8201c', '#2a62c0', '#f2f0e8', '#1a8a40', '#d0508a'];
    const skin = rgb(pick(skins)), shirt = pick(shirts);
    g.save();
    g.clip(sideQuad(Math.max(0, t - 0.14), Math.min(1, t + 0.14), -0.4, 0.43).path);
    // shoulders
    paint(S(T([[-60, 60], [-40, 30], [0, 22], [40, 30], [60, 60], [62, 110], [-62, 110]], x, y, s)), shirt, { dir: 'round', line: '#140a06', lw: 2 });
    // arms raised
    const arm = (sx) => {
      const cs = T([[sx * 40, 50, 13], [sx * 66, 10, 11], [sx * 62, -40, 10], [sx * 54, -70, 9]], x, y, s).map((p, k) => [p[0], p[1], [13, 11, 10, 9][k] * s]);
      paint(Limb(cs), skin, { dir: Math.PI / 2, line: '#140a06', lw: 1.8 });
      hand(x + sx * 52 * s, y - 86 * s, s * 1.1, -Math.PI / 2 + sx * 0.35, skin, sx);
    };
    arm(-1); arm(1);
    // head
    scaredHead(x, y - 8 * s, s, skin, i);
    g.restore();
  }
  function hand(x, y, s, ang, skin, side) {
    // palm toward viewer, fingers spread along ang
    const c = Math.cos(ang), sn = Math.sin(ang);
    const P = (u, v) => [x + (u * c - v * sn) * s, y + (u * sn + v * c) * s]; // u along fingers, v across
    const palm = S([P(-12, -10), P(2, -12), P(8, -6), P(8, 9), P(0, 12), P(-12, 9), P(-16, 0)]);
    paint(palm, skin, { dir: ang, line: '#140a06', lw: 1.4, sd: 0.1 });
    const fing = [[-9, -0.55, 13], [-3, -0.18, 16], [3, 0.12, 17], [8, 0.42, 14]];
    for (const [v, a, l] of fing) {
      const b = P(6, v * 0.95), aa = ang + a * 0.9;
      const e = [b[0] + Math.cos(aa) * l * s, b[1] + Math.sin(aa) * l * s];
      const m = [lerp(b[0], e[0], 0.5), lerp(b[1], e[1], 0.5)];
      paint(Limb([[b[0], b[1], 3 * s], [m[0], m[1], 2.8 * s], [e[0], e[1], 2.4 * s]]), skin, { flat: true, line: '#140a06', lw: 1.2 });
    }
    const tb = P(-6, 10 * side > 0 ? 11 : 11);
    const ta = ang + 1.3;
    paint(Limb([[tb[0], tb[1], 3.2 * s], [tb[0] + Math.cos(ta) * 12 * s, tb[1] + Math.sin(ta) * 12 * s, 2.6 * s]]), skin, { flat: true, line: '#140a06', lw: 1.2 });
  }
  function scaredHead(x, y, s, skin, v) {
    const head = S(T([[0, -38], [22, -32], [30, -10], [27, 14], [18, 36], [0, 46], [-18, 36], [-27, 14], [-30, -10], [-22, -32]], x, y, s));
    paint(head, skin, { dir: 'round', line: '#140a06', lw: 2, flick: 3 });
    // hair / headwrap
    if (v % 2 === 0) paint(S(T([[-30, -14], [-28, -36], [0, -48], [28, -36], [30, -14], [16, -28], [0, -32], [-16, -28]], x, y, s)), '#140c0a', { flat: true, line: null });
    else paint(S(T([[-34, -12], [-36, -40], [-10, -62], [22, -60], [38, -38], [33, -12], [0, -24]], x, y, s)), pick(['#e83a1a', '#f0c010', '#1a7ad0']), { dir: 'round', line: '#140a06', lw: 1.6 });
    // eyes: whites with tiny pupils
    for (const sx of [-1, 1]) {
      const ex = x + sx * 12 * s, ey = y - 6 * s;
      paint(El(ex, ey, 8.5 * s, 10 * s), '#fbf6ea', { flat: true, line: '#140a06', lw: 1.2 });
      flat(El(ex + sx * 0.5 * s, ey - 3 * s, 2.6 * s, 2.6 * s), '#100808');
      strokeLine([[ex - 8 * s, ey - 16 * s - sx * 2 * s], [ex + 8 * s, ey - 18 * s + sx * 2 * s]], '#100808', 3 * s);
    }
    // screaming mouth
    const m = El(x, y + 22 * s, 9 * s, 14 * s);
    paint(m, '#4a0a0e', { flat: true, line: '#140a06', lw: 1.5 });
    g.save(); g.clip(m.path); flat(Pg(T([[-12, 8], [12, 8], [12, 15], [-12, 15]], x, y, s)), '#f6f0e0'); flat(El(x, y + 34 * s, 7 * s, 5 * s), '#d03a3a'); g.restore();
    // sweat
    for (let k = 0; k < 3; k++) { const a = rr(-2.6, -0.5); const d = rr(40, 58); paint(S(T([[0, -6, 1], [3, 0], [0, 3], [-3, 0]], x + Math.cos(a) * d * s, y + Math.sin(a) * d * s, s * 1.3, a + Math.PI / 2)), '#cfe8ff', { flat: true, line: '#0a2a5a', lw: 0.8 }); }
  }
  function luggage(st) {
    const items = [
      [0.04, '#2a62c0', 46, 28], [0.38, '#e0b21c', 40, 34], [0.5, '#c8201c', 54, 26], [0.64, '#8a6a3a', 50, 30], [0.77, '#1a8a40', 40, 30], [0.9, '#f0e8d0', 36, 22],
    ];
    for (const [t, col, w, h] of items) {
      const p = sideP(t, 0); const sc = 1 - t * 0.45;
      const x = p[0], y = p[1] - 4;
      const sh = S([[x - w * sc / 2, y], [x - w * sc * 0.55, y - h * sc * 0.6], [x - w * sc * 0.2, y - h * sc], [x + w * sc * 0.3, y - h * sc * 0.95], [x + w * sc * 0.55, y - h * sc * 0.4], [x + w * sc / 2, y]]);
      paint(sh, col, { dir: 'round', line: '#140a06', lw: 2 });
      strokeLine([[x - w * sc * 0.1, y - h * sc], [x, y]], '#3a2410', 2.5, 0.8);
    }
    // a tin basin, a bicycle wheel
    const b = sideP(0.56, 0);
    paint(El(b[0] + 40, b[1] - 12, 30, 9), '#b8c0c8', { line: '#202428', lw: 2, dir: 0 });
    g.save(); g.strokeStyle = '#151515'; g.lineWidth = 3; g.beginPath(); g.ellipse(sideP(0.7, 0)[0], sideP(0.7, 0)[1] - 34, 18, 26, -0.3, 0, TAU); g.stroke(); g.restore();
  }
  function goat(st) {
    const p = sideP(0.22, 0);
    g.save(); g.translate(p[0], p[1] - 4); g.scale(0.82, 0.82); g.translate(-p[0], -p[1]);
    const x = p[0], y = p[1]; // hooves
    const W = '#f4efe4';
    // body
    const body = S([[x - 46, y - 40], [x - 20, y - 52], [x + 18, y - 50], [x + 40, y - 42], [x + 44, y - 24], [x + 30, y - 16], [x - 30, y - 16], [x - 50, y - 24]]);
    // legs
    for (const [lx, a] of [[-36, -0.1], [-26, 0.15], [24, -0.2], [34, 0.25]]) paint(Limb([[x + lx, y - 22, 4.5], [x + lx + a * 10, y - 8, 3.5], [x + lx + a * 16, y, 3]]), lx < 0 ? '#e8e0d0' : '#1a1410', { flat: true, line: '#140a06', lw: 1.4 });
    paint(body, W, { dir: 0, line: '#140a06', lw: 2.2 });
    paint(S([[x - 10, y - 50], [x + 12, y - 48], [x + 8, y - 34], [x - 12, y - 30]]), '#1a1410', { flat: true, line: null });
    // tail
    strokeLine([[x - 48, y - 40], [x - 58, y - 54]], W, 5);
    // neck & head turned to us, screaming
    const neck = Limb([[x + 34, y - 40, 11], [x + 44, y - 62, 10], [x + 48, y - 76, 9]]);
    paint(neck, W, { dir: -1.2, line: '#140a06', lw: 2 });
    const hx = x + 50, hy = y - 88;
    paint(S([[hx - 18, hy - 10], [hx - 6, hy - 18], [hx + 10, hy - 16], [hx + 18, hy - 6], [hx + 12, hy + 14], [hx + 4, hy + 26], [hx - 6, hy + 24], [hx - 14, hy + 10]]), W, { dir: 'round', line: '#140a06', lw: 2.2 });
    // horns & ears
    curve([[hx - 8, hy - 16], [hx - 18, hy - 32], [hx - 30, hy - 34]], '#3a2a1a', 4.5);
    curve([[hx + 6, hy - 16], [hx + 10, hy - 34], [hx + 2, hy - 44]], '#3a2a1a', 4.5);
    paint(S([[hx - 16, hy - 6], [hx - 36, hy - 4], [hx - 30, hy + 4]]), '#e0d4c0', { flat: true, line: '#140a06', lw: 1.5 });
    paint(S([[hx + 16, hy - 4], [hx + 36, hy - 10], [hx + 32, hy + 2]]), '#e0d4c0', { flat: true, line: '#140a06', lw: 1.5 });
    // eyes
    for (const sx of [-1, 1]) { paint(El(hx + sx * 7, hy - 4, 4.5, 5.5), '#fff8d0', { flat: true, line: '#140a06', lw: 1 }); flat(El(hx + sx * 7, hy - 3, 3.6, 1.4), '#100808'); }
    // open mouth
    paint(El(hx + 3, hy + 17, 7, 8), '#5a0c10', { flat: true, line: '#140a06', lw: 1.4 });
    curve([[hx - 2, hy + 26], [hx + 2, hy + 36], [hx + 6, hy + 30]], '#f4efe4', 3); // beard
    // "MEEH!"
    g.save(); g.translate(hx - 150, hy - 6); g.rotate(-0.12);
    letters('MEEH!', 0, 0, 24, { fill: '#fff', ol: 0.1, olc: '#111', w: 0.22, track: 0.08 });
    g.restore(); g.restore();
  }
  function wheels(st) {
    const wheel = (x, y, rx, ry) => {
      paint(El(x, y, rx, ry), '#141010', { dir: 'round', hi: 0.08, hic: '#5a4a48', line: '#000', lw: 2 });
      paint(El(x + rx * 0.08, y, rx * 0.55, ry * 0.58), '#c8201c', { dir: 'round', line: '#140a06', lw: 1.6, hi: 0.15 });
      paint(El(x + rx * 0.1, y, rx * 0.2, ry * 0.22), '#e8e8e0', { flat: true, line: '#140a06', lw: 1.2 });
      for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; flat(El(x + rx * 0.1 + Math.cos(a) * rx * 0.38, y + Math.sin(a) * ry * 0.4, 2.2, 2.2), '#f0e0b0'); }
    };
    const a = sideP(0.82, 0.93), b = sideP(0.12, 0.92);
    wheel(a[0], a[1], 36, 56);
    // flames trailing from wheels
    flame(b[0] - 70, b[1] + 50, 120, 100, -0.9);
    wheel(b[0], b[1], 58, 86);
    flame(a[0] - 30, a[1] + 40, 80, 70, -0.9);
    flushDry();
  }
  function wagonFront(st) {
    // cab front panel
    const face = Pg([[410, 452], [828, 470], [834, 1000], [408, 1008]]);
    paint(face, '#1d3fa0', { dir: Math.PI / 2, sd: 0.04, hi: 0.03, line: '#0a0a14', lw: 3 });
    // crest board with slogan
    const crest = S([[408, 548, 1], [408, 470], [440, 440], [520, 418], [620, 410], [720, 416], [800, 440], [832, 474], [832, 556, 1]], 0.8);
    paint(crest, '#f4e8c4', { dir: 0, sd: 0.06, hi: 0, line: '#140a06', lw: 3, var: 0.15 });
    g.save(); g.clip(crest.path); strokeLine([[400, 548], [840, 552]], '#d01c1c', 10, 1, 'butt'); g.restore();
    // scalloped trim
    for (let i = 0; i < 12; i++) { const x = 420 + i * 34; flat(El(x + 12, 551 + i * 0.5, 10, 7), i % 2 ? '#e8c21a' : '#1a7a34'); }
    letters("GOD'S TIME", 620, 436, 42, { align: 'center', maxW: 340, fill: '#c8141a', ol: 0.06, olc: '#140a06', w: 0.24, jit: 0.9, k0: 0.6 });
    letters('IS THE BEST', 620, 490, 40, { align: 'center', maxW: 390, fill: '#1a1a1a', w: 0.24, jit: 0.9, flick: false });
    // windscreen panes
    const L = S([[440, 568, 1], [608, 572, 1], [606, 690, 1], [442, 688, 1]]);
    const Rr = S([[628, 572, 1], [804, 576, 1], [806, 692, 1], [628, 690, 1]]);
    paint(L, '#0f1a30', { dir: 0.8, sd: 0, hi: 0, line: '#000', lw: 4, var: 0.4 });
    paint(Rr, '#0f1a30', { dir: 0.8, sd: 0, hi: 0, line: '#000', lw: 4, var: 0.4 });
    driver(st);
    g.save(); g.clip(Rr.path);
    glow(720, 640, 90, [255, 60, 30], 0.5);
    // a second dreadful passenger: the mate, screaming
    scaredHead(730, 650, 0.9, rgb('#4a2a1a'), 1);
    g.restore();
    // reflections
    for (const [x, y] of [[470, 580], [660, 584]]) { g.save(); g.globalAlpha = 0.5; strokeLine([[x, y + 70], [x + 50, y]], '#cfe0ff', 6); strokeLine([[x + 22, y + 80], [x + 66, y + 18]], '#cfe0ff', 2.5); g.restore(); }
    // centre post
    paint(Pg([[608, 566], [628, 566], [628, 696], [606, 696]]), '#1d3fa0', { flat: true, line: '#000', lw: 2 });
    // stripe band
    const band = Pg([[408, 700], [834, 706], [834, 736], [408, 732]]);
    paint(band, '#e8c21a', { dir: 0, sd: 0, line: '#140a06', lw: 2 });
    for (let i = 0; i < 14; i++) { const x = 412 + i * 30.5; flat(Pg([[x, 734], [x + 15, 704], [x + 30, 734]]), '#d01c1c'); }
  }
  function driver(st) {
    // a grinning skull in a cap, hands on the wheel
    const x = 528, y = 630;
    g.save();
    g.clip(S([[440, 568, 1], [608, 572, 1], [606, 690, 1], [442, 688, 1]]).path);
    glow(x, y, 90, [120, 255, 120], 0.35);
    const skull = S([[x - 30, y - 18], [x - 24, y - 40], [x, y - 48], [x + 26, y - 40], [x + 32, y - 16], [x + 26, y + 8], [x + 18, y + 30], [x, y + 36], [x - 18, y + 30], [x - 26, y + 8]]);
    paint(skull, '#e8e4c8', { dir: 'round', line: '#000', lw: 2, flick: 2 });
    for (const sx of [-1, 1]) { flat(El(x + sx * 12, y - 10, 9, 10), '#000'); flat(El(x + sx * 12, y - 9, 3.5, 3.5), '#ff2a1a'); glow(x + sx * 12, y - 9, 16, [255, 40, 20], 0.7); }
    flat(S([[x, y + 2], [x - 4, y + 10], [x + 4, y + 10]]), '#000');
    // teeth grin
    flat(Pg([[x - 18, y + 16], [x + 18, y + 16], [x + 15, y + 26], [x - 15, y + 26]]), '#f6f2dc');
    for (let i = -3; i <= 3; i++) strokeLine([[x + i * 5, y + 16], [x + i * 5, y + 26]], '#000', 1.2);
    strokeLine([[x - 18, y + 21], [x + 18, y + 21]], '#000', 1.2);
    // cap
    paint(S([[x - 34, y - 24], [x - 30, y - 50], [x, y - 60], [x + 30, y - 50], [x + 36, y - 26], [x + 60, y - 20], [x + 30, y - 18]]), '#c8141a', { dir: 0, line: '#000', lw: 2 });
    // steering wheel
    g.strokeStyle = '#000'; g.lineWidth = 7; g.beginPath(); g.ellipse(x + 4, y + 62, 56, 16, 0, Math.PI, TAU); g.stroke();
    g.strokeStyle = '#7a6a5a'; g.lineWidth = 2.5; g.beginPath(); g.ellipse(x + 4, y + 61, 56, 16, 0, Math.PI, TAU); g.stroke();
    for (const sx of [-1, 1]) {
      const bx = x + sx * 46, by = y + 52;
      for (let k = 0; k < 4; k++) strokeLine([[bx + k * 4 - 6, by - 8], [bx + k * 4 - 6, by + 6]], '#e8e4c8', 3);
    }
    g.restore();
  }
  function wagonFace(st) {
    const G1 = st.faceCol;
    // the green beast mass: fenders + bonnet
    const mass = S([[404, 900], [400, 820], [420, 762], [470, 738], [540, 738], [574, 748], [620, 742], [666, 748], [700, 738], [770, 740], [816, 764], [836, 820], [834, 900], [620, 912]], 0.9);
    paint(mass, G1, { dir: 'round', sd: 0.1, hi: 0.05, line: '#0a140a', lw: 3.5, flick: 6 });
    // bonnet nose ridge with grille slats
    const nose = S([[582, 756, 1], [658, 756, 1], [664, 850], [620, 862], [576, 850]], 0.8);
    paint(nose, lit(G1, 0.1), { dir: Math.PI / 2, line: '#0a140a', lw: 2.5 });
    for (let i = 0; i < 7; i++) { const x = 590 + i * 10; paint(Pg([[x, 768], [x + 5, 768], [x + 5, 838], [x, 836]]), '#c8ccd0', { flat: true, line: '#202020', lw: 0.8 }); }
    // nostrils puffing steam
    for (const sx of [-1, 1]) {
      flat(El(620 + sx * 18, 852, 9, 5, sx * 0.3), '#080808');
      for (let k = 0; k < 4; k++) {
        const pts = []; const cx = 620 + sx * (40 + k * 30), cy = 830 - k * 22, r = 12 + k * 6;
        for (let j = 0; j < 10; j++) { const a = j / 10 * TAU; pts.push([cx + Math.cos(a) * r * (1 + 0.15 * Math.sin(a * 3 + k)), cy + Math.sin(a) * r * 0.75]); }
        paint(S(pts), '#e8e4e0', { dir: 'round', line: null, sd: 0.15, hi: 0.05, alpha: 0.9 });
      }
    }
    // headlight eyes
    eye(488, 798, 54, -1, st);
    eye(752, 800, 50, 1, st);
  }
  function eye(x, y, r, side, st) {
    paint(El(x, y, r + 11, r + 9), '#c0c6cc', { dir: 'round', sd: 0.2, hi: 0.15, hic: '#ffffff', line: '#101010', lw: 2.5 });
    const ball = El(x, y, r, r * 0.92);
    g.save(); g.clip(ball.path);
    const gr = g.createRadialGradient(x - r * 0.2, y - r * 0.2, 2, x, y, r);
    gr.addColorStop(0, '#fffde0'); gr.addColorStop(0.5, '#ffe45a'); gr.addColorStop(1, '#e88a10');
    g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
    dabs(x - r, y - r, x + r, y + r, ['#fff6a0', '#ffd23a', '#f0a020'], 40, 3, 12, 0.5, 0.4);
    // veins
    for (let i = 0; i < 7; i++) { const a = rr(0, TAU); curve([[x + Math.cos(a) * r, y + Math.sin(a) * r], [x + Math.cos(a + 0.2) * r * 0.75, y + Math.sin(a + 0.2) * r * 0.75], [x + Math.cos(a - 0.1) * r * 0.55, y + Math.sin(a - 0.1) * r * 0.55]], '#c8141a', 1.6, 0.8); }
    // iris + slit, looking toward the hero (down-left)
    const ix = x - side * r * 0.08 - r * 0.18, iy = y + r * 0.12;
    paint(El(ix, iy, r * 0.5, r * 0.52), '#d81c10', { dir: 'radial', sd: 0.1, hi: 0, line: '#300404', lw: 2 });
    flat(S([[ix, iy - r * 0.48, 1], [ix + r * 0.14, iy], [ix, iy + r * 0.48, 1], [ix - r * 0.14, iy]]), '#080404');
    // angry lid
    const lid = Pg([[x - r * 1.3, y - r * 1.3], [x + r * 1.3, y - r * 1.3], [x + r * 1.3, y - r * (side < 0 ? 0.05 : 0.6)], [x - r * 1.3, y - r * (side < 0 ? 0.6 : 0.05)]]);
    paint(lid, lit(st.faceCol, -0.25), { dir: 0, sd: 0, hi: 0, line: null });
    g.restore();
    // brow
    const bx0 = x - r * 1.2, bx1 = x + r * 1.2;
    const by0 = y - r * (side < 0 ? 0.7 : 0.15), by1 = y - r * (side < 0 ? 0.15 : 0.7);
    paint(Limb([[bx0, by0 - 8, 7], [(bx0 + bx1) / 2, (by0 + by1) / 2 - 10, 11], [bx1, by1 - 8, 6]]), '#0e1a0c', { flat: true, line: null });
    strokeLine([[x - r * 0.5, y - r * 0.45], [x - r * 0.3, y - r * 0.6]], '#ffffff', 3, 0.9);
    glow(x, y, r * 2.4, [255, 220, 80], 0.35);
  }
  function wagonMouth(st) {
    const mouth = S([[418, 884, 1], [480, 868], [560, 860], [620, 864], [680, 860], [760, 866], [822, 884, 1], [818, 982, 1], [620, 992], [422, 984, 1]], 0.9);
    g.save();
    const gr = g.createLinearGradient(0, 860, 0, 990);
    gr.addColorStop(0, '#120204'); gr.addColorStop(0.6, '#6a0a0e'); gr.addColorStop(1, '#b0141a');
    g.fillStyle = gr; g.fill(mouth.path);
    g.clip(mouth.path);
    dabs(420, 860, 820, 990, ['#8a0c12', '#3a0406', '#c41c1c'], 120, 6, 30, 0, 0.3);
    glow(620, 960, 160, [255, 80, 20], 0.35);
    g.restore();
    // gums lip
    curve([[416, 886], [480, 868], [560, 860], [620, 864], [680, 860], [760, 866], [824, 886]], '#a0141c', 9);
    // upper fangs
    const up = [[436, 20, 64], [470, 16, 34], [500, 14, 40], [530, 13, 30], [560, 14, 38], [590, 13, 30], [650, 13, 30], [680, 14, 38], [710, 13, 30], [742, 14, 40], [772, 16, 34], [806, 20, 66]];
    for (const [x, w, l] of up) {
      const yb = 866 + Math.abs(x - 620) * 0.06;
      const curl = (x - 620) * -0.04;
      const fang = S([[x - w / 2, yb, 1], [x + w / 2, yb, 1], [x + w * 0.15 + curl, yb + l * 0.7], [x + curl * 1.6, yb + l, 1], [x - w * 0.3 + curl, yb + l * 0.6]], 0.9);
      paint(fang, '#f6eed6', { dir: Math.PI / 2, sd: 0.25, shc: '#a89a7a', hi: 0, line: '#140a06', lw: 1.6 });
      if (l > 50) { strokeLine([[x + curl * 1.6, yb + l], [x + curl * 1.6, yb + l + 18]], '#c8141a', 3.5); flat(El(x + curl * 1.6, yb + l + 21, 3.4, 4.4), '#c8141a'); }
    }
    // bumper as lower jaw
    const bump = S([[400, 978, 1], [840, 972, 1], [842, 1014, 1], [400, 1022, 1]]);
    paint(bump, '#b8c0c6', { dir: 0, sd: 0.25, shc: '#3a4048', hi: 0.2, hic: '#ffffff', line: '#101010', lw: 2.5 });
    // lower fangs up from the bumper
    for (const [x, w, l] of [[452, 18, 52], [520, 14, 34], [574, 13, 28], [668, 13, 28], [720, 14, 34], [790, 18, 54]]) {
      const yb = 980;
      paint(S([[x - w / 2, yb, 1], [x + w / 2, yb, 1], [x + w * 0.2, yb - l * 0.6], [x + (x - 620) * 0.03, yb - l, 1], [x - w * 0.3, yb - l * 0.5]], 0.9), '#f0e6c8', { dir: -Math.PI / 2, sd: 0.25, shc: '#a89a7a', hi: 0, line: '#140a06', lw: 1.6 });
    }
    // plate
    paint(Pg([[578, 988], [664, 987], [664, 1010], [578, 1011]]), '#f4f0e0', { flat: true, line: '#101010', lw: 1.6 });
    letters('AS 666 X', 621, 992, 15, { align: 'center', fill: '#111', w: 0.2, maxW: 80, flick: false, paint: false });
  }
  function snake(st) {
    // the wagon's tongue is a snake
    const cs = [[620, 960, 14], [612, 1010, 17], [586, 1062, 19], [540, 1092, 19], [490, 1098, 18], [452, 1080, 16], [430, 1046, 14], [424, 1012, 12]];
    const body = Limb(cs);
    paint(body, '#2a9a2a', { dir: 'round', sd: 0.2, hi: 0.1, line: '#061a06', lw: 2.4 });
    g.save(); g.clip(body.path);
    for (let i = 1; i < cs.length - 1; i++) {
      const a = cs[i], b = cs[i + 1];
      for (let k = 0; k < 2; k++) {
        const t = k * 0.5, px = lerp(a[0], b[0], t), py = lerp(a[1], b[1], t);
        const ang = Math.atan2(b[1] - a[1], b[0] - a[0]) + Math.PI / 2;
        strokeLine([[px - Math.cos(ang) * 30, py - Math.sin(ang) * 30], [px + Math.cos(ang) * 30, py + Math.sin(ang) * 30]], '#f0d020', 6, 0.95, 'butt');
        strokeLine([[px - Math.cos(ang) * 30 + 7, py - Math.sin(ang) * 30], [px + Math.cos(ang) * 30 + 7, py + Math.sin(ang) * 30]], '#0a2a0a', 2, 0.7, 'butt');
      }
    }
    g.restore();
    // head, jaws open toward the hero
    const hx = 418, hy = 1000;
    const upper = S([[hx + 14, hy + 10], [hx + 10, hy - 14], [hx - 16, hy - 24], [hx - 52, hy - 24], [hx - 60, hy - 16, 1], [hx - 24, hy - 6], [hx, hy + 6]], 0.9);
    const lower = S([[hx + 10, hy + 12], [hx - 20, hy + 6], [hx - 50, hy + 22, 1], [hx - 20, hy + 26], [hx + 8, hy + 22]], 0.9);
    paint(S([[hx + 6, hy - 4], [hx - 54, hy - 18], [hx - 48, hy + 20], [hx + 6, hy + 16]]), '#c8141a', { flat: true, line: null });
    paint(lower, '#2a9a2a', { dir: 3, line: '#061a06', lw: 2 });
    paint(upper, '#34aa30', { dir: 3, line: '#061a06', lw: 2.2, flick: 2 });
    flat(El(hx - 18, hy - 14, 5, 4), '#ffe23a'); flat(El(hx - 18, hy - 14, 1.4, 3.6), '#000');
    for (const [x, y, d] of [[hx - 52, hy - 16, 1], [hx - 40, hy - 12, 1], [hx - 46, hy + 18, -1]]) flat(S([[x - 3, y], [x + 3, y], [x, y + d * 14, 1]]), '#fff');
    curve([[hx - 40, hy + 2], [hx - 70, hy + 4], [hx - 88, hy - 4]], '#d01020', 3);
    strokeLine([[hx - 88, hy - 4], [hx - 98, hy - 12]], '#d01020', 2.4); strokeLine([[hx - 88, hy - 4], [hx - 99, hy + 2]], '#d01020', 2.4);
  }
  // a small running figure; dir = 1 runs right, -1 runs left; arms flung up in panic
  function runner(x, y, s, dir, shirt, v) {
    const sk = pick(['#3a2216', '#4a2a1a', '#5a3220']), pants = pick(['#1a1a2a', '#3a2a1a', '#2a3a6a', '#f2f0e8']);
    const P = (u, w) => [x + u * s * dir, y + w * s];
    const L = (pts, wd) => Limb(pts.map((q, i) => [q[0], q[1], wd[i] * s]));
    // far leg (kicked back), near leg (striding forward)
    paint(L([P(-2, 0), P(-12, 14), P(-24, 22)], [4, 3.4, 2.8]), lit(pants, -0.2), { flat: true, line: '#000', lw: 1 });
    paint(L([P(3, 0), P(12, 12), P(10, 28)], [4.2, 3.6, 3]), pants, { flat: true, line: '#000', lw: 1 });
    flat(El(P(-26, 23)[0], P(-26, 23)[1], 4 * s, 2 * s), '#111'); flat(El(P(12, 29)[0], P(12, 29)[1], 4.4 * s, 2 * s), '#111');
    if (v === 1) { // woman with a wrapper
      paint(S([P(-8, -2), P(8, -2), P(12, 22), P(-12, 22)]), pick(['#d01c1c', '#1a7a34', '#2a62c0']), { flat: true, line: '#000', lw: 1 });
    }
    const torso = S([P(-7, -26), P(7, -26), P(8, -12), P(6, 2), P(-6, 2), P(-8, -12)]);
    paint(torso, shirt, { dir: Math.PI / 2, sd: 0.1, hi: 0.1, line: '#000', lw: 1.1, bw: 2, len: 6 });
    paint(L([P(-6, -24), P(-14, -36), P(-12, -50)], [2.6, 2.3, 2]), sk, { hic: '#b8743c', hia: 0.62, flat: true, line: '#000', lw: 1 });
    paint(L([P(6, -24), P(16, -34), P(22, -48)], [2.6, 2.3, 2]), sk, { hic: '#b8743c', hia: 0.62, flat: true, line: '#000', lw: 1 });
    for (const q of [P(-12, -52), P(22, -50)]) flat(El(q[0], q[1], 2.8 * s, 3 * s), sk);
    const hc = P(1, -34);
    paint(El(hc[0], hc[1], 6.4 * s, 7.2 * s), sk, { hic: '#b8743c', hia: 0.62, flat: true, line: '#000', lw: 1 });
    if (v === 1) { // basin on her head, tomatoes leaping out
      paint(S([P(-12, -42), P(12, -42), P(9, -36), P(-9, -36)]), '#b8c0c8', { flat: true, line: '#111', lw: 1 });
      for (let i = 0; i < 4; i++) { const q = P(rr(-10, 14), rr(-58, -44)); paint(El(q[0], q[1], 2.6 * s, 2.4 * s), '#e0261a', { flat: true, line: '#300', lw: 0.6 }); }
    } else if (v === 2) flat(El(hc[0], hc[1] - 5 * s, 6.6 * s, 3.4 * s), '#111');
    // looking back over the shoulder in terror
    const e = P(-2.5, -35);
    flat(El(e[0] - 1.6 * s, e[1], 1.6 * s, 2 * s), '#fff'); flat(El(e[0] + 1.6 * s, e[1], 1.6 * s, 2 * s), '#fff');
    flat(El(e[0] - 1.6 * s - dir * 0.6 * s, e[1], 0.6 * s, 0.8 * s), '#000'); flat(El(e[0] + 1.6 * s - dir * 0.6 * s, e[1], 0.6 * s, 0.8 * s), '#000');
    flat(El(P(-1, -29)[0], P(-1, -29)[1], 1.6 * s, 2.2 * s), '#400');
  }
  function tinyFolk(st) {
    // tomatoes and a dropped basin
    const bx = 632, by = 1316;
    paint(S([[bx - 34, by - 8], [bx + 30, by - 18], [bx + 36, by - 4], [bx - 26, by + 10]]), '#a8b0b8', { dir: 0, line: '#111', lw: 1.6, hi: 0.2, hic: '#fff' });
    for (let i = 0; i < 16; i++) { const x = bx + rr(-90, 70), y = by + rr(-18, 16) - (x < bx - 40 ? 0 : 0); paint(El(x, y, rr(5, 7), rr(4.5, 6)), pick(['#e0261a', '#c81a12', '#f04020']), { dir: 'round', sd: 0.2, hi: 0.2, line: '#2a0404', lw: 1, flick: 1 }); }
    // blood on the road
    for (let i = 0; i < 8; i++) flat(El(rr(420, 560), rr(1150, 1220), rr(2, 7), rr(1.5, 4), rr(-0.3, 0.3)), '#8a0a0a', 0.8);
    // townsfolk fleeing, smaller where further away
    const folk = [[548, 1188, 1.15, 1, '#e0b21c', 0], [690, 1176, 1.0, 1, '#d0508a', 1], [612, 1236, 1.4, -1, '#2a62c0', 2], [470, 1262, 1.55, -1, '#f2f0e8', 0], [742, 1270, 1.6, 1, '#1a8a40', 1]];
    for (const [x, y, s, d, col, v] of folk) runner(x, y, s, d, col, v);
    // a dog that wants no part of this
    const dx = 520, dy = 1312;
    paint(S([[dx - 22, dy - 14], [dx + 14, dy - 16], [dx + 22, dy - 24], [dx + 32, dy - 20], [dx + 28, dy - 10], [dx + 14, dy - 4], [dx - 20, dy - 4]]), '#c89a5a', { dir: 0, line: '#1a1008', lw: 1.4 });
    for (const [a, b] of [[-18, -26], [-8, 2], [8, -10], [16, 22]]) strokeLine([[dx + a, dy - 6], [dx + b, dy + 6]], '#a07a40', 3.5);
    strokeLine([[dx - 22, dy - 12], [dx - 34, dy - 22]], '#c89a5a', 3);
    flat(El(dx + 27, dy - 19, 1.4, 1.4), '#000');
  }
  function bubble(st) {
    // the woman has something to say
    const cx = 916, cy = 740, pts = [];
    const n = 26;
    for (let i = 0; i < n; i++) { const a = i / n * TAU; const r = 1 + (i % 2 ? 0.0 : 0.09) + rr(-0.03, 0.03); pts.push([cx + Math.cos(a) * 80 * r, cy + Math.sin(a) * 62 * r]); }
    const tail = [[cx - 46, cy + 36], [856, 872, 1], [cx - 4, cy + 56]];
    const sh = S(pts, 1);
    g.save(); g.translate(5, 6); flat(sh, '#140808'); flat(S(tail, 0.5), '#140808'); g.restore();
    paint(S(tail, 0.5), '#fffbea', { flat: true, line: '#140808', lw: 3 });
    paint(sh, '#fffbea', { dir: 0.2, sd: 0.08, shc: '#c8c0a8', hi: 0, line: '#140808', lw: 3, var: 0.12 });
    letters('EAT MY', cx, cy - 46, 26, { align: 'center', fill: '#140808', w: 0.24, flick: false, jit: 1.3 });
    letters('SOUP,', cx, cy - 15, 28, { align: 'center', fill: '#c8141a', w: 0.24, flick: false, jit: 1.3 });
    letters('DEVIL!!', cx, cy + 18, 28, { align: 'center', fill: '#140808', w: 0.26, flick: false, jit: 1.3, maxW: 140 });
  }
  /* --------------------------------------------------------------- the hero */
  const SKIN_H = '#4a2a1a';
  const RIM = [255, 140, 50];
  function hero(st) {
    const sk = rgb(SKIN_H), jeans = '#2a4fa8', JL = '#0a0a1a';
    // back leg, straight and braced
    const back = Limb([[150, 1126, 34], [132, 1170, 30], [116, 1210, 22], [100, 1242, 23], [84, 1276, 19], [70, 1306, 15]]);
    paint(back, lit(jeans, -0.12), { dir: 2.0, line: JL, lw: 2.6, rim: RIM, rima: 0.45, flick: 4, mixc: ['#4a7ad0', '#1a2a60'] });
    // front leg, bent into the lunge
    const front = Limb([[222, 1120, 37], [250, 1154, 31], [276, 1190, 23], [284, 1230, 24], [287, 1270, 19], [290, 1302, 15]]);
    paint(front, jeans, { dir: 1.25, line: JL, lw: 2.6, rim: RIM, rima: 0.5, flick: 6, mixc: ['#5a8ae0', '#1a2a60'] });
    // denim folds
    curve([[256, 1176], [270, 1186], [282, 1184]], '#0e1a48', 3, 0.8); curve([[258, 1168], [272, 1176]], '#9ab8f0', 1.6, 0.8);
    curve([[272, 1236], [290, 1240]], '#0e1a48', 2.5, 0.7); curve([[268, 1262], [288, 1264]], '#0e1a48', 2.5, 0.6);
    curve([[108, 1214], [126, 1222]], '#0e1a48', 3, 0.8); curve([[96, 1252], [112, 1256]], '#0e1a48', 2.4, 0.6); curve([[132, 1160], [150, 1150]], '#9ab8f0', 1.6, 0.7);
    // boots
    paint(S([[48, 1294], [92, 1292], [98, 1316], [100, 1338, 1], [22, 1340, 1], [24, 1322], [40, 1312]]), '#161010', { dir: 0, line: '#000', lw: 2, hi: 0.18, flick: 2 });
    paint(S([[268, 1288], [306, 1288], [312, 1308], [346, 1320], [350, 1340, 1], [264, 1340, 1]]), '#161010', { dir: 0, line: '#000', lw: 2, hi: 0.18, flick: 2 });
    // hips & belt
    paint(S([[134, 1088], [236, 1084], [242, 1132], [128, 1138]]), jeans, { dir: 0, line: JL, lw: 2.6 });
    paint(Pg([[132, 1088], [238, 1084], [238, 1100], [132, 1104]]), '#2a1a10', { flat: true, line: '#000', lw: 1.5 });
    paint(Pg([[178, 1085], [198, 1085], [198, 1101], [178, 1101]]), '#e8c860', { flat: true, line: '#000', lw: 1 });
    // torso
    const torso = S([[116, 984], [150, 966], [184, 962], [226, 964], [262, 978], [260, 1012], [250, 1046], [240, 1094], [134, 1098], [124, 1046], [116, 1012]]);
    paint(torso, sk, { hic: '#b8743c', hia: 0.62, dir: 'round', line: '#0a0604', lw: 2.6, rim: RIM, rima: 0.55, mixc: ['#7a3a20', '#2a1008'] });
    // deltoids
    paint(El(252, 992, 24, 22, -0.3), sk, { hic: '#b8743c', hia: 0.62, dir: 'round', line: '#0a0604', lw: 2.2, rim: RIM, rima: 0.5, flick: 3 });
    paint(El(124, 998, 20, 22, 0.3), lit(sk, -0.1), { dir: 'round', line: '#0a0604', lw: 2.2, flick: 2 });
    // torn vest
    const vest = S([[132, 1006], [140, 970, 1], [156, 968, 1], [172, 1010], [196, 1018], [208, 1004], [218, 968, 1], [234, 970, 1], [252, 1008], [248, 1046], [236, 1062, 1], [228, 1052], [222, 1068, 1], [236, 1096], [138, 1100], [130, 1050]], 0.85);
    paint(vest, '#f4f2ea', { dir: 'round', sd: 0.12, shc: '#7a86a8', hic: '#ffffff', line: '#1a1a24', lw: 2.2, flick: 6, rim: [255, 170, 110], rima: 0.4 });
    g.save(); g.clip(vest.path);
    for (let i = 0; i < 20; i++) curve([[134 + i * 6.5, 1010], [136 + i * 6.2 + rr(-2, 2), 1060], [136 + i * 5.8, 1100]], '#b8bed0', 1, 0.45);
    curve([[150, 1036], [180, 1052], [212, 1044]], '#8a94b0', 3, 0.6);
    flat(S([[206, 1070], [220, 1064], [228, 1080], [214, 1090], [202, 1082]]), '#b0141a', 0.85);
    for (let i = 0; i < 5; i++) flat(El(rr(200, 230), rr(1086, 1100), 1.8, 3), '#b0141a', 0.8);
    g.restore();
    // chest muscle showing through the scoop and the rip
    curve([[176, 1004], [194, 1016], [212, 1006]], '#1e0e06', 2.4, 0.9);
    curve([[180, 999], [192, 1006]], lit(sk, 0.5), 2, 0.8);
    curve([[232, 1054], [238, 1058]], '#1e0e06', 2, 0.8);
    // neck with tendons
    paint(Limb([[190, 948, 17], [192, 982, 20]]), sk, { hic: '#b8743c', hia: 0.62, dir: Math.PI / 2, line: '#0a0604', lw: 2.2, rim: RIM, rima: 0.4 });
    curve([[198, 952], [206, 978]], '#2a140a', 1.6, 0.8);
  }
  function heroHead(st) {
    const sk = rgb(SKIN_H);
    g.save(); g.translate(200, 960); g.scale(1.16, 1.16); g.translate(-200, -960);
    // headband tails flying back
    paint(Limb([[166, 878, 8], [136, 870, 7], [108, 878, 6], [82, 866, 4]]), '#d8141a', { dir: 0, line: '#200', lw: 1.6, hi: 0.2 });
    paint(Limb([[166, 886, 7], [134, 898, 6], [104, 916, 5], [88, 912, 3]]), '#b0101a', { dir: 0, line: '#200', lw: 1.6 });
    const head = S([[162, 902], [162, 874], [178, 856], [204, 852], [224, 864], [230, 884], [234, 896], [236, 904], [246, 918, 1], [238, 924], [240, 932], [236, 944], [230, 954], [214, 962], [196, 960], [180, 950], [170, 932]], 0.9);
    paint(head, sk, { hic: '#b8743c', hia: 0.62, dir: 'round', sd: 0.14, line: '#0a0604', lw: 2.6, rim: RIM, rima: 0.55, flick: 5, mixc: ['#7a3a20', '#2a1008'] });
    // cheekbone + forehead lights
    curve([[212, 922], [222, 916]], lit(sk, 0.45), 3, 0.7);
    curve([[200, 872], [214, 870]], lit(sk, 0.45), 2.5, 0.6);
    // ear
    paint(S([[176, 904], [186, 900], [190, 918], [182, 924], [176, 918]]), lit(sk, -0.12), { flat: true, line: '#0a0604', lw: 1.6 });
    curve([[181, 906], [184, 916]], '#1a0a04', 1.4, 0.8);
    // flat-top hair
    paint(S([[160, 884, 1], [160, 858], [170, 844], [196, 838], [220, 842], [230, 856, 1], [230, 872, 1], [196, 870], [164, 884, 1]], 0.8), '#0e0a0a', { dir: 0, sd: 0, hi: 0.12, hic: '#4a4a5a', line: null });
    // headband
    paint(S([[160, 878], [230, 868, 1], [232, 884, 1], [162, 894]], 0.6), '#e8141a', { dir: 0, line: '#200', lw: 1.6, hi: 0.25 });
    // furious brow + eye
    paint(S([[204, 896], [222, 896], [238, 902, 1], [236, 908], [218, 904], [204, 904]], 0.7), '#0a0606', { flat: true, line: null });
    paint(S([[212, 910], [222, 905], [232, 908], [228, 914], [218, 916]], 0.8), '#fff8ea', { flat: true, line: '#0a0604', lw: 1.3 });
    flat(El(226, 910, 3.4, 3.8), '#120a08'); flat(El(227, 908.6, 1.1, 1.1), '#fff');
    // nose
    curve([[234, 906], [244, 918], [236, 924]], '#1a0c08', 2.2);
    flat(El(236, 922, 3, 2), '#1a0804');
    // shouting mouth with teeth
    const m = S([[216, 934], [238, 930], [242, 940], [232, 952], [218, 948]]);
    paint(m, '#4a0a0c', { flat: true, line: '#0a0604', lw: 1.8 });
    g.save(); g.clip(m.path); flat(Pg([[212, 929], [246, 926], [246, 936], [212, 938]]), '#fbf6ea'); flat(Pg([[214, 948], [244, 944], [244, 956], [214, 956]]), '#e8e2d0'); flat(El(228, 946, 6, 3), '#c02a2a'); g.restore();
    curve([[214, 958], [230, 960]], lit(sk, 0.35), 2, 0.6);
    // sweat
    for (const [x, y, a] of [[170, 940, 2.6], [242, 880, -0.6], [158, 868, -2.4]]) paint(S(T([[0, -7, 1], [3.5, 0], [0, 4], [-3.5, 0]], x, y, 1.3, a + Math.PI / 2)), '#d8f0ff', { flat: true, line: '#0a2a5a', lw: 0.9 });
    g.restore();
  }
  function heroArms(st) {
    const sk = rgb(SKIN_H);
    // back arm raised with the Bible
    paint(Limb([[126, 994, 22], [104, 975, 22], [86, 958, 18], [76, 940, 15], [74, 915, 16], [76, 895, 13], [80, 878, 11]]), sk, { hic: '#b8743c', hia: 0.62, dir: -1.7, line: '#0a0604', lw: 2.6, rim: RIM, rima: 0.45, flick: 4, mixc: ['#7a3a20'] });
    curve([[110, 968], [96, 956]], lit(sk, 0.5), 3, 0.7);
    // Bible
    g.save(); g.translate(80, 836); g.rotate(-0.16);
    for (let i = 0; i < 14; i++) { const a = -Math.PI / 2 + (i - 6.5) * 0.24; strokeLine([[Math.cos(a) * 50, Math.sin(a) * 50], [Math.cos(a) * rr(90, 140), Math.sin(a) * rr(90, 140)]], '#fff2a0', rr(2.5, 5), 0.9); }
    glow(0, 0, 100, [255, 240, 160], 0.5);
    paint(Pg([[-32, -44], [32, -44], [32, 42], [-32, 42]]), '#1a1414', { dir: Math.PI / 2, hi: 0.2, line: '#000', lw: 2 });
    paint(Pg([[32, -42], [38, -38], [38, 44], [32, 42]]), '#f0e8d0', { flat: true, line: '#000', lw: 1 });
    paint(Pg([[-4, -32], [4, -32], [4, 22], [-4, 22]]), '#f0c020', { flat: true, line: null });
    paint(Pg([[-17, -17], [17, -17], [17, -9], [-17, -9]]), '#f0c020', { flat: true, line: null });
    letters('HOLY BIBLE', 0, 27, 7.5, { align: 'center', fill: '#f0c020', w: 0.18, maxW: 56, flick: false, paint: false });
    g.restore();
    for (let i = 0; i < 4; i++) paint(Limb([[82 + i * 4, 880 - i * 1.5, 5.5], [70 + i * 4, 870 - i * 6, 5]]), sk, { hic: '#b8743c', hia: 0.62, flat: true, line: '#0a0604', lw: 1.4 });
    // gun arm
    paint(Limb([[250, 988, 24], [276, 976, 24], [298, 966, 19], [316, 958, 15], [334, 950, 17], [352, 941, 14], [366, 934, 11]]), sk, { hic: '#b8743c', hia: 0.62, dir: -0.4, line: '#0a0604', lw: 2.6, rim: RIM, rima: 0.55, flick: 6, mixc: ['#7a3a20'] });
    curve([[258, 972], [278, 964], [296, 962]], lit(sk, 0.5), 3.2, 0.75);
    curve([[332, 946], [348, 938]], lit(sk, 0.45), 2.4, 0.7);
    curve([[296, 978], [312, 970]], '#1a0a04', 2, 0.6);
    // pistol
    const ga = -0.27;
    g.save(); g.translate(378, 926); g.rotate(ga);
    paint(Pg([[-12, -14], [66, -14], [66, 2], [10, 2], [6, 24], [-14, 24], [-10, 2]]), '#16161a', { dir: 0, hi: 0.25, hic: '#9aa4b8', line: '#000', lw: 2 });
    strokeLine([[-6, -10], [60, -10]], '#c0c8d8', 2, 0.9);
    g.restore();
    paint(S([[360, 918], [380, 912], [392, 924], [386, 940], [364, 942], [356, 930]]), sk, { hic: '#b8743c', hia: 0.62, dir: 0, line: '#0a0604', lw: 2.2, flick: 2 });
    for (let i = 0; i < 3; i++) curve([[364 + i * 7, 926], [366 + i * 7, 936]], '#1a0c08', 1.5);
    // muzzle flash
    const mx = 378 + Math.cos(ga) * 74, my = 926 + Math.sin(ga) * 74 - 6;
    glow(mx, my, 80, [255, 220, 120], 0.8);
    const fl = [];
    for (let i = 0; i < 18; i++) { const a = i / 18 * TAU + ga; const fw = Math.cos(a - ga); const r = i % 2 ? rr(9, 15) : rr(24, 40) * (fw > 0.8 ? 1.9 : 1); fl.push([mx + Math.cos(a) * r, my + Math.sin(a) * r, 1]); }
    paint(S(fl), '#ffd21a', { flat: true, line: '#c8301a', lw: 3 });
    paint(El(mx, my, 11, 8, ga), '#fffbe0', { flat: true, line: null });
    for (let i = 0; i < 3; i++) { const d0 = 60 + i * 30, d1 = d0 + 50; strokeLine([[mx + Math.cos(ga) * d0, my + Math.sin(ga) * d0 + (i - 1) * 8], [mx + Math.cos(ga) * d1, my + Math.sin(ga) * d1 + (i - 1) * 8]], '#fff6c0', 2.6, 0.85); }
  }
  /* ------------------------------------------------------------- the woman */
  const SKIN_W = '#5a321e';
  let KENTE = null;
  function kenteTile() { // one woven repeat, painted on a little canvas
    const B = 26, nx = 8, ny = 10, c = mkCanvas(B * nx * K, B * 0.9 * ny * K), x = c.getContext('2d', SW);
    x.setTransform(K, 0, 0, K, 0, 0);
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const X = i * B, Y = j * B * 0.9, odd = (i + j) & 1;
      x.fillStyle = odd ? '#f2c414' : '#1a7a34'; x.fillRect(X, Y, B + 0.6, B * 0.9 + 0.6);
      if (odd) { for (let k = 0; k < 4; k++) { x.fillStyle = k % 2 ? '#c8141a' : '#120c0a'; x.fillRect(X, Y + B * 0.12 + k * B * 0.2, B, B * 0.07); } }
      else {
        for (let k = 0; k < 3; k++) { x.fillStyle = k === 1 ? '#f2c414' : '#c8141a'; x.fillRect(X + B * 0.18 + k * B * 0.28, Y, B * 0.08, B * 0.9); }
        x.fillStyle = '#120c0a'; x.fillRect(X, Y + B * 0.4, B, B * 0.1);
        if ((i * 3 + j) % 4 === 0) { x.fillStyle = '#2a62c0'; x.fillRect(X + B * 0.3, Y + B * 0.2, B * 0.4, B * 0.5); x.fillStyle = '#f2c414'; x.fillRect(X + B * 0.42, Y + B * 0.3, B * 0.16, B * 0.3); }
      }
    }
    return c;
  }
  // kente laid onto a shape in vertical slices so the weave bunches into pleats
  function kente(sh, x0, y0, s, rot, pleat) {
    if (!KENTE) KENTE = kenteTile();
    const [bx0, by0, bx1, by1] = sh.bb;
    g.save(); g.clip(sh.path);
    g.translate(x0, y0); g.rotate(rot || 0); g.scale(s, s);
    const tw = KENTE.width / K, th = KENTE.height / K;
    const w = (bx1 - bx0) / s + 60, h = (by1 - by0) / s + 80;
    let sx = 0;
    for (let x = -30; x < w; x += 5) {
      const d = 1 + (pleat || 0.5) * Math.sin(x * 0.11 + x0);
      const yo = Math.sin(x * 0.05) * 6;
      for (let y = -40 + yo; y < h; y += th) {
        const srcx = ((sx % tw) + tw) % tw;
        const cw = Math.min(5 * d, tw - srcx);
        g.drawImage(KENTE, srcx * K, 0, cw * K, KENTE.height, x, y, 5.4, th);
      }
      sx += 5 * d;
    }
    g.restore();
    // pleat shading follows the same rhythm
    g.save(); g.clip(sh.path); g.translate(x0, y0); g.rotate(rot || 0); g.scale(s, s);
    for (let x = -30; x < w; x += 5) {
      const v = Math.cos(x * 0.11 + x0);
      if (Math.abs(v) < 0.4) continue;
      g.fillStyle = v > 0 ? 'rgba(255,240,190,' + (0.12 * v) + ')' : 'rgba(30,8,0,' + (-0.3 * v) + ')';
      g.fillRect(x, -40, 5.4, h + 40);
    }
    g.restore();
  }
  function woman(st) {
    const sk = rgb(SKIN_W), rim = [255, 150, 60];
    // back arm swung behind, open hand
    paint(Limb([[904, 994, 15], [924, 1024, 13], [940, 1050, 11], [954, 1070, 12], [970, 1084, 10]]), sk, { hic: '#b8743c', hia: 0.62, dir: 1, line: '#0a0604', lw: 2.4, rim, rima: 0.45, flick: 3 });
    hand(980, 1090, 1.1, 0.7, sk, 1);
    // skirt (kente wrapper) flaring back with the throw
    const skirt = S([[832, 1074], [910, 1070], [930, 1140], [962, 1210], [998, 1268], [990, 1304, 1], [972, 1338, 1], [796, 1340, 1], [806, 1250], [820, 1160]], 0.9);
    flat(skirt, '#f2c414');
    kente(skirt, 790, 1060, 1, -0.05, 0.7);
    g.save(); g.clip(skirt.path);
    crescent(skirt, -16, -6, [40, 10, 0], 0.4, 6);
    crescent(skirt, 10, 0, [255, 170, 80], 0.25, 4);
    g.restore();
    outline(skirt, '#0a0604', 2.8);
    // feet
    paint(S([[808, 1326], [840, 1322], [846, 1340, 1], [796, 1342, 1]]), sk, { hic: '#b8743c', hia: 0.62, flat: true, line: '#0a0604', lw: 1.6 });
    // blouse (kaba): fitted, with a peplum flare
    const top = S([[836, 980], [868, 966], [902, 972], [918, 1010], [912, 1060], [930, 1092], [880, 1100], [822, 1096], [828, 1056], [822, 1020]], 0.9);
    flat(top, '#f2c414'); kente(top, 820, 960, 0.8, 0.12, 0.3);
    g.save(); g.clip(top.path); crescent(top, -12, -10, [40, 10, 0], 0.45, 5); g.restore();
    outline(top, '#0a0604', 2.6);
    curve([[828, 1060], [870, 1066], [912, 1062]], '#2a0a00', 2.4, 0.7); // waist seam
    curve([[836, 1018], [846, 1004], [862, 1010]], '#2a0a00', 2, 0.6);   // bust
    // neck
    paint(Limb([[858, 940, 12], [864, 976, 13]]), sk, { hic: '#b8743c', hia: 0.62, dir: Math.PI / 2, line: '#0a0604', lw: 2 });
    // throwing arm, reaching forward with the pot
    paint(Limb([[846, 992, 16], [822, 974, 14], [800, 958, 11], [784, 946, 12], [766, 934, 10]]), sk, { hic: '#b8743c', hia: 0.62, dir: -2.6, line: '#0a0604', lw: 2.4, rim, rima: 0.5, flick: 4 });
    curve([[830, 976], [812, 964]], lit(sk, 0.45), 2.4, 0.7);
    const sleeve = S([[824, 962], [856, 966], [866, 998], [842, 1014], [818, 998]]);
    flat(sleeve, '#f2c414'); kente(sleeve, 810, 950, 0.6, 0.6, 0.2); outline(sleeve, '#0a0604', 2.2);
    // head, three-quarter to the left, furious
    g.save(); g.translate(856, 912); g.scale(1.14, 1.14); g.translate(-856, -912);
    const head = S([[862, 874], [884, 880], [893, 902], [890, 928], [876, 950], [858, 956], [846, 948], [840, 936], [832, 930, 1], [837, 920], [834, 906], [842, 888]], 0.9);
    paint(head, sk, { hic: '#b8743c', hia: 0.62, dir: 'round', line: '#0a0604', lw: 2.2, rim, rima: 0.55, flick: 4, mixc: ['#8a4a28'] });
    curve([[848, 918], [856, 914]], lit(sk, 0.5), 2.2, 0.7);
    // headwrap: tall knotted, with a fan of cloth
    const wrap = S([[834, 900, 1], [836, 876], [850, 852], [878, 838], [902, 842], [908, 816], [930, 806], [940, 826], [924, 850], [908, 876], [894, 902, 1], [866, 888]], 0.9);
    paint(wrap, '#d8141a', { dir: 'round', line: '#0a0604', lw: 2.2, flick: 4 });
    g.save(); g.clip(wrap.path); for (let i = 0; i < 7; i++) curve([[836 + i * 6, 900], [852 + i * 9, 864], [884 + i * 7, 838], [906 + i * 4, 812]], '#f2c414', 3.2, 0.9); g.restore();
    // eye, brow, nose, open mouth, earring
    paint(S([[838, 906], [846, 902], [854, 905], [850, 910], [842, 911]], 0.8), '#fff8ea', { flat: true, line: '#0a0604', lw: 1.1 });
    flat(El(842.5, 906.5, 2.6, 3), '#120a08'); flat(El(842, 905.5, 0.8, 0.8), '#fff');
    strokeLine([[834, 898], [846, 897], [858, 902]], '#0a0606', 3);
    curve([[836, 912], [829, 922], [835, 925]], '#1a0c08', 1.8);
    const m = S([[834, 932], [848, 930], [850, 942], [838, 946]]);
    paint(m, '#4a0a0c', { flat: true, line: '#5a1a14', lw: 2 });
    g.save(); g.clip(m.path); flat(Pg([[832, 929], [852, 928], [852, 934], [832, 935]]), '#fbf6ea'); g.restore();
    g.save(); g.strokeStyle = '#f0c020'; g.lineWidth = 2.6; g.beginPath(); g.arc(872, 932, 7, 0, TAU); g.stroke(); g.restore();
    g.restore();
  }
  function pot(st) {
    // aluminium pot swinging out of her hand, palm-nut soup leaping from it toward the beast
    g.save(); g.translate(728, 936); g.rotate(-0.95);
    const body = S([[-38, -24, 1], [38, -24, 1], [34, 20], [0, 28], [-34, 20]], 0.8);
    paint(body, '#b8c0c8', { dir: Math.PI / 2, sd: 0.25, shc: '#4a5058', hi: 0.15, hic: '#ffffff', line: '#101418', lw: 2.4, flick: 5 });
    paint(El(0, -24, 39, 8), '#5a6068', { flat: true, line: '#101418', lw: 2 });
    paint(El(0, -24, 32, 5.5), '#d8401a', { flat: true, line: null });
    for (const sx of [-1, 1]) { g.strokeStyle = '#101418'; g.lineWidth = 4; g.beginPath(); g.ellipse(sx * 44, -12, 7, 5, 0, 0, TAU); g.stroke(); }
    g.restore();
    hand(760, 930, 1.05, -2.2, rgb(SKIN_W), 1);
    // the splash: a fat tongue of soup breaking into gobbets
    const sp = S([[712, 912], [700, 890], [680, 874], [652, 864], [618, 852, 1], [646, 874], [626, 880, 1], [656, 888], [640, 904, 1], [668, 902], [688, 918]], 0.9);
    paint(sp, '#d8401a', { dir: 2.8, line: '#5a0a04', lw: 1.8, hi: 0.2, hic: '#ffa040', flick: 5, sd: 0.1 });
    curve([[700, 900], [670, 880], [640, 870]], '#ffb060', 2, 0.8);
    for (let i = 0; i < 14; i++) { const t = R(); const x = lerp(700, 560, t) + rr(-12, 12), y = lerp(900, 860, t) + rr(-30, 24); const r = rr(2, 6) * (1 - t * 0.5); paint(El(x, y, r, r * rr(0.8, 1.3), rr(0, 3)), '#d8401a', { flat: true, line: '#5a0a04', lw: 0.8 }); }
    // a whole smoked fish riding the wave
    g.save(); g.translate(640, 846); g.rotate(-0.35);
    paint(S([[-26, 0], [-8, -10], [12, -8], [22, 0], [12, 8], [-8, 9]]), '#9a7a50', { dir: 0, line: '#1a1a1a', lw: 1.5, flick: 2 });
    paint(S([[20, 0], [33, -10, 1], [30, 0], [33, 10, 1]]), '#7a5a38', { flat: true, line: '#1a1a1a', lw: 1.2 });
    flat(El(-16, -2, 2.6, 2.6), '#fff'); flat(El(-16, -2, 1.2, 1.2), '#000');
    curve([[-8, -6], [-2, 0], [-8, 6]], '#3a2a18', 1.2);
    g.restore();
    // a ball of fufu, for good measure
    paint(El(600, 900, 12, 10), '#f4ecd4', { dir: 'round', sd: 0.2, shc: '#b8a888', line: '#3a3020', lw: 1.4, flick: 2 });
    for (let i = 0; i < 4; i++) strokeLine([[720 + i * 5, 968 + i * 10], [748 + i * 5, 990 + i * 10]], '#fff', 2, 0.7);
  }

  /* ------------------------------------------------------------------ words */
  function titleBlock(st) {
    // ACTION! HORROR! LOVE!
    let x = 40;
    const words = [['ACTION!', '#ffe23a'], ['HORROR!', '#ff4a3a'], ['LOVE!', '#ff8ad0']];
    for (const [w, c] of words) {
      const r = letters(w, x, 36, 44, { fill: c, ol: 0.07, olc: '#140808', shadow: [0.08, 0.1], w: 0.24, jit: 1.2 });
      x = r.x1 + rr(26, 40);
    }
    const tcol = { fill: '#e2201a', grad: ['#ff5a2a', '#e8231a', '#c0120e', '#8a0808'], ol: 0.075, olc: '#ffd51c', ol2: 0.035, ol2c: '#140606', ext: [0.7, 1, 0.12], extc: '#2a0606', w: 0.25, drip: 0.45, jit: 1.1 };
    letters('MAMMY WAGON', 30, 96, 128, Object.assign({ maxW: 910, k0: 0.6, fmin: 0.6 }, tcol));
    letters('FROM HELL', 52, 246, 104, Object.assign({ maxW: 640, k0: 0.5, rot: -0.02 }, tcol));
  }
  function partTwo(st) {
    const cx = 830, cy = 300, n = 22, pts = [];
    for (let i = 0; i < n; i++) { const a = i / n * TAU; const r = i % 2 ? rr(56, 64) : rr(84, 100); pts.push([cx + Math.cos(a) * r * 1.15, cy + Math.sin(a) * r * 0.85, 1]); }
    const burst = S(pts);
    g.save(); g.translate(8, 10); flat(burst, '#140606'); g.restore();
    paint(burst, '#ffd51c', { dir: 'radial', sd: 0.06, hi: 0.04, line: '#140606', lw: 3 });
    letters('PART', cx, cy - 58, 30, { align: 'center', fill: '#140606', w: 0.24, flick: false });
    letters('2', cx, cy - 26, 82, { align: 'center', fill: '#e2201a', ol: 0.06, olc: '#140606', w: 0.26, shadow: [0.05, 0.05], jit: 0.5 });
  }
  function bottomBlock(st) {
    const band = Pg([[0, 1338], [PW, 1332], [PW, PH], [0, PH]]);
    paint(band, '#120c0a', { dir: 0, sd: 0, hi: 0, line: null, bw: 8, len: 70, var: 0.12 });
    strokeLine([[0, 1338], [PW, 1332]], '#ffd51c', 6, 1, 'butt');
    // SHOWING TONIGHT 7:00PM → corrected to 7:30PM
    const r = letters('SHOWING TONIGHT', 34, 1352, 52, { fill: '#ffd51c', ol: 0.05, olc: '#e2201a', w: 0.24, maxW: 620, k0: 0.7 });
    const t = letters('7:00PM', r.x1 + 26, 1350, 56, { fill: '#ffffff', ol: 0.05, olc: '#e2201a', w: 0.24 });
    // the painter changed the time: patch over the "00" with not-quite-matching black, repaint
    const g0 = t.gs[2], g1 = t.gs[3];
    const px0 = g0.cx - g0.gw / 2 - g0.lw * 0.7, px1 = g1.cx + g1.gw / 2 + g1.lw * 0.6;
    const patch = S([[px0 - 3, 1343], [px1 + 1, 1345], [px1 + 3, 1413], [px0 - 2, 1415]], 0.6);
    paint(patch, '#2a1c16', { dir: 0.2, sd: 0, hi: 0, line: null, bw: 9, len: 26, var: 0.3, alpha: 0.9 });
    g.save(); g.globalAlpha = 0.86; flat(patch, '#221612'); g.restore();
    letters('30', px0 + 2, 1352, 52, { fill: '#ffffff', ol: 0.05, olc: '#e2201a', w: 0.24, jit: 1.6 });
    st.timeEnd = t.x1;
  }
  function credits(st) {
    letters('STARRING: KOFI THUNDER · AUNTIE PEPPER · SPIRIT DRIVER', 34, 1416, 24, { fill: '#f6f0e0', w: 0.2, maxW: 930, k0: 0.75, flick: false });
    // NO CHILDREN ALLOWED in a red box
    const bx = Pg([[30, 1450], [430, 1448], [432, 1484], [28, 1486]]);
    paint(bx, '#d8141a', { dir: 0, sd: 0, hi: 0.05, line: '#000', lw: 2 });
    letters('NO CHILDREN ALLOWED!', 40, 1456, 24, { fill: '#ffffff', w: 0.22, maxW: 384, k0: 0.8 });
    // signature
    letters('PAINTED BY GOOD-GOOD ART WORKS', 966, 1452, 13, { align: 'right', fill: '#ffd51c', w: 0.18, cap: 'round', maxW: 440, flick: false, paint: false });
    letters('KUMASI · TEL 051-2207', 966, 1470, 11, { align: 'right', fill: '#d8d0c0', w: 0.18, cap: 'round', flick: false, paint: false });
  }

  /* ---------------------------------------------------------------- material */
  function material(st, pass) {
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
    if (pass === 0) {
      const Wd = g.canvas.width, Hd = g.canvas.height;
      // where the paint went on thin, the sacking shows: a low-resolution thickness map
      const tm = mkCanvas(50, 75), tx = tm.getContext('2d', SW);
      tx.fillStyle = 'rgba(0,0,0,0.12)'; tx.fillRect(0, 0, 50, 75);
      const sky = tx.createLinearGradient(0, 0, 0, 75); sky.addColorStop(0, 'rgba(0,0,0,0.3)'); sky.addColorStop(0.62, 'rgba(0,0,0,0.25)'); sky.addColorStop(0.7, 'rgba(0,0,0,0)'); tx.fillStyle = sky; tx.fillRect(0, 0, 50, 75);
      for (let i = 0; i < 40; i++) { const x = R() * 50, y = R() * 75, rad = rr(3, 12); const gr = tx.createRadialGradient(x, y, 0, x, y, rad); const a = rr(0.1, 0.4); gr.addColorStop(0, R() < 0.45 ? 'rgba(0,0,0,' + a + ')' : 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); tx.fillStyle = gr; tx.fillRect(x - rad, y - rad, rad * 2, rad * 2); }
      const thin = mkCanvas(Wd, Hd), th = thin.getContext('2d', SW);
      th.drawImage(WEAVE.gray, 0, 0);
      th.globalCompositeOperation = 'destination-in'; th.imageSmoothingQuality = 'high'; th.drawImage(tm, 0, 0, Wd, Hd);
      g.globalCompositeOperation = 'overlay'; g.globalAlpha = 0.2; g.drawImage(WEAVE.gray, 0, 0);
      g.globalCompositeOperation = 'multiply'; g.globalAlpha = 0.75; g.drawImage(thin, 0, 0);
      g.globalAlpha = 0.07; g.drawImage(WEAVE.gray, 0, 0);
    } else {
      // ghost of the mill print bleeding through
      g.restore(); g.save();
      g.globalCompositeOperation = 'multiply';
      millLogo(500, st.seamY * 0.5 + 10, 1, 0, 0.13);
      millLogo(500, st.seamY + (PH - st.seamY) * 0.5, 1, Math.PI, 0.1);
    }
    g.restore();
  }
  function seam(st) {
    const y = st.seamY;
    const pts = []; for (let x = -10; x <= PW + 10; x += 25) pts.push([x, y + Math.sin(x * 0.013 + st.ph) * 3 + rr(-1, 1)]);
    curve(pts.map((p) => [p[0], p[1] + 4]), '#000', 6, 0.35);
    curve(pts.map((p) => [p[0], p[1] - 2]), '#fff6e0', 2.5, 0.35);
    // overcast twine stitches, most painted over
    const img = g.getImageData(0, Math.max(0, Math.floor((y - 12) * K)), g.canvas.width, Math.ceil(24 * K));
    for (let x = 6; x < PW; x += rr(15, 21)) {
      const yy = y + Math.sin(x * 0.013 + st.ph) * 3;
      const ix = Math.min(img.width - 1, Math.floor(x * K)), iy = Math.floor(img.height / 2);
      const o = (iy * img.width + ix) * 4;
      const painted = R() < 0.75;
      const col = painted ? [img.data[o], img.data[o + 1], img.data[o + 2]] : rgb('#d8c49a');
      const a = [x - 4, yy - 9], b = [x + 4, yy + 9];
      strokeLine([[a[0] + 1.2, a[1] + 1.5], [b[0] + 1.2, b[1] + 1.5]], '#000', 4, 0.45);
      strokeLine([a, b], col, 3.6, 1);
      strokeLine([[a[0] - 0.8, a[1] + 1], [b[0] - 0.8, b[1] - 1]], lit(col, 0.4), 1.2, 0.8);
    }
  }
  function devFill() { const m = g.getTransform(); g.setTransform(1, 0, 0, 1, 0, 0); g.fill(); g.setTransform(m); }
  function creases(st) {
    for (const cr of st.creases) {
      const [x0, y0, x1, y1] = cr;
      const n = 40; const pts = [];
      for (let i = 0; i <= n; i++) pts.push([lerp(x0, x1, i / n) + rr(-1.2, 1.2), lerp(y0, y1, i / n) + rr(-1.2, 1.2)]);
      const nx = -(y1 - y0), ny = x1 - x0, l = Math.hypot(nx, ny);
      const ox = nx / l, oy = ny / l;
      strokeLine(pts.map((p) => [p[0] + ox * 2, p[1] + oy * 2]), '#000', 3, 0.25);
      strokeLine(pts.map((p) => [p[0] - ox * 1.5, p[1] - oy * 1.5]), '#fff8e8', 1.6, 0.25);
      // paint worn off the tops of the threads along the fold
      dry(() => { for (let i = 0; i < 70; i++) {
        const t = R(), cx = lerp(x0, x1, t) + rr(-3, 3) * ox, cy = lerp(y0, y1, t) + rr(-3, 3) * oy;
        const r = rr(1.5, 6);
        flat(El(cx, cy, r, r), lit(st.sack, rr(-0.1, 0.1)), rr(0.6, 1));
      } });
    }
    flushDry();
    // abrasion near the edges and random scuffs, and scumbled brush ends past the painted area
    dry(() => {
      for (let i = 0; i < 120; i++) {
        const side = Math.floor(R() * 4);
        const x = side === 0 ? rr(0, 34) : side === 1 ? rr(PW - 34, PW) : rr(0, PW);
        const y = side === 2 ? rr(0, 34) : side === 3 ? rr(PH - 30, PH) : rr(0, PH);
        flat(El(x, y, rr(2, 12), rr(2, 9)), lit(st.sack, rr(-0.1, 0.1)), rr(0.5, 1));
      }
    });
    flushDry();
  }

  /* ------------------------------------------------------------ textures */
  // Sacking: plain weave with wandering threads, uneven thickness and slubs.
  // Returns a grey relief layer and a thread-top mask, filled in row bands.
  function makeWeave(Wd, Hd, k, seed) {
    const r = mulberry32(seed ^ 0x5eed);
    const p = Math.max(2.2, 3.4 * k);
    const N = 4096, tw = new Float32Array(N), tw2 = new Float32Array(N), tone = new Float32Array(N), tone2 = new Float32Array(N), co = new Float32Array(N), co2 = new Float32Array(N);
    for (let i = 0; i < N; i++) { tw[i] = 0.45 + r() * 0.3; tw2[i] = 0.72 + r() * 0.24; tone[i] = 0.7 + r() * 0.3; tone2[i] = 0.72 + r() * 0.28; co[i] = (r() - 0.5) * 0.3; co2[i] = (r() - 0.5) * 0.3; if (r() < 0.03) tw[i] = 0.95; if (r() < 0.03) tw2[i] = 0.98; }
    const a = [r() * TAU, r() * TAU, r() * TAU, r() * TAU];
    const rowOff = new Float32Array(Hd), colOff = new Float32Array(Wd);
    for (let y = 0; y < Hd; y++) rowOff[y] = 0.5 * Math.sin(y / k * 0.0042 + a[0]) + 0.22 * Math.sin(y / k * 0.019 + a[1]);
    for (let x = 0; x < Wd; x++) colOff[x] = 0.5 * Math.sin(x / k * 0.0037 + a[2]) + 0.22 * Math.sin(x / k * 0.023 + a[3]);
    const gray = mkCanvas(Wd, Hd), mask = mkCanvas(Wd, Hd);
    const gc = gray.getContext('2d', SW), mc = mask.getContext('2d', SW);
    const gi = gc.createImageData(Wd, Hd), mi = mc.createImageData(Wd, Hd);
    const gd = gi.data, md = mi.data;
    const band = Math.max(40, Math.floor(600000 / Wd));
    const steps = [];
    for (let y0 = 0; y0 < Hd; y0 += band) steps.push(() => {
      const y1 = Math.min(Hd, y0 + band);
      for (let y = y0; y < y1; y++) {
        const ro = rowOff[y], vy = y / p;
        for (let x = 0; x < Wd; x++) {
          const u = x / p + ro, v = vy + colOff[x];
          const i = Math.floor(u), j = Math.floor(v), fu = u - i, fv = v - j;
          const ii = i & 4095, jj = j & 4095;
          const ti = tw[ii] * (1 + 0.24 * Math.sin(v * 0.43 + ii * 1.3)), tj = tw2[jj] * (1 + 0.24 * Math.sin(u * 0.39 + jj * 1.7));
          const du = Math.abs(fu - 0.5 - co[ii]) * 2 / ti, dv = Math.abs(fv - 0.5 - co2[jj]) * 2 / tj;
          const warpTop = ((i + j) & 1) === 0;
          let val, top = 0;
          if (du < 1 && (warpTop || dv >= 1)) { val = (0.42 + 0.58 * Math.sqrt(1 - du * du) * (0.62 + 0.38 * Math.cos((fv - 0.5) * 3.1))) * tone[ii]; top = 1; }
          else if (dv < 1) { val = (0.42 + 0.58 * Math.sqrt(1 - dv * dv) * (0.62 + 0.38 * Math.cos((fu - 0.5) * 3.1))) * tone2[jj]; top = 1; }
          else val = 0.3;
          const o = (y * Wd + x) * 4, vv = (val * 255) | 0;
          gd[o] = gd[o + 1] = gd[o + 2] = vv; gd[o + 3] = 255;
          md[o] = md[o + 1] = md[o + 2] = 255; md[o + 3] = top ? Math.min(255, (val * 330) | 0) : 0;
        }
      }
    });
    steps.push(() => { gc.putImageData(gi, 0, 0); mc.putImageData(mi, 0, 0); });
    return { gray, mask, steps };
  }
  // Dry-brush: strokes drawn here only land on the tops of the threads.
  let DRY = null, DRYX = null, WEAVE = null;
  function dry(fn) { const g0 = g; g = DRYX; try { fn(); } finally { g = g0; } }
  function flushDry() {
    DRYX.save(); DRYX.setTransform(1, 0, 0, 1, 0, 0);
    DRYX.globalCompositeOperation = 'destination-in'; DRYX.drawImage(WEAVE.mask, 0, 0);
    DRYX.restore();
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(DRY, 0, 0); g.restore();
    DRYX.save(); DRYX.setTransform(1, 0, 0, 1, 0, 0); DRYX.clearRect(0, 0, DRY.width, DRY.height); DRYX.restore();
  }

  /* ------------------------------------------------------------ render */
  async function renderPoster(seed, k, alive) {
    R = mulberry32(seed);
    K = k; KENTE = null;
    const cv = mkCanvas(PW * k, PH * k);
    g = cv.getContext('2d', SW);
    g.setTransform(k, 0, 0, k, 0, 0);
    WEAVE = makeWeave(cv.width, cv.height, k, seed);
    DRY = mkCanvas(cv.width, cv.height); DRYX = DRY.getContext('2d', SW); DRYX.setTransform(k, 0, 0, k, 0, 0);
    const st = {
      seamY: 690 + rr(-30, 40),
      ph: rr(0, TAU),
      sack: [222 + rr(-8, 6), 206 + rr(-8, 6), 168 + rr(-10, 6)],
      wood: '#7a4a26',
      bands: (() => { const sets = [['#d01c1c', '#f2c414', '#1a7a34', '#f2c414', '#d01c1c'], ['#1a7a34', '#f2c414', '#d01c1c', '#2a62c0', '#f2c414'], ['#2a62c0', '#f4f0e0', '#d01c1c', '#f4f0e0', '#2a62c0']]; return pick(sets); })(),
      posts: [0, 0.24, 0.48, 0.72, 0.96],
      faceCol: pick(['#2a9a3a', '#2f9c46', '#31a03a']),
    };
    st.sackPat = null;
    // irregular painted area (the painter stopped short of the sack edge)
    const pa = [];
    const edge = (x0, y0, x1, y1, n) => { for (let i = 0; i < n; i++) { const t = i / n; pa.push([lerp(x0, x1, t) + rr(-3, 3), lerp(y0, y1, t) + rr(-3, 3)]); } };
    edge(rr(10, 18), rr(10, 18), PW - rr(10, 18), rr(10, 18), 18);
    edge(PW - rr(10, 18), rr(10, 18), PW - rr(10, 18), PH - rr(12, 20), 24);
    edge(PW - rr(10, 18), PH - rr(12, 20), rr(10, 18), PH - rr(12, 20), 18);
    edge(rr(10, 18), PH - rr(12, 20), rr(10, 18), rr(10, 18), 24);
    st.paintArea = Pg(pa).path;
    st.creases = [[rr(470, 530), 0, rr(470, 530), PH], [0, rr(360, 400), PW, rr(360, 400)], [0, rr(1100, 1140), PW, rr(1100, 1140)]].filter(() => R() < 0.8);
    const steps = WEAVE.steps.concat(buildSteps(st));
    let t0 = performance.now();
    let si = 0; const T0 = performance.now();
    for (const s of steps) {
      if (!alive()) return null;
      const ts = performance.now();
      s(); g.getImageData(0, 0, 1, 1); // flush the raster so the time budget is honest
      void ts; si++;
      if (performance.now() - t0 > 30) { await frame(); t0 = performance.now(); }
    }
    if (st.clipOn) g.restore();
    void T0;
    return cv;
  }

  /* --------------------------------------------------------------- the wall */
  function layout(W, H) {
    let pw, ph, px, py;
    if (H / W > 1.25) { // phone portrait
      pw = W * 0.9; ph = pw * 1.5;
      if (ph > H * 0.74) { ph = H * 0.74; pw = ph / 1.5; }
      px = (W - pw) / 2; py = H * 0.17;
    } else {
      ph = H * 0.86; pw = ph / 1.5;
      if (pw > W * 0.9) { pw = W * 0.9; ph = pw * 1.5; }
      px = (W - pw) / 2 + W * 0.0; py = H * 0.105;
    }
    const bulb = [px + pw * 0.56, py - ph * 0.06];
    return { pw, ph, px, py, bulb, W, H };
  }

  function drawWall(ctx, L, seed, dpr) {
    const r = mulberry32(seed ^ 0xa11);
    const W = L.W, H = L.H, u = L.pw / 600;
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const dado = Math.min(H * 0.93, L.py + L.ph * 0.8);
    ctx.fillStyle = '#7aa69a'; ctx.fillRect(0, 0, W, dado);
    ctx.fillStyle = '#2d4a37'; ctx.fillRect(0, dado, W, H - dado);
    // brushed wall paint, roller marks, old patches
    for (let i = 0; i < 1100; i++) {
      const x = r() * W, y = r() * H, up = y < dado;
      ctx.strokeStyle = up ? 'rgba(' + (100 + r() * 50 | 0) + ',' + (150 + r() * 40 | 0) + ',' + (135 + r() * 35 | 0) + ',0.22)' : 'rgba(' + (30 + r() * 30 | 0) + ',' + (60 + r() * 34 | 0) + ',' + (45 + r() * 20 | 0) + ',0.3)';
      ctx.lineWidth = (6 + r() * 14) * u; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (20 + r() * 50) * u, y + (r() - 0.5) * 10 * u); ctx.stroke();
    }
    for (let i = 0; i < 50; i++) {
      const x = r() * W, y = r() * H, rad = (20 + r() * 140) * u;
      const gr = ctx.createRadialGradient(x, y, 0, x, y, rad);
      const c = r() < 0.6 ? '50,44,28' : '190,200,180';
      gr.addColorStop(0, 'rgba(' + c + ',' + (0.08 + r() * 0.12) + ')'); gr.addColorStop(1, 'rgba(' + c + ',0)');
      ctx.fillStyle = gr; ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
    // the video centre's name, painted straight on the wall long ago; the poster is nailed over it
    const g0 = g, K0 = K, R0 = R;
    g = ctx; K = dpr; R = mulberry32(seed ^ 0x51);
    const sh = Math.min(L.ph * 0.075, H * 0.07), sy = L.py + L.ph * 0.2;
    ctx.globalAlpha = 0.78;
    letters('GOD FIRST', L.px - sh * 0.6, sy, sh, { align: 'right', fill: '#efe6cf', shadow: [0.07, 0.08], shadowc: '#9a2a1a', shadowa: 1, w: 0.22, flick: false, jit: 0.6 });
    letters('VIDEO CENTRE', L.px + L.pw + sh * 0.6, sy, sh, { fill: '#efe6cf', shadow: [0.07, 0.08], shadowc: '#9a2a1a', shadowa: 1, w: 0.22, flick: false, jit: 0.6 });
    letters('GATE FEE 200', L.px + L.pw + sh * 0.65, sy + sh * 1.5, sh * 0.5, { fill: '#e8c440', w: 0.22, flick: false, paint: false });
    letters('NO FIGHTING', L.px - sh * 0.6, sy + sh * 1.5, sh * 0.5, { align: 'right', fill: '#e8c440', w: 0.22, flick: false, paint: false });
    ctx.globalAlpha = 1;
    g = g0; K = K0; R = R0;
    // flaking: patches where the paint is gone to grey cement
    for (let i = 0; i < 14; i++) {
      const x = r() * W, y = r() * H, rr0 = (3 + r() * 14) * u;
      ctx.fillStyle = y < dado ? 'rgba(120,124,112,0.55)' : 'rgba(90,92,80,0.5)';
      ctx.beginPath();
      for (let k = 0; k < 9; k++) { const a = k / 9 * TAU, q = rr0 * (0.6 + r() * 0.6); k ? ctx.lineTo(x + Math.cos(a) * q, y + Math.sin(a) * q * 0.7) : ctx.moveTo(x + Math.cos(a) * q, y + Math.sin(a) * q * 0.7); }
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(30,30,24,0.2)'; ctx.lineWidth = 0.8; ctx.stroke();
    }
    // dado stripe, hand-painted with a wobbly edge
    ctx.fillStyle = '#8e2a1e';
    ctx.beginPath(); ctx.moveTo(0, dado - 8 * u);
    for (let x = 0; x <= W; x += 30) ctx.lineTo(x, dado - 8 * u + (r() - 0.5) * 1.6 * u);
    ctx.lineTo(W, dado); ctx.lineTo(0, dado); ctx.closePath(); ctx.fill();
    // rain streaks from the top and from the stripe
    for (let i = 0; i < 70; i++) {
      const x = r() * W, y = r() < 0.6 ? 0 : dado;
      ctx.strokeStyle = 'rgba(40,36,20,' + (0.05 + r() * 0.1) + ')'; ctx.lineWidth = (2 + r() * 8) * u;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (r() - 0.5) * 6, y + (40 + r() * 220) * u); ctx.stroke();
    }
    // hairline cracks
    for (let i = 0; i < 6; i++) {
      let x = r() * W, y = r() * H, a = r() * TAU;
      ctx.strokeStyle = 'rgba(25,25,18,0.45)'; ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.moveTo(x, y);
      for (let k = 0; k < 18; k++) { a += (r() - 0.5) * 0.9; x += Math.cos(a) * 9 * u; y += Math.sin(a) * 9 * u; ctx.lineTo(x, y); }
      ctx.stroke();
    }
    // the wiring: a flex run along the wall in clips, down to the bulb holder
    const [bx, by] = L.bulb, cy = by - 34 * u;
    ctx.strokeStyle = '#151210'; ctx.lineWidth = 2.6 * u; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-10, cy - 6 * u);
    for (let x = 0; x < bx - 30 * u; x += 60 * u) ctx.quadraticCurveTo(x + 30 * u, cy + 3 * u, x + 60 * u, cy + (r() - 0.5) * 2 * u);
    ctx.quadraticCurveTo(bx - 8 * u, cy, bx, by - 22 * u); ctx.stroke();
    for (let x = 40 * u; x < bx - 40 * u; x += 110 * u) { ctx.fillStyle = '#d8d0c0'; ctx.fillRect(x - 3 * u, cy - 4 * u, 6 * u, 7 * u); }
    // grain
    const n = mkCanvas(128, 128), nx = n.getContext('2d'), id = nx.createImageData(128, 128);
    for (let i = 0; i < 128 * 128; i++) { const v = 128 + (r() - 0.5) * 80; id.data[i * 4] = id.data[i * 4 + 1] = id.data[i * 4 + 2] = v; id.data[i * 4 + 3] = 255; }
    nx.putImageData(id, 0, 0);
    ctx.globalCompositeOperation = 'overlay'; ctx.globalAlpha = 0.4;
    ctx.fillStyle = ctx.createPattern(n, 'repeat'); ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  function posterOutline(L, seed) {
    const r = mulberry32(seed ^ 0xf00);
    const pts = [];
    const { px, py, pw, ph } = L;
    const e = (x0, y0, x1, y1, n, amp) => { for (let i = 0; i < n; i++) { const t = i / n; pts.push([lerp(x0, x1, t) + (r() - 0.5) * amp, lerp(y0, y1, t) + (r() - 0.5) * amp]); } };
    const a = pw * 0.004;
    e(px, py, px + pw, py, 30, a); e(px + pw, py, px + pw, py + ph, 45, a * 1.5); e(px + pw, py + ph, px, py + ph, 30, a); e(px, py + ph, px, py, 45, a * 1.5);
    return pts;
  }

  function compose(ctx, poster, L, seed, dpr, tilt) {
    const r = mulberry32(seed ^ 0xc0);
    const W = L.W, H = L.H;
    drawWall(ctx, L, seed, dpr);
    ctx.save(); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const cx = L.px + L.pw / 2, cy = L.py;
    ctx.translate(cx, cy); ctx.rotate(tilt); ctx.translate(-cx, -cy);
    const out = posterOutline(L, seed);
    const op = new Path2D(); out.forEach((p, i) => (i ? op.lineTo(p[0], p[1]) : op.moveTo(p[0], p[1]))); op.closePath();
    // shadow on the wall (light from above → shadow below, bottom corners curl out)
    ctx.save(); ctx.filter = 'blur(' + Math.max(2, L.pw * 0.012) + 'px)'; ctx.fillStyle = 'rgba(10,8,6,0.55)';
    ctx.translate(L.pw * 0.004, L.ph * 0.012); ctx.fill(op); ctx.restore();
    ctx.save(); ctx.filter = 'blur(' + Math.max(3, L.pw * 0.03) + 'px)'; ctx.fillStyle = 'rgba(10,8,6,0.4)';
    ctx.beginPath(); ctx.ellipse(L.px + L.pw * 0.03, L.py + L.ph * 0.99, L.pw * 0.05, L.ph * 0.03, 0, 0, TAU); ctx.ellipse(L.px + L.pw * 0.97, L.py + L.ph * 0.99, L.pw * 0.05, L.ph * 0.03, 0, 0, TAU); ctx.fill(); ctx.restore();
    // poster
    ctx.save(); ctx.clip(op);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(poster, L.px, L.py, L.pw, L.ph);
    // the sack sags between nails: soft shading
    const sg = ctx.createLinearGradient(L.px, 0, L.px + L.pw, 0);
    sg.addColorStop(0, 'rgba(0,0,0,0.18)'); sg.addColorStop(0.08, 'rgba(0,0,0,0)'); sg.addColorStop(0.92, 'rgba(0,0,0,0)'); sg.addColorStop(1, 'rgba(0,0,0,0.2)');
    ctx.fillStyle = sg; ctx.fillRect(L.px, L.py, L.pw, L.ph);
    ctx.restore();
    // frayed threads along the edges
    ctx.lineCap = 'round';
    for (let i = 0; i < 200; i++) {
      const p = out[Math.floor(r() * out.length)];
      const onSide = Math.abs(p[0] - L.px) < L.pw * 0.02 || Math.abs(p[0] - L.px - L.pw) < L.pw * 0.02;
      if (!onSide && r() < 0.8) continue;
      const ang = Math.atan2(p[1] - (L.py + L.ph / 2), p[0] - (L.px + L.pw / 2)) + (r() - 0.5) * 1.2;
      const l = (1.5 + r() * r() * 9) * L.pw / 600;
      ctx.strokeStyle = 'rgba(' + (190 + r() * 30 | 0) + ',' + (170 + r() * 30 | 0) + ',' + (130 + r() * 20 | 0) + ',0.9)';
      ctx.lineWidth = 0.6 + r() * 0.8;
      ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.quadraticCurveTo(p[0] + Math.cos(ang) * l * 0.5 + (r() - 0.5) * 3, p[1] + Math.sin(ang) * l * 0.5 + (r() - 0.5) * 3, p[0] + Math.cos(ang) * l, p[1] + Math.sin(ang) * l); ctx.stroke();
    }
    // nails
    const nails = [[0.03, 0.012], [0.5, 0.008], [0.97, 0.014]];
    for (const [u, v] of nails) {
      const x = L.px + L.pw * u, y = L.py + L.ph * v, s = L.pw / 600;
      ctx.fillStyle = 'rgba(120,50,20,0.35)'; ctx.fillRect(x - 1.5 * s, y, 3 * s, 26 * s * (0.5 + r()));
      ctx.fillStyle = '#2a2622'; ctx.beginPath(); ctx.arc(x, y, 4 * s, 0, TAU); ctx.fill();
      ctx.fillStyle = '#8a847c'; ctx.beginPath(); ctx.arc(x - 1 * s, y - 1 * s, 2 * s, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 1 * s;
      for (let k = 0; k < 4; k++) { const a = Math.PI / 2 + (r() - 0.5) * 2; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * 14 * s, y + Math.sin(a) * 18 * s); ctx.stroke(); }
    }
    ctx.restore();
    // the bulb's light
    ctx.save(); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const [bx, by] = L.bulb;
    const lc = mkCanvas(W * dpr, H * dpr), lx = lc.getContext('2d');
    lx.setTransform(dpr, 0, 0, dpr, 0, 0);
    { const ctx = lx;
    const Lr = Math.max(L.pw * 1.05, 220);
    ctx.fillStyle = 'rgb(16,12,10)'; ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'lighten';
    ctx.translate(bx, by); ctx.scale(1, 2.0);
    const lg = ctx.createRadialGradient(0, 0, 0, 0, 0, Lr);
    lg.addColorStop(0, 'rgb(255,246,228)'); lg.addColorStop(0.3, 'rgb(250,230,196)'); lg.addColorStop(0.55, 'rgb(226,196,156)'); lg.addColorStop(0.78, 'rgb(170,134,104)'); lg.addColorStop(0.9, 'rgb(76,58,46)'); lg.addColorStop(1, 'rgb(16,12,10)');
    ctx.fillStyle = lg; ctx.fillRect(-W * 2, -H * 2, W * 4, H * 4); }
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'multiply'; ctx.drawImage(lc, 0, 0);
    ctx.restore();
  }

  function drawBulb(ctx, L, dpr, f, moths, t) {
    const W = L.W, H = L.H, [bx, by] = L.bulb, s = L.pw / 600;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    // brown-out darkening
    if (f < 1) { ctx.fillStyle = 'rgba(8,5,3,' + ((1 - f) * 0.7).toFixed(3) + ')'; ctx.fillRect(0, 0, W, H); }
    ctx.globalCompositeOperation = 'lighter';
    let gr = ctx.createRadialGradient(bx, by, 0, bx, by, 220 * s);
    gr.addColorStop(0, 'rgba(255,220,150,' + (0.55 * f) + ')'); gr.addColorStop(0.3, 'rgba(255,170,80,' + (0.18 * f) + ')'); gr.addColorStop(1, 'rgba(255,150,60,0)');
    ctx.fillStyle = gr; ctx.fillRect(bx - 220 * s, by - 220 * s, 440 * s, 440 * s);
    ctx.globalCompositeOperation = 'source-over';
    // socket + glass
    ctx.fillStyle = '#1a1714'; ctx.fillRect(bx - 7 * s, by - 26 * s, 14 * s, 16 * s);
    ctx.fillStyle = '#6a625a'; ctx.fillRect(bx - 6 * s, by - 12 * s, 12 * s, 5 * s);
    gr = ctx.createRadialGradient(bx, by + 6 * s, 1, bx, by + 6 * s, 16 * s);
    gr.addColorStop(0, 'rgba(255,255,240,1)'); gr.addColorStop(0.5, 'rgba(255,236,180,' + (0.6 + 0.4 * f) + ')'); gr.addColorStop(1, 'rgba(255,210,140,' + (0.3 * f + 0.2) + ')');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.ellipse(bx, by + 6 * s, 11 * s, 14 * s, 0, 0, TAU); ctx.fill();
    // moths, and their shadows thrown on the wall
    for (const m of moths) {
      const a = t * m.sp + m.ph;
      const mx = bx + Math.sin(a) * m.rx * s + Math.sin(a * 2.3 + m.ph) * 12 * s, my = by + 10 * s + Math.cos(a * 1.3) * m.ry * s + Math.sin(a * 3.1) * 8 * s;
      const flap = Math.abs(Math.sin(t * 0.045 + m.ph)) * 0.8 + 0.2;
      const sx = bx + (mx - bx) * 2.3, sy = by + (my - by) * 2.3 + 30 * s;
      ctx.fillStyle = 'rgba(20,12,8,' + (0.22 * f) + ')';
      ctx.beginPath(); ctx.ellipse(sx - 6 * s * flap, sy, 9 * s * flap, 5 * s, -0.4, 0, TAU); ctx.ellipse(sx + 6 * s * flap, sy, 9 * s * flap, 5 * s, 0.4, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(176,150,118,0.95)'; ctx.strokeStyle = 'rgba(60,44,30,0.8)'; ctx.lineWidth = 0.6 * s;
      ctx.beginPath(); ctx.ellipse(mx - 3.6 * s * flap, my, 5 * s * flap, 3 * s, -0.4, 0, TAU); ctx.ellipse(mx + 3.6 * s * flap, my, 5 * s * flap, 3 * s, 0.4, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#3a2a1c'; ctx.beginPath(); ctx.ellipse(mx, my, 1.1 * s, 3.4 * s, 0, 0, TAU); ctx.fill();
    }
  }

  /* ---------------------------------------------------------------- mount */
  (window.PIECES = window.PIECES || []).push({
    id: 'poster',
    title: 'Mammy Wagon from Hell, Part 2',
    medium: 'Enamel and oil on two stitched flour sacks',
    note: 'Showing tonight. The painter has not seen the film.',
    about: 'A mobile-cinema poster in the Ghanaian tradition of the 1980s and 90s, painted for a film the painter never saw: a demon passenger lorry, a hero with a pistol and a Bible, a woman throwing her soup. Every brushstroke, letter, stitch and sack thread is drawn by code, then nailed to a wall under one generator bulb.',
    tone: 'dark',
    room: '#0d0a08',
    mount(el, api) {
      const seed = api.seed >>> 0;
      el.style.background = '#0d0a08';
      el.style.overflow = 'hidden';
      const base = document.createElement('canvas'), over = document.createElement('canvas');
      for (const c of [base, over]) { c.style.position = 'absolute'; c.style.left = '0'; c.style.top = '0'; c.style.width = '100%'; c.style.height = '100%'; el.appendChild(c); }
      const bctx = base.getContext('2d'), octx = over.getContext('2d');
      let dead = false, token = 0, posterCv = null, posterK = 0, L = null, dpr = 1, raf = 0, readyCalled = false, deb = 0;
      const tilt = (mulberry32(seed ^ 0x77)() - 0.5) * 0.016;
      const mr = mulberry32(seed ^ 0x3a);
      const moths = [0, 1, 2].map(() => ({ ph: mr() * TAU, sp: 0.0011 + mr() * 0.0012, rx: 30 + mr() * 50, ry: 20 + mr() * 40 }));
      async function render() {
        const my = ++token;
        const W = el.clientWidth || window.innerWidth, H = el.clientHeight || window.innerHeight;
        dpr = Math.min(2, window.devicePixelRatio || 1);
        L = layout(W, H);
        const k = Math.max(0.45, Math.min(2.2, L.ph * dpr * 1.2 / PH));
        if (!posterCv || Math.abs(k - posterK) / posterK > 0.18) {
          const cv = await renderPoster(seed, k, () => !dead && my === token && api.isCurrent());
          if (!cv || my !== token || dead) return;
          posterCv = cv; posterK = k;
        }
        base.width = over.width = Math.round(W * dpr); base.height = over.height = Math.round(H * dpr);
        compose(bctx, posterCv, L, seed, dpr, tilt);
        drawBulb(octx, L, dpr, 1, moths, performance.now());
        if (!readyCalled) { readyCalled = true; api.ready(); }
      }
      let flick = 1, nextDip = performance.now() + 3000 + mr() * 5000, dipEnd = 0, lastDraw = 0;
      function loop(t) {
        if (dead) return;
        raf = requestAnimationFrame(loop);
        if (!L || t - lastDraw < 40) return;
        lastDraw = t;
        if (t > nextDip) { dipEnd = t + 120 + mr() * 380; nextDip = t + 4000 + mr() * 9000; }
        const target = t < dipEnd ? 0.55 + mr() * 0.3 : 0.97 + mr() * 0.03;
        flick += (target - flick) * 0.5;
        drawBulb(octx, L, dpr, flick, moths, t);
      }
      raf = requestAnimationFrame(loop);
      const ro = new ResizeObserver(() => { clearTimeout(deb); deb = setTimeout(render, readyCalled ? 220 : 0); });
      ro.observe(el);
      render();
      return {
        destroy() { dead = true; token++; cancelAnimationFrame(raf); clearTimeout(deb); ro.disconnect(); base.width = base.height = over.width = over.height = 0; },
      };
    },
  });
})();
