  /* ================================================================ owls
     A round tawny owl on a branch: egg body, big head that turns on its neck (the facial disc, eyes and beak slide round
     the head as it does, and the far tuft hides behind), ear tufts, folded barred wings, a speckled pale breast, talons
     gripping the branch. Local units, origin at the feet, y down. yaw: 0 facing us, ±1 profile (+ toward screen right);
     roll: a head tilt; open: eyelids (0 shut, 1 open), with soft upper lids for a drowsy look. */
  let OWX = 0, OWY = 0, OWS = 1, OWL = null, OWP = null;
  const oX = (x) => OWX + x * OWS, oY = (y) => OWY + y * OWS;
  function owlShade(X, Y, s) {
    const S = OWS;
    if (-s < Math.max(0.7, 0.45 * S)) return 196;
    const n = sdNormal(s), nx = n[0], ny = n[1], nc = n[2], id = SDF.id;
    const lx = (X + 0.5 - OWX) / S, ly = (Y + 0.5 - OWY) / S;
    const L = OWL;
    let sk = L.amb + 0.5 * Math.max(0, (nx * L.sky[0] + ny * L.sky[1]) * 0.75 + nc * 0.4) + (1 - nc) * (1 - nc) * 0.4 * Math.max(0, nx * L.sky[0] + ny * L.sky[1] + 0.2);
    let l = lampAt(X, Y, L.z, nx, Math.max(-0.98, ny)) * 1.3, m = M_OWL;
    const P = OWP;
    if (id === 1) { // the breast: pale, speckled with little dark chevrons; the back darker
      const front = Math.abs(lx) < 3.4 - 0.25 * Math.max(0, ly + 6) && ly > -9;
      if (front) { m = M_OWLW; const q = ih(fl(lx * 1.1 + 40), fl(ly * 1.2 + 40), 901); if (q < 0.22) { m = M_OWL; sk -= 0.1; } }
      else sk -= 0.08 + (ih(fl(lx * 1.4 + 40), fl(ly * 0.9 + 40), 902) < 0.3 ? 0.1 : 0);
    } else if (id === 3) { // wings: barred
      sk -= 0.1; if (frac(ly * 0.55 + lx * 0.1) < 0.28) sk -= 0.14;
      if (SDF.u > 0.8) sk -= 0.1;
    } else if (id === 2) { // the head: a pale facial disc round the eyes, turned with the head
      const F = P.F, r = P.hr, dcx = F.dc[0], dcy = F.dc[1];
      const du = (lx - dcx) / (r * (0.5 + 0.48 * F.fc)), dv = (ly - dcy) / (r * 0.74), dd = du * du + dv * dv;
      if (dd < 1 && F.fc > 0.05) { m = M_OWLW; sk += 0.06 - dd * 0.12; if (dd > 0.84) { m = M_OWL; sk -= 0.15; } }
      else { if (ih(fl(lx * 1.5 + 50), fl(ly * 1.5 + 50), 903) < 0.25) sk += 0.08; }
    } else if (id === 4) { sk -= 0.05; if (SDF.u > 0.6) sk -= 0.15; }
    else if (id === 5) { m = M_OWL; sk -= 0.12; }
    sk += furG(lx * 2.2, ly * 1.5) * 0.08;
    return mcq(m, sk, l, X, Y);
  }
  function drawOwl(x, y, S, o, light) {
    OWX = x; OWY = y; OWS = S; OWL = light;
    const yaw = clamp(o.yaw || 0, -1.6, 1.6), roll = o.roll || 0, open = o.open === undefined ? 1 : o.open, fluff = o.fluff || 0;
    const hc = [0 + Math.sin(yaw) * 0.3, -13.2 - (o.lift || 0)], hr = 4.9 + fluff * 0.4;
    const fc = Math.cos(yaw);                                   // how much the face is toward us
    const F = { fc, dc: [hc[0] + Math.sin(yaw) * hr * 0.62, hc[1] + 0.7] };
    OWP = { F, hr };
    sdBegin();
    // tail and wings behind, body, head
    sdCap(oX(0), oY(-4), oX(0.4), oY(1.6), 2.6 * S, 1.6 * S, 1.2 * S, 5);
    sdBall(oX(0), oY(-6.2), (5.2 + fluff * 0.5) * S, 2.5 * S, 1, 0.3 * S);
    sdBall(oX(0), oY(-3.6), (5.4 + fluff * 0.6) * S, 2.5 * S, 1, 0.3 * S);
    for (const sd of [-1, 1]) sdCap(oX(sd * 4.3), oY(-8.4), oX(sd * 3.6), oY(-1.0), 2.4 * S, 1.5 * S, 1.0 * S, 3, 0, 1);
    sdDraw(owlShade);
    sdBegin();
    const cr = Math.cos(roll), sr = Math.sin(roll);
    const hp = (dx, dy) => [hc[0] + dx * cr - dy * sr, hc[1] + dx * sr + dy * cr];
    sdBall(oX(hc[0]), oY(hc[1]), hr * S, 1.5 * S, 2, 0.25 * S);
    // ear tufts: two little feathered horns at the crown's corners, the far one dipping behind as the head turns
    for (const sd of [-1, 1]) {
      const az = sd * 0.75 + yaw * 0.9, vis = Math.cos(az);
      if (vis < -0.25) continue;
      const b = hp(Math.sin(az) * hr * 0.72, -hr * 0.62), tp = hp(Math.sin(az) * hr * 0.95 + sd * 0.6, -hr * 1.18);
      sdCap(oX(b[0]), oY(b[1]), oX(tp[0]), oY(tp[1]), 1.6 * S, 0.45 * S, 0.8 * S, 4, 0, 1);
    }
    sdDraw(owlShade);
    // the eyes and beak: on the face, which turns with the head (and rolls with it)
    if (fc > 0.02) {
      for (const sd of [-1, 1]) {
        const az = sd * 0.42 + yaw, ez = Math.cos(az); if (ez < 0.15) continue;
        const e = hp(Math.sin(az) * hr * 0.8, -0.2), ex = oX(e[0]), ey = oY(e[1]);
        const er = 1.55 * S, ew = er * (0.35 + 0.65 * ez);
        const lidY = ey - er + (1 - open) * 2 * er;
        for (let Y = fl(ey - er - 1); Y <= Math.ceil(ey + er + 1); Y++) for (let X = fl(ex - ew - 1); X <= Math.ceil(ex + ew + 1); X++) {
          if (Y < ROW0 || Y > ROW1 || X < 0 || X >= W) continue;
          const u = (X + 0.5 - ex) / ew, v = (Y + 0.5 - ey) / er, d = u * u + v * v;
          if (d > 1) continue;
          if (Y + 0.5 < lidY) { BUF[Y * W + X] = Y + 1.5 > lidY ? 196 : mcq(M_OWL, 0.4, lampAt(X, Y, light.z, 0, -0.3), X, Y); continue; }
          const pu = u - (o.lookX || 0) * 0.25, pv = v - (o.lookY || 0) * 0.2, pd = pu * pu + pv * pv;
          const lit = LAMP.on ? clamp(lampAt(X, Y, light.z, 0, 0) * 2, 0, 1) : 0;
          let c = d > 0.72 ? 196 : pd < 0.3 ? 195 : lit > 0.3 ? (v > 0.2 ? 59 : 58) : (v > 0.2 ? 15 : 58);
          if (S >= 1.2 && (u + 0.35) * (u + 0.35) + (v + 0.38) * (v + 0.38) < 0.09) c = 22;
          BUF[Y * W + X] = c;
        }
      }
      const bk = hp(Math.sin(yaw) * hr * 0.9, 1.4), bx = oX(bk[0]), by = oY(bk[1]);
      for (let k = 0; k < Math.max(2, Math.round(1.6 * S)); k++) { P(bx, by + k, 177); if (S > 1.2 && k < 1.2 * S) P(bx + (yaw > 0 ? 1 : -1), by + k, 178); }
    }
    // talons on the branch
    for (const sd of [-1, 1]) { const tx = oX(sd * 1.6), ty = oY(0.2); P(tx, ty, 174); P(tx + 1, ty, 173); P(tx - 1, ty + 1, 173); }
  }
