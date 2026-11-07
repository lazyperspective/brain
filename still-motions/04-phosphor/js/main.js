// Phosphor: page wiring.
//   index.html               plays the loop live (resolution from ?w=, default fits the window)
//   index.html?t=3.5         freezes at t
//   index.html?export        exposes window.__piece = { renderAt(t), duration, isReady(), width, height,
//                            pixels(down) -> base64 RGB (down = 1 or 2: box-downsampled), lastMs }
(function () {
  const PH = window.PH;
  const q = new URLSearchParams(location.search);
  const exportMode = q.has('export');
  const D = PH.scene.D;
  let W = q.has('w') ? Math.round(+q.get('w') / 4) * 4 : exportMode ? 2160 : Math.min(1080, Math.round(Math.min(innerWidth, innerHeight * 0.8) * (devicePixelRatio || 1) / 4) * 4);
  W = Math.max(240, W);
  const H = Math.round((W * 5) / 4);
  const cv = document.getElementById('c');
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');
  const img = ctx.createImageData(W, H);
  const r = new PH.Renderer(W, H);
  let ready = false;
  function init() {
    const t0 = performance.now();
    r.buildStatic();
    r.refLight = 1;
    r.lightLevel = 1;
    // reference light level for the panel: the total emission at t = 0 (fixed, so every frame is a pure function of t)
    r.render(0);
    r.refLight = r.lightLevel;
    r.buildMs = performance.now() - t0;
    ready = true;
  }
  function draw(t) {
    r.render(((t % D) + D) % D);
    img.data.set(r.out);
    ctx.putImageData(img, 0, 0);
  }
  const api = (window.__piece = {
    duration: D, width: W, height: H,
    isReady: () => ready,
    renderAt(t) { draw(t); api.lastMs = r.lastMs; api.timing = r.timing; },
    pixels(down) {
      down = down || 1;
      const w = W / down, h = H / down, o = new Uint8Array(w * h * 3), src = r.out;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        for (let c = 0; c < 3; c++) {
          let s = 0;
          for (let yy = 0; yy < down; yy++) for (let xx = 0; xx < down; xx++) s += src[((y * down + yy) * W + x * down + xx) * 4 + c];
          o[(y * w + x) * 3 + c] = Math.round(s / (down * down));
        }
      }
      let bin = '';
      const CH = 0x8000;
      for (let i = 0; i < o.length; i += CH) bin += String.fromCharCode.apply(null, o.subarray(i, i + CH));
      return btoa(bin);
    },
  });
  setTimeout(() => {
    init();
    if (exportMode) return;
    if (q.has('t')) { draw(+q.get('t')); return; }
    const start = performance.now();
    const loop = () => { draw(((performance.now() - start) / 1000) % D); requestAnimationFrame(loop); };
    loop();
  }, 0);
})();
