'use strict';
(() => {
  const cv = document.getElementById('c');
  const ctx = cv.getContext('2d');
  E.S.ctx = ctx;
  const W = cv.width, H = cv.height, FRAMES = 75;

  // static paper grain (made once, does not boil)
  const paper = document.createElement('canvas');
  paper.width = W; paper.height = H;
  (() => {
    const p = paper.getContext('2d');
    const img = p.createImageData(W, H);
    let s = 12345;
    const r = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
    for (let i = 0; i < W * H; i++) {
      const v = 200 + r() * 55;
      img.data[i * 4] = v; img.data[i * 4 + 1] = v * 0.985; img.data[i * 4 + 2] = v * 0.95; img.data[i * 4 + 3] = 255;
    }
    p.putImageData(img, 0, 0);
    // soft blotches
    p.globalAlpha = 0.05;
    for (let i = 0; i < 260; i++) {
      p.fillStyle = r() < 0.5 ? '#8a7a60' : '#ffffff';
      p.beginPath(); p.ellipse(r() * W, r() * H, 20 + r() * 120, 10 + r() * 60, r() * 3, 0, 7); p.fill();
    }
  })();

  window.renderFrame = (f) => {
    const d = Math.floor(f / 2);           // on twos
    const t = (2 * d) / FRAMES;            // loop phase 0..1
    E.S.draw = d;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    Sky.draw(t);
    Kid.draw(t);
    Sky.drawFront(t);
    // paper
    ctx.globalCompositeOperation = 'multiply';
    ctx.globalAlpha = 0.16;
    ctx.drawImage(paper, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
  };
})();
