// Original character: a laughing kid with a red knitted scarf, on a windy hilltop.
'use strict';

const Kid = (() => {
  const { S, rnd, srnd, noise1, push, pop, translate, rotate, scale } = E;
  const TAU = Math.PI * 2;

  // palette (one flat tone + one crisp shadow tone per colour)
  const C = {
    skin: '#fdd8b6', skinS: '#dc9ea8',
    tee: '#f8f4eb', teeS: '#c6c2e2',
    pants: '#f3b330', pantsS: '#cf7f35',
    scarf: '#e8452f', scarfS: '#a8283e', scarfL: '#ff7a5a',
    hair: '#5b3328', hairS: '#36191d', hairL: '#a06a58',
    mouth: '#6b1828', tongue: '#f26b72', tongueS: '#c94a62',
    teeth: '#fffbf2', teethS: '#cfcbe6',
    blush: 'rgba(255,120,130,0.45)',
    grass: '#5fbf4c', grassS: '#3f9a5a', grassL: '#9ee070',
  };
  const LW = 6.4;

  // ---------- helpers ----------
  function part(pts, base, o = {}) {
    const poly = E.shape(pts, o.boil);
    E.fill(poly, base);
    if (o.shift || o.shadow || o.inside) {
      E.clipTo(poly, () => {
        if (o.shift) {
          E.fill(poly, o.shade);
          E.fill(poly.map((p) => [p[0] + o.shift[0], p[1] + o.shift[1]]), base);
        }
        if (o.shadow) for (const s of o.shadow) E.fill(E.shape(s, 1.2), o.shade);
        if (o.inside) o.inside(poly);
      });
    }
    if (o.ink !== false) E.outline(poly, Object.assign({ w: o.w ?? LW, joint: 0.6 }, o.inkO));
    return poly;
  }
  const ln = (pts, w = 3.2, o = {}) => E.line(pts, Object.assign({ w, t0: 14, t1: 14, min: 0.06 }, o));

  // comic-style hatch ticks
  function hatch(x, y, n, len, ang, gap, color = E.INK, w = 1.9) {
    for (let i = 0; i < n; i++) {
      const ox = x + i * gap * Math.cos(ang + 1.57), oy = y + i * gap * Math.sin(ang + 1.57);
      const L = len * (0.7 + 0.3 * Math.sin(i * 2.1));
      ln([[ox, oy], [ox + Math.cos(ang) * L, oy + Math.sin(ang) * L]], w, { color, t0: L * 0.4, t1: L * 0.4, over: 1 });
    }
  }

  // thick limb outline around a joint chain
  function limb(J, Wd, capR = 1) {
    const L = [], R = [];
    for (let i = 0; i < J.length; i++) {
      const a = J[Math.max(0, i - 1)], b = J[Math.min(J.length - 1, i + 1)];
      let tx = b[0] - a[0], ty = b[1] - a[1]; const l = Math.hypot(tx, ty); tx /= l; ty /= l;
      L.push([J[i][0] - ty * Wd[i] / 2, J[i][1] + tx * Wd[i] / 2]);
      R.push([J[i][0] + ty * Wd[i] / 2, J[i][1] - tx * Wd[i] / 2]);
    }
    const n = J.length - 1;
    const e = J[n], p = J[n - 1];
    let tx = e[0] - p[0], ty = e[1] - p[1]; const l = Math.hypot(tx, ty); tx /= l; ty /= l;
    const cap = [e[0] + tx * Wd[n] * 0.45 * capR, e[1] + ty * Wd[n] * 0.45 * capR];
    return [...L, cap, ...R.reverse()];
  }

  // ---------- animation state ----------
  let A = {};
  function anim(t) {
    const beat = 3 * t;                          // three "ha!" beats per loop
    const bounce = 0.5 - 0.5 * Math.cos(TAU * beat);
    const kick = Math.max(0, Math.sin(TAU * beat - 0.6)); // sharp rise
    const sq = Math.sin(TAU * beat);             // squash(-)/stretch(+)
    A = {
      t, beat, bounce, kick, sq,
      lean: 0.05 + 0.02 * Math.sin(TAU * t),
      sb: 11 * bounce,                           // shoulder lift
      tilt: 0.1 + 0.04 * Math.sin(TAU * t + 0.5) + 0.12 * kick,
      open: 1.05 + 0.15 * sq,
      wind: (k, ph = 0) => Math.sin(TAU * (k * t) + ph),
    };
  }

  // ---------- body parts ----------
  function legs() {
    const L = [[-95, 120], [-100, 210], [-104, 320]];
    const R = [[100, 120], [108, 210], [114, 320]];
    for (const J of [L, R]) part(limb(J, [74, 66, 62], 0), C.skin, { shift: [-14, -4], shade: C.skinS, w: LW * 0.9 });
  }

  function shorts() {
    const f = A.wind(2, 1) * 5;
    const pts = [
      [-165, -28, 1], [-80, -44], [0, -50], [85, -44], [168, -26, 1],
      [184, 50], [196 + f, 132, 1], [130, 146], [56, 142, 1], [14, 96, 1],
      [-30, 142, 1], [-110, 148], [-186 + f * 0.5, 128, 1], [-178, 50],
    ];
    part(pts, C.pants, {
      shade: C.pantsS,
      shadow: [
        [[60, -40], [170, -30], [190, 140], [150, 146], [110, 60]],
        [[-40, 60], [12, 92], [-28, 140], [-80, 145], [-60, 100]],
      ],
      inside: () => {
        ln([[-150, 20], [-110, 30]], 3, { color: C.pantsS });
        ln([[10, 0], [14, 60], [10, 92]], 3, { color: '#a0602c' });
        hatch(120, 30, 4, 26, -1.1, 11, '#a0602c');
      },
    });
    // waistband ∩ (low camera: horizontal rings arc upward)
    ln([[-162, -5], [-80, -20], [0, -25], [85, -20], [166, -4]], 3.4);
  }

  function tee() {
    const sb = A.sb, fl = A.wind(2, 0.3) * 12, fl2 = A.wind(2, 1.2) * 8, rip = A.wind(2, 2.2) * 8;
    const pts = [
      [-80, -304 - sb], [-150, -296 - sb, 1], [-176, -215], [-160, -130], [-170, -40], [-186, -2, 1],
      [-120, -26], [-40, -40], [40, -38], [110, -22], [192 + fl, 10 + fl2, 1], [176 + rip, -24], [190 + rip * 0.5, -44],
      [208 + fl * 0.6, -80], [182, -128], [194, -214], [166, -278 - sb, 1], [80, -304 - sb],
    ];
    part(pts, C.tee, {
      shade: C.teeS,
      shadow: [
        [[60, -300 - sb], [168, -284 - sb], [192, -210], [180, -120], [204 + fl * 0.6, -66], [196 + fl, 4], [100, -12], [128, -90, 1], [92, -160], [120, -240]],
        [[-184, -14], [-120, -56], [-50, -34], [-110, -26]],
        [[-30, -250], [24, -190], [6, -120, 1], [-14, -186]],
      ],
      inside: () => {
        ln([[-122, -216], [-96, -150], [-104, -80]], 3, { color: '#9e9ac4' });
        ln([[50, -120], [96, -62], [152, -30]], 3, { color: '#9e9ac4' });
        ln([[-70, -120], [-40, -70]], 2.6, { color: '#9e9ac4' });
        ln([[120, -60], [170, -40]], 2.6, { color: '#9e9ac4' });
        hatch(130, -150, 4, 22, 0.9, 10, '#9e9ac4');
      },
    });
  }

  function sleeve(side) {
    const sb = A.sb;
    if (side < 0) {
      const pts = limb([[-128, -282 - sb], [-196, -368 - sb], [-222, -410 - sb]], [124, 112, 104], 0);
      part(pts, C.tee, { shade: C.teeS, shift: [-6, -18], w: LW });
    } else {
      const f = A.wind(2, 2) * 5;
      const pts = limb([[132, -276 - sb], [204, -222 - sb], [238 + f, -192 - sb * 0.6 + f]], [118, 108, 100], 0);
      part(pts, C.tee, { shade: C.teeS, shift: [-14, -10] });
    }
  }

  function raisedArm() {
    const sb = A.sb, w = A.kick * 16;
    const J = [[-170, -320 - sb], [-276, -462 - sb - w * 0.4], [-376, -620 - sb - w], [-398, -664 - sb - w]];
    part(limb(J, [84, 70, 62, 60]), C.skin, { shift: [-12, -6], shade: C.skinS, w: LW * 0.95 });
    ln([[-298, -466 - sb], [-282, -458 - sb - w * 0.4], [-272, -470 - sb]], 2.6, { color: '#b8707a' });
    fist(-414, -704 - sb - w, -2.05, 1.25);
  }

  function hipArm() {
    const sb = A.sb;
    const J = [[170, -250 - sb], [258, -170 - sb * 0.5], [296, -110], [232, -40], [196, -20]];
    part(limb(J, [74, 66, 66, 58, 56], 0.6), C.skin, { shift: [-8, -10], shade: C.skinS, w: LW * 0.95 });
    ln([[278, -122], [292, -112], [287, -98]], 2.6, { color: '#b8707a' });
  }

  function fist(x, y, rot, s) {
    push(); translate(x, y); rotate(rot); scale(s);
    const pts = [[-40, -30], [0, -42], [38, -36], [52, 0], [42, 34], [0, 42], [-40, 32], [-50, 0]];
    part(pts, C.skin, { shift: [-6, -8], shade: C.skinS, w: LW * 0.8 });
    ln([[18, -38], [24, -10], [18, 16]], 2.6);
    ln([[36, -26], [42, 0], [36, 24]], 2.2);
    ln([[-32, 8], [-6, 14], [26, 6]], 2.8);
    pop();
  }

  function neck() {
    const sb = A.sb;
    part([[-52, -290 - sb], [-56, -400 - sb], [56, -400 - sb], [54, -290 - sb]], C.skinS, { w: LW * 0.9 });
  }

  // ---------- scarf ----------
  function scarfWrap() {
    const sb = A.sb + 3 * A.bounce;
    const y = -sb;
    // back roll (upper), then front roll (lower, nearer camera) — both arc upward (∩)
    const back = [[-150, -330 + y], [-156, -372 + y], [-96, -412 + y], [0, -428 + y], [96, -414 + y], [158, -376 + y], [160, -336 + y], [0, -360 + y]];
    part(back, C.scarf, {
      shade: C.scarfS, shift: [-6, -16],
      inside: () => { for (let i = -6; i <= 6; i++) ln([[i * 22, -390 + y - (6 - Math.abs(i)) * 2.4], [i * 22 + 4, -372 + y - (6 - Math.abs(i)) * 2]], 2, { color: C.scarfS, t0: 4, t1: 4 }); },
      w: LW,
    });
    const front = [[-170, -274 + y, 1], [-178, -318 + y], [-120, -358 + y], [-40, -376 + y], [50, -374 + y], [120, -354 + y], [168, -322 + y],
      [186, -288 + y, 1], [140, -270 + y], [90, -256 + y], [30, -262 + y], [-30, -250 + y], [-92, -262 + y], [-140, -256 + y]];
    part(front, C.scarf, {
      shade: C.scarfS,
      shadow: [
        [[-30, -254 + y], [30, -264 + y], [90, -258 + y], [186, -288 + y], [176, -310 + y], [80, -298 + y], [-20, -290 + y, 1], [20, -280 + y]],
        [[40, -330 + y], [168, -322 + y], [176, -310 + y], [90, -318 + y]],
        [[-170, -276 + y], [-178, -316 + y], [-140, -300 + y], [-120, -262 + y]],
      ],
      inside: () => {
        // rib knit ticks following the roll
        for (let i = -7; i <= 7; i++) {
          const x = i * 22, top = -360 + Math.abs(i) * Math.abs(i) * 0.9;
          ln([[x, top + 22 + y], [x + 3, top + 46 + y]], 2.2, { color: '#a52a3a', t0: 5, t1: 5 });
        }
        for (const [hx, hy] of [[-120, -344], [-40, -362], [60, -360]]) ln([[hx, hy + y], [hx + 22, hy - 3 + y]], 3.2, { color: C.scarfL, t0: 6, t1: 6 });
      },
      w: LW * 1.05,
    });
    // creases converging on the knot
    ln([[-156, -304 + y], [-60, -326 + y], [50, -330 + y], [160, -306 + y]], 3.2, { t0: 30, t1: 10 });
    ln([[-100, -276 + y], [0, -290 + y], [100, -296 + y], [166, -292 + y]], 2.6, { t0: 30, t1: 8 });
    // the knot
    part(E.ell(176, -300 + y, 44, 38, 9, 0.4, 0.1, 5), C.scarf, {
      shade: C.scarfS, shift: [-8, -12],
      inside: () => ln([[150, -310 + y], [176, -296 + y], [196, -270 + y]], 2.6),
      w: LW,
    });
  }

  // ribbon tail; root in local coords; travelling wave along its length
  function scarfTail(root, a0, len, wid, waveAmp, k, m, ph, fringe = true) {
    const N = 28, spine = [];
    let x = root[0], y = root[1];
    const step = len / N;
    for (let i = 0; i <= N; i++) {
      const s = i / N;
      spine.push([x, y, s]);
      const th = a0 + waveAmp * (0.25 + s) * Math.sin(TAU * (k * s - m * A.t) + ph) + 0.25 * s * s;
      x += Math.cos(th) * step; y += Math.sin(th) * step;
    }
    const top = [], bot = [], twist = [];
    for (let i = 0; i <= N; i++) {
      const p = spine[i], q = spine[Math.min(N, i + 1)], r = spine[Math.max(0, i - 1)];
      let tx = q[0] - r[0], ty = q[1] - r[1]; const l = Math.hypot(tx, ty); tx /= l; ty /= l;
      const s = p[2];
      const tw = Math.cos(TAU * (k * s - m * A.t) + ph + 0.9);
      twist.push(tw);
      const w = wid * (1 - 0.18 * s) * (0.72 + 0.28 * Math.abs(tw) + 0.0);
      top.push([p[0] + ty * w / 2, p[1] - tx * w / 2]);
      bot.push([p[0] - ty * w / 2, p[1] + tx * w / 2]);
    }
    const W_ = (p) => E.xf(p);
    for (let i = 0; i <= N; i++) { top[i] = W_(top[i]); bot[i] = W_(bot[i]); spine[i] = [...W_(spine[i]).slice(0, 2), spine[i][2]]; }
    E.push(); E.S.M = [1, 0, 0, 1, 0, 0];
    const poly = E.shape([...top.filter((_, i) => i % 2 === 0), ...bot.filter((_, i) => i % 2 === 0).reverse()].map((p, i, arr) => (i === 0 || i === arr.length - 1 || i === Math.floor(arr.length / 2) || i === Math.floor(arr.length / 2) - 1) ? [p[0], p[1], 1] : p), 1.4);
    E.fill(poly, C.scarf);
    E.clipTo(poly, () => {
      // shadow bands where the ribbon faces away
      for (let i = 0; i < N; i++) {
        if (twist[i] < -0.15 || twist[i + 1] < -0.15) {
          const j = Math.min(N - 1, i + 2);
          E.fill([top[j], top[Math.min(N, j + 1)], bot[i + 1], bot[i]].map((p) => [p[0], p[1]]), C.scarfS, false);
        }
      }
      // lower-edge shadow strip
      const strip = [...bot.map((p, i) => [p[0] * 0.7 + spine[i][0] * 0.3, p[1] * 0.7 + spine[i][1] * 0.3]), ...bot.slice().reverse().map((p) => [p[0], p[1] + 10])];
      E.fill(strip, C.scarfS, false);
      // knit ribs across the ribbon
      for (let i = 2; i < N; i += 2) {
        const a = top[i], b = bot[i];
        E.brushPoly([[a[0] * 0.85 + b[0] * 0.15, a[1] * 0.85 + b[1] * 0.15], [a[0] * 0.15 + b[0] * 0.85, a[1] * 0.15 + b[1] * 0.85]], { w: 2.2, color: twist[i] < -0.15 ? '#7d1c32' : C.scarfS, t0: 6, t1: 6, min: 0.1 });
      }
    });
    E.outline(poly, { w: LW * 0.95, pieces: 3, joint: 0.8 });
    if (fringe) {
      const e0 = top[N], e1 = bot[N], sp = spine[N], pr = spine[N - 1];
      let dx = sp[0] - pr[0], dy = sp[1] - pr[1]; const l = Math.hypot(dx, dy); dx /= l; dy /= l;
      for (let j = 0; j < 6; j++) {
        const u = (j + 0.5) / 6;
        const bx = e0[0] * (1 - u) + e1[0] * u, by = e0[1] * (1 - u) + e1[1] * u;
        const fl = Math.sin(TAU * (2 * A.t) + j * 1.3) * 0.5;
        const L = 34 + 14 * rnd(j, 3);
        const ang = Math.atan2(dy, dx) + fl * 0.6 + (u - 0.5) * 0.5;
        const mid = [bx + Math.cos(ang - fl * 0.5) * L * 0.5, by + Math.sin(ang - fl * 0.5) * L * 0.5];
        const end = [bx + Math.cos(ang) * L, by + Math.sin(ang) * L];
        const strand = [[bx - dx * 4, by - dy * 4], mid, end];
        const P = E.spline(strand.map((p, i) => [p[0] + srnd(S.draw, j, i, 77) * 1.2, p[1] + srnd(S.draw, j, i, 78) * 1.2]), false, 3);
        E.brushPoly(P, { w: 13, t0: 2, t1: 14, min: 0.3, color: E.INK, press: 0 });
        E.brushPoly(P, { w: 7, t0: 2, t1: 12, min: 0.2, color: C.scarf, press: 0 });
      }
    }
    E.pop();
  }

  // ---------- head ----------
  function head() {
    const o = A.open;
    // squash & stretch on the laugh beat
    scale(1.25 * (1 - 0.025 * A.sq), 1.25 * (1 + 0.035 * A.sq));

    const headPts = [
      [0, -196], [100, -172], [176, -96], [196, 0], [178, 80], [134, 132], [60, 168], [-30, 190],
      [-92, 196], [-136, 178], [-176, 128], [-204, 64], [-196, -14], [-186, -92], [-140, -162], [-74, -192],
    ];
    const hairFringe = hairPts();
    part(headPts, C.skin, {
      shade: C.skinS,
      shadow: [
        // under-jaw + back of head shadow, with a sharp anime terminator
        [[196, -10], [178, 80], [134, 132], [60, 168], [-30, 190], [-92, 196], [-60, 184, 1], [10, 164], [80, 128], [112, 70, 1], [140, 40], [150, -40]],
        // hair cast shadow on forehead
        hairFringe.shadow,
      ],
      inside: () => {
        // blush with comic hatch ticks
        for (const [bx, by, r] of [[-12, 14, 34], [-170, 8, 22]]) {
          const b = E.shape(E.ell(bx, by, r * 1.15, r * 0.6, 8), 1);
          E.fill(b, C.blush, false);
          for (let i = -1; i <= 1; i++) ln([[bx + i * r * 0.5 - 4, by + 6], [bx + i * r * 0.5 + 6, by - 8]], 2, { color: '#d9667a', t0: 4, t1: 4 });
        }
      },
      w: LW * 1.05,
    });

    // closed laughing eyes (^ ^), thick in the middle
    ln([[-62, -26], [-38, -56], [-8, -62], [18, -40]], 6.5, { t0: 18, t1: 12, min: 0.12 });
    ln([[16, -42], [26, -34]], 3, { t0: 4, t1: 8 });
    ln([[-176, -30], [-154, -54], [-128, -52], [-114, -34]], 5.5, { t0: 12, t1: 12 });
    // smile creases under the eyes
    ln([[-50, -14], [-22, -22], [4, -16]], 2.2, { color: '#b86d78' });
    // brows lifted
    ln([[-72, -96], [-38, -116], [4, -108]], 5.2, { t0: 8, t1: 16 });
    ln([[-182, -90], [-156, -108], [-130, -102]], 4.6, { t0: 8, t1: 14 });
    // nose (small upturned)
    ln([[-92, -14], [-112, 22], [-98, 32], [-80, 28]], 3.6, { t0: 6, t1: 10 });
    // freckles
    for (const [fx, fy] of [[-60, 6], [-44, 16], [-62, 22], [-138, 10], [-150, 22]]) {
      const fp = E.shape(E.ell(fx, fy, 3, 2.4, 5), 0.5); E.fill(fp, '#c97a70', false);
    }

    // big toothy grin
    const mo = (y) => 48 + (y - 48) * o;
    const mouthPts = [
      [-164, 46, 1], [-120, 60], [-50, 66], [10, 58], [44, 40, 1],
      [36, mo(92)], [0, mo(136)], [-60, mo(160)], [-118, mo(140)], [-156, mo(94)],
    ];
    const mpoly = E.shape(mouthPts);
    E.fill(mpoly, C.mouth);
    E.clipTo(mpoly, () => {
      // tongue
      const tg = E.shape(E.ell(-56, mo(122), 66, 30 * o, 10, 0.05), 1.2);
      E.fill(tg, C.tongue);
      E.clipTo(tg, () => { E.fill(E.shape(E.ell(-20, mo(138), 60, 26, 8)), C.tongueS); E.fill(E.shape([[-90, mo(108)], [-70, mo(102)], [-62, mo(110)], [-84, mo(114)]], 0.5), '#ffb0b0', false); });
      E.outline(tg, { w: 2.4, pieces: 1 });
      // chunky rounded teeth (comic style): upper row along the lip, lower row from the jaw
      const lipY = (x) => 46 + 20 * Math.sin(Math.PI * (x + 164) / 208);
      const upper = [[-142, 30, 28], [-104, 40, 36], [-58, 48, 44], [-10, 46, 42], [28, 32, 30]];
      upper.forEach(([cx, wd, h], i) => {
        const y0 = lipY(cx) - 14, yb = lipY(cx) + h;
        const tp = [[cx - wd / 2, y0, 1], [cx + wd / 2, y0, 1], [cx + wd / 2 + 1, yb - wd * 0.3], [cx + wd * 0.3, yb], [cx - wd * 0.3, yb + 1], [cx - wd / 2 - 1, yb - wd * 0.3]];
        const tpoly = E.shape(tp, 0.8);
        E.fill(tpoly, C.teeth);
        E.clipTo(tpoly, () => E.fill(tpoly.map((p) => [p[0] - 7, p[1] - 9]).map((p, k, arr) => arr[k]), C.teeth));
        E.clipTo(tpoly, () => E.fill(E.shape([[cx + wd * 0.18, y0], [cx + wd, y0], [cx + wd, yb + 4], [cx + wd * 0.1, yb + 4], [cx + wd * 0.3, yb - h * 0.5]], 0.6), C.teethS, false));
        E.outline(tpoly, { w: 2.4, pieces: 1, t0: 8, t1: 8 });
      });
      const MB = [[44, 40], [36, 92], [0, 136], [-60, 160], [-118, 140], [-156, 94], [-164, 46]];
      const lowY = (x) => {
        for (let i = 0; i < MB.length - 1; i++) {
          const [x0, y0] = MB[i], [x1, y1] = MB[i + 1];
          if (x <= x0 && x >= x1) return mo(y0 + (y1 - y0) * (x0 - x) / (x0 - x1)) - 4;
        }
        return mo(100);
      };
      const lower = [[-118, 30, 20], [-80, 36, 24], [-40, 38, 24], [0, 32, 19]];
      lower.forEach(([cx, wd, h]) => {
        const y0 = lowY(cx) + 14, yt = lowY(cx) - h;
        const tp = [[cx - wd / 2, y0, 1], [cx - wd / 2 - 1, yt + wd * 0.3], [cx - wd * 0.25, yt], [cx + wd * 0.3, yt + 1], [cx + wd / 2, yt + wd * 0.3], [cx + wd / 2, y0, 1]];
        const tpoly = E.shape(tp, 0.8);
        E.fill(tpoly, C.teeth);
        E.clipTo(tpoly, () => E.fill(E.shape([[cx + wd * 0.1, yt + h * 0.3], [cx + wd, yt], [cx + wd, y0 + 4], [cx - wd, y0 + 4], [cx - wd, yt + h * 0.75]], 0.6), C.teethS, false));
        E.outline(tpoly, { w: 2.2, pieces: 1, t0: 8, t1: 8 });
      });
    });
    E.outline(mpoly, { w: LW * 0.95, pieces: 2, joint: 1.2 });
    // grin corner creases (cheeks pushed up)
    ln([[50, 22], [60, 42], [52, 62]], 3.2);
    ln([[-170, 30], [-180, 50], [-172, 70]], 2.6);
    hatch(96, 118, 4, 22, -0.9, 9, '#a85e6e');
    hatch(-60, 182, 3, 16, -0.5, 9, '#a85e6e');
    // chin crease under lip
    ln([[-90, mo(178)], [-60, mo(184)], [-30, mo(178)]], 2.4, { color: '#b86d78' });

    // hair over skull
    drawHair(hairFringe);
    // ear
    part([[100, -18], [146, -30], [170, 10], [158, 58], [112, 66]], C.skin, {
      shift: [-8, -8], shade: C.skinS,
      inside: () => ln([[140, 0], [150, 22], [130, 44]], 3, { color: '#a85e6e' }),
      w: LW * 0.9,
    });
  }

  function hairPts() {
    const pts = [
      [-198, -46, 1], [-180, -130], [-130, -188], [-40, -224], [52, -230], [132, -206], [188, -150], [208, -60], [202, 30], [172, 100], [150, 120, 1],
      [118, 70], [98, -24],
      [66, -70], [40, -50, 1], [12, -92], [-26, -68, 1], [-62, -108], [-102, -82, 1], [-130, -114], [-162, -78, 1],
    ];
    const shadow = [[98, -24], [66, -56], [40, -34], [12, -76], [-26, -52], [-62, -92], [-102, -66], [-130, -98], [-172, -58], [-204, -36], [-204, -220], [120, -220]];
    return { pts, shadow };
  }

  // a tapered, curling lock of hair blown by the wind
  function clump(rx, ry, dir, L, W, curl, i, sideBias = 0.5) {
    const fl = 0.13 * A.wind(2, i * 1.3) + 0.05 * A.wind(4, i * 0.6);
    const n = 5, sp = [];
    let x = rx, y = ry, th = dir + fl * 0.4;
    for (let k = 0; k <= n; k++) {
      const s = k / n;
      sp.push([x, y]);
      th += (curl * (2.6 * s - 0.5) + fl * 1.2) / n;
      x += Math.cos(th) * L / n; y += Math.sin(th) * L / n;
    }
    const Lf = [], Rf = [];
    for (let k = 0; k <= n; k++) {
      const s = k / n;
      const a = sp[Math.max(0, k - 1)], b = sp[Math.min(n, k + 1)];
      let tx = b[0] - a[0], ty = b[1] - a[1]; const l = Math.hypot(tx, ty); tx /= l; ty /= l;
      const w = W * Math.pow(1 - s, 1.1) * (1 + 0.5 * Math.sin(s * Math.PI * 1.1));
      Lf.push([sp[k][0] - ty * w * sideBias, sp[k][1] + tx * w * sideBias]);
      Rf.push([sp[k][0] + ty * w * (1 - sideBias), sp[k][1] - tx * w * (1 - sideBias)]);
    }
    const pts = [[...Lf[0], 1], ...Lf.slice(1, n), [...sp[n], 1], ...Rf.slice(1, n).reverse(), [...Rf[0], 1]];
    part(pts, C.hair, { shade: C.hairS, shift: [-5, -11], w: LW * 0.85, inkO: { pieces: 1, t0: 14, t1: 6 } });
  }

  const BACK_LOCKS = [
    // rx, ry, dir, L, W, curl (+ curls clockwise / down, - curls up)
    [-40, -210, -1.5, 100, 60, 1.5],
    [40, -220, -0.95, 150, 72, 1.3],
    [120, -196, -0.5, 190, 80, -0.9],
    [170, -134, -0.25, 170, 76, 1.1],
    [198, -56, 0.0, 170, 70, -0.9],
    [194, 24, 0.28, 140, 60, 1.0],
    [160, 94, 0.6, 96, 46, -1.0],
  ];
  const FRONT_LOCKS = [
    [-140, -116, -0.75, 96, 30, 1.2],
    [-56, -134, -0.5, 120, 34, 1.0],
    [36, -128, -0.35, 120, 32, -0.6],
  ];

  function drawHair(h) {
    BACK_LOCKS.forEach((c, i) => clump(...c, i));
    part(h.pts, C.hair, {
      shade: C.hairS,
      shadow: [[[150, -150], [208, -60], [202, 30], [172, 100], [150, 120], [118, 70], [98, -24], [140, -60]]],
      inside: () => {
        ln([[-120, -150], [-30, -186], [70, -186], [170, -140]], 2.4, { color: C.hairS });
      },
      w: LW * 1.1,
      inkO: { pieces: 3 },
    });
    // fringe strand flicks lifted by the wind
    const ff = A.wind(2, 1.7) * 6;
    ln([[-150, -96], [-120, -140], [-70, -160 + ff]], 3, { t0: 4, t1: 18 });
    ln([[-40, -110], [0, -150], [60, -160 + ff]], 3, { t0: 4, t1: 18 });
    ln([[50, -90], [96, -126], [150, -128 + ff]], 2.6, { t0: 4, t1: 16 });
    // tiny highlight shapes
    for (const [x, y, r, a] of [[-96, -158, 30, -0.5], [-40, -184, 34, -0.25], [20, -194, 26, -0.08], [80, -186, 20, 0.12]]) {
      const c = Math.cos(a), s2 = Math.sin(a);
      E.fill(E.shape([[x - r * c, y - r * s2, 1], [x + 5 * s2, y - 5 * c], [x + r * c, y + r * s2, 1], [x - 3 * s2, y + 3 * c]], 0.8), C.hairL, false);
    }
    const f = A.wind(2, 0.4) * 10;
    ln([[200, -200], [276, -236 + f], [330, -222 + f]], 3.2, { t0: 4, t1: 22 });
    ln([[214, 20], [276, 8 + f * 0.6], [320, 24 + f]], 3, { t0: 4, t1: 20 });
  }

  // ---------- ground ----------
  const crest = (x) => 1968 + 0.00012 * (x - 520) ** 2 + 8 * Math.sin(x / 170 + 1);
  const clumps = [];
  for (let i = 0; i < 34; i++) {
    const x = -30 + i * 34 + srnd(90, i) * 12;
    const near = x > 380 && x < 760;
    const nb = 3 + Math.floor(rnd(97, i) * 3);
    const bl = [];
    for (let k = 0; k < nb; k++) bl.push({
      dx: (k - nb / 2) * 7, h: (45 + 80 * rnd(91, i, k) ** 1.4) * (near ? 1.35 : 1), w: 12 + 8 * rnd(92, i, k),
      lean: -0.35 + 0.7 * (k / (nb - 1)) + 0.3, col: rnd(96, i, k), ink: rnd(94, i, k) < 0.55,
    });
    clumps.push({ x, bl });
  }
  const flowers = [[150, 0.6, 1], [300, 0.85, 0], [800, 0.8, 1], [930, 1.0, 0], [1010, 0.7, 1], [60, 0.75, 0]];
  const sway = (x, ph = 0) => 0.2 * Math.sin(TAU * 2 * A.t - x / 150 + ph) + 0.06 * Math.sin(TAU * 4 * A.t - x / 60);

  function blade(bx, by, h, w, ang, col, ink, inkW = 3) {
    const tip = [bx + Math.sin(ang) * h, by - Math.cos(ang) * h];
    const mid = [bx + Math.sin(ang * 0.45) * h * 0.5, by - Math.cos(ang * 0.45) * h * 0.5];
    const pts = [[bx - w / 2, by + 8], [mid[0] - w * 0.32, mid[1]], [tip[0], tip[1], 1], [mid[0] + w * 0.3, mid[1] + 4], [bx + w / 2, by + 8]];
    part(pts, col, { ink, w: inkW, inkO: { pieces: 1, t0: 12, t1: 12 } });
  }

  function ground(t) {
    S.sid = 200000;
    const hill = [[-40, crest(-40)]];
    for (let x = 40; x <= 1120; x += 80) hill.push([x, crest(x)]);
    hill.push([1120, 2240, 1], [-40, 2240, 1]);
    // tufted cel terminator
    const term = [[-40, 2240], [-40, 2070]];
    for (let x = -40; x <= 1120; x += 36) {
      const y = crest(x) + 96 + 14 * Math.sin(x / 90);
      term.push([x, y]); term.push([x + 14, y - 26 - 14 * rnd(60, x), 1]); term.push([x + 22, y + 2]);
    }
    term.push([1120, 2240]);
    part(hill, C.grass, { shade: C.grassS, shadow: [term], ink: false });
    // crest ink
    for (let k = 0; k < 4; k++) {
      const x0 = -40 + k * 290, pts = [];
      for (let x = x0; x <= x0 + 310; x += 50) pts.push([x, crest(x) + 4]);
      ln(pts, 5.2, { t0: 40, t1: 40 });
    }
    // grass clumps
    clumps.forEach((c, i) => {
      const by = crest(c.x) + 12;
      for (const b of c.bl) {
        const col = b.col < 0.3 ? C.grassL : b.col < 0.75 ? C.grass : C.grassS;
        blade(c.x + b.dx, by, b.h, b.w, b.lean + sway(c.x, i), col, b.ink);
      }
    });
    // flowers
    flowers.forEach(([x, sc, kind], i) => {
      const by = crest(x) + 8;
      const sw = 1.3 * sway(x, i) + 0.3;
      const L = 130 * sc;
      const top = [x + Math.sin(sw) * L, by - Math.cos(sw) * L];
      ln([[x, by + 10], [x + Math.sin(sw * 0.5) * L * 0.5, by - L * 0.5], top], 4.2, { color: '#2f6a3a', t0: 4, t1: 4 });
      push(); translate(top[0], top[1]); rotate(sw * 0.8); scale(sc);
      const petals = kind ? '#fffaf0' : '#ffd23a', pS = kind ? '#cbc7e6' : '#e09a2a';
      for (let k = 0; k < 6; k++) {
        push(); rotate(k / 6 * TAU + 0.3);
        part([[0, -6], [34, -12], [44, 0, 1], [34, 12], [0, 6]], petals, { shift: [-2, -3], shade: pS, w: 2.6, inkO: { pieces: 1 } });
        pop();
      }
      part(E.ell(0, 0, 13, 11, 8), kind ? '#ffc02a' : '#e86a2a', { w: 2.6, shift: [-2, -3], shade: kind ? '#e08a20' : '#b04a2a', inkO: { pieces: 1 } });
      pop();
    });
    // huge foreground blades at the frame corners (low camera, near grass)
    const fg = [[-20, 2200, 230, 84, 0.5], [50, 2210, 170, 60, 0.75], [1010, 2210, 280, 80, 0.15], [1090, 2200, 360, 90, -0.05], [940, 2220, 170, 56, 0.55]];
    fg.forEach(([x, y, h, w, l], i) => blade(x, y, h, w, l + 0.8 * sway(x, i), i % 2 ? C.grassS : '#2f8050', true, 5));
  }

  // ---------- assemble ----------
  function draw(t) {
    anim(t);
    S.sid = 100000;
    push();
    translate(515, 1800 - 5 * A.bounce);
    scale(0.9);
    rotate(A.lean);
    scale(1 + 0.012 * A.sq, 1 - 0.015 * A.sq);

    // long scarf tail behind everything (from the knot at the back of the neck)
    S.sid = 110000;
    scarfTail([170, -320 - A.sb], -0.3, 560, 90, 0.6, 1.1, 2, 0);
    S.sid = 115000;
    scarfTail([168, -296 - A.sb], 0.16, 320, 76, 0.7, 1.0, 2, 2.4);

    S.sid = 120000;
    legs();
    shorts();
    raisedArm();
    hipArm();
    tee();
    sleeve(-1);
    sleeve(1);
    S.sid = 130000;
    fist(184, -12, 2.7, 1.05);
    neck();

    S.sid = 150000;
    scarfWrap();

    S.sid = 140000;
    push();
    translate(-10, -336 - A.sb - 6 * A.bounce);
    rotate(A.tilt);
    translate(-60, -262);
    head();
    pop();
    pop();

    ground(t);
  }

  return { draw };
})();
