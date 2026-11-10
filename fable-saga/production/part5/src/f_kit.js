  /* ================================================================ part V: the duel kit
     Two fighters of the same size, each a pure function of its key track (no stateful physics: any frame can be seeked and
     renders the same). A fighter leans and stretches along its path, its wings drag behind its motion, its blade leaves a
     crescent, it throws its own light on the world (light()), and the Hollow's inside is painted on screen after the stamp:
     a hole in the picture with stars in it. */
  const L_WH = [1, 1, 1], L_WARM = [1, 0.72, 0.4], L_GOLD = [1, 0.82, 0.38], L_MAG = [1, 0.25, 0.8], L_CRIM = [1, 0.22, 0.12], L_COLD = [0.55, 0.8, 1], L_VIO = [0.62, 0.42, 1], L_DARK = [-1, -1, -1];
  const H5NUM = Z5NUM.concat(['lk', 'glow', 'cr', 'aur', 'dim', 'wl', 'wr', 'chip', 'swl', 'ws', 'clipY']);
  // a track: K() fills fields forward; arcs: { endKeyTime: bow px }
  function TR(keys, arcs) { const k = K(...keys); if (arcs) { k.arcs = new Map(); for (const a in arcs) k.arcs.set(+a, arcs[a]); } return k; }
  function h5Trk(keys, t) {
    let k = 0; while (k < keys.length - 1 && keys[k + 1].t <= t) k++;
    const A = keys[k], B = keys[k + 1], o = Object.assign({}, A);
    if (B && t > A.t) {
      const u = (typeof B.e === 'function' ? B.e : EASE[B.e || 'io'])(clamp((t - A.t) / (B.t - A.t), 0, 1));
      for (const f of H5NUM) if (typeof A[f] === 'number' && typeof B[f] === 'number') o[f] = A[f] + (B[f] - A[f]) * u;
      const arc = keys.arcs && keys.arcs.get(B.t);
      if (arc) { const dx = B.x - A.x, dy = B.y - A.y, L = Math.hypot(dx, dy) || 1, b = Math.sin(PI * u) * arc; o.x += dy / L * b; o.y -= dx / L * b; }
    }
    return o;
  }
  function h5Pose(keys, tt) {
    const p = h5Trk(keys, tt), q = h5Trk(keys, tt - 1 / 30), r = h5Trk(keys, tt - 0.1);
    const vx = (p.x - q.x) * 30, vy = (p.y - q.y) * 30, sp = Math.hypot(vx, vy);
    p.vx = vx; p.vy = vy; p.sp = sp; p.svx = (p.x - r.x) * 10;
    p.st = p.nost ? 0 : clamp((sp - 110) / 1250, 0, 0.42); p.sd = Math.atan2(vy, vx);
    p.lean = p.nolean ? 0 : clamp(p.svx / 2600, -0.16, 0.16);
    p.ang = (p.a || 0) + p.lean;
    p.wa = (p.flip ? PI - (p.sw || 0) : (p.sw || 0)) + p.ang;
    return p;
  }
  // the hero bleeding light: sparks seeping from its cracks and falling, more the worse it is hurt
  function h5Bleed(x, y, S, t, amt, cols) {
    const n = fl(4 + 18 * amt);
    for (let k = 0; k < n; k++) {
      const age = frac(ih(k, 1, 7321) + t * (0.8 + ih(k, 2, 7321) * 0.7)), px = x + (ih(k, 3, 7321) - 0.5) * 22 * S + Math.sin(age * 6 + k) * 2, py = y + (ih(k, 4, 7321) - 0.6) * 12 * S + age * age * 40 * S * 0.3;
      if (bay(fl(px), fl(py)) > (1 - age) * (0.6 + 0.6 * amt)) continue;
      P(px, py, cols[age < 0.3 ? 2 : age < 0.6 ? 0 : 1]); if (age < 0.4 && k % 3 === 0) P(px, py - 1, cols[1]);
    }
    if (amt > 0.3) light(x, y, 20 * S, L_WARM, 0.12 * amt * (0.5 + 0.5 * Math.sin(t * 23)));
  }
  // the hit-stop clock in one call: [track time, frozen]; while frozen the picture shakes
  function h5Clock(t, hits, d, shake) { const fz = h5Frz(t, hits, d || 0.1); if (fz) shk(shake === undefined ? 2.4 : shake); return [h5Stop(t, hits, d || 0.1), fz]; }
  // a camera that frames two fighters: the midpoint of their bodies over the last 0.25 s, the zoom from how far apart they
  // are (fill: the screen px their separation plus pad should take), clamped to [zmin, zmax]. Pure function of t.
  function h5Frame(A, B, t, o) {
    o = o || {}; let sx = 0, sy = 0, sz = 0; const N = 6;
    for (let k = 0; k < N; k++) {
      const tt = t - k * 0.05, a = h5Trk(A, tt), b = h5Trk(B, tt), d = Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y) * 1.7);
      sx += (a.x + b.x) / 2; sy += (a.y + b.y) / 2; sz += clamp((o.fill || 300) / (d + (o.pad || 90)), o.zmin || 1, o.zmax || 2.2);
    }
    return { x: sx / N + (o.ox || 0), y: sy / N + (o.oy || 0), z: sz / N };
  }
  // a heavy blow: h5Heavy, plus a spray of glass (each piece carrying a view of another world) and debris thrown along dir
  function h5Blow(x, y, g, pw, dir, cols, seed, imp, keep, lcol, views) { h5Heavy(x, y, g, pw, dir, cols, seed, imp, keep, lcol); h5Spray(x, y, g, pw, dir, cols, seed, views); }
  // the spray part of h5Blow alone: refracting glass and debris thrown along dir (undefined: every way)
  function h5Spray(x, y, g, pw, dir, cols, seed, views) {
    if (g < 0 || g > 1.1) return;
    views = views || ['dawn', 'ocean', 'city', 'ink'];
    const d0 = dir === undefined ? -PI / 2 : dir, n = fl(6 + 5 * pw);
    for (let k = 0; k < n; k++) {
      const a = d0 + (ih(k, 1, seed + 17) - 0.5) * (dir === undefined ? TAU : 1.3), v = (140 + ih(k, 2, seed + 17) * 300) * Math.sqrt(pw), px = x + Math.cos(a) * v * g, py = y + Math.sin(a) * v * g + 150 * g * g, r = (3 + ih(k, 3, seed + 17) * 6) * Math.sqrt(pw) * (1 - g * 0.6);
      if (px < -30 || px > W + 30 || py < -30 || py > H + 30 || r < 1.2) continue;
      h5Shard(shardPts(px, py, r * 1.5, r, g * (5 + k) + k, 90 + k + seed % 50, 4 + (k % 3)), views[k % views.length], 60 + k * 41 % 360, 60 + k * 23 % 150, T_NOW, { seed: k, glint: k % 3 === 0 });
    }
    rocks(x, y, g, fl(8 + 6 * pw), 220 * Math.sqrt(pw), 2.4, [137, 136, 135, 22], seed + 23, 200, d0, dir === undefined ? 6.3 : 1.2);
    for (let k = 0; k < 14 * pw; k++) { const a = d0 + (ih(k, 4, seed + 17) - 0.5) * 0.9, v = 300 + ih(k, 5, seed + 17) * 400, px = x + Math.cos(a) * v * g, py = y + Math.sin(a) * v * g; if (g < 0.35 && bay(fl(px), fl(py)) < 1 - g / 0.35) lineP(px, py, px - Math.cos(a) * 10, py - Math.sin(a) * 10, k % 2 ? 22 : cols ? cols[1] : 59); }
  }
  // hit-stop that does not move the cues: the clock holds for d after each hit, then runs fast until it has caught up
  function h5Stop(t, hits, d) {
    let o = t;
    for (const h0 of hits) { const h = Array.isArray(h0) ? h0[0] : h0, dd = Array.isArray(h0) ? h0[1] : d, g = t - h; if (g > 0 && g < dd * 3) o = g < dd ? h : h + (g - dd) * 1.5; }
    return o;
  }
  const h5Frz = (t, hits, d) => { for (const h0 of hits) { const h = Array.isArray(h0) ? h0[0] : h0, dd = Array.isArray(h0) ? h0[1] : d; if (t > h && t < h + dd) return true; } return false; };
  // the view: world → screen
  const V0 = { x: 240, y: 135, z: 1 };
  const vX = (V, x) => (x - V.x) * V.z + 240, vY = (V, y) => (y - V.y) * V.z + 135;

  /* -------------------------------------------------------------- wings */
  const WSTY = {
    nova: { f: [(j, sh) => [110, 105, 109, 110, 104, 109, 105][(j + sh) % 7], () => 109, () => 108], rim: [22, 140, 22], spine: 22 },
    void: { f: [(j, sh) => ((j + sh) % 5 === 0 ? 77 : 0), () => 77, () => 78], rim: [22, 20, 74], spine: 72 },
    hollow: { f: [() => 0, () => 76, () => 77], rim: [72, 71, 102], spine: 71 },
    hvoid: { f: [() => 134, () => 134, () => 134], rim: [22, 20, 22], spine: 78, stars: true, fire: true, wide: 2.4 },
    light: { f: [(j, sh) => [140, 141, 140, 22][(j + sh) % 4], () => 140, () => 22], rim: [22, 141, 141], spine: 22 },
    night: { f: [() => 4, () => 5, () => 6], rim: [56, 56, 57], spine: 57, stars: true },
    ink: { f: [() => 64, () => 64, () => 64], rim: [0, 0, 0], spine: 0 },
    inkd: { f: [() => 0, () => 0, () => 0], rim: [64, 64, 64], spine: 64 },
  };
  function h5Kite(bx, by, a, L, w, c) { z5Kite(bx, by, a, L, w, c); }
  // one wing on screen side sd (−1 left, 1 right) hung from (x, y), the whole thing turned by rot; drag: [vx, vy] of the body
  function h5Wing(x, y, s, t, spread, amp, sd, style, rot, vx, vy, burn) {
    const W_ = WSTY[style]; if (!W_ || spread <= 0.02) return;
    const sh = fl(t * 8), cr = Math.cos(rot || 0), sr = Math.sin(rot || 0);
    const R = (px, py) => [x + px * cr - py * sr, y + px * sr + py * cr];
    const fold = clamp((vx || 0) * sd / 900, -0.25, 0.4), sweep = clamp((vy || 0) / 900, -0.45, 0.45), spr = spread * (1 - fold);
    const beat = z5Beat(t) * amp, arm = -0.78 - beat + (1 - spr) * 1.3 + sweep, ax = Math.cos(arm) * sd, ay = Math.sin(arm), Lw = 40 * s * (0.35 + 0.65 * spr);
    const RANKS = [[9, 1, 0], [8, 0.62, 1], [7, 0.36, 2]];
    for (const [N, len, rank] of RANKS) for (let j = N - 1; j >= 0; j--) {
      const u = (j + 0.6) / N, lx = ax * Lw * u, ly = ay * Lw * u - Math.sin(u * PI) * 5 * s, [bx, by] = R(lx, ly);
      const bu = z5Beat(t - 0.12 * u) * amp, fr = lerp(PI / 2 - 0.12, -0.15 - bu * 1.5 + sweep * 0.8, Math.pow(u, 1.25)) - (1 - spr) * 0.5, fa = (sd > 0 ? fr : PI - fr) + (rot || 0);
      const L = s * (15 + 30 * u) * len * (0.45 + 0.55 * spr), w = s * (4.4 - rank * 0.8) * (W_.wide || 1);
      if (burn && ih(j, rank, 7301) < burn) continue;
      h5Kite(bx - Math.cos(fa) * 1.2, by - Math.sin(fa) * 1.2, fa, L + 2.4, w + 1.1, W_.rim[rank]);
      h5Kite(bx, by, fa, L, w, W_.f[rank](j, sh));
      if (rank === 0) lineP(bx, by, bx + Math.cos(fa) * L * 0.8, by + Math.sin(fa) * L * 0.8, W_.spine);
      if (W_.fire && rank === 0) { const tx = bx + Math.cos(fa) * L, ty = by + Math.sin(fa) * L, fh = (3 + 5 * vn(j * 3, t * 6, 1, 7305)) * s; for (let q = 0; q < fh; q++) if (bay(fl(tx), fl(ty - q)) < 1 - q / fh) P(tx + Math.sin(q * 0.7 + t * 9 + j) * 0.8, ty - q, q < fh * 0.4 ? 22 : 20); }
      if (W_.stars && rank < 2) for (let q = 0; q < 2; q++) { const f = 0.25 + ih(j, q + rank * 3, 7302) * 0.6; if (frac(ih(j, q, 7303) + t * 0.7) < 0.7) P(bx + Math.cos(fa) * L * f, by + Math.sin(fa) * L * f, q ? 57 : 22); }
      if (burn && ih(j, rank, 7304) < burn * 1.6) { const tx = bx + Math.cos(fa) * L, ty = by + Math.sin(fa) * L; P(tx, ty, 105); P(tx, ty - 1 - frac(t * 5 + j) * 5, 103); }
    }
  }
  function h5Wings(x, y, s, t, spread, amp, styL, styR, rot, vx, vy, aL, aR) {
    if (styL && (aL === undefined || aL > 0.02)) h5Wing(x, y, s, t, spread * (aL === undefined ? 1 : aL), amp, -1, styL, rot, vx, vy);
    if (styR && (aR === undefined || aR > 0.02)) h5Wing(x, y, s, t, spread * (aR === undefined ? 1 : aR), amp, 1, styR, rot, vx, vy);
  }

  /* -------------------------------------------------------------- the Hollow's inside: stars where its body should be */
  let H5PX = 0, H5PY = 0;                                  // the star field slides with the camera, a little
  function h5Void(t, ink) {
    if (SMB[2] < SMB[0]) return;
    const f = fl(t * 6), ox = fl(H5PX), oy = fl(H5PY);
    for (let y = Math.max(LB, SMB[1]); y <= Math.min(H - LB - 1, SMB[3]); y++) for (let x = Math.max(0, SMB[0]); x <= Math.min(W - 1, SMB[2]); x++) {
      const i = y * W + x; if (BUF[i] !== 134 || !SMASK[i]) continue;
      if (ink) { BUF[i] = 0; continue; }
      const h = ih(x + ox, y + oy, 7001);
      if (h < 0.022) { const tw = ih(x + ox, y + oy, 7002 + f); BUF[i] = h < 0.004 ? (tw < 0.7 ? 22 : 57) : h < 0.012 ? (tw < 0.5 ? 57 : 56) : tw < 0.6 ? 75 : 72; continue; }
      const n = vn(x + ox + t * 3, y + oy, 11, 7003);
      BUF[i] = n > 0.7 ? 78 : n > 0.56 ? 77 : n < 0.25 ? 0 : 134;
    }
  }
  // the ink world: the last stamped sprite in black and paper white (the Hollow's eyes keep their colour)
  function h5InkSprite() { for (let y = Math.max(0, SMB[1]); y <= Math.min(H - 1, SMB[3]); y++) for (let x = Math.max(0, SMB[0]); x <= Math.min(W - 1, SMB[2]); x++) { const i = y * W + x; if (!SMASK[i]) continue; const c = BUF[i]; if ((c >= 72 && c <= 75) || c === 104 || c === 107 || c === 103) continue; BUF[i] = LUMP5[c] > 150 ? 64 : 0; } }
  // darken (or tint) the last stamped sprite
  function h5Tint(T, a) { if (a <= 0.01 || SMB[2] < SMB[0]) return; for (let y = Math.max(0, SMB[1]); y <= Math.min(H - 1, SMB[3]); y++) for (let x = Math.max(0, SMB[0]); x <= Math.min(W - 1, SMB[2]); x++) { const i = y * W + x; if (SMASK[i]) tintI(i, x, y, T, a); } }
  // a sprite-local point on screen
  function h5Loc(p, x, y, S, lx, ly) { if (p.flip) lx = -lx; const c = Math.cos(p.ang), s = Math.sin(p.ang); return [x + (lx * c - ly * s) * S, y + (lx * s + ly * c) * S]; }

  /* -------------------------------------------------------------- slash trails */
  function h5Arc(hx, hy, a0, d, L, fade, sm) {
    const ad = Math.min(Math.abs(d), TAU - 0.05); if (ad < 0.3 || fade >= 1) return;
    const R = L * 1.1, x0 = Math.max(0, fl(hx - R)), x1 = Math.min(W - 1, Math.ceil(hx + R)), y0 = Math.max(LB, fl(hy - R)), y1 = Math.min(H - LB - 1, Math.ceil(hy + R)), two = sm.length > 4;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const i = y * W + x; if (SMASK[i]) continue;
      const dx = x + 0.5 - hx, dy = y + 0.5 - hy, r = Math.sqrt(dx * dx + dy * dy);
      if (r > R || r < L * 0.42) continue;
      let rel = Math.atan2(dy, dx) - a0; rel = d > 0 ? ((rel % TAU) + TAU) % TAU : ((-rel % TAU) + TAU) % TAU;
      if (rel > ad) continue;
      const u = rel / ad, rin = L * (1 - 0.52 * Math.pow(u, 1.6)), rout = L * (1.02 + 0.06 * u);
      if (r < rin || r > rout) continue;
      const e = (r - rin) / (rout - rin), b = bay(x, y);
      if (b > u * 1.8 - fade * 1.9) continue;
      const o = two && e < 0.5 ? 4 : 0;
      BUF[i] = (e > 0.8 && u > 0.5) || u > 0.93 ? sm[o + 3] : u > 0.7 ? (e > 0.45 ? sm[o + 2] : sm[o + 1]) : e > 0.55 ? sm[o + 1] : sm[o];
    }
  }
  function h5Trail(keys, tt, hand, S, sm, len) {
    const N = 5, wa = []; let fl0 = null;
    for (let k = 0; k <= N; k++) { const p = h5Pose(keys, tt - k / 30); if (fl0 === null) fl0 = !!p.flip; if (!!p.flip !== fl0 || p.nosw || p.hide) { wa.push(wa.length ? wa[wa.length - 1] : p.wa); continue; } wa.push(p.wa); }
    for (let k = 1; k <= N; k++) { let d = wa[k] - wa[k - 1]; d = Math.atan2(Math.sin(d), Math.cos(d)); wa[k] = wa[k - 1] + d; }     // (unwrapped: a key may reset an angle by a whole turn)
    let m = 0, newest = -1; for (let k = 0; k < N; k++) if (Math.abs(wa[k] - wa[k + 1]) > 0.3) { m = k + 1; if (newest < 0) newest = k; }
    if (!m) return;
    h5Arc(hand[0], hand[1], wa[m], wa[0] - wa[m], (len || 29) * S * 1.03, newest / N * 0.9, sm);
  }

  /* -------------------------------------------------------------- the forms */
  const NOVA_SW = (t) => { const k = fl(t * 14) % 4; return [[108, 140, 108, 109], [140, 108, 109, 108], [108, 109, 108, 140], [109, 108, 140, 108]][k]; };
  const H5FORM = {
    plain: { ghost: [37, 35, 36], smear: [58, 59, 60, 22], eyes: 'normal', swst: 'stub', swl: 9 },
    nova: { sprite: 'nova', eyes: 'glow', wL: 'nova', wR: 'nova', fly: true, aura: [104, 110, 109, 108], auraR: 3, ghost: [22, 109, 110], smear: [110, 109, 108, 22], swc: NOVA_SW, lc: L_WARM, lr: 30, la: 0.32, rimc: 104 },
    hollow: { sprite: 'hollow', eyes: 'narrow', void: true, cold: true, ghost: [78, 72, 102], smear: [78, 0, 0, 74], eyeL: true },
    hnova: { sprite: 'hollownova', eyes: 'narrow', void: true, cold: true, wL: 'hvoid', wR: 'hvoid', ws: 1.35, fly: true, aura: [62, 20, 22, 0], auraR: 3.0, ghost: [22, 0, 78], smear: [77, 0, 20, 22], eyeL: true, lc: L_COLD, lr: 24, la: 0.3, drink: 0.3 },
    dawn: { sprite: 'dawnbreak', eyes: 'glow', void: true, wL: 'night', wR: 'light', fly: true, aura: [110, 141, 140, 22], aura2: [4, 6, 56, 57], auraR: 3, ghost: [22, 56, 141], smear: [141, 140, 22, 22, 139, 138, 138, 56], lc: L_GOLD, lr: 30, la: 0.2, ring: true },
  };
  // the sunrise ring behind Dawnbreak's head: a thin circle of first light, brightest at its top, with a few long rays
  function h5SunRing(x, y, r, t, a) {
    if (a <= 0.02) return;
    for (let q = 0; q < TAU; q += 0.5 / r) { const up = -Math.sin(q), c = up > 0.55 ? 22 : up > -0.1 ? 140 : up > -0.6 ? 141 : 110, px = x + Math.cos(q) * r, py = y + Math.sin(q) * r; if (bay(fl(px), fl(py)) > a * 1.4 + up * 0.3) continue; P(px, py, c); P(x + Math.cos(q) * (r - 1), y + Math.sin(q) * (r - 1), c); if (up > 0.2) P(x + Math.cos(q) * (r + 1), y + Math.sin(q) * (r + 1), up > 0.7 ? 140 : 141); }
    for (let k = 0; k < 12; k++) { const q = -PI / 2 + (k - 5.5) * 0.19 + Math.sin(t * 0.7 + k) * 0.02, L = r * (0.35 + 0.5 * ih(k, 1, 7401)) * a, c = Math.cos(q), s = Math.sin(q); lineF(x + c * (r + 3), y + s * (r + 3), x + c * (r + 3 + L), y + s * (r + 3 + L), (X, Y, u) => { if (bay(X, Y) < 1 - u * 0.8) P(X, Y, u < 0.4 ? 140 : 141); }); }
    light(x, y - r * 0.5, r * 3, L_GOLD, 0.35 * a);
  }
  /* a fighter. base: { form, S, rim: [lx, ly, c], ink (the ink world: line-art versions), noLight }; V the view.
     keys may set: x y a sw reach sq S spread flap flip eyes mouth form nosw hide vib run cr (cracks) dim aur (aura size ×)
     wl wr (wings: sprite-local back / sword side, 0..1) chip (mask) eyeC eyeM arm2 swl swst white alpha clipY lk (legs kicked out) */
  function h5F(keys, tt, base, V) {
    V = V || V0; base = base || {};
    const p = h5Pose(keys, tt); if (p.hide) return null;
    const form = p.form || base.form || 'plain', FM = H5FORM[form], z = V.z, S = (p.S || base.S || 2) * z, t = T_NOW, f = fl(t * 30), ink = base.ink;
    const vib = (p.vib || 0) + (base.frz || 0), jx = vib ? Math.round((ih(f, 3, 601) - 0.5) * 2 * vib) : 0, jy = vib ? Math.round((ih(f, 4, 601) - 0.5) * 2 * vib) : 0;
    const idle = 1 - clamp(p.sp / 220, 0, 1), spread = p.spread === undefined ? (FM.wL ? 1 : 0) : p.spread, winged = !!FM.wL && spread > 0.02;
    const wt = tt * 1.6, fa = p.flap === undefined ? 0.26 : p.flap, bob = (winged ? z5Bob(wt, S, fa) : Math.sin(tt * (FM.cold ? 1.4 : 2.3) + (FM.cold ? 2 : 0)) * 0.5 * S) * idle * (p.nobob ? 0 : 1);
    const x = vX(V, p.x) + jx, y = vY(V, p.y) + jy + bob, ang = p.ang, flip = !!p.flip;
    const dmg = base.dmg ? base.dmg(T_NOW) : 0;
    const gl = (p.glow === undefined ? 1 : p.glow) * (dmg > 0.35 && ih(fl(T_NOW * 30), 7, 7311) < dmg * 0.35 ? 0.35 : 1);
    if (FM.drink && !base.noLight) light(x, y, 46 * S, L_DARK, FM.drink * gl);
    if (FM.ring && !ink) h5SunRing(x - Math.sin(ang) * 3 * S, y - Math.cos(ang) * 3 * S, 15 * S * (p.ringR === undefined ? 1 : p.ringR), t, gl * (p.ring === undefined ? 1 : p.ring));
    if (winged) {
      const wl = p.wl === undefined ? 1 : p.wl, wr = p.wr === undefined ? 1 : p.wr, sL = ink ? (FM.void && form !== 'dawn' ? 'inkd' : 'ink') : FM.wL, sR = ink ? (FM.void && form !== 'dawn' ? 'inkd' : 'ink') : FM.wR;
      h5Wings(x - Math.sin(ang) * 6 * S, y - Math.cos(ang) * 6 * S, S * 0.55 * (p.ws || 1) * (base.ws || FM.ws || 1), wt, spread, fa, flip ? sR : sL, flip ? sL : sR, ang, p.vx * z, p.vy * z, flip ? wr : wl, flip ? wl : wr);
    }
    const after = [];
    if (p.sp > 280 && !p.noAfter && S < 5) for (let k = 1; k <= 3; k++) { const a = h5Trk(keys, tt - k * 0.03); after.push([vX(V, a.x), vY(V, a.y), ink ? (FM.void ? 0 : 143) : FM.ghost[k - 1], 0.62 - k * 0.14]); }
    const lvx = (p.svx * Math.cos(ang) + (p.vy || 0) * Math.sin(ang) * 0.3) * (flip ? -1 : 1), legSh = clamp(-lvx / (60 * (S / z)), -3, 3) + Math.sin(tt * 4.2) * 0.7 * idle * (FM.cold ? 0.3 : 1);
    let legs = [0, 1, 2, 3].map((k) => Math.max(0, Math.sin(tt * 6.5 + k * 1.6)) * 1.2 * idle * (FM.cold ? 0.25 : 1) + ((p.sq || 0) > 0.15 ? 1 : 0));
    if (p.run) { const s = Math.sin(tt * 30); legs = [Math.max(0, s) * 3, Math.max(0, -s) * 3, Math.max(0, -s) * 3, Math.max(0, s) * 3]; }
    if (p.lk) legs = [3 * p.lk, 2 * p.lk, 0, 0];
    if (p.legs) legs = p.legs;
    const hasSw = !p.nosw && typeof p.sw === 'number';
    const o = { who: 'hero', form: FM.sprite, eyes: p.eyes || FM.eyes, mouth: p.mouth, sword: hasSw ? p.sw : undefined, swordCols: FM.swc ? FM.swc(t) : undefined, swordSt: p.swst || FM.swst, swordLen: p.swl || FM.swl,
      sq: (p.sq || 0) + Math.sin(tt * (FM.cold ? 1.9 : 3.1)) * 0.04 * idle, reach: (p.reach || 0), legs, legSh, fly: FM.fly, cracks: Math.max(p.cr || 0, form === 'nova' ? dmg : 0), arm2: p.arm2, armA: p.arm, maskChip: p.chip, eyeC: p.eyeC, eyeM: p.eyeM, mask: p.mask };
    if (ink) { o.outline = FM.void ? 0 : 0; o.swordOut = 0; }
    const res = actor(o, x, y, S, ang, flip, { still: true, after, st: p.st, sd: p.sd, white: p.white, alpha: p.alpha, clipY: p.clipY });
    if (FM.void || form === 'dawn') h5Void(t, ink && form !== 'dawn');
    if (ink) h5InkSprite();
    if (p.dim) h5Tint(T_DARK, p.dim);
    if (base.halo !== undefined) z5Rim(0, 0, null, 0, base.halo);
    if (dmg > 0.05 && !ink) h5Bleed(x, y, S, t, dmg, form === 'nova' ? [109, 105, 22] : [107, 103, 104]);
    if (base.rim && !ink) z5Rim(base.rim[0], base.rim[1], base.rim[2] === undefined ? FM.rimc : base.rim[2], Math.max(1, S * 0.9));
    const aur = p.aur === undefined ? 1 : p.aur;
    if (FM.aura && aur > 0.02 && !ink) aura(t, FM.aura2 && flip ? FM.aura2 : FM.aura, FM.auraR * S * aur, { sparks: 10, cols2: FM.aura2 ? (flip ? FM.aura : FM.aura2) : undefined, splitX: x });
    if (ink) z5Rim(0, 0, null, 0, FM.void && form !== 'dawn' ? 64 : 0);
    else if (form === 'nova') z5Rim(0, 0, null, 0, 102);
    if (FM.lc && !base.noLight && !ink) light(x, y, FM.lr * S, FM.lc, FM.la * gl);
    const len = (p.swl || FM.swl || 30) - 1, tip = [res.hand[0] + Math.cos(p.wa) * len * S, res.hand[1] + Math.sin(p.wa) * len * S];
    if (hasSw) h5Trail(keys, tt, res.hand, S, ink ? (FM.void ? [0, 0, 0, 0] : [143, 0, 0, 0]) : FM.smear, len);
    // the Hollow's eyes leave their light behind when it moves
    if (FM.eyeL && !ink && (p.eyes || FM.eyes) !== 'closed') {
      const e0 = h5Loc(p, x, y, S, -7.5, -2), e1 = h5Loc(p, x, y, S, 7.5, -2);
      if (p.eyeM !== false) light(e0[0], e0[1], 9 * S, L_MAG, 0.5 * gl); if (p.eyeC !== false) light(e1[0], e1[1], 9 * S, L_CRIM, 0.5 * gl);
      if (p.sp > 200) for (let k = 1; k <= 4; k++) { const q = h5Pose(keys, tt - k / 30), qx = vX(V, q.x), qy = vY(V, q.y), a0 = h5Loc(q, qx, qy, S, -7.5, -2), a1 = h5Loc(q, qx, qy, S, 7.5, -2), q2 = h5Pose(keys, tt - (k - 1) / 30), rx = vX(V, q2.x), ry = vY(V, q2.y), b0 = h5Loc(q2, rx, ry, S, -7.5, -2), b1 = h5Loc(q2, rx, ry, S, 7.5, -2);
        if (Math.hypot(a0[0] - b0[0], a0[1] - b0[1]) > 90) break;
        if (p.eyeM !== false) lineF(b0[0], b0[1], a0[0], a0[1], (X, Y) => { if (!SMASK[clamp(Y, 0, H - 1) * W + clamp(X, 0, W - 1)] && bay(X, Y) < 1.1 - k * 0.24) P(X, Y, k < 2 ? 74 : 72); });
        if (p.eyeC !== false) lineF(b1[0], b1[1], a1[0], a1[1], (X, Y) => { if (!SMASK[clamp(Y, 0, H - 1) * W + clamp(X, 0, W - 1)] && bay(X, Y) < 1.1 - k * 0.24) P(X, Y, k < 2 ? 104 : 102); }); }
    }
    return { x, y, S, hand: res.hand, tip, p, wa: p.wa, form, sp: p.sp };
  }
  // ash blowing off a fighter's back: each flake leaves the body where the body was when it was shed (so the stream
  // follows the motion), and drifts on the wind (wx, wy)
  function h5Ash(keys, tt, V, n, wx, wy, cols, life) {
    V = V || V0; life = life || 0.9; cols = cols || [120, 121, 78, 72, 121, 102];
    for (let k = 0; k < n; k++) {
      const age = frac(ih(k, 1, 7501) + tt * (0.9 + ih(k, 2, 7501) * 0.5)) * life, p = h5Trk(keys, tt - age); if (p.hide) continue;
      const S = (p.S || 2) * V.z, x = vX(V, p.x) + (ih(k, 3, 7501) - 0.5) * 24 * S + wx * age + Math.sin(age * 9 + k) * 3, y = vY(V, p.y) + (ih(k, 4, 7501) - 0.6) * 16 * S + wy * age - 14 * age * age;
      if (bay(fl(x), fl(y)) > 1.15 - age / life) continue;
      const big = k % 4 === 0; rectF(x, y, big ? 2 : 1, big ? 2 : 1, cols[k % cols.length]);
    }
  }

  /* -------------------------------------------------------------- hits */
  // an impact frame that keeps a few inks (eyes, the edge of a blade): black and white and one or two colours
  function h5Impact(cx, cy, mode, keep) {
    TMP.set(BUF); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = y * W + x, c = TMP[i]; if (keep && keep.indexOf(c) >= 0) continue; const x2 = x ^ 1, y2 = y ^ 1, l = (LUMP5[c] + LUMP5[TMP[y * W + x2]] + LUMP5[TMP[y2 * W + x]] + LUMP5[TMP[y2 * W + x2]]) / 4; BUF[i] = mode ? (l > 110 ? 0 : 22) : (l > 140 ? 22 : 0); }
    for (let k = 0; k < 44; k++) { const a = ih(k, 1, 81) * TAU, r0 = 34 + ih(k, 2, 81) * 50, w = ih(k, 3, 81) < 0.3; lineF(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0, cx + Math.cos(a) * 520, cy + Math.sin(a) * 520, (x, y, u) => { P(x, y, mode ? 22 : 0); if (w && u > 0.15) P(x + 1, y, mode ? 22 : 0); }); }
    LIGHTS.length = 0; GD.bloom = 0; GD.ca = 0; GD.con = 0; GD.vig = 0; GD.flash = 0;
  }
  const LUMP5 = PAL.map((p) => p[0] * 0.3 + p[1] * 0.55 + p[2] * 0.15);
  // blade on blade: a cross of light at the contact, sparks thrown both ways across the edges, a ring, a lamp
  function h5Clash(x, y, g, pw, dir, cA, cB, seed) {
    if (g < 0 || g > 0.5) return;
    const f = g / 0.5, ca = Math.cos(dir), sa = Math.sin(dir);
    for (let k = 0; k < 26 * pw; k++) {
      const sd = k & 1 ? 1 : -1, a = dir + sd * PI / 2 + (ih(k, 1, seed) - 0.5) * 1.7, v = (90 + ih(k, 2, seed) * 300) * pw, dd = v * g * (1 - g * 0.8), px = x + Math.cos(a) * dd, py = y + Math.sin(a) * dd + 170 * g * g;
      if (bay(fl(px), fl(py)) > 1.15 - f) continue;
      const tl = 2 + v * 0.03 * (1 - f); lineP(px, py, px - Math.cos(a) * tl, py - Math.sin(a) * tl + 5 * g, k % 3 === 0 ? 22 : sd > 0 ? cA : cB);
    }
    if (g < 0.14) {
      const k = 1 - g / 0.14, L1 = 70 * pw * k, L2 = 34 * pw * k;
      thick(x - ca * L1, y - sa * L1, x + ca * L1, y + sa * L1, k > 0.5 ? 2 : 1, 22);
      thick(x + sa * L2, y - ca * L2, x - sa * L2, y + ca * L2, k > 0.6 ? 2 : 1, 22);
      discF(x, y, 2 + 5 * pw * k, 22);
    }
    if (g < 0.28) shockRing(x, y, 4 + g * 260 * pw, 3 + g * 200 * pw, 2, [22, cA, cB], 1 - g / 0.28);
    light(x, y, 90 * pw * Math.max(0, 1 - g * 3.6), L_WH, 0.7);
    if (g < 0.1) GD.ca = Math.max(GD.ca, 3 * pw * (1 - g / 0.1));
    shk(4 * pw * Math.max(0, 1 - g * 5));
  }
  // a heavy blow: rings, a burst, debris along dir, a lamp in col, fringing, shake; imp: 1 or 2 puts ONE ink frame on it
  function h5Heavy(x, y, g, pw, dir, cols, seed, imp, keep, lcol) {
    if (g < 0 || g > 1.2) return;
    cols = cols || [22, 105, 103]; seed = seed || 1161;
    if (g < 0.5) {
      shockRing(x, y, 8 + g * 420 * pw, 5 + g * 240 * pw, 2 + pw, [22, cols[1], cols[2]], 1 - g / 0.5);
      if (pw >= 2) shockRing(x, y, 4 + g * 260 * pw, 3 + g * 90 * pw, 2, [cols[1], cols[2], cols[2]], 1 - g / 0.45);
      burst(x, y, g / 0.3, 70 * pw, 14 + 4 * pw, ih(fl(x), fl(y), seed) * TAU, [cols[0], cols[1]], 3);
    }
    for (let k = 0; k < 14 + 8 * pw; k++) {
      const a = dir === undefined ? ih(k, 1, seed) * TAU : dir + (ih(k, 1, seed) - 0.5) * 1.5, v = (90 + ih(k, 2, seed) * 260) * Math.sqrt(pw), px = x + Math.cos(a) * v * g, py = y + Math.sin(a) * v * g + 120 * g * g;
      if (g < 0.6) lineP(px, py, px - Math.cos(a) * (6 + pw * 3), py - Math.sin(a) * (6 + pw * 3), g < 0.15 ? cols[0] : cols[1]);
    }
    light(x, y, 50 * pw * Math.max(0, 1 - g * 2.4), L_WH, 0.6);
    light(x, y, 110 * pw * Math.max(0, 1 - g * 1.4), lcol || L_WARM, 0.4);
    if (g < 0.14) GD.ca = Math.max(GD.ca, 2.2 * pw * (1 - g / 0.14));
    shk(4 * pw * Math.max(0, 1 - g * 2.5));
    if (imp && g < 0.03) h5Impact(x, y, imp === 2 ? 1 : 0, keep);
  }
  // a polygon, filled by scanline (even-odd); fn(x, y) → colour, or -1 to leave the pixel
  function polyF(pts, fn) {
    let y0 = 1e9, y1 = -1e9; for (const p of pts) { y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
    y0 = Math.max(LB, Math.ceil(y0)); y1 = Math.min(H - LB - 1, fl(y1));
    const xs = [];
    for (let y = y0; y <= y1; y++) {
      xs.length = 0; const py = y + 0.5;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const a = pts[i], b = pts[j]; if ((a[1] > py) !== (b[1] > py)) xs.push(a[0] + (py - a[1]) / (b[1] - a[1]) * (b[0] - a[0])); }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) { const xa = Math.max(0, Math.ceil(xs[k] - 0.5)), xb = Math.min(W - 1, fl(xs[k + 1] - 0.5)); for (let x = xa; x <= xb; x++) { const c = fn(x, y); if (c >= 0) BUF[y * W + x] = c; } }
    }
  }

  /* -------------------------------------------------------------- the sky is glass
     One fixed tiling of the frame into shards (a Voronoi of jittered points), made once. Cracks are the borders of the
     shards a blow has reached; a breach flings the shards of the old picture out from the blow, each one tumbling and
     shrinking as it goes, still carrying its piece of the world it was broken from. */
  const GN = 64, GSX = new Float32Array(GN), GSY = new Float32Array(GN), GCELL = new Uint8Array(NP), GEDGE = new Uint8Array(NP);
  (function () {
    let k = 0;
    for (let tr = 0; k < GN && tr < 6000; tr++) { const x = ih(tr, 1, 7601) * (W + 40) - 20, y = LB - 10 + ih(tr, 2, 7601) * (H - 2 * LB + 20), md = tr < 3000 ? 40 : 26; let ok = true; for (let q = 0; q < k; q++) if (Math.hypot(GSX[q] - x, GSY[q] - y) < md * (0.6 + ih(q, 3, 7601) * 0.9)) { ok = false; break; } if (ok) { GSX[k] = x; GSY[k] = y; k++; } }
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { let b = 0, bd = 1e9; for (let q = 0; q < GN; q++) { const dx = x - GSX[q], dy = y - GSY[q], d = dx * dx + dy * dy; if (d < bd) { bd = d; b = q; } } GCELL[y * W + x] = b; }
    for (let y = 0; y < H - 1; y++) for (let x = 0; x < W - 1; x++) { const i = y * W + x; if (GCELL[i] !== GCELL[i + 1] || GCELL[i] !== GCELL[i + W]) GEDGE[i] = 1; }
  })();
  // cracks spreading from blows: hits = [[x, y, radius now]...]; a shard is cracked once any blow's radius has reached it
  const GACT = new Float32Array(GN);
  function glassAct(hits) { GACT.fill(0); for (const [hx, hy, r] of hits) if (r > 0) for (let q = 0; q < GN; q++) { const d = Math.hypot(GSX[q] - hx, GSY[q] - hy); if (d < r) GACT[q] = Math.max(GACT[q], Math.min(1, (r - d) / 30)); } }
  function glassCracks(hits, c0, c1) {
    glassAct(hits);
    for (let y = LB; y < H - LB - 1; y++) for (let x = 0; x < W - 1; x++) {
      const i = y * W + x; if (!GEDGE[i]) continue;
      const a = Math.max(GACT[GCELL[i]], GACT[GCELL[i + 1]], GACT[GCELL[i + W]]); if (a <= 0 || (a < 1 && bay(x, y) > a)) continue;
      BUF[i] = c0 === undefined ? (a >= 1 && ih(x >> 3, y >> 3, 7612) < 0.45 ? 22 : 135) : c0; if (!GEDGE[i + 1] && a >= 1) BUF[i + 1] = c1 === undefined ? 137 : c1;
    }
  }
  // the view of another world behind chosen shards: pick(q) → a world buffer (or null), amt(q) 0..1 how far it has come through
  function glassWindows(pick, amt, ox, oy) {
    ox = fl(ox || 0); oy = fl(oy || 0);
    for (let y = LB; y < H - LB; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x, q = GCELL[i], a = amt(q); if (a <= 0) continue; const Wv = pick(q); if (!Wv) continue;
      if (a < 1 && bay(x, y) > a * 1.15) continue;
      BUF[i] = GEDGE[i] ? 135 : Wv[clamp(y + oy, LB, H - LB - 1) * W + clamp(x + ox, 0, W - 1)];
    }
  }
  const H5OLD = new Uint8Array(NP), H5NEW = new Uint8Array(NP);
  // a breach: drawOld() paints the picture that breaks; it is flung apart from (cx, cy), g seconds on. o: { v, dur, delay, grav, edge }
  function h5Shatter(drawOld, g, cx, cy, o) {
    o = o || {}; const dur = o.dur || 0.55, delay = o.delay === undefined ? 0.0009 : o.delay, v = o.v || 260, grav = o.grav === undefined ? 120 : o.grav;
    if (g < 0 || g > dur + delay * 560) return;
    H5NEW.set(BUF); const nl = LIGHTS.length; drawOld(); LIGHTS.length = nl; H5OLD.set(BUF); BUF.set(H5NEW);
    const U = [], OX = [], OY = [], SXc = [], SYc = [];
    for (let q = 0; q < GN; q++) {
      const dx = GSX[q] - cx, dy = GSY[q] - cy, d = Math.hypot(dx, dy) || 1, u = clamp((g - d * delay) / dur, 0, 1), e = u * (2 - u), sp = v * (0.6 + ih(q, 1, 7621) * 0.9);
      U.push(u); OX.push(dx / d * sp * e * dur + (ih(q, 2, 7621) - 0.5) * 40 * e); OY.push(dy / d * sp * e * dur + grav * u * u + (ih(q, 3, 7621) - 0.5) * 30 * e);
      const sc = 1 - 0.75 * u * u; SXc.push(sc * Math.cos(u * (2 + ih(q, 4, 7621) * 5))); SYc.push(sc * (0.6 + 0.4 * Math.cos(u * (1 + ih(q, 5, 7621) * 4))));
    }
    for (let y = LB; y < H - LB; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x, q = GCELL[i], u = U[q];
      if (u >= 1) continue;
      if (u <= 0) { BUF[i] = GEDGE[i] && g > 0 ? 22 : H5OLD[i]; continue; }
      const X = fl(GSX[q] + (x - GSX[q]) * SXc[q] + OX[q]), Y = fl(GSY[q] + (y - GSY[q]) * SYc[q] + OY[q]);
      if (X < 0 || X >= W || Y < LB || Y >= H - LB) continue;
      if (u > 0.6 && bay(X, Y) < (u - 0.6) * 2.5) continue;
      BUF[Y * W + X] = GEDGE[i] ? (SXc[q] > 0 ? 22 : 135) : SXc[q] < 0 ? T_DARK[3][H5OLD[i]] : H5OLD[i];
    }
  }
  // the worlds behind the glass, each painted once and kept (so a shard can carry a view of it)
  const WV = {};
  function wview(name) {
    if (WV[name]) return WV[name];
    const keep = BUF.slice(), nl = LIGHTS.length, gd = Object.assign({}, GD);
    BUF.fill(0); WORLDS[name](); const b = BUF.slice(); BUF.set(keep); LIGHTS.length = nl; Object.assign(GD, gd);
    return (WV[name] = b);
  }
  // a shard of sky: a sliver of glass with a piece of a world in it. pts: polygon (screen); view: world name; (ax, ay): which
  // part of that world it carries; th: its thickness (a slab seen a little from below)
  function h5Shard(pts, view, ax, ay, t, o) {
    o = o || {}; const Wv = typeof view === 'string' ? wview(view) : view, th = o.th || 0, n = pts.length;
    let cx = 0, cy = 0; for (const p of pts) { cx += p[0] / n; cy += p[1] / n; }
    if (th) polyF(pts.map((p) => [p[0] + (o.thx || 0), p[1] + th]), (x, y) => (((x + y) >> 1) & 3) === 0 ? 136 : (y & 1) ? 137 : 116);
    const sx = fl(ax - cx), sy = fl(ay - cy), dimT = o.dim || 0, ph = (o.seed || 0) * 13.7 + t * 0.35;
    polyF(pts, (x, y) => {
      const c = Wv[clamp(y + sy, LB, H - LB - 1) * W + clamp(x + sx, 0, W - 1)];
      const band = frac((x + y * 0.8) / 46 + ph); if (band < 0.035 || (band > 0.09 && band < 0.105)) return bay(x, y) < 0.6 ? 135 : c;
      return dimT && bay(x, y) < dimT ? T_DARK[4][c] : c;
    });
    // the bevel: edges facing the light (up and to the left) catch it
    for (let i = 0, j = n - 1; i < n; j = i++) {
      const a = pts[j], b = pts[i], ex = b[0] - a[0], ey = b[1] - a[1], L = Math.hypot(ex, ey) || 1; let nx = ey / L, ny = -ex / L; if ((a[0] + b[0]) / 2 * nx + (a[1] + b[1]) / 2 * ny < cx * nx + cy * ny) { nx = -nx; ny = -ny; }
      const lit = -ny * 0.8 - nx * 0.5; lineP(a[0], a[1], b[0], b[1], lit > 0.35 ? 22 : lit > -0.2 ? 135 : 137);
    }
    if (o.glint !== false) { const k = fl(t * 2.5 + (o.seed || 0)), v = pts[(k * 7 + (o.seed || 0)) % n], tw = frac(t * 2.5 + (o.seed || 0)); if (ih(k, o.seed || 0, 7631) < 0.4) sparkle(v[0], v[1], 5 * Math.sin(tw * PI), 22, 135); }
  }
  // an irregular shard outline about (cx, cy): rx, ry radii, rot, seed, n corners
  function shardPts(cx, cy, rx, ry, rot, seed, n) {
    n = n || 6; const pts = [], c = Math.cos(rot), s = Math.sin(rot);
    for (let k = 0; k < n; k++) { const a = (k + ih(k, seed, 7641) * 0.7) / n * TAU, r = 0.62 + ih(k, seed, 7642) * 0.38, px = Math.cos(a) * rx * r, py = Math.sin(a) * ry * r; pts.push([cx + px * c - py * s, cy + px * s + py * c]); }
    return pts;
  }
  // a platform shard: flat on top (from x0 to x1 at y, tilted by rot about its middle), a keel of broken glass under it
  function slabPts(x0, x1, y, rot, depth, seed) {
    const mx = (x0 + x1) / 2, hw = (x1 - x0) / 2, c = Math.cos(rot), s = Math.sin(rot), R = (px, py) => [mx + px * c - py * s, y + px * s + py * c];
    return [R(-hw, 0), R(hw, 0), R(hw * (0.72 + ih(seed, 1, 7651) * 0.2), depth * 0.45), R(hw * (0.1 + ih(seed, 2, 7651) * 0.4), depth), R(-hw * (0.3 + ih(seed, 3, 7651) * 0.4), depth * 0.7), R(-hw * 0.86, depth * 0.3)];
  }
  // ash drawn in along curved paths from the frame's edges to (tx, ty): n flakes, amt 0..1 how thick the stream is
  function ashStreams(t, tx, ty, n, amt, seed) {
    for (let k = 0; k < n; k++) {
      if (ih(k, 9, seed) > amt) continue;
      const side = k % 4, e = ih(k, 1, seed), sx = side === 0 ? -10 : side === 1 ? W + 10 : e * W, sy = side < 2 ? LB + e * (H - 2 * LB) : side === 2 ? LB - 8 : H - LB + 8;
      // flakes travel in ribbons: each belongs to one of a dozen streams and keeps near its curve
      const rb = k % 14, bend = (ih(rb, 4, seed) - 0.5) * 260, sp = 0.3 + ih(k, 2, seed) * 0.35, u0 = frac(ih(k, 3, seed) + t * sp), bx = side === 0 ? -10 : side === 1 ? W + 10 : ih(rb, 5, seed) * W, by = side < 2 ? LB + ih(rb, 6, seed) * (H - 2 * LB) : sy;
      const ax = lerp(sx, bx, 0.7), ay = lerp(sy, by, 0.7), mx = (ax + tx) / 2 + (ty - ay) / 300 * bend, my = (ay + ty) / 2 - (tx - ax) / 300 * bend - 24;
      const big = k % 3 === 0, c = k % 9 === 0 ? 72 : k % 9 === 4 ? 102 : k % 4 === 0 ? 121 : k % 4 === 1 ? 120 : 0;
      for (let q = 0; q < 7; q++) {
        const u = u0 - q * 0.009; if (u < 0) continue; const e2 = u * u * (3 - 2 * u), x = z5Bz(ax, mx, tx, e2) + Math.sin(u * 20 + k) * 4 * (1 - u), y = z5Bz(ay, my, ty, e2) + Math.cos(u * 17 + k) * 3 * (1 - u);
        if (bay(fl(x), fl(y)) > 1.25 - q * 0.17) continue;
        if (q === 0 && big) rectF(x, y, 2, 2, c); else P(x, y, q > 3 ? 120 : c);
      }
    }
  }
  const WORLDS = {};
  const clip01 = (a, b, t) => clamp((t - a) / (b - a), 0, 1);
