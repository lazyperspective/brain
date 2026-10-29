  /* ================================================================ 4 · The aurora meadow (16.7 … 17.2 – 23.0)
     Out of the trees: a wide snowfield under a high moon and green aurora curtains, a herd of deer in the snow, birches at
     the wood's edge, and far off on the coast, under a dark bank of storm cloud over the sea, a lighthouse with no light.
     Camera: in the sky with the aurora (the falls' sky dissolving into this one), tilting down onto the meadow; tracking
     the kit as it trots among the deer, whose heads come up one after another as the light passes; the kit stops and
     looks at the lighthouse; the camera pushes in on it. */
  const F4 = { L: {}, rig: null };
  const OY4 = 300, F4S = 0.98, F4G = 206, F4LS = 1.02 * F4S;
  const LH4 = { x: 470, y: OY4 + 128 };                         // the far lighthouse's foot, in the far layer's coordinates
  const F4P = 0.4, F4PY = 0.92;                                  // the far layer's parallax                                  // the far lighthouse (its foot, world)
  const DEER = [
    { x: 92, y: 198, S: 0.82, f: 1, ph: 0.2, up0: 0 },
    { x: 128, y: 200, S: 0.8, f: 1, ph: 1.3, fawn: 1, up0: 0.1 },
    { x: 178, y: 193, S: 0.74, f: -1, ph: 2.1, antlers: 1, up0: 0 },
    { x: 232, y: 196, S: 0.76, f: -1, ph: 0.7, up0: 0.2 },
    { x: 276, y: 190, S: 0.66, f: 1, ph: 2.8, up0: 0 },
    { x: 318, y: 188, S: 0.6, f: -1, ph: 1.9, up0: 0.5 },
  ];
  BUILDERS.push(() => {
    F4.rig = mkRig([0.04, 0.06, 0.12], [0.58, 0.68, 0.96], [1.0, 0.56, 0.24]);
    const L = F4.L, H4 = 600;
    L.sky = mkLayer(800, H4);
    paintStars(L.sky, 300, OY4 + 120, 402, [206, 207, 194]);
    // the far coast: the sea from the wood's end to the right edge, a rocky headland with the lighthouse on it
    L.far = mkLayer(900, H4, { z0: 220 });
    const headTop = (x) => { const u = (x - 470) / 62; return u > -1 && u < 1 ? OY4 + 151 - 22 * Math.pow(1 - u * u, 0.6) - 3 * fbm(x, 0, 8, 2, 412) : 1e9; };
    for (let x = 0; x < 900; x++) {
      for (let y = OY4 + 110; y < OY4 + 182; y++) {
        const ht = headTop(x);
        if (y >= ht) {                                          // the headland: dark rock, snow on its crown and ledges
          const dd = y - ht, sn = dd < 1.5 + 2 * vn(x, 0, 4, 414) || (vn(x * 0.8, y * 1.6, 3, 415) > 0.78 && dd < 10);
          lput(L.far, x, y, sn ? M_SNOW : M_ROCK, sn ? 0.46 + (x < 470 ? 0.1 : -0.06) : 0.12 + (x < 470 ? 0.05 : 0) + (vn(x, y, 3, 418) - 0.5) * 0.08, 220, 0, -0.5, 0);
          continue;
        }
        if (y >= OY4 + 150) {                                   // the sea: near-black, a path of moon glitter
          const dy = y - OY4 - 150, gl = Math.abs(x - 300 - dy * 1.5) < 14 + dy * 2 && ih(fl(x / 2), y, 416) < 0.22 - dy * 0.008;
          lputC(L.far, x, y, gl ? (ih(x, y, 417) < 0.4 ? 207 : 206) : dy < 1 ? 205 : dy < 6 ? 203 : 202);
        }
      }
    }
    // the wood's edge behind the meadow
    L.mid = mkLayer(900, H4, { z0: 150 });
    for (let k = 0; k < 40; k++) { const x = k * 12 + ih(k, 1, 421) * 10; if (x > 300) break; const h = (28 + ih(k, 2, 421) * 40) * (1 - 0.65 * sstep(150, 300, x)); paintPine(L.mid, x, OY4 + 170 + ih(k, 3, 421) * 4, h, 7 + h * 0.16, 4210 + k, 100, 1); }
    for (let x = 0; x < 900; x++) { const ys = OY4 + 166 + 2 * Math.sin(x * 0.03) + (x > 330 ? (x - 330) * 0.02 : 0); for (let y = fl(ys); y < OY4 + 182; y++) lput(L.mid, x, y, M_SNOW, 0.55 + (y - ys < 1 ? 0.15 : 0), 100, 0, -1, 0); }
    // the meadow
    L.main = mkLayer(1000, H4, { z0: -128, recv: true });
    const surf = (x) => OY4 + 176 + 3 * Math.sin(x * 0.011 + 0.4) + 2 * Math.sin(x * 0.037 + 2);
    const depM = (y) => 128 + (F4G - (y - OY4)) * 3;
    paintGround(L.main, surf, depM, 431, { spark: 0.05, shadows: [{ x: 60, y: OY4 + 180, dx: 1.2, w: 14, a: 0.25 }, { x: 980, y: OY4 + 178, dx: 1.2, w: 12, a: 0.2 }] });
    // birches at the wood's edge: white trunks with dark marks, fine bare twigs dusted with snow
    for (const [bx, h, w] of [[34, 150, 4.5], [58, 120, 3.4], [96, 96, 2.8]]) paintBirch(L.main, bx, surf(bx) + 6, h, w, depM(surf(bx) + 6), 440 + bx);
    for (let k = 0; k < 60; k++) {
      const x = ih(k, 1, 451) * 1000, ys = surf(x) + 8 + ih(k, 2, 451) * 80, hgt = 4 + ih(k, 3, 451) * 10, ln = (ih(k, 4, 451) - 0.5) * 6;
      for (let b2 = 0; b2 < 3; b2++) { const bx = x + (b2 - 1) * 2, bh = hgt * (0.6 + 0.4 * ih(k, 5 + b2, 451)); for (let j = 0; j < bh; j++) lput(L.main, bx + ln * (j / bh) ** 2, ys - j, M_GRASS, 0.42 + 0.25 * j / bh, depM(ys), -0.5, 0, 0); }
    }
    L.fore = mkLayer(1300, H4, { z0: -128 });
    for (let x = 0; x < 1300; x++) {
      const top = OY4 + 240 + 4 * Math.sin(x * 0.017 + 0.8) + 3 * Math.sin(x * 0.06);
      for (let y = fl(top); y < H4; y++) lput(L.fore, x, y, M_SNOW, 0.42 + 0.22 * clamp(1 - (y - top) / 4, 0, 1) + (vn(x, y, 6, 461) - 0.5) * 0.14, 0, 0, -1, ih(x, y, 462) < 0.03 ? 1 + fl(ih(x, y, 463) * 250) : 0);
    }
  });
  function paintBirch(L, x, yb, h, w, z, seed) {
    for (let y = fl(yb - h); y < yb; y++) {
      const ww = w * (0.65 + 0.35 * (y - yb + h) / h), lean = 2 * Math.sin((yb - y) * 0.01 + seed);
      for (let dx = -Math.ceil(ww); dx <= Math.ceil(ww); dx++) {
        const q = dx / ww; if (Math.abs(q) > 1) continue;
        const mark = vn((x + dx) * 0.3, y * 0.35, 1.6, seed) > 0.72 && ih(fl(y / 2), 0, seed) < 0.6;
        lput(L, x + dx + lean, y, mark ? M_BARK : M_BIRCH, mark ? 0.15 : 0.45 + (1 - q * q) * 0.35 - q * 0.25, z, q * 0.9, 0, 0);
      }
    }
    // bare twigs: thin, splitting upward and out, each with a line of snow along its top
    for (let k = 0; k < 9; k++) {
      let px = x + 2 * Math.sin(seed), py = yb - h * (0.45 + 0.55 * ih(k, 1, seed)), a = -PI / 2 + (ih(k, 2, seed) - 0.5) * 2.2;
      for (let s = 0; s < 18 + ih(k, 3, seed) * 20; s++) {
        px += Math.cos(a); py += Math.sin(a); a += (ih(k, s, seed + 1) - 0.5) * 0.4 + (a < -PI / 2 ? 0.02 : -0.02);
        lput(L, px, py, M_BARK, 0.2, z, 0, 0, 0); if (s % 3 === 0) lput(L, px, py - 1, M_SNOW, 0.8, z, 0, -0.8, 0);
      }
    }
  }
  const f4X = (t) => 18 + 52 * Math.max(0, t - 17) - 52 * 0.6 * eis((t - 21.25) / 0.6) * 0 - (t > 21.3 ? 52 * (t - 21.3) - 52 * 0.35 * eoc(Math.min(1, (t - 21.3) / 0.35)) : 0);
  const f4Pose = (t) => {
    const stop = sstep(21.25, 21.6, t), ph = (t - 4.7) * 2.6 + 0.81;
    const wagD = (u) => { const tt = t - u * 0.15; return 0.1 * Math.sin(TAU * 1.3 * tt) + 0.06 * Math.sin(TAU * 2.6 * tt + 1); };
    let eyes = 1; for (const b of [18.9, 20.6, 22.4]) { const q = (t - b) / 0.14; if (q > 0 && q < 1) eyes = Math.abs(q * 2 - 1); }
    // it looks at each deer as it passes (a little up), then stops and looks out toward the sea and the lighthouse
    const look = bump(18.4, 19.4, t) * 0.6 + bump(19.6, 20.5, t) * 0.8 + bump(20.6, 21.2, t) * 0.5;
    return { ph, gait: 1 - stop, A: 4.0 * (1 - stop), yaw: 0.45 + 0.25 * look * 0 + 0.2 * stop, tilt: 0.05 - 0.18 * look - 0.14 * stop, mouth: 1, tLift: 0.05 + 0.1 * stop, wagD,
      earN: 0.1 - 0.15 * stop + 0.3 * bump(19.9, 20.1, t), earF: 0.1 - 0.15 * stop, perk: 0.6 + 0.4 * stop, eyes, lookY: -0.5 * look - 0.3 * stop, lookX: 0.4 + 0.5 * stop,
      breath: t * TAU * 1.4, pitch: -0.03, hy: -1.5 * stop };
  };
  const F4LIGHT = { sky: [-0.55, -0.85], rim: 0.9, amb: 0.4, z: 4, gain: 1.5 };
  function f4Cam(t) {
    const v = eio((t - 16.7) / 1.9), push = eio((t - 21.65) / 1.45);
    let cx = lerp(170, 236, eis((t - 16.7) / 4.8)) + drift(t, 7, 1), cy = lerp(-120, 132, v), z = 1;
    if (push > 0) {
      // the push in on the far lighthouse: it slides to a place right of centre and everything grows round it
      const oxF = 300 + cx * F4P, oyF = OY4 + 135 + (cy - 135) * F4PY;
      const sx0 = (LH4.x - oxF) + 240, sy0 = (LH4.y - 12 - oyF) + 135;
      z = lerp(1, 2.1, push);
      const sx = lerp(sx0, 300, push), sy = lerp(sy0, 128, push);
      cx = (LH4.x - (sx - 240) / z - 300) / F4P;
      cy = (LH4.y - 12 - (sy - 135) / z - OY4 - 135) / F4PY + 135;
    }
    return [cx, cy, z];
  }
  // the far lighthouse, drawn live (it stays crisp as the camera pushes in): a tapering white tower with two red bands,
  // a railed gallery, a dark lantern room (one cold glint on its glass), a domed cap; the keeper's cottage at its foot
  function farLighthouse(oxF, oyF, z, t) {
    const bx = toSX(oxF, z, LH4.x), by = toSY(oyF, z, LH4.y), S = z * 0.85;
    const h = 24 * S, w0 = 3.6 * S, w1 = 2.6 * S;
    for (let Y = fl(by - h - 9 * S); Y <= Math.ceil(by); Y++) {
      if (Y < ROW0 || Y > ROW1) continue;
      const u = (by - (Y + 0.5)) / h;
      for (let X = fl(bx - w0 - 3 * S); X <= Math.ceil(bx + w0 + 3 * S); X++) {
        if (X < 0 || X >= W) continue;
        const dx = X + 0.5 - bx;
        let c = -1;
        if (u >= 0 && u <= 1) {
          const w = lerp(w0, w1, u);
          if (Math.abs(dx) < w) {
            const q = dx / w, band = (u > 0.28 && u < 0.4) || (u > 0.6 && u < 0.72);
            const lv = 0.55 - q * 0.45;                          // lit from the moon's side
            c = band ? (lv > 0.6 ? 157 : lv > 0.3 ? 156 : 155) : (lv > 0.7 ? 194 : lv > 0.45 ? 247 : lv > 0.2 ? 246 : 245);
            if (Math.abs(u - 0.5) < 0.04 && Math.abs(q) < 0.25 && S > 1.2) c = 241;   // a small window
          }
        } else if (u > 1) {
          const v = (Y + 0.5 - (by - h)) / S;                     // above the tower: gallery, lantern room, cap
          if (v > -1.2 && v <= 0 && Math.abs(dx) < w1 + 1.4 * S) c = v > -0.5 ? 242 : 244;
          else if (v > -1.9 && v <= -1.2 && Math.abs(dx) < w1 + 1.3 * S && (fl(dx / Math.max(1, 0.7 * S)) & 1)) c = 243;     // railing
          else if (v > -5.2 && v <= -1.2 && Math.abs(dx) < w1 * 0.9) {
            const pane = Math.abs(dx) < 0.45 * S || Math.abs(Math.abs(dx) - w1 * 0.55) < 0.35 * S;
            c = pane ? 243 : (dx < -w1 * 0.3 && v < -3.5 ? 205 : 241);                      // dark glass, mullions, a cold glint
          }
          else if (v > -7.4 && v <= -5.2) { const ww = w1 * (1 - ((-5.2 - v) / 2.2) ** 2); if (Math.abs(dx) < ww) c = dx < 0 ? 243 : 241; }
          else if (v > -8.6 && v <= -7.4 && Math.abs(dx) < 0.5 * S) c = 243;
        }
        if (c >= 0) BUF[Y * W + X] = c;
      }
    }
    // the keeper's cottage beside it: a dark gable, a lit window (someone is still there)
    const hx = bx + 8 * S, hy = by;
    for (let Y = fl(hy - 6 * S); Y <= hy; Y++) for (let X = fl(hx - 4 * S); X <= Math.ceil(hx + 4 * S); X++) {
      if (Y < ROW0 || Y > ROW1 || X < 0 || X >= W) continue;
      const dx = X + 0.5 - hx, v = (hy - Y) / S;
      if (v < 3.2 ? Math.abs(dx) < 3.6 * S : Math.abs(dx) < (6.2 - v) * 1.4 * S) BUF[Y * W + X] = v > 3.2 ? (v > 3.6 ? 244 : 194) : 242;
    }
    if (S > 0.9) { rectF(hx - 1.6 * S, hy - 2.4 * S, Math.max(1, 1.2 * S), Math.max(1, 1.2 * S), 15); }
  }
  // a bank of storm cloud low over the sea: heaped puffs, moon-silvered tops, dark undersides
  const STORM4 = [];
  for (let k = 0; k < 30; k++) { const x = 360 + k * 17 + ih(k, 1, 471) * 10, e = sstep(350, 520, x); STORM4.push({ x, y: OY4 + 149 - (6 + ih(k, 2, 471) * 12) * e - 6 * e, r: (8 + ih(k, 3, 471) * 11) * (0.45 + 0.55 * e) }); }
  function stormBank(oxF, oyF, z, t) {
    for (const c of STORM4) {
      const cxw = c.x + t * 1.2, X0 = Math.max(0, fl(toSX(oxF, z, cxw - c.r * 1.3 - 2))), X1 = Math.min(W - 1, Math.ceil(toSX(oxF, z, cxw + c.r * 1.3 + 2)));
      const Y0 = Math.max(ROW0, fl(toSY(oyF, z, c.y - c.r - 2))), Y1 = Math.min(ROW1, Math.ceil(toSY(oyF, z, OY4 + 149)));
      for (let Y = Y0; Y <= Y1; Y++) for (let X = X0; X <= X1; X++) {
        const wx = toLX(oxF, z, X), wy = toLY(oyF, z, Y);
        if (wy > OY4 + 149.5) continue;
        const dx = (wx - cxw) / (c.r * 1.3), dy = (wy - c.y) / c.r, n = vn(wx * 1.3, wy * 1.3, 3.5, 472);
        const d = dx * dx + (dy > 0 ? dy * dy * 0.25 : dy * dy) - (n - 0.5) * 0.35;
        if (d > 1) continue;
        const lit = -dy * 0.9 - dx * 0.3;                         // the moon is high, to the left
        BUF[Y * W + X] = d > 0.78 && lit > 0.35 ? (bay(X, Y) < 0.6 ? 207 : 206) : lit > 0.5 ? 244 : lit > 0.05 ? 243 : dy > 0.4 ? 241 : 242;
      }
    }
  }
  // the moon: a soft full disc with faint maria and a halo, over everything in the sky
  function moon4(ox, oy, z) {
    const mx = toSX(ox, z, 268), my = toSY(oy, z, OY4 + 52), r = 11 * z;
    for (let Y = fl(my - 3 * r); Y <= my + 3 * r; Y++) for (let X = fl(mx - 3 * r); X <= mx + 3 * r; X++) {
      if (Y < ROW0 || Y > ROW1 || X < 0 || X >= W) continue;
      const d = Math.hypot(X + 0.5 - mx, Y + 0.5 - my), i = Y * W + X;
      if (d < r) { const ma = vn((X - mx) / z * 1.3 + 50, (Y - my) / z * 1.3 + 50, 5, 403); BUF[i] = d > r - 1.2 ? 194 : ma > 0.64 ? 193 : ma > 0.56 && bay(X, Y) < 0.5 ? 194 : 22; }
      else if (d < 3 * r && bay(X, Y) < 0.5 * Math.pow(1 - (d - r) / (2 * r), 2)) { const c = BUF[i]; if (c >= 202 && c <= 206 || c === 230) BUF[i] = d < r * 1.5 ? 207 : 206; }
    }
  }
  function f4Deer(o, k, t, cx, cy, z, foxX) {
    const X = toSX(cx, z, o.x), Y = toSY(cy, z, o.y);
    if (X < -60 || X > W + 60) return;
    // heads come up as the light comes near (a beat each), and stay up watching it go; ears flick; the fawn steps
    const near = sstep(95, 30, Math.abs(foxX - o.x) - 0) , passed = foxX > o.x + 20 ? 1 : 0;
    const up = clamp(Math.max(o.up0 + 0.08 * Math.sin(t * 1.3 + o.ph), sstep(0, 0.6, near) + passed * 0.8), 0, 1);
    const turn = sstep(0.2, 1, near) * 0.6;
    const earF = 0.4 * bump(o.ph % 1.7 + 18.2, o.ph % 1.7 + 18.4, t) + 0.5 * bump(19 + o.ph, 19.2 + o.ph, t) + 0.35 * near * Math.sin(t * 9);
    const fawnStep = o.fawn ? sstep(19.0, 19.3, t) * (1 - sstep(20.1, 20.4, t)) : 0;
    const x = o.fawn ? o.x - 18 * eis((t - 19.0) / 1.4) : o.x;
    const Xs = toSX(cx, z, x);
    // its shadow on the snow, long, away from the moon
    for (let j = 0; j < 4; j++) glow(Xs + 14 * z * o.S + j * 3, Y + 1, (12 + j * 3) * z * o.S, T_SHADE, 0.32, 1, 0.22);
    drawDeer(Xs, Y, o.S * z, o.f, { up, turn, earF, tail: 0.5 * bump(19.5 + o.ph * 0.3, 19.8 + o.ph * 0.3, t), antlers: o.antlers, fawn: o.fawn, gait: fawnStep, step: t * 1.8 }, { sky: [-0.55, -0.85], amb: 0.42, z: (F4G - o.y) * 3 });
  }
  function f4Draw(t) {
    TAB = F4.rig; FOGT = F4FOG; SPK_SNOW = M_SNOW; SHAD.length = 0; LAMP.on = 0;
    const [cx, cy, z] = f4Cam(t), L = F4.L, oy = (p) => OY4 + 135 + (cy - 135) * p;
    const p = f4Pose(t), fwx = f4X(t), fxs = toSX(cx, z, fwx), fys = toSY(cy, z, F4G), S = F4S * z;
    const th = pendulum(t, (tt) => { foxPrep(f4Pose(tt), f4X(tt), F4G, F4S, 1, F4LIGHT); return [FOXOUT.mouth[0] / F4LS, FOXOUT.mouth[1] / F4LS]; }, 16.7);
    foxPrep(p, fxs, fys, S, 1, F4LIGHT);
    const [mx, my] = FOXOUT.mouth, LS = F4LS * z, fl0 = lanternFlame(mx, my, LS, th);
    LAMP.on = 1; LAMP.x = fl0[0]; LAMP.y = fl0[1]; LAMP.z = 0; LAMP.h = Math.max(4, (fys - fl0[1]) / z); LAMP.I = 1.15 * flick(t); LAMP.R = 54 * z; LAMP.zoom = z; LAMP.rot = th * 2;
    SHAD.push({ x: fxs + 14 * z, y: fys + 1, rx: 26 * z, ry: 3.5 * z, a: 0.55, lamp: 1 });
    skyLive([202, 202, 203, 203, 204, 204, 205, 206, 207], 30, OY4 + 150, 300 + cx * 0.1, oy(0.86), z, 401);
    comp(L.sky, 300 + cx * 0.1, oy(0.86), z, 0);
    aurora(t, 300 + cx * 0.1, oy(0.86), z, 1.0, F4AUR);
    liveStars(t, 30, 491, 300 + cx * 0.1, oy(0.86), z, OY4 + 100, (c) => c >= 202 && c <= 205);
    moon4(300 + cx * 0.1, oy(0.86), z);
    const oxF = 300 + cx * F4P, oyF = oy(F4PY);
    stormBank(oxF, oyF, z, t);
    comp(L.far, oxF, oyF, z, 0.3);
    farLighthouse(oxF, oyF, z, t);
    comp(L.mid, 160 + cx * 0.7, oy(0.96), z, 0.3, { mist: 0.2, mistY: OY4 + 160, mistH: 20 });
    comp(L.main, cx + 150, oy(1), z, 0);
    // the herd, back to front, and the kit among them
    const order = DEER.map((o, k) => [o.y, k]).sort((a, b) => a[0] - b[0]);
    let foxDone = false;
    for (const [dy, k] of order) {
      if (!foxDone && dy > F4G) { drawFox(p, fxs, fys, S, 1, F4LIGHT); drawLantern(mx, my, LS, th, { lit: 1 }); foxDone = true; }
      f4Deer(DEER[k], k, t, cx, cy, z, fwx);
    }
    if (!foxDone) { drawFox(p, fxs, fys, S, 1, F4LIGHT); drawLantern(mx, my, LS, th, { lit: 1 }); }
    lanternGlow(LAMP.x, LAMP.y, z, 1);
    comp(L.fore, 120 + cx * 1.25, oy(1.05), z, 0);
    snowfall(t, cx, cy, z, { dens: 0.45 });
  }
  const F4AUR = [{ y: OY4 + 78, amp: 14, len: 95, k: 0.012, ph: 1.1, x0: 60, x1: 560, b: 1 }, { y: OY4 + 30, amp: 12, len: 90, k: 0.017, ph: 3.0, x0: 160, x1: 720, b: 0.8 }, { y: OY4 - 50, amp: 16, len: 110, k: 0.011, ph: 0.2, x0: 0, x1: 620, b: 0.85 }, { y: OY4 - 140, amp: 14, len: 100, k: 0.014, ph: 4.2, x0: 100, x1: 700, b: 0.7 }];
  let F4FOG = null;
  BUILDERS.push(() => { F4FOG = mkTab('425a90', false); });
  shot(16.7, 22.75, (lt, t) => {
    if (t < 17.25) dissolve(() => f3Draw(t), () => f4Draw(t), eis((t - 16.7) / 0.55), 35);
    else f4Draw(t);
  });
