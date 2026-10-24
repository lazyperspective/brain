// The one continuous world the four paintings share. Design units: each slide is
// 1000 wide, the panorama 4000 wide, everything 1777.78 tall. Every world reads
// these numbers, so the sea line, the flight path, the sun and the labyrinth line
// up exactly where two painters meet.
(function () {
  const SC = {};
  SC.DH = 1000 * 16 / 9;
  SC.HZ = 1380;                     // the sea line, level across all four slides
  SC.SUN = [2500, 600];             // one sun, at the heart of slide III
  SC.FIG = [1540, 800];             // Icarus rising, slide II
  SC.FEATHER = [3580, 1585];        // the last feather, slide IV
  SC.LAB = { cx: 972, cy: 1436, r: 128, rings: 6, seed: 31, sy: 0.34 }; // straddles the tear
  SC.ISLE = { cx: 968, cy: 1440, rx: 182, ry: 56 };

  // the torn right edge of the notebook page (x as a function of y)
  const TN = L.noise2(901);
  const tbase = (y) => 34 * Math.sin(y / 260 + 1.3) + 22 * TN(y / 90, 0.5) + 8 * TN(y / 21, 3.5) + 2.5 * TN(y / 4, 7.5);
  SC.tearX = (y) => 985 + tbase(y) - tbase(SC.ISLE.cy);

  // the whole flight, as one path: up from the labyrinth, to the sun, down to the sea
  SC.ASCENT = L.resample(L.catmull([[972, 1436], [1010, 1330], [1075, 1218], [1190, 1112], [1320, 1012], [1430, 905], [1540, 800]], 14), 3);
  SC.APEX = L.resample(L.catmull([[1540, 800], [1800, 655], [2150, 570], [2500, 600]], 14), 3);
  SC.FALL = L.resample(L.catmull([[2500, 600], [2700, 700], [2880, 860], [3050, 1040], [3220, 1230], [3400, 1420], [3580, 1585]], 14), 3);

  // halo rings around the sun: impasto in II, hard gouache in III
  SC.HALO = [
    [432, 454, '#f5dc45'], [482, 496, '#fbf5e6'], [526, 560, '#47a0c6'], [590, 604, '#f0ad1c'],
    [640, 668, '#f0a39b'], [704, 716, '#fbf5e6'], [752, 788, '#f5dc45'], [830, 842, '#47a0c6'],
    [880, 910, '#efdfba'], [958, 970, '#f0ad1c'], [1010, 1040, '#f5dc45'],
  ];

  // flock: ink birds on the page that fly on as painted birds
  SC.BIRDS = [];
  for (let k = 0; k < 13; k++) SC.BIRDS.push([600 + k * 56, 1125 - k * 27 - 6 * Math.sin(k * 1.7), k * 1.1]);

  // a layer covering design-x [x0, x1], already transformed into design units
  SC.layer = (x0, x1, S, withHeight = false) => {
    const w = Math.ceil((x1 - x0) * S), h = Math.round(SC.DH * S);
    const c = L.canvas(w, h), ctx = c.getContext('2d');
    ctx.setTransform(S, 0, 0, S, -x0 * S, 0);
    let hc = null, hctx = null;
    if (withHeight) { hc = L.canvas(w, h); hctx = hc.getContext('2d'); hctx.setTransform(S, 0, 0, S, -x0 * S, 0); }
    return { c, ctx, hc, hctx, x0, x1 };
  };
  SC.WORLD = {};
  window.SC = SC;
})();
