// main.js - render pipeline (painter's order) and composite.
(async function () {
  'use strict';
  const LW = window.LW;
  window.__drawing = { ready: false, ms: 0 };
  const t0 = performance.now();
  const cv = document.getElementById('art');
  cv.width = Math.round(LW.W * LW.S);
  cv.height = Math.round(LW.H * LW.S);
  const status = document.getElementById('status');
  const fit = () => {
    if (LW.params.get('noscale')) { document.body.classList.add('noscale'); return; }
    const k = Math.min(window.innerWidth / cv.width, window.innerHeight / cv.height);
    cv.style.width = Math.floor(cv.width * k) + 'px';
    cv.style.height = Math.floor(cv.height * k) + 'px';
  };
  fit();
  window.addEventListener('resize', fit);

  LW.initLayers();
  const only = (LW.params.get('only') || '').split(',').filter(Boolean);
  const steps = [
    ['sky', LW.drawSky],
    ['clouds', LW.drawClouds],
    ['sea', LW.drawSea],
    ['cliff', LW.drawCliff],
    ['chapel', LW.drawChapel],
    ['zigzag', LW.drawZigzag],
    ['tree', LW.drawTree],
    ['near', LW.drawNear],
    ['shade', LW.drawShade],
    ['roots', LW.drawRoots],
    ['details', LW.drawDetails],
  ];
  for (const [name, fn] of steps) {
    if (!fn) continue;
    if (only.length && !only.includes(name)) continue;
    const t = performance.now();
    status.textContent = 'drawing ' + name + '...';
    await LW.tick();
    try {
      await fn();
    } catch (e) {
      console.error('step ' + name + ' failed: ' + e.message + '\n' + e.stack);
    }
    LW.log(`${name}: ${((performance.now() - t) / 1000).toFixed(2)}s`);
  }
  const tc = performance.now();
  LW.composite(cv);
  LW.log(`composite: ${((performance.now() - tc) / 1000).toFixed(2)}s`);
  const ms = performance.now() - t0;
  status.textContent = `${(ms / 1000).toFixed(1)}s`;
  if (LW.params.get('noscale')) status.style.display = 'none';
  window.__drawing = { ready: true, ms };
})();
