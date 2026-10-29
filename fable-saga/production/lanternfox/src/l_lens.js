  /* ================================================================ the great lens
     A first-order Fresnel lens: a beehive of glass in a brass cage. The middle drum is the bull's-eye belt (each panel a
     set of concentric rings that gathers the flame into a beam); above and below it, rings of prisms step in toward the
     top and the bottom. Dark, it is cold blue glass holding the window light in thin lines; alight, it burns gold-white
     from the centre out, its prism edges flashing cyan and gold. Local units, centre at (0, 0), y down.
     lit: 0..1 overall; catch: 0..1 how far the light has spread from the centre ring by ring; rot: the panels' turn. */
  const LENS = { H: 34, R: 22 };
  const lensR = (v) => { const a = Math.abs(v); if (a < 9) return LENS.R; const u = (a - 9) / 25; return LENS.R * (1 - 0.48 * Math.pow(u, 1.5)) * (1 - 0.04 * frac(u * 7.8)); };
  function drawLens(cx, cy, S, o) {
    const lit = o.lit || 0, ct = o.catch === undefined ? lit : o.catch, rot = o.rot || 0;
    const x0 = Math.max(0, fl(cx - (LENS.R + 3) * S)), x1 = Math.min(W - 1, Math.ceil(cx + (LENS.R + 3) * S));
    const y0 = Math.max(ROW0, fl(cy - (LENS.H + 3) * S)), y1 = Math.min(ROW1, Math.ceil(cy + (LENS.H + 3) * S));
    for (let Y = y0; Y <= y1; Y++) {
      const v = (Y + 0.5 - cy) / S, av = Math.abs(v);
      if (av > LENS.H + 2) continue;
      const r = lensR(v);
      for (let X = x0; X <= x1; X++) {
        const u = (X + 0.5 - cx) / S, b = bay(X, Y);
        let c = -1;
        // the brass rings top and bottom, and the cage's vertical bars (8 round; the front ones show)
        if (av > LENS.H - 2.5 && av <= LENS.H + 1 && Math.abs(u) < r + 1.5) { const q = u / (r + 1.5); c = rq(R_BRASS, clamp(0.24 - q * 0.3 + (av > LENS.H ? -0.1 : 0.12) + lit * 0.5, 0, 1), b, 0.8); }
        else if (Math.abs(u) < r) {
          const q = u / r, phi = Math.asin(clamp(q, -1, 1));
          let bar = false;
          for (let k = 0; k < 8; k++) { const a = rot + k * TAU / 8; if (Math.cos(a) < 0.1) continue; if (Math.abs(Math.sin(a) - q) < 0.045 / Math.max(0.3, Math.cos(a))) bar = true; }
          if (bar) c = rq(R_BRASS, clamp(0.18 - q * 0.2 + lit * 0.6, 0, 1), b, 0.8);
          else {
            // the glass: which ring, where in it
            let ring, f;
            if (av < 9) {                                        // the belt: concentric rings round the nearest panel's centre
              let best = 9, pc = 0;
              for (let k = 0; k < 8; k++) { const a = rot + k * TAU / 8 + TAU / 16; if (Math.cos(a) < 0) continue; const d = Math.abs(Math.sin(a) - q); if (d < best) { best = d; pc = Math.sin(a); } }
              const rr = Math.hypot((q - pc) * r * 1.1, v);
              ring = rr / 2.1; f = frac(ring);
            } else { ring = (av - 9) / 3.2; f = frac(ring); }
            const reach = Math.min(1, ct * 1.25 - (Math.hypot(u / LENS.R, v / LENS.H)) * 0.25);   // how far the light has spread
            const g = lit * clamp(reach * 1.6, 0, 1) * (1.1 - Math.hypot(u / LENS.R, v / LENS.H) * 0.55);
            const edge = f > 0.82, shine = -q * 0.6 + (f < 0.3 ? 0.25 : 0);
            if (g > 0.08) {
              // alight: gold-white heart; the prism edges catch it cyan and gold; a ripple of brighter rings
              // each ring a band from deep gold at its root to white-gold at its lip, so the rings still read when it burns
              const w = Math.min(0.92, g) * (0.55 + 0.5 * f) + 0.1 * Math.sin(ring * 2.2 - T_NOW * 3);
              if (edge && g > 0.3) c = fl(ring) & 1 ? 229 : 22;
              else c = w > 0.9 ? 60 : w > 0.72 ? 200 : w > 0.56 ? 199 : w > 0.4 ? 183 : w > 0.27 ? 182 : w > 0.16 ? 181 : 180;
              if (g < 0.35 && b > g * 2.8) c = edge ? 226 : 224;
            } else {
              // dark: deep blue glass, thin bright lines along the prism edges, a soft reflection of the windows
              // dark: clear glass (the room and the storm show through it, cooled), thin bright lines on the prism lips,
              // a soft reflection of the windows; the lantern's warm light catches it near
              const wl = 0.3 + shine * 0.5 + (edge ? 0.35 : 0) + (Math.abs(q + 0.55) < 0.08 ? 0.3 : 0);
              const lm = LAMP.on ? lampAt(X, Y, 0, q * 0.8, 0) : 0;
              if (edge) c = lm > 0.35 ? (lm > 0.7 ? 200 : 182) : wl > 0.6 ? 227 : 225;
              else { const g2 = wl > 0.55 ? 225 : wl > 0.38 ? 224 : wl > 0.25 ? 223 : 222; c = mixC(BUF[Y * W + X], g2, 2); if (lm > 0.4 && b < (lm - 0.4) * 1.5) c = 181; }
            }
          }
        }
        if (c >= 0) BUF[Y * W + X] = c;
      }
    }
  }
