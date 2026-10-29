  /* ================================================================ 5a · The dark lighthouse (22.35 … 22.6 – 25.6)
     The headland in a snowstorm: the lighthouse standing dark over a black sea, the keeper's cottage with one lit window,
     the waves running in with their whitecaps and bursting on the rocks below, and out on the water a small ship pitching,
     its lights the only ones out there, lost. The kit comes running up the path with its lantern and slips in at the
     door. Camera: the meadow's push in dissolves into this; it eases back to show the sea and the ship, then pushes in on
     the door as the kit reaches it. The same place, later, is where the beam blazes out (6). */
  const F5 = { L: {}, rig: null };
  const T5X = 166, T5Y = 195, T5S = 1.12;                         // the tower's foot (world) and size
  const F5G = 198, F5S = 0.86, F5LS = 1.02 * F5S, HORIZ = 112;
  BUILDERS.push(() => {
    F5.rig = mkRig([0.04, 0.045, 0.06], [0.42, 0.48, 0.6], [1.0, 0.56, 0.24]);
    const L = F5.L;
    // the headland: snow on the plateau, the trodden path, fence posts along the edge, the cliff falling to the sea
    L.main = mkLayer(800, 300, { z0: -128, recv: true });
    const surf = (x) => 196 - 4 * sstep(0, 200, x) + 2 * Math.sin(x * 0.03) + 1.5 * Math.sin(x * 0.11) + (x > 300 ? (x - 300) * 0.08 : 0);
    const edgeX = (y) => 336 + Math.max(0, y - 194) * 0.75 + 5 * Math.sin(y * 0.11) + 3 * Math.sin(y * 0.37);
    const depM = (y) => 128 + (F5G - y) * 3;
    for (let x = 0; x < 800; x++) {
      const wx = x - 100, ys = surf(wx);
      for (let y = fl(ys); y < 300; y++) {
        const ex = edgeX(y);
        if (wx > ex) continue;
        const dd = y - ys, edge = ex - wx, onPath = Math.abs(y - (200 + (wx - 60) * 0.02)) < 3 + 2 * vn(wx, 0, 6, 501) && wx < 170;
        // where the plateau breaks into the cliff face, falling away to the sea: rock with snow on its ledges
        if (edge < 10 + 14 * vn(0, y, 12, 502) * sstep(194, 215, y) && dd > 1) { const R = rockAt(wx * 1.2, y * 1.2, 503); lput(L.main, x, y, R.snow ? M_SNOW : M_ROCK, R.snow ? 0.5 : R.s * 0.75 + (edge < 2 ? 0.08 : 0), depM(Math.min(y, 210)), R.nx, R.ny, 0); continue; }
        let s = 0.46 + 0.16 * clamp(1 - dd / 20, 0, 1) + (vn(wx * 0.5 + y, y * 2.2, 8, 504) - 0.5) * 0.18 + (dd < 1 ? 0.16 : 0);
        if (onPath) s -= 0.14 + (ih(fl(wx / 3), fl(y / 2), 505) < 0.3 ? 0.08 : 0);
        lput(L.main, x, y, M_SNOW, s, depM(y), 0, -1, ih(x, y, 506) < 0.04 ? 1 + fl(ih(x, y, 507) * 250) : 0);
      }
    }
    for (let k = 0; k < 9; k++) {                                  // fence posts along the cliff edge, a sagging rope
      const wx = 214 + k * 15, x = wx + 100, yb = surf(wx) + 4 + k * 0.6, h = 11 - k * 0.3;
      for (let j = 0; j < h; j++) { lput(L.main, x, yb - j, M_WOOD, 0.22, depM(yb), -0.3, 0, 0); lput(L.main, x + 1, yb - j, M_WOOD, 0.12, depM(yb), 0.5, 0, 0); }
      lput(L.main, x, yb - h, M_SNOW, 0.8, depM(yb), 0, -1, 0); lput(L.main, x + 1, yb - h, M_SNOW, 0.7, depM(yb), 0, -1, 0);
      if (k < 8) for (let q = 1; q < 15; q++) lput(L.main, x + q, yb - h + 3 + Math.sin(q / 15 * PI) * 2.2 + 0.6 * q / 15, M_WOOD, 0.18, depM(yb), 0, 0, 0);
    }
    L.fore = mkLayer(1100, 300, { z0: -128 });
    for (let x = 0; x < 1100; x++) {
      const top = 236 + 6 * Math.sin(x * 0.017 + 0.4) + 3 * Math.sin(x * 0.07) - 14 * Math.max(0, Math.sin(x * 0.009 + 2.6)) ** 6;
      for (let y = fl(top); y < 300; y++) lput(L.fore, x, y, M_SNOW, 0.3 + 0.18 * clamp(1 - (y - top) / 4, 0, 1) + (vn(x, y, 6, 511) - 0.5) * 0.12, 0, 0, -1, 0);
    }
  });
  // the storm sky: torn cloud racing past, heavier low over the sea (live, for its movement)
  function stormSky(cx, cy, z, t, beam) {
    for (let Y = ROW0; Y <= ROW1; Y++) {
      const wy = toLY(135 + (cy - 135) * 0.85, z, Y);
      if (wy > HORIZ + 1) break;
      const o = Y * W, g = clamp((wy + 60) / (HORIZ + 60), 0, 1);
      for (let X = 0; X < W; X++) {
        const wx = toLX(240 + cx * 0.3, z, X);
        const n = vn(wx * 0.6 + t * 22, wy * 1.4 - t * 2, 34, 521) * 0.65 + vn(wx * 1.3 + t * 40, wy * 2.2, 12, 522) * 0.35;
        const v = n * 0.9 + g * 0.35 - 0.12 + (BAYF[((Y & 7) << 3) | (X & 7)] - 0.5) * 0.14;
        BUF[o + X] = v > 0.78 ? 245 : v > 0.64 ? 244 : v > 0.5 ? 243 : v > 0.36 ? 242 : 241;
      }
    }
  }
  // the sea: dark swells rolling in, whitecaps, spray at the rocks; the ship's lights (and later the beam) on the water
  function stormSea(cx, cy, z, t, cliffX, glints) {
    for (let Y = ROW0; Y <= ROW1; Y++) {
      const wy = toLY(135 + (cy - 135) * 0.95, z, Y);
      if (wy < HORIZ) continue;
      const p = (wy - HORIZ) / 120, o = Y * W, dist = 1 / (p + 0.05);
      for (let X = 0; X < W; X++) {
        const wx = toLX(240 + cx * 0.95, z, X);
        // long swells rolling in (foreshortened toward the horizon), heaving; foam on their crests, streaks behind
        const sw = dist * 1.6 - t * 0.7 + n1(wx * 0.006 + 3, 531) * 2.2 * (1 - 0.75 * Math.min(1, p)) + n1(wx * 0.012 + 7, 534) * 0.35;
        const f = frac(sw), face = f < 0.35;                     // the lit face of each swell, then its long back
        const fn = vn(wx * (0.25 + p * 0.6), wy * (1.5 + p), 3 + p * 4, 532);
        let c = p < 0.06 ? 242 : face ? (f < 0.12 ? 242 : 241) : 240;
        if (f < 0.07 + 0.05 * p && fn > 0.5 - p * 0.15) c = fn > 0.75 ? 194 : p > 0.3 ? 246 : 245;      // whitecaps
        else if (f > 0.35 && f < 0.5 && fn > 0.78 - p * 0.1 && p > 0.15) c = 244;                       // foam streaks
        BUF[o + X] = c;
      }
    }
    for (const g of glints) {                                      // light lying on the water below a lamp
      for (let k = 0; k < g.n; k++) { const yy = g.y + 3 + k * 2.2 * z, xx = g.x + Math.sin(t * 3 + k * 1.7) * (1 + k * 0.5) * z; if (bay(fl(xx), fl(yy)) < (1 - k / g.n) * g.a) { P(xx, yy, g.c); P(xx + 1, yy, g.c2); } }
    }
  }
  // spray bursting up the cliff foot when a swell hits (a few times a second, somewhere along the rocks)
  function spray(cx, cy, z, t) {
    for (let b = 0; b < 3; b++) {
      const per = 2.3 + b * 0.7, u = frac(t / per + b * 0.37), sx = 262 + b * 26 + (ih(b, fl(t / per + b * 0.37), 541) - 0.5) * 20;
      if (u > 0.7) continue;
      const k = u / 0.7;
      for (let q = 0; q < 34; q++) {
        const a = -PI / 2 + (ih(q, b, 542) - 0.5) * 1.5, v = 60 + 90 * ih(q, b + 7, 542);
        const wx = sx + Math.cos(a) * v * k * 0.8 + k * 18, wy = 246 + Math.sin(a) * v * k + 120 * k * k;
        const X = toSX(240 + cx * 0.95, z, wx), Y = toSY(135 + (cy - 135) * 0.95, z, wy);
        if (bay(fl(X), fl(Y)) < 1 - k) { P(X, Y, k < 0.4 ? 194 : 246); if (ih(q, b, 543) < 0.3) P(X + 1, Y, 245); }
      }
    }
  }
  const f5X = (t) => lerp(-10, T5X - 2, eis(clamp((t - 22.75) / 2.4, 0, 1)) * 0.25 + clamp((t - 22.75) / 2.4, 0, 1) * 0.75);
  const f5Pose = (t) => {
    const ph = t * 3.3, inside = t > 25.15;
    const wagD = (u) => { const tt = t - u * 0.12; return 0.12 * Math.sin(TAU * 1.6 * tt) + 0.05 * Math.sin(TAU * 3.3 * tt); };
    let eyes = 1; for (const b of [23.5]) { const q = (t - b) / 0.14; if (q > 0 && q < 1) eyes = Math.abs(q * 2 - 1); }
    return { ph, gait: 1 - sstep(24.9, 25.15, t) * 0.7, A: 4.6, yaw: 0.4, tilt: 0.1, mouth: 1, tLift: -0.1, wagD, earN: 0.45, earF: 0.4, perk: 0.2, eyes, breath: t * TAU * 1.8, pitch: 0.04 };
  };
  const F5LIGHT = { sky: [-0.5, -0.85], rim: 0.6, amb: 0.3, z: 4, gain: 1.5 };
  function f5Cam(t) {
    const a = eis((t - 22.75) / 1.5), b = eio((t - 24.0) / 1.6);
    let z = lerp(1.25, 1.0, a), cx = lerp(208, 246, a) + drift(t, 9, 1), cy = lerp(126, 134, a);
    if (b > 0) { z = lerp(z, 1.8, b); const fx = T5X, fy = T5Y - 10, sx = lerp(toSX(cx, 1, fx), 250, b), sy = lerp(toSY(cy, 1, fy), 150, b); cx = fx - (sx + 0.5 - 240) / z; cy = fy - (sy + 0.5 - 135) / z; }
    return [cx, cy, z];
  }
  const cliff5 = (wy) => (wy < 200 ? 262 + (wy - HORIZ) * 0.1 : 262 + (wy - 200) * 0.2);
  // the whole place at time t: o = { lit (the lamp room alight 0..1), beamA, door (glow in the doorway), shipTurn (0..1),
  // setLamp (puts the kit's lantern light back after the reset) }
  function stormPlace(t, cam, o) {
    const [cx, cy, z] = cam, L = F5.L, lit = o.lit || 0;
    TAB = F5.rig; FOGT = F5FOG; SPK_SNOW = M_SNOW; SHAD.length = 0; LAMP.on = 0;
    if (o.setLamp) o.setLamp();
    stormSky(cx, cy, z, t);
    // far headlands; the harbour's lights along the far shore (right)
    for (let X = 0; X < W; X++) {
      const wx = toLX(240 + cx * 0.6, z, X), hy = HORIZ - 3 - 6 * fbm(wx, 0, 30, 3, 551) * sstep(330, 420, wx);
      for (let Y = Math.max(ROW0, fl(toSY(135 + (cy - 135) * 0.9, z, hy))); Y <= Math.min(ROW1, toSY(135 + (cy - 135) * 0.9, z, HORIZ + 1)); Y++) BUF[Y * W + X] = 241;
    }
    const harb = [];
    for (let k = 0; k < 14; k++) { const wx = 392 + ih(k, 0, 552) ** 1.6 * 70, wy = HORIZ - 1.5 - ih(k, 2, 552) ** 2 * 5 - (wx < 420 ? 2 : 0); const X = toSX(240 + cx * 0.6, z, wx), Y = toSY(135 + (cy - 135) * 0.9, z, wy); P(X, Y, 0.7 + 0.3 * Math.sin(t * 2 + k) > 0.85 ? 16 : 15); harb.push([X, Y]); }
    // the ship: lost and pitching; once the light is lit it comes about and heads for the harbour
    const sh = o.shipTurn || 0;
    const sxw = 592 - sh * 40, syw = 140 + 2.5 * Math.sin(t * 1.7 + 1), roll = 0.18 * Math.sin(t * 1.7) + 0.07 * Math.sin(t * 3.1);
    const sX = toSX(240 + cx * 0.95, z, sxw), sY = toSY(135 + (cy - 135) * 0.95, z, syw);
    stormSea(cx, cy, z, t, cliff5, [{ x: sX, y: sY, n: 6, a: 0.7, c: 15, c2: 241 }]);
    drawShip(sX, sY, 1.05 * z, roll * (1 - 2 * sstep(0.3, 0.7, sh)), true, sh);
    for (const [X, Y] of harb) glow(X, Y, 4 * z, T_LAMP, 0.3);
    if (lit > 0 && beamFx) beamFx(t, cam, lit, o.beamA || 0, false);
    if (LAMP.on) SHAD.push({ x: LAMP.x + 16 * z, y: toSY(cy, z, F5G) + 1, rx: 22 * z, ry: 3 * z, a: 0.5, lamp: 1 });
    comp(L.main, cx + 100, cy, z, 0);
    spray(cx, cy, z, t);
    const tw = drawTower(toSX(cx, z, T5X), toSY(cy, z, T5Y), T5S * z, { lit, door: o.door || 0 }, { sky: [-0.5, -0.85], z: 6 });
    drawCottage(toSX(cx, z, T5X - 122), toSY(cy, z, T5Y + 1), z, { z: 30 }, t);
    if (lit > 0 && beamFx) beamFx(t, cam, lit, o.beamA || 0, true, tw.lamp);
    return tw;
  }
  function f5Draw(t) {
    const cam = f5Cam(t), [cx, cy, z] = cam;
    const p = f5Pose(t), fwx = f5X(t), fxs = toSX(cx, z, fwx), fys = toSY(cy, z, F5G), S = F5S * z;
    const th = pendulum(t, (tt) => { foxPrep(f5Pose(tt), f5X(tt), F5G, F5S, 1, F5LIGHT); return [FOXOUT.mouth[0] / F5LS, FOXOUT.mouth[1] / F5LS]; }, 22.3);
    const inside = sstep(25.05, 25.25, t);
    foxPrep(p, fxs, fys, S, 1, F5LIGHT);
    const [mx, my] = FOXOUT.mouth, LS = F5LS * z, fl0 = lanternFlame(mx, my, LS, th);
    const setLamp = () => { LAMP.on = 1; LAMP.x = fl0[0]; LAMP.y = fl0[1]; LAMP.z = 0; LAMP.h = Math.max(4, (fys - fl0[1]) / z); LAMP.I = 1.15 * flick(t) * (1 - inside * 0.6); LAMP.R = 50 * z; LAMP.zoom = z; LAMP.rot = th * 2; };
    stormPlace(t, cam, { door: inside, setLamp });
    if (inside < 1) {
      foxPrep(p, fxs, fys, S, 1, F5LIGHT);
      drawFox(p, fxs, fys, S, 1, F5LIGHT);
      drawLantern(mx, my, LS, th, { lit: 1 });
    }
    lanternGlow(LAMP.x, LAMP.y, z, 1 - inside * 0.5);
    comp(F5.L.fore, 40 + cx * 1.25, 135 + (cy - 135) * 1.1, z, 0);
    snowfall(t, cx, cy, z, { dens: 1.3, wind: 70, fall: 1.4 });
  }
  let F5FOG = null;
  BUILDERS.push(() => { F5FOG = mkTab('324050', false); });
  let beamFx = null;                                             // (the beam is given by shot 6)
  shot(22.75, 25.3, (lt, t) => {
    if (t < 23.25) dissolve(() => f4Draw(t), () => f5Draw(t), eis((t - 22.75) / 0.5), 37);
    else f5Draw(t);
  });
