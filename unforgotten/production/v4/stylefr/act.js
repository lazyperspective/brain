  function draw(t) {
    vgrad(0, H, R.dusk, 1.2, 3.0);
    LIGHT.x = -0.7; LIGHT.y = -0.6; ENV.edge = C('fire', 5);
    const M = [
      { face: { eyes: 'wide', look: -2, mouth: 0.5 }, turn: -1, hands: [{ from: [-14, 4], at: [-20, -22], pose: 'point', dir: [-0.5, -0.86] }] },
      { face: { eyes: 'happy', smile: 1, blush: 1 }, turn: 0.4, tilt: 0.12, hands: [{ from: [-12, 4], at: [-4, -18], pose: 'fist' }, { from: [14, 4], at: [8, -18], pose: 'fist' }] },
      { face: { eyes: 'open', lookY: -1, look: 1, mouth: 0.6, ee: 1 }, tilt: -0.1, sy: 0.92, sx: 1.05 },
    ];
    M.forEach((P, k) => bust('mira', Object.assign({ t }, P), 80 + k * 160, 130, 2, 1));
    const S_ = [{ face: { eyes: 'happy', smile: 1 }, tilt: -0.1 }, { face: { eyes: 'half', smile: 0.6, browUp: 1 }, tilt: 0.1, turn: -0.8 }, { face: { eyes: 'wide', brows: 'worried', lookY: -1 }, tilt: -0.16, turn: 0.6 }];
    S_.forEach((P, k) => bust('sable', Object.assign({ t }, P), 80 + k * 160, 268, 2, -1));
    ENV.edge = null;
  }
