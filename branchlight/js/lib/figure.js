/* Branchlight — the walker. One silhouette, hand-placed pixel by pixel at a few sizes
 * so it stays crisp: a bare head, a long coat, a slight stride. '#' = body,
 * '+' = rim of light (drawn only when a rim colour is given). Feet sit on the bottom row.
 */
(function () {
  'use strict';
  const BL = window.BL;

  const SPRITES = {
    // 12 px: walking away, slight stride
    walk: [
      '.##.',
      '.##.',
      '####',
      '####',
      '####',
      '####',
      '####',
      '.##.',
      '.##.',
      '.#.#',
      '.#.#',
      '#..#'
    ],
    // 12 px: standing still
    stand: [
      '.##.',
      '.##.',
      '####',
      '####',
      '####',
      '####',
      '####',
      '.##.',
      '.##.',
      '.#.#',
      '.#.#',
      '.#.#'
    ],
    // 12 px: standing, head tipped back to look up (the head sits a pixel back)
    up: [
      '..##.',
      '.###.',
      '.####',
      '.####',
      '.####',
      '.####',
      '.####',
      '..##.',
      '..##.',
      '..#.#',
      '..#.#',
      '..#.#'
    ],
    // 20 px: the same walker, closer, mid-stride into the light
    stride: [
      '....#....',
      '...###...',
      '...###...',
      '...###...',
      '....#....',
      '..#####..',
      '.#######.',
      '.#######.',
      '.#######.',
      '.#######.',
      '.#.###.#.',
      '.#.###.#.',
      '...###...',
      '...###...',
      '...#.#...',
      '...#.#...',
      '...#.#...',
      '...#..#..',
      '..#...#..',
      '..#...#..'
    ]
  };
  BL.FIGURE = SPRITES;

  // Draw sprite with its feet centred at (x, y).
  BL.figure = function (S, name, x, y, col, rim) {
    const sp = SPRITES[name];
    const h = sp.length, w = sp[0].length;
    const ox = Math.round(x - w / 2), oy = Math.round(y - h + 1);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const ch = sp[j][i];
      if (ch === '#') S.px(ox + i, oy + j, col);
      else if (ch === '+' && rim) S.px(ox + i, oy + j, rim);
    }
    return { x: ox, y: oy, w, h };
  };

  // A long, thin dithered cast shadow from the feet, pointing along angle a.
  BL.castShadow = function (S, x, y, a, len, col, width) {
    for (let s = 1; s < len; s++) {
      const px = x + Math.cos(a) * s, py = y + Math.sin(a) * s;
      const w = (width || 2) * (1 - s / len * 0.4);
      for (let k = -w / 2; k <= w / 2; k += 1) {
        const qx = Math.round(px - Math.sin(a) * k), qy = Math.round(py + Math.cos(a) * k);
        if (BL.bayer(qx, qy) < 0.8 - 0.5 * s / len) S.px(qx, qy, col);
      }
    }
  };
})();
