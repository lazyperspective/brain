  /* ================================================================ L2 — the town on its hill
     Our street (row 0, streetPix) runs across the middle; behind it more rows of houses climb the hill to a church at the
     top; below it two more rows step down toward the valley. Every window of the town lights in a wave spreading out
     from ours. townPix (in this layer's units) is the town; outside its houses it is the valley (valleyPix, L3's). */
  // the rows: [j, y of the row (L2 units), half-width]; drawn front (j > 0, then 0) to back (j < 0, up the hill)
  const TROWS = [[2, 100, 210], [1, 58, 250], [0, 0, 9999], [-1, -30, 270], [-2, -60, 240], [-3, -90, 205], [-4, -120, 165], [-5, -148, 120]];
  const CHURCH = [8, -176];
  const hill2 = (x) => 8 * hill3(x / 8);
  function townPix(x, y, X, Y, t, ck, skip0) {
    // the church on the top of the hill: its tower and spire, its rose window lit last of all
    { const cx = x - CHURCH[0], cy = y - CHURCH[1];
      if (Math.abs(cx) < 14 && cy > -40 && cy < 22) { const d = bay(X, Y), on = t < 3 ? 1 : sstep(8.2, 8.7, t);
        if (Math.abs(cx) < 4 && cy > -32 && cy < -18 && on > 0) return rp(R_FIRE, 0.5 * on + 0.1, d);
        if (cy < -40 + (Math.abs(cx)) * 0 && false) return -1;
        if (cy < -28) { if (Math.abs(cx) < 7 * (cy + 64) / 36 && cy > -64) return cy < -56 ? rp(R_SNOW, 0.7, d) : rp(R_SLATE, 0.3, d); return -2; }
        return rp(R_PLAST, clamp(0.2 + 0.25 * lit(cx * cx + (cy + 25) ** 2, 14) * on, 0, 1), d); }
      if (Math.abs(cx) < 7 && cy >= -64 && cy < -40) { const d = bay(X, Y); if (Math.abs(cx) < 7 * (cy + 64) / 24) return cy < -58 ? rp(R_SNOW, 0.75, d) : rp(R_SLATE, 0.3, d); } }
    for (let i = 0; i < TROWS.length; i++) {
      const j = TROWS[i][0], yj = TROWS[i][1], hw = TROWS[i][2];
      if (j === 0 && skip0) continue;
      if (Math.abs(x) > hw || y < yj - 23 || y > yj + 23) continue;
      if (j !== 0 && hill2(x) > yj - 14) continue;                     // (no houses off the hill's shoulder)
      const ox = j * 333, c = streetPix(j, x * 8 + ox, (y - yj) * 8, X, Y, t, ck, -ox, yj * 8);
      if (c >= 0) return c;
      if (j > 0 && y > yj + 8) break;                                  // (below a front row's street: the slope, not the rows behind)
    }
    return valleyPix(x / 8, y / 8, X, Y, t, true);
  }
  {
    function c2Draw(V, t) {
      const ck = flick(t, 2.4);
      V.each(-330, -260, 330, 260, (x, y, X, Y) => townPix(x, y, X, Y, t, ck, false));
      zStars(V, t, -330, -260, 330, -60, 4, 1301, [135, 136, 168, 169, 22], (x, y) => y < 8 * mount3(x / 8) - 3);
      zGlow(V, CHURCH[0], CHURCH[1] - 25, 18, T_WARM, 0.3 * (t < 3 ? 1 : sstep(8.2, 8.7, t)));
      zSnow(V, t, -330, -260, 330, 260, 6, 1302, 2, [136, 167, 168, 169, 170]);
    }
    ZL[2] = { name: 'town', draw: c2Draw };
  }
