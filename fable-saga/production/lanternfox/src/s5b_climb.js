  /* ================================================================ 5b · The climb, 5c · the lamp room (25.3 … 25.6 – 30.0)
     Inside the tower: the curved stone wall, the iron spiral stair winding round its stone newel, slit windows full of
     storm. The kit races up, round and round (in front of the newel, then behind it), its lantern's light climbing the
     masonry with it; the camera rises with it, through the hatch in the floor, into the lamp room: tall panes all round
     with the storm beyond, the great lens dark on its pedestal, and the keeper on his stool, head bowed. The kit pops up
     out of the hatch; its light reaches him; he looks up. */
  const FI = { L: {}, rig: null, rigLit: null };
  const OYI = 320, SHAFT = 330, NEW_X = 240, STAIR_R0 = 14, STAIR_R1 = 150, WALL_R = 176;
  const TREAD_N = 33, TREAD_DY = SHAFT / (TREAD_N + 0.4), TREAD_DA = TAU / 16, TREAD_A0 = -PI / 2;
  const tread = (k) => ({ a: TREAD_A0 + k * TREAD_DA, y: SHAFT - 8 - k * TREAD_DY });
  const HATCH_X = 152, KEEP_X = 262, LENS_X = 372, LENS_Y = -100, LENS_S = 1.95;
  BUILDERS.push(() => {
    FI.rig = mkRig([0.06, 0.055, 0.08], [0.5, 0.52, 0.7], [1.0, 0.56, 0.24]);
    const L = FI.L, Hh = 960;
    // the wall, the newel and the treads behind it (back), and the treads and rail in front (front)
    L.back = mkLayer(480, Hh, { z0: -60 });
    const oy = OYI;
    for (let y = -6; y < SHAFT + 30; y++) for (let x = 0; x < 480; x++) {
      const dx = x - NEW_X, q = dx / WALL_R;
      if (Math.abs(q) >= 1) { lput(L.back, x, y + oy, M_STONE, 0.04, 120, 0, 0, 0); continue; }
      // the curved wall: courses of dressed stone, foreshortened toward the sides; mortar; damp streaks; slit windows
      const phi = Math.asin(q), course = fl(y / 9.5), cf = frac(y / 9.5), along = (phi * WALL_R) / 15 + (course & 1) * 0.5 + ih(course, 0, 601) * 0.3, af = frac(along);
      const mortar = cf < 0.1 || af < 0.05 / Math.max(0.25, Math.cos(phi));
      const stoneV = ih(course, fl(along), 602) - 0.5;
      let s = 0.36 + 0.2 * Math.cos(phi) + stoneV * 0.12 - (mortar ? 0.13 : 0) - vn(x * 0.4, y * 0.05, 6, 603) * 0.08;
      lput(L.back, x, y + oy, M_STONE, s, 50 + 60 * (1 - Math.cos(phi)), -q * 0.95, 0, 0);
    }
    // slit windows with deep splayed reveals (the storm shows through them, drawn live): transparent here
    for (const [wx, wy] of [[150, 260], [330, 165], [168, 70]]) {
      for (let y = wy - 16; y < wy + 16; y++) for (let x = wx - 9; x <= wx + 9; x++) {
        const dx = x - wx, top = wy - 12 + Math.abs(dx) * 0.3, inn = Math.abs(dx) < 2.5 && y > wy - 10 + Math.abs(dx);
        if (inn && y < wy + 13) { const i = (y + oy) * 480 + x; L.back.M[i] = 0; continue; }
        if (Math.abs(dx) < 8 && y > top && y < wy + 15) lput(L.back, x, y + oy, M_STONE, 0.14 + (dx < 0 ? 0.08 : -0.02) + (y > wy + 12 ? 0.1 : 0), 70, dx < 0 ? 0.6 : -0.6, 0, 0);
      }
    }
    // the door at the foot (an arch, ajar, the storm outside)
    for (let y = SHAFT - 44; y < SHAFT; y++) for (let x = 84; x < 122; x++) {
      const dx = x - 103, top = SHAFT - 30 - Math.sqrt(Math.max(0, 19 * 19 - dx * dx)) * 0.75;
      if (y < top) continue;
      if (Math.abs(dx) < 15) { const i = (y + oy) * 480 + x; if (dx > 4) lput(L.back, x, y + oy, M_WOOD, 0.22 + (frac(dx / 5) < 0.15 ? -0.08 : 0), 40, -0.6, 0, 0); else L.back.M[i] = 0; }
      else lput(L.back, x, y + oy, M_STONE, 0.32, 45, 0, 0, 0);
    }
    // the lamp room: floorboards (with the hatch), a parapet, the window frames (panes transparent: the storm is live)
    for (let y = -6; y < 6; y++) for (let x = 0; x < 480; x++) {
      if (Math.abs(x - HATCH_X) < 26 && y > -6) { if (y > 2) continue; }
      lput(L.back, x, y + oy, M_WOOD, (y < -4 ? 0.5 : 0.28) + (frac(x / 23) < 0.06 ? -0.12 : 0) + (vn(x * 0.3, y, 4, 611) - 0.5) * 0.1, 0, 0, y < -4 ? -1 : 0.4, 0);
    }
    for (let y = -250; y < -6; y++) for (let x = 0; x < 480; x++) {
      let m = 0, s = 0, nx = 0, ny = 0;
      if (y > -48) { m = M_STONE; s = 0.26 + (y < -44 ? 0.2 : 0) + (frac(x / 30 + (fl(y / 10) & 1) * 0.5) < 0.04 || frac(y / 10) < 0.1 ? -0.07 : 0); ny = y < -44 ? -1 : 0; }    // parapet
      else if (y < -222) { m = M_IRON; s = 0.16 + (frac(x / 40) < 0.08 ? 0.1 : 0); }                       // the roof's iron ribs
      else {
        const mul = frac(x / 96 + 0.5), bar = Math.min(mul, 1 - mul) * 96 < 3.2, transom = Math.abs(y + 136) < 2.5 || y < -216 || y > -54;
        if (bar || transom) { m = M_IRON; s = 0.2 + (bar && mul < 0.5 ? 0.1 : 0); nx = bar ? (mul < 0.5 ? -0.7 : 0.7) : 0; }
      }
      if (m) lput(L.back, x, y + oy, m, s, 30, nx, ny, 0);
    }
    // the lens's pedestal: an iron column with a brass collar
    for (let y = -46; y < -6; y++) for (let x = LENS_X - 18; x <= LENS_X + 18; x++) {
      const w = y > -12 ? 18 : y > -40 ? 11 : 16, q = (x - LENS_X) / w; if (Math.abs(q) > 1) continue;
      lput(L.back, x, y + oy, y < -40 ? M_BRASSM : M_IRON, 0.25 + 0.3 * Math.sqrt(1 - q * q) - q * 0.15, 10, q * 0.9, 0, 0);
    }
  });
  // outside the windows and the slits: the storm (dark sky, the faint sea, driving snow), live
  function outside(cx, cy, z, t, beamOut) {
    for (let Y = ROW0; Y <= ROW1; Y++) {
      const wy = toLY(cy, z, Y), o = Y * W;
      for (let X = 0; X < W; X++) {
        const wx = toLX(cx, z, X), b = BAYF[((Y & 7) << 3) | (X & 7)];
        if (wy > -92) {                                         // the sea far below: dark swells, a few whitecaps
          const sw = (wy + 92) * 0.16 - t * 0.7 + n1(wx * 0.01, 622) * 1.5, f = frac(sw);
          BUF[o + X] = f < 0.06 && vn(wx * 0.3, wy, 3, 624) > 0.55 ? 245 : f < 0.4 ? 241 : 240;
          continue;
        }
        // torn storm cloud racing past, lighter toward the horizon
        const n = vn(wx * 0.7 + t * 34, wy * 1.6, 22, 621) * 0.6 + vn(wx * 1.6 + t * 52, wy * 3, 8, 625) * 0.4;
        const v = n * 0.85 + clamp((wy + 220) / 130, 0, 1) * 0.3 + (b - 0.5) * 0.12;
        BUF[o + X] = v > 0.74 ? 244 : v > 0.58 ? 243 : v > 0.42 ? 242 : 241;
      }
    }
    for (let k = 0; k < 110; k++) {                              // snow driving past the glass in the wind
      const sp = 0.35 + ih(k, 2, 623) * 0.4, x = frac(ih(k, 1, 623) + t * sp) * 540 - 30, y = frac(ih(k, 3, 623) + t * sp * 0.45) * 260 + ROW0 - 20;
      const c = ih(k, 4, 623) < 0.3 ? 247 : 246;
      P(x, y, c); P(x - 1, y - 0.5, 245); if (ih(k, 5, 623) < 0.4) P(x - 2, y - 1, 244);
    }
  }
  // the stair, live (so the half in front can be cut away clear of the kit): iron plates round the newel, a lit top edge,
  // a bracket at the outer end; the rail along them. pass: 0 the back half, 1 the front half (cut short unless near kFox)
  function stairLive(cx, cy, z, pass, kFox) {
    const oyw = (y) => toSY(cy, z, y);
    for (let k = 0; k < TREAD_N; k++) {
      const T = tread(k), ca = Math.cos(T.a + TREAD_DA * 0.46), front = ca > 0;
      if ((pass === 1) !== front) continue;
      const near = Math.abs(k - kFox) < 2.6, r1 = front && !near ? 58 : STAIR_R1;
      const Y = oyw(T.y); if (Y < ROW0 - 4 || Y > ROW1 + 4) continue;
      const sa = Math.sin(T.a), sa2 = Math.sin(T.a + TREAD_DA * 0.92), zt = -STAIR_R1 * ca * 0.5;
      for (let r = STAIR_R0; r <= r1; r += 0.7) {
        const xa = toSX(cx, z, NEW_X + r * sa), xb = toSX(cx, z, NEW_X + r * sa2), fade = front && !near ? 1 - (r - STAIR_R0) / (58 - STAIR_R0) : 1;
        for (let X = fl(Math.min(xa, xb)); X <= Math.ceil(Math.max(xa, xb)); X++) {
          if (X < 0 || X >= W) continue;
          for (let d = 0; d < 3; d++) { const YY = fl(Y + d); if (YY < ROW0 || YY > ROW1) continue; if (fade < 1 && bay(X, YY) > fade * 1.4) continue; BUF[YY * W + X] = mc(M_IRON, d === 0 ? 0.5 : 0.18, lampAt(X, YY, zt, 0, d === 0 ? -0.75 : 0.5), X, YY); }
        }
      }
      if (r1 === STAIR_R1) { const xo = toSX(cx, z, NEW_X + STAIR_R1 * sa); for (let d = 0; d < 13 * z; d++) { const YY = fl(Y - d); if (YY >= ROW0 && YY <= ROW1 && xo >= 0 && xo < W) BUF[YY * W + fl(xo)] = mc(M_IRON, 0.3, lampAt(fl(xo), YY, zt, 0, 0), fl(xo), YY); } }
    }
    for (let a = TREAD_A0; a < TREAD_A0 + TREAD_N * TREAD_DA; a += 0.008) {
      const ca = Math.cos(a); if ((pass === 1) !== (ca > 0)) continue;
      const k = (a - TREAD_A0) / TREAD_DA; if (pass === 1 && Math.abs(k - kFox) > 3) continue;
      const X = fl(toSX(cx, z, NEW_X + STAIR_R1 * Math.sin(a))), Y = fl(toSY(cy, z, SHAFT - 8 - k * TREAD_DY - 13));
      if (X >= 0 && X < W && Y >= ROW0 && Y <= ROW1 - 1) { BUF[Y * W + X] = mc(M_IRON, 0.42, lampAt(X, Y, -STAIR_R1 * ca * 0.5, 0, -0.6), X, Y); BUF[(Y + 1) * W + X] = mc(M_IRON, 0.16, 0, X, Y + 1); }
    }
  }
  function newelLive(cx, cy, z) {
    const X0 = fl(toSX(cx, z, NEW_X - 13)), X1 = Math.ceil(toSX(cx, z, NEW_X + 13));
    for (let Y = ROW0; Y <= ROW1; Y++) {
      const wy = toLY(cy, z, Y); if (wy < -4 || wy > SHAFT + 30) continue;
      for (let X = X0; X <= X1; X++) { const q = (toLX(cx, z, X) - NEW_X) / 13; if (Math.abs(q) > 1) continue; const ring = frac(wy / 21) < 0.08; BUF[Y * W + X] = mc(M_STONE, 0.3 + 0.28 * Math.sqrt(1 - q * q) - q * 0.14 - (ring ? 0.1 : 0), lampAt(X, Y, 0, q * 0.9, 0), X, Y); }
    }
  }
  const climbA = (t) => { const u = clamp((t - 25.65) / 2.6, 0, 1); return TREAD_A0 + eis(u) * 0.12 * (TREAD_N - 1) * TREAD_DA + u * 0.88 * (TREAD_N - 1) * TREAD_DA; };
  const climbK = (t) => (climbA(t) - TREAD_A0) / TREAD_DA;
  const fiPose = (t, dir) => {
    const ph = t * 3.0;
    const wagD = (u) => { const tt = t - u * 0.12; return 0.12 * Math.sin(TAU * 1.6 * tt); };
    return { ph, gait: 1, A: 3.6, yaw: 0.35 + 0.5 * (1 - Math.abs(dir)), tilt: -0.1, pitch: -0.22, mouth: 1, tLift: 0.1, wagD, earN: 0.2, earF: 0.2, perk: 0.5, breath: t * TAU * 2, bob: -1.5 * Math.abs(Math.sin(ph * PI)) };
  };
  const FILIGHT = { sky: [-0.4, -0.9], rim: 0.4, amb: 0.3, z: 0, gain: 1.6 };
  // the kit on the stair at time t: world position, facing, how near (+ in front of the newel)
  function fiFox(t) {
    const a = climbA(t), k = climbK(t), y = SHAFT - 8 - k * TREAD_DY, r = 100;
    const x = NEW_X + r * Math.sin(a), dir = Math.cos(a + TREAD_DA * 0.46);
    return { x, y, f: dir >= 0 ? 1 : -1, dir, front: dir > 0 };
  }
  function fiCam(t) {
    const fx = fiFox(Math.min(t, 28.25));
    const cyA = clamp(fx.y - 20, -20, SHAFT - 100), rise = eio((t - 28.0) / 1.0);
    return [240 + drift(t, 11, 1.2), lerp(cyA, LENS_Y + 2, rise), 1];
  }
  function fiDraw(t) {
    TAB = FI.rig; FOGT = F5FOG; SPK_SNOW = 0; SHAD.length = 0; LAMP.on = 0;
    const [cx, cy, z] = fiCam(t), L = FI.L;
    outside(cx, cy, z, t);
    // the kit: on the stair, then up through the hatch onto the floor, a few steps toward the keeper
    let fx, fy, f = 1, front = true, p;
    if (t < 28.25) { const F = fiFox(t); fx = F.x; fy = F.y; f = F.f; front = F.front; p = fiPose(t, F.dir); }
    else {
      const u = eis((t - 28.25) / 0.45), w = eoc((t - 28.7) / 0.7);
      fx = lerp(fiFox(28.25).x, HATCH_X + 4, u) + 46 * w; fy = lerp(fiFox(28.25).y, 0, u) - 8 * bump(28.25, 28.75, t);
      f = 1; front = true;
      p = roomFoxPose(t);
    }
    const fxs = toSX(cx, z, fx), fys = toSY(cy, z, fy), S = 1.22 * z, LS = 1.02 * S;
    foxPrep(p, fxs, fys, S, f, FILIGHT);
    const th = 0.25 * Math.sin(t * 6.2) * (t < 28.7 ? 1 : 0.4) * f;
    const [mx, my] = FOXOUT.mouth, fl0 = lanternFlame(mx, my, LS, th);
    LAMP.on = 1; LAMP.x = fl0[0]; LAMP.y = fl0[1]; LAMP.z = front ? 0 : 60; LAMP.h = 10; LAMP.I = 1.25 * flick(t); LAMP.R = 70; LAMP.zoom = 1; LAMP.rot = th * 2;
    comp(L.back, 240, OYI + cy, z, 0);
    const kF = t < 28.25 ? climbK(t) : 99;
    const drawKit = () => { drawFox(p, fxs, fys, S, f, Object.assign({}, FILIGHT, { z: front ? 4 : 64 })); drawLantern(mx, my, LS, th, { lit: 1 }); };
    stairLive(cx, cy, z, 0, kF);
    if (!front) drawKit();                                        // (behind the newel on the far half of the turn)
    newelLive(cx, cy, z);
    stairLive(cx, cy, z, 1, kF);
    // the lamp room's furniture and its keeper (above the floor)
    if (toSY(cy, z, 0) > ROW0) {
      drawLens(toSX(cx, z, LENS_X), toSY(cy, z, LENS_Y), LENS_S * z, { lit: 0, rot: 0.3 });
      keeperAt(t, cx, cy, z);
    }
    if (front) drawKit();
    lanternGlow(LAMP.x, LAMP.y, z, 1);
    // the room's dark corners
    if (t < 28.25) for (let Y = ROW0; Y <= ROW1; Y++) for (let X = 0; X < W; X += 1) { const e = Math.abs(X - 240) / 240; if (e > 0.72 && bay(X, Y) < (e - 0.72) * 2.4) BUF[Y * W + X] = T_DARK[5][BUF[Y * W + X]]; }
  }
  // the kit once it is up in the room: it pops out, trots to the keeper's knee, looks up at him, tail going
  function roomFoxPose(t) {
    const ph = t * 2.6, walk = sstep(28.6, 28.8, t) * (1 - sstep(29.3, 29.5, t));
    const wagD = (u) => { const tt = t - u * 0.15; return 0.18 * Math.sin(TAU * 2.4 * tt) + 0.06 * Math.sin(TAU * 1.1 * tt); };
    let eyes = 1; for (const b of [29.9]) { const q = (t - b) / 0.14; if (q > 0 && q < 1) eyes = Math.abs(q * 2 - 1); }
    return { ph, gait: walk, A: 3.4 * walk, yaw: 0.5 + 0.2 * sstep(29.3, 29.7, t), tilt: -0.28 * sstep(29.2, 29.6, t), mouth: 1, tLift: 0.25, wagD, earN: 0.05, earF: 0.05, perk: 0.9, eyes, lookY: -0.8 * sstep(29.2, 29.6, t), lookX: 0.5, breath: t * TAU * 1.2, sit: 0.6 * sstep(29.4, 29.9, t) };
  }
  // the keeper in the lamp room: slumped, sad; the light reaches him; he looks up; hope
  function keeperAt(t, cx, cy, z) {
    const look = sstep(28.95, 29.35, t), hope = sstep(29.5, 30.2, t);
    const o = { lean: 0.32 - 0.22 * look, head: 0.55 - 0.75 * look, look: look, brow: 0.0 + 0.9 * hope, smile: -0.8 + 1.4 * hope, eyes: 1, handR: null, handL: null };
    let eb = 1; for (const b of [29.45]) { const q = (t - b) / 0.16; if (q > 0 && q < 1) eb = Math.abs(q * 2 - 1); }
    o.eyes = eb;
    return drawKeeper(toSX(cx, z, KEEP_X), toSY(cy, z, 0), 2.05 * z, -1, o, { sky: [-0.4, -0.9], amb: 0.3, z: 10, gain: 1.4 });
  }
  shot(25.3, 30.0, (lt, t) => {
    if (t < 25.8) dissolve(() => f5Draw(t), () => fiDraw(t), eis((t - 25.3) / 0.5), 39);
    else fiDraw(t);
  });
