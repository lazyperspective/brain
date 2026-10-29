  /* ================================================================ 6 · The light (30.0 – 36.0)
     The keeper leans down and takes the lantern from the kit's mouth; its light is on his face; he turns to the lens and
     sets it inside. The lens catches: ring after ring takes the flame, from the centre out, until the whole beehive burns
     (over half a second: never a flash). Outside, the beam blazes out over the black sea, sweeping through the snow, and
     the lost ship comes about for the harbour's lights. Inside again, in the warm lamp-room light, the kit turns once and
     curls up against the keeper's boots, tail over its nose, and he smiles down at it; snow falls past the glass; the
     beam goes round once more. Hold. */
  const T_LENS = 31.4, T_CATCH = 31.45;                       // the lantern set down inside; the light catching
  const lensCatch = (t) => eis(clamp((t - T_CATCH) / 0.55, 0, 1));
  const beamAngle = (t) => (t - T_CATCH) * 1.25 - 0.9;         // the lens turns: the beam's bearing (0 = straight at us)
  // the beam outside: a long cone from the lamp room, foreshortened as it turns, widening and fading with distance;
  // snow glittering in it; brightest (a flare at the lantern room) when it swings toward us
  beamFx = function (t, cam, lit, A, front, lamp) {
    const [cx, cy, z] = cam, lp = lamp || [toSX(cx, z, T5X), toSY(cy, z, T5Y - (TW.H + TW.gal + TW.room / 2) * T5S)];
    for (let k = 0; k < 2; k++) {                               // two beams, opposite each other
      const a = A + k * PI, ca = Math.cos(a), sa = Math.sin(a);
      if ((ca < 0) === front) continue;                           // (back beams behind the tower, front ones over it)
      const dirx = sa, diry = 0.12 + 0.05 * Math.abs(sa), L = 520 * z * (0.25 + 0.75 * Math.abs(sa)), w0 = 3 * z, w1 = (26 + 50 * (1 - Math.abs(sa))) * z;
      const ex = lp[0] + dirx * L, ey = lp[1] + diry * L;
      const x0 = Math.max(0, fl(Math.min(lp[0], ex) - w1)), x1 = Math.min(W - 1, Math.ceil(Math.max(lp[0], ex) + w1));
      const y0 = Math.max(ROW0, fl(Math.min(lp[1], ey) - w1)), y1 = Math.min(ROW1, Math.ceil(Math.max(lp[1], ey) + w1));
      const dx = ex - lp[0], dy = ey - lp[1], L2 = dx * dx + dy * dy, toward = Math.max(0, ca);
      for (let Y = y0; Y <= y1; Y++) for (let X = x0; X <= x1; X++) {
        const px = X + 0.5 - lp[0], py = Y + 0.5 - lp[1], u = (px * dx + py * dy) / L2;
        if (u < 0 || u > 1) continue;
        const qx = px - u * dx, qy = py - u * dy, d = Math.sqrt(qx * qx + qy * qy), wd = lerp(w0, w1, u);
        if (d > wd) continue;
        const across = 1 - d / wd, a2 = lit * (1 - u) * (1 - u * 0.4) * (0.35 + 0.65 * across * across) * (0.55 + 0.45 * toward) * (0.9 + 0.1 * Math.sin(u * 40 - t * 6));
        tintI(Y * W + X, X, Y, a2 > 0.55 ? T_WH : a2 > 0.25 ? T_GOLD : T_WARM, Math.min(0.9, a2 * 1.25));
      }
      // snow caught in the beam
      for (let q = 0; q < 70; q++) {
        const u = ih(q, k, 701), fx = lp[0] + dx * u, fy = lp[1] + dy * u, wd = lerp(w0, w1, u);
        const off = (frac(ih(q, k, 702) + t * (0.4 + ih(q, 3, 702) * 0.5)) - 0.5) * 2 * wd;
        const X = fx - dy / Math.sqrt(L2) * off, Y = fy + dx / Math.sqrt(L2) * off + frac(ih(q, 4, 702) + t * 0.6) * 6;
        if (bay(fl(X), fl(Y)) < lit * (1 - u)) P(X, Y, u < 0.4 ? 22 : 187);
      }
    }
    // the flare at the lantern room as a beam swings across us
    const face = Math.max(Math.cos(A), Math.cos(A + PI));
    glow(lp[0], lp[1], (16 + 40 * Math.pow(face, 6)) * z, T_WH, lit * (0.45 + 0.4 * Math.pow(face, 6)));
    glow(lp[0], lp[1], 60 * z, T_WARM, lit * 0.3);
  };
  // the room, alight or not: lens catch c (0..1)
  function roomDraw(t, cam, c, kitFn, keeperFn, beamOut) {
    TAB = FI.rig; FOGT = F5FOG; SPK_SNOW = 0; SHAD.length = 0;
    const [cx, cy, z] = cam, L = FI.L;
    outside(cx, cy, z, t);
    if (beamOut > 0) windowBeam(t, cx, cy, z, beamOut);
    comp(L.back, 240, OYI + cy, z, 0);
    drawLens(toSX(cx, z, LENS_X), toSY(cy, z, LENS_Y), LENS_S * z, { lit: c, catch: c, rot: 0.3 + Math.max(0, t - T_CATCH) * 0.35 });
    keeperFn();
    kitFn();
  }
  // outside the panes: the beam going round, a broad band of light swinging over the sea and through the snow
  function windowBeam(t, cx, cy, z, amt) {
    const A = beamAngle(t);
    for (let k = 0; k < 2; k++) {
      const s = Math.sin(A + k * PI), c = Math.cos(A + k * PI);
      if (c < -0.2) continue;
      const bx = 240 + s * 300, w = 60 + 80 * c;
      for (let Y = ROW0; Y <= ROW1; Y++) {
        const wy = toLY(cy, z, Y); if (wy > -48 || wy < -222) continue;
        for (let X = Math.max(0, fl(bx - w)), X1 = Math.min(W - 1, Math.ceil(bx + w)); X <= X1; X++) {
          const d = Math.abs(X - bx + (Y - 100) * 0.35) / w; if (d > 1) continue;
          tintI(Y * W + X, X, Y, T_WARM, amt * (1 - d) * (0.4 + 0.5 * c));
        }
      }
    }
  }
  // the keeper's acting through shot 6
  function keeper6(t, cx, cy, z, mouth) {
    const take = sstep(30.05, 30.45, t), lift = sstep(30.45, 30.8, t), turn = t > 30.85 ? 1 : 0, place = sstep(30.9, 31.38, t), back = sstep(31.55, 32.0, t);
    const smileUp = sstep(30.5, 31.0, t);
    let f = turn ? 1 : -1, o;
    const ks = 2.05 * z, kx = toSX(cx, z, KEEP_X), ky = toSY(cy, z, 0);
    if (!turn) {
      // lean down to the kit, take the bail, lift the lantern to his face
      const hx = (mouth[0] - kx) / (ks * f), hy = (mouth[1] - ky) / ks;
      const tgt = [lerp(lerp(14, hx, take), 15, lift), lerp(lerp(-24, hy - 1, take), -45, lift)];
      o = { lean: 0.15 + 0.42 * take - 0.4 * lift, head: 0.25 + 0.15 * take - 0.4 * lift, look: 0.6, brow: 0.9, smile: 0.6 + 0.4 * smileUp, eyes: 1, handR: tgt, handL: null };
    } else {
      // half up off the stool, turned to the lens, reaching into it; then the hand comes back
      const lx = (toSX(cx, z, LENS_X - 6) - kx) / ks, ly = (toSY(cy, z, LENS_Y + 6) - ky) / ks;
      const tgt = [lerp(lerp(12, lx, place), 14, back), lerp(lerp(-40, ly, place), -26, back)];
      o = { lean: 0.35 * place * (1 - back) + 0.1, stand: 0.45 * (1 - back), head: 0.05 - 0.1 * back, look: 0.4 + 0.4 * back, brow: 0.9 + 0.1 * back, smile: 0.7 + 0.3 * back, eyes: 1, handR: tgt, handL: null };
    }
    let eb = 1; for (const b of [31.3, 33.4]) { const q = (t - b) / 0.15; if (q > 0 && q < 1) eb = Math.abs(q * 2 - 1); }
    o.eyes = eb;
    const hand = [kx + f * (o.handR[0] + 0.8) * ks, ky + (o.handR[1] + 0.2) * ks];
    return { kx, ky, ks, f, o, hand };
  }
  const drawKeeper6 = (K) => drawKeeper(K.kx, K.ky, K.ks, K.f, K.o, { sky: [-0.4, -0.9], amb: 0.32, z: 10, gain: 1.5 });
  function f6Draw(t) {
    const cam = [240 + drift(t, 11, 1.2) * 0.5, LENS_Y + 2, 1], [cx, cy, z] = cam;
    const c = lensCatch(t);
    // the kit at the keeper's knee (sitting, watching), its lantern going from its mouth to his hand, then into the lens
    const kp = roomFoxPose(Math.min(t, 29.99));
    kp.sit = 0.6; kp.tilt = -0.3 + 0.15 * sstep(30.4, 30.8, t); kp.mouth = t < 30.45 ? 1 : 2; kp.happy = t > 31.9 && t < 32.4 ? 1 : 0;
    kp.wagD = (u) => { const tt = t - u * 0.15; return (0.18 + 0.1 * sstep(31.8, 32, t)) * Math.sin(TAU * 2.4 * tt); };
    const fxw = HATCH_X + 50, fxs = toSX(cx, z, fxw), fys = toSY(cy, z, 0), S = 1.22 * z, LS = 1.02 * S;
    foxPrep(kp, fxs, fys, S, 1, FILIGHT);
    const mouth = FOXOUT.mouth.slice();
    // where the lantern is: in the kit's mouth, then the keeper's hand, then inside the lens
    const K = { hand: null };
    let lpx = mouth[0], lpy = mouth[1], th = 0.08 * Math.sin(t * 5);
    TAB = FI.rig;
    const KP = keeper6(t, cx, cy, z, mouth), kk = KP.hand;
    if (t >= 30.45 && t < T_LENS) { lpx = kk[0]; lpy = kk[1] - 1; th = 0.25 * Math.sin((t - 30.45) * 7) * Math.exp(-(t - 30.45) * 1.5); }
    if (t >= T_LENS) { lpx = toSX(cx, z, LENS_X - 1); lpy = toSY(cy, z, LENS_Y - 8); th = 0; }
    const fl0 = lanternFlame(lpx, lpy, LS, th);
    LAMP.on = 1; LAMP.x = fl0[0]; LAMP.y = fl0[1]; LAMP.z = 0; LAMP.h = 12; LAMP.I = (1.25 + 0.6 * c) * flick(t); LAMP.R = 70 + 110 * c; LAMP.zoom = 1; LAMP.rot = th * 2;
    roomDraw(t, cam, c, () => {
      drawFox(kp, fxs, fys, S, 1, FILIGHT);
      if (t < T_LENS + 0.2) drawLantern(lpx, lpy, LS, th, { lit: 1 });
    }, () => { drawKeeper6(KP); }, 0);
    if (t >= T_LENS && c < 1) drawLantern(lpx, lpy, LS * 0.9, 0, { lit: 1 });      // seen through the open panel, until the light swamps it
    lanternGlow(LAMP.x, LAMP.y, z, 1);
    if (c > 0) { const lx = toSX(cx, z, LENS_X), ly = toSY(cy, z, LENS_Y); glow(lx, ly, 70 + 80 * c, T_WARM, 0.35 * c); glow(lx, ly, 30 + 30 * c, T_WH, 0.3 * c); }
  }
  // outside: the beam blazing over the sea, the ship coming about
  function f6Out(t) {
    const u = eis((t - 32.2) / 2.2), cam = [lerp(250, 236, u), lerp(126, 118, u), lerp(1.08, 1.0, u)];
    const lit = 0.75 + 0.25 * sstep(32.2, 32.8, t);
    stormPlace(t, cam, { lit, beamA: beamAngle(t), shipTurn: sstep(32.6, 34.0, t) });
    comp(F5.L.fore, 40 + cam[0] * 1.25, 135 + (cam[1] - 135) * 1.1, cam[2], 0);
    snowfall(t, cam[0], cam[1], cam[2], { dens: 1.1, wind: 55, fall: 1.2 });
  }
  // inside again: warm; the kit turns once and curls up against his boots; he smiles down at it; the beam goes round
  function f6End(t) {
    TAB = FI.rig;
    const pu = eis((t - 34.2) / 1.75), zz = 1 + 0.22 * pu, fyp = -74;   // a slow push in on the two of them
    const cam = [lerp(240, 252, pu) + drift(t, 11, 1.2) * 0.5, lerp(LENS_Y + 6, fyp, pu), zz], [cx, cy, z] = cam;
    const curl = eis((t - 34.55) / 0.85), turn = sstep(34.3, 34.6, t) * (1 - sstep(34.6, 34.75, t));
    const eyesC = 1 - sstep(35.15, 35.5, t);
    const p = { ph: t * 2.2, gait: turn, A: 2.2 * turn, curl, yaw: lerp(0.5, 0.9, curl), tilt: 0.05 * curl, mouth: 0, eyes: eyesC, sleep: t > 35.45 ? 1 : 0, perk: 0.4 * (1 - curl), earN: 0.3 * curl, earF: 0.3 * curl,
      wagD: (u) => 0.08 * Math.sin(TAU * 0.7 * (t - u * 0.3)) * (1 - curl * 0.7), breath: t * TAU * 0.6, tLift: 0 };
    const fxw = KEEP_X - 72 + 6 * curl, fxs = toSX(cx, z, fxw), fys = toSY(cy, z, 0), S = 1.55 * z;
    LAMP.on = 1; LAMP.x = toSX(cx, z, LENS_X); LAMP.y = toSY(cy, z, LENS_Y); LAMP.z = -10; LAMP.h = 100; LAMP.I = 1.7 * flick(t); LAMP.R = 190 * z; LAMP.zoom = z; LAMP.rot = 0;
    const kx = toSX(cx, z, KEEP_X), ky = toSY(cy, z, 0), ks = 2.05 * z;
    const rest = eis((t - 35.0) / 0.7);                          // his hand comes down to rest on the kit's back
    const handT = [lerp(13, (kx - (fxs + 2 * S)) / ks, rest), lerp(-29, (fys - 9 * S - ky) / ks, rest)];
    roomDraw(t, cam, 1, () => { foxPrep(p, fxs, fys, S, 1, FILIGHT); drawFox(p, fxs, fys, S, 1, Object.assign({}, FILIGHT, { gain: 1.25, amb: 0.48 })); }, () => {
      const settle = eis((t - 34.2) / 1.4);
      drawKeeper(kx, ky, ks, -1, { lean: 0.16 + 0.1 * settle, head: 0.3 + 0.12 * settle, look: 0.1, brow: 1, smile: 1, eyes: 1 - 0.6 * sstep(35.4, 35.8, t), handR: null, handL: null }, { sky: [-0.4, -0.9], amb: 0.34, z: 10, gain: 1.3 });
    }, 0.6);
    const lx = toSX(cx, z, LENS_X), ly = toSY(cy, z, LENS_Y), face = Math.pow(Math.max(0, Math.cos(beamAngle(t) * 2)), 8);
    glow(lx, ly, 110, T_WARM, 0.26); glow(lx, ly, 34 + 30 * face, T_WH, 0.2 + 0.3 * face);
    snowGlass(t, cx, cy, z);
  }
  // snow falling past the panes (beyond the glass, in front of the storm)
  function snowGlass(t, cx, cy, z) {
    for (let k = 0; k < 70; k++) {
      const x = frac(ih(k, 1, 711) + t * 0.05 * (ih(k, 2, 711) - 0.3)) * 480, y = frac(ih(k, 3, 711) + t * (0.08 + ih(k, 4, 711) * 0.06)) * 180 - 222;
      const X = toSX(cx, z, x + Math.sin(t + k) * 4), Y = toSY(cy, z, y);
      if (Y < ROW0 || Y > ROW1 || X < 0 || X >= W) continue;
      const i = fl(Y) * W + fl(X), cur = BUF[i];
      if (cur >= 240 && cur <= 246 || cur === 241) BUF[i] = ih(k, 5, 711) < 0.3 ? 194 : 246;
    }
  }
  shot(30.0, 32.25, (lt, t) => f6Draw(t));
  shot(32.25, 34.2, (lt, t) => {
    if (t < 32.75) dissolve(() => f6Draw(Math.min(t, 32.4)), () => f6Out(t), eis((t - 32.25) / 0.5), 41);
    else f6Out(t);
  });
  shot(34.2, 36.0, (lt, t) => {
    if (t < 34.7) dissolve(() => f6Out(t), () => f6End(t), eis((t - 34.2) / 0.5), 43);
    else f6End(t);
  });
