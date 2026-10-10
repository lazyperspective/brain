/* Ten Hands — the room around the artworks.
 *
 * Each artwork registers itself on window.PIECES with
 *   { id, title, medium, note, about, tone: 'dark'|'light', mount(el, api) }
 * and mount() returns { destroy() }. The piece owns `el` (a full-viewport box)
 * and everything inside it. api.ready() tells the room its first frame is done.
 */
(function () {
  'use strict';

  const PIECES = window.PIECES || [];
  const params = new URLSearchParams(location.search);
  const SOLO = params.has('solo');
  const FIXED_SEED = params.has('seed') ? (parseInt(params.get('seed'), 10) >>> 0) : null;
  if (SOLO) document.body.classList.add('solo');

  const stage = document.getElementById('stage');
  const ui = document.getElementById('ui');
  const $ = (id) => document.getElementById(id);
  const pad = (n) => String(n).padStart(2, '0');

  let cur = -1, live = null, token = 0;

  /* ---------------------------------------------------------- navigation */
  const dots = $('dots');
  PIECES.forEach((p, i) => {
    const b = document.createElement('button');
    b.textContent = pad(i + 1);
    b.setAttribute('aria-label', p.title);
    b.addEventListener('click', () => go(i));
    dots.appendChild(b);
  });

  const list = $('list');
  PIECES.forEach((p, i) => {
    const li = document.createElement('li');
    li.innerHTML = '<span class="n">' + pad(i + 1) + '</span><span class="t"></span><span class="m"></span><span class="d"></span>';
    li.querySelector('.t').textContent = p.title;
    li.querySelector('.m').textContent = p.medium;
    li.querySelector('.d').textContent = p.about || '';
    li.addEventListener('click', () => { toggleIndex(false); go(i); });
    list.appendChild(li);
  });

  function indexFromHash() {
    const h = decodeURIComponent(location.hash.slice(1));
    if (!h) return 0;
    const n = parseInt(h, 10);
    if (!isNaN(n) && n >= 1 && n <= PIECES.length) return n - 1;
    const k = PIECES.findIndex((p) => p.id === h);
    return k >= 0 ? k : 0;
  }

  function go(i) {
    i = ((i % PIECES.length) + PIECES.length) % PIECES.length;
    if (i === cur) return;
    if (location.hash.slice(1) !== String(i + 1)) history.replaceState(null, '', '#' + (i + 1));
    show(i);
  }

  function show(i) {
    const my = ++token;
    cur = i;
    const p = PIECES[i];
    [...dots.children].forEach((b, k) => b.classList.toggle('on', k === i));
    $('num').textContent = pad(i + 1) + ' / ' + pad(PIECES.length);
    $('title').textContent = p.title;
    $('medium').textContent = p.medium;
    $('note').textContent = p.note || '';
    document.title = p.title + ' — Ten Hands';
    delete document.documentElement.dataset.ready;

    stage.classList.remove('in');
    setTimeout(() => {
      if (my !== token) return;
      if (live) { try { live.destroy && live.destroy(); } catch (e) { console.error(e); } live = null; }
      stage.innerHTML = '';
      ui.dataset.tone = p.tone || 'dark';
      document.body.style.background = p.room || '';
      const el = document.createElement('div');
      el.className = 'piece piece-' + p.id;
      stage.appendChild(el);

      let done = false;
      const reveal = () => {
        if (done || my !== token) return;
        done = true;
        stage.classList.add('in');
        document.documentElement.dataset.ready = p.id;
      };
      const seed = FIXED_SEED !== null ? FIXED_SEED : (Math.random() * 4294967296) >>> 0;
      const api = {
        seed,
        ready: reveal,
        isCurrent: () => my === token,
      };
      try {
        live = p.mount(el, api) || null;
      } catch (e) {
        console.error(e);
        el.textContent = 'This work failed to draw: ' + e.message;
        el.style.cssText += ';color:#ccc;display:flex;align-items:center;justify-content:center;font-style:italic';
        reveal();
      }
      setTimeout(reveal, 6000); // never leave the room dark
    }, cur === -1 ? 0 : 420);
    poke();
  }

  /* --------------------------------------------------- quiet, idle label */
  let idleTimer = 0, hiddenByUser = false;
  function poke() {
    ui.classList.remove('idle');
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => ui.classList.add('idle'), 4200);
  }
  ['pointermove', 'pointerdown', 'keydown', 'touchstart'].forEach((ev) =>
    window.addEventListener(ev, poke, { passive: true }));

  function toggleIndex(force) {
    const ix = $('index');
    const open = force === undefined ? ix.hidden : force;
    ix.hidden = !open;
  }

  $('prev').addEventListener('click', () => go(cur - 1));
  $('next').addEventListener('click', () => go(cur + 1));
  $('about').addEventListener('click', () => toggleIndex());
  $('index').addEventListener('click', (e) => { if (e.target.id === 'index') toggleIndex(false); });

  window.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === 'ArrowRight') go(cur + 1);
    else if (e.key === 'ArrowLeft') go(cur - 1);
    else if (e.key === 'i' || e.key === 'I') toggleIndex();
    else if (e.key === 'Escape') toggleIndex(false);
    else if (e.key === 'h' || e.key === 'H') { hiddenByUser = !hiddenByUser; ui.classList.toggle('hidden', hiddenByUser); }
    else if (/^[0-9]$/.test(e.key)) { const n = e.key === '0' ? 9 : +e.key - 1; if (n < PIECES.length) go(n); }
  });

  window.addEventListener('hashchange', () => { const i = indexFromHash(); if (i !== cur) show(i); });

  window.__gallery = { go, get current() { return cur; }, pieces: PIECES };

  if (PIECES.length) show(indexFromHash());
})();
