  /* ================================================================ ACT ONE (b) — the harbour at dawn (2:56–5:00): Tamo, the anchor, the Hush,
  // the Bellwether, Vesper. Everything is in this block; the new cast is in HB (c_cast_b.js). */
  {
    const { lyBegin, lyEnd, lk, stampEx, actorEx, anchorArt, fishArt, hollowFig, bellwether, vesperFig, DOCKHAND } = HB;
    /* ---------------------------------------------------------------- the stage: a side view along the dock
    // Stage pixels at 1×; world x along the dock; CX: the world x at the frame's left edge (for things on the dock, z = 1).
    // The planks are in true perspective toward a vanishing point on the horizon, so they slide past at the right rate. */
    const HOR = 122, DF = 172, DY = 192, DN = 204, WL0 = 230;     // horizon, the deck's far edge, where feet stand, its near edge, the water line
    const HUSH_T = 228.5;
    const sOf = (y) => (y - HOR) / (DY - HOR);
    let CX = 0;
    const sx = (wx) => wx - CX;                                  // a world x on the dock → stage x
    const LAMPS_X = [-170, 60, 268, 520, 760, 990, 1220], BOLL_X = [-60, 170, 420, 650, 880, 1110];
    const AX = 330, IX = 150, BRLX = 478, BELLX = 572, DOCKX = 404;
    // the sky at dawn: violet overhead, rose, then gold at the horizon, the sun just up behind the boats
    function dawnSky(t, o) {
      const sunX = 300 - CX / 40, sunY = 108;
      for (let y = 0; y < HOR; y++) {
        const u = y / HOR;
        for (let x = 0; x < W; x++) {
          const d = Math.hypot((x - sunX) * 0.5, y - sunY) / 160, warm = clamp(u * 1.15 - d * 0.35, 0, 1);
          BUF[y * W + x] = warm < 0.42 ? soft(R.dusk, 1.4 + warm * 4.2, x, y) : warm < 0.74 ? soft(R.rose, 2.6 + (warm - 0.42) * 6.5, x, y) : soft(R.fire, 4.2 + (warm - 0.74) * 6, x, y);
        }
      }
      // long thin clouds lit from below, and a bank of rounded ones higher up
      cloudBank(34, 9, 9, R.dusk, 2.4, 41, o.rt, 1.2);
      for (let k = 0; k < 9; k++) {
        const y = 60 + k * 6 + ih(k, 1, 301) * 4, x0 = ((ih(k, 2, 301) * 700 - CX / 20 + o.rt * (2 + k * 0.3)) % 700) - 110, len = 50 + ih(k, 3, 301) * 120;
        for (let x = fl(x0); x < x0 + len; x++) { if (x < 0 || x >= W) continue; const e = Math.min(x - x0, x0 + len - x); const th = e < 6 ? 1 : 2; for (let j = 0; j < th; j++) BUF[(y + j) * W + x] = j === th - 1 && th > 1 ? C('rose', 5 + (k > 5 ? 1 : 0)) : C(k > 4 ? 'fire' : 'rose', k > 4 ? 5 : 4); }
      }
      glow(sunX, sunY, 150, tab('#ffb070', true), 0.42);
      fillEll(sunX, sunY, 10, 10, 0, (x, y, u, v) => (y > HOR - 1 ? -1 : Math.hypot(u, v) < 0.75 ? WHITE : C('fire', 7)));
      glow(sunX, sunY, 30, tab('#fff0c0', true), 0.5);
      return [sunX, sunY];
    }
    // the far shore: the city on its cliff to the left — a wall, towers and the Spire — and the lighthouse on its headland, right
    function farShore(t, o) {
      const zc = 14, ox = -CX / zc;
      // the cliff and the city wall
      for (let x = 0; x < W; x++) {
        const wx = x - ox, top = HOR - 22 - Math.max(0, 70 - Math.abs(wx - 110) * 0.45) * 0.55 - vn(wx, 0, 18, 311) * 8 + Math.max(0, wx - 230) * 0.4;
        if (top >= HOR) continue;
        for (let y = Math.max(0, fl(top)); y < HOR; y++) BUF[y * W + x] = cel(R.dusk, 2.4 + (y - top < 1.5 ? 1.4 : 0) + (vn(wx * 2, y, 5, 312) > 0.68 ? 0.5 : 0) - (y - top) / 60, x, y);
        // the wall: a band with crenellations along the cliff top, and lit windows
        if (wx > 20 && wx < 250) { const wt = top - 7; for (let y = fl(wt); y < fl(top) + 1; y++) BUF[y * W + x] = (y === fl(wt) && (fl(wx / 3) & 1)) ? BUF[y * W + x] : cel(R.dusk, 3.2 + (y - wt < 2 ? 0.8 : 0), x, y); if (fl(wx) % 11 === 3) BUF[(fl(top) - 3) * W + x] = C('fire', 5); }
      }
      // towers and the Spire
      const towers = [[40, 26, 6], [78, 34, 7], [150, 30, 6], [196, 24, 5], [232, 18, 5]];
      for (const [tx, h, w] of towers) { const x0 = fl(tx + ox), base = HOR - 30; for (let y = base - h; y < base; y++) for (let x = x0; x < x0 + w; x++) if (x >= 0 && x < W) BUF[y * W + x] = cel(R.dusk, 3 + (x === x0 ? 1 : 0), x, y); for (let j = 0; j < 5; j++) for (let x = x0 - 1 + j; x < x0 + w + 1 - j; x++) if (x >= 0 && x < W) BUF[(base - h - j - 1) * W + x] = C('dusk', 2); if (x0 + 2 >= 0 && x0 + 2 < W) BUF[(base - h + 4) * W + x0 + 2] = C('fire', 6); }
      // the Spire: a needle of white stone, rings of balconies, a lit crystal at the top catching the first sun
      const spx = 118 + ox;
      for (let y = 8; y < HOR - 34; y++) { const u = (y - 8) / (HOR - 42), hw = 1.2 + u * 6.5 + (fl(y) % 14 === 0 ? 2.5 : 0); for (let x = fl(spx - hw); x <= spx + hw; x++) if (x >= 0 && x < W) BUF[y * W + x] = cel(R.lav, 3.2 + ((x - spx) / hw < -0.2 ? 1.4 : (x - spx) / hw > 0.4 ? -0.8 : 0.3) + (fl(y) % 14 === 0 ? 1 : 0), x, y); }
      glow(spx, 10, 14, tab('#ffd890', true), 0.6); fillPoly([[spx - 2, 10], [spx + 2, 10], [spx, 2]], (x, y) => (x < spx ? WHITE : C('fire', 6)));
      // the lighthouse headland, right
      const lz = 7, lox = -CX / lz;
      for (let x = 0; x < W; x++) { const wx = x - lox, top = HOR - Math.max(0, 40 - Math.abs(wx - 430) * 0.32) - vn(wx, 3, 10, 313) * 5; if (top >= HOR - 1) continue; for (let y = Math.max(0, fl(top)); y < HOR; y++) BUF[y * W + x] = cel(R.dusk, 1.8 + (y - top < 1.5 ? 1.6 : 0) + (vn(wx * 2, y * 2, 4, 314) > 0.7 ? 0.6 : 0), x, y); }
      const lhx = 432 + lox, lb = HOR - 38, lt = lb - 54;
      for (let y = lt; y < lb; y++) { const u = (y - lt) / (lb - lt), hw = 4 + u * 3; for (let x = fl(lhx - hw); x <= lhx + hw; x++) { if (x < 0 || x >= W) continue; const band_ = fl((y - lt) / 9) % 2 === 1, sh = (x - lhx) / hw; BUF[y * W + x] = cel(band_ ? R.crimson : R.linen, (band_ ? 2.6 : 3.4) + (sh > 0.3 ? 1.4 : sh < -0.5 ? -1 : 0) - (o.hushed ? 1 : 0), x, y); } }
      rectF(lhx - 7, lt - 2, 15, 2, C('ink', 2)); for (let x = fl(lhx - 7); x < lhx + 8; x += 2) put(x, lt - 3, C('ink', 2));
      rectF(lhx - 4, lt - 9, 9, 7, C('ink', 1)); for (let x = fl(lhx - 3); x < lhx + 4; x += 2) rectF(x, lt - 8, 1, 5, o.lamp ? C('fire', 6) : C('stone', 2));
      fillPoly([[lhx - 5, lt - 9], [lhx + 6, lt - 9], [lhx + 0.5, lt - 15]], C('ink', 1));
      if (o.lamp) glow(lhx, lt - 6, 20, tab('#ffd070', true), 0.5);
      return [lhx, lt];
    }
    // the sea out to the horizon: sky colours broken into wave dashes, the sun's glitter path, boats at their moorings
    function farSea(t, o, sun) {
      const rt = o.rt, pull = o.pull || 0, shore = DF - pull * 34;
      for (let y = HOR; y < DF; y++) {
        const d = (y - HOR) / (DF - HOR), per = 3 + d * 14;
        for (let x = 0; x < W; x++) {
          if (y > shore) { // the seabed laid bare: wet sand, weed, stones, puddles catching the sky
            const n = vn(x + CX * 0.8, y * 3, 6, 321); BUF[y * W + x] = n > 0.7 ? cel(R.sky, 3.4, x, y) : cel(R.earth, 2.4 + n * 1.2 - (y - shore < 2 ? -1 : 0) + (ih(fl(x / 3), y, 322) < 0.05 ? 1.5 : 0), x, y); continue;
          }
          const wx = x + CX * (0.25 + d * 0.6), n = vn(wx / per, y * 1.4 + rt * 1.2, 1, 323), n2 = vn(wx / per * 0.5 + rt * 0.3, y * 0.7, 1, 324);
          let c = d < 0.15 ? cel(R.rose, 4.2 - d * 4 + (n > 0.62 ? 1.2 : 0), x, y) : cel(R.sea, 2 + d * 1.4 + (n > 0.66 ? 1.4 : n < 0.25 ? -0.8 : 0) + (n2 > 0.7 ? 0.6 : 0), x, y);
          if (d > 0.15 && n > 0.72 && n2 > 0.45) c = C('rose', 4);
          // the glitter path under the sun
          const gp = Math.abs(x - sun[0]) / (6 + d * 60);
          if (gp < 1 && ih(fl(wx / 2), y, fl(rt * 7)) < (1 - gp) * 0.55 * (1 - d * 0.5)) c = (1 - gp) > 0.6 ? WHITE : C('fire', 6);
          BUF[y * W + x] = c;
        }
      }
      if (pull > 0) for (let x = 0; x < W; x++) { const y = fl(shore); if (y > HOR && y < DF) { BUF[y * W + x] = C('snow', 7); if ((x + fl(rt * 8)) % 5 < 2) BUF[(y - 1) * W + x] = C('sky', 6); } }
    }
    // a boat at its mooring: hull, cabin, mast and a loose sail; (x, y) waterline centre, s scale, its own little bob
    function boat(x, y, s, t, seed, o) {
      o = o || {}; const b = Math.sin(t * 1.4 + seed) * 1.2 * s, r = Math.sin(t * 1.1 + seed * 2) * 0.04 + (o.tilt || 0), L = 30 * s;
      const at = (a, h) => [x + a * Math.cos(r) - h * Math.sin(r), y + b - h * Math.cos(r) - a * Math.sin(r)];
      const hullC = [R.wood, R.crimson, R.sea, R.olive][seed % 4];
      fillPoly([at(-L, 6 * s), at(L + 4 * s, 7 * s), at(L - 4 * s, -2 * s), at(-L + 6 * s, -2.5 * s)], (xx, yy) => cel(hullC, 2.2 + (yy < y + b - 4 * s ? 1.2 : 0) + ((yy - y) % 3 === 0 ? -0.5 : 0), xx, yy));
      line(...at(-L, 6 * s), ...at(L + 4 * s, 7 * s), C('linen', 5));
      fillPoly([at(-L * 0.5, 6 * s), at(-L * 0.05, 6 * s), at(-L * 0.08, 12 * s), at(-L * 0.45, 12 * s)], (xx, yy) => cel(R.linen, 3.4 + (xx > x - L * 0.2 ? -0.6 : 0.4), xx, yy));
      const mt = at(L * 0.15, 6 * s), mtop = at(L * 0.15, 48 * s);
      line(mt[0], mt[1], mtop[0], mtop[1], C('wood', 1), Math.max(1, Math.round(s)));
      line(mtop[0], mtop[1], ...at(-L, 7 * s), C('ink', 3)); line(mtop[0], mtop[1], ...at(L + 4 * s, 8 * s), C('ink', 3));
      const sailC = [R.linen, R.rust, R.linen, R.crimson][(seed + 1) % 4], fullS = o.furled ? 0.3 : 1;
      if (o.furled) line(...at(L * 0.15, 20 * s), ...at(-L * 0.5, 17 * s), C(sailC, 4), 2);
      else fillPoly([at(L * 0.17, 44 * s), at(L * 0.17, 16 * s), at(L * 0.17 + 18 * s + Math.sin(t * 2 + seed) * 2 * s, 18 * s), at(L * 0.17 + 14 * s, 38 * s)], (xx, yy) => cel(sailC, 4.4 + ((xx - mt[0]) > 9 * s ? -0.6 : 0.5) + (frac((yy - mtop[1]) / (6 * s)) < 0.12 ? -0.8 : 0), xx, yy));
      void fullS;
      if (o.pennant !== false) { const p = at(L * 0.15, 48 * s); for (let q = 0; q < 6 * s; q++) put(fl(p[0] + q), fl(p[1] + Math.sin(t * 6 + q * 0.6) * 0.8), C('crimson', 5)); }
    }
    const BOATS = [[-80, 150, 0.75, 1], [70, 158, 0.85, 2, 1], [230, 144, 0.6, 3], [370, 162, 0.95, 4, 1], [520, 150, 0.7, 5], [690, 160, 0.9, 6, 1], [850, 146, 0.65, 7], [1000, 158, 0.85, 8, 1], [1180, 150, 0.75, 9]];
    function boats(t, o) {
      const pull = o.pull || 0, shore = DF - pull * 34;
      for (const [bx, by, s, seed, furled] of BOATS) {
        const z = 1.7 + (DF - by) / 30, x = bx - CX / z; if (x < -60 || x > W + 60) continue;
        const stranded = by > shore - 2, y = stranded ? by + 2 : by;
        boat(x, y, s, o.rt, seed, { furled, tilt: stranded ? (seed & 1 ? 0.18 : -0.15) * Math.min(1, pull * 2) : 0 });
        if (!stranded) for (let k = 0; k < 3; k++) { const rx = x + (k - 1) * 14 * s + Math.sin(o.rt * 2 + k) * 2; put(fl(rx), fl(y + 2 + k), C('sea', 5)); put(fl(rx) + 1, fl(y + 2 + k), C('sea', 5)); }
      }
    }
    // a far pier on stilts with dock workers carrying sacks (they keep working until the world stops)
    function farPier(t, o) {
      const z = 2.6, y0 = 136, ox = -CX / z;
      for (let x = 0; x < W; x++) { const wx = x - ox; if (wx < 340 || wx > 980) continue; BUF[y0 * W + x] = C('wood', 3); BUF[(y0 + 1) * W + x] = C('wood', 1); if (fl(wx) % 18 === 0) for (let y = y0 + 2; y < y0 + 9; y++) BUF[y * W + x] = C('wood', 1); }
      for (let k = 0; k < 7; k++) {
        const span = 560, u = frac(ih(k, 1, 331) + o.rt * (0.012 + ih(k, 2, 331) * 0.01) * (k & 1 ? 1 : -1)), wx = 360 + u * span, x = fl(wx + ox), y = y0 - 1;
        if (x < 0 || x >= W || (o.erase && ih(k, 3, 331) < o.erase)) continue;
        const step = fl(o.rt * 6 + k) & 1, col = C('ink', 3);
        put(x, y - step * 0, col); put(x + 1, y - step, col); for (let j = 1; j < 5; j++) put(x, y - j, col); put(x, y - 5, C('skin', 3)); put(x + 1, y - 4, col);
        if (k % 3 !== 0) { rectF(x - 1, y - 7, 3, 2, C('linen', 3)); }
      }
      // posts and a crane
      const cx = 760 + ox; if (cx > -20 && cx < W + 20) { line(cx, y0, cx, y0 - 28, C('wood', 1)); line(cx, y0 - 28, cx + 16, y0 - 22, C('wood', 1)); const sw = Math.sin(o.rt * 0.8) * 2; line(cx + 16, y0 - 22, cx + 16 + sw, y0 - 10, C('ink', 3)); rectF(cx + 13 + sw, y0 - 10, 7, 5, C('wood', 2)); }
    }
    // gulls: wheeling flocks in the sky, and some perched; frozen with the world (they hang in mid-flap)
    function gulls(t, o, n, cy) {
      const rt = o.rt;
      for (let k = 0; k < n; k++) {
        const a = rt * (0.25 + ih(k, 1, 341) * 0.3) * (k & 1 ? 1 : -1) + ih(k, 2, 341) * TAU, r = 40 + ih(k, 3, 341) * 110;
        const x = fl(((ih(k, 4, 341) * 700 + Math.cos(a) * r - CX / 3) % 700 + 700) % 700 - 110), y = fl(cy + Math.sin(a) * r * 0.25 + ih(k, 5, 341) * 30);
        const fp = Math.sin(rt * (9 + k % 3) + k * 2), up = fp > 0.3 ? -2 : fp < -0.3 ? 1 : 0, big = ih(k, 6, 341) < 0.4;
        const c = C('snow', 7), cd = C('stone', 4);
        put(x, y, c); put(x + 1, y, c); put(x - 1, y + (up < 0 ? -1 : 0), cd); put(x + 2, y + (up < 0 ? -1 : 0), cd);
        put(x - 2, y + up, cd); put(x + 3, y + up, cd); if (big) { put(x - 3, y + up + (up < 0 ? -1 : 1), C('ink', 2)); put(x + 4, y + up + (up < 0 ? -1 : 1), C('ink', 2)); }
        put(x + 2, y + 1, C('gold', 5));
      }
    }
    // the deck: planks in perspective, wet seams, nail rows, the light of the low sun along the boards
    function deck(t, o) {
      const crackAt = o.cracks;
      for (let y = DF; y < DN; y++) {
        const s = sOf(y), row = y - DF;
        for (let x = 0; x < W; x++) {
          const wx = CX + 240 + (x - 240) / s, b = fl(wx / 10), bu = frac(wx / 10), seam = bu * 10 * s < 1.05;
          const grain = vn(wx * 0.35, y * 2.2 + b * 30, 2, 351), tone = (ih(b, 1, 352) - 0.5) * 0.9 + (ih(b, fl(wx / 90), 353) < 0.12 ? -0.8 : 0);
          let v = 2.9 + tone + (grain > 0.62 ? 0.5 : grain < 0.3 ? -0.4 : 0) + (row < 2 ? 1.0 : 0) - row * 0.03;
          if (seam) v = 1.0;
          // a plank end, staggered board to board
          if (Math.abs(frac(wx / 10) - 0.5) < 0.45 && Math.abs(((wx * 0.0 + y * 3 + ih(b, 2, 354) * 300) % 90)) < 1.2) v -= 1.4;
          // nail rows over the joists
          if ((row === 4 || row === 13 || row === 24) && Math.abs(bu - 0.5) < 0.12) v = 4.6;
          // the sun's sheen on wet boards
          if (o.sheen !== false && grain > 0.55 && ih(b, fl(y / 3), 355) < 0.3 && row > 3) v += 0.8;
          BUF[y * W + x] = cel(R.wood, v, x, y);
        }
      }
      // the far edge: a lit rail of the planks' ends against the sea
      for (let x = 0; x < W; x++) { BUF[DF * W + x] = C('wood', 5); BUF[(DF + 1) * W + x] = C('fire', 5); }
      // the near face: a heavy beam with bolts, then the piles going down into the water, braces, dark under the deck
      const wl = WL0 + (o.pull || 0) * 22 - (o.surge || 0) * 10;
      for (let y = DN; y < DN + 8; y++) for (let x = 0; x < W; x++) { const wx = x + CX; BUF[y * W + x] = cel(R.wood, 1.8 + (y === DN ? 1.4 : 0) + (y === DN + 7 ? -1 : 0) + (vn(wx * 0.3, y * 2, 2, 356) > 0.6 ? 0.5 : 0) + ((fl(wx) % 40 === 6 || fl(wx) % 40 === 7) && y === DN + 3 ? 2.6 : 0), x, y); }
      for (let y = DN + 8; y < H; y++) for (let x = 0; x < W; x++) BUF[y * W + x] = cel(R.ink, 1.2 + (frac((x + CX * 0.9) / 46) < 0.08 ? 1.6 : 0) + (y < DN + 11 ? -0.5 : 0), x, y);
      // piles and braces
      for (let k = -2; k < 30; k++) {
        const wx = k * 52 + 14, x = fl(wx - CX); if (x < -12 || x > W + 12) continue;
        for (let y = DN + 8; y < H; y++) for (let q = 0; q < 8; q++) { const xx = x + q; if (xx < 0 || xx >= W) continue; const u = q / 7; let v = 2.2 + (u < 0.3 ? 1.2 : u > 0.75 ? -1 : 0) + (vn(xx * 0.5, y * 0.2, 2, 357) > 0.65 ? -0.6 : 0); let c = cel(R.wood, v, xx, y); if (Math.abs(y - wl) < 7 && ih(xx, y, 358) < 0.4) c = ih(xx, y, 359) < 0.5 ? C('linen', 5) : C('stone', 3); if (y > wl - 2 && y < wl + 14 && ih(xx, y >> 1, 360) < 0.25) c = C('moss', 2); BUF[y * W + xx] = c; }
        if (k % 2 === 0) { line(x + 8, DN + 10, x + 52, Math.min(H, wl - 4), C('wood', 1), 2); line(x + 8, DN + 11, x + 52, Math.min(H, wl - 3), C('wood', 3)); }
      }
      if (crackAt) crackAt();
      return wl;
    }
    // the water under the dock: the sky's colours in broken ripples, piles' reflections, foam round them; it can stop dead,
    // drain away (pull) or come back high (surge)
    function nearWater(t, o, wl) {
      const rt = o.rt;
      for (let y = Math.max(fl(wl), DN + 8); y < H; y++) {
        const d = (y - wl) / 40;
        for (let x = 0; x < W; x++) {
          const wx = x + CX * 1.1, n = vn(wx / (5 + d * 6) + Math.sin(y * 0.7 + rt * 2) * 0.6, y * 1.3 + rt * 1.6, 1, 361);
          const pile = frac((x + CX - 14) / 52) < 8 / 52;
          let c = cel(R.sea, 2.2 + d * 0.6 + (n > 0.68 ? 1.6 : n < 0.22 ? -0.8 : 0), x, y);
          if (n > 0.8) c = C('rose', 5);
          if (pile) c = cel(R.wood, 1.2 + (n > 0.5 ? 0.6 : 0), x, y);
          if (y < wl + 2 && (ih(fl((x + rt * 9) / 2), y, fl(rt * 4)) < 0.5 || pile)) c = C('snow', 7);
          BUF[y * W + x] = c;
        }
      }
    }
    // things on the deck
    function crateArt(x, y, w, h, seed, o) {
      o = o || {}; x = fl(x); y = fl(y);
      for (let yy = y - h; yy < y; yy++) for (let xx = x; xx < x + w; xx++) {
        const u = xx - x, v = yy - (y - h), edge = u === 0 || u === w - 1 || v === 0 || v === h - 1, diag = Math.abs(u / (w - 1) - v / (h - 1)) < 0.09;
        put(xx, yy, edge ? C('wood', u === 0 || v === 0 ? 4 : 1) : diag ? C('wood', 3) : cel(R.wood, 3.2 + (v % 4 === 0 ? -1 : 0) + (u > w * 0.6 ? -0.6 : 0.2), xx, yy));
      }
      if (o.stamp) { put(x + 3, y - h + 3, C('crimson', 3)); put(x + 4, y - h + 3, C('crimson', 3)); put(x + 3, y - h + 4, C('crimson', 3)); }
      shadowE(x + w / 2, y, w * 0.7, 2);
    }
    function barrelArt(x, y, r, h, seed) {
      x = fl(x); y = fl(y);
      fillEll(x, y - h + 1, r, 1.8, 0, (xx, yy, u) => cel(R.wood, 4 + (u < 0 ? 0.5 : 0), xx, yy));
      for (let yy = y - h + 1; yy < y; yy++) { const v = (yy - (y - h)) / h, bulge = r * (0.88 + Math.sin(v * PI) * 0.12); for (let xx = fl(x - bulge); xx <= x + bulge; xx++) { const u = (xx - x) / bulge; const hoop = Math.abs(v - 0.2) < 0.06 || Math.abs(v - 0.8) < 0.06; put(xx, yy, hoop ? C('stone', u < -0.2 ? 4 : 2) : cel(R.wood, 2.8 + (u < -0.3 ? 1 : u > 0.5 ? -1 : 0) + (frac(u * 2.5) < 0.12 ? -0.7 : 0), xx, yy)); } }
      shadowE(x, y, r * 1.2, 2);
    }
    function shadowE(x, y, rx, ry) { for (let yy = fl(y - ry); yy <= y + ry; yy++) for (let xx = fl(x - rx); xx <= x + rx; xx++) { if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue; const d = Math.hypot((xx - x) / rx, (yy - y) / ry); if (d < 1) tintI(yy * W + xx, xx, yy, tab('#1a1028'), 0.45 * (1 - d * 0.6)); } }
    function lampPost(x, y, t, lit) {
      x = fl(x); for (let yy = y - 46; yy < y; yy++) { put(x, yy, C('ink', 2)); put(x + 1, yy, C('ink', 3)); }
      rectF(x - 2, y - 3, 6, 3, C('ink', 2)); line(x + 1, y - 44, x + 7, y - 44, C('ink', 2));
      const sw = Math.sin(t * 1.5 + x) * 0.8, lx = x + 7 + sw, ly = y - 40;
      line(x + 7, y - 44, lx, ly - 3, C('ink', 3));
      fillPoly([[lx - 2.5, ly - 3], [lx + 2.5, ly - 3], [lx + 3, ly + 3], [lx - 3, ly + 3]], (xx, yy) => (xx === fl(lx) - 3 || xx === fl(lx) + 2 ? C('ink', 2) : lit ? C('fire', yy < ly ? 6 : 5) : C('stone', 2)));
      rectF(lx - 3, ly - 4, 7, 1, C('ink', 1)); rectF(lx - 3, ly + 3, 7, 1, C('ink', 1));
      if (lit) glow(lx, ly, 16, tab('#ffb050', true), 0.35);
    }
    function bollard(x, y, rope, t) {
      x = fl(x); fillEll(x, y - 6, 3.4, 2, 0, (xx, yy, u) => C('ink', u < -0.2 ? 3 : 1)); for (let yy = y - 6; yy < y; yy++) for (let xx = x - 3; xx <= x + 3; xx++) put(xx, yy, C('ink', xx < x - 1 ? 3 : 1)); fillEll(x, y - 7, 2.6, 1.4, 0, C('stone', 3));
      if (rope) { const [rx, ry] = rope; for (let q = 0; q <= 30; q++) { const u = q / 30, px_ = lerp(x, rx, u), py_ = lerp(y - 5, ry, u) + Math.sin(u * PI) * 5; put(fl(px_), fl(py_), (q & 1) ? C('linen', 3) : C('wood', 4)); } }
    }
    function ropeCoil(x, y) { for (let k = 0; k < 4; k++) fillEll(x, y - 1 - k * 0.8, 7 - k, 2.2 - k * 0.3, 0, (xx, yy, u, v) => (Math.hypot(u, v) > 0.7 || k === 3 ? cel(R.linen, 2.8 + (u < 0 ? 0.8 : 0) + ((xx + yy) & 1 ? -0.5 : 0), xx, yy) : -1)); shadowE(x, y, 8, 2); }
    function netFrame(x, y, t, rt) {
      for (const px_ of [x, x + 34]) { line(px_, y, px_, y - 40, C('wood', 2), 2); }
      line(x, y - 40, x + 35, y - 40, C('wood', 3), 2);
      for (let j = 0; j < 30; j++) for (let i = 0; i < 34; i++) { const sag = Math.sin(i / 34 * PI) * 4 + Math.sin(rt * 1.4 + i * 0.3) * 0.6; const yy = fl(y - 38 + j + sag * (j / 30)); if ((i % 4 === 0 || j % 4 === 0) && j < 26 + Math.sin(i * 0.7) * 3) put(x + 1 + i, yy, C('linen', (i + j) % 8 === 0 ? 4 : 2)); }
      for (const [fx, fy] of [[x + 8, y - 22], [x + 22, y - 16]]) { rectF(fx, fy, 3, 3, C('gold', 4)); put(fx + 1, fy, C('gold', 6)); }
    }
    // the harbour, all of it: o { cx, rt (world clock — freeze it to stop the world), pull, surge, lamps, hush (0..1 drained), sigil }
    function harbour(t, o) {
      o = o || {}; CX = o.cx || 0; o.rt = o.rt === undefined ? Math.min(t, HUSH_T) : o.rt;
      LAMPS.length = 0;
      const sun = dawnSky(t, o);
      if (o.sky) o.sky(t);
      farShore(t, o);
      farSea(t, o, sun);
      farPier(t, o);
      boats(t, o);
      if (o.surgeFn) o.surgeFn();
      gulls(t, o, 14, 50);
      const wl = deck(t, o);
      nearWater(t, o, wl);
      // the props along the dock
      for (const lx of LAMPS_X) { const x = sx(lx); if (x > -20 && x < W + 20) lampPost(x, DF + 6, o.rt, o.lamps !== false); }
      for (const bx of BOLL_X) { const x = sx(bx); if (x > -30 && x < W + 30) bollard(x, DF + 5, [x - 40 + (bx % 3) * 12, 158], o.rt); }
      const props = o.props || {};
      const P_ = (wx, fn) => { const x = sx(wx); if (x > -60 && x < W + 60) fn(x); };
      P_(-110, (x) => { crateArt(x, DF + 10, 22, 18, 1); crateArt(x + 3, DF - 8, 16, 14, 2); barrelArt(x + 32, DF + 10, 7, 19, 3); });
      P_(30, (x) => ropeCoil(x, DF + 12));
      P_(236, (x) => { barrelArt(x, DF + 9, 7, 18, 4); barrelArt(x + 15, DF + 9, 7, 18, 5); ropeCoil(x + 30, DF + 14); });
      if (!props.noDockStack) P_(DOCKX + 18, (x) => { crateArt(x - 4, DF + 14, 22, 18, 6, { stamp: 1 }); crateArt(x + 19, DF + 12, 18, 16, 7); crateArt(x - 1, DF - 4, 17, 15, 8); });
      P_(560, (x) => netFrame(x, DF + 8, t, o.rt));
      if (!props.noBarrels) P_(BRLX, (x) => { barrelArt(x - 9, DF + 13, 8, 20, 9); barrelArt(x + 9, DF + 14, 8, 20, 10); barrelArt(x, DF - 6, 8, 20, 11); crateArt(x + 19, DF + 9, 20, 17, 12); });
      P_(720, (x) => { crateArt(x, DF + 12, 22, 18, 13); barrelArt(x + 32, DF + 12, 7, 19, 14); });
      P_(860, (x) => ropeCoil(x, DF + 13));
      return wl;
    }
    // after the figures: drifting motes in the low sun, the warm haze
    function harbourAfter(t, o) {
      o = o || {}; const rt = o.rt === undefined ? Math.min(t, HUSH_T) : o.rt;
      for (let k = 0; k < 40; k++) { const x = fl((ih(k, 1, 371) * W + rt * (4 + ih(k, 2, 371) * 6) + Math.sin(rt + k) * 4) % W), y = fl(30 + ih(k, 3, 371) * 200 + Math.sin(rt * 0.7 + k) * 6); if (ih(k, 4, 371) < 0.5) put(x, y, C('fire', 6)); }
    }
    HB.harbour = harbour; HB.harbourAfter = harbourAfter;
    // a whole-frame tint snapped to one of the tint table's levels, so it never lands on a band edge (which would checker the frame)
    HB.tintFlat = (T, a) => { const l = Math.round(a * 8 - 0.5); if (l < 0) return; tintAll(T, (Math.min(7, l) + 0.5) / 8); };
    HB.consts = { HOR, DF, DY, DN, AX, IX, BRLX, BELLX, DOCKX, HUSH_T };
    HB.setCX = (v) => { CX = v; }; HB.sx = (wx) => wx - CX;
    HB.shadowE = shadowE; HB.crateArt = crateArt; HB.barrelArt = barrelArt;
  }
  /* ---------------------------------------------------------------- shot helpers: light, poses, effects */
  {
    const { lyBegin, lyEnd, stampEx, actorEx, fishArt, shadowE } = HB;
    const K = HB.consts;
    // dawn light: the low sun behind the dock — a warm rim on whichever side faces it
    const SUNX = 300;
    function dawnLit(x) { LIGHT.x = x < SUNX ? 0.75 : -0.75; LIGHT.y = -0.55; ENV.edge = C('fire', 6); }
    // a character on the dock at world x: shadow, the actor (or a turned actor with o.rot), the warm rim
    function onDock(CH, P, wx, y, f, o) {
      const x = HB.sx(wx); if (!(o && o.light === false)) dawnLit(x);
      if (HB.IMP || HB.IMPC !== undefined) { o = Object.assign({}, o || {}, { color: HB.IMPC !== undefined ? HB.IMPC : C('ink', 0), noShadow: true }); ENV.edge = null; }
      if (!(o && o.noShadow)) shadowE(x, y === undefined ? K.DY : Math.max(y, K.DF + 4), 10, 2.2);
      // a breath: one pixel of rise and fall, out of step from figure to figure (frozen when the world stops)
      if (P.bob === undefined && !(o && o.rot)) { const bt = Math.min(T_NOW, T_NOW < 228.5 || T_NOW > 240 ? T_NOW : 228.5); P = Object.assign({}, P, { bob: Math.sin(bt * 2.6 + wx * 0.37) > 0.55 ? -1 : 0 }); }
      const r = o && (o.rot || o.glitch || o.px) ? actorEx(CH, Object.assign({ t: T_NOW }, P), x, y, f, o) : actor(CH, Object.assign({ t: T_NOW }, P), x, y, 1, f, o);
      ENV.edge = null; return r;
    }
    // a walk cycle: phase ph, stride k (sprite px)
    function walkP(P, ph, k, B) {
      const s = Math.sin(ph), c = Math.cos(ph);
      P.legs = [{ foot: [s * k, -Math.max(0, c) * k * 0.4] }, { foot: [-s * k, -Math.max(0, -c) * k * 0.4] }];
      if (!P.arms) P.arms = [{ a: -s * 0.5, b: 0.4 }, { a: s * 0.5, b: 0.4 }];
      P.hip = -B.leg + Math.abs(s) * k * 0.08 + (Math.abs(c) > 0.9 ? 0 : 0) - 0.3;
      return P;
    }
    function runP(P, ph, k, B) {
      const s = Math.sin(ph), c = Math.cos(ph);
      P.legs = [{ foot: [s * k, -Math.max(0, c) * k * 0.55] }, { foot: [-s * k, -Math.max(0, -c) * k * 0.55] }];
      if (!P.arms) P.arms = [{ a: -s * 0.95, b: 0.8 }, { a: s * 0.95, b: 0.8 }];
      P.hip = -B.leg + Math.abs(s) * k * 0.12 - 0.5; P.lean = (P.lean || 0) + 2; P.wind = (P.wind || 0) + 1.5;
      return P;
    }
    const stand = (B, w) => ({ hip: -B.leg, legs: [{ foot: [w || 4, 0] }, { foot: [-(w || 4), 0] }] });
    // ballistic things: (x0, y0) launched at (vx, vy) px/s, gravity G, landing on floor (then resting); returns [x, y, landed, age after landing]
    function arc(x0, y0, vx, vy, G, g, floor) {
      const y = y0 + vy * g + 0.5 * G * g * g;
      if (floor === undefined || y < floor || vy + G * g < 0) return [x0 + vx * g, y, false, 0];
      // when it came down to the floor
      const a = 0.5 * G, b = vy, c = y0 - floor, tl = (-b + Math.sqrt(Math.max(0, b * b - 4 * a * c))) / (2 * a);
      return [x0 + vx * tl, floor, true, g - tl];
    }
    // splinters / planks flung out of a burst, tumbling, landing on the planks and staying there
    function debris(x, y, g, n, seed, o) {
      if (g < 0) return; o = o || {}; const sp_ = o.speed || 1, floor = o.floor === undefined ? K.DY : o.floor;
      for (let k = 0; k < n; k++) {
        const a = -PI / 2 + (ih(k, 1, seed) - 0.5) * (o.spread || 2.6), v = (60 + ih(k, 2, seed) * 120) * sp_, fy = floor - 6 + ih(k, 3, seed) * 14;
        const [px, py, landed] = arc(x, y, Math.cos(a) * v, Math.sin(a) * v, 420, g, fy);
        const len = 3 + ih(k, 4, seed) * (o.big ? 9 : 5), ang = landed ? ih(k, 5, seed) * 0.6 - 0.3 : g * (8 + ih(k, 6, seed) * 12) * (k & 1 ? 1 : -1);
        const c = o.ramp ? o.ramp(k) : C('wood', ih(k, 7, seed) < 0.5 ? 4 : 2);
        line(px - Math.cos(ang) * len / 2, py - Math.sin(ang) * len / 2, px + Math.cos(ang) * len / 2, py + Math.sin(ang) * len / 2, c, ih(k, 8, seed) < 0.3 && o.big ? 2 : 1);
      }
    }
    // a ring of dust rolling out across the planks, and puffs climbing off it
    function dustRing(x, y, g, size, seed, ramp) {
      if (g < 0 || g > 1.4) return; const r = size * eoc(g / 0.9) * 40, a = 1 - g / 1.4; ramp = ramp === undefined ? R.linen : ramp;
      for (let k = 0; k < 26; k++) {
        const an = k / 26 * TAU + ih(k, 1, seed) * 0.2, rr = r * (0.8 + ih(k, 2, seed) * 0.35), px = x + Math.cos(an) * rr, py = y + Math.sin(an) * rr * 0.22 - g * 10 * ih(k, 3, seed), pr = (2 + size * 3 * ih(k, 4, seed)) * (0.6 + g);
        if (ih(k, 5, seed) > a * 1.3) continue;
        fillEll(px, py, pr, pr * 0.8, 0, (xx, yy, u, v) => (bay(xx, yy) < a * (1 - Math.hypot(u, v) * 0.5) ? cel(ramp, 4.6 - v * 1.2 + (u < 0 ? 0.6 : 0), xx, yy) : -1));
      }
    }
    // an impact: a white star that shrinks, rays, a ring
    function impactStar(x, y, g, size, col) {
      if (g < 0 || g > 0.35) return; const u = g / 0.35, r = size * (6 + u * 22);
      for (let k = 0; k < 10; k++) { const an = k / 10 * TAU + 0.3, l = r * (k & 1 ? 0.7 : 1.3) * (1 - u * 0.4); line(x + Math.cos(an) * r * 0.3 * u, y + Math.sin(an) * r * 0.3 * u, x + Math.cos(an) * l, y + Math.sin(an) * l, k & 1 ? (col || C('fire', 6)) : WHITE, u < 0.5 ? 2 : 1); }
      if (u < 0.6) { const r0 = size * 9 * (1 - u / 0.6), r1 = r0 * 0.28; const pts = []; for (let k = 0; k < 8; k++) { const an = k / 8 * TAU, rr = k & 1 ? r1 : r0 * (k % 4 === 0 ? 1 : 0.7); pts.push([x + Math.cos(an) * rr, y + Math.sin(an) * rr]); } fillPoly(pts, WHITE); fillEll(x, y, r1 * 1.2, r1 * 1.2, 0, col || C('fire', 6)); fillEll(x, y, r1 * 0.6, r1 * 0.6, 0, WHITE); }
      for (let a = 0; a < TAU; a += 0.04) { const xx = fl(x + Math.cos(a) * r * 1.3), yy = fl(y + Math.sin(a) * r * 0.8); if (bay(xx, yy) < 1 - u) put(xx, yy, WHITE); }
    }
    // the impact frame: the whole picture in two tones for a beat, figures black on white (or inverted)
    function impactFrame(inv, cx, cy) {
      for (let i = 0; i < NP; i++) { const l = LUM[BUF[i]]; BUF[i] = (l < 95) !== !!inv ? C('ink', 0) : WHITE; }
      if (cx !== undefined) for (let k = 0; k < 40; k++) { const an = ih(k, 1, 991) * TAU, r0 = 60 + ih(k, 2, 991) * 60; line(cx + Math.cos(an) * r0, cy + Math.sin(an) * r0, cx + Math.cos(an) * 400, cy + Math.sin(an) * 400, inv ? WHITE : C('ink', 0), ih(k, 3, 991) < 0.3 ? 2 : 1); }
    }
    // a splash: a crown of water thrown up, droplets arcing out, white foam, then rings spreading on the water
    function splash(x, y, g, size, seed) {
      if (g < 0) return;
      if (g < 1.1) {
        const h = size * 46 * Math.sin(Math.min(1, g / 0.7) * PI) * (g < 0.35 ? eoc(g / 0.35) : 1);
        for (let k = -8; k <= 8; k++) { const u = k / 8, cx = x + u * size * 10 * (1 + g), top = y - h * (1 - u * u * 0.7) * (0.75 + ih(k, 1, seed) * 0.4); for (let yy = fl(top); yy < y; yy++) put(fl(cx), yy, (yy - top) < 2 ? WHITE : bay(fl(cx), yy) < 0.5 ? C('sky', 6) : C('sea', 5)); }
        for (let k = 0; k < 30; k++) { const a = -PI / 2 + (ih(k, 2, seed) - 0.5) * 2.2, v = (60 + ih(k, 3, seed) * 110) * size; const [px, py] = arc(x, y - 2, Math.cos(a) * v, Math.sin(a) * v, 380, g); if (py < y + 2) { put(fl(px), fl(py), k % 3 ? WHITE : C('sky', 6)); if (k % 4 === 0) put(fl(px), fl(py) + 1, C('sky', 5)); } }
      }
      for (let q = 0; q < 3; q++) { const gg = g - q * 0.25; if (gg < 0 || gg > 1.6) continue; const r = size * (6 + gg * 30); for (let a = 0; a < TAU; a += 0.6 / r) { const xx = fl(x + Math.cos(a) * r), yy = fl(y + Math.sin(a) * r * 0.2); if (ih(xx, yy, fl(gg * 8)) < 1 - gg / 1.6) put(xx, yy, WHITE); } }
    }
    // music notes from a whistler
    function notes(x, y, t) { for (let k = 0; k < 3; k++) { const u = frac(t * 0.8 + k / 3), nx = x + u * 14 + Math.sin(t * 3 + k) * 2, ny = y - u * 18; if (u > 0.9) continue; const c = C('linen', 7); put(fl(nx), fl(ny), c); put(fl(nx) + 1, fl(ny), c); put(fl(nx), fl(ny) + 1, c); put(fl(nx) + 1, fl(ny) + 1, c); for (let j = 1; j < 5; j++) put(fl(nx) + 2, fl(ny) - j + 1, c); if (k & 1) put(fl(nx) + 3, fl(ny) - 3, c); } }
    // dizzy stars circling a head
    function dizzy(x, y, r, t) { for (let k = 0; k < 4; k++) { const a = t * 6 + k / 4 * TAU, px = fl(x + Math.cos(a) * r), py = fl(y + Math.sin(a) * r * 0.3); const c = Math.sin(a) > 0 ? C('gold', 7) : C('gold', 4); put(px, py, c); put(px - 1, py, c); put(px + 1, py, c); put(px, py - 1, c); put(px, py + 1, c); } }
    // a zig-zag of lightning between two points
    function bolt(x0, y0, x1, y1, seed, w, cIn, cOut) {
      const n = Math.max(3, fl(Math.hypot(x1 - x0, y1 - y0) / 7)); let px = x0, py = y0;
      for (let i = 1; i <= n; i++) { const u = i / n, j = i === n ? 0 : (ih(i, seed, 61) - 0.5) * 14, nx = -(y1 - y0), ny = x1 - x0, nl = Math.hypot(nx, ny) || 1; const qx = lerp(x0, x1, u) + nx / nl * j, qy = lerp(y0, y1, u) + ny / nl * j; line(px, py, qx, qy, cOut || C('gold', 5), (w || 1) + 2); line(px, py, qx, qy, cIn || WHITE, w || 1); px = qx; py = qy; }
    }
    // the hit-stop of a cut: hold the action clock for d at each hit
    const holdClock = (t, hits) => { let T = t; for (const [h, d] of hits) T -= clamp(t - h, 0, d); return T; };
    // speed lines across the frame (a whoosh) or toward a point (a focus)
    function speedLines(t, n, ang, c, seed) { const dx = Math.cos(ang), dy = Math.sin(ang); for (let k = 0; k < n; k++) { const y = ih(k, 1, seed) * H, x = frac(ih(k, 2, seed) + t * 3) * (W + 200) - 100, l = 30 + ih(k, 3, seed) * 80; line(x, y, x + dx * l, y + dy * l, c || WHITE); } }
    Object.assign(HB, { dawnLit, onDock, walkP, runP, stand, arc, debris, dustRing, impactStar, impactFrame, splash, notes, dizzy, bolt, holdClock, speedLines });
  }
  /* ================================================================ 24–25: the crash, the comedy, three wardens (2:56–3:17) */
  {
    const { onDock, walkP, stand, arc, debris, dustRing, impactStar, impactFrame, splash, notes, dizzy, holdClock, shadowE, fishArt, crateArt, actorEx, harbour, harbourAfter, sx } = HB;
    const K = HB.consts, DY = K.DY, IX = K.IX;
    const IMPACT = 178.0, FISH_UP = 180.5, THUDS = [188.6, 188.8, 189.0], WDX = [22, 46, 70], WDY = [DY - 6, DY - 2, DY + 2];
    const TB = TAMO.body, KB = KAIRA.body, WB = WARDEN.body;
    // Tamo's crate in his arms (frame coords, in front of him)
    const heldCrate = (x, y) => { crateArt(x - 2, y, 22, 17, 3, { stamp: 1 }); };
    // the wreck on the planks: splinters, the crate's boards, fish (landed ones flop for a while)
    function fishBurst(t, skipUp) {
      const g = t - IMPACT - 0.05; if (g < 0) return;
      const x0 = sx(IX) + 6, y0 = DY - 20;
      for (let k = 0; k < 9; k++) {
        const a = -PI / 2 + (ih(k, 1, 401) - 0.5) * 2.4, v = 90 + ih(k, 2, 401) * 140, fy = DY - 6 + ih(k, 3, 401) * 16;
        const [px, py, landed, ag] = arc(x0, y0, Math.cos(a) * v, Math.sin(a) * v, 420, g, fy);
        const flop = landed ? Math.sin(t * (13 + k) + k) * Math.max(0, 1 - ag * 0.25) : 0;
        fishArt(px, py - Math.abs(flop) * 3, 9 + ih(k, 4, 401) * 3, landed ? (k & 1 ? 0.1 : PI - 0.1) + flop * 0.5 : g * (9 + k), flop);
      }
    }
    function wreck(t) {
      const g = t - IMPACT; if (g < 0) return;
      debris(sx(IX) + 6, DY - 22, g, 18, 402, { big: true });
      debris(sx(IX) + 4, DY - 4, g, 22, 403, { speed: 0.6 });
      // the crate's lid, spinning high and landing last
      const [lx, ly, landed] = arc(sx(IX) + 10, DY - 26, 70, -260, 420, g, DY + 4);
      const ang = landed ? 0.2 : g * 11; for (let q = -8; q <= 8; q++) for (let w = -1; w <= 1; w++) put(fl(lx + Math.cos(ang) * q - Math.sin(ang) * w), fl(ly + Math.sin(ang) * q + Math.cos(ang) * w), C('wood', w < 0 ? 4 : 3));
      if (landed) shadowE(lx, ly + 1, 8, 1.5);
      fishBurst(t);
    }
    // Tamo flat on his back (rot) or sitting up; Kaira on top; returns his head position
    function tamoDown(t, P, rot, x, y) { return onDock(TAMO, P, x, y, 1, { rot, px: 0, py: -TB.leg, noShadow: true }); }
    const TAMO_SIT = { hip: -7, legs: [{ foot: [24, 0], knee: [13, -5] }, { foot: [21, 0], knee: [11, -6] }], arms: [{ hand: [-6, -4] }, { hand: [-9, -4] }] };
    const fishOnHead = (r, t, lift) => { if (r) fishArt(r.head[0] + 1, r.head[1] - 10 - (lift || 0), 12, Math.PI + 0.12 + Math.sin(t * 20) * 0.04, Math.sin(t * 22)); };

    // 24a — the dock at dawn (2:56): a wide, the camera coming down onto the planks; Tamo whistling along with a crate;
    // a shadow grows round him; he looks up; a streak of gold comes out of the sky
    shot(176.0, 178.0, (lt, t) => {
      harbour(t, { cx: 0 });
      const walking = t < 177.45, wx = lerp(52, IX - 4, eoc(lin(176.0, 177.55, t)) * 0.3 + lin(176.0, 177.55, t) * 0.7), ph = (wx - 52) * 0.42;
      const look = sstep(177.45, 177.62, t), jolt = sstep(177.78, 177.86, t);
      // the falling courier's shadow on the planks, growing
      const fu = lin(177.2, IMPACT, t);
      if (fu > 0) shadowE(sx(IX) + 4, DY, 4 + fu * 14, 1 + fu * 2.6);
      const P = walking ? walkP({ face: { eyes: 'happy', smile: 0.7, mouth: 0.18 } }, ph, 5, TB) : Object.assign(stand(TB, 4), { hip: -TB.leg + (jolt > 0 ? -2 : 0), lean: -look * 2, face: { eyes: look > 0.5 ? 'wide' : 'happy', brows: look > 0.5 ? 'up' : 'n', mouth: look > 0.5 ? 0.8 : 0.18, smile: look > 0.5 ? 0 : 0.7 } });
      P.arms = [{ hand: [10, -38 - jolt * 8] }, { hand: [8, -37 - jolt * 8] }];
      const r = onDock(TAMO, P, wx, DY, 1);
      heldCrate(sx(wx) + 4, r.handN[1] + 8);
      if (walking) notes(r.head[0] + 6, r.head[1] - 6, t);
      if (look > 0.5 && t < 177.9) { const ex = fl(r.head[0] + 3), ey = fl(r.head[1] - 18 - jolt * 3); rectF(ex, ey, 2, 6, C('fire', 6)); rectF(ex, ey + 8, 2, 2, C('fire', 6)); }
      // the courier, falling: a tumbling figure at the head of a gold streak
      if (fu > 0) {
        const e = (q) => Math.pow(q, 1.7), fx = (q) => lerp(sx(IX) + 190, sx(IX) + 6, e(q)), fy = (q) => lerp(-60, DY - 30, e(q));
        for (let j = 16; j >= 1; j--) { const q0 = Math.max(0, fu - j * 0.035), q1 = Math.max(0, fu - (j - 1) * 0.035), w = Math.max(1, 7 - j * 0.4); for (let d = -w; d <= w; d += 1) line(fx(q0) + d * 0.5, fy(q0) + d * 0.8, fx(q1) + d * 0.5, fy(q1) + d * 0.8, Math.abs(d) < w * 0.35 ? WHITE : Math.abs(d) < w * 0.7 ? C('gold', 6) : C('fire', 4)); }
        LIGHT.x = 0; LIGHT.y = -1; ENV.edge = C('gold', 6);
        actorEx(KAIRA, { t, face: { eyes: 'wide', brows: 'worried', mouth: 0.9 }, wind: 6, arms: [{ a: 2.6 + Math.sin(t * 30) * 0.4, b: 0.3 }, { a: 2.2 - Math.sin(t * 30) * 0.4, b: 0.4 }], legs: [{ foot: [8, -6] }, { foot: [-6, -2] }] }, fx(fu), fy(fu), -1, { rot: t * 16, px: 0, py: -40 });
        ENV.edge = null;
        glow(fx(fu), fy(fu), 30, tab('#ffd060', true), 0.5);
      }
      harbourAfter(t);
      // the camera: the whole harbour, coming down to the planks; a snap in on his face as he looks up
      if (t < 177.62) { const u = eio(lin(176.0, 177.55, t)); view(lerp(240, sx(IX) + 20, u), lerp(135, 168, u), lerp(1.0, 1.9, u)); }
      else { view(sx(IX) + 46, 128, 2.1); shk(1); }
    });

    // 24b — the pile-up (2:58): impact frame; the crate bursts; she's sat on him; fish rain down; the last one lands on his face
    shot(178.0, 182.0, (lt, t) => {
      const g = t - IMPACT;
      HB.IMP = g < 0.067;
      if (HB.IMP) { BUF.fill(WHITE); for (let k = 0; k < 60; k++) { const an = ih(k, 1, 991) * TAU, r0 = 30 + ih(k, 2, 991) * 50, cx = sx(IX) + 4, cy = DY - 16; line(cx + Math.cos(an) * r0, cy + Math.sin(an) * r0 * 0.7, cx + Math.cos(an) * 500, cy + Math.sin(an) * 350, C('ink', 0), ih(k, 3, 991) < 0.3 ? 2 : 1); } }
      else harbour(t, { cx: 0 });
      if (!HB.IMP) { wreck(t); dustRing(sx(IX), DY, g - 0.04, 1.2, 404); }
      // Tamo: flat out, arms flung; a jolt when the fish lands; then he pops up sitting
      const sitT = 181.45, fishHit = t >= FISH_UP;
      let rT;
      const lieP = { face: { eyes: fishHit && t < 181.1 ? 'wide' : 'closed', brows: 'worried', mouth: fishHit && t < 181.0 ? 0.6 : 0.3 }, arms: [{ a: 2.9 + Math.sin(t * 3) * 0.1, b: 0.3 }, { a: 2.5, b: 0.4 }], legs: [{ foot: [7, 0] }, { foot: [-5, 0] }] };
      if (t < sitT) rT = tamoDown(t, lieP, -PI / 2 + (g < 0.12 ? 0.04 : 0), IX - 2, DY - 3 + (t > FISH_UP && t < FISH_UP + 0.1 ? 1 : 0));
      else if (t < sitT + 0.08) rT = tamoDown(t, Object.assign({}, TAMO_SIT, { face: { eyes: 'wide', mouth: 0.4 } }), -PI / 4, IX - 4, DY - 6);
      else { rT = onDock(TAMO, Object.assign({}, TAMO_SIT, { face: { eyes: blink(t, 21) ? 'closed' : 'narrow', brows: 'angry', smile: -0.6 } }), IX - 20, DY + 1, 1); }
      if (t >= sitT) fishOnHead(rT, t, t < sitT + 0.2 ? 6 * (1 - (t - sitT) / 0.2) : 0);
      // the last fish, thrown straight up by the crash, comes down on his face
      if (g > 0.05 && t < FISH_UP) { const u = (t - IMPACT - 0.05) / (FISH_UP - IMPACT - 0.05); fishArt(lerp(sx(IX) + 8, sx(IX) - 30, u), lerp(DY - 22, DY - 8, u) - Math.sin(u * PI) * 330, 12, g * 7, 0); }
      if (fishHit && t < sitT) { fishArt(rT.head[0], rT.head[1] - 3, 12, PI + 0.3 + Math.sin(t * 25) * 0.15, Math.sin(t * 25)); if (t < FISH_UP + 0.3) for (let k = 0; k < 12; k++) { const a = -PI * ih(k, 1, 405), v = 40 + ih(k, 2, 405) * 50, gg = t - FISH_UP; put(fl(rT.head[0] + Math.cos(a) * v * gg), fl(rT.head[1] + Math.sin(a) * v * gg + 160 * gg * gg), k & 1 ? WHITE : C('sky', 6)); } }
      // Kaira: squashed by the landing, sat on him seeing stars; shakes it off; hops off onto her knees
      const hop = lin(181.0, 181.35, t);
      if (hop <= 0) {
        const sq = g < 0.08 ? 1 : g < 0.2 ? 0.4 : 0, dazed = t < 180.8;
        const r = onDock(KAIRA, { hip: -9 + sq * 4, lean: dazed ? Math.round(Math.sin(t * 5) * 1.5) : 0, headX: dazed ? Math.round(Math.sin(t * 5)) : 0, legs: [{ knee: [9, -13 + sq * 3], foot: [13, 0] }, { knee: [7, -12 + sq * 3], foot: [10, 0] }], arms: g < 0.25 ? [{ a: 2.4, b: 0.3 }, { a: -0.5 }] : [{ hand: [10, -10] }, { hand: [-6, -6] }], face: { eyes: dazed ? (fl(t * 3) % 2 ? 'closed' : 'half') : blink(t, 22) ? 'closed' : 'open', brows: 'worried', mouth: dazed ? 0.3 : 0, look: t > 180.8 ? (t < 180.92 ? -1 : 1) : 0 }, wind: 1 }, IX - 4, DY - 5, -1, { noShadow: true });
        if (g > 0.35 && dazed) dizzy(r.head[0], r.head[1] - 14, 9, t);
      } else if (hop < 1) {
        onDock(KAIRA, { hip: -KB.leg + 4, legs: [{ foot: [6, -6] }, { foot: [-4, -3] }], arms: [{ a: 2.2, b: 0.3 }, { a: 1.6, b: 0.4 }], face: { eyes: 'open', brows: 'worried' }, wind: 3 }, lerp(IX - 4, IX + 22, hop), DY - Math.sin(hop * PI) * 12, -1);
      } else {
        const sq = lin(181.35, 181.5, t);
        onDock(KAIRA, { hip: lerp(-11, -15, sq), legs: [{ knee: [9, -9], foot: [9, 0] }, { knee: [-3, -1], foot: [-13, -1] }], arms: [{ hand: [8, -18] }, { hand: [5, -17] }], face: { eyes: blink(t, 22) ? 'closed' : 'open', brows: 'worried', smile: 0.3 } }, IX + 22, DY + 1, -1);
        if (sq < 1) HB.dustRing(sx(IX + 22), DY + 1, t - 181.35, 0.4, 406);
      }
      if (t >= sitT && t < sitT + 0.3) HB.dustRing(sx(IX - 20), DY + 1, t - sitT, 0.5, 407);
      if (HB.IMP) { HB.IMP = false; view(sx(IX) + 4, 170, 2.3); return; }
      impactStar(sx(IX) + 4, DY - 16, g, 1.6, C('gold', 6));
      harbourAfter(t);
      view(sx(IX) + 4 + Math.round(lt * 1.5), 170, lerp(2.3, 2.55, eio(lt / 4)));
      shk(g < 0.5 ? 4 * (1 - g / 0.5) : 0);
    });

    // 25a — Tamo, close (3:02): sat in the wreck, the fish on his head — "Hey! That was the GOOD crate!"
    function wreckStage(t, o) { harbour(t, Object.assign({ cx: 0 }, o || {})); wreck(t); }
    shot(182.0, 184.7, (lt, t) => {
      closeBg(() => wreckStage(t), sx(IX) + 20, 166, 3, 3);
      const tk = talking('tamo', t), good = t > 183.35 && t < 184.0;
      const jig = good ? Math.round(Math.sin(t * 40) * 1.2) : 0, bob = tk ? -Math.round(Math.abs(Math.sin(t * 9)) * 2) : 0;
      LIGHT.x = 0.8; LIGHT.y = -0.5; ENV.edge = C('fire', 6);
      bust('tamo', { t, fish: t, face: { eyes: blink(t, 21) ? 'closed' : good ? 'wide' : 'narrow', brows: 'angry', mouth: mouth('tamo', t), smile: -0.5, look: t < 182.5 ? -1 : 0 }, headX: jig, headY: bob }, 188, H - 22 + 6, 3, 1);
      ENV.edge = null;
      // a vein of anger, popping on "GOOD"
      if (good) { const vx = 248, vy = 70; for (const [dx, dy] of [[0, 0], [1, 0], [3, 0], [4, 0], [0, 1], [4, 1], [0, 3], [4, 3], [0, 4], [1, 4], [3, 4], [4, 4]]) rectF(vx + dx * 3, vy + dy * 3, 3, 3, C('crimson', 5)); }
      // a couple of droplets off the fish
      for (let k = 0; k < 4; k++) { const u = frac(t * 1.3 + k / 4); put(fl(150 + k * 30 + Math.sin(k) * 10), fl(60 + u * 200), C('sky', 6)); put(fl(150 + k * 30 + Math.sin(k) * 10), fl(61 + u * 200), C('sky', 5)); }
      shk(good ? 1 : 0);
    });

    // 25b — the two of them (3:04): she springs up — "Sorry! Not sorry! You should run."
    shot(184.7, 187.5, (lt, t) => {
      wreckStage(t);
      const rT = onDock(TAMO, Object.assign({}, TAMO_SIT, { face: { eyes: blink(t, 21) ? 'closed' : t > 186.3 ? 'wide' : 'narrow', brows: t > 186.3 ? 'up' : 'angry', smile: -0.6, look: t > 186.3 ? -1 : 0 } }), IX - 20, DY + 1, 1);
      fishOnHead(rT, t);
      const pop = lin(184.72, 184.95, t), land = lin(184.95, 185.12, t), sorry = t > 185.0 && t < 185.6, notS = t > 185.6 && t < 186.2, run = t > 186.2;
      let P;
      if (t < 184.72) P = { hip: -13 - sstep(184.7, 184.72, t) * 0, legs: [{ knee: [9, -9], foot: [9, 0] }, { knee: [-3, -1], foot: [-13, -1] }], arms: [{ hand: [8, -18] }, { hand: [5, -17] }], face: { eyes: 'open', smile: 0.3 } };
      else if (pop < 1) P = { hip: -KB.leg + 3, legs: [{ foot: [4, -5] }, { foot: [-4, -3] }], arms: [{ a: 2.6, b: 0.2 }, { a: 2.2, b: 0.3 }], face: { eyes: 'open', smile: 0.6 }, wind: 2 };
      else if (land < 1) P = Object.assign(stand(KB, 6), { hip: -KB.leg + 6 * (1 - land), face: { eyes: 'open', smile: 0.6 } });
      else if (sorry) P = Object.assign(stand(KB, 4), { lean: 4, headY: 2, arms: [{ hand: [9, -40] }, { hand: [8, -41] }], face: { eyes: 'closed', brows: 'worried', mouth: mouth('kaira', t), smile: 0.3 } });
      else if (notS) P = Object.assign(stand(KB, 5), { lean: -1, arms: [{ a: 2.6 + Math.sin(t * 14) * 0.15, b: -0.6 }, { a: 0.3 }], face: { eyes: fl(t * 4) % 3 === 0 ? 'happy' : 'narrow', mouth: mouth('kaira', t), smile: 0.9 } });
      else P = Object.assign(stand(KB, 5), { arms: [{ a: 1.65, b: 0.05 }, { a: 0.2 }], face: { eyes: blink(t, 22) ? 'closed' : 'open', brows: 'up', mouth: mouth('kaira', t), smile: 0.2, look: 1 } });
      const kx = IX + 22, ky = DY + 1 - (pop > 0 && pop < 1 ? Math.sin(pop * PI) * 14 : 0);
      onDock(KAIRA, P, kx, ky, -1);
      if (land > 0 && land < 1) HB.dustRing(sx(kx), DY + 1, t - 184.95, 0.4, 408);
      if (notS) { const sx_ = sx(kx) - 14, sy_ = DY - 52; for (let k = 0; k < 4; k++) { const a = t * 5 + k * PI / 2; put(fl(sx_ + Math.cos(a) * 4), fl(sy_ + Math.sin(a) * 4), C('gold', 7)); } }
      harbourAfter(t);
      view(sx(IX) + 4, 166, lerp(2.5, 2.7, eio(lt / 2.8)));
    });

    // the three wardens, dropping onto the planks behind him: a streak, a crouch, a ring of dust and splinters
    function wardenDrop(t, k, P, f) {
      const g = t - THUDS[k], x = WDX[k], y = WDY[k];
      if (g < -0.45) return null;
      if (g < 0) { const yy = y + g * 600; for (let j = 0; j < 40; j++) put(fl(sx(x) + (j & 1)), fl(yy - 40 - j * 2), j < 6 ? WHITE : C('indigo', 6)); return onDock(WARDEN, { hip: -WB.leg + 2, legs: [{ foot: [4, -3] }, { foot: [-4, -2] }], arms: [{ a: 2.6, b: 0.2 }, { a: -0.4 }], prop: (A) => spearArt(A.hand[0], A.hand[1], 0.1, 34, t) }, x, yy, f || 1, { noShadow: true }); }
      const land = eoc(lin(0, 0.32, g)), cr = g < 0.32 ? 1 - land : 0;
      HB.dustRing(sx(x), y, g, 0.9, 411 + k); HB.debris(sx(x), y - 2, g, 8, 415 + k, { speed: 0.6, floor: y });
      if (g < 0.15) HB.impactStar(sx(x), y - 4, g, 0.8, C('indigo', 6));
      return onDock(WARDEN, Object.assign({ hip: -WB.leg + 12 * cr, legs: [{ foot: [7, 0] }, { foot: [-7, 0] }], arms: [{ a: 0.6 + cr * 0.6, b: 0.6 }, { a: -0.3 - cr }], prop: (A) => spearArt(A.hand[0], A.hand[1], lerp(0.1, 0.4, cr), 34, t) }, P || {}), x, y, f || 1);
    }
    // 25c — "run from wh—" (3:07): closer on him; THUD, THUD, THUD behind
    shot(187.5, 189.4, (lt, t) => {
      wreckStage(t);
      const nT = THUDS.filter((h) => t >= h).length, last = nT ? t - THUDS[nT - 1] : 9;
      for (let k = 0; k < 3; k++) wardenDrop(t, k);
      const jump = last < 0.12 ? -2 : 0;
      const rT = onDock(TAMO, Object.assign({}, TAMO_SIT, { hip: TAMO_SIT.hip + jump, face: { eyes: nT ? 'wide' : blink(t, 21) ? 'closed' : 'narrow', brows: nT ? 'up' : 'angry', mouth: nT ? (nT > 2 ? 0.2 : 0.5) : mouth('tamo', t), smile: -0.4, look: nT > 1 ? -1 : 0 } }), IX - 20, DY + 1, 1);
      fishOnHead(rT, t, last < 0.12 ? 3 : 0);
      if (nT) { for (let k = 0; k < nT; k++) { const sx_ = rT.head[0] + 10 + k * 6, sy_ = rT.head[1] - 16 + (k & 1) * 3; rectF(sx_, sy_, 1, 4, C('snow', 7)); } }
      harbourAfter(t);
      view(sx(IX) - 66, 164, 2.6);
      shk(last < 0.3 ? 3 * (1 - last / 0.3) : 0);
    });
    // 25d — over his shoulder (3:09): the three of them rise; the spears come down together; a step
    shot(189.4, 191.6, (lt, t) => {
      wreckStage(t);
      const rise = sstep(189.6, 189.85, t), lower = eoc(lin(189.95, 190.15, t)), step = sstep(190.6, 190.95, t);
      for (let k = 0; k < 3; k++) {
        const x = WDX[k] + step * 8, ph = step * PI;
        const P = { hip: -WB.leg + (1 - rise) * 6, legs: step > 0 && step < 1 ? [{ foot: [5 + Math.sin(ph) * 4, -Math.sin(ph) * 4] }, { foot: [-6, 0] }] : [{ foot: [7, 0] }, { foot: [-7, 0] }], arms: [{ a: lerp(0.6, 1.5, lower), b: lerp(0.6, 0.1, lower) }, { a: -0.3 }], prop: (A) => spearArt(A.hand[0], A.hand[1], lerp(0.1, 1.45, lower), 34, t) };
        const r = onDock(WARDEN, P, x, WDY[k], 1);
        if (lower > 0.6 && lower < 1 || (t > 190.15 && t < 190.4)) { const gx = r.handN[0] + 38, gy = r.handN[1] - 2; put(gx, gy, WHITE); put(gx - 1, gy, C('snow', 7)); put(gx + 1, gy, C('snow', 7)); put(gx, gy - 1, WHITE); put(gx, gy + 1, WHITE); }
        glow(r.head[0] + 3, r.head[1] - 1, 6, tab('#60e0ff', true), 0.5);
        if (step >= 1) HB.dustRing(sx(x), WDY[k], t - 190.95, 0.35, 420 + k);
      }
      harbourAfter(t);
      view(sx(100) + 10, 160, 2.5);
      // Tamo's head and shoulder, close and dark in the right of the frame
      LIGHT.x = 0.7; LIGHT.y = -0.6; ENV.edge = C('fire', 5);
      bust('tamo', { t, fish: t, face: {} }, 420, H - 22 + 30, 3, -1, { color: C('ink', 1) });
      ENV.edge = null;
      if (step >= 1 && t < 191.2) shk(1.2);
    });

    // 25e — he gets up (3:11): "Three grown-ups… against one girl?"
    shot(191.6, 193.5, (lt, t) => {
      closeBg(() => { wreckStage(t); for (let k = 0; k < 3; k++) onDock(WARDEN, { legs: [{ foot: [7, 0] }, { foot: [-7, 0] }], arms: [{ a: 1.5, b: 0.1 }, { a: -0.3 }], prop: (A) => spearArt(A.hand[0], A.hand[1], 1.45, 34, t) }, WDX[k] + 8, WDY[k], 1); }, sx(100), 160, 3, 3);
      // he rises into the frame: a dip, a push, an overshoot
      const dip = sstep(191.85, 192.05, t) * (1 - sstep(192.05, 192.1, t)), rise = eob(lin(192.05, 192.45, t)), y0 = H - 22 + 6 + Math.round(lerp(90, 0, rise) + dip * 8);
      LIGHT.x = 0.8; LIGHT.y = -0.5; ENV.edge = C('fire', 6);
      bust('tamo', { t, fish: t, face: { eyes: blink(t, 23) ? 'closed' : 'narrow', brows: 'angry', mouth: mouth('tamo', t), smile: t > 193.0 ? 0.4 : 0 }, headX: t > 192.9 ? 1 : 0 }, 300, y0, 3, -1);
      ENV.edge = null;
    });

    // 25f — the fish flicked into the sea; a roll of the shoulder; he walks off toward the anchor; she steps back and watches
    shot(193.5, 197.0, (lt, t) => {
      const cam = eio(lin(194.9, 197.0, t)), cx = cam * 120;
      wreckStage(t, { cx });
      for (let k = 0; k < 3; k++) {
        const turn = t > 195.3 + k * 0.15, lookAt = t > 194.0 && t < 194.6 ? 1 : 0;
        const r = onDock(WARDEN, { legs: [{ foot: [7, 0] }, { foot: [-7, 0] }], arms: turn ? [{ a: 0.4, b: 0.4 }, { a: -0.2 }] : [{ a: 1.2, b: 0.1 }, { a: -0.3 }], prop: (A) => spearArt(A.hand[0], A.hand[1], turn ? 0.12 : 1.05, 26, t) }, WDX[k] + 8, WDY[k], lookAt && k === 1 ? -1 : 1);
        glow(r.head[0] + 3, r.head[1] - 1, 6, tab('#60e0ff', true), 0.4);
      }
      // Tamo: stands, flicks the fish off, rolls a shoulder, sets off
      const flick = lin(193.55, 193.8, t), roll = t > 194.2 && t < 194.9, walking = t > 195.0;
      const tx = walking ? IX - 20 + (t - 195.0) * 62 : IX - 20, ph = (tx - IX + 20) * 0.38;
      let P;
      if (walking) P = walkP({ lean: 1, face: { eyes: blink(t, 23) ? 'closed' : 'narrow', brows: 'angry', smile: 0.5 } }, ph, 6, TB);
      else P = Object.assign(stand(TB, 5), { arms: [{ a: flick > 0 && flick < 1 ? lerp(2.6, 3.4, eoc(flick)) : t < 193.55 ? 2.9 : roll ? 0.4 + Math.cos((t - 194.2) * 13) * 0.6 : 0.3, b: roll ? 0.9 : 0.3 }, { a: -0.2 }], face: { eyes: blink(t, 23) ? 'closed' : 'narrow', brows: 'angry', smile: t > 194.0 ? 0.6 : 0, look: t < 194.5 ? -1 : 0 } });
      const rT = onDock(TAMO, P, tx, DY + 1, walking ? 1 : -1);
      if (flick <= 0) fishOnHead(rT, t);
      else if (t < 194.35) { const u = lin(193.65, 194.35, t), p0 = [rT.head[0], rT.head[1] - 10], p1 = [sx(IX - 70), 244]; fishArt(lerp(p0[0], p1[0], u), lerp(p0[1], p1[1], u) - Math.sin(u * PI) * 60, 12, u * 16, 0); }
      HB.splash(sx(IX - 70), 244, t - 194.35, 0.7, 431);
      // Kaira steps back out of his way, then turns to watch him go
      const kx = IX + 22 + sstep(194.5, 195.0, t) * 12, kturn = t > 195.4;
      onDock(KAIRA, Object.assign(stand(KB, 5), { arms: [{ a: 0.3, b: 0.3 }, { a: 0.2 }], face: { eyes: blink(t, 24) ? 'closed' : 'wide', brows: 'up', smile: t > 196 ? 0.3 : 0, look: kturn ? 0 : -1 } }), kx, DY + 4, kturn ? 1 : -1);
      harbourAfter(t);
      view(lerp(sx(IX) - 10, sx(IX + 120) + 10, cam), 164, lerp(2.2, 2.0, cam));
    });
  }
  /* ================================================================ 26: the anchor (3:17–3:34) */
  {
    const { onDock, walkP, stand, arc, debris, dustRing, impactStar, splash, shadowE, crateArt, actorEx, anchorArt, lyBegin, lyEnd, harbour, harbourAfter, sx, bolt, DOCKHAND } = HB;
    const K = HB.consts, DY = K.DY, DF = K.DF, AX = K.AX, DOCKX = K.DOCKX;
    const TB = TAMO.body, KB = KAIRA.body, WB = WARDEN.body;
    const GRIP = 199.5, RIP = 203.0, TAX = AX - 24;
    const WD2 = [96, 118, 140], WDY = [DY - 6, DY - 2, DY + 2];
    // the sea: drawn out of the harbour while he strains, then thrown back in
    const pullOf = (t) => (t < RIP ? sstep(200.3, 202.8, t) : Math.max(0, 1 - eoc(lin(RIP, RIP + 0.7, t))));
    const surgeOf = (t) => (t < RIP + 0.2 ? 0 : Math.sin(lin(RIP + 0.2, RIP + 2.6, t) * PI));
    const glowOf = (t) => clamp(lin(200.2, 202.6, t) + (t > RIP ? 1 : 0), 0, 1);
    // a wave standing up behind the dock as the sea comes back
    function surgeWave(t) {
      const h = surgeOf(t) * 74; if (h < 1) return;
      for (let x = 0; x < W; x++) {
        const yc = DF - h * (0.82 + 0.18 * Math.sin(x * 0.045 + t * 2.5)) - Math.sin(x * 0.13 + t * 6) * 2;
        for (let y = Math.max(0, fl(yc)); y < DF; y++) { const d = y - yc; BUF[y * W + x] = d < 2.5 ? WHITE : d < 5 ? (ih(x, y, fl(t * 12)) < 0.5 ? C('sky', 7) : C('teal', 6)) : cel(R.sea, 4.2 - Math.min(2, d / 30) + (vn(x * 0.3, y * 0.6 - t * 30, 2, 471) > 0.62 ? 1 : 0), x, y); }
        if (ih(x, 1, fl(t * 14)) < 0.25) for (let j = 0; j < 4; j++) put(x + fl(Math.sin(j + t * 9) * 2), fl(yc - 2 - j * 2 - ih(x, j, 472) * 6), j & 1 ? C('sky', 6) : WHITE);
      }
    }
    // spray thrown over the far edge where it breaks, falling back as a salt rain
    function breakSpray(t) {
      const g = t - (RIP + 1.25); if (g < 0 || g > 3.5) return;
      for (let k = 0; k < 160; k++) { const x0 = ih(k, 1, 473) * W, v = 120 + ih(k, 2, 473) * 200, a = -PI / 2 + (ih(k, 3, 473) - 0.5) * 0.9; const [px, py] = HB.arc(x0, DF, Math.cos(a) * v * 0.4, Math.sin(a) * v, 300, g - ih(k, 4, 473) * 0.4); if (py < H && g > ih(k, 4, 473) * 0.4) { put(fl(px), fl(py), k % 3 ? WHITE : C('sky', 6)); if (k % 2) put(fl(px), fl(py) + 1, C('sky', 5)); } }
    }
    function stage(t, cx, o) { return harbour(t, Object.assign({ cx, pull: pullOf(t), surge: surgeOf(t), surgeFn: () => surgeWave(t) }, o || {})); }
    // cracks in the boards round the anchor's foot, growing with the strain
    function cracks(x, y, amt) {
      if (amt <= 0) return;
      for (let k = 0; k < 10; k++) { const a = (k / 10) * TAU + ih(k, 1, 421), L = amt * (12 + ih(k, 2, 421) * 30); let px = x, py = y; for (let s = 1; s <= 6; s++) { const u = s / 6, nx = x + Math.cos(a + (ih(k, s, 422) - 0.5) * 0.8) * L * u, ny = y + Math.sin(a + (ih(k, s, 423) - 0.5) * 0.8) * L * u * 0.28; line(px, py, nx, ny, C('ink', 0), s < 3 ? 2 : 1); if (s === 2) line(px, py - 1, nx, ny - 1, C('wood', 5)); px = nx; py = ny; } }
    }
    // the anchor standing in the planks (lift: how far it has come up out of them)
    function anchorInDeck(t, g, lift, shake) {
      const j = shake ? Math.round((ih(fl(t * 30), 1, 7) - 0.5) * 2 * shake) : 0, x = sx(AX) + j, y = DY - 50 - lift;
      LIGHTS.x = LIGHT.x; LIGHTS.y = LIGHT.y;
      lyBegin(); anchorArt(x, y, 0, 1.05, g, t); lyEnd({ edge: g > 0.3 ? C('mint', 7) : C('fire', 6) });
      if (lift < 16) {
        fillEll(sx(AX), DY + 3, 15, 3.6, 0, (xx, yy, u, v) => (v < -0.3 ? -1 : C('ink', 0)));
        for (let k = 0; k < 9; k++) { const a = PI * (k / 8), ex = sx(AX) + Math.cos(a) * 15, ey = DY + 3 + Math.sin(a) * 3.6 * (k & 1 ? 1 : -1); line(ex, ey, ex + Math.cos(a) * (3 + (k % 3) * 2), ey - 2 - (k & 1), C('wood', 4)); }
      }
      if (g > 0) glow(x, y + 28, 24 + g * 20, tab('#40ffd0', true), 0.15 + g * 0.25);
      return [x, y];
    }
    // the dockhand on his crate with his pipe; drops it when the anchor comes out
    function dockhand(t, P) {
      crateArt(sx(DOCKX) - 11, DY - 2, 22, 15, 15);
      const r = onDock(DOCKHAND, Object.assign({ hip: -15, legs: [{ knee: [9, -16], foot: [11, 0] }, { knee: [7, -15], foot: [8, 0] }], arms: [{ hand: [9, -26] }, { hand: [4, -18] }], face: { eyes: blink(t, 25) ? 'closed' : 'half', mouth: mouth('docker', t) } }, P || {}), DOCKX, DY - 2, -1);
      const dropped = t > RIP + 0.1;
      if (!dropped) { line(r.head[0] - 4, r.head[1] + 6, r.head[0] - 9, r.head[1] + 8, C('linen', 6)); rectF(r.head[0] - 11, r.head[1] + 5, 3, 3, C('wood', 3)); put(r.head[0] - 10, r.head[1] + 5, C('fire', 6)); HB.pipeSmoke(r.head[0] - 10, r.head[1] + 4, t, 6); }
      else { const g = t - RIP - 0.1, [px, py, landed] = arc(r.head[0] - 9, r.head[1] + 7, -20, -60, 420, g, DY + 2); line(px - 3, py, px + 3, py + (landed ? 0 : Math.sin(g * 20) * 2), C('linen', 6)); rectF(px - 4, py - 2, 3, 3, C('wood', 3)); }
      return r;
    }
    // the wardens where they wait, menacing Kaira, and her watching
    function bystanders(t, o) {
      o = o || {};
      for (let k = 0; k < 3; k++) { const P = { legs: [{ foot: [7, 0] }, { foot: [-7, 0] }], arms: o.shield ? [{ a: 2.6, b: 0.6 }, { a: 2.2, b: 0.5 }] : [{ a: 1.2, b: 0.1 }, { a: -0.3 }], lean: o.shield ? -2 : 0, prop: o.shield ? undefined : (A) => spearArt(A.hand[0], A.hand[1], 1.05, 26, t) }; const r = onDock(WARDEN, P, WD2[k], WDY[k], 1); glow(r.head[0] + 3, r.head[1] - 1, 6, tab('#60e0ff', true), 0.4); }
      onDock(KAIRA, Object.assign(stand(KB, 5), { arms: o.shield ? [{ a: 2.5, b: 0.8 }, { a: 2.2, b: 0.6 }] : [{ a: 0.4, b: 0.6 }, { a: 0.2 }], face: { eyes: o.wow ? 'wide' : blink(t, 24) ? 'closed' : 'open', brows: 'up', mouth: o.wow ? 0.5 : 0 }, wind: o.wind || 0 }), 196, DY + 4, 1);
    }
    // Tamo holding the anchor (arms up): prop in sprite space; ang 0 = crown down, PI = crown up
    const heldAnchor = (ang, g, s, dx, dy) => (A, t) => { HB.toSprite(); anchorArt(A.hand[0] + 240 + (dx || 0), A.hand[1] + 135 + (dy || 0), ang, s || 1, g, t); TGT = FRAME; };
    HB.heldAnchor = heldAnchor;

    // 26a — he strides up to the anchor; the dockhand on his crates (3:17)
    shot(197.0, 198.4, (lt, t) => {
      stage(t, 200);
      const tx = lerp(TAX - 60, TAX, eoc(lin(197.0, 198.1, t))), walking = t < 198.0;
      dockhand(t);
      anchorInDeck(t, 0, 0);
      const P = walking ? walkP({ lean: 1, face: { eyes: 'narrow', brows: 'angry', smile: 0.5 } }, (tx - TAX) * 0.38, 6, TB) : Object.assign(stand(TB, 5), { arms: [{ a: 0.9, b: 1.2 }, { a: 0.8, b: 1.3 }], face: { eyes: 'open', brows: 'up', smile: 0.5, look: -1 }, headY: -1 });
      onDock(TAMO, P, tx, DY + 1, 1);
      harbourAfter(t);
      view(sx(AX + 12), 160, 2.5);
    });
    // 26a' — the dockhand, close: "Kid, that anchor hasn't moved in a hundred years"
    shot(198.4, 199.5, (lt, t) => {
      closeBg(() => { stage(t, 200); anchorInDeck(t, 0, 0); onDock(TAMO, Object.assign(stand(TB, 5), { arms: [{ a: 0.9, b: 1.2 }, { a: 0.8, b: 1.3 }] }), TAX, DY + 1, 1); }, sx(AX) - 6, 160, 3, 3);
      LIGHT.x = -0.7; LIGHT.y = -0.5; ENV.edge = C('fire', 6);
      const r = bust('docker', { t, puff: frac(t * 0.7) < 0.3 ? 1 : 0, face: { eyes: blink(t, 25) ? 'closed' : 'half', mouth: mouth('docker', t), brows: 'angry' }, headX: Math.round(Math.sin(t * 2)) }, 330, H - 22 + 6, 3, -1);
      ENV.edge = null;
      for (let k = 0; k < 8; k++) { const u = frac(t * 0.3 + k / 8), x = 268 - u * 30 + Math.sin(t + k) * 6, y = 140 - u * 110; const rr = 2 + u * 6; fillEll(x, y, rr, rr * 0.8, 0, (xx, yy) => (bay(xx, yy) < 0.6 * (1 - u) ? C('stone', 6) : -1)); }
    });

    // 26b — the grip (3:19): he spits on his hands, grips the shank and pulls; the planks groan and split; the sea is drawn
    // back out of the harbour in teal threads toward the iron; it lights up
    function strands(t, p, ax, ay) {
      if (p <= 0) return;
      for (let k = 0; k < 10; k++) {
        const s0 = [ih(k, 1, 481) * W, k < 5 ? 236 + ih(k, 2, 481) * 20 : DF - 6 - ih(k, 3, 481) * 20], head = clamp(p * 1.4 - ih(k, 4, 481) * 0.4, 0, 1);
        let px = s0[0], py = s0[1];
        for (let q = 1; q <= 24; q++) { const u = q / 24 * head, x = lerp(s0[0], ax, u) + Math.sin(u * 9 + t * 4 + k) * 14 * (1 - u), y = lerp(s0[1], ay, u) - Math.sin(u * PI) * 30 + Math.cos(u * 7 + t * 5) * 4 * (1 - u); line(px, py, x, y, q % 3 === 0 ? C('mint', 7) : C('teal', 5), q < 18 ? 2 : 1); px = x; py = y; }
        put(fl(px), fl(py), WHITE);
      }
    }
    shot(GRIP, RIP + 0.2, (lt, t) => {
      const wide = t > 201.4 && t < 202.4, g = glowOf(t), strain = lin(GRIP, RIP, t), p = pullOf(t), ripped = t >= RIP;
      const cx = wide ? 120 : 200;
      stage(t, cx);
      if (wide) { bystanders(t, { wow: true, wind: 2 }); }
      dockhand(t, { face: { eyes: t > 200.5 ? 'wide' : 'half', brows: 'up', mouth: t > RIP ? 0.8 : mouth('docker', t) } });
      cracks(sx(AX), DY + 3, ripped ? 1 : strain * strain);
      const lift = ripped ? eoc(lin(RIP, RIP + 0.2, t)) * 30 : (fl(t * 15) & 1) * strain * 2;
      const [ax, ay] = anchorInDeck(t, g, lift, ripped ? 0 : strain * 1.5);
      // Tamo: a crouch, hands on the shank, shaking with the effort; then the heave
      const shake = ripped ? 0 : Math.round((ih(fl(t * 30), 3, 9) - 0.5) * 2 * strain);
      const spit = t < GRIP + 0.5;
      const P = { hip: ripped ? -TB.leg + 2 : -TB.leg + 8 + shake * 0, lean: ripped ? -3 : 3, legs: [{ foot: [9, 0] }, { foot: [-9, 0] }],
        arms: spit ? [{ hand: [6, -44] }, { hand: [4, -43] }] : [{ hand: [21, ripped ? -62 : -32] }, { hand: [20, ripped ? -58 : -25] }],
        face: { eyes: spit ? 'happy' : strain > 0.5 || ripped ? 'closed' : 'narrow', brows: 'angry', mouth: spit ? 0.3 : ripped ? 0.9 : 0.6, smile: spit ? 0.6 : 0 } };
      const r = onDock(TAMO, P, TAX + shake * 0.5, DY + 1, 1);
      if (spit && t > GRIP + 0.25) for (let k = 0; k < 3; k++) put(r.handN[0] + k - 1, r.handN[1] - 2 - k, C('sky', 6));
      // sweat flying off him
      if (strain > 0.3 && !ripped) for (let k = 0; k < 5; k++) { const u = frac(t * 2 + k / 5); put(fl(r.head[0] + (k & 1 ? 6 : -6) * (1 + u * 2)), fl(r.head[1] - 8 + u * 12 - Math.sin(u * PI) * 6), C('sky', 7)); }
      // splinters springing out of the cracks
      if (strain > 0.4) for (let k = 0; k < 8; k++) { const ph = frac(t * 1.5 + ih(k, 1, 485)), x0 = sx(AX) + (ih(k, 2, 485) - 0.5) * 50; if (ph < 0.4) { const [px, py] = arc(x0, DY + 2, (ih(k, 3, 485) - 0.5) * 50, -90, 420, ph); line(px, py, px + 2, py - 1, C('wood', 5)); } }
      strands(t, p, ax, ay + 20);
      if (g > 0.4) glow(r.head[0], r.head[1] + 8, 20, tab('#40ffd0', true), (g - 0.4) * 0.3);
      if (ripped) { debris(sx(AX), DY, t - RIP, 30, 487, { big: true, speed: 1.5 }); dustRing(sx(AX), DY + 2, t - RIP, 1.4, 488); impactStar(sx(AX), DY - 20, t - RIP, 1.4, C('mint', 7)); }
      harbourAfter(t);
      if (ripped && t < RIP + 0.067) {} else if (wide) view(240, 150, 1.25);
      else { const u = lin(GRIP, 201.4, t); view(sx(AX) - 4 + (t > 202.4 ? 0 : u * 4), lerp(162, 156, u), t > 202.4 ? 3.0 : lerp(2.5, 2.9, u)); }
      shk(ripped ? 4 : strain * strain * 2.2 + (wide ? 1 : 0));
      if (ripped && t < RIP + 0.067) {
        BUF.fill(C('ink', 0)); const cx_ = 240, cy_ = 120;
        for (let k = 0; k < 60; k++) { const an = ih(k, 1, 992) * TAU, r0 = 40 + ih(k, 2, 992) * 60; line(cx_ + Math.cos(an) * r0, cy_ + Math.sin(an) * r0 * 0.7, cx_ + Math.cos(an) * 500, cy_ + Math.sin(an) * 350, C('mint', 6), ih(k, 3, 992) < 0.3 ? 2 : 1); }
        HB.IMPC = WHITE; onDock(TAMO, P, TAX, DY + 1, 1); lyBegin(); anchorArt(sx(AX), DY - 80, 0, 1.05, 1, t); lyEnd({ color: WHITE, outline: false }); HB.IMPC = undefined;
        view(sx(AX) - 4, 150, 2.6);
      }
    });

    // 26c — the hero shot (3:23): low on the planks, the anchor held high and blazing teal, the sea coming back over the dock
    shot(RIP + 0.2, 205.4, (lt, t) => {
      stage(t, 110);
      bystanders(t, { shield: t > 204.2, wow: true, wind: 2 + surgeOf(t) * 2 });
      dockhand(t, { face: { eyes: 'wide', brows: 'up', mouth: 0.8 } });
      const swing = eoc(lin(RIP + 0.2, RIP + 0.55, t));
      const P = { hip: -TB.leg + (swing < 1 ? 3 : 0), lean: 0, legs: [{ foot: [8, 0] }, { foot: [-9, 0] }], arms: [{ hand: [3, -74] }, { hand: [-2, -72] }], face: { eyes: t > 204.3 ? 'narrow' : 'closed', brows: 'angry', mouth: 0, smile: 0.6 }, wind: 1 + surgeOf(t) * 3, prop: heldAnchor(lerp(0.5, PI + 0.2, swing), 1, 1.0, 0, 4) };
      const r = onDock(TAMO, P, TAX, DY + 1, 1);
      LIGHT.x = 0.7;
      glow(r.handN[0], r.handN[1] - 24, 60, tab('#40ffd0', true), 0.5 + Math.sin(t * 14) * 0.05);
      // rings of teal light pulsing out of the iron
      for (let q = 0; q < 3; q++) { const u = frac(t * 1.2 + q / 3), rr = 6 + u * 70; for (let a = 0; a < TAU; a += 0.5 / rr) { const xx = fl(r.handN[0] + Math.cos(a) * rr), yy = fl(r.handN[1] - 24 + Math.sin(a) * rr * 0.7); if (bay(xx, yy) < (1 - u) * 0.8) put(xx, yy, C('mint', 7)); } }
      breakSpray(t);
      HB.harbourAfter(t);
      view(sx(TAX) + 10, 168, 2.1 + lt * 0.06);
      shk(surgeOf(t) * 2.5);
    });

    // 26d — Tamo, close (3:25): the anchor on his shoulder, salt rain falling — "That's not very fair… for you."
    shot(205.4, 208.0, (lt, t) => {
      closeBg(() => { stage(t, 110); bystanders(t, {}); }, sx(TAX) - 120, 150, 3, 3);
      LIGHT.x = 0.6; LIGHT.y = 0.5; ENV.edge = C('mint', 7);
      const tk = talking('tamo', t);
      bust('tamo', { t, anchor: 0.8, glow: 1, face: { eyes: blink(t, 23) ? 'closed' : t > 207.0 ? 'narrow' : 'open', brows: t > 207.0 ? 'angry' : 'n', mouth: mouth('tamo', t), smile: t > 206.8 ? 0.8 : 0.4 }, headY: tk ? -Math.round(Math.abs(Math.sin(t * 8))) : 0 }, 200, H - 22 + 6, 3, -1);
      ENV.edge = null;
      glow(200, 270, 160, tab('#40ffd0', true), 0.3);
      // the salt rain from the wave, big near drops
      for (let k = 0; k < 40; k++) { const sp_ = 200 + ih(k, 1, 491) * 120, x = ih(k, 2, 491) * W, y = ((t * sp_ + ih(k, 3, 491) * 400) % (H + 40)) - 20; for (let j = 0; j < 8; j++) put(fl(x), fl(y - j), j < 2 ? WHITE : C('sky', 5)); }
    });

    // 26e — the wardens look at each other (3:28)
    shot(208.0, 209.5, (lt, t) => {
      stage(t, 0);
      for (let k = 0; k < 3; k++) {
        const look = t > 208.25 + k * 0.12 && t < 209.0 ? (k === 1 ? (fl((t - 208.25) * 4) & 1 ? -1 : 1) : k === 0 ? 1 : -1) : 1, nod = t > 209.05 ? Math.round(Math.sin((t - 209.05) * 14)) : 0;
        const r = onDock(WARDEN, { headY: nod, legs: [{ foot: [7, 0] }, { foot: [-7, 0] }], arms: [{ a: 1.2, b: 0.1 }, { a: -0.3 }], prop: (A) => spearArt(A.hand[0], A.hand[1], 1.05, 26, t) }, WD2[k], WDY[k], look);
        glow(r.head[0] + 3 * look, r.head[1] - 1, 6, tab('#60e0ff', true), 0.45);
        if (k === 1 && t > 208.5) { const u = frac((t - 208.5) * 0.8); put(r.head[0] - 6, fl(r.head[1] - 8 + u * 10), C('sky', 7)); put(r.head[0] - 6, fl(r.head[1] - 7 + u * 10), C('sky', 5)); }
      }
      HB.harbourAfter(t);
      view(sx(WD2[1]) + 4, 156, 3.0);
    });

    // 26f — they come anyway (3:29): spears levelled, a charge; he drags the anchor out to meet them, sparks off the planks
    shot(209.5, 214.0, (lt, t) => {
      const cam = eio(lin(209.5, 213.5, t));
      stage(t, lerp(60, 150, cam));
      const TX = 300, tx = lerp(TAX, TX, eio(lin(210.0, 212.6, t))), dragging = t > 210.0 && t < 212.6;
      // Tamo turns, drags it: the crown scraping behind him
      const P = dragging ? walkP({ lean: -1, face: { eyes: 'narrow', brows: 'angry', smile: 0.6 }, arms: [{ hand: [-6, -30] }, { a: 0.3 }] }, (tx - TAX) * 0.4, 5, TB) : Object.assign(stand(TB, 7), { arms: [{ hand: [-6, -30] }, { a: 0.3 }], face: { eyes: 'narrow', brows: 'angry', smile: 0.6 } });
      P.prop = heldAnchor(-1.0, 1, 1.0, 0, 3);
      const r = onDock(TAMO, P, tx, DY + 1, -1);
      if (dragging) { const cx_ = sx(tx) + 44; for (let k = 0; k < 6; k++) { const u = frac(t * 3 + k / 6), [px, py] = arc(cx_, DY, 30 + ih(k, 1, 495) * 40, -40 - ih(k, 2, 495) * 50, 300, u * 0.4); put(fl(px), fl(py), u < 0.5 ? WHITE : C('mint', 6)); } for (let x = sx(TAX) + 44; x < cx_; x++) if (ih(x, 1, 496) < 0.6) put(x, DY + 1, C('hush', 6)); }
      glow(r.handN[0] - 20, r.handN[1] + 10, 30, tab('#40ffd0', true), 0.35);
      // the wardens: a nod, spears levelled, then they spread out and come at a run
      const go = lin(211.6, 214.0, t);
      for (let k = 0; k < 3; k++) {
        const x = WD2[k] + 30 + go * (k === 0 ? 100 : k === 1 ? 70 : 50), running = go > 0;
        const W_ = running ? HB.runP({ arms: [{ a: 1.35, b: 0.1 }, { a: -0.6 }] }, t * 14 + k, 6, WB) : { legs: [{ foot: [7, 0] }, { foot: [-7, 0] }], arms: [{ a: 1.35, b: 0.1 }, { a: -0.3 }] };
        W_.prop = (A) => spearArt(A.hand[0], A.hand[1], 1.4, 26, t);
        const rw = onDock(WARDEN, W_, x, WDY[k], 1);
        glow(rw.head[0] + 3, rw.head[1] - 1, 6, tab('#60e0ff', true), 0.45);
        if (running && fl(t * 7 + k) % 2 === 0) dustRing(sx(x) - 6, WDY[k], frac(t * 3.5 + k) * 0.4, 0.2, 497 + k);
      }
      // Kaira behind them: draws her blades
      const draw_ = sstep(211.0, 211.3, t);
      onDock(KAIRA, Object.assign(stand(KB, 6), { arms: [{ a: lerp(0.3, 1.2, draw_), b: 0.2 }, { a: lerp(0.2, -0.5, draw_), b: 0.4 }], face: { eyes: 'narrow', brows: 'angry', smile: 0.4 }, wind: 1, prop: draw_ > 0.3 ? (A) => swordArt(A.hand[0], A.hand[1], 0.9, 18, false) : undefined, propFar: draw_ > 0.3 ? (A) => swordArt(A.hand[0], A.hand[1], -0.6, 16, false) : undefined }), 150, DY + 6, 1);
      if (draw_ > 0.3 && draw_ < 1) { const kx = sx(150) + 10; for (let k = 0; k < 4; k++) put(kx + k * 3, DY - 40 - k, WHITE); }
      HB.harbourAfter(t);
      view(lerp(sx(236), sx(262), cam), 162, 1.8);
    });
  }
  /* ================================================================ 27: the fight (3:34–3:41) — an uppercut into the sea, a chain yanked
  // into the barrels, a kick out of a lightning step. Each hit holds the action's clock for a beat (hit-stop) on an impact frame. */
  {
    const { onDock, walkP, runP, stand, arc, debris, dustRing, impactStar, splash, shadowE, actorEx, harbour, harbourAfter, sx, bolt, heldAnchor, barrelArt, crateArt } = HB;
    const K = HB.consts, DY = K.DY, DF = K.DF, BRLX = K.BRLX;
    const TB = TAMO.body, KB = KAIRA.body, WB = WARDEN.body;
    const H1 = 214.8, H2 = 217.2, H3 = 219.6, HOLD = 0.12, HITS = [[H1, HOLD], [H2, HOLD], [H3, HOLD]];
    const clk = (t) => HB.holdClock(t, HITS), A = (e) => clk(e);
    const TX = 300, W1Y = DY - 4, W3Y = DY - 2, W2Y = DY + 2;
    const CRASH = A(H2) + 0.45, W2SPLASH = A(H3) + 0.62;
    // a clean impact frame: a flat field, focus lines, the figures as one-colour silhouettes
    function impactClean(bg, fg, lines_, cx, cy, figs) {
      BUF.fill(bg);
      for (let k = 0; k < 70; k++) { const an = ih(k, 1, 993) * TAU, r0 = 26 + ih(k, 2, 993) * 50; line(cx + Math.cos(an) * r0, cy + Math.sin(an) * r0 * 0.7, cx + Math.cos(an) * 520, cy + Math.sin(an) * 360, lines_, ih(k, 3, 993) < 0.3 ? 2 : 1); }
      HB.IMPC = fg; figs(); HB.IMPC = undefined;
    }
    // the chain: links along a sagging curve
    function chain(x0, y0, x1, y1, sag, t) { const n = Math.max(4, fl(Math.hypot(x1 - x0, y1 - y0) / 3)); for (let i = 0; i <= n; i++) { const u = i / n, x = fl(lerp(x0, x1, u)), y = fl(lerp(y0, y1, u) + Math.sin(u * PI) * sag); if (i & 1) { rectF(x - 1, y - 1, 4, 3, C('ink', 0)); put(x, y, C('snow', 7)); put(x + 1, y, C('steel', 4)); } else { rectF(x - 1, y - 2, 3, 5, C('ink', 0)); put(x, y - 1, C('snow', 7)); put(x, y, C('steel', 5)); put(x, y + 1, C('steel', 3)); } } }
    // Tamo's anchor angle and hands through the fight (in his facing space)
    function tamoPose(T, t) {
      const f = T < A(H2) - 0.5 || T > A(H3) + 0.18 ? -1 : 1;
      let ang = 1.9, hand = [10, -40], hand2 = [7, -38], hip = -TB.leg, lean = 0, face = { eyes: 'narrow', brows: 'angry', smile: 0.5 }, legs = [{ foot: [8, 0] }, { foot: [-8, 0] }];
      if (T < A(H2) - 0.5) {
        const wind = sstep(214.3, 214.72, T), sw = lin(214.72, 214.84, T);
        if (sw <= 0) { ang = lerp(-1.0, -0.5, wind); hand = [lerp(-6, -10, wind), -30]; hand2 = [lerp(-8, -12, wind), -31]; hip = -TB.leg + wind * 5; lean = -wind * 3; face = { eyes: 'narrow', brows: 'angry', smile: wind > 0.5 ? 0.8 : 0.4 }; legs = [{ foot: [10, 0] }, { foot: [-10, 0] }]; }
        else { const e = eoc(sw); ang = lerp(-0.5, 2.7, e); hand = [lerp(-10, 6, e), lerp(-30, -66, e)]; hand2 = [hand[0] - 3, hand[1] + 2]; hip = -TB.leg + lerp(5, -2, e); lean = lerp(-3, 4, e); face = { eyes: 'closed', brows: 'angry', mouth: 0.9 }; legs = [{ foot: [12, -e * 3] }, { foot: [-10, 0] }];
          const settle = lin(214.95, 215.6, T); if (settle > 0) { ang = lerp(2.7, 1.9, eio(settle)); hand = [lerp(6, 10, settle), lerp(-66, -40, eio(settle))]; hand2 = [hand[0] - 3, hand[1] + 2]; hip = -TB.leg; lean = lerp(4, 0, settle); face = { eyes: 'narrow', brows: 'angry', smile: 0.7 }; legs = [{ foot: [8, 0] }, { foot: [-8, 0] }]; } }
      } else {
        // the chain: he leans in, then heaves it back over his shoulder; then turns to watch
        const lean_ = sstep(A(H2) - 0.35, A(H2) - 0.05, T), yank = lin(A(H2) - 0.05, A(H2) + 0.12, T);
        if (T < A(H2) - 0.05) { ang = 1.9 + lean_ * 0.2; hand = [10 + lean_ * 4, -40]; hand2 = [8 + lean_ * 4, -38]; lean = lean_ * 3; hip = -TB.leg + lean_ * 3; face = { eyes: 'narrow', brows: 'angry', smile: 0.8, look: 0 }; }
        else if (yank < 1 || T < A(H2) + 0.6) { const e = eoc(Math.min(1, yank)); ang = lerp(2.1, -2.2, e); hand = [lerp(14, -6, e), lerp(-40, -60, e)]; hand2 = [hand[0] - 2, hand[1] + 2]; lean = lerp(3, -4, e); face = { eyes: 'closed', brows: 'angry', mouth: 0.8 }; legs = [{ foot: [10, 0] }, { foot: [-12, 0] }]; }
        else { const r_ = lin(A(H2) + 0.6, A(H2) + 1.0, T); ang = lerp(-2.2, 1.9, eio(r_)); hand = [lerp(-6, 10, r_), lerp(-60, -40, r_)]; hand2 = [hand[0] - 3, hand[1] + 2]; face = { eyes: T > A(H3) + 0.1 ? 'wide' : 'narrow', brows: T > A(H3) + 0.1 ? 'up' : 'angry', smile: T > A(H3) + 0.6 ? 0.8 : 0.4, look: T > A(H3) + 0.05 ? -1 : 0 }; }
      }
      return { f, P: { hip, lean, legs, arms: [{ hand }, { hand: hand2 }], face, wind: 1, prop: heldAnchor(ang, 1, 1.0, 0, 3) }, ang };
    }
    function fightStage(t, T, cx, o) {
      harbour(t, Object.assign({ cx, props: { noBarrels: T > CRASH } }, o || {}));
      if (T > CRASH) { const x = sx(BRLX); crateArt(x + 19, DF + 9, 20, 17, 12); barrelArt(x + 12, DF + 16, 8, 14, 10); for (let k = 0; k < 7; k++) { const px = x - 18 + k * 6, py = DF + 14 + (k & 1) * 3; line(px, py, px + 5, py - 2 + (k % 3), C('wood', 3), 2); } }
    }
    // the three wardens through the fight
    function w1(t, T) {
      const hitT = A(H1);
      if (T < hitT) { const x = lerp(232, 272, lin(214.0, 214.72, T)); const P = runP({ arms: [{ a: 1.45 + lin(214.5, 214.72, T) * 0.2, b: 0 }, { a: -0.7 }] }, T * 15, 6, WB); P.prop = (Aa) => spearArt(Aa.hand[0], Aa.hand[1], 1.45, 26, t); return onDock(WARDEN, P, x, W1Y, 1); }
      const g = T - hitT, [x, y] = arc(sx(272), W1Y - 30, -160, -255, 600, g);
      if (g > 0.8) return null;
      return HB.actorEx(WARDEN, { t, legs: [{ foot: [5, -4] }, { foot: [-6, 2] }], arms: [{ a: 2.6, b: 0.4 }, { a: -2.2, b: 0.3 }] }, x, y, 1, { rot: -g * 13, px: 0, py: -30 });
    }
    function w3(t, T) {
      const throwT = 216.0, wrapT = 216.25, yankT = A(H2) - 0.05;
      if (T < yankT + 0.02) {
        const pulling = T > wrapT, x = (T < 215.7 ? 186 : 206) - (pulling ? lin(wrapT, yankT, T) * 4 : 0);
        const whirl = T < throwT, thr = lin(throwT, wrapT, T);
        const P = { hip: -WB.leg + (pulling ? 4 : 0), lean: pulling ? -3 : 0, legs: [{ foot: [9, 0] }, { foot: [-9, 0] }], arms: whirl ? [{ a: PI - 0.2, b: 0.2 }, { a: -0.3 }] : [{ a: lerp(2.6, 1.5, thr), b: 0.1 }, { a: 1.3, b: 0.3 }] };
        const r = onDock(WARDEN, P, x, W3Y, 1);
        return { r, x };
      }
      const g = T - yankT;
      if (T < CRASH) { const u = (T - yankT) / (CRASH - yankT), x = lerp(sx(202), sx(BRLX - 4), u), y = lerp(W3Y - 30, DF + 2, u) - Math.sin(u * PI) * 120; return { r: HB.actorEx(WARDEN, { t, legs: [{ foot: [6, -3] }, { foot: [-6, 1] }], arms: [{ a: 1.4, b: 0.2 }, { a: 2.8, b: 0.2 }] }, x, y, 1, { rot: lerp(0, -PI * 1.6, u), px: 0, py: -30 }) }; }
      // in the wreck of the barrels, legs in the air, twitching
      const tw = Math.sin(T * 12) * Math.max(0, 1 - (T - CRASH) * 0.6);
      const r_ = HB.actorEx(WARDEN, { t, legs: [{ foot: [5 + tw * 2, -2] }, { foot: [-5, 0] }], arms: [{ a: 0.3 }, { a: 0.3 }] }, sx(BRLX) + 2, DF - 16, 1, { rot: PI - 0.15, px: 0, py: -30 });
      barrelArt(sx(BRLX) - 2, DF + 14, 9, 13, 21); for (let k = 0; k < 5; k++) line(sx(BRLX) - 12 + k * 5, DF + 2 + (k & 1) * 2, sx(BRLX) - 9 + k * 5, DF - 4 + (k % 3), C('wood', 4), 2);
      return { r: r_ };
    }
    function w2(t, T) {
      const hitT = A(H3);
      if (T < hitT) { const sneak = lin(hitT - 1.5, hitT - 0.6, T), x = lerp(150, 266, sneak), back = sstep(hitT - 0.6, hitT - 0.3, T), thrust = lin(hitT - 0.12, hitT, T);
        if (sneak <= 0) return null;
        const P = sneak < 1 ? walkP({ hip: -WB.leg + 5, lean: 3, arms: [{ a: 1.2, b: 0.2 }, { a: -0.3 }] }, T * 11, 5, WB) : { hip: -WB.leg + 5, lean: 3, legs: [{ foot: [10, 0] }, { foot: [-9, 0] }], arms: [{ a: 1.45, b: 0, }, { a: -0.5 }] };
        const sx_ = -back * 8 + eoc(thrust) * 16;
        P.prop = (Aa) => spearArt(Aa.hand[0] + sx_, Aa.hand[1], 1.5, 26, t);
        return onDock(WARDEN, P, x, W2Y, 1); }
      const g = T - hitT; if (T > W2SPLASH) return null;
      const [x, y] = arc(sx(276), W2Y - 26, -150, -80, 700, g);
      return HB.actorEx(WARDEN, { t, legs: [{ foot: [7, -4] }, { foot: [-5, 1] }], arms: [{ a: -2.4, b: 0.3 }, { a: 2.6, b: 0.3 }] }, x, y, 1, { rot: g * 9, px: 0, py: -30 });
    }
    // Kaira: watching, then the lightning step and the kick, and she lands crackling
    function kaira(t, T) {
      const hitT = A(H3), go = hitT - 0.26, arrive = hitT - 0.12;
      const blades = (A_) => swordArt(A_.hand[0], A_.hand[1], 0.9, 18, false), blades2 = (A_) => swordArt(A_.hand[0], A_.hand[1], -0.6, 16, false);
      if (T < go) { const P = Object.assign(stand(KB, 6), { arms: [{ a: 1.2, b: 0.2 }, { a: -0.5, b: 0.4 }], face: { eyes: T > go - 0.5 ? 'narrow' : 'open', brows: 'angry', smile: 0.3, look: 1 }, wind: 1, prop: blades, propFar: blades2, hip: -KB.leg + sstep(go - 0.3, go - 0.05, T) * 7 }); onDock(KAIRA, P, 160, DY + 6, 1); return [160, DY + 6]; }
      if (T < arrive) {
        const u = lin(go, arrive, T), x0 = sx(160), x1 = sx(296);
        bolt(x0, DY - 20, lerp(x0, x1, u), DY - 24, fl(t * 30), 1, WHITE, C('gold', 5));
        for (let k = 0; k < 3; k++) { const q = Math.max(0, u - (2 - k) * 0.22); onDock(KAIRA, runP({ face: {} }, k * 1.3 + 0.6, 9, KB), lerp(160, 296, q), DY + 6 - k, 1, { color: C('gold', 3 + k * 2), noShadow: true }); }
        return [lerp(160, 296, u), DY];
      }
      // the turn, the kick, the follow-through and a crackling landing
      const wind = lin(arrive, hitT, T), kick = T >= hitT && T < hitT + 0.3, land = lin(hitT + 0.3, hitT + 0.5, T);
      let P;
      if (T < hitT) P = { hip: -KB.leg + 4, lean: -2, legs: [{ foot: [4, 0] }, { foot: [-8 + wind * 4, -wind * 6] }], arms: [{ a: 2.2, b: 0.3 }, { a: -1.2, b: 0.4 }], face: { eyes: 'narrow', brows: 'angry' }, wind: 3 };
      else if (kick) P = { hip: -KB.leg + 1, lean: -6, legs: [{ foot: [24, -32], knee: [12, -30] }, { foot: [-3, 0] }], arms: [{ a: -1.6, b: 0.4 }, { a: 2.0, b: 0.4 }], face: { eyes: 'narrow', brows: 'angry', mouth: 0.5 }, wind: 4 };
      else P = Object.assign(stand(KB, 8), { hip: -KB.leg + (land < 1 ? 6 * (1 - land) : 3), arms: [{ a: 1.3, b: 0.2 }, { a: -0.6, b: 0.4 }], face: { eyes: 'narrow', brows: 'angry', smile: 0.6 }, wind: 1 });
      P.prop = blades; P.propFar = blades2;
      onDock(KAIRA, P, 296, DY + 4, -1);
      // crackles of gold round her
      const cr = Math.max(0, 1 - (T - arrive) * 0.5);
      for (let k = 0; k < 3; k++) if (ih(k, fl(t * 20), 7) < cr) { const a = ih(k, fl(t * 20), 8) * TAU; bolt(sx(296), DY - 30, sx(296) + Math.cos(a) * 20, DY - 30 + Math.sin(a) * 26, fl(t * 30) + k, 1, WHITE, C('gold', 5)); }
      glow(sx(296), DY - 30, 30, tab('#ffd060', true), 0.3 * cr + 0.1);
      return [296, DY + 4];
    }

    shot(214.0, 221.0, (lt, t) => {
      const T = clk(t), inHold = HITS.find(([h, d]) => t >= h && t < h + d), imp = HITS.find(([h]) => t >= h && t < h + 0.067);
      // the camera: three set-ups
      let cx = 150, vx, vy, Z; HB.setCX(cx);
      if (t < 215.7) { const fol = sstep(214.95, 215.4, T); vx = lerp(sx(282), sx(252), fol); vy = lerp(162, 140, fol); Z = lerp(2.6, 2.1, fol); }
      else if (t < 218.4) { const pan = eio(lin(A(H2) + 0.08, CRASH + 0.15, T)); vx = lerp(sx(256), sx(BRLX - 24), pan); vy = 160 - Math.sin(pan * PI) * 20; Z = lerp(2.2, 2.0, Math.sin(pan * PI)); }
      else { const punch = sstep(A(H3) - 0.14, A(H3) - 0.02, T) * (1 - sstep(A(H3) + 0.4, A(H3) + 0.9, T)); vx = lerp(sx(232), sx(284), punch); vy = lerp(162, 160, punch); Z = lerp(2.0, 2.8, punch); }
      if (imp) {
        const k = HITS.indexOf(imp);
        impactClean(k === 2 ? C('ink', 0) : WHITE, k === 2 ? C('gold', 7) : C('ink', 0), k === 2 ? C('gold', 5) : C('ink', 0), 240, 130, () => { harbour(t, { cx }); BUF.fill(k === 2 ? C('ink', 0) : WHITE); impactClean(k === 2 ? C('ink', 0) : WHITE, k === 2 ? C('gold', 7) : C('ink', 0), k === 2 ? C('gold', 5) : C('ink', 0), (vx - 240) / Z + 240, 130, () => {});
          HB.IMPC = k === 2 ? C('gold', 7) : C('ink', 0);
          const tp = tamoPose(T, t); onDock(TAMO, tp.P, TX, DY + 1, tp.f);
          if (k === 0) w1(t, T); if (k === 1) w3(t, T); if (k === 2) { w2(t, T); kaira(t, T); } });
        view(vx, vy, Z); shk(4); return;
      }
      fightStage(t, T, cx);
      // the far splash where the first one went in
      splash(sx(272) - 128, 152, T - (A(H1) + 0.8), 0.8, 501);
      // W1, W3 (whirling the chain), Tamo, W2, Kaira
      const r1 = w1(t, T);
      const r3 = w3(t, T);
      const tp = tamoPose(T, t), rT = onDock(TAMO, tp.P, TX, DY + 1, tp.f);
      // the anchor's light, and a smear where it swung
      const crown = [rT.handN[0] + Math.sin(tp.ang) * 52 * tp.f, rT.handN[1] + Math.cos(tp.ang) * 52];
      glow(crown[0], crown[1], 24, tab('#40ffd0', true), 0.35);
      if ((T > 214.74 && T < 214.92) || (T > A(H2) - 0.03 && T < A(H2) + 0.18)) {
        const up = T < 216; const a0 = up ? -0.5 : 2.1, a1 = up ? lerp(-0.5, 2.7, eoc(lin(214.72, 214.84, T))) : lerp(2.1, -2.2, eoc(lin(A(H2) - 0.05, A(H2) + 0.12, T)));
        for (let q = 0; q <= 24; q++) { const a = lerp(a0, a1, q / 24), rr = 50; for (let w = -4; w <= 4; w++) { const xx = fl(rT.handN[0] + Math.sin(a) * (rr + w) * tp.f), yy = fl(rT.handN[1] + Math.cos(a) * (rr + w)); if (bay(xx, yy) < q / 24) put(xx, yy, Math.abs(w) < 2 ? WHITE : C('mint', 6)); } }
      }
      // the chain: whirling over his head, flying, wrapped round the shank, taut
      if (r3 && r3.x !== undefined && t > 215.7) {
        const hx = r3.r.handN[0], hy = r3.r.handN[1];
        if (T < 216.0) { const a = T * 16; chain(hx, hy, hx + Math.cos(a) * 16, hy - 10 + Math.sin(a) * 5, 2, t); }
        else { const u = eoc(lin(216.0, 216.25, T)), sx2 = rT.handN[0] - 14, sy2 = rT.handN[1] - 4; chain(hx, hy, lerp(hx, sx2, u), lerp(hy, sy2, u), T > 216.25 ? (T > 216.5 ? 0 : 3) : 6, t); if (T > 216.25) for (let q = 0; q < 3; q++) { chain(sx2 - 3, sy2 - 3 + q * 3, sx2 + 3, sy2 - 1 + q * 3, 0, t); } }
      } else if (T < CRASH && T > A(H2)) { const hx = r3.r.handN[0], hy = r3.r.handN[1]; chain(hx, hy, rT.handN[0], rT.handN[1] - 4, 4, t); }
      const r2 = w2(t, T);
      if (T > A(H3) && T < W2SPLASH) { /* speed lines behind him */ for (let k = 0; k < 6; k++) { const y = DY - 50 + k * 8; line(sx(276) + 10, y, sx(276) + 60, y, C('snow', 7)); } }
      splash(sx(276) - 150 * (W2SPLASH - A(H3)), 232, T - W2SPLASH, 1.0, 503);
      kaira(t, T);
      // the hits
      impactStar(sx(266), DY - 40, T - A(H1), 1.6, C('mint', 7));
      if (T > CRASH) { debris(sx(BRLX), DF + 6, T - CRASH, 24, 505, { big: true, speed: 1.1, floor: DF + 14 }); dustRing(sx(BRLX), DF + 12, T - CRASH, 1.2, 506); impactStar(sx(BRLX), DF - 4, T - CRASH, 1.4, C('fire', 6)); }
      impactStar(sx(282), DY - 34, T - A(H3), 1.8, C('gold', 6));
      harbourAfter(t);
      view(vx, vy, Z);
      if (inHold) shk(4);
      else shk(T > CRASH && T < CRASH + 0.3 ? 3 : T > W2SPLASH && T < W2SPLASH + 0.2 ? 1.5 : 0);
    });
  }
  /* ================================================================ 28–29: the breather, then the world goes quiet (3:41–4:06) */
  {
    const { onDock, stand, arc, dustRing, impactStar, splash, shadowE, harbour, harbourAfter, sx, heldAnchor, barrelArt, crateArt, bolt } = HB;
    const K = HB.consts, DY = K.DY, DF = K.DF, BRLX = K.BRLX, HUSH_T = K.HUSH_T;
    const TB = TAMO.body, KB = KAIRA.body, WB = WARDEN.body;
    const KX = 268, TXX = 312;
    // how drained the world is: a chill from the moment it stops, deepening
    const chillOf = (t) => (t < HUSH_T ? 0 : 0.12 + 0.18 * lin(HUSH_T, 236, t));
    HB.chillOf = chillOf;
    const T_CHILL = tab('#dfe3f2');
    // the warden who went into the water: head and an arm out, thrashing (frozen with the world)
    function swimmer(t, wx, wl) {
      const rt = Math.min(t, HUSH_T), x = sx(wx), fl_ = Math.sin(rt * 9);
      onDock(WARDEN, { hip: -WB.leg, arms: [{ a: 2.6 + fl_ * 0.4, b: 0.3 }, { a: 2.2 - fl_ * 0.4, b: 0.4 }], legs: [{ foot: [4, 0] }, { foot: [-4, 0] }] }, wx, wl + 44 + Math.round(Math.sin(rt * 3) * 1.5), 1, { noShadow: true });
      for (let y = wl + 3; y < H; y++) for (let xx = x - 16; xx <= x + 16; xx++) if (xx >= 0 && xx < W) BUF[y * W + xx] = cel(R.sea, 2.6 + (vn(xx * 0.4 + rt * 3, y * 1.3, 1, 611) > 0.65 ? 1.5 : 0), xx, y);
      for (let k = 0; k < 18; k++) { const ph = frac(rt * 1.6 + ih(k, 1, 612)), a = -PI / 2 + (ih(k, 2, 612) - 0.5) * 2.4, v = 40 + ih(k, 3, 612) * 50; const [px, py] = arc(x + (ih(k, 4, 612) - 0.5) * 16, wl + 2, Math.cos(a) * v, Math.sin(a) * v, 300, ph * 0.5); if (py < wl + 3) { put(fl(px), fl(py), WHITE); if (t > HUSH_T) put(fl(px), fl(py) + 1, C('sky', 6)); } }
      for (let xx = x - 15; xx <= x + 15; xx++) if (ih(xx, fl(rt * 8), 613) < 0.6) put(xx, wl + 3, WHITE);
    }
    // the dock after the fight: W3's boots out of the barrels, the anchor on the planks
    function aftermath(t, cx, o) {
      const wl = harbour(t, Object.assign({ cx, props: { noBarrels: true } }, o || {}));
      const x = sx(BRLX); crateArt(x + 19, DF + 9, 20, 17, 12); barrelArt(x + 12, DF + 16, 8, 14, 10); for (let k = 0; k < 7; k++) { const px = x - 18 + k * 6, py = DF + 14 + (k & 1) * 3; line(px, py, px + 5, py - 2 + (k % 3), C('wood', 3), 2); }
      const rt = Math.min(t, HUSH_T), tw = Math.sin(rt * 5) * (rt < HUSH_T ? 1 : 0);
      HB.actorEx(WARDEN, { t, legs: [{ foot: [5 + tw, -2] }, { foot: [-5, 0] }], arms: [{ a: 0.3 }, { a: 0.3 }] }, x + 2, DF - 16, 1, { rot: PI - 0.15, px: 0, py: -30 });
      barrelArt(x - 2, DF + 14, 9, 13, 21);
      swimmer(t, 172, wl);
      return wl;
    }
    HB.aftermath = aftermath;
    function heroes(t, o) {
      o = o || {};
      const kP = Object.assign(stand(KB, 5), o.k || {}); kP.prop = (A) => swordArt(A.hand[0], A.hand[1], 0.5, 18, false); kP.propFar = (A) => swordArt(A.hand[0], A.hand[1], -0.4, 16, false);
      const rK = onDock(KAIRA, kP, o.kx || KX, DY + 3, o.kf || 1);
      const tP = Object.assign(stand(TB, 6), o.t || {}); if (!o.noAnchor && !tP.prop) tP.prop = heldAnchor(-1.0, o.glow === undefined ? 0.5 : o.glow, 1.0, 0, 3);
      const rT = onDock(TAMO, tP, o.tx || TXX, DY + 1, o.tf || -1);
      return { rK, rT };
    }
    HB.heroes = heroes;

    // 28a — Kaira, close (3:41): "Okay. Who ARE you?" — breathing hard, the last of the sparks going out of her
    shot(221.0, 222.8, (lt, t) => {
      closeBg(() => { aftermath(t, 150); heroes(t, { k: {}, t: {} }); }, sx(TXX) - 30, 160, 3, 3);
      LIGHT.x = -0.7; LIGHT.y = -0.5; ENV.edge = C('fire', 6);
      const pant = Math.round(Math.abs(Math.sin(t * 7))) ;
      const r = bust('kaira', { t, wind: 1, face: { eyes: blink(t, 22) ? 'closed' : lt < 0.4 ? 'narrow' : 'open', brows: t > 221.6 ? 'up' : 'n', mouth: mouth('kaira', t), smile: t > 222.0 ? 0.3 : 0 }, headY: -pant }, 280, H - 22 + 6, 3, -1);
      ENV.edge = null;
      const cr = Math.max(0, 1 - lt * 0.7); for (let k = 0; k < 3; k++) if (ih(k, fl(t * 20), 9) < cr * 0.6) { const a = ih(k, fl(t * 20), 8) * TAU, x0 = 240 + Math.cos(a) * 80, y0 = 170 + Math.sin(a) * 60; bolt(x0, y0, x0 + Math.cos(a) * 30, y0 + Math.sin(a) * 30, fl(t * 30) + k, 1, WHITE, C('gold', 5)); }
    });
    // 28b — Tamo, close (3:43): "Tamo! I work here. Well…" — the glow going out of the iron on his shoulder
    shot(222.8, 225.3, (lt, t) => {
      closeBg(() => { aftermath(t, 150); heroes(t, {}); }, sx(KX) - 10, 160, 3, 3);
      LIGHT.x = 0.7; LIGHT.y = -0.5; ENV.edge = C('fire', 6);
      const tk = talking('tamo', t), bounce = t < 223.6 ? -Math.round(Math.abs(Math.sin(t * 9)) * 2) : 0;
      bust('tamo', { t, anchor: Math.max(0, 0.6 - lt * 0.3), face: { eyes: blink(t, 21) ? 'closed' : t < 223.5 ? 'happy' : 'open', brows: t > 224.3 ? 'worried' : 'up', mouth: mouth('tamo', t), smile: t < 224.3 ? 0.9 : 0.3, look: t > 224.5 ? 1 : 0 }, headY: bounce }, 200, H - 22 + 6, 3, 1);
      ENV.edge = null;
    });
    // 28c — the two of them (3:45): "…I did, until you landed on me." She laughs; he grins and rubs his neck
    shot(225.3, 228.0, (lt, t) => {
      aftermath(t, 150);
      const laugh = t > 226.0, hb = laugh ? Math.round(Math.abs(Math.sin(t * 11))) : 0;
      heroes(t, { k: { hip: -KB.leg + hb, lean: laugh ? 2 : 0, arms: laugh ? [{ hand: [6, -26] }, { a: -0.3, b: 0.6 }] : [{ a: 0.4, b: 0.3 }, { a: -0.2 }], face: { eyes: laugh ? 'happy' : blink(t, 22) ? 'closed' : 'open', mouth: laugh ? 0.5 + hb * 0.3 : 0, smile: 0.9 } },
        t: { arms: [{ hand: [-4, -60], bend: 1 }, { a: 0.2 }], face: { eyes: laugh ? 'happy' : 'open', mouth: mouth('tamo', t), smile: 0.8, blush: laugh ? 1 : 0 }, headY: laugh ? -hb : 0, prop: undefined, propFar: undefined }, noAnchor: true });
      HB.anchorFloor(t, TXX + 40);
      harbourAfter(t);
      view(sx(290), 160, lerp(2.5, 2.7, lt / 2.7));
    });
    // the anchor lying on the planks where he put it down
    HB.anchorFloor = (t, wx, g) => { HB.lyBegin(); HB.anchorArt(sx(wx) - 26, DY + 2, PI / 2 - 0.06, 1.0, g || 0.15, t); HB.lyEnd({ edge: C('fire', 6) }); };

    // 29a — the world goes quiet (3:48): gulls stop in the air, the spray hangs, the boats stop; the laughing stops; they look up
    shot(228.0, 231.0, (lt, t) => {
      const ch = chillOf(t), up = sstep(229.4, 229.9, t);
      aftermath(t, 120);
      const laughing = t < HUSH_T + 0.25, hb = laughing ? Math.round(Math.abs(Math.sin(t * 11))) : 0;
      heroes(t, { k: { hip: -KB.leg + hb, lean: laughing ? 2 : 0, headY: -Math.round(up * 2), arms: laughing ? [{ hand: [6, -26] }, { a: -0.3, b: 0.6 }] : [{ a: 0.5, b: 0.4 }, { a: -0.2 }], face: { eyes: laughing ? 'happy' : 'wide', brows: laughing ? 'n' : 'worried', mouth: laughing ? 0.6 : mouth('kaira', t), smile: laughing ? 0.9 : 0, look: t > 228.9 && t < 229.4 ? -1 : 0 } },
        t: { headY: -Math.round(up * 2), arms: laughing ? [{ hand: [-4, -60], bend: 1 }, { a: 0.2 }] : [{ a: 0.3, b: 0.3 }, { a: 0.2 }], face: { eyes: laughing ? 'happy' : 'wide', brows: laughing ? 'n' : 'up', mouth: laughing ? 0.5 : 0, smile: laughing ? 0.8 : 0, look: t > 228.9 && t < 229.4 ? 1 : 0 } }, noAnchor: true });
      HB.anchorFloor(t, TXX + 40);
      if (t < HUSH_T) harbourAfter(t);
      HB.tintFlat(T_CHILL, ch);
      // a held breath: the motes hang too
      if (t > HUSH_T) for (let k = 0; k < 40; k++) { const x = fl((ih(k, 1, 371) * W + HUSH_T * (4 + ih(k, 2, 371) * 6)) % W), y = fl(30 + ih(k, 3, 371) * 200); if (ih(k, 4, 371) < 0.5) put(x, y, WHITE); }
      view(lerp(sx(250), sx(262), lt / 3), lerp(158, 150, up), lerp(2.0, 2.2, lt / 3));
    });

    // the sky over the harbour opening: rings of glyphs, the paper inside, cracks running out across the dawn
    function ringSky(t, cx, cy, r, op) {
      sigil(cx, cy, r, 0.32, t, op, 211);
      hush((x, y) => { const d = Math.hypot((x - cx) / r, (y - cy) / (r * 0.32)); return d < 0.5 ? 0.9 : d < 0.68 ? 0.45 + (0.68 - d) * 2.4 : 0; }, t, true);
      for (let y = Math.max(0, fl(cy - r * 0.32)); y < Math.min(H, cy + r * 0.32); y++) for (let x = Math.max(0, fl(cx - r)); x < Math.min(W, cx + r); x++) { const d = Math.hypot((x - cx) / r, (y - cy) / (r * 0.32)); if (d < 0.66 && d > 0.25 && (x + y * 2) % 7 === 0 && ih(x >> 2, y >> 2, 624) < d) put(x, y, C('hush', 3)); }
      for (let k = 0; k < 10; k++) { const a = k / 10 * TAU + 0.2, len = r * (0.3 + ih(k, 1, 621) * 0.6) * op; let px = cx + Math.cos(a) * r, py = cy + Math.sin(a) * r * 0.32; for (let s = 0; s < 6; s++) { const nx = px + Math.cos(a + (ih(k, s, 622) - 0.5)) * len / 6, ny = py + Math.sin(a + (ih(k, s, 623) - 0.5)) * len / 6 * 0.6; line(px, py, nx, ny, s < 2 ? WHITE : C('hush', 5)); px = nx; py = ny; } }
    }
    HB.ringSky = ringSky;
    // 29b — up at the sky (3:51): from the planks, past the two of them, the ring opening over the harbour
    // a figure dark against the sky, its rim of white kept (a silhouette that still has an edge)
    const silFx = (c, x, y, k) => (k === 4 && c === C('hush', 6) ? c : C('ink', LUM[c] > 140 ? 2 : 1));
    HB.silFx = silFx;
    shot(231.0, 235.4, (lt, t) => {
      const op = eoc(lin(231.0, 234.6, t)), rt = HUSH_T, tilt = eio(lt / 4.4);
      harbour(t, { cx: 60, rt });
      // the camera tipped up: the harbour slides down the frame and the sky above it opens out
      const sh = fl(lerp(70, 118, tilt));
      for (let y = H - 1; y >= sh; y--) BUF.copyWithin(y * W, (y - sh) * W, (y - sh) * W + W);
      for (let y = 0; y < sh; y++) for (let x = 0; x < W; x++) BUF[y * W + x] = soft(R.dusk, 0.9 + y / sh * 0.6, x, y);
      cloudBank(sh - 20, 9, 9, R.dusk, 1.8, 51, rt, 0);
      HB.tintFlat(T_CHILL, chillOf(t) + 0.06);
      ringSky(t, 246, 58 + sh * 0.2, 40 + op * 200, Math.min(1, lt / 1.6));
      rays(246, 60 + sh * 0.2, 9, 300, tab('#e8ecff', true), 0.25 * op, t, 7);
      HB.gullsFrozen(t, sh);
      // the two of them in the foreground, dark against it, looking up
      LIGHT.x = 0; LIGHT.y = -1; ENV.edge = C('hush', 6);
      bust('kaira', { t, wind: 0.5, face: { eyes: 'wide', brows: 'worried', mouth: mouth('kaira', t) }, headY: -3 }, 96, H - 22 + 44 - fl(tilt * 10), 3, 1, { fx: silFx });
      bust('tamo', { t, face: {}, headY: -3 }, 392, H - 22 + 52 - fl(tilt * 10), 3, -1, { fx: silFx });
      ENV.edge = null;
      shk(op * 0.6);
    });
    // gulls hanging in the air, mid-flap
    HB.gullsFrozen = (t, dy) => { for (let k = 0; k < 9; k++) { const x = fl(60 + ih(k, 1, 651) * 360), y = fl(30 + ih(k, 2, 651) * 90 + (dy || 0) * 0.3), up = k & 1 ? -2 : 1; const c = C('snow', 7), cd = C('stone', 4); put(x, y, c); put(x + 1, y, c); put(x - 1, y + (up < 0 ? -1 : 0), cd); put(x + 2, y + (up < 0 ? -1 : 0), cd); put(x - 2, y + up, cd); put(x + 3, y + up, cd); put(x - 3, y + up * 1.5, C('ink', 2)); put(x + 4, y + up * 1.5, C('ink', 2)); } };
    // 29c — Tamo, close (3:55): the dark lighthouse behind him — "Hollow. They took the lighthouse keeper last week.
    // Nobody even remembers his name."
    shot(235.4, 240.4, (lt, t) => {
      closeBg(() => { harbour(t, { cx: 60, rt: HUSH_T }); HB.tintFlat(T_CHILL, chillOf(t) + 0.06); ringSky(t, 300, -6, 150, 1); }, 412, 66, 3, 3);
      LIGHT.x = 0.2; LIGHT.y = -1; ENV.edge = C('hush', 6);
      bust('tamo', { t, face: { eyes: blink(t, 21) ? 'closed' : t > 238.6 ? 'sad' : 'half', brows: 'worried', mouth: mouth('tamo', t), smile: -0.2, look: t < 237 ? 1 : 0 }, headX: t > 238.6 ? -1 : 0 }, 160, H - 22 + 6, 3, 1);
      ENV.edge = null;
      // glyph-flakes drifting down like ash
      for (let k = 0; k < 30; k++) { const u = frac(t * 0.08 + ih(k, 1, 631)), x = fl(ih(k, 2, 631) * W + Math.sin(t + k) * 8), y = fl(u * H); put(x, y, ih(k, 3, 631) < 0.3 ? C('crimson', 5) : WHITE); if (k % 3 === 0) put(x + 1, y, C('hush', 4)); }
    });
    // 29d — Kaira, close (4:00): the mark on her chest stirring gold under her collar
    shot(240.4, 242.0, (lt, t) => {
      closeBg(() => { harbour(t, { cx: 60, rt: HUSH_T }); HB.tintFlat(T_CHILL, chillOf(t) + 0.06); ringSky(t, 250, -6, 150, 1); }, 200, 110, 3, 3);
      LIGHT.x = 0; LIGHT.y = -1; ENV.edge = C('hush', 6);
      const r = bust('kaira', { t, wind: 0.6, face: { eyes: blink(t, 22) ? 'closed' : 'open', brows: 'worried', look: -1 } }, 300, H - 22 + 6, 3, -1);
      ENV.edge = null;
      const p = 0.25 + Math.max(0, Math.sin(t * 5)) * 0.25;
      HB.seedMark(r.chest[0] - 6, r.chest[1] - 18, p * 0.7, t);
      for (let k = 0; k < 8; k++) { const u = frac(t * 0.7 + k / 8); put(fl(r.chest[0] + Math.sin(k * 2 + t) * 26), fl(r.chest[1] + 10 - u * 70), C('gold', 7)); put(fl(r.chest[0] + Math.sin(k * 2 + t) * 26) + 1, fl(r.chest[1] + 10 - u * 70), C('gold', 6)); }
    });

    // 30 — Oren drops in behind them (4:02): a gold flash, a ring of dust; "No… not here. Not the harbour."
    const OREN_LAND = 242.25;
    shot(242.0, 243.4, (lt, t) => {
      aftermath(t, 120, { rt: HUSH_T });
      const g = t - OREN_LAND, turn = t > 242.55;
      const land = eoc(lin(0, 0.3, g)), cr = g > 0 && g < 0.3 ? 1 - land : 0;
      if (g < 0) { const y = DY + 2 + g * 700; for (let j = 0; j < 50; j++) put(fl(sx(200)), fl(y - 40 - j * 2), j < 8 ? WHITE : C('gold', 6)); onDock(OREN, { hip: -WB.leg + 2, arms: [{ a: 2.6, b: 0.2 }, { a: -0.4 }], prop: (A) => spearArt(A.hand[0], A.hand[1], 0.1, 36, t) }, 200, y, 1, { noShadow: true }); }
      else { onDock(OREN, { hip: -WB.leg + 12 * cr, legs: [{ foot: [8, 0] }, { foot: [-8, 0] }], headY: t > 242.8 ? -2 : 0, arms: [{ a: 0.5 + cr, b: 0.5 }, { a: -0.4 - cr }], prop: (A) => spearArt(A.hand[0], A.hand[1], 0.15 + cr * 0.4, 36, t) }, 200, DY + 2, 1); dustRing(sx(200), DY + 2, g, 1.1, 641); HB.debris(sx(200), DY, g, 10, 642, { speed: 0.7 }); impactStar(sx(200), DY - 6, g, 1.2, C('gold', 6)); }
      heroes(t, { kf: turn ? -1 : 1, k: { hip: -KB.leg + (turn ? 4 : 0), arms: turn ? [{ a: 1.2, b: 0.2 }, { a: -0.5, b: 0.4 }] : [{ a: 0.5, b: 0.4 }, { a: -0.2 }], face: { eyes: 'wide', brows: turn ? 'angry' : 'worried' } }, t: { hip: -TB.leg + (turn ? 3 : 0), face: { eyes: 'wide', brows: turn ? 'angry' : 'up' } }, noAnchor: true });
      HB.anchorFloor(t, TXX + 40);
      HB.tintFlat(T_CHILL, chillOf(t));
      view(sx(250), 158, 2.0);
      shk(g > 0 && g < 0.3 ? 3 * (1 - g / 0.3) : 0);
    });
    // Oren, close: he looks up at the ring, the slit of his visor lit as he speaks
    shot(243.4, 246.0, (lt, t) => {
      closeBg(() => { harbour(t, { cx: 60, rt: HUSH_T }); HB.tintFlat(T_CHILL, chillOf(t) + 0.06); ringSky(t, 250, -6, 150, 1); }, 150, 100, 3, 3);
      LIGHT.x = 0; LIGHT.y = -1; ENV.edge = C('hush', 6);
      bust('oren', { t, face: { mouth: mouth('oren', t) }, headY: -2 }, 220, H - 22 + 6, 3, 1);
      ENV.edge = null;
    });
  }
  /* ================================================================ 30–31: the Hollow fall; a warden erased; the Bellwether (4:06–4:36) */
  {
    const { onDock, stand, arc, dustRing, impactStar, splash, shadowE, harbour, harbourAfter, sx, heldAnchor, bolt, hollowFig, bellwether, heroes, aftermath, ringSky, chillOf, silFx } = HB;
    const K = HB.consts, DY = K.DY, DF = K.DF, BRLX = K.BRLX, BELLX = K.BELLX, HUSH_T = K.HUSH_T;
    const TB = TAMO.body, KB = KAIRA.body, WB = WARDEN.body;
    const T_CHILL = tab('#dfe3f2');
    const HL = [247.0, 247.4, 247.7, 248.1, 248.5, 248.8, 249.2, 249.6], HLX = [392, 150, 440, 226, 488, 112, 520, 356], HLY = [DY - 4, DY + 2, DY - 6, DY + 4, DY - 2, DY - 5, DY + 3, DY - 1];
    const ERASE = 252.5, BELL_LAND = 260.0;
    // the white spreading over the far water from under the ring: the boats, the far shore, the sea go to sketch
    const farHushR = (t) => Math.max(0, (t - 245.5) * 46);
    function drained(t, cx, o) {
      o = o || {};
      const wl = aftermath(t, cx, Object.assign({ rt: HUSH_T, props: { noBarrels: true }, sky: (tt) => ringSky(tt, 300 - cx / 30, 4, 200, 1) }, o));
      const R0 = farHushR(t), ox = 300 - cx / 30, oy = 100;
      if (R0 > 0) hush((x, y) => { if (y > DF + 1 || y < 58) return 0; const d = Math.abs(x - ox) + (vn(y * 0.35, t * 2, 1, 807) - 0.5) * 30 + Math.max(0, 80 - y) * 1.5; return d < R0 - 8 ? 1 : d < R0 ? 0.6 : 0; }, t, true);
      // round the Bellwether's feet the planks go pale too
      if (o.footR) { const fx = sx(BELLX); hush((x, y) => { const d = Math.hypot(x - fx, (y - DY) * 3.2); return d < o.footR - 6 ? 1 : d < o.footR ? 0.5 : 0; }, t, true); }
      HB.tintFlat(T_CHILL, chillOf(t));
      return wl;
    }
    HB.drained = drained;
    // a Hollow coming down like a falling star, landing in a burst of black glyph-dust, rising
    function hollowFall(t, k, o) {
      const g = t - HL[k], x = sx(HLX[k]), y = HLY[k];
      if (g < -0.7) return null;
      if (g < 0) {
        // a falling star the wrong way round: a white-hot head, a long black tail torn at the edges
        const u = 1 + g / 0.7, e = u * u, yy = lerp(-40, y - 30, e), xx = x + (1 - e) * 110, dx = 110 / 0.7 * 2 * u, dy = (y + 10) / 0.7 * 2 * u, L = Math.hypot(dx, dy) || 1, nx = dx / L, ny = dy / L;
        for (let j = 0; j < 46; j++) { const px = xx + nx * j * 1.5, py = yy - ny * j * 1.5, w = Math.max(0.8, 5 - j * 0.09); for (let q = -w; q <= w; q += 0.5) { const qx = fl(px - ny * q), qy = fl(py + nx * q); if (j > 30 && ih(qx, qy, fl(t * 20)) < (j - 30) / 16) continue; put(qx, qy, j < 4 ? WHITE : Math.abs(q) > w - 0.6 ? C('hush', 5) : C('ink', 0)); } }
        fillEll(xx, yy, 5, 5, 0, WHITE); glow(xx, yy, 20, tab('#e8ecff', true), 0.6);
        for (let k = 0; k < 6; k++) put(fl(xx - ny * (ih(k, 1, 667) - 0.5) * 14 + nx * ih(k, 2, 667) * 30), fl(yy + nx * (ih(k, 1, 667) - 0.5) * 14 - ny * ih(k, 2, 667) * 30), k & 1 ? WHITE : C('crimson', 5));
        return null; }
      if (g < 0.5) { for (let q = 0; q < 24; q++) { const a = -PI * ih(q, 1, 661 + k), v = 30 + ih(q, 2, 661 + k) * 70, [px, py] = arc(x, y - 4, Math.cos(a) * v, Math.sin(a) * v * 0.7, 200, g); put(fl(px), fl(py), q % 4 === 0 ? WHITE : C('ink', 0)); put(fl(px) + 1, fl(py), C('ink', 1)); } dustRing(x, y, g, 0.6, 671 + k, R.ink); }
      const rise = eoc(lin(0.1, 0.6, g));
      return hollowFig(x, y, 1, (o && o.f) || (HLX[k] > 300 ? -1 : 1), t, Object.assign({ crouch: 1 - rise, seed: k + 3, glitch: g < 0.3 ? 0.8 : 0.15 }, o || {}));
    }
    HB.hollowFall = hollowFall;
    HB.HL = HL; HB.HLX = HLX; HB.HLY = HLY;
    function hollows(t, o) { for (let k = 0; k < 8; k++) hollowFall(t, k, o && o[k]); }
    HB.hollows = hollows;

    // 30a — the Hollow fall like stars (4:06): high and wide; the white sweeping in over the far boats; black streaks onto the dock
    shot(246.0, 250.0, (lt, t) => {
      drained(t, 60);
      onDock(OREN, { legs: [{ foot: [8, 0] }, { foot: [-8, 0] }], arms: [{ a: 1.3, b: 0.1 }, { a: -0.3 }], prop: (A) => spearArt(A.hand[0], A.hand[1], 1.2, 36, t) }, 200, DY + 2, 1);
      heroes(t, { kx: 296, kf: 1, tx: 286, tf: -1, k: { hip: -KB.leg + 3, arms: [{ a: 1.2, b: 0.2 }, { a: -0.5, b: 0.4 }], face: { eyes: 'wide', brows: 'angry' } }, t: { hip: -TB.leg + 3, arms: [{ hand: [10, -40] }, { hand: [7, -38] }], face: { eyes: 'wide', brows: 'angry' }, prop: heldAnchor(1.9, 0.6, 1.0, 0, 3) } });
      hollows(t);
      view(lerp(240, 236, lt / 4), lerp(132, 150, eio(lt / 4)), lerp(1.12, 1.45, eio(lt / 4)));
      shk(HL.some((h) => t > h && t < h + 0.12) ? 1.5 : 0);
    });

    // 30b — fighting shadows (4:10): Oren's spear goes through one and it only tears; they stand back to back
    shot(250.0, 252.2, (lt, t) => {
      drained(t, 100);
      const thrust = lin(250.4, 250.6, t), thrust2 = lin(251.4, 251.55, t);
      const sp_ = thrust > 0 && thrust < 1 ? eoc(thrust) * 14 : thrust2 > 0 && thrust2 < 1 ? eoc(thrust2) * 14 : t > 250.6 && t < 250.9 ? 14 * (1 - lin(250.6, 250.9, t)) : 0;
      onDock(OREN, { lean: sp_ * 0.2, legs: [{ foot: [10, 0] }, { foot: [-9, 0] }], arms: [{ a: 1.5, b: 0.0 }, { a: -0.4 }], face: {}, prop: (A) => spearArt(A.hand[0] + sp_, A.hand[1], 1.5, 36, t) }, 196, DY + 2, 1);
      const torn = (t > 250.55 && t < 251.2) || (t > 251.5 && t < 252.0);
      for (let k = 0; k < 8; k++) {
        if (k === 3) { hollowFig(sx(244), HLY[3], 1, -1, t, { seed: 6, glitch: torn ? 1 : 0.2, reach: lin(251.0, 251.4, t), dx: 0 }); if (torn) for (let q = 0; q < 14; q++) { const a = ih(q, fl(t * 20), 5) * TAU; put(fl(sx(244) + Math.cos(a) * 12), fl(DY - 30 + Math.sin(a) * 18), q & 1 ? WHITE : C('crimson', 5)); } continue; }
        if (k === 4) continue;
        hollowFall(t, k, { reach: k === 0 ? sstep(250.6, 251.4, t) * 0.7 : 0 });
      }
      heroes(t, { kx: 300, kf: 1, tx: 284, tf: -1, k: { hip: -KB.leg + 3, arms: [{ a: 1.25, b: 0.2 }, { a: -0.5, b: 0.4 }], face: { eyes: 'narrow', brows: 'angry' }, wind: 1 }, t: { hip: -TB.leg + 3, arms: [{ hand: [10, -40] }, { hand: [7, -38] }], face: { eyes: 'narrow', brows: 'angry' }, prop: heldAnchor(1.9, 0.7, 1.0, 0, 3) } });
      if (thrust > 0.9 && thrust < 1 || (thrust2 > 0.9 && thrust2 < 1)) HB.impactStar(sx(244), DY - 30, 0.05, 0.8, C('hush', 6));
      view(sx(262), 158, 2.0 + lt * 0.05);
    });
    // 30c — a warden is erased (4:12): staggering out of the barrels, a Hollow's hand on his shoulder; he goes white and comes apart
    shot(252.2, 254.0, (lt, t) => {
      drained(t, 300);
      const g = t - ERASE, wx = 452;
      if (g < 1.1) {
        const P = { legs: [{ foot: [6, 0] }, { foot: [-7, 0] }], lean: g > 0 ? 0 : -2, arms: [{ a: 0.6, b: 0.5 }, { a: -0.3 }], headY: g > 0 ? -1 : 0, prop: g < 0.3 ? (A) => spearArt(A.hand[0], A.hand[1], 0.3, 34, t) : undefined };
        if (g <= 0) onDock(WARDEN, P, wx, DY, -1);
        else { HB.dawnLit(sx(wx)); HB.lyBegin(); HB.toFrame(); actor(WARDEN, Object.assign({ t }, P), sx(wx), DY, 1, -1, { fx: (c, x, y) => (ih(x, y, fl(t * 20)) < g * 1.05 - (DY - y) / 200 ? -1 : LUM[c] > 80 ? WHITE : C('hush', 3)) }); }
      }
      if (g > 0) HB.glyphDustUp(sx(wx), DY - 34, g, 160, 22, 681);
      if (g > 0.25) { const [px, py, landed] = arc(sx(wx) - 6, DY - 34, -20, -40, 420, g - 0.25, DY + 2); line(px - 14, py + (landed ? 0 : -6), px + 14, py, landed ? C('hush', 4) : C('wood', 3)); }
      hollowFig(sx(wx + 24), DY - 2, 1, -1, t, { seed: 11, reach: g < 0 ? sstep(252.2, 252.45, t) : 1 - lin(0.2, 0.8, g), glitch: 0.25 });
      hush((x, y) => (g > 0 ? Math.max(0, 1 - Math.hypot(x - sx(wx), (y - DY) * 3) / (10 + g * 30)) * Math.min(1, g * 2) : 0), t, true);
      view(sx(wx) + 6, 158, 2.6);
      if (g > 0 && g < 0.08) flash(0.5);
    });
    // glyph-dust rising off something that is coming apart (bigger, slower than the cold open's)
    HB.glyphDustUp = (x, y, g, n, spread, seed) => { for (let k = 0; k < n; k++) { const v = 14 + ih(k, 2, seed) * 40, px = x + (ih(k, 3, seed) - 0.5) * spread + Math.sin(g * 3 + k) * 4 * g, py = y + (ih(k, 4, seed) - 0.5) * spread * 2.4 - v * g; if (ih(k, 5, seed) > 1.3 - g * 0.5) continue; if (ih(k, 6, seed) < 0.2) glyph(fl(px), fl(py), k, 1, WHITE); else rectF(fl(px), fl(py), 2, 2, ih(k, 7, seed) < 0.8 ? WHITE : C('crimson', 5)); } };

    // 31 — the Bellwether comes down out of the ring (4:14): huge and slow, riding a falling column of glyphs; it lands, and tolls
    function glyphColumn(x, top, bot, t, a) { for (let k = 0; k < 80; k++) { const u = frac(ih(k, 1, 691) + t * (0.5 + ih(k, 2, 691) * 0.6)), px = x + (ih(k, 3, 691) - 0.5) * 70 * (0.5 + u * 0.5), py = lerp(top, bot, u); if (ih(k, 4, 691) > a) continue; if (k % 5 === 0) glyph(fl(px), fl(py), k, 1, WHITE); else rectF(fl(px), fl(py), 1, 3, k % 7 === 0 ? C('crimson', 5) : C('hush', 6)); } for (let y = Math.max(0, fl(top)); y < Math.min(H, bot); y++) for (let dx = -30; dx <= 30; dx++) { const xx = fl(x + dx); if (xx < 0 || xx >= W) continue; tintI(y * W + xx, xx, y, tab('#e8ecff', true), 0.18 * a * (1 - Math.abs(dx) / 30)); } }
    HB.glyphColumn = glyphColumn;
    const bellY = (t) => DY + 2 - (1 - sstep(254.0, BELL_LAND + 0.4, t) - (t >= BELL_LAND ? 1 : 0) * 0) * 230 * (t < BELL_LAND ? 1 : 0) + (t < BELL_LAND ? 0 : 0);
    shot(254.0, 257.5, (lt, t) => {
      const sh = 70, cx = 200;
      drained(t, cx);
      HB.hollows(t);
      heroes(t, { kx: 300, kf: 1, tx: 284, tf: 1, k: { headY: -2, arms: [{ a: 1.25, b: 0.2 }, { a: -0.5, b: 0.4 }], face: { eyes: 'wide', brows: 'worried' } }, t: { headY: -2, arms: [{ hand: [10, -40] }, { hand: [7, -38] }], face: { eyes: 'wide', brows: 'worried' }, prop: heldAnchor(1.9, 0.4, 1.0, 0, 3) } });
      onDock(OREN, { headY: -2, legs: [{ foot: [8, 0] }, { foot: [-8, 0] }], arms: [{ a: 1.3, b: 0.1 }, { a: -0.3 }], prop: (A) => spearArt(A.hand[0], A.hand[1], 1.2, 36, t) }, 214, DY + 2, 1);
      // tip the camera up: the dock slides down the frame
      for (let y = H - 1; y >= sh; y--) BUF.copyWithin(y * W, (y - sh) * W, (y - sh) * W + W);
      for (let y = 0; y < sh; y++) for (let x = 0; x < W; x++) BUF[y * W + x] = soft(R.hush, 3.4 + y / sh * 1.2, x, y);
      ringSky(t, 330, sh - 40, 260, 1);
      const by = bellY(t) + sh, bx = sx(BELLX);
      glyphColumn(bx, 0, by, t, 1);
      LIGHT.x = 0; LIGHT.y = -1;
      bellwether(bx, by, 0.85, t, { arms: 0.35, billow: 1, speak: 0.3, edge: C('hush', 6) });
      rays(bx, sh - 40, 8, 300, tab('#e8ecff', true), 0.18, t, 9);
      view(260, 135, 1.0);
      shk(0.6);
    });
    shot(257.5, 260.0, (lt, t) => {
      // closer, riding down with it: the camera sinks with the bell; the lighthouse and the drained harbour rise into view behind
      const u = lt / 2.5, sh = fl(lerp(300, 58, eic(u) * 0.75 + u * 0.25));
      drained(t, 380);
      for (let y = H - 1; y >= sh; y--) BUF.copyWithin(y * W + 0, (y - sh) * W, (y - sh) * W + W);
      for (let y = 0; y < sh; y++) for (let x = 0; x < W; x++) BUF[y * W + x] = soft(R.dusk, 0.8 + y / Math.max(1, sh) * 0.9, x, y);
      HB.tintFlat(T_CHILL, 0.2);
      ringSky(t, 240, sh - 150, 260, 1);
      const bx = 250, by = 252 + fl(Math.sin(t * 2) * 1);
      glyphColumn(bx, 0, by, t, 1);
      LIGHT.x = 0.3; LIGHT.y = -1;
      bellwether(bx, by, 1.0, t, { arms: lerp(0.35, 0.2, u), billow: 1.4, speak: 0.4 + Math.sin(t * 6) * 0.2, edge: C('hush', 6) });
      rays(bx, 0, 8, 260, tab('#e8ecff', true), 0.15, t, 9);
      // pale streaks rushing upward past it (we are falling with it)
      for (let k = 0; k < 24; k++) { const x = ih(k, 1, 731) * W, y = H - frac(ih(k, 2, 731) + t * 1.8) * (H + 60); line(x, y, x, y + 14, C('hush', 6)); }
      shk(0.8);
    });
    shot(BELL_LAND, 262.0, (lt, t) => {
      const g = t - BELL_LAND, cx = 200, sh = 40;
      drained(t, cx, { footR: 20 + g * 30 });
      HB.hollows(t);
      // they're knocked staggering by the toll
      const stag = g < 0.6 ? Math.sin(g / 0.6 * PI) : 0;
      heroes(t, { kx: 300 - stag * 6, kf: 1, tx: 284 - stag * 8, tf: 1, k: { hip: -KB.leg + 5 * stag, lean: -3 * stag, arms: [{ a: 1.25 + stag, b: 0.2 }, { a: -0.5, b: 0.4 }], face: { eyes: stag > 0.3 ? 'closed' : 'wide', brows: 'worried' }, wind: 3 * stag }, t: { hip: -TB.leg + 5 * stag, arms: [{ hand: [10, -40] }, { hand: [7, -38] }], face: { eyes: stag > 0.3 ? 'closed' : 'wide', brows: 'worried' }, prop: heldAnchor(1.9, 0.4, 1.0, 0, 3) } });
      onDock(OREN, { hip: -WB.leg + 5 * stag, legs: [{ foot: [8, 0] }, { foot: [-8, 0] }], arms: [{ a: 1.3 + stag, b: 0.1 }, { a: -0.3 }], prop: (A) => spearArt(A.hand[0], A.hand[1], 1.2, 36, t) }, 214 - stag * 8, DY + 2, 1);
      const bx = sx(BELLX);
      dustRing(bx, DY + 2, g, 2.6, 701, R.hush); HB.debris(bx, DY, g, 30, 702, { speed: 1.4, big: true });
      HB.tipUp(sh, t);
      LIGHT.x = -0.4; LIGHT.y = -1;
      // a heavy settle: it comes down a touch below its stance and rises back
      const settle = g < 0.35 ? Math.sin(g / 0.35 * PI) * 4 : 0;
      bellwether(bx, DY + 2 + sh + settle, 0.92, t, { arms: 0.15 + settle * 0.03, speak: g < 0.6 ? 1 : 0.3, ring: Math.max(0, 1 - g), edge: C('hush', 6) });
      // the toll: rings of sound
      for (let q = 0; q < 4; q++) { const gg = g - q * 0.18; if (gg < 0 || gg > 1.2) continue; const rr = 10 + gg * 260; for (let a = 0; a < TAU; a += 0.6 / rr) { const xx = fl(bx + Math.cos(a) * rr), yy = fl(DY + sh - 165 + Math.sin(a) * rr * 0.55); if (bay(xx, yy) < 1 - gg / 1.2) put(xx, yy, WHITE); } }
      view(240, 135, 1.0);
      shk(g < 1 ? 5 * (1 - g) : 0);
      if (g < 0.067) flash(0.9);
    });
    // 32 — "The courier. And the anchor-bearer. Two of four." / "[chuckle] The King will be so pleased." (4:22)
    function bellClose(t, lt, chuckle) {
      closeBg(() => { drained(t, 330, { footR: 120 }); HB.hollows(t); }, 300, 120, 3, 3);
      const m = mouth('bellwether', t);
      LIGHT.x = -0.5; LIGHT.y = -0.8; ENV.edge = C('hush', 6);
      bust('bell', { t, speak: 0.3 + m * 0.9, ring: chuckle ? m * 0.8 : 0 }, 250 + (chuckle ? Math.round(Math.sin(t * 40) * m * 2) : 0), H - 22 + 72 - fl(lt * 2), 3, 1);
      ENV.edge = null;
      glow(250, 120, 120, tab('#ffc060', true), 0.12 + m * 0.25);
      // flakes of bronze and glyph falling from the crack as it speaks
      for (let k = 0; k < 16; k++) { const u = frac(t * 0.6 + ih(k, 1, 711)), x = 250 + (ih(k, 2, 711) - 0.5) * 60 + Math.sin(t + k) * 4, y = 60 + u * 190; if (ih(k, 3, 711) < 0.3 + m) put(fl(x), fl(y), k % 3 ? C('fire', 6) : WHITE); }
    }
    shot(262.0, 266.2, (lt, t) => bellClose(t, lt, false));
    shot(266.2, 267.0, (lt, t) => {
      drained(t, 150, { footR: 120 });
      const d = eoc(lin(0, 0.35, lt));
      heroes(t, { kx: 310, kf: 1, tx: 266, tf: 1, k: { hip: -KB.leg + 4, arms: [{ a: lerp(0.4, 1.35, d), b: 0.1 }, { a: lerp(-0.2, -0.7, d), b: 0.4 }], face: { eyes: 'narrow', brows: 'angry' }, wind: 2 }, t: { hip: -TB.leg + 3, arms: [{ hand: [12, lerp(-36, -58, d)] }, { hand: [9, lerp(-34, -56, d)] }], face: { eyes: 'narrow', brows: 'angry', smile: 0.3 }, prop: heldAnchor(lerp(1.9, 2.6, d), 1, 1.0, 0, 3), wind: 2 } });
      glow(sx(266) + 20, DY - 70, 40, tab('#40ffd0', true), 0.4 * d);
      view(sx(292), 152, 2.5);
    });
    shot(267.0, 270.2, (lt, t) => bellClose(t, lt + 4, true));
    // 32b — the standoff, wide (4:30): their stances; it spreads its arms; the Hollow edge in
    shot(270.2, 276.0, (lt, t) => {
      const cx = 160, sh = 40;
      drained(t, cx, { footR: 140 });
      for (let k = 0; k < 8; k++) { const creep = lt * 3 * (HLX[k] > 300 ? -1 : 1); HB.hollowFig(sx(HLX[k] + creep), HLY[k], 1, HLX[k] > 300 ? -1 : 1, t, { seed: k + 3, reach: 0.2 + Math.sin(t * 1.5 + k) * 0.2 }); }
      onDock(OREN, { legs: [{ foot: [9, 0] }, { foot: [-9, 0] }], arms: [{ a: 1.45, b: 0.0 }, { a: -0.3 }], prop: (A) => spearArt(A.hand[0], A.hand[1], 1.4, 36, t) }, 220, DY + 2, 1);
      heroes(t, { kx: 300, kf: 1, tx: 280, tf: 1, k: { hip: -KB.leg + 4, arms: [{ a: 1.35, b: 0.1 }, { a: -0.7, b: 0.4 }], face: { eyes: 'narrow', brows: 'angry' }, wind: 2 }, t: { hip: -TB.leg + 3, arms: [{ hand: [12, -58] }, { hand: [9, -56] }], face: { eyes: 'narrow', brows: 'angry' }, prop: heldAnchor(2.6, 1, 1.0, 0, 3), wind: 2 } });
      // wind off it: streaks of pale dust along the planks toward them
      for (let k = 0; k < 30; k++) { const u = frac(t * 0.9 + ih(k, 1, 721)), x = sx(BELLX) - u * 300, y = DY - 4 - ih(k, 2, 721) * 60; line(x, y, x + 6, y, C('hush', 5)); }
      HB.tipUp(sh, t);
      LIGHT.x = -0.4; LIGHT.y = -1;
      bellwether(sx(BELLX), DY + 2 + sh, 0.92, t, { arms: lerp(0.15, 0.5, eio(lin(271.5, 274.5, t))), speak: 0.3, edge: C('hush', 6) });
      view(lerp(250, 258, lt / 5.8), lerp(138, 146, lt / 5.8), lerp(1.04, 1.12, eio(lt / 5.8)));
    });
  }
  /* ================================================================ 33–34: the toll and the wall of water; the light in the fog (4:36–5:00) */
  {
    const { onDock, stand, arc, dustRing, impactStar, splash, shadowE, harbour, sx, heldAnchor, bolt, hollowFig, bellwether, heroes, drained, ringSky, chillOf, silFx, anchorArt, lyBegin, lyEnd, actorEx, vesperFig } = HB;
    const K = HB.consts, DY = K.DY, DF = K.DF, BELLX = K.BELLX, HUSH_T = K.HUSH_T;
    const TB = TAMO.body, KB = KAIRA.body, WB = WARDEN.body;
    const TOLL = 276.5, SLAM = 277.25, WALL = 277.5, MEET = 278.5, BREAK = 285.5, THROWN = 286.0, WX = 362;
    const T_CHILL = tab('#dfe3f2');
    // the camera tipped up: the harbour drops down the frame (by sh) so the sky above it opens out for something tall
    function tipUp(sh, t, ring) {
      for (let y = H - 1; y >= sh; y--) BUF.copyWithin(y * W, (y - sh) * W, (y - sh) * W + W);
      for (let y = 0; y < sh; y++) for (let x = 0; x < W; x++) BUF[y * W + x] = soft(R.dusk, 0.9 + y / Math.max(1, sh) * 0.7, x, y);
      if (ring !== false) ringSky(t, 300, sh - 60, 280, 1);
      HB.tintFlat(T_CHILL, 0.12);
    }
    HB.tipUp = tipUp;
    // the Storm Seed's light under Kaira's collar, at close-up pixel size (3 px blocks): a diamond, a white core, pulsing rays
    HB.seedMark = (x, y, p, t) => {
      glow(x, y, 70, tab('#ffd060', true), 0.35 + p * 0.4); glow(x, y, 22, tab('#fff4c0', true), 0.5 + p * 0.4);
      for (let j = -3; j <= 3; j++) for (let i = -3; i <= 3; i++) { const d = Math.abs(i) + Math.abs(j); if (d > 3) continue; rectF(fl(x + i * 3), fl(y + j * 3), 3, 3, d < 1 ? WHITE : d < 2 ? C('gold', 7) : C('gold', 5)); }
      for (let k = 0; k < 8; k++) { const a = k / 8 * TAU + t * 0.5, l = (k & 1 ? 4 : 7) + p * 5; for (let q = 4; q < l; q++) rectF(fl(x + Math.cos(a) * q * 3), fl(y + Math.sin(a) * q * 3), 3, 3, q < l - 2 ? C('gold', 6) : C('gold', 4)); }
    };
    // where the white has got to along the dock (stage x), coming from the Bellwether
    const frontX = (t) => (t < TOLL ? 9999 : t < MEET ? lerp(sx(BELLX) - 30, sx(WX) + 18, eic(lin(TOLL + 0.1, MEET, t)) * 0.4 + lin(TOLL + 0.1, MEET, t) * 0.6) : t < BREAK ? sx(WX) + 18 - lin(MEET, BREAK, t) * 6 : Math.max(sx(WX) - (t - BREAK) * 160, sx(318)));
    function whiteFront(t, dy) {
      const fx = frontX(t); if (fx > W + 20) return;
      hush((x, y) => { if (y < 40 + (dy || 0)) return 0; const n = vn(y * 0.3, t * 4, 1, 801) * 10; return x > fx + 10 + n ? 1 : x > fx + n ? 0.6 : 0; }, t, true);
      for (let y = 40 + (dy || 0); y < H; y++) for (let x = Math.max(0, fl(fx - 16)); x < Math.min(W, fx + 4); x++) tintI(y * W + x, x, y, tab('#ffffff', true), (1 - Math.abs(x - fx + 4) / 16) * 0.7);
      // its edge: a churning seam of glyphs and static
      for (let k = 0; k < 70; k++) { const y = 60 + (dy || 0) + ih(k, 1, fl(t * 14)) * 190, x = fx + (ih(k, 2, fl(t * 14)) - 0.3) * 12; if (k % 6 === 0) glyph(fl(x), fl(y), k, 1, ih(k, 3, 9) < 0.7 ? WHITE : C('crimson', 5)); else put(fl(x), fl(y), k & 1 ? WHITE : C('hush', 4)); }
    }
    // the wall of water: a churning sheet thrown up out of the sea across the dock, a ragged crest leaning over, spray
    function waterWall(t, dy, strain) {
      const up = eob(lin(WALL, WALL + 0.6, t)), brk = t >= BREAK; if (up <= 0 || brk) return;
      const x0 = sx(WX), hTop = 175 * up, bot = 262 + dy, base = DY + dy;
      for (let y = Math.max(0, fl(base - hTop - 10)); y < Math.min(H, bot); y++) {
        const v = (base - y) / Math.max(1, hTop), lean = Math.pow(Math.max(0, v - 0.45), 2) * 90, half = 24 + v * 10 + Math.max(0, v - 0.75) * 40 + (y > base ? (y - base) * 1.2 : 0) - strain * 7 * Math.sin(v * PI);
        const cx = x0 + lean + Math.sin(y * 0.08 + t * 6) * 2;
        for (let x = fl(cx - half - 3); x <= cx + half + 3; x++) {
          if (x < 0 || x >= W) continue;
          const u = (x - cx) / half, edge = Math.abs(u) > 1 - 3 / half;
          if (Math.abs(u) > 1 + (vn(y * 0.5, t * 9 + x, 1, 803) - 0.5) * 0.3) continue;
          if (v > 1 - 0.04) { BUF[y * W + x] = ih(x, y, fl(t * 16)) < 0.6 ? WHITE : C('sky', 6); continue; }
          const flow = vn(x * 0.4, y * 0.25 + t * 40, 1, 804);
          BUF[y * W + x] = edge ? (ih(x, y, fl(t * 20)) < 0.5 ? WHITE : C('teal', 6)) : cel(R.teal, 3.2 + u * -0.8 + (flow > 0.65 ? 1.6 : flow < 0.25 ? -0.8 : 0) + (v > 0.85 ? 1 : 0), x, y);
        }
      }
      // spray thrown off the crest
      for (let k = 0; k < 60; k++) { const ph = frac(t * 1.3 + ih(k, 1, 805)), a = -PI / 2 + (ih(k, 2, 805) - 0.3) * 1.6, v = 60 + ih(k, 3, 805) * 80, [px, py] = arc(x0 + 20, base - hTop + 4, Math.cos(a) * v, Math.sin(a) * v, 260, ph * 0.8); if (py < base) put(fl(px), fl(py), k % 3 ? WHITE : C('sky', 6)); }
      glow(x0, base - hTop * 0.5, 70, tab('#40ffd0', true), 0.25);
      // where the white meets it: static, glyphs flaking off, steam
      if (t > MEET) for (let k = 0; k < 40; k++) { const y = base - ih(k, fl(t * 18), 811) * hTop, x = x0 + 14 + ih(k, 2, fl(t * 18)) * 8; if (k % 5 === 0) glyph(fl(x), fl(y), k, 1, WHITE); else put(fl(x), fl(y), k & 1 ? C('crimson', 5) : WHITE); }
      if (t > MEET) for (let k = 0; k < 10; k++) { const u = frac(t * 0.8 + k / 10), x = x0 + 18 + u * 20, y = base - ih(k, 1, 812) * hTop - u * 30, r = 3 + u * 8; fillEll(x, y, r, r * 0.8, 0, (xx, yy) => (bay(xx, yy) < 0.5 * (1 - u) ? C('hush', 7) : -1)); }
    }
    // Tamo planting the anchor and holding it; Kaira at his back
    function holders(t, dy, o) {
      o = o || {}; const strain = lin(MEET, BREAK, t), sh = Math.round((ih(fl(t * 30), 3, 9) - 0.5) * 2 * strain), slam = lin(SLAM - 0.3, SLAM, t);
      let tP;
      if (t < SLAM - 0.3) tP = { hip: -TB.leg, legs: [{ foot: [8, 0] }, { foot: [-8, 0] }], arms: [{ hand: [12, -58] }, { hand: [9, -56] }], face: { eyes: 'narrow', brows: 'angry' }, prop: heldAnchor(2.6, 1, 1.0, 0, 3), wind: 2 };
      else if (t < SLAM) tP = { hip: -TB.leg + 2, legs: [{ foot: [9, 0] }, { foot: [-9, 0] }], arms: [{ hand: [lerp(6, 18, eic(slam)), lerp(-74, -40, eic(slam))] }, { hand: [lerp(3, 15, eic(slam)), lerp(-72, -38, eic(slam))] }], face: { eyes: 'closed', brows: 'angry', mouth: 0.9 }, prop: heldAnchor(lerp(PI, 0.15, eic(slam)), 1, 1.0, 0, 3), wind: 3 };
      else tP = { hip: -TB.leg + 9 + sh * 0, lean: 4, legs: [{ foot: [12, 0] }, { foot: [-11, 0] }], arms: [{ hand: [21, -30] }, { hand: [20, -24] }], face: { eyes: strain > 0.3 ? 'closed' : 'narrow', brows: 'angry', mouth: mouth('tamo', t) || 0.6 }, wind: 3 };
      const rT = onDock(TAMO, tP, 300 + sh * 0.5, DY + 1 + dy, 1);
      if (t >= SLAM) { lyBegin(); anchorArt(sx(324), DY - 46 + dy, 0.05, 1.0, 1, t); lyEnd({ edge: C('mint', 7) }); glow(sx(324), DY - 20 + dy, 40, tab('#40ffd0', true), 0.4); }
      const kP = { hip: -KB.leg + 6, lean: 5, legs: [{ foot: [10, 0] }, { foot: [-12, 0] }], arms: [{ hand: [14, -36] }, { hand: [12, -30] }], face: { eyes: t > 283.6 ? 'wide' : 'narrow', brows: 'worried', mouth: mouth('kaira', t) }, wind: 3 };
      const rK = onDock(KAIRA, kP, 276, DY + 3 + dy, 1);
      return { rT, rK };
    }
    // 33a — the toll (4:36): it rings; a white wave rolls down the dock; he slams the anchor down; the sea stands up into a wall
    shot(276.0, 278.5, (lt, t) => {
      const sh = 40;
      drained(t, 200, { footR: 150 });
      for (let k = 0; k < 8; k++) if (HB.HLX[k] > 340) hollowFig(sx(HB.HLX[k] + 40), HB.HLY[k], 1, -1, t, { seed: k + 3 });
      onDock(OREN, { legs: [{ foot: [9, 0] }, { foot: [-9, 0] }], arms: [{ a: 2.4, b: 0.6 }, { a: 2.0, b: 0.6 }], lean: -2, face: {} }, 232, DY + 2, 1);
      holders(t, 0);
      if (t > SLAM) { dustRing(sx(324), DY + 2, t - SLAM, 1.4, 821, R.mint); impactStar(sx(324), DY - 4, t - SLAM, 1.4, C('mint', 7)); HB.debris(sx(324), DY, t - SLAM, 16, 822, { speed: 1.2 }); }
      whiteFront(t, 0);
      tipUp(sh, t);
      const g = t - TOLL, bx = sx(BELLX);
      LIGHT.x = -0.4; LIGHT.y = -1;
      bellwether(bx, DY + 2 + sh, 0.92, t, { arms: g > 0 ? lerp(0.5, 0.8, eoc(lin(0, 0.4, g))) : 0.5, speak: g > 0 && g < 1 ? 1 : 0.4, ring: g > 0 ? Math.max(0, 1 - g * 0.7) : 0, edge: C('hush', 6) });
      if (g > 0) for (let q = 0; q < 4; q++) { const gg = g - q * 0.16; if (gg < 0 || gg > 1.4) continue; const rr = 10 + gg * 240; for (let a = 0; a < TAU; a += 0.6 / rr) { const xx = fl(bx + Math.cos(a) * rr), yy = fl(DY + sh - 170 + Math.sin(a) * rr * 0.6); if (bay(xx, yy) < 1 - gg / 1.4) put(xx, yy, WHITE); } }
      waterWall(t, sh, 0);
      // the sea climbing the piles on both sides to make the wall
      if (t > WALL - 0.15 && t < WALL + 0.6) for (let k = 0; k < 60; k++) { const u = lin(WALL - 0.15, WALL + 0.6, t), x = sx(WX) + (ih(k, 1, 823) - 0.5) * 60, y = lerp(262, DY + sh - 90, u) + ih(k, 2, 823) * 50; put(fl(x), fl(y), k & 1 ? WHITE : C('teal', 6)); put(fl(x), fl(y) + 1, C('teal', 4)); }
      view(240, 135, 1.0);
      shk(g > 0 && g < 0.6 ? 3 : t > SLAM && t < SLAM + 0.25 ? 4 : t > MEET - 0.05 ? 3 : 0.5);
      if (t >= MEET - 0.034) flash(0.7);
    });
    // 33b — the wall holds (4:38): close on it, roaring; the white eating its far face; he's down on one knee holding the iron
    shot(278.5, 280.4, (lt, t) => {
      drained(t, 180, { footR: 150 });
      whiteFront(t, 0);
      holders(t, 0);
      waterWall(t, 0, lin(MEET, BREAK, t));
      view(sx(318), 140, 2.1);
      shk(1.6);
      if (t < MEET + 0.06) flash(0.6);
    });
    // 33c — Tamo, close (4:40): "Kaira! Whatever you've got, now would be a really good time!"
    shot(280.4, 283.6, (lt, t) => {
      closeBg(() => { drained(t, 180, { footR: 150 }); whiteFront(t, 0); waterWall(t, 0, 0.5); }, sx(WX) - 20, 140, 3, 3);
      LIGHT.x = 0.4; LIGHT.y = 0.6; ENV.edge = C('mint', 7);
      const sh = Math.round((ih(fl(t * 30), 1, 7) - 0.5) * 2);
      bust('tamo', { t, glow: 1, sweat: 1, face: { eyes: talking('tamo', t) ? 'narrow' : 'closed', brows: 'angry', mouth: mouth('tamo', t) || 0.3 }, headX: sh }, 180, H - 22 + 6, 3, 1);
      ENV.edge = null;
      glow(200, 280, 170, tab('#40ffd0', true), 0.35);
      for (let k = 0; k < 50; k++) { const sp_ = 260 + ih(k, 1, 831) * 120, x = W - ((t * sp_ + ih(k, 2, 831) * 600) % (W + 40)), y = ih(k, 3, 831) * H; line(x, y, x + 10, y - 2, k % 3 ? WHITE : C('sky', 6)); }
      shk(1);
    });
    // 33d — Kaira, close (4:43): "I don't know how to use it!" — the light under her collar flaring, useless
    shot(283.6, 285.4, (lt, t) => {
      closeBg(() => { drained(t, 180, { footR: 150 }); whiteFront(t, 0); waterWall(t, 0, 0.8); }, sx(WX) - 60, 140, 3, 3);
      LIGHT.x = 0.4; LIGHT.y = 0.4; ENV.edge = C('gold', 6);
      const r = bust('kaira', { t, wind: 2.5, face: { eyes: 'wide', brows: 'worried', mouth: mouth('kaira', t) } }, 280, H - 22 + 6, 3, 1);
      ENV.edge = null;
      const p = 0.45 + Math.max(0, Math.sin(t * 9)) * 0.35;
      HB.seedMark(r.chest[0] - 6, r.chest[1] - 18, p, t);
      for (let k = 0; k < 4; k++) if (ih(k, fl(t * 16), 3) < 0.5) bolt(r.chest[0] - 6, r.chest[1] - 18, r.chest[0] + (ih(k, fl(t * 16), 4) - 0.5) * 140, r.chest[1] - 18 - ih(k, fl(t * 16), 5) * 70, fl(t * 30) + k, 1, WHITE, C('gold', 5));
      for (let k = 0; k < 50; k++) { const sp_ = 260 + ih(k, 1, 832) * 120, x = W - ((t * sp_ + ih(k, 2, 832) * 600) % (W + 40)), y = ih(k, 3, 832) * H; line(x, y, x + 10, y - 2, k % 3 ? WHITE : C('sky', 6)); }
      shk(1.2);
    });
    // 33e — the wall breaks (4:45): it bursts toward them; they're thrown back down the dock and land hard; the anchor clatters down
    shot(285.4, 288.0, (lt, t) => {
      const g = t - BREAK, th = t - THROWN, sh = 30;
      drained(t, 120, { footR: 150 });
      whiteFront(t, 0);
      // the two of them: braced, then flung, tumbling, down
      if (t < THROWN) holders(t, 0);
      else {
        const fly = (k, x0, x1, tl, seed) => { const u = clamp(th / tl, 0, 1), x = lerp(x0, x1, eoc(u)), y = DY - Math.sin(u * PI) * 40 * (1 - u * 0.3); return [x, y, u]; };
        const [tx, ty, tu] = fly(0, sx(300), sx(212), 0.6), [kx, ky, ku] = fly(1, sx(276), sx(130), 0.75);
        if (tu < 1) actorEx(TAMO, { t, face: { eyes: 'closed', brows: 'worried', mouth: 0.6 }, arms: [{ a: 2.6, b: 0.3 }, { a: -2.4, b: 0.3 }], legs: [{ foot: [8, -4] }, { foot: [-6, 0] }] }, tx, ty - 30, 1, { rot: -tu * 4.2, px: 0, py: -30 });
        else HB.onDock(TAMO, { face: { eyes: 'closed', brows: 'worried', mouth: 0.2 }, arms: [{ a: 2.9, b: 0.3 }, { a: 2.4, b: 0.4 }], legs: [{ foot: [7, 0] }, { foot: [-5, 0] }] }, 236, DY - 3, 1, { rot: -PI / 2, px: 0, py: -TB.leg, noShadow: true });
        if (ku < 1) actorEx(KAIRA, { t, face: { eyes: 'closed', brows: 'worried', mouth: 0.6 }, arms: [{ a: 2.6, b: 0.3 }, { a: -2.4, b: 0.3 }], legs: [{ foot: [8, -4] }, { foot: [-6, 0] }], wind: 4 }, kx, ky - 30, 1, { rot: -ku * 3.6, px: 0, py: -30 });
        else HB.onDock(KAIRA, { face: { eyes: 'closed', brows: 'worried' }, arms: [{ a: 2.9, b: 0.3 }, { a: 2.4, b: 0.4 }], legs: [{ foot: [7, 0] }, { foot: [-5, 0] }] }, 150, DY + 2, 1, { rot: -PI / 2, px: 0, py: -KB.leg, noShadow: true });
        dustRing(sx(226), DY - 2, th - 0.6, 0.9, 841); dustRing(sx(140), DY + 2, th - 0.75, 0.9, 842);
        // the anchor, spinning down and clattering
        const [ax, ay, landed, ag] = arc(sx(330), DY - 60, -24, -160, 600, th, DY - 2);
        lyBegin(); anchorArt(ax, ay - (landed ? Math.abs(Math.sin(ag * 18)) * 6 * Math.max(0, 1 - ag * 2) : 0), landed ? PI / 2 + 0.05 : th * 9, 0.95, Math.max(0, 0.6 - th), t); lyEnd({ edge: C('hush', 6) });
        if (landed && ag < 0.4) HB.debris(ax, ay, ag, 8, 843, { ramp: () => WHITE, speed: 0.5 });
      }
      // the burst: water and white blown toward them
      if (g >= 0 && g < 1.6) {
        for (let k = 0; k < 220; k++) { const a = PI + (ih(k, 1, 844) - 0.5) * 1.3, v = 120 + ih(k, 2, 844) * 260, [px, py] = arc(sx(WX), DY - 20 - ih(k, 3, 844) * 120, Math.cos(a) * v, Math.sin(a) * v, 300, g); if (py < H) put(fl(px), fl(py), k % 4 === 0 ? C('teal', 6) : k % 4 === 1 ? C('sky', 6) : WHITE); }
        fillEll(sx(WX), DY - 60, 30 + g * 120, 60 + g * 40, 0, (xx, yy) => (bay(xx, yy) < 0.6 * (1 - g / 1.6) ? WHITE : -1));
      }
      if (t < BREAK) waterWall(t, 0, 1);
      view(lerp(sx(300), sx(214), eio(lin(THROWN, THROWN + 0.8, t))), 156, lerp(1.7, 1.9, lin(THROWN, 288, t)));
      shk(g > 0 && g < 0.5 ? 5 : th > 0.55 && th < 0.9 ? 2.5 : 1);
      if (g >= 0 && g < 0.067) flash(0.9);
    });
    // 33f — the last toll, coming (4:48): from the planks behind the fallen two, it looms; its arms rise; light gathers in the bell
    const bellStep = (t) => lerp(BELLX, BELLX - 70, eio(lin(288.0, 291.5, t)));
    HB.bellStep = bellStep;
    function fallen(t, o) {
      HB.onDock(TAMO, { face: { eyes: t > 289.5 ? 'half' : 'closed', brows: 'worried', mouth: 0.1 }, arms: [{ a: 2.9, b: 0.3 }, { a: 2.4, b: 0.4 }], legs: [{ foot: [7, 0] }, { foot: [-5, 0] }], headY: 0 }, 236, DY - 3, 1, { rot: -PI / 2 + (t > 290 ? 0.25 : 0), px: 0, py: -TB.leg, noShadow: true });
      HB.onDock(KAIRA, { face: { eyes: t > 290.5 ? 'half' : 'closed', brows: 'worried' }, arms: [{ a: 2.9, b: 0.3 }, { a: 2.4 + (t > 291 ? Math.sin(t * 2) * 0.2 : 0), b: 0.4 }], legs: [{ foot: [7, 0] }, { foot: [-5, 0] }] }, 150, DY + 2, 1, { rot: -PI / 2, px: 0, py: -KB.leg, noShadow: true });
      lyBegin(); anchorArt(sx(326) - 24, DY - 2, PI / 2 + 0.05, 0.95, 0, t); lyEnd({ edge: C('hush', 6) });
    }
    HB.fallen = fallen;
    shot(288.0, 292.0, (lt, t) => {
      const sh = 30, cx = 130;
      drained(t, cx, { footR: 400 });
      for (let k = 0; k < 8; k++) if (HB.HLX[k] > 300) hollowFig(sx(HB.HLX[k] - 30 - lt * 6), HB.HLY[k], 1, -1, t, { seed: k + 3, reach: 0.3 });
      fallen(t);
      tipUp(sh, t);
      const arms = eio(lin(288.0, 290.6, t)), bx = sx(bellStep(t));
      LIGHT.x = -0.3; LIGHT.y = -1;
      const r = bellwether(bx, DY + 2 + sh, 0.92, t, { arms: lerp(0.5, 1, arms), speak: 0.4 + arms * 0.6, edge: C('hush', 6) });
      // light gathering into the bell: motes drawn in toward it
      for (let k = 0; k < 40; k++) { const u = frac(t * 0.8 + ih(k, 1, 851)), a = ih(k, 2, 851) * TAU, rr = (1 - u) * 120; put(fl(r.slit[0] + Math.cos(a) * rr), fl(r.slit[1] + Math.sin(a) * rr * 0.7), u > 0.7 ? WHITE : C('fire', 6)); }
      glow(r.slit[0], r.slit[1], 30 + arms * 50, tab('#ffd080', true), 0.3 + arms * 0.4);
      shk(arms * 1.2);
    });

    // 34 — the light in the fog (4:52): the Bellwether turns; something walks out of the white — a knight with a lantern,
    // one heavy step at a time — "Step away from them." Close on the helm: the eyes flare. Black.
    const VSTEPS = [292.2, 293.4, 294.6, 295.8], STING = 297.2, BLACK = 298.5;
    function vesperScene(t, cx, sh, o) {
      drained(t, cx, { footR: 400 });
      fallen(t);
      for (let k = 0; k < 8; k++) if (HB.HLX[k] > 300) hollowFig(sx(HB.HLX[k] - 54 + (t > 295 ? (t - 295) * 8 : 0)), HB.HLY[k], 1, -1, t, { seed: k + 3, reach: 0.2, glitch: t > 296 ? 0.5 : 0.2 });
      const n = VSTEPS.filter((s_) => t >= s_).length, last = n ? t - VSTEPS[n - 1] : 9, st = clamp((t - 291.6) / 1.2, 0, 4.4);
      const vx = lerp(40, 128, st / 4.4), vs = lerp(1.15, 1.5, st / 4.4), ph = st * PI;
      // the fog bank on the left: white, rolling, and the knight walking out of it
      const fogEdge = sx(vx) + 30 + Math.sin(t * 0.8) * 6;
      for (let y = 0; y < H; y++) for (let x = 0; x < Math.min(W, fogEdge + 60); x++) { const nn = fbm(x * 0.6 + t * 8, y * 1.2, 30, 2, 861), a = clamp((fogEdge - x) / 70 + (nn - 0.5) * 0.8, 0, 1); if (a > 0) tintI(y * W + x, x, y, tab('#ece8f6', true), a * 0.95); }
      LIGHT.x = 0.6; LIGHT.y = -0.6;
      const r = vesperFig(sx(vx), DY + 4, vs, t, { f: 1, ph, sil: clamp(1 - st / 3.4, 0.45, 1), eyes: t > 296.0 ? 0.7 : 0.35, edge: C('lav', 6) });
      // the fog curling round his legs, in front of him
      for (let y = DY - 26; y < DY + 10; y++) for (let x = fl(sx(vx) - 30); x < sx(vx) + 40; x++) { if (x < 0 || x >= W) continue; const nn = fbm(x * 0.8 + t * 14, y * 1.6, 14, 2, 862), a = clamp((y - (DY - 26)) / 30 * 0.8 + (nn - 0.55) * 1.2, 0, 0.85) * clamp(1 - st / 5, 0.3, 1); if (a > 0.05) tintI(y * W + x, x, y, tab('#ece8f6', true), a); }
      if (last < 0.5) { dustRing(sx(vx) + 6, DY + 4, last, 0.8, 871 + n, R.hush); for (let k = 0; k < 10; k++) { const [px, py] = arc(sx(vx) + 6, DY + 2, (ih(k, 1, 875 + n) - 0.5) * 80, -40 - ih(k, 2, 875 + n) * 40, 300, last); put(fl(px), fl(py), C('hush', 7)); } }
      tipUp(sh, t);
      const turn = sstep(292.6, 294.4, t), bx = sx(bellStep(t));
      LIGHT.x = -0.5 + turn * 0.2; LIGHT.y = -1;
      if (!o || !o.noBell) bellwether(bx, DY + 2 + sh, 0.92, t, { arms: 1 - turn * 0.35, speak: 0.6 - turn * 0.3, edge: C('hush', 6) });
      glow(r.lamp[0], r.lamp[1] + sh, 30, tab('#c8a0ff', true), 0.3);
      return { last, vx, r };
    }
    // the Bellwether stops; turns its bell; far off in the white, a lantern
    shot(292.0, 294.0, (lt, t) => {
      const v = vesperScene(t, 100, 30);
      shk(v.last < 0.25 ? 1.4 * (1 - v.last / 0.25) : 0);
    });
    // closer: the knight walks out of the fog over the fallen two, one heavy step at a time — "Step away from them."
    shot(294.0, STING, (lt, t) => {
      const sh = 30, v = vesperScene(t, 40, sh, { noBell: false });
      view(lerp(sx(v.vx) + 80, sx(v.vx) + 60, eio(lt / 3.2)), lerp(160, 156, eio(lt / 3.2)), lerp(1.3, 1.45, eio(lt / 3.2)));
      shk(v.last < 0.25 ? 2 * (1 - v.last / 0.25) : 0);
    });
    shot(STING, 300, (lt, t) => {
      if (t >= BLACK) { BUF.fill(BLACK); return; }
      BUF.fill(C('ink', 1));
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const nn = fbm(x * 0.5 + t * 10, y * 1.1, 26, 2, 881); BUF[y * W + x] = soft(R.dusk, 0.6 + nn * 1.6 + (1 - Math.abs(y - 135) / 135) * 0.4, x, y); }
      const flare = Math.min(1.25, eob(lin(STING, STING + 0.2, t)) * 1.15) * (1 - lin(STING + 0.7, BLACK, t) * 0.35);
      LIGHT.x = 0.5; LIGHT.y = -0.7; ENV.edge = C('lav', 6);
      const r = bust('vesper', { t, eyes: Math.min(1, flare) }, 244, H - 22 + 10 - fl(lt * 4), 3, 1);
      ENV.edge = null;
      // the flare: a burst of violet light from each eye, a horizontal streak
      for (const e of [[244 + (2 - 8 + 0.5) * 3, r.head[1] - 1.5], [244 + (2 + 7 + 0.5) * 3, r.head[1] - 1.5]]) {
        glow(e[0], e[1], 40 * flare + 4, tab('#c890ff', true), 0.7 * flare);
        const L = 120 * flare; for (let x = -L; x <= L; x++) { const a = 1 - Math.abs(x) / Math.max(1, L); if (ih(fl(x), 1, 891) < a) put(fl(e[0] + x), fl(e[1]), a > 0.6 ? WHITE : C('violet', 6)); }
        for (let k = 0; k < 8; k++) { const an = k / 8 * TAU, l = 30 * flare * (k & 1 ? 0.5 : 1); line(e[0], e[1], e[0] + Math.cos(an) * l, e[1] + Math.sin(an) * l, C('lav', 7)); }
      }
      // embers of violet drifting
      for (let k = 0; k < 30; k++) { const u = frac(t * 0.3 + ih(k, 1, 892)), x = ih(k, 2, 892) * W, y = H - u * H; put(fl(x), fl(y), C('violet', 5 + (k & 1))); }
      fade(lin(STING + 0.9, BLACK, t));
    }, {});
  }
