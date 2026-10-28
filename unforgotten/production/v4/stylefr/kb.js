  function draw(t) {
    vgrad(0, H, R.rose, 3.0, 5.0);
    LIGHT.x = -0.7; LIGHT.y = -0.6; ENV.edge = C('gold', 6);
    const fs = [{}, { eyes: 'wide', brows: 'worried', mouth: 0.5 }, { eyes: 'half', smile: 1, brows: 'up' }, { eyes: 'narrow', brows: 'angry' }];
    fs.forEach((F, k) => bust('kaira', { t, face: F, wind: k }, 60 + k * 120, 135, 2, 1));
    ENV.edge = null;
    bust('kaira', { t, face: { eyes: 'open', mouth: 0.3 }, wind: 2 }, 240, 270, 3, -1);
  }
