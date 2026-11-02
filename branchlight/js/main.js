/* Branchlight — viewer. Draws each slide live from code (fixed seeds), one at a time.
 * Navigation: arrow keys, swipe, buttons. Hash #1..#4 selects a slide.
 * Render hook for export: window.__branchlight.render(i) -> { canvas, ms }.
 */
(function () {
  'use strict';
  const BL = window.BL;
  const slides = BL.slides;
  const view = document.getElementById('slide');
  const busy = document.getElementById('busy');
  const dots = document.getElementById('dots');
  const cache = new Map();
  if (new URLSearchParams(location.search).has('bare')) document.body.classList.add('bare');

  function render(i) {
    const sl = slides[i];
    const t0 = performance.now();
    const S = new BL.Surface(sl.seed);
    sl.render(S);
    const idx = BL.quantise(S);
    const canvas = BL.toCanvas(idx, BL.SCALE);
    const ms = performance.now() - t0;
    let used = new Set(idx).size;
    return { canvas, ms, colours: used, id: sl.id, idx };
  }

  function get(i) {
    if (!cache.has(i)) cache.set(i, render(i));
    return cache.get(i);
  }

  let cur = -1;
  function show(i) {
    i = (i + slides.length) % slides.length;
    if (i === cur) return;
    cur = i;
    [...dots.children].forEach((b, k) => b.classList.toggle('on', k === i));
    if (location.hash !== '#' + (i + 1)) history.replaceState(null, '', '#' + (i + 1));
    view.classList.add('out');
    busy.hidden = cache.has(i);
    requestAnimationFrame(() => setTimeout(() => {
      const r = get(i);
      if (cur !== i) return;
      view.getContext('2d').drawImage(r.canvas, 0, 0);
      view.classList.remove('out');
      busy.hidden = true;
      // warm the neighbour
      setTimeout(() => { if (!cache.has((i + 1) % slides.length)) get((i + 1) % slides.length); }, 200);
    }, 30));
  }

  slides.forEach((s, k) => {
    const b = document.createElement('button');
    b.setAttribute('aria-label', 'Slide ' + (k + 1) + ': ' + s.title);
    b.addEventListener('click', () => show(k));
    dots.appendChild(b);
  });
  document.getElementById('prev').addEventListener('click', () => show(cur - 1));
  document.getElementById('next').addEventListener('click', () => show(cur + 1));
  addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight' || e.key === ' ') { show(cur + 1); e.preventDefault(); }
    if (e.key === 'ArrowLeft') { show(cur - 1); e.preventDefault(); }
  });
  let sx = null, sy = null;
  const room = document.getElementById('room');
  room.addEventListener('pointerdown', (e) => { sx = e.clientX; sy = e.clientY; });
  room.addEventListener('pointerup', (e) => {
    if (sx === null) return;
    const dx = e.clientX - sx, dy = e.clientY - sy;
    sx = null;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) show(cur + (dx < 0 ? 1 : -1));
  });

  window.__branchlight = {
    count: slides.length,
    ids: slides.map((s) => s.id),
    titles: slides.map((s) => s.title),
    render(i) { const r = render(i); cache.set(i, r); return r; },
    // All slides side by side at ×2 (720×1280 each) on a dark ground.
    sheet() {
      const s = 2, w = BL.W * s, h = BL.H * s, gap = 36;
      const c = document.createElement('canvas');
      c.width = slides.length * w + (slides.length + 1) * gap; c.height = h + gap * 2;
      const g = c.getContext('2d');
      g.fillStyle = '#14100f'; g.fillRect(0, 0, c.width, c.height);
      g.imageSmoothingEnabled = false;
      slides.forEach((sl, k) => g.drawImage(BL.toCanvas(get(k).idx, s), gap + k * (w + gap), gap));
      return c.toDataURL('image/png');
    },
    png(i) { const r = this.render(i); return { data: r.canvas.toDataURL('image/png'), ms: r.ms, colours: r.colours, id: r.id }; }
  };

  if (!new URLSearchParams(location.search).has('norender')) {
    const h = parseInt(location.hash.slice(1), 10);
    show(!isNaN(h) && h >= 1 && h <= slides.length ? h - 1 : 0);
  }
})();
