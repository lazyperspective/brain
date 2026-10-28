  /* ================================================================ part III, second half (0:57–2:00): s5_finale */
  // Everything here lives in one block, so its helpers are private to it; only the shots, captions, cut-flashes and
  // whip pans escape (into SHOTS, CAPS, FLASH_CUTS, WHIPS).
  {
  const Z5B = new Uint8Array(NP), Z5C = new Uint8Array(NP);   // spare frames: dissolves, fades, split skies
  const PRISM = [81, 82, 83, 84, 85, 86, 87], ZEN_AURA = [59, 60, 22, 22], SM_PRISM = [83, 60, 22];
  const VOIDSKY = [76, 77, 78, 79, 80], GREYS = [92, 93, 94, 95], GLEV = [0, 92, 93, 94, 95], GRAW = [0, 92, 94, 95, 22];   // grey levels, and a colour that drains to each
  const SKY_BOLD = [3, 4, 5, 6, 7, 8, 13, 14, 15, 16], CLOUD_SUN = [18, 19, 15, 16], CLOUD_NEAR = [36, 13, 14, 15];
  const z5Sw = (t) => { const k = fl(t * 14) % 7; return PRISM.slice(k).concat(PRISM.slice(0, k)); };   // the blade of light
  const HEROZ = (o) => Object.assign({ who: 'hero', form: 'zenith', eyes: 'glow', fly: true }, o);

  /* -------------------------------------------------------------- helpers */
  // a dithered dissolve: draw A, keep it, draw B, then let A show through where the dither is above u
  function z5Mix(u, drawA, drawB) {
    if (u <= 0) { drawA(); return; }
    if (u >= 1) { drawB(); return; }
    drawA(); Z5B.set(BUF); drawB();
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (vn(x, y, 12, 5009) * 0.85 + bay(x, y) * 0.15 >= u) BUF[y * W + x] = Z5B[y * W + x];
  }
  // a filled triangle
  function z5Tri(ax, ay, bx, by, cx, cy, c) {
    const x0 = Math.max(0, fl(Math.min(ax, bx, cx))), x1 = Math.min(W - 1, Math.ceil(Math.max(ax, bx, cx)));
    const y0 = Math.max(0, fl(Math.min(ay, by, cy))), y1 = Math.min(H - 1, Math.ceil(Math.max(ay, by, cy)));
    const d = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax); if (Math.abs(d) < 0.01) return;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const px = x + 0.5, py = y + 0.5, w0 = ((bx - px) * (cy - py) - (by - py) * (cx - px)) / d, w1 = ((cx - px) * (ay - py) - (cy - py) * (ax - px)) / d;
      if (w0 < 0 || w1 < 0 || w0 + w1 > 1) continue;
      BUF[y * W + x] = c;
    }
  }
  // a sliver of the broken blade: a long thin triangle; lit (0..1) is how squarely it faces the light
  function z5Shard(x, y, L, w, a, lit, dim) {
    const ca = Math.cos(a), sa = Math.sin(a), px = -sa * w, py = ca * w;
    const tx = x + ca * L, ty = y + sa * L, bx = x - ca * L * 0.45, by = y - sa * L * 0.45;
    z5Tri(tx, ty, bx + px, by + py, bx - px, by - py, lit > 0.85 ? 22 : dim ? 33 : 34);
    lineP(tx, ty, bx + px, by + py, lit > 0.6 ? 22 : 34);
    if (lit > 0.95) sparkle(tx, ty, 1 + (lit - 0.95) * 80, 22, 21);
  }
  // shards orbiting a point at depth; returns nothing (drawn straight in)
  const SHD = []; for (let k = 0; k < 9; k++) SHD.push({ a: k / 9 * TAU + ih(k, 1, 5001), r: 0.45 + ih(k, 2, 5001) * 0.7, L: 0.7 + ih(k, 3, 5001) * 0.7, sp: (ih(k, 4, 5001) - 0.5) * 1.8, ph: ih(k, 5, 5001) * TAU, dr: (ih(k, 6, 5001) - 0.5) * 0.2 });
  function z5Shards(cx, cy, R, S, t, gather, tx, ty) {
    // gather 0..1 pulls them in to (tx, ty), spinning faster and lining up along the blade
    for (let k = 0; k < SHD.length; k++) {
      const s = SHD[k], g = eic(clamp(gather * 1.25 - k * 0.03, 0, 1));
      const a = s.a + t * s.dr, x0 = cx + Math.cos(a) * R * s.r, y0 = cy + Math.sin(a) * R * s.r * 0.7 + Math.sin(t * 0.7 + s.ph) * 4;
      const x = lerp(x0, tx, g), y = lerp(y0, ty, g), rot = s.ph + t * s.sp + g * g * 14;
      const lit = Math.pow(Math.max(0, Math.cos(rot * 1.3 + 0.8)), 6);
      z5Shard(x, y, 4 * S * s.L * (1 - g * 0.5), Math.max(0.8, S * 0.55), rot, lit, false);
      if (g > 0.05 && g < 1) lineP(x, y, lerp(x0, tx, g * 0.6), lerp(y0, ty, g * 0.6), 60);
    }
  }
  // orbs in front of or behind their centre
  function z5Orbs(cx, cy, R, t, r, tilt, front, which, spin) {
    for (let k = 0; k < 4; k++) {
      if (which && !which[k]) continue;
      const a = t * (spin || 2.4) + k * TAU / 4, z = Math.sin(a);
      if ((z > 0) !== front) continue;
      orbAt(cx + Math.cos(a) * R, cy + z * R * tilt, k, r * (front ? 1.1 : 0.85), t);
    }
  }
  // a radiant ray (a dithered wedge) from (x, y) along a
  function z5Ray(x, y, a, len, w, c0, c1, amt) {
    const ca = Math.cos(a), sa = Math.sin(a);
    for (let r = 0; r < len; r += 1) {
      const sp = w * (0.3 + r / len), lim = amt * Math.min(1, (1 - r / len) / 0.45);
      for (let q = -sp; q <= sp; q += 0.8) { const px = x + ca * r - sa * q, py = y + sa * r + ca * q; if (bay(fl(px), fl(py)) < lim) P(px, py, Math.abs(q) < sp * 0.35 ? c0 : c1); }
    }
  }
  // wings of prism light: three ranks of feathers (prism primaries, gold secondaries, white coverts) hanging from arms
  // raised either side of (x, y); s: scale, spread 0 (folded) .. 1, flap: how far they beat
  function z5Kite(bx, by, a, L, w, c) {
    const ca = Math.cos(a), sa = Math.sin(a), mx = bx + ca * L * 0.32, my = by + sa * L * 0.32, tx = bx + ca * L, ty = by + sa * L;
    z5Tri(bx, by, mx - sa * w, my + ca * w, tx, ty, c); z5Tri(bx, by, mx + sa * w, my - ca * w, tx, ty, c);
  }
  function z5Wings(x, y, s, t, spread, flap) {
    if (spread <= 0.02) return;
    const beat = Math.sin(t * 3) * (flap === undefined ? 0.07 : flap), sh = fl(t * 8);
    glow(x, y - 8 * s, 70 * s * spread, T_GOLD, 0.3 * spread);
    for (const sd of [-1, 1]) {
      const arm = -0.78 - beat + (1 - spread) * 1.3, ax = Math.cos(arm) * sd, ay = Math.sin(arm), Lw = 40 * s * (0.35 + 0.65 * spread);
      const RANKS = [[9, 1, 0], [8, 0.62, 1], [7, 0.36, 2]];
      for (const [N, len, rank] of RANKS) for (let j = N - 1; j >= 0; j--) {
        const u = (j + 0.6) / N, bx = x + ax * Lw * u, by = y + ay * Lw * u - Math.sin(u * PI) * 5 * s;
        const fr = lerp(PI / 2 - 0.12, -0.15 - beat * 1.5, Math.pow(u, 1.25)) - (1 - spread) * 0.5, fa = sd > 0 ? fr : PI - fr;
        const L = s * (15 + 30 * u) * len * (0.45 + 0.55 * spread), w = s * (4.4 - rank * 0.8);
        const fill = rank === 0 ? PRISM[(j + sh) % 7] : rank === 1 ? 60 : 22, rim = rank === 0 ? 22 : rank === 1 ? 59 : 60;
        z5Kite(bx - Math.cos(fa) * 1.2, by - Math.sin(fa) * 1.2, fa, L + 2.4, w + 1.1, rim);
        z5Kite(bx, by, fa, L, w, fill);
        if (rank === 0) lineP(bx, by, bx + Math.cos(fa) * L * 0.8, by + Math.sin(fa) * L * 0.8, 22);
      }
    }
  }
  // the zenith eyes burn cyan (the core sprite paints them prism green): recolour 84 inside the last stamp, not its outline
  function z5Eyes() {
    for (let y = Math.max(1, SMB[1]); y <= Math.min(H - 2, SMB[3]); y++) for (let x = Math.max(1, SMB[0]); x <= Math.min(W - 2, SMB[2]); x++) {
      const i = y * W + x; if (BUF[i] !== 84 || !SMASK[i]) continue;
      if (SMASK[i - 1] && SMASK[i + 1] && SMASK[i - W] && SMASK[i + W]) BUF[i] = 85;
    }
  }
  // a sunburst: n solid prism rays turning about (cx, cy) out to r1 (no dither until their ends)
  function z5Sunburst(cx, cy, n, rot, r0, r1, wf, cols) {
    cols = cols || PRISM;
    const x0 = Math.max(0, fl(cx - r1)), x1 = Math.min(W - 1, Math.ceil(cx + r1)), y0 = Math.max(LB, fl(cy - r1)), y1 = Math.min(H - LB - 1, Math.ceil(cy + r1));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy, d = Math.sqrt(dx * dx + dy * dy); if (d < r0 || d > r1) continue;
      const v = ((Math.atan2(dy, dx) - rot) / TAU * n % n + n) % n, k = fl(v), f = Math.abs(v - k - 0.5), w = wf * (0.55 + 0.45 * d / r1);
      if (f > w) continue;
      if (d > r1 * 0.6 && bay(x, y) > (r1 - d) / (r1 * 0.4)) continue;
      BUF[y * W + x] = f < w * 0.3 ? 22 : cols[k % cols.length];
    }
  }
  // god rays: soft bands of light tinted into the picture from (cx, cy)
  function z5GodRays(cx, cy, n, rot, T, a, r1) {
    for (let y = LB; y < H - LB; y++) for (let x = 0; x < W; x++) {
      const dx = x - cx, dy = y - cy, d = Math.sqrt(dx * dx + dy * dy), ang = Math.atan2(dy, dx);
      const b = Math.sin(ang * n + rot) * 0.6 + Math.sin(ang * n * 2.3 - rot * 1.7) * 0.4; if (b < 0.35) continue;
      const fo = Math.max(0, 1 - d / r1); if (fo <= 0) continue;
      tintI(y * W + x, x, y, T, a * fo * (b - 0.35) * 1.6);
    }
  }
  // the zenith hero, complete: light rays, wings, orbs behind, body, aura, orbs in front
  function z5Zenith(x, y, S, t, o) {
    o = o || {};
    const ang = o.ang || 0, sp = o.spread === undefined ? 1 : o.spread;
    if (o.rays) z5Sunburst(x, y, 14, t * 0.35, 6 * S, o.rays, 0.09);
    if (o.orbR) z5Orbs(x, y, o.orbR, t, o.orbr || S * 1.3, o.tilt || 0.38, false);
    z5Wings(x - Math.sin(ang) * 6 * S, y - Math.cos(ang) * 6 * S, S * (o.ws || 0.6), o.wt === undefined ? t : o.wt, sp, o.flap);
    const a = actor(HEROZ({ eyes: o.eyes || 'glow', mouth: o.mouth, sword: o.sw, swordCols: z5Sw(t), legs: o.legs, sq: o.sq, reach: o.reach }), x, y, S, ang, !!o.flip, { white: o.white, after: o.after });
    z5Eyes();
    aura(t, o.auraC || ZEN_AURA, o.auraR || 3 * S, { sparks: o.sparks === undefined ? 12 : o.sparks, rise: o.rise });
    if (o.orbR) z5Orbs(x, y, o.orbR, t, o.orbr || S * 1.3, o.tilt || 0.38, true);
    return a;
  }
  // a key-tracked zenith fighter (core fighter() has no forms): leans, stretches, leaves afterimages, smears its swings
  function z5Fight(keys, lt, base) {
    const p = trk(keys, lt), q = trk(keys, lt - 1 / 30), q2 = trk(keys, lt - 2 / 30);
    const vx = (p.x - q.x) * 30, vy = (p.y - q.y) * 30, sp = Math.hypot(vx, vy), S = p.S || base.S || 2;
    const lean = p.nolean ? 0 : clamp(vx / 1300, -0.45, 0.45), sq = (p.sq || 0) + (sp > 150 ? clamp((Math.abs(vx) - Math.abs(vy)) / 2400, -0.4, 0.4) : 0);
    const vib = (p.vib || 0) + FRZ, f = fl(T_NOW * 30), jx = vib ? Math.round((ih(f, 3, 601) - 0.5) * 2 * vib) : 0, jy = vib ? Math.round((ih(f, 4, 601) - 0.5) * 2 * vib) : 0;
    const ang = (p.a || 0) + lean, x = p.x + jx, y = p.y + jy, t = T_NOW;
    if (base.orbR) z5Orbs(x, y, base.orbR, t, S * 1.2, 0.4, false);
    z5Wings(x - Math.sin(ang) * 6 * S, y - Math.cos(ang) * 6 * S, S * 0.55, t * (base.flap || 1), p.spread === undefined ? 1 : p.spread, 0.12);
    const after = [];
    if (sp > 300) for (let k = 1; k <= 3; k++) { const a = trk(keys, lt - k * 0.03); after.push([a.x, a.y, k === 1 ? 22 : PRISM[(k * 2 + f) % 7], 0.6 - k * 0.14]); }
    const res = actor(HEROZ({ eyes: p.eyes || 'glow', mouth: p.mouth, sword: p.sw, swordCols: z5Sw(t), sq, reach: p.reach }), x, y, S, ang, !!p.flip, { after, white: p.white });
    z5Eyes();
    aura(t, ZEN_AURA, base.auraR || 3 * S, { sparks: 10, rise: base.rise });
    if (base.orbR) z5Orbs(x, y, base.orbR, t, S * 1.2, 0.4, true);
    if (typeof p.sw === 'number' && typeof q2.sw === 'number') {
      const sa = (p.flip ? PI - p.sw : p.sw) + ang, sa0 = (q2.flip ? PI - q2.sw : q2.sw) + (q2.a || 0) + lean;
      smearArc(res.hand[0], res.hand[1], sa0, sa, 30 * S, SM_PRISM);
    }
    return { x, y, S, hand: res.hand, tip: res.tip, p, sp };
  }
  // a whirlpool: the picture turned about (cx, cy), more the nearer it is
  function z5Swirl(cx, cy, k, r0) {
    TMP.set(BUF);
    for (let y = LB; y < H - LB; y++) for (let x = 0; x < W; x++) {
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy, d = Math.sqrt(dx * dx + dy * dy), a = k * r0 / (d + r0 * 0.5), c = Math.cos(a), s = Math.sin(a);
      const X = clamp(fl(cx + dx * c - dy * s), 0, W - 1), Y = clamp(fl(cy + dx * s + dy * c), LB, H - LB - 1);
      BUF[y * W + x] = TMP[Y * W + X];
    }
  }
  // the colour comes back: inside radius R of (cx, cy) the world keeps its colour, outside it is drained; a prism front
  function z5Wave(cx, cy, R, hz, ysq, t) {
    for (let y = LB; y < H - LB; y++) {
      const dy = (y - cy) * (y > hz ? ysq : 1);
      for (let x = 0; x < W; x++) {
        const i = y * W + x, d = Math.sqrt((x - cx) * (x - cx) + dy * dy) + (vn(x, y, 14, 5011) - 0.5) * 18;
        if (d > R + 7) BUF[i] = GREYM[BUF[i]];
        else if (d > R) BUF[i] = d < R + 2 ? 22 : PRISM[((fl(Math.atan2(dy, x - cx) * 3 + d * 0.2 + t * 6) % 7) + 7) % 7];
        else if (d > R - 10 && bay(x, y) < (d - R + 10) / 14) BUF[i] = T_WH[3][BUF[i]];
      }
    }
  }
  // a tendril of the void: a quadratic curve from its root (bx, by) through (qx, qy) to its tip (tx, ty), rippling;
  // cut (0..1) severs it there and sends the rest flying by sev [dx, dy, age]
  function z5Tendril(bx, by, qx, qy, tx, ty, w0, t, seed, cut, sev) {
    cut = cut === undefined ? 1 : cut;
    const L = Math.hypot(qx - bx, qy - by) + Math.hypot(tx - qx, ty - qy), n = Math.max(16, fl(L / 1.6)), pts = [];
    for (let i = 0; i <= n; i++) {
      const u = i / n, a = (1 - u) * (1 - u), b = 2 * (1 - u) * u, c = u * u;
      const x = a * bx + b * qx + c * tx, y = a * by + b * qy + c * ty;
      const dx = 2 * (1 - u) * (qx - bx) + 2 * u * (tx - qx), dy = 2 * (1 - u) * (qy - by) + 2 * u * (ty - qy), dl = Math.hypot(dx, dy) || 1;
      const rip = Math.sin(u * 10 - t * 11 + seed) * 7 * u * (1 - u) * 2;
      let px = x - dy / dl * rip, py = y + dx / dl * rip, r = w0 * (1 - u * 0.68) + 0.8, keep = true;
      if (u > cut) { if (!sev) keep = false; else { const g = sev[2]; px += sev[0] * g + Math.sin(u * 6) * g * 20; py += sev[1] * g + 160 * g * g; r *= Math.max(0, 1 - g * 1.6); keep = r > 0.5 && ih(i, fl(t * 30), seed) > g * 1.4; } }
      if (keep) pts.push([px, py, r, u]);
    }
    for (const [x, y, r] of pts) discF(x, y, r + 1.4, 73);
    for (const [x, y, r] of pts) discF(x, y, r, 77);
    for (const [x, y, r, u] of pts) { if (r > 2.5) discF(x - r * 0.25, y - r * 0.3, r * 0.4, 78); if (fl(u * 40) % 7 === 0 && r > 3) { discF(x, y, Math.min(2.5, r * 0.3), 74); P(x, y, 75); } }
    // a pale porcelain claw at the very end (if it is still attached, or flying with the severed part)
    const n2 = pts.length;
    if (n2 > 3 && (cut >= 1 || sev)) { const [ax, ay, ar] = pts[n2 - 4], [bx2, by2, br] = pts[n2 - 1], a = Math.atan2(by2 - ay, bx2 - ax), L2 = br * 3.2 + 3, w = br * 1.1 + 1;
      z5Tri(bx2 - Math.sin(a) * w - Math.cos(a) * 2, by2 + Math.cos(a) * w - Math.sin(a) * 2, bx2 + Math.sin(a) * w - Math.cos(a) * 2, by2 - Math.cos(a) * w - Math.sin(a) * 2, bx2 + Math.cos(a) * L2, by2 + Math.sin(a) * L2, 67);
      z5Tri(bx2 - Math.sin(a) * w * 0.6, by2 + Math.cos(a) * w * 0.6, bx2 + Math.sin(a) * w * 0.3, by2 - Math.cos(a) * w * 0.3, bx2 + Math.cos(a) * L2 * 0.85, by2 + Math.sin(a) * L2 * 0.85, 65);
      lineP(bx2 - Math.sin(a) * w * 0.5, by2 + Math.cos(a) * w * 0.5, bx2 + Math.cos(a) * L2 * 0.8, by2 + Math.sin(a) * L2 * 0.8, 64); }
    // the raw end where it was cut
    if (cut < 1) { const i = fl(cut * n); if (pts[i]) { const [x, y, r] = pts[Math.min(i, pts.length - 1)]; discF(x, y, r * 0.9, 74); discF(x, y, r * 0.5, 75); } }
  }
  // a configurable beam: colAt(f, u) gives the colour at fraction f of the half-width (core 0 → edge 1 → fringe 1.5) and u along it
  function z5Beam(x0, y0, x1, y1, w, colAt, t, seed) {
    const dx = x1 - x0, dy = y1 - y0, L2 = dx * dx + dy * dy, L = Math.sqrt(L2) || 1;
    const bx0 = Math.max(0, fl(Math.min(x0, x1) - w * 2)), bx1 = Math.min(W - 1, Math.ceil(Math.max(x0, x1) + w * 2));
    const by0 = Math.max(0, fl(Math.min(y0, y1) - w * 2)), by1 = Math.min(H - 1, Math.ceil(Math.max(y0, y1) + w * 2));
    for (let y = by0; y <= by1; y++) for (let x = bx0; x <= bx1; x++) {
      const px = x + 0.5 - x0, py = y + 0.5 - y0, u = clamp((px * dx + py * dy) / L2, 0, 1), qx = px - u * dx, qy = py - u * dy, d = Math.sqrt(qx * qx + qy * qy);
      const wob = w * (0.85 + 0.15 * Math.sin(u * L * 0.25 - t * 40 + seed) + 0.08 * Math.sin(u * L * 0.7 + t * 23));
      if (d > wob * 1.5) continue;
      const f = d / wob;
      if (f > 1 && bay(x, y) > (1.5 - f) * 1.4) continue;
      BUF[y * W + x] = colAt(f, u * L, x, y);
    }
  }
  const voidCol = (t) => (f, s, x, y) => f < 0.42 ? (ih(x >> 1, (y >> 1) + fl(t * 30), 5021) < 0.02 ? 75 : 76) : f < 0.6 ? 77 : f < 0.8 ? 71 : f < 1 ? 74 : 73;
  const prismCol = (t) => (f, s) => f < 0.38 ? 22 : f < 0.6 ? 60 : PRISM[((fl(s / 5 - t * 40) % 7) + 7) % 7];
  // the picture is unwritten: columns eaten from the frame edges inward (from the top or the bottom), sparing a circle
  function z5Unwrite(prog, t, px, py, pr) {
    if (prog <= 0) return;
    const f = fl(t * 20), h = H - 2 * LB;
    for (let x = 0; x < W; x++) {
      const col = fl(x / 5), edge = Math.min(x, W - 1 - x) / (W / 2), up = ih(col, 2, 5031) < 0.5;
      const lim = (prog * 1.6 - edge * 0.9 - ih(col, 1, 5031) * 0.45) * h;
      if (lim <= 0) continue;
      for (let k = 0; k < Math.min(h, lim); k++) {
        const y = up ? LB + k : H - LB - 1 - k, i = y * W + x;
        if (pr) { const d = Math.hypot(x - px, y - py); if (d < pr) continue; if (d < pr + 2) { BUF[i] = PRISM[(fl(Math.atan2(y - py, x - px) * 4 + t * 8) % 7 + 7) % 7]; continue; } }
        BUF[i] = k > lim - 3 && ih(x, y + f, 732) < 0.6 ? 74 : ih(x >> 2, (y >> 2) + f, 733) < 0.03 ? 75 : 76;
      }
    }
  }
  // tear rows of the frame sideways between y0 and y1
  function z5Tear(y0, y1, amp, prob, t) {
    const f = fl(t * 24);
    for (let y = Math.max(LB, fl(y0)); y < Math.min(H - LB, y1); y++) {
      if (ih(y >> 2, f, 5041) > prob) continue;
      const sh = Math.round((ih(y >> 2, f, 5042) - 0.5) * 2 * amp); if (!sh) continue;
      TMP.set(BUF.subarray(y * W, y * W + W), 0);
      for (let x = 0; x < W; x++) BUF[y * W + x] = TMP[clamp(x - sh, 0, W - 1)];
    }
  }
  // the sky tear (the part-one rift if it's there, else a plain one)
  function z5Rift(cx, y0, y1, open, t, scale) {
    if (open <= 0) return;
    if (typeof skyRift === 'function') { skyRift(cx, y0, y1, open, t, scale); return; }
    for (let y = fl(y0); y <= y1; y++) { const u = (y - y0) / (y1 - y0), w = open * (1 - Math.abs(u - 0.5) * 2) * 60 + 1, x = cx + (vn(y, 0, 7, 91) - 0.5) * 30; for (let q = -w - 2; q <= w + 2; q++) P(x + q, y, Math.abs(q) <= w ? 76 : 64); }
  }
  // dawn over the cloud sea, bold: sky, sun, two banks of cloud; hz the horizon, ox a sideways drift
  function z5Dawn(t, hz, ox, sunX, sunY) {
    gradient(LB, hz, SKY_BOLD);
    glow(sunX, sunY, 150, T_WARM, 0.6); discF(sunX, sunY, 22, 15); discF(sunX, sunY, 18, 16); discF(sunX - 4, sunY - 4, 9, 22);
    cloudBank(hz + 8, 22, 80, 5051, ox * 0.5, CLOUD_SUN, false);
    cloudBank(hz + 44, 30, 60, 5052, ox, CLOUD_NEAR, false);
  }
  // the grey nothing: a faint light far above, slanting shafts, ash drifting up past a falling body
  function z5Grey(t, rise, dark) {
    gradient(LB, H - LB, dark ? [93, 92, 92, 0, 0] : [94, 93, 92, 92, 0]);
    for (let k = 0; k < 4; k++) {
      const x0 = 30 + k * 120 + Math.sin(t * 0.2 + k) * 20;
      for (let y = LB; y < H - LB; y++) for (let q = -14; q <= 14; q++) { const x = fl(x0 + (y - LB) * 0.42 + q); if (bay(x, y) < 0.3 * (1 - Math.abs(q) / 14) * (1 - (y - LB) / 230)) P(x, y, dark ? 93 : 94); }
    }
    for (let k = 0; k < 80; k++) { const u = frac(ih(k, 1, 5061) + t * rise * (0.4 + ih(k, 2, 5061))), x = ih(k, 3, 5061) * W + Math.sin(t * 0.5 + k) * 6, y = H - LB - u * (H - 2 * LB); P(x, y, ih(k, 4, 5061) < 0.3 ? 95 : 94); if (rise > 0.15 && k % 2) P(x, y + 1, 93); }
  }
  // the coral spark in the chest: a heartbeat that comes back
  function z5Spark(x, y, S, t) {
    if (t < 63.5) return;
    const flick = [[63.5, 63.6], [63.72, 63.8], [63.9, 64.0]];
    let on = t >= 64.1; for (const [a, b] of flick) if (t >= a && t < b) on = true;
    if (!on) return;
    let beat = 0; for (const b of [64.8, 65.25, 65.62, 65.9]) { const g = t - b; if (g > 0) beat = Math.max(beat, Math.exp(-g * 6) * (0.6 + (b - 64.8))); }
    const r = S * (0.35 + beat * 0.6) + 0.6;
    glow(x, y, S * (3 + beat * 6), T_WARM, 0.25 + beat * 0.4);
    discF(x, y, r * 1.6, 36); discF(x, y, r, 35); discF(x, y, r * 0.5, beat > 0.4 ? 22 : 37);
  }
  // cam(), but the focus is nudged so the view never reaches past the picture (cam would smear the edge rows into it)
  function z5Cam(z, r, fx, fy, sx, sy) {
    if (sx === undefined) { sx = fx; sy = fy; }
    const c = Math.cos(r) / z, s = Math.sin(r) / z;
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    for (const [X, Y] of [[0, LB], [W, LB], [0, H - LB], [W, H - LB]]) { const dx = X - sx, dy = Y - sy, wx = dx * c + dy * s, wy = -dx * s + dy * c; x0 = Math.min(x0, wx); x1 = Math.max(x1, wx); y0 = Math.min(y0, wy); y1 = Math.max(y1, wy); }
    fx = x1 - x0 >= W ? W / 2 - (x0 + x1) / 2 : clamp(fx, -x0, W - x1);
    fy = y1 - y0 >= H - 2 * LB ? H / 2 - (y0 + y1) / 2 : clamp(fy, LB - y0, H - LB - y1);
    cam(z, r, fx, fy, sx, sy);
  }
  // world → screen through cam(z, r, fx, fy, sx, sy)
  function z5Pt(z, r, fx, fy, sx, sy, x, y) { const wx = x - fx, wy = y - fy, c = Math.cos(r), s = Math.sin(r); return [sx + z * (c * wx - s * wy), sy + z * (s * wx + c * wy)]; }
  // a broken piece of the porcelain mask with one socket in it (eye 0..1 opens it); s ≈ size in mask units
  const MSP = []; for (let k = 0; k < 11; k++) { const a = k / 11 * TAU; MSP.push([Math.cos(a) * (9 + ih(k, 1, 5071) * 7) * (k > 6 ? 1.3 : 1), Math.sin(a) * (7 + ih(k, 2, 5071) * 6)]); }
  function z5MaskShard(cx, cy, s, ang, eye, look, t) {
    const R = 22 * s, ca = Math.cos(ang), sa = Math.sin(ang);
    for (let y = Math.max(0, fl(cy - R)); y <= Math.min(H - 1, cy + R); y++) for (let x = Math.max(0, fl(cx - R)); x <= Math.min(W - 1, cx + R); x++) {
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy, lx = (dx * ca + dy * sa) / s, ly = (-dx * sa + dy * ca) / s;
      let inside = false, emin = 1e9;
      for (let i = 0, j = MSP.length - 1; i < MSP.length; j = i++) {
        const [xi, yi] = MSP[i], [xj, yj] = MSP[j];
        if ((yi > ly) !== (yj > ly) && lx < (xj - xi) * (ly - yi) / (yj - yi) + xi) inside = !inside;
        const ex = xj - xi, ey = yj - yi, q = clamp(((lx - xi) * ex + (ly - yi) * ey) / (ex * ex + ey * ey), 0, 1); emin = Math.min(emin, Math.hypot(lx - xi - q * ex, ly - yi - q * ey));
      }
      if (!inside) continue;
      const lit = -lx * 0.05 - ly * 0.07;
      let c = emin < 1.1 / s + 0.5 ? (lx + ly < 0 ? 64 : 68) : BONE[clamp(fl(4.3 + lit * 2.2), 2, 5)];
      // the socket and its slit
      const ex = lx - 1, ey = ly + 1, rot = -0.38, rx = ex * Math.cos(rot) + ey * Math.sin(rot), ry = -ex * Math.sin(rot) + ey * Math.cos(rot), inn = rx * rx / 21 + ry * ry / 7.3;
      if (inn < 1) { c = inn > 0.7 ? 77 : 76; const px = ex - look * 1.6, py = ey; if (eye > 0.05 && Math.abs(px) < 1.1 * eye && Math.abs(py) < 2.4) c = Math.abs(px) < 0.4 && Math.abs(py) < 1.2 ? 22 : 75; }
      else if (inn < 1.35) c = 67;
      if (ey > 2 && ey < 11 && Math.abs(ex + 1.5 - Math.sin(ey * 0.5) * 0.8) < 0.5) c = 77;              // the old black tear
      if (eye > 0.6) for (let j = 0; j < 3; j++) { const a = PI + (j - 1) * 0.6, al = ex * Math.cos(a) + ey * Math.sin(a), ac = -ex * Math.sin(a) + ey * Math.cos(a) + Math.sin(al + j) * 0.8; if (al > 4.6 && al < 4.6 + 6 * (eye - 0.6) * 2.5 && Math.abs(ac) < 0.35) c = 72; }
      BUF[y * W + x] = c;
    }
  }

  /* ================================================================ 1 — all hope lost (0:57–1:06) */
  // A: the open hand lets the grey hero fall; far above, the colossus speaks, closes its eyes and turns away into the haze
  function lostA(lt, t) {
    const fall = 110 * Math.pow(lt / 4.2, 1.25), drift = fall * 0.4;
    z5Grey(t, 0.05, false);
    Z5C.set(BUF);
    const away = sstep(60.0, 61.2, t), talk = t > 58.5 && t < 61.2 ? Math.abs(Math.sin(t * 9)) * 0.35 : 0;
    unmaker(318 + away * 14, 70 - drift, 1.1, t, { eyes: lerp(2, 0, sstep(59.9, 60.8, t)), look: [-0.9 * away, 0.5 - away * 0.6], grin: lerp(1, 0.25, sstep(59.5, 60.8, t)) - talk, crack: 1, eye4: lerp(1, 0.4, away), halo: 1 - away * 0.4, heart: 1, glow: 0,
      arms: [[-50, 30, -112, 50, eoc(lt / 0.8)], [52, 30, 92, 70, 0.2]] });
    // the haze swallows it as it turns away: its greys are lifted, in clumps, toward the grey of the void
    const fade = 0.7 + away * 1.4;
    for (let y = LB; y < H - LB; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x; if (BUF[i] === Z5C[i]) continue;
      let L = GLEV.indexOf(GREYM[BUF[i]]); const st = fl(fade + (vn(x, y + t * 6, 7, 5008) - 0.5) * 1.1);
      for (let k = 0; k < st; k++) L += L < 2 ? 1 : L > 2 ? -1 : 0;
      BUF[i] = GRAW[L];
    }
    const hx = 196 + lt * 4, hy = 128 + fall - drift;
    z5Shards(hx, hy, 46, 1.4, t + 3, 0, 0, 0);
    actor(HERO({ form: 'grey', eyes: 'closed', legs: [0, 1, 0, 2], outline: 95 }), hx, hy, 1.4, 0.3 + lt * 0.32, false);
    z5Cam(1.02 + lt * 0.012, 0.012 * Math.sin(t * 0.4), 240, 135);
    mapFx(GREYM, 1);
  }
  // B: closer, the hero tumbling slowly through nothing, the pieces of the sword turning with it
  function lostB(lt, t) {
    z5Grey(t, 0.11, true);
    const hx = 238 + Math.sin(lt * 0.5) * 6, hy = 132 + lt * 3, ang = 0.9 + lt * 0.2;
    z5Shards(hx, hy, 150, 3.0, t, 0, 0, 0);
    actor(HERO({ form: 'grey', eyes: 'closed', legs: [1, 2, 0, 1], outline: 95 }), hx, hy, 3.2, ang, false);
    z5Cam(1 + lt * 0.025, 0.02 * Math.sin(t * 0.3), hx, hy, 240, 135);
    mapFx(GREYM, 1);
  }
  // C: the face, eyes shut; then, in the chest, the only colour in the world
  function lostC(lt, t) {
    z5Grey(t, 0.07, true);
    const S = 7.2 + lt * 0.3, hx = 246 - lt * 2, hy = 150, ang = 0.2 - lt * 0.05;
    actor(HERO({ form: 'grey', eyes: 'closed', outline: 93 }), hx, hy, S, ang, false);
    // one big shard drifts across the foreground and catches the light
    const u = lin(0.2, 2.7, lt), sx = lerp(520, -60, u), sy = lerp(70, 110, u), rot = 2.2 + lt * 0.5, lit = Math.pow(Math.max(0, Math.cos(rot * 1.3 + 0.8)), 6);
    z5Shard(sx, sy, 34, 5, rot, lit, true);
    mapFx(GREYM, 1);
    z5Spark(hx - Math.sin(ang) * 3 * S, hy + Math.cos(ang) * 3 * S, S, t);
  }
  shot(57.0, 66.0, (lt, t) => {
    if (t < 60.4) lostA(lt, t);
    else if (t < 61.0) z5Mix(lin(60.4, 61.0, t), () => lostA(lt, t), () => lostB(t - 60.4, t));
    else if (t < 63.2) lostB(t - 60.4, t);
    else if (t < 63.45) z5Mix(lin(63.2, 63.45, t), () => lostB(t - 60.4, t), () => lostC(t - 63.2, t));
    else lostC(t - 63.2, t);
  });
  CAPS.push([58.5, 61.2, 's', 'UNMAKER', 'STORIES END. YOURS JUST DID.'], [61.5, 63.4, 'n', '', 'AND FOR A MOMENT, THERE WAS NOTHING.'], [64.8, 65.9, 's', 'HERO', '...NOT... YET.']);

  /* ================================================================ 2 — the eye opens (1:06–1:08) */
  shot(66.0, 68.0, (lt, t) => {
    // one sprite pixel is B screen pixels; the left eye (cells -9..-8, -4..-2) sits at (EX, EY)
    const B = 15 + lt * 2.2, EX = 206, EY = 142;
    const X = (lx) => EX + (lx + 8) * B, Y = (ly) => EY + (ly + 3) * B;
    rectF(0, 0, W, H, 92);
    for (let k = 0; k < 40; k++) { const u = frac(ih(k, 1, 5101) + t * 0.08), x = ih(k, 2, 5101) * W; P(x, H - LB - u * 220, 93); }
    rectF(X(-13) - B, Y(-8) - B, B * 28, B * 18, 93);        // the outline
    rectF(X(-13), Y(-8), B * 26, B * 16, 94);                // the face
    for (let y = fl(Y(5)); y < H; y++) for (let x = fl(X(-13)); x < X(13); x++) if (bay(x, y) < 0.5) P(x, y, 93);
    const open = eob(lin(0.5, 0.78, lt)), shake = lt > 0.25 && lt < 0.5 ? Math.round((ih(fl(t * 30), 1, 5102) - 0.5) * 4) : 0;
    // the warm light from the chest below, beating
    glow(X(0), Y(3), 260, T_WARM, 0.18 + 0.12 * Math.exp(-((lt % 0.45) * 8)) + open * 0.2);
    if (open <= 0.02) rectF(X(-9) + shake, Y(-2), 2 * B, B, 0);
    else {
      const top = Y(-2) - 2 * B * open, bot = Y(-1);
      glow(X(-8), Y(-2.5), 90 + open * 120, T_GOLD, 0.5 + open * 0.3);
      rectF(X(-10), Math.min(top - B * open, Y(-2)), 4 * B, bot - top + B * open * 2, 59);
      rectF(X(-9.5), top - B * 0.5 * open, 3 * B, bot - top + B * open, 60);
      rectF(X(-9), top, 2 * B, bot - top, 22);
    }
    const g = lt - 0.78;
    if (g > 0) {
      const cx = X(-8), cy = Y(-2.5);
      z5Sunburst(cx, cy, 18, t * 0.4, 10, 60 + eoc(g / 0.5) * 360, 0.1 + g * 0.05, [60, 59, 22]);
      burst(cx, cy, g / 0.4, 260, 20, 0.3, [22, 60], 3);
      shockRing(cx, cy, 10 + g * 380, 10 + g * 380, 4, [22, 60, 59], 1 - g / 0.7);
      glow(cx, cy, 60 + g * 200, T_WH, 0.8);
      shk(5 * Math.exp(-g * 4) + g * 2);
    }
    z5Cam(1 + lt * 0.04, 0, 240, 135);
    flashWhite(sstep(1.55, 1.97, lt));
  });

  /* ================================================================ 3 — the elements come home (1:08–1:12) */
  const CRK = [[-30, 38, -0.4], [26, 46, 0.5], [-10, 64, 2.6], [36, 70, -2.6]];   // where the light splits the body (local), and which way
  shot(68.0, 69.6, (lt, t) => {
    gradient(LB, H - LB, [93, 93, 92, 92, 0]);
    cloudBank(236, 26, 70, 5111, t * 4, GREYS, true);
    const go = lt - 1.0, recoil = eoc(clamp(go / 0.3, 0, 1)), BX = 300, BY = 80 - recoil * 10, s = 2.05;
    flashWhite(lt < 0.1 ? 1 - lt / 0.1 : 0);
    unmaker(BX, BY, s, t, { eyes: 2, crack: 1, eye4: 1, grin: lerp(1, 0.2, sstep(0.2, 0.9, lt)), look: [-0.7, 0.6], halo: 1, shake: lt * 3 + recoil * 4,
      arms: [[-50, 30, -84 + recoil * 20, 30 - recoil * 30, 0.4 + recoil * 0.6], [52, 30, 86, 40 - recoil * 20, 0.6 + recoil * 0.4]] });
    for (let k = 0; k < 4; k++) {
      const g = lt - k * 0.22; if (g < 0) continue;
      const [lx, ly, a] = CRK[k], cx = BX + lx * s, cy = BY + ly * s, len = eoc(g / 0.25) * 58, col = ORB[k];
      glow(cx, cy, 50 + len, EL_T[k], 0.75);
      for (let j = 0; j < 5; j++) z5Ray(cx, cy, a + PI / 2 + (j - 2) * 0.32, 30 + len * 2.5 + (go > 0 ? go * 300 : 0), 3 + (j === 2 ? 2 : 0), 22, col[2], 1);
      for (let j = 0; j < 5; j++) z5Ray(cx, cy, a - PI / 2 + (j - 2) * 0.32, 20 + len * 1.5, 3, 22, col[2], 1);
      bolt(cx - Math.cos(a) * len, cy - Math.sin(a) * len, cx + Math.cos(a) * len, cy + Math.sin(a) * len, k + 7, 4, 22, col[2], 0.3);
      discF(cx, cy, 4 + len * 0.08, 22);
      if (g < 0.1) shk(3);
      // and then the orb tears free, out toward the hero (off-frame, lower left)
      const og = go - k * 0.06;
      if (og > 0) {
        const u = eic(clamp(og / 0.5, 0, 1)), ox = lerp(cx, -60, u), oy = lerp(cy, 300, u) - Math.sin(u * PI) * 40;
        for (let q = 1; q < 10; q++) { const u2 = eic(clamp((og - q * 0.025) / 0.5, 0, 1)); discF(lerp(cx, -60, u2), lerp(cy, 300, u2) - Math.sin(u2 * PI) * 40, 6 - q * 0.5, q < 3 ? 22 : col[q < 6 ? 2 : 1]); }
        orbAt(ox, oy, k, 7, t);
        if (og < 0.25) { burst(cx, cy, og / 0.25, 90, 12, k, [22, col[2]], 3); debris(cx, cy, og, 14, 140, 1.2, [77, 73, 74], 5112 + k, 300); }
      }
    }
    if (go > 0) shk(6 * Math.exp(-go * 5));
    z5Cam(1.04 + lt * 0.05 + (go > 0 ? 0.08 * Math.exp(-go * 6) : 0), -0.02, 280, 130);
  });
  FLASH_CUTS.push(69.6);
  // the hero takes them back; the broken blade flies together into light
  const ORB_IN = [0.2, 0.45, 0.7, 0.95];
  shot(69.6, 72.0, (lt, t) => {
    const build = sstep(1.6, 2.4, lt), HX = 240, HY = 150, S = 3.4;
    gradient(LB, H - LB, [92, 93, 92, 0]);
    radialLines(HX, HY, 30 + fl(build * 40), 60 - build * 30, 93, t, 5121);
    const nIn = ORB_IN.filter((a) => lt >= a).length, restored = lt >= ORB_IN[3];
    if (nIn) radialLines(HX, HY, nIn * 8, 70, ORB[(fl(t * 12)) % nIn][2], t, 5122);
    // the four orbs streak in from the upper right
    for (let k = 0; k < 4; k++) {
      const g = lt - ORB_IN[k], sx = W + 30, sy = 40 + k * 40;
      if (g < -0.35) continue;
      if (g < 0) { const u = eic(1 + g / 0.35); for (let q = 0; q < 12; q++) { const u2 = Math.max(0, u - q * 0.03); discF(lerp(sx, HX, u2), lerp(sy, HY, u2), 6 - q * 0.4, q < 2 ? 22 : ORB[k][q < 6 ? 2 : 1]); } orbAt(lerp(sx, HX, u), lerp(sy, HY, u), k, 7, t); }
      else if (g < 0.35) { glow(HX, HY, 80, EL_T[k], 0.8 * (1 - g / 0.35)); shockRing(HX, HY, 8 + g * 300, 8 + g * 300, 4, [22, ORB[k][2], ORB[k][1]], 1 - g / 0.35); burst(HX, HY, g / 0.3, 120, 14, k, [22, ORB[k][2]], 3); if (g < 0.1) shk(4); }
    }
    const white = ORB_IN.some((a) => lt >= a && lt < a + 0.067);
    const o = HERO({ form: restored ? undefined : 'grey', eyes: 'glow', legs: [0, 1, 0, 1], sq: build * Math.sin(t * 40) * 0.06 });
    if (lt > 1.75) { o.sword = -0.9; o.swordCols = lt < 1.85 ? [22] : z5Sw(t); }
    const vib = build * 2, jx = Math.round((ih(fl(t * 30), 1, 5123) - 0.5) * vib * 2);
    if (nIn) z5Orbs(HX, HY, 34, t, 4, 0.4, false, ORB_IN.map((a) => lt > a + 0.1));
    const a = actor(o, HX + jx, HY, S, -0.05, false, { white });
    if (nIn) aura(t, restored ? ZEN_AURA : AURA_GOLD, 6 + build * 14, { sparks: 10 + fl(build * 30) });
    if (nIn) z5Orbs(HX, HY, 34, t, 4, 0.4, true, ORB_IN.map((a) => lt > a + 0.1));
    // the shards: scattered, then pulled in to the hand
    const hand = a.hand, tipx = hand[0] + Math.cos(-0.9) * 29 * S * 0.5, tipy = hand[1] + Math.sin(-0.9) * 29 * S * 0.5;
    if (lt < 1.8) z5Shards(HX, HY, 220, 2.4, t, lin(1.15, 1.75, lt), tipx, tipy);
    const fg = lt - 1.75;
    if (fg > 0 && fg < 0.4) { glow(tipx, tipy, 70, T_WH, 0.9 * (1 - fg / 0.4)); sparkle(tipx, tipy, 18 * (1 - fg / 0.4), 22, 60); shockRing(tipx, tipy, 4 + fg * 200, 4 + fg * 200, 3, [22, 60, 83], 1 - fg / 0.4); shk(4); }
    shk(build * 4);
    z5Cam(1 + 0.32 * eic(build), build * 0.05 * Math.sin(t * 30), HX, HY - 10, 240, 135);
    zoomBlur(240, 130, 0.1 * build);
    flashWhite(lt > 2.335 ? 1 : 0);
  });

  /* ================================================================ 4 — FABLE... ZENITH! (1:12–1:16) */
  shot(72.0, 73.4, (lt, t) => {
    const HX = 240, HY = 190, S = 3.3, R = 24 + eoc(lt / 1.3) * 250;
    z5Dawn(t, 206, t * 10, 372, 204);
    z5GodRays(HX, HY - 10, 9, t * 0.8, T_WH, 0.5, 400);
    z5Sunburst(HX, HY - 14, 16, t * 0.5, 24, 330, 0.1);
    glow(HX, HY - 14, 150, T_GOLD, 0.65);
    z5Wave(HX, HY - 20, R, 214, 2.5, t);
    const sq = lt < 0.08 ? 0.35 : lt < 0.25 ? lerp(-0.25, 0, eoc((lt - 0.08) / 0.17)) : 0;
    z5Zenith(HX, HY, S, t, { sw: -1.3, mouth: lt < 1.0 ? 2 : 0, spread: eob(lin(0.05, 0.6, lt)), orbR: 48, sq, auraR: 14, sparks: 30, legs: [1, 0, 1, 0] });
    shockRing(HX, HY, 10 + lt * 520, 10 + lt * 520, 5, [22, 60, 59], 1 - lt / 0.8);
    flashWhite(lt < 0.067 ? 1 : 0);
    shk(6 * Math.exp(-lt * 3));
    z5Cam(1.3 - 0.3 * eoc(lt / 0.5), 0, HX, HY - 30, 240, 150);
  });
  CAPS.push([72.0, 73.3, 'x', '', 'FABLE...', 52], [72.45, 73.3, 'x', '', 'ZENITH!', 104]);
  // the wave of colour rolls out over the whole sea of cloud
  shot(73.4, 76.0, (lt, t) => {
    const HX = 240, HY = 118, R = 60 + 640 * sstep(0, 2.3, lt);
    z5Dawn(t, 176, t * 14, 330, 182);
    z5GodRays(330, 182, 7, t * 0.3, T_WARM, 0.55, 420);
    z5Sunburst(HX, HY, 14, t * 0.3, 18, 150, 0.07);
    z5Wave(HX, HY, R, 176, 3.2, t);
    for (let k = 0; k < 40; k++) { const a = ih(k, 1, 5131) * TAU, rr = R + (ih(k, 2, 5131) - 0.5) * 16, x = HX + Math.cos(a) * rr, y = HY + Math.sin(a) * rr * (Math.sin(a) > 0 ? 0.32 : 1); sparkle(x, y, 1 + ih(k, 3, 5131) * 2, 22, PRISM[k % 7]); }
    z5Zenith(HX, HY + Math.sin(t * 2) * 2, 2.1, t, { sw: -1.3, spread: 1, orbR: 30, auraR: 7, sparks: 14 });
    z5Cam(1.16 - 0.14 * eio(lt / 2.6), 0.03 * Math.sin(lt * 1.2), HX, HY + 10, 240, 132);
  });

  /* ================================================================ 5 — the hero shot (1:16–1:20) */
  shot(76.0, 80.0, (lt, t) => {
    const HX = 240, HY = 150, S = 3.4, sunX = 268, sunY = 112, orbit = eio(lt / 4);
    gradient(LB, H - LB, [2, 3, 4, 5, 6, 7, 8, 13, 14, 15]);
    z5GodRays(sunX, sunY, 8, orbit * 1.4 + t * 0.1, T_WARM, 0.7, 420);
    glow(sunX, sunY, 130, T_WARM, 0.8); discF(sunX, sunY, 18, 16); discF(sunX, sunY, 13, 22);
    // far clouds drifting one way, near clouds the other (the camera circles)
    for (let k = 0; k < 7; k++) cloudPuff(frac(ih(k, 1, 5141) - lt * 0.05) * 700 - 110, 190 + ih(k, 2, 5141) * 40, 18 + ih(k, 3, 5141) * 14, CLOUD_SUN, 5142 + k);
    z5Sunburst(HX, HY - 10, 18, -t * 0.25, 30, 170, 0.06);
    const sw = lerp(-0.7, -1.45, eob(lin(0.1, 0.9, lt))), spread = 1 + 0.15 * Math.exp(-lt * 1.3) * Math.sin(lt * 7);
    const a = z5Zenith(HX, HY + Math.sin(t * 1.8) * 2, S, t, { sw, spread, orbR: 52, auraR: 9, sparks: 20, tilt: 0.3, legs: [1, 0, 1, 0], flap: 0.04 });
    // the glint runs up the blade
    const gl = lin(2.0, 2.4, lt);
    if (gl > 0 && gl < 1) sparkle(lerp(a.hand[0], a.tip[0], gl), lerp(a.hand[1], a.tip[1], gl), 4, 22, 60);
    if (lt > 2.4 && lt < 2.9) { const k = 1 - (lt - 2.4) / 0.5; sparkle(a.tip[0], a.tip[1], 14 * k, 22, 60); glow(a.tip[0], a.tip[1], 40 * k, T_WH, 0.6 * k); }
    for (let k = 0; k < 6; k++) cloudPuff(frac(ih(k, 4, 5141) + lt * 0.22) * 900 - 250, 236 + ih(k, 5, 5141) * 26, 26 + ih(k, 6, 5141) * 16, CLOUD_NEAR, 5150 + k);
    z5Cam(0.98 + 0.12 * orbit, lerp(-0.08, 0.06, orbit), HX, HY - 4, 240, 140);
  });

  /* ================================================================ 6 — it recoils (1:20–1:24) */
  shot(80.0, 81.6, (lt, t) => {
    const rc = eob(lin(0.15, 0.75, lt)), bnd = 170 + rc * 40;
    // the sky splits: dawn on the hero's side, the void on its side, a prism seam between them
    z5Dawn(t, 200, t * 10, 60, 190);
    for (let y = LB; y < H - LB; y++) {
      const sx = bnd + Math.sin(y * 0.06 + t * 3) * 6 + (y - 135) * 0.25;
      for (let x = 0; x < W; x++) {
        if (x < sx) continue;
        const i = y * W + x;
        if (x < sx + 2) { BUF[i] = 22; continue; }
        if (x < sx + 5) { BUF[i] = PRISM[(fl(y / 3 + t * 10)) % 7]; continue; }
        BUF[i] = y < 200 ? VOIDSKY[clamp(fl((y - LB) / 36 + bay(x, y) * 0.9), 0, 4)] : T_NIGHT[5][GREYM[BUF[i]]];
      }
    }
    stars(t, 200, 40, 5161);
    const BX = 344 + rc * 26, BY = 98 - rc * 12, s = 1.9;
    unmaker(BX, BY, s, t, { eyes: 2, crack: 1, eye4: 1, grin: lerp(0.6, 0, rc), look: [-1, 0.4], halo: 1, shake: 1 + rc * 3,
      arms: [[52, 30, lerp(84, -8, rc), lerp(40, 4, rc), 1], [-50, 30, lerp(-80, -60, rc), lerp(30, 60, rc), 0.3]] });
    z5GodRays(120, 152, 6, t * 0.5, T_WH, 0.35 + rc * 0.2, 260);
    z5Zenith(120, 152, 1.9, t, { sw: -0.35, spread: 1, orbR: 26, rays: 220, raysA: 0.5, auraR: 6 });
    z5Cam(1.02 + lt * 0.03, 0, 240, 135);
  });
  shot(81.6, 84.0, (lt, t) => {
    const CX = 240, CY = 148, s = 4.4, f = fl(t * 30);
    gradient(LB, H - LB, VOIDSKY); stars(t, H, 90, 5171);
    glow(CX, CY - 20, 200, T_MAG, 0.25 + lt * 0.08);
    const brk = lt > 1.4 ? 0.05 * eic(lin(1.4, 2.4, lt)) + (lt > 2.1 ? 0.006 * (f & 1) : 0) : 0;
    unmaker(CX, CY, s, t, { eyes: 2, crack: 1, eye4: 0.7 + 0.3 * ih(f, 1, 5172), grin: lerp(0.3, 0, lin(0, 1, lt)), look: [Math.sin(t * 13) * 0.8, Math.cos(t * 9) * 0.5], halo: 1, body: false,
      shake: 1 + lt * 2.6, broken: brk, glow: 0.5 });
    // light leaking out through the cracks
    glow(CX + 8 * s, CY - 10 * s, 60, T_WH, 0.25 + lt * 0.1);
    z5Tear(CY - 30 * s, CY + 30 * s, 6 + lt * 8, 0.1 + lt * 0.12, t);
    if (lt > 2.1 && lt < 2.167) mapFx(INV, 1);
    shk(1 + lt * 1.4);
    z5Cam(1 + lt * 0.06, 0.01 * Math.sin(t * 17), CX, CY - 10, 240, 135);
  });

  /* ================================================================ 7 — the mask breaks; the page is unwritten (1:24–1:28) */
  shot(84.0, 85.7, (lt, t) => {
    const CX = 240, CY = 126, s = 3.3, f = fl(t * 30);
    gradient(LB, H - LB, VOIDSKY); stars(t, H, 90, 5181);
    radialLines(CX, CY, 50, 70, 72, t, 5182);
    const brk = Math.min(1.25, eoc(lin(0, 0.9, lt)) * 1.25);
    unmaker(CX, CY, s, t, { eyes: 2, crack: 1, eye4: 1, halo: 1, broken: brk, heart: 1, arms: [[-50, 30, -96, -6, 1], [50, 30, 96, -6, 1]] });
    debris(CX, CY - 20, lt, 50, 170, 1.3, [64, 65, 66, 67], 5183, 220);
    shockRing(CX, CY, 10 + lt * 420, 10 + lt * 420, 4, [75, 73, 71], 1 - lt / 0.9);
    if (lt < 0.034) flashWhite(1);
    else if (lt < 0.134) impactFrame(CX, CY, 0);
    shk(8 * Math.exp(-lt * 3));
    z5Cam(1.16 - 0.16 * eoc(lt / 0.5), 0.05 * Math.exp(-lt * 3), CX, CY, 240, 135);
  });
  FLASH_CUTS.push(85.7);
  shot(85.7, 88.0, (lt, t) => {
    const BX = 318, BY = 92, s = 1.55, HX = 108, HY = 166;
    gradient(LB, H - LB, VOIDSKY); stars(t, H, 70, 5191);
    cloudBank(236, 20, 60, 5192, t * 6, [77, 78, 79, 62], false);
    unmaker(BX, BY, s, t, { eyes: 2, broken: 1.25, halo: 1, heart: 1, arms: [[-50, 30, -100, 10, 1], [50, 30, 100, 0, 1]] });
    shatterFx(BX, BY, 0.4 * sstep(1.3, 2.2, lt) + (lt > 1.0 && lt < 1.1 ? 0.25 : 0), t, 34);
    z5Unwrite(eio(lin(0.2, 2.3, lt)) * 0.75, t, HX, HY, 34);
    const creep = 34 * eio(lin(0.4, 2.3, lt));
    rectF(0, LB, W, creep, 0); rectF(0, H - LB - creep, W, creep, 0);
    for (let x = 0; x < W; x++) { if (ih(x >> 2, fl(t * 20), 5193) < 0.5) { P(x, LB + creep, 74); P(x, H - LB - creep - 1, 74); } }
    z5Zenith(HX, HY, 1.7, t, { sw: -0.5, spread: 1, orbR: 22, auraR: 6 });
    shk(1.5);
  });
  CAPS.push([84.5, 87.6, 's', 'UNMAKER', 'YOU CANNOT FIGHT THE END OF THE PAGE.']);

  /* ================================================================ 8 — the black hole (1:28–1:32) */
  const SPIRAL_CLOUDS = 34;
  function pulledClouds(cx, cy, t, R0, seed) {
    for (let k = 0; k < SPIRAL_CLOUDS; k++) {
      const u = frac(ih(k, 1, seed) + t * (0.12 + ih(k, 2, seed) * 0.1)), r = R0 * Math.pow(1 - u, 1.3) + 20, a = ih(k, 3, seed) * TAU + 2.4 / (r / R0 + 0.15) + t * 0.6;
      const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r * 0.75, sz = 4 + r * 0.07;
      if (r < 30) continue;
      cloudPuff(x, y, sz, u > 0.7 ? [77, 79, 73, 74] : [17, 18, 20, 21], seed + k);
    }
  }
  shot(88.0, 90.2, (lt, t) => {
    const EX = 336, EY = 116;
    gradient(LB, H - LB, VOIDSKY); stars(t, H, 120, 5201);
    cloudBank(230, 22, 60, 5202, t * 10, [17, 18, 19, 20], false);
    z5Swirl(EX, EY, 1.5 + lt * 0.3, 110);
    unmaker(EX, EY + 6, 2.6, t, { eyes: 2, broken: 1.3, halo: 1, heart: 1, arms: [[-50, 30, -100, 0, 1], [50, 30, 100, 0, 1]] });
    pulledClouds(EX, EY, t, 300, 5203);
    for (let k = 0; k < 40; k++) { const u = frac(ih(k, 1, 5204) + t * 0.5), a = ih(k, 2, 5204) * TAU + u * 3, r = (1 - u) * 300 + 10; rectF(EX + Math.cos(a) * r, EY + Math.sin(a) * r * 0.75, 2, 2, PRISM[k % 7]); }
    radialLines(EX, EY, 30, 70, 74, t, 5205);
    const hx = 70 + eio(lt / 2.2) * 60, hy = 176 + Math.sin(t * 5) * 3;
    z5Zenith(hx, hy, 2.1, t, { ang: 0.28, sw: 0.1, spread: 0.9 + 0.15 * Math.sin(t * 22), wt: t * 3, orbR: 26, auraR: 7, rise: 0.3 });
    shk(1.5 + lt);
    z5Cam(1.02 + lt * 0.05, lt * 0.03, 240, 140);
  });
  shot(90.2, 92.0, (lt, t) => {
    const EX = 520, EY = 120, HX = 196 + lt * 8, HY = 148;
    gradient(LB, H - LB, [76, 77, 78, 79, 78]);
    spiralEye(EX, EY, 170, t, 1);
    z5Swirl(EX, EY, 1.1, 160);
    streaks(0, 60, t, 2600, 74, 70, 5211, [0, LB, W, H - 2 * LB]);
    streaks(0.08, 30, t, 2000, 20, 50, 5212, [0, LB, W, H - 2 * LB]);
    for (let k = 0; k < 7; k++) cloudPuff(frac(ih(k, 1, 5213) + t * 0.9) * 700 - 120, 40 + ih(k, 2, 5213) * 200, 8 + ih(k, 3, 5213) * 8, [17, 18, 20, 21], 5214 + k);
    // tendrils rise from the eye, feeling for the hero
    const tg = lin(1.0, 1.8, lt);
    if (tg > 0) for (let k = 0; k < 3; k++) z5Tendril(EX - 60, EY + (k - 1) * 70, 420, EY + (k - 1) * 90 + Math.sin(t * 3 + k) * 30, lerp(430, 320, eoc(tg)) - k * 20, HY + (k - 1) * 60, 9, t, k * 3);
    const jx = Math.round((ih(fl(t * 30), 1, 5215) - 0.5) * 3);
    z5Zenith(HX + jx, HY, 4.0, t, { ang: 0.32, sw: 0.25, spread: 0.85 + 0.2 * Math.sin(t * 26), wt: t * 4, mouth: 1, orbR: 50, auraR: 12, rise: 0.2, sq: 0.1 });
    shk(2.5);
    z5Cam(1.04 + lt * 0.03, 0.02 * Math.sin(t * 7), 240, 135);
  });

  /* ================================================================ 9 — the last fight: tendrils against the blade (1:32–1:36) */
  const HITS9 = [0.8, 1.6, 2.4, 3.2], HS = 0.07, TH9 = HITS9.map((h, k) => h - k * HS);   // shot time → track time
  const HK9 = K(
    { t: 0, x: 120, y: 150, a: 0, sw: -0.6, S: 2.6 },
    { t: 0.5, x: 136, y: 160, sw: 1.4, a: 0.2, e: 'o' },
    { t: TH9[0], x: 178, y: 138, sw: -2.0, a: -0.25, e: 'i' },
    { t: TH9[0] + 0.25, x: 184, y: 132, sw: -1.8, a: -0.1, e: 'o' },
    { t: TH9[1] - 0.2, x: 236, y: 96, sw: -2.4, a: -0.35, e: 'io' },
    { t: TH9[1], x: 266, y: 118, sw: 1.3, a: 0.35, e: 'i' },
    { t: TH9[1] + 0.25, x: 272, y: 124, sw: 1.1, a: 0.2, e: 'o' },
    { t: TH9[2] - 0.22, x: 292, y: 154, sw: 0.2, a: 0, e: 'io' },
    { t: TH9[2], x: 318, y: 150, sw: 0.2, a: -TAU, e: 'i' },
    { t: TH9[2] + 0.18, x: 322, y: 148, a: -TAU, e: 'o' },
    { t: TH9[3] - 0.22, x: 300, y: 146, sw: 0, a: -TAU, sq: 0.3, reach: 0, e: 'io' },
    { t: TH9[3], x: 384, y: 140, sw: 0, sq: -0.25, reach: 8, e: 'i' },
    { t: TH9[3] + 0.3, x: 398, y: 138, sq: 0, reach: 2, e: 'o' },
    { t: 4.0, x: 440, y: 104, S: 2.0, e: 'io' });
  // each tendril: root, the point it rears back to, where it strikes (the hero's blade meets it at the hit)
  const TN9 = [
    { root: [500, 10], back: [400, 30], hit: [262, 104] },
    { root: [520, 280], back: [430, 250], hit: [350, 152] },
    { root: [470, 10], back: [430, 20], hit: [404, 156] },
    { root: [640, 140], back: [600, 124], hit: [452, 140], big: 1 },
  ];
  shot(92.0, 96.0, (lt, t) => {
    const [tt, frz] = stopClock(lt, TH9, HS);
    FRZ = frz ? 2 : 0;
    const tw = frz ? T_NOW - (lt - tt) : t;                // world clock, also frozen during the hit-stop
    gradient(LB, H - LB, [76, 77, 78, 79, 80, 62]); stars(tw, H, 70, 5221);
    spiralEye(430, 74, 52, tw, 1);
    pulledClouds(430, 74, tw, 260, 5222);
    glow(40, 200, 200, T_WARM, 0.25);
    // more of them, writhing behind, waiting
    for (let k = 0; k < 3; k++) z5Tendril(430, 74, 360 - k * 30, 160 + k * 30 + Math.sin(tw * 2 + k) * 20, 300 - k * 50 + Math.sin(tw * 1.3 + k) * 30, 230 - k * 20, 7, tw, 20 + k * 5);
    TN9.forEach((d, k) => {
      const h = TH9[k], g = tt - h, w0 = d.big ? 26 : 15;
      if (tt < h - 0.75) return;
      const u = tt < h ? eic(clamp((tt - (h - 0.3)) / 0.3, 0, 1)) : 1, rear = eoc(clamp((tt - (h - 0.75)) / 0.45, 0, 1));
      const tip = tt < h ? [lerp(lerp(d.root[0], d.back[0], rear), d.hit[0], u), lerp(lerp(d.root[1], d.back[1], rear), d.hit[1], u)] : d.hit;
      const q = [(d.root[0] + tip[0]) / 2 + 40, (d.root[1] + tip[1]) / 2 + (k & 1 ? -40 : 40)];
      if (g < 0) z5Tendril(d.root[0], d.root[1], q[0], q[1], tip[0], tip[1], w0, tw, k * 3);
      else if (g < 1.2) {
        // cut: the stump recoils, the severed end flies off and comes apart
        const rc = eoc(clamp(g / 0.4, 0, 1)), sx = lerp(tip[0], d.back[0], rc * 0.6), sy = lerp(tip[1], d.back[1], rc * 0.6);
        if (d.big) { z5Tendril(d.root[0], d.root[1], q[0], q[1] - 10, sx, sy - 12 - g * 60, w0 * 0.6, tw, k * 3, 0.85, [-60, -120, g]); z5Tendril(d.root[0], d.root[1] + 6, q[0], q[1] + 10, sx, sy + 12 + g * 60, w0 * 0.6, tw, k * 3 + 1, 0.85, [-60, 80, g]); }
        else z5Tendril(d.root[0], d.root[1], q[0], q[1], sx, sy, w0, tw, k * 3, 0.82, [(k & 1 ? -1 : 1) * 120, -80, g]);
      }
    });
    const hero = z5Fight(HK9, tt, { S: 2.6, orbR: 28, auraR: 8, flap: 2 });
    HITS9.forEach((h, k) => { const g = lt - h; if (g >= 0 && g < 0.5) { hitFx(TN9[k].hit[0], TN9[k].hit[1], g, k === 3 ? 1.4 : 1, [22, PRISM[(k * 2) % 7]]); if (g >= 0.034 && g < 0.067) impactFrame(TN9[k].hit[0], TN9[k].hit[1], 0); } });
    // the camera: a new angle after each whip, a kick on every hit
    const seg = lt < 1.2 ? 0 : lt < 2.0 ? 1 : lt < 2.8 ? 2 : 3, Z = [1.12, 1.22, 1.1, 1.08][seg], R = [-0.05, 0.07, -0.08, 0.03][seg];
    let kick = 0; for (const h of HITS9) { const g = lt - h; if (g > 0) kick += 0.14 * Math.exp(-g * 9); }
    const z = (seg === 3 ? lerp(1.15, 1.0, eio(lin(3.3, 4.0, lt))) : Z) + kick;
    z5Cam(z, R + kick * 0.3, lerp(hero.x, 240, 0.35), lerp(hero.y, 135, 0.4), 240, 135);
  });
  WHIPS.push([93.2, 0], [94.0, PI], [94.8, 0.4]);

  /* ================================================================ 10 — the beam clash (1:36–1:40.5) */
  function clash10(lt) {
    if (lt < 1.5) return 248 + Math.sin(lt * 5) * 24 * (lt / 1.5);
    if (lt < 2.5) return lerp(248 + Math.sin(7.5) * 24, 150, eio((lt - 1.5) / 0.9));
    return lerp(150, 350, eio((lt - 2.5) / 2.0)) + Math.sin(lt * 14) * 3;
  }
  function clashWide(lt, t) {
    const cx = clash10(lt), cy = 132, surge = lt > 2.5 ? Math.exp(-(lt - 2.5) * 2) : 0;
    z5Dawn(t, 196, t * 30, 40, 200);
    for (let y = LB; y < H - LB; y++) {
      const sx = cx + Math.sin(y * 0.07 + t * 5) * 7;
      for (let x = Math.max(0, fl(sx)); x < W; x++) {
        const i = y * W + x;
        if (x < sx + 2) { BUF[i] = 22; continue; }
        if (x < sx + 5) { BUF[i] = PRISM[(fl(y / 3 + t * 12)) % 7]; continue; }
        BUF[i] = y < 196 ? VOIDSKY[clamp(fl((y - LB) / 34 + bay(x, y) * 0.9), 0, 4)] : T_NIGHT[5][GREYM[BUF[i]]];
      }
    }
    stars(t, 190, 30, 5231);
    const BX = 404, BY = 108, f = fl(t * 30);
    unmaker(BX, BY, 2.0, t, { eyes: 2, broken: 1.25, halo: 1, heart: 1, arms: [[-50, 30, -88, 40, 1], [50, 30, 70, 60, 0.5]], shake: 1 });
    const push = cx < 200 ? (200 - cx) * 0.25 : 0, hx = 84 - push + Math.round((ih(f, 2, 5232) - 0.5) * 3), hy = 136;
    z5Beam(BX - 6, BY - 4, cx, cy, 10, voidCol(t), t, 1);
    const hero = z5Zenith(hx, hy, 2.2, t, { sw: 0, sq: 0.15, spread: 1 + surge * 0.3, wt: t * 2, orbR: 26, auraR: 7 + surge * 12, mouth: lt > 2.5 ? 2 : 1, sparks: 16 });
    z5Beam(hero.tip[0] - 4, hero.tip[1], cx, cy, 10 + surge * 8 + (lt > 2.5 ? 3 : 0), prismCol(t), t, 2);
    if (surge > 0.2) shockRing(hx, hy, 10 + (1 - surge) * 260, 10 + (1 - surge) * 260, 4, [22, 60, 83], surge);
    const R = 18 + Math.sin(t * 30) * 2 + lt * 3;
    glow(cx, cy, R * 3, T_WH, 0.6);
    for (let y = fl(cy - R); y <= cy + R; y++) for (let x = fl(cx - R); x <= cx + R; x++) { const d = Math.hypot(x - cx, y - cy) / R + (vn(x, y, 3, fl(t * 20)) - 0.5) * 0.4; if (d < 1) P(x, y, d < 0.5 ? 22 : x < cx ? PRISM[fl(d * 9 + t * 20) % 7] : 74); }
    for (let k = 0; k < 4; k++) if (ih(k, fl(t * 15), 5233) < 0.7) { const a = ih(k, fl(t * 15) + 1, 5233) * TAU; bolt(cx, cy, cx + Math.cos(a) * 80, cy + Math.sin(a) * 60, fl(t * 15) + k * 5, 1, 22, k & 1 ? 74 : 83); }
    shk(2.5 + surge * 4);
    const zin = lt > 2.5 ? sstep(3.4, 3.8, lt) * (1 - sstep(4.3, 4.5, lt)) : sstep(0.6, 1.0, lt) * (1 - sstep(1.2, 1.5, lt)) * 0.5;
    z5Cam(1.04 + 0.55 * zin, 0.05 * zin * Math.sin(t * 20), cx, cy, 240, 135);
  }
  shot(96.0, 100.5, (lt, t) => {
    if (lt < 1.7 || lt >= 2.5) { clashWide(lt, t); return; }
    // the hero, close: the void beam pushing the blade back, the light on its face
    const u = lt - 1.7, HX = 170 - u * 12, HY = 150;
    gradient(LB, H - LB, [77, 78, 79, 80, 79]);
    streaks(PI, 50, t, 2400, 74, 70, 5241, [0, LB, W, H - 2 * LB]);
    z5Beam(W + 20, 128, HX + 100, 128, 26, voidCol(t), t, 1);
    const hero = z5Zenith(HX, HY, 5.4, t, { sw: -0.05, sq: 0.22, spread: 0.85 + 0.15 * Math.sin(t * 30), wt: t * 3, mouth: u > 0.6 ? 2 : 1, orbR: 66, auraR: 16, sparks: 30 });
    glow(hero.tip[0], hero.tip[1], 90, T_WH, 0.7); discF(hero.tip[0], hero.tip[1], 14 + Math.sin(t * 40) * 3, 22);
    for (let k = 0; k < 5; k++) if (ih(k, fl(t * 15), 5242) < 0.7) bolt(hero.tip[0], hero.tip[1], hero.tip[0] + 40 + ih(k, 1, fl(t * 15)) * 100, hero.tip[1] + (ih(k, 2, fl(t * 15)) - 0.5) * 140, fl(t * 15) + k, 1, 22, 74);
    glow(HX + 60, HY, 200, T_MAG, 0.25);
    shk(3);
    z5Cam(1 + u * 0.12, -0.04, HX + 30, HY - 10, 240, 135);
  });
  CAPS.push([98.5, 100.3, 's', 'HERO', 'FOR EVERY STORY!']);

  /* ================================================================ 11 — STRIKE (1:40.5–1:44) */
  shot(100.5, 101.35, (lt, t) => {
    gradient(LB, H - LB, [80, 62, 71, 72, 73]);
    radialLines(240, 140, 80, 50, 76, t, 5251);
    radialLines(240, 140, 50, 70, 83, t, 5252);
    radialLines(240, 140, 30, 90, 22, t, 5253);
    // the void beam, split by the blade, peeling away either side
    const sp = eoc(lt / 0.85);
    z5Beam(240, 150, -60, 150 - sp * 120, 16 + sp * 20, voidCol(t), t, 1); z5Beam(240, 150, 540, 150 - sp * 120, 16 + sp * 20, voidCol(t), t, 2);
    z5Sunburst(240, 160, 16, t * 2, 20, 260, 0.06);
    z5Zenith(240, lerp(178, 196, eic(lt / 0.85)), lerp(4.4, 6.2, eic(lt / 0.85)), t, { sw: -0.45, mouth: 2, spread: 0.8, wt: t * 4, orbR: 70, auraR: 22 + lt * 10, sparks: 40, sq: Math.sin(t * 50) * 0.05 });
    shk(4);
    z5Cam(1 + lt * 0.15, 0, 240, 170);
    zoomBlur(240, 160, 0.08 + lt * 0.1);
  });
  CAPS.push([100.5, 101.4, 'x', '', 'STRIKE!', 52]);
  shot(101.35, 101.85, (lt, t) => {
    gradient(LB, H - LB, VOIDSKY);
    spiralEye(240, 135, 160 + lt * 40, t, 1);
    const in_ = eic(lin(0, 0.06, lt));
    z5Zenith(lerp(140, 228, in_), 135, 1.6, t, { sw: 0, reach: 4, spread: 0.7, auraR: 8 });
    const g = lt - 0.06;
    if (g > 0) {
      for (let k = 0; k < 12; k++) { const a = k / 12 * TAU + ih(k, 1, 5261) * 0.4; bolt(240, 135, 240 + Math.cos(a) * 300 * eoc(g / 0.3), 135 + Math.sin(a) * 300 * eoc(g / 0.3), k + 3, 2, 22, 60, 0.18); }
      glow(240, 135, 120, T_WH, 0.9);
      if (g < 0.034) flashWhite(1); else if (g < 0.134) impactFrame(240, 135, 0); else if (g < 0.2) impactFrame(240, 135, 1);
      shk(8);
    }
    z5Cam(1 + lt * 0.3, 0, 240, 135);
  });
  // the light pours out of the colossus through cracks everywhere
  const CR11 = []; for (let k = 0; k < 600 && CR11.length < 26; k++) { const lx = (ih(k, 1, 5271) - 0.5) * 120, ly = ih(k, 2, 5271) * 120 + 18; if (bodyInside(lx, ly, 0) && bodyInside(lx + 6, ly, 0) && bodyInside(lx - 6, ly, 0)) CR11.push([lx, ly, ih(k, 3, 5271) * TAU]); }
  shot(101.85, 104.0, (lt, t) => {
    const s = 2.1, f = fl(t * 30), BX = 240 + Math.round((ih(f, 1, 5281) - 0.5) * 2 * (1 + lt * 2)), BY = 86;
    gradient(LB, H - LB, VOIDSKY); stars(t, H, 70, 5282);
    cloudBank(236, 20, 60, 5283, t * 6, [77, 78, 79, 62], false);
    unmaker(BX, BY, s, t, { eyes: 2, broken: 1.25, halo: 1 - lt * 0.3, heart: 1, shake: 2, arms: [[-50, 30, -84 + Math.sin(t * 13) * 10, -40, 1], [50, 30, 90, -30 + Math.sin(t * 11) * 10, 1]] });
    const ex = BX, ey = BY - 2 * s;
    for (let k = 0; k < 8; k++) z5Ray(ex, ey, k / 8 * TAU + t * 0.5, 90 + lt * 160, 5 + lt * 3, 22, PRISM[k % 7], 1);
    for (let k = 0; k < CR11.length; k++) {
      const g = lt - 0.05 - k * 0.07; if (g < 0) continue;
      const [lx, ly, a] = CR11[k], cx = BX + lx * s, cy = BY + ly * s, len = 6 + eoc(g / 0.2) * 14, oa = Math.atan2(cy - ey, cx - ex) + Math.sin(k) * 0.3;
      glow(cx, cy, 26 + g * 20, T_WH, 0.8);
      z5Ray(cx, cy, oa, 30 + eoc(g / 0.6) * 220, 3 + g * 4, 22, 60, 1);
      bolt(cx - Math.cos(a) * len, cy - Math.sin(a) * len, cx + Math.cos(a) * len, cy + Math.sin(a) * len, k, 3, 22, 60, 0.35);
      if (g < 0.06) shk(3);
    }
    glow(ex, ey, 70 + lt * 70, T_WH, 0.9); sparkle(ex, ey, 16 + Math.sin(t * 30) * 4 + lt * 10, 22, 60); discF(ex, ey, 6 + lt * 4, 22);
    shk(2 + lt * 2.5);
    z5Cam(1 + lt * 0.07, 0, 240, 120);
    flashWhite(sstep(1.85, 2.15, lt));
  });

  /* ================================================================ 12 — it shatters; the sky heals (1:44–1:48) */
  // the colossus as a lattice of shards (local units), each flying out from its heart
  const SH12 = [];
  for (let ly = -28; ly < 150; ly += 4.6) for (let lx = -74; lx < 74; lx += 4.6) {
    const j = ih(fl(lx * 3), fl(ly * 3), 5291), qx = lx + (j - 0.5) * 3, qy = ly + (ih(fl(lx * 3), fl(ly * 3), 5292) - 0.5) * 3;
    if (!bodyInside(qx, qy, 0) && qx * qx / 256 + qy * qy / 729 >= 1) continue;
    SH12.push({ lx: qx, ly: qy, sz: 4.2 + j * 3, rot: j * TAU * 3, w: (ih(SH12.length, 5, 5291) - 0.5) * 16, v: 0.35 + ih(SH12.length, 6, 5291) * 1.1,
      c: ih(SH12.length, 7, 5291) < 0.78 ? PRISM[((fl((qx + qy) / 14) % 7) + 7) % 7] : 77, j });
  }
  function shards12(cx, cy, s, age, t) {
    const hot = age < 0.12;
    for (const d of SH12) {
      const dx = d.lx, dy = d.ly - 40, dl = Math.hypot(dx, dy) + 8, dist = d.v * (380 * age * age + 26 * age);
      const x = cx + d.lx * s + dx / dl * dist, y = cy + d.ly * s + dy / dl * dist + 30 * age * age, r = d.sz * s * 0.5 * Math.max(0, 1 - age / 2.6), a = d.rot + d.w * age;
      if (r < 0.7 || x < -20 || x > W + 20 || y < 0 || y > H + 20) continue;
      z5Tri(x + Math.cos(a) * r, y + Math.sin(a) * r, x + Math.cos(a + 2.2) * r * 0.85, y + Math.sin(a + 2.2) * r * 0.85, x + Math.cos(a + 4.1 + d.j) * r * 0.7, y + Math.sin(a + 4.1 + d.j) * r * 0.7, hot ? (d.j < 0.5 ? 22 : 60) : d.c);
      if (!hot && fl(t * 15 + d.j * 10) % 5 === 0) P(x, y, 22);
    }
  }
  shot(104.0, 105.6, (lt, t) => {
    const heal = sstep(0.15, 1.5, lt), CX = 240, CY = 86;
    gradient(LB, H - LB, VOIDSKY); stars(t, 200, 60, 5301);
    Z5C.set(BUF);
    z5Dawn(t, 196, t * 12, 360, 204);
    for (let y = LB; y < H - LB; y++) for (let x = 0; x < W; x++) { const d = Math.hypot(x - CX, (y - CY) * 1.2) / 420 + (vn(x, y, 16, 5302) - 0.5) * 0.12; if (d > heal * 1.15) BUF[y * W + x] = Z5C[y * W + x]; else if (d > heal * 1.15 - 0.012) BUF[y * W + x] = PRISM[((fl(Math.atan2(y - CY, x - CX) * 5 + t * 8) % 7) + 7) % 7]; }
    shockRing(CX, 214, 10 + lt * 520, (10 + lt * 520) * 0.12, 5, [22, 60, 59], 1 - lt / 1.5);
    z5Sunburst(CX, CY, 20, t * 0.6, 10, 140 + lt * 200, 0.08 * Math.max(0, 1 - lt / 1.4), [22, 60, 59]);
    shards12(CX, CY, 2.1, lt, t);
    z5Zenith(CX, CY - 4, 1.4, t, { sw: -0.6, spread: 1, auraR: 6, sparks: 10 });
    glow(CX, CY, 90 * (1 - lt / 1.6), T_WH, 0.8);
    if (lt < 0.067) flashWhite(1);
    shk(8 * Math.exp(-lt * 2.5));
    z5Cam(1.12 - 0.1 * eoc(lt / 1.6), 0, CX, CY + 20, 240, 135);
  });
  shot(105.6, 108.0, (lt, t) => {
    const open = 1 - eio(lin(0, 1.4, lt)), sun = 196 - eoc(lt / 2.4) * 18;
    z5Dawn(t, 186, t * 12, 330, sun);
    // the tear is stitched shut from the top down by a running seam of light
    const seal = eio(lin(0, 1.6, lt)), RY0 = 34, RY1 = 168, sy = lerp(RY0, RY1, seal), jagX = (y) => 250 + (vn(y, 0, 7 * 0.7, 91) - 0.5) * 21 + (vn(y, 0, 2, 92) - 0.5) * 4.9;
    if (seal < 1) { glow(250, (sy + RY1) / 2, 90, T_MAG, 0.3); z5Rift(250, sy, RY1, 0.45 * (1 - seal * 0.5), t, 0.7); }
    const fade = lin(1.6, 2.4, lt);
    for (let y = RY0; y < sy; y++) if (bay(fl(jagX(y)), y) > fade) { P(jagX(y), y, y > sy - 20 ? 22 : 60); P(jagX(y) + 1, y, 59); }
    if (seal > 0 && seal < 1) { glow(jagX(fl(sy)), sy, 50, T_WH, 0.7); sparkle(jagX(fl(sy)), sy, 10 + Math.sin(t * 40) * 3, 22, 60); }
    const sg = lt - 1.6;
    if (sg > 0 && sg < 0.5) { sparkle(jagX(RY1), RY1, 18 * (1 - sg / 0.5), 22, 60); glow(jagX(RY1), RY1, 70, T_WH, 0.7 * (1 - sg / 0.5)); }
    for (let k = 0; k < 70; k++) { const u = frac(ih(k, 1, 5311) + t * 0.12), x = ih(k, 2, 5311) * W + Math.sin(t * 1.5 + k) * 8, y = LB + u * 200; if (fl(t * 12 + k) % 5) P(x, y, PRISM[k % 7]); else sparkle(x, y, 2, 22, PRISM[k % 7]); }
    z5Zenith(164, 120 + Math.sin(t * 1.6) * 3, 1.6, t, { sw: -1.0, spread: 1, orbR: 18, auraR: 5, sparks: 8 });
    z5Cam(1.06 - 0.05 * eio(lt / 2.4), 0, 240, 135);
  });

  /* ================================================================ 13 — after: a new dawn; then the sting (1:48–1:54) */
  const SETTLE = [1.8, 2.1, 2.4, 2.7];
  shot(108.0, 111.0, (lt, t) => {
    const HX = 214, HY = 128 + Math.sin(t * 1.6) * 3, S = 3.0, calm = sstep(1.1, 1.5, lt);
    z5Dawn(t, 190, t * 8, 340, 182);
    z5GodRays(340, 182, 7, t * 0.15, T_WARM, 0.5, 380);
    const which = SETTLE.map((s) => lt < s);
    const orbR = 36, orbsAt = (front) => { for (let k = 0; k < 4; k++) { const st = SETTLE[k], u = eic(lin(st - 0.5, st, lt)); if (u >= 1) continue; const a = t * 2.4 + k * TAU / 4, z = Math.sin(a), R = orbR * (1 - u); if ((z > 0) !== front) continue; orbAt(HX + Math.cos(a) * R, HY + z * R * 0.4, k, 4, t); } };
    orbsAt(false);
    if (calm < 1) z5Wings(HX, HY - 6 * S, S * 0.6, t, 1 - eoc(calm), 0.05);
    const white = lt > 1.25 && lt < 1.4;
    actor(HERO({ form: calm < 0.5 ? 'zenith' : undefined, eyes: lt < 1.4 ? 'glow' : (lt > 2.2 && lt < 2.32 ? 'closed' : 'normal'), sword: -1.0, swordCols: calm < 0.5 ? z5Sw(t) : PRISM, fly: true }), HX, HY, S, 0, false, { white });
    aura(t, calm < 0.5 ? ZEN_AURA : AURA_GOLD, lerp(9, 2, calm), { sparks: fl(12 * (1 - calm)) });
    orbsAt(true);
    for (let k = 0; k < 4; k++) { const g = lt - SETTLE[k]; if (g > 0 && g < 0.35) { glow(HX, HY + 4, 30, EL_T[k], 0.6 * (1 - g / 0.35)); sparkle(HX, HY + 4, 8 * (1 - g / 0.35), 22, ORB[k][2]); } }
    if (white) glow(HX, HY, 60, T_WH, 0.6);
    z5Cam(1.12 + lt * 0.02, 0, HX + 20, HY, 240, 135);
  });
  CAPS.push([109.0, 111.0, 's', 'HERO', "IT'S OVER."]);
  shot(111.0, 114.0, (lt, t) => {
    gradient(LB, 150, [6, 7, 8, 13, 14, 15]);
    glow(390, 150, 150, T_WARM, 0.55);
    cloudBank(140, 34, 70, 5321, t * 5, CLOUD_SUN, false);
    cloudBank(196, 44, 50, 5322, t * 8, [17, 18, 14, 15], false);
    const LX = 236, LY = 176, fall = eic(lin(0, 0.42, lt)), sx = lerp(330, LX, fall), sy = lerp(10, LY, fall) + (lt > 0.42 ? (lt - 0.42) * 2.5 : 0);
    const ang = lt < 0.42 ? 3.1 - lt * 7 : 0.16 + Math.sin(lt * 2) * 0.02;
    const eye = eob(lin(0.5, 0.6, lt)), look = lt > 1.3 ? Math.sin((lt - 1.3) * 2.6) * 0.9 : 0;
    if (eye > 0) glow(sx + 2, sy - 2, 56 + Math.sin(t * 4) * 6, T_MAG, 0.5 * Math.min(1, eye));
    z5MaskShard(sx, sy, 2.4, ang, eye, look, t);
    // the clouds close over its lower edge
    for (let k = 0; k < 5; k++) cloudPuff(sx - 48 + k * 24, sy + 26 + (k & 1) * 5, 13 + (k % 3) * 3, [18, 19, 15, 16], 5323 + k);
    const lg = lt - 0.42;
    if (lg > 0 && lg < 0.5) for (let k = 0; k < 16; k++) { const a = -PI * (0.05 + 0.9 * ih(k, 1, 5324)), v = 60 + ih(k, 2, 5324) * 80; rectF(sx + Math.cos(a) * lg * v, sy + 20 + Math.sin(a) * lg * v * 0.6 + lg * lg * 120, 2, 2, 16); }
    if (lt > 0.5 && lt < 0.56) mapFx(INV, 1);
    const pin = eio(lin(0.6, 2.8, lt));
    z5Cam(1 + pin * 0.7, 0, lerp(240, sx - 4, pin), lerp(135, sy, pin), 240, 135);
    tintAll(T_DARK, sstep(2.4, 2.98, lt));
  });

  /* ================================================================ 14 — the title (1:54–2:00) */
  shot(114.0, 120.0, (lt, t) => {
    rectF(0, 0, W, H, 63);
    stars(t, H, 120, 5331);
    const s = 'FABLE 5.5', sc = lt < 0.08 ? 7 : 6, w = textWidth(s, sc), x0 = 240 - w / 2;
    text(s, x0, 70 - (sc - 6) * 3, (i, j, k) => (j < 2 ? 22 : EL[k % 4][j < 5 ? 2 : 1]), sc, 0);
    if (lt < 0.1) flashWhite(0.8 * (1 - lt / 0.1));
    if (lt > 0.7) { const s2 = 'PART III · THE UNMAKER'; text(s2, 240 - textWidth(s2, 2) / 2, 132, 59, 2, 0, fl((lt - 0.7) * 30)); }
    if (lt > 1.6) { const s3 = 'TO BE CONTINUED'; text(s3, 240 - textWidth(s3, 1) / 2, 162, 19, 1, undefined, fl((lt - 1.6) * 30)); }
    actor(HERO({ eyes: 'normal', sword: -1.0, swordCols: z5Sw(t * 0.3) }), 240, 210, 1.4, 0, false);
  });
  }
