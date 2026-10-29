  /* ================================================================ 5b · The climb, 5c · the lamp room (25.3 … 25.6 – 30.0)
     Inside the tower: the curved stone wall, the iron spiral stair winding round its stone newel, slit windows full of
     storm. The kit races up, round and round (in front of the newel, then behind it), its lantern's light climbing the
     masonry with it; the camera rises with it, through the hatch in the floor, into the lamp room: tall panes all round
     with the storm beyond, the great lens dark on its pedestal, and the keeper on his stool, head bowed. The kit pops up
     out of the hatch; its light reaches him; he looks up. */
  const FI = { L: {}, rig: null, rigLit: null };
  const OYI = 320, SHAFT = 330, NEW_X = 240, STAIR_R0 = 14, STAIR_R1 = 150, WALL_R = 176;
  const TREAD_N = 33, TREAD_DY = SHAFT / (TREAD_N + 0.4), TREAD_DA = TAU / 16, TREAD_A0 = -PI / 2;
  const tread = (k) => ({ a: TREAD_A0 + k * TREAD_DA, y: SHAFT - 8 - k * TREAD_DY });
  const HATCH_X = 152, KEEP_X = 262, LENS_X = 372, LENS_Y = -100, LENS_S = 1.95;
  BUILDERS.push(() => {
    FI.rig = mkRig([0.06, 0.055, 0.08], [0.5, 0.52, 0.7], [1.0, 0.56, 0.24]);
    const L = FI.L, Hh = 960;
    // the wall, the newel and the treads behind it (back), and the treads and rail in front (front)
    L.back = mkLayer(480, Hh, { z0: -60 });
    const oy = OYI;
    for (let y = -6; y < SHAFT + 30; y++) for (let x = 0; x < 480; x++) {
      const dx = x - NEW_X, q = dx / WALL_R;
      if (Math.abs(q) >= 1) {
        // the tower cut away: the section through its thick wall (big blocks, the cut face lighter), then outside
        if (Math.abs(dx) < WALL_R + 24) { const sx = Math.abs(dx) - WALL_R, blk = ((fl(y / 12) + fl(sx / 12)) & 1), j = frac(y / 12) < 0.08 || frac(sx / 12 + 0.5 * (fl(y / 12) & 1)) < 0.07; lput(L.back, x, y + oy, M_STONE, (j ? 0.18 : 0.34 + blk * 0.05 + ih(fl(y / 12), fl(sx / 12), 604) * 0.08) - (sx > 21 ? 0.12 : 0), 30, dx < 0 ? 0.8 : -0.8, 0, 0); }
        continue;
      }
      // the curved wall: courses of dressed stone, foreshortened toward the sides; mortar; damp streaks; slit windows
      const phi = Math.asin(q), course = fl(y / 9.5), cf = frac(y / 9.5), along = (phi * WALL_R) / 15 + (course & 1) * 0.5 + ih(course, 0, 601) * 0.3, af = frac(along);
      const mortar = cf < 0.1 || af < 0.05 / Math.max(0.25, Math.cos(phi));
      const stoneV = ih(course, fl(along), 602) - 0.5;
      let s = 0.36 + 0.2 * Math.cos(phi) + stoneV * 0.12 - (mortar ? 0.13 : 0) - vn(x * 0.4, y * 0.05, 6, 603) * 0.08;
      lput(L.back, x, y + oy, M_STONE, s, 50 + 60 * (1 - Math.cos(phi)), -q * 0.95, 0, 0);
    }
    // slit windows with deep splayed reveals (the storm shows through them, drawn live): transparent here
    for (const [wx, wy] of [[150, 260], [330, 165], [168, 70]]) {
      for (let y = wy - 16; y < wy + 16; y++) for (let x = wx - 9; x <= wx + 9; x++) {
        const dx = x - wx, top = wy - 12 + Math.abs(dx) * 0.3, inn = Math.abs(dx) < 2.5 && y > wy - 10 + Math.abs(dx);
        if (inn && y < wy + 13) { const i = (y + oy) * 480 + x; L.back.M[i] = 0; continue; }
        if (Math.abs(dx) < 8 && y > top && y < wy + 15) lput(L.back, x, y + oy, M_STONE, 0.14 + (dx < 0 ? 0.08 : -0.02) + (y > wy + 12 ? 0.1 : 0), 70, dx < 0 ? 0.6 : -0.6, 0, 0);
      }
    }
    // the door at the foot (an arch, ajar, the storm outside)
    for (let y = SHAFT - 44; y < SHAFT; y++) for (let x = 84; x < 122; x++) {
      const dx = x - 103, top = SHAFT - 30 - Math.sqrt(Math.max(0, 19 * 19 - dx * dx)) * 0.75;
      if (y < top) continue;
      if (Math.abs(dx) < 15) { const i = (y + oy) * 480 + x; if (dx > 4) lput(L.back, x, y + oy, M_WOOD, 0.22 + (frac(dx / 5) < 0.15 ? -0.08 : 0), 40, -0.6, 0, 0); else L.back.M[i] = 0; }
      else lput(L.back, x, y + oy, M_STONE, 0.32, 45, 0, 0, 0);
    }
    // the lamp room: floorboards (with the hatch), a parapet, the window frames (panes transparent: the storm is live)
    for (let y = -6; y < 6; y++) for (let x = 0; x < 480; x++) {
      if (Math.abs(x - HATCH_X) < 26 && y > -6) { if (y > 2) continue; }
      lput(L.back, x, y + oy, M_WOOD, (y < -4 ? 0.5 : 0.28) + (frac(x / 23) < 0.06 ? -0.12 : 0) + (vn(x * 0.3, y, 4, 611) - 0.5) * 0.1, 0, 0, y < -4 ? -1 : 0.4, 0);
    }
    for (let y = -250; y < -6; y++) for (let x = 0; x < 480; x++) {
      let m = 0, s = 0, nx = 0, ny = 0;
      if (y > -48) { m = M_STONE; s = 0.26 + (y < -44 ? 0.2 : 0) + (frac(x / 30 + (fl(y / 10) & 1) * 0.5) < 0.04 || frac(y / 10) < 0.1 ? -0.07 : 0); ny = y < -44 ? -1 : 0; }    // parapet
      else if (y < -222) { m = M_IRON; s = 0.16 + (frac(x / 40) < 0.08 ? 0.1 : 0); }                       // the roof's iron ribs
      else {
        const mul = frac(x / 96 + 0.5), bar = Math.min(mul, 1 - mul) * 96 < 3.2, transom = Math.abs(y + 136) < 2.5 || y < -216 || y > -54;
        if (bar || transom) { m = M_IRON; s = 0.2 + (bar && mul < 0.5 ? 0.1 : 0); nx = bar ? (mul < 0.5 ? -0.7 : 0.7) : 0; }
      }
      if (m) lput(L.back, x, y + oy, m, s, 30, nx, ny, 0);
    }
    // the lamp room, furnished: wood panelling under the glass with a brass rail; frost in the panes' corners; the
    // gallery railing outside; an oilskin coat on a hook and the ship's bell on the mullions; a desk with the open log,
    // an inkwell, a mug and an oil can; a little iron stove with its kettle and a red-glowing grate; an oil barrel
    for (let y = -48; y < -6; y++) for (let x = 0; x < 480; x++) {
      if (y < -45) { lput(L.back, x, y + oy, M_BRASSM, 0.45 + (y < -47 ? 0.3 : 0), 20, 0, y < -47 ? -1 : 0, 0); continue; }
      const pw = 40, px = frac(x / pw), inset = px > 0.1 && px < 0.9 && y > -40 && y < -12, edge = inset && (px < 0.14 || px > 0.86 || y < -37 || y > -15);
      lput(L.back, x, y + oy, M_WOOD, 0.3 + (inset ? -0.05 : 0.04) + (edge ? (px < 0.14 || y < -37 ? -0.08 : 0.08) : 0) + (vn(x * 0.5, y * 0.08, 3, 612) - 0.5) * 0.08, 20, 0, 0, 0);
    }
    for (let y = -216; y < -54; y++) for (let x = 0; x < 480; x++) {
      const i = (y + oy) * 480 + x; if (L.back.M[i]) continue;
      const mul = frac(x / 96 + 0.5), dmul = Math.min(mul, 1 - mul) * 96, dtop = Math.min(Math.abs(y + 136), y + 216, -54 - y);
      const frost = Math.min(dmul, dtop); if (frost < 9 && ih(x, y, 613) < Math.pow((9 - frost) / 9, 1.6) * 0.55) { lput(L.back, x, y + oy, M_SNOW, 0.5 + ih(x, y, 614) * 0.3, 30, 0, 0, 0); continue; }
      if (Math.abs(y + 78) < 1.2 || Math.abs(y + 64) < 0.8 || (Math.abs(frac(x / 24) - 0.5) < 0.04 && y > -80)) lput(L.back, x, y + oy, M_IRON, 0.12, 200, 0, 0, 0);   // the gallery rail beyond the glass
    }
    const coat = (x, y) => { const cx = 48, top = -170; if (y < top || y > -76) return false; const hw = 4 + (y - top) * 0.13 + Math.sin((y - top) * 0.2) * 1.5; return Math.abs(x - cx) < hw; };
    for (let y = -178; y < -74; y++) for (let x = 20; x < 80; x++) {
      if (Math.abs(x - 48) < 2 && y < -170) { lput(L.back, x, y + oy, M_IRON, 0.3, 15, 0, 0, 0); continue; }
      if (coat(x, y)) { const fold = Math.sin((x - 48) * 0.6 + y * 0.05), sl = Math.abs(x - 48) > 6 + (y + 170) * 0.05; lput(L.back, x, y + oy, M_CAP, 0.28 + fold * 0.08 + (x < 46 ? 0.08 : -0.06) - (sl ? 0.06 : 0), 15, (x - 48) / 12, 0, 0); }
    }
    for (let y = -150; y < -120; y++) for (let x = 268; x < 296; x++) {
      const dx = x - 282, v = y + 150;
      if (Math.abs(dx) < 1 && v < 5) lput(L.back, x, y + oy, M_IRON, 0.3, 15, 0, 0, 0);
      else if (v >= 5 && Math.abs(dx) < 3 + (v - 5) * 0.42 && v < 26) lput(L.back, x, y + oy, M_BRASSM, 0.35 - dx * 0.04 + (v > 24 ? 0.15 : 0), 15, dx / 10, 0, 0);
      else if (v >= 26 && v < 29 && Math.abs(dx) < 1.4) lput(L.back, x, y + oy, M_BRASSM, 0.5, 15, 0, 0, 0);
    }
    for (let y = -40; y < -6; y++) for (let x = 30; x < 122; x++) {                 // the desk and what is on it
      const dx = x - 76;
      if (y >= -34 && y < -30 && Math.abs(dx) < 44) { lput(L.back, x, y + oy, M_WOOD, y < -33 ? 0.55 : 0.32, 12, 0, y < -33 ? -1 : 0, 0); continue; }
      if (y >= -30 && (Math.abs(dx + 39) < 2 || Math.abs(dx - 39) < 2)) { lput(L.back, x, y + oy, M_WOOD, 0.24, 12, 0, 0, 0); continue; }
      if (y >= -30 && y < -24 && Math.abs(dx) < 36) { lput(L.back, x, y + oy, M_WOOD, 0.2 + (Math.abs(dx) < 1 ? -0.08 : 0) + (Math.abs(dx - 18) < 2 && y > -28 ? 0.25 : 0), 12, 0, 0, 0); continue; }
      if (y < -34 && y >= -37 && dx > -30 && dx < -2) { const page = dx < -16 ? -16 - dx : dx + 16, line = frac((y + 37) / 1.5) < 0.3 && page > 2; lput(L.back, x, y + oy, M_WOOLC, 0.6 - (Math.abs(dx + 16) < 0.8 ? 0.2 : 0) - (line ? 0.18 : 0), 12, 0, -1, 0); continue; }
      if (y < -34 && y >= -39 && Math.abs(dx - 6) < 2.5) { lput(L.back, x, y + oy, M_IRON, 0.2 + (dx < 6 ? 0.1 : 0), 12, 0, 0, 0); continue; }      // the inkwell
      if (y < -34 && y >= -36 && Math.abs(dx - 9) < 0.5) { lput(L.back, x, y + oy, M_WOOLC, 0.7, 12, 0, 0, 0); }
      if (y < -34 && y >= -40 && Math.abs(dx - 17) < 3) { lput(L.back, x, y + oy, M_WOOL, 0.4 - (dx - 17) * 0.05 + (y < -39 ? 0.2 : 0), 12, 0, 0, 0); continue; }   // the mug
      if (y < -34 && y >= -44 && dx > 26 && dx < 36) { const hw = 4 - Math.max(0, -40 - y) * 0.7; if (Math.abs(dx - 31) < hw) lput(L.back, x, y + oy, M_BRASSM, 0.35 - (dx - 31) * 0.05, 12, (dx - 31) / 5, 0, 0); else if (y < -40 && dx > 33 && Math.abs(y + 42 - (dx - 33) * 0.4) < 0.7) lput(L.back, x, y + oy, M_BRASSM, 0.4, 12, 0, 0, 0); }
    }
    for (let y = -60; y < -6; y++) for (let x = 410; x < 480; x++) {                // the stove, its pipe, the kettle, the barrel
      const sx = x - 436;
      if (Math.abs(sx) < 3 && y < -40) { lput(L.back, x, y + oy, M_IRON, 0.2 + (sx < 0 ? 0.1 : 0), 14, sx / 3, 0, 0); continue; }
      if (Math.abs(sx) < 13 && y >= -40 && y < -12) {
        const grate = Math.abs(sx) < 7 && y > -28 && y < -17, bars = Math.abs(frac(sx / 3) - 0.5) < 0.15;
        if (grate) { L.back.M[(y + oy) * 480 + x] = 0; continue; }
        lput(L.back, x, y + oy, M_IRON, 0.18 + (sx < -8 ? 0.12 : 0) + (y < -38 ? 0.15 : 0) + (bars && Math.abs(y + 22) < 6 ? 0 : 0), 14, sx / 13, 0, 0); continue;
      }
      if (Math.abs(sx) < 11 && y >= -12 && (Math.abs(sx + 9) < 1.5 || Math.abs(sx - 9) < 1.5)) { lput(L.back, x, y + oy, M_IRON, 0.16, 14, 0, 0, 0); continue; }
      const kx = sx + 2, ky = y + 46; if (Math.hypot(kx / 7, ky / 5) < 1 && y < -40) { lput(L.back, x, y + oy, M_IRON, 0.26 - kx * 0.03 + (ky < -3 ? 0.12 : 0), 14, kx / 7, ky / 5, 0); continue; }
      if (y < -48 && y > -53 && kx > 5 && Math.abs(y + 50 - (kx - 5) * 0.5) < 0.8) { lput(L.back, x, y + oy, M_IRON, 0.3, 14, 0, 0, 0); continue; }
      const bx = x - 466; if (Math.abs(bx) < 11 && y > -34) { const st = Math.abs(y + 26) < 1 || Math.abs(y + 12) < 1; lput(L.back, x, y + oy, st ? M_IRON : M_WOOD, (st ? 0.28 : 0.22 + 0.2 * Math.sqrt(Math.max(0, 1 - (bx / 11) ** 2))) - bx * 0.01, 14, bx / 11, 0, 0); }
    }
    // the lens's pedestal: an iron column with a brass collar
    for (let y = -46; y < -6; y++) for (let x = LENS_X - 18; x <= LENS_X + 18; x++) {
      const w = y > -12 ? 18 : y > -40 ? 11 : 16, q = (x - LENS_X) / w; if (Math.abs(q) > 1) continue;
      lput(L.back, x, y + oy, y < -40 ? M_BRASSM : M_IRON, 0.25 + 0.3 * Math.sqrt(1 - q * q) - q * 0.15, 10, q * 0.9, 0, 0);
    }
  });
  // outside the windows and the slits: the storm (dark sky, the faint sea, driving snow), live
  function outside(cx, cy, z, t, beamOut) {
    for (let Y = ROW0; Y <= ROW1; Y++) {
      const wy = toLY(cy, z, Y), o = Y * W;
      for (let X = 0; X < W; X++) {
        const wx = toLX(cx, z, X), b = BAYF[((Y & 7) << 3) | (X & 7)];
        if (wy > cy + 6) {                                      // the sea far below (its horizon at eye level): dark swells, whitecaps
          const sw = (wy - cy - 6) * 0.16 - t * 0.7 + n1(wx * 0.01, 622) * 1.5, f = frac(sw);
          BUF[o + X] = f < 0.06 && vn(wx * 0.3, wy, 3, 624) > 0.55 ? 245 : f < 0.4 ? 241 : 240;
          continue;
        }
        // torn storm cloud racing past, lighter toward the horizon
        const n = vn(wx * 0.7 + t * 34, wy * 1.6, 22, 621) * 0.6 + vn(wx * 1.6 + t * 52, wy * 3, 8, 625) * 0.4;
        const v = n * 0.85 + clamp((wy + 220) / 130, 0, 1) * 0.3 + (b - 0.5) * 0.12;
        BUF[o + X] = v > 0.74 ? 244 : v > 0.58 ? 243 : v > 0.42 ? 242 : 241;
      }
    }
    for (let k = 0; k < 110; k++) {                              // snow driving past the glass in the wind
      const sp = 0.35 + ih(k, 2, 623) * 0.4, x = frac(ih(k, 1, 623) + t * sp) * 540 - 30, y = frac(ih(k, 3, 623) + t * sp * 0.45) * 260 + ROW0 - 20;
      const c = ih(k, 4, 623) < 0.3 ? 247 : 246;
      P(x, y, c); P(x - 1, y - 0.5, 245); if (ih(k, 5, 623) < 0.4) P(x - 2, y - 1, 244);
    }
  }
  // the stove's fire through its grate: embers breathing red and gold, a faint warm glow round it
  function stoveGlow(cx, cy, z, t) {
    const X0 = fl(toSX(cx, z, 429)), X1 = Math.ceil(toSX(cx, z, 443)), Y0 = fl(toSY(cy, z, -28)), Y1 = Math.ceil(toSY(cy, z, -17));
    if (X1 < 0 || X0 >= W || Y1 < ROW0 || Y0 > ROW1) return;
    for (let Y = Math.max(ROW0, Y0); Y <= Math.min(ROW1, Y1); Y++) for (let X = Math.max(0, X0); X <= Math.min(W - 1, X1); X++) {
      const lx = toLX(cx, z, X) - 436, ly = toLY(cy, z, Y), bars = Math.abs(frac(lx / 3) - 0.5) < 0.17;
      const e = 0.5 + 0.5 * Math.sin(lx * 0.9 + t * 3.1) * Math.sin(ly * 0.7 - t * 2.3) + (ly + 17) * 0.06;
      BUF[Y * W + X] = bars ? 195 : e > 0.85 ? 182 : e > 0.55 ? 180 : e > 0.3 ? 178 : 177;
    }
    glow(toSX(cx, z, 436), toSY(cy, z, -22), 26 * z, T_WARM, 0.22 + 0.05 * Math.sin(t * 5));
  }
  // the stair, live (so the half in front can be cut away clear of the kit). Each tread is a cast-iron wedge seen a little
  // from above or below (by its height against the camera's): its top (a cast diamond pattern) or its ribbed underside,
  // its nosing edge catching the lantern, two balusters at its outer end; the handrail runs over them. pass: 0 the back
  // half, 1 the front half (cut short unless near kFox)
  const TSTP = new Uint32Array(NP); let tStamp = 0;
  const TSIN = new Float32Array(1024), TCOS = new Float32Array(1024), TTH = new Float32Array(1024);
  function stairLive(cx, cy, z, pass, kFox) {
    for (let k = 0; k < TREAD_N; k++) {
      const T = tread(k), a0 = T.a, a1 = T.a + TREAD_DA * 0.92, cm = Math.cos(T.a + TREAD_DA * 0.46), front = cm > 0;
      if ((pass === 1) !== front) continue;
      const near = Math.abs(k - kFox) < 2.6, r1 = front && !near ? 58 : STAIR_R1;
      const Yt = toSY(cy, z, T.y); if (Yt < ROW0 - 30 || Yt > ROW1 + 30) continue;
      const kk = clamp((T.y - cy) * 0.0018, -0.14, 0.14), above = kk < 0;      // seen from above (its top) or from below
      // the slab: rows of (r, angle) samples; the top/underside, then its leading edge's thickness
      const nA = Math.ceil((a1 - a0) * r1 * z * 1.6) + 2; tStamp++;
      for (let ai = 0; ai <= nA; ai++) { const th = lerp(a0, a1, ai / nA); TSIN[ai] = Math.sin(th); TCOS[ai] = Math.cos(th); TTH[ai] = th; }
      for (let ri = 0; ; ri++) {
        const r = STAIR_R0 + ri * 0.6 / z; if (r > r1) break;
        const fade = front && !near ? 1 - (r - STAIR_R0) / (58 - STAIR_R0) : 1;
        for (let ai = 0; ai <= nA; ai++) {
          const th = TTH[ai], sx = NEW_X + r * TSIN[ai], dz = r * TCOS[ai], X = fl(toSX(cx, z, sx)), Y = fl(Yt - dz * kk * z);
          if (X < 0 || X >= W || Y < ROW0 || Y > ROW1) continue;
          const pi = Y * W + X; if (TSTP[pi] === tStamp) continue; TSTP[pi] = tStamp;
          if (fade < 1 && BAYF[((Y & 7) << 3) | (X & 7)] > fade * 1.4) continue;
          const pat = (Math.abs(frac(r / 6 + th * 3) - 0.5) < 0.12 || Math.abs(frac(r / 6 - th * 3) - 0.5) < 0.12) ? -0.07 : 0;
          const rib = !above && Math.abs(frac((th - a0) / (a1 - a0) * 3) - 0.5) < 0.12 ? 0.08 : 0;
          const s0 = above ? 0.52 + pat + (r > r1 - 3 ? 0.16 : 0) - (r < STAIR_R0 + 6 ? 0.12 : 0) : 0.24 + rib;
          BUF[Y * W + X] = mc(M_IRON, s0, lampAt(X, Y, -dz * 0.5, 0, above ? -1 : 0.9), X, Y);
        }
      }
      // the leading edge (the nosing), three units thick, lit face on
      const thick = 3 * z;
      for (let ri = 0; ; ri++) {
        const r = STAIR_R0 + ri * 0.5 / z; if (r > r1) break;
        const th = a0, sx = NEW_X + r * Math.sin(th), dz = r * Math.cos(th), X = fl(toSX(cx, z, sx)), Yb = Yt - dz * kk * z;
        if (X < 0 || X >= W) continue;
        const fade = front && !near ? 1 - (r - STAIR_R0) / (58 - STAIR_R0) : 1;
        for (let dd = 0; dd < thick; dd++) { const Y = fl(Yb + dd); if (Y < ROW0 || Y > ROW1) continue; if (fade < 1 && BAYF[((Y & 7) << 3) | (X & 7)] > fade * 1.4) continue; BUF[Y * W + X] = mc(M_IRON, dd < 1 ? 0.48 : 0.22 - dd * 0.02, lampAt(X, Y, -dz * 0.5, 0, 0), X, Y); }
      }
      // two balusters at the outer end, up to the handrail
      if (r1 === STAIR_R1) for (const f of [0.2, 0.75]) {
        const th = lerp(a0, a1, f), sx = NEW_X + STAIR_R1 * Math.sin(th), dz = STAIR_R1 * Math.cos(th), X = toSX(cx, z, sx), Yb = Yt - dz * kk * z;
        for (let d = 0; d < 14 * z; d++) { const YY = fl(Yb - d); if (YY < ROW0 || YY > ROW1) continue; for (let w = 0; w < Math.max(1, fl(1.4 * z)); w++) { const XX = fl(X) + w; if (XX < 0 || XX >= W) continue; BUF[YY * W + XX] = mc(M_IRON, w === 0 ? 0.36 : 0.18, lampAt(XX, YY, -dz * 0.5, w === 0 ? -0.6 : 0.6, 0), XX, YY); } }
      }
    }
    // the handrail: a helix over the balusters, two px thick, its top catching the light
    for (let a = TREAD_A0; a < TREAD_A0 + TREAD_N * TREAD_DA; a += 0.004 / z) {
      const ca = Math.cos(a); if ((pass === 1) !== (ca > 0)) continue;
      const k = (a - TREAD_A0) / TREAD_DA; if (pass === 1 && Math.abs(k - kFox) > 3) continue;
      const hy = SHAFT - 8 - k * TREAD_DY - 14, kk = clamp((hy - cy) * 0.0018, -0.14, 0.14), dz = STAIR_R1 * ca;
      const X = fl(toSX(cx, z, NEW_X + STAIR_R1 * Math.sin(a))), Y = fl(toSY(cy, z, hy) - dz * kk * z);
      for (let d = 0; d < Math.max(2, fl(2 * z)); d++) { const YY = Y + d; if (X >= 0 && X < W && YY >= ROW0 && YY <= ROW1) BUF[YY * W + X] = mc(M_IRON, d === 0 ? 0.5 : 0.18, lampAt(X, YY, -dz * 0.5, 0, d === 0 ? -0.8 : 0.4), X, YY); }
    }
  }
  // the lantern throws the stair's shadows across the curved wall behind: each tread's outer edge and its balusters,
  // projected from the flame onto the masonry (so the shadows sweep round as the kit climbs)
  function stairShadows(cx, cy, z, kFox) {
    if (!LAMP.on) return;
    const Lx = toLX(cx, z, LAMP.x), Ly = toLY(cy, z, LAMP.y), Lz = LAMP.z > 30 ? -60 : 40;
    const put = (wx, wy, a) => { const X = fl(toSX(cx, z, wx)), Y = fl(toSY(cy, z, wy)); if (X < 0 || X >= W || Y < ROW0 || Y > ROW1) return; const i = Y * W + X; const l = lampAt(X, Y, -100, 0, 0); if (l < 0.15) return; const lv = clamp(fl(a * 8 * Math.min(1, l * 1.5)), 0, 6); if (lv > 0) BUF[i] = T_DARK[lv][BUF[i]]; };
    for (let k = Math.max(0, fl(kFox - 5)); k < Math.min(TREAD_N, kFox + 6); k++) {
      const T = tread(k);
      for (let f = 0; f <= 1; f += 0.012) {
        const th = T.a + TREAD_DA * 0.92 * f;
        for (const [r, h, a] of [[STAIR_R1, 0, 0.34], [STAIR_R1, -14, 0.3]]) {
          const px = NEW_X + r * Math.sin(th), pz = r * Math.cos(th), py = T.y + h;
          if (pz > Lz - 2) continue;
          // the wall point behind along the ray from the flame: x on the wall's circle, depth behind
          const dirx = px - Lx, diry = py - Ly, dirz = pz - Lz;
          let s = 1.2; for (let it = 0; it < 4; it++) { const wx = Lx + dirx * s - NEW_X, wz = Lz + dirz * s; const rr = Math.hypot(wx, wz); s *= WALL_R / Math.max(1, rr); }
          const wx = Lx + dirx * s, wy = Ly + diry * s; if (Lz + dirz * s > 0) continue;
          put(wx, wy, a);
        }
      }
      // the balusters' long shadows
      for (const f of [0.2, 0.75]) {
        const th = T.a + TREAD_DA * 0.92 * f, px = NEW_X + STAIR_R1 * Math.sin(th), pz = STAIR_R1 * Math.cos(th);
        if (pz > Lz - 2) continue;
        for (let h = 0; h < 14; h += 0.6) {
          const py = T.y - h, dirx = px - Lx, diry = py - Ly, dirz = pz - Lz;
          let s = 1.2; for (let it = 0; it < 4; it++) { const wx = Lx + dirx * s - NEW_X, wz = Lz + dirz * s; s *= WALL_R / Math.max(1, Math.hypot(wx, wz)); }
          put(Lx + dirx * s, Ly + diry * s, 0.3);
        }
      }
    }
  }
  // the rope handrail fixed to the wall (the back half), sagging between its iron eyes
  function wallRope(cx, cy, z) {
    for (let a = TREAD_A0; a < TREAD_A0 + TREAD_N * TREAD_DA; a += 0.003 / z) {
      const ca = Math.cos(a); if (ca > -0.05) continue;
      const k = (a - TREAD_A0) / TREAD_DA, seg = frac(k * 2), sag = Math.sin(seg * PI) * 2.2;
      const X = fl(toSX(cx, z, NEW_X + 172 * Math.sin(a))), Y = fl(toSY(cy, z, SHAFT - 8 - k * TREAD_DY - 16 + sag));
      if (X < 0 || X >= W || Y < ROW0 || Y > ROW1 - 1) continue;
      const tw = frac(a * 60) < 0.5;
      BUF[Y * W + X] = mc(M_WOOD, tw ? 0.4 : 0.28, lampAt(X, Y, -150, 0, -0.5), X, Y); BUF[(Y + 1) * W + X] = mc(M_WOOD, 0.14, 0, X, Y + 1);
      if (seg < 0.02 && Y + 3 <= ROW1) for (let d = -1; d <= 2; d++) BUF[(Y + d) * W + X] = mc(M_IRON, 0.35, 0, X, Y + d);
    }
  }
  // cold storm light falling in through the slit windows: pale shafts slanting down across the shaft, and snow in them
  function slitShafts(cx, cy, z, t) {
    for (const [wx, wy, dir] of [[150, 260, 1], [330, 165, -1], [168, 70, 1]]) {
      const X0 = Math.max(0, fl(toSX(cx, z, Math.min(wx, wx + dir * 100) - 20))), X1 = Math.min(W - 1, Math.ceil(toSX(cx, z, Math.max(wx, wx + dir * 100) + 20)));
      const Y0 = Math.max(ROW0, fl(toSY(cy, z, wy - 12))), Y1 = Math.min(ROW1, Math.ceil(toSY(cy, z, wy + 90)));
      for (let Y = Y0; Y <= Y1; Y++) for (let X = X0; X <= X1; X++) {
        const px = toLX(cx, z, X) - wx, py = toLY(cy, z, Y) - (wy - 4), along = (px * dir * 0.8 + py * 0.6), across = (-px * dir * 0.6 + py * 0.8);
        if (along < 0 || along > 110) continue;
        const wdt = 4 + along * 0.1, e = (1 - Math.abs(across) / wdt) * (1 - along / 110) * 0.7; if (e <= 0) continue;
        const b = BAYF[((Y & 7) << 3) | (X & 7)]; if (b < e) BUF[Y * W + X] = T_WH[e > 0.45 && b < e * 0.5 ? 3 : 2][BUF[Y * W + X]];
      }
      for (let q = 0; q < 10; q++) { const u = frac(ih(q, wx, 631) + t * 0.5), d = u * 100, x = wx + dir * d * 0.75 + (ih(q, 3, 631) - 0.5) * 10, y = wy - 4 + d * 0.55 + (ih(q, 4, 631) - 0.5) * 8; P(toSX(cx, z, x), toSY(cy, z, y), u < 0.6 ? 194 : 246); }
    }
  }
  function newelLive(cx, cy, z) {
    const X0 = fl(toSX(cx, z, NEW_X - 13)), X1 = Math.ceil(toSX(cx, z, NEW_X + 13));
    for (let Y = ROW0; Y <= ROW1; Y++) {
      const wy = toLY(cy, z, Y); if (wy < -4 || wy > SHAFT + 30) continue;
      for (let X = X0; X <= X1; X++) { const q = (toLX(cx, z, X) - NEW_X) / 13; if (Math.abs(q) > 1) continue; const ring = frac(wy / 21) < 0.08; BUF[Y * W + X] = mc(M_STONE, 0.3 + 0.28 * Math.sqrt(1 - q * q) - q * 0.14 - (ring ? 0.1 : 0), lampAt(X, Y, 0, q * 0.9, 0), X, Y); }
    }
  }
  const climbA = (t) => { const u = clamp((t - 25.65) / 2.6, 0, 1); return TREAD_A0 + eis(u) * 0.12 * (TREAD_N - 1) * TREAD_DA + u * 0.88 * (TREAD_N - 1) * TREAD_DA; };
  const climbK = (t) => (climbA(t) - TREAD_A0) / TREAD_DA;
  const fiPose = (t, dir) => {
    const ph = t * 3.0;
    const wagD = (u) => { const tt = t - u * 0.12; return 0.12 * Math.sin(TAU * 1.6 * tt); };
    return { ph, gait: 1, A: 3.6, yaw: 0.35 + 0.5 * (1 - Math.abs(dir)), tilt: -0.1, pitch: -0.22, mouth: 1, tLift: 0.1, wagD, earN: 0.2, earF: 0.2, perk: 0.5, breath: t * TAU * 2, bob: -1.5 * Math.abs(Math.sin(ph * PI)) };
  };
  const FILIGHT = { sky: [-0.4, -0.9], rim: 0.4, amb: 0.3, z: 0, gain: 1.6 };
  // the kit on the stair at time t: world position, facing, how near (+ in front of the newel)
  function fiFox(t) {
    const a = climbA(t), k = climbK(t), y = SHAFT - 8 - k * TREAD_DY, r = 100;
    const x = NEW_X + r * Math.sin(a), dir = Math.cos(a + TREAD_DA * 0.46);
    return { x, y, f: dir >= 0 ? 1 : -1, dir, front: dir > 0 };
  }
  function fiCam(t) {
    const fx = fiFox(Math.min(t, 28.25));
    const cyA = clamp(fx.y - 20, -20, SHAFT - 100), rise = eio((t - 28.0) / 1.0);
    return [240 + drift(t, 11, 1.2), lerp(cyA, LENS_Y + 2, rise), 1];
  }
  function fiDraw(t) {
    TAB = FI.rig; FOGT = F5FOG; SPK_SNOW = 0; SHAD.length = 0; LAMP.on = 0;
    const [cx, cy, z] = fiCam(t), L = FI.L;
    outside(cx, cy, z, t);
    // the kit: on the stair, then up through the hatch onto the floor, a few steps toward the keeper
    let fx, fy, f = 1, front = true, p;
    if (t < 28.25) { const F = fiFox(t); fx = F.x; fy = F.y; f = F.f; front = F.front; p = fiPose(t, F.dir); }
    else {
      const u = eis((t - 28.25) / 0.45), w = eoc((t - 28.7) / 0.7);
      fx = lerp(fiFox(28.25).x, HATCH_X + 4, u) + 46 * w; fy = lerp(fiFox(28.25).y, 0, u) - 8 * bump(28.25, 28.75, t);
      f = 1; front = true;
      p = roomFoxPose(t);
    }
    const fxs = toSX(cx, z, fx), fys = toSY(cy, z, fy), S = 1.22 * z, LS = 1.02 * S;
    foxPrep(p, fxs, fys, S, f, FILIGHT);
    const th = 0.25 * Math.sin(t * 6.2) * (t < 28.7 ? 1 : 0.4) * f;
    const [mx, my] = FOXOUT.mouth, fl0 = lanternFlame(mx, my, LS, th);
    LAMP.on = 1; LAMP.x = fl0[0]; LAMP.y = fl0[1]; LAMP.z = front ? 0 : 60; LAMP.h = 10; LAMP.I = 1.25 * flick(t); LAMP.R = 70; LAMP.zoom = 1; LAMP.rot = th * 2;
    comp(L.back, 240, OYI + cy, z, 0);
    stoveGlow(cx, cy, z, t);
    const kF = t < 28.25 ? climbK(t) : 99;
    if (t < 28.4) { slitShafts(cx, cy, z, t); wallRope(cx, cy, z); stairShadows(cx, cy, z, Math.min(kF, TREAD_N)); }
    const drawKit = () => { drawFox(p, fxs, fys, S, f, Object.assign({}, FILIGHT, { z: front ? 4 : 64 })); drawLantern(mx, my, LS, th, { lit: 1 }); };
    stairLive(cx, cy, z, 0, kF);
    if (!front) drawKit();                                        // (behind the newel on the far half of the turn)
    newelLive(cx, cy, z);
    stairLive(cx, cy, z, 1, kF);
    // the lamp room's furniture and its keeper (above the floor)
    if (toSY(cy, z, 0) > ROW0) {
      drawLens(toSX(cx, z, LENS_X), toSY(cy, z, LENS_Y), LENS_S * z, { lit: 0, rot: 0.3 });
      keeperAt(t, cx, cy, z);
    }
    if (front) drawKit();
    lanternGlow(LAMP.x, LAMP.y, z, 1);
    // the room's dark corners
    if (t < 28.25) for (let Y = ROW0; Y <= ROW1; Y++) for (let X = 0; X < W; X += 1) { const e = Math.abs(X - 240) / 240; if (e > 0.72 && bay(X, Y) < (e - 0.72) * 2.4) BUF[Y * W + X] = T_DARK[5][BUF[Y * W + X]]; }
  }
  // the kit once it is up in the room: it pops out, trots to the keeper's knee, looks up at him, tail going
  function roomFoxPose(t) {
    const ph = t * 2.6, walk = sstep(28.6, 28.8, t) * (1 - sstep(29.3, 29.5, t));
    const wagD = (u) => { const tt = t - u * 0.15; return 0.18 * Math.sin(TAU * 2.4 * tt) + 0.06 * Math.sin(TAU * 1.1 * tt); };
    let eyes = 1; for (const b of [29.9]) { const q = (t - b) / 0.14; if (q > 0 && q < 1) eyes = Math.abs(q * 2 - 1); }
    return { ph, gait: walk, A: 3.4 * walk, yaw: 0.5 + 0.2 * sstep(29.3, 29.7, t), tilt: -0.28 * sstep(29.2, 29.6, t), mouth: 1, tLift: 0.25, wagD, earN: 0.05, earF: 0.05, perk: 0.9, eyes, lookY: -0.8 * sstep(29.2, 29.6, t), lookX: 0.5, breath: t * TAU * 1.2, sit: 0.6 * sstep(29.4, 29.9, t) };
  }
  // the keeper in the lamp room: slumped, sad; the light reaches him; he looks up; hope
  function keeperAt(t, cx, cy, z) {
    const look = sstep(28.95, 29.35, t), hope = sstep(29.5, 30.2, t);
    const o = { lean: 0.32 - 0.22 * look, head: 0.55 - 0.75 * look, look: look, brow: 0.0 + 0.9 * hope, smile: -0.8 + 1.4 * hope, eyes: 1, handR: null, handL: null };
    let eb = 1; for (const b of [29.45]) { const q = (t - b) / 0.16; if (q > 0 && q < 1) eb = Math.abs(q * 2 - 1); }
    o.eyes = eb;
    return drawKeeper(toSX(cx, z, KEEP_X), toSY(cy, z, 0), 2.05 * z, -1, o, { sky: [-0.4, -0.9], amb: 0.3, z: 10, gain: 1.4 });
  }
  shot(25.3, 30.0, (lt, t) => {
    if (t < 25.8) dip(() => f5Draw(t), () => fiDraw(t), (t - 25.3) / 0.5);
    else fiDraw(t);
  });
