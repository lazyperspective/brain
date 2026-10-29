  /* ================================================================ act IV — the stranger power (58.0–104.0) · agent A
     The Sunderer turns his brother's eye on the hero and plays NOVA backwards; then he cuts the world in two, and breaks the
     hero in the chasm: the storm, the gold, the four orbs crushed one by one. On the floor of the world, the hero burns its
     own life (LAST LIGHT) and the sword grows out of the chasm through the clouds; it takes two of his arms and his face,
     and then he catches it, snaps it, and drives the hero down through the floor of the world into the dark. */
  {
    /* -------------------------------------------------------------- state and helpers (all a4…) */
    const A4W0 = [[-60, 58, 44, 112, 3.5], [70, 34, 92, 52, 4]];             // his two wounds at 58.0 (they rewind closed)
    const A4SAVE = new Uint8Array(NP);
    const A4L = PAL.map((p) => p[0] * 0.3 + p[1] * 0.55 + p[2] * 0.15);
    const WARMF = [104, 105, 106, 107, 108, 109, 110], CORONA = [103, 105, 106, 107], LASTF = [101, 103, 104, 107];
    const ORBD = [[45, 46, 47], [48, 49, 50], [51, 52, 53], [54, 55, 56]];
    if (!FONT['—']) FONT['—'] = ['.....', '.....', '.....', '#####', '.....', '.....', '.....'];
    // the camera: zoom z and roll r about world (fx, fy) at the frame centre, plus a kick (from kick())
    function a4Cam(z, r, fx, fy, k) { k = k || [0, 0, 0, 0]; z5Cam(Math.max(1, z + k[0]), r + k[1], fx - k[2], fy - k[3], 240, 135); }
    const a4Tw = (t, s) => Math.sin(t * 23 + s) * 0.5 + Math.sin(t * 37 + s * 1.7) * 0.3 + Math.sin(t * 59 + s * 2.9) * 0.2;   // a tremble

    /* the Sunderer: the engine's own (the bump-mapped body, the sculpted arms with their physics, the jointed hands); his
       physics slots restart every frame in z_frame, and keep their state across a shot as long as the shot runs on */
    function a4Sund(cx, cy, s, t, o) {
      return sunderer(cx, cy, s, t, o || {});
    }

    /* the hero's wings in the colours of a form: 'nova' (flame-light), 'zenith' (prism, the engine's), 'ghost' (a magenta trace) */
    function a4Wings(x, y, s, t, spread, flap, kind) {
      if (spread <= 0.02) return;
      if (kind === 'zenith') { z5Wings(x, y, s, t, spread, flap); return; }
      const amp = flap === undefined ? 0.24 : flap, sh = fl(t * 8), gh = kind === 'ghost', ash = kind === 'ash';
      if (!gh && !ash) glow(x, y - 8 * s, 70 * s * spread, T_NOVA, 0.35 * spread);
      for (const sd of [-1, 1]) {
        const beat = z5Beat(t) * amp, arm = -0.78 - beat + (1 - spread) * 1.3, ax = Math.cos(arm) * sd, ay = Math.sin(arm), Lw = 40 * s * (0.35 + 0.65 * spread);
        for (const [N, len, rank] of [[9, 1, 0], [8, 0.62, 1], [7, 0.36, 2]]) for (let j = N - 1; j >= 0; j--) {
          const u = (j + 0.6) / N, bx = x + ax * Lw * u, by = y + ay * Lw * u - Math.sin(u * PI) * 5 * s;
          const bu = z5Beat(t - 0.12 * u) * amp, fr = lerp(PI / 2 - 0.12, -0.15 - bu * 1.5, Math.pow(u, 1.25)) - (1 - spread) * 0.5, fa = sd > 0 ? fr : PI - fr;
          const L = s * (15 + 30 * u) * len * (0.45 + 0.55 * spread), w = s * (4.4 - rank * 0.8);
          let fill = rank === 0 ? WARMF[(j + sh) % 7] : rank === 1 ? 106 : 108, rim = rank === 0 ? 22 : 107;
          if (gh) { fill = rank === 0 ? 73 : 72; rim = 74; } else if (ash) { fill = rank === 0 ? 121 : 120; rim = 122; }
          z5Kite(bx - Math.cos(fa) * 1.2, by - Math.sin(fa) * 1.2, fa, L + 2.4, w + 1.1, rim);
          z5Kite(bx, by, fa, L, w, fill);
          if (rank === 0 && !ash) lineP(bx, by, bx + Math.cos(fa) * L * 0.8, by + Math.sin(fa) * L * 0.8, gh ? 75 : 22);
        }
      }
    }
    // a dim orb (its light going out as k → 0)
    function a4Orb(x, y, k, r, lum) {
      if (lum <= 0.02) { discF(x, y, r * 0.8, 93); return; }
      glow(x, y, r * 3.2 * lum, EL_T[k], 0.45 * lum);
      discF(x, y, r, lum > 0.4 ? ORBD[k][1] : ORBD[k][0]); discF(x - r * 0.25, y - r * 0.25, r * 0.6, lum > 0.6 ? ORBD[k][2] : ORBD[k][1]);
      if (lum > 0.5) P(x - r * 0.4, y - r * 0.4, 22);
    }
    // the dim halo of orbs round (cx, cy); which[k] 0 hides one; front: the half nearer the camera
    function a4Halo(cx, cy, R, t, r, lum, which, front) {
      for (let k = 0; k < 4; k++) {
        if (which && !which[k]) continue;
        const a = t * 1.3 + k * TAU / 4, z = Math.sin(a);
        if ((z > 0) !== front) continue;
        a4Orb(cx + Math.cos(a) * R, cy + z * R * 0.35 - 3, k, r * (0.95 + 0.12 * z), lum * (which && which[k] !== 1 ? which[k] : 1));
      }
    }
    // a ghost of the hero: the sprite of state o, stamped flat in one colour (no life, no mask)
    function a4Ghost(o, x, y, S, ang, col, alpha) { buildSprite(HERO3(o)); stamp(x, y, S, ang, false, { color: col, alpha, noMask: true }); }
    // the NOVA hero: corona, flame wings, the white-hot body; o: { sw, eyes, mouth, corona, spread, flap, blade (len), ang, form, after, cracks, legs, sq }
    function a4Nova(x, y, S, t, o) {
      const cor = o.corona === undefined ? 1 : o.corona, sp = o.spread === undefined ? 1 : o.spread;
      if (cor > 0.02) glow(x, y, 46 * S * cor, T_NOVA, 0.55 * cor);
      a4Wings(x - Math.sin(o.ang || 0) * 6 * S, y - Math.cos(o.ang || 0) * 6 * S + z5Bob(t, S, o.flap) * sp, S * 0.6, t, sp, o.flap, o.wings || 'nova');
      const a = actor(HERO3({ form: o.form || 'nova', eyes: o.eyes || 'glow', mouth: o.mouth, sword: o.sw, swordCols: o.swordCols, sq: o.sq, legs: o.legs, cracks: o.cracks }), x, y, S, o.ang || 0, false, { after: o.after, bob: o.bob });
      if (cor > 0.02) aura(t, CORONA, 4 * S * cor, { sparks: fl(16 * cor), rise: o.rise === undefined ? 1 : o.rise });
      if (o.form === 'zenith') z5Eyes();
      if (o.blade > 0) { const ba = Math.atan2(a.tip[1] - a.hand[1], a.tip[0] - a.hand[0]); a.btip = bigBlade(a.hand[0], a.hand[1], ba, o.blade, o.bw || 5, t, { form: 'nova', flare: 0.7 * cor + 0.2, surge: o.surge }); a.ba = ba; }
      return a;
    }
    // REWIND, his way: the frame torn like a tape dragged backwards: rolling bands that climb, rows torn sideways, the
    // picture slipping, magenta and cyan fringes, a wobble, scanlines, and the ◀◀ in the corner
    function a4Rewind(amt, t) {
      if (amt <= 0) return;
      TMP.set(BUF);
      const f = fl(t * 30), roll = (t * 1500) % 140, slip = ih(f >> 1, 1, 4401) < 0.22 * amt ? fl((ih(f, 2, 4401) - 0.5) * 34 * amt) : 0;
      for (let y = LB; y < H - LB; y++) {
        const bd = ((y + roll) % 140 + 140) % 140, band = bd < 8 * amt, tear = ih(y >> 2, f, 4402) < 0.07 * amt ? Math.round((ih(y >> 2, f, 4403) - 0.5) * 60 * amt) : 0;
        const wav = Math.round(Math.sin(y * 0.08 + t * 21) * 3 * amt), sy = clamp(y + slip, LB, H - LB - 1), row = sy * W, o = y * W;
        for (let x = 0; x < W; x++) {
          const sx = clamp(x - tear - wav, 0, W - 1); let c = TMP[row + sx];
          if (amt > 0.5) { const l = A4L[c], lr = A4L[TMP[row + Math.min(W - 1, sx + 2)]], ll = A4L[TMP[row + Math.max(0, sx - 2)]]; if (lr - l > 110) c = 73; else if (ll - l > 110) c = 61; }
          if (band && bay(x, y) < 0.7 * amt) c = ih(x >> 1, y + f, 4404) < 0.45 ? 22 : ih(x, y, f) < 0.5 ? 20 : 74;
          BUF[o + x] = c;
        }
        if ((y & 1) && amt > 0.1) for (let x = 0; x < W; x++) if (bay(x, y) < amt * 0.2) BUF[o + x] = T_DARK[2][BUF[o + x]];
      }
      tintAll(T_MAG, 0.12 * amt);
      if (amt > 0.3 && (f >> 3) % 2 === 0) {
        for (const ox of [0, 13]) { z5Tri(44 + ox, 38, 44 + ox, 58, 32 + ox, 48, 0); z5Tri(43 + ox, 40, 43 + ox, 56, 34 + ox, 48, 22); }
        text('REWIND', 66, 44, 22, 2, 0);
      }
    }
    // the dial of his brother's eye: a clock face of void round the hero, its hands running backwards
    function a4Dial(cx, cy, r, t, amt, ry) {
      if (amt <= 0) return;
      ry = ry || 1;
      const keep = (x, y) => bay(fl(x), fl(y)) < amt;
      ring(cx, cy, r, r * ry, 74, keep); ring(cx, cy, r + 2, (r + 2) * ry, 72, keep); ring(cx, cy, r * 0.62, r * 0.62 * ry, 73, keep);
      for (let k = 0; k < 12; k++) { const a = k / 12 * TAU - t * 0.6, c = Math.cos(a), s = Math.sin(a), l0 = k % 3 ? 0.88 : 0.78; lineF(cx + c * r * l0, cy + s * r * l0 * ry, cx + c * r, cy + s * r * ry, (x, y) => { if (keep(x, y)) P(x, y, k % 3 ? 74 : 75); }); }
      for (const [len, sp, w] of [[0.85, -9, 2], [0.55, -1.6, 3]]) { const a = t * sp, c = Math.cos(a), s = Math.sin(a); lineF(cx, cy, cx + c * r * len, cy + s * r * len * ry, (x, y, u) => { if (bay(x, y) < amt * (1 - u * 0.4)) { P(x, y, 75); if (w > 2) P(x + 1, y, 73); } }); }
    }
    // the cloud cover seen from below: a ceiling with its belly lit by the fire; holes punched in it show the dawn above
    function a4Ceil(yb, h, ox, holes, lit) {
      lit = lit === undefined ? 1 : lit;
      for (let x = 0; x < W; x++) {
        const wx = x + ox, f = fbm(wx, 0, 70, 4, 4411), bot = yb + h * f, y1 = Math.min(H - LB, Math.ceil(bot));
        for (let y = LB; y < y1; y++) {
          const dd = bot - y;
          let hole = false;
          if (holes) for (const [hx, hy, hr] of holes) { const dx = (x - hx) / hr, dy = (y - hy) / (hr * 0.3); const d = dx * dx + dy * dy; if (d < 1) { hole = true; BUF[y * W + x] = d > 0.8 ? 106 : d > 0.55 ? 15 : 16; break; } }
          if (hole) continue;
          const n = vn(wx, y, 9, 4412), m = vn(wx * 1.7, y * 2, 5, 4413), b = bay(x, y);
          let c = dd < 1.5 ? (lit > 0.5 ? 103 : 99) : dd < 4 ? (lit > 0.5 ? (b < 0.5 ? 102 : 103) : 98) : dd < 7 + 5 * m ? (lit > 0.5 && b < 0.5 ? 102 : 121) : dd < 12 + 9 * n ? (m > 0.5 ? 121 : b < 0.5 ? 120 : 121) : n > 0.6 ? 120 : 97;
          if (b < 0.14 && dd > 4) c = 120;
          BUF[y * W + x] = c;
        }
      }
    }
    // a stump of rock out of the sea: flat broken top at (x0..x1, top), jagged sides down to the water
    function a4Rock(x0, x1, top, bot, seed, lit) {
      for (let y = Math.max(LB, fl(top)); y < Math.min(H - LB, bot); y++) {
        const v = (y - top) / (bot - top), l = x0 - v * 14 - vn(y * 0.3, 1, 1, seed) * 8, r = x1 + v * 12 + vn(y * 0.3, 2, 1, seed) * 8, R = a4TexRow(seed, fl(y * 1.4));
        for (let x = Math.max(0, fl(l)); x <= Math.min(W - 1, r); x++) {
          const e = (x - l) / Math.max(1, r - l);
          BUF[y * W + x] = y - top < 1.5 ? (lit ? 123 : 122) : y - top < 3.5 ? (lit ? 122 : 121) : a4Lit(R[x], x, y, 0.15, lit ? 0.45 : 0.2, e < 0.15 ? 1 : e > 0.8 ? -2 : -1 + (v < 0.2 ? 1 : 0));
        }
      }
    }
    // a column of falling water (the sea pouring into the chasm), from y0 down to y1 at x
    function a4Falls(x, y0, y1, w, t, seed) {
      for (let y = Math.max(LB, fl(y0)); y < Math.min(H - LB, y1); y++) {
        const d = y - y0, sp = d * 0.06, wid = w + sp * 2, thin = Math.min(0.8, d / 260);
        for (let q = -sp; q < w + sp; q += 1) {
          const n = ih(fl(x + q), fl(y - t * 240) >> 2, seed), edge = Math.min(q + sp, w + sp - q) / (wid * 0.5);
          if (n < 0.3 + thin * 0.5 + (1 - Math.min(1, edge * 2)) * 0.4) continue;
          P(x + q, y, n > 0.9 ? 22 : n > 0.7 ? 119 : 118);
        }
      }
      for (let k = 0; k < w; k++) { const g = frac(ih(k, 1, seed) + t * 1.4), px = x + ih(k, 2, seed) * w + (ih(k, 3, seed) - 0.5) * 20 * g, py = y0 + 2 - Math.sin(g * PI) * 8; if (bay(fl(px), fl(py)) < 1 - g) P(px, py, 22); }
    }

    /* ============================================================== 1 · REWIND (58.0–60.0)
       His third eye opens on the hero, and NOVA plays backwards: the blade retracts, the flame wings fold, the corona is drawn
       back into the body, it flickers back through Zenith, the four orbs come out of its chest, and it is plain coral again,
       standing on a stump of rock. His wounds close the same way. Everything is torn like a tape dragged backwards. */
    const A4RW = (t) => { const p = eio(lin(58.14, 59.72, t)), st = frac(t * 6.3); return clamp(p - (st < 0.2 ? 0.07 * Math.sin(st / 0.2 * PI) : 0), 0, 1); };
    const a4Seg = (u, a, b) => sstep(a, b, u);
    function a4NovaState(u) {
      return {
        blade: u > 0.62 ? lerp(66, 430, eic((u - 0.62) / 0.38)) : 0,
        spread: a4Seg(u, 0.3, 0.74), corona: a4Seg(u, 0.24, 0.68),
        form: u > 0.5 ? 'nova' : u > 0.31 ? 'zenith' : undefined,
        x: lerp(116, 134, a4Seg(u, 0.1, 0.9)), y: lerp(183, 163, a4Seg(u, 0.12, 0.6)),
        sw: lerp(0.55, -0.42, a4Seg(u, 0.05, 0.85)), orbs: 1 - a4Seg(u, 0.02, 0.3),
      };
    }
    shot(58.0, 60.0, (lt, t) => {
      const p = A4RW(t), u = 1 - p, stt = frac(t * 6.3) < 0.2, rw = t > 58.07 && t < 59.78 ? Math.min(1, (t - 58.07) / 0.12) * (stt ? 1 : 0.6) : 0;
      // the world plays backwards too (the swell, the fires on the spires), scrubbing faster as it goes
      const tw = t < 58.07 ? t : 58.07 - (t - 58.07) * (1.5 + p * 3);
      belowWorld(tw, 150, tw * 10, 0.85);
      a4Ceil(LB - 6, 22, 40 + tw * 3, null, 1);
      a4Rock(70, 168, 214, 250, 4421, true);
      // the Sunderer turns his brother's eye on it; one upper hand open towards it, turning slowly backwards like a dial
      const turn = eio(lin(58.0, 59.8, t)), wc = 1 - eio(lin(58.55, 59.55, t + (frac(t * 6.3) < 0.2 ? -0.06 : 0)));
      const wounds = A4W0.map(([a, b, c, d, w], k) => { const m = k ? Math.min(1, wc * 1.4) : wc, mx = (a + c) / 2, my = (b + d) / 2; return [lerp(mx, a, m), lerp(my, b, m), lerp(mx, c, m), lerp(my, d, m), w * (0.4 + 0.6 * m)]; }).filter((w) => Math.hypot(w[2] - w[0], w[3] - w[1]) > 1.5);
      const so = a4Sund(322, 92, 1.2, t, { third: 1, eyes: 1.3, heat: 0.8, crown: 0.75, rage: 0.3, wounds, tilt: -0.05 * turn,
        arms: [{ x: -142, y: 38 - turn * 10, pose: 'open', ang: -PI / 2 - 0.5 - turn * 1.3 }, a4Rest(128, 150, 11, t), a4Rest(-84, 186, 12, t), a4Rest(92, 182, 13, t)] });
      // the wounds close with light running along them, backwards
      if (wc > 0 && wc < 1) for (const [a, b, c, d] of wounds) for (const e of [[a, b], [c, d]]) sparkle(322 + e[0] * 1.2, 92 + e[1] * 1.2 + Math.sin(t * 0.9) * 1.2, 2 + 3 * ih(fl(t * 30), e[0] | 0, 4431), 22, 105);
      // his eye: at the hit a ring of void runs out from it; then a thread of magenta binds it to the hero
      const [bx, by] = so.brow, g0 = t - 58.0;
      if (g0 < 0.5) { shockRing(bx, by, 6 + g0 * 700, 6 + g0 * 560, 4, [75, 73, 71], 1 - g0 / 0.5); glow(bx, by, 60 * (1 - g0 * 2), T_MAG, 0.9); }
      // the hero: ghosts of what it just was trail it (ahead in time, behind on screen), then it, unwinding
      const s0 = a4NovaState(u);
      for (let k = 3; k >= 1; k--) {
        if (rw <= 0) break;
        const sk = a4NovaState(Math.min(1, u + k * 0.1)), ga = 0.5 - k * 0.12;
        a4Ghost({ form: sk.form, sword: sk.sw, eyes: 'glow' }, sk.x, sk.y, 2.2, 0, k === 1 ? 75 : 73, ga);
        if (sk.blade > 0) { const a = sk.sw - 0.12; lineF(sk.x + 30, sk.y + 2, sk.x + 30 + Math.cos(a) * sk.blade, sk.y + 2 + Math.sin(a) * sk.blade, (x, y) => { if (bay(x, y) < ga) P(x, y, 73); }); }
      }
      if (rw > 0) a4Dial(s0.x, s0.y, 58 + 10 * Math.sin(t * 3), t * 3, 0.55 * rw, 0.8);
      // particles drawn back into it: the corona's sparks running in, not out
      if (rw > 0) for (let k = 0; k < 40; k++) { const q = frac(ih(k, 1, 4432) - t * 1.6), a = ih(k, 2, 4432) * TAU, r = 14 + q * 90, x = s0.x + Math.cos(a) * r, y = s0.y + Math.sin(a) * r * 0.8; if (s0.corona < 0.05 && k % 3) continue; lineP(x, y, x + Math.cos(a) * 4, y + Math.sin(a) * 4 * 0.8, q < 0.3 ? 22 : k % 2 ? 106 : 74); }
      const jud = rw ? a4Tw(t, 1) * 2 : 0;
      // which form: near a boundary the rows interlace the two (a tape caught between frames)
      const drawHero = (st) => a4Nova(st.x + jud, st.y, 2.2, t, { sw: st.sw + jud * 0.04, eyes: t < 58.15 ? 'glow' : 'wide', mouth: t < 58.15 ? 0 : rw ? 2 : 1, corona: st.corona, spread: st.spread, blade: st.blade, form: st.form, wings: st.form === 'zenith' ? 'zenith' : 'nova', rise: -1.2, bob: 0, legs: st.spread > 0.3 ? undefined : [0, 0, 0, 0] });
      const near = [0.5, 0.31].find((b) => Math.abs(u - b) < 0.05);
      if (near !== undefined && rw) {
        // the form before, and over it the form after, kept only on alternate pairs of rows
        drawHero(a4NovaState(near + 0.06)); A4SAVE.set(BUF);
        const sv = a4NovaState(near - 0.06), ph = fl(t * 30);
        a4Wings(sv.x + jud, sv.y - 13, 1.3, t, sv.spread, 0.24, sv.form === 'zenith' ? 'zenith' : 'nova');
        actor(HERO3({ form: sv.form, eyes: 'wide', mouth: 2, sword: sv.sw }), sv.x + jud, sv.y, 2.2, 0, false, { still: true });
        for (let y = LB; y < H - LB; y++) if ((((y >> 1) + ph) & 1) === 0) BUF.set(A4SAVE.subarray(y * W, y * W + W), y * W);
      } else drawHero(s0);
      // the orbs come back out of its chest (the way they went in), and settle round it, dim
      if (s0.orbs > 0) for (let k = 0; k < 4; k++) {
        const e = eoc(clamp(s0.orbs * 1.3 - k * 0.1, 0, 1)), a = t * 1.3 + k * TAU / 4, tx = s0.x + Math.cos(a) * 30, ty = s0.y + Math.sin(a) * 10 - 3;
        a4Orb(lerp(s0.x, tx, e), lerp(s0.y, ty, e), k, 2.6, 1 - 0.55 * e);
      }
      a4Rewind(rw, t);
      if (t < 58.02) impactFrame(bx, by, 1);
      const pz = eio(lin(58.1, 59.85, t));
      a4Cam(1 + 0.22 * pz, (rw ? 0.02 * a4Tw(t * 0.3, 2) : 0), lerp(240, 190, pz), lerp(135, 158, pz), kick(t, [[58.0, 2.5, -PI / 2]]));
      shk(rw ? 1.5 : 0); if (g0 < 0.3) shk(6 * (1 - g0 / 0.3));
    });
  
    /* -------------------------------------------------------------- the chasm
       Its rock is one lit texture in world space (x across, wy down), cached row by row as it is first seen: tilted strata of
       two rocks (black glass and ash-grey stone) with dark partings between them, relief from three octaves of noise lit from
       above, and molten seams. Each texel keeps its brightness (0..7), which way it faces (up, level, down), its stratum and
       how near a seam it is, so walls scroll for nothing and are lit afresh each frame by a4Lit. */
    const A4TX = new Map();
    function a4TexRow(seed, wy) {
      let T = A4TX.get(seed); if (!T) A4TX.set(seed, T = new Map());
      let r = T.get(wy); if (r) return r;
      r = new Uint8Array(W); T.set(wy, r);
      const sl = (ih(seed, 1, 4590) - 0.5) * 0.022, sx = (seed % 17) * 3.1;
      const hf = (x, y) => vn(x, y, 13, seed + 1) * 1.1 + vn(x, y, 4.5, seed + 2) * 0.45 + vn(x, y, 1.7, seed + 3) * 0.14;
      const sv = (x, y) => y * 0.045 + x * sl + vn(x, y, 90, seed + 4) * 1.3 + vn(x, y, 23, seed + 6) * 0.25;
      const rdg = (q) => { const g = q - fl(q); return g < 0.07 ? -0.6 : Math.sin(g * PI) * 0.35; };
      for (let x = 0; x < W; x++) {
        const s0 = sv(x, wy), band = fl(s0), f = s0 - band;
        const h0 = hf(x, wy) + rdg(s0), gx = hf(x + 1, wy) + rdg(sv(x + 1, wy)) - h0, gy = hf(x, wy + 1) + rdg(sv(x, wy + 1)) - h0;
        const lit = 0.5 - gy * 2.4 - gx * 0.9 + (f < 0.07 ? -0.3 : 0) + (ih(band, 3, seed) - 0.5) * 0.25;
        const lvl = clamp(fl(lit * 7 + (ih(x, wy, seed + 5) - 0.5) * 0.8), 0, 7), face = gy < -0.05 ? 1 : gy > 0.07 ? 2 : 0;
        const sd = vn(x, wy, 60, seed + 7) < 0.52 ? 1 : seamAt(x / 64 + sx, wy / 52), sq = sd < 0.009 ? 0 : sd < 0.024 ? 1 : sd < 0.045 ? 2 : 3;
        r[x] = lvl | (face << 3) | ((band & 1) << 5) | (sq << 6);
      }
      return r;
    }
    // a texel lit for this frame: hot 0..1 the fire's light on it (lit faces turn red, seams burn), sky 0..1 the cold dawn
    // far above (lit faces turn ash-pale), k extra brightness
    const A4RA = [96, 96, 97, 98, 98, 99, 100, 100], A4RB = [96, 97, 97, 120, 121, 121, 122, 122];
    function a4Lit(v, x, y, hot, sky, k) {
      let lvl = (v & 7) + k; lvl = lvl < 0 ? 0 : lvl > 7 ? 7 : lvl;
      const face = (v >> 3) & 3, B = (v >> 5) & 1, sq = v >> 6, b = bay(x, y);
      let c = B ? A4RB[lvl] : A4RA[lvl];
      if (face === 1 && lvl >= 4) { if (b < hot * 1.2) c = lvl >= 6 && hot > 0.45 ? 103 : lvl >= 5 ? 102 : 101; else if (b < sky && lvl >= 5) c = B ? 123 : 122; }
      else if (face === 2 && lvl < 4 && b < 0.5) c = 96;
      if (sq === 0) { if (hot > 0.03) c = hot > 0.6 ? (b < 0.5 ? 106 : 105) : hot > 0.35 ? 104 : hot > 0.15 ? 103 : 102; }
      else if (sq === 1) { if (hot > 0.12) c = hot > 0.5 ? 103 : 102; }
      else if (sq === 2 && hot > 0.3 && b < hot - 0.2) c = 101;
      return c;
    }
    // a wall of the chasm: rock from the frame edge to a jagged face at xe (side -1: the wall is on the left), oy the camera's
    // depth (world y = y + oy); its seams burn hotter near the top (heat at depth 0, cooling over cool px); the face's lip
    // catches the chasm's light, the rock deep in shadow away from it
    function a4Wall(side, xe, oy, t, heat, cool, seed, lit, ox) {
      seed = seed || 4501; cool = cool || 900; ox = fl(ox || 0);
      for (let y = LB; y < H - LB; y++) {
        const wy = fl(y + oy), e = xe + (vn(wy * 0.05, 0, 1, seed) - 0.5) * 36 + (vn(wy * 0.21, 0, 1, seed + 1) - 0.5) * 9, hy = heat * clamp(1 - wy / cool, 0, 1);
        const xa = side < 0 ? 0 : Math.max(0, fl(e)), xb = side < 0 ? Math.min(W - 1, fl(e)) : W - 1, row = y * W, R = a4TexRow(seed, wy);
        for (let x = xa; x <= xb; x++) {
          const d = side < 0 ? e - x : x - e, near = d < 70 ? 1 - d / 70 : 0;
          let c = a4Lit(R[((side < 0 ? x + ox : W - 1 - x - ox) % W + W) % W], x, y, hy * (0.35 + 0.65 * near), lit ? 0.35 : 0.1, d < 6 ? 2 : d < 18 ? 1 : d > 150 ? -1 : 0);
          if (d < 1.5) c = lit ? (hy > 0.25 ? 104 : 123) : hy > 0.2 ? 102 : 99;
          else if (d < 3) c = lit ? (hy > 0.25 ? 102 : 122) : 98;
          BUF[row + x] = c;
        }
      }
    }
    // the inside of the chasm behind the walls: its far face, dim and low in contrast, hazed with the fire's light (hotter
    // near the top), shafts of light falling from the cut far above
    function a4Deep(oy, t, heat, cool, ox) {
      cool = cool || 900; ox = fl(ox || 0);
      for (let y = LB; y < H - LB; y++) {
        const wy = fl((y + oy) * 0.6), hy = heat * clamp(1 - (y + oy) / cool, 0, 1), row = y * W, R = a4TexRow(4512, wy);
        for (let x = 0; x < W; x++) {
          const v = R[((x + ox) % W + W) % W], lvl = v & 7, sq = v >> 6, b = bay(x, y);
          let c = lvl < 3 ? 96 : lvl < 6 ? 97 : (v >> 5) & 1 ? 120 : 98;
          if (b < hy * (0.08 + lvl * 0.045)) c = lvl > 4 ? 102 : 101;
          if (sq === 0 && hy > 0.3) c = hy > 0.65 ? 103 : 102;
          BUF[row + x] = c;
        }
      }
      // the shafts: soft slanting bands of the cut's light, drifting
      for (let k = 0; k < 4; k++) {
        const x0 = ih(k, 1, 4514) * 560 - 40 + Math.sin(t * 0.3 + k) * 12 - ox, w = 10 + ih(k, 2, 4514) * 26, sl = 0.25 + ih(k, 3, 4514) * 0.2, a = (0.05 + 0.07 * ih(k, 4, 4514)) * (0.4 + heat * 0.6);
        for (let y = LB; y < H - LB; y++) { const cx = x0 + (y - LB) * sl, fade = a * (1 - (y - LB) / (H - 2 * LB) * 0.6); for (let x = Math.max(0, fl(cx - w)); x < Math.min(W, cx + w); x++) { const e = 1 - Math.abs(x - cx) / w; tintI(y * W + x, x, y, T_WARM, fade * e); } }
      }
    }
    // embers and grit drifting in the chasm at three depths (speed px/s: + rising, - falling): far ones dim specks, near ones
    // bright, streaked along their motion and wavering more
    function a4Embers(t, n, speed, seed, cols) {
      cols = cols || [105, 103];
      const dn = speed > 0 ? 1 : -1;
      for (let k = 0; k < n; k++) {
        const z = ih(k, 7, seed), sp = speed * (0.4 + z * 1.2), y = LB + frac(ih(k, 1, seed) - t * sp / 218) * 218, x = ih(k, 2, seed) * W + Math.sin(t * (0.8 + z) + k) * (3 + 9 * z);
        if (z > 0.78) { P(x, y, cols[0]); P(x + 1, y, cols[1]); P(x, y + dn, cols[1]); P(x + 1, y + dn, 101); if (Math.abs(speed) > 60) { P(x, y + 2 * dn, cols[1]); P(x, y + 3 * dn, 101); } }
        else if (z > 0.35) { P(x, y, cols[k & 1]); P(x, y + dn, 101); }
        else if (bay(fl(x), fl(y)) < 0.75) P(x, y, 102);
      }
    }
    // the hero's sword as a loose piece (dropped, flung): hilt at (x, y), pointing a, scale S; broken leaves a stub
    function a4Sword(x, y, a, S, cols, cracked, broken) {
      const ux = Math.cos(a), uy = Math.sin(a), L = (broken ? 6 : 27) * S, w = Math.max(1, 1.8 * S);
      capsF(x - ux * 5 * S, y - uy * 5 * S, x, y, Math.max(1, S), Math.max(1, S), () => 38);
      capsF(x - uy * 4 * S, y + ux * 4 * S, x + uy * 4 * S, y - ux * 4 * S, Math.max(1, S * 0.9), Math.max(1, S * 0.9), (u, d) => (d > 0.6 ? 51 : 58));
      for (let q = 2 * S; q < L; q += 0.5) {
        const f = q / L, hw = broken ? w * (1 - Math.max(0, ih(fl(q), 1, 4521) - 0.4)) : f > 0.86 ? w * (1 - f) / 0.14 : w;
        for (let v = -hw; v <= hw; v += 0.5) { const px = x + ux * q - uy * v, py = y + uy * q + ux * v; P(px, py, v < -hw * 0.4 ? 22 : cols ? cols[fl(frac(q * 0.08 / S) * cols.length)] : q < 4 * S ? 33 : 34); }
      }
      if (cracked) for (let k = 0; k < 3; k++) { const q = (8 + k * 6) * S, px = x + ux * q, py = y + uy * q; lineP(px - uy * w, py + ux * w, px + ux * 2 * S + uy * w, py + uy * 2 * S - ux * w, 96); }
      return [x + ux * L, y + uy * L];
    }

    /* ============================================================== 2 · the horror (60.0–62.0)
       Close: it stares at its ordinary sword, the last spark of NOVA dying off the blade. Then from low on the rock: he lifts
       one hand above his head, flat, like a blade. */
    shot(60.0, 62.0, (lt, t) => {
      // ONE shot: close on the hero, staring at its ordinary sword (the light runs up it twice and gutters out), then the
      // camera dollies back and down past it — the hero shrinks to its rock in the corner while he barely changes, a
      // mountain behind it — and looks up with it as his hand rises above his head, flat as a blade, and comes down
      const dolly = eio(lin(60.95, 61.75, t)), rise = eio(lin(61.18, 61.78, t)), chop = eic(lin(61.88, 62.0, t)), camY = 60 * eio(lin(61.1, 61.8, t));
      belowWorld(t, 168 + camY, t * 10, 0.85);
      a4Ceil(LB + camY * 0.5 - 4, 26, 70, null, 1);
      const qx0 = lerp(lerp(150, 30, rise), -170, chop), qy0 = lerp(lerp(150, -96, rise), 240, chop);
      const so = a4Sund(318 + 20 * (1 - dolly), 110 + camY - 10 * (1 - dolly), 0.95, t, { third: 1, eyes: 1.2, heat: 0.8, crown: 0.75, tilt: 0.04 * rise - 0.1 * chop, nod: -2 * rise + 2 * (1 - dolly),
        arms: [a4Rest(-150, 150, 14, t), { x: qx0, y: qy0, pose: a4PL('fist', 'chop', eoc(lin(61.15, 61.5, t))), ang: lerp(-PI / 2 - 0.1, PI * 0.7, chop), heat: 0.6 + rise * 0.4 }, a4Rest(-86, 196, 15, t), a4Rest(92, 192, 16, t)] });
      const [qx, qy] = so.hands[1];
      if (rise > 0.9 && chop < 0.1) { glow(qx, qy, 40, T_EMBER, 0.6); sparkle(qx + 4, qy - 22, 2 + 4 * frac(t * 3), 22, 106); }
      if (chop > 0.05) { streaks(Math.atan2(240 - qy0, -170 - qx0), 26, t, 2600, 105, 90, 4541, [0, LB, W, H - 2 * LB]); smearArc(318 + 84 * 0.95, 110 + camY + 40 * 0.95, -PI / 2, -PI / 2 + chop * 2.2, 190, [102, 104, 22]); }
      a4Embers(t, 30, -14, 4531, [103, 102]);
      // the hero and its rock, near the camera: big, then small in the corner
      const S = lerp(5, 1.6, dolly), tr = a4Tw(t, 3) * (0.6 + Math.min(lt, 1.15) * 0.5) * (1 - dolly), hx = lerp(196, 92, dolly) + tr * 0.8, hy = lerp(160, 192 + camY * 0.7, dolly) + Math.sin(lt * 2.2) * 1.5 * (1 - dolly);
      const k = S / 1.6;
      a4Rock(hx - 112 * k, hx + 58 * k, hy + 14 * S - 1, H, 4422, true);
      a4Halo(hx, hy, lerp(100, 24, dolly), t * 0.6, lerp(7, 1.6, dolly), lerp(0.75, 0.3, dolly), null, false);
      const a = actor(HERO3({ eyes: lt > 0.95 && lt < 1.02 ? 'closed' : 'wide', mouth: dolly > 0.5 ? 0 : lt > 0.6 ? 2 : lt > 0.25 ? 1 : 0, sword: lerp(-1.05 + tr * 0.025, 0.5, dolly), legs: [0, 0, 0, 0] }), hx, hy, S, lerp(-0.04, 0.02, dolly), false, { bob: 0 });
      a4Halo(hx, hy, lerp(100, 24, dolly), t * 0.6, lerp(7, 1.6, dolly), lerp(0.75, 0.3, dolly), null, true);
      // it tries to make the blade grow again: twice the light runs up it and gutters out, the second time weaker
      const ba = Math.atan2(a.tip[1] - a.hand[1], a.tip[0] - a.hand[0]);
      for (const [t0, pw] of [[0.22, 1], [0.62, 0.5]]) {
        const g = lt - t0; if (g < 0 || g > 0.32) continue;
        const up = eoc(Math.min(1, g / 0.1)), dn = 1 - eic(lin(0.1, 0.32, g)), L = 29 * S * (1 + 1.3 * pw * up * dn);
        bigBlade(a.hand[0], a.hand[1], ba, L, 4.5, t, { form: 'nova', grow: 0.999, flare: 0.8 * pw * dn });
        glow(a.tip[0], a.tip[1], 40 * pw * dn, T_NOVA, 0.6 * dn);
        if (g > 0.1) for (let k2 = 0; k2 < 8 * pw; k2++) { const q = (g - 0.1) / 0.22, x = a.tip[0] + (ih(k2, 1, 4533) - 0.5) * 30 * q, y = a.tip[1] - 10 + q * 60 * ih(k2, 2, 4533) + q * q * 40; if (bay(fl(x), fl(y)) < 1 - q) P(x, y, q < 0.5 ? 106 : 103); }
      }
      // the last ember of it drifts off the point and goes out
      const g = lt - 0.7; if (g > 0 && g < 0.45) { const q = g / 0.45, x = a.tip[0] + q * 14, y = a.tip[1] - q * 26 - Math.sin(q * 9) * 3; sparkle(x, y, 2.5 * (1 - q) + 0.6, q < 0.5 ? 22 : 106, 105); }
      // ash drifting across the lens
      a4FG(t * 20, 0, t, 1.0, 4535, H + 40);
      shk(chop > 0 ? 3 : rise > 0.95 ? 0.6 : 0);
      a4Cam(1.02 + 0.03 * rise + 0.04 * (1 - dolly), -0.02 * rise, 240, 135);
    });

    /* ============================================================== 3 · SUNDER (62.0–63.0)
       Wide: the hand comes down and the world is cut in two along a line that runs from under the camera to the horizon and
       on up the sky: the sea, the horizon, the clouds. The halves slide apart over a burning chasm; the sea pours in off both
       lips and boils. Then close: the lip under the hero breaks and it falls in. */
    // the split in perspective: the cut runs from (bx, bottom) to the vanishing point (vx, hz) and straight up the sky; gap is
    // its width at the bottom row (it narrows to the horizon), sky its width in the sky; run 0..1 how far it has raced
    function a4Sunder(vx, hz, bx, gap, sky, run, t) {
      TMP.set(BUF);
      const bot = H - LB, f = fl(t * 30);
      for (let y = LB; y < bot; y++) {
        const below = y >= hz, q = below ? (y - hz) / (bot - hz) : 0, cx = below ? lerp(vx, bx, q) : vx + (hz - y) * 0.02;
        const reach = below ? q > 1 - run * 1.25 : (hz - y) / (hz - LB) < run * 1.4 - 0.25;
        if (!reach) continue;
        const half = below ? gap * (0.04 + 0.96 * q) / 2 : sky / 2, row = y * W;
        for (let x = 0; x < W; x++) {
          const d = x + 0.5 - cx;
          if (d < -half) { BUF[row + x] = TMP[row + clamp(fl(x + half), 0, W - 1)]; continue; }
          if (d > half) { BUF[row + x] = TMP[row + clamp(fl(x - half), 0, W - 1)]; continue; }
          const e = half > 0.5 ? Math.abs(d) / half : 0;
          let c;
          if (below) {
            // the cut faces of the sea floor fall away into the glow; foam and steam along the lips
            c = e < 0.05 ? 22 : a4Gorge(x, y, 1 - e, d < 0 ? -1 : 1, 50 / (q + 0.06), half * 0.45, t);
          } else c = e < 0.3 ? 22 : e < 0.6 ? 107 : e < 0.85 ? 105 : 103;
          BUF[row + x] = c;
        }
      }
    }
    /* the inside of a cut seen from above: its two faces falling away from the lips to the molten floor along its middle,
       in the chasm's own strata (running along the cut, crowding toward the floor), lit by the floor's fire more the deeper
       they go, the sea pouring in over the lips in ropes that break into spray down the faces. dep 0 at a lip .. 1 at the
       floor; sd which face (-1 left, 1 right); al a coordinate along the cut; sc the strata's spread */
    function a4Gorge(x, y, dep, sd, al, sc, t) {
      if (dep > 0.86) { const n = vn(x * 0.5, al * 0.2 - t * 10, 4, 4581); return dep > 0.96 ? (n > 0.45 ? 22 : 107) : n > 0.5 ? 106 : 105; }
      const R = a4TexRow(sd < 0 ? 4582 : 4583, fl(Math.sqrt(dep) * sc + 400)), tx = ((fl(al) % W) + W) % W, hot = dep * Math.sqrt(dep), b = bay(x, y);
      let c = a4Lit(R[tx], x, y, 0.2 + hot * 0.8, 0.04, (sd < 0 ? 0 : -1) + (dep > 0.55 ? 1 : 0) + (dep > 0.75 ? 1 : 0));
      if (dep < 0.45 && ih(fl(al / 11), sd + 2, 4584) < 0.1) { const n = ih(x, fl(y - t * 140) >> 1, 4585); if (n > 0.3 + dep * 0.9) c = n > 0.9 ? 22 : n > 0.65 ? 119 : 118; }
      if (dep < 0.04) c = b < 0.5 ? 22 : 119;
      else if (dep < 0.09) c = b < 0.5 ? 99 : 98;
      else if (b < hot * 0.5) c = dep > 0.7 ? 104 : 103;
      return c;
    }
    const SVX = 236, SHZ = 138, SBX = 176;
    const a4Gap = (t) => 260 * eoc(lin(62.04, 62.9, t)) + 40 * lin(62.9, 64, t);
    // where the left lip of the cut is on row y (the left half has slid away by the cut's half width)
    const a4Lip = (y, t) => { const q = (y - SHZ) / (H - LB - SHZ); return lerp(SVX, SBX, q) - a4Gap(t) * (0.04 + 0.96 * q) / 2; };
    shot(62.0, 62.75, (lt, t) => {
      const g = t - 62.0, gap = a4Gap(t), sky = 26 * eoc(lin(62.04, 62.7, t)), run = eoc(lin(62.0, 62.09, t));
      belowWorld(t, SHZ, 120 + t * 10, 0.85);
      a4Ceil(LB - 4, 34, 40, null, 1);
      a4Rock(110, 182, 214, 260, 4421, true);
      a4Sunder(SVX, SHZ, SBX, gap, sky, run, t);
      // the hero rides its half away on the very lip; the lip breaks under it and it goes over, into the light
      const brk = t - 62.45, fw = eic(lin(62.47, 62.75, t)), lip = a4Lip(214, t);
      // the slab of sea floor it rides on the lip: its crust lit, its cut face glowing; the end of it breaks off under it
      // and tips over into the light, carrying it
      a4Chunk(lip - (brk > 0 ? 76 : 62), 228, brk > 0 ? 100 : 128, 30, 0.02, 4578, true);
      if (brk < 0) { if (t > 62.3) { const k = lin(62.3, 62.45, t); for (let q = 0; q < 3; q++) lineP(lip - 26 + q * 2, 214, lip - 30 + q * 4 + k * 3, 214 + 26 * k, q === 1 ? 104 : 96); } }
      else a4Chunk(lip - 13 + 30 * fw, 228 + 64 * fw * fw, 30, 28, 0.05 + fw * 1.1, 4579, true);
      const hx = lip - 13 + 24 * fw + (brk > 0 ? 0 : a4Tw(t, 3) * 0.5), hy = 214 - 14 * 1.25 + 4 + 70 * fw * fw - 8 * Math.sin(fw * PI) * 0.5;
      actor(HERO3({ eyes: 'wide', sword: lerp(0.5, -1.4, fw), legs: fw > 0.1 ? z5Limp(t, 1.4) : [0, 0, 0, 0], mouth: brk > 0 ? 2 : 1 }), hx, hy, 1.25, 0.12 * sstep(0.25, 0.45, g) + fw * 1.1, false, {});
      if (brk > 0) rocks(lip - 4, 214, brk, 14, 90, 2.5, [97, 99, 122, 105], 4557, 300, PI / 2 - 0.4, 1.4);
      // he is on the far side of the line, slid away with his half; the hand that cut it lies along its lip, lifting off it
      const lift = eio(lin(62.15, 62.6, t)), sl = gap * 0.42;
      a4Sund(392 + sl * 0.5, 62, 0.66, t, { third: 1, eyes: 1.4, heat: 0.9, crown: 0.75, rage: 0.4, nod: 2,
        arms: [a4Rest(-150, 150, 17, t), a4Rest(120, 170, 18, t), a4Rest(-86, 196, 19, t), { x: -150 + sl * 0.4 + lift * 30, y: 268 - lift * 40, pose: 'chop', ang: PI * 0.7 - lift * 0.4, front: true }] });
      // steam boiling up out of the whole length of it, and spray where the sea goes over
      for (let k = 0; k < 9; k++) { const q = 0.15 + 0.8 * ih(k, 1, 4552), y = lerp(SHZ + 4, H - LB, q), cx = lerp(SVX, SBX, (y - SHZ) / (H - LB - SHZ)), up = frac(ih(k, 2, 4552) + g * 0.9); cloudPuff(cx + (ih(k, 3, 4552) - 0.5) * 20 * q, y - up * (30 + 60 * q), (5 + up * 14) * (0.4 + q), [120, 121, 122, 123], 4553 + k); }
      rocks(SBX + 8, 230, g, 18, 300, 4, [97, 99, 122, 105], 4554, 220, -PI / 2, 1.2);
      rocks(SVX, SHZ + 6, g, 10, 90, 2, [97, 99, 122, 105], 4556, 120, -PI / 2, 1.2);
      // the cut itself: a line of white light the length of the world, then the light of the chasm on everything
      if (g < 0.1) { const k = 1 - g / 0.1; glow(SBX + 10, 200, 160 * k, T_WH, 0.7); lineF(SBX, H - LB, SVX, SHZ, (x, y) => { thick(x, y, x, y, 2, 22); }); lineP(SVX, SHZ, SVX + 2, LB, 22); }
      glow(SBX + 10, 230, 120, T_EMBER, 0.4 * eoc(lin(62.05, 62.4, t)));
      megaHit(SBX + 6, 238, g, 2.6, -PI / 2, [22, 106, 103], 4555);
      // the camera leans in on it as it goes (so the cut to the fall is a cut-in on its fall)
      const push = eio(lin(62.28, 62.75, t)), lip0 = a4Lip(214, t);
      a4Cam(1 + 0.05 * g + 0.34 * push, -0.01 * g + 0.03 * push, lerp(240, lip0 + 4, push), lerp(135, 205, push), kick(t, [[62.0, 3, PI / 2]]));
      shk(2 + 6 * Math.max(0, 1 - g * 2));
    });
    /* one of his arms seen close, at the engine's own fidelity: the muscled obsidian upper arm (glossy, veined with fire,
       rim-lit) running back off the frame, the elbow cop, the porcelain vambrace of three plates with fire in its gaps, and
       the jointed hand. (x, y) the wrist, a the forearm's direction, s the scale (local units like his), pose a preset name or
       a hand object; o: { bend (the elbow's turn, so the upper arm comes in from another angle), len (the forearm, units),
       ang (the hand's own angle; default a), hold, layer ('palm' draws the whole arm and the palm; 'fingers' only the
       fingers), side (thumb side), rim (0..1 the fire's light on its far side) }. Returns the hand's striking point (with
       .palm, .tip, .knuckles, .elbow) */
    function a4Fore(ex, ey, wx, wy, s, heat, rim) {
      limbF(ex, ey, wx, wy, (u) => s * (12.5 + u * 2.5), 16 * s, (u, sdn, lit, X, Y, e) => {
        if (u < 0.26) return obsLit(lit, X, Y, e, heat);
        const pf = (u - 0.26) / 0.74 * 3, fp = frac(pf);
        if (fp < 0.07 && u < 0.98) return heat > 0.25 ? (heat > 0.6 ? (Math.abs(sdn) < 0.5 ? 105 : 104) : 102) : 96;
        if (e > 0.9) return rim > 0.3 && lit < -0.2 ? 103 : 69;
        if (rim > 0.3 && lit < -0.45 && e > 0.72) return bay(X, Y) < rim ? 102 : 68;           // the fire's light on its far side
        if (Math.abs(sdn + 0.15) < 0.05 && fp > 0.25 && fp < 0.8) return 67;                     // an engraved line
        if (fp > 0.86 && Math.abs(sdn) < 0.8) return BONE4[clamp(fl(3.4 + lit * 2), 0, 5)];      // the plate's raised lip
        if (lit > 0.78 && fp > 0.2) return 64;                                                     // the gloss along its top
        return BONE4[clamp(fl(1.7 + lit * 3.3 + (bay(X, Y) - 0.5) * 0.9 - (fp < 0.18 ? 0.8 : 0)), 0, 5)];
      });
    }
    function a4Upper(ax, ay, ex, ey, s, heat, k) {
      limbF(ax, ay, ex, ey, (u) => s * (17 + 5 * Math.sin(PI * Math.min(1, (1 - u) * 1.25)) - (1 - u) * 4), 22 * s, (u, sdn, lit, X, Y, e) => {
        const vein = Math.abs(sdn - 0.35 * Math.sin(u * 9 + k)) < 0.05 && u > 0.1 && u < 0.9;
        return vein && heat > 0.25 ? (heat > 0.6 ? 104 : 103) : obsLit(lit, X, Y, e, heat);
      });
    }
    const a4P = (p) => { const q = poseOf(p); return { curls: q.curls ? q.curls.slice() : [0, 1, 2, 3].map(() => q.curl), thumb: q.thumb, spread: q.spread }; };
    // a pose between two poses (names or hand objects)
    const a4PL = (a, b, u) => { const A = a4P(a), B = a4P(b); u = clamp(u, 0, 1); return { curls: A.curls.map((c, i) => lerp(c, B.curls[i], u)), thumb: lerp(A.thumb, B.thumb, u), spread: lerp(A.spread, B.spread, u) }; };
    function a4Arm(x, y, s, a, pose, heat, t, o) {
      o = o || {};
      const len = (o.len || 76) * s, ex = x - Math.cos(a) * len, ey = y - Math.sin(a) * len, a2 = a + (o.bend === undefined ? 0.35 : o.bend);
      const ax = ex - Math.cos(a2) * 170 * s, ay = ey - Math.sin(a2) * 170 * s, rim = o.rim === undefined ? 0.6 : o.rim;
      if (o.layer !== 'fingers') {
        a4Upper(ax, ay, ex, ey, s, heat, o.k || 0);
        a4Fore(ex, ey, x, y, s, heat, rim);
        // the elbow cop: a porcelain plate over the joint, fire round its edge
        const cx_ = Math.cos(a) * 3 * s, cy_ = Math.sin(a) * 3 * s;
        capsF(ex - cx_, ey - cy_, ex + cx_, ey + cy_, 10 * s, 10 * s, () => (heat > 0.3 ? 102 : 96));
        limbF(ex - cx_, ey - cy_, ex + cx_, ey + cy_, () => 8.8 * s, 10 * s, (u, sdn, lit, X, Y, e) => e > 0.86 ? 69 : BONE4[clamp(fl(2.4 + lit * 2.4 + (bay(X, Y) - 0.5) * 0.9), 0, 5)]);
        limbF(x - 1, y - 1, x + 1, y + 1, () => 10 * s, 11 * s, (u, sdn, lit, X, Y, e) => obsLit(lit, X, Y, e, heat));
      }
      const h = Object.assign(a4P(pose), { heat, side: o.side || 1, hold: o.hold, layer: o.layer });
      const r = sHand(x, y, s, o.ang === undefined ? a : o.ang, h, t);
      r.elbow = [ex, ey];
      return r;
    }
    // lightning crawling over the last stamped sprite and out of it
    function a4Storm(x, y, S, t, amt, n) {
      for (let k = 0; k < (n || 3); k++) { const f = fl(t * 18), a0 = ih(k, f, 4601) * TAU, r0 = 6 * S, r1 = (12 + 10 * ih(k, f, 4602)) * S * amt; if (ih(k, f, 4603) > amt) continue; bolt(x + Math.cos(a0) * r0, y + Math.sin(a0) * r0, x + Math.cos(a0 + 0.5) * r1, y + Math.sin(a0 + 0.5) * r1, f + k * 7, 1, 91, 89); }
    }

    /* ============================================================== 4 · storm (63.0–66.0)
       It falls down the cut face, drives its sword into the rock and grinds to a stop; flares STORM FORM; leaps up the chasm
       as lightning, at his face — and he catches it out of the air like a fly, and smashes it into the wall. */
    const A4STAB = 63.12;
    const a4FallY = (t) => t < A4STAB ? -38.2 + 1100 * Math.max(0, t - 62.8) ** 2 : 74.4 + 520 * 0.38 * (1 - Math.pow(1 - clamp((t - A4STAB) / 0.38, 0, 1), 2)) / 2;
    /* a slab of the broken lip, tumbling: the sea-floor crust on top, the rock's strata through it, its cut face glowing;
       (cx, cy) its centre, w × h, turned rot */
    function a4Chunk(cx, cy, w, h, rot, seed, hot) {
      const ca = Math.cos(rot), sa = Math.sin(rot), R = Math.hypot(w, h) / 2 + 3;
      for (let y = Math.max(LB, fl(cy - R)); y < Math.min(H - LB, cy + R); y++) for (let x = Math.max(0, fl(cx - R)); x < Math.min(W, cx + R); x++) {
        const dx = x + 0.5 - cx, dy = y + 0.5 - cy, u = dx * ca + dy * sa, v = -dx * sa + dy * ca;
        const ju = w / 2 - vn(v + 40, 0, 4, seed) * 5, jv = h / 2 - vn(u + 70, 0, 6, seed + 1) * 4;
        if (Math.abs(u) > ju || Math.abs(v) > jv) continue;
        const R2 = a4TexRow(seed, fl(v * 1.4 + 300)), tx = ((fl(u * 1.3 + 200) % W) + W) % W;
        let c = a4Lit(R2[tx], x, y, 0.3, 0.3, v < 0 ? 1 : -1);
        if (v < -jv + 1.5) c = 123; else if (v < -jv + 3.5) c = bay(x, y) < 0.5 ? 122 : 99;
        else if (u > ju - 2.5) c = hot ? 104 : 102; else if (u > ju - 5 && bay(x, y) < 0.5) c = 102;
        else if (u < -ju + 1.5 || v > jv - 1.5) c = 96;
        BUF[y * W + x] = c;
      }
    }
    /* ONE shot, 62.75–64.2: cut in on its fall: thrown off its lip, it tumbles across the chasm with the broken slabs of the
       lip, the camera diving with it, at the far face; its sword bites the rock and ploughs down it to a stop; it hangs
       there, flares STORM, crouches and leaps back up as lightning. The wall is at the right, so it faces it as everywhere
       (to the right), the open chasm and the lip it fell from behind it at the left. */
    const A4TOP = 295;                                                     // the lip of the far wall (world depth)
    shot(62.75, 64.2, (lt, t) => {
      const wy = a4FallY(t), cw = lerp(9.8, a4FallY(Math.min(t + 0.09, Math.max(t, A4STAB + 0.3))), eio(lin(62.78, 63.05, t))), oy = 300 + cw - 118, storm = t >= 63.6, g = t - 63.6, launch = eic(lin(64.08, 64.2, t));
      const topY = A4TOP - oy;
      a4Deep(oy - 200, t, 1, 1400);
      // above the lips: the burning air of the cut, steam boiling up out of it, and the lip it fell from (far, at the left)
      // with the sea pouring over it
      const farY = topY - 20;
      if (topY > LB) {
        for (let y = LB; y < Math.min(H - LB, topY); y++) { const d = topY - y; for (let x = 0; x < W; x++) BUF[y * W + x] = bay(x, y) < clamp(1 - d / 70, 0, 1) * 0.8 ? 103 : d < 110 ? 102 : bay(x, y) < 0.5 ? 101 : 102; }
        for (let k = 0; k < 7; k++) { const up = frac(ih(k, 1, 4568) + t * 0.5), x = ih(k, 2, 4568) * 340 - 20 + up * 30; cloudPuff(x, topY - 10 - up * 110, 10 + up * 22, [120, 121, 122, 123], 4569 + k); }
        for (let x = 0; x < 300; x++) { const fy = farY + (vn(x, 0, 14, 4570) - 0.5) * 10 + (vn(x, 0, 4, 4571) - 0.5) * 3; const fb = fy + 9 + vn(x, 0, 7, 4576) * 8; for (let y = Math.max(LB, fl(fy)); y < Math.min(H - LB, fb); y++) { const d = y - fy; BUF[y * W + x] = d < 1.2 ? 123 : d < 3 ? 102 : y > fb - 2 ? 101 : bay(x, y) < 0.3 ? 101 : vn(x, y, 5, 4572) > 0.6 ? 97 : 96; } }
        for (let x = 0; x < 300; x++) for (let y = fl(farY) - 5; y < farY + 1; y++) if (y >= LB && ih(x, fl(y + t * 30), 4566) < 0.5) P(x, y, ih(x, y, 4567) < 0.3 ? 22 : 118);
        glow(240, LB, 200, T_EMBER, 0.4);
      }
      a4Falls(70, Math.max(LB, farY - 2), H - LB, 14, t, 4611);
      a4Falls(150, Math.max(LB, farY - 2), H - LB, 9, t, 4618);
      a4Falls(236, Math.max(LB, farY - 2), H - LB, 6, t, 4620);
      a4Wall(1, 330, oy, t, 1, 1400, 4612, true);
      // the slabs of its lip, falling with it (the nearest passing in front)
      const drop = (f) => -38.2 + 1100 * f * Math.max(0, t - 62.76) ** 2 + 118 - cw;
      const CH = [[104, -24, 66, 24, 0.9, 1.6, 4573], [212, -70, 46, 20, 1.0, -2.4, 4574], [36, 40, 92, 30, 0.8, 1.1, 4575]];
      for (const [x0, y0, w, h, f, sp, sd] of CH.slice(0, 2)) a4Chunk(x0 + (t - 62.75) * 50, drop(f) + y0, w, h, 0.5 + (t - 62.75) * sp, sd, true);
      if (t < A4STAB && t > 62.88) streaks(-PI / 2, 40, t, 3000, 103, 60, 4613, [0, LB, W, H - 2 * LB]);
      if (t > 62.8 && t < 63.3) rocks(220, drop(1) - 20, t - 62.8, 16, 80, 3, [97, 99, 122, 105], 4564, 500, PI / 2, 2);
      // the scar its sword ploughed down the rock, still glowing
      const hsy = 118 + wy - cw; if (t >= A4STAB) { const y0 = hsy - (wy - 74.4); for (let y = Math.max(LB, fl(y0)); y < hsy; y++) { const q = (hsy - y) / Math.max(1, hsy - y0); P(322 + Math.sin(y * 0.7) * 0.8, y, q < 0.3 ? 106 : q < 0.7 ? 104 : 102); P(323, y, 101); P(321, y, 96); } }
      // across the chasm to the far face, tumbling, righting itself as it reaches it
      const across = eoc(lin(62.75, 63.04, t)), crouch = storm ? eio(lin(63.7, 64.0, t)) * (1 - launch) : 0, hx = lerp(172, 290, across) - crouch * 8 - launch * 20, hy = hsy + 6 * crouch - launch * 150;
      const hang = t >= A4STAB && !storm ? Math.sin((t - A4STAB) * 9) * 0.06 * Math.exp(-(t - A4STAB) * 3) : 0, tum = t < A4STAB ? 1.2 * (1 - eio(lin(62.75, 63.06, t))) : 0;
      const sw = t < A4STAB - 0.06 ? -1.35 : t < A4STAB ? lerp(-1.35, 0.05, eoc((t - A4STAB + 0.06) / 0.06)) : launch > 0 ? lerp(0.05, -1.4, launch) : 0.05 + hang;
      const form = storm ? 'storm' : null, flick = storm && g < 0.25 && fl(g * 30) % 3 === 1;
      if (storm && g < 0.5) glow(hx, hy, 140 * (1 - g * 1.5), T_CYAN, 0.6);
      const a = heroForm(flick ? 'plain' : form || 'plain', { eyes: storm ? 'glow' : t < 62.9 ? 'wide' : t < A4STAB + 0.4 ? 'closed' : 'wide', mouth: t < 62.9 || (t > A4STAB && t < 63.5) ? 2 : storm ? 1 : 0, sword: sw, sq: crouch * 0.3 - launch * 0.2, legs: storm ? undefined : z5Limp(t, 1.2) }, hx, hy, 2.4, hang * 2 - launch * 0.5 + tum, false, {});
      if (storm) { a4Storm(hx, hy, 2.4, t, g < 0.4 ? 1 : 0.6, g < 0.4 ? 5 : 3); if (g < 0.3) for (let k = 0; k < 4; k++) bolt(hx, hy, hx + (ih(k, 1, 4614) - 0.5) * 300, hy - 60 - ih(k, 2, 4614) * 120, k + fl(t * 20), 2, 91, 89); }
      if (t >= A4STAB && t < A4STAB + 0.4) { const g2 = t - A4STAB; for (let k = 0; k < 14; k++) { const q = frac(ih(k, 1, 4615) + g2 * 4), x = a.tip[0] - 2 - q * 40 * ih(k, 2, 4615), y = a.tip[1] - q * 30 + q * q * 40; P(x, y, q < 0.4 ? 22 : 106); } glow(a.tip[0], a.tip[1], 30, T_EMBER, 0.6); }
      // the biggest slab, near the lens, falls past in front of it
      { const [x0, y0, w, h, f, sp, sd] = CH[2]; a4Chunk(x0 + (t - 62.75) * 70, drop(f) + y0, w, h, 0.3 + (t - 62.75) * sp, sd, false); }
      if (launch > 0) streaks(-PI / 2, 30, t, 3000, 91, 80, 4616, [0, LB, W, H - 2 * LB]);
      a4Embers(t, 26, storm ? 30 : t < 62.88 ? 60 : 400, 4617);
      a4FG(0, oy, t, 1.5, 4619, H - LB + 40);
      shk(t < 62.9 ? 2.5 : t >= A4STAB && t < 63.3 ? 3 : storm && g < 0.3 ? 4 : 0.5);
      a4Cam(1.06, 0.02 * Math.sin(lt * 2) + 0.03 * (1 - sstep(62.75, 63.0, t)), 240, 135, kick(t, [[A4STAB, 1.2, -PI / 2], [63.6, 1.5]]));
    });
    /* looking straight up the chasm: its two walls rise on either side and converge (in perspective) on a narrow slit of fire
       and dawn far overhead. Wall texels are the chasm's own rock, laid out by height (h ~ 1 / distance from the slit), so its
       strata run parallel to the slit and crowd together toward it; far rock drowns in the haze of the cut's light; oyy
       scrolls the walls past (a rise up them). The slit is a little wider at the bottom of the frame (its nearer end). */
    function a4Up(t, slitW, oyy, heat) {
      heat = heat === undefined ? 1 : heat;
      for (let y = LB; y < H - LB; y++) {
        const q = (y - LB) / (H - 2 * LB), cx = 240 + Math.sin(q * 3 + 0.4) * 8 + (vn(y, 0, 7, 4641) - 0.5) * 5, half = slitW * (0.32 + 0.5 * q), row = y * W;
        for (let x = 0; x < W; x++) {
          const dx = x - cx, d = Math.abs(dx) - half - (vn(y, dx < 0 ? 1 : 2, 4, 4642) - 0.5) * 3;
          if (d < 0) {
            // the slit: molten lips, then the burning air of the cut, and the dawn beyond it at the middle
            const e = Math.abs(dx) / Math.max(1, half), b = bay(x, y), sm = vn(x * 0.7, y - t * 30, 6, 4645);
            BUF[row + x] = e > 0.8 ? (b < 0.5 ? 104 : 105) : sm > 0.7 ? (sm > 0.8 ? 104 : 105) : e > 0.45 ? (b < 0.6 ? 106 : 105) : b < 0.5 ? 16 : 107;
            continue;
          }
          const hh = 1600 / (d + half * 0.7 + 6), far = clamp(hh / 110, 0, 1), wy = fl(oyy * 2 + (4000 - hh) * 4);
          const u = fl((y - 135) * hh / 30), tx = ((u % W) + W) % W, R = a4TexRow(dx < 0 ? 4643 : 4644, wy);
          let c = a4Lit(R[dx < 0 ? tx : W - 1 - tx], x, y, heat * (0.1 + 0.9 * far * far), 0.15 + 0.4 * far, fl(far * 3 - 1.6));
          // the lips of the walls, lit by the slit; the haze of its light on the far rock
          if (d < 1.5) c = 104; else if (d < 3.5) c = ((x + y) & 1) === 0 ? 103 : 102;
          else if (bay(x, y) < far * far * far * 0.85) c = far > 0.85 ? 103 : 102;
          BUF[row + x] = c;
        }
      }
      glow(240, LB + 10, 120, T_EMBER, 0.25 * heat);
    }
    const A4TC = 64.55;                                                     // the bolt meets his palm
    // the storm hero held in his hand (drawn inside it, between the palm and the closing fingers): squeezed, thrashing,
    // its lightning bursting out round the fingers and dying
    function a4Caught(info, t, g, S, amt) {
      const [px, py] = info.palm, vx = info.uy, vy = -info.ux, o = info.s * 11, hx = px + info.ux * 2 * info.s + vx * o + z5Sh(t, 3) * 1.6 * amt, hy = py + info.uy * 2 * info.s + vy * o + z5Sh(t * 1.3, 5) * 1.2 * amt;
      const sq = Math.min(0.5, g * 4) * (0.7 + 0.3 * Math.sin(t * 9)), kick = (k) => clamp(1.5 + Math.sin(t * 17 + k * 1.9) * 1.5 * amt, 0, 3);
      const st = g < 0.12 || (amt > 0.45 && fl(t * 20) % 3 === 0) ? 'storm' : 'plain';
      heroForm(st, { eyes: g < 0.12 || fl(t * 6) % 3 === 0 ? 'wide' : 'closed', mouth: 2, sword: -2.3 + z5Sh(t, 4) * 0.5 * amt, sq: -0.3 * sq, legs: [0, 1, 2, 3].map(kick), cracks: 0.1 + 0.25 * Math.min(1, g * 2) }, hx, hy, S, Math.atan2(vy, vx) + PI / 2 + Math.sin(t * 11) * 0.15 * amt, false, { still: true });
      return [hx, hy];
    }
    /* ONE shot from below (64.2–65.2): the bolt comes up the chasm at his face; his hand comes down into the slit, open,
       takes it, and the fingers snap shut; the fist comes on down toward us (growing, the slit widening as it passes), the
       lightning forced out between the fingers and dying as it squeezes; then the whole arm draws back on an arc and swings
       — the whip pan carries it into the wall */
    shot(64.2, 65.2, (lt, t) => {
      const u = eic(lin(64.2, A4TC, t)), hand = eoc(lin(64.28, 64.5, t)), g = t - A4TC, close = eoc(lin(A4TC - 0.02, A4TC + 0.1, t));
      const pull = eio(lin(64.6, 64.88, t)), back = eio(lin(64.8, 65.1, t)), swing = eic(lin(65.1, 65.2, t));
      a4Up(t, lerp(26, 40, pull), t * lerp(200, 120, pull), lerp(1, 0.9, pull));
      if (pull > 0) tintAll(T_DARK, 0.2 * pull);
      // his face over the slit, watching it come; he leans in as the hand goes down, and draws back with the swing
      a4Sund(240, 44 - hand * 4 + back * 8, 0.85, t, { third: 1, eyes: 1.6, heat: 0.9, crown: 0.75, body: false, nod: 2 + hand * 2 - back * 4, tilt: -0.05 * hand + 0.08 * back });
      // the hand: the catch path, then on down toward the camera, then back on an arc and hurled
      const wxC = 254 + z5N(t * 2, 3) * 3, wyC = lerp(-90, 44, hand) - z5Knock(g, 10, 16, 6), faC = PI / 2 + 0.15 - 0.1 * hand;
      const fx = 250 + back * 80 - swing * 430 + z5Sh(t, 2) * 1.5 * (1 - back), fy = 162 - Math.sin(back * PI * 0.5) * 70 + swing * 60 + z5Knock(g - 0.05, 10, 16, 5), fa = PI / 2 - 0.5 + back * 0.6 - swing * 1.2;
      const wx = lerp(wxC, fx, pull), wy = lerp(wyC, fy, pull), wa = lerp(faC, fa, pull), s = lerp(2.4, 3.4, pull) - back * 0.3;
      const palmY = wyC + Math.sin(faC) * 5.5 * 2.4, palmX = wxC + Math.cos(faC) * 5.5 * 2.4;
      // the bolt it has become: a white-blue streak from the depths, its head the hero, homing on the palm
      if (g < 0) {
        const hy = lerp(300, palmY + 16, u), hx = lerp(240, palmX, u) + Math.sin(u * 7) * 14 * (1 - u), S = lerp(2.6, 1.3, u);
        bolt(hx, hy, 240 + Math.sin(u * 3) * 30, H - LB + 10, fl(t * 30), 3, 22, 90, 0.3);
        bolt(hx, hy, 240 - Math.sin(u * 5) * 40, H - LB + 10, fl(t * 30) + 9, 1, 91, 89, 0.4);
        glow(hx, hy, 50, T_CYAN, 0.7);
        heroForm('storm', { eyes: 'glow', mouth: 2, sword: -1.5, sq: -0.35 }, hx, hy, S, -PI / 2 + 0.2, false, { still: true });
        a4Storm(hx, hy, S, t, 1, 4);
      }
      const amt = g < 0.05 ? 1 : Math.max(0, 1 - (g - 0.05) * 1.5), squeeze = Math.min(1, Math.max(0, g) * 2.5);
      const pose = a4PL(a4PL({ curl: 0.18, thumb: 0.1, spread: 1 }, { curl: 0.8, thumb: 0.7, spread: 0.2 }, close), { curl: 0.86, thumb: 0.8, spread: 0 }, pull * squeeze * (0.85 + 0.15 * Math.sin(t * 13)));
      let held = null;
      const r = hand > 0 ? a4Arm(wx, wy, s, wa, pose, lerp(0.85, 0.9, pull), t, { bend: lerp(-0.5, -0.3 + back * 0.5, pull), side: -1,
        hold: g >= 0 ? (info) => { held = a4Caught(info, t, g, lerp(1.3, 2.5, pull), amt); } : undefined }) : null;
      if (held) {
        const [hx, hy] = held;
        if (pull < 0.5) { glow(hx, hy, 70, T_CYAN, 0.6 * (1 - pull * 2)); for (let k = 0; k < 6; k++) { const a = PI / 2 + (k - 2.5) * 0.5; if (ih(k, fl(t * 20), 4620) < 1 - pull * 2) bolt(hx, hy, hx + Math.cos(a) * 70, hy + Math.sin(a) * 50, fl(t * 30) + k, 1, 91, 89); } }
        for (let k = 0; k < 7; k++) if (pull > 0.2 && ih(k, fl(t * 20), 4621) < amt + 0.1) { const a = wa - PI * 0.6 + (k / 6) * PI * 1.2, L = 30 + 90 * amt * ih(k, 2, 4621); bolt(hx, hy, hx + Math.cos(a) * L, hy + Math.sin(a) * L * 0.8, fl(t * 20) + k, k % 3 ? 1 : 2, 91, 89); }
        glow(hx, hy, 60 * amt + 14, T_CYAN, 0.22 * amt + 0.05);
      }
      if (swing > 0) { streaks(PI - 0.1, 34, t, 4000, 66, 140, 4622, [0, LB, W, H - 2 * LB]); smearArc(fx + 300, fy - 200, PI * 0.6, PI * 0.6 + swing * 0.6, 340, [96, 98, 66]); }
      if (r) z5Hit(r.palm[0], r.palm[1], g, 1.4, -PI / 2, 91, 4623);
      shk(g < 0 ? 1 + u * 2 : g < 0.3 ? 5 * (1 - g / 0.3) : swing > 0 ? 3 : 1.2);
      a4Cam(1.02 + u * 0.06 * (1 - pull) + 0.04 * back, -0.03 * back + 0.06 * swing, 240, 135, kick(t, [[A4TC, 2.2, -PI / 2]]));
    });
    WHIPS.push([65.17, PI]);
    // (the slam, 65.2, opens the beating's shot: one world, his whole body, the fist driving it into the near wall)
  
    /* ============================================================== 5 · the beating (66.0–72.0)
       Fable Mode, gold, guard up, everything it has left. A straight punch: the guard holds, the knees go. A hammer-fist: the
       guard breaks and the sword cracks. Three body blows — a hook, an uppercut, a downward drive — it folds round each one.
       It hits the ledge. It tries to get up. He puts his hand on it and presses it into the rock. */
    // a ledge of the chasm wall to stand on: its top at y (a little uneven), rubble, cracks
    // a ledge of the chasm wall to stand on: its lip lit (ash-pale, or by the fire), a band of rubble along it, the cut face
    // of the rock below in the chasm's own lit strata
    function a4Ledge(top, ox, t, lit, xr, oyT) {
      oyT = oyT || 0;
      for (let x = 0; x < W; x++) {
        const wx = x + ox;
        if (xr !== undefined && x > xr + (vn(wx, 0, 9, 4706) - 0.5) * 16) continue;
        const y0 = top + (vn(wx, 0, 30, 4701) - 0.5) * 6 + (vn(wx, 0, 6, 4703) - 0.5) * 2, tx = ((fl(wx) % W) + W) % W;
        for (let y = Math.max(LB, fl(y0)); y < H - LB; y++) {
          const d = y - y0, b = bay(x, y);
          let c;
          if (d < 1.2) c = lit ? 123 : 122;
          else if (d < 3.2) c = vn(wx, y, 3, 4704) > 0.45 ? (lit ? 122 : 121) : 100;
          else if (d < 6) c = b < 0.5 ? 121 : 99;
          else c = a4Lit(a4TexRow(4702, fl((y + oyT) * 1.3 + 900))[tx], x, y, lit ? 0.3 : 0.12, 0.25, d < 14 ? 0 : d > 40 ? -2 : -1);
          BUF[y * W + x] = c;
        }
      }
      // rubble along the lip: stones lit on top
      for (let k = 0; k < 26; k++) { const x = ((ih(k, 1, 4705) * 640 - ox) % 640 + 640) % 640 - 80; if (xr !== undefined && x > xr - 6) continue; const r = 1 + ih(k, 2, 4705) * 3.2, y = top - r * 0.5 + (vn(x + ox, 0, 30, 4701) - 0.5) * 6; discF(x, y, r, 98); discF(x - r * 0.3, y - r * 0.35, r * 0.55, lit ? 122 : 121); }
    }
    function a4Dust(x, y, g, n, spread, seed, cols) {
      if (g < 0 || g > 1) return;
      cols = cols || [122, 121, 120];
      for (let k = 0; k < n; k++) { const a = PI + ih(k, 1, seed) * PI, v = spread * (0.4 + ih(k, 2, seed)), px = x + Math.cos(a) * v * eoc(g), py = y + Math.sin(a) * v * 0.35 * eoc(g) - g * 10, r = (2 + ih(k, 3, seed) * 4) * (0.5 + g); for (let q = 0; q < r * r * 3; q++) { const dx = (ih(k, q, seed + 1) - 0.5) * 2 * r, dy = (ih(k, q, seed + 2) - 0.5) * 2 * r * 0.7; if (dx * dx + dy * dy * 2 < r * r && bay(fl(px + dx), fl(py + dy)) > g) P(px + dx, py + dy, cols[(q + k) % 3]); } }
    }
    // cracks across a held sword, from the hand to the tip (amt 0..1)
    function a4SwordCracks(hand, tip, amt, seed) {
      if (amt <= 0) return;
      const dx = tip[0] - hand[0], dy = tip[1] - hand[1], L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
      for (let k = 0; k < 4; k++) { if (ih(k, 1, seed) > amt) continue; const u = 0.3 + k * 0.16, px = hand[0] + dx * u, py = hand[1] + dy * u, w = L * 0.08; lineP(px - nx * w, py - ny * w, px + nx * w + dx * 0.03, py + ny * w + dy * 0.03, 96); P(px, py, 22); }
    }
    const A4GRD = 214;
    // a screen point → his local units (for putting a wrist exactly where a blow must land), his mask at M, scale s
    const a4Loc = (M, s, t, X, Y) => [(X - M[0]) / s, (Y - M[1] - Math.sin(t * 0.9) * s) / s];
    // where to put the wrist so the striking point of a hand (knuckles, scale s·fs, pointing a) lands on (kx, ky)
    const a4Wr = (kx, ky, a, s) => [kx - Math.cos(a) * 10.8 * s, ky - Math.sin(a) * 10.8 * s];
    // an arm between blows: never still — it drifts, and its fingers flex
    const a4Rest = (x, y, k, t, pose) => ({ x: x + z5N(t * 0.8, k) * 6, y: y + z5N(t * 0.7, k + 3) * 5, pose: a4PL(pose || 'fist', 'grab', 0.35 + 0.35 * z5N(t * 1.4, k + 7)) });
    /* key tracks: [t, value (number or array), ease into this key ('i' 'o' 'io' 'l' 'b')] */
    function a4K(K, t) {
      let i = 0; while (i < K.length - 1 && K[i + 1][0] <= t) i++;
      const A = K[i], B = K[i + 1];
      if (!B || t <= A[0]) return A[1];
      const e = EASE[B[2] || 'io'](clamp((t - A[0]) / (B[0] - A[0]), 0, 1));
      return Array.isArray(A[1]) ? A[1].map((v, j) => lerp(v, B[1][j], e)) : lerp(A[1], B[1], e);
    }
    /* time eased round the hits instead of frozen: the clock slows to 30% on the hit frame and catches up within ~0.25 s,
       so a hit still lands exactly on its frame and nothing ever stops */
    const a4Slow = (t, hits, A, w) => { A = A || 0.7; w = w || 0.07; let o = t; for (const h of hits) { const g = t - h; if (g > 0) o -= A * g * Math.exp(-g / w); } return o; };
    /* the near foreground, passing the camera faster than the world (parallax pf): broken rock at the bottom of the frame
       lit on its upper edges by the fire, ash and out-of-focus embers drifting across the lens */
    function a4FG(ox, oy, t, pf, seed, top) {
      top = top === undefined ? H - LB - 4 : top;
      for (let k = 0; k < 5; k++) {
        const w = 60 + ih(k, 1, seed) * 90, h = 10 + ih(k, 2, seed) * 22, cx = ((ih(k, 3, seed) * 900 - ox * pf) % 900 + 900) % 900 - 200, by = top - oy * (pf - 1) * 0.4 + 10;
        for (let x = Math.max(0, fl(cx - w / 2)); x < Math.min(W, cx + w / 2); x++) {
          const u = (x - cx) / w + 0.5, yt = by - h * Math.sin(u * PI) * (0.7 + 0.3 * vn(x + k * 50, 0, 7, seed + 1));
          for (let y = Math.max(LB, fl(yt)); y < H - LB; y++) BUF[y * W + x] = y - yt < 1.2 ? (u < 0.5 ? 102 : 98) : y - yt < 2.5 ? 97 : 96;
        }
      }
      for (let k = 0; k < 16; k++) {
        const z = 0.6 + ih(k, 4, seed) * 0.8, x = ((ih(k, 5, seed) * 600 - ox * pf * z - t * 30 * z) % 600 + 600) % 600 - 60, y = ((ih(k, 6, seed) * 300 - oy * pf * z + t * 40 * z) % 260 + 260) % 260 + LB - 20, r = 1 + z * 1.6;
        if (k % 4 === 0) { glow(x, y, r * 6, T_EMBER, 0.25); discF(x, y, r, 103); } else if (bay(fl(x), fl(y)) < 0.8) discF(x, y, r * 0.8, k & 1 ? 97 : 120);
      }
    }

    /* ============================================================== 5 · the beating (66.0–70.0), ONE travelling shot
       One world: the far face of the chasm, its near wall at the left, a ledge of it, and him rising out of the chasm beside
       the ledge's broken end. The camera travels with the beating — pushed in on each contact, panning with the hero as it
       is thrown, tilting up with it and down after it — and he fights with his whole body: every blow wound up with the
       mask and shoulders drawn back (lean +25..+30), driven through with all his weight (-30), carried on round, and the
       recovery already drifting into the next wind-up. 66.6 a straight punch (lower left) into the guard: it holds and
       skids · 67.4 a hammer-fist (upper left) from over his head through the guard: the sword cracks · 68.1 the same arm
       swept back across him, a backhand into its side: it is thrown into the wall and rebounds, tumbling, straight into
       68.7 an uppercut (lower left) that lifts it up the chasm · 69.3 at the top of its arc his upper right drives it down
       · 70.0 it hits the ledge (cut on the impact). Hits ease the clock, never freeze it. */
    const BS = 2.4, BY0 = A4GRD - 14 * BS, BHIT = [66.6, 67.4, 68.1, 68.7, 69.3];
    // the near wall's face (world x) at world row y, as a4Wall draws it in the beating (seed 4711); the slam's crater on it
    const a4FaceX = (y) => { const wy = fl(y + 280); return 20 + (vn(wy * 0.05, 0, 1, 4711) - 0.5) * 36 + (vn(wy * 0.21, 0, 1, 4712) - 0.5) * 9; };
    const A4SLAM = 65.2, A4SY = 104, A4CX = a4FaceX(104), A4SX = A4CX + 27;
    // the hero through the beating (world), on the eased clock T
    function a4BH(T) {
      const s = { x: 188, y: BY0, ang: -0.08, sq: 0, sw: -1.32, form: 'gold', eyes: 'angry', mouth: 1, legs: undefined, cracks: 0, reach: 1 };
      if (T < 65.56) {
        // the slam: crushed into the wall inside his fist, its storm stuttering out
        const g = Math.max(0, T - A4SLAM);
        s.x = A4SX + z5Sh(T, 6) * 0.8; s.y = A4SY; s.form = g < 0.3 && fl(T * 15) % 3 === 0 ? 'storm' : 'plain'; s.eyes = 'closed'; s.mouth = 2;
        s.sw = -2.4; s.sq = -0.35 - 0.2 * Math.exp(-g * 8); s.legs = z5Limp(T, 1.5); s.cracks = 0.25; s.ang = -0.12;
      } else if (T < 66.12) {
        // let go: it peels off the crater and drops down the wall to the ledge
        const f = (T - 65.56) / 0.56;
        s.x = A4SX + 30 * eoc(f); s.y = lerp(A4SY, BY0, f * f); s.form = 'plain'; s.eyes = 'closed'; s.mouth = 2;
        s.sw = lerp(-2.4, 0.5, eio(f)); s.sq = -0.25 * (1 - f); s.legs = z5Limp(T, 1.5); s.cracks = 0.25; s.ang = -0.12 + 0.5 * f;
      } else if (T < 66.6) {
        // it lands, comes up gold with its guard up, and charges him — straight into the punch
        const ld = T - 66.12, ch = eio(lin(66.3, 66.6, T));
        s.x = lerp(A4SX + 30, 188, ch) + a4Tw(T, 5) * 0.4 * (1 - ch); s.y = BY0 - 3 * Math.sin(ch * PI);
        s.sq = 0.4 * Math.exp(-ld * 11) - 0.1 * Math.sin(ch * PI); s.sw = lerp(0.5, -1.32, eoc(clamp(ld / 0.22, 0, 1))); s.eyes = ld < 0.1 ? 'closed' : 'angry'; s.form = ld < 0.03 ? 'plain' : 'gold';
        s.legs = ld < 0.2 ? [0, 1.5 * (1 - ld / 0.2), 1.5 * (1 - ld / 0.2), 0] : ch > 0 && ch < 1 ? [0, 1, 2, 3].map((k) => Math.max(0, Math.sin(T * 40 + k * 1.6)) * 2) : undefined; s.ang = -0.1 * Math.sin(ch * PI);
      } else if (T < 67.4) {
        const g = T - 66.6, sk = eoc(Math.min(1, g / 0.36)), rec = sstep(0.5, 0.75, g), buckle = 0.22 * sstep(0.08, 0.3, g) * (1 - rec) + z5Knock(g - 0.08, 0.2, 13, 4);
        s.x = 188 - 64 * sk + a4Tw(T, 5) * 0.8;
        s.sq = g < 0.034 ? -0.38 : -0.38 * Math.exp(-g * 14) + buckle; s.y = BY0 + Math.max(0, s.sq) * 8;
        s.eyes = g < 0.25 ? 'closed' : 'angry'; s.mouth = 2;
        s.sw = lerp(-1.32 - z5Knock(g, 0.35, 16, 6), -1.2, sstep(0.45, 0.7, g));
        const lg = 1.5 * sstep(0, 0.3, g) * (1 - rec); s.legs = [0, lg, lg, 0]; s.ang = -0.08 - z5Knock(g, 0.2, 14, 5);
      } else if (T < 68.1) {
        const g = T - 67.4, up = sstep(0.35, 0.65, g);
        s.x = 124 + z5Knock(g, -6, 12, 5); s.y = BY0 + 10 * sstep(0, 0.2, g) * (1 - up) + z5Knock(g, 8, 14, 5) + 3 * up;
        s.sw = lerp(lerp(-1.2, 1.15, eoc(Math.min(1, g / 0.12))) + z5Knock(g - 0.12, 0.2, 14, 5), 0.9, up);
        s.sq = g < 0.034 ? 0.5 : (0.42 * sstep(0, 0.15, g) + z5Knock(g - 0.06, 0.12, 16, 6)) * (1 - up) + 0.12 * up;
        s.form = g > 0.25 && fl(T * 15) % 4 === 0 ? 'plain' : 'gold'; s.eyes = g < 0.3 ? 'closed' : 'wide'; s.mouth = 2; s.reach = 3;
        s.legs = [lerp(1, 0, up), 3 - 2 * up, 3 - 2 * up, 0]; s.cracks = 0.2; s.ang = 0.12 * (1 - up) + a4Tw(T, 6) * 0.02;
      } else if (T < 68.7) {
        // the backhand: into the wall, and back off it, tumbling
        const g = T - 68.1, w = eoc(Math.min(1, g / 0.12)), r = eoc(clamp((g - 0.12) / 0.48, 0, 1)), wall = g > 0.12;
        s.x = wall ? lerp(48, 230, r) : lerp(124, 48, w); s.y = BY0 + 3 - (wall ? Math.sin(r * PI) * 34 + 8 * r : 6 * w);
        s.sq = g < 0.034 ? -0.5 : !wall ? -0.45 : -0.55 * Math.exp(-(g - 0.12) * 9) + 0.12 * Math.sin(r * PI);
        s.ang = wall ? -0.6 + r * (TAU + 1.2) : -0.6 * w; s.form = g < 0.06 ? 'gold' : 'plain';
        s.eyes = 'closed'; s.mouth = 2; s.reach = 3; s.legs = z5Limp(T, 1.5); s.cracks = 0.3; s.sw = lerp(1.0, 2.2, r);
      } else if (T < 69.3) {
        // the uppercut: folded over the fist, then thrown up the chasm, stretched, turning over
        const g = T - 68.7, up = eoc(Math.min(1, g / 0.55));
        s.x = 230 + 50 * up; s.y = BY0 - 5 - 150 * up;
        s.sq = g < 0.034 ? 0.55 : g < 0.07 ? 0.45 : -0.35 * Math.exp(-(g - 0.07) * 5);
        s.ang = g < 0.034 ? 0.6 : 0.6 - 0.9 * up - 2.0 * up * up; s.form = 'plain'; s.eyes = 'closed'; s.mouth = 2; s.reach = 3; s.legs = z5Limp(T, 2); s.cracks = 0.35; s.sw = 2.0 + 1.0 * up;
      } else {
        // the drive: knocked out of the top of its arc down onto the ledge
        const g = T - 69.3, fu = Math.min(1, g / 0.7), fall = 0.55 * fu + 0.45 * fu * fu;
        s.x = lerp(280, 150, fall); s.y = lerp(BY0 - 155, A4GRD - 14 * BS * 0.6, fall);
        s.sq = g < 0.034 ? 0.45 : -0.3 * (1 - fall * 0.5); s.ang = lerp(-0.7, 0.08, fall); s.form = 'plain'; s.eyes = 'closed'; s.mouth = 2; s.reach = 3; s.legs = z5Limp(T, 2); s.cracks = 0.45; s.sw = 2.4;
      }
      return s;
    }
    // the points of contact (world), from the hero at each hit
    const BC = BHIT.map((h, i) => { const s = a4BH(h); return i === 0 ? [s.x + 15 * BS + 2, s.y - 3 * BS] : i === 1 ? [s.x + 15 * BS + Math.cos(-1.2) * 18 * BS, s.y - 2 * BS + Math.sin(-1.2) * 18 * BS] : i === 2 ? [s.x + 10 * BS, s.y + 2 * BS] : i === 3 ? [s.x - 4, s.y + 13] : [s.x + 9 * BS, s.y - 6 * BS]; });
    // his knuckles (world x, y, the fist's angle); ['C', i, dx, dy, ang] is contact i (plus dx, dy)
    const BAK = [
      // upper left: braced · raised high over his head · the hammer · onto its head · back up and across him · the backhand · round · settle
      [[65.2, [A4SX - 2, A4SY + 2, PI + 0.08]], [65.42, [A4SX + 2, A4SY + 2, PI + 0.1], 'o'], [65.62, [A4SX + 70, A4SY - 30, PI - 0.5], 'io'], [66.0, [296, 176, 2.0], 'io'], [66.6, [306, 166, 2.1]], [66.95, [300, 70, -1.0], 'io'], [67.22, [236, -6, -PI / 2 + 0.5], 'o'], [67.4, ['C', 1, 0, 0, PI / 2 + 0.08], 'i'], [67.52, ['C', 1, -4, 30, PI / 2 + 0.1], 'o'],
        [67.76, [300, 64, 0.7], 'io'], [67.96, [424, 146, PI - 0.1], 'io'], [68.1, ['C', 2, 0, 0, PI], 'i'], [68.24, [96, 204, PI - 0.25], 'o'], [68.62, [290, 176, 2.0], 'io'], [70.0, [300, 160, 2.0]]],
      // upper right: hangs back, swaying; drawn up high behind his head; the drive; carried through; back
      [[65.2, [470, 196, 1.5]], [65.6, [500, 220, 1.4]], [66.0, [520, 216, 1.4]], [67.4, [540, 196, 1.3]], [68.1, [500, 226, 1.6]], [68.76, [506, 206, 1.5]], [69.08, [474, -70, -1.0], 'io'], [69.3, ['C', 4, 0, 0, PI * 0.75], 'i'], [69.46, ['C', 4, -44, 44, PI * 0.75], 'o'], [69.9, [470, 140, 1.7], 'io'], [70.0, [470, 140, 1.7]]],
      // lower left: cocked back past his hip · the straight punch · through it · down · drawn low under the ledge · the uppercut · up after it · back
      [[65.2, [300, 226, 2.5]], [65.7, [350, 240, 2.4]], [66.0, [372, 236, 2.3]], [66.42, [406, 150, PI - 0.05], 'io'], [66.6, ['C', 0, 0, 0, PI - 0.05], 'i'], [66.78, [194, 178, PI - 0.05], 'o'], [67.15, [330, 222, 2.5], 'io'], [68.2, [350, 234, 2.4]],
        [68.5, [296, 300, -PI / 2 + 0.3], 'io'], [68.7, ['C', 3, 0, 0, -PI / 2 + 0.06], 'i'], [68.86, ['C', 3, -6, -46, -PI / 2], 'o'], [69.25, [366, 232, 2.3], 'io'], [70.0, [372, 236, 2.3]]],
      // lower right: swings against the blows (the counterweight)
      [[65.2, [560, 214, 1.1]], [65.6, [520, 246, 1.3]], [66.0, [536, 240, 1.3]], [66.6, [580, 220, 1.0]], [67.0, [540, 244, 1.3]], [67.4, [590, 210, 0.9]], [67.8, [540, 240, 1.3]], [68.1, [470, 250, 1.8]], [68.4, [560, 236, 1.2]], [68.7, [570, 200, 1.0]], [69.3, [590, 220, 0.9]], [69.7, [540, 240, 1.3]]],
    ];
    function a4BArm(k, T) {
      const K = BAK[k], pt = (v) => (v[0] === 'C' ? [BC[v[1]][0] + v[2], BC[v[1]][1] + v[3], v[4]] : v);
      let i = 0; while (i < K.length - 1 && K[i + 1][0] <= T) i++;
      const A = pt(K[i][1]), B = K[i + 1];
      if (!B || T <= K[i][0]) return A;
      const e = EASE[B[2] || 'io'](clamp((T - K[i][0]) / (B[0] - K[i][0]), 0, 1)), Bv = pt(B[1]);
      return [lerp(A[0], Bv[0], e), lerp(A[1], Bv[1], e), lerp(A[2], Bv[2], e)];
    }
    // his mask (world): he steps in to each blow and drops his weight into the hammer and the drive
    const BMK = [[65.2, [372, 80]], [65.45, [380, 78]], [65.8, [430, 64]], [66.0, [452, 62]], [66.42, [464, 56]], [66.6, [436, 66], 'i'], [67.0, [442, 54]], [67.22, [450, 40]], [67.4, [418, 74], 'i'], [67.8, [428, 62]], [67.96, [440, 58]], [68.1, [412, 68], 'i'], [68.4, [432, 60]], [68.6, [420, 62]], [68.7, [414, 50], 'i'], [69.08, [412, 38]], [69.3, [384, 70], 'i'], [69.7, [396, 64]], [70.0, [404, 64]]];
    const BLEAN = [[65.2, -30], [65.42, -26], [65.75, -4, 'o'], [66.0, 0], [66.42, 25], [66.6, -30, 'i'], [66.85, -14, 'o'], [67.22, 22], [67.4, -32, 'i'], [67.7, -8, 'o'], [67.96, 26], [68.1, -24, 'i'], [68.35, -30, 'o'], [68.55, -6], [68.7, -18, 'i'], [68.85, 4, 'o'], [69.08, 24], [69.3, -30, 'i'], [69.6, -12, 'o'], [70.0, 0]];
    const BNOD = [[65.2, 8], [65.45, 6], [65.8, 1], [66.0, 0], [66.42, -5], [66.6, 7, 'i'], [66.9, 2], [67.22, -8], [67.4, 10, 'i'], [67.8, 2], [67.96, -4], [68.1, 5, 'i'], [68.5, 0], [68.7, -8, 'i'], [69.08, -6], [69.3, 10, 'i'], [69.7, 3], [70.0, 2]];
    const BTILT = [[65.2, 0.08], [65.6, 0.02], [66.0, 0], [66.42, -0.08], [66.6, 0.06, 'i'], [67.22, 0.08], [67.4, -0.1, 'i'], [67.96, 0.12], [68.1, -0.1, 'i'], [68.4, -0.14, 'o'], [68.7, 0.06], [69.08, -0.06], [69.3, 0.1, 'i'], [70.0, 0]];
    // the camera (world point at the frame centre, zoom, roll): a beat behind the action, pushed in on each contact
    const BCAM = [[65.2, [160, 116]], [65.42, [166, 118]], [65.8, [206, 130]], [66.1, [222, 136]], [66.5, [252, 142]], [66.62, [246, 144], 'o'], [67.0, [226, 108]], [67.25, [222, 90]], [67.42, [212, 138], 'i'], [67.8, [204, 140]], [68.1, [184, 140]], [68.26, [148, 142], 'o'], [68.7, [236, 132]], [69.0, [290, 72]], [69.3, [296, 62]], [69.7, [226, 118]], [70.0, [186, 150], 'i']];
    const BZ = [[65.2, 1.2], [65.42, 1.17], [65.9, 1.03], [66.2, 1.0], [66.6, 1.08, 'i'], [67.0, 1.0], [67.4, 1.1, 'i'], [67.85, 1.02], [68.1, 1.06], [68.24, 1.1], [68.7, 1.03], [69.0, 1.0], [69.3, 1.06], [69.7, 1.02], [70.0, 1.1]];
    const BROLL = [[65.2, -0.03], [65.6, 0.01], [66.0, 0], [66.6, 0.02], [67.2, -0.03], [67.4, 0.03, 'i'], [68.1, -0.03], [68.3, -0.05], [68.7, 0.02], [69.1, 0.05], [69.4, -0.03], [70.0, 0]];
    const BSTRIKER = (T) => (T < 65.56 ? 0 : T < 67.1 ? 2 : T < 68.55 ? 0 : T < 69.0 ? 2 : 1);
    shot(A4SLAM, 70.0, (lt, t) => {
      const T = a4Slow(t, BHIT), [cx, cy] = a4K(BCAM, t), ox = cx - 240, oy = cy - 135, SX = (x) => x - ox, SY = (y) => y - oy;
      // the world: the far face (half parallax), the near wall, the ledge (ending in a broken lip beside him)
      a4Deep(260 + oy * 0.5, t, 0.7, 1200, ox * 0.5);
      a4Wall(-1, SX(20), 280 + oy, t, 0.6, 1200, 4711, true, ox);
      a4Ledge(SY(A4GRD), ox, t, true, SX(336), oy);
      a4Embers(t, 34, -22, 4719, [104, 102]);
      // what the blows leave: the skid scored into the ledge, the crushed rock under the hammer, the crater in the wall
      for (const [h, x, y, n, L, sd] of [[66.6, 160, A4GRD, 5, 50, 4790], [67.4, 124, A4GRD, 8, 80, 4791], [69.98, 150, A4GRD, 9, 100, 4792]]) { const g = t - h; if (g > 0) groundCracks(SX(x), SY(y), L * Math.min(1, g * 6), n, sd, g < 0.6 ? 104 : 102, 99); }
      if (t > 66.6) { const sk = Math.min(1, (t - 66.6) / 0.36); for (let k = 0; k < 2; k++) lineP(SX(188 - 64 * sk - 26), SY(A4GRD) - 1 + k, SX(188 - 2), SY(A4GRD) - 1 + k, k ? 99 : 123); }
      { const g = t - 68.22; if (g > 0) { const wx = SX(40), wy = SY(BY0 - 4), cr = 26 * eoc(Math.min(1, g * 8)); for (let k = 0; k < 10; k++) { const a = -PI / 2 + (k / 9 - 0.5) * PI * 1.1 + ih(k, 1, 4793) * 0.3, L = cr + 20 + ih(k, 2, 4793) * 50; lineF(wx, wy, wx + Math.cos(a) * L, wy + Math.sin(a) * L, (x, y, u) => { if (u > 0.4) P(x, y, u < 0.6 ? 104 : 102); }); } discF(wx, wy, cr * 0.6, 96); ring(wx, wy, cr * 0.6, cr * 0.6, g < 0.5 ? 104 : 102); } }
      // the slam's crater in the near wall: a dish of shattered rock, its rim burning, cracks running out over the face
      { const g = t - A4SLAM, wx = SX(A4CX + 4), wy = SY(A4SY), cr = 30 * eoc(Math.min(1, g * 8)), hot = g < 1.2 ? 104 : 102;
        for (let k = 0; k < 12; k++) { const a = PI / 2 + (k / 11) * PI + (ih(k, 1, 4632) - 0.5) * 0.3, L = cr + 16 + ih(k, 2, 4632) * 70 * Math.min(1, g * 5); let x = wx, y = wy; for (let q = 0; q < 5; q++) { const nx = x + Math.cos(a + (ih(k, q, 4633) - 0.5) * 0.8) * L / 5, ny = y + Math.sin(a + (ih(k, q, 4633) - 0.5) * 0.8) * L / 5; if (Math.hypot(nx - wx, ny - wy) > cr * 0.9) { lineP(x, y, nx, ny, q < 2 ? hot : 102); lineP(x + 1, y + 1, nx + 1, ny + 1, 96); } x = nx; y = ny; } }
        for (let y = fl(wy - cr); y < wy + cr; y++) for (let x = fl(wx - cr * 0.8); x < wx + cr * 0.35; x++) { const d = Math.hypot((x - wx) / (cr * 0.8), (y - wy) / cr); if (d < 1) P(x, y, d > 0.84 ? (bay(x, y) < 0.5 ? hot : 99) : d > 0.55 ? (y < wy ? 98 : 97) : 96); } }
      // him
      const Mw = a4K(BMK, T), s = 1.45, fs = 1.3, H_ = a4BH(T), str = BSTRIKER(T);
      let drawn = false;
      const drawHero = () => {
        if (drawn) return; drawn = true;
        const hx = SX(H_.x), hy = SY(H_.y);
        // his fire on its near side, its own light on him
        glow(hx + 10, hy, 40, T_EMBER, 0.18);
        heroForm(H_.form, { eyes: H_.eyes, mouth: H_.mouth, sword: H_.sw, sq: H_.sq, reach: H_.reach, legs: H_.legs, cracks: H_.cracks }, hx, hy, BS, H_.ang, false, {});
        if (H_.form === 'storm') a4Storm(hx, hy, BS, t, 0.5, 2);
        if (H_.form === 'gold') glow(hx, hy, 46, T_GOLD, 0.14);
      };
      const arms = [0, 1, 2, 3].map((k) => {
        // the slam's fist: big on it, grinding it into the rock, then opening and drawing back to his size
        const sl = k === 0 && T < 66.0, fsk = sl ? lerp(2.0, fs, eio(lin(65.45, 66.0, T))) : fs, opn = sl ? eoc(lin(65.42, 65.56, T)) * (1 - eio(lin(65.62, 65.95, T))) : 0;
        let [kx, ky, a] = a4BArm(k, T);
        if (sl && T < 65.5) { kx += z5Knock(T - A4SLAM, -9, 20, 7) + z5Sh(t, 4) * 1.8 * (1 - opn); ky += z5Sh(t * 1.2, 9) * 0.9; }
        const [wx, wy] = a4Wr(kx, ky, a, s * fsk);
        const lx = (wx - Mw[0]) / s, ly = (wy - Mw[1] - Math.sin(t * 0.9) * s) / s, live = k === 3 || (k === 1 && T < 68.8) ? 1 : 0;
        const A = { x: lx + z5N(t * 0.8, k) * 4 * live, y: ly + z5N(t * 0.7, k + 3) * 3 * live, ang: a, fs: fsk, pose: sl ? a4PL({ curl: 0.92, thumb: 0.85, spread: 0 }, { curl: 0.15, thumb: 0.1, spread: 0.9 }, opn) : live ? a4PL('fist', 'grab', 0.3 + 0.3 * z5N(t * 1.4, k + 7)) : 'fist', front: k === str || sl };
        if (k === str) A.hold = drawHero;
        return A;
      });
      const so = a4Sund(SX(Mw[0]), SY(Mw[1]), s, t, { third: 1, eyes: 1.3, heat: 0.85, crown: 0.75, core: 1, rage: 0.25 + 0.25 * Math.max(0, -a4K(BLEAN, T) / 30), lean: a4K(BLEAN, T), nod: a4K(BNOD, T), tilt: a4K(BTILT, T), arms });
      drawHero();
      // the hero's light on the fist that is about to hit it
      const fk = so.hands[str]; if (fk && Math.hypot(fk[0] - SX(H_.x), fk[1] - SY(H_.y)) < 90) glow(fk[0], fk[1], 30, T_GOLD, 0.15);
      // the blows: speed lines along each strike; at each contact the hit, debris, dust
      const SW = [[66.42, 66.6, PI], [67.22, 67.4, PI / 2], [67.96, 68.1, PI], [68.5, 68.7, -PI / 2], [69.08, 69.3, PI * 0.75]];
      for (const [a0, a1, d] of SW) if (T > a0 + 0.06 && T < a1) streaks(d, 22, t, 3400, 66, 120, 4794 + fl(a0 * 10), [0, LB, W, H - 2 * LB]);
      const HP = [1.7, 2.6, 1.8, 2.0, 2.6], HC = [[22, 59, 58], [22, 59, 58], [22, 37, 35], [22, 37, 35], [22, 37, 35]];
      BHIT.forEach((h, i) => { const g = t - h; if (g < 0 || g > 1.2) return; const [x, y] = [SX(BC[i][0]), SY(BC[i][1])]; megaHit(x, y, g, HP[i], [PI, PI / 2, PI, -PI / 2, PI * 0.75][i], HC[i], 4795 + i * 3); z5Hit(x, y, g, 1.4, [PI, PI / 2, PI, -PI / 2, PI * 0.75][i], HC[i][1], 4796 + i * 3); });
      { const g = t - A4SLAM; if (g < 1.2) { const x = SX(A4CX + 8), y = SY(A4SY); megaHit(x, y, g, 2.4, 0, [22, 106, 103], 4635); rocks(x, y, g, 30, 300, 4, [97, 99, 122, 105], 4634, 260, 0, 1.7); a4Dust(x + 10, y + 24, g, 8, 70, 4636); } }
      a4Dust(SX(160), SY(A4GRD), t - 66.6, 6, 60, 4713); a4Dust(SX(124), SY(A4GRD), t - 67.4, 9, 80, 4725);
      { const g = t - 68.22; if (g > 0 && g < 1.2) { rocks(SX(40), SY(BY0), g, 20, 220, 3, [97, 99, 122, 123], 4797, 300, 0, 1.6); megaHit(SX(40), SY(BY0 - 4), g, 1.5, 0, [22, 122, 99], 4798); } }
      // the hammer bursts the ledge's lip; the uppercut throws the grit of the ledge up after it
      rocks(SX(140), SY(A4GRD), t - 67.4, 16, 200, 3, [97, 99, 122, 123], 4799, 400, -PI / 2, 2.0);
      rocks(SX(230), SY(A4GRD), t - 68.7, 14, 260, 2, [97, 99, 122, 104], 4800, 300, -PI / 2, 0.8);
      a4FG(ox, oy, t, 1.6, 4801);
      const tz = [A4SLAM, ...BHIT].find((h) => t >= h && t - h < 0.4), sh = tz ? (tz === A4SLAM ? 8 : 7) * (1 - (t - tz) / 0.4) : 0.5;
      shk(sh);
      a4Cam(a4K(BZ, t), a4K(BROLL, t), 240, 135, kick(t, [[A4SLAM, 3, PI], ...BHIT.map((h, i) => [h, [2, 2.4, 2.2, 2.4, 2.4][i], [PI, PI / 2, PI, -PI / 2, PI * 0.75][i]])]));
    });
  
    // 70.0–72.0 on the ledge, close and low: it tries to get up on its sword, and can't; a shadow; his hand comes down on it
    // and presses it into the rock: the palm flattens on its back, the fingers splay out over the stone, the stone cracks
    // round the fingertips; and he keeps pressing (it squirms under the hand)
    const A4PIN = [182, 196];                                     // where the hero lies pinned (72–77 reuse it)
    function a4PinScene(t, press, crack) {
      a4Deep(700, t, 0.45, 1400);
      a4Wall(1, 430, 720, t, 0.45, 1400, 4761, false);
      a4Ledge(214, 200, t, true);
      if (crack > 0) { groundCracks(A4PIN[0], 214, 90 * crack, 9, 4762, 104, 99); groundCracks(A4PIN[0] + 4, 215, 60 * crack, 6, 4763, 102, 98); }
    }
    // the pressing hand: palm on its back, angled down to the right so the fingertips reach the stone beyond it
    const A4PA = 0.4, A4PS = 3.0;
    function a4PinHand(t, hy, down, press, o) {
      o = o || {};
      // the heel of the palm on the stone behind it, the splayed fingers across its back (it shows between them)
      const px = A4PIN[0] - 44, py = hy - 6 * 3.2, pal = 5.5 * A4PS, wx = px - Math.cos(A4PA) * pal + (o.dx || 0), wy = lerp(-150, py - Math.sin(A4PA) * pal, down) + (o.dy || 0);
      const flex = 0.04 * z5N(t * 2.2, 5);
      const pose = a4PL({ curl: 0.38, thumb: 0.3, spread: 0.45 }, { curls: [0.08 + flex, 0.1 - flex, 0.12 + flex, 0.16], thumb: 0.1, spread: 1 }, press);
      return a4Arm(wx, wy, A4PS, A4PA + (o.da || 0), pose, 0.9, t, { bend: -0.6, side: -1 });
    }
    shot(70.0, 72.0, (lt, t) => {
      const g = t - 71.4, hitv = g > 0, down = eic(lin(71.2, 71.4, t)), shade = sstep(71.0, 71.38, t), press = eoc(lin(71.38, 71.52, t));
      a4PinScene(t, 0, hitv ? Math.min(1, g * 5) : 0);
      const S = 3.2, base = 214 - 14 * S;
      // the landing it was driven into (the cut is on its impact): it bounces once and lies there
      const g0 = t - 70.0, bnc = g0 < 0.45 ? Math.abs(Math.sin(g0 / 0.45 * PI)) * 9 * Math.exp(-g0 * 3) : 0;
      if (g0 < 1.2) { megaHit(A4PIN[0], 214, g0, 1.6, -PI / 2, [22, 122, 99], 4755); a4Dust(A4PIN[0], 214, g0, 10, 90, 4756); rocks(A4PIN[0], 214, g0, 14, 160, 3, [97, 99, 122, 123], 4757, 400, -PI / 2, 1.8); }
      // the attempts: up on the sword, trembling, the arm gives; again, less
      const up1 = eio(lin(70.3, 70.85, t)) * (1 - eic(lin(70.88, 70.98, t))), up2 = eio(lin(71.02, 71.3, t)) * 0.35 * (1 - (hitv ? 1 : 0));
      const up = Math.max(up1, up2), tr = a4Tw(t, 8) * (0.4 + up * 1.6);
      const squirm = hitv ? sstep(0.35, 0.6, g) : 0;
      const sq = hitv ? (g < 0.05 ? 0.75 : 0.62 + 0.06 * sstep(0, 0.5, g) + 0.04 * Math.sin(t * 7) * squirm) : 0.38 * (1 - up);
      const hx = A4PIN[0] + tr * 0.6 + squirm * Math.sin(t * 5) * 1.5, hy = base + 12 * (1 - up) + (hitv ? 5 + 3 * sstep(0, 0.4, g) : 0) + tr * 0.3 - bnc;
      const lookUp = !hitv && t > 71.12;
      const a = actor(HERO3({ eyes: hitv ? (g < 0.3 ? 'closed' : 'wide') : lookUp ? 'wide' : up > 0.2 ? 'narrow' : 'closed', mouth: hitv ? 2 : up > 0.3 ? 1 : 0, sword: hitv ? 0.15 + 0.1 * squirm * Math.sin(t * 6) : lerp(0.25, 1.45, up), sq, reach: up > 0.2 ? 2 : 0, legs: hitv ? [3, 3 - squirm * Math.max(0, Math.sin(t * 9)), 3, 3] : [3 - up * 2.2, 3 - up * 2, 3 - up * 2, 3 - up * 2.2], cracks: hitv ? 0.6 : 0.5 }), hx, hy, S, hitv ? 0.02 : -0.06 * up + 0.04, false, { bob: 0 });
      if (up1 > 0.4 && !hitv) for (let k = 0; k < 4; k++) { const x = a.tip[0] + (ih(k, fl(t * 12), 4764) - 0.5) * 8, y = 214 - ih(k, fl(t * 12) + 1, 4764) * 4; P(x, y, 123); }
      // the light goes: his shadow, grit falling out of it
      if (shade > 0) { for (let y = LB; y < H - LB; y++) { const k = shade * clamp(1.1 - (y - LB) / 200, 0, 1) * 0.7; if (k > 0.02) for (let x = 0; x < W; x++) tintI(y * W + x, x, y, T_DARK, k); } for (let k = 0; k < 30; k++) { const q = frac(ih(k, 1, 4765) + t * 1.5), x = 60 + ih(k, 2, 4765) * 300, y = LB + q * 190; if (q < shade) P(x, y, 122); } }
      // the hand: down, relaxed, then flattening on the hit frame (spread, straightened), a pump of weight, a slow grind
      const pump = hitv ? 4 * sstep(0, 0.5, g) + z5Knock(g, 5, 14, 5) + z5Sh(t, 3) * 1.0 + squirm * Math.sin(t * 5) * 1.2 : 0;
      if (down > 0) {
        const r = a4PinHand(t, hy, down, press, { dy: pump, da: hitv ? Math.sin(g * 4) * 0.02 : -0.15 * (1 - down) });
        // the stone cracks round the fingertips
        if (hitv) for (let k = 0; k < 4; k++) { const fx = r.tip[0] + (r[0] - r.tip[0]) * k / 3 + 6, fy = 214; groundCracks(fx, fy, 34 * Math.min(1, g * 6), 4, 4769 + k, 103, 99); }
      }
      if (down > 0.2 && !hitv) streaks(PI / 2, 26, t, 3600, 66, 120, 4766, [A4PIN[0] - 160, LB, 240, H - 2 * LB]);
      if (hitv) { megaHit(hx, 214, g, 2.4, -PI / 2, [22, 106, 103], 4767); a4Dust(hx, 214, g, 12, 110, 4768); rocks(hx + 40, 214, g, 16, 200, 3, [97, 99, 122, 123], 4769, 400, -PI / 2, 2.4); }
      shk(hitv ? (g < 0.5 ? 8 * (1 - g / 0.5) : 0.8) : 0.2);
      a4Cam(1.06 + 0.04 * lt / 2, 0, 230, 150, kick(t, [[71.4, 2.6, PI / 2]]));
    });

    /* ============================================================== 6 · the orbs (72.0–77.0)
       Pinned under one hand, it watches the other take the four orbs out of its halo one at a time and crush them: water
       (73.0) spills through his fingers like rain on its face; leaf (74.0) bursts into leaves that wither to ash as they fall;
       lightning (75.0) lashes once between his knuckles and is gone; starlight (76.0), the last, it reaches for — "NO—!" —
       and he crushes it in front of its eyes, and the stars go out one by one. The world loses its colour with each. */
    const A4OT = [73.0, 74.0, 75.0, 76.0], ELC = [[45, 46, 47, 119], [48, 49, 50, 26], [51, 52, 53, 22], [54, 55, 56, 57]];
    const a4OrbPos = (k, t, cx, cy) => { const a = t * 1.1 + k * TAU / 4; return [cx + 20 + Math.cos(a) * 52, cy - 34 + Math.sin(a) * 16, Math.sin(a)]; };
    shot(72.0, 77.0, (lt, t) => {
      let K = 0; while (K < 3 && t > A4OT[K] + 0.15) K++;
      const T = A4OT[K], reach = eio(lin(T - 0.85, T - 0.55, t)), lift = eio(lin(T - 0.55, T - 0.12, t)), sq = eic(lin(T - 0.12, T, t)), g = t - T;
      const drained = A4OT.filter((x) => t >= x).length;
      a4PinScene(t, 1, 1);
      const S = 3.2, base = 214 - 14 * S, hx = A4PIN[0] + a4Tw(t, 9) * 0.5, hy = base + 8 + z5Knocks(t, A4OT, 3, 16, 6);
      const strain = K === 3 ? eio(lin(75.6, 76.15, t)) * (1 - sstep(76.3, 76.9, t) * 0.7) : 0;
      // the halo: the orbs not yet taken still orbit it, dim
      const live = [0, 1, 2, 3].map((k) => (k > K || (k === K && t < T - 0.6) ? 1 : 0));
      for (let k = 0; k < 4; k++) { if (!live[k]) continue; const [x, y, z] = a4OrbPos(k, t, hx, hy); if (z < 0) a4Orb(x, y, k, 6.5, 0.9); }
      const a = actor(HERO3({ eyes: g >= 0 && g < 0.3 ? 'closed' : 'wide', mouth: strain > 0.2 || (g >= 0 && g < 0.4) ? 2 : 1, sword: 0.15 - strain * 0.5, sq: 0.66 - strain * 0.12, reach: 1 + strain * 3, legs: [3, 3, 3, 3], cracks: 0.6 + drained * 0.07 }), hx + strain * 6, hy - strain * 3, S, -0.04 - strain * 0.1, false, { bob: 0 });
      for (let k = 0; k < 4; k++) { if (!live[k]) continue; const [x, y, z] = a4OrbPos(k, t, hx, hy); if (z >= 0) a4Orb(x, y, k, 6.5, 0.9); }
      // the pinning hand on its back: it never lets up — it grinds, and bears down when it strains
      a4PinHand(t, hy, 1, 1, { dy: z5Sh(t, 3) * 0.9 + 3 * strain, da: Math.sin(t * 1.3) * 0.02 });
      // the taking hand, from the upper right: down to the orb on its orbit, fingers open; they close round it (four
      // frames); up in front of its eyes, held there pinched; the fingers crush shut on it; then they open on what is left
      const [ox, oy] = a4OrbPos(K, Math.min(t, T - 0.6), hx, hy), FS = 2.2, GR = 9.5 * FS;
      const grab = eoc(lin(T - 0.6, T - 0.48, t)), after = K === 3 ? 0 : eio(lin(T + 0.32, T + 0.6, t));
      const fa = PI * 0.66 - lift * 0.12 - sq * 0.06, ux = Math.cos(fa), uy = Math.sin(fa);
      const rest = [430, 30 + Math.sin(t) * 4], top = [hx + 74 + z5N(t, 4) * 3, hy - 62 + z5N(t * 1.2, 6) * 2];
      let gx = lerp(rest[0], ox, reach), gy = lerp(rest[1], oy, reach);
      gx = lerp(gx, top[0], lift); gy = lerp(gy, top[1], lift);
      if (K === 3 && g > 0.3) { const back = eio(lin(T + 0.3, T + 1.0, t)); gx += back * 30; gy -= back * 20; }
      gx += z5Knock(g, 4, 18, 5); gy += z5Knock(g, 5, 18, 5) + (sq > 0 ? z5Sh(t, 4) * 1.5 * sq : 0);
      const held = grab > 0 && g < 0.02;
      const orbP = held ? [gx, gy] : [ox, oy];
      // the thread of its light from its chest to the orb, stretching till it snaps
      if (held && lift < 0.6) lineF(hx + 10, hy - 6, orbP[0], orbP[1], (x, y, u) => { if (bay(x, y) < 0.9 - Math.abs(u - 0.5) - lift) P(x, y + Math.sin(u * 12 + t * 30) * 2 * lift, ELC[K][2]); });
      const flex = 0.05 * z5N(t * 2, 9) * lift;
      let pose = a4PL({ curl: 0.3, thumb: 0.2, spread: 0.9 }, { curl: 0.56 + flex, thumb: 0.62, spread: 0.3 }, grab);
      if (sq > 0 || g >= 0) pose = a4PL(pose, 'fist', g >= 0 ? 1 : sq);
      if (after > 0) pose = a4PL(pose, { curl: 0.3, thumb: 0.2, spread: 0.7 }, after);
      const r_ = a4Arm(gx - ux * GR, gy - uy * GR, FS, fa, pose, 0.9, t, { bend: 0.6, side: 1, hold: held ? () => {
        // inside his hand: it burns brighter, as if it knew, and is crushed out of shape as the fingers shut
        const r = (7 + lift * 2.5) * (1 - 0.55 * sq), pv = 1 + 0.25 * Math.sin(t * 40) * lift;
        glow(gx, gy, 34 * pv, EL_T[K], 0.5 + 0.3 * lift);
        a4Orb(gx + z5Sh(t, 7) * sq, gy, K, r, 1);
      } : undefined });
      // the light forced out between the fingers as they close on it
      if (held && sq > 0) { glow(gx, gy, 40 * sq + 10, EL_T[K], 0.35 * sq); for (let k = 0; k < 5; k++) { const a2 = fa + PI + (k - 2) * 0.45, L = 6 + 20 * sq * ih(k, fl(t * 30), 4779); lineP(gx, gy, gx + Math.cos(a2) * L, gy + Math.sin(a2) * L, ELC[K][2]); } }
      // the crushes, each its own
      if (g >= 0 && g < 1.6) {
        const [c0, c1, c2] = ELC[K], cx = gx, cy = gy, fade = 1 - clamp(g / 0.9, 0, 1);
        if (g < 0.5) glow(cx, cy, 110 * (1 - g * 2), EL_T[K], 0.7);
        // water: it runs out between his fingers and falls on its face like rain
        if (K === 0) for (let k = 0; k < 44; k++) { const q = g * (0.7 + ih(k, 1, 4771) * 0.6), x = cx + (ih(k, 2, 4771) - 0.5) * 34 + (ih(k, 4, 4771) - 0.5) * 30 * q, y = cy + 8 + q * 30 + q * q * 220; if (y < hy + 12 && bay(fl(x), fl(y)) < 1.3 - g * 0.8) { P(x, y, k % 3 ? c1 : 22); P(x, y - 1, c0); P(x, y - 2, c0); } }
        // leaf: a burst of leaves that wither and turn to ash as they fall
        if (K === 1) for (let k = 0; k < 28; k++) { const q = g, a2 = -PI * 1.2 * ih(k, 1, 4772) + 0.2, sp = 70 + 70 * ih(k, 5, 4772), x = cx + Math.cos(a2) * sp * eoc(Math.min(1, q * 2)) + Math.sin(q * 5 + k) * 8, y = cy + Math.sin(a2) * sp * 0.6 * eoc(Math.min(1, q * 2)) + q * q * 80, rot = q * 6 + k, wilt = clamp(q / 1.1, 0, 1); if (y > hy + 14) continue; const col = wilt < 0.35 ? (k % 2 ? c1 : c2) : wilt < 0.7 ? 29 : 121; for (let j = -2; j <= 2; j++) { P(x + Math.cos(rot) * j, y + Math.sin(rot) * j * 0.6, j === 0 && wilt < 0.35 ? c2 : col); P(x + Math.cos(rot) * j - Math.sin(rot), y + Math.sin(rot) * j * 0.6 + 1, col); } }
        // lightning: it lashes out between his knuckles once, a last flicker, and then nothing
        if (K === 2) { if (g < 0.3) for (let k = 0; k < 6; k++) { const a2 = -PI * 0.9 + k * 0.5 + ih(k, fl(t * 30), 4773) * 0.3; bolt(cx, cy, cx + Math.cos(a2) * 120 * (1 - g * 2), cy + Math.sin(a2) * 90, fl(t * 30) + k, k % 2 ? 1 : 2, 53, 52); } if (g > 0.45 && g < 0.52) { bolt(cx, cy, cx - 30, cy + 26, 77, 1, 53, 51); } }
        // starlight: the stars scatter and go out, one by one
        if (K === 3) for (let k = 0; k < 26; k++) { const a2 = ih(k, 1, 4774) * TAU, v = 30 + ih(k, 2, 4774) * 110, x = cx + Math.cos(a2) * v * eoc(Math.min(1, g * 1.2)), y = cy + Math.sin(a2) * v * 0.7 * eoc(Math.min(1, g * 1.2)) - g * 10, out = 0.2 + ih(k, 3, 4774) * 0.85; if (g < out) sparkle(x, y, 1 + 2.5 * (1 - g / out), k % 3 ? c2 : 22, c1); }
        if (g < 0.3) z5Hit(cx, cy, g, 0.8, -PI / 2, c2, 4775 + K);
        if (g > 0.3) for (let k = 0; k < 8; k++) { const q = frac(ih(k, 1, 4776) + g * 1.2), x = cx + (ih(k, 2, 4776) - 0.5) * 10, y = cy + 14 + q * 60; if (bay(fl(x), fl(y)) < fade) P(x, y, 94); }
      }
      // each crush takes colour out of the world
      tintAll(T_ASH, A4OT.reduce((s_, x) => s_ + 0.16 * sstep(x, x + 0.6, t), 0));
      if (g >= 0 && g < 0.1) tintAll(EL_T[K], 0.18 * (1 - g / 0.1));
      // the camera: a different place for each crush
      const CAMS = [[1.0, 0, 240, 138], [1.22, -0.03, 262, 130], [1.12, 0.04, 230, 140], [1.3, 0, 250, 128]];
      const ci = t < 73.45 ? 0 : t < 74.45 ? 1 : t < 75.45 ? 2 : 3, C = CAMS[ci], push = 0.04 * eio(frac(t - 72.45));
      shk(g >= 0 && g < 0.3 ? 4 * (1 - g / 0.3) : 0.6);
      a4Cam(C[0] + push, C[1], C[2], C[3], kick(t, A4OT.map((x) => [x, 1.2, PI / 2])));
    });
    CAPS.push([76.2, 77.4, 's', 'HERO', 'NO—!']);
  
    /* ============================================================== 7 · the drop (77.0–80.0)
       He takes his hand off it, picks it up between two fingers, holds it out over the dark, and lets it go. */
    shot(77.0, 78.4, (lt, t) => {
      const off = eio(lin(77.0, 77.35, t)), come = eio(lin(77.08, 77.4, t)), pinch = eoc(lin(77.38, 77.5, t)), raise = eio(lin(77.52, 78.0, t)), open = eoc(lin(78.02, 78.12, t)), drop = t > 78.06 ? t - 78.06 : 0;
      const camY = 150 * raise;
      a4Deep(700 - camY, t, 0.45, 1400);
      a4Wall(1, 430, 720 - camY, t, 0.45, 1400, 4761, false);
      a4Ledge(214 + camY, 200, t, true);
      const S = 3.2, base = 214 - 14 * S + 8 + camY;
      // the pinning hand lifts off it (the fingers curling as they come away)
      if (off < 1) a4PinHand(t, base, 1, 1 - off, { dx: -off * 150, dy: -off * 190 });
      // the other hand: down to it, finger and thumb open; they close on the scruff of it (three frames); up, out over the
      // drop, held there; and they open
      const fa = PI * 0.56 + raise * 0.1, ux = Math.cos(fa), uy = Math.sin(fa), FS = 2.4;
      const P0 = [A4PIN[0] + 6, base - 8 * S + 2], P1 = [300, 104];                 // the pinch: on it, and out over the dark
      let px = lerp(420, P0[0], come), py = lerp(-60, P0[1], come);
      px = lerp(px, P1[0], raise) + z5Sh(t, 5) * 0.6 * raise; py = lerp(py, P1[1], raise) - z5Knock(t - 77.45, 4, 16, 6);
      const sway = Math.sin(t * 3.2) * 0.25 * raise + z5Knock(t - 78.0, 0.12, 9, 3);
      const fallY = drop * drop * 500 + drop * 40;
      const drawHero = (x, y, ang, held) => actor(HERO3({ eyes: 'narrow', mouth: held ? 1 : 0, sword: 1.5 - sway, sq: held ? lerp(0.6, -0.15, pinch) : 0.1, legs: z5Limp(t, 1.4), cracks: 0.88, reach: 2 }), x, y, S - drop * 0.8, ang, false, { bob: 0, still: held });
      const held = pinch > 0 && open < 0.4;
      // hanging from the pinch: its top caught between finger and thumb, the rest of it swinging under
      const hang = (q) => [q[0] - Math.sin(sway) * 8 * S, q[1] + Math.cos(sway) * 8 * S];
      if (!held) { const [hx0, hy0] = pinch > 0 ? hang([px, py]) : [A4PIN[0], base]; drawHero(hx0 + drop * 10, hy0 + fallY, pinch > 0 ? sway + drop * 2 : 0.02, false); }
      const pose = a4PL(a4PL({ curls: [0.15, 0.9, 0.95, 1], thumb: 0.15, spread: 0.2 }, 'pinch', pinch), { curls: [0.05, 0.6, 0.7, 0.8], thumb: 0.05, spread: 0.6 }, open);
      if (come > 0) a4Arm(px - ux * 15 * FS, py - uy * 15 * FS, FS, fa, pose, 0.9, t, { bend: 0.5, side: -1,
        hold: held ? () => { const [hx0, hy0] = hang([px, py]); drawHero(hx0, hy0, sway, true); } : undefined });
      a4Embers(t, 24, -40, 4781, [94, 93]);
      tintAll(T_ASH, 0.5);
      shk(0.5);
      a4Cam(1.05, 0, 240, 135);
    });
    // straight down the chasm: the walls run away to a line of dark; it falls into it, smaller and smaller, its light going
    function a4Down(t, depth, fadeK) {
      for (let y = LB; y < H - LB; y++) {
        const dy = y + 0.5 - 135, ad = Math.abs(dy), row = y * W;
        const z = 1600 / Math.max(2, ad), wz = z + depth, hot = clamp(1 - wz / 1400, 0, 1) * fadeK, near = clamp(1 - z / 300, 0, 1);
        for (let x = 0; x < W; x++) {
          if (ad < 2) { BUF[row + x] = 0; continue; }
          const v = seamAt(x / (50 * (1 - near * 0.5) + 10) + (dy > 0 ? 9 : 3), wz / 60), n = vn(x * 0.5, wz * 0.5, 9, 4791), dk = clamp(z / 500, 0, 1);
          let c = v < 0.02 + hot * 0.04 ? (hot > 0.5 ? 104 : hot > 0.2 ? 102 : hot > 0.05 ? 101 : 97) : n > 0.6 ? 99 : n > 0.3 ? 98 : 97;
          if (bay(x, y) < dk) c = dk > 0.8 ? 0 : 96;
          BUF[row + x] = c;
        }
      }
    }
    shot(78.4, 80.0, (lt, t) => {
      const u = lt / 1.6, depth = 200 + lt * 600;
      a4Down(t, depth, 1 - u * 0.8);
      tintAll(T_ASH, 0.5);
      const S = lerp(3.0, 0.35, eoc(u)), hx = 240 + Math.sin(lt * 1.7) * 22 * (1 - u), hy = 135 + Math.cos(lt * 1.3) * 14 * (1 - u);
      glow(hx, hy, 30 * S, T_WARM, 0.35 * (1 - u));
      actor(HERO3({ eyes: 'closed', sword: 1.2, legs: z5Limp(t, 1.6), cracks: 0.88 }), hx, hy, S, lt * 1.9, false, { still: true });
      // embers falling with it, overtaking it; grit streaming up past the camera
      for (let k = 0; k < 30; k++) { const q = frac(ih(k, 1, 4792) + lt * 0.9), r = 260 * (1 - q), a = ih(k, 2, 4792) * TAU, x = 240 + Math.cos(a) * r, y = 135 + Math.sin(a) * r * 0.55; if (bay(fl(x), fl(y)) < 1 - q * 0.6) { P(x, y, q < 0.5 ? 122 : 121); } }
      a4Cam(1.0, lt * 0.06, 240, 135);
    });

    /* ============================================================== 8 · all hope lost (80.0–88.0)
       The floor of the world. Far above, a thread of fire, and in it his eyes like two moons. "STAY DOWN." It tries to get up,
       and falls; again, and falls; and then, from the floor: "...NO." The cracks in it begin to burn. */
    function a4Floor(t, top, ox, k) {
      for (let x = 0; x < W; x++) {
        const wx = x / k + ox, y0 = top + (vn(wx, 0, 26, 4801) - 0.5) * 8 * k + (vn(wx, 0, 6, 4802) - 0.5) * 3 * k;
        for (let y = Math.max(LB, fl(y0)); y < H - LB; y++) { const d = (y - y0) / k, n = vn(wx, y / k, 4, 4803); BUF[y * W + x] = d < 1 ? 121 : n > 0.7 ? 98 : n > 0.4 ? 97 : 96; }
      }
      for (let k2 = 0; k2 < 24; k2++) { const x = ih(k2, 1, 4804) * W, y = top + 4 + ih(k2, 2, 4804) * 30 * k, r = (1 + ih(k2, 3, 4804) * 3) * k; discF(x, y, r, 98); P(x - r * 0.3, y - r * 0.4, 121); }
    }
    // his eyes, far above: two moons of fire in a slit of light, and the third between them
    function a4Moons(cx, cy, r, t, flare) {
      for (const sd of [-1, 1]) { const x = cx + sd * r * 2.6, y = cy + Math.abs(sd) * 0; glow(x, y, r * 5 * (1 + flare), T_EMBER, 0.45 + flare * 0.3); discF(x, y, r * 1.15, 103); discF(x, y, r, 106); discF(x - r * 0.2, y - r * 0.2, r * 0.6, 107); }
      glow(cx, cy - r * 1.6, r * 4, T_MAG, 0.4 + flare * 0.3); discF(cx, cy - r * 1.6, r * 0.75, 73); discF(cx, cy - r * 1.6, r * 0.45, 76); P(cx, cy - r * 1.6, 75);
    }
    function a4Pit(t, slit, eyes, flare) {
      gradient(LB, H - LB, [96, 96, 97, 96, 96]);
      // the walls rise on both sides to a slit of fire, far above
      // (the walls: the chasm's rock, barely lit — the slit's fire catching the ledges near the top, dying with depth)
      for (let y = LB; y < H - LB; y++) {
        const q = (y - LB) / (H - 2 * LB), half = lerp(slit, 260, Math.pow(q, 1.6)), row = y * W, cx = 240 + Math.sin(q * 4) * 6;
        const hot = 0.6 * (1 - q) * (1 - q) * (1 - q), RL = a4TexRow(4806, fl(y * 1.6 + 2000)), RR = a4TexRow(4807, fl(y * 1.6 + 2000));
        for (let x = 0; x < W; x++) {
          const dx = x - cx, d = Math.abs(dx) - half;
          if (d > 0) { const v = dx < 0 ? RL[x] : RR[W - 1 - x]; BUF[row + x] = d < 1.5 ? (q < 0.4 ? 103 : 99) : d < 4 && q < 0.5 ? 101 : a4Lit(v, x, y, hot * (d < 40 ? 1 : 0.6), 0.08, -3 + (d < 12 ? 1 : 0) - fl(q * 1.5)); }
          else if (q < 0.08) BUF[row + x] = q < 0.03 ? 105 : 103;
        }
      }
      glow(240, LB, 120, T_EMBER, 0.35);
      if (eyes > 0) { a4Moons(240, LB + 16, 5.2 * eyes, t, flare); for (let k = 0; k < 3; k++) z5Ray(240 + (k - 1) * 14, LB + 10, PI / 2 + (k - 1) * 0.12, 220, 16, 97, 97, 0.18); }
      // ash drifting down through the dark
      for (let k = 0; k < 60; k++) { const y = LB + frac(ih(k, 1, 4805) + t * 0.05 * (0.5 + ih(k, 3, 4805))) * 218, x = ih(k, 2, 4805) * W + Math.sin(t * 0.7 + k) * 8; P(x, y, k % 5 ? 93 : 121); }
    }
    const A4BEATS = [81.0, 84.0, 86.5, 87.0, 87.4, 87.7, 87.88];
    const a4Beat = (t) => { let b = 0; for (const h of A4BEATS) { const g = t - h; if (g > 0) b = Math.max(b, Math.exp(-g * 5) * (h > 86.9 ? 1 : 0.5)); } return b; };
    // 80.0–83.6 wide, from the floor: tiny, far below his eyes
    shot(80.0, 83.6, (lt, t) => {
      const fl0 = eio(lin(80.0, 80.25, t)), speak = t > 81.0 && t < 82.2 ? 0.4 * Math.sin((t - 81) * PI / 1.2) : 0;
      a4Pit(t, 10, 1, speak);
      a4Floor(t, 214, 30, 1);
      // landing (it has just hit the floor), then lying still; 82.0–83.5 it tries: up onto its arm, and down
      const tryU = eio(lin(82.1, 82.9, t)) * (1 - eic(lin(83.0, 83.25, t))), tr = a4Tw(t, 12) * tryU * 1.2;
      const S = 1.6, hx = 232 + tr * 0.5, hy = 214 - 14 * S + 10 * (1 - tryU) - (1 - fl0) * 30;
      glow(hx, hy, 22, T_WARM, 0.18 + a4Beat(t) * 0.2);
      actor(HERO3({ eyes: tryU > 0.3 ? 'narrow' : 'closed', sword: lerp(0.2, 1.4, tryU), sq: 0.45 * (1 - tryU), legs: [3 - tryU * 2, 3 - tryU * 2, 3, 3], cracks: 0.88, mouth: tryU > 0.5 ? 1 : 0 }), hx, hy, S, 0.05 - tryU * 0.08, false, { bob: 0 });
      if (lt < 0.4) a4Dust(hx, 214, lt, 8, 40, 4806);
      if (lt < 0.1) shk(3 * (1 - lt / 0.1));
      a4Cam(1.0 + lt * 0.02, 0, 240, 135);
    });
    CAPS.push([81.0, 83.0, 's', 'SUNDERER', 'STAY DOWN.']);
    // 83.6–86.2 close on the floor: up on the cracked sword, trembling, and down; again
    shot(83.6, 86.2, (lt, t) => {
      a4Pit(t, 30, 0, 0);
      tintAll(T_DARK, 0.3);
      a4Floor(t, 218, 300, 2.2);
      const t1 = eio(lin(83.7, 84.6, t)) * (1 - eic(lin(84.75, 84.92, t))), t2 = eio(lin(85.15, 86.1, t)) * 0.8, up = Math.max(t1, t2);
      const tr = a4Tw(t, 13) * (0.3 + up * 2.2), S = 4.2, hx = 214 + tr * 0.7, hy = 218 - 14 * S + 16 * (1 - up) + tr * 0.4;
      glow(hx, hy, 60, T_WARM, 0.15 + a4Beat(t) * 0.25);
      const a = actor(HERO3({ eyes: up > 0.5 ? 'narrow' : 'closed', mouth: up > 0.4 ? 1 : 0, sword: lerp(0.3, 1.38, up), sq: 0.42 * (1 - up), reach: up > 0.3 ? 2.5 : 0, legs: [3 - up * 2.4, 3 - up * 2, 3 - up * 2, 3 - up * 2.4].map((v, k) => v + (up > 0.2 ? Math.max(0, Math.sin(t * 40 + k)) * up : 0)), cracks: 0.88 }), hx, hy, S, 0.04 - up * 0.06, false, { bob: 0 });
      a4SwordCracks(a.hand, a.tip, 1, 4811);
      // when the arm gives
      const g = t - 84.92; if (g > 0 && g < 0.5) { a4Dust(hx, 218, g, 8, 60, 4812); shk(3 * (1 - g / 0.5)); }
      a4Cam(1.0 + lt * 0.02, 0, 230, 150);
    });
    // 86.2–88.0 its face, very close, from the floor: it lifts its head to the eyes above. "...NO." The cracks begin to burn,
    // a heartbeat at a time, faster
    shot(86.2, 88.0, (lt, t) => {
      const beat = a4Beat(t), rise = eio(lin(86.4, 87.9, t)), burn = sstep(86.8, 88.0, t);
      a4Pit(t, 18, 0.9, 0);
      a4Floor(t, 232, 600, 3);
      const S = 6.0, tr = a4Tw(t, 14) * (0.6 + rise * 1.5), hx = 236 + tr, hy = 232 - 14 * S + 22 * (1 - rise) - beat * 2;
      glow(hx, hy, 90 + beat * 60, T_EMBER, 0.15 + beat * 0.35 + burn * 0.2);
      actor(HERO3({ eyes: t < 86.45 ? 'closed' : t < 87.3 ? 'narrow' : 'angry', mouth: t > 86.5 && t < 87.0 ? 1 : t > 87.5 ? 2 : 0, sword: lerp(0.4, 1.3, rise), sq: 0.3 * (1 - rise), reach: 2, legs: [3 - rise * 2.5, 3 - rise * 2.5, 3 - rise * 2.5, 3 - rise * 2.5], cracks: 0.9 }), hx, hy, S, -0.05 * rise, false, { bob: 0 });
      // the cracks burn on each beat: light from inside it
      if (beat > 0.05 || burn > 0) { for (let y = Math.max(LB, SMB[1]); y <= Math.min(H - LB - 1, SMB[3]); y++) for (let x = Math.max(0, SMB[0]); x <= Math.min(W - 1, SMB[2]); x++) { const i = y * W + x; if (SMASK[i] && (BUF[i] === 107 || BUF[i] === 103)) BUF[i] = beat + burn > 0.6 ? 22 : 105; } }
      for (let k = 0; k < 12 * burn; k++) { const q = frac(ih(k, 1, 4821) + t * 1.4), x = hx + (ih(k, 2, 4821) - 0.5) * 26 * S, y = hy - q * 60; if (bay(fl(x), fl(y)) < 1 - q) P(x, y, q < 0.4 ? 106 : 104); }
      shk(burn * 1.5);
      a4Cam(1.0 + lt * 0.03, 0, 236, 140);
    });
    CAPS.push([86.5, 88.0, 's', 'HERO', '...NO.']);
  
    /* ============================================================== 9 · LAST LIGHT (88.0–90.6)
       It burns its own life: its body chars black, fire pours out of every crack, and the cracked sword is re-forged in that
       fire and grows — out of the chasm, past him, through the clouds, miles long. The camera rides up the blade. */
    function a4Last(x, y, S, t, o) {
      const pw = o.power === undefined ? 1 : o.power;
      glow(x, y, 70 * S * pw, T_FIRE, 0.45 * pw);
      const a = actor(HERO3({ form: 'lastlight', eyes: o.eyes || 'glow', mouth: o.mouth, sword: o.sw, sq: o.sq, legs: o.legs, reach: o.reach }), x, y, S, o.ang || 0, false, { bob: o.bob, still: o.still });
      aura(t, LASTF, 4.5 * S * pw, { sparks: fl(20 * pw), rise: 1.4 });
      // fire jetting out of the seams in it
      for (let k = 0; k < 14 * pw; k++) { const a2 = ih(k, 1, 4831) * TAU, q = frac(ih(k, 2, 4831) + t * 2.2), r0 = 9 * S, r1 = r0 + (12 + 20 * ih(k, 3, 4831)) * S * q; const x0 = x + Math.cos(a2) * r0, y0 = y + Math.sin(a2) * r0 * 0.7; lineF(x0, y0, x + Math.cos(a2) * r1, y + Math.sin(a2) * r1 * 0.7 - q * 8 * S, (X, Y, u) => { if (bay(X, Y) < 1 - u * 0.8 - q * 0.3) P(X, Y, u < 0.3 ? 22 : u < 0.6 ? 106 : 104); }); }
      return a;
    }
    shot(88.0, 88.9, (lt, t) => {
      const g = t - 88.0, rise = eoc(Math.min(1, g / 0.3)), grow = eic(lin(88.25, 88.9, t)), tiltUp = eic(lin(88.55, 88.9, t));
      a4Pit(t, 18, 0.9, 0.6);
      a4Floor(t, 236 + tiltUp * 60, 600, 3);
      groundCracks(226, 236 + tiltUp * 60, 200 * rise, 12, 4832, 106, 104);
      const S = 3.6, hx = 226 + a4Tw(t, 15) * 1.2, hy = 236 - 14 * S + tiltUp * 60;
      const a = a4Last(hx, hy, S, t, { eyes: 'glow', mouth: 2, sw: -1.45, sq: -0.15 * (1 - rise) });
      // the sword re-forged: fire runs up the cracked blade and it grows, and keeps growing, up out of the top of the frame
      const L = 29 * S * (1 + grow * 14);
      bigBlade(a.hand[0], a.hand[1], -PI / 2 + 0.05, L, 6, t, { form: 'lastlight', grow: grow < 1 ? 0.999 : 1, surge: true, flare: 0.9 });
      if (g < 0.4) { shockRing(hx, 236, 10 + g * 900, 4 + g * 120, 4, [22, 106, 104], 1 - g / 0.4); glow(hx, hy, 260 * (1 - g * 2), T_WH, 0.6); }
      rocks(hx, 236, g, 26, 260, 4, [97, 99, 104, 106], 4833, 300, -PI / 2, 2.4);
      if (g < 0.02) impactFrame(hx, hy, 0);
      shk(g < 0.5 ? 7 * (1 - g / 0.5) : 2);
      a4Cam(1.0, 0, 236, 140, kick(t, [[88.0, 3, PI / 2]]));
    });
    CAPS.push([88.0, 89.3, 'x', '', 'LAST LIGHT!', 54]);
    /* the column of the world, side on, for the ride up the blade: world x 240 is the blade; altitude a (0 the chasm floor,
       600 the sea, 1500–1620 the cloud cover, the dawn above); the camera sits at altitude cA, k screen px per unit */
    const A4SEA = 600, A4CL0 = 1500, A4CL1 = 1640;
    function a4Column(t, cA, k, tipA, hole, yFrom) {
      const SKYD = [16, 15, 8, 7, 6, 5, 4];
      for (let y = Math.max(LB, yFrom || 0); y < H - LB; y++) {
        const a = cA + (135 - y) / k, row = y * W;
        for (let x = 0; x < W; x++) {
          const wx = (x - 240) / k, ax = Math.abs(wx);
          let c;
          if (a < 0) c = vn(wx, a, 6, 4841) > 0.6 ? 98 : 97;
          else if (a < A4SEA) {
            const q = a / A4SEA;
            if (ax < 70 + q * 20) c = q > 0.85 ? (bay(x, y) < (q - 0.85) * 6 ? 103 : 102) : q > 0.5 ? (bay(x, y) < 0.3 ? 101 : 97) : 96;
            else { const v = k > 0.3 ? seamAt(wx / 50 + 20, a / 60) : 1; c = v < 0.02 + q * 0.03 ? (q > 0.7 ? 104 : q > 0.4 ? 102 : 101) : ax < 76 + q * 20 ? (q > 0.6 ? 103 : 99) : vn(wx, a, 12, 4842) > 0.55 ? 98 : 97; }
          } else if (a < A4SEA + 16 && ax > 90) { const sw = Math.sin(wx * 0.05 + t * 2 + a); c = a < A4SEA + 3 ? 118 : sw > 0.6 ? 117 : OCEAN[fl((a - A4SEA) / 6)]; }
          else if (a < A4CL0) {
            // the air between the sea and the cloud: banks of smoke drifting in layers (the near ones darker, edged with the
            // fire's light from below), the cloud's lit belly glowing down through it, the blade's light on everything near it
            const q = (a - A4SEA) / (A4CL0 - A4SEA), sm = fbm(wx * 0.22 + t * 4, a * 2.2, 110, 3, 4890), bank = sstep(0.44, 0.56, sm), rim = sm > 0.44 && sm < 0.47;
            const near = clamp(1 - ax / 300, 0, 1), L = clamp(0.14 + 0.3 * (1 - q) * (1 - q) + 0.4 * q * q * q + near * near * 0.3 - bank * 0.16 + (rim ? 0.2 : 0), 0, 0.999) * 6;
            const R = [96, 97, 98, 101, 102, 103], i = fl(L); c = bay(x, y) < L - i ? R[Math.min(5, i + 1)] : R[i];
            if (bank > 0.5 && vn(wx * 0.9, a * 3, 22, 4892) > 0.72) c = 120;
          }
          else if (a < A4CL1) {
            const bot = A4CL0 + fbm(wx, 0, 90, 3, 4843) * 50, top = A4CL1 - 40 + fbm(wx + 7, 0, 60, 3, 4844) * 70, hr = hole * (1 + 0.3 * vn(wx, a, 30, 4845));
            if (ax < hr || a < bot || a > top) c = a > (A4CL0 + A4CL1) / 2 ? SKYD[0] : ax >= hr ? (bay(x, y) < 0.35 + 0.4 * (a - A4CL0) / Math.max(1, bot - A4CL0) ? 102 : 101) : 97;
            else { const db = a - bot, dt = top - a, n = vn(wx * 1.2, a * 2, 14, 4848); c = db < 3 ? 102 : db < 10 ? (n > 0.5 ? 121 : 120) : dt < 3 ? 16 : dt < 10 ? (n > 0.4 ? 15 : 19) : dt < 26 ? (n > 0.55 ? 19 : 18) : n > 0.6 ? 18 : 121; if (ax < hr + 5 / k) c = 106; }
          } else { const q = clamp((a - A4CL1) / 900, 0, 0.999); c = SKYD[fl(q * 7)]; if (bay(x, y) < frac(q * 7)) c = SKYD[Math.min(6, fl(q * 7) + 1)]; }
          BUF[row + x] = c;
        }
      }
      // spires on the sea, and the blade's light on the cloud
      for (let k2 = 0; k2 < 9; k2++) { const wx = (ih(k2, 1, 4846) - 0.5) * 2400, h = 80 + ih(k2, 2, 4846) * 220, w = 20 + ih(k2, 3, 4846) * 30; if (Math.abs(wx) < 140) continue; const x0 = 240 + wx * k, yb = 135 - (A4SEA - cA) * k, yt = yb - h * k; if (yb < LB || yt > H - LB) continue; for (let y = Math.max(LB, fl(yt)); y < Math.min(H - LB, yb); y++) { const v = (yb - y) / (h * k), hw = w * k * (0.3 + 0.7 * (1 - v)); for (let x = fl(x0 - hw); x <= x0 + hw; x++) P(x, y, v > 0.9 ? 103 : 98); } }
      const ys = 135 - ((A4CL0 + A4CL1) / 2 - cA) * k; if (ys > LB - 60 && ys < H + 60 && tipA > A4CL0) glow(240, ys, 160 * Math.max(0.4, k), T_EMBER, 0.5);
    }
    shot(88.9, 90.6, (lt, t) => {
      const u = eio(lin(88.9, 90.0, t)), zo = eio(lin(89.7, 90.55, t));
      const tipA = 300 + 2600 * eoc(lin(88.9, 89.7, t)), cA = lerp(lerp(70, 1560, u), 1300, zo), k = lerp(lerp(1.0, 0.7, u), 0.085, zo);
      const hole = tipA > A4CL0 ? Math.min(150, 30 + (tipA - A4CL0) * 0.1) : 0;
      a4Column(t, cA, k, tipA, hole);
      // embers and ash falling past as we rise
      a4Embers(t, 50, -700 * (1 - u) - 40, 4849, [104, 102]);
      // him: standing in the sea beside it, his face passing as we rise; he turns to look at it
      const so = 1.5 * k, mx = 240 + 300 * k, my = 135 - (1080 - cA) * k;
      if (my > -200 && my < H + 200) { a4Sund(mx, my, so, t, { third: 1, eyes: 1.4, heat: 0.85, crown: 0.75, tilt: 0.15 * u, arms: [a4Rest(-110, 140, 20, t), a4Rest(110, 150, 21, t), a4Rest(-80, 200, 22, t), a4Rest(80, 200, 23, t)] }); const sy = fl(135 - (A4SEA + 16 - cA) * k); if (sy < H - LB) a4Column(t, cA, k, tipA, hole, sy); }
      // the blade, from the hero far below to its tip
      const hy = 135 - (24 - cA) * k, ty = 135 - (tipA - cA) * k;
      bigBlade(240, hy, -PI / 2, hy - ty, Math.max(1.6, 7 * k), t, { form: 'lastlight', grow: tipA < 2890 ? 0.999 : 1, surge: true, flare: 0.9 });
      glow(240, Math.max(LB, ty), 40, T_WH, 0.6);
      if (hy < H - LB + 40) { const S = 5 * k; a4Last(240 - 22 * k, hy + 6 * k, Math.max(0.6, S), t, { mouth: 2, sw: -1.5, still: true }); }
      else glow(240, H - LB, 80, T_FIRE, 0.4);
      // streaks of the ride
      if (u < 0.95) streaks(PI / 2, 26, t, 2600 * (1 - u), 104, 60, 4847, [0, LB, W, H - 2 * LB]);
      shk(2 - zo);
      a4Cam(1.0, 0, 240, 135);
    });
  
    /* ============================================================== 10 · the giants (90.6–100.8)
       The blade, rooted in the chasm where the hero stands, against him: four arms crossed, a backhand, a fist, a hammer that
       drives it into the sea, a block; the lower left arm cut off at the elbow, the lower right; a cut across his mask; and
       then he catches it in his two hands, holds it, and snaps it. One world, seen through many cameras: V = { k, ox, oy }
       maps world (the wide view at k 1) to the screen. */
    const GM = [340, 78], GS = 0.8, GSEA = 200, GWL = 246;            // his mask, scale; the horizon; his waterline
    const gl = (lx, ly) => [GM[0] + lx * GS, GM[1] + ly * GS], lg = (x, y) => [(x - GM[0]) / GS, (y - GM[1]) / GS];
    // the exchange: blade pivot (the hero's hand, deep in the chasm) and angle and length, keyed in time
    const GK = [
      // t, pivot x, pivot y, angle, length, ease
      [90.3, 160, 340, -1.57, 1400], [90.6, 160, 340, -0.86, 1400, 'i'], [91.0, 160, 340, -1.05, 1400, 'o'],
      [91.2, 150, 344, -1.32, 1400], [91.4, 150, 344, -1.15, 1400, 'i'], [91.7, 150, 344, -1.45, 1400, 'o'],
      [91.85, 140, 336, -1.3, 1400], [92.0, 140, 336, -1.0, 1400, 'i'], [92.3, 140, 336, -1.3, 1400, 'o'],
      [92.45, 150, 340, -1.35, 1400], [92.6, 150, 340, -1.08, 1400, 'i'], [92.8, 150, 340, -0.45, 1400, 'o'], [93.0, 150, 340, -0.75, 1400],
      [93.2, 165, 330, -0.74, 1400, 'i'], [93.5, 165, 330, -1.1, 1400, 'o'],
      [94.0, 150, 340, -1.45, 1400, 'io'], [94.2, 150, 340, -0.98, 1400, 'i'], [94.4, 150, 340, -0.45, 1400, 'o'], [94.9, 150, 340, -0.8, 1400],
      [95.2, 150, 340, -1.3, 1400], [95.4, 150, 340, -0.76, 1400, 'i'], [95.6, 150, 340, -0.35, 1400, 'o'], [96.2, 150, 340, -0.75, 1400],
      [96.45, 150, 340, -1.25, 1400], [96.6, 150, 340, -0.94, 1400, 'i'], [96.8, 150, 340, -0.62, 1400, 'o'],
      [97.15, 150, 340, -1.3, 1400], [97.4, 150, 340, -0.86, 1400, 'i'], [100.0, 150, 340, -0.86, 1400],
    ];
    function a4Blade(t) {
      let i = 0; while (i < GK.length - 1 && GK[i + 1][0] <= t) i++;
      const A = GK[i], B = GK[i + 1];
      let r;
      if (!B || t <= A[0]) r = { x: A[1], y: A[2], a: A[3], L: A[4] };
      else { const u = EASE[B[5] || 'io'](clamp((t - A[0]) / (B[0] - A[0]), 0, 1)); r = { x: lerp(A[1], B[1], u), y: lerp(A[2], B[2], u), a: lerp(A[3], B[3], u), L: lerp(A[4], B[4], u) }; }
      // the jab at 92.0 sets the whole blade ringing
      const gj = t - 92.0; if (gj > 0 && gj < 0.5) r.a += 0.05 * Math.exp(-gj * 9) * Math.sin(gj * 70);
      return r;
    }
    // the point d along the blade at time t (world)
    const a4BP = (t, d) => { const B = a4Blade(t); return [B.x + Math.cos(B.a) * d, B.y + Math.sin(B.a) * d]; };
    const A4CUT2 = 94.2, A4CUT3 = 95.4, A4MASK = 96.6, A4CATCH = 97.4, A4SNAP = 100.0, GD1 = 236, GD2 = 296, GDS = 266;
    // the five trades (time, where along the blade they meet, power): the four-armed block, the backhand, the jab into the
    // flat, the two-fisted hammer, the crossed block of the thrust — then the cuts, and the catch
    const GTR = [[90.6, 286, 2.4], [91.4, 230, 1.9], [92.0, 200, 2.0], [92.6, 270, 2.3], [93.2, 225, 2.1]];
    const GHITS = [...GTR.map(([h, d, p]) => [h, p, ...a4BP(h, d)]), [94.2, 2.6, ...gl(-105, 130)], [95.4, 2.6, ...gl(-60, 160)], [96.6, 2.4, ...gl(0, 0)], [97.4, 2.6, ...a4BP(97.4, GDS)]];
    /* his arms through the exchange: keyed striking points (local) [t, x, y, ang] — or, at a blow, [t, 'C', d, dx, dy, ang]:
       the point d along the blade at that moment (plus dx, dy), so the knuckles land exactly on it. Into a blow the key eases
       in (accelerating), out of one it eases out; the engine's arm physics add the elbow's trail and the shoulder's heave */
    const GAK = [
      // upper left: the crossed block; a backhand out across the blade; up overhead and the two-fisted hammer; rest
      [[90.0, -110, 140, 1.6], [90.42, 34, 58, 0.15], [90.6, 'C', 286, 30, 4, 0.1], [90.76, 40, 50, 0.0], [91.0, 26, 66, 0.15], [91.24, 44, 30, -0.6], [91.4, 'C', 230, 0, 0, 3.5], [91.56, -166, 36, 2.7], [92.1, -122, 104, 1.9], [92.42, -50, -56, -1.4], [92.6, 'C', 270, 3, -3, 2.0], [92.76, -98, 78, 2.2], [93.3, -112, 96, 1.7], [97.1, -110, 86, 1.6]],
      // upper right: the crossed block; back; overhead with the other for the hammer; rest
      [[90.0, 110, 150, 1.5], [90.42, -34, 64, 3.0], [90.6, 'C', 286, -30, 6, 3.1], [90.76, -26, 56, 3.2], [91.0, -20, 68, 3.0], [91.6, 92, 122, 1.8], [92.42, -36, -48, -1.6], [92.6, 'C', 270, -6, 5, 2.1], [92.76, -104, 86, 2.3], [93.4, 100, 112, 1.6], [96.9, 100, 108, 1.6]],
      // lower left: the crossed block; a straight jab into the flat of the blade; the cross block of the thrust; reaching
      [[90.0, -80, 200, 1.5], [90.42, 34, 112, 0.1], [90.6, 34, 112, 0.1], [91.0, 20, 118, 0.1], [91.82, -26, 140, 3.0], [92.0, 'C', 200, 0, 0, 3.0], [92.14, -126, 106, 3.0], [92.5, -70, 160, 2.0], [93.02, 30, 124, -0.2], [93.2, 'C', 225, 28, 2, -0.25], [93.36, 36, 116, -0.3], [93.65, -60, 150, 2.4], [94.0, -128, 138, 3.0], [94.2, -136, 140, 3.0]],
      // lower right: the crossed block; rest; the cross block; recoil from the first cut; reaching to grab
      [[90.0, 80, 200, 1.5], [90.42, -30, 116, 3.0], [90.6, -30, 116, 3.0], [91.0, -20, 120, 3.0], [92.0, 70, 168, 1.7], [93.0, -38, 126, 3.4], [93.2, 'C', 225, -36, -2, 3.45], [93.36, -30, 118, 3.5], [93.7, -20, 140, 3.0], [94.6, 110, 170, 1.6], [95.2, -40, 166, 3.2], [95.4, -62, 162, 3.3]],
    ];
    function a4GTrack(keys, t) {
      const pt = (K) => { if (K[1] !== 'C') return [K[1], K[2], K[3]]; const [lx, ly] = lg(...a4BP(K[0], K[2])); return [lx + K[3], ly + K[4], K[5]]; };
      let i = 0; while (i < keys.length - 1 && keys[i + 1][0] <= t) i++;
      const A = pt(keys[i]), Bk = keys[i + 1];
      if (!Bk || t <= keys[i][0]) return A;
      const B = pt(Bk), u = clamp((t - keys[i][0]) / (Bk[0] - keys[i][0]), 0, 1), e = Bk[1] === 'C' ? eic(u) : keys[i][1] === 'C' ? eoc(u) : eio(u);
      return [lerp(A[0], B[0], e), lerp(A[1], B[1], e), lerp(A[2], B[2], e)];
    }
    // his lean (local units, + away from the blade): rocked back by what he blocks and by the cuts, winding up away before
    // each of his own blows and throwing his weight into them
    const a4Bump = (g) => (g > 0 ? (1 - Math.exp(-g * 25)) * Math.exp(-g * 3) : 0);
    function a4GLean(t) {
      let l = 0;
      for (const h of [90.6, 93.2, 97.4]) l += 12 * a4Bump(t - h);
      for (const h of [94.2, 95.4]) l += 9 * a4Bump(t - h);
      for (const h of [91.4, 92.0, 92.6]) { const d = h - t; if (d > 0 && d < 0.3) l += 7 * Math.sin((1 - d / 0.3) * PI / 2); l -= 14 * a4Bump(t - h); }
      return l;
    }
    // the hands on the blade (97.4–100.6): the palm on it, the hand square across it; d along it, sd which side
    function a4Grip(t, d, sd, B) {
      const ga = B.a + sd * PI / 2, [bx, by] = [B.x + Math.cos(B.a) * d, B.y + Math.sin(B.a) * d], [lx, ly] = lg(bx, by);
      return { x: lx - Math.cos(ga) * 5.5, y: ly - Math.sin(ga) * 5.5, ang: ga };
    }
    function a4GArms(t) {
      const near = Math.min(...GHITS.map((h) => Math.abs(t - h[0]))), dr = 5 * clamp(near / 0.35, 0, 1);
      const arms = GAK.map((keys, k) => {
        const [x, y, ang] = a4GTrack(keys, t);
        const pose = k === 2 && t > 93.75 ? a4PL('fist', 'claw', lin(93.75, 93.95, t)) : k === 3 && t > 94.75 ? a4PL('fist', 'grab', lin(94.9, 95.25, t)) : a4PL('fist', 'grab', dr > 2 ? 0.2 + 0.2 * z5N(t * 1.4, k + 7) : 0);
        return { x: x - Math.cos(ang) * 10.8 + z5N(t * 0.9, k * 3) * dr, y: y - Math.sin(ang) * 10.8 + z5N(t * 0.8, k * 3 + 1) * dr, ang, pose, front: true };
      });
      if (t >= A4CUT2) { const [x, y, ang] = a4GTrack(GAK[2], A4CUT2); arms[2] = { x: x - Math.cos(ang) * 10.8, y: y - Math.sin(ang) * 10.8, cut: true, front: true }; }
      if (t >= A4CUT3) { const [x, y, ang] = a4GTrack(GAK[3], A4CUT3); arms[3] = { x: x - Math.cos(ang) * 10.8, y: y - Math.sin(ang) * 10.8, cut: true, front: true }; }
      // the catch: both upper hands to the blade, open, and shut on it; the strain; the snap twists them apart
      const cg = eoc(lin(97.22, 97.4, t));
      if (cg > 0) {
        const B = a4Blade(t), close = eoc(lin(97.36, 97.5, t)), strain = lin(97.5, 100.0, t), snap = t >= A4SNAP ? eoc(Math.min(1, (t - A4SNAP) / 0.25)) : 0;
        const push = 7 * a4Bump(t - A4CATCH) + 2 * z5Sh(t, 31) * strain;      // the blade's force taken in the arms
        [[0, GD1, 1], [1, GD2, -1]].forEach(([k, d, sd]) => {
          const G = a4Grip(t, d, sd, B), A = arms[k], tr = z5Sh(t * 1.3, k * 5) * (0.6 + 1.6 * strain);
          const tw = snap * (k === 0 ? 1 : -1);                                   // the snap: one hand down and round, one up
          A.x = lerp(A.x, G.x + Math.cos(B.a) * push + tw * -14, cg) + tr * (cg > 0.9 ? 1 : 0); A.y = lerp(A.y, G.y + Math.sin(B.a) * push + tw * 22, cg) + tr * 0.6 * (cg > 0.9 ? 1 : 0);
          A.ang = lerp(A.ang, G.ang + tw * 0.6, cg);
          const tight = 0.08 * strain + 0.04 * Math.sin(t * 9 + k);
          A.pose = a4PL({ curl: 0.15, thumb: 0.1, spread: 0.95 }, { curl: 0.8 + tight, thumb: 0.75, spread: 0.1 }, close);
          if (snap > 0) A.pose = a4PL(A.pose, k === 0 ? 'fist' : { curl: 0.3, thumb: 0.2, spread: 0.9 }, snap);
        });
      }
      return arms;
    }
    // a severed forearm, falling: the burning elbow end at (x, y), pointing a — the vambrace and the hand gone slack
    function a4Limb(x, y, s, a, t, len) {
      const ex = x + Math.cos(a) * len * s, ey = y + Math.sin(a) * len * s;
      a4Fore(x, y, ex, ey, s, 0.7, 0.6);
      discF(x, y, 13 * s, 103); discF(x, y, 8 * s, 105); discF(x, y, 4 * s, 22);
      glow(x, y, 26 * s, T_EMBER, 0.6);
      sHand(ex, ey, s, a + Math.sin(t * 3) * 0.1, Object.assign(a4P({ curl: 0.45, thumb: 0.3, spread: 0.6 }), { heat: 0.3 }), t);
    }
    // the severed arms: [time cut, cut point (local), initial velocity, spin, splash time]
    const GLIMBS = [[A4CUT2, -105, 130, -90, -60, -2.4, 94.95], [A4CUT3, -60, 160, 70, -50, 2.0, 96.1]];
    const a4LimbAt = (L, t) => { const g = t - L[0], [wx, wy] = gl(L[1], L[2]); return [wx + L[3] * g, wy + L[4] * g + 260 * g * g, (L[0] === A4CUT2 ? 2.4 : 0.5) + L[5] * g]; };
    /* the giants' world through the camera V = { k, ox, oy }: the sky and the dark ocean under the cloud cover, its spires,
       the fire of the blade on the water; the cloud cover with a hole blown through it, miles across, at every blow (dawn
       light pours down through each in shafts); the burning chasm cut through the sea; him; the blade; the hits.
       o: arms, push, shake, tilt, nod, roar, eyes, blade, cracks, noBlade, kink (the blade bent at his grip) */
    function a4Giant(t, V, o) {
      o = o || {};
      const k = V.k, X = (wx) => 240 + (wx - V.ox) * k, Y = (wy) => 135 + (wy - V.oy) * k, WX = (x) => V.ox + (x - 240) / k, WY = (y) => V.oy + (y - 135) / k;
      const B = o.blade || a4Blade(t), px = X(B.x), py = Y(B.y), hzY = Y(GSEA);
      // where the blade meets the horizon (its fire on the water under it)
      const LX = Math.abs(Math.sin(B.a)) > 0.05 ? px + Math.cos(B.a) * (hzY - py) / Math.sin(B.a) : px;
      belowWorld(t, hzY, V.ox * 1.5 + 900, 0.85, [97, 98, 101, 102, 103], clamp(LX, -40, W + 40));
      // the cloud cover, its belly lit red from below; every heavy hit blows a ring in it, miles across
      const holes = []; for (const [h, p, hx] of GHITS) { const g = t - h; if (g > 0) holes.push([hx, (50 + 210 * eoc(Math.min(1, g / 1.0))) * p / 2.4, g]); }
      for (let x = 0; x < W; x++) {
        const wx = WX(x), bot = Y(56 + 22 * fbm(wx, 0, 70, 3, 4851) + 7 * vn(wx, 0, 9, 4855)), y1 = Math.min(H - LB, Math.ceil(bot));
        for (let y = LB; y < y1; y++) {
          const wy = WY(y), dd = (bot - y) / k, n = vn(wx, wy, 9, 4852), b = bay(x, y);
          let c = dd < 1.5 ? 104 : dd < 3.5 ? (b < 0.5 ? 103 : 102) : dd < 8 + 6 * n ? (b < 0.4 ? 102 : 121) : dd < 16 + 8 * n ? (b < 0.5 ? 121 : 120) : n > 0.62 ? 120 : 97;
          for (const [hx, r, g] of holes) { const dx = (wx - hx) / r, dy = (wy - 40) / (r * 0.16), d = dx * dx + dy * dy; if (d < 1) { c = d > 0.85 ? (g < 0.6 ? 22 : 106) : d > 0.6 ? 15 : b < 0.5 ? 16 : 15; break; } else if (d < 1.25 && g < 1.2) { c = b < 0.5 ? 121 : 122; } }
          BUF[y * W + x] = c;
        }
      }
      // the dawn falling through the newest holes: shafts of light down to the sea
      for (const [hx, r, g] of holes.slice(-3)) {
        if (g > 3) continue;
        const a = 0.2 * Math.min(1, g * 3) * (1 - g / 3), x0 = X(hx), w0 = r * k * 0.55, y0 = Math.max(LB, fl(Y(48))), y1 = Math.min(H - LB, fl(hzY));
        for (let y = y0; y < y1; y++) { const q = (y - y0) / Math.max(1, y1 - y0), w = w0 * (0.6 + 0.6 * q), cx = x0 + q * 30 * k; for (let x = Math.max(0, fl(cx - w)); x < Math.min(W, cx + w); x++) { const e = 1 - Math.abs(x - cx) / w; if (vn(x * 0.3 + y * 0.1, g * 3, 3, 4856) > 0.35) tintI(y * W + x, x, y, T_WARM, a * e * (1 - q * 0.5)); } }
      }
      // the burning chasm cut through the sea toward us, the sea pouring over its lips
      for (let y = Math.max(LB, fl(hzY)); y < H - LB; y++) {
        const wy = WY(y), q = clamp((wy - GSEA) / 140, 0, 1), cxw = lerp(196, 140, q), half = 3 + (wy - GSEA) * 0.55, row = y * W;
        const xa = Math.max(0, fl(X(cxw - half - 4 / k))), xb = Math.min(W - 1, Math.ceil(X(cxw + half + 4 / k)));
        for (let x = xa; x <= xb; x++) {
          const wx = WX(x), d = Math.abs(wx - cxw) - half;
          if (d < 0) { BUF[row + x] = a4Gorge(x, y, -d / half, wx < cxw ? -1 : 1, wy * 3, half * k * 0.6, t); continue; }
          if (d < 3 / k) BUF[row + x] = bay(x, y) < 0.5 ? 22 : 119;               // foam on the lip where the sea goes over
        }
      }
      // him: the arms (keyed, or given), rocked by the blows; the cut across his mask
      const arms = o.arms || a4GArms(t), maskCuts = t >= A4MASK ? [[-17, -9, 17, 13, Math.min(1, (t - A4MASK) * 8)]] : [];
      // the thrust at 93.2 drives him back through the sea
      const shove = 16 * eoc(lin(93.2, 93.5, t)) * (1 - eio(lin(93.6, 94.4, t)));
      const sh = o.shake || 0, roar = o.roar || 0;
      // the blade as it is now (straight, or bent at his grip as he bends it); drawn inside his hands while he holds it
      const bw = Math.max(2, 7 * k), bo = { form: 'lastlight', flare: 0.9, cracks: o.cracks || 0, surge: true };
      const drawBlade = () => {
        if (o.kink) { const [sx, sy] = [X(B.x + Math.cos(B.a) * GDS), Y(B.y + Math.sin(B.a) * GDS)]; bigBlade(px, py, B.a, GDS * k, bw, t, bo); bigBlade(sx, sy, B.a - o.kink, (B.L - GDS) * k, bw, t, bo); }
        else o.tip = bigBlade(px, py, B.a, B.L * k, bw, t, bo);
      };
      const holding = !o.noBlade && t >= 97.37 && t < A4SNAP;
      if (holding && arms[0] && arms[1]) {
        arms[0] = Object.assign({}, arms[0], { hold: () => drawBlade() });
        // the second hand: its palm went down over the blade — so draw the blade again, but only round that palm
        arms[1] = Object.assign({}, arms[1], { hold: (info) => { const R = 26 * GS * k, [cx, cy] = info.palm; A4SAVE.set(BUF); drawBlade(); for (let y = LB; y < H - LB; y++) for (let x = 0; x < W; x++) { const dx = x - cx, dy = y - cy; if (dx * dx + dy * dy > R * R) BUF[y * W + x] = A4SAVE[y * W + x]; } } });
      }
      const so = a4Sund(X(GM[0] + (o.push || 0) + shove), Y(GM[1]), GS * k, t, { third: 1, eyes: o.eyes || 1.4, heat: 0.9, crown: 0.75, rage: t >= A4MASK ? 1 : 0.4 + roar * 0.4, roar, shake: sh, tilt: o.tilt || 0, nod: o.nod || 0, lean: a4GLean(t), arms, maskCuts });
      // the sea in front of his waist (the shove throws up a bow wave)
      const wl = Y(GWL);
      const wlA = 1 - sstep(226, 262, V.oy);   // (looking up from down in the chasm, the sea at his waist is out of sight)
      if (wl < H - LB && wlA > 0) for (let y = Math.max(LB, fl(wl)); y < H - LB; y++) for (let x = Math.max(0, fl(X(214))); x < W; x++) { const wy = WY(y), wx = WX(x), q = clamp((wy - GSEA) / 140, 0, 1); if (Math.abs(wx - lerp(196, 140, q)) < 6 + (wy - GSEA) * 0.55 || wx < 214 + 10 * vn(wy, 0, 6, 4859) || bay(x, y) >= wlA) continue; const sw = Math.sin(wx * 0.06 / (0.2 + q) + t * 1.4 + wy * 0.9); let c = y - wl < 2 ? 22 : OCEAN[clamp(fl(q * 3.2) + (sw > 0.8 ? 1 : 0), 0, 3)]; if (Math.abs(x - LX) < 10 + q * 40 && sw > 0.3 && c !== 22) c = sw > 0.9 ? 103 : 102; BUF[y * W + x] = c; }
      if (shove > 1 && t < 94.4) { const g = t - 93.2; rocks(X(GM[0] - 60 + shove), wl, g, 14, 160 * k, 1.5 * k + 1, [117, 118, 119, 22], 4858, 200 * k, -PI / 2 - 0.5, 1.0); }
      // the severed arms falling, and the sea thrown up where they land
      for (const L of GLIMBS) { const g = t - L[0]; if (g < 0) continue; const [wx, wy, a] = a4LimbAt(L, Math.min(t, L[6])); if (t < L[6]) a4Limb(X(wx), Y(wy), GS * k, a, t, 70); for (let q = 0; q < 6; q++) { const gg = g - q * 0.04; if (gg < 0 || t > L[6]) continue; const [px2, py2] = a4LimbAt(L, L[0] + gg); P(X(px2), Y(py2), q < 2 ? 105 : 103); } const gs = t - L[6]; if (gs > 0 && gs < 1.6) { const sx = X(wx), sy = Y(GWL); rocks(sx, sy, gs, 26, 220 * k, 3 * k + 1, [117, 118, 119, 22], 4854 + L[0], 160 * k, -PI / 2, 1.2); shockRing(sx, sy, 10 + gs * 300 * k, 3 + gs * 50 * k, 3, [22, 119, 118], 1 - gs / 1.6); if (gs < 0.5) glow(sx, sy, 60 * k, T_WH, 0.5 * (1 - gs * 2)); } }
      // the blade (when he is not holding it)
      if (!o.noBlade && !holding) drawBlade();
      // the hero, burning at the root of it, far below him (small: the scale of it)
      if (o.hero) { const S = o.hero.S, hx = px - 4.4 * S, hy = py + 1.2 * S; if (hy > LB - 60 && hy < H - LB + 60) { glow(px, py, 40 * S, T_FIRE, 0.4); a4Last(hx, hy, S, t, Object.assign({ sw: null }, o.hero)); } }
      // the hits, each its own: sparks from the exact point of contact thrown along the blow
      for (const [h, p, hx, hy] of GHITS) {
        const g = t - h; if (g < 0 || g > 1.2) continue;
        const sx = X(hx), sy = Y(hy);
        megaHit(sx, sy, g, Math.min(2.4, p), PI + B.a, [22, 106, 103], 4860 + fl(h * 10));
        if (g < 1.0) shockRing(sx, Y(40), 20 + g * 700 * k, 4 + g * 80 * k, 3, [22, 21, 20], 1 - g);
        if (g < 1.2) rocks(X(170), Y(GSEA + 10), g, 10, 120 * k, 3 * k + 1, [97, 99, 122, 103], 4870 + fl(h * 10), 200 * k, -PI / 2, 2.4);
        // the backhand throws a fan of sparks off the flat; the jab rings the blade (light running along it); the hammer
        // blasts the sea where the blade goes in; the thrust grinds sparks off the crossed vambraces
        if (h === 91.4 && g < 0.5) for (let q = 0; q < 24; q++) { const a = PI + B.a + 0.6 + (ih(q, 1, 4861) - 0.5) * 1.2, v = (60 + 200 * ih(q, 2, 4861)) * k, x = sx + Math.cos(a) * v * g, y = sy + Math.sin(a) * v * g + 200 * g * g; lineP(x, y, x - Math.cos(a) * 5, y - Math.sin(a) * 5, q % 3 ? 106 : 22); }
        if (h === 92.0 && g < 0.45) for (let q = 0; q < 8; q++) { const d = (frac(q / 8 + g * 3) - 0.5) * 900 * k, x = sx + Math.cos(B.a) * d, y = sy + Math.sin(B.a) * d; glow(x, y, 16 * k + 4, T_WH, 0.5 * (1 - g / 0.45)); }
        if (h === 93.2 && g < 0.6) for (let q = 0; q < 14; q++) { const a = PI + B.a + (ih(q, fl(t * 30), 4862) - 0.5) * 2.4, L = (8 + 30 * ih(q, 3, 4862)) * k; lineP(sx, sy, sx + Math.cos(a) * L, sy + Math.sin(a) * L, q % 2 ? 22 : 105); }
      }
      { const g = t - 92.75; if (g > 0 && g < 1.4 && k < 1.2) { const x = X(300), y = Y(GSEA + 8); rocks(x, y, g, 30, 300 * k, 3 * k + 1, [117, 118, 119, 22], 4881, 160 * k, -PI / 2, 1.0); shockRing(x, y, 10 + g * 320 * k, 3 + g * 50 * k, 3, [22, 119, 118], 1 - g / 1.4); if (g < 0.4) glow(x, y, 70 * k, T_WH, 0.5 * (1 - g / 0.4)); } }
      // his waterline: the sea pushed out in a ring from him on every hit
      for (const [h] of GHITS) { const g = t - h; if (g > 0 && g < 1.4) shockRing(X(GM[0]), Y(GWL), 20 + g * 260 * k, 3 + g * 20 * k, 2, [22, 119, 118], 1 - g / 1.4); }
      return { so, X, Y, B, px, py };
    }
    const a4GK = (t) => kick(t, GHITS.map(([h, p, x, y]) => [h, p * 0.8, Math.atan2(y - 300, x - 160)]));
    /* the giants in three travelling shots, cut only on impact frames (94.2 the first arm, 97.4 the catch). The camera is a
       key track over V = [k, ox, oy] in the one world: it rides each blow — pushed onto the shoulder for the backhand, down
       the ringing blade for the jab, pulled out wide for the hammer, in on his chest for the thrust — and cranes down the
       blade to the hero burning at its root, then follows the sweep up; it pushes in on the roar and onto the mask; after
       the catch it travels down the straining blade to the hero and races back up it to the hands for the snap. */
    const a4GV = (K, t) => { const v = a4K(K, t); return { k: v[0], ox: v[1], oy: v[2] }; };
    // his body through the exchange (on top of the keyed arms and the lean)
    function a4GOpts(t) {
      const tilt = -0.05 * a4Bump(t - 90.6) + 0.06 * sstep(91.2, 91.4, t) * (1 - sstep(91.8, 92.1, t)) - 0.05 * a4Bump(t - 91.4) - 0.04 * sstep(91.9, 92.1, t) * (1 - sstep(92.4, 92.6, t)) + 0.04 * a4Bump(t - 93.2)
        + (t > A4CUT2 ? 0.06 * eoc(Math.min(1, (t - A4CUT2) * 3)) * (1 - sstep(95.2, 95.8, t)) : 0) + (t > A4MASK ? z5Knock(t - A4MASK, 0.12, 9, 4) : 0);
      const roar = Math.max(0.4 * a4Bump(t - A4CUT2), t < 96.6 ? sstep(95.55, 95.85, t) * (1 - sstep(96.3, 96.5, t) * 0.5) : 0, t > A4MASK && t < A4CATCH ? 0.3 * Math.exp(-(t - A4MASK) * 3) : 0);
      const nod = 1 * sstep(91.3, 91.5, t) * (1 - sstep(91.9, 92.1, t)) + 3 * eio(lin(92.45, 92.6, t)) * (1 - eio(lin(92.8, 93.1, t))) - 2 * a4Bump(t - 93.2) - roar * 3;
      const shake = Math.max(t > A4CUT2 && t < 95.3 ? 1.2 : 0, roar * 1.4, t > A4MASK && t < A4CATCH ? 1.5 : 0);
      return { push: 10 * eoc(clamp((t - 90.6) * 3, 0, 1)) * (1 - eio(lin(91.2, 91.9, t))), tilt, roar, nod, shake };
    }
    // foreground: spray and ash blown across the lens, wisps of cloud low in the frame (parallax faster than the world)
    function a4Spray(V, t, amt) {
      amt = amt === undefined ? 1 : amt;
      for (let q = 0; q < 26 * amt; q++) {
        const z = 0.5 + ih(q, 1, 4950), x = ((ih(q, 2, 4950) * 900 - V.ox * V.k * 1.7 * z - t * 90 * z) % 900 + 900) % 900 - 200, y = ((ih(q, 3, 4950) * 400 - V.oy * V.k * 1.7 * z + t * 30 * z) % 300 + 300) % 300 + LB - 30, r = 0.8 + z * 1.4;
        if (q % 5 === 0) { glow(x, y, r * 5, T_EMBER, 0.2); discF(x, y, r, 104); } else if (bay(fl(x), fl(y)) < 0.75) discF(x, y, r, q & 1 ? 119 : 118);
      }
      for (let w = 0; w < 3; w++) {
        const cx = ((ih(w, 4, 4951) * 1100 - V.ox * V.k * 2.1 - t * 50) % 1100 + 1100) % 1100 - 300, cy = H - LB - 6 - ih(w, 5, 4951) * 18 - (V.oy - 140) * V.k * 0.3, rx = 90 + ih(w, 6, 4951) * 70, ry = 9 + ih(w, 7, 4951) * 7;
        for (let y = Math.max(LB, fl(cy - ry)); y < Math.min(H - LB, cy + ry); y++) for (let x = Math.max(0, fl(cx - rx)); x < Math.min(W, cx + rx); x++) { const dx = (x - cx) / rx, dy = (y - cy) / ry, d = dx * dx + dy * dy + (vn(x, y, 8, 4952 + w) - 0.5) * 0.5; if (d < 1 && bay(x, y) < (1 - d) * 0.75 * amt) BUF[y * W + x] = dy < -0.3 ? 102 : 120; }
      }
    }
    const a4GHero = (t, extra) => Object.assign({ eyes: 'glow', mouth: 2, sq: -0.1 + 0.2 * Math.sin(t * 9), legs: [0, 1, 1, 0] }, extra || {});
    // GA 90.6–94.2: the five trades and the crane down the blade to the hero, hauling it back for everything it has
    const GVA = [[90.6, [1.0, 250, 140]], [91.1, [1.25, 256, 128]], [91.4, [1.7, 262, 118], 'i'], [91.75, [1.45, 248, 140], 'o'], [92.0, [1.3, 236, 152], 'i'], [92.3, [0.95, 250, 150], 'o'], [92.6, [0.8, 260, 150]],
      [92.95, [1.3, 300, 166]], [93.2, [1.7, 318, 176], 'i'], [93.5, [1.55, 300, 200], 'o'], [93.85, [1.6, 200, 296]], [94.1, [1.55, 196, 294]]];
    const GRA = [[90.6, 0], [91.4, -0.04], [92.0, 0.08, 'i'], [92.45, 0], [93.2, 0.03], [93.85, -0.04], [94.2, -0.02]];
    shot(90.6, 94.2, (lt, t) => {
      const V = a4GV(GVA, t), G = a4GOpts(t), root = sstep(93.55, 93.85, t);
      a4Giant(t, V, Object.assign(G, { hero: root > 0 ? a4GHero(t, { S: Math.max(1, 0.95 * V.k), power: 1 + 0.2 * root }) : null }));
      a4Spray(V, t);
      const hs = GHITS.find((h) => t >= h[0] && t - h[0] < 0.35);
      shk(hs ? 6.5 * (1 - (t - hs[0]) / 0.35) + 1 : 1.2 + root);
      a4Cam(1.0, a4K(GRA, t), 240, 135, a4GK(t));
    });
    // GB 94.2–97.4: the sweep takes the lower left arm off (the cut lands on the frame), the camera following the blade up;
    // the lower right; he roars and the camera is pushed in on it, onto the mask: the blade goes across it; pulled back
    const GVB = [[94.2, [1.3, 266, 176]], [94.6, [1.12, 290, 162], 'o'], [95.2, [1.05, 270, 154]], [95.4, [1.0, 262, 150], 'i'], [96.45, [1.8, GM[0], GM[1] + 20], 'io'], [96.6, [2.4, GM[0], GM[1] + 12], 'i'], [97.0, [2.2, GM[0] - 4, GM[1] + 16], 'o'], [97.4, [1.6, 306, 112], 'io']];
    const GRB = [[94.2, 0.04], [94.6, 0], [95.4, -0.03], [96.0, 0.02], [96.6, -0.03], [97.4, 0]];
    function a4GB(t) {
      const V = a4GV(GVB, t), G = a4GOpts(t);
      a4Giant(t, V, G);
      a4Spray(V, t);
      const hs = GHITS.find((h) => t >= h[0] && t - h[0] < 0.4);
      shk((hs ? 7 * (1 - (t - hs[0]) / 0.4) : 1.2) + G.roar * 3);
      a4Cam(1.0, a4K(GRB, t), 240, 135, a4GK(t));
    }
    // GC 97.4–100.35: the catch — the palms on it, the fingers shut over it; it stops dead; down the straining blade to the
    // hero, everything pouring out of it into the blade, and back up to his hands as it cracks along its length and bends
    // where he holds it; the snap: the camera thrown back, the long half tumbling out of his hands in pieces
    const GVC = [[97.4, [1.6, 306, 112]], [97.55, [1.78, 310, 114], 'o'], [97.95, [1.55, 300, 112]], [98.15, [1.6, 270, 160]], [98.6, [1.65, 200, 296], 'io'], [98.85, [1.65, 196, 296]], [99.25, [2.2, 310, 140], 'io'], [99.95, [2.4, 322, 132]], [100.0, [2.4, 322, 132]], [100.28, [0.9, 262, 132], 'o'], [100.35, [0.86, 262, 134]]];
    function a4GripFx(r, t, g, amt) {
      for (const d of [GD1, GD2]) {
        const [bx, by] = a4BP(t, d), sx = r.X(bx), sy = r.Y(by);
        for (let q = 0; q < 8; q++) { const f = frac(ih(q, 1, 4901 + d) + t * 2.6), a = r.B.a + PI + (ih(q, 2, 4901 + d) - 0.5) * 2; const x = sx + Math.cos(a) * f * 50 * amt, y = sy + Math.sin(a) * f * 50 * amt + f * f * 30; P(x, y, f < 0.4 ? 22 : 106); }
        glow(sx, sy, 40 * amt, T_EMBER, 0.45 * amt);
      }
    }
    function a4Frag(x, y, L, w, a, lit) {
      const ca = Math.cos(a), sa = Math.sin(a), nx = -sa * w, ny = ca * w, tx = x + ca * L, ty = y + sa * L, bx = x - ca * L * 0.6, by = y - sa * L * 0.6;
      z5Tri(tx, ty, bx + nx, by + ny, bx - nx * 0.6, by - ny * 0.6, 102); z5Tri(tx, ty, bx + nx * 0.6, by + ny * 0.6, bx - nx * 0.2, by - ny * 0.2, lit ? 106 : 104);
      lineP(tx, ty, bx + nx, by + ny, 107); glow(x, y, L * 0.8, T_EMBER, 0.3);
    }
    function a4GC(t) {
      const V = a4GV(GVC, t), g = t - A4CATCH, u = lin(98.9, 100.0, t), snapped = t >= A4SNAP, gs = t - A4SNAP;
      const B = a4Blade(t); if (!snapped) B.a += z5Sh(t, 21) * (0.004 + 0.006 * u * (1 + u * 2));
      const down = sstep(98.15, 98.6, t) * (1 - sstep(98.85, 99.25, t));
      const r = a4Giant(t, V, { blade: B, eyes: g < 0.6 ? 1.7 : 2, shake: snapped ? 0 : 0.8 + u, roar: snapped ? 0.6 * Math.exp(-gs * 2) : 0.2 * u, cracks: snapped ? 0 : Math.max(0.15 * g, 0.3 * sstep(98.4, 98.9, t) + u * 0.7), kink: snapped ? 0 : 0.12 * eic(u), noBlade: snapped,
        hero: down > 0.02 ? a4GHero(t, { S: Math.max(1, 0.95 * V.k), power: 1.3, sq: 0.12 + 0.06 * Math.sin(t * 13), legs: [0, 2, 2, 0], mouth: 2 }) : null });
      if (!snapped) {
        a4GripFx(r, t, g, 0.6 + 0.4 * Math.max(1 - g * 2, u));
        // light leaking through the cracks round his grip, and running down the blade to the hero
        const [bx, by] = a4BP(t, GDS), sx = r.X(bx), sy = r.Y(by);
        for (let k = 0; k < 16 * u; k++) { const a = ih(k, 1, 4903) * TAU, L = 20 + 60 * u * ih(k, 2, 4903); lineF(sx, sy, sx + Math.cos(a) * L, sy + Math.sin(a) * L, (x, y, q) => { if (bay(x, y) < (1 - q) * u) P(x, y, 22); }); }
        if (u > 0) glow(sx, sy, 60 + 80 * u, T_WH, 0.25 + 0.35 * u);
        if (down > 0) for (let q = 0; q < 5; q++) { const d = GDS * (1 - frac(t * 1.3 + q / 5)), [x, y] = a4BP(t, d); glow(r.X(x), r.Y(y), 14 * V.k, T_WH, 0.35 * down); }
      } else {
        // snapped: his hands wrench apart, the long half tumbles out of them and comes apart in the air
        const [bx, by] = a4BP(t, GDS), sx = r.X(bx), sy = r.Y(by), back = eic(Math.min(1, gs / 0.6));
        bigBlade(r.px, r.py + back * 120 * V.k, B.a, Math.hypot(sx - r.px, sy - r.py) * (1 - back * 0.3), 7 * V.k, t, { form: 'lastlight', flare: 0.6, cracks: 0.6 });
        for (let k = 0; k < 9; k++) {
          const d = 40 + k * 110, br = clamp((gs - 0.04 * k) * 3, 0, 1), px0 = sx + Math.cos(B.a) * d * V.k, py0 = sy + Math.sin(B.a) * d * V.k;
          const px = px0 + ((ih(k, 1, 4904) - 0.5) * 160 * gs + 30 * gs) * V.k, py = py0 + (520 * gs * gs + (ih(k, 2, 4904) - 0.5) * 60 * gs) * V.k, rot = B.a + (ih(k, 3, 4904) - 0.5) * 3 * gs;
          if (py > H + 60) continue;
          a4Frag(px, py, (30 + 26 * ih(k, 4, 4904)) * V.k, (7 + 6 * ih(k, 5, 4904)) * V.k, rot, br > 0.5);
        }
        if (gs < 0.4) glow(sx, sy, 200 * (1 - gs * 2.5), T_WH, 0.8);
        megaHit(sx, sy, gs, 2.8, B.a, [22, 106, 103], 4905);
        rocks(sx, sy, gs, 40, 300, 3, [104, 106, 107, 22], 4906, 300, B.a, 2.2);
      }
      a4Spray(V, t, snapped ? 1.4 : 1);
      shk(snapped ? (gs < 0.4 ? 8 : 3) : g < 0.4 ? 8 * (1 - g / 0.4) + 2 : 1.5 + u * 3);
      a4Cam(1.0, 0.03 * down - 0.02 * u + (snapped ? 0.04 * Math.exp(-gs * 4) : 0), 240, 135, snapped ? kick(t, [[A4SNAP, 3, B.a]]) : a4GK(t));
    }
    // ONE shot 94.2–100.35 (cut in on the impact of the first severing): GB, then on through the catch as GC
    shot(94.2, 100.35, (lt, t) => { if (t < A4CATCH) a4GB(t); else a4GC(t); });
    WHIPS.push([100.33, PI / 2]);
    /* ============================================================== 11 · the floor of the world (100.8–104.0)
       Point blank, his third eye blazing over the hero in the chasm: one fist, and it is driven straight down through the
       floor of the world, through the rock beneath it, into the dark; its fire goes out on the way down. */
    /* the floor of the world and the rock under it, side on: its top at screen y top; world depth d = y - top. The rock's
       own strata (the chasm's texture, tilted a little), lit by the hero's fire near (hx, hy) (burn 0..1); the bore it is
       driven through (half width by depth, opened by open 0..1), its broken walls glowing where its fire passes; and, at
       depth A4UNDER, the rock's ragged underside, with nothing below it */
    const A4UNDER = 430;
    function a4Bedrock(top, hx, hy, burn, open, t) {
      for (let y = Math.max(LB, fl(top)); y < H - LB; y++) {
        const d = y - top, row = y * W, R = a4TexRow(4926, fl(d * 1.1 + 600));
        for (let x = 0; x < W; x++) {
          const ub = A4UNDER + (vn(x, 0, 18, 4927) - 0.5) * 50 + (vn(x, 0, 5, 4928) - 0.5) * 12;
          if (d > ub) continue;
          const ft = (vn(x, 0, 26, 4801) - 0.5) * 8 + (vn(x, 0, 6, 4802) - 0.5) * 3;
          if (d < ft) continue;
          const hw = open * (d < 30 ? 58 - d * 0.5 : 34 + 9 * vn(d * 0.1, 0, 1, 4929)), dx = Math.abs(x - 172 - Math.sin(d * 0.03) * 6) - hw;
          if (dx < 0) { if (dx > -3 && bay(x, y) < 0.5) BUF[row + x] = 96; continue; }
          const dist = Math.hypot(x - hx, y - hy), hot = burn * clamp(1 - dist / 170, 0, 1);
          let c = a4Lit(R[(x + 37) % W], x, y, 0.12 + hot * 0.9, 0.08, (d - ft < 10 ? 1 : 0) + (hot > 0.4 ? 1 : 0) - (dx > 60 ? 1 : 0) - (ub - d < 24 ? 1 : 0));
          if (d - ft < 1.2) c = 121; else if (ub - d < 1.5) c = 99;
          else if (open > 0 && dx < 2) c = hot > 0.3 ? 104 : 102; else if (open > 0 && dx < 5 && bay(x, y) < 0.6) c = hot > 0.3 ? 103 : 101;
          BUF[row + x] = c;
        }
      }
    }
    function a4Punch(t) {
      const T = a4Slow(t, [100.8]), g = t - 100.8, hitv = g >= 0, wind = eio(lin(100.38, 100.66, T)), strike = eic(lin(100.64, 100.8, T)), drive = hitv ? eic(Math.min(1, (T - 100.8) / 0.45)) : 0, lean = eoc(lin(100.35, 100.62, t));
      // the camera goes down with it (the world rises past, not too fast to read)
      const dv = drive * 240, FT = 218 - dv;
      a4Deep(800 + dv * 0.5, t, 0.8, 1400);
      a4Wall(-1, 60, 820 + dv, t, 0.8, 1400, 4911, true);
      a4Wall(1, 420, 820 + dv, t, 0.8, 1400, 4912, true);
      const S = 3.0, hx = 170 + a4Tw(t, 18) * (hitv ? 0 : 1), hy = 176 + drive * 30;
      a4Bedrock(FT, hx, hy, 1 - drive * 0.4, hitv ? eoc(Math.min(1, g * 8)) : 0, t);
      if (hitv) groundCracks(172, FT, 160 * Math.min(1, g * 5), 12, 4917, 104, 99);
      a4Embers(t, 40, hitv ? 500 : 60, 4916, [106, 104]);
      // his face leaning in over it, the brother's eye in his brow blazing; he drops his weight into the blow
      const my = lerp(-10, 104, lean) - dv + 10 * strike;
      a4Sund(340, my, 2.3, t, { third: 1, eyes: 2, heat: 1, crown: 0.75, rage: 1, roar: 0.3 + 0.4 * strike, body: false, maskCuts: [[-17, -9, 17, 13, 1]], nod: 3 - 6 * wind * (1 - strike) + 9 * strike, lean: 22 * wind * (1 - strike) - 28 * strike, tilt: -0.1 * wind + 0.1 * strike });
      glow(340, my - 16 * 2.3, 130, T_MAG, 0.7); glow(340, my - 16 * 2.3, 40, T_WH, 0.5);
      const sq = hitv ? (T - 100.8 < 0.001 ? 0.6 : -0.35 * Math.min(1, (T - 100.8) * 8)) : 0;
      const fa = PI * 0.62, C = [hx + 2, hy - 8 * S * (1 - 0.4 * Math.max(0, sq))];
      // the burst behind them (its impact frame on the hit frame itself)
      const imp = hitv && g < 0.034;
      if (hitv && !imp) megaHit(C[0], C[1], g, 2.9, PI / 2, [22, 75, 103], 4913);
      // the fist: cocked up and back, then down onto it — the knuckles on its crown on the hit frame — and on down with it
      const kx = hitv ? C[0] + 6 * drive : lerp(lerp(C[0] + 120, C[0] + 165, wind), C[0], strike), ky = hitv ? C[1] + 10 * Math.min(1, (T - 100.8) * 10) : lerp(lerp(C[1] - 70, C[1] - 105, wind), C[1], strike);
      const r = a4Arm(kx - Math.cos(fa) * 10.8 * 3.2, ky - Math.sin(fa) * 10.8 * 3.2, 3.2, fa, 'fist', 1, t, { bend: 0.5 - 0.3 * strike, side: 1, rim: 1 });
      // the hero, in front of the knuckles, with what is left of the blade: crushed on the hit frame, then driven down,
      // its fire lighting the fist from below
      const a = a4Last(hx, hy, S, t, { eyes: hitv ? 'closed' : 'wide', mouth: 2, sw: -1.2, still: hitv, power: 1 - drive * 0.4, ang: drive * 0.4, sq });
      bigBlade(a.hand[0], a.hand[1], -1.2, 70, 5, t, { form: 'lastlight', flare: 0.6, cracks: 0.6 });
      if (hitv) glow(r.knuckles ? r.knuckles[0] : kx, ky, 70, T_FIRE, 0.35 * (1 - drive * 0.5));
      if (strike > 0.2 && !hitv) streaks(fa, 30, t, 4000, 103, 120, 4915, [0, LB, W, H - 2 * LB]);
      if (hitv) { if (imp) megaHit(C[0], C[1], g, 2.9, PI / 2, [22, 75, 103], 4913); rocks(172, FT, g, 30, 260, 4, [97, 99, 121, 104], 4918, -200, -PI / 2, 2.6); streaks(PI / 2, 30, t, 2400, 103, 90, 4914, [0, LB, W, H - 2 * LB]); }
      shk(hitv && g < 0.6 ? 9 * (1 - g / 0.6) + 2 : 1); a4Cam(1.0 + 0.06 * wind * (1 - strike), 0.03 * wind * (1 - strike), 240, 135, kick(t, [[100.8, 3.5, PI / 2]]));
    }
    // on down through the rock beneath the world, out of its underside, and then nothing but the dark; its fire going out,
    // plain and cracked again, a broken hilt in its hand
    function a4Plunge(t) {
      const u = lin(101.25, 104.0, t), fade = eio(lin(102.2, 103.7, t));
      BUF.fill(0, LB * W, (H - LB) * W);
      const S = lerp(3.0, 1.6, eio(u)), hx = lerp(170, 240, eio(lin(101.8, 102.8, t))) + Math.sin(t * 1.3) * 8 * u, hy = lerp(206, 150, eoc(Math.min(1, u * 2.5))) + 26 * eic(u) + Math.sin(t * 2) * 2 * u;
      const burning = 1 - eio(lin(101.8, 102.9, t));
      // the rock rushing up past it (carrying on from the punch's fall), the underside, and the dark under it
      const D = 640 * eoc(lin(101.25, 102.9, t)), top = 218 - 240 - D - (t - 101.25) * 20;
      a4Bedrock(top, hx, hy, burning, 1, t);
      { const uy = top + A4UNDER; if (uy > LB - 40 && uy < H) for (let k = 0; k < 30; k++) { const g = frac(ih(k, 1, 4930) + t * 0.7), x = ih(k, 2, 4930) * W, y = uy + 10 + g * 200 * (0.5 + ih(k, 3, 4930)); if (bay(fl(x), fl(y)) < 1 - g) P(x, y, k % 3 ? 97 : 99); } }
      // grit and chips of rock falling with it
      for (let k = 0; k < 40; k++) { const sp = 700 * (1 - u * 0.7), y = H - LB - frac(ih(k, 1, 4925) + t * sp / 218) * 218, x = ih(k, 2, 4925) * W; if (bay(fl(x), fl(y)) < 0.8 - u * 0.5) { P(x, y, k % 3 ? 97 : 121); P(x, y + 1, 96); } }
      if (t < 101.9) streaks(-PI / 2, 22, t, 1800 * (1 - lin(101.25, 101.9, t)), 103, 70, 4924, [0, LB, W, H - 2 * LB]);
      glow(hx, hy, 60 * S * burning + 14 * (1 - fade), burning > 0.1 ? T_FIRE : T_WARM, 0.45 * burning + 0.2 * (1 - fade));
      const form = burning > 0.5 || (burning > 0.15 && fl(t * 15) % 2) ? 'lastlight' : undefined;
      const a = actor(HERO3({ form, eyes: 'closed', sword: null, legs: z5Limp(t, 1.6), cracks: 0.9, sq: -0.05 }), hx, hy, S, 0.3 + u * 0.5 + Math.sin(t * 0.8) * 0.1, false, { still: true });
      if (burning > 0.2) aura(t, LASTF, 4 * S * burning, { sparks: fl(12 * burning), rise: -1.5 });
      a4Sword(a.hand[0], a.hand[1], 0.3 + u * 0.5 + 0.9, S * 0.9, null, false, true);
      // embers peeling off it and falling behind (upward, as it drops)
      for (let k = 0; k < 20; k++) { const q = frac(ih(k, 1, 4923) + t * 1.2), x = hx + (ih(k, 2, 4923) - 0.5) * 40, y = hy - q * 120; if (bay(fl(x), fl(y)) < (1 - q) * (burning * 0.8 + 0.2)) P(x, y, burning > 0.3 ? 104 : 37); }
      // the light goes out
      tintAll(T_DARK, 0.15 + 0.7 * fade);
      a4Cam(1.0, 0, 240, 135);
    }
    // ONE shot 100.35–104.0 (the whip down from the snap hides the cut into it): his face over the hero in the chasm, the
    // fist wound up with his whole weight and driven down; the camera falls with the hero through the floor of the world
    shot(100.35, 104.0, (lt, t) => { if (t < 101.25) a4Punch(t); else a4Plunge(t); });
  }
