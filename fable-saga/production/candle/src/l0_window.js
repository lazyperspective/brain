  /* ================================================================ L0 — the window: the candle and the little tree
     Seen from the street through the glass (L1 is the house around it). On the sill: a tall candle on the left, the hero,
     its flame breathing; in the middle a little Christmas tree whose topper is a gold star round a glowing orb — and in
     the orb, very small, the valley and its star of lights (L3). A dim room behind, warm where the candle reaches. Snow
     falls past the glass. */
  const ORB_R = 36;
  function orbMask(x, y) {
    const q = x * x + y * y; if (q > ORB_R * ORB_R) return 0;
    const r = Math.sqrt(q); let m = clamp((ORB_R - r) / 2, 0, 1);
    if (r > 27 && r < 32 && y < 0) { const a = Math.atan2(y, x); if (a > -2.6 && a < -1.9) m *= 0.4; }     // a highlight on the glass
    return m;
  }
  {
    const CAN = [-150, 30], TIERS = [[40, 28, 72], [60, 50, 106], [88, 74, 138], [118, 98, 162]];
    const treeHW = (x, y) => { let best = -1; for (let i = 0; i < 4; i++) { const y0 = TIERS[i][0], w = TIERS[i][1], y1 = TIERS[i][2]; if (y >= y0 && y <= y1) { const f = (y - y0) / (y1 - y0), e = w * f * (1 - 0.12 * (1 + Math.sin(x * 0.5 + y * 0.3)) * f); if (e > best) best = e; } } return best; };
    const LIGHTS = []; for (let k = 0; k < 46; k++) { const y = 46 + ih(k, 1, 1101) * 112, hw = Math.max(4, treeHW(0, y) - 4); LIGHTS.push([(ih(k, 2, 1101) * 2 - 1) * hw * 0.9, y, k % 4, ih(k, 3, 1101)]); }
    const LCOL = [[157, 158], [15, 16], [46, 47], [49, 50]], LT = [T_RED, T_GOLD, T_BL, T_GR];
    const TIPS = []; for (let i = 0; i < 5; i++) TIPS.push(-PI / 2 + i * TAU / 5);
    const R_WALL = [1, 27, 9, 10, 171, 172], R_GOLD = [173, 174, 175, 59, 16, 22];
    function c0Draw(V, t) {
      const ck = flick(t, 1.7), breathe = 1 + 0.04 * Math.sin(zP(t, 3));
      V.each(-330, -210, 330, 210, (x, y, X, Y) => {
        const d = bay(X, Y), qc = (x - CAN[0]) ** 2 + (y - CAN[1]) ** 2, Lc = lit(qc, 110) * ck, Lo = lit(x * x + y * y, 70) * 0.55, L = 0.05 + Lc * 0.7 + Lo * 0.35;
        // the topper: the orb's rim, its gold ring, its five gold points (the orb itself is the window to L3)
        if (x > -62 && x < 62 && y > -62 && y < 52) {
          const q = x * x + y * y;
          if (q < ORB_R * ORB_R) { const r = Math.sqrt(q); if (r > 27 && r < 32 && y < 0) { const a = Math.atan2(y, x); if (a > -2.6 && a < -1.9) return d < 0.5 ? 22 : 148; } return d < 0.3 ? 135 : 134; }
          const r = Math.sqrt(q);
          if (r < 40) return rp(R_GOLD, clamp(0.55 + (-x - y) / r * 0.25 + (r > 38.5 ? -0.2 : 0.1), 0, 1), d);
          const a = Math.atan2(y, x);
          for (let i = 0; i < 5; i++) { let da = a - TIPS[i]; da -= TAU * Math.round(da / TAU); const hw = 0.26 * (1 - (r - 39) / 21); if (r < 60 && Math.abs(da) < hw) return rp(R_GOLD, clamp(0.45 + (da > 0 ? 0.3 : -0.1) + Lc * 0.2, 0, 1), d); }
        }
        // the candle: its flame, the wax and its drips, the brass dish
        if (x > CAN[0] - 16 && x < CAN[0] + 16 && y > 6 && y < 180) {
          const fx = x - CAN[0], fy = y - CAN[1], sway = 1.2 * Math.sin(zP(t, 11)) * Math.max(0, -fy) / 12;
          if (fy > -14 * breathe && fy < 10) { const w = fy < 0 ? 4.2 * Math.sqrt(1 + fy / (14 * breathe)) : 4.2 * Math.sqrt(Math.max(0, 1 - fy / 10)); const e = Math.abs(fx - sway); if (e < w) return e < w * 0.42 && fy > -9 && fy < 6 ? 22 : fy > 5 ? (e < w * 0.5 ? 88 : 14) : e < w * 0.75 ? 16 : 15; }
          if (fy >= 10 && fy < 14 && Math.abs(fx) < 0.7) return 27;                                                   // the wick
          if (fy >= 14 && fy < 138 && Math.abs(fx) < 9) { const drip = fy < 24 + 10 * ih(fl(fx + 9), 1, 1102) && Math.abs(fx) > 6 ? 0.1 : 0, s = 0.9 - (fy - 14) * 0.004 + (fx < 0 ? 0.08 : -0.18) - Math.abs(fx) * 0.02 + drip; return rp(R_CREAM, clamp(s, 0, 1), d); }
          if (fy >= 138 && fy < 146 && Math.abs(fx) < 15 - (fy - 138) * 0.4) return rp(R_BRASS, fy < 140 ? 0.9 : 0.5 + (fx < 0 ? 0.2 : 0), d);
        }
        // the tree: needles, its pot
        if (x > -102 && x < 102 && y > 38 && y < 180) {
          const hw = treeHW(x, y); if (hw >= 0 && Math.abs(x) < hw) { const n = vn(x * 0.35, y * 0.35, 1, 1103), e = x / hw; return rp(R_PINE, clamp(0.15 + n * 0.35 - e * 0.15 + Lc * 0.3 + Lo * 0.25, 0, 1), d); }
          if (y >= 160 && Math.abs(x) < 24 - (y - 160) * 0.3) return rp(R_RED, clamp(0.3 + L * 0.6 - x * 0.006 + (y < 163 ? 0.15 : 0), 0, 1), d);
        }
        // the sill inside, and the room: a wall papered dark, warm where the candle reaches
        if (y > 168) return rp(R_WOOD, clamp(0.15 + L * 0.7 + (y < 171 ? 0.15 : 0), 0, 1), d);
        const pat = (Math.sin(x * 0.21) * Math.sin(y * 0.21) > 0.55) ? 0.06 : 0;
        return rp(R_WALL, clamp(L * 0.9 + pat, 0, 1), d);
      });
      for (const [x, y, k, ph] of LIGHTS) { const on = 0.5 + 0.5 * Math.sin(zP(t, 2 + (k % 3)) + ph * 9); if (V.u < 0.5) { P(V.X(x), V.Y(y), LCOL[k][on > 0.5 ? 1 : 0]); continue; } zDisc(V, x, y, 1.5, LCOL[k][on > 0.5 ? 1 : 0]); if (on > 0.7 && V.u > 0.7) zGlow(V, x, y, 5, LT[k], 0.22); }
      // light: the candle's glow, the topper's
      zGlow(V, CAN[0], CAN[1] - 2, 90, T_WARM, 0.36 * ck); zGlow(V, CAN[0], CAN[1] - 3, 26, T_GOLD, 0.5 * ck);
      zGlow(V, 0, 0, 70, T_GOLD, 0.22);
      zSnow(V, t, -330, -210, 330, 210, 6, 1104, 2, [136, 167, 168, 169, 170]);
    }
    ZL[0] = { name: 'window', draw: c0Draw, mask: orbMask, maskBox: [-36, -36, 36, 36], hole: [-20, -12, 24, 24] };
  }
