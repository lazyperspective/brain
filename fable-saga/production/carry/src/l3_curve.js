  /* ================================================================ Carry · L3 — the curve of the world
     High above the north of the world at night. The limb runs through the window (a circle of radius 560 about (0, +560)),
     curving away to either side. Above it: the valley's sky, the deep blue of the atmosphere seen edge-on, thinning into
     space; the aurora's curtains standing along the limb, brightest over the snail's valley; the Milky Way rising out of
     the window up to the left (the same band L2 has, self-similar); stars. Below it: the night side of the planet (the
     shared texture of g_planet), its cities, its clouds, its ice. */
  {
    const R3 = 560, CY3 = 560;
    function c3Draw(V, t) {
      const u = V.u, [X0, Y0, X1, Y1] = V.box, a1 = zP(t, 1), a2 = zP(t, 2), Yt = Math.max(Y0, LB), Yb = Math.min(Y1, H - 1 - LB);
      for (let X = X0; X <= X1; X++) {
        const x = V.lx(X);
        const hc = V.hole && X >= V.hole[0] && X <= V.hole[2];
        for (let Y = Yt; Y <= Yb; Y++) {
          if (hc && Y >= V.hole[1] && Y <= V.hole[3]) { Y = V.hole[3]; continue; }
          const y = V.ly(Y), dy = y - CY3, rr = Math.sqrt(x * x + dy * dy), hgt = rr - R3;
          if (hgt <= 0) continue;                                  // the planet (drawn below)
          const d = bay(X, Y);
          // the sky seen through the atmosphere's edge: L2's blues near the limb, thinning to black space
          let c = hgt < 0.25 ? 136 : hgt < 0.8 ? (d < 0.5 ? 136 : 135) : hgt < 1.6 ? (d < (1.6 - hgt) / 0.8 ? 135 : 134) : hgt < 26 ? 134 : hgt < 46 ? (d < (46 - hgt) / 20 ? 134 : 2) : hgt < 70 ? (d < (70 - hgt) / 24 ? 2 : 1) : (d < 0.15 ? 1 : 0);
          // the Milky Way, rising out of the window to the upper left (L2's band, eight times smaller)
          if (y < 0) {
            const xc = 3.25 + 0.89 * y, hw = 1.25 + 0.42 * -y, k = 1 - Math.abs(x - xc) / hw;
            if (k > 0) { const n = vn(x * 0.48, y * 0.48, 1, 2240) * 0.8 + d * 0.2, e = Math.pow(k, 1.4) * (0.22 + n) * (0.8 + 0.2 * sstep(-60, -10, y)) * (1 - 0.6 * sstep(80, 200, hgt)) * (1 - sstep(70, 230, -y)); if (e > 1.15 + d * 0.25) c = 56; else if (e > 0.72 + d * 0.3) c = 55; else if (e > 0.42 + d * 0.35) c = 4; else if (e > 0.18 + d * 0.3 && c !== 0) c = 136; if (e > 0.3 && ih(fl(x * 12), fl(y * 12), 2247) < 0.05 * e) c = e > 0.7 ? 22 : 20; }
          }
          // the aurora: curtains standing on the limb, their foot ~4 units up, rays folded and waving
          if (hgt > 2.1 && hgt < 46) {                              // (the curtains' foot is never lower than 2.1)
            const s = R3 * Math.atan2(x, CY3 - y), fold = s * 8 + 26 * Math.sin(s / 12 + a1) + 9 * Math.sin(s / 3.6 - a2);
            const bot = 3.8 + 1.1 * Math.sin(s / 10 + a1) - 0.6 * Math.sin(s / 3.2 + a2), hg = hgt - bot;
            if (hg > 0 && hg < 40) {
              const env = (0.55 + 0.45 * Math.sin(s / 16 + 0.6 + a1 * 0.5)) * Math.exp(-Math.pow(Math.max(0, Math.abs(s) - 30) / 160, 2));
              const I = env * zAur(fold, hg * 8) * (hg < 0.35 ? hg / 0.35 : 1);
              if (I > 0.62 + d * 0.25) c = hg < 1.25 ? 49 : hg < 3.75 ? 48 : 126; else if (I > 0.4 + d * 0.25) c = hg < 1.75 ? 48 : hg < 5 ? 126 : 125; else if (I > 0.22 + d * 0.22) c = hg < 2.5 ? 125 : 117; else if (I > 0.1 + d * 0.18) c = hg < 3.2 ? 124 : 116;
            }
          }
          BUF[Y * W + X] = c;
        }
      }
      // stars, only where it is dark enough (above the atmosphere's blue)
      zStars(V, t, -420, -420, 420, 60, 5, 3301, [136, 19, 20, 21, 22]);
      // the planet itself
      gPlanet(V, 0, CY3, R3, t, { glowW: 0.9, aur: 0, detail: clamp(u - 0.8, 0, 2) * 0.6, darkAt: [0, 18, 56] });
    }
    ZL[3] = { name: 'curve', draw: c3Draw };
  }
