  /* ================================================================ Act One (b) cast: the harbour — the dockhand, the Hollow,
  // the Bellwether, Vesper, Tamo's anchor, Tamo's bust, and the drawing helpers they need. Everything lives in HB. */
  const HB = {};
  {
    /* ---------------------------------------------------------------- a frame-sized layer: draw big things with the core
    // primitives (fillPoly, fillEll, capsule, ribbon, line all go through TGT), then outline and composite them like a sprite */
    const LYR = new Int16Array(NP).fill(-1), LYK = new Uint8Array(NP), LBB = [W, H, -1, -1];
    const LTGT = { kind: 1, put(x, y, c) { const i = y * W + x; LYR[i] = c; LYK[i] = LTGT.kind; if (x < LBB[0]) LBB[0] = x; if (y < LBB[1]) LBB[1] = y; if (x > LBB[2]) LBB[2] = x; if (y > LBB[3]) LBB[3] = y; } };
    function lyBegin() {
      if (LBB[2] >= 0) for (let y = Math.max(0, LBB[1] - 1); y <= Math.min(H - 1, LBB[3] + 1); y++) { LYR.fill(-1, y * W + Math.max(0, LBB[0] - 1), y * W + Math.min(W, LBB[2] + 2)); LYK.fill(0, y * W + Math.max(0, LBB[0] - 1), y * W + Math.min(W, LBB[2] + 2)); }
      LBB[0] = W; LBB[1] = H; LBB[2] = -1; LBB[3] = -1; TGT = LTGT; LTGT.kind = 1;
    }
    const lk = (k) => { LTGT.kind = k; };
    // o: edge (rim colour on the lit side), outline (false: none), glitch (0..1), seed, t, alpha, color, white, fx(c,x,y,kind), dx
    function lyEnd(o) {
      TGT = FRAME; o = o || {}; if (LBB[2] < 0) return;
      const x0 = Math.max(1, LBB[0] - 1), x1 = Math.min(W - 2, LBB[2] + 1), y0 = Math.max(1, LBB[1] - 1), y1 = Math.min(H - 2, LBB[3] + 1);
      if (o.outline !== false) for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const i = y * W + x; if (LYR[i] >= 0) continue;
        let src = -1, dx = 0, dy = 0;
        for (const [j, ox, oy] of [[i - 1, -1, 0], [i + 1, 1, 0], [i - W, 0, -1], [i + W, 0, 1]]) if (LYR[j] >= 0 && LYK[j] !== 3 && LYK[j] !== 4) { src = LYR[j]; dx = ox; dy = oy; break; }
        if (src < 0) continue;
        const lit = -(dx * LIGHT.x + dy * LIGHT.y) > 0.4;
        LYR[i] = lit && o.edge !== undefined && o.edge !== null ? o.edge : (src >> 3) * 8 + (lit ? 1 : 0); LYK[i] = 4;
        if (x < LBB[0]) LBB[0] = x; if (y < LBB[1]) LBB[1] = y; if (x > LBB[2]) LBB[2] = x; if (y > LBB[3]) LBB[3] = y;
      }
      const g = o.glitch || 0, t = o.t || 0, seed = o.seed || 1, sdx = o.dx || 0;
      for (let y = LBB[1]; y <= LBB[3]; y++) {
        let sh = sdx; if (g > 0) { const band_ = fl(y / 3), r = ih(band_, fl(t * 18), seed); if (r < g * 0.45) sh += Math.round((ih(band_, fl(t * 18), seed + 1) - 0.5) * (4 + g * 14)); }
        for (let x = LBB[0]; x <= LBB[2]; x++) {
          const i = y * W + x; let c = LYR[i]; if (c < 0) continue;
          const X = x + sh; if (X < 0 || X >= W) continue;
          if (o.alpha !== undefined && bay(X, y) >= o.alpha) continue;
          if (o.color !== undefined && LYK[i] !== 3) c = o.color; else if (o.white) c = LYK[i] === 4 ? C('hush', 3) : WHITE;
          if (o.fx) { c = o.fx(c, X, y, LYK[i]); if (c < 0) continue; }
          if (g > 0 && ih(X >> 1, y, fl(t * 24) + seed) < g * 0.05) c = ih(X, y, 5) < 0.7 ? WHITE : C('crimson', 5);
          BUF[y * W + X] = c;
        }
      }
    }
    HB.lyBegin = lyBegin; HB.lyEnd = lyEnd; HB.lk = lk;

    /* ---------------------------------------------------------------- the sprite canvas as a target, so the core primitives draw into it
    // (coordinates in sprite space, offset by (240, 135) so put()'s frame clip doesn't cut them) */
    const SO = [240, 135];
    const STGT = { kind: 1, put(x, y, c) { sp(x - SO[0], y - SO[1], c, STGT.kind); } };
    HB.toSprite = () => { TGT = STGT; STGT.kind = 2; };
    HB.toFrame = () => { TGT = FRAME; };

    /* ---------------------------------------------------------------- stamping a rigged sprite turned (tumbling, lying) or glitched
    // pivot (px, py) in the sprite's own coordinates (feet at 0, 0) lands at (x, y); rot radians clockwise on screen */
    function stampEx(x, y, S, flip, o) {
      o = o || {}; S = S || 1;
      const rot = o.rot || 0, pvx = flip ? -(o.px || 0) : (o.px || 0), pvy = o.py || 0, ca = Math.cos(rot), sa = Math.sin(rot);
      let mnx = 1e9, mny = 1e9, mxx = -1e9, mxy = -1e9;
      for (const i of [SBB[0] - SOX, SBB[2] + 1 - SOX]) for (const j of [SBB[1] - SOY, SBB[3] + 1 - SOY]) {
        const lx = (flip ? -i : i) - pvx, ly = j - pvy, X = x + (lx * ca - ly * sa) * S, Y = y + (lx * sa + ly * ca) * S;
        mnx = Math.min(mnx, X); mny = Math.min(mny, Y); mxx = Math.max(mxx, X); mxy = Math.max(mxy, Y);
      }
      const g = o.glitch || 0, t = o.t || 0;
      for (let Y = Math.max(0, fl(mny) - 1); Y <= Math.min(H - 1, Math.ceil(mxy) + 1); Y++) {
        let sh = 0; if (g > 0) { const b = fl(Y / 3); if (ih(b, fl(t * 18), 7) < g * 0.45) sh = Math.round((ih(b, fl(t * 18), 8) - 0.5) * (4 + g * 12)); }
        for (let X = Math.max(0, fl(mnx) - 1); X <= Math.min(W - 1, Math.ceil(mxx) + 1); X++) {
          const dx = (X + 0.5 - sh - x) / S, dy = (Y + 0.5 - y) / S, lx = dx * ca + dy * sa + pvx, ly = -dx * sa + dy * ca + pvy;
          const ox = fl(lx), oy = fl(ly), i = flip ? -ox - 1 + SOX : ox + SOX, j = oy + SOY;
          if (i < 0 || j < 0 || i >= SW || j >= SH) continue;
          const k = j * SW + i; let c = SPR[k]; if (c < 0) continue;
          if (o.alpha !== undefined && bay(X, Y) >= o.alpha) continue;
          if (o.color !== undefined && SPK[k] !== 3) c = o.color; else if (o.white) c = SPK[k] === 4 ? C('hush', 3) : WHITE;
          if (o.fx) { c = o.fx(c, X, Y, SPK[k]); if (c < 0) continue; }
          if (g > 0 && ih(X >> 1, Y, fl(t * 24)) < g * 0.06) c = ih(X, Y, 5) < 0.7 ? WHITE : C('crimson', 5);
          BUF[Y * W + X] = c;
        }
      }
    }
    // an actor, turned: like actor(), but with o.rot about o.px/o.py (sprite coords) landing at (x, y)
    function actorEx(CH, P, x, y, f, o) {
      if (HB.IMPC !== undefined || HB.IMP) o = Object.assign({}, o || {}, { color: HB.IMPC !== undefined ? HB.IMPC : C('ink', 0) });
      LIGHTS.x = LIGHT.x * (f < 0 ? -1 : 1); LIGHTS.y = LIGHT.y;
      // the light as the sprite sees it, turned back by the rotation so the rim stays on the lit side
      const rot = (o && o.rot) || 0; if (rot) { const lx = LIGHTS.x, ly = LIGHTS.y, a = f < 0 ? rot : -rot; LIGHTS.x = lx * Math.cos(a) - ly * Math.sin(a); LIGHTS.y = lx * Math.sin(a) + ly * Math.cos(a); }
      const r = rig(CH, P, P.t || 0); soutline(ENV.edge); stampEx(x, y, 1, f < 0, o);
      const pvx = (o && o.px) || 0, pvy = (o && o.py) || 0, ca = Math.cos(rot), sa = Math.sin(rot);
      const L = (q) => { const lx = (f < 0 ? -(q[0] - pvx) : q[0] - pvx), ly = q[1] - pvy; return [x + lx * ca - ly * sa, y + lx * sa + ly * ca]; };
      return { head: L(r.head), handN: L(r.handN), handF: L(r.handF), chest: L(r.chest), neck: L(r.neck) };
    }
    HB.stampEx = stampEx; HB.actorEx = actorEx;

    /* ---------------------------------------------------------------- the dockhand: old, gruff, a grey beard, a wool cap, a pipe */
    const DOCK_KEY = {
      k: k_, C: C('olive', 2), c: C('olive', 1), b: C('earth', 1), V: C('olive', 3), s: C('skin', 4), S: C('skin', 3), n: C('skin', 2), e: C('skin', 3), r: C('rose', 3),
      G: C('stone', 5), g: C('stone', 4), q: C('stone', 3), Q: C('stone', 6), H: C('stone', 6),
      J: C('rust', 3), j: C('rust', 2), A: C('earth', 4), a: C('earth', 3), B: C('bronze', 5), R: C('linen', 3),
    };
    const DOCKHAND = {
      key: DOCK_KEY, iris: R.sky,
      head: { ax: 11, ay: 23, eyeN: [15, 12], eyeF: [10, 12], mouth: [15, 18], browN: [14, 11], browF: [9, 11], rows: [
        '......................',
        '.......kkkkkkkk.......',
        '.....kkCCCCCCCCkk.....',
        '....kCCCCVCCCCCCCk....',
        '...kcCCCCCVCCCCCCCk...',
        '...kcCCCCCCCCCCCCCCk..',
        '..kccCCCCCCCCCCCCCCCkk',
        '..kcccccccccccbbbbbbbk',
        '..kGkkkkkkkkkkkkkkkkk.',
        '..kGGQkSSsssssssssssk.',
        '..kGGkSsssssssssssssk.',
        '..kGGeSssssssssssssssk',
        '..kGeeSssssssssssssssk',
        '..kGGeSsssssssssssrnsk',
        '..kGGkSsssssssssssssnk',
        '..kGGGQssssssssssssssk',
        '..kGGGGGQssssGGGGGGGGk',
        '..kgGGGGGQGGGGQQQGGGGk',
        '..kqgGGGGGGGGGGGGGGGk.',
        '...kqgGGGGGGGGGGGGGGk.',
        '...kqqgGGGGGGGGGGGGk..',
        '....kqqgGGGGGGGGGGk...',
        '.....kkqgGGGGGGGkk....',
        '.......kkkkkkkkk......',
      ] },
      torso: { ax: 9, ay: 0, shN: [16, 3], shF: [3, 3], hip: [9, 18], rows: [
        '......kGGGGk......',
        '...kkJJJGGJJJkk...',
        '..kJJJjJJJJJJJJk..',
        '.kJJJAAJJJJJAAJJk.',
        'kJJjJAAJJJJJAAJJJk',
        'kJJjJAAAAAAAAAJJJk',
        'kJJjJAaAAAAAAAAJJk',
        'kJJjJAaAAAAAAAAJJk',
        'kJjJAAaAAAAAAAAAJk',
        'kJjJAAaAAAAAAAAAJk',
        'kJjJAAaAAAAAAAAAJk',
        'kJjJAAaAAAAAAAAAJk',
        'kjRRRRRRRRBRRRRRjk',
        '.kAAaAAAAAAAAAAAk.',
        '.kAAaAAAAAAAAAAAk.',
        '.kAAaAAAAAAAAAAAk.',
        '.kAAaAAAAAAAAAAk..',
        '.kaaaaaaaaaaaaak..',
        '.kkkkkkkkkkkkkkk..',
      ] },
      body: { leg: 25, thigh: 13, shin: 12.5, legR: 2.8, arm1: 9, arm2: 8.5, armR: 2.4, pants: R.earth, pantsB: 2, sleeve: R.rust, sleeveB: 3, skin: R.skin, boot: R.ink },
    };
    DOCKHAND.head.key = DOCKHAND.torso.key = DOCK_KEY;
    HB.DOCKHAND = DOCKHAND;
    // his pipe, clenched in the beard (sprite coords at the head), and the smoke he puffs (frame coords)
    HB.pipeSmoke = (x, y, t, n) => { for (let k = 0; k < (n || 7); k++) { const u = frac(t * 0.35 + k / (n || 7)), sx = x + u * 10 + Math.sin(t * 1.5 + k) * u * 4, sy = y - u * 26; if (u > 0.85) continue; const c = u < 0.3 ? C('stone', 6) : C('stone', 4); put(fl(sx), fl(sy), c); if (u > 0.35) { put(fl(sx) + 1, fl(sy), c); if (u > 0.55) put(fl(sx), fl(sy) - 1, c); } } };

    /* ---------------------------------------------------------------- props */
    // the anchor: a great old iron anchor — a ring, a stock bar, a long shank, two curved arms with spade flukes,
    // barnacles and rust; it glows teal when his power is in it (g 0..1). Drawn with the core primitives at (x, y) = the ring,
    // its crown along ang (0 = straight down), size s (1 ≈ 52 px long). Call inside a layer or toSprite.
    function anchorArt(x, y, ang, s, g, t) {
      g = g || 0; t = t || 0;
      const dx = Math.sin(ang), dy = Math.cos(ang), nx = dy, ny = -dx, L = 52 * s;
      const at = (a, b) => [x + dx * a + nx * b, y + dy * a + ny * b];
      const iron = (v, xx, yy, glow) => { const gl = g * (glow || 1); if (gl > 0.55 && ((xx + yy + fl(t * 12)) % 5 === 0)) return C('mint', 7); return gl > 0.25 ? cel(R.teal, v + gl * 2.4, xx, yy) : cel(R.stone, v - 1.4, xx, yy); };
      const rust = (xx, yy) => vn(xx * 1.3, yy * 1.3, 2, 501) > 0.66;
      // the shank
      const [sx0, sy0] = at(5 * s, 0), [sx1, sy1] = at(L, 0);
      capsule(sx0, sy0, 3.2 * s, sx1, sy1, 3.8 * s, (xx, yy, u, w) => (rust(xx, yy) && g < 0.4 ? cel(R.rust, 2.6 + (w * (nx * LIGHTS.x + ny * LIGHTS.y) > 0.3 ? 1 : 0), xx, yy) : iron(3.4 + (w * (nx * LIGHTS.x + ny * LIGHTS.y) > 0.3 ? 1.4 : w * (nx * LIGHTS.x + ny * LIGHTS.y) < -0.4 ? -1 : 0), xx, yy)));
      // the arms: two curves from the crown up and out, ending in spade flukes
      const RA = 23 * s;
      for (const side of [-1, 1]) {
        let px = sx1, py = sy1;
        for (let q = 1; q <= 10; q++) {
          const a = q / 10 * 1.22, [qx, qy] = at(L - RA + RA * Math.cos(a), side * RA * Math.sin(a));
          capsule(px, py, (3.6 - q * 0.12) * s, qx, qy, (3.5 - q * 0.14) * s, (xx, yy, u, w) => iron(3.2 + (w * side > 0.3 ? 1.2 : w * side < -0.4 ? -0.8 : 0), xx, yy));
          px = qx; py = qy;
        }
        // the fluke: a spade at the tip, pointing back up toward the ring
        const a1 = 1.22, tipA = L - RA + RA * Math.cos(a1), tipB = side * RA * Math.sin(a1);
        const [f0x, f0y] = at(tipA + 7 * s, tipB - side * 1 * s), [f1x, f1y] = at(tipA - 3 * s, tipB + side * 6 * s), [f2x, f2y] = at(tipA - 11 * s, tipB + side * 1.5 * s), [f3x, f3y] = at(tipA - 2 * s, tipB - side * 4.5 * s);
        fillPoly([[f0x, f0y], [f1x, f1y], [f2x, f2y], [f3x, f3y]], (xx, yy) => iron(3.8 + ((xx - f2x) * LIGHTS.x + (yy - f2y) * LIGHTS.y > 0 ? 1.2 : -0.5), xx, yy));
        line(f0x, f0y, f2x, f2y, (xx, yy) => iron(2.4, xx, yy));
        const [tx, ty] = at(tipA - 14 * s, tipB + side * 0.5 * s); capsule(f2x, f2y, 1.2 * s, tx, ty, 0.5 * s, (xx, yy) => iron(5, xx, yy, 1.4));
      }
      // the crown: a heavy knuckle where the arms meet
      const [kx, ky] = at(L + 1 * s, 0); fillEll(kx, ky, 4.6 * s, 4.2 * s, 0, (xx, yy, u, v) => iron(3.4 + (u * LIGHTS.x + v * LIGHTS.y > 0.3 ? 1.4 : u * LIGHTS.x + v * LIGHTS.y < -0.4 ? -1 : 0), xx, yy));
      // the stock: a bar across the shank under the ring, bound with iron bands
      const [b0x, b0y] = at(8 * s, -14 * s), [b1x, b1y] = at(8 * s, 14 * s);
      capsule(b0x, b0y, 2.6 * s, b1x, b1y, 2.6 * s, (xx, yy, u, w) => (Math.abs(u - 0.5) < 0.04 || Math.abs(u - 0.15) < 0.03 || Math.abs(u - 0.85) < 0.03 ? iron(2, xx, yy) : g < 0.3 ? cel(R.wood, 2.4 + (w > 0.3 ? 1 : w < -0.4 ? -1 : 0) + (vn(u * 40, w, 1, 503) > 0.6 ? 0.5 : 0), xx, yy) : iron(3.6 + (w > 0.3 ? 1 : 0), xx, yy)));
      for (const e of [[b0x, b0y], [b1x, b1y]]) fillEll(e[0], e[1], 2.2 * s, 2.2 * s, 0, (xx, yy) => iron(3, xx, yy));
      // the ring
      const [rx, ry] = at(-1 * s, 0);
      for (let a = 0; a < TAU; a += 0.04 / s) { const r1 = 5.6 * s, c = Math.cos(a), sn = Math.sin(a); for (let w = -1.6 * s; w <= 1.6 * s; w += 0.5) { const xx = fl(rx + c * (r1 + w)), yy = fl(ry + sn * (r1 + w)), l = c * LIGHTS.x + sn * LIGHTS.y; put(xx, yy, iron(3.4 + (l > 0.3 ? 1.3 : l < -0.4 ? -1 : 0) + (w > 0.8 * s ? -0.5 : 0), xx, yy)); } }
      // barnacles and weed (cold iron only)
      if (g < 0.3) for (let k = 0; k < 12; k++) { const a = L * (0.35 + ih(k, 1, 505) * 0.6), b = (ih(k, 2, 505) - 0.5) * 6 * s, [bx, by] = at(a, b); put(fl(bx), fl(by), ih(k, 3, 505) < 0.5 ? C('linen', 5) : C('stone', 6)); if (k % 3 === 0) put(fl(bx), fl(by) + 1, C('moss', 3)); }
      return { ring: [rx, ry], crown: [kx, ky] };
    }
    HB.anchorArt = anchorArt;

    // a fish: chunky silver body, dark back, forked tail; (x, y) its middle, len in px, ang on screen, flap -1..1
    function fishArt(x, y, len, ang, flap) {
      const c = Math.cos(ang), s = Math.sin(ang), at = (a, b) => [x + c * a - s * b, y + s * a + c * b], h = len * 0.5;
      for (let a = -h; a <= h; a += 0.5) {
        const u = (a + h) / (2 * h), wd = Math.sin(Math.min(1, u * 1.25) * PI) * len * 0.17 + 0.3;
        for (let b = -wd; b <= wd; b += 0.5) { const [px_, py_] = at(a, b + (u < 0.25 ? (flap || 0) * (0.25 - u) * 6 : 0)); put(fl(px_), fl(py_), b < -wd * 0.35 ? C('sea', 2) : b > wd * 0.45 ? C('hush', 5) : (fl(a) & 1) ? C('steel', 5) : C('steel', 6)); }
      }
      for (const sd of [-1, 1]) for (let q = 0; q < len * 0.25; q += 0.5) { const [px_, py_] = at(-h - q, sd * q * 0.9 + (flap || 0) * len * 0.12); put(fl(px_), fl(py_), C('sea', 3)); }
      const [ex, ey] = at(h * 0.62, -len * 0.04); put(fl(ex), fl(ey), C('ink', 0)); put(fl(ex) + 1, fl(ey), C('snow', 7));
      const [gx, gy] = at(h * 0.4, 0); put(fl(gx), fl(gy), C('crimson', 3));
    }
    HB.fishArt = fishArt;

    /* ---------------------------------------------------------------- the Hollow: shadow people; black, ragged, white eyes, glitching
    // (x, y) feet, s scale (1 ≈ 64 px tall), f facing; o: reach 0..1 (an arm out), crouch 0..1, glitch, alpha, seed, fall (streaking down) */
    function hollowFig(x, y, s, f, t, o) {
      o = o || {}; const seed = o.seed || 1, sw = Math.sin(t * 2.3 + seed) * 1.5 * s, cr = o.crouch || 0, rc = o.reach || 0;
      const X = (a) => x + a * s * f, Yv = (b) => y - b * s;
      lyBegin();
      const ink = (v) => (xx, yy) => cel(R.ink, v + (vn(xx * 0.8, yy * 0.8 + t * 6, 2, seed) > 0.7 ? 0.6 : 0), xx, yy);
      const hipY = 26 - cr * 9, shY = 48 - cr * 12;
      // legs that thin into smoke at the bottom
      for (const sd of [-1, 1]) capsule(X(sd * 3.5), Yv(hipY), 2.6 * s, X(sd * 5 + (o.walk ? Math.sin(o.walk + (sd > 0 ? 0 : PI)) * 5 : 0)), Yv(2), 1.2 * s, (xx, yy, u) => (u > 0.75 && ih(xx, yy, fl(t * 10) + seed) < (u - 0.75) * 3 ? -1 : ink(0.5)(xx, yy)));
      // ragged wisps where the feet should be
      for (let k = 0; k < 6; k++) { const wx = X((k - 2.5) * 2.4), wy = Yv(1), len = (3 + ih(k, 1, seed) * 5) * s; line(wx, wy, wx + Math.sin(t * 4 + k) * 3 * s - 2 * f * s, wy + len * 0.2 - len * 0.6, C('ink', 0)); }
      // the body: a hunched, torn shape
      fillPoly([[X(-11), Yv(shY - 2)], [X(-6), Yv(shY + 2)], [X(7), Yv(shY + 2)], [X(12), Yv(shY - 3)], [X(8), Yv(hipY + 4)], [X(-7), Yv(hipY + 4)]], ink(0.8));
      // tattered strips off the waist, fluttering
      for (let k = 0; k < 7; k++) { const hx = -8 + k * 2.6, len = 7 + ih(k, 2, seed) * 9, fl_ = Math.sin(t * 5 + k * 1.7 + seed) * 2; fillPoly([[X(hx), Yv(hipY + 4)], [X(hx + 2.4), Yv(hipY + 4)], [X(hx + 1.6 + fl_), Yv(hipY + 4 - len)], [X(hx + 0.6 + fl_ * 1.3), Yv(hipY + 2 - len)]], ink(0.4)); }
      // the shoulders fray upward like burning paper
      for (let k = 0; k < 8; k++) { const hx = -11 + k * 3.1, len = 3 + ih(k, 3, seed) * 6 + Math.sin(t * 7 + k) * 1.5; fillPoly([[X(hx - 1.4), Yv(shY + 1)], [X(hx + 1.4), Yv(shY + 1)], [X(hx + Math.sin(t * 6 + k * 2) * 1.5 - 1.5), Yv(shY + 1 + len)]], ink(0.6)); }
      // the long arms, claws
      const sh = [X(-9), Yv(shY - 1)], sh2 = [X(9), Yv(shY - 1)];
      const handB = [X(-11 + sw * 0.3), Yv(hipY - 14 + cr * 4)], handF = rc > 0 ? [X(lerp(13, 34, rc)), Yv(lerp(hipY - 12, shY - 6, rc))] : [X(12 + sw * 0.4), Yv(hipY - 13 + cr * 4)];
      for (const [a, b] of [[sh, handB], [sh2, handF]]) {
        const el = [(a[0] + b[0]) / 2 + (b === handF && rc > 0 ? 0 : -2 * f * s), (a[1] + b[1]) / 2 + (b === handF && rc > 0 ? 3 * s : 0)];
        capsule(a[0], a[1], 2.2 * s, el[0], el[1], 1.6 * s, ink(0.9)); capsule(el[0], el[1], 1.6 * s, b[0], b[1], 1.0 * s, ink(0.9));
        for (let q = -1; q <= 1; q++) line(b[0], b[1], b[0] + (q * 1.6 + (b === handF ? 2 * f : 0)) * s, b[1] + (4 - Math.abs(q)) * s, C('ink', 1));
      }
      // the head: round, pushed forward, two white eyes and a thin white crack of a mouth when it opens
      const hx = X(4 - cr * 2), hy = Yv(shY + 8 - cr * 2);
      fillEll(hx, hy, 6.4 * s, 7.4 * s, 0, ink(1.0));
      for (let k = 0; k < 7; k++) { const a = -PI / 2 + (k - 3) * 0.32, r0 = 6.6 * s, bx = hx + Math.cos(a) * r0, by = hy + Math.sin(a) * r0 * 1.1, len = (2 + ih(k, 4, seed) * 3 + Math.sin(t * 7 + k * 2) * 1.2) * s; line(bx, by, bx + Math.cos(a) * len - f * s * 1.5 + Math.sin(t * 5 + k) * s, by + Math.sin(a) * len, C('ink', k & 1 ? 1 : 0)); }
      lk(3); const blinkE = frac(t * 0.4 + ih(seed, 5, 1)) < 0.03;
      if (!blinkE) for (const ex of [1.5, 4.6]) { const ex_ = fl(hx + ex * s * f - (f < 0 ? 1 : 0)), ey = fl(hy - 1 * s); rectF2(ex_, ey, Math.max(1, Math.round(1.6 * s)), Math.max(1, Math.round(1.4 * s)), WHITE); }
      if (o.mouth) { for (let q = 0; q < 5 * s; q++) put(fl(hx + (1 + q) * f), fl(hy + 3 * s + (q & 1)), C('hush', 6)); }
      lk(1);
      lyEnd({ edge: o.edge === undefined ? C('dusk', 3) : o.edge, glitch: o.glitch || 0.15, t, seed, alpha: o.alpha, white: o.white, fx: o.fx });
      // the eyes' glow
      if (!blinkE) glow(hx + 3 * s * f, hy - s, 7 * s, tab('#e8ecff', true), 0.35);
      return { head: [hx, hy], hand: handF };
    }
    function rectF2(x, y, w, h, c) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) put(x + i, y + j, c); }
    HB.hollowFig = hollowFig;

    /* ---------------------------------------------------------------- the Bellwether: huge, robed, a cracked bronze bell for a head
    // the bell, drawn with any plot(x, y, c, kind): lip centre (cx, ly), size s (1: lip half-width 30, height 58); o.speak 0..1 lights
    // the crack and the slit; o.ring 0..1 makes it shiver */
    function bellDraw(plot, cx, ly, s, t, o) {
      o = o || {}; const sp_ = clamp(o.speak || 0, 0, 1), hum = 0.35 + sp_ * 0.65, shiver = (o.ring || 0) * Math.sin(t * 70) * 0.8;
      const Hh = 58 * s, top = ly - Hh;
      const wOf = (u) => (u < 0.8 ? 22 + 8.5 * Math.exp(-u * 9) - 2.2 * Math.sin(u / 0.8 * PI) * 0.6 : 22 * Math.sqrt(Math.max(0, 1 - Math.pow((u - 0.8) / 0.2, 2)))) * s;
      const lx = LIGHTS.x, lyy = LIGHTS.y;
      // the crack: a jagged path from the lip up toward the crown, and two branches
      const CR = [[8, 0], [6, 0.08], [9, 0.16], [5, 0.26], [6.5, 0.33], [2, 0.42], [3.5, 0.52], [-1, 0.6], [0.5, 0.7]];
      const crackD = (x, u) => { let best = 9; for (let i = 0; i + 1 < CR.length; i++) { const a = CR[i], b = CR[i + 1]; if (u < a[1] || u > b[1]) continue; const k = (u - a[1]) / (b[1] - a[1]), cxx = (a[0] + (b[0] - a[0]) * k) * s; best = Math.min(best, Math.abs(x - cxx) / s); } if (u > 0.14 && u < 0.3) { const bx = (9 - (u - 0.14) * 70) * s; best = Math.min(best, Math.abs(x - bx) / s * 1.3); } if (u > 0.45 && u < 0.58) { const bx = (3 + (u - 0.45) * 90) * s; best = Math.min(best, Math.abs(x - bx) / s * 1.4); } return best; };
      for (let y = fl(top) - 1; y <= ly + 1; y++) {
        const u = (ly - y) / Hh; if (u < -0.02 || u > 1) continue;
        const w = wOf(Math.max(0, u)); if (w <= 0) continue;
        for (let x = fl(cx - w); x <= cx + w; x++) {
          const nxp = (x + 0.5 - cx) / w; if (Math.abs(nxp) > 1) continue;
          const X = x + Math.round(shiver);
          // metal: a hard specular stripe, a dark core, reflected light at the far edge
          const L = -nxp * lx;
          let v = 3.4 + (L > 0.25 ? 1.2 : 0) + (Math.abs(nxp + 0.5 * Math.sign(lx || 1) * -1 * -1) < 0.0 ? 0 : 0);
          const spec = Math.abs(nxp - (lx < 0 ? -0.5 : 0.5)) < 0.1, core = Math.abs(nxp - (lx < 0 ? 0.42 : -0.42)) < 0.25, refl = Math.abs(nxp) > 0.86;
          v = spec ? 6.6 : core ? 1.8 : refl ? 3.4 : 3.6 + (L > 0.2 ? 0.9 : L < -0.2 ? -0.6 : 0);
          if (u > 0.8) v += (0.95 - u) < 0 ? 1 : 0.6 * (lyy < 0 ? 1 : 0);   // the dome catches light from above
          // raised rings
          for (const r of [0.03, 0.09, 0.6, 0.64, 0.79]) { const d = (u - r) * Hh; if (d > -1 && d < 0) v += 1.6; else if (d >= 0 && d < 1.2) v -= 1.4; }
          let c = cel(R.bronze, v, X, y);
          // verdigris in the hollows
          if (!spec && fbm(x * 0.6 / s, y * 0.6 / s, 6, 2, 611) > 0.66 && u > 0.1) c = cel(R.teal, 2.4 + (L > 0 ? 0.8 : 0), X, y);
          // glyphs engraved in the band between the upper rings
          if (u > 0.66 && u < 0.77 && Math.abs(nxp) < 0.85) { const gi = fl((nxp + 1) * 6), gx = fl(((nxp + 1) * 6 - gi) * 5), gy = fl((u - 0.66) / 0.11 * 5); const g = GLY[(gi + 3) % GLY.length]; if (g[gy] && g[gy][gx] === '#') c = sp_ > 0.2 && gi % 3 === 0 ? C('fire', 5) : cel(R.bronze, v - 1.6, X, y); }
          // the slit: a narrow eye across the waist, glowing
          const sy = Math.abs(u - 0.36) * Hh;
          if (sy < 1.6 * s && Math.abs(nxp) < 0.7) { plot(X, y, sy < 0.6 * s ? (hum > 0.7 ? WHITE : C('fire', 6)) : C('fire', hum > 0.6 ? 5 : 4), 3); continue; }
          if (sy < 2.6 * s && Math.abs(nxp) < 0.74) c = C('ink', 0);
          // the crack, glowing from inside
          const cd = crackD(x + 0.5 - cx, u);
          if (cd < 0.5 + (1 - u) * 0.5) { plot(X, y, hum > 0.75 && cd < 0.35 ? WHITE : C('fire', hum > 0.5 ? 6 : 5), 3); continue; }
          if (cd < 1.2 + (1 - u) * 0.6) c = C('ink', 0);
          plot(X, y, c, 1);
        }
      }
      // the lip: the dark mouth of the bell with a faint light deep inside
      for (let x = fl(cx - 31 * s); x <= cx + 31 * s; x++) { const nxp = (x + 0.5 - cx) / (31 * s); if (Math.abs(nxp) > 1) continue; const d = Math.sqrt(1 - nxp * nxp) * 3.4 * s; for (let y = ly; y < ly + d; y++) plot(x, y, y < ly + 1 ? C('bronze', 6) : Math.abs(nxp) < 0.3 && sp_ > 0.4 ? C('ember', 3) : C('ink', 0), 1); }
      // the canon: a loop on the crown
      for (let a = PI; a <= TAU; a += 0.05 / s) for (let w = -1.3 * s; w <= 1.3 * s; w += 0.5) { const r = 5 * s + w, xx = fl(cx + Math.cos(a) * r), yy = fl(top + 1 + Math.sin(a) * r * 1.2); plot(xx, yy, cel(R.bronze, 3.6 + (Math.cos(a) * lx > 0.2 ? 1.4 : -0.4), xx, yy), 1); }
      return { top, slit: [cx, ly - 0.36 * Hh] };
    }
    HB.bellDraw = bellDraw;
    const LPLOT = (x, y, c, k) => { LTGT.kind = k || 1; put(fl(x), fl(y), c); LTGT.kind = 1; };
    // the whole figure, in the frame: hem centre at (x, y), s (1 ≈ 212 px tall); o: arms 0..1 (raised), speak, ring, sway, alpha, white
    function bellwether(x, y, s, t, o) {
      o = o || {}; const sw = Math.sin(t * 0.8) * 2 * s + (o.billow || 0) * Math.sin(t * 9) * 3 * s, raise = o.arms || 0;
      LIGHTS.x = LIGHT.x; LIGHTS.y = LIGHT.y;
      lyBegin();
      const robe = (v, xx, yy) => cel(R.violet, v, xx, yy), lx = LIGHT.x;
      const shY = y - 140 * s, hemW = 60 * s, shW = 38 * s;
      // the sleeves (behind, the far one first): wide cones from the shoulder to a gold cuff, long grey fingers
      const arm = (side, far) => {
        const a0 = lerp(0.14, 2.35, eio(raise)) + (far ? 0.05 : 0) + Math.sin(t * 1.1 + side) * 0.04, sx = x + side * (shW - 2 * s), sy = shY + 8 * s;
        const ang = side * a0, L1 = 52 * s, L2 = 50 * s, bend = side * lerp(0.15, -0.5, raise);
        const ex = sx + Math.sin(ang) * L1, ey = sy + Math.cos(ang) * L1, hx = ex + Math.sin(ang + bend) * L2, hy = ey + Math.cos(ang + bend) * L2;
        capsule(sx, sy, 9 * s, ex, ey, 10 * s, (xx, yy, u, w) => robe(2.4 - far + (w * side * (lx > 0 ? -1 : 1) < -0.3 ? 1.2 : 0) + (frac((w + 1) * 2.5) < 0.2 ? -0.8 : 0), xx, yy));
        capsule(ex, ey, 10 * s, hx, hy, 13 * s, (xx, yy, u, w) => (u > 0.86 ? cel(R.gold, 4 - far + (w > 0 ? 0.8 : 0), xx, yy) : robe(2.6 - far + (w * side * (lx > 0 ? -1 : 1) < -0.3 ? 1.2 : 0) + (frac((w + 1) * 3) < 0.2 ? -0.8 : 0), xx, yy)));
        // the hand: long fingers from inside the cuff
        const dxh = Math.sin(ang + bend), dyh = Math.cos(ang + bend), fx = hx + dxh * 3 * s, fy = hy + dyh * 3 * s;
        for (let q = -1.5; q <= 1.5; q++) { const fa = ang + bend + q * 0.16 + Math.sin(t * 2 + q) * 0.05, l = (17 - Math.abs(q) * 2.5) * s, mx = fx + q * 2.6 * s * dyh + Math.sin(fa) * l * 0.55, my = fy - q * 2.6 * s * dxh + Math.cos(fa) * l * 0.55, tx = mx + Math.sin(fa + side * 0.35 * (1 - raise)) * l * 0.5, ty = my + Math.cos(fa + side * 0.35 * (1 - raise)) * l * 0.5; capsule(fx + q * 2.6 * s * dyh, fy - q * 2.6 * s * dxh, 1.5 * s, mx, my, 1.2 * s, (xx, yy, u, w) => cel(R.stone, 3.2 - far + (w > 0.3 ? 1 : 0), xx, yy)); capsule(mx, my, 1.2 * s, tx, ty, 0.5 * s, (xx, yy) => cel(R.stone, 2.6 - far, xx, yy)); }
        return [hx, hy];
      };
      const hands = [arm(-1, 1), null];
      // the robe: heavy, pleated, flaring wide at the foot and pooling on the planks; a dark front panel with gold bell marks
      const top = shY + 20 * s;
      for (let yy = fl(top); yy <= y + 2; yy++) {
        const v = (y - yy) / (y - top), half = lerp(shW * 0.86, hemW, Math.pow(1 - v, 2.1)), cx_ = x + sw * Math.pow(1 - v, 2);
        for (let xx = fl(cx_ - half - 2); xx <= cx_ + half + 2; xx++) {
          const nxp = (xx + 0.5 - cx_) / half; if (Math.abs(nxp) > 1) continue;
          const hemY = y - 1 * s + Math.sin(xx * 0.31 / s) * 1.2 * s + (Math.abs(nxp) > 0.8 ? (Math.abs(nxp) - 0.8) * 8 * s : 0);
          if (yy > hemY) continue;
          const pleat = frac((nxp * (5 + (1 - v) * 4)) + 0.5 + sw * 0.02);
          let c = 2.6 + (-nxp * lx > 0.25 ? 1.1 : -nxp * lx < -0.35 ? -0.8 : 0) + (pleat < 0.16 ? -1.3 : pleat > 0.78 ? 0.7 : 0) - (v < 0.15 ? 0.6 : 0);
          let col = cel(R.violet, c, xx, yy);
          if (hemY - yy < 6 * s) col = hemY - yy < 1.5 * s ? C('violet', 0) : cel(R.gold, 3.6 + ((fl((xx - x) / (3 * s)) & 1) && hemY - yy > 2.5 * s && hemY - yy < 4.6 * s ? 1.4 : 0) + (-nxp * lx > 0.2 ? 0.8 : 0), xx, yy);
          else if (Math.abs(nxp) < 0.2) {
            col = cel(R.dusk, 1.6 + (pleat < 0.2 ? -0.6 : 0) + (-nxp * lx > 0.2 ? 0.6 : 0), xx, yy);
            const my = (y - yy) / (16 * s), mi = fl(my), mf = my - mi;
            if (Math.abs(nxp) < 0.08 && mf > 0.25 && mf < 0.75 && mi > 0 && mi < 8) col = C('gold', mf < 0.42 ? 6 : 4);
            if (Math.abs(Math.abs(nxp) - 0.19) < 0.02) col = C('gold', 3);
          }
          put(xx, yy, col);
        }
      }
      // the mantle: a heavy shoulder cape with rounded shoulders, falling lower at the middle, gold-scalloped hem
      const mTop = shY - 6 * s, mW = 44 * s;
      for (let yy = fl(mTop); yy < shY + 52 * s; yy++) for (let xx = fl(x - mW - 3); xx <= x + mW + 3; xx++) {
        const nxp = (xx + 0.5 - x) / mW, ay = Math.abs(nxp);
        const shoulderTop = mTop + (ay > 0.55 ? Math.pow((ay - 0.55) / 0.45, 2) * 14 * s : 0) + (ay < 0.3 ? 0 : 0);
        const half = 1 + Math.min(0.08, Math.max(0, (yy - shY) / (50 * s)) * 0.08);
        if (ay > half || yy < shoulderTop) continue;
        const hemY = shY + (30 + 14 * Math.cos(nxp * PI / 2)) * s, sc = Math.abs(Math.sin((xx - x) / (6 * s) * PI)) * 3 * s;
        if (yy > hemY - sc) continue;
        const fold = frac(nxp * 6 + 0.5), shade = -nxp * lx > 0.2 ? 1.1 : -nxp * lx < -0.35 ? -0.7 : 0;
        let col = cel(R.dusk, 2.3 + shade + (fold < 0.14 ? -0.9 : 0) + (yy - shoulderTop < 2.5 * s ? 1.4 : 0), xx, yy);
        if (yy > hemY - sc - 2.4 * s) col = cel(R.gold, 4.4 + shade * 0.6, xx, yy);
        put(xx, yy, col);
      }
      // the clasp
      fillEll(x, shY + 12 * s, 4.6 * s, 4.6 * s, 0, (xx, yy, u, v) => cel(R.gold, 4.4 + (u * lx + v * LIGHT.y > 0.2 ? 1.6 : -0.8) + (Math.hypot(u, v) > 0.8 ? -1.4 : 0), xx, yy));
      fillEll(x, shY + 12 * s, 1.8 * s, 1.8 * s, 0, C('crimson', 5));
      hands[1] = arm(1, 0);
      // the standing collar: stiff fan pleats flaring round the base of the bell
      const colB = shY + 4 * s, colT = shY - 20 * s;
      fillPoly([[x - 20 * s, colB], [x + 20 * s, colB], [x + 33 * s, colT], [x - 33 * s, colT]], (xx, yy) => { const v = (colB - yy) / (colB - colT), nxp = (xx - x) / lerp(20 * s, 33 * s, v), pl = frac(nxp * 6 + 0.5); return pl < 0.13 ? C('violet', 1) : (yy - colT) < 1.6 * s ? cel(R.gold, 5, xx, yy) : cel(R.lav, 2.2 + (pl > 0.55 ? 1 : 0) + (-nxp * lx > 0.3 ? 0.7 : 0) - (1 - v) * 0.8, xx, yy); });
      // the bell
      const r = bellDraw(LPLOT, x, colT + 3 * s, s * 1.05, t, o);
      lyEnd({ edge: o.edge === undefined ? C('fire', 6) : o.edge, alpha: o.alpha, white: o.white, fx: o.fx });
      // the light out of the slit and the crack
      const sp_ = clamp(o.speak || 0, 0, 1);
      glow(r.slit[0], r.slit[1], 26 * s, tab('#ffc060', true), 0.25 + sp_ * 0.35);
      return { slit: r.slit, top: r.top, hands, chest: [x, shY + 10 * s] };
    }
    HB.bellwether = bellwether;
    // the bell in close-up: a bust (sprite space, stamped at S = 3) — the bell over the collar and the shoulders of the robe
    BUSTS.bell = function (P, t) {
      const lx = LIGHTS.x, sw = Math.round(Math.sin(t * 0.8) * 0.6);
      // the shoulders and capelet
      sPoly([[-78, 0], [-74, -18], [-56, -34], [-26, -42], [26, -42], [56, -34], [74, -18], [78, 0]], (x, y) => { const nxp = x / 76, sc = (y + 42) / 42; return band(R.dusk, 2.2 + (-nxp * lx > 0.25 ? 1 : -nxp * lx < -0.3 ? -0.8 : 0) + (frac(x / 9) < 0.14 ? -0.8 : 0) + (sc < 0.1 ? 1 : 0)); });
      for (let x = -76; x <= 76; x++) { const yy = -2 - Math.abs(Math.sin(x / 9 * PI)) * 4; sp(x, fl(yy), C('gold', 5)); sp(x, fl(yy) - 1, C('gold', 4)); }
      sEll(0, -24, 7, 7, (x, y, u, v) => band(R.gold, 4.4 + (u * lx + v * LIGHTS.y > 0.2 ? 1.6 : -0.8) + (Math.hypot(u, v) > 0.8 ? -1.4 : 0)));
      sEll(0, -24, 2.5, 2.5, (x, y, u, v) => band(R.crimson, 4 + (u + v < 0 ? 1 : 0)));
      // the collar
      sPoly([[-24, -38], [24, -38], [33, -54], [-33, -54]], (x, y) => { const nxp = x / 33, pl = frac(nxp * 7 + 0.5); return pl < 0.12 ? C('violet', 1) : y < -52 ? C('gold', 5) : band(R.lav, 2.4 + (pl > 0.6 ? 1 : 0) + (-nxp * lx > 0.3 ? 0.6 : 0) - (y > -44 ? 0.8 : 0)); });
      const r = bellDraw((x, y, c, k) => sp(x, y, c, k), sw, -50, 0.78, t, P);
      return { head: [0, -110], mouth: r.slit, chest: [0, -24], slit: r.slit, top: [0, r.top] };
    };

    /* ---------------------------------------------------------------- Vesper: an armoured knight, a violet crest that streams like flame,
    // a lantern; out of the fog. (x, y) feet, s (1 ≈ 82 px), f facing (+1 right); o: ph (walk phase), step (0..1 the foot lands),
    // sil 0..1 (lost in fog: a silhouette), eyes 0..1 (flare), lamp */
    function vesperFig(x, y, s, t, o) {
      o = o || {}; const f = o.f || 1, ph = o.ph || 0, sil = o.sil || 0, X = (a) => x + a * s * f, Yv = (b) => y - b * s;
      lyBegin();
      const steel = (v) => (xx, yy) => cel(R.steel, v, xx, yy), dark = (v) => (xx, yy) => cel(R.ink, v, xx, yy);
      const bob = Math.abs(Math.sin(ph)) * 1.5;
      const hip = 40 - bob * 0.3, sh = 64 - bob * 0.3;
      // the cloak behind: ragged, long, blown back
      const wv = (k) => Math.sin(t * 3 + k) * 2;
      fillPoly([[X(-8), Yv(sh + 1)], [X(9), Yv(sh + 1)], [X(-4 + wv(1)), Yv(6)], [X(-14 + wv(2)), Yv(2)], [X(-22 + wv(3)), Yv(10)], [X(-18), Yv(sh - 10)]], (xx, yy) => (yy > Yv(14) && ih(fl(xx / 2), 0, 731) < 0.4 ? -1 : cel(R.violet, 0.8 + (yy < Yv(sh - 4) ? 0.8 : 0), xx, yy)));
      // legs: armoured, stepping
      for (const [sd, far] of [[1, 1], [-1, 0]]) {
        const a = Math.sin(ph + (sd > 0 ? 0 : PI)), lift = Math.max(0, Math.cos(ph + (sd > 0 ? 0 : PI))) * 5;
        const hp = [X(sd * 3), Yv(hip)], ft = [X(a * 9), Yv(lift)], kn = [(hp[0] + ft[0]) / 2 + 3 * s * f, (hp[1] + ft[1]) / 2 - lift * 0.3 * s];
        capsule(hp[0], hp[1], 4 * s, kn[0], kn[1], 3.4 * s, steel(2.4 - far)); capsule(kn[0], kn[1], 3.6 * s, ft[0], ft[1] - 2 * s, 3 * s, steel(3 - far));
        fillEll(kn[0], kn[1], 3.6 * s, 3.2 * s, 0, steel(4.2 - far));
        fillPoly([[ft[0] - 4 * s * f, ft[1]], [ft[0] + 6 * s * f, ft[1]], [ft[0] + 5 * s * f, ft[1] - 3 * s], [ft[0] - 3 * s * f, ft[1] - 4 * s]], steel(2 - far));
      }
      // tassets, breastplate
      fillPoly([[X(-9), Yv(hip + 8)], [X(10), Yv(hip + 8)], [X(12), Yv(hip - 8)], [X(-11), Yv(hip - 8)]], (xx, yy) => cel(R.steel, 2.4 + (frac((yy - Yv(hip + 8)) / (4 * s)) < 0.25 ? -1 : 0.3) + ((xx - x) * f > 0 ? 0.6 : 0), xx, yy));
      fillPoly([[X(-10), Yv(sh)], [X(11), Yv(sh)], [X(9), Yv(hip + 6)], [X(-8), Yv(hip + 6)]], (xx, yy) => { const u = ((xx - x) * f) / (11 * s); return cel(R.steel, 3 + (u > 0.25 ? 1.4 : u < -0.4 ? -1 : 0) + (Math.abs(u - 0.1) < 0.06 ? 1.6 : 0), xx, yy); });
      fillPoly([[X(-9), Yv(hip + 9)], [X(10), Yv(hip + 9)], [X(10), Yv(hip + 6)], [X(-9), Yv(hip + 6)]], C('violet', 3));
      // the lantern arm (far side, forward), the near arm with a hand on the hilt at the hip
      const lh = [X(13 + Math.sin(ph) * 2), Yv(hip - 2)];
      capsule(X(7), Yv(sh - 3), 3.4 * s, X(12), Yv(sh - 15), 3 * s, steel(2.2)); capsule(X(12), Yv(sh - 15), 3 * s, lh[0], lh[1] - 2 * s, 2.8 * s, steel(2.4));
      fillEll(X(-7), Yv(sh - 2), 6.6 * s, 5.6 * s, 0, (xx, yy, u, v) => cel(R.steel, 3.4 + (u * f * LIGHT.x + v * LIGHT.y > 0.2 ? 1.4 : -0.6) + (Math.abs(v + 0.1) < 0.12 ? -1 : 0), xx, yy));
      capsule(X(-7), Yv(sh - 6), 3.4 * s, X(-9), Yv(hip + 2), 3 * s, steel(3)); capsule(X(-9), Yv(hip + 2), 3 * s, X(-3), Yv(hip - 2), 2.8 * s, steel(3.2));
      // the sword at his hip
      line(X(-4), Yv(hip - 1), X(-20), Yv(hip - 24), C('steel', 2), Math.max(1, Math.round(2 * s))); line(X(-2), Yv(hip + 1), X(-6), Yv(hip - 5), C('violet', 4), Math.max(1, Math.round(2 * s)));
      fillEll(X(9), Yv(sh - 2), 6.6 * s, 5.6 * s, 0, (xx, yy, u, v) => cel(R.steel, 3.8 + (u * f * LIGHT.x + v * LIGHT.y > 0.2 ? 1.4 : -0.6) + (Math.abs(v + 0.1) < 0.12 ? -1 : 0), xx, yy));
      // the helm: tall, round-topped, a T of a visor slit
      const hx = X(1), hy = Yv(sh + 10);
      fillPoly([[hx - 7 * s, hy + 9 * s], [hx + 7 * s, hy + 9 * s], [hx + 8 * s, hy - 4 * s], [hx + 5 * s, hy - 10 * s], [hx - 5 * s, hy - 10 * s], [hx - 8 * s, hy - 4 * s]], (xx, yy) => { const u = (xx - hx) * f / (8 * s); return cel(R.steel, 3.2 + (u > 0.3 ? 1.4 : u < -0.4 ? -1 : 0) + (Math.abs(u - 0.15) < 0.07 && yy < hy ? 1.6 : 0), xx, yy); });
      fillEll(hx, hy - 9 * s, 5.2 * s, 3 * s, 0, steel(4));
      for (let q = -5; q <= 5; q++) put(fl(hx + q * s * 0.9 + f * s), fl(hy - 1 * s), C('ink', 0));
      for (let q = 0; q < 6; q++) put(fl(hx + f * s * 1.5), fl(hy - 1 * s + q * s), C('ink', 0));
      // the eyes
      const ea = o.eyes === undefined ? 0.6 : o.eyes;
      lk(3); for (const ex of [-2.5, 4]) { const xx = fl(hx + ex * s * f), yy = fl(hy - 1 * s); put(xx, yy, ea > 0.6 ? WHITE : C('violet', 7)); if (s > 1.4) put(xx + 1, yy, C('violet', 6)); } lk(1);
      // the crest: violet strands streaming back from the crown like a flame
      lk(3);
      for (let k = 0; k < 9; k++) { const len = (16 + ih(k, 1, 733) * 14) * s, base = [hx - (1 - k * 0.5) * s * f, hy - 11 * s]; let px = base[0], py = base[1]; for (let q = 0; q < 10; q++) { const u = q / 10, nxp = px - (len / 10) * f * (0.75 + u * 0.3), nyp = py - (len / 10) * (0.5 - u * 0.9) + Math.sin(t * 6 + k + q * 0.7) * 0.9 * s; line(px, py, nxp, nyp, u > 0.75 ? C('violet', 3) : u > 0.4 ? C('violet', 5) : C('lav', 6), Math.max(1, Math.round((1.8 - u * 1.4) * s))); px = nxp; py = nyp; } }
      lk(1);
      // the lantern: iron cage, a cold violet-white flame
      const lx = lh[0], ly = lh[1];
      line(lx, ly - 4 * s, lx, ly, C('ink', 1)); fillPoly([[lx - 3 * s, ly], [lx + 3 * s, ly], [lx + 3.6 * s, ly + 8 * s], [lx - 3.6 * s, ly + 8 * s]], C('ink', 1));
      lk(3); fillEll(lx, ly + 4.2 * s, 2.2 * s, 3 * s, 0, (xx, yy, u, v) => (Math.hypot(u, v) < 0.5 ? WHITE : C('lav', 6))); lk(1);
      // lost in the fog: every colour pulled toward a dark violet-grey (no dither), the rim and the lights kept
      const edgeC = o.edge === undefined ? C('lav', 6) : o.edge, TS = tab('#2a2440'), ls = Math.min(7, fl(sil * 8));
      lyEnd({ edge: edgeC, fx: sil > 0.06 ? (c, xx, yy, k) => (k === 3 || c === edgeC ? c : TS[ls * NPAL + c]) : undefined });
      glow(lx, ly + 4 * s, 16 * s, tab('#c8a0ff', true), 0.4 * (o.lamp === undefined ? 1 : o.lamp));
      if (ea > 0.3) glow(hx + f * s, hy - s, 10 * s * ea, tab('#d0a0ff', true), 0.6 * ea);
      return { head: [hx, hy], lamp: [lx, ly + 4 * s], foot: [x, y] };
    }
    HB.vesperFig = vesperFig;
    // Vesper's helm in close-up (a bust, S = 3): the great helm, the slit, the eyes flaring (P.eyes 0..1), the crest streaming
    BUSTS.vesper = function (P, t) {
      const ea = P.eyes || 0, lx = LIGHTS.x, HX = 2, HY = -46;
      sPoly([[-34, 0], [-30, -14], [-18, -24], [20, -24], [32, -14], [36, 0]], (x, y) => band(R.steel, 2.2 + (-(x / 34) * lx > 0.2 ? 1.2 : -0.4) + (Math.abs(y + 12) < 0.6 ? -1 : 0)));
      for (const sd of [-1, 1]) sEll(sd * 22, -18, 13, 9, (x, y, u, v) => band(R.steel, 2.8 + (u * lx + v * LIGHTS.y > 0.2 ? 1.6 : -0.6) + (Math.abs(v - 0.2) < 0.1 ? -1 : 0)));
      sPoly([[-8, -24], [10, -24], [9, -30], [-7, -30]], (x, y) => band(R.violet, 2 + (x > 2 ? 1 : 0)));
      // the crest, behind the helm
      for (let k = 0; k < 12; k++) { const len = 26 + ih(k, 1, 741) * 22, bx = HX - 4 + k * 0.6, by = HY - 20; let px = bx, py = by; for (let q = 0; q < 12; q++) { const u = q / 12, nx2 = px - len / 12 * (0.8 + u * 0.3), ny2 = py - len / 12 * (0.4 - u * 1.1) + Math.sin(t * 5 + k * 0.9 + q * 0.6) * 1.1; sLock(px, py, nx2, ny2, 0, Math.max(0.5, 2.2 - u * 1.8), u > 0.7 ? R.violet : R.lav, u > 0.7 ? 3 : u > 0.35 ? 4.6 : 5.6, false); px = nx2; py = ny2; } }
      // the helm
      sPoly([[HX - 15, HY + 22], [HX + 15, HY + 22], [HX + 17, HY - 4], [HX + 12, HY - 18], [HX - 12, HY - 18], [HX - 17, HY - 4]], (x, y) => { const u = (x - HX) / 17, v = (y - HY) / 20; let b = 2.2 + (-u * lx > 0.25 ? 1.4 : -u * lx < -0.35 ? -1 : 0) + (Math.abs(u + 0.3 * Math.sign(lx || 1)) < 0.05 ? 2.2 : 0) + (Math.abs(x - HX) < 0.6 ? 1.2 : Math.abs(x - HX - 1) < 0.6 ? -0.6 : 0) + (v < -0.5 ? 0.6 : 0) + (vn(x * 0.9, y * 0.9, 2, 745) > 0.68 ? -0.5 : 0);
        // an engraved border a few pixels in from the edge, and a band across the brow
        const inner = Math.abs(Math.abs(u) - 0.82) < 0.05 || Math.abs(y - (HY - 7)) < 0.5; if (inner) return band(R.lav, 3.4 + (u * -lx > 0 ? 1 : 0)); return band(R.steel, b); });
      sEll(HX, HY - 17, 12, 5, (x, y, u, v) => band(R.steel, 4 + (v < 0 ? 1 : 0)));
      // rivets and breaths
      for (let k = 0; k < 6; k++) { sp(HX - 13 + k * 5.2, HY - 12, C('steel', 6)); }
      for (let k = 0; k < 4; k++) for (let j = 0; j < 4; j++) sp(HX + 4 + k * 2, HY + 8 + j * 2.5, C('ink', 0));
      // the slit: a dark band with a cross bar
      sPoly([[HX - 14, HY - 2], [HX + 15, HY - 2], [HX + 15, HY + 1], [HX - 14, HY + 1]], C('ink', 0));
      sPoly([[HX - 1, HY], [HX + 2, HY], [HX + 2, HY + 12], [HX - 1, HY + 12]], C('ink', 0));
      for (const ex of [HX - 8, HX + 7]) { const r = 0.8 + ea * 1.6; sEll(ex, HY - 0.5, r * 1.8, r * 0.8, (x, y, u, v) => (Math.hypot(u, v) < 0.55 && ea > 0.2 ? C('snow', 7) : C('violet', ea > 0.5 ? 7 : 6)), 3); }
      // the gorget's rivets and a violet cord
      for (let k = 0; k < 5; k++) sp(-8 + k * 4.5, -27, C('steel', 6));
      for (let x = -10; x <= 12; x++) sp(x, -24 + Math.round(Math.sin(x * 0.5)), C('violet', 4));
      return { head: [HX, HY], eyes: [[HX - 8, HY - 0.5], [HX + 7, HY - 0.5]], mouth: [HX, HY + 8], chest: [0, -12] };
    };

    /* ---------------------------------------------------------------- Tamo's bust: a round friendly face, a teal topknot with a gold
    // ring, a spiky fringe, rosy cheeks; broad shoulders in a linen tunic with a sea-blue collar and a coil of rope over one shoulder.
    // P.fish: a fish draped over his head (flap phase); P.glow 0..1: his power lighting him teal; P.sweat */
    function hairT(pts, base, hi, strands) {
      let cx = 0, cy = 0; for (const p of pts) { cx += p[0] / pts.length; cy += p[1] / pts.length; }
      sPoly(pts, (x, y) => { const l = (x - cx) * LIGHTS.x * 0.18 + (y - cy) * LIGHTS.y * 0.18; let v = base + (l > 0.5 ? 1 : l < -0.6 ? -1 : 0); if (strands && strands(x, y)) v -= 1; if (hi && hi(x, y)) v += 1.6; return band(R.teal, v); });
    }
    BUSTS.tamo = function (P, t) {
      const F = P.face || {}, hy = (P.headY || 0), hx = (P.headX || 0), breathe = Math.sin(t * 2.1) > 0.4 ? -1 : 0, gl = P.glow || 0;
      const HX = 3 + hx, HY = -42 + hy + breathe, sw = Math.round(Math.sin(t * 2.3) * 0.6);
      const skin = (v) => band(gl > 0.5 ? R.tan : R.tan, v);
      // the anchor over his shoulder, behind him, crown up (P.anchor: its glow)
      if (P.anchor !== undefined) { HB.toSprite(); anchorArt(-22 + 240, 10 + 135, PI + 0.75, 1.15, P.anchor, t); TGT = FRAME; }
      // shoulders: broad, a linen tunic, darker where it folds
      sPoly([[-27, 0], [-26, -10], [-19, -18], [-7, -21], [13, -21], [24, -18], [30, -10], [31, 0]], (x, y) => { const u = x / 26, v = (y + 10) / 10, l = litOf(u, v); return band(R.linen, 4 + (l > 0.3 ? 1 : l < -0.35 ? -1 : 0) + (Math.abs(x + 15 - (y + 18) * 0.3) < 0.6 ? -1 : 0) + (Math.abs(x - 19 + (y + 16) * 0.25) < 0.6 ? -1 : 0)); });
      // the sea-blue collar band round the neckline
      sPoly([[-7, -21], [13, -21], [10, -15], [3, -12], [-4, -15]], (x, y) => band(R.sea, y < -19 ? 4 : 3));
      // neck
      sPoly([[HX - 6, HY + 9], [HX + 7, HY + 9], [HX + 6, -18], [HX - 6, -18]], (x, y) => skin(y < HY + 15 ? 3 : 4));
      sPoly([[-3, -21], [9, -21], [6, -16], [3, -14], [0, -16]], (x, y) => skin(4));
      // a coil of rope over the near shoulder, twisted
      for (let k = 0; k < 26; k++) { const u = k / 25, rx = lerp(-20, 14, u), ry = lerp(-19, -1, u) - Math.sin(u * PI) * 2; sEll(rx, ry, 2.3, 2.3, (x, y, uu, vv) => band(R.wood, 4 + (uu + vv < -0.3 ? 1 : uu + vv > 0.6 ? -1 : 0) + ((k & 1) && uu > 0 ? -1 : 0))); }
      // ears
      sEll(HX - 12, HY + 2, 2.6, 3.6, (x, y, u, v) => skin(4 + (u < 0 ? -1 : 0) + (Math.abs(u) < 0.3 && Math.abs(v) < 0.4 ? -1 : 0)));
      // the face: round, a soft jaw
      sEll(HX, HY, 13, 14.5, (x, y, u, v) => {
        if (v > 0.15) { const uu = u - 0.12 * (v - 0.15), half = 1 - Math.pow((v - 0.15) / 0.85, 1.8) * 0.48; if (Math.abs(uu) > half) return -1; }
        const l = litOf(u, v * 0.8); let s = 5 + (l > 0.4 ? 1 : l < -0.45 ? -1 : 0); if (v > 0.8) s -= 1; if (v < -0.4) s -= 0.6; return skin(s);
      });
      pFace(P, Object.assign({ blush: F.blush === undefined ? 0.5 : F.blush }, F), 0, HY - 1, HX - 9, HX + 2, HX + 3, HY + 9, R.tan, R.earth);
      sp(HX + 5, HY + 4, C('tan', 3)); sp(HX + 5, HY + 5, C('tan', 3)); sp(HX + 4, HY + 6, C('tan', 4)); sp(HX + 6, HY + 5, C('tan', 6));
      // the topknot: a ball of hair on the crown, bound with a gold ring, a tuft out of the top
      sEll(HX - 3 + sw * 0.3, HY - 21, 5.2, 4.6, (x, y, u, v) => band(R.teal, 3 + (litOf(u, v) > 0.25 ? 1.4 : litOf(u, v) < -0.35 ? -1 : 0) + (Math.abs(u + v * 0.4) < 0.12 ? -1 : 0)));
      sLock(HX - 3, HY - 25, HX - 6 + sw, HY - 30, 0.6, 1.4, R.teal, 4, true); sLock(HX - 2, HY - 25, HX + 1 + sw, HY - 29, -0.5, 1.1, R.teal, 4, false);
      sPoly([[HX - 7, HY - 18], [HX + 1, HY - 18], [HX + 1, HY - 15], [HX - 7, HY - 15]], (x, y) => band(R.gold, 5 + (x < HX - 4 ? 1 : 0) - (y > HY - 16 ? 1 : 0)));
      // the crown of hair: short, a band of light across it
      sEll(HX - 0.5, HY - 7, 14, 10.5, (x, y, u, v) => (v > 0.28 ? -1 : band(R.teal, 2.6 + (Math.abs(Math.hypot(u + 0.1, v + 0.15) - 0.72) < 0.1 && v < 0 && u > -0.6 ? 1.3 : 0) + (litOf(u, v) > 0.5 ? 1 : litOf(u, v) < -0.5 ? -1 : 0) + (Math.abs(u * 6 - fl(u * 6) - 0.5) < 0.08 && v < -0.2 ? -1 : 0))));
      // the fringe: spiky locks falling forward and to his right
      const BG = [[-11, -6, 7, -1], [-7, -1, 9, 1], [-2, 4, 10, 2], [3, 9, 9, 3], [8, 13, 6, 2]];
      for (const [a, b, len, sweep] of BG) hairT([[HX + a, HY - 10], [HX + b, HY - 10], [HX + b + sweep + sw * 0.3, HY - 10 + len * 0.55], [HX + (a + b) / 2 + sweep + 1, HY - 10 + len], [HX + a + sweep * 0.4, HY - 10 + len * 0.45]], 3, (x, y) => y > HY - 10 + len * 0.5 && y < HY - 10 + len * 0.7 && x > HX + a + 1, (x, y) => Math.abs(x - (HX + (a + b) / 2) - (y - HY + 10) * 0.25) < 0.5);
      // short sides: a sideburn in front of the ear
      hairT([[HX - 13, HY - 7], [HX - 9, HY - 7], [HX - 9, HY + 2], [HX - 11, HY + 5], [HX - 13, HY]], 2.4);
      // sweat
      if (P.sweat) for (const [dx, dy, ph] of [[11, -4, 0], [-8, 2, 0.4], [13, 4, 0.7]]) { const u = frac(t * 0.9 + ph), yy = HY + dy + u * 9; if (u < 0.85) { sp(HX + dx, yy, C('sky', 7), 3); sp(HX + dx, yy + 1, C('sky', 5), 3); } }
      // the fish draped over his head
      if (P.fish !== undefined) {
        // a big silver fish draped across the crown: head hanging over his brow on the right, tail flapping off the back
        const fp = Math.sin(P.fish * 22), cx0 = HX + 1, cy0 = HY - 17;
        const spine = (a) => [cx0 + a, cy0 + Math.pow(a / 15, 2) * 9 + (a < -10 ? fp * (-10 - a) * 0.5 : 0)];
        for (let a = -16; a <= 16; a += 0.5) {
          const u = (a + 16) / 32, wd = Math.sin(Math.min(1, u * 1.15) * PI) * 5.2 + 0.5, [qx, qy] = spine(a);
          for (let b = -wd; b <= wd; b += 0.5) sp(qx, qy + b, b < -wd * 0.45 ? C('sea', 2) : b < -wd * 0.1 ? C('steel', 4) : b > wd * 0.55 ? C('hush', 7) : ((fl(a / 2) + fl(b)) & 1) ? C('steel', 6) : C('hush', 5), 2);
        }
        const [tx, ty] = spine(-16); for (const sd of [-1, 1]) for (let q = 0; q < 7; q += 0.5) sp(tx - q * 0.7, ty + sd * q * 0.9 + fp * q * 0.4, C('sea', sd < 0 ? 2 : 4), 2);
        const [ex, ey] = spine(12); sp(ex, ey - 1, C('ink', 0), 2); sp(ex + 1, ey - 1, C('ink', 0), 2); sp(ex, ey - 2, C('snow', 7), 3);
        const [gx, gy] = spine(8); for (let q = -3; q <= 2; q++) sp(gx, gy + q, C('crimson', 3), 2);
        const [mx, my] = spine(16); sp(mx, my + 1, C('ink', 0), 2); sp(mx - 1, my + 2, C('ink', 0), 2);
        const [fx2, fy2] = spine(-2); for (let q = 0; q < 5; q++) sp(fx2 - q, fy2 - 5 - (q < 3 ? 1 : 0), C('sea', 3), 2);
      }
      return { head: [HX, HY - 4], mouth: [HX + 3, HY + 9], chest: [2, -12] };
    };

    /* ---------------------------------------------------------------- the dockhand's bust: a weathered face under a wool cap, a big grey beard,
    // a clay pipe; P.puff 0..1 */
    BUSTS.docker = function (P, t) {
      const F = P.face || {}, HX = 3 + (P.headX || 0), HY = -41 + (P.headY || 0) + (Math.sin(t * 1.6) > 0.5 ? -1 : 0), m = F.mouth || 0;
      sPoly([[-28, 0], [-27, -10], [-20, -19], [-8, -22], [14, -22], [24, -19], [31, -10], [32, 0]], (x, y) => { const u = x / 26, v = (y + 10) / 10, l = litOf(u, v); return band(R.rust, 3 + (l > 0.3 ? 1 : l < -0.35 ? -1 : 0) + ((fl(x / 2) + fl(y / 2)) & 1 ? 0 : -0.5 * 0)); });
      for (let y = -21; y < 0; y += 2) for (let x = -27; x < 31; x++) if (sstep(-1, 1, 1) && ((x + (y >> 1)) % 4 === 0)) sp(x, y, C('rust', 2));
      // apron bib and straps
      sPoly([[-6, -14], [14, -14], [15, 0], [-7, 0]], (x, y) => band(R.earth, 4 + (x < -3 ? -1 : 0)));
      for (const sx of [-6, 13]) sPoly([[sx, -14], [sx + 2, -14], [sx + (sx < 0 ? -4 : 5), -22], [sx + (sx < 0 ? -6 : 3), -22]], C('earth', 3));
      sEll(HX - 12, HY + 2, 2.6, 3.6, (x, y, u, v) => band(R.skin, 3 + (u < 0 ? -1 : 0)));
      sEll(HX, HY, 12.5, 14, (x, y, u, v) => { if (v > 0.3) { const uu = u - 0.1 * v, half = 1 - Math.pow((v - 0.3) / 0.7, 1.6) * 0.4; if (Math.abs(uu) > half) return -1; } const l = litOf(u, v * 0.8); return band(R.skin, 4.4 + (l > 0.4 ? 1 : l < -0.45 ? -1 : 0) + ((Math.abs(v + 0.15) < 0.04 || Math.abs(v - 0.05) < 0.03) && u < 0.4 && u > -0.6 ? -0.8 : 0)); });
      // the beard: a big grey mass from the cheeks down over the chest
      sPoly([[HX - 11, HY + 2], [HX - 6, HY + 6], [HX + 10, HY + 6], [HX + 13, HY + 2], [HX + 13, HY + 12], [HX + 8, HY + 24], [HX + 1, HY + 27], [HX - 6, HY + 23], [HX - 11, HY + 12]], (x, y) => { const l = litOf((x - HX) / 12, (y - HY - 12) / 12); return band(R.stone, 4.4 + (l > 0.3 ? 1 : l < -0.3 ? -1 : 0) - (Math.abs(frac((x - HX) / 3 + (y - HY) * 0.08) - 0.5) < 0.12 ? 1 : 0)); });
      pFace(P, Object.assign({ eyes: 'half' }, F, { mouth: 0, smile: 0 }), 0, HY - 2, HX - 9, HX + 2, HX + 3, HY + 9, R.skin, R.sky);
      // the bushy grey brows (over pFace's)
      for (const ex of [HX - 9, HX + 2]) for (let i = -1; i < 9; i++) { sp(ex + i, HY - 5 - (i > 2 && i < 6 ? 1 : 0), C('stone', 6)); sp(ex + i, HY - 4, C('stone', 5)); }
      // a big nose
      sEll(HX + 6, HY + 4, 3, 3, (x, y, u, v) => band(R.skin, 3.6 + (litOf(u, v) > 0.2 ? 1 : -0.6)));
      // the mustache, and the mouth inside the beard
      sPoly([[HX - 4, HY + 8], [HX + 12, HY + 8], [HX + 13, HY + 11], [HX + 4, HY + 10], [HX - 5, HY + 11]], (x, y) => band(R.stone, 5.4 - (y > HY + 9 ? 1 : 0)));
      if (m > 0.12) sPoly([[HX + 1, HY + 11], [HX + 8, HY + 11], [HX + 7, HY + 11 + m * 4], [HX + 2, HY + 11 + m * 4]], C('crimson', 1));
      // the pipe: a clay stem from the corner of his mouth, the bowl smouldering
      for (let q = 0; q < 10; q++) sp(HX + 9 + q, HY + 11 + q * 0.35, C('linen', 6));
      sPoly([[HX + 17, HY + 7], [HX + 22, HY + 7], [HX + 21, HY + 15], [HX + 18, HY + 15]], (x, y) => band(R.wood, 3 + (x > HX + 19 ? -1 : 0)));
      for (let x = HX + 18; x < HX + 22; x++) sp(x, HY + 7, (P.puff || 0) > 0.5 ? C('fire', 6) : C('ember', 4), 3);
      // the cap: a wool watch cap, rolled brim, ribbed
      sEll(HX - 1, HY - 8, 14.5, 10, (x, y, u, v) => (v > 0.3 ? -1 : band(R.olive, 2.4 + (litOf(u, v) > 0.4 ? 1 : litOf(u, v) < -0.4 ? -1 : 0) + ((x & 1) && v < 0.05 ? -0.6 : 0))));
      sPoly([[HX - 15, HY - 8], [HX + 14, HY - 8], [HX + 14, HY - 4], [HX - 15, HY - 3]], (x, y) => band(R.olive, 3.4 + (y < HY - 7 ? 1 : 0) - ((x & 1) ? 0.6 : 0)));
      // grey hair under the cap at the back
      sPoly([[HX - 14, HY - 4], [HX - 9, HY - 4], [HX - 10, HY + 4], [HX - 13, HY + 2]], C('stone', 5));
      return { head: [HX, HY - 4], mouth: [HX + 4, HY + 10], chest: [2, -12], pipe: [HX + 20, HY + 6] };
    };
  }
