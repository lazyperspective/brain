  /* ================================================================ part IV: the world below, and the scale of the powers */
  const OCEAN = [114, 115, 116, 117, 118, 119], ASH = [120, 121, 122, 123];
  const T_NOVA = mkTab('ffb850', true), T_FIRE = mkTab('ff2a10', true), T_DEEP = mkTab('050203', false);
  const SKY_BLOOD = [96, 97, 98, 101, 102], SKY_ASH = [96, 120, 97, 121, 98];
  const SM_NOVA = [110, 109, 108], SM_LAST = [103, 104, 107], SM_INF = [85, 83, 22];
  SMEAR_OF.nova = SM_NOVA; SMEAR_OF.lastlight = SM_LAST; SMEAR_OF.infinite = SM_INF;

  // under the cloud sea: a dark ocean to the horizon at hz, swells moving, rock spires standing out of it (three depths,
  // the near ones larger and faster with ox); burn (0..1) lights their broken tops with fire
  function belowWorld(t, hz, ox, burn, skyCols, light) {
    gradient(LB, hz, skyCols || SKY_BLOOD);
    const LX = light === undefined ? 300 : light, deep = H - LB;
    // the underside of the cloud sea, far above: heavy, lit red from below by the fire of the world
    for (let k = 0; k < 16; k++) { const x = ((ih(k, 1, 1105) * 620 - ox * 0.15) % 620 + 620) % 620 - 70, y = LB - 6 + ih(k, 2, 1105) * 16, r = 20 + ih(k, 3, 1105) * 26; cloudPuff(x, y, r, [96, 97, 98, 101], 1106 + k); }
    for (let x = 0; x < W; x++) for (let y = LB; y < LB + 30; y++) { const i = y * W + x; if (BUF[i] === 101 && bay(x, y) < 0.5) BUF[i] = 102; }
    // the ocean: swells, a band of reflected fire under the light, foam on the crests
    for (let y = Math.max(LB, fl(hz)); y < deep; y++) {
      const u = (y - hz) / Math.max(1, deep - hz), base = fl(u * 3.2);
      for (let x = 0; x < W; x++) {
        const sw = Math.sin(x * 0.05 / (0.2 + u) + t * 1.2 + y * 0.9) + Math.sin(x * 0.013 / (0.2 + u) - t * 0.7 + y * 0.31);
        let c = OCEAN[clamp(base + (sw > 1.2 ? 2 : sw > 0.6 ? 1 : 0) - (bay(x, y) > 0.5 + u * 0.4 ? 1 : 0), 0, 3)];
        if (sw > 1.75 && u > 0.1) c = u > 0.5 ? 119 : 118;
        // the reflection: a broken column of fire on the water under the light, wider toward us
        const rw = 14 + u * 70, dxr = Math.abs(x - LX - Math.sin(y * 0.7 + t * 2) * (2 + u * 6));
        if (dxr < rw && sw > 0.2 - (1 - dxr / rw) * 0.9 && ih(x >> 1, y, fl(t * 8)) < 0.85) c = sw > 1.2 ? 105 : sw > 0.7 ? 103 : 102;
        BUF[y * W + x] = c;
      }
    }
    // the spires: faceted columns of rock (a lit face and a shadowed face), banded with strata, burning at the top,
    // standing in mist; three depths, the far ones paler with distance
    for (let layer = 0; layer < 3; layer++) {
      const n = 7 - layer * 2, par = 0.3 + layer * 0.5, sc = 0.6 + layer * 0.55;
      const LIT = layer === 0 ? [99, 100, 121] : layer === 1 ? [98, 99, 100] : [97, 99, 100], SH = layer === 0 ? 98 : layer === 1 ? 97 : 96;
      for (let k = 0; k < n; k++) {
        const bx = ((ih(k, layer, 1101) * 640 - ox * par) % 640 + 640) % 640 - 80, bw = (14 + ih(k, 2, 1101 + layer) * 26) * sc, bh = (40 + ih(k, 3, 1101 + layer) * 90) * sc, by = hz + 6 + layer * 18;
        const lean = (ih(k, 4, 1101 + layer) - 0.5) * 0.25, ridge = (ih(k, 5, 1101 + layer) - 0.5) * 0.5;
        for (let y = fl(by - bh); y < by + 4; y++) {
          if (y < LB || y >= deep) continue;
          const v = (by - y) / bh, cxr = bx + lean * (by - y), half = bw * (0.25 + 0.75 * Math.pow(Math.max(0, 1 - v), 0.6)) * (0.8 + 0.4 * vn(y * 0.2, k, 1, 1102 + layer));
          const top = by - bh + (vn((y + k * 13) * 0.5, k, 1, 1107) - 0.5) * 6 * sc;
          for (let x = fl(cxr - half); x <= cxr + half; x++) {
            if (x < 0 || x >= W) continue;
            const f = (x - cxr) / half, onLit = f < ridge * (1 - v);
            const strata = frac((y + vn(x * 0.2, k, 1, 1108) * 3) / (7 * sc)) < 0.14;
            let c = onLit ? LIT[f < -0.75 ? 2 : f < -0.3 ? 1 : 0] : SH;
            if (strata) c = onLit ? LIT[0] - 1 : 96;
            if (Math.abs(f) > 0.9) c = 96;
            if (burn > 0 && v > 0.85 && ih(x, y, 1103) < burn) c = v > 0.95 ? 105 : 103;
            BUF[y * W + x] = c;
          }
        }
        // mist where it meets the sea
        for (let q = 0; q < 6; q++) { const mx = bx + (ih(k, q, 1109 + layer) - 0.5) * bw * 2.2, my = by + 1 + Math.sin(t * 0.8 + q + k) * 1.5; cloudPuff(mx, my, (5 + q) * sc, [116, 117, 117, 118], 1110 + k * 7 + q); }
      }
    }
    if (burn > 0) glow(240, hz, 300, T_EMBER, 0.25 * burn);
    glow(LX, hz, 110, T_EMBER, 0.3);
  }
  // the cloud sea seen from just above, torn by the fight: holes (centres, radii) blown through it show the ocean below
  function cloudSea(t, y0, ox, cols, holes) {
    cloudBank(y0, 34, 70, 1111, ox + t * 6, cols, false);
    cloudBank(y0 + 26, 44, 50, 1112, ox * 1.3 + t * 9, cols, false);
    for (const [hx, hy, hr] of holes || []) for (let y = Math.max(LB, fl(hy - hr * 0.4)); y < Math.min(H - LB, hy + hr * 0.4); y++) for (let x = Math.max(0, fl(hx - hr)); x < Math.min(W, hx + hr); x++) {
      const dx = (x - hx) / hr, dy = (y - hy) / (hr * 0.4), d = dx * dx + dy * dy; if (d > 1) continue;
      BUF[y * W + x] = d > 0.8 ? (bay(x, y) < 0.5 ? cols[0] : 101) : d > 0.65 ? 103 : OCEAN[clamp(fl(1 + (1 - d) * 2), 0, 3)];
    }
  }

  /* the great blade: the sword grown past all sense. From the hand (hx, hy) along angle a for len px (it may run far off the
     frame), w px wide at the guard. o: form ('gold' | 'nova' | 'lastlight' | 'infinite' | 'steel'), grow 0..1 (the blade is
     still racing out: rings of light run along it and its tip is white-hot), snap (0..1 along: broken there — gap and the
     far part shifted by o.snapOff [dx, dy]), cracks 0..1, flare 0..1 (light spilling round it). Returns the tip [x, y]. */
  const BLADE_COLS = {
    gold: [58, 59, 60, 22], nova: [110, 109, 108, 22], lastlight: [102, 104, 107, 22], infinite: null, steel: [33, 34, 21, 22],
  };
  function bigBlade(hx, hy, a, len, w, t, o) {
    o = o || {};
    const form = o.form || 'gold', cols = BLADE_COLS[form], ux = Math.cos(a), uy = Math.sin(a), grow = o.grow === undefined ? 1 : o.grow;
    const L = len * grow, tipK = 0.86;
    // the guard and grip at the hand
    const gw = w * 1.7, gx = -uy, gy = ux;
    capsF(hx - gx * gw, hy - gy * gw, hx + gx * gw, hy + gy * gw, Math.max(1.5, w * 0.28), Math.max(1.5, w * 0.28), (u, d) => d > 0.7 ? 51 : 58);
    capsF(hx - ux * w * 1.4, hy - uy * w * 1.4, hx, hy, Math.max(1.2, w * 0.2), Math.max(1.2, w * 0.2), () => 38);
    // the blade, clipped to the frame
    const reach = Math.min(L, 2000), tx = hx + ux * reach, ty = hy + uy * reach;
    const pad = w * 3 + 4, x0 = Math.max(0, fl(Math.min(hx, tx) - pad)), x1 = Math.min(W - 1, Math.ceil(Math.max(hx, tx) + pad)), y0 = Math.max(LB, fl(Math.min(hy, ty) - pad)), y1 = Math.min(H - LB - 1, Math.ceil(Math.max(hy, ty) + pad));
    const snap = o.snap, so = o.snapOff || [0, 0], flare = o.flare === undefined ? 0.6 : o.flare, Tg = form === 'nova' ? T_NOVA : form === 'lastlight' ? T_EMBER : form === 'infinite' ? T_WH : T_GOLD;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      let px = x + 0.5 - hx, py = y + 0.5 - hy;
      let along = px * ux + py * uy;
      if (snap !== undefined && along > snap * L + w * 0.5) { px -= so[0]; py -= so[1]; along = px * ux + py * uy; if (along < snap * L + w * 0.5) continue; }
      const across = -px * uy + py * ux;
      if (along < w * 0.6 || along > L) { continue; }
      const f = along / L, half = (f < tipK ? w : w * Math.max(0, (1 - f) / (1 - tipK))) * (snap !== undefined && Math.abs(along - snap * L) < w * 0.5 ? 0 : 1), ad = Math.abs(across);
      if (ad > half) {
        // light spilling off the edge
        if (flare > 0 && ad < half + w * 2.2) tintI(y * W + x, x, y, Tg, flare * 0.6 * (1 - (ad - half) / (w * 2.2)));
        continue;
      }
      const e = ad / Math.max(0.5, half);
      let c;
      if (form === 'infinite') { const k = ((fl(along / 9 - t * 30) % 7) + 7) % 7; c = e < 0.35 ? 22 : e < 0.6 ? 60 : PRISM_C[k]; }
      else c = e < 0.3 ? cols[3] : e < 0.55 ? cols[2] : e < 0.82 ? cols[1] : cols[0];
      // energy racing out along it while it grows, and the fuller the blade the brighter its spine
      if (grow < 1 || o.surge) { const ph = frac(along / (w * 7) - t * 6); if (ph < 0.12 && e < 0.8) c = 22; }
      if (o.cracks > 0 && ih(fl(along / 6), fl(across / 3), 1121) < o.cracks * 0.15 && e > 0.2) c = form === 'lastlight' ? 22 : 96;
      if (f > 0.97 && grow < 1) c = 22;
      BUF[y * W + x] = c;
    }
    if (grow < 1) glow(hx + ux * Math.min(L, 600), hy + uy * Math.min(L, 600), w * 8, T_WH, 0.6);
    return [hx + ux * L, hy + uy * L];
  }

  // the frame breaks like glass round (cx, cy): cracks race out (amt 0..0.6), then the pieces shift and tilt (0.6..1)
  function frameCrack(cx, cy, amt, seed, maxR) {
    if (amt <= 0) return;
    seed = seed || 1131;
    const n = 14, gr = clamp((amt - 0.55) / 0.45, 0, 1), MR = maxR || 520;
    if (gr > 0) {
      TMP.set(BUF);
      for (let y = LB; y < H - LB; y++) for (let x = 0; x < W; x++) {
        const dx = x - cx, dy = y - cy, r = Math.hypot(dx, dy); if (r > MR) continue; const sec = fl(((Math.atan2(dy, dx) + PI) / TAU) * n + vn(r * 0.01, 0, 1, seed) * 0.6), ring = fl(r / 60);
        const k = sec * 7 + ring, ox = (ih(k, 1, seed) - 0.5) * 8 * gr + Math.cos(sec / n * TAU) * ring * 2 * gr, oy = (ih(k, 2, seed) - 0.5) * 8 * gr + Math.sin(sec / n * TAU) * ring * 2 * gr;
        BUF[y * W + x] = TMP[clamp(fl(y - oy), LB, H - LB - 1) * W + clamp(fl(x - ox), 0, W - 1)];
      }
    }
    for (let k = 0; k < n; k++) {
      let a = (k + ih(k, 3, seed) * 0.6) / n * TAU - PI, x = cx, y = cy;
      const Lmax = MR * Math.min(1, amt / 0.55);
      for (let q = 0; q < 40 && Math.hypot(x - cx, y - cy) < Lmax; q++) {
        const st = 9 + ih(k, q, seed + 1) * 12, nx = x + Math.cos(a) * st, ny = y + Math.sin(a) * st;
        lineP(x, y, nx, ny, 22); lineP(x + 1, y, nx + 1, ny, 0);
        if (ih(k, q, seed + 2) < 0.12) { const b = a + (ih(k, q, seed + 3) - 0.5) * 1.6; lineP(nx, ny, nx + Math.cos(b) * 18, ny + Math.sin(b) * 18, 22); }
        x = nx; y = ny; a += (ih(k, q, seed + 4) - 0.5) * 0.5;
      }
    }
    for (let ringR = 30; ringR < Math.min(300, MR * 0.7) * Math.min(1, amt / 0.55); ringR += 55) for (let k = 0; k < n; k++) if (ih(k, ringR, seed + 5) < 0.6) { const a0 = k / n * TAU - PI, a1 = (k + 1) / n * TAU - PI; lineP(cx + Math.cos(a0) * ringR, cy + Math.sin(a0) * ringR, cx + Math.cos(a1) * ringR * 1.04, cy + Math.sin(a1) * ringR * 1.04, 22); }
  }

  // the world split along a line through (x0, y0) at angle a: the two sides slide apart by gap px, the chasm between
  // burning; amt 0..1 how far the split has run along its length from (x0, y0) (both ways)
  function worldSplit(x0, y0, a, gap, amt, t) {
    if (gap <= 0.3 || amt <= 0) return;
    TMP.set(BUF);
    const ux = Math.cos(a), uy = Math.sin(a), nx = -uy, ny = ux, reach = amt * 700;
    for (let y = LB; y < H - LB; y++) for (let x = 0; x < W; x++) {
      const px = x - x0, py = y - y0, along = px * ux + py * uy, d = px * nx + py * ny;
      if (Math.abs(along) > reach) continue;
      const g = gap * (1 - Math.pow(Math.abs(along) / reach, 3)) * 0.5;
      if (Math.abs(d) < g) {
        const e = Math.abs(d) / g; BUF[y * W + x] = e < 0.25 ? 22 : e < 0.5 ? 107 : e < 0.75 ? 105 : e < 0.9 ? 103 : 101;
        continue;
      }
      const sd = d > 0 ? 1 : -1, sx = x - nx * g * sd, sy = y - ny * g * sd;
      BUF[y * W + x] = TMP[clamp(fl(sy), LB, H - LB - 1) * W + clamp(fl(sx), 0, W - 1)];
    }
    for (let k = 0; k < 30; k++) { const s = (ih(k, 1, 1141) - 0.5) * 2 * reach, f = frac(t * 0.8 + ih(k, 2, 1141)); P(x0 + ux * s + nx * (ih(k, 3, 1141) - 0.5) * gap, y0 + uy * s + ny * (ih(k, 3, 1141) - 0.5) * gap - f * 40, f < 0.5 ? 105 : 103); }
  }

  // chunks of rock (or porcelain, or ice of light) thrown from (cx, cy): g seconds since, n pieces, speed v, gravity
  function rocks(cx, cy, g, n, v, size, cols, seed, grav, dir, spread) {
    if (g < 0) return;
    for (let k = 0; k < n; k++) {
      const a = (dir === undefined ? ih(k, 1, seed) * TAU : dir + (ih(k, 1, seed) - 0.5) * (spread || 1.4)), sp = v * (0.35 + ih(k, 2, seed) * 0.8);
      const x = cx + Math.cos(a) * sp * g, y = cy + Math.sin(a) * sp * g + (grav === undefined ? 160 : grav) * g * g, r = size * (0.4 + ih(k, 3, seed) * 0.9), rot = g * (3 + ih(k, 4, seed) * 6) + k;
      if (x < -r * 2 || x > W + r * 2 || y < -r * 2 || y > H + r * 2) continue;
      const pts = []; for (let q = 0; q < 6; q++) { const aa = rot + q / 6 * TAU, rr = r * (0.7 + ih(k, q + 9, seed) * 0.5); pts.push([x + Math.cos(aa) * rr, y + Math.sin(aa) * rr]); }
      for (let q = 0; q < 6; q++) { const [ax, ay] = pts[q], [bx, by] = pts[(q + 1) % 6]; z5Tri(x, y, ax, ay, bx, by, q < 2 ? cols[2] : q < 4 ? cols[1] : cols[0]); }
      if (cols[3] !== undefined && r > 2) P(x, y, cols[3]);
    }
  }

  // the black sun: a hole where the light was, a rim of fire, tongues of corona lashing out; it drinks the light round it
  function blackSun(cx, cy, r, t, amt) {
    if (amt <= 0) return;
    const R = r * 3.2, x0 = Math.max(0, fl(cx - R)), x1 = Math.min(W - 1, Math.ceil(cx + R)), y0 = Math.max(LB, fl(cy - R)), y1 = Math.min(H - LB - 1, Math.ceil(cy + R));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy, d = Math.sqrt(dx * dx + dy * dy), an = Math.atan2(dy, dx);
      if (d < r) { BUF[y * W + x] = d > r - 1.6 ? 105 : d > r - 3 ? 102 : 0; continue; }
      const tongue = r * (1.15 + 0.5 * Math.max(0, Math.sin(an * 7 + t * 2.3) * Math.sin(an * 3 - t * 1.1)) + 0.35 * vn(an * 4 + t, 0, 1, 1151)) * amt;
      if (d < tongue) { const e = (d - r) / Math.max(1, tongue - r); BUF[y * W + x] = e < 0.2 ? 107 : e < 0.45 ? 105 : e < 0.7 ? 103 : bay(x, y) < 0.5 ? 102 : 101; continue; }
      if (d < R) tintI(y * W + x, x, y, T_DEEP, amt * 0.75 * (1 - (d - tongue) / (R - tongue)));
    }
  }

  // pixels round (cx, cy) dragged toward it (amt > 0) or thrown out from it (amt < 0) within R — gravity bending the picture
  function warp(cx, cy, R, amt, sy) {
    if (Math.abs(amt) < 0.01) return;
    TMP.set(BUF); sy = sy || 1;
    const x0 = Math.max(0, fl(cx - R)), x1 = Math.min(W - 1, Math.ceil(cx + R)), y0 = Math.max(LB, fl(cy - R / sy)), y1 = Math.min(H - LB - 1, Math.ceil(cy + R / sy));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const dx = x - cx, dy = (y - cy) * sy, d = Math.sqrt(dx * dx + dy * dy); if (d >= R || d < 0.5) continue;
      const f = 1 - d / R, k = 1 + amt * f * f;
      BUF[y * W + x] = TMP[clamp(fl(cy + (y - cy) * k), LB, H - LB - 1) * W + clamp(fl(cx + dx * k), 0, W - 1)];
    }
  }

  /* the weight of a blow: one call for a heavy hit at (x, y), g seconds after it. power 1 (hard) .. 4 (world-breaking);
     dir the angle it travels (debris and streaks fly that way). One impact frame only (never a strobe), rings, a burst of
     debris and sparks, light, a shake — and from power 3 the frame itself cracks. */
  function megaHit(x, y, g, power, dir, cols, seed) {
    if (g < 0 || g > 1.2) return;
    cols = cols || [22, 105, 103]; seed = seed || 1161;
    // the ink-and-light impact frame only for the heavy blows (lighter ones flash light instead): fewer jolts, more flow
    if (g < 0.03) { if (power >= 2.5) impactFrame(x, y, power >= 2.8 ? 1 : 0); else glow(x, y, 34 * power, T_WH, 0.45); }
    const P_ = power;
    if (g < 0.5) {
      shockRing(x, y, 8 + g * 420 * P_, 5 + g * 240 * P_, 2 + P_, [22, cols[1], cols[2]], 1 - g / 0.5);
      if (P_ >= 2) shockRing(x, y, 4 + g * 260 * P_, 3 + g * 90 * P_, 2, [cols[1], cols[2], 101], 1 - g / 0.45);
      burst(x, y, g / 0.3, 70 * P_, 14 + 4 * P_, ih(fl(x), fl(y), seed) * TAU, [cols[0], cols[1]], 3);
    }
    for (let k = 0; k < 14 + 8 * P_; k++) {
      const a = dir === undefined ? ih(k, 1, seed) * TAU : dir + (ih(k, 1, seed) - 0.5) * 1.5, v = (90 + ih(k, 2, seed) * 260) * Math.sqrt(P_), px = x + Math.cos(a) * v * g, py = y + Math.sin(a) * v * g + 120 * g * g;
      if (g < 0.6) lineP(px, py, px - Math.cos(a) * (6 + P_ * 3), py - Math.sin(a) * (6 + P_ * 3), g < 0.15 ? cols[0] : cols[1]);
    }
    glow(x, y, 40 * P_ * Math.max(0, 1 - g * 1.8), T_WH, 0.75);
    glow(x, y, 70 * P_ * Math.max(0, 1 - g * 1.2), cols[1] >= 101 && cols[1] <= 107 ? T_EMBER : T_GOLD, 0.45);
    shk(4 * P_ * Math.max(0, 1 - g * 2.5));
    if (P_ >= 3 && g < 0.9) frameCrack(x, y, Math.min(1, g * 4) * (1 - sstep(0.6, 0.9, g)), seed + 7);
  }
  // a camera kick for a list of hits: returns [zoom add, roll add, dx, dy] decaying after each
  function kick(t, hits, amt) {
    let z = 0, r = 0, dx = 0, dy = 0;
    for (const [h, p, dir] of hits) { const g = t - h; if (g < 0 || g > 1.5) continue; const e = Math.exp(-g * 7) * (p || 1) * (amt || 1); z += 0.05 * e; r += 0.03 * e * Math.cos(g * 30) * ((h * 7) % 2 < 1 ? 1 : -1); if (dir !== undefined) { dx += Math.cos(dir) * 10 * e * Math.cos(g * 18); dy += Math.sin(dir) * 10 * e * Math.cos(g * 18); } }
    return [z, r, dx, dy];
  }

  /* high above the cloud sea, after he has come: the dawn sky stained by him (crimson high up, burning orange at the horizon),
     the sun low behind the cloud with rays thrown up through it, three decks of cloud moving with parallax (ox), embers
     drifting on the wind. highFore draws the nearest deck, to go in front of whatever stands in the cloud. */
  function highSky(t, ox, sunX, sunY, stain) {
    ox = ox || 0; sunX = sunX === undefined ? 380 : sunX; sunY = sunY === undefined ? 168 : sunY; stain = stain === undefined ? 0.6 : stain;
    gradient(LB, 200, [97, 98, 10, 11, 12, 13, 14, 15]);
    glow(sunX, sunY, 210, T_WARM, 0.55); glow(sunX, sunY, 90, T_WH, 0.35);
    discF(sunX, sunY, 20, 15); discF(sunX, sunY, 16, 16); discF(sunX - 3, sunY - 3, 8, 22);
    z5GodRays(sunX, sunY, 8, t * 0.08, T_WARM, 0.32, 430);
    cloudBank(162, 24, 90, 1171, ox * 0.25 + t * 3, [12, 13, 14, 15], false);
    cloudBank(190, 32, 70, 1172, ox * 0.55 + t * 6, [10, 11, 13, 14], false);
    if (stain > 0) tintAll(T_BLOOD, stain * 0.22);
    for (let k = 0; k < 30; k++) { const g = frac(t * (0.1 + ih(k, 3, 1173) * 0.12) + ih(k, 1, 1173)), x = ((ih(k, 2, 1173) * 560 - g * 300 - ox * 0.8) % 560 + 560) % 560 - 40, y = LB + 10 + ih(k, 4, 1173) * 190 - g * 40 + Math.sin(t * 2 + k) * 3; P(x, y, k % 4 ? 104 : 106); if (k % 3 === 0) P(x + 1, y, 103); }
  }
  function highFore(t, ox, y0) { cloudBank(y0 || 232, 44, 52, 1174, (ox || 0) + t * 10, [9, 10, 11, 13], false); }
