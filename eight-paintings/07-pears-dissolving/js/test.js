// stroke laboratory: view=test
(function (G) {
  const P = G.Paint;
  G.StrokeTest = function (W, H, q) {
    const cv = new P.PaintCanvas(W, H, 11, { scale: 1, weavePeriod: 5.0 });
    cv.fill(0.30, 0.185, 0.115); cv.snapshotGround();
    const r = P.mulberry32(3);
    const line = (x0, y0, x1, y1, n) => { const a = []; for (let i = 0; i <= n; i++) { const t = i / n; a.push(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t + Math.sin(t * 3) * 6); } return a; };
    const base = JSON.parse(q.get('b') || '{}');
    // dark underlayer field
    cv.stroke(Object.assign({ pts: line(40, 120, 1100, 130, 40), w: 160, col: [0.12, 0.09, 0.07], alpha: 1, load: 1.3, run: 2000, dry: 0.2, thick: 0.6, bristle: 0.55, bfreq: 30, seed: 1 }, base));
    // flat brush field
    cv.stroke(Object.assign({ pts: line(60, 330, 1100, 320, 40), w: 130, col: [0.78, 0.60, 0.20], col2: [0.85, 0.72, 0.4], cjit: 0.45, alpha: 0.96, load: 1.25, run: 1200, dry: 0.3, thick: 0.8, ridge: 0.35, bristle: 0.6, bfreq: 29, smear: 0.22, pick: 0.15, rag: 0.22, taper0: 0.05, taper1: 0.12, sfreq: 2, streak: 300, seed: 5 }, base));
    // gesture
    cv.stroke(Object.assign({ pts: line(80, 520, 1000, 480, 40), w: 70, col: [0.86, 0.84, 0.77], col2: [0.9, 0.86, 0.74], alpha: 0.98, load: 1.35, run: 800, dry: 0.2, thick: 1.3, bristle: 0.55, bfreq: 16, ridge: 0.3, smear: 0.22, pick: 0.12, cjit: 0.6, taper0: 0.12, taper1: 0.3, sfreq: 2.2, streak: 220, seed: 9 }, base));
    // knife
    cv.stroke(Object.assign({ pts: line(100, 680, 600, 690, 20), w: 90, col: [0.62, 0.20, 0.08], col2: [0.8, 0.6, 0.2], cjit: 0.3, knife: true, square: true, alpha: 0.98, load: 1.2, run: 1100, dry: 0.04, thick: 1.6, ridge: 0.5, bristle: 0, smear: 0.25, pick: 0.1, rag: 0.05, taper0: 0, taper1: 0, streak: 250, sfreq: 1, seed: 13 }, base));
    // small modelling dabs
    for (let i = 0; i < 60; i++) { const x = 700 + r() * 400, y = 640 + r() * 120, a = r() * 3; cv.stroke(Object.assign({ pts: [x, y, x + Math.cos(a) * 30, y + Math.sin(a) * 30, x + Math.cos(a) * 60, y + Math.sin(a) * 60], w: 18, col: [0.5 + r() * 0.3, 0.45 + r() * 0.2, 0.15], alpha: 0.9, dry: 0.25, thick: 0.3, bristle: 0.45, load: 1.0, run: 120, smear: 0.3, pick: 0.35, cjit: 0.4, seed: i + 100 }, base)); }
    const out = cv.finish({ relief: parseFloat(q.get('relief') || '1.5'), weaveAmp: 0.14, spec: 0.05 });
    return out;
  };
})(window);
