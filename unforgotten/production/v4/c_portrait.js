  /* ================================================================ portraits: busts for close-ups */
  // A close-up never magnifies the small sprite: it uses a bust drawn at four times the face detail, built from
  // hand-placed shapes in sprite space (1 px = 1 sprite pixel), banded like hand shading, outlined like the sprites.
  // Coordinates: origin at the bottom centre of the bust, y up is negative, facing right.
  const band = (ramp, v) => ramp * 8 + clamp(Math.round(v), 0, 7);
  function sEll(cx, cy, rx, ry, fn, kind) {
    for (let y = fl(cy - ry) - 1; y <= cy + ry + 1; y++) for (let x = fl(cx - rx) - 1; x <= cx + rx + 1; x++) {
      const u = (x + 0.5 - cx) / rx, v = (y + 0.5 - cy) / ry; if (u * u + v * v > 1) continue;
      const c = typeof fn === 'number' ? fn : fn(x, y, u, v); if (c >= 0) sp(x, y, c, kind);
    }
  }
  function sPoly(pts, fn, kind) {
    let y0 = 1e9, y1 = -1e9; for (const p of pts) { y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
    for (let y = fl(y0); y <= Math.ceil(y1); y++) {
      const xs = [], yy = y + 0.5;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const a = pts[i], b = pts[j]; if ((a[1] > yy) !== (b[1] > yy)) xs.push(a[0] + (yy - a[1]) * (b[0] - a[0]) / (b[1] - a[1])); }
      xs.sort((a, b) => a - b);
      for (let q = 0; q + 1 < xs.length; q += 2) for (let x = Math.round(xs[q]); x < Math.round(xs[q + 1]); x++) { const c = typeof fn === 'number' ? fn : fn(x, y); if (c >= 0) sp(x, y, c, kind); }
    }
  }
  // a lock of hair as a tapering curve: from root (x0,y0) with a bend; w0 root half-width
  function sLock(x0, y0, x1, y1, bend, w0, ramp, base, hiK) {
    const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 1.6) + 2, nx = -(y1 - y0), ny = x1 - x0, nl = Math.hypot(nx, ny) || 1;
    for (let i = 0; i <= n; i++) {
      const u = i / n, b = Math.sin(u * PI) * bend, cx = lerp(x0, x1, u) + nx / nl * b, cy = lerp(y0, y1, u) + ny / nl * b, w = Math.max(0.35, w0 * (1 - u * 0.9));
      for (let q = -w; q <= w; q += 0.5) { const side = q / w, lit = side * (nx / nl * LIGHTS.x + ny / nl * LIGHTS.y); sp(cx + nx / nl * q, cy + ny / nl * q, band(ramp, base + (lit > 0.3 ? 1 : lit < -0.4 ? -1 : 0) + (hiK && Math.abs(u - 0.3) < 0.12 && side > -0.2 ? 2 : 0))); }
    }
  }
  const litOf = (u, v) => u * LIGHTS.x + v * LIGHTS.y;

  /* ---- shared portrait features: eyes, brows, mouths, at close-up size */
  // eyes: rows of an eye, x from its left; I iris, i iris dark, P pupil, o highlight, w white, k lash/lid, l lower lid, s skin
  const PEYE = {
    open: ['.kkkkkk.', 'kkiiPPkk', 'kwiPPoPw', '.wiPPPiw', '.wIIIIiw', '..lllll.'],
    wide: ['..kkkk..', '.kkkkkkk', 'kwiPPoPw', 'kwiPPPiw', 'kwIPPPiw', '.wIIIIiw', '..lllll.'],
    half: ['........', '........', 'kkkkkkkk', 'kwiPPPkk', '.wIIIIiw', '..lllll.'],
    narrow: ['........', '........', '.kkkkkk.', 'kkiPPPkk', '.wIIIiw.', '..llll..'],
    closed: ['........', '........', '........', '.kkkkkk.', '..k..k..', '........'],
    happy: ['........', '........', '..kkkk..', '.k....k.', 'k......k', '........'],
    sad: ['....kkk.', '..kkkkkk', 'kwiPPoPw', '.wiPPPiw', '.wIIIIiw', '..lllll.'],
    shut: ['........', '........', 'kkk..kkk', '..kkkk..', '.k.kk.k.', '........'],
  };
  const PBROW = { n: [[0, 0], [1, -1], [2, -1], [3, -1], [4, -1], [5, 0], [6, 0]], up: [[0, -1], [1, -2], [2, -2], [3, -2], [4, -2], [5, -1], [6, -1]], angry: [[0, -2], [1, -2], [2, -1], [3, -1], [4, 0], [5, 0], [6, 1]], worried: [[0, 1], [1, 0], [2, -1], [3, -1], [4, -2], [5, -2], [6, -2]] };
  // mouths: m dark mouth, t tongue, w teeth, n lip line
  const PMOUTH = {
    closed: ['nnnnn'], smile: ['n...n', '.nnn.'], grin: ['nwwwwwn', '.nmmmn.'], frown: ['.nnn.', 'n...n'],
    o1: ['.nnn.', 'nmmmn', '.nnn.'], o2: ['.nnnn.', 'nwwwwn', 'nmmmmn', '.nttn.'], o3: ['.nnnnn.', 'nwwwwwn', 'nmmmmmn', 'nmtttmn', '.nnnnn.'],
    scream: ['..nnnnn..', '.nwwwwwn.', 'nmmmmmmmn', 'nmmmmmmmn', 'nmmtttmmn', '.nmmmmmn.', '..nnnnn..'],
  };
  function pFace(P, F, x0, y0, ex1, ex2, mx, my, skinRamp, iris) {
    // F: eyes, brows, mouth (0..1 voice), smile, blush, tear; (ex1, ex2): near/far eye left edges; y0 eye top
    const E = PEYE[F.eyes || 'open'] || PEYE.open, key = { k: C('ink', 0), w: C('snow', 7), I: C(iris, 5), i: C(iris, 3), P: C('ink', 1), o: C('snow', 7), l: C(skinRamp, 4) };
    const look = Math.round(F.look || 0);
    [ex1, ex2].forEach((ex, side) => {
      E.forEach((row, j) => { for (let i = 0; i < row.length; i++) { const ch = row[i]; if (ch === '.') continue; if (side === 1 && (i === 0 || i === row.length - 1) && ch !== 'k') continue; let c = key[ch]; if ((ch === 'P' || ch === 'o' || ch === 'i') && look) { /* the pupil shifts by redrawing below */ } sp(x0 + ex + i, y0 + j, c, ch === 'o' ? 3 : 1); } });
      if (look && E !== PEYE.closed && E !== PEYE.happy && E !== PEYE.shut) for (let j = 1; j < E.length - 1; j++) for (let i = 1; i < 7; i++) { const ch = E[j][clamp(i - look, 0, 7)]; if (ch === 'P' || ch === 'i' || ch === 'I' || ch === 'o') sp(x0 + ex + i, y0 + j, key[ch], ch === 'o' ? 3 : 1); }
      // brows
      const B = PBROW[F.brows || 'n'] || PBROW.n;
      for (const [bx, by] of B) { if (side === 1 && bx === 6) continue; sp(x0 + ex + bx, y0 - 2 + by - (F.eyes === 'wide' ? 1 : 0), C('hair', 1)); sp(x0 + ex + bx, y0 - 3 + by - (F.eyes === 'wide' ? 1 : 0), C('hair', 2)); }
    });
    if (F.tear) { const ty = y0 + 6 + fl(frac((P.t || 0) * 0.6) * 8); sp(x0 + ex1 + 1, ty, C('sky', 6), 3); sp(x0 + ex1 + 1, ty + 1, C('sky', 5), 3); sp(x0 + ex1 + 1, y0 + 5, C('sky', 7), 3); }
    if (F.blush) for (const ex of [ex1, ex2]) for (let i = 1; i < 5; i++) if ((i + (ex & 1)) % 2 === 0 || F.blush > 0.7) sp(x0 + ex + i, y0 + 7, C('rose', 4));
    if (F.mask) {
      // the mask: a white porcelain plate from brow to lip, two slits, a crack that runs from the near slit to the jaw
      const mx0 = x0 + ex1 - 2, mx1 = x0 + ex2 + 9, my0 = y0 - 5, my1 = my + 1;
      for (let yy = my0; yy <= my1; yy++) for (let xx = mx0; xx <= mx1; xx++) {
        const edge = (yy - my0) < 1 || xx === mx0 || xx === mx1, cornerCut = (yy > my1 - 3 && (xx < mx0 + (yy - (my1 - 3)) * 2 || xx > mx1 - (yy - (my1 - 3)) * 2));
        if (cornerCut) continue;
        const slit = yy >= y0 + 2 && yy <= y0 + 3 && ((xx >= x0 + ex1 + 1 && xx <= x0 + ex1 + 6) || (xx >= x0 + ex2 + 1 && xx <= x0 + ex2 + 5));
        const cr = Math.abs(xx - (x0 + ex1 + 3) - (yy - y0 - 4) * 0.35) < 0.6 && yy > y0 + 3, cr2 = Math.abs(xx - (x0 + ex1 + 1) + (yy - y0 - 8) * 0.5) < 0.5 && yy > y0 + 7 && yy < y0 + 11;
        sp(xx, yy, slit ? (F.mask > 1 ? (yy === y0 + 2 ? C('fire', 6) : C('ember', 5)) : C('ink', 0)) : cr || cr2 ? C('ink', 1) : edge ? C('hush', 3) : C('snow', litOf((xx - mx0) / (mx1 - mx0) - 0.5, 0) > 0.1 ? 7 : 6), slit && F.mask > 1 ? 3 : 1);
      }
      return;
    }
    const m = F.mouth || 0, sm = F.smile || 0;
    const M = F.scream ? PMOUTH.scream : m > 0.72 ? PMOUTH.o3 : m > 0.42 ? PMOUTH.o2 : m > 0.14 ? PMOUTH.o1 : sm > 0.6 ? PMOUTH.grin : sm > 0.25 ? PMOUTH.smile : sm < -0.3 ? PMOUTH.frown : PMOUTH.closed;
    const mk = { n: C(skinRamp, 1), m: C('crimson', 1), t: C('crimson', 4), w: C('snow', 6) };
    M.forEach((row, j) => { for (let i = 0; i < row.length; i++) if (row[i] !== '.') sp(mx - fl(row.length / 2) + i, my + j - (M.length > 2 ? 1 : 0), mk[row[i]]); });
  }

  /* ---- Sable's bust */
  // hair is built from solid masses (a crown, a back curtain, a high ponytail, pointed bangs, two face-framing locks),
  // each with a darker strand line or two and a lit band where the light catches it
  function hairMass(pts, base, hi, strands) {
    let cx = 0, cy = 0; for (const p of pts) { cx += p[0] / pts.length; cy += p[1] / pts.length; }
    sPoly(pts, (x, y) => { const l = (x - cx) * LIGHTS.x * 0.18 + (y - cy) * LIGHTS.y * 0.18; let v = base + (l > 0.5 ? 1 : l < -0.6 ? -1 : 0); if (strands && strands(x, y)) v -= 1; if (hi && hi(x, y)) v += 2; return band(R.hair, v); });
  }
  function sableBust(P, t) {
    const F = P.face || {}, wind = P.wind || 0, sw = Math.sin(t * 1.9) * (0.7 + wind * 0.6), hy = (P.headY || 0), hx = (P.headX || 0), breathe = Math.sin(t * 2.2) > 0.4 ? -1 : 0;
    const HX = 4 + hx, HY = -43 + hy + breathe, s1 = Math.round(sw);
    // the ponytail: tied high at the back with a red cord, a thick tail falling and swaying behind
    hairMass([[HX - 10, HY - 16], [HX - 15, HY - 18], [HX - 22 + s1, HY - 10], [HX - 27 + s1 * 2 - wind * 3, HY + 6], [HX - 25 + s1 * 2 - wind * 3, HY + 22], [HX - 21 + s1, HY + 10], [HX - 16, HY - 6]], 1.6, (x, y) => Math.abs((x - (HX - 18)) + (y - HY) * 0.25) < 1 && y < HY + 6, (x, y) => Math.abs((x - (HX - 22)) + (y - HY) * 0.15 - s1) < 0.6);
    sEll(HX - 12, HY - 15, 3.2, 3.6, (x, y, u, v) => band(R.crimson, 4 + (litOf(u, v) > 0.2 ? 1 : litOf(u, v) < -0.3 ? -1 : 0)));
    sLock(HX - 13, HY - 13, HX - 18 + s1, HY - 4, 1, 0.8, R.crimson, 4, false);
    // the back curtain of hair behind the head, falling to the shoulders
    hairMass([[HX - 14, HY - 8], [HX - 4, HY - 15], [HX + 8, HY - 12], [HX + 13, HY], [HX + 12, HY + 15], [HX - 2, HY + 18], [HX - 16, HY + 17], [HX - 17, HY + 4]], 1.4, null, (x, y) => Math.abs(x - (HX - 9) + (y - HY) * 0.1) < 0.5 && y > HY);
    // shoulders: a sloped charcoal coat with a white crossed collar and a crimson cord at the throat
    sPoly([[-21, 0], [-20, -10], [-14, -18], [-4, -21], [11, -21], [19, -18], [24, -10], [25, 0]], (x, y) => { const u = x / 22, v = (y + 10) / 10, l = litOf(u, v); return band(R.ink, 3 + (l > 0.3 ? 1 : l < -0.35 ? -1 : 0) + (Math.abs(x - 3.5) < 0.6 && y > -12 ? -1.4 : 0) + (Math.abs(x + 12 - (y + 18) * 0.2) < 0.6 ? -1 : 0)); });
    sPoly([[-4, -21], [0, -21], [6, -9], [3, -8]], (x, y) => band(R.linen, 6 - (x < -1 ? 1 : 0)));
    sPoly([[12, -21], [8, -21], [3, -8], [6, -8]], (x, y) => band(R.linen, 5 - (x > 9 ? 1 : 0)));
    // neck, shadowed under the jaw
    sPoly([[HX - 5, HY + 9], [HX + 6, HY + 9], [HX + 5, -20], [HX - 5, -20]], (x, y) => band(R.tan, y < HY + 15 ? 3 : 4));
    // the face: an oval whose jaw narrows to a chin turned a little to her right (three-quarter view)
    sEll(HX, HY, 12.5, 14.5, (x, y, u, v) => {
      if (v > 0.05) { const uu = u - 0.18 * (v - 0.05), half = 1 - Math.pow((v - 0.05) / 0.95, 1.6) * 0.62; if (Math.abs(uu) > half) return -1; }
      const l = litOf(u, v * 0.8); let s = 5 + (l > 0.4 ? 1 : l < -0.45 ? -1 : 0);
      if (v > 0.74) s -= 1; if (v < -0.35) s -= 0.6;                // under the bangs, a little shade
      return band(R.tan, s);
    });
    sEll(HX - 11, HY + 2, 2.2, 3.4, (x, y, u, v) => band(R.tan, 4 + (u < 0 ? -1 : 0)));
    pFace(P, F, 0, HY - 1, HX - 9, HX + 2, HX + 3, HY + 9, R.tan, R.ember);
    sp(HX + 5, HY + 5, C('tan', 3)); sp(HX + 5, HY + 6, C('tan', 3)); sp(HX + 4, HY + 6, C('tan', 4));
    // the crown, a band of light across it
    sEll(HX - 1, HY - 8, 14, 9.5, (x, y, u, v) => (v > 0.25 ? -1 : band(R.hair, 2 + (Math.abs(Math.hypot(u + 0.2, v + 0.1) - 0.78) < 0.09 && v < 0.05 && u > -0.75 ? 2.5 : 0) + (litOf(u, v) > 0.5 ? 1 : litOf(u, v) < -0.5 ? -1 : 0))));
    // bangs: four pointed clusters swept toward her right, the tips catching light
    const B = [[-10, -5, 7, 2], [-5, -1, 11, 3], [1, 4, 10, 3], [7, 10, 8, 2]];
    for (const [a, b, len, sweep] of B) hairMass([[HX + a, HY - 11], [HX + b, HY - 11], [HX + b + sweep + s1 * 0.3, HY - 11 + len * 0.6], [HX + (a + b) / 2 + sweep + 1, HY - 11 + len], [HX + a + sweep * 0.4, HY - 11 + len * 0.5]], 2, (x, y) => y > HY - 11 + len * 0.55 && y < HY - 11 + len * 0.75 && x > HX + a + 1, (x, y) => Math.abs(x - (HX + (a + b) / 2) - (y - HY + 11) * 0.25) < 0.5);
    // the locks framing her face: a wide one in front of the ear, a thin one down the cheek
    hairMass([[HX - 13, HY - 8], [HX - 7, HY - 8], [HX - 7, HY + 6], [HX - 9, HY + 16], [HX - 11 + s1 * 0.5, HY + 18], [HX - 14, HY + 8]], 1.8, (x, y) => Math.abs(x - (HX - 9)) < 0.6 && y > HY - 4 && y < HY + 4, (x, y) => Math.abs(x - (HX - 11) - (y - HY) * 0.1) < 0.5);
    hairMass([[HX + 10, HY - 8], [HX + 13, HY - 6], [HX + 13, HY + 8], [HX + 12 + s1 * 0.4, HY + 13], [HX + 11, HY + 4]], 2);
    return { head: [HX, HY - 4], mouth: [HX + 3, HY + 9], chest: [2, -12] };
  }

  /* ---- Mira's bust: a round face in a peaked yellow hood, a brown fringe, red cheeks */
  function miraBust(P, t) {
    const F = P.face || {}, hy = (P.headY || 0), hx = (P.headX || 0), breathe = Math.sin(t * 2.6) > 0.3 ? -1 : 0;
    const HX = 2 + hx, HY = -33 + hy + breathe;
    const gold = (x, y, base) => { const l = litOf((x - HX) / 16, (y - HY) / 16); return band(R.gold, base + (l > 0.3 ? 1 : l < -0.4 ? -1 : 0)); };
    // the raincoat's shoulders, a placket and buttons
    sPoly([[-21, 0], [-19, -10], [-12, -16], [14, -16], [21, -10], [23, 0]], (x, y) => gold(x, y, 4.4));
    sPoly([[2, -16], [4, -16], [4, 0], [2, 0]], C('gold', 3));
    for (let k = 0; k < 3; k++) sEll(6, -11 + k * 5, 1.3, 1.3, (x, y, u, v) => band(R.linen, u + v < 0 ? 7 : 5));
    // the hood: rounded with a soft peak, draping onto the shoulders, its seam down the middle
    sPoly([[HX - 17, HY + 14], [HX - 18, HY - 2], [HX - 13, HY - 14], [HX - 2, HY - 21], [HX + 4, HY - 22], [HX + 13, HY - 15], [HX + 18, HY - 3], [HX + 17, HY + 14], [HX + 10, HY + 18], [HX - 10, HY + 18]], (x, y) => gold(x, y, 4.2) - (Math.abs(x - HX - 2 + (y - HY) * 0.15) < 0.5 && y < HY - 12 ? 1 : 0));
    // face
    sEll(HX, HY, 11.5, 12, (x, y, u, v) => {
      if (v > 0.3) { const uu = u - 0.1 * v, half = 1 - Math.pow((v - 0.3) / 0.7, 2) * 0.35; if (Math.abs(uu) > half) return -1; }
      const l = litOf(u, v * 0.8); return band(R.skin, 5 + (l > 0.38 ? 1 : l < -0.45 ? -1 : 0) - (v > 0.78 ? 1 : 0));
    });
    pFace(P, F, 0, HY - 1, HX - 8, HX + 2, HX + 2, HY + 7, R.skin, R.wood);
    sp(HX + 4, HY + 4, C('skin', 3));
    if (F.blush === undefined || F.blush) for (const bx of [HX - 7, HX + 4]) { sp(bx, HY + 5, C('rose', 4)); sp(bx + 2, HY + 5, C('rose', 4)); sp(bx + 1, HY + 6, C('rose', 4)); }
    // the fringe
    sEll(HX - 1, HY - 8, 12, 6, (x, y, u, v) => (v > 0.3 ? -1 : band(R.wood, 2.4 + (litOf(u, v) > 0.3 ? 1 : 0) + (Math.abs(v + 0.4) < 0.15 && u > -0.3 && u < 0.4 ? 1.5 : 0))));
    for (const [bx, len] of [[-8, 4], [-4, 6], [0, 5], [4, 6], [8, 4]]) sLock(HX + bx, HY - 9, HX + bx + 1, HY - 9 + len, 0.4, 2, R.wood, 2.4, false);
    // the hood's opening: a thick rolled rim, lit on top
    sEll(HX - 0.5, HY - 1, 15, 15, (x, y, u, v) => { const r = Math.hypot((u - 0.03) / 0.82, (v + 0.02) / 0.85); if (r < 1 || r > 1.18) return -1; return band(R.gold, 5.4 + (litOf(u, v) > 0.25 ? 1 : litOf(u, v) < -0.4 ? -1.4 : 0) + (r > 1.12 ? -1 : 0)); });
    // the drawstrings, swinging a little
    const ds = Math.sin(t * 3) * 0.6;
    sLock(HX - 6, HY + 13, HX - 7 + ds, HY + 20, 0, 0.6, R.linen, 5, false); sLock(HX + 8, HY + 13, HX + 8 + ds, HY + 19, 0, 0.6, R.linen, 5, false);
    return { head: [HX, HY - 4], mouth: [HX + 2, HY + 7], chest: [2, -8] };
  }
  const BUSTS = { sable: sableBust, mira: miraBust };
  // draw a bust into the frame: bottom centre at (x, y), whole-pixel scale S, facing f; o as for stamp
  function bust(who, P, x, y, S, f, o) {
    LIGHTS.x = LIGHT.x * (f < 0 ? -1 : 1); LIGHTS.y = LIGHT.y;
    sclear(); const r = BUSTS[who](P, P.t || 0); soutline(ENV.edge); stamp(x, y, S, f < 0, o);
    const L = (q) => [x + (f < 0 ? -q[0] - 0.5 : q[0] + 0.5) * S, y + q[1] * S];
    return { head: L(r.head), mouth: L(r.mouth), chest: L(r.chest) };
  }
