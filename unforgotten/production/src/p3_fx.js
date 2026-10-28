  /* ================================================================ effects */
  let SHAKE_A = 0;
  const shk = (a) => { SHAKE_A = Math.max(SHAKE_A, a); };
  const TMP = new Uint8Array(NP);
  // a 2D camera move on the finished picture: zoom z, roll r about (fx, fy), which lands at (sx, sy)
  function cam2(z, r, fx, fy, sx, sy) {
    if (sx === undefined) { sx = fx; sy = fy; }
    if (Math.abs(z - 1) < 0.002 && Math.abs(r) < 0.002 && fx === sx && fy === sy) return;
    TMP.set(BUF); const c = Math.cos(r) / z, s = Math.sin(r) / z;
    for (let y = 0; y < H; y++) { const dy = y + 0.5 - sy; for (let x = 0; x < W; x++) { const dx = x + 0.5 - sx; let X = fl(fx + dx * c + dy * s), Y = fl(fy - dx * s + dy * c); X = X < 0 ? 0 : X >= W ? W - 1 : X; Y = Y < 0 ? 0 : Y >= H ? H - 1 : Y; BUF[y * W + x] = TMP[Y * W + X]; } }
  }
  function whip(amt, dir) {
    if (amt < 1) return; TMP.set(BUF); const f = fl(T_NOW * 30), ca = Math.cos(dir), sa = Math.sin(dir);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const k = ih(fl(x / 3), y, f + 620) * amt; let X = fl(x - ca * k), Y = fl(y - sa * k); X = X < 0 ? 0 : X >= W ? W - 1 : X; Y = Y < 0 ? 0 : Y >= H ? H - 1 : Y; BUF[y * W + x] = TMP[Y * W + X]; }
  }
  function zoomBlur(cx, cy, amt) {
    if (amt < 0.01) return; TMP.set(BUF); const f = fl(T_NOW * 30);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const k = 1 - amt * ih(fl(x / 2), fl(y / 2), f + 630); let X = fl(cx + (x - cx) * k), Y = fl(cy + (y - cy) * k); X = X < 0 ? 0 : X >= W ? W - 1 : X; Y = Y < 0 ? 0 : Y >= H ? H - 1 : Y; BUF[y * W + x] = TMP[Y * W + X]; }
  }
  // two-tone impact frame: bright → ink and dark → light (mode 1) or the reverse (mode 0), with a burst of lines
  function impactFrame(cx, cy, mode) {
    for (let i = 0; i < NP; i++) { const l = LUM[BUF[i]]; BUF[i] = mode ? (l > 105 ? INK : WHITE) : (l > 140 ? WHITE : INK); }
    for (let k = 0; k < 44; k++) { const a = ih(k, 1, 81) * TAU, r0 = 30 + ih(k, 2, 81) * 40; lineF(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0, cx + Math.cos(a) * 520, cy + Math.sin(a) * 520, (x, y) => P(x, y, mode ? WHITE : INK)); }
  }
  function flashWhite(a) { if (a <= 0) return; if (a >= 1) { BUF.fill(WHITE); return; } tintAll(T_WH, a); }
  function fade(a, T) { if (a <= 0) return; if (a >= 1) { BUF.fill(BLACK); return; } tintAll(T || T_DARK, a); }
  function radialLines(cx, cy, n, inner, c, t, seed) {
    for (let k = 0; k < n; k++) {
      const a = ih(k, fl(t * 20), seed) * TAU, r0 = inner + ih(k, fl(t * 20) + 1, seed) * 60, w = ih(k, 3, seed) < 0.3 ? 2 : 1;
      for (let r = r0; r < 520; r++) { const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r; if (x < 0 || y < 0 || x >= W || y >= H) break; if (bay(fl(x), fl(y)) < 0.25 + (r - r0) / 300) { P(x, y, c); if (w > 1) P(x + Math.sin(a), y - Math.cos(a), c); } }
    }
  }
  function streaks(a, n, t, speed, c, len, seed, area) {
    const ca = Math.cos(a), sa = Math.sin(a), A = area || [0, 0, W, H];
    for (let k = 0; k < n; k++) {
      const L = len * (0.5 + ih(k, 1, seed)), px = ih(k, 2, seed) * (A[2] + 200) - 100 + A[0], py = ih(k, 3, seed) * A[3] + A[1];
      const off = frac(ih(k, 4, seed) + t * speed / 600) * 700 - 200, x0 = px + ca * off, y0 = py + sa * off;
      lineF(x0, y0, x0 + ca * L, y0 + sa * L, (x, y, u) => { if (bay(x, y) < 0.9 - u * 0.6) P(x, y, c); });
    }
  }
  function shockRing(cx, cy, r, ry, w, cols, fade_) { for (let k = 0; k < w; k++) ring(cx, cy, r - k, ry * (r - k) / Math.max(1, r), k < 1 ? cols[0] : k < w * 0.5 ? cols[1] : cols[2], (x, y) => bay(fl(x), fl(y)) < fade_); }
  function burst(cx, cy, u, R, rays, rot, cols, th) {
    if (u <= 0 || u >= 1) return; const len = R * eoc(u), w0 = th * (1 - u);
    for (let k = 0; k < rays; k++) { const a = rot + k * TAU / rays + (ih(k, 1, 71) - 0.5) * 0.25, L = len * (0.55 + 0.45 * ih(k, 2, 71)); lineF(cx, cy, cx + Math.cos(a) * L, cy + Math.sin(a) * L, (x, y, f) => { if (f > u * 0.85) { P(x, y, f < 0.6 ? cols[0] : cols[1]); if (w0 > 1.2) P(x + 1, y, cols[1]); } }); }
  }
  function debris(cx, cy, age, n, spread, up, cols, seed, g) {
    if (age < 0) return; g = g === undefined ? 260 : g;
    for (let k = 0; k < n; k++) { const a = -PI * (0.1 + 0.8 * ih(k, 1, seed)), v = spread * (0.4 + ih(k, 2, seed)); const x = cx + Math.cos(a) * v * age * 1.2, y = cy + Math.sin(a) * v * age * up + g * age * age, s = 1 + fl(ih(k, 3, seed) * 3); rectF(x, y, s, s, cols[k % cols.length]); }
  }
  // a swing smear: a crescent from angle a0 to a1 about (hx, hy), thick at its leading edge; drawn behind the last stamped sprite
  function smearArc(hx, hy, a0, a1, L, cols) {
    let d = a1 - a0; while (d > PI) d -= TAU; while (d < -PI) d += TAU; if (Math.abs(d) < 0.25) return;
    const Rm = L * 1.08, x0 = Math.max(0, fl(hx - Rm)), x1 = Math.min(W - 1, Math.ceil(hx + Rm)), y0 = Math.max(0, fl(hy - Rm)), y1 = Math.min(H - 1, Math.ceil(hy + Rm));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const i = y * W + x; if (SMASK[i]) continue;
      const dx = x + 0.5 - hx, dy = y + 0.5 - hy, r = Math.hypot(dx, dy); if (r > Rm || r < L * 0.55) continue;
      let rel = Math.atan2(dy, dx) - a0; rel = d > 0 ? ((rel % TAU) + TAU) % TAU : ((-rel % TAU) + TAU) % TAU; if (rel > Math.abs(d)) continue;
      const u = rel / Math.abs(d), rin = L * lerp(1.0, 0.62, u * u), rout = L * lerp(1.02, 1.07, u); if (r < rin || r > rout) continue;
      const e = (r - rin) / (rout - rin), b = bay(x, y); if (b > u * 1.6) continue;
      BUF[i] = e > 0.72 && u > 0.7 ? WHITE : u > 0.75 ? cols[2] : u > 0.45 ? (b < 0.5 ? cols[2] : cols[1]) : cols[0];
    }
  }
  // a hit (g seconds after it): ink flash, burst, ring, sparks, glow, shake
  function hitFx(x, y, g, power, cols) {
    if (g < 0 || g > 0.5) return; power = power || 1; cols = cols || [WHITE, C('gold', 6)];
    burst(x, y, g / 0.3, 90 * power, 14, ih(fl(x), fl(y), 611) * TAU, cols, 3);
    shockRing(x, y, 6 + g * 320 * power, 4 + g * 210 * power, 3, [WHITE, C('hush', 3), C('hush', 1)], 1 - g / 0.35);
    for (let k = 0; k < 18; k++) { const a = ih(k, fl(x), 612) * TAU, v = (60 + ih(k, 2, 612) * 170) * power, px = x + Math.cos(a) * v * g, py = y + Math.sin(a) * v * g + 200 * g * g; if (g < 0.4) { P(px, py, WHITE); P(px - Math.cos(a) * 2, py - Math.sin(a) * 2, cols[1]); } }
    glow(x, y, 50 * power * Math.max(0, 1 - g * 2), T_WH, 0.7);
    shk(5 * power * Math.max(0, 1 - g * 3));
    if (power >= 1 && g < (power >= 1.5 ? 0.067 : 0.034)) impactFrame(x, y, 1);
  }
  // the Hush: inside mask(x, y) → amount 0..1, colour drains to blank white, edges flicker with glyphs
  function hushOver(amt, t, flecks) {
    if (flecks === undefined) flecks = true;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const a = amt(x, y); if (a <= 0) continue;
      const i = y * W + x;
      if (a >= 1) { const l = LUM[BUF[i]]; BUF[i] = l > 150 ? WHITE : l > 80 ? C('hush', 6) : l > 40 ? C('hush', 4) : C('hush', 2); continue; }
      tintI(i, x, y, T_HUSH, a);
      if (flecks && a > 0.35 && a < 0.6 && ih(x >> 1, y >> 1, fl(t * 20)) < 0.05) BUF[i] = ih(x, y, 3) < 0.5 ? WHITE : C('crimson', 5);
    }
  }
  // a ring of white glyphs (the Hush sigil) as an ellipse on screen
  function sigil(cx, cy, r, ry, t, a, seed) {
    if (a <= 0) return;
    glow(cx, cy, r * 1.4, T_WH, 0.35 * a);
    for (let k = 0; k < 3; k++) {
      const rr = r * (1 - k * 0.16), rot = t * (k & 1 ? -0.4 : 0.3);
      for (let q = 0; q < 64; q++) {
        const ang = q / 64 * TAU + rot, x = cx + Math.cos(ang) * rr, y = cy + Math.sin(ang) * rr * (ry / r);
        if (ih(q, k, seed) > a) continue;
        const g = fl(ih(q, k + 7, seed) * 4);
        if (g === 0) { P(x, y, WHITE); P(x + 1, y, WHITE); P(x, y + 1, WHITE); } else if (g === 1) { P(x - 1, y, WHITE); P(x + 1, y, WHITE); P(x, y - 1, WHITE); } else if (g === 2) { P(x, y, WHITE); P(x, y - 1, C('hush', 3)); } else P(x, y, C('hush', 5));
      }
      ring(cx, cy, rr + 3, (rr + 3) * ry / r, C('hush', 4), (x, y) => bay(fl(x), fl(y)) < 0.5 * a);
    }
  }
  // a pixel glass shard / ember / dust in screen space
  function shard(x, y, s, ang, c, c2) { const ca = Math.cos(ang), sa = Math.sin(ang); for (let k = -s; k <= s; k++) { P(x + ca * k, y + sa * k, c); P(x + ca * k * 0.5 - sa, y + sa * k * 0.5 + ca, c2); } }

  // flames licking up from the last stamped sprite; cols: dark, mid, bright, core
  const ADIST = new Float32Array(NP);
  function aura(t, cols, Rr, opt) {
    opt = opt || {}; if (SMB[2] < SMB[0]) return; Rr = Math.max(2, Rr);
    const x0 = Math.max(0, SMB[0] - fl(Rr)), x1 = Math.min(W - 1, SMB[2] + fl(Rr)), y0 = Math.max(0, SMB[1] - fl(Rr * 2)), y1 = Math.min(H - 1, SMB[3] + fl(Rr * 0.8));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const i = y * W + x; ADIST[i] = SMASK[i] ? 0 : 1e9; }
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const i = y * W + x; let d = ADIST[i]; if (x > x0) d = Math.min(d, ADIST[i - 1] + 1); if (y > y0) { d = Math.min(d, ADIST[i - W] + 1); if (x > x0) d = Math.min(d, ADIST[i - W - 1] + 1.41); if (x < x1) d = Math.min(d, ADIST[i - W + 1] + 1.41); } ADIST[i] = d; }
    for (let y = y1; y >= y0; y--) for (let x = x1; x >= x0; x--) { const i = y * W + x; let d = ADIST[i]; if (x < x1) d = Math.min(d, ADIST[i + 1] + 1); if (y < y1) { d = Math.min(d, ADIST[i + W] + 1); if (x < x1) d = Math.min(d, ADIST[i + W + 1] + 1.41); if (x > x0) d = Math.min(d, ADIST[i + W - 1] + 1.41); } ADIST[i] = d; }
    const cyM = (SMB[1] + SMB[3]) / 2, hh = SMB[3] - SMB[1] + 1, sc = opt.scale || Math.max(1, Rr / 8), rise = opt.rise === undefined ? 1 : opt.rise;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const i = y * W + x; if (SMASK[i]) continue; const d = ADIST[i]; if (d > Rr * 2.2) continue;
      const up = y < cyM ? 1 + rise * (cyM - y) / hh * 1.1 : 0.75;
      const n = vn(x / sc, (y + t * 70 * rise) / sc, 4, 801) * 0.6 + vn(x / sc, (y + t * 110 * rise) / sc, 2, 802) * 0.4;
      const lim = Rr * up * (0.35 + 0.85 * n); if (d > lim) continue;
      const f = d / lim; if (f > 0.82 && bay(x, y) < 0.45) continue;
      BUF[i] = f < 0.25 ? cols[3] : f < 0.55 ? cols[2] : f < 0.82 ? cols[1] : cols[0];
    }
    const n = opt.sparks === undefined ? 16 : opt.sparks;
    for (let k = 0; k < n; k++) { const u = frac(ih(k, 1, 811) + t * (0.9 + ih(k, 2, 811))), x = lerp(SMB[0] - Rr * 0.5, SMB[2] + Rr * 0.5, ih(k, 3, 811)) + Math.sin(u * 6 + k) * 2, y = SMB[3] - u * (hh + Rr * 3); if (bay(fl(x), fl(y)) > 1 - u) continue; P(x, y, cols[u < 0.5 ? 3 : 2]); P(x, y + 1, cols[1]); }
  }
  // key tracks: [{t, ...numbers, ...anything}] — numbers ease (e: 'l' | 'o' | 'i' | 'io' | 's'), everything else holds
  const EASE = { l: (u) => u, o: eoc, i: eic, io: eio, b: eob, s: (u) => (u >= 1 ? 1 : 0) };
  function K(...keys) { for (let i = 1; i < keys.length; i++) for (const f in keys[i - 1]) if (!(f in keys[i]) && f !== 'e' && f !== 't') keys[i][f] = keys[i - 1][f]; return keys; }
  function trk(keys, t) {
    let k = 0; while (k < keys.length - 1 && keys[k + 1].t <= t) k++;
    const A = keys[k], B = keys[k + 1], o = Object.assign({}, A);
    if (B && t > A.t) { const u = EASE[B.e || 'io'](clamp((t - A.t) / (B.t - A.t), 0, 1)); for (const f in A) if (typeof A[f] === 'number' && typeof B[f] === 'number' && f !== 't') o[f] = A[f] + (B[f] - A[f]) * u; }
    return o;
  }
  // hit-stop: the clock stops for d seconds at each hit (hits in track time)
  function stopClock(lt, hits, d) { let o = lt, fz = false; for (let k = 0; k < hits.length; k++) { const h = hits[k] + k * d; if (lt >= h && lt < h + d) fz = true; o -= clamp(lt - h, 0, d); } return [o, fz]; }
  // a splash: a column and a crown of water drops (world point, age g)
  function splash3(x, y, z, g, size) {
    if (g < 0 || g > 1.6) return; size = size || 1;
    for (let k = 0; k < 60; k++) { const a = ih(k, 1, 821) * TAU, v = (1.5 + ih(k, 2, 821) * 3) * size, up = (4 + ih(k, 3, 821) * 6) * size; const px = x + Math.cos(a) * v * g, pz = z + Math.sin(a) * v * g * 0.6, py = y + up * g - 9.8 * g * g; if (py < y - 0.2) continue; p3(px, py, pz, k % 3 ? C('sea', 7) : WHITE, 0.12 * size); }
    for (let k = 0; k < 14; k++) { const h = (1 - g / 1.6) * 3 * size * (0.6 + ih(k, 4, 821) * 0.5); l3(x + (ih(k, 5, 821) - 0.5) * size, y, z + (ih(k, 6, 821) - 0.5) * size, x + (ih(k, 5, 821) - 0.5) * size * 1.2, y + h, z + (ih(k, 6, 821) - 0.5) * size, k & 1 ? C('sea', 6) : C('sea', 7), 2); }
  }
