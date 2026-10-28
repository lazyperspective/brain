  /* ================================================================ the Unmaker */
  // A colossus made of night: a body of void with stars drifting inside it and a magenta rim, long many-jointed arms with
  // pale fingers, a halo of black shards turning behind its head, and a face that is a white porcelain mask with three
  // vertical eyes. The mask can smile (a hairline split), grin (a mouth of starlight teeth), crack, grow a fourth eye,
  // and finally break away from what is underneath: a spiral eye like a black hole.
  // (cx, cy): the centre of the mask; s: scale (1 → the mask is 34 × 46 px); o: the face and body state.
  const VOID = [76, 77, 78, 79, 80], MAG = [70, 71, 72, 73, 74, 75], BONE = [69, 68, 67, 66, 65, 64];
  function voidFill(x, y, t, depth) {
    // night with stars drifting through it (the stars live in the body, they don't move with the camera)
    const n = vn(x * 0.7, y * 0.7 + t * 6, 18, 701), st = ih(x >> 1, (y + fl(t * 8)) >> 1, 702);
    if (st < 0.004) return 22; if (st < 0.012) return 57; if (st < 0.016) return 75;
    return VOID[clamp(fl(n * 3.2 + (depth || 0)), 0, 4)];
  }
  // the silhouette of the body: shoulders, a long falling shape, tendrils that drift (local units, mask centre at 0,0)
  function bodyInside(lx, ly, t) {
    if (ly < 16) return false;
    const ax = Math.abs(lx);
    // the shoulders rise into blades of night either side, and a smaller pair inside them
    if (ly < 32 && ax > 48 && ax < 72 && ly > 2 + Math.abs(ax - 62) * 1.5) return true;
    if (ly < 30 && ax > 36 && ax < 52 && ly > 12 + Math.abs(ax - 44) * 1.6) return true;
    const hw = ly < 30 ? lerp(11, 66, eoc((ly - 16) / 14)) : ly < 52 ? lerp(66, 56, (ly - 30) / 22) : ly < 112 ? lerp(56, 40, (ly - 52) / 60) : 40 + (ly - 112) * 0.4;
    const wave = Math.sin(ly * 0.06 - t * 1.6) * 6 + Math.sin(ly * 0.17 + t * 2.3) * 3;
    if (Math.abs(lx - wave * 0.4) > hw) return false;
    if (ly > 112) { const strand = Math.sin((lx + wave) * 0.2 + ly * 0.015) * 0.5 + 0.5; if (strand < (ly - 112) / 150) return false; }
    return true;
  }
  function spiralEye(cx, cy, r, t, open) {
    const x0 = Math.max(0, fl(cx - r)), x1 = Math.min(W - 1, Math.ceil(cx + r)), y0 = Math.max(0, fl(cy - r)), y1 = Math.min(H - 1, Math.ceil(cy + r));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy, d = Math.hypot(dx, dy) / r; if (d > 1) continue;
      const a = Math.atan2(dy, dx), sp = frac((a / TAU) * 3 + Math.log(d + 0.02) * 1.6 - t * 0.9);
      let c;
      if (d < 0.16 * open) c = d < 0.04 ? 22 : 76;                                   // the hole, and a pinpoint of white at its heart
      else if (d < 0.22 * open) c = (fl(a * 6 + t * 8) & 1) ? 75 : 73;              // the burning ring around it
      else c = sp < 0.18 ? MAG[3 + (d < 0.5 ? 1 : 0)] : sp < 0.4 ? MAG[1] : VOID[fl(d * 3) + 1];
      if (d > 0.9 && bay(x, y) < (d - 0.9) * 10) continue;
      BUF[y * W + x] = c;
    }
    // rings of teeth/glyphs turning around it
    for (let ring_ = 0; ring_ < 2; ring_++) { const rr = r * (0.55 + ring_ * 0.32), n = 18 + ring_ * 8; for (let k = 0; k < n; k++) { const a = k / n * TAU + t * (ring_ ? -0.5 : 0.7); const px = cx + Math.cos(a) * rr, py = cy + Math.sin(a) * rr; rectF(px - 1, py - 1, 2 + ring_, 2 + ring_, ring_ ? 75 : 22); } }
  }
  // o: { eyes 0 closed .. 1 open .. 2 wide, look: [x, y], smile 0..1, grin 0..1, crack 0..1, eye4 0..1, broken 0..1,
  //      arms [[shoulder x, y, hand x, y, spread], ...] (local units), halo 0..1, body (draw the body), glow 0..1, shake }
  function unmaker(cx, cy, s, t, o) {
    o = o || {};
    const L = (lx, ly) => [cx + lx * s, cy + ly * s];
    // the halo of shards, behind everything
    if (o.halo !== 0) {
      const ha = o.halo === undefined ? 1 : o.halo;
      glow(cx, cy - 6 * s, 80 * s, T_MAG, 0.25 * ha);
      for (let ring_ = 0; ring_ < 2; ring_++) {
        const R = (44 + ring_ * 18) * s, n = 14 + ring_ * 6, rot = t * (ring_ ? -0.18 : 0.26);
        for (let k = 0; k < n; k++) {
          if (ih(k, ring_, 703) > ha * 1.1) continue;
          const a = k / n * TAU + rot, px = cx + Math.cos(a) * R, py = cy - 6 * s + Math.sin(a) * R * 0.92, sz = (2 + ih(k, 4, 703) * 3) * s;
          // a black shard: a thin diamond pointing outward, rimmed with magenta
          const ux = Math.cos(a), uy = Math.sin(a);
          for (let q = -sz * 1.8; q <= sz * 1.8; q += 0.5) { const w = (1 - Math.abs(q) / (sz * 1.8)) * sz * 0.55; for (let p = -w; p <= w; p += 0.5) P(px + ux * q - uy * p, py + uy * q + ux * p, Math.abs(p) > w - 0.8 ? 73 : 76); }
          if (k % 3 === 0) P(px, py, 75);
        }
      }
    }
    // the body
    if (o.body !== false) {
      const bx0 = Math.max(0, fl(cx - 80 * s)), bx1 = Math.min(W - 1, Math.ceil(cx + 80 * s)), by0 = Math.max(0, fl(cy + 12 * s)), by1 = Math.min(H - 1, Math.ceil(cy + 260 * s));
      for (let y = by0; y <= by1; y++) for (let x = bx0; x <= bx1; x++) {
        const lx = (x + 0.5 - cx) / s, ly = (y + 0.5 - cy) / s;
        if (!bodyInside(lx, ly, t)) { if (bodyInside(lx + 1.6 / s, ly, t) || bodyInside(lx - 1.6 / s, ly, t) || bodyInside(lx, ly - 1.6 / s, t)) BUF[y * W + x] = bay(x, y) < 0.5 ? 73 : 72; continue; }
        const rim = !bodyInside(lx + 1.2 / s, ly, t) || !bodyInside(lx - 1.2 / s, ly, t) || !bodyInside(lx, ly - 1.2 / s, t);
        // the heart: a slowly turning sigil of magenta in the chest
        const hx = lx, hy = ly - 54, hr = Math.hypot(hx, hy), ha = Math.atan2(hy, hx) + t * 0.6;
        const sig = (Math.abs(hr - 12) < 0.9 || Math.abs(hr - 7) < 0.7 || (hr < 12 && Math.abs(Math.sin(ha * 3)) < 0.08 && hr > 7)) && (o.heart !== 0);
        BUF[y * W + x] = rim ? 74 : sig ? (hr < 8 ? 75 : 73) : voidFill(x, y, t, ly < 40 ? 1.2 : 0);
      }
      if (o.heart !== 0) glow(cx, cy + 54 * s, 18 * s, T_MAG, 0.35);
    }
    // arms: long thin void limbs in three segments, magenta-rimmed, ending in pale many-jointed fingers
    for (const A of o.arms || []) {
      const [sx, sy, hx, hy, spread] = A, [ax, ay] = L(sx, sy), [bx, by] = L(hx, hy), mx = (ax + bx) / 2 + (by - ay) * 0.18, my = (ay + by) / 2 - (bx - ax) * 0.18;
      for (const [p0, p1, w] of [[[ax, ay], [mx, my], 5], [[mx, my], [bx, by], 3.5]]) { thick(p0[0], p0[1], p1[0], p1[1], Math.max(2, w * s + 2), 73); thick(p0[0], p0[1], p1[0], p1[1], Math.max(1, w * s), 77); }
      discF(mx, my, 3 * s, 74); discF(mx, my, 2 * s, 77);
      const ha = Math.atan2(by - my, bx - mx);
      discF(bx, by, 4.5 * s, 66); discF(bx - Math.cos(ha) * s, by - Math.sin(ha) * s, 3.5 * s, 65);
      for (let f = -2; f <= 2; f++) {
        const fa = ha + f * (0.28 + (spread || 0) * 0.25), L1 = (7 + (f === 0 ? 2 : 0) - Math.abs(f)) * s, bend = (spread || 0) * 0.5 + 0.3;
        const k1 = [bx + Math.cos(fa) * 4 * s, by + Math.sin(fa) * 4 * s], k2 = [k1[0] + Math.cos(fa) * L1, k1[1] + Math.sin(fa) * L1], k3 = [k2[0] + Math.cos(fa + bend) * L1 * 0.8, k2[1] + Math.sin(fa + bend) * L1 * 0.8];
        thick(k1[0], k1[1], k2[0], k2[1], Math.max(1, 1.6 * s), 65); thick(k2[0], k2[1], k3[0], k3[1], Math.max(1, 1.3 * s), 66);
        P(k2[0], k2[1], 68); P(k3[0], k3[1], 69);
      }
    }
    // the mask (or what is left of it)
    const brk = o.broken || 0, sh = o.shake ? (ih(fl(t * 30), 5, 704) - 0.5) * o.shake : 0;
    if (brk > 0) spiralEye(cx, cy - 2 * s, 22 * s * (0.6 + 0.4 * eoc(brk)), t, eoc(brk));
    const RX = 16 * s, RY = 27 * s, x0 = Math.max(0, fl(cx - RX - 2 - brk * 60 * s)), x1 = Math.min(W - 1, Math.ceil(cx + RX + 2 + brk * 60 * s)), y0 = Math.max(0, fl(cy - RY - 2)), y1 = Math.min(H - 1, Math.ceil(cy + RY + 2 + brk * 90 * s));
    const eyes = o.eyes === undefined ? 1 : o.eyes, crack = o.crack || 0, smile = o.smile || 0, grin = o.grin || 0, look = o.look || [0, 0];
    const SOCK = [[-6.5, -4, -0.38], [6.5, -4, 0.38]], CRACK = [[11, -26], [8, -19], [10, -14], [5, -8], [7, -3], [2, 3], [3, 9], [-2, 16], [-1, 22]];
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      let lx = (x + 0.5 - cx - sh) / s, ly = (y + 0.5 - cy) / s;
      // broken: the mask splits down a jagged line, the halves drift apart, tilt and fall
      if (brk > 0) { const split = Math.sin(ly * 0.5) * 2; let side = 0; for (const sd of [-1, 1]) { const dxh = sd * brk * 34, dyh = brk * brk * 70, qx = lx - dxh, qy = ly - dyh - sd * qx * brk * 0.15; if ((sd < 0 && qx < split) || (sd > 0 && qx >= split)) { side = sd; lx = qx; ly = qy; break; } } if (!side) continue; }
      // a long face: a round brow, cheekbones, a narrow pointed chin
      const v = ly / 27, prof = v < 0 ? Math.sqrt(Math.max(0, 1 - v * v)) : Math.sqrt(Math.max(0, 1 - v * v)) * (1 - 0.42 * v), u = lx / 16;
      if (Math.abs(u) > prof) continue;
      const e = Math.abs(u) / Math.max(0.01, prof), lit = -u * 0.55 - v * 0.6 + (Math.abs(u) < 0.12 && v > -0.35 && v < 0.25 ? 0.5 : 0);
      let c = BONE[clamp(fl(3.5 + lit * 2 - (e > 0.86 ? 1.6 : 0) - (v > 0.05 && v < 0.3 && Math.abs(u) > 0.42 && Math.abs(u) < 0.85 ? 1 : 0) - (v > 0.55 ? 0.8 : 0)), 0, 5)];
      if (Math.abs(lx - 9 + Math.sin(ly * 0.7) * 1.5) < 0.6 && ly > -24 && ly < -10) c = 67;            // a hairline crack in the brow
      // the sockets: hollow, slanted into a scowl; a burning slit in each
      for (const [ex, ey, rot] of SOCK) {
        const dx = lx - ex, dy = ly - ey, rx = dx * Math.cos(rot) + dy * Math.sin(rot), ry = -dx * Math.sin(rot) + dy * Math.cos(rot), sz = 1 + (eyes > 1 ? 0.15 : 0);
        const inn = (rx * rx) / (4.6 * sz) ** 2 + (ry * ry) / (2.7 * sz) ** 2;
        if (inn < 1) { c = inn > 0.7 ? 77 : 76; const px = dx - look[0] * 1.6, py = dy - look[1] * 1.2, sw = eyes > 1 ? 1.0 : 0.6; if (eyes > 0.05 && Math.abs(px) < sw * Math.min(1, eyes) && Math.abs(py) < 2.4) c = Math.abs(px) < 0.35 && Math.abs(py) < 1.2 ? 22 : eyes > 1 ? 75 : 74; }
        else if (inn < 1.35) c = Math.min(c, 67) === c ? c : 67;
        // black streaks running down from the sockets, like old tears
        if (dy > 1.5 && dy < 18 && Math.abs(dx - Math.sin(dy * 0.5 + ex) * 0.8 + (ex < 0 ? -1.5 : 1.5)) < 0.45 + (dy > 14 ? 0.2 : 0)) c = 77;
      }
      // the fissure in the forehead: a third eye, vertical
      { const dx = lx, dy = ly + 16, inn = (dx * dx) / (1.7 ** 2) + (dy * dy) / (5.5 ** 2); if (inn < 1) c = eyes > 0.05 && Math.abs(dx) < 0.5 * Math.min(1, eyes) + (eyes > 1 ? 0.3 : 0) && Math.abs(dy) < 4 ? (eyes > 1 ? 75 : 74) : 76; else if (inn < 1.4) c = 67; }
      // veins of magenta spreading from the eyes when they burn wide
      // veins of magenta forking out from the sockets when the eyes burn wide
      if (eyes > 1.2) { const k = eyes - 1.2; for (const [ex, ey] of SOCK) for (let j = 0; j < 4; j++) { const a = (ex < 0 ? PI : 0) + (j - 1.5) * 0.55, dx = lx - ex, dy = ly - ey, along = dx * Math.cos(a) + dy * Math.sin(a), across = -dx * Math.sin(a) + dy * Math.cos(a) + Math.sin(along * 0.9 + j) * 1.1; if (along > 4.5 && along < 4.5 + 7 * k && Math.abs(across) < 0.4) c = along < 7 ? 73 : 72; } }
      // the crack: a jagged fracture from the brow down across the face (and a branch), burning inside, growing with crack
      if (crack > 0) { let dmin = 1e9, along = 0, acc = 0; for (let i = 0; i + 1 < CRACK.length; i++) { const [ax, ay] = CRACK[i], [bx, by] = CRACK[i + 1], dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy, q = clamp(((lx - ax) * dx + (ly - ay) * dy) / L2, 0, 1), dd = Math.hypot(lx - ax - q * dx, ly - ay - q * dy); if (dd < dmin) { dmin = dd; along = acc + q * Math.sqrt(L2); } acc += Math.sqrt(L2); }
        const bd = Math.hypot(lx - 3 - (ly + 4) * -0.6, 0) + 0, br = ly > -6 && ly < 2 && Math.abs(lx - (6 - (ly + 6) * 0.9)) < 0.5 * crack;
        if ((dmin < 0.5 + crack * 1.3 && along < crack * 60) || br) c = dmin < 0.45 + crack * 0.5 ? (crack > 0.5 ? 75 : 74) : 70; }
      if (o.eye4 > 0) { const dx = lx - 10.5, dy = ly + 13, eh = 5.5 * o.eye4, inn = (dx * dx) / (2.4 * o.eye4) ** 2 + (dy * dy) / (eh * eh); if (inn < 1) c = Math.abs(dx) < 0.6 ? 22 : inn < 0.6 ? 75 : 76; }
      // the smile: a hairline split from cheek to cheek that curls upward; the grin opens it onto night and starlight teeth
      const my = 11 - (lx * lx) * 0.035 * (smile + grin), mo = grin * 7;
      if ((smile > 0 || grin > 0) && Math.abs(lx) < 13.5 * Math.max(smile, grin)) {
        if (ly > my - 0.6 && ly < my + 0.6 + mo) {
          if (mo > 1 && ly > my + 0.6 && ly < my + mo - 0.6) { const tw = Math.abs(frac(lx / 1.9) - 0.5) * 2, top = ly < my + mo / 2, depth = top ? ly - my : my + mo - ly; c = tw < 1 - depth / 2.6 ? 22 : voidFill(x, y, t, 0); }
          else c = 76;
        }
      }
      BUF[y * W + x] = c;
    }
    // the eyes burn
    if (eyes > 0.5 && o.glow !== 0 && brk < 0.3) { const ga = (o.glow === undefined ? 0.3 : o.glow) * Math.min(1.4, eyes); for (const [ex, ey] of [[-6.5, -4], [6.5, -4], [0, -16]]) glow(cx + ex * s, cy + ey * s, 7 * s * (eyes > 1 ? 1.4 : 1), T_MAG, ga); }
  }

  /* ================================================================ its powers, as screen effects */
  const T_MAG = mkTab('ff3ac8', true), T_CYAN = mkTab('40d8ff', true), T_VOIDT = mkTab('0c0418', false);
  // the colour every palette entry becomes when the world is inverted, or drained to grey
  const INV = new Uint8Array(256), GREYM = new Uint8Array(256);
  for (let i = 0; i < NPAL; i++) { const p = PAL[i]; INV[i] = nearest(255 - p[0], 255 - p[1], 255 - p[2]); const l = p[0] * 0.3 + p[1] * 0.55 + p[2] * 0.15; GREYM[i] = l > 200 ? 95 : l > 120 ? 94 : l > 60 ? 93 : l > 20 ? 92 : 0; }
  // map the frame (amt: fraction of pixels, dithered) through a table
  function mapFx(M, amt) { if (amt <= 0) return; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (amt >= 1 || bay(x, y) < amt) BUF[y * W + x] = M[BUF[y * W + x]]; }
  // REWIND: the picture tracks like a tape spun backwards: rolling bars, tearing rows, fringes, a ◀◀ in the corner
  function rewindFx(amt, t) {
    if (amt <= 0) return;
    TMP.set(BUF);
    const f = fl(t * 30), roll = (t * 900) % H;
    for (let y = 0; y < H; y++) {
      const band = Math.abs(((y + roll) % 90) - 45) < 4, tear = ih(fl(y / 2), f, 711) < 0.12 * amt ? Math.round((ih(fl(y / 2), f, 712) - 0.5) * 40 * amt) : 0;
      for (let x = 0; x < W; x++) { const sx = clamp(x - tear, 0, W - 1); let c = TMP[y * W + sx]; if (band && bay(x, y) < amt * 0.55) c = ih(x >> 1, y + f, 713) < 0.5 ? 22 : 20; BUF[y * W + x] = c; }
    }
    for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x++) if (bay(x, y) < amt * 0.25) BUF[y * W + x] = T_DARK[3][BUF[y * W + x]];
    if (amt > 0.3 && (f >> 3) % 2 === 0) { for (const ox of [0, 9]) for (let j = 0; j < 9; j++) for (let i = 0; i <= j && i < 9 - j; i++) { P(40 + ox + 8 - i - 4, 40 + j, 22); P(40 + ox + 8 - i - 4, 48 - j, 22); } text('REWIND', 64, 41, 22, 1); }
  }
  // KALEIDOSCOPE: the frame folded into n mirrored wedges about (cx, cy), turning
  function kaleido(cx, cy, n, rot, amt) {
    if (amt <= 0) return;
    TMP.set(BUF);
    const wedge = TAU / n;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (amt < 1 && bay(x, y) >= amt) continue;
      const dx = x - cx, dy = y - cy, r = Math.hypot(dx, dy); let a = Math.atan2(dy, dx) - rot;
      a = ((a % wedge) + wedge) % wedge; if (a > wedge / 2) a = wedge - a;
      const sx = clamp(fl(cx + Math.cos(a + rot) * r), 0, W - 1), sy = clamp(fl(cy + Math.sin(a + rot) * r), 0, H - 1);
      BUF[y * W + x] = TMP[sy * W + sx];
    }
  }
  // SHATTER: the frame breaks into tiles that slide and spin away from (cx, cy); the gaps are void
  function shatterFx(cx, cy, amt, t, size) {
    if (amt <= 0) return;
    TMP.set(BUF);
    const sz = size || 30;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const tx = fl(x / sz + (fl(y / sz) & 1) * 0.5), ty = fl(y / sz), mx = (tx + 0.5 - (fl(y / sz) & 1) * 0.5) * sz, my = (ty + 0.5) * sz;
      const dx = mx - cx, dy = my - cy, d = Math.hypot(dx, dy) + 1, push = amt * (20 + ih(tx, ty, 721) * 40), ang = (ih(tx, ty, 722) - 0.5) * amt * 0.6;
      const lx = x - mx, ly = y - my, rx = lx * Math.cos(ang) + ly * Math.sin(ang), ry = -lx * Math.sin(ang) + ly * Math.cos(ang);
      const sx = fl(mx - dx / d * push + rx), sy = fl(my - dy / d * push + ry);
      if (Math.abs(rx) > sz / 2 - amt * 2 || Math.abs(ry) > sz / 2 - amt * 2) { BUF[y * W + x] = 76; continue; }
      BUF[y * W + x] = sx >= 0 && sy >= 0 && sx < W && sy < H ? TMP[sy * W + sx] : 76;
    }
  }
  // UNWRITE: the picture erased in falling columns, each edge chewing at it with glitch
  function unwriteFx(prog, t, fromRight) {
    if (prog <= 0) return;
    const f = fl(t * 20);
    for (let x = 0; x < W; x++) {
      const col = fl(x / 6), lim = prog * (H + 120) - ih(col, 1, 731) * 120;
      for (let y = 0; y < H; y++) {
        const yy = fromRight ? H - 1 - y : y;
        if (y < lim) BUF[yy * W + x] = (y > lim - 3 && ih(x, y + f, 732) < 0.6) ? 74 : ih(x >> 2, (y >> 2) + f, 733) < 0.03 ? 75 : 76;
      }
    }
  }
  // prism rays out of (cx, cy), turning
  function prismRays(cx, cy, n, len, rot, w, amt) {
    for (let k = 0; k < n; k++) {
      const a = rot + k * TAU / n, c = 81 + (k % 7);
      for (let r = 6; r < len; r += 1) { const sp = w * (1 - r / len); for (let q = -sp; q <= sp; q += 0.7) { const x = cx + Math.cos(a) * r - Math.sin(a) * q, y = cy + Math.sin(a) * r + Math.cos(a) * q; if (bay(fl(x), fl(y)) < amt * (1 - r / len) * 1.3) P(x, y, Math.abs(q) < sp * 0.4 ? 22 : c); } }
    }
  }
  // the four element orbs: water, leaf, lightning, starlight; orbiting (cx, cy) at radius r (k: which to draw)
  const ORB = [[45, 46, 47], [48, 49, 50], [51, 52, 53], [54, 55, 56]];
  function orbAt(x, y, k, r, t) { glow(x, y, r * 3.2, EL_T[k], 0.5); discF(x, y, r, ORB[k][1]); discF(x - r * 0.25, y - r * 0.25, r * 0.6, ORB[k][2]); P(x - r * 0.4, y - r * 0.4, 22); }
  function orbs(cx, cy, R, t, r, which, tilt) { for (let k = 0; k < 4; k++) { if (which && !which[k]) continue; const a = t * 2.4 + k * TAU / 4; orbAt(cx + Math.cos(a) * R, cy + Math.sin(a) * R * (tilt || 0.45), k, r || 3, t); } }
  // wings of light for the zenith form: layered feathers fanning out from (x, y), in prism colours
  function wings(x, y, s, t, spread) {
    for (const side of [-1, 1]) for (let k = 0; k < 9; k++) {
      const a = -PI / 2 + side * (0.35 + k * 0.17 * spread), L = (22 + k * 4 - Math.abs(k - 4) * 2) * s * spread, flap = Math.sin(t * 3 + k * 0.3) * 0.05;
      for (let r = 4 * s; r < L; r += 0.8) { const w = Math.sin(PI * r / L) * 2.2 * s; for (let q = -w; q <= w; q += 0.8) { const aa = a + flap * side, px = x + Math.cos(aa) * r - Math.sin(aa) * q, py = y + Math.sin(aa) * r * 0.9 + Math.cos(aa) * q + r * 0.25; if (bay(fl(px), fl(py)) > 0.85 + r / L * 0.1) continue; P(px, py, Math.abs(q) < w * 0.35 ? 22 : 81 + ((k + fl(t * 6)) % 7)); } }
    }
  }
