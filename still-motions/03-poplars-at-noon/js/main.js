// Poplars at Noon: boot, live loop, and the export hook.
//   index.html            plays the loop live
//   index.html?t=3.5      freezes at t = 3.5 s
//   index.html?export     exposes window.__piece = { renderAt(t), duration, isReady(), width, height, pixels(half) }
(function (G) {
  'use strict';
  const DURATION = 20, W = 2160, H = 2700;
  const q = new URLSearchParams(location.search);
  const canvas = document.getElementById('art');
  const msg = document.getElementById('msg');
  let ready = false, R = null, buildMs = 0;
  const phase = (t) => { const p = (t / DURATION) % 1; return p < 0 ? p + 1 : p; };

  function boot() {
    const t0 = performance.now();
    const data = G.PAINT.build();
    buildMs = performance.now() - t0;
    const exportMode = q.has('export');
    // live: render at up to 2x the displayed size and resample down; export: master size
    let scale = 1;
    if (!exportMode) {
      const dpr = G.devicePixelRatio || 1;
      const disp = Math.min(G.innerHeight * dpr, (G.innerWidth * dpr * 5) / 4);
      scale = Math.min(1, Math.max(0.25, (2 * disp) / H));
      scale = Math.round(scale * W / 2) * 2 / W; // even width so the 2x downscale is exact
      canvas.width = Math.round(W * scale / 2); canvas.height = Math.round(H * scale / 2);
    } else { canvas.width = W / 2; canvas.height = H / 2; }
    R = new G.Renderer(canvas, data, { width: W, height: H });
    G.__renderer = R;
    ready = true;
    if (msg) msg.remove();
    G.__piece = {
      duration: DURATION, width: W, height: H, isReady: () => ready, buildMs, dabs: data.count, nStatic: data.nStatic, counts: data.counts,
      // render frame t; returns base64 RGBA rows (top-down) of the full master (half=false) or the 2x-downscaled frame
      // crop = [x, y, w, h] in output pixels: return only that rectangle
      renderAt(t, half, scale, crop) {
        const t1 = performance.now();
        const rb = R.readback(phase(t), !!half, scale || 1);
        const ms = performance.now() - t1;
        let s = '';
        let px = rb.px, w = rb.dw, h = rb.dh;
        if (crop) {
          const [cx, cy, cw, ch] = crop, sub = new Uint8Array(cw * ch * 4);
          for (let y = 0; y < ch; y++) sub.set(px.subarray(((cy + y) * w + cx) * 4, ((cy + y) * w + cx + cw) * 4), y * cw * 4);
          px = sub; w = cw; h = ch;
        }
        const CH = 0x8000;
        for (let i = 0; i < px.length; i += CH) s += String.fromCharCode.apply(null, px.subarray(i, i + CH));
        G.__piece.lastMs = ms;
        return { w, h, b64: btoa(s), ms };
      },
    };
    if (exportMode) return;
    const draw = (t) => { R.paint(phase(t), scale); R.output(null, canvas.width, canvas.height, false, true); };
    if (q.has('t')) { draw(parseFloat(q.get('t')) || 0); return; }
    const start = performance.now();
    const loop = () => { draw((performance.now() - start) / 1000); requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  }
  setTimeout(boot, 30);
})(window);
