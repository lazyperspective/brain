  /* ================================================================ act IV — the stranger power (58.0–104.0) · agent A
     The Sunderer turns his brother's eye on the hero and plays NOVA backwards; then he cuts the world in two, and breaks the
     hero in the chasm: the storm, the gold, the four orbs crushed one by one. On the floor of the world, the hero burns its
     own life (LAST LIGHT) and the sword grows out of the chasm through the clouds; it takes two of his arms and his face,
     and then he catches it, snaps it, and drives the hero down through the floor of the world into the dark. */
  {
    /* -------------------------------------------------------------- state and helpers (all a4…) */
    const A4W0 = [[-60, 58, 44, 112, 3.5], [70, 34, 92, 52, 4]];             // his two wounds at 58.0 (they rewind closed)
    const A4SAVE = new Uint8Array(NP), A4SAVE2 = new Uint8Array(NP);
    const A4L = PAL.map((p) => p[0] * 0.3 + p[1] * 0.55 + p[2] * 0.15);
    const WARMF = [104, 105, 106, 107, 108, 109, 110], CORONA = [103, 105, 106, 107], LASTF = [101, 103, 104, 107];
    const ORBD = [[45, 46, 47], [48, 49, 50], [51, 52, 53], [54, 55, 56]];
    if (!FONT['—']) FONT['—'] = ['.....', '.....', '.....', '#####', '.....', '.....', '.....'];
    // the camera: zoom z and roll r about world (fx, fy) at the frame centre, plus a kick (from kick())
    function a4Cam(z, r, fx, fy, k) { k = k || [0, 0, 0, 0]; z5Cam(Math.max(1, z + k[0]), r + k[1], fx - k[2], fy - k[3], 240, 135); }
    const a4Tw = (t, s) => Math.sin(t * 23 + s) * 0.5 + Math.sin(t * 37 + s * 1.7) * 0.3 + Math.sin(t * 59 + s * 2.9) * 0.2;   // a tremble

    /* the Sunderer, with his body drawn by a faster copy of the engine's own body pass (the same picture: seams looked up in a
       precomputed field, the row shape computed once per row), so that he can fill the frame and stay inside the budget */
    let A4SG = null; const SGX0 = -132, SGX1 = 132, SGY0 = 10, SGY1 = 430, SGR = 2, SGW = (SGX1 - SGX0) * SGR, SGH = (SGY1 - SGY0) * SGR;
    function a4Seams() {
      if (A4SG) return A4SG;
      A4SG = new Float32Array(SGW * SGH);
      for (let j = 0; j < SGH; j++) for (let i = 0; i < SGW; i++) A4SG[j * SGW + i] = seamAt((SGX0 + (i + 0.5) / SGR) / 24 + 3, (SGY0 + (j + 0.5) / SGR) / 22);
      return A4SG;
    }
    function a4In(lx, ly, hw, nl, nr) {
      if (hw < 0) return false;
      const ax = lx < 0 ? -lx : lx;
      if (ly < 46 && ax > 26) { const top = 30 + Math.pow(Math.max(0, ax - 26) / 82, 1.6) * 16; if (ly < top) return false; }
      return ax < hw + ((lx > 0 ? nr : nl) - 0.5) * 8;
    }
    function a4Body(cx, cy, s, t, o) {
      const heat = o.heat === undefined ? 0.5 : o.heat, dark = o.dark || 0, core = o.core === undefined ? 1 : o.core, wounds = o.wounds || [], G = a4Seams();
      const x0 = Math.max(0, fl(cx - 112 * s - 60)), x1 = Math.min(W - 1, Math.ceil(cx + 112 * s + 60)), y0 = Math.max(LB, fl(cy + 14 * s - 40)), y1 = H - LB - 1;
      const pulse = 0.5 + 0.5 * Math.sin(t * 2.2), is = 1 / s;
      for (let y = y0; y <= y1; y++) {
        const ly = (y + 0.5 - cy) * is, hw = sHW(ly); if (hw < 0) continue;
        const nl = vn(ly * 0.08, 0, 1, 973), nr = vn(ly * 0.08, 1, 1, 973), lu = ly - 2.2, hwu = sHW(lu), nlu = vn(lu * 0.08, 0, 1, 973), nru = vn(lu * 0.08, 1, 1, 973);
        const xa = Math.max(x0, fl(cx - (hw + 5) * s)), xb = Math.min(x1, Math.ceil(cx + (hw + 5) * s)), gj = fl((ly - SGY0) * SGR), row = y * W;
        for (let x = xa; x <= xb; x++) {
          const lx = (x + 0.5 - cx) * is;
          if (!a4In(lx, ly, hw, nl, nr)) continue;
          if (!a4In(lx + 2.2, ly, hw, nl, nr) || !a4In(lx - 2.2, ly, hw, nl, nr) || !a4In(lx, lu, hwu, nlu, nru)) { BUF[row + x] = heat > 0.2 ? (lx < 0 ? 102 : 101) : 98; continue; }
          const ax = lx < 0 ? -lx : lx;
          // the planes (sPlanes, inlined)
          let pk, groove = false;
          const pu = (ax - 36) / 38, pv = (ly - 64) / 24, pr = pu * pu + pv * pv;
          if (ax < 3.2 && ly > 44 && ly < 150) { pk = -1.5; groove = true; }
          else if (pr < 1) { pk = 0.4 - pv * 1.1 - pu * 0.3; groove = pr > 0.86 && pv > 0; }
          else if (ly > 90 && ly < 150 && ax < 44) { const f = frac((ly - 90) / 20), col = ax / 22; if (f < 0.12 || Math.abs(col - 1) < 0.07) { pk = -1.4; groove = true; } else pk = 0.3 - f * 1.1 - col * 0.25; }
          else pk = -0.6 - (ax - 40) / 90;
          const lit = 0.45 - lx / 260 + pk * 0.42;
          let c = OBS[clamp(fl(lit * 3.2 + (bay(x, y) - 0.5) * 0.9), 0, 4)];
          const dh = Math.sqrt(lx * lx + (ly - 70) * (ly - 70) * 1.44), vh = Math.min(1, heat * 1.3 * Math.max(0, 1 - dh / 120));
          if (groove) c = vh > 0.5 ? (vh > 0.7 ? 104 : 103) : vh > 0.3 ? 102 : 96;
          else {
            const gi = fl((lx - SGX0) * SGR), sd_ = gi >= 0 && gi < SGW && gj >= 0 && gj < SGH ? G[gj * SGW + gi] : seamAt(lx / 24 + 3, ly / 22), wv = 0.012 + vh * vh * 0.11;
            if (sd_ < wv) c = sd_ < wv * 0.4 && vh > 0.3 ? (vh > 0.55 ? (pulse > 0.5 ? 106 : 105) : 104) : vh > 0.15 ? 103 : 101;
          }
          if (ly < 56) for (let sd = -1; sd <= 1; sd += 2) { const px = (lx - sd * 84) / 36, py = (ly - 40) / 22, pr2 = px * px + py * py; if (pr2 < 1) { c = pr2 > 0.84 ? 69 : bone(px * 0.9, py - 0.5, x, y, -0.2); if (Math.abs(py - 0.15 - px * px * 0.3) < 0.08) c = 96; if (Math.abs(py + 0.35 - px * px * 0.25) < 0.05) c = 68; } }
          const hy = ly - 70, hr = Math.sqrt(lx * lx + hy * hy);
          if (core > 0 && hr < 15) c = hr < 13 ? (hr < 6 * core ? (hr < 3 * core ? 22 : 107) : hr < 10 ? (Math.abs(Math.sin(Math.atan2(hy, lx) * 4 + t)) < 0.25 ? 105 : 103) : 102) : 96;
          for (let k = 0; k < wounds.length; k++) { const [ax0, ay0, ax1, ay1, ww] = wounds[k], ddx = ax1 - ax0, ddy = ay1 - ay0, L2 = ddx * ddx + ddy * ddy || 1, u = clamp(((lx - ax0) * ddx + (ly - ay0) * ddy) / L2, 0, 1), d = Math.hypot(lx - ax0 - ddx * u, ly - ay0 - ddy * u), w3 = ww || 3; if (d < w3) c = d < w3 * 0.45 ? 22 : 105; else if (d < w3 + 1.5) c = 101; }
          if (dark > 0 && c !== 22 && c < 103 && bay(x, y) < dark) c = 96;
          BUF[row + x] = c;
        }
      }
      if (heat > 0) glow(cx, cy + 70 * s, 40 * s, T_EMBER, 0.35 * heat * core);
    }
    function a4Sund(cx, cy, s, t, o) {
      o = o || {};
      sunderer(cx, cy, s, t, Object.assign({}, o, { body: false, mask: false, arms: [] }));     // the crown and his heat on the air
      if (o.body !== false) a4Body(cx + (o.shake ? z5Sh(t, 7) * o.shake : 0), cy + (o.still ? 0 : Math.sin(t * 0.9) * s), s, t, o);
      return sunderer(cx, cy, s, t, Object.assign({}, o, { body: false, crown: 0, glow: 0 }));
    }
    const A4ARMS = (a, b, c, d) => [a, b, c, d];

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
          let c = dd < 1.5 ? (lit > 0.5 ? 103 : 99) : dd < 4 ? (lit > 0.5 ? 102 : 98) : dd < 10 + 9 * vn(wx, y, 9, 4412) ? 121 : 97;
          if (bay(x, y) < 0.14 && dd > 4) c = 120;
          BUF[y * W + x] = c;
        }
      }
    }
    // a stump of rock out of the sea: flat broken top at (x0..x1, top), jagged sides down to the water
    function a4Rock(x0, x1, top, bot, seed, lit) {
      for (let y = Math.max(LB, fl(top)); y < Math.min(H - LB, bot); y++) {
        const v = (y - top) / (bot - top), l = x0 - v * 14 - vn(y * 0.3, 1, 1, seed) * 8, r = x1 + v * 12 + vn(y * 0.3, 2, 1, seed) * 8;
        for (let x = Math.max(0, fl(l)); x <= Math.min(W - 1, r); x++) {
          const e = (x - l) / Math.max(1, r - l);
          BUF[y * W + x] = y - top < 2 ? (lit ? 123 : 122) : e < 0.18 ? (lit ? 122 : 99) : e > 0.8 ? 97 : bay(x, y) < 0.3 ? 98 : 99;
        }
      }
    }
    // a column of falling water (the sea pouring into the chasm), from y0 down to y1 at x
    function a4Falls(x, y0, y1, w, t, seed) {
      for (let y = Math.max(LB, fl(y0)); y < Math.min(H - LB, y1); y++) for (let q = 0; q < w; q++) {
        const n = ih(fl(x + q), fl(y - t * 220) >> 2, seed);
        if (n < 0.35) continue;
        P(x + q, y, n > 0.85 ? 22 : n > 0.6 ? 119 : 118);
      }
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
        arms: [{ x: -142, y: 38 - turn * 10, pose: 'open', ang: -PI / 2 - 0.5 - turn * 1.3 }, { x: 128, y: 150, pose: 'fist' }, { x: -84, y: 186, pose: 'fist' }, { x: 92, y: 182, pose: 'fist' }] });
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
      if (t < 58.034) impactFrame(bx, by, 1);
      const pz = eio(lin(58.1, 59.85, t));
      a4Cam(1 + 0.22 * pz, (rw ? 0.02 * a4Tw(t * 0.3, 2) : 0), lerp(240, 190, pz), lerp(135, 158, pz), kick(t, [[58.0, 2.5, -PI / 2]]));
      shk(rw ? 1.5 : 0); if (g0 < 0.3) shk(6 * (1 - g0 / 0.3));
    });
  
    /* -------------------------------------------------------------- the chasm */
    // a wall of the chasm: rock from the frame edge to a jagged face at xe (side -1: the wall is on the left), oy the camera's
    // depth (world y = y + oy); molten seams burn in it, hotter near the top (heat at depth 0, cooling with depth over cool px)
    function a4Wall(side, xe, oy, t, heat, cool, seed, lit) {
      seed = seed || 4501; cool = cool || 900;
      for (let y = LB; y < H - LB; y++) {
        const wy = y + oy, e = xe + (vn(wy * 0.05, 0, 1, seed) - 0.5) * 36 + (vn(wy * 0.21, 0, 1, seed + 1) - 0.5) * 9, hy = heat * clamp(1 - wy / cool, 0, 1);
        const xa = side < 0 ? 0 : Math.max(0, fl(e)), xb = side < 0 ? Math.min(W - 1, fl(e)) : W - 1, row = y * W;
        for (let x = xa; x <= xb; x++) {
          const d = side < 0 ? e - x : x - e;
          const n = vn(x * 0.9 + wy * 0.13, wy * 0.11, 9, seed + 2), v = Math.abs(vn(x * 0.035 + 40, wy * 0.018, 1, seed + 3) - 0.5);
          let c = d < 1.5 ? (lit ? 122 : 100) : d < 4 ? (lit ? 100 : 99) : n > 0.62 ? 99 : n > 0.35 ? 98 : 97;
          if (v < 0.006 + hy * 0.014) c = hy > 0.55 ? (v < 0.008 ? 106 : 104) : hy > 0.25 ? 103 : hy > 0.08 ? 102 : 101;
          else if (d > 60 && bay(x, y) < 0.3) c = 96;
          BUF[row + x] = c;
        }
      }
    }
    // the inside of the chasm behind the walls: its far face, dim, seams and glow fading with depth
    function a4Deep(oy, t, heat, cool) {
      cool = cool || 900;
      for (let y = LB; y < H - LB; y++) {
        const wy = y + oy, hy = heat * clamp(1 - wy / cool, 0, 1), row = y * W, base = hy > 0.6 ? 101 : hy > 0.3 ? 98 : hy > 0.1 ? 97 : 96;
        for (let x = 0; x < W; x++) {
          const v = Math.abs(vn(x * 0.04, wy * 0.02, 1, 4511) - 0.5);
          BUF[row + x] = v < 0.01 + hy * 0.02 && hy > 0.05 ? (hy > 0.5 ? 103 : 102) : bay(x, y) < hy * 0.5 ? (hy > 0.5 ? 102 : 101) : base;
        }
      }
    }
    // embers and grit drifting in the chasm (dir: +1 rising, -1 falling, speed px/s)
    function a4Embers(t, n, speed, seed, cols) {
      cols = cols || [105, 103];
      for (let k = 0; k < n; k++) { const y = LB + frac(ih(k, 1, seed) - t * speed / 218) * 218, x = ih(k, 2, seed) * W + Math.sin(t * 1.3 + k) * 6; P(x, y, cols[k & 1]); if (k % 3 === 0) P(x, y + (speed > 0 ? 1 : -1), 101); }
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
    shot(60.0, 61.15, (lt, t) => {
      gradient(LB, 180, [96, 97, 98, 9, 10, 98]);
      for (let k = 0; k < 7; k++) { const x = 30 + k * 70 + Math.sin(k * 3.1) * 20, y = 120 + Math.sin(k * 1.7) * 20; glow(x, y, 26 + (k % 3) * 8, T_EMBER, 0.5); discF(x, y, 3 + (k % 2) * 2, k % 2 ? 103 : 102); }
      for (let y = 180; y < H - LB; y++) for (let x = 0; x < W; x++) BUF[y * W + x] = bay(x, y) < (y - 180) / 70 ? 114 : 115;
      // his mass at the frame's right edge, out of focus: dark, a seam of fire, the third eye far up
      for (let y = LB; y < H - LB; y++) { const e = 400 + Math.sin(y * 0.02) * 10 + (y - LB) * 0.15; for (let x = fl(e); x < W; x++) BUF[y * W + x] = bay(x, y) < 0.2 ? 98 : 97; }
      lineF(430, LB, 452, H - LB, (x, y) => { if (bay(x, y) < 0.6) P(x, y, 102); });
      glow(452, 40, 30, T_MAG, 0.5);
      a4Embers(t, 30, -14, 4531, [103, 102]);
      const tr = a4Tw(t, 3) * (0.6 + lt * 0.5), S = 5;
      const hx = 196 + tr * 0.8, hy = 160 + Math.sin(lt * 2.2) * 1.5;
      a4Halo(hx, hy, 96, t * 0.6, 6, 0.4, null, false);
      const a = actor(HERO3({ eyes: lt > 0.95 && lt < 1.05 ? 'closed' : 'wide', mouth: lt > 0.5 ? 1 : 0, sword: -1.05 + tr * 0.025, legs: [0, 0, 0, 0] }), hx, hy, S, -0.04, false, { bob: 0 });
      a4Halo(hx, hy, 96, t * 0.6, 6, 0.4, null, true);
      // the last ember of NOVA lifts off the blade and goes out
      const g = lt - 0.15; if (g > 0 && g < 0.9) { const q = g / 0.9, x = lerp(a.tip[0] - 20, a.tip[0] + 10, q), y = a.tip[1] + 18 - q * 50 - Math.sin(q * 9) * 3; sparkle(x, y, 3 * (1 - q) + 0.6, q < 0.5 ? 22 : 106, 105); glow(x, y, 14 * (1 - q), T_NOVA, 0.5 * (1 - q)); }
      a4Cam(1 + 0.05 * lt, 0, 220, 140);
    });
    // low on the rock, looking up past the hero: his hand rises above his head into the cloud light, flat as a blade
    shot(61.15, 62.0, (lt, t) => {
      const rise = eio(lin(61.18, 61.78, t)), chop = eic(lin(61.88, 62.0, t)), camY = 60 * eio(lin(61.15, 61.8, t));
      belowWorld(t, 168 + camY, t * 10, 0.85);
      a4Ceil(LB + camY * 0.5 - 4, 26, 70, null, 1);
      const hx = lerp(lerp(150, 30, rise), -170, chop), hy = lerp(lerp(150, -96, rise), 240, chop);
      const so = a4Sund(318, 110 + camY, 0.95, t, { third: 1, eyes: 1.2, heat: 0.8, crown: 0.75, tilt: 0.04 * rise - 0.1 * chop, nod: -2 * rise,
        arms: [{ x: -150, y: 150, pose: 'fist' }, { x: hx, y: hy, pose: 'chop', ang: lerp(-PI / 2 - 0.1, PI * 0.7, chop), heat: 0.6 + rise * 0.4 }, { x: -86, y: 196, pose: 'fist' }, { x: 92, y: 192, pose: 'fist' }] });
      const [qx, qy] = so.hands[1];
      if (rise > 0.9 && chop < 0.1) { glow(qx, qy, 40, T_EMBER, 0.6); sparkle(qx + 4, qy - 22, 2 + 4 * frac(t * 3), 22, 106); }
      if (chop > 0.05) { streaks(Math.atan2(240 - hy, -170 - hx), 26, t, 2600, 105, 90, 4541, [0, LB, W, H - 2 * LB]); smearArc(318 + 84 * 0.95, 110 + camY + 40 * 0.95, -PI / 2, -PI / 2 + chop * 2.2, 190, [102, 104, 22]); }
      // the hero on its rock in the near corner, small, its back half to us, watching it rise
      a4Rock(-20, 150, 222 + camY * 0.7, 300, 4422, true);
      actor(HERO3({ eyes: 'wide', sword: 0.5, legs: [0, 0, 0, 0] }), 92, 206 + camY * 0.7 - 14, 1.6, 0.02, false, {});
      a4Halo(92, 192 + camY * 0.7, 24, t * 0.6, 1.6, 0.3, null, true);
      shk(chop > 0 ? 3 : rise > 0.95 ? 0.6 : 0);
      a4Cam(1.02 + 0.03 * rise, -0.02 * rise, 240, 135);
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
            const fall = (1 - e) * 1.0, wy = y * 1.0 - t * 160;
            c = e > 0.9 ? (ih(x, fl(wy) >> 1, 4571) < 0.6 ? 119 : 22) : e > 0.55 ? (vn(x * 0.3, wy * 0.3, 3, 4572) > 0.5 ? 99 : 98) : e > 0.3 ? (bay(x, y) < 0.5 ? 101 : 102) : e > 0.12 ? 104 : e > 0.04 ? 106 : 22;
            if (e > 0.55 && e < 0.9 && ih(fl(x * 0.5), fl(wy * 0.25), 4573) < 0.06 * fall + 0.03) c = 118;
          } else c = e < 0.3 ? 22 : e < 0.6 ? 107 : e < 0.85 ? 105 : 103;
          BUF[row + x] = c;
        }
      }
    }
    const SVX = 236, SHZ = 138, SBX = 176;
    const a4Gap = (t) => 150 * eoc(lin(62.04, 62.9, t)) + 40 * lin(62.9, 64, t);
    shot(62.0, 62.6, (lt, t) => {
      const g = t - 62.0, gap = a4Gap(t), sky = 26 * eoc(lin(62.04, 62.7, t)), run = eoc(lin(62.0, 62.09, t));
      belowWorld(t, SHZ, 120 + t * 10, 0.85);
      a4Ceil(LB - 4, 34, 40, null, 1);
      a4Rock(40, 128, 214, 260, 4421, true);
      actor(HERO3({ eyes: 'wide', sword: 0.5, legs: [0, 0, 0, 0], mouth: 1 }), 86, 194, 1.25, 0.12 * sstep(0.25, 0.55, g), false, { still: true });
      a4Sunder(SVX, SHZ, SBX, gap, sky, run, t);
      // he is on the far side of the line, slid away with his half; the hand that cut it lies along its lip, lifting off it
      const lift = eio(lin(62.15, 62.6, t)), sl = gap * 0.42;
      a4Sund(392 + sl * 0.5, 62, 0.66, t, { third: 1, eyes: 1.4, heat: 0.9, crown: 0.75, rage: 0.4, nod: 2,
        arms: [{ x: -150, y: 150, pose: 'fist' }, { x: 120, y: 170, pose: 'fist' }, { x: -86, y: 196, pose: 'fist' }, { x: -150 + sl * 0.4 + lift * 30, y: 268 - lift * 40, pose: 'chop', ang: PI * 0.7 - lift * 0.4, front: true }] });
      // steam boiling up out of the whole length of it, and spray where the sea goes over
      for (let k = 0; k < 16; k++) { const q = ih(k, 1, 4552), y = lerp(SHZ + 4, H - LB, q), cx = lerp(SVX, SBX, (y - SHZ) / (H - LB - SHZ)), up = frac(ih(k, 2, 4552) + g * 0.9); cloudPuff(cx + (ih(k, 3, 4552) - 0.5) * 20 * q, y - up * (30 + 60 * q), (5 + up * 14) * (0.4 + q), [120, 121, 122, 123], 4553 + k); }
      rocks(SBX + 8, 230, g, 18, 300, 4, [97, 99, 122, 105], 4554, 220, -PI / 2, 1.2);
      rocks(SVX, SHZ + 6, g, 10, 90, 2, [97, 99, 122, 105], 4556, 120, -PI / 2, 1.2);
      // the cut itself: a line of white light the length of the world, then the light of the chasm on everything
      if (g < 0.1) { const k = 1 - g / 0.1; glow(SBX + 10, 200, 160 * k, T_WH, 0.7); lineF(SBX, H - LB, SVX, SHZ, (x, y) => { thick(x, y, x, y, 2, 22); }); lineP(SVX, SHZ, SVX + 2, LB, 22); }
      glow(SBX + 10, 230, 120, T_EMBER, 0.4 * eoc(lin(62.05, 62.4, t)));
      megaHit(SBX + 6, 238, g, 2.6, -PI / 2, [22, 106, 103], 4555);
      a4Cam(1 + 0.05 * g, -0.01 * g, 240, 135, kick(t, [[62.0, 3, PI / 2]]));
      shk(2 + 6 * Math.max(0, 1 - g * 2));
    });
    // close on the lip: across the chasm the far wall, the sea pouring over its edge; the slab under the hero tips out over
    // the drop and it goes with it
    shot(62.6, 63.0, (lt, t) => {
      const fall = eic(lin(62.68, 63.0, t)), tilt = eio(lin(62.6, 62.8, t)) * 0.3 + fall * 0.6, dropY = fall * 50;
      gradient(LB, 70, [98, 101, 102, 103]);
      a4Wall(1, -40, -70 - dropY, t, 0.7, 700, 4561, true);
      for (let k = 0; k < 5; k++) { const x = 40 + k * 96 + Math.sin(k * 2.7) * 24; a4Falls(x, 66 - dropY, H - LB, 12 + (k % 3) * 6, t, 4562 + k); }
      for (let x = 0; x < W; x++) for (let y = 62 - dropY; y < 68 - dropY; y++) if (y >= LB && ih(x, fl(y + t * 30), 4566) < 0.7) P(x, y, ih(x, y, 4567) < 0.3 ? 22 : 118);
      glow(300, H - LB, 220, T_EMBER, 0.5);
      // the slab: pivoting out over the drop about its outer lip
      const px = 262, py = 196 - dropY * 0.2, ca = Math.cos(tilt), sa = Math.sin(tilt);
      const R = (x, y) => [px + (x - px) * ca - (y - py) * sa, py + (x - px) * sa + (y - py) * ca + dropY];
      { const a = R(-60, py), b = R(px, py), c = R(px - 10, py + 120), d = R(-60, py + 120); z5Tri(a[0], a[1], b[0], b[1], c[0], c[1], 98); z5Tri(a[0], a[1], c[0], c[1], d[0], d[1], 99); thick(a[0], a[1], b[0], b[1], 2, 123); }
      const hp = R(226 + fall * 26, py - 34), hx = hp[0] + fall * 40, hy = hp[1] + fall * fall * 150;
      actor(HERO3({ eyes: 'wide', mouth: 2, sword: lerp(0.5, -1.6, fall), legs: fall > 0.1 ? z5Limp(t, 1) : [0, 0, 0, 0] }), hx, hy, 2.6, tilt * 0.8 + fall * 1.6, false, {});
      rocks(262, 196, t - 62.62, 12, 120, 3, [97, 99, 122, 105], 4564, 300, PI / 2, 2);
      a4Embers(t, 30, 50, 4565);
      shk(2.5);
      a4Cam(1.04, 0.04 * tilt, 240, 135 + fall * 14);
    });
  }
