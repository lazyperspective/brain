  /* ================================================================ Act One (a) cast additions: Oren's bust */
  // Oren in close-up: a gold helm with a crimson plume and a visor slit that glows as he speaks; gold pauldrons over
  // indigo lamellar; a crimson cloak behind
  BUSTS.oren = function (P, t) {
    const F = P.face || {}, m = F.mouth || 0, breathe = Math.sin(t * 2) > 0.5 ? -1 : 0, HX = 3 + (P.headX || 0), HY = -42 + (P.headY || 0) + breathe;
    const gold = (u, v, base) => band(R.gold, base + (litOf(u, v) > 0.3 ? 1 : litOf(u, v) < -0.35 ? -1 : 0));
    // the cloak and the plume behind
    sPoly([[-26, 0], [-24, -16], [26, -16], [28, 0]], (x, y) => band(R.crimson, 2.4 + (frac(x / 7) < 0.2 ? -0.8 : 0)));
    for (let k = 0; k < 7; k++) { const sw = Math.sin(t * 2 + k * 0.6) * 1.2; sLock(HX - 2 + k * 0.8, HY - 15 - k * 0.4, HX - 14 - k * 1.5 + sw, HY - 6 + k * 2.4, -2, 2.6 - k * 0.15, R.crimson, 4 + (k % 2), k === 1); }
    // the lamellar body and the gorget
    sPoly([[-20, 0], [-19, -14], [-11, -20], [15, -20], [22, -14], [24, 0]], (x, y) => { const row = ((y + 40) % 4) < 1; return band(R.indigo, 3 + (row ? -1 : 0) + (litOf(x / 22, (y + 10) / 10) > 0.3 ? 1 : 0)); });
    for (let k = 0; k < 6; k++) sPoly([[-3 + k, -20], [-2 + k, -20], [-2 + k, 0], [-3 + k, 0]], k === 0 || k === 5 ? C('gold', 4) : C('indigo', 2));
    // pauldrons: three gold lames each side
    for (const side of [-1, 1]) for (let k = 0; k < 3; k++) sEll(side * 15 + 2, -16 + k * 4, 9 - k, 4, (x, y, u, v) => gold(u * side, v, 4.4 - k * 0.4));
    sEll(HX, HY + 13, 10, 4, (x, y, u, v) => gold(u, v, 3.6));
    // the helm: a rounded dome, a brow ridge, cheek guards, the visor slit
    sEll(HX, HY, 13, 14, (x, y, u, v) => {
      if (v > 0.6 && Math.abs(u) < 0.28) return -1;                                   // the open chin
      let s = 4.6 + (litOf(u, v) > 0.35 ? 1.2 : litOf(u, v) < -0.4 ? -1.2 : 0);
      if (Math.abs(v + 0.18) < 0.07) s -= 1.6;                                         // the brow ridge
      if (Math.abs(u) < 0.06 && v < -0.2) s += 1.4;                                    // a raised crest line
      return band(R.gold, s);
    });
    // the visor: a dark slit across the eyes, burning with his voice
    const glowC = m > 0.3 ? C('fire', 7) : m > 0.08 ? C('fire', 6) : C('fire', 5);
    for (let x = HX - 10; x <= HX + 10; x++) { sp(x, HY - 1, C('ink', 0)); sp(x, HY, C('ink', 0)); sp(x, HY + 1, C('ink', 1)); }
    for (const ex of [HX - 6, HX + 3]) for (let k = 0; k < 4; k++) sp(ex + k, HY, glowC, 3);
    // rivets
    for (const [rx, ry] of [[-9, 6], [9, 6], [-11, 1], [11, 1]]) sp(HX + rx, HY + ry, C('gold', 7));
    return { head: [HX, HY - 4], mouth: [HX, HY + 8], chest: [2, -10] };
  };
  // Kaira in close-up: silver hair swept back off her face and streaming behind in the wind, an indigo headband with a
  // gold stone, a gold courier's mark under her near eye, gold eyes; a high-collared indigo jacket, a satchel strap
  BUSTS.kaira = function (P, t) {
    const F = P.face || {}, wind = P.wind === undefined ? 1 : P.wind, breathe = Math.sin(t * 2.4) > 0.4 ? -1 : 0;
    const HX = 3 + (P.headX || 0), HY = -40 + (P.headY || 0) + breathe, sw = (k) => Math.round(Math.sin(t * (3 + wind) - k * 0.7) * (0.6 + wind * 0.5));
    const silver = (x, y, base, cx, cy) => { const l = (x - cx) * LIGHTS.x * 0.16 + (y - cy) * LIGHTS.y * 0.16; return band(R.hush, base + (l > 0.5 ? 1 : l < -0.6 ? -1 : 0)); };
    // the streaming hair behind: long tapering locks pulled back by the wind, darker underneath
    for (let k = 0; k < 7; k++) { const y0 = HY - 12 + k * 3.6, len = 14 + wind * 7 + (k % 3) * 4; sLock(HX - 8, y0, HX - 8 - len + sw(k), y0 + 4 + k * 0.8 + sw(k + 2), -1.5 + (k % 2) * 3, 3.2 - k * 0.15, R.hush, k > 3 ? 3 : 4, k === 1 || k === 4); }
    // the jacket: indigo, a high standing collar edged in gold, a seam, the satchel's linen strap across the chest
    sPoly([[-22, 0], [-21, -10], [-14, -18], [-4, -21], [12, -21], [20, -18], [24, -10], [25, 0]], (x, y) => { const l = litOf(x / 22, (y + 10) / 10); return band(R.indigo, 3 + (l > 0.3 ? 1 : l < -0.35 ? -1 : 0) + (Math.abs(x - 4) < 0.6 && y > -14 ? -1.4 : 0)); });
    sPoly([[-17, -16], [-13, -19], [20, 0], [14, 0]], (x, y) => band(R.linen, 4.6 + (litOf(x / 20, 0) > 0.2 ? 1 : 0) - ((x + y * 0.6) % 5 < 0.8 ? 1 : 0)));
    sEll(-6, -12, 2, 2, (x, y, u, v) => band(R.gold, u + v < 0 ? 6 : 4));
    sPoly([[HX - 9, -19], [HX - 7, -26], [HX + 9, -26], [HX + 11, -19]], (x, y) => band(R.indigo, y < -24 ? 5 : 4 - (x < HX ? 1 : 0)));
    sPoly([[HX - 9, -19], [HX + 11, -19], [HX + 11, -18], [HX - 9, -18]], C('gold', 5));
    // the neck
    sPoly([[HX - 5, HY + 9], [HX + 6, HY + 9], [HX + 5, -25], [HX - 5, -25]], (x, y) => band(R.skin, y < HY + 15 ? 3 : 4));
    // the face: a narrow three-quarter oval with a pointed chin
    sEll(HX, HY, 12, 14.5, (x, y, u, v) => {
      if (v > 0.05) { const uu = u - 0.2 * (v - 0.05), half = 1 - Math.pow((v - 0.05) / 0.95, 1.5) * 0.66; if (Math.abs(uu) > half) return -1; }
      const l = litOf(u, v * 0.8); let s = 5 + (l > 0.4 ? 1 : l < -0.45 ? -1 : 0); if (v > 0.74) s -= 1; return band(R.skin, s);
    });
    sEll(HX - 11, HY + 2, 2.2, 3.4, (x, y, u, v) => band(R.skin, 4 + (u < 0 ? -1 : 0)));
    pFace(P, F, 0, HY - 1, HX - 9, HX + 2, HX + 3, HY + 9, R.skin, R.gold);
    sp(HX + 5, HY + 5, C('skin', 3)); sp(HX + 5, HY + 6, C('skin', 3));
    // the courier's mark: a small gold chevron under the near eye
    for (const [mx, my] of [[-7, 7], [-6, 8], [-5, 7], [-7, 8]]) sp(HX + mx, HY + my, C('gold', 6), 3);
    // the hair over the crown: swept straight back, lit along its waves
    sPoly([[HX - 14, HY - 2], [HX - 13, HY - 12], [HX - 4, HY - 17], [HX + 7, HY - 16], [HX + 13, HY - 9], [HX + 12, HY - 6], [HX - 6, HY - 7], [HX - 11, HY + 4]], (x, y) => silver(x, y, 4 + (Math.abs(((x - HX) * 0.7 + (y - HY)) % 4) < 0.7 ? -1 : 0) + (Math.abs(y - (HY - 13) + (x - HX) * 0.15) < 0.8 && x > HX - 8 ? 2 : 0), HX, HY - 10));
    // the headband: indigo, a gold stone at the front, its tails flying back
    sPoly([[HX - 13, HY - 6], [HX + 12, HY - 8], [HX + 12.5, HY - 5], [HX - 12, HY - 2]], (x, y) => band(R.indigo, 4 + (y < HY - 6 ? 1 : 0) + (litOf((x - HX) / 12, 0) > 0.3 ? 1 : 0)));
    sEll(HX + 4, HY - 6, 2, 2, (x, y, u, v) => band(R.gold, u + v < -0.3 ? 7 : 5), 3);
    for (const d of [0, 2.4]) sLock(HX - 13, HY - 4 + d, HX - 24 - wind * 4 + sw(5 + d), HY - 1 + d * 2 + sw(7), 1.2, 1.4, R.indigo, 4, false);
    // two loose locks that the wind pulls forward over her brow and down the cheek
    sLock(HX + 4, HY - 8, HX + 11, HY - 1 + sw(3) * 0.5, 1.2, 1.3, R.hush, 5, true);
    hairMass_k(HX, HY);
    return { head: [HX, HY - 4], mouth: [HX + 3, HY + 9], chest: [2, -12] };
  };
  function hairMass_k(HX, HY) { sPoly([[HX - 14, HY - 5], [HX - 9, HY - 4], [HX - 8, HY + 3], [HX - 10, HY + 9], [HX - 13, HY + 4]], (x, y) => band(R.hush, 4 + (x > HX - 10 ? 1 : 0) - (Math.abs(x - (HX - 11) - (y - HY) * 0.2) < 0.5 ? 1 : 0))); }
