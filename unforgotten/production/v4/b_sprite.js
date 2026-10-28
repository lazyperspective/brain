  /* ================================================================ sprites: hand-pixelled parts on a light rig */
  // A character is put together in a small sprite canvas each frame: hand-drawn pixel art for the parts that carry
  // character (head, face, hair, coat) and short drawn limbs for the parts that move. The canvas is then outlined the way
  // a pixel artist would (a dark line round the outside, in the darkest shade of whatever it touches), lit from the
  // scene's key light, and stamped into the frame at a whole-pixel scale.
  const SW = 160, SH = 176, SOX = 80, SOY = 160;                // local origin (feet) at (80, 160)
  const SPR = new Int16Array(SW * SH).fill(-1), SPK = new Uint8Array(SW * SH), SBB = [SW, SH, -1, -1];
  // kinds: 1 body, 2 prop, 3 glow (never outlined or shaded), 4 outline (hand-drawn or automatic)
  function sclear() { SPR.fill(-1); SPK.fill(0); SBB[0] = SW; SBB[1] = SH; SBB[2] = -1; SBB[3] = -1; }
  function sp(x, y, c, k) {
    const X = Math.round(x) + SOX, Y = Math.round(y) + SOY; if (X < 0 || Y < 0 || X >= SW || Y >= SH || c < 0) return;
    const i = Y * SW + X; SPR[i] = c; SPK[i] = k || 1;
    if (X < SBB[0]) SBB[0] = X; if (Y < SBB[1]) SBB[1] = Y; if (X > SBB[2]) SBB[2] = X; if (Y > SBB[3]) SBB[3] = Y;
  }
  // hand-drawn rows: a key maps each character to a colour; 'k' is the hand-drawn outline; '.' is empty.
  // (x, y) is where the art's anchor (ax, ay) lands; flip mirrors it about the anchor
  function art(A, x, y, flip, key) {
    const K = key || A.key, rows = A.rows, ax = A.ax || 0, ay = A.ay || 0;
    for (let j = 0; j < rows.length; j++) { const row = rows[j]; for (let i = 0; i < row.length; i++) { const ch = row[i]; if (ch === '.' || ch === ' ') continue; const c = K[ch]; if (c === undefined) continue; sp(x + (flip ? ax - i : i - ax), y + j - ay, typeof c === 'function' ? c() : c, ch === 'k' ? 4 : ch === '*' ? 3 : 1); } }
  }
  // a drawn limb: a thick line with a lit edge and a shadowed edge (ramp, base shade), r: half-width
  function limb(ax, ay, bx, by, r0, r1, ramp, base, kind) {
    const dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L, n = Math.ceil(L * 2), lit = nx * LIGHTS.x + ny * LIGHTS.y;
    for (let i = 0; i <= n; i++) {
      const u = i / n, cx = ax + dx * u, cy = ay + dy * u, r = lerp(r0, r1, u);
      for (let q = -r; q <= r + 0.01; q += 0.5) { const w = q / Math.max(0.5, r), s = base + (w * lit > 0.45 ? 1 : w * lit < -0.45 ? -1 : 0); sp(cx + nx * q, cy + ny * q, ramp * 8 + clamp(s, 0, 7), kind || 1); }
    }
  }
  // a small round thing (a hand, a knee, a cord): lit on the light side
  function blob(cx, cy, r, ramp, base, kind) { for (let y = fl(cy - r); y <= cy + r; y++) for (let x = fl(cx - r); x <= cx + r; x++) { const dx = x + 0.5 - cx, dy = y + 0.5 - cy; if (dx * dx + dy * dy > r * r + 0.3) continue; const l = (dx * LIGHTS.x + dy * LIGHTS.y) / Math.max(1, r); sp(x, y, ramp * 8 + clamp(base + (l > 0.35 ? 1 : l < -0.4 ? -1 : 0), 0, 7), kind || 1); } }
  // the light as the sprite sees it (flipped with the sprite)
  const LIGHTS = { x: -0.6, y: -0.8 }, LIGHT = { x: -0.6, y: -0.8 };
  // the automatic outline: every empty pixel touching a body pixel takes the darkest shade of what it touches;
  // pixels on the lit side of the silhouette take ENV.edge if a scene sets one (a rim of light, like The Null)
  const OUTS = new Int16Array(SW * SH);
  function soutline(edge) {
    OUTS.set(SPR);
    const x0 = Math.max(1, SBB[0] - 1), x1 = Math.min(SW - 2, SBB[2] + 1), y0 = Math.max(1, SBB[1] - 1), y1 = Math.min(SH - 2, SBB[3] + 1);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const i = y * SW + x; if (OUTS[i] >= 0) continue;
      let src = -1, dx = 0, dy = 0;
      for (const [j, ox, oy] of [[i - 1, -1, 0], [i + 1, 1, 0], [i - SW, 0, -1], [i + SW, 0, 1]]) if (OUTS[j] >= 0 && SPK[j] !== 3 && SPK[j] !== 4) { src = OUTS[j]; dx = ox; dy = oy; break; }
      if (src < 0) continue;
      const lit = -(dx * LIGHTS.x + dy * LIGHTS.y) > 0.4;
      SPR[i] = lit && edge !== undefined && edge !== null ? edge : (src >> 3) * 8 + (lit ? 1 : 0); SPK[i] = 4;
    }
    SBB[0] = Math.max(0, SBB[0] - 1); SBB[1] = Math.max(0, SBB[1] - 1); SBB[2] = Math.min(SW - 1, SBB[2] + 1); SBB[3] = Math.min(SH - 1, SBB[3] + 1);
  }
  // stamp the sprite into the frame: feet at (x, y), whole-pixel scale S, flip; o: alpha, fx(c, x, y) colour filter,
  // white (a flash), color (a silhouette), noOutline
  function stamp(x, y, S, flip, o) {
    o = o || {}; x = Math.round(x); y = Math.round(y); S = Math.max(1, Math.round(S || 1));
    if (o.rot || o.sx || o.sy) return stampRot(x, y, S, flip, o);
    for (let j = SBB[1]; j <= SBB[3]; j++) for (let i = SBB[0]; i <= SBB[2]; i++) {
      const k = j * SW + i; let c = SPR[k]; if (c < 0) continue;
      if (o.color !== undefined) c = o.color; else if (o.white) c = SPK[k] === 4 ? C('hush', 3) : WHITE;
      const ox = flip ? -(i - SOX) - 1 : i - SOX, ly = j - SOY;
      for (let q = 0; q < S; q++) for (let p = 0; p < S; p++) {
        const X = x + ox * S + p, Y = y + ly * S + q;
        if (X < 0 || Y < 0 || X >= W || Y >= H) continue;
        if (o.alpha !== undefined && bay(X, Y) >= o.alpha) continue;
        const cc = o.fx ? o.fx(c, X, Y, SPK[k]) : c; if (cc >= 0) BUF[Y * W + X] = cc;
      }
    }
  }
  // a rotated stamp: every frame pixel samples the sprite through the inverse rotation about a pivot (piv: sprite px
  // above the feet), so the pixels stay whole and crisp at any angle
  function stampRot(x, y, S, flip, o) {
    // (sx, sy: a squash or stretch about the pivot, for the frames of an impact or a hop)
    const piv = o.piv === undefined ? 30 : o.piv, px = x, py = y - piv * S, ca = Math.cos(o.rot || 0), sa = Math.sin(o.rot || 0), kx = o.sx || 1, ky = o.sy || 1;
    const R_ = Math.hypot(Math.max(SOX - SBB[0], SBB[2] - SOX) + 1, Math.max(Math.abs(SBB[1] - SOY + piv), Math.abs(SBB[3] - SOY + piv)) + 1) * S * Math.max(kx, ky, 1);
    for (let Y = Math.max(0, fl(py - R_)); Y < Math.min(H, py + R_); Y++) for (let X = Math.max(0, fl(px - R_)); X < Math.min(W, px + R_); X++) {
      const dx = (X + 0.5 - px) / S, dy = (Y + 0.5 - py) / S, sx = (dx * ca + dy * sa) / kx, sy = (-dx * sa + dy * ca) / ky;
      const ox = fl(sx), i = flip ? SOX - 1 - ox : ox + SOX, j = fl(sy - piv + SOY);
      if (i < SBB[0] || i > SBB[2] || j < SBB[1] || j > SBB[3]) continue;
      const k = j * SW + i; let c = SPR[k]; if (c < 0) continue;
      if (o.color !== undefined) c = o.color; else if (o.white) c = WHITE;
      if (o.alpha !== undefined && bay(X, Y) >= o.alpha) continue;
      const cc = o.fx ? o.fx(c, X, Y, SPK[k]) : c; if (cc >= 0) BUF[Y * W + X] = cc;
    }
  }
