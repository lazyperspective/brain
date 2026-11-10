'use strict';
// Builds the "motif": a full-resolution colour study of the scene (tgt), a stroke-direction / impasto
// map (aux), plus the geometry the painter uses to brush along forms (trees, apples, grasses, window).

function angDiff(t, a) { let d = t - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; }

function makeTree(rng, opt) {
  const segs = [];
  const minR = opt.minR;
  let bidC = 0;
  function grow(x, y, a, len, r, rEnd, lvl, kind) {
    const bid = ++bidC;
    const step = kind === 2 ? 0.06 : clamp(r * 2.6, 0.045, 0.26);
    const n = Math.max(2, Math.ceil(len / step));
    const sl = len / n;
    const gn = kind === 2 ? 0.07 : (lvl === 0 ? 0.06 : lvl === 1 ? 0.1 : 0.15) * opt.gnarl;
    let along = 0;
    for (let i = 0; i < n; i++) {
      if (segs.length > opt.maxSegs) return;
      const r0 = r + (rEnd - r) * i / n, r1 = r + (rEnd - r) * (i + 1) / n;
      a += gauss(rng) * gn;
      if (kind !== 2 && rng() < opt.kink) a += (rng() - 0.5) * 1.1;
      if (kind === 2) a += angDiff(Math.PI / 2, a) * 0.25;
      else {
        const thin = clamp(0.05 / (r1 + 0.01), 0, 3);
        a += angDiff(-Math.PI / 2, a) * opt.droop * thin * sl;
        if (lvl >= 1) a += angDiff(Math.PI / 2, a) * opt.photo * sl;
      }
      const x1 = x + Math.cos(a) * sl, y1 = y + Math.sin(a) * sl;
      if (opt.exclude && lvl > 0 && opt.exclude(x1, y1, r1)) return;
      segs.push({ x0: x, y0: y, x1, y1, r0, r1, lvl, kind, d: along + sl * 0.5, bid });
      if (kind !== 2) {
        if (lvl < opt.maxLvl && r1 * 0.55 > minR && rng() < opt.pLat * sl / 0.2) {
          const side = rng() < 0.5 ? -1 : 1;
          const ca = a + side * (0.45 + 0.65 * rng());
          const clen = Math.max(0.15, (len - along) * (0.35 + 0.45 * rng()) + 0.15 * rng());
          const cr = r1 * (0.4 + 0.3 * rng());
          grow(x1, y1, ca, clen, cr, Math.max(minR * 0.8, cr * 0.3), lvl + 1, 1);
        }
        if (opt.sprouts && lvl <= 2 && r1 > 0.022 && Math.abs(Math.cos(a)) > 0.45 && rng() < opt.sprouts * sl / 0.2) {
          const nx = -Math.sin(a), ny = Math.cos(a), sgn = ny >= 0 ? 1 : -1;
          grow(x1 + nx * sgn * r1 * 0.8, y1 + ny * sgn * r1 * 0.8, Math.PI / 2 + gauss(rng) * 0.12 + (rng() - 0.5) * 0.4,
            opt.sproutLen * (0.3 + 0.7 * rng() * rng()), Math.max(minR, 0.009), Math.max(minR * 0.7, 0.0035), 9, 2);
        }
        if (lvl >= 1 && r1 < 0.035 && rng() < opt.spurs * sl / 0.2) {
          const side = rng() < 0.5 ? -1 : 1;
          const sa = a + side * (0.8 + 0.7 * rng());
          const L = 0.04 + 0.12 * rng();
          const rr = Math.max(minR, 0.0055);
          segs.push({ x0: x1, y0: y1, x1: x1 + Math.cos(sa) * L, y1: y1 + Math.sin(sa) * L, r0: rr, r1: rr * 0.8, lvl: lvl + 1, kind: 3, d: 0, bid: ++bidC });
        }
      }
      x = x1; y = y1; along += sl;
    }
    if (kind !== 2 && lvl < opt.maxLvl && rEnd > minR * 1.15) {
      const k = rng() < 0.25 ? 3 : 2;
      for (let j = 0; j < k; j++) {
        const off = (j - (k - 1) / 2) * (0.45 + 0.35 * rng()) + gauss(rng) * 0.12;
        const cr = rEnd * (0.72 + 0.12 * rng());
        grow(x, y, a + off, len * (0.5 + 0.3 * rng()), cr, Math.max(minR * 0.8, cr * 0.32), lvl + 1, 1);
      }
    }
  }
  // trunk
  const tr = opt.trunkR;
  let a = Math.PI / 2 + opt.lean;
  let x = 0, y = -tr * 0.15;
  const tn = Math.max(4, Math.round(opt.trunkH / 0.12));
  for (let i = 0; i < tn; i++) {
    const t0 = i / tn, t1 = (i + 1) / tn;
    const flare = (t) => 1 + 0.28 * Math.exp(-t * 6);
    a += gauss(rng) * 0.07 + (opt.twist || 0) * Math.sin(i * 1.3);
    a += angDiff(Math.PI / 2 + opt.lean, a) * 0.2;
    const sl = opt.trunkH / tn;
    const x1 = x + Math.cos(a) * sl, y1 = y + Math.sin(a) * sl;
    segs.push({ x0: x, y0: y, x1, y1, r0: tr * flare(t0) * (1 - 0.15 * t0), r1: tr * flare(t1) * (1 - 0.15 * t1), lvl: 0, kind: 0, d: (i + 0.5) * sl, bid: 0 });
    x = x1; y = y1;
  }
  const rTop = tr * 0.85;
  const limbs = opt.limbs || [];
  if (!opt.limbs) {
    const n = opt.nLimbs;
    for (let i = 0; i < n; i++) {
      const base = lerp(0.35, Math.PI - 0.35, n === 1 ? 0.5 : i / (n - 1));
      limbs.push({ a: base + (rng() - 0.5) * 0.35, len: opt.limbLen * (0.75 + 0.5 * rng()), r: rTop * (0.5 + 0.2 * rng()) });
    }
  }
  for (const L of limbs) {
    const sx = x + (rng() - 0.5) * rTop * 0.6, sy = y - rng() * 0.15;
    grow(sx, sy, L.a, L.len, L.r, Math.max(minR, L.r * 0.3), 1, 1);
  }
  // snow load on upper sides
  const ns = opt.seed | 0;
  for (const s of segs) {
    const dx = s.x1 - s.x0, dy = s.y1 - s.y0, l = Math.hypot(dx, dy) + 1e-9;
    const steep = Math.abs(dy) / l;
    let amt = clamp(1 - steep * 1.3, 0, 1);
    amt = Math.pow(amt, 0.8);
    const patch = vnoise((s.x0 + s.x1) * 3.1 + s.lvl * 7, (s.y0 + s.y1) * 3.1, ns + 77);
    amt *= smooth(0.22, 0.55, patch);
    const r = (s.r0 + s.r1) * 0.5;
    s.snow = amt;
    s.st = amt * Math.min(0.03, 0.006 + 0.4 * r) * (0.7 + 0.6 * patch);
  }
  return segs;
}

function buildScene(W, H, seed) {
  const S = W / 2160;
  const rng = PRNG(seed);
  const cam = { f: 2600 * S, cx: 1080 * S, yh: 1080 * S, e: 2.4 };
  const FE = cam.f * cam.e;
  const proj = (X, Y, Z) => [cam.cx + cam.f * X / Z, cam.yh + cam.f * (cam.e - Y) / Z];
  const N = W * H;

  // ---------- palette
  const HAZE = [0.36, 0.40, 0.58];
  const fogT = (Z) => 0.66 * (1 - Math.exp(-Z / 42));
  const fogc = (c, Z, k) => mixc(c, HAZE, fogT(Z) * (k == null ? 1 : k));
  const BARK = [0.07, 0.06, 0.085], BARKLIT = [0.25, 0.26, 0.38], SNOWC = [0.80, 0.84, 0.97];
  const WARM = [1.0, 0.58, 0.24];

  // ---------- house geometry
  const house = { X: 6.0, Z: 54, w: 7.0, d: 5.2, eave: 2.9, ridge: 5.3, psi: 0.36, oh: 0.35 };
  const cps = Math.cos(house.psi), sps = Math.sin(house.psi);
  const hw3 = (lx, y, lz) => [house.X + lx * cps - lz * sps, y, house.Z + lx * sps + lz * cps];
  const hp = (lx, y, lz) => { const p = hw3(lx, y, lz); return proj(p[0], p[1], p[2]); };
  const win = { lx0: -1.55, lx1: -0.55, y0: 0.95, y1: 2.05 };
  const wc = hp((win.lx0 + win.lx1) / 2, (win.y0 + win.y1) / 2, -house.d / 2);
  const wbase = hp((win.lx0 + win.lx1) / 2, 0, -house.d / 2);
  const wTL = hp(win.lx0, win.y1, -house.d / 2), wBR = hp(win.lx1, win.y0, -house.d / 2);
  const window_ = { x: wc[0], y: wc[1], bx: wbase[0], by: wbase[1], w: Math.abs(wBR[0] - wTL[0]), h: Math.abs(wBR[1] - wTL[1]) };
  const doorW = hw3(1.3, 0, -house.d / 2);

  // path centre line in world (X as function of Z)
  const Zdoor = doorW[2] - 0.6, Xdoor = doorW[0];
  const pathX = (Z) => lerp(-0.2, Xdoor, smooth(2, Zdoor, Z)) + 0.55 * Math.sin(Z * 0.16 + 1.2) * (1 - smooth(30, Zdoor, Z));

  // ---------- fence (between orchard and house)
  const posts = [];
  {
    const A = [-22, 51], B = [30, 57.5];
    const n = 22;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      let X = lerp(A[0], B[0], t) + (rng() - 0.5) * 0.5, Z = lerp(A[1], B[1], t) + (rng() - 0.5) * 0.4;
      const gate = Math.abs(X - pathX(Z)) < 1.6;
      const broken = rng() < 0.12;
      if (gate) continue;
      posts.push({ X, Z, h: 1.05 + 0.3 * rng(), lean: (rng() - 0.5) * 0.18, broken, t });
    }
  }

  // ---------- orchard layout
  const phi = Math.atan2(house.X, house.Z);
  const sp = Math.sin(phi), cpp = Math.cos(phi);
  const trees = [];
  const rowOffs = [-3.6, 3.6, -10.8, 10.8, -18, 18, -25.2, 25.2, -32.4, 32.4, -39.6];
  for (const off of rowOffs) {
    const phase = (rng() - 0.5) * 1.5;
    for (let t = 5 + phase; t < 47; t += 5.6 + (rng() - 0.5) * 0.6) {
      let X = off * cpp + t * sp + (rng() - 0.5) * 0.6, Z = -off * sp + t * cpp + (rng() - 0.5) * 0.6;
      if (Z < 3.5) continue;
      if (rng() < 0.12) continue; // missing trees in an old orchard
      const sx = cam.cx + cam.f * X / Z;
      const ppm = cam.f / Z;
      if (sx < -3.4 * ppm || sx > W + 3.4 * ppm) continue;
      if (Z < 8.5 && off < 0) continue;   // hero stands here
      if (Z < 9.5 && off > 0) continue;
      // keep the window clear
      const crownY = proj(X, 2.9, Z)[1];
      const dx = Math.abs(sx - window_.x) / (3.1 * ppm), dy = Math.abs(crownY - window_.y) / (2.4 * ppm);
      if (Z < house.Z && dx * dx + dy * dy < 1.0) continue;
      trees.push({ X, Z, hero: false, sc: 0.85 + 0.3 * rng() });
    }
  }
  trees.push({ X: -2.05, Z: 5.4, hero: true, sc: 1 });

  for (const T of trees) {
    const ppm = cam.f / T.Z;
    const minR = Math.max(0.0042, 0.5 / ppm);
    const trng = PRNG((seed * 31 + Math.round(T.X * 100) * 7 + Math.round(T.Z * 100)) >>> 0);
    let opt;
    if (T.hero) {
      opt = {
        trunkH: 1.15, trunkR: 0.2, lean: -0.06, twist: 0.05, minR, maxSegs: 26000, maxLvl: 6, gnarl: 1.25, kink: 0.08,
        droop: 0.01, photo: 0.05, pLat: 0.3, sprouts: 0.07, sproutLen: 0.75, spurs: 0.35, seed: 11,
        limbs: [
          { a: 2.35, len: 2.6, r: 0.11 },
          { a: 1.85, len: 3.2, r: 0.105 },
          { a: 1.3, len: 3.5, r: 0.1 },
          { a: 2.9, len: 1.5, r: 0.07 },
          { a: 0.8, len: 1.4, r: 0.06 },
        ],
      };
    } else {
      const big = T.Z < 16 ? 1.08 : 1;
      opt = {
        trunkH: (0.85 + 0.5 * trng()) * T.sc, trunkR: (0.13 + 0.06 * trng()) * T.sc, lean: (trng() - 0.5) * 0.3, twist: 0.03,
        minR, maxSegs: T.Z < 20 ? 9000 : 3500, maxLvl: 5, gnarl: 1.1, kink: 0.07, droop: 0.018, photo: 0.045,
        pLat: 0.28, sprouts: 0.07, sproutLen: 1.0, spurs: 0.3, seed: (trng() * 1e6) | 0,
        nLimbs: 3 + Math.floor(trng() * 3), limbLen: 2.3 * T.sc * big,
      };
    }
    const b = proj(T.X, 0, T.Z);
    T.bx = b[0]; T.by = b[1];
    T.ppm = ppm;
    {
      // keep the focal window (and, for the big foreground tree, the whole house) clear of limbs
      const hx0 = hp(-house.w / 2 - 0.6, 0, -house.d / 2)[0], hx1 = hp(house.w / 2 + 0.6, 0, house.d / 2)[0];
      const hy0 = hp(0, house.ridge + 1.6, 0)[1], hy1 = hp(0, -0.3, -house.d / 2)[1];
      opt.exclude = (lx, ly, r) => {
        const sx = T.bx + lx * ppm, sy = T.by - ly * ppm;
        const ex = (sx - window_.x) / (170 * S), ey = (sy - window_.y) / (130 * S);
        if (ex * ex + ey * ey < 1) return true;
        if (T.hero && sx > hx0 - 60 * S && sx < hx1 + 60 * S && sy > hy0 - 80 * S && sy < hy1 + 60 * S) return true;
        if (r * ppm > 2.5 && sx > hx0 && sx < hx1 && sy > hy0 && sy < hy1) return true;
        return false;
      };
    }
    T.segs = makeTree(trng, opt);
    // window rim light strength
    const dwx = T.X - house.X, dwz = T.Z - (house.Z - house.d / 2);
    const dist = Math.hypot(dwx, dwz);
    T.rim = T.hero ? 0 : clamp(1 - dist / 16, 0, 1) ** 2;
    T.rimDir = Math.sign(window_.x - T.bx) || 1;
    for (const s of T.segs) {
      s.sx0 = T.bx + s.x0 * ppm; s.sy0 = T.by - s.y0 * ppm;
      s.sx1 = T.bx + s.x1 * ppm; s.sy1 = T.by - s.y1 * ppm;
      s.pr0 = s.r0 * ppm; s.pr1 = s.r1 * ppm; s.pst = s.st * ppm;
      const nz = vnoise(s.x0 * 2.3, s.y0 * 2.3, 5);
      s.bark = fogc(mixc(BARK, [0.15, 0.11, 0.12], nz * 0.6), T.Z);
      s.lit = fogc(mixc(BARKLIT, [0.33, 0.32, 0.44], nz), T.Z, 0.8);
      s.snowc = fogc(SNOWC, T.Z, 0.45);
    }
  }
  trees.sort((a, b) => b.Z - a.Z);

  // apples (a few last ones)
  const apples = [];
  function addApples(T, n, yMin, yMax, r) {
    const cands = T.segs.filter(s => s.kind !== 2 && s.lvl >= 2 && s.r1 < 0.03 && s.sy1 > yMin && s.sy1 < yMax && s.sx1 > 60 * S && s.sx1 < W - 60 * S);
    const ar = PRNG(seed + Math.round(T.Z * 10));
    for (let i = 0; i < n && cands.length; i++) {
      const s = cands[Math.floor(ar() * cands.length)];
      const rp = r * T.ppm;
      const stem = 0.035 * T.ppm;
      if (apples.some(a => Math.hypot(a.x - s.sx1, a.y - s.sy1) < rp * 4)) continue;
      apples.push({ x: s.sx1 + (ar() - 0.5) * rp * 0.4, y: s.sy1 + stem + rp, ax: s.sx1, ay: s.sy1, r: rp, Z: T.Z, snow: ar() < 0.6, tree: T });
    }
  }

  // grass tufts poking through the snow
  const grasses = [];
  for (let i = 0; i < 300; i++) {
    const Z = 3.6 + 30 * Math.pow(rng(), 2.2);
    let sx = rng() * W;
    if (rng() < 0.5) sx = rng() < 0.5 ? rng() * W * 0.3 : W * (1 - 0.3 * rng());
    const X = (sx - cam.cx) * Z / cam.f;
    if (Math.abs(X - pathX(Z)) < 0.9) continue;
    if (vnoise(X / 3, Z / 3, seed + 31) < 0.42) continue;
    const n = 2 + Math.floor(rng() * rng() * 12);
    const g = { X, Z, stalks: [] };
    for (let k = 0; k < n; k++) {
      const hgt = (0.12 + 0.4 * rng() * rng()) * (Z < 8 ? 1.2 : 1);
      g.stalks.push({ dx: (rng() - 0.5) * 0.2, h: hgt, lean: (rng() - 0.5) * 0.8, curve: (rng() - 0.5) * 0.9, seedHead: rng() < 0.06, light: rng() < 0.3, snow: rng() < 0.2 });
    }
    grasses.push(g);
  }

  // tall dried weeds in the near foreground (goldenrod / wild carrot stalks)
  for (let i = 0; i < 16; i++) {
    const Z = 3.7 + 3.5 * rng();
    const sx = rng() < 0.75 ? W * (0.62 + 0.4 * rng()) : W * (0.3 + 0.2 * rng());
    const X = (sx - cam.cx) * Z / cam.f;
    if (Math.abs(X - pathX(Z)) < 0.7) continue;
    const g = { X, Z, stalks: [] };
    const n = 2 + Math.floor(rng() * 4);
    for (let k = 0; k < n; k++) g.stalks.push({ dx: (rng() - 0.5) * 0.25, h: 0.45 + 0.6 * rng(), lean: (rng() - 0.5) * 0.35, curve: (rng() - 0.5) * 0.5, seedHead: true, tall: true, light: rng() < 0.4, snow: rng() < 0.7 });
    grasses.push(g);
  }

  // ---------- canvases
  const mk = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; return c; };
  const cC = mk(), cA = mk();
  const ctx = cC.getContext('2d'), atx = cA.getContext('2d');
  const acol = (a, imp) => { const c = Math.cos(2 * a), s = Math.sin(2 * a); return `rgb(${Math.round(128 + 127 * c)},${Math.round(128 + 127 * s)},${Math.round(clamp(imp, 0, 1) * 255)})`; };

  // ---------- per-pixel background: sky, far ridge, forest, snow field
  const fBase = cam.yh + FE / 210;
  const fTop = new Float32Array(W);
  for (let x = 0; x < W; x++) {
    const xn = x / W;
    let h = 95 + 200 * smooth(0.3, 0.6, xn) - 50 * smooth(0.88, 1.0, xn) + 90 * (fbm(x / (240 * S), 3.3, 3, seed + 5) - 0.5) + 40 * (fbm(x / (45 * S), 1.1, 3, seed + 6) - 0.5);
    fTop[x] = fBase - h * S;
  }
  for (let k = 0; k < 95; k++) {
    const xs = rng() * W;
    const loc = smooth(0.2, 0.6, xs / W);
    if (rng() > 0.35 + 0.65 * loc) continue;
    const hs = (18 + 55 * rng() * rng()) * S * (0.5 + 0.7 * loc);
    const ws = hs * (0.16 + 0.1 * rng());
    const base = fTop[Math.floor(xs)] + hs * 0.25;
    for (let x = Math.max(0, Math.floor(xs - ws)); x <= Math.min(W - 1, Math.ceil(xs + ws)); x++) {
      const q = 1 - Math.abs(x - xs) / ws;
      const jag = 1 + 0.25 * (hash2(x, k, 3) - 0.5);
      const top = base - hs * Math.pow(Math.max(0, q), 0.85) * jag;
      if (top < fTop[x]) fTop[x] = top;
    }
  }

  const img = ctx.createImageData(W, H), aim = atx.createImageData(W, H);
  const D = img.data, AD = aim.data;
  const put = (i, c) => { D[i] = clamp(c[0], 0, 1) * 255; D[i + 1] = clamp(c[1], 0, 1) * 255; D[i + 2] = clamp(c[2], 0, 1) * 255; D[i + 3] = 255; };
  const aput = (i, a, imp) => { AD[i] = 128 + 127 * Math.cos(2 * a); AD[i + 1] = 128 + 127 * Math.sin(2 * a); AD[i + 2] = clamp(imp, 0, 1) * 255; AD[i + 3] = 255; };

  const sky = (x, y) => {
    const t = clamp(y / cam.yh, 0, 1.08);
    const c0 = [0.035, 0.06, 0.17], c1 = [0.10, 0.15, 0.32], c2 = [0.25, 0.30, 0.49], c3 = [0.42, 0.44, 0.59];
    let c;
    if (t < 0.45) c = mixc(c0, c1, smooth(0, 0.45, t));
    else if (t < 0.82) c = mixc(c1, c2, smooth(0.45, 0.82, t));
    else c = mixc(c2, c3, smooth(0.82, 1.0, t));
    const g = Math.exp(-Math.pow((x / W - 0.18) / 0.38, 2)) * Math.pow(smooth(0.5, 1.0, t), 2);
    c[0] += 0.07 * g; c[1] += 0.04 * g; c[2] += 0.035 * g;
    const n = fbm(x / (650 * S), y / (200 * S), 4, seed + 1);
    const n2 = fbm(x / (300 * S) + 5, y / (150 * S), 3, seed + 2);
    const m = 0.88 + 0.24 * n;
    c[0] *= m; c[1] *= m; c[2] *= m + 0.03 * (n2 - 0.5);
    c[0] += 0.03 * (n2 - 0.5);
    const n3 = fbm(x / (110 * S), y / (40 * S), 2, seed + 4) - 0.5;
    c[0] *= 1 + 0.1 * n3; c[1] *= 1 + 0.07 * n3; c[2] *= 1 + 0.05 * n3;
    return c;
  };

  // window spill and post shadows on the snow (screen space, painterly licence)
  const wx = window_.x, wbY = window_.by;
  const postScr = posts.map(p => { const b = proj(p.X, 0, p.Z); return { x: b[0], y: b[1], w: 0.16 * cam.f / p.Z, Z: p.Z }; });
  const spillAt = (x, y) => {
    const dy = y - wbY;
    if (dy < -2 * S) return 0;
    const ax = Math.abs(x - wx);
    if (ax > 700 * S || dy > 260 * S) return 0;
    const halfw = window_.w * 0.62 + 1.05 * Math.max(0, dy);
    const patch = smooth(halfw + 14 * S, halfw - 10 * S, ax + (vnoise(x / (9 * S), y / (5 * S), 61) - 0.5) * 16 * S) * smooth(-1 * S, 4 * S, dy) * Math.exp(-Math.max(0, dy) / (48 * S));
    const pool = Math.exp(-Math.pow(ax / (230 * S), 2) - Math.pow(Math.max(0, dy) / (60 * S), 2));
    const wide = Math.exp(-Math.pow(ax / (520 * S), 2) - Math.pow(Math.max(0, dy) / (140 * S), 2));
    let I = 0.95 * patch + 0.42 * pool + 0.16 * wide;
    // fence-post shadows thrown toward the viewer
    for (const p of postScr) {
      if (p.y < wbY) continue;
      const vx = p.x - wx, vy = p.y - wbY;
      const vl = Math.hypot(vx, vy) + 1e-6;
      const ux = vx / vl, uy = vy / vl;
      const qx = x - p.x, qy = y - p.y;
      const along = qx * ux + qy * uy;
      if (along < 0 || along > 200 * S) continue;
      const perp = Math.abs(-qx * uy + qy * ux);
      const sw = p.w * 0.5 * (1 + along / (vl + 1));
      const sh = smooth(sw + 1.5 * S, sw - 0.5 * S, perp) * (1 - along / (200 * S));
      I *= 1 - 0.75 * sh;
    }
    return I;
  };

  const ridge = new Float32Array(W);
  for (let x = 0; x < W; x++) ridge[x] = cam.yh - S * (14 + 46 * fbm(x / (800 * S), 1.7, 3, seed + 9));

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      if (y < fTop[x] - 14 * S || y < ridge[x] && y < fTop[x]) {
        let c = sky(x, y);
        if (y >= ridge[x] - 3 * S && y < fTop[x]) {
          const k = smooth(ridge[x] - 3 * S, ridge[x] + 3 * S, y);
          c = mixc(c, [0.29, 0.30, 0.46], k * 0.85);
        }
        // feathered forest crown fringe
        if (y >= fTop[x] - 14 * S) {
          const fz = fbm(x / (5 * S), y / (16 * S), 3, seed + 11);
          const k = smooth(fTop[x] - 14 * S, fTop[x] + 4 * S, y + (fz - 0.5) * 18 * S);
          c = mixc(c, [0.16, 0.17, 0.29], k * 0.75);
        }
        put(i, c);
        aput(i, (fbm(x / (520 * S), y / (380 * S), 2, seed + 3) - 0.5) * 1.3, 0.05);
      } else if (y < fBase) {
        // forest band
        const s = sky(x, y);
        const fz = fbm(x / (5 * S), y / (16 * S), 3, seed + 11);
        const edge = smooth(fTop[x] - 14 * S, fTop[x] + 10 * S, y + (fz - 0.5) * 18 * S);
        const trunk = fbm(x / (3.5 * S), y / (60 * S), 2, seed + 12);
        const depth = smooth(fTop[x], fBase, y);
        let c = [0.135 + 0.03 * trunk, 0.145 + 0.025 * trunk, 0.255 + 0.03 * trunk];
        c = mixc(c, [0.20, 0.21, 0.34], 0.5 * (1 - depth) * fbm(x / (40 * S), y / (25 * S), 3, seed + 13));
        // snowy floor glimpses at the base of the woods
        const fl = smooth(fBase - 18 * S, fBase, y) * smooth(0.45, 0.7, fbm(x / (14 * S), 0.5, 2, seed + 14));
        c = mixc(c, [0.42, 0.44, 0.60], fl * 0.7);
        c = mixc(s, c, edge);
        put(i, c);
        aput(i, Math.PI / 2 + (fz - 0.5) * 0.5, 0.0);
      } else {
        // snow field
        const z = FE / (y - cam.yh);
        const X = (x - cam.cx) * z / cam.f;
        const ff = 1 - Math.exp(-z / 30);
        const hf = (X, Z) => 0.45 * fbm(X / 5, Z / 3.5, 3, seed + 21) + 0.1 * fbm(X / 1.1, Z / 0.9, 2, seed + 22)
          + 0.05 * Math.sin(X * 1.1 + Z * 2.6 + 7 * fbm(X / 4, Z / 4, 2, seed + 26)) * smooth(30, 6, Z)
          + (z < 14 ? 0.018 * vnoise(X / 0.25, Z / 0.25, seed + 23) : 0);
        const e = 0.15;
        const h0 = hf(X, z), hx = hf(X + e, z), hz = hf(X, z + e);
        let nx = -(hx - h0) / e, nz = -(hz - h0) / e, ny = 1;
        // path trough
        const pxc = pathX(z), pdx = X - pxc, pw = 0.42;
        let trough = 0, pside = 0;
        if (Math.abs(pdx) < pw * 1.6) {
          const q = pdx / pw;
          trough = Math.exp(-q * q * 2.2);
          const slope = -4.4 * q * trough * 0.18;
          nx += -slope;
          pside = q;
        }
        const nl = Math.hypot(nx, ny, nz);
        nx /= nl; ny /= nl; nz /= nl;
        // sky dome light from upper-left-behind; viewer side darker
        const L = [-0.45, 0.75, 0.48];
        const dif = nx * L[0] + ny * L[1] + nz * L[2];
        const sh = 0.5 + 0.6 * dif;
        const near = [0.25, 0.31, 0.57], far = [0.52, 0.55, 0.73];
        let c = mixc(near, far, ff);
        c = [c[0] * sh, c[1] * sh, c[2] * sh];
        // horizon glow catch on far snow
        const g = Math.exp(-Math.pow((x / W - 0.2) / 0.4, 2)) * ff;
        c[0] += 0.03 * g; c[1] += 0.015 * g;
        // foreground deepens toward the bottom edge
        const fg = smooth(16, 3.6, z);
        c = [c[0] * (1 - 0.3 * fg) + 0.015 * fg, c[1] * (1 - 0.33 * fg), c[2] * (1 - 0.2 * fg)];
        // trodden path: slightly darker, rougher
        if (trough > 0.05) {
          const rough = vnoise(X / 0.18, z / 0.3, seed + 24);
          const k = trough * (0.1 + 0.08 * rough);
          c = [c[0] * (1 - k), c[1] * (1 - k), c[2] * (1 - k * 0.6)];
        }
        // warm spill
        const I = spillAt(x, y) * (0.85 + 0.3 * sh - 0.15);
        if (I > 0.003) {
          const k = clamp(I, 0, 1.2);
          c = [c[0] * (1 - 0.55 * Math.min(1, k)) + WARM[0] * k * 0.95, c[1] * (1 - 0.55 * Math.min(1, k)) + WARM[1] * k * 0.92, c[2] * (1 - 0.55 * Math.min(1, k)) + WARM[2] * k * 0.8];
        }
        // broken colour in the snow: drifting patches of violet, cobalt and grey-green
        {
          const b1 = fbm(x / (160 * S), y / (34 * S), 3, seed + 27) - 0.5, b2 = fbm(x / (90 * S) + 3, y / (22 * S), 2, seed + 28) - 0.5;
          const k = 1 + 0.24 * b1;
          c = [c[0] * k + 0.05 * b2, c[1] * k - 0.012 * b2 + 0.03 * b1, c[2] * k - 0.03 * b2];
        }
        put(i, c);
        const lum = 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2];
        let ang = (fbm(x / (300 * S), y / (90 * S), 2, seed + 25) - 0.5) * 0.45;
        if (trough > 0.4) {
          const z2 = z + 1; const p1 = proj(pathX(z), 0, z), p2 = proj(pathX(z2), 0, z2);
          ang = Math.atan2(p2[1] - p1[1], p2[0] - p1[0]);
        }
        aput(i, ang, 0.5 + 0.5 * smooth(0.4, 0.65, lum) + 0.5 * Math.min(1, I));
      }
    }
  }
  ctx.putImageData(img, 0, 0);
  atx.putImageData(aim, 0, 0);

  // ---------- drawing helpers
  function line2(x0, y0, x1, y1, w, col, al, imp, cap) {
    const a = Math.atan2(y1 - y0, x1 - x0);
    ctx.lineCap = atx.lineCap = cap || 'round';
    ctx.globalAlpha = al; ctx.strokeStyle = css(col); ctx.lineWidth = w;
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    if (imp != null) {
      atx.globalAlpha = Math.min(1, al * 1.2); atx.strokeStyle = acol(a, imp); atx.lineWidth = w;
      atx.beginPath(); atx.moveTo(x0, y0); atx.lineTo(x1, y1); atx.stroke();
    }
    ctx.globalAlpha = 1; atx.globalAlpha = 1;
  }
  function poly2(pts, col, ang, imp, al) {
    ctx.globalAlpha = al == null ? 1 : al;
    ctx.fillStyle = css(col); ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.closePath(); ctx.fill();
    ctx.globalAlpha = 1;
    if (ang != null) { atx.fillStyle = acol(ang, imp); atx.beginPath(); pts.forEach((p, i) => i ? atx.lineTo(p[0], p[1]) : atx.moveTo(p[0], p[1])); atx.closePath(); atx.fill(); }
  }
  function ellipse2(x, y, rx, ry, col, al, ang, imp) {
    ctx.globalAlpha = al; ctx.fillStyle = css(col); ctx.beginPath(); ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), 0, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
    if (ang != null) { atx.fillStyle = acol(ang, imp); atx.beginPath(); atx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), 0, 0, Math.PI * 2); atx.fill(); }
  }
  function softDisc(x, y, r, col, al) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, css(col, al)); g.addColorStop(1, css(col, 0));
    ctx.fillStyle = g; ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
  }

  // ---------- object painters
  function drawTreeWell(T) {
    const ppm = T.ppm, rx = (T.hero ? 0.9 : 0.75) * ppm, ry = rx * cam.e / T.Z * 1.3;
    const col = fogc([0.25, 0.28, 0.50], T.Z, 0.7);
    // soft blue shadow beneath crown (sky occluded)
    const g = ctx.createRadialGradient(T.bx, T.by, 0, T.bx, T.by, 3.2 * ppm);
    g.addColorStop(0, css(fogc([0.22, 0.26, 0.50], T.Z, 0.7), 0.12)); g.addColorStop(1, css([0.3, 0.33, 0.55], 0));
    ctx.save(); ctx.translate(T.bx, T.by); ctx.scale(1, cam.e / T.Z * 1.2); ctx.translate(-T.bx, -T.by);
    ctx.fillStyle = g; ctx.fillRect(T.bx - 3.2 * ppm, T.by - 3.2 * ppm, 6.4 * ppm, 6.4 * ppm); ctx.restore();
  }

  function drawTree(T) {
    drawTreeWell(T);
    const segs = T.segs;
    const Lx = -0.42, Ly = -0.9;
    for (let si = 0; si < segs.length; si++) {
      const s = segs[si];
      const w = Math.max(0.55, s.pr0 + s.pr1);
      const al = w < 1 ? w : 1;
      line2(s.sx0, s.sy0, s.sx1, s.sy1, Math.max(1, w), s.bark, al, 0.0, si === 0 ? 'butt' : 'round');
    }
    for (const s of segs) {
      const r = (s.pr0 + s.pr1) * 0.5;
      if (r < 1.1) continue;
      const dx = s.sx1 - s.sx0, dy = s.sy1 - s.sy0, l = Math.hypot(dx, dy) + 1e-6;
      let nx = -dy / l, ny = dx / l;
      if (nx * Lx + ny * Ly < 0) { nx = -nx; ny = -ny; }
      const fac = clamp(nx * Lx + ny * Ly, 0, 1);
      line2(s.sx0 + nx * r * 0.5, s.sy0 + ny * r * 0.5, s.sx1 + nx * r * 0.5, s.sy1 + ny * r * 0.5, r * 0.75, s.lit, 0.55 * fac, null);
      if (T.rim > 0.01) {
        let rx = -dy / l, ry = dx / l;
        if (rx * T.rimDir < 0) { rx = -rx; ry = -ry; }
        const k = T.rim * clamp(1 - s.y0 / 3.5, 0, 1) * Math.abs(rx);
        if (k > 0.02) line2(s.sx0 + rx * r * 0.65, s.sy0 + ry * r * 0.65, s.sx1 + rx * r * 0.65, s.sy1 + ry * r * 0.65, r * 0.5, [0.95, 0.52, 0.25], 0.8 * k, null);
      }
    }
    // snow on the upper sides
    for (const s of segs) {
      if (s.pst < 0.35) continue;
      const dx = s.sx1 - s.sx0, dy = s.sy1 - s.sy0, l = Math.hypot(dx, dy) + 1e-6;
      let nx = -dy / l, ny = dx / l;
      if (ny > 0) { nx = -nx; ny = -ny; }
      const r = (s.pr0 + s.pr1) * 0.5;
      const off = r + s.pst * 0.25;
      const w = Math.max(0.8, s.pst);
      line2(s.sx0 + nx * off, s.sy0 + ny * off, s.sx1 + nx * off, s.sy1 + ny * off, w, s.snowc, Math.min(1, s.pst), 1.0);
    }
    // snow mound around the trunk base
    const ppm = T.ppm, tr = (T.hero ? 0.22 : 0.15) * ppm;
    const gi = (Math.min(H - 1, Math.round(T.by + tr * 0.6)) * W + Math.round(clamp(T.bx + tr * 2.5, 0, W - 1))) * 4;
    const sc = [D[gi] / 255 * 1.08, D[gi + 1] / 255 * 1.08, D[gi + 2] / 255 * 1.05];
    for (let k = 0; k < 9; k++) {
      const ox = (hash2(k, T.Z * 10, 4) - 0.5) * tr * 2.4;
      ellipse2(T.bx + ox, T.by + tr * (0.12 + 0.12 * hash2(k, 5, 1)), tr * (0.6 + 0.6 * hash2(k, 2, T.Z * 10)), tr * (0.18 + 0.12 * hash2(k, 3, 1)), sc, 1, 0, 0.6);
    }
    T.moundCol = sc;
    if (T.apples) for (const ap of apples) if (ap.tree === T) drawApple(ap);
  }

  function drawApple(ap) {
    const r = ap.r, k = fogT(ap.Z);
    const f = (c) => mixc(c, HAZE, k * 0.8);
    line2(ap.ax, ap.ay, ap.x + r * 0.1, ap.y - r * 0.85, Math.max(1, r * 0.13), f([0.12, 0.08, 0.07]), 1, 0);
    ellipse2(ap.x, ap.y, r, r * 0.93, f([0.34, 0.035, 0.06]), 1, Math.PI / 2, 0.3);
    ellipse2(ap.x + r * 0.22, ap.y + r * 0.2, r * 0.72, r * 0.65, f([0.22, 0.02, 0.06]), 0.8, null);
    ellipse2(ap.x - r * 0.25, ap.y - r * 0.28, r * 0.55, r * 0.42, f([0.52, 0.09, 0.11]), 0.8, null);
    ellipse2(ap.x - r * 0.38, ap.y - r * 0.45, r * 0.22, r * 0.16, f([0.70, 0.52, 0.66]), 0.8, null);
    if (ap.snow) ellipse2(ap.x - r * 0.05, ap.y - r * 0.82, r * 0.55, r * 0.22, f([0.82, 0.85, 0.97]), 1, 0, 1);
  }

  function drawGrass(g) {
    const ppm = cam.f / g.Z;
    const b = proj(g.X, 0, g.Z);
    const base = fogc([0.30, 0.22, 0.17], g.Z), light = fogc([0.58, 0.46, 0.32], g.Z);
    for (const st of g.stalks) {
      const x0 = b[0] + st.dx * ppm, y0 = b[1] + 0.01 * ppm;
      const hpx = st.h * ppm;
      let x = x0, y = y0, a = -Math.PI / 2 + st.lean;
      const n = 6, w = Math.max(0.6, 0.0045 * ppm);
      st.pts = [[x, y]]; st.w = w; st.col = st.light ? light : base; st.Z = g.Z;
      for (let i = 0; i < n; i++) {
        a += st.curve / n;
        const x1 = x + Math.cos(a) * hpx / n, y1 = y + Math.sin(a) * hpx / n;
        line2(x, y, x1, y1, w * (1 - i / n * 0.6), st.light ? light : base, Math.min(1, w), 0.1);
        x = x1; y = y1; st.pts.push([x, y]);
      }
      st.tipx = x; st.tipy = y;
      if (st.tall) {
        // a little umbel of dried rays, cupped, with snow sitting in it
        const nr = 5 + Math.floor(hash2(x | 0, y | 0, 5) * 5);
        const hr = 0.05 * ppm;
        for (let k = 0; k < nr; k++) {
          const aa = -Math.PI / 2 + (k / (nr - 1) - 0.5) * 2.2;
          const ex = x + Math.cos(aa) * hr, ey = y + Math.sin(aa) * hr * 0.8 - hr * 0.3;
          line2(x, y, ex, ey, Math.max(0.7, w * 0.5), base, 1, 0.1);
          ellipse2(ex, ey, w * 0.9, w * 0.9, fogc([0.16, 0.11, 0.10], g.Z), 1, null);
        }
        if (st.snow && hash2(x | 0, y | 0, 9) < 0.45) ellipse2(x + (hash2(x | 0, 1, 9) - 0.5) * hr * 0.4, y - hr * 0.55, hr * (0.35 + 0.25 * hash2(x | 0, 2, 9)), hr * 0.2, fogc([0.74, 0.77, 0.92], g.Z, 0.5), 0.95, 0, 1);
        st.head = { x, y, hr };
      } else if (st.seedHead) ellipse2(x, y, w * 1.6, w * 2.4, fogc([0.18, 0.13, 0.12], g.Z), 1, Math.PI / 2, 0.2);
      if (st.snow) ellipse2(x, y - w, w * 1.5, w * 0.9, fogc([0.78, 0.8, 0.95], g.Z, 0.5), 0.9, 0, 1);
    }
    // a little snow heaped at the base
  }

  function drawFencePost(p) {
    const ppm = cam.f / p.Z;
    const b = proj(p.X, 0, p.Z);
    const hgt = (p.broken ? 0.55 : p.h) * ppm;
    const tx = b[0] + Math.sin(p.lean) * hgt, ty = b[1] - Math.cos(p.lean) * hgt;
    const col = fogc([0.10, 0.085, 0.10], p.Z, 0.85);
    line2(b[0], b[1], tx, ty, 0.15 * ppm, col, 1, Math.PI / 2, 'butt');
    ellipse2(tx, ty - 0.02 * ppm, 0.095 * ppm, 0.045 * ppm, fogc([0.75, 0.78, 0.92], p.Z, 0.5), 1, 0, 1);
    // warm light catches the house-facing side of nearby posts
    const I = spillAt(b[0], b[1] + 2 * S);
    if (I > 0.05) line2(b[0] + 0.04 * ppm * Math.sign(window_.x - b[0]), b[1], tx + 0.04 * ppm * Math.sign(window_.x - b[0]), ty, 0.05 * ppm, [0.9, 0.5, 0.25], Math.min(0.8, I), null, 'butt');
    p.top = [tx, ty]; p.base = b;
  }
  function drawRails() {
    const sorted = posts.slice().sort((a, b) => a.t - b.t);
    for (let i = 0; i + 1 < sorted.length; i++) {
      const A = sorted[i], B = sorted[i + 1];
      if (!A.top || !B.top) continue;
      if (Math.hypot(A.X - B.X, A.Z - B.Z) > 3.5) continue;
      const hA = A.broken ? 0.45 : 0.85, hB = B.broken ? 0.45 : 0.85;
      if (hash2(i, 7, 9) < 0.18) continue;
      const pa = proj(A.X, hA * 0.85, A.Z), pb = proj(B.X, hB * 0.85, B.Z);
      const ppm = cam.f / ((A.Z + B.Z) / 2);
      line2(pa[0], pa[1], pb[0], pb[1], 0.07 * ppm, fogc([0.10, 0.085, 0.10], A.Z, 0.85), 1, 0);
      line2(pa[0], pa[1] - 0.05 * ppm, pb[0], pb[1] - 0.05 * ppm, 0.045 * ppm, fogc([0.72, 0.75, 0.9], A.Z, 0.5), 0.95, 1);
      const qa = proj(A.X, hA * 0.4, A.Z), qb = proj(B.X, hB * 0.4, B.Z);
      if (hash2(i, 8, 9) < 0.7) {
        line2(qa[0], qa[1], qb[0], qb[1], 0.06 * ppm, fogc([0.10, 0.085, 0.10], A.Z, 0.85), 1, 0);
        line2(qa[0], qa[1] - 0.045 * ppm, qb[0], qb[1] - 0.045 * ppm, 0.04 * ppm, fogc([0.72, 0.75, 0.9], A.Z, 0.5), 0.9, 1);
      }
    }
  }

  const smoke = { x: 0, y: 0 };
  function drawHouse() {
    const d2 = house.d / 2, w2 = house.w / 2, oh = house.oh;
    const fogk = 0.35;
    const f = (c) => mixc(c, HAZE, fogT(house.Z) * fogk);
    const frontA = Math.atan2(hp(w2, 0, -d2)[1] - hp(-w2, 0, -d2)[1], hp(w2, 0, -d2)[0] - hp(-w2, 0, -d2)[0]);
    // chimney (behind the ridge, so drawn first)
    const cx0 = 1.6, cx1 = 2.25, cz0 = 0.15, cz1 = 0.8, ctop = house.ridge + 1.15;
    poly2([hp(cx0, 3.6, cz0), hp(cx1, 3.6, cz0), hp(cx1, ctop, cz0), hp(cx0, ctop, cz0)], f([0.13, 0.085, 0.10]), Math.PI / 2, 0);
    poly2([hp(cx0, 3.6, cz0), hp(cx0, 3.6, cz1), hp(cx0, ctop, cz1), hp(cx0, ctop, cz0)], f([0.20, 0.17, 0.24]), Math.PI / 2, 0);
    const ct = [hp(cx0 - 0.05, ctop, cz0 - 0.05), hp(cx1 + 0.05, ctop, cz0 - 0.05), hp(cx1 + 0.05, ctop, cz1 + 0.05), hp(cx0 - 0.05, ctop, cz1 + 0.05)];
    poly2([ct[0], ct[1], [ct[1][0], ct[1][1] - 5 * S], [ct[0][0], ct[0][1] - 6 * S]], f([0.70, 0.73, 0.88]), 0, 1);
    const top = hp((cx0 + cx1) / 2, ctop, (cz0 + cz1) / 2);
    smoke.x = top[0]; smoke.y = top[1] - 4 * S;
    // left gable wall
    const g = [hp(-w2, 0, d2), hp(-w2, 0, -d2), hp(-w2, house.eave, -d2), hp(-w2, house.ridge, 0), hp(-w2, house.eave, d2)];
    poly2(g, f([0.15, 0.145, 0.22]), Math.PI / 2, 0);
    // small dark attic window in the gable
    poly2([hp(-w2, 3.25, -0.3), hp(-w2, 3.25, 0.3), hp(-w2, 3.85, 0.3), hp(-w2, 3.85, -0.3)], f([0.06, 0.055, 0.08]), 0, 0);
    // front wall
    poly2([hp(-w2, 0, -d2), hp(w2, 0, -d2), hp(w2, house.eave, -d2), hp(-w2, house.eave, -d2)], f([0.10, 0.09, 0.13]), frontA, 0);
    // weathered boards
    for (let k = 1; k < 9; k++) {
      const yy = k * house.eave / 9;
      const a = hp(-w2, yy, -d2), b = hp(w2, yy, -d2);
      line2(a[0], a[1], b[0], b[1], 1.2 * S, f([0.07, 0.065, 0.09]), 0.6, null, 'butt');
    }
    // eave shadow
    poly2([hp(-w2, house.eave - 0.35, -d2), hp(w2, house.eave - 0.35, -d2), hp(w2, house.eave, -d2), hp(-w2, house.eave, -d2)], f([0.05, 0.045, 0.07]), frontA, 0, 0.85);
    // door
    poly2([hp(0.9, 0, -d2), hp(1.75, 0, -d2), hp(1.75, 1.95, -d2), hp(0.9, 1.95, -d2)], f([0.065, 0.05, 0.06]), Math.PI / 2, 0);
    // window: frame, glowing panes, mullions
    const z = -d2 - 0.01;
    poly2([hp(win.lx0 - 0.1, win.y0 - 0.12, z), hp(win.lx1 + 0.1, win.y0 - 0.12, z), hp(win.lx1 + 0.1, win.y1 + 0.1, z), hp(win.lx0 - 0.1, win.y1 + 0.1, z)], [0.16, 0.08, 0.06], Math.PI / 2, 0);
    const pane = (a0, a1, b0, b1, c) => poly2([hp(a0, b0, z), hp(a1, b0, z), hp(a1, b1, z), hp(a0, b1, z)], c, Math.PI / 2, 1);
    const mx = (win.lx0 + win.lx1) / 2, my = (win.y0 + win.y1) / 2 + 0.08;
    const gap = 0.05;
    pane(win.lx0, mx - gap, my + gap, win.y1, [1.0, 0.70, 0.36]);
    pane(mx + gap, win.lx1, my + gap, win.y1, [0.98, 0.60, 0.28]);
    pane(win.lx0, mx - gap, win.y0, my - gap, [1.0, 0.82, 0.50]);
    pane(mx + gap, win.lx1, win.y0, my - gap, [1.0, 0.72, 0.40]);
    // lamp-hot core low-left pane
    const hc = hp(win.lx0 + 0.3, win.y0 + 0.3, z);
    softDisc(hc[0], hc[1], window_.w * 0.42, [1.0, 0.93, 0.72], 0.8);
    // snow on sill, lit warm
    poly2([hp(win.lx0 - 0.16, win.y0 - 0.12, z - 0.05), hp(win.lx1 + 0.16, win.y0 - 0.12, z - 0.05), hp(win.lx1 + 0.12, win.y0 - 0.02, z - 0.05), hp(win.lx0 - 0.12, win.y0 - 0.03, z - 0.05)], [1.0, 0.70, 0.42], 0, 1);
    // roof: snow-covered front plane
    const rs = (house.ridge - house.eave) / d2;
    const eY = house.eave - oh * rs;
    const roof = [hp(-w2 - oh, eY, -d2 - oh), hp(w2 + oh, eY, -d2 - oh), hp(w2 + oh, house.ridge + 0.12, 0), hp(-w2 - oh, house.ridge + 0.12, 0)];
    const roofA = Math.atan2(roof[3][1] - roof[0][1], roof[3][0] - roof[0][0]);
    poly2(roof, f([0.56, 0.59, 0.77]), frontA, 0.9);
    // light toward the ridge, shadow at eave
    {
      const gr = ctx.createLinearGradient(0, roof[3][1], 0, roof[0][1]);
      gr.addColorStop(0, css(f([0.70, 0.72, 0.88]), 0.9)); gr.addColorStop(0.6, css(f([0.58, 0.61, 0.79]), 0.4)); gr.addColorStop(1, css(f([0.42, 0.45, 0.64]), 0.7));
      ctx.fillStyle = gr; ctx.beginPath(); roof.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.closePath(); ctx.fill();
    }
    // snow thickness along the eave and the left barge
    const lip = [hp(-w2 - oh, eY, -d2 - oh), hp(w2 + oh, eY, -d2 - oh), hp(w2 + oh, eY - 0.22, -d2 - oh), hp(-w2 - oh, eY - 0.25, -d2 - oh)];
    poly2(lip, f([0.47, 0.50, 0.70]), frontA, 0.8);
    const bar = [hp(-w2 - oh, eY, -d2 - oh), hp(-w2 - oh, house.ridge + 0.12, 0), hp(-w2 - oh, house.ridge - 0.12, 0), hp(-w2 - oh, eY - 0.25, -d2 - oh)];
    poly2(bar, f([0.62, 0.65, 0.84]), roofA, 1);
    // a few icicles
    for (let k = 0; k < 14; k++) {
      const lx = -w2 - oh + (house.w + 2 * oh) * hash2(k, 3, 7);
      const L = 0.08 + 0.3 * hash2(k, 4, 7) ** 2;
      const a = hp(lx, eY - 0.24, -d2 - oh), b = hp(lx, eY - 0.24 - L, -d2 - oh);
      line2(a[0], a[1], b[0], b[1], 1.6 * S, f([0.62, 0.66, 0.85]), 0.75, Math.PI / 2, 0.8);
    }
    // drift against the wall base
    const nb = 28;
    const drift = [];
    for (let k = 0; k <= nb; k++) { const lx = -w2 - 0.3 + (house.w + 0.6) * k / nb; drift.push(hp(lx, 0.22 + 0.16 * vnoise(k * 0.7, 1, 5), -d2 - 0.15)); }
    for (let k = nb; k >= 0; k--) { const lx = -w2 - 0.3 + (house.w + 0.6) * k / nb; drift.push(hp(lx, -0.05, -d2 - 0.6)); }
    poly2(drift, f([0.50, 0.53, 0.72]), frontA, 0.7);
    const gd = [];
    for (let k = 0; k <= 10; k++) gd.push(hp(-w2 - 0.2, 0.2 + 0.1 * vnoise(k, 3, 5), -d2 + house.d * k / 10));
    for (let k = 10; k >= 0; k--) gd.push(hp(-w2 - 0.5, -0.05, -d2 + house.d * k / 10));
    poly2(gd, f([0.52, 0.55, 0.74]), 0, 0.7);
    // warm light on the drift under the window
    const wb = hp((win.lx0 + win.lx1) / 2, 0.2, -d2 - 0.3);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    softDisc(wb[0], wb[1], window_.w * 1.6, [0.75, 0.38, 0.14], 0.55);
    ctx.restore();
  }

  function drawSmoke() {
    const sr = PRNG(seed + 404);
    ctx.save();
    const n = 90;
    for (let i = 0; i < n; i++) {
      const t = i / n;
      const rise = t * 560 * S;
      const r = (7 + 0.16 * rise) * S / S;
      const drift = (fbm(t * 3, 0.5, 2, seed + 41) - 0.5) * 30 * S * t + 18 * S * t * t;
      const x = smoke.x + drift + (sr() - 0.5) * r * 0.3, y = smoke.y - rise;
      const al = 0.12 * (1 - t) * (0.6 + 0.4 * sr()) * smooth(0, 0.05, t);
      softDisc(x, y, r * 1.2, [0.56, 0.58, 0.74], al);
      atx.fillStyle = acol(Math.PI / 2, 0); atx.globalAlpha = 0.25 * (1 - t);
      atx.beginPath(); atx.ellipse(x, y, r, r * 1.3, 0, 0, 7); atx.fill(); atx.globalAlpha = 1;
    }
    ctx.restore();
  }

  function drawHalo() {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const x = window_.x, y = window_.y;
    let g = ctx.createRadialGradient(x, y, window_.w * 0.3, x, y, 520 * S);
    g.addColorStop(0, 'rgba(255,150,70,0.20)'); g.addColorStop(0.3, 'rgba(200,100,60,0.06)'); g.addColorStop(1, 'rgba(120,70,80,0)');
    ctx.fillStyle = g; ctx.fillRect(x - 520 * S, y - 520 * S, 1040 * S, 1040 * S);
    g = ctx.createRadialGradient(x, y, window_.w * 0.2, x, y, 120 * S);
    g.addColorStop(0, 'rgba(255,170,90,0.42)'); g.addColorStop(0.45, 'rgba(255,120,50,0.12)'); g.addColorStop(1, 'rgba(255,110,40,0)');
    ctx.fillStyle = g; ctx.fillRect(x - 120 * S, y - 120 * S, 240 * S, 240 * S);
    ctx.restore();
  }

  // apples on the hero, the right-hand foreground tree and one in the alley
  const hero = trees.find(t => t.hero);
  hero.apples = true; addApples(hero, 4, 700 * S, 1600 * S, 0.032);
  const nearR = trees.filter(t => !t.hero && t.Z < 16 && t.bx > W * 0.6).sort((a, b) => a.Z - b.Z)[0];
  if (nearR) { nearR.apples = true; addApples(nearR, 2, 700 * S, 1300 * S, 0.033); }
  const mid = trees.filter(t => !t.hero && t.Z > 16 && t.Z < 26).sort((a, b) => a.Z - b.Z)[0];
  if (mid) { mid.apples = true; addApples(mid, 1, 800 * S, 1250 * S, 0.034); }
  // one fallen apple half-sunk in the snow near the hero's foot
  const fallen = { x: hero.bx + 0.75 * hero.ppm, y: hero.by + 0.25 * hero.ppm * cam.e / hero.Z * 4, r: 0.035 * hero.ppm };

  // ---------- draw objects far -> near
  const items = [];
  items.push({ Z: house.Z, f: () => { drawHouse(); drawSmoke(); } });
  items.push({ Z: house.Z - 0.5, f: drawHalo });
  for (const p of posts) items.push({ Z: p.Z, f: () => drawFencePost(p) });
  items.push({ Z: 54, f: drawRails });
  for (const T of trees) items.push({ Z: T.Z, f: () => drawTree(T) });
  for (const g of grasses) items.push({ Z: g.Z - 0.01, f: () => drawGrass(g) });
  items.push({ Z: 5.0, f: () => {
    ellipse2(fallen.x, fallen.y, fallen.r, fallen.r * 0.75, [0.32, 0.03, 0.06], 1, 0, 0.3);
    ellipse2(fallen.x - fallen.r * 0.3, fallen.y - fallen.r * 0.3, fallen.r * 0.4, fallen.r * 0.25, [0.55, 0.30, 0.42], 0.8, null);
    ellipse2(fallen.x, fallen.y + fallen.r * 0.55, fallen.r * 1.5, fallen.r * 0.4, [0.38, 0.42, 0.66], 1, 0, 0.5);
  } });
  // footprints of whoever walked home, filling with new snow
  {
    const fr = PRNG(seed + 808);
    let side = 1;
    for (let Z = 3.8; Z < Zdoor - 0.8; Z += 0.68 + (fr() - 0.5) * 0.1) {
      side = -side;
      const ZZ = Z, X = pathX(Z) + side * 0.12 + (fr() - 0.5) * 0.05;
      const fill = fr();
      items.push({ Z: ZZ, f: () => {
        const p = proj(X, 0, ZZ), ppm = cam.f / ZZ, fsh = cam.e / ZZ;
        const gi = (Math.min(H - 1, Math.round(p[1])) * W + Math.round(clamp(p[0], 0, W - 1))) * 4;
        const g = [D[gi] / 255, D[gi + 1] / 255, D[gi + 2] / 255];
        const al = 0.25 + 0.4 * fill;
        const wob = (fr() - 0.5) * 0.3;
        ellipse2(p[0] + wob * 0.03 * ppm, p[1] - 0.12 * ppm * fsh, 0.06 * ppm, 0.035 * ppm * fsh, [g[0] * 1.12, g[1] * 1.12, g[2] * 1.06], al * 0.9, 0, 0.8);
        ellipse2(p[0], p[1], 0.055 * ppm, 0.13 * ppm * fsh, [g[0] * 0.78, g[1] * 0.8, g[2] * 0.9], al, 0, 0.2);
        ellipse2(p[0] + wob * 0.02 * ppm, p[1] + 0.06 * ppm * fsh, 0.045 * ppm, 0.06 * ppm * fsh, [g[0] * 0.66, g[1] * 0.69, g[2] * 0.84], al, null);
      } });
    }
  }
  items.sort((a, b) => b.Z - a.Z);
  for (const it of items) it.f();

  // ---------- read back
  const cd = ctx.getImageData(0, 0, W, H).data, ad = atx.getImageData(0, 0, W, H).data;
  const tgt = new Float32Array(N * 3), aux = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    tgt[i * 3] = cd[i * 4] / 255; tgt[i * 3 + 1] = cd[i * 4 + 1] / 255; tgt[i * 3 + 2] = cd[i * 4 + 2] / 255;
    aux[i * 3] = (ad[i * 4] - 128) / 127; aux[i * 3 + 1] = (ad[i * 4 + 1] - 128) / 127; aux[i * 3 + 2] = ad[i * 4 + 2] / 255;
  }
  return { W, H, S, cam, proj, tgt, aux, trees, apples, grasses, window: window_, smoke, house, fallen, sceneCanvas: cC, posts };
}
