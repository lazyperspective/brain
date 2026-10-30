  /* ================================================================ 1 · The find (0.0 – 5.0)
     Blue dusk on Christmas Eve, deep in a fir wood. Close on a fox kit sniffing at a warm glow in a hump of snow: it
     paws the snow away, an old brass lantern comes out of it still burning, the light opens on the kit's face, it is
     delighted (eyes wide, a head-cock, a smile, a hop), and it takes the bail in its mouth. Camera: up from black, a slow
     push in, then a drift right as the kit turns to go; dissolving (4.75–5.25) to the wide shot of the woods. */
  const F1 = { L: {}, rig: null };
  const R_DUSK = [202, 203, 204, 205, 206, 207, 208, 209];
  BUILDERS.push(() => {
    F1.rig = mkRig([0.04, 0.05, 0.13], [0.5, 0.58, 0.9], [1.0, 0.56, 0.24]);
    const L = F1.L;
    // the sky: blue hour, deep overhead, a rose-lavender band low behind the trees; a young moon; the first stars
    L.sky = mkLayer(520, 270);
    paintStars(L.sky, 60, 110, 102, [206, 207, 194]);
    { const mx = 392, my = 60;                                   // a thin crescent, its dark side faintly lit
      for (let y = my - 9; y <= my + 9; y++) for (let x = mx - 9; x <= mx + 9; x++) {
        const d = Math.hypot(x - mx, y - my), d2 = Math.hypot(x - mx - 3.6, y - my - 1.8);
        if (d < 7.2 && d2 > 6.4) lputC(L.sky, x, y, d2 > 7.4 ? 22 : 194);
        else if (d < 7.2) lputC(L.sky, x, y, 205);
        else if (d < 9.5 && bay(x, y) < 0.5 * (9.5 - d) / 2.3) lputC(L.sky, x, y, 207);
      } }
    // far pines: a hazy wall of spires (fog does the rest)
    L.far = mkLayer(600, 270, { z0: 200, zk: 1 });
    for (let k = 0; k < 46; k++) { const x = k * 13.5 + ih(k, 1, 111) * 9, h = 52 + ih(k, 2, 111) * 44; paintPine(L.far, x, 178 + ih(k, 3, 111) * 6, h, 9 + h * 0.13, 1110 + k, 100, 0); }
    for (let x = 0; x < 600; x++) for (let y = 172 + fl(3 * Math.sin(x * 0.05)); y < 270; y++) lput(L.far, x, y, M_SNOW, 0.6, 100, 0, -0.8, 0);
    // mid pines
    L.mid = mkLayer(640, 270, { z0: 200, zk: 1 });
    for (let k = 0; k < 22; k++) { const x = k * 30 + ih(k, 1, 121) * 18, h = 90 + ih(k, 2, 121) * 60; paintPine(L.mid, x, 186 + ih(k, 3, 121) * 6, h, 15 + h * 0.15, 1210 + k, 100, 1); }
    for (let x = 0; x < 640; x++) { const ys = 183 + 3 * Math.sin(x * 0.031) + 2 * Math.sin(x * 0.11); for (let y = fl(ys); y < 270; y++) lput(L.mid, x, y, M_SNOW, 0.62 + (y - ys < 1 ? 0.2 : 0), 100, 0, -0.8, 0); }
    // the near wood: a big fir behind the kit (left), another right of the clearing, a snowbank
    L.back = mkLayer(680, 270, { z0: 0, zk: 1 });
    paintPine(L.back, 78, 200, 230, 70, 131, 110, 2);
    paintPine(L.back, 520, 198, 250, 76, 132, 110, 2);
    paintPine(L.back, 300, 194, 120, 34, 133, 120, 1);
    paintPine(L.back, 640, 196, 170, 48, 134, 115, 2);
    { const surf = (x) => 192 + 4 * Math.sin(x * 0.02 + 1) + 2.5 * Math.sin(x * 0.07); paintGround(L.back, surf, (y) => 105, 135, { spark: 0.02, y1: 232 }); }
    // the clearing: drifts, a log under snow at the right, dry stalks and a sapling poking through, the kit's ground
    L.main = mkLayer(700, 270, { z0: -128, zk: 1, recv: true });
    const surfM = (x) => 198 + 5 * Math.sin(x * 0.013 + 0.4) + 2.2 * Math.sin(x * 0.041 + 2) + 1.2 * Math.sin(x * 0.12);
    const depM = (y) => 128 + (214 - y) * 3;
    paintGround(L.main, surfM, depM, 141, { wells: [{ x: 452, y: 206, r: 40, a: 0.35 }], spark: 0.05,
      shadows: [{ x: 60, y: 202, dx: -1.6, w: 34, a: 0.3 }, { x: 330, y: 200, dx: -1.6, w: 16, a: 0.22 }, { x: 560, y: 200, dx: -1.6, w: 40, a: 0.3 }] });
    // its tracks: a line of small dents coming in from the left through the snow
    for (let k = 0; k < 14; k++) {
      const x = 8 + k * 11.5 + (k & 1) * 3, y = 214 + (k & 1 ? 3 : -1) + Math.sin(k * 0.7) * 2;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const q = dx * dx / 5 + dy * dy / 2.2; if (q < 1) { const i = (fl(y + dy)) * L.main.w + fl(x + dx); L.main.S[i] = clamp(L.main.S[i] - (q < 0.5 ? 40 : 22) + (dy < 0 ? -10 : 8), 0, 255); } }
    }
    // the fallen log, under a long cap of snow
    for (let x = 400; x < 520; x++) {
      const q = (x - 400) / 120, top = 196 - 9 * Math.sin(PI * clamp(q * 1.1, 0, 1)) + (ih(x, 0, 142) - 0.5);
      for (let y = fl(top); y < 210; y++) {
        const dd = y - top, r = 9 * Math.sin(PI * clamp(q * 1.1, 0, 1)) + 1;
        if (dd < r * 0.55) lput(L.main, x, y, M_SNOW, 0.9 - dd * 0.04 + (vn(x, y, 3, 143) - 0.5) * 0.2, depM(208), -0.2, -0.8, ih(x, y, 144) < 0.05 ? 1 + fl(ih(x, y, 145) * 250) : 0);
        else if (dd < r * 1.25) lput(L.main, x, y, M_BARK, 0.25 - (dd - r * 0.55) * 0.03 + (vn(x * 0.3, y * 2, 2, 146) - 0.5) * 0.3, depM(208), 0, 0.4, 0);
      }
    }
    // the log's sawn end: rings
    for (let y = 186; y < 210; y++) for (let x = 512; x < 526; x++) { const d = Math.hypot((x - 518) / 6, (y - 199) / 9); if (d < 1) lput(L.main, x, y, d > 0.82 ? M_BARK : M_WOOD, d > 0.82 ? 0.3 : 0.45 + 0.15 * Math.sin(d * 18), depM(208), 0.7, 0, 0); }
    // dry grass through the snow: thin pale stems, bent seed heads, a pinch of snow on some
    for (let k = 0; k < 26; k++) {
      const x = 14 + ih(k, 1, 147) * 660, ys = surfM(x) + 6 + ih(k, 2, 147) * 30, hgt = 7 + ih(k, 3, 147) * 15, lean = (ih(k, 4, 147) - 0.5) * 9;
      if (x > 200 && x < 300) continue;
      for (let b2 = 0; b2 < 3; b2++) {
        const bx = x + (b2 - 1) * 2.2, bh = hgt * (0.65 + 0.35 * ih(k, 5 + b2, 147)), bl = lean * (0.6 + 0.5 * ih(k, 9 + b2, 147));
        for (let j = 0; j < bh; j++) { const u = j / bh, xx = bx + bl * u * u; lput(L.main, xx, ys - j, M_GRASS, 0.42 + 0.25 * u, depM(ys), -0.5, 0, 0); }
        if (b2 === 1) for (let j = 0; j < 4; j++) lput(L.main, bx + bl + (bl > 0 ? 1 : -1) * j * 0.6, ys - bh + j * 0.8, M_GRASS, 0.75, depM(ys), 0, -0.5, 0);
        if (ih(k, 13 + b2, 147) < 0.4) lput(L.main, bx + bl, ys - bh - 1, M_SNOW, 0.95, depM(ys), 0, -0.9, 0);
      }
    }
    // a little sapling fir by the log
    paintPine(L.main, 382, 206, 66, 26, 148, depM(206), 1);
    // the foreground: a drift lip along the bottom, and a heavy bough hanging in from the top left
    L.fore = mkLayer(800, 270, { z0: -128, zk: 1 });
    for (let x = 0; x < 800; x++) {
      const top = 236 + 6 * Math.sin(x * 0.018 + 0.8) + 3 * Math.sin(x * 0.07) + (x > 520 ? -6 * sstep(520, 640, x) : 0);
      for (let y = fl(top); y < 270; y++) { const dd = y - top; lput(L.fore, x, y, M_SNOW, 0.46 + 0.22 * clamp(1 - dd / 5, 0, 1) + (vn(x, y, 6, 151) - 0.5) * 0.18, 0, -0.1, -0.85, ih(x, y, 152) < 0.03 ? 1 + fl(ih(x, y, 153) * 250) : 0); }
    }
  });
  // a fir bough hanging into the frame: a twig curving down from (x, y), side twigs, needles in sprays, snow on top
  function paintBough(L, x, y, len, wid, a, seed, z) {
    const ca = Math.cos(a), sa = Math.sin(a), pts = [];
    for (let s = 0; s <= len; s++) { const u = s / len; pts.push([x + ca * s - sa * u * u * len * 0.3, y + sa * s + ca * u * u * len * 0.3]); }
    const twig = (px, py, dx, dy, n, w0, sd) => {
      for (let s = 0; s < n; s++) {
        const u = s / n, bx = px + dx * s, by = py + dy * s + u * u * n * 0.15, w = w0 * (1 - u * 0.55);
        lput(L, bx, by, M_BARK, 0.12, z, 0, 0, 0);
        // needles: short strokes fanning down and out on both sides
        for (let k = 0; k < 2; k++) {
          const sd2 = k ? 1 : -1, ang = Math.atan2(dy, dx) + sd2 * (1.05 + 0.4 * ih(s, k, sd)) + 0.35, nl = w * (0.6 + 0.5 * ih(s, k + 3, sd));
          for (let q = 1; q < nl; q++) lput(L, bx + Math.cos(ang) * q, by + Math.sin(ang) * q, M_PINED, 0.12 + 0.14 * (q / nl) + (ih(s, q, sd + 5) - 0.5) * 0.1, z, Math.cos(ang) * 0.6, Math.sin(ang) * 0.4, 0);
        }
        // snow on the upper side, in clumps
        const sn = w * 0.55 * (0.35 + 0.65 * vn(s, 0, 5, sd + 7)) * (1 - u * 0.4);
        for (let q = 0; q < sn; q++) lput(L, bx + (ih(s, q, sd + 9) - 0.5), by - 1 - q, M_SNOW, 0.66 + 0.25 * (q / Math.max(1, sn)) + (vn(bx, by - q, 2, sd + 11) - 0.5) * 0.3, z, -0.2, -0.8, 0);
      }
    };
    twig(x, y, ca, sa, len, wid * 0.35, seed);
    for (let k = 0; k < 7; k++) {
      const s = fl(len * (0.12 + 0.12 * k)), p = pts[Math.min(len, s)], side = k & 1 ? 1 : -1;
      const da = a + side * (0.55 + 0.25 * ih(k, 1, seed)) + 0.4;
      twig(p[0], p[1], Math.cos(da), Math.sin(da), fl(wid * (0.6 + 0.5 * ih(k, 2, seed)) * (1 - k * 0.08)), wid * 0.3, seed + k * 13);
    }
  }

  /* ---------------------------------------------------------------- the performance */
  const F1S = 2.3;                                               // the kit's size here (px per unit at zoom 1)
  const F1LX = 252, F1LY = 215, F1LS = 1.02 * F1S;               // the lantern on the ground (its base), its size
  // the kit's track (world: main-layer pixels at zoom 1)
  const F1K = KF(
    { t: 0.0, x: 188, pitch: 0.14, tilt: 0.42, hy: 2.6, hx: 0.4, yaw: 0.34, perk: 0.4, tLift: -0.12, wa1: 0.1, wa2: 0, mouth: 0, wide: 0, lookX: 0.5, lookY: 0.6, sniff: 1, dig: 0, sq: 0, lift: 0 },
    { t: 1.5, x: 190, pitch: 0.16, tilt: 0.45, sniff: 1 },
    { t: 1.75, pitch: 0.22, tilt: 0.36, hy: 2.0, sniff: 0.2, dig: 1, tLift: 0.08, wa1: 0.06, wa2: 0.12, perk: 0.7 },
    { t: 2.7, pitch: 0.22, tilt: 0.36, dig: 1 },
    { t: 2.95, pitch: 0.02, tilt: 0.12, hy: 0.2, dig: 0, sniff: 0, wide: 1, perk: 1, yaw: 0.56, lookY: 0.4, lookX: 0.6, wa2: 0, wa1: 0.02, e: 'o' },
    { t: 3.3, yaw: 0.7, tilt: 0.06, wide: 1 },
    { t: 3.48, yaw: 0.86, tilt: -0.24, hx: -0.4, wa2: 0.34, tLift: 0.3, e: 'o' },
    { t: 3.62, sq: 0.2, lift: 0, e: 'i' },
    { t: 3.74, sq: -0.2, lift: 3.4, tilt: -0.1, e: 'o' },
    { t: 3.88, sq: -0.06, lift: 6.4, e: 'o' },
    { t: 4.02, sq: 0.0, lift: 3.0, e: 'i' },
    { t: 4.1, sq: 0.3, lift: 0, e: 'i' },
    { t: 4.26, sq: 0, yaw: 0.6, tilt: 0.1, hx: 0.4, x: 190, e: 'o' },
    { t: 4.5, x: 203, pitch: 0.16, tilt: 0.5, hy: 5.4, yaw: 0.4, wa2: 0.12, wide: 0.3, lookY: 0.8, lookX: 0.3 },
    { t: 4.62, mouth: 1 },
    { t: 4.95, x: 212, pitch: -0.04, tilt: 0.08, hy: 0, yaw: 0.42, wa2: 0.16, wide: 0, lookY: 0, lookX: 0.5, tLift: 0.1 },
  );
  const F1P = {};
  // three scrapes: when each reaches forward (each scrape takes 0.32 s)
  const F1SCR = [1.78, 2.1, 2.42];
  const f1Dig = (t) => { let p = 0; for (const s of F1SCR) p += sstep(s + 0.12, s + 0.3, t); return p / F1SCR.length; };
  function f1Pose(t) {
    const k = kt(F1K, t, F1P);
    const wagD = (u) => { const tt = t - u * 0.16; return k.wa1 * Math.sin(TAU * 1.1 * tt) + k.wa2 * Math.sin(TAU * 3.3 * tt); };
    let tilt = k.tilt + k.sniff * 0.05 * Math.sin(t * TAU * 4.6) * (0.6 + 0.4 * Math.sin(t * 2.3));
    let earN = 0.45 * bump(1.02, 1.2, t) + 0.3 * bump(3.0, 3.16, t) - 0.12 * k.perk, earF = 0.25 * bump(1.06, 1.24, t) - 0.12 * k.perk;
    // digging: the near forepaw reaches and scrapes back, three times
    let reach = 0;
    for (const s of F1SCR) { const q = (t - s) / 0.32; if (q > 0 && q < 1) reach = q < 0.35 ? eoc(q / 0.35) * 1.3 : 1.3 * (1 - eis((q - 0.35) / 0.65)); }
    let eyes = 1;
    for (const b of [0.55, 2.0, 4.38]) { const q = (t - b) / 0.14; if (q > 0 && q < 1) eyes = Math.abs(q * 2 - 1); }
    const happy = t > 3.52 && t < 3.98 ? 1 : 0;
    // the sniff: quick little jabs of the nose at the glow, the weight leaning in; a forepaw lifted, curious; then a
    // crouch and a wiggle of the rump before the first scrape (the fox's mousing pounce, small)
    let jab = 0; for (const s of [0.62, 0.76, 0.9, 1.22, 1.34, 1.46]) jab = Math.max(jab, Math.exp(-(((t - s) / 0.045) ** 2)));
    const lean = sstep(0.4, 0.9, t) * (1 - sstep(1.55, 1.75, t)), pawUp = bump(0.98, 1.5, t) ** 0.6, crouch = bump(1.45, 1.86, t);
    const wig = 0.9 * Math.sin((t - 1.5) * TAU * 7) * bump(1.5, 1.8, t);
    return {
      gait: t > 4.7 ? sstep(4.7, 5.0, t) : 0, ph: (t - 4.7) * 2.6, A: 3.6 * sstep(4.7, 5.0, t),
      pitch: k.pitch + 0.06 * lean, tilt: tilt + 0.06 * jab, hy: k.hy + 0.35 * jab, hx: k.hx + 0.75 * jab + 0.6 * lean, yaw: k.yaw, earN: earN - 0.1 * lean, earF: earF - 0.08 * lean, perk: k.perk + 0.3 * lean, tLift: k.tLift + 0.15 * crouch, wagD: crouch > 0.05 ? (u) => wagD(u) + 0.25 * crouch * Math.sin(TAU * 5 * (t - u * 0.12)) : wagD,
      pawUp, crouch, wig,
      mouth: happy ? 2 : k.mouth > 0.5 ? 1 : 0, eyes, happy, wide: k.wide, lookX: k.lookX, lookY: k.lookY,
      dig: k.dig, digReach: reach, sq: k.sq, lift: k.lift, breath: t * TAU * 0.9, whisk: 0,
    };
  }
  const F1LIGHT = { sky: [-0.45, -0.9], rim: 0.75, amb: 0.36, z: 4, gain: 1.6 };
  // the camera: (x, y) main-layer point at the screen centre, zoom
  function f1Cam(t) {
    const zp = 1 + 0.3 * eis(t / 3.5) - 0.12 * eis((t - 4.2) / 0.8);
    const fx = 226, fy = 192;                                    // the push in holds this point still on screen
    let x = fx - (fx - 240) / zp, y = fy - (fy - 135) / zp;
    x += 24 * eis((t - 4.3) / 1.2) + drift(t, 1, 0.8); y += drift(t, 2, 0.5);
    return [x, y, zp];
  }
  // the hump of snow over the lantern (it goes down as the kit digs), and what it throws
  function f1Mound(t, cam, dig) {
    const [cx, cy, z] = cam, sx = (wx) => toSX(cx, z, wx), sy = (wy) => toSY(cy, z, wy);
    const hgt = lerp(25, 3.2, dig), rx = lerp(27, 17, dig);
    const X0 = fl(sx(F1LX - rx - 2)), X1 = Math.ceil(sx(F1LX + rx + 2)), Y0 = fl(sy(F1LY - hgt - 3)), Y1 = Math.ceil(sy(F1LY + 6));
    for (let Y = Math.max(ROW0, Y0); Y <= Math.min(ROW1, Y1); Y++) for (let X = Math.max(0, X0); X <= Math.min(W - 1, X1); X++) {
      const wx = toLX(cx, z, X), wy = toLY(cy, z, Y), u = (wx - F1LX) / rx;
      if (Math.abs(u) >= 1) continue;
      const lump = (vn(wx * 1.4, 0, 3, 171) - 0.5) * 3 * (1 - dig * 0.5), top = F1LY + 2 - hgt * Math.pow(1 - u * u, 0.75) + lump;
      // after the digging: a ring of snow round the lantern's foot (the hollow it was in), lower in front of it
      if (wy < top || wy > F1LY + 4 + 2 * (1 - u * u)) continue;
      const dd = wy - top, d2 = Math.hypot(wx - F1LX, (wy - (F1LY - 7 * F1LS / F1S)) * 1.2);
      // light inside the snow: it glows warm round the lantern, through the thinning hump
      const sss = (0.75 + 0.6 * LAMP.I) * Math.exp(-Math.max(0, d2 - 4) / (6.5 + 7 * dig));
      const s = 0.42 + 0.3 * clamp(1 - dd / 3, 0, 1) - u * 0.18 + (vn(wx, wy, 2.5, 172) - 0.5) * 0.22;
      const l = lampAt(X, Y, 0, -u * 0.6, -0.6) * 0.4 + sss * 0.85;
      BUF[Y * W + X] = mc(M_SNOW, s, l, X, Y);
    }
    // snow thrown back by each scrape: a spray of clods, arcing and falling
    for (const s of F1SCR) {
      const g = t - s - 0.12; if (g < 0 || g > 0.8) continue;
      for (let k = 0; k < 22; k++) {
        const a = -PI * (0.62 + 0.3 * ih(k, 1, 173)), v = 70 + 90 * ih(k, 2, 173);
        const wx = F1LX - 14 + Math.cos(a) * v * g, wy = F1LY - 8 + Math.sin(a) * v * g + 260 * g * g;
        if (wy > F1LY + 8) continue;
        const X = fl(sx(wx)), Y = fl(sy(wy)), sz = ih(k, 3, 173) < 0.3 ? 2 : 1;
        const l = lampAt(X, Y, 0, 0, -0.5);
        for (let j = 0; j < sz; j++) for (let i = 0; i < sz; i++) P(X + i, Y + j, mc(M_SNOW, 0.95, l * 0.9, X + i, Y + j));
      }
    }
  }
  function f1Lamp(t) { // how alive the light is: dim and buried, waking as it is uncovered, then open
    const dig = f1Dig(t);
    return { dig, I: 0.35 + 0.45 * dig + 0.6 * sstep(2.78, 3.35, t), R: 20 + 16 * dig + 26 * sstep(2.78, 3.4, t) };
  }
  function f1Draw(t) {
    TAB = F1.rig; FOGT = F1FOG; SPK_SNOW = M_SNOW;
    const cam = f1Cam(t), [cx, cy, z] = cam, L = F1.L;
    const lay = (Ly, p, py) => [240 + (cx - 240) * p, 135 + (cy - 135) * py];
    // the kit and its lantern: where things are this frame (before anything is lit)
    const p = f1Pose(t), fk = kt(F1K, t, {});
    const S = F1S * z, fxs = toSX(cx, z, fk.x), fys = toSY(cy, z, 212);
    foxPrep(p, fxs, fys, S, 1, F1LIGHT);
    const mouth = FOXOUT.mouth;
    const lm = f1Lamp(t);
    // the lantern: on the ground until the kit takes it (4.62), then in its mouth
    const gpx = toSX(cx, z, F1LX), gpy = toSY(cy, z, F1LY - 15 * F1LS);
    const hold = sstep(4.56, 4.7, t);
    const lpx = lerp(gpx, mouth[0], hold), lpy = lerp(gpy, mouth[1], hold);
    let th = 0;
    if (t > 4.6) th = pendulum(t, (tt) => { const q = f1Pose(tt), kk = kt(F1K, tt, {}); foxPrep(q, kk.x, 212, F1S, 1, F1LIGHT); return [FOXOUT.mouth[0] / F1LS, FOXOUT.mouth[1] / F1LS]; }, 4.6) * sstep(4.6, 4.75, t);
    foxPrep(p, fxs, fys, S, 1, F1LIGHT);                         // (the pendulum borrowed the rig)
    const LS = F1LS * z, fl0 = lanternFlame(lpx, lpy, LS, th);
    LAMP.on = 1; LAMP.x = fl0[0]; LAMP.y = fl0[1]; LAMP.z = 3; LAMP.h = Math.max(4, (toSY(cy, z, lerp(215, 213, hold)) - fl0[1]) / z); LAMP.I = lm.I * flick(t); LAMP.R = lm.R * z; LAMP.zoom = z; LAMP.rot = th * 2;
    // the kit's own shadow, thrown back from the flame across the snow, and the soft one under it
    SHAD.push({ x: fxs - 18 * z, y: fys + 2 * z, rx: 42 * z, ry: 7 * z, a: 0.7 * sstep(2.6, 3.4, t) + 0.2, lamp: 1 });
    SHAD.push({ x: fxs + 2 * z, y: fys + 1, rx: 30 * z, ry: 4.5 * z, a: 0.4, lamp: 0 });
    // paint, back to front
    skyLive(R_DUSK, 20, 205, 240 + (cx - 240) * 0.06, 135 + (cy - 135) * 0.06, z, 101);
    comp(L.sky, 240 + (cx - 240) * 0.06, 135 + (cy - 135) * 0.06, z, 0);
    liveStars(t, 24, 191, 240 + (cx - 240) * 0.06, 135, z, 100, (c) => c >= 202 && c <= 205);
    const [a1, b1] = lay(0, 0.3, 0.3); comp(L.far, a1, b1, z, 0.7, { mist: 0.25, mistY: 150, mistH: 30 });
    const [a2, b2] = lay(0, 0.55, 0.55); comp(L.mid, a2, b2, z, 0.5, { mist: 0.3, mistY: 160, mistH: 30 });
    const [a3, b3] = lay(0, 0.8, 0.8); comp(L.back, a3, b3, z, 0.2, { mist: 0.25, mistY: 180, mistH: 20 });
    comp(L.main, cx, cy, z, 0);
    // the lantern (until it is lifted, half in its hump of snow), and the kit
    const drawL = () => drawLantern(lpx, lpy, LS, th, { lit: clamp(lm.I * 1.1, 0, 1), snow: 1 - sstep(2.2, 2.9, t) });
    if (t < 4.6) { drawL(); f1Mound(t, cam, lm.dig); }
    drawFox(Object.assign(p, { preHead: t >= 4.6 ? () => {} : null }), fxs, fys, S, 1, F1LIGHT);
    if (t >= 4.6) drawL();
    lanternGlow(LAMP.x, LAMP.y, z, clamp(lm.I, 0, 1));
    if (t < 3) glow(toSX(cx, z, F1LX), toSY(cy, z, F1LY - 6), 26 * z, T_LAMP, 0.32 * (1 - sstep(2.4, 3, t)));
    comp(L.fore, 240 + (cx - 240) * 1.4, 135 + (cy - 135) * 1.4, z, 0, { noSpark: false });
    snowfall(t, cx, cy, z, { dens: 0.8 });
    // up from black
    if (t < 1.0) tintAll(T_DARK, 1 - eis(t / 1.0));
  }
  let F1FOG = null;
  BUILDERS.push(() => { F1FOG = mkTab('6c74b0', false); });
  shot(0, 4.75, (lt, t) => f1Draw(t));
