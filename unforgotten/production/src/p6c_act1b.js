  /* ================================================================ ACT ONE (b) — the harbour: Tamo, the anchor, the Hush, the Bellwether */
  const DY = 0.35;                                             // the dock's top
  function anchorProp(x, y, z, ang, size, glowA, opt) {
    clearSprite(); drawAnchor(30, 37, PI / 2, glowA); outlineSprite();
    const p = proj(x, y, z); if (!p) return null;
    const S = CAM.F / p.z / 26 * (size || 2.2);
    clearMask(); stamp(p.x, p.y, S, ang || 0, false, Object.assign({ z: p.z, fog: true }, opt || {}));
    return { x: p.x, y: p.y, S };
  }
  function crate3(x, y, z, s) { box(x - s / 2, y, z - s / 2, x + s / 2, y + s, z + s / 2, (f, u, v, xx, yy, tt, L) => shadeC(R.wood, 2.8 + L * 2.4 - (frac(u / 0.22) < 0.12 ? 1 : 0) - (u < 0.06 || v < 0.06 || u > s - 0.06 || v > s - 0.06 ? 1.2 : 0), xx, yy)); }
  function fish3(x, y, z, a, flop) { const p = proj(x, y, z); if (!p) return; const s = Math.max(2, Math.min(9, CAM.F / p.z * 0.16)), ca = Math.cos(a), sa = Math.sin(a); for (let k = -s; k <= s; k++) { const w = Math.max(0, (1 - Math.abs(k) / s) * s * 0.35); for (let j = -w; j <= w; j++) PZ(p.x + ca * k - sa * j, p.y + sa * k + ca * j, j < 0 ? C('stone', 7) : C('sea', 4), p.z - 0.05); } PZ(p.x + ca * s * 0.6, p.y + sa * s * 0.6 - 1, C('night', 0), p.z - 0.06); for (let j = -2; j <= 2; j++) PZ(p.x - ca * (s + 1) - sa * j * (1 + flop), p.y - sa * (s + 1) + ca * j, C('stone', 5), p.z - 0.05); }
  const ANCHOR_X = 6.2;
  // the morning harbour, with whatever has changed by time t
  function harbour(t, opt) {
    opt = opt || {};
    const drain = opt.drain || 0;
    drawHarbour(t, { lights: [], skipCrate: opt.skipCrate });
    ink(2);
    if (!opt.noGulls) gulls(t, 10, 2, 7, 14, t > 228.5 ? 228.5 : undefined);
    return drain;
  }
  // the hush over the harbour: a ring spreading from under the sigil
  const HUSH_O = [40, 0, 62], hushR = (t) => Math.min(52, Math.max(0, (t - 246.0) * 6));
  function harbourHush(t) {
    if (t < 228.5) return;
    const R0 = hushR(t);
    hushWorld(t, (wx, wy, wz) => {
      const d = Math.hypot(wx - HUSH_O[0], wz - HUSH_O[2]);
      let a = 0.14 * lin(228.5, 231, t);
      if (R0 > 0) a = Math.max(a, d < R0 - 4 ? 0.85 : d < R0 ? 1 : 0);
      return a;
    }, true);
  }

  // 24 — the dock at morning: Tamo with a crate; something falls out of the sky onto him (2:56)
  const IMPACT = 178.0;
  shot(176.0, 182.0, (lt, t) => {
    const g = t - IMPACT;
    lookAt(-8.5 + lt * 0.2, 2.0, -9.5, -3, 1.0, 1.5, 54);
    harbour(t);
    if (g < 0) {
      const x = lerp(-11, -3, lin(176, IMPACT, t));
      const a = actor3('tamo', { view: 'side', run: t * 8, armF: -1.5, armL: -1.6, eyes: 'closed', smile: 0.7, mouth: 0.3 + Math.sin(t * 6) * 0.1 }, x, DY, 0.4, { dark: 0 });
      crate3(x + 0.1, 1.95, 0.4, 0.95);
      // a streak from the sky
      if (g > -0.35) { const p = proj(x, 1.2, 0.4); if (p) { const top = Math.max(LB, p.y - 300 * (1 + g / 0.35)); for (let y = top; y < p.y - 30; y++) for (let q = -3; q <= 3; q++) if (bay(fl(p.x + q), fl(y)) < 1 - Math.abs(q) / 4) P(p.x + q, y, q === 0 ? WHITE : C('indigo', 6)); } }
    } else {
      // the pile-up
      const sit = lin(3.3, 3.8, g);
      actor3('tamo', { view: 'side', eyes: g < 3.2 ? 'closed' : 'open', brows: 'angry', armF: -0.4, mouth: 0 }, -3.3, DY + 0.05, 0.4, { ang: lerp(-1.5, -0.2, sit) });
      actor3('kaira', { view: 'side', eyes: 'closed', blade2: 2.4, wind: 1 }, -1.6, DY + 0.05, 0.9, { ang: 1.5, flip: true });
      if (g < 1.4) for (let k = 0; k < 18; k++) { const a = -PI * (0.1 + 0.8 * ih(k, 1, 401)), v = 2 + ih(k, 2, 401) * 4, gx = -2.6 + Math.cos(a) * v * g, gy = 1.6 + -Math.sin(a) * v * g - 4.9 * g * g, gz = 0.4 + (ih(k, 3, 401) - 0.5) * 2 * g; if (gy > DY) box(gx - 0.3, gy, gz - 0.06, gx + 0.3, gy + 0.08, gz + 0.06, flatMat(R.wood, 3)); }
      for (let k = 0; k < 9; k++) { const a = -PI * (0.15 + 0.7 * ih(k, 4, 401)), v = 1.5 + ih(k, 5, 401) * 3, land = 0.9 + ih(k, 6, 401) * 0.6; const gg = Math.min(g, land); fish3(-2.6 + Math.cos(a) * v * gg, Math.max(DY + 0.05, 1.6 - Math.sin(a) * v * gg - 4.9 * gg * gg), 0.4 + (ih(k, 7, 401) - 0.5) * 2 * gg, g > land ? Math.sin(t * 12 + k) * 0.6 : g * 9 + k, g > land ? Math.sin(t * 20 + k) : 0); }
      // one last fish, onto his head
      const fg = t - 180.5; if (fg > -0.5) { const fy = fg < 0 ? 1.8 - fg * 6 : 1.25 + DY; fish3(-3.25, fy, 0.38, fg > 0 ? 0.1 : -1.2, fg > 0 ? Math.sin(t * 22) : 0); }
      hitFx(240, 150, g, 1.2, [WHITE, C('gold', 6)]);
    }
  });

  // 25 — "that was the GOOD crate!" / "you should run" / "run from wh—" THUD THUD THUD (3:02)
  const THUDS = [188.6, 188.8, 189.0], WDX = [-7.2, -6.2, -5.2];
  function wardenDrop(t, k, x, z) { const g = t - THUDS[k]; const y = g < 0 ? DY + Math.min(14, -g * 30) : DY; return { y, g }; }
  shot(182.0, 197.0, (lt, t) => {
    if (t < 187.5) {
      lookAt(-2.0, 1.25, -3.8, -2.4, 0.9, 0.4, 46);
      harbour(t);
      actor3('tamo', { view: 'front', crouch: 1.2, kneel: false, eyes: blink(t, 21) ? 'closed' : 'open', brows: 'angry', mouth: mouth('tamo', t), smile: -0.6, armF: talking('tamo', t) ? -0.9 + Math.sin(t * 8) * 0.3 : 1.3 }, -3.0, DY, 0.4, {});
      fish3(-3.0, 1.18 + DY, 0.36, 0.2, Math.sin(t * 18));
      const up = lin(184.6, 185.0, t);
      actor3('kaira', { view: up > 0.5 ? 'front' : 'side', crouch: 1 - up, eyes: blink(t, 22) ? 'closed' : 'open', brows: t > 185 ? 'up' : 'worried', mouth: mouth('kaira', t), smile: t > 185 && t < 186 ? 0.5 : 0, armF: t > 186 ? -0.4 : 1.2, seed: 0.5, blade2: 2.4 }, -1.4, DY, 0.6, { flip: up < 0.5 });
    } else if (t < 189.4) {
      // Tamo, close: "run from wh—" … and three shapes land behind him
      lookAt(-2.6, 1.3, -2.6, -3.0, 1.05, 0.4, 40);
      harbour(t);
      for (let k = 0; k < 3; k++) { const d = wardenDrop(t, k); actor3('warden', { view: 'front', spear: -1.3, crouch: d.g > 0 && d.g < 0.2 ? 1 : 0, air: d.g < 0 }, WDX[k], d.y, 1.6 + k * 0.4, {}); if (d.g > 0 && d.g < 0.3) { const p = proj(WDX[k], DY, 1.6 + k * 0.4); if (p) shockRing(p.x, p.y, 4 + d.g * 120, 1 + d.g * 26, 2, [WHITE, C('linen', 6), C('linen', 4)], 1 - d.g / 0.3); shk(2); } }
      actor3('tamo', { view: 'front', crouch: 1.2, eyes: t > 188.7 ? 'wide' : 'open', brows: t > 188.7 ? 'up' : 'n', mouth: mouth('tamo', t), armF: 1.2 }, -3.0, DY, 0.4, {});
      fish3(-3.0, 1.18 + DY, 0.36, 0.2, Math.sin(t * 18));
    } else if (t < 191.6) {
      // over his shoulder: the three of them, spears down, low angle
      lookAt(-1.0, 1.25, -1.9, -6.2, 1.2, 2.0, 50);
      harbour(t);
      for (let k = 0; k < 3; k++) actor3('warden', { view: 'front', spear: -1.1 + Math.sin(t * 2 + k) * 0.05, captain: false }, WDX[k], DY, 1.6 + k * 0.4, { rim: { side: 1, T: T_GOLD, a: 0.3 } });
      actor3('tamo', { view: 'back', crouch: 1.2 }, -3.0, DY, 0.4, { dark: 1 });
    } else {
      // he looks at them, at her, and gets up: "three grown-ups… against one girl?"
      const stand = lin(192.2, 193.0, t), walk = lin(195.0, 197.0, t);
      lookAt(-1.4 - walk * 2, 1.4, -4.2, -2.9 + walk * 3, 1.0, 0.4, 46);
      harbour(t);
      for (let k = 0; k < 3; k++) actor3('warden', { view: 'front', spear: -1.1 }, WDX[k], DY, 1.6 + k * 0.4, {});
      const flick = lin(193.6, 194.0, t);
      actor3('tamo', { view: walk > 0 ? 'side' : 'front', crouch: 1.2 * (1 - stand), run: walk > 0 ? t * 9 : undefined, eyes: blink(t, 23) ? 'closed' : 'narrow', brows: 'angry', mouth: mouth('tamo', t), smile: t > 194 ? 0.4 : 0, armF: flick > 0 && flick < 1 ? -1.6 : 1.3, look: t < 191.9 ? -2 : t < 192.2 ? 2 : 0 }, -3.0 + walk * 4, DY, 0.4, {});
      if (flick < 1) fish3(-3.0 + flick * 0.8, 1.18 + DY + Math.sin(flick * PI) * 0.8 - (1 - stand) * 0, 0.36, flick * 6, 0);
      actor3('kaira', { view: 'front', eyes: blink(t, 24) ? 'closed' : 'wide', brows: 'worried', seed: 0.5, blade: 1.0, blade2: 2.4 }, -1.3, DY, 0.9, {});
    }
  });

  // 26 — the anchor: "that anchor hasn't moved in a hundred years—" … it moves (3:17)
  const GRIP = 199.5, RIP = 203.0;
  const tideY = (t) => -0.4 - 1.8 * sstep(200.3, 202.8, t) + 1.2 * sstep(203.0, 203.6, t);
  shot(197.0, 214.0, (lt, t) => {
    const ripG = t - RIP;
    if (t < GRIP) {
      lookAt(9.6, 2.2, -7.0, 5.0, 1.4, 1.2, 50);
      harbour(t);
      anchorProp(ANCHOR_X, DY, 1.4, 0, 2.4);
      actor3('docker', { view: 'side', eyes: 'half', mouth: mouth('docker', t), armF: 0.6, crouch: 1.0 }, 9.4, DY, -1.6, { flip: true });
      crate3(9.4, DY, -1.4, 0.7);
      actor3('tamo', { view: 'side', run: t < 198.8 ? t * 9 : undefined, eyes: 'narrow', brows: 'angry' }, lerp(1.6, ANCHOR_X - 1.1, lin(197, 198.8, t)), DY, 1.2, {});
    } else if (t < RIP + 0.2) {
      // low, close: his grip; the planks groan; the sea pulls back
      const sh = sstep(GRIP, RIP, t);
      lookAt(ANCHOR_X - 3.4, 0.7, -2.2, ANCHOR_X - 0.6, 1.3, 1.3, 48);
      drawHarbour(t, { lights: [] });
      ink(2);
      anchorProp(ANCHOR_X, DY, 1.4, Math.sin(t * 40) * 0.01 * sh, 2.4, sh > 0.6 ? sh : 0);
      const a = actor3('tamo', { view: 'side', crouch: 0.6 + sh * 0.6, armF: -0.6, armL: -0.4, eyes: sh > 0.7 ? 'glow' : 'narrow', brows: 'angry', mouth: sh > 0.4 ? 0.9 : 0, glow: C('teal', 7) }, ANCHOR_X - 1.15, DY, 1.2, { rim: { side: 1, T: T_TEAL, a: sh * 0.8 } });
      if (sh > 0.4) aura(t, [C('teal', 3), C('teal', 5), C('teal', 6), C('teal', 7)], 3 + sh * 7, { sparks: 20 });
      // water rising off the sea in strands, swirling toward the anchor
      for (let k = 0; k < 80 * sh; k++) { const a0 = ih(k, 1, 411) * TAU + t * 1.5, r = 3 + ih(k, 2, 411) * 6 - (t - GRIP) * 0.6, y = tideY(t) + frac(ih(k, 3, 411) + t * 0.5) * 3; p3(ANCHOR_X + Math.cos(a0) * r, y, 1.4 + Math.sin(a0) * r, k & 1 ? C('teal', 7) : C('sea', 7), 0.07); }
      shk(0.5 + sh * 2.5);
    } else {
      // the hero shot: up from the planks as the anchor tears free and the sea comes back
      const u = t - RIP;
      lookAt(ANCHOR_X - 2.4, 0.55, -2.8 + u * 0.05, ANCHOR_X - 1.0, 2.1, 1.2, 56);
      drawHarbour(t, { lights: [] }); ink(2);
      const lift = eoc(lin(0, 1.2, u));
      const a = actor3('tamo', { view: u > 2.4 ? 'front' : 'side', anchor: lerp(-1.4, -2.3, lift), anchorGlow: u < 6, armF: lerp(0.6, -1.55, lift), eyes: u < 6 ? 'glow' : 'narrow', glow: C('teal', 7), brows: 'angry', mouth: mouth('tamo', t), smile: t > 205.6 ? 0.6 : 0, wind: 2 }, ANCHOR_X - 1.15, DY, 1.2, { rim: { side: 1, T: T_TEAL, a: 0.35 } });
      if (u < 6) aura(t, [C('teal', 3), C('teal', 5), C('teal', 6), C('teal', 7)], 5.5 * (1 - u / 7), { sparks: 22 });
      // splintered planks and a ring of water thrown up around them
      if (u < 1.6) { splash3(ANCHOR_X, DY, 1.4, u, 1.6); debris(240, 190, u, 40, 220, 1.2, [C('wood', 3), C('wood', 5), C('sea', 7)], 412); }
      if (u < 0.08) impactFrame(240, 120, 1);
      shk(4 * Math.max(0, 1 - u * 1.5));
      if (t > 209.5) {   // the wardens look at each other, and charge anyway
        const c = lin(211.4, 214.0, t);
        for (let k = 0; k < 3; k++) actor3('warden', { view: 'side', spear: -0.3, run: c > 0 ? t * 14 + k : undefined }, lerp(-5.4 + k, -2.6 + k * 0.6, c) - 0.1, DY, 1.6 + k * 0.4 - 1.2, { flip: false });
      }
    }
  });

  // 27 — the fight (3:34): a swing into the sea, a chain yanked, a kick out of a lightning step
  const FHITS = [214.8, 217.2, 219.6], FD = 0.08;
  shot(214.0, 221.0, (lt, t) => {
    const [tt, fz] = stopClock(t - 214.0, FHITS.map((h) => h - 214.0), FD), T = 214.0 + tt;
    lookAt(-0.6 + tt * 0.25, 2.3, -8.8, 0.8, 1.0, 1.0, 52);
    drawHarbour(t, { lights: [] }); ink(2);
    // Tamo, anchor in hand, at the centre
    const sw1 = lin(214.45, 214.85, T), sw2 = lin(216.9, 217.25, T);
    const anchorA = T < 214.45 ? -2.4 : T < 216.9 ? lerp(-2.4, 0.5, eoc(sw1)) : lerp(0.5, -2.6, eoc(sw2));
    const ta = actor3('tamo', { view: 'side', anchor: anchorA, armF: anchorA * 0.5, eyes: 'narrow', brows: 'angry', mouth: fz ? 0.9 : 0, wind: 2 }, 0.6, DY, 1.0, { flip: T > 216.6 && T < 218.6 });
    if (ta && sw1 > 0 && sw1 < 1) smearArc(ta.hand[0], ta.hand[1], -2.4, anchorA, 34 * ta.S, [C('teal', 4), C('teal', 6), C('teal', 7)]);
    if (ta && sw2 > 0 && sw2 < 1) smearArc(ta.hand[0], ta.hand[1], PI - 0.5, PI + 2.6 - (1 - eoc(sw2)) * 3.1, 34 * ta.S, [C('teal', 4), C('teal', 6), C('teal', 7)]);
    // W1: charges from the right, takes the anchor, flies into the sea
    const w1 = K({ t: 214.0, x: 5.4, y: DY, z: 1.0, a: 0 }, { t: 214.8, x: 2.0, e: 'i' }, { t: 215.2, x: 4.2, y: 2.2, z: 4.6, a: 2, e: 'o' }, { t: 215.5, x: 5.0, y: -0.6, z: 6.0, a: 4, e: 'i' });
    const W1 = trk(w1, T); if (T < 215.5) actor3('warden', { view: 'side', spear: -0.2, run: T < 214.8 ? T * 15 : undefined }, W1.x, W1.y, W1.z, { flip: true, ang: W1.a });
    splash3(5.0, -0.4, 6.0, T - 215.2, 1.1);
    // W3: the chain round the anchor, yanked over Tamo's head into the barrels
    const w3 = K({ t: 214.0, x: -4.6, y: DY, z: 0.6, a: 0 }, { t: 216.4, x: -2.4, e: 'o' }, { t: 217.2, x: -2.4 }, { t: 217.6, x: 1.4, y: 3.4, z: 0.6, a: -3, e: 'o' }, { t: 218.0, x: 7.4, y: 0.6, z: -1.4, a: -6, e: 'i' }, { t: 221, x: 7.4, y: 0.4, z: -1.4, a: -6.6 });
    const W3 = trk(w3, T); actor3('warden', { view: 'side', spear: T < 216.8 ? -0.4 : undefined, run: T < 216.4 ? T * 14 : undefined, eyes: T > 217.2 ? 'wide' : 'open' }, W3.x, W3.y, W3.z, { ang: W3.a });
    if (T > 216.5 && T < 217.3 && ta) { const p = proj(W3.x + 0.4, 1.1, W3.z); if (p) { const hx = ta.hand[0] + Math.cos(anchorA) * 20 * ta.S, hy = ta.hand[1] + Math.sin(anchorA) * 20 * ta.S; lineF(p.x, p.y, hx, hy, (x, y, u) => { if ((x + y) % 3) P(x, y + Math.sin(u * 12 + t * 20) * 1.5, C('stone', 6)); }); } }
    if (T > 218.0) debris(proj(7.4, 0.6, -1.4) ? PR.x : 400, PR.y, T - 218.0, 30, 140, 1.2, [C('wood', 3), C('wood', 5)], 421);
    // W2: comes at his back; a lightning step; a kick into the sea
    const w2 = K({ t: 214.0, x: -6.6, y: DY, z: 1.8, a: 0 }, { t: 218.6, x: -1.6, e: 'io' }, { t: 219.2, x: -0.8, e: 'i' }, { t: 219.6, x: -0.6 }, { t: 219.9, x: -2.8, y: 1.8, z: 4.4, a: 2.4, e: 'o' }, { t: 220.1, x: -3.4, y: -0.6, z: 5.4, a: 4, e: 'i' });
    const W2 = trk(w2, T); if (T < 220.1) actor3('warden', { view: 'side', spear: T > 218.9 && T < 219.4 ? 0.0 : -0.6, reach: T > 218.9 && T < 219.4 ? 4 : 0, run: T < 218.6 ? T * 14 : undefined }, W2.x, W2.y, W2.z, { ang: W2.a });
    splash3(-3.4, -0.4, 5.4, T - 220.1, 1.0);
    const kin = lin(219.25, 219.6, T);
    if (T > 219.2) {
      const kx = lerp(-6.0, -1.3, eoc(kin)), ky = DY + Math.sin(kin * PI) * 0.8 + (T > 219.6 ? Math.max(0, 0.6 - (T - 219.6) * 1.5) : 0);
      const after = kin < 1 ? [0.25, 0.5, 0.75].map((q) => { const p = proj(lerp(-6.0, kx, q), ky, 1.4); return p ? [p.x, p.y, C('gold', 6), 0.55 - q * 0.4] : [0, 0, 0, 0]; }) : undefined;
      actor3('kaira', { view: 'side', air: T < 220.4, armF: -0.2, reach: kin > 0.8 && kin < 1 ? 4 : 0, blade: 0.4, blade2: 2.4, storm: true, eyes: 'narrow', brows: 'angry', seed: 0.7, wind: 4 }, T > 219.6 ? lerp(-1.3, -1.9, lin(219.6, 220.5, T)) : kx, ky, 1.4, { after, ang: kin < 1 ? -0.4 : 0 });
      if (kin > 0 && kin < 1) for (let b = 0; b < 3; b++) { const p = proj(kx, ky + 0.8, 1.4); if (p) lineF(p.x, p.y, p.x - 30 - ih(b, fl(t * 30), 431) * 60, p.y + (ih(b, fl(t * 30) + 1, 431) - 0.5) * 50, (x, y) => P(x, y, C('gold', 7))); }
    }
    // hits
    const hp = [[proj(2.0, 1.2, 1.0)], [proj(-2.2, 1.4, 0.6)], [proj(-0.8, 1.3, 1.6)]];
    for (let k = 0; k < 3; k++) { const p = proj([2.0, -2.0, -0.8][k], [1.2, 1.6, 1.3][k], [1.0, 0.6, 1.6][k]); const h = FHITS[k] + k * FD; if (p) hitFx(p.x, p.y, t - h, k === 0 ? 1.4 : 1.0, k === 2 ? [WHITE, C('gold', 6)] : [WHITE, C('teal', 7)]); }
    void hp;
  });

  // 28 — the breather: "Okay. Who ARE you?" / "Tamo! I work here…" (3:41)
  shot(221.0, 228.0, (lt, t) => {
    lookAt(-0.4, 1.35, -4.6, -0.6, 1.0, 1.0, 46);
    harbour(t);
    actor3('tamo', { view: 'front', anchor: 1.45, armF: 1.1, eyes: blink(t, 31) ? 'closed' : 'open', smile: t > 222.8 ? 0.8 : 0.3, mouth: mouth('tamo', t), wind: 1 }, 0.5, DY, 1.0, {});
    actor3('kaira', { view: 'front', eyes: blink(t, 32) ? 'closed' : t > 225.6 ? 'closed' : 'open', brows: t < 222.5 ? 'up' : 'n', smile: t > 225.4 ? 0.9 : 0.2, mouth: mouth('kaira', t), seed: 0.4, blade: 1.3, blade2: 2.4, look: 1 }, -1.4, DY, 1.2, {});
  });

  // 29 — the world goes quiet: gulls stop in the air; the ring opens over the harbour (3:48)
  const SIGIL_H = [34, 46, 78];
  shot(228.0, 246.0, (lt, t) => {
    if (t < 231.0) {
      lookAt(-0.4, 1.35, -4.6, -0.6, 1.0, 1.0, 46);
      harbour(t); harbourHush(t);
      const look = t > 229.4;
      actor3('tamo', { view: 'front', anchor: 1.45, armF: 1.1, eyes: look ? 'wide' : 'open', brows: look ? 'up' : 'n', smile: look ? 0 : 0.6, look: look ? 2 : 0 }, 0.5, DY, 1.0, {});
      actor3('kaira', { view: 'front', eyes: look ? 'wide' : 'closed', brows: look ? 'worried' : 'n', smile: look ? 0 : 0.8, mouth: mouth('kaira', t), seed: 0.4, blade: 1.3, blade2: 2.4, look: look ? 2 : 1 }, -1.4, DY, 1.2, {});
    } else if (t < 235.4) {
      // the sky over the harbour opens
      lookAt(-1.0, 1.2, -6, 24, 30, 60, 64);
      harbour(t); harbourHush(t);
      const p = proj(SIGIL_H[0], SIGIL_H[1], SIGIL_H[2]); const u = t - 231.0;
      if (p) { glow(p.x, p.y, 160, T_WH, 0.35 * lin(0, 2, u)); sigil(p.x, p.y, 20 + eoc(u / 3) * 80, (20 + eoc(u / 3) * 80) * 0.42, t, lin(0, 2.6, u), 461); }
      actor3('tamo', { view: 'back', anchor: -2.2, armF: -1.4 }, 0.6, DY, 0.0, { dark: 1 });
      actor3('kaira', { view: 'back', seed: 0.4, blade: 1.3 }, -1.4, DY, 0.2, { dark: 1 });
      shk(0.6);
    } else if (t < 242.0) {
      // Tamo, close: "Hollow."
      lookAt(0.0, 1.4, -2.4, 0.5, 1.15, 1.0, 40);
      harbour(t); harbourHush(t);
      actor3('tamo', { view: 'front', anchor: 1.45, armF: 1.1, eyes: blink(t, 33) ? 'closed' : 'sad', brows: 'worried', mouth: mouth('tamo', t), look: 1 }, 0.5, DY, 1.0, { rim: { side: 1, T: T_WH, a: 0.4 } });
      const p = proj(SIGIL_H[0], SIGIL_H[1], SIGIL_H[2]); if (p) glow(p.x, p.y, 200, T_WH, 0.2);
    } else {
      // Oren lands behind them: "No… not here. Not the harbour."
      const g = t - 242.0;
      lookAt(-4.4, 1.5, -3.6, -2.6, 1.1, 1.4, 44);
      harbour(t); harbourHush(t);
      actor3('warden', { view: 'front', captain: true, spear: -1.4, eyes: 'wide', mouth: mouth('oren', t), crouch: g < 0.3 ? 1 : 0, air: g < 0 }, -2.8, DY + Math.max(0, (0.15 - g) * 20), 1.6, { rim: { side: 1, T: T_WH, a: 0.4 } });
      actor3('kaira', { view: 'side', seed: 0.5, blade: 1.3, eyes: 'wide', brows: 'worried' }, -0.6, DY, 0.6, { flip: true });
    }
  });

  // 30 — the Hollow fall like stars; a warden is erased; the Bellwether comes down (4:06)
  const HOLLOW_LAND = [247.0, 247.4, 247.7, 248.1, 248.5, 248.8, 249.2, 249.6], HOLLOW_X = [12, 9.5, 15, 7.5, 18, 11, 6.5, 14], HOLLOW_Z = [0.4, -1.8, 1.8, 2.2, -0.6, 2.6, -1.0, -2.6];
  const BELL_LAND = 260.0;
  function hollowCrowd(t, opt) {
    opt = opt || {};
    for (let k = 0; k < 8; k++) {
      const g = t - HOLLOW_LAND[k]; if (g < -0.8) continue;
      const y = g < 0 ? DY + (-g) * 40 : DY, x = HOLLOW_X[k] - (t > 250 ? Math.min(3, (t - 250) * 0.8) : 0);
      if (g < 0) { const p = proj(x, y, HOLLOW_Z[k]), q = proj(x, y + 8, HOLLOW_Z[k]); if (p && q) lineF(q.x, q.y, p.x, p.y, (xx, yy, u) => { if (bay(xx, yy) < u) { P(xx, yy, WHITE); P(xx + 1, yy, C('crimson', 5)); } }); continue; }
      actor3('hollow', { view: opt.view || 'front', eyes: 'open', armF: 1.0 + Math.sin(t * 3 + k) * 0.2, run: t > 250 && t < 254 ? t * 9 + k : undefined }, x, y, HOLLOW_Z[k], {});
      if (g < 0.25) { const p = proj(x, DY, HOLLOW_Z[k]); if (p) { shockRing(p.x, p.y, 3 + g * 90, 1 + g * 20, 2, [WHITE, C('crimson', 5), C('hush', 3)], 1 - g / 0.25); shk(1); } }
    }
  }
  shot(246.0, 262.0, (lt, t) => {
    if (t < 250.0) {
      // wide: the white ring sweeping across the far boats; the Hollow streak down
      lookAt(-12, 7, -18, 14, 3, 30, 58);
      harbour(t); harbourHush(t);
      const p = proj(SIGIL_H[0], SIGIL_H[1], SIGIL_H[2]); if (p) sigil(p.x, p.y, 100, 42, t, 1, 461);
      hollowCrowd(t);
      for (const [x, z] of [[-2.8, 1.6], [-4.6, -0.8], [-5.8, 1.2]]) actor3('warden', { view: 'side', spear: -0.4 }, x, DY, z, {});
      actor3('tamo', { view: 'side', anchor: -2.0, armF: -1.2, eyes: 'wide' }, 0.5, DY, 1.0, {});
      actor3('kaira', { view: 'side', seed: 0.5, blade: 0.6, blade2: 2.4, eyes: 'wide' }, -0.8, DY, 0.4, {});
    } else if (t < 254.0) {
      // the fight with shadows: a warden is touched, and is not a warden any more
      const er = t - 252.5;
      lookAt(4.6, 1.7, -5.6, 7.6, 1.0, 0.8, 48);
      harbour(t); harbourHush(t);
      hollowCrowd(t, { view: 'side' });
      actor3('warden', { view: 'side', spear: Math.sin(t * 9) * 0.6, captain: true }, 4.6, DY, 0.4, { flip: false });
      const gw = er > 0 ? Math.min(1, er / 0.9) : 0;
      if (er < 1.3) actor3(er > 0.5 ? 'hollow' : 'warden', { view: 'front', spear: er > 0 ? undefined : -0.8, eyes: 'wide' }, 6.6, DY, -0.8, { glitch: gw * 2, alpha: 1 - Math.max(0, er - 0.9) * 2.4 });
      if (er > 0 && er < 1.2) { const p = proj(6.6, 1.0, -0.8); if (p) for (let k = 0; k < 50; k++) { const u = frac(ih(k, 1, 471) + er); P(p.x + (ih(k, 2, 471) - 0.5) * 50 + u * 20, p.y - ih(k, 3, 471) * 40 - u * 30, ih(k, 4, 471) < 0.5 ? WHITE : C('crimson', 5)); } }
      if (er > 0 && er < 0.06) impactFrame(240, 135, 0);
    } else {
      // the Bellwether descending out of the ring, huge, slow; it lands, and rings
      const g = t - BELL_LAND, y = g < 0 ? DY + Math.pow(-g / 6, 1.6) * 40 : DY;
      lookAt(-3.4, 0.7, -9.6, 6.4, lerp(7.4, 3.6, sstep(254.5, 259.5, t)), 1.2, 60);
      harbour(t); harbourHush(t);
      const p = proj(SIGIL_H[0], SIGIL_H[1], SIGIL_H[2]); if (p) sigil(p.x, p.y, 100, 42, t, 1, 461);
      hollowCrowd(t, { view: 'side' });
      const bw = actor3('bellwether', { glowEyes: true, sway: Math.sin(t * 0.8) * 2, ring: g > 0 && g < 1.2 ? 1.5 * (1 - g / 1.2) : 0 }, 8.4, y, 1.0, { size: 1.6 });
      actor3('tamo', { view: 'back', anchor: -2.2, armF: -1.4 }, 0.4, DY, -0.6, { dark: 1 });
      actor3('kaira', { view: 'back', seed: 0.6, blade: 0.8, blade2: 2.4 }, -1.0, DY, -0.4, { dark: 1 });
      if (g > 0 && bw) { const bh = proj(8.4, 4.4, 1.0); for (let r = 0; r < 3; r++) { const gg = g - r * 0.25; if (gg > 0 && gg < 1.2) { shockRing(bw.x, bw.y - 2, 10 + gg * 420, 3 + gg * 70, 3, [WHITE, C('hush', 5), C('gold', 6)], 1 - gg / 1.2); if (bh) shockRing(bh.x, bh.y, 6 + gg * 260, 6 + gg * 260, 2, [WHITE, C('gold', 6), C('gold', 4)], 1 - gg / 1.2); } } if (bh && g < 0.6) radialLines(bh.x, bh.y, 40, 20, WHITE, t, 493); shk(5 * Math.exp(-g * 2.5)); if (g < 0.07) flashWhite(0.7); }
    }
  });

  // 31 — "The courier. And the anchor-bearer. Two of four." (4:22)
  shot(262.0, 276.0, (lt, t) => {
    if (t < 266.2 || (t > 267.0 && t < 270.2)) {
      // low and close on the bell
      lookAt(t < 266.2 ? 1.4 : 4.4, t < 266.2 ? 1.0 : 2.6, t < 266.2 ? -7.6 : -3.6, 8.4, t < 266.2 ? 3.4 : 4.6, 1.0, t < 266.2 ? 54 : 40);
      harbour(t); harbourHush(t);
      hollowCrowd(t, { view: 'side' });
      const sp_ = talking('bellwether', t);
      actor3('bellwether', { glowEyes: true, sway: Math.sin(t * 0.8) * 2, ring: sp_ ? 0.4 * mouth('bellwether', t) : 0, arms: 1.3 + Math.sin(t * 0.7) * 0.1 }, 8.4, DY, 1.0, { size: 1.6, rim: { side: -1, T: T_WH, a: 0.35 } });
      const p = proj(8.4, 4.4, 1.0); if (p && sp_) glow(p.x, p.y, 40 * mouth('bellwether', t) + 10, T_WH, 0.35);
    } else if (t < 267.0) {
      // the two of them
      lookAt(-1.0, 1.25, -3.4, -0.3, 1.0, 0.8, 42);
      harbour(t); harbourHush(t);
      actor3('tamo', { view: 'front', anchor: 1.45, armF: 1.1, eyes: 'narrow', brows: 'angry' }, 0.4, DY, 0.8, { rim: { side: 1, T: T_WH, a: 0.4 } });
      actor3('kaira', { view: 'front', seed: 0.7, blade: 0.5, blade2: 2.4, eyes: 'wide', brows: 'worried' }, -1.0, DY, 1.0, { rim: { side: 1, T: T_WH, a: 0.4 } });
    } else {
      // the standoff, wide: they take their stances; it spreads its arms
      const u = t - 270.2;
      lookAt(3.6, 2.0, -12 + u * 0.15, 3.6, 1.8, 1.0, 54);
      harbour(t); harbourHush(t);
      hollowCrowd(t, { view: 'side' });
      actor3('bellwether', { glowEyes: true, sway: Math.sin(t * 0.8) * 2, arms: lerp(1.3, 0.2, eio(lin(273, 275.5, t))) }, 8.4, DY, 1.0, { size: 1.6, flip: true });
      actor3('tamo', { view: 'side', anchor: lerp(-2.0, -0.6, eio(lin(271, 272, t))), armF: -0.4, crouch: 0.5, eyes: 'narrow', brows: 'angry' }, 0.4, DY, 0.8, {});
      actor3('kaira', { view: 'side', seed: 0.7, blade: lerp(1.6, 0.2, eio(lin(271.4, 272.2, t))), blade2: 2.6, crouch: 0.6, eyes: 'narrow', brows: 'angry', storm: t > 272 }, -1.0, DY, 1.4, {});
    }
  });

  // 32 — the toll: a white wave down the dock; a wall of water; the strain; the break (4:36)
  const TOLL = 276.5, WALL = 277.5, MEET = 278.5, BREAK = 285.5;
  const waveX = (t) => 8.4 - Math.max(0, t - TOLL) * 8;
  shot(276.0, 292.0, (lt, t) => {
    const close = t > 280.4 && t < 285.2;
    if (!close) lookAt(3.4, 2.2, -11.6, 3.4, 1.8, 1.0, 56);
    else lookAt(-0.7, 1.3, -2.6, -0.2, 1.1, 1.0, 44);
    harbour(t); harbourHush(t);
    // the wave of erasure along the dock, held back by the wall from MEET until BREAK
    const front = t < MEET ? waveX(t) : t < BREAK ? 1.2 + Math.sin(t * 7) * 0.08 : 1.2 - (t - BREAK) * 9;
    hushWorld(t, (wx, wy, wz) => (wx > front + 0.8 ? 1 : wx > front ? 0.55 : 0), true);
    // the wall of water
    const wh = t < WALL ? 0 : t < BREAK ? 4.2 * eoc(lin(WALL, WALL + 0.6, t)) : 4.2 * (1 - lin(BREAK, BREAK + 0.4, t));
    if (wh > 0.05) poly3([[1.0, -0.4, -3.4], [1.0, -0.4, 4.6], [1.0, wh, 4.6], [1.0, wh, -3.4]], (u, v, x, y) => {
      const flow = frac(v * 0.9 - t * 1.6 + Math.sin(u * 2 + t * 3) * 0.2), top = u > wh - 0.35;
      if (t > MEET && t < BREAK && ih(x >> 1, y >> 1, fl(t * 18)) < 0.12) return ih(x, y, 5) < 0.5 ? WHITE : C('crimson', 5);
      return top ? C('sea', 7) : shadeC(R.sea, 3.6 + flow * 2 + (frac(v * 2.3 + t) < 0.08 ? 2 : 0), x, y);
    }, { two: true });
    if (t > MEET && t < BREAK) for (let k = 0; k < 40; k++) p3(1.05, ih(k, 1, 481) * wh, -3.4 + ih(k, 2, 481) * 8, ih(k, fl(t * 20), 482) < 0.5 ? WHITE : C('crimson', 5), 0.06);
    // the Bellwether, the heroes
    hollowCrowd(t, { view: 'side' });
    actor3('bellwether', { glowEyes: true, sway: Math.sin(t * 0.8) * 2, ring: t > TOLL && t < TOLL + 1.2 ? 1.4 * (1 - (t - TOLL) / 1.2) : 0, arms: t > 288 ? lerp(0.2, -0.9, eio(lin(288, 290.5, t))) : 0.2 }, 8.4, DY, 1.0, { size: 1.6, flip: true });
    const thrown = t > BREAK + 0.5 ? lin(BREAK + 0.5, BREAK + 1.2, t) : 0, down = thrown >= 1;
    const tx = 0.4 - thrown * 3.2, kx = -1.0 - thrown * 3.4;
    actor3('tamo', { view: close ? 'front' : 'side', anchor: down ? undefined : t > WALL ? -1.5 : -0.6, armF: t > WALL ? 0.9 : -0.4, crouch: t > WALL && !down ? 1.0 : 0, eyes: down ? 'closed' : t > MEET ? 'glow' : 'narrow', glow: C('teal', 7), brows: 'angry', mouth: mouth('tamo', t), vib: 0 }, tx, DY + Math.sin(thrown * PI) * 1.2, 0.8, { ang: down ? -1.4 : thrown * -1.2, rim: { side: 1, T: T_TEAL, a: t > WALL && t < BREAK ? 0.6 : 0 } });
    if (t > WALL && t < BREAK && !close) aura(t, [C('teal', 3), C('teal', 5), C('teal', 6), C('teal', 7)], 6, { sparks: 14 });
    const blaze = sstep(283.4, 284.2, t) * (t < BREAK ? 1 : 0);
    const ka = actor3('kaira', { view: close ? 'front' : 'side', seed: 0.6 + blaze * 0.4, blade: 0.3, blade2: 2.6, crouch: 0.6, eyes: down ? 'closed' : blaze > 0.5 ? 'glow' : 'wide', brows: 'worried', mouth: mouth('kaira', t) }, kx, DY + Math.sin(thrown * PI) * 1.4, 1.4, { ang: down ? 1.5 : thrown * 1.3 });
    if (ka && blaze > 0) { glow(ka.chest[0], ka.chest[1], 60 * blaze, T_GOLD, 0.7 * blaze); for (let b = 0; b < 4; b++) if (ih(b, fl(t * 20), 491) < blaze) lineF(ka.chest[0], ka.chest[1], ka.chest[0] + (ih(b, fl(t * 20) + 1, 491) - 0.5) * 120, ka.chest[1] + (ih(b, fl(t * 20) + 2, 491) - 0.5) * 90, (x, y) => P(x, y, C('gold', 7))); shk(blaze * 2); }
    if (t > MEET && t < BREAK) shk(1.5 + Math.sin(t * 3) * 0.5);
    // the break
    if (t > BREAK) { splash3(1.0, -0.4, 0.6, t - BREAK, 2.2); const p = proj(1.0, 1.4, 0.6); if (p) hitFx(p.x, p.y, t - BREAK, 1.6, [WHITE, C('sea', 7)]); }
    if (t > 288 && t < 290.6) { const p = proj(8.4, 4.6, 1.0); if (p) { glow(p.x, p.y, 30 + (t - 288) * 40, T_WH, 0.5); radialLines(p.x, p.y, 30, 40, WHITE, t, 492); } shk((t - 288) * 1.2); }
    if (t > 290.8) { tintAll(T_DARK, 0.25); }
  });

  // 33 — the light in the fog (4:52)
  shot(292.0, 300.0, (lt, t) => {
    const vz = lerp(40, 26, eio(lin(0, 5.5, lt)));
    if (t < 297.2) {
      lookAt(-6.4, 0.8, -1.2, 12, 2.0, 2.2, 50);
      harbour(t, { noGulls: true }); harbourHush(t);
      hushWorld(t, (wx) => (wx > front2(t) ? 0.9 : 0), false);
      tintAll(tab('#b8b0d0'), 0.15);
      hollowCrowd(t, { view: 'side' });
      actor3('bellwether', { glowEyes: true, sway: Math.sin(t * 0.8) * 2, arms: -0.9 + lin(292, 294, t) * 1.6 }, 8.4, DY, 1.0, { size: 1.6, flip: lt > 1.4 });
      actor3('tamo', { view: 'side', eyes: 'half', brows: 'worried' }, -2.8, DY, 1.6, { ang: -1.4, dark: 1 });
      // a violet glow in the white, and a shape walking out of it
      const p = proj(vz, 1.6, 3.2); if (p) glow(p.x, p.y, 70 + Math.sin(t * 3) * 6, T_VIO, 0.55 * lin(0, 1, lt));
      if (lt > 0.6) { actor3('vesper', {}, vz, DY + Math.abs(Math.sin(t * 2.4)) * 0.05, 3.2, { size: 1.5, flip: true, alpha: lin(0.6, 2.4, lt), dark: 2, tint: { T: tab('#2a1c48'), a: 0.6 * (1 - lin(3, 5.5, lt)) } }); const q = proj(vz - 0.4, 1.4, 3.2); if (q) glow(q.x, q.y, 18, T_VIO, 0.8); }
    } else {
      // the helm, close; its eyes flare
      lookAt(vz - 7.0, DY + 2.6, 2.6, vz, DY + 2.7, 3.2, 40);
      harbour(t, { noGulls: true }); hushWorld(t, () => 0.9, false);
      const vs = actor3('vesper', {}, vz, DY, 3.2, { size: 1.5, flip: true });
      if (vs) { const ex = vs.x - 5 * vs.S, ey = vs.y - 49 * vs.S; glow(ex, ey, (5 + lin(297.4, 297.8, t) * 4) * vs.S, T_VIO, 0.8); }
    }
    if (t > 298.5) BUF.fill(BLACK);
  });
  const front2 = (t) => 14 + (t - 292) * 0.5;

