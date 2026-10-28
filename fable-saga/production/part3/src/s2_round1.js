  /* ================================================================ part III, round one: rewind, storm, and everything taken */
  // the sky of the fight: the eclipse burning over a violet cloud sea; camY lifts the horizon (the hero falls or rises)
  function battleSky(t, camY, ox) {
    camY = camY || 0; ox = ox || 0;
    gradient(LB, H - LB, SKY_VOID3); stars(t, H, 70, 211);
    const ey = 70 + camY * 0.2; glow(400, ey, 70, T_MAG, 0.3); for (let a = 0; a < TAU; a += 0.02) { const r = 17 + Math.sin(a * 9 + t * 3) * 1.4; P(400 + Math.cos(a) * r, ey + Math.sin(a) * r, 75); } discF(400, ey, 15, 76);
    cloudBank(226 + camY, 30, 70, 351, ox + t * 14, CLOUD_GOLD, false); tintAll(T_VOIDT, 0.45); tintAll(T_MAG, 0.08);
  }
  // a ring of floating glyph tiles (the binding): radius r, tilt, turning
  function glyphRing(cx, cy, r, tilt, t, dir, cracked) {
    const n = Math.max(10, fl(r / 4));
    for (let a = 0; a < TAU; a += 1.2 / Math.max(8, r)) { const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r * tilt; P(x, y, Math.sin(a) > 0 ? 74 : 72); }
    for (let k = 0; k < n; k++) {
      const a = k / n * TAU + t * dir, x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r * tilt, front = Math.sin(a) > 0;
      rectF(x - 2, y - 2, 4, 4, front ? 76 : 77); rectF(x - 1, y - 1, 2, 2, front ? 75 : 73);
      if (cracked && ih(k, 1, 221) < cracked) { lineP(x - 3, y - 3, x + 3, y + 3, 22); }
    }
  }
  // the hero in gold, storm or drained, with its aura
  function heroForm(form, o, x, y, S, ang, flip, opt) {
    const F = form === 'storm' ? { form: 'storm', swordCols: STORM_SW } : form === 'gold' ? { swordCols: GOLD_SW } : form === 'grey' ? { form: 'grey' } : {};
    const a = actor(HERO3(Object.assign({}, F, o)), x, y, S, ang, flip, opt);
    if (form === 'gold') aura(T_NOW, AURA_GOLD, 3 * S, { sparks: 10 });
    if (form === 'storm') { aura(T_NOW, AURA_STORM, 3 * S, { sparks: 14 }); for (let k = 0; k < 2; k++) { const f = fl(T_NOW * 15), a0 = ih(k, f, 231) * TAU, r0 = 8 * S, r1 = 16 * S; bolt(x + Math.cos(a0) * r0, y + Math.sin(a0) * r0, x + Math.cos(a0 + 0.6) * r1, y + Math.sin(a0 + 0.6) * r1, f + k, 1, 91, 89); } }
    return a;
  }

  // 10 — round one (0:30): the hero charges in gold; it lifts one finger, and the charge plays backwards: REWIND
  const CHARGE = (u) => [lerp(70, 296, eic(u) * 0.35 + u * 0.65), lerp(176, 104, u) - Math.sin(u * PI) * 30];
  shot(30.0, 33.0, (lt, t) => {
    battleSky(t, 0, lt * 40);
    const fing = lt < 1.2 ? -0.15 * eio(lin(0.9, 1.2, lt)) : eob(lin(1.2, 1.45, lt));
    unmaker(372, 92, 2.0, t, { eyes: lt > 1.5 ? 2 : 1, smile: 1, halo: 1, arms: [[-58, 28, lerp(-70, -120, fing), lerp(40, -40, fing), 0.1], [58, 28, 90, 50, 0.3]] });
    // the charge (story time u runs forward, then backward through the rewind, then holds)
    const rw = lt > 1.5 && lt < 2.55, u = lt < 0.25 ? 0 : lt < 1.5 ? (lt - 0.25) / 1.25 : rw ? Math.max(0, 1 - (lt - 1.5) / 0.9) : 0;
    const [x, y] = CHARGE(clamp(u, 0, 0.92)), after = [];
    if (lt > 0.25 && lt < 2.55) for (let k = 1; k <= 3; k++) { const [ax, ay] = CHARGE(clamp(u + (rw ? 1 : -1) * k * 0.05, 0, 0.92)); after.push([ax, ay, 59, 0.5 - k * 0.12]); }
    const crouch = lt < 0.25 ? 0.5 * eio(lt / 0.2) : 0, back = lt < 0.25 ? 8 * eio(lt / 0.25) : 0;
    const tilt = lt < 0.25 ? -0.15 * eio(lt / 0.25) : lt < 1.5 ? 0.25 * eoc(lin(0.25, 0.45, lt)) : rw ? 0.25 * (1 - eio(lin(1.5, 2.3, lt))) : 0;
    heroForm('gold', { eyes: lt > 2.55 ? 'wide' : 'glow', sword: lt < 0.25 ? -2.4 : rw ? -0.3 : 0.2, sq: crouch, mouth: lt > 2.6 ? 1 : 0 }, x - back, y + crouch * 6, 2.2, tilt, false, { after });
    if (lt > 0.25 && lt < 1.5) streaks(-0.3, 30, t, 2000, 59, 70, 241, [0, LB, W, H - 2 * LB]);
    if (lt > 1.45 && lt < 1.6) { glow(372 - 120 * 2, 92 - 40 * 2 + 20, 30, T_MAG, 0.8); }
    rewindFx(rw ? 1 : lt > 2.55 && lt < 2.7 ? 0.4 : 0, t);
    cam(1.04, 0, 240, 135);
  });
  CAPS.push([32.65, 33.0, 's', 'HERO', '...WHAT?']);

  // 11 — the hand (0:33): three cuts across a giant porcelain hand — the wounds close as fast as they open — then it swats
  const HAND_HITS = [33.6, 34.2, 34.8], HAND_PTS = [[250, 120], [300, 150], [270, 95]];
  shot(33.0, 36.5, (lt, t) => {
    battleSky(t, -20, 0);
    const swat = lin(35.45, 35.65, t), wind = eio(lin(35.0, 35.45, t)) * (1 - swat);
    let rx = 0, ry = 0; HAND_HITS.forEach((h, k) => { const g = t - h; if (g > 0 && g < 1) { const d = Math.exp(-g * 7) * Math.cos(g * 26); rx += (k % 2 ? -1 : 1) * 7 * d; ry += 4 * d; } });
    const hx = lerp(330, 160, eic(swat)) + wind * 34 + rx + Math.sin(t * 1.7) * 2, hy = lerp(132, 150, swat) - wind * 10 + ry + Math.sin(t * 1.3) * 1.5;
    giantHand(hx, hy, 4.2, -1, 0.15 + swat * 0.6 + wind * 0.25, t);
    if (swat > 0 && swat < 1) streaks(PI, 30, t, 3000, 66, 120, 251, [0, 60, W, 160]);
    // the wounds: white gashes that seal over
    HAND_HITS.forEach((h, k) => { const g = t - h; if (g < 0 || g > 0.6 || swat > 0) return; const [px, py] = HAND_PTS[k], L = 40 * (1 - g / 0.6); thick(px - L * 0.7, py - L * 0.5, px + L * 0.7, py + L * 0.5, 3, g < 0.2 ? 22 : 74); });
    // the hero dashing across it, cut after cut
    let hp = [120, 150], ang = 0, sw = -0.6;
    for (let k = 0; k < 3; k++) { const h = HAND_HITS[k], from = k === 0 ? [120, 150] : HAND_PTS[k - 1].map((v, i) => v + (i ? -30 : 60)), to = HAND_PTS[k].map((v, i) => v + (i ? -30 : 60)); if (t >= h - 0.25 && t < h + 0.35) { const u = eoc(lin(h - 0.25, h + 0.05, t)), over = eoc(clamp((t - h - 0.05) / 0.3, 0, 1)); hp = [lerp(from[0], to[0], u) + (to[0] - from[0]) * 0.12 * over, lerp(from[1], to[1], u) + (to[1] - from[1]) * 0.12 * over]; sw = t < h - 0.1 ? lerp(-0.6, -2.4, eio(lin(h - 0.25, h - 0.1, t))) : lerp(-2.4, 1.0, eoc(lin(h - 0.1, h + 0.02, t))); ang = (k % 2 ? -0.3 : 0.3) * eio(lin(h - 0.25, h - 0.05, t)); } else if (t >= h + 0.35) hp = [to[0] + (to[0] - from[0]) * 0.12, to[1] + (to[1] - from[1]) * 0.12]; }
    let hidden = false;
    if (t > 35.6) { const g = t - 35.6; hp = [lerp(hp[0], 40, eoc(Math.min(1, g * 3))), lerp(hp[1], 330, eic(Math.min(1, g * 1.5)))]; ang = 14 * (g - g * g * 3); hidden = g > 0.6; }
    else if (t > 35.25) { const u = eio(lin(35.25, 35.55, t)); sw = lerp(sw, -2.0, u); ang = -0.35 * u; }      // it sees the hand coming and braces
    if (!hidden) heroForm('gold', { eyes: t > 35.6 ? 'closed' : 'glow', sword: sw }, hp[0], hp[1], 2.2, ang, false);
    HAND_HITS.forEach((h, k) => hitFx(HAND_PTS[k][0], HAND_PTS[k][1], t - h, 0.8, [22, 59]));
    hitFx(200, 150, t - 35.6, 1.6, [22, 75]);
    let z = 1.04; for (const h of HAND_HITS) { const g = t - h; if (g > 0) z += 0.06 * Math.exp(-g * 10); }
    cam(z, 0, 240, 135);
  });
  WHIPS.push([35.75, PI / 2]);

  // 12 — it turns the world over (0:36.5): the cloud sea falls upward into the sky; rings of glyphs close round the tumbling hero
  shot(36.5, 40.0, (lt, t) => {
    gradient(LB, H - LB, SKY_VOID3); stars(t, H, 70, 261);
    unmaker(240, 54, 1.4, t, { eyes: 2, smile: 1, halo: 1, body: false, glow: 0.5 });
    for (let k = 0; k < 22; k++) { const sp_ = 140 + ih(k, 1, 262) * 160, y = H + 40 - ((lt * sp_ + ih(k, 2, 262) * 400) % 400); cloudPuff(ih(k, 3, 262) * W, y, 12 + ih(k, 4, 262) * 22, CLOUD_GOLD, 263 + k); }
    tintAll(T_VOIDT, 0.4);
    streaks(-PI / 2, 40, t, 2400, 20, 70, 264, [0, LB, W, H - 2 * LB]);
    const hx = 240 + Math.sin(lt * 1.3) * 20, hy = 160 - lt * 8, close = eio(lin(1.3, 3.4, lt));
    for (let k = 0; k < 3; k++) glyphRing(hx, hy, lerp(140 + k * 30, 22 + k * 6, close), [0.35, 0.8, 0.2][k], t, k & 1 ? -1.4 : 1.1, 0);
    heroForm('gold', { eyes: lt < 2 ? 'closed' : 'angry', sword: -0.4 + Math.sin(lt * 4) * 0.3 * (1 - close) }, hx, hy, 2.2, 2 * PI * eoc(clamp(lt / 2.4, 0, 1)) + Math.sin(lt * 7) * 0.12 * (1 - close) + (lt > 2.2 ? Math.sin(lt * 9) * 0.05 : 0), false);
    shk(close * 1.5);
    cam(1 + close * 0.25, 0, hx, hy, 240, 140);
  });

  // 13 — STORM FORM (0:40): bound tight, the hero strains; the rings crack with light, and burst. Electric blue.
  shot(40.0, 44.0, (lt, t) => {
    const burstT = 2.0, g = lt - burstT;
    gradient(LB, H - LB, SKY_VOID3); stars(t, H, 60, 271);
    if (g < 0) {
      const strain = lin(0, 2, lt);
      tintAll(T_DARK, lin(1.6, 2, lt) * 0.5);
      for (let k = 0; k < 3; k++) glyphRing(240, 150, 84 + k * 12, [0.35, 0.8, 0.2][k], t, k & 1 ? -1.4 : 1.1, sstep(0.6, 1.9, lt));
      const heave = Math.max(0, Math.sin(lt * 5.5 - 1)) ** 3 * strain;                  // surges of effort, each stronger
      heroForm('gold', { eyes: lt < 1 ? 'closed' : 'glow', sword: -0.4 - heave * 0.4, vib: 1 + heave * 2, sq: 0.2 * strain - heave * 0.3 }, 240, 150 + 4 * strain - heave * 5, 4, Math.sin(lt * 3) * 0.05 * strain, false, {});
      glow(240, 150, 30 + strain * 60, T_CYAN, strain * 0.5);
      for (let k = 0; k < fl(strain * 6); k++) { const f = fl(t * 15), a = ih(k, f, 272) * TAU; bolt(240, 150, 240 + Math.cos(a) * 70, 150 + Math.sin(a) * 50, f + k, 1, 91, 90); }
      shk(strain * 2.5);
      cam(1.1 + strain * 0.15, 0, 240, 150);
    } else {
      // the burst: the rings fly apart in pieces; lightning everywhere; and there it is
      for (let k = 0; k < 40; k++) { const a = ih(k, 1, 273) * TAU, r = 30 + g * (200 + ih(k, 2, 273) * 300); rectF(240 + Math.cos(a) * r, 150 + Math.sin(a) * r * 0.6, 4, 4, k & 1 ? 75 : 76); }
      for (let k = 0; k < 8; k++) { const f = fl(t * 15), a = ih(k, f, 274) * TAU; bolt(240, 150, 240 + Math.cos(a) * 260, 150 + Math.sin(a) * 160, f + k * 7, 2, 91, 89, 0.3); }
      glow(240, 150, 120, T_CYAN, 0.3 * Math.max(0.2, 1 - g * 1.5));
      const up = g < 0.08 ? eoc(g / 0.08) : 1 - eob(clamp((g - 0.08) / 0.7, 0, 1));
      heroForm('storm', { eyes: 'glow', sword: g < 0.6 ? -1.2 : -0.9, sq: g < 0.08 ? -0.3 : 0 }, 240, 150 - up * 12, 4.4, 0, false);
      shockRing(240, 150, 20 + g * 600, 10 + g * 260, 5, [91, 90, 22], 1 - g * 1.5);
      if (g < 0.12) { flashWhite(1 - g / 0.12); } else if (g < 0.2) impactFrame(240, 150, 1);
      shk(g < 0.6 ? 6 * (1 - g / 0.6) : 1);
      cam(1.25 - 0.15 * eoc(lin(0, 0.5, g)) + 0.04 * Math.sin(g * 3), 0.05 * Math.exp(-g * 3), 240, 150);
    }
  });
  FLASH_CUTS.push(42.0);
  CAPS.push([42.05, 43.4, 'x', '', 'STORM FORM!', 64]);

  // 14 — the storm blitz (0:44): lightning-fast, from everywhere at once; on the last cut, the mask cracks
  const BLITZ = [[44.5, -86, 30], [45.2, 70, 10], [45.9, -18, -4], [46.6, 40, -44], [47.3, -6, 34], [47.6, 6, -10]];
  shot(44.0, 48.0, (lt, t) => {
    battleSky(t, 0, 0);
    const BX = 240, BY = 112, S = 2.6;
    let shakeB = 0, crack = 0;
    for (const [h] of BLITZ) { const g = t - h; if (g > 0 && g < 0.3) shakeB = Math.max(shakeB, 5 * (1 - g / 0.3)); }
    if (t > 47.6) crack = eoc(lin(47.6, 47.95, t));
    let kx = 0, ky = 0, kt = 0;
    BLITZ.forEach(([h], k) => { const g = t - h; if (g > 0 && g < 1.2) { const d = Math.exp(-g * 6) * Math.cos(g * 22), p = k === BLITZ.length - 1 ? 2.2 : 1; kx += (k % 2 ? -1 : 1) * 5 * p * d; ky += 2 * p * d; kt += (k % 2 ? -1 : 1) * 0.06 * p * d; } });
    unmaker(BX + kx, BY + ky, S, t, { eyes: t > 47.6 ? 2 : 1, smile: t < 46 ? 1 : 0.6, halo: 1, crack, shake: shakeB * 0.4, tilt: kt, look: [-kx * 0.15, 0], arms: [[-58, 28, -110 - kx, 20, 0.6], [58, 28, 116 - kx, 30, 0.8]] });
    // the hero: a bolt from strike to strike, appearing at each one mid-cut
    let prev = [40, 220];
    for (let k = 0; k < BLITZ.length; k++) {
      const [h, lx, ly] = BLITZ[k], p = [BX + lx * S, BY + ly * S], g = t - h;
      if (g > -0.12 && g < 0.06) bolt(prev[0], prev[1], p[0], p[1], k * 13 + fl(t * 30), 2, 91, 89, 0.25);
      if (g >= -0.04 && g < (k + 1 < BLITZ.length ? BLITZ[k + 1][0] - h - 0.12 : 0.6)) {
        // arrive from the last strike's side, cut through, carry on past and decelerate into a hang (a moving hold)
        const u = clamp((g + 0.04) / 0.12, 0, 1), dir = k % 2 ? -1 : 1, pass = eoc(clamp((g + 0.04) / 0.5, 0, 1));
        heroForm('storm', { eyes: 'glow', sword: lerp(-2.4, 1.2, eoc(u)) * dir }, p[0] - dir * 22 + dir * 30 * pass, p[1] - 10 + 8 * pass, 2.2, dir * 0.3 * (1 - pass * 0.6), !!(k % 2));
      }
      hitFx(p[0], p[1], g, k === BLITZ.length - 1 ? 2 : 0.9, [22, 91]);
      prev = p;
    }
    if (t < 44.46) { const u = eio(lin(44.0, 44.4, t)), coil = 0.4 * u; heroForm('storm', { eyes: 'glow', sword: -2.4 + 0.3 * u, sq: coil, vib: u * 1.5 }, 46 - u * 6, 214 + u * 4, 2.2, -0.2 * u, false); }
    if (t > 47.6 && t < 47.67) impactFrame(BX, BY, 0);
    let z = 1.02, r = 0; for (const [h] of BLITZ) { const g = t - h; if (g > 0) { z += 0.05 * Math.exp(-g * 10); } }
    if (t > 47.6) { r = 0.07 * Math.exp(-(t - 47.6) * 4); z += 0.12 * Math.exp(-(t - 47.6) * 5); }
    cam(z, r, BX, BY);
  });

  // 15 — it laughs (0:48): the crack opens into a fourth eye; then the world shatters into a kaleidoscope of its face
  shot(48.0, 51.0, (lt, t) => {
    gradient(LB, H - LB, SKY_VOID3); stars(t, H, 70, 281);
    let ha = 0; for (const b of [0.2, 0.65, 1.1]) { const g = lt - b; if (g > 0 && g < 0.5) ha += Math.sin(PI * Math.min(1, g / 0.12)) * (g < 0.12 ? 1 : Math.exp(-(g - 0.12) * 9)); }
    unmaker(240, 150 + ha * 3, 4.6, t, { eyes: 2, crack: 1, eye4: eoc(lin(0.3, 1.0, lt)), grin: 0.7 + 0.3 * ha, halo: 1, body: false, heart: 0, shake: lt < 1.6 ? 1.2 : 0, nod: -ha * 3, tilt: -ha * 0.07 + 0.05 * Math.sin(lt * 1.5) });
    if (lt > 0.3 && lt < 1.0) glow(240 + 10.5 * 4.6, 150 - 13 * 4.6, 50, T_MAG, 0.5);
    const k = eio(lin(1.5, 1.9, lt));
    if (k > 0) kaleido(240, 135, 8, t * 0.6, k);
    if (lt > 2.6) shatterFx(240, 135, eic(lin(2.6, 3.0, lt)) * 3, t, 34);
    shk(lt < 1.6 ? 2 : 1);
    cam(1 + 0.06 * lt, 0.02 * Math.sin(t * 2), 240, 135);
  });
  CAPS.push([48.2, 49.6, 's', 'UNMAKER', 'HA. HA. HA.']);

  // 16 — UNWRITE (0:51): a beam from its eyes takes the colour out of everything it touches, and pulls the four elements out
  //      of the hero one by one — water, leaf, lightning, starlight — into its grinning mouth
  const RIP = [52.0, 52.8, 53.6, 54.4];
  shot(51.0, 55.0, (lt, t) => {
    battleSky(t, 0, 0);
    const BX = 330, BY = 82, S = 2.2, MX = BX, MY = BY + 13 * S;
    let pullB = 0; for (const h of RIP) { const g = t - h; if (g > 0 && g < 0.7) pullB += Math.sin(PI * g / 0.7); }
    unmaker(BX, BY, S, t, { eyes: 2, crack: 1, eye4: 1, grin: 1, halo: 1, nod: 1.5 * eio(lt / 2) + pullB * 1.2, tilt: -0.04 * pullB, arms: [[-58, 28, -100, 10 - pullB * 6, 0.8], [58, 28, 100 - pullB * 10, 40, 0.5]] });
    let kick = 0; for (const h of RIP) { const g = t - h; if (g > 0) kick += 6 * eoc(clamp(g / 0.15, 0, 1)) - (g > 0.15 ? 0 : 0); }
    const HX = 120 - kick, HY = 176 + kick * 0.3, drained = lin(51.6, 54.6, t), on = eoc(lin(0, 0.35, lt));
    // the beam, and everything inside it inverted
    const x0 = BX - 3, y0 = BY - 6, dx = HX - x0, dy = HY - y0, L = Math.hypot(dx, dy);
    for (let y = LB; y < H - LB; y++) for (let x = 0; x < W; x++) { const px = x - x0, py = y - y0, u = (px * dx + py * dy) / (L * L), d = Math.abs(-px * dy + py * dx) / L; if (u > 0 && u < on * 1.05 && d < 16 + u * 10) BUF[y * W + x] = INV[BUF[y * W + x]]; }
    beam(x0, y0, lerp(x0, HX, on), lerp(y0, HY, on), 7, [70, 72, 74, 75], t, 3);
    // the hero, held in it, colour draining out
    let jerk = 0; for (const h of RIP) { const g = t - h; if (g > 0 && g < 0.6) jerk += Math.exp(-g * 8) * Math.cos(g * 30); }
    const hang = -0.15 + jerk * 0.25 + Math.sin(t * 2.2) * 0.05, swH = -0.4 + jerk * 0.6, sqH = -jerk * 0.2;
    heroForm(drained < 0.98 ? 'storm' : 'grey', { eyes: 'closed', sword: swH, vib: 2, sq: sqH }, HX, HY + jerk * 3, 2.6, hang, false);
    if (drained > 0) { actor(HERO3({ form: 'grey', eyes: 'closed', sword: swH, sq: sqH }), HX, HY + jerk * 3, 2.6, hang, false, { alpha: drained }); }
    // the elements, torn out one at a time and swallowed
    RIP.forEach((h, k) => {
      const g = t - h; if (g < 0) return;
      if (g < 0.25) { glow(HX, HY, 60, EL_T[k], 0.8 * (1 - g / 0.25)); burst(HX, HY, g / 0.25, 60, 12, k, [ORB[k][2], ORB[k][1]], 3); shk(3); }
      const u = eio(clamp(g / 0.65, 0, 1)); if (u >= 1) return;
      const ox = lerp(HX, MX, u), oy = lerp(HY, MY, u) - Math.sin(u * PI) * 30;
      for (let q = 1; q < 8; q++) { const u2 = eio(clamp((g - q * 0.03) / 0.65, 0, 1)); rectF(lerp(HX, MX, u2) - 1, lerp(HY, MY, u2) - Math.sin(u2 * PI) * 30 - 1, 3, 3, ORB[k][q < 3 ? 2 : 1]); }
      orbAt(ox, oy, k, 5, t);
    });
    let z = 1.04 + 0.12 * eio(lt / 4); for (const h of RIP) { const g = t - h; if (g > 0) z += 0.07 * Math.exp(-g * 8); }
    cam(z, -0.03 * eio(lt / 4), lerp(230, 170, eio(lt / 4)), lerp(135, 150, eio(lt / 4)));
  });

  // 17 — the crush (0:55): the giant hand closes around the drained hero, squeezes — and the sword shatters
  shot(55.0, 57.0, (lt, t) => {
    gradient(LB, H - LB, [76, 77, 78, 92, 93]);
    mapFx(GREYM, 0.4);
    const close = eio(lin(0.1, 0.9, lt)), sq = lt > 0.9 && lt < 1.5 ? 1 : 0, g = lt - 1.5;
    const CX = 250, CY = 140;
    // the hero inside, small and grey
    if (close < 0.95) actor(HERO3({ form: 'grey', eyes: 'closed', sword: -0.7 + Math.sin(t * 9) * 0.15 * (1 - close), sq: -0.15 * close }), CX - 20 + Math.sin(t * 7) * 2 * (1 - close), CY + 4, 3.4, 0.2 + Math.sin(t * 6) * 0.08 * (1 - close), false);
    // the palm, and four fingers curling over and round the hero, the thumb closing from below
    discF(CX + 96, CY + 8, 74, 69); discF(CX + 96, CY + 8, 72, 66); discF(CX + 88, CY, 60, 65); discF(CX + 78, CY - 14, 30, 64);
    const squeeze = lt > 0.9 && lt < 1.5 ? Math.max(0, Math.sin((lt - 0.9) * 16)) * 0.06 : 0, jolt = g > 0 ? 0.18 * Math.exp(-g * 6) : 0;
    for (let f = 0; f < 4; f++) { const cf = eio(lin(0.1 + f * 0.07, 0.8 + f * 0.05, lt)); fingerChain(CX + 54, CY - 66 + f * 36, PI + 0.25 - f * 0.12, [44 - Math.abs(f - 1.5) * 4, 36, 26], 15 - Math.abs(f - 1.5), 0.25 + cf * 0.85 + (f > 1 ? -0.1 : 0) + squeeze - jolt); }
    fingerChain(CX + 60, CY + 96, -PI * 0.75, [40, 30], 15, -0.2 - close * 0.6 - squeeze + jolt);
    if (sq) shk(3);
    if (g > 0) {
      // the sword's shards, bursting out between the fingers
      for (let k = 0; k < 26; k++) { const a = -PI * 0.2 - ih(k, 1, 291) * PI * 1.2, v = 120 + ih(k, 2, 291) * 260, x = CX - 20 + Math.cos(a) * v * g, y = CY + Math.sin(a) * v * g + 120 * g * g, rot = g * (8 + k); thick(x, y, x + Math.cos(rot) * 7, y + Math.sin(rot) * 7, 2, k % 3 ? 34 : 22); }
      if (g < 0.067) impactFrame(CX - 20, CY, 1); else if (g < 0.13) impactFrame(CX - 20, CY, 0);
      shk(7 * Math.exp(-g * 5));
    }
    mapFx(GREYM, 0.4 + lin(0, 2, lt) * 0.5);
    cam(1.05 + 0.15 * eio(lin(0, 1.5, lt)), 0, CX, CY);
  });
  FLASH_CUTS.push(56.5);
  // a giant porcelain finger: a chain of shaded, tapering segments, each turned by curl from the one before
  function fingerChain(x, y, a, lens, r, curl) {
    const pts = [[x, y, r]]; let px = x, py = y, aa = a, rr = r;
    for (const L of lens) { const n = Math.ceil(L / 2); for (let k = 1; k <= n; k++) { px += Math.cos(aa) * L / n; py += Math.sin(aa) * L / n; pts.push([px, py, rr * (1 - 0.18 * k / n)]); } rr *= 0.82; aa += curl; pts.push(null); }
    for (const pass of [0, 1, 2]) for (const q of pts) { if (!q) continue; const [qx, qy, qr] = q; if (pass === 0) discF(qx, qy, qr + 1.6, 69); else if (pass === 1) discF(qx, qy, qr, 65); else discF(qx - qr * 0.25, qy - qr * 0.3, qr * 0.45, 64); }
    // the knuckle creases
    let k = 0; for (let i = 0; i < pts.length; i++) if (!pts[i] && i > 0 && i < pts.length - 1) { const [qx, qy, qr] = pts[i - 1]; thick(qx - qr * 0.6, qy, qx + qr * 0.6, qy, 2, 67); k++; }
  }
