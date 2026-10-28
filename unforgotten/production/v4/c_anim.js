  /* ================================================================ animation: keys, timing, acting */
  // A character's drawings change on twos (15 a second), the way pixel animation is timed; the camera, the weather
  // and the light keep running on ones, so the world stays smooth while the acting reads as drawn poses.
  const ON2 = (t) => fl(t * 15 + 1e-6) / 15;
  // how a key is arrived at from the one before it
  const EASE = {
    lin: (u) => u, io: (u) => eio(u), out: (u) => eoc(u), in: (u) => u * u * u,
    back: (u) => { const c = 2.2; u -= 1; return 1 + u * u * ((c + 1) * u + c); },       // overshoot, then settle
    snap: (u) => (u < 0.5 ? 0 : 1), hold: () => 0,
  };
  // blend two pose values of the same shape: numbers, arrays, objects; anything else switches halfway
  function mix(a, b, u) {
    if (typeof a === 'number' && typeof b === 'number') return a + (b - a) * u;
    if (Array.isArray(a) && Array.isArray(b)) return a.map((x, i) => mix(x, b[i], u));
    if (a && b && typeof a === 'object' && typeof b === 'object') { const o = {}; for (const k in a) o[k] = k in b ? mix(a[k], b[k], u) : a[k]; for (const k in b) if (!(k in o)) o[k] = b[k]; return o; }
    return u < 0.5 ? a : b;
  }
  // a keyed value: K = [[t, value, ease], ...]; the ease is how the value travels into that key
  function key(K, t) {
    if (t <= K[0][0]) return K[0][1];
    for (let i = 1; i < K.length; i++) if (t < K[i][0]) { const [t0, a] = K[i - 1], [t1, b, e] = K[i]; return mix(a, b, EASE[e || 'io']((t - t0) / (t1 - t0))); }
    return K[K.length - 1][1];
  }
  // the stressed syllables of a speaker's lines (where the voice jumps up), and a pulse that hits on each
  const ACC = {};
  function accentsOf(who) {
    if (ACC[who]) return ACC[who];
    const out = []; for (const l of DLG) if (l.who === who) { let low = true; for (let f = 0; f < l.env.length; f++) { const v = l.env.charCodeAt(f) - 48; if (low && v >= 6) { out.push([l.t0 + f / 30, v / 9]); low = false; } if (v <= 3) low = true; } }
    return (ACC[who] = out);
  }
  function accent(who, t) { let a = 0; for (const [ta, s] of accentsOf(who)) { const d = t - ta; if (d > -0.05 && d < 0.5) a = Math.max(a, s * (d < 0.05 ? (d + 0.05) / 0.1 : Math.exp(-(d - 0.05) * 7))); } return a; }
  const syllable = (who, t) => { let n = 0; for (const [ta] of accentsOf(who)) if (ta <= t) n++; return n; };
  // a natural blink: lids half, shut, shut, half (about a ninth of a second), every few seconds
  function blinkK(t, seed, every) {
    const P = (every || 3.2) + ih(seed, 1, 17) * 1.6, ph = ((t + ih(seed, 2, 17) * P) % P) * 30;
    return ph < 1 ? 'half' : ph < 3 ? 'closed' : ph < 4 ? 'half' : null;
  }
  // little darts of the eyes: a held offset that jumps every so often
  function gaze(t, seed, amp) { const k = fl(t / 0.9 + ih(seed, 3, 18)), j = ih(k, seed, 19); return j < 0.55 ? 0 : Math.round((ih(k, seed, 20) - 0.5) * 2 * (amp || 1)); }
  // a pendulum hanging from a point that moves (x(tt), frame px): returns its swing angle at t, simulated from t0
  function pendulum(xf, t0, t, len, damp) {
    let a = 0, w = 0; const dt = 1 / 120, L = len || 8, g = 260, d = damp || 3;
    let x0 = xf(t0 - 2 * dt), x1 = xf(t0 - dt);
    for (let tt = t0; tt < t; tt += dt) { const x2 = xf(tt), acc = (x2 - 2 * x1 + x0) / (dt * dt); x0 = x1; x1 = x2; w += (-(g / L) * Math.sin(a) - d * w - acc / L) * dt; a += w * dt; }
    return a;
  }
  // a spring that chases a moving target (overlap and follow-through): value at t, simulated from t0
  function springTo(f, t0, t, k, z) {
    let x = f(t0), v = 0; const dt = 1 / 120, K = k || 180, Z = z || 14;
    for (let tt = t0; tt < t; tt += dt) { v += (K * (f(tt) - x) - Z * v) * dt; x += v * dt; }
    return x;
  }

  // ---------------------------------------------------------------- the head on its neck (busts)
  // Tilt the head in the sprite canvas before it is outlined: every pixel above the neck turns about it, the turn
  // fading in over the first rows so the neck bends instead of tearing. ang > 0 nods forward, < 0 lifts the chin.
  const STP = new Int16Array(SW * SH), STK = new Uint8Array(SW * SH);
  function sprTilt(nx, ny, ang) {
    if (Math.abs(ang) < 0.005) return;
    STP.set(SPR); STK.set(SPK);
    const PX = nx + SOX, PY = ny + SOY, y0 = Math.max(0, SBB[1] - 6), x0 = Math.max(0, SBB[0] - 6), x1 = Math.min(SW - 1, SBB[2] + 6), yE = Math.min(SH - 1, PY + 2);
    for (let Y = y0; Y <= yE; Y++) {
      const a = ang * sstep(0, 9, PY + 2 - Y), ca = Math.cos(a), sa = Math.sin(a);
      for (let X = x0; X <= x1; X++) {
        const dx = X + 0.5 - PX, dy = Y + 0.5 - PY, sx = fl(PX + dx * ca + dy * sa), sy = fl(PY - dx * sa + dy * ca), i = Y * SW + X;
        if (sx < 0 || sy < 0 || sx >= SW || sy >= SH || sy > yE) { if (Y < PY - 2) { SPR[i] = -1; SPK[i] = 0; } continue; }
        const j = sy * SW + sx; SPR[i] = STP[j]; SPK[i] = STK[j];
      }
    }
    SBB[0] = x0; SBB[1] = y0; SBB[2] = x1;
  }
  // a hand in a close-up, in bust sprite space: a sleeve from `from` to the wrist `at`, and the hand beyond it, lit;
  // pose: 'point' (index out), 'open' (fingers spread), 'fist', 'flat' (palm down, for a pat)
  function bustHand(h, sleeve, sleeveB, skin) {
    const [ax, ay] = h.from, [bx, by] = h.at, dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 1, ux = h.dir ? h.dir[0] : dx / L, uy = h.dir ? h.dir[1] : dy / L;
    limb(ax, ay, bx, by, h.r0 || 4.4, h.r1 || 3.4, sleeve, sleeveB);
    sEll(bx, by, 3.6, 3.6, (x, y, u, v) => band(sleeve, sleeveB + 1 + (litOf(u, v) > 0.3 ? 1 : 0) - (u * ux + v * uy > 0.5 ? 1 : 0)));
    const hx = bx + ux * 4, hy = by + uy * 4, s = (u, v, base) => band(skin, base + (litOf(u, v) > 0.3 ? 1 : litOf(u, v) < -0.4 ? -1 : 0));
    if (h.pose === 'point') {
      sEll(hx, hy, 3, 2.8, (x, y, u, v) => s(u, v, 4.6));
      for (let q = 0; q < 7; q++) { sp(hx + ux * (2 + q), hy + uy * (2 + q), band(skin, 5 + (q > 4 ? 1 : 0))); sp(hx + ux * (2 + q) + uy * 0.9, hy + uy * (2 + q) - ux * 0.9, band(skin, 4)); }
      sp(hx - uy * 2.4 + ux, hy + ux * 2.4 + uy, band(skin, 4)); sp(hx - uy * 2.4 + ux * 2, hy + ux * 2.4 + uy * 2, band(skin, 4));
    } else if (h.pose === 'open' || h.pose === 'flat') {
      sEll(hx, hy, 3.4, 3.2, (x, y, u, v) => s(u, v, 4.8));
      const spread = h.pose === 'open' ? 0.32 : 0.12;
      for (let f = -1.5; f <= 1.5; f++) { const a = Math.atan2(uy, ux) + f * spread, cx = Math.cos(a), cy = Math.sin(a), n = f === -1.5 || f === 1.5 ? 4 : 5; for (let q = 0; q < n; q++) sp(hx + cx * (3 + q) - uy * f * 0.9, hy + cy * (3 + q) + ux * f * 0.9, band(skin, 5 - (q === n - 1 ? 0 : 0) + (f < 0 ? 0 : -1))); }
    } else sEll(hx, hy, 3.4, 3.4, (x, y, u, v) => s(u, v, 4.6) - (Math.abs((u * -uy + v * ux) * 3.4 % 1.7) < 0.3 && u * ux + v * uy > 0.2 ? 1 : 0));
  }
