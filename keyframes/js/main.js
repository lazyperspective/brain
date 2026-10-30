/* Keyframes — the room around the films (after The Still Point's room).
 *
 * Two first-frame / last-frame films share the room; ?film=the-sower (or the 01 / 02 buttons) picks one. The room
 * loads that film's two keyframes from assets/, builds it, and plays it in a canvas fitted to the window, clocked by
 * its score when sound is available. ?export shows the canvas at exactly 1080 x 1920 and exposes the render hook
 * window.__keyframes for production/render.js; ?t=<seconds> shows one frame; ?debug=seg1|seg2 shows a segmentation.
 */
(function () {
  'use strict';
  const FILMS = [
    { id: 'red-gathers', engine: window.KEYFRAMES, title: 'The Red Gathers', assets: ['assets/first.jpg', 'assets/last.jpg'], score: 'production/music/score.wav',
      medium: 'Two keyframes · 15 s between them computed in JavaScript · 1080 × 1920 · 30 fps' },
    { id: 'the-sower', engine: window.SOWER, title: 'The Sower', assets: ['assets/sower-first.jpg', 'assets/sower-last.jpg'], score: 'production/music/sower/score.wav',
      medium: 'Two keyframes · nothing destroyed, only transformed · 1080 × 1920 · 30 fps' },
  ];
  const params = new URLSearchParams(location.search);
  const fi = Math.max(0, FILMS.findIndex((f) => f.id === params.get('film')));
  const FILM = FILMS[fi], KF = FILM.engine;
  const EXPORT = params.has('export');
  const $ = (id) => document.getElementById(id);
  const stage = $('stage'), ui = $('ui'), audio = $('score');
  audio.src = FILM.score;
  document.title = FILM.title;
  $('num').textContent = 'Keyframes · ' + String(fi + 1).padStart(2, '0') + ' / ' + String(FILMS.length).padStart(2, '0');
  $('title').textContent = FILM.title;
  $('medium').textContent = FILM.medium;
  const dots = $('dots');
  FILMS.forEach((f, k) => {
    const b = document.createElement('button');
    b.textContent = String(k + 1).padStart(2, '0'); b.setAttribute('aria-label', f.title);
    if (k === fi) b.classList.add('on');
    b.addEventListener('click', () => { if (k !== fi) { const q = new URLSearchParams(location.search); q.set('film', f.id); location.search = q.toString(); } });
    dots.appendChild(b);
  });
  if (EXPORT || params.has('solo')) document.body.classList.add('solo');

  const cv = document.createElement('canvas');
  cv.width = KF.W; cv.height = KF.H;
  stage.appendChild(cv);
  const g = cv.getContext('2d', { alpha: false, willReadFrequently: EXPORT });
  const status = document.createElement('div'); status.id = 'status'; status.textContent = 'preparing the keyframes…';
  stage.appendChild(status);
  const mark = document.createElement('div'); mark.id = 'playmark'; stage.appendChild(mark);
  stage.classList.add('in');

  function layout() {
    if (EXPORT) { cv.style.cssText = 'position:fixed;left:0;top:0;width:1080px;height:1920px'; return; }
    const w = window.innerWidth, h = window.innerHeight;
    const s = Math.min(w / KF.W, h / KF.H);
    const cw = KF.W * s, ch = KF.H * s;
    cv.style.width = cw + 'px'; cv.style.height = ch + 'px';
    cv.style.left = Math.round((w - cw) / 2) + 'px'; cv.style.top = Math.round((h - ch) / 2) + 'px';
    mark.style.left = (w / 2 - 32) + 'px'; mark.style.top = (h / 2 - 32) + 'px';
  }
  layout();
  window.addEventListener('resize', layout);

  const load = (src) => new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => rej(new Error('missing ' + src)); im.src = src; });

  let ready = false, playing = false, clock = 0, last = 0, useAudio = false, lastMs = 0;
  function draw(t) { const t0 = performance.now(); KF.render(g, t); lastMs = performance.now() - t0; }

  const hook = {
    duration: KF.D, frames: KF.NF, fps: KF.FPS,
    isReady: () => ready,
    get lastMs() { return lastMs; },
    info: () => KF.info(),
    film: FILM.id,
    setOnly(o) { KF.only = o; },
    setNoSettle(v) { KF.noSettle = v; },
    renderAt(t) { playing = false; clock = t; draw(t); return lastMs; },
    // the current frame, 1080 x 1920 RGB, base64
    pixels() {
      const d = g.getImageData(0, 0, KF.W, KF.H).data, n = KF.W * KF.H, rgb = new Uint8Array(n * 3);
      for (let i = 0, j = 0; i < n; i++, j += 4) { rgb[i * 3] = d[j]; rgb[i * 3 + 1] = d[j + 1]; rgb[i * 3 + 2] = d[j + 2]; }
      let s = '';
      for (let k = 0; k < rgb.length; k += 0x8000) s += String.fromCharCode.apply(null, rgb.subarray(k, k + 0x8000));
      return btoa(s);
    },
    // a reference keyframe as fitted (1 or 2), same format
    keyframe(n) {
      const c = n === 1 ? KF.K.c1 : KF.K.c2, d = c.getContext('2d').getImageData(0, 0, KF.W, KF.H).data, m = KF.W * KF.H, rgb = new Uint8Array(m * 3);
      for (let i = 0, j = 0; i < m; i++, j += 4) { rgb[i * 3] = d[j]; rgb[i * 3 + 1] = d[j + 1]; rgb[i * 3 + 2] = d[j + 2]; }
      let s = '';
      for (let k = 0; k < rgb.length; k += 0x8000) s += String.fromCharCode.apply(null, rgb.subarray(k, k + 0x8000));
      return btoa(s);
    },
    debug(what) { KF.debugView(g, what); },
  };
  window.__keyframes = hook;

  (async () => {
    try {
      const [a, b] = await Promise.all(FILM.assets.map(load));
      await new Promise((r) => setTimeout(r, 20));
      await KF.build(a, b);
    } catch (e) {
      console.error(e);
      status.textContent = /insecure|tainted|cross-origin|SecurityError/i.test(String(e))
        ? 'This page reads the keyframes’ pixels, which browsers forbid on file:// — serve the folder over http.'
        : 'The keyframes could not be prepared: ' + e.message;
      return;
    }
    status.remove();
    ready = true;
    document.documentElement.dataset.ready = 'keyframes';
    if (params.has('debug')) { KF.debugView(g, params.get('debug')); return; }
    document.documentElement.dataset.film = FILM.id;
    const t0 = params.has('t') ? parseFloat(params.get('t')) : 0;
    clock = t0; draw(t0);
    if (!EXPORT) { mark.classList.add('on'); requestAnimationFrame(frame); }
  })();

  function now() { return useAudio && !audio.paused ? audio.currentTime : clock; }
  function frame(ts) {
    requestAnimationFrame(frame);
    const dt = last ? Math.min(0.1, (ts - last) / 1000) : 0; last = ts;
    if (!playing) return;
    if (!(useAudio && !audio.paused)) clock += dt;
    let t = now();
    if (t >= KF.D - 1 / KF.FPS) { t = KF.D - 1 / KF.FPS; playing = false; mark.classList.add('on'); }
    clock = t;
    draw(t);
  }
  function play(fromStart) {
    if (!ready) return;
    if (fromStart || clock >= KF.D - 1 / KF.FPS - 1e-6) clock = 0;
    playing = true; last = 0; mark.classList.remove('on');
    useAudio = false;
    try {
      audio.currentTime = clock;
      const pr = audio.play();
      if (pr && pr.then) pr.then(() => { useAudio = true; }).catch(() => { useAudio = false; });
    } catch (e) { useAudio = false; }
  }
  function pause() { playing = false; try { audio.pause(); } catch (e) { /* none */ } useAudio = false; mark.classList.add('on'); }
  cv.addEventListener('pointerdown', () => { if (EXPORT) return; if (playing) pause(); else play(false); poke(); });
  $('replay').addEventListener('click', () => play(true));

  /* --------------------------------------------------- quiet, idle label */
  let idleTimer = 0, hidden = false;
  function poke() { ui.classList.remove('idle'); clearTimeout(idleTimer); idleTimer = setTimeout(() => ui.classList.add('idle'), 4200); }
  ['pointermove', 'pointerdown', 'keydown', 'touchstart'].forEach((ev) => window.addEventListener(ev, poke, { passive: true }));
  poke();
  const toggleIndex = (force) => { const ix = $('index'); ix.hidden = !(force === undefined ? ix.hidden : force); };
  $('about').addEventListener('click', () => toggleIndex());
  $('index').addEventListener('click', (e) => { if (e.target.id === 'index') toggleIndex(false); });
  window.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === ' ') { e.preventDefault(); if (playing) pause(); else play(false); }
    else if (e.key === 'r' || e.key === 'R') play(true);
    else if (e.key === 'i' || e.key === 'I') toggleIndex();
    else if (e.key === 'Escape') toggleIndex(false);
    else if (e.key === 'h' || e.key === 'H') { hidden = !hidden; ui.classList.toggle('hidden', hidden); }
  });
})();
