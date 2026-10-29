  /* ================================================================ Carry · L5 — the sun and its planets
     The snail's world (g_planet, radius 8.75 about (0, +8.75)) sits on its orbit at the origin, its crescent toward the sun.
     The sun blazes at (−122, +77.6), lower left (along g_planet's light), lighting everything. Faint orbits ring it; a small
     inner world runs round it once a loop; a pale cloudy one; a red one; an asteroid belt; a ringed giant; a far ice world.
     All of it fades toward the edges of the frame, and space itself turns from black to the galaxy's own light (L6's, lent
     through ZSH), so that inside the galaxy the solar system is a small bright knot in the arm's glow, with no edge. */
  {
    const SUN = [-122, 77.6, 20], DPL = Math.hypot(122, 77.6 - 8.75);
    // the other worlds: [orbit radius, angle (rad, about the sun), turns per loop, radius, colours [dark, mid, light], ringed]
    const WORLDS = [
      [58, -0.9, 1, 2.6, [32, 33, 34], 0],
      [96, -1.3, 0, 4.4, [65, 64, 22], 0],
      [196, -0.78, 0, 3.6, [11, 12, 13], 0],
      [300, -0.42, 0, 15, [29, 31, 16], 1],
      [370, -0.47, 0, 6, [117, 118, 119], 0],
    ];
    const BELT = []; for (let k = 0; k < 300; k++) BELT.push([250 + (ih(k, 1, 5501) - 0.5) * 22, ih(k, 2, 5501) * TAU, ih(k, 3, 5501)]);
    const C5HAZE = [4, 19, 20, 21, 22];
    const edgeFade = (x, y) => 1 - sstep(170, 250, Math.max(Math.abs(x) * 0.72, Math.abs(y) * 1.25));
    // how much of the galaxy's light shows: none about the sun and its worlds, all of it where L6's window ends
    // (a soft, ragged-edged dark pocket about the origin: black at this layer's window, full light by L6's window's edge)
    const gwE = (x, y, a, b, c, d) => sstep(0.18, 0.64, Math.hypot(x / 288, y / 176) + 0.05 * a * b + 0.035 * c * d);
    const galW = (x, y) => gwE(x, y, Math.sin(x * 0.019 + 1.3), Math.sin(y * 0.023 - 0.7), Math.sin(x * 0.047 + 2.1), Math.sin(y * 0.041 - 1.9));
    const GWX = new Float32Array(W * 2), GWY = new Float32Array(H * 2);
    function c5Draw(V, t) {
      const u = V.u, G = ZSH.galaxy, [gcr, gsr] = G.prep(t);
      // (the galaxy's faint nebula, nearly flat over this small patch of it: a plane through its value here)
      const nv = (x, y) => vn(x * 0.004, y * 0.004, 1, 6103), neb = [nv(0, 0), (nv(20, 0) - nv(-20, 0)) / 40, (nv(0, 20) - nv(0, -20)) / 40];
      // space: the galaxy's light, fading to black about the sun
      for (let X = 0; X < W; X++) { const x = V.lx(X); GWX[X * 2] = Math.sin(x * 0.019 + 1.3); GWX[X * 2 + 1] = Math.sin(x * 0.047 + 2.1); }
      for (let Y = 0; Y < H; Y++) { const y = V.ly(Y); GWY[Y * 2] = Math.sin(y * 0.023 - 0.7); GWY[Y * 2 + 1] = Math.sin(y * 0.041 - 1.9); }
      V.each(-420, -420, 420, 420, (x, y, X, Y) => {
        const d = bay(X, Y), w = gwE(x, y, GWX[X * 2], GWY[Y * 2], GWX[X * 2 + 1], GWY[Y * 2 + 1]);
        if (w <= 0) return d < 0.12 ? 1 : 0;
        let c = G.pix(x / 8, y / 8, X, Y, gcr, gsr, u * 8, w, neb);
        if (c === 0 && d < 0.12 * (1 - w)) c = 1;
        return c;
      });
      // (L4's sky near the window, thinning to the galaxy's sparser, greyer stars where its light comes in)
      G.fine(V, gcr, gsr, u * 8, 8, galW);
      zStars(V, t, -420, -420, 420, 420, 4, 5503, [136, 19, 20, 21, 22], (x, y) => { const w = galW(x, y); return ih(fl(x * 64), fl(y * 64), 5506) > 1 - 0.5 * w ? false : w > 0.45 ? C5HAZE : true; });
      // the sun's light on space: a broad warm glow (L6 draws the same, an eighth the size)
      zGlow(V, SUN[0], SUN[1], 140, T_WARM, 0.32); zGlow(V, SUN[0], SUN[1], 60, T_GOLD, 0.45);
      // the orbits: fine dotted rings about the sun, fading at the frame's edge
      const orbit = (r, c) => { const n = Math.ceil(TAU * r * u * 0.5); for (let k = 0; k < n; k++) { const a = k / n * TAU, x = SUN[0] + Math.cos(a) * r, y = SUN[1] + Math.sin(a) * r, X = V.X(x), Y = V.Y(y); if (X < V.box[0] || X > V.box[2] || Y < Math.max(LB, V.box[1]) || Y > Math.min(H - 1 - LB, V.box[3])) continue; const f = edgeFade(x, y) * sstep(0.12, 0.5, u); if (f > 0.02 && bay(X, Y) < f * 0.8 && (k & 1)) P(X, Y, c); } };
      for (const Wd of WORLDS) orbit(Wd[0], 136);
      orbit(DPL, 137);
      // the asteroid belt, turning slowly
      for (const [r, a0, m] of BELT) { const a = a0 + zP(t, 1) * 0.05, x = SUN[0] + Math.cos(a) * r, y = SUN[1] + Math.sin(a) * r, X = V.X(x), Y = V.Y(y); if (X < V.box[0] || X > V.box[2] || Y < Math.max(LB, V.box[1]) || Y > Math.min(H - 1 - LB, V.box[3])) continue; if (bay(X, Y) < edgeFade(x, y) && m < u * 1.4 + 0.08) P(X, Y, m > 0.7 ? 122 : 121); }
      // the worlds, each lit from the sun's side
      for (const [r, a0, n, pr, cols, ringed] of WORLDS) {
        const a = a0 + zP(t, n), x = SUN[0] + Math.cos(a) * r, y = SUN[1] + Math.sin(a) * r, f = edgeFade(x, y);
        if (f < 0.05 || !V.vis(x - pr * 2.4, y - pr * 2.4, x + pr * 2.4, y + pr * 2.4)) continue;
        const lx = (SUN[0] - x) / Math.hypot(SUN[0] - x, SUN[1] - y), ly = (SUN[1] - y) / Math.hypot(SUN[0] - x, SUN[1] - y);
        const ringPx = (x2, y2, front) => { const dx = x2 - x, dy = y2 - y, ex = dx, ey = dy / 0.32, rr = Math.hypot(ex, ey) / pr; if (rr < 1.45 || rr > 2.25) return -1; if ((dy > 0) !== front) return -1; return rr > 2.0 ? 30 : rr > 1.7 ? 31 : 16; };
        if (ringed) V.each(x - pr * 2.3, y - pr, x + pr * 2.3, y + pr, (x2, y2) => ringPx(x2, y2, false));
        V.each(x - pr, y - pr, x + pr, y + pr, (x2, y2, X, Y) => {
          const nx = (x2 - x) / pr, ny = (y2 - y) / pr, r2 = nx * nx + ny * ny; if (r2 > 1) return -1;
          const nz = Math.sqrt(1 - r2), l = nx * lx * 0.9 + ny * ly * 0.9 + nz * 0.25, d = bay(X, Y);
          if (l < 0) return d < 0.15 ? cols[0] : 1;
          const band = ringed ? Math.sin(ny * 9 + Math.sin(nx * 3) * 0.6) * 0.5 : 0, v = l * 2.6 + band + d * 0.7;
          return v > 2.1 ? cols[2] : v > 1.1 ? cols[1] : cols[0];
        });
        if (ringed) V.each(x - pr * 2.3, y - pr, x + pr * 2.3, y + pr, (x2, y2) => ringPx(x2, y2, true));
      }
      // the snail's world: the same planet as L3 and L4, its crescent toward the sun
      gPlanet(V, 0, 8.75, 8.75, t, { glowW: 0.5, aur: 1 });
      // the sun: a white-hot disc in rings of gold, its corona's tongues turning, rays thinning out into the dark
      const [sx, sy, sr] = SUN;
      if (V.vis(sx - sr * 3, sy - sr * 3, sx + sr * 3, sy + sr * 3)) {
        V.each(sx - sr * 2.2, sy - sr * 2.2, sx + sr * 2.2, sy + sr * 2.2, (x, y, X, Y) => {
          const dx = x - sx, dy = y - sy, r = Math.hypot(dx, dy) / sr, an = Math.atan2(dy, dx), d = bay(X, Y);
          if (r < 0.62) return 22;
          if (r < 0.8) return d < (0.8 - r) * 5 ? 22 : 108;
          if (r < 0.92) return d < 0.5 ? 108 : 16;
          if (r < 1) return d < 0.5 ? 16 : 15;
          const tongue = 1 + 0.35 * Math.max(0, Math.sin(an * 7 + zP(t, 1)) * Math.sin(an * 3 - zP(t, 2))) + 0.15 * vn(an * 5 + zP(t, 1), 0, 1, 5504);
          if (r < tongue) { const e = (r - 1) / (tongue - 1); return e < 0.35 ? 15 : e < 0.7 ? (d < 0.6 ? 58 : 14) : (d < 0.45 ? 14 : -1); }
          return -1;
        });
        for (let k = 0; k < 12; k++) {
          const a = k / 12 * TAU + zP(t, 1) * 0.1, L = sr * (2.0 + 0.8 * Math.sin(zP(t, 2) + k * 1.7)), r0 = sr * 1.05, n = Math.ceil(V.S(L - r0) * 1.4);
          for (let m = 0; m <= n; m++) {
            const f = m / Math.max(1, n), rr = r0 + (L - r0) * f, X = fl(V.X(sx + Math.cos(a) * rr)), Y = fl(V.Y(sy + Math.sin(a) * rr));
            if (X < V.box[0] || X > V.box[2] || Y < Math.max(LB, V.box[1]) || Y > Math.min(H - 1 - LB, V.box[3]) || bay(X, Y) > 1.15 - f) continue;
            P(X, Y, f < 0.35 ? (k % 2 ? 16 : 15) : k % 2 ? 15 : 58);
          }
        }
      }
    }
    ZL[5] = { name: 'sun', draw: c5Draw };
  }
