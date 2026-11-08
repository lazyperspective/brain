// Marsh Nocturne: boot and export hook.
//   index.html                 paints the piece (2160 x 2700) and shows it
//   index.html?scale=0.5       paints at half size (quick look)
//   index.html?view=plan       shows the tonal study the painter works from
//   index.html?export          exposes window.__piece = { isReady(), stats, pixelsB64() }
(function (G) {
  'use strict';
  const q = new URLSearchParams(location.search);
  const canvas = document.getElementById('art');
  const msg = document.getElementById('msg');
  const scale = parseFloat(q.get('scale') || '1');
  const view = q.get('view') || '';
  const layers = q.has('layers') ? parseInt(q.get('layers'), 10) : null;
  let ready = false, P = null, error = null;
  G.__piece = {
    isReady: () => ready, error: () => error,
    stats: () => P && P.stats,
    size: () => P && [P.W, P.H],
    pixelsB64() {
      const px = P.pixels();
      let s = '';
      const CH = 0x8000;
      for (let i = 0; i < px.length; i += CH) s += String.fromCharCode.apply(null, px.subarray(i, i + CH));
      return btoa(s);
    },
  };
  setTimeout(() => {
    try {
      P = new G.PaintEngine.Painter(canvas, G.SCENE, { scale, layers });
      P.run(view);
      ready = true;
      if (msg) msg.remove();
    } catch (e) { error = String(e && e.stack || e); if (msg) msg.textContent = 'error: ' + e.message; console.error(e); }
  }, 30);
})(window);
