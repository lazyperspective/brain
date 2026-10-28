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
      if (t < 58.02) impactFrame(bx, by, 1);
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
          const n = vn(x * 0.9 + wy * 0.13, wy * 0.11, 9, seed + 2), v = seamAt(x / 70 + seed, wy / 56) + (vn(x, wy, 40, seed + 5) < 0.45 ? 1 : 0);
          let c = d < 1.5 ? (lit ? 122 : 100) : d < 4 ? (lit ? 100 : 99) : n > 0.62 ? 99 : n > 0.35 ? 98 : 97;
          if (v < 0.015 + hy * 0.03) c = hy > 0.55 ? (v < 0.015 ? 106 : 104) : hy > 0.25 ? 103 : hy > 0.08 ? 102 : 101;
          else if (d > 60 && bay(x, y) < 0.3) c = 96;
          BUF[row + x] = c;
        }
      }
    }
    // the inside of the chasm behind the walls: its far face, dim, seams and glow fading with depth
    function a4Deep(oy, t, heat, cool) {
      cool = cool || 900;
      for (let y = LB; y < H - LB; y++) {
        const wy = y + oy, hy = heat * clamp(1 - wy / cool, 0, 1), row = y * W, base = hy > 0.6 ? 98 : hy > 0.3 ? 97 : 96;
        for (let x = 0; x < W; x++) {
          const v = seamAt(x / 60 + 7, wy / 80) + (vn(x, wy, 50, 4512) < 0.45 ? 1 : 0), n = vn(x, wy * 0.25, 24, 4513);
          BUF[row + x] = v < 0.01 + hy * 0.015 && hy > 0.05 ? (hy > 0.5 ? 103 : 102) : bay(x, y) < hy * 0.3 + n * 0.25 ? (hy > 0.5 ? 101 : 97) : base;
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
      a4Halo(hx, hy, 100, t * 0.6, 7, 0.75, null, false);
      const a = actor(HERO3({ eyes: lt > 0.95 && lt < 1.02 ? 'closed' : 'wide', mouth: lt > 0.6 ? 2 : lt > 0.25 ? 1 : 0, sword: -1.05 + tr * 0.025, legs: [0, 0, 0, 0] }), hx, hy, S, -0.04, false, { bob: 0 });
      a4Halo(hx, hy, 100, t * 0.6, 7, 0.75, null, true);
      // it tries to make the blade grow again: twice the light runs up it and gutters out, the second time weaker
      const ba = Math.atan2(a.tip[1] - a.hand[1], a.tip[0] - a.hand[0]);
      for (const [t0, pw] of [[0.22, 1], [0.62, 0.5]]) {
        const g = lt - t0; if (g < 0 || g > 0.32) continue;
        const up = eoc(Math.min(1, g / 0.1)), dn = 1 - eic(lin(0.1, 0.32, g)), L = 29 * S * (1 + 1.3 * pw * up * dn);
        bigBlade(a.hand[0], a.hand[1], ba, L, 4.5, t, { form: 'nova', grow: 0.999, flare: 0.8 * pw * dn });
        glow(a.tip[0], a.tip[1], 40 * pw * dn, T_NOVA, 0.6 * dn);
        if (g > 0.1) for (let k = 0; k < 8 * pw; k++) { const q = (g - 0.1) / 0.22, x = a.tip[0] + (ih(k, 1, 4533) - 0.5) * 30 * q, y = a.tip[1] - 10 + q * 60 * ih(k, 2, 4533) + q * q * 40; if (bay(fl(x), fl(y)) < 1 - q) P(x, y, q < 0.5 ? 106 : 103); }
      }
      // the last ember of it drifts off the point and goes out
      const g = lt - 0.7; if (g > 0 && g < 0.45) { const q = g / 0.45, x = a.tip[0] + q * 14, y = a.tip[1] - q * 26 - Math.sin(q * 9) * 3; sparkle(x, y, 2.5 * (1 - q) + 0.6, q < 0.5 ? 22 : 106, 105); }
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
    const a4Gap = (t) => 260 * eoc(lin(62.04, 62.9, t)) + 40 * lin(62.9, 64, t);
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
      for (let k = 0; k < 9; k++) { const q = 0.15 + 0.8 * ih(k, 1, 4552), y = lerp(SHZ + 4, H - LB, q), cx = lerp(SVX, SBX, (y - SHZ) / (H - LB - SHZ)), up = frac(ih(k, 2, 4552) + g * 0.9); cloudPuff(cx + (ih(k, 3, 4552) - 0.5) * 20 * q, y - up * (30 + 60 * q), (5 + up * 14) * (0.4 + q), [120, 121, 122, 123], 4553 + k); }
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
      const fall = eic(lin(62.72, 63.04, t)), tilt = eio(lin(62.6, 62.8, t)) * 0.3 + fall * 0.6, dropY = fall * 50;
      gradient(LB, 70, [98, 101, 102, 103]);
      a4Wall(1, -40, -70 - dropY, t, 0.7, 700, 4561, true);
      for (let k = 0; k < 3; k++) { const x = 60 + k * 150 + Math.sin(k * 2.7) * 24; a4Falls(x, 66 - dropY, H - LB, 16 + (k % 2) * 10, t, 4562 + k); }
      for (let x = 0; x < W; x++) for (let y = 62 - dropY; y < 68 - dropY; y++) if (y >= LB && ih(x, fl(y + t * 30), 4566) < 0.7) P(x, y, ih(x, y, 4567) < 0.3 ? 22 : 118);
      glow(300, H - LB, 220, T_EMBER, 0.5);
      // the slab: pivoting out over the drop about its outer lip
      const px = 262, py = 196 - dropY * 0.2, ca = Math.cos(tilt), sa = Math.sin(tilt);
      const R = (x, y) => [px + (x - px) * ca - (y - py) * sa, py + (x - px) * sa + (y - py) * ca + dropY];
      { const a = R(-60, py), b = R(px, py), c = R(px - 10, py + 120), d = R(-60, py + 120); z5Tri(a[0], a[1], b[0], b[1], c[0], c[1], 98); z5Tri(a[0], a[1], c[0], c[1], d[0], d[1], 99); thick(a[0], a[1], b[0], b[1], 2, 123); }
      const hp = R(226 + fall * 26, py - 34), hx = hp[0] + fall * 40, hy = hp[1] + fall * fall * 110;
      actor(HERO3({ eyes: 'wide', mouth: 2, sword: lerp(0.5, -1.6, fall), legs: fall > 0.1 ? z5Limp(t, 1) : [0, 0, 0, 0] }), hx, hy, 2.6, tilt * 0.8 + fall * 1.6, false, {});
      rocks(262, 196, t - 62.62, 12, 120, 3, [97, 99, 122, 105], 4564, 300, PI / 2, 2);
      a4Embers(t, 30, 50, 4565);
      shk(2.5);
      a4Cam(1.04, 0.04 * tilt, 240, 135 + fall * 14);
    });
  
    // one of his arms seen close: the porcelain forearm running back off the frame from the wrist (x, y), and the gauntlet
    function a4Fist(x, y, s, a, pose, heat, t, back) {
      const bx = x - Math.cos(a) * (back || 400), by = y - Math.sin(a) * (back || 400);
      capsF(bx, by, x, y, 15 * s + 1.5, 13 * s + 1.5, () => 96);
      capsF(bx, by, x, y, 15 * s, 13 * s, (u, d, X, Y, nx, ny) => d > 0.86 ? 69 : bone(nx, ny, X, Y, -0.3));
      const nx = -Math.sin(a), ny = Math.cos(a);
      lineF(bx, by, x - Math.cos(a) * 8 * s, y - Math.sin(a) * 8 * s, (X, Y, u) => { if ((X + Y) & 1) P(X + nx * 4 * s * Math.sin(u * 30), Y + ny * 4 * s * Math.sin(u * 30), heat > 0.5 ? 104 : 102); });
      return sGauntlet(x, y, s, a, pose, heat, t);
    }
    // lightning crawling over the last stamped sprite and out of it
    function a4Storm(x, y, S, t, amt, n) {
      for (let k = 0; k < (n || 3); k++) { const f = fl(t * 18), a0 = ih(k, f, 4601) * TAU, r0 = 6 * S, r1 = (12 + 10 * ih(k, f, 4602)) * S * amt; if (ih(k, f, 4603) > amt) continue; bolt(x + Math.cos(a0) * r0, y + Math.sin(a0) * r0, x + Math.cos(a0 + 0.5) * r1, y + Math.sin(a0 + 0.5) * r1, f + k * 7, 1, 91, 89); }
    }

    /* ============================================================== 4 · storm (63.0–66.0)
       It falls down the cut face, drives its sword into the rock and grinds to a stop; flares STORM FORM; leaps up the chasm
       as lightning, at his face — and he catches it out of the air like a fly, and smashes it into the wall. */
    const A4STAB = 63.12;
    const a4FallY = (t) => t < A4STAB ? (t - 63.0) * 620 : 74.4 + 520 * 0.38 * (1 - Math.pow(1 - clamp((t - A4STAB) / 0.38, 0, 1), 2)) / 2;
    shot(63.0, 64.2, (lt, t) => {
      const wy = a4FallY(t), cw = a4FallY(Math.min(t + 0.09, Math.max(t, A4STAB + 0.3))), oy = 300 + cw - 118, storm = t >= 63.6, g = t - 63.6, launch = eic(lin(64.08, 64.2, t));
      a4Deep(oy - 200, t, 1, 1400);
      a4Falls(70, LB, H - LB, 14, t, 4611);
      a4Wall(1, 330, oy, t, 1, 1400, 4612, true);
      if (t < A4STAB) streaks(-PI / 2, 40, t, 3000, 103, 60, 4613, [0, LB, W, H - 2 * LB]);
      // the scar its sword ploughed down the rock, still glowing
      const hsy = 118 + wy - cw; if (t >= A4STAB) { const y0 = hsy - (wy - 74.4); for (let y = Math.max(LB, fl(y0)); y < hsy; y++) { const q = (hsy - y) / Math.max(1, hsy - y0); P(322 + Math.sin(y * 0.7) * 0.8, y, q < 0.3 ? 106 : q < 0.7 ? 104 : 102); P(323, y, 101); P(321, y, 96); } }
      const crouch = storm ? eio(lin(63.7, 64.0, t)) * (1 - launch) : 0, hx = 290 - crouch * 8 - launch * 20, hy = hsy + 6 * crouch - launch * 150;
      const hang = t >= A4STAB && !storm ? Math.sin((t - A4STAB) * 9) * 0.06 * Math.exp(-(t - A4STAB) * 3) : 0;
      const sw = t < A4STAB - 0.06 ? -1.3 : t < A4STAB ? lerp(-1.3, 0.05, eoc((t - A4STAB + 0.06) / 0.06)) : launch > 0 ? lerp(0.05, -1.4, launch) : 0.05 + hang;
      const form = storm ? 'storm' : null, flick = storm && g < 0.25 && fl(g * 30) % 3 === 1;
      if (storm && g < 0.5) glow(hx, hy, 140 * (1 - g * 1.5), T_CYAN, 0.6);
      const a = heroForm(flick ? 'plain' : form || 'plain', { eyes: storm ? 'glow' : t < A4STAB + 0.4 ? 'closed' : 'wide', mouth: t > A4STAB && t < 63.5 ? 2 : storm ? 1 : 0, sword: sw, sq: crouch * 0.3 - launch * 0.2, legs: storm ? undefined : z5Limp(t, 1.2) }, hx, hy, 2.4, hang * 2 - launch * 0.5, false, {});
      if (storm) { a4Storm(hx, hy, 2.4, t, g < 0.4 ? 1 : 0.6, g < 0.4 ? 5 : 3); if (g < 0.3) for (let k = 0; k < 4; k++) bolt(hx, hy, hx + (ih(k, 1, 4614) - 0.5) * 300, hy - 60 - ih(k, 2, 4614) * 120, k + fl(t * 20), 2, 91, 89); }
      if (t >= A4STAB && t < A4STAB + 0.4) { const g2 = t - A4STAB; for (let k = 0; k < 14; k++) { const q = frac(ih(k, 1, 4615) + g2 * 4), x = a.tip[0] - 2 - q * 40 * ih(k, 2, 4615), y = a.tip[1] - q * 30 + q * q * 40; P(x, y, q < 0.4 ? 22 : 106); } glow(a.tip[0], a.tip[1], 30, T_EMBER, 0.6); }
      if (launch > 0) streaks(-PI / 2, 30, t, 3000, 91, 80, 4616, [0, LB, W, H - 2 * LB]);
      a4Embers(t, 26, storm ? 30 : 400, 4617);
      shk(t >= A4STAB && t < 63.3 ? 3 : storm && g < 0.3 ? 4 : 0.5);
      a4Cam(1.06, 0.02 * Math.sin(lt * 2), 240, 135, kick(t, [[A4STAB, 1.2, -PI / 2], [63.6, 1.5]]));
    });
    // looking straight up the chasm: the walls run up to a slit of fire, and his face is there, looking down. The hero goes
    // up it as a bolt of lightning; a hand the size of the slit comes down into it and closes
    function a4Up(t, slitW, oyy) {
      for (let y = LB; y < H - LB; y++) {
        const q = (y - LB) / (H - 2 * LB), half = lerp(slitW, 200, Math.pow(q, 1.4)), cx = 240 + Math.sin(q * 3) * 10, row = y * W;
        for (let x = 0; x < W; x++) {
          const d = Math.abs(x - cx) - half;
          if (d < 0) { BUF[row + x] = q < 0.05 ? 16 : q < 0.12 ? 15 : q < 0.3 ? (bay(x, y) < 0.5 ? 104 : 103) : q < 0.6 ? 102 : 101; continue; }
          const n = vn(x * 0.7, y + oyy * 0.3, 7 + 12 * q, 4641), ledge = vn(y * 0.15 + oyy * 0.05, x < cx ? 1 : 2, 1, 4642) > 0.72 && d < 40 + 60 * q;
          BUF[row + x] = d < 2 ? 104 : d < 5 ? 102 : ledge ? (bay(x, y) < 0.5 ? 100 : 99) : d < 10 + 30 * q ? (n > 0.5 ? 99 : 98) : n > 0.66 ? 98 : n > 0.3 ? 97 : 96;
        }
      }
    }
    shot(64.2, 64.6, (lt, t) => {
      const u = eic(lin(64.2, 64.56, t)), hand = eio(lin(64.3, 64.55, t)), close = eoc(lin(64.54, 64.6, t));
      a4Up(t, 26, t * 200);
      a4Sund(240, 44 - hand * 4, 0.85, t, { third: 1, eyes: 1.6, heat: 0.9, crown: 0.75, body: false, nod: 2 });
      // the bolt it has become: a white-blue streak from the depths, its head the hero
      const hy = lerp(300, 96, u), hx = 240 + Math.sin(u * 7) * 14, S = lerp(2.6, 1.0, u);
      bolt(hx, hy, 240 + Math.sin(u * 3) * 30, H - LB + 10, fl(t * 30), 3, 22, 90, 0.3);
      bolt(hx, hy, 240 - Math.sin(u * 5) * 40, H - LB + 10, fl(t * 30) + 9, 1, 91, 89, 0.4);
      glow(hx, hy, 50, T_CYAN, 0.7);
      heroForm('storm', { eyes: 'glow', mouth: 2, sword: -1.5, sq: -0.35 }, hx, hy, S, -PI / 2 + 0.2, false, { still: true });
      a4Storm(hx, hy, S, t, 1, 4);
      // the hand comes down into the slit, opening, and shuts
      if (hand > 0) { const gy = lerp(-80, 50, hand); a4Fist(262, gy, 2.4, PI / 2 + 0.2, close > 0.5 ? 'grab' : 'open', 0.8, t, 260); }
      shk(1 + u * 2);
      a4Cam(1.02 + u * 0.06, 0, 240, 135);
    });
    // the catch, close: the fist shut on the hero, lightning bursting out between the fingers and dying as it squeezes; then
    // it draws back, and swings
    shot(64.6, 65.2, (lt, t) => {
      const g = t - 64.6, back = eio(lin(64.82, 65.12, t)), swing = eic(lin(65.12, 65.2, t));
      a4Up(t, 40, t * 120);
      tintAll(T_DARK, 0.25);
      const fx = 270 + back * 70 - swing * 420 + z5Sh(t, 2) * 1.5, fy = 160 - back * 20 + swing * 30 + z5Knock(g, 8, 18, 5), s = 3.4 - back * 0.4;
      // the hero in the fist: its top half sticks out above the fingers, the rest is in his grip
      const fa = 0.3 + back * 0.15 - swing * 0.2, ux = Math.cos(fa), uy = Math.sin(fa), vx = -uy, vy = ux, wx = fx - ux * 18 * s, wy2 = fy - uy * 18 * s;
      const sq = Math.min(1, g * 3) * (1 - back * 0.3), hS = 2.6 - back * 0.3;
      const hx = wx + ux * 17 * s + vx * -13 * s, hy = wy2 + uy * 17 * s + vy * -13 * s;
      const storm = Math.max(0, 1 - g * 1.6);
      heroForm(storm < 0.3 && fl(t * 20) % 3 === 0 ? 'plain' : 'storm', { eyes: g < 0.2 ? 'wide' : 'closed', mouth: 2, sword: -2.3 + z5Sh(t, 4) * 0.2, sq: -0.15 * sq, legs: [3, 3, 3, 3] }, hx, hy, hS, fa - 0.1, false, { still: true });
      if (storm > 0.05) aura(t, AURA_STORM, 4 * hS * storm, { sparks: 6 });
      a4Fist(wx, wy2, s, fa, 'grab', 0.9, t, 300);
      const amt = storm;
      for (let k = 0; k < 7; k++) if (ih(k, fl(t * 20), 4621) < amt + 0.15) { const a = -PI * 0.9 + (k / 6) * PI * 1.1, L = 40 + 90 * amt * ih(k, 2, 4621); bolt(hx, hy + 6, hx + Math.cos(a) * L, hy + 6 + Math.sin(a) * L * 0.8, fl(t * 20) + k, k % 3 ? 1 : 2, 91, 89); }
      glow(hx, hy, 70 * amt + 10, T_CYAN, 0.4 * amt);
      if (swing > 0) streaks(PI, 34, t, 4000, 66, 140, 4622, [0, LB, W, H - 2 * LB]);
      z5Hit(fx - 10, fy - 30, g, 1.4, -PI / 2, 91, 4623);
      if (g >= 0 && g < 0.02) impactFrame(fx, fy, 1);
      shk(g < 0.3 ? 5 * (1 - g / 0.3) : 1.5);
      a4Cam(1.0, -0.03 * back + 0.05 * swing, 240, 135, kick(t, [[64.6, 2.2, 0]]));
    });
    WHIPS.push([65.17, PI]);
    // the slam: side on, the fist drives the hero into the chasm wall; rock bursts; the fist comes away and leaves it in the
    // crater, its storm going out, and it slides out and drops
    shot(65.2, 66.0, (lt, t) => {
      const g = t - 65.2, away = eio(lin(65.42, 65.8, t)), slide = eic(lin(65.78, 66.0, t));
      a4Deep(500, t, 0.8, 1400);
      a4Wall(-1, 190, 520, t, 0.8, 1400, 4631, true);
      // the crater: a dish of shattered rock, its rim burning, cracks running out of it
      const cx = 176, cy = 140, cr = 46 * eoc(Math.min(1, g * 8));
      if (g > 0) {
        for (let k = 0; k < 14; k++) { const a = k / 14 * TAU + ih(k, 1, 4632), L = cr + 30 + ih(k, 2, 4632) * 90 * Math.min(1, g * 5); let x = cx, y = cy; for (let q = 0; q < 6; q++) { const nx = x + Math.cos(a + (ih(k, q, 4633) - 0.5) * 0.8) * L / 6, ny = y + Math.sin(a + (ih(k, q, 4633) - 0.5) * 0.8) * L / 6; if (Math.hypot(nx - cx, ny - cy) > cr * 0.9) lineP(x, y, nx, ny, q < 2 ? 104 : 102); x = nx; y = ny; } }
        for (let y = fl(cy - cr); y < cy + cr; y++) for (let x = fl(cx - cr); x < cx + cr * 0.5; x++) { const d = Math.hypot((x - cx) / cr, (y - cy) / cr); if (d < 1 && x < 190 + 30) P(x, y, d > 0.86 ? (bay(x, y) < 0.5 ? 104 : 102) : d > 0.6 ? 97 : 96); }
      }
      // the hero in it, then falling out of it
      const hx = 176 + slide * 20, hy = 140 + slide * slide * 120;
      const fz = g > 0.15 && g < 0.6 ? fl(t * 15) % 3 : 1;
      heroForm(fz === 0 && away < 1 ? 'storm' : 'plain', { eyes: 'closed', mouth: g < 0.5 ? 2 : 0, sword: lerp(-2.4, 1.2, slide), sq: lerp(-0.25, 0, away), legs: z5Limp(t, 1.5), cracks: 0.15 }, hx, hy, 2.5, -0.3 + slide * 1.2, false, { still: g < 0.6 });
      if (fz === 0 && away < 1) a4Storm(hx, hy, 2.5, t, 0.5, 2);
      // the fist: in, then drawn away
      const fx = 186 + 80 * away + (g < 0 ? 0 : 0) + z5Knock(g, -10, 20, 7), fy = 140 - 10 * away;
      if (away < 1) a4Fist(fx + 400 * away * away, fy, 3.2, PI, 'fist', 0.8, t, 400);
      rocks(cx + 20, cy, g, 30, 340, 5, [97, 99, 122, 105], 4634, 260, 0, 1.7);
      megaHit(cx + 10, cy, g, 2.6, 0, [22, 106, 103], 4635);
      a4Embers(t, 20, -30, 4636);
      a4Cam(1.04, 0.02, 240, 135, kick(t, [[65.2, 3, PI]]));
      shk(g < 0.4 ? 8 * (1 - g / 0.4) : 0.5);
    });
  
    /* ============================================================== 5 · the beating (66.0–72.0)
       Fable Mode, gold, guard up, everything it has left. A straight punch: the guard holds, the knees go. A hammer-fist: the
       guard breaks and the sword cracks. Three body blows — a hook, an uppercut, a downward drive — it folds round each one.
       It hits the ledge. It tries to get up. He puts his hand on it and presses it into the rock. */
    // a ledge of the chasm wall to stand on: its top at y (a little uneven), rubble, cracks
    function a4Ledge(top, ox, t, lit) {
      for (let x = 0; x < W; x++) {
        const wx = x + ox, y0 = top + (vn(wx, 0, 30, 4701) - 0.5) * 6;
        for (let y = Math.max(LB, fl(y0)); y < H - LB; y++) { const d = y - y0, n = vn(wx, y * 2, 6, 4702); BUF[y * W + x] = d < 1.5 ? (lit ? 123 : 122) : d < 4 ? 100 : n > 0.62 ? 99 : n > 0.3 ? 98 : 97; }
      }
    }
    function a4Dust(x, y, g, n, spread, seed, cols) {
      if (g < 0 || g > 1) return;
      cols = cols || [122, 121, 120];
      for (let k = 0; k < n; k++) { const a = PI + ih(k, 1, seed) * PI, v = spread * (0.4 + ih(k, 2, seed)), px = x + Math.cos(a) * v * eoc(g), py = y + Math.sin(a) * v * 0.35 * eoc(g) - g * 10, r = (2 + ih(k, 3, seed) * 4) * (0.5 + g); for (let q = 0; q < r * r * 3; q++) { const dx = (ih(k, q, seed + 1) - 0.5) * 2 * r, dy = (ih(k, q, seed + 2) - 0.5) * 2 * r * 0.7; if (dx * dx + dy * dy * 2 < r * r && bay(fl(px + dx), fl(py + dy)) > g) P(px + dx, py + dy, cols[(q + k) % 3]); } }
    }
    // hit-stop: the clock of a shot held for d after each hit
    const a4Stop = (t, hits, d) => { let o = t; for (const h of hits) o -= clamp(t - h, 0, d); return o; };
    // cracks across a held sword, from the hand to the tip (amt 0..1)
    function a4SwordCracks(hand, tip, amt, seed) {
      if (amt <= 0) return;
      const dx = tip[0] - hand[0], dy = tip[1] - hand[1], L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
      for (let k = 0; k < 4; k++) { if (ih(k, 1, seed) > amt) continue; const u = 0.3 + k * 0.16, px = hand[0] + dx * u, py = hand[1] + dy * u, w = L * 0.08; lineP(px - nx * w, py - ny * w, px + nx * w + dx * 0.03, py + ny * w + dy * 0.03, 96); P(px, py, 22); }
    }
    const A4GRD = 214;
    // 66.0–67.0 the punch, side on: he is a mountain at the right; the guard holds, the knees buckle
    shot(66.0, 67.0, (lt, t) => {
      const T = a4Stop(t, [66.6], 0.07), g = t - 66.6, wind = eio(lin(66.0, 66.42, T)), strike = eic(lin(66.42, 66.6, T)), off = eio(lin(66.82, 67.0, T));
      a4Deep(260, t, 0.7, 1200);
      a4Wall(-1, 30, 280, t, 0.6, 1200, 4711, false);
      const skid = g > 0 ? 64 * eoc(Math.min(1, (T - 66.6) / 0.36)) : 0, S = 2.4, hx = 188 - skid, hy = A4GRD - 14 * S;
      const C = [hx + 26, hy - 4];
      const wx = lerp(lerp(C[0] + 150, C[0] + 210, wind), C[0] + 22, strike) + 70 * off, wy = lerp(hy - 20, C[1], strike) - 20 * off;
      const so = a4Sund(452, 34, 1.3, t, { third: 1, eyes: 1.25, heat: 0.85, crown: 0.75, rage: 0.2, tilt: -0.06 * wind + 0.04 * strike, nod: 2 * strike,
        arms: [{ x: (wx - 452) / 1.3, y: (wy - 34) / 1.3, pose: 'fist', ang: PI - 0.08 + 0.2 * wind * (1 - strike), front: true }, { x: 110, y: 160, pose: 'fist' }, { x: -70, y: 200, pose: 'fist' }, { x: 80, y: 196, pose: 'fist' }] });
      a4Ledge(A4GRD, 0, t, true);
      const buckle = g > 0 ? 0.22 * sstep(0, 0.3, g) + z5Knock(g, 0.28, 13, 4) : 0, tr = g > 0 ? a4Tw(t, 5) * 0.8 : 0;
      const flare = 1 + 0.6 * sstep(66.0, 66.4, t) * (1 - strike);
      heroForm('gold', { eyes: g > 0 && g < 0.25 ? 'closed' : 'angry', mouth: g > 0 ? 2 : 1, sword: -1.32 - (g > 0 ? z5Knock(g, 0.35, 16, 6) : 0) + tr * 0.03, sq: buckle, reach: 1, legs: g > 0 ? [0, 1.5 * sstep(0, 0.3, g), 1.5 * sstep(0, 0.3, g), 0] : undefined }, hx + tr, hy + buckle * 8, S, -0.08 - (g > 0 ? z5Knock(g, 0.2, 14, 5) : 0), false, {});
      if (flare > 1.05) glow(hx, hy, 50 * flare, T_GOLD, 0.25 * (flare - 1) * 2);
      if (g > 0) { megaHit(C[0], C[1], g, 1.7, PI, [22, 59, 58], 4715); z5Hit(C[0], C[1], g, 1.3, PI, 59, 4712); a4Dust(hx - 10, A4GRD, g, 6, 50, 4713); for (let k = 0; k < 2; k++) lineP(hx - 30 - skid * 0.2 * k, A4GRD - 1 + k, hx - 6, A4GRD - 1 + k, 123); }
      if (strike > 0.2 && strike < 1) streaks(PI, 24, t, 3200, 66, 120, 4714, [0, hy - 40, W, 80]);
      shk(g > 0 && g < 0.4 ? 6 * (1 - g / 0.4) : 0.4);
      a4Cam(1.03, 0, 240, 135, kick(t, [[66.6, 2, PI]]));
    });
    // 67.0–67.75 the hammer-fist, from below: it comes down on the guard from above and breaks it; the sword cracks
    shot(67.0, 67.75, (lt, t) => {
      const T = a4Stop(t, [67.4], 0.08), g = t - 67.4, down = eic(lin(67.18, 67.4, T)), lift = eio(lin(67.5, 67.75, T));
      a4Deep(400, t, 0.6, 1200);
      a4Sund(392, -70, 1.8, t, { third: 1, eyes: 1.3, heat: 0.85, crown: 0.75, arms: [], core: 1 });
      a4Ledge(220, 40, t, true);
      const S = 3.0, broke = g > 0, hx = 214 + (broke ? z5Knock(g, -6, 12, 5) : a4Tw(t, 2) * 0.6), hy = 220 - 14 * S + (broke ? 10 * sstep(0, 0.2, g) + z5Knock(g, 8, 14, 5) : 0);
      const sw = broke ? lerp(-1.2, 1.15, eoc(Math.min(1, g / 0.12))) + z5Knock(g - 0.12, 0.2, 14, 5) : -1.2 + Math.sin(t * 20) * 0.02;
      const a = heroForm(g > 0.25 && fl(t * 15) % 4 === 0 ? 'plain' : 'gold', { eyes: broke ? (g < 0.3 ? 'closed' : 'wide') : 'angry', mouth: broke ? 2 : 1, sword: sw, sq: broke ? 0.42 * sstep(0, 0.15, g) : 0.05, reach: broke ? 3 : 1, legs: broke ? [1, 3, 3, 0] : undefined, cracks: broke ? 0.2 : 0 }, hx, hy, S, broke ? 0.12 : -0.05, false, {});
      if (broke) a4SwordCracks(a.hand, a.tip, Math.min(1, g * 6), 4721);
      const fx = a.hand[0] + 16, fy = lerp(-120, hy - 32 * S * 0.5 - 14, down) - 90 * lift + (broke ? z5Knock(g, 6, 14, 6) : 0);
      a4Fist(fx, fy, 2.6, PI / 2 + 0.06, 'fist', 0.9, t, 300);
      if (down > 0.3 && down < 1) streaks(PI / 2, 26, t, 3600, 66, 110, 4722, [fx - 70, LB, 140, H - 2 * LB]);
      if (broke) { z5Hit(fx - 4, fy + 30, g, 1.6, PI / 2 + 0.4, 59, 4723); for (let k = 0; k < 8; k++) { const q = g * 2, x = a.tip[0] - 20 + (ih(k, 1, 4724) - 0.5) * 120 * q, y = a.tip[1] - 30 * q + 90 * q * q; if (q < 1) sparkle(x, y, 1.5, 22, 34); } a4Dust(hx, 220, g, 8, 70, 4725); megaHit(fx, fy + 30, g, 1.9, PI / 2, [22, 59, 58], 4726); }
      shk(broke && g < 0.4 ? 7 * (1 - g / 0.4) : 0.4);
      a4Cam(1.05, -0.06, 240, 128, kick(t, [[67.4, 2.4, PI / 2]]));
    });
    // 67.75–68.4 a hook from the left into its side: it folds round the fist and is thrown along the ledge
    shot(67.75, 68.4, (lt, t) => {
      const T = a4Stop(t, [68.1], 0.08), g = T - 68.1, hitv = g > 0, wind = eio(lin(67.75, 68.0, T)), strike = eic(lin(67.98, 68.1, T));
      a4Deep(520, t, 0.5, 1200);
      a4Wall(1, 470, 540, t, 0.5, 1200, 4731, false);
      a4Ledge(200, 90, t, false);
      const S = 2.7, fold = hitv ? eoc(Math.min(1, g / 0.06)) : 0, fly = hitv ? eoc(Math.min(1, g / 0.42)) : 0;
      const hx = 190 + 150 * fly + a4Tw(t, 7) * (hitv ? 0 : 0.6), hy = 200 - 14 * S + 4 - Math.sin(fly * PI) * 40 + (hitv ? 0 : 4);
      heroForm(hitv ? 'plain' : 'gold', { eyes: hitv ? 'closed' : 'wide', mouth: 2, sword: hitv ? lerp(1.0, 2.2, fly) : 1.0, sq: hitv ? -0.4 * fold * (1 - fly * 0.6) : 0.3, reach: 3, legs: z5Limp(t, 1.5), cracks: 0.25 + 0.1 * fold }, hx, hy, S, hitv ? 0.5 * fold + fly * 1.2 : 0.1, false, {});
      const fx = lerp(lerp(-60, -140, wind), hx - 30, strike) + (hitv ? 40 * fly - 60 * sstep(0.2, 0.55, g) : 0), fy = hy + 8 + (hitv ? -10 * fly : 0);
      a4Fist(fx, fy, 2.5, -0.08, 'fist', 0.9, t, 400);
      if (strike > 0.2 && !hitv) streaks(0, 22, t, 3400, 66, 120, 4732, [0, fy - 40, W, 80]);
      if (hitv) { megaHit(hx - 22, hy, g, 1.8, 0, [22, 37, 35], 4735); z5Hit(hx - 20, hy, g, 1.5, 0, 37, 4733); a4Dust(190, 200, g, 6, 60, 4734); }
      shk(hitv && g < 0.4 ? 7 * (1 - g / 0.4) : 0.4);
      a4Cam(1.04, -0.03, 240 + 30 * fly, 135, kick(t, [[68.1, 2.2, 0]]));
    });
    // 68.4–69.0 an uppercut from under it, seen from below: it folds over the fist and is thrown up the chasm
    shot(68.4, 69.0, (lt, t) => {
      const T = a4Stop(t, [68.7], 0.08), g = T - 68.7, hitv = g > 0, strike = eic(lin(68.52, 68.7, T)), up = hitv ? eoc(Math.min(1, g / 0.3)) : 0, camY = 70 * eio(lin(68.7, 69.0, T));
      a4Up(t, 30 + camY * 0.2, t * 60 - camY);
      const S = 2.6, hx = 238 + Math.sin(lt * 3) * 3, hy = lerp(150, 168, eio(lin(68.4, 68.7, T))) - 200 * up + camY;
      heroForm('plain', { eyes: hitv ? 'closed' : 'wide', mouth: 2, sword: 2.0 + (hitv ? 1.0 * up : 0), sq: hitv ? 0.45 * Math.exp(-g * 6) : 0, reach: 3, legs: z5Limp(t, 2), cracks: 0.35 }, hx, hy, S, hitv ? -0.3 - 2.4 * up : 0.6, false, {});
      const fx = 230, fy = lerp(H + 60, hy + 26, strike) - (hitv ? 160 * up : 0) + camY * 0.4;
      a4Fist(fx, fy, 2.4, -PI / 2 + 0.04, 'fist', 0.95, t, 400);
      if (strike > 0.2 && !hitv) streaks(-PI / 2, 24, t, 3600, 66, 120, 4741, [fx - 60, LB, 120, H - 2 * LB]);
      if (hitv) { megaHit(hx, hy + 18, g, 1.8, -PI / 2, [22, 37, 35], 4744); z5Hit(hx, hy + 18, g, 1.6, -PI / 2, 37, 4742); for (let k = 0; k < 6; k++) { const q = g * 2.5, x = hx + (ih(k, 1, 4743) - 0.5) * 70 * q, y = hy + 10 - 60 * q + 120 * q * q; if (q < 1) rectF(x, y, 2, 2, k % 2 ? 37 : 22); } }
      shk(hitv && g < 0.4 ? 7 * (1 - g / 0.4) : 0.4);
      a4Cam(1.06, 0, 240, 135, kick(t, [[68.7, 2.4, -PI / 2]]));
    });
    // 69.0–70.0 at the top of its arc a fist drives down on it from above and to the right, and it is thrown down on the
    // ledge so hard the rock breaks; it bounces once
    shot(69.0, 70.0, (lt, t) => {
      const T = a4Stop(t, [69.3, 70.0], 0.07), g = T - 69.3, hitv = g > 0, strike = eic(lin(69.14, 69.3, T)), fall = hitv ? eic(Math.min(1, g / 0.62)) : 0;
      const camY = 70 * (1 - eio(lin(69.0, 69.85, t)));
      a4Deep(500 + camY, t, 0.6, 1200);
      a4Wall(-1, 40, 520 + camY, t, 0.6, 1200, 4751, false);
      a4Sund(470, 10 + camY, 1.1, t, { third: 1, eyes: 1.3, heat: 0.85, crown: 0.75, rage: 0.3, nod: 2, arms: [{ x: -60, y: 120, pose: 'fist' }, { x: 100, y: 150, pose: 'fist' }, { x: -70, y: 196, pose: 'fist' }, { x: 80, y: 196, pose: 'fist' }] });
      a4Ledge(222 + camY * 0.2, 60, t, true);
      const S = 2.3, ax = 236, ay = 70 + camY, gx = 150, gy = 222 + camY * 0.2 - 14 * S * 0.6;
      const pre = eio(lin(69.0, 69.3, T)), hx = hitv ? lerp(ax, gx, fall) : lerp(250, ax, pre), hy = hitv ? lerp(ay, gy, fall) : lerp(90 + camY, ay, pre) - Math.sin(pre * PI) * 6;
      const land = T - 69.93, bounce = land > 0 ? Math.abs(Math.sin(Math.min(land, 0.3) / 0.3 * PI)) * 12 * Math.exp(-land * 3) : 0;
      heroForm('plain', { eyes: 'closed', mouth: hitv && land < 0 ? 2 : 0, sword: 2.4, sq: land > 0 ? 0.55 * Math.exp(-land * 4) + 0.3 : hitv ? -0.3 : 0, reach: 3, legs: land > 0 ? [3, 3, 3, 3] : z5Limp(t, 2), cracks: 0.45 }, hx, hy - bounce, S, land > 0 ? 0.08 : hitv ? -0.6 + fall * 0.6 : 1.4 * pre - 0.8, false, {});
      const C = [ax + 20, ay - 14], fx = lerp(C[0] + 220, C[0] + 18, strike) - (hitv ? 110 * fall : 0), fy = lerp(C[1] - 200, C[1] - 12, strike) + (hitv ? 160 * fall : 0);
      a4Fist(fx, fy, 2.0, PI * 0.75, 'fist', 0.9, t, 500);
      if (strike > 0.2 && !hitv) streaks(PI * 0.75, 22, t, 3400, 66, 120, 4752, [0, LB, W, H - 2 * LB]);
      if (hitv) { megaHit(C[0], C[1], g, 1.8, PI * 0.75, [22, 37, 35], 4758); z5Hit(C[0], C[1], g, 1.5, PI * 0.75, 37, 4753); if (fall < 1) streaks(Math.atan2(gy - ay, gx - ax), 20, t, 3000, 122, 90, 4754, [0, LB, W, H - 2 * LB]); }
      if (land > 0) { megaHit(gx, 222 + camY * 0.2, land, 1.6, -PI / 2, [22, 122, 99], 4755); a4Dust(gx, 222 + camY * 0.2, land, 10, 90, 4756); rocks(gx, 222 + camY * 0.2, land, 14, 160, 3, [97, 99, 122, 123], 4757, 400, -PI / 2, 1.8); }
      shk(hitv && g < 0.4 ? 7 * (1 - g / 0.4) : land > 0 && land < 0.4 ? 6 : 0.4);
      a4Cam(1.03, 0, 240, 135, kick(t, [[69.3, 2.2, PI * 0.75], [70.0, 1.6, PI / 2]]));
    });
  
    // 70.0–72.0 on the ledge, close and low: it tries to get up on its sword, and can't; a shadow; his hand comes down flat
    // on it and presses it into the rock
    const A4PIN = [182, 196];                                     // where the hero lies pinned (72–77 reuse it)
    function a4PinScene(t, press, crack) {
      a4Deep(700, t, 0.45, 1400);
      a4Wall(1, 430, 720, t, 0.45, 1400, 4761, false);
      a4Ledge(214, 200, t, true);
      if (crack > 0) { groundCracks(A4PIN[0], 214, 90 * crack, 9, 4762, 104, 99); groundCracks(A4PIN[0] + 4, 215, 60 * crack, 6, 4763, 102, 98); }
    }
    shot(70.0, 72.0, (lt, t) => {
      const g = t - 71.4, hitv = g > 0, down = eic(lin(71.22, 71.4, t)), shade = sstep(71.0, 71.38, t);
      a4PinScene(t, 0, hitv ? Math.min(1, g * 5) : 0);
      const S = 3.2, base = 214 - 14 * S;
      // the attempts: up on the sword, trembling, the arm gives; again, less
      const up1 = eio(lin(70.3, 70.85, t)) * (1 - eic(lin(70.88, 70.98, t))), up2 = eio(lin(71.02, 71.3, t)) * 0.35 * (1 - (hitv ? 1 : 0));
      const up = Math.max(up1, up2), tr = a4Tw(t, 8) * (0.4 + up * 1.6);
      const press = hitv ? 0.62 + 0.06 * sstep(0, 0.5, g) : 0;
      const hx = A4PIN[0] + tr * 0.6, hy = base + 12 * (1 - up) + (hitv ? 5 + 3 * sstep(0, 0.4, g) : 0) + tr * 0.3;
      const lookUp = !hitv && t > 71.12;
      const a = actor(HERO3({ eyes: hitv ? (g < 0.3 ? 'closed' : 'wide') : lookUp ? 'wide' : up > 0.2 ? 'narrow' : 'closed', mouth: hitv ? 2 : up > 0.3 ? 1 : 0, sword: hitv ? 0.15 : lerp(0.25, 1.45, up), sq: hitv ? press : 0.38 * (1 - up), reach: up > 0.2 ? 2 : 0, legs: hitv ? [3, 3, 3, 3] : [3 - up * 2.2, 3 - up * 2, 3 - up * 2, 3 - up * 2.2], cracks: hitv ? 0.6 : 0.5 }), hx, hy, S, hitv ? 0.02 : -0.06 * up + 0.04, false, { bob: 0 });
      if (up1 > 0.4 && !hitv) for (let k = 0; k < 4; k++) { const x = a.tip[0] + (ih(k, fl(t * 12), 4764) - 0.5) * 8, y = 214 - ih(k, fl(t * 12) + 1, 4764) * 4; P(x, y, 123); }
      // the light goes: his shadow, grit falling out of it
      if (shade > 0) { for (let y = LB; y < H - LB; y++) { const k = shade * clamp(1.1 - (y - LB) / 200, 0, 1) * 0.7; if (k > 0.02) for (let x = 0; x < W; x++) tintI(y * W + x, x, y, T_DARK, k); } for (let k = 0; k < 30; k++) { const q = frac(ih(k, 1, 4765) + t * 1.5), x = 60 + ih(k, 2, 4765) * 300, y = LB + q * 190; if (q < shade) P(x, y, 122); } }
      // the hand: flat, palm down, fingers spread over it
      const px = A4PIN[0] - 70, py = lerp(-150, hy - 52, down) + (hitv ? 4 * sstep(0, 0.5, g) + z5Knock(g, 5, 14, 5) + z5Sh(t, 3) * 1.2 : 0);
      if (down > 0) a4Fist(px, py, 3.0, 0.42 + (hitv ? Math.sin(g * 4) * 0.03 : 0), 'open', 0.9, t, 400);
      if (down > 0.2 && !hitv) streaks(PI / 2, 26, t, 3600, 66, 120, 4766, [px - 120, LB, 240, H - 2 * LB]);
      if (hitv) { megaHit(hx, 214, g, 2.4, -PI / 2, [22, 106, 103], 4767); a4Dust(hx, 214, g, 12, 110, 4768); rocks(hx, 214, g, 16, 200, 3, [97, 99, 122, 123], 4769, 400, -PI / 2, 2.4); }
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
      const S = 3.2, base = 214 - 14 * S, hx = A4PIN[0] + a4Tw(t, 9) * 0.5, hy = base + 13 + z5Knocks(t, A4OT, 3, 16, 6);
      const strain = K === 3 ? eio(lin(75.6, 76.15, t)) * (1 - sstep(76.3, 76.9, t) * 0.7) : 0;
      // the halo: the orbs not yet taken still orbit it, dim
      const live = [0, 1, 2, 3].map((k) => (k > K || (k === K && t < T - 0.55) ? 1 : 0));
      for (let k = 0; k < 4; k++) { if (!live[k]) continue; const [x, y, z] = a4OrbPos(k, t, hx, hy); if (z < 0) a4Orb(x, y, k, 6.5, 0.9); }
      const a = actor(HERO3({ eyes: g >= 0 && g < 0.3 ? 'closed' : 'wide', mouth: strain > 0.2 || (g >= 0 && g < 0.4) ? 2 : 1, sword: 0.15 - strain * 0.5, sq: 0.66 - strain * 0.12, reach: 1 + strain * 3, legs: [3, 3, 3, 3], cracks: 0.6 + drained * 0.07 }), hx + strain * 6, hy - strain * 3, S, -0.04 - strain * 0.1, false, { bob: 0 });
      for (let k = 0; k < 4; k++) { if (!live[k]) continue; const [x, y, z] = a4OrbPos(k, t, hx, hy); if (z >= 0) a4Orb(x, y, k, 6.5, 0.9); }
      // the pinning hand on its back, from the upper left
      a4Fist(A4PIN[0] - 70, hy - 52 + z5Sh(t, 3) * 1.2, 3.0, 0.42 + Math.sin(t * 1.3) * 0.02, 'open', 0.9, t, 400);
      // the taking hand, from the upper right: down to the orb, up in front of its eyes, shut
      const [ox, oy] = a4OrbPos(K, Math.min(t, T - 0.55), hx, hy), rest = [430, 40 + Math.sin(t) * 4], top = [hx + 104, hy - 100];
      const fa = PI * 0.66 - lift * 0.15, ux = Math.cos(fa), uy = Math.sin(fa), FS = 2.2, tipD = 20 * FS;
      let fx = lerp(rest[0], ox - ux * tipD, reach), fy = lerp(rest[1], oy - uy * tipD, reach);
      fx = lerp(fx, top[0], lift); fy = lerp(fy, top[1], lift);
      if (K === 3 && g > 0.3) { const back = eio(lin(T + 0.3, T + 1.0, t)); fx += back * 30; fy -= back * 20; }
      fx += z5Knock(g, 4, 18, 5); fy += z5Knock(g, 5, 18, 5) + (sq > 0 ? z5Sh(t, 4) * 1.5 * sq : 0);
      const held = reach > 0.98 && g < 0, pose = sq > 0.5 || g >= 0 ? 'fist' : reach > 0.98 ? 'grab' : 'open';
      const orbP = held ? [fx + ux * 17 * FS, fy + uy * 17 * FS] : [ox, oy];
      // the thread of its light from its chest to the orb, stretching till it snaps
      if (held && lift < 0.6) lineF(hx + 10, hy - 6, orbP[0], orbP[1], (x, y, u) => { if (bay(x, y) < 0.9 - Math.abs(u - 0.5) - lift) P(x, y + Math.sin(u * 12 + t * 30) * 2 * lift, ELC[K][2]); });
      a4Fist(fx, fy, FS, fa, pose, 0.9, t, 400);
      // pinched in his fingertips, it burns brighter, as if it knew (and the squeeze closes over it)
      if (held && sq < 0.6) { const r = (7 + lift * 3) * (1 - sq), pv = 1 + 0.25 * Math.sin(t * 40) * lift; glow(orbP[0], orbP[1], 34 * pv, EL_T[K], 0.5 + 0.3 * lift); a4Orb(orbP[0], orbP[1], K, r, 1); }
      // the crushes, each its own
      if (g >= 0 && g < 1.6) {
        const [c0, c1, c2] = ELC[K], cx = fx + ux * 15 * FS, cy = fy + uy * 15 * FS, fade = 1 - clamp(g / 0.9, 0, 1);
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
      const off = eio(lin(77.0, 77.35, t)), pick = eio(lin(77.15, 77.45, t)), raise = eio(lin(77.45, 78.0, t)), open = eoc(lin(78.02, 78.1, t)), drop = t > 78.05 ? t - 78.05 : 0;
      const camY = 150 * raise;
      a4Deep(700 - camY, t, 0.45, 1400);
      a4Wall(1, 430, 720 - camY, t, 0.45, 1400, 4761, false);
      a4Ledge(214 + camY, 200, t, true);
      tintAll(T_ASH, 0.64);
      const S = 3.2, base = 214 - 14 * S + 13;
      // the pinning hand goes
      a4Fist(A4PIN[0] - 70 - off * 160, base - 52 - off * 200 + camY, 3.0, 0.42 - off * 0.3, 'open', 0.9, t, 400);
      // the other hand: down, two fingers round it, up, out, open
      const fa = PI * 0.62 + raise * 0.2, ux = Math.cos(fa), uy = Math.sin(fa), FS = 2.2, tipD = 18 * FS;
      const gx = A4PIN[0] + 10, gy = base - 8 + camY, hold = [300, 110];
      let hx = lerp(A4PIN[0], gx, pick), hy = lerp(base + camY, gy, pick);
      hx = lerp(hx, hold[0], raise); hy = lerp(hy, hold[1], raise);
      const fx = hx - ux * tipD + z5Sh(t, 5) * 0.8, fy = hy - uy * tipD;
      const sway = Math.sin(t * 3.2) * 0.25 * raise;
      const fallY = drop * drop * 500 + drop * 40;
      actor(HERO3({ eyes: 'narrow', mouth: 0, sword: 1.5 - sway, sq: lerp(0.6, -0.1, pick), legs: z5Limp(t, 1.4), cracks: 0.88, reach: 2 }), hx + drop * 10, hy + 12 * pick + fallY, S - drop, pick * (PI * 0.08) + sway + drop * 2, false, { bob: 0 });
      a4Fist(fx, fy, FS, fa, open > 0.5 ? 'open' : pick > 0.6 ? 'grab' : 'open', 0.9, t, 400);
      a4Embers(t, 24, -40, 4781, [94, 93]);
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
      for (let y = LB; y < H - LB; y++) { const q = (y - LB) / (H - 2 * LB), half = lerp(slit, 260, Math.pow(q, 1.6)), row = y * W; for (let x = 0; x < W; x++) { const d = Math.abs(x - 240 - Math.sin(q * 4) * 6) - half; if (d > 0) BUF[row + x] = d < 1.5 ? (q < 0.3 ? 102 : 97) : bay(x, y) < 0.15 ? 97 : 0; else if (q < 0.08) BUF[row + x] = q < 0.03 ? 105 : 103; } }
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
      a4Floor(t, 232 + tiltUp * 60, 600, 3);
      groundCracks(236, 232 + tiltUp * 60, 200 * rise, 12, 4832, 106, 104);
      const S = 5.0, hx = 236 + a4Tw(t, 15) * 1.2, hy = 232 - 14 * S + tiltUp * 60;
      const a = a4Last(hx, hy, S, t, { eyes: 'glow', mouth: 2, sw: -1.45, sq: -0.15 * (1 - rise) });
      // the sword re-forged: fire runs up the cracked blade and it grows, and keeps growing, up out of the top of the frame
      const L = 29 * S * (1 + grow * 14);
      bigBlade(a.hand[0], a.hand[1], -PI / 2 + 0.05, L, 6, t, { form: 'lastlight', grow: grow < 1 ? 0.999 : 1, surge: true, flare: 0.9 });
      if (g < 0.4) { shockRing(hx, 232, 10 + g * 900, 4 + g * 120, 4, [22, 106, 104], 1 - g / 0.4); glow(hx, hy, 260 * (1 - g * 2), T_WH, 0.6); }
      rocks(hx, 232, g, 26, 260, 4, [97, 99, 104, 106], 4833, 300, -PI / 2, 2.4);
      if (g < 0.02) impactFrame(hx, hy, 0);
      shk(g < 0.5 ? 7 * (1 - g / 0.5) : 2);
      a4Cam(1.0, 0, 236, 140, kick(t, [[88.0, 3, PI / 2]]));
    });
    CAPS.push([88.0, 89.3, 'x', '', 'LAST LIGHT!', 62]);
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
          else if (a < A4CL0) { const q = (a - A4SEA) / (A4CL0 - A4SEA), R = [102, 101, 98, 97, 97], f = q * 4, i = fl(f); c = bay(x, y) < f - i ? R[Math.min(4, i + 1)] : R[i]; }
          else if (a < A4CL1) {
            const bot = A4CL0 + fbm(wx, 0, 90, 3, 4843) * 50, top = A4CL1 - 40 + fbm(wx + 7, 0, 60, 3, 4844) * 70, hr = hole * (1 + 0.3 * vn(wx, a, 30, 4845));
            if (ax < hr || a < bot || a > top) c = a > (A4CL0 + A4CL1) / 2 ? SKYD[0] : 97;
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
      // him: standing in the sea beside it, his face passing as we rise; he turns to look at it
      const so = 1.5 * k, mx = 240 + 300 * k, my = 135 - (1080 - cA) * k;
      if (my > -200 && my < H + 200) { a4Sund(mx, my, so, t, { third: 1, eyes: 1.4, heat: 0.85, crown: 0.75, tilt: 0.15 * u, arms: [{ x: -110, y: 140, pose: 'fist' }, { x: 110, y: 150, pose: 'fist' }, { x: -80, y: 200, pose: 'fist' }, { x: 80, y: 200, pose: 'fist' }] }); const sy = fl(135 - (A4SEA + 16 - cA) * k); if (sy < H - LB) a4Column(t, cA, k, tipA, hole, sy); }
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
    const gl = (lx, ly) => [GM[0] + lx * GS, GM[1] + ly * GS];
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
      if (!B || t <= A[0]) return { x: A[1], y: A[2], a: A[3], L: A[4] };
      const u = EASE[B[5] || 'io'](clamp((t - A[0]) / (B[0] - A[0]), 0, 1));
      return { x: lerp(A[1], B[1], u), y: lerp(A[2], B[2], u), a: lerp(A[3], B[3], u), L: lerp(A[4], B[4], u) };
    }
    const GHITS = [[90.6, 2.4, ...gl(0, 60)], [91.4, 1.8, ...gl(-120, 50)], [92.0, 1.8, ...gl(-110, 120)], [92.6, 2.2, ...gl(-80, 22)], [93.2, 2.0, ...gl(0, 125)], [94.2, 2.6, ...gl(-105, 130)], [95.4, 2.6, ...gl(-60, 160)], [96.6, 2.4, ...gl(0, 0)], [97.4, 2.6, 150 + Math.cos(-0.86) * 270, 340 + Math.sin(-0.86) * 270]];
    const A4CUT2 = 94.2, A4CUT3 = 95.4, A4MASK = 96.6, A4CATCH = 97.4, A4SNAP = 100.0;
    // his arms through the exchange (local wrist positions), in his own key track
    function a4GArms(t) {
      const L = (keys) => { let i = 0; while (i < keys.length - 1 && keys[i + 1][0] <= t) i++; const A = keys[i], B = keys[i + 1]; if (!B || t <= A[0]) return A.slice(1); const u = eio(clamp((t - A[0]) / (B[0] - A[0]), 0, 1)); return A.slice(1).map((v, j) => (typeof v === 'number' && typeof B[j + 1] === 'number' ? lerp(v, B[j + 1], u) : v)); };
      const ul = L([[90.0, -110, 140], [90.45, 30, 62], [91.0, 20, 70], [91.25, -60, 30], [91.4, -125, 48], [91.7, -150, 90], [92.4, -130, 0], [92.6, -84, 20], [92.9, -100, 60], [97.1, -110, 80]]);
      const ur = L([[90.0, 110, 150], [90.45, -30, 66], [91.0, -20, 70], [92.0, 90, 120], [96.9, 100, 110]]);
      const ll = L([[90.0, -80, 200], [90.45, 34, 112], [91.0, 20, 118], [91.8, -40, 150], [92.0, -112, 120], [92.3, -90, 170], [93.0, 30, 124], [93.3, 20, 128], [93.9, -120, 140], [94.2, -150, 150]]);
      const lr = L([[90.0, 80, 200], [90.45, -30, 116], [91.0, -20, 120], [93.0, -26, 126], [93.3, -20, 130], [94.6, 110, 170], [95.2, -40, 166], [95.4, -62, 162]]);
      const grip = (d, sd) => { const ba = -0.86, bx = 150 + Math.cos(ba) * d, by = 340 + Math.sin(ba) * d, ga = ba + sd * PI / 2; return { x: (bx - GM[0]) / GS - Math.cos(ga) * 13, y: (by - GM[1]) / GS - Math.sin(ga) * 13, pose: 'grab', ang: ga, front: true }; };
      const cg = eoc(lin(97.25, 97.4, t));
      if (cg > 0) { const g1 = grip(236, 1), g2 = grip(296, -1); ul[0] = lerp(ul[0], g1.x, cg); ul[1] = lerp(ul[1], g1.y, cg); ur[0] = lerp(ur[0], g2.x, cg); ur[1] = lerp(ur[1], g2.y, cg); }
      return [
        cg > 0 ? { x: ul[0], y: ul[1], pose: cg > 0.8 ? 'grab' : 'open', ang: -0.86 + PI / 2, front: true } : { x: ul[0], y: ul[1], pose: 'fist', front: t < 91.2 },
        cg > 0 ? { x: ur[0], y: ur[1], pose: cg > 0.8 ? 'grab' : 'open', ang: -0.86 - PI / 2, front: true } : { x: ur[0], y: ur[1], pose: 'fist', front: t < 91.2 },
        t >= A4CUT2 ? { x: -150, y: 150, cut: true } : { x: ll[0], y: ll[1], pose: t > 93.8 ? 'open' : 'fist', front: t < 91.2 || (t > 92.9 && t < 93.6) },
        t >= A4CUT3 ? { x: 150, y: 150, cut: true } : { x: lr[0], y: lr[1], pose: t > 94.7 ? 'grab' : 'fist', front: t < 91.2 || t > 92.9 },
      ];
    }
    // a severed forearm, falling: elbow end (molten) at (x, y), pointing a, gauntlet at the far end
    function a4Limb(x, y, s, a, t, len) {
      const ex = x + Math.cos(a) * len * s, ey = y + Math.sin(a) * len * s;
      capsF(x, y, ex, ey, 15 * s + 1.5, 12 * s + 1.5, () => 96);
      capsF(x, y, ex, ey, 15 * s, 12 * s, (u, d, X, Y, nx, ny) => d > 0.86 ? 69 : u < 0.35 ? OBS[clamp(fl(2 - nx * 1.6), 0, 4)] : bone(nx, ny, X, Y, -0.3));
      discF(x, y, 13 * s, 103); discF(x, y, 8 * s, 105); discF(x, y, 4 * s, 22);
      glow(x, y, 26 * s, T_EMBER, 0.6);
      sGauntlet(ex, ey, s, a, 'open', 0.4, t);
    }
    // the severed arms: [time cut, cut point (local), initial velocity, spin, splash time]
    const GLIMBS = [[A4CUT2, -105, 130, -90, -60, -2.4, 94.95], [A4CUT3, -60, 160, 70, -50, 2.0, 96.1]];
    const a4LimbAt = (L, t) => { const g = t - L[0], [wx, wy] = gl(L[1], L[2]); return [wx + L[3] * g, wy + L[4] * g + 260 * g * g, (L[0] === A4CUT2 ? 2.4 : 0.5) + L[5] * g]; };
    function a4Giant(t, V, o) {
      o = o || {};
      const k = V.k, X = (wx) => 240 + (wx - V.ox) * k, Y = (wy) => 135 + (wy - V.oy) * k, WX = (x) => V.ox + (x - 240) / k, WY = (y) => V.oy + (y - 135) / k;
      // sky
      const hzY = Y(GSEA);
      for (let y = LB; y < Math.min(H - LB, hzY); y++) { const q = clamp((WY(y) + 60) / (GSEA + 60), 0, 0.999), R = [97, 98, 101, 102, 103], f = q * 4, i = fl(f); for (let x = 0; x < W; x++) BUF[y * W + x] = bay(x, y) < f - i ? R[Math.min(4, i + 1)] : R[i]; }
      // the cloud cover, its belly lit; every heavy hit blows a ring in it, miles across (dawn light pours through)
      const holes = []; for (const [h, p, hx] of GHITS) { const g = t - h; if (g > 0) holes.push([hx, (50 + 210 * eoc(Math.min(1, g / 1.0))) * p / 2.4, g]); }
      for (let x = 0; x < W; x++) {
        const wx = WX(x), bot = Y(58 + 26 * fbm(wx, 0, 70, 3, 4851)), y1 = Math.min(H - LB, Math.ceil(bot));
        for (let y = LB; y < y1; y++) {
          const wy = WY(y), dd = (bot - y) / k;
          let c = dd < 1.5 ? 103 : dd < 4 ? 102 : dd < 11 + 8 * vn(wx, wy, 9, 4852) ? 121 : 97;
          for (const [hx, r, g] of holes) { const dx = (wx - hx) / r, dy = (wy - 40) / (r * 0.16), d = dx * dx + dy * dy; if (d < 1) { c = d > 0.85 ? (g < 0.6 ? 22 : 106) : d > 0.6 ? 15 : 16; break; } else if (d < 1.25 && g < 1.2) { c = bay(x, y) < 0.5 ? 121 : 122; } }
          BUF[y * W + x] = c;
        }
      }
      // the sea (to the horizon) and the burning chasm running into it
      for (let y = Math.max(LB, fl(hzY)); y < H - LB; y++) {
        const wy = WY(y), q = clamp((wy - GSEA) / 140, 0, 1), cxw = lerp(196, 140, q), half = 3 + (wy - GSEA) * 0.55, row = y * W;
        for (let x = 0; x < W; x++) {
          const wx = WX(x), d = Math.abs(wx - cxw) - half;
          if (d < 0) { const e = -d / half; BUF[row + x] = e < 0.1 ? 104 : e < 0.35 ? 102 : e < 0.7 ? 101 : 98; continue; }
          const sw = Math.sin(wx * 0.06 / (0.2 + q) + t * 1.4 + wy * 0.9) + Math.sin(wx * 0.017 - t * 0.8 + wy * 0.3);
          let c = OCEAN[clamp(fl(q * 3.2) + (sw > 1.1 ? 2 : sw > 0.5 ? 1 : 0) - (bay(x, y) > 0.5 + q * 0.4 ? 1 : 0), 0, 3)];
          if (d < 3 / k) c = bay(x, y) < 0.5 ? 22 : 119;               // foam on the lip where the sea goes over
          BUF[row + x] = c;
        }
      }
      for (let k2 = 0; k2 < 6; k2++) { const wx = 20 + k2 * 90 + ih(k2, 1, 4853) * 40, h = 20 + ih(k2, 2, 4853) * 40, x0 = X(wx), yb = hzY + 2; if (Math.abs(wx - 170) < 40) continue; for (let y = fl(yb - h * k); y < yb; y++) { const v = (yb - y) / (h * k), hw = (6 + 6 * (1 - v)) * k; for (let x = fl(x0 - hw); x <= x0 + hw; x++) P(x, y, v > 0.88 ? 103 : 98); } }
      // him
      const arms = o.arms || a4GArms(t), maskCuts = t >= A4MASK ? [[-17, -9, 17, 13, Math.min(1, (t - A4MASK) * 8)]] : [];
      const sh = o.shake || 0, roar = o.roar || 0;
      const so = a4Sund(X(GM[0] + (o.push || 0)), Y(GM[1]), GS * k, t, { third: 1, eyes: o.eyes || 1.4, heat: 0.9, crown: 0.75, rage: t >= A4MASK ? 1 : 0.4 + roar * 0.4, roar, shake: sh, tilt: o.tilt || 0, nod: o.nod || 0, arms, maskCuts });
      // the sea in front of his waist
      const wl = Y(GWL);
      if (wl < H - LB) for (let y = Math.max(LB, fl(wl)); y < H - LB; y++) for (let x = Math.max(0, fl(X(220))); x < W; x++) { const wy = WY(y), wx = WX(x), q = clamp((wy - GSEA) / 140, 0, 1), sw = Math.sin(wx * 0.06 / (0.2 + q) + t * 1.4 + wy * 0.9); BUF[y * W + x] = y - wl < 2 ? 22 : OCEAN[clamp(fl(q * 3.2) + (sw > 0.8 ? 1 : 0), 0, 3)]; }
      // the severed arms falling, and the sea thrown up where they land
      for (const L of GLIMBS) { const g = t - L[0]; if (g < 0) continue; const [wx, wy, a] = a4LimbAt(L, Math.min(t, L[6])); if (t < L[6]) a4Limb(X(wx), Y(wy), GS * k, a, t, 70); for (let q = 0; q < 6; q++) { const gg = g - q * 0.04; if (gg < 0 || t > L[6]) continue; const [px, py] = a4LimbAt(L, L[0] + gg); P(X(px), Y(py), q < 2 ? 105 : 103); } const gs = t - L[6]; if (gs > 0 && gs < 1.6) { const sx = X(wx), sy = Y(GWL); rocks(sx, sy, gs, 26, 220 * k, 3 * k + 1, [117, 118, 119, 22], 4854 + L[0], 160 * k, -PI / 2, 1.2); shockRing(sx, sy, 10 + gs * 300 * k, 3 + gs * 50 * k, 3, [22, 119, 118], 1 - gs / 1.6); if (gs < 0.5) glow(sx, sy, 60 * k, T_WH, 0.5 * (1 - gs * 2)); } }
      // the blade
      const B = o.blade || a4Blade(t), px = X(B.x), py = Y(B.y);
      if (!o.noBlade) {
        const snapG = t - A4SNAP;
        if (snapG < 0) o.tip = bigBlade(px, py, B.a, B.L * k, Math.max(2, 7 * k), t, { form: 'lastlight', flare: 0.9, cracks: o.cracks || 0, surge: true });
      }
      // the hits
      for (const [h, p, hx, hy] of GHITS) { const g = t - h; if (g < 0 || g > 1.2) continue; megaHit(X(hx), Y(hy), g, Math.min(2.4, p), PI + B.a, [22, 106, 103], 4860 + fl(h * 10)); if (g < 1.0) { const sx = X(hx), cy = Y(40); shockRing(sx, cy, 20 + g * 700 * k, 4 + g * 80 * k, 3, [22, 21, 20], 1 - g); } if (g < 1.2) rocks(X(170), Y(GSEA + 10), g, 10, 120 * k, 3 * k + 1, [97, 99, 122, 103], 4870 + fl(h * 10), 200 * k, -PI / 2, 2.4); }
      // his waterline: the sea pushed out in a ring from him on every hit
      for (const [h] of GHITS) { const g = t - h; if (g > 0 && g < 1.4) shockRing(X(GM[0]), Y(GWL), 20 + g * 260 * k, 3 + g * 20 * k, 2, [22, 119, 118], 1 - g / 1.4); }
      return { so, X, Y, B, px, py };
    }
    const a4GK = (t) => kick(t, GHITS.map(([h, p, x, y]) => [h, p * 0.8, Math.atan2(y - 300, x - 160)]));
    // G1 90.6–91.4: wide: the blade comes up out of the chasm into his four crossed arms
    shot(90.6, 91.4, (lt, t) => { a4Giant(t, { k: 1, ox: 250, oy: 140 }, { push: 10 * eoc(Math.min(1, lt * 3)) }); shk(lt < 0.4 ? 7 : 1); a4Cam(1.02, 0, 240, 135, a4GK(t)); });
    // G2 91.4–92.4: closer: a backhand turns it away; a fist knocks it back
    shot(91.4, 92.4, (lt, t) => { a4Giant(t, { k: 1.55, ox: 300, oy: 120 }, { tilt: 0.04 }); shk(1.5); a4Cam(1.0, 0.02, 240, 135, a4GK(t)); });
    // G3 92.4–93.6: wider: the hammer drives it down into the sea; then he takes a thrust on his crossed arms
    shot(92.4, 93.6, (lt, t) => {
      a4Giant(t, { k: 0.78, ox: 260, oy: 150 }, {});
      const g = t - 92.75; if (g > 0 && g < 1.4) { const x = 240 + (300 - 260) * 0.78, y = 135 + (GSEA + 8 - 150) * 0.78; rocks(x, y, g, 30, 240, 3, [117, 118, 119, 22], 4881, 160, -PI / 2, 1.0); shockRing(x, y, 10 + g * 260, 3 + g * 40, 3, [22, 119, 118], 1 - g / 1.4); }
      shk(1.5); a4Cam(1.0, 0, 240, 135, a4GK(t));
    });
    // G4 93.6–94.15: in the chasm, close: the hero, burning, hauls the blade back for everything it has
    function a4HeroPit(t, S, hx, hy, o) {
      a4Wall(-1, 70, 300 + t * 20, t, 1, 1000, 4891, true);
      a4Wall(1, 410, 300 + t * 20, t, 1, 1000, 4892, true);
      for (let y = LB; y < H - LB; y++) for (let x = 0; x < W; x++) { const i = y * W + x; if (BUF[i] === 0) BUF[i] = bay(x, y) < 0.3 ? 101 : 97; }
      const a = a4Last(hx, hy, S, t, o);
      return a;
    }
    shot(93.6, 94.15, (lt, t) => {
      a4Deep(300, t, 1, 1000);
      const B = a4Blade(t), S = 3.4, hx = 210 + a4Tw(t, 16) * 1.5, hy = 170;
      const a = a4HeroPit(t, S, hx, hy, { eyes: 'glow', mouth: 2, sw: -1.9 + (B.a + 1.45) * 0.6, sq: -0.1 + 0.2 * Math.sin(t * 9), legs: [0, 1, 1, 0] });
      bigBlade(a.hand[0], a.hand[1], B.a - 0.3, 600, 6, t, { form: 'lastlight', flare: 1, surge: true });
      for (let k = 0; k < 20; k++) { const q = frac(ih(k, 1, 4893) + t * 1.8), x = ih(k, 2, 4893) * W, y = H - LB - q * 230; P(x, y, q < 0.5 ? 106 : 104); }
      shk(2.5); a4Cam(1.04, -0.04, 240, 135);
    });
    // G5 94.15–95.3: the sweep takes the lower left arm off at the elbow; it falls into the sea
    shot(94.15, 95.3, (lt, t) => { const r = a4Giant(t, { k: 1.12, ox: 290, oy: 160 }, { shake: t > A4CUT2 ? 1.2 : 0, tilt: t > A4CUT2 ? 0.06 * eoc(Math.min(1, (t - A4CUT2) * 3)) : 0 }); shk(t > A4CUT2 && t < 94.6 ? 7 : 1.5); a4Cam(1.0, 0, 240, 135, a4GK(t)); });
    WHIPS.push([95.28, 0]);
    // G6 95.3–96.5: and the lower right; he roars, the camera pushed in on it
    shot(95.3, 96.5, (lt, t) => {
      const roar = sstep(95.55, 95.85, t) * (1 - sstep(96.3, 96.5, t) * 0.5), push = eio(lin(95.6, 96.45, t));
      a4Giant(t, { k: lerp(1.0, 1.8, push), ox: lerp(260, GM[0], push), oy: lerp(150, GM[1] + 20, push) }, { roar, shake: roar * 1.4, nod: -roar * 3 });
      shk(roar * 3 + (t - A4CUT3 > 0 && t - A4CUT3 < 0.4 ? 5 : 0)); a4Cam(1.0, 0, 240, 135, a4GK(t));
    });
    // G7 96.5–97.3: on his face: the blade goes across the mask; the seam of fire widens
    shot(96.5, 97.3, (lt, t) => {
      const g = t - A4MASK, recoil = g > 0 ? z5Knock(g, 0.12, 9, 4) : 0;
      a4Giant(t, { k: 2.4, ox: GM[0], oy: GM[1] + 12 }, { tilt: recoil, shake: g > 0 ? 1.5 : 0.3, roar: g > 0 ? 0.3 * Math.exp(-g * 3) : 0 });
      shk(g > 0 && g < 0.4 ? 6 : 1); a4Cam(1.0, 0, 240, 135, a4GK(t));
    });
  
    // G8 97.3–98.2: he catches it in his two hands, and it stops dead
    shot(97.3, 98.2, (lt, t) => {
      const g = t - A4CATCH, B = a4Blade(t); if (g > 0) B.a += z5Sh(t, 21) * 0.004;
      const r = a4Giant(t, { k: 1.45, ox: 300, oy: 108 }, { blade: B, cracks: g > 0 ? 0.15 * g : 0, shake: g > 0 ? 0.8 : 0, eyes: 1.7 });
      if (g > 0) { const hx = 150 + Math.cos(-0.86) * 266, hy = 340 + Math.sin(-0.86) * 266; for (let k = 0; k < 10; k++) { const q = frac(ih(k, 1, 4901) + t * 2.6), a = B.a + PI + (ih(k, 2, 4901) - 0.5) * 2, x = r.X(hx) + Math.cos(a) * q * 60, y = r.Y(hy) + Math.sin(a) * q * 60 + q * q * 30; P(x, y, q < 0.4 ? 22 : 106); } glow(r.X(hx), r.Y(hy), 50, T_EMBER, 0.5); }
      shk(g > 0 ? (g < 0.4 ? 8 : 2.5) : 1); a4Cam(1.0, 0, 240, 135, a4GK(t));
    });
    // G9 98.2–98.9: the hero, everything pouring out of it into the blade, the cracks in it widening
    shot(98.2, 98.9, (lt, t) => {
      a4Deep(300, t, 1, 1000);
      const S = 3.6, hx = 214 + a4Tw(t, 17) * 2.2, hy = 176;
      const a = a4HeroPit(t, S, hx, hy, { eyes: 'glow', mouth: 2, sw: -1.62, sq: 0.12 + 0.06 * Math.sin(t * 13), legs: [0, 2, 2, 0], power: 1.3 });
      bigBlade(a.hand[0], a.hand[1], -1.25 + z5Sh(t, 22) * 0.01, 600, 6.5, t, { form: 'lastlight', flare: 1, surge: true, cracks: 0.25 });
      for (let k = 0; k < 30; k++) { const q = frac(ih(k, 1, 4902) + t * 2.4), x = ih(k, 2, 4902) * W, y = H - LB - q * 230; P(x, y, q < 0.5 ? 106 : 104); }
      shk(3); a4Cam(1.06 + lt * 0.05, 0.03, 220, 160);
    });
    // G10 98.9–100.0: the hands on the blade, close: it cracks along its length, light leaking out, bending where he holds it — SNAP
    shot(98.9, 100.0, (lt, t) => {
      const B = a4Blade(t), u = lin(98.9, 100.0, t); B.a += z5Sh(t, 23) * 0.006 * (1 + u * 2);
      const r = a4Giant(t, { k: 2.5, ox: 312, oy: 102 }, { blade: B, noBlade: true, eyes: 2, shake: 0.6 + u, roar: 0.2 * u });
      // the blade in two parts, kinked at his grip as it bends
      const hx = 150 + Math.cos(-0.86) * 266, hy = 340 + Math.sin(-0.86) * 266, sx = r.X(hx), sy = r.Y(hy), kink = 0.12 * eic(u);
      const L1 = Math.hypot(sx - r.px, sy - r.py);
      bigBlade(r.px, r.py, B.a, L1, 7 * 2.5 * 0.6, t, { form: 'lastlight', flare: 0.9, cracks: 0.3 + u * 0.7, surge: true });
      bigBlade(sx, sy, B.a - kink, 900, 7 * 2.5 * 0.6, t, { form: 'lastlight', flare: 0.9, cracks: 0.3 + u * 0.7 });
      // his hands back over it
      sunderer(r.X(GM[0]), r.Y(GM[1]), GS * 2.5, t, { third: 1, eyes: 2, heat: 0.9, crown: 0, rage: 1, body: false, mask: false, glow: 0, arms: a4GArms(t).map((A, k) => (k < 2 ? A : null)), shake: 0.6 + u });
      // light leaking through the cracks round his grip
      for (let k = 0; k < 16 * u; k++) { const a = ih(k, 1, 4903) * TAU, L = 20 + 60 * u * ih(k, 2, 4903); lineF(sx, sy, sx + Math.cos(a) * L, sy + Math.sin(a) * L, (x, y, q) => { if (bay(x, y) < (1 - q) * u) P(x, y, 22); }); }
      glow(sx, sy, 60 + 80 * u, T_WH, 0.3 + 0.4 * u);
      shk(1 + u * 4); a4Cam(1.0, 0.02 * u, 240, 135);
    });
    // G11 100.0–100.8: wide: snapped — the long half tumbles out of his hands and comes apart in the air, pieces the size of
    // mountains falling into the sea
    function a4Frag(x, y, L, w, a, lit) {
      const ca = Math.cos(a), sa = Math.sin(a), nx = -sa * w, ny = ca * w, tx = x + ca * L, ty = y + sa * L, bx = x - ca * L * 0.6, by = y - sa * L * 0.6;
      z5Tri(tx, ty, bx + nx, by + ny, bx - nx * 0.6, by - ny * 0.6, 102); z5Tri(tx, ty, bx + nx * 0.6, by + ny * 0.6, bx - nx * 0.2, by - ny * 0.2, lit ? 106 : 104);
      lineP(tx, ty, bx + nx, by + ny, 107); glow(x, y, L * 0.8, T_EMBER, 0.3);
    }
    shot(100.0, 100.6, (lt, t) => {
      const g = t - A4SNAP;
      const r = a4Giant(t, { k: 0.85, ox: 262, oy: 132 }, { noBlade: true, eyes: 2, roar: 0.6 * Math.exp(-g * 2) });
      const B = a4Blade(t), hx = 150 + Math.cos(-0.86) * 266, hy = 340 + Math.sin(-0.86) * 266, sx = r.X(hx), sy = r.Y(hy);
      const back = eic(Math.min(1, g / 0.6));
      bigBlade(r.px, r.py + back * 120, B.a, Math.hypot(sx - r.px, sy - r.py) * (1 - back * 0.3), 7 * 0.85, t, { form: 'lastlight', flare: 0.6, cracks: 0.6 });
      // the long half comes apart in the air: pieces the size of mountains, burning, raining down on the sea
      for (let k = 0; k < 9; k++) {
        const d = 40 + k * 110, br = clamp((g - 0.04 * k) * 3, 0, 1), px0 = sx + Math.cos(B.a) * d * 0.85, py0 = sy + Math.sin(B.a) * d * 0.85;
        const px = px0 + (ih(k, 1, 4904) - 0.5) * 160 * g + 30 * g, py = py0 + 520 * g * g + (ih(k, 2, 4904) - 0.5) * 60 * g, rot = B.a + (ih(k, 3, 4904) - 0.5) * 3 * g;
        if (py > H + 60) continue;
        a4Frag(px, py, 30 + 26 * ih(k, 4, 4904), 7 + 6 * ih(k, 5, 4904), rot, br > 0.5);
        if (br > 0) for (let q = 1; q < 4; q++) P(px - q * 3 * Math.cos(rot), py - q * 9, 104);
      }
      if (g < 0.4) { glow(sx, sy, 200 * (1 - g * 2.5), T_WH, 0.8); }
      megaHit(sx, sy, g, 2.6, B.a, [22, 106, 103], 4905);
      rocks(sx, sy, g, 40, 300, 3, [104, 106, 107, 22], 4906, 300, B.a, 2.2);
      shk(g < 0.5 ? 8 : 3); a4Cam(1.0, 0, 240, 135, kick(t, [[A4SNAP, 3, B.a]]));
    });
    /* ============================================================== 11 · the floor of the world (100.8–104.0)
       Point blank, his third eye blazing over the hero in the chasm: one fist, and it is driven straight down through the
       floor of the world, through the rock beneath it, into the dark; its fire goes out on the way down. */
    shot(100.6, 101.25, (lt, t) => {
      const g = t - 100.8, wind = eic(lin(100.62, 100.8, t)), drive = g > 0 ? eic(Math.min(1, g / 0.5)) : 0, lean = eoc(lin(100.6, 100.75, t));
      a4Deep(800 + drive * 300, t, 0.8, 1400);
      a4Wall(-1, 60, 820 + drive * 300, t, 0.8, 1400, 4911, true);
      a4Wall(1, 420, 820 + drive * 300, t, 0.8, 1400, 4912, true);
      // his face leaning in over it, the brother's eye in his brow blazing
      const my = lerp(-10, 104, lean) - drive * 260;
      a4Sund(340, my, 2.3, t, { third: 1, eyes: 2, heat: 1, crown: 0.75, rage: 1, roar: 0.3, body: false, maskCuts: [[-17, -9, 17, 13, 1]], nod: 3 });
      glow(340, my - 16 * 2.3, 130, T_MAG, 0.7); glow(340, my - 16 * 2.3, 40, T_WH, 0.5);
      // the hero, with what is left of the blade, looking up; then gone downward
      const S = 3.0, hx = 170 + a4Tw(t, 18), hy = 176 + drive * 260;
      const a = a4Last(hx, hy, S, t, { eyes: g > 0 ? 'closed' : 'wide', mouth: 2, sw: -1.2, still: g > 0, power: 1 - drive * 0.5, ang: drive * 0.4 });
      bigBlade(a.hand[0], a.hand[1], -1.2, 70, 5, t, { form: 'lastlight', flare: 0.6, cracks: 0.6 });
      // the fist
      const fx = lerp(520, hx + 46, wind), fy = lerp(40, hy - 34, wind) + drive * 230;
      a4Fist(fx, fy, 3.2, PI * 0.72, 'fist', 1, t, 400);
      if (g > 0) { megaHit(hx + 10, hy - 30, g, 3.3, PI / 2, [22, 75, 103], 4913); streaks(PI / 2, 40, t, 4000, 103, 120, 4914, [0, LB, W, H - 2 * LB]); }
      shk(g > 0 && g < 0.6 ? 9 : 1); a4Cam(1.0, 0, 240, 135, kick(t, [[100.8, 3.5, PI / 2]]));
    });
    // through the rock beneath the world, and then nothing but the dark; its fire going out, plain and cracked again, a
    // broken hilt in its hand
    shot(101.25, 104.0, (lt, t) => {
      const u = lin(101.25, 104.0, t), rockU = lin(101.25, 102.2, t), fade = eio(lin(102.2, 103.7, t));
      BUF.fill(0, LB * W, (H - LB) * W);
      // strata of rock rushing up past it as it is driven through them, then none
      if (rockU < 1) for (let k = 0; k < 7; k++) { const y = H - LB - frac(k / 7 + rockU * 2.4) * 300 + 40; if (y < LB - 40 || y > H - LB + 40) continue; for (let yy = fl(y); yy < y + 18; yy++) if (yy >= LB && yy < H - LB) for (let x = 0; x < W; x++) { const hole = Math.abs(x - 240) < 30 + (yy - y) * 0.5; if (!hole) BUF[yy * W + x] = (yy - y) < 2 ? 99 : vn(x, yy, 6, 4921 + k) > 0.5 ? 97 : 96; } rocks(240, y, frac(rockU * 2.4 + k / 7) * 0.6, 10, 200, 3, [97, 98, 99, 103], 4922 + k, -400, -PI / 2, 2.8); }
      const S = lerp(3.0, 1.6, eio(u)), hx = 240 + Math.sin(t * 1.3) * 8 * u, hy = lerp(60, 150, eoc(Math.min(1, u * 2))) + 26 * eic(u) + Math.sin(t * 2) * 2;
      for (let k = 0; k < 40; k++) { const sp = 900 * (1 - u * 0.7), y = H - LB - frac(ih(k, 1, 4925) + t * sp / 218) * 218, x = ih(k, 2, 4925) * W; if (bay(fl(x), fl(y)) < 0.8 - u * 0.5) { P(x, y, k % 3 ? 97 : 121); P(x, y + 1, 96); } }
      if (rockU < 1) streaks(-PI / 2, 30, t, 3000 * (1 - rockU), 103, 90, 4924, [0, LB, W, H - 2 * LB]);
      const burning = 1 - eio(lin(101.8, 102.9, t));
      glow(hx, hy, 60 * S * burning + 14 * (1 - fade), burning > 0.1 ? T_FIRE : T_WARM, 0.45 * burning + 0.2 * (1 - fade));
      const form = burning > 0.5 || (burning > 0.15 && fl(t * 15) % 2) ? 'lastlight' : undefined;
      const a = actor(HERO3({ form, eyes: 'closed', sword: null, legs: z5Limp(t, 1.6), cracks: 0.9, sq: -0.05 }), hx, hy, S, 0.3 + u * 0.5 + Math.sin(t * 0.8) * 0.1, false, { still: true });
      if (burning > 0.2) aura(t, LASTF, 4 * S * burning, { sparks: fl(12 * burning), rise: -1.5 });
      a4Sword(a.hand[0], a.hand[1], 0.3 + u * 0.5 + 0.9, S * 0.9, null, false, true);
      // embers peeling off it and falling behind (upward, as it drops)
      for (let k = 0; k < 20; k++) { const q = frac(ih(k, 1, 4923) + t * 1.2), x = hx + (ih(k, 2, 4923) - 0.5) * 40, y = hy - q * 120; if (bay(fl(x), fl(y)) < (1 - q) * (burning * 0.8 + 0.2)) P(x, y, burning > 0.3 ? 104 : 37); }
      // the light goes out
      tintAll(T_DARK, 0.25 + 0.6 * fade);
      a4Cam(1.0, 0, 240, 135);
    });
  }
