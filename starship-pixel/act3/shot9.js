// Shot 9 (71.2-78.6): the tower holding the caught ship against a pale sky, sea on the
// horizon; slow sideways drift of the camera (scene slides right), pelicans skim the water.
(function () {
  'use strict';
  const { W, H, S, Wm, T, M, A, D, buf, P, Pd, rect, hl, vl, line, poly, disc, ring, pick, bth, hash, vnoise, fbm2,
    clamp, lerp, smooth, spline, ri, get, DARKER } = PX;
  window.SHOTS = window.SHOTS || {};

  const HZ = 255; // sea horizon row
  const skyRamp = [S[6], S[7], T[7], S[8], T[8], S[9]];
  function sky(t, ox) {
    const so = ox * 0.15; // distant clouds barely move
    for (let y = 0; y < HZ; y++) for (let x = 0; x < W; x++) {
      let v = 0.75 + 4.1 * Math.pow(y / HZ, 0.8);
      // low soft cloud banks resting on the horizon haze
      const cb = fbm2((x - so * 1.5) * 0.012, y * 0.05, 91, 3);
      if (y > 200 && cb > 0.55) v += (cb - 0.55) * 4 * smooth(200, 235, y) * smooth(256, 244, y);
      const wx = x - so - (t - 71.2) * 1.2;
      const n = fbm2(wx * 0.006, y * 0.11, 61, 3);
      if (y < 200 && n > 0.64) v += (n - 0.64) * 6 * smooth(200, 60, y);
      let c = pick(skyRamp, v, ri(x - so), y);
      // warm late-light haze lying along the horizon
      if (y > 222 && (c === S[9] || c === T[8]) && 0.38 * smooth(222, 252, y) > bth(ri(x - so), y)) c = Wm[5];
      buf[y * W + x] = c;
    }
  }
  function sea(t, ox) {
    const so = ox * 0.4;
    for (let y = HZ; y < H; y++) for (let x = 0; x < W; x++) {
      const g = y - HZ;
      let c = g === 0 ? S[8] : pick([A[2], A[3], A[4]], 1.6 - g * 0.09, x, y);
      const wx = x - so;
      const r = hash(Math.floor((wx + (t - 71.2) * (2 + g)) / (4 + g)), y, 3);
      if (g > 1 && r > 0.86) c = g > 7 ? A[3] : A[4];
      if (g > 0 && r > 0.975 && hash(ri(wx), y, Math.floor(t * 4)) > 0.5) c = S[9];
      buf[y * W + x] = c;
    }
  }

  // ---- tower (side view, sunlit from the front-left) ----
  const MOD = 15, G0 = 74;            // module height, first girt row
  const COLS = [176, 190, 216];       // 5-px columns
  // shade a 5-px lit column at x
  function column(x, y0, y1, X, Y) {
    const cs = [T[6], T[8], T[8], T[7], T[5]];
    for (let y = Y(y0); y <= Math.min(H - 1, Y(y1)); y++) for (let i = 0; i < 5; i++) P(X(x + i), y, cs[i]);
  }
  // 2-px lit diagonal member
  function member(x0, y0, x1, y1, X, Y, lit, shade, thick) {
    line(X(x0), Y(y0), X(x1), Y(y1), lit);
    if (thick) { line(X(x0), Y(y0 + 1), X(x1), Y(y1 + 1), lit); line(X(x0), Y(y0 + 2), X(x1), Y(y1 + 2), shade); }
    else line(X(x0), Y(y0 + 1), X(x1), Y(y1 + 1), shade);
  }
  function tower(o) {
    const X = x => x + o[0], Y = y => y + o[1];
    const TOPY = 47;
    // tower interior: cool shadowed depth behind the near face
    for (let y = Y(G0); y < H; y++) for (let x = X(176); x <= X(226); x++) {
      const lx = x - X(176);
      Pd(x, y, (lx > 18 && lx < 40) ? S[6] : S[7], (lx > 18 && lx < 40) ? 0.5 : 0.6, 0, 0);
    }
    // far face in cool sky-lit shadow, seen through the bays
    for (let y = G0; y < H + MOD; y += MOD) {
      const k = ((y - G0) / MOD) & 1;
      line(X(197), Y(k ? y + MOD - 1 : y + 3), X(207), Y(k ? y + 3 : y + MOD - 1), S[6]);
      line(X(216), Y(k ? y + MOD - 1 : y + 3), X(207), Y(k ? y + 3 : y + MOD - 1), S[6]);
      line(X(182), Y(y + 3), X(190), Y(y + MOD - 1), S[7]);
      hl(X(195), X(215), Y(y + 4), S[7]);
    }
    vl(X(205), Y(G0), H, S[5]);
    // near face K-bracing
    for (let y = G0; y < H + MOD; y += MOD) {
      const k = ((y - G0) / MOD) & 1;
      // wide bay: chevrons alternating up/down
      if (k) { member(195, y + 1, 205, y + MOD - 3, X, Y, T[8], T[6], 1); member(215, y + 1, 205, y + MOD - 3, X, Y, T[7], T[5], 1); }
      else { member(195, y + MOD - 3, 205, y + 1, X, Y, T[8], T[6], 1); member(215, y + MOD - 3, 205, y + 1, X, Y, T[7], T[5], 1); }
      // gusset at the apex
      rect(X(204), Y(k ? y + MOD - 3 : y + 2), 3, 2, T[8]);
      // narrow bay: alternating single diagonals
      if (k) member(181, y + 1, 189, y + MOD - 3, X, Y, T[8], T[6], 1); else member(189, y + 1, 181, y + MOD - 3, X, Y, T[7], T[5], 1);
      // girt
      hl(X(176), X(220), Y(y), T[8]); hl(X(176), X(220), Y(y + 1), T[6]); hl(X(181), X(215), Y(y + 2), T[4]);
    }
    for (const c of COLS) column(c, TOPY + 22, H, X, Y);
    // carriage track lattice on the right face
    vl(X(221), Y(TOPY + 22), H, T[6]); vl(X(226), Y(TOPY + 22), H, T[5]);
    for (let y = TOPY + 24; y < H; y += 6) { line(X(222), Y(y), X(225), Y(y + 5), T[6]); hl(X(222), X(225), Y(y), T[5]); }
    // clad lower section in the wide bay
    for (let y = Y(232); y < H; y++) for (let x = X(196); x <= X(214); x++) {
      const yy = y - Y(232);
      let c = T[8];
      if (yy % 11 === 0) c = T[6]; else if ((x - X(196)) % 6 === 0) c = T[7];
      if (x === X(214)) c = T[6];
      buf[y * W + x] = c;
    }
    // top house
    const tx0 = X(178), tx1 = X(233), ty0 = Y(TOPY);
    rect(tx0, ty0 + 3, tx1 - tx0 + 1, 20, T[8]);
    for (let x = tx0 + 2; x < tx1; x += 4) vl(x, ty0 + 5, ty0 + 15, T[7]);
    for (let x = tx0 + 4; x < tx1 - 4; x += 9) if (hash(x - tx0, 1, 4) > 0.5) rect(x, ty0 + 6, 4, 9, T[7]);
    hl(tx0, tx1, ty0 + 3, T[7]); hl(tx0, tx1, ty0 + 4, T[8]);
    rect(tx0, ty0 + 16, tx1 - tx0 + 1, 7, T[5]);
    hl(tx0, tx1, ty0 + 16, T[4]); hl(tx0, tx1, ty0 + 22, T[3]);
    for (let x = tx0 + 1; x < tx1; x += 2) P(x, ty0 + 19, T[4]);
    vl(tx0, ty0 + 3, ty0 + 22, T[6]); vl(tx1, ty0 + 3, ty0 + 22, T[4]);
    // roof railing and kit
    hl(tx0, tx1, ty0, T[6]);
    for (let x = tx0; x <= tx1; x += 3) vl(x, ty0, ty0 + 2, T[6]);
    rect(X(186), ty0 - 3, 6, 3, T[6]); hl(X(186), X(191), ty0 - 3, T[8]);
    vl(X(224), ty0 - 7, ty0 - 1, T[5]); P(X(224), ty0 - 8, T[7]);
    // hoist cables with the hook block above the arm
    vl(X(229), ty0 + 23, Y(98), T[4]); vl(X(232), ty0 + 23, Y(84), T[4]);
    rect(X(230), Y(84), 5, 6, T[5]); hl(X(230), X(234), Y(84), T[7]); vl(X(230), Y(84), Y(89), T[6]);
    vl(X(232), Y(90), Y(98), T[4]);
  }
  // QD arm (lower left)
  function qdArm(o) {
    const X = x => x + o[0], Y = y => y + o[1];
    const y0 = 214;
    hl(X(160), X(176), Y(y0), T[8]); hl(X(160), X(176), Y(y0 + 1), T[6]); hl(X(160), X(176), Y(y0 + 2), T[4]);
    hl(X(160), X(176), Y(y0 - 4), T[6]);
    for (let x = 160; x <= 176; x += 3) vl(X(x), Y(y0 - 4), Y(y0 - 1), T[6]);
    rect(X(165), Y(y0 - 9), 6, 5, T[7]); hl(X(165), X(170), Y(y0 - 9), T[8]); P(X(167), Y(y0 - 7), T[4]);
    vl(X(160), Y(y0), Y(y0 + 30), T[6]); vl(X(161), Y(y0), Y(y0 + 30), T[4]);
    hl(X(160), X(176), Y(y0 + 30), T[5]); hl(X(160), X(176), Y(y0 + 31), T[3]);
    member(161, y0 + 3, 175, y0 + 28, X, Y, T[6], T[4]); member(175, y0 + 3, 162, y0 + 28, X, Y, T[5], T[3]);
    hl(X(161), X(175), Y(y0 + 15), T[5]);
    line(X(168), Y(y0 + 3), X(165), Y(y0 + 13), T[3]); line(X(165), Y(y0 + 13), X(170), Y(y0 + 20), T[3]);
  }
  // chopstick arm + carriage holding the ship (warm-tinged steel in the light)
  function arms(o, t) {
    const X = x => x + o[0], Y = y => y + o[1];
    const AY = 99;           // top chord row
    const LO = 119;          // lower chord row
    const CB = 149;          // carriage bottom
    // carriage clamp bands across the tower
    for (const yy of [102, 145]) {
      rect(X(175), Y(yy), 62, 4, T[5]); hl(X(175), X(236), Y(yy), T[7]); hl(X(175), X(236), Y(yy + 1), T[6]); hl(X(175), X(236), Y(yy + 3), T[3]);
      for (let x = 179; x < 236; x += 5) P(X(x), Y(yy + 2), T[4]);
    }
    // carriage spine
    rect(X(233), Y(AY), 5, CB - AY + 1, T[4]); vl(X(233), Y(AY), Y(CB), T[6]); vl(X(237), Y(AY), Y(CB), T[3]);
    // far arm echo (behind the ship)
    hl(X(238), X(305), Y(AY - 3), T[5]); hl(X(238), X(305), Y(AY - 2), T[4]); rect(X(303), Y(AY - 5), 3, 5, T[4]); vl(X(303), Y(AY - 5), Y(AY - 1), T[6]);
    // big strut from the lower chord's far end back down to the carriage bottom
    line(X(270), Y(LO), X(238), Y(CB - 2), T[6]); line(X(270), Y(LO + 1), X(238), Y(CB - 1), T[4]);
    line(X(270), Y(LO + 2), X(238), Y(CB), T[4]); line(X(270), Y(LO + 3), X(238), Y(CB + 1), T[2]);
    // second diagonal strut
    line(X(256), Y(LO + 2), X(238), Y(CB - 14), T[5]); line(X(256), Y(LO + 3), X(238), Y(CB - 13), T[3]);
    // lower chord
    hl(X(238), X(271), Y(LO), T[6]); hl(X(238), X(271), Y(LO + 1), T[4]); hl(X(238), X(271), Y(LO + 2), T[2]);
    // posts and N-diagonals between the chords (2-px members, lit left)
    const posts = [238, 246, 254, 262, 270];
    for (let i = 0; i < posts.length; i++) {
      const px = posts[i];
      vl(X(px), Y(AY + 3), Y(LO), T[5]); vl(X(px + 1), Y(AY + 3), Y(LO), T[3]);
      if (i + 1 < posts.length) {
        const nx = posts[i + 1];
        line(X(px + 2), Y(LO - 1), X(nx - 1), Y(AY + 5), T[5]); line(X(px + 2), Y(LO), X(nx - 1), Y(AY + 6), T[3]);
        P(X(px + 2), Y(LO - 1), T[6]);
      }
    }
    // top chord (thick) and pin rail
    rect(X(234), Y(AY), 70, 5, T[3]);
    hl(X(234), X(303), Y(AY - 1), T[7]); hl(X(234), X(303), Y(AY), T[6]); hl(X(234), X(303), Y(AY + 1), T[4]); hl(X(234), X(303), Y(AY + 4), T[2]);
    for (let x = 238; x < 303; x += 7) P(X(x), Y(AY + 2), T[3]);
    // pin rail tip just past the ship
    rect(X(302), Y(AY - 2), 3, 7, T[4]); vl(X(302), Y(AY - 2), Y(AY + 4), T[7]);
  }

  // ---- ship: slender stainless cylinder, lit steel side left, black heat-shield tiles right ----
  const SX = 286, SR = 12, SLN = 32, KP = SLN + 7, STIP = 98 - KP, SL = 146;
  // tangent ogive nose with a small blunt tip
  const RHO = (SR * SR + SLN * SLN) / (2 * SR);
  const ogive = k => k >= SLN ? SR : Math.max(Math.sqrt(Math.max(0, 3.2 * 3.2 - (3.2 - k) * (3.2 - k))) * 0.95, Math.sqrt(Math.max(0, RHO * RHO - (SLN - k) * (SLN - k))) + SR - RHO);
  const STEEL = [[-1, 4.6], [-0.86, 6.9], [-0.62, 8.0], [-0.36, 7.4], [-0.05, 6.4], [0.25, 5.6]];
  const steelV = u => { for (let i = 1; i < STEEL.length; i++) if (u <= STEEL[i][0]) { const a = STEEL[i - 1], b = STEEL[i]; return lerp(a[1], b[1], (u - a[0]) / (b[0] - a[0])); } return 5.6; };
  function ship(o, t) {
    const X = x => x + o[0], Y = y => y + o[1];
    for (let k = 0; k < SL; k++) {
      const y = Y(STIP + k);
      const hw = ogive(k + 0.5);
      const xl = ri(SX - hw), xr = ri(SX + hw) - 1;
      for (let x = xl; x <= xr; x++) {
        const u = (x + 0.5 - SX) / hw;
        const split = 0.22 + ((k >> 2) & 1 ? 0.04 : -0.04) - (k < SLN ? 1.1 * Math.pow(1 - k / SLN, 2.2) : 0);
        let c;
        if (u > split) {
          // heat-shield tiles: black with a soft sky sheen, tile courses every 4 rows
          let v = 2.0 + 0.9 * Math.exp(-(((u - 0.52) / 0.2) ** 2)) - (u > 0.86 ? 0.8 : 0);
          if (k < 6) v += 1.2 * (1 - k / 6) * (u < 0.3 ? 1 : 0.4);
          c = pick(T, v, x, 0);
          if (k % 4 === 3 && (x & 1)) c = DARKER[c];
        } else {
          let v = steelV(u) + (k < SLN ? 0.4 * (1 - k / SLN) : 0);
          c = pick(T, v, x, 0);
          if (x === xl) c = T[4];
        }
        if (k >= SL - 3) c = k === SL - 1 ? T[2] : T[3];
        P(X(x), y, c);
      }
      // weld rings on the steel
      if (k > SLN && (k - SLN) % 14 === 7) for (let x = xl + 1; x < ri(SX + 0.2 * hw); x++) { const i = y * W + X(x); if (y >= 0 && y < H) buf[i] = DARKER[buf[i]]; }
    }
    // raceway down the steel side
    vl(X(SX - 5), Y(STIP + SLN + 8), Y(STIP + SL - 10), T[5]); vl(X(SX - 4), Y(STIP + SLN + 8), Y(STIP + SL - 10), T[8]);
    P(X(SX - 4), Y(STIP + SLN + 7), T[7]);
    // forward flaps: small, high on the nose; right (tile side) fully, left foreshortened
    for (let k = 14; k <= SLN + 6; k++) {
      const y = Y(STIP + k), xr = ri(SX + ogive(k + 0.5)) - 1, xl = ri(SX - ogive(k + 0.5));
      const g = (k - 14) / (SLN + 6 - 14);
      const wr = ri(1 + 4 * Math.min(1, g * 1.3)), wlft = ri(1 + 2 * Math.min(1, g * 1.3));
      for (let i = 1; i <= wr; i++) P(X(xr + i), y, i === wr ? T[5] : i === 1 ? T[1] : T[3]);
      for (let i = 1; i <= wlft; i++) P(X(xl - i), y, i === wlft ? T[4] : T[2]);
    }
    line(X(SX + 6), Y(STIP + 13), X(SX + SR + 5), Y(STIP + 28), T[5]);
    // aft flaps at the base
    for (let k = SL - 34; k < SL - 2; k++) {
      const y = Y(STIP + k), g = (k - (SL - 34)) / 6;
      const wr = ri(2 + 5 * Math.min(1, g)), wlft = ri(1 + 3 * Math.min(1, g));
      for (let i = 1; i <= wr; i++) P(X(SX + SR - 1 + i), y, i === wr ? T[4] : T[2]);
      for (let i = 1; i <= wlft; i++) P(X(SX - SR - i), y, i === wlft ? T[4] : T[2]);
    }
    line(X(SX + SR), Y(STIP + SL - 35), X(SX + SR + 6), Y(STIP + SL - 29), T[5]);
    // catch hardpoints just under the forward flaps, resting on the arms' rails
    const py = STIP + KP;
    rect(X(SX - SR - 3), Y(py - 3), 3, 4, T[5]); hl(X(SX - SR - 3), X(SX - SR - 1), Y(py - 3), T[7]); P(X(SX - SR - 3), Y(py), T[3]);
    rect(X(SX + SR), Y(py - 6), 3, 4, T[4]); hl(X(SX + SR), X(SX + SR + 2), Y(py - 6), T[6]);
  }
  // pelicans gliding low over the sea
  const BIRD = [['X...X', '.X.X.', '..X..'], ['.....', 'XX.XX', '..X..'], ['.....', '.XXX.', 'X.X.X']];
  function pelicans(t) {
    const dt = t - 71.2;
    const groups = [[490, 236, 24, 4], [560, 222, 30, 3]];
    for (let g = 0; g < groups.length; g++) {
      const [x0, y0, vx, n] = groups[g];
      for (let i = 0; i < n; i++) {
        const x = ri(x0 - dt * vx + i * 11), y = ri(y0 - i * 2 + Math.sin(dt * 0.8 + i + g) * 1.2);
        const cyc = (dt * 1.3 + i * 0.21 + g * 0.5) % 2;
        const fr = cyc < 0.25 ? 0 : cyc < 0.5 ? 1 : cyc < 0.75 ? 2 : 1;
        const s = BIRD[fr];
        for (let j = 0; j < 3; j++) for (let q = 0; q < 5; q++) if (s[j][q] === 'X') P(x + q - 2, y + j - 1, T[3]);
        P(x - 3, y, T[3]); // long bill leading the way
      }
    }
  }

  // specular glints: the sun catching the rail as the camera drifts, then the ship's nose
  function star(x, y, k) {
    const L = ri(1 + 4 * k);
    P(x, y, Wm[6]);
    for (let i = 1; i <= L; i++) { const c = i < L ? Wm[6] : Wm[5]; P(x + i, y, c); P(x - i, y, c); P(x, y + i, c); P(x, y - i, c); }
    if (k > 0.6) { P(x + 1, y + 1, Wm[5]); P(x - 1, y - 1, Wm[5]); P(x + 1, y - 1, Wm[5]); P(x - 1, y + 1, Wm[5]); }
  }
  function glints(o, t) {
    const g1 = smooth(73.0, 73.4, t) * (1 - smooth(74.2, 74.7, t));
    if (g1 > 0.02) star(ri(o[0] + lerp(244, 284, smooth(73.0, 74.7, t))), o[1] + 98, g1);
    const g2 = smooth(75.9, 76.3, t) * (1 - smooth(76.7, 77.2, t));
    if (g2 > 0.02) star(o[0] + SX - 6, o[1] + STIP + 6, g2);
  }

  window.SHOTS.shot9 = function (t) {
    const p = smooth(71.2, 78.6, t) * 0.55 + (t - 71.2) / 7.4 * 0.45;
    const o = [ri(p * 22), ri(p * 5)];
    sky(t, o[0]);
    sea(t, o[0]);
    pelicans(t);
    tower(o);
    qdArm(o);
    ship(o, t);
    arms(o, t);
    glints(o, t);
  };
})();
