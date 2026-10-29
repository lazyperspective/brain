  /* ================================================================ 3 · The frozen waterfall (10.45 … 11.0 – 17.0)
     A gorge: dark rock walls with snow on every ledge, and between them a waterfall frozen into organ pipes of ice,
     bulging in steps, hung with icicles, mounds of frozen spray at its foot. The kit crosses the frozen river in front.
     The ice is shaded live: cool and deep where it is dark, glowing gold inside where the lantern reaches, cyan at the
     refracting rims, caustic bands wavering, cracks lighting up. The river ice is a dark mirror (the falls, the kit and
     its lantern reflected) with the water still moving under it. Camera: low and close (z 1.25), craning up and widening
     to the whole height, then tilting up past the lip into the sky, where the aurora is beginning. */
  const F3 = { L: {}, rig: null };
  const OY3 = 300;                                               // layer y = world y + this (the layers reach up into the sky)
  const F3S = 1.3, F3G = 214, F3LS = 1.02 * F3S, F3POOL = 191;    // kit size, its row on the ice, lantern size, where the falls meet the ice
  const F3FX0 = 196, F3FX1 = 404;                                 // the falls' sides
  const M_RIVER = defMat('1a3a5a', PAL_ICE);
  BUILDERS.push(() => {
    F3.rig = mkRig([0.03, 0.05, 0.11], [0.42, 0.56, 0.86], [1.0, 0.56, 0.24]);
    const L = F3.L, H3 = 580;
    L.sky = mkLayer(700, H3);
    paintStars(L.sky, 240, OY3 - 60, 302, [206, 207, 194]);
    // far mountains, snow-capped, hazy
    L.far = mkLayer(700, H3, { z0: 200 });
    { const ht = (x) => 30 * fbm(x, 0, 80, 4, 311) + 34 * Math.abs(Math.sin(x * 0.0095 + 0.6)) ** 3;
      for (let x = 0; x < 700; x++) {
        const top = OY3 - 112 - ht(x), sl = (ht(x + 2) - ht(x - 2)) / 4;
        for (let y = fl(top); y < OY3 - 70; y++) {
          // a far ridge, mostly in shadow: a lit snowy crest on the faces turned to the light
          const dd = y - top, snow = dd < 2 + 7 * fbm(x, 0, 22, 2, 313);
          lput(L.far, x, y, snow ? M_SNOW : M_ROCK, snow ? 0.42 + clamp(sl, -0.15, 0.15) - dd * 0.02 : 0.18 - dd * 0.001, 200, 0, -0.4, 0);
        }
      } }
    // the gorge: rock walls, and the frozen falls between them
    L.gorge = mkLayer(720, H3, { z0: 0 });
    paintGorge(L.gorge);
    // the river: dark ice, and the snowbank in front
    L.main = mkLayer(800, H3, { z0: -128, recv: true });
    const depM = (y) => 128 + (F3G - y) * 3;
    for (let x = 0; x < 800; x++) {
      const yb = OY3 + 229 + 3 * Math.sin(x * 0.03 + 1) + 2 * Math.sin(x * 0.09);
      for (let y = OY3 + F3POOL; y < yb; y++) {
        const wy = y - OY3, f = ih(x, y, 331) < 0.004 ? 1 + fl(ih(x, y, 332) * 250) : 0;   // trapped bubbles
        lput(L.main, x, y, M_RIVER, 0.3 + 0.1 * vn(x * 0.4, wy * 2, 6, 333), depM(wy), 0, -1, f);
      }
      for (let y = fl(yb); y < H3; y++) {
        const dd = y - yb, wy = y - OY3;
        lput(L.main, x, y, M_SNOW, 0.48 + 0.2 * clamp(1 - dd / 4, 0, 1) + (vn(x, y, 7, 334) - 0.5) * 0.18, depM(wy), 0, -1, ih(x, y, 335) < 0.04 ? 1 + fl(ih(x, y, 336) * 250) : 0);
      }
    }
    // frozen reeds along the near bank, each with a bead of ice
    for (let k = 0; k < 30; k++) {
      const x = ih(k, 1, 337) * 800, yb = OY3 + 232 + ih(k, 2, 337) * 10, h = 8 + ih(k, 3, 337) * 14, ln = (ih(k, 4, 337) - 0.5) * 6;
      for (let j = 0; j < h; j++) lput(L.main, x + ln * (j / h) ** 2, yb - j, M_GRASS, 0.35 + 0.3 * j / h, depM(yb - OY3), -0.4, 0, 0);
      lput(L.main, x + ln, yb - h, M_ICE, 0.9, depM(yb - OY3), 0, -0.5, 2);
    }
    L.fore = mkLayer(1000, H3, { z0: -128 });
    for (let x = 0; x < 1000; x++) {
      const top = OY3 + 246 + 5 * Math.sin(x * 0.02 + 0.4) + 3 * Math.sin(x * 0.07) - 18 * Math.max(0, Math.sin(x * 0.011 + 2.2)) ** 8;
      for (let y = fl(top); y < H3; y++) lput(L.fore, x, y, M_SNOW, 0.34 + 0.2 * clamp(1 - (y - top) / 4, 0, 1) + (vn(x, y, 6, 341) - 0.5) * 0.14, 0, 0, -1, ih(x, y, 342) < 0.03 ? 1 + fl(ih(x, y, 343) * 250) : 0);
    }
  });
  // craggy rock: jittered cells (facets), each tilted its own way; dark crevices between; snow on the facets that face up
  const RK = { s: 0, nx: 0, ny: 0, snow: 0 };
  function rockAt(x, y, seed) {
    // tall slabs: cells stretched upright, sheared a little, so the cliff reads as fractured columns of rock
    const xs = x + y * 0.18, cw = 19, ch = 38, gx = fl(xs / cw), gy = fl(y / ch);
    let d1 = 9, d2 = 9, id = 0, ccy = 0;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      const i = gx + di, j = gy + dj, cx = (i + 0.2 + 0.6 * ih(i, j, seed)) * cw, cy = (j + 0.15 + 0.7 * ih(i, j, seed + 1)) * ch;
      const d = ((xs - cx) / cw) ** 2 + ((y - cy) / ch) ** 2 * 0.8;
      if (d < d1) { d2 = d1; d1 = d; id = i * 7919 + j; ccy = cy; } else if (d < d2) d2 = d;
    }
    const nx = (ih(id, 3, seed) - 0.5) * 1.1, ny = (ih(id, 4, seed) - 0.55) * 0.9, e = Math.sqrt(d2) - Math.sqrt(d1);
    const grain = vn(xs * 0.7, y * 0.08, 1.4, seed + 9) - 0.5;
    let s = 0.26 + (-0.5 * nx - 0.6 * ny) * 0.3 + grain * 0.14 + (vn(x, y, 3, seed + 5) - 0.5) * 0.1 + (ih(id, 6, seed) - 0.5) * 0.1;
    if (e < 0.06) s -= 0.2 * (1 - e / 0.06);
    RK.snow = ny < -0.25 && ih(id, 8, seed) < 0.32 && y < ccy - ch * (0.32 + 0.18 * vn(x * 2, 0, 3, seed + 7)) && e > 0.07 ? 1 : 0;
    RK.s = s; RK.nx = nx; RK.ny = ny;
    return RK;
  }
  function paintGorge(L) {
    const oy = OY3, LIP = -72, Y0 = -130;
    // where the walls end and the ice begins (wavy; the rock overhangs the ice near the lip)
    const wallL = (y) => F3FX0 + 7 * Math.sin(y * 0.031 + 1) + 4 * Math.sin(y * 0.11) + (y < LIP + 40 ? (LIP + 40 - y) * 0.45 : 0);
    const wallR = (y) => F3FX1 + 6 * Math.sin(y * 0.037 + 2) + 4 * Math.sin(y * 0.09 + 1) - (y < LIP + 40 ? (LIP + 40 - y) * 0.4 : 0);
    const lip = (x) => LIP + 3 * Math.sin(x * 0.07) + 2 * Math.sin(x * 0.19);
    const topL = (x) => LIP - 26 + 14 * fbm(x, 0, 30, 3, 351), topR = (x) => LIP - 20 + 14 * fbm(x, 0, 30, 3, 352);
    // the columns: organ pipes of ice, overlapping in depth (the front ones brighter); each swells irregularly down its
    // length, flares at a few steps (with drips hanging off the flare), and some end in icicles part way down
    const COLS = [];
    for (let x = F3FX0 - 14, k = 0; x < F3FX1 + 14; k++) {
      const w = 3 + ih(k, 1, 361) ** 1.4 * 12, end = ih(k, 2, 361) < 0.32 ? LIP + 50 + ih(k, 3, 361) * 150 : 194;
      const steps = []; for (let y = LIP + 30 + ih(k, 6, 361) * 50; y < end - 20; y += 45 + ih(k, fl(y), 362) * 55) steps.push(y);
      COLS.push({ x: x + w * 0.8, w, end, ph: ih(k, 4, 361) * 60, k, steps, dz: ih(k, 10, 361), top: lip(x) + (ih(k, 11, 361) < 0.25 ? ih(k, 12, 361) * 40 : 0),
        crk: [LIP + ih(k, 7, 361) * 250, LIP + ih(k, 8, 361) * 250], cs: (ih(k, 9, 361) - 0.5) * 1.6 });
      x += w * (1.0 + ih(k, 5, 361) * 0.9);
    }
    COLS.sort((a, b) => a.dz - b.dz);                            // back to front
    const colW = (C, y) => {
      let fw = 1;
      for (const sy of C.steps) { const d = y - sy; if (d > -8 && d < 16) fw += 0.5 * Math.exp(-((d - 2) * (d - 2)) / 34); }
      return C.w * fw * (1 + 0.28 * n1(y * 0.028 + C.ph, 363) + 0.12 * n1(y * 0.1 + C.ph, 364)) * (y > C.end - 24 ? Math.max(0, (C.end - y) / 24) ** 0.65 : 1) * (y < C.top + 10 ? 0.6 + 0.4 * Math.max(0, y - C.top) / 10 : 1);
    };
    for (let y = Y0; y < 200; y++) {
      const ly = y + oy;
      for (let x = 0; x < L.w; x++) {
        const wl = wallL(y), wr = wallR(y);
        // ---- the walls
        if (x < wl || x > wr) {
          const left = x < wl, top = left ? topL(x) : topR(x);
          if (y < top) continue;
          const ed = left ? wl - x : x - wr;
          const R = rockAt(x, y, left ? 371 : 372);
          if (y < top + 3 + 2 * vn(x, 0, 5, 373) || R.snow) { lput(L, x, ly, M_SNOW, 0.72 + (y < top + 3 ? 0.15 : -0.1) + (vn(x, y, 3, 374) - 0.5) * 0.2, 60, R.nx * 0.3, -0.8, ih(x, y, 375) < 0.03 ? 1 + fl(ih(x, y, 376) * 250) : 0); continue; }
          lput(L, x, ly, M_ROCK, R.s - (ed < 5 ? 0.12 : 0) - (y > 150 ? (y - 150) * 0.004 : 0), 56 + Math.min(30, ed * 0.15), R.nx, R.ny, 0);
          continue;
        }
        // ---- the falls
        const lp = lip(x);
        if (y < lp - 7) continue;
        if (y < lp) { lput(L, x, ly, M_SNOW, 0.85 - (lp - y) * 0.04 + (vn(x, y, 2, 377) - 0.5) * 0.2, 50, 0, -0.9, 0); continue; }
        let best = null;
        for (let ci = COLS.length - 1; ci >= 0; ci--) {           // the front-most column covering this pixel
          const C = COLS[ci];
          if (y > C.end + 4 || y < C.top) continue;
          if (Math.abs(x - C.x) > C.w * 2.2) continue;
          const w = colW(C, y), q = (x - C.x) / Math.max(0.4, w);
          if (Math.abs(q) < 1) { best = { C, q }; break; }
        }
        if (best) {
          const { C, q } = best, aq = Math.abs(q);
          const str = vn(x * 1.5, y * 0.05, 1.3, 381 + C.k);
          let s = 0.3 + 0.58 * aq * aq * aq + (str - 0.5) * 0.3 + 0.12 * C.dz + 0.08 * n1(y * 0.05 + C.ph, 365), f = 0;
          let rime = y < lp + 4 + 3 * vn(x, 0, 2, 387);
          for (const sy of C.steps) { const d = y - sy; if (d > -3 && d < 0.5 + 2.2 * vn(x, 0, 3, 388) && ih(C.k, fl(sy), 390) < 0.35) rime = true; }
          if (rime) { lput(L, x, ly, M_SNOW, 0.78 - aq * 0.2, 44, q * 0.5, -0.7, 0); continue; }
          if (aq > 0.8) f |= 2;
          for (const cy0 of C.crk) { const d = (y - cy0) - (x - C.x) * C.cs; if (Math.abs(d) < 0.55 && Math.abs(y - cy0) < C.w * 2.5 && ih(C.k, fl(cy0), 389) < 0.7) f |= 1; }
          lput(L, x, ly, M_ICE, s, 40 + aq * 4 - C.dz * 4, q * 0.85, 0.05, f | ((fl(ih(x, y, 383) * 63)) << 2));
        } else {
          const str = vn(x * 2.0, y * 0.045, 1.5, 384);
          lput(L, x, ly, M_ICED, 0.2 + (str - 0.5) * 0.32 + (y > 170 ? (y - 170) * 0.01 : 0), 48, 0, 0, (fl(ih(x, y, 386) * 63)) << 2);
        }
      }
    }
    // drips hanging off each column's flares
    for (const C of COLS) for (const sy of C.steps) {
      const w = colW(C, sy + 2);
      for (let k = 0; k < 4; k++) {
        const x = C.x + (ih(C.k, k + fl(sy), 396) - 0.5) * 2 * w, len = 3 + ih(C.k, k + fl(sy), 397) ** 2 * 12;
        for (let j = 0; j < len; j++) { lput(L, x, sy + 8 + j + oy, M_ICE, j === fl(len) - 1 ? 1.2 : 0.75, 38, -0.3, 0, 2); if (j < len * 0.4) lput(L, x + 1, sy + 8 + j + oy, M_ICE, 0.45, 38, 0.6, 0, 0); }
      }
    }
    // firs standing along both cliff tops
    for (let k = 0; k < 26; k++) {
      const x = k * 29 + ih(k, 1, 321) * 16; if (x > F3FX0 - 18 && x < F3FX1 + 18) continue;
      const top = x < F3FX0 ? topL(x) : topR(x), h = 34 + ih(k, 2, 321) * 52;
      paintPine(L, x, top + oy + 3, h, 9 + h * 0.17, 3210 + k, 70, 1);
    }
    // mounds of frozen spray at the foot, snow on their tops
    for (let k = 0; k < 9; k++) {
      const mx = F3FX0 + 10 + k * (F3FX1 - F3FX0 - 20) / 8 + (ih(k, 1, 391) - 0.5) * 14, mr = 14 + ih(k, 2, 391) * 12, mh = 10 + ih(k, 3, 391) * 12;
      for (let y = fl(F3POOL - mh - 2); y <= F3POOL + 2; y++) for (let x = fl(mx - mr); x <= mx + mr; x++) {
        const u = (x - mx) / mr, top = F3POOL + 1 - mh * Math.sqrt(Math.max(0, 1 - u * u)); if (y < top || Math.abs(u) >= 1) continue;
        const dd = y - top, sn = dd < 2.5 + 1.5 * vn(x, 0, 3, 392);
        lput(L, x, y + oy, sn ? M_SNOW : M_ICE, sn ? 0.85 - u * 0.15 : 0.42 + (1 - dd / mh) * 0.4 - u * 0.2, 38, u * 0.6, -0.6, sn ? 0 : (2 | (fl(ih(x, y, 393) * 63) << 2)));
      }
    }
    // icicles: long ones under the lip and the overhangs, short ones under the snowy facets of the walls
    for (let k = 0; k < 260; k++) {
      const onLip = k < 70, x = onLip ? F3FX0 - 20 + ih(k, 1, 395) * (F3FX1 - F3FX0 + 40) : ih(k, 2, 395) * L.w;
      let y0 = onLip ? lip(x) + 1 : LIP - 10 + ih(k, 3, 395) * 250;
      if (!onLip) { if (x > wallL(y0) - 3 && x < wallR(y0) + 3) continue; const R = rockAt(x, y0 - 2, x < F3FX0 ? 371 : 372); if (!R.snow) continue; y0 += 1; }
      else if (x > wallL(y0) + 4 && x < wallR(y0) - 4 && ih(k, 9, 395) < 0.5) continue;
      const len = (onLip ? 8 : 3) + ih(k, 4, 395) ** 2 * (onLip ? 34 : 14), w = 0.8 + ih(k, 5, 395) * (onLip ? 2.2 : 1.2);
      for (let j = 0; j < len; j++) { const ww = w * (1 - j / len) ** 0.8; for (let dx = -Math.ceil(ww); dx <= Math.ceil(ww); dx++) if (Math.abs(dx) <= ww) lput(L, x + dx, y0 + j + oy, M_ICE, 0.62 + (dx < 0 ? 0.3 : 0) - j / len * 0.2, 40, dx / Math.max(1, ww) * 0.8, 0, 2); }
    }
  }
  // the ice, live: cool and deep in the dark; gold inside and cyan at the rims where the lantern reaches; caustics; cracks
  const R_ICEC = [222, 223, 224, 225, 226, 227, 228, 229];
  const R_ICEW = [225, 226, 227, 228, 229, 188, 187, 200, 22];       // light diffusing through ice: it stays icy until near the flame, then cream-gold
  function iceShade(m, s, l, f, X, Y, lx, ly, nx) {
    const b = bay(X, Y);
    if (m === M_RIVER) return riverShade(s, l, f, X, Y, lx, ly, b);
    const deep = m === M_ICED;
    const g = l * (deep ? 1.3 : 1.8);
    if ((f & 1) && g > 0.16) return g > 0.55 ? 22 : 200;                          // a crack lit from within
    if (f & 1) return deep ? 225 : 227;
    // caustics: thin bright filaments where the refracted light gathers, wavering as the flame and the lantern move
    const ph = lx * 0.23 + ly * 0.05 + (X - LAMP.x) * 0.04 + 1.7 * Math.sin(ly * 0.07 + lx * 0.02 + T_NOW * 0.9) + T_NOW * 0.7;
    const filament = 1 - Math.abs(Math.sin(ph));
    if ((f & 2) && g > 0.15) return g > 0.6 || filament > 0.8 ? 229 : 228;      // a refracting rim: cyan
    const v = (deep ? s * 0.75 : s) + (f & 2 ? 0.2 : 0);
    if (g > 0.08) {
      if (filament > 0.93 && g > 0.22) return g > 0.5 ? 229 : 228;               // a cyan filament in the gold
      const w = g * (0.9 + 0.25 * filament) - 0.08;
      // a smooth handover from the cool ice to the warm glow (a narrow dither seam)
      const k = clamp((w - 0.06) * 3.2, 0, 1);
      if (b < k) return rq(R_ICEW, clamp(w * 0.8 + v * 0.18, 0, 1), b, 0.6);
    }
    return rq(R_ICEC, clamp(v * 0.6 + (deep ? -0.05 : 0.04), 0, 1), b, 0.8);
  }
  // the river's surface: near-black glass, the moving water under it, bubbles, a warm sheen round the lantern
  const RIVM = new Uint8Array(NP);
  function riverShade(s, l, f, X, Y, lx, ly, b) {
    RIVM[Y * W + X] = 1;
    const flow = Math.sin(lx * 0.045 - T_NOW * 1.1 + 2.5 * Math.sin(ly * 0.5 + lx * 0.01) + vn(lx * 0.3, ly * 2, 8, 401) * 4);
    let v = s * 0.8 + (flow > 0.8 ? 0.16 : flow > 0.55 ? 0.07 : 0);
    if (f) { const tw = frac(f * 0.11 + T_NOW * 0.2); if (tw < 0.5) return l > 0.2 ? 188 : 226; }
    if (l > 0.12) { const w = l * 1.5; if (b < w - 0.08) return rq([224, 178, 180, 182, 183, 199], clamp(w * 0.6 + v * 0.2, 0, 1), b, 0.8); }
    return rq([240, 222, 223, 224, 225], clamp(v, 0, 1), b, 0.8);
  }
  // reflections in the river ice: everything above the pool line, mirrored, darkened, rippled; the lantern a streak
  const T_REFL = mkMul(0.55, 0.62, 0.8);
  function reflectRiver(yLine, src, maskFn) {
    for (let Y = Math.max(ROW0, Math.ceil(yLine)); Y <= ROW1; Y++) {
      const Yr = fl(2 * yLine - Y);
      if (Yr < ROW0) continue;
      const fade = clamp(1 - (Y - yLine) / 46, 0, 1);
      if (fade <= 0.05) continue;
      for (let X = 0; X < W; X++) {
        const i = Y * W + X; if (!RIVM[i]) continue;
        const wob = Math.round(1.4 * Math.sin(Y * 0.9 + T_NOW * 2.1) * (0.5 + (Y - yLine) / 40));
        const Xs = clamp(X + wob, 0, W - 1), j = Yr * W + Xs;
        if (maskFn && !maskFn(j)) continue;
        const c = src[j], lm = LUMP2[c];
        if (lm < 40) continue;
        if (bay(X, Y) > fade * (0.35 + lm / 300)) continue;
        BUF[i] = T_REFL[lm > 160 ? 3 : 5][c];
      }
    }
  }
  const LUMP2 = PAL.map((p) => p[0] * 0.3 + p[1] * 0.55 + p[2] * 0.15);
  const BUFR = new Uint8Array(NP), BUFF = new Uint8Array(NP);
  /* ---------------------------------------------------------------- the performance */
  const f3X = (t) => { const d = Math.max(0, t - 10.45); return 96 + 52 * d - 6 * bump(13.1, 13.9, t); };
  const f3Pose = (t) => {
    const ph = (t - 4.7) * 2.6 + 0.37;
    const slip = bump(13.1, 13.8, t), slip2 = bump(13.15, 13.45, t);
    const wagD = (u) => { const tt = t - u * 0.15; return 0.1 * Math.sin(TAU * 1.3 * tt) + 0.06 * Math.sin(TAU * 2.6 * tt + 1) + 0.25 * bump(13.15, 13.9, tt) * Math.sin(TAU * 4 * tt); };
    let eyes = 1; for (const b of [12.2, 14.6]) { const q = (t - b) / 0.14; if (q > 0 && q < 1) eyes = Math.abs(q * 2 - 1); }
    // it looks up at the falls as it goes, and slips once on the ice: legs splay, body dips, ears back, a wobble
    const look = sstep(11.6, 12.4, t) * (1 - sstep(14.8, 15.4, t));
    return { ph, gait: 1 - 0.5 * slip, A: 4.0 + 2.6 * slip2, yaw: 0.45 + 0.15 * look, tilt: 0.05 - 0.22 * look + 0.15 * slip2, mouth: 1, tLift: 0.05 + 0.4 * slip, wagD,
      earN: 0.1 + 0.6 * slip, earF: 0.1 + 0.5 * slip, perk: 0.6 - 0.5 * slip, eyes, wide: slip, lookY: -0.7 * look, lookX: 0.3,
      breath: t * TAU * 1.4, pitch: -0.03 + 0.12 * slip2 * Math.sin((t - 13.15) * 30), sq: 0.25 * slip2, bob: 1.5 * slip2 };
  };
  const F3LIGHT = { sky: [-0.3, -0.95], rim: 0.85, amb: 0.36, z: 4, gain: 1.5 };
  function f3Cam(t) {
    const u = eis((t - 10.45) / 4.4), v = eio((t - 14.4) / 2.55);
    const z = lerp(1.25, 1.0, u), cy = lerp(lerp(184, 118, u), -372, v), cx = lerp(186, 238, eis((t - 10.45) / 5.2)) + drift(t, 5, 1);
    return [cx, cy, z];
  }
  function f3Draw(t) {
    TAB = F3.rig; FOGT = F3FOG; SPK_SNOW = M_SNOW; SHAD.length = 0; LAMP.on = 0;
    const [cx, cy, z] = f3Cam(t), L = F3.L, oy = (p) => OY3 + 135 + (cy - 135) * p;
    const p = f3Pose(t), fwx = f3X(t), fxs = toSX(cx, z, fwx), fys = toSY(cy, z, F3G), S = F3S * z;
    const th = pendulum(t, (tt) => { foxPrep(f3Pose(tt), f3X(tt), F3G, F3S, 1, F3LIGHT); return [FOXOUT.mouth[0] / F3LS, FOXOUT.mouth[1] / F3LS]; }, 10.45);
    foxPrep(p, fxs, fys, S, 1, F3LIGHT);
    const [mx, my] = FOXOUT.mouth, LS = F3LS * z, fl0 = lanternFlame(mx, my, LS, th);
    LAMP.on = 1; LAMP.x = fl0[0]; LAMP.y = fl0[1]; LAMP.z = 0; LAMP.h = Math.max(4, (fys - fl0[1]) / z); LAMP.I = 1.15 * flick(t); LAMP.R = 62 * z; LAMP.zoom = z; LAMP.rot = th * 2;
    SHAD.push({ x: fxs - 20 * z, y: fys + 1.5 * z, rx: 32 * z, ry: 4.5 * z, a: 0.6, lamp: 1 });
    // the sky is the meadow's (heavens): placed so that at the hand-over (16.95 s, both cameras at rest) it is exactly where
    // the meadow's camera has it, and moving with this camera until then
    { const [hx, hy] = f4SkyAt(16.95), [cx0, cy0] = f3Cam(16.95), sx = hx + (cx - cx0) * 0.1, sy = hy + (cy - cy0) * 0.82;
      heavens(t, sx, sy, z, 0.25 + 0.75 * sstep(15.3, 16.8, t)); }
    comp(L.far, 220 + cx * 0.35, oy(0.88), z, 0.3, { mist: 0.2, mistY: OY3 - 110, mistH: 40 });
    RIVM.fill(0);
    comp(L.gorge, 120 + cx * 0.85, oy(0.95), z, 0.08, { custom: iceShade, cm0: M_ICE, cm1: M_ICED });
    comp(L.main, cx + 120, oy(1), z, 0, { custom: iceShade, cm0: M_RIVER, cm1: M_RIVER });
    // the falls in the river ice
    BUFR.set(BUF);
    reflectRiver(toSY(oy(0.95) - OY3, z, F3POOL), BUFR, null);
    // the kit and the lantern, then their reflections below the kit's feet
    BUFF.set(BUF);
    drawFox(p, fxs, fys, S, 1, F3LIGHT);
    drawLantern(mx, my, LS, th, { lit: 1 });
    reflectRiver(fys + 0.5 * z, BUF.slice(0), (j) => BUF[j] !== BUFF[j]);
    lanternGlow(LAMP.x, LAMP.y, z, 1);
    comp(L.fore, 120 + cx * 1.3, oy(1.08), z, 0);
    snowfall(t, cx, cy, z, { dens: 0.7 });
  }
  const F3AUR = [{ y: OY3 - 165, amp: 16, len: 95, k: 0.013, ph: 0.4, x0: 100, x1: 680, b: 1 }, { y: OY3 - 230, amp: 12, len: 80, k: 0.018, ph: 2.2, x0: 20, x1: 520, b: 0.8 }];
  const f23Trunk = (t) => { if (t > 10.6 && t < 11.45) wipeTrunk(lerp(580, -160, eio((t - 10.6) / 0.8)), 98, t, 0.8); };
  let F3FOG = null;
  BUILDERS.push(() => { F3FOG = mkTab('3a5a8a', false); });
  shot(10.8, 16.7, (lt, t) => {
    if (t < 11.2) {
      // the trunk sweeps past; behind it the woods dissolve into the gorge
      dissolve(() => f2Draw(t), () => f3Draw(t), eis((t - 10.8) / 0.4), 33);
      f23Trunk(t);
    } else f3Draw(t);
  });
