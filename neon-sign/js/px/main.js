// Boot, clock and the render hook of the pixel piece (native 480x270, shown scaled with nearest-neighbour).
//   index.html            plays the loop live
//   index.html?t=10.4     a frozen frame at t = 10.4 s
//   index.html?export     nothing draws until window.__piece.renderAt(t) is called
// window.__piece = { renderAt(t), duration, isReady(), width, height, native: [480, 270], pixels(), indices(), sources(t) }
//   width/height are the poster size (3840x2160); pixels() returns the native 480x270 frame as base64 RGB
//   (the export tools scale it x8 for the still and x4 for the video, nearest-neighbour).
(function () {
  const NS = window.NS;
  const q = new URLSearchParams(location.search);
  const exportMode = q.has('export');
  const frozen = q.has('t') ? parseFloat(q.get('t')) : null;
  const W = 480, H = 270;
  const canvas = document.getElementById('art');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d', { alpha: false, willReadFrequently: true });
  const img = ctx.createImageData(W, H);
  const api = { duration: NS.FLICKER.D, width: 3840, height: 2160, native: [W, H], lastMs: 0, buildMs: 0 };
  let B = null, render = null, last = null;
  const pal = NS.PAL.rgb;

  function fit() {
    const k = Math.max(1, Math.floor(Math.min(window.innerWidth / W, window.innerHeight / H)));
    canvas.style.width = W * k + 'px'; canvas.style.height = H * k + 'px';
  }
  window.addEventListener('resize', fit); fit();

  api.isReady = () => !!render;
  api.renderAt = function (t) {
    if (!render) return false;
    const t0 = performance.now();
    last = render(t);
    const d = img.data;
    for (let i = 0, j = 0; i < last.length; i++, j += 4) { const c = pal[last[i]]; d[j] = c[0]; d[j + 1] = c[1]; d[j + 2] = c[2]; d[j + 3] = 255; }
    ctx.putImageData(img, 0, 0);
    api.lastMs = performance.now() - t0;
    return true;
  };
  api.sources = (t) => Array.from(NS.FLICKER.sources(t));
  api.indices = () => Array.from(last);
  api.pixels = function () {
    const rgb = new Uint8Array(W * H * 3);
    for (let i = 0; i < last.length; i++) { const c = pal[last[i]]; rgb[i * 3] = c[0]; rgb[i * 3 + 1] = c[1]; rgb[i * 3 + 2] = c[2]; }
    let s = ''; for (let i = 0; i < rgb.length; i += 0x8000) s += String.fromCharCode.apply(null, rgb.subarray(i, i + 0x8000));
    return btoa(s);
  };
  api.kinds = () => Array.from(B.kind);
  window.__piece = api;

  setTimeout(function () {
    try {
      const t0 = performance.now();
      B = NS.buildPixelScene();
      render = NS.PixelFrame(B);
      api.buildMs = performance.now() - t0;
    } catch (e) { api.error = String(e && e.stack || e); console.error(e); return; }
    document.body.classList.add('ready');
    if (frozen != null) api.renderAt(frozen);
    else if (!exportMode) {
      const start = performance.now();
      const loop = () => { api.renderAt(((performance.now() - start) / 1000) % api.duration); requestAnimationFrame(loop); };
      requestAnimationFrame(loop);
    }
  }, 20);
})();
