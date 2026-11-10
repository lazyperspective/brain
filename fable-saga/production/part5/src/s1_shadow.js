  /* ================================================================ ACT I — the shadow stands up (0.0–5.4)
     Dawn, where part IV ended. Ash from both brothers streams in from every edge of the frame into the hero's shadow on
     the cloud; the shadow boils, peels off and stands up behind it. 1.6 its eyes open. 3.0 a void blade through the hero's
     back and the sky cracks like glass from its point; 3.6 / 4.0 / 4.4 / 4.8 four strikes, each from another side; 5.4 an
     overhead slam drives the hero down through the cloud floor, which shatters. */
  {
  const HZ = 180, SUN = [354, 96], PUD = [132, 208];
  const D1 = (t) => t < 3.0 ? 0.1 : 0.35 + 0.12 * ((t >= 3.6) + (t >= 4.0) + (t >= 4.4) + (t >= 4.8)) + 0.1 * (t >= 5.4);
  const HITS = [[3.0, 0.134], [3.6, 0.1], [4.0, 0.1], [4.4, 0.1], [4.8, 0.1], [5.4, 0.134]];
  // where each blow lands (world), the way it throws the hero, how far its cracks run
  const BLOW = [[3.0, 300, 112, 0, 150], [3.6, 252, 120, PI, 100], [4.0, 120, 122, -1.2, 100], [4.4, 176, 42, 0.6, 100], [4.8, 332, 104, 0, 110]];
  const aH = TR([
    { t: 0, x: 232, y: 120, a: 0.16, sw: 0.55, S: 3, eyes: 'narrow', cr: 0.85, form: 'plain', nobob: false },
    { t: 1.6, x: 236, y: 118, a: 0.12 },
    { t: 1.78, x: 237, y: 116, a: 0.04, eyes: 'wide', e: 'o' },
    { t: 2.6, x: 238, y: 118, a: 0.02 },
    { t: 2.96, x: 240, y: 117, a: -0.1, e: 'i' },
    { t: 3.0, x: 254, y: 111, a: -0.5, sq: -0.22, mouth: 2, cr: 1, eyes: 'wide', e: 'l' },
    { t: 3.2, x: 254, y: 113, a: -0.36 },
    { t: 3.36, x: 236, y: 121, a: 0.24, sq: 0.12, e: 'o' },
    { t: 3.6, x: 238, y: 122, a: 0.34, sq: 0.3, eyes: 'closed', mouth: 1 },
    { t: 3.68, x: 214, y: 120, a: -0.9, sq: -0.2, mouth: 2, e: 'o' },
    { t: 3.9, x: 120, y: 112, a: -3.0, sq: 0, mouth: 2, e: 'o' },
    { t: 4.0, x: 116, y: 114, a: -3.3, sq: 0.3, e: 'l' },
    { t: 4.08, x: 128, y: 92, a: -4.1, sq: -0.2, e: 'o' },
    { t: 4.3, x: 172, y: 42, a: -5.6, sq: 0, e: 'o' },
    { t: 4.4, x: 176, y: 44, a: -5.8, sq: 0.3, e: 'l' },
    { t: 4.48, x: 206, y: 62, a: -5.2, sq: -0.2, e: 'o' },
    { t: 4.7, x: 326, y: 104, a: -4.3, sq: 0, e: 'o' },
    { t: 4.8, x: 330, y: 105, a: -4.2, sq: 0.32, e: 'l' },
    { t: 4.9, x: 350, y: 102, a: -3.4, sq: -0.2, e: 'o' },
    { t: 5.12, x: 347, y: 100, a: 0.5, sq: 0, mouth: 1, e: 'o' },
    { t: 5.4, x: 346, y: 103, a: 0.3, eyes: 'narrow' },
    { t: 5.5, x: 346, y: 330, a: 0.05, sq: -0.3, eyes: 'closed', mouth: 2, e: 'l' },
    { t: 6, x: 346, y: 800 },
  ]);
  const aE = TR([
    { t: 0, x: 124, y: 262, S: 3, a: 0, flip: false, eyes: 'closed', nosw: true, sq: -0.42, form: 'hollow', mask: false, arm: 0.6, hide: true },
    { t: 0.85, x: 124, y: 262, hide: false },
    { t: 1.5, x: 122, y: 126, sq: 0.06, e: 'o' },
    { t: 1.6, x: 122, y: 124, sq: 0, mask: true, eyes: 'wide' },
    { t: 1.95, x: 120, y: 124, eyes: 'narrow' },
    { t: 2.45, x: 118, y: 122, a: 0.04, arm: 0.2 },
    { t: 2.75, x: 100, y: 120, a: -0.14, sq: 0.12, arm: 0, e: 'o' },                    // drawn back
    { t: 2.88, x: 94, y: 119, a: -0.2, sq: 0.2, arm: 0 },
    { t: 3.0, x: 174, y: 116, a: -0.14, sq: -0.14, arm: 0, nolean: true, e: 'i' },        // the thrust
    { t: 3.2, x: 176, y: 116, a: -0.14 },
    { t: 3.36, x: 110, y: 122, a: -0.1, sq: 0, e: 'o' },                                 // ripped out
    { t: 3.37, x: 110, y: 122, nosw: false, sw: 0.2, arm: undefined },
    { t: 3.47, x: 326, y: 110, flip: true, sw: -2.1, a: 0.22, sq: 0.08 },
    { t: 3.56, x: 330, y: 108, sw: -2.5, a: 0.34, sq: 0.2, e: 'o' },
    { t: 3.6, x: 296, y: 120, sw: 0.9, a: -0.2, sq: -0.05, e: EQ },
    { t: 3.72, x: 268, y: 124, sw: 1.7, a: -0.3, e: 'o' },
    { t: 3.86, x: 92, y: 196, flip: false, sw: 1.3, a: 0.2, sq: 0.1 },
    { t: 3.96, x: 88, y: 200, sw: 1.7, a: 0.32, sq: 0.24, e: 'o' },
    { t: 4.0, x: 112, y: 152, sw: -1.3, a: -0.25, sq: -0.1, e: EQ },
    { t: 4.1, x: 120, y: 130, sw: -2.1, e: 'o' },
    { t: 4.26, x: 126, y: 4, sw: -2.2, a: -0.2, sq: 0.08 },
    { t: 4.36, x: 122, y: -2, sw: -2.6, a: -0.32, sq: 0.22, e: 'o' },
    { t: 4.4, x: 148, y: 22, sw: 0.7, a: 0.3, sq: -0.05, e: EQ },
    { t: 4.5, x: 156, y: 34, sw: 1.4, e: 'o' },
    { t: 4.66, x: 200, y: 106, sw: 0, a: -0.08, sq: 0.12, reach: 0 },
    { t: 4.76, x: 190, y: 107, sw: 0, a: -0.16, sq: 0.26, e: 'o' },
    { t: 4.8, x: 318, y: 104, sw: 0, a: 0.05, sq: -0.2, reach: 4, e: EQ },
    { t: 4.9, x: 446, y: 100, sw: 0.1, sq: 0, e: 'o' },
    { t: 5.12, x: 356, y: 4, flip: true, sw: -2.0, a: 0.3, sq: 0.08, reach: 0 },
    { t: 5.33, x: 354, y: -4, sw: -2.2, a: 0.38, sq: 0.16 },
    { t: 5.4, x: 348, y: 66, sw: 1.1, a: -0.3, sq: -0.16, e: EQ },
    { t: 5.52, x: 348, y: 104, sw: 1.7, a: -0.4, sq: 0, e: 'o' },
    { t: 6, x: 348, y: 108 },
  ], { 3.47: 70, 3.86: -60, 4.26: -50, 4.66: -30, 5.12: 60 });
  aE[10].arm = undefined;
  for (let k = 10; k < aE.length; k++) delete aE[k].arm;
  // the camera: a slow push on the two of them; at 3.0 a crash-in to the blade coming out of its chest (held), then a whip
  // back out to a follow-shot of the blitz, and a pull back for the slam
  const ECU = [286, 120, 1.62];
  const view = (t) => {
    const kk = kick(t, [[3.0, 1.4, 0], [3.6, 1.6, PI], [4.0, 1.6, -1.2], [4.4, 1.6, 0.6], [4.8, 1.7, 0], [5.4, 2.6, PI / 2]]);
    let x, y, z;
    if (t < 3.0) { const u = eio(clip01(1.6, 2.98, t)); z = t < 1.6 ? lerp(1.0, 1.1, eio(t / 1.6)) : lerp(1.15, 1.42, u); x = t < 1.6 ? 226 : lerp(208, 198, u); y = t < 1.6 ? 126 : lerp(124, 120, u); }
    else if (t < 3.42) { const u = clip01(3.13, 3.42, t); z = ECU[2] + 0.25 * u; x = ECU[0] + 4 * u; y = ECU[1]; }
    else {
      let sx = 0, sy = 0; for (let k = 0; k < 8; k++) { const p = h5Trk(aH, Math.max(3.42, t - k * 0.04)); sx += p.x / 8; sy += p.y / 8; }
      const w = eoc(clip01(3.42, 3.56, t)), sl = eio(clip01(5.05, 5.36, t));
      x = lerp(ECU[0], lerp(sx, 240, 0.35), w); y = lerp(ECU[1], lerp(sy, 118, 0.4), w); z = lerp(ECU[2], 1.12, w);
      x = lerp(x, 330, sl); y = lerp(y, 92, sl); z = lerp(z, 0.95, sl);
    }
    return { x: x - kk[2] * 1.2, y: y - kk[3] * 1.2, z: z * (1 + kk[0] * 1.2), r: kk[1] };
  };
  // the dawn, the cracks in it, and the worlds starting to show behind the broken panes
  function a1Sky(t, V) {
    const zs = Math.pow(V.z, 0.85);
    w5Dawn(t, t * 6 + (V.x - 240) * 0.3, (HZ - V.y) * zs + 135, (SUN[0] - V.x) * zs + 240, (SUN[1] - V.y) * zs + 135, { sunR: zs });
    if (t >= 3.0) {
      const hits = BLOW.map(([h, x, y, d, R]) => [vX(V, x), vY(V, y), t < h ? 0 : Math.min(R, (t - h) * 700) + (t - h) * 12]);
      glassAct(hits);
      { const PANES = [[3.6, 252, 120, 'ocean'], [4.0, 120, 122, 'city'], [4.4, 176, 42, 'ink'], [4.8, 332, 104, 'cath']], pick = []; for (const [h, x, y, w] of PANES) { if (t < h + 0.05) continue; let b = 0, bd = 1e9; for (let q = 0; q < GN; q++) { const d = Math.hypot(GSX[q] - vX(V, x), GSY[q] - vY(V, y)); if (d < bd) { bd = d; b = q; } } pick.push([b, wview(w), h]); } const recent = pick.slice(-2); glassWindows((q) => { for (const p of recent) if (p[0] === q) return p[1]; return null; }, (q) => { for (const p of recent) if (p[0] === q) return clip01(p[2] + 0.04, p[2] + 0.2, t); return 0; }, 0, 0); }
      glassCracks(hits);
    }
  }
  let A1EXIT = null, A1TIPW = null;
  // the near layer: big flakes of ash crossing the lens, and (once the sky has cracked) splinters of it coming down
  function a1Fore(t, V) {
    for (let k = 0; k < 22; k++) { const sp = 30 + ih(k, 1, 9130) * 40, x = ((ih(k, 2, 9130) * 600 - t * sp - (V.x - 240) * 1.6) % 600 + 600) % 600 - 60, y = LB + ((ih(k, 3, 9130) * 240 + t * (10 + ih(k, 4, 9130) * 14) - (V.y - 124) * 1.6) % 240), s = 2 + fl(ih(k, 5, 9130) * 2.5); rectF(x, y, s + 1, s, k % 5 === 0 ? 72 : k % 3 ? 0 : 120); if (k % 4 === 0) P(x + s + 1, y, 102); }
    if (t > 3.62) for (let k = 0; k < 12; k++) { const b = 3.62 + ih(k, 1, 9131) * 1.6, a = t - b; if (a < 0) continue; const x = 30 + ih(k, 2, 9131) * 420 + Math.sin(a * 2 + k) * 10 - (V.x - 240) * 1.3, y = LB - 10 + a * a * 140 + a * 30, r = 3 + ih(k, 3, 9131) * 6; if (y > H) continue; h5Shard(shardPts(x, y, r * 1.5, r, a * 3 + k, 110 + k, 5), ['ocean', 'city', 'ink', 'cath'][k % 4], 100 + k * 30, 80 + k * 9, t, { seed: k, glint: k % 2 === 0 }); }
  }
  function a1Scene(t) {
    const V = view(t), [tt, fz] = h5Clock(t, HITS, 0.1, 2.6), frz = fz ? 1.5 : 0;
    H5PX = 0; H5PY = 0;
    a1Sky(t, V);
    // the ash of both brothers, from every edge, into the shadow
    const drain = clip01(0.9, 1.7, t), px = vX(V, PUD[0]), py = vY(V, PUD[1]);
    ashStreams(t + 3, px, py - 60 * eio(drain), 420, 1 - clip01(1.5, 2.3, t), 9101);
    // the shadow on the cloud: it boils, spreads, then drains up into what stands
    if (t < 1.9) {
      const grow = eoc(clip01(-0.5, 0.9, t)) * (1 - eio(drain)), rx = (26 + 30 * grow) * V.z, ry = (3.5 + 3.5 * grow) * V.z;
      for (let y = fl(py - ry - 14); y <= py + ry + 2; y++) for (let x = fl(px - rx - 8); x <= px + rx + 8; x++) {
        const dx = (x - px) / rx, dy = (y - py) / ry, n = vn(x + t * 9, y * 3 - t * 30, 5, 9102), d = dx * dx + dy * dy - (n - 0.5) * 0.9 * (dy < 0 ? 1.8 : 0.5);
        if (d > 1) continue; P(x, y, d > 0.78 ? (ih(x, fl(t * 12), 9103) < 0.3 ? 72 : 78) : ih(x, y, 9104) < 0.02 ? 57 : 134);
      }
      for (let k = 0; k < 9; k++) { const u = frac(ih(k, 1, 9105) + t * (0.9 + ih(k, 2, 9105))), bx = px + (ih(k, 3, 9105) - 0.5) * 2 * rx, hh = (10 + ih(k, 4, 9105) * 34) * grow * V.z * Math.sin(u * PI); for (let q = 0; q < hh; q++) { const xx = bx + Math.sin(q * 0.3 + t * 6 + k) * 2; P(xx, py - q, q > hh - 2 ? 72 : 134); if (q < hh * 0.5) P(xx + 1, py - q, 134); } }
      light(px, py, 60, L_DARK, 0.3 * grow);
    }
    // the Hollow
    const pe = h5Pose(aE, tt);
    let E = null;
    if (!pe.hide) {
      const rising = t < 1.6, base = { form: 'hollow', frz };
      if (rising) { const k2 = aE.map((k) => Object.assign({}, k)); k2.arcs = aE.arcs; for (const k of k2) k.clipY = py + 1; E = h5F(k2, tt, base, V); for (let q = 0; q < 14; q++) { const u = frac(ih(q, 1, 9106) + t * 1.4), xx = E.x + (ih(q, 2, 9106) - 0.5) * 60 * V.z, y0 = E.y + 20 * V.z; lineF(xx, Math.min(py, y0 + u * 30), xx + Math.sin(t * 5 + q) * 3, py, (X, Y, f) => { if (bay(X, Y) < 0.8 - f * 0.4) P(X, Y, f > 0.9 ? 72 : 134); }); } }
      else E = h5F(aE, tt, base, V);
      // the tell: a glint runs up the blade; then the thrust smears
      if (E.tip && t > 2.62 && t < 2.9) { const u = clip01(2.62, 2.86, t); sparkle(lerp(E.hand[0], E.tip[0], u), lerp(E.hand[1], E.tip[1], u), 2 + 5 * u, 22, 74); }
      // the blade: it draws itself out of the ash in its hand, and it is this that goes through the hero
      if (t > 1.95 && tt < 3.37) {
        const g = eoc(clip01(1.95, 2.5, t)), ang = lerp(0.9, 0, eio(clip01(2.3, 2.9, t))) + pe.ang, len = lerp(80, 122, clip01(2.96, 3.0, t)) * g * V.z, hx = E.hand[0] + Math.cos(ang) * 4 * V.z, hy = E.hand[1] + Math.sin(ang) * 4 * V.z;
        bigBlade(hx, hy, ang, len, 4.2 * V.z, t, { form: 'void', grow: g < 1 ? 0.999 : 1, flare: 0.5 });
        if (g < 1) for (let k = 0; k < 16; k++) { const u = frac(ih(k, 1, 9107) + t * 2), a2 = ih(k, 2, 9107) * TAU; P(hx + Math.cos(ang) * len + Math.cos(a2) * 22 * (1 - u), hy + Math.sin(ang) * len + Math.sin(a2) * 22 * (1 - u), k % 3 ? 121 : 72); }
        E.tip = [hx + Math.cos(ang) * len, hy + Math.sin(ang) * len];
        if (t > 2.9 && t < 3.0) for (let k = 0; k < 12; k++) { const o = (k - 5.5) * 3 * V.z, L2 = (60 + ih(k, 1, 9116) * 90) * V.z, c = Math.cos(ang), s2 = Math.sin(ang), bx = hx - s2 * o, by = hy + c * o; lineF(bx, by, bx - c * L2, by - s2 * L2, (X, Y, u) => { if (bay(X, Y) < 0.95 - u) P(X, Y, k % 3 ? 78 : 74); }); }
      }
      h5Ash(aE, tt, V, t < 1.6 ? 40 : 24, -26, -30, undefined, 0.8);
      if (t >= 1.6 && t < 1.9) { const g = t - 1.6; shockRing(E.x, E.y - 6, 10 + g * 300, 6 + g * 170, 2, [74, 72, 102], 1 - g / 0.3); light(E.x, E.y, 90 * (1 - g / 0.3), L_MAG, 0.7); }
    }
    // the hero (drawn over the blade: it enters its back and comes out of its chest)
    const ph = h5Pose(aH, tt), hx0 = vX(V, ph.x), hy0 = vY(V, ph.y);
    // the four sparks that stayed with it: knocked away when the blade lands
    const sg = t - 3.0;
    for (let pass = 0; pass < 2; pass++) {
      if (pass) { const HR = h5F(aH, tt, { form: 'plain', frz, rim: [1, -0.4, 60], dmg: D1 }, V); A1EXIT = null; if (E && E.tip && tt >= 3.0 && tt < 3.34) { const ex = HR.x + 36 * V.z, L2 = E.tip[0] - ex; A1EXIT = [ex, E.tip[1]]; if (t < 3.02) A1TIPW = [(E.tip[0] - 240) / V.z + V.x, (E.tip[1] - 135) / V.z + V.y]; if (L2 > 4) { bigBlade(ex, E.tip[1], 0, L2, 4.2 * V.z, t, { form: 'void', flare: 0.7, noHilt: true }); for (let k = 0; k < 8; k++) { const u = frac(ih(k, 1, 9109) + t * 2.2); P(ex + ih(k, 2, 9109) * L2, E.tip[1] + 4 + u * 26, u < 0.4 ? 22 : 59); } sparkle(ex, E.tip[1], 5, 22, 59); } } if (t > 3.0) { for (let k = 0; k < 10; k++) { const u = frac(ih(k, 1, 9108) + t * 1.3), a2 = ih(k, 2, 9108) * TAU; if (bay(k, fl(t * 30)) < 1 - u) P(HR.x + Math.cos(a2) * 30 * u * V.z + (ih(k, 3, 9108) - 0.5) * 30, HR.y + Math.sin(a2) * 20 * u + 30 * u * u, u < 0.4 ? 22 : 59); } light(HR.x, HR.y, 50, L_GOLD, 0.25); } }
      for (let k = 0; k < 4; k++) {
        const a = t * 0.75 + k * TAU / 4, zz = Math.sin(a); if ((zz > 0) !== !!pass) continue;
        let x = hx0 + Math.cos(a) * 62 * V.z, y = hy0 - 10 + zz * 22 * V.z + Math.sin(t * 2 + k) * 3, al = 1;
        if (sg > 0) { const d = eoc(sg / 0.5), aa = a + (k - 1.5) * 0.3; x += Math.cos(aa) * 260 * d; y += Math.sin(aa) * 150 * d - 40 * d; al = 1 - sg / 0.5; if (al <= 0) continue; }
        if (bay(k, fl(t * 30)) > al) continue;
        light(x, y, 16, [L_COLD, [0.5, 1, 0.4], L_GOLD, L_VIO][k], 0.5 * al); discF(x, y, 3.2, 63); discF(x, y, 2.4, ORB[k][1]); discF(x - 0.7, y - 0.7, 1.3, ORB[k][2]); P(x - 1, y - 1, 22);
        for (let q = 1; q < 7; q++) { const a3 = a - q * 0.04; if (sg <= 0 && bay(fl(x) + q, fl(y)) < 1 - q / 7) P(hx0 + Math.cos(a3) * 62 * V.z, hy0 - 10 + Math.sin(a3) * 22 * V.z + Math.sin(t * 2 + k) * 3, ORB[k][q < 3 ? 2 : 1]); }
      }
    }
    // the blows
    for (let k = 0; k < BLOW.length; k++) { const [h, x, y, d] = BLOW[k], g = t - h; if (g < 0 || g > 1.1) continue; if (k === 0) { if (A1EXIT) h5Blow(A1EXIT[0], A1EXIT[1], g, 1.6, 0.1, [22, 104, 102], 9110, 2, [72, 73, 74, 104, 107, 0, 134, 77, 78], L_CRIM, ['ocean', 'city', 'ink']); } else h5Blow(vX(V, x), vY(V, y), g, 1.3, d, [22, 74, 72], 9111 + k, 0, null, L_MAG, ['dawn', 'ocean', 'ink']); }
    if (t >= 5.4) h5Blow(vX(V, 346), vY(V, 92), t - 5.4, 2.6, PI / 2, [22, 74, 72], 9119, 1, [72, 73, 74, 104, 107], L_MAG);
    a1Fore(t, V);
    if (V.r) z5Cam(1, V.r, 240, 135);
    return V;
  }
  shot(0, 5.4334, (lt, t) => { a1Scene(t); if (t < 0.25) { GD.flash = 0.25 * (1 - t / 0.25); GD.fc = [1, 0.9, 0.75]; } });
  CAPS.push([2.2, 3.5, 's', 'HOLLOW', 'YOU LEFT A SHADOW.']);
  // (kept for the breach: the sky as it was when the floor went)
  WORLDS.a1 = () => { const V = { x: 240, y: 124, z: 0.8, r: 0 }; a1Sky(5.4, V); };
  }
