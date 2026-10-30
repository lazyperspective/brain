/* Keyframes — "The Red Gathers".
 *
 * A first-frame / last-frame film made in code. The two keyframes (assets/first.jpg, assets/last.jpg) are the only
 * images; the 15 s between them is computed here, every frame a pure function of t.
 *
 *   0.0 – 1.0   the first keyframe, held exactly.
 *   1.0 – 4.0   the wind rises. The blossom comes apart cell by cell: each petal is a piece cut from the painting's
 *               own pink-red pixels, and it tumbles off on the wind. The tree sways. The traveller turns to watch it
 *               go, turns back, and walks out through the gate; the camera begins to follow.
 *   4.0 – 9.5   the journey. The camera tracks him, pulls back and tilts down: the mountain recedes and sinks below
 *               the horizon, the ground narrows into a spit and the sea opens beneath it. The petals run alongside
 *               in a ribbon. Colour drains to grey — except the reds. The gate's red paint peels off and joins the
 *               stream; the grey things he leaves behind (bare tree, terrace, the gate's ink) crumble into flakes.
 *   9.3 – 13.0  the red gathers. Every red particle spirals into one disc and becomes the sun; the grey flakes turn
 *               to ink and fly in to assemble the tree and the stilt house, while the cliff rises out of the sea —
 *               all of it cut from the last frame's own dark mask, so each piece lands on its own pixels.
 *  12.0 – 15.5  he reaches the end of the land; the wind takes his hat; he steps onto the rock and sits. Birds lift
 *               off the cliff and past the sun. The sea stills.
 *  16.0 – 17.5  the last keyframe, held exactly.
 *
 * Nothing is traced: segmentation is by colour and region, particles are Voronoi cells of the keyframes' own pixels,
 * hidden areas are filled procedurally, and the traveller, the hat, the wind and the waves are drawn in code.
 */
(function () {
  'use strict';

  /* ================================================================ constants & helpers */
  const W = 1080, H = 1920, FPS = 30, D = 17.5, NF = Math.round(D * FPS);
  const TA = 1.0, TB = 16.0;                      // the procedural span
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

  /* ================================================================ the built world */
  const K = { built: false };

  // F1 classes
  const SKY = 0, MTN = 1, BLOS = 2, TREE = 3, TERR = 4, GRED = 5, GDARK = 6, FIG = 7, GRND = 8, SEAL = 9;
  // F2 classes
  const S2SKY = 0, S2SUN = 1, S2BLOCK = 2, S2CELL = 3, S2ROCK = 4, S2FIG = 5, S2BIRD = 6, S2SEA = 7;

  /* ---------------------------------------------------------------- timeline (camera & walker) */
  // Camera: pan Cx (world px), pull-back Z, tilt Ty. World -> screen for the near layers:
  //   x' = Z (x - TX0 - Cx) + TX0,   y' = Z (y - YG) + YG - Ty
  // where TX0 is the traveller's x in the first frame and YG its ground line.
  const ZEND = 0.71;
  const Zf = (t) => 1 - (1 - ZEND) * E(t, 2.8, 11.6);
  let TYEND = 260;
  const Tyf = (t) => TYEND * E(t, 3.0, 11.0);
  const CAM_DT = 1 / 600;
  let CXT = null, XTT = null, CXEND = 0, TX0 = 838, YG = 1766, TIPW = 0, T_TIP = 12, T_STOP = 13.7;
  const CV = 160;
  function camSpeed(t) { return CV * s3(R(t, 2.9, 4.9)) * (1 - s3(R(t, 7.3, 12.0))); }
  function tab(arr, t) {
    const x = clamp(t / CAM_DT, 0, arr.length - 1.001), i = Math.floor(x), f = x - i;
    return arr[i] + (arr[i + 1] - arr[i]) * f;
  }
  const Cxf = (t) => tab(CXT, t);
  const XTf = (t) => tab(XTT, t);
  function buildTimeline() {
    const n = Math.ceil((D + 1) / CAM_DT) + 2;
    CXT = new Float64Array(n); XTT = new Float64Array(n);
    let cx = 0;
    for (let i = 0; i < n; i++) { CXT[i] = cx; cx += camSpeed(i * CAM_DT) * CAM_DT; }
    CXEND = CXT[n - 1];
    // the walker stops with his feet at screen x = SEATX once the camera has stopped
    const stopW = TX0 + CXEND + (K.SEATX - TX0) / ZEND;
    const ACC = 70;
    const run = (VW) => {
      let x = TX0, tStop = 99;
      for (let i = 0; i < n; i++) {
        const t = i * CAM_DT;
        XTT[i] = x;
        const rem = stopW - x;
        let v = VW * s3(R(t, 2.45, 3.15));
        v = Math.min(v, Math.sqrt(Math.max(0, 2 * ACC * rem)));
        if (rem <= 0.05) { v = 0; if (tStop > 90) tStop = t; }
        x += v * CAM_DT;
      }
      return tStop;
    };
    let lo = 40, hi = 200;
    for (let k = 0; k < 40; k++) { const m = (lo + hi) / 2; if (run(m) > T_STOP) lo = m; else hi = m; }
    K.VW = hi; run(hi);
    TIPW = TX0 + CXEND + (K.TIPX - TX0) / ZEND;
    // when he reaches the tip
    for (let i = 0; i < n; i++) if (XTT[i] >= TIPW) { T_TIP = i * CAM_DT; break; }
  }
  function near(t) {           // affine of the near layers: x' = a x + e, y' = a y + f
    const Z = Zf(t);
    return { a: Z, e: TX0 - Z * (TX0 + Cxf(t)), f: YG - Z * YG - Tyf(t) };
  }
  const horizon = (t) => YG - Tyf(t);
  // the F2 elements are world-attached once the camera nears the end of its move
  const dxF2 = (t) => -Zf(t) * (Cxf(t) - CXEND);

  /* ---------------------------------------------------------------- wind */
  const windAmt = (t) => E(t, 1.0, 3.0) * (1 - 0.35 * E(t, 9.5, 12.5)) * (1 - 0.65 * E(t, 13.5, 16));

  /* ================================================================ build: keyframe 1 */
  function fitCover(img, bias) {
    const w = img.naturalWidth, h = img.naturalHeight, s = Math.max(W / w, H / h);
    const sw = W / s, sh = H / s;
    return { s, sx: (w - sw) * bias, sy: (h - sh) / 2, sw, sh, w, h };
  }
  function drawFit(img, f) {
    const c = mk(W, H), g = c.getContext('2d');
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    g.drawImage(img, f.sx, f.sy, f.sw, f.sh, 0, 0, W, H);
    return c;
  }
  function dataOf(c) { return c.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, c.width, c.height); }
  function canvasFrom(rgba, w, h) {
    const c = mk(w, h), g = c.getContext('2d');
    const id = g.createImageData(w, h); id.data.set(rgba); g.putImageData(id, 0, 0);
    return c;
  }
  // separable square dilation of a 0/1 mask
  function dilate(m, w, h, r) {
    const a = new Uint8Array(w * h), b = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) {
      let run = -1e9;
      for (let x = 0; x < w; x++) { if (m[y * w + x]) run = x; a[y * w + x] = x - run <= r ? 1 : 0; }
      run = 1e9;
      for (let x = w - 1; x >= 0; x--) { if (m[y * w + x]) run = x; if (run - x <= r) a[y * w + x] = 1; }
    }
    for (let x = 0; x < w; x++) {
      let run = -1e9;
      for (let y = 0; y < h; y++) { if (a[y * w + x]) run = y; b[y * w + x] = y - run <= r ? 1 : 0; }
      run = 1e9;
      for (let y = h - 1; y >= 0; y--) { if (a[y * w + x]) run = y; if (run - y <= r) b[y * w + x] = 1; }
    }
    return b;
  }

  function segment1() {
    const f = K.fit1, d = K.d1.data, cls = new Uint8Array(W * H);
    const OX = new Float32Array(W), OY = new Float32Array(H);
    for (let x = 0; x < W; x++) OX[x] = (x + 0.5) / f.s + f.sx;
    for (let y = 0; y < H; y++) OY[y] = (y + 0.5) / f.s + f.sy;
    const P1x = (ox) => (ox - f.sx) * f.s, P1y = (oy) => (oy - f.sy) * f.s;
    K.P1x = P1x; K.P1y = P1y;
    // the mountain's slopes (fitted on the first frame, original pixel units)
    const xl = (oy) => 409 - 1.097 * (oy - 730), xr = (oy) => 762 + 1.012 * (oy - 730);
    // pass 1: blossom candidates
    const blos = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x, r = d[i * 4], g = d[i * 4 + 1], b = d[i * 4 + 2];
      if (r - Math.max(g, b) > 32 && r > 95 && OY[y] < 1879.5) blos[i] = 1;
    }
    const dil = dilate(blos, W, H, 7);
    YG = Math.ceil(P1y(1879.5) - 0.5);
    for (let y = 0; y < H; y++) {
      const oy = OY[y];
      for (let x = 0; x < W; x++) {
        const ox = OX[x], i = y * W + x, r = d[i * 4], g = d[i * 4 + 1], b = d[i * 4 + 2];
        const dsky = Math.abs(r - 52) + Math.abs(g - 64) + Math.abs(b - 66);
        const red = r - Math.max(g, b);
        const dmtn = Math.abs(r - 72) + Math.abs(g - 86) + Math.abs(b - 87);
        const bgl = dsky < 16 || dmtn < 22;       // sky or mountain body behind an object
        let c;
        if (y >= YG) {
          c = (ox > 1040 && oy > 1950 && lumOf(r, g, b) < 172) ? SEAL : GRND;
        } else if (ox >= 860 && ox <= 952 && oy >= 1708 && !bgl && red < 30 &&
                   (ox < 941 || segDist(ox, oy, 905, 1800, 949, 1860) < 2.6)) {
          c = FIG;
        } else if (ox >= 588 && ox <= 1122 && oy >= 1444 && !bgl) {
          c = red > 28 ? GRED : GDARK;
        } else if (blos[i]) {
          c = BLOS;
        } else if (((oy >= 1708 && ox < 692) || (ox >= 462 && ox <= 516 && oy >= 1598)) && !bgl) {
          c = TERR;
        } else if ((dil[i] || (ox > 118 && ox < 645 && oy > 1270)) && dsky > 18 &&
                   !(Math.abs(r - 72) + Math.abs(g - 86) + Math.abs(b - 87) < 20)) {
          c = TREE;
        } else {
          // mountain cone, with a colour decision in a 3 px band along its edge
          const inX = oy >= 572 && ox >= xl(oy) - 3 && ox <= xr(oy) + 3;
          const inS = oy >= 600 && ox >= xl(oy) + 3 && ox <= xr(oy) - 3;
          if (inS) c = MTN;
          else if (inX) c = dsky < 10 ? SKY : MTN;
          else c = dsky < 14 ? SKY : MTN;
        }
        cls[i] = c;
      }
    }
 // each object keeps its antialiased rim (2 px) so moving it leaves no outline behind
    const OBJ = (c) => c === BLOS || c === TREE || c === TERR || c === GRED || c === GDARK || c === FIG;
    for (let pass = 0; pass < 2; pass++) {
      const take = new Int16Array(W * H).fill(-1);
      for (let y = 1; y < YG - 1; y++) for (let x = 1; x < W - 1; x++) {
        const i = y * W + x, c = cls[i]; if (c !== SKY && c !== MTN) continue;
        const r = d[i * 4], g = d[i * 4 + 1], b = d[i * 4 + 2];
        const dev = Math.min(Math.abs(r - 52) + Math.abs(g - 64) + Math.abs(b - 66), Math.abs(r - 72) + Math.abs(g - 86) + Math.abs(b - 87));
        if (dev < 9 || lumOf(r, g, b) > 120) continue;
        let best = -1, bd = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const j = i + dy * W + dx, cj = cls[j]; if (!OBJ(cj)) continue;
          const dd = Math.abs(d[j * 4] - r) + Math.abs(d[j * 4 + 1] - g) + Math.abs(d[j * 4 + 2] - b);
          if (dd > bd) { bd = dd; best = cj; }
        }
        if (best >= 0) take[i] = best;
      }
      for (let i = 0; i < W * H; i++) if (take[i] >= 0) cls[i] = take[i];
    }
    K.cls1 = cls;
    K.cone = (ox, oy) => oy >= 572 && ox >= xl(oy) - 3 && ox <= xr(oy) + 3;
    K.OX = OX; K.OY = OY;
  }
  function segDist(px, py, ax, ay, bx, by) {
    const vx = bx - ax, vy = by - ay, u = clamp(((px - ax) * vx + (py - ay) * vy) / (vx * vx + vy * vy), 0, 1);
    return Math.hypot(px - ax - u * vx, py - ay - u * vy);
  }

  function layers1() {
    const d = K.d1.data, cls = K.cls1;
    // --- sky: exact sky pixels, the rest filled with the row's mean sky colour
    const sky = new Uint8ClampedArray(W * H * 4);
    let last = [52, 64, 66];
    for (let y = 0; y < H; y++) {
      let n = 0, sr = 0, sg = 0, sb = 0;
      for (let x = 0; x < W; x++) { const i = y * W + x; if (cls[i] === SKY) { n++; sr += d[i * 4]; sg += d[i * 4 + 1]; sb += d[i * 4 + 2]; } }
      if (n > 40) last = [sr / n, sg / n, sb / n];
      for (let x = 0; x < W; x++) {
        const i = y * W + x, o = i * 4;
        if (cls[i] === SKY) { sky[o] = d[o]; sky[o + 1] = d[o + 1]; sky[o + 2] = d[o + 2]; }
        else { const j = ih(x, y, 7) * 2 - 1; sky[o] = last[0] + j; sky[o + 1] = last[1] + j; sky[o + 2] = last[2] + j; }
        sky[o + 3] = 255;
      }
    }
    K.sky1 = canvasFrom(sky, W, H);

    // --- mountain: exact pixels + a procedural body (colour + ink hatching) where it is hidden
    let n = 0, br = 0, bg = 0, bb = 0;
    for (let i = 0; i < W * H; i++) if (cls[i] === MTN) { const l = lumOf(d[i * 4], d[i * 4 + 1], d[i * 4 + 2]); if (l > 70 && l < 100) { n++; br += d[i * 4]; bg += d[i * 4 + 1]; bb += d[i * 4 + 2]; } }
    const body = [br / n, bg / n, bb / n];
    const MX = 700, mc = mk(W + 2 * MX, H), mg = mc.getContext('2d');
    mg.translate(MX, 0);
    const P1x = K.P1x, P1y = K.P1y;
    const xl = (oy) => 409 - 1.097 * (oy - 730), xr = (oy) => 762 + 1.012 * (oy - 730);
    mg.fillStyle = `rgb(${body.map(Math.round).join(',')})`;
    mg.beginPath();
    mg.moveTo(P1x(xl(2100)), P1y(2100)); mg.lineTo(P1x(xl(600)), P1y(600)); mg.lineTo(P1x(575), P1y(574));
    mg.lineTo(P1x(628), P1y(573)); mg.lineTo(P1x(xr(600)), P1y(600)); mg.lineTo(P1x(xr(2100)), P1y(2100)); mg.closePath();
    mg.fill();
    mg.save(); mg.clip();
    // hatching that runs down the slopes, as the painting's own does
    const rnd = mulberry32(51);
    mg.lineCap = 'round';
    for (let k = 0; k < 150; k++) {
      const u = rnd(), ax = P1x(560 + 70 * rnd()), ay = P1y(600 + 40 * rnd());
      const bx = P1x(lerp(xl(1900), xr(1900), u) + (rnd() - 0.5) * 80), by = P1y(1900);
      const t0 = 0.15 + 0.7 * rnd(), t1 = Math.min(1, t0 + 0.08 + 0.35 * rnd());
      mg.strokeStyle = `rgba(36,44,46,${0.25 + 0.3 * rnd()})`;
      mg.lineWidth = 0.6 + 0.7 * rnd();
      mg.beginPath();
      const bend = (rnd() - 0.5) * 30;
      for (let s = 0; s <= 12; s++) {
        const tt = lerp(t0, t1, s / 12), x = lerp(ax, bx, tt) + bend * Math.sin(tt * Math.PI), y = lerp(ay, by, tt);
        if (s === 0) mg.moveTo(x, y); else mg.lineTo(x, y);
      }
      mg.stroke();
    }
    mg.restore();
    const MW = W + 2 * MX, md = mg.getImageData(0, 0, MW, H), m = md.data;
    for (let y = 0; y < H; y++) for (let X = 0; X < MW; X++) {
      const x = X - MX, o = (y * MW + X) * 4;
      if (x < 0 || x >= W) { if (y >= YG) m[o + 3] = 0; continue; }
      const i = y * W + x, c = cls[i];
      if (c === MTN) { m[o] = d[i * 4]; m[o + 1] = d[i * 4 + 1]; m[o + 2] = d[i * 4 + 2]; m[o + 3] = 255; }
      else if (c === SKY || y >= YG) m[o + 3] = 0;
    }
    mg.putImageData(md, 0, 0);
    K.mtn = mc; K.mtnMX = MX;
    K.mtnBase = { x: P1x(600), y: YG };

    // --- the traveller as he stands in the first frame
    K.fig1 = maskCanvas(d, cls, FIG);

    // --- the seal, and the ground with the seal lifted out
    K.seal = maskCanvas(d, cls, SEAL);
  }
  function maskCanvas(d, cls, c, bbox) {
    let x0 = W, y0 = H, x1 = -1, y1 = -1;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (cls[y * W + x] === c) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    if (x1 < 0) return null;
    const w = x1 - x0 + 1, h = y1 - y0 + 1, a = new Uint8ClampedArray(w * h * 4);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const i = y * W + x; if (cls[i] !== c) continue;
      const o = ((y - y0) * w + (x - x0)) * 4;
      a[o] = d[i * 4]; a[o + 1] = d[i * 4 + 1]; a[o + 2] = d[i * 4 + 2]; a[o + 3] = 255;
    }
    return { c: canvasFrom(a, w, h), x: x0, y: y0, w, h };
  }

  /* ---------------------------------------------------------------- the ground: a world texture */
  const GX0 = -700, GTW = 3600, GTH = 280;
  function nearEdgeW(xw) {          // the land's near shoreline, world y
    const base = YG + 156 + 10 * (vn(xw / 90, 0.5, 31) - 0.5) + 6 * (vn(xw / 33, 2.5, 32) - 0.5);
    // narrowing toward the tip, rounded at the end; never inside the first frame (its ground must stay whole)
    const taper = (1 - 0.42 * s3(R(xw, 900, 1500))) * (1 - 0.4 * s3(R(xw, TIPW - 420, TIPW - 100)));
    let w = (base - YG) * taper;
    w = lerp(Math.max(w, H + 2 + 4 * vn(xw / 60, 1, 33) - YG), w, s3(R(xw, 1080, 1420)));
    const L = 70;
    if (xw > TIPW - L) w *= Math.sqrt(Math.max(0, 1 - ((xw - (TIPW - L)) / L) ** 2));
    return YG + w;
  }
  function buildGround() {
    const d = K.d1.data, cls = K.cls1;
    const rows = H - YG;
    // seal-free first-frame ground
    const clean = new Uint8ClampedArray(W * rows * 4);
    for (let y = 0; y < rows; y++) for (let x = 0; x < W; x++) {
      let sx = x, i = (y + YG) * W + sx;
      while (cls[i] === SEAL && sx > 0) { sx -= 112; if (sx < 0) sx = 0; i = (y + YG) * W + sx; }
      const o = (y * W + x) * 4;
      clean[o] = d[i * 4]; clean[o + 1] = d[i * 4 + 1]; clean[o + 2] = d[i * 4 + 2]; clean[o + 3] = 255;
    }
    const c = mk(GTW, GTH), g = c.getContext('2d'), id = g.createImageData(GTW, GTH), a = id.data;
    for (let y = 0; y < GTH; y++) {
      // rows past the frame's bottom mirror back up
      let sy = y; if (sy >= rows) sy = Math.max(0, 2 * rows - 1 - sy);
      for (let X = 0; X < GTW; X++) {
        const xw = X + GX0;
        let u = ((xw % (2 * W)) + 2 * W) % (2 * W); if (u >= W) u = 2 * W - 1 - u;
        let sr, sg, sb;
        if (xw >= 0 && xw < W && y < rows) {
          const i = ((y + YG) * W + xw) * 4;
          // exact first-frame ground, seal included (the seal is lifted off separately)
          const isSeal = cls[(y + YG) * W + xw] === SEAL;
          const src = isSeal ? clean : null;
          if (src) { const o = (y * W + xw) * 4; sr = clean[o]; sg = clean[o + 1]; sb = clean[o + 2]; }
          else { sr = d[i]; sg = d[i + 1]; sb = d[i + 2]; }
        } else {
          const o = (sy * W + u) * 4; sr = clean[o]; sg = clean[o + 1]; sb = clean[o + 2];
        }
        const yn = nearEdgeW(xw) - YG, dy = yn - y;
        let al = clamp(dy + 0.5, 0, 1);
        if (xw > TIPW + 1) al = 0;
        // damp sand along the waterline, outside the first frame
        if (al > 0 && dy < 14 && !(xw >= 0 && xw < W && y < rows)) {
          const k = 0.82 + 0.18 * (dy / 14);
          sr *= k; sg *= k; sb *= k;
        }
        const o = (y * GTW + X) * 4;
        a[o] = sr; a[o + 1] = sg; a[o + 2] = sb; a[o + 3] = 255 * al;
      }
    }
    g.putImageData(id, 0, 0);
    K.ground = c;
  }

  /* ================================================================ build: keyframe 2 */
  function segment2() {
    const d = K.d2.data, cls = new Uint8Array(W * H), f = K.fit2;
    const P2x = (sx) => (sx - f.sx) * f.s, P2y = (sy) => (sy - f.sy) * f.s;
    K.P2x = P2x; K.P2y = P2y;
    const L = new Float32Array(W * H), red = new Float32Array(W * H);
    for (let i = 0; i < W * H; i++) { const r = d[i * 4], g = d[i * 4 + 1], b = d[i * 4 + 2]; L[i] = lumOf(r, g, b); red[i] = r - Math.max(g, b); }
    // horizon: first dark row under the sky, right side
    let yh = H;
    for (let y = Math.round(H * 0.6); y < H; y++) { let s = 0; for (let x = 960; x < 1060; x++) s += L[y * W + x]; if (s / 100 < 120) { yh = y; break; } }
    K.YH2 = yh;
    // the sun: a circle from the extent of its pure red
    let top = H, bot = -1, rgt = -1;
    for (let y = 0; y < yh; y++) for (let x = 0; x < W; x++) { const i = y * W + x; if (red[i] > 120) { if (y < top) top = y; if (y > bot) bot = y; if (x > rgt) rgt = x; } }
    const sr = (bot - top + 1) / 2, scy = (top + bot + 1) / 2, scx = rgt + 1 - sr;
    K.sun = { x: scx, y: scy, r: sr };
    let nr = 0, cr = 0, cg = 0, cb = 0;
    for (let y = 0; y < yh; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x, dd = Math.hypot(x + 0.5 - scx, y + 0.5 - scy);
      if (dd < sr + 3 && ((red[i] > 8 && L[i] > 62) || red[i] > 0.4 * d[i * 4] && d[i * 4] > 90)) { cls[i] = S2SUN; if (dd < sr - 6 && red[i] > 120) { nr++; cr += d[i * 4]; cg += d[i * 4 + 1]; cb += d[i * 4 + 2]; } }
      else cls[i] = 255;
    }
    K.sunRGB = [cr / nr, cg / nr, cb / nr];
    // sky: flood from the top edge and the right edge through light pixels
    const stack = [];
    const ref = new Float32Array(H);
    for (let y = 0; y < yh; y++) { let a = 0; for (let x = 960; x < 1070; x++) a += L[y * W + x]; ref[y] = a / 110; }
    const ok = (i) => cls[i] === 255 && L[i] >= ref[(i / W) | 0] - 22;
    for (let x = 0; x < W; x++) if (ok(x)) { cls[x] = S2SKY; stack.push(x); }
    for (let y = 0; y < yh; y++) { const i = y * W + W - 1; if (ok(i)) { cls[i] = S2SKY; stack.push(i); } }
    while (stack.length) {
      const i = stack.pop(), x = i % W, y = (i - x) / W;
      if (x > 0 && ok(i - 1)) { cls[i - 1] = S2SKY; stack.push(i - 1); }
      if (x < W - 1 && ok(i + 1)) { cls[i + 1] = S2SKY; stack.push(i + 1); }
      if (y > 0 && ok(i - W)) { cls[i - W] = S2SKY; stack.push(i - W); }
      if (y < yh - 1 && ok(i + W)) { cls[i + W] = S2SKY; stack.push(i + W); }
    }
    for (let i = yh * W; i < W * H; i++) cls[i] = S2SEA;
    // pale pink rim left outside the sun's class goes with the sun
    for (let y = 0; y < yh; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x; if (cls[i] !== S2SKY) continue;
      if (Math.hypot(x + 0.5 - scx, y + 0.5 - scy) < sr + 4 && red[i] > 3) cls[i] = S2SUN;
    }
    // components of what's left (8-connected)
    const comp = new Int32Array(W * H).fill(-1), comps = [];
    for (let i0 = 0; i0 < yh * W; i0++) {
      if (cls[i0] !== 255 || comp[i0] >= 0) continue;
      const id = comps.length, info = { n: 0, x0: W, y0: H, x1: 0, y1: 0, px: [] };
      comps.push(info); comp[i0] = id; stack.push(i0);
      while (stack.length) {
        const i = stack.pop(), x = i % W, y = (i - x) / W;
        info.n++; info.px.push(i);
        if (x < info.x0) info.x0 = x; if (x > info.x1) info.x1 = x; if (y < info.y0) info.y0 = y; if (y > info.y1) info.y1 = y;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx, yy = y + dy; if (xx < 0 || xx >= W || yy < 0 || yy >= yh) continue;
          const j = yy * W + xx; if (cls[j] === 255 && comp[j] < 0) { comp[j] = id; stack.push(j); }
        }
      }
    }
    const sun = K.sun;
    K.birds = [];
    for (const c of comps) {
      let k = S2BLOCK;
      const cx = (c.x0 + c.x1) / 2, cy = (c.y0 + c.y1) / 2;
      if (c.x0 > P2x(470) && c.x1 < P2x(625) && c.y1 > P2y(880)) k = S2ROCK;
      else if (c.n < 420 && cx > sun.x - 20 && cx < sun.x + sun.r + 120 && cy > sun.y - sun.r && cy < sun.y + sun.r + 160) { k = S2BIRD; K.birds.push(c); }
      for (const i of c.px) cls[i] = k;
    }
    // the seated figure sits on the rock
    const fx0 = P2x(545.5), fx1 = P2x(571.5), fy1 = P2y(919.3);
    for (let y = 0; y < yh; y++) for (let x = 0; x < W; x++) { const i = y * W + x; if (cls[i] === S2ROCK && x >= fx0 && x <= fx1 && y < fy1) cls[i] = S2FIG; }
    // the dark mass splits into the cliff (a block that rises) and the tree + house (cells that assemble)
    const cutSrc = (sx) => sx < 110 ? 598 : sx < 300 ? lerp(598, 796, s3((sx - 110) / 190)) : 796;
    K.cutY = (x) => P2y(cutSrc(x / f.s + f.sx)) + 16 * (vn(x / 23, 0.5, 71) - 0.5) + 8 * (vn(x / 7, 3.5, 72) - 0.5);
    for (let y = 0; y < yh; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x; if (cls[i] === S2BLOCK && y < K.cutY(x)) cls[i] = S2CELL;
    }
    // the sky's antialiased rim around each silhouette goes with the silhouette (2 px), so the sky layer is clean
    for (let pass = 0; pass < 2; pass++) {
      const take = new Int32Array(W * H).fill(-1);
      for (let y = 1; y < yh - 1; y++) for (let x = 1; x < W - 1; x++) {
        const i = y * W + x; if (cls[i] !== S2SKY) continue;
        let best = -1, bl = 1e9;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const j = i + dy * W + dx, c = cls[j];
          if (c === S2BLOCK || c === S2CELL || c === S2ROCK || c === S2FIG) { if (L[j] < bl) { bl = L[j]; best = c; } }
        }
        if (best >= 0 && L[i] < 200) take[i] = best;
      }
      for (let i = 0; i < W * H; i++) if (take[i] >= 0) cls[i] = take[i];
    }
    K.cls2 = cls;
  }

  function layers2() {
    const d = K.d2.data, cls = K.cls2, yh = K.YH2;
    // --- sky: exact sky pixels; under everything else a smooth fill (normalised convolution at 1/8 res)
    const S = 8, sw = Math.ceil(W / S), sh = Math.ceil(H / S);
    let acc = new Float32Array(sw * sh * 4);
    for (let y = 0; y < yh; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x; if (cls[i] !== S2SKY) continue;
      if (Math.hypot(x - K.sun.x, y - K.sun.y) < K.sun.r + 10) continue;
      const j = (Math.floor(y / S) * sw + Math.floor(x / S)) * 4;
      acc[j] += d[i * 4]; acc[j + 1] += d[i * 4 + 1]; acc[j + 2] += d[i * 4 + 2]; acc[j + 3] += 1;
    }
    for (let it = 0; it < 40; it++) {
      const nb = new Float32Array(acc.length);
      for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) {
        const o = (y * sw + x) * 4;
        if (acc[o + 3] >= S * S * 0.6) { nb[o] = acc[o]; nb[o + 1] = acc[o + 1]; nb[o + 2] = acc[o + 2]; nb[o + 3] = acc[o + 3]; continue; }
        let a0 = 0, a1 = 0, a2 = 0, a3 = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const xx = clamp(x + dx, 0, sw - 1), yy = clamp(y + dy, 0, sh - 1), q = (yy * sw + xx) * 4;
          a0 += acc[q]; a1 += acc[q + 1]; a2 += acc[q + 2]; a3 += acc[q + 3];
        }
        nb[o] = a0 / 9; nb[o + 1] = a1 / 9; nb[o + 2] = a2 / 9; nb[o + 3] = a3 / 9;
      }
      acc = nb;
    }
    // row means of the sky (it is mostly a vertical gradient) back up the fill far from any sky
    const rowM = [];
    let lastM = [180, 180, 180];
    for (let y = 0; y < sh; y++) {
      let n = 0, a0 = 0, a1 = 0, a2 = 0;
      for (let yy = y * S; yy < Math.min(yh, y * S + S); yy++) for (let x = 0; x < W; x++) { const i = yy * W + x; if (cls[i] === S2SKY) { n++; a0 += d[i * 4]; a1 += d[i * 4 + 1]; a2 += d[i * 4 + 2]; } }
      if (n > 20) lastM = [a0 / n, a1 / n, a2 / n];
      rowM.push(lastM);
    }
    const lo = new Uint8ClampedArray(sw * sh * 4);
    for (let i = 0; i < sw * sh; i++) {
      const n = acc[i * 4 + 3], w = clamp(n / (S * S * 0.25), 0, 1), rm = rowM[Math.floor(i / sw)], nn = Math.max(1e-6, n);
      lo[i * 4] = lerp(rm[0], acc[i * 4] / nn, w); lo[i * 4 + 1] = lerp(rm[1], acc[i * 4 + 1] / nn, w); lo[i * 4 + 2] = lerp(rm[2], acc[i * 4 + 2] / nn, w); lo[i * 4 + 3] = 255;
    }
    const loC = canvasFrom(lo, sw, sh);
    const plate = mk(W, H), pg = plate.getContext('2d');
    pg.imageSmoothingEnabled = true; pg.imageSmoothingQuality = 'high';
    pg.drawImage(loC, 0, 0, sw, sh, 0, 0, sw * S, sh * S);
    const pd = pg.getImageData(0, 0, W, H), p = pd.data;
    K.plate2 = new Uint8ClampedArray(p);
    // around the birds the sky stays plate: their soft rims arrive with them
    const nearBird = new Uint8Array(W * H);
    for (let i = 0; i < W * H; i++) if (cls[i] === S2BIRD) {
      const x = i % W, y = (i - x) / W;
      for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < W && yy < H) nearBird[yy * W + xx] = 1; }
    }
    for (let i = 0; i < W * H; i++) {
      const o = i * 4;
      if (cls[i] === S2SKY && !nearBird[i]) { p[o] = d[o]; p[o + 1] = d[o + 1]; p[o + 2] = d[o + 2]; }
      else { const j = ih(i % W, (i / W) | 0, 9) * 2 - 1; p[o] += j; p[o + 1] += j; p[o + 2] += j; }
      p[o + 3] = 255;
    }
    pg.putImageData(pd, 0, 0);
    K.sky2 = plate;
    // --- sun, rock, seated figure, cliff block: exact pixel layers
    K.sunL = maskCanvas(d, cls, S2SUN);
    K.rockL = maskCanvas(d, cls, S2ROCK);
    K.fig2 = maskCanvas(d, cls, S2FIG);
    K.block = maskCanvas(d, cls, S2BLOCK);
    // rock surface per column (screen, final), for his feet
    const top = new Float32Array(W).fill(yh);
    for (let x = 0; x < W; x++) for (let y = Math.round(K.P2y(880)); y < yh; y++) { const c = cls[y * W + x]; if (c === S2ROCK || c === S2FIG) { top[x] = y; break; } }
    // under the figure the rock's top is hidden: bridge it
    const fx0 = Math.floor(K.P2x(545)), fx1 = Math.ceil(K.P2x(572));
    for (let x = fx0; x <= fx1; x++) top[x] = lerp(top[fx0 - 1], top[fx1 + 1], (x - fx0 + 1) / (fx1 - fx0 + 2));
    K.rockTop = top;
    let rx0 = W, rx1 = 0; for (let x = 0; x < W; x++) if (top[x] < yh - 1) { rx0 = Math.min(rx0, x); rx1 = Math.max(rx1, x); }
    K.rockX0 = rx0; K.rockX1 = rx1;
    // --- sea: the last frame's water, below its horizon
    K.seaH = H - yh;
    const sea = mk(W, K.seaH); sea.getContext('2d').drawImage(K.c2, 0, yh, W, K.seaH, 0, 0, W, K.seaH);
    K.sea = sea;
    // --- birds: dark sprites with alpha against what lies behind them
    K.birdS = K.birds.map((b) => {
      const pad = 2, x0 = b.x0 - pad, y0 = b.y0 - pad, w = b.x1 - b.x0 + 1 + 2 * pad, h = b.y1 - b.y0 + 1 + 2 * pad;
      const a = new Uint8ClampedArray(w * h * 4);
      let sx = 0, sy = 0, n = 0;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const X = x + x0, Y = y + y0; if (X < 0 || Y < 0 || X >= W || Y >= yh) continue;
        const i = Y * W + X, o = (y * w + x) * 4;
        const inSun = Math.hypot(X + 0.5 - K.sun.x, Y + 0.5 - K.sun.y) < K.sun.r;
        const bg = inSun ? K.sunRGB : [K.plate2[i * 4], K.plate2[i * 4 + 1], K.plate2[i * 4 + 2]];
        const ink = [10, 10, 12];
        const num = (d[i * 4] - bg[0]) * (ink[0] - bg[0]) + (d[i * 4 + 1] - bg[1]) * (ink[1] - bg[1]) + (d[i * 4 + 2] - bg[2]) * (ink[2] - bg[2]);
        const den = (ink[0] - bg[0]) ** 2 + (ink[1] - bg[1]) ** 2 + (ink[2] - bg[2]) ** 2;
        const al = clamp(num / den, 0, 1);
        if (cls[i] === S2BIRD) { a[o] = ink[0]; a[o + 1] = ink[1]; a[o + 2] = ink[2]; a[o + 3] = 255 * Math.max(al, 0.6); sx += X; sy += Y; n++; }
        else if (al > 0.15 && cls[i] !== S2SUN) { a[o] = ink[0]; a[o + 1] = ink[1]; a[o + 2] = ink[2]; a[o + 3] = 255 * al; }
      }
      return { c: canvasFrom(a, w, h), x: x0, y: y0, w, h, cx: sx / n, cy: sy / n, n: b.n };
    });
  }

  /* ================================================================ cells (Voronoi pieces of a mask) */
  // Returns pieces of the masked pixels of `src` (RGBA, W x H), packed into one atlas canvas.
  function makeCells(src, cls, want, spacing, seed, tint) {
    const rnd = mulberry32(seed);
    let x0 = W, y0 = H, x1 = -1, y1 = -1;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (want(cls[y * W + x])) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    const gw = Math.ceil((x1 - x0 + 1) / spacing) + 1, gh = Math.ceil((y1 - y0 + 1) / spacing) + 1;
    const sx = new Float32Array(gw * gh), sy = new Float32Array(gw * gh);
    for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) { const k = j * gw + i; sx[k] = x0 + (i + 0.1 + 0.8 * rnd()) * spacing; sy[k] = y0 + (j + 0.1 + 0.8 * rnd()) * spacing; }
    const owner = new Int32Array(W * H).fill(-1);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const p = y * W + x; if (!want(cls[p])) continue;
      const gi = Math.floor((x - x0) / spacing), gj = Math.floor((y - y0) / spacing);
      // a little noise in the metric makes the pieces ragged, like torn paper
      const nz = (vn(x / 5, y / 5, seed) - 0.5) * spacing * 0.5;
      let best = 1e18, bk = -1;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        const ii = gi + di, jj = gj + dj; if (ii < 0 || jj < 0 || ii >= gw || jj >= gh) continue;
        const k = jj * gw + ii, dx = x + 0.5 - sx[k], dy = y + 0.5 - sy[k];
        const dd = Math.sqrt(dx * dx + dy * dy) + nz * ((k * 7919) % 3 - 1);
        if (dd < best) { best = dd; bk = k; }
      }
      owner[p] = bk;
    }
    const map = new Map(), cells = [];
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const p = y * W + x, k = owner[p]; if (k < 0) continue;
      let c = map.get(k);
      if (!c) { c = { x0: x, y0: y, x1: x, y1: y, n: 0, sx: 0, sy: 0, px: [] }; map.set(k, c); cells.push(c); }
      if (x < c.x0) c.x0 = x; if (x > c.x1) c.x1 = x; if (y < c.y0) c.y0 = y; if (y > c.y1) c.y1 = y;
      c.n++; c.sx += x + 0.5; c.sy += y + 0.5; c.px.push(p);
    }
    // shelf-pack into an atlas (1 px gutter)
    const AW = 2048;
    let ax = 1, ay = 1, rowH = 0;
    for (const c of cells) {
      c.w = c.x1 - c.x0 + 1; c.h = c.y1 - c.y0 + 1; c.cx = c.sx / c.n; c.cy = c.sy / c.n;
      if (ax + c.w + 1 > AW) { ax = 1; ay += rowH + 1; rowH = 0; }
      c.ax = ax; c.ay = ay; ax += c.w + 1; rowH = Math.max(rowH, c.h);
    }
    const AH = ay + rowH + 1;
    const a = new Uint8ClampedArray(AW * AH * 4), at = new Uint8ClampedArray(AW * AH * 4);
    tint = tint || [12, 12, 14];
    let mr = 0, mg = 0, mb = 0;
    for (const c of cells) {
      let r0 = 0, g0 = 0, b0 = 0;
      for (const p of c.px) {
        const x = p % W, y = (p - x) / W, o = ((c.ay + y - c.y0) * AW + (c.ax + x - c.x0)) * 4;
        a[o] = src[p * 4]; a[o + 1] = src[p * 4 + 1]; a[o + 2] = src[p * 4 + 2]; a[o + 3] = 255;
        r0 += src[p * 4]; g0 += src[p * 4 + 1]; b0 += src[p * 4 + 2];
        at[o] = tint[0]; at[o + 1] = tint[1]; at[o + 2] = tint[2]; at[o + 3] = 255;
      }
      c.rgb = [r0 / c.n, g0 / c.n, b0 / c.n];
      mr += r0; mg += g0; mb += b0;
      c.px = null;
    }
    return { cells, atlas: canvasFrom(a, AW, AH), tinted: canvasFrom(at, AW, AH), bbox: [x0, y0, x1, y1] };
  }

  /* ================================================================ particles */
  // kinds: 0 red petal (blossom), 1 red paint (gate), 2 ink flake (source F1 dark cell -> target F2 cell)
  const P = [];
  let SIM = null;           // Float32Array [NP][NF][3] : x, y, angle (only frames >= detach)
  function parentAt(obj, t, x, y) {        // a rest point of a first-frame object, at time t, in screen space
    const n = near(t);
    let lx = x;
    if (obj === 'tree') lx = x + treeSway(t) * (YG - y);
    return [n.a * lx + n.e, n.a * y + n.f];
  }
  function treeSway(t) {
    const w = windAmt(t);
    return w * (0.022 + 0.014 * Math.sin(1.9 * t) + 0.008 * Math.sin(4.3 * t + 1.2)) / 1.0 * 0.6;
  }
  function band(x, t) {      // the centre line of the petal ribbon
    const yc = lerp(1150, horizon(t) - 380, E(t, 2.6, 6.0));
    return yc + 85 * Math.sin(x / 240 - 1.45 * t) + 35 * Math.sin(x / 97 + 2.2 * t);
  }
  function windMean(t) {
    const u = 230 * E(t, 1.0, 2.8) - 140 * E(t, 4.0, 6.0) - 30 * E(t, 7.5, 9.5);
    return [u, -18 * E(t, 1, 3)];
  }
  function curl(x, y, t, out) {
    const s1 = 1 / 300, s2 = 1 / 130, h = 3;
    const psi = (X, Y) => vn(X * s1 + 0.16 * t, Y * s1 - 0.05 * t, 11) + 0.45 * vn(X * s2 - 0.33 * t, Y * s2 + 0.21 * t, 12);
    const dy = (psi(x, y + h) - psi(x, y - h)) / (2 * h), dx = (psi(x + h, y) - psi(x - h, y)) / (2 * h);
    out[0] = dy * 300; out[1] = -dx * 300;
  }

  function buildParticles() {
    const rnd = mulberry32(777);
    const d1 = K.d1.data;
    // --- red: blossom & gate paint
    const blos = makeCells(d1, K.cls1, (c) => c === BLOS, 11, 101, K.sunRGB);
    const gred = makeCells(d1, K.cls1, (c) => c === GRED, 10, 102, K.sunRGB);
    const dark = makeCells(d1, K.cls1, (c) => c === TREE || c === TERR || c === GDARK, 12, 103, null);
    K.cellsBlos = blos; K.cellsGred = gred; K.cellsDark = dark;
    const bb = blos.bbox, bcx = (bb[0] + bb[2]) / 2, bcy = (bb[1] + bb[3]) / 2, brx = (bb[2] - bb[0]) / 2, bry = (bb[3] - bb[1]) / 2;
    // detach order: the outer blossom first, with a lot of chance in it
    const order = blos.cells.map((c, i) => {
      const rad = Math.hypot((c.cx - bcx) / brx, (c.cy - bcy) / bry);
      return { i, q: 0.55 * rnd() + 0.45 * (1 - clamp(rad, 0, 1.2) / 1.2) - 0.12 * (c.cx - bcx) / brx };
    }).sort((a, b) => a.q - b.q);
    order.forEach((o, k) => {
      const u = (k + 0.5) / order.length;
      const c = blos.cells[o.i];
      c.td = 1.12 + 5.1 * Math.pow(u, 0.62);
      P.push({ kind: 0, cell: c, at: blos, obj: 'tree', td: c.td });
    });
    // gate paint peels as the camera passes: in patches
    for (const c of gred.cells) {
      const q = 0.6 * vn(c.cx / 60, c.cy / 60, 5) + 0.4 * rnd();
      c.td = 3.5 + 3.6 * q;
      P.push({ kind: 1, cell: c, at: gred, obj: 'gate', td: c.td });
    }
    // dark cells crumble from the left, behind him
    for (const c of dark.cells) {
      const q = clamp((c.cx + 160 * (vn(c.cx / 80, c.cy / 80, 6) - 0.5)) / W, 0, 1);
      const isGate = K.cls1[Math.round(c.cy - 0.5) * W + Math.round(c.cx - 0.5)] === GDARK;
      c.td = isGate ? 6.2 + 2.8 * rnd() * 0.5 + 1.4 * q : 4.5 + 4.2 * (0.75 * q + 0.25 * rnd());
      c.obj = isGate ? 'gate' : (K.cls1[Math.round(c.cy - 0.5) * W + Math.round(c.cx - 0.5)] === TERR ? 'terr' : 'tree');
    }
    // the grey things left behind crumble into ash that the wind takes and thins out
    for (const c of dark.cells) P.push({ kind: 3, cell: c, at: dark, obj: c.obj, td: c.td });
    // per-particle constants
    for (const p of P) {
      p.tau = p.kind === 3 ? 0.25 + 0.3 * rnd() : 0.3 + 0.45 * rnd();
      p.spin = (rnd() - 0.5) * (p.kind >= 2 ? 5 : 9);
      p.life = 1.0 + 1.4 * rnd();
      p.flipF = 1.5 + 3.5 * rnd(); p.flipP = rnd() * TAU;
      p.flut = 10 + 30 * rnd(); p.flutF = 2 + 3 * rnd(); p.flutP = rnd() * TAU;
      p.kick = p.kind === 3 ? [10 + 30 * rnd(), -(10 + 40 * rnd())] : [20 + 60 * rnd(), -(20 + 70 * rnd())];
      p.bandOff = (rnd() - 0.5) * 2;
      p.bandK = p.kind === 3 ? 0.15 : 1;
      p.scale = p.kind >= 2 ? 1 : 0.85 + 0.25 * rnd();
    }
    // red: gather order — arrivals from 10.8 to 12.7, inner rings first
    const reds = P.filter((p) => p.kind <= 1);
    const ro = reds.map((p) => ({ p, q: rnd() })).sort((a, b) => a.q - b.q);
    ro.forEach((o, k) => {
      const u = (k + 0.5) / ro.length;
      o.p.tg = 9.25 + 1.6 * u + 0.35 * rnd();
      o.p.ta = 10.9 + 1.85 * u + 0.15 * rnd();
      o.p.rT = K.sun.r * 0.93 * Math.sqrt(u);
      o.p.sweep = TAU * (1.0 + 0.55 * rnd());
    });
    for (const p of P) if (p.kind === 3) { p.tg = 99; p.ta = 99; }
    K.rFront = (t) => {        // radius of the sun's landed core at time t
      const u = clamp((t - 10.9) / 1.85, 0, 1);
      return K.sun.r * 0.93 * Math.sqrt(u);
    };
  }

  function simulate() {
    const NP = P.length;
    SIM = new Float32Array(NP * NF * 3);
    const dt = 1 / 60, cu = [0, 0];
    for (let k = 0; k < NP; k++) {
      const p = P[k];
      const t0 = p.td;
      p.z0 = Zf(t0);
      const c = p.cell;
      let [x, y] = parentAt(p.obj, t0, c.cx, c.cy);
      const [x2, y2] = parentAt(p.obj, t0 + 0.02, c.cx, c.cy);
      let vx = (x2 - x) / 0.02 + p.kick[0] * windAmt(t0), vy = (y2 - y) / 0.02 + p.kick[1] * windAmt(t0);
      let ang = 0;
      const tEnd = Math.min(D, p.kind === 3 ? p.td + p.life + 0.1 : (p.tg || 99) + 1.2);
      let t = t0, f = Math.ceil(t0 * FPS - 1e-9);
      // gather start state
      while (t < tEnd && f < NF) {
        // record frame(s) we pass
        while (f < NF && f / FPS <= t + 1e-9) {
          const o = (k * NF + f) * 3; SIM[o] = x; SIM[o + 1] = y; SIM[o + 2] = ang; f++;
        }
        if (p.tg && !p.g0 && t >= p.tg) p.g0 = [x, y];
        const wm = windMean(t);
        curl(x, y, t, cu);
        const turb = 80 * E(t, 1.0, 3.0) + 20 * E(t, 6, 9);
        const fx = wm[0] + cu[0] * turb, fy = wm[1] + cu[1] * turb;
        const age = t - t0;
        const kb = 2.4 * E(age, 0.5, 2.0) * p.bandK;
        const yb = band(x, t) + p.bandOff * 70;
        const fl = p.flut * Math.sin(p.flutF * TAU * t + p.flutP);
        const ax = (fx - vx) / p.tau;
        const ay = (fy + fl - vy) / p.tau + 16 + kb * (yb - y) - 1.1 * kb * vy * 0.4;
        vx += ax * dt; vy += ay * dt;
        x += vx * dt; y += vy * dt;
        ang += p.spin * dt * (0.4 + 0.6 * windAmt(t));
        t += dt;
      }
      while (f < NF) { const o = (k * NF + f) * 3; SIM[o] = x; SIM[o + 1] = y; SIM[o + 2] = ang; f++; }
      if (p.tg < 90 && !p.g0) p.g0 = [x, y];
      if (p.kind <= 1) {
        const dx = p.g0[0] - K.sun.x, dy = p.g0[1] - K.sun.y;
        p.r0 = Math.hypot(dx, dy); p.th0 = Math.atan2(dy, dx);
        // far ones sweep less
        p.sweepE = p.sweep * clamp(760 / Math.max(p.r0, 1), 0.5, 1);
      }
    }
  }
  function simAt(k, t) {
    const x = t * FPS, f = Math.floor(x + 1e-6), u = x - f;
    const o = (k * NF + clamp(f, 0, NF - 1)) * 3;
    if (u < 1e-4 || f >= NF - 1) return [SIM[o], SIM[o + 1], SIM[o + 2]];
    const p = P[k];
    if ((f / FPS) < p.td) { const o2 = o + 3; return [SIM[o2], SIM[o2 + 1], SIM[o2 + 2]]; }
    return [lerp(SIM[o], SIM[o + 3], u), lerp(SIM[o + 1], SIM[o + 4], u), lerp(SIM[o + 2], SIM[o + 5], u)];
  }

  /* ================================================================ ink growth: the tree and the house */
  // Each pixel of the last frame's tree + house gets a time at which the ink reaches it: the geodesic distance through
  // the dark mask from where it meets the cliff, so the ink climbs the trunk into the crown and the house builds up
  // from its stilts. Anything not connected takes the time of the nearest connected ink.
  function buildInk() {
    const cls = K.cls2, d = K.d2.data;
    let x0 = W, y0 = H, x1 = 0, y1 = 0;
    for (let i = 0; i < W * K.YH2; i++) if (cls[i] === S2CELL) { const x = i % W, y = (i - x) / W; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    x0 = Math.max(0, x0 - 2); y0 = Math.max(0, y0 - 2); x1 = Math.min(W - 1, x1 + 2); y1 = Math.min(H - 1, y1 + 2);
    const w = x1 - x0 + 1, h = y1 - y0 + 1, N = w * h;
    const dist = new Float32Array(N).fill(-1), inM = new Uint8Array(N);
    let q = new Int32Array(N), qh = 0, qt = 0;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y + y0) * W + x + x0; if (cls[i] !== S2CELL) continue;
      inM[y * w + x] = 1;
      let seed = false;
      for (let dy = -1; dy <= 1 && !seed; dy++) for (let dx = -1; dx <= 1; dx++) { const j = i + dy * W + dx; if (cls[j] === S2BLOCK) { seed = true; break; } }
      if (seed) { dist[y * w + x] = 0; q[qt++] = y * w + x; }
    }
    while (qh < qt) {
      const k = q[qh++], x = k % w, y = (k - x) / w, dk = dist[k];
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
        const j = yy * w + xx; if (!inM[j] || dist[j] >= 0) continue;
        dist[j] = dk + (dx && dy ? 1.414 : 1); q[qt++] = j;
      }
    }
    let dmax = 1; for (let k = 0; k < N; k++) if (dist[k] > dmax) dmax = dist[k];
    // unconnected bits: spread the reached times across the whole box, take them where needed
    const spread = new Float32Array(N).fill(-1); qh = 0; qt = 0;
    for (let k = 0; k < N; k++) if (dist[k] >= 0) { spread[k] = dist[k]; q[qt++] = k; }
    while (qh < qt) {
      const k = q[qh++], x = k % w, y = (k - x) / w;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
        const j = yy * w + xx; if (spread[j] >= 0) continue; spread[j] = spread[k] + 1; q[qt++] = j;
      }
    }
    const idx = [], tau = [];
    let tmin = 1e9, tmax = 0;
    for (let k = 0; k < N; k++) {
      if (!inM[k]) continue;
      const x = k % w, y = (k - x) / w;
      const dv = dist[k] >= 0 ? dist[k] : spread[k] + 6;
      const tt = 10.75 + 2.0 * Math.pow(clamp(dv / dmax, 0, 1), 0.8) + 0.22 * (vn((x + x0) / 11, (y + y0) / 11, 81) - 0.5) + 0.1 * (vn((x + x0) / 3, (y + y0) / 3, 82) - 0.5);
      idx.push(k); tau.push(tt); tmin = Math.min(tmin, tt); tmax = Math.max(tmax, tt);
    }
    const c = mk(w, h), g = c.getContext('2d'), id = g.createImageData(w, h);
    const full = new Uint8ClampedArray(N * 4);
    for (const k of idx) { const x = k % w, y = (k - x) / w, i = ((y + y0) * W + x + x0) * 4; full[k * 4] = d[i]; full[k * 4 + 1] = d[i + 1]; full[k * 4 + 2] = d[i + 2]; full[k * 4 + 3] = 255; }
    id.data.set(full);
    K.ink = { x: x0, y: y0, w, h, c, g, id, idx: Int32Array.from(idx), tau: Float32Array.from(tau), tmin, tmax, n: idx.length, full: canvasFrom(full, w, h), state: -1 };
  }
  const INK_RAMP = 0.16;
  function drawInk(g, t) {
    const I = K.ink;
    if (t < I.tmin) return;
    let src;
    if (t >= I.tmax + INK_RAMP) src = I.full;
    else {
      if (I.state !== t) {
        const a = I.id.data, idx = I.idx, tau = I.tau;
        for (let k = 0; k < idx.length; k++) a[idx[k] * 4 + 3] = 255 * clamp((t - tau[k]) / INK_RAMP, 0, 1);
        I.g.putImageData(I.id, 0, 0); I.state = t;
      }
      src = I.c;
    }
    g.imageSmoothingEnabled = false;
    g.drawImage(src, I.x, I.y);
    g.imageSmoothingEnabled = true;
  }

  /* ================================================================ build all */
  async function build(img1, img2) {
    const t0 = performance.now();
    K.fit1 = fitCover(img1, 0.5); K.fit2 = fitCover(img2, 0.5);
    K.c1 = drawFit(img1, K.fit1); K.c2 = drawFit(img2, K.fit2);
    K.d1 = dataOf(K.c1); K.d2 = dataOf(K.c2);
    segment1();
    TX0 = K.P1x(889);
    layers1();
    segment2();
    layers2();
    K.SEATX = K.P2x(558.5);          // his feet when seated (screen x)
    K.TIPX = K.rockX0 - 6;           // the end of the land
    buildTimeline();
    TYEND = YG - K.YH2;
    buildGround();
    buildParticles();
    buildInk();
    simulate();
    // scratch canvases for the in-place objects
    K.obj = {};
    for (const name of ['treeR', 'treeD', 'gateR', 'gateD', 'terrD']) K.obj[name] = mk(W, H);
    K.buildMs = performance.now() - t0;
    K.built = true;
  }

  /* ================================================================ drawing */
  function drawObjects(g, t) {
    const dr = drain(t);
    // in-place cells, re-composited at rest each frame, then moved as one piece
    const o = K.obj;
    const lists = { treeR: [], treeD: [], gateR: [], gateD: [], terrD: [] };
    for (const c of K.cellsBlos.cells) if (c.td > t) lists.treeR.push(c);
    for (const c of K.cellsGred.cells) if (c.td > t) lists.gateR.push(c);
    for (const c of K.cellsDark.cells) if (c.td > t) lists[c.obj === 'tree' ? 'treeD' : c.obj === 'gate' ? 'gateD' : 'terrD'].push(c);
    const n = near(t), sw = treeSway(t);
    for (const name of ['treeD', 'treeR', 'terrD', 'gateD', 'gateR']) {
      const L = lists[name]; if (!L.length) continue;
      const cv = o[name], cg = cv.getContext('2d');
      cg.setTransform(1, 0, 0, 1, 0, 0); cg.clearRect(0, 0, W, H);
      const at = name === 'treeR' ? K.cellsBlos.atlas : name === 'gateR' ? K.cellsGred.atlas : K.cellsDark.atlas;
      for (const c of L) cg.drawImage(at, c.ax, c.ay, c.w, c.h, c.x0, c.y0, c.w, c.h);
      const isTree = name[0] === 't' && name[1] === 'r';
      // x' = a (x + sw (YG - y)) + e ;  y' = a y + f
      if (isTree) g.setTransform(n.a, 0, -n.a * sw, n.a, n.e + n.a * sw * YG, n.f);
      else g.setTransform(n.a, 0, 0, n.a, n.e, n.f);
      if (name.endsWith('D') && dr > 0.002) g.filter = `saturate(${(1 - dr).toFixed(3)})`;
      const ident = Math.abs(n.a - 1) < 1e-9 && Math.abs(n.e) < 1e-9 && Math.abs(n.f) < 1e-9 && (!isTree || Math.abs(sw) < 1e-9);
      g.imageSmoothingEnabled = !ident;
      g.drawImage(cv, 0, 0);
      g.filter = 'none';
      g.imageSmoothingEnabled = true;
    }
    g.setTransform(1, 0, 0, 1, 0, 0);
  }
  const drain = (t) => E(t, 3.3, 9.0);

  function drawSea(g, t) {
    const yh = horizon(t), off = yh - K.YH2;
    const amp = E(t, 3.5, 6) * (1 - E(t, 13.2, 15.6));
    const cx = Cxf(t) * Zf(t);
    if (amp < 1e-4) { g.drawImage(K.sea, 0, Math.round(yh * 1000) / 1000); return; }
    // row by row: a horizontal sway and a vertical shimmer, travelling with the camera
    const sh = K.seaH;
    for (let y = 0; y < sh; y += 2) {
      const dep = y / sh;
      const ph = y * 0.115 + 2.1 * t + cx * 0.012;
      const dx = amp * (2 + 9 * dep) * (Math.sin(ph) * 0.7 + 0.3 * Math.sin(y * 0.041 - 1.3 * t + cx * 0.006));
      let sy = y + Math.round(amp * (1 + 3 * dep) * Math.sin(y * 0.07 + 2.7 * t + cx * 0.01));
      sy = clamp(sy, 0, sh - 2);
      const Y = yh + y;
      if (Y > H) break;
      g.drawImage(K.sea, 0, sy, W, 2, dx, Y, W, 2);
      if (dx > 0) g.drawImage(K.sea, 0, sy, 2, 2, 0, Y, Math.ceil(dx) + 1, 2);
      else if (dx < 0) g.drawImage(K.sea, W - 2, sy, 2, 2, W + dx - 1, Y, -dx + 2, 2);
    }
    void off;
  }

  function drawGround(g, t) {
    const n = near(t), dr = drain(t);
    const dt0 = (xw) => 10.1 + 1.25 * R(xw, TIPW - 1000, TIPW);
    const drown = (xw) => E(t, dt0(xw), dt0(xw) + 0.9);
    const anyDrown = t > 10.1;
    g.save();
    if (anyDrown) {
      // the land goes under, from the far end back to the tip
      g.beginPath();
      g.moveTo(-10, horizon(t) - 2);
      for (let x = -10; x <= W + 10; x += 6) {
        const xw = (x - n.e) / n.a;
        const yn = nearEdgeW(xw), k = drown(xw);
        const y = n.a * (YG + (yn - YG) * (1 - k)) + n.f;
        g.lineTo(x, y);
      }
      g.lineTo(W + 10, horizon(t) - 2); g.closePath();
      g.clip();
    }
    g.setTransform(n.a, 0, 0, n.a, n.e + n.a * GX0, n.f + n.a * YG);
    if (dr > 0.002) g.filter = `saturate(${(1 - dr).toFixed(3)}) brightness(${(1 - 0.5 * E(t, 4.5, 10)).toFixed(3)})`;
    const ident = Math.abs(n.a - 1) < 1e-9 && Math.abs(n.e) < 1e-9 && Math.abs(n.f) < 1e-9;
    g.imageSmoothingEnabled = !ident;
    g.drawImage(K.ground, 0, 0);
    g.filter = 'none';
    g.imageSmoothingEnabled = true;
    g.restore();
    g.setTransform(1, 0, 0, 1, 0, 0);
    // the seal lifts away as the wind comes
    const sa = 1 - E(t, 1.25, 2.4);
    if (sa > 0 && K.seal) {
      g.globalAlpha = sa;
      g.setTransform(n.a, 0, 0, n.a, n.e, n.f);
      g.drawImage(K.seal.c, K.seal.x, K.seal.y - 6 * (1 - sa));
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.globalAlpha = 1;
    }
  }

  function drawMountain(g, t) {
    const n = near(t), dr = drain(t);
    const sM = 1 - 0.42 * E(t, 3.0, 8.6);
    const sink = 1150 * Math.pow(E3(t, 3.2, 9.0), 1.25);
    const haze = 1 - E(t, 4.6, 8.4);
    if (haze <= 0) return;
    const B = K.mtnBase, yh = horizon(t);
    const dx = -0.22 * Cxf(t) * Zf(t);
    if (sink > H) return;
    // x' = B.x + dx + sM (x - B.x);  y' = yh + sM (y - YG) + sink
    g.setTransform(sM, 0, 0, sM, B.x + dx - sM * B.x, yh + sink - sM * YG);
    if (dr > 0.002) g.filter = `saturate(${(1 - dr).toFixed(3)})`;
    g.imageSmoothingEnabled = !(sM === 1 && dx === 0 && sink === 0 && yh === YG);
    g.globalAlpha = haze;
    g.drawImage(K.mtn, -K.mtnMX, 0);
    g.globalAlpha = 1;
    g.filter = 'none'; g.imageSmoothingEnabled = true;
    g.setTransform(1, 0, 0, 1, 0, 0);
    void n;
  }

  function drawSky(g, t) {
    const dr = drain(t);
    g.imageSmoothingEnabled = false;
    if (dr > 0.002) g.filter = `saturate(${(1 - dr).toFixed(3)})`;
    g.drawImage(K.sky1, 0, 0);
    g.filter = 'none';
    const k = E(t, 4.6, 11.0);
    if (k > 0) { g.globalAlpha = k; g.drawImage(K.sky2, 0, 0); g.globalAlpha = 1; }
    g.imageSmoothingEnabled = true;
  }

  // The cliff (rising) and the ink (growing) are composed at whole pixels, then moved together, so no seam opens
  // between them; the frame's left edge is extended while the camera is still settling.
  function drawF2Rising(g, t) {
    if (t < 9.2) return;
    const dx = dxF2(t);
    const rise = Math.round(820 * (1 - E(t, 9.2, 11.1)));
    const c = K.silC || (K.silC = mk(W, H)), cg = c.getContext('2d');
    cg.setTransform(1, 0, 0, 1, 0, 0); cg.clearRect(0, 0, W, H);
    cg.save(); cg.beginPath(); cg.rect(0, 0, W, Math.round(horizon(t) + Math.abs(dx) * 0)); cg.clip();
    cg.imageSmoothingEnabled = false;
    cg.drawImage(K.block.c, K.block.x, K.block.y + rise);
    cg.restore();
    drawInk(cg, t);
    const exact = Math.abs(dx) < 1e-6;
    g.imageSmoothingEnabled = !exact;
    g.drawImage(c, dx, 0);
    if (dx > 0) g.drawImage(c, 0, 0, 1, H, 0, 0, dx + 1, H);
    g.imageSmoothingEnabled = true;
  }
  function drawRock(g, t) {
    if (t < 10.6) return;
    const rise = 70 * (1 - E(t, 10.6, 11.7));
    const dx = dxF2(t);
    g.save();
    g.beginPath(); g.rect(0, 0, W, K.YH2 + 0.5 + (horizon(t) - K.YH2)); g.clip();
    g.imageSmoothingEnabled = !(Math.abs(dx) < 1e-6 && rise < 1e-6);
    g.drawImage(K.rockL.c, K.rockL.x + dx, K.rockL.y + rise + (horizon(t) - K.YH2));
    g.restore();
    g.imageSmoothingEnabled = true;
  }

  function drawParticles(g, t, pass) {
    // pass 0: red (behind the cliff), pass 1: ink
    const sun = K.sun;
    const dx2 = dxF2(t);
    for (let k = 0; k < P.length; k++) {
      const p = P[k];
      if (t < p.td) continue;
      const isRed = p.kind <= 1;
      if ((pass === 0) !== isRed) continue;
      const c = p.cell;
      let [x, y, ang] = simAt(k, t);
      let sc = p.scale, flip = Math.cos(p.flipF * (t - p.td) + p.flipP), alpha = 1, m = 0;
      // the first instant: it lifts off the painting
      const age = t - p.td, lift = s3(clamp(age / 0.35, 0, 1));
      flip = lerp(1, flip, lift); ang *= lift;
      sc = lerp(p.z0, p.z0 * sc, lift);
      if (isRed) {
        m = 0.3 * E(t, 4.5, 9.0);
        if (t > p.tg) {
          const u = R(t, p.tg, p.ta);
          const rr = p.rT + (p.r0 - p.rT) * Math.pow(1 - u, 2.0);
          const th = p.th0 - p.sweepE * s5(u);
          const thT = p.th0 - p.sweepE;
          void thT;
          const sx = sun.x + rr * Math.cos(th), sy = sun.y + rr * Math.sin(th);
          const b = s5(R(t, p.tg, p.tg + 1.0));
          x = lerp(x, sx, b); y = lerp(y, sy, b);
          const e = s5(u);
          m = lerp(m, 1, s5(clamp(u * 1.4, 0, 1)));
          ang *= 1 - e; flip = lerp(flip, 1, e); sc = lerp(sc, 0.95, e);
          if (t > p.ta) { x = sun.x + p.rT * Math.cos(p.th0 - p.sweepE); y = sun.y + p.rT * Math.sin(p.th0 - p.sweepE); }
          alpha = 1 - E(t, 12.75, 13.3);
          if (alpha <= 0) continue;
        }
      } else {
        if (t > p.td + p.life) continue;
        const u = (t - p.td) / p.life;
        alpha = 1 - s3(clamp((u - 0.35) / 0.65, 0, 1));
        sc = 1 - 0.55 * u;
        m = 0.3 + 0.5 * u;
      }
      const ca = Math.cos(ang), sa = Math.sin(ang);
      const fx = Math.abs(flip) < 0.12 ? 0.12 * Math.sign(flip || 1) : flip;
      g.setTransform(ca * fx * sc, sa * fx * sc, -sa * sc, ca * sc, x, y);
      if (m < 0.996) {
        g.globalAlpha = alpha;
        g.drawImage(p.at.atlas, c.ax, c.ay, c.w, c.h, c.x0 - c.cx, c.y0 - c.cy, c.w, c.h);
      } else m = 1;
      if (m > 0.004) {
        g.globalAlpha = alpha * m;
        g.drawImage(p.at.tinted, c.ax, c.ay, c.w, c.h, c.x0 - c.cx, c.y0 - c.cy, c.w, c.h);
      }
      g.globalAlpha = 1;
    }
    g.setTransform(1, 0, 0, 1, 0, 0);
  }

  function drawSun(g, t) {
    if (t < 10.9) return;
    const rf = K.rFront(t) * (K.sun.r + 6) / (K.sun.r * 0.93) - 4;
    const s = K.sunL;
    if (rf <= 0) return;
    g.save();
    if (rf < K.sun.r + 4) { g.beginPath(); g.arc(K.sun.x, K.sun.y, rf, 0, TAU); g.clip(); }
    g.drawImage(s.c, s.x, s.y);
    g.restore();
  }

  /* ---------------------------------------------------------------- the traveller */
  const INK = [16, 16, 19];
  function travellerState(t) {
    const st = {};
    const Z = Zf(t);
    const XT = XTf(t);
    st.Z = Z;
    st.x = Z * (XT - TX0 - Cxf(t)) + TX0;
    // ground under his feet: the land at the horizon, then the rock
    let gy = horizon(t);
    const rx = st.x;
    if (t > T_TIP - 0.4 && rx > K.rockX0 - 4 && rx < K.rockX1) {
      const top = K.rockTop[clamp(Math.round(rx), 0, W - 1)];
      const rise = 70 * (1 - E(t, 10.6, 11.7));
      gy = Math.min(gy, top + rise + (horizon(t) - K.YH2));
    }
    st.y = gy;
    st.steps = (XT - TX0) / 46;
    st.walk = s3(R(t, 2.35, 3.0)) * (1 - s3(R(t, T_STOP - 0.45, T_STOP)));
    st.facing = 1;
    // he turns to watch the blossom go (1.35 - 1.65), and back (2.0 - 2.3)
    const f1 = R(t, 1.35, 1.65), f2 = R(t, 2.0, 2.3);
    st.facing = Math.cos(Math.PI * s3(f1)) ; // 1 -> -1
    if (t >= 2.0) st.facing = -Math.cos(Math.PI * s3(f2));
    st.look = 0.22 * E(t, 1.6, 1.95) * (1 - E(t, 1.95, 2.25));
    st.sit = E(t, T_STOP + 0.15, T_STOP + 1.0);
    st.hat = t < 12.55 + (T_TIP - 12) * 0 ? 1 : 0;
    return st;
  }
  function legPose(th, kn) {      // thigh angle from vertical (+ forward), knee bend; returns knee & ankle (y down)
    const kx = 28 * Math.sin(th), ky = 28 * Math.cos(th);
    const s = th - kn;
    return [kx, ky, kx + 28 * Math.sin(s), ky + 28 * Math.cos(s)];
  }
  function drawFigure(g, t, st, alpha) {
    // local units = canvas px at Z = 1; feet on y = 0, +x forward. Proportions from the first frame's figure:
    // hat brim at -134, shoulders +-17 at -112, robe hem +-17 at -36, two hakama legs below, sword in the near hand.
    const walkA = st.walk, p = Math.PI * st.steps, sit = st.sit;
    let th1 = 0.40 * Math.sin(p) * walkA, th2 = -th1;
    let k1 = 0.7 * Math.pow(Math.max(0, Math.cos(p)), 2) * walkA, k2 = 0.7 * Math.pow(Math.max(0, -Math.cos(p)), 2) * walkA;
    // seated, side on, legs crossed: thighs forward, shins folded back under
    th1 = lerp(th1, 1.52, sit); th2 = lerp(th2, 1.40, sit); k1 = lerp(k1, 2.8, sit); k2 = lerp(k2, 2.65, sit);
    const L1 = legPose(th1, k1), L2 = legPose(th2, k2);
    const reach = Math.max(L1[3], L2[3]);
    const hipY = -lerp(reach, 10, sit);
    const lean = 0.05 * walkA + 0.04 * sit + st.look * 0.15;
    const ls = Math.sin(lean), lc = Math.cos(lean);
    const torsoH = lerp(1, 0.9, sit);
    const ty = (y) => hipY + (y + 56) * torsoH;      // torso y (standing reference: hip at -56)
    const P = (x, y) => { const yy = ty(y); return [x + ls * (hipY - yy), yy]; };
    const col = `rgb(${INK.join(',')})`;
    g.save();
    g.globalAlpha = alpha;
    g.translate(st.x, st.y);
    const fs = Math.abs(st.facing) < 0.14 ? 0.14 * Math.sign(st.facing || 1) : st.facing;
    g.scale(st.Z * fs * lerp(1, 0.8, sit), st.Z);
    g.lineCap = 'round'; g.lineJoin = 'round';
    g.strokeStyle = col; g.fillStyle = col;
    const armL = lerp(1, 0.72, sit);
    const leg = (L, w0, w1) => {
      // a hakama leg: a tapered quad from hip to knee to ankle
      const hx = 0, hy = hipY, kx = L[0], ky = hipY + L[1], ax = L[2], ay = hipY + L[3];
      const n1 = Math.atan2(ky - hy, kx - hx) + Math.PI / 2, n2 = Math.atan2(ay - ky, ax - kx) + Math.PI / 2;
      g.beginPath();
      g.moveTo(hx + Math.cos(n1) * w0, hy + Math.sin(n1) * w0);
      g.lineTo(kx + Math.cos(n1) * w1, ky + Math.sin(n1) * w1);
      g.lineTo(ax + Math.cos(n2) * (w1 - 1), ay + Math.sin(n2) * (w1 - 1));
      g.lineTo(ax - Math.cos(n2) * (w1 - 1), ay - Math.sin(n2) * (w1 - 1));
      g.lineTo(kx - Math.cos(n1) * w1, ky - Math.sin(n1) * w1);
      g.lineTo(hx - Math.cos(n1) * w0, hy - Math.sin(n1) * w0);
      g.closePath(); g.fill();
      g.beginPath(); g.ellipse(ax + 4.5, ay - 2.2, 8, 3.2, 0, 0, TAU); g.fill();
    };
    leg(L2, 7.5, 6.2);
    leg(L1, 7.5, 6.4);
    // the far arm hangs
    const armSw = -0.3 * Math.sin(p) * walkA;
    const sh = P(1, -110);
    const arm = (a, w, fold) => {
      const ex = sh[0] + 24 * armL * Math.sin(a), ey = sh[1] + 24 * armL * Math.cos(a);
      const a2 = a + 0.45 + fold;
      const hx = ex + 21 * armL * Math.sin(a2), hy = ey + 21 * armL * Math.cos(a2);
      g.lineWidth = w; g.beginPath(); g.moveTo(sh[0], sh[1]); g.lineTo(ex, ey); g.lineTo(hx, hy); g.stroke();
      return [hx, hy];
    };
    arm(lerp(-armSw * 0.8 - 0.1, 0.55, sit), 9, lerp(0, 0.95, sit));
    // robe (haori over hakama): shoulders to hem; the hem drapes over the lap when he sits
    const kneeF = [L1[0], hipY + L1[1]];
    const hemFy = lerp(-36, hipY + 4, sit), hemFx = lerp(16 + 4 * Math.max(0, th1), kneeF[0] + 5, sit);
    const hemBx = lerp(-17 + 5 * Math.min(0, th2), -15, sit), hemBy = lerp(-36, hipY + 6, sit);
    const swing = 2.5 * Math.sin(p) * walkA;
    g.beginPath();
    let q = P(-13, -113); g.moveTo(q[0], q[1]);
    q = P(-4, -119); const q2 = P(9, -118); g.quadraticCurveTo(q[0], q[1], q2[0], q2[1]);
    q = P(16, -111); g.lineTo(q[0], q[1]);
    q = P(17, -88); g.lineTo(q[0], q[1]);
    q = P(15, -66); g.lineTo(q[0], q[1]);
    g.lineTo(hemFx + swing, hemFy);
    g.lineTo(hemBx + swing, hemBy);
    q = P(-19, -62); g.lineTo(q[0], q[1]);
    q = P(-19, -80); g.lineTo(q[0], q[1]);                 // the sword's hilt pushes the robe out at the back
    q = P(-16, -100); g.lineTo(q[0], q[1]);
    g.closePath(); g.fill();
    // hilt at the hip
    const hb = P(-12, -76), hf = P(lerp(-27, -14, sit), -80);
    g.lineWidth = 3.4; g.beginPath(); g.moveTo(hb[0], hb[1]); g.lineTo(hf[0], hf[1]); g.stroke();
    // the wind in the sleeves and hem
    const wa = windAmt(t) * (1 - sit);
    if (wa > 0.01) {
      const fl = Math.sin(t * 9.3) * 3 + Math.sin(t * 5.1 + 1) * 2;
      const a0 = P(-17, -70), a1 = P(-17, -40);
      g.beginPath(); g.moveTo(a0[0], a0[1]);
      g.lineTo(a0[0] - 9 * wa - fl * wa * 0.6, a0[1] + 14 + fl * wa * 0.5);
      g.lineTo(a1[0] - 6 * wa, a1[1] + 2); g.lineTo(a1[0] + 4, a1[1]); g.closePath(); g.fill();
    }
    // the painting's white crossed collar and sash tie
    if (sit < 0.95) {
      g.strokeStyle = `rgba(222,218,206,${(0.9 * (1 - sit)).toFixed(3)})`; g.lineWidth = 1.5;
      let c0 = P(-1, -114), c1 = P(10, -95);
      g.beginPath(); g.moveTo(c0[0], c0[1]); g.lineTo(c1[0], c1[1]); g.stroke();
      c0 = P(-6, -82); c1 = P(4, -74);
      g.beginPath(); g.moveTo(c0[0], c0[1]); g.lineTo(c1[0], c1[1]); g.stroke();
      g.strokeStyle = col;
    }
    // head (in the hat's shadow while he wears it)
    const head = P(3 + 1.5 * sit, -123);
    const headR = lerp(7.5, 10, sit);
    g.beginPath(); g.arc(head[0], head[1], headR, 0, TAU); g.fill();
    if (sit > 0.3) { g.beginPath(); g.arc(head[0] - 2.5, head[1] - headR * 0.95, headR * 0.42 * sit, 0, TAU); g.fill(); }
    // near arm with the sword (laid down as he sits)
    const hand = arm(lerp(armSw + 0.42, 0.75, sit), 9.5, lerp(-0.3, 0.75, sit));
    const swA = 0.66 - 0.22 * Math.sin(p) * walkA;
    const sa = 1 - E(sit, 0, 0.45);
    if (sa > 0) {
      g.globalAlpha = alpha * sa;
      g.lineWidth = 3; g.beginPath(); g.moveTo(hand[0] - 8 * Math.sin(swA), hand[1] - 8 * Math.cos(swA));
      g.lineTo(hand[0] + 64 * Math.sin(swA), hand[1] + 64 * Math.cos(swA)); g.stroke();
      g.globalAlpha = alpha;
    }
    if (st.hat) drawHat(g, head[0], head[1] - 7, -st.look, t);
    g.restore();
  }
  function hatColour(t) {
    const dr = drain(t), dk = E(t, 7, 11.5);
    const c0 = [236, 229, 208], grey = 228;
    return c0.map((v) => Math.round(lerp(lerp(v, grey, dr), 150, dk)));
  }
  function drawHat(g, x, y, rot, t) {
    g.save();
    g.translate(x, y); g.rotate(rot);
    const c = hatColour(t);
    g.fillStyle = `rgb(${c.join(',')})`;
    g.beginPath(); g.moveTo(-23, 1); g.quadraticCurveTo(-9, -7, 0, -17); g.quadraticCurveTo(9, -7, 23, 1); g.quadraticCurveTo(0, 4, -23, 1); g.fill();
    g.strokeStyle = 'rgba(20,20,22,0.9)'; g.lineWidth = 1.6;
    g.beginPath(); g.moveTo(-23, 1); g.quadraticCurveTo(0, 4.5, 23, 1); g.stroke();
    g.lineWidth = 0.8; g.strokeStyle = 'rgba(60,58,52,0.5)';
    for (const u of [-0.55, -0.2, 0.2, 0.55]) { g.beginPath(); g.moveTo(0, -16); g.lineTo(23 * u, 1.5); g.stroke(); }
    g.restore();
  }
  function drawTraveller(g, t) {
    const st = travellerState(t);
    // the first frame's own figure until the turn reaches edge-on; from there he is drawn
    const f1 = R(t, 1.35, 1.65);
    if (t < 1.5) {
      const sx = Math.cos(Math.PI * s3(f1));
      const f = K.fig1;
      const ax = TX0;
      g.save();
      g.setTransform(sx, 0, 0, 1, ax - sx * ax, 0);
      g.imageSmoothingEnabled = sx !== 1;
      g.drawImage(f.c, f.x, f.y);
      g.restore();
      g.imageSmoothingEnabled = true;
      return st;
    }
    const a2 = E(t, 14.85, 15.25);
    if (a2 < 1) drawFigure(g, t, st, 1 - a2 * 0);
    if (a2 > 0) { g.globalAlpha = a2; g.drawImage(K.fig2.c, K.fig2.x, K.fig2.y); g.globalAlpha = 1; }
    return st;
  }
  function drawFlyingHat(g, t) {
    const T0 = 12.55;
    if (t < T0 || t > 15.5) return;
    const st = travellerState(T0);
    const u = t - T0;
    const x0 = st.x + st.Z * 2, y0 = st.y - st.Z * 128;
    const x = x0 + 70 * u + 38 * u * u + 12 * Math.sin(u * 4);
    const y = y0 - 34 * u - 70 * u * u + 16 * Math.sin(u * 2.6);
    const sc = st.Z * (1 - 0.16 * u);
    const a = 1 - E(t, 14.2, 15.3);
    g.save(); g.globalAlpha = a;
    g.translate(x, y); g.scale(sc * Math.cos(u * 4.2), sc);
    drawHat(g, 0, 0, 0.9 * u + 0.3 * Math.sin(u * 6), t);
    g.restore();
  }

  function drawBirds(g, t) {
    if (t < 13.0) return;
    let k = 0;
    K.birdS.forEach((b) => {
      if (b.n < 14) {
        // specks: they settle out of the air in the last two seconds
        const a = E(t, 14.0, 15.6);
        if (a > 0) { g.globalAlpha = a; g.drawImage(b.c, b.x, b.y); g.globalAlpha = 1; }
        return;
      }
      const i = k++;
      const t0 = 13.1 + 0.27 * i;
      if (t < t0) return;
      const u = E(t, t0, 15.6);
      const P3 = [b.x, b.y];
      const P0 = [K.P2x(400) + 30 * i, K.P2y(820) + 20 * (i % 3)];
      const P1 = [P0[0] + 40, P0[1] - 380];
      const P2 = [P3[0] - 50 + 18 * i, P3[1] - 120];
      const v = u, w = 1 - v;
      const x = w * w * w * P0[0] + 3 * w * w * v * P1[0] + 3 * w * v * v * P2[0] + v * v * v * P3[0];
      const y = w * w * w * P0[1] + 3 * w * w * v * P1[1] + 3 * w * v * v * P2[1] + v * v * v * P3[1];
      const flap = 1 - E(t, 14.6, 15.6);
      const sy = lerp(1, Math.cos(TAU * 5.5 * (t - t0) + i), flap);
      const sz = lerp(1.4, 1, E(t, t0, 15.6));
      g.save();
      g.translate(x + b.w / 2, y + b.h / 2);
      g.scale(sz, sz * (Math.abs(sy) < 0.15 ? 0.15 * Math.sign(sy || 1) : sy));
      g.imageSmoothingEnabled = !(u >= 1 && flap <= 0);
      g.drawImage(b.c, -b.w / 2, -b.h / 2);
      g.restore();
    });
    g.imageSmoothingEnabled = true;
  }

  /* ---------------------------------------------------------------- wind lines (procedural brushwork) */
  function drawWind(g, t) {
    const a = windAmt(t) * (1 - E(t, 9.0, 11.0));
    if (a < 0.01) return;
    g.save();
    g.lineCap = 'round';
    const light = E(t, 4.6, 11.0);
    for (let i = 0; i < 9; i++) {
      const sp = 380 + 90 * ih(i, 1, 3);
      const len = 260 + 200 * ih(i, 2, 3);
      const per = W + len + 400;
      const x0 = ((t * sp + ih(i, 3, 3) * per) % per) - len - 200;
      const y0 = 900 + 700 * ih(i, 4, 3) + 40 * Math.sin(t * 0.7 + i);
      const al = a * (0.10 + 0.08 * ih(i, 5, 3));
      const segs = 18;
      for (let s = 0; s < segs; s++) {
        const u0 = s / segs, u1 = (s + 1) / segs;
        const env = Math.sin(Math.PI * (u0 + u1) / 2);
        g.strokeStyle = light < 0.5 ? `rgba(225,232,228,${(al * env).toFixed(3)})` : `rgba(40,40,44,${(al * env * 0.8).toFixed(3)})`;
        g.lineWidth = 1 + 1.6 * env;
        const yy = (u) => y0 + 22 * Math.sin(u * 5 + t * 1.3 + i) - 30 * u * u;
        g.beginPath(); g.moveTo(x0 + len * u0, yy(u0)); g.lineTo(x0 + len * u1, yy(u1)); g.stroke();
      }
    }
    g.restore();
  }

  /* ================================================================ frame */
  function render(g, t) {
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalAlpha = 1; g.filter = 'none'; g.globalCompositeOperation = 'source-over';
    if (t < TA) { g.imageSmoothingEnabled = false; g.drawImage(K.c1, 0, 0); g.imageSmoothingEnabled = true; return; }
    if (t >= TB) { g.imageSmoothingEnabled = false; g.drawImage(K.c2, 0, 0); g.imageSmoothingEnabled = true; return; }
    const on = (n) => !KF.only || KF.only.includes(n);
    if (on('sky')) drawSky(g, t);
    if (on('mtn')) drawMountain(g, t);
    if (on('sun')) drawSun(g, t);
    if (on('red')) drawParticles(g, t, 0);
    if (on('sea')) drawSea(g, t);
    if (on('ground')) drawGround(g, t);
    if (on('obj')) drawObjects(g, t);
    if (on('block')) drawF2Rising(g, t);
    if (on('ash')) drawParticles(g, t, 1);
    if (on('rock')) drawRock(g, t);
    if (on('wind')) drawWind(g, t);
    if (on('trav')) drawTraveller(g, t);
    if (on('hat')) drawFlyingHat(g, t);
    if (on('birds')) drawBirds(g, t);
    // the last half-second: the composite settles onto the keyframe itself
    const k = KF.noSettle ? 0 : E(t, 15.35, TB);
    if (k > 0) { g.globalAlpha = k; g.imageSmoothingEnabled = false; g.drawImage(K.c2, 0, 0); g.globalAlpha = 1; g.imageSmoothingEnabled = true; }
  }

  /* ================================================================ debug views */
  function debugView(g, what) {
    const id = g.createImageData(W, H), a = id.data;
    const pal1 = [[40, 60, 90], [120, 140, 150], [255, 120, 140], [120, 70, 30], [160, 150, 120], [255, 0, 0], [60, 0, 0], [255, 255, 0], [230, 220, 200], [0, 255, 255]];
    const pal2 = [[200, 220, 255], [255, 0, 0], [20, 20, 20], [0, 160, 0], [120, 80, 40], [255, 255, 0], [255, 0, 255], [0, 0, 120]];
    const cls = what === 'seg1' ? K.cls1 : K.cls2, pal = what === 'seg1' ? pal1 : pal2;
    for (let i = 0; i < W * H; i++) { const c = pal[cls[i]] || [255, 255, 255]; a[i * 4] = c[0]; a[i * 4 + 1] = c[1]; a[i * 4 + 2] = c[2]; a[i * 4 + 3] = 255; }
    g.putImageData(id, 0, 0);
  }

  /* ================================================================ export */
  const KF = {
    only: null,
    W, H, FPS, D, NF, TA, TB, K, P,
    build, render, debugView,
    info: () => ({ buildMs: K.buildMs, particles: P.length, blos: K.cellsBlos.cells.length, gred: K.cellsGred.cells.length,
      dark: K.cellsDark.cells.length, ink: K.ink.n, sun: K.sun, YG, YH2: K.YH2, TX0, CXEND, VW: K.VW,
      TIPW, T_TIP, birds: K.birdS.map((b) => b.n), fit1: K.fit1, fit2: K.fit2,
      trav: [0, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 12.5, 13, 13.5, 14].map((t) => { const s = travellerState(t); return [t, Math.round(s.x), Math.round(s.y)]; }) }),
  };
  window.KEYFRAMES = KF;
})();
