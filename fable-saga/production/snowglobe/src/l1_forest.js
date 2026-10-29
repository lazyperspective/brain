  /* ================================================================ L1 — the cabin in the woods, inside the workshop's globe
     A log cabin in a clearing of snowy pines under the northern lights. Its roof heavy with snow, icicles along the eave,
     a stone chimney smoking, green shutters with heart cut-outs either side of its lit window (the window to L0, the cabin's
     own room), a wreath on the door, a lantern, a woodpile. A deer grazes by the trees on the right. Snow falls. */
  {
    // pines: [x of the trunk, y of the ground, height, half-width]
    const PINES = [[-320, 40, 200, 56], [-262, 50, 170, 46], [-214, 58, 150, 40], [-176, 46, 116, 30], [190, 46, 120, 32], [236, 56, 160, 42], [292, 44, 196, 54], [350, 40, 170, 46],
      [-372, 30, 150, 40], [-140, 20, 70, 18], [150, 22, 74, 19]];
    const pineAt = (x, y, p) => { const px = p[0], gy = p[1], h = p[2], w = p[3], top = gy - h, f = (y - top) / h; if (f < 0 || f > 1.06) return null; if (f > 1) return Math.abs(x - px) < w * 0.09 ? 'trunk' : null;
      const tier = (f * 5) % 1, hw = w * (0.12 + 0.88 * f) * (0.55 + 0.45 * tier); if (Math.abs(x - px) > hw) return null; return tier < 0.28 && f > 0.05 ? 'snow' : 'needle'; };
    // per column, once a frame: the aurora's fold, foot and strength; the ground's and the far forest's lines
    const CF = new Float32Array(W), CB = new Float32Array(W), CE = new Float32Array(W), CG = new Float32Array(W), CL = new Float32Array(W);
    function c1Draw(V, t) {
      const lk = flick(t, 3.3), a1 = zP(t, 1), a2 = zP(t, 2), graze = 0.5 + 0.5 * Math.sin(zP(t, 2) - 0.6);
      for (let X = 0; X < W; X++) { const x = V.lx(X); CF[X] = x + 26 * Math.sin(x / 95 + a1) + 9 * Math.sin(x / 29 - a2); CB[X] = -92 + 8 * Math.sin(x / 80 + a1) - 4 * Math.sin(x / 26 + a2); CE[X] = 0.55 + 0.45 * Math.sin(x / 130 + 0.6 + a1 * 0.5); CG[X] = 50 + 4 * Math.sin(x * 0.02) + 2 * Math.sin(x * 0.09); CL[X] = -20 + 8 * Math.sin(x * 0.015) + 6 * Math.sin(x * 0.043); }
      V.each(-380, -300, 380, 300, (x, y, X, Y) => {
        const d = bay(X, Y), Lw = lit(x * x + (y - 30) ** 2, 70) * 0.75, Ll = lit((x - 70) ** 2 + (y + 20) ** 2, 30) * lk;
        // the deer, grazing (head down, then up to look)
        if (x > 180 && x < 228 && y > 44 && y < 92) { const bx = x - 206, by = y - 70, body = (bx / 15) ** 2 + (by / 7.5) ** 2 < 1, leg = by > 3 && by < 20 && (Math.abs(bx + 10 - (by - 3) * 0.08) < 1.4 || Math.abs(bx + 6 + (by - 3) * 0.08) < 1.4 || Math.abs(bx - 8 - (by - 3) * 0.06) < 1.4 || Math.abs(bx - 12 + (by - 3) * 0.06) < 1.4);
          const hy = -12 + graze * 20, hx = -19 + graze * 3, neck = Math.abs(((bx + 8) * (hy + 2) - (by + 2) * (hx + 8))) / Math.hypot(hx + 8, hy + 2) < 3 && bx < -6 && bx > hx - 1 && by < Math.max(hy, -2) + 4 && by > Math.min(hy, -2) - 3;
          const head = ((bx - hx) / 4.5) ** 2 + ((by - hy) / 3) ** 2 < 1, ant = (Math.abs(bx - hx - 1 - (by - hy + 4) * 0.4) < 0.6 && by < hy - 2 && by > hy - 10) || (Math.abs(by - hy + 7 - (bx - hx) * 0.3) < 0.6 && bx > hx && bx < hx + 5), tail = ((bx - 15) / 2.5) ** 2 + ((by + 3) / 2) ** 2 < 1;
          if (ant) return rp(R_WOOD, 0.35, d); if (tail) return 170;
          if (body || leg || neck || head) return (head && Math.abs(bx - hx + 2) < 0.7 && Math.abs(by - hy + 0.5) < 0.7) ? 0 : rp(R_WOOD, clamp(0.25 + (by < -2 ? 0.15 : 0) - bx * 0.004 + (leg ? -0.1 : 0), 0, 1), d); }
        // the near pines
        if (Math.abs(x) > 120) for (let i = 0; i < 9; i++) { const p = PINES[i]; if (Math.abs(x - p[0]) > p[3]) continue; const k = pineAt(x, y, p); if (k) return k === 'trunk' ? rp(R_WOOD, 0.15, d) : k === 'snow' ? rp(R_SNOW, clamp(0.55 + (x < p[0] ? 0.15 : -0.05), 0, 1), d) : rp(R_PINE, clamp(0.12 + (x < p[0] ? 0.14 : 0) + 0.1 * vn(x * 0.3, y * 0.3, 1, 901), 0, 1), d); }
        // the cabin: window, shutters, door, lantern, woodpile, logs, roof and its snow, icicles, chimney
        if (Math.abs(x) < 41 && Math.abs(y) < 27) {
          if (Math.abs(x) < 36 && Math.abs(y) < 22) return rp(R_FIRE, 0.5 + 0.2 * Math.sin(x * 0.17) * Math.sin(y * 0.23), d);
          if (y < -22) return rp(R_SNOW, 0.85, d);
          return rp(R_WOOD, clamp(0.3 + Lw * 0.4, 0, 1), d);
        }
        if (Math.abs(x) < 44 && y >= 27 && y < 32) return y < 29.5 + 0.8 * Math.sin(x * 0.6) ? rp(R_SNOW, 0.9, d) : rp(R_WOOD, 0.25, d);
        if (Math.abs(x) >= 42 && Math.abs(x) < 62 && Math.abs(y) < 27) { const sgn = x < 0 ? -1 : 1, sx = x * sgn; if (sx >= 42 && sx < 62 && Math.abs(y) < 27) { const hx = sx - 52, hy = y + 10, heart = (hx * hx + hy * hy - 5) ** 3 - hx * hx * hy * hy * hy < 0 && false; const hq = Math.abs(hx) < 3.5 && hy > -3 && hy < 3 && (Math.abs(hx) < 3 - Math.max(0, hy) * 0.9);
          if (hq || (Math.hypot(Math.abs(hx) - 1.6, hy + 2) < 1.8)) return rp(R_FIRE, 0.4, d); if (Math.abs(y) > 25.5 || (sx > 49.5 && sx < 50.5) || (sx > 59.5)) return rp(R_PINE, 0.2, d); return rp(R_PINE, clamp(0.32 + Lw * 0.3 + (sgn < 0 ? 0.06 : 0), 0, 1), d); } }
        if (x > 82 && x < 114 && y > -26 && y < 56) {
          const wq = (x - 98) ** 2 + (y + 6) ** 2; if (wq < 70 && wq > 24) return (y > 0 && y < 6 && Math.abs(x - 98) < 4) ? rp(R_RED, 0.75, d) : rp(R_PINE, 0.4 + (x < 98 ? 0.2 : 0) + Ll * 0.3, d);
          if (Math.abs(x - 108) < 1.5 && Math.abs(y - 22) < 2) return rp(R_BRASS, 0.8, d);
          return ((x - 82) % 8 < 0.8) ? 159 : rp(R_WOOD, clamp(0.2 + Ll * 0.45 + ih(fl((x - 82) / 8), 1, 902) * 0.06, 0, 1), d);
        }
        if (Math.abs(x - 72) < 3.5 && y > -24 && y < -12) return Math.abs(x - 72) < 2.2 && y > -22 && y < -14 ? rp(R_FIRE, 0.7 + 0.2 * lk, d) : 40;
        if (Math.abs(x - 72) < 0.6 && y >= -30 && y <= -24) return 40;
        if (x > -146 && x < -98 && y > 24 && y < 56) { if (y < 28 + 1.5 * Math.sin(x * 0.4)) return rp(R_SNOW, 0.8, d); const cx = ((x + 146) % 8) - 4, cy = ((y - 24) % 8) - 4, r = Math.hypot(cx, cy); return r < 3.4 ? (r < 1.2 ? rp(R_WOOD, 0.6, d) : rp(R_WOOD, 0.45 - r * 0.05, d)) : 159; }
        const ridge = -140 + Math.abs(x) * (92 / 175);
        if (x > -86 && x < -62 && y > -150 && y < ridge + 6) { if (y < -146) return rp(R_SNOW, 0.85, d); const st = ih(fl((x + 86) / 6 + (fl((y + 150) / 5) % 2) * 0.5), fl((y + 150) / 5), 903); return ((x + 86 + (fl((y + 150) / 5) % 2) * 3) % 6 < 0.8 || (y + 150) % 5 < 0.8) ? 120 : rp(R_STONE, 0.2 + st * 0.25, d); }
        if (y > ridge - 10 && y < -40 && Math.abs(x) < 178) {
          const eave = -44 + 2 * Math.sin(x * 0.07) + 1.2 * Math.sin(x * 0.31);
          if (y < eave) { const top = y < ridge; return rp(R_SNOW, clamp(0.62 + (x < 0 ? 0.12 : -0.04) - (top ? 0 : 0) + 0.05 * Math.sin(x * 0.25 + y * 0.1) - Math.max(0, y - eave + 4) * 0.08, 0, 1), d); }
          return 1;
        }
        { const ix = fl((x + 400) / 5), il = 2 + 7 * ih(ix, 1, 904); if (Math.abs(x) < 170 && y >= -40 && y < -40 + il && Math.abs(((x + 400) % 5) - 2.5) < 1.3 * (1 - (y + 40) / il)) return d < 0.5 ? 170 : 147; }
        if (Math.abs(x) < 150 && y >= -48 && y < 56) {
          const yy = y + 1300, n = Math.floor(yy / 11), v = (yy - n * 11) / 11; if (v < 0.1) return d < 0.5 ? 121 : 120;
          if (Math.abs(x) > 144) { const r = Math.hypot(Math.abs(x) - 147, v * 11 - 5.5); return r < 4.6 ? (Math.abs(r - 2.5) < 0.6 ? rp(R_WOOD, 0.3, d) : rp(R_WOOD, 0.55, d)) : rp(R_SNOW, 0.7, d); }
          const round = Math.sin((v - 0.1) / 0.9 * PI); return rp(R_LOG, clamp(0.05 + (0.18 + Lw * 0.45 + Ll * 0.3) * (0.4 + 0.6 * round) + vn(x * 0.03, n * 3.3, 1, 905) * 0.08, 0, 1), d);
        }
        // the far pines, the snow, the sky and its aurora
        for (let i = 9; i < PINES.length; i++) { const p = PINES[i], k = pineAt(x, y, p); if (k) return k === 'snow' ? rp(R_SNOW, 0.45, d) : rp(R_PINE, 0.1, d); }
        if (y >= CG[X]) {
          const path = Math.abs(x - 98 - (y - 56) * 0.6) < 10 + (y - 56) * 0.15 && y < 140;
          return rp(R_SNOW, clamp(0.4 + 0.08 * vn(x * 0.05, y * 0.1, 1, 906) + Lw * 0.4 + Ll * 0.25 - (path ? 0.1 : 0) - Math.max(0, y - 140) * 0.0015, 0, 1), d);
        }
        if (y > CL[X]) return rp(R_PINE, 0.08, d);       // the far forest's dark line
        let c = rp(R_NIGHT, clamp(0.7 + y / 300, 0, 1), d);
        const hg = CB[X] - y;
        if (hg > 0 && hg < 140) { const I = CE[X] * zAur(CF[X], hg) * (hg < 2.5 ? hg / 2.5 : 1);
          if (I > 0.62 + d * 0.25) c = hg < 10 ? 49 : hg < 30 ? 48 : 126; else if (I > 0.4 + d * 0.25) c = hg < 14 ? 48 : hg < 40 ? 126 : 125; else if (I > 0.22 + d * 0.22) c = hg < 20 ? 125 : 117; else if (I > 0.1 + d * 0.18) c = hg < 26 ? 124 : 116; }
        return c;
      });
      zStars(V, t, -380, -300, 380, -30, 4, 907, [135, 136, 168, 169, 22], (x, y) => y < -110 + 6 * Math.sin(x * 0.05) && !(y > -150 && Math.abs(x) < 180));
      for (let j = 0; j < 22; j++) { const ph = frac(j / 22 + t / 3.75), y = -150 - ph * 70, x = -74 - ph * 20 + 4 * Math.sin(ph * 5 + zP(t, 1)), r = 2 + ph * 6; if (V.vis(x - r, y - r, x + r, y + r)) V.each(x - r, y - r, x + r, y + r, (px, py, X, Y) => (px - x) ** 2 + (py - y) ** 2 < r * r && bay(X, Y) < (1 - ph) * 0.4 ? 18 : -1); }
      zGlow(V, 0, 28, 64, T_WARM, 0.3); zGlow(V, 72, -18, 16, T_WARM, 0.45 * lk);
      zSnow(V, t, -380, -300, 380, 300, 8, 908, 2);
    }
    ZL[1] = { name: 'forest', draw: c1Draw, mask: paneMask, maskBox: PANE_BOX, hole: PANE_HOLE };
  }
