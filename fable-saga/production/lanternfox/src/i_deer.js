  /* ================================================================ deer
     Red deer in the snow: barrel body on long legs, a neck that swings from grazing (muzzle in the snow) to alert (head
     high), a narrow head with a dark nose, big mobile ears, a pale rump patch and throat, a short tail that flicks. The
     stag carries antlers. Local units, origin on the ground under the body, x forward, y down. o: { up (0 graze .. 1
     alert), turn (head toward camera 0..1), earF (flick), tail, step (gait phase), gait, fawn }. */
  let DRX = 0, DRY = 0, DRS = 1, DRF = 1, DRL = null;
  const dX = (x) => DRX + DRF * x * DRS, dY = (y) => DRY + y * DRS;
  function deerShade(X, Y, s) {
    const S = DRS;
    if (-s < Math.max(0.65, 0.45 * S)) return 196;
    const n = sdNormal(s), nx = n[0], ny = n[1], nc = n[2], id = SDF.id, L = DRL;
    const lx = (X + 0.5 - DRX) / (S * DRF), ly = (Y + 0.5 - DRY) / S;
    const sdx = L.sky[0] * DRF, sdy = L.sky[1], dsk = nx * sdx + ny * sdy;
    let sk = L.amb + 0.5 * Math.max(0, dsk * 0.8 + nc * 0.35) + (1 - nc) * (1 - nc) * 0.7 * Math.max(0, dsk + 0.25) + 0.1 * Math.max(0, ny);
    let l = lampAt(X, Y, L.z, nx, Math.max(-0.98, ny)) * 1.4, m = M_DEER;
    if (id === 1) { // body: pale belly, white rump patch
      if (ly > L.belly) m = M_DEERW;
      if (lx < L.rumpX && ly < L.belly - 1 && ly > L.rumpY) m = M_DEERW;
      sk += furG(lx * 1.6, ly) * 0.08 - 0.05;
    } else if (id === 2) { if (SDF.side * DRF > 0 && SDF.lat > 0.3) m = M_DEERW; sk -= 0.02; }      // neck: a pale throat
    else if (id === 3) { if (SDF.u > 0.86) m = M_DEERK; else if (SDF.side * DRF > 0 && SDF.lat > 0.45) m = M_DEERW; } // head: dark nose, pale chin
    else if (id === 4) { m = SDF.lat < 0.55 && SDF.u < 0.7 ? M_DEERW : M_DEER; sk -= 0.08; }   // ears
    else if (id === 5) { if (SDF.u > 0.86) m = M_DEERK; sk -= 0.06; }                       // legs: dark hooves
    else if (id === 6) { m = M_DEERW; }                                                     // tail
    else if (id === 7) { m = M_DEERK; sk += 0.25; }                                         // antlers
    else if (id === 8) { sk -= 0.22; l *= 0.6; if (SDF.u > 0.86) m = M_DEERK; }             // far legs
    return mcq(m, sk, l, X, Y);
  }
  function drawDeer(x, y, S, f, o, light) {
    DRX = x; DRY = y; DRS = S; DRF = f;
    const fawn = o.fawn ? 1 : 0, k = fawn ? 0.7 : 1, up = clamp(o.up, 0, 1), g = o.gait || 0, ph = o.step || 0;
    const bodyY = -(fawn ? 26 : 34) * (1 + 0.02 * Math.sin(ph * TAU * 2) * g);
    const rump = [-11 * k, bodyY], chest = [10 * k, bodyY - 1.5 * k];
    DRL = Object.assign({}, light, { belly: bodyY + 4.4 * k, rumpX: rump[0] - 2.5 * k, rumpY: bodyY - 5 * k });
    // the neck: from the chest up and forward to the head; grazing swings it down to the snow
    const na = lerp(0.75, -1.05, up) + (o.nod || 0), nl = 15 * k;
    const nb = [chest[0] + 2 * k, chest[1] - 3 * k], nt = [nb[0] + Math.cos(na) * nl, nb[1] + Math.sin(na) * nl];
    const ha = lerp(1.25, 0.35, up) + (o.tilt || 0), hl = 9.5 * k;
    const hn = [nt[0] + Math.cos(ha) * hl, nt[1] + Math.sin(ha) * hl];
    const legs = [[chest[0] - 1.5 * k, 0, 0], [chest[0] + 1.2 * k, 1, 0.5], [rump[0] + 1.5 * k, 0, 0.5], [rump[0] - 1.2 * k, 1, 0]];
    const legPath = (hx, off, far) => {
      let fx = hx + (far ? 1.2 : 0) * k, fy = 0;
      if (g > 0) { const q = frac(ph + off); if (q < 0.6) fx += 5 * k * (1 - 2 * q / 0.6) * g; else { const u = (q - 0.6) / 0.4; fx += 5 * k * (-1 + 2 * eis(u)) * g; fy = -3.5 * k * Math.sin(PI * u) * g; } }
      return [fx, fy];
    };
    // far legs first
    sdBegin();
    for (const [hx, far, off] of legs) if (far) {
      const [fx, fy] = legPath(hx, off, 1), top = [hx, bodyY + 3 * k], kn = [lerp(hx, fx, 0.5) + 1.2 * k, lerp(top[1], fy, 0.5)];
      sdCap(dX(top[0]), dY(top[1]), dX(kn[0]), dY(kn[1]), 3.2 * k * S, 1.4 * k * S, 1.2 * S, 8, 0, 0.5);
      sdCap(dX(kn[0]), dY(kn[1]), dX(fx), dY(fy - 0.8), 1.2 * k * S, 0.9 * k * S, 0.6 * S, 8, 0.5, 1);
    }
    sdDraw(deerShade);
    sdBegin();
    // body, neck, head, near legs, tail
    sdCap(dX(rump[0]), dY(rump[1]), dX(chest[0]), dY(chest[1]), 6.8 * k * S, 7.2 * k * S, 2.5 * S, 1, 0, 1, 0.2 * S);
    sdCap(dX(nb[0]), dY(nb[1]), dX(nt[0]), dY(nt[1]), 4.6 * k * S, 3.0 * k * S, 2.5 * S, 2, 0, 1);
    sdCap(dX(nt[0]), dY(nt[1]), dX(hn[0]), dY(hn[1]), 3.4 * k * S, 1.6 * k * S, 1.5 * S, 3, 0, 1);
    for (const [hx, far, off] of legs) if (!far) {
      const [fx, fy] = legPath(hx, off, 0), top = [hx, bodyY + 3 * k], kn = [lerp(hx, fx, 0.5) + (hx > 0 ? -1.2 : 1.5) * k, lerp(top[1], fy, 0.5)];
      sdCap(dX(top[0]), dY(top[1]), dX(kn[0]), dY(kn[1]), 3.6 * k * S, 1.5 * k * S, 1.4 * S, 5, 0, 0.5);
      sdCap(dX(kn[0]), dY(kn[1]), dX(fx), dY(fy - 0.8), 1.3 * k * S, 1.0 * k * S, 0.6 * S, 5, 0.5, 1);
    }
    const tl = (o.tail || 0);
    sdCap(dX(rump[0] - 6 * k), dY(rump[1] - 2.5 * k), dX(rump[0] - 8 * k - tl * 1.5), dY(rump[1] + 1 * k - tl * 3), 1.8 * k * S, 1.1 * k * S, 0.8 * S, 6);
    sdDraw(deerShade);
    // ears and antlers on the head
    sdBegin();
    const ea = ha - PI / 2 - 0.5 + (o.earF || 0), eb = [nt[0] + Math.cos(ha) * 1.5 * k, nt[1] + Math.sin(ha) * 1.5 * k - 1.5 * k];
    for (const sd of [-1, 1]) {
      const a = ea + sd * 0.35 - (o.turn || 0) * sd * 0.4, L = 5.5 * k;
      sdCap(dX(eb[0] + sd * 0.6), dY(eb[1]), dX(eb[0] + Math.cos(a) * L + sd * 0.6), dY(eb[1] + Math.sin(a) * L), 1.2 * k * S, 1.6 * k * S, 0.4 * S, 4, 0, 1);
    }
    if (o.antlers) {
      for (const sd of [-1, 1]) {
        let px = eb[0] + 1.5 + sd * 0.8, py = eb[1] - 1, a = -PI / 2 - 0.35 * sd - 0.3;
        for (let seg = 0; seg < 4; seg++) {
          const L = 5 - seg * 0.6, qx = px + Math.cos(a) * L, qy = py + Math.sin(a) * L;
          sdCap(dX(px), dY(py), dX(qx), dY(qy), 0.75 * S, 0.55 * S, 0.3 * S, 7);
          const ta = a + 0.9, tx = qx + Math.cos(ta) * 2.6, ty = qy + Math.sin(ta) * 2.6;
          if (seg > 0) sdCap(dX(qx), dY(qy), dX(tx), dY(ty), 0.55 * S, 0.35 * S, 0.2 * S, 7);
          px = qx; py = qy; a -= 0.32 * sd + 0.1;
        }
      }
    }
    sdDraw(deerShade);
    // the eye: a dark glossy bead with a glint (warm when the lantern is near)
    const ex = dX(lerp(nt[0], hn[0], 0.3) + Math.cos(ha - PI / 2) * 0.9 * k), ey = dY(lerp(nt[1], hn[1], 0.3) + Math.sin(ha - PI / 2) * 0.9 * k);
    const er = Math.max(0.7, 0.95 * k * S);
    discF(ex, ey, er, 195); if (S >= 0.9) P(ex - DRF * 0.3, ey - 0.4, LAMP.on && Math.abs(ex - LAMP.x) < 80 ? 183 : 194);
    return { head: [dX(hn[0]), dY(hn[1])], body: [dX(0), dY(bodyY)] };
  }
