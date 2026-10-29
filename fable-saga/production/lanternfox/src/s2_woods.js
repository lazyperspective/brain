  /* ================================================================ 2 · Through the woods (4.75 – 10.45 … 11.0)
     The wide shot: the kit trots right through the deep blue fir wood with the lantern swinging from its mouth; the warm
     pool slides over the snow and up the trunks, the crust glitters where it passes, paw prints follow it. A pair of owls
     (a parent and a fluffy owlet) and then a third turn their heads to watch it go. Camera: tracking, a beat behind the
     kit. It ends behind a dark trunk sweeping past the lens (10.25–11.0), the frozen falls dissolving in behind it. */
  const F2 = { L: {}, rig: null };
  const F2S = 1.32, F2G = 208, F2LS = 1.02 * F2S;              // kit size, ground row, lantern size
  const F2OFF = 120;                                             // main layer x = world x + this
  // the kit's way: eased up to a trot, then steady (world px)
  const f2X = (t) => { const d = Math.max(0, t - 4.75); return 112 + 55 * d - 32 * 0.45 * (1 - Math.exp(-d / 0.45)); };
  const f2Cam = (t) => { const x = f2X(t - 0.28) + 44 + drift(t, 3, 1.2); return [x, 132 + drift(t, 4, 0.8), 1]; };
  // the owls: [world x, branch y, size, which tree]
  const OWLS = [{ x: 280, y: 109, S: 2.1, ph: 0.2 }, { x: 298, y: 111, S: 1.45, ph: 0.9, chick: 1 }, { x: 462, y: 124, S: 2.0, ph: 2.1 }];
  BUILDERS.push(() => {
    F2.rig = mkRig([0.04, 0.05, 0.13], [0.5, 0.58, 0.9], [1.0, 0.56, 0.24]);
    const L = F2.L;
    L.sky = mkLayer(560, 270);
    paintStars(L.sky, 70, 110, 202, [206, 207, 194]);
    L.far = mkLayer(700, 270, { z0: 200 });
    for (let k = 0; k < 58; k++) { const x = k * 12.5 + ih(k, 1, 211) * 8, h = 46 + ih(k, 2, 211) * 40; paintPine(L.far, x, 176 + ih(k, 3, 211) * 6, h, 8 + h * 0.13, 2110 + k, 100, 0); }
    for (let x = 0; x < 700; x++) for (let y = 172 + fl(3 * Math.sin(x * 0.05)); y < 270; y++) lput(L.far, x, y, M_SNOW, 0.55, 100, 0, -0.8, 0);
    L.mid = mkLayer(820, 270, { z0: 200 });
    for (let k = 0; k < 30; k++) { const x = k * 28 + ih(k, 1, 221) * 16, h = 80 + ih(k, 2, 221) * 70; paintPine(L.mid, x, 186 + ih(k, 3, 221) * 5, h, 14 + h * 0.16, 2210 + k, 100, 1); }
    for (let x = 0; x < 820; x++) { const ys = 183 + 3 * Math.sin(x * 0.031) + 2 * Math.sin(x * 0.11); for (let y = fl(ys); y < 270; y++) lput(L.mid, x, y, M_SNOW, 0.55 + (y - ys < 1 ? 0.2 : 0), 100, 0, -0.8, 0); }
    // the near wood: tall firs whose crowns go up out of frame, some bare dead branches low down (the owls' perches)
    L.back = mkLayer(980, 270, { z0: 0 });
    for (let k = 0; k < 10; k++) { const x = 30 + k * 98 + ih(k, 1, 231) * 50, h = 130 + ih(k, 2, 231) * 110; paintPine(L.back, x, 196 + ih(k, 3, 231) * 4, h, 26 + h * (0.1 + 0.06 * ih(k, 4, 231)), 2310 + k, 110, 2, { snow: 0.6 + 0.5 * ih(k, 5, 231) }); }
    { const surf = (x) => 193 + 3 * Math.sin(x * 0.02 + 1) + 2 * Math.sin(x * 0.07); paintGround(L.back, surf, (y) => 105, 235, { spark: 0.02, y1: 230 }); }
    // the kit's path: the snow, and the big trunks beside it (main plane, lit by the lantern as it passes)
    const W2 = 1000;
    L.main = mkLayer(W2, 270, { z0: -128, recv: true });
    const surfM = (x) => 200 + 3.5 * Math.sin(x * 0.017 + 0.4) + 2 * Math.sin(x * 0.047 + 2) + 1 * Math.sin(x * 0.13);
    const depM = (y) => 128 + (F2G - y) * 3;
    const TR = [[60, 26], [250, 30], [360, 18], [420, 32], [610, 24], [760, 34], [900, 22]];
    paintGround(L.main, surfM, depM, 241, { spark: 0.05, wells: TR.map(([x, w]) => ({ x: x + F2OFF, y: surfM(x + F2OFF) + 3, r: w * 1.6, a: 0.3 })),
      shadows: TR.map(([x, w]) => ({ x: x + F2OFF, y: surfM(x + F2OFF) + 2, dx: -1.5, w: w * 0.9, a: 0.25 })) });
    for (const [wx, w] of TR) paintTrunk(L.main, wx + F2OFF, surfM(wx + F2OFF) + 3, w * 0.5, depM(surfM(wx + F2OFF) + 3), 2400 + wx);
    // the owls' perches: dead branches stubbing out of two trunks, with snow along their tops
    paintBranch(L.main, 250 + F2OFF + 10, 111, 1, 56, depM(204), 251);
    paintBranch(L.main, 420 + F2OFF + 12, 124, 1, 50, depM(204), 252);
    paintBranch(L.main, 60 + F2OFF - 12, 96, -1, 40, depM(204), 253);
    paintBranch(L.main, 610 + F2OFF + 10, 112, 1, 30, depM(204), 254);
    // undergrowth: a few small firs half buried, dry grass
    for (const [x, h] of [[150, 40], [520, 48], [700, 36], [850, 52]]) paintPine(L.main, x + F2OFF, surfM(x + F2OFF) + 8, h, h * 0.42, 2500 + x, depM(surfM(x + F2OFF) + 8), 1);
    for (let k = 0; k < 40; k++) {
      const x = ih(k, 1, 261) * W2, ys = surfM(x) + 6 + ih(k, 2, 261) * 36, hgt = 6 + ih(k, 3, 261) * 12, lean = (ih(k, 4, 261) - 0.5) * 8;
      for (let b2 = 0; b2 < 3; b2++) { const bx = x + (b2 - 1) * 2, bh = hgt * (0.6 + 0.4 * ih(k, 5 + b2, 261)); for (let j = 0; j < bh; j++) { const u = j / bh; lput(L.main, bx + lean * u * u, ys - j, M_GRASS, 0.4 + 0.25 * u, depM(ys), -0.5, 0, 0); } }
    }
    // foreground: drifts along the bottom, a snowy shrub now and then
    L.fore = mkLayer(1300, 270, { z0: -128 });
    for (let x = 0; x < 1300; x++) {
      const top = 238 + 5 * Math.sin(x * 0.015 + 0.8) + 3 * Math.sin(x * 0.06) - 14 * Math.max(0, Math.sin(x * 0.0105 + 1.3)) ** 6;
      for (let y = fl(top); y < 270; y++) { const dd = y - top; lput(L.fore, x, y, M_SNOW, 0.36 + 0.22 * clamp(1 - dd / 5, 0, 1) + (vn(x, y, 6, 271) - 0.5) * 0.16, 0, -0.1, -0.85, ih(x, y, 272) < 0.03 ? 1 + fl(ih(x, y, 273) * 250) : 0); }
    }
    for (const x of [180, 610, 1020]) paintPine(L.fore, x, 262, 70, 40, 2700 + x, 0, 2, { dark: 1 });
  });
  // a big fir trunk: furrowed bark, a cool rim on the moon side, snow on the windward ridges, roots into the snow
  function paintTrunk(L, x, yb, hw, z, seed) {
    for (let y = 0; y < yb + 2; y++) {
      const flare = 1 + 0.55 * Math.pow(sstep(yb - 26, yb + 2, y), 1.6), w = hw * flare * (1 + 0.04 * Math.sin(y * 0.045 + seed) - 0.18 * (1 - y / yb));
      for (let dx = -Math.ceil(w); dx <= Math.ceil(w); dx++) {
        const q = dx / w; if (Math.abs(q) > 1) continue;
        const nx = q, nc = Math.sqrt(1 - q * q);
        // furrows: long vertical grooves that wander, plates between them
        const fu = vn(dx * 2.4 + seed, y * 0.08, 1.6, seed) , grain = vn(dx * 1.2, y * 0.5, 2.5, seed + 1);
        let s = 0.3 + 0.24 * nc - 0.1 * q + (fu < 0.32 ? -0.17 : fu > 0.72 ? 0.08 : 0) + (grain - 0.5) * 0.16;
        let m = M_BARK;
        if (q < -0.55 && fu > 0.6 && vn(dx, y * 0.2, 3, seed + 2) > 0.55) { m = M_SNOW; s = 0.55 + (q + 1) * 0.3; }   // snow stuck in the windward bark
        if (q < -0.86) s += 0.12;                                       // the cool rim
        lput(L, x + dx, y, m, s, z, nx * 0.95, 0, 0);
      }
    }
  }
  function paintBranch(L, x, y, dir, len, z, seed) {
    for (let s = 0; s < len; s++) {
      const u = s / len, bx = x + dir * s, by = y + u * u * 6 - Math.sin(u * 3) * 2, th = Math.max(1, 3.2 * (1 - u));
      for (let k = -th; k <= th; k++) lput(L, bx, by + k, M_BARK, 0.25 - k * 0.04, z, 0, k / th * 0.8, 0);
      const sn = Math.max(0, (2.6 - u * 2) * (0.6 + 0.6 * vn(s, 0, 4, seed)));
      for (let k = 1; k <= sn; k++) lput(L, bx, by - th - k + 1, M_SNOW, 0.7 + 0.2 * (k / sn), z, 0, -0.8, 0);
      if (s > 8 && ih(s, 1, seed) < 0.12) for (let j = 0; j < 7; j++) lput(L, bx + dir * j * 0.6, by - j, M_BARK, 0.2, z, 0, 0, 0);   // a twig
    }
  }
  const F2LIGHT = { sky: [-0.45, -0.9], rim: 0.75, amb: 0.36, z: 4, gain: 1.5 };
  const f2Pose = (t) => {
    const ph = (t - 4.7) * 2.6, g = sstep(4.7, 5.25, t);
    const wagD = (u) => { const tt = t - u * 0.15; return 0.1 * Math.sin(TAU * 1.3 * tt) + 0.08 * Math.sin(TAU * 2.6 * tt + 1); };
    let eyes = 1; for (const b of [6.1, 8.4, 9.9]) { const q = (t - b) / 0.14; if (q > 0 && q < 1) eyes = Math.abs(q * 2 - 1); }
    // it glances up at the owls as it passes under them
    const look = bump(6.5, 7.7, t) + bump(8.9, 9.9, t);
    return { ph, gait: g, A: 4.4 * g, yaw: 0.44 + 0.12 * look, tilt: 0.06 - 0.2 * look, mouth: 1, tLift: 0.05, wagD,
      earN: 0.1 + 0.25 * bump(7.9, 8.1, t), earF: 0.1, perk: 0.6, eyes, lookY: -0.6 * look, lookX: 0.4, breath: t * TAU * 1.4, pitch: -0.03 };
  };
  // paw prints left behind: where each foot was set down
  function f2Prints(t, cx, cy, z) {
    for (let leg = 0; leg < 4; leg++) {
      const off = [0, 0.5, 0.5, 0][leg], lx = [6.6, 5.1, -6.8, -5.5][leg], near = leg === 0 || leg === 2;
      for (let k = 0; k < 20; k++) {
        const tk = 4.7 + (k - off) / 2.6; if (tk > t - 0.05 || tk < 4.9) continue;
        const wx = f2X(tk) + (lx + 3.7) * F2S, wy = F2G + (near ? 1.5 : -1.2);
        const X = toSX(cx, z, wx), Y = toSY(cy, z, wy);
        if (X < -3 || X > W + 3) continue;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -2; dx <= 2; dx++) {
          const q = dx * dx / 4.5 + dy * dy / 1.4; if (q >= 1) continue;
          const xx = fl(X + dx), yy = fl(Y + dy); if (xx < 0 || xx >= W || yy < ROW0 || yy > ROW1) continue;
          BUF[yy * W + xx] = mc(M_SNOW, dy < 0 ? 0.26 : 0.4, lampAt(xx, yy, (F2G - wy) * 3, 0, -1) * 0.75, xx, yy);
        }
      }
    }
  }
  function f2Owl(o, t, cx, cy, z, lpx) {
    const X = toSX(cx, z, o.x), Y = toSY(cy, z, o.y);
    if (X < -30 || X > W + 30) return;
    // where the lantern is from the owl: the head follows it, a beat late; drowsy until the light comes near
    const near = sstep(150, 60, Math.abs(lpx - X)), dx = lpx - X;
    const yaw = clamp(Math.atan2(dx, 70) * 1.25, -1.35, 1.35) * sstep(0, 1, near * 1.4 + 0.2) + (o.chick ? 0.12 * Math.sin(t * 2.2) : 0);
    let open = lerp(0.4, 1, sstep(0.05, 0.5, near));
    const bq = (t * 0.7 + o.ph) % 2.6; if (bq < 0.12) open *= Math.abs(bq / 0.06 - 1);
    const roll = (o.chick ? 0.28 * sstep(0.3, 0.9, near) * Math.sign(dx) : 0.08 * Math.sin(t * 0.8 + o.ph)) * (dx > 0 ? 1 : 0.6);
    drawOwl(X, Y, o.S * z, { yaw, open, roll, lookY: 0.5, lookX: clamp(dx / 80, -1, 1), fluff: o.chick ? 1 : 0 }, { sky: [-0.45, -0.9], amb: 0.5, z: 6 });
  }
  function f2Draw(t) {
    TAB = F2.rig; FOGT = F1FOG; SPK_SNOW = M_SNOW; SHAD.length = 0; LAMP.on = 0;
    const [cx, cy, z] = f2Cam(t), L = F2.L;
    const p = f2Pose(t), fwx = f2X(t);
    const fxs = toSX(cx, z, fwx), fys = toSY(cy, z, F2G), S = F2S * z;
    // the lantern on its pendulum, from the kit's mouth
    const th = pendulum(t, (tt) => { foxPrep(f2Pose(tt), f2X(tt), F2G, F2S, 1, F2LIGHT); return [FOXOUT.mouth[0] / F2LS, FOXOUT.mouth[1] / F2LS]; }, 4.6);
    foxPrep(p, fxs, fys, S, 1, F2LIGHT);
    const [mx, my] = FOXOUT.mouth, LS = F2LS * z, fl0 = lanternFlame(mx, my, LS, th);
    LAMP.on = 1; LAMP.x = fl0[0]; LAMP.y = fl0[1]; LAMP.z = 0; LAMP.h = Math.max(4, (fys - fl0[1]) / z); LAMP.I = 1.15 * flick(t); LAMP.R = 58 * z; LAMP.zoom = z; LAMP.rot = th * 2;
    SHAD.push({ x: fxs - 22 * z, y: fys + 1.5 * z, rx: 34 * z, ry: 5 * z, a: 0.65, lamp: 1 });
    SHAD.push({ x: fxs + 2 * z, y: fys + 1, rx: 22 * z, ry: 3.5 * z, a: 0.45, lamp: 0 });
    skyLive(R_DUSK, 10, 200, 240 + cx * 0.06, 135 + (cy - 135) * 0.06, z, 201);
    comp(L.sky, 240 + cx * 0.06, 135 + (cy - 135) * 0.06, z, 0);
    liveStars(t, 30, 291, 240 + cx * 0.06, 135, z, 100, (c) => c >= 202 && c <= 205);
    comp(L.far, 200 + cx * 0.3, 135 + (cy - 135) * 0.3, z, 0.7, { mist: 0.25, mistY: 150, mistH: 30 });
    comp(L.mid, 160 + cx * 0.55, 135 + (cy - 135) * 0.55, z, 0.5, { mist: 0.3, mistY: 160, mistH: 30 });
    comp(L.back, 120 + cx * 0.8, 135 + (cy - 135) * 0.8, z, 0.2, { mist: 0.25, mistY: 180, mistH: 20 });
    comp(L.main, cx + F2OFF, cy, z, 0);
    f2Prints(t, cx, cy, z);
    for (const o of OWLS) f2Owl(o, t, cx, cy, z, LAMP.x);
    drawFox(p, fxs, fys, S, 1, F2LIGHT);
    drawLantern(mx, my, LS, th, { lit: 1 });
    lanternGlow(LAMP.x, LAMP.y, z, 1);
    comp(L.fore, 30 + cx * 1.4, 135 + (cy - 135) * 1.4, z, 0);
    snowfall(t, cx, cy, z, { dens: 0.9 });
  }
  shot(4.75, 10.8, (lt, t) => {
    if (t < 5.25) dissolve(() => f1Draw(t), () => f2Draw(t), eis((t - 4.75) / 0.5), 31);
    else f2Draw(t);
    if (t > 10.6) f23Trunk(t);
  });
