// Boot, clock and the render hook.
//   index.html              plays the loop live (1920x1080 internally, scaled to the window)
//   index.html?t=10.4       a frozen frame at t = 10.4 s
//   index.html?export       nothing draws until window.__piece.renderAt(t) is called
//   &res=4k                 3840x2160 instead of 1920x1080 (any mode)
// window.__piece = { renderAt(t), duration, isReady(), width, height, pixels(), lastMs, buildMs, sources(t) }
(function () {
  const NS = window.NS;
  const q = new URLSearchParams(location.search);
  const exportMode = q.has('export');
  const frozen = q.has('t') ? parseFloat(q.get('t')) : null;
  const k4 = q.get('res') === '4k';
  const W = k4 ? 3840 : 1920, H = k4 ? 2160 : 1080;
  const canvas = document.getElementById('art');
  canvas.width = W; canvas.height = H;
  const api = { duration: NS.FLICKER.D, width: W, height: H, lastMs: 0, buildMs: 0 };
  let R = null;

  function fit() {
    const k = Math.min(window.innerWidth / W, window.innerHeight / H);
    canvas.style.width = Math.floor(W * k) + 'px';
    canvas.style.height = Math.floor(H * k) + 'px';
  }
  window.addEventListener('resize', fit);
  fit();

  api.isReady = () => !!(R && R.ready);
  api.renderAt = function (t) {
    if (!api.isReady()) return false;
    const t0 = performance.now();
    R.renderAt(t);
    api.lastMs = performance.now() - t0;
    return true;
  };
  api.sources = (t) => Array.from(NS.FLICKER.sources(t));
  api.pixels = function () {
    const rgb = R.readRGB();
    let s = '';
    for (let i = 0; i < rgb.length; i += 0x8000) s += String.fromCharCode.apply(null, rgb.subarray(i, i + 0x8000));
    return btoa(s);
  };
  api.look = () => R.look;
  api.probe = (name, pts) => R.probe(name, pts);
  window.__piece = api;

  setTimeout(function () {
    try {
      NS.DEBUG = q.has('debug'); NS.DEBUG2 = q.has('debug2');
      if (NS.DEBUG) console.log('T:start');
      R = NS.Renderer(canvas, W, H, q.has('ss') ? parseInt(q.get('ss'), 10) : 2);
      if (NS.DEBUG) { R.gl.finish(); console.log('T:programs'); }
      R.build();
      api.buildMs = R.buildMs;
      // ?look=halo:0,bloom:0.2 overrides (development)
      if (q.has('look')) q.get('look').split(',').forEach((kv) => { const [k, v] = kv.split(':'); if (k in R.look) R.look[k] = parseFloat(v); });
    } catch (e) {
      document.getElementById('msg').textContent = 'error: ' + e.message;
      console.error(e);
      api.error = String(e && e.stack || e);
      return;
    }
    document.body.classList.add('ready');
    if (frozen != null) api.renderAt(frozen);
    else if (!exportMode) {
      const start = performance.now();
      const loop = () => { api.renderAt(((performance.now() - start) / 1000) % api.duration); requestAnimationFrame(loop); };
      requestAnimationFrame(loop);
    }
  }, 30);
})();
