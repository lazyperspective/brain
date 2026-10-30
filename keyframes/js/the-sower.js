/* Keyframes 02 — "The Sower".
 *
 * First frame: a thin reaper on flat dry grass under a pale khaki sky, scythe trailing on the ground, ink flecks
 * drifting off his robe. Last frame: the same figure in profile walking a steep hillside under an orange sky, scythe
 * over his shoulder, a staff in hand, red wildflowers all around him.
 *
 * The rule of this film: nothing is destroyed or taken away; every element of the first frame becomes something in
 * the last, and everything in the last comes from something in the first or grows out of something that was there.
 *
 *   khaki sky        -> ripens into the orange sky: a warm front rises through the same sky
 *   flat dry ground  -> hinges up into the slope; the earth lifts beneath it, and the hill's grass grows up out of it
 *   the reaper       -> a thin-plate-spline mesh warp (WebGL) carries hood, skull, shoulders, hands, hem and tatters to
 *                       the profile pose, while the navy "material" of the last frame flows down him from the hood:
 *                       the white skull turns away into the hood's shadow, the tatters lengthen into the trailing cloak
 *   the scythe       -> lifted off the ground and swung up over his shoulder (a strip warp along its own centreline);
 *                       the blade sweeps up and around and stretches into the arc across the top of the frame
 *   the ink flecks   -> seeds: they drift, burst into seed, fall and land on the slope; the red wildflowers grow up
 *                       out of the exact places they land. Two of them fly on and become the two birds
 *   a dry grass stalk-> grows into the staff, up into his hand
 *   (his wrist)      -> the brown bindings wind out from it around him like vines
 *   the signature    -> slides down the slope into the grass where the last frame's mark sits
 *
 * Every frame is a pure function of t. Hidden areas are filled procedurally; nothing is traced.
 */
(function () {
  'use strict';

  /* ================================================================ constants & helpers */
  const W = 1080, H = 1920, FPS = 30, D = 17.5, NF = Math.round(D * FPS);
  const TA = 1.0, TB = 16.0;
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, u) => a + (b - a) * u;
  const R = (t, a, b) => clamp((t - a) / (b - a), 0, 1);
  const s3 = (u) => u * u * (3 - 2 * u);
  const s5 = (u) => u * u * u * (u * (u * 6 - 15) + 10);
  const E = (t, a, b) => s5(R(t, a, b));
  const E3 = (t, a, b) => s3(R(t, a, b));
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
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function mk(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  const lumOf = (r, g, b) => 0.299 * r + 0.587 * g + 0.114 * b;
  function canvasFrom(rgba, w, h) {
    const c = mk(w, h), g = c.getContext('2d');
    const id = g.createImageData(w, h); id.data.set(rgba); g.putImageData(id, 0, 0);
    return c;
  }
  function fitCover(img) {
    const w = img.naturalWidth, h = img.naturalHeight, s = Math.max(W / w, H / h);
    const sw = W / s, sh = H / s;
    return { s, sx: (w - sw) / 2, sy: (h - sh) / 2, sw, sh, w, h };
  }
  function drawFit(img, f) {
    const c = mk(W, H), g = c.getContext('2d');
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    g.drawImage(img, f.sx, f.sy, f.sw, f.sh, 0, 0, W, H);
    return c;
  }
  function dataOf(c) { return c.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, c.width, c.height); }
  function inPoly(x, y, P) {
    let c = false;
    for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
      const [xi, yi] = P[i], [xj, yj] = P[j];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
    }
    return c;
  }
  function dilate(m, r) {          // chamfer (3-4) distance <= r: near-round dilation
    const D = new Float32Array(W * H);
    for (let i = 0; i < W * H; i++) D[i] = m[i] ? 0 : 1e9;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x; let v = D[i];
      if (x > 0) v = Math.min(v, D[i - 1] + 1);
      if (y > 0) { v = Math.min(v, D[i - W] + 1); if (x > 0) v = Math.min(v, D[i - W - 1] + 1.414); if (x < W - 1) v = Math.min(v, D[i - W + 1] + 1.414); }
      D[i] = v;
    }
    for (let y = H - 1; y >= 0; y--) for (let x = W - 1; x >= 0; x--) {
      const i = y * W + x; let v = D[i];
      if (x < W - 1) v = Math.min(v, D[i + 1] + 1);
      if (y < H - 1) { v = Math.min(v, D[i + W] + 1); if (x < W - 1) v = Math.min(v, D[i + W + 1] + 1.414); if (x > 0) v = Math.min(v, D[i + W - 1] + 1.414); }
      D[i] = v;
    }
    const b = new Uint8Array(W * H);
    for (let i = 0; i < W * H; i++) b[i] = D[i] <= r ? 1 : 0;
    return b;
  }
  const erode = (m, r) => { const inv = new Uint8Array(W * H); for (let i = 0; i < W * H; i++) inv[i] = m[i] ? 0 : 1; const d = dilate(inv, r); for (let i = 0; i < W * H; i++) inv[i] = d[i] ? 0 : 1; return inv; };
  // a layer from a class map: exact pixels of the wanted classes, optional fill elsewhere (rgba fill buffer + mask)
  function layerFrom(d, cls, want, fill, fillMask, useAlpha) {
    let x0 = W, y0 = H, x1 = -1, y1 = -1;
    for (let i = 0; i < W * H; i++) if (want(cls[i]) || (fillMask && fillMask[i])) { const x = i % W, y = (i - x) / W; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    if (x1 < 0) return null;
    const w = x1 - x0 + 1, h = y1 - y0 + 1, a = new Uint8ClampedArray(w * h * 4);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const i = y * W + x, o = ((y - y0) * w + x - x0) * 4;
      if (want(cls[i])) { a[o] = d[i * 4]; a[o + 1] = d[i * 4 + 1]; a[o + 2] = d[i * 4 + 2]; a[o + 3] = useAlpha ? d[i * 4 + 3] : 255; }
      else if (fillMask && fillMask[i]) { a[o] = fill[i * 4]; a[o + 1] = fill[i * 4 + 1]; a[o + 2] = fill[i * 4 + 2]; a[o + 3] = 255; }
    }
    return { c: canvasFrom(a, w, h), x: x0, y: y0, w, h, rgba: a };
  }
  // Remove the sky from an object's antialiased rim (simple matting): a rim pixel c = a*obj + (1-a)*sky, with obj
  // taken as dark ink (or bright bone when the pixel is lighter than the sky). Returns RGBA with that coverage.
  function unmix(d, isObj, skyRgb) {
    const out = new Uint8ClampedArray(W * H * 4);
    for (let i = 0; i < W * H; i++) {
      if (!isObj(i)) continue;
      const o = i * 4, r = d[o], g = d[o + 1], b = d[o + 2];
      out[o] = r; out[o + 1] = g; out[o + 2] = b; out[o + 3] = 255;
      const x = i % W, y = (i - x) / W;
      const sk0 = skyRgb(x, y);
      let rim = Math.abs(r - sk0[0]) + Math.abs(g - sk0[1]) + Math.abs(b - sk0[2]) < 36;
      for (let dy = -2; dy <= 2 && !rim; dy++) for (let dx = -2; dx <= 2; dx++) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < W && yy < H && !isObj(yy * W + xx)) { rim = true; break; } }
      if (!rim) continue;
      const sk = skyRgb(x, y), Ls = lumOf(sk[0], sk[1], sk[2]), L = lumOf(r, g, b);
      let a, obj;
      if (L <= Ls) { a = clamp((Ls - L) / (Ls - 34), 0.04, 1); obj = [32, 34, 32]; }
      else { a = clamp((L - Ls) / (246 - Ls), 0.04, 1); obj = [246, 236, 205]; }
      void obj;
      out[o] = clamp((r - (1 - a) * sk[0]) / a, 0, 255); out[o + 1] = clamp((g - (1 - a) * sk[1]) / a, 0, 255); out[o + 2] = clamp((b - (1 - a) * sk[2]) / a, 0, 255);
      out[o + 3] = 255 * a;
    }
    return out;
  }

  // normalised-convolution fill (1/8 res) of the pixels in `src` mask, sampled everywhere
  function smoothFill(d, srcMask, iters) {
    const S = 8, sw = Math.ceil(W / S), sh = Math.ceil(H / S);
    let acc = new Float32Array(sw * sh * 4);
    for (let i = 0; i < W * H; i++) if (srcMask[i]) {
      const x = i % W, y = (i - x) / W, j = (Math.floor(y / S) * sw + Math.floor(x / S)) * 4;
      acc[j] += d[i * 4]; acc[j + 1] += d[i * 4 + 1]; acc[j + 2] += d[i * 4 + 2]; acc[j + 3] += 1;
    }
    for (let it = 0; it < (iters || 60); it++) {
      const nb = new Float32Array(acc.length);
      for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) {
        const o = (y * sw + x) * 4;
        if (acc[o + 3] >= S * S * 0.5) { nb[o] = acc[o]; nb[o + 1] = acc[o + 1]; nb[o + 2] = acc[o + 2]; nb[o + 3] = acc[o + 3]; continue; }
        let a0 = 0, a1 = 0, a2 = 0, a3 = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const q = (clamp(y + dy, 0, sh - 1) * sw + clamp(x + dx, 0, sw - 1)) * 4;
          a0 += acc[q]; a1 += acc[q + 1]; a2 += acc[q + 2]; a3 += acc[q + 3];
        }
        nb[o] = a0 / 9; nb[o + 1] = a1 / 9; nb[o + 2] = a2 / 9; nb[o + 3] = a3 / 9;
      }
      acc = nb;
    }
    // far from every sample, fall back to the mean of the nearest rows that have samples
    let gm = [0, 0, 0], gn = 0;
    for (let i = 0; i < sw * sh; i++) if (acc[i * 4 + 3] > 1) { const n = acc[i * 4 + 3]; gm[0] += acc[i * 4] / n; gm[1] += acc[i * 4 + 1] / n; gm[2] += acc[i * 4 + 2] / n; gn++; }
    gm = gm.map((v) => v / Math.max(1, gn));
    const rowM = [];
    for (let y = 0; y < sh; y++) {
      let a = [0, 0, 0], n = 0;
      for (let x = 0; x < sw; x++) { const o = (y * sw + x) * 4; if (acc[o + 3] > 1) { a[0] += acc[o] / acc[o + 3]; a[1] += acc[o + 1] / acc[o + 3]; a[2] += acc[o + 2] / acc[o + 3]; n++; } }
      rowM.push(n ? a.map((v) => v / n) : null);
    }
    for (let y = 0; y < sh; y++) if (!rowM[y]) { let k = 1; while (k < sh && !(rowM[y - k] || rowM[y + k])) k++; rowM[y] = rowM[y - k] || rowM[y + k] || gm; }
    const lo = new Uint8ClampedArray(sw * sh * 4);
    for (let i = 0; i < sw * sh; i++) {
      const n = acc[i * 4 + 3], w = clamp(n / 0.5, 0, 1), rm = rowM[Math.floor(i / sw)], nn = Math.max(1e-6, n);
      lo[i * 4] = lerp(rm[0], acc[i * 4] / nn, w); lo[i * 4 + 1] = lerp(rm[1], acc[i * 4 + 1] / nn, w); lo[i * 4 + 2] = lerp(rm[2], acc[i * 4 + 2] / nn, w); lo[i * 4 + 3] = 255;
    }
    const c = mk(W, H), g = c.getContext('2d');
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    g.drawImage(canvasFrom(lo, sw, sh), 0, 0, sw, sh, 0, 0, sw * S, sh * S);
    const out = g.getImageData(0, 0, W, H).data;
    for (let i = 0; i < W * H; i++) { const j = (ih(i % W, (i / W) | 0, 5) - 0.5) * 3; out[i * 4] += j; out[i * 4 + 1] += j; out[i * 4 + 2] += j; }
    return out;
  }
  // per-row mean of a mask's colour, carried across rows without samples
  function rowFill(d, mask) {
    const out = new Uint8ClampedArray(W * H * 4);
    let last = null;
    const rows = [];
    for (let y = 0; y < H; y++) {
      let n = 0, a = 0, b = 0, c = 0;
      for (let x = 0; x < W; x++) { const i = y * W + x; if (mask[i]) { n++; a += d[i * 4]; b += d[i * 4 + 1]; c += d[i * 4 + 2]; } }
      rows.push(n > 30 ? [a / n, b / n, c / n] : null);
    }
    for (let y = 0; y < H; y++) if (rows[y]) { last = rows[y]; break; }
    for (let y = 0; y < H; y++) {
      if (rows[y]) last = rows[y];
      for (let x = 0; x < W; x++) { const o = (y * W + x) * 4, j = (ih(x, y, 3) - 0.5) * 2; out[o] = last[0] + j; out[o + 1] = last[1] + j; out[o + 2] = last[2] + j; out[o + 3] = 255; }
    }
    return out;
  }
  // flood fill from seeds through `ok`
  function flood(seeds, ok, mark, val) {
    const st = seeds.slice();
    for (const i of st) mark[i] = val;
    while (st.length) {
      const i = st.pop(), x = i % W;
      if (x > 0 && ok(i - 1)) { mark[i - 1] = val; st.push(i - 1); }
      if (x < W - 1 && ok(i + 1)) { mark[i + 1] = val; st.push(i + 1); }
      if (i >= W && ok(i - W)) { mark[i - W] = val; st.push(i - W); }
      if (i < W * (H - 1) && ok(i + W)) { mark[i + W] = val; st.push(i + W); }
    }
  }
  function components(mask) {      // 8-connected components of mask: {n, px[], x0..y1}
    const comp = new Int32Array(W * H).fill(-1), out = [], st = [];
    for (let i0 = 0; i0 < W * H; i0++) {
      if (!mask[i0] || comp[i0] >= 0) continue;
      const c = { id: out.length, n: 0, px: [], x0: W, y0: H, x1: 0, y1: 0 };
      out.push(c); comp[i0] = c.id; st.push(i0);
      while (st.length) {
        const i = st.pop(), x = i % W, y = (i - x) / W;
        c.n++; c.px.push(i);
        if (x < c.x0) c.x0 = x; if (x > c.x1) c.x1 = x; if (y < c.y0) c.y0 = y; if (y > c.y1) c.y1 = y;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
          const j = yy * W + xx; if (mask[j] && comp[j] < 0) { comp[j] = c.id; st.push(j); }
        }
      }
    }
    return { comp, list: out };
  }

  /* ================================================================ the world */
  const K = { built: false };
  // first-frame classes
  const A_SKY = 0, A_GROUND = 1, A_BODY = 2, A_SCY = 3, A_FLECK = 4, A_SIG = 5;
  // last-frame classes
  const B_SKY = 0, B_HILL = 1, B_BODY = 2, B_SCY = 3, B_STAFF = 4, B_BIND = 5, B_FLOWER = 6, B_BIRD = 7;

  // hand-placed geometry (canvas coordinates after the cover fit), refined against the pixels where it matters
  const YG1 = 1800;                                 // the first frame's ground line
  const BODY1 = [[500, 655], [565, 680], [625, 820], [700, 990], [770, 1150], [865, 1340], [880, 1460], [850, 1745], [660, 1792], [640, 1818], [445, 1818], [418, 1700], [408, 1400], [430, 1200], [452, 1000], [470, 800], [455, 700]];
  const BODY2 = [[280, 425], [330, 330], [480, 210], [565, 225], [625, 330], [700, 460], [800, 610], [900, 770], [1000, 860], [1080, 880], [1080, 1070], [960, 1090], [900, 1190], [800, 1320], [720, 1500], [700, 1690], [240, 1690], [90, 1420], [90, 1290], [220, 1240], [320, 1140], [360, 1000], [395, 860], [415, 600], [300, 520]];
  // scythe centrelines: shaft (top/lower end -> head) and blade (head -> tip); widths are half-widths
  const SHAFT1 = { p: [[897, 700], [790, 810], [710, 883], [654, 980], [459, 1255], [403, 1357], [323, 1417], [250, 1463], [217, 1477]], w: [6, 6, 6, 6, 6, 6, 6, 9, 24], hidden: [2.9, 4.1] };
  const BLADE1 = { p: [[208, 1480], [214, 1530], [228, 1560], [258, 1617], [300, 1665], [383, 1717], [437, 1737]], w: [26, 22, 20, 18, 14, 9, 4] };
  const SHAFT2 = { p: [[370, 1035], [470, 862], [569, 690], [656, 518], [722, 407], [778, 296], [822, 229], [860, 170], [885, 135]], w: [8, 8, 9, 9, 9, 9, 10, 14, 28], hidden: [0, 2.05] };
  const BLADE2 = { p: [[925, 118], [890, 133], [820, 158], [700, 138], [600, 128], [500, 130], [400, 143], [300, 172], [200, 216], [120, 265], [60, 314], [47, 326]], w: [28, 34, 40, 36, 31, 26, 23, 23, 18, 13, 7, 4] };
  const STAFF2 = [[412, 1000], [380, 1130], [356, 1238], [323, 1375], [291, 1509], [262, 1625], [238, 1732], [215, 1830], [203, 1920]];
  // the body's correspondence: first-frame point -> last-frame point
  const LMK = [
    [[515, 672], [528, 232]], [[462, 745], [305, 432]], [[502, 757], [395, 455]], [[515, 830], [455, 500]],
    [[565, 720], [620, 340]], [[600, 830], [700, 470]], [[650, 960], [790, 640]], [[490, 880], [430, 580]],
    [[470, 1100], [420, 820]], [[452, 1360], [415, 985]], [[582, 1335], [560, 930]], [[560, 1100], [600, 800]],
    [[700, 1150], [880, 820]], [[790, 1250], [1000, 900]], [[850, 1390], [1075, 960]], [[800, 1600], [900, 1130]],
    [[680, 1730], [700, 1560]], [[440, 1720], [300, 1500]], [[430, 1550], [150, 1340]], [[540, 1805], [480, 1640]],
    [[560, 1500], [520, 1250]], [[445, 1250], [370, 1090]],
  ];
  // the ground's hinge
  const PIV = [-60, 1840], THMAX = 0.305;
  const thetaAt = (t) => THMAX * E(t, 2.2, 7.0);
  const thetaInv = (th) => {           // smallest t with thetaAt(t) >= th
    if (th <= 0) return 2.2;
    let lo = 2.2, hi = 7.0;
    for (let k = 0; k < 30; k++) { const m = (lo + hi) / 2; if (thetaAt(m) >= th) hi = m; else lo = m; }
    return hi;
  };
  const surfY = (x) => 1650 - 0.3176 * (x - 150);     // the last frame's grass surface, roughly

  /* ---------------------------------------------------------------- polylines */
  function resample(poly, step) {       // dense points along a polyline with arc length, tangent and interpolated width
    const P = poly.p, Wd = poly.w || P.map(() => 8), Sg = poly.seg || P.map((q, i) => i);
    const pts = [];
    let s = 0;
    for (let i = 0; i < P.length - 1; i++) {
      const [ax, ay] = P[i], [bx, by] = P[i + 1], L = Math.hypot(bx - ax, by - ay), n = Math.max(1, Math.ceil(L / step));
      for (let k = 0; k < n; k++) {
        const u = k / n;
        pts.push({ x: ax + (bx - ax) * u, y: ay + (by - ay) * u, s: s + L * u, w: lerp(Wd[i], Wd[i + 1], u), seg: lerp(Sg[i], Sg[i + 1], u) });
      }
      s += L;
    }
    const [lx, ly] = P[P.length - 1];
    pts.push({ x: lx, y: ly, s, w: Wd[Wd.length - 1], seg: Sg[Sg.length - 1] });
    for (let i = 0; i < pts.length; i++) {
      const a = pts[Math.max(0, i - 3)], b = pts[Math.min(pts.length - 1, i + 3)], L = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      pts[i].tx = (b.x - a.x) / L; pts[i].ty = (b.y - a.y) / L;
    }
    return { pts, len: s };
  }
  // pull a centreline onto the pixels it describes (centroid of matching pixels across it), then smooth
  function refine(poly, d, test, reach) {
    const r = resample(poly, 4).pts;
    const out = r.map((p) => {
      let sx = 0, sy = 0, n = 0;
      const nx = -p.ty, ny = p.tx;
      for (let o = -reach; o <= reach; o++) {
        const x = Math.round(p.x + nx * o), y = Math.round(p.y + ny * o); if (x < 0 || y < 0 || x >= W || y >= H) continue;
        const i = y * W + x; if (test(d[i * 4], d[i * 4 + 1], d[i * 4 + 2], i)) { sx += x + 0.5; sy += y + 0.5; n++; }
      }
      return n >= 2 ? [sx / n, sy / n, p] : [p.x, p.y, p];
    });
    // smooth, but keep the ends where they were given
    const sm = out.map((q, i) => {
      if (i === 0 || i === out.length - 1) return [q[2].x, q[2].y];
      let ax = 0, ay = 0, n = 0;
      for (let k = -3; k <= 3; k++) { const j = clamp(i + k, 0, out.length - 1); ax += out[j][0]; ay += out[j][1]; n++; }
      return [ax / n, ay / n];
    });
    const wv = out.map((q) => q[2].w), sv = out.map((q) => q[2].seg);
    return { p: sm, w: wv, seg: sv, hidden: poly.hidden };
  }

  /* ================================================================ first frame */
  function segment1() {
    const d = K.d1.data, cls = new Uint8Array(W * H).fill(255);
    // sky reference per row from the left margin
    const ref = [];
    let last = [161, 150, 115];
    for (let y = 0; y < H; y++) {
      if (y < YG1 - 30) { let a = 0, b = 0, c = 0; for (let x = 2; x < 40; x++) { const i = (y * W + x) * 4; a += d[i]; b += d[i + 1]; c += d[i + 2]; } last = [a / 38, b / 38, c / 38]; }
      ref.push(last);
    }
    const skyish = (i) => { const y = (i / W) | 0, r = ref[y]; return Math.abs(d[i * 4] - r[0]) + Math.abs(d[i * 4 + 1] - r[1]) + Math.abs(d[i * 4 + 2] - r[2]) < 26; };
    const sky = new Uint8Array(W * H);
    const seeds = [];
    for (let x = 0; x < W; x++) if (skyish(x)) seeds.push(x);
    for (let y = 0; y < YG1 - 4; y++) { if (skyish(y * W)) seeds.push(y * W); if (skyish(y * W + W - 1)) seeds.push(y * W + W - 1); }
    flood(seeds, (i) => !sky[i] && i < (YG1 - 4) * W && skyish(i), sky, 1);
    for (let i = 0; i < W * H; i++) if (sky[i]) cls[i] = A_SKY;
    // the ground: below the ground line, apart from the feet; small marks just above it are its grass
    const gy = [216, 192, 142];
    for (let y = YG1; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const far = Math.abs(d[i * 4] - gy[0]) + Math.abs(d[i * 4 + 1] - gy[1]) + Math.abs(d[i * 4 + 2] - gy[2]);
      cls[i] = (x > 440 && x < 632 && y < 1818 && far > 150) ? A_BODY : A_GROUND;
    }
    // scythe: non-sky pixels in a band along its centreline (outside the hidden run)
    const sh = refine(SHAFT1, d, (r, g, b, i) => !sky[i] && r - b > 22, 10);
    const bl = refine(BLADE1, d, (r, g, b, i) => !sky[i], 16);
    K.sh1 = sh; K.bl1 = bl;
    const band = new Uint8Array(W * H);
    for (const [poly, pad, isShaft] of [[sh, 3, true], [bl, 8, false]]) {
      const r = resample(poly, 1).pts;
      for (const p of r) {
        if (isShaft && poly.hidden && segAt(poly, p) > poly.hidden[0] && segAt(poly, p) < poly.hidden[1]) continue;
        const R0 = Math.ceil(p.w + pad);
        for (let dy = -R0; dy <= R0; dy++) for (let dx = -R0; dx <= R0; dx++) {
          if (dx * dx + dy * dy > (p.w + pad) * (p.w + pad)) continue;
          const x = Math.round(p.x + dx), y = Math.round(p.y + dy); if (x < 0 || y < 0 || x >= W || y >= YG1) continue;
          band[y * W + x] = 1;
        }
      }
    }
    for (let i = 0; i < YG1 * W; i++) if (band[i] && !sky[i]) cls[i] = A_SCY;
    // everything else above the ground: the body (main component inside the outline), flecks, the signature
    const rest = new Uint8Array(W * H);
    for (let i = 0; i < YG1 * W; i++) if (cls[i] === 255) { const x = i % W, y = (i - x) / W; if (y > 1770 && (x < 440 || x > 640)) cls[i] = A_GROUND; else rest[i] = 1; }
    const { list } = components(rest);
    list.sort((a, b) => b.n - a.n);
    K.flecks = [];
    list.forEach((c, k) => {
      const cx = (c.x0 + c.x1) / 2, cy = (c.y0 + c.y1) / 2;
      let v;
      if (k === 0) v = A_BODY;
      else if (cx > 985 && cy > 1620 && cy < 1790) v = A_SIG;
      else if (c.y1 > YG1 - 34 && c.n < 400 && !inPoly(cx, cy, BODY1)) v = A_GROUND;
      else if (c.n >= 14 && (cx > 690 || !inPoly(cx, cy, BODY1)) && c.n < 1500) { v = A_FLECK; K.flecks.push(c); }
      else v = c.n < 14 && !inPoly(cx, cy, BODY1) ? A_SKY : A_BODY;
      for (const i of c.px) cls[i] = v;
    });
    // any leftover tiny dots: sky colour noise
    for (let i = 0; i < W * H; i++) if (cls[i] === 255) cls[i] = A_SKY;
    const skyM = new Uint8Array(W * H); for (let i = 0; i < W * H; i++) skyM[i] = cls[i] === A_SKY ? 1 : 0;
    const plate = smoothFill(d, skyM, 80);
    K.plate1 = plate;
    for (let pass = 0; pass < 2; pass++) {
      const take = new Int16Array(W * H).fill(-1);
      for (let y = 1; y < YG1 - 1; y++) for (let x = 1; x < W - 1; x++) {
        const i = y * W + x; if (cls[i] !== A_SKY) continue;
        const dev = Math.abs(d[i * 4] - plate[i * 4]) + Math.abs(d[i * 4 + 1] - plate[i * 4 + 1]) + Math.abs(d[i * 4 + 2] - plate[i * 4 + 2]);
        if (dev < 16) continue;
        let best = -1, bd = -1;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const j = i + dy * W + dx, c = cls[j]; if (c === A_SKY || c === A_GROUND) continue;
          const dd = Math.abs(d[j * 4] - d[i * 4]) + Math.abs(d[j * 4 + 1] - d[i * 4 + 1]) + Math.abs(d[j * 4 + 2] - d[i * 4 + 2]);
          if (dd > bd) { bd = dd; best = c; }
        }
        if (best >= 0) take[i] = best;
      }
      for (let i = 0; i < W * H; i++) if (take[i] >= 0) cls[i] = take[i];
    }
    // flecks take their rims with them: rebuild each fleck from the final classes around it
    const own = new Int32Array(W * H).fill(-1);
    K.flecks.forEach((c, k) => { for (const i of c.px) own[i] = k; });
    for (let pass = 0; pass < 3; pass++) for (let i = W; i < W * (H - 1); i++) {
      if (cls[i] !== A_FLECK || own[i] >= 0) continue;
      const nb = [own[i - 1], own[i + 1], own[i - W], own[i + W], own[i - W - 1], own[i - W + 1], own[i + W - 1], own[i + W + 1]].find((v) => v >= 0);
      if (nb !== undefined) { own[i] = nb; const c = K.flecks[nb], x = i % W, y = (i - x) / W; c.px.push(i); c.n++; if (x < c.x0) c.x0 = x; if (x > c.x1) c.x1 = x; if (y < c.y0) c.y0 = y; if (y > c.y1) c.y1 = y; }
    }
    for (let i = 0; i < W * H; i++) if (cls[i] === A_FLECK && own[i] < 0) cls[i] = A_BODY;     // stray rim: it goes with the robe
    K.cls1 = cls;
  }
  function segAt(poly, p) { return p.seg !== undefined ? p.seg : 0; }

  /* ================================================================ last frame */
  function segment2() {
    const d = K.d2.data, cls = new Uint8Array(W * H).fill(255);
    const L = new Float32Array(W * H);
    for (let i = 0; i < W * H; i++) L[i] = lumOf(d[i * 4], d[i * 4 + 1], d[i * 4 + 2]);
    const ref = [];
    let last = [211, 132, 39];
    for (let y = 0; y < H; y++) {
      if (y < 1240) { let a = 0, b = 0, c = 0, n = 0; for (let x = 2; x < 36; x++) { const i = (y * W + x) * 4; if (Math.abs(d[i] - last[0]) + Math.abs(d[i + 1] - last[1]) + Math.abs(d[i + 2] - last[2]) < 40) { a += d[i]; b += d[i + 1]; c += d[i + 2]; n++; } } if (n > 10) last = [a / n, b / n, c / n]; }
      ref.push(last);
    }
    const skyish = (i) => { const y = (i / W) | 0, r = ref[y]; return Math.abs(d[i * 4] - r[0]) + Math.abs(d[i * 4 + 1] - r[1]) + Math.abs(d[i * 4 + 2] - r[2]) < 34; };
    const sky = new Uint8Array(W * H), seeds = [];
    for (let x = 0; x < W; x++) if (skyish(x)) seeds.push(x);
    for (let y = 0; y < 1300; y++) { if (skyish(y * W)) seeds.push(y * W); if (y < 860 && skyish(y * W + W - 1)) seeds.push(y * W + W - 1); }
    flood(seeds, (i) => !sky[i] && skyish(i), sky, 1);
    for (let i = 0; i < W * H; i++) if (sky[i]) cls[i] = B_SKY;
    const isRed = (i) => { const r = d[i * 4], g = d[i * 4 + 1], b = d[i * 4 + 2]; return r > 90 && g < 0.45 * r && b < 0.4 * r; };
    // scythe and staff: bands along refined centrelines
    const wood = (r, g, b, i) => !sky[i] && r - b > 28 && r > 60 && !isRed(i);
    const sh = refine(SHAFT2, d, wood, 12), bl = refine(BLADE2, d, (r, g, b, i) => !sky[i], 26);
    const st = refine({ p: STAFF2, w: STAFF2.map(() => 9) }, d, wood, 12);
    K.sh2 = sh; K.bl2 = bl; K.st2 = st;
    const bandOf = (poly, pad, skipHidden) => {
      const m = new Uint8Array(W * H), r = resample(poly, 1).pts;
      for (const p of r) {
        if (skipHidden && poly.hidden && p.seg < poly.hidden[1]) continue;
        const R0 = Math.ceil(p.w + pad);
        for (let dy = -R0; dy <= R0; dy++) for (let dx = -R0; dx <= R0; dx++) {
          if (dx * dx + dy * dy > (p.w + pad) * (p.w + pad)) continue;
          const x = Math.round(p.x + dx), y = Math.round(p.y + dy); if (x >= 0 && y >= 0 && x < W && y < H) m[y * W + x] = 1;
        }
      }
      return m;
    };
    const bSc = bandOf(sh, 2, true), bBl = bandOf(bl, 3, false), bSt = bandOf(st, 2, false);
    for (let i = 0; i < W * H; i++) {
      if (sky[i]) continue;
      const x = i % W, y = (i - x) / W, r = d[i * 4], g = d[i * 4 + 1], b = d[i * 4 + 2];
      if (isRed(i)) { cls[i] = B_FLOWER; continue; }
      if (bSc[i] || bBl[i]) { cls[i] = B_SCY; continue; }
      if (bSt[i]) {
        // the fingers wrap over the staff
        const pale = L[i] > 140 && r - b < 90 && x > 360 && x < 480 && y > 900 && y < 1080;
        cls[i] = pale ? B_BODY : B_STAFF; continue;
      }
      const inside = inPoly(x + 0.5, y + 0.5, BODY2);
      const gold = r - b > 95 && L[i] > 78;
      if (inside && !(gold && y > 1100)) {
        const brown = r - b > 28 && r - g > 8 && r - b <= 110 && L[i] > 45 && L[i] < 175 && x > 395 && x < 770 && y > 760 && y < 1180;
        cls[i] = brown ? B_BIND : B_BODY;
      } else cls[i] = B_HILL;
    }
    // the birds: small dark marks with nothing but sky around them
    const dark = new Uint8Array(W * H);
    for (let i = 0; i < W * 1100; i++) if (cls[i] === B_HILL) dark[i] = 1;
    K.birds = components(dark).list.filter((c) => {
      if (c.n < 5 || c.n > 260) return false;
      for (let y = c.y0 - 4; y <= c.y1 + 4; y++) for (let x = c.x0 - 4; x <= c.x1 + 4; x++) {
        if (x < 0 || y < 0 || x >= W || y >= H) return false;
        const i = y * W + x; if (!sky[i] && !dark[i]) return false;
        if (dark[i] && (x < c.x0 || x > c.x1 || y < c.y0 || y > c.y1)) return false;
      }
      return true;
    });
    for (const c of K.birds) for (const i of c.px) cls[i] = B_BIRD;
    // anything else up in the sky region is the dark stems and leaves of the flowers: it grows with them
    for (let i = 0; i < W * H; i++) { if (cls[i] !== B_HILL) continue; const x = i % W, y = (i - x) / W; if (y < surfY(x) - 200) cls[i] = B_FLOWER; }
    // the sky's antialiased rim around everything goes with what it surrounds, so the sky layer is clean
    for (let pass = 0; pass < 2; pass++) {
      const take = new Int16Array(W * H).fill(-1);
      for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
        const i = y * W + x; if (cls[i] !== B_SKY) continue;
        const r0 = ref[y], dev = Math.abs(d[i * 4] - r0[0]) + Math.abs(d[i * 4 + 1] - r0[1]) + Math.abs(d[i * 4 + 2] - r0[2]);
        if (dev < 12) continue;
        let best = -1, bd = -1;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const j = i + dy * W + dx, c = cls[j]; if (c === B_SKY || c === 255) continue;
          const dd = Math.abs(d[j * 4] - d[i * 4]) + Math.abs(d[j * 4 + 1] - d[i * 4 + 1]) + Math.abs(d[j * 4 + 2] - d[i * 4 + 2]);
          if (dd > bd) { bd = dd; best = c; }
        }
        if (best >= 0) take[i] = best;
      }
      for (let i = 0; i < W * H; i++) if (take[i] >= 0) cls[i] = take[i];
    }
    K.cls2 = cls;
    K.sky2mask = sky;
  }

  /* ================================================================ layers */
  function buildLayers() {
    const d1 = K.d1.data, d2 = K.d2.data, c1 = K.cls1, c2 = K.cls2;
    // skies: exact sky pixels, row-mean plate elsewhere
    const m1 = new Uint8Array(W * H), m2 = new Uint8Array(W * H);
    for (let i = 0; i < W * H; i++) { m1[i] = c1[i] === A_SKY ? 1 : 0; m2[i] = c2[i] === B_SKY ? 1 : 0; }
    const p1 = smoothFill(d1, m1, 80), p2 = smoothFill(d2, m2, 80);
    for (let i = 0; i < W * H; i++) {
      if (m1[i]) { p1[i * 4] = d1[i * 4]; p1[i * 4 + 1] = d1[i * 4 + 1]; p1[i * 4 + 2] = d1[i * 4 + 2]; }
      if (m2[i]) { p2[i * 4] = d2[i * 4]; p2[i * 4 + 1] = d2[i * 4 + 1]; p2[i * 4 + 2] = d2[i * 4 + 2]; }
    }
    K.sky1 = canvasFrom(p1, W, H); K.sky2 = canvasFrom(p2, W, H);
    const pl = K.plate1, skyAt = (x, y) => { const o = (y * W + x) * 4; return [pl[o], pl[o + 1], pl[o + 2]]; };
    K.u1 = unmix(d1, (i) => c1[i] === A_BODY || c1[i] === A_SCY || c1[i] === A_FLECK || c1[i] === A_SIG, skyAt);
    K.body1u = layerFrom(K.u1, c1, (c) => c === A_BODY, null, null, true);
    // first-frame body (exact), and the ground strip (exact, extended by mirroring for the hinge)
    K.body1 = layerFrom(d1, c1, (c) => c === A_BODY);
    K.sig = layerFrom(d1, c1, (c) => c === A_SIG);
    K.sigU = layerFrom(K.u1, c1, (c) => c === A_SIG, null, null, true);
    const SY0 = 1730, SW = 1500, SH = H - SY0 + 40, strip = new Uint8ClampedArray(SW * SH * 4);
    for (let y = 0; y < SH; y++) for (let X = 0; X < SW; X++) {
      let sy = y; if (sy >= H - SY0) sy = 2 * (H - SY0) - 1 - sy;
      let sx = X - 150; if (sx < 0) sx = -sx - 1; if (sx >= W) sx = 2 * W - 1 - sx;
      const i = (sy + SY0) * W + sx, o = (y * SW + X) * 4;
      const own = X >= 150 && X < 150 + W && y < H - SY0;
      if (c1[i] !== A_GROUND && (own || sy + SY0 < YG1)) continue;      // the feet stay with the body; tips only where grass
      let r = d1[i * 4], g = d1[i * 4 + 1], b = d1[i * 4 + 2];
      if (!own && c1[i] !== A_GROUND) { r = 214; g = 191; b = 141; }
      strip[o] = r; strip[o + 1] = g; strip[o + 2] = b; strip[o + 3] = 255;
    }
    K.strip = { c: canvasFrom(strip, SW, SH), x: -150, y: SY0 };
    // last-frame layers. The body carries a navy fill wherever the frame hides it behind flowers, grass, wood and
    // bindings (inside its own outline), so it can be moved before those arrive; the hill carries a fill under the
    // flowers that stand in front of it.
    const bodyM = new Uint8Array(W * H);
    for (let i = 0; i < W * H; i++) bodyM[i] = c2[i] === B_BODY || c2[i] === B_BIND ? 1 : 0;
    const hull = erode(dilate(bodyM, 26), 26);
    const II = new Float64Array((W + 1) * (H + 1));
    for (let y = 0; y < H; y++) { let rs = 0; for (let x = 0; x < W; x++) { rs += bodyM[y * W + x]; II[(y + 1) * (W + 1) + x + 1] = II[y * (W + 1) + x + 1] + rs; } }
    const dens = (x, y, r) => { const x0 = Math.max(0, x - r), y0 = Math.max(0, y - r), x1 = Math.min(W, x + r + 1), y1 = Math.min(H, y + r + 1); return (II[y1 * (W + 1) + x1] - II[y0 * (W + 1) + x1] - II[y1 * (W + 1) + x0] + II[y0 * (W + 1) + x0]) / ((x1 - x0) * (y1 - y0)); };
    const fillB = new Uint8Array(W * H);
    for (let i = 0; i < W * H; i++) {
      const c = c2[i]; const x = i % W, y = (i - x) / W;
      if (hull[i] && dens(x, y, 10) > 0.4 && (c === B_FLOWER || c === B_HILL || c === B_STAFF || c === B_SCY || c === B_BIND) && y < 1700) fillB[i] = 1;
    }
    const navy = smoothFill(d2, (() => { const m = new Uint8Array(W * H); for (let i = 0; i < W * H; i++) m[i] = c2[i] === B_BODY && lumOf(d2[i * 4], d2[i * 4 + 1], d2[i * 4 + 2]) < 110 ? 1 : 0; return m; })(), 40);
    K.body2 = layerFrom(d2, c2, (c) => c === B_BODY, navy, fillB);
    K.bindM = c2;
    const hillM = new Uint8Array(W * H), fillH = new Uint8Array(W * H);
    for (let i = 0; i < W * H; i++) { hillM[i] = c2[i] === B_HILL ? 1 : 0; const x = i % W, y = (i - x) / W; if (c2[i] === B_FLOWER && y > surfY(x) - 60) fillH[i] = 1; }
    const hfill = smoothFill(d2, hillM, 30);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x; if (c2[i] !== B_STAFF || y < surfY(x) + 20) continue;
      let l = x - 1, r = x + 1;
      while (l > 0 && c2[y * W + l] !== B_HILL && x - l < 24) l--;
      while (r < W - 1 && c2[y * W + r] !== B_HILL && r - x < 24) r++;
      const a = y * W + l, b = y * W + r;
      if (c2[a] !== B_HILL || c2[b] !== B_HILL) continue;
      const u = (x - l) / (r - l);
      for (let k = 0; k < 3; k++) hfill[i * 4 + k] = lerp(d2[a * 4 + k], d2[b * 4 + k], u);
      fillH[i] = 1;
    }
    K.hillFill = { rgba: hfill, mask: fillH };
    K.scy2 = layerFrom(d2, c2, (c) => c === B_SCY);
    K.scy1 = layerFrom(d1, c1, (c) => c === A_SCY);
    // hand overlay: the body pixels around the hand (drawn again over the staff once it has grown into it)
    const handM = new Uint8Array(W * H);
    for (let y = 900; y < 1080; y++) for (let x = 350; x < 485; x++) { const i = y * W + x; if (c2[i] === B_BODY && lumOf(d2[i * 4], d2[i * 4 + 1], d2[i * 4 + 2]) > 70) handM[i] = 1; }
    const handD = dilate(handM, 2);
    K.hand = layerFrom(d2, c2.map((c, i) => (handD[i] && c === B_BODY ? 99 : 0)), (c) => c === 99);
    // the birds
    K.birdS = K.birds.map((b) => {
      const set = new Set(b.px);
      const x0 = b.x0, y0 = b.y0, w = b.x1 - b.x0 + 1, h = b.y1 - b.y0 + 1, a = new Uint8ClampedArray(w * h * 4);
      for (const i of set) { const x = i % W, y = (i - x) / W, o = ((y - y0) * w + x - x0) * 4; a[o] = d2[i * 4]; a[o + 1] = d2[i * 4 + 1]; a[o + 2] = d2[i * 4 + 2]; a[o + 3] = 255; }
      return { c: canvasFrom(a, w, h), x: x0, y: y0, w, h, cx: (b.x0 + b.x1) / 2, cy: (b.y0 + b.y1) / 2 };
    });
  }

  /* ---------------------------------------------------------------- growth layers (per-pixel arrival times) */
  function growth(d, cls, want, tauOf, fill, ramp) {
    let x0 = W, y0 = H, x1 = -1, y1 = -1;
    const pick = [];
    for (let i = 0; i < W * H; i++) {
      const isW = want(cls[i]), isF = fill && fill.mask[i];
      if (!isW && !isF) continue;
      pick.push(i); const x = i % W, y = (i - x) / W;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
    const w = x1 - x0 + 1, h = y1 - y0 + 1, full = new Uint8ClampedArray(w * h * 4);
    const idx = new Int32Array(pick.length), tau = new Float32Array(pick.length);
    let tmin = 1e9, tmax = -1e9;
    pick.forEach((i, k) => {
      const x = i % W, y = (i - x) / W, o = (y - y0) * w + x - x0;
      const src = want(cls[i]) ? d : fill.rgba;
      full[o * 4] = src[i * 4]; full[o * 4 + 1] = src[i * 4 + 1]; full[o * 4 + 2] = src[i * 4 + 2]; full[o * 4 + 3] = 255;
      idx[k] = o; tau[k] = tauOf(x, y, i); tmin = Math.min(tmin, tau[k]); tmax = Math.max(tmax, tau[k]);
    });
    const c = mk(w, h), g = c.getContext('2d'), id = g.createImageData(w, h);
    id.data.set(full); for (let k = 0; k < id.data.length; k += 4) id.data[k + 3] = 0;
    return { x: x0, y: y0, w, h, idx, tau, tmin, tmax, full: canvasFrom(full, w, h), c, g, id, ramp: ramp || 0.2, state: -1 };
  }
  function drawGrowth(g, L, t, dx, dy) {
    if (!L || t < L.tmin) return;
    let src;
    if (t >= L.tmax + L.ramp) src = L.full;
    else {
      if (L.state !== t) {
        const a = L.id.data, idx = L.idx, tau = L.tau, r = L.ramp;
        for (let k = 0; k < idx.length; k++) a[idx[k] * 4 + 3] = 255 * clamp((t - tau[k]) / r, 0, 1);
        L.g.putImageData(L.id, 0, 0); L.state = t;
      }
      src = L.c;
    }
    g.drawImage(src, L.x + (dx || 0), L.y + (dy || 0));
  }

  // geodesic distance through a mask from seed pixels (8-connected, chamfer)
  function geodesic(mask, seeds) {
    const dist = new Float32Array(W * H).fill(-1), q = new Int32Array(W * H);
    let qh = 0, qt = 0;
    for (const s of seeds) { dist[s] = 0; q[qt++] = s; }
    while (qh < qt) {
      const k = q[qh++], x = k % W, y = (k - x) / W;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
        const j = yy * W + xx; if (!mask[j] || dist[j] >= 0) continue;
        dist[j] = dist[k] + (dx && dy ? 1.414 : 1); q[qt++] = j;
      }
    }
    return dist;
  }

  function buildGrowth() {
    const d2 = K.d2.data, c2 = K.cls2;
    // --- the hill: the deep earth arrives as the ground hinges up past it; the top band (grass) grows after
    K.hill = growth(d2, c2, (c) => c === B_HILL, (x, y) => {
      const depth = y - surfY(x);
      const phi = Math.atan2(PIV[1] - y, x - PIV[0]);
      const lift = thetaInv(Math.min(phi + 0.02, THMAX)) + 0.1;
      if (depth > 150) return lift + 0.08 * vn(x / 20, y / 20, 41);
      const u = clamp((150 - depth) / 260, 0, 1);    // 0 at the band's foot, 1 at the grass tips
      return Math.max(lift, 6.4 + 6.0 * Math.pow(u, 0.9) + 0.5 * (vn(x / 14, y / 30, 42) - 0.5) + 0.25 * (vn(x / 3, y / 9, 43) - 0.5));
    }, K.hillFill, 0.35);
    // --- flowers: one plant per cluster, each grown up from the point where its seed lands
    const red = new Uint8Array(W * H);
    for (let i = 0; i < W * H; i++) if (c2[i] === B_FLOWER) red[i] = 1;
    const clusters = components(dilate(red, 5)).list.filter((c) => c.n > 30);
    // each clump splits into stalks about 60 px wide; each stalk is one plant from one seed
    const plants = [];
    const owner = new Int32Array(W * H).fill(-1);
    for (const c of clusters) {
      const nb = Math.max(1, Math.round((c.x1 - c.x0 + 1) / 60));
      const base = plants.length;
      for (let k = 0; k < nb; k++) plants.push({ px: [], by: -1, bx: 0, n: 0 });
      for (const i of c.px) {
        if (!red[i]) continue;
        const x = i % W, y = (i - x) / W;
        const xn = x + 70 * (vn(y / 55, x / 260, 45) - 0.5);
        const k = base + clamp(Math.floor((xn - c.x0) / (c.x1 - c.x0 + 1) * nb), 0, nb - 1);
        const p = plants[k]; p.px.push(i); if (y > p.by) p.by = y; owner[i] = k;
      }
    }
    for (let k = plants.length - 1; k >= 0; k--) if (!plants[k].px.length) plants[k].dead = true;
    plants.forEach((p) => {
      if (p.dead) return;
      let sx = 0, n = 0; for (const i of p.px) { const x = i % W, y = (i - x) / W; if (y > p.by - 30) { sx += x; n++; } }
      p.base = [sx / Math.max(1, n), Math.min(p.by + 4, H - 6)];
    });
    K.plants = plants.filter((p) => !p.dead);
    const order = plants.map((p, k) => k).filter((k) => !plants[k].dead).sort((a, b) => plants[b].base[0] - plants[a].base[0]);
    order.forEach((k, j) => { plants[k].tLand = 6.0 + 5.2 * (j / Math.max(1, order.length - 1)) + 0.4 * ih(k, 7, 7); });
    // arrival time per flower pixel: climbing from the base (geodesic through the plant, so stems lead and blooms open last)
    const tauF = new Float32Array(W * H).fill(-1);
    const all = [];
    for (let i = 0; i < W * H; i++) if (owner[i] >= 0) { const p = plants[owner[i]], y = (i / W) | 0; if (y > p.base[1] - 18) all.push(i); }
    const gd = geodesic(dilate(red, 3), all);
    let gmax = 1;
    for (let i = 0; i < W * H; i++) if (gd[i] > gmax) gmax = gd[i];
    for (let i = 0; i < W * H; i++) {
      if (!red[i]) continue;
      const k = owner[i]; if (k < 0) continue;
      const p = plants[k], x = i % W, y = (i - x) / W;
      const dist = gd[i] >= 0 ? gd[i] : (p.base[1] - y) * 1.2 + 40;
      void x;
      tauF[i] = p.tLand + 0.2 + 3.4 * Math.pow(Math.min(1, dist / 520), 0.85) + 0.9 * (vn(x / 26, y / 26, 44) - 0.5) + 0.35 * (vn(x / 8, y / 8, 47) - 0.5) + 0.12 * (vn(x / 2.5, y / 2.5, 46) - 0.5);
    }
    K.flowers = growth(d2, c2, (c) => c === B_FLOWER, (x, y, i) => (tauF[i] >= 0 ? tauF[i] : 12.5), null, 0.3);
    // --- the staff grows up out of the grass into his hand
    const stM = new Uint8Array(W * H), stSeeds = [];
    for (let i = 0; i < W * H; i++) if (c2[i] === B_STAFF) { stM[i] = 1; const y = (i / W) | 0; if (y > 1880) stSeeds.push(i); }
    const sd = geodesic(stM, stSeeds.length ? stSeeds : [STAFF2[STAFF2.length - 1][1] * W]);
    let smax = 1; for (let i = 0; i < W * H; i++) if (sd[i] > smax) smax = sd[i];
    K.staff = growth(d2, c2, (c) => c === B_STAFF, (x, y, i) => 10.4 + 2.4 * (sd[i] >= 0 ? sd[i] / smax : (1880 - y) / 900), null, 0.15);
    // --- the bindings wind out from the wrist
    const bM = new Uint8Array(W * H), bSeeds = [];
    for (let i = 0; i < W * H; i++) if (c2[i] === B_BIND) { bM[i] = 1; const x = i % W, y = (i - x) / W; if (x < 470 && y < 900) bSeeds.push(i); }
    const bd = geodesic(bM, bSeeds);
    let bmax = 1; for (let i = 0; i < W * H; i++) if (bd[i] > bmax) bmax = bd[i];
    K.bind = growth(d2, c2, (c) => c === B_BIND, (x, y, i) => 12.4 + 2.2 * (bd[i] >= 0 ? bd[i] / bmax : 0.7 + 0.3 * ih(x, y, 9)), null, 0.25);
  }

  /* ================================================================ seeds (the flecks) */
  function buildSeeds() {
    const d1 = K.d1.data;
    // sprites of the flecks
    K.fleckS = K.flecks.map((c) => {
      const x0 = c.x0, y0 = c.y0, w = c.x1 - c.x0 + 1, h = c.y1 - c.y0 + 1, a = new Uint8ClampedArray(w * h * 4);
      const au = new Uint8ClampedArray(w * h * 4), u = K.u1;
      for (const i of c.px) { const x = i % W, y = (i - x) / W, o = ((y - y0) * w + x - x0) * 4; a[o] = d1[i * 4]; a[o + 1] = d1[i * 4 + 1]; a[o + 2] = d1[i * 4 + 2]; a[o + 3] = 255; au[o] = u[i * 4]; au[o + 1] = u[i * 4 + 1]; au[o + 2] = u[i * 4 + 2]; au[o + 3] = u[i * 4 + 3]; }
      return { c: canvasFrom(a, w, h), cu: canvasFrom(au, w, h), x: x0, y: y0, w, h, cx: (c.x0 + c.x1 + 1) / 2, cy: (c.y0 + c.y1 + 1) / 2, n: c.n };
    });
    const F = K.fleckS.map((f, k) => ({ f, k }));
    // the two flecks highest in the air become the two birds; the rest are seed
    F.sort((a, b) => a.f.cy - b.f.cy);
    const birdsrc = F.slice(0, Math.min(K.birdS.length, 2));
    K.birdPairs = birdsrc.map((o, j) => ({ fleck: o.f, bird: K.birdS[j] }));
    const seeders = F.slice(birdsrc.length).map((o) => o.f);
    // each plant takes a seed from the nearest fleck (by order across the frame); a fleck may hold many seeds
    const plants = K.plants.slice().sort((a, b) => b.base[0] - a.base[0]);
    K.seeds = plants.map((p, j) => {
      const f = seeders[Math.floor(j * seeders.length / plants.length) % seeders.length];
      return { f, p, burst: 4.3 + 1.2 * ih(j, 1, 3), j };
    });
  }
  // a fleck drifts with the wind before it bursts
  function fleckPos(f, t, k) {
    const u = Math.max(0, t - TA);
    const w = s3(clamp(u / 2.5, 0, 1));
    return [f.cx + w * (26 * u + 9 * Math.sin(1.3 * u + k)) , f.cy + w * (-14 * u + 7 * Math.sin(2.1 * u + 2 * k))];
  }

  /* ================================================================ the body warp (WebGL, thin-plate spline) */
  function tpsSolve(src, dst) {
    const n = src.length, N = n + 3, A = [];
    for (let i = 0; i < N; i++) A.push(new Float64Array(N + 2));
    const U = (r2) => (r2 < 1e-12 ? 0 : r2 * Math.log(r2) * 0.5);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) { const dx = src[i][0] - src[j][0], dy = src[i][1] - src[j][1]; A[i][j] = U(dx * dx + dy * dy); }
      A[i][i] += 1e-3;
      A[i][n] = 1; A[i][n + 1] = src[i][0]; A[i][n + 2] = src[i][1];
      A[n][i] = 1; A[n + 1][i] = src[i][0]; A[n + 2][i] = src[i][1];
      A[i][N] = dst[i][0]; A[i][N + 1] = dst[i][1];
    }
    // Gaussian elimination with two right-hand sides
    for (let c = 0; c < N; c++) {
      let p = c; for (let r = c + 1; r < N; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
      [A[c], A[p]] = [A[p], A[c]];
      const v = A[c][c] || 1e-12;
      for (let r = 0; r < N; r++) {
        if (r === c) continue;
        const f = A[r][c] / v; if (!f) continue;
        for (let k = c; k < N + 2; k++) A[r][k] -= f * A[c][k];
      }
    }
    const wx = new Float64Array(N), wy = new Float64Array(N);
    for (let i = 0; i < N; i++) { wx[i] = A[i][N] / A[i][i]; wy[i] = A[i][N + 1] / A[i][i]; }
    return (x, y) => {
      let X = wx[n] + wx[n + 1] * x + wx[n + 2] * y, Y = wy[n] + wy[n + 1] * x + wy[n + 2] * y;
      for (let i = 0; i < n; i++) { const dx = x - src[i][0], dy = y - src[i][1], u = U(dx * dx + dy * dy); X += wx[i] * u; Y += wy[i] * u; }
      return [X, Y];
    };
  }
  const GX = 46, GY = 81;         // mesh resolution
  function initGL() {
    const c = mk(W, H);
    const gl = c.getContext('webgl2', { premultipliedAlpha: true, preserveDrawingBuffer: true, antialias: false, alpha: true });
    if (!gl) throw new Error('WebGL2 is not available');
    const vs = `#version 300 es
      in vec2 aPos; in vec2 aUv1; in vec2 aUv2;
      out vec2 vUv1; out vec2 vUv2;
      void main(){ vUv1 = aUv1; vUv2 = aUv2; gl_Position = vec4(aPos.x / ${W}.0 * 2.0 - 1.0, 1.0 - aPos.y / ${H}.0 * 2.0, 0.0, 1.0); }`;
    const fs = `#version 300 es
      precision highp float;
      in vec2 vUv1; in vec2 vUv2; out vec4 o;
      uniform sampler2D t1; uniform sampler2D t2; uniform float uT; uniform float uWipe;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float n2(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.0-2.0*f);
        return mix(mix(h(i), h(i+vec2(1,0)), u.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), u.x), u.y); }
      void main(){
        vec4 a = texture(t1, vUv1 / vec2(${W}.0, ${H}.0));
        vec4 b = texture(t2, vUv2 / vec2(${W}.0, ${H}.0));
        if (vUv1.x < 0.0 || vUv1.y < 0.0 || vUv1.x > ${W}.0 || vUv1.y > ${H}.0) a = vec4(0.0);
        if (vUv2.x < 0.0 || vUv2.y < 0.0 || vUv2.x > ${W}.0 || vUv2.y > ${H}.0) b = vec4(0.0);
        // the last frame's material flows down him from the hood
        float tau = 3.4 + 7.8 * clamp((vUv2.y - 230.0) / 1450.0, 0.0, 1.0) + 1.1 * (n2(vUv2 / 60.0) - 0.5) + 0.35 * (n2(vUv2 / 9.0) - 0.5);
        float m = smoothstep(tau, tau + 0.9, uT) * uWipe + (1.0 - uWipe) * 0.0;
        o = mix(a, b, m);
      }`;
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
    const pr = gl.createProgram();
    gl.attachShader(pr, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(pr));
    gl.useProgram(pr);
    const tex = (canvas, unit) => {
      const t = gl.createTexture(); gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      return t;
    };
    const full = (L) => { const c2 = mk(W, H); c2.getContext('2d').drawImage(L.c, L.x, L.y); return c2; };
    tex(full(K.body1u), 0); tex(full(K.body2), 1);
    gl.uniform1i(gl.getUniformLocation(pr, 't1'), 0); gl.uniform1i(gl.getUniformLocation(pr, 't2'), 1);
    const nV = (GX + 1) * (GY + 1);
    const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    const data = new Float32Array(nV * 6);
    gl.bufferData(gl.ARRAY_BUFFER, data.byteLength, gl.DYNAMIC_DRAW);
    const loc = (n) => gl.getAttribLocation(pr, n);
    gl.enableVertexAttribArray(loc('aPos')); gl.vertexAttribPointer(loc('aPos'), 2, gl.FLOAT, false, 24, 0);
    gl.enableVertexAttribArray(loc('aUv1')); gl.vertexAttribPointer(loc('aUv1'), 2, gl.FLOAT, false, 24, 8);
    gl.enableVertexAttribArray(loc('aUv2')); gl.vertexAttribPointer(loc('aUv2'), 2, gl.FLOAT, false, 24, 16);
    const ix = [];
    for (let j = 0; j < GY; j++) for (let i = 0; i < GX; i++) { const a = j * (GX + 1) + i, b = a + 1, c = a + GX + 1, d = c + 1; ix.push(a, b, c, b, d, c); }
    const ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(ix), gl.STATIC_DRAW);
    K.gl = { c, gl, pr, data, nI: ix.length, uT: gl.getUniformLocation(pr, 'uT'), uWipe: gl.getUniformLocation(pr, 'uWipe') };
  }
  const warpE = (t) => E(t, 1.8, 12.2);
  function landmarksAt(t) {
    const e = warpE(t);
    // a walking sway in the hem and tatters while he changes, gone by the end
    const sway = Math.sin(TAU * 0.95 * (t - 3)) * E(t, 3.5, 6) * (1 - E(t, 10.5, 12.2));
    return LMK.map(([a, b], k) => {
      const low = clamp((a[1] - 1300) / 500, 0, 1), side = clamp((a[0] - 650) / 200, 0, 1);
      // a little arc in the path: the head turns away (moves left) before it rises
      const bend = Math.sin(Math.PI * e) * (k <= 5 ? -60 : 0);
      return [lerp(a[0], b[0], e) + bend + 14 * sway * (low + side), lerp(a[1], b[1], e) + 6 * sway * low];
    });
  }
  function drawBodyGL(t) {
    const G = K.gl, gl = G.gl;
    const L = landmarksAt(t), A = LMK.map((p) => p[0]), B = LMK.map((p) => p[1]);
    const f1 = tpsSolve(L, A), f2 = tpsSolve(L, B);
    const d = G.data;
    let k = 0;
    for (let j = 0; j <= GY; j++) for (let i = 0; i <= GX; i++) {
      const x = (i / GX) * W, y = (j / GY) * H;
      const u1 = f1(x, y), u2 = f2(x, y);
      d[k++] = x; d[k++] = y; d[k++] = u1[0]; d[k++] = u1[1]; d[k++] = u2[0]; d[k++] = u2[1];
    }
    gl.viewport(0, 0, W, H);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, d);
    gl.uniform1f(G.uT, t); gl.uniform1f(G.uWipe, 1);
    gl.drawElements(gl.TRIANGLES, G.nI, gl.UNSIGNED_SHORT, 0);
    return G.c;
  }

  /* ================================================================ the scythe (strip warp along its centreline) */
  function stripTex(poly, d, keep, hiddenFill) {
    // straighten: column s along the curve, row = offset across it
    const r = resample(poly, 1);
    const pts = r.pts, len = pts.length, maxW = Math.ceil(Math.max(...poly.w)) + 3, hgt = maxW * 2 + 1;
    const a = new Uint8ClampedArray(len * hgt * 4);
    // per-point segment index on the original polyline (for the hidden run)
    const segOf = (p) => p.seg;
    let col = [0, 0, 0], cn = 0;
    pts.forEach((p, s) => {
      const nx = -p.ty, ny = p.tx;
      for (let o = -maxW; o <= maxW; o++) {
        const x = Math.round(p.x + nx * o - 0.5), y = Math.round(p.y + ny * o - 0.5);
        if (x < 0 || y < 0 || x >= W || y >= H) continue;
        const i = y * W + x, q = ((o + maxW) * len + s) * 4;
        if (keep(i)) { a[q] = d[i * 4]; a[q + 1] = d[i * 4 + 1]; a[q + 2] = d[i * 4 + 2]; a[q + 3] = d[i * 4 + 3]; if (Math.abs(o) < 3) { col[0] += d[i * 4]; col[1] += d[i * 4 + 1]; col[2] += d[i * 4 + 2]; cn++; } }
      }
    });
    col = col.map((v) => v / Math.max(1, cn));
    const vis = new Uint8Array(len).fill(1);
    if (hiddenFill) {
      // the run hidden behind the body: a plain shaft, drawn in its own colour with a dark edge
      pts.forEach((p, s) => {
        const sg = segOf(p);
        if (sg <= hiddenFill[0] || sg >= hiddenFill[1]) return;
        vis[s] = 0;
        const hw = Math.max(4, p.w);
        for (let o = -Math.ceil(hw); o <= Math.ceil(hw); o++) {
          const q = ((o + maxW) * len + s) * 4, edge = Math.abs(o) >= hw - 1.2;
          const k = edge ? 0.35 : 0.85 + 0.15 * vn(s / 14, o / 2, 61);
          a[q] = col[0] * k; a[q + 1] = col[1] * k; a[q + 2] = col[2] * k; a[q + 3] = 255;
        }
      });
    }
    return { c: canvasFrom(a, len, hgt), len, hgt, maxW, pts, vis };
  }
  function curveAt(pts, u) {    // point & tangent at fraction u of the arc
    const L = pts[pts.length - 1].s, s = u * L;
    let lo = 0, hi = pts.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (pts[m].s <= s) lo = m; else hi = m; }
    const a = pts[lo], b = pts[hi], f = b.s > a.s ? (s - a.s) / (b.s - a.s) : 0;
    return { x: lerp(a.x, b.x, f), y: lerp(a.y, b.y, f), w: lerp(a.w, b.w, f) };
  }
  // the scythe's pose: the first frame's curve, rigidly lifted and swung about the grip, then bent onto the last's
  const SWING = 2.87;            // radians, clockwise on screen
  function scythePose(t) {
    const rot = SWING * E(t, 2.6, 9.0);
    const g1 = K.grip1, g2 = K.grip2;
    const gm = E(t, 2.5, 9.4);
    const lift = Math.sin(Math.PI * E(t, 2.5, 9.4)) * 70;
    const G = [lerp(g1[0], g2[0], gm), lerp(g1[1], g2[1], gm) - lift];
    const b = E(t, 7.0, 11.8);
    return { rot, G, b };
  }
  function scytheCurves(t) {
    const pose = scythePose(t);
    const c = Math.cos(pose.rot), s = Math.sin(pose.rot);
    const N = 220;
    const mapPart = (P1, P2) => {
      const out = [];
      for (let k = 0; k <= N; k++) {
        const u = k / N, a = curveAt(P1, u), b = curveAt(P2, u);
        const dx = a.x - K.grip1[0], dy = a.y - K.grip1[1];
        const rx = pose.G[0] + c * dx - s * dy, ry = pose.G[1] + s * dx + c * dy;
        out.push({ x: lerp(rx, b.x, pose.b), y: lerp(ry, b.y, pose.b), w1: a.w, w2: b.w, u });
      }
      for (let k = 0; k <= N; k++) {
        const p = out[Math.max(0, k - 2)], q = out[Math.min(N, k + 2)], L = Math.hypot(q.x - p.x, q.y - p.y) || 1;
        out[k].tx = (q.x - p.x) / L; out[k].ty = (q.y - p.y) / L;
      }
      return out;
    };
    return { shaft: mapPart(K.st1s.pts, K.st2s.pts), blade: mapPart(K.bt1.pts, K.bt2.pts), pose };
  }
  function drawStrip(g, curve, T1, T2, t, wipe0, wipe1, front) {
    const N = curve.length - 1;
    for (let k = 0; k < N; k++) {
      const p = curve[k], q = curve[k + 1];
      const segL = Math.hypot(q.x - p.x, q.y - p.y);
      const ang = Math.atan2(p.ty, p.tx);
      const m = s5(clamp((t - lerp(wipe0, wipe1, p.u)) / 0.8, 0, 1));
      for (const [T, a, other] of [[T1, 1 - m, false], [T2, m, true]]) {
        if (a <= 0.003) continue;
        const s0 = p.u * (T.len - 1), s1 = q.u * (T.len - 1);
        const si = Math.floor(s0);
        if (front && !T.vis[Math.min(T.len - 1, Math.round((s0 + s1) / 2))]) continue;
        const wSrc = T.maxW, wDst = lerp(p.w1, p.w2, other ? 1 : 0) * 0 + (other ? p.w2 : p.w1);
        const sy = (lerp(p.w1, p.w2, m) + 0.5) / Math.max(1, (other ? p.w2 : p.w1) + 0.5);
        g.globalAlpha = other ? a : 1;
        g.setTransform(Math.cos(ang), Math.sin(ang), -Math.sin(ang), Math.cos(ang), p.x, p.y);
        g.scale(Math.max(1, segL) / Math.max(1, s1 - s0) * 1.0, sy);
        g.drawImage(T.c, si, 0, Math.max(1, Math.ceil(s1) - si + 1), T.hgt, 0, -wSrc - 0.5, Math.max(1, Math.ceil(s1) - si + 1), T.hgt);
        void wDst;
      }
    }
    g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1;
  }
  function drawScythe(g, t, front) {
    if (t < 2.6) { if (front || t < TA) return; const L = K.scy1; g.drawImage(L.c, L.x, L.y); return; }
    const x = E(t, 12.4, 13.1);
    if (x < 1) {
      const C = scytheCurves(t);
      g.save(); if (x > 0) g.globalAlpha = 1;
      drawStrip(g, C.shaft, K.st1s, K.st2s, t, 8.0, 10.6, front);
      drawStrip(g, C.blade, K.bt1, K.bt2, t, 7.6, 11.0, front);
      g.restore();
    }
    if (x > 0 && front) { g.globalAlpha = x; const L = K.scy2; g.drawImage(L.c, L.x, L.y); g.globalAlpha = 1; }
  }

  /* ================================================================ build all */
  async function build(img1, img2) {
    const t0 = performance.now();
    K.fit1 = fitCover(img1); K.fit2 = fitCover(img2);
    K.c1 = drawFit(img1, K.fit1); K.c2 = drawFit(img2, K.fit2);
    K.d1 = dataOf(K.c1); K.d2 = dataOf(K.c2);
    segment1();
    segment2();
    buildLayers();
    buildGrowth();
    buildSeeds();
    // scythe strips
    const d1 = K.d1.data, d2 = K.d2.data;
    K.st1s = stripTex(K.sh1, K.u1, (i) => K.cls1[i] === A_SCY, SHAFT1.hidden);
    K.bt1 = stripTex(K.bl1, K.u1, (i) => K.cls1[i] === A_SCY, null);
    K.st2s = stripTex(K.sh2, d2, (i) => K.cls2[i] === B_SCY, SHAFT2.hidden);
    K.bt2 = stripTex(K.bl2, d2, (i) => K.cls2[i] === B_SCY, null);
    const ug = 0.5;     // the grip: halfway along the shaft
    const a = curveAt(K.st1s.pts, ug), b = curveAt(K.st2s.pts, ug);
    K.grip1 = [a.x, a.y]; K.grip2 = [b.x, b.y];
    initGL();
    K.mid = mk(W, H);
    K.buildMs = performance.now() - t0;
    K.built = true;
  }

  /* ================================================================ frame */
  function drawSky(g, t) {
    g.imageSmoothingEnabled = false;
    g.drawImage(K.sky1, 0, 0);
    // a warm front rises through the sky from low on the right
    const f = lerp(2300, -900, E3(t, 1.0, 11.6));
    if (f < 2250) {
      const m = K.mid, mg = m.getContext('2d');
      mg.globalCompositeOperation = 'source-over'; mg.clearRect(0, 0, W, H);
      mg.drawImage(K.sky2, 0, 0);
      mg.globalCompositeOperation = 'destination-in';
      // gradient along (0.28, 1): orange below the front
      const dx = 0.27, dy = 0.963, band = 1000;
      const gr = mg.createLinearGradient(0, 0, dx * 3000, dy * 3000);
      const pos = (p) => clamp(p / 3000, 0, 1);
      gr.addColorStop(0, 'rgba(0,0,0,0)');
      gr.addColorStop(pos(f - band / 2), 'rgba(0,0,0,0)');
      gr.addColorStop(pos(f + band / 2), 'rgba(0,0,0,1)');
      gr.addColorStop(1, 'rgba(0,0,0,1)');
      mg.fillStyle = gr; mg.fillRect(0, 0, W, H);
      mg.globalCompositeOperation = 'source-over';
      g.drawImage(m, 0, 0);
    }
    g.imageSmoothingEnabled = true;
  }
  function drawStrip1(g, t) {
    const th = thetaAt(t);
    const S = K.strip;
    if (th <= 0) { g.imageSmoothingEnabled = false; g.drawImage(S.c, 150, 0, W, H - S.y, 0, S.y, W, H - S.y); g.imageSmoothingEnabled = true; return; }
    // hinged about the pivot, colour ripening toward the hill's gold
    const c = Math.cos(-th), s = Math.sin(-th);
    g.save();
    g.setTransform(c, s, -s, c, PIV[0] - c * PIV[0] + s * PIV[1], PIV[1] - s * PIV[0] - c * PIV[1]);
    const k = E(t, 3, 9);
    if (k > 0.002) g.filter = `sepia(${(0.5 * k).toFixed(3)}) saturate(${(1 + 0.9 * k).toFixed(3)}) hue-rotate(${(-12 * k).toFixed(1)}deg) brightness(${(1 - 0.25 * k).toFixed(3)})`;
    g.drawImage(S.c, S.x, S.y);
    g.filter = 'none';
    g.restore();
  }
  function drawBody(g, t) {
    if (t < 1.8) { g.imageSmoothingEnabled = false; g.drawImage(K.body1.c, K.body1.x, K.body1.y); g.imageSmoothingEnabled = true; return; }
    const x = E(t, 12.3, 12.9);
    if (x < 1) g.drawImage(drawBodyGL(t), 0, 0);
    if (x > 0) { g.globalAlpha = x; g.imageSmoothingEnabled = false; g.drawImage(K.body2.c, K.body2.x, K.body2.y); g.globalAlpha = 1; g.imageSmoothingEnabled = true; }
  }
  function drawSeeds(g, t) {
    // flecks drifting; at their burst they become seeds that fall to their plants
    const P = K.seeds;
    const byFleck = new Map();
    for (const s of P) { if (!byFleck.has(s.f)) byFleck.set(s.f, []); byFleck.get(s.f).push(s); }
    let k = 0;
    for (const [f, list] of byFleck) {
      const burst = list[0].burst;
      const pos = fleckPos(f, Math.min(t, burst), k);
      if (t < burst) {
        g.imageSmoothingEnabled = t > TA;
        g.drawImage(t > TA ? f.cu : f.c, f.x + pos[0] - f.cx, f.y + pos[1] - f.cy);
        g.imageSmoothingEnabled = true;
      } else {
        list.forEach((sd, j) => {
          const p = sd.p, tl = p.tLand;
          const u = clamp((t - burst) / Math.max(0.3, tl - burst), 0, 1);
          if (u >= 1) {
            // planted: it sinks into the ground as its stem rises out of it
            const sink = clamp((t - tl) / 0.5, 0, 1);
            if (sink >= 1) return;
            const sc = (1 - sink) * (list.length > 1 ? 0.8 : 1);
            g.save(); g.translate(p.base[0], p.base[1] - 3 + 4 * sink); g.scale(sc, sc); g.drawImage(f.cu, -f.w / 2, -f.h / 2); g.restore();
            return;
          }
          // a lofted arc, spinning
          const e = s3(u);
          const x = lerp(pos[0], p.base[0], e) + Math.sin(u * Math.PI) * (30 + 40 * ih(j, k, 5)) * (ih(j, 3, k) - 0.5) * 2;
          const y = lerp(pos[1], p.base[1] - 3, e * e) - Math.sin(u * Math.PI) * (90 + 120 * ih(j, 4, k));
          const sc = lerp(1, list.length > 1 ? 0.8 : 1, clamp(u * 4, 0, 1));
          g.save(); g.translate(x, y); g.rotate(u * (6 + 6 * ih(j, 5, k))); g.scale(sc, sc);
          g.drawImage(f.cu, -f.w / 2, -f.h / 2); g.restore();
        });
      }
      k++;
    }
    // two flecks rise and become the birds
    K.birdPairs.forEach((bp, j) => {
      const f = bp.fleck, b = bp.bird;
      const t0 = 3.8 + 0.6 * j;
      if (t < t0) { const p = fleckPos(f, t, 50 + j); g.imageSmoothingEnabled = t > TA; g.drawImage(t > TA ? f.cu : f.c, f.x + p[0] - f.cx, f.y + p[1] - f.cy); g.imageSmoothingEnabled = true; return; }
      const p0 = fleckPos(f, t0, 50 + j), u = E(t, t0, 15.2);
      const P1 = [p0[0] + 160, p0[1] - 420], P2 = [b.cx + 140, b.cy - 160], P3 = [b.cx, b.cy];
      const w = 1 - u;
      const x = w * w * w * p0[0] + 3 * w * w * u * P1[0] + 3 * w * u * u * P2[0] + u * u * u * P3[0];
      const y = w * w * w * p0[1] + 3 * w * w * u * P1[1] + 3 * w * u * u * P2[1] + u * u * u * P3[1];
      const flap = 1 - E(t, 13.8, 15.2);
      const sy = lerp(1, Math.cos(TAU * 3.2 * (t - t0) + j), flap);
      const m = E(t, t0 + 0.4, t0 + 3.0);
      g.save(); g.translate(x, y); g.scale(1, Math.abs(sy) < 0.2 ? 0.2 * Math.sign(sy || 1) : sy);
      g.imageSmoothingEnabled = !(u >= 1 && flap <= 0);
      // the fleck takes the bird's shape as it flies (the two ink marks are the same size)
      if (m < 1) { g.globalAlpha = 1; g.drawImage(f.cu, -f.w / 2, -f.h / 2); }
      if (m > 0) { g.globalAlpha = m; g.drawImage(b.c, -b.w / 2, -b.h / 2); }
      g.restore(); g.globalAlpha = 1; g.imageSmoothingEnabled = true;
    });
  }
  function drawSig(g, t) {
    const S = K.sig; if (!S) return;
    const u = E(t, 5.0, 10.2);
    if (u <= 0) { g.imageSmoothingEnabled = false; g.drawImage(S.c, S.x, S.y); g.imageSmoothingEnabled = true; return; }
    // it slides down onto the slope, lying over into the grass where the last frame's mark is
    const tx = 790, ty = 1590;
    const x = lerp(S.x + S.w / 2, tx, u), y = lerp(S.y + S.h / 2, ty, u) - Math.sin(Math.PI * u) * 60;
    g.save(); g.translate(x, y); g.rotate(-1.57 * s3(u) - 0.3 * s3(u)); g.scale(1, lerp(1, 0.7, u));
    g.drawImage(K.sigU.c, -S.w / 2, -S.h / 2); g.restore();
  }

  function render(g, t) {
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalAlpha = 1; g.filter = 'none'; g.globalCompositeOperation = 'source-over';
    if (t < TA) { g.imageSmoothingEnabled = false; g.drawImage(K.c1, 0, 0); g.imageSmoothingEnabled = true; return; }
    if (t >= TB) { g.imageSmoothingEnabled = false; g.drawImage(K.c2, 0, 0); g.imageSmoothingEnabled = true; return; }
    const on = (n) => !SOWER.only || SOWER.only.includes(n);
    if (on('sky')) drawSky(g, t);
    if (on('scythe')) drawScythe(g, t, false);
    if (on('strip')) drawStrip1(g, t);
    if (on('body')) drawBody(g, t);
    if (on('bind')) drawGrowth(g, K.bind, t);
    if (on('scythe')) drawScythe(g, t, true);
    if (on('sig')) drawSig(g, t);
    if (on('hill')) drawGrowth(g, K.hill, t);
    if (on('staff')) drawGrowth(g, K.staff, t);
    if (on('hand') && t > 12.6) { g.globalAlpha = E(t, 12.6, 13.2); g.drawImage(K.hand.c, K.hand.x, K.hand.y); g.globalAlpha = 1; }
    if (on('flowers')) drawGrowth(g, K.flowers, t);
    if (on('seeds')) drawSeeds(g, t);
    const k = SOWER.noSettle ? 0 : E(t, 15.35, TB);
    if (k > 0) { g.globalAlpha = k; g.imageSmoothingEnabled = false; g.drawImage(K.c2, 0, 0); g.globalAlpha = 1; g.imageSmoothingEnabled = true; }
  }

  function debugView(g, what) {
    const id = g.createImageData(W, H), a = id.data;
    const pal1 = [[200, 220, 255], [230, 200, 120], [30, 30, 30], [160, 90, 30], [255, 0, 255], [255, 0, 0]];
    const pal2 = [[200, 220, 255], [230, 170, 60], [20, 30, 70], [160, 90, 30], [120, 60, 0], [0, 200, 0], [255, 0, 0], [255, 0, 255]];
    const cls = what === 'seg1' ? K.cls1 : K.cls2, pal = what === 'seg1' ? pal1 : pal2;
    for (let i = 0; i < W * H; i++) { const c = pal[cls[i]] || [255, 255, 255]; a[i * 4] = c[0]; a[i * 4 + 1] = c[1]; a[i * 4 + 2] = c[2]; a[i * 4 + 3] = 255; }
    g.putImageData(id, 0, 0);
  }

  const SOWER = {
    only: null, noSettle: false,
    W, H, FPS, D, NF, TA, TB, K,
    build, render, debugView,
    info: () => ({ buildMs: K.buildMs, flecks: K.flecks.length, plants: K.plants.length, birds: K.birdS.length,
      seeds: K.seeds.length, hillPx: K.hill.idx.length, flowerPx: K.flowers.idx.length, fit1: K.fit1, fit2: K.fit2,
      grip1: K.grip1, grip2: K.grip2, hand: K.hand && [K.hand.x, K.hand.y, K.hand.w, K.hand.h] }),
  };
  window.SOWER = SOWER;
})();
