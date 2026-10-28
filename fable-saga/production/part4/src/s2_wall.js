  /* ================================================================ part IV, act II (0:21–0:41): the wall */
  {
  const i4Coral = (o) => HERO3(Object.assign({ sword: -1.0, swordCols: z5Sw(T_NOW * 0.3) }, o));
  const SKY_FIGHT = [96, 97, 98, 101, 102, 13];
  // a one-off piecewise path: list of [t, x, y, ease] keys (ease into each key: 'o' out, 'i' in, 'io', 'b' back, 'l')
  function i4Path(keys, t) {
    if (t <= keys[0][0]) return [keys[0][1], keys[0][2]];
    for (let i = 1; i < keys.length; i++) if (t < keys[i][0]) {
      const [t0, x0, y0] = keys[i - 1], [t1, x1, y1, e] = keys[i], u = (t - t0) / (t1 - t0), f = e === 'o' ? eoc(u) : e === 'i' ? eic(u) : e === 'b' ? eob(u) : e === 'l' ? u : eio(u);
      return [lerp(x0, x1, f), lerp(y0, y1, f)];
    }
    const k = keys[keys.length - 1]; return [k[1], k[2]];
  }
  // hit-stop that stays on the beat: the clock holds for d at each hit, then catches up over the next 0.2 s
  function i4Stop(t, hits, d) { let o = t; for (const h of hits) { const g = t - h; if (g > 0) o -= Math.min(g, d) - clamp((g - d) / 0.2, 0, 1) * d; } return o; }
  // sparks skidding off porcelain: a fan along dir
  function i4Skid(x, y, g, dir, n, seed) {
    if (g < 0 || g > 0.35) return;
    for (let k = 0; k < n; k++) { const a = dir + (ih(k, 1, seed) - 0.5) * 1.1, v = 120 + ih(k, 2, seed) * 260, px = x + Math.cos(a) * v * g, py = y + Math.sin(a) * v * g + 200 * g * g; lineP(px, py, px - Math.cos(a) * 5, py - Math.sin(a) * 5, g < 0.1 ? 22 : k % 2 ? 59 : 60); }
    if (g < 0.08) { discF(x, y, 5 - g * 40, 22); glow(x, y, 26, T_WH, 0.6); }
  }

  /* 10 — the blitz (0:21–0:24): Zenith at full speed, four cuts from four sides. He does not move. He does not blink.
     The blade skids off porcelain; it is the hero that is thrown back by each one */
  const BZ = [22.5, 22.9, 23.3, 23.7];
  shot(21.0, 24.0, (lt, t) => {
    gradient(LB, H - LB, SKY_FIGHT);
    cloudBank(222, 30, 60, 4201, t * 10, [97, 98, 101, 102], false);
    const MX = 300, MY = 96, s = 1.3;
    const o = sunderer(MX, MY, s, t, { eyes: 1.15, heat: 0.65, crown: 1, arms: [{ x: -132, y: 128, pose: 'fist' }, { x: 132, y: 124, pose: 'fist' }, { x: -96, y: 190, pose: 'open' }, { x: 96, y: 196, pose: 'open' }] });
    // the four contact points (on him) and where the hero comes from for each
    const C = [[MX - 108, MY + 52], [MX - 18, MY + 104], [MX + 26, MY + 34], [MX - 10, MY - 2]];
    const FROM = [[130, 210], [MX + 90, MY + 150], [MX - 30, MY + 120], [150, 70]];
    // the path: wind up (21.0–21.6), then each strike is an arrival on the contact point and a rebound away from it
    const keys = [[21.0, 92, 168], [21.55, 84, 176, 'io']];
    BZ.forEach((h, k) => { const [cx, cy] = C[k], [fx, fy] = FROM[k], dx = cx - fx, dy = cy - fy, L = Math.hypot(dx, dy); keys.push([h - 0.16, fx + dx * 0.25, fy + dy * 0.25, 'i'], [h, cx - dx / L * 22, cy - dy / L * 22, 'i'], [h + 0.14, cx - dx / L * 48, cy - dy / L * 48 + 6, 'o']); });
    const [hx, hy] = i4Path(keys, t);
    // the blade: cocked back as it comes in, whipped through the cut, bounced back by the porcelain
    const SWING = [[-2.8, 0.7], [1.7, -1.4], [2.0, -1.5], [-0.5, -0.3]];
    let sw = -1.1, flip = false, ang = 0, sq = 0, spread = 1;
    if (t < 21.55) { const w = eio(lin(21.0, 21.5, t)); sw = lerp(-1.1, -2.6, w); sq = 0.3 * w; spread = 1 - 0.6 * w; }
    BZ.forEach((h, k) => {
      const g = t - h; if (g < -0.2 || g > 0.36) return;
      const [a0, a1] = SWING[k]; flip = k === 1;
      sw = g < -0.06 ? a0 : g < 0 ? lerp(a0, a1, eic((g + 0.06) / 0.06)) : lerp(a1, a0 * 0.5, eoc(clamp(g / 0.25, 0, 1)));
      ang = (k === 2 ? -0.4 : k === 3 ? 0.2 : 0.25) * (flip ? -1 : 1);
      spread = g < 0 ? 0.55 : 0.55 + 0.45 * eoc(clamp(g / 0.3, 0, 1));
      if (k === 3) sw = g < -0.06 ? -0.3 : -0.3;
    });
    const caught = t > 23.7;
    z5Zenith(hx, hy, 2.0, t, { sw, flip, ang, spread, orbR: 22, auraR: 6, sparks: 10, sq, eyes: 'glow', mouth: caught ? 2 : 0 });
    // contact: sparks, a ring — small against his size; the hero gets the worst of it
    BZ.forEach((h, k) => { const [cx, cy] = C[k], g = t - h, dir = Math.atan2(cy - FROM[k][1], cx - FROM[k][0]) + PI * 0.75; i4Skid(cx, cy, g, dir, 22, 4202 + k); if (g >= 0 && g < 0.25) shockRing(cx, cy, 4 + g * 140, 3 + g * 90, 2, [22, 60, 59], 1 - g / 0.25); });
    // speed lines between the cuts
    if (t > 21.55) for (let q = 1; q < 6; q++) { const [ax, ay] = i4Path(keys, t - q * 0.02); P(ax, ay, PRISM_C[q % 7]); P(ax + 1, ay, PRISM_C[(q + 2) % 7]); }
    const [kz, kr] = kick(t, BZ.map((h) => [h, 0.5]));
    shk(BZ.some((h) => t > h && t < h + 0.12) ? 2 : 0.4);
    z5Cam(1.06 + kz, kr, lerp(220, hx, 0.35), lerp(140, hy, 0.25), 240, 135);
  });

  /* 11 — caught (0:24–0:25.4): the blade, stopped dead between two porcelain fingers. The hero hauls on it with
     everything — wings thrashing — and the hand does not so much as tremble */
  shot(24.0, 25.4, (lt, t) => {
    gradient(LB, H - LB, SKY_FIGHT);
    sunderer(380, 60, 1.6, t, { eyes: 1.2, heat: 0.6, crown: 1, dark: 0.3, arms: [null, null, null, null] });
    tintAll(T_DARK, 0.25);
    const PX = 300, PY = 140;                                  // the pinch: where the tip is held
    const tugs = [0.25, 0.62, 0.98], pull = tugs.reduce((s_, h) => s_ + Math.max(0, Math.sin(PI * clamp((lt - h) / 0.3, 0, 1))), 0);
    const S = 3.2, hx = PX - 29 * S - 14 * S - pull * 4, hy = PY + 2 + z5Sh(t, 2) * pull;
    // the hand: not one pixel of give. Palm behind the blade, finger and thumb closing on it (four frames), the hero in front
    const pin = eoc(clamp(lt / 0.13, 0, 1)), HP = { curls: [lerp(0.15, 0.48, pin), lerp(0.4, 0.95, pin), lerp(0.45, 0.98, pin), 1], thumb: lerp(0.2, 0.66, pin), spread: lerp(0.6, 0, pin) };
    sGauntlet(PX + 44, PY + 10, 3.4, PI + 0.3, HP, 0.6, t, { layer: 'palm' });
    z5Zenith(hx, hy, S, t, { sw: 0.04 * z5Sh(t * 2, 4), spread: 0.7 + 0.3 * pull, flap: 0.5, wt: t * 4, orbR: 0, auraR: 9, sparks: 18, sq: -0.12 * pull, eyes: 'glow', mouth: pull > 0.3 ? 2 : 1 });
    sGauntlet(PX + 44, PY + 10, 3.4, PI + 0.3, HP, 0.6, t, { layer: 'fingers' });
    // where porcelain grips light: the blade glows white there and grinds sparks on each tug
    tugs.forEach((h, k) => { const g = lt - h; if (g > 0 && g < 0.25) for (let q = 0; q < 6; q++) { const a = PI + (ih(q, k, 4212) - 0.5) * 1.8, v = 40 + ih(q, k + 3, 4212) * 90; P(PX + Math.cos(a) * v * g, PY + Math.sin(a) * v * g + 60 * g * g, q % 2 ? 22 : 60); } });
    glow(PX, PY, 30, T_WH, 0.35 + 0.2 * pull);
    if (lt < 0.1) { i4Skid(PX, PY, lt, PI, 30, 4211); }
    shk(lt < 0.1 ? 4 : pull * 1.2);
    z5Cam(1 + 0.05 * eio(lt / 1.4), 0, 240, 140);
  });
  FLASH_CUTS.push(24.0);

  /* 12 — the flick (0:25.4–0:26.6): one finger. The hero is gone — down through the cloud sea, miles of it, tumbling,
     and out under it into the dark ocean world, the sea rushing up */
  const PX4 = 300;
  shot(25.4, 26.6, (lt, t) => {
    const fall = clamp((lt - 0.12) / 1.08, 0, 1);
    if (lt < 0.12) {
      gradient(LB, H - LB, SKY_FIGHT);
      // the finger flicks out; the hero is simply gone along the line of it, a prism streak and a ring left in the air
      const fl_ = eoc(clamp(lt / 0.05, 0, 1));
      sGauntlet(PX4 + 44, 150, 3.4, PI + 0.3, { curls: [lerp(0.48, 0, fl_), 0.95, 0.98, 1], thumb: lerp(0.66, 0.9, fl_), spread: 0 }, 0.8, t);
      const g = lt, hx = 250 - g * 1600, hy = 172 + g * 900;
      for (let q = 0; q < 40; q++) { const u = q / 40; thick(lerp(250, hx, u), lerp(172, hy, u), lerp(250, hx, u) + 1, lerp(172, hy, u), 3, PRISM_C[q % 7]); }
      shockRing(250, 170, 6 + g * 500, 4 + g * 300, 3, [22, 60, 59], 1 - g / 0.12);
      if (g < 0.03) tintAll(T_WH, 0.4);
    } else {
      // falling: the sky, then cloud rushing up past, then the underworld opening below
      const below = sstep(0.45, 0.8, fall);
      if (below < 1) { gradient(LB, H - LB, [101, 102, 13, 14, 19, 20]); for (let k = 0; k < 30; k++) { const y = ((ih(k, 1, 4222) * 400 - fall * 2600 * (0.6 + ih(k, 2, 4222))) % 400 + 400) % 400 - 60; cloudPuff(ih(k, 3, 4222) * W, y, 16 + ih(k, 4, 4222) * 30, k % 3 ? [17, 18, 19, 20] : [14, 15, 19, 20], 4223 + k); } }
      if (below > 0) { belowWorld(t, lerp(330, 150, eoc(below)), 0, 0.3); if (below < 1) tintAll(T_WH, (1 - below) * 0.5); }
      streaks(-PI / 2, 40, t, 3000, below > 0.5 ? 118 : 22, 90, 4224, [0, LB, W, H - 2 * LB]);
      const tumble = lt * 16, hx = 240 + Math.sin(lt * 5) * 12, hy = 130 + Math.sin(lt * 7) * 6;
      z5Zenith(hx, hy, 2.2, t, { sw: -0.4 + Math.sin(lt * 9) * 1.2, ang: tumble, spread: 0.4, flap: 0.6, orbR: 0, auraR: 5, eyes: 'closed', mouth: 2 });
    }
    shk(lt < 0.12 ? 6 : 2.5);
  });
  WHIPS.push([25.45, PI / 2]);

  /* 13 — the sea (0:26.6–0:27.4): it hits the ocean like a falling star: a crater in the water, a wall of sea, spires
     cracking in the shockwave and starting to fall */
  shot(26.6, 27.4, (lt, t) => {
    belowWorld(t, 132, 0, 0.4);
    const CX = 236, CY = 196;
    // the crater: a ring of sea thrown up into a wall, the hole in the middle still dark
    const R = 20 + eoc(clamp(lt / 0.6, 0, 1)) * 150, wall = Math.max(0, 1 - lt / 0.8) * 36;
    for (let y = LB; y < H - LB; y++) for (let x = 0; x < W; x++) { const dx = (x - CX) / R, dy = (y - CY) / (R * 0.28), d = Math.sqrt(dx * dx + dy * dy); if (d < 0.85) BUF[y * W + x] = d < 0.5 ? 114 : 115; }
    for (let a = 0; a < TAU; a += 0.015) { const x = CX + Math.cos(a) * R, y0 = CY + Math.sin(a) * R * 0.28, h = wall * (0.6 + 0.4 * vn(a * 6, 0, 1, 4231)); for (let q = 0; q < h; q++) P(x, y0 - q, q > h - 3 ? 119 : q > h * 0.6 ? 118 : 117); }
    rocks(CX, CY - 10, lt, 34, 260, 3, [117, 118, 119, 22], 4232, 300, -PI / 2, 2.4);
    // a spire, near, cracking and toppling away from the blast
    const fallA = eic(clamp((lt - 0.15) / 0.65, 0, 1)) * 0.6;
    for (let q = 0; q < 110; q++) { const along = q, px = 390 + Math.sin(fallA) * along, py = 206 - Math.cos(fallA) * along, w = 14 * (1 - q / 140); thick(px - w / 2, py, px + w / 2, py, 2, q % 23 < 2 ? 103 : q < 60 ? 98 : 99); }
    megaHit(CX, CY - 4, lt, 3, -PI / 2, [22, 118, 117], 4233);
    shk(8 * Math.max(0, 1 - lt / 0.6));
    const [kz, kr] = kick(lt, [[0, 2]]);
    z5Cam(1.05 + kz, kr, CX, 160, 240, 140);
  });
  FLASH_CUTS.push(26.6);

  /* 14 — the combo (0:27.4–0:31): he drops through the clouds behind it like a mountain falling, and then he does not stop.
     Hammer-fist down; uppercut; hook; hook; backhand — each one launches it; between them it tries to guard, too late */
  const CB = [27.6, 28.3, 28.8, 29.3, 29.9], HS4 = 0.067;
  shot(27.4, 31.0, (lt, t) => {
    const tt = i4Stop(t, CB, HS4), MX = 300, MY = 70, s = 1.05;
    belowWorld(t, 150, tt * 20, 0.5);
    // he lands: from above the frame down to his place, the sea thrown up round his base
    const land = eic(clamp((t - 27.4) / 0.22, 0, 1)), my = lerp(-160, MY, land) + (t > 27.62 ? z5Knock(t - 27.62, 6, 10, 5) : 0);
    // the hero's path: in the crater, smashed down, bounced up, launched, flung, flung, flung far
    const P_ = [[27.4, 200, 200], [27.6, 200, 200, 'io'], [27.75, 200, 214, 'o'], [28.2, 208, 176, 'io'], [28.3, 210, 172, 'l'], [28.7, 238, 92, 'o'], [28.8, 236, 92, 'l'], [29.2, 116, 122, 'o'], [29.3, 118, 124, 'l'], [29.75, 262, 150, 'o'], [29.9, 266, 152, 'l'], [30.5, 430, 196, 'o'], [31.0, 420, 192, 'o']];
    const [hx, hy] = i4Path(P_, tt);
    // the fists: each pulled back (wind-up), driven in on its hit, carried through, and drawn back slowly
    const L_ = (x, y) => [(x - MX) / s, (y - my) / s];
    const fistAt = (k, rest, back, hitT) => { const g = tt - hitT; if (g < -0.32 || g > 0.6) return rest; const [hx0, hy0] = L_(...hitPos(k)), dd = Math.hypot(hx0 - back[0], hy0 - back[1]) || 1, px = hx0 - (hx0 - back[0]) / dd * 30, py = hy0 - (hy0 - back[1]) / dd * 30; if (g < -0.1) return lerp2(rest, back, eio((g + 0.32) / 0.22)); if (g < 0) return lerp2(back, [px, py], eic((g + 0.1) / 0.1)); return lerp2([px, py], rest, eio(clamp((g - 0.1) / 0.5, 0, 1))); };
    const lerp2 = (a, b, u) => [lerp(a[0], b[0], u), lerp(a[1], b[1], u)];
    const HP = [[200, 196], [210, 172], [236, 92], [118, 124], [266, 152]];
    const hitPos = (k) => HP[k];
    const A0 = fistAt(0, [-130, 120], [-60, -60], CB[0]), A3 = fistAt(3, A0, [-260, 20], CB[3]);
    const B2 = fistAt(2, [134, 120], [200, 0], CB[2]), D1 = fistAt(1, [96, 196], [60, 240], CB[1]), C4 = fistAt(4, [-96, 196], [40, 160], CB[4]);
    const armUL = tt < 29.0 ? A0 : A3;
    const DX = [0, 0.3, -1, 1, 1];                                  // which way each blow travels (sideways)
    let leanW = 0, nodW = 0; CB.forEach((h, k) => { const g = tt - h; if (g > -0.32 && g < -0.08) { const u = Math.sin(PI * (g + 0.32) / 0.24); leanW -= DX[k] * 9 * u; nodW -= (k === 0 ? 2.5 : 1) * u; } else if (g >= -0.08 && g < 0.6) { const u = g < 0.05 ? eoc((g + 0.08) / 0.13) : Math.exp(-(g - 0.05) * 5); leanW += DX[k] * 12 * u; nodW += (k === 0 ? 3.5 : 1.5) * u; } });
    sunderer(MX, my, s, t, { eyes: 1.3, heat: 0.75, crown: 1, nod: 0.8 + nodW, lean: leanW, tilt: leanW * 0.004,
      arms: [{ x: armUL[0], y: armUL[1], pose: 'fist', fs: 1.9, front: true }, { x: B2[0], y: B2[1], pose: 'fist', fs: 1.9, front: tt > 28.5 && tt < 29.1 }, { x: C4[0], y: C4[1], pose: tt > 29.6 && tt < 30.3 ? 'open' : 'fist', fs: 1.9, front: tt > 29.6 && tt < 30.3, ang: tt > 29.6 && tt < 30.3 ? PI * 0.15 : undefined }, { x: D1[0], y: D1[1], pose: 'fist', fs: 1.9, front: tt > 28.0 && tt < 28.6 }] });
    // the sea where he stands
    if (land > 0.9) rocks(MX, 230, t - 27.62, 30, 240, 3, [117, 118, 119, 22], 4241, 280, -PI / 2, 2.6);
    // the hero: guard thrown up as each blow comes (too late), then the blow: tumbling, wings crumpling
    const guard = CB.reduce((m, h) => Math.max(m, sstep(h - 0.2, h - 0.05, tt) * (1 - sstep(h, h + 0.02, tt))), 0);
    const spin = CB.reduce((a, h, k) => a + (tt > h ? (k % 2 ? -1 : 1) * 4.5 * eoc(clamp((tt - h) / 0.5, 0, 1)) : 0), 0);
    const squash = CB.reduce((m, h) => { const g = t - h; return g >= 0 && g < 0.25 ? Math.max(m, Math.exp(-g * 14)) : m; }, 0);
    z5Zenith(hx, hy, 1.15, t, { sq: 0.45 * squash, sw: guard > 0.2 ? -1.6 : -0.3 + Math.sin(tt * 7) * 0.8, ang: spin + guard * -0.2, spread: 0.45 + 0.2 * guard, flap: 0.5, orbR: 0, auraR: 4, sparks: 4, eyes: guard > 0.2 ? 'wide' : 'closed', mouth: guard > 0.2 ? 1 : 2, sq: guard * 0.2 });
    // the blows
    CB.forEach((h, k) => { const dir = [PI / 2, -PI / 2 - 0.3, PI - 0.3, 0.2, 0.15][k]; megaHit(HP[k][0], HP[k][1], t - h, k === 0 || k === 4 ? 2.6 : 2, dir, [22, 105, 103], 4242 + k); });
    // the backhand drags the hero across the sea: a trail of spray
    if (tt > 29.9) for (let q = 0; q < 14; q++) { const [px, py] = i4Path(P_, tt - q * 0.03); if (py > 185) rocks(px, py + 4, 0.1 + q * 0.02, 3, 80, 2, [118, 119, 117, 22], 4247 + q, 200, -PI / 2, 1.5); }
    const [kz, kr, kx, ky] = kick(t, CB.map((h, k) => [h, k === 0 || k === 4 ? 1.6 : 1.1, [PI / 2, -PI / 2, PI, 0, 0][k]]));
    shk(CB.some((h) => t > h && t < h + 0.2) ? 7 : 1.5);
    z5Cam(1.12 + kz, kr, lerp(250, hx, 0.45) - kx, lerp(140, hy, 0.35) - ky, 240, 140);
  });

  /* 15 — dragged (0:31–0:33): it is in his fist; the fist goes through a spire, and another, and another */
  const SP15 = [31.6, 32.1, 32.6];
  shot(31.0, 33.0, (lt, t) => {
    const pan = lt * 520;
    belowWorld(t, 140, pan, 0.6);
    const FX = 210 + z5Sh(t, 3) * 3, FY = 150 + Math.sin(lt * 4) * 6;
    // spires in the near ground rushing past right to left; each is hit and bursts
    SP15.forEach((h, k) => {
      const x = FX + (h - t) * 520, g = t - h;
      if (g < 0) { for (let q = 0; q < 150; q++) { const w = 26 * (1 - q / 190); thick(x - w / 2, 230 - q, x + w / 2, 230 - q, 2, q % 31 < 2 ? 102 : q < 70 ? 98 : 99); } }
      else { rocks(FX + 20, FY, g, 40, 340, 6, [97, 98, 99, 103], 4251 + k, 220, PI + 0.2, 1.6); megaHit(FX + 10, FY, g, 1.6, PI, [22, 105, 103], 4254 + k); }
    });
    // the arm, from off the right, and the fist with the hero crushed in it (a wing and the head showing)
    capsF(FX + 30, FY, W + 120, FY - 60, 18, 26, (u, d, X, Y, nx) => d > 0.84 ? 96 : OBS[clamp(fl(2 - nx * 1.6 + (bay(X, Y) - 0.5)), 0, 4)]);
    const sqz = 0.75 + 0.1 * Math.sin(t * 9) + SP15.reduce((m, h) => m + (t > h && t < h + 0.25 ? 0.15 * Math.exp(-(t - h) * 10) : 0), 0);
    sGauntlet(FX + 30, FY, 2.2, PI, { curl: sqz, thumb: 0.7, spread: 0.1 }, 0.8, t, { hold: () => {
      z5Wings(FX - 8, FY - 22, 0.9, t * 3, 0.32 + 0.08 * Math.sin(t * 7), 0.7);
      actor(HERO3({ form: 'zenith', eyes: 'closed', mouth: 2, sword: null, sq: 0.25 + 0.1 * Math.sin(t * 9), cracks: 0.2 }), FX - 10, FY - 4, 1.7, -0.6 + z5Sh(t, 5) * 0.2, false, { still: true });
    } });
    streaks(0, 30, t, 2600, 121, 60, 4257, [0, LB, W, H - 2 * LB]);
    shk(4);
    const [kz, kr] = kick(t, SP15.map((h) => [h, 1.2]));
    z5Cam(1.05 + kz, kr, 230, 140, 240, 135);
  });

  /* 16 — the slam (0:33–0:33.5): down onto the stump of a spire, which explodes */
  shot(33.0, 33.5, (lt, t) => {
    belowWorld(t, 120, 900, 0.7);
    const FX = 240, FY = lerp(80, 186, eic(clamp(lt / 0.06, 0, 1)));
    for (let q = 0; q < 50; q++) { const w = 70 * (1 - q / 90); thick(FX - w / 2, 240 - q, FX + w / 2, 240 - q, 2, q % 19 < 2 ? 103 : 98); }
    capsF(FX, FY - 20, FX + 90, LB - 40, 22, 30, (u, d, X, Y, nx) => d > 0.84 ? 96 : OBS[clamp(fl(2 - nx * 1.6 + (bay(X, Y) - 0.5)), 0, 4)]);
    sGauntlet(FX + 10, FY - 30, 2.6, PI / 2 + 0.15, lt < 0.12 ? 'fist' : 'open', 0.9, t);
    if (lt > 0.1) actor(HERO3({ form: 'zenith', eyes: 'closed', mouth: 2, sword: -0.3 }), FX - 40 - lt * 60, 200 - Math.sin(lt * 6) * 30, 1.8, lt * 9, false);
    rocks(FX, 210, lt, 60, 380, 7, [97, 98, 99, 104], 4261, 260, -PI / 2, 2.8);
    megaHit(FX, 205, lt, 3, -PI / 2, [22, 105, 103], 4262);
    shk(9 * Math.max(0, 1 - lt / 0.4));
    z5Cam(1.08 + kick(lt, [[0, 2]])[0], 0, 240, 160, 240, 140);
  });
  FLASH_CUTS.push(33.0);

  /* 17 — it gets up (0:33.5–0:36): in the shallows on the rubble, wings torn. It swings, twice, with everything; a palm
     stops both, and does not move */
  shot(33.5, 36.0, (lt, t) => {
    belowWorld(t, 150, 920, 0.8);
    rocks(240, 230, 1.2, 30, 10, 6, [97, 98, 99, 121], 4271, 0, 0, TAU);
    const PX = 380, PY = 146;                                   // the palm
    const rise = eio(clamp(lt / 0.7, 0, 1)), pant = Math.sin(t * 5) * 0.06;
    const S1 = 34.4, S2 = 35.2, g1 = t - S1, g2 = t - S2;
    let hx = lerp(150, 230, eio(clamp((lt - 0.4) / 0.5, 0, 1))), hy = lerp(214, 170, rise), sw = -0.5, ang = 0.1;
    // swing one: a horizontal cleave; swing two: an overhead with the last of its strength; each bounces off the palm
    if (g1 > -0.35 && g1 < 0.5) { sw = g1 < -0.08 ? lerp(-0.5, -2.7, eio((g1 + 0.35) / 0.27)) : g1 < 0 ? lerp(-2.7, 0.6, eic((g1 + 0.08) / 0.08)) : lerp(0.6, -0.4, eoc(clamp(g1 / 0.4, 0, 1))); hx += g1 > 0 ? -18 * eoc(clamp(g1 / 0.2, 0, 1)) : 26 * eic(clamp((g1 + 0.2) / 0.2, 0, 1)); }
    if (g2 > -0.4 && g2 < 0.8) { sw = g2 < -0.1 ? lerp(-0.4, -3.0, eio((g2 + 0.4) / 0.3)) : g2 < 0 ? lerp(-3.0, 0.9, eic((g2 + 0.1) / 0.1)) : lerp(0.9, 0.2, eoc(clamp(g2 / 0.5, 0, 1))); hx += g2 > 0 ? -30 * eoc(clamp(g2 / 0.25, 0, 1)) : 28 * eic(clamp((g2 + 0.2) / 0.2, 0, 1)); hy += g2 > 0 ? 34 * eoc(clamp(g2 / 0.5, 0, 1)) : 0; ang = g2 > 0 ? -0.5 * eoc(clamp(g2 / 0.4, 0, 1)) : ang; }
    z5Wings(hx - 4, hy - 12, 1.2, t * 1.6, 0.5 + 0.1 * Math.sin(t * 3), 0.4);
    // tears in the wings: gaps burned through them
    for (let k = 0; k < 9; k++) discF(hx - 40 + ih(k, 1, 4272) * 80, hy - 30 - ih(k, 2, 4272) * 40, 3 + ih(k, 3, 4272) * 3, k % 3 ? 98 : 121);
    actor(HERO3({ form: 'zenith', eyes: g2 > 0 ? 'closed' : 'angry', mouth: (g1 > -0.1 && g1 < 0.2) || (g2 > -0.12 && g2 < 0.25) ? 2 : 1, sword: sw, swordCols: z5Sw(t), sq: pant + (rise < 1 ? 0.2 * (1 - rise) : 0), cracks: 0.25 }), hx, hy, 2.4, ang, false);
    aura(t, ZEN_AURA, 6, { sparks: 4 });
    // the palm: immense, still; on the second blow its fingers close a little
    const curl = sstep(S2 + 0.05, S2 + 0.5, t);
    sGauntlet(PX + 60, PY + 10, 3.6, PI, { curl: 0.08 + 0.06 * Math.sin(t * 1.7) + curl * 0.45, thumb: 0.08 + curl * 0.3, spread: 0.85 - curl * 0.4 }, 0.7, t);
    [S1, S2].forEach((h, k) => { const g = t - h; if (g >= 0 && g < 0.35) { i4Skid(PX - 6, PY - 6 + k * 14, g, PI + 0.4 - k * 0.8, 26, 4273 + k); shockRing(PX - 6, PY, 4 + g * 160, 4 + g * 160, 2, [22, 60, 59], 1 - g / 0.3); } });
    shk((g1 > 0 && g1 < 0.2) || (g2 > 0 && g2 < 0.25) ? 3 : 0.5);
    z5Cam(1.08, 0.01 * z5N(t * 0.4, 2), 270, 150, 240, 140);
  });

  /* 18 — WEIGHT (0:36–0:38.2): his palm presses down from above, and everything under it is pressed with it: the sea into a
     crater, the light bent, the hero driven down on its knees, its wings bent to breaking */
  shot(36.0, 38.2, (lt, t) => {
    belowWorld(t, 120, 930, 0.6);
    const CX = 240, CY = 196, press = eic(clamp(lt / 2.2, 0, 1)), pz = sstep(0, 0.3, lt);
    // the sea pressed into a bowl: dark rings sinking
    for (let k = 0; k < 6; k++) { const r = (30 + k * 26) * (0.6 + 0.4 * press) + frac(t * 1.5 + k / 6) * 10; ring(CX, CY + 8, r, r * 0.26, k % 2 ? 114 : 115); }
    for (let y = CY - 8; y < H - LB; y++) for (let x = CX - 110; x < CX + 110; x++) { const dx = (x - CX) / 110, dy = (y - CY - 8) / 30, d = dx * dx + dy * dy; if (d < 1 && d > 0) tintP(x, y, T_DEEP, 0.6 * press * (1 - d)); }
    const hy = CY - 18 + press * 16, wing = 0.55 - 0.35 * press;
    z5Wings(CX, hy - 16 + press * 6, 1.3, t * 2, wing, 0.1);
    actor(HERO3({ form: 'zenith', eyes: lt > 0.6 ? 'closed' : 'wide', mouth: lt > 0.4 ? 2 : 1, sword: 0.6 + press * 0.6, swordCols: z5Sw(t), sq: 0.15 + press * 0.45, cracks: 0.25 + press * 0.45, legs: [2, 2, 2, 2] }), CX, hy, 2.6, 0, false, { still: true });
    aura(t, ZEN_AURA, 6 + z5Sh(t, 2) * 2, { sparks: 6 });
    // the palm, enormous, face down, coming down out of the top of the frame
    const tips = sGauntlet(CX + 10, lerp(-40, 30, eoc(pz)) + press * 26, 5.2, PI / 2, { curl: 0.12 - press * 0.12, thumb: 0.05, spread: 0.7 + press * 0.3 }, 0.9, t);
    if (press > 0.3) for (let k = 0; k < 7; k++) { const a = -PI + (k + 0.5) / 7 * PI, L = 30 + press * 60 * (0.6 + ih(k, 1, 4283) * 0.6); let x = CX + Math.cos(a) * 34, y = CY + 12 + Math.sin(a) * -6; for (let q = 0; q < 6; q++) { const nx = x + Math.cos(a) * L / 6 + (ih(k, q, 4284) - 0.5) * 6, ny = y + Math.sin(a) * -L / 36; lineP(x, y, nx, ny, q < 2 && press > 0.7 ? 104 : 96); x = nx; y = ny; } }
    // the pressure itself: the air dragged downward, the picture bent toward the ground
    streaks(PI / 2, 50, t, 2000, 121, 50, 4281, [0, LB, W, H - 2 * LB]);
    warp(CX, CY - 10, 200, 0.18 + 0.32 * press, 1.4);
    for (let k = 0; k < 20; k++) { const a = -PI + ih(k, 1, 4282) * PI, g = frac(t * 2 + ih(k, 2, 4282)); P(CX + Math.cos(a) * (60 + g * 140), CY + 10 + Math.sin(a) * -(4 + g * 6), 119); }
    shk(2 + press * 5);
    z5Cam(1.05 + 0.1 * press, 0.01 * z5Sh(t, 7) * press, CX, CY - 30, 240, 150);
  });

  /* 19 — Zenith breaks (0:38.2–0:39): the wings burst into prism shards; the light goes out of it; plain coral, falling */
  shot(38.2, 39.0, (lt, t) => {
    belowWorld(t, 120, 930, 0.6);
    const CX = 240, CY = 196;
    rocks(CX, CY - 30, lt, 70, 420, 4, [84, 85, 86, 22], 4291, 260, -PI / 2, PI * 1.3);
    rocks(CX, CY - 30, lt, 40, 300, 3, [81, 82, 83, 22], 4292, 260, -PI / 2, PI * 1.6);
    actor(HERO3({ eyes: 'closed', mouth: 0, sword: 0.9, swordCols: z5Sw(t * 0.2), sq: 0.5 - 0.3 * eoc(clamp(lt / 0.4, 0, 1)), cracks: 0.55, legs: [3, 3, 3, 3] }), CX, CY - 4 + lt * 6, 2.6, 0.2 * eoc(lt), false, { still: true });
    if (lt < 0.034) tintAll(T_WH, 0.55);
    megaHit(CX, CY - 20, lt, 2, -PI / 2, [22, 84, 86], 4293);
    shk(6 * Math.max(0, 1 - lt / 0.5));
    z5Cam(1.15, 0, CX, CY - 30, 240, 150);
  });
  FLASH_CUTS.push(38.2);

  /* 20 — "Is that all?" (0:39–0:41.2): from the ground behind the fallen hero, up at him: he lifts a fist over it, high, higher;
     it comes down at us; the frame breaks */
  shot(39.0, 41.2, (lt, t) => {
    gradient(LB, H - LB, [96, 97, 98, 101]);
    const raise = eio(clamp(lt / 1.4, 0, 1)), wind = eio(lin(1.4, 1.8, lt)), down = eic(clamp((lt - 1.8) / 0.2, 0, 1)), hit = lt >= 2.0;
    const fx = lerp(-40, -96, raise) + wind * -16, fy = lerp(80, -40, raise) - wind * 22;
    sunderer(262, 84, 1.45, t, { eyes: 1.4 + down * 0.5, heat: 0.8, crown: 1, nod: 1.5, rage: 0.3 * wind, arms: [down > 0 ? null : { x: fx, y: fy, pose: 'fist', front: true }, { x: 140, y: 110, pose: 'fist' }, { x: -100, y: 200, pose: 'open' }, { x: 100, y: 200, pose: 'open' }] });
    belowWorldFore(t);
    actor(HERO3({ eyes: 'closed', sword: 1.2, swordCols: z5Sw(t * 0.2), cracks: 0.55, legs: [3, 2, 3, 3] }), 150, 222, 3.0, 0.25, false, { still: true });
    if (down > 0 && !hit) { const sc = lerp(1.6, 9, down * down); sGauntlet(lerp(150, 250, down), lerp(-60, 150, down), sc, PI / 2 + 0.3, 'fist', 1, t); }
    if (hit) { const g = lt - 2.0; rectF(0, LB, W, H - 2 * LB, 96); sGauntlet(250, 135, 9, PI / 2 + 0.3, 'fist', 1, t); frameCrack(250, 135, clamp(g / 0.15, 0, 1), 4301); if (g < 0.034) impactFrame(250, 135, 1); tintAll(T_DARK, sstep(0.12, 0.2, g)); }
    shk(hit ? 10 : wind * 2);
  });
  function belowWorldFore(t) { for (let y = 210; y < H - LB; y++) for (let x = 0; x < W; x++) BUF[y * W + x] = ((x + y) & 3) === 0 ? 115 : 114; for (let k = 0; k < 8; k++) ring(80 + k * 50, 222, 20, 3, 116); }
  FLASH_CUTS.push(41.0);
  CAPS.push([39.2, 40.9, 's', 'SUNDERER', 'IS THAT ALL?']);

  }
