  /* ================================================================ the lantern
     An old brass hand lantern: a wire bail, a vented conical cap with a knob, four glass panes in a brass frame (seen
     corner-on: two edge bars and a middle one), a stub of candle with its flame, a ridged base. Local units, the bail's
     top (where it is held) at (0, 0), y down; the flame's heart at (0, 10). Drawn by inverse-rotating each pixel by the
     swing angle. The candle's flicker is slow noise: it breathes, it never strobes. */
  const LANT_FLAME = [0, 10.1];
  const flick = (t) => 1 + 0.045 * n1(t * 7.3, 811) + 0.03 * n1(t * 15.1, 812) + 0.02 * Math.sin(t * 4.1);
  // the pendulum: θ (0 = hanging straight down, + swings the lantern toward +x) for a pivot moving along piv(t) →
  // [x, y] in lantern units; integrated over the last 1.6 s from rest at its equilibrium (so: a pure function of t)
  const PEND_X = new Float64Array(400), PEND_Y = new Float64Array(400);
  function pendulum(t, piv, tStart) {
    const h = 1 / 120, Tw = Math.min(1.6, Math.max(0, t - (tStart === undefined ? -1e9 : tStart)));
    const n = Math.max(2, Math.round(Tw / h)) + 2;
    for (let k = 0; k < n; k++) { const p = piv(t - (n - 2 - k) * h); PEND_X[k] = p[0]; PEND_Y[k] = p[1]; }
    const g = 980, L = 9.5, c = 3.2;
    // start: the angle that balances the pivot's acceleration at the window's start
    const ax0 = (PEND_X[2] - 2 * PEND_X[1] + PEND_X[0]) / (h * h), ay0 = (PEND_Y[2] - 2 * PEND_Y[1] + PEND_Y[0]) / (h * h);
    let th = clamp(Math.atan2(-ax0, g + ay0), -0.5, 0.5), w = 0;
    for (let k = 1; k < n - 1; k++) {
      const ax = (PEND_X[k + 1] - 2 * PEND_X[k] + PEND_X[k - 1]) / (h * h), ay = (PEND_Y[k + 1] - 2 * PEND_Y[k] + PEND_Y[k - 1]) / (h * h);
      const acc = -((g + ay) * Math.sin(th) + ax * Math.cos(th)) / L - c * w;
      w += acc * h; th += w * h;
      th = clamp(th, -0.9, 0.9);
    }
    return th;
  }
  // where the flame is on screen for a lantern held at (px, py), scale S, swing th
  function lanternFlame(px, py, S, th) { const c = Math.cos(th), s = Math.sin(th); return [px - s * LANT_FLAME[1] * S + c * LANT_FLAME[0] * S, py + c * LANT_FLAME[1] * S]; }
  const R_BRASS = [195, 198, 173, 174, 175, 199, 200, 22];
  /* o: { snow (0..1: snow lying on it), lit (0..1 how alive the flame is), bury: screen y below which it is hidden,
     t, cut(x, y) → true to skip a pixel } */
  function drawLantern(px, py, S, th, o) {
    o = o || {};
    const t = o.t || T_NOW, lit = o.lit === undefined ? 1 : o.lit, ca = Math.cos(th), sa = Math.sin(th);
    const R = 16.5 * S, x0 = Math.max(0, fl(px - R)), x1 = Math.min(W - 1, Math.ceil(px + R)), y0 = Math.max(ROW0, fl(py - 2 * S)), y1 = Math.min(ROW1, Math.ceil(py + R)), iS = 1 / S;
    const fk = flick(t), sway = 0.32 * n1(t * 3.1, 821) + 0.18 * Math.sin(t * 9.3), hw = Math.max(0.5, 0.65 * iS);
    const bury = o.bury === undefined ? 1e9 : o.bury, snow = o.snow || 0;
    for (let Y = y0; Y <= y1; Y++) {
      if (Y >= bury) break;
      for (let X = x0; X <= x1; X++) {
        const dx = X + 0.5 - px, dy = Y + 0.5 - py;
        const u = (dx * ca + dy * sa) * iS, v = (-dx * sa + dy * ca) * iS;
        if (v < -1 || v > 15.3 || u < -4.6 || u > 4.6) continue;
        if (o.cut && o.cut(X, Y)) continue;
        const b = bay(X, Y);
        let c = -1;
        // the bail: a wire half-hoop over the cap
        if (v < 4.4) {
          const bd = Math.hypot(u, v - 4.2) - 3.6;
          if (Math.abs(bd) < hw && v < 4.2) c = u < -0.8 ? R_BRASS[4] : u < 1.2 ? R_BRASS[5] : R_BRASS[3];
          if (v > 3.4 && Math.abs(u) < 1.0 && Math.hypot(u, v - 4.3) < 0.95) c = u < 0 ? R_BRASS[5] : R_BRASS[3];   // the knob
        }
        if (c < 0 && v >= 4.6 && v < 7.7) {
          // the cap: a cone with a vent ring, and its rolled rim
          const q = (v - 4.6) / 2.4, wc = v < 7.0 ? lerp(1.3, 3.9, q) : 4.25;
          if (Math.abs(u) < wc) {
            const nx = u / wc;
            let val = 0.42 - nx * 0.33 + (v < 7.0 ? -q * 0.12 : 0.12) + (1 - nx * nx) * 0.1;
            if (v > 7.0) val += 0.18 - Math.abs(v - 7.35) * 0.35;
            if (v > 5.3 && v < 5.9 && Math.abs(Math.sin(u * 2.6)) > 0.7 && v < 7.0) val -= 0.35;       // the vents
            if (Math.abs(nx + 0.45) < 0.12 && v < 7.0) val += 0.35;                                       // the gleam
            if (v > 7.4) val += 0.25 * lit;                                                               // lit from below
            if (snow > 0 && v < 4.6 + 2.4 * snow * (1.2 - 0.6 * Math.abs(nx)) && v < 7.0 + snow * 0.5 && ih(fl(u * 3), 0, 831) < 0.5 + snow * 0.5) c = v < 5.2 ? 22 : nx < 0.2 ? 194 : 168;
            else c = rp(R_BRASS, clamp(val, 0, 1), b);
          }
        }
        if (c < 0 && v >= 7.7 && v < 13.7) {
          const wg = 3.45 + 0.22 * Math.sin(PI * (v - 7.7) / 6);
          if (Math.abs(u) < wg) {
            const eu = Math.abs(u);
            // frame bars: the two edges and the middle (a corner of the lantern toward us)
            if (eu > wg - 0.75 || Math.abs(u - 0.15) < 0.38 || v < 8.05 || v > 13.35) {
              const val = 0.36 + (u < 0 ? 0.18 : -0.1) + (Math.abs(u - 0.15) < 0.38 ? 0.12 : 0) + 0.3 * lit * (1 - eu / wg);
              c = rp(R_BRASS, clamp(val, 0, 1), b);
              if (v > 13.35 || v < 8.05) c = rp(R_BRASS, clamp(0.3 + (u < 0 ? 0.2 : 0) + 0.25 * lit, 0, 1), b);
            } else {
              // inside the glass: the candle, its flame, the glow on the glass
              const fy = (v - 7.9) / 3.3;                                        // 0 at the tip … 1 at the base of the flame
              const fu = u - sway * (1 - fy) * (1 - fy) * 1.2;
              let fw = fy > 0 && fy < 1 ? 1.05 * Math.pow(Math.sin(PI * (0.08 + 0.86 * fy)), 0.85) * (0.75 + 0.25 * fk) * fy : 0;
              const inFl = lit > 0.05 && Math.abs(fu) < fw * lit;
              if (inFl) {
                const k = Math.abs(fu) / (fw * lit + 1e-6);
                c = fy > 0.78 && k < 0.5 ? (lit > 0.6 ? 59 : 201) : k < 0.42 && fy > 0.35 ? 60 : k < 0.75 ? (fy < 0.3 ? 201 : 16) : 201;
                if (fy > 0.9 && k < 0.35) c = 47;                                // the blue root of the flame
              } else if (v > 11.25 && Math.abs(u) < 1.05) {
                // the candle: a cream stub, a drip, the wick
                const top = 11.25 + 0.18 * Math.sin(u * 3);
                c = v < top + 0.4 ? (lit > 0.3 ? 187 : 189) : u < -0.45 ? 189 : u < 0.3 ? 188 : 190;
                if (Math.abs(u - 0.62) < 0.22 && v < 12.6) c = 187;
              } else if (v > 10.9 && v < 11.4 && Math.abs(u) < 0.12) c = 195;
              else {
                // the glass, lit from inside: hottest by the flame, a soot shadow at the top, a reflection streak
                const d = Math.hypot(u * 0.9, v - 10.0);
                let val = lit * (1.05 - d / 4.6) * (0.92 + 0.08 * fk);
                if (v < 8.8) val -= 0.25;
                if (Math.abs(u + wg * 0.58) < 0.32 && v > 8.6 && v < 12.8) val += 0.35;
                c = val > 0.82 ? 200 : val > 0.62 ? 199 : val > 0.44 ? (b < 0.5 ? 183 : 182) : val > 0.28 ? 182 : val > 0.14 ? 181 : lit > 0.05 ? 180 : (b < 0.5 ? 196 : 197);
              }
            }
          }
        }
        if (c < 0 && v >= 13.7 && v < 15.2) {
          // the base: a rolled ring, ridged
          const wb = 4.05 - (v - 13.7) * 0.25;
          if (Math.abs(u) < wb) {
            const nx = u / wb;
            let val = 0.5 - nx * 0.3 - (v - 13.7) * 0.18 + (v < 14.1 ? 0.22 * lit : 0);
            if (Math.abs(v - 14.4) < 0.18) val -= 0.25;
            c = rp(R_BRASS, clamp(val, 0, 1), b);
          }
        }
        if (c >= 0) BUF[Y * W + X] = c;
      }
    }
  }
  // the lantern's halo: a soft warm glow round the glass (bloom does the rest)
  function lanternGlow(fx, fy, S, lit) {
    if (lit <= 0.02) return;
    const fk = flick(T_NOW);
    glow(fx, fy, 30 * S * lit * fk, T_LAMP, 0.42 * lit);
    glow(fx, fy, 12 * S * lit, T_WARM, 0.35 * lit);
  }
