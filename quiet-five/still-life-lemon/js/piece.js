/* Still Life with Lemon — assembly: static precompute, per-frame candle mix, dynamic peel + bubble,
   varnish/tone curve, output.                                                                      */
(function (G) {
  'use strict';
  const Q = G.Q;
  const LOOP = (Q.LOOP = 10.0);
  const sqrt = Math.sqrt, min = Math.min, max = Math.max;

  // candle: periodic irregular flicker (integer harmonics of the loop => seamless)
  const nA = Q.loopNoise(11, 3, 26, 0.95);
  const nB = Q.loopNoise(23, 3, 30, 0.85);
  const nM = Q.loopNoise(37, 2, 9, 1.1);
  Q.flame = function (t) {
    const ph = (((t / LOOP) % 1) + 1) % 1;
    const a = nA(ph), b = nB(ph), m = nM(ph);
    return {
      id: 1 + 0.042 * a,                       // diffuse light
      is: 1 + 0.13 * (0.78 * a + 0.62 * b),    // speculars breathe more (flame size)
      m: 0.5 + 0.5 * Math.tanh(1.1 * m),       // flame sway between positions a and b
    };
  };

  // tone curve LUT: linear scene -> display sRGB (0..1)
  const LUTN = 8192, LUTMAX = 24;
  const LUT = new Float32Array(LUTN + 1);
  (function () {
    const exposure = 0.62, w = 4.0;
    for (let i = 0; i <= LUTN; i++) {
      const s = i / LUTN; const x = s * s * LUTMAX * exposure;
      let y = (x * (1 + x / (w * w))) / (1 + x);
      y = y <= 0.0031308 ? 12.92 * y : 1.055 * Math.pow(y, 1 / 2.4) - 0.055;
      LUT[i] = min(1, max(0, y));
    }
  })();
  function tone(x) {
    if (x <= 0) return 0;
    const s = sqrt(x / LUTMAX) * LUTN;
    if (s >= LUTN) return LUT[LUTN];
    const i = s | 0, f = s - i;
    return LUT[i] + (LUT[i + 1] - LUT[i]) * f;
  }
  Q.tone = tone;

  Q.makePiece = function (opts) {
    const W = opts.W, H = opts.H;
    const sc = W / 2160;
    const P = { W, H, outW: W, outH: H, ready: false };
    let st = null, pt = null, mul = null, add = null, varn = null, dith = null;
    let frameLin = null;

    function finishStatic() {
      const N = W * H;
      mul = new Float32Array(N); add = new Float32Array(N * 3);
      const L = pt.layers;
      for (let i = 0; i < N; i++) {
        const l = pt.lum[i];
        const light = Q.smooth(0.01, 0.25, l);
        const cr = pt.crack[i];
        mul[i] = pt.relief[i] * (1 - 0.32 * cr * (0.25 + 0.75 * light));
        // varnish sheen on raised paint + dirt-free crack edges catching light in the darks
        // thin darks: the canvas weave and crack edges catch a little light through the varnish
        const wv = pt.weave[i];
        const g = pt.gloss[i] * 0.05 + cr * 0.0009 * (1 - light) + (1 - light) * (wv * wv * 0.0014 + 0.0003);
        add[i * 3] = g * 1.0; add[i * 3 + 1] = g * 0.93; add[i * 3 + 2] = g * 0.80;
      }
      // static dither pattern (fixed => no temporal noise)
      dith = new Float32Array(N);
      for (let i = 0; i < N; i++) dith[i] = (Q.hash2i(i % W, (i / W) | 0, 5) + Q.hash2i(i % W, (i / W) | 0, 6) - 1) / 255;
      frameLin = new Float32Array(N * 3);
      P.ready = true;
    }

    P.initSync = function (log) {
      log = log || (() => {});
      Q.buildCaustics(Math.round(3000000 * Math.max(0.35, sc)));
      log('caustics');
      if (Q.peelInit) Q.peelInit(W, H);
      st = Q.createStatic(W, H, { gloss: sc > 0.7 ? 8 : 6 });
      Q.renderRows(st, 0, H);
      log('scene');
      Q.aaRows(st, 0, H);
      log('aa');
      pt = Q.paintStatic(st, log);
      st.layers = null;
      finishStatic();
      log('ready');
    };

    // async init for live viewing (keeps the page responsive)
    P.initAsync = async function (onProgress) {
      const yieldNow = () => new Promise((r) => setTimeout(r, 0));
      Q.buildCaustics(Math.round(3000000 * Math.max(0.35, sc)));
      if (Q.peelInit) Q.peelInit(W, H);
      st = Q.createStatic(W, H, { gloss: sc > 0.7 ? 8 : 6 });
      const chunk = 24;
      for (let y = 0; y < H; y += chunk) { Q.renderRows(st, y, min(H, y + chunk)); onProgress && onProgress(0.7 * (y / H)); await yieldNow(); }
      for (let y = 0; y < H; y += chunk) { Q.aaRows(st, y, min(H, y + chunk)); onProgress && onProgress(0.7 + 0.15 * (y / H)); await yieldNow(); }
      pt = Q.paintStatic(st);
      st.layers = null;
      finishStatic();
      onProgress && onProgress(1);
    };

    // compose one frame in linear light (full internal res) into frameLin
    function compose(t) {
      const f = Q.flame(t);
      const L = pt.layers, N = W * H;
      const id = f.id, isA = f.is * (1 - f.m), isB = f.is * f.m;
      const out = frameLin;
      for (let i = 0, o = 0, q = 0; i < N; i++, o += 12, q += 3) {
        const m = mul[i];
        out[q] = (L[o] + id * L[o + 3] + isA * L[o + 6] + isB * L[o + 9]) * m + add[q];
        out[q + 1] = (L[o + 1] + id * L[o + 4] + isA * L[o + 7] + isB * L[o + 10]) * m + add[q + 1];
        out[q + 2] = (L[o + 2] + id * L[o + 5] + isA * L[o + 8] + isB * L[o + 11]) * m + add[q + 2];
      }
      if (Q.peelDraw) Q.peelDraw(out, t, f, pt, W, H);
      if (Q.bubbleDraw) Q.bubbleDraw(out, t, f, pt, W, H);
    }

    const VAR = [0.985, 0.955, 0.875]; // aged varnish
    // returns RGBA at internal res (outScale 1) or downsampled by 2 (outScale 0.5)
    P.renderRGBA = function (t, outScale) {
      outScale = outScale || 1;
      compose(t);
      const out = frameLin;
      if (outScale === 1) {
        const rgba = new Uint8ClampedArray(W * H * 4);
        for (let i = 0, q = 0, p = 0; i < W * H; i++, q += 3, p += 4) {
          const d = dith[i];
          rgba[p] = (tone(out[q] * VAR[0]) + d) * 255 + 0.5;
          rgba[p + 1] = (tone(out[q + 1] * VAR[1]) + d) * 255 + 0.5;
          rgba[p + 2] = (tone(out[q + 2] * VAR[2]) + d) * 255 + 0.5;
          rgba[p + 3] = 255;
        }
        P.outW = W; P.outH = H;
        return rgba;
      }
      const w2 = W >> 1, h2 = H >> 1;
      const rgba = new Uint8ClampedArray(w2 * h2 * 4);
      for (let y = 0; y < h2; y++) for (let x = 0; x < w2; x++) {
        const i00 = (2 * y) * W + 2 * x;
        const p = (y * w2 + x) * 4;
        const d = dith[i00];
        for (let c = 0; c < 3; c++) {
          const v = tone(out[i00 * 3 + c] * VAR[c]) + tone(out[(i00 + 1) * 3 + c] * VAR[c]) + tone(out[(i00 + W) * 3 + c] * VAR[c]) + tone(out[(i00 + W + 1) * 3 + c] * VAR[c]);
          rgba[p + c] = (v * 0.25 + d) * 255 + 0.5;
        }
        rgba[p + 3] = 255;
      }
      P.outW = w2; P.outH = h2;
      return rgba;
    };
    P.getPaint = () => pt;
    return P;
  };
})(typeof window !== 'undefined' ? window : globalThis);
