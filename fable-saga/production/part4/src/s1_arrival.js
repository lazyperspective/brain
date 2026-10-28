  /* ================================================================ part IV, act I (0:00–0:21): the brother */
  {
  // part III's last sky (same seeds): the dawn over the cloud sea; red tints it the colour of what is coming
  function i4Sky(t, red) {
    gradient(LB, 150, [6, 7, 8, 13, 14, 15]);
    glow(390, 150, 150, T_WARM, 0.55 * (1 - red));
    cloudBank(140, 34, 70, 5321, t * 5, CLOUD_SUN, false);
    cloudBank(196, 44, 50, 5322, t * 8, [17, 18, 14, 15], false);
    if (red > 0) tintAll(T_BLOOD, red * 0.3);
  }
  const i4Coral = (o) => HERO3(Object.assign({ sword: -1.0, swordCols: z5Sw(T_NOW * 0.3) }, o));
  // clouds thrown up and spilling back down: n puffs from (cx, cy), g seconds after
  function i4CloudSpill(cx, cy, g, n, v, seed, cols) {
    for (let k = 0; k < n; k++) {
      const a = -PI / 2 + (ih(k, 1, seed) - 0.5) * 2.2, sp = v * (0.4 + ih(k, 2, seed) * 0.8), r = 6 + ih(k, 3, seed) * 12;
      const x = cx + Math.cos(a) * sp * g, y = cy + Math.sin(a) * sp * g + 110 * g * g;
      if (y < cy + 30) cloudPuff(x, y, r * (1 - Math.min(0.5, g * 0.3)), cols || [18, 19, 15, 16], seed + k);
    }
  }

  /* 1 — one eye (0:00–0:04): part III's last frame, coming back up out of the dark. The shard rocks in the cloud; its eye
     darts; then the cloud beneath it starts to burn from below, and it trembles */
  shot(0, 4.0, (lt, t) => {
    i4Sky(t, 0);
    const burn = sstep(1.5, 3.9, lt), tremble = sstep(3.0, 4.0, lt);
    const sx = 236 + z5N(t * 0.6, 1) * 2 + z5Sh(t, 3) * 1.6 * tremble, sy = 182 + lt * 0.8 + Math.sin(t * 1.4) * 1.2;
    glow(sx, sy + 46, 70 + 70 * burn, T_EMBER, 0.75 * burn);
    glow(sx, sy + 46, 30 + 30 * burn, T_BLOOD, 0.5 * burn);
    const look = lt < 2.6 ? Math.sin(lt * 2.6) * 0.9 : Math.sin(2.6 * 2.6) * 0.9 * (1 - eio(lin(2.6, 3.0, lt)));
    if (burn > 0.05) glow(sx + 2, sy - 2, 56, T_MAG, 0.4);
    z5MaskShard(sx, sy, 2.4, 0.16 + Math.sin(t * 2) * 0.02 + z5Sh(t, 2) * 0.05 * tremble, 1, look, t);
    for (let k = 0; k < 5; k++) cloudPuff(sx - 48 + k * 24, sy + 26 + (k & 1) * 5, 13 + (k % 3) * 3, [18, 19, 15, 16], 5323 + k);
    // fire showing through the gaps of the cloud below, flickering
    for (let k = 0; k < 26 * burn; k++) { const x = sx - 70 + ih(k, 1, 4101) * 140, y = sy + 34 + ih(k, 2, 4101) * 20; if (ih(k, fl(t * 12), 4102) < 0.6) rectF(x, y, 2 + (k % 3), 1, ih(k, 3, 4101) < 0.4 ? 104 : 103); }
    shk(tremble * 2);
    z5Cam(1.7 + 0.08 * eio(lt / 4), 0.004 * z5N(t * 0.5, 4), sx - 4, sy, 240, 135);
    if (lt < 1.2) tintAll(T_DARK, 1 - eio(lt / 1.2));
  });
  CAPS.push([0.4, 3.2, 'n', '', 'ONE EYE STILL WATCHED.']);

  /* 2 — the hand (0:04–0:05.2): a gauntlet the size of a hill bursts up through the cloud and closes round the shard */
  shot(4.0, 5.2, (lt, t) => {
    i4Sky(t, 0.15);
    const SX = 236, SY = 184;
    // up it comes (fast), opens, closes round the shard (a little overshoot), and is drawn back down with its prize
    const rise = eoc(clamp(lt / 0.16, 0, 1)), grab = lt > 0.3, down = eic(clamp((lt - 0.62) / 0.5, 0, 1));
    const wy = lerp(380, SY + 52, rise) + z5Knock(lt - 0.3, 4, 18, 6) + down * 220, wx = SX + 2 + z5Sh(t, 5) * 1.5;
    const shy = grab ? SY + (wy - (SY + 52)) : SY - z5Knock(lt - 0.02, 6, 10, 5);
    glow(SX, SY + 40, 160, T_EMBER, 0.7 * (1 - down));
    // the fingers close round it over four frames, the palm behind it, the fingers over it; inside, its eye thrashes
    const cl = grab ? eoc(clamp((lt - 0.3) / 0.13, 0, 1)) : 0, sq_ = grab ? z5Knock(lt - 0.43, 0.12, 20, 6) : 0;
    const shard = () => z5MaskShard(SX + z5Sh(t * 2, 3) * 2 * cl, shy - 4 - cl * 6, 2.2 - cl * 0.25, 0.16 + (grab ? 0.35 : lt * 2), 1, grab ? Math.sin(t * 30) * 0.9 : 0, t);
    if (!grab) shard();
    sGauntlet(wx, wy, 3.4, -PI / 2, { curl: lerp(0.06, 0.72 + sq_, cl), thumb: lerp(0.05, 0.62, cl), spread: lerp(1, 0.25, cl) }, 0.8, t, grab ? { hold: shard } : undefined);
    if (grab && lt < 0.5) glow(SX, shy, 50, T_MAG, 0.5 * (1 - cl * 0.6));
    // the cloud erupting round the arm, and its tatters falling back
    i4CloudSpill(SX, SY + 30, lt, 26, 260, 4111);
    for (let k = 0; k < 6; k++) cloudPuff(SX - 120 + k * 48, SY + 40 + (k & 1) * 6, 16 + (k % 3) * 4, [17, 18, 14, 15], 4112 + k);
    megaHit(SX, SY + 20, lt, 2, -PI / 2, [22, 105, 103], 4113);
    shk(lt < 0.5 ? 6 : 3 * (1 - down));
    const [kz, kr] = kick(lt, [[0, 1.4], [0.3, 0.6]]);
    z5Cam(1.4 + kz - down * 0.1, kr, SX, SY - 10, 240, 135);
  });
  FLASH_CUTS.push(4.0);

  /* 3 — he rises (0:05.2–0:07): wide. The hero spins round; the whole cloud sea heaves and splits and a mountain comes up
     out of it — the crown of blades first, then the mask; the sun goes behind his head */
  const SUN = [330, 150];
  shot(5.2, 7.0, (lt, t) => {
    z5Dawn(t, 150, t * 8, SUN[0], SUN[1]);
    const u = clamp(lt / 1.8, 0, 1), surge = eio(u) + Math.max(0, Math.sin(u * PI * 3)) * 0.03;
    const my = lerp(320, 112, surge), sx = 330 + z5Sh(t, 7) * 1.5;
    const eclipse = sstep(140, 115, my);                     // the head passing over the sun
    if (eclipse > 0) glow(SUN[0], SUN[1], 120, T_WARM, 0.5 * eclipse);
    sunderer(sx, my, 1.5, t, { eyes: 0, heat: 0.15, dark: 0.55 + 0.35 * eclipse, crown: 1, glow: 0.2, arms: [{ x: -150, y: 150, pose: 'fist' }, { x: 150, y: 130, pose: 'grab' }, null, null] });
    // the cloud sea in front of his body, and the cloud he displaces: thrown up, spilling off his shoulders
    cloudBank(200, 44, 50, 4121, t * 8, CLOUD_NEAR, false);
    i4CloudSpill(sx - 140, 200, frac(lt * 0.9), 10, 120, 4122, CLOUD_NEAR);
    i4CloudSpill(sx + 140, 200, frac(lt * 0.9 + 0.5), 10, 120, 4123, CLOUD_NEAR);
    for (let k = 0; k < 8; k++) { const g = frac(lt * 0.7 + k / 8), side = k & 1 ? 1 : -1; cloudPuff(sx + side * (110 + g * 30), my + 80 + g * 120, 9 + (k % 3) * 3, CLOUD_NEAR, 4124 + k); }
    // the hero, small, in the foreground left: it was facing away; it spins round
    const turn = lt > 0.25, hop = z5Knock(lt - 0.25, -6, 10, 4);
    actor(i4Coral({ eyes: lt > 0.3 ? 'wide' : 'normal', sword: lt > 0.5 ? -0.6 : -1.0 }), 112, 126 + hop, 1.7, 0, !turn);
    shk(1 + u * 4);
    z5Cam(1 + 0.04 * u, 0.01 * z5Sh(t * 0.3, 2), 240, 135);
  });

  /* 4 — his eyes (0:07–0:10.6): low, looking up at him with the sun burning behind his head. The eyes ignite; the fire
     runs out through him from the heart; he lifts the fist with the shard in it into the light — "You broke my brother." */
  shot(7.0, 10.6, (lt, t) => {
    gradient(LB, H - LB, [7, 8, 13, 14, 15, 16]);
    const MX = 240, MY = 126, s = 2.3;
    glow(MX, MY - 34, 170, T_WARM, 0.7); discF(MX, MY - 36, 30, 16); discF(MX, MY - 36, 26, 22);
    cloudBank(236, 30, 60, 4131, t * 6, CLOUD_NEAR, false);
    const ign = eob(clamp(lt / 0.16, 0, 1)), heat = 0.15 + 0.7 * eio(lin(0.1, 2.0, lt)), dark = lerp(0.85, 0.25, eio(lin(0.2, 2.0, lt)));
    const lift = eio(lin(0.9, 1.8, lt));
    const hand = [lerp(160, 52, lift), lerp(160, 22, lift)];
    const o = sunderer(MX, MY + 1.6 * z5N(t * 0.5, 1), s, t, { eyes: ign * 1.3, heat, dark, crown: 1, nod: -1 + lift * 1.6, tilt: -0.04 * lift,
      arms: [{ x: -120, y: 140, pose: 'fist' }, { x: hand[0], y: hand[1], pose: lift > 0.5 ? 'grab' : 'fist', front: true, ang: -PI / 2 - 0.4 * lift,
        // the shard, held up in his loosened grip between palm and fingers (its eye looking at its brother)
        hold: lift > 0.2 ? (h) => { glow(h.palm[0], h.palm[1], 50, T_MAG, 0.5); z5MaskShard(h.palm[0] + h.ux * 9 * s, h.palm[1] + h.uy * 9 * s, 1.5, 0.4 + Math.sin(t * 2) * 0.05, 1, -0.6, t); } : undefined }, null, null] });
    if (lt < 0.067) tintAll(T_BLOOD, 0.4);
    for (const [ex, ey] of o.eyes) glow(ex, ey, 40 * ign, T_EMBER, 0.5 * Math.max(0, 1 - lt / 0.6));
    shk(lt < 0.4 ? 5 * (1 - lt / 0.4) : 0.6);
    const [kz] = kick(lt, [[0, 1.5]]);
    z5Cam(1.02 + 0.06 * eio(lt / 3.6) + kz, -0.02 + 0.01 * z5N(t * 0.4, 2), 240, 140, 240, 135);
  });
  FLASH_CUTS.push(7.0);
  CAPS.push([8.0, 10.5, 's', 'SUNDERER', 'YOU BROKE MY BROTHER.']);

  /* 5 — the hero (0:10.6–0:13.2): close, small against a red sky and the shape of him; not backing down */
  shot(10.6, 13.2, (lt, t) => {
    highSky(t, t * 20, 380, 120, 0.75);
    sunderer(380, 80, 1.0, t, { eyes: 1.3, heat: 0.6, dark: 0.8, crown: 1, arms: [null, { x: 70, y: 40, pose: 'grab', front: true }, null, null] });
    highFore(t, t * 30, 226);
    for (let k = 0; k < 24; k++) { const g = frac(t * 0.35 + ih(k, 1, 4142)); rectF(W - g * 520, LB + ih(k, 2, 4142) * 200 + Math.sin(t + k) * 6, 2, 1, k % 3 ? 103 : 105); }
    const speak = lt > 0.15 && lt < 2.1 && Math.sin(t * 22) > -0.3 ? 1 : 0;
    const a = actor(i4Coral({ eyes: 'angry', shade: true, mouth: speak, sword: -1.25 + z5N(t, 3) * 0.04 }), 190 + 4 * eio(lt / 2.6), 172, 6.4, 0.03, false);
    // the light of him on the hero's right side
    for (let y = SMB[1]; y <= SMB[3]; y++) for (let x = SMB[0]; x <= SMB[2]; x++) { const i = y * W + x; if (SMASK[i] && !SMASK[i + 4]) tintI(i, x, y, T_EMBER, 0.55); }
    z5Cam(1 + 0.04 * eio(lt / 2.6), 0, 220, 150, 240, 135);
  });
  CAPS.push([10.8, 13.1, 's', 'HERO', 'HE WAS ERASING EVERYTHING.']);

  /* 6 — "He erased. I break." (0:13.2–0:16.2): he brings a fist up and clenches it, and the air round it cracks */
  shot(13.2, 16.2, (lt, t) => {
    highSky(t, t * 12, 120, 176, 0.7);
    const up = eio(lin(0.9, 1.6, lt)), clench = lt > 1.75;
    const sq = clench ? z5Knock(lt - 1.75, 6, 22, 7) : 0;
    const o = sunderer(300, 96, 1.4, t, { eyes: 1.2 + (clench ? 0.4 : 0), heat: 0.6 + (clench ? 0.3 : 0), rage: clench ? 0.3 : 0, crown: 1, nod: 0.6,
      arms: [{ x: lerp(-150, -60, up), y: lerp(140, 30, up) + sq, pose: clench ? 'fist' : 'open', front: true, ang: lerp(-PI / 2, -PI / 2 - 0.3, up) }, { x: 120, y: 120, pose: 'grab' }, null, null] });
    actor(i4Coral({ eyes: 'angry', sword: -0.9 }), 90, 178, 1.7, 0, false);
    if (clench) { const [fx, fy] = o.hands[0], g = lt - 1.75; frameCrack(fx, fy - 10, clamp(g * 3, 0, 0.5) * (1 - sstep(0.8, 1.2, g)), 4152, 70); glow(fx, fy, 50, T_EMBER, 0.5 * Math.exp(-g * 3)); shk(4 * Math.exp(-g * 4)); }
    z5Cam(1 + 0.05 * eio(lt / 3), 0, 260, 120, 250, 130);
  });
  CAPS.push([13.4, 16.1, 's', 'SUNDERER', 'HE ERASED. I BREAK.']);

  /* 7 — "Then try." (0:16.2–0:18): it gathers itself, and Zenith comes back: prism light, the wings, the orbs, the blade */
  shot(16.2, 18.0, (lt, t) => {
    highSky(t, t * 12, 330, 180, 0.8); tintAll(T_DARK, 0.25);
    const ign = lt > 0.3, g = lt - 0.3, open = eob(clamp(g / 0.45, 0, 1));
    const HX = 240, HY = 158 - (ign ? 10 * eob(clamp(g / 0.5, 0, 1)) : 0) + (ign ? 0 : 5 * eio(lt / 0.3));
    if (ign) {
      z5Sunburst(HX, HY, 14, t * 0.4, 20, 260 * eoc(clamp(g / 0.3, 0, 1)), 0.08);
      z5Zenith(HX, HY, 3.2, t, { sw: -1.1, spread: open, orbR: 52 * open, auraR: 10, sparks: 24, eyes: 'glow', mouth: g < 0.3 ? 2 : 0 });
      if (g < 0.067) tintAll(T_WH, 0.5);
      shockRing(HX, HY, 10 + g * 500, 6 + g * 220, 4, PRISM_C, 1 - g / 0.6);
    } else actor(i4Coral({ eyes: 'angry', sword: -1.6, sq: 0.25 * eio(lt / 0.3) }), HX, HY, 3.2, 0, false);
    shk(ign ? 4 * Math.exp(-g * 3) : 1);
    z5Cam(1.08 - 0.06 * eoc(clamp(g / 0.6, 0, 1)), 0, HX, HY - 10, 240, 140);
  });
  CAPS.push([16.4, 17.9, 's', 'HERO', 'THEN TRY.']);

  /* 8 — "You will beg to be erased." (0:18–0:20): the mask, close; the mouth tears open on "beg"; the eyes flare */
  shot(18.0, 20.0, (lt, t) => {
    gradient(LB, H - LB, [96, 97, 98, 101]);
    const roar = Math.sin(PI * clamp((lt - 0.8) / 0.7, 0, 1)) * 0.8, flare = sstep(1.5, 1.65, lt);
    sunderer(240, 150 + lt * 2, 5.0, t, { eyes: 1.2 + flare * 0.7, rage: 0.2 + flare * 0.5, roar, heat: 0.8, body: false, crown: 1, nod: 1.2 * eio(lt / 2), tilt: 0.05 * eio(lt / 2) });
    shk(roar * 3 + flare * 2);
    z5Cam(1 + 0.05 * lt, 0, 240, 135);
  });
  CAPS.push([18.2, 19.95, 's', 'SUNDERER', 'YOU WILL BEG TO BE ERASED.']);

  /* 9 — THE SUNDERER (0:20–0:21): his name slammed across the frame — and split down the middle, like his face */
  shot(20.0, 21.0, (lt, t) => {
    gradient(LB, H - LB, [96, 97, 98, 101, 102]);
    sunderer(240, 150, 2.4, t, { eyes: 1.6, heat: 0.7, dark: 0.85, crown: 1, glow: 0.2 });
    tintAll(T_DARK, 0.45);
    const s = 'THE SUNDERER', sc = lt < 0.034 ? 9 : lt < 0.067 ? 8 : lt < 0.1 ? 7 : 6, w = textWidth(s, sc), x0 = 240 - w / 2, y0 = 118 - 3.5 * sc - 14 * (1 - eoc(clamp(lt / 0.1, 0, 1)));
    for (const [dx, c] of [[-3, 101], [3, 103]]) text(s, x0 + dx, y0, c, sc);
    text(s, x0, y0, (i, j) => (j < 2 ? 22 : j < 5 ? 105 : 103), sc, 96);
    worldSplit(240, 118, PI / 2 + 0.06, 3 + 4 * eoc(clamp((lt - 0.12) / 0.3, 0, 1)), eoc(clamp((lt - 0.1) / 0.2, 0, 1)), t);
    if (lt < 0.034) impactFrame(240, 118, 0);
    shk(lt < 0.4 ? 6 * (1 - lt / 0.4) : 0.5);
  });
  FLASH_CUTS.push(20.0);
  }
