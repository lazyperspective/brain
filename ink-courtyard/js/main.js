// "The Blue House" - boot, clock and the render hook.
//   index.html            plays the loop on the wall clock
//   index.html?t=12.5     a frozen frame at t = 12.5 s
//   index.html?export     static clock: nothing draws until window.__courtyard.renderAt(t) is called
// window.__courtyard = { renderAt(t), duration, isReady(), lastMs, pixels(), probe(t) }
(function () {
  const CY = window.CY;
  const q = new URLSearchParams(location.search);
  const exportMode = q.has('export');
  const frozen = q.has('t') ? parseFloat(q.get('t')) : null;
  const canvas = document.getElementById('art');
  const g = canvas.getContext('2d', { alpha: false, willReadFrequently: exportMode });
  const api = { duration: 28, lastMs: 0, ready: false, buildMs: 0 };
  let L = null;

  function fit() {
    const vw = window.innerWidth, vh = window.innerHeight, k = Math.min(vw / 1080, vh / 1920);
    canvas.style.width = Math.floor(1080 * k) + 'px';
    canvas.style.height = Math.floor(1920 * k) + 'px';
  }
  window.addEventListener('resize', fit);
  fit();

  api.renderAt = function (t) {
    if (!api.ready) return false;
    const t0 = performance.now();
    CY.A.render(g, L, t);
    api.lastMs = performance.now() - t0;
    return true;
  };
  api.isReady = () => api.ready;
  // the frame as base64 RGB (no alpha), for the export tools
  api.pixels = function () {
    const d = g.getImageData(0, 0, 1080, 1920).data, n = 1080 * 1920, rgb = new Uint8Array(n * 3);
    for (let i = 0, j = 0; i < n * 4; i += 4) { rgb[j++] = d[i]; rgb[j++] = d[i + 1]; rgb[j++] = d[i + 2]; }
    let s = '';
    for (let i = 0; i < rgb.length; i += 0x8000) s += String.fromCharCode.apply(null, rgb.subarray(i, i + 0x8000));
    return btoa(s);
  };
  api.probe = (t) => CY.A.probe(t);
  window.__courtyard = api;

  function build() {
    const t0 = performance.now();
    CY.G.D = api.duration;
    CY.makeFields();
    L = CY.paintScene();
    CY.A.initWind(api.duration);
    CY.A.buildClusters();
    CY.A.buildPetals();
    CY.A.buildLantern();
    CY.A.buildWisps();
    CY.A.buildSparrow();
    api.buildMs = performance.now() - t0;
    api.ready = true;
    document.body.classList.add('ready');
    if (frozen != null) api.renderAt(frozen);
    else if (!exportMode) {
      const start = performance.now();
      const loop = () => { api.renderAt(((performance.now() - start) / 1000) % api.duration); requestAnimationFrame(loop); };
      requestAnimationFrame(loop);
    }
  }
  // let the page paint its dark ground before the long build
  setTimeout(build, 30);
})();
