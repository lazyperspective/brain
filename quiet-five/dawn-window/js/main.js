// Dawn, a Window, a Glass of Water — orchestration: build the still painting once, then per frame
// add the moving light (star, water, caustic) and the breathing curtain, light the paint surface, and output.
//   index.html            live loop
//   index.html?t=4.2      frozen frame
//   index.html?export     exposes window.__piece = { renderAt(t, opts), pixels(), ready, duration }
//   &res=1080             internal resolution (default 2160; the 1080 video is a 2x2 box-downsample of it)
(function () {
  'use strict';
  const DW = window.DW;
  const L = 10; // loop length, seconds
  DW.L = L;
  // framing: the scene is painted on a slightly larger canvas and the picture is the window-centred crop of it
  // (zoom about a point high in the wall: trims the headroom and the dead wall under the sill)
  const ZOOM = 1.12, PIVOT_Y = 0.537;
  DW.frameFor = function (outW) {
    const W = Math.round((outW * ZOOM) / 2) * 2;
    return { Wint: W, x0: Math.round((W - outW) / 2), y0: Math.round(PIVOT_Y * (W - outW)), w: outW, h: Math.round(outW * 1.25) };
  };

  const qs = new URLSearchParams(location.search);
  const EXPORT = qs.has('export');
  const TFREEZE = qs.has('t') ? parseFloat(qs.get('t')) : null;

  function log(...a) { if (EXPORT) console.log(...a); }

  DW.build = function (Wpx) {
    const t0 = performance.now();
    const S = DW.buildReference(Wpx);
    const t1 = performance.now();
    const pnt = DW.paint(S, 4471);
    pnt.strokes += DW.paintAccents(S, pnt.P, pnt.Hh, 991);
    const t2 = performance.now();
    const { Hpx, N } = S;
    const P = pnt.P;
    // the glass of water is painted over the finished background (it refracts the painted window)
    let glassInfo = null;
    if (DW.glassStatic) glassInfo = DW.glassStatic(S, P, pnt.Hh);
    // a breath of halation: the bright window bleeds very slightly into the darks around it
    {
      const ds2 = DW.downsample(P, Wpx, Hpx, 3, 4);
      const hi = ds2.data;
      for (let i = 0; i < hi.length; i++) hi[i] = Math.max(0, hi[i] - 0.12);
      const bl = DW.boxBlur(hi, ds2.w, ds2.h, 3, Math.max(2, Math.round(ds2.w * 0.012)), 3);
      const o = [0, 0, 0];
      for (let j = 0; j < Hpx; j++) for (let i = 0; i < Wpx; i++) {
        DW.bilinear(bl, ds2.w, ds2.h, 3, i / 4, j / 4, o);
        const q = (j * Wpx + i) * 3;
        P[q] += o[0] * 0.10; P[q + 1] += o[1] * 0.09; P[q + 2] += o[2] * 0.10;
      }
    }
    const t3 = performance.now();
    // surface: canvas weave shows where paint is thin; impasto where it is thick
    const weave = DW.canvasWeave(Wpx, Hpx);
    const Htot = new Float32Array(N);
    const Hc = new Float32Array(N);
    const sc = Wpx / 2160;
    const wv = DW.smooth(0.3, 0.9, sc); // the weave fades out when the canvas is painted too small to hold it
    for (let i = 0; i < N; i++) {
      const h = pnt.Hh[i];
      const thin = 1 - DW.smooth(0.05, 0.55, h);
      Hc[i] = weave[i] * 0.2 * wv;
      Htot[i] = weave[i] * wv * (0.03 + 0.25 * thin * thin) + h * 2.2;
    }
    const shadeBg = DW.reliefShade(Htot, Wpx, Hpx, 0.9 * sc);
    const shadeCanvas = DW.reliefShade(Hc, Wpx, Hpx, 0.9 * sc);
    // amplitude of the relief: stronger in the darks (the weave reads through thin dark paint)
    const amp = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const l = 0.3 * P[i * 3] + 0.6 * P[i * 3 + 1] + 0.1 * P[i * 3 + 2];
      const lp = Math.sqrt(l);
      amp[i] = 0.45 + 1.1 * (1 - DW.smooth(0.06, 0.45, lp)) + 0.55 * DW.smooth(0.35, 0.8, pnt.Hh[i]);
    }
    const t4 = performance.now();
    // wide-blurred background: the light that reaches the back of the curtain
    const ds = DW.downsample(P, Wpx, Hpx, 3, 8);
    // irradiance on the cloth: the curtain hangs a hand's breadth in front of the glass, so it is lit by
    // nearly the whole window at once (a very broad blur), with a little of the local light
    const wideM = DW.boxBlur(ds.data, ds.w, ds.h, 3, Math.max(2, Math.round(ds.w * 0.035)), 3);
    const wideL = DW.boxBlur(ds.data, ds.w, ds.h, 3, Math.max(3, Math.round(ds.w * 0.15)), 3);
    const wide = new Float32Array(wideM.length);
    for (let i = 0; i < wide.length; i++) wide[i] = 0.35 * wideM[i] + 0.65 * wideL[i] * 1.25;
    const st = {
      Wpx, Hpx, N, S, P, H: pnt.Hh, shadeBg, shadeCanvas, amp, wide: { data: wide, w: ds.w, h: ds.h, f: 8 },
      glass: glassInfo, frame: new Float32Array(N * 3), shade: new Float32Array(N),
    };
    if (DW.curtainInit) DW.curtainInit(st);
    if (DW.waterInit) DW.waterInit(st);
    const t5 = performance.now();
    st.buildMs = { ref: t1 - t0, paint: t2 - t1, glass: t3 - t2, surface: t4 - t3, dyn: t5 - t4, strokes: pnt.strokes };
    log('build', JSON.stringify(st.buildMs));
    return st;
  };

  // per-frame composite into st.frame (linear RGB) and st.shade
  DW.renderFrame = function (st, t) {
    t = ((t % L) + L) % L;
    const F = st.frame, sh = st.shade;
    F.set(st.P);
    sh.set(st.shadeBg);
    if (DW.starDraw) DW.starDraw(st, t);
    if (DW.waterDraw) DW.waterDraw(st, t);
    if (DW.curtainDraw) DW.curtainDraw(st, t);
    // light the paint surface
    const N = st.N, amp = st.amp;
    for (let i = 0; i < N; i++) {
      const k = 1 + amp[i] * sh[i];
      F[i * 3] *= k; F[i * 3 + 1] *= k; F[i * 3 + 2] *= k;
    }
    return F;
  };

  // linear float -> 8-bit sRGB with a fixed (non-flickering) triangular dither; optional 2x2 box downsample
  let LUT = null;
  function buildLUT() {
    LUT = new Float32Array(4097);
    for (let i = 0; i <= 4096; i++) LUT[i] = DW.l2s(i / 4096) * 255;
  }
  function enc(v) {
    if (v <= 0) return 0;
    if (v >= 1) return 255;
    const x = v * 4096, i = x | 0, f = x - i;
    return LUT[i] + (LUT[i + 1] - LUT[i]) * f;
  }
  // crop: {x0, y0, w, h} region of the internal canvas that is the picture
  DW.encode = function (F, Wpx, Hpx, down, crop) {
    if (!LUT) buildLUT();
    const c = crop || { x0: 0, y0: 0, w: Wpx, h: Hpx };
    const f = down ? 2 : 1;
    const w = c.w / f | 0, h = c.h / f | 0;
    const out = new Uint8Array(w * h * 3);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let r, g, b;
        if (f === 1) {
          const q = ((y + c.y0) * Wpx + x + c.x0) * 3;
          r = F[q]; g = F[q + 1]; b = F[q + 2];
        } else {
          const q0 = ((2 * y + c.y0) * Wpx + 2 * x + c.x0) * 3, q1 = q0 + Wpx * 3;
          r = (F[q0] + F[q0 + 3] + F[q1] + F[q1 + 3]) * 0.25;
          g = (F[q0 + 1] + F[q0 + 4] + F[q1 + 1] + F[q1 + 4]) * 0.25;
          b = (F[q0 + 2] + F[q0 + 5] + F[q1 + 2] + F[q1 + 5]) * 0.25;
        }
        const d = DW.hash2(x, y, 99) + DW.hash2(x, y, 98) - 1; // triangular, fixed per pixel
        const o = (y * w + x) * 3;
        out[o] = Math.max(0, Math.min(255, Math.round(enc(r) + d)));
        out[o + 1] = Math.max(0, Math.min(255, Math.round(enc(g) + d)));
        out[o + 2] = Math.max(0, Math.min(255, Math.round(enc(b) + d)));
      }
    }
    return { data: out, w, h };
  };

  function blit(canvas, img) {
    if (canvas.width !== img.w) canvas.width = img.w;
    if (canvas.height !== img.h) canvas.height = img.h;
    const ctx = canvas.getContext('2d');
    const id = ctx.createImageData(img.w, img.h);
    const d = id.data, s = img.data;
    for (let i = 0, j = 0; i < s.length; i += 3, j += 4) { d[j] = s[i]; d[j + 1] = s[i + 1]; d[j + 2] = s[i + 2]; d[j + 3] = 255; }
    ctx.putImageData(id, 0, 0);
  }

  function b64(u8) {
    let s = '';
    const CH = 0x8000;
    for (let i = 0; i < u8.length; i += CH) s += String.fromCharCode.apply(null, u8.subarray(i, i + CH));
    return btoa(s);
  }

  const canvas = document.getElementById('c');
  const wait = document.getElementById('wait');

  if (EXPORT) {
    const res = parseInt(qs.get('res') || '2160', 10);
    let st = null, last = null;
    const DETAIL = qs.has('detail');
    window.__piece = {
      duration: L,
      ready: false,
      lastMs: 0,
      build() { if (!st) { const fr = DW.frameFor(res); st = DW.build(fr.Wint); st.crop = fr; st.detail = DETAIL; } this.ready = true; return st.buildMs; },
      // opts.size: output width (1080 or 2160). Same t -> same pixels.
      renderAt(t, opts) {
        if (!st) this.build();
        const size = (opts && opts.size) || 1080;
        const a = performance.now();
        const F = DW.renderFrame(st, t);
        last = DW.encode(F, st.Wpx, st.Hpx, size < st.crop.w, st.crop);
        this.lastMs = performance.now() - a;
        if (!opts || !opts.noBlit) blit(canvas, last);
        return { w: last.w, h: last.h, ms: this.lastMs };
      },
      pixels() { return b64(last.data); },
    };
    if (wait) wait.remove();
  } else {
    // live: build at a resolution that suits the screen, then play in real time. Frames are cached as compressed
    // images as they are painted (the first pass plays as fast as they can be made); once all 300 exist the loop
    // plays smoothly at 30 fps from the cache.
    const want = Math.min(1080, Math.max(540, Math.round(Math.min(innerWidth, innerHeight * 0.8) * (devicePixelRatio || 1) / 2) * 2));
    setTimeout(() => {
      const fr = DW.frameFor(want);
      const st = DW.build(fr.Wint);
      st.crop = fr;
      if (wait) wait.remove();
      if (TFREEZE !== null) {
        blit(canvas, DW.encode(DW.renderFrame(st, TFREEZE), st.Wpx, st.Hpx, false, st.crop));
        return;
      }
      const NF = Math.round(L * 30);
      const cache = new Array(NF).fill(null);
      let made = 0, next = 0;
      const ctx = canvas.getContext('2d');
      const start = performance.now();
      const work = () => {
        if (made >= NF) return;
        // paint the frame that is due soonest and not yet cached
        const now = Math.floor((((performance.now() - start) / 1000) % L) * 30);
        let f = now;
        for (let k = 0; k < NF && cache[f]; k++) f = (f + 1) % NF;
        if (cache[f]) return;
        blit(canvas, DW.encode(DW.renderFrame(st, f / 30), st.Wpx, st.Hpx, false, st.crop));
        cache[f] = 'pending';
        canvas.toBlob((b) => {
          createImageBitmap(b).then((bm) => { cache[f] = bm; made++; });
        }, 'image/webp', 0.94);
        setTimeout(work, 0);
      };
      setTimeout(work, 0);
      const tick = () => {
        if (made >= NF) {
          const f = Math.floor((((performance.now() - start) / 1000) % L) * 30) % NF;
          if (cache[f] && cache[f] !== 'pending' && f !== next) { ctx.drawImage(cache[f], 0, 0); next = f; }
        }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }, 30);
  }
})();
