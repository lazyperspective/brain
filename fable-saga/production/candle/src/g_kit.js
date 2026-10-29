  /* ================================================================ Snow Globe: the scene kit
     Ramps, a dithered ramp pick, soft light, and snow that falls at every scale. */
  // pick from a ramp (dark → light) at level v ∈ [0, 1], ordered-dithered between neighbours by d = bay(X, Y)
  const rp = (R, v, d) => R[clamp(fl(v * (R.length - 1) + d), 0, R.length - 1)];
  const R_PINE = [0, 149, 150, 151, 152, 153], R_RED = [154, 155, 156, 157, 158], R_WOOD = [27, 159, 160, 161, 162, 163, 31];
  const R_LOG = [159, 160, 161, 162, 163, 31, 15], R_SKIN = [166, 165, 164], R_SNOW = [134, 135, 136, 167, 168, 169, 170, 22];
  const R_STONE = [120, 121, 122, 123, 19], R_BRASS = [173, 174, 175, 16], R_CREAM = [67, 66, 65, 64, 22], R_FIRE = [11, 12, 13, 14, 15, 16, 22];
  const R_NIGHT = [114, 115, 134, 135, 136, 137];
  // a soft light's reach at distance² q from it, radius r: 1 at the light, 0.5 at r, falling off gently
  const lit = (q, r) => 1 / (1 + q / (r * r));
  // a flicker on the loop (n: its speed in turns per loop; k: a seed)
  const flick = (t, k) => 0.82 + 0.1 * Math.sin(zP(t, 23) + k) + 0.06 * Math.sin(zP(t, 37) + k * 2.3) + 0.04 * Math.sin(zP(t, 61) + k * 0.7);

  /* snow falling over a box of units, the same on screen at every zoom (zStars' octave cells): each column of cells
     holds a flake per cell, its 8-cell pattern sliding down `fall` patterns per loop (so the loop closes) and swaying.
     ok(x, y), if given: may a flake be here (behind nothing)? */
  function zSnow(V, t, x0, y0, x1, y1, dens, seed, fall, cols, ok) {
    cols = cols || [136, 167, 168, 169, 170, 22];
    const u = V.u, P0 = Math.sqrt(340 / dens), Yt = Math.max(V.box[1], LB), Yb = Math.min(V.box[3], H - 1 - LB), Hh = V.hole;
    const xa = Math.max(x0, V.lx(V.box[0] - 2)), xb = Math.min(x1, V.lx(V.box[2] + 2)), ya = Math.max(y0, V.ly(Yt - 2)), yb = Math.min(y1, V.ly(Yb + 2));
    if (xb < xa || yb < ya) return;
    for (let k = Math.ceil(Math.log2(P0 / u)); k < 40; k++) {
      const cs = Math.pow(2, k), pc = cs * u; if (cs > 4 * Math.max(x1 - x0, y1 - y0)) break;
      const fade = sstep(P0, 2 * P0, pc), sd = seed + (k + 64) * 17, off = fall * 8 * cs * t / ZD;
      for (let ii = fl(xa / cs) - 1; ii <= fl(xb / cs) + 1; ii++) {
        const sw = cs * 0.32 * Math.sin(zP(t, 1 + (ii & 1)) + ii * 1.7);
        for (let jj = fl((ya - off) / cs) - 1; jj <= fl((yb - off) / cs) + 1; jj++) {
          const jm = ((jj % 8) + 8) % 8, h = ih(ii, jm, sd); if (h > fade) continue;
          const x = (ii + ih(ii, jm, sd + 1)) * cs + sw * (0.6 + 0.8 * ih(ii, jm, sd + 4)), y = (jj + ih(ii, jm, sd + 2) * 0.85) * cs + off;
          if (x < x0 || x > x1 || y < y0 || y > y1 || (ok && !ok(x, y))) continue;
          const X = fl(V.X(x)), Y = fl(V.Y(y)); if (X < V.box[0] || X > V.box[2] || Y < Yt || Y > Yb) continue;
          if (Hh && X >= Hh[0] && X <= Hh[2] && Y >= Hh[1] && Y <= Hh[3]) continue;
          const b = ih(ii, jm, sd + 3) * clamp((fade - h) / 0.35, 0.3, 1), c = cols[clamp(fl(b * cols.length), 0, cols.length - 1)];
          BUF[Y * W + X] = c;
          if (b > 0.88 && X + 1 <= V.box[2] && Y + 1 <= Yb) { BUF[Y * W + X + 1] = c; BUF[(Y + 1) * W + X] = c; BUF[(Y + 1) * W + X + 1] = cols[cols.length - 2]; }
        }
      }
    }
  }
  // a window's glass: a crisp rectangle (its frame is the outer layer's), and where the layer inside covers it whole
  const paneMask = (x, y) => clamp((36 - Math.abs(x)) / 0.8, 0, 1) * clamp((22 - Math.abs(y)) / 0.8, 0, 1), PANE_BOX = [-36, -22, 36, 22], PANE_HOLE = [-35, -21, 35, 21];
  // is (x, y) on the text s set from (x0, y0) (its top left) in the pixel font, sc units to a font pixel?
  function glyphAt(s, x, y, x0, y0, sc) {
    const gy = fl((y - y0) / sc); if (gy < 0 || gy > 6) return false;
    let cx = x0;
    for (let i = 0; i < s.length; i++) { const g = FONT[s[i]] || FONT[' '], gw = g[0].length; if (x >= cx && x < cx + gw * sc) { const gx = fl((x - cx) / sc); return g[gy][gx] === '#'; } cx += (gw + 1) * sc; }
    return false;
  }
  const textW = (s, sc) => { let w = 0; for (const ch of s) w += ((FONT[ch] || FONT[' '])[0].length + 1) * sc; return w - sc; };
