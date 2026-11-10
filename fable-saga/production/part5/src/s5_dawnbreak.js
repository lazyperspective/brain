  /* ================================================================ ACT IV — dawnbreak (23.0–29.4)
     23.0 DAWNBREAK: it drinks the darkness of the blade that pins it; the blade drains, cracks and crumbles into it. Half
     dawn fire, half star-flecked night; a ring of sunrise behind its head with the four sparks orbiting it; a wing of light
     and a wing of night; a blade half white, half black. The world is redrawn outward from it as a cosmos of glowing line:
     a burning horizon under a striped sun and its rings, ranges of mountains and ruined towers in contour and hatching,
     floating islands, nebulae drawn as contour lines, constellations, embers. 25.0 / 25.4 / 25.7 / 26.0 / 26.2 / 26.4 six
     strikes, six camera set-ups, cut on each impact: a rising cut chips the mask; a chop takes the blade arm; a vault takes
     a wing; a thrust puts out the crimson eye; a spinning kick bursts its body; a dash through it strips its fire. 27.0 an
     uppercut; 27.6 / 28.2 / 28.8 it is driven up through three panes of sky (the stair city, the ink void, the hanging
     ocean); at the top it re-knits its arm out of the dark and both blades race out to the length of the world.
     The world painter and a few helpers are shared with s6 through WORLDS.d5line (the one registry both files see). */
  {
  /* ---------------------------------------------------------------- the Dawnbreak world */
  const D5 = { hy: 200, sx: 330 };
  const D5WR = new Float32Array(W);
  const d5wrap = (v, w) => ((v % w) + w) % w;
  // a layer's screen point: p 0 (infinitely far) .. 1 (the fighters' plane)
  const d5Lx = (V, wx, p) => 240 + (wx - 240 - (V.x - 240) * p) * (1 + (V.z - 1) * p);
  const d5Ly = (V, wy, p) => 135 + (wy - 135 - (V.y - 135) * p) * (1 + (V.z - 1) * p);
  // constellations: a figure of 5–7 stars, each joined to the one before (and one branch)
  const CONS = []; for (let k = 0; k < 9; k++) { const n = 5 + (k % 3), pts = []; let x = 0, y = 0; for (let q = 0; q < n; q++) { pts.push([x, y]); x += 14 + ih(k, q, 9701) * 26; y += (ih(k, q, 9702) - 0.5) * 34; } CONS.push({ x: ih(k, 1, 9703) * 700, y: ih(k, 2, 9703) * 520, pts, br: 1 + fl(ih(k, 3, 9703) * (n - 2)) }); }
  // floating islands, through the whole height the chase climbs
  const ISL = []; for (let k = 0; k < 16; k++) ISL.push({ wx: ih(k, 1, 9711) * 760, wy: 168 - k * 92 - ih(k, 2, 9711) * 40, w: 26 + ih(k, 3, 9711) * 46, d: 0.7 + ih(k, 4, 9711) * 0.7, p: 0.38 + ih(k, 5, 9711) * 0.3, ruin: ih(k, 6, 9711) < 0.5 });
  const TWR = []; for (let k = 0; k < 9; k++) TWR.push({ wx: 30 + k * 84 + ih(k, 1, 9712) * 40, h: 20 + ih(k, 2, 9712) * 44, w: 5 + fl(ih(k, 3, 9712) * 7), lean: (ih(k, 4, 9712) - 0.5) * 0.25, brk: ih(k, 5, 9712) });
  const NEB = new Float32Array(121 * 62);
  const d5Col = (x, y, cool, warm) => (bay(x + 3, y + 5) < D5WR[clamp(fl(x), 0, W - 1)] ? warm : cool);
  // the burning horizon: a white-hot line, flames licking up, embers; curve(x) lifts it (the hand that takes it)
  function d5Horizon(t, hy, burn, xa, xb, curve, ox) {
    xa = Math.max(0, fl(xa)); xb = Math.min(W, xb);
    for (let x = xa; x < xb; x++) {
      const wx = x + ox * 0.6, y = Math.round(hy - (curve ? curve(x) : 0)), hgt = (1.5 + 8 * Math.pow(vn(wx * 0.35, t * 4.5, 1, 8630), 2) + 3.5 * vn(wx * 0.08, t * 1.5, 1, 8631)) * burn;
      for (let q = 0; q < hgt; q++) { const u = q / hgt; if (bay(x, y - 2 - q) < 1.1 - u) P(x, y - 2 - q, u < 0.25 ? 140 : u < 0.5 ? 141 : u < 0.78 ? 110 : 105); }
      P(x, y + 2, bay(x, y + 2) < 0.5 ? 141 : 110); P(x, y - 1, 22); P(x, y, 22); P(x, y + 1, 140); if (burn > 0.8 && bay(x, y + 3) < 0.4) P(x, y + 3, 110);
    }
    for (let k = 0; k < 70; k++) { const u = frac(ih(k, 1, 8632) + t * (0.3 + ih(k, 2, 8632) * 0.5)), x = xa + ih(k, 3, 8632) * (xb - xa) + Math.sin(u * 7 + k) * 4, y = hy - (curve ? curve(x) : 0) - 3 - u * (20 + ih(k, 4, 8632) * 56); if (x >= xa && x < xb && bay(fl(x), fl(y)) < (1 - u) * burn) P(x, y, u < 0.3 ? 140 : u < 0.6 ? 141 : 105); }
    for (let x = Math.max(30, xa); x < xb; x += 70) light(x, hy - (curve ? curve(x) : 0), 46, L_GOLD, 0.36 * burn);
  }
  // a range: ridge from fbm, filled black, its ridge and nested contours glowing (warm toward the sun, violet and teal away),
  // hatching on the slopes that face away from the light; ruins stand on the far one
  function d5Range(t, V, hy, p, base, amp, scale, seed, cool, warm, hatch, towers, tone) {
    const zf = 1 + (V.z - 1) * p, top = LB; let py = null, pyk = [null, null, null];
    const hs = new Float32Array(W);
    for (let x = 0; x < W; x++) { const wx = (x - 240) / zf + 240 + (V.x - 240) * p, f = fbm(wx, seed, scale, 4, seed); hs[x] = (base + amp * Math.max(0, f - 0.32) * 2.6) * zf; }
    for (let x = 0; x < W; x++) {
      const hgt = hs[x], y = Math.round(hy - hgt); if (y >= hy) { py = null; continue; }
      for (let yy = Math.max(top, y); yy < hy; yy++) BUF[yy * W + x] = bay(x, yy) < tone * (1 - (hy - yy) / (hgt + 8) * 0.5) ? d5Col(x, yy, 139, 9) : 0;
      const sl = x ? hs[x] - hs[x - 1] : 0, lit = (x < D5.sx ? -sl : sl) > 0.02;
      const c0 = d5Col(x, y, lit ? cool[0] : cool[1], lit ? warm[0] : warm[1]);
      if (py !== null) for (let yy = Math.min(y, py); yy <= Math.max(y, py); yy++) if (yy >= top) P(x, yy, c0); py = y;
      if (y + 1 < hy) P(x, y + 1, d5Col(x, y, cool[1], warm[1]));
      // nested contours: the same ridge, lower, dimmer, dashed
      for (let k = 0; k < 3; k++) { const yk = Math.round(hy - hgt * (0.74 - k * 0.22)); if (yk >= hy - 1 || yk < top) continue; const on = (fl((x + (V.x * p) * zf) / (3 + k * 2)) % (k + 2)) !== 0; if (on) P(x, yk, d5Col(x, yk, cool[2 + Math.min(k, 1)], warm[2 + Math.min(k, 1)])); }
      // hatching on the side away from the light
      if (!lit && fl(x + V.x * p * zf) % 3 === 0) { const L = Math.min(hgt * 0.55, 3 + hgt * 0.4); for (let q = 2; q < L; q++) if (bay(x, y + q) < 0.9 - q / L * 0.7) P(x - q * 0.35, y + q, hatch); }
    }
    if (towers) for (const T of TWR) {
      const x0 = Math.round(240 + (T.wx - 240 - (V.x - 240) * p) * zf); if (x0 < -20 || x0 > W + 20) continue;
      const by = Math.round(hy - (hs[clamp(x0, 0, W - 1)] || 0)) + 2, h = T.h * zf, w = Math.max(3, Math.round(T.w * zf)), c = d5Col(x0, by, cool[0], warm[0]), c2 = d5Col(x0, by, cool[2], warm[2]);
      for (let q = 0; q < h; q++) { const y = by - q, lx = x0 + Math.round(T.lean * q); if (y < top) break; const brk = q > h * (0.7 + 0.3 * T.brk) - (lx & 1) * 3; if (brk) break; rectF(lx + 1, y, w - 1, 1, 0); P(lx, y, c); P(lx + w, y, c); if (q % 7 === 3 && w > 4) for (let i = 2; i < w - 1; i += 2) P(lx + i, y, ih(T.wx + i, q, 9713) < 0.3 ? 141 : c2); }
      const tq = h * (0.7 + 0.3 * T.brk); for (let i = 0; i <= w; i++) P(x0 + Math.round(T.lean * tq) + i, by - tq + Math.round(Math.abs(Math.sin(i * 1.7 + T.wx)) * 3), c);
      if (T.brk > 0.6) lineP(x0 + w / 2 + T.lean * tq, by - tq, x0 + w / 2 + T.lean * tq + 2, by - tq - 9 * zf, c);
    }
  }
  /* o: { hz (world y of the horizon), sunX, burn, noLine, noSun, curve (fn x → lift), dim } */
  function d5World(t, V, o) {
    o = o || {};
    const top = LB, bot = H - LB, z = V.z;
    const hy = Math.round(d5Ly(V, o.hz === undefined ? 200 : o.hz, 0.5)), sx = d5Lx(V, o.sunX === undefined ? 330 : o.sunX, 0.15), burn = o.burn === undefined ? 1 : o.burn;
    D5.hy = hy; D5.sx = sx;
    for (let x = 0; x < W; x++) { const d = (x - sx) / 200; D5WR[x] = Math.exp(-d * d) * 0.96; }
    // the sky: black at the zenith, deep indigo to the horizon, burning plum and wine toward the sun
    const NR = [0, 0, 0, 138, 138, 139, 139, 3], WRr = [0, 0, 0, 138, 9, 9, 10, 10];
    for (let y = top; y < bot; y++) {
      const row = y * W, d = hy - y;
      if (d < 0) { const k = -d; for (let x = 0; x < W; x++) BUF[row + x] = k < 18 && bay(x, y) < (1 - k / 18) * 0.55 ? (bay(x + 1, y + 2) < D5WR[x] ? 9 : 138) : 0; continue; }
      const f = clamp(1 - d / 260, 0, 0.999) * (NR.length - 1), k = fl(f), r = f - k, wk = clamp(1.5 - d / 150, 0, 1);
      for (let x = 0; x < W; x++) { const R = bay(x + 2, y + 1) < D5WR[x] * wk ? WRr : NR; BUF[row + x] = bay(x, y) < r ? R[k + 1] : R[k]; }
    }
    // nebulae, drawn as contour lines of a slow field
    {
      const p = 0.07, ox = (V.x - 240) * p, oy = (V.y - 135) * p;
      for (let j = 0; j < 62; j++) for (let i = 0; i < 121; i++) NEB[j * 121 + i] = fbm(i * 4 + ox, j * 4 + oy + t * 1.5, 90, 3, 9714);
      for (let y = top; y < Math.min(bot, hy - 6); y++) {
        const gy = (y - top) / 4, j = Math.min(60, fl(gy)), fy = gy - j;
        for (let x = 0; x < W; x++) {
          const gx = x / 4, i = Math.min(119, fl(gx)), fx = gx - i, q = j * 121 + i;
          const n = (NEB[q] * (1 - fx) + NEB[q + 1] * fx) * (1 - fy) + (NEB[q + 121] * (1 - fx) + NEB[q + 122] * fx) * fy;
          if (n < 0.5) continue;
          const lv = (n - 0.5) * 16, fr = frac(lv);
          if (fr < 0.08 && ((x + y) & 1)) BUF[y * W + x] = n > 0.68 ? d5Col(x, y, 127, 131) : n > 0.6 ? d5Col(x, y, 6, 133) : d5Col(x, y, 5, 10);
          else if (n > 0.6 && bay(x, y) < (n - 0.6) * 1.4) BUF[y * W + x] = d5Col(x, y, 139, 9);
        }
      }
    }
    // an aurora drawn in vertical strokes: a curtain of first light over the night side, gold where it nears the sun
    if (hy > top + 40) {
      const p = 0.1, zf = 1 + (z - 1) * p;
      for (let x = 0; x < W; x += 2) {
        const wx = (x - 240) / zf + 240 + (V.x - 240) * p, yc = hy - (118 + Math.sin(wx * 0.011 + t * 0.25) * 26 + Math.sin(wx * 0.033 - t * 0.4) * 9) * zf, n = vn(wx * 0.9, t * 0.6, 22, 9741), L = (14 + 46 * n * n) * zf, br = vn(wx * 0.5, -t * 0.8, 9, 9742);
        if (br < 0.3) continue;
        for (let q = 0; q < L; q++) { const y = yc + q, u = q / L; if (y < top || y > hy - 30) continue; if (bay(x, fl(y)) > (1 - u) * (br - 0.2) * 1.5) continue; P(x, y, u < 0.15 ? d5Col(x, y, 129, 141) : u < 0.45 ? d5Col(x, y, 128, 110) : u < 0.75 ? d5Col(x, y, 6, 12) : d5Col(x, y, 5, 10)); }
      }
      light(d5Lx(V, 120, 0.1), hy - 110, 160, L_COLD, 0.12);
    }
    // stars
    for (let k = 0; k < 230; k++) {
      const p = 0.03 + (k % 4) * 0.03, x = d5wrap(ih(k, 1, 9720) * 640 - (V.x - 240) * p, 640) - 80, y = d5wrap(ih(k, 2, 9720) * 560 - (V.y - 135) * p, 560) - 140;
      if (y < top || y > hy - 4 || x < 0 || x >= W) continue;
      const tw = frac(ih(k, 3, 9720) + t * (0.3 + ih(k, 4, 9720) * 0.5));
      if (k % 13 === 0) { const L = 2 + 2 * Math.sin(tw * TAU); sparkle(x, y, L, 22, d5Col(x, y, 57, 141)); light(x, y, 10, L_COLD, 0.25); }
      else if (k % 3 === 0) P(x, y, tw < 0.8 ? d5Col(x, y, 57, 141) : 6);
      else if (tw < 0.85) P(x, y, d5Col(x, y, k & 1 ? 5 : 128, 133));
    }
    // constellations
    for (let k = 0; k < CONS.length; k++) {
      const C = CONS[k], p = 0.06, bx = d5wrap(C.x - (V.x - 240) * p, 700) - 110, by = d5wrap(C.y - (V.y - 135) * p, 520) - 100 + top;
      const pts = C.pts.map(([px, py]) => [bx + px, by + py]);
      const seg = (a, b) => lineF(a[0], a[1], b[0], b[1], (x, y, u) => { if (y < top || y > hy - 18 || u < 0.12 || u > 0.88) return; if (((x + y) & 1) === 0) P(x, y, d5Col(x, y, k % 2 ? 126 : 6, 132)); });
      for (let q = 1; q < pts.length; q++) seg(pts[q - 1], pts[q]);
      if (pts.length > 3) seg(pts[C.br], [pts[C.br][0] + 10, pts[C.br][1] + 26]);
      for (let q = 0; q < pts.length; q++) { const [x, y] = pts[q]; if (y < top || y > hy - 18) continue; const tw = frac(ih(k, q, 9721) + t * 0.5); P(x, y, 22); if (q === 0 || tw < 0.3) sparkle(x, y, 1.5 + tw * 2, 22, d5Col(x, y, 57, 141)); else { P(x + 1, y, d5Col(x, y, 57, 141)); P(x - 1, y, d5Col(x, y, 57, 141)); } }
    }
    // the sun: striped half-disc on the line, its rings (an astrolabe), long thin rays
    if (!o.noSun && hy > top - 40) {
      const zr = 1 + (z - 1) * 0.2, SR = 40 * zr;
      const RG = [[56, 141, 0, 0], [70, 110, 3, 0.5], [92, 13, 0, 0], [124, 12, 5, -0.3], [168, 133, 7, 0.15], [226, 132, 0, 0], [300, 10, 4, -0.1]];
      for (let r = 0; r < RG.length; r++) {
        const [R0, c, dash, spin] = RG[r], R = R0 * zr;
        for (let a = PI; a < TAU; a += 0.55 / R) { const x = sx + Math.cos(a) * R, y = hy + Math.sin(a) * R; if (y >= hy - 2 || y < top || x < 0 || x >= W) continue; if (dash && fl(a * R / 3 + t * spin * 12) % dash === 0) continue; P(x, y, c); }
        if (r === 2 || r === 4) for (let d = 0; d < 36; d++) { const a = PI + d / 36 * PI + t * 0.02 * (r === 2 ? 1 : -1), L = (d % 3 === 0 ? 7 : 3) * zr; lineP(sx + Math.cos(a) * R, hy + Math.sin(a) * R, sx + Math.cos(a) * (R - L), hy + Math.sin(a) * (R - L), r === 2 ? 110 : 12); }
      }
      for (let k = 0; k < 40; k++) {
        const a = PI + (k + 0.5) / 40 * PI + Math.sin(t * 0.3) * 0.01, r0 = (60 + (k % 2) * 8) * zr, r1 = r0 + (40 + ih(k, 1, 9722) * 230 + Math.sin(t * 1.3 + k) * 10) * zr, ca = Math.cos(a), sa = Math.sin(a);
        lineF(sx + ca * r0, hy + sa * r0, sx + ca * r1, hy + sa * r1, (x, y, u) => { if (y > top && y < hy - 2 && bay(x, y) < 1 - u * 0.8) P(x, y, u < 0.25 ? 141 : u < 0.55 ? 110 : u < 0.8 ? 12 : 10); });
      }
      for (let y = Math.max(top, fl(hy - SR)); y < hy; y++) {
        const dy = hy - y, v = dy / SR, half = Math.sqrt(Math.max(0, SR * SR - dy * dy)), gap = v < 0.6 && frac(dy / (2.2 + v * 9)) < (0.6 - v) * 0.75;
        if (gap) continue;
        const c = v > 0.78 ? 16 : v > 0.55 ? 15 : v > 0.33 ? 141 : v > 0.16 ? 110 : 14;
        for (let x = Math.max(0, fl(sx - half)); x < Math.min(W, sx + half); x++) BUF[y * W + x] = c;
      }
      light(sx, hy - SR * 0.5, 170 * zr, L_WARM, 0.4 * burn); light(sx, hy, 280, L_GOLD, 0.14 * burn);
    }
    // far ranges with ruins; the near range
    if (hy > top - 4 && hy < bot + 120) {
      d5Range(t, V, hy, 0.12, 6, 74, 150, 9730, [57, 6, 5, 139], [141, 110, 13, 10], 139, true, 0.3);
      d5Range(t, V, hy, 0.3, 2, 40, 110, 9731, [129, 128, 126, 125], [22, 140, 110, 12], 138, false, 0.12);
      // heat haze: the rows over the line shiver, and broken bands of heat hang in them
      for (let y = Math.max(top, hy - 18); y < hy - 1; y++) { const sh = Math.round(Math.sin(y * 1.7 + t * 9) * 1.4 * (1 - (hy - y) / 18) + Math.sin(y * 0.6 - t * 5) * 0.6), row = y * W; if (!sh) continue; if (sh > 0) for (let x = W - 1; x >= sh; x--) BUF[row + x] = BUF[row + x - sh]; else for (let x = 0; x < W + sh; x++) BUF[row + x] = BUF[row + x - sh]; }
      for (let k = 0; k < 5; k++) { const y = hy - 4 - k * (2 + k), c = [110, 14, 13, 12, 10][k]; for (let x = 0; x < W; x++) { const n = vn(x * 0.06 + k * 5, t * (1.5 + k * 0.4), 1, 9732 + k); if (n > 0.55 - D5WR[x] * 0.15 && bay(x, y) < (n - 0.5) * 3) P(x, y + Math.sin(x * 0.04 + t * 3 + k) * 0.8, c); } }
    }
    // below the line: the cloud sea drawn as contour waves, the sun's road on it, perspective lines to the sun
    if (hy < bot) {
      for (let k = 0; k < 14; k++) { const a = PI * 0.04 + k / 13 * PI * 0.92; lineF(sx, hy + 2, sx + Math.cos(a) * 700, hy + 2 + Math.sin(a) * 700, (x, y, u) => { if (y > hy + 4 && y < bot && (x + y) % 3 === 0 && bay(x, y) < 0.7 - u * 0.4) P(x, y, d5Col(x, y, 139, 9)); }); }
      for (let k = 1; k <= 10; k++) {
        const y0 = hy + 3 + k * k * 1.5; if (y0 >= bot) break; if (y0 < top) continue;
        const cw = k < 2 ? 141 : k < 4 ? 110 : k < 6 ? 13 : k < 8 ? 12 : 10, cc = k < 3 ? 57 : k < 5 ? 128 : k < 7 ? 6 : 5;
        for (let x = 0; x < W; x++) { const wx = x + (V.x - 240) * (0.3 + k * 0.12), n = vn(wx, k * 7, 26 + k * 6, 8620); if (n < 0.32 + k * 0.02) continue; const y = y0 + Math.sin(wx * 0.05 / (0.4 + k * 0.1) + t * (1.4 - k * 0.1) + k) * (0.6 + k * 0.5); P(x, y, d5Col(x, y, cc, cw)); }
      }
      for (let k = 0; k < 34; k++) { const x = sx + (ih(k, 1, 8621) - 0.5) * 80, y = hy + 4 + ih(k, 2, 8621) * 90, L = 2 + ih(k, 3, 8621) * 10 * ((y - hy) / 90 + 0.3); if (y < bot && frac(ih(k, 4, 8621) + t * 0.8) < 0.7) lineP(x - L, y, x + L, y, y < hy + 24 ? 140 : 141); }
    }
    // the horizon
    if (!o.noLine && hy > top - 10 && hy < bot + 10) d5Horizon(t, hy, burn, 0, W, o.curve, V.x);
    // floating islands: black rock, the lit rim of their tops, hatched undersides, roots, a ruin on some
    for (let k = 0; k < ISL.length; k++) {
      const I = ISL[k], zf = 1 + (z - 1) * I.p, cx = d5wrap(I.wx - (V.x - 240) * I.p + t * 3 * (k & 1 ? 1 : -1), 760) - 140, cy = d5Ly(V, I.wy, I.p) + Math.sin(t * 0.8 + k) * 2.5;
      const w = I.w * zf, d = w * I.d; if (cx < -w || cx > W + w || cy < top - d - 20 || cy > bot + 10) continue;
      const lit = cx < sx ? 1 : -1;
      for (let x = Math.max(0, fl(cx - w)); x < Math.min(W, cx + w); x++) {
        const u = (x - cx) / w, ytop = Math.round(cy - 2 - 3 * vn(x - cx, k, 6, 9733) - (1 - u * u) * 3), yb = Math.round(cy + d * Math.pow(1 - Math.abs(u), 1.4) * (0.6 + 0.4 * vn(x - cx, k, 4, 9734)));
        for (let y = Math.max(top, ytop); y <= Math.min(bot - 1, yb); y++) BUF[y * W + x] = 0;
        const rim = u * lit < 0.3 ? d5Col(x, ytop, 135, 22) : d5Col(x, ytop, 128, 141);
        P(x, ytop, rim); if (u * lit < -0.2) P(x, ytop + 1, d5Col(x, ytop, 57, 140));
        P(x, yb, d5Col(x, yb, 5, 12));
        for (let y = ytop + 4; y < yb - 1; y += 3) if (((x + (y >> 1)) & 3) === 0 && bay(x, y) < 0.8) P(x, y, (u * lit) > 0.1 ? 139 : d5Col(x, y, 5, 10));
        if (fl(x - cx) % 9 === 0 && ih(fl(x - cx), k, 9735) < 0.6) { const L = 4 + ih(fl(x - cx), k, 9736) * 12 * zf; for (let q = 0; q < L; q++) if (bay(x, yb + q) < 1 - q / L) P(x + Math.sin(q * 0.4 + t + k) * 0.8, yb + q, d5Col(x, yb, 5, 10)); }
      }
      if (I.ruin && w > 18) for (let q = -1; q <= 1; q++) { const px = cx + q * w * 0.35, ph = (6 + ih(k, q + 2, 9737) * 10) * zf, py = cy - 4; lineP(px, py, px, py - ph, d5Col(px, py, 57, 141)); lineP(px + 2, py, px + 2, py - ph * 0.8, d5Col(px, py, 6, 110)); if (q === 0) lineP(px - w * 0.35, py - ph * 0.9, px + w * 0.35, py - ph * 0.7, d5Col(px, py, 6, 110)); }
    }
    // embers drifting up, and star-dust drifting down on the night side
    for (let k = 0; k < 80; k++) {
      const p = 0.6 + ih(k, 1, 9740) * 0.6, u = frac(ih(k, 2, 9740) + t * (0.12 + ih(k, 3, 9740) * 0.2)), x = d5wrap(ih(k, 4, 9740) * 560 - (V.x - 240) * p + Math.sin(t * 1.3 + k) * 8 + u * 40, 560) - 40, y = d5wrap(bot + 20 - u * 300 - (V.y - 135) * p * 0.6, 320) + top - 10;
      if (x < 0 || x >= W || y < top || y >= bot) continue; const c = d5Col(x, y, k % 3 ? 56 : 128, k % 3 ? 141 : 110);
      if (bay(fl(x), fl(y)) < 1 - u * 0.6) { P(x, y, c); if (k % 7 === 0) { P(x, y + 1, c === 141 ? 110 : 6); } }
    }
    if (o.dim) tintAll(T_DARK, o.dim);
  }
  // the nearest layer, drawn after the fighters: black rocks with burning rims sliding past, and out-of-focus embers
  function d5Fore(t, V, o) {
    o = o || {}; const amt = o.amt === undefined ? 1 : o.amt; if (amt <= 0) return;
    for (let k = 0; k < 3; k++) {
      const p = 1.7 + k * 0.3, zf = 1 + (V.z - 1) * 0.6, cx = d5wrap(ih(k, 1, 9750) * 900 - (V.x - 240) * p - t * 30, 900) - 210, cy = H - LB + 6 - (k === 1 ? 4 : 0) - (V.y - 135) * p * 0.3, r = (26 + ih(k, 2, 9750) * 22) * zf;
      if (cx < -r * 1.6 || cx > W + r * 1.6) continue;
      const pts = []; for (let q = 0; q < 9; q++) { const a = PI + q / 8 * PI, rr = r * (0.75 + 0.35 * ih(k, q, 9751)); pts.push([cx + Math.cos(a) * rr * 1.5, cy + Math.sin(a) * rr]); }
      pts.push([cx + r * 1.5, H]); pts.push([cx - r * 1.5, H]);
      polyF(pts, () => 0);
      for (let q = 0; q < 8; q++) { const [ax, ay] = pts[q], [bx, by] = pts[q + 1], lit = cx > D5.sx ? q < 4 : q >= 4; lineP(ax, ay, bx, by, lit ? (cx > D5.sx - 100 ? 141 : 128) : 139); if (lit) lineP(ax, ay + 1, bx, by + 1, cx > D5.sx - 100 ? 110 : 5); }
    }
    for (let k = 0; k < 10; k++) { const u = frac(ih(k, 1, 9752) + t * 0.18), x = d5wrap(ih(k, 2, 9752) * 600 - (V.x - 240) * 2 + Math.sin(t + k) * 20, 600) - 60, y = H - LB - u * (H - 2 * LB) - (V.y - 135) * 1.2 % 200; if (y < LB || y > H - LB - 3) continue; const r = 1.2 + ih(k, 3, 9752) * 1.8; if (bay(k, fl(t * 30)) < 0.85 * amt) { discF(x, y, r, k % 3 ? 110 : 141); if (r > 2) P(x, y, 16); } light(x, y, 10, L_WARM, 0.3 * amt); }
  }

  /* ---------------------------------------------------------------- shared helpers: hit-stop, a blow, the two fighters */
  // the clock holds at each hit for its hold, then runs fast until it has caught up by the next hit (or soon after)
  function d5Stop(t, hits) {
    for (let i = 0; i < hits.length; i++) { const [h, d] = hits[i], end = Math.min(i + 1 < hits.length ? hits[i + 1][0] : 1e9, h + d + Math.max(0.24, d * 3)); if (t >= h && t < end) { if (t < h + d) return h; return h + (end - h) * (t - h - d) / (end - h - d); } }
    return t;
  }
  const d5Held = (t, hits) => { for (const [h, d] of hits) if (t >= h && t < h + d) return true; return false; };
  const d5On = (t, h) => Math.round(t * 30) === Math.round(h * 30);
  // a heavy blow at (x, y) for hit time h held for hold: the effect is held with the clock, the one ink frame on the hit frame
  function d5Heavy(x, y, g, pw, dir, cols, seed, imp, keep, lcol) {
    if (g < 0 || g > 1.2) return;
    if (g < 0.5) {
      shockRing(x, y, 8 + g * 380 * pw, 5 + g * 210 * pw, 2 + pw, [22, cols[1], cols[2]], 1 - g / 0.5);
      if (pw >= 2) shockRing(x, y, 4 + g * 240 * pw, 3 + g * 80 * pw, 2, [cols[1], cols[2], cols[2]], 1 - g / 0.45);
      burst(x, y, g / 0.3, 60 * pw, 12 + 4 * pw, ih(fl(x), fl(y), seed) * TAU, [cols[0], cols[1]], 3);
    }
    for (let k = 0; k < 14 + 8 * pw; k++) {
      const a = dir === undefined ? ih(k, 1, seed) * TAU : dir + (ih(k, 1, seed) - 0.5) * 1.3, v = (100 + ih(k, 2, seed) * 300) * Math.sqrt(pw), px = x + Math.cos(a) * v * g, py = y + Math.sin(a) * v * g + 120 * g * g;
      if (g < 0.6) lineP(px, py, px - Math.cos(a) * (6 + pw * 4), py - Math.sin(a) * (6 + pw * 4), g < 0.15 ? cols[0] : cols[1]);
    }
    light(x, y, 26 * pw * Math.max(0, 1 - g * 3), L_WH, 0.5);
    light(x, y, 56 * pw * Math.max(0, 1 - g * 1.8), lcol || L_WARM, 0.32);
    if (g < 0.14) GD.ca = Math.max(GD.ca, 2 * pw * (1 - g / 0.14));
    shk(Math.min(4.2, 1.8 * pw) * Math.max(0, 1 - g * 2.5));
    if (imp) h5Impact(x, y, imp === 2 ? 1 : 0, keep);
  }
  function d5Hit(x, y, t, h, hold, pw, dir, cols, seed, imp, keep, lcol) {
    const g = t < h ? -1 : t < h + hold ? 0.012 : t - h - hold * 0.7;
    if (g < 0 || g > 1.2) return;
    d5Heavy(x, y, g, pw, dir, cols, seed, d5On(t, h) ? imp : 0, keep, lcol);
    if (t >= h && t < h + hold) { shk(0.6 + pw * 0.5); GD.ca = Math.max(GD.ca, 1.2 + pw * 0.6); }
  }
  // Dawnbreak: the duel kit's fighter, plus its own light: a two-sided rim, the four sparks orbiting the halo, embers off its
  // dawn side and star-dust off its night side
  function d5Hero(keys, tt, V, o) {
    o = o || {};
    const R = h5F(keys, tt, { frz: o.frz }, V); if (!R) return R;
    const p = R.p, S = R.S, t = T_NOW, fw = p.flip ? -1 : 1;
    z5Rim(fw, -0.5, 140, Math.max(1, S * 0.7)); z5Rim(-fw, -0.2, 56, Math.max(1, S * 0.6));
    if (o.noFx) return R;
    const hx = R.x - Math.sin(p.ang) * 3 * S, hy = R.y - Math.cos(p.ang) * 3 * S, rr = 15 * S * (p.ringR === undefined ? 1 : p.ringR), ra = (p.ring === undefined ? 1 : p.ring) * (p.glow === undefined ? 1 : p.glow);
    if (ra > 0.05) {
      for (let a = 0; a < TAU; a += 0.7 / rr) { const ar = rr * 1.32, x = hx + Math.cos(a) * ar, y = hy + Math.sin(a) * ar; if (fl(a * ar / 2 - t * 9) % 3 === 0 && bay(fl(x), fl(y)) < ra) P(x, y, Math.sin(a) < 0 ? 141 : 56); }
      for (let k = 0; k < 4; k++) { const a = t * 2.2 + k * TAU / 4, ex = hx + Math.cos(a) * rr * 1.32, ey = hy + Math.sin(a) * rr * 1.32 * 0.9; if (ra > 0.3) { discF(ex, ey, 1.6 + S * 0.25, ORB[k][1]); P(ex, ey, 22); for (let q = 1; q < 5; q++) { const b = a - q * 0.09; P(hx + Math.cos(b) * rr * 1.32, hy + Math.sin(b) * rr * 1.32 * 0.9, ORB[k][q < 2 ? 2 : 1]); } light(ex, ey, 14, [L_COLD, [0.5, 1, 0.4], L_GOLD, L_VIO][k], 0.4 * ra); } }
    }
    const n = o.motes === undefined ? 22 : o.motes;
    for (let k = 0; k < n; k++) { const sd = k & 1, u = frac(ih(k, 1, 9760) + t * (0.7 + ih(k, 2, 9760) * 0.8)), sx = R.x + fw * (sd ? 1 : -1) * (6 + ih(k, 3, 9760) * 10) * S, sy = R.y + (ih(k, 4, 9760) - 0.5) * 12 * S; const x = sx + fw * (sd ? 1 : -1) * u * 6 * S - (p.vx || 0) * 0.05 * u, y = sy + (sd ? -1 : 0.6) * u * 14 * S - (p.vy || 0) * 0.05 * u; if (bay(fl(x), fl(y)) < 1 - u) P(x, y, sd ? (u < 0.4 ? 22 : 141) : (u < 0.4 ? 57 : 56)); }
    return R;
  }
  // the Hollow, with what has been broken off it
  function d5Hol(keys, tt, V, o) {
    o = o || {};
    const E = h5F(keys, tt, { frz: o.frz }, V); if (!E) return E;
    const p = E.p, S = E.S, t = T_NOW;
    z5Rim(p.flip ? 1 : -1, -0.3, 72, Math.max(1, S * 0.5));
    if (p.form === 'hollow') z5Rim(p.flip ? -1 : 1, -0.4, 75, Math.max(1, S * 0.45), 73);
    if (p.eyeC === false) { const e = h5Loc(p, E.x, E.y, S, 7.5, -2); for (let k = 0; k < 5; k++) { const a = -PI / 2 + (k - 2) * 0.7 + (p.flip ? PI : 0) * 0, L = (3 + ih(k, 1, 9765) * 4) * S; lineF(e[0], e[1], e[0] + Math.cos(a) * L, e[1] + Math.sin(a) * L, (x, y, u) => { if (SMASK[clamp(y, 0, H - 1) * W + clamp(x, 0, W - 1)] && u > 0.15) P(x, y, u < 0.5 ? 107 : 104); }); } light(e[0], e[1], 12 * S, L_CRIM, 0.6); for (let k = 0; k < 6; k++) { const u = frac(ih(k, 1, 9766) + t * 1.4); P(e[0] + (ih(k, 2, 9766) - 0.5) * 3 * S, e[1] + u * 9 * S, k & 1 ? 104 : 102); } }
    if (p.cut > 0) { const a = h5Loc(p, E.x, E.y, S, -16, 1.5 + p.cut * 0), b = h5Loc(p, E.x, E.y, S, 16, -1.5); lineF(a[0], a[1], b[0], b[1], (x, y) => { if (SMASK[clamp(y, 0, H - 1) * W + clamp(x, 0, W - 1)]) { P(x, y, fl(t * 20 + x) % 3 ? 22 : 75); P(x, y + 1, 74); } }); light((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, 20 * S, L_MAG, 0.4); }
    if (p.stump) { const s = E.hand; for (let k = 0; k < 10; k++) { const u = frac(ih(k, 1, 9767) + t * 1.8); if (bay(k, fl(t * 30)) < 1 - u) { P(s[0] + (ih(k, 2, 9767) - 0.5) * 2 * S + u * 4 * S * (p.flip ? -1 : 1), s[1] + u * 10 * S + Math.sin(u * 6 + k) * 2, k % 4 ? 0 : 74); } } }
    return E;
  }
  /* a pane of sky: a sheet of glass seen from below, a world vivid in it. P: { wx, wy, w, dh, tilt, view, hit, ui, vi, seed }.
     Before the hit it bows and cracks from (ui, vi); after it, it is a burst of shards (radial wedges in rings), each carrying
     its piece of the world, flung out from the blow and up with it. front: draw only the shards coming at the camera. */
  const d5PaneSh = {};
  function d5PaneSet(Q) {
    if (d5PaneSh[Q.seed]) return d5PaneSh[Q.seed];
    const N = 13, RG = [0, 0.16, 0.42, 1], A = [], out = [];
    for (let k = 0; k <= N; k++) A.push((k + (k < N ? (ih(k, Q.seed, 9770) - 0.5) * 0.5 : 0)) / N * TAU - PI / 2);
    const bd = (a) => { const c = Math.cos(a), s = Math.sin(a), tx = c > 1e-6 ? (1 - Q.ui) / c : c < -1e-6 ? -Q.ui / c : 1e9, ty = s > 1e-6 ? (1 - Q.vi) / s : s < -1e-6 ? -Q.vi / s : 1e9; return Math.min(tx, ty); };
    const pt = (a, r) => { const b = bd(a); return [Q.ui + Math.cos(a) * r * b, Q.vi + Math.sin(a) * r * b]; };
    const cor = [[0, 0], [1, 0], [1, 1], [0, 1]].map(([u, v]) => [u, v, Math.atan2(v - Q.vi, u - Q.ui)]);
    for (let k = 0; k < N; k++) for (let j = 0; j < 3; j++) {
      const a0 = A[k], a1 = A[k + 1], rj = RG[j] * (j ? 0.85 + 0.3 * ih(k, j, 9771) : 1), rn = j + 1 === 3 ? 1 : RG[j + 1] * (0.85 + 0.3 * ih(k, j + 1, 9771));
      const poly = []; if (j === 0) poly.push([Q.ui, Q.vi]); else poly.push(pt(a0, rj));
      poly.push(pt(a0, rn));
      if (j + 1 === 3) for (const [u, v, ca] of cor) { let d = ca - a0; d = ((d % TAU) + TAU) % TAU; let dd = a1 - a0; dd = ((dd % TAU) + TAU) % TAU; if (d > 0 && d < dd) poly.push([u, v]); }
      poly.push(pt(a1, rn)); if (j > 0) poly.push(pt(a1, rj));
      let cu = 0, cv = 0; for (const [u, v] of poly) { cu += u / poly.length; cv += v / poly.length; }
      out.push({ poly, cu, cv, ring: j, k, sp: 0.6 + ih(k, j, 9772) * 0.8, rot: (ih(k, j, 9773) - 0.5) * 9, grow: ih(k, j, 9774) < 0.3 ? 1.6 : 0, front: ih(k, j, 9775) < 0.3 });
    }
    return (d5PaneSh[Q.seed] = out);
  }
  function d5PaneQ(Q, u, v) { // uv → world
    const hw = Q.w / 2, fx = hw * 0.78, x = lerp(lerp(-fx, fx, u), lerp(-hw, hw, u), v), y = lerp(-Q.dh, Q.dh, v) + Math.sin(u * PI) * (Q.bow || 0), c = Math.cos(Q.tilt), s = Math.sin(Q.tilt);
    return [Q.wx + x * c - y * s, Q.wy + x * s + y * c];
  }
  function d5Pane(t, V, Q, front) {
    const g = t - Q.hit, Wv = wview(Q.view), z = V.z;
    const ax0 = (wx, wy) => [240 + (wx - Q.wx) * z * 0.9, 135 + (wy - Q.wy) * z * 0.9];
    if (g < 0) {
      if (front) return;
      const pts = [[0, 0], [0.25, 0], [0.5, 0], [0.75, 0], [1, 0], [1, 1], [0.75, 1], [0.5, 1], [0.25, 1], [0, 1]].map(([u, v]) => { const [wx, wy] = d5PaneQ(Q, u, v); return [vX(V, wx), vY(V, wy)]; });
      if (pts.every((q) => q[1] > H - LB + 4) || pts.every((q) => q[1] < LB - 4)) return;
      h5Shard(pts, Wv, 240, 135, t, { th: 5 * z, seed: Q.seed });
      // the light of that world on this one
      const [cx, cy] = d5PaneQ(Q, 0.5, 0.5); light(vX(V, cx), vY(V, cy), 160 * z, Q.lc || L_COLD, 0.25);
      if (g > -0.14) { const u = 1 + g / 0.14, sh = d5PaneSet(Q), [ix, iy] = d5PaneQ(Q, Q.ui, Q.vi); for (const s of sh) { if (s.ring > fl(u * 3)) continue; for (let i = 0; i < s.poly.length; i++) { const a = s.poly[i], b = s.poly[(i + 1) % s.poly.length], [wa, wb] = d5PaneQ(Q, a[0], a[1]), [wc, wd] = d5PaneQ(Q, b[0], b[1]); lineP(vX(V, wa), vY(V, wb), vX(V, wc), vY(V, wd), s.ring < 1 ? 22 : 135); } } sparkle(vX(V, ix), vY(V, iy), 4 + 8 * u, 22, 135); light(vX(V, ix), vY(V, iy), 60, L_WH, 0.5 * u); }
      return;
    }
    if (g > 1.0) return;
    const sh = d5PaneSet(Q), [iwx, iwy] = d5PaneQ(Q, Q.ui, Q.vi);
    for (const s of sh) {
      if (!!front !== s.front) continue;
      const [cwx, cwy] = d5PaneQ(Q, s.cu, s.cv), dx = cwx - iwx, dy = cwy - iwy, dl = Math.hypot(dx, dy) || 1, sp = (s.ring === 0 ? 520 : s.ring === 1 ? 380 : 260) * s.sp;
      const e = 1 - Math.exp(-g * 3.2), gone = clip01(0.55, 1.0, g), ox = dx / dl * sp * e / 3.2 * 1.4, oy = dy / dl * sp * e / 3.2 * 0.8 - (s.ring === 0 ? 1500 : s.ring === 1 ? 1150 : 820) * e / 3.2 - 380 * g + 120 * g * g;
      const rot = s.rot * g, sc = Math.max(0.05, (1 + s.grow * g * 1.6) * (1 - gone)), c = Math.cos(rot), sn = Math.sin(rot);
      const scx = vX(V, cwx + ox), scy = vY(V, cwy + oy);
      if (scy < LB - 120 || scy > H - LB + 120 || scx < -160 || scx > W + 160) continue;
      const pts = s.poly.map(([u, v]) => { const [wx, wy] = d5PaneQ(Q, u, v), lx = (wx - cwx) * z * sc, ly = (wy - cwy) * z * sc; return [scx + lx * c - ly * sn, scy + lx * sn + ly * c]; });
      const [ax, ay] = ax0(cwx, cwy);
      h5Shard(pts, Wv, ax, ay, t, { th: 3 * z * sc, seed: s.k * 3 + s.ring + Q.seed, glint: s.ring === 2 && s.k % 3 === 0 });
    }
    if (!front) {
      // glass dust thrown with them
      for (let k = 0; k < 50; k++) { const a = -PI / 2 + (ih(k, 1, 9776 + Q.seed) - 0.5) * 3.4, v = 120 + ih(k, 2, 9776 + Q.seed) * 420, x = vX(V, iwx) + Math.cos(a) * v * g * z, y = vY(V, iwy) + (Math.sin(a) * v * g + 260 * g * g) * z; if (g < 0.9 && bay(k, fl(t * 30)) < 1 - g) { P(x, y, k % 4 ? 135 : 22); if (k % 5 === 0) P(x + 1, y, 136); } }
      if (g < 0.35) { const u = g / 0.35; shockRing(vX(V, iwx), vY(V, iwy), 10 + u * 300 * z, 4 + u * 70 * z, 3, [22, 135, 136], 1 - u); }
    }
  }
  WORLDS.d5line = Object.assign(() => d5World(1.0, V0, {}), { paint: d5World, fore: d5Fore, stop: d5Stop, held: d5Held, hit: d5Hit, heavy: d5Heavy, hero: d5Hero, hol: d5Hol, horizon: d5Horizon, on: d5On, D5 });

  /* ---------------------------------------------------------------- 23.0–24.5: the form */
  const PH = [276, 181], HILT = [224, 70], TIP = [262, 216], PSL = 210, SHO = [245, 152];
  const tH = TR([
    { t: 23.0, x: 276, y: 176, S: 3, form: 'dawn', sw: 0.5, swl: 3, a: 0.04, sq: 0.16, arm2: [-2.25, 10, 1], eyes: 'glow', spread: 0, ring: 0, ringR: 0.3, cr: 1, aur: 0.7, nobob: true, legs: [1, 0, 0, 1] },
    { t: 23.14, y: 171, sq: -0.24, aur: 0.8, ring: 0.5, ringR: 0.8, e: 'o' },
    { t: 23.45, y: 170, sq: 0, spread: 0.25, ring: 0.8, ringR: 0.95, cr: 0.8 },
    { t: 23.62, arm2: null, y: 166, spread: 0.5, sw: 0.9, legs: null, nobob: false },
    { t: 23.95, x: 266, y: 136, a: -0.06, spread: 1.4, ring: 1, ringR: 1.15, cr: 0.25, sw: -0.4, aur: 0.8, e: 'o' },
    { t: 24.05, sw: -1.25, swl: 3 },
    { t: 24.38, swl: 30, sw: -1.4, ringR: 1, spread: 1.1 },
    { t: 24.5, x: 262, y: 132, sw: -0.7, cr: 0, a: 0, spread: 1, aur: 0.5 },
  ]);
  const tE = TR([
    { t: 23.0, x: 173, y: 72, S: 3, form: 'hnova', nosw: true, arm: 0.5, a: 0.14, eyes: 'wide', spread: 1, flap: 0.14 },
    { t: 23.035, x: 168, y: 70, a: 0.3 },
    { t: 23.35, x: 40, y: 20, a: -1.6, spread: 0.4, sq: 0.2, alpha: 1, e: 'o' },
    { t: 23.5, x: 10, y: 10, a: -2.4, alpha: 0, hide: true },
  ]);
  const tE2 = TR([   // the shadow pours itself back together, over there
    { t: 24.0, x: 452, y: 104, S: 2.6, form: 'hnova', sw: -1.6, a: 0.1, flip: true, eyes: 'narrow', spread: 0, aur: 0, glow: 0, sq: -0.3, ws: 0.72, hide: true },
    { t: 24.2, hide: false, sq: -0.3, spread: 0.2 },
    { t: 24.34, spread: 1, aur: 1, glow: 1, sq: 0.15, a: -0.15, e: 'o' },
    { t: 24.5, x: 440, y: 110, sq: 0, sw: -2.0, a: 0 },
  ]);
  function tView(t) {
    const kk = kick(t, [[23.0, 1.5, -PI / 2], [23.62, 1.2, 0]]), u = eio(clip01(23.03, 23.55, t)), v = eio(clip01(23.55, 24.4, t));
    return { x: lerp(lerp(250, 256, u), 290, v) - kk[2], y: lerp(lerp(140, 138, u), 124, v) - kk[3], z: lerp(lerp(1, 1.3, u), 0.86, v) * (1 + kk[0] * 0.6), r: kk[1] };
  }
  // the old picture, redrawn as light: within R the new world, a band of the old one traced in line, beyond it the old
  function tSweep(t, V, R, cx, cy) {
    H5NEW.set(BUF); const nl = LIGHTS.length; WORLDS.pin(); LIGHTS.length = nl; H5OLD.set(BUF);
    for (let y = LB; y < H - LB; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x, d = Math.hypot(x - cx, (y - cy) * 1.25) + (vn(x, y, 9, 9780) - 0.5) * 16;
      if (d < R || (x - 163) * (x - 163) + (y - 67) * (y - 67) < 3600 * clip01(23.0, 23.07, t)) { BUF[i] = H5NEW[i]; continue; }
      if (d < R + 4) { BUF[i] = d < R + 1.5 ? 22 : bay(x, y) < 0.6 ? 140 : 141; continue; }
      if (d < R + 40) { const a = LUMP5[H5OLD[i]], b = LUMP5[H5OLD[i + 1]], c = LUMP5[H5OLD[i + W]], e = Math.abs(a - b) + Math.abs(a - c), f = (d - R) / 40; BUF[i] = e > 26 ? (f < 0.4 ? 141 : x < cx ? 56 : 110) : f > 0.7 && bay(x, y) < (f - 0.7) * 3 ? H5OLD[i] : (a > 120 && bay(x, y) < 0.25 ? 139 : 0); continue; }
      BUF[i] = H5OLD[i];
    }
    for (let k = 0; k < 90; k++) { const a = ih(k, 1, 9781) * TAU, r = R + 2 + frac(ih(k, 2, 9781) + t * 3) * 16, x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r / 1.25 - frac(ih(k, 2, 9781) + t * 3) * 8; if (y > LB && y < H - LB) P(x, y, k % 3 ? 141 : 22); }
    for (let k = 0; k < 8; k++) { const a = k / 8 * TAU; light(cx + Math.cos(a) * R, cy + Math.sin(a) * R / 1.25, 50, L_GOLD, 0.4); }
  }
  shot(23.0, 24.5, (lt, t) => {
    const HS = [[23.0, 0.1]], V = tView(t), tt = d5Stop(t, HS), g = t - 23.0;
    H5PX = V.x * 0.3; H5PY = V.y * 0.3;
    d5World(t, V, { burn: eoc(clip01(23.0, 23.6, t)), sunX: 372 });
    const hx0 = vX(V, PH[0]), hy0 = vY(V, PH[1] - 14);
    if (g < 0.72) tSweep(t, V, 18 + 620 * Math.pow(g / 0.72, 1.35), hx0, hy0);
    // the slab, now a drawing of itself; it breaks as the hero leaves it
    { const br = clip01(23.62, 24.3, t), pts = slabPts(vX(V, 110), vX(V, 410), vY(V, PSL), 0, 50 * V.z, 31);
      for (const sd of [-1, 1]) { const ox = sd * 40 * eoc(br) * V.z, oy = 60 * br * br * V.z, rot = sd * 0.25 * br; const cxp = vX(V, 260), cyp = vY(V, PSL); const q = pts.filter((p) => (p[0] - cxp) * sd >= -2).concat([[cxp + sd * 2, cyp + 50 * V.z * 0.8]]).map(([x, y]) => { const lx = x - cxp, ly = y - cyp; return [cxp + lx * Math.cos(rot) - ly * Math.sin(rot) + ox, cyp + lx * Math.sin(rot) + ly * Math.cos(rot) + oy]; });
        if (g >= 0) { polyF(q, (x, y) => ((x + y) % 4 === 0 ? 139 : 0)); for (let i = 0, j = q.length - 1; i < q.length; j = i++) lineP(q[j][0], q[j][1], q[i][0], q[i][1], q[j][1] < cyp + 2 && q[i][1] < cyp + 2 ? 22 : 135); } }
      if (br > 0) rocks(vX(V, 260), vY(V, PSL), t - 23.62, 14, 120, 3 * V.z, [137, 136, 135, 22], 9782, 200, PI / 2, 2.4);
    }
    const HR0 = h5Pose(tH, tt), shx = vX(V, SHO[0]), shy = vY(V, SHO[1] - (176 - HR0.y));
    // the burst that throws the Hollow off it
    d5Hit(hx0, hy0, t, 23.0, 0.1, 2.2, undefined, [22, 140, 56], 9789, 1, [140, 141, 56, 57, 73, 74, 104], L_GOLD);
    const E = h5F(tE, tt, {}, V);
    if (E) h5Ash(tE, tt, V, 30, -60, -40, [0, 78, 20, 0, 22, 77]);
    // and pouring itself back together on the far side
    if (t > 23.8) { ashStreams(t, vX(V, 452), vY(V, 104), 160, clip01(23.8, 24.2, t) * (1 - clip01(24.25, 24.5, t)), 9790); d5Hol(tE2, tt, V); const g2 = t - 24.2; if (g2 >= 0 && g2 < 0.35) { shockRing(vX(V, 452), vY(V, 104), 6 + g2 * 260, 4 + g2 * 160, 3, [22, 74, 72], 1 - g2 / 0.35); light(vX(V, 452), vY(V, 104), 60, L_MAG, 0.6 * (1 - g2 / 0.35)); } }
    // the hero
    const HR = d5Hero(tH, tt, V, { frz: d5Held(t, HS) ? 2 : 0 });
    // the pinning blade: its black runs down into the hero; it cracks with light, empties from the hilt down, and crumbles
    const hx = vX(V, HILT[0]), hy = vY(V, HILT[1]), ba = Math.atan2(shy - hy, shx - hx), bl = Math.hypot(shx - hx, shy - hy) + 22 * V.z;
    const drain = clip01(23.0, 23.5, t), crum = clip01(23.47, 23.8, t);
    if (crum < 1) {
      const s0 = eic(drain) * 0.7 * bl;
      if (crum <= 0) { bigBlade(hx + Math.cos(ba) * s0, hy + Math.sin(ba) * s0, ba, bl - s0, 7.5 * V.z * (1 - 0.3 * drain), t, { form: 'void', flare: 0.4, cracks: 0.6 + drain * 3.2, noHilt: s0 > 4 }); for (let q = 0; q < 5; q++) { const f = (q + 0.5) / 5, along = lerp(s0, bl, f); light(hx + Math.cos(ba) * along, hy + Math.sin(ba) * along, 34 * V.z, L_MAG, 0.35 * (1 - drain * 0.5)); }
        for (let k = 0; k < 6; k++) { let x = shx, y = shy, d = 0; const reach = (bl - s0) * clip01(0, 0.4, g) * (0.5 + ih(k, 1, 9783) * 0.5); while (d < reach) { const st = 6 + ih(k, fl(d), 9784) * 8, off = (ih(k, fl(d) + 1, 9785) - 0.5) * 6 * V.z, nx = shx - Math.cos(ba) * (d + st) - Math.sin(ba) * off, ny = shy - Math.sin(ba) * (d + st) + Math.cos(ba) * off; lineP(x, y, nx, ny, 22); x = nx; y = ny; d += st; } }
        for (let k = 0; k < 60; k++) { const u = frac(ih(k, 1, 9786) + t * (1.6 + ih(k, 2, 9786))), along = lerp(s0, bl - 10 * V.z, u), q = (ih(k, 3, 9786) - 0.5) * 9 * V.z, px = hx + Math.cos(ba) * along - Math.sin(ba) * q * (1 - u), py = hy + Math.sin(ba) * along + Math.cos(ba) * q * (1 - u); lineP(px, py, px - Math.cos(ba) * 5 * V.z, py - Math.sin(ba) * 5 * V.z, k % 4 === 0 ? 74 : k % 4 === 1 ? 77 : 0); }
      } else {
        // the pieces of it, pulled in a spiral into the night half
        for (let k = 0; k < 18; k++) { const f = (k + 0.5) / 18, along = lerp(s0, bl, f), px0 = hx + Math.cos(ba) * along, py0 = hy + Math.sin(ba) * along, d = clamp(crum * 1.5 - (1 - f) * 0.5, 0, 1), e = eic(d), a = ba + d * 5, rr = (1 - e) * 22 * V.z; if (d >= 1) continue;
          const x = lerp(px0, shx - 8 * V.z, e) + Math.cos(a) * rr, y = lerp(py0, shy, e) + Math.sin(a) * rr, r = (3 + ih(k, 1, 9787) * 3) * V.z * (1 - e * 0.8); const pts = shardPts(x, y, r * 1.4, r, a * 2 + k, 90 + k, 5); polyF(pts, (X, Y) => (bay(X, Y) < 0.15 ? 77 : 0)); for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) lineP(pts[j][0], pts[j][1], pts[i][0], pts[i][1], k % 3 ? 74 : 22); }
      }
    }
    if (t < 23.62) { light(shx, shy, 40 * V.z, L_DARK, 0.4 * (1 - drain)); sparkle(shx, shy, 4 + 3 * Math.sin(t * 30), 22, 140); }
    // the new blade gathers out of light and dark into the hilt
    if (t > 23.95 && t < 24.45) { const u = clip01(23.95, 24.4, t); for (let k = 0; k < 40; k++) { const f = frac(ih(k, 1, 9791) + t * 2.4), a = ih(k, 2, 9791) * TAU, r = 40 * (1 - f) * V.z; P(HR.tip[0] + Math.cos(a) * r, HR.tip[1] + Math.sin(a) * r, k & 1 ? 22 : 57); if (k % 3 === 0) P(HR.hand[0] + Math.cos(a) * r * 0.6, HR.hand[1] + Math.sin(a) * r * 0.6, k & 2 ? 141 : 56); } light(HR.tip[0], HR.tip[1], 40, L_WH, 0.7 * (1 - u * 0.5)); sparkle(HR.tip[0], HR.tip[1], 6 * (1 - u) + 2, 22, 140); }
    d5Fore(t, V, { amt: clip01(23.3, 23.9, t) });
    if (V.r) z5Cam(1, V.r, 240, 135);
  });
  CAPS.push([23.0, 24.45, 'x', 'dawn', 'DAWNBREAK!!', 218]);

  /* ---------------------------------------------------------------- 24.5–27.0: the counter-attack, cut on each impact */
  const S2 = 2.4;
  const cH = TR([
    { t: 24.5, x: 214, y: 134, S: S2, form: 'dawn', sw: -0.7, swl: 30, a: 0, sq: 0, flip: false, eyes: 'glow', spread: 1, aur: 0.45, ws: 0.7 },
    { t: 24.62, x: 212, y: 140, sq: 0.25, sw: -0.4 },
    { t: 24.8, x: 204, y: 170, sq: 0.48, a: 0.16, sw: 1.5, spread: 0.5, e: 'o' },             // under its sweep
    { t: 24.94, x: 208, y: 166, sq: 0.52, a: 0.1, sw: 1.7 },
    { t: 25.0, x: 222, y: 138, sw: -1.75, sq: -0.28, a: -0.2, spread: 1.2, e: EQ },          // 1: a rising cut across the mask
    { t: 25.1, x: 228, y: 126, sw: -2.3, a: -0.25, sq: 0, e: 'o' },
    { t: 25.28, x: 238, y: 62, sw: -2.95, a: -0.12, sq: 0.18, spread: 1.4 },
    { t: 25.4, x: 252, y: 90, sw: 1.05, a: 0.3, sq: -0.22, e: EQ },                          // 2: the chop on the blade arm
    { t: 25.5, x: 256, y: 100, sw: 1.6, a: 0.34, sq: 0.22, e: 'o' },
    { t: 25.58, x: 286, y: 50, a: 1.6, sw: 0.2, sq: -0.1, e: 'i' },
    { t: 25.7, x: 372, y: 42, a: 6.68, sw: 0.9, sq: 0, e: 'l' },                              // 3: vaulting it, through its wing
    { t: 25.7001, a: 0.4 },
    { t: 25.8, x: 414, y: 90, a: 0.1, sq: 0.12, e: 'o' },
    { t: 25.8001, flip: true, a: -0.1, sw: 0.5 },
    { t: 25.93, x: 472, y: 118, a: 0.1, sw: 0.25, sq: 0.3, reach: 0 },
    { t: 26.0, x: 452, y: 124, sw: 0.02, reach: 6, sq: -0.28, a: -0.05, e: EQ },              // 4: the thrust into the crimson eye
    { t: 26.06, x: 450, y: 122, reach: 3, sw: -0.15, sq: 0, e: 'o' },
    { t: 26.2, x: 398, y: 118, a: 7.5, lk: 1, sq: -0.15, sw: -1.4, reach: 0, e: 'i' },        // 5: the spinning kick
    { t: 26.2001, a: 1.22 },
    { t: 26.28, x: 404, y: 116, a: 0.5, lk: 0.3, sq: 0.1, e: 'o' },
    { t: 26.35, x: 414, y: 120, a: 0, lk: 0, sw: 0.3, sq: 0.38 },
    { t: 26.4, x: 318, y: 136, sw: 0.12, sq: -0.42, reach: 4, e: 'l' },                       // 6: through it
    { t: 26.47, x: 176, y: 144, sw: 0.4, sq: -0.1, reach: 0, e: 'o' },
    { t: 26.62, x: 156, y: 150, sw: 0.7, sq: 0.1 },
    { t: 26.6201, flip: false, sw: 1.2 },
    { t: 26.8, x: 250, y: 190, sq: 0.45, sw: 1.7, a: -0.08, arm2: [2.7, 6, 1], spread: 0.7 },
    { t: 26.96, x: 256, y: 192, sq: 0.56, sw: 1.8, a: -0.12 },
    { t: 27.0, x: 262, y: 160, sq: -0.36, a: 0.12, sw: 1.2, arm2: [-1.72, 12, 1], spread: 1.3, e: EQ },   // the uppercut
    { t: 27.12, x: 262, y: 120, sq: -0.1, e: 'o' },
  ], { 25.28: 26, 25.7: 40, 26.4: -10, 26.8: -22 });
  const cE = TR([
    { t: 24.5, x: 430, y: 110, S: S2, form: 'hnova', sw: -2.0, a: 0, flip: true, eyes: 'narrow', spread: 1, chip: 0, aur: 0.5, ws: 0.55 },
    { t: 24.64, x: 356, y: 112, sw: -2.4, a: -0.2, sq: -0.12 },
    { t: 24.8, x: 300, y: 122, sw: 0.1, a: 0.2, sq: 0.1, e: EQ },                              // its sweep, over the hero
    { t: 24.95, x: 314, y: 124, sw: 0.8, a: 0.1, sq: 0, e: 'o' },
    { t: 25.0, x: 318, y: 124, eyes: 'wide' },
    { t: 25.1, x: 340, y: 112, a: 0.5, chip: 1, sq: 0.12, e: 'o' },                            // head snapped back
    { t: 25.3, x: 338, y: 120, a: 0.08, sw: -1.7, sq: 0 },                                     // raises its blade again
    { t: 25.4, x: 336, y: 126, sw: -1.2, a: 0.02 },
    { t: 25.4001, nosw: true, reach: -3, stump: 1 },
    { t: 25.5, x: 342, y: 140, a: -0.3, sq: 0.26, e: 'o' },                                    // the arm gone, driven down
    { t: 25.7, x: 344, y: 132, a: 0.06, sq: 0 },
    { t: 25.7001, wl: 0 },
    { t: 25.8, x: 336, y: 140, a: -0.34, sq: 0.14, e: 'o' },
    { t: 25.9, x: 340, y: 130, a: 0, sq: 0 },
    { t: 25.9001, flip: false, eyes: 'wide' },                                                  // turns to face it
    { t: 26.0, x: 340, y: 128 },
    { t: 26.0001, eyeC: false, eyes: 'narrow' },
    { t: 26.08, x: 330, y: 124, a: -0.42, sq: 0.1, e: 'o' },
    { t: 26.2, x: 340, y: 128, a: -0.1 },
    { t: 26.28, x: 300, y: 140, a: 0.6, sq: 0.4, aur: 0.3, e: 'o' },                            // folded by the kick
    { t: 26.4, x: 276, y: 140, a: 0.3, sq: 0.15 },
    { t: 26.4001, form: 'hollow', spread: 0, cut: 1, eyes: 'wide' },
    { t: 26.6, x: 262, y: 128, a: -0.45, sq: 0.1, e: 'o' },
    { t: 26.95, x: 240, y: 114, a: 0.25, sq: 0 },
    { t: 27.0, x: 236, y: 112, a: 0.1, sq: 0.42, e: 'l' },
    { t: 27.25, x: 240, y: -120, a: -3, sq: -0.2, e: 'o' },
  ]);
  const CH = [[25.0, 0.067], [25.4, 0.1], [25.7, 0.1], [26.0, 0.134], [26.2, 0.134], [26.4, 0.167], [27.0, 0.134]];
  // the cameras: one set-up per strike
  const CAMS = [
    [24.5, (t) => ({ x: lerp(286, 272, eio(clip01(24.5, 25.0, t))), y: 134, z: lerp(0.98, 1.06, eio(clip01(24.5, 25.0, t))), r: 0 })],
    [25.0, (t) => ({ x: lerp(280, 296, clip01(25.0, 25.4, t)), y: 116, z: 1.15, r: -0.05 })],
    [25.4, (t) => ({ x: 312, y: lerp(108, 118, clip01(25.4, 25.7, t)), z: 1.08, r: 0.09 })],
    [25.7, (t) => ({ x: lerp(366, 380, clip01(25.7, 26.0, t)), y: 102, z: 0.95, r: -0.03 })],
    [26.0, (t) => ({ x: lerp(364, 358, clip01(26.0, 26.2, t)), y: 122, z: 2.4, r: 0.05 })],
    [26.2, (t) => ({ x: lerp(362, 340, clip01(26.2, 26.4, t)), y: 126, z: 1.08, r: -0.12 })],
    [26.4, (t) => ({ x: lerp(272, 250, eio(clip01(26.4, 27.0, t))), y: lerp(136, 146, eio(clip01(26.6, 27.0, t))), z: lerp(0.95, 1.18, eio(clip01(26.55, 27.0, t))), r: 0 })],
  ];
  const CKD = [[25.0, 1.4, -0.6], [25.4, 1.6, 1.3], [25.7, 1.4, 0.8], [26.0, 1.8, PI], [26.2, 1.8, PI + 0.2], [26.4, 2.0, PI], [27.0, 2.8, -PI / 2]];
  function cView(t) {
    let f = CAMS[0][1]; for (const [t0, fn] of CAMS) if (t >= t0) f = fn;
    const V = f(t), kk = kick(t, CKD);
    return { x: V.x - kk[2] / V.z, y: V.y - kk[3] / V.z, z: V.z * (1 + kk[0] * 0.8), r: V.r + kk[1] };
  }
  shot(24.5, 27.0, (lt, t) => {
    const V = cView(t), tt = d5Stop(t, CH), frz = d5Held(t, CH) ? 1.5 : 0;
    H5PX = V.x * 0.3; H5PY = V.y * 0.3;
    d5World(t, V, {});
    const pe = h5Pose(cE, tt);
    // 3: the wing it lost, falling, burning out
    let g = tt - 25.7; if (g >= 0 && g < 1.3) { const wx = vX(V, 372 + 40 * g), wy = vY(V, 112 - 30 * g + 160 * g * g); h5Wing(wx, wy, S2 * 0.55 * V.z, t, 1, 0.05, 1, 'void', g * 3 + 0.4, 0, 0, clip01(0.25, 1.2, g) * 0.95); }
    // 2: the arm it lost, and its blade, spinning away
    g = tt - 25.4; if (g >= 0 && g < 1.2) { const ax = vX(V, 300 - 40 * g), ay = vY(V, 128 + 60 * g + 200 * g * g), aa = 2.2 + g * 9, L = 6 * S2 * V.z; capsF(ax, ay, ax + Math.cos(aa) * L, ay + Math.sin(aa) * L, 2.2 * V.z, 2.2 * V.z, (u, d) => (d > 0.7 ? 22 : 134)); bigBlade(ax + Math.cos(aa) * L, ay + Math.sin(aa) * L, aa + 0.5, 64 * V.z, 3.2 * V.z, t, { form: 'void', flare: 0.4 * (1 - g), cracks: g * 2 }); h5Void(t); }
    const E = d5Hol(cE, tt, V, { frz });
    if (E) h5Ash(cE, tt, V, t > 26.4 ? 46 : 16, t > 26.4 ? -70 : 20, -40, [0, 78, 20, 0, 22, 77]);
    const HR = d5Hero(cH, tt, V, { frz });
    // the strikes
    const at = (wx, wy) => [vX(V, wx), vY(V, wy)];
    { const [x, y] = at(290, 112); d5Hit(x, y, t, 25.0, 0.067, 1.1, -0.6, [22, 140, 56], 9800, 1, [140, 141, 64, 65, 73, 104], L_GOLD); g = tt - 25.0;
      if (g > 0 && g < 1) { rocks(x, y, g, 12, 220, 2.6 * V.z, [66, 65, 64, 22], 9801, 220, -0.7, 1.4); const mx = x + 140 * g * V.z, my = y - 120 * g * V.z + 200 * g * g * V.z; z5MaskShard(mx, my, 0.3 * V.z, g * 12, 0, [0, 0], t); } }
    { const [x, y] = at(302, 126); d5Hit(x, y, t, 25.4, 0.1, 1.3, 1.3, [22, 74, 72], 9802, 0, null, L_MAG); g = tt - 25.4; if (g > 0 && g < 0.7) for (let k = 0; k < 24; k++) { const a = 1.3 + (ih(k, 1, 9803) - 0.5) * 1.6, v = (80 + ih(k, 2, 9803) * 240) * V.z, px = x + Math.cos(a) * v * g, py = y + Math.sin(a) * v * g + 160 * g * g; if (bay(k, fl(t * 30)) < 1 - g) rectF(px, py, 2, 2, k % 3 ? 0 : 74); } }
    { const [x, y] = at(368, 100); d5Hit(x, y, t, 25.7, 0.1, 1.2, 0.8, [22, 140, 56], 9804, 1, [140, 141, 56, 57, 73, 74], L_GOLD); g = tt - 25.7;
      if (g > 0 && g < 0.9) for (let q = 0; q < 16; q++) { const a = ih(q, 1, 9805) * TAU, r = (30 + ih(q, 2, 9805) * 110) * g * V.z, px = x + Math.cos(a) * r, py = y + Math.sin(a) * r + 120 * g * g * V.z; z5Kite(px, py, a + g * 6, 8 * V.z * (1 - g), 2.2, q % 3 ? 0 : 78); } }
    { const eye = E ? h5Loc(pe, E.x, E.y, E.S, 7.5, -2) : at(338, 124); d5Hit(eye[0], eye[1], t, 26.0, 0.134, 1.5, PI, [22, 104, 102], 9806, 1, [104, 107, 103, 102, 22], L_CRIM); g = tt - 26.0;
      if (g > 0 && g < 0.6) { rocks(eye[0] - 8 * V.z, eye[1], g, 14, 300, 2.2 * V.z, [102, 104, 107, 22], 9807, 240, PI, 1.2); for (let q = 0; q < 20; q++) { const a = PI + (ih(q, 1, 9808) - 0.5) * 1.4, v = 120 + ih(q, 2, 9808) * 340, px = eye[0] + Math.cos(a) * v * g * V.z, py = eye[1] + Math.sin(a) * v * g * V.z + 100 * g * g; lineP(px, py, px - Math.cos(a) * 8, py - Math.sin(a) * 8, q % 3 ? 104 : 107); } } }
    { const [x, y] = at(354, 132); d5Hit(x, y, t, 26.2, 0.134, 1.2, PI + 0.2, [57, 56, 6], 9809, 0, null, L_VIO); g = tt - 26.2;
      if (g > 0 && g < 0.8) { const ox = x - 24 * V.z; for (let q = 0; q < 12; q++) { const a = PI + 0.2 + (ih(q, 1, 9810) - 0.5) * 1.5, v = (90 + ih(q, 2, 9810) * 200) * V.z, px = ox + Math.cos(a) * v * g, py = y + Math.sin(a) * v * g + 140 * g * g, r = (2 + ih(q, 3, 9810) * 4) * V.z * (1 - g * 0.7), pts = shardPts(px, py, r * 1.3, r, g * 8 + q, 70 + q, 5); polyF(pts, () => 134); for (let i = 0, j = 4; i < 5; j = i++) lineP(pts[j][0], pts[j][1], pts[i][0], pts[i][1], q % 2 ? 22 : 72); } h5Void(t); } }
    { const [x, y] = at(276, 138); d5Hit(x, y, t, 26.4, 0.167, 1.3, PI, [22, 140, 74], 9811, 1, [22, 140, 141, 74], L_GOLD); g = t - 26.4;
      if (g >= 0 && g < 0.45) { const u = g / 0.45, L = 260 * (1 - u * 0.4); thick(x - L, y + 4, x + L, y - 4, u < 0.35 ? 2 : 1, 22); lineP(x - L * 0.9, y + 6, x + L * 0.9, y - 2, u < 0.5 ? 140 : 141); }
      g = tt - 26.4; if (g > 0.05 && g < 1) for (let k = 0; k < 26; k++) { const a = PI + (ih(k, 1, 9812) - 0.5) * 0.9, v = (60 + ih(k, 2, 9812) * 200) * V.z, px = x + Math.cos(a) * v * g + (ih(k, 3, 9812) - 0.5) * 30, py = y + Math.sin(a) * v * g - 40 * g * g + (ih(k, 4, 9812) - 0.5) * 30; if (bay(k, fl(t * 30)) < 1 - g) P(px, py, k % 3 ? 20 : k % 2 ? 74 : 22); } }
    // the uppercut's wind-up: light gathers at its fist
    if (t > 26.7 && HR) { const u = clip01(26.7, 27, t), f2 = h5Loc(HR.p, HR.x, HR.y, HR.S, -12 + Math.cos(2.7) * 7, -1 + Math.sin(2.7) * 7); for (let k = 0; k < 20; k++) { const f = frac(ih(k, 1, 9813) + t * 3), a = ih(k, 2, 9813) * TAU; P(f2[0] + Math.cos(a) * 34 * (1 - f) * V.z, f2[1] + Math.sin(a) * 20 * (1 - f) * V.z, k & 1 ? 22 : 56); } light(f2[0], f2[1], 70 * u, L_GOLD, 0.6 * u); sparkle(f2[0], f2[1], 2 + 5 * u, 22, 140); }
    { const [x, y] = at(232, 126); d5Hit(x, y, t, 27.0, 0.134, 2.6, -PI / 2, [22, 140, 56], 9814, 2, [140, 141, 56, 57, 73, 74], L_GOLD); }
    d5Fore(t, V, { amt: 1 });
    if (V.r) z5Cam(1, V.r, 240, 135);
  });

  /* ---------------------------------------------------------------- 27.0–29.4: the uppercut, and up through three worlds */
  const S3 = 2.6;
  const PANES = [
    { wx: 248, wy: -372, w: 620, dh: 64, tilt: 0.07, view: 'city', hit: 27.6, ui: 0.5, vi: 0.86, seed: 1, bow: 8, lc: L_COLD },
    { wx: 232, wy: -944, w: 660, dh: 84, tilt: -0.09, view: 'ink', hit: 28.2, ui: 0.48, vi: 0.86, seed: 2, bow: -10, lc: L_WH },
    { wx: 244, wy: -1530, w: 640, dh: 70, tilt: 0.11, view: 'ocean', hit: 28.8, ui: 0.52, vi: 0.86, seed: 3, bow: 12, lc: L_COLD },
  ];
  const uE = TR([
    { t: 27.0, x: 236, y: 112, S: S3, form: 'hollow', nosw: true, reach: -3, stump: 1, a: 0.1, sq: 0.42, chip: 1, eyeC: false, wl: 0, cut: 1, eyes: 'wide', flip: false, spread: 0 },
    { t: 27.25, x: 242, y: -150, a: -2.4, sq: -0.2, e: 'o' },
    { t: 27.5, x: 238, y: -290, a: -4.4, sq: 0.1 },
    { t: 27.6, x: 238, y: -305, a: -4.7, sq: 0.36, e: 'l' },
    { t: 27.76, x: 234, y: -560, a: -6.0, sq: -0.2, e: 'o' },
    { t: 28.0, x: 232, y: -760, a: -7.0, sq: 0 },
    { t: 28.16, x: 228, y: -850, a: -7.6, sq: 0.1, e: 'l' },
    { t: 28.2, x: 228, y: -863, a: -7.7, sq: 0.4, e: 'l' },
    { t: 28.36, x: 238, y: -1110, a: -9.0, sq: -0.2, e: 'o' },
    { t: 28.6, x: 242, y: -1380, a: -10.0, sq: 0 },
    { t: 28.76, x: 244, y: -1450, a: -10.6, sq: 0.1, e: 'l' },
    { t: 28.8, x: 244, y: -1459, a: -10.7, sq: 0.42, e: 'l' },
    { t: 28.98, x: 300, y: -1720, a: -12.0, sq: -0.2, e: 'o' },
    { t: 29.12, x: 336, y: -1790, a: -12.57 - 0.3, sq: 0, spread: 0.2, flip: true, form: 'hnova', reach: -3 },
    { t: 29.3, x: 344, y: -1800, a: 0.2 - 12.57, sq: 0.2, spread: 1, reach: 0, stump: 0 },
    { t: 29.4, x: 340, y: -1796, a: -0.25 - 12.57, sq: -0.2, e: EQ },
  ]);
  const uH = TR([
    { t: 27.0, x: 262, y: 160, S: S3, form: 'dawn', sw: 1.2, swl: 30, sq: -0.36, a: 0.12, flip: false, arm2: [-1.72, 12, 1], spread: 1.3, aur: 0.45 },
    { t: 27.2, x: 258, y: 20, sq: -0.1, e: 'o' },
    { t: 27.45, x: 250, y: -150, arm2: [2.6, 6, 1], sq: 0.28, spread: 1.4 },                  // gathers
    { t: 27.57, x: 244, y: -238, arm2: [-1.6, 9, 1], sq: -0.3, a: -0.08, e: 'i' },            // 1: a straight rising punch
    { t: 27.6, x: 242, y: -250, arm2: [-1.57, 13, 1], e: 'l' },
    { t: 27.76, x: 248, y: -430, arm2: [-1.9, 8, 1], sq: 0, a: 0, e: 'o' },
    { t: 27.95, x: 262, y: -620, a: 1.6, sq: 0.25, arm2: null, e: 'i' },                       // 2: over, and both feet
    { t: 28.17, x: 234, y: -795, a: 3.1, sq: 0.3, lk: 0.2, e: 'l' },
    { t: 28.2, x: 230, y: -806, a: 3.14, lk: 1, sq: -0.32, e: 'l' },
    { t: 28.36, x: 234, y: -1010, a: 6.0, lk: 0, sq: 0, e: 'o' },
    { t: 28.3601, a: -0.28 },
    { t: 28.6, x: 226, y: -1240, sq: 0.32, a: 0.3, spread: 0.15, sw: 1.6, e: 'i' },            // 3: wings shut, the whole body
    { t: 28.8, x: 240, y: -1417, a: 0.0, sq: -0.42, spread: 0.1, e: 'l' },
    { t: 28.96, x: 218, y: -1640, a: -0.2, sq: 0, spread: 1.3, e: 'o' },
    { t: 29.12, x: 160, y: -1786, a: 0, spread: 1.1, sw: -1.6 },
    { t: 29.3, x: 150, y: -1800, a: -0.25, sq: 0.2, sw: -2.4 },
    { t: 29.4, x: 158, y: -1794, a: 0.25, sq: -0.2, sw: -0.4, e: EQ },
  ]);
  const UH = [[27.0, 0.134], [27.6, 0.1], [28.2, 0.1], [28.8, 0.1]];
  function uView(t) {
    const ts = d5Stop(t, UH), pe = h5Trk(uE, ts), ph = h5Trk(uH, ts), kk = kick(t, [[27.0, 2.6, -PI / 2], [27.6, 1.8, -PI / 2], [28.2, 1.8, -PI / 2], [28.8, 2, -PI / 2]]);
    const top = eio(clip01(28.86, 29.36, t)), sep = Math.abs(pe.y - ph.y);
    const my = (pe.y + ph.y) / 2 + 4, mx = (pe.x + ph.x) / 2;
    const roll = t < 27.6 ? 0.05 : t < 28.2 ? -0.07 : t < 28.8 ? 0.08 : lerp(0.04, 0, top);
    return { x: lerp(lerp(246, mx, 0.3), 248, top) - kk[2], y: (t < 27.12 ? lerp(140, my, eio(clip01(27.0, 27.12, t))) : lerp(my, -1830, top)) - kk[3], z: lerp(clamp(150 / (sep + 70), 0.8, 1.0), 0.78, top) * (1 + kk[0] * 0.7), r: roll + kk[1] };
  }
  shot(27.0, 29.4, (lt, t) => {
    const V = uView(t), tt = d5Stop(t, UH), frz = d5Held(t, UH) ? 1.6 : 0;
    H5PX = V.x * 0.3; H5PY = V.y * 0.05;
    const top = eio(clip01(28.86, 29.36, t));
    d5World(t, V, { hz: lerp(200, -752, top) });
    // the climb: the line-world streaming past
    if (t > 27.08 && top < 1) for (let k = 0; k < 46; k++) { const x = ih(k, 1, 9820) * W, sp = 600 + ih(k, 2, 9820) * 900, y = ((ih(k, 3, 9820) * 420 + (t - 27) * sp) % 420) - 80, L = (24 + ih(k, 4, 9820) * 80) * (1 - top); for (let q = 0; q < L; q++) if (bay(fl(x), fl(y + q)) < 0.6 - q / L * 0.5) P(x, y + q, k % 5 === 0 ? 141 : k % 5 === 1 ? 56 : k % 5 === 2 ? 128 : 5); }
    for (const Pn of PANES) d5Pane(t, V, Pn, false);
    const E = d5Hol(uE, tt, V, { frz });
    if (E) h5Ash(uE, tt, V, 34, 0, 90, [0, 78, 121, 0, 72, 120]);
    // at the top it re-knits its arm out of the dark
    if (E && t > 28.98 && t < 29.4) { const u = clip01(29.0, 29.3, t); ashStreams(t, E.hand[0], E.hand[1], 70, 1 - u * 0.6, 9821); light(E.hand[0], E.hand[1], 30, L_MAG, 0.5); }
    const HR = d5Hero(uH, tt, V, { frz });
    // the blows
    { const p = h5Trk(uE, 27.0); d5Hit(vX(V, p.x), vY(V, p.y + 14), t, 27.0, 0.134, 2.6, -PI / 2, [22, 140, 56], 9822, 0, null, L_GOLD); }
    for (let k = 0; k < 3; k++) { const p = h5Trk(uE, PANES[k].hit); d5Hit(vX(V, p.x), vY(V, p.y + 16), t, PANES[k].hit, 0.1, 1.8, -PI / 2, [22, 140, 56], 9823 + k, 0, null, L_GOLD); }
    for (const Pn of PANES) d5Pane(t, V, Pn, true);
    // at the top: both blades race out to the length of the world
    if (t > 29.1 && HR && E) {
      const gr = eoc(clip01(29.12, 29.38, t)), ha = HR.wa, ea = E.wa;
      bigBlade(E.hand[0], E.hand[1], t < 29.3 ? -2.0 : lerp(-2.0, -PI + 0.5, clip01(29.3, 29.4, t)), 1500 * gr, 5 * V.z, t, { form: 'void', grow: gr < 1 ? 0.999 : 1, flare: 0.6, surge: true });
      bigBlade(HR.hand[0], HR.hand[1], t < 29.3 ? -1.2 : lerp(-1.2, -0.5, clip01(29.3, 29.4, t)), 1500 * gr, 5 * V.z, t, { form: 'dawn', grow: gr < 1 ? 0.999 : 1, flare: 0.6, surge: true });
    }
    d5Fore(t, V, { amt: top });
    if (V.r) z5Cam(1, V.r, 240, 135);
  });
  }
