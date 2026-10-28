  // the art sheet: Sable's head with several faces, and her coat, at 1× and 4×
  function draw(t) {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) BUF[y * W + x] = soft(R.dusk, 1.2 + (1 - y / H) * 1.8, x, y);
    const faces = [{}, { eyes: 'wide', brows: 'worried', mouth: 0.5 }, { eyes: 'happy', smile: 1, blush: 1 }, { eyes: 'narrow', brows: 'angry', mouth: 0.9 }];
    faces.forEach((F, k) => {
      sclear(); art(SABLE.head, 0, -10, false); face(SABLE, 0, -10, false, F, SABLE_KEY); soutline();
      stamp(30 + k * 110, 120, 4, k === 3);
      stamp(30 + k * 30, 250, 1, false);
    });
    sclear(); art(SABLE.torso, 0, -30, false); soutline(); stamp(380, 250, 3, false);
  }
