  /* ================================================================ part III, the first half: dread, the tear, the words */
  const SKY_DAWN3 = [4, 5, 6, 7, 8, 19, 15, 16], SKY_VOID3 = [76, 77, 78, 79, 80, 62, 71];
  const HERO3 = (o) => Object.assign({ who: 'hero' }, o);
  const AURA_STORM = [88, 89, 90, 91], STORM_SW = [89, 90, 91, 90], SM_STORM = [89, 90, 91];
  // the morning above the clouds where part II ended; dread (0..1) slides an eclipse over the sun and drains it to violet
  function dawnSky(t, dread, ox) {
    ox = ox || 0;
    gradient(LB, 210, SKY_DAWN3);
    const sx = 352, sy = 158, ec = eio(clamp(dread * 1.4, 0, 1));
    glow(sx, sy + 18, 130 * (1 - ec * 0.7), T_WARM, 0.55 * (1 - ec));
    discF(sx, sy + 18, 24, 15); discF(sx, sy + 18, 20, 16);
    if (ec > 0) {
      // the eclipse: a black disc slides over the sun; a burning ring of corona remains
      const ex = lerp(sx + 60, sx, ec), ey = sy + 18;
      for (let a = 0; a < TAU; a += 0.02) { const r = 21 + (ec > 0.95 ? 2 + Math.sin(a * 9 + t * 3) * 1.5 : 0); P(sx + Math.cos(a) * r, ey + Math.sin(a) * r, ec > 0.95 ? 75 : 16); }
      discF(ex, ey, 20, 76);
      if (ec > 0.95) glow(sx, ey, 60, T_MAG, 0.35);
    }
    cloudBank(236, 30, 70, 351, ox + t * 10, CLOUD_GOLD, false);
    if (dread > 0) { tintAll(T_VOIDT, Math.min(0.62, dread * 0.62)); tintAll(T_MAG, dread * 0.12); }
  }
  // the Null's ashes, drifting down; from 'stop' they hang, from 'pull' they are drawn up into the sky
  function ashes(t, n, stop, pull, cx, cy) {
    for (let k = 0; k < n; k++) {
      const x0 = 40 + ih(k, 1, 31) * 380, y0 = 40 + ih(k, 2, 31) * 160, sp_ = 6 + ih(k, 3, 31) * 10;
      const tt = Math.min(t, stop), x = x0 - tt * sp_ * 0.6 + Math.sin(tt * 1.3 + k) * 4, y = y0 + tt * sp_;
      let px = x, py = y;
      if (t > pull) { const g = t - pull, u = clamp(g * g * (0.6 + ih(k, 4, 31) * 0.6), 0, 1); px = lerp(x, cx, u); py = lerp(y, cy, u); for (let q = 1; q < 5; q++) { const u2 = clamp((g - q * 0.03) ** 2 * (0.6 + ih(k, 4, 31) * 0.6), 0, 1); P(lerp(x, cx, u2), lerp(y, cy, u2), 42); } }
      rectF(px, py, 2, 2, ih(k, 5, 31) < 0.5 ? 42 : 39);
    }
  }
  // the tear: the sky ripped open from top to bottom, its paper edges curling white, night and stars inside
  function skyRift(cx, y0, y1, open, t, scale) {
    if (open <= 0) return;
    scale = scale || 1;
    glow(cx, (y0 + y1) / 2, 120 * open * scale, T_MAG, 0.35 * open);
    for (let y = Math.max(0, fl(y0)); y <= Math.min(H - 1, y1); y++) {
      const u = (y - y0) / (y1 - y0), jag = (vn(y, 0, 7 * scale, 91) - 0.5) * 30 * scale + (vn(y, 0, 2, 92) - 0.5) * 7 * scale;
      const w = open * (1 - Math.pow(Math.abs(u - 0.5) * 2, 3)) * 100 * scale + 1, xl = cx + jag - w, xr = cx + jag + w * (0.9 + vn(y, 5, 9, 93) * 0.2);
      for (let x = Math.max(0, fl(xl - 4)); x <= Math.min(W - 1, xr + 4); x++) {
        const i = y * W + x;
        if (x < xl - 3 || x > xr + 3) continue;
        if (x < xl || x > xr) { BUF[i] = (x < xl - 1.5 || x > xr + 1.5) ? 67 : 64; continue; }                // the torn paper edge
        BUF[i] = voidFill(x, y, t, 0);
      }
    }
    // flakes of torn sky falling away from the edges
    for (let k = 0; k < 40 * open; k++) { const u = frac(ih(k, 1, 94) + t * 0.3), y = lerp(y0, y1, ih(k, 2, 94)) + u * 60, side = ih(k, 3, 94) < 0.5 ? -1 : 1, x = cx + side * (70 * open * scale + 10 + u * 50); if (bay(fl(x), fl(y)) > 1 - u) continue; rectF(x, y, 2 + (k % 3), 2, k & 1 ? 64 : 19); }
  }
  // a giant porcelain hand, fingers curled over an edge (gripping); dir: +1 the fingers reach right, -1 left
  function giantHand(x, y, s, dir, curl, t) {
    // the forearm: night with a magenta rim, coming in from behind the hand
    thick(x - dir * 4 * s, y + 6 * s, x - dir * 34 * s, y + 34 * s, 9 * s + 2, 73); thick(x - dir * 4 * s, y + 6 * s, x - dir * 34 * s, y + 34 * s, 9 * s, 77);
    // the palm, outlined and shaded; four fingers reaching (and curling with curl); a thumb
    discF(x, y, 9 * s + 1.5, 69); discF(x, y, 9 * s, 66); discF(x - dir * 1.5 * s, y - 2 * s, 7 * s, 65); discF(x - dir * 3 * s, y - 4 * s, 3 * s, 64);
    const a0 = dir > 0 ? 0 : PI;
    for (let f = 0; f < 4; f++) fingerChain(x + dir * 5 * s, y - 7 * s + f * 4.6 * s, a0 - dir * (0.25 - f * 0.17), [(7 - Math.abs(f - 1.5)) * s, 5.5 * s, 4 * s], 1.9 * s - Math.abs(f - 1.5) * 0.2 * s, dir * (0.2 + curl * 0.9));
    fingerChain(x + dir * 2 * s, y + 7 * s, a0 + dir * 1.1, [5 * s, 4 * s], 2 * s, dir * (0.3 + curl * 0.6));
  }


  // 1 — dawn, after (0:00): where part II ended; the hero floats above the clouds; the Null's ashes drift down
  shot(0, 4.0, (lt, t) => {
    dawnSky(t, 0, 0);
    ashes(t, 50, 99, 99, 0, 0);
    const hy = 122 + Math.sin(t * 1.6) * 4, hx = 300 - 6 * eio(lt / 4) + Math.sin(t * 0.9) * 2;
    actor(HERO3({ eyes: 'normal', sword: -1.0 + Math.sin(t * 1.3) * 0.08 }), hx, hy, 2.2, Math.sin(t * 1.1) * 0.04, true);
    aura(t, AURA_GOLD, 1.5, { sparks: 3 });
    cam(1.08 + 0.05 * eio(lt / 4), 0, 270, 140);
    fadeIn(lt, 0.9);
  });
  const blinkN = (t) => frac(t / 2.7) < 0.05;
  const fadeIn = (lt, d) => { if (lt < d) tintAll(T_DARK, 1 - eio(lt / d)); };
  CAPS.push([0.3, 1.9, 'n', '', 'THE NULL WAS GONE.'], [2.1, 3.9, 'n', '', 'BUT IT WAS NEVER ALONE.']);

  // 2 — dread (0:04): the ashes stop, hang, and are drawn up into the sky; the sun goes out; the hero turns and looks up
  shot(4.0, 7.0, (lt, t) => {
    const dread = sstep(0.4, 2.6, lt);
    dawnSky(t, dread, 0);
    ashes(t - 4 + 4, 50, 4.4, 5.0, 240, -40);
    const turn = lt > 1.2, hop = lt < 1.0 ? 0 : lt < 1.12 ? eoc((lt - 1.0) / 0.12) : 1 - eob(clamp((lt - 1.12) / 0.45, 0, 1));
    const hy = 122 + Math.sin(t * 1.6) * 4 * (1 - dread) - hop * 7, hx = 294 + 8 * eio(lin(1.3, 2.8, lt));
    const sqk = lt < 0.9 ? 0 : lt < 1.0 ? 0.25 * (lt - 0.9) / 0.1 : lt < 1.12 ? -0.3 : 0;            // a crouch, then the jump
    actor(HERO3({ eyes: lt > 1.0 ? 'wide' : 'normal', sword: lt > 1.6 ? -0.5 : -1.0, sq: sqk }), hx, hy, 2.2, -0.18 * eio(lin(2.0, 2.6, lt)), !turn);
    if (lt > 2.4) shk(lin(2.4, 3, lt) * 2);
    // a breath before it: everything holds still for the last moment
    cam(1.13 + 0.12 * eio(lin(1.5, 3, lt)), 0, 280 - 20 * eio(lin(1.5, 3, lt)), 140 - 30 * eio(lin(1.5, 3, lt)));
  });

  // 3 — the tear (0:07): the sky rips open top to bottom; huge pale fingers come through and pull it wide
  shot(7.0, 10.5, (lt, t) => {
    const open = eoc(lin(0, 0.5, lt)) * 0.45 + eio(lin(1.0, 3.0, lt)) * 0.55;
    gradient(LB, 210, SKY_DAWN3); tintAll(T_VOIDT, 0.62); tintAll(T_MAG, 0.12);
    cloudBank(236, 30, 70, 351, t * 10 + lt * 30, CLOUD_GOLD, false); tintAll(T_VOIDT, 0.5);
    skyRift(240, LB - 10, 230, open, t, 1);
    const grip = eoc(lin(0.9, 1.6, lt)), pull = eio(lin(1.0, 3.0, lt)) * 0.55 + 0.45 * eoc(lin(0, 0.5, lt));
    [[1, 76], [-1, 100], [1, 150], [-1, 172]].forEach(([dir, y], k) => {
      const gk = eob(lin(0.85 + k * 0.13, 1.4 + k * 0.13, lt)); if (gk <= 0) return;           // each hand grips in its own moment
      const strain = Math.sin(t * 23 + k * 2) * 1.2 * (lt > 1.4 && lt < 3.0 ? 1 : 0);         // and trembles with the effort of pulling
      const w = pull * 100 * (1 - Math.pow(Math.abs((y - 110) / 120) * 2, 3));
      giantHand(240 + (dir > 0 ? -w - 22 : w + 22) + (vn(y, 0, 7, 91) - 0.5) * 30 + strain + (1 - gk) * dir * 18, y + strain * 0.5, 1.6, -dir, gk * grip, t);
    });
    // the hero, tiny, on the cloud tops: knocked back by the blast, then catching itself
    const blown = lt < 0.08 ? eoc(lt / 0.08) : 1 - 0.6 * eob(clamp((lt - 0.08) / 0.8, 0, 1));
    actor(HERO3({ eyes: 'wide', sword: -0.5 }), 120 - blown * 16, 200 - blown * 5, 1, -blown * 0.5, false);
    if (lt < 0.5) { hitFx(240, 120, lt, 1.4, [22, 75]); shockRing(240, 130, 20 + lt * 700, 10 + lt * 300, 5, [75, 73, 22], 1 - lt * 2); }
    shk(lt < 0.6 ? 6 * (1 - lt / 0.6) : 1.5 * grip * (1 - lin(2.5, 3.5, lt)));
    // a match cut: the shot opens close on the hero, just where (and as big as) it was a moment ago, and is thrown back
    // by the blast to show what tore the sky
    const pb = eoc(clamp(lt / 0.7, 0, 1)), hx3 = 120 - blown * 16, hy3 = 200 - blown * 5;
    cam(lerp(2.2, 1, pb) + 0.06 * Math.exp(-lt * 3), 0, lerp(hx3, 240, pb), lerp(hy3, 135, pb), lerp(262, 240, pb), lerp(128, 135, pb));
  });
  FLASH_CUTS.push(7.0);

  // 4 — the reveal (0:10.5): it leans through the rift; the camera tilts up from the tiny hero to the mask; the eyes open
  shot(10.5, 14.0, (lt, t) => {
    const tilt = eio(lin(0.2, 2.6, lt)), camY = lerp(110, 0, tilt);
    gradient(LB, H - LB, SKY_VOID3);
    stars(t, H, 90, 41);
    skyRift(240, -40 + camY, 330 + camY, 1.6, t, 1.6);
    const by = 120 + camY + lerp(40, 0, eoc(lin(0, 1.8, lt))), eyes = lt < 1.0 ? 0 : lt < 1.6 ? eoc(lin(1.0, 1.6, lt)) : 1 + sstep(2.6, 3.0, lt);
    unmaker(240, by, 3.2, t, { eyes, halo: eoc(lin(0.3, 2.2, lt)), arms: [[-58, 28, -120, -40 + Math.sin(t) * 4, 0.9], [58, 28, 122, -30, 0.6], [-46, 40, -100, 70, 0.3], [46, 40, 104, 80, 0.4]], heart: 1 });
    // the hero in the foreground, tiny, looking up at it
    const fl_ = lt < 1.0 ? 0 : lt < 1.1 ? eoc((lt - 1.0) / 0.1) : 1 - 0.4 * eio(clamp((lt - 1.1) / 1.2, 0, 1));
    actor(HERO3({ eyes: 'wide', sword: -0.5 - fl_ * 0.5 }), 90 - fl_ * 8, 232 + camY * 0.6 - fl_ * 3, 2.2, -0.15 - fl_ * 0.2, false);
    if (lt < 0.25) flashWhite(1 - lt / 0.25);
    if (lt > 1.0 && lt < 1.3) { shk(4); for (const ex of [-6.5, 6.5, 0]) glow(240 + ex * 3.2, by + (ex ? -4 : -16) * 3.2, 40, T_MAG, 0.6 * (1 - (lt - 1) / 0.3)); }
    shk(lt < 0.6 ? 5 * (1 - lt / 0.6) : 0.8);
    cam(1 + 0.06 * lt, 0, 240, 135);
  });
  FLASH_CUTS.push(10.5);

  // 5 — the mask, close (0:14): its smile splits slowly — "So. You are the one who broke my shadow."
  shot(14.0, 17.5, (lt, t) => {
    gradient(LB, H - LB, SKY_VOID3); stars(t, H, 60, 51);
    const sm = eio(lin(0.4, 2.8, lt));
    const nod = Math.sin(PI * clamp((lt - 0.1) / 0.7, 0, 1)) * 2.2;
    unmaker(240, 150 + lt * 2, 5.4, t, { eyes: 1, look: [Math.sin(lt * 0.8) * 0.4, 0.6], smile: sm, halo: 1, body: false, heart: 0, nod, tilt: 0.09 * eio(lin(1.0, 3.0, lt)) });
    ashes(t, 24, 99, 99, 0, 0);
    cam(1.02 + lt * 0.03, 0.03 * Math.sin(lt * 0.6), 240, 135);
  });
  CAPS.push([14.1, 17.4, 's', 'UNMAKER', 'SO. YOU ARE THE ONE WHO BROKE MY SHADOW.']);

  // 6 — the hero, close (0:17.5): small against all that, and not backing down — "Who... are you?"
  shot(17.5, 20.0, (lt, t) => {
    gradient(LB, H - LB, [76, 77, 78, 71, 72]);
    for (let k = 0; k < 30; k++) { const u = frac(ih(k, 1, 61) + t * 0.2); rectF(ih(k, 2, 61) * W, LB + u * 220, 2, 2, ih(k, 3, 61) < 0.5 ? 42 : 73); }
    glow(240, 300, 220, T_MAG, 0.4);
    const grip = lt > 1.4;
    const set = lt < 1.4 ? 0 : lt < 1.48 ? (lt - 1.4) / 0.08 : 1 - eob(clamp((lt - 1.48) / 0.4, 0, 1));
    const a = actor(HERO3({ eyes: lt < 0.4 ? 'wide' : 'angry', sword: grip ? -1.25 : -2.2, shade: true, mouth: lt > 0.5 && lt < 1.4 ? 1 : 0, sq: set * 0.18 }), 230 + 4 * eio(lin(0.3, 1.2, lt)), 176 + set * 4, 7, 0.05 * eio(lin(0.3, 1.2, lt)), false);
    if (grip && lt < 1.7) { const u = (lt - 1.4) / 0.3; sparkle(lerp(a.hand[0], a.tip[0], 0.3 + u * 0.7), lerp(a.hand[1], a.tip[1], 0.3 + u * 0.7), 9 * Math.sin(PI * u), 22, 59); }
    cam(1 + 0.05 * eio(lt / 2.5), 0, 230, 140);
  });
  CAPS.push([17.6, 19.9, 's', 'HERO', 'WHO... ARE YOU?']);

  // 7 — "I am what is left when every story ends." (0:20): its arms open, and below it the world loses its colour
  shot(20.0, 24.0, (lt, t) => {
    const drain = eio(lin(0.6, 3.4, lt));
    gradient(LB, H - LB, SKY_VOID3); stars(t, 150, 70, 71);
    cloudBank(248, 40, 70, 352, t * 8, CLOUD_GOLD, false);
    // the drain: from the middle outward, the clouds go grey and then blank, in ragged columns
    for (let y = 190; y < H; y++) for (let x = 0; x < W; x++) { const d = Math.abs(x - 240) / 240 + (ih(x >> 2, 0, 81) - 0.5) * 0.2; if (d < drain) BUF[y * W + x] = d < drain - 0.25 ? (ih(x >> 1, y >> 1, fl(t * 12)) < 0.02 ? 95 : 93) : GREYM[BUF[y * W + x]]; }
    const open = eio(lin(0.2, 1.6, lt)), ew = lt > 3.1 ? 2 : 1;
    unmaker(240, 96, 2.4, t, { eyes: ew, smile: 1, halo: 1, nod: -1.5 * open, tilt: -0.05 * open, arms: [[-58, 28, lerp(-80, -150, open), lerp(40, -10, open), open], [58, 28, lerp(80, 150, open), lerp(40, -10, open), open]] });
    if (lt > 3.1 && lt < 3.4) shk(3);
    cam(1.04 - 0.04 * lt / 4, 0, 240, 135);
  });
  CAPS.push([20.1, 23.9, 's', 'UNMAKER', 'I AM WHAT IS LEFT WHEN EVERY STORY ENDS.']);

  // 8 — "Then I'll write a new one." (0:24): the gold of Fable Mode catches fire around the hero; the sword comes up
  shot(24.0, 27.0, (lt, t) => {
    gradient(LB, H - LB, SKY_VOID3); stars(t, H, 60, 81);
    unmaker(330, 70, 2.6, t, { eyes: 1, smile: 1, halo: 1, body: true, heart: 1 });
    tintAll(T_VOIDT, 0.35);                                   // it stands far behind, in shadow
    const ign = eoc(lin(0.15, 0.7, lt)), sw = lerp(-1.6, -0.85, eob(lin(0.9, 1.3, lt)));
    const crouch = lt < 0.15 ? eio(lt / 0.15) : 0, rise = lt < 0.15 ? 0 : lt < 0.25 ? eoc((lt - 0.15) / 0.1) : 1 - 0.7 * eob(clamp((lt - 0.25) / 0.6, 0, 1));
    actor(HERO3({ eyes: ign > 0.3 ? 'glow' : 'angry', sword: sw, swordCols: ign > 0.5 ? GOLD_SW : undefined, shade: true, sq: crouch * 0.35 - (lt > 0.15 && lt < 0.3 ? 0.25 : 0) }), 150, 178 + crouch * 6 - rise * 10, 4.2, 0, false);
    aura(t, AURA_GOLD, 2 + ign * 12, { sparks: Math.round(ign * 24) });
    if (lt > 0.15 && lt < 0.45) { shockRing(150, 178, 10 + (lt - 0.15) * 500, 6 + (lt - 0.15) * 200, 3, [60, 59, 58], 1 - (lt - 0.15) * 3); shk(2); }
    glow(150, 178, 100 * ign, T_GOLD, 0.35);
    cam(1.05 + 0.05 * eio(lt / 3), 0, 190, 150);
  });
  CAPS.push([24.2, 26.9, 's', 'HERO', "THEN I'LL WRITE A NEW ONE."]);

  // 9 — "Everything ends." (0:27): the grin opens; then its name, slammed across the frame
  shot(27.0, 30.0, (lt, t) => {
    gradient(LB, H - LB, SKY_VOID3); stars(t, H, 60, 91);
    const gr = eio(lin(0.1, 1.2, lt));
    unmaker(240, 150, 5.4, t, { eyes: lt > 1.0 ? 2 : 1, smile: 1, grin: gr, halo: 1, body: false, heart: 0, shake: lt > 1.5 ? 2 : 0, nod: 2.5 * gr, tilt: -0.06 * gr });
    if (lt > 1.5) {
      // THE UNMAKER, slammed: the frame darkens, the letters land big then settle, torn by glitch
      const g = lt - 1.5; tintAll(T_DARK, 0.55);
      const s = 'THE UNMAKER', sc = g < 0.034 ? 9 : g < 0.067 ? 8 : g < 0.1 ? 7 : 6, w = textWidth(s, sc), x0 = 240 - w / 2, y0 = 112 - 3.5 * sc - 14 * (1 - eoc(clamp(g / 0.1, 0, 1))) + (g > 0.1 && g < 0.25 ? Math.sin((g - 0.1) / 0.15 * PI) * 3 : 0);
      for (const [dx, c] of [[-3, 71], [3, 61]]) text(s, x0 + dx, y0, c, sc);
      text(s, x0, y0, (i, j) => (j < 2 ? 22 : j < 5 ? 75 : 73), sc, 76);
      glitchBand(t, y0, y0 + 7 * sc, 10 * Math.exp(-g * 3) + 2);
      if (g < 0.4) shk(6 * (1 - g / 0.4));
      if (g < 0.067) impactFrame(240, 112, 0);
    }
    cam(1 + 0.04 * lt, 0, 240, 135);
  });
  FLASH_CUTS.push(28.5);
  CAPS.push([27.1, 28.4, 's', 'UNMAKER', 'EVERYTHING ENDS.']);
  // rows of the frame torn sideways (a glitch across a band)
  function glitchBand(t, y0, y1, amp) {
    const f = fl(t * 20);
    for (let y = Math.max(0, fl(y0)); y < Math.min(H, y1); y++) { if (ih(y >> 1, f, 97) > 0.35) continue; const sh = Math.round((ih(y >> 1, f, 98) - 0.5) * 2 * amp); if (!sh) continue; TMP.set(BUF.subarray(y * W, y * W + W), 0); for (let x = 0; x < W; x++) BUF[y * W + x] = TMP[clamp(x - sh, 0, W - 1)]; }
  }
