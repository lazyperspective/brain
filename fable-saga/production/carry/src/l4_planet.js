  /* ================================================================ Carry · L4 — the planet
     The whole world in space: the same texture as L3 (g_planet), its disc 70 in radius about (0, +70), so its north limb —
     the snail's — runs through the window. A thin crescent of day on the lower left (the sun is behind it, to the left),
     the night side strung with cities, the aurora's oval about the tipped north pole and its curtains standing on the limb
     over the window, the atmosphere's blue (L3's, self-similar) along the limb, a grey moon to the right, the Milky Way
     (L3's band, continued), and stars. */
  {
    const R4 = 70, CY4 = 70, MOON = [158, 22, 10];
    function c4Draw(V, t) {
      const u = V.u, [X0, Y0, X1, Y1] = V.box, a1 = zP(t, 1), a2 = zP(t, 2), Yt = Math.max(Y0, LB), Yb = Math.min(Y1, H - 1 - LB);
      for (let X = X0; X <= X1; X++) {
        const x = V.lx(X), hc = V.hole && X >= V.hole[0] && X <= V.hole[2];
        for (let Y = Yt; Y <= Yb; Y++) {
          if (hc && Y >= V.hole[1] && Y <= V.hole[3]) { Y = V.hole[3]; continue; }
          const y = V.ly(Y), dy = y - CY4, hgt = Math.sqrt(x * x + dy * dy) - R4;
          if (hgt <= 0) continue;
          const d = bay(X, Y), up = -dy / Math.sqrt(x * x + dy * dy);        // 1 over the north limb, −1 under the south
          // space, and the atmosphere's blue along the night limb (L3's sky, eight times smaller), warm where the sun is
          let c = d < 0.12 ? 1 : 0;
          const sunw = (x * GP_S[0] + dy * GP_S[1]) / (hgt + R4);
          if (sunw > 0.25) { if (hgt < 1.2 && d < (1.2 - hgt) / 1.2) c = hgt < 0.4 ? 148 : 147; }
          else c = hgt < 3.25 ? 134 : hgt < 5.75 ? (d < (5.75 - hgt) / 2.5 ? 134 : 2) : hgt < 8.75 ? (d < (8.75 - hgt) / 3 ? 2 : 1) : c;
          // the Milky Way (L3's, continued up to the left, and fading out: from out here it is no longer a band across the sky)
          if (y < 0) {
            const xc = 0.406 + 0.89 * y, hw = 0.156 + 0.42 * -y, k = 1 - Math.abs(x - xc) / hw;
            if (k > 0) { const n = vn(x * 3.8, y * 3.8, 1, 2240) * 0.8 + d * 0.2, e = Math.pow(k, 1.4) * (0.22 + n) * (0.8 + 0.2 * sstep(-7.5, -1.25, y)) * (1 - 0.6 * sstep(10, 25, hgt)) * (1 - sstep(8.75, 28.75, -y)); if (e > 1.15 + d * 0.25) c = 56; else if (e > 0.72 + d * 0.3) c = 55; else if (e > 0.42 + d * 0.35) c = 4; else if (e > 0.18 + d * 0.3 && c < 2) c = 136; }
          }
          // the aurora's curtains standing on the north limb (L3's, small now)
          if (up > 0.8 && hgt > 0.33 && hgt < 5.7) {
            const s = R4 * Math.atan2(x, -dy), fold = s * 64 + 26 * Math.sin(s * 0.67 + a1) + 9 * Math.sin(s * 2.2 - a2);
            const bot = 0.47 + 0.14 * Math.sin(s * 0.8 + a1), hg = hgt - bot;
            if (hg > 0 && hg < 5) {
              const env = (0.55 + 0.45 * Math.sin(s * 0.5 + 0.6 + a1 * 0.5)) * Math.exp(-Math.pow(Math.max(0, Math.abs(s) - 3.75) / 20, 2));
              const I = env * zAur(fold, hg * 64);
              if (I > 0.62 + d * 0.25) c = hg < 0.16 ? 49 : hg < 0.47 ? 48 : 126; else if (I > 0.4 + d * 0.25) c = hg < 0.22 ? 48 : hg < 0.62 ? 126 : 125; else if (I > 0.22 + d * 0.22) c = 125; else if (I > 0.1 + d * 0.18) c = 124;
            }
          }
          BUF[Y * W + X] = c;
        }
      }
      zStars(V, t, -420, -420, 420, 420, 4.5, 4401, [136, 19, 20, 21, 22]);
      // the world
      gPlanet(V, 0, CY4, R4, t, { glowW: 0.6, aur: 1, detail: clamp(u - 1.2, 0, 2) * 0.5, darkAt: [0, 2.25, 7] });
      // the moon: a small grey world, lit from behind and to the left (a crescent), cratered
      const [mx, my, mr] = MOON;
      if (V.vis(mx - mr, my - mr, mx + mr, my + mr)) {
        V.each(mx - mr, my - mr, mx + mr, my + mr, (x, y, X, Y) => {
          const nx = (x - mx) / mr, ny = (y - my) / mr, r2 = nx * nx + ny * ny; if (r2 > 1) return -1;
          const nz = Math.sqrt(1 - r2), l = nx * GP_S[0] + ny * GP_S[1] + nz * GP_S[2], cr = vn(nx * 6 + 9, ny * 6, 1, 4402), d = bay(X, Y);
          if (l < 0) return r2 > 0.9 ? 1 : (cr > 0.62 && d < 0.3 ? 2 : 1);              // earthshine on the dark side
          const v = l * 3.2 + (cr > 0.6 ? -0.8 : 0) + d * 0.7;
          return v > 2.4 ? 22 : v > 1.6 ? 21 : v > 0.9 ? 20 : v > 0.4 ? 19 : 18;
        });
      }
    }
    ZL[4] = { name: 'planet', draw: c4Draw };
  }
