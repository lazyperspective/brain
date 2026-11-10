  /* ================================================================ ACT I — the shadow stands up (0.0–5.4)
     Dawn, where part IV ended. Ash from both brothers streams in from every edge of the frame into the hero's shadow on
     the cloud; the shadow boils, peels off and stands up behind it. 1.6 its eyes open. 3.0 a void blade through the hero's
     back and the sky cracks like glass from its point; 3.6 / 4.0 / 4.4 / 4.8 four strikes, each from another side; 5.4 an
     overhead slam drives the hero down through the cloud floor, which shatters. */
  {
  const HZ = 180, SUN = [352, 160], PUD = [132, 208];
  const HITS = [[3.0, 0.12], [3.6, 0.067], [4.0, 0.067], [4.4, 0.067], [4.8, 0.067], [5.4, 0.1]];
  // where each blow lands (world), the way it throws the hero, how far its cracks run
  const BLOW = [[3.0, 300, 112, 0, 150], [3.6, 252, 120, PI, 100], [4.0, 120, 122, -1.2, 100], [4.4, 176, 42, 0.6, 100], [4.8, 332, 104, 0, 110]];
  const aH = TR([
    { t: 0, x: 232, y: 120, a: 0.16, sw: 0.55, S: 3, eyes: 'narrow', cr: 0.85, form: 'plain', nobob: false },
    { t: 1.6, x: 236, y: 118, a: 0.12 },
    { t: 1.78, x: 237, y: 116, a: 0.04, eyes: 'wide', e: 'o' },
    { t: 2.6, x: 238, y: 118, a: 0.02 },
    { t: 2.96, x: 240, y: 117, a: -0.1, e: 'i' },
    { t: 3.0, x: 252, y: 113, a: -0.34, sq: -0.14, mouth: 2, cr: 1, e: 'l' },
    { t: 3.2, x: 254, y: 113, a: -0.36 },
    { t: 3.36, x: 236, y: 121, a: 0.24, sq: 0.12, e: 'o' },
    { t: 3.6, x: 238, y: 122, a: 0.34, sq: 0, eyes: 'closed', mouth: 1 },
    { t: 3.9, x: 120, y: 112, a: -3.0, mouth: 2, e: 'o' },
    { t: 4.0, x: 116, y: 114, a: -3.3, e: 'l' },
    { t: 4.3, x: 172, y: 42, a: -5.6, e: 'o' },
    { t: 4.4, x: 176, y: 44, a: -5.8, e: 'l' },
    { t: 4.7, x: 326, y: 104, a: -4.3, e: 'o' },
    { t: 4.8, x: 330, y: 105, a: -4.2, e: 'l' },
    { t: 5.12, x: 347, y: 100, a: 0.5, mouth: 1, e: 'o' },
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
    { t: 2.95, x: 96, y: 120, a: -0.16, sq: 0.16, arm: 0, e: 'o' },                    // drawn back
    { t: 3.0, x: 174, y: 116, a: 0.12, sq: -0.14, arm: 0, e: 'i' },                      // the thrust
    { t: 3.2, x: 176, y: 116, a: 0.12 },
    { t: 3.36, x: 110, y: 122, a: -0.1, sq: 0, e: 'o' },                                 // ripped out
    { t: 3.37, x: 110, y: 122, nosw: false, sw: 0.2, arm: undefined },
    { t: 3.52, x: 322, y: 110, flip: true, sw: -2.3, a: 0.28, sq: 0.1 },
    { t: 3.6, x: 296, y: 120, sw: 0.9, a: -0.2, sq: -0.05, e: EQ },
    { t: 3.72, x: 268, y: 124, sw: 1.7, a: -0.3, e: 'o' },
    { t: 3.92, x: 96, y: 192, flip: false, sw: 1.5, a: 0.25, sq: 0.18 },
    { t: 4.0, x: 112, y: 152, sw: -1.3, a: -0.25, sq: -0.1, e: EQ },
    { t: 4.1, x: 120, y: 130, sw: -2.1, e: 'o' },
    { t: 4.32, x: 128, y: 2, sw: -2.4, a: -0.25, sq: 0.1 },
    { t: 4.4, x: 148, y: 22, sw: 0.7, a: 0.3, sq: -0.05, e: EQ },
    { t: 4.5, x: 156, y: 34, sw: 1.4, e: 'o' },
    { t: 4.72, x: 196, y: 106, sw: 0, a: -0.1, sq: 0.2, reach: 0 },
    { t: 4.8, x: 318, y: 104, sw: 0, a: 0.05, sq: -0.2, reach: 4, e: EQ },
    { t: 4.9, x: 446, y: 100, sw: 0.1, sq: 0, e: 'o' },
    { t: 5.22, x: 354, y: 20, flip: true, sw: -2.0, a: 0.32, sq: 0.1, reach: 0 },
    { t: 5.33, x: 352, y: 16, sw: -2.2, a: 0.38, sq: 0.16 },
    { t: 5.4, x: 348, y: 66, sw: 1.1, a: -0.3, sq: -0.16, e: EQ },
    { t: 5.52, x: 348, y: 104, sw: 1.7, a: -0.4, sq: 0, e: 'o' },
    { t: 6, x: 348, y: 108 },
  ], { 3.52: 70, 3.92: -60, 4.32: -50, 4.72: -30, 5.22: 60 });
  aE[10].arm = undefined;
  for (let k = 10; k < aE.length; k++) delete aE[k].arm;
  const view = (t) => {
    const z = t < 1.6 ? lerp(1.0, 1.08, eio(t / 1.6)) : t < 3.0 ? lerp(1.2, 1.3, eio(clip01(1.6, 3.0, t))) : lerp(1.3, 0.8, eoc(clip01(3.02, 3.4, t)));
    const fx = t < 1.6 ? 232 : t < 3.0 ? lerp(206, 212, clip01(1.6, 3, t)) : lerp(212, 240, eoc(clip01(3.02, 3.4, t))), fy = t < 3.0 ? lerp(126, 122, clip01(0, 3, t)) : lerp(122, 124, eoc(clip01(3.02, 3.4, t)));
    const kk = kick(t, [[3.0, 2.2, 0], [3.6, 1.2, PI], [4.0, 1.2, -1.2], [4.4, 1.2, 0.6], [4.8, 1.3, 0], [5.4, 2.4, PI / 2]]);
    return { x: fx - kk[2] * 1.2, y: fy - kk[3] * 1.2, z: z * (1 + kk[0] * 1.2), r: kk[1] };
  };
  // the dawn, the cracks in it, and the worlds starting to show behind the broken panes
  function a1Sky(t, V) {
    w5Dawn(t, t * 6 + (V.x - 240) * 0.3, HZ, SUN[0], SUN[1]);
    if (t >= 3.0) {
      const hits = BLOW.map(([h, x, y, d, R]) => [vX(V, x), vY(V, y), t < h ? 0 : Math.min(R, (t - h) * 700) + (t - h) * 12]);
      glassAct(hits);
      if (t > 4.0) { const W1 = wview('ocean'), W2 = wview('city'), W3 = wview('ink'); glassWindows((q) => (q % 7 === 2 ? W1 : q % 7 === 5 ? W2 : q % 11 === 3 ? W3 : null), (q) => GACT[q] > 0.99 ? clip01(4.0 + (q % 5) * 0.2, 5.3, t) * 0.8 : 0, 0, 0); }
      glassCracks(hits);
    }
  }
  function a1Scene(t) {
    const V = view(t), tt = h5Stop(t, HITS), frz = h5Frz(t, HITS) ? 1.5 : 0;
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
      // the blade: it draws itself out of the ash in its hand, and it is this that goes through the hero
      if (t > 1.95 && tt < 3.37) {
        const g = eoc(clip01(1.95, 2.5, t)), ang = lerp(0.9, 0, eio(clip01(2.3, 2.9, t))) + pe.ang, len = lerp(80, 122, clip01(2.96, 3.0, t)) * g * V.z, hx = E.hand[0] + Math.cos(ang) * 4 * V.z, hy = E.hand[1] + Math.sin(ang) * 4 * V.z;
        bigBlade(hx, hy, ang, len, 4.2 * V.z, t, { form: 'void', grow: g < 1 ? 0.999 : 1, flare: 0.5 });
        if (g < 1) for (let k = 0; k < 16; k++) { const u = frac(ih(k, 1, 9107) + t * 2), a2 = ih(k, 2, 9107) * TAU; P(hx + Math.cos(ang) * len + Math.cos(a2) * 22 * (1 - u), hy + Math.sin(ang) * len + Math.sin(a2) * 22 * (1 - u), k % 3 ? 121 : 72); }
        E.tip = [hx + Math.cos(ang) * len, hy + Math.sin(ang) * len];
      }
      h5Ash(aE, tt, V, t < 1.6 ? 40 : 24, -26, -30, undefined, 0.8);
      if (t >= 1.6 && t < 1.9) { const g = t - 1.6; shockRing(E.x, E.y - 6, 10 + g * 300, 6 + g * 170, 2, [74, 72, 102], 1 - g / 0.3); light(E.x, E.y, 90 * (1 - g / 0.3), L_MAG, 0.7); }
    }
    // the hero (drawn over the blade: it enters its back and comes out of its chest)
    const ph = h5Pose(aH, tt), hx0 = vX(V, ph.x), hy0 = vY(V, ph.y);
    // the four sparks that stayed with it: knocked away when the blade lands
    const sg = t - 3.0;
    for (let pass = 0; pass < 2; pass++) {
      if (pass) { const HR = h5F(aH, tt, { form: 'plain', frz, rim: [1, -0.4, 60] }, V); if (E && E.tip && tt >= 3.0 && tt < 3.34) { const ex = HR.x + 36 * V.z, L2 = E.tip[0] - ex; if (L2 > 4) { bigBlade(ex, E.tip[1], 0, L2, 4.2 * V.z, t, { form: 'void', flare: 0.7, noHilt: true }); for (let k = 0; k < 8; k++) { const u = frac(ih(k, 1, 9109) + t * 2.2); P(ex + ih(k, 2, 9109) * L2, E.tip[1] + 4 + u * 26, u < 0.4 ? 22 : 59); } sparkle(ex, E.tip[1], 5, 22, 59); } } if (t > 3.0) { for (let k = 0; k < 10; k++) { const u = frac(ih(k, 1, 9108) + t * 1.3), a2 = ih(k, 2, 9108) * TAU; if (bay(k, fl(t * 30)) < 1 - u) P(HR.x + Math.cos(a2) * 30 * u * V.z + (ih(k, 3, 9108) - 0.5) * 30, HR.y + Math.sin(a2) * 20 * u + 30 * u * u, u < 0.4 ? 22 : 59); } light(HR.x, HR.y, 50, L_GOLD, 0.25); } }
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
    for (let k = 0; k < BLOW.length; k++) { const [h, x, y, d] = BLOW[k], g = t - h; if (g < 0 || g > 1) continue; if (k === 0) h5Heavy(vX(V, x), vY(V, y), g, 2.2, 0, [22, 59, 58], 9110, 2, [72, 73, 74, 104, 107], L_GOLD); else { h5Heavy(vX(V, x), vY(V, y), g, 1.3, d, [22, 74, 72], 9111 + k, 0, null, L_MAG); if (g < 0.034) { GD.flash = 0.35; GD.fc = [1, 0.85, 0.95]; } } }
    if (t >= 5.4) h5Heavy(vX(V, 346), vY(V, 92), t - 5.4, 2.6, PI / 2, [22, 74, 72], 9119, 1, [72, 73, 74, 104, 107], L_MAG);
    if (t > 3.0 && t < 3.3) { const g = t - 3.0; rocks(vX(V, 300), vY(V, 112), g, 12, 240, 4, [137, 136, 135, 22], 9120, 200, 0, 1.6); }
    if (V.r) z5Cam(1, V.r, 240, 135);
    return V;
  }
  shot(0, 5.4334, (lt, t) => { a1Scene(t); if (t < 0.25) { GD.flash = 0.25 * (1 - t / 0.25); GD.fc = [1, 0.9, 0.75]; } });
  CAPS.push([2.2, 3.5, 's', 'HOLLOW', 'YOU LEFT A SHADOW.']);
  // (kept for the breach: the sky as it was when the floor went)
  WORLDS.a1 = () => { const V = { x: 240, y: 124, z: 0.8, r: 0 }; a1Sky(5.4, V); };
  }
