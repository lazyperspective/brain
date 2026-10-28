  // style frame: the cast lineup on a warm studio gradient
  function draw(t) {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) BUF[y * W + x] = soft(R.dusk, 1.2 + (1 - y / H) * 1.8 + (1 - Math.abs(x - 320) / 400) * 0.6, x, y);
    for (let y = 300; y < H; y++) for (let x = 0; x < W; x++) BUF[y * W + x] = soft(R.warm, 2.2 - (y - 300) / 60, x, y);
    LIGHT.x = -0.6; LIGHT.y = -0.8; LIGHT.rim = null;
    figure(CAST.sable, { x: 210, y: 320, s: 250, f: 1, t, arms: [{ a: 0.35, b: 0.6 }, { a: -0.1, b: 0.3 }], legs: [{ x: 0.06 }, { x: -0.05 }], face: { smile: 0.4, brows: 0 }, sword: 0.5 });
    figure(CAST.mira, { x: 400, y: 320, s: 140, f: -1, t, arms: [{ a: 0.9, b: 0.4 }, { a: 0.1 }], legs: [{ x: 0.06 }, { x: -0.06 }], face: { smile: 0.8, mouth: 0.6 }, lantern: true });
    // close-ups of both faces
    figure(CAST.sable, { x: 560, y: 560, s: 640, f: -1, t, face: { eyes: 'open', brows: 'worried', smile: 0 } });
  }
