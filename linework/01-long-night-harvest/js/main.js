/* Long Night Harvest — orchestration. */
(function () {
  'use strict';
  const LW = window.LW;
  const params = new URLSearchParams(location.search);
  const size = parseInt(params.get('size') || '2160', 10);
  const S = size / 2160;
  const only = params.get('only'); // debug: comma list of stage names to skip after
  const canvas = document.getElementById('c');
  canvas.width = Math.round(2160 * S);
  canvas.height = Math.round(3840 * S);
  const ctx = canvas.getContext('2d');
  LW.S = S;
  window.__drawing = { ready: false, ms: 0, log: [] };
  LW.log = function (m) { window.__drawing.log.push(m); console.log(m); };
  const status = document.getElementById('status');

  function fit() {
    const k = Math.min(window.innerWidth / canvas.width, window.innerHeight / canvas.height);
    canvas.style.width = canvas.width * k + 'px';
    canvas.style.height = canvas.height * k + 'px';
  }
  window.addEventListener('resize', fit);
  fit();

  const stages = [
    ['sky ground', (c) => LW.drawSkyBackground(c, S), true],
    ['stars', (c) => LW.drawStars(c)],
    ['vortex', (c) => LW.drawVortex(c)],
    ['top stars', (c) => LW.drawTopStars(c)],
    ['meteor', (c) => LW.drawMeteor(c)],
    ['rings back', (c) => LW.drawRings(c, 'back')],
    ['planet', (c) => LW.drawPlanet(c)],
    ['rings front', (c) => LW.drawRings(c, 'front')],
    ['land', (c) => LW.drawLand && LW.drawLand(c)],
    ['field', (c) => LW.drawField && LW.drawField(c)],
    ['edge shade', (c) => LW.drawEdgeShade(c)],
    ['foreground', (c) => LW.drawForeground && LW.drawForeground(c)],
    ['print', (c) => LW.printPass && LW.printPass(c, S), true],
  ];
  const tick = () => new Promise((r) => setTimeout(r, 0));

  (async function run() {
    const t0 = performance.now();
    for (const [name, fn, raw] of stages) {
      if (only && only.split(',').indexOf(name) < 0 && name !== 'sky ground') continue;
      status.textContent = 'drawing: ' + name + '…';
      await tick();
      const ts = performance.now();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      if (!raw) ctx.setTransform(S, 0, 0, S, 0, 0);
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      try { fn(ctx); } catch (e) { LW.log('ERROR in ' + name + ': ' + e.stack); throw e; }
      LW.log(name + ': ' + (performance.now() - ts).toFixed(0) + 'ms');
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const ms = performance.now() - t0;
    status.textContent = '';
    status.style.display = 'none';
    window.__drawing.ms = ms;
    window.__drawing.ready = true;
    LW.log('total ' + (ms / 1000).toFixed(1) + 's');
  })();
})();
