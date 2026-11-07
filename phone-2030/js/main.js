// Player / exporter. renderAt(t) rebuilds the DOM layers for time t (string-diffed per layer), sizes growing
// rows (data-grow) from their measured height, and parks the persistent network canvas in its placeholder.
(async function () {
  const Q = new URLSearchParams(location.search);
  const EXPORT = Q.has('export');
  if (EXPORT) document.body.classList.add('export');
  const screen = document.getElementById('screen');
  const ORDER = ['home', 'apps', 'cover', 'call', 'banners', 'status', 'island', 'homebar', 'dim'];
  const layers = {}, cache = {};
  for (const k of ORDER) { const d = document.createElement('div'); d.className = 'L'; d.id = 'ly-' + k; screen.appendChild(d); layers[k] = d; cache[k] = null; }
  let ready = false, lastMs = 0;

  await document.fonts.load('400 16px Inter'); await document.fonts.load('600 16px Inter'); await document.fonts.load('700 16px Inter'); await document.fonts.load('500 16px Inter');
  await document.fonts.load('600 40px "Inter Display"'); await document.fonts.load('700 40px "Inter Display"'); await document.fonts.load('400 40px "Inter Display"'); await document.fonts.load('500 40px "Inter Display"');
  await document.fonts.ready;
  await U.initWallpaper();
  ready = true;

  function renderAt(t) {
    const t0 = performance.now();
    t = Math.max(0, Math.min(t, STORY.duration - 1e-6));
    const F = STORY.frame(t);
    for (const k of ORDER) {
      const h = F[k] || '';
      if (cache[k] !== h) { layers[k].innerHTML = h; cache[k] = h; }
    }
    // grow rows: wrapper height = natural height * k
    const gs = screen.querySelectorAll('[data-grow]');
    const hs = [];
    gs.forEach((el) => { el.style.height = ''; });
    gs.forEach((el) => { hs.push(el.firstElementChild ? el.firstElementChild.offsetHeight : 0); });
    gs.forEach((el, i) => { const k = +el.dataset.grow; el.style.height = (hs[i] * k).toFixed(3) + 'px'; });
    const ph = screen.querySelector('[data-canvas="net"]');
    if (ph && NET.canvas.parentNode !== ph) ph.appendChild(NET.canvas);
    lastMs = performance.now() - t0;
  }
  window.__video = {
    renderAt, duration: STORY.duration, isReady: () => ready, cues: () => K.CUES.slice().sort((a, b) => a.t - b.t),
    get lastMs() { return lastMs; }, T,
  };
  if (EXPORT) return;

  // ---- live player: ?t=12.3 freezes; click toggles play; audio plays if the mixed track exists ----
  const fit = () => document.documentElement.style.setProperty('--fit', Math.min(innerWidth / 360, innerHeight / 640).toFixed(4));
  fit(); addEventListener('resize', fit);
  const hud = document.getElementById('hud');
  if (Q.has('t')) { const t = +Q.get('t'); renderAt(t); hud.textContent = 't=' + t.toFixed(2) + ' (frozen)'; return; }
  let audio = null;
  try { audio = new Audio('../phone-2030-video/phone-2030-audio.wav'); } catch (e) { audio = null; }
  let start = performance.now(), playing = true, tPause = 0;
  document.addEventListener('click', () => {
    if (playing) { tPause = (performance.now() - start) / 1000; playing = false; if (audio) audio.pause(); }
    else { start = performance.now() - tPause * 1000; playing = true; if (audio) { audio.currentTime = tPause; audio.play().catch(() => {}); } }
  });
  if (audio) audio.play().catch(() => { hud.textContent = 'click to play with sound'; });
  function loop() {
    let t = playing ? (performance.now() - start) / 1000 : tPause;
    if (t > STORY.duration) { start = performance.now(); t = 0; if (audio) { audio.currentTime = 0; audio.play().catch(() => {}); } }
    renderAt(t);
    hud.textContent = t.toFixed(2) + ' s  ' + lastMs.toFixed(0) + ' ms';
    requestAnimationFrame(loop);
  }
  loop();
})();
