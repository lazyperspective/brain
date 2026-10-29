  /* ================================================================ the lighthouse, outside (drawn live: it is seen from
     far, near, and with its beam blazing). A tapering whitewashed tower with two red bands and a little masonry showing
     through, small windows up it, an arched door at its foot; a railed gallery; the lantern room (glass panes between
     iron mullions; dark, or alight with the lens) under a domed cap with a ball and vane. Local units, base centre at
     (0, 0), y down. o: { lit (0..1), sweep (beam angle), door (0..1 glow in the doorway) }. */
  const TW = { H: 120, w0: 16, w1: 11, gal: 3.2, room: 17, cap: 9 };
  function drawTower(bx, by, S, o, light) {
    const lit = o.lit || 0, H = TW.H, top = by - H * S, door = o.door || 0;
    const x0 = Math.max(0, fl(bx - (TW.w0 + 7) * S)), x1 = Math.min(W - 1, Math.ceil(bx + (TW.w0 + 7) * S));
    const y0 = Math.max(ROW0, fl(top - (TW.gal + TW.room + TW.cap + 9) * S)), y1 = Math.min(ROW1, Math.ceil(by + 2 * S));
    const lx = light.sky[0];
    for (let Y = y0; Y <= y1; Y++) {
      const v = (by - (Y + 0.5)) / S;                          // height above the base, units
      for (let X = x0; X <= x1; X++) {
        const dx = (X + 0.5 - bx) / S, d = BAYF[((Y & 7) << 3) | (X & 7)];
        let c = -1;
        if (v < -1.5) { }
        else if (v < 6.5) {
          // the plinth: big dressed blocks, a snowed-on ledge, steps up to the door, drifts banked against the foot
          const w = TW.w0 + 3.2 - Math.max(0, v - 5.2) * 1.2, q = dx / w;
          const drift = 2.6 + 1.4 * Math.sin(dx * 0.31 + 1) + (dx < 0 ? 1.6 : 0) - Math.abs(q) * 0.8;
          if (Math.abs(dx) < w + 2.5 && v < drift - 0.5 && v > -1.5 && !(Math.abs(dx) < 5.5 && v > 0.6)) c = mc(M_SNOW, 0.42 + (dx < 0 ? 0.12 : 0) + (v > drift - 1.4 ? 0.14 : 0), lampAt(X, Y, light.z, 0, -1), X, Y);
          else if (Math.abs(dx) < 5.5 && v < 4.2) {               // three stone steps
            const st = fl(v / 1.4), f = v - st * 1.4, sw = 5.5 - st * 0.9;
            if (Math.abs(dx) < sw) c = f > 1.05 ? mc(M_SNOW, 0.6 + (dx < 0 ? 0.1 : 0), lampAt(X, Y, light.z, 0, -1), X, Y) : mc(M_STONE, 0.28 - f * 0.08 + (dx < 0 ? 0.06 : 0), lampAt(X, Y, light.z, 0, 0), X, Y);
          }
          if (c < 0 && Math.abs(q) < 1 && v >= 0) {
            const nc = Math.sqrt(1 - q * q), blk = frac(Math.asin(q) * w / 5.2 + (fl(v / 3.2) & 1) * 0.5), cr = frac(v / 3.2);
            let sh = 0.24 + 0.34 * Math.max(0, -q * 0.7 + nc * 0.5) + (ih(fl(Math.asin(q) * w / 5.2 + (fl(v / 3.2) & 1) * 0.5), fl(v / 3.2), 958) - 0.5) * 0.1;
            if (cr < 0.12 || blk < 0.06 / Math.max(0.3, nc)) sh -= 0.12; else if (cr > 0.8) sh -= 0.05; else if (cr < 0.25) sh += 0.05;
            c = v > 5.2 ? mc(M_SNOW, 0.55 + (dx < 0 ? 0.12 : 0), 0, X, Y) : mc(M_STONE, sh, lampAt(X, Y, light.z, q * 0.9, 0), X, Y);
          }
        } else if (v <= H) {
          const u = v / H, w = lerp(TW.w0, TW.w1, u);
          if (Math.abs(dx) < w) {
            const q = dx / w, nc = Math.sqrt(1 - q * q), ang = Math.asin(q);
            // masonry under the whitewash: courses, blocks foreshortened round the curve, each with its bevel
            const cv = v / 3.4, course = fl(cv), cr = cv - course, bk = ang * w / 4.6 + (course & 1) * 0.5, bf = frac(bk), bi = fl(bk);
            let sh = 0.3 + 0.78 * Math.max(0, -q * (-lx) * 0.95 + nc * 0.5) + 0.1 * sstep(0.82, 0.98, q);   // moonlit side, and the storm's rim on the far edge
            sh += (ih(bi, course, 961) - 0.5) * 0.05;
            if (cr < 0.08 || bf < 0.035 / Math.max(0.3, nc)) sh -= 0.07; else if (cr > 0.84) sh -= 0.025; else if (cr < 0.22) sh += 0.03;
            // weathering: streaks down from the gallery and the windows, salt and grime low down, a crack or two
            const streak = vn(ang * 9, v * 0.035, 1, 962), grime = (1 - sstep(6, 26, v)) * (0.6 + 0.4 * vn(ang * 6, v * 0.2, 1, 963));
            if (streak > 0.72) sh -= (streak - 0.72) * 0.35 * (0.4 + 0.6 * u);
            sh -= grime * 0.12;
            for (let wi = 0; wi < 3; wi++) { const wv = 34 + wi * 28; if (v < wv - 3 && v > wv - 16 && Math.abs(dx - 1) < 2.4) sh -= 0.05 * (1 - (wv - 3 - v) / 13); }
            const band = (u > 0.3 && u < 0.4) || (u > 0.62 && u < 0.72), bandEdge = Math.abs(u - 0.3) < 0.004 || Math.abs(u - 0.4) < 0.004 || Math.abs(u - 0.62) < 0.004 || Math.abs(u - 0.72) < 0.004;
            let m = band ? M_REDW : M_WHITEW;
            if (bandEdge) sh -= 0.08;
            // snow plastered on the windward side, and lying on every ledge
            if (q < -0.35 && ih(fl(ang * 40), fl(v * 1.5), 964) > 0.93) { m = M_SNOW; sh = 0.85; }
            // the door, arched, in a deep reveal: planks, iron straps, a ring; its glow when the kit slips in
            if (v < 18.5 && Math.abs(dx) < 4.6) {
              const ar = 12.2 + 3.6 * Math.sqrt(Math.max(0, 1 - dx * dx / 13));
              if (v < ar + 1.2 && Math.abs(dx) < 4.6) {
                const inner = Math.abs(dx) < 3.5 && v < ar - 0.4 && v > 6.5;
                if (inner) {
                  const g = door; if (g > 0.05 && d < g * (1 - (v - 6.5) / 14)) c = g > 0.6 && v < 12 ? 182 : 180;
                  else { const plank = frac((dx + 3.5) / 1.75) < 0.12, strap = Math.abs(v - 9) < 0.45 || Math.abs(v - 14) < 0.45; c = strap ? mc(M_IRON, 0.32, lampAt(X, Y, light.z, 0, 0), X, Y) : mc(M_WOOD, 0.2 + (plank ? -0.08 : 0) + (dx < 0 ? 0.06 : 0), lampAt(X, Y, light.z, 0, 0) * 1.1, X, Y); if (Math.hypot(dx - 2, v - 11) < 0.7) c = mc(M_BRASSM, 0.5, 0.3, X, Y); }
                } else if (v > 6.5) { m = M_STONE; sh = 0.36 + (dx < 0 ? 0.08 : -0.04) - (Math.abs(dx) < 4 ? 0.12 : 0); }
              }
            }
            // three small windows up the tower: a stone surround, dark glass (or lit), a sill holding snow
            for (let wi = 0; wi < 3 && c < 0; wi++) {
              const wv = 34 + wi * 28, ex = dx - 1, ev = v - wv;
              if (Math.abs(ex) < 2.4 && ev > -3.6 && ev < 3.4) {
                if (ev < -2.8) c = mc(M_SNOW, 0.6, 0, X, Y);
                else if (Math.abs(ex) < 1.5 && ev < 2.6 && ev > -2.6) c = lit > 0.3 ? (ev > 0 ? 182 : 181) : (ex < -0.6 && ev > 0.8 ? 243 : d < 0.25 ? 242 : 241);
                else { m = M_STONE; sh = 0.4 + (ex < 0 ? 0.08 : -0.05); }
              }
            }
            if (c < 0) c = mc(m, sh, lampAt(X, Y, light.z, q * 0.9, 0) * 1.2 + lit * 0.25 * (u > 0.85 ? 1 : 0), X, Y);
          } else if (v > H - 5 && Math.abs(dx) < TW.w1 + 3) {        // the corbels under the gallery
            const cb = frac((dx + 30) / 2.6), cv = (v - (H - 5)) / 5;
            if (Math.abs(cb - 0.5) < 0.22 + cv * 0.25 && Math.abs(dx) < w + 3 * cv) c = mc(M_STONE, 0.18 + cv * 0.2 + (dx < 0 ? 0.08 : 0), lit * 0.4, X, Y);
          }
        } else {
          const vv = v - H;
          if (vv <= TW.gal) {
            // the gallery: its slab (snowed on), a railing of posts, a mid rail and a top rail
            if (vv < 1.5 && Math.abs(dx) < TW.w1 + 4) c = vv > 1.0 ? mc(M_SNOW, 0.6 + (dx < 0 ? 0.12 : 0), lit * 0.3, X, Y) : mc(M_STONE, 0.3 + (dx < 0 ? 0.08 : 0), lit * 0.5, X, Y);
            else if (Math.abs(dx) < TW.w1 + 3.6) {
              const post = Math.abs(frac((dx + 30) / 2.3) - 0.5) < 0.16, rail = vv > TW.gal - 0.55 || Math.abs(vv - 2.1) < 0.25;
              if (post || rail) c = mc(M_IRON, 0.22 + (rail && vv > TW.gal - 0.55 ? 0.14 : 0) + (dx < 0 ? 0.08 : 0), lit * 0.6, X, Y);
              if (rail && vv > TW.gal - 0.3 && dx < -3 && d < 0.5) c = mc(M_SNOW, 0.6, 0, X, Y);
            }
          } else if (vv <= TW.gal + TW.room) {
            // the lantern room: a low iron sill, then glazing between mullions with diagonal storm panes
            const rw = TW.w1 * 0.88, ry = vv - TW.gal, q = dx / rw;
            if (Math.abs(q) < 1) {
              const ang = Math.asin(q), seg = ang / (PI / 5), sf = frac(seg + 0.5), mull = Math.abs(sf - 0.5) > 0.5 - 0.06 / Math.max(0.35, Math.cos(ang));
              const lat = Math.abs(frac((ang * rw + ry) / 5.5) - 0.5) < 0.05 || Math.abs(frac((ang * rw - ry) / 5.5) - 0.5) < 0.05;
              if (ry < 2.4) c = mc(M_IRON, 0.24 + (q < 0 ? 0.1 : 0) - (ry < 0.4 ? 0.06 : 0), lit * 0.8, X, Y);
              else if (ry > TW.room - 0.9 || mull) c = mc(M_IRON, 0.26 + (q < 0 ? 0.1 : 0), lit * 0.8, X, Y);
              else if (lit > 0.02) {
                // alight: the lens burning gold-white inside, its prism rings as bright bands, hottest at the centre
                const r = Math.hypot(q, (ry - TW.room / 2) / (TW.room / 2)), ring = Math.abs(frac((ry - TW.room / 2) / 1.6) - 0.5) < 0.12 ? 0.18 : 0;
                const g = lit * (1.25 - r * 0.6 + ring) - (lat ? 0.25 : 0);
                c = g > 1 ? 22 : g > 0.8 ? 60 : g > 0.6 ? 200 : g > 0.4 ? 199 : g > 0.2 ? 182 : 181;
              } else if (lat) c = mc(M_IRON, 0.2, 0, X, Y);
              else {
                // dark glass holding the storm: lighter where it faces the sky, a cold streak of reflection, the lens
                // faint behind it
                const refl = 0.3 + 0.35 * (1 - ry / TW.room) + (q < -0.2 ? 0.2 : 0) + (Math.abs(q + 0.45 - ry * 0.03) < 0.08 ? 0.5 : 0), lens = Math.abs(q) < 0.45 && Math.abs(frac(ry / 1.6) - 0.5) < 0.1 ? 0.12 : 0;
                const g = refl + lens + (d - 0.5) * 0.18;
                c = g > 0.95 ? 194 : g > 0.75 ? 246 : g > 0.55 ? 244 : g > 0.35 ? 243 : 242;
              }
            }
          } else if (vv <= TW.gal + TW.room + TW.cap + 7) {
            // the domed cap with its ribs and a cushion of snow, the ventilator ball, the lightning rod and the vane
            const cv = (vv - TW.gal - TW.room) / TW.cap, cw = TW.w1 * 0.98 * Math.sqrt(Math.max(0, 1 - cv * cv * 0.86));
            if (cv < 0.84 && Math.abs(dx) < cw) {
              const q = dx / Math.max(0.5, cw), rib = Math.abs(frac(Math.asin(clamp(q, -1, 1)) / (PI / 6) + 0.5) - 0.5) > 0.42;
              const snow = q < 0.1 && cv > 0.25 + q * 0.3 && vn(dx * 1.4, cv * 6, 1, 966) > 0.4;
              c = snow ? mc(M_SNOW, 0.55 + (q < -0.4 ? 0.12 : 0), lit * 0.2, X, Y) : mc(M_IRON, 0.16 + (q < -0.3 ? 0.18 : 0) + (rib ? 0.1 : 0) + (cv < 0.08 ? 0.1 : 0) - (q > 0.6 ? 0.06 : 0), lit * 0.4, X, Y);
            } else {
              const bvv = (vv - TW.gal - TW.room) - TW.cap * 0.84;
              if (Math.hypot(dx, bvv - 1.4) < 1.5) c = mc(M_IRON, 0.3 + (dx < -0.4 && bvv > 1.6 ? 0.3 : 0), lit * 0.3, X, Y);
              else if (Math.abs(dx) < 0.35 && bvv > 2.6 && bvv < 6.8) c = mc(M_IRON, 0.32, 0, X, Y);
              else if (bvv > 5.0 && bvv < 5.7 && dx > -3.2 && dx < 3.2) c = mc(M_IRON, 0.3, 0, X, Y);                 // the vane's arm
              else if (bvv > 4.6 && bvv < 6.1 && dx > 2.4 && dx < 3.8 && Math.abs(bvv - 5.35) < (3.8 - dx) * 0.6) c = mc(M_IRON, 0.36, 0, X, Y);   // its arrowhead
            }
          }
        }
        if (c >= 0) BUF[Y * W + X] = c;
      }
    }
    return { lamp: [bx, top - (TW.gal + TW.room / 2) * S], door: [bx, by - 9 * S] };
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
