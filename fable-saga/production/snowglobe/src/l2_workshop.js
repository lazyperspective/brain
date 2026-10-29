  /* ================================================================ L2 — the toymaker's workshop, through the shop window
     Warm under a green-shaded lamp. On the workbench: the snow globe (the window to L1, the cabin in the woods), a paint
     pot, a hammer, curls of shavings. On the right the old toymaker, white-bearded, spectacles on, painting a wooden
     soldier, brush going up and down. On the left, shelves of toys (a teddy, a drum, soldiers, blocks, a ball, a top, a
     doll, a train that runs along the top shelf). A frosty window behind him, snow falling outside. */
  {
    const LAMP = [0, -86], CURLS = [[40, 44], [56, 45], [-42, 45], [148, 44]], BLOCKS = [[-6, 0, 'A', R_RED], [6, 0, 'B', [88, 45, 46, 47]], [0, -11, 'C', R_PINE]], R_DOLL = [171, 172, 158, 37], R_BLUE = [88, 45, 46, 47], R_IRON = [32, 33, 34, 22];
    const segD = (px, py, ax, ay, bx, by) => { const vx = bx - ax, vy = by - ay, w = clamp(((px - ax) * vx + (py - ay) * vy) / (vx * vx + vy * vy), 0, 1), dx = px - ax - vx * w, dy = py - ay - vy * w; return Math.sqrt(dx * dx + dy * dy); };
    // toys: [kind, x of its bottom centre, y of the shelf it sits on]
    const SH = [-72, -34, 4], TOYS = [
      ['teddy', -222, -34], ['drum', -192, -34], ['soldier', -168, -34], ['soldier', -158, -34], ['ball', -134, -34], ['top', -108, -34], ['doll', -82, -34],
      ['blocks', -224, 4], ['horse', -184, 4], ['jack', -142, 4], ['teddy', -112, 4], ['drum', -84, 4],
      ['soldier', 92, 46]];
    const S_ = (k, v) => clamp(v * k, 0, 1);
    function toyPix(k, x, y, d, L) {
      // x, y: from the toy's bottom centre (y up is negative)
      const sk = 0.45 + L * 0.7;
      switch (k) {
        case 'teddy': { const hq = x * x + (y + 19) ** 2, bq = (x / 7) ** 2 + ((y + 7) / 7.5) ** 2, eq = Math.min((x + 4.5) ** 2 + (y + 24) ** 2, (x - 4.5) ** 2 + (y + 24) ** 2);
          if (hq < 2.2 && y > -18.5) return 27; if (Math.abs(y + 20.5) < 0.7 && (Math.abs(x + 2) < 0.7 || Math.abs(x - 2) < 0.7)) return 0;
          if (hq < 30 || bq < 1 || eq < 6.5) return rp(R_WOOD, S_(sk, 0.75 - x * 0.03 - (eq < 6.5 && eq > 2 ? 0 : 0)), d); return -1; }
        case 'drum': { if (Math.abs(x) > 8 || y < -13 || y > 0) return -1; if (y < -11) return rp(R_CREAM, S_(sk, 0.9), d); if (y > -2.5 || y < -9.5) return rp(R_BRASS, S_(sk, 0.8), d);
          return Math.abs(((x + 20) % 6) - 3) < 0.9 + Math.abs(y + 6) * 0.0 && Math.abs(Math.abs(((x + 20) % 6) - 3) - Math.abs(y + 6) * 0.8) < 0.9 ? rp(R_BRASS, S_(sk, 0.9), d) : rp(R_RED, S_(sk, 0.7 - x * 0.04), d); }
        case 'soldier': { if (Math.abs(x) > 3.2 || y < -25 || y > 0) return -1; if (y < -19) return Math.abs(x) < 2.6 ? 39 : -1; if (y < -15.5) return Math.abs(x) < 2 ? rp(R_SKIN, S_(sk, 0.9), d) : -1;
          if (y < -8) return Math.abs(x) < 0.6 && y > -14 ? rp(R_BRASS, S_(sk, 1), d) : rp(R_RED, S_(sk, 0.75 - x * 0.06), d); if (y < -1) return Math.abs(x) < 0.5 ? -1 : rp(R_BLUE, S_(sk, 0.6), d); return 39; }
        case 'ball': { const q = x * x + (y + 6.5) ** 2; if (q > 42) return -1; const b = fl((y + 13 + x * 0.3) / 3.3); return q < 3 && x < 0 && y < -8 ? 22 : rp((((b % 3) + 3) % 3) === 0 ? R_RED : (((b % 3) + 3) % 3) === 1 ? R_CREAM : R_BLUE, S_(sk, 0.8 - x * 0.05 - (y + 6.5) * 0.04), d); }
        case 'top': { const yy = -y; if (yy < 0 || yy > 13) return -1; const hw = yy < 2 ? yy * 1.2 : yy < 9 ? 2.4 + (yy - 2) * 0.75 : yy < 11 ? 7.6 - (yy - 9) * 2.5 : 1.2; if (Math.abs(x) > hw) return -1; return yy > 11 ? 28 : rp(fl(yy / 2.4) % 2 ? R_RED : R_BRASS, S_(sk, 0.8 - x * 0.06), d); }
        case 'doll': { const hq = x * x + (y + 19) ** 2; if (hq < 16) { if (y < -20.5 || Math.abs(x) > 3) return rp(R_BRASS, S_(sk, 0.9), d); if (Math.abs(y + 19) < 0.6 && Math.abs(Math.abs(x) - 1.5) < 0.6) return 0; return rp(R_SKIN, S_(sk, 0.95), d); }
          const yy = -y; if (yy < 15 && yy > 0 && Math.abs(x) < 1.5 + (15 - yy) * 0.33) return rp(R_DOLL, S_(sk, 0.7 - x * 0.05), d); return -1; }
        case 'blocks': { for (let bi = 0; bi < 3; bi++) { const bx = BLOCKS[bi][0], by = BLOCKS[bi][1], ch = BLOCKS[bi][2], c = BLOCKS[bi][3]; const lx = x - bx, ly = y - by; if (Math.abs(lx) < 5.5 && ly > -11 && ly <= 0) { if (glyphAt(ch, lx, ly, -2.5, -9.5, 1.15)) return rp(R_CREAM, S_(sk, 1), d); return rp(c, S_(sk, 0.7 - lx * 0.04), d); } } return -1; }
        case 'horse': { const leg = (y > -6 && y <= 0 && (Math.abs(x + 7) < 1.3 || Math.abs(x - 6) < 1.3)), rock = y > -1.5 && y <= 0 && Math.abs(x) < 12 + y * 0.5 && Math.abs(Math.sqrt(x * x + (y - 30) ** 2) - 31) < 1.2;
          const body = ((x + 0.5) / 9) ** 2 + ((y + 9) / 4.2) ** 2 < 1, neck = segD(x, y, 6, -10, 10, -19) < 2.6, head = ((x - 12.5) / 3.6) ** 2 + ((y + 19) / 2.4) ** 2 < 1, tail = segD(x, y, -9, -10, -13, -5) < 1;
          if (rock) return rp(R_RED, S_(sk, 0.6), d); if (neck && x < 9 && y < -14 && Math.abs(x - 7.5) < 1) return rp(R_BRASS, S_(sk, 0.7), d);
          if (body || neck || head || leg) return (Math.abs(x - 12) < 0.6 && Math.abs(y + 19.8) < 0.6) ? 0 : rp(R_CREAM, S_(sk, 0.75 - x * 0.02), d); if (tail) return rp(R_BRASS, S_(sk, 0.6), d); return -1; }
        case 'jack': { if (Math.abs(x) < 7 && y > -12 && y <= 0) return (Math.abs(x) < 1 || Math.abs(y + 6) < 1) ? rp(R_BRASS, S_(sk, 0.8), d) : rp(R_BLUE, S_(sk, 0.6 - x * 0.05), d);
          const bob = 1.5 * Math.sin(0); if (y > -18 && y <= -12 && Math.abs(Math.abs(x) - (y + 15) * 0.9) < 1.1) return 34; const hq = x * x + (y + 22 + bob) ** 2; if (hq < 16) return (Math.abs(y + 22.6) < 0.7 && Math.abs(Math.abs(x) - 1.6) < 0.6) ? 0 : y < -24.5 ? rp(R_RED, S_(sk, 0.8), d) : rp(R_SKIN, S_(sk, 0.9), d); return -1; }
      }
      return -1;
    }
    function c2Draw(V, t) {
      const pk = 0.92 + 0.08 * Math.sin(zP(t, 2)), brush = Math.sin(zP(t, 8)), trainX = -150 + 70 * Math.sin(zP(t, 2));
      const hand = [100 + 1.2 * brush, 26 - 3.5 * brush], elbow = [118, 12];
      V.each(-330, -210, 330, 210, (x, y, X, Y) => {
        const d = bay(X, Y), q = (x - LAMP[0]) ** 2 + (y - LAMP[1]) ** 2, cone = y > LAMP[1] ? sstep(-1.1, -0.4, -Math.abs(x) / (y - LAMP[1] + 18)) : 0;
        const Ll = lit(q, 120) * pk, L = 0.08 + Ll * 0.55 + cone * 0.35 * pk, Lwin = lit((x - 192) ** 2 + (y + 78) ** 2, 60) * 0.25;
        if (x > -39 && x < 39 && y > -39 && y < 49) { const g = globePix(x, y, d, -1); if (g >= 0) return g; }
        // the lamp: cord, green enamel shade, the bulb
        if (Math.abs(x) < 0.8 && y < -100) return 39;
        if (y >= -101 && y < -88 && Math.abs(x) < 6 + (y + 101) * 1.25) return y > -90.5 ? rp(R_BRASS, 0.8, d) : rp(R_PINE, clamp(0.55 - x / 40 + (y + 101) * 0.02, 0, 1), d);
        if ((x * x) / 30 + (y + 86) ** 2 / 8 < 1 && y > -88) return 22;
        // the toymaker: cap, hair and beard, face and spectacles, sweater and apron, arms, the brush
        if (x > 84 && x < 172 && y > -44 && y < 46) { const hx = x - 124, hy = y + 26;
          if (segD(x, y, hand[0], hand[1], hand[0] - 3, hand[1] - 9) < 0.7) return y < hand[1] - 7 ? 157 : 162;                 // the brush, its red tip
          if (segD(x, y, 132, -8, elbow[0], elbow[1]) < 5.2 || segD(x, y, elbow[0], elbow[1], hand[0], hand[1]) < 4.4) return Math.hypot(x - hand[0], y - hand[1]) < 3.4 ? rp(R_SKIN, clamp(0.5 + L * 0.5, 0, 1), d) : rp(R_PINE, clamp(0.2 + L * 0.8, 0, 1), d);
          const tq = ((x - 140) / 27) ** 2 + ((y - 26) / 36) ** 2;                                                           // the torso, round-shouldered
          if (tq < 1 && y < 46 && y > -12) { const ax = x - 128, apron = y > -2 && Math.abs(ax) < 11 + (y + 2) * 0.12 && !(y < 8 && Math.abs(ax) > 7), str = Math.abs(ax + 8 - (y + 2) * 0.35) < 1 && y < 0;
            if (apron) return Math.abs(y - 26) < 1 && Math.abs(ax) < 7 ? rp(R_BRASS, 0.4, d) : rp(R_CREAM, clamp(0.2 + L * 0.65 - Math.abs(ax) * 0.01, 0, 1), d);
            return rp(R_PINE, clamp(0.24 + L * 0.6 - (x - 132) * 0.006 - Math.max(0, tq - 0.7) * 0.3, 0, 1), d); }
          const hq = (hx / 12.5) ** 2 + (hy / 14) ** 2, bq = ((x - 121) / 12) ** 2 + ((y + 8) / 12) ** 2;
          if (hy < -7 && hq < 1.15 && Math.abs(hx) < 13) return rp(R_RED, clamp(0.3 + L * 0.6 - hx * 0.02, 0, 1), d);                    // the knitted cap
          if (hy > 1 && bq < 1 && y < 4) return rp(R_CREAM, clamp(0.45 + L * 0.5 - (x - 120) * 0.02, 0, 1), d);                          // the beard
          if (hq < 1) {
            if ((Math.hypot(hx + 7, hy + 1) < 3 && Math.hypot(hx + 7, hy + 1) > 2) || (Math.hypot(hx + 1, hy + 1) < 3 && Math.hypot(hx + 1, hy + 1) > 2) || (Math.abs(hy + 1) < 0.5 && hx > -5 && hx < -3)) return rp(R_BRASS, 0.9, d);
            if (Math.hypot(hx + 7, hy + 1) < 2) return d < 0.5 ? 170 : 147;                                                               // the lens, glinting
            if (Math.abs(hy - 3) < 1 && hx < -6 && hx > -11) return rp(R_SKIN, 0.4, d);
            if (hx > 6) return rp(R_CREAM, clamp(0.4 + L * 0.4, 0, 1), d);                                                                 // his white hair
            return rp(R_SKIN, clamp(0.35 + L * 0.65 - hx * 0.03, 0, 1), d);
          } }
        // on the bench: the soldier being painted, the paint pot, the hammer, shavings
        if (x > 88 && x < 96 && y > 20 && y < 46) { const k = toyPix('soldier', x - 92, y - 46, d, L); if (k >= 0) return k; }
        if (x > -78 && x < -60 && y > 34 && y < 46) return y < 36 ? rp(R_RED, 0.7, d) : rp(R_IRON, clamp(0.3 + L * 0.6 - (x + 69) * 0.03, 0, 1), d);
        if ((x > -132 && x < -100 && y > 42 && y < 45.5) || (x > -138 && x < -128 && y > 37 && y < 46)) return x < -128 ? rp([32, 33, 34], 0.5 + L * 0.4, d) : rp(R_WOOD, clamp(0.5 + L * 0.4, 0, 1), d);
        if (y > 40 && y < 47) for (let ci = 0; ci < 4; ci++) { const cx = CURLS[ci][0], cy = CURLS[ci][1]; const r = Math.hypot(x - cx, y - cy); if (r < 3.4 && r > 1.8 && y < cy + 1.2) return rp(R_WOOD, 0.85, d); }
        // the workbench
        if (y >= 46 && y < 54 && Math.abs(x) < 300) return rp(R_WOOD, clamp(0.25 + L * 0.7 - (y - 46) * 0.04 + (y < 47.5 ? 0.15 : 0) + 0.06 * Math.sin(x * 0.07 + Math.sin(x * 0.013) * 3), 0, 1), d);
        if (y >= 54 && Math.abs(x) < 300) { const dr = Math.floor((x + 300) / 74), lx = (x + 300) % 74; if (lx < 2 || (y > 80 && y < 82)) return 159; if (Math.abs(lx - 37) < 3 && Math.abs(y - 67) < 1.6) return rp(R_BRASS, 0.8, d); return rp(R_WOOD, clamp(0.12 + L * 0.5 - (y - 54) * 0.002 + ih(dr, 1, 801) * 0.06, 0, 1), d); }
        // the toys on the shelves, the shelves
        for (let ti = 0; ti < TOYS.length; ti++) { const T_ = TOYS[ti], k = T_[0], tx = T_[1], ty = T_[2]; if (ty > 40 || Math.abs(x - tx) > 14 || y > ty || y < ty - 30) continue; const c = toyPix(k, x - tx, y - ty, d, L + 0.15); if (c >= 0) return c; }
        if (Math.abs(y + 76) < 8 && Math.abs(x - trainX) < 16) {                                                                              // the train on the top shelf
          const lx = x - trainX, ly = y + 72; if (ly > -2 && ly < 0 && (Math.abs(((lx + 40) % 7) - 3.5) < 1.6)) return 39;
          if (ly <= -2 && ly > -9 && lx > -14 && lx < 10) return lx > 2 && ly < -6 ? -1 : rp(lx < -4 ? R_RED : [39, 40, 41], clamp(0.4 + L * 0.5, 0, 1), d);
          if (lx > 5 && lx < 8 && ly <= -6 && ly > -13) return 39;
          if (lx > 10 && lx < 14 && ly <= -2 && ly > -6) return rp(R_BRASS, 0.7, d); }
        for (const sy of SH) if (y >= sy && y < sy + 4 && x > -248 && x < -60) return rp(R_WOOD, clamp(0.2 + L * 0.6 + (y < sy + 1 ? 0.2 : 0), 0, 1), d);
        if (y > -76 && y < -72 && x > -248 && x < -60) return rp([32, 33], 0.3, d);                                                       // the toy train's rail
        // the window behind the toymaker, frosted, snow outside
        if (x > 150 && x < 236 && y > -106 && y < -48) {
          if (x < 154 || x > 232 || y < -102 || y > -52 || Math.abs(x - 193) < 1.6 || Math.abs(y + 77) < 1.6) return rp(R_WOOD, clamp(0.2 + L * 0.5, 0, 1), d);
          const fr = Math.min(x - 154, 232 - x, y + 102, -52 - y); if (fr < 5 && ih(fl(x * 3), fl(y * 3), 802) < (5 - fr) / 6) return 169;
          return y > -62 + 3 * Math.sin(x * 0.1) ? rp(R_SNOW, 0.5, d) : rp(R_NIGHT, 0.35 + (y + 106) / 140, d);
        }
        // the wall: boards in lamplight, a frieze
        if (y < -108) return rp(R_WOOD, clamp(0.05 + L * 0.35, 0, 1), d);
        if (y < -104 && y >= -108) return rp(R_RED, clamp(0.1 + L * 0.5, 0, 1), d);
        const bd = (x + 400) % 18 < 0.9; return bd ? 159 : rp(R_LOG, clamp(L * 0.85 + Lwin + ih(fl((x + 400) / 18), 2, 803) * 0.07, 0, 1), d);
      });
      zSnow(V, t, 154, -102, 232, -52, 9, 811, 1, [137, 168, 169, 170], (x, y) => Math.abs(x - 193) > 1.6 && Math.abs(y + 77) > 1.6);
      zGlow(V, 0, -84, 60, T_WARM, 0.32 * pk); zGlow(V, 0, -86, 12, T_GOLD, 0.5);
    }
    ZL[2] = { name: 'workshop', draw: c2Draw, mask: globeMask, maskBox: GLOBE_BOX, hole: GLOBE_HOLE };
  }
