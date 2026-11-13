// city.js -- the town below: everyone else's windows.
(function (G) {
  'use strict';
  const A = G.ART, hx = A.hex, M = A.MED, mix3 = A.mix3, ss = A.ss, clamp = A.clamp, mix = A.mix;
  const S = A.S, PAS = S.PAS, PEN = S.PEN, c = S.c, F = S.F, VX = S.VX, HY = S.HY, GLX = S.GLX, gs = S.gs;
  const GD = -48;                    // the streets, measured from the eye
  const AX = -45;                    // the avenue runs out of town a little to our left
  const sxw = (x, z) => VX + F * x / z, syw = (alt, z) => HY - F * alt / z;
  const haze = z => 1 - Math.exp(-z / 1500);
  const cAir = hx('#9a6aa8');
  const airCol = sx => mix3(S.skyCol(sx, 393), cAir, 0.32);
  S.airCol = airCol; S.GD = GD;
  const WARM = ['#ffd890', '#ffc070', '#fbe8a8', '#f7a84a', '#fff4c8', '#ffaa94', '#ffd890', '#ffc070'].map(hx);
  const COOL = ['#d2efcf', '#d2dff6', '#fffbe8', '#aec4ee', '#fff4c8', '#d2dff6'].map(hx);
  const NEON = ['#f06a6a', '#f283ae', '#72cdb4', '#ffc070', '#de5c98', '#4d7fd0', '#fbe8a8'].map(hx);
  const FRONT = ['#211d52', '#262058', '#1d2258', '#2a2260', '#1f1b4a', '#2c2664', '#232a66'].map(hx);
  const ROOF = ['#4a4a90', '#54509c', '#3f4488', '#5a5a9a', '#4c5aa0', '#5e5296'].map(hx);

  // the river: where its middle runs, at each x
  const zc = x => 372 + 0.12 * Math.max(0, x) + 25 * Math.sin(x / 260);
  const RW = 46;
  S.riverZ = zc;

  // a plain rectangle laid in with level strokes of a blunt stick
  function rect(C, rng, x0, y0, x1, y1, col, o) {
    o = o || {};
    if (x1 - x0 < 0.5 || y1 - y0 < 0.3) return;
    const h = y1 - y0, w = clamp(o.w || h * 0.45, 0.9, 3.4), n = Math.max(1, Math.round(h / (w * 0.62)));
    for (let k = 0; k < n; k++) {
      const y = n === 1 ? (y0 + y1) / 2 : y0 + w * 0.42 + (h - w * 0.84) * k / (n - 1);
      const ex = w * 0.35, a = x0 + ex + rng.g() * 0.4, b = x1 - ex + rng.g() * 0.4;
      if (b - a < 0.4) { A.dot(C, rng, (x0 + x1) / 2, y, o.med || M.conte, col, Math.min(w, x1 - x0), o.p || 1); continue; }
      C.stroke(A.hand(rng, k % 2 ? [b, y, a, y + rng.g() * 0.2] : [a, y, b, y + rng.g() * 0.2], { wob: 0.25, step: 4, pe: 0.75, t0: 0.08, t1: 0.08 }), o.med || M.conte, col, w, (o.p || 1.05) * rng.r(0.9, 1.1));
    }
  }
  S.rect = rect;
  const dab = (C, rng, x, y, len, w, col, med, p) => C.stroke(A.hand(rng, [x - len / 2, y, x + len / 2, y + rng.g() * 0.15], { wob: 0.1, step: 3, pe: 0.8, t0: 0.1, t1: 0.1 }), med, col, w, p || 1);
  S.dab = dab;

  // ------------------------------------------------------------------ the far town
  S.drawFar = function (C, rng) {
    const BOT = 730;
    // the air over the town: dark near, rose and straw toward the glow
    const baseCol = (x, y) => { const z = 48000 / Math.max(3, y - HY); return mix3(hx('#1c1848'), airCol(x), clamp(haze(z) * 1.05, 0, 1)); };
    A.field(C, rng, { box: [-40, 396, 1640, BOT], sp: 12, order: 'scan', col: baseCol, dir: () => 0, len: [50, 170], w: [8, 16], p: [0.85, 1.05], med: M.pastel, sticks: PAS, spread: 0.035, wob: 0.8, dj: 0.02 });
    for (let y = 400; y < BOT; y += 10) { const xy = []; for (let x = -20; x <= 1620; x += 12) xy.push(x, y + rng.g()); C.rub(rng() < 0.5 ? xy : A.rev(xy), 10, 0.45, 0.7); }
    // hills at the edge of the plain, low where the sun went down
    const range = (seed, amp, col, lift) => {
      const poly = [-20, HY + 3];
      for (let x = -20; x <= 1620; x += 5) {
        const open = 1 - 0.85 * gs((x - 640) / 330);
        const hgt = amp * open * (0.35 + 1.3 * A.fbm(x / 170, seed * 0.37, 3, seed)) * (0.7 + 0.5 * ss(700, 1500, x) + 0.35 * ss(420, 0, x));
        poly.push(x, HY - lift - hgt);
      }
      poly.push(1620, HY + 3);
      A.hatch(C, rng, poly, { ang: 0.03, gap: 1.7, med: M.pastelTip, col: (x, y) => PAS.near(mix3(col, airCol(x), 0.5 + 0.25 * gs((x - GLX) / 400)), rng, 0.03), w: 2.8, p: 1.0, over: 0.5 });
      A.hatch(C, rng, poly, { ang: -0.7, gap: 3.4, med: M.pencil, col: (x, y) => mix3(col, airCol(x), 0.3), w: 1.2, p: 0.5, over: 0.2, skip: 0.3 });
    };
    range(11, 30, hx('#5a4a9c'), 1); range(23, 15, hx('#463a86'), 0);
    C.rub([0, HY - 4, 400, HY - 5, 800, HY - 3, 1200, HY - 5, 1600, HY - 4], 5, 0.25, 0.8);
    // row upon row of roofs, each a little nearer and a little darker
    for (let z = 9500; z > 705; z /= 1.11) {
      const y0 = syw(GD, z), u = F / z, hz = haze(z);
      let x = -30 + rng.r(-10, 0);
      while (x < 1630) {
        const w = rng.r(12, 44) * u * (z > 3000 ? 2.2 : 1.2);
        if (rng() < 0.12) { x += w * 0.6; continue; }
        let hm = 5 + 20 * Math.pow(rng(), 1.8);
        if (rng() < 0.05 && z < 5000) hm = rng.r(30, 62);
        hm *= 1 + 0.5 * gs((x - VX + 30) / 220);              // the middle of town stands taller
        const hU = hm * u, air = airCol(x);
        const col = PAS.near(mix3(rng.pick(FRONT), air, clamp(hz * 0.86, 0, 0.93)), rng, 0.02);
        rect(C, rng, x, y0 - hU, x + w, y0 + 0.6, col, { med: M.pastelTip, w: Math.min(2.6, Math.max(1, hU * 0.5)) });
        if (hU > 2.2 && rng() < 0.55) A.line(C, rng, [x + 0.5, y0 - hU, x + w - 0.5, y0 - hU], M.pencil, mix3(rng.pick(ROOF), air, hz * 0.8), 0.8, 0.6, { wob: 0.1, step: 3 });
        // their lights
        const nl = Math.round(w * hU * 0.06 * rng.r(0, 2));
        for (let k = 0; k < nl; k++) {
          const lc = rng() < 0.72 ? rng.pick(WARM) : rng() < 0.75 ? rng.pick(COOL) : rng.pick(NEON);
          A.dot(C, rng, x + rng.r(0.6, w - 0.6), y0 - rng.r(0.2, hU - 0.5), rng() < 0.5 ? M.oil : M.pencil, mix3(lc, air, hz * 0.35), rng.r(0.7, 1.25) * Math.min(1.5, 0.8 + u * 0.3), 1);
        }
        if (hm > 30) A.dot(C, rng, x + w / 2, y0 - hU - 0.8, M.oil, hx('#f06a6a'), 1.3, 1);
        x += w + (rng() < 0.3 ? rng.r(0.5, 3) * u : 0);
      }
      // the haze thickens between rows
      if (z > 1500 && rng() < 0.6) { const yy = y0 - 2; C.rub([-10, yy, 400, yy + rng.g(), 800, yy, 1200, yy + rng.g(), 1610, yy], 3.5, 0.22, 0.85); }
    }
    // what stands above the skyline
    const tower = (x, z, hm, wm, kind) => {
      const u = F / z, y0 = syw(GD, z), y1 = syw(GD + hm, z), w = wm * u, air = airCol(x);
      const col = mix3(hx('#2a2466'), air, clamp(haze(z) * 0.8, 0, 0.9));
      if (kind === 'mast') {
        for (const s of [-1, 1]) A.line(C, rng, [x + s * w, y0, x + s * 0.4, y1], M.pencil, col, 1.1, 0.95, { wob: 0.15, reps: 2, off: 0.3 });
        for (let k = 0; k < 9; k++) { const t = k / 9, t2 = (k + 1) / 9, ya = mix(y0, y1, t), yb = mix(y0, y1, t2), wa = w * (1 - t) + 0.4, wb = w * (1 - t2) + 0.4; A.line(C, rng, [x - wa, ya, x + wb, yb], M.pencil, col, 0.7, 0.7, { wob: 0.1 }); A.line(C, rng, [x + wa, ya, x - wb, yb], M.pencil, col, 0.7, 0.7, { wob: 0.1 }); }
        for (const t of [0.34, 0.62]) rect(C, rng, x - w * (1 - t) - 1.2, mix(y0, y1, t) - 1.3, x + w * (1 - t) + 1.2, mix(y0, y1, t) + 1.3, col, { med: M.pencil });
        A.line(C, rng, [x, y1, x, y1 - 10], M.pencil, col, 0.8, 0.9, { wob: 0.05 });
        for (const t of [0.34, 0.62, 1]) A.dot(C, rng, x + (t < 1 ? w * (1 - t) : 0), mix(y0, y1, t) - (t === 1 ? 10 : 0), M.oil, hx('#f06a6a'), 1.6, 1);
        return;
      }
      rect(C, rng, x - w / 2, y1, x + w / 2, y0, PAS.near(col, rng, 0.02), { med: M.pastelTip, w: 2.2 });
      if (kind === 'step') rect(C, rng, x - w * 0.28, y1 - hm * u * 0.14, x + w * 0.28, y1 + 1, PAS.near(col, rng, 0.02), { med: M.pastelTip, w: 1.8 });
      A.line(C, rng, [x + w / 2, y1, x + w / 2, y0], M.pencil, mix3(col, hx('#ffc6a8'), x < GLX ? 0.5 : 0.1), 0.7, 0.6, { wob: 0.1 });
      A.line(C, rng, [x - w / 2, y1, x - w / 2, y0], M.pencil, mix3(col, hx('#ffc6a8'), x > GLX ? 0.5 : 0.1), 0.7, 0.6, { wob: 0.1 });
      const rows = Math.floor(hm * u / 2.4), cols = Math.max(1, Math.floor(w / 2.2));
      for (let r = 0; r < rows; r++) for (let q = 0; q < cols; q++) if (rng() < 0.3) A.dot(C, rng, x - w / 2 + (q + 0.5) * w / cols, y1 + (r + 0.6) * 2.4, M.pencil, mix3(rng() < 0.5 ? rng.pick(COOL) : rng.pick(WARM), air, 0.3), 0.9, 0.95);
      A.dot(C, rng, x + rng.r(-1, 1), y1 - (kind === 'step' ? hm * u * 0.14 : 0) - 1.2, M.oil, hx('#f06a6a'), 1.5, 1);
    };
    tower(468, 2600, 205, 16, 'mast');
    tower(712, 1900, 118, 22, 'step'); tower(742, 2300, 96, 26); tower(124, 2100, 104, 24, 'step'); tower(210, 3000, 120, 30);
    tower(548, 3600, 150, 26); tower(880, 2500, 110, 24, 'step'); tower(918, 3100, 128, 30); tower(1368, 2400, 92, 26); tower(40, 3400, 110, 34);
    tower(655, 4200, 150, 30, 'step'); tower(588, 5200, 170, 34);
  };

  // ------------------------------------------------------------------ one building
  function building(C, rng, b) {
    const { x0, x1, z0, z1, h } = b, g = b.g === undefined ? GD : b.g, top = g + h;
    const fx0 = sxw(x0, z0), fx1 = sxw(x1, z0), fyB = syw(g, z0), fyT = syw(top, z0);
    const rx0 = sxw(x0, z1), rx1 = sxw(x1, z1), ryT = syw(top, z1), ryB = syw(g, z1);
    const xm = (fx0 + fx1) / 2;
    if (Math.max(fx1, rx1) < -10 || Math.min(fx0, rx0) > 1610) return false;
    if (ryT > S.topYo(clamp(xm, 0, 1600)) + 6) return false;
    const u = F / z0, hz = haze(z0), air = airCol(xm), k = clamp(hz * 0.82, 0, 0.9);
    const front = PAS.near(mix3(b.cf, air, k), rng, 0.02), roof = PAS.near(mix3(b.cr, air, k * 0.92), rng, 0.02);
    let sideC = mix3(mix3(b.cf, hx('#3c3684'), 0.45), air, k);
    const towardAve = Math.abs((x0 > AX ? x0 : x1) - AX) < 60;
    if (towardAve) sideC = mix3(sideC, hx('#a05090'), 0.22);
    const near = u > 3.2, mid = u > 1.7;
    // roof
    const rq = [fx0, fyT, fx1, fyT, rx1, ryT, rx0, ryT];
    if (fyT - ryT > 0.8) S.solid(C, rng, rq, roof, { ang: 0.02, w: clamp((fyT - ryT) * 0.5, 1, 4.5), med: M.pastelTip, single: fyT - ryT < 5, over: 0.4 });
    // the wall that turns toward the avenue
    let sq = null;
    if (x0 > 0) sq = [fx0, fyT, rx0, ryT, rx0, ryB, fx0, fyB]; else if (x1 < 0) sq = [fx1, fyT, rx1, ryT, rx1, ryB, fx1, fyB];
    if (sq && Math.abs(sq[0] - sq[2]) > 0.7) {
      S.solid(C, rng, sq, PAS.near(sideC, rng, 0.02), { ang: 1.5, w: clamp(Math.abs(sq[0] - sq[2]) * 0.5, 1, 4), over: 0.3, single: Math.abs(sq[0] - sq[2]) < 6 });
      if (mid && !b.plain) { // a few lights round the corner
        const nb = Math.max(1, Math.floor((z1 - z0) / 3.6)), nf = Math.max(1, Math.floor(h / 3.3));
        for (let f = 0; f < nf; f++) for (let q = 0; q < nb; q++) {
          if (rng() > b.pl * 0.8) continue;
          const zz = z0 + (q + 0.5) * (z1 - z0) / nb, xx = x0 > 0 ? x0 : x1, al = top - (f + 0.55) * 3.3;
          if (al < g + 1) continue;
          const px = sxw(xx, zz), py = syw(al, zz), len = Math.abs(sxw(xx, zz - 1) - sxw(xx, zz + 1)) * 0.9;
          dab(C, rng, px, py, Math.max(0.8, len), clamp(F / zz * 1.2, 0.8, 4.5), mix3(rng.pick(b.lights), air, hz * 0.3), u > 2.4 ? M.oil : M.pencil, 0.95);
        }
      }
    }
    // the wall that faces us: in shadow, away from the sun
    if (near) { S.solid(C, rng, [fx0, fyT, fx1, fyT, fx1, fyB, fx0, fyB], front, { ang: b.ha, w: clamp((fx1 - fx0) * 0.2, 2.5, 6), over: 0.5 }); rect(C, rng, fx0, fyT, fx1, fyT + 2.4, front, { w: 2.2 }); }
    else rect(C, rng, fx0, fyT, fx1, fyB, front, { w: clamp((fyB - fyT) * 0.3, 1.2, 3.2) });
    // roof edge catching the sky
    const edgeC = mix3(mix3(b.cr, hx('#8a74cc'), 0.6), air, k * 0.8);
    if (mid) { A.line(C, rng, [fx0 - 0.5, fyT, fx1 + 0.5, fyT], M.pencil, edgeC, near ? 1.3 : 0.9, 0.8, { wob: 0.15, reps: near ? 2 : 1, off: 0.3 }); if (sq) A.line(C, rng, [sq[0], sq[1], sq[2], sq[3]], M.pencil, edgeC, 0.8, 0.6, { wob: 0.15 }); }
    else if (rng() < 0.6) A.line(C, rng, [fx0, fyT, fx1, fyT], M.pencil, edgeC, 0.75, 0.6, { wob: 0.1, step: 3 });
    if (b.plain) return true;
    // windows
    const w = x1 - x0, nF = Math.max(1, Math.floor(h / 3.3)), nB = Math.max(1, Math.floor(w / (b.office ? 2.6 : 3.5)));
    const fH = 3.3 * u, bw = (fx1 - fx0) / nB;
    const floorLit = []; for (let f = 0; f < nF; f++) floorLit.push(rng() < b.pl * 1.1);
    for (let f = 0; f < nF; f++) {
      const cy = fyT + (f + 0.56) * fH + (near ? 0.6 : 0);
      if (cy > fyB - fH * 0.3) break;
      // a band of balcony or sill under each floor, on the nearer ones
      if (near && b.balc) A.line(C, rng, [fx0 + 1, cy + fH * 0.36, fx1 - 1, cy + fH * 0.36], M.pencil, mix3(front, hx('#6650b0'), 0.55), 1.1, 0.7, { wob: 0.2 });
      for (let q = 0; q < nB; q++) {
        const lit = b.office ? (floorLit[f] && rng() < 0.86) : rng() < b.pl;
        const cx = fx0 + (q + 0.5) * bw, ww = bw * (b.office ? 0.8 : 0.56), wh = fH * 0.5;
        if (near) {
          if (lit) {
            const lc = mix3(rng.pick(b.lights), air, hz * 0.2);
            dab(C, rng, cx, cy - wh * 0.22, ww, wh * 0.62, lc, M.oil, 1);
            dab(C, rng, cx, cy + wh * 0.2, ww, wh * 0.6, mix3(lc, hx('#f7a84a'), b.office ? 0 : 0.25), M.oil, 1);
            if (rng() < 0.3) dab(C, rng, cx + rng.r(-0.2, 0.2) * ww, cy - wh * 0.1, ww * 0.35, wh * 0.9, mix3(lc, c.white, 0.5), M.oil, 0.9);   // the lamp itself
            if (rng() < 0.6) A.line(C, rng, [cx + rng.r(-0.1, 0.1) * ww, cy - wh * 0.55, cx + rng.r(-0.1, 0.1) * ww, cy + wh * 0.55], M.pencil, front, 0.8, 0.85, { wob: 0.1 });
            if (rng() < 0.22) dab(C, rng, cx - ww * 0.25, cy, ww * 0.4, wh * 0.9, mix3(lc, hx('#b84490'), 0.5), M.pastelTip, 0.8);       // a curtain half drawn
          } else if (rng() < 0.75) {
            dab(C, rng, cx, cy, ww, wh * 0.8, mix3(front, mix3(hx('#3c4a9c'), air, 0.3), 0.5), M.pastelTip, 0.8);
            if (rng() < 0.3) dab(C, rng, cx - ww * 0.1, cy - wh * 0.2, ww * 0.5, 0.9, mix3(front, hx('#7fa2e0'), 0.5), M.pencil, 0.6);
          }
        } else if (mid) {
          if (lit) dab(C, rng, cx, cy, Math.max(0.8, ww), clamp(wh, 0.9, 3), mix3(rng.pick(b.lights), air, hz * 0.28), rng() < 0.6 ? M.oil : M.pencil, 1);
          else if (rng() < 0.2) dab(C, rng, cx, cy, Math.max(0.8, ww), clamp(wh * 0.7, 0.8, 2), mix3(front, hx('#3c4a9c'), 0.4), M.pencil, 0.6);
        } else if (lit) A.dot(C, rng, cx, cy, rng() < 0.5 ? M.oil : M.pencil, mix3(rng.pick(b.lights), air, hz * 0.3), clamp(wh * 1.1, 0.8, 1.6), 1);
      }
    }
    // things on the roof
    const rd = fyT - ryT;
    if (b.hut && rd > 2.2) {
      const hw = Math.min(w * 0.3, 3.4), hx0 = x0 + (w - hw) * b.hut, hz0 = z0 + (z1 - z0) * 0.35;
      building(C, rng, { x0: hx0, x1: hx0 + hw, z0: hz0, z1: hz0 + 3, h: 2.6, g: top, cf: mix3(b.cf, hx('#3a3478'), 0.4), cr: b.cr, pl: 0, lights: b.lights, plain: true, ha: b.ha });
      if (b.tank && mid) { // a water tank on its little legs
        const tx = sxw(hx0 + hw * 0.5, hz0 + 1.5), ty = syw(top + 2.6, hz0 + 1.5), tr = 1.1 * u;
        rect(C, rng, tx - tr, ty - tr * 1.9, tx + tr, ty - tr * 0.3, PAS.near(mix3(hx('#5a5684'), air, k), rng, 0.02), { w: Math.max(1, tr * 0.6) });
        A.line(C, rng, [tx - tr, ty - tr * 1.9, tx + tr, ty - tr * 1.9], M.pencil, mix3(hx('#b09ee2'), air, k), 0.9, 0.8, { wob: 0.1 });
        A.line(C, rng, [tx - tr * 0.7, ty - tr * 0.3, tx - tr * 0.7, ty], M.pencil, front, 0.7, 0.8); A.line(C, rng, [tx + tr * 0.7, ty - tr * 0.3, tx + tr * 0.7, ty], M.pencil, front, 0.7, 0.8);
      }
    }
    if (b.ant && mid) { // television aerial
      const ax = sxw(x0 + w * b.ant, z0 + 2), ay = syw(top, z0 + 2), ah = 3.4 * u;
      A.line(C, rng, [ax, ay, ax + rng.g() * 0.3, ay - ah], M.pencil, mix3(hx('#17143e'), air, k), 0.7, 0.85, { wob: 0.1 });
      for (let q = 0; q < 3; q++) A.line(C, rng, [ax - ah * (0.3 - q * 0.06), ay - ah * (0.62 + q * 0.14), ax + ah * (0.3 - q * 0.06), ay - ah * (0.6 + q * 0.14)], M.pencil, mix3(hx('#17143e'), air, k), 0.6, 0.8, { wob: 0.05 });
    }
    if (b.sign && mid) { // a lit hoarding along the roof's edge: colour, no words
      const sw = (fx1 - fx0) * 0.72, sx0 = fx0 + (fx1 - fx0 - sw) * 0.5, sh = 2.6 * u, sy1 = fyT - 0.5 * u, sy0 = sy1 - sh, nc = mix3(b.sign, air, hz * 0.2);
      rect(C, rng, sx0, sy0, sx0 + sw, sy1, PAS.near(mix3(nc, hx('#221d40'), 0.35), rng, 0.02), { med: M.pastelTip, w: clamp(sh * 0.4, 1, 3) });
      const nblk = Math.max(2, Math.round(sw / (sh * 0.9)));
      for (let q = 0; q < nblk; q++) if (rng() < 0.85) dab(C, rng, sx0 + (q + 0.5) * sw / nblk, (sy0 + sy1) / 2 + rng.g() * 0.2, sw / nblk * 0.5, sh * 0.5, mix3(nc, c.white, 0.55), M.oil, 1);
      A.line(C, rng, [sx0, sy0, sx0 + sw, sy0], M.pencil, mix3(nc, c.white, 0.3), 0.9, 0.9, { wob: 0.1 });
      for (let q = 0; q < 3; q++) A.line(C, rng, [sx0 + sw * (0.15 + 0.35 * q), sy1, sx0 + sw * (0.15 + 0.35 * q), fyT], M.pencil, front, 0.7, 0.8);
      if (near) { for (let q = 0; q < 5; q++) A.dot(C, rng, sx0 + rng.r(0, sw), sy0 - rng.r(1, 5), M.pastel, nc, rng.r(4, 8), 0.25); C.rub([sx0, sy0 - 3, sx0 + sw, sy0 - 3], 5, 0.4, 0.6); }
    }
    if (b.beacon) A.dot(C, rng, xm + rng.r(-1, 1), fyT - 1.4, M.oil, hx('#f06a6a'), clamp(u * 0.6, 1.2, 2.4), 1);
    return true;
  }
  S.building = building;

  // ------------------------------------------------------------------ the near town, the river, the line
  S.drawTown = function (C, rng) {
    const items = [];
    const mk = (x0, x1, z0, z1, h) => {
      const xm = (x0 + x1) / 2, office = rng() < (Math.abs(xm - AX) < 90 ? 0.4 : 0.12) && h > 13;
      const lights = office ? (rng() < 0.75 ? COOL : WARM) : rng() < 0.82 ? WARM : COOL;
      return { x0, x1, z0, z1, h, cf: rng.pick(FRONT), cr: rng.pick(ROOF), pl: rng() < 0.12 ? 0.04 : office ? rng.r(0.25, 0.75) : rng.r(0.18, 0.55), office, lights,
        balc: !office && rng() < 0.5, hut: rng() < 0.55 ? rng.r(0.1, 0.9) : 0, tank: rng() < 0.6, ant: !office && rng() < 0.4 ? rng.r(0.15, 0.85) : 0,
        sign: rng() < (Math.abs(xm - AX) < 120 ? 0.22 : 0.06) ? rng.pick(NEON) : null, beacon: h > 34, ha: rng.pick([-0.62, 0.02, 1.5, -0.62]) };
    };
    let z = 706, tog = 0;
    const streets = [];
    while (z > 148) {
      const d = rng.r(15, 25), z1 = z, z0 = z - d;
      let x = -(VX + 70) * z1 / F + rng.r(-8, 0); const xmax = (1670 - VX) * z1 / F;
      while (x < xmax) {
        let w = rng() < 0.1 ? rng.r(28, 44) : rng.r(9, 25), x1 = x + w;
        if (x < AX + 17 && x1 > AX - 17) { x = AX + 17; continue; }                        // the avenue
        const ks = Math.round((x + w / 2 - 30) / 64), xs = ks * 64 + 30;         // side streets
        if (x < xs + 4.5 && x1 > xs - 4.5) { if (xs - 4.5 - x > 8) { x1 = xs - 4.5; w = x1 - x; } else { x = xs + 4.5; continue; } }
        const zr = zc((x + x1) / 2);
        if (z1 > zr - RW - 26 && z0 < zr + RW + 30) { x = x1 + 1; continue; }  // the river and its banks
        let h = 6 + 16 * Math.pow(rng(), 1.6);
        if (rng() < 0.12) h = rng.r(24, 40);
        if (Math.abs(x + w / 2 - AX) < 80) h *= 1.3;
        if (z0 > zr + RW + 30 && z0 < zr + RW + 110) h *= 1.25;
        if (z0 < zr - RW) { // low roofs between us and the water, so the river can be seen
          const yNear = syw(GD - 2.5, zr - RW), hmax = 48 - (yNear + 3 - HY) * z0 / F;
          h = Math.max(3.6, Math.min(h, hmax * (rng() < 0.16 ? rng.r(1.2, 1.7) : rng.r(0.55, 1))));
          if (z0 > 225) { w = Math.min(w, rng.r(7, 13)); x1 = x + w; }
        }
        const b = mk(x, x1, z0 + rng.r(0, 2), z1 - rng.r(0, 2), h);
        items.push({ side: z0 > zr ? 0 : 2, z: z0, ax: Math.abs(x + w / 2), fn: () => building(C, rng, b) });
        x = x1 + (rng() < 0.5 ? rng.r(0.6, 2.6) : 0.3);
      }
      const street = tog++ % 2 === 1;
      if (street) streets.push([z0 - 12, z0]);
      z = z0 - (street ? rng.r(10, 13) : rng.r(2, 4));
    }
    // streets seen between the rows: wet, with lamps and the spill of shop fronts
    for (const [za, zb] of streets) {
      items.push({ side: zb > zc(0) + 40 ? 0 : 2, z: zb - 0.5, ax: 1e6, fn: () => {
        const ya = syw(GD, zb), yb = syw(GD, za);
        if (ya > 730) return;
        const zr0 = zc(0);
        for (let k = 0; k < 150; k++) {
          const sx = rng.r(-10, 1610), zz = rng.r(za, zb), xw = (sx - VX) * zz / F;
          if (Math.abs(zz - zc(xw)) < RW + 26) continue;
          const y = syw(GD, zz), air = airCol(sx);
          const col = rng() < 0.55 ? mix3(hx('#3a3478'), air, 0.3) : mix3(rng.pick(WARM), hx('#8a2f7a'), rng.r(0.2, 0.6));
          dab(C, rng, sx, y, rng.r(4, 16) * (300 / zz + 0.4), clamp(F / zz * 0.5, 0.8, 2.6), col, M.pastelTip, rng.r(0.5, 0.9));
        }
        for (let xw = Math.ceil((-(VX + 20) * zb / F) / 22) * 22; xw < (1620 - VX) * zb / F; xw += 22) { // street lamps
          const zz = (za + zb) / 2 + 4, sx = sxw(xw + 6, zz), sy = syw(GD + 6.5, zz), r = clamp(F / zz * 0.45, 0.9, 2.6);
          if (Math.abs(zz - zc(xw)) < RW + 26) continue;
          S.bulb(C, rng, sx, sy, r, hx('#f7a84a'), hx('#fff4c8'));
          if (r > 1.4) dab(C, rng, sx + rng.g(), syw(GD, zz - 2), r * 5, r * 0.9, hx('#f7a84a'), M.pastelTip, 0.5);
        }
      } });
    }

    // ---- the river: the sky lying down among the houses
    const yBank = (x, dz) => syw(GD - 2.5, zc(x) + dz);
    items.push({ side: 1, z: 520, ax: 1e6, fn: () => {
      // sample the banks across the picture
      const near = [], far = [];
      for (let sx = -40; sx <= 1640; sx += 20) {
        // solve for the world x whose bank projects to this screen x
        let xn = (sx - VX) * 0.33, xf = (sx - VX) * 0.42;
        for (let it = 0; it < 6; it++) { xn = (sx - VX) * (zc(xn) - RW) / F; xf = (sx - VX) * (zc(xf) + RW) / F; }
        near.push(sx, yBank(xn, -RW)); far.push(sx, yBank(xf, RW));
      }
      const yN = sx => { const i = clamp(Math.floor((sx + 40) / 20), 0, near.length / 2 - 2), t = (sx + 40) / 20 - i; return near[i * 2 + 1] + (near[i * 2 + 3] - near[i * 2 + 1]) * t; };
      const yF = sx => { const i = clamp(Math.floor((sx + 40) / 20), 0, far.length / 2 - 2), t = (sx + 40) / 20 - i; return far[i * 2 + 1] + (far[i * 2 + 3] - far[i * 2 + 1]) * t; };
      S.riverY = [yN, yF];
      const inW = (x, y) => (y > yF(x) && y < yN(x) ? 1 : 0);
      const water = (x, y) => {
        const t = (y - yF(x)) / Math.max(1, yN(x) - yF(x));
        let col = S.skyAll(x + (A.vn(x / 30, y / 3, 3) - 0.5) * 22, HY - 14 - t * 190);
        col = mix3(col, hx('#2a2a78'), 0.16 + 0.2 * t);
        col = mix3(col, hx('#1a1848'), 0.75 * ss(0.2, 0, t));      // the far bank's dark lies along the far edge
        return col;
      };
      A.field(C, rng, { box: [-40, 480, 1640, 600], sp: 6, order: 'scan', mask: inW, clip: true, col: water, dir: () => 0, len: [26, 110], w: [3.5, 7], p: [0.9, 1.1], med: M.pastel, sticks: PAS, spread: 0.035, wob: 0.5, dj: 0.015, overP: 0 });
      for (let k = 0; k < 5; k++) { const xy = []; for (let sx = -20; sx <= 1620; sx += 16) xy.push(sx, mix(yF(sx), yN(sx), (k + 0.5) / 5)); C.rub(k % 2 ? xy : A.rev(xy), 4.5, 0.5, 0.75); }
      A.field(C, rng, { box: [-40, 480, 1640, 600], sp: 4.5, mask: inW, clip: true, col: (x, y) => mix3(water(x, y), c.white, 0.12), dir: () => 0, len: [10, 60], w: [1.4, 3.2], p: [0.6, 0.9], med: M.pastelTip, sticks: PAS, spread: 0.06, wob: 0.3, dj: 0.015, overP: 0, prob: () => 0.75 });
      // light riding the ripples
      for (let k = 0; k < 520; k++) {
        const sx = rng.r(-10, 1610), t = rng.r(0.25, 0.97), y = mix(yF(sx), yN(sx), t), len = rng.r(3, 18);
        const sc = S.skyAll(sx, HY - 14 - t * 190);
        dab(C, rng, sx, y, len, rng.r(0.8, 1.6), mix3(sc, c.white, 0.4), rng() < 0.5 ? M.oil : M.pencil, rng.r(0.6, 0.95));
      }
    } });
    // the far bank: a stone wall, the railway on its embankment, and a train going away
    items.push({ side: 1, z: 470, ax: 1e6, fn: () => {
      const [yN, yF] = S.riverY;
      const wx = sx => { let x = (sx - VX) * 0.44; for (let it = 0; it < 6; it++) x = (sx - VX) * (zc(x) + RW + 14) / F; return x; };
      const yDeck = sx => { const x = wx(sx); return syw(GD + 5, zc(x) + RW + 14); };
      for (let sx = -30; sx < 1630; sx += 34) {
        const air = airCol(sx + 17);
        const y0 = yDeck(sx), y1 = yDeck(sx + 34), f0 = yF(sx), f1 = yF(sx + 34);
        S.solid(C, rng, [sx, y0 + 1, sx + 35, y1 + 1, sx + 35, f1 + 1, sx, f0 + 1], PAS.near(mix3(hx('#1b1846'), air, 0.2), rng, 0.02), { ang: 0.02, w: 3, over: 0.3 });
        for (let q = 0; q < 2; q++) { const px = sx + 8 + q * 17; A.line(C, rng, [px, yDeck(px) + 2, px, yF(px)], M.pencil, mix3(hx('#3c3684'), air, 0.25), 0.9, 0.55, { wob: 0.2 }); }   // buttresses
        A.line(C, rng, [sx, y0, sx + 35, y1], M.pencil, mix3(hx('#8a74cc'), air, 0.3), 1.1, 0.85, { wob: 0.2, reps: 2, off: 0.3 });
        // catenary masts
        { const px = sx + 12, py = yDeck(px), mh = 7 * F / 440; A.line(C, rng, [px, py, px, py - mh], M.pencil, hx('#191640'), 0.9, 0.9, { wob: 0.1 }); A.line(C, rng, [px, py - mh * 0.86, px + 5, py - mh * 0.86], M.pencil, hx('#191640'), 0.7, 0.85); }
      }
      // the wire, in two or three long pulls
      for (let sx = -30; sx < 1630; sx += 300) A.line(C, rng, [sx, yDeck(sx) - 7 * F / 440 * 0.84, sx + 150, yDeck(sx + 150) - 7 * F / 440 * 0.84, sx + 310, yDeck(sx + 310) - 7 * F / 440 * 0.84], M.pencil, hx('#221d40'), 0.6, 0.7, { wob: 0.3 });
      // the train: six lit cars, nobody much aboard, heading out of the picture
      const T0 = 548, carL = 20 * F / 455, gap = 1.6;
      for (let q = 0; q < 6; q++) {
        const a = T0 + q * (carL + gap), b = a + carL, ya = yDeck(a), yb = yDeck(b), ch = 3.5 * F / 455;
        S.solid(C, rng, [a, ya - ch, b, yb - ch, b, yb - 0.6, a, ya - 0.6], PAS.near(hx(q % 2 ? '#4a5aa0' : '#44549a'), rng, 0.02), { ang: 0.02, w: 2.4, over: 0.2 });
        A.line(C, rng, [a, ya - ch, b, yb - ch], M.pencil, hx('#aec4ee'), 0.9, 0.85, { wob: 0.1 });
        A.line(C, rng, [a + 1, ya - ch * 0.26, b - 1, yb - ch * 0.26], M.pencil, hx('#f283ae'), 0.9, 0.8, { wob: 0.1 });       // the stripe along its side
        const nw = 7;
        for (let j = 0; j < nw; j++) { const t = (j + 0.5) / nw, px = mix(a, b, t), py = mix(ya, yb, t) - ch * 0.62; dab(C, rng, px, py, carL / nw * 0.66, ch * 0.34, j === 2 || j === 5 ? hx('#fff4c8') : hx('#fbe8a8'), M.oil, 1); }
        // their light on the water, broken
        for (let j = 0; j < 9; j++) { const px = rng.r(a, b), t = rng.r(0.06, 0.6), py = mix(yF(px), yN(px), t); dab(C, rng, px, py, rng.r(3, 10), rng.r(0.9, 1.6), mix3(hx('#fbe8a8'), hx('#f7a84a'), t), M.oil, rng.r(0.5, 0.9) * (1 - t * 0.6)); }
      }
      { const hxp = T0 + 6 * (carL + gap) + 1, hy = yDeck(hxp) - 1.6 * F / 455; S.bulb(C, rng, hxp, hy, 2.2, hx('#fff4c8'), c.white); A.dot(C, rng, T0 - 1, yDeck(T0) - 1.4 * F / 455, M.oil, hx('#f06a6a'), 1.5, 1); A.dot(C, rng, T0 - 1, yDeck(T0) - 2.4 * F / 455, M.oil, hx('#f06a6a'), 1.2, 1); }
      // a signal by the track, showing green down the empty line
      { const px = 470, py = yDeck(px); A.line(C, rng, [px, py, px, py - 12], M.pencil, hx('#191640'), 1, 0.9, { wob: 0.1 }); S.bulb(C, rng, px, py - 13, 1.8, hx('#3fb0aa'), hx('#d2efcf')); }
    } });
    // the near bank: grass, a row of trees, a path with lamps the colour of pearls
    items.push({ side: 1, z: 318, ax: 1e6, fn: () => {
      const [yN] = S.riverY;
      const wxn = sx => { let x = (sx - VX) * 0.33; for (let it = 0; it < 6; it++) x = (sx - VX) * (zc(x) - RW - 12) / F; return x; };
      const yE = sx => syw(GD, zc(wxn(sx)) - RW - 24);
      A.field(C, rng, { box: [-40, 500, 1640, 620], sp: 4.2, mask: (x, y) => (y > yN(x) - 1.5 && y < yE(x) ? 1 : 0), clip: true, col: (x, y) => mix3(mix3(hx('#16404a'), hx('#2a6a54'), A.vn(x / 30, y / 4, 9)), airCol(x), 0.1), dir: () => 0.04, len: [8, 30], w: [2.2, 4.4], p: [0.9, 1.1], med: M.pastelTip, sticks: PAS, spread: 0.05, wob: 0.4, dj: 0.1, overP: 0.1 });
      A.field(C, rng, { box: [-40, 500, 1640, 620], sp: 5, mask: (x, y) => (y > yN(x) && y < yE(x) ? 1 : 0), clip: true, col: () => rng() < 0.5 ? hx('#3fb0aa') : hx('#5a9a68'), dir: () => -1.3, len: [2.5, 6], w: [0.8, 1.3], p: [0.5, 0.85], med: M.pencil, wob: 0.2, dj: 0.4, prob: () => 0.5 });
      // the path, pale where it is wet
      { const xy = []; for (let sx = -30; sx <= 1630; sx += 30) xy.push(sx, mix(yN(sx), yE(sx), 0.55)); A.line(C, rng, xy, M.pastelTip, hx('#6a7cc8'), 2.2, 0.75, { wob: 0.5, step: 8 }); A.line(C, rng, xy, M.pencil, hx('#aec4ee'), 0.8, 0.5, { wob: 0.6, step: 8 }); }
      for (let sx = -14; sx < 1620; sx += rng.r(15, 30)) { // trees
        const yb = mix(yN(sx), yE(sx), rng.r(0.62, 0.9)), r = rng.r(4.5, 8) * (1 - sx / 5200);
        for (let q = 0; q < 7; q++) A.dot(C, rng, sx + rng.g() * r * 0.45, yb - r * 0.9 + rng.g() * r * 0.35, M.pastelTip, PAS.near(mix3(hx('#123a44'), hx('#1e5a50'), rng()), rng, 0.03), r * rng.r(0.6, 1.0), 1);
        for (let q = 0; q < 4; q++) A.dot(C, rng, sx - r * 0.2 + rng.g() * r * 0.4, yb - r * 1.3 + rng.g() * r * 0.25, M.pencil, hx(rng() < 0.5 ? '#3fb0aa' : '#2a6a54'), r * 0.3, 0.75);
        A.line(C, rng, [sx, yb, sx + rng.g() * 0.5, yb - r * 0.5], M.pencil, hx('#191640'), 0.8, 0.8);
      }
      for (let sx = -6; sx < 1620; sx += 31 * (1 - sx / 4200)) { // lamps, and each one's quiver on the water
        const yb = mix(yN(sx), yE(sx), 0.45), u = 1 - sx / 4600, lh = 11 * u;
        A.line(C, rng, [sx, yb, sx, yb - lh], M.pencil, hx('#191640'), 0.8, 0.9, { wob: 0.1 });
        S.bulb(C, rng, sx, yb - lh - 1, 2.3 * u, hx('#a6e0c0'), hx('#fffbe8'));
        for (let q = 0; q < 5; q++) { const yy = yN(sx) - 1.5 - q * rng.r(2.2, 3.4); dab(C, rng, sx + rng.g() * 1.2, yy, rng.r(2.5, 6) * u, 1.1, mix3(hx('#d2efcf'), c.white, rng.r(0, 0.6)), M.oil, 0.95 - q * 0.14); }
      }
    } });
    // bridges: the avenue's, and a footbridge upstream
    const bridge = (xw, wd, lamps) => items.push({ side: 1, z: 300, ax: 0, fn: () => {
      const za = zc(xw) - RW - 10, zb = zc(xw) + RW + 8, alt = GD + 3.2, air = airCol(sxw(xw, za));
      const q = [sxw(xw - wd, za), syw(alt, za), sxw(xw + wd, za), syw(alt, za), sxw(xw + wd, zb), syw(alt, zb), sxw(xw - wd, zb), syw(alt, zb)];
      if (xw !== AX) S.solid(C, rng, q, PAS.near(mix3(hx('#3a3478'), air, 0.25), rng, 0.02), { ang: 1.3, w: 3, over: 0.3 });
      const side = xw + wd < 0 ? 1 : -1, ex = xw + side * wd;       // the flank we can see
      const fq = [sxw(ex, za), syw(alt, za), sxw(ex, zb), syw(alt, zb), sxw(ex, zb), syw(alt - 2.2, zb), sxw(ex, za), syw(alt - 2.2, za)];
      S.solid(C, rng, fq, hx('#17143e'), { ang: 0.4, w: 2.2, over: 0.2 });
      for (let t = 0.2; t < 1; t += 0.3) { const zz = mix(za, zb, t); A.line(C, rng, [sxw(ex, zz), syw(alt - 2, zz), sxw(ex, zz), syw(GD - 2, zz)], M.conte, hx('#17143e'), 2.4 * 400 / zz, 1.0, { wob: 0.1 }); }
      A.line(C, rng, [fq[0], fq[1], fq[2], fq[3]], M.pencil, mix3(hx('#b09ee2'), air, 0.3), 1.0, 0.85, { wob: 0.15, reps: 2, off: 0.3 });
      if (lamps) for (let t = 0.06; t < 1; t += 0.16) for (const s of [-1, 1]) { const zz = mix(za, zb, t); S.bulb(C, rng, sxw(xw + s * (wd - 0.6), zz), syw(alt + 5, zz), 1.9 * 380 / zz, hx('#f7a84a'), hx('#fff4c8')); A.line(C, rng, [sxw(xw + s * (wd - 0.6), zz), syw(alt, zz), sxw(xw + s * (wd - 0.6), zz), syw(alt + 4.6, zz)], M.pencil, hx('#191640'), 0.6, 0.8); }
      // wet deck: the glow comes down it
      if (lamps) for (let k = 0; k < 14; k++) { const zz = rng.r(za, zb), xx = xw + rng.r(-wd, wd) * 0.7; dab(C, rng, sxw(xx, zz), syw(alt, zz), rng.r(3, 9), 1.2, mix3(hx('#ffc6a8'), hx('#f283ae'), rng()), M.pastelTip, 0.7); }
    } });
    bridge(AX, 11, true); bridge(-232, 3.2, false); bridge(236, 7, true);

    // ---- the avenue: straight out of town toward where the light went
    items.push({ side: 3, z: 0, ax: 0, fn: () => {
      const zEnd = 6000, zNear = 150;
      const road = (x, y) => {
        const z = 48000 / Math.max(1, y - HY); if (z < zNear) return 0;
        const xw = (x - VX) * z / F - AX; if (Math.abs(xw) > 13) return 0;
        if (Math.abs(z - zc(AX)) < RW + 9 && Math.abs(xw) > 9.4) return 0;
        return 1;
      };
      const rc = (x, y) => { const z = 48000 / Math.max(1, y - HY), xw = (x - VX) * z / F - AX, t = ss(150, 1800, z);
        const base = mix3(hx('#28266a'), airCol(VX), clamp(haze(z) * 0.95, 0, 1)), g = Math.exp(-(xw / 3.4) * (xw / 3.4));
        return mix3(base, mix3(hx('#f283ae'), hx('#ffd9a8'), t), clamp((0.3 + 0.62 * t) * (0.4 + 0.6 * g), 0, 0.95)); };                    // the last light lies down the middle of the wet road
      A.field(C, rng, { box: [60, 404, 700, 730], sp: 2.6, mask: road, clip: true, col: rc, dir: (x, y) => Math.atan2(y - HY, x - VX), len: [5, 22], w: [1.4, 3.4], p: [0.9, 1.08], med: M.pastelTip, sticks: PAS, spread: 0.03, wob: 0.3, dj: 0.05, overP: 0 });
      // tram rails catching the sky, and the wire above them
      for (const xr of [-1.5, 1.5]) for (const [za, zb] of [[zNear, zc(AX) - RW - 10], [zc(AX) + RW + 9, 3000]]) A.line(C, rng, [sxw(AX + xr, za), syw(GD, za), sxw(AX + xr, zb), syw(GD, zb)], M.pencil, hx('#ffe0c8'), 0.7, 0.5, { wob: 0.15, pj: 0.5 });
      // lamps down both sides, closing on the vanishing point
      for (let zz = 170; zz < 3200; zz *= 1.085) for (const s of [-1, 1]) {
        if (Math.abs(zz - zc(AX)) < RW + 9) continue;
        const sx = sxw(AX + s * 13.4, zz), sy = syw(GD + 8, zz), r = clamp(F / zz * 0.72, 0.8, 3.6);
        if (r > 1.3) A.line(C, rng, [sx, syw(GD, zz), sx, sy], M.pencil, hx('#191640'), 0.7, 0.8, { wob: 0.1 });
        S.bulb(C, rng, sx, sy, r, hx('#f7a84a'), hx('#fff4c8'));
        if (r > 1.2) dab(C, rng, sx - s * r * 2.5, syw(GD, zz), r * 4, r * 0.8, hx('#ffc070'), M.pastelTip, 0.6);
      }
      // the long reflections of the lamps, drawn down the wet road toward us
      for (let zz = 170; zz < 800; zz *= 1.085) for (const s of [-1, 1]) {
        if (Math.abs(zz - zc(AX)) < RW + 9) continue;
        const u = F / zz;
        for (let q = 0; q < 1; q++) { const xa = AX + s * rng.r(9.5, 12.5), za = zz - rng.r(0, 3), zb = za - rng.r(5, 10) * (zz / 300); A.line(C, rng, [sxw(xa, za), syw(GD, za), sxw(xa, Math.max(152, zb)), syw(GD, Math.max(152, zb))], M.pastelTip, rng() < 0.7 ? hx('#f7a84a') : hx('#ffd890'), clamp(u * 0.5, 0.8, 2.6), rng.r(0.5, 0.85), { wob: 0.3, pe: 0.1, t0: 0.3, t1: 0.5 }); }
      }
      // crossings, and the dark mouths of the side streets
      for (let zz = 205; zz < 1200; zz *= 1.5) {
        if (Math.abs(zz - zc(AX)) < RW + 16) continue;
        const u = F / zz, y = syw(GD, zz);
        for (let xr = -11; xr <= 11; xr += 2.2) A.line(C, rng, [sxw(AX + xr, zz), y, sxw(AX + xr, zz + 4), syw(GD, zz + 4)], M.pencil, hx('#d2dff6'), clamp(u * 0.5, 0.7, 2), 0.6, { wob: 0.1 });
      }
      // plane trees along the kerbs
      for (let zz = 160; zz < 310; zz *= 1.07) for (const s of [-1, 1]) {
        if (Math.abs(zz - zc(AX)) < RW + 9) continue;
        if (rng() < 0.3) continue;
        const sx = sxw(AX + s * 15.5 + rng.g() * 0.6, zz), sy = syw(GD + 4.5, zz), r = F / zz * rng.r(1.5, 2.3);
        for (let q = 0; q < 4; q++) A.dot(C, rng, sx + rng.g() * r * 0.4, sy + rng.g() * r * 0.4, M.pastelTip, mix3(hx('#141c40'), hx('#16404a'), rng()), r * rng.r(0.7, 1.1), 1);
        if (rng() < 0.6) A.dot(C, rng, sx - s * r * 0.4, sy - r * 0.3, M.pencil, hx(rng() < 0.5 ? '#2a6a54' : '#f7a84a'), r * 0.3, 0.55);
      }
      // one tram, small, lit, going away
      { const zz = 250, ch = 3.3, x0 = AX + 0.5, x1 = AX + 3.1; const q = [sxw(x0, zz), syw(GD + ch, zz), sxw(x1, zz), syw(GD + ch, zz), sxw(x1, zz), syw(GD + 0.3, zz), sxw(x0, zz), syw(GD + 0.3, zz)];
        const rq = [sxw(x0, zz), syw(GD + ch, zz), sxw(x1, zz), syw(GD + ch, zz), sxw(x1, zz + 13), syw(GD + ch, zz + 13), sxw(x0, zz + 13), syw(GD + ch, zz + 13)];
        S.solid(C, rng, rq, hx('#7fa2e0'), { ang: 1.4, w: 2, over: 0.2 }); S.solid(C, rng, q, hx('#2a5cae'), { ang: 0.02, w: 2.2, over: 0.2 });
        dab(C, rng, (q[0] + q[2]) / 2, mix(q[1], q[5], 0.34), (q[2] - q[0]) * 0.7, 3, hx('#fff4c8'), M.oil, 1);
        dab(C, rng, (q[0] + q[2]) / 2, mix(q[1], q[5], 0.66), (q[2] - q[0]) * 0.8, 1.2, hx('#fbe8a8'), M.pencil, 0.9);
        A.dot(C, rng, q[0] + 1.4, q[5] - 2, M.oil, hx('#f06a6a'), 1.3, 1); A.dot(C, rng, q[2] - 1.4, q[5] - 2, M.oil, hx('#f06a6a'), 1.3, 1);
        A.line(C, rng, [(q[0] + q[2]) / 2, q[1], (q[0] + q[2]) / 2 + 1, q[1] - 6], M.pencil, hx('#191640'), 0.7, 0.9);
        for (let k = 0; k < 6; k++) dab(C, rng, (q[0] + q[2]) / 2 + rng.g() * 2, q[5] + 2 + k * 2.6, rng.r(4, 9), 1.2, mix3(hx('#fff4c8'), hx('#f283ae'), k / 6), M.oil, 0.85 - k * 0.1); }
    } });

    items.sort((a, b) => (a.side - b.side) || (b.z - a.z) || (b.ax - a.ax));
    for (const it of items) it.fn();
    // the breath of all those lamps, rubbed into the air above the busiest streets
    for (const [x, y, r] of [[600, 440, 46], [540, 480, 40], [700, 470, 40], [820, 460, 34], [420, 486, 34]]) { for (let k = 0; k < 10; k++) A.dot(C, rng, x + rng.g() * r, y + rng.g() * r * 0.3, M.pastel, hx(rng() < 0.5 ? '#f283ae' : '#ffaa94'), rng.r(10, 18), 0.16); }
  };
})(typeof self !== 'undefined' ? self : globalThis);
