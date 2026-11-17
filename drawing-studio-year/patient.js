/* A YEAR, STILL WARM — re-colouring the patient layers.
 *
 * The strokes of sky, sea, hills, meadow, earth and bark never move. Each frame
 * every one of them is handed a new stick: the colour its own little patch of the
 * world has at this instant (its light, its season, its water, its snow), nudged
 * by the stroke's own temperament so that neighbours never agree exactly.
 */
'use strict';
const { c01, sstep, lerp, hash1, KX, KY, XC, HOR } = require('./clock.js');
const { PAPER, mix3 } = require('./look.js');

function createPatient(Wd, K, Lk, S) {
  const E = Wd.E, Sc = Wd.Sc, st = Lk.st, C = K.C, n = S.n, REG = Wd.REG, KIND = Wd.KIND;
  const cols = new Float32Array(n * 3);
  const { fbm, vnoise, hash2 } = E;

  // periodic value noise (closes after Px cells in x) for things that drift with the wind all year
  function pv(x, y, sd, Px) {
    const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy, ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
    const x0 = ((ix % Px) + Px) % Px, x1 = (x0 + 1) % Px;
    const a = hash2(x0, iy, sd), b = hash2(x1, iy, sd), c = hash2(x0, iy + 1, sd), d = hash2(x1, iy + 1, sd);
    return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
  }
  function pfbm(x, y, sd, Px) { return (0.5 * pv(x, y, sd, Px) + 0.3 * pv(x * 2, y * 2, sd + 17, Px * 2) + 0.2 * pv(x * 4, y * 4, sd + 34, Px * 4)); }
  // a drift that comes back to where it started when the year does
  const WT = C.Wint[K.F], WA = C.Wabs[K.F];
  function advect(cell, unitsPerWind, total) { const P = Math.max(1, Math.round(Math.abs(unitsPerWind * total) / cell)); return { P, k: P * cell / total, cell }; }
  const ADV = { deck: advect(300, 150, WT), ripple: advect(46, 30, WT), cshadow: advect(420, 230, WT), gust: advect(260, 330, WT) };

  // ---------- what each stroke knows about where it lives (computed once)
  const alt = new Float32Array(n), pn = new Float32Array(n), pn2 = new Float32Array(n), L0 = new Float32Array(n), wX = new Float32Array(n), wZ = new Float32Array(n),
    dNest = new Float32Array(n), dTrunk = new Float32Array(n), depth = new Float32Array(n), aux = new Float32Array(n), aux2 = new Float32Array(n), aux3 = new Float32Array(n), aux4 = new Float32Array(n);
  const wv = [0, 0];
  const TBX = 224.4, TBZ = 108.5;                 // the foot of the tree on the ground plane
  for (let i = 0; i < n; i++) {
    const x = S.x[i], y = S.y[i], r = S.reg[i];
    alt[i] = (HOR - y) / KY;
    if (r === REG.MEADOW || r === REG.PATH) {
      Sc.s2w(x, y, wv); wX[i] = wv[0]; wZ[i] = wv[1];
      pn[i] = fbm(wv[0] / 150, wv[1] / 150, 201, 3); pn2[i] = fbm(wv[0] / 34, wv[1] / 34, 202, 2);
      L0[i] = Sc.nestLight(x, y);
      dNest[i] = Math.hypot(wv[0], wv[1]); dTrunk[i] = Math.hypot(wv[0] - TBX, wv[1] - TBZ);
      depth[i] = c01((y - 610) / 330);            // 0 at the crest, 1 near
      aux[i] = fbm(x / 46, y / 15, 15, 3);        // the original's mottling of the meadow
    } else if (r === REG.TRUNK) {
      const ti = Sc.trunkInfo(x, y); aux[i] = ti.nx; aux2[i] = ti.ny; aux3[i] = fbm(x / 5, y / 26, 17, 3);
      let dx = Sc.NEST.x - x, dy = Sc.NEST.y - 14 - y; const dist = Math.hypot(dx, dy); dx /= dist; dy /= dist;
      const nz = Math.sqrt(Math.max(0, 1 - ti.nx * ti.nx - ti.ny * ti.ny));
      L0[i] = c01(0.72 * (ti.nx * dx + ti.ny * dy) + 0.30 * nz + 0.02) * 1.55 / (1 + (dist / 290) * (dist / 290));   // the original's light from the hollow
      aux4[i] = c01((y - 430) / 280);             // how far down the trunk
    } else if (r === REG.MID) {
      const top = Sc.midY(x), d = y - top; aux[i] = d; aux2[i] = Sc.treeLine(x); aux3[i] = fbm(x / 22, y / 7, 14, 2);
    } else if (r === REG.FAR) { aux[i] = fbm(x / 30, y / 6, 13, 2); aux2[i] = Sc.farH(x) > 0 ? c01((HOR - y) / Math.max(1, Sc.farH(x))) : 0; }
    else if (r === REG.WATER) { aux[i] = Sc.farH(x); aux2[i] = hash2(Math.round(x * 3), Math.round(y * 7), 33); }
    else if (r === REG.SKY) { aux[i] = fbm(x / 260, y / 80, 11, 3); }
  }

  // the shadow the tree throws (filled in by the tree each frame; design/6 grid over the land)
  const SHG = 6, shW = Math.ceil((Wd.X1 - Wd.X0) / SHG) + 2, shH = Math.ceil((Wd.Y1 - 540) / SHG) + 2, shadow = new Float32Array(shW * shH), shTmp = new Float32Array(shW * shH);
  function shadowAt(x, y) {
    const fx = (x - Wd.X0) / SHG, fy = (y - 540) / SHG; if (fy < 0 || fx < 0 || fx >= shW - 1 || fy >= shH - 1) return 0;
    const ix = fx | 0, iy = fy | 0, tx = fx - ix, ty = fy - iy, i = iy * shW + ix;
    return (shadow[i] * (1 - tx) + shadow[i + 1] * tx) * (1 - ty) + (shadow[i + shW] * (1 - tx) + shadow[i + shW + 1] * tx) * ty;
  }

  const o = [0, 0, 0], sk = [0, 0, 0], al = [0, 0, 0], q = [0, 0, 0];
  // seasonal albedos (what the thing is, before any light falls on it)
  const A_DORM = [0.60, 0.53, 0.38], A_FRESH = [0.55, 0.72, 0.30], A_DEEP = [0.25, 0.51, 0.25], A_DRY = [0.80, 0.74, 0.36], A_STRAW = [0.74, 0.60, 0.33], A_SNOW = [1.22, 1.21, 1.19],
    A_EARTH = [0.74, 0.57, 0.41], A_BARK = [0.58, 0.36, 0.29], A_FROST = [0.90, 0.95, 1.04], A_LITTER = [0.72, 0.36, 0.14];

  function ovcLocal(x, y, drift) {
    const oc = st.ovc; if (oc <= 0.002) return 0;
    const nn = pfbm((x - drift) / ADV.deck.cell, y / 140 + 3, 301, ADV.deck.P);
    return c01(oc * 1.9 - 0.9 * (1 - nn) * (1.6 - oc * 1.1) - 0.0) * (0.86 + 0.14 * nn) + 0;
  }
  function cloudShade(wx, drift) {
    // broad shadows of the fair-weather clouds sliding over the land
    const k = st.cum; if (k < 0.02 || st.direct < 0.02) return 0;
    const nn = pfbm((wx * 0.9 - drift) / ADV.cshadow.cell, 0.5, 311, ADV.cshadow.P);
    return sstep(0.62 - 0.3 * k, 0.86 - 0.2 * k, nn) * 0.6;
  }

  // ---------- the ground's own colour and light, shared with everything that grows on it
  const fs_ = { litter: 0, litterCol: A_LITTER, groundSun: 0, dCs: 0, dGust: 0, windAbs: 0 };
  function albedoGround(al, p1, p2, j3, dn, dt, kind, isPath, auxv) {
    if (!isPath) {
      // the grass wakes in patches, each stroke in its own time
      const nearNest = Math.exp(-(dn / 190) * (dn / 190));
      const th = 0.16 + 0.58 * (0.55 * p1 + 0.25 * p2 + 0.2 * j3) - 0.16 * nearNest;
      const gl = sstep(th - 0.14, th + 0.14, st.G);
      const ths = 0.22 + 0.6 * (0.5 * p1 + 0.5 * j3), sl = sstep(ths - 0.2, ths + 0.2, st.sen);
      const thd = 0.30 + 0.55 * (0.6 * p2 + 0.4 * j3) + 0.2 * Math.exp(-(dt / 260) * (dt / 260)), dl = sstep(thd - 0.2, thd + 0.2, st.dry);
      const mat = sstep(0.35, 0.92, st.Hg + 0.25 * (p2 - 0.5));
      al[0] = A_DORM[0]; al[1] = A_DORM[1]; al[2] = A_DORM[2];
      if (st.cal > 9.5 && st.cal < 16) mix3(al, A_STRAW, 1 - sstep(13.2, 15.5, st.cal), al);
      const live = gl * (1 - 0.92 * sl);
      q[0] = A_FRESH[0] + (A_DEEP[0] - A_FRESH[0]) * mat; q[1] = A_FRESH[1] + (A_DEEP[1] - A_FRESH[1]) * mat; q[2] = A_FRESH[2] + (A_DEEP[2] - A_FRESH[2]) * mat;
      mix3(q, A_DRY, dl * 0.62, q);
      // variety that belongs to the place: bluer in the damp hollows of the noise, yellower on the rises
      q[0] *= 0.86 + 0.28 * p1; q[2] *= 1.18 - 0.36 * p1;
      mix3(al, q, live, al);
      if (kind === KIND.PENCIL) { al[0] *= 1.04; al[1] *= 1.05; } else if (kind === KIND.CRAYON) { al[0] *= 0.93; al[1] *= 0.97; al[2] *= 1.04; }
      // pressed, paler grass in the hollow itself
      if (dn < 96) mix3(al, [0.80, 0.70, 0.36], 0.55 * sstep(96, 60, dn), al);
      const litter = fs_.litter;
      if (litter > 0.01) { const lk = litter * sstep(0.35, 0.8, 0.55 * p2 + 0.45 * j3 + 0.5 * Math.exp(-(dt / 240) * (dt / 240)) - 0.12 * (1 - litter)); mix3(al, fs_.litterCol, lk * 0.75, al); }
    } else {
      al[0] = A_EARTH[0] * (0.9 + 0.25 * auxv); al[1] = A_EARTH[1] * (0.9 + 0.25 * auxv); al[2] = A_EARTH[2] * (0.9 + 0.25 * auxv);
      // grass creeps in from the edges through the summer, and is worn or dies back again
      const creep = sstep(0.55, 0.95, st.Hg) * (1 - st.sen) * sstep(0.62, 0.82, p2 * 0.7 + j3 * 0.3);
      mix3(al, A_DEEP, creep * 0.55, al);
    }
    const wk = st.wet * (isPath ? 0.42 : 0.2); al[0] *= 1 - wk; al[1] *= 1 - wk * 0.9; al[2] *= 1 - wk * 0.75;
    if (st.frost > 0.01) mix3(al, A_FROST, c01(st.frost * (0.25 + 0.6 * p2 + 0.3 * j3)) * 0.6, al);
    return al;
  }
  // snow settles into the low places first and leaves the tufts till last; the hollow stays clear longest
  function snowCover(p1, p2, j3, dn, dt, lift, isPath) {
    const snowAmt = st.snow; if (snowAmt <= 0.002) return 0;
    const bias = 0.92 * Math.exp(-(dn / 118) * (dn / 118)) * (0.6 + 0.4 * st.glow) + 0.5 * Math.exp(-(dt / 46) * (dt / 46));
    const loc = snowAmt * (1 - c01(bias)) * (isPath ? 1.25 : 1);
    const thS = 0.025 + 0.50 * (0.60 * c01((p1 - 0.27) / 0.46) + 0.25 * p2 + 0.15 * j3) + lift - (isPath ? 0.05 : 0);
    return sstep(thS - 0.05, thS + 0.05, loc);
  }
  function lightGround(o, al, x, y, wXv, wZv, L0v, auxv, depthv) {
    const A = st.Av, Sn = st.Sv, G = st.Gv, fog = st.fogCol, fl = st.flashK;
    const sh = shadowAt(x, y), cs = cloudShade(wXv, fs_.dCs);
    const gustV = pv((wXv * 0.55 + wZv * 0.3 - fs_.dGust) / ADV.gust.cell, wZv / 300, 321, ADV.gust.P) - 0.5;
    const vis = (1 - sh) * (1 - cs);
    const sunK = fs_.groundSun * vis * (1 + 0.16 * gustV * Math.min(1, fs_.windAbs * 1.4));
    const Lg = L0v * (0.80 + 0.42 * auxv), gk = Lg * 2.1, amb = 1 - 0.28 * sh;
    const cr = al[0] * (Sn[0] * sunK + A[0] * amb + G[0] * gk + fl * 0.5) + G[0] * Lg * Lg * 0.62;
    const cg = al[1] * (Sn[1] * sunK + A[1] * amb + G[1] * gk + fl * 0.55) + G[1] * Lg * Lg * 0.60;
    const cb = al[2] * (Sn[2] * sunK + A[2] * amb + G[2] * gk + fl * 0.7) + G[2] * Lg * Lg * 0.42;
    Lk.grade(o, 0, cr, cg, cb);
    const vk = st.veil * (1 - depthv) * 0.55; o[0] += (fog[0] - o[0]) * vk; o[1] += (fog[1] - o[1]) * vk; o[2] += (fog[2] - o[2]) * vk;
    return o;
  }
  // a coarse memory of what colour the ground is this frame (for things that stand on it)
  const GCS = 8, gcW = Math.ceil((Wd.X1 - Wd.X0) / GCS) + 1, gcH = Math.ceil((Wd.Y1 - 590) / GCS) + 1, gc = new Float32Array(gcW * gcH * 4);
  function gcIndex(x, y) { const gx = ((x - Wd.X0) / GCS) | 0, gy = ((y - 590) / GCS) | 0; return gx < 0 || gy < 0 || gx >= gcW || gy >= gcH ? -1 : gy * gcW + gx; }
  function groundCol(x, y, o) {
    let gi = gcIndex(x, Math.max(592, y));
    if (gi < 0 || gc[gi * 4 + 3] === 0) { o[0] = 0.3; o[1] = 0.4; o[2] = 0.3; if (gi >= 0) for (let d = 1; d < 4; d++) { const g2 = gi + d * gcW; if (g2 < gcW * gcH && gc[g2 * 4 + 3] > 0) { gi = g2; break; } } if (gi < 0 || gc[gi * 4 + 3] === 0) return o; }
    const k = 1 / gc[gi * 4 + 3]; o[0] = gc[gi * 4] * k; o[1] = gc[gi * 4 + 1] * k; o[2] = gc[gi * 4 + 2] * k; return o;
  }

  function update(tree) {
    const f = st.f, A = st.Av, Sn = st.Sv, G = st.Gv, ink = st.INK;
    const Wi = C.Wint[f];
    const dDeck = Wi * ADV.deck.k, dRip = Wi * ADV.ripple.k, dCs = Wi * ADV.cshadow.k, dGust = Wi * ADV.gust.k;
    const ly = Math.max(0, st.ly), back = Math.max(0, -st.lz) * sstep(0, 22, st.alt) * sstep(40, 12, st.alt);
    const groundSun = 0.52 + 0.48 * Math.pow(ly, 0.7) + 0.22 * back + 0.16 * Math.max(0, st.lz) * sstep(30, 5, st.alt);   // standing grass catches a low sun full on
    const snowAmt = st.snow, wet = st.wet, frost = st.frost, veil = st.veil, fog = st.fogCol;
    fs_.litter = tree ? tree.litterAmt : 0; fs_.litterCol = tree ? tree.litterCol : A_LITTER; fs_.groundSun = groundSun; fs_.dCs = dCs; fs_.dGust = dGust; fs_.windAbs = Math.abs(st.wind);
    gc.fill(0);
    const gph = (st.tau * 1.5), g0 = Math.floor(gph), gt = gph - g0, gu = gt * gt * (3 - 2 * gt), GP = Math.round(K.DUR * 1.5);
    const glitI = st.direct * sstep(-2, 2, st.alt) * sstep(48, 20, st.alt) + 0.5 * st.moonI * sstep(0, 6, st.moonAlt);
    const glitX = st.direct > 0.02 && st.alt > -2 ? st.sx : st.moonX;
    const glitCol = st.direct > 0.02 && st.alt > -2 ? st.sunCol : [0.8, 0.88, 1.0];
    const moonLift = st.moonI * 0.10;
    const windAbs = Math.abs(st.wind);
    const fl = st.flashK;

    for (let i = 0; i < n; i++) {
      const x = S.x[i], y = S.y[i], r = S.reg[i], kind = S.kind[i];
      const j0 = S.j0[i] - 0.5, j1 = S.j1[i] - 0.5, j2 = S.j2[i] - 0.5, j3 = S.j3[i];
      let cr, cg, cb, lj = 0.07, hj = 0.05;

      if (r === REG.SKY) {
        const oc = ovcLocal(x, y, dDeck);
        Lk.skyAt(x, y + 14 * (aux[i] - 0.5), sk, oc);
        cr = sk[0]; cg = sk[1]; cb = sk[2];
        if (kind === KIND.DUST) { lj = 0.03; hj = 0.02; } else { lj = 0.075; hj = 0.06; }
      }
      else if (r === REG.WATER) {
        const dyw = y - HOR;
        Lk.skyAt(x + 5 * Math.sin(y * 1.3), HOR - dyw * 2.4 - 6, sk, st.ovc);
        // the sea keeps a little of its own colour
        const day = st.day;
        cr = sk[0] * 0.80 + 0.03 + 0.02 * day; cg = sk[1] * 0.82 + 0.05 + 0.03 * day; cb = sk[2] * 0.86 + 0.09 + 0.03 * day;
        if (aux[i] > 0 && dyw < aux[i] * 0.95) { cr += (0.27 * (0.4 + 0.6 * day) - cr) * 0.5; cg += (0.28 * (0.4 + 0.6 * day) - cg) * 0.5; cb += (0.52 * (0.5 + 0.5 * day) - cb) * 0.5; }
        const rp = pv((x - dRip) / 46, y / 1.9, 21, ADV.ripple.P) - 0.5, ra = 0.08 + 0.10 * st.rough;
        cr += rp * ra; cg += rp * ra; cb += rp * ra * 0.8;
        if (st.rough > 0.3) { const k = (st.rough - 0.3) * 0.5; cr += (0.36 - cr) * k; cg += (0.42 - cg) * k; cb += (0.52 - cb) * k * 0.6; }
        if (glitI > 0.01) {
          const gw = (x - glitX) / (22 + dyw * 1.5), gl = Math.exp(-gw * gw);
          if (gl > 0.02) {
            const ix = Math.round(x / 4), iy = Math.round(y * 1.2);
            const nz = lerp(hash2(ix, iy, 400 + (g0 % GP)), hash2(ix, iy, 400 + ((g0 + 1) % GP)), gu);
            const sp = sstep(0.50 - 0.16 * gl, 0.62 - 0.16 * gl, nz) * gl * 0.9 * c01(glitI);
            cr += (0.99 * glitCol[0] + 0.01 - cr) * sp; cg += (0.93 * glitCol[1] + 0.03 - cg) * sp; cb += (0.72 * glitCol[2] + 0.05 - cb) * sp;
          }
        }
        const vk = veil * (0.55 + 0.45 * c01(1 - dyw / 70));
        cr += (fog[0] - cr) * vk; cg += (fog[1] - cg) * vk; cb += (fog[2] - cb) * vk;
        lj = 0.06; hj = 0.04;
      }
      else if (r === REG.FAR) {
        // the far shore: its own colour for the season, lit, then mostly given back to the air
        const sno = sstep(0.05, 0.35, snowAmt + 0.25 * (aux2[i] - 0.5));
        const warm = st.warm, au = sstep(0.3, 1.0, st.AP) * (1 - sno);
        al[0] = lerp(0.42, 0.30, warm) + 0.18 * au; al[1] = lerp(0.44, 0.50, warm) - 0.06 * au; al[2] = lerp(0.46, 0.42, warm) - 0.08 * au;
        mix3(al, A_SNOW, sno * 0.85, al);
        const lit = 0.35 + 0.65 * ly + 0.15 * Math.max(0, st.lz);
        cr = al[0] * (Sn[0] * lit + A[0]); cg = al[1] * (Sn[1] * lit + A[1]); cb = al[2] * (Sn[2] * lit + A[2]);
        Lk.grade(o, 0, cr, cg, cb);
        Lk.skyAt(x, HOR - 3, sk, st.ovc);
        const ap = 0.44 + 0.3 * veil;
        cr = o[0] + (sk[0] - o[0]) * ap + 0.1 * (aux[i] - 0.5); cg = o[1] + (sk[1] - o[1]) * ap + 0.1 * (aux[i] - 0.5); cb = o[2] + (sk[2] - o[2]) * ap + 0.1 * (aux[i] - 0.5);
        cr += (fog[0] - cr) * veil * 0.85; cg += (fog[1] - cg) * veil * 0.85; cb += (fog[2] - cb) * veil * 0.85;
        lj = 0.05; hj = 0.04;
      }
      else if (r === REG.MID) {
        const d = aux[i], tl = aux2[i], warm = st.warm, au = sstep(0.25, 0.95, st.AP + 0.2 * (aux3[i] - 0.5));
        const sp = sstep(0.1, 0.9, st.SP), lf = sp * (1 - sstep(0.5, 1.3, st.D));
        // bare wood -> spring haze -> summer dark -> autumn -> bare
        al[0] = 0.33; al[1] = 0.30; al[2] = 0.36;
        mix3(al, [0.34, 0.56, 0.30], lf * (1 - sstep(0.6, 1.15, st.SP)), al); mix3(al, [0.15, 0.37, 0.27], lf * sstep(0.6, 1.15, st.SP), al);
        mix3(al, [0.56, 0.36, 0.18], au * lf, al);
        const tree = d < tl + 1.5 ? 1 : 0;
        if (tree) { al[0] *= 0.62; al[1] *= 0.66; al[2] *= 0.74; }
        const sno = sstep(0.04, 0.4, snowAmt * (tree ? 0.55 : 1.15) + 0.3 * (aux3[i] - 0.5)) * (snowAmt > 0.002 ? 1 : 0);
        mix3(al, A_SNOW, sno, al);
        const top = 1 - sstep(0, 9, d), lit = (0.32 + 0.68 * ly) * (0.8 + 0.5 * top) + 0.2 * back * top;
        cr = al[0] * (Sn[0] * lit + A[0] * (0.85 + 0.3 * top)); cg = al[1] * (Sn[1] * lit + A[1] * (0.85 + 0.3 * top)); cb = al[2] * (Sn[2] * lit + A[2] * (0.85 + 0.3 * top));
        Lk.grade(o, 0, cr, cg, cb); cr = o[0]; cg = o[1]; cb = o[2];
        // the last of the day catching the crest
        const dxg = (x - st.sx) / 300, rim = Math.exp(-dxg * dxg) * top * sstep(8, 0, Math.abs(st.alt + 1)) * (st.pm ? 1 : 0) * (1 - st.ovc);
        cr += (0.69 - cr) * rim * 0.3; cg += (0.38 - cg) * rim * 0.3; cb += (0.55 - cb) * rim * 0.3;
        const ap = 0.16 + 0.55 * veil; cr += (fog[0] - cr) * ap * (0.3 + 0.7 * veil); cg += (fog[1] - cg) * ap * (0.3 + 0.7 * veil); cb += (fog[2] - cb) * ap * (0.3 + 0.7 * veil);
        const k = 0.07 * (aux3[i] - 0.5); cr += k; cg += k; cb += k;
        lj = 0.05; hj = 0.04;
      }
      else if (r === REG.MEADOW || r === REG.PATH) {
        const isPath = r === REG.PATH;
        albedoGround(al, pn[i], pn2[i], j3, dNest[i], dTrunk[i], kind, isPath, aux[i]);
        if (snowAmt > 0.002) {
          const cv = snowCover(pn[i], pn2[i], j3, dNest[i], dTrunk[i], kind === KIND.PENCIL ? 0.05 : 0, isPath);
          // lying snow is not one white: the hollows of the drifts are a shade bluer
          if (cv > 0) { const lo = 1 - 0.13 * sstep(0.62, 0.3, pn[i]) - 0.05 * (pn2[i] - 0.5); q[0] = A_SNOW[0] * lo * (0.985 - 0.02 * (1 - lo) * 6); q[1] = A_SNOW[1] * lo; q[2] = A_SNOW[2] * (lo + (1 - lo) * 0.75); mix3(al, q, cv, al); }
        }
        lightGround(o, al, x, y, wX[i], wZ[i], L0[i], aux[i], depth[i]);
        cr = o[0]; cg = o[1]; cb = o[2];
        lj = 0.075; hj = 0.07;
        if (kind >= KIND.CRAYON && kind <= KIND.PENCIL) { const gi = gcIndex(x, y); if (gi >= 0) { gc[gi * 4] += cr; gc[gi * 4 + 1] += cg; gc[gi * 4 + 2] += cb; gc[gi * 4 + 3] += 1; } }
      }
      else { // TRUNK
        const nx = aux[i], ny = aux2[i], nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
        let ndl = nx * st.lx - ny * st.ly + nz * st.lz; ndl = ndl < 0 ? 0 : ndl;
        const under = tree ? tree.leafCover : 0;
        const vis = 1 - 0.55 * under * sstep(15, 50, st.alt) * (0.6 + 0.4 * (1 - aux4[i]));
        al[0] = A_BARK[0]; al[1] = A_BARK[1]; al[2] = A_BARK[2];
        const wk = wet * 0.32; al[0] *= 1 - wk; al[1] *= 1 - wk; al[2] *= 1 - wk * 0.8;
        // a little moss low on the weather side in the growing months
        const moss = sstep(0.55, 1, aux4[i]) * c01(nx * 0.8 + 0.3) * st.G * (1 - st.sen) * 0.3; mix3(al, [0.34, 0.5, 0.26], moss, al);
        // snow plastered on the windward side and the tops of the limbs
        if (st.snowB > 0.02) { const up = c01(-ny * 1.2 - 0.15 + 0.5 * (j3 - 0.5)) , ww = c01((st.windBase < 0 ? nx : -nx) * 0.9 - 0.2); mix3(al, A_SNOW, c01(st.snowB * 1.6 * Math.max(up, ww * sstep(0.5, 1.0, Math.abs(st.windBase))) - 0.1), al); }
        const tex = 1 + 0.32 * (aux3[i] - 0.5);
        const Lg = L0[i] * 1.5;
        const bz = st.bounce * c01(0.5 + ny * 0.8);
        cr = al[0] * tex * (Sn[0] * (0.15 + 0.95 * ndl) * vis + A[0] * (0.75 + 0.35 * nz) + G[0] * Lg + bz + fl * 0.5) + G[0] * Lg * Lg * 0.10;
        cg = al[1] * tex * (Sn[1] * (0.15 + 0.95 * ndl) * vis + A[1] * (0.75 + 0.35 * nz) + G[1] * Lg + bz + fl * 0.55) + G[1] * Lg * Lg * 0.08;
        cb = al[2] * tex * (Sn[2] * (0.15 + 0.95 * ndl) * vis + A[2] * (0.75 + 0.35 * nz) + G[2] * Lg + bz * 1.2 + fl * 0.7);
        Lk.grade(o, 0, cr, cg, cb); cr = o[0]; cg = o[1]; cb = o[2];
        // the cool edge the original gave the far side of the trunk
        const cool = c01((nx * 0.95 - ny * 0.3) - 0.45) * 0.5 * (1 - st.day * 0.6);
        cr += (0.2 - cr) * cool; cg += (0.28 - cg) * cool; cb += (0.55 - cb) * cool;
        const vk = veil * 0.16; cr += (fog[0] - cr) * vk; cg += (fog[1] - cg) * vk; cb += (fog[2] - cb) * vk;
        lj = 0.07; hj = 0.05;
      }

      // the stroke's own temperament, then the nearest sticks
      const dk = S.dk[i];
      if (kind === KIND.LINE) { cr *= dk; cg *= dk + 0.02; cb *= dk + 0.05; }
      else if (kind <= KIND.UCRAY) {
        // the first bright layer: paler, sunnier, meant to be buried and to glint through
        const lum = 0.3 * cr + 0.5 * cg + 0.2 * cb, wk = sstep(0.12, 0.6, lum);
        cr = (cr * 0.55 + 0.30) + (1.0 - cr * 0.55 - 0.30) * wk * 0.7; cg = (cg * 0.6 + 0.33) + (0.92 - cg * 0.6 - 0.33) * wk * 0.7; cb = (cb * 0.6 + 0.42) + (0.56 - cb * 0.6 - 0.42) * wk * 0.7;
      }
      const l = j0 * 2 * lj;
      Lk.crayon(cr + l + j1 * hj, cg + l + j2 * hj * 0.7, cb + l - j1 * hj, cols, i * 3);
    }
    return cols;
  }

  return { cols, update, shadow, shTmp, shW, shH, SHG, shadowAt, pv, pfbm, ADV, advect, ovcLocal, albedoGround, snowCover, lightGround, groundCol, cloudShade, A_SNOW, fs: fs_ };
}

module.exports = { createPatient };
