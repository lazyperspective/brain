  /* ================================================================ the lighthouse, outside (drawn live: it is seen from
     far, near, and with its beam blazing). A tapering whitewashed tower with two red bands and a little masonry showing
     through, small windows up it, an arched door at its foot; a railed gallery; the lantern room (glass panes between
     iron mullions; dark, or alight with the lens) under a domed cap with a ball and vane. Local units, base centre at
     (0, 0), y down. o: { lit (0..1), sweep (beam angle), door (0..1 glow in the doorway) }. */
  const TW = { H: 120, w0: 16, w1: 11, gal: 3, room: 17, cap: 9 };
  function drawTower(bx, by, S, o, light) {
    const lit = o.lit || 0, H = TW.H, top = by - H * S;
    const x0 = Math.max(0, fl(bx - (TW.w0 + 4) * S)), x1 = Math.min(W - 1, Math.ceil(bx + (TW.w0 + 4) * S));
    const y0 = Math.max(ROW0, fl(top - (TW.gal + TW.room + TW.cap + 4) * S)), y1 = Math.min(ROW1, Math.ceil(by + 1));
    for (let Y = y0; Y <= y1; Y++) {
      const v = (by - (Y + 0.5)) / S;                          // height above the base, units
      for (let X = x0; X <= x1; X++) {
        const dx = (X + 0.5 - bx) / S;
        let c = -1;
        if (v >= 0 && v <= H) {
          const u = v / H, w = lerp(TW.w0, TW.w1, u);
          if (Math.abs(dx) < w) {
            const q = dx / w, nx = q, nc = Math.sqrt(1 - q * q);
            // masonry: courses and joints faintly showing through the whitewash; weather streaks
            const course = frac(v / 3.4), joint = frac(dx / 4.6 + (fl(v / 3.4) & 1) * 0.5);
            let s = 0.32 + 0.5 * Math.max(0, -nx * light.sky[0] * 1.2 + nc * 0.55) - (course < 0.1 || joint < 0.05 ? 0.08 : 0) - vn(dx * 0.6, v * 0.1, 4, 961) * 0.1;
            const band = (u > 0.3 && u < 0.4) || (u > 0.62 && u < 0.72);
            let m = band ? M_REDW : M_WHITEW;
            // the door, arched; small windows up the tower
            if (Math.abs(dx) < 3.6 && v < 10 + 3.6 * Math.sqrt(Math.max(0, 1 - dx * dx / 13))) {
              const inner = Math.abs(dx) < 3.0 && v < 9.6 + 3 * Math.sqrt(Math.max(0, 1 - dx * dx / 9));
              if (inner) { const g = o.door || 0; c = g > 0.05 && bay(X, Y) < g * (1 - v / 14) ? (g > 0.6 && v < 6 ? 182 : 180) : (dx > 1.6 ? 216 : 215); } else { m = M_STONE; s -= 0.05; }
            }
            for (const wv of [34, 62, 90]) if (Math.abs(dx - 1) < 1.7 && Math.abs(v - wv) < 2.6) { c = lit > 0.3 ? 182 : 241; if (Math.abs(dx - 1) > 1.2 || Math.abs(v - wv) > 2.2) c = 243; }
            if (c < 0) c = mc(m, s, lampAt(X, Y, light.z, nx * 0.9, 0) * 1.2 + lit * 0.25 * (u > 0.85 ? 1 : 0), X, Y);
          }
        } else if (v > H) {
          const vv = v - H;
          if (vv <= TW.gal) {                                   // the gallery: a ledge and its railing
            if (vv < 1.2 && Math.abs(dx) < TW.w1 + 3.5) c = mc(M_IRON, 0.35 - vv * 0.1 + (dx < 0 ? 0.1 : 0), lit * 0.6, X, Y);
            else if (Math.abs(dx) < TW.w1 + 3.2 && (vv > TW.gal - 0.7 || frac(dx / 2.2) < 0.25)) c = mc(M_IRON, 0.25, lit * 0.5, X, Y);
          } else if (vv <= TW.gal + TW.room) {                  // the lantern room
            const rw = TW.w1 * 0.86;
            if (Math.abs(dx) < rw) {
              const mul = Math.abs(dx) < 0.6 || Math.abs(Math.abs(dx) - rw * 0.55) < 0.5 || Math.abs(dx) > rw - 0.8 || (vv - TW.gal) < 1 || vv > TW.gal + TW.room - 0.8;
              if (mul) c = mc(M_IRON, 0.28 + (dx < 0 ? 0.08 : 0), lit * 0.8, X, Y);
              else if (lit > 0.02) {
                // alight: the lens glowing gold-white inside, hottest in the middle
                const r = Math.hypot(dx / rw, (vv - TW.gal - TW.room / 2) / (TW.room / 2)), g = lit * (1.25 - r * 0.6);
                c = g > 1 ? 22 : g > 0.8 ? 60 : g > 0.6 ? 200 : g > 0.4 ? 199 : g > 0.2 ? 182 : 181;
              } else c = dx < -rw * 0.35 && (vv - TW.gal) > TW.room * 0.55 ? 205 : (bay(X, Y) < 0.2 ? 242 : 241);   // dark glass, one cold glint
            }
          } else if (vv <= TW.gal + TW.room + TW.cap) {          // the domed cap, the ball, the vane
            const cv = (vv - TW.gal - TW.room) / TW.cap, cw = TW.w1 * 0.95 * Math.sqrt(Math.max(0, 1 - cv * cv * 0.85));
            if (Math.abs(dx) < cw && cv < 0.82) c = mc(M_IRON, 0.22 + (dx < -cw * 0.3 ? 0.18 : 0) + (cv < 0.1 ? 0.1 : 0), lit * 0.4, X, Y);
            else if (Math.abs(dx) < 1.3 && cv >= 0.82) c = mc(M_IRON, 0.3, 0, X, Y);
          }
        }
        if (c >= 0) BUF[Y * W + X] = c;
      }
    }
    return { lamp: [bx, top - (TW.gal + TW.room / 2) * S], door: [bx, by - 6 * S] };
  }
  // the keeper's cottage: stone walls, a snow-heavy roof, a lit window, a chimney (its smoke torn off by the wind)
  function drawCottage(bx, by, S, light, t) {
    const w = 22, h = 13, roofH = 12;
    for (let Y = Math.max(ROW0, fl(by - (h + roofH + 6) * S)); Y <= Math.min(ROW1, Math.ceil(by)); Y++) {
      const v = (by - Y - 0.5) / S;
      for (let X = Math.max(0, fl(bx - (w / 2 + 3) * S)); X <= Math.min(W - 1, Math.ceil(bx + (w / 2 + 3) * S)); X++) {
        const dx = (X + 0.5 - bx) / S;
        let c = -1;
        if (v < h && Math.abs(dx) < w / 2) {
          const win = Math.abs(dx - 4) < 2.6 && Math.abs(v - 6.5) < 2.6;
          if (win) c = Math.abs(dx - 4) < 0.35 || Math.abs(v - 6.5) < 0.35 ? 162 : (v > 6.5 ? 15 : 182);
          else { const course = frac(v / 2.6), joint = frac(dx / 3.4 + (fl(v / 2.6) & 1) * 0.5); c = mc(M_STONE, 0.2 + (course < 0.18 || joint < 0.1 ? -0.08 : 0.04) + (dx < 0 ? 0.06 : 0), lampAt(X, Y, light.z, dx / w, 0), X, Y); }
          if (Math.abs(dx + 4) < 2.2 && v < 8) c = mc(M_WOOD, 0.2, lampAt(X, Y, light.z, 0, 0), X, Y);     // the door
        } else if (v >= h - 1 && v < h + roofH) {
          const rw = (w / 2 + 2.5) * (1 - (v - h + 1) / (roofH + 1));
          if (Math.abs(dx) < rw) { const edge = Math.abs(dx) > rw - 1.4 || v < h + 0.8; c = mc(M_SNOW, (edge ? 0.62 : 0.48) + (dx < 0 ? 0.14 : -0.04) + (vn(dx * 2, v * 2, 2, 971) - 0.5) * 0.15, 0, X, Y); }
        }
        if (Math.abs(dx - 6) < 1.6 && v >= h + 4 && v < h + roofH + 2) c = mc(M_STONE, 0.18, 0, X, Y);   // chimney
        if (c >= 0) BUF[Y * W + X] = c;
      }
    }
    // the window's light on the snow below it
    glow(bx + 4 * S, by - 6.5 * S, 9 * S, T_LAMP, 0.35);
    // smoke, torn sideways
    for (let k = 0; k < 16; k++) { const u = frac(k / 16 + t * 0.6), sx = bx + 6 * S + u * 40 * S + Math.sin(u * 6 + k) * 3, sy = by - (h + roofH + 3) * S - u * 10 * S; if (bay(fl(sx), fl(sy)) < 0.5 * (1 - u)) { P(sx, sy, 244); P(sx + 1, sy, 245); } }
  }
  // the small ship, lost: a dark hull, a wheelhouse with warm windows, a mast with its red and green lights; it pitches
  function drawShip(x, y, S, roll, lights, turn) {
    const ca = Math.cos(roll), sa = Math.sin(roll);
    for (let Y = fl(y - 16 * S); Y <= Math.ceil(y + 4 * S); Y++) for (let X = fl(x - 14 * S); X <= Math.ceil(x + 14 * S); X++) {
      if (Y < ROW0 || Y > ROW1 || X < 0 || X >= W) continue;
      const dx = (X + 0.5 - x) / S, dy = (Y + 0.5 - y) / S, u = dx * ca + dy * sa, v = -dx * sa + dy * ca;
      let c = -1;
      if (v > -1.5 && v < 2.5 && Math.abs(u) < 11 - (v > 0 ? v * 1.6 : 0) + (u > 0 ? 1.5 : 0)) c = v < -0.5 ? 245 : 241;   // hull
      else if (v > -6 && v <= -1.5 && u > -6 && u < 1) c = (Math.abs(v + 3.8) < 0.9 && (u > -5 && u < -0.5) && (fl(u + 6) % 2 === 0)) ? (lights ? 15 : 243) : 242;   // wheelhouse
      else if (Math.abs(u - 3) < 0.4 && v > -14 && v <= -1.5) c = 243;                                                     // mast
      if (c >= 0) BUF[Y * W + X] = c;
    }
    // its lights: masthead white, port red, starboard green (they swing as it pitches)
    const mh = [x + (3 * ca + 14 * sa) * S, y + (3 * sa - 14 * ca) * S];
    if (lights) { glow(mh[0], mh[1], 6, T_WH, 0.5); P(mh[0], mh[1], 22); P(x + (-6 * ca + 2 * sa) * S, y + (-6 * sa - 2 * ca) * S, 157); P(x + (8 * ca + 1 * sa) * S, y + (8 * sa - 1 * ca) * S, 233); }
    return mh;
  }
