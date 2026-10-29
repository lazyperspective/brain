  /* ================================================================ L1 — the street
     The house with the candle, its window in the middle (L0 shows through), in a row of narrow snowy-roofed houses. One by
     one the neighbours answer: a mote of warm light drifts from the lit window to the next, and a candle is lit there,
     then the next, outward both ways down the street; upstairs windows warm a moment later.
     The row is drawn by streetPix (in this layer's units), which L2 also uses for every street of the town, so the
     street seen close and the street seen from the town are the same pixels. */
  // the houses of a row: [x0, x1, eave y, roof peak y, wall ramp]; row 0 is ours, the rest are the town's (seeded)
  const R_BRICK = [9, 10, 154, 155, 156], R_PLAST = [120, 121, 122, 123, 19], R_SLATE = [134, 135, 136, 137, 138], R_OCHRE = [27, 28, 173, 174, 31];
  const WALLS = [R_BRICK, R_SLATE, R_OCHRE, R_PLAST];
  const ROW0 = [[-66, 66, -80, -170, R_BRICK], [66, 142, -66, -128, R_SLATE], [142, 276, -88, -168, R_OCHRE], [276, 408, -72, -150, R_PLAST], [408, 560, -82, -160, R_BRICK],
    [-140, -66, -90, -150, R_BRICK], [-272, -140, -62, -138, R_PLAST], [-410, -272, -84, -160, R_OCHRE], [-560, -410, -70, -150, R_SLATE]];
  const HKEY = (row, x) => Math.floor(x / 140 + 0.5);
  // house k of a row (k = 0 at x ≈ 0, ±1 its neighbours …): its geometry
  function houseOf(row, k) {
    if (row === 0 && Math.abs(k) <= 4) { const i = k >= 0 ? k : 4 - k; const h = ROW0[i]; return h; }
    const w = 112 + ih(k, row, 1210) * 56, x0 = k * 140 - w / 2 + (ih(k, row, 1211) - 0.5) * 18, eave = -60 - ih(k, row, 1212) * 32;
    return [x0, x0 + w, eave, eave - 60 - ih(k, row, 1213) * 40, WALLS[fl(ih(k, row, 1214) * 4)]];
  }
  // when house k of row `row` lights up: the street, one by one outward; the town's rows by their distance from us
  const STREET_ON = (k) => 2.0 + 0.45 * (Math.abs(k) - 1) + (k > 0 ? 0.16 : 0);
  function houseOn(row, k, t, cxL2, cyL2) {
    if (row === 0 && k === 0) return 1;
    const t1 = row === 0 ? STREET_ON(k) : 3.6 + Math.hypot(cxL2, cyL2) * 0.017 + ih(k, row, 1215) * 0.5;
    if (t < 3.0 && row !== 0) return 1;                                         // (last night's lights, out of sight but for the tiny town in the orb)
    return sstep(t1, t1 + 0.4, t);
  }
  const winOf = (h, main) => { const cx = (h[0] + h[1]) / 2; return main ? [cx, 0, 36, 22] : [cx, 0, Math.min(26, (h[1] - h[0]) / 2 - 12), 18]; };
  const upOf = (h) => [(h[0] + h[1]) / 2, -50, Math.min(14, (h[1] - h[0]) / 2 - 16), 12];
  // one pixel of a row of houses (row units = L1's; y from about -180 to +180): -1 where it is sky (not this row's)
  function streetPix(row, x, y, X, Y, t, ck, ox, oy) {
    const d = bay(X, Y);
    if (y > 64 + 2 * Math.sin(x * 0.05)) {                                                          // the snowy street
      if (y > 176) return -1;
      const k = HKEY(row, x), h = houseOf(row, k), on = houseOn(row, k, t, (ox + x) / 8, oy / 8), L = on * lit(((x - (h[0] + h[1]) / 2)) ** 2 + (y - 40) ** 2, 46);
      const print = row === 0 && Math.abs(((x + 600) % 23) - 11) < 2 && Math.abs(y - 92 - Math.sin(x * 0.1) * 3) < 1.5;
      return rp(R_SNOW, clamp(0.3 + L * 0.35 + 0.06 * vn(x * 0.06, y * 0.1, 1, 1201 + row) - (print ? 0.12 : 0), 0, 1), d);
    }
    const kc = HKEY(row, x);
    for (let kk = kc - 1; kk <= kc + 1; kk++) {
      const h = houseOf(row, kk); if (x < h[0] || x >= h[1]) continue;
      const k = kk, main = row === 0 && k === 0, cx = (h[0] + h[1]) / 2, hw = (h[1] - h[0]) / 2;
      if (y < h[2]) {                                                                              // the roof, snowed on, a chimney
        if (Math.abs(x - cx - hw * 0.45) < 7 && y > h[3] + 18 && y < h[2]) return y < h[3] + 24 ? rp(R_SNOW, 0.8, d) : rp(R_BRICK, 0.35, d);
        const top = h[3] + Math.abs(x - cx) * ((h[2] - h[3]) / hw); if (y < top) return -1;
        return y > h[2] - 3 ? 1 : rp(R_SNOW, clamp(0.5 + (x < cx ? 0.14 : -0.04) + 0.04 * Math.sin(x * 0.3), 0, 1), d);
      }
      const on = houseOn(row, k, t, (ox + cx) / 8, oy / 8), onU = main ? 1 : sstep(0.6, 1, on) * (row === 0 ? sstep(STREET_ON(k) + 1.1, STREET_ON(k) + 1.6, t) : 1);
      const w = winOf(h, main), u2 = upOf(h);
      for (let pass = 0; pass < 2; pass++) {
        const isMain = pass === 0, wx = isMain ? w[0] : u2[0], wy = isMain ? w[1] : u2[1], ww = isMain ? w[2] : u2[2], wh = isMain ? w[3] : u2[3], lv = isMain ? on : onU;
        const dx = x - wx, dy = y - wy;
        if (Math.abs(dx) < ww + 4 && Math.abs(dy) < wh + 4) {
          if (main && isMain && Math.abs(dx) < 36 && Math.abs(dy) < 22) return rp(R_FIRE, 0.5, d);          // (the glass: L0 shows through)
          if (Math.abs(dx) < ww && Math.abs(dy) < wh) {
            if (Math.abs(dx) < 1 && !(main && isMain)) return rp(R_CREAM, 0.3 + lv * 0.4, d);               // the glazing bar
            if (lv > 0 && Math.abs(dx) > ww * 0.74 - Math.max(0, dy + wh * 0.2) * 0.25) return rp(R_RED, clamp(0.15 + lv * 0.45 - (Math.abs(dx) - ww * 0.74) * 0.05, 0, 1), d);   // curtains
            if (isMain && lv > 0) { const fx = dx + ww * 0.45, fy = dy - wh * 0.15;                             // their candle
              if (Math.abs(fx) < 2.2 && fy > -2 && fy < wh * 0.85) return rp(R_CREAM, 0.8, d);
              if (fy < -2 && fy > -11 * lv && Math.abs(fx) < 3 * Math.sqrt(Math.max(0, 1 - (-2 - fy) / (11 * lv)))) return fy > -6 ? 22 : 16; }
            const warm = lv * (0.55 + 0.35 * lit((dx + ww * 0.45) ** 2 + (dy - wh * 0.15 + 6) ** 2, ww * 0.9)) * (isMain ? ck : 1);
            if (warm > 0.05) return rp(R_FIRE, clamp(warm * 0.6, 0, 1), d);
            return (dx - dy * 0.6 + 4) % 14 < 3 ? 136 : rp(R_NIGHT, 0.25, d);                                  // a dark pane, a gleam on it
          }
          if (dy > wh && dy < wh + 4) return rp(R_SNOW, 0.85, d);                                               // the sill's snow
          return rp(R_CREAM, clamp(0.3 + lv * 0.25, 0, 1), d);                                                  // the frame
        }
      }
      if (!main && Math.abs(x - (cx + (k < 0 ? -hw * 0.55 : hw * 0.55))) < 8 && y > 22) { const wq = (x - (cx + (k < 0 ? -hw * 0.55 : hw * 0.55))) ** 2 + (y - 36) ** 2; if (wq < 20 && wq > 8) return rp(R_PINE, 0.4, d); return rp(R_RED, 0.25, d); }   // a door, a wreath
      const brick = h[4] === R_BRICK && (((y + 400) % 6 < 0.8) || ((x + (fl((y + 400) / 6) % 2) * 5 + 600) % 10 < 0.8));
      const Lw = on * lit((x - w[0]) ** 2 + (y - w[1]) ** 2, w[2] * 1.6) * 0.5;
      return brick ? h[4][0] : rp(h[4], clamp(0.22 + Lw + 0.05 * ih(fl(x / 9), fl(y / 9), 1202), 0, 1), d);
    }
    return -1;
  }
  {
    function c1Draw(V, t) {
      const ck = flick(t, 2.4);
      V.each(-600, -330, 600, 330, (x, y, X, Y) => { const c = streetPix(0, x, y, X, Y, t, ck, 0, 0); return c >= 0 ? c : rp(R_NIGHT, clamp(0.78 + y / 420, 0, 1), bay(X, Y)); });
      zStars(V, t, -600, -330, 600, -60, 4, 1203, [135, 136, 168, 169, 22], (x, y) => { const h = houseOf(0, HKEY(0, x)); return x < h[0] || x >= h[1] || y < h[3] + Math.abs(x - (h[0] + h[1]) / 2) * ((h[2] - h[3]) / ((h[1] - h[0]) / 2)) - 2; });
      // the warm motes, carrying the light from one window to the next
      for (const sgn of [-1, 1]) for (let n = 1; n <= 6; n++) {
        const k = sgn * n, t1 = STREET_ON(k), t0 = t1 - 0.42, f = (t - t0) / (t1 - t0); if (f < 0 || f > 1.15) continue;
        const wa = winOf(houseOf(0, sgn * (n - 1)), n === 1), wb = winOf(houseOf(0, k), false), e = eio(Math.min(1, f));
        const x = lerp(wa[0], wb[0], e), y = lerp(-6, -10, e) - Math.sin(e * PI) * 26, fade = f > 1 ? 1 - (f - 1) / 0.15 : 1;
        zGlow(V, x, y, 10, T_GOLD, 0.5 * fade); zDisc(V, x, y, 1.6, 16);
        for (let j = 1; j < 6; j++) { const e2 = eio(Math.max(0, Math.min(1, f) - j * 0.035)), x2 = lerp(wa[0], wb[0], e2), y2 = lerp(-6, -10, e2) - Math.sin(e2 * PI) * 26; if (bay(fl(V.X(x2)), fl(V.Y(y2))) < (1 - j / 6) * fade) zDisc(V, x2, y2, 0.9, 15); }
      }
      // the windows' glow on the night
      for (let k = -6; k <= 6; k++) { const h = houseOf(0, k), w = winOf(h, k === 0), on = houseOn(0, k, t, 0, 0); if (on > 0.02 && V.vis(w[0] - 60, -60, w[0] + 60, 60)) zGlow(V, w[0], w[1] + 4, w[2] * 1.8, T_WARM, 0.32 * on * ck); }
      zSnow(V, t, -600, -330, 600, 330, 6, 1204, 2, [136, 167, 168, 169, 170]);
    }
    ZL[1] = { name: 'street', draw: c1Draw, mask: paneMask, maskBox: PANE_BOX, hole: PANE_HOLE };
  }
