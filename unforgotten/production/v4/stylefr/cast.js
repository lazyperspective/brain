  // style frame: the four leads, on a dusk gradient with a floor, in a few attitudes, and their faces up close
  function draw(t) {
    vgrad(0, 200, R.dusk, 1.4, 3.4); vgrad(200, H, R.warm, 2.2, 1.0);
    for (let x = 0; x < W; x++) BUF[200 * W + x] = C('warm', 3);
    LIGHT.x = -0.7; LIGHT.y = -0.7; ENV.edge = null;
    const row = [
      [KAIRA, { t, face: { eyes: 'narrow', smile: 0.5, brows: 'up' }, arms: [{ a: 1.6, b: 0.4 }, { a: -0.3 }], legs: [{ foot: [6, 0] }, { foot: [-5, 0] }], wind: 2, prop: (A) => swordArt(A.hand[0], A.hand[1], 1.2, 14, false) }, 70],
      [TAMO, { t, face: { eyes: 'open', smile: 1 }, arms: [{ a: 2.5, b: 0.5 }, { a: 0.2 }], legs: [{ foot: [5, 0] }, { foot: [-5, 0] }] }, 180],
      [SABLE, { t, face: { eyes: 'open', smile: 0.3 }, arms: [{ a: 0.5, b: 0.6 }, { a: 0.1 }], legs: [{ foot: [5, 0] }, { foot: [-4, 0] }], prop: (A) => swordArt(A.hand[0], A.hand[1], 0.35, 28, false) }, 290],
      [MIRA, { t, face: { eyes: 'happy', smile: 1, blush: 1 }, arms: [{ a: 0.4 }, { a: 0.3 }], legs: [{ foot: [3, 0] }, { foot: [-3, 0] }], propFar: (A) => lanternArt(A.hand[0], A.hand[1] + 1, t, true) }, 390],
    ];
    for (const [CH, P, x] of row) actor(CH, P, x, 200, 2, 1);
    // faces at 3×: the expressions each one can make
    const faces = [[KAIRA, { eyes: 'wide', brows: 'worried', mouth: 0.6 }], [TAMO, { eyes: 'narrow', brows: 'angry', mouth: 0.9 }], [SABLE, { eyes: 'sad', brows: 'worried' }], [MIRA, { eyes: 'wide', mouth: 0.5 }]];
    faces.forEach(([CH, F], k) => { sclear(); art(CH.head, 0, -2, false); face(CH, 0, -2, false, F, CH.key); soutline(); stamp(60 + k * 110, 262, 3, false); });
    letterbox(0);
  }
