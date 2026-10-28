  function draw(t) {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) BUF[y * W + x] = soft(R.dusk, 1.2 + (1 - y / H) * 1.8, x, y);
    for (let y = 200; y < H; y++) for (let x = 0; x < W; x++) BUF[y * W + x] = soft(R.warm, 1.6, x, y);
    actor(SABLE, { t, face: { eyes: 'open', smile: 0.5 }, arms: [{ a: 0.4, b: 0.5 }, { a: -0.1 }], legs: [{ foot: [5, 0] }, { foot: [-5, 0] }] }, 80, 200, 1, 1);
    actor(MIRA, { t, face: { eyes: 'open', mouth: 0.6 }, arms: [{ a: 1.4, b: 0.3 }, { a: 0.2 }], legs: [{ foot: [3, 0] }, { foot: [-3, 0] }] }, 140, 200, 1, -1);
    actor(SABLE, { t, face: { eyes: 'narrow', brows: 'angry' }, arms: [{ a: 1.2, b: 0.6 }, { a: -0.3 }], legs: [{ foot: [9, 0] }, { foot: [-8, 0] }], hip: -27, lean: 1 }, 250, 250, 2, 1);
    actor(MIRA, { t, face: { eyes: 'happy', smile: 1, blush: 1 }, arms: [{ a: 2.6, b: 0.2 }, { a: -0.4 }], legs: [{ foot: [3, 0] }, { foot: [-3, 0] }] }, 390, 250, 3, -1);
  }
