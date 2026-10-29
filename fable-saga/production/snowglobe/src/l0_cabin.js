  /* ================================================================ L0 — the cabin, inside
     Seen through its own front window (L1). On a little table in a red cloth: the snow globe (the window to L3, the
     village), a candle on the left, a mug of cocoa on the right. Behind: log walls in firelight; the fireplace on the left
     with four stockings on the mantel and a tabby cat asleep on the rug before it; the tree on the right, its lights
     twinkling, presents beneath; a small back window full of falling snow; a garland along the beam. */
  // the globe (shared with L2's): glass of radius 38 about the origin, its brass and wood base from y = 27 down
  const GLOBE_R = 38;
  function globeMask(x, y) {
    if (y > 27) return 0;
    const r = Math.sqrt(x * x + y * y); let m = clamp((GLOBE_R - r) / 2, 0, 1);
    if (m <= 0) return 0;
    if (r > 26 && r < 32 && y < 0) { const a = Math.atan2(y, x); if (a > -2.65 && a < -1.75) m *= 0.45; }   // the long highlight, upper left
    if ((x - 18) * (x - 18) + (y + 20) * (y + 20) < 9) m *= 0.3;        // a small bright spot, upper right
    return m;
  }
  const GLOBE_BOX = [-38, -38, 38, 28], GLOBE_HOLE = [-20, -10, 24, 25];   // (HOLE: a rect the glass covers whole, clear of the highlights)
  // the globe as its outer layer draws it: rim, highlights, glass (the scene inside replaces most of it), base.
  // lx, ly: where its key light is (to the left for both layers); warm: how warm the room's light is
  function globePix(x, y, d, lx) {
    if (y <= 27) {
      const r = Math.sqrt(x * x + y * y);
      if (r < GLOBE_R) {
        if (r > 26 && r < 32 && y < 0) { const a = Math.atan2(y, x); if (a > -2.65 && a < -1.75) return d < 0.5 ? 22 : 170; }
        if ((x - 18) * (x - 18) + (y + 20) * (y + 20) < 9) return 22;
        if (r > GLOBE_R - 2) { const side = (x * lx < 0 ? 0 : 1); return side ? (d < 0.5 ? 146 : 15) : (d < 0.5 ? 137 : 138); }
        return d < 0.3 ? 137 : 136;
      }
    }
    if (y > 27 && y < 49) {
      const hw = 28 + (y - 27) * 0.24; if (Math.abs(x) > hw) return -1;
      const sh = 0.55 - 0.35 * x / hw * Math.sign(lx) * -1;
      if (y < 31) return rp(R_BRASS, clamp(sh + 0.15 + (y < 28.2 ? 0.25 : 0), 0, 1), d);
      if (y > 45.5) return rp(R_BRASS, clamp(sh * 0.8, 0, 1), d);
      return rp(R_WOOD, clamp(sh * 0.75 + 0.05 * Math.sin(x * 0.9 + y * 0.2), 0, 1), d);
    }
    return -1;
  }
  {
    // the tree: [y of a tier's top, its half-width at the bottom, y of its bottom]
    const TX = 168, TIERS = [[-94, 24, -58], [-74, 40, -26], [-48, 56, 12], [-18, 72, 52]];
    const treeHW = (x, y) => { let best = -1; for (const [y0, w, y1] of TIERS) if (y >= y0 && y <= y1) { const f = (y - y0) / (y1 - y0), e = w * f * (1 - 0.12 * (1 + Math.sin((x - TX) * 0.5 + y * 0.3)) * f); best = Math.max(best, e); } return best; };
    const LIGHTS = [], ORN = [];
    for (let k = 0; k < 70; k++) { const f = ih(k, 1, 601), y = -88 + f * 136, hw = Math.max(4, treeHW(TX, y) - 4), x = TX + (ih(k, 2, 601) * 2 - 1) * hw * 0.92; LIGHTS.push([x, y, k % 4, ih(k, 3, 601)]); }
    for (let k = 0; k < 16; k++) { const f = ih(k, 1, 602), y = -80 + f * 125, hw = Math.max(4, treeHW(TX, y) - 7), x = TX + (ih(k, 2, 602) * 2 - 1) * hw * 0.85; ORN.push([x, y, k % 3]); }
    const R_TABBY = [38, 36, 35, 37];
    const LCOL = [[157, 158], [15, 16], [46, 47], [49, 50]], OCOL = [R_RED, R_BRASS, [88, 45, 46, 47]];
    const STOCK = [[-236, 157], [-201, 151], [-166, 157], [-131, 151]];
    const FIRE = [-180, 30], CANDLE = [-87, 0], PRESENTS = [[96, 128, 28, 0, 1], [124, 150, 36, 1, 0], [188, 226, 24, 2, 0], [214, 246, 40, 0, 2]], PRAMP = [R_RED, R_PINE, [88, 45, 46, 47]];
    const star5 = (x, y, r) => { const a = Math.atan2(y, x), q = Math.sqrt(x * x + y * y), k = Math.cos(5 * (a + PI / 2)) * 0.5 + 0.5; return q < r * (0.45 + 0.55 * k * k); };
    function c0Draw(V, t) {
      const fk = flick(t, 1), ck = flick(t, 4.2), br = 1 + 0.03 * Math.sin(zP(t, 4));
      V.each(-330, -210, 330, 210, (x, y, X, Y) => {
        const d = bay(X, Y);
        // the light that reaches here: the fire, the candle, the tree, and a little from the room
        const qf = (x - FIRE[0]) ** 2 + (y - FIRE[1]) ** 2, qc = (x - CANDLE[0]) ** 2 + (y - CANDLE[1]) ** 2, qt = (x - TX) ** 2 + (y + 50) ** 2;
        const Lf = lit(qf, 130) * fk, Lc = lit(qc, 60) * ck, Lt = lit(qt, 80) * 0.5, Lm = 0.07 + Lf * 0.55 + Lc * 0.22 + Lt * 0.3;
        if (x > -39 && x < 39 && y > -39 && y < 49) { const g = globePix(x, y, d, -1); if (g >= 0) return g; }
        // the candle: flame, wax, holder
        if (x > -97 && x < -77 && y > -12 && y < 46) { const fx = x - CANDLE[0], fy = y - CANDLE[1], sway = 0.8 * Math.sin(zP(t, 11)) * (fy < 0 ? -fy / 9 : 0);
          if (fy > -10 && fy < 6) { const w = fy < 0 ? 2.6 * Math.sqrt(1 + fy / 10) : 2.6 * Math.sqrt(Math.max(0, 1 - fy / 6)); if (Math.abs(fx - sway) < w) return Math.abs(fx - sway) < w * 0.45 && fy > -6 ? 22 : fy > 3 ? 14 : 16; }
          if (Math.abs(fx) < 5 && fy >= 6 && fy < 40) return rp(R_CREAM, clamp(0.85 - 0.08 * (fy - 6) / 34 + (fx < 0 ? 0.1 : -0.2), 0, 1), d);
          if (Math.abs(fx) < 9 - (fy - 40) * 0.2 && fy >= 40 && fy < 46) return rp(R_BRASS, fx < 0 ? 0.8 : 0.4, d); }
        // the mug of cocoa, its snowflake band, its handle
        if (x > 58 && x < 92 && y > 22 && y < 46) { const mx = x - 71;
          if (Math.abs(mx) < 11 && y >= 25 && y < 46) { const s = 0.55 - mx / 22; if (y < 27) return 28; if (y > 31 && y < 36) return (Math.abs(((mx + 22) % 6) - 3) < 1 && y > 32 && y < 35) ? 157 : rp(R_CREAM, clamp(s + 0.1, 0, 1), d); return rp(R_RED, clamp(s + 0.15, 0, 1), d); }
          const hx = x - 85, hy = y - 35, hq = hx * hx + hy * hy; if (x > 81 && hq < 34 && hq > 10) return 156; }
        // the table in its red cloth (gold trim along the edge), the floor beyond
        { const ty = y - 48;
          if (ty > -3 && ty < 3 && Math.abs(x) < 150) return rp(R_RED, clamp(0.45 + Lm * 0.5 - (ty + 3) * 0.05, 0, 1), d);
          if (ty >= 3 && Math.abs(x) < 150 + ty * 0.16) { const fold = 0.5 + 0.28 * Math.sin(x * 0.11 + Math.sin(x * 0.03) * 2) * Math.min(1, ty / 30); if (Math.abs(ty - 5) < 1.2) return d < 0.5 ? 175 : 174; return rp(R_RED, clamp(fold * (0.4 + Lm * 0.7) - ty * 0.002, 0, 1), d); } }
        // the cat asleep on the rug
        if (x > -235 && x < -160 && y > 60 && y < 98) { const ox = -25, cx = x + 180 - ox, cy = y - 80, bq = (cx / 24) ** 2 + (cy / (10 * br)) ** 2, hq = (x + 157 - ox) ** 2 + (y - 78) ** 2, ex = x - ox;
          const ear = (y < 71 && y > 65 && ((ex > -163 && ex < -158 && y > 65 + (ex + 163) * 1.1) || (ex > -156 && ex < -151 && y > 65 + (-151 - ex) * 1.1)));
          const tail = Math.abs(Math.hypot(ex + 180, y - 82) - 22) < 2.4 && y > 82 && ex < -170 + 4 * Math.sin(zP(t, 2));
          if (bq < 1 || hq < 64 || ear || tail) { const stripe = Math.sin((ex + 180) * 0.55) > 0.55 && hq >= 64 ? -0.25 : 0, s = 0.35 + Lf * 0.6 - (y - 74) * 0.02 + stripe;
            if (hq < 64 && Math.abs(y - 79) < 0.6 && (Math.abs(ex + 160) < 2 || Math.abs(ex + 154) < 2)) return 38;   // closed eyes
            return rp(R_TABBY, clamp(s, 0, 1), d); } }
        // the rug
        { const rq = ((x + 200) / 70) ** 2 + ((y - 94) / 15) ** 2; if (rq < 1) { const ring = fl(Math.sqrt(rq) * 4); return ring === 3 ? rp(R_BRASS, 0.3 + Lf * 0.4, d) : ring % 2 ? rp(R_PINE, 0.3 + Lf * 0.5, d) : rp(R_RED, 0.2 + Lf * 0.6, d); } }
        // the presents beneath the tree
        if (y >= 24 && y < 60 && x >= 96) for (const [bx0, bx1, by0, c0, c1] of PRESENTS) {
          if (x >= bx0 && x < bx1 && y >= by0 && y < 60) { const mx = (bx0 + bx1) / 2, rib = Math.abs(x - mx) < 2 || Math.abs(y - (by0 + 60) / 2) < 2, s = 0.3 + Lt * 0.8 + Lf * 0.2 + (x < mx ? 0.1 : -0.05);
            return rib ? rp(R_BRASS, clamp(s + 0.2, 0, 1), d) : rp(PRAMP[c0], clamp(s, 0, 1), d); }
        }
        // the tree and its star
        if (x > TX - 76 && x < TX + 76 && y > -110 && y < 63) { if (star5(x - TX, y + 100, 8)) return d < 0.6 ? 16 : 59;
          const hw = treeHW(x, y); if (hw >= 0 && Math.abs(x - TX) < hw) { const n = vn(x * 0.35, y * 0.35, 1, 603), e = (x - TX) / hw; return rp(R_PINE, clamp(0.25 + n * 0.35 - e * 0.18 + Lf * 0.25 + Lt * 0.35, 0, 1), d); }
          if (x > TX - 6 && x < TX + 6 && y > 50 && y < 62) return rp(R_WOOD, 0.3, d); }
        // the stockings on the mantel
        if (x > -245 && x < -114 && y > -52 && y < -18) for (const [sx, sc] of STOCK) {
          const fx = x - sx; if (y < -52 || y > -18 || fx < -8 || fx > 15) continue;
          if (y < -45 && Math.abs(fx) < 8) return rp(R_CREAM, 0.6 + Lf * 0.3, d);
          if ((Math.abs(fx) < 7 && y < -26) || (fx > -7 && fx < 14 && y >= -26 && Math.hypot(Math.max(0, fx - 8), y + 22) < 5)) return rp(sc === 157 ? R_RED : R_PINE, clamp(0.3 + Lf * 0.6 - fx * 0.01, 0, 1), d);
        }
        // the mantel, the fireplace and its fire
        if (x > -262 && x < -98 && y > -60 && y < -52) return rp(R_WOOD, clamp(0.35 + Lf * 0.45 + (y < -58 ? 0.2 : 0), 0, 1), d);
        if (x > -250 && x < -110 && y >= -52 && y < 60) {
          if (x > -212 && x < -148 && y > -6) {
            const h = 52 - y, cxp = x + 180;
            if (h < 8 && Math.abs(cxp) < 26 && ((h > 2 && h < 7) || Math.abs(cxp - 10) < 9 && h < 4)) return rp(R_WOOD, 0.3 + 0.2 * Math.sin(cxp), d);
            let I = h < 9 ? Math.max(0, 0.55 - Math.abs(cxp) / 40) * (h < 4 ? 1 : 0.6) : 0;          // embers under the logs
            for (let k = 0; k < 5; k++) {
              const H0 = [22, 32, 40, 31, 21][k] * (0.82 + 0.18 * Math.sin(zP(t, 7 + k * 2) + k)), x0 = [-17, -8, 0, 9, 18][k] + h * 0.09 * Math.sin(h * 0.14 - zP(t, 9 + k) + k);
              if (h > H0 || h < 2) continue;
              const hw = [7, 8, 9, 8, 7][k] * Math.sqrt(1 - h / H0) * (1 + 0.25 * Math.sin(h * 0.35 - zP(t, 13) + k * 2)), e = 1 - Math.abs(cxp - x0) / hw;
              if (e > 0) I = Math.max(I, e * 0.55 + (1 - h / H0) * 0.5);
            }
            if (I > 0.06) return rp(R_FIRE, clamp(I, 0, 1), d);
            return d < 0.2 + Lf * 0.1 ? 28 : 27;
          }
          const sx = Math.floor((x + 250) / 15 + (Math.floor((y + 52) / 10) % 2) * 0.5), sy = Math.floor((y + 52) / 10), mortar = ((x + 250 + (sy % 2) * 7.5) % 15 < 1.2) || ((y + 52) % 10 < 1.2);
          return mortar ? 120 : rp(R_STONE, clamp(0.1 + Lf * 0.7 + ih(sx, sy, 604) * 0.2, 0, 1), d);
        }
        // the back window: frame, cross bars, the snowy night outside
        if (x > -54 && x < 54 && y > -104 && y < -44) {
          if (x < -49 || x > 49 || y < -99 || y > -49 || Math.abs(x) < 2 || Math.abs(y + 74) < 2) return rp(R_WOOD, clamp(0.25 + Lm * 0.5, 0, 1), d);
          const frost = Math.max(0, 0.9 - Math.min(Math.abs(x) - 30, 0) * 0) ;
          if (y > -62 + 4 * Math.sin(x * 0.07)) return rp(R_SNOW, 0.45 + 0.1 * Math.sin(x * 0.2), d);
          const tree = Math.abs(x - 30) < (y + 90) * 0.38 && y > -90, tree2 = Math.abs(x + 34) < (y + 84) * 0.32 && y > -84;
          if (tree || tree2) return d < 0.4 ? 150 : 149;
          return rp(R_NIGHT, 0.35 + (y + 104) / 150, d);
        }
        // the beam and its garland
        if (y < -106) { if (y > -114) { const gw = Math.sin(x * 0.12) * 2; if (Math.abs(y + 108 - gw) < 3.5) return rp(R_PINE, 0.3 + Lm * 0.5, d); } return rp(R_WOOD, clamp(0.08 + Lm * 0.4 + (y > -118 ? 0.1 : 0), 0, 1), d); }
        // the floor
        if (y > 58) { const plank = Math.floor((x + 1000) / 26), s = 0.22 + Lm * 0.6 + ih(plank, 1, 605) * 0.1; return ((x + 1000) % 26) < 1 ? 159 : rp(R_WOOD, clamp(s, 0, 1), d); }
        // the log walls: rounded logs with pale chinking between, each its own tone
        { const yy = y + 1300, n = Math.floor(yy / 13), v = (yy - n * 13) / 13; if (v < 0.1) return d < 0.5 ? 121 : 122;
          const round = Math.sin((v - 0.1) / 0.9 * PI), grain = vn(x * 0.03, n * 3.1, 1, 606) * 0.12 + ih(n, 2, 607) * 0.08;
          return rp(R_LOG, clamp(Lm * (0.35 + 0.65 * round) + grain - 0.06, 0, 1), d); }
      });
      // the tree's lights (twinkling) and its ornaments
      for (const [x, y, k, ph] of LIGHTS) { const on = 0.5 + 0.5 * Math.sin(zP(t, 2 + (k % 3)) + ph * 9), X = fl(V.X(x)), Y = fl(V.Y(y)); if (V.u < 0.5) { P(X, Y, LCOL[k][on > 0.5 ? 1 : 0]); continue; } zDisc(V, x, y, 1.3, LCOL[k][on > 0.5 ? 1 : 0]); if (on > 0.7 && V.u > 0.8) zGlow(V, x, y, 5, k === 1 ? T_GOLD : k === 0 ? T_RED : k === 2 ? T_BL : T_GR, 0.25); }
      for (const [x, y, k] of ORN) { if (V.u < 0.4) continue; V.each(x - 3.5, y - 3.5, x + 3.5, y + 3.5, (px, py, X, Y) => { const q = (px - x) ** 2 + (py - y) ** 2; if (q > 12) return -1; const s = 0.65 - (px - x) * 0.1 - (py - y) * 0.1; return q < 1.5 && px < x ? 22 : rp(OCOL[k], clamp(s, 0, 1), bay(X, Y)); }); }
      // snow outside the back window
      zSnow(V, t, -49, -99, 49, -49, 9, 611, 1, [137, 168, 169, 170], (x, y) => Math.abs(x) > 2 && Math.abs(y + 74) > 2);
      // the cocoa's steam
      V.each(56, -26, 90, 25, (x, y, X, Y) => { let I = 0; for (let k = 0; k < 2; k++) { const xc = 67 + 7 * k + 3 * Math.sin(y * 0.18 + zP(t, 2) + k * 2) + (24 - y) * 0.06, w = 1.3 + (24 - y) * 0.06, e = 1 - Math.abs(x - xc) / w; if (e > 0) I = Math.max(I, e * sstep(-26, 8, y) * sstep(25, 18, y) * (0.55 + 0.45 * Math.sin(y * 0.32 + zP(t, 8) + k * 3))); } return bay(X, Y) < I * 0.5 ? (I > 0.6 ? 20 : 19) : -1; });
      // glows: the fire, the candle, the star
      zGlow(V, FIRE[0], 20, 120, T_WARM, 0.35 * fk); zGlow(V, CANDLE[0], CANDLE[1], 34, T_WARM, 0.45 * ck); zGlow(V, CANDLE[0], CANDLE[1] - 2, 9, T_GOLD, 0.5);
      zGlow(V, TX, -100, 20, T_GOLD, 0.4 + 0.1 * Math.sin(zP(t, 3)));
      // the garland's lights along the beam
      for (let k = -14; k <= 14; k++) { const x = k * 22 + 6, y = -108 + Math.sin(x * 0.12) * 2, on = 0.5 + 0.5 * Math.sin(zP(t, 3) + k * 1.9); zDisc(V, x, y, 1.2, on > 0.5 ? 16 : 15); }
    }
    ZL[0] = { name: 'cabin', draw: c0Draw, mask: globeMask, maskBox: GLOBE_BOX, hole: GLOBE_HOLE };
  }
