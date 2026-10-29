  /* ================================================================ L3 — the village, inside the cabin's snow globe
     A snowy square at night under the moon. In the middle the toy shop, painted green, its roof deep in snow, a chimney
     smoking, lights along the eave, a gold-lettered sign, lanterns either side, a red door with a wreath, and its wide
     window glowing (the window to L2, the workshop). Cottages either side with lit windows; a street lamp; a snowman; a
     frozen pond with two skaters going round. Snow falls over all of it. */
  {
    const MOON = [-100, -94, 11];
    const roofIn = (x, y, cx, peak, base, hw) => y > peak + Math.abs(x - cx) * ((base - peak) / hw) && y <= base;
    const HOUSES = [[-262, -104, -34, -183, -104, 92, [[-230, -206], [-160, -136]], -14], [104, 264, -28, 184, -98, 94, [[130, 154], [206, 230]], -10],
      [-360, -262, -20, -311, -70, 56, [[-326, -306]], -4], [264, 360, -16, 312, -66, 56, [[298, 318]], 0]];
    const SIGN = 'TOYS', SIGN_SC = 1.8, SIGN_X = -textW(SIGN, SIGN_SC) / 2;
    function c3Draw(V, t) {
      const lampK = flick(t, 2.1);
      V.each(-360, -300, 360, 300, (x, y, X, Y) => {
        const d = bay(X, Y), qw = x * x + (y - 28) * (y - 28), Lw = lit(qw, 70) * 0.8, Ll = lit((x + 112) ** 2 + (y + 44) ** 2, 40) * lampK;
        // the snowman (in front of the left cottage)
        if (x > -170 && x < -130 && y > 34 && y < 86) { const q1 = (x + 150) ** 2 + (y - 72) ** 2, q2 = (x + 150) ** 2 + (y - 55) ** 2, q3 = (x + 150) ** 2 + (y - 42) ** 2;
          if (q3 < 36 && Math.abs(y - 41) < 0.8 && (Math.abs(x + 152) < 0.8 || Math.abs(x + 148) < 0.8)) return 1;
          if (y > 42 && y < 44 && x > -150 && x < -150 + 6 - (y - 42) * 2) return 146;                       // the carrot
          if (y > 46.5 && y < 49.5 && Math.abs(x + 150) < 6.5) return rp(R_RED, 0.6 - (x + 150) * 0.03, d);    // the scarf
          if (y > 48 && y < 58 && x > -146 && x < -142 && y < 49.5 + (x + 146) * 2) return rp(R_RED, 0.4, d);
          if (q1 < 169 || q2 < 81 || q3 < 36) { const nx = x + 150 + 4, s = 0.75 - nx * 0.02 - (y - 40) * 0.004; return rp(R_SNOW, clamp(s, 0.2, 1), d); }
          if (Math.abs((x + 150) + (y - 55) * 1.4 + 22) < 0.8 && x < -158 && x > -168) return 28;              // twig arms
          if (Math.abs((x + 150) - (y - 55) * 1.4 - 22) < 0.8 && x > -142 && x < -132) return 28; }
        // the street lamp
        if (x > -114 && x < -110 && y > -36 && y < 50) return d < 0.3 ? 40 : 39;
        if (x > -119 && x < -105 && y > -52 && y < -36) { if (y < -49 || y > -39 || Math.abs(x + 112) > 5) return 40; return rp(R_FIRE, 0.75 + 0.15 * lampK, d); }
        // the toy shop: sign, window, door, lanterns, wall, roof, chimney
        if (Math.abs(x) < 46 && y > -50 && y < -34) {
          if (Math.abs(x) > 44 || y < -48.5 || y > -35.5) return rp(R_BRASS, 0.6, d);
          if (glyphAt(SIGN, x, y, SIGN_X, -48.5, SIGN_SC)) return rp(R_BRASS, 0.85 + (y < -44 ? 0.1 : 0), d);
          return rp(R_WOOD, 0.2, d);
        }
        if (Math.abs(x) < 41 && Math.abs(y) < 27) {
          if (Math.abs(x) < 36 && Math.abs(y) < 22) { const s = 0.55 + 0.25 * Math.sin(x * 0.2) * Math.sin(y * 0.3); return rp(R_FIRE, s, d); }   // (the glass, glowing; L2 shows through)
          if (y < -22 && y > -27) return rp(R_SNOW, 0.8, d);                                                   // snow on the frame's top
          if (Math.abs(x) < 37.2 || Math.abs(y) < 23.2) return rp(R_BRASS, 0.75, d);
          return rp(R_RED, clamp(0.45 + Lw * 0.4 - (x > 0 ? 0.1 : 0), 0, 1), d);
        }
        if (Math.abs(x) < 46 && y >= 27 && y < 32) return y < 29 + Math.sin(x * 0.5) ? rp(R_SNOW, 0.85, d) : rp(R_RED, 0.3, d);     // the sill, snowed on
        if (x > 52 && x < 80 && y > -22 && y < 50) {
          const wq = (x - 66) ** 2 + (y + 6) ** 2;
          if (wq < 64 && wq > 20) return (x > 62 && x < 70 && y > 0 && y < 5) ? rp(R_RED, 0.7, d) : rp(R_PINE, 0.45 + (x < 66 ? 0.2 : 0), d);
          if (x > 76 && x < 78 && y > 14 && y < 20) return rp(R_BRASS, 0.8, d);
          const panel = (Math.abs(x - 59) < 4 || Math.abs(x - 73) < 4) && ((y > 6 && y < 22) || (y > 28 && y < 44));
          return rp(R_RED, clamp(0.3 + (panel ? -0.1 : 0.05) + Lw * 0.2, 0, 1), d);
        }
        for (const sx of [-54, 54]) if (Math.abs(x - sx) < 4 && y > -44 && y < -32) return Math.abs(y + 38) < 4 && Math.abs(x - sx) < 2.5 ? 16 : 174;
        if (x > 46 && x < 62 && y > -146 && y < -100) { if (y < -140) return rp(R_SNOW, 0.8, d); const br = ((y + 146) % 6 < 0.8) || ((x + (fl((y + 146) / 6) % 2) * 4) % 8 < 0.8); return br ? 121 : rp(R_RED, 0.25, d); }
        if (roofIn(x, y, 0, -150, -66, 112)) { const e = y - (-150 + Math.abs(x) * (84 / 112)); if (y > -70) return 1; return rp(R_SNOW, clamp(0.55 + (x < 0 ? 0.18 : -0.05) - (e > 60 ? 0.1 : 0) + 0.06 * Math.sin(x * 0.3), 0, 1), d); }
        if (Math.abs(x) < 96 && y >= -66 && y < 50) {
          if (y < -61) { const on = Math.sin(x * 0.8) > 0.6; return on ? ((fl(x / 4) & 1) ? 16 : 157) : 150; }   // the eave's garland and lights
          const board = (x + 200) % 8 < 0.8; return board ? 149 : rp(R_PINE, clamp(0.15 + Lw * 0.55 + Ll * 0.2 + ih(fl((x + 200) / 8), 3, 701) * 0.12, 0, 1), d);
        }
        // the cottages either side
        for (const [hx0, hx1, wy, rcx, rpk, rhw, wins, wwy] of HOUSES) {
          if (roofIn(x, y, rcx, rpk, wy, rhw)) return y > wy - 3 ? 1 : rp(R_SNOW, clamp(0.5 + (x < rcx ? 0.15 : -0.05), 0, 1), d);
          if (x >= hx0 && x < hx1 && y >= wy && y < 50) {
            for (const [a, b] of wins) if (x >= a && x < b && y >= wwy && y < wwy + 24) { const mx = (a + b) / 2; if (Math.abs(x - mx) < 1 || Math.abs(y - wwy - 12) < 1) return 159; return rp(R_FIRE, 0.55 + 0.15 * Math.sin(x * 0.3 + y * 0.2), d); }
            if (y >= wwy + 24 && y < wwy + 27) for (const [a, b] of wins) if (x >= a - 2 && x < b + 2) return rp(R_SNOW, 0.8, d);
            const tim = ((x - hx0) % 22 < 2) || (y - wy) % 26 < 2; return tim ? 160 : rp(R_STONE, clamp(0.18 + Ll * 0.3 + Lw * 0.15 + 0.05 * Math.sin(x * 0.7 + y), 0, 1), d);
          }
        }
        // the ground: snow, warm under the shop window, with the pond and its ice
        if (y >= 50 + 1.5 * Math.sin(x * 0.04)) {
          const pq = ((x - 112) / 72) ** 2 + ((y - 88) / 13) ** 2;
          if (pq < 1) { const gl = Math.sin(x * 0.15 - y * 0.6) > 0.85 ? 0.25 : 0; return rp([135, 136, 137, 138, 167, 168], clamp(0.45 + gl + Lw * 0.3 - pq * 0.25, 0, 1), d); }
          const sp = ih(fl(x * 2), fl(y * 2), 702) > 0.997 && Math.sin(zP(t, 3) + x) > 0 ? 22 : -1; if (sp >= 0) return sp;
          return rp(R_SNOW, clamp(0.42 + 0.08 * vn(x * 0.05, y * 0.1, 1, 703) + Lw * 0.35 + Ll * 0.2 - Math.max(0, y - 120) * 0.0015, 0, 1), d);
        }
        // the hills and the sky, the moon
        if (y > -6 + 10 * Math.sin(x * 0.012 + 1) + 5 * Math.sin(x * 0.031)) return rp(R_SNOW, 0.25 + 0.05 * Math.sin(x * 0.05), d);
        const mq = (x - MOON[0]) ** 2 + (y - MOON[1]) ** 2;
        if (mq < MOON[2] * MOON[2]) { const cr = vn(x * 0.4, y * 0.4, 1, 704) > 0.62 ? -0.15 : 0; return rp([168, 169, 170, 22], clamp(0.8 - (x - MOON[0]) * 0.02 + cr, 0, 1), d); }
        return rp(R_NIGHT, clamp(0.85 + y / 260, 0, 1), d);
      });
      zStars(V, t, -360, -300, 360, -10, 5, 705, [135, 136, 168, 169, 22], (x, y) => y < -6 + 10 * Math.sin(x * 0.012 + 1) + 5 * Math.sin(x * 0.031) - 2 && !HOUSES.some(([a, b, wy, rcx, rpk, rhw]) => y > rpk + Math.abs(x - rcx) * ((wy - rpk) / rhw)) && !(y > -150 + Math.abs(x) * (84 / 112)));
      // the skaters, going round the pond (leaning into the turn)
      for (let k = 0; k < 2; k++) {
        const a = zP(t, 1) + k * PI, sx = 112 + Math.cos(a) * 50, sy = 86 + Math.sin(a) * 6, lean = -Math.sin(a) * 0.25, cols = k ? R_RED : [88, 45, 46, 47];
        if (!V.vis(sx - 8, sy - 16, sx + 8, sy + 2)) continue;
        V.each(sx - 8, sy - 16, sx + 8, sy + 1, (x, y, X, Y) => {
          const dy = sy - y, dx = x - sx - lean * dy, d = bay(X, Y);
          if (dy > 12.5 && dy < 15 && Math.abs(dx) < 2.2) return rp(R_RED, 0.5, d);                                   // the hat
          if (dy > 10 && dy <= 12.5 && Math.abs(dx) < 2) return rp(R_SKIN, 0.7, d);
          if (dy > 4 && dy <= 10 && Math.abs(dx) < 2.6 - (dy - 7) * 0.1) return rp(cols, 0.5 - dx * 0.08, d);
          const leg = 1.5 * Math.sin(a * 2 + k); if (dy > 0.6 && dy <= 4 && (Math.abs(dx + 1 + leg * (4 - dy) * 0.2) < 0.8 || Math.abs(dx - 1 - leg * (4 - dy) * 0.2) < 0.8)) return 39;
          if (dy >= 0 && dy <= 0.6 && Math.abs(dx) < 3) return 34;
          return -1;
        });
      }
      // the chimney's smoke, rising and drifting
      for (let j = 0; j < 22; j++) { const ph = frac(j / 22 + t / 3.75), y = -146 - ph * 70, x = 54 + ph * 22 + 4 * Math.sin(ph * 5 + zP(t, 1)), r = 2 + ph * 6; if (V.vis(x - r, y - r, x + r, y + r)) V.each(x - r, y - r, x + r, y + r, (px, py, X, Y) => (px - x) ** 2 + (py - y) ** 2 < r * r && bay(X, Y) < (1 - ph) * 0.4 ? 18 : -1); }
      // light: the shop's window on the snow, the lanterns, the lamp, the moon
      zGlow(V, 0, 30, 70, T_WARM, 0.3); zGlow(V, -112, -44, 26, T_WARM, 0.4 * lampK); zGlow(V, -54, -38, 10, T_GOLD, 0.35); zGlow(V, 54, -38, 10, T_GOLD, 0.35);
      zGlow(V, MOON[0], MOON[1], 40, T_WH, 0.12);
      // and the snow, falling over everything
      zSnow(V, t, -360, -300, 360, 300, 8, 706, 2);
    }
    ZL[3] = { name: 'village', draw: c3Draw, mask: paneMask, maskBox: PANE_BOX, hole: PANE_HOLE };
  }
