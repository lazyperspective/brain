// Orchestration: study -> painting -> surface lighting -> canvas. Exposes exportMaster().
(function () {
  'use strict';
  const qs = new URLSearchParams(location.search);
  const scale = parseFloat(qs.get('scale') || '1');
  const stage = qs.get('stage') || 'final';
  const W = Math.round(2160 * scale), H = Math.round(2700 * scale);
  const status = document.getElementById('status');
  const canvas = document.getElementById('c');
  canvas.width = W; canvas.height = H;

  function toCanvas(rgb, w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    const id = ctx.createImageData(w, h);
    for (let k = 0, n = w * h; k < n; k++) {
      id.data[k * 4] = Math.max(0, Math.min(255, Math.round(rgb[k * 3] * 255)));
      id.data[k * 4 + 1] = Math.max(0, Math.min(255, Math.round(rgb[k * 3 + 1] * 255)));
      id.data[k * 4 + 2] = Math.max(0, Math.min(255, Math.round(rgb[k * 3 + 2] * 255)));
      id.data[k * 4 + 3] = 255;
    }
    ctx.putImageData(id, 0, 0);
    return c;
  }

  function run() {
    const t0 = performance.now();
    const studyScale = parseFloat(qs.get('study') || '1');
    const RW = Math.round(W * studyScale), RH = Math.round(H * studyScale);
    const study = window.SCENE.render(RW, RH, { gridQ: parseFloat(qs.get('gridq') || '1') });
    window.__study = study;
    let out;
    if (stage === 'study') {
      out = toCanvas(study.col, RW, RH);
    } else {
      const painted = window.PAINT.paint(study, W, H, scale, stage);
      if (stage !== 'nomotifs') window.MOTIFS.paintMotifs(painted);
      const rgb = window.FINISH.finish(painted, W, H, scale, stage);
      out = toCanvas(rgb, W, H);
    }
    canvas.width = out.width; canvas.height = out.height;
    canvas.getContext('2d').drawImage(out, 0, 0);
    status.textContent = 'done in ' + Math.round((performance.now() - t0) / 1000) + ' s';
    console.log('total', Math.round(performance.now() - t0), 'ms');
    window.__done = true;
  }
  window.exportMaster = () => ({ master: canvas.toDataURL('image/png') });
  setTimeout(run, 30);
})();
