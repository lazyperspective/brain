  /* ================================================================ the keeper
     An old lighthouse keeper on a three-legged stool: heavy boots, dark wool trousers, a red knitted sweater with a cream
     band of snowflakes across the chest (rib knit, stitches you can see close up), a big white beard and moustache, a
     round ruddy nose, bushy white brows, a green knit cap with a turned-up band. Local units, origin on the floor under
     the stool, facing +x (toward the lens), y down. Pose: { lean (forward), head (down +), look (-1..1 up), brow (0 sad
     .. 1 lifted), smile (-1 sad .. 1), eyes (open), handR / handL targets [x, y] or null (resting on the knees), stand }. */
  let KPX = 0, KPY = 0, KPS = 1, KPF = 1, KPL = null, KPP = null;
  const kX = (x) => KPX + KPF * x * KPS, kY = (y) => KPY + y * KPS;
  function keeperShade(X, Y, s) {
    const S = KPS;
    if (-s < Math.max(0.7, 0.42 * S)) return SDF.id === 2 ? 155 : SDF.id === 7 ? 193 : 196;   // (sleeves fold into the sweater, the beard's edge is soft)
    const n = sdNormal(s), nx = n[0], ny = n[1], nc = n[2], id = SDF.id, L = KPL, P = KPP;
    const lx = (X + 0.5 - KPX) / (S * KPF), ly = (Y + 0.5 - KPY) / S;
    const sdx = L.sky[0] * KPF, sdy = L.sky[1], dsk = nx * sdx + ny * sdy;
    let sk = L.amb + 0.45 * Math.max(0, dsk * 0.8 + nc * 0.4) + (1 - nc) * (1 - nc) * 0.45 * Math.max(0, dsk + 0.3);
    let l = lampAt(X, Y, L.z, nx, Math.max(-0.98, ny)) * (L.gain || 1.3), m = M_WOOL;
    if (id === 1 || id === 2) { // the sweater: rib knit, a cream band of snowflakes across the chest
      const band = ly > P.bandY0 && ly < P.bandY1, rib = frac(lx * 0.9 + (id === 2 ? SDF.u * 6 : 0));
      if (band) {
        const bx = frac(lx / 5.5 + 0.5), by = (ly - P.bandY0) / (P.bandY1 - P.bandY0);
        const flake = Math.abs(bx - 0.5) < 0.09 || (Math.abs(by - 0.5) < 0.12 && Math.abs(bx - 0.5) < 0.38) || Math.abs(Math.abs(bx - 0.5) - Math.abs(by - 0.5) * 0.8) < 0.07;
        m = flake ? M_WOOLC : M_WOOL;
        if (by < 0.12 || by > 0.88) m = M_WOOLC;
      }
      if (S >= 1.6 && rib < 0.22) sk -= 0.1;                 // the knit's ribs
      if (S >= 2.2 && ih(fl(lx * 2), fl(ly * 2.4), 951) < 0.18) sk += 0.07;
      if (id === 2) { sk -= 0.1 - 0.12 * (1 - SDF.lat); if (SDF.u > 0.88) sk -= 0.12; }   // sleeves: their own roundness, the cuffs
    } else if (id === 3) { m = M_SKIN; sk += 0.05; }          // hands
    else if (id === 4) { m = M_TROU; sk -= 0.05; if (S >= 2 && frac(lx * 0.7) < 0.2) sk -= 0.06; }
    else if (id === 5) { m = M_BOOT; sk += 0.04; if (SDF.u > 0.85) sk -= 0.15; }
    else if (id === 6) { m = M_SKIN; }                       // face
    else if (id === 7) { m = M_BEARD; sk += 0.3 + furG(lx * 3, ly * 1.2) * 0.14; l *= 1.2; }   // beard and brows
    else if (id === 8) { m = M_CAP; if (ly > P.capBand) { sk += 0.1; if (frac(lx * 1.1) < 0.3) sk -= 0.12; } else if (frac(lx * 1.1 + ly * 0.3) < 0.25) sk -= 0.08; }
    else if (id === 9) { m = M_WOOD; }                       // the stool
    else if (id === 10) { m = M_SKIN; sk += 0.15; if (SDF.lat < 0.5 && nx * KPF < 0.2) m = M_SKIN; }          // the nose
    return mcq(m, sk, l, X, Y);
  }
  function drawKeeper(x, y, S, f, o, light) {
    KPX = x; KPY = y; KPS = S; KPF = f; KPL = light;
    const lean = o.lean || 0, st = o.stand || 0;
    const hip = [lerp(0, 2, st), lerp(-24, -36, st)];
    const ca = Math.cos(lean), sa = Math.sin(lean);
    const chest = [hip[0] + sa * 19, hip[1] - ca * 19], neck = [hip[0] + sa * 25, hip[1] - ca * 25];
    const hd = o.head || 0, lookUp = o.look || 0;
    const head = [neck[0] + 3.8 + Math.sin(hd) * 4.5, neck[1] - 7.6 + hd * 2.6];
    KPP = { bandY0: chest[1] - 2.2, bandY1: chest[1] + 3.4, capBand: head[1] - 7.4, hx: head[0], hy: head[1] };
    sdBegin();
    // the stool
    sdCap(kX(-7), kY(-22.5), kX(7), kY(-22.5), 1.6 * S, 1.6 * S, 0.4 * S, 9);
    for (const lx of [-6, 6]) sdCap(kX(lx), kY(-21.5), kX(lx * 1.3), kY(0), 1.0 * S, 0.9 * S, 0.3 * S, 9);
    sdDraw(keeperShade);
    sdBegin();
    // the far leg and arm (behind)
    const knee2 = [hip[0] + lerp(10, 3, st), lerp(-24.5, -18, st)], foot2 = [knee2[0] + 2, -2.2];
    sdCap(kX(hip[0] - 1), kY(hip[1] + 1), kX(knee2[0] - 1), kY(knee2[1]), 4.8 * S, 4.0 * S, 1.5 * S, 4);
    sdCap(kX(knee2[0] - 1), kY(knee2[1]), kX(foot2[0] - 1), kY(foot2[1] - 2), 3.6 * S, 3.2 * S, 1.2 * S, 4);
    sdCap(kX(foot2[0] - 2.5), kY(-2.4), kX(foot2[0] + 4.5), kY(-2.2), 2.6 * S, 2.4 * S, 1 * S, 5, 0, 1);
    sdDraw((X, Y, s) => { const c = keeperShade(X, Y, s); return c === 196 ? 196 : T_SHADE[3][c]; });
    sdBegin();
    // near leg
    const knee = [hip[0] + lerp(11, 3, st), lerp(-24, -18, st)], foot = [knee[0] + 2.5, -2.4];
    sdCap(kX(hip[0]), kY(hip[1]), kX(knee[0]), kY(knee[1]), 5.0 * S, 4.2 * S, 1.6 * S, 4);
    sdCap(kX(knee[0]), kY(knee[1]), kX(foot[0]), kY(foot[1] - 2), 3.8 * S, 3.3 * S, 1.2 * S, 4);
    sdCap(kX(foot[0] - 3), kY(-2.6), kX(foot[0] + 5), kY(-2.4), 2.8 * S, 2.6 * S, 1 * S, 5, 0, 1);
    // the body in its sweater: a big soft barrel
    sdCap(kX(hip[0] - 1), kY(hip[1] - 2), kX(chest[0]), kY(chest[1]), 9.6 * S, 9.2 * S, 3 * S, 1, 0, 1, 0.25 * S);
    sdBall(kX(chest[0] + 1.5), kY(chest[1] + 4), 8.2 * S, 3 * S, 1, 0.25 * S);
    sdCap(kX(chest[0]), kY(chest[1]), kX(neck[0]), kY(neck[1]), 7.4 * S, 4.6 * S, 2.5 * S, 1);
    sdDraw(keeperShade);
    // arms: shoulder → elbow → hand (two-bone IK); resting on the knees unless reaching
    const armPass = (near) => {
      sdBegin();
      const sh = [chest[0] + (near ? 1.5 : -1.5), chest[1] - 2.5];
      let tgt = (near ? o.handR : o.handL) || [knee[0] + (near ? 1 : -1.5), knee[1] - 5.2];
      { const dx = tgt[0] - sh[0], dy = tgt[1] - sh[1], d = Math.hypot(dx, dy); if (d > 19.2) tgt = [sh[0] + dx / d * 19.2, sh[1] + dy / d * 19.2]; }   // (within reach)
      const el = ik2(sh[0], sh[1], tgt[0], tgt[1], 10, 10, near ? 1 : 1);
      sdCap(kX(sh[0]), kY(sh[1]), kX(el[0]), kY(el[1]), 3.8 * S, 3.2 * S, 1.5 * S, 2, 0, 0.5);
      sdCap(kX(el[0]), kY(el[1]), kX(tgt[0]), kY(tgt[1]), 3.2 * S, 2.8 * S, 1.2 * S, 2, 0.5, 1);
      sdBall(kX(tgt[0] + 0.8), kY(tgt[1] + 0.2), 2.5 * S, 1 * S, 3);
      sdDraw(near ? keeperShade : (X, Y, s) => { const c = keeperShade(X, Y, s); return c === 196 ? 196 : T_SHADE[2][c]; });
      return tgt;
    };
    const handL = armPass(false);
    // the head: a big round face, the cap set back on it, white hair below it, a full white beard under the chin
    sdBegin();
    sdBall(kX(head[0]), kY(head[1]), 8.2 * S, 1.5 * S, 6);
    sdDraw(keeperShade);
    sdBegin();
    sdBall(kX(head[0] - 6.0), kY(head[1] - 0.8), 2.8 * S, 1.2 * S, 7, 0.45 * S);      // white hair under the cap, at the back
    sdBall(kX(head[0] - 4.4), kY(head[1] + 2.6), 3.0 * S, 1.2 * S, 7, 0.5 * S);       // the side whiskers
    const by = head[1] + 4.8 - lookUp * 0.6;
    sdBall(kX(head[0] + 3.2), kY(by + 3.2), 5.0 * S, 2 * S, 7, 0.6 * S);
    sdBall(kX(head[0] + 0.8), kY(by + 5.6), 4.6 * S, 2 * S, 7, 0.6 * S);
    sdBall(kX(head[0] + 5.4), kY(by + 1.0), 3.0 * S, 1.4 * S, 7, 0.5 * S);
    sdDraw(keeperShade);
    sdBegin();
    const cap = [head[0] - 2.4, head[1] - 6.4 + hd * 0.4];
    sdCap(kX(cap[0] - 5.2), kY(cap[1] + 1.4), kX(cap[0] + 4.6), kY(cap[1] - 0.4), 2.0 * S, 2.0 * S, 1 * S, 8);
    sdBall(kX(cap[0] - 1.0), kY(cap[1] - 2.8), 5.0 * S, 2 * S, 8);
    sdBall(kX(cap[0] - 3.6), kY(cap[1] - 7.6), 1.9 * S, 0.6 * S, 8, 0.35 * S);     // a little pompom
    sdDraw(keeperShade);
    // the face's features, over the head
    keeperFace(head, o, S);
    const handR = armPass(true);
    return { head: [kX(head[0]), kY(head[1])], handR: [kX(handR[0]), kY(handR[1])], handL: [kX(handL[0]), kY(handL[1])], lap: [kX(knee[0] - 2), kY(knee[1] - 6)], boot: [kX(foot[0] + 4), kY(-1)] };
  }
  function keeperFace(head, o, S) {
    const hx = head[0], hy = head[1], lookUp = o.look || 0, brow = clamp(o.brow || 0, 0, 1), smile = o.smile || 0, open = o.eyes === undefined ? 1 : o.eyes;
    const ex = hx + 4.3, ey = hy - 1.3 - lookUp * 0.5;
    const E = [kX(ex), kY(ey)];
    // the eye: a small dark oval; a heavy lid when he is sad; a glint when the light finds it
    const er = Math.max(0.9, 1.05 * S), lidK = clamp(open * (0.5 + 0.5 * brow + 0.25 * lookUp), 0, 1);
    for (let Y = fl(E[1] - er - 1); Y <= Math.ceil(E[1] + er + 1); Y++) for (let X = fl(E[0] - er * 0.8 - 1); X <= Math.ceil(E[0] + er * 0.8 + 1); X++) {
      const u = (X + 0.5 - E[0]) / (er * 0.8), v = (Y + 0.5 - E[1]) / er;
      if (u * u + v * v > 1) continue;
      if (v < 1 - 2 * lidK) { if (v > 1 - 2 * lidK - 0.55) P(X, Y, 252); continue; }
      P(X, Y, 195);
    }
    if (lidK > 0.45 && S >= 1.5) P(E[0] - KPF * 0.35 * S, E[1] - 0.35 * S + (1 - lidK) * er, LAMP.on && LAMP.I > 0.3 ? 183 : 194);
    // the brow: a bushy white tuft; sad, it slants down at the outer end; hope lifts it
    const inner = [ex + 2.4, ey - 2.1 - brow * 1.6], outer = [ex - 2.6, ey - 2.7 + (1 - brow) * 1.8 - brow * 0.6];
    for (let k = 0; k <= 10; k++) {
      const u = k / 10, bx = kX(lerp(outer[0], inner[0], u)), byy = kY(lerp(outer[1], inner[1], u) - Math.sin(u * PI) * 0.5);
      P(bx, byy, 187); P(bx, byy - 1, 194); if (S > 1.8) { P(bx, byy + 1, 193); if (k % 3 === 0) P(bx - KPF, byy - 2, 194); }
    }
    // the nose: big, round and ruddy
    sdBegin(); sdBall(kX(hx + 8.0), kY(hy + 1.5), 2.5 * S, 0.5 * S, 10); sdDraw(keeperShade);
    // moustache: two soft white drifts under the nose
    sdBegin(); sdBall(kX(hx + 7.0), kY(hy + 4.3), 2.5 * S, 1 * S, 7, 0.4 * S); sdBall(kX(hx + 4.6), kY(hy + 4.7 + (smile < 0 ? 0.6 : 0)), 2.3 * S, 1 * S, 7, 0.4 * S); sdDraw(keeperShade);
    // the mouth, just showing under it: down when sad, up when he smiles
    if (Math.abs(smile) > 0.2) { const mx0 = hx + 4.2, mx1 = hx + 7.2, my = hy + 7.0; for (let k = 0; k <= 8; k++) { const u = k / 8, curve = (u - 0.5) * (u - 0.5) * 4 - 1; P(kX(lerp(mx0, mx1, u)), kY(my + smile * curve * 0.9), 252); } }
    // a rosy cheek above the beard
    const cx = kX(hx + 3.6), cy = kY(hy + 2.2);
    for (let Y = fl(cy - 1.4 * S); Y <= cy + 1.4 * S; Y++) for (let X = fl(cx - 1.8 * S); X <= cx + 1.8 * S; X++) { const u = (X - cx) / (1.8 * S), v = (Y - cy) / (1.2 * S); if (u * u + v * v < 1 && bay(X, Y) < 0.5 && Y >= ROW0 && Y <= ROW1 && X >= 0 && X < W) { const i = Y * W + X; if (BUF[i] !== 195) BUF[i] = 254; } }
  }
