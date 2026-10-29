  /* ================================================================ Carry · L2 — the valley
     Pulled back from the meadow, we see its hill as a dark rounded brow in the middle distance (its top at y ≈ 2.5 by the
     window, where L1's brow is), sloping away to either side. Past it the land opens: on the right a river winding down
     out of the far hills, a village with warm windows on its bank; on the left a forest; far mountains on the horizon,
     which is the planet's curve (a circle of radius 4480 about (0, +4480)). In front of the hill, near us, dark grass and
     fireflies. Above: the night, the Milky Way rising out of the window, and the aurora in tall shimmering curtains. */
  {
    const C2R = 4480, yH = (x) => C2R - Math.sqrt(Math.max(0, C2R * C2R - x * x));      // the true horizon
    // the meadow hill's outline: level by the window (L1's brow), then falling away
    const yB = (x) => { const a = Math.max(0, Math.abs(x) - 30); return 2.55 + (Math.abs(x) - 30 > 0 ? 0.0011 * a * a : 0) + 0.12 * Math.sin(x * 0.4) * sstep(30, 60, Math.abs(x)); };
    // the far mountains: height above the horizon (only away from the window)
    const C2PK = []; for (let k = 0; k < 40; k++) C2PK.push([(ih(k, 1, 2202) - 0.5) * 900, 6 + ih(k, 2, 2202) * 20, 0.55 + ih(k, 3, 2202) * 0.5]);
    // the far mountains: overlapping peaks (a ridge of triangles with jagged slopes), only away from the window
    const mt = (x) => { let m = 2 + 2 * vn(x * 0.05, 0, 1, 2201); for (const [px, h, sl] of C2PK) { const v = h - Math.abs(x - px) * sl + 1.5 * (vn(x * 0.3, px, 1, 2203) - 0.5); if (v > m) m = v; } return sstep(45, 120, Math.abs(x)) * m; };
    // which side of its peak a mountain point faces (−1 lit, toward the aurora on the left; +1 in shadow)
    const mside = (x) => { let best = -1e9, sd = 1; for (const [px, h, sl] of C2PK) { const v = h - Math.abs(x - px) * sl; if (v > best) { best = v; sd = x < px ? -1 : 1; } } return sd; };
    // the river: a path down the valley on the right, as [x, y, width] points
    const RIV = [[64, 0.3, 0.6], [92, 2.5, 1.0], [130, 5, 1.6], [170, 7.5, 2.3], [210, 11, 3.4], [250, 16, 4.6], [300, 24, 6.4], [360, 36, 8.5], [430, 54, 11]];
    function c2River(x, y) {
      let best = 1e9, w = 0;
      for (let i = 0; i + 1 < RIV.length; i++) {
        const [ax, ay, aw] = RIV[i], [bx, by, bw] = RIV[i + 1], dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy, q = clamp(((x - ax) * dx + (y - ay) * dy) / L2, 0, 1);
        const px = ax + dx * q + Math.sin(q * PI * 2 + i) * 6, py = ay + dy * q, d = Math.hypot(x - px, (y - py) * 3);
        if (d < best) { best = d; w = lerp(aw, bw, q); }
      }
      return best / w;                                      // < 1 inside
    }
    // the village: houses on the river bank (x, y, w, h, window seed)
    const HOUSES = [];
    for (let k = 0; k < 26; k++) { const x = 168 + ih(k, 1, 2210) * 62, y = 13 + ih(k, 2, 2210) * 9 + (x - 168) * 0.06; HOUSES.push([x, y, 1.6 + ih(k, 3, 2210) * 2.2, 1.2 + ih(k, 4, 2210) * 1.4, k]); }
    HOUSES.sort((a, b) => a[1] - b[1]);
    const TREES = []; for (let k = 0; k < 220; k++) { const x = -250 + ih(k, 1, 2220) * 200, y = 3 + Math.max(0, (-x - 50)) * 0.06 + ih(k, 2, 2220) * 14; TREES.push([x, y, 1.6 + ih(k, 3, 2220) * 2.6 + y * 0.04]); }
    TREES.sort((a, b) => a[1] - b[1]);
    const FLIES = []; for (let k = 0; k < 90; k++) FLIES.push([(ih(k, 1, 2230) - 0.5) * 620, 4 + Math.pow(ih(k, 2, 2230), 1.6) * 140, ih(k, 3, 2230), 1 + fl(ih(k, 4, 2230) * 3)]);
    // L1's meadow, measured: its brightness by depth below the brow (L2 units), and a dither between two greens to match it
    const C2LD = [[0.5, 56], [1.5, 45], [3, 32], [4.5, 21], [6, 15], [7.5, 12], [9, 10], [11, 9], [40, 8], [90, 5]];
    const c2Lum = (dep) => { if (dep <= C2LD[0][0]) return C2LD[0][1]; for (let i = 1; i < C2LD.length; i++) if (dep < C2LD[i][0]) { const [a0, l0] = C2LD[i - 1], [a1, l1] = C2LD[i]; return lerp(l0, l1, (dep - a0) / (a1 - a0)); } return 5; };
    const C2G = [[0, 0], [1, 7], [23, 25], [24, 43], [141, 57], [142, 83]];
    // tables: the dither pair for each depth, a tenth of a unit apart
    const C2TA = new Uint8Array(1000), C2TB = new Uint8Array(1000), C2TF = new Float32Array(1000);
    function c2Pair(L) { for (let i = 1; i < C2G.length; i++) if (L <= C2G[i][1]) { const [a, la] = C2G[i - 1], [b, lb] = C2G[i]; return [a, b, (L - la) / (lb - la)]; } return [142, 142, 0]; }
    for (let i = 0; i < 1000; i++) { const dep = i / 10, pr = c2Pair(dep < 0.5 ? 64 : c2Lum(dep)); C2TA[i] = pr[0]; C2TB[i] = pr[1]; C2TF[i] = pr[2]; }
    function c2Draw(V, t) {
      const u = V.u, [X0, Y0, X1, Y1] = V.box, a1 = zP(t, 1), a2 = zP(t, 2), Yt = Math.max(Y0, LB), Yb = Math.min(Y1, H - 1 - LB);
      for (let X = X0; X <= X1; X++) {
        const x = V.lx(X), h = yH(x), b = yB(x), m = h - mt(x);
        // the aurora's shape in this column: a ribbon whose lower edge waves, folded into fine vertical rays
        const fold = x + 26 * Math.sin(x / 95 + a1) + 9 * Math.sin(x / 29 - a2);
        const bot = -30 + 9 * Math.sin(x / 80 + a1) - 5 * Math.sin(x / 26 + a2) - 0.05 * Math.max(0, -x - 60);
        const env = (0.55 + 0.45 * Math.sin(x / 130 + 0.6 + a1 * 0.5)) * (1 - sstep(120, 300, x)) * sstep(-460, -300, x);
        const rays = 0.55 + 0.45 * Math.sin(fold * 0.55) * Math.sin(fold * 0.23 + 1.3), aur = env * rays;
        // where the Milky Way crosses this column (it rises out of the window up to the left): its centre y and half-width
        const mwY = (x - 26) / 0.89, mwW = 10 + 0.42 * Math.max(0, -mwY), msd = mside(x) < 0;
        for (let Y = Yt; Y <= Yb; Y++) {
          const y = V.ly(Y), d = bay(X, Y);
          let c;
          if (y < m && y < b) {
            // the sky: a quick glow at the horizon (as L1 has it), then deep night, deepening upward
            c = y > -1.6 ? 136 : y > -6 ? (d < (y + 6) / 4.4 ? 136 : 135) : y > -11 ? (d < (y + 11) / 5 ? 135 : 134) : y > -150 ? 134 : (d < 0.5 ? 134 : 2);
            if (y < 0) {
              const k = 1 - Math.abs(y - mwY) * 0.89 / mwW;
              if (k > 0) { const n = vn(x * 0.06, y * 0.06, 1, 2240) * 0.8 + d * 0.2, e = Math.pow(k, 1.4) * (0.22 + n) * (0.8 + 0.2 * sstep(-60, -10, y)); if (e > 1.15 + d * 0.25) c = 56; else if (e > 0.72 + d * 0.3) c = 55; else if (e > 0.42 + d * 0.35) c = 4; else if (e > 0.18 + d * 0.3) c = 136; if (e > 0.3 && ih(fl(x * 1.5), fl(y * 1.5), 2247) < 0.05 * e) c = e > 0.7 ? 22 : 20; if (Math.abs(y - mwY - mwW * 0.3 * (n - 0.3)) * 0.89 < 0.6 * (0.5 + n) && k > 0.5 && d < 0.6) c = 134; }
              const hg = bot - y;
              if (hg > 0 && aur > 0.05) {
                const I = aur * Math.exp(-hg / 26) * (hg < 2.5 ? hg / 2.5 : 1) * (0.32 + 0.68 * sstep(28, 80, Math.sqrt(x * x + y * y)));
                if (I > 0.62 + d * 0.25) c = hg < 10 ? 49 : 147; else if (I > 0.4 + d * 0.25) c = hg < 14 ? 48 : 61; else if (I > 0.22 + d * 0.22) c = hg < 20 ? 125 : 117; else if (I > 0.1 + d * 0.18) c = hg < 26 ? 124 : 116;
              }
            }
          } else if (y < b && y < h) {
            // the far mountains, dark; snow on the high ones, lit cyan along their edges by the aurora
            const top = y - m, hm = h - m, lit = msd;
            c = lit ? (d < 0.5 ? 135 : 134) : (d < 0.6 ? 2 : 134);
            if (hm > 11 && top < (hm - 11) * 0.7 + 0.6 * vn(x * 0.4, y * 0.4, 1, 2204)) c = lit ? (d < 0.55 ? 138 : 137) : (d < 0.5 ? 136 : 135);   // snow on the high peaks
            if (top < 0.6 / Math.max(0.3, u) && lit) c = 137;
            if (y > h - 2.5) c = d < 0.5 ? 135 : 134;
          } else if (y < b) {
            // the land past the hill: the valley floor, darker nearer, fields; the river; distance haze at the horizon
            const near = clamp((y - h) / 70, 0, 1), hz = clamp((y - h) / 5, 0, 1);
            c = hz < 0.5 + (d - 0.5) * 0.6 ? 135 : near < 0.25 ? (d < 0.35 ? 140 : 139) : near < 0.6 ? (d < 0.3 ? 139 : 24) : (d < 0.5 ? 24 : 23);
            if (near > 0.08 && vn(x * 0.07, y * 0.35, 1, 2242) > 0.7) c = near < 0.4 ? 140 : 139;
            if (x > 50 && c2River(x, y) < 1) { const sw = Math.sin(x * 0.7 + y * 3 + a2 * 2) + Math.sin(x * 0.23 - a1); c = sw > 1.3 ? 61 : sw > 0.6 ? 147 : sw > -0.3 ? 137 : 117; }
          } else {
            // the hill: a faint lit brow, then the dark of its face (as dark as L1's ground below its brow), black nearer
            const dep = y - b;
            // the brightness L1's meadow has at this depth below its brow (measured), dithered between two greens; blades of
            // grass as short vertical strokes a little brighter, sparser nearer us
            const di = Math.min(999, fl(dep * 10));
            c = d < C2TF[di] ? C2TB[di] : C2TA[di];
            const cw = dep < 22 ? 0.5 : 1.1, bx = fl(x / cw), ch = dep < 22 ? 2 : 4, o2 = ih(bx, 7, 2245) * ch, by = fl((y + o2) / ch), g = ih(bx, by, 2243), fy = frac((y + o2) / ch);
            if (dep > 0.6 && g < (dep < 14 ? 0.22 : 0.08 * Math.max(0, 1 - dep / 90))) c = dep < 2.5 ? (fy < 0.4 ? 142 : 141) : dep < 5 ? (fy < 0.4 ? 141 : 140) : dep < 10 ? (fy < 0.4 ? 140 : 139) : (fy < 0.4 ? 139 : 23);
          }
          BUF[Y * W + X] = c;
        }
      }
      // the brow's grass fringe against the sky: fine dark blades along the hill's outline
      if (u > 1.6) for (let X = X0; X <= X1; X++) { const x = V.lx(X), b = yB(x), k = fl(x * 3); if (ih(k, 1, 2244) > 0.55) continue; const hh = (0.4 + ih(k, 2, 2244) * 0.9) * (1 + 0.15 * Math.sin(zP(t, 1) + x)); const Yb = fl(V.Y(b)), Yt2 = fl(V.Y(b - hh)); for (let Y = Math.max(LB, Yt2); Y < Math.min(H - LB, Yb); Y++) BUF[Y * W + X] = ih(k, 3, 2244) < 0.4 ? 139 : 24; }
      // stars in the sky (behind nothing but the sky: drawn only where the sky is)
      zStars(V, t, -420, -420, 420, 0, 0.9 * Math.min(1, 1 / u + 0.15), 2250, [136, 19, 20, 21, 22]);
      for (let X = X0; X <= X1; X++) { const x = V.lx(X), lim = Math.min(yH(x) - mt(x), yB(x)); for (let Y = Math.max(LB, fl(V.Y(lim))); Y <= Math.min(Y1, H - 1 - LB); Y++) { const c = BUF[Y * W + X]; if (c >= 19 && c <= 22 && V.ly(Y) >= lim) BUF[Y * W + X] = 139; } }
      // the forest on the left: conifers, far to near
      for (const [x, y, s] of TREES) {
        if (y > yB(x) - 0.2 || !V.vis(x - s, y - s * 3, x + s, y)) continue;
        const S = V.S(s); if (S < 0.4) continue;
        const bx = V.X(x), by = V.Y(y);
        if (S < 1.5) { P(bx, by - 1, 1); P(bx, by - 2, 1); continue; }
        for (let k = 0; k < S * 3; k++) { const w = (k / (S * 3)) * S * 0.9; for (let i = -w; i <= w; i++) P(bx + i, by - S * 3 + k, k < 2 ? 139 : i < -w * 0.4 ? 24 : 1); }
      }
      // the village: small dark houses, warm windows flickering, a few lamps on the bank
      for (const [x, y, w, h, s] of HOUSES) {
        if (!V.vis(x - w, y - h * 2, x + w, y)) continue;
        const S = V.S(1);
        if (S * w < 1.2) { P(V.X(x), V.Y(y), ih(s, 1, 2211) < 0.6 ? 144 : 145); continue; }
        rectF(V.X(x - w / 2), V.Y(y - h), V.S(w), V.S(h), 2);
        z5Tri(V.X(x - w / 2 - 0.2), V.Y(y - h), V.X(x + w / 2 + 0.2), V.Y(y - h), V.X(x), V.Y(y - h - w * 0.55), 1);
        const lit = 0.5 + 0.5 * Math.sin(zP(t, 1 + (s % 3)) + s * 2.1) > 0.18;
        if (lit) { const wx = V.X(x - w * 0.2), wy = V.Y(y - h * 0.55), ws = Math.max(1, V.S(0.5)); rectF(wx, wy, ws, ws, s % 4 ? 144 : 145); if (u > 0.8) glow(wx, wy, Math.max(2, V.S(1.6)), T_WARM, 0.3); }
      }
      // fireflies over the hill and the near grass
      for (const [x, y, ph, n] of FLIES) {
        if (y < yB(x) + 0.5) continue;
        const fx = x + 4 * Math.sin(zP(t, n) + ph * 9), fy = y + 2 * Math.sin(zP(t, n + 1) + ph * 5), on = 0.5 + 0.5 * Math.sin(zP(t, n * 2) + ph * 11);
        if (on < 0.35 || !V.vis(fx, fy, fx, fy)) continue;
        const X = V.X(fx), Y = V.Y(fy), nearF = clamp(fy / 100, 0, 1); P(X, Y, on > 0.8 ? 53 : 52); if (nearF > 0.4 && V.u > 0.6) { P(X + 1, Y, 52); P(X, Y + 1, 52); } if (V.u * (0.5 + nearF) > 0.8) glow(X, Y, 2 + V.u * (1 + 2 * nearF), T_YE, 0.28 * on);
      }
      // the near grass at the bottom edge: a dark fringe of tapered blades swaying, cut out against the hill
      if (u < 2.2) for (let k = 0; k < 160; k++) {
        const x = (ih(k, 1, 2260) - 0.5) * 840, hh = 6 + ih(k, 2, 2260) * 14, sway = (ih(k, 3, 2260) - 0.5) * 4 + 1.5 * Math.sin(zP(t, 1) + x * 0.02), y0 = 128 + ih(k, 4, 2260) * 12;
        if (!V.vis(x - 6, y0 - hh, x + 6, y0)) continue;
        const n = Math.max(2, Math.ceil(V.S(hh)));
        for (let q = 0; q < n; q++) { const f = q / n, wd = Math.max(1, V.S(1.3 * (1 - f))), px = V.X(x + sway * f * f), py = V.Y(y0 - hh * f); for (let w = 0; w < wd; w++) P(px + w, py, f > 0.8 ? (k % 3 ? 24 : 139) : f > 0.5 ? 23 : 1); }
      }
    }
    ZL[2] = { name: 'valley', draw: c2Draw };
  }
