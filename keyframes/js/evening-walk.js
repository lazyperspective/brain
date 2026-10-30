/* Keyframes 02 — "The Evening Walk".
 *
 * First frame: a thin reaper on flat dry grass under a pale khaki sky, scythe resting on the ground, ink flecks
 * drifting off his robe. Last frame: the same figure in profile on a steep hillside under an orange sky, scythe over
 * his shoulder, a staff in hand, red wildflowers all around him.
 *
 * Between them he is a character, not a transition: an articulated cut-out puppet built from the keyframes' own
 * pixels (hood, body, arm, staff, scythe as separate textured meshes in WebGL), with skinning for the head, a
 * follow-through cloth simulation driving the tatters, hem and cape, and procedural legs that plant their feet.
 *
 *   0.0 – 1.0   the first keyframe, held exactly.
 *   1.0 – 2.3   the wind rises out of the still air. His tatters lift and stream; flecks of ink tear off the robe;
 *               the dry grass shivers. He raises his head.
 *   2.3 – 3.2   anticipation — he sinks a little — and lifts the scythe off the ground; a puff of dust.
 *   3.2 – 3.9   he turns to profile: the hood swings round, the robe whips and settles, the first step.
 *   3.6 – 6.2   the walk. The camera picks him up and tracks; the sky begins to warm; a staff stands planted at the
 *               brink of the plain. He takes it in stride and pulls it from the earth.
 *   6.2 – 9.4   the land falls away. He walks down the slope with the staff; the camera pulls back and the evening
 *               opens: the sun low on the left, long shadows, a warm rim on his edges, a valley of red flowers below.
 *   9.4 – 11.2  he draws the scythe back — and swings it up in one big arc, the blade sweeping across the sky, onto
 *               his shoulder. Petals tear loose and blow across; stems sweep past the lens.
 *  11.2 – 15.3  the sun goes down behind the far hills; two birds cross the sky. He slows on the slope; the camera
 *               sinks and rolls into the final composition while the painted field resolves around him, and he
 *               settles into the last frame's pose.
 *  15.3 – 16.0  the composite settles onto the keyframe; 16.0 – 17.5 the last keyframe, held exactly.
 *
 * Every frame is a pure function of t (the cloth is simulated once at build, deterministically, and sampled).
 */
(function () {
  'use strict';

  /* ================================================================ constants & helpers */
  const W = 1080, H = 1920, FPS = 30, D = 17.5, NF = Math.round(D * FPS);
  const TA = 1.0, TB = 16.0;
  const TAU = Math.PI * 2, DEG = Math.PI / 180;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, u) => a + (b - a) * u;
  const R = (t, a, b) => clamp((t - a) / (b - a), 0, 1);
  const s3 = (u) => u * u * (3 - 2 * u);
  const s5 = (u) => u * u * u * (u * (u * 6 - 15) + 10);
  const E = (t, a, b) => s5(R(t, a, b));
  const E3 = (t, a, b) => s3(R(t, a, b));
  const bump = (t, a, b) => Math.sin(Math.PI * R(t, a, b));
  const backOut = (u, k) => { const v = u - 1; return 1 + v * v * ((k + 1) * v + k); };   // overshoots, ends at 1
  function ih(a, b, c) {
    let h = Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x165667b1) ^ Math.imul((c | 0) + 0x9e37, 0x85ebca77);
    h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
    h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
    h ^= h >>> 15;
    return (h >>> 0) / 4294967296;
  }
  function vn(x, y, s) {
    const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
    const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
    const a = ih(xi, yi, s), b = ih(xi + 1, yi, s), c = ih(xi, yi + 1, s), d = ih(xi + 1, yi + 1, s);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  const sn = (x, y, s) => vn(x, y, s) * 2 - 1;      // signed value noise
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function mk(w, h) { const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c; }
  function canvasFrom(rgba, w, h) { const c = mk(w, h), g = c.getContext('2d'); const id = g.createImageData(w, h); id.data.set(rgba); g.putImageData(id, 0, 0); return c; }
  function dataOf(c) { return c.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, c.width, c.height); }
  const rgba = (c, a) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a === undefined ? 1 : a.toFixed(3)})`;
  const mixc = (a, b, u) => [lerp(a[0], b[0], u), lerp(a[1], b[1], u), lerp(a[2], b[2], u)];

  // affine [a, b, c, d, e, f]: x' = a x + c y + e, y' = b x + d y + f (the canvas convention)
  const amul = (P, Q) => [P[0] * Q[0] + P[2] * Q[1], P[1] * Q[0] + P[3] * Q[1], P[0] * Q[2] + P[2] * Q[3], P[1] * Q[2] + P[3] * Q[3],
    P[0] * Q[4] + P[2] * Q[5] + P[4], P[1] * Q[4] + P[3] * Q[5] + P[5]];
  const ainv = (P) => {
    const det = P[0] * P[3] - P[1] * P[2], a = P[3] / det, b = -P[1] / det, c = -P[2] / det, d = P[0] / det;
    return [a, b, c, d, -(a * P[4] + c * P[5]), -(b * P[4] + d * P[5])];
  };
  const atr = (x, y) => [1, 0, 0, 1, x, y];
  const arot = (r) => { const c = Math.cos(r), s = Math.sin(r); return [c, s, -s, c, 0, 0]; };
  const asc = (sx, sy) => [sx, 0, 0, sy === undefined ? sx : sy, 0, 0];
  const aap = (P, x, y) => [P[0] * x + P[2] * y + P[4], P[1] * x + P[3] * y + P[5]];
  const alin = (P, x, y) => [P[0] * x + P[2] * y, P[1] * x + P[3] * y];
  const arotAt = (r, x, y) => amul(atr(x, y), amul(arot(r), atr(-x, -y)));
  const angOf = (x, y) => Math.atan2(y, x);

  /* ================================================================ masks & fills */
  function polyMask(polys, w, h) {
    w = w || W; h = h || H;
    const c = mk(w, h), g = c.getContext('2d');
    g.fillStyle = '#fff';
    for (const P of polys) { g.beginPath(); P.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.fill(); }
    const d = dataOf(c).data, m = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) m[i] = d[i * 4 + 3] > 127 ? 1 : 0;
    return m;
  }
  function softPoly(polys, blur) {        // a soft 0..1 field of polygons (for skin weights)
    const c = mk(W, H), g = c.getContext('2d');
    g.filter = `blur(${blur}px)`; g.fillStyle = '#fff';
    for (const P of polys) { g.beginPath(); P.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.fill(); }
    const d = dataOf(c).data, m = new Float32Array(W * H);
    for (let i = 0; i < W * H; i++) m[i] = d[i * 4 + 3] / 255;
    return m;
  }
  function bandMask(lines, hw) {
    const c = mk(W, H), g = c.getContext('2d');
    g.strokeStyle = '#fff'; g.lineWidth = hw * 2; g.lineCap = 'round'; g.lineJoin = 'round';
    for (const L of lines) { g.beginPath(); L.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke(); }
    const d = dataOf(c).data, m = new Uint8Array(W * H);
    for (let i = 0; i < W * H; i++) m[i] = d[i * 4 + 3] > 127 ? 1 : 0;
    return m;
  }
  function chamfer(m, inv) {
    const Dd = new Float32Array(W * H);
    for (let i = 0; i < W * H; i++) Dd[i] = (inv ? !m[i] : m[i]) ? 0 : 1e9;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x; let v = Dd[i];
      if (x > 0) v = Math.min(v, Dd[i - 1] + 1);
      if (y > 0) { v = Math.min(v, Dd[i - W] + 1); if (x > 0) v = Math.min(v, Dd[i - W - 1] + 1.414); if (x < W - 1) v = Math.min(v, Dd[i - W + 1] + 1.414); }
      Dd[i] = v;
    }
    for (let y = H - 1; y >= 0; y--) for (let x = W - 1; x >= 0; x--) {
      const i = y * W + x; let v = Dd[i];
      if (x < W - 1) v = Math.min(v, Dd[i + 1] + 1);
      if (y < H - 1) { v = Math.min(v, Dd[i + W] + 1); if (x < W - 1) v = Math.min(v, Dd[i + W + 1] + 1.414); if (x > 0) v = Math.min(v, Dd[i + W - 1] + 1.414); }
      Dd[i] = v;
    }
    return Dd;
  }
  const dilate = (m, r) => { const d = chamfer(m, false), o = new Uint8Array(W * H); for (let i = 0; i < W * H; i++) o[i] = d[i] <= r ? 1 : 0; return o; };
  const erode = (m, r) => { const d = chamfer(m, true), o = new Uint8Array(W * H); for (let i = 0; i < W * H; i++) o[i] = d[i] > r ? 1 : 0; return o; };
  const mand = (a, b) => { const o = new Uint8Array(W * H); for (let i = 0; i < W * H; i++) o[i] = a[i] && b[i] ? 1 : 0; return o; };
  const mor = (a, b) => { const o = new Uint8Array(W * H); for (let i = 0; i < W * H; i++) o[i] = a[i] || b[i] ? 1 : 0; return o; };
  const mnot = (a) => { const o = new Uint8Array(W * H); for (let i = 0; i < W * H; i++) o[i] = a[i] ? 0 : 1; return o; };
  const mbox = (m) => { let x0 = W, y0 = H, x1 = -1, y1 = -1; for (let i = 0; i < W * H; i++) if (m[i]) { const x = i % W, y = (i - x) / W; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } return { x0, y0, x1, y1 }; };

  // fill the unknown pixels of an RGB field from the known ones (push-pull, multiresolution), within a box
  function pushPull(src, known, box) {
    const bw = box.x1 - box.x0 + 1, bh = box.y1 - box.y0 + 1;
    let C = new Float32Array(bw * bh * 3), Wt = new Float32Array(bw * bh);
    for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) {
      const i = (y + box.y0) * W + x + box.x0, j = y * bw + x;
      if (known[i]) { Wt[j] = 1; C[j * 3] = src[i * 4]; C[j * 3 + 1] = src[i * 4 + 1]; C[j * 3 + 2] = src[i * 4 + 2]; }
    }
    const lv = [{ w: bw, h: bh, C, Wt }];
    let cw = bw, ch = bh;
    while (cw > 1 || ch > 1) {
      const nw = Math.max(1, (cw + 1) >> 1), nh = Math.max(1, (ch + 1) >> 1);
      const NC = new Float32Array(nw * nh * 3), NW = new Float32Array(nw * nh);
      for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
        const i = y * cw + x, wt = Wt[i]; if (!wt) continue;
        const j = (y >> 1) * nw + (x >> 1);
        NW[j] += wt; NC[j * 3] += C[i * 3] * wt; NC[j * 3 + 1] += C[i * 3 + 1] * wt; NC[j * 3 + 2] += C[i * 3 + 2] * wt;
      }
      for (let j = 0; j < nw * nh; j++) if (NW[j] > 0) { NC[j * 3] /= NW[j]; NC[j * 3 + 1] /= NW[j]; NC[j * 3 + 2] /= NW[j]; NW[j] = Math.min(1, NW[j]); }
      cw = nw; ch = nh; C = NC; Wt = NW; lv.push({ w: cw, h: ch, C, Wt });
    }
    for (let L = lv.length - 2; L >= 0; L--) {
      const f = lv[L], c = lv[L + 1];
      for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++) {
        const i = y * f.w + x, wt = f.Wt[i]; if (wt >= 1) continue;
        const fx = clamp((x + 0.5) / 2 - 0.5, 0, c.w - 1), fy = clamp((y + 0.5) / 2 - 0.5, 0, c.h - 1);
        const x0 = Math.floor(fx), y0 = Math.floor(fy), x1 = Math.min(x0 + 1, c.w - 1), y1 = Math.min(y0 + 1, c.h - 1), ax = fx - x0, ay = fy - y0;
        for (let k = 0; k < 3; k++) {
          const v = (c.C[(y0 * c.w + x0) * 3 + k] * (1 - ax) + c.C[(y0 * c.w + x1) * 3 + k] * ax) * (1 - ay) + (c.C[(y1 * c.w + x0) * 3 + k] * (1 - ax) + c.C[(y1 * c.w + x1) * 3 + k] * ax) * ay;
          f.C[i * 3 + k] = f.C[i * 3 + k] * wt + v * (1 - wt);
        }
        f.Wt[i] = 1;
      }
    }
    return { C: lv[0].C, bw, bh, box };
  }

  /* Cut a layer out of a keyframe: support mask `sup` (object), background colour field bg (Float32Array W*H*3) for
     matting the rim, `hole` (subset of sup) gets the push-pulled object colour, ink-hatched. Returns {c, x, y, w, h}. */
  function cutLayer(d, sup, bg, hole, opts) {
    opts = opts || {};
    const ring = dilate(sup, 1.5), interior = erode(sup, 1.2);
    const known = new Uint8Array(W * H);
    for (let i = 0; i < W * H; i++) known[i] = interior[i] && !(hole && hole[i]) ? 1 : 0;
    const b = mbox(ring);
    if (b.x1 < 0) return null;
    const pp = pushPull(d, known, b);
    const w = b.x1 - b.x0 + 1, h = b.y1 - b.y0 + 1, a = new Uint8ClampedArray(w * h * 4);
    for (let y = b.y0; y <= b.y1; y++) for (let x = b.x0; x <= b.x1; x++) {
      const i = y * W + x; if (!ring[i] || (opts.exclude && opts.exclude[i] && !sup[i])) continue;
      const o = ((y - b.y0) * w + x - b.x0) * 4, j = ((y - b.y0) * w + x - b.x0) * 3;
      const oc0 = pp.C[j], oc1 = pp.C[j + 1], oc2 = pp.C[j + 2];
      if (hole && hole[i]) { a[o] = oc0; a[o + 1] = oc1; a[o + 2] = oc2; a[o + 3] = 255; continue; }
      const r = d[i * 4], g = d[i * 4 + 1], bl = d[i * 4 + 2];
      if (opts.exclude && opts.exclude[i]) { a[o] = oc0; a[o + 1] = oc1; a[o + 2] = oc2; a[o + 3] = 255; continue; }
      if (interior[i] || opts.hard) { if (sup[i]) { a[o] = r; a[o + 1] = g; a[o + 2] = bl; a[o + 3] = 255; } continue; }
      const br = bg[i * 3], bgg = bg[i * 3 + 1], bb = bg[i * 3 + 2];
      const vx = oc0 - br, vy = oc1 - bgg, vz = oc2 - bb, vv = vx * vx + vy * vy + vz * vz;
      let al;
      if (vv < 900) al = sup[i] ? 1 : 0;
      else al = clamp(((r - br) * vx + (g - bgg) * vy + (bl - bb) * vz) / vv, 0, 1);
      if (sup[i]) al = Math.max(al, opts.minIn || 0.08); else al = Math.min(al, 0.85);
      if (al < 0.02) continue;
      a[o] = clamp((r - (1 - al) * br) / al, 0, 255); a[o + 1] = clamp((g - (1 - al) * bgg) / al, 0, 255); a[o + 2] = clamp((bl - (1 - al) * bb) / al, 0, 255);
      a[o + 3] = al * 255;
    }
    const c = canvasFrom(a, w, h);
    if (hole && opts.hatch) hatchHoles(c, b, hole, opts.hatch);
    return { c, x: b.x0, y: b.y0, w, h };
  }
  function padLayer(L, pad) {
    const c = mk(L.w + pad * 2, L.h + pad * 2); c.getContext('2d').drawImage(L.c, pad, pad);
    return { c, x: L.x - pad, y: L.y - pad, w: L.w + pad * 2, h: L.h + pad * 2 };
  }
  // ink hatching over the filled (hidden) parts of a layer so they read as cloth, not flat paint
  function hatchHoles(c, b, hole, hs) {
    const w = c.width, h = c.height, hc = mk(w, h), g = hc.getContext('2d');
    const rnd = mulberry32(hs.seed || 7);
    g.lineCap = 'round';
    for (let k = 0; k < hs.n; k++) {
      const x = rnd() * w, y = rnd() * h, len = hs.len * (0.5 + rnd()), ang = hs.ang + (rnd() - 0.5) * hs.jit;
      g.strokeStyle = rnd() < 0.8 ? `rgba(${hs.ink},${(0.35 + 0.5 * rnd()).toFixed(2)})` : `rgba(${hs.light},${(0.25 + 0.3 * rnd()).toFixed(2)})`;
      g.lineWidth = 0.8 + 1.4 * rnd();
      g.beginPath(); g.moveTo(x, y);
      const cx = x + Math.cos(ang) * len * 0.5 + (rnd() - 0.5) * 10, cy = y + Math.sin(ang) * len * 0.5;
      g.quadraticCurveTo(cx, cy, x + Math.cos(ang) * len, y + Math.sin(ang) * len); g.stroke();
    }
    // keep only over the holes
    const m = g.getImageData(0, 0, w, h), md = m.data;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = (y + b.y0) * W + x + b.x0; if (!hole[i]) md[(y * w + x) * 4 + 3] = 0; }
    g.putImageData(m, 0, 0);
    const cg = c.getContext('2d'); cg.globalCompositeOperation = 'source-atop'; cg.drawImage(hc, 0, 0); cg.globalCompositeOperation = 'source-over';
  }

  /* ================================================================ the built world */
  const K = { built: false };

  /* ---------------------------------------------------------------- keyframe geometry (fitted 1080 x 1920) */
  // Keyframe 1 (khaki): the reaper, three-quarter view
  const G1 = {
    region: [[372, 652], [910, 652], [910, 1766], [372, 1766]],
    feet: [[436, 1748], [624, 1748], [630, 1822], [430, 1822]],
    shaftTop: [[900, 694], [879, 725], [860, 750], [842, 775], [820, 800], [798, 825], [778, 850], [756, 875], [734, 900], [712, 925], [690, 950], [668, 975], [655, 992]],
    shaftLow: [[452, 1256], [425, 1302], [400, 1346], [375, 1380], [350, 1399], [325, 1411], [300, 1427], [275, 1445], [250, 1465], [225, 1481], [204, 1486]],
    blade: [[166, 1474], [172, 1510], [185, 1536], [197, 1561], [209, 1586], [222, 1611], [241, 1636], [266, 1661], [300, 1687], [348, 1712], [414, 1740], [449, 1750],
      [444, 1731], [396, 1707], [361, 1682], [328, 1657], [304, 1632], [281, 1607], [268, 1582], [256, 1557], [248, 1532], [243, 1507], [272, 1478], [270, 1452], [236, 1452]],
    grip: [600, 1030],              // the hidden hand that holds the shaft, behind the scarf
    neck: [515, 878],
    head: [[452, 668], [505, 650], [560, 660], [598, 720], [612, 800], [590, 860], [540, 880], [470, 870], [445, 800]],
    feetX: [486, 568],
  };
  // Keyframe 2 (orange): the reaper in profile, facing left
  const G2 = {
    ref: [520, 1640],               // the ground between his feet (hidden in the flowers)
    neck: [505, 565],
    shoulder: [458, 700],
    hand: [398, 1018],              // the fist round the staff
    scyGrip: [570, 690],
    hips: [[512, 1080], [548, 1070]],
    hood: [[296, 436], [345, 418], [362, 330], [400, 266], [470, 226], [548, 222], [570, 250], [612, 330], [640, 398], [600, 470], [545, 530], [470, 565], [420, 560], [380, 522]],
    // the figure's silhouette (generous against the sky; hugging the cloth where flowers cover it)
    body: [[548, 222], [566, 246], [600, 322], [646, 386], [706, 452], [776, 548], [846, 662], [896, 762], [934, 836], [996, 872], [1080, 886], [1080, 1012],
      [1010, 1018], [952, 1032], [890, 1062], [852, 1124], [834, 1210], [820, 1310], [806, 1404], [770, 1478], [700, 1530], [640, 1566], [600, 1596],
      [566, 1586], [540, 1606], [508, 1590], [478, 1612], [450, 1592], [418, 1606], [392, 1584], [356, 1600], [326, 1560], [292, 1520], [258, 1470],
      [222, 1424], [214, 1386], [244, 1372], [300, 1340], [236, 1352], [170, 1328], [118, 1340], [104, 1318], [170, 1288], [234, 1244], [300, 1222],
      [336, 1196], [340, 1104], [360, 1068], [350, 1064], [338, 1020], [352, 960], [384, 900], [404, 840], [418, 770], [430, 700], [420, 640],
      [380, 560], [300, 446], [296, 432], [340, 416], [362, 330], [404, 264], [470, 226]],
    arm: [[436, 690], [480, 694], [492, 770], [486, 850], [474, 920], [466, 990], [456, 1046], [424, 1076], [372, 1080], [338, 1064], [330, 1020], [346, 972],
      [370, 928], [392, 884], [404, 826], [416, 758]],
    behindArm: [[452, 680], [530, 680], [530, 1100], [400, 1110], [440, 1060], [470, 1000], [476, 900], [470, 800], [458, 740]],
    staff: [[398, 1012], [212, 1796]],
    snath: [[855, 166], [800, 244], [748, 334], [700, 418], [652, 500], [610, 582], [574, 662], [564, 694]],
    scythe: [[30, 278], [100, 210], [200, 150], [320, 108], [450, 92], [560, 92], [680, 100], [800, 106], [880, 94], [932, 104], [930, 130], [900, 160], [860, 190],
      [836, 196], [810, 170], [760, 150], [680, 140], [560, 136], [440, 140], [330, 156], [230, 190], [140, 240], [60, 300]],
    birds: [[738, 398, 776, 450]],
  };

  /* ---------------------------------------------------------------- timeline */
  const T_HEAD = [1.30, 2.25], T_ANT = [2.20, 2.52], T_LIFT = [2.52, 3.20];
  const T_TURN = [3.12, 3.86], T_SWAP = 3.50, T_WALK = 3.52;
  const T_GRAB = 6.05;
  const T_SWA = [9.40, 9.86], T_SW = [9.86, 10.40], T_SWS = [10.40, 11.30];
  const T_STOP = 14.55, T_SET = [15.3, 16.0];
  const K2 = 0.82;                       // the puppet's scale in the world (keyframe-2 pixels -> world px)
  const NSTEPS = 12, DIST = 3300, STEP = DIST / NSTEPS;
  const X0 = 527;                         // his feet at the start (world = keyframe-1 pixels)
  const XB = -260, SLOPE = 0.306, SOFT = 260;   // the brink of the plain, the hillside's slope, the knee of the slope
  const ROT_END = 4.8 * DEG;              // he leans back into the descent; the camera rolls by the same amount
  const gnd = (x) => {
    if (x >= XB) return 1800;
    const z = XB - x;
    return z < 2 * SOFT ? 1800 + SLOPE * z * z / (4 * SOFT) : 1800 + SLOPE * (z - SOFT);
  };
  const gslope = (x) => { if (x >= XB) return 0; const z = XB - x; return z < 2 * SOFT ? -SLOPE * z / (2 * SOFT) : -SLOPE; };  // dy/dx

  function buildWalk() {
    const N = Math.round(D * 600), U = new Float64Array(N + 1);
    const vf = (t) => E3(t, T_WALK, T_WALK + 1.05) * (1 - E3(t, 12.2, T_STOP)) * (1 - 0.32 * bump(t, 9.2, 11.4));
    for (let i = 1; i <= N; i++) U[i] = U[i - 1] + vf((i - 0.5) / 600) / 600;
    const tot = U[N];
    for (let i = 0; i <= N; i++) U[i] = U[i] / tot * DIST;
    K.U = U;
    K.VMAX = DIST / tot;
  }
  const uAt = (t) => { const f = clamp(t * 600, 0, K.U.length - 1), i = Math.floor(f), j = Math.min(i + 1, K.U.length - 1); return lerp(K.U[i], K.U[j], f - i); };
  const footX = (n) => (n === -1 ? X0 + 44 : n === 0 ? X0 - 40 : X0 - n * STEP - STEP / 2);
  function footState(j, phi) {
    let n = j === 0 ? 0 : -1;
    while (n + 2 <= NSTEPS && phi >= n + 2) n += 2;
    if (n + 2 <= NSTEPS && phi > n + 1) {
      const u = phi - n - 1, e = s3(u);
      const x = lerp(footX(n), footX(n + 2), e);
      return { x, y: gnd(x) - Math.sin(Math.PI * u) * 34 * (1 - 0.4 * u), swing: u, ang: -0.35 * Math.sin(Math.PI * u) * (u < 0.5 ? 1 : -0.6) };
    }
    const x = footX(n);
    return { x, y: gnd(x), swing: -1, ang: Math.atan(gslope(x)) };
  }
  function walker(t) {
    const u = uAt(t), phi = u / STEP, x = X0 - u;
    const sp = clamp((uAt(t + 0.05) - uAt(t - 0.05)) / 0.1 / K.VMAX, 0, 1.2);
    const bob = -11 * sp * Math.pow(Math.sin(Math.PI * phi), 2) + 3 * sp;
    return { u, phi, x, y: gnd(x) + bob, sp };
  }

  /* ---------------------------------------------------------------- the camera */
  // screen = z R(rot) (p - C) + (540, 960). Keyed by where his feet sit on screen (sx, sy), zoom and roll.
  const CAMK = [
    [0.0, 527, 1800, 1.0, 0], [3.30, 527, 1800, 1.0, 0], [4.6, 600, 1735, 0.93, 0], [6.4, 690, 1520, 0.74, 0],
    [8.3, 700, 1380, 0.60, 0.4], [10.0, 640, 1440, 0.70, -0.6], [12.3, 560, 1570, 0.97, -3.0], [14.2, 524, 1632, 1.17, -4.55], [15.25, 520, 1640, 1 / K2, -4.8],
  ];
  function camKey(t) {
    const k = CAMK;
    if (t <= k[0][0]) return k[0].slice(1);
    if (t >= k[k.length - 1][0]) return k[k.length - 1].slice(1);
    let i = 0; while (k[i + 1][0] < t) i++;
    const a = k[i], b = k[i + 1], u = (t - a[0]) / (b[0] - a[0]);
    // monotone cubic (Catmull-Rom tangents, zero at the ends, clamped)
    const out = [];
    for (let c = 1; c < 5; c++) {
      const p0 = a[c], p1 = b[c];
      const m0 = i > 0 ? (b[c] - k[i - 1][c]) / (b[0] - k[i - 1][0]) * (b[0] - a[0]) : 0;
      const m1 = i + 2 < k.length ? (k[i + 2][c] - a[c]) / (k[i + 2][0] - a[0]) * (b[0] - a[0]) : 0;
      const lo = Math.min(p0, p1), hi = Math.max(p0, p1);
      const h00 = 2 * u * u * u - 3 * u * u + 1, h10 = u * u * u - 2 * u * u + u, h01 = -2 * u * u * u + 3 * u * u, h11 = u * u * u - u * u;
      out.push(clamp(h00 * p0 + h10 * m0 + h01 * p1 + h11 * m1, lo - 0.05 * (hi - lo), hi + 0.05 * (hi - lo)));
    }
    return out;
  }
  function buildCamFollow() {
    // the camera follows his feet with a little lag (critically damped), and locks on exactly as he stops
    const N = Math.round(D * 240), FX = new Float32Array(N + 1), FY = new Float32Array(N + 1);
    let x = X0, y = 1800, vx = 0, vy = 0;
    const w0 = 2 * Math.PI * 1.1;
    for (let i = 0; i <= N; i++) {
      const t = i / 240, wk = walker(t), tx = wk.x, ty = gnd(wk.x);
      const ax = w0 * w0 * (tx - x) - 2 * w0 * vx, ay = w0 * w0 * (ty - y) - 2 * w0 * vy;
      vx += ax / 240; vy += ay / 240; x += vx / 240; y += vy / 240;
      FX[i] = x; FY[i] = y;
    }
    K.FX = FX; K.FY = FY;
  }
  function camAt(t) {
    const [sx, sy, z, rotd] = camKey(t);
    const f = clamp(t * 240, 0, K.FX.length - 1), i = Math.floor(f), j = Math.min(i + 1, K.FX.length - 1);
    const wk = walker(t);
    const lock = E(t, 14.3, 15.2);
    const fx = lerp(lerp(K.FX[i], K.FX[j], f - i), wk.x, lock), fy = lerp(lerp(K.FY[i], K.FY[j], f - i), gnd(wk.x), lock);
    const rot = rotd * DEG;
    // C such that z R (F - C) + center = S  ->  C = F - R^-1 (S - center) / z
    const c = Math.cos(-rot), s = Math.sin(-rot), qx = (sx - 540) / z, qy = (sy - 960) / z;
    const C = [fx - (c * qx - s * qy), fy - (s * qx + c * qy)];
    if (t <= 3.30) { C[0] = 540; C[1] = 960; }
    else if (t < 3.9) { const k = E(t, 3.30, 3.9); C[0] = lerp(540, C[0], k); C[1] = lerp(960, C[1], k); }
    return { C, z, rot };
  }
  // the camera affine for a layer at parallax p (1 = the walking plane, 0 = infinitely far)
  function camAff(cam, p) {
    p = p === undefined ? 1 : p;
    const z = Math.pow(cam.z, p), cx = 540 + p * (cam.C[0] - 540), cy = 960 + p * (cam.C[1] - 960);
    return amul(atr(540, 960), amul(arot(cam.rot), amul(asc(z), atr(-cx, -cy))));
  }

  /* ================================================================ segmentation */
  function fit(img) {
    const w = img.naturalWidth, h = img.naturalHeight, s = Math.max(W / w, H / h), sw = W / s, sh = H / s;
    const f = { s, sx: (w - sw) / 2, sy: (h - sh) / 2, sw, sh, w, h };
    const c = mk(W, H), g = c.getContext('2d');
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    g.drawImage(img, f.sx, f.sy, f.sw, f.sh, 0, 0, W, H);
    return { f, c };
  }

  function segment1() {
    const d = K.d1;
    // the sky: a per-row colour model (the khaki is flat across the frame)
    const rows = new Float32Array(H * 3);
    for (let y = 0; y < H; y++) {
      let n = 0, r = 0, g = 0, b = 0;
      const xs = y < 1180 ? [[8, 360], [930, 1072]] : y < 1640 ? [[8, 160], [900, 1072]] : [[8, 160], [880, 975]];
      for (const [a0, a1] of xs) for (let x = a0; x < a1; x += 2) { const i = (y * W + x) * 4; r += d[i]; g += d[i + 1]; b += d[i + 2]; n++; }
      rows[y * 3] = r / n; rows[y * 3 + 1] = g / n; rows[y * 3 + 2] = b / n;
    }
    const sm = new Float32Array(H * 3);
    for (let y = 0; y < H; y++) for (let k = 0; k < 3; k++) {
      let s = 0, n = 0;
      for (let q = -10; q <= 10; q++) { const yy = clamp(y + q, 0, 1745); s += rows[yy * 3 + k]; n++; }
      sm[y * 3 + k] = s / n;
    }
    K.sky1 = sm;
    const bg = new Float32Array(W * H * 3);
    for (let i = 0; i < W * H; i++) { const y = (i / W) | 0; bg[i * 3] = sm[y * 3]; bg[i * 3 + 1] = sm[y * 3 + 1]; bg[i * 3 + 2] = sm[y * 3 + 2]; }
    K.bg1 = bg;
    const nonSky = new Uint8Array(W * H);
    for (let i = 0; i < W * H; i++) {
      const r = d[i * 4], g = d[i * 4 + 1], b = d[i * 4 + 2];
      const dr = r - bg[i * 3], dg = g - bg[i * 3 + 1], db = b - bg[i * 3 + 2];
      const L = 0.299 * dr + 0.587 * dg + 0.114 * db;
      nonSky[i] = (L < -16 || L > 11 || dr * dr + dg * dg + db * db > 700) ? 1 : 0;
    }
    // the scythe: shaft bands + the blade polygon, closed so the pale wood between the ink outlines is kept
    const band = bandMask([G1.shaftTop, G1.shaftLow], 15);
    const bladeP = polyMask([G1.blade]);
    const reg = polyMask([G1.region, G1.feet]);
    const lowY = (i) => ((i / W) | 0) >= 1764;
    let scy = new Uint8Array(W * H);
    for (let i = 0; i < W * H; i++) {
      const x = i % W, y = (i - x) / W;
      const inBand = band[i] && ((y < 1000 && x > 652) || (y > 1240 && x < 450));
      scy[i] = (inBand && nonSky[i]) || bladeP[i] ? 1 : 0;
    }
    scy = erode(dilate(scy, 5), 5);
    for (let i = 0; i < W * H; i++) if (!(band[i] || bladeP[i])) scy[i] = 0;
    // the figure
    let fig = new Uint8Array(W * H);
    const feet = polyMask([G1.feet]);
    for (let i = 0; i < W * H; i++) fig[i] = reg[i] && nonSky[i] && !scy[i] && (!lowY(i) || feet[i]) ? 1 : 0;
    fig = erode(dilate(fig, 2), 2);
    for (let i = 0; i < W * H; i++) if (scy[i] || !reg[i]) fig[i] = 0;
    K.fig1 = fig; K.scy1 = scy;
    // the plate: the first keyframe without him (sky rows behind; ground copied from beside his feet)
    const P = new Uint8ClampedArray(d);
    const hole = dilate(mor(fig, scy), 3);
    for (let i = 0; i < W * H; i++) {
      if (!hole[i]) continue;
      const x = i % W, y = (i - x) / W;
      if (y < 1762) {
        const n = (vn(x * 0.35, y * 0.35, 3) - 0.5) * 3;
        P[i * 4] = sm[y * 3] + n; P[i * 4 + 1] = sm[y * 3 + 1] + n; P[i * 4 + 2] = sm[y * 3 + 2] + n;
      } else {
        const j = (y * W + x + 210) * 4; P[i * 4] = d[j]; P[i * 4 + 1] = d[j + 1]; P[i * 4 + 2] = d[j + 2];
      }
    }
    K.plate1 = canvasFrom(P, W, H);
    K.plate1d = P;
    // layers
    K.body1 = cutLayer(d, fig, bg, null, {});
    // the shaft runs behind the scarf: paint the hidden stretch so it can move
    K.scy1L = cutLayer(d, scy, bg, null, {});
    {
      const L = K.scy1L, g = L.c.getContext('2d');
      const a = [G1.shaftTop[G1.shaftTop.length - 1][0] - L.x, G1.shaftTop[G1.shaftTop.length - 1][1] - L.y];
      const b = [G1.shaftLow[0][0] - L.x, G1.shaftLow[0][1] - L.y];
      g.globalCompositeOperation = 'destination-over';
      g.lineCap = 'round';
      g.strokeStyle = 'rgb(40,32,24)'; g.lineWidth = 20; g.beginPath(); g.moveTo(a[0] + 6, a[1] - 8); g.lineTo(b[0] - 3, b[1] + 6); g.stroke();
      g.globalCompositeOperation = 'source-over';
      g.strokeStyle = 'rgb(138,110,80)'; g.lineWidth = 13; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke();
      g.strokeStyle = 'rgba(60,44,30,0.7)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(a[0] + 2, a[1]); g.lineTo(b[0] + 2, b[1]); g.stroke();
    }
    // the ink flecks drifting off him: their colours, for the ones the wind tears off
    K.ink1 = [45, 50, 44];
  }

  function segment2() {
    const d = K.d2;
    const skyLike = (i) => {
      const r = d[i * 4], g = d[i * 4 + 1], b = d[i * 4 + 2];
      return r > 178 && g > 104 && g < 178 && b < 100 && r - g > 52 && r - g < 118 && g - b > 58;
    };
    const redLike = (i) => { const r = d[i * 4], g = d[i * 4 + 1], b = d[i * 4 + 2]; return r > 140 && r - g > 100 && b < 110; };
    // sky field: block means of the sky pixels, push-pulled, bilinear
    const sky = new Uint8Array(W * H);
    for (let i = 0; i < W * H; i++) sky[i] = skyLike(i) ? 1 : 0;
    const B = 12, bw = Math.ceil(W / B), bh = Math.ceil(H / B);
    const bs = new Float32Array(bw * bh * 4), bn = new Float32Array(bw * bh);
    for (let i = 0; i < W * H; i++) if (sky[i]) { const x = i % W, y = (i - x) / W, j = ((y / B) | 0) * bw + ((x / B) | 0); bs[j * 4] += d[i * 4]; bs[j * 4 + 1] += d[i * 4 + 1]; bs[j * 4 + 2] += d[i * 4 + 2]; bn[j]++; }
    // a tiny W*H-sized trick: run pushPull on the block grid by laying it into the top-left of a full frame buffer
    const grid = new Float32Array(W * H * 4), gk = new Uint8Array(W * H);
    for (let j = 0; j < bw * bh; j++) if (bn[j] > B * B * 0.3) { const x = j % bw, y = (j - x) / bw, i = y * W + x; grid[i * 4] = bs[j * 4] / bn[j]; grid[i * 4 + 1] = bs[j * 4 + 1] / bn[j]; grid[i * 4 + 2] = bs[j * 4 + 2] / bn[j]; gk[i] = 1; }
    const gp = pushPull(grid, gk, { x0: 0, y0: 0, x1: bw - 1, y1: bh - 1 });
    const bg = new Float32Array(W * H * 3);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const fx = clamp((x + 0.5) / B - 0.5, 0, bw - 1), fy = clamp((y + 0.5) / B - 0.5, 0, bh - 1);
      const x0 = Math.floor(fx), y0 = Math.floor(fy), x1 = Math.min(x0 + 1, bw - 1), y1 = Math.min(y0 + 1, bh - 1), ax = fx - x0, ay = fy - y0;
      for (let k = 0; k < 3; k++) {
        bg[(y * W + x) * 3 + k] = (gp.C[(y0 * bw + x0) * 3 + k] * (1 - ax) + gp.C[(y0 * bw + x1) * 3 + k] * ax) * (1 - ay) + (gp.C[(y1 * bw + x0) * 3 + k] * (1 - ax) + gp.C[(y1 * bw + x1) * 3 + k] * ax) * ay;
      }
    }
    K.bg2 = bg;
    // sky rows (for the procedural sky to arrive at)
    const rows = new Float32Array(H * 3);
    for (let y = 0; y < H; y++) for (let k = 0; k < 3; k++) { let s = 0; for (let x = 0; x < W; x += 8) s += bg[(y * W + x) * 3 + k]; rows[y * 3 + k] = s / Math.ceil(W / 8); }
    K.sky2 = rows;
    const red = new Uint8Array(W * H);
    for (let i = 0; i < W * H; i++) red[i] = redLike(i) ? 1 : 0;
    // ---- the parts
    const body = polyMask([G2.body]);
    const armP = polyMask([G2.arm]), behind = polyMask([G2.behindArm]);
    const staffB = bandMask([G2.staff], 16);
    const snathB = bandMask([G2.snath], 17);
    const scyP = polyMask([G2.scythe]);
    const dark = (i) => { const r = d[i * 4], g = d[i * 4 + 1], b = d[i * 4 + 2]; return 0.299 * r + 0.587 * g + 0.114 * b < 150; };
    const grassy = (i) => { const r = d[i * 4], g = d[i * 4 + 1], b = d[i * 4 + 2]; return (r - b > 75 && r > 110 && r - g > 45) || (r - g > 40 && r - b > 40 && r > 70); };   // warm: flowers, grass, sky through gaps
    // cloak cloth: dark, cool (navy-grey to black) — flower ink and wood are warm
    const cloakLike = (i) => { const r = d[i * 4], g = d[i * 4 + 1], b = d[i * 4 + 2]; return 0.299 * r + 0.587 * g + 0.114 * b < 95 && b >= r - 6 && g >= r - 10; };
    {
      // the thin streamers and the hem bits outside the drawn silhouette: cool dark cloth near it
      const near = dilate(body, 70);
      for (let i = 0; i < W * H; i++) { const y = (i / W) | 0; if (!body[i] && near[i] && y > 980 && cloakLike(i)) body[i] = 2; }
      const nb = erode(dilate(body, 2), 2);
      for (let i = 0; i < W * H; i++) if (nb[i] && !body[i] && !skyLike(i)) body[i] = 2;
    }
    // the staff: dark pixels in its band below the fist, closed across the grain
    let staff = new Uint8Array(W * H);
    for (let i = 0; i < W * H; i++) { const y = (i / W) | 0; staff[i] = staffB[i] && y > 1040 && dark(i) && !red[i] ? 1 : 0; }
    staff = erode(dilate(staff, 4), 4);
    for (let i = 0; i < W * H; i++) { const y = (i / W) | 0; if (!staffB[i] || y <= 1040) staff[i] = 0; }
    // its hidden stretches (flowers and grass in front of it, low down): the band itself, narrowed
    const staffCore = bandMask([G2.staff], 12.5);
    const staffHole = new Uint8Array(W * H);
    for (let i = 0; i < W * H; i++) { const y = (i / W) | 0; if (staffCore[i] && y > 1040 && !staff[i]) { staffHole[i] = 1; } }
    const staffSup = mor(staff, staffHole);
    K.staff2 = cutLayer(d, staffSup, bg, staffHole, { hatch: { n: 160, len: 40, ang: Math.atan2(784, -186), jit: 0.1, ink: '40,28,18', light: '120,90,60', seed: 11 } });
    // the scythe: blade + heel (not sky) and the snath band
    let scy = new Uint8Array(W * H);
    for (let i = 0; i < W * H; i++) { const y = (i / W) | 0; scy[i] = ((scyP[i] && !sky[i]) || (snathB[i] && dark(i)) || (y < 330 && !sky[i])) && !body[i] ? 1 : 0; }
    // the snath where it crosses the cloak: dark-brown wood, brighter than the cloth
    for (let i = 0; i < W * H; i++) if (snathB[i] && body[i]) {
      const r = d[i * 4], g = d[i * 4 + 1], b = d[i * 4 + 2];
      if (r - b > 18 && r > 55) scy[i] = 1;
    }
    scy = erode(dilate(scy, 4), 4);
    for (let i = 0; i < W * H; i++) { const y = (i / W) | 0; if (!(scyP[i] || snathB[i] || y < 330) || sky[i] || body[i] && !snathB[i]) scy[i] = 0; }
    {
      // keep the snath's width honest where it crosses the cloak: the core band only
      const core = bandMask([G2.snath], 13);
      for (let i = 0; i < W * H; i++) if (snathB[i] && body[i] && !core[i]) scy[i] = 0;
    }
    K.scy2L = cutLayer(d, scy, bg, null, {});
    {   // the snath continues behind his shoulder: its hidden butt end, a separate piece drawn behind the body
      const a = G2.snath[G2.snath.length - 1], dir = [a[0] - 855, a[1] - 166], n = Math.hypot(dir[0], dir[1]);
      const ux = dir[0] / n, uy = dir[1] / n, L = { c: mk(260, 260), x: a[0] - 130, y: a[1] - 130, w: 260, h: 260 }, g = L.c.getContext('2d');
      const p0 = [130 - ux * 30, 130 - uy * 30], p1 = [130 + ux * 120, 130 + uy * 120];
      g.lineCap = 'round';
      g.strokeStyle = 'rgb(30,22,14)'; g.lineWidth = 25; g.beginPath(); g.moveTo(p0[0], p0[1]); g.lineTo(p1[0], p1[1]); g.stroke();
      g.strokeStyle = 'rgb(96,72,48)'; g.lineWidth = 18; g.beginPath(); g.moveTo(p0[0], p0[1]); g.lineTo(p1[0] - ux * 3, p1[1] - uy * 3); g.stroke();
      g.strokeStyle = 'rgba(40,28,16,0.6)'; g.lineWidth = 1.4; for (const o of [-4, 3]) { g.beginPath(); g.moveTo(p0[0] - uy * o, p0[1] + ux * o); g.lineTo(p1[0] - uy * o, p1[1] + ux * o); g.stroke(); }
      K.butt2 = L;
    }
    // the near arm (sleeve, bindings, the bony hand)
    let arm = new Uint8Array(W * H);
    for (let i = 0; i < W * H; i++) arm[i] = armP[i] && !sky[i] && !staff[i] ? 1 : 0;
    arm = erode(dilate(arm, 1.5), 1.5);
    for (let i = 0; i < W * H; i++) if (!armP[i]) arm[i] = 0;
    K.arm2 = cutLayer(d, arm, bg, null, {});
    {   // fade the top of the sleeve into the cloak it comes out of
      const L = K.arm2, g = L.c.getContext('2d'), gr = g.createLinearGradient(0, 690 - L.y, 0, 740 - L.y);
      gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.globalCompositeOperation = 'destination-out'; g.fillStyle = gr; g.fillRect(0, 0, L.w, 740 - L.y); g.globalCompositeOperation = 'source-over';
    }
    // the body: hood, cloak, cape, tatters, strap — minus arm, staff and snath; flowers in front become hidden cloth
    const sup = new Uint8Array(W * H), hole = new Uint8Array(W * H), strapP = polyMask([[[588, 970], [652, 970], [664, 1384], [598, 1384]]]);
    for (let i = 0; i < W * H; i++) {
      if (!body[i]) continue;
      if (armP[i] && !behind[i]) continue;
      if (sky[i] && !(armP[i] && behind[i])) continue;
      if (staffSup[i]) { if (!behind[i] && !G2insideStaffCloth(i)) continue; }
      sup[i] = 1;
      const x = i % W, y = (i - x) / W, low = (y > 1150 || (x > 820 && y > 770)) && !strapP[i];
      if (red[i] || (armP[i] && behind[i]) || staffSup[i] || scy[i] || grassy(i) || (low && !cloakLike(i))) hole[i] = 1;
    }
    // keep the silhouette clean: close small gaps, drop specks
    const sup2 = erode(dilate(sup, 2), 2);
    for (let i = 0; i < W * H; i++) if (sup2[i] && !sup[i] && body[i] && !(armP[i] && !behind[i])) { sup[i] = 1; hole[i] = 1; }
    for (let i = 0; i < W * H; i++) {
      if (!sup[i] || hole[i]) continue;
      const x = i % W, y = (i - x) / W, low = (y > 1150 || (x > 820 && y > 770)) && !strapP[i];
      if (skyLike(i) || red[i] || grassy(i) || (low && !cloakLike(i))) hole[i] = 1;
    }
    const warmX = new Uint8Array(W * H);
    for (let i = 0; i < W * H; i++) warmX[i] = red[i] || grassy(i) ? 1 : 0;
    K.body2 = cutLayer(d, sup, bg, hole, { exclude: warmX, hatch: { n: 2600, len: 60, ang: Math.PI * 0.47, jit: 0.5, ink: '14,18,20', light: '70,88,92', seed: 5 } });
    K.sup2 = sup;
    {   // the cape runs out of the frame at the right edge: finish it past the edge with ragged tatters
      const L0 = K.body2, pad = 170, cw = L0.w + pad, c = mk(cw, L0.h), g = c.getContext('2d');
      g.drawImage(L0.c, 0, 0);
      const id = g.getImageData(0, 0, cw, L0.h), a = id.data, xe = W - 1 - L0.x;
      for (let y = 0; y < L0.h; y++) {
        const o = (y * cw + xe) * 4; if (a[o + 3] < 128) continue;
        const yy = y + L0.y, len = 24 + 140 * Math.pow(vn(yy / 19, 0.5, 41), 1.3) * (0.45 + 0.55 * vn(yy / 6, 3.5, 42));
        for (let x = 1; x <= len && xe + x < cw; x++) {
          const u = x / len, j = (y * cw + xe + x) * 4, src = (y * cw + Math.max(0, xe - x)) * 4;
          a[j] = a[src] * 0.92; a[j + 1] = a[src + 1] * 0.92; a[j + 2] = a[src + 2] * 0.92; a[j + 3] = 255 * (u > 0.9 ? (1 - u) / 0.1 : 1);
        }
      }
      g.putImageData(id, 0, 0);
      K.body2 = { c, x: L0.x, y: L0.y, w: cw, h: L0.h };
    }
    // ---- the plate in front of him: everything that is neither sky nor him (flowers, grass, rocks)
    const him = new Uint8Array(W * H);
    for (let i = 0; i < W * H; i++) him[i] = (sup[i] && !hole[i]) || arm[i] || staff[i] || scy[i] ? 1 : 0;
    const birdsM = new Uint8Array(W * H);
    for (const [x0, y0, x1, y1] of G2.birds) for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (!sky[y * W + x]) birdsM[y * W + x] = 1;
    const front = new Uint8Array(W * H);
    const himD = dilate(him, 2.5);
    // below the hillside's line the golden grass can look like sky to the colour test: it all belongs to the field
    const hill = (i) => { const x = i % W, y = (i - x) / W; return y > 1600 - 0.33 * x; };
    for (let i = 0; i < W * H; i++) front[i] = (!sky[i] || hill(i)) && !(himD[i] && !(red[i] || grassy(i) || hill(i) && !him[i])) && !birdsM[i] ? 1 : 0;
    const frontC = erode(dilate(front, 1), 1);
    for (let i = 0; i < W * H; i++) if (him[i] || birdsM[i]) frontC[i] = 0; else if (front[i]) frontC[i] = 1;
    K.front2 = cutLayer(d, frontC, bg, null, { minIn: 0.5 });
    K.frontM = frontC;
    // the ground behind him, low down (shows only if he moves while the painted field is up)
    const bk = new Uint8Array(W * H), bkKnown = new Uint8Array(W * H);
    for (let i = 0; i < W * H; i++) { const y = (i / W) | 0; if (y > 1330 && sup[i]) bk[i] = 1; if (y > 1300 && frontC[i]) bkKnown[i] = 1; }
    {
      const b = mbox(bk);
      if (b.x1 >= 0) {
        const pp = pushPull(d, bkKnown, b), w = b.x1 - b.x0 + 1, h = b.y1 - b.y0 + 1, a = new Uint8ClampedArray(w * h * 4);
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = (y + b.y0) * W + x + b.x0; if (!bk[i]) continue; const o = (y * w + x) * 4, j = (y * w + x) * 3; a[o] = pp.C[j]; a[o + 1] = pp.C[j + 1]; a[o + 2] = pp.C[j + 2]; a[o + 3] = 255 * clamp(((y + b.y0) - 1330) / 60, 0, 1); }
        K.back2 = { c: canvasFrom(a, w, h), x: b.x0, y: b.y0, w, h };
      }
    }
    // ---- the sky plate: the painted sky, with him and the field replaced by the sky field
    const S = new Uint8ClampedArray(W * H * 4);
    for (let i = 0; i < W * H; i++) {
      if (sky[i]) { S[i * 4] = d[i * 4]; S[i * 4 + 1] = d[i * 4 + 1]; S[i * 4 + 2] = d[i * 4 + 2]; }
      else { S[i * 4] = bg[i * 3]; S[i * 4 + 1] = bg[i * 3 + 1]; S[i * 4 + 2] = bg[i * 3 + 2]; }
      S[i * 4 + 3] = 255;
    }
    K.skyPlate2 = canvasFrom(S, W, H);
    // the two distant birds
    K.birds2 = cutLayer(d, birdsM, bg, null, { minIn: 0.6 });
    K.red2 = red; K.sky2m = sky;
    function G2insideStaffCloth(i) {
      // the staff crosses dark cloth only where cloth lies on both sides of it
      const x = i % W, y = (i - x) / W;
      const nx = 0.973, ny = 0.231;            // perpendicular to the staff
      const a = (Math.round(y + ny * 19) * W + Math.round(x + nx * 19)), b = (Math.round(y - ny * 19) * W + Math.round(x - nx * 19));
      return a >= 0 && b >= 0 && a < W * H && b < W * H && !skyLike(a) && !skyLike(b) && !red[a] && !red[b] && body[a] && body[b];
    }
  }

  /* ---------------------------------------------------------------- flower sprites cut from the last frame */
  function buildSprites() {
    const F = K.front2, fd = dataOf(F.c).data;
    const rects = [[924, 372, 1010, 806], [118, 1330, 212, 1560], [196, 1388, 262, 1560], [0, 1228, 118, 1480], [972, 404, 1080, 760]];
    K.sprites = [];
    rects.forEach(([x0, y0, x1, y1], k) => {
      const w = x1 - x0, h = y1 - y0, a = new Uint8ClampedArray(w * h * 4);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const sx = x + x0 - F.x, sy = y + y0 - F.y;
        if (sx < 0 || sy < 0 || sx >= F.w || sy >= F.h) continue;
        const o = (sy * F.w + sx) * 4, p = (y * w + x) * 4;
        const fade = clamp((h - 1 - y) / 26, 0, 1);       // the cut at the base, softened
        a[p] = fd[o]; a[p + 1] = fd[o + 1]; a[p + 2] = fd[o + 2]; a[p + 3] = fd[o + 3] * Math.min(fade, k === 3 ? clamp(x / 14, 0, 1) : 1) * (k === 4 ? clamp((w - 1 - x) / 14, 0, 1) : 1);
      }
      K.sprites.push({ c: canvasFrom(a, w, h), w, h, bx: w * 0.5, by: h });
    });
    // procedural sprigs in the same ink-and-red manner, for variety
    const rnd = mulberry32(77);
    for (let k = 0; k < 10; k++) {
      const h = 220 + rnd() * 260, w = 150, c = mk(w, h + 10), g = c.getContext('2d');
      g.lineCap = 'round'; g.lineJoin = 'round';
      const stems = 1 + Math.floor(rnd() * 3);
      for (let s = 0; s < stems; s++) {
        const lean = (rnd() - 0.5) * 0.5, hh = h * (0.65 + 0.35 * rnd());
        const pts = [];
        for (let i = 0; i <= 12; i++) { const u = i / 12; pts.push([w / 2 + lean * hh * u + Math.sin(u * 3 + s) * 6, h + 8 - hh * u]); }
        g.strokeStyle = 'rgb(120,30,18)'; g.lineWidth = 3.2; g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke();
        g.strokeStyle = 'rgb(214,52,30)'; g.lineWidth = 1.6; g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke();
        for (let i = 3; i <= 12; i++) {
          const [px, py] = pts[i], side = i % 2 ? 1 : -1, n = 1 + Math.floor(rnd() * 3);
          for (let q = 0; q < n; q++) {
            const bx = px + side * (8 + rnd() * 18), by = py - rnd() * 14, r = 5 + rnd() * 7 * (1.2 - i / 14);
            g.strokeStyle = 'rgb(120,30,18)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(px, py); g.lineTo(bx, by); g.stroke();
            g.fillStyle = rnd() < 0.5 ? 'rgb(226,58,30)' : 'rgb(240,74,36)';
            g.beginPath();
            for (let p = 0; p < 5; p++) { const an = p / 5 * TAU + rnd(), rr = r * (0.6 + 0.5 * rnd()); g.lineTo(bx + Math.cos(an) * rr, by + Math.sin(an) * rr * 0.8); }
            g.closePath(); g.fill();
            g.strokeStyle = 'rgba(70,14,8,0.85)'; g.lineWidth = 1; g.stroke();
          }
        }
      }
      K.sprites.push({ c, w, h: h + 10, bx: w / 2, by: h + 8 });
    }
    // blurred copies for the foreground (out of focus, close to the lens)
    K.spritesBlur = K.sprites.map((s) => {
      const pad = 24, c = mk(s.w + pad * 2, s.h + pad * 2), g = c.getContext('2d');
      g.filter = 'blur(3.5px) brightness(0.42) saturate(1.2)'; g.drawImage(s.c, pad, pad);
      return { c, w: s.w + pad * 2, h: s.h + pad * 2, bx: s.bx + pad, by: s.by + pad };
    });
  }

  /* ================================================================ WebGL: textured, deformable meshes */
  const GL = {};
  function glInit() {
    const cv = mk(W, H);
    const gl = cv.getContext('webgl2', { premultipliedAlpha: true, alpha: true, antialias: true, preserveDrawingBuffer: true });
    if (!gl) throw new Error('WebGL2 is not available');
    const vs = `#version 300 es
      in vec2 aPos; in vec2 aUV; out vec2 vUV;
      void main() { vUV = aUV; gl_Position = vec4(aPos.x / ${W}.0 * 2.0 - 1.0, 1.0 - aPos.y / ${H}.0 * 2.0, 0.0, 1.0); }`;
    const fs = `#version 300 es
      precision highp float; in vec2 vUV; out vec4 o;
      uniform sampler2D uTex; uniform float uAlpha, uDesat, uRim, uFlat; uniform vec3 uMul, uAdd, uRimCol, uFlatCol; uniform vec2 uRimDir, uFade;
      void main() {
        vec4 c = texture(uTex, vUV);
        if (uFlat > 0.5) { float f = clamp(vUV.y * uFade.x + uFade.y, 0.0, 1.0); o = vec4(uFlatCol, 1.0) * c.a * uAlpha * f * f; return; }
        vec3 col = c.a > 0.0 ? c.rgb / c.a : vec3(0.0);
        float l = dot(col, vec3(0.299, 0.587, 0.114));
        col = mix(col, vec3(l), uDesat) * uMul + uAdd;
        if (uRim > 0.0) {
          float a2 = texture(uTex, vUV + uRimDir).a, a3 = texture(uTex, vUV + uRimDir * 2.5).a;
          col = mix(col, uRimCol, clamp(c.a - 0.5 * (a2 + a3), 0.0, 1.0) * uRim);
        }
        o = vec4(clamp(col, 0.0, 1.0) * c.a, c.a) * uAlpha;
      }`;
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
    const pr = gl.createProgram();
    gl.attachShader(pr, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, fs));
    gl.bindAttribLocation(pr, 0, 'aPos'); gl.bindAttribLocation(pr, 1, 'aUV');
    gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(pr));
    gl.useProgram(pr);
    const U = {};
    for (const n of ['uTex', 'uAlpha', 'uDesat', 'uRim', 'uFlat', 'uMul', 'uAdd', 'uRimCol', 'uFlatCol', 'uRimDir', 'uFade']) U[n] = gl.getUniformLocation(pr, n);
    gl.uniform1i(U.uTex, 0);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.viewport(0, 0, W, H);
    const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
    gl.enableVertexAttribArray(0); gl.enableVertexAttribArray(1);
    Object.assign(GL, { cv, gl, U, vao });
  }
  function glPart(L, step) {
    const gl = GL.gl;
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, L.c);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    // a grid over the occupied cells
    const a = dataOf(L.c).data, nx = Math.ceil(L.w / step), ny = Math.ceil(L.h / step);
    const occ = new Uint8Array(nx * ny);
    for (let y = 0; y < L.h; y++) for (let x = 0; x < L.w; x++) if (a[(y * L.w + x) * 4 + 3] > 0) occ[((y / step) | 0) * nx + ((x / step) | 0)] = 1;
    const vid = new Int32Array((nx + 1) * (ny + 1)).fill(-1), rest = [], uv = [], idx = [];
    const vert = (i, j) => {
      const k = j * (nx + 1) + i;
      if (vid[k] < 0) { const x = Math.min(i * step, L.w), y = Math.min(j * step, L.h); vid[k] = rest.length / 2; rest.push(L.x + x, L.y + y); uv.push(x / L.w, y / L.h); }
      return vid[k];
    };
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      if (!occ[j * nx + i]) continue;
      const v0 = vert(i, j), v1 = vert(i + 1, j), v2 = vert(i, j + 1), v3 = vert(i + 1, j + 1);
      idx.push(v0, v1, v2, v1, v3, v2);
    }
    const uvBuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, uvBuf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(uv), gl.STATIC_DRAW);
    const posBuf = gl.createBuffer();
    const idxBuf = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxBuf);
    const big = rest.length / 2 > 65535;
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, big ? new Uint32Array(idx) : new Uint16Array(idx), gl.STATIC_DRAW);
    L.gl = { tex, uvBuf, posBuf, idxBuf, n: idx.length, type: big ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT, rest: new Float32Array(rest), pos: new Float32Array(rest.length) };
    return L;
  }
  function glClear() { const gl = GL.gl; gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); }
  const GRADE0 = { alpha: 1, desat: 0, mul: [1, 1, 1], add: [0, 0, 0], rim: 0, rimCol: [1, 0.7, 0.3], rimDir: [0, 0], flat: 0, flatCol: [0, 0, 0], fade: null };
  function glDraw(L, gr) {
    const gl = GL.gl, P = L.gl, U = GL.U;
    gr = Object.assign({}, GRADE0, gr || {});
    gl.bindBuffer(gl.ARRAY_BUFFER, P.posBuf); gl.bufferData(gl.ARRAY_BUFFER, P.pos, gl.DYNAMIC_DRAW); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, P.uvBuf); gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, P.idxBuf);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, P.tex);
    gl.uniform1f(U.uAlpha, gr.alpha); gl.uniform1f(U.uDesat, gr.desat); gl.uniform1f(U.uRim, gr.rim); gl.uniform1f(U.uFlat, gr.flat);
    gl.uniform3fv(U.uMul, gr.mul); gl.uniform3fv(U.uAdd, gr.add); gl.uniform3fv(U.uRimCol, gr.rimCol); gl.uniform3fv(U.uFlatCol, gr.flatCol);
    gl.uniform2f(U.uRimDir, gr.rimDir[0] / L.w, gr.rimDir[1] / L.h);
    if (gr.fade) { const [yh, yf] = gr.fade; gl.uniform2f(U.uFade, L.h / (yf - yh), (L.y - yh) / (yf - yh)); } else gl.uniform2f(U.uFade, 0, 1);
    gl.drawElements(gl.TRIANGLES, P.n, P.type, 0);
  }
  // set a part's vertex positions: local deformation fn (optional), then an affine
  function placeVerts(L, A, deform) {
    const r = L.gl.rest, p = L.gl.pos, n = r.length / 2;
    for (let i = 0; i < n; i++) {
      let x = r[i * 2], y = r[i * 2 + 1];
      if (deform) { const q = deform(x, y, i); x = q[0]; y = q[1]; }
      p[i * 2] = A[0] * x + A[2] * y + A[4]; p[i * 2 + 1] = A[1] * x + A[3] * y + A[5];
    }
  }

  /* ================================================================ cloth: follow-through chains, simulated once */
  // Chains in a part's local (keyframe) pixels: node 0 is sewn to the body; the rest follow their parent with springs
  // in world space, so the body's motion, the walk and the wind give lag, swing and flutter. Output per frame: each
  // node's displacement from its rest place, in local pixels; mesh vertices take the weighted displacement of the
  // nodes near them.
  const CH1 = [
    { p: [[636, 1140], [700, 1186], [770, 1232], [826, 1272]], k: 1.0 },
    { p: [[646, 1250], [712, 1316], [776, 1376], [818, 1420]], k: 0.95 },
    { p: [[656, 1370], [716, 1430], [772, 1486], [826, 1560]], k: 0.9 },
    { p: [[662, 1480], [716, 1548], [762, 1610], [806, 1666]], k: 0.9 },
    { p: [[656, 1590], [694, 1640], [726, 1690], [750, 1720]], k: 0.85 },
    { p: [[598, 780], [634, 812], [664, 842]], k: 1.1 },
    { p: [[600, 860], [640, 888], [678, 906]], k: 1.1 },
    { p: [[470, 1600], [462, 1680], [458, 1752]], k: 0.6, hem: 1 },
    { p: [[560, 1590], [566, 1660], [574, 1744]], k: 0.6, hem: 1 },
    { p: [[620, 1560], [636, 1640], [656, 1720]], k: 0.7, hem: 1 },
  ];
  const CH2 = [
    { p: [[690, 520], [800, 640], [920, 770], [1010, 846], [1080, 900]], k: 0.9, cape: 1 },
    { p: [[700, 660], [810, 760], [910, 860], [1000, 930], [1080, 975]], k: 0.85, cape: 1 },
    { p: [[700, 800], [790, 880], [860, 950], [930, 1020], [990, 1015]], k: 0.8, cape: 1 },
    { p: [[690, 950], [760, 1040], [820, 1160], [830, 1300]], k: 0.7, hem: 1 },
    { p: [[640, 1180], [700, 1300], [760, 1420], [790, 1480]], k: 0.7, hem: 1 },
    { p: [[560, 1250], [590, 1400], [620, 1560]], k: 0.65, hem: 1 },
    { p: [[470, 1230], [460, 1400], [440, 1580]], k: 0.65, hem: 1, front: 1 },
    { p: [[380, 1180], [330, 1330], [300, 1480], [300, 1540]], k: 0.7, hem: 1, front: 1 },
    { p: [[336, 1250], [260, 1262], [190, 1290], [116, 1326]], k: 1.0, flag: 1 },
    { p: [[330, 1330], [270, 1366], [222, 1396]], k: 0.9, flag: 1 },
    { p: [[612, 990], [618, 1110], [624, 1240], [632, 1360]], k: 0.75, strap: 1 },
    { p: [[505, 300], [528, 260], [544, 226]], k: 1.4, hood: 1 },
  ];
  function prepChains(CH) {
    const nodes = [];
    CH.forEach((c, ci) => c.p.forEach((q, i) => nodes.push({ ci, i, x: q[0], y: q[1], s: i / (c.p.length - 1), c })));
    return nodes;
  }
  // bind mesh vertices to nodes: Gaussian weights, normalised but faded where no chain is near
  function bindCloth(L, nodes, sigma) {
    const r = L.gl.rest, n = r.length / 2, K6 = 6;
    const ids = new Int16Array(n * K6).fill(-1), ws = new Float32Array(n * K6);
    for (let v = 0; v < n; v++) {
      const x = r[v * 2], y = r[v * 2 + 1], cand = [];
      for (let k = 0; k < nodes.length; k++) { const dx = x - nodes[k].x, dy = y - nodes[k].y, d2 = dx * dx + dy * dy; if (d2 < 9 * sigma * sigma) cand.push([d2, k]); }
      cand.sort((a, b) => a[0] - b[0]);
      let sw = 0;
      const top = cand.slice(0, K6).map(([d2, k]) => { const w = Math.exp(-d2 / (2 * sigma * sigma)); sw += w; return [k, w]; });
      const norm = 1 / Math.max(sw, 0.55);
      top.forEach(([k, w], q) => { ids[v * K6 + q] = k; ws[v * K6 + q] = w * norm; });
    }
    L.cloth = { ids, ws, K6 };
  }
  function simulate(CH, nodes, rigAt, t0, t1, opts) {
    // rigAt(t) -> { M: local->world affine, wind: [x, y] (px/s^2 scale), vel?: } ; returns per-frame displacements
    const f0 = Math.floor(t0 * FPS), f1 = Math.min(NF, Math.ceil(t1 * FPS));
    const out = new Float32Array((f1 - f0 + 1) * nodes.length * 2);
    const sub = 8, dt = 1 / (FPS * sub);
    const pos = new Float32Array(nodes.length * 2), vel = new Float32Array(nodes.length * 2);
    let rg = rigAt(t0);
    nodes.forEach((nd, k) => { const p = aap(rg.M, nd.x, nd.y); pos[k * 2] = p[0]; pos[k * 2 + 1] = p[1]; });
    if (opts && opts.init) opts.init(pos, vel, rg);
    const chainStart = [];
    let off = 0; CH.forEach((c) => { chainStart.push(off); off += c.p.length; });
    const record = (f) => {
      const t = f / FPS; rg = rigAt(t); const Mi = ainv(rg.M);
      nodes.forEach((nd, k) => { const q = aap(Mi, pos[k * 2], pos[k * 2 + 1]); out[((f - f0) * nodes.length + k) * 2] = q[0] - nd.x; out[((f - f0) * nodes.length + k) * 2 + 1] = q[1] - nd.y; });
    };
    record(f0);
    for (let f = f0; f < f1; f++) {
      for (let s = 0; s < sub; s++) {
        const t = (f + (s + 0.5) / sub) / FPS;
        rg = rigAt(t);
        CH.forEach((c, ci) => {
          const o = chainStart[ci], n = c.p.length;
          const r0 = aap(rg.M, c.p[0][0], c.p[0][1]);
          pos[o * 2] = r0[0]; pos[o * 2 + 1] = r0[1]; vel[o * 2] = 0; vel[o * 2 + 1] = 0;
          for (let i = 1; i < n; i++) {
            const k = o + i, nd = nodes[k];
            const dv = alin(rg.M, c.p[i][0] - c.p[i - 1][0], c.p[i][1] - c.p[i - 1][1]);
            const ab = aap(rg.M, c.p[i][0], c.p[i][1]);
            let tx = pos[(k - 1) * 2] + dv[0], ty = pos[(k - 1) * 2 + 1] + dv[1];
            tx = lerp(tx, ab[0], 0.25); ty = lerp(ty, ab[1], 0.25);
            if (rg.extra) { const e = rg.extra(c, nd, t); tx += e[0]; ty += e[1]; }
            const fr = 2.6 * c.k * (1.15 - 0.45 * nd.s), kk = (TAU * fr) * (TAU * fr), damp = 2 * 0.22 * TAU * fr;
            const wv = rg.wind(c, nd, t);
            const ax = kk * (tx - pos[k * 2]) - damp * vel[k * 2] + wv[0] - (rg.drag || 0) * (vel[k * 2] - rg.vx);
            const ay = kk * (ty - pos[k * 2 + 1]) - damp * vel[k * 2 + 1] + wv[1] - (rg.drag || 0) * (vel[k * 2 + 1] - rg.vy);
            vel[k * 2] += ax * dt; vel[k * 2 + 1] += ay * dt;
            pos[k * 2] += vel[k * 2] * dt; pos[k * 2 + 1] += vel[k * 2 + 1] * dt;
            // keep the segment's length (cloth does not stretch much)
            const px = pos[(k - 1) * 2], py = pos[(k - 1) * 2 + 1], ddx = pos[k * 2] - px, ddy = pos[k * 2 + 1] - py, dl = Math.hypot(ddx, ddy), L0 = Math.hypot(dv[0], dv[1]);
            if (dl > L0 * 1.06) { pos[k * 2] = px + ddx / dl * L0 * 1.06; pos[k * 2 + 1] = py + ddy / dl * L0 * 1.06; }
            else if (dl < L0 * 0.8) { pos[k * 2] = px + ddx / dl * L0 * 0.8; pos[k * 2 + 1] = py + ddy / dl * L0 * 0.8; }
          }
        });
      }
      record(f + 1);
    }
    return { f0, f1, n: nodes.length, out };
  }
  function clothAt(S, t, fade) {
    const n = S.n, res = new Float32Array(n * 2);
    if (!S || t * FPS < S.f0) return res;
    const f = clamp(t * FPS, S.f0, S.f1), i = Math.floor(f), j = Math.min(i + 1, S.f1), u = f - i;
    for (let k = 0; k < n * 2; k++) res[k] = lerp(S.out[(i - S.f0) * n * 2 + k], S.out[(j - S.f0) * n * 2 + k], u) * fade;
    return res;
  }
  function clothDisp(L, disp, v) {
    const C = L.cloth, b = v * C.K6; let dx = 0, dy = 0;
    for (let q = 0; q < C.K6; q++) { const k = C.ids[b + q]; if (k < 0) break; dx += disp[k * 2] * C.ws[b + q]; dy += disp[k * 2 + 1] * C.ws[b + q]; }
    return [dx, dy];
  }

  /* ================================================================ the wind */
  // gusts: a rising wind from 1.0 s, fluctuating; strongest in the open field and the flowers; calm at the end
  const windStrength = (t) => E(t, 1.0, 2.2) * (1 - 0.35 * E(t, 3.0, 4.0)) * (1 + 0.4 * bump(t, 7.5, 11.5)) * (1 - E(t, 12.8, 15.0));
  function windVec(t, x, y, seed) {
    const g = windStrength(t);
    const n1 = vn(t * 1.1 + x * 0.002, 1.3, 91 + seed), n2 = sn(t * 6.3 + x * 0.01, y * 0.01, 17 + seed);
    return [g * (0.7 + 0.6 * n1) + g * 0.35 * n2, g * 0.3 * sn(t * 4.1, x * 0.02 + y * 0.02, 5 + seed)];
  }

  /* ================================================================ the rig */
  // ---- puppet 1: the first keyframe's reaper (local = keyframe-1 pixels = the world at the start)
  function rig1(t) {
    const ant = bump(t, T_ANT[0], T_ANT[1] + 0.25) * (1 - E(t, T_LIFT[0] + 0.15, T_LIFT[1]));
    const sink = 7 * ant;
    // the turn: the whole figure narrows as it rotates away
    const tu = E3(t, T_TURN[0] + 0.14, T_SWAP + 0.04);
    const sx = 1 - 0.4 * tu;
    let M = amul(atr(540, 1800), amul(asc(sx, 1 - 0.006 * ant), atr(-540, -1800)));
    M = amul(atr(-28 * tu, sink), M);
    // he lifts his head (a little overshoot, a settle), then it leads the turn toward the left
    const headUp = backOut(R(t, T_HEAD[0], T_HEAD[1]), 0.9) * (1 - 0.35 * E(t, T_TURN[0], T_SWAP));
    const ht = E3(t, T_TURN[0], T_SWAP);
    const head = { ang: 11 * DEG * headUp - 4 * DEG * ht, dy: -14 * headUp, sx: 1 - 0.5 * ht, dx: -26 * ht };
    return { M, head };
  }
  function scythe1(t) {
    // rotation about the hidden grip, clockwise raises the blade off the ground
    const ant = bump(t, T_ANT[0], T_ANT[1] + 0.22);
    const lift = backOut(R(t, T_LIFT[0], T_LIFT[1]), 1.1);
    let th = -2.5 * DEG * ant * (1 - R(t, T_LIFT[0], T_LIFT[0] + 0.1)) + 11 * DEG * lift;
    let G = [G1.grip[0], G1.grip[1] - 30 * lift + 6 * ant];
    return { G, th };
  }

  // ---- puppet 2: the last keyframe's reaper (local = keyframe-2 pixels)
  function M2at(t) {
    const wk = walker(t);
    const desc = clamp((XB - wk.x) / 700, 0, 1);
    const lean = ROT_END * s3(desc) * (1 - 0) + 1.2 * DEG * Math.sin(Math.PI * wk.phi * 2 + 0.6) * wk.sp;
    // the turn: the profile widens out of the narrowed front view
    const tu = backOut(R(t, T_SWAP - 0.03, T_TURN[1]), 1.2);
    const sx = lerp(0.62, 1, tu);
    // the big swing: he sinks into the wind-up and rises through the blow
    const dip = 13 * bump(t, T_SWA[0], T_SW[0] + 0.08) - 7 * bump(t, T_SW[0] + 0.05, T_SWS[0] + 0.3);
    const tilt = -1.6 * DEG * bump(t, T_SWA[0], T_SW[0] + 0.08) + 1.2 * DEG * bump(t, T_SW[0], T_SWS[0] + 0.4);
    let M = amul(atr(wk.x, wk.y + dip), amul(arot(lean + tilt), amul(asc(K2 * sx, K2), atr(-G2.ref[0], -G2.ref[1]))));
    return { M, wk, lean };
  }
  // the final rest transform (keyframe-2 pixels -> world): everything of the last frame is placed with it
  function Mend() { const wk = walker(D); return amul(atr(wk.x, gnd(wk.x)), amul(arot(ROT_END), amul(asc(K2), atr(-G2.ref[0], -G2.ref[1])))); }

  // the staff and the arm: a planted staff the walker pulls out of the ground at the brink, then walks with
  const ARM_V = [G2.hand[0] - G2.shoulder[0], G2.hand[1] - G2.shoulder[1]];
  const ARM_L = Math.hypot(ARM_V[0], ARM_V[1]) * K2;
  const STAFF_L = Math.hypot(G2.staff[1][0] - G2.hand[0], G2.staff[1][1] - G2.hand[1]) * K2;
  const STAFF_A0 = angOf(G2.staff[1][0] - G2.hand[0], G2.staff[1][1] - G2.hand[1]);     // rest direction (local)
  const ARM_A0 = angOf(ARM_V[0], ARM_V[1]);
  function shoulderW(t) { const m = M2at(t); return { S: aap(m.M, G2.shoulder[0], G2.shoulder[1]), m }; }
  // two-circle IK: the hand on a circle round the shoulder, at staff length from the tip
  function ikHand(S, T) {
    const dx = T[0] - S[0], dy = T[1] - S[1], d = Math.hypot(dx, dy);
    const a = ARM_L, b = STAFF_L;
    if (d >= a + b - 0.5) return [S[0] + dx / d * a, S[1] + dy / d * a];
    const x = (d * d + a * a - b * b) / (2 * d), h = Math.sqrt(Math.max(0, a * a - x * x));
    const ux = dx / d, uy = dy / d;
    // the branch with the hand in front of / below the line shoulder->tip (as in the keyframe)
    return [S[0] + ux * x + uy * h, S[1] + uy * x - ux * h];
  }
  function buildStaffPlan() {
    // the last plant is the keyframe's own staff tip; earlier plants keep the same relation to the walker
    const Me = Mend(), tipEnd = aap(Me, G2.staff[1][0], G2.staff[1][1]), wkE = walker(D);
    const ahead = wkE.x - tipEnd[0];
    const plants = [];
    for (let p = NSTEPS - 1; p > 0; p -= 2) plants.unshift(p);
    // when each plant's phase is reached
    const tOf = (phi) => { let lo = T_WALK, hi = D; for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (walker(m).phi < phi) lo = m; else hi = m; } return (lo + hi) / 2; };
    const P = plants.map((ph) => { const t = tOf(ph); const x = walker(t).x - ahead; return { ph, t, tip: [x, gnd(x) + 6] }; });
    P[P.length - 1].tip = tipEnd;
    // the grab: the near hand reaches forward and up to where the staff stands
    const g = shoulderW(T_GRAB), aR = 34 * DEG;
    const armDir = ARM_A0 + g.m.lean + aR;
    const Hg = [g.S[0] + Math.cos(armDir) * ARM_L, g.S[1] + Math.sin(armDir) * ARM_L];
    // lean of the planted staff so that its foot is in the ground (sunk 26 px)
    let lo = 92 * DEG, hi = 150 * DEG;
    for (let i = 0; i < 50; i++) {
      const m = (lo + hi) / 2, tx = Hg[0] + Math.cos(m) * STAFF_L, ty = Hg[1] + Math.sin(m) * STAFF_L;
      if (ty > gnd(tx) + 26) lo = m; else hi = m;
    }
    const psi0 = (lo + hi) / 2;
    const first = P.findIndex((q) => q.t > T_GRAB + 0.55);
    K.staff = { P: P.slice(first), Hg, psi0, aR, tipEnd };
  }
  // world pose of arm & staff at t: { alpha (arm rotation, local), H (hand world), psi (staff world angle), held }
  function armStaff(t) {
    const r = armStaff0(t), fb = E(t, 14.5, 15.25);
    if (fb <= 0 || !r.held) return r;
    // settle exactly into the last frame's arm and staff
    const m = M2at(t), Hr = aap(m.M, G2.hand[0], G2.hand[1]);
    return Object.assign({}, r, { alpha: lerp(r.alpha, 0, fb), H: [lerp(r.H[0], Hr[0], fb), lerp(r.H[1], Hr[1], fb)], psi: lerp(r.psi, STAFF_A0 + m.lean, fb) });
  }
  function armStaff0(t) {
    const st = K.staff, sh = shoulderW(t), S = sh.S, lean = sh.m.lean, wk = sh.m.wk;
    const restDir = ARM_A0 + lean;
    const handFromAlpha = (al) => [S[0] + Math.cos(restDir + al) * ARM_L, S[1] + Math.sin(restDir + al) * ARM_L];
    const alphaFromHand = (Hh) => { let a = angOf(Hh[0] - S[0], Hh[1] - S[1]) - restDir; while (a > Math.PI) a -= TAU; while (a < -Math.PI) a += TAU; return a; };
    const freeSwing = 9 * DEG * Math.sin(Math.PI * wk.phi + 0.9) * wk.sp;
    if (t < T_GRAB) {
      // before the grab: the arm swings free, then reaches for the staff
      const reach = E(t, T_GRAB - 0.62, T_GRAB);
      const al = lerp(freeSwing, st.aR, reach);
      const Hh = handFromAlpha(al);
      return { alpha: al, H: Hh, psi: st.psi0, planted: true, held: false, tipW: [st.Hg[0] + Math.cos(st.psi0) * STAFF_L, st.Hg[1] + Math.sin(st.psi0) * STAFF_L], staffH: st.Hg };
    }
    // after: plant / swing cycle, keyed on the plants
    const P = st.P;
    const poseAt = (tt, tip) => { const s2 = shoulderW(tt).S; const Hh = ikHand(s2, tip); return { Hh, psi: angOf(tip[0] - Hh[0], tip[1] - Hh[1]) }; };
    // segment: from the grab to the first plant (pull out & swing), or between plants
    let k = P.findIndex((q) => q.t > t);
    if (k === -1) k = P.length;                // after the last plant: stay planted on it
    const prev = k === 0 ? null : P[k - 1];
    const liftT = prev ? lerp(prev.t, k < P.length ? P[k].t : D, 0.62) : T_GRAB;
    if (prev && (t <= liftT || k === P.length)) {
      const ps = poseAt(t, prev.tip);
      return { alpha: alphaFromHand(ps.Hh), H: ps.Hh, psi: ps.psi, held: true, planted: true };
    }
    // in the air: from the lift pose (or the grab) to the next plant's pose
    const nx = P[k];
    let aA, psiA, tA;
    if (prev) { const ps = poseAt(liftT, prev.tip); aA = alphaFromHand(ps.Hh) - shoulderW(liftT).m.lean + lean; psiA = ps.psi; tA = liftT; }
    else { aA = st.aR; psiA = st.psi0; tA = T_GRAB; }
    const pb = poseAt(nx.t, nx.tip);
    const aB = alphaFromHand(pb.Hh) - shoulderW(nx.t).m.lean + lean, psiB = pb.psi;
    const u = R(t, tA, nx.t), e = s3(u);
    // the swing: the arm comes forward; the staff's foot lifts and swings ahead
    let al = lerp(aA, aB, e) + (prev ? -6 * DEG : -12 * DEG) * Math.sin(Math.PI * u);
    const Hh = handFromAlpha(al);
    let psi = lerp(psiA, psiB, s3(clamp(u * 1.15, 0, 1))) + 14 * DEG * Math.sin(Math.PI * u) * (prev ? 1 : 1.4);
    if (!prev) psi += 0;
    return { alpha: al, H: Hh, psi, held: true, planted: false, pullOut: !prev ? u : 1 };
  }
  // the scythe: one object across the film — keyframe 1's scythe until the big swing, keyframe 2's after it
  const DTH = (() => { const a = angOf(G1.shaftLow[G1.shaftLow.length - 1][0] - G1.grip[0], G1.shaftLow[G1.shaftLow.length - 1][1] - G1.grip[1]); const b = angOf(G2.snath[0][0] - G2.scyGrip[0], G2.snath[0][1] - G2.scyGrip[1]); return a - b; })();
  function scytheW(t) {
    // th: world rotation of keyframe 1's scythe about its grip; keyframe 2's scythe has rotation th - DTH
    const s1 = scythe1(t);
    if (t < T_SWAP) return { G: s1.G, th: s1.th, ph: 0 };
    const m = M2at(t);
    const thEnd = ROT_END + DTH;            // where keyframe 2's scythe lies at rest
    const carry = s1.th + 2.2 * DEG * Math.sin(Math.PI * m.wk.phi * 2 + 1.1) * m.wk.sp;
    const a = E3(t, T_SWA[0], T_SWA[1]);
    let th = carry - 13 * DEG * a;
    const u = R(t, T_SW[0], T_SW[1]);
    // the swing: fast in the middle, overshoot, settle on the shoulder (damped)
    const sw = u <= 0 ? 0 : (u < 1 ? (1 - Math.cos(Math.PI * Math.pow(u, 0.85))) / 2 : 1);
    th = lerp(th, thEnd + 11 * DEG, sw);
    if (t > T_SW[1]) { const v = (t - T_SW[1]); th = thEnd + 11 * DEG * Math.exp(-v * 4.2) * Math.cos(v * 9.5); }
    th += (t > T_SWS[1] ? 1 : 0) * 0;
    // after the swing: it rides the shoulder; at rest it is exactly keyframe 2's
    const gl1 = aap(m.M, 605, 680), gl2 = aap(m.M, G2.scyGrip[0], G2.scyGrip[1]);
    const G = [lerp(gl1[0], gl2[0], E(t, T_SW[0], T_SWS[1])), lerp(gl1[1], gl2[1], E(t, T_SW[0], T_SWS[1]))];
    // the lift's world grip until the turn hands him over
    const hand = E(t, T_SWAP, T_TURN[1]);
    const G0 = [lerp(s1.G[0], G[0], hand), lerp(s1.G[1], G[1], hand)];
    // keyframe 2's scythe rests with the puppet's lean; while walking add the puppet's lean to the carry too
    const restFix = t > T_SW[1] ? (m.lean - ROT_END) : 0;
    return { G: G0, th: th + restFix, ph: sw };
  }

  /* ================================================================ build */
  async function build(img1, img2) {
    const t0 = performance.now();
    const a = fit(img1), b = fit(img2);
    K.fit1 = a.f; K.fit2 = b.f; K.c1 = a.c; K.c2 = b.c;
    K.d1 = dataOf(K.c1).data; K.d2 = dataOf(K.c2).data;
    segment1();
    segment2();
    buildSprites();
    buildWalk();
    buildCamFollow();
    buildStaffPlan();
    buildTerrain(); buildGrass(); buildField();
    glInit();
    glPart(K.body1, 14); glPart(K.scy1L, 24);
    glPart(K.body2, 16); glPart(K.arm2, 12); glPart(K.staff2, 14); glPart(K.scy2L, 20); glPart(K.butt2, 40);
    // skin: the hood follows the neck
    K.headW1 = softPoly([G1.head], 18); K.headW2 = softPoly([G2.hood], 22);
    const sk = (L, F) => { const r = L.gl.rest, n = r.length / 2, w = new Float32Array(n); for (let i = 0; i < n; i++) { const x = clamp(Math.round(r[i * 2]), 0, W - 1), y = clamp(Math.round(r[i * 2 + 1]), 0, H - 1); w[i] = F[y * W + x]; } L.skin = w; };
    sk(K.body1, K.headW1); sk(K.body2, K.headW2);
    // cloth
    K.nodes1 = prepChains(CH1); K.nodes2 = prepChains(CH2);
    bindCloth(K.body1, K.nodes1, 34); bindCloth(K.body2, K.nodes2, 44);
    K.sim1 = simulate(CH1, K.nodes1, (t) => {
      const r = rig1(t);
      return { M: r.M, vx: 0, vy: 0, wind: (c, nd, tt) => { const w = windVec(tt, nd.x, nd.y, nd.ci); const e = (c.hem ? 0.35 : 1) * (0.35 + 0.65 * nd.s); return [w[0] * 11000 * e, (w[1] * 5000 - 2600 * windStrength(tt) * nd.s) * e]; } };
    }, TA, T_SWAP + 0.2);
    K.sim2 = simulate(CH2, K.nodes2, (t) => {
      const m = M2at(t), m2 = M2at(t + 0.01), vx = (m2.wk.x - m.wk.x) / 0.01, vy = (m2.wk.y - m.wk.y) / 0.01;
      const fadeW = 1 - E(t, 13.6, 15.0);
      return {
        M: m.M, vx, vy, drag: 1.6,
        wind: (c, nd, tt) => {
          const w = windVec(tt, nd.x * 0.8, nd.y, nd.ci + 20); const e = (c.cape ? 1.1 : c.flag ? 1.0 : c.hem ? 0.55 : 0.6) * (0.3 + 0.7 * nd.s);
          return [w[0] * 2200 * e * fadeW, w[1] * 1200 * e * fadeW];
        },
        extra: (c, nd, tt) => {
          // the walking legs push the hem forward and back
          if (!c.hem) return [0, 0];
          const wk = walker(tt), sw = Math.sin(Math.PI * wk.phi) * wk.sp;
          return [-(c.front ? 26 : 16) * sw * nd.s, 0];
        },
      };
    }, T_SWAP, D, {
      init: (pos, vel, rg) => {
        // the turn flings the cloth: the nodes start swept round to the front, and fly back
        for (let k = 0; k < K.nodes2.length; k++) { const nd = K.nodes2[k]; if (nd.i === 0) continue; vel[k * 2] = -420 * nd.s; vel[k * 2 + 1] = -60 * nd.s; pos[k * 2] -= 60 * nd.s; }
      },
    });
    K.buildMs = performance.now() - t0;
    K.built = true;
  }

  /* ================================================================ drawing: the world */
  function skyColors(t) {
    const warm = E(t, 3.6, 7.2), deep = E(t, 6.8, 11.5);
    const top = mixc(mixc([162, 152, 114], [205, 158, 92], warm), [211, 131, 41], deep);
    const hor = mixc(mixc([188, 175, 132], [236, 186, 104], warm), [240, 150, 42], deep);
    return { top, hor, warm, deep };
  }
  function drawSky(g, t, cam) {
    const sc = skyColors(t);
    g.setTransform(1, 0, 0, 1, 0, 0);
    // rows of the first keyframe, blended toward the evening (screen space: the sky is at infinity)
    const gr = g.createLinearGradient(0, -200, 0, H + 200);
    gr.addColorStop(0, rgba(sc.top)); gr.addColorStop(0.55, rgba(mixc(sc.top, sc.hor, 0.55))); gr.addColorStop(1, rgba(sc.hor));
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    // the sun and its glow (far away, slow parallax)
    const s = sunState(t, cam);
    if (s.vis > 0) {
      g.save();
      const rg = g.createRadialGradient(s.x, s.y, 0, s.x, s.y, 900);
      rg.addColorStop(0, `rgba(255,214,140,${(0.55 * s.vis).toFixed(3)})`); rg.addColorStop(0.25, `rgba(250,170,80,${(0.28 * s.vis).toFixed(3)})`); rg.addColorStop(1, 'rgba(240,150,60,0)');
      g.fillStyle = rg; g.fillRect(0, 0, W, H);
      g.fillStyle = `rgba(255,236,190,${(0.95 * s.vis).toFixed(3)})`;
      g.beginPath(); g.arc(s.x, s.y, s.r, 0, TAU); g.fill();
      g.strokeStyle = `rgba(150,70,30,${(0.35 * s.vis).toFixed(3)})`; g.lineWidth = 1.5; g.stroke();
      g.restore();
    }
  }
  function sunState(t, cam) {
    const A = camAff(cam, 0.1);
    const set = E(t, 9.4, 12.2);
    const p = aap(A, 180, 1120 + 560 * set);
    return { x: p[0], y: p[1], r: 46 * Math.pow(cam.z, 0.1), vis: E(t, 4.2, 6.5), set };
  }
  // far hills: soft flat silhouettes with sparse ink, lit from behind
  function drawHills(g, t, cam) {
    const vis = E(t, 4.4, 7.0) * (1 - E(t, 13.2, 14.6));
    if (vis <= 0) return;
    const sc = skyColors(t);
    const layers = [
      { p: 0.16, y: 1440, amp: 70, col: mixc(sc.hor, [168, 104, 72], 0.34), seed: 3, f: 0.0016 },
      { p: 0.26, y: 1560, amp: 90, col: mixc(sc.hor, [132, 74, 50], 0.48), seed: 4, f: 0.0013 },
      { p: 0.42, y: 1760, amp: 80, col: mixc(sc.hor, [112, 52, 34], 0.58), seed: 5, f: 0.0011, flowers: 1 },
    ];
    g.save();
    for (const L of layers) {
      const A = camAff(cam, L.p);
      g.setTransform(A[0], A[1], A[2], A[3], A[4], A[5]);
      const Ai = ainv(A), x0 = aap(Ai, -300, 960)[0] - 400, x1 = aap(Ai, W + 300, 960)[0] + 400;
      const yb = aap(Ai, 540, H + 400)[1] + 2000;
      const hy = (x) => L.y - L.amp * (0.6 * vn(x * L.f, 0.5, L.seed) + 0.4 * vn(x * L.f * 3.1, 2.5, L.seed)) - 40 * Math.sin(x * 0.0006 + L.seed);
      g.beginPath(); g.moveTo(x0, yb);
      for (let x = x0; x <= x1; x += 24) g.lineTo(x, hy(x));
      g.lineTo(x1, yb); g.closePath();
      g.globalAlpha = vis; g.fillStyle = rgba(L.col); g.fill();
      g.strokeStyle = `rgba(60,30,20,${(0.35).toFixed(2)})`; g.lineWidth = 1.6 / Math.pow(cam.z, L.p); g.beginPath();
      for (let x = x0; x <= x1; x += 24) (x === x0 ? g.moveTo(x, hy(x)) : g.lineTo(x, hy(x))); g.stroke();
      if (L.flowers) {
        // a haze of red flowers over the near hill
        const rnd = mulberry32(9);
        g.fillStyle = `rgba(214,58,32,${(0.55 * E(t, 6, 8.5)).toFixed(3)})`;
        for (let i = 0; i < 520; i++) { const x = -4600 + rnd() * 6000, y = hy(x) + 6 + rnd() * 160, r = 3 + rnd() * 5; if (x < x0 || x > x1) continue; g.beginPath(); g.ellipse(x, y, r * 1.4, r, 0, 0, TAU); g.fill(); }
      }
    }
    g.restore();
    g.globalAlpha = 1;
  }

  // the terrain he walks on: pre-rendered into one large world-space canvas
  const TX0 = -4400, TX1 = 1900, TY0 = 1640, TY1 = 3700;
  function buildTerrain() {
    const w = TX1 - TX0, h = TY1 - TY0, c = mk(w, h), g = c.getContext('2d');
    // 1) the first keyframe's ground band, extended left by mirroring and bent down the slope
    const band = mk(W, 1920 - 1752), bg = band.getContext('2d');
    bg.drawImage(K.plate1, 0, 1752, W, 1920 - 1752, 0, 0, W, 1920 - 1752);
    // knock out the sky above the tufts
    {
      const id = bg.getImageData(0, 0, W, 1920 - 1752), a = id.data;
      for (let y = 0; y < 1920 - 1752; y++) for (let x = 0; x < W; x++) {
        const o = (y * W + x) * 4, yy = y + 1752;
        if (yy >= 1797) continue;
        const sr = K.sky1[yy * 3], sg = K.sky1[yy * 3 + 1], sb = K.sky1[yy * 3 + 2];
        const dl = 0.299 * (a[o] - sr) + 0.587 * (a[o + 1] - sg) + 0.114 * (a[o + 2] - sb);
        const al = yy > 1792 ? 1 : clamp(-dl / 70, 0, 1);
        if (al < 0.02) { a[o + 3] = 0; continue; }
        a[o] = clamp((a[o] - (1 - al) * sr) / al, 0, 255); a[o + 1] = clamp((a[o + 1] - (1 - al) * sg) / al, 0, 255); a[o + 2] = clamp((a[o + 2] - (1 - al) * sb) / al, 0, 255); a[o + 3] = 255 * al;
      }
      bg.putImageData(id, 0, 0);
    }
    const bandM = mk(W, band.height), bmg = bandM.getContext('2d'); bmg.translate(W, 0); bmg.scale(-1, 1); bmg.drawImage(band, 0, 0);
    // columns: copy band columns down along g(x)
    const colSrc = (x) => { let m = ((x % (2 * W)) + 2 * W) % (2 * W); return m < W ? [band, m] : [bandM, m - W]; };
    for (let x = TX0; x < TX1; x += 2) {
      const yb = gnd(x), beta = s3(clamp((XB + 150 - x) / 1100, 0, 1));
      if (beta >= 1) continue;
      const [src, sx] = colSrc(x);
      g.globalAlpha = 1 - beta;
      g.drawImage(src, sx, 0, 2, src.height, x - TX0, yb - 48 - TY0, 2, src.height);
      // below the band: earth, darkening
      g.fillStyle = `rgba(214,190,140,1)`; g.fillRect(x - TX0, yb - 48 + src.height - TY0 - 1, 2, 120);
      const gr = g.createLinearGradient(0, yb + 72 - TY0, 0, yb + 900 - TY0); gr.addColorStop(0, 'rgb(214,190,140)'); gr.addColorStop(1, 'rgb(150,112,70)');
      g.fillStyle = gr; g.fillRect(x - TX0, yb + 70 - TY0, 2, 1400);
    }
    g.globalAlpha = 1;
    {   // the first keyframe's ground is hatched with loose horizontal ink dashes; carry them on through the earth
      const rnd0 = mulberry32(13);
      g.lineCap = 'round';
      for (let i = 0; i < 9000; i++) {
        const x = TX0 + rnd0() * (TX1 - TX0), beta = s3(clamp((XB + 150 - x) / 1100, 0, 1));
        if (beta > 0.95 || (x > -10 && x < 1090 && rnd0() < 0.85)) continue;
        const yy = gnd(x) + 70 + Math.pow(rnd0(), 1.4) * 1500, len = 14 + rnd0() * 46, sl = gslope(x) * 0.6 + (rnd0() - 0.5) * 0.12;
        g.strokeStyle = `rgba(${rnd0() < 0.7 ? '96,80,58' : '240,222,180'},${((0.35 + 0.4 * rnd0()) * (1 - beta)).toFixed(2)})`;
        g.lineWidth = 0.8 + rnd0() * 1.2;
        g.beginPath(); g.moveTo(x - TX0, yy - TY0); g.lineTo(x - TX0 + len, yy - TY0 + sl * len + (rnd0() - 0.5) * 3); g.stroke();
      }
    }
    // 2) the hillside of the last keyframe: golden grass, ink blades, rocks — fading in down the slope
    const hill = mk(w, h), hg = hill.getContext('2d');
    hg.beginPath(); hg.moveTo(0, h);
    for (let x = TX0; x <= TX1; x += 8) hg.lineTo(x - TX0, gnd(x) - TY0 + 4);
    hg.lineTo(w, h); hg.closePath();
    const gr2 = hg.createLinearGradient(0, 0, 0, h); gr2.addColorStop(0, 'rgb(196,124,46)'); gr2.addColorStop(0.5, 'rgb(170,104,40)'); gr2.addColorStop(1, 'rgb(120,74,32)');
    hg.fillStyle = gr2; hg.fill();
    hg.save(); hg.clip();
    const rnd = mulberry32(31);
    // rocks deeper down
    for (let i = 0; i < 170; i++) {
      const x = TX0 + rnd() * (TX1 - TX0), yy = gnd(x) + 260 + Math.pow(rnd(), 0.7) * 1400, r = 24 + rnd() * 50;
      hg.fillStyle = rnd() < 0.5 ? 'rgb(146,94,42)' : 'rgb(126,80,36)';
      hg.beginPath();
      for (let p = 0; p < 7; p++) { const an = p / 7 * TAU + rnd() * 0.5, rr = r * (0.7 + 0.4 * rnd()); hg.lineTo(x - TX0 + Math.cos(an) * rr * 1.4, yy - TY0 + Math.sin(an) * rr * 0.7); }
      hg.closePath(); hg.fill(); hg.strokeStyle = 'rgba(50,30,14,0.8)'; hg.lineWidth = 1.6; hg.stroke();
      hg.strokeStyle = 'rgba(60,36,16,0.5)'; hg.lineWidth = 1; hg.beginPath(); hg.moveTo(x - TX0 - r * 0.6, yy - TY0); hg.lineTo(x - TX0 + r * 0.4, yy - TY0 + r * 0.2); hg.stroke();
    }
    // grass blades: thin ink and gold strokes leaning with the slope
    for (let i = 0; i < 52000; i++) {
      const x = TX0 + rnd() * (TX1 - TX0), depth = Math.pow(rnd(), 1.8) * 1300, yy = gnd(x) + depth + 6;
      const len = (60 - 30 * depth / 1300) * (0.6 + rnd()), ang = -Math.PI / 2 + 0.55 + (rnd() - 0.5) * 0.7 + Math.atan(gslope(x)) * 0.5;
      hg.strokeStyle = rnd() < 0.55 ? `rgba(70,40,14,${(0.5 + 0.4 * rnd()).toFixed(2)})` : `rgba(232,170,80,${(0.4 + 0.5 * rnd()).toFixed(2)})`;
      hg.lineWidth = 0.7 + rnd() * 1.1;
      hg.beginPath(); hg.moveTo(x - TX0, yy - TY0); hg.quadraticCurveTo(x - TX0 + Math.cos(ang) * len * 0.5 - 3, yy - TY0 + Math.sin(ang) * len * 0.5, x - TX0 + Math.cos(ang) * len, yy - TY0 + Math.sin(ang) * len); hg.stroke();
    }
    hg.restore();
    // fade the hill in from the brink
    const fm = mk(w, h), fg = fm.getContext('2d'), lgx = fg.createLinearGradient(XB + 150 - TX0, 0, XB - 950 - TX0, 0);
    lgx.addColorStop(0, 'rgba(0,0,0,0)'); lgx.addColorStop(1, 'rgba(0,0,0,1)'); fg.fillStyle = lgx; fg.fillRect(0, 0, w, h);
    hg.globalCompositeOperation = 'destination-in'; hg.drawImage(fm, 0, 0); hg.globalCompositeOperation = 'source-over';
    g.drawImage(hill, 0, 0);
    // tall dry grass along the crest of the hillside (static; the swaying tips are drawn live)
    K.ter = c;
  }
  function drawTerrain(g, t, cam) {
    const A = camAff(cam, 1);
    g.setTransform(A[0], A[1], A[2], A[3], A[4], A[5]);
    g.drawImage(K.ter, TX0, TY0);
  }
  // live grass tufts on the crest line (sway in the wind)
  function buildGrass() {
    const rnd = mulberry32(55), G = [];
    for (let x = TX0 + 40; x < TX1 - 40; x += 5 + rnd() * 7) {
      const beta = s3(clamp((XB + 150 - x) / 1100, 0, 1));
      if (x > -80 && x < 1100) continue;                       // the first keyframe's own tufts are in the band
      const n = 1 + Math.floor(rnd() * (2 + beta * 3));
      for (let q = 0; q < n; q++) G.push({ x: x + rnd() * 6, len: (14 + rnd() * 22) * (1 - beta) + (40 + rnd() * 110) * beta, lean: (rnd() - 0.5) * 0.6, beta, ph: rnd() * TAU, wd: 0.8 + rnd() * 1.2, dep: rnd() * 18 * (1 + beta * 3), ink: rnd() < 0.5 });
    }
    K.grass = G;
  }
  function drawGrass(g, t, cam, front) {
    const A = camAff(cam, 1), Ai = ainv(A);
    const xl = Math.min(aap(Ai, 0, 0)[0], aap(Ai, 0, H)[0]) - 120, xr = Math.max(aap(Ai, W, 0)[0], aap(Ai, W, H)[0]) + 120;
    g.setTransform(A[0], A[1], A[2], A[3], A[4], A[5]);
    g.lineCap = 'round';
    const fadeG = 1 - E(t, 13.3, 14.5);
    if (fadeG <= 0) return;
    g.globalAlpha = fadeG;
    for (const b of K.grass) {
      if (b.x < xl || b.x > xr) continue;
      if (front !== (b.dep > 14)) continue;
      const y0 = gnd(b.x) + b.dep, w = windVec(t, b.x, y0, 2);
      const bend = b.lean + 0.9 * w[0] * (0.6 + 0.4 * Math.sin(t * 5 + b.ph)) + 0.05 * Math.sin(t * 2 + b.ph);
      const tx = b.x + Math.sin(bend) * b.len, ty = y0 - Math.cos(bend) * b.len;
      const col = b.beta < 0.5 ? (b.ink ? 'rgba(52,46,36,0.9)' : 'rgba(120,104,70,0.9)') : (b.ink ? 'rgba(80,46,16,0.9)' : 'rgba(226,160,72,0.95)');
      g.strokeStyle = col; g.lineWidth = b.wd;
      g.beginPath(); g.moveTo(b.x, y0); g.quadraticCurveTo(b.x + Math.sin(bend * 0.4) * b.len * 0.5, y0 - b.len * 0.55, tx, ty); g.stroke();
    }
    g.globalAlpha = 1;
  }

  // the field of red flowers (sprites from the last keyframe + procedural sprigs), swaying
  function buildField() {
    const rnd = mulberry32(123), F = [];
    for (let x = XB - 300; x > TX0 + 200; x -= 14 + rnd() * 26) {
      const dens = s3(clamp((XB - 300 - x) / 900, 0, 1));
      if (rnd() > 0.25 + 0.75 * dens) continue;
      const n = 1 + Math.floor(rnd() * 3 * dens);
      for (let q = 0; q < n; q++) {
        const front = rnd() < 0.42, k = Math.floor(rnd() * K.sprites.length);
        F.push({ x: x + rnd() * 30, dep: front ? 30 + rnd() * 160 : -4 - rnd() * 8, s: (front ? 0.85 : 0.55) * (0.6 + 0.6 * rnd()), k, ph: rnd() * TAU, flip: rnd() < 0.5, front });
      }
    }
    // a few at the brink, around the planted staff
    for (let i = 0; i < 7; i++) F.push({ x: XB - 60 - i * 34 - rnd() * 20, dep: -2 + rnd() * 30, s: 0.45 + rnd() * 0.25, k: Math.floor(rnd() * K.sprites.length), ph: rnd() * TAU, flip: rnd() < 0.5, front: rnd() < 0.5 });
    // keep the field out of the painted frame's area at the end (the painting brings its own flowers)
    const Me = Mend(), Mi = ainv(Me);
    K.field = F.filter((f) => { const q = aap(Mi, f.x, gnd(f.x) + f.dep); return !(q[0] > -60 && q[0] < W + 40 && q[1] > 200 && q[1] < H + 200); });
    K.fieldIn = F.filter((f) => !K.field.includes(f));
  }
  function drawField(g, t, cam, front, alphaIn) {
    const A = camAff(cam, 1), Ai = ainv(A);
    const xl = Math.min(aap(Ai, 0, 0)[0], aap(Ai, 0, H)[0]) - 300, xr = Math.max(aap(Ai, W, 0)[0], aap(Ai, W, H)[0]) + 300;
    const draw = (f, al) => {
      if (f.front !== front || f.x < xl || f.x > xr) return;
      const sp = K.sprites[f.k], y0 = gnd(f.x) + f.dep, w = windVec(t, f.x, y0, 7);
      const sway = 0.1 * w[0] + 0.05 * Math.sin(t * 2.1 + f.ph) * (0.4 + w[0]);
      const M = amul(A, amul(atr(f.x, y0), amul(arot(sway), amul(asc(f.flip ? -f.s : f.s, f.s), atr(-sp.bx, -sp.by)))));
      g.setTransform(M[0], M[1], M[2], M[3], M[4], M[5]);
      g.globalAlpha = al;
      g.drawImage(sp.c, 0, 0);
    };
    for (const f of K.field) draw(f, 1);
    if (alphaIn > 0) for (const f of K.fieldIn) draw(f, alphaIn);
    g.globalAlpha = 1;
  }

  /* ================================================================ drawing: the reaper */
  function grade2(t) {
    // in the flat khaki light the cloak reads black; the evening warms it and lights his edges
    const ev = E(t, 4.0, 9.0), late = E(t, 12.0, 14.8);
    const rimS = (E(t, 5.0, 7.5) * (1 - E(t, 11.0, 13.4))) * 0.75;
    const mul = mixc([0.92, 0.9, 0.82], [1.08, 0.98, 0.86], ev * (1 - late));
    return { desat: 0.25 * (1 - ev) * (1 - late), mul: mixc(mul, [1, 1, 1], late), add: [0, 0, 0], rim: rimS, rimCol: [1.0, 0.72, 0.36] };
  }
  function drawLegs(g, t, cam) {
    if (t < T_SWAP) return;
    const m = M2at(t), A = camAff(cam, 1);
    g.setTransform(A[0], A[1], A[2], A[3], A[4], A[5]);
    const al = E(t, T_SWAP - 0.02, T_SWAP + 0.1);
    g.globalAlpha = al;
    for (const j of [1, 0]) {
      const hip = aap(m.M, G2.hips[j][0], G2.hips[j][1]);
      const fs = footState(j, m.wk.phi);
      const ankle = [fs.x + 6, fs.y - 14];
      // knee: two-bone IK, bending forward (to the left)
      const L1 = 290 * K2, L2 = 300 * K2, dx = ankle[0] - hip[0], dy = ankle[1] - hip[1], dd = Math.min(Math.hypot(dx, dy), L1 + L2 - 1);
      const a = Math.acos(clamp((L1 * L1 + dd * dd - L2 * L2) / (2 * L1 * dd), -1, 1)), base = angOf(dx, dy);
      const kn = [hip[0] + Math.cos(base + a) * L1, hip[1] + Math.sin(base + a) * L1];
      const far = j === 1;
      g.strokeStyle = far ? 'rgb(14,16,16)' : 'rgb(24,28,28)'; g.lineCap = 'round'; g.lineJoin = 'round';
      g.lineWidth = 30; g.beginPath(); g.moveTo(hip[0], hip[1]); g.lineTo(kn[0], kn[1]); g.lineTo(ankle[0], ankle[1]); g.stroke();
      g.strokeStyle = far ? 'rgb(30,34,34)' : 'rgb(48,56,56)'; g.lineWidth = 18; g.beginPath(); g.moveTo(kn[0], kn[1]); g.lineTo(ankle[0] + 1, ankle[1] - 2); g.stroke();
      // the bony foot in its dark sandal, pointing forward (left)
      g.save(); g.translate(ankle[0], ankle[1]); g.rotate(fs.ang);
      g.fillStyle = far ? 'rgb(170,160,130)' : 'rgb(236,226,196)';
      g.beginPath(); g.moveTo(10, -10); g.quadraticCurveTo(-8, -12, -46, 4); g.lineTo(-50, 13); g.lineTo(12, 13); g.closePath(); g.fill();
      g.strokeStyle = 'rgb(20,20,18)'; g.lineWidth = 2.2; g.stroke();
      g.lineWidth = 1.3; for (let q = 0; q < 3; q++) { g.beginPath(); g.moveTo(-14 - q * 9, -4 + q * 2); g.lineTo(-30 - q * 6, 9); g.stroke(); }
      g.fillStyle = 'rgb(22,22,20)'; g.fillRect(-20, 9, 34, 6); g.fillRect(-4, -12, 8, 22);
      g.restore();
    }
    g.globalAlpha = 1;
  }
  function puppet(t, cam, mode) {
    const shadowPass = mode === 'shadow';
    const A = camAff(cam, 1);
    const flat = shadowPass ? shadowGrade(t) : null;
    if (shadowPass && !flat) return false;
    const SA = shadowPass ? shadowAff(t) : null;
    const X = (M) => amul(A, SA ? amul(SA, M) : M);
    const sc = scytheW(t);
    // the swap: the profile comes in on top over two frames, then the front view goes
    const a1 = t < T_SWAP + 0.1 ? 1 - E3(t, T_SWAP + 0.004, T_SWAP + 0.03) : 0;
    const a2 = t > T_SWAP - 0.02 ? E3(t, T_SWAP - 0.02, T_SWAP - 0.004) : 0;
    const gr = shadowPass ? flat : grade2(t);
    const grade1 = shadowPass ? flat : { desat: 0, mul: [1, 1, 1], add: [0, 0, 0] };
    // the scythe swap happens at the top of the swing, under motion blur
    const swap = E(t, T_SW[0] + 0.17, T_SW[0] + 0.27);
    const scy1 = (th, G, alpha) => { const M = amul(atr(G[0], G[1]), amul(arot(th), atr(-G1.grip[0], -G1.grip[1]))); placeVerts(K.scy1L, X(M)); glDraw(K.scy1L, Object.assign({}, gr, { alpha: alpha * (gr.alpha || 1) })); };
    const scy2 = (th, G, alpha, L) => { const M = amul(atr(G[0], G[1]), amul(arot(th - DTH), amul(asc(K2), atr(-G2.scyGrip[0], -G2.scyGrip[1])))); placeVerts(L || K.scy2L, X(M)); glDraw(L || K.scy2L, Object.assign({}, gr, { alpha: alpha * (gr.alpha || 1) })); };
    const scytheDraw = (behind) => {
      // motion blur in the fast part of the swing: sub-frames over a ~1/30 s shutter, accumulated additively into an
      // empty buffer (the scythe is always the first thing drawn in its pass), so the result is their true average
      const fast = bump(t, T_SW[0] - 0.08, T_SW[1] + 0.16);
      const nsub = fast > 0.02 ? 20 : 1;
      const gl = GL.gl;
      if (nsub > 1) gl.blendFunc(gl.ONE, gl.ONE);
      for (let q = 0; q < nsub; q++) {
        const tt = t - (nsub > 1 ? (q / (nsub - 1) - 0.5) * 0.034 * fast : 0), s = nsub > 1 ? scytheW(tt) : sc;
        const sw = E(tt, T_SW[0] + 0.17, T_SW[0] + 0.27);
        const wq = 1 / nsub;
        if (behind && sw < 1) scy1(s.th, s.G, wq * (1 - sw));
        if (behind && sw > 0) scy2(s.th, s.G, wq * sw, K.butt2);
        if (!behind && sw > 0) scy2(s.th, s.G, wq * sw);
      }
      if (nsub > 1) gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    };
    if (mode === 'front') { scytheDraw(false); return true; }
    if (a1 > 0) {
      const r = rig1(t), d1 = clothAt(K.sim1, t, 1);
      const hd = r.head, N = G1.neck, L = K.body1;
      const Rh = amul(atr(N[0] + hd.dx, N[1] + hd.dy), amul(arot(hd.ang), amul(asc(hd.sx, 1), atr(-N[0], -N[1]))));
      if (!shadowPass) scytheDraw(true);
      placeVerts(L, X(r.M), (x, y, i) => {
        const w = L.skin[i];
        let px = x, py = y;
        if (w > 0.001) { const q = aap(Rh, x, y); px = lerp(x, q[0], w); py = lerp(y, q[1], w); }
        const cd = clothDisp(L, d1, i);
        return [px + cd[0], py + cd[1]];
      });
      glDraw(L, Object.assign({}, grade1, { alpha: a1 * (grade1.alpha || 1), fade: shadowPass ? [700, 1800] : null }));
    }
    if (a2 > 0) {
      const m = M2at(t), as = armStaff(t), L = K.body2;
      const settle = 1 - E(t, 14.85, 15.3);
      const d2 = clothAt(K.sim2, t, settle);
      if (a1 <= 0 && !shadowPass) scytheDraw(true);
      // head: a little nod with the steps, looking up at the swing, down at the end
      const hAng = (2.2 * DEG * Math.sin(Math.PI * m.wk.phi * 2 - 0.6) * m.wk.sp - 5 * DEG * bump(t, T_SWA[0], T_SWS[0] + 0.3) + 3 * DEG * bump(t, 5.6, 6.6)) * settle;
      const N = G2.neck, Rh = arotAt(hAng, N[0], N[1]);
      const rim = Object.assign({}, gr, { alpha: a2 * (gr.alpha || 1), rimDir: [-3, 0.5], fade: shadowPass ? [300, 1640] : null });
      // the planted staff before he takes it: standing in the ground, in the world
      const staffM = () => {
        const psiRest = STAFF_A0;
        if (!as.held) { const Hs = as.staffH; return amul(atr(Hs[0], Hs[1]), amul(arot(as.psi - psiRest), amul(asc(K2), atr(-G2.hand[0], -G2.hand[1])))); }
        return amul(atr(as.H[0], as.H[1]), amul(arot(as.psi - psiRest), amul(asc(K2), atr(-G2.hand[0], -G2.hand[1]))));
      };
      if (!as.held && !shadowPass) { placeVerts(K.staff2, X(staffM())); glDraw(K.staff2, Object.assign({}, gr, { alpha: 1 })); }
      placeVerts(L, X(m.M), (x, y, i) => {
        const w = L.skin[i];
        let px = x, py = y;
        if (w > 0.001) { const q = aap(Rh, x, y); px = lerp(x, q[0], w); py = lerp(y, q[1], w); }
        const cd = clothDisp(L, d2, i);
        return [px + cd[0], py + cd[1]];
      });
      glDraw(L, rim);
      if (as.held) { placeVerts(K.staff2, X(staffM())); glDraw(K.staff2, Object.assign({}, rim, { rim: 0 })); }
      // the arm rotates about the shoulder (within the body's frame)
      const Ma = amul(m.M, arotAt(as.alpha, G2.shoulder[0], G2.shoulder[1]));
      placeVerts(K.arm2, X(Ma));
      glDraw(K.arm2, rim);

    }
    return true;
  }
  // the shadow: the low sun at the left throws him long across the ground to the right
  function shadowGrade(t) {
    const s = E(t, 4.6, 6.6) * (1 - E(t, 10.6, 12.4));
    if (s <= 0.01) return null;
    return { flat: 1, flatCol: [0.2, 0.1, 0.04], alpha: 0.38 * s };
  }
  function shadowAff(t) {
    const wk = walker(t), fx = wk.x, fy = gnd(fx), sl = gslope(fx);
    const k = 0.9 + 0.8 * E(t, 6, 11);      // the sun sinks: the shadow lengthens
    // (x, y) -> (fx + (x - fx) + k (fy - y), fy + 0.07 (fy - y) + sl * k (fy - y))
    return [1, 0, -k, -0.07 - sl * k, fx + k * fy, fy + 0.07 * fy + sl * k * fy];
  }

  /* ================================================================ particles: ink flecks, dust, petals */
  function drawFlecks(g, t, cam) {
    // ink torn off the robe by the wind (keyframe 1 had a few drifting off to the right already)
    if (t < 1.15 || t > 5.2) return;
    const A = camAff(cam, 1);
    g.setTransform(A[0], A[1], A[2], A[3], A[4], A[5]);
    const rnd = mulberry32(5);
    for (let i = 0; i < 70; i++) {
      const t0 = 1.15 + rnd() * 3.0, life = 1.2 + rnd() * 1.4, x0 = 640 + rnd() * 170, y0 = 1060 + rnd() * 650, sz = 1.5 + rnd() * 3.5, sp = rnd();
      if (t < t0 || t > t0 + life) continue;
      const u = t - t0, w = windStrength(t);
      const x = x0 + u * (240 + 260 * sp) * (0.6 + w) + 30 * Math.sin(u * 3 + i), y = y0 - u * 40 + 20 * Math.sin(u * 4.3 + i * 2) + u * u * 12;
      const al = Math.min(1, u * 5) * (1 - R(t, t0 + life - 0.4, t0 + life));
      g.fillStyle = `rgba(40,44,38,${al.toFixed(3)})`;
      g.save(); g.translate(x, y); g.rotate(u * (3 + sp * 6)); g.beginPath(); g.ellipse(0, 0, sz * 1.6, sz * 0.7, 0, 0, TAU); g.fill(); g.restore();
    }
  }
  function drawDust(g, t, cam) {
    // the blade leaving the ground, and footfalls on the plain
    const A = camAff(cam, 1);
    g.setTransform(A[0], A[1], A[2], A[3], A[4], A[5]);
    const puffs = [[T_LIFT[0] + 0.05, 300, 1748, 1.3]];
    for (let n = 1; n <= NSTEPS; n++) { const x = footX(n); puffs.push([null, x, gnd(x), 0.6, n]); }
    const rnd = mulberry32(19);
    for (const p of puffs) {
      let t0 = p[0];
      if (t0 === null) { const ph = p[4]; t0 = stepTime(ph); }
      if (t < t0 || t > t0 + 1.6) continue;
      const u = (t - t0) / 1.6, al = (1 - u) * 0.5 * p[3] * (p[4] ? (1 - E(t, 6.5, 8)) : 1);
      if (al <= 0.01) continue;
      for (let q = 0; q < 9; q++) {
        const ang = Math.PI + rnd() * Math.PI, r = (20 + 60 * rnd()) * Math.sqrt(u) * p[3] * 1.4;
        g.fillStyle = `rgba(214,192,140,${(al * (0.4 + 0.6 * rnd())).toFixed(3)})`;
        g.beginPath(); g.arc(p[1] + Math.cos(ang) * r * 1.6 + u * 60, p[2] + Math.sin(ang) * r * 0.5 - 6, (6 + 10 * rnd()) * (0.5 + u) * p[3], 0, TAU); g.fill();
      }
    }
  }
  function stepTime(ph) { let lo = T_WALK, hi = D; for (let i = 0; i < 30; i++) { const m = (lo + hi) / 2; if (walker(m).phi < ph) lo = m; else hi = m; } return (lo + hi) / 2; }
  function drawPetals(g, t, cam) {
    // red petals torn off the field, blowing across (the wind is behind him, to the right)
    const vis = E(t, 7.0, 8.4) * (1 - E(t, 13.8, 15.1));
    if (vis <= 0) return;
    g.setTransform(1, 0, 0, 1, 0, 0);
    const rnd = mulberry32(201);
    for (let i = 0; i < 90; i++) {
      const t0 = 6.6 + rnd() * 7.2, life = 2.2 + rnd() * 2.2, y0 = 300 + rnd() * 1500, sp = 280 + rnd() * 420, sz = 4 + rnd() * 7, near = rnd();
      if (t < t0 || t > t0 + life) continue;
      const u = t - t0;
      const x = -60 + u * sp * (0.8 + 0.6 * near), y = y0 + 60 * Math.sin(u * 2.4 + i) + u * 30;
      const al = vis * Math.min(1, u * 3) * (1 - R(t, t0 + life - 0.5, t0 + life));
      g.save(); g.translate(x, y); g.rotate(u * (4 + 6 * near) + i);
      g.scale(1, 0.4 + 0.6 * Math.abs(Math.sin(u * 7 + i)));
      g.fillStyle = `rgba(${200 + 30 * near | 0},${40 + 30 * rnd() | 0},24,${al.toFixed(3)})`;
      g.beginPath(); g.ellipse(0, 0, sz * (1 + near), sz * 0.6 * (1 + near), 0, 0, TAU); g.fill();
      g.strokeStyle = `rgba(80,16,8,${(al * 0.6).toFixed(3)})`; g.lineWidth = 1; g.stroke();
      g.restore();
    }
  }
  // foreground sprigs close to the lens sweep past (out of focus)
  function drawForeground(g, t, cam) {
    const items = [[7.6, 9.6, 1.7, 0.95, 2.4], [8.6, 10.8, 2.1, 0.8, 3.0], [10.2, 12.0, 1.9, 0.92, 2.6], [11.5, 13.4, 2.3, 0.78, 3.4], [12.2, 13.9, 2.0, 0.9, 3.0]];
    g.setTransform(1, 0, 0, 1, 0, 0);
    items.forEach(([t0, t1, s, yfrac, sp], i) => {
      if (t < t0 || t > t1) return;
      const u = (t - t0) / (t1 - t0), S = K.spritesBlur[(i * 3 + 1) % K.spritesBlur.length];
      const x = lerp(-S.w * s * 0.6, W + S.w * s * 0.6, u), y = H * yfrac + 60 * Math.sin(u * 3 + i);
      const w = windVec(t, x, y, 3);
      g.save(); g.translate(x, y + S.h * s * 0.5); g.rotate(0.12 * w[0] + 0.05 * Math.sin(t * 3 + i)); g.scale(s * (i % 2 ? -1 : 1), s);
      g.globalAlpha = Math.min(1, Math.min(u, 1 - u) * 8);
      g.drawImage(S.c, -S.bx, -S.by);
      g.restore();
    });
    g.globalAlpha = 1;
  }
  // two birds cross the sky and glide away into the last frame's two specks
  function drawBirds(g, t, cam) {
    if (t < 10.9 || t >= TB) return;
    const Me = Mend();
    g.setTransform(1, 0, 0, 1, 0, 0);
    const ends = [[757, 414], [749, 440]];
    for (let b = 0; b < 2; b++) {
      const t0 = 10.9 + b * 0.35, t1 = 15.2 + b * 0.05;
      const u = R(t, t0, t1), e = 1 - Math.pow(1 - u, 2.4);
      // a path in screen space: in from the upper right, a long glide down to the specks
      const p0 = [W + 120, 260 + b * 90], p1 = [380 - b * 60, 520 + b * 40], p2 = ends[b];
      const x = (1 - e) * (1 - e) * p0[0] + 2 * (1 - e) * e * p1[0] + e * e * p2[0], y = (1 - e) * (1 - e) * p0[1] + 2 * (1 - e) * e * p1[1] + e * e * p2[1];
      const size = lerp(30, 7, Math.pow(e, 0.8));
      const flap = Math.sin(t * (9 - 4 * e) + b * 2) * (1 - 0.8 * e);
      const al = Math.min(1, u * 8) * (1 - E(t, 15.15, 15.55));
      g.strokeStyle = `rgba(40,24,16,${al.toFixed(3)})`; g.lineWidth = Math.max(1.4, size * 0.16); g.lineCap = 'round'; g.lineJoin = 'round';
      const dir = e < 0.85 ? -1 : -1;
      g.beginPath();
      g.moveTo(x - size, y - size * 0.45 * flap - size * 0.1);
      g.quadraticCurveTo(x - size * 0.45, y - size * 0.35 * flap - size * 0.25, x, y);
      g.quadraticCurveTo(x + size * 0.45, y - size * 0.35 * flap - size * 0.25, x + size, y - size * 0.45 * flap - size * 0.1);
      g.stroke();
      void dir; void Me;
    }
    // the specks themselves, fading in under the birds as they arrive
    const k = E(t, 15.0, 15.4);
    if (k > 0 && K.birds2) { g.globalAlpha = k; g.drawImage(K.birds2.c, K.birds2.x, K.birds2.y); g.globalAlpha = 1; }
  }
  // motion arcs: ink speed-lines behind the blade tip during the swing
  function drawArcs(g, t, cam) {
    const t0 = T_SW[0] + 0.24, k = E(t, t0, t0 + 0.04) * (1 - E(t, T_SW[1] + 0.02, T_SW[1] + 0.2));
    if (k <= 0.01) return;
    const A = camAff(cam, 1);
    g.setTransform(1, 0, 0, 1, 0, 0);
    const tipAt = (tt, u) => {
      const s = scytheW(tt), M = amul(atr(s.G[0], s.G[1]), amul(arot(s.th - DTH), amul(asc(K2), atr(-G2.scyGrip[0], -G2.scyGrip[1]))));
      // u: 0 = blade tip, 1 = toward the heel along the blade's back
      const p = aap(M, lerp(46, 420, u), lerp(276, 96, u));
      return aap(A, p[0], p[1]);
    };
    for (const u of [0, 0.22, 0.45]) {
      const n = 18, L = [], Rr = [];
      for (let q = 0; q <= n; q++) {
        const tt = Math.max(t0 - 0.02, t - q * 0.0075), p = tipAt(tt, u), p2 = tipAt(tt - 0.003, u);
        let nx = -(p[1] - p2[1]), ny = p[0] - p2[0]; const nl = Math.hypot(nx, ny) || 1; nx /= nl; ny /= nl;
        const wd = (1 - q / n) * (u === 0 ? 7 : 4.5);
        L.push([p[0] + nx * wd, p[1] + ny * wd]); Rr.push([p[0] - nx * wd, p[1] - ny * wd]);
      }
      g.fillStyle = `rgba(52,30,16,${(0.32 * k * (1 - u)).toFixed(3)})`;
      g.beginPath(); L.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); for (let i = Rr.length - 1; i >= 0; i--) g.lineTo(Rr[i][0], Rr[i][1]); g.closePath(); g.fill();
    }
  }

  /* ================================================================ frame */
  function render(g, t) {
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalAlpha = 1; g.filter = 'none'; g.globalCompositeOperation = 'source-over';
    if (t < TA) { g.imageSmoothingEnabled = false; g.drawImage(K.c1, 0, 0); g.imageSmoothingEnabled = true; return; }
    if (t >= TB) { g.imageSmoothingEnabled = false; g.drawImage(K.c2, 0, 0); g.imageSmoothingEnabled = true; return; }
    const on = (n) => !KF.only || KF.only.includes(n);
    const cam = camAt(t);
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    if (on('sky')) drawSky(g, t, cam);
    // the first keyframe's plate (sky + ground without him) until the camera moves
    const p1 = 1 - E(t, 3.0, 3.7);
    if (p1 > 0 && on('plate')) { const A = camAff(cam, 1); g.setTransform(A[0], A[1], A[2], A[3], A[4], A[5]); g.globalAlpha = p1; g.drawImage(K.plate1, 0, 0); g.globalAlpha = 1; }
    // the last keyframe's sky resolving
    const sk2 = E(t, 12.4, 14.4);
    if (sk2 > 0 && on('sky')) { g.setTransform(1, 0, 0, 1, 0, 0); const A = camAff(cam, 1), Me = Mend(), M = amul(A, Me); g.setTransform(M[0], M[1], M[2], M[3], M[4], M[5]); g.globalAlpha = sk2; g.drawImage(K.skyPlate2, -200, -200, W + 400, H + 400); g.drawImage(K.skyPlate2, 0, 0); g.globalAlpha = 1; }
    if (on('hills')) drawHills(g, t, cam);
    if (on('birds')) drawBirds(g, t, cam);
    if (on('ground') && t >= 3.0) drawTerrain(g, t, cam);
    if (on('grass')) drawGrass(g, t, cam, false);
    const fieldIn = 1 - E(t, 12.6, 14.2);
    if (on('field')) drawField(g, t, cam, false, fieldIn);
    // the painted ground behind him (only matters if he moves while the painting resolves)
    const pf = E(t, 12.4, 14.4);
    if (pf > 0 && K.back2 && on('paint')) { const M = amul(camAff(cam, 1), Mend()); g.setTransform(M[0], M[1], M[2], M[3], M[4], M[5]); g.globalAlpha = pf; g.drawImage(K.back2.c, K.back2.x, K.back2.y); g.globalAlpha = 1; }
    if (on('dust')) drawDust(g, t, cam);
    // shadow pass, legs, the puppet
    if (on('trav')) {
      glClear();
      if (puppet(t, cam, 'shadow')) { g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(GL.cv, 0, 0); }
      drawLegs(g, t, cam);
      glClear();
      puppet(t, cam, 'main');
      g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(GL.cv, 0, 0);
      if (t > T_SW[0] + 0.15) { glClear(); puppet(t, cam, 'front'); g.drawImage(GL.cv, 0, 0); }
    }
    if (on('arcs')) drawArcs(g, t, cam);
    if (on('field')) drawField(g, t, cam, true, fieldIn);
    if (on('grass')) drawGrass(g, t, cam, true);
    // the painted field in front of him resolves as the camera arrives
    if (pf > 0 && on('paint')) { const M = amul(camAff(cam, 1), Mend()); g.setTransform(M[0], M[1], M[2], M[3], M[4], M[5]); g.globalAlpha = pf; g.drawImage(K.front2.c, K.front2.x, K.front2.y); g.globalAlpha = 1; }
    if (on('flecks')) drawFlecks(g, t, cam);
    if (on('petals')) drawPetals(g, t, cam);
    if (on('fg')) drawForeground(g, t, cam);
    g.setTransform(1, 0, 0, 1, 0, 0);
    // the first computed frames: hand over from the keyframe itself
    const k0 = 1 - E(t, TA, TA + 0.45);
    if (k0 > 0) { g.globalAlpha = k0; g.imageSmoothingEnabled = false; g.drawImage(K.c1, 0, 0); g.globalAlpha = 1; g.imageSmoothingEnabled = true; }
    // the last half-second: the composite settles onto the keyframe
    const k = KF.noSettle ? 0 : E(t, T_SET[0], T_SET[1]);
    if (k > 0) { g.globalAlpha = k; g.imageSmoothingEnabled = false; g.drawImage(K.c2, 0, 0); g.globalAlpha = 1; g.imageSmoothingEnabled = true; }
  }

  /* ================================================================ debug views */
  function debugView(g, what) {
    g.setTransform(1, 0, 0, 1, 0, 0);
    if (!K.ter) { buildTerrain(); buildGrass(); buildField(); }
    if (what === 'parts1' || what === 'parts2' || what === 'front2' || what === 'sprites' || what === 'plate1' || what === 'sky2' || what === 'terrain') {
      // a checker so the alpha shows
      for (let y = 0; y < H; y += 40) for (let x = 0; x < W; x += 40) { g.fillStyle = ((x + y) / 40) % 2 ? '#c0c' : '#0cc'; g.fillRect(x, y, 40, 40); }
      if (what === 'parts1') { for (const L of [K.body1, K.scy1L]) g.drawImage(L.c, L.x, L.y); }
      if (what === 'parts2') { const off = { arm: [-260, 0], staff: [-160, 0], scy: [0, 0] }; g.drawImage(K.butt2.c, K.butt2.x, K.butt2.y); g.drawImage(K.body2.c, K.body2.x, K.body2.y); g.drawImage(K.arm2.c, K.arm2.x + off.arm[0], K.arm2.y); g.drawImage(K.staff2.c, K.staff2.x + off.staff[0], K.staff2.y); g.drawImage(K.scy2L.c, K.scy2L.x, K.scy2L.y + 0); }
      if (what === 'front2') { g.drawImage(K.front2.c, K.front2.x, K.front2.y); if (K.back2) { g.globalAlpha = 0.5; g.drawImage(K.back2.c, K.back2.x, K.back2.y); g.globalAlpha = 1; } }
      if (what === 'sprites') { let x = 10, y = 10, rh = 0; for (const s of K.sprites) { if (x + s.w > W) { x = 10; y += rh + 10; rh = 0; } g.drawImage(s.c, x, y); x += s.w + 10; rh = Math.max(rh, s.h); } }
      if (what === 'plate1') g.drawImage(K.plate1, 0, 0);
      if (what === 'sky2') g.drawImage(K.skyPlate2, 0, 0);
      if (what === 'terrain') { g.drawImage(K.ter, 0, 0, K.ter.width, K.ter.height, 0, 0, W, W * K.ter.height / K.ter.width); }
      return;
    }
  }

  /* ================================================================ export */
  const KF = {
    only: null, noSettle: false,
    W, H, FPS, D, NF, TA, TB, K,
    build, render, debugView,
    info: () => ({
      buildMs: K.buildMs, particles: 0, fit1: K.fit1, fit2: K.fit2, VMAX: K.VMAX, STEP, DIST,
      steps: Array.from({ length: NSTEPS }, (_, i) => +stepTime(i + 1).toFixed(3)),
      plants: K.staff.P.map((p) => +p.t.toFixed(3)), grab: T_GRAB, swing: T_SW, swap: T_SWAP,
      walker: [3.5, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15].map((t) => { const w = walker(t); return [t, Math.round(w.x), Math.round(w.y), +w.phi.toFixed(2)]; }),
    }),
  };
  window.EVENING = KF;
})();
