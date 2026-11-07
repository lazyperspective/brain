// Player / exporter. Draws the 800x600 virtual screen, then composites it through the screen-recording camera
// into the 1440x1080 frame with "sharp bilinear" scaling (nearest-neighbour to an integer factor, then a light
// bilinear resample) so the pixel UI stays crisp at any zoom without shimmering.
(async function () {
  const Q = new URLSearchParams(location.search);
  const EXPORT = Q.has('export');
  if (EXPORT) document.body.classList.add('export');
  const out = document.getElementById('out'), octx = out.getContext('2d', { willReadFrequently: true });
  const OW = 1440, OH = 1080, BASE = OW / W98.SW;
  const scr = document.createElement('canvas'); scr.width = W98.SW; scr.height = W98.SH;
  const sctx = scr.getContext('2d', { willReadFrequently: true });
  const mid = document.createElement('canvas'); mid.width = 3000; mid.height = 2300;
  const mctx = mid.getContext('2d');
  let ready = false, lastMs = 0;

  K.initFonts();
  await K.initTTFonts();
  STORY.init();
  ready = true;

  function composite(cam) {
    const S = BASE * cam.zoom, vw = OW / S, vh = OH / S;
    let sx = K.clamp(cam.cx - vw / 2, 0, W98.SW - vw), sy = K.clamp(cam.cy - vh / 2, 0, W98.SH - vh);
    const k = Math.max(2, Math.ceil(S - 1e-6));
    const ix0 = Math.max(0, Math.floor(sx) - 1), iy0 = Math.max(0, Math.floor(sy) - 1);
    const iw = Math.min(W98.SW - ix0, Math.ceil(vw) + 3), ih = Math.min(W98.SH - iy0, Math.ceil(vh) + 3);
    mctx.imageSmoothingEnabled = false;
    mctx.drawImage(scr, ix0, iy0, iw, ih, 0, 0, iw * k, ih * k);
    octx.imageSmoothingEnabled = true; octx.imageSmoothingQuality = 'low';
    octx.fillStyle = '#000'; octx.fillRect(0, 0, OW, OH);
    octx.drawImage(mid, 0, 0, iw * k, ih * k, (ix0 - sx) * S, (iy0 - sy) * S, iw * S, ih * S);
  }
  function renderAt(t) {
    const t0 = performance.now();
    sctx.setTransform(1, 0, 0, 1, 0, 0); sctx.globalAlpha = 1; sctx.globalCompositeOperation = 'source-over';
    STORY.draw(sctx, t);
    composite(STORY.camera(t));
    if (STORY.post) STORY.post(octx, t, OW, OH);
    lastMs = performance.now() - t0;
  }
  function pixels() { // RGB24 base64
    const d = octx.getImageData(0, 0, OW, OH).data, n = OW * OH, rgb = new Uint8Array(n * 3);
    for (let i = 0, j = 0; i < n; i++, j += 4) { rgb[i * 3] = d[j]; rgb[i * 3 + 1] = d[j + 1]; rgb[i * 3 + 2] = d[j + 2]; }
    let s = ''; const CH = 0x8000;
    for (let i = 0; i < rgb.length; i += CH) s += String.fromCharCode.apply(null, rgb.subarray(i, i + CH));
    return btoa(s);
  }
  window.__video = {
    renderAt, duration: STORY.duration, isReady: () => ready, pixels, cues: () => STORY.cues(),
    get lastMs() { return lastMs; }, screen: scr, cam: (t) => STORY.camera(t),
  };
  if (EXPORT) return;

  // ---- live player: ?t=12.3 freezes; click toggles play; audio plays if the mixed track exists ----
  const hud = document.getElementById('hud');
  if (Q.has('t')) { const t = +Q.get('t'); renderAt(t); hud.textContent = 't=' + t.toFixed(2) + ' (frozen)'; return; }
  let audio = null;
  try { audio = new Audio('../clippy-agi-video/clippy-agi-audio.wav'); } catch (e) { audio = null; }
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
