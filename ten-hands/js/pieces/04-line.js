/* 04 — A Line Goes for a Walk
 * One unbroken line of ink, drawn live on an endless strip of paper. It is a horizon that keeps
 * becoming things: a table, a cup whose steam rains back into it, a whale, a town, a tightrope,
 * laundry that turns into a sail, mountains, a train — and the hand that is drawing it all.
 */
(function () {
  'use strict';

  /* ------------------------------------------------------------------ randomness */
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hashI(i) {
    let x = Math.imul((i | 0) ^ 0x9e3779b9, 0x85ebca6b);
    x ^= x >>> 13; x = Math.imul(x, 0xc2b2ae35); x ^= x >>> 16;
    return (x >>> 0) / 4294967296;
  }
  function makeNoise(rng) {
    const t = new Float32Array(512);
    for (let i = 0; i < 512; i++) t[i] = rng() * 2 - 1;
    return function (x) {
      const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
      const a = t[i & 511], b = t[(i + 1) & 511];
      return a + (b - a) * u;
    };
  }

  /* ------------------------------------------------------------- path authoring */
  // A vignette is a list of points in its own coordinates (baseline y = 0, up is negative).
  // Points are passed through by a centripetal Catmull-Rom spline; '!' marks a corner
  // (the spline breaks, the pen slows to a stop and hesitates). 'x,y:0.4' sets that pause.
  function pt(x, y, c, d) { return { x: x, y: y, c: !!c, d: d == null ? null : d }; }
  function P(str) {
    const out = [];
    const toks = str.trim().split(/\s+/);
    for (let k = 0; k < toks.length; k++) {
      let tok = toks[k], c = false, d = null, lw = 0;
      if (tok[0] === '!') { c = true; tok = tok.slice(1); }
      if (tok[tok.length - 1] === '*') { lw = 1; tok = tok.slice(0, -1); }
      const q = tok.indexOf(':');
      if (q >= 0) { d = +tok.slice(q + 1); tok = tok.slice(0, q); }
      const j = tok.indexOf(',');
      const q2 = pt(+tok.slice(0, j), +tok.slice(j + 1), c, d);
      if (lw) q2.w = 0.45;
      out.push(q2);
    }
    return out;
  }
  // points on an ellipse arc, math angles in degrees (90 = up), endpoints included
  function arc(cx, cy, rx, ry, a0, a1, step) {
    const out = [];
    const n = Math.max(1, Math.ceil(Math.abs(a1 - a0) / (step || 15)));
    for (let k = 0; k <= n; k++) {
      const a = (a0 + (a1 - a0) * k / n) * Math.PI / 180;
      out.push(pt(cx + rx * Math.cos(a), cy - ry * Math.sin(a), false));
    }
    return out;
  }
  // place a template (string or point list) at (ox, oy) with scale k (and optional mirror)
  function T(src, ox, oy, k, mx) {
    const pts = typeof src === 'string' ? P(src) : src;
    k = k || 1; mx = mx || 1;
    return pts.map(function (p) { const q = pt(ox + p.x * k * mx, oy + p.y * k, p.c, p.d); if (p.w) q.w = p.w; return q; });
  }
  function corner(p, d) { p.c = true; if (d != null) p.d = d; return p; }
  function sine(x0, x1, y0, amp0, amp1, lam) {
    const out = [];
    const n = Math.max(2, Math.round((x1 - x0) / (lam / 4)));
    for (let k = 1; k <= n; k++) {
      const u = k / n, x = x0 + (x1 - x0) * u;
      const a = amp0 + (amp1 - amp0) * u;
      out.push(pt(x, y0 - a * Math.sin((x - x0) / lam * Math.PI * 2), false));
    }
    return out;
  }
  function concat() {
    const out = [];
    for (let i = 0; i < arguments.length; i++) {
      const a = arguments[i];
      for (let j = 0; j < a.length; j++) out.push(a[j]);
    }
    return out;
  }

  /* ----------------------------------------------------------------- vignettes */
  // 0 — the horizon, and a sun going down on it
  function vHorizon(R) {
    const cx = 292, r = 30;
    let p = P('0,0 60,0.2 130,-0.3 200,0.2');
    for (let i = 0; i < p.length; i++) p[i].tempo = 0.45 + 0.5 * i / p.length;
    p.push(pt(cx - r, 0, true, 0.18));
    const nr = 5 + Math.floor(R() * 3);
    let a = 180;
    for (let k = 0; k < nr; k++) {
      const ra = 152 - k * (124 / (nr - 1));
      const seg = arc(cx, 0, r, r, a, ra, 10); seg.shift();
      p = p.concat(seg);
      corner(p[p.length - 1]).w = 0.45;
      const L = 10 + 7 * R() + (Math.abs(ra - 90) < 16 ? 4 : 0);
      const rr = (ra + (R() - 0.5) * 3) * Math.PI / 180;
      const tip = pt(cx + (r + L) * Math.cos(rr), -(r + L) * Math.sin(rr), true); tip.w = 0.45;
      p.push(tip);
      a = ra - 4;
      p.push(pt(cx + r * Math.cos(a * Math.PI / 180), -r * Math.sin(a * Math.PI / 180), true));
    }
    const seg = arc(cx, 0, r, r, a, 0, 10); seg.shift();
    p = p.concat(seg);
    corner(p[p.length - 1], 0.1);
    p = p.concat(P('380,0.3 450,-0.2 520,0'));
    return { w: 520, pts: p, tempo: 1 };
  }

  // 1 — the horizon is a table; a cup; its steam becomes a cloud that rains back into the cup
  function vTable(R) {
    const cx = 205, cy = -80, rx = 38, ry = 8;
    let p = P('0,0 22,0.2 !38,0 37,40 !35.5,72 !32.5,76 !44,76 !43.5,72 45.5,40 !47,0 100,0.3 !174,0');
    // saucer (rounded lip), cup foot, bowl
    p = p.concat(P('!174,-3 163,-4.2 152,-6.8 145,-10.5 142,-14 144.5,-16.3 152,-15.6 165,-13.6 !186,-11.6 !184.5,-15 175,-27 168.5,-44 166,-62'));
    p = p.concat(arc(cx, cy, rx, ry, 180, 0, 15));
    let s = arc(cx, cy, rx, ry, 0, -180, 15); s.shift(); p = p.concat(s);
    s = arc(cx, cy, rx, ry, 180, 140, 10); s.shift(); p = p.concat(s);
    corner(p[p.length - 1]);
    // the steam curls up...
    p = p.concat(P('178,-93 172,-104 180,-115 174,-126 183,-136'));
    // ...into a cloud, which hangs its rain from its belly; the last streak falls home
    p = p.concat(cloud([[188, -152, 15], [209, -172, 21], [241, -178, 20], [269, -162, 17]], 236, -72));
    p = p.concat(P('268,-146.5 !262,-145.5 !268,-117 !262.5,-145 251,-145.5 !248,-145.5 !255,-109 !248.5,-145 !236,-145.5 !243.5,-81.5:0.12'));
    p = p.concat(P('!240.5,-86.5 !243,-82 !247.5,-87.5 !244.2,-79 244.2,-72 !244.5,-68'));
    // handle, right wall, foot, saucer, table, far leg
    p = p.concat(P('256,-73 266,-66 268.5,-54 261,-45 !242,-43 238.5,-32 232,-22 !225.5,-15 !224,-11.6 245,-13.6 258,-15.6 265.5,-16.3 268,-14 265,-10.5 258,-6.8 247,-4.2 !236,-3 !236,0'));
    p = p.concat(P('300,0.3 380,-0.2 !431,0 432.5,40 !434.5,72 !431.5,76 !443,76 !442.5,72 441,40 !440,0 480,0.3 520,0'));
    return { w: 520, pts: p, tempo: 0.95 };
  }
  // scalloped cloud outline (clockwise on screen) through overlapping circles
  function cloud(lobes, startDeg, endDeg) {
    const out = [];
    const xs = [];
    for (let i = 0; i < lobes.length - 1; i++) xs.push(circleX(lobes[i], lobes[i + 1]));
    for (let i = 0; i < lobes.length; i++) {
      const L = lobes[i];
      const a0 = i === 0 ? startDeg : angOf(L, xs[i - 1]);
      let a1 = i === lobes.length - 1 ? endDeg : angOf(L, xs[i]);
      while (a1 > a0) a1 -= 360;
      const s = arc(L[0], L[1], L[2], L[2], a0, a1, 14);
      if (i > 0) s.shift();
      if (i < lobes.length - 1) corner(s[s.length - 1]);
      for (let j = 0; j < s.length; j++) out.push(s[j]);
    }
    return out;
  }
  function angOf(L, p) { return Math.atan2(-(p.y - L[1]), p.x - L[0]) * 180 / Math.PI; }
  function circleX(A, B) { // the upper intersection of two circles
    const dx = B[0] - A[0], dy = B[1] - A[1], d = Math.hypot(dx, dy);
    const a = (A[2] * A[2] - B[2] * B[2] + d * d) / (2 * d);
    const h = Math.sqrt(Math.max(0, A[2] * A[2] - a * a));
    const mx = A[0] + dx * a / d, my = A[1] + dy * a / d;
    const p1 = pt(mx + h * dy / d, my - h * dx / d), p2 = pt(mx - h * dy / d, my + h * dx / d);
    return p1.y < p2.y ? p1 : p2;
  }
  // out along a list of points and straight back again (a single line, inked twice)
  function outBack(str, home, dwell) {
    const o = P(str);
    corner(o[o.length - 1], dwell);
    const back = o.slice(0, -1).reverse().map(function (q) { return pt(q.x, q.y, false); });
    return concat(o, back, [pt(home[0], home[1], true)]);
  }

  // 2 — the sea, a whale, a spout; the sea ends at the steps of a harbour
  function vWhale(R) {
    let p = P('0,0 30,0.2');
    p = p.concat(sine(30, 126, 0, 0.5, 2.6, 16));
    p = p.concat(T('!-14,0 -10,-14 -7,-30 !-10,-40 -22,-47 -34,-55 !-44,-65 -30,-62 -14,-56 !-2,-58 10,-60 24,-66 !36,-72 26,-60 14,-50 !6,-42 4,-30 6,-14 !12,0', 150, 0));
    p = p.concat(sine(162, 248, 0, 2.6, 1.5, 15));
    p = p.concat(P('!250,0 262,-14 282,-38 310,-62 344,-82 378,-94 !404,-98 403,-120 !402,-142'));
    // the spout: arcs of water, each ending in a drop (the ink pools there)
    p = p.concat(outBack('396,-151 386,-156 376,-153 370,-146 367,-137', [402, -143], 0.3));
    p = p.concat(outBack('398,-157 391,-165 383,-166 378,-160', [402.5, -144], 0.22));
    p = p.concat(outBack('403,-160 404,-173', [403.5, -145], 0.16));
    p = p.concat(outBack('408,-157 415,-165 423,-166 428,-160', [404, -144], 0.22));
    p = p.concat(outBack('410,-151 420,-156 430,-153 436,-146 439,-137', [404.5, -143], 0.3));
    p = p.concat(P('405,-120 !406,-99'));
    // the head, an eye, a grin; the jaw goes under the water
    p = p.concat(P('430,-97 452,-93 470,-86 483,-74 490,-60 491.5,-52 488,-46.5 483.5,-49 485,-54 491,-54.5 494,-42 494,-28 489,-17 !480,-11.5 466,-10 452,-10.5 443,-12.5 !437.5,-17.5 !437,-12 434,-5 !432,0'));
    p = p.concat(sine(432, 630, 0, 2, 1.2, 17));
    // stone steps up to the quay
    p = p.concat(P('!636,0 !636,-6 !647,-6 !647,-12 !658,-12 !658,-18 !669,-18 !669,-24 700,-24 720,-24'));
    return { w: 720, pts: p, tempo: 1 };
  }

  // 3 — rooftops, a cat, a tightrope between chimneys and a girl with a parasol walking it
  function vTown(R) {
    let p = P('0,-24 26,-24 !44,-24 44,-60 !44,-96 !36,-98 !66,-128 74,-128');
    // the cat on the ridge, watching the rope
    p = p.concat(T('!-18,0 -19.5,-3 -17,-6 -12.5,-4.5 -6,-3 0,-3 3.5,-5 6,-10.5 7,-17 5.5,-23 6.5,-28.5 9.5,-32.5 12,-35 11,-38.5 11,-42 !11.8,-47 14.5,-44.3 17.5,-44.8 !20,-49 21.2,-43.5 23.2,-40.8 !25,-37.2 23,-35.2 20.8,-33.8 19.2,-30 18.6,-22 19,-12 19.6,-4 22,-1.2 !24,0', 96, -128, 0.85));
    p = p.concat(P('124,-128 !134,-128 !134,-158 !131,-159 !131,-165 !154,-165'));
    p = p.concat(P('225,-158.5'));
    p = p.concat(T(walker(), 292, -152, 1));
    p = p.concat(P('390,-157.5 !470,-165 !492,-165 !492,-159 !489,-159 !489,-128 !544,-88 !536,-88 !536,-24 580,-24 600,-24'));
    return { w: 600, pts: p, tempo: 0.9 };
  }
  function walker() {
    const head = arc(6, -50, 4.6, 4.8, 270, -90, 30);
    return concat(
      P('!0,0 2,-10 !4,-20 !-5,-20 !4,-29 5,-35 !5,-41 -3,-40 !-11,-44 -3,-41.5 !5,-42 !6,-45.2'),
      head.slice(1),
      P('!6,-45.4 11,-49 !15,-56 16,-64 !17,-71 13,-72.5 !10,-71 6,-72.5 !-2,-70 2,-79 10,-85 17,-87 24,-85 32,-79 !36,-70 32,-72.5 !28,-71 24,-72.5 !18,-71 !15,-56 !6,-43 6,-36 !6,-29 !16,-20 !9,-20 12,-10 !14,0')
    );
  }

  // 4 — a clothesline: shirt, socks, a sheet... which is a sail; the second post is a mast
  function vLaundry(R) {
    let p = P('0,-24 20,-24 !40,-24 40,-70 !40,-134 !32,-134 !48,-133');
    const x0 = 48, y0 = -133, x1 = 590, y1 = -176, sag = 42;
    const ly = function (x) { const u = (x - x0) / (x1 - x0); return y0 + (y1 - y0) * u + sag * 4 * u * (1 - u); };
    const along = function (xa, xb, step) {
      const out = [];
      for (let x = xa + step; x < xb - 0.01; x += step) out.push(pt(x, ly(x)));
      out.push(pt(xb, ly(xb), true));
      return out;
    };
    const hang = function (str, x, w) { // a garment hanging between x and x+w on the line
      const g = T(str, x, ly(x));
      for (let i = 0; i < g.length; i++) g[i].y += (ly(x + g[i].x - x) - ly(x)) * 0;
      g[g.length - 1].y = ly(x + w);
      return g;
    };
    // the washing, in whatever order it was pegged out today
    const shirt = function (x) { p = p.concat(hang('-13,13 !-15,15 !-7,25 !5,17 5,34 !5.5,52 16,53 30,52 !41.5,52.5 41,34 !41,17 !53,25 !61,15 !59,13 !46,0 !32,0 !23,9 !14,0 23,0 !32,0.2 !46,0.2', x, 46)); return x + 46; };
    const socks = function (x) {
      p = p.concat(hang('0.3,19 0.6,26 3,30.5 8,32.2 15,31.6 18.6,29 17.8,25.6 13.5,24 11,21.8 10.6,10 !11,0', x, 11));
      p = p.concat(along(x + 11, x + 23, 12));
      p = p.concat(hang('0.3,17 0.6,24 3,28.5 8,30.2 15,29.6 18.6,27 17.8,23.6 13.5,22 11,19.8 10.6,9 !11,0', x + 23, 11));
      return x + 34;
    };
    const trousers = function (x) { p = p.concat(hang('-0.5,14 -1.5,30 !-2,47 6,47.5 !11,47 !13.5,19 !16.5,19 !19,47 24,47.5 !32,47 31.5,30 30.5,14 !30,0', x, 30)); return x + 30; };
    const items = [shirt, socks];
    if (R() < 0.6) items.push(trousers);
    for (let i = items.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); const t = items[i]; items[i] = items[j]; items[j] = t; }
    let cx = 48;
    for (let i = 0; i < items.length; i++) {
      const nx = cx + (i === 0 ? 38 : 26 + R() * 10);
      p = p.concat(along(cx, nx, 19));
      cx = items[i](nx);
    }
    p = p.concat(along(cx, 430, 24));
    // the sheet: along the line to the mast, up to the pennant, down the mast, along the boom,
    // up the free edge and back down it, then the hull, then the bow wave
    p = p.concat(along(430, 590, 27));
    p = p.concat(P('!590,-206 !608,-202 !591,-196 !590,-176 590,-100 !590,-22 560,-26 500,-28.5 !446,-24 454,-60 448,-100 !430,' + ly(430).toFixed(1) + ' 449,-100 455,-60 !447,-24 !421,-32 430,-14 446,-3 480,4 530,5.5 570,1 592,-12 !607,-28 !611,-15 617,-5 !628,0 650,0.2 680,0'));
    return { w: 680, pts: p, tempo: 1 };
  }

  // 5 — the sea grows into mountains; a train; its smoke; the hand that is drawing it all
  function vFinale(R) {
    const hm = 0.86 + 0.26 * R();               // how high the mountains rise, this time
    const nCar = R() < 0.5 ? 1 : 2;             // and how long the train is
    let p = P('0,0');
    p = p.concat(sine(0, 140, 0, 1.5, 7, 24));
    const peaks = P('!150,-20 !166,-2 !218,-100 !234,-78 !246,-82 !272,-48 !305,-116 !316,-112 !340,-178 !340,-200 !354,-195 !341,-190 !340,-178 !370,-130 !380,-134 !408,-80 !450,-128 !478,-88 !486,-92');
    for (let i = 0; i < peaks.length; i++) peaks[i].y *= hm;
    p = p.concat(peaks);
    p = p.concat(P('!528,0 570,0.2 !600,0'));
    // carriages: wheel, back wall, a roof with round windows, front wall, wheel, coupling
    let s = arc(608, -8, 7, 7, 180, -180, 30); corner(s[0]); p = p.concat(s);
    let xb = 602;
    for (let c = 0; c < nCar; c++) {
      p = p.concat(P('!' + xb + ',-14 !' + xb + ',-46 ' + (xb + 24) + ',-46'));
      for (let k = 0; k < 3; k++) {
        const wx = xb + 36 + k * 22;
        p.push(pt(wx - 6, -46));
        p = p.concat(arc(wx, -38.5, 6, 6.5, 90, -270, 30));
        p.push(pt(wx + 6, -46));
      }
      p = p.concat(P('!' + (xb + 100) + ',-46 !' + (xb + 100) + ',-14'));
      p = p.concat(arc(xb + 92, -8, 7, 7, 0, 360, 30));
      p = p.concat(P('!' + (xb + 106) + ',-10 !' + (xb + 114) + ',-10'));
      p = p.concat(arc(xb + 121, -8, 7, 7, 180, -360, 30));
      xb += 128;
    }
    const L = xb;                                 // the tender's back wall
    // tender, cab, boiler, dome, balloon stack
    p = p.concat(T('!0,-14 !0,-40 4,-44 10,-42 16,-46 22,-43 !28,-40 !32,-40 !32,-76 !27,-77 !27,-82 !72,-82 !72,-77 !68,-77 !68,-50 80,-50 !88,-50 90,-57 97,-59.5 104,-57 !106,-50 !124,-50 123,-66 !120,-78 !114,-84', L, 0));
    // smoke streams back over the train, then curls home to the stack's other lip — where a pen is
    p = p.concat(T('842,-93 836,-102 828,-106 824,-115 814,-121 803,-119 795,-127 782,-131 770,-127 759,-133 745,-131 736,-123 735,-113 744,-108 762,-109 784,-110 808,-110 830,-108 850,-105 862,-99 !869,-85.5', L - 730, 0));
    p = p.concat(T(hand(), L + 140, -84, 1.3));
    // the nib finishes the locomotive, draws its wheels, and runs on as the rail
    p = p.concat(T('!134,-78 131,-66 !130,-50 150,-50 !158,-50 162,-42 163,-28 !160,-18 !174,0 !150,0', L, 0));
    s = arc(L + 138, -13, 13, 13, 270, -90, 24); p = p.concat(s);
    p = p.concat(P('!' + (L + 104) + ',0'));
    s = arc(L + 104, -13, 13, 13, 270, -90, 24); s.shift(); p = p.concat(s);
    p = p.concat(T('!86,0 130,0.3 !174,0 230,0.2 290,-0.2 350,0', L, 0));
    return { w: L + 350, pts: p, tempo: 0.9 };
  }
  function hand() {
    // pen at 50 degrees; the index finger lies along it, the thumb pinches from the near side,
    // the other fingers curl underneath; the sleeve is left as a quick sketch
    return P(
      '3.5,-6.2 !6.6,-11.5 10.6,-17.2 !11.6,-18.6 8.8,-20 6.6,-23 6.1,-26.6 !7.6,-29.4* 9.6,-27.6 12,-28.2 !12.6,-31* 10.2,-31.4 !9.4,-32.2 ' +
      '11.8,-35.8 13.3,-38.4 16.2,-41.6 19.4,-46 21.5,-49.8 24.6,-54 27.4,-59.4 29.9,-63.7 ' +
      '35,-65.6 40.5,-66.6 !47.5,-66.5 !76.6,-99 78.8,-99.6 80.4,-98.2 !80.9,-95.2 !53.8,-64.9 62,-64.6 70,-63 !79.4,-60.2 ' +
      '!80.6,-64.5 100,-68 !119,-71 !108,-59 !122,-62 !110,-49 !124,-51.5 !112,-39 !125.5,-41 !114,-29 !126.5,-30.5 !116,-19 108,-15 !92.5,-14 86.6,-39 !80.6,-64.5 86.7,-39 !92.6,-14.2 ' +
      '87,-12 81,-7.5 75,-2.5 69,-1.6 !65.6,-5.2 60,-0.8 53,0.2 !48.2,-3.6 41.5,-2.2 34.5,-3 30,-6.6 !27.6,-11.6 23.5,-15.2 19.9,-18.3 19.4,-22 !20.8,-23.8* 22.6,-21.6 25.2,-22.4 !25.6,-25.6* 23.2,-25.4 !22.6,-25 ' +
      '27,-30 31.4,-37.4 !36,-45.6 31.5,-37.3 27.1,-29.9 !22.8,-24.6 !18.2,-21.4 !17.7,-16.5 !10.2,-8.5 !0,0'
    );
  }

  const VIGNETTES = [vHorizon, vTable, vWhale, vTown, vLaundry, vFinale];

  /* ------------------------------------------------------- spline → samples */
  const DS = 0.25;            // world units between samples
  function crBez(p0, p1, p2, p3) {
    const l1 = Math.hypot(p1.x - p0.x, p1.y - p0.y) + 1e-4;
    const l2 = Math.hypot(p2.x - p1.x, p2.y - p1.y) + 1e-4;
    const l3 = Math.hypot(p3.x - p2.x, p3.y - p2.y) + 1e-4;
    const d1 = Math.sqrt(l1), d2 = Math.sqrt(l2), d3 = Math.sqrt(l3);
    const n1 = 3 * d1 * (d1 + d2), n2 = 3 * d3 * (d3 + d2);
    const c1 = 2 * l1 + 3 * d1 * d2 + l2, c2 = 2 * l3 + 3 * d3 * d2 + l2;
    return [
      { x: (l1 * p2.x - l2 * p0.x + c1 * p1.x) / n1, y: (l1 * p2.y - l2 * p0.y + c1 * p1.y) / n1 },
      { x: (l3 * p1.x - l2 * p3.x + c2 * p2.x) / n2, y: (l3 * p1.y - l2 * p3.y + c2 * p2.y) / n2 },
    ];
  }

  function buildCycle(seed) {
    const R = mulberry32(seed ^ 0x51ed270b);
    const all = [];
    const vStart = [];
    let ox = 0;
    for (let v = 0; v < VIGNETTES.length; v++) {
      const V = VIGNETTES[v](R);
      vStart.push(ox);
      const pts = V.pts;
      for (let i = 0; i < pts.length; i++) {
        if (v > 0 && i === 0) continue;               // shared junction point
        const q = pts[i];
        const edge = (i === 0 || i === pts.length - 1);
        const j = edge ? 0 : 0.55;
        all.push({ x: q.x + ox + (R() - 0.5) * 2 * j, y: q.y + (R() - 0.5) * 2 * j, c: q.c, d: q.d, tempo: q.tempo || V.tempo, v: v, w: q.w || 1 });
      }
      ox += V.w;
    }
    const Wc = ox;
    // drop exact duplicates
    const pts = [all[0]];
    for (let i = 1; i < all.length; i++) {
      const a = pts[pts.length - 1], b = all[i];
      if (Math.hypot(a.x - b.x, a.y - b.y) < 0.05) { if (b.c) { a.c = true; a.d = b.d; } continue; }
      pts.push(b);
    }

    // dense polyline, run by run (runs break at corners)
    const dx = [], dy = [], dt = [], dv = [], dw = [];
    const cornerL = [];        // {L, d}
    let Lacc = 0;
    const pushPt = function (x, y, tempo, v, w) {
      if (dx.length) Lacc += Math.hypot(x - dx[dx.length - 1], y - dy[dy.length - 1]);
      dx.push(x); dy.push(y); dt.push(tempo); dv.push(v); dw.push(w);
    };
    pushPt(pts[0].x, pts[0].y, pts[0].tempo, pts[0].v, pts[0].w);
    let rs = 0;
    for (let i = 1; i < pts.length; i++) {
      if (!(pts[i].c || i === pts.length - 1)) continue;
      const run = pts.slice(rs, i + 1);
      const m = run.length - 1;
      for (let j = 0; j < m; j++) {
        const p1 = run[j], p2 = run[j + 1];
        const p0 = j > 0 ? run[j - 1] : { x: 2 * p1.x - p2.x, y: 2 * p1.y - p2.y };
        const p3 = j + 2 <= m ? run[j + 2] : { x: 2 * p2.x - p1.x, y: 2 * p2.y - p1.y };
        const b = crBez(p0, p1, p2, p3);
        const chord = Math.hypot(p2.x - p1.x, p2.y - p1.y);
        const n = Math.max(2, Math.ceil(chord / 0.2));
        for (let k = 1; k <= n; k++) {
          const t = k / n, u = 1 - t;
          const x = u * u * u * p1.x + 3 * u * u * t * b[0].x + 3 * u * t * t * b[1].x + t * t * t * p2.x;
          const y = u * u * u * p1.y + 3 * u * u * t * b[0].y + 3 * u * t * t * b[1].y + t * t * t * p2.y;
          pushPt(x, y, p1.tempo, p1.v, p1.w);
        }
      }
      if (pts[i].c) cornerL.push({ L: Lacc, d: pts[i].d });
      rs = i;
    }

    // resample by arc length
    const total = Lacc;
    const N = Math.floor(total / DS);          // samples 0..N-1; sample N would be next cycle's 0
    const BX = new Float32Array(N + 1), BY = new Float32Array(N + 1), TEMPO = new Float32Array(N + 1);
    const VIG = new Uint8Array(N + 1), LW = new Float32Array(N + 1);
    {
      let j = 0, acc = 0;
      for (let i = 0; i <= N; i++) {
        const target = i * DS * (total / (N * DS));
        while (j < dx.length - 2) {
          const seg = Math.hypot(dx[j + 1] - dx[j], dy[j + 1] - dy[j]);
          if (acc + seg >= target) break;
          acc += seg; j++;
        }
        const seg = Math.hypot(dx[j + 1] - dx[j], dy[j + 1] - dy[j]) || 1e-6;
        const f = Math.min(1, Math.max(0, (target - acc) / seg));
        BX[i] = dx[j] + (dx[j + 1] - dx[j]) * f;
        BY[i] = dy[j] + (dy[j + 1] - dy[j]) * f;
        TEMPO[i] = dt[j]; VIG[i] = dv[j]; LW[i] = dw[j];
      }
    }
    const ds = total / N;
    const isCorner = new Uint8Array(N + 1), dwellSet = new Float32Array(N + 1).fill(-1);
    for (let k = 0; k < cornerL.length; k++) {
      const i = Math.min(N, Math.round(cornerL[k].L / ds));
      isCorner[i] = 1;
      if (cornerL[k].d != null) dwellSet[i] = cornerL[k].d;
    }

    // tangents, curvature
    const TX = new Float32Array(N + 1), TY = new Float32Array(N + 1), K = new Float32Array(N + 1);
    for (let i = 0; i <= N; i++) {
      const a = Math.max(0, i - 2), b = Math.min(N, i + 2);
      let tx = BX[b] - BX[a], ty = BY[b] - BY[a];
      const l = Math.hypot(tx, ty) || 1;
      TX[i] = tx / l; TY[i] = ty / l;
    }
    const M = 6;
    for (let i = 0; i <= N; i++) {
      const a = Math.max(0, i - M), b = Math.min(N, i + M);
      let ang = Math.atan2(TY[b], TX[b]) - Math.atan2(TY[a], TX[a]);
      while (ang > Math.PI) ang -= 2 * Math.PI;
      while (ang < -Math.PI) ang += 2 * Math.PI;
      K[i] = Math.abs(ang) / ((b - a) * ds + 1e-6);
    }

    // speed plan: fast on straights, slow into curves, a stop at every corner
    const nz = makeNoise(R), nz2 = makeNoise(R), nz3 = makeNoise(R);
    const VMAX = 420, ALAT = 600, ACC = 4800;
    const V = new Float32Array(N + 1);
    for (let i = 0; i <= N; i++) {
      const tempo = TEMPO[i] * (0.86 + 0.14 * nz(i * ds / 260));
      const vm = VMAX * tempo;
      V[i] = Math.max(10, Math.min(vm, 52 * tempo * Math.pow(1 / Math.max(K[i], 1e-5), 0.42)));
      if (isCorner[i]) V[i] = 14;
    }
    for (let i = 1; i <= N; i++) V[i] = Math.min(V[i], Math.sqrt(V[i - 1] * V[i - 1] + 2 * ACC * ds));
    for (let i = N - 1; i >= 0; i--) V[i] = Math.min(V[i], Math.sqrt(V[i + 1] * V[i + 1] + 2 * ACC * ds));

    // pauses: corners (longer for sharper turns), a thought at each new vignette, a few hesitations
    const DW = new Float32Array(N + 1);
    for (let i = 0; i <= N; i++) {
      if (!isCorner[i]) continue;
      if (dwellSet[i] >= 0) { DW[i] = dwellSet[i]; continue; }
      const a = Math.max(0, i - 8), b = Math.min(N, i + 8);
      const dot = TX[a] * TX[b] + TY[a] * TY[b];
      const turn = Math.acos(Math.max(-1, Math.min(1, dot))) / Math.PI;
      DW[i] = (0.02 + 0.1 * turn) * (0.75 + 0.5 * R());
    }
    for (let v = 1; v < vStart.length; v++) {
      let best = -1, bd = 1e9;
      for (let i = 0; i <= N; i++) { const d = Math.abs(BX[i] - vStart[v]) + Math.abs(BY[i]) * 4; if (d < bd) { bd = d; best = i; } }
      if (best >= 0) { DW[best] += 0.18 + 0.2 * R(); V[best] = Math.min(V[best], 20); }
    }
    {
      let i = 400;
      while (i < N - 400) {
        i += 2400 + Math.floor(R() * 3000);
        if (i < N && K[i] < 0.01 && !isCorner[i]) { DW[i] += 0.06 + 0.14 * R(); }
      }
    }
    // re-run the slow-downs around pauses
    for (let i = 0; i <= N; i++) if (DW[i] > 0) V[i] = Math.min(V[i], 14);
    for (let i = 1; i <= N; i++) V[i] = Math.min(V[i], Math.sqrt(V[i - 1] * V[i - 1] + 2 * ACC * ds));
    for (let i = N - 1; i >= 0; i--) V[i] = Math.min(V[i], Math.sqrt(V[i + 1] * V[i + 1] + 2 * ACC * ds));

    const TT = new Float64Array(N + 1);
    for (let i = 1; i <= N; i++) TT[i] = TT[i - 1] + DW[i - 1] + ds / ((V[i - 1] + V[i]) * 0.5);
    const Tc = TT[N];

    // ink: a pointed flexible nib swells on downstrokes, pools when slow, starves when hurried
    const WD = new Float32Array(N + 1), DRY = new Float32Array(N + 1), BEAD = new Float32Array(N + 1);
    const X = new Float32Array(N + 1), Y = new Float32Array(N + 1);
    // dry streak events on long, fast, straight stretches
    const dryAt = [];
    {
      const cands = [];
      for (let i = 2400; i < N - 600; i += 40) {
        let ok = true;
        for (let j = i; j < i + 480; j += 20) if (K[j] > 0.006 || V[j] < 0.7 * VMAX * TEMPO[j] || isCorner[j]) { ok = false; break; }
        if (ok) cands.push(i);
      }
      let last = -1e9;
      for (let k = 0; k < cands.length; k++) {
        const i = cands[k];
        if (i - last < 4000) continue;
        if (R() < 0.55) { dryAt.push(i); last = i; }
      }
    }
    // short strokes are touched in lightly; long ones get the weight of the arm
    const prevC = new Int32Array(N + 1), nextC = new Int32Array(N + 1);
    { let lc = 0; for (let i = 0; i <= N; i++) { if (isCorner[i]) lc = i; prevC[i] = lc; }
      lc = N; for (let i = N; i >= 0; i--) { if (isCorner[i]) lc = i; nextC[i] = lc; } }
    let flowBoost = 0;
    for (let i = 0; i <= N; i++) {
      const s = i * ds, vn = V[i] / VMAX;
      const down = Math.max(0, TX[i] * -0.27 + TY[i] * 0.963);
      const runL = (nextC[i] - prevC[i]) * ds, ru = Math.min(1, Math.max(0, (runL - 4) / 40));
      const press = (0.55 + 0.45 * (0.5 + 0.5 * nz2(s / 110))) * (0.35 + 0.65 * ru * ru * (3 - 2 * ru));
      if (DW[i] > 0.06) flowBoost = Math.min(1.1, DW[i] * 3);
      flowBoost *= Math.exp(-ds / 5);
      let w = 1.35 + 2.9 * Math.pow(down, 1.6) * press * LW[i] + 0.6 * Math.pow(Math.max(0, 1 - vn), 4) + flowBoost;
      let dry = 0;
      for (let k = 0; k < dryAt.length; k++) {
        const d = i - dryAt[k];
        if (d > 0 && d < 520) dry = Math.max(dry, Math.min(1, d / 130) * Math.min(1, (520 - d) / 40));
      }
      dry *= 0.6 + 0.4 * (0.5 + 0.5 * nz3(s / 9));
      DRY[i] = dry;
      w *= 1 - 0.32 * dry;
      WD[i] = w;
      BEAD[i] = DW[i] > 0.07 ? Math.min(1.4, (DW[i] - 0.05) * 5.5) : 0;
      // tremor: the slower the hand, the more it wavers
      const amp = 0.08 + 0.3 * Math.pow(Math.max(0, 1 - vn), 2);
      const o = amp * (nz3(s / 2.3 + 40) * 0.7 + nz(s / 0.9 + 90) * 0.3);
      X[i] = BX[i] - TY[i] * o;
      Y[i] = BY[i] + TX[i] * o;
    }

    let minY = 1e9, maxY = -1e9;
    for (let i = 0; i <= N; i++) { if (BY[i] < minY) minY = BY[i]; if (BY[i] > maxY) maxY = BY[i]; }
    // running max of x, for finding where history starts
    const MAXX = new Float32Array(N + 1);
    let mx = -1e9;
    for (let i = 0; i <= N; i++) { mx = Math.max(mx, BX[i]); MAXX[i] = mx; }

    const vTime = [];
    for (let v = 0; v < vStart.length; v++) {
      let i = 0;
      while (i < N && VIG[i] < v) i++;
      vTime.push(TT[i]);
    }
    return { vTime: vTime, N: N, Wc: Wc, Tc: Tc, X: X, Y: Y, BX: BX, BY: BY, TT: TT, WD: WD, DRY: DRY, BEAD: BEAD, DW: DW,
      MAXX: MAXX, minY: minY, maxY: maxY, vStart: vStart, VIG: VIG };
  }

  /* ----------------------------------------------------------------- the piece */
  (window.PIECES = window.PIECES || []).push({
    id: 'line',
    title: 'A Line Goes for a Walk',
    medium: 'Steel nib and India ink: one stroke, never lifted',
    note: 'It has not lifted the pen since you arrived.',
    about: 'A single line of ink, drawn live and never lifted, keeps turning into things: a table, a cup whose steam rains back into it, a whale, a tightrope, a sail, a train, and at last the hand that is drawing it. After Klee taking a line for a walk, and Steinberg’s The Line.',
    tone: 'dark',
    room: '#191613',
    mount: function (el, api) {
      const params = new URLSearchParams(location.search);
      const startT = params.has('line_t') ? parseFloat(params.get('line_t')) || 0 : null;
      const speed = params.has('line_speed') ? parseFloat(params.get('line_speed')) || 1 : 1;
      const sheet = params.has('line_sheet');
      const perf = params.has('line_perf') ? { n: 0, ms: 0 } : null;
      let reduce = false;
      try { reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { /* ignore */ }
      if (params.has('line_static')) reduce = true;

      const C = buildCycle(api.seed >>> 0);
      const N = C.N;
      const INK = '#16120f';

      // the desk (static) and, over it, the strip of paper (redrawn every frame from opaque tiles)
      const bgc = document.createElement('canvas');
      bgc.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;display:block';
      el.appendChild(bgc);
      const canvas = document.createElement('canvas');
      canvas.style.cssText = 'position:absolute;left:0;width:100%;display:block';
      el.appendChild(canvas);
      const ctx = canvas.getContext('2d');

      let W = 0, H = 0, dpr = 1, S = 1, SW = 1, visW = 1;
      let paperTop = 0, paperH = 0, worldTop = 0;   // css px; world y at paper top
      let grain = null;
      let tiles = new Map(), TWd = 512, tileHd = 1;
      let camA = null, camA0 = null, camDt = 1 / 20, camK = 0, camF = 0.6, camFs = 0.3;
      let gDrawn = -1;                 // last global sample stamped
      let clock = startT != null ? startT : -0.75;
      let raf = 0, alive = true, lastNow = 0;

      /* ---------- time ↔ samples */
      function sampleAt(t) { // fractional global sample index at time t (t >= 0)
        const c = Math.floor(t / C.Tc), tl = t - c * C.Tc;
        let lo = 0, hi = N;
        while (hi - lo > 1) { const m = (lo + hi) >> 1; if (C.TT[m] <= tl) lo = m; else hi = m; }
        const t0 = C.TT[lo] + C.DW[lo], t1 = C.TT[lo + 1];
        const f = tl <= t0 ? 0 : Math.min(1, (tl - t0) / Math.max(1e-6, t1 - t0));
        return { g: c * N + lo, f: f, dwellLeft: t0 - tl, dwellIn: tl - C.TT[lo] };
      }
      function gx(g) { const c = Math.floor(g / N), i = g - c * N; return C.BX[i] + c * C.Wc; }
      function penXAt(t) {
        if (t < 0) { const c = Math.floor(t / C.Tc); return penXAt(t - c * C.Tc) + c * C.Wc; }
        const s = sampleAt(t);
        const c = Math.floor(s.g / N), i = s.g - c * N;
        const x0 = C.BX[i], x1 = C.BX[Math.min(N, i + 1)];
        return x0 + (x1 - x0) * s.f + c * C.Wc;
      }

      /* ---------- camera: a long, smooth average of where the pen has been and is going */
      function buildCamera() {
        const n = Math.ceil(C.Tc / camDt);
        const sig = 2.4 / camDt, rad = Math.ceil(sig * 3);
        const raw = new Float64Array(n + 2 * rad + 1);
        for (let k = -rad; k <= n + rad; k++) raw[k + rad] = penXAt(k * camDt);
        const ker = []; let ks = 0;
        for (let j = -rad; j <= rad; j++) { const w = Math.exp(-0.5 * (j / sig) * (j / sig)); ker.push(w); ks += w; }
        camA = new Float64Array(n + 1);
        for (let k = 0; k <= n; k++) {
          let s = 0;
          for (let j = -rad; j <= rad; j++) s += raw[k + rad + j] * ker[j + rad];
          camA[k] = s / ks;
        }
        camK = n;
        // keep the nib on screen: where it runs too far ahead or doubles back too far, lean the
        // camera after it, smoothly
        const fmax = 0.84, fmin = 0.16, sg = 0.7 / camDt, rg = Math.ceil(sg * 3);
        const kg = []; let kgs = 0;
        for (let j = -rg; j <= rg; j++) { const w = Math.exp(-0.5 * (j / sg) * (j / sg)); kg.push(w); kgs += w; }
        for (let it = 0; it < 4; it++) {
          const corr = new Float64Array(n);
          for (let k = 0; k < n; k++) {
            const fr = (raw[k + rad] - (camA[k] - camF * visW)) / visW;
            if (fr > fmax) corr[k] = (fr - fmax) * visW; else if (fr < fmin) corr[k] = (fr - fmin) * visW;
          }
          for (let k = 0; k <= n; k++) {
            let a = 0;
            for (let j = -rg; j <= rg; j++) a += corr[((k + j) % n + n) % n] * kg[j + rg];
            camA[k] += 1.4 * a / kgs;
          }
        }
        // the opening: the pen starts left of centre; the paper waits until it arrives
        const n0 = Math.ceil(30 / camDt);
        const sig2 = 1.3 / camDt, rad2 = Math.ceil(sig2 * 3);
        const r0 = new Float64Array(n0 + 2 * rad2 + 1);
        const hold = -camFs * visW;
        for (let k = -rad2; k <= n0 + rad2; k++) {
          const kk = Math.max(0, Math.min(n, k));
          const v = k < 0 ? hold : camA[Math.min(n, k)] - camF * visW;
          r0[k + rad2] = Math.max(hold, k < 0 ? hold : v);
          void kk;
        }
        camA0 = new Float64Array(n0 + 1);
        let ks2 = 0; const ker2 = [];
        for (let j = -rad2; j <= rad2; j++) { const w = Math.exp(-0.5 * (j / sig2) * (j / sig2)); ker2.push(w); ks2 += w; }
        for (let k = 0; k <= n0; k++) {
          let s = 0;
          for (let j = -rad2; j <= rad2; j++) s += r0[k + rad2 + j] * ker2[j + rad2];
          camA0[k] = s / ks2;
        }
      }
      function camPeriodic(t) {
        const c = Math.floor(t / C.Tc), tl = t - c * C.Tc;
        const k = tl / camDt, i = Math.min(camK - 1, Math.floor(k)), f = k - i;
        return camA[i] + (camA[i + 1] - camA[i]) * f + c * C.Wc - camF * visW;
      }
      function viewCam(t) { // reduced motion: a still, with the pen near the right edge
        return reduce ? penXAt(t) - 0.86 * visW : camAt(t);
      }
      function camAt(t) {
        if (t < 0) t = 0;
        if (t >= 24) return camPeriodic(t);
        const k = t / camDt, i = Math.floor(k), f = k - i;
        const a = camA0[i] + (camA0[i + 1] - camA0[i]) * f;
        if (t < 14) return a;
        const u = (t - 14) / 10, w = u * u * (3 - 2 * u);
        return a + (camPeriodic(t) - a) * w;
      }

      /* ---------- layout and paper */
      function layout() {
        W = Math.max(1, el.clientWidth); H = Math.max(1, el.clientHeight);
        dpr = Math.min(2, window.devicePixelRatio || 1);
        const top = C.minY - 26, bot = C.maxY + 22, bandH = bot - top;
        const phone = W < H;
        S = Math.min(H * (phone ? 0.52 : 0.66) / bandH, W / 560);
        SW = Math.pow(S / 1.5, 0.62);
        visW = W / S;
        camF = phone ? 0.64 : 0.6;
        camFs = phone ? 0.36 : 0.3;
        const contentH = bandH * S;
        paperH = Math.max(contentH + 40, phone ? H * 0.5 : 0);
        paperH = Math.round(Math.min(paperH, H * 0.9));
        paperTop = Math.round(H * (phone ? 0.48 : 0.465) - paperH / 2);
        bgc.width = Math.round(W * dpr); bgc.height = Math.round(H * dpr);
        canvas.width = Math.round(W * dpr);
        if (sheet) { canvas.style.top = '0px'; canvas.style.height = H + 'px'; canvas.height = Math.round(H * dpr); }
        else { canvas.style.top = paperTop + 'px'; canvas.style.height = paperH + 'px'; canvas.height = Math.round(paperH * dpr); }
        // world y at the paper's top edge (content centred inside the paper)
        worldTop = top - (paperH - contentH) / 2 / S;
        tileHd = canvas.height;
        TWd = 512;
        buildBackground();
        buildCamera();
        tiles.forEach(function (t) { t.c.width = 1; });
        tiles = new Map();
        gDrawn = -1;
      }

      function buildBackground() {
        const R = mulberry32((api.seed ^ 0x2545F491) >>> 0);
        const g = bgc.getContext('2d');
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
        // the desk: deep warm brown-black, a little light from above
        g.fillStyle = '#191613'; g.fillRect(0, 0, W, H);
        const rg = g.createRadialGradient(W * 0.5, H * 0.42, 0, W * 0.5, H * 0.42, Math.max(W, H) * 0.75);
        rg.addColorStop(0, 'rgba(70,58,44,0.35)'); rg.addColorStop(1, 'rgba(0,0,0,0.25)');
        g.fillStyle = rg; g.fillRect(0, 0, W, H);
        // the shadow the paper casts on the desk
        g.save();
        g.shadowColor = 'rgba(0,0,0,0.55)'; g.shadowBlur = 26; g.shadowOffsetY = 10;
        g.fillStyle = '#efe8da'; g.fillRect(-40, paperTop, W + 80, paperH);
        g.restore();
        // paper tooth: baked into each tile as it is unrolled, so it travels with the paper
        grain = document.createElement('canvas');
        const GS = 256;
        grain.width = GS; grain.height = GS;
        const gg = grain.getContext('2d');
        const id = gg.createImageData(GS, GS);
        for (let i = 0; i < GS * GS; i++) {
          const v = R();
          const a = v < 0.5 ? (0.5 - v) * 22 : 0;
          const l = v > 0.93 ? (v - 0.93) * 300 : 0;
          if (a > l) { id.data[i * 4] = 110; id.data[i * 4 + 1] = 90; id.data[i * 4 + 2] = 60; id.data[i * 4 + 3] = a; }
          else { id.data[i * 4] = 255; id.data[i * 4 + 1] = 252; id.data[i * 4 + 2] = 245; id.data[i * 4 + 3] = l; }
        }
        gg.putImageData(id, 0, 0);
        gg.lineWidth = 0.6;
        for (let k = 0; k < 26; k++) {
          gg.strokeStyle = 'rgba(120,100,70,' + (0.05 + R() * 0.07) + ')';
          const x = R() * GS, y = R() * GS, a = R() * Math.PI, l = 4 + R() * 10;
          gg.beginPath(); gg.moveTo(x, y);
          gg.quadraticCurveTo(x + Math.cos(a) * l * 0.5 + (R() - 0.5) * 3, y + Math.sin(a) * l * 0.5 + (R() - 0.5) * 3, x + Math.cos(a) * l, y + Math.sin(a) * l);
          gg.stroke();
        }
      }
      function paperTile(g, k) {
        const w = TWd, h = tileHd;
        g.fillStyle = '#f1eadc'; g.fillRect(0, 0, w, h);
        // faint mottling in the sheet
        for (let m = k - 2; m <= k + 2; m++) for (let j = 0; j < 2; j++) {
          const hx = hashI(m * 31 + j * 7 + 3), hy = hashI(m * 17 + j * 13 + 5), hr = hashI(m * 11 + j + 9);
          const x = (m - k + hx) * w, y = hy * h, r = Math.min(1.3 * w, (0.25 + hr * 0.5) * h);
          const rg = g.createRadialGradient(x, y, 0, x, y, r);
          const dark = hr > 0.5;
          rg.addColorStop(0, dark ? 'rgba(150,120,80,0.035)' : 'rgba(255,252,244,0.06)');
          rg.addColorStop(1, 'rgba(150,120,80,0)');
          g.fillStyle = rg; g.fillRect(0, 0, w, h);
        }
        g.save();
        g.translate(-(((k * TWd) % 256) + 256) % 256, 0);
        g.fillStyle = g.createPattern(grain, 'repeat');
        g.fillRect(0, 0, w + 256, h);
        g.restore();
        // slightly darker toward the edges where the strip lifts off the desk
        const lg = g.createLinearGradient(0, 0, 0, h);
        lg.addColorStop(0, 'rgba(120,96,60,0.10)'); lg.addColorStop(0.06, 'rgba(120,96,60,0)');
        lg.addColorStop(0.94, 'rgba(120,96,60,0)'); lg.addColorStop(1, 'rgba(90,70,40,0.14)');
        g.fillStyle = lg; g.fillRect(0, 0, w, h);
        g.fillStyle = 'rgba(255,252,244,0.55)'; g.fillRect(0, 0, w, dpr);
        g.fillStyle = 'rgba(60,45,30,0.25)'; g.fillRect(0, h - dpr, w, dpr);
      }

      /* ---------- ink */
      function tileFor(k) {
        let t = tiles.get(k);
        if (!t) {
          const c = document.createElement('canvas');
          c.width = TWd; c.height = tileHd;
          t = { c: c, g: c.getContext('2d'), k: k, solid: null, dry: null };
          paperTile(t.g, k);
          tiles.set(k, t);
        }
        return t;
      }
      const touched = [];
      function addDisc(xd, yd, r, kind) {
        const k0 = Math.floor((xd - r - 1) / TWd), k1 = Math.floor((xd + r + 1) / TWd);
        for (let k = k0; k <= k1; k++) {
          const t = tileFor(k);
          let p = kind ? t.dry : t.solid;
          if (!p) {
            p = new Path2D();
            if (kind) t.dry = p; else t.solid = p;
            if (!t.mark) { t.mark = true; touched.push(t); }
          }
          const x = xd - k * TWd;
          p.moveTo(x + r, yd);
          p.arc(x, yd, r, 0, Math.PI * 2);
        }
      }
      function flush() {
        for (let i = 0; i < touched.length; i++) {
          const t = touched[i];
          if (t.dry) { t.g.fillStyle = 'rgba(30,24,20,0.42)'; t.g.fill(t.dry); }
          if (t.solid) { t.g.fillStyle = INK; t.g.fill(t.solid); }
          t.solid = t.dry = null; t.mark = false;
        }
        touched.length = 0;
      }
      const sx = function () { return S * dpr; };
      function radiusOf(i) { return Math.max(0.42, 0.5 * C.WD[i] * SW * dpr); }
      function stamp(gFrom, gTo) { // stamp samples gFrom..gTo inclusive, joined to gFrom-1
        const k = sx();
        for (let g = gFrom; g <= gTo; g++) {
          const c = Math.floor(g / N), i = g - c * N;
          const xw = C.X[i] + c * C.Wc, yw = C.Y[i];
          const xd = xw * k, yd = (yw - worldTop) * k;
          const r = radiusOf(i);
          let pxd = xd, pyd = yd, pr = r;
          if (g > 0) {
            const cp = Math.floor((g - 1) / N), ip = g - 1 - cp * N;
            pxd = (C.X[ip] + cp * C.Wc) * k; pyd = (C.Y[ip] - worldTop) * k; pr = radiusOf(ip);
          }
          const dist = Math.hypot(xd - pxd, yd - pyd);
          const n = Math.max(1, Math.ceil(dist / Math.max(0.35, Math.min(r, 1) * 0.7)));
          const dry = C.DRY[i];
          for (let s = 1; s <= n; s++) {
            const f = s / n;
            const x = pxd + (xd - pxd) * f, y = pyd + (yd - pyd) * f, rr = pr + (r - pr) * f;
            if (dry > 0.08) {
              const h = hashI(g * 7 + s), h2 = hashI(g * 13 + s * 3 + 1);
              // starved nib: the line greys and breaks, the tines leave two faint rails
              if (h < 0.9 - dry * 0.6) addDisc(x, y, rr * (1 - 0.45 * dry), 1);
              if (h2 < 1 - dry * 0.7) addDisc(x, y, rr * (1 - 0.75 * dry), 0);
            } else addDisc(x, y, rr * (0.93 + 0.11 * hashI(g * 7 + s)), 0);
          }
          if (C.BEAD[i] > 0 && !(g === gTo && liveDwell)) addDisc(xd, yd, r + C.BEAD[i] * SW * dpr * 0.5, 0);
        }
        flush();
      }
      let liveDwell = false;

      function restamp(t) { // redraw everything visible, up to time t
        const s = sampleAt(Math.max(0, t));
        const left = viewCam(t) - 60 / S;
        // first sample whose running max x reaches the left edge
        const c0 = Math.floor(s.g / N);
        let gStart = 0;
        for (let c = Math.max(0, c0 - 2); c <= c0; c++) {
          const lx = left - c * C.Wc;
          if (C.MAXX[N] < lx) continue;
          let lo = 0, hi = N;
          while (lo < hi) { const m = (lo + hi) >> 1; if (C.MAXX[m] >= lx) hi = m; else lo = m + 1; }
          gStart = c * N + lo; break;
        }
        gStart = Math.max(0, Math.min(gStart, s.g));
        if (s.g >= gStart) stamp(gStart, s.g);
        gDrawn = s.g;
      }

      /* ---------- frame */
      function render() {
        const t = Math.max(0, clock);
        const s = sampleAt(t);
        const dwelling = s.f === 0 && s.dwellLeft > 0 && C.DW[s.g % N] > 0;
        if (s.g > gDrawn) {
          liveDwell = dwelling;
          stamp(gDrawn + 1, s.g);
          gDrawn = s.g;
        }
        // a bead swelling while the pen rests
        const i = s.g % N, cyc = Math.floor(s.g / N);
        const k = sx();
        if (dwelling && C.BEAD[i] > 0) {
          const grow = Math.min(1, s.dwellIn / Math.max(0.01, C.DW[i]));
          addDisc((C.X[i] + cyc * C.Wc) * k, (C.Y[i] - worldTop) * k, radiusOf(i) + C.BEAD[i] * SW * dpr * 0.5 * Math.sqrt(grow), 0);
          flush();
        }
        // opening blot: the nib first touches the paper
        if (clock < 0 && startT == null) {
          const grow = Math.min(1, (clock + 0.75) / 0.75);
          addDisc(C.X[0] * k, (C.Y[0] - worldTop) * k, (0.6 + 1.6 * grow) * SW * dpr, 0);
          flush();
        }

        const cam = viewCam(t);
        const camXd = Math.round(cam * k);
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        const pTop = 0;
        const k0 = Math.floor(camXd / TWd), k1 = Math.floor((camXd + canvas.width - 1) / TWd);
        for (let kk = k0; kk <= k1; kk++) ctx.drawImage(tileFor(kk).c, kk * TWd - camXd, 0);
        // fresh ink is still wet: a faint sheen rides along the last stretch of line
        const i1 = Math.min(N, i + 1);
        const K = 360;
        for (let b = 0; b < 3; b++) {
          ctx.beginPath();
          for (let j = b * K / 3; j < (b + 1) * K / 3; j += 2) {
            const g = s.g - j;
            if (g < 0) break;
            const cc = Math.floor(g / N), ii = g - cc * N;
            const r0 = radiusOf(ii);
            if (r0 < 1.1 * dpr) continue;
            const x = (C.X[ii] + cc * C.Wc) * k - camXd - r0 * 0.28, y = (C.Y[ii] - worldTop) * k + pTop - r0 * 0.32;
            ctx.moveTo(x + r0 * 0.3, y); ctx.arc(x, y, r0 * 0.3, 0, Math.PI * 2);
          }
          ctx.fillStyle = 'rgba(250,244,232,' + (0.2 - b * 0.06) + ')';
          ctx.fill();
        }
        // the bead of ink at the nib
        const px = (C.X[i] + (C.X[i1] - C.X[i]) * s.f + cyc * C.Wc) * k - camXd;
        const py = (C.Y[i] + (C.Y[i1] - C.Y[i]) * s.f - worldTop) * k + pTop;
        const rt = radiusOf(i) * 1.1 + 0.5 * dpr * SW;
        ctx.fillStyle = INK;
        ctx.beginPath(); ctx.arc(px, py, rt, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(255,250,240,0.4)';
        ctx.beginPath(); ctx.arc(px - rt * 0.32, py - rt * 0.36, rt * 0.3, 0, Math.PI * 2); ctx.fill();
        // retire tiles far to the left
        const kmin = Math.floor(camXd / TWd) - 2;
        tiles.forEach(function (tl, kk) { if (kk < kmin) { tl.c.width = 1; tiles.delete(kk); } });
      }

      function renderSheet() { // debug: the whole cycle laid out in rows
        const rows = parseInt(params.get('line_sheet'), 10) || 4;
        const X0 = params.has('line_x0') ? +params.get('line_x0') : 0;
        const X1 = params.has('line_x1') ? +params.get('line_x1') : C.Wc;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = '#f1eadc'; ctx.fillRect(0, 0, canvas.width, canvas.height);
        const rowW = (X1 - X0) / rows;
        const top = C.minY - 10, bot = C.maxY + 10;
        const sc = Math.min(canvas.width / rowW, canvas.height / rows / (bot - top));
        ctx.fillStyle = INK;
        for (let r = 0; r < rows; r++) {
          const x0 = X0 + r * rowW, oy = r * (bot - top) * sc;
          ctx.beginPath();
          for (let i = 0; i < N; i++) {
            const x = C.X[i];
            const vs = C.vStart;
            void vs;
            if (x < x0 - 80 || x > x0 + rowW + 80) continue;
            const rr = Math.max(0.5, 0.5 * C.WD[i] * Math.pow(sc / 1.5, 0.62)) ;
            const X = (x - x0) * sc, Y = oy + (C.Y[i] - top) * sc;
            ctx.moveTo(X + rr, Y); ctx.arc(X, Y, rr, 0, Math.PI * 2);
            if (C.BEAD[i] > 0) { const b = rr + C.BEAD[i] * 0.5 * Math.pow(sc / 1.5, 0.62); ctx.moveTo(X + b, Y); ctx.arc(X, Y, b, 0, Math.PI * 2); }
          }
          ctx.fill();
          ctx.fillStyle = 'rgba(0,0,0,0.15)'; ctx.fillRect(0, oy + (bot - top) * sc - 1, canvas.width, 1); ctx.fillStyle = INK;
        }
        ctx.fillStyle = '#933';
        ctx.font = (12 * dpr) + 'px sans-serif';
        let info = 'cycle ' + C.Tc.toFixed(1) + ' s, ' + C.Wc + ' u, ' + N + ' samples | ';
        for (let v = 0; v < C.vStart.length; v++) {
          let best = 0; for (let i = 0; i < N; i++) if (C.VIG[i] === v) { best = i; break; }
          info += 'v' + v + '@' + C.vStart[v] + ':' + C.TT[best].toFixed(1) + 's ';
        }
        ctx.fillText(info, 8 * dpr, 16 * dpr);
      }

      function frame(now) {
        if (!alive) return;
        if (!api.isCurrent()) { alive = false; return; }
        const dt = lastNow ? Math.min(0.1, (now - lastNow) / 1000) : 0;
        lastNow = now;
        clock += dt * speed;
        const p0 = performance.now();
        render();
        if (perf) { perf.n++; perf.ms += performance.now() - p0; window.__linePerf = perf; }
        raf = requestAnimationFrame(frame);
      }

      layout();
      if (sheet) {
        renderSheet();
      } else if (reduce) {
        // a long finished stretch, still
        const picks = [C.vTime[2] - 0.4, C.vTime[3] - 0.4, C.Tc - 0.4];
        clock = picks[api.seed % picks.length];
        restamp(clock);
        render();
      } else {
        if (clock > 0) restamp(clock);
        render();
        raf = requestAnimationFrame(frame);
      }
      api.ready();
      if (!sheet && !reduce) {
        // also log cycle length in debug
        if (params.has('line_info')) {
          let lo = 9, hi = -9, tlo = 0, thi = 0, vmax = 0, prev = camAt(0);
          for (let t = 0; t < 2 * C.Tc; t += 0.05) {
            const fr = (penXAt(t) - camAt(t)) / visW;
            if (fr < lo) { lo = fr; tlo = t; } if (fr > hi) { hi = fr; thi = t; }
            const c = camAt(t); vmax = Math.max(vmax, Math.abs(c - prev) / 0.05 * S); prev = c;
          }
          console.warn('cycle', C.Tc.toFixed(1), 's', C.Wc, 'u; pen fraction', lo.toFixed(2), '@', tlo.toFixed(1), hi.toFixed(2), '@', thi.toFixed(1), 'max cam px/s', vmax.toFixed(0));
        }
      }

      let rt = 0;
      const ro = new ResizeObserver(function () {
        clearTimeout(rt);
        rt = setTimeout(function () {
          if (!alive) return;
          const w = el.clientWidth, h = el.clientHeight;
          if (Math.abs(w - W) < 2 && Math.abs(h - H) < 2) return;
          layout();
          if (sheet) { renderSheet(); return; }
          restamp(Math.max(0, clock));
          render();
        }, 120);
      });
      ro.observe(el);

      return {
        destroy: function () {
          alive = false;
          cancelAnimationFrame(raf);
          clearTimeout(rt);
          ro.disconnect();
          tiles.forEach(function (t) { t.c.width = 1; });
          tiles.clear();
        },
      };
    },
  });
})();
