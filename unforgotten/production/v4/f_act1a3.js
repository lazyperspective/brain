  /* ================================================================ ACT ONE (a), part three — the broken bridge, the drop, the fall */
  // ---------------------------------------------------------------- the broken bridge, side on, with the long drop beyond
  const BY = 156, EDGE = 340, DK = tab('#0c0818'), HAZE = tab('#f4c8c0');
  // the harbour far below, seen past the bridge: haze, a band of tiny roofs, the sea, little ships
  function harbourFar(t, y0, camY) {
    for (let y = Math.max(0, fl(y0 - camY)); y < H; y++) { const wy = y + camY, u = clamp((wy - y0) / 140, 0, 1); for (let x = 0; x < W; x++) BUF[y * W + x] = soft(u < 0.55 ? R.rose : R.sky, u < 0.55 ? lerp(5, 6.4, u / 0.55) : lerp(5.6, 4.4, (u - 0.55) / 0.45), x, y); }
    // the lower town: a band of hazy roofs, the harbour wall, the water with its glints and boats
    const town = y0 + 42 - camY;
    for (let x = 0; x < W; x++) { const k = fl(x / 5), h = 3 + ih(k, 1, 501) * 6; for (let y = Math.max(0, fl(town - h)); y < Math.min(H, town + 6); y++) BUF[y * W + x] = cel(ih(k, 2, 501) < 0.5 ? R.sky : R.lav, 4.4 + (y < town - h + 1 ? 1 : 0) + (ih(k, 3, 501) < 0.15 && y === fl(town - 1) ? 2 : 0), x, y); }
    for (let y = Math.max(0, fl(town + 6)); y < Math.min(H, town + 60); y++) for (let x = 0; x < W; x++) { const g = ih(fl(x / 3), fl(y / 2), fl(t * 2) + 502) < 0.03; BUF[y * W + x] = g ? C('snow', 7) : cel(R.sea, 3.6 + (y - town) / 40 + ((y + fl(x / 9)) % 5 === 0 ? 0.5 : 0), x, y); }
    for (let b = 0; b < 6; b++) { const bx = (b * 83 + t * (3 + b)) % (W + 40) - 20, by = town + 14 + b * 6; rectF(bx, by, 7 + b, 2, C('wood', 3)); put(fl(bx + 3), fl(by - 4), C('linen', 7)); put(fl(bx + 3), fl(by - 3), C('linen', 7)); put(fl(bx + 4), fl(by - 3), C('linen', 6)); put(fl(bx + 3), fl(by - 2), C('linen', 6)); }
    fog(y0 - camY, H, tab('#f0c8c0'), 0.35, t, 9);
  }
  // the bridge: a white stone deck on arches, a balustrade on its far side, iron lamps, and the jagged broken end
  function bridgeStage(t, camX, camY, o) {
    o = o || {};
    skyDawn(t, 380 - camX * 0.05, 64 - camY * 0.1);
    birds(380, 70 - camY * 0.2, 7, t, 50, 21);
    // the city's towers behind on the left, the open sky on the right
    for (let k = 0; k < 9; k++) { const x = -20 + k * 34 + ih(k, 1, 511) * 20 - camX * 0.3; spireTower(x, BY + 40 - camY * 0.5, 8 + ih(k, 2, 511) * 10, 120 + ih(k, 3, 511) * 60, { seed: k + 40, t, fog: 0.45, tiers: 2 + (k % 2) }); }
    cloudSea(BY + 32 - camY * 0.6, t, camX, 3, 23, 0.2);
    harbourFar(t, BY + 22, camY);
    const ox = -camX, oy = -camY, ex = EDGE + ox;
    // wisps of cloud drifting through the drop
    for (let k = 0; k < 4; k++) { const wx = ((k * 140 + t * (10 + k * 4)) % 620) - 70, wy = BY + 50 + k * 22 + oy; fillEll(wx, wy, 50, 6, 0, (x, y, u, v) => (bay(x, y) < 0.6 - Math.hypot(u, v) * 0.5 ? cel(R.linen, 6.4 - v, x, y) : -1)); }
    // the arches under the deck, and their piers falling away out of sight
    for (let y = Math.max(0, BY + 14 + oy); y < H; y++) for (let x = 0; x < Math.min(W, ex - 14); x++) {
      const wx = x - ox, wy = y - oy - BY - 14, ac = ((wx % 90) + 90) % 90, arch = ac > 14 && wy > 4 + 30 - Math.sqrt(Math.max(0, 38 * 38 - (ac - 52) ** 2)) * 0.8;
      if (arch && wy > 0) continue;
      BUF[y * W + x] = cel(R.linen, 4.8 - wy / 60 - (ac < 14 && ac > 11 ? 1 : 0) + (wy % 8 === 0 ? -0.6 : 0) + (ac < 3 ? 0.8 : 0), x, y);
    }
    // the deck: a gold-edged cornice and paving on top
    for (let y = Math.max(0, BY + oy); y < Math.min(H, BY + 15 + oy); y++) for (let x = 0; x < Math.min(W, ex); x++) { const v = y - oy - BY, wx = x - ox; BUF[y * W + x] = v < 2 ? cel(R.linen, 6.2, x, y) : v < 5 ? cel(R.linen, 4.6 - ((wx % 12) === 0 ? 1 : 0), x, y) : v < 7 ? C('gold', v === 5 ? 5 : 3) : cel(R.linen, 4.8 - (v - 7) / 6 - ((wx + (v > 10 ? 6 : 0)) % 12 === 0 ? 0.8 : 0), x, y); }
    // the broken end: jagged stone, cracks, a dangling length of chain
    fillPoly([[ex - 16, BY + oy], [ex, BY + oy], [ex + 4, BY + 3 + oy], [ex - 2, BY + 7 + oy], [ex + 3, BY + 12 + oy], [ex - 6, BY + 20 + oy], [ex - 10, BY + 36 + oy], [ex - 18, BY + 40 + oy], [ex - 16, BY + 14 + oy]], (x, y) => cel(R.linen, 4.4 - (x - ex + 16) / 14 + ((x * 3 + y * 5) % 7 === 0 ? -1 : 0), x, y));
    for (let q = 0; q < 14; q++) { const u = q / 14; put(fl(ex - 6 + Math.sin(t * 1.3) * u * 3), fl(BY + 18 + q * 2 + oy), q % 2 ? C('steel', 5) : C('steel', 2)); }
    // the balustrade behind the walkway, snapped off near the end
    for (let x = 0; x < Math.min(W, ex - 30); x++) { const wx = x - ox, bx = ((wx % 9) + 9) % 9; for (let y = BY - 12 + oy; y < BY + oy; y++) { if (y < 0 || y >= H) continue; const v = y - (BY - 12 + oy); if (v < 2 || (bx > 2 && bx < 6 && !(v > 4 && v < 8 && (bx === 3 || bx === 5)))) BUF[y * W + x] = cel(R.linen, v < 2 ? 6 : 4.6 - (bx === 5 ? 1 : 0), x, y); } }
    for (let k = 0; k < 3; k++) { const px = ex - 26 + k * 7; rectF(px, BY - 6 + k * 2 + oy, 3, 6 - k * 2, C('linen', 4)); }
    // iron lamps on the walkway, their lanterns cold
    for (const lx of [40, 200]) { const x = lx + ox; if (x < -10 || x > W + 10) continue; rectF(x, BY - 44 + oy, 2, 44, C('ink', 2)); rectF(x - 3, BY - 52 + oy, 8, 8, C('ink', 1)); rectF(x - 2, BY - 51 + oy, 6, 6, C('gold', 3)); rectF(x - 4, BY - 54 + oy, 10, 2, C('ink', 2)); }
  }
  // a warden dropping onto the bridge: falling from above, a crouch on landing with a ring of dust
  function wardenLand(CH, x, t, tl, camX, camY, S, f) {
    const g = t - tl; if (g < -0.45) return;
    const y = g < 0 ? BY - (g * g) * 900 : BY, crouch = g > 0 && g < 0.35 ? 1 - g / 0.35 : 0;
    const P = { t, face: {}, hip: -WARDEN.body.leg + 9 * crouch + (g < 0 ? 4 : 0), lean: 2 * crouch, legs: g < 0 ? [{ foot: [5, -6] }, { foot: [-5, -3] }] : [{ foot: [7, 0] }, { foot: [-6, 0] }], arms: [{ a: 1.2 - crouch * 0.4, b: 0.3 }, { a: 0.4 }] };
    P.prop = (A) => spearArt(A.hand[0], A.hand[1], g < 0 ? 0.2 : lerp(0.75, 0.25, crouch), 34, t);
    actor(CH, P, x - camX, y - camY, S || 1, f || 1);
    if (g > 0 && g < 0.6) { dust(x - camX, BY - camY, g * 1.3, 7, 2); if (g < 0.08) shk(2); }
  }
  const LANDS = [[149.0, 100], [149.6, 160], [150.3, 60], [151.0, 214]];
  // Kaira on the bridge: a skid to the brink, arms windmilling over the drop, then turning to face them
  function kairaEdge(t, camX, camY, S, face) {
    const run = t < 148.45, skid = lin(148.45, 148.75, t), wob = lin(148.75, 149.35, t), turn = t > 149.35;
    const x = run ? lerp(120, 300, (t - 148.0) / 0.45) : 300 + eoc(skid) * 18;
    let P;
    if (run) P = runPose({ t, wind: 3, face: { eyes: 'wide', brows: 'worried' } }, t * 17, 6, KAIRA.body);
    else if (!turn) { const w = Math.sin(wob * PI * 4) * (1 - wob); P = { t, wind: 2, face: { eyes: 'wide', brows: 'worried', mouth: 0.3 }, lean: skid < 1 ? -3 : Math.round(w * 3), hip: -KAIRA.body.leg + 2, legs: [{ foot: [5, 0] }, { foot: [-6, 0] }], arms: [{ a: 2.6 + w * 1.4, b: 0.4 }, { a: -2.4 - w * 1.4, b: -0.3 }] }; }
    else P = Object.assign({ t, wind: 2, legs: [{ foot: [4, 0] }, { foot: [-5, 0] }], arms: [{ a: 0.5, b: 0.5 }, { a: -0.2, b: 0.6 }], face: { eyes: blink(t, 9) ? 'closed' : 'open', brows: 'worried' } }, face || {});
    actor(KAIRA, P, x - camX, BY - camY, S || 1, turn ? -1 : 1);
    if (skid > 0 && skid < 1) for (let q = 0; q < 8; q++) put(fl(x - camX - 6 - q * 3), fl(BY - camY - 1 - (q & 1)), C('linen', 7));
    if (wob > 0 && wob < 1) for (let q = 0; q < 5; q++) { const g = (t - 148.75 - q * 0.08); if (g < 0) continue; put(fl(EDGE - camX + 2 + q * 3), fl(BY - camY + 2 + g * g * 300), C('linen', 4)); }
    return x;
  }

  // 21 — the dead end (2:28): she skids to the broken edge; they drop in around her one by one
  shot(148.0, 153.0, (lt, t) => {
    bridgeStage(t, 0, 0);
    LIGHT.x = 0.7; LIGHT.y = -0.6; ENV.edge = C('gold', 6);
    for (const [tl, x] of LANDS) wardenLand(WARDEN, x, t, tl, 0, 0, 1, 1);
    // Oren walks out between them, unhurried
    const ow = lin(150.4, 152.8, t), ox = lerp(-30, 250, eoc(ow));
    const OP = ow < 1 ? runPose({ t, face: {} }, t * 8, 3, WARDEN.body) : { t, face: {}, legs: [{ foot: [5, 0] }, { foot: [-4, 0] }], arms: [{ a: 0.6, b: 0.4 }, { a: 0.2 }] };
    OP.prop = (A) => spearArt(A.hand[0], A.hand[1], 0.3, 36, t);
    if (t > 150.4) actor(OREN, OP, ox, BY, 1, 1);
    kairaEdge(t, 0, 0, 1);
    ENV.edge = null;
  });
  // 22 — Oren, close: "Five days, courier. That's how long the elders give you before it tears you apart. Come quietly." (2:33)
  shot(153.0, 157.6, (lt, t) => {
    closeBg(() => { bridgeStage(t, 0, 0); kairaEdge(t, 0, 0, 1); }, 330, 120, 2.4, 3);
    LIGHT.x = 0.8; LIGHT.y = -0.5; ENV.edge = C('gold', 6);
    bust('oren', { t, face: { mouth: mouth('oren', t) }, headX: Math.round(Math.sin(t * 1.1) * 0.6) }, 190, H - LB + 6, 3, 1);
    ENV.edge = null;
  });
  // 22b — over Oren's shoulder: Kaira at the brink, the whole sky at her back, a glance down
  shot(157.6, 160.0, (lt, t) => {
    bridgeStage(t, 0, 0);
    LIGHT.x = 0.7; LIGHT.y = -0.6; ENV.edge = C('gold', 6);
    const down = sstep(158.8, 159.1, t);
    kairaEdge(t, 0, 0, 1, { face: { eyes: down > 0.5 ? 'wide' : 'open', brows: 'worried', look: down > 0.5 ? 2 : 0 }, headY: Math.round(down * 2) });
    ENV.edge = null;
    view(300, 128, 2);
    // Oren's helm and shoulder, dark against her, filling the left of the frame
    LIGHT.x = 0.8; LIGHT.y = -0.5; ENV.edge = C('gold', 4);
    bust('oren', { t, face: { mouth: mouth('oren', t) } }, 70, H - LB + 60, 4, 1, { fx: (c) => DK[6 * NPAL + c] });
    ENV.edge = null;
  });

  // 23 — the drop: straight down past her heels to the harbour, the world stretching away (vertigo) (2:40)
  shot(160.0, 161.8, (lt, t) => {
    const z = lerp(1, 1.9, eio(lt / 1.8)), cx = 250, cy = 170;
    // the harbour, seen from far above: the sea in a ring of quays and roofs, a town wall, all hazy
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const dx = (x - cx) / z, dy = (y - cy) / z / 0.75, r = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
      let c;
      if (r < 46) c = ih(fl(x / 3), fl(y / 2), fl(t * 3) + 521) < 0.02 ? C('snow', 7) : cel(R.sea, 3.4 + r / 40 + ((fl(r / 3)) % 4 === 0 ? 0.4 : 0), x, y);
      else if (r < 52) c = cel(R.linen, 5 - (frac(a * 8) < 0.1 ? 1.5 : 0), x, y);
      else if (r < 108) { const bk = ih(fl(a * 26), fl(r / 8), 522); c = bk < 0.15 ? cel(R.moss, 3, x, y) : frac(r / 8) < 0.16 || frac(a * 26) < 0.1 ? cel(R.stone, 2.6, x, y) : cel([R.crimson, R.teal, R.gold, R.linen, R.rose][fl(bk * 5)], 4, x, y); }
      else if (r < 114) c = cel(R.stone, 4.6 - (frac(a * 30) < 0.3 ? 1 : 0), x, y);
      else { const bk = ih(fl(a * 22), fl(r / 12), 524); c = frac(r / 12) < 0.12 || frac(a * 22) < 0.08 ? cel(R.stone, 3, x, y) : bk < 0.15 ? cel(R.moss, 3.6, x, y) : cel([R.rose, R.tan, R.linen][fl(bk * 3) % 3], 4.2 + (frac(r / 12) < 0.4 ? 0.8 : 0), x, y); }
      BUF[y * W + x] = c;
      const hz = clamp((Math.hypot(x - cx, (y - cy) / 0.75) - 90) / 220, 0, 0.8); if (hz > 0) tintI(y * W + x, x, y, HAZE, hz);
      continue;
      BUF[y * W + x] = c;
    }
    for (let b = 0; b < 7; b++) { const a = b * 0.9 + t * 0.05, r = 18 + b * 4, bx = cx + Math.cos(a) * r * z, by = cy + Math.sin(a) * r * z * 0.75; fillEll(bx, by, 2 * z, 1 * z, a, C('wood', 3)); put(fl(bx), fl(by - z), C('linen', 7)); }
    tintAll(tab('#f0c8c0'), 0.12);
    // cloud between us and the ground, nearer, so it rushes outward faster than the town
    for (let k = 0; k < 12; k++) { const a = k / 12 * TAU + 0.3, r = (50 + k * 11) * z * z * 0.6, wx = cx + Math.cos(a) * r, wy = cy + Math.sin(a) * r * 0.7; fillEll(wx, wy, 52 * z, 18 * z, a, (x, y, u, v) => (bay(x, y) < 0.95 - Math.hypot(u, v) * 0.7 ? cel(R.linen, 6.4 - v * 0.6, x, y) : -1)); }
    // the bridge's own piers, falling away toward the ground: two long stone shafts converging on it
    for (const [px0, px1] of [[90, 150], [330, 400]]) { const k = 0.82; fillPoly([[px0, 40], [px1, 40], [lerp(px1, cx, k), lerp(40, cy, k)], [lerp(px0, cx, k), lerp(40, cy, k)]], (x, y) => { const u = (y - 40) / (cy - 40), band_ = frac(Math.log(1 - u * 0.95 + 0.001) * -6) < 0.12; return cel(R.linen, 4.6 - u * 2.6 - (band_ ? 1 : 0) + (x < lerp(px0, cx, u * k) + (px1 - px0) * (1 - u * k) * 0.3 ? 0.6 : -0.3), x, y); }); }
    // the broken edge across the top, her boot heels over the brink, a pebble falling and shrinking away
    const EP = [[0, 0], [W, 0], [W, 30], [380, 44], [330, 36], [290, 52], [240, 40], [190, 56], [130, 42], [60, 50], [0, 38]];
    fillPoly(EP, (x, y) => cel(R.linen, 5.2 - y / 30 + ((x * 7 + y * 3) % 13 === 0 ? -1.2 : 0) + ((x + y * 2) % 23 === 0 ? 0.8 : 0), x, y));
    for (let i = 3; i < EP.length - 1; i++) line(EP[i][0], EP[i][1], EP[i + 1][0], EP[i + 1][1], C('linen', 2), 2);
    // her boots from above: toes out over the drop, soles catching the light at the rim
    for (const [bx, by, a] of [[214, 46, 0.25], [256, 44, -0.2]]) { fillEll(bx, by, 7, 13, a, (x, y, u, v) => (v > 0.75 ? C('ink', 3) : cel(R.ink, 1.6 + (u < -0.3 ? 1 : 0) + (v < -0.6 ? 0.8 : 0), x, y))); fillEll(bx, by - 18, 6, 8, a, (x, y, u, v) => cel(R.indigo, 2.4 + (u < 0 ? 1 : 0), x, y)); }
    const pg = frac(lt / 1.2); fillEll(cx + 20, lerp(60, cy, pg), lerp(3, 0.6, pg), lerp(3, 0.6, pg), 0, C('linen', 6));
    // the dolly-zoom stretch: a ripple at the frame edges
    const zz = Math.sin(eio(lt / 1.8) * PI) * 0.6; if (zz > 0.1) { for (let y = LB; y < H - LB; y += 2) for (let x = 0; x < W; x += 2) { const d = Math.hypot(x - cx, y - cy) / 260; if (d > 0.7 && bay(x, y) < (d - 0.7) * zz) put(x, y, C('linen', 7)); } }
  });
  // 23b — the grin: "Quiet's not really my thing."
  shot(161.8, 164.4, (lt, t) => {
    closeBg(() => { bridgeStage(t, 0, 0); LIGHT.x = 0.7; LIGHT.y = -0.6; for (const [tl, x] of LANDS) wardenLand(WARDEN, x, t, tl, 0, 0, 1, 1); actor(OREN, { t, face: {}, legs: [{ foot: [5, 0] }, { foot: [-4, 0] }], arms: [{ a: 0.6, b: 0.4 }, { a: 0.2 }], prop: (A) => spearArt(A.hand[0], A.hand[1], 0.3, 36, t) }, 250, BY, 1, 1); }, 180, 110, 2.4, 3);
    const grin = sstep(162.0, 162.3, t);
    LIGHT.x = -0.8; LIGHT.y = -0.5; ENV.edge = C('gold', 6);
    bust('kaira', { t, face: { eyes: blink(t, 13) ? 'closed' : grin > 0.5 ? 'half' : 'wide', brows: grin > 0.5 ? 'up' : 'worried', mouth: mouth('kaira', t), smile: grin }, wind: 2, headY: -Math.round(grin) }, 300, H - LB + 6, 3, -1);
    ENV.edge = null;
  });
  // 23c — she tips backwards off the edge; Oren lunges and grabs air; the camera drops after her
  shot(164.4, 166.0, (lt, t) => {
    const tip = lin(164.5, 165.1, t), fall = Math.max(0, t - 165.0), camY = eio(lin(165.0, 166.0, t)) * 120;
    bridgeStage(t, 0, camY);
    LIGHT.x = 0.7; LIGHT.y = -0.6; ENV.edge = C('gold', 6);
    for (const [tl, x] of LANDS) wardenLand(WARDEN, x + sstep(164.6, 165.2, t) * 14, t, tl, 0, camY, 1, 1);
    const lunge = sstep(164.7, 165.0, t);
    actor(OREN, { t, face: {}, lean: Math.round(lunge * 4), legs: [{ foot: [5 + lunge * 8, 0] }, { foot: [-6, 0] }], arms: [{ a: 0.6 + lunge * 1.1, b: 0.1 }, { a: 0.2 }] }, 250 + lunge * 24, BY - camY, 1, 1);
    const P = { t, wind: 3 + fall * 3, face: { eyes: 'half', brows: 'up', smile: 1 }, legs: [{ foot: [4, 0] }, { foot: [-5, 0] }], arms: [{ a: lerp(0.5, 2.6, tip), b: 0.3 }, { a: lerp(-0.2, 2.4, tip), b: 0.3 }] };
    LIGHTS.x = -LIGHT.x; LIGHTS.y = LIGHT.y; rig(KAIRA, P, t); soutline(ENV.edge);
    stamp(318 + fall * 30, BY - camY + fall * fall * 260, 1, true, { rot: eio(tip) * 1.6 + fall * 2.2, piv: 2 });
    ENV.edge = null;
  });

  // ---------------------------------------------------------------- the fall through the market awnings, below the cloud
  const AWN = [[169.5, R.crimson], [171.0, R.teal], [172.5, R.gold]];
  // her fall: gravity, and each awning she rips through takes most of her speed
  function fallY(t) { let y = 0, v = 80; for (let tt = 166.0; tt < t; tt += 1 / 120) { v += 340 / 120; for (const [ta] of AWN) if (tt < ta && tt + 1 / 120 >= ta) v *= 0.3; y += v / 120; } return y; }
  const AWN_Y = AWN.map(([ta]) => fallY(ta) + 14);
  function alley(t, camY) {
    // the back wall: warm ochre plaster, rows of shuttered windows, wooden balconies, lanterns on strings across
    for (let y = 0; y < H; y++) { const wy = y + camY; for (let x = 0; x < W; x++) {
      const cw = 40, rh = 46, uu = ((x - 20) % cw + cw) % cw, vv = ((wy % rh) + rh) % rh, col = fl((x - 20) / cw), row = fl(wy / rh);
      let c = cel(R.tan, 3.8 + (vn(x, wy, 60, 531) - 0.5) * 0.6 - (x < 90 || x > 390 ? 0.8 : 0) + (vv === 40 || vv === 41 ? -1.2 : vv === 42 ? 0.8 : 0), x, y);
      if (uu > 10 && uu < 30 && vv > 8 && vv < 34) c = uu < 14 || uu > 26 ? cel(ih(col, row, 532) < 0.5 ? R.teal : R.crimson, 3 - (vv % 3 === 0 ? 0.8 : 0), x, y) : ih(col, row, 533) < 0.25 ? C('fire', vv < 14 ? 6 : 5) : cel(R.indigo, 1.4, x, y);
      if (vv === 34 || vv === 35) c = uu > 8 && uu < 32 ? C('wood', vv === 34 ? 4 : 2) : c;
      BUF[y * W + x] = c;
    } }
    // the two corner buildings framing the shaft, darker, close
    for (let y = 0; y < H; y++) { const wy = y + camY; for (let x = 0; x < W; x++) { const L = x < 60, Rr = x > 420; if (!L && !Rr) continue; const u = L ? x : W - x, by_ = ((wy % 6) + 6) % 6, brick = by_ === 0 || ((u + (fl(wy / 6) % 2) * 6) % 12) === 0; BUF[y * W + x] = cel(R.wood, 2.4 + (u > 54 ? 1.6 : u > 50 ? 0.8 : 0) - (brick ? 0.8 : 0) + (ih(fl(u / 12), fl(wy / 6), 534) < 0.1 ? 0.6 : 0), x, y); } }
    // balconies on the corner houses: a wooden rail, a pot of red flowers, a hanging vine
    for (let k = fl(camY / 92) - 1; k < fl(camY / 92) + 5; k++) { const wy = k * 92 + 40, y = wy - camY; if (y < -30 || y > H + 10) continue; for (const side of [0, 1]) { if (ih(k, side, 535) < 0.3) continue; const x0 = side ? 400 : 40, x1 = side ? 440 : 80; rectF(x0, y, x1 - x0, 2, C('wood', 4)); for (let px = x0; px < x1; px += 4) rectF(px, y + 2, 1, 8, C('wood', 3)); rectF(x0, y + 10, x1 - x0, 2, C('wood', 2)); const fx = x0 + 10 + ih(k, side + 3, 535) * 18; rectF(fx, y - 5, 6, 5, C('ember', 3)); for (let q = 0; q < 6; q++) put(fl(fx + q), fl(y - 6 - (q % 2)), q % 2 ? C('crimson', 6) : C('moss', 4)); for (let q = 0; q < 14; q++) put(fl(x0 + 4 + Math.sin(q * 0.7) * 1.5), fl(y + 12 + q), C('moss', 3 + (q % 2))); } }
    // laundry strung across the shaft
    for (let k = fl(camY / 170) - 1; k < fl(camY / 170) + 3; k++) { const wy = 140 + k * 170, y0 = wy - camY; if (y0 < -30 || y0 > H + 20) continue; for (let x = 60; x < 420; x++) put(x, fl(y0 + Math.sin((x - 60) / 360 * PI) * 10), C('linen', 3)); for (let q = 0; q < 6; q++) { const u = (q + 0.6) / 6.4, lx = 60 + u * 360, ly = y0 + Math.sin(u * PI) * 10, col = [R.crimson, R.sky, R.gold, R.linen, R.moss, R.rose][(q + k) % 6], sw = Math.sin(t * 2 + q) * 2; fillPoly([[lx - 7, ly], [lx + 7, ly], [lx + 7 + sw, ly + 14], [lx - 7 + sw, ly + 15]], (xx, yy) => cel(col, 4.6 - (xx > lx + 3 ? 1 : 0) - ((yy - ly) % 5 === 0 ? 0.6 : 0), xx, yy)); } }
    // strings of paper lanterns across the shaft
    for (let k = fl(camY / 170) - 1; k < fl(camY / 170) + 3; k++) { const wy = 60 + k * 170, y0 = wy - camY; if (y0 < -40 || y0 > H + 20) continue; for (let x = 60; x < 420; x++) { const u = (x - 60) / 360; put(x, fl(y0 + Math.sin(u * PI) * 16), C('wood', 2)); } for (let q = 1; q < 8; q++) { const u = q / 8, lx = 60 + u * 360, ly = y0 + Math.sin(u * PI) * 16 + 2; lantern(lx, ly + 5, 4, t, q + k * 9); } }
  }
  // an awning: striped canvas sloping out from the wall toward us, a scalloped valance; torn open once she is through
  function awning(y, ramp, torn, g, t) {
    const x0 = 150, x1 = 330, d = 30;
    for (let yy = 0; yy < d; yy++) { const sy = fl(y + yy), spread = yy * 0.9; for (let x = fl(x0 - spread); x < x1 + spread; x++) { const u = (x - x0 + spread) / (x1 - x0 + spread * 2); if (torn && Math.abs(u - 0.5) < 0.12 + g * 0.3 + (ih(fl(yy / 3), 1, 541) - 0.5) * 0.1 && yy > 4) continue; put(x, sy, cel(fl(u * 12) % 2 ? R.linen : ramp, (fl(u * 12) % 2 ? 5.6 : 4) + yy / 30 - (yy < 2 ? 1 : 0), x, sy)); } }
    const vy = fl(y + d); for (let x = fl(x0 - d * 0.9); x < x1 + d * 0.9; x++) { const u = (x - x0 + d * 0.9) / (x1 - x0 + d * 1.8); if (torn && Math.abs(u - 0.5) < 0.12 + g * 0.3) continue; const sc = 3 - Math.abs(((x % 8) - 4)) * 0.6; for (let q = 0; q < sc + 2; q++) put(x, vy + q, cel(ramp, 3.2 - q * 0.3, x, vy + q)); }
  }
  // 24 — the fall: down the shaft between the houses, through three awnings (2:46)
  shot(166.0, 176.0, (lt, t) => {
    const ky = fallY(t), camY = ky - 110, cloud = lin(166.0, 167.9, t);
    alley(t, camY);
    // first she drops out through the base of the cloud: white rushing up past her, thinning into the shaft
    if (cloud < 1) {
      const a = cloud < 0.6 ? 1 : 1 - (cloud - 0.6) / 0.4;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const n = fbm(x, y + t * 420, 50, 3, 561); if (bay(x, y) < a * (0.5 + n * 0.9)) BUF[y * W + x] = cel(n > 0.55 ? R.linen : R.rose, 5.6 + n * 1.6, x, y); }
    }
    // awnings behind her are drawn first: those she is about to reach sit below, those she has torn rise away above
    for (let k = 0; k < AWN.length; k++) { const y = AWN_Y[k] - camY; if (y < -40 || y > H + 10) continue; awning(y, AWN[k][1], t > AWN[k][0], Math.min(1, t - AWN[k][0]), t); }
    // Kaira, falling on her back, arms flung up, hair streaming above her; a slow tumble
    const P = { t, wind: 6, face: { eyes: lt < 1.6 ? 'wide' : lt < 3 ? 'shut' : 'narrow', brows: lt < 3 ? 'worried' : 'angry', mouth: lt < 1.2 ? 0.7 : 0 }, legs: [{ foot: [6, -6] }, { foot: [-3, -10] }], arms: [{ a: 2.6 + Math.sin(t * 9) * 0.4, b: 0.4 }, { a: 2.9 + Math.cos(t * 8) * 0.4, b: 0.3 }] };
    LIGHT.x = -0.4; LIGHT.y = -0.9; ENV.edge = C('gold', 6);
    LIGHTS.x = -LIGHT.x; LIGHTS.y = LIGHT.y; rig(KAIRA, P, t); soutline(ENV.edge);
    stamp(240, 110 + 26, 2, true, { rot: -PI / 2 + Math.sin(t * 1.3) * 0.35, piv: 26 });
    ENV.edge = null;
    // the rush of air: long streaks running up the frame
    for (let k = 0; k < 22; k++) { const x = 70 + ih(k, 1, 551) * 340, len = 20 + ih(k, 2, 551) * 50, y = H - ((t * (500 + ih(k, 3, 551) * 400) + ih(k, 4, 551) * 900) % (H + len * 2)); for (let j = 0; j < len; j++) if (bay(fl(x), fl(y + j)) < 1 - j / len) put(fl(x), fl(y + j), C('linen', 7)); }
    // tearing cloth: shreds and threads flung up as she goes through
    for (const [ta, ramp] of AWN) { const g = t - ta; if (g < 0 || g > 1.4) continue; for (let q = 0; q < 26; q++) { const x = 240 + (ih(q, 1, 553) - 0.5) * 140 * (0.3 + g), y = 140 - g * 160 * ih(q, 2, 553) + g * g * 60; shard(x, y, 2 + fl(ih(q, 3, 553) * 3), ih(q, 4, 553) * TAU + g * 9, C(q % 2 ? 'linen' : ['crimson', 'teal', 'gold'][AWN.findIndex((A) => A[0] === ta)], 5), C('linen', 7)); } if (g < 0.1) { shk(5); flash(0.25 * (1 - g / 0.1)); } }
    fade(lin(175.6, 176.0, t) * 0.8);
  });
