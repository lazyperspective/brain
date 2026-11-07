// "Mobile" - page boot, clock and the export hook.
//   index.html              plays the loop live (worker threads render bands of each frame at half scale)
//   index.html?t=7.5        one frozen frame at t = 7.5 s (supersampled: rendered at 2160 x 2700, shown at 1080 x 1350)
//   index.html?s=0.375      live playback at another render scale
//   index.html?export       nothing plays; window.__piece = { renderAt(t, s?, down?), duration, isReady(), width, height,
//                           pixels(), lastMs } for the production scripts (default s = 1, down = 2 -> 1080 x 1350)
(function () {
  const q = new URLSearchParams(location.search);
  const exportMode = q.has('export');
  const frozen = q.has('t') ? parseFloat(q.get('t')) : null;
  const canvas = document.getElementById('art');
  const g = canvas.getContext('2d', { alpha: false });
  const core = MobileCore();
  const DUR = core.DUR;

  function fit() {
    const k = Math.min(window.innerWidth / canvas.width, window.innerHeight / canvas.height) * 0.94;
    canvas.style.width = Math.floor(canvas.width * k) + 'px';
    canvas.style.height = Math.floor(canvas.height * k) + 'px';
  }
  window.addEventListener('resize', fit);

  function show(r) {
    if (canvas.width !== r.w || canvas.height !== r.h) { canvas.width = r.w; canvas.height = r.h; fit(); }
    g.putImageData(new ImageData(r.data, r.w, r.h), 0, 0);
  }

  // ---------------------------------------------------------------- export hook
  let last = null;
  const api = {
    duration: DUR, width: 1080, height: 1350, lastMs: 0, ready: true,
    isReady: () => true,
    renderAt(t, s, down) {
      const t0 = performance.now();
      last = core.render(t, s || 1, down || 2);
      api.lastMs = performance.now() - t0;
      return { w: last.w, h: last.h };
    },
    show() { show(last); },
    _last: () => last,
    pixels() { // base64 RGB of the last render
      const d = last.data, n = last.w * last.h, rgb = new Uint8Array(n * 3);
      for (let i = 0, j = 0; i < n * 4; i += 4) { rgb[j++] = d[i]; rgb[j++] = d[i + 1]; rgb[j++] = d[i + 2]; }
      let s = '';
      for (let i = 0; i < rgb.length; i += 0x8000) s += String.fromCharCode.apply(null, rgb.subarray(i, i + 0x8000));
      return btoa(s);
    },
  };
  window.__piece = api;
  fit();
  if (exportMode) return;

  if (frozen != null) { setTimeout(() => show(core.render(frozen, +(q.get('s') || 1), +(q.get('down') || 2))), 20); return; }

  // ---------------------------------------------------------------- live playback
  const S = +(q.get('s') || 0.5);
  const Wo = Math.round(2160 * S), Ho = Math.round(2700 * S);
  canvas.width = Wo; canvas.height = Ho; fit();
  const start = performance.now();
  const clock = () => (((performance.now() - start) / 1000) % DUR + DUR) % DUR;

  function single() {
    const loop = () => { show(core.render(clock(), S, 1)); requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  }

  let workers = [];
  try {
    const n = Math.max(2, Math.min(6, (navigator.hardwareConcurrency || 4) - 1));
    const src = '(' + MobileCore.toString() + ');\nconst MC = ' + MobileCore.name + ';\nlet core = null;\n' +
      'onmessage = (e) => { const m = e.data; if (m.init) { core = MC(); core.prepare(m.s); postMessage({ ready: true }); return; }\n' +
      '  const r = core.render(m.t, m.s, 1, null, m.y0, m.y1); postMessage({ id: m.id, y0: m.y0, data: r.data }, [r.data.buffer]); };';
    const url = URL.createObjectURL(new Blob([src], { type: 'text/javascript' }));
    for (let i = 0; i < n; i++) workers.push(new Worker(url));
  } catch (e) { workers = []; }
  if (!workers.length) { single(); return; }

  const n = workers.length, bands = [];
  for (let i = 0; i < n; i++) bands.push([Math.round((Ho * i) / n), Math.round((Ho * (i + 1)) / n)]);
  const img = new ImageData(Wo, Ho);
  let ready = 0, frameId = 0, pending = 0, failed = false;
  const fallback = () => { if (failed) return; failed = true; workers.forEach((w) => w.terminate()); single(); };
  function request() {
    frameId++; pending = n;
    const t = clock();
    workers.forEach((w, i) => w.postMessage({ id: frameId, t, s: S, y0: bands[i][0], y1: bands[i][1] }));
  }
  workers.forEach((w) => {
    w.onerror = fallback;
    w.onmessage = (e) => {
      const m = e.data;
      if (m.ready) { if (++ready === n) request(); return; }
      if (m.id !== frameId) return;
      img.data.set(m.data, m.y0 * Wo * 4);
      if (--pending === 0) { g.putImageData(img, 0, 0); requestAnimationFrame(request); }
    };
    w.postMessage({ init: true, s: S });
  });
  setTimeout(() => { if (ready < n) fallback(); }, 30000);
})();
