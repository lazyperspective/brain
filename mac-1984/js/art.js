// The MacPaint drawings, as stroke-by-stroke scripts for the PAINT builder (document coordinates, 416x240;
// the chat window covers the bottom-right of the document, so art lives in the top ~200 rows).
(function (G) {
  const { Bm } = K;
  // layout
  const F = { x0: 58, y0: 24, x1: 150, y1: 190 };   // front view of the first device
  const SX = 198;                                    // side view left edge
  const SY0 = F.y0, SY1 = F.y1;
  const SLAB = { x0: 63, y0: 24, x1: 145, y1: 188 };
  const SCR = { x0: 69, y0: 38, x1: 139, y1: 174 };

  function dim(D, x0, x1, label, y = 12) { // dimension: extension ticks, arrows pointing in from outside, label
    D.line(x0, y - 4, x0, y + 3, { dur: 0.05 }).line(x1, y - 4, x1, y + 3, { dur: 0.05 });
    D.line(x0 - 12, y, x0 - 1, y, { dur: 0.05 }).pencil([[x0 - 4, y - 2], [x0 - 2, y], [x0 - 4, y + 2]], { dur: 0.04 });
    D.line(x1 + 1, y, x1 + 12, y, { dur: 0.05 }).pencil([[x1 + 4, y - 2], [x1 + 2, y], [x1 + 4, y + 2]], { dur: 0.04 });
    D.text(x1 + 16, y - 3, label, 'g9');
  }
  function sideView(D, th, o = {}) {
    const r = Math.max(0, Math.min(6, Math.floor(th / 2)));
    if (th <= 1) D.line(SX, SY0, SX, SY1, { dur: 0.2 });
    else D.shape('rrect', SX, SY0, SX + th, SY1, { fill: th > 6 ? 'ltgray' : null, r, dur: o.fast ? 0.18 : 0.32 });
    if (th > 8) D.shape('rect', SX + th - 4, SY0 + 8, SX + th - 2, SY1 - 8, { fill: 'gray', line: false, dur: 0.12 });
    // side buttons
    D.shape('rect', SX - 5, 54, SX - 1, 66, { fill: 'black', dur: 0.07 }).shape('rect', SX - 5, 72, SX - 1, 84, { fill: 'black', dur: 0.07 });
    if (o.ports) { D.shape('rect', SX + Math.floor(th / 2) - 3, SY1 - 1, SX + Math.floor(th / 2) + 3, SY1 + 4, { fill: 'black', dur: 0.06 }); }
    dim(D, SX, SX + th, o.label);
  }

  // 1. "the computer of the future": a chunky 1984 vision of a pocket computer
  function phoneV1(D) {

    D.shape('rrect', F.x0, F.y0, F.x1, F.y1, { fill: 'ltgray', r: 14, dur: 0.55 });
    D.shape('rrect', F.x0 + 4, F.y0 + 4, F.x1 - 4, F.y1 - 4, { r: 11, dur: 0.4 });
    D.shape('rect', F.x1 - 9, F.y0 + 14, F.x1 - 6, F.y1 - 14, { fill: 'gray', line: false, dur: 0.15 });
    // screen
    D.shape('rect', 70, 42, 138, 120, { fill: 'white', lw: 2, dur: 0.35 });
    D.shape('rect', 74, 46, 134, 116, { dur: 0.22 });
    // "touch" ripple on the glass
    D.shape('oval', 96, 72, 112, 88, { dur: 0.16 }).shape('oval', 90, 66, 118, 94, { dur: 0.18 }).shape('oval', 84, 60, 124, 100, { dur: 0.2 });
    D.stamp(FINGER, 100, 78, { dur: 0.28 });
    // speaker grille
    D.pencil([[92, 31], [116, 31]], { dur: 0.1 }).pencil([[92, 33], [116, 33]], { dur: 0.1 }).pencil([[92, 35], [116, 35]], { dur: 0.1 });
    // antenna
    D.line(141, F.y0, 141, 7, { lw: 2, dur: 0.16 }).shape('oval', 137, 1, 145, 9, { fill: 'black', dur: 0.1 });
    // d-pad
    D.pencil([[79, 130], [88, 130], [88, 139], [97, 139], [97, 148], [88, 148], [88, 157], [79, 157], [79, 148], [70, 148], [70, 139], [79, 139], [79, 130]], { dur: 0.5 });
    D.fill(83, 143, 'dkgray');
    // round buttons
    D.shape('oval', 109, 141, 121, 153, { fill: 'black', dur: 0.12 }).shape('oval', 124, 131, 136, 143, { fill: 'black', dur: 0.12 });
    // small keys
    D.shape('rrect', 74, 168, 90, 174, { fill: 'gray', r: 3, dur: 0.1 }).shape('rrect', 96, 168, 112, 174, { fill: 'gray', r: 3, dur: 0.1 }).shape('rrect', 118, 168, 134, 174, { fill: 'gray', r: 3, dur: 0.1 });
    // ports
    D.shape('rect', 52, 60, 58, 74, { fill: 'black', dur: 0.08 }).shape('rect', 52, 84, 58, 92, { fill: 'black', dur: 0.07 });
    D.shape('rect', 150, 128, 157, 152, { fill: 'black', dur: 0.08 });
    D.shape('rect', 90, 190, 118, 195, { fill: 'black', dur: 0.09 });
    // side view
    sideView(D, 26, { label: '1.1 in', ports: true });
  }
  function eraseSide(D, th, fast) {
    const xs = []; for (let x = SX - 1; x <= SX + th + 6; x += 12) xs.push(x);
    const pts = []; xs.forEach((x, i) => { if (i % 2 === 0) { pts.push([x, SY0 - 2], [x, SY1 + 6]); } else { pts.push([x, SY1 + 6], [x, SY0 - 2]); } });
    D.erase(pts, { dur: fast ? 0.32 : 0.55 });
    D.erase([[SX - 16, 11], [SX + th + 60, 11]], { dur: fast ? 0.14 : 0.22 });
  }
  function thinner1(D) { eraseSide(D, 26); sideView(D, 12, { label: '0.5 in', ports: true }); }
  function thinner2(D) { eraseSide(D, 12, true); sideView(D, 1, { label: '0.01 in', fast: true }); }

  // 2. "Remove all the ports. Remove the buttons. Remove everything unnecessary."
  function strip(D) {
    // ports
    D.erase([[51, 56], [51, 96]], { dur: 0.22 }).erase([[158, 124], [158, 156]], { dur: 0.18 }).erase([[86, 199], [122, 199]], { dur: 0.18 });
    D.erase([[SX + 2, 199], [SX + 6, 199]], { dur: 0.06 });
    // buttons (front and side)
    D.erase([[76, 132], [96, 132], [76, 146], [96, 146], [76, 158], [138, 158], [114, 146], [136, 146], [114, 132], [136, 132], [78, 171], [134, 171]], { dur: 0.75 });
    D.erase([[SX - 7, 50], [SX - 7, 90]], { dur: 0.14 });
    // antenna + grille
    D.erase([[141, 2], [141, 18]], { dur: 0.12 }).erase([[96, 33], [114, 33]], { dur: 0.1 });
    // everything else: select the front view and delete it
    D.marquee(46, 0, 166, 199, { dur: 0.3 }).del({ pause: 0.18 });
    // the slab
    D.shape('rrect', SLAB.x0, SLAB.y0, SLAB.x1, SLAB.y1, { r: 13, dur: 0.5 });
    D.shape('rrect', SLAB.x0 + 3, SLAB.y0 + 3, SLAB.x1 - 3, SLAB.y1 - 3, { r: 10, dur: 0.3 });
    D.shape('rect', SCR.x0, SCR.y0, SCR.x1, SCR.y1, { fill: 'black', dur: 0.32 });
    D.shape('rrect', 94, 30, 114, 33, { fill: 'black', r: 2, dur: 0.08 });
    // glass glint on the black screen
    D.pencil([[SCR.x0 + 4, SCR.y0 + 30], [SCR.x0 + 30, SCR.y0 + 4]], { white: true, dur: 0.12 }).pencil([[SCR.x0 + 4, SCR.y0 + 38], [SCR.x0 + 38, SCR.y0 + 4]], { white: true, dur: 0.12 });
  }
  // 3. operating system + app ecosystem + wireless network
  const GRID = ['phone', 'mail', 'cal', 'photo', 'camera', 'clock', 'pin', 'sun', 'music', 'notes', 'calc', 'stocks', 'chat', 'book', 'gear', 'smile'];
  function os(D) {
    // wipe the glint
    D.erase([[SCR.x0 + 8, SCR.y0 + 8], [SCR.x0 + 20, SCR.y0 + 20]], { dur: 0.05 });
    D.shape('rect', SCR.x0, SCR.y0, SCR.x0 + 44, SCR.y0 + 44, { fill: 'black', dur: 0.08 });
    // status bar: signal + battery (white on black)
    D.stamp(SIG_SMALL, SCR.x0 + 4, SCR.y0 + 3, { inv: true, dur: 0.08 });
    D.stamp(BATT, SCR.x1 - 13, SCR.y0 + 3, { inv: true, dur: 0.08 });
    const xs = [SCR.x0 + 5, SCR.x0 + 21, SCR.x0 + 37, SCR.x0 + 53];
    GRID.forEach((n, i) => { const c = i % 4, r = (i / 4) | 0; D.stamp(PAINT.appTile(n), xs[c], SCR.y0 + 13 + r * 18, { dur: 0.06 }); });
    // dock
    D.pencil([[SCR.x0 + 3, SCR.y1 - 20], [SCR.x1 - 3, SCR.y1 - 20]], { white: true, dur: 0.1 });
    ['phone', 'mail', 'music', 'chat'].forEach((n, i) => D.stamp(PAINT.appTile(n), xs[i], SCR.y1 - 16, { dur: 0.06 }));
    // network: globe, tower, waves, bars
    D.shape('oval', 286, 34, 336, 84, { fill: 'white', dur: 0.25 });
    D.shape('oval', 300, 34, 322, 84, { dur: 0.14 }).line(311, 34, 311, 84, { dur: 0.08 });
    D.pencil([[288, 50], [334, 50]], { dur: 0.08 }).pencil([[286, 59], [336, 59]], { dur: 0.08 }).pencil([[288, 68], [334, 68]], { dur: 0.08 });
    // tower
    D.line(368, 168, 380, 100, { dur: 0.12 }).line(392, 168, 380, 100, { dur: 0.12 }).line(372, 146, 388, 146, { dur: 0.05 }).line(370, 158, 390, 158, { dur: 0.05 }).line(375, 124, 386, 124, { dur: 0.05 });
    D.line(372, 146, 386, 124, { dur: 0.05 }).line(388, 146, 375, 124, { dur: 0.05 });
    D.shape('oval', 377, 95, 383, 101, { fill: 'black', dur: 0.06 });
    D.pencil(arc(380, 98, 10, -0.9, 0.9), { dur: 0.1 }).pencil(arc(380, 98, 16, -0.85, 0.85), { dur: 0.12 }).pencil(arc(380, 98, 22, -0.8, 0.8), { dur: 0.14 });
    D.pencil(arc(380, 98, 10, Math.PI - 0.9, Math.PI + 0.9), { dur: 0.1 }).pencil(arc(380, 98, 16, Math.PI - 0.85, Math.PI + 0.85), { dur: 0.12 }).pencil(arc(380, 98, 22, Math.PI - 0.8, Math.PI + 0.8), { dur: 0.14 });
    // signal bars
    [[288, 160], [298, 150], [308, 140], [318, 130]].forEach(([x, y]) => D.shape('rect', x, y, x + 6, 168, { fill: 'black', dur: 0.07 }));
    D.pencil([[284, 170], [328, 170]], { dur: 0.07 });
  }
  function arc(cx, cy, r, a0, a1) { const p = []; for (let i = 0; i <= 12; i++) { const a = a0 + (a1 - a0) * (i / 12); p.push([Math.round(cx + r * Math.cos(a)), Math.round(cy + r * Math.sin(a))]); } return p; }
  function name(D) { D.text(292, 9, 'iPhone', 'chicago', { dur: 0.42 }); D.pencil([[291, 22], [332, 22]], { dur: 0.1 }); }

  // 4. "a better computer": beige 90s tower PC with CRT, keyboard and mouse
  function pc(D) {
    D.clear();
    // monitor
    D.shape('rrect', 62, 12, 196, 134, { fill: 'ltgray', r: 8, dur: 0.45 });
    D.shape('rrect', 76, 24, 182, 112, { fill: 'gray', r: 6, dur: 0.35 });
    D.shape('rrect', 73, 21, 185, 115, { r: 8, dur: 0.22 });
    // four-pane window glyph on the screen
    D.shape('rect', 114, 44, 127, 56, { fill: 'white', dur: 0.08 }).shape('rect', 130, 44, 143, 56, { fill: 'white', dur: 0.08 });
    D.shape('rect', 114, 59, 127, 71, { fill: 'white', dur: 0.08 }).shape('rect', 130, 59, 143, 71, { fill: 'white', dur: 0.08 });
    // taskbar + start button
    D.shape('rect', 78, 101, 180, 109, { fill: 'white', dur: 0.14 }).shape('rect', 80, 103, 96, 107, { fill: 'black', dur: 0.06 });
    // chin: vents + power button
    [120, 123, 126].forEach((y) => D.pencil([[80, y], [104, y]], { dur: 0.06 }));
    D.shape('rect', 170, 120, 182, 127, { fill: 'white', dur: 0.07 }).shape('rect', 160, 122, 163, 125, { fill: 'black', dur: 0.04 });
    // stand
    D.shape('rect', 114, 134, 144, 142, { fill: 'ltgray', dur: 0.12 }).shape('rrect', 92, 142, 166, 150, { fill: 'ltgray', r: 3, dur: 0.16 });
    // tower
    D.shape('rect', 214, 6, 274, 176, { fill: 'ltgray', dur: 0.4 });
    D.shape('rect', 222, 16, 266, 30, { fill: 'white', dur: 0.1 }).pencil([[226, 23], [262, 23]], { dur: 0.06 });
    D.shape('rect', 222, 34, 266, 48, { fill: 'white', dur: 0.1 }).pencil([[226, 41], [262, 41]], { dur: 0.06 });
    D.shape('rect', 230, 58, 258, 68, { fill: 'white', dur: 0.08 }).pencil([[234, 62], [254, 62]], { dur: 0.05 }).shape('rect', 250, 64, 254, 66, { fill: 'black', dur: 0.03 });
    D.shape('rrect', 236, 142, 252, 156, { fill: 'gray', r: 3, dur: 0.08 }).shape('rect', 256, 146, 259, 149, { fill: 'black', dur: 0.03 });
    D.shape('rect', 222, 162, 266, 172, { fill: 'hlines2', line: false, dur: 0.1 });
    // keyboard
    D.shape('rrect', 52, 160, 198, 194, { fill: 'ltgray', r: 4, dur: 0.3 });
    D.shape('rect', 58, 165, 192, 189, { fill: 'tiles', dur: 0.22 });
    // mouse + cord
    D.shape('oval', 216, 180, 232, 197, { fill: 'ltgray', dur: 0.1 }).pencil([[224, 181], [224, 178]], { dur: 0.03 });
    D.pencil([[224, 180], [228, 186], [236, 190], [246, 186], [250, 178]], { dur: 0.16 });
  }

  // small bitmaps
  const FINGER = Bm.from([
    '...##...', '..#..#..', '..#..#..', '..#..#..', '..#..###', '.##..#..#', '#.#.....#', '#.......#', '#.......#', '.#.....#.', '..#####..']);
  const SIG_SMALL = Bm.from(['.......#', '.....#.#', '...#.#.#', '.#.#.#.#', '##.#.#.#'].map((r) => r.replace(/\./g, ' ')));
  const BATT = Bm.from(['#########.', '#.......##', '#.......##', '#########.'].map((r) => r.replace(/\./g, ' ')));
  SIG_SMALL.m = null; BATT.m = null;

  G.ART = { phoneV1, thinner1, thinner2, strip, os, name, pc, F, SX, SLAB, SCR };
})(window);
