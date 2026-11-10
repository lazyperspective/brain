  /* ================================================================ part V: the worlds behind the sky
     Each is drawn its own way and in its own colours: the dawn above the cloud (paint), the ocean hanging overhead with
     its teeth (cold teal), the white void (black ink line, boiling like a drawing), the folded city (teal night, amber
     windows), the cathedral inside the dead sun (obsidian and dark fire), the night between the halves (indigo, a moon),
     and the world as Dawnbreak sees it: black, drawn in lines of light, with a burning horizon. */
  const SKY5 = [3, 4, 5, 6, 7, 133, 132, 130, 131, 15, 16];
  // the dawn above the cloud sea: hz the horizon, ox a drift; the sun at (sunX, sunY)
  function w5Dawn(t, ox, hz, sunX, sunY, o) {
    o = o || {};
    gradient(LB, hz + 6, SKY5);
    for (let k = 0; k < 46; k++) { const x = ih(k, 1, 8001) * W, y = LB + ih(k, 2, 8001) * 62, tw = frac(ih(k, 3, 8001) + t * 0.5); if (tw < 0.75) P(x, y, y < LB + 30 && tw < 0.2 ? 21 : 19); }
    // high cirrus, lit rose from under
    for (let k = 0; k < 10; k++) {
      const y0 = LB + 16 + ih(k, 1, 8002) * 86, L = 70 + ih(k, 2, 8002) * 150, x0 = ((ih(k, 3, 8002) * 760 - ox * (0.12 + 0.1 * ih(k, 4, 8002)) - t * 2) % 760 + 760) % 760 - 180, th = 2 + fl(ih(k, 5, 8002) * 3);
      for (let q = 0; q < th; q++) for (let x = 0; x < L; x++) { const u = x / L, e = Math.sin(u * PI), yy = y0 + q + Math.sin(x * 0.05 + k) * 2; if (bay(fl(x0 + x), fl(yy)) < e * (0.75 - q * 0.12) * (0.5 + 0.5 * vn(x0 + x + ox * 0.1, k * 9, 14, 8003))) P(x0 + x, yy, q === th - 1 ? (y0 > LB + 70 ? 131 : 130) : y0 > LB + 60 ? 132 : 133); }
    }
    const sk = o.sunR || 1;
    light(sunX, sunY, 200 * sk, L_WARM, 0.5);
    discF(sunX, sunY, 22 * sk, 15); discF(sunX, sunY, 18 * sk, 16); discF(sunX - 4 * sk, sunY - 4 * sk, 9 * sk, 22);
    z5GodRays(sunX, sunY, 7, t * 0.15, T_WARM, 0.42, 380);
    cloudBank(hz + 8, 22, 80, 5051, ox * 0.5, CLOUD_SUN, false);
    if (!o.noNear) cloudBank(hz + 44, 30, 60, 5052, ox, CLOUD_NEAR, false);
  }
  // the first world behind the sky: the dark ocean hangs overhead, upside down, its rock spires pointing down like teeth.
  // oy: how far the camera has fallen (the teeth slide up past it); o.hole: [x, amt] the breach they fell through, o.lx: light
  const TEAL = [124, 125, 126, 127, 128, 129];
  function w5Ocean(t, ox, oy, o) {
    o = o || {}; oy = oy || 0;
    const top = LB, bot = H - LB, HZs = LB + 66 - Math.min(20, oy * 0.03), hz = top + bot - HZs, LX = o.lx === undefined ? 250 : o.lx;   // (drawn upright, then turned over)
    gradient(top, hz + 2, [114, 114, 124, 114, 124, 115, 124, 115, 125, 116]);
    for (let k = 0; k < 70; k++) { const x = ((ih(k, 1, 8101) * W - ox * 0.03) % W + W) % W, y = top + ih(k, 2, 8101) * (hz - top - 50), tw = frac(ih(k, 3, 8101) + t * 0.4); if (tw < 0.6) P(x, y, tw < 0.1 ? 119 : 117); }
    for (let y = fl(hz); y < bot; y++) {
      const u = (y - hz) / Math.max(1, bot - hz), base = fl(u * 3.2);
      for (let x = 0; x < W; x++) {
        const wx = x + ox * (0.2 + u), sw = Math.sin(wx * 0.05 / (0.2 + u) + t * 1.2 + y * 0.9) + Math.sin(wx * 0.013 / (0.2 + u) - t * 0.7 + y * 0.31);
        let c = OCEAN[clamp(base + (sw > 1.2 ? 2 : sw > 0.6 ? 1 : 0) - (bay(x, y) > 0.5 + u * 0.4 ? 1 : 0), 0, 3)];
        if (sw > 1.75 && u > 0.1) c = u > 0.5 ? 119 : 118;
        const rw = 10 + u * 60, dxr = Math.abs(x - LX - Math.sin(y * 0.7 + t * 2) * (2 + u * 6));
        if (dxr < rw && sw > 0.3 - (1 - dxr / rw) * 0.9 && ih(x >> 1, y, fl(t * 8)) < 0.8) c = sw > 1.2 ? 135 : sw > 0.7 ? 119 : 118;
        BUF[y * W + x] = c;
      }
    }
    for (let layer = 0; layer < 3; layer++) {
      const n = 8 - layer * 2, par = 0.25 + layer * 0.45, sc = 0.55 + layer * 0.6, vp = 0.12 + layer * 0.22;
      const LIT = layer === 0 ? [125, 126, 116] : layer === 1 ? [125, 126, 127] : [124, 126, 127], SH = layer === 0 ? 115 : layer === 1 ? 124 : 114, INK = layer === 2 ? 0 : 114;
      for (let k = 0; k < n; k++) {
        const bx = ((ih(k, layer, 8102) * 660 - ox * par) % 660 + 660) % 660 - 90, bw = (13 + ih(k, 2, 8102 + layer) * 22) * sc, bh = (60 + ih(k, 3, 8102 + layer) * 110) * sc, by = hz + 5 + layer * 16 + oy * vp;
        const lean = (ih(k, 4, 8102 + layer) - 0.5) * 0.22, rdg = (ih(k, 5, 8102 + layer) - 0.5) * 0.5;
        for (let y = fl(by - bh); y < by + 3; y++) {
          if (y < top || y >= bot) continue;
          const v = (by - y) / bh, cxr = bx + lean * (by - y) + Math.sin(v * 5 + k) * 2 * sc, half = bw * Math.pow(Math.max(0, 1 - v), 0.85) * (0.82 + 0.36 * vn(y * 0.2, k, 1, 8103 + layer)) + 0.4;
          for (let x = fl(cxr - half); x <= cxr + half; x++) {
            if (x < 0 || x >= W) continue;
            const f = (x - cxr) / half, onLit = f < rdg * (1 - v), strata = frac((y + vn(x * 0.2, k, 1, 8104) * 3) / (7 * sc)) < 0.14;
            let c = onLit ? LIT[f < -0.7 ? 2 : f < -0.25 ? 1 : 0] : SH;
            if (strata) c = onLit ? LIT[0] : INK;
            if (Math.abs(f) > 0.9) c = INK;
            if (v > 0.9 && onLit && bay(x, y) < 0.5) c = 127;                                 // wet tips catching what light there is
            if (layer > 0 && ((v > 0.93 && Math.abs(f) < 0.7) || (onLit && ih(x, y, 8115 + fl(t * 2)) < 0.025 * layer) || (Math.abs(f - Math.sin(v * 9 + k) * 0.35) < 0.07 && v > 0.45 && bay(x, y) < 0.6))) c = v > 0.96 ? 129 : 128;   // bioluminescence
            BUF[y * W + x] = c;
          }
        }
        for (let q = 0; q < 5; q++) { const mx = bx + (ih(k, q, 8105 + layer) - 0.5) * bw * 2.2, my = by + 1 + Math.sin(t * 0.8 + q + k) * 1.5; cloudPuff(mx, my, (5 + q) * sc, [115, 116, 117, 118], 8106 + k * 7 + q); }
      }
    }
    // the glowing tips of the teeth, lamps for the grade (in the turned-over picture)
    for (let layer = 1; layer < 3; layer++) { const n = 8 - layer * 2, par = 0.25 + layer * 0.45, sc = 0.55 + layer * 0.6, vp = 0.12 + layer * 0.22; for (let k = 0; k < n; k++) { const bx = ((ih(k, layer, 8102) * 660 - ox * par) % 660 + 660) % 660 - 90, bh = (60 + ih(k, 3, 8102 + layer) * 110) * sc, by = hz + 5 + layer * 16 + oy * vp, ty = top + bot - 1 - (by - bh), lean = (ih(k, 4, 8102 + layer) - 0.5) * 0.22; light(bx + lean * bh, ty, 26 * sc, [0.35, 1, 0.85], 0.32 + 0.12 * Math.sin(t * 2 + k)); } }
    // turn it over
    for (let y = 0; y < (bot - top) >> 1; y++) { const a = (top + y) * W, b = (bot - 1 - y) * W; for (let x = 0; x < W; x++) { const c = BUF[a + x]; BUF[a + x] = BUF[b + x]; BUF[b + x] = c; } }
    // far below: a second sea, of mist; and far off in the dark, teeth the size of mountains
    for (let k = 0; k < 6; k++) {
      const bx = ((ih(k, 1, 8110) * 760 - ox * 0.1) % 760 + 760) % 760 - 140, bw = 34 + ih(k, 2, 8110) * 50, bh = 130 + ih(k, 3, 8110) * 70 - Math.min(40, oy * 0.02), y0 = HZs + 4;
      for (let y = fl(y0); y < Math.min(bot, y0 + bh); y++) { const v = (y - y0) / bh, half = bw * Math.pow(1 - v, 0.9) * (0.85 + 0.3 * vn(y * 0.1, k, 1, 8111)); for (let x = fl(bx - half); x <= bx + half; x++) { if (x < 0 || x >= W) continue; const i = y * W + x, c0 = BUF[i]; if (c0 > 1 && c0 !== 114 && c0 !== 117 && c0 !== 119 && c0 !== 124 && c0 !== 115) continue; const f = (x - bx) / half; if (bay(x, y) > 1.3 - v * 0.9) continue; BUF[i] = f < -0.55 ? 126 : f < -0.2 ? (bay(x, y) < 0.5 ? 125 : 115) : f > 0.6 ? 114 : 115; } }
    }
    cloudBank(bot - 16 + Math.max(0, 30 - oy * 0.05), 30, 110, 8112, ox * 0.18 + t * 3, [114, 124, 115, 125], true);
    cloudBank(bot + 6 + Math.max(0, 30 - oy * 0.05), 30, 70, 8113, ox * 0.35 + t * 5, [1, 114, 124, 115], true);
    for (let q = 0; q < 5; q++) light(LX - 60 + q * 22, HZs + 20 + q * 34, 60 + q * 10, L_COLD, 0.13);
    for (let k = 0; k < 44; k++) { const dp = 0.3 + ih(k, 1, 8114) * 0.9, x = ((ih(k, 2, 8114) * 560 - ox * dp * 0.6) % 560 + 560) % 560 - 40, y = bot - frac(ih(k, 3, 8114) + oy * dp / 260) * (bot - top + 40) + 20, L = (5 + ih(k, 4, 8114) * 18) * dp; for (let q = 0; q < L; q++) if (bay(fl(x), fl(y + q)) < 0.55 - q / L * 0.4) P(x, y + q, dp > 0.8 ? 116 : 115); }
    // water letting go of the teeth, falling away into the dark below
    for (let k = 0; k < 26; k++) { const x = ((ih(k, 1, 8107) * 560 - ox * (0.3 + 0.5 * ih(k, 2, 8107))) % 560 + 560) % 560 - 40, u = frac(ih(k, 3, 8107) + t * (0.5 + ih(k, 4, 8107) * 0.5)), y = HZs + 20 + u * u * 190 - oy * 0.2 % 40, L = 3 + u * 9; for (let q = 0; q < L; q++) if (bay(fl(x), fl(y - q)) < 0.7 - q / L * 0.5) P(x, y - q, q < 2 ? 118 : 117); }
    // light down the abyss: soft shafts from the sea-sky; lines of glowing foam on the mist below; drifting motes
    z5GodRays(LX, top, 9, t * 0.05, T_CYAN, 0.16, 330);
    for (let k = 0; k < 7; k++) { const y0 = bot - 50 + k * 7 + Math.max(0, 30 - oy * 0.05) * 0.5, sp = 10 + k * 6; for (let x = 0; x < W; x++) { const wx = x + ox * (0.2 + k * 0.05) + t * sp, n = vn(wx, k * 13, 22 + k * 4, 8116); if (n < 0.58) continue; const y = y0 + Math.sin(wx * 0.06 + t * 1.3 + k) * (1.5 + k * 0.4); if (y < bot && bay(x, fl(y)) < (n - 0.58) * 4) P(x, y, n > 0.72 ? 129 : 128); } }
    for (let k = 0; k < 34; k++) { const dp = 0.4 + ih(k, 1, 8117) * 0.8, x = ((ih(k, 2, 8117) * 560 - ox * dp * 0.5 + Math.sin(t * 0.7 + k) * 8) % 560 + 560) % 560 - 40, y = HZs + 30 + ih(k, 3, 8117) * (bot - HZs - 40) + Math.sin(t * 0.9 + k * 1.3) * 5 - oy * dp * 0.04 % 30, tw = 0.5 + 0.5 * Math.sin(t * 3 + k); P(x, y, tw > 0.5 ? 129 : 128); if (dp > 0.9) { P(x + 1, y, 128); P(x, y + 1, 128); } if (k % 4 === 0) light(x, y, 12 * dp, [0.35, 1, 0.85], 0.25 * tw); }
    // the breach: the hole in the sea-sky they fell through, dawn pouring down it
    if (o.hole) {
      const [hx, a] = o.hole, hy = top + 12, Wd = wview('dawn');
      for (let y = top; y < hy + 16; y++) for (let x = fl(hx - 46); x < hx + 46; x++) { if (x < 0 || x >= W) continue; const dx = (x - hx) / 44, dy = (y - hy) / 15, d = dx * dx + dy * dy + (vn(x, y, 6, 8108) - 0.5) * 0.5; if (d > a) continue; BUF[y * W + x] = d > a - 0.14 ? 22 : d > a - 0.24 ? 135 : Wd[clamp(y + 70, LB, H - LB - 1) * W + x]; }
      for (let q = 0; q < 6; q++) light(hx + q * 5, hy + q * 30, 70 + q * 14, L_WARM, 0.22 * a * (1 - q / 7));
    }
    light(LX, HZs, 130, L_COLD, 0.25);
  }
  // the white void: paper, and everything on it a black ink line that boils like a drawing
  function w5Ink(t, ox, oy, o) {
    o = o || {}; ox = ox || 0; oy = oy || 0;
    const top = LB, bot = H - LB, boil = fl(t * 8);
    for (let y = top; y < bot; y++) for (let x = 0; x < W; x++) { const n = vn(x + ox * 0.1, y, 46, 8201) + vn(x, y, 3, 8202) * 0.12; BUF[y * W + x] = n > 0.68 ? (bay(x, y) < (n - 0.68) * 5 ? 143 : 142) : n > 0.56 && bay(x, y) < 0.4 ? 142 : 64; }
    const jit = (k, a) => (ih(k, boil, 8203) - 0.5) * a;
    // the ink sun: rough rings, strokes around it
    const sx = 352 - ox * 0.04, sy = 96 - oy * 0.05;
    for (let r = 0; r < 3; r++) { const R = 44 - r * 9; for (let a = 0; a < TAU; a += 0.5 / R) { if (r && ih(fl(a * 5), r + boil, 8204) < 0.3) continue; const rr = R + (vn(a * 4, boil, 1, 8205 + r) - 0.5) * 3; P(sx + Math.cos(a) * rr, sy + Math.sin(a) * rr, 0); if (r === 0) P(sx + Math.cos(a) * (rr + 1), sy + Math.sin(a) * (rr + 1), 0); } }
    for (let k = 0; k < 22; k++) { const a = k / 22 * TAU + jit(k, 0.04), r0 = 52 + (k % 3) * 4, r1 = r0 + 8 + ih(k, 1, 8206) * 22; lineP(sx + Math.cos(a) * r0, sy + Math.sin(a) * r0, sx + Math.cos(a) * r1, sy + Math.sin(a) * r1, 0); }
    // two ranges of mountains: an outline, hatching on the far slopes
    for (let L = 0; L < 2; L++) {
      const yb = L ? 206 : 168, hh = L ? 74 : 52, par = L ? 0.4 : 0.16, sd = 8210 + L * 7; let py = 0;
      for (let x = 0; x < W; x++) {
        const wx = x + ox * par, f = fbm(wx, 0, L ? 70 : 110, 4, sd), y = fl(yb - hh * f - oy * par * 0.3 + (vn(wx, boil, 3, sd + 1) - 0.5) * 1.2), up = fbm(wx + 2, 0, L ? 70 : 110, 4, sd) > f;
        for (let yy = Math.max(top, y); yy < bot; yy++) BUF[yy * W + x] = 64;
        if (x) for (let yy = Math.min(y, py); yy <= Math.max(y, py); yy++) { P(x, yy, 0); if (L) P(x, yy + 1, 0); }
        py = y;
        if (!up && (fl(wx) % (L ? 3 : 4)) === 0) { const hl = (6 + ih(fl(wx), 1, sd + 2) * (L ? 30 : 16)); for (let q = 2; q < hl; q++) if (bay(x, y + q) < 1 - q / hl) P(x + (L ? q * 0.4 : 0), y + q, 0); }
        if (L && ih(fl(wx), 3, sd + 3) < 0.012) { const th = 8 + ih(fl(wx), 4, sd) * 12; lineP(x, y, x + jit(x, 1), y - th, 0); for (let b = 0; b < 4; b++) lineP(x, y - th * (0.4 + b * 0.15), x + (b & 1 ? 4 : -4) + jit(x + b, 1), y - th * (0.55 + b * 0.15) - 2, 0); }   // a bare tree
      }
    }
    // curls of cloud, birds, spatters
    for (let k = 0; k < 5; k++) { const cx = ((ih(k, 1, 8220) * 640 - ox * 0.22 - t * 5) % 640 + 640) % 640 - 80, cy = 58 + ih(k, 2, 8220) * 50 - oy * 0.06; for (let a = 0.6; a < 8; a += 0.07) { const r = a * 2.1; P(cx + Math.cos(a + jit(k, 0.1)) * r * 1.7, cy + Math.sin(a) * r, 0); } for (let x = 0; x < 50; x++) if (bay(fl(cx + 22 + x), fl(cy + 15)) < 1 - x / 50) { P(cx + 22 + x, cy + 15 + Math.sin(x * 0.2) * 1.5, 0); P(cx - 60 + x, cy + 12 - Math.sin(x * 0.15) * 2, 0); } }
    for (let k = 0; k < 6; k++) { const bx = ((ih(k, 1, 8221) * 560 - ox * 0.3 + t * 14) % 560 + 560) % 560 - 40, by = 50 + ih(k, 2, 8221) * 40, fp = Math.sin(t * 9 + k) * 2; lineP(bx - 4, by - fp, bx, by, 0); lineP(bx, by, bx + 4, by - fp, 0); }
    for (let k = 0; k < 26; k++) { const x = ((ih(k, 1, 8222) * 600 - ox * 0.7) % 600 + 600) % 600 - 60, y = top + ih(k, 2, 8222) * (bot - top), r = ih(k, 3, 8222) * 2.4; discF(x, y, r, 0); if (k % 5 === 0) for (let q = 0; q < 14; q++) if (bay(fl(x), fl(y + q)) < 1 - q / 14) P(x, y + q, 0); }
    // reeds, close to the lens
    for (let k = 0; k < 16; k++) { const x = ((ih(k, 1, 8223) * 620 - ox * 1.25) % 620 + 620) % 620 - 70, h = 26 + ih(k, 2, 8223) * 44, bend = (ih(k, 3, 8223) - 0.5) * 30 + Math.sin(t * 2 + k) * 3; for (let q = 0; q < h; q++) { const u = q / h, px = x + bend * u * u, py = bot + 4 - q + oy * 0.2; P(px, py, 0); if (u < 0.6) P(px + 1, py, 0); if (u > 0.85 && k % 3 === 0) { P(px - 1, py, 0); P(px + 2, py, 0); } } }
  }
  // the staircase city folded over itself: towers stand up from below, hang from above, and jut from the sides; great
  // flights of stairs cross between them, some the wrong way up; lit windows
  function w5Tower(x, y, w, h, dir, cols, k, t, win, horiz) {
    const R = horiz ? (a, b, cw, ch, c) => rectF(b, a, ch, cw, c) : rectF, PP = horiz ? (a, b, c) => P(b, a, c) : P;
    const y0 = dir < 0 ? y - h : y, sh = Math.max(2, fl(w * 0.28));
    R(x, y0, w, h, cols[0]); R(x + w - sh, y0, sh, h, cols[1]);
    for (let q = 0; q < h; q += 9) R(x, y0 + q, w, 1, cols[1]);
    const cap = dir < 0 ? y0 : y0 + h, cw = fl(w * 0.6), ch = 4 + (k % 3) * 3;
    R(x + (w - cw) / 2, dir < 0 ? cap - ch : cap, cw, ch, cols[0]); R(x + w / 2 - 1, dir < 0 ? cap - ch - 7 : cap + ch, 1, 7, cols[1]);
    for (let wy = 3; wy < h - 4; wy += 5) for (let wx = 2; wx < w - sh - 2; wx += 4) { const r = ih(k * 31 + wx, wy, 8301) * 0.72; if (r < 0.34) { const fk = r < 0.03 && fl(t * 6 + k) % 3 === 0; if (!fk) { R(x + wx, y0 + wy, 2, 3, r < 0.12 ? win[1] : win[0]); if (r < 0.06) PP(x + wx, y0 + wy, win[2]); } } }
    // a stair zigzagging up its face
    if (k % 2 === 0 && w > 16) for (let q = 0; q < h - 6; q++) { const z = fl(q / 8), f = (q % 8) / 8, xx = x + 2 + (z & 1 ? 1 - f : f) * (w - sh - 5); PP(xx, y0 + (dir < 0 ? h - 2 - q : q + 1), cols[2]); }
  }
  // a flight of stairs from (x0, y0) to (x1, y1): treads lit on top, a rail with lamps; under: it is the wrong way up
  function w5Flight(x0, y0, x1, y1, sw, cols, under, t, seed, lamp) {
    const n = Math.max(2, Math.round(Math.abs(x1 - x0) / sw)), dx = (x1 - x0) / n, dy = (y1 - y0) / n, u = under ? -1 : 1, thk = 5;
    for (let s = 0; s < n; s++) {
      const x = x0 + dx * s, y = y0 + dy * s, xa = Math.min(x, x + dx), w = Math.abs(dx) + 1, hgt = Math.abs(dy);
      rectF(xa, under ? y - thk - hgt : y, w, thk + hgt + 1, cols[0]);
      rectF(xa, under ? y : y, w, 1, under ? cols[2] : cols[2]); if (!under) rectF(xa, y + 1, w, 1, cols[1]);
      if (dy * u < 0) rectF(dx > 0 ? x + dx : x, Math.min(y, y + dy), 1, hgt, cols[1]);
      if (s % 3 === 0) { const px = x + dx / 2; lineP(px, y - u, px, y - u * 9, cols[1]); }
      if (lamp && s % 5 === 2) { const px = x + dx / 2, py = y - u * 11; P(px, py, 22); P(px - 1, py, 15); P(px + 1, py, 15); P(px, py + u, 15); light(px, py, 30, L_WARM, 0.6); }
    }
    lineP(x0, y0 - u * 9, x1, y1 - u * 9, cols[1]);
  }
  function w5City(t, ox, oy, o) {
    o = o || {}; ox = ox || 0; oy = oy || 0;
    const top = LB, bot = H - LB;
    gradient(top, bot, [124, 125, 126, 127, 126, 125, 124]);
    light(240 - ox * 0.05, 135, 190, L_COLD, 0.2);
    for (let k = 0; k < 40; k++) { const x = ih(k, 1, 8310) * W, y = top + ih(k, 2, 8310) * (bot - top); if (frac(ih(k, 3, 8310) + t * 0.3) < 0.5) P(x, y, 128); }
    for (let layer = 0; layer < 2; layer++) {
      const par = 0.2 + layer * 0.35, cols = layer ? [124, 114, 126] : [125, 124, 126], win = layer ? [15, 16, 22] : [141, 15, 16], sc = 0.7 + layer * 0.5;
      // from the sides (the far layer only): the city on the walls of the fold
      if (!layer) for (let k = 0; k < 7; k++) { const yy = top + 10 + k * 27 + ((oy * 0.2) % 27), w = 14 + ih(k, 1, 8320) * 16, h = 30 + ih(k, 2, 8320) * 60; w5Tower(yy, 0, w, h, 1, [126, 125, 127], k + 60, t, [141, 15, 16], true); w5Tower(yy + 9, W, w, h * 0.9, -1, [126, 125, 127], k + 80, t, [141, 15, 16], true); }
      for (let k = 0; k < 13; k++) {
        const x = ((ih(k, layer, 8321) * 720 - ox * par) % 720 + 720) % 720 - 80, w = (16 + ih(k, 2, 8321 + layer) * 28) * sc, h = (36 + ih(k, 3, 8321 + layer) * 86) * sc;
        w5Tower(x, bot + 6 - oy * par * 0.6 + (layer ? 0 : -14), w, h, -1, cols, k + layer * 20, t, win);
        const x2 = ((ih(k, layer + 5, 8322) * 720 - ox * par * 1.1) % 720 + 720) % 720 - 80, h2 = (30 + ih(k, 4, 8322 + layer) * 80) * sc;
        w5Tower(x2, top - 6 - oy * par * 0.6 + (layer ? 0 : 12), w, h2, 1, cols, k + 40 + layer * 20, t, win);
      }
      if (!layer) { w5Flight(520 - ox * 0.3, 232 - oy * 0.2, 150 - ox * 0.3, 52 - oy * 0.2, 7, [125, 124, 127], false, t, 1, false); w5Flight(-60 - ox * 0.3, 60 - oy * 0.2, 330 - ox * 0.3, 210 - oy * 0.2, 7, [125, 124, 127], true, t, 2, false); for (let y = top; y < bot; y++) for (let x = 0; x < W; x++) if (bay(x, y) < 0.22) { const i = y * W + x; if (BUF[i] !== 15 && BUF[i] !== 16 && BUF[i] !== 141) BUF[i] = 126; } }
    }
  }
  // the near flights of the city (drawn by the shot, so fighters can stand on them): returns nothing
  function w5CityFlights(t, ox, oy) {
    w5Flight(-40 - ox, 262 - oy, 560 - ox, 82 - oy, 10, [124, 114, 128], false, t, 3, true);
    w5Flight(-80 - ox * 0.9, 38 - oy * 0.9, 600 - ox * 0.9, 118 - oy * 0.9, 10, [124, 114, 127], true, t, 4, true);
  }
  // the cathedral inside the dead black sun: a nave of obsidian columns, ribs of the vault, windows of dark fire, and at
  // its end, where a rose window would be, the sun itself: a black disc in a ring of fire
  function w5Cath(t, ox, oy, o) {
    o = o || {}; ox = ox || 0; oy = oy || 0;
    const top = LB, bot = H - LB, vx = 240 - ox * 0.12, vy = 118 - oy * 0.1, fire = o.fire === undefined ? 1 : o.fire;
    rectF(0, top, W, bot - top, 96);
    for (let y = top; y < bot; y++) for (let x = 0; x < W; x++) { const d = Math.hypot(x - vx, (y - vy) * 1.3), n = vn(x, y + t * 6, 18, 8401); BUF[y * W + x] = d < 46 + n * 14 ? 98 : d < 86 + n * 22 ? (bay(x, y) < 0.5 ? 98 : 97) : d < 150 ? (bay(x, y) < 0.35 ? 97 : 96) : 96; }
    // the floor: polished, taking the fire's reflection; its joints run to the vanishing point
    const fy = vy + 26;
    for (let y = fl(fy); y < bot; y++) { const u = (y - fy) / (bot - fy); for (let x = 0; x < W; x++) { const wx = (x - vx) / (0.08 + u), rf = Math.abs(x - vx - Math.sin(y * 0.9 + t * 3) * (1 + u * 5)) < 8 + u * 46, jn = frac(wx / 60) < 0.03 / (0.2 + u) || frac(1.6 / (0.06 + u) + 0.5) < 0.05; BUF[y * W + x] = rf && ih(x >> 1, y, fl(t * 7)) < 0.55 * fire ? (u < 0.3 ? 103 : bay(x, y) < 0.5 ? 102 : 101) : jn ? 98 : u > 0.6 && bay(x, y) < 0.3 ? 97 : 96; } }
    // the rose: the black sun and its tracery
    blackSun(vx, vy - 4, 16, t, 0.85 * fire + 0.15);
    for (let k = 0; k < 12; k++) { const a = k / 12 * TAU + t * 0.05; lineP(vx + Math.cos(a) * 31, vy - 4 + Math.sin(a) * 31, vx + Math.cos(a) * 41, vy - 4 + Math.sin(a) * 41, 99); discF(vx + Math.cos(a + 0.26) * 36, vy - 4 + Math.sin(a + 0.26) * 36, 2.2, fire > 0.5 ? 102 : 98); }
    ring(vx, vy - 4, 42, undefined, 99); ring(vx, vy - 4, 43, undefined, 98); ring(vx, vy - 4, 30, undefined, 98);
    light(vx, vy - 4, 120, L_CRIM, 0.4 * fire);
    // columns, far to near; between them the aisle windows burning; over them the ribs
    for (let k = 6; k >= 0; k--) {
      const z = 0.55 + k * 0.62 - (((ox * 0.004) % 0.62) + 0.62) % 0.62, zn = z - 0.62, yt = vy - 190 / z, yb = fy + 132 / z - 26 / z, cw = Math.max(2, 30 / z);
      for (const sd of [-1, 1]) {
        const cx = vx + sd * 250 / z;
        // the window in the wall beyond this column
        if (zn > 0.2) { const x2 = vx + sd * 250 / zn, wa = Math.min(cx, x2) + Math.abs(x2 - cx) * 0.3, wb = Math.min(cx, x2) + Math.abs(x2 - cx) * 0.75; for (let x = fl(wa); x <= wb; x++) { if (x < 0 || x >= W) continue; const zz = 250 / Math.abs(x - vx), u = (x - wa) / Math.max(1, wb - wa), pt = 1 - Math.abs(u - 0.5) * 2, y0 = vy - (130 + 34 * pt) / zz, y1 = vy + 40 / zz; for (let y = Math.max(top, fl(y0)); y < Math.min(bot, y1); y++) { const v = (y - y0) / (y1 - y0), n = vn(x * 0.7, y * 0.4 - t * 14, 5, 8402 + k); BUF[y * W + x] = n * fire > 0.62 - v * 0.2 ? (n > 0.8 ? 105 : 103) : n * fire > 0.4 ? 102 : bay(x, y) < 0.5 ? 101 : 97; } } }
        for (let x = fl(cx - cw / 2); x <= cx + cw / 2; x++) { if (x < 0 || x >= W) continue; const f = (x - (cx - cw / 2)) / cw, inner = sd > 0 ? f : 1 - f; const c = inner < 0.12 ? (fire > 0.4 ? 102 : 99) : inner < 0.3 ? 100 : inner < 0.5 ? 99 : inner < 0.8 ? 98 : 97, fl2 = cw > 8 && (fl(inner * 6) & 1); for (let y = Math.max(top, fl(yt)); y < Math.min(bot, yb); y++) BUF[y * W + x] = fl2 && bay(x, y) < 0.5 ? c - (c > 97 && c <= 100 ? 1 : 0) : c; }
        rectF(cx - cw * 0.75, yt - 3 / z, cw * 1.5, Math.max(1, 9 / z), 99); rectF(cx - cw * 0.75, yt - 3 / z, cw * 1.5, 1, 100); rectF(cx - cw * 0.8, yb - 8 / z, cw * 1.6, Math.max(1, 9 / z), 98);
        // dark fire licking at its foot
        for (let q = 0; q < cw * 1.6; q++) { const x = cx - cw * 0.8 + q, hgt = (6 + 22 * vn(x * 0.3, t * 5 + k, 1, 8403)) / z * fire; for (let y2 = 0; y2 < hgt; y2++) if (bay(fl(x), fl(yb - 8 / z - y2)) < 1 - y2 / hgt) P(x, yb - 8 / z - y2, y2 < hgt * 0.3 ? 104 : y2 < hgt * 0.6 ? 102 : 101); }
        // the rib springing to the crown of the vault
        const ax = vx, ay = yt - 150 / z; for (let u = 0; u <= 1; u += 0.012) { const px = z5Bz(cx, cx, ax, u), py = z5Bz(yt, ay + 30 / z, ay, u); P(px, py, 99); if (z < 2.4) { P(px, py + 1, fire > 0.4 ? 101 : 97); P(px + sd, py, 98); } }
      }
    }
    for (let k = 0; k < 46; k++) { const u = frac(ih(k, 1, 8404) + t * (0.12 + ih(k, 2, 8404) * 0.2)), x = ih(k, 3, 8404) * W + Math.sin(t * 1.3 + k) * 6, y = bot - u * (bot - top); if (bay(fl(x), fl(y)) < 1 - u * 0.7) P(x, y, k % 3 ? 103 : 105); }
  }
  // the night between the halves of a cut world: indigo, thick with stars, and a moon. o.moon: [x, y, r] (drawn whole)
  function w5Moon(mx, my, r, keep) {
    for (let y = Math.max(LB, fl(my - r)); y <= Math.min(H - LB - 1, my + r); y++) for (let x = Math.max(0, fl(mx - r)); x <= Math.min(W - 1, mx + r); x++) {
      const dx = (x + 0.5 - mx) / r, dy = (y + 0.5 - my) / r, d = dx * dx + dy * dy; if (d > 1 || (keep && !keep(dx * r, dy * r))) continue;
      const z = Math.sqrt(1 - d), l = -dx * 0.55 - dy * 0.45 + z * 0.6, mare = vn(x - mx, y - my, r * 0.45, 8501) + vn(x - mx, y - my, r * 0.15, 8502) * 0.4;
      let c = l > 0.72 ? 21 : l > 0.45 ? 20 : l > 0.18 ? 19 : l > -0.1 ? 18 : 17; if (mare > 0.82 && c > 17) c--; if (bay(x, y) < 0.3 && c > 17 && l < 0.6) c--;
      BUF[y * W + x] = c;
    }
    for (let k = 0; k < 9; k++) { const a = ih(k, 1, 8503) * TAU, q = Math.sqrt(ih(k, 2, 8503)) * 0.8, cx = mx + Math.cos(a) * q * r, cy = my + Math.sin(a) * q * r, cr = r * (0.06 + ih(k, 3, 8503) * 0.1); if (keep && !keep(cx - mx + cr, cy - my) ) continue; if (keep && !keep(cx - mx - cr, cy - my)) continue; ring(cx, cy, cr, cr * 0.8, 18); for (let b = 0.2; b < 1.9; b += 0.15 / cr) P(cx + Math.cos(b) * cr, cy + Math.sin(b) * cr * 0.8, 21); }
    light(mx, my, r * 2.6, L_COLD, 0.3);
  }
  function w5Night(t, ox, oy, o) {
    o = o || {}; ox = ox || 0; oy = oy || 0;
    const top = LB, bot = H - LB;
    gradient(top, bot, [0, 1, 1, 2, 63, 2, 1]);
    for (let y = top; y < bot; y++) for (let x = 0; x < W; x++) { const n = vn(x + ox * 0.04 + y * 0.9, y - x * 0.35, 40, 8510); if (n > 0.62 && bay(x, y) < (n - 0.62) * 3.2) BUF[y * W + x] = n > 0.8 ? 4 : 3; }
    for (let k = 0; k < 190; k++) { const x = ((ih(k, 1, 8511) * W - ox * (0.03 + 0.05 * (k % 3))) % W + W) % W, y = top + ((ih(k, 2, 8511) * (bot - top) - oy * (0.03 + 0.05 * (k % 3))) % (bot - top) + (bot - top)) % (bot - top), tw = frac(ih(k, 3, 8511) + t * 0.5); if (tw < 0.85) { P(x, y, k % 9 === 0 ? 22 : k % 4 === 0 ? 57 : 19); if (k % 23 === 0 && tw < 0.4) sparkle(x, y, 2, 22, 56); } }
    if (o.moon) w5Moon(o.moon[0], o.moon[1], o.moon[2]);
    if (!o.noShards) for (let k = 0; k < 7; k++) { const x = ((ih(k, 1, 8512) * 620 - ox * (0.2 + 0.1 * k)) % 620 + 620) % 620 - 70, y = top + 20 + ((ih(k, 2, 8512) * 190 - oy * (0.2 + 0.1 * k) + Math.sin(t * 0.6 + k) * 4) % 190 + 190) % 190, r = 5 + ih(k, 3, 8512) * 11; h5Shard(shardPts(x, y, r * 1.5, r, t * 0.2 * (k & 1 ? 1 : -1) + k, 40 + k, 5), ['dawn', 'ocean', 'city', 'ink'][k % 4], 120 + k * 50, 110 + (k % 3) * 30, t, { seed: k, dim: 0.5, glint: k % 2 === 0 }); }
  }
  // the world as Dawnbreak sees it: black, drawn in lines of light; hy: the burning horizon; o.burn 0..1, o.sunX, o.noLine
  function w5Line(t, ox, hy, o) {
    o = o || {}; ox = ox || 0;
    const top = LB, bot = H - LB, burn = o.burn === undefined ? 1 : o.burn, sunX = o.sunX === undefined ? 300 : o.sunX;
    rectF(0, top, W, bot - top, 0);
    // constellations
    for (let k = 0; k < 9; k++) {
      const cx = ((ih(k, 1, 8601) * 620 - ox * 0.05) % 620 + 620) % 620 - 70, cy = top + 8 + ih(k, 2, 8601) * Math.max(10, hy - top - 60); let px = cx, py = cy;
      for (let q = 0; q < 4; q++) { const nx = px + (ih(k, q, 8602) - 0.4) * 44, ny = py + (ih(k, q, 8603) - 0.5) * 30; if (ny < hy - 30 && ny > top + 2) lineF(px, py, nx, ny, (x, y) => { if ((x + y) % 3 === 0) P(x, y, 5); }); const tw = frac(ih(k, q, 8604) + t * 0.4); if (py < hy - 24) { P(px, py, tw < 0.5 ? 22 : 57); if (q === 0) sparkle(px, py, 1 + tw * 2, 57, 6); } px = nx; py = ny; }
    }
    // the sun: arcs on the horizon, long rays in thin line
    if (!o.noSun) {
      for (const [R, c, dash] of [[30, 22, 0], [31, 140, 0], [38, 141, 2], [47, 110, 3], [58, 12, 4]]) for (let a = PI; a < TAU; a += 0.6 / R) { const x = sunX + Math.cos(a) * R, y = hy + Math.sin(a) * R; if (dash && (fl(a * R / 3 + t * dash) % dash) === 0) continue; if (y < hy - 1) P(x, y, c); }
      for (let k = 0; k < 21; k++) { const a = PI + (k + 0.5) / 21 * PI, r0 = 64 + (k % 2) * 8, r1 = r0 + 30 + ih(k, 1, 8605) * 150 + Math.sin(t * 1.5 + k) * 8, ca = Math.cos(a), sa = Math.sin(a); lineF(sunX + ca * r0, hy + sa * r0, sunX + ca * r1, hy + sa * r1, (x, y, u) => { if (y > top && bay(x, y) < 1 - u * 0.75) P(x, y, u < 0.3 ? 141 : u < 0.6 ? 110 : 12); }); }
      light(sunX, hy, 120, L_GOLD, 0.3 * burn);
    }
    // contours of cloud above the line, and of the cloud sea below it, drawn as single lines
    for (let b = 0; b < 3; b++) {
      const yb = hy - 16 - b * 21, par = 0.5 - b * 0.14, c = [132, 133, 6][b]; let py = null;
      for (let x = 0; x < W; x++) { const wx = x + ox * par + b * 300, f = fbm(wx, 0, 70 - b * 12, 3, 8610 + b), y = f > 0.5 ? fl(yb - (f - 0.5) * 60 - Math.abs(Math.sin(wx * 0.12)) * 3) : null; if (y !== null && y > top) { if (py !== null) for (let yy = Math.min(y, py); yy <= Math.max(y, py); yy++) P(x, yy, c); else P(x, y, c); if (fl(wx) % 11 === 0 && f > 0.56) for (let q = 3; q < 9; q++) P(x + q, yb + 3 + (fl(wx / 11) % 3) * 3, b ? 5 : 133); } else if (py !== null) { for (let q = 0; q < 8; q++) P(x + q, py + 1, c); } py = y; }
    }
    for (let k = 1; k <= 8; k++) {
      const y0 = hy + 3 + k * k * 1.7, c = k < 2 ? 141 : k < 4 ? 110 : k < 6 ? 12 : 10; if (y0 >= bot) break;
      for (let x = 0; x < W; x++) { const wx = x + ox * (0.3 + k * 0.12), n = vn(wx, k * 7, 26 + k * 6, 8620); if (n < 0.34 + k * 0.02) continue; const y = y0 + Math.sin(wx * 0.05 / (0.4 + k * 0.1) + t * (1.4 - k * 0.1) + k) * (0.6 + k * 0.5); P(x, y, c); }
    }
    if (!o.noSun) for (let k = 0; k < 26; k++) { const x = sunX + (ih(k, 1, 8621) - 0.5) * 70, y = hy + 4 + ih(k, 2, 8621) * 70, L = 2 + ih(k, 3, 8621) * 8 * ((y - hy) / 70 + 0.3); if (frac(ih(k, 4, 8621) + t * 0.8) < 0.7) lineP(x - L, y, x + L, y, y < hy + 24 ? 140 : 141); }
    // far shards, in outline
    for (let k = 0; k < 7; k++) { const x = ((ih(k, 1, 8622) * 600 - ox * (0.15 + k * 0.05)) % 600 + 600) % 600 - 60, y = top + 14 + ih(k, 2, 8622) * (hy - top - 50) + Math.sin(t * 0.5 + k) * 3, pts = shardPts(x, y, 7 + ih(k, 3, 8622) * 12, 5 + ih(k, 4, 8622) * 8, t * 0.15 + k, 60 + k, 5); for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) lineP(pts[j][0], pts[j][1], pts[i][0], pts[i][1], k % 2 ? 137 : 136); }
    // the horizon: one burning line
    if (!o.noLine) w5Horizon(t, hy, 0, W, burn, ox);
  }
  function w5Horizon(t, hy, x0, x1, burn, ox) {
    for (let x = Math.max(0, fl(x0)); x < Math.min(W, x1); x++) {
      const wx = x + (ox || 0) * 0.6, hgt = (1.5 + 7 * Math.pow(vn(wx * 0.35, t * 4.5, 1, 8630), 2) + 3 * vn(wx * 0.08, t * 1.5, 1, 8631)) * burn;
      for (let q = 0; q < hgt; q++) { const u = q / hgt; if (bay(x, fl(hy - 2 - q)) < 1.1 - u) P(x, hy - 2 - q, u < 0.25 ? 140 : u < 0.5 ? 141 : u < 0.78 ? 110 : 105); }
      P(x, hy + 2, bay(x, hy + 2) < 0.5 ? 141 : 110); P(x, hy - 1, 22); P(x, hy, 22); P(x, hy + 1, 140);
    }
    for (let k = 0; k < 60; k++) { const u = frac(ih(k, 1, 8632) + t * (0.3 + ih(k, 2, 8632) * 0.5)), x = x0 + ih(k, 3, 8632) * (x1 - x0) + Math.sin(u * 7 + k) * 4, y = hy - 3 - u * (20 + ih(k, 4, 8632) * 46); if (x >= x0 && x < x1 && bay(fl(x), fl(y)) < (1 - u) * burn) P(x, y, u < 0.3 ? 140 : u < 0.6 ? 141 : 105); }
    for (let x = Math.max(30, x0); x < Math.min(W, x1); x += 70) light(x, hy, 44, L_GOLD, 0.34 * burn);
  }
  WORLDS.dawn = () => w5Dawn(1.0, 40, 192, 352, 170);
  WORLDS.ocean = () => w5Ocean(1.0, 60, 30, {});
  WORLDS.ink = () => w5Ink(1.0, 80, 0, {});
  WORLDS.city = () => { w5City(1.0, 90, 10, {}); w5CityFlights(1.0, 90, 10); };
  WORLDS.cath = () => w5Cath(1.0, 0, 0, {});
  WORLDS.night = () => w5Night(1.0, 0, 0, { moon: [330, 100, 30], noShards: true });
