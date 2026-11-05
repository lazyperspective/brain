/* main.js: orchestrates the painter's-order layers. */
(function () {
  'use strict';
  const LW = window.LW;
  window.__drawing = { ready: false, ms: 0 };
  window.__drawLog = [];

  const q = new URLSearchParams(location.search);
  const size = parseInt(q.get('size') || '2160', 10);
  const S = size / LW.W;
  const skip = new Set((q.get('skip') || '').split(',').filter(Boolean));
  const only = q.get('only') ? new Set(q.get('only').split(',')) : null;
  const want = (k) => !skip.has(k) && (!only || only.has(k));

  const canvas = document.getElementById('c');
  canvas.width = Math.round(LW.W * S);
  canvas.height = Math.round(LW.H * S);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(S, 0, 0, S, 0, 0);
  const status = document.getElementById('status');

  const REFV = { F: 0.42, L2: 0.5, R2: 0.5, L1: 0.6, R1: 0.62, R0: 0.88, L0: 0.85 };
  const cliffStage = (names) => () => {
    for (const n of names) {
      const l = LW.cliff(n);
      LW.drawCliffLayer(ctx, S, l);
      const [a, b] = l.base ? LW.baseLine(l.base) : LW.baseLine([[650, 2262], [960, 2905]]);
      LW.reflFill('dark', l.path, a, b, REFV[n]);
    }
  };
  const stages = [
    ['sky', () => LW.drawSky(ctx, S)],
    ['skyrules', () => LW.drawSkyRules(ctx, S)],
    ['stars', () => LW.drawStars(ctx, S)],
    ['moon', () => LW.drawMoon(ctx, S)],
    ['reflinit', () => LW.reflInit()],
    ['far', cliffStage(['F', 'L2', 'R2'])],
    ['mid', cliffStage(['L1', 'R1'])],
    ['gorgedetail', () => { LW.drawGorgeDetails(ctx, S); LW.drawBats(ctx, S); }],
    ['bridge', () => {
      LW.drawBridge(ctx, S);
      const G = LW.bridgeGeom;
      LW.reflFill('dark', G.facePath, LW.L.waterY, 0, 0.8);
      LW.reflFill('dark', G.soffitPath, LW.L.waterY, 0, 0.7);
      LW.reflFn('warm', LW.L.waterY, 0, (t) => {
        const [lx, ly] = LW.L.lantern;
        const g = t.createRadialGradient(lx, 2 * LW.L.waterY - ly, 40, lx, 2 * LW.L.waterY - ly, 700);
        g.addColorStop(0, 'rgb(150,150,150)');
        g.addColorStop(0.5, 'rgb(70,70,70)');
        g.addColorStop(1, 'rgb(0,0,0)');
        t.fillStyle = g;
        t.fill(G.soffitPath);
      });
    }],
    ['near', () => { cliffStage(['R0', 'L0'])(); LW.drawRidgeBushes(ctx, S); }],
    ['water', () => {
      // lantern light lying on the water and its long broken reflection
      const t = LW.refl.warm.x;
      const [lx] = LW.L.lantern;
      t.save();
      t.setTransform(0.5, 0, 0, 0.5, 0, 0);
      let g = t.createRadialGradient(lx, 2960, 10, lx, 2960, 230);
      g.addColorStop(0, 'rgba(110,110,110,1)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      t.globalCompositeOperation = 'lighter';
      t.fillStyle = g; t.fillRect(lx - 260, 2700, 520, 520);
      t.translate(lx + 6, 3130); t.scale(1, 6.5);
      g = t.createRadialGradient(0, 0, 2, 0, 0, 52);
      g.addColorStop(0, 'rgba(120,120,120,1)'); g.addColorStop(0.5, 'rgba(60,60,60,1)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      t.fillStyle = g; t.fillRect(-60, -60, 120, 120);
      t.restore();
      LW.drawWater(ctx, S);
    }],
    ['bank', () => LW.drawBank && LW.drawBank(ctx, S)],
    ['hut', () => LW.drawHut && LW.drawHut(ctx, S)],
    ['smoke', () => LW.drawSmoke && LW.drawSmoke(ctx, S)],
    ['tree', () => LW.drawTree && LW.drawTree(ctx, S)],
    ['boat', () => LW.drawBoat && LW.drawBoat(ctx, S)],
    ['lantern', () => LW.drawLantern && LW.drawLantern(ctx, S)],
    ['foreground', () => LW.drawForeground && LW.drawForeground(ctx, S)],
    ['glow', () => LW.drawGlow && LW.drawGlow(ctx, S)],
    ['print', () => LW.drawPrint && LW.drawPrint(ctx, S)],
  ];

  async function run() {
    const t0 = performance.now();
    ctx.fillStyle = LW.rgb(LW.P.sky1);
    ctx.fillRect(0, 0, LW.W, LW.H);
    for (const [name, fn] of stages) {
      if (!want(name)) continue;
      const t = performance.now();
      status.textContent = 'rendering ' + name + '…';
      await LW.sleep(0);
      try {
        ctx.setTransform(S, 0, 0, S, 0, 0);
        fn();
      } catch (e) {
        LW.log('ERROR in', name, e && e.stack ? e.stack : e);
        window.__drawing.error = String(e && e.stack ? e.stack : e);
      }
      LW.log('stage', name, Math.round(performance.now() - t), 'ms');
    }
    const ms = Math.round(performance.now() - t0);
    status.textContent = '';
    status.style.display = 'none';
    window.__drawing.ms = ms;
    window.__drawing.ready = true;
    LW.log('done', ms, 'ms');
  }
  run();
})();
