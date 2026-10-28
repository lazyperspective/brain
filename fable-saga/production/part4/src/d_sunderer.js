  /* ================================================================ the Sunderer: the Unmaker's brother
     Where his brother erased, he breaks. A mountain of obsidian veined with molten seams, broad porcelain shoulders, four
     arms ending in porcelain gauntlets, a crown of black blades, and a mask of the same porcelain as his brother's: wider,
     heavier in the jaw, split top to bottom by a seam of fire, with two burning slits for eyes and a mouth that tears open.
     Local units like the Unmaker's (s screen px each): the mask is 38 wide and 50 tall about (cx, cy); the shoulders span
     about 200; the body runs on down out of the frame. */
  const OBS = [96, 97, 98, 99, 100], MOLT = [101, 102, 103, 104, 105, 106, 107], BONE4 = [69, 68, 67, 66, 65, 64];
  const T_EMBER = mkTab('ff5020', true), T_BLOOD = mkTab('c01008', true), T_ASH = mkTab('3a3030', false);
  // the four shoulders (local): upper pair, lower pair
  const SH4 = [[-84, 40], [84, 40], [-60, 94], [60, 94]];
  // a filled capsule (a thick segment with round ends, radius r0 at a to r1 at b), each pixel coloured by fn(u, d, x, y)
  // where u runs 0..1 along it and d is the distance from the axis over the radius (0 middle .. 1 rim)
  function capsF(ax, ay, bx, by, r0, r1, fn) {
    const R = Math.max(r0, r1), x0 = Math.max(0, fl(Math.min(ax, bx) - R - 1)), x1 = Math.min(W - 1, Math.ceil(Math.max(ax, bx) + R + 1));
    const y0 = Math.max(0, fl(Math.min(ay, by) - R - 1)), y1 = Math.min(H - 1, Math.ceil(Math.max(ay, by) + R + 1));
    const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy || 1;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const px = x + 0.5 - ax, py = y + 0.5 - ay, u = clamp((px * dx + py * dy) / L2, 0, 1), qx = px - dx * u, qy = py - dy * u, r = lerp(r0, r1, u), d2 = qx * qx + qy * qy;
      if (d2 > r * r) continue;
      const c = fn(u, Math.sqrt(d2) / r, x, y, qx / r, qy / r); if (c >= 0) BUF[y * W + x] = c;
    }
  }
  /* a limb: a tube from a to b whose radius follows rfn(u); shaded as a lit cylinder (light from the upper left), glossy
     where it faces the light, rim-lit by the fire on its far side; fn(u, side, lit, X, Y) may override the colour */
  function limbF(ax, ay, bx, by, rfn, rmax, fn) {
    const x0 = Math.max(0, fl(Math.min(ax, bx) - rmax - 1)), x1 = Math.min(W - 1, Math.ceil(Math.max(ax, bx) + rmax + 1));
    const y0 = Math.max(0, fl(Math.min(ay, by) - rmax - 1)), y1 = Math.min(H - 1, Math.ceil(Math.max(ay, by) + rmax + 1));
    const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy || 1, L = Math.sqrt(L2), nx0 = -dy / L, ny0 = dx / L;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const px = x + 0.5 - ax, py = y + 0.5 - ay, uu = (px * dx + py * dy) / L2, u = clamp(uu, 0, 1), qx = px - dx * u, qy = py - dy * u, r = rfn(u);
      const d2 = qx * qx + qy * qy; if (d2 > r * r) continue;
      const sdn = (qx * nx0 + qy * ny0) / r, cap = uu < 0 || uu > 1;                   // -1 .. 1 across the tube
      // the surface normal of a cylinder seen side-on, tilted at the round ends
      const nX = nx0 * sdn + (cap ? (uu < 0 ? -dx : dx) / L * 0.6 : 0), nY = ny0 * sdn + (cap ? (uu < 0 ? -dy : dy) / L * 0.6 : 0), nz = Math.sqrt(Math.max(0, 1 - sdn * sdn));
      const lit = -nX * 0.55 - nY * 0.7 + nz * 0.45;
      const c = fn(u, sdn, lit, x, y, Math.sqrt(d2) / r); if (c >= 0) BUF[y * W + x] = c;
    }
  }
  const obsLit = (lit, X, Y, e, heat) => e > 0.9 ? 96 : (lit < -0.55 && e > 0.62 && heat > 0.2) ? 102 : lit > 0.78 ? (e < 0.5 ? 122 : 100) : OBS[clamp(fl(1.6 + lit * 2.6 + (bay(X, Y) - 0.5) * 0.8), 0, 4)];
  // porcelain, lit from the upper left: (nx, ny) the surface's lean (-1..1)
  const bone = (nx, ny, x, y, k) => BONE4[clamp(fl(3 + (-nx * 0.9 - ny * 0.8) * 1.6 + (bay(x, y) - 0.5) * 0.9 + (k || 0)), 0, 5)];
  /* a hand of porcelain plates: wrist at (x, y), pointing along angle a, scale s.
     h: { curl 0 (open) .. 1 (fist), or curls [index, middle, ring, little], thumb 0..1 (tucked across), spread 0..1 (fanned),
          side ±1 (which side the thumb is on), heat (fire in the joints), layer 'palm' | 'fingers' | undefined (both),
          hold(info): drawn between the palm and the fingers (whatever the hand is holding) }.
     The fingers bend toward the viewer as they curl: each joint folds, the segment foreshortens (cos of its bend) and past a
     right angle it lies back over the palm — so open hand, claw, grip and fist are one continuous motion.
     Returns [x, y] of the striking point (the knuckles of a fist, the fingertips of an open hand) with .palm, .tip, .knuckles. */
  const H_FL = [0.95, 1.05, 1.0, 0.82], H_FR = [1, 1.05, 1, 0.88], H_SEG = [8.2, 6.0, 4.4], H_SR = [2.7, 2.4, 2.1], H_FLEX = [1.0, 1.4, 1.05];
  function sHand(x, y, s, a, h, t) {
    h = h || {};
    const ux = Math.cos(a), uy = Math.sin(a), vx = -uy, vy = ux, sd = h.side || 1, heat = h.heat || 0;
    const L = (al, ac) => [x + ux * al * s + vx * ac * s, y + uy * al * s + vy * ac * s];
    const curls = h.curls || [0, 1, 2, 3].map((k) => clamp((h.curl || 0) * (1.06 - k * 0.02), 0, 1));
    const spread = h.spread === undefined ? 0.3 : h.spread, th = h.thumb === undefined ? (h.curl || 0) * 0.9 : h.thumb;
    const outl = Math.max(1, 1.3 * Math.min(1, s / 1.4));
    // the geometry, in hand space: palm capsules, finger chains, thumb
    const palm = [[1, 0, 9.5, 0, 8.6, 8.2], [2, -5.6, 10.4, -5.4, 4.6, 4.2], [2, 5.6, 10.4, 5.4, 4.6, 4.2]];
    const fingers = [];
    let front = -1e9, frontP = null, tipP = null;
    for (let k = 0; k < 4; k++) {
      const v0 = sd * (6.3 - 4.2 * k), fan = spread * (k - 1.5) * -sd * 0.17, c = curls[k];
      let px = 10.8, py = v0, phi = 0;
      const segs = [];
      for (let j = 0; j < 3; j++) {
        phi += c * H_FLEX[j] * 1.25;
        const len = H_SEG[j] * H_FL[k], pr = Math.cos(Math.min(phi, PI)), dx = Math.cos(fan) * len * pr, dy = Math.sin(fan) * len * Math.abs(pr) + (phi > PI / 2 ? -sd * 0 : 0);
        // past a right angle the segment comes back over the palm, drifting toward its middle
        const qx = px + dx, qy = py + dy + (phi > 1.2 ? -v0 * 0.05 * (phi - 1.2) : 0);
        segs.push([px, py, qx, qy, H_SR[j] * H_FR[k], phi]);
        if (j === 0 && qx > front) { front = qx; frontP = [qx, qy]; }
        px = qx; py = qy;
      }
      if (k === 0) tipP = [px, py];
      if (px > front) { front = px; frontP = [px, py]; }
      fingers.push({ segs, c });
    }
    const tb = [2.6, sd * 7.6], topen = [2.6 + 6.5 * Math.cos(1.0), sd * (7.6 + 6.5 * Math.sin(1.0))], tcurl = [11.4, sd * 0.6];
    const tmid = [lerp((tb[0] + topen[0]) / 2, 8.2, th), lerp((tb[1] + topen[1]) / 2, sd * 6.4, th)], ttip = [lerp(topen[0], tcurl[0], th), lerp(topen[1], tcurl[1], th)];
    const thumb = [[tb[0], tb[1], tmid[0], tmid[1], 3.1, 2.8], [tmid[0], tmid[1], ttip[0], ttip[1], 2.8, 2.3]];
    // drawing helpers
    const capL = (q, pad, fn) => { const [ax, ay] = L(q[0], q[1]), [bx, by] = L(q[2], q[3]); capsF(ax, ay, bx, by, q[4] * s + pad, q[5] * s + pad, fn); };
    const shade = (k0) => (u, d, X, Y, nx, ny) => d > 0.84 ? 69 : bone(nx, ny, X, Y, k0);
    const doPalm = h.layer !== 'fingers', doFing = h.layer !== 'palm';
    if (doPalm) {
      for (const q of palm) capL(q, outl, () => 96);
      for (const q of palm) capL(q, 0, shade(-0.2));
      // the plates of the back of the hand, and the knuckle ridge
      for (let k = 0; k < 3; k++) { const [ax, ay] = L(2.5 + k * 0.3, sd * (4.2 - 4.2 * k) * 0.9), [bx, by] = L(9.6, sd * (4.2 - 4.2 * k)); lineP(ax, ay, bx, by, k === 1 ? 67 : 68); }
      for (let k = 0; k < 4; k++) { const [kx, ky] = L(10.6, sd * (6.3 - 4.2 * k)); discF(kx, ky, Math.max(1, 2.2 * s), curls[k] > 0.45 ? 64 : 66); }
      if (heat > 0.25) { const [ax, ay] = L(0.4, -7), [bx, by] = L(0.4, 7); lineP(ax, ay, bx, by, heat > 0.6 ? 105 : 103); }
    }
    if (h.hold) h.hold({ palm: L(5.5, 0), front: L(frontP[0], frontP[1]), ux, uy, s });
    if (doFing) {
      // fingers: the ones folded furthest are drawn last (they lie nearest the viewer)
      const order = [0, 1, 2, 3].sort((p_, q_) => fingers[p_].c - fingers[q_].c);
      const drawThumb = () => { for (const q of thumb) capL(q, outl, () => 96); for (const q of thumb) capL(q, 0, shade(0)); };
      if (th < 0.5) drawThumb();
      for (const k of order) {
        const F = fingers[k];
        for (const q of F.segs) capL(q, outl, () => 96);
        F.segs.forEach((q, j) => {
          const facing = Math.sin(Math.min(q[5], PI));               // a segment turned toward us catches more light
          capL(q, 0, shade(0.15 + facing * 0.55 - j * 0.12 - (q[5] > PI * 0.6 ? 0 : 0.2)));
          const [jx, jy] = L(q[0], q[1]);
          if (j > 0) { if (heat > 0.3) P(jx, jy, heat > 0.65 ? 105 : 103); else P(jx, jy, 68); }
        });
        // a claw on the last segment while it still points outward
        const q = F.segs[2], ph = q[5];
        if (Math.cos(ph) > 0.25) { const [ex, ey] = L(q[2], q[3]), [bx, by] = L(q[0], q[1]), aa = Math.atan2(ey - by, ex - bx); z5Kite(ex - Math.cos(aa) * s, ey - Math.sin(aa) * s, aa, 3.2 * s, 1.1 * s, 97); }
      }
      if (th >= 0.5) drawThumb();
    }
    const out = L(frontP[0], frontP[1]);
    out.palm = L(5.5, 0); out.tip = L(tipP[0], tipP[1]); out.knuckles = L(10.8, 0);
    return out;
  }
  // the old poses, now presets of the hand (pose may also be a hand object)
  const POSES = {
    fist: { curl: 1, thumb: 0.95, spread: 0 }, open: { curl: 0.06, thumb: 0.05, spread: 1 }, chop: { curl: 0, thumb: 0.75, spread: 0 },
    grab: { curl: 0.62, thumb: 0.55, spread: 0.45 }, claw: { curl: 0.42, thumb: 0.25, spread: 0.85 }, pinch: { curls: [0.42, 0.95, 0.98, 1], thumb: 0.62, spread: 0 },
    point: { curls: [0, 1, 1, 1], thumb: 0.9, spread: 0 },
  };
  const poseOf = (p) => (typeof p === 'object' && p ? p : POSES[p] || POSES.fist);
  function sGauntlet(x, y, s, a, pose, heat, t, extra) {
    const h = Object.assign({}, poseOf(pose), { heat: heat || 0 }, extra || {});
    return sHand(x, y, s, a, h, t);
  }
  // cellular seams over the obsidian (f2 - f1 small = on a seam); cheap enough per pixel
  function seamAt(px, py) {
    const ix = fl(px), iy = fl(py); let f1 = 9, f2 = 9;
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) { const gx = ix + i, gy = iy + j, cx = gx + ih(gx, gy, 971), cy = gy + ih(gx, gy, 972), d = (px - cx) * (px - cx) + (py - cy) * (py - cy); if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) f2 = d; }
    return Math.sqrt(f2) - Math.sqrt(f1);
  }
  // the shape of the body (local): a neck, shoulders like a ridge, a chest that runs down out of the frame like a mountain
  function sHW(ly) {
    if (ly < 16) return -1;
    if (ly < 30) return 17 + (ly - 16) * 0.5;
    if (ly < 46) return lerp(24, 108, Math.sqrt((ly - 30) / 16));
    if (ly < 150) return lerp(108, 66, Math.pow((ly - 46) / 104, 0.9));
    return lerp(66, 110, clamp((ly - 150) / 220, 0, 1));
  }
  function sBodyIn(lx, ly) {
    const hw = sHW(ly); if (hw < 0) return false;
    const ax = Math.abs(lx);
    if (ly < 46 && ax > 26) { const top = 30 + Math.pow(Math.max(0, ax - 26) / 82, 1.6) * 16; if (ly < top) return false; }
    return ax < hw + (vn(ly * 0.08, lx > 0 ? 1 : 0, 1, 973) - 0.5) * 8;
  }
  // the light on the body's planes: k (darker < 0 < lighter) and whether this is a groove between plates
  function sPlanes(lx, ly) {
    const ax = Math.abs(lx);
    // pectorals: two broad plates, lit along their tops, a groove under them and down the sternum
    const pu = (ax - 36) / 38, pv = (ly - 64) / 24, pr = pu * pu + pv * pv;
    if (ax < 2.2 && ly > 48 && ly < 92) return [-1.2, true];
    if (pr < 1) return [0.4 - pv * 1.1 - pu * 0.3, pr > 0.86 && pv > 0];
    // the plates of the stomach, three rows
    if (ly > 90 && ly < 150 && ax < 44) { const row = (ly - 90) / 20, f = frac(row); return [0.25 - Math.abs(f - 0.5) * 0.9 - ax / 90, false]; }
    // the flanks fall into shadow
    return [-0.6 - (ax - 40) / 90, false];
  }
  // the crown: black blades fanned behind the head
  function sCrown(cx, cy, s, t, amt, spin) {
    if (amt <= 0) return;
    for (let k = 0; k < 13; k++) {
      if (ih(k, 1, 981) > amt * 1.15) continue;
      const a = -PI + (k + 0.5) / 13 * PI + Math.sin(t * 0.6 + k) * 0.02 + (spin || 0), r0 = 26 * s, r1 = (52 + ih(k, 2, 981) * 22 - Math.abs(k - 6) * 2) * s * Math.min(1, amt * 1.3), w = (3.4 + ih(k, 3, 981) * 1.6) * s;
      const ux = Math.cos(a), uy = Math.sin(a), bx = cx + ux * r0, by = cy - 8 * s + uy * r0 * 0.9, tx = cx + ux * r1, ty = cy - 8 * s + uy * r1 * 0.9;
      const mx = lerp(bx, tx, 0.3), my = lerp(by, ty, 0.3);
      for (const [ww, c] of [[w + 1.4, 101], [w, 96]]) { z5Tri(bx, by, mx - uy * ww, my + ux * ww, tx, ty, c); z5Tri(bx, by, mx + uy * ww, my - ux * ww, tx, ty, c); }
      lineP(bx + (-uy) * w * 0.5, by + ux * w * 0.5, tx, ty, 103);
      P(tx, ty, 105); P(tx - ux, ty - uy, 104);
    }
  }
  // the mask; (mx, my) local, already turned into the mask's own frame
  // the mask's half-width at height v (-1 top .. 1 chin): a narrow crown, wide cheekbones, a heavy square jaw
  function mHW(v) {
    if (v < -0.55) { const q = (v + 0.55) / 0.45; return 0.86 * Math.sqrt(Math.max(0, 1 - q * q)); }
    if (v < 0.08) return lerp(0.86, 1.02, (v + 0.55) / 0.63);
    if (v < 0.78) return lerp(1.02, 0.8, (v - 0.08) / 0.7);
    const q = (v - 0.78) / 0.22; return 0.8 * Math.pow(Math.max(0, 1 - q * q * q * q), 0.25);
  }
  function sMaskPx(mx, my, x, y, t, o) {
    const u = mx / 19, v = my / 25, au = Math.abs(u);
    if (v < -1 || v > 1) return -1;
    const hw = mHW(v); if (au >= hw) return -1;
    const edge = au > hw - 0.07 || v < -0.97 || v > 0.97;
    // the sculpting: a V brow (low in the middle), the sockets sunk under it, a nose ridge, cheekbones, hollows, the jaw
    const browY = -0.1 - au * 0.2, sm = (a, b, x) => clamp((x - a) / (b - a), 0, 1);
    const sock = sm(browY, browY + 0.05, v) * sm(browY + 0.32 - au * 0.12, browY + 0.22 - au * 0.12, v) * sm(0.08, 0.16, au) * sm(0.84, 0.72, au), inSock = sock > 0.5;
    const nose = sm(0.1, 0.05, au) * sm(browY, browY + 0.06, v) * sm(0.4, 0.3, v);
    const cheek = sm(0.08, 0.18, v) * sm(0.34, 0.24, v) * sm(0.38, 0.5, au) * sm(0.95, 0.85, au);
    const hollow = sm(0.3, 0.38, v) * sm(0.54, 0.46, v) * sm(0.42, 0.55, au) * sm(0.92, 0.8, au);
    const brow = sm(browY - 0.1, browY - 0.04, v) * sm(browY + 0.01, browY - 0.01, v) * sm(0.02, 0.1, au);
    let nx = u * 0.9, ny = v * 0.6 - 0.15;
    let k = brow * 1.3 - sock * (3.2 - (v - browY) * 3) + nose * (u > 0.03 ? -0.6 : 1.0) + cheek * (0.9 - (au - 0.4) * 1.4) - hollow * 1.5 - (v > 0.84 ? 0.8 : 0);
    let c = edge ? 69 : bone(nx, ny, x, y, k);
    if (inSock && (v - browY) < 0.05) c = 96;
    // the eyes: burning slits slanted into a glare, sunk in shadow under the heavy brow
    const eo = o.eyes === undefined ? 1 : o.eyes;
    for (const sd of [-1, 1]) {
      const ex = mx - sd * 8.2, ey = my + 1.2, rot = sd * 0.36, rx = ex * Math.cos(rot) + ey * Math.sin(rot), ry = -ex * Math.sin(rot) + ey * Math.cos(rot);
      const hh = (0.25 + Math.min(1, eo) * 1.0) * (1 - Math.pow(Math.abs(rx) / 6.2, 2));
      if (eo > 0.02 && Math.abs(rx) < 6.2 && Math.abs(ry) < hh) c = Math.abs(ry) < hh * 0.45 ? (eo > 1.3 ? 22 : 107) : eo > 1 ? 105 : 103;
    }
    // the seam of fire, top to bottom (wider with rage), and its branches
    const sj = (vn(my * 0.35, 0, 1, 991) - 0.5) * 2.4 + Math.sin(my * 0.4) * 0.7, dsx = Math.abs(mx - sj), sw = 0.55 + (o.rage || 0) * 1.3;
    if (dsx < sw + 0.7) c = dsx < sw * 0.5 ? 107 : dsx < sw ? 105 : 103;
    for (const [by0, dir, len] of [[-12, -1, 7], [6, 1, 6], [16, -1, 5]]) { const along = (my - by0) * 0.0 + (mx - sj) * dir; if (along > 0 && along < len && Math.abs(my - by0 - along * 0.55) < 0.5 + 0.3 * (o.rage || 0)) c = 104; }
    // the mouth: a jagged crack across the jaw; roar tears it open on molten dark and porcelain teeth
    const ry0 = 15.5 + (vn(mx * 0.5, 3, 1, 992) - 0.5) * 1.6 + Math.abs(mx) * 0.06, roar = o.roar || 0, mw = 12.5 + roar * 2;
    if (Math.abs(mx) < mw) {
      const h = roar * 10 * (1 - Math.pow(Math.abs(mx) / mw, 2.2));
      if (my > ry0 - 0.55 && my < ry0 + 0.55 + h) {
        if (h > 1.2 && my > ry0 + 0.5 && my < ry0 + h - 0.5) {
          const tw = Math.abs(frac(mx / 2.6) - 0.5) * 2, top = my - ry0, bot = ry0 + h - my;
          c = tw < 1 - top / 2.4 || tw < 1 - bot / 2.4 ? bone(0, -0.3, x, y, 1) : (my - ry0) / h < 0.5 ? 101 : bay(x, y) < 0.5 ? 102 : 103;
        } else c = 96;
      }
    }
    // the third eye: his brother's, taken into his brow — a slit of void with a spiral turning in it
    if (o.third > 0) {
      const dx = mx, dy = my + 16.5, inn = (dx * dx) / (3.4 * o.third) ** 2 + (dy * dy) / (6.4 ** 2);
      if (inn < 1) { const r = Math.sqrt(dx * dx + dy * dy), f = frac(Math.atan2(dy, dx) / TAU * 3 - r * 0.5 + t * 1.3); c = inn > 0.75 ? 73 : r < 1.2 ? 22 : f < 0.45 ? 76 : f < 0.7 ? 72 : 75; }
      else if (inn < 1.4) c = 77;
    }
    // cuts in the mask (the hero's): glowing lines
    for (const C of o.maskCuts || []) { const [ax, ay, bx, by, amt] = C, ddx = bx - ax, ddy = by - ay, L2 = ddx * ddx + ddy * ddy, q = clamp(((mx - ax) * ddx + (my - ay) * ddy) / L2, 0, amt), qx = ax + ddx * q, qy = ay + ddy * q, d = Math.hypot(mx - qx, my - qy); if (d < 1.4) c = d < 0.6 ? 22 : 105; else if (d < 2.1) c = 96; }
    return c;
  }
  /* sunderer(cx, cy, s, t, o): the whole of him, mask centred at (cx, cy). o:
       eyes 0..2, rage 0..1 (the seams widen), roar 0..1, third 0..1 (his brother's eye in his brow), heat 0..1 (how hot the
       seams burn), crown 0..1, glow, tilt, nod, still, shake,
       arms: up to four { x, y (the wrist, local), pose, front (drawn over the mask), cut (severed at the elbow), heat, fs (fist size) }, in
         the order upper-left, upper-right, lower-left, lower-right; null leaves an arm out,
       wounds: [[x0, y0, x1, y1, width]] glowing cuts in the body (local); maskCuts: [[x0, y0, x1, y1, amt]] (mask frame),
       split: 0..1 the final cut: he comes apart along splitA (angle) through (splitX, splitY) local, the halves sliding apart,
       dark: 0..1 silhouette (only the fire shows), body: false to skip the body, core 0..1 the molten heart in the chest.
     Returns { hands: screen points of the four fists, eyes: [[x, y], [x, y]], core: [x, y], brow: [x, y] }. */
  /* his body has physics too (like the hero's life()): per draw, per arm, a little state — the elbow trails the hand, the
     shoulder heaves toward a reach, the whole upper body leans into a blow and rocks back, the hand turns a beat after the
     forearm and shudders when a blow stops dead, the fingers close and open over a few frames instead of snapping */
  const SLIFE = { n: 0, s: [] };
  function sSpring(o, key, target, k, z, dt) { let x = o[key], v = o[key + 'v'] || 0; const c = 2 * z * Math.sqrt(k), n = Math.ceil(dt * 240), h = dt / n; for (let i = 0; i < n; i++) { v += (k * (target - x) - c * v) * h; x += v * h; } o[key] = x; o[key + 'v'] = v; return x; }
  function sLifeOf(s, still) {
    if (LIFE.n === 0 && SLIFE.t !== LIFE.t) { SLIFE.n = 0; SLIFE.t = LIFE.t; }
    const slot = SLIFE.n++, dt = LIFE.dt;
    let st = SLIFE.s[slot];
    if (!st || dt < 0 || still) st = SLIFE.s[slot] = { lean: 0, leanv: 0, arms: [0, 1, 2, 3].map(() => null), fresh: true };
    st.dt = dt; return st;
  }
  function sunderer(cx, cy, s, t, o) {
    o = o || {};
    const ST = sLifeOf(s, o.still), dt = ST.dt;
    // the lean: the upper body pushed by the arms' motion (local units), springing back
    let push = 0;
    (o.arms || []).forEach((A, k) => { const a = ST.arms[k]; if (A && a && !a.fresh && dt > 0) push += (a.vx || 0) * 0.0045 + (a.vy || 0) * 0.0015 * (k % 2 ? 1 : -1); });
    const leanT = clamp(push, -16, 16) + (o.lean || 0);
    const lean = dt > 0 ? sSpring(ST, 'lean', leanT, 70, 0.55, dt) : ST.lean;
    const live = o.still ? 0 : 1;
    cy += Math.sin(t * 0.9) * 1.0 * s * live;
    const sh = o.shake ? z5Sh(t, 7) * o.shake : 0, heat = o.heat === undefined ? 0.5 : o.heat, dark = o.dark || 0;
    const mcx = cx + (Math.sin(t * 0.6) * 0.6 * s) * live + sh + lean * s * 0.95, mcy = cy + (Math.sin(t * 0.9 - 0.8) * 0.5 * s + (o.nod || 0) * s) * live;
    const tilt = (Math.sin(t * 0.47) * 0.035) * live + (o.tilt || 0), cT = Math.cos(tilt), sT = Math.sin(tilt);
    // the split: which side of the cut a local point is on, and how far that side has slid
    const spl = o.split || 0, sa = o.splitA === undefined ? 1.2 : o.splitA, sux = Math.cos(sa), suy = Math.sin(sa), spx = o.splitX || 0, spy = o.splitY || 0;
    const side = (lx, ly) => ((lx - spx) * -suy + (ly - spy) * sux) > 0 ? 1 : -1;
    const slide = (sd) => [-suy * sd * spl * 40 + sux * sd * spl * 10, sux * sd * spl * 40 + suy * sd * spl * 10 + spl * spl * 30];
    // local → screen (with the split applied)
    const LS = (lx, ly) => { let X = lx, Y = ly; if (spl > 0) { const [ox, oy] = slide(side(lx, ly)); X += ox; Y += oy; } return [cx + X * s + sh, cy + Y * s]; };
    // screen → local, finding which side's pixels land here
    const SL = (x, y) => {
      let lx = (x + 0.5 - cx - sh) / s, ly = (y + 0.5 - cy) / s;
      if (spl > 0) { for (const sd of [1, -1]) { const [ox, oy] = slide(sd), qx = lx - ox, qy = ly - oy; if (side(qx, qy) === sd) return [qx, qy, sd]; } return null; }
      return [lx, ly, 0];
    };
    const out = { hands: [], eyes: [], core: LS(lean * 0.75, 70), brow: [mcx, mcy - 16 * s], lean };
    // the crown, behind everything
    if (o.crown !== 0) sCrown(mcx, mcy, s, t, o.crown === undefined ? 1 : o.crown, o.crownSpin);
    const glowA = o.glow === undefined ? 0.35 : o.glow;
    glow(cx, cy + 40 * s, 140 * s, T_EMBER, 0.12 * heat * glowA * 2 * (1 - dark));
    // the body
    if (o.body !== false) {
      const x0 = Math.max(0, fl(cx - 112 * s - 60)), x1 = Math.min(W - 1, Math.ceil(cx + 112 * s + 60)), y0 = Math.max(0, fl(cy + 14 * s - 40)), y1 = H - 1;
      const pulse = 0.5 + 0.5 * Math.sin(t * 2.2);
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const q = SL(x, y); if (!q) continue; const ly = q[1], lx = q[0] - lean * Math.max(0, 1 - (ly - 16) / 220);
        if (!sBodyIn(lx, ly)) continue;
        const rim = !sBodyIn(lx + 2.2, ly) || !sBodyIn(lx - 2.2, ly) || !sBodyIn(lx, ly - 2.2);
        if (rim) { BUF[y * W + x] = heat > 0.2 ? (lx < 0 ? 102 : 101) : 98; continue; }
        // the stone has relief: a height field (the planes of muscle, then rock grain) lit from the upper left, glossy where
        // it faces the light; fire collects in the grooves and in veins that branch out from the heart
        const [pk, groove] = sPlanes(lx, ly);
        const hg = (X, Y) => sPlanes(X, Y)[0] * 3.0 + vn(X, Y, 9, 1201) * 2.4 + vn(X, Y, 3.2, 1202) * 0.8;
        const gx = hg(lx + 0.8, ly) - hg(lx - 0.8, ly), gy = hg(lx, ly + 0.8) - hg(lx, ly - 0.8);
        const lit = 0.42 - lx / 320 + pk * 0.25 + (-gx * 0.55 - gy * 0.8) * 0.42;
        let c = lit > 0.86 ? (bay(x, y) < 0.5 ? 122 : 100) : OBS[clamp(fl(lit * 3.4 + (bay(x, y) - 0.5) * 0.8), 0, 4)];
        const dh = Math.hypot(lx, (ly - 70) * 1.2), vh = Math.min(1, heat * 1.3 * Math.max(0, 1 - dh / 125));
        if (groove) c = vh > 0.62 ? (vh > 0.8 ? 104 : 103) : vh > 0.4 ? 101 : 96;
        else { const sd_ = seamAt(lx / 30 + 3, ly / 28), wv = vh > 0.25 ? 0.006 + (vh - 0.25) * (vh - 0.25) * 0.16 : 0.004; if (sd_ < wv) c = sd_ < wv * 0.4 && vh > 0.3 ? (vh > 0.55 ? (pulse > 0.5 ? 106 : 105) : 104) : vh > 0.15 ? 103 : 101; }
        // the fire's light on the stone round the heart
        if (c < 101 && vh > 0.35 && bay(x, y) < (vh - 0.35) * 0.9) c = c === 96 ? 101 : 102;
        // porcelain plates over the shoulders: two layers, with a fin of black blade rising from each
        for (const sd of [-1, 1]) { const px = (lx - sd * 84) / 36, py = (ly - 40) / 22, pr2 = px * px + py * py; if (pr2 < 1 && ly < 56) { c = pr2 > 0.84 ? 69 : bone(px * 0.9, py - 0.5, x, y, -0.2); if (Math.abs(py - 0.15 - px * px * 0.3) < 0.08) c = 96; if (Math.abs(py + 0.35 - px * px * 0.25) < 0.05) c = 68; } }
        // the molten heart
        const hx = lx, hy = ly - 70, hr = Math.sqrt(hx * hx + hy * hy), core = o.core === undefined ? 1 : o.core;
        if (core > 0 && hr < 15) c = hr < 13 ? (hr < 6 * core ? (hr < 3 * core ? 22 : 107) : hr < 10 ? (Math.abs(Math.sin(Math.atan2(hy, hx) * 4 + t)) < 0.25 ? 105 : 103) : 102) : 96;
        for (const W_ of o.wounds || []) { const [ax0, ay0, ax1, ay1, ww] = W_, ddx = ax1 - ax0, ddy = ay1 - ay0, L2 = ddx * ddx + ddy * ddy || 1, u = clamp(((lx - ax0) * ddx + (ly - ay0) * ddy) / L2, 0, 1), d = Math.hypot(lx - ax0 - ddx * u, ly - ay0 - ddy * u); if (d < (ww || 3)) c = d < (ww || 3) * 0.45 ? 22 : 105; else if (d < (ww || 3) + 1.5) c = 101; }
        if (dark > 0 && c !== 22 && c < 103 && bay(x, y) < dark) c = 96;
        BUF[y * W + x] = c;
      }
      if (heat > 0) glow(out.core[0], out.core[1], 40 * s, T_EMBER, 0.35 * heat * (o.core === undefined ? 1 : o.core));
    }
    // the arms (behind the mask unless 'front')
    const drawArm = (k, A) => {
      if (!A) return;
      const sd = SH4[k][0] < 0 ? -1 : 1, up = k < 2, AS = ST.arms[k] || (ST.arms[k] = { fresh: true });
      // the wrist where the shot wants it (exact: contacts land on their frames)
      const [wx, wy] = LS(A.x, A.y);
      // its motion, measured frame to frame
      if (!AS.fresh && dt > 0) { const ivx = (wx - AS.px) / dt, ivy = (wy - AS.py) / dt; AS.pvx = AS.vx || 0; AS.pvy = AS.vy || 0; AS.vx = lerp(AS.pvx, ivx, 0.6); AS.vy = lerp(AS.pvy, ivy, 0.6); }
      else if (AS.fresh) { AS.vx = 0; AS.vy = 0; AS.pvx = 0; AS.pvy = 0; AS.ex = 0; AS.ey = 0; AS.hx = 0; AS.hy = 0; AS.ha = null; AS.shud = 0; }
      const sp = Math.hypot(AS.vx, AS.vy), psp = Math.hypot(AS.pvx || 0, AS.pvy || 0);
      // a blow that stops dead: the hand shudders
      if (dt > 0 && psp > 520 && sp < psp * 0.35) AS.shud = 1;
      AS.shud = (AS.shud || 0) * (dt > 0 ? Math.exp(-dt * 9) : 1);
      // the shoulder heaves toward the reach (local units)
      const rlx = A.x - SH4[k][0], rly = A.y - SH4[k][1], rl = Math.hypot(rlx, rly) || 1, ext = clamp(rl / 170, 0, 1.2);
      const hxT = rlx / rl * 8 * ext + (A.y < SH4[k][1] - 40 ? 0 : 0), hyT = rly / rl * 6 * ext - (A.y < SH4[k][1] - 30 ? 5 : 0);
      if (dt > 0) { sSpring(AS, 'hx', hxT, 140, 0.5, dt); sSpring(AS, 'hy', hyT, 140, 0.5, dt); } else if (AS.fresh) { AS.hx = hxT; AS.hy = hyT; }
      const [ax, ay] = LS(SH4[k][0] + AS.hx + lean * (up ? 0.85 : 0.6), SH4[k][1] + AS.hy);
      // the elbow: bowed outward and down, and trailing the hand's motion
      const mx = (ax + wx) / 2, my = (ay + wy) / 2, dx = wx - ax, dy = wy - ay, L = Math.hypot(dx, dy) || 1, bend = Math.max(0, 152 * s - L) * 0.45;
      if (dt > 0) { sSpring(AS, 'ex', clamp(-AS.vx * 0.03, -24 * s, 24 * s), 160, 0.42, dt); sSpring(AS, 'ey', clamp(-AS.vy * 0.03, -24 * s, 24 * s) + 3 * s, 160, 0.42, dt); }
      const ex = mx + (-dy / L) * bend * -sd * (up ? 1 : 0.8) + (AS.ex || 0), ey = my + (dx / L) * bend * -sd * (up ? 1 : 0.8) + bend * 0.3 + (AS.ey || 0);
      const aHeat = A.heat === undefined ? heat : A.heat;
      // the shoulder joint: a ball of black stone ringed with fire
      discF(ax, ay, 15 * s, 96); limbF(ax - 2, ay - 2, ax + 2, ay + 2, () => 13.5 * s, 14 * s, (u, sdn, lit, X, Y, e) => e > 0.86 ? (aHeat > 0.3 ? 102 : 96) : obsLit(lit, X, Y, e, aHeat));
      // the upper arm: a muscle that swells in the middle and tapers to the elbow
      const rU = (u) => s * (17 + 5 * Math.sin(PI * Math.min(1, u * 1.25)) - u * 4);
      limbF(ax, ay, ex, ey, rU, 22 * s, (u, sdn, lit, X, Y, e) => { const vein = Math.abs(sdn - 0.35 * Math.sin(u * 9 + k)) < 0.06 && u > 0.12 && u < 0.86; return vein && aHeat > 0.25 ? (aHeat > 0.6 ? 104 : 103) : obsLit(lit, X, Y, e, aHeat); });
      if (A.cut) {
        // severed at the elbow: a stump that burns and drips
        discF(ex, ey, 12 * s, 101); discF(ex, ey, 10 * s, 103); discF(ex, ey, 7 * s, 105); discF(ex, ey, 3.5 * s, 22);
        for (let q = 0; q < 5; q++) { const g = frac(t * 0.9 + ih(k, q, 995)), dx2 = (ih(k, q, 996) - 0.5) * 12 * s; rectF(ex + dx2, ey + 6 * s + g * 70 * s, Math.max(1, s * 1.5), Math.max(2, s * 3), g < 0.5 ? 105 : 103); }
        glow(ex, ey, 30 * s, T_EMBER, 0.6);
        out.hands[k] = [ex, ey]; return;
      }
      // the forearm: black stone under a porcelain vambrace of three plates, fire showing in the gaps
      const rF = (u) => s * (12.5 + u * 2.5);
      limbF(ex, ey, wx, wy, rF, 16 * s, (u, sdn, lit, X, Y, e) => {
        if (u < 0.28) return obsLit(lit, X, Y, e, aHeat);
        const pf = (u - 0.28) / 0.72 * 3, gap = frac(pf) < 0.07 && u < 0.98;
        if (gap) return aHeat > 0.25 ? (aHeat > 0.6 ? 104 : 102) : 96;
        if (e > 0.9) return 69;
        if (Math.abs(sdn + 0.15) < 0.05 && frac(pf) > 0.25 && frac(pf) < 0.8) return 67;              // an engraved line
        return BONE4[clamp(fl(2.6 + lit * 2.4 + (bay(X, Y) - 0.5) * 0.9 - (frac(pf) < 0.18 ? 0.8 : 0)), 0, 5)];
      });
      // the elbow cop: a porcelain plate over the joint, fire round its edge
      discF(ex, ey, 11 * s, aHeat > 0.3 ? 102 : 96); limbF(ex - 1, ey - 1, ex + 1, ey + 1, () => 9.5 * s, 10 * s, (u, sdn, lit, X, Y, e) => e > 0.86 ? 69 : BONE4[clamp(fl(2.4 + lit * 2.4 + (bay(X, Y) - 0.5) * 0.9), 0, 5)]);
      discF(wx, wy, 13 * s, aHeat > 0.3 ? 103 : 96);
      // the hand: it turns a beat after the forearm (and shudders when a blow stops)
      const fa = Math.atan2(wy - ey, wx - ex), aT = A.ang === undefined ? fa : A.ang;
      if (AS.ha === null || AS.ha === undefined || AS.fresh) { AS.ha = aT; AS.hav = 0; }
      else if (dt > 0) { let tg = aT; while (tg - AS.ha > PI) tg -= TAU; while (tg - AS.ha < -PI) tg += TAU; sSpring(AS, 'ha', tg, 420, 0.45, dt); }
      const shk_ = AS.shud * 0.18 * Math.sin(t * 70);
      // the fingers close and open over a few frames
      const P_ = poseOf(A.pose || 'fist'), tc = P_.curls || [0, 1, 2, 3].map(() => P_.curl);
      if (!AS.c || AS.fresh) { AS.c = tc.map((c) => ({ v: c, vv: 0 })); AS.th = { v: P_.thumb, vv: 0 }; AS.spd = { v: P_.spread, vv: 0 }; }
      else if (dt > 0) { AS.c.forEach((c, i) => sSpring(c, 'v', tc[i], 520, 0.7, dt)); sSpring(AS.th, 'v', P_.thumb, 520, 0.7, dt); sSpring(AS.spd, 'v', P_.spread, 400, 0.7, dt); }
      out.hands[k] = sHand(wx, wy, s * (A.fs || 1), AS.ha + shk_, { curls: AS.c.map((c) => clamp(c.v, 0, 1)), thumb: clamp(AS.th.v, 0, 1), spread: clamp(AS.spd.v, 0, 1), side: up ? sd : -sd, heat: aHeat, hold: A.hold, layer: A.layer }, t);
      out.hands[k].shudder = AS.shud;
      AS.px = wx; AS.py = wy; AS.fresh = false;
    };
    const arms = o.arms || [];
    for (let k = 0; k < 4; k++) if (arms[k] && !arms[k].front) drawArm(k, arms[k]);
    // the mask
    if (o.mask !== false) {
      const R = 30 * s, x0 = Math.max(0, fl(mcx - R)), x1 = Math.min(W - 1, Math.ceil(mcx + R)), y0 = Math.max(0, fl(mcy - R)), y1 = Math.min(H - 1, Math.ceil(mcy + R));
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        let qx = (x + 0.5 - mcx) / s, qy = (y + 0.5 - mcy) / s;
        if (spl > 0) { let hit = null; for (const sd of [1, -1]) { const [ox, oy] = slide(sd), ax = qx - ox, ay = qy - oy; if (side(ax, ay) === sd) { hit = [ax, ay]; break; } } if (!hit) continue; qx = hit[0]; qy = hit[1]; }
        const mx = qx * cT + qy * sT, my = -qx * sT + qy * cT;
        let c = sMaskPx(mx, my, x, y, t, o); if (c < 0) continue;
        if (dark > 0 && c < 103 && c !== 22 && c !== 107 && bay(x, y) < dark) c = 96;
        BUF[y * W + x] = c;
      }
      for (const sd of [-1, 1]) out.eyes.push([mcx + (sd * 8.2 * cT - (-1.2) * sT) * s, mcy + (sd * 8.2 * sT + (-1.2) * cT) * s]);
      const eo = o.eyes === undefined ? 1 : o.eyes;
      if (eo > 0.3) for (const [ex, ey] of out.eyes) glow(ex, ey, 9 * s * Math.min(1.6, eo), T_EMBER, 0.3 * Math.min(1.5, eo));
      if (o.third > 0.3) glow(out.brow[0], out.brow[1] - 0.5 * s, 14 * s, T_MAG, 0.4 * o.third);
    }
    for (let k = 0; k < 4; k++) if (arms[k] && arms[k].front) drawArm(k, arms[k]);
    // the split: light pouring out of the cut
    if (spl > 0) { const [ax, ay] = LS(spx - sux * 200, spy - suy * 200), [bx, by] = LS(spx + sux * 200, spy + suy * 200); glow((ax + bx) / 2, (ay + by) / 2, 160 * s, T_WH, 0.4 * Math.min(1, spl * 3)); }
    return out;
  }
