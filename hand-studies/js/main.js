/* main.js — lays out the sketchbook sheet and inks each study in turn. */
(function () {
  'use strict';
  const HS = window.HS;
  const W = 2700, H = 3600;
  const PAPER = '#efe6d3', INK = '#17130f';

  /* each study: pose, seed, and the patch of paper it is fitted into */
  const LAYOUT = [
    { pose: 'openPalm',    seed: 11, rect: { x: 60,   y: 60,   w: 820, h: 1290 } },
    { pose: 'backRelaxed', seed: 23, rect: { x: 900,  y: 70,   w: 960, h: 1220 } },
    { pose: 'pointing',    seed: 35, rect: { x: 1890, y: 80,   w: 750, h: 1080 } },
    { pose: 'curled',      seed: 47, rect: { x: 60,   y: 1400, w: 900, h: 1080 } },
    { pose: 'reaching',    seed: 59, rect: { x: 990,  y: 1340, w: 720, h: 1170 } },
    { pose: 'fist',        seed: 71, rect: { x: 1740, y: 1230, w: 900, h: 1270 } },
    { pose: 'side',        seed: 83, rect: { x: 60,   y: 2540, w: 560, h: 1000 } },
    { pose: 'claw',        seed: 95, rect: { x: 640,  y: 2560, w: 820, h: 980 } },
    { pose: 'pinch',       seed: 107, rect: { x: 1490, y: 2590, w: 700, h: 950 } },
    { pose: 'resting',     seed: 119, rect: { x: 2200, y: 2540, w: 450, h: 1000 } },
  ];

  const canvas = document.getElementById('paper');
  const status = document.getElementById('status');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = PAPER; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = INK;

  const sheet = document.getElementById('sheet');
  sheet.addEventListener('click', () => {
    const full = sheet.classList.toggle('full');
    document.getElementById('desk').classList.toggle('scroll', full);
  });

  const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));
  const only = new URLSearchParams(location.search).get('only');

  async function run() {
    const t0 = performance.now();
    const list = only ? LAYOUT.filter((l) => only.split(',').includes(l.pose)) : LAYOUT;
    for (let n = 0; n < list.length; n++) {
      const L = list[n];
      status.textContent = 'study ' + (n + 1) + ' / ' + list.length + ' — ' + L.pose;
      await nextFrame();
      const pose = HS.POSES[L.pose];
      const sk = HS.buildSkeleton(pose);
      const sc = HS.buildForms(sk, pose, L.rect);
      await nextFrame();
      const gen = HS.drawStudy(sc, sk, pose, ctx, L.seed * 13 + 5);
      for (;;) {
        const t = performance.now();
        const r = gen.next();
        if (r.done) break;
        await nextFrame();
      }
    }
    status.textContent = 'done · ' + ((performance.now() - t0) / 1000).toFixed(1) + ' s';
    window.__done = true;
  }
  run();
})();
