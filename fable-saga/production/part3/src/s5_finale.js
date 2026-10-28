  /* ================================================================ part III, second half (0:57–2:00): s5_finale */
  // Everything here lives in one block, so its helpers are private to it; only the shots, captions, cut-flashes and
  // whip pans escape (into SHOTS, CAPS, FLASH_CUTS, WHIPS).
  {
  const Z5B = new Uint8Array(NP), Z5C = new Uint8Array(NP);   // spare frames: dissolves, fades, split skies
  const PRISM = [81, 82, 83, 84, 85, 86, 87], ZEN_AURA = [59, 60, 22, 22];
  // the zenith flame: hot gold with a violet fringe, so the white body keeps its edge against it (and against the bloom)
  const ZEN_FLAME = [62, 58, 59, 60];
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
      orbAt(cx + Math.cos(a) * R, cy + z * R * tilt, k, r * (0.98 + 0.14 * z), t);          // nearer is bigger, smoothly
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
  // a wingbeat: a quick downstroke and a slower recovery (the phase is skewed); returns -1 (down) .. 1 (up)
  const z5Beat = (t) => Math.sin(t * 3 - 0.5 * Math.cos(t * 3));
  // the body rides the wings: it is lifted on the downstroke and sinks while they recover (in pixels, for scale S)
  const z5Bob = (t, S, flap) => z5Beat(t) * Math.min(1, (flap === undefined ? 0.24 : flap) / 0.24) * 0.9 * S;
  function z5Wings(x, y, s, t, spread, flap) {
    if (spread <= 0.02) return;
    const amp = flap === undefined ? 0.24 : flap, sh = fl(t * 8);
    glow(x, y - 8 * s, 70 * s * spread, T_GOLD, 0.3 * spread);
    for (const sd of [-1, 1]) {
      const beat = z5Beat(t) * amp, arm = -0.78 - beat + (1 - spread) * 1.3, ax = Math.cos(arm) * sd, ay = Math.sin(arm), Lw = 40 * s * (0.35 + 0.65 * spread);
      const RANKS = [[9, 1, 0], [8, 0.62, 1], [7, 0.36, 2]];
      for (const [N, len, rank] of RANKS) for (let j = N - 1; j >= 0; j--) {
        const u = (j + 0.6) / N, bx = x + ax * Lw * u, by = y + ay * Lw * u - Math.sin(u * PI) * 5 * s;
        const bu = z5Beat(t - 0.12 * u) * amp, fr = lerp(PI / 2 - 0.12, -0.15 - bu * 1.5, Math.pow(u, 1.25)) - (1 - spread) * 0.5, fa = sd > 0 ? fr : PI - fr;
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
    const wt = o.wt === undefined ? t : o.wt, bob = z5Bob(wt, S, o.flap) * sp;
    z5Wings(x - Math.sin(ang) * 6 * S, y + bob - Math.cos(ang) * 6 * S, S * (o.ws || 0.6), wt, sp, o.flap);
    const a = actor(HEROZ({ eyes: o.eyes || 'glow', mouth: o.mouth, sword: o.sw, swordCols: z5Sw(t), legs: o.legs, sq: o.sq, reach: o.reach }), x, y, S, ang, !!o.flip, { white: o.white, after: o.after, bob });
    z5Eyes();
    if (o.rim) z5Rim(o.rim[0], o.rim[1], o.rim[2], Math.max(2, S * 1.4));
    aura(t, o.auraC || ZEN_FLAME, o.auraR || 3 * S, { sparks: o.sparks === undefined ? 12 : o.sparks, rise: o.rise });
    if (!o.white) z5Rim(0, 0, null, 0, 63);
    if (o.orbR) z5Orbs(x, y, o.orbR, t, o.orbr || S * 1.3, o.tilt || 0.38, true);
    return a;
  }
  /* -------------------------------------------------------------- the duel: a fighter that is a pure function of its track
     The fight shots drive the hero from key tracks without life() (whose springs are stateful): every lean, stretch, reach
     and slash trail here is computed from the track itself, so a hit-stop (the track clock held) freezes the whole pose,
     smear and all, and any frame can be seeked. */
  const Z5NUM = NUMF.concat(['spread', 'flap']);
  const EQ = (u) => u * u;                                 // a swing: accelerating all the way into the hit
  // trk() with ease functions allowed, and arcs: a segment whose end key time is in keys.arcs travels on a bow of that
  // many px (positive bows to the left of the direction of travel)
  function z5Trk(keys, t) {
    if (typeof keys === 'function') return keys(t);         // (a pose can also be a function of time)
    let k = 0; while (k < keys.length - 1 && keys[k + 1].t <= t) k++;
    const A = keys[k], B = keys[k + 1], o = Object.assign({}, A);
    if (B && t > A.t) {
      const u = (typeof B.e === 'function' ? B.e : EASE[B.e || 'io'])(clamp((t - A.t) / (B.t - A.t), 0, 1));
      for (const f of Z5NUM) if (typeof A[f] === 'number' && typeof B[f] === 'number') o[f] = A[f] + (B[f] - A[f]) * u;
      const arc = keys.arcs && keys.arcs.get(B.t);
      if (arc) { const dx = B.x - A.x, dy = B.y - A.y, L = Math.hypot(dx, dy) || 1, b = Math.sin(PI * u) * arc; o.x += dy / L * b; o.y -= dx / L * b; }
    }
    return o;
  }
  // a pose with its motion: velocity, a lean and a stretch along the path, the blade's world angle and how fast it turns
  function z5Pose(keys, tt) {
    const p = z5Trk(keys, tt), q = z5Trk(keys, tt - 1 / 30), r = z5Trk(keys, tt - 0.1);
    const vx = (p.x - q.x) * 30, vy = (p.y - q.y) * 30, sp = Math.hypot(vx, vy), svx = (p.x - r.x) * 10;
    p.vx = vx; p.vy = vy; p.sp = sp; p.svx = svx;
    p.st = clamp((sp - 110) / 1250, 0, 0.42); p.sd = Math.atan2(vy, vx);
    p.lean = clamp(svx / 2600, -0.16, 0.16);
    p.ang = (p.a || 0) + p.lean;
    p.wa = (p.sw || 0) + p.ang;
    const qa = (q.sw || 0) + (q.a || 0) + clamp((q.x - z5Trk(keys, tt - 0.1 - 1 / 30).x) * 10 / 2600, -0.16, 0.16);
    p.swv = (p.wa - qa) * 30;                               // rad/s, signed
    p.reachT = (p.reach || 0) + clamp(Math.abs(p.swv) / 9, 0, 4);
    return p;
  }
  // where buildSprite puts the hand for this pose (scale S, after the stretch), and a point a fraction f along the blade
  function z5HandP(p, S) {
    const sq = p.sq || 0, bw = Math.round(26 * (1 + sq * 0.5) / 2) * 2, bh = Math.max(10, Math.round(16 * (1 - sq * 0.4)));
    const y0 = -Math.round(bh / 2), ah = Math.max(3, Math.round(bh * 0.32)), shY = y0 + Math.round(bh * 0.34) + ah / 2 - 0.5;
    const armA = clamp((p.sw || 0) * 0.45, -1.1, 0.9), r = 3 + (p.reachT || 0);
    const lx = (bw / 2 - 1 + Math.cos(armA) * r) * S, ly = (shY + Math.sin(armA) * r + 0.5) * S, c = Math.cos(p.ang), s = Math.sin(p.ang);
    let dx = lx * c - ly * s, dy = lx * s + ly * c;
    if (p.st) { const su = Math.cos(p.sd), sv = Math.sin(p.sd), k1 = 1 + p.st, a = (dx * su + dy * sv) * k1, b = (-dx * sv + dy * su) / Math.sqrt(k1); dx = a * su - b * sv; dy = a * sv + b * su; }
    return [p.x + dx, p.y + dy];
  }
  const z5Blade = (p, S, f) => { const h = z5HandP(p, S); return [h[0] + Math.cos(p.wa) * 29 * S * f, h[1] + Math.sin(p.wa) * 29 * S * f]; };
  // a slash trail: a crescent swept about (hx, hy) from a0 through d radians (signed, may go round more than once is
  // capped at a full turn); thick and white at its leading edge, a band of prism colour across it, thinning and
  // dissolving into its tail; fade 0 (fresh) .. 1 (gone)
  function z5Arc(hx, hy, a0, d, L, fade) {
    const ad = Math.min(Math.abs(d), TAU - 0.05); if (ad < 0.3 || fade >= 1) return;
    const R = L * 1.1, x0 = Math.max(0, fl(hx - R)), x1 = Math.min(W - 1, Math.ceil(hx + R)), y0 = Math.max(LB, fl(hy - R)), y1 = Math.min(H - LB - 1, Math.ceil(hy + R));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const i = y * W + x; if (SMASK[i]) continue;
      const dx = x + 0.5 - hx, dy = y + 0.5 - hy, r = Math.sqrt(dx * dx + dy * dy);
      if (r > R || r < L * 0.42) continue;
      let rel = Math.atan2(dy, dx) - a0; rel = d > 0 ? ((rel % TAU) + TAU) % TAU : ((-rel % TAU) + TAU) % TAU;
      if (rel > ad) continue;
      const u = rel / ad, rin = L * (1 - 0.52 * Math.pow(u, 1.6)), rout = L * (1.02 + 0.06 * u);
      if (r < rin || r > rout) continue;
      const e = (r - rin) / (rout - rin), b = bay(x, y);
      if (b > u * 1.8 - fade * 1.9) continue;                          // the tail (and, as it fades, all of it) dissolves
      BUF[i] = (e > 0.8 && u > 0.5) || u > 0.93 ? 22 : u > 0.7 ? (e > 0.45 ? 60 : PRISM[fl(e * 6.99)]) : PRISM[fl(e * 6.99)];
    }
  }
  // the trail of the last few frames of a track's blade: only the fast part of the stroke, shrinking from its tail as the
  // stroke ages out (a held track holds it)
  function z5Trail(keys, tt, hand, S) {
    const N = 5, wa = []; for (let k = 0; k <= N; k++) wa.push(z5Pose(keys, tt - k / 30).wa);
    let m = 0, newest = -1; for (let k = 0; k < N; k++) if (Math.abs(wa[k] - wa[k + 1]) > 0.3) { m = k + 1; if (newest < 0) newest = k; }
    if (!m) return;
    z5Arc(hand[0], hand[1], wa[m], wa[0] - wa[m], 29 * S * 1.03, newest / N * 0.9);
  }
  // the light of a scene on the last stamped sprite: the edge facing (lx, ly) takes c (the outline is left alone), and a
  // one-pixel line of ink cc round the outside keeps the silhouette crisp against glows and bloom
  function z5Rim(lx, ly, c, d, cc) {
    if (SMB[2] < SMB[0]) return;
    const x0 = Math.max(1, SMB[0] - 1), x1 = Math.min(W - 2, SMB[2] + 1), y0 = Math.max(LB, SMB[1] - 1), y1 = Math.min(H - LB - 1, SMB[3] + 1);
    const ox = Math.round(lx * d), oy = Math.round(ly * d);
    if (c !== undefined && c !== null) for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const i = y * W + x; if (!SMASK[i]) continue;
      const b = BUF[i]; if (b >= 81 && b <= 87) continue;
      const X = x + ox, Y = y + oy;
      if (X < 0 || Y < 0 || X >= W || Y >= H || !SMASK[Y * W + X]) BUF[i] = c;
    }
    if (cc !== undefined) for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const i = y * W + x; if (SMASK[i]) continue;
      if (SMASK[i - 1] || SMASK[i + 1] || SMASK[i - W] || SMASK[i + W]) BUF[i] = cc;
    }
  }
  // a blade meeting something, g seconds on: a flare across the contact, sparks thrown on along the stroke (dir), void
  // ichor spat back the other way, a ring; power scales it
  function z5Hit(x, y, g, power, dir, col, seed) {
    if (g < 0 || g > 0.55) return;
    const f = g / 0.55, ca = Math.cos(dir), sa = Math.sin(dir);
    if (g < 0.17) {
      const k = 1 - g / 0.17, L1 = 80 * power * k, L2 = 26 * power * k;
      glow(x, y, 46 * power * k + 6, T_WH, 0.55);
      thick(x - ca * L1, y - sa * L1, x + ca * L1, y + sa * L1, k > 0.5 ? 2 : 1, 22);
      lineP(x + sa * L2, y - ca * L2, x - sa * L2, y + ca * L2, 22);
      discF(x, y, 2 + 5 * power * k, 22);
    }
    for (let k = 0; k < 24 * power; k++) {
      const a = dir + (ih(k, 1, seed) - 0.5) * 1.5, v = (80 + ih(k, 2, seed) * 280) * power, dd = v * g * (1 - g * 0.9), px = x + Math.cos(a) * dd, py = y + Math.sin(a) * dd + 140 * g * g;
      if (bay(fl(px), fl(py)) > 1.15 - f) continue;
      const tl = 2 + v * 0.025 * (1 - f);
      lineP(px, py, px - Math.cos(a) * tl, py - Math.sin(a) * tl, k % 3 ? col : 22);
    }
    for (let k = 0; k < 12 * power; k++) {
      const a = dir + PI + (ih(k, 3, seed) - 0.5) * 1.8, v = (40 + ih(k, 4, seed) * 120) * power, px = x + Math.cos(a) * v * g, py = y + Math.sin(a) * v * g + 200 * g * g, s = 1 + fl(ih(k, 5, seed) * 2.5);
      if (bay(fl(px), fl(py)) > 1 - f) continue;
      rectF(px, py, s, s, k % 4 ? 77 : 74);
    }
    if (g < 0.3) shockRing(x, y, 4 + g * 220 * power, 3 + g * 150 * power, 2, [22, col, col], 1 - g / 0.3);
    shk(4 * power * Math.max(0, 1 - g * 4));
  }
  // the zenith hero driven by a track (faces right): wings that beat and flare with the pose, orbs trailing the body,
  // ghosts on a dash, the prism slash trail, the light of the scene on its edge; base: { S, orbR, auraR, rim: [lx, ly, c] }
  function z5Fight(keys, tt, base) {
    const p = z5Pose(keys, tt), S = p.S || base.S || 2, t = T_NOW, f = fl(t * 30);
    const vib = (p.vib || 0) + FRZ, jx = vib ? Math.round((ih(f, 3, 601) - 0.5) * 2 * vib) : 0, jy = vib ? Math.round((ih(f, 4, 601) - 0.5) * 2 * vib) : 0;
    const idle = 1 - clamp(p.sp / 220, 0, 1), wt = tt * (base.flap || 1.6), fa = p.flap === undefined ? 0.26 : p.flap, bob = z5Bob(wt, S, fa) * idle;
    const OX = base.ox || 0, x = p.x + jx + OX, y = p.y + jy + bob, ang = p.ang;
    // the orbs trail the body (they are where it was a moment ago), so they swing out on every dash and catch up
    const og = z5Trk(keys, tt - 0.09); og.x += OX;
    if (base.orbR) z5Orbs(og.x, og.y, base.orbR, tt, S * 1.2, 0.4, false);
    z5Wings(x - Math.sin(ang) * 6 * S, y - Math.cos(ang) * 6 * S, S * 0.55, wt, p.spread === undefined ? 1 : p.spread, fa);
    const after = [];
    if (p.sp > 280) for (let k = 1; k <= 3; k++) { const a = z5Trk(keys, tt - k * 0.03); after.push([a.x + OX, a.y, k === 1 ? 22 : PRISM[(k * 2 + f) % 7], 0.6 - k * 0.14]); }
    // the feet trail the motion; at rest they paddle
    const lvx = p.svx * Math.cos(ang) + (p.vy || 0) * Math.sin(ang) * 0.3, legSh = clamp(-lvx / (60 * S), -3, 3) + Math.sin(tt * 4.2) * 0.7 * idle;
    const legs = [0, 1, 2, 3].map((k) => Math.max(0, Math.sin(tt * 6.5 + k * 1.6)) * 1.2 * idle + (p.sq > 0.15 ? 1 : 0));
    const res = actor(HEROZ({ eyes: p.eyes || 'glow', mouth: p.mouth, sword: p.sw, swordCols: z5Sw(t), sq: (p.sq || 0) + Math.sin(tt * 3.1) * 0.04 * idle, reach: p.reachT, legs, legSh }), x, y, S, ang, false, { still: true, after, st: p.st, sd: p.sd });
    z5Eyes();
    if (base.rim) z5Rim(base.rim[0], base.rim[1], base.rim[2], Math.max(2, S * 1.4));
    aura(t, ZEN_FLAME, base.auraR || 3 * S, { sparks: 10, rise: base.rise });
    z5Rim(0, 0, null, 0, 63);
    if (base.orbR) z5Orbs(og.x, og.y, base.orbR, tt, S * 1.2, 0.4, true);
    z5Trail(keys, tt, res.hand, S);
    // a cocked blade, held: a glint runs up it to the point (the tell before the stroke)
    if ((p.sq || 0) > 0.24 && Math.abs(p.swv) < 3) { const u = frac(tt * 3.2), gx = lerp(res.hand[0], res.tip[0], u), gy = lerp(res.hand[1], res.tip[1], u); sparkle(gx, gy, 2 + u * 5, 22, 60); if (u > 0.8) glow(res.tip[0], res.tip[1], 22, T_WH, 0.5); }
    // a thrust leaves no arc: streaks run back from the point along the lunge
    if (p.sp > 500 && Math.abs(p.swv) < 6) for (let k = 0; k < 5; k++) { const o = (k - 2) * 3 * S * 0.5, L = p.sp * 0.09, ca = Math.cos(p.sd), sa = Math.sin(p.sd), bx = res.tip[0] - sa * o - ca * 6, by = res.tip[1] + ca * o - sa * 6; lineF(bx, by, bx - ca * L, by - sa * L, (X, Y, u) => { if (bay(X, Y) < 0.9 - u) P(X, Y, k === 2 ? 22 : PRISM[(k + f) % 7]); }); }
    return { x, y, S, hand: res.hand, tip: res.tip, p, sp: p.sp };
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
  function z5Beam(x0, y0, x1, y1, w, colAt, t, seed, wf) {
    const dx = x1 - x0, dy = y1 - y0, L2 = dx * dx + dy * dy, L = Math.sqrt(L2) || 1, w0 = w;
    if (wf) w *= 1.8;                                         // (wf(s): a width factor along it, for pulses; bound the box)
    const bx0 = Math.max(0, fl(Math.min(x0, x1) - w * 2)), bx1 = Math.min(W - 1, Math.ceil(Math.max(x0, x1) + w * 2));
    const by0 = Math.max(0, fl(Math.min(y0, y1) - w * 2)), by1 = Math.min(H - 1, Math.ceil(Math.max(y0, y1) + w * 2));
    for (let y = by0; y <= by1; y++) for (let x = bx0; x <= bx1; x++) {
      const px = x + 0.5 - x0, py = y + 0.5 - y0, u = clamp((px * dx + py * dy) / L2, 0, 1), qx = px - u * dx, qy = py - u * dy, d = Math.sqrt(qx * qx + qy * qy);
      const wob = w0 * (wf ? wf(u * L) : 1) * (0.85 + 0.15 * Math.sin(u * L * 0.25 - t * 40 + seed) + 0.08 * Math.sin(u * L * 0.7 + t * 23));
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

  /* -------------------------------------------------------------- motion: springs, knocks, drift (all pure functions of time, so any frame can be seeked) */
  // a knock g seconds after an impact: out fast to amp, back past zero once or twice, settled (0 before the impact)
  function z5Knock(g, amp, w, d) {
    if (g <= 0) return 0;
    w = w || 16; d = d || 6;
    const gp = Math.atan(w / d) / w, n = Math.exp(-d * gp) * Math.sin(w * gp);
    return amp * Math.exp(-d * g) * Math.sin(w * g) / n;
  }
  // the sum of knocks from a list of impact times
  const z5Knocks = (t, hits, amp, w, d) => { let s = 0; for (const h of hits) s += z5Knock(t - h, amp, w, d); return s; };
  // an arrival that overshoots and rings out: 0 → 1 (critically under-damped step; g in seconds, w the ring rate)
  const z5Step = (g, w, d) => (g <= 0 ? 0 : 1 - Math.exp(-(d || 7) * g) * (Math.cos((w || 12) * g) + (d || 7) / (w || 12) * Math.sin((w || 12) * g)));
  // smooth drift noise (-1..1), a few incommensurate sines: for floating cameras, buffeting, moving holds
  const z5N = (t, s) => Math.sin(t * 1.13 + s) * 0.5 + Math.sin(t * 1.97 + s * 2.3) * 0.3 + Math.sin(t * 3.41 + s * 0.7) * 0.2;
  // faster shudder (strain, buffet): still smooth, so life() reads it as tremble rather than teleporting
  const z5Sh = (t, s) => Math.sin(t * 31 + s) * 0.5 + Math.sin(t * 47.3 + s * 1.9) * 0.3 + Math.sin(t * 19.7 + s * 3.1) * 0.2;
  // a quadratic bezier point
  const z5Bz = (a, b, c, u) => (1 - u) * (1 - u) * a + 2 * (1 - u) * u * b + u * u * c;
  // a limp body's legs, drifting slowly as if under water
  const z5Limp = (t, amt) => [0, 1, 2, 3].map((k) => clamp(1.2 + Math.sin(t * 0.9 + k * 1.7) * amt, 0, 3));
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
  // a giant porcelain finger (as the crush draws them): a chain of shaded, tapering segments, each turned by curl
  function z5Finger(x, y, a, lens, r, curl) {
    const pts = [[x, y, r]]; let px = x, py = y, aa = a, rr = r;
    for (const L of lens) { const n = Math.ceil(L / 2); for (let k = 1; k <= n; k++) { px += Math.cos(aa) * L / n; py += Math.sin(aa) * L / n; pts.push([px, py, rr * (1 - 0.18 * k / n)]); } rr *= 0.82; aa += curl; pts.push(null); }
    for (const pass of [0, 1, 2]) for (const q of pts) { if (!q) continue; const [qx, qy, qr] = q; if (pass === 0) discF(qx, qy, qr + 1.6, 69); else if (pass === 1) discF(qx, qy, qr, 65); else discF(qx - qr * 0.25, qy - qr * 0.3, qr * 0.45, 64); }
    for (let i = 0; i < pts.length; i++) if (!pts[i] && i > 0 && i < pts.length - 1) { const [qx, qy, qr] = pts[i - 1]; thick(qx - qr * 0.6, qy, qx + qr * 0.6, qy, 2, 67); }
  }
  // 0: where the crush leaves it (same hand, same lens): the fist eases open, the shards of the sword drift on, slowing,
  // and the grey body slides out between the fingers and begins to fall, turning, with nothing holding it
  function lost0(lt, t) {
    const CX = 250, CY = 140, open = eio(lin(0.12, 1.2, lt)), lift = eio(lin(0.55, 1.9, lt)), hx0 = lift * 46, hy0 = -lift * 120;
    gradient(LB, H - LB, [76, 77, 78, 92, 93]);
    for (let k = 0; k < 40; k++) { const u = frac(ih(k, 1, 5007) + t * 0.03), x = ih(k, 2, 5007) * W + Math.sin(t * 0.4 + k) * 4, y = H - LB - u * (H - 2 * LB); P(x, y, ih(k, 3, 5007) < 0.3 ? 94 : 93); }
    // the hero: the grip gives (it sags a hair as the fingers part), then it slips free and falls, slowly, rolling over
    const g = Math.max(0, lt - 0.4), sag = 3 * sstep(0.1, 0.5, lt), out = eio(lin(0.25, 1.1, lt));
    const hx = 280 - out * 50 - g * 9 - Math.sin(g * 1.3) * 3, hy = 140 + sag + g * 5 + 7 * g * g, ang = 0.2 + g * 0.32 + Math.sin(g * 1.5) * 0.08;
    // the palm (behind), the body in it, and the fingers uncurling over it; then the hand drawn away up out of the light
    discF(CX + 96 + hx0, CY + 8 + hy0, 74, 69); discF(CX + 96 + hx0, CY + 8 + hy0, 72, 66); discF(CX + 88 + hx0, CY + hy0, 60, 65); discF(CX + 78 + hx0, CY - 14 + hy0, 30, 64);
    if (lt > 0.22) actor(HERO({ form: 'grey', eyes: 'closed', legs: z5Limp(t, 0.6 + 0.4 * open), sq: -0.15 * (1 - open) + Math.sin(t * 1.4) * 0.03 * open, outline: 95 }), hx, hy, 3.4, ang, false, { still: true });
    for (let f = 0; f < 4; f++) { const cf = 1 - open * (0.75 + f * 0.05) * eio(lin(0.12 + f * 0.06, 1.2 + f * 0.05, lt)) / Math.max(0.01, open); z5Finger(CX + 54 + hx0, CY - 66 + f * 36 + hy0, PI + 0.25 - f * 0.12 + open * 0.15, [44 - Math.abs(f - 1.5) * 4, 36, 26], 15 - Math.abs(f - 1.5), 0.25 + cf * 0.85 + (f > 1 ? -0.1 : 0)); }
    z5Finger(CX + 60 + hx0, CY + 96 + hy0, -PI * 0.75 - open * 0.3, [40, 30], 15, -0.8 + open * 0.55);
    // the shards of the sword, still flying out from the fist as they were, slowing to a drift (nothing to fall toward)
    const G = 0.5 + (1 - Math.exp(-2 * lt)) / 2;
    for (let k = 0; k < 26; k++) { const a = -PI * 0.2 - ih(k, 1, 291) * PI * 1.2, v = 120 + ih(k, 2, 291) * 260, x = CX - 20 + Math.cos(a) * v * G, y = CY + Math.sin(a) * v * G + 120 * G * G - lt * 6, rot = G * (8 + k) + lt * 0.4; thick(x, y, x + Math.cos(rot) * 7, y + Math.sin(rot) * 7, 2, k % 3 ? 34 : 22); }
    mapFx(GREYM, 1);
    // the lens of the crush, easing back and sinking after the body
    const pull = eio(lin(0.3, 1.9, lt));
    z5Cam(1.2 - 0.12 * pull, 0.006 * z5N(t * 0.5, 2) * pull, lerp(250, 238, pull), lerp(140, 158, pull), 240, 135);
  }
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
    // the hero: the fingers part and it lifts a hair (the grip letting go), then gravity takes it, slowly at first; it
    // sways like a leaf as it goes and tumbles unevenly (the turn speeds and slackens), limbs drifting
    const hf = 120 * Math.pow(Math.max(0, lt - 0.25) / 4, 1.5), pop = -4 * Math.sin(PI * clamp(lt / 0.7, 0, 1)) * (1 - clamp(lt / 0.7, 0, 1));
    const ramp = clamp(lt / 1.2, 0, 1), hx = 196 + lt * 4 + Math.sin(lt * 1.15) * 6 * ramp, hy = 128 + hf - drift + pop;
    const hang = 0.3 + lt * 0.24 + Math.sin(lt * 1.3) * 0.16 * ramp;
    z5Shards(hx, hy, 46, 1.4, t + 3, 0, 0, 0);
    actor(HERO({ form: 'grey', eyes: 'closed', legs: z5Limp(t, 0.9 * ramp), sq: Math.sin(t * 1.4) * 0.03, outline: 95 }), hx, hy, 1.4, hang, false, { still: true });
    // the camera floats, and sinks a little after the falling body
    z5Cam(1.02 + eio(lt / 3.4) * 0.05, 0.012 * Math.sin(t * 0.4) + 0.008 * z5N(t * 0.6, 1), 240 + z5N(t * 0.5, 2) * 3, 135 + eic(clamp(lt / 3.4, 0, 1)) * 8, 240, 135);
    mapFx(GREYM, 1);
  }
  // B: closer, the hero tumbling slowly through nothing, the pieces of the sword turning with it
  function lostB(lt, t) {
    z5Grey(t, 0.11, true);
    // weightless: a slow uneven tumble (the turn swells and eases), a lazy figure-of-eight drift, limbs adrift
    const hx = 238 + Math.sin(lt * 0.5) * 6 + z5N(lt * 0.7, 4) * 4, hy = 132 + lt * 3 + Math.sin(lt * 0.9 + 1) * 3, ang = 0.9 + lt * 0.15 + Math.sin(lt * 0.8) * 0.14;
    z5Shards(hx, hy, 150, 3.0, t, 0, 0, 0);
    actor(HERO({ form: 'grey', eyes: 'closed', legs: z5Limp(t + 2, 1), sq: Math.sin(t * 1.4) * 0.03, outline: 95 }), hx, hy, 3.2, ang, false, { still: true });
    // the camera drifts after the body a beat late (it follows where the body was half a second ago)
    const lx = 238 + Math.sin((lt - 0.5) * 0.5) * 6 + z5N((lt - 0.5) * 0.7, 4) * 4, ly = 132 + (lt - 0.5) * 3;
    z5Cam(1 + eio(lt / 2.6) * 0.06, 0.02 * Math.sin(t * 0.3) + 0.01 * z5N(t * 0.5, 5), lx, ly, 240, 135);
    mapFx(GREYM, 1);
  }
  // C: the face, eyes shut; then, in the chest, the only colour in the world
  function lostC(lt, t) {
    z5Grey(t, 0.07, true);
    // the face drifts and turns very slowly; every heartbeat of the returning spark tightens the body a touch
    let beat = 0; for (const b of [64.8, 65.25, 65.62, 65.9]) beat += z5Knock(t - b, 0.05 + (b - 64.8) * 0.03, 14, 7);
    const flick = t > 63.5 && t < 64.1 ? 0.012 * Math.sin((t - 63.5) * 40) : 0;
    const S = 7.2 + eio(lt / 2.8) * 0.8, hx = 246 - lt * 2 + z5N(lt * 0.6, 7) * 3, hy = 150 + Math.sin(lt * 0.9) * 3 - eio(lt / 2.8) * 3, ang = 0.2 - lt * 0.05 + Math.sin(lt * 0.7) * 0.03 + beat * 0.3;
    actor(HERO({ form: 'grey', eyes: 'closed', outline: 93, legs: z5Limp(t + 4, 0.8), sq: beat + flick + Math.sin(t * 1.4) * 0.02 }), hx, hy, S, ang, false, { still: true });
    // one big shard drifts across the foreground and catches the light
    const u = lin(0.2, 2.7, lt), sx = lerp(520, -60, u), sy = lerp(70, 110, u), rot = 2.2 + lt * 0.5, lit = Math.pow(Math.max(0, Math.cos(rot * 1.3 + 0.8)), 6);
    z5Shard(sx, sy, 34, 5, rot, lit, true);
    mapFx(GREYM, 1);
    z5Spark(hx - Math.sin(ang) * 3 * S, hy + Math.cos(ang) * 3 * S, S, t);
    // a slow float, and the faintest lean in toward the chest when the spark answers
    const lean = sstep(64.0, 65.6, t);
    z5Cam(1.01 + lean * 0.04, 0.008 * z5N(t * 0.5, 8), 240 + z5N(t * 0.4, 9) * 2, 135 + lean * 10, 240, 135);
  }
  shot(57.0, 66.0, (lt, t) => {
    if (t < 58.3) lost0(lt, t);
    else if (t < 58.9) z5Mix(eio(lin(58.3, 58.9, t)), () => lost0(lt, t), () => lostA(lt, t));
    else if (t < 60.4) lostA(lt, t);
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
    const open = eob(lin(0.5, 0.78, lt)), shake = lt > 0.25 && lt < 0.5 ? Math.round(z5Sh(t, 1) * 2 * sstep(0.25, 0.4, lt)) : 0;
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
    // the camera creeps in while the lid strains, is knocked back by the light, then is drawn on into it
    z5Cam(1 + 0.07 * eio(lt / 0.75) - z5Knock(lt - 0.78, 0.05, 12, 5) + 0.05 * eic(clamp((lt - 0.78) / 1.2, 0, 1)), 0.006 * z5N(t, 3), 240, 135 - 4 * eio(lt / 1.9), 240, 135);
    flashWhite(sstep(1.55, 1.97, lt));
  });

  /* ================================================================ 3 — the elements come home (1:08–1:12) */
  const CRK = [[-30, 38, -0.4], [26, 46, 0.5], [-10, 64, 2.6], [36, 70, -2.6]];   // where the light splits the body (local), and which way
  shot(68.0, 69.6, (lt, t) => {
    gradient(LB, H - LB, [93, 93, 92, 92, 0]);
    cloudBank(236, 26, 70, 5111, t * 4, GREYS, true);
    // each crack jolts the body away from it; just before the burst it clenches (sinks, arms drawn in), then it is thrown
    // back and up and rings out (an under-damped step), the arms flung a beat after the body
    const go = lt - 1.0, recoil = z5Step(go, 11, 6), armR = z5Step(go - 0.05, 9, 5), pre = sstep(0.7, 1.0, lt) * (1 - lin(0, 0.08, go));
    let jx = 0, jy = 0; for (let k = 0; k < 4; k++) { const kn = z5Knock(lt - k * 0.22, 2.6, 18, 7); jx -= Math.sign(CRK[k][0]) * kn; jy -= kn * 0.5; }
    const BX = 300 + jx + recoil * 5, BY = 80 - recoil * 10 + pre * 4 + jy, s = 2.05;
    flashWhite(lt < 0.1 ? 1 - lt / 0.1 : 0);
    unmaker(BX, BY, s, t, { eyes: 2, crack: 1, eye4: 1, grin: lerp(1, 0.2, sstep(0.2, 0.9, lt)), look: [-0.7 + jx * 0.1, 0.6 - recoil * 0.5], halo: 1, shake: lt * 1.2 + recoil * 1.5,
      arms: [[-50, 30, -84 + pre * 14 + armR * 20, 30 + pre * 8 - armR * 30, 0.4 + armR * 0.6], [52, 30, 86 - pre * 14, 40 + pre * 8 - armR * 20, 0.6 + armR * 0.4]] });
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
    // each orb lands like a blow: the body is knocked down-left along its path, squashes, and comes back; then it
    // gathers itself (crouches, trembling, rising) for the burst, sword lifting
    let kx = 0, ky = 0, ksq = 0;
    for (let k = 0; k < 4; k++) { const g = lt - ORB_IN[k]; kx += z5Knock(g, -4.5, 15, 6); ky += z5Knock(g, 2 - k * 0.6, 15, 6); ksq += z5Knock(g, 0.16, 18, 7); }
    const o = HERO({ form: restored ? undefined : 'grey', eyes: 'glow', legs: [0, 1, 0, 1], sq: ksq + build * 0.18 + build * Math.sin(t * 40) * 0.05 });
    if (lt > 1.75) { o.sword = -0.9 - 0.3 * sstep(1.9, 2.3, lt); o.swordCols = lt < 1.85 ? [22] : z5Sw(t); }
    const jx = z5Sh(t, 2) * build * 1.6, jy = z5Sh(t, 5) * build * 1.0, rise = -7 * eio(clamp((lt - 1.5) / 0.85, 0, 1));
    const a0 = -0.05 + kx * 0.012 + Math.sin(t * 1.3) * 0.03 * (1 - build);
    if (nIn) z5Orbs(HX, HY, 34, t, 4, 0.4, false, ORB_IN.map((a) => lt > a + 0.1));
    const a = actor(o, HX + jx + kx, HY + jy + ky + rise, S, a0, false, { white });
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
    // the burst throws the body up out of its crouch (squash → stretch → a ringing settle); the sword arm follows through
    // past its mark and comes back; the orbs are flung out from the chest and swing wide before they find their orbit
    const sq = lt < 0.08 ? 0.35 : lerp(-0.25, 0, z5Step(lt - 0.08, 13, 5)), lift = z5Step(lt - 0.04, 9, 4.5);
    const hy = HY + 9 - lift * 11 + Math.sin(t * 1.7) * 1.2 * lift;
    z5Zenith(HX, hy, S, t, { sw: -1.3 + 0.5 * (1 - z5Step(lt - 0.05, 10, 4)), mouth: lt < 1.0 ? 2 : 0, spread: eob(lin(0.05, 0.6, lt)), orbR: 8 + 40 * z5Step(lt - 0.06, 7, 3.5), sq, auraR: 14, sparks: 30, legs: [1, 0, 1, 0], rim: [0.9, 0.4, 15] });
    shockRing(HX, HY, 10 + lt * 520, 10 + lt * 520, 5, [22, 60, 59], 1 - lt / 0.8);
    flashWhite(lt < 0.067 ? 1 : 0);
    shk(6 * Math.exp(-lt * 3));
    // pulled out by the blast (with a little give at the end), then a slow drift up with the rising body
    z5Cam(1.3 - 0.3 * z5Step(lt, 8, 5) + 0.02 * eio(lt / 1.4), 0.01 * z5N(t * 0.6, 3), HX + z5N(t * 0.5, 4) * 2, HY - 30 - 4 * eio(lt / 1.4), 240, 150);
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
    // the hero rides the wave up a little, drifting, the sword easing back and forth with its breath
    z5Zenith(HX + z5N(lt * 0.6, 1) * 3, HY + Math.sin(t * 2) * 2 - eio(lt / 2.6) * 5, 2.1, t, { sw: -1.3 + Math.sin(t * 1.6) * 0.08, spread: 1, orbR: 30, auraR: 7, sparks: 14, rim: [0.8, 0.6, 15] });
    z5Cam(1.16 - 0.14 * eio(lt / 2.6), 0.03 * Math.sin(lt * 1.2) + 0.008 * z5N(t, 6), HX + z5N(t * 0.4, 7) * 3, HY + 10 - eio(lt / 2.6) * 4, 240, 132);
  });

  /* ================================================================ 5 — the hero shot (1:16–1:20) */
  shot(76.0, 80.0, (lt, t) => {
    // the camera circles: the sun and its rays slide behind the hero (parallax) while the orbs' ellipse tilts with the view
    const orbit = eio(lt / 4), phi = orbit - 0.5, HX = 240, S = 3.4, sunX = 268 - phi * 130, sunY = 112 + phi * 6;
    // anticipation → action → settle: it sinks, wings drawing in, the sword dipping; then rises, wings flung wide, the
    // sword thrown up past vertical and settling back; afterwards a slow breathing hover
    const g = lt - 0.5, pose = (u) => (u < 0.5 ? 3 * eio(u / 0.5) : 3 - 11 * z5Step(u - 0.5, 8, 4.5));
    const HY = 150 + pose(lt) + Math.sin(t * 1.8) * 2 * sstep(1.2, 2, lt);
    gradient(LB, H - LB, [2, 3, 4, 5, 6, 7, 8, 13, 14, 15]);
    z5GodRays(sunX, sunY, 8, orbit * 1.4 + t * 0.1, T_WARM, 0.7, 420);
    glow(sunX, sunY, 130, T_WARM, 0.8); discF(sunX, sunY, 18, 16); discF(sunX, sunY, 13, 22);
    // far clouds drifting one way, near clouds the other (the camera circles)
    for (let k = 0; k < 7; k++) cloudPuff(frac(ih(k, 1, 5141) - lt * 0.05) * 700 - 110, 190 + ih(k, 2, 5141) * 40, 18 + ih(k, 3, 5141) * 14, CLOUD_SUN, 5142 + k);
    z5Sunburst(HX, HY - 10, 18, -t * 0.25, 30, 170, 0.06);
    const sw = lt < 0.5 ? lerp(-0.7, -0.35, eio(lt / 0.5)) : lerp(-0.35, -1.45, z5Step(g, 10, 4.5)) + Math.sin(t * 1.3) * 0.04 * sstep(1.5, 2.5, lt);
    const spread = lt < 0.5 ? lerp(1, 0.78, eio(lt / 0.5)) : lerp(0.78, 1, z5Step(g, 9, 3.5));
    const sq = lt < 0.5 ? 0.12 * eio(lt / 0.5) : 0.12 * (1 - z5Step(g, 12, 6)) - z5Knock(g, 0.12, 11, 5);
    const flap = 0.16 + 0.14 * Math.exp(-Math.max(0, g) * 2) * (g > 0 ? 1 : 0);
    const a = z5Zenith(HX, HY, S, t, { sw, spread, sq, orbR: 52 + Math.sin(t * 0.9) * 3, auraR: 9, sparks: 20, tilt: 0.3 + phi * 0.22, legs: [1, 0, 1, 0], flap, rim: [Math.sign(sunX - HX + 0.1) * 0.6, -0.8, 16] });
    // the glint runs up the blade
    const gl = lin(2.0, 2.4, lt);
    if (gl > 0 && gl < 1) sparkle(lerp(a.hand[0], a.tip[0], gl), lerp(a.hand[1], a.tip[1], gl), 4, 22, 60);
    if (lt > 2.4 && lt < 2.9) { const k = 1 - (lt - 2.4) / 0.5; sparkle(a.tip[0], a.tip[1], 14 * k, 22, 60); glow(a.tip[0], a.tip[1], 40 * k, T_WH, 0.6 * k); }
    for (let k = 0; k < 6; k++) cloudPuff(frac(ih(k, 4, 5141) + lt * 0.22) * 900 - 250, 236 + ih(k, 5, 5141) * 26, 26 + ih(k, 6, 5141) * 16, CLOUD_NEAR, 5150 + k);
    // the camera follows the body a beat late (so the rise reads as a rise), rolling with the orbit and floating
    const lagY = 150 + pose(Math.max(0, lt - 0.18));
    z5Cam(0.98 + 0.12 * orbit, lerp(-0.08, 0.06, orbit) + 0.006 * z5N(t, 8), HX + z5N(t * 0.4, 9) * 3, lagY - 4, 240, 140);
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
    // the light hits it: a jolt first (the mask knocked back and up), then the slower heave away; the shielding arm comes
    // up a beat after the body and overshoots
    const jolt = z5Knock(lt - 0.12, 1, 13, 4.5), armU = eob(lin(0.22, 0.85, lt));
    const BX = 344 + rc * 26 + jolt * 7, BY = 98 - rc * 12 - jolt * 4, s = 1.9;
    unmaker(BX, BY, s, t, { eyes: 2, crack: 1, eye4: 1, grin: lerp(0.6, 0, rc), look: [-1 + jolt * 0.6, 0.4 - jolt * 0.5], halo: 1, shake: 0.6 + rc * 1.6,
      arms: [[52, 30, lerp(84, -8, armU), lerp(40, 4, armU), 1], [-50, 30, lerp(-80, -60, rc), lerp(30, 60, rc), 0.3]] });
    z5GodRays(120, 152, 6, t * 0.5, T_WH, 0.35 + rc * 0.2, 260);
    // the hero presses forward into its own light, the blade levelling, hovering
    const adv = eio(lt / 1.6);
    z5Zenith(118 + adv * 10, 152 + Math.sin(t * 2.1) * 1.5 - adv * 3, 1.9, t, { sw: -0.5 + adv * 0.2, spread: 1, orbR: 26, rays: 220, raysA: 0.5, auraR: 6, rim: [1, -0.2, 75] });
    z5Cam(1.02 + eio(lt / 1.6) * 0.05 + jolt * 0.015, 0.006 * z5N(t, 2), 240 + z5N(t * 0.5, 3) * 3 + adv * 6, 135, 240, 135);
  });
  shot(81.6, 84.0, (lt, t) => {
    // the mask shudders (a smooth tremor that grows), drawing itself up as if to inhale before it breaks; the eyes dart
    const f = fl(t * 30), tr = 0.4 + eic(lt / 2.4) * 2.6, s = 4.4;
    const CX = 240 + z5Sh(t, 1) * tr, CY = 148 + z5Sh(t * 0.8, 2) * tr * 0.6 - eio(lt / 2.4) * 6;
    gradient(LB, H - LB, VOIDSKY); stars(t, H, 90, 5171);
    glow(CX, CY - 20, 200, T_MAG, 0.25 + lt * 0.08);
    const brk = lt > 1.4 ? 0.05 * eic(lin(1.4, 2.4, lt)) + (lt > 2.1 ? 0.006 * (f & 1) : 0) : 0;
    const dart = (k) => Math.sign(Math.sin(t * 2.7 + k)) * 0.7 * (1 - Math.exp(-((t * 2.7 + k) % PI) * 6));
    unmaker(CX, CY, s, t, { eyes: 2, crack: 1, eye4: 0.7 + 0.3 * ih(f, 1, 5172), grin: lerp(0.3, 0, lin(0, 1, lt)), look: [dart(0) + Math.sin(t * 13) * 0.15, Math.cos(t * 2.1) * 0.4], halo: 1, body: false,
      shake: 0.5 + lt * 1.2, broken: brk, glow: 0.5 });
    // light leaking out through the cracks
    glow(CX + 8 * s, CY - 10 * s, 60, T_WH, 0.25 + lt * 0.1);
    z5Tear(CY - 30 * s, CY + 30 * s, 6 + lt * 8, 0.1 + lt * 0.12, t);
    if (lt > 2.1 && lt < 2.167) mapFx(INV, 1);
    shk(1 + lt * 1.4);
    z5Cam(1 + eic(lt / 2.4) * 0.09, 0.01 * z5Sh(t * 0.5, 4) * (0.3 + lt * 0.4), 240, 138 - eio(lt / 2.4) * 4, 240, 135);
  });

  /* ================================================================ 7 — the mask breaks; the page is unwritten (1:24–1:28) */
  shot(84.0, 85.7, (lt, t) => {
    // the break throws the head back (up and away: it shrinks a touch) and it rings out; the arms are flung up and out a
    // beat later, whip past, and sway back
    const kb = z5Knock(lt, 1, 9, 3.5), ka = z5Knock(lt - 0.06, 1, 7, 2.8);
    const CX = 240, CY = 126 - kb * 7, s = 3.3 * (1 - kb * 0.035), f = fl(t * 30);
    gradient(LB, H - LB, VOIDSKY); stars(t, H, 90, 5181);
    radialLines(CX, CY, 50, 70, 72, t, 5182);
    const brk = Math.min(1.25, eoc(lin(0, 0.9, lt)) * 1.25);
    unmaker(CX, CY, s, t, { eyes: 2, crack: 1, eye4: 1, halo: 1, broken: brk, heart: 1, arms: [[-50, 30, -96 - ka * 10, -6 - ka * 22, 1], [50, 30, 96 + ka * 10, -6 - ka * 22, 1]] });
    debris(CX, CY - 20, lt, 50, 170, 1.3, [64, 65, 66, 67], 5183, 220);
    shockRing(CX, CY, 10 + lt * 420, 10 + lt * 420, 4, [75, 73, 71], 1 - lt / 0.9);
    if (lt < 0.034) flashWhite(1);
    else if (lt < 0.134) impactFrame(CX, CY, 0);
    shk(8 * Math.exp(-lt * 3));
    z5Cam(1.16 - 0.16 * eoc(lt / 0.5), 0.05 * Math.exp(-lt * 3), CX, CY, 240, 135);
  });
  FLASH_CUTS.push(85.7);
  shot(85.7, 88.0, (lt, t) => {
    // the hero braces in its shrinking circle of colour: drifting, then (as the dark closes) it squares up, sinking a
    // little and bringing the blade up across itself
    const brace = eio(lin(1.0, 1.7, lt)), BX = 318, BY = 92, s = 1.55;
    const HX = 108 + z5N(lt * 0.8, 1) * 3 - brace * 3, HY = 166 + Math.sin(t * 1.9) * 2 + brace * 3;
    gradient(LB, H - LB, VOIDSKY); stars(t, H, 70, 5191);
    z5Fog9(t, t * 8);
    cloudBank(236, 20, 60, 5192, t * 6, [77, 78, 79, 62], false);
    unmaker(BX, BY, s, t, { eyes: 2, broken: 1.25, halo: 1, heart: 1, arms: [[-50, 30, -100, 10, 1], [50, 30, 100, 0, 1]] });
    shatterFx(BX, BY, 0.4 * sstep(1.3, 2.2, lt) + (lt > 1.0 && lt < 1.1 ? 0.25 : 0), t, 34);
    z5Unwrite(eio(lin(0.2, 2.3, lt)) * 0.75, t, HX, HY, 34);
    const creep = 34 * eio(lin(0.4, 2.3, lt));
    rectF(0, LB, W, creep, 0); rectF(0, H - LB - creep, W, creep, 0);
    for (let x = 0; x < W; x++) { if (ih(x >> 2, fl(t * 20), 5193) < 0.5) { P(x, LB + creep, 74); P(x, H - LB - creep - 1, 74); } }
    z5Zenith(HX, HY, 1.7, t, { sw: lerp(-0.5, -1.1, brace), sq: brace * 0.1, spread: 1 - brace * 0.15, orbR: 22 - brace * 3, auraR: 6 + brace * 2, rim: [1, -0.4, 75] });
    shk(1.5);
    z5Cam(1 + eio(lt / 2.3) * 0.08, 0.006 * z5N(t, 3), lerp(240, 200, eio(lt / 2.3)), 135 + eio(lt / 2.3) * 6, 240, 135);
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
    z5Fog9(t * 2, t * 30);
    cloudBank(230, 22, 60, 5202, t * 10, [17, 18, 19, 20], false);
    z5Swirl(EX, EY, 1.5 + lt * 0.3, 110);
    unmaker(EX, EY + 6, 2.6, t, { eyes: 2, broken: 1.3, halo: 1, heart: 1, arms: [[-50, 30, -100, 0, 1], [50, 30, 100, 0, 1]] });
    pulledClouds(EX, EY, t, 300, 5203);
    for (let k = 0; k < 40; k++) { const u = frac(ih(k, 1, 5204) + t * 0.5), a = ih(k, 2, 5204) * TAU + u * 3, r = (1 - u) * 300 + 10; rectF(EX + Math.cos(a) * r, EY + Math.sin(a) * r * 0.75, 2, 2, PRISM[k % 7]); }
    radialLines(EX, EY, 30, 70, 74, t, 5205);
    // flying against the pull: each downstroke wins a few pixels, each recovery gives some back; buffeted, pitching
    const beat = z5Beat(t * 3), hxAt = (u, tt) => 70 + eio(u / 2.2) * 60 - z5Beat(tt * 3) * 3.5 + z5N(tt * 1.7, 3) * 3;
    const hx = hxAt(lt, t), hy = 176 + Math.sin(t * 5) * 2 + z5Sh(t * 0.25, 4) * 2;
    z5Zenith(hx, hy, 2.1, t, { ang: 0.28 + z5N(t * 1.3, 5) * 0.07 - beat * 0.04, sw: 0.1 + z5N(t * 1.1, 6) * 0.12, spread: 0.9 + 0.15 * Math.sin(t * 22), wt: t * 3, orbR: 26, auraR: 7, rise: 0.3, rim: [1, -0.3, 75] });
    shk(1.5 + lt);
    // the camera trails the hero (lagging, so its surges read), leaning toward the eye as the pull grows
    z5Cam(1.02 + eio(lt / 2.2) * 0.07, lt * 0.03 + 0.008 * z5N(t, 7), 240 + (hxAt(Math.max(0, lt - 0.2), t - 0.2) - 100) * 0.35, 140, 240, 140);
  });
  shot(90.2, 92.0, (lt, t) => {
    const EX = 520, EY = 120, HX = 196 + eio(lt / 1.8) * 10 - z5Beat(t * 4) * 2.5, HY = 148 + z5Sh(t * 0.3, 2) * 2;
    gradient(LB, H - LB, [76, 77, 78, 79, 78]);
    spiralEye(EX, EY, 170, t, 1);
    z5Swirl(EX, EY, 1.1, 160);
    streaks(0, 60, t, 2600, 74, 70, 5211, [0, LB, W, H - 2 * LB]);
    streaks(0.08, 30, t, 2000, 20, 50, 5212, [0, LB, W, H - 2 * LB]);
    for (let k = 0; k < 7; k++) cloudPuff(frac(ih(k, 1, 5213) + t * 0.9) * 700 - 120, 40 + ih(k, 2, 5213) * 200, 8 + ih(k, 3, 5213) * 8, [17, 18, 20, 21], 5214 + k);
    // tendrils rise from the eye, feeling for the hero
    // tendrils rise from the eye, feeling for the hero: each one staggered, its tip arriving with an overshoot, its
    // middle lagging behind the tip (it bends, then straightens)
    for (let k = 0; k < 3; k++) {
      const g = lt - 1.0 - k * 0.12; if (g <= 0) continue;
      const u = z5Step(g, 7, 4), ul = z5Step(g - 0.12, 7, 4);
      z5Tendril(EX - 60, EY + (k - 1) * 70, lerp(470, 420, ul), EY + (k - 1) * 90 + Math.sin(t * 3 + k) * 30 + (1 - ul) * 40, lerp(430, 320, u) - k * 20, HY + (k - 1) * 60 + Math.sin(t * 4 + k * 2) * 6, 9, t, k * 3);
    }
    // the hero, close, is shoved by the gale (smooth buffet, not a per-frame rattle); it sets its jaw when the tendrils come
    const set = sstep(1.0, 1.4, lt);
    z5Zenith(HX + z5Sh(t * 0.6, 7) * 1.5, HY, 4.0, t, { ang: 0.32 + z5N(t * 1.5, 8) * 0.05 - set * 0.06, sw: 0.25 - set * 0.25, spread: 0.85 + 0.2 * Math.sin(t * 26), wt: t * 4, mouth: 1, orbR: 50, auraR: 12, rise: 0.2, sq: 0.1 + set * 0.06, rim: [1, -0.15, 75] });
    shk(2.5);
    z5Cam(1.04 + lt * 0.03, 0.02 * Math.sin(t * 7), 240, 135);
  });

  /* ================================================================ 9 — the last fight: tendrils against the blade (1:32–1:36) */
  // A duel in four strikes, each a different cut, each with a held wind-up, a fast stroke that lands on the beat, a
  // follow-through that carries the body on past the target, and a recovery; between them the tendrils lash back (a
  // parry, a duck under a lash). Every cut stops the clock for two frames (hit-stop), severs the tendril (the stump whips
  // back, the cut piece spins away and comes apart), and knocks the eye.
  const HITS9 = [0.8, 1.6, 2.4, 3.2], HS = 0.07, TH9 = HITS9.map((h, k) => h - k * HS);   // shot time → track time
  const T0 = TH9[0], T1 = TH9[1], T2 = TH9[2], T3 = TH9[3], S9 = 2.3, PAR9 = [0.28, 2.43];
  const HK9 = K(
    { t: 0.00, x: 86, y: 152, a: 0.08, sw: -1.0, sq: 0, reach: 0, spread: 1, flap: 0.26 },
    { t: 0.19, x: 116, y: 146, a: 0.02, sw: -1.2, e: 'o' },
    { t: 0.28, x: 124, y: 144, a: -0.1, sw: -0.2, sq: -0.06, e: EQ },                  // PARRY: the blade snapped into the lash
    { t: 0.38, x: 110, y: 150, a: -0.28, sw: -1.3, sq: 0.1, e: 'o' },                  // knocked back, the blade batted up
    { t: 0.55, x: 100, y: 157, a: -0.36, sw: -1.75, sq: 0.22, spread: 0.5, e: 'io' },   // turning away, blade drawn far back: coiled
    { t: T0 - 0.1, x: 97, y: 159, a: -0.42, sw: -1.95, sq: 0.27, spread: 0.4, flap: 0.12, e: 'o' },   // held
    { t: T0, x: 158, y: 142, a: 0.26, sw: -0.16, sq: -0.24, spread: 1.12, flap: 0.3, e: EQ },          // HIT 1: the cleave, over the top
    { t: T0 + 0.11, x: 206, y: 132, a: 0.46, sw: 1.3, sq: -0.06, e: 'o' },             // carried on through, the blade past low
    { t: T0 + 0.3, x: 222, y: 128, a: 0.12, sw: 0.8, sq: 0.04, spread: 1, flap: 0.26, e: 'io' },      // recover
    { t: 1.22, x: 250, y: 168, a: 0.5, sw: 1.7, sq: -0.12, e: 'io' },                  // dive (under the whip)
    { t: 1.33, x: 258, y: 182, a: 0.16, sw: 1.95, sq: 0.26, spread: 0.5, e: 'o' },    // ducked under the lash, coiled low
    { t: T1 - 0.1, x: 256, y: 184, a: 0.1, sw: 2.12, sq: 0.3, spread: 0.4, flap: 0.12, e: 'io' },     // held
    { t: T1, x: 296, y: 146, a: -0.26, sw: -0.34, sq: -0.3, spread: 1.15, flap: 0.3, e: EQ },          // HIT 2: the rising cut
    { t: T1 + 0.12, x: 316, y: 114, a: -0.44, sw: -1.7, sq: -0.08, e: 'o' },
    { t: T1 + 0.3, x: 320, y: 106, a: -0.2, sw: -1.45, sq: 0.03, spread: 1, flap: 0.26, e: 'io' },    // the top of the rise: a hang
    { t: 1.96, x: 296, y: 148, a: 0.36, sw: 0.6, sq: 0.1, e: 'io' },                   // drop (under the whip), turning the wrong way
    { t: 2.04, x: 290, y: 154, a: 0.64, sw: 0.95, sq: 0.27, spread: 0.5, e: 'o' },    // coiled for the spin
    { t: T2 - 0.16, x: 288, y: 155, a: 0.68, sw: 1.0, sq: 0.29, spread: 0.4, flap: 0.12, e: 'io' },   // held
    { t: T2, x: 334, y: 148, a: 0.1 - TAU, sw: 0.25, sq: -0.2, spread: 1.12, flap: 0.3, e: EQ },        // HIT 3: the spinning cut
    { t: T2 + 0.1, x: 350, y: 146, a: -0.4 - TAU, sw: 0.1, sq: -0.04, e: 'o' },         // the turn runs on past
    { t: PAR9[1] - 0.06, x: 348, y: 147, a: -0.22 - TAU, sw: -0.4, sq: 0.02, spread: 1, flap: 0.26, e: 'io' },
    { t: PAR9[1], x: 346, y: 148, a: -0.12 - TAU, sw: -1.15, sq: -0.04, e: EQ },        // PARRY: the blade up to meet a lash from above
    { t: PAR9[1] + 0.1, x: 334, y: 160, a: 0.24 - TAU, sw: -0.6, sq: 0.14, e: 'o' },   // beaten down
    { t: 2.68, x: 314, y: 158, a: 0.14 - TAU, sw: -0.12, sq: 0.3, spread: 0.5, e: 'io' },              // drawn back for the thrust
    { t: T3 - 0.08, x: 309, y: 158, a: 0.17 - TAU, sw: -0.1, sq: 0.35, spread: 0.4, flap: 0.12, e: 'o' },   // held
    { t: T3, x: 398, y: 142, a: -0.04 - TAU, sw: 0, sq: -0.36, reach: 9, spread: 1.15, flap: 0.3, e: EQ },  // HIT 4: the thrust
    { t: T3 + 0.12, x: 416, y: 140, sq: -0.08, reach: 6, e: 'o' },
    { t: T3 + 0.3, x: 408, y: 141, a: -TAU, sq: 0.04, reach: 2, spread: 1, flap: 0.26, e: 'io' },
    { t: 3.43, x: 404, y: 142, a: -0.14 - TAU, sw: -0.25, sq: 0.12, reach: 0, e: 'io' },              // the eye roars: braced
    { t: 3.72, x: 300, y: 150, a: 0.08 - TAU, sw: 0, sq: 0.14, spread: 1.1, e: 'io' });              // blown back, blade levelled
  HK9.arcs = new Map([[0.55, 8], [T0, 14], [T0 + 0.11, 6], [1.22, 12], [T1, -10], [T1 + 0.12, -6], [1.96, 18], [T2, 10], [T3, 4], [3.72, -16]]);
  // the tendrils: each a tip track (track time) from a root; kind cut (severed at hit) or parry (batted away at hit)
  const P9 = (tt) => z5Pose(HK9, tt), BP9 = (tt, f) => z5Blade(P9(tt), S9, f);
  const TD9 = (() => {
    const L = [];
    const mk = (kind, hit, f, root, rear, w, side, extra) => {
      const hp = BP9(hit, f), toB = P9(hit), dx = toB.x - hp[0], dy = toB.y - hp[1], dl = Math.hypot(dx, dy) || 1, over = kind === 'big' ? 4 : 22;
      const keys = [{ t: hit - 0.62, x: root[0], y: root[1] }, { t: hit - 0.3, x: hp[0] + rear[0], y: hp[1] + rear[1], e: 'o' }, { t: hit - 0.1, x: hp[0] + rear[0] * 1.18, y: hp[1] + rear[1] * 1.18, e: 'o' }];
      if (extra) keys.splice(1, 2, ...extra);
      keys.push({ t: hit, x: hp[0] + dx / dl * over, y: hp[1] + dy / dl * over, e: EQ });
      if (kind === 'parry') keys.push({ t: hit + 0.1, x: hp[0] + rear[0] * 0.6, y: hp[1] + rear[1] * 0.5, e: 'o' }, { t: hit + 0.7, x: root[0], y: root[1], e: 'io' });
      const p = P9(hit);
      L.push({ kind, hit, hp, root, keys, w, side, dir: kind === 'big' ? p.wa : p.wa + Math.sign(p.swv || 1) * PI / 2 });
    };
    mk('parry', PAR9[0], 0.6, [400, -40], [70, -80], 15, 1);
    mk('cut', T0, 0.7, [470, -40], [70, -90], 20, 1);
    mk('cut', T1, 0.7, [560, 210], [90, -40], 20, -1, [{ t: 1.1, x: 400, y: 128, e: 'o' }, { t: 1.3, x: 414, y: 112, e: 'o' }, { t: 1.4, x: 200, y: 146, e: EQ }, { t: 1.47, x: 186, y: 134, e: 'o' }]);
    mk('cut', T2, 0.7, [540, 320], [80, 60], 20, -1);
    mk('parry', PAR9[1], 0.6, [470, -40], [50, -90], 15, 1);
    mk('big', T3, 0.92, [640, 150], [56, -26], 32, 1);
    return L;
  })();
  // a tendril's body: a quadratic from its root, through a bend that lags the tip, to the tip, rippling (points [x, y, r, u])
  function z5TPts(bx, by, qx, qy, tx, ty, w0, t, seed) {
    const L = Math.hypot(qx - bx, qy - by) + Math.hypot(tx - qx, ty - qy), n = Math.max(16, fl(L / 2)), pts = [];
    for (let i = 0; i <= n; i++) {
      const u = i / n, a = (1 - u) * (1 - u), b = 2 * (1 - u) * u, c = u * u;
      const x = a * bx + b * qx + c * tx, y = a * by + b * qy + c * ty;
      const dx = 2 * (1 - u) * (qx - bx) + 2 * u * (tx - qx), dy = 2 * (1 - u) * (qy - by) + 2 * u * (ty - qy), dl = Math.hypot(dx, dy) || 1;
      const rip = Math.sin(u * 10 - t * 11 + seed) * 7 * u * (1 - u) * 2;
      pts.push([x - dy / dl * rip, y + dx / dl * rip, w0 * (1 - u * 0.6) + 0.8, u]);
    }
    return pts;
  }
  function z5TDraw(pts, claw, raw, dis) {
    const keep = (k) => !dis || ih(k, fl(T_NOW * 30), 5407) > dis;
    // a magenta skin round violet flesh, lit from above (a pale sheen along the top), with burning pores
    for (let k = 0; k < pts.length; k++) if (keep(k)) discF(pts[k][0], pts[k][1], pts[k][2] + 1.5, 73);
    for (let k = 0; k < pts.length; k++) if (keep(k)) discF(pts[k][0], pts[k][1], pts[k][2], 78);
    for (let k = 0; k < pts.length; k++) { const [x, y, r] = pts[k]; if (keep(k) && r > 2) discF(x - r * 0.15, y - r * 0.28, r * 0.62, 80); }
    for (let k = 0; k < pts.length; k++) { const [x, y, r, u] = pts[k]; if (!keep(k)) continue; if (r > 2.5) discF(x - r * 0.2, y - r * 0.5, r * 0.22, 71); if (fl(u * 40) % 6 === 0 && r > 3) { discF(x + r * 0.2, y + r * 0.1, Math.min(2.5, r * 0.3), 74); P(x + r * 0.2, y + r * 0.1, 75); } }
    const n = pts.length;
    if (claw && n > 3) { const [ax, ay] = pts[n - 4], [bx2, by2, br] = pts[n - 1], a = Math.atan2(by2 - ay, bx2 - ax), L2 = br * 3.2 + 3, w = br * 1.1 + 1;
      z5Tri(bx2 - Math.sin(a) * w - Math.cos(a) * 2, by2 + Math.cos(a) * w - Math.sin(a) * 2, bx2 + Math.sin(a) * w - Math.cos(a) * 2, by2 - Math.cos(a) * w - Math.sin(a) * 2, bx2 + Math.cos(a) * L2, by2 + Math.sin(a) * L2, 67);
      z5Tri(bx2 - Math.sin(a) * w * 0.6, by2 + Math.cos(a) * w * 0.6, bx2 + Math.sin(a) * w * 0.3, by2 - Math.cos(a) * w * 0.3, bx2 + Math.cos(a) * L2 * 0.85, by2 + Math.sin(a) * L2 * 0.85, 65);
      lineP(bx2 - Math.sin(a) * w * 0.5, by2 + Math.cos(a) * w * 0.5, bx2 + Math.cos(a) * L2 * 0.8, by2 + Math.sin(a) * L2 * 0.8, 64); }
    if (raw && n) { const [x, y, r] = pts[n - 1]; discF(x, y, r * 1.1, 74); discF(x, y, r * 0.6, 75); P(x, y, 22); }
  }
  // the bend of a tendril: the midpoint of root and where its tip was a beat ago, bowed out to one side
  function z5TBend(d, tt) {
    const lag = z5Trk(d.keys, tt - 0.1), tp = z5Trk(d.keys, tt), mx = (d.root[0] + lag.x) / 2, my = (d.root[1] + lag.y) / 2, dx = tp.x - d.root[0], dy = tp.y - d.root[1], L = Math.hypot(dx, dy) || 1;
    return [mx - dy / L * 36 * d.side, my + dx / L * 36 * d.side, tp.x, tp.y];
  }
  const z5Sh9 = (pts, ox) => (ox ? pts.map((q) => [q[0] + ox, q[1], q[2], q[3]]) : pts);
  function z5Tend9(d, tt, tw, ox) {
    const t0 = d.keys[0].t, g = tt - d.hit;
    if (tt < t0) return;
    if (d.kind === 'parry' || g < 0) {
      if (g > 0.75) return;
      const [qx, qy, tx, ty] = z5TBend(d, tt), grow = eoc(clamp((tt - t0) / 0.25, 0, 1)), sh = d.kind === 'parry' && g > 0 ? 1 - clamp((g - 0.35) / 0.4, 0, 1) : 1;
      z5TDraw(z5TPts(d.root[0] + ox, d.root[1], qx + ox, qy, tx + ox, ty, d.w * grow * (0.4 + 0.6 * sh), tw, d.hit * 7), true);
      return;
    }
    // severed: the curve as it was at the cut, the cut where it passed the blade
    if (!d.at) { const [qx, qy, tx, ty] = z5TBend(d, d.hit); d.at = { q: [qx, qy], pts: z5TPts(d.root[0], d.root[1], qx, qy, tx, ty, d.w, d.hit + 92 + d.hit * 0.0, d.hit * 7) }; let bi = 0, bd = 1e9; d.at.pts.forEach((p, k) => { const e = Math.hypot(p[0] - d.hp[0], p[1] - d.hp[1]); if (e < bd) { bd = e; bi = k; } }); d.at.ci = Math.max(4, bi); }
    const A = d.at, ci = A.ci, cut = A.pts[ci];
    // the stump whips back past where it reared from, then sinks away into the dark
    const rc = z5Step(g, 9, 3.2), back = eio(clamp((g - 0.45) / 0.7, 0, 1)), rear = [d.root[0] + (cut[0] - d.root[0]) * 0.55, d.root[1] + (cut[1] - d.root[1]) * 0.55 - 30];
    const sx = lerp(lerp(cut[0], rear[0], rc * 0.8), d.root[0], back), sy = lerp(lerp(cut[1], rear[1], rc * 0.8), d.root[1], back);
    const qx = lerp(A.q[0], (d.root[0] + sx) / 2, rc), qy = lerp(A.q[1], (d.root[1] + sy) / 2 + 20 * d.side, rc);
    const wS = d.w;
    if (back < 1) {
      if (d.kind === 'big') {
        // the thrust splits it down its length: two halves peel apart
        for (const s of [-1, 1]) z5TDraw(z5TPts(d.root[0] + ox, d.root[1] + s * 6, qx + ox, qy + s * 14, sx + 10 + ox, sy + s * (10 + rc * 70), wS * 0.55, tw, d.hit * 7 + s), false, true);
      } else z5TDraw(z5TPts(d.root[0] + ox, d.root[1], qx + ox, qy, sx + ox, sy, wS, tw, d.hit * 7).slice(0, -1), false, true);
    }
    // the cut piece flies on along the stroke, spinning, and comes apart
    if (g < 0.9) {
      const piece = A.pts.slice(ci), c = piece[fl(piece.length / 2)], spin = (d.side > 0 ? 1 : -1) * 7 * g, cs = Math.cos(spin), sn = Math.sin(spin);
      const vx = Math.cos(d.dir) * 190, vy = Math.sin(d.dir) * 190 - 40, shrink = Math.max(0, 1 - g / 0.95);
      const moved = piece.map(([x, y, r, u]) => { const dx = x - c[0], dy = y - c[1]; return [c[0] + dx * cs - dy * sn + vx * g + ox, c[1] + dx * sn + dy * cs + vy * g + 220 * g * g, r * shrink, u]; });
      if (d.kind === 'big') for (const s of [-1, 1]) z5TDraw(moved.map(([x, y, r, u]) => [x, y + s * (4 + g * 90), r * 0.6, u]), true, false, g * 1.1);
      else z5TDraw(moved, true, false, g * 1.1);
      if (g < 0.4) discF(moved[0][0], moved[0][1], moved[0][2] * 0.8, 74);
    }
  }
  // the near layer: dark wreckage sweeping past the lens (parallax), and the far one: nebula banks drifting toward the eye
  function z5Fog9(t, ox) {
    for (let y = LB; y < H - LB; y++) {
      const band = Math.sin(y * 0.045 + 1.3) * 0.5 + 0.5; if (band < 0.35) continue;
      for (let x = 0; x < W; x++) { const n = vn(x + ox + t * 20, y * 2.2, 26, 5409); if (n * band > 0.42 && bay(x, y) < (n * band - 0.42) * 4) BUF[y * W + x] = n * band > 0.55 ? 62 : 80; }
    }
  }
  shot(92.0, 96.0, (lt, t) => {
    lt += 1e-6;                                            // (so a hit that lands on a frame is on it, not a hair after)
    const [tt, frz] = stopClock(lt, TH9, HS);
    FRZ = frz ? 2 : 0;
    const tw = frz ? T_NOW - (lt - tt) : t;                // world clock, also held during the hit-stop
    // the camera rides with the hero (a beat late): the world scrolls under it, far layers less (parallax)
    const lag = z5Trk(HK9, Math.max(0, tt - 0.12)), pan = lag.x - 205, OX = -pan, par = pan;
    // every cut lands on the whole thing: the eye is knocked back and the waiting tendrils flinch, then ring out; at the end
    // it flares and roars
    const kn = z5Knocks(lt, HITS9, 1, 13, 5), roar = sstep(3.3, 3.5, lt) * (1 - sstep(3.85, 4.0, lt));
    gradient(LB, H - LB, [76, 77, 78, 79, 80, 62]); stars(tw * 0.3, H, 70, 5221);
    z5Fog9(tw, par * 0.4);
    const EXe = 430 - par * 0.25 + kn * 5, EYe = 66 - kn * 3;
    glow(EXe, EYe, 120 + roar * 60, T_MAG, 0.3 + roar * 0.3);
    spiralEye(EXe, EYe, 54 - kn * 3 + roar * 6, tw * (1 + roar * 2), 1);
    pulledClouds(EXe, EYe, tw, 260, 5222);
    glow(30 - par * 0.2, 220, 180, T_WARM, 0.22);
    // embers in depth: far ones small and slow, near ones streaking (all pulled toward the eye)
    for (let k = 0; k < 46; k++) { const z = ih(k, 1, 5402), u = frac(ih(k, 2, 5402) + tw * (0.15 + z * 0.4)), sx = ih(k, 3, 5402) * 560 - 40 - par * z * 0.6, sy = LB + ih(k, 4, 5402) * 220; const x = lerp(sx, EXe, u * u * 0.8), y = lerp(sy, EYe, u * u * 0.8); if (z > 0.75) lineP(x, y, x - (EXe - sx) * 0.03, y - (EYe - sy) * 0.03, PRISM[k % 7]); else P(x, y, z > 0.4 ? 75 : 73); }
    // more of them, writhing behind, waiting (a slow wave runs down each; they recoil with every cut)
    for (let k = 0; k < 3; k++) { const mo = -par * 0.5; z5TDraw(z5TPts(EXe, EYe, 380 - k * 30 + kn * 10 + mo, 170 + k * 30 + Math.sin(tw * 2 + k) * 20, 330 - k * 50 + Math.sin(tw * 1.3 + k) * 30 + kn * (16 + k * 6) + mo, 236 - k * 16 - kn * 8, 7, tw, 20 + k * 5), true); }
    TD9.forEach((d) => z5Tend9(d, tt, tw, OX));
    const hero = z5Fight(HK9, tt, { S: S9, orbR: 26, auraR: 6, flap: 1.6, rim: [0.8, -0.6, 75], ox: OX });
    // the contact: sparks on the beat; the parries spark smaller
    TD9.forEach((d, k) => { const g = d.kind === 'parry' ? tt - d.hit : lt - HITS9[TH9.indexOf(d.hit)]; if (d.kind === 'parry') z5Hit(d.hp[0] + OX, d.hp[1], g, 0.8, d.dir + PI, 22, 5410 + k); else { z5Hit(d.hp[0] + OX, d.hp[1], g, d.kind === 'big' ? 1.4 : 1, d.dir, PRISM[(k * 2) % 7], 5410 + k); if (g >= 0 && g < 0.02) impactFrame(d.hp[0] + OX, d.hp[1], k & 1); } });
    if (roar > 0) { const g = lt - 3.3; shockRing(EXe, EYe, 30 + g * 500, 30 + g * 420, 3, [75, 73, 71], 1 - g / 0.6); shk(3 * roar); }
    // the near layer: wreckage of cloud and void sweeping past the lens, in the corners, never across the cut
    for (let k = 0; k < 3; k++) { const u = frac(lt * 0.42 + k * 0.33), x = lerp(620, -180, u) - par * 0.6, y = k === 1 ? 236 : 34 + k * 4; cloudPuff(x, y, 34 + k * 6, [76, 77, 78, 79], 5420 + k); }
    // the camera: a new angle after each whip; it trails the hero a beat late, and every hit kicks it (a quick push in,
    // a jolt along the cut) that rings out
    const seg = lt < 1.2 ? 0 : lt < 2.0 ? 1 : lt < 2.8 ? 2 : 3, Z = [1.12, 1.2, 1.1, 1.06][seg], R = [-0.05, 0.07, -0.08, 0.03][seg];
    let kick = 0, jx = 0, jy = 0;
    TD9.forEach((d) => { if (d.kind === 'parry') return; const h = HITS9[TH9.indexOf(d.hit)], g = lt - h, e = g > 0 ? Math.exp(-g * 9) : 0, kk = z5Knock(g, 1, 16, 7); kick += 0.12 * e; jx += kk * Math.cos(d.dir) * 6; jy += kk * Math.sin(d.dir) * 6; });
    const z = (seg === 3 ? lerp(1.12, 0.98, eio(lin(3.3, 4.0, lt))) : Z) + kick;
    z5Cam(z, R + kick * 0.3 + 0.006 * z5N(t, 2), 236 + jx, lerp(lag.y, 135, 0.4) + jy, 240, 135);
  });
  WHIPS.push([93.2, 0], [94.0, PI], [94.8, 0.4]);

  /* ================================================================ 10 — the beam clash (1:36–1:40.5) */
  // The meeting point is a contest in heaves: a pulse runs down one beam, lands, and that side drives the point a step;
  // the other digs in and answers. The void wins the first exchanges (the hero is shoved back across the sky, crouched
  // behind its blade); then the hero's surges carry it all the way to the colossus, and the hero follows its own light
  // in, rises over the eye with the blade drawn back over its head, holds — and brings it down into the cut.
  const CX10 = K({ t: 0, x: 262 }, { t: 0.2, x: 262 }, { t: 0.45, x: 272, e: 'io' }, { t: 0.72, x: 208, e: 'io' }, { t: 0.95, x: 218, e: 'o' },
    { t: 1.22, x: 240, e: 'io' }, { t: 1.48, x: 180, e: 'io' }, { t: 1.7, x: 172, e: 'o' }, { t: 2.5, x: 164, e: 'io' }, { t: 2.66, x: 206, e: 'o' },
    { t: 2.86, x: 198, e: 'io' }, { t: 3.08, x: 258, e: 'o' }, { t: 3.27, x: 250, e: 'io' }, { t: 3.5, x: 324, e: 'o' }, { t: 3.7, x: 318, e: 'io' }, { t: 3.92, x: 392, e: 'i' });
  const VP10 = [0.45, 1.22], HP10 = [0.95, 2.5, 2.86, 3.27, 3.7], BR10 = 3.92, WU10 = 4.14, SW10 = 4.43;
  const cx10 = (lt) => z5Trk(CX10, lt).x + z5Sh(lt * 0.4, 3) * 1.5 * sstep(0.2, 0.5, lt);
  // the colossus is shoved back as the meeting point nears it, and rears when the light reaches its eye
  const back10 = (lt) => Math.max(0, cx10(Math.min(lt, BR10)) - 290) * 0.22 + (lt > BR10 ? 8 * z5Step(lt - BR10, 9, 4) : 0);
  const eye10 = (lt, t) => { const b = back10(lt); return [404 + b + z5Sh(t * 0.5, 5) * (1 + b * 0.08), 108 - b * 0.3 + z5Sh(t * 0.4, 6) * 0.8]; };
  // a heave's pulse: g from launch (0) to landing (1)
  const pulse10 = (lt, list, d) => list.map((h) => (lt - (h - d)) / d);
  // the hero, tied to the contest: shoved back and crouched when it loses ground, leaning in and stretched when it gains
  function hero10(lt) {
    const t = 96 + lt, lc = Math.min(lt, BR10), c = cx10(lc), dc = (c - cx10(lc - 0.12)) / 0.12, lose = clamp(-dc / 240, 0, 1), gain = clamp(dc / 240, 0, 1);
    const hx = (cc) => 98 - Math.max(0, 224 - cc) * 0.6;
    const p = { S: 2.2, x: hx(c) + gain * 6 + z5Sh(t * 0.5, 7) * 1.2, y: 138 + lose * 3 + z5Sh(t * 0.45, 8) * 1.0,
      a: 0.04 + gain * 0.16 - lose * 0.24 + z5Sh(t * 0.3, 9) * 0.02, sw: -0.04 - lose * 0.3 + gain * 0.05, sq: 0.14 + lose * 0.2 - gain * 0.24, reach: 2 + gain * 3,
      spread: 1 + gain * 0.18 - lose * 0.14, flap: 0.2 + gain * 0.2, mouth: lt > 2.45 ? 2 : lose > 0.3 ? 1 : 0 };
    if (lt >= BR10) {
      // the breakthrough: in along its own beam on a rising arc, to above the eye
      const [ex, ey] = eye10(lt, t), u = eic(lin(BR10, WU10, lt)), x0 = hx(cx10(BR10));
      p.x = lerp(x0, ex - 86, u); p.y = lerp(138, ey + 6, u) - Math.sin(u * PI) * 30; p.a = lerp(0.1, -0.12, u); p.sw = lerp(-0.04, -0.5, u); p.sq = -0.2 * Math.sin(u * PI); p.reach = 0; p.spread = 1.1; p.mouth = 2;
      // the wind-up: the body arches back and the blade goes up over its head and behind; held, trembling
      const v = eoc(lin(WU10, WU10 + 0.13, lt)), hold = sstep(WU10 + 0.1, WU10 + 0.16, lt);
      if (lt >= WU10) { p.x -= 6 * v; p.y -= 4 * v; p.a = -0.12 - 0.28 * v + z5Sh(t * 0.6, 10) * 0.025 * hold; p.sw = lerp(-0.5, -1.9, v); p.sq = 0.28 * v; p.spread = 1.1 - 0.5 * v; p.flap = 0.08; }
      // and the stroke: two frames, landing on the cut
      const w = EQ(lin(SW10, 4.5, lt));
      if (lt >= SW10) { p.sw = lerp(-1.9, -0.25, w); p.a = lerp(-0.4, 0.28, w); p.sq = lerp(0.28, -0.25, w); p.x += 22 * w; p.y += 12 * w; p.spread = 1.3; p.flap = 0.3; }
    }
    return p;
  }
  // sparks thrown off the meeting point, up and down, carried toward the side that is giving way
  function sparks10(cx, cy, t, push, n) {
    for (let k = 0; k < n; k++) {
      const life = frac(ih(k, 1, 5432) + t * (1.8 + ih(k, 4, 5432))), up = k & 1 ? -1 : 1, a = up * (PI / 2 - 0.2 - ih(k, 2, 5432) * 1.0) * (ih(k, 5, 5432) < 0.5 ? 1 : -1) + (ih(k, 5, 5432) < 0.5 ? 0 : PI), v = 50 + ih(k, 3, 5432) * 150;
      const px = cx + Math.cos(a) * v * life + push * 90 * life, py = cy + Math.sin(a) * v * life + 110 * life * life;
      if (bay(fl(px), fl(py)) > 1.1 - life) continue;
      lineP(px, py, px - Math.cos(a) * 4 - push * 3, py - Math.sin(a) * 4, k % 3 === 0 ? 22 : px < cx ? 59 : 74);
    }
  }
  function clashWide(lt, t) {
    const cx = cx10(Math.min(lt, BR10)), cy = 132, grow = eoc(lin(0, 0.2, lt)), brk = lt >= BR10 ? lt - BR10 : -1;
    const dc = (cx - cx10(Math.max(0, Math.min(lt, BR10) - 0.1))) / 0.1, push = clamp(dc / 300, -1, 1);
    const surge = HP10.reduce((m, h) => Math.max(m, lt > h ? Math.exp(-(lt - h) * 5) : 0), 0);
    z5Dawn(t, 196, t * 30, 40, 200);
    // the sky splits at the meeting point: dawn on the hero's side, the void on its side, a prism seam between; when the
    // light breaks through, the dawn floods the rest of the sky
    const seam = brk < 0 ? cx : lerp(cx, 560, eoc(clamp(brk / 0.45, 0, 1)));
    for (let y = LB; y < H - LB; y++) {
      const sx = seam + Math.sin(y * 0.07 + t * 5) * 7;
      for (let x = Math.max(0, fl(sx)); x < W; x++) {
        const i = y * W + x;
        if (x < sx + 2) { BUF[i] = 22; continue; }
        if (x < sx + 5) { BUF[i] = PRISM[(fl(y / 3 + t * 12)) % 7]; continue; }
        BUF[i] = y < 196 ? VOIDSKY[clamp(fl((y - LB) / 34 + bay(x, y) * 0.9), 0, 4)] : T_NIGHT[5][GREYM[BUF[i]]];
      }
    }
    stars(t, 190, 30, 5231);
    // light spilled on the cloud tops under the meeting point: gold on the hero's side, magenta on the other
    if (brk < 0.3) { glow(cx - 34, 204, 80, T_GOLD, 0.5 * grow); glow(cx + 34, 204, 80, T_MAG, 0.5 * grow); }
    const [BX, BY] = eye10(lt, t), b = back10(lt), rear = brk > 0 ? z5Knock(brk, 1, 9, 3.5) : 0;
    unmaker(BX, BY, 2.0, t, { eyes: 2, broken: 1.25 + b * 0.004, halo: 1, heart: 1, nod: -rear * 4, tilt: rear * 0.12, shake: 0.5 + rear * 1.5,
      arms: [[-50, 30, -88 + b * 0.8 - rear * 10, 40 - b * 0.6 - rear * 50, 1], [50, 30, 70 + b + rear * 10, 60 - b * 0.5 - rear * 40, 0.5 + rear * 0.5]] });
    // the void beam: a dark pulse runs down it before each of its heaves; driven back into the eye at the end
    const ve = [BX - 6, BY - 4], vl = Math.hypot(cx - ve[0], cy - ve[1]), vg = pulse10(lt, VP10, 0.28);
    const vw = (s) => { let k = 1; for (const g of vg) if (g > 0 && g < 1.2) k += 0.9 * Math.exp(-(((s - g * vl) / 16) ** 2)); return k; };
    const vend = brk < 0 ? lerp(0, 1, grow) : 1 - eoc(clamp(brk / 0.1, 0, 1));
    if (vend > 0.02) z5Beam(ve[0], ve[1], lerp(ve[0], cx, vend), lerp(ve[1], cy, vend), 10 - Math.max(0, brk) * 40, voidCol(t), t, 1, vw);
    const hero = z5Fight(hero10, lt, { S: 2.2, orbR: 26, auraR: 7 + surge * 10, rim: [1, -0.25, 75], flap: 2 });
    const tip = hero.tip, hl = Math.hypot(cx - tip[0], cy - tip[1]), hg = pulse10(lt, HP10, 0.22);
    const hw = (s) => { let k = 1; for (const g of hg) if (g > 0 && g < 1.2) k += 0.8 * Math.exp(-(((s - g * hl) / 14) ** 2)); return k; };
    // the prism beam, swelling on each surge; at the breakthrough it reaches the eye, then the hero is the light
    const pend = brk < 0 ? grow : 1, pfade = brk < 0 ? 1 : 1 - lin(0.08, 0.2, brk);
    if (pfade > 0.02) { const tx = brk < 0 ? cx : lerp(cx, BX, eoc(clamp(brk / 0.06, 0, 1))), ty = brk < 0 ? cy : lerp(cy, BY - 4, eoc(clamp(brk / 0.06, 0, 1))); z5Beam(tip[0] - 4, tip[1], lerp(tip[0], tx, pend), lerp(tip[1], ty, pend), (10 + surge * 6 + (lt > 2.5 ? 3 : 0)) * pfade, prismCol(t), t, 2, hw); }
    for (const g of hg) if (g > 1 && g < 1.5) shockRing(cx, cy, 6 + (g - 1) * 160, 6 + (g - 1) * 160, 3, [22, 60, 83], 1 - (g - 1) / 0.5);
    for (const g of vg) if (g > 1 && g < 1.5) shockRing(cx, cy, 6 + (g - 1) * 160, 6 + (g - 1) * 160, 3, [75, 73, 71], 1 - (g - 1) / 0.5);
    if (brk < 0 && lt > 0.17) {
      // the meeting point: a knot of both lights, boiling, throwing sparks and arcs
      const R = 16 + Math.sin(t * 30) * 2 + surge * 6 + Math.min(lt, 3) * 2;
      glow(cx, cy, R * 2.6, T_WH, 0.5);
      for (let y = fl(cy - R); y <= cy + R; y++) for (let x = fl(cx - R); x <= cx + R; x++) { const d = Math.hypot(x - cx, y - cy) / R + (vn(x, y, 3, fl(t * 20)) - 0.5) * 0.4; if (d < 1) P(x, y, d < 0.45 ? 22 : x < cx + push * R * 0.5 ? PRISM[fl(d * 9 + t * 20) % 7] : 74); }
      sparks10(cx, cy, t, push, 40);
      for (let k = 0; k < 4; k++) if (ih(k, fl(t * 15), 5233) < 0.6) { const a = ih(k, fl(t * 15) + 1, 5233) * TAU; bolt(cx, cy, cx + Math.cos(a) * 70, cy + Math.sin(a) * 50, fl(t * 15) + k * 5, 1, 22, k & 1 ? 74 : 83); }
      if (lt < 0.27) { const g = lt - 0.2; if (g > 0) { burst(cx, cy, g / 0.2, 70, 12, 0.4, [22, 60], 2); shk(4); } }
    }
    if (brk >= 0 && brk < 0.4) { z5Hit(BX, BY - 4, brk, 1.2, 0, 60, 5435); glow(BX, BY, 90 * (1 - brk / 0.4), T_WH, 0.6); }
    // the hero's dash leaves a wake of light along the beam's path
    if (brk > 0 && lt < WU10 + 0.05) streaks(-0.25, 30, t, 2400, 60, 60, 5436, [0, 60, W, 120]);
    // the wind-up, held: light gathers to the raised blade
    if (lt >= WU10 && lt < SW10) { const v = lin(WU10, SW10, lt); for (let k = 0; k < 18; k++) { const u = frac(ih(k, 1, 5437) + t * 2.5), a = ih(k, 2, 5437) * TAU, r = (1 - u) * 70 + 4; P(hero.tip[0] + Math.cos(a) * r, hero.tip[1] + Math.sin(a) * r, u > 0.6 ? 22 : 60); } glow(hero.tip[0], hero.tip[1], 30 + v * 20, T_WH, 0.5); }
    shk(1.5 + surge * 3 + (brk >= 0 && brk < 0.25 ? 4 : 0));
    // the camera trails the meeting point a beat late (so the shoves read), kicked by every heave that lands; at the
    // breakthrough it rushes in with the hero to the eye
    let kick = 0; for (const g of hg.concat(vg)) if (g > 1) kick += 0.035 * Math.exp(-(g - 1) * 2);
    const u = eio(lin(BR10, WU10 + 0.08, lt)), lagx = cx10(Math.max(0, Math.min(lt, BR10) - 0.15));
    z5Cam(lerp(1.05 + kick, 1.38, u) + (lt > SW10 ? 0.05 * EQ(lin(SW10, 4.5, lt)) : 0), lerp(0.006 * z5N(t, 11), -0.04, u), lerp(lerp(240, lagx, 0.3), BX - 58, u), lerp(135, BY - 14, u), 240, 135);
  }
  // the hero, close: the void beam bearing on the blade; it is driven back in two shoves, trembling, then gathers itself
  function clashClose(lt, t) {
    const u = lt - 1.7, kb = z5Step(u - 0.08, 11, 5) + z5Step(u - 0.42, 11, 5), jolt = z5Knock(u - 0.08, 1, 15, 6) + z5Knock(u - 0.42, 1, 15, 6), coil = sstep(0.5, 0.78, u);
    const HX = 172 - kb * 9 + z5Sh(t * 0.6, 12) * 1.2 - jolt * 5, HY = 152 + z5Sh(t * 0.5, 13) * 1 + coil * 3 + jolt * 2;
    gradient(LB, H - LB, [77, 78, 79, 80, 79]);
    streaks(PI, 50, t, 2400, 74, 70, 5241, [0, LB, W, H - 2 * LB]);
    const C = [HX + 252, HY - 30];
    const vw = (s) => { let k = 1; for (const h of [0.08, 0.42]) { const g = (u - h + 0.25) / 0.25; if (g > 0 && g < 1.2) k += 0.7 * Math.exp(-((((W + 20 - C[0]) * g - s) / 22) ** 2)); } return k; };
    z5Beam(W + 20, C[1] + 4, C[0], C[1], 24, voidCol(t), t, 1, vw);
    const hero = z5Zenith(HX, HY, 5.4, t, { ang: -0.06 - coil * 0.05 - jolt * 0.05 + z5Sh(t * 0.35, 14) * 0.015, sw: -0.12 - jolt * 0.12 + z5Sh(t * 0.5, 15) * 0.03, sq: 0.2 + coil * 0.14 + jolt * 0.1, spread: 0.9 + 0.1 * Math.sin(t * 30) - coil * 0.25, wt: t * 3, mouth: u > 0.55 ? 2 : 1, orbR: 66, auraR: 14 + coil * 6, sparks: 30, rim: [1, -0.2, 74] });
    // the contact, on the blade: a white knot boiling, sparks streaming back past the hero toward the lens
    const cp = [lerp(hero.hand[0], hero.tip[0], 0.82), lerp(hero.hand[1], hero.tip[1], 0.82)];
    glow(cp[0], cp[1], 90, T_WH, 0.6); discF(cp[0], cp[1], 12 + Math.sin(t * 40) * 3 + jolt * 6, 22);
    for (let k = 0; k < 44; k++) { const life = frac(ih(k, 1, 5442) + t * (2.5 + ih(k, 2, 5442))), x = cp[0] - life * 560, y = cp[1] + (ih(k, 3, 5442) - 0.5) * life * 300 + life * life * 40; if (bay(fl(x), fl(y)) > 1.2 - life) continue; lineP(x, y, x + 6 + life * 10, y, k % 3 ? (k & 1 ? 75 : 59) : 22); }
    for (let k = 0; k < 4; k++) if (ih(k, fl(t * 15), 5242) < 0.7) bolt(cp[0], cp[1], cp[0] + 40 + ih(k, 1, fl(t * 15)) * 100, cp[1] + (ih(k, 2, fl(t * 15)) - 0.5) * 140, fl(t * 15) + k, 1, 22, 74);
    glow(HX + 60, HY, 200, T_MAG, 0.2);
    shk(2.5 + jolt * 4);
    z5Cam(1 + eio(u / 0.8) * 0.12 + jolt * 0.03, -0.04 + z5Sh(t * 0.3, 16) * 0.006, HX + 70, 140, 240, 135);
  }
  shot(96.0, 100.5, (lt, t) => { if (lt < 1.7 || lt >= 2.5) clashWide(lt, t); else clashClose(lt, t); });
  CAPS.push([98.5, 100.3, 's', 'HERO', 'FOR EVERY STORY!']);

  /* ================================================================ 11 — STRIKE (1:40.5–1:44) */
  // The overhead stroke lands on the cut: one frame of ink and light, a held beat with the blade buried in the eye (hit-
  // stop), then the body is carried on down through it and out below. The cut it leaves splits the eye along the blade's
  // path, and the two halves slide apart on a seam of light.
  const S11 = 2.6, HK11 = K(
    { t: 0, x: 168, y: 122, a: 0.3, sw: 0.1, sq: -0.22, reach: 4, spread: 1.3, flap: 0.3, mouth: 2 },
    { t: 0.1, x: 226, y: 172, a: 0.6, sw: 1.4, sq: -0.08, reach: 2, e: 'o' },
    { t: 0.3, x: 300, y: 214, a: 0.42, sw: 1.65, sq: 0.06, spread: 1.1, e: 'o' },
    { t: 0.75, x: 330, y: 222, a: 0.2, sw: 1.3, sq: 0.1, spread: 1, flap: 0.2, e: 'io' });
  HK11.arcs = new Map([[0.1, -8], [0.3, -6]]);
  const HP11 = z5Blade(z5Pose(HK11, 0), S11, 0.7), CUT11 = 0.86;
  // the eye split along a line through (cx, cy) at angle a: the halves are pushed apart by open px (copied from TMP), the
  // seam between them burns; only along the length the blade has passed (from -L0 to L1 along the line)
  function z5Split(cx, cy, R, a, open, L0, L1, t) {
    TMP.set(BUF);
    const ca = Math.cos(a), sa = Math.sin(a), x0 = Math.max(0, fl(cx - R * 1.3)), x1 = Math.min(W - 1, Math.ceil(cx + R * 1.3)), y0 = Math.max(LB, fl(cy - R * 1.3)), y1 = Math.min(H - LB - 1, Math.ceil(cy + R * 1.3));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy, along = dx * ca + dy * sa, s = -dx * sa + dy * ca;
      if (along < -L0 || along > L1) continue;
      const taper = Math.min(1, (along + L0) / 30, (L1 - along) / 30), o = open * Math.max(0, taper), as = Math.abs(s);
      const i = y * W + x;
      if (as < o) { const f = as / Math.max(1, o); BUF[i] = f < 0.35 ? 22 : f < 0.7 ? (bay(x, y) < 0.5 ? 22 : 60) : 59; continue; }
      if (as < o + 1.2) { BUF[i] = 58; continue; }
      const sg = s > 0 ? 1 : -1, sx = fl(x - (-sa) * sg * o), sy = fl(y - ca * sg * o);
      if (sx >= 0 && sy >= 0 && sx < W && sy < H) BUF[i] = TMP[sy * W + sx];
    }
  }
  shot(100.5, 101.35, (lt, t) => {
    lt += 1e-6;
    const [tt, frz] = stopClock(lt, [0], 0.1); FRZ = frz ? 2.5 : 0;
    const tw = frz ? 100.5 : t - 0.1, EX = HP11[0], EY = HP11[1], R = 116;
    gradient(LB, H - LB, [80, 62, 71, 72, 73]);
    radialLines(EX, EY, 60, 70, 76, tw, 5251);
    glow(EX, EY, 200, T_MAG, 0.3);
    spiralEye(EX, EY, R, tw, 1);
    // the cut runs along the blade's path as it passes, then opens; light pours out of the seam
    const pass = eoc(clamp(tt / 0.14, 0, 1)), open = 2 + eoc(lin(0.16, 0.75, lt)) * 16;
    z5Split(EX, EY, R, CUT11, open, 30, 30 + pass * R * 1.2, tw);
    const ca = Math.cos(CUT11), sa = Math.sin(CUT11), go = lt - 0.12;
    if (go > 0) for (let k = 0; k < 9; k++) { const u = (k + 0.5) / 9, along = lerp(-20, R * 1.1, u), px = EX + ca * along, py = EY + sa * along, sd = k & 1 ? 1 : -1; z5Ray(px, py, CUT11 + sd * PI / 2 + (ih(k, 1, 5255) - 0.5) * 0.5, 40 + eoc(go / 0.5) * 220, 4 + eoc(go / 0.5) * 6, 22, PRISM[k % 7], 0.9); }
    const hero = z5Fight(HK11, tt, { S: S11, auraR: 10, rim: [0.6, 0.8, 22], flap: 2.4 });
    // the stroke's arc, still in the air as the shot opens (held through the hit-stop)
    if (tt < 0.06) z5Arc(hero.hand[0], hero.hand[1], -2.25 + 0.3, 2.25, 29 * S11 * 1.03, tt / 0.06 * 0.8);
    z5Hit(EX, EY, lt - 0.0, 1.6, CUT11, 60, 5256);
    if (lt < 0.02) impactFrame(EX, EY, 1);
    shk(5 * Math.exp(-lt * 3) + 1.5);
    // the camera: knocked on the blow, then drawn along after the body as it goes on through
    z5Cam(1.02 + 0.1 * Math.exp(-lt * 6) + 0.06 * eio(lin(0.2, 0.85, lt)), 0.05 * Math.exp(-lt * 5) + 0.01 * z5N(t, 3), lerp(EX - 16, EX + 6, eio(lin(0.1, 0.85, lt))), lerp(EY + 4, EY + 14, eio(lin(0.1, 0.85, lt))), 240, 135);
  });
  CAPS.push([100.5, 101.4, 'x', '', 'STRIKE!', 52]);
  // the colossus's face, the cut through its eye blazing open
  function cutFace(BX, BY, s, t, lt, wide) {
    const ex = BX, ey = BY - 2 * s, R = 22 * s;
    z5Split(ex, ey, R, CUT11, wide, R * 1.15, R * 1.15, t);
    glow(ex, ey, R * 2.4, T_WH, 0.45);
    for (let k = 0; k < 7; k++) { const u = (k + 0.5) / 7, along = lerp(-R, R, u), sd = k & 1 ? 1 : -1; z5Ray(ex + Math.cos(CUT11) * along, ey + Math.sin(CUT11) * along, CUT11 + sd * PI / 2 + (ih(k, 2, 5265) - 0.5) * 0.6, 60 + lt * 140, 4 + lt * 4, 22, PRISM[(k * 3) % 7], 1); }
  }
  shot(101.35, 101.85, (lt, t) => {
    const BX = 246, BY = 104 - lt * 6, s = 2.6;
    gradient(LB, H - LB, VOIDSKY); stars(t, H, 60, 5262);
    z5GodRays(BX, BY - 5, 9, t * 0.6, T_WH, 0.45 + lt * 0.3, 380);
    unmaker(BX, BY, s, t, { eyes: 2, broken: 1.25, halo: 1, heart: 1, shake: 2, nod: -3, arms: [[-50, 30, -96, -10 - lt * 40, 1], [50, 30, 96, -20 - lt * 40, 1]] });
    cutFace(BX, BY, s, t, lt, 8 + eoc(lt / 0.5) * 10);
    // the hero, gone on through and below, turning back to look; lit from behind by the cut
    const hx = 150 + eoc(lt / 0.5) * 10, hy = 196 - eoc(lt / 0.5) * 8;
    z5Zenith(hx, hy, 1.8, t, { ang: 0.25 - eoc(lt / 0.5) * 0.2, sw: 1.3 - eoc(lt / 0.5) * 0.3, spread: 1, auraR: 4, sparks: 6, rim: [0.55, -0.83, 22] });
    shk(3 * Math.exp(-lt * 4) + 1);
    z5Cam(1.06 + lt * 0.08, 0.01 * z5N(t, 4), 230, 140, 240, 135);
  });
  // the light pours out of the colossus through cracks everywhere
  const CR11 = []; for (let k = 0; k < 600 && CR11.length < 26; k++) { const lx = (ih(k, 1, 5271) - 0.5) * 120, ly = ih(k, 2, 5271) * 120 + 18; if (bodyInside(lx, ly, 0) && bodyInside(lx + 6, ly, 0) && bodyInside(lx - 6, ly, 0)) CR11.push([lx, ly, ih(k, 3, 5271) * TAU]); }
  shot(101.85, 104.0, (lt, t) => {
    // it convulses: a smooth tremor that grows, and a slow heave up as the light swells inside it
    const s = 2.1, f = fl(t * 30), BX = 240 + z5Sh(t * 0.6, 1) * (1 + lt * 2), BY = 86 - eio(lt / 2.1) * 4 + z5Sh(t * 0.5, 2) * (0.5 + lt);
    gradient(LB, H - LB, VOIDSKY); stars(t, H, 70, 5282);
    cloudBank(236, 20, 60, 5283, t * 6, [77, 78, 79, 62], false);
    unmaker(BX, BY, s, t, { eyes: 2, broken: 1.25, halo: 1 - lt * 0.3, heart: 1, shake: 2, arms: [[-50, 30, -84 + Math.sin(t * 13) * 10, -40, 1], [50, 30, 90, -30 + Math.sin(t * 11) * 10, 1]] });
    const ex = BX, ey = BY - 2 * s;
    // the cut through the eye still burning open (it widens as the light swells), and the light leaking out of it
    cutFace(BX, BY, s, t, 0.5 + lt * 0.4, 14 + lt * 6);
    for (let k = 0; k < 8; k++) z5Ray(ex, ey, k / 8 * TAU + t * 0.5, 90 + lt * 150, 4 + lt * 2.5, 22, PRISM[k % 7], 0.8);
    // then the cracks: the light finds every seam in the body, one after another
    for (let k = 0; k < CR11.length; k++) {
      const g = lt - 0.05 - k * 0.07; if (g < 0) continue;
      const [lx, ly, a] = CR11[k], cx = BX + lx * s, cy = BY + ly * s, len = 6 + eoc(g / 0.2) * 14, oa = Math.atan2(cy - ey, cx - ex) + Math.sin(k) * 0.3;
      glow(cx, cy, 18 + g * 10, T_WH, 0.45);
      z5Ray(cx, cy, oa, 30 + eoc(g / 0.6) * 200, 2.5 + g * 3, 22, k % 3 ? 60 : PRISM[k % 7], 0.85);
      bolt(cx - Math.cos(a) * len, cy - Math.sin(a) * len, cx + Math.cos(a) * len, cy + Math.sin(a) * len, k, 3, 22, 60, 0.35);
      if (g < 0.06) shk(3);
    }
    sparkle(ex, ey, 16 + Math.sin(t * 30) * 4 + lt * 10, 22, 60); discF(ex, ey, 5 + lt * 3, 22);
    // the hero below, small against all that light, hanging in the air, its edge lit by it
    z5Zenith(150 - lt * 4, 206 - eio(lt / 2.1) * 6, 1.5, t, { ang: 0.05 + Math.sin(t * 1.3) * 0.03, sw: 1.0, spread: 1, auraR: 4, sparks: 6, rim: [0.6, -0.8, 22] });
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
    // the blast lifts the hero (with the shards), and it rides it out and settles, wings beating hard then easing
    z5Zenith(CX + z5N(lt, 1) * 1.5, CY - 4 - z5Knock(lt, 6, 6, 2.6), 1.4, t, { sw: -0.6 + z5Knock(lt - 0.05, -0.4, 9, 3), spread: 1, flap: 0.24 + 0.2 * Math.exp(-lt * 2), wt: t * (1 + Math.exp(-lt * 2)), auraR: 6, sparks: 10, rim: [0.8, 0.6, 15] });
    glow(CX, CY, 90 * (1 - lt / 1.6), T_WH, 0.5);
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
    // floating in the healed sky, drifting toward the seam as it closes, turning gently to watch it
    z5Zenith(158 + eio(lt / 2.4) * 10 + z5N(lt * 0.5, 2) * 2, 120 + Math.sin(t * 1.6) * 3, 1.6, t, { ang: 0.04 * Math.sin(t * 0.9), sw: -1.0 + Math.sin(t * 1.1) * 0.06, spread: 1, orbR: 18, auraR: 5, sparks: 8, rim: [0.9, 0.45, 15] });
    z5Cam(1.06 - 0.05 * eio(lt / 2.4), 0.006 * z5N(t * 0.6, 3), 240 + z5N(t * 0.4, 4) * 3, 135, 240, 135);
  });

  /* ================================================================ 13 — after: a new dawn; then the sting (1:48–1:54) */
  const SETTLE = [1.8, 2.1, 2.4, 2.7];
  shot(108.0, 111.0, (lt, t) => {
    // the hero breathes out: the hover slackens and it sinks a little as the power leaves it; each orb that comes home
    // nudges the body (a small dip and squash)
    const calm = sstep(1.1, 1.5, lt), home = z5Knocks(lt, SETTLE, 1, 14, 6);
    const HX = 214 + z5N(lt * 0.5, 1) * 1.5, HY = 128 + Math.sin(t * 1.6) * 3 * (1 - calm * 0.5) + 4 * eio(lin(1.1, 2.0, lt)) + home * 1.5, S = 3.0;
    z5Dawn(t, 190, t * 8, 340, 182);
    z5GodRays(340, 182, 7, t * 0.15, T_WARM, 0.5, 380);
    const which = SETTLE.map((s) => lt < s);
    const orbR = 36, orbsAt = (front) => { for (let k = 0; k < 4; k++) { const st = SETTLE[k], u = eic(lin(st - 0.5, st, lt)); if (u >= 1) continue; const a = t * 2.4 + k * TAU / 4 + u * u * 4, z = Math.sin(a), R = orbR * (1 - u); if ((z > 0) !== front) continue; orbAt(HX + Math.cos(a) * R, HY + z * R * 0.4, k, 4, t); } };
    orbsAt(false);
    const bob = z5Bob(t, S, 0.14) * (1 - eoc(calm));
    if (calm < 1) z5Wings(HX, HY + bob - 6 * S, S * 0.6, t, 1 - eoc(calm), 0.14);
    const white = lt > 1.25 && lt < 1.4;
    actor(HERO({ form: calm < 0.5 ? 'zenith' : undefined, eyes: lt < 1.4 ? 'glow' : (lt > 2.2 && lt < 2.32 ? 'closed' : 'normal'), sword: -1.0, swordCols: calm < 0.5 ? z5Sw(t) : PRISM, fly: true, sq: z5Knock(lt - 1.32, 0.16, 12, 5) + home * 0.07 }), HX, HY, S, 0.03 * Math.sin(t * 0.8), false, { white, bob: calm < 1 ? bob : undefined });
    aura(t, calm < 0.5 ? ZEN_AURA : AURA_GOLD, lerp(9, 2, calm), { sparks: fl(12 * (1 - calm)) });
    orbsAt(true);
    for (let k = 0; k < 4; k++) { const g = lt - SETTLE[k]; if (g > 0 && g < 0.35) { glow(HX, HY + 4, 30, EL_T[k], 0.6 * (1 - g / 0.35)); sparkle(HX, HY + 4, 8 * (1 - g / 0.35), 22, ORB[k][2]); } }
    if (white) glow(HX, HY, 60, T_WH, 0.6);
    z5Cam(1.12 + eio(lt / 3) * 0.06, 0.005 * z5N(t * 0.6, 2), 234 + z5N(t * 0.4, 3) * 2, 128 + 3 * eio(lin(1.2, 2.3, lt)), 240, 135);
  });
  CAPS.push([109.0, 111.0, 's', 'HERO', "IT'S OVER."]);
  shot(111.0, 114.0, (lt, t) => {
    gradient(LB, 150, [6, 7, 8, 13, 14, 15]);
    glow(390, 150, 150, T_WARM, 0.55);
    cloudBank(140, 34, 70, 5321, t * 5, CLOUD_SUN, false);
    cloudBank(196, 44, 50, 5322, t * 8, [17, 18, 14, 15], false);
    // it falls on a curve (drifting sideways as it drops), lands in the cloud, sinks past its rest, bobs back up and
    // rocks there, settling, before it slowly goes under
    const LX = 236, LY = 176, fall = eic(lin(0, 0.42, lt)), gl = lt - 0.42;
    const sx = lerp(330, LX, fall) - Math.sin(PI * fall) * 30, sy = lerp(10, LY, fall) + (gl > 0 ? gl * 2.5 + z5Knock(gl, 6, 10, 3.2) : 0);
    const ang = lt < 0.42 ? 3.1 - lt * 7 : 0.16 + Math.sin(lt * 2) * 0.02 + z5Knock(gl - 0.03, -0.14, 8, 3);
    const eye = eob(lin(0.5, 0.6, lt)), look = lt > 1.3 ? Math.sin((lt - 1.3) * 2.6) * 0.9 : 0;
    if (eye > 0) glow(sx + 2, sy - 2, 56 + Math.sin(t * 4) * 6, T_MAG, 0.5 * Math.min(1, eye));
    z5MaskShard(sx, sy, 2.4, ang, eye, look, t);
    // the clouds close over its lower edge
    for (let k = 0; k < 5; k++) cloudPuff(sx - 48 + k * 24, sy + 26 + (k & 1) * 5, 13 + (k % 3) * 3, [18, 19, 15, 16], 5323 + k);
    const lg = lt - 0.42;
    if (lg > 0 && lg < 0.5) for (let k = 0; k < 16; k++) { const a = -PI * (0.05 + 0.9 * ih(k, 1, 5324)), v = 60 + ih(k, 2, 5324) * 80; rectF(sx + Math.cos(a) * lg * v, sy + 20 + Math.sin(a) * lg * v * 0.6 + lg * lg * 120, 2, 2, 16); }
    if (lt > 0.5 && lt < 0.56) mapFx(INV, 1);
    const pin = eio(lin(0.6, 2.8, lt));
    z5Cam(1 + pin * 0.7 + z5Knock(gl, 0.025, 12, 5), 0.004 * z5N(t * 0.5, 4), lerp(240, sx - 4, pin), lerp(135, LY + Math.max(0, gl) * 2.5, pin), 240, 135);
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
