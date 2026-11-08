/* Monsoon Rooftops — a dense Indian city at monsoon dusk, seen from a high roof.
 *
 * Native 432 x 540, 49-colour palette, shown at x5 (2160 x 2700) with nearest-neighbour.
 * The city is a few hundred boxes in a real perspective (eye 26 m up, focal 380 px), drawn
 * far to near. Each box is lit by a low sun slipping under the cloud deck (front faces in cool
 * shade, left-facing walls warm), fogged into the horizon haze, and every colour is snapped to
 * the palette once per surface so faces stay flat, clean clusters. Roof slabs are wet and mirror
 * the sky. Clutter (tanks, stair rooms, dishes, laundry, plants, people) is drawn by small
 * scale-aware pixel routines that simplify themselves as they shrink with distance.
 */
(function () {
  'use strict';
  const { fl, clamp, lerp, sstep, mulberry32, ih, vn2, fbm, bayer, Palette, Surface, rampPick, despeckle } = PX;

  const W = 432, H = 540;
  const HY = 214, F = 380, CX = 216, EYE = 26;
  const SUNX = 184, SUNY = HY - 4;
  const sq = (v) => v * v;

  const PAL = Palette([
    ['k0', '07070d'], ['k1', '110f1c'], ['k2', '1b1829'], ['k3', '27223a'], ['k4', '352f4c'], ['k5', '463f60'], ['k6', '5b5276'], ['k7', '75698b'],
    ['h0', '93819a'], ['h1', 'b2949f'], ['h2', 'cfa69d'], ['h3', 'e6bb97'], ['h4', 'f5d39c'], ['h5', 'ffeab9'], ['h6', 'fffbea'],
    ['o0', '7e3533'], ['o1', 'b8553b'], ['o2', 'e47f47'], ['o3', 'f6aa5c'],
    ['m0', '4f1534'], ['m1', '871c50'], ['m2', 'c22d6d'], ['m3', 'ea64a0'], ['r1', 'a82b2c'],
    ['y0', '5e4520'], ['y1', '9c7a2e'], ['y2', 'dcae3c'],
    ['g0', '0e1a15'], ['g1', '193121'], ['g2', '284b2f'], ['g3', '43703c'], ['g4', '7a9e52'],
    ['t0', '13293a'], ['t1', '1d4556'], ['t2', '2f6c7a'], ['t3', '5a9fa2'], ['b0', '1d2f6e'], ['b1', '3157a8'],
    ['c0', '2b2125'], ['c1', '443536'], ['c2', '64504c'], ['c3', '876f66'], ['c4', 'ab9585'],
    ['p0', '8f5d6c'], ['p1', 'c08c94'], ['w0', 'c6bfc6'], ['w1', 'e9e5ea'], ['l0', 'ffc95a'], ['l1', 'c9ecd9'],
  ]);
  const C = PAL.C, P = PAL.P;
  const rgbOf = (i) => P[i];

  let S, R;
  const proj = (X, Y, Z) => [CX + F * X / Z, HY + F * (EYE - Y) / Z];
  const fogT = (z) => clamp(1 - Math.exp(-(z - 6) / 300), 0, 0.9);
  const VIOLET = [58, 46, 80];
  let HAZE = []; // per column haze colour (rgb)
  const hzA = (x) => HAZE[clamp(Math.round(x), 0, W - 1)];

  // haze colour: deep violet dusk air nearby, the glowing horizon far away
  function hazeAt(sx, z) { const h = hzA(sx), k = Math.max(sstep(90, 420, z), Math.exp(-sq((sx - SUNX) / 75)) * sstep(25, 220, z) * 0.85); return [lerp(VIOLET[0], h[0], k), lerp(VIOLET[1], h[1], k), lerp(VIOLET[2], h[2], k)]; }
  function shade(base, L, z, sx) {
    const t = fogT(z), hz = hazeAt(sx, z);
    return PAL.snap(lerp(base[0] * L[0], hz[0], t), lerp(base[1] * L[1], hz[1], t), lerp(base[2] * L[2], hz[2], t));
  }
  const L_FRONT = [0.4, 0.36, 0.5], L_SHADOW = [0.26, 0.25, 0.38], L_TOP = [0.42, 0.4, 0.52];
  const L_SUN = [1.12, 0.84, 0.6];
  const PAINTS = [
    [214, 206, 200], [206, 142, 150], [118, 168, 198], [78, 160, 158], [150, 188, 128], [214, 172, 84],
    [176, 96, 74], [160, 140, 188], [136, 130, 130], [226, 214, 170], [196, 120, 160], [96, 140, 196], [230, 190, 150],
  ];
  const PAINTW = [2.2, 2.6, 2.2, 2, 1.6, 2.2, 1.6, 1.3, 1.6, 2, 1.2, 1.3, 1.8];
  const FABRIC = ['m2', 'y2', 't3', 'r1', 'b1', 'g3', 'w1', 'o2', 'm3', 'p1', 'w0', 'b0', 'm1', 'o3', 'g4'];
  function wpick(rnd, ws) { let s = 0; for (const w of ws) s += w; let r = rnd() * s; for (let i = 0; i < ws.length; i++) { r -= ws[i]; if (r <= 0) return i; } return ws.length - 1; }

  /* =================================================================== sky */
  let CLOUD;
  let SKY; // copy of the sky pass (indices) for reflections
  const cloudBase = (x) => 138 + 26 * (vn2(x / 70, 3.3, 12) - 0.5) - 34 * Math.exp(-sq((x - SUNX - 10) / 80)) + 8 * sstep(300, 420, x) + 14 * sstep(90, 0, x);
  function billow(x, y) {
    const qx = fbm(x / 90, y / 40, 3, 11) - 0.5, qy = fbm(x / 90 + 5.2, y / 40 + 1.3, 3, 12) - 0.5;
    return fbm(x / 120 + qx * 1.4, y / 46 + qy * 1.1, 5, 101);
  }
  function deck(x, y) {
    const cb = cloudBase(x);
    return billow(x, y) + 0.62 * (1 - sstep(cb - 70, cb + 8, y)) - 0.3;
  }
  function strat(x, y) {
    const n = fbm(x / 150 + 1.3, y / 4.2, 4, 303);
    const band = Math.exp(-sq((y - 186) / 9)) * 0.92 + Math.exp(-sq((y - 201) / 4)) * 0.6;
    return n * band * (1 - 0.5 * Math.exp(-sq((x - SUNX) / 30)));
  }
  function frag(x, y) {
    const n = fbm(x / 64 + 9.1, y / 10, 4, 404);
    const B = Math.exp(-sq((y - 170) / 14)) * (0.6 + 0.5 * vn2(x / 70, 0.5, 41));
    return 0.5 + (n - 0.55) + 0.06 * B - 0.4 * (1 - Math.min(1, B)) - 0.2 * Math.exp(-sq((x - SUNX) / 26) - sq((y - SUNY) / 30));
  }
  const CLEAR = ['k3', 'k4', 'k5', 'k6', 'p0', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'].map((k) => C[k]);
  const BODY = ['k0', 'k1', 'k2', 'k3', 'k4', 'k5', 'k6', 'k7', 'p0', 'h1', 'p1', 'h2'].map((k) => C[k]);
  const FIRE = ['k1', 'k2', 'k3', 'm0', 'o0', 'o1', 'o2', 'o3', 'h4', 'h5', 'h6'].map((k) => C[k]);
  function drawSky() {
    const YB = HY + 40;
    const cloud = new Uint8Array(W * (YB + 1));
    // ---- the deck as billows: sphere-lit lumps, upper ones first, the hanging underside drawn over them
    const BV = new Float32Array(W * (YB + 1)).fill(-1), BL = new Float32Array(W * (YB + 1));
    const rb = mulberry32(2024), bl = [];
    for (let k = 0; k < 90; k++) { const x = -40 + rb() * 512, r = 16 + rb() * 18; bl.push([x, -30 + rb() * (cloudBase(x) - r * 0.7 + 30), r]); }
    for (let k = 0; k < 120; k++) { const x = -20 + rb() * 472, r = 6 + rb() * 10; bl.push([x, cloudBase(x) - r * (0.1 + rb() * 0.9), r]); }
    for (let k = 0; k < 40; k++) { const x = rb() * 432, r = 3 + rb() * 3.5; bl.push([x, cloudBase(x) - rb() * 10, r]); }
    bl.sort((p, q) => (p[1] + p[2]) - (q[1] + q[2]));
    for (const [bx, by, br] of bl) {
      const sx = SUNX - bx, sy = SUNY + 24 - by, sl = Math.hypot(sx, sy, 60);
      const lx = sx / sl, ly = sy / sl, lz = 60 / sl;
      const low = sstep(10, 150, by + br);
      const near = Math.exp(-sq((bx - SUNX) / 190));
      const seed = (bx * 13 + by * 7) | 0;
      for (let y = Math.max(0, Math.floor(by - br)); y <= Math.min(YB, by + br); y++) for (let x = Math.max(0, Math.floor(bx - br * 2)); x < Math.min(W, bx + br * 2); x++) {
        const ax = (x + 0.5 - bx) / 1.75, ay = (y + 0.5 - by) * 1.1, ang = Math.atan2(ay, ax);
        const re = br * (1 + 0.16 * (vn2(ang * 2.2 + 9, seed, 5) - 0.5) + 0.1 * (vn2(ang * 6 + 3, seed, 6) - 0.5));
        const d = Math.hypot(ax, ay) / re;
        if (d >= 1) continue;
        const i = y * W + x;
        const nz = Math.sqrt(1 - d * d);
        let nx = ax / re, ny = ay / re;
        nx += (fbm(x / 7, y / 7, 2, 31) - 0.5) * 0.5; ny += (fbm(x / 7 + 4, y / 7, 2, 32) - 0.5) * 0.5;
        const dot = Math.max(0, nx * lx + ny * ly + nz * lz * 0.3);
        const lit = Math.pow(dot, 1.6) * (0.3 + 0.7 * low * low) * (0.5 + 0.5 * near);
        let v = 0.1 + 0.2 * low + 0.05 * nz + lit * 0.7;
        if (d > 0.9 && BV[i] >= 0 && low > 0.7 && ih(x, y, 77) < 0.85) v -= 0.06;
        v += (fbm(bx / 60, by / 30, 2, 88) - 0.5) * 0.18 * (1 - low); // crevice where this lump overlaps the one behind
        BV[i] = clamp(v, 0, 1); BL[i] = low > 0.72 ? lit : Math.min(lit, 0.3);
      }
    }
    for (let y = 0; y <= YB; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const dsun = Math.hypot((x - SUNX) / 2.6, (y - SUNY) * 1.0);
      const fire = Math.exp(-sq((x - SUNX) / 175) - sq((y - SUNY) / 110));
      // clear sky: violet overhead, rose then gold toward the sun
      let v = 0.08 + 0.4 * Math.pow(clamp(y / HY, 0, 1), 2.2) + 0.42 * Math.exp(-dsun / 55) + 0.03 * Math.exp(-dsun / 14);
      let c = rampPick(CLEAR, clamp(v, 0, 1), x, y, 4);
      if (BV[i] >= 0 && y < HY - 4) {
        const v = BV[i], lit = BL[i];
        if (fire > 0.14 && lit > 0.36) c = rampPick(FIRE, clamp(0.1 + v * (0.6 + 0.5 * fire), 0, 1), x, y, 99);
        else c = rampPick(BODY, clamp(v, 0, 1), x, y, 99);
        cloud[i] = 1;
      } else if (frag(x, y) > 0.5 && y < HY - 3) {
        // torn scud in the gap, lit hard from below
        let dist = 12;
        for (let k = 1; k <= 12; k++) if (frag(x - (x - SUNX) / 300 * k, y + k) <= 0.5) { dist = k; break; }
        const lit = Math.exp(-dist / 2.5);
        const sv = 0.18 + lit * (0.5 + 0.5 * fire) + 0.12 * fire;
        c = fire > 0.12 ? rampPick(FIRE, clamp(sv, 0, 1), x, y, 99) : rampPick(BODY, clamp(sv * 0.85 + 0.15, 0, 1), x, y, 99);
        cloud[i] = 3;
      } else {
        const st = strat(x, y);
        if (st > 0.47 && y < HY - 2) {
          const under = clamp((0.47 - strat(x, y + 2)) * 8, 0, 1);
          const sv = 0.35 + 0.35 * fire + under * 0.3 * (0.4 + fire);
          c = fire > 0.25 ? rampPick(FIRE, clamp(sv, 0, 1), x, y, 99) : rampPick(BODY, clamp(sv * 0.9, 0, 1), x, y, 99);
          cloud[i] = 2;
        }
      }
      S.px(x, y, c);
    }
    despeckle(S, (x, y) => y <= HY && cloud[y * W + x] > 0, 3);
    CLOUD = cloud;
    // sun, half-sunk into the haze
    S.ellipse(SUNX + 0.5, SUNY - 2, 9.5, 9, C.h6);
    SKY = S.buf.slice();
    for (let x = 0; x < W; x++) {
      let r = 0, g = 0, b = 0;
      for (let y = HY - 9; y < HY - 1; y++) { const p = P[SKY[y * W + x]]; r += p[0]; g += p[1]; b += p[2]; }
      HAZE[x] = [r / 8 * 0.82, g / 8 * 0.8, b / 8 * 0.86];
    }
  }
  const skyAt = (x, y) => P[SKY[clamp(y | 0, 0, HY) * W + clamp(x | 0, 0, W - 1)]];

  /* =================================================================== far city */
  function drawFarBands(lo, hi) {
    const layers = [{ z: 1400, seed: 5, hm: 34 }, { z: 900, seed: 6, hm: 40 }, { z: 600, seed: 7, hm: 38 }, { z: 420, seed: 8, hm: 30 }];
    for (const L of layers) {
      if (L.z < lo || L.z > hi) continue;
      const rnd = mulberry32(L.seed * 7777);
      let X = -0.62 * L.z - 30;
      while (X < 0.62 * L.z + 30) {
        const w = 8 + rnd() * 26;
        const clearOf = (sx) => Math.abs(sx - SUNX) > 45 && Math.abs(sx - 356) > 42 && Math.abs(sx - 140) > 30;
        let h = 8 + rnd() * 16 + (rnd() < 0.12 && clearOf(CX + F * X / L.z) ? rnd() * L.hm * 2 : 0);
        if (L.z >= 900 && rnd() < 0.035 && clearOf(CX + F * X / L.z)) h = 45 + rnd() * 40; // a few towers on the far edge
        const [xa, ya] = proj(X, h, L.z), [xb] = proj(X + w, h, L.z), [, yb] = proj(X, 0, L.z);
        const t = fogT(L.z * 0.55);
        const base = [70, 62, 92];
        for (let x = Math.round(xa); x < Math.round(xb); x++) {
          const hz = hzA(x);
          const c = PAL.snap(lerp(base[0], hz[0], t), lerp(base[1], hz[1], t), lerp(base[2], hz[2], t));
          for (let y = Math.round(ya); y < Math.round(yb) + 2; y++) S.px(x, y, c);
          if (L.z <= 600 && ih(x, L.seed, 3) < 0.05) { // a lit window or two in the haze
            const wy = Math.round(ya) + 1 + fl(ih(x, 9, L.seed) * Math.max(1, yb - ya - 2));
            S.px(x, wy, ih(x, 2, 2) < 0.6 ? C.h4 : C.l1);
          }
        }
        X += w + (rnd() < 0.2 ? rnd() * 10 : 0);
      }
    }
  }

  /* =================================================================== landmarks */
  // stamp a sprite, then light its contour: pixels whose neighbour toward the light is empty take the rim colour
  function litSprite(x0, y0, rows, map, side, rimC, rimKeys, topC, flip) {
    const R = flip ? rows.map((r) => r.split('').reverse().join('')) : rows;
    const hit = (i, j) => j >= 0 && j < R.length && i >= 0 && i < R[j].length && R[j][i] !== '.' && R[j][i] !== ' ';
    S.sprite(x0, y0, R, map);
    for (let j = 0; j < R.length; j++) for (let i = 0; i < R[j].length; i++) {
      if (!hit(i, j) || (rimKeys && !rimKeys.includes(R[j][i]))) continue;
      if (rimC !== undefined && !hit(i + side, j)) S.px(x0 + i, y0 + j, rimC);
      else if (topC !== undefined && !hit(i, j - 1)) S.px(x0 + i, y0 + j, topC);
    }
  }

  function drawTemple(cx, baseY, Z) {
    // Nagara temple: curvilinear shikhara with ridged courses and facets, side spires, a stepped mandapa
    const stone = [214, 176, 150];
    const cLit = shade(stone, [1.25, 1.0, 0.82], Z, cx), cMid = shade(stone, [0.6, 0.52, 0.62], Z, cx), cSh = shade(stone, [0.42, 0.38, 0.52], Z, cx);
    const cDk = shade(stone, [0.3, 0.27, 0.4], Z, cx);
    const tower = (tx, top, Ht, Wb) => {
      for (let y = top; y < baseY; y++) {
        const t = Math.min(1, (y - top) / Ht);
        const hw = 1.5 + (Wb - 1.5) * Math.pow(Math.sin(Math.min(1, t * 1.08) * Math.PI / 2), 0.8);
        const course = (y - top) % 4 === 3;
        const xl = Math.round(tx - hw - (course ? 0.6 : 0)), xr = Math.round(tx + hw + (course ? 0.6 : 0));
        for (let x = xl; x <= xr; x++) {
          const u = (x - tx) / (hw + 0.01);
          let c = u > 0.55 ? cLit : u > -0.15 ? cMid : cSh;
          if (Math.abs(u - 0.2) < 0.12 || Math.abs(u + 0.5) < 0.1) c = c === cLit ? cMid : cDk; // facet edges
          if (course) c = u > 0.55 ? cMid : cDk;
          if (x === xr && !course) c = cLit;
          S.px(x, y, c);
        }
      }
      // amalaka, kalasha
      const aw = Math.round(Wb * 0.3) + 2;
      S.hline(Math.round(tx - aw), Math.round(tx + aw), top - 1, cMid);
      for (let x = Math.round(tx - aw); x <= Math.round(tx + aw); x += 2) S.px(x, top - 1, cDk);
      S.px(Math.round(tx + aw), top - 1, cLit);
      S.hline(Math.round(tx - aw + 1), Math.round(tx + aw - 1), top - 2, cSh);
      S.hline(Math.round(tx - aw + 1), Math.round(tx + aw - 1), top, cDk);
      S.px(Math.round(tx), top - 3, C.y1); S.px(Math.round(tx), top - 4, C.y2);
      return [Math.round(tx), top - 4];
    };
    // mandapa: stepped pyramid roof in front, left
    const mx = cx - 19, mTop = baseY - 22;
    for (let y = mTop; y < baseY; y++) {
      const t = (y - mTop) / 22, hw = 2 + 13 * t;
      const step = (y - mTop) % 3 === 2;
      for (let x = Math.round(mx - hw); x <= Math.round(mx + hw); x++) {
        const u = (x - mx) / hw;
        S.px(x, y, step ? cDk : u > 0.5 ? cLit : u > -0.2 ? cMid : cSh);
      }
    }
    S.px(mx, mTop - 1, cMid); S.px(mx, mTop - 2, C.y1);
    tower(cx - 12, baseY - 38, 34, 6);
    tower(cx + 12, baseY - 38, 34, 6);
    const [fx, fy] = tower(cx, baseY - 60, 54, 13);
    // flag pole and a saffron pennant streaming in the wind
    S.vline(fx, fy - 10, fy - 1, cDk);
    S.sprite(fx + 1, fy - 10, ['ooooo', 'oooooo.', 'ooooo', 'ooo', 'o'], { o: C.o2 });
    S.px(fx + 1, fy - 10, C.o3); S.px(fx + 2, fy - 10, C.o3); S.px(fx + 5, fy - 9, C.o1);
  }

  function drawMosque(cx, baseY, Z) {
    const white = [226, 218, 208];
    const cLit = shade(white, [1.15, 0.98, 0.85], Z, cx), cMid = shade(white, [0.6, 0.56, 0.66], Z, cx), cSh = shade(white, [0.42, 0.4, 0.54], Z, cx);
    const green = shade([70, 140, 110], [0.7, 0.68, 0.74], Z, cx);
    // prayer hall
    S.rect(cx - 17, baseY - 14, 35, 15, (x) => (x < cx - 10 ? cMid : cSh));
    for (let x = cx - 14; x < cx + 16; x += 4) { S.vline(x, baseY - 10, baseY - 4, cSh === S.get(x, baseY - 8) ? cMid : C.k5); S.px(x, baseY - 11, cSh); }
    S.hline(cx - 17, cx + 17, baseY - 15, cLit);
    // the dome on its drum: slightly pointed onion
    S.rect(cx - 8, baseY - 19, 17, 5, (x) => (x < cx - 4 ? cLit : cMid));
    for (let y = 0; y < 18; y++) {
      const t = y / 17; // 0 top .. 1 base
      const hw = t < 0.2 ? 1 + t * 22 : 9.6 * Math.sin(Math.min(1, (t - 0.2) / 0.8 * 1.2 + 0.25) * Math.PI / 2) + 0.4;
      const yy = baseY - 20 - (17 - y);
      for (let x = Math.round(cx - hw); x <= Math.round(cx + hw); x++) {
        const u = (x - cx) / Math.max(1, hw);
        S.px(x, yy, u < -0.55 ? cLit : u < 0.15 ? cMid : cSh);
      }
    }
    S.vline(cx, baseY - 42, baseY - 38, C.y1); S.px(cx, baseY - 43, C.y2); S.px(cx + 1, baseY - 42, C.y2);
    // minarets
    for (const mx of [cx - 22, cx + 22]) {
      const top = baseY - 64;
      for (let y = top; y < baseY; y++) {
        const w = y < top + 20 ? 1 : 2;
        for (let x = mx - w; x <= mx + 1; x++) S.px(x, y, x === mx - w ? cLit : x === mx + 1 ? cSh : cMid);
      }
      for (const by of [top + 8, top + 20, top + 36]) {
        S.hline(mx - 3, mx + 3, by, cLit); S.hline(mx - 3, mx + 3, by + 1, cSh); S.hline(mx - 2, mx + 2, by + 2, cSh);
        S.px(mx - 3, by - 1, cMid); S.px(mx + 3, by - 1, cSh);
      }
      // chhatri: a tiny onion dome
      S.sprite(mx - 2, top - 5, ['..g..', '.ggg.', 'ggggg', 'ggggg', '.ccc.'], { g: green, c: cMid });
      S.px(mx - 2, top - 3, cLit); S.px(mx, top - 6, C.y1); S.px(mx, top - 7, C.y2);
    }
    // a green banner on a pole above the hall
    S.vline(cx + 13, baseY - 26, baseY - 16, C.k4);
    S.sprite(cx + 14, baseY - 26, ['ggg', 'gggg', 'gg'], { g: C.g3 });
  }

  /* =================================================================== city model */
  let BLD = [];
  const z0x = (z) => z;
  function buildCity() {
    const rnd = mulberry32(424242);
    const rows = [];
    let z = 21;
    while (z < 330) { const d = 9 + rnd() * 6 + z * 0.02; rows.push({ z0: z, d }); z += d + 2.2 + rnd() * 3 + (rnd() < 0.15 ? 6 : 0); }
    let id = 10;
    for (const row of rows) {
      const half = 0.6 * (row.z0 + row.d) + 14;
      let X = -half - rnd() * 8;
      while (X < half) {
        const w = 5.5 + rnd() * 7.5 + (rnd() < 0.15 ? 5 : 0);
        let floors = z0x(row.z0) < 70 ? 1 + fl(rnd() * 3) + (rnd() < 0.35 ? 1 : 0) : z0x(row.z0) < 150 ? 2 + fl(rnd() * 3) + (rnd() < 0.25 ? 1 : 0) : 2 + fl(rnd() * 4) + (rnd() < 0.12 ? 2 : 0);
        const z0 = row.z0 + (rnd() < 0.3 ? rnd() * 2.5 : 0);
        const sxc = CX + F * (X + w / 2) / z0;
        if (z0 < 52 && Math.abs(sxc - 230) < 130) floors = Math.min(floors, z0 < 34 ? 2 : 3);
        floors = Math.min(floors, 6);
        const h = floors * 3.1 + 0.2;
        const b = {
          id: id++, x0: X, x1: X + w - (rnd() < 0.1 ? 1.5 : 0), z0, z1: row.z0 + row.d - rnd() * 1.5, h, floors,
          paint: PAINTS[wpick(rnd, PAINTW)], grime: 0.2 + rnd() * 0.6, seed: fl(rnd() * 1e9),
          parapet: 0.9, unfinished: rnd() < 0.12, lit: rnd(),
        };
        b.wet = 0.35 + rnd() * 0.5;
        b.roof = rnd() < 0.3 ? 1 : rnd() < 0.25 ? 2 : 0;
        b.accent = rnd() < 0.5 ? [232, 228, 222] : PAINTS[wpick(rnd, PAINTW)];
        b.frames = rnd() < 0.55;
        BLD.push(b);
        X += w + (rnd() < 0.12 ? 1.5 + rnd() * 3 : 0);
      }
    }
  }

  /* =================================================================== drawing a building */
  function fillQuad(pts, c) { S.poly(pts, c); }
  function drawBuilding(b) {
    const r = mulberry32(b.seed);
    const { x0, x1, z0, z1, h } = b;
    const Yp = h + b.parapet;
    const s = F / z0;
    const [fxL, fyT] = proj(x0, Yp, z0), [fxR, fyB] = proj(x1, 0, z0);
    const midx = (fxL + fxR) / 2;
    S.setTag(b.id);
    const sunSide = midx > SUNX + 10 ? -1 : midx < SUNX - 10 ? 1 : 0; // which side face meets the sun
    // ---- side face
    let sideX = null;
    if (x1 < 0) sideX = x1; else if (x0 > 0) sideX = x0;
    if (sideX !== null) {
      const facesSun = (sideX === x0 && sunSide === -1) || (sideX === x1 && sunSide === 1);
      const L = facesSun ? [L_FRONT[0] + L_SUN[0] * 0.7, L_FRONT[1] + L_SUN[1] * 0.7, L_FRONT[2] + L_SUN[2] * 0.62] : L_SHADOW;
      const wall = r() < 0.55 ? b.paint : [150, 138, 130];
      const cBase = shade(wall, L, z0, midx), cDark = shade(wall, [L[0] * 0.72, L[1] * 0.72, L[2] * 0.74], z0, midx);
      const q = [proj(sideX, 0, z0), proj(sideX, Yp, z0), proj(sideX, Yp, z1), proj(sideX, 0, z1)];
      const pipeZ = z0 + (z1 - z0) * (0.2 + r() * 0.6);
      const sw = Math.abs(q[0][0] - q[3][0]);
      fillQuad(q, (x, y) => {
        // invert onto the wall plane: depth along the wall and height
        const Z = F * sideX / (x + 0.5 - CX);
        const Y = EYE - (y + 0.5 - HY) * Z / F;
        if (sw > 5) {
          const fy = Y % 3.1;
          if (Math.abs(Z - pipeZ) < 0.18 * (z0 / 20)) return cDark;
          const st = ih(fl(Z * 3), b.id, 5);
          if (st < b.grime * 0.5 && (Yp - Y) < 1 + st * 14) return cDark;
        }
        return cBase;
      });
      if (sw > 5) for (let Yf = 3.1; Yf < h; Yf += 3.1) { const p0 = proj(sideX, Yf, z0), p1 = proj(sideX, Yf, z1); S.line(p0[0], p0[1], p1[0], p1[1], cDark); }
    }
    // ---- roof slab (wet, mirroring the sky)
    const conc = b.roof === 1 ? [210, 206, 204] : b.roof === 2 ? [52, 48, 56] : [118, 110, 112];
    const topQ = [proj(x0, h, z0), proj(x1, h, z0), proj(x1, h, z1), proj(x0, h, z1)];
    fillQuad(topQ, (x, y) => {
      const Z = F * (EYE - h) / (y + 0.5 - HY);
      const X = (x + 0.5 - CX) * Z / F;
      const pud = fbm(X * 0.42 + b.id, Z * 0.42, 3, 900) + (b.wet - 0.5) * 0.4;
      const ref = skyAt(x, 2 * HY - y);
      const t = fogT(Z);
      let m = pud > 0.56 ? 0.88 : pud > 0.47 ? 0.55 : 0.28;
      const hz = hzA(x);
      let cc = conc;
      if (b.roof === 1 && s > 3.5 && ih(fl(X * 5), fl(Z * 5), b.id) < 0.3) cc = [150, 146, 150]; // broken-china mosaic
      if (b.roof === 0 && ih(fl(X * 1.2), fl(Z * 1.2), b.id) < 0.12) cc = [80, 74, 80]; // tar patches
      const rr = lerp(cc[0] * L_TOP[0], ref[0] * 0.86, m), gg = lerp(cc[1] * L_TOP[1], ref[1] * 0.84, m), bb = lerp(cc[2] * L_TOP[2], ref[2] * 0.88, m);
      if (pud > 0.5) { // glitter path of the sun on standing water
        const g = Math.exp(-sq((x - SUNX) / (6 + (y - HY) * 0.14))) * (1 - sstep(HY, HY + 240, y));
        if (pud > 0.56 && g > 0.45) return g > 0.8 ? C.h5 : g > 0.62 ? C.h4 : C.h3;
      }
      return PAL.snap(lerp(rr, hz[0], t * 0.7), lerp(gg, hz[1], t * 0.7), lerp(bb, hz[2], t * 0.7));
    });
    // ---- inner faces of the back and side parapets
    const pIn = shade(b.paint, [0.42, 0.41, 0.55], z0, midx);
    fillQuad([proj(x0, h, z1), proj(x1, h, z1), proj(x1, Yp, z1), proj(x0, Yp, z1)], pIn);
    if (x0 < 0) fillQuad([proj(x0, h, z0), proj(x0, h, z1), proj(x0, Yp, z1), proj(x0, Yp, z0)], pIn);
    if (x1 > 0) fillQuad([proj(x1, h, z0), proj(x1, h, z1), proj(x1, Yp, z1), proj(x1, Yp, z0)], pIn);
    // ---- rooftop clutter
    drawClutter(b, r);
    S.setTag(b.id);
    // ---- front face
    const fc = shade(b.paint, L_FRONT, z0, midx);
    const xa = Math.round(fxL), xb = Math.round(fxR) - 1, ya = Math.round(fyT), yb = Math.min(H - 1, Math.round(fyB));
    for (let y = ya; y <= yb; y++) for (let x = xa; x <= xb; x++) S.px(x, y, fc);
    facade(b, r, xa, xb, ya, yb, s, midx);
    // ---- rim light along parapet tops (wet copings catch the glow)
    // copings are horizontal and wet: they mirror the sky like the slab does
    const coping = (x, y, z) => { const ref = skyAt(x, 2 * HY - y); const p = b.paint; return shade([lerp(p[0] * 0.55, ref[0] * 1.05, 0.55) / 0.9, lerp(p[1] * 0.52, ref[1], 0.55) / 0.9, lerp(p[2] * 0.62, ref[2], 0.55) / 0.9], [0.9, 0.9, 0.9], z, x); };
    for (let x = xa; x <= xb; x++) S.px(x, ya, coping(x, ya, z0));
    const [bx0, by0] = proj(x0, Yp, z1), [bx1] = proj(x1, Yp, z1);
    for (let x = Math.round(bx0); x < Math.round(bx1); x++) if (S.getTag(x, Math.round(by0)) === b.id) S.px(x, Math.round(by0), coping(x, by0, z1));
  }
  function rimColour(sx, z, k) {
    const sky = skyAt(sx, HY - 6);
    const g = Math.exp(-sq((sx - SUNX) / 120));
    const kk = (k || 1) * (0.3 + 0.6 * g);
    const base = [70, 60, 88];
    return shade([lerp(base[0], sky[0] * 1.05, kk) / 0.8, lerp(base[1], sky[1], kk) / 0.8, lerp(base[2], sky[2] * 0.95, kk) / 0.8], [0.8, 0.8, 0.8], z * 0.6, sx);
  }
  function facade(b, r, xa, xb, ya, yb, s, midx) {
    const z = b.z0, wall = b.paint;
    const dark = shade(wall, [L_FRONT[0] * 0.66, L_FRONT[1] * 0.66, L_FRONT[2] * 0.7], z, midx);
    const light = shade(wall, [L_FRONT[0] * 1.35, L_FRONT[1] * 1.32, L_FRONT[2] * 1.22], z, midx);
    const glass = shade([40, 38, 56], [1, 1, 1], z, midx);
    const glass2 = shade([62, 58, 82], [1, 1, 1], z, midx);
    const fw = xb - xa + 1;
    if (s > 6) {
      const pL = shade(wall, [L_FRONT[0] * 1.16, L_FRONT[1] * 1.14, L_FRONT[2] * 1.1], z, midx), pD = shade([lerp(wall[0], 50, 0.25), lerp(wall[1], 56, 0.25), lerp(wall[2], 70, 0.25)], [L_FRONT[0] * 0.86, L_FRONT[1] * 0.86, L_FRONT[2] * 0.88], z, midx);
      const brickA = shade([150, 76, 56], L_FRONT, z, midx), brickB = shade([100, 50, 44], L_FRONT, z, midx);
      for (let y = ya + 1; y <= yb; y++) for (let x = xa; x <= xb; x++) {
        const n = fbm((x - xa) / 4.5 + b.id, (y - ya) / 18, 3, 500) + (y - ya) / (yb - ya + 1) * 0.08;
        if (n > 0.68) S.px(x, y, pD); else if (n < 0.27) S.px(x, y, pL);
        if (s > 8 && fbm((x - xa) / 9, (y - ya) / 6, 2, 501) > 0.81) S.px(x, y, ((y - ya) % 3 === 0 || ((x - xa) + (((y - ya) / 3) | 0) * 2) % 5 === 0) ? brickB : brickA); // plaster fallen away
      }
      despeckle(S, (x, y) => x >= xa && x <= xb && y > ya && y <= yb, 2);
    }
    // grime streaks from the coping
    for (let x = xa; x <= xb; x++) {
      const k = ih(x - xa, b.id, 11);
      if (s > 5.5 && k < b.grime * 0.45) {
        const len = fl(2 + ih(x - xa, b.id, 12) * (yb - ya) * 0.5 * b.grime);
        for (let y = ya + 1; y < Math.min(yb, ya + 1 + len); y++) S.px(x, y, dark);
      }
    }
    const fh = 3.1 * s; // floor height in px
    const nb = Math.max(1, Math.round((b.x1 - b.x0) / 3.3));
    const bayW = fw / nb;
    const ww = Math.max(1, Math.round(1.25 * s)), wh = Math.max(1, Math.round(1.35 * s));
    const balcony = (b.balcony || r() < 0.35) && s > 5;
    for (let f = 0; f < b.floors; f++) {
      const floorTop = ya + Math.round(b.parapet * s + f * fh);
      const wy = floorTop + Math.round(0.75 * s);
      if (wy > H) break;
      // floor band / chajja line
      if (f > 0 && s > 3) S.hline(xa, xb, floorTop, dark);
      for (let k = 0; k < nb; k++) {
        const cxw = Math.round(xa + bayW * (k + 0.5));
        const wx = cxw - (ww >> 1);
        const rr = ih(b.id, f * 31 + k, 3);
        const lit = rr < 0.06 + 0.1 * b.lit ? (rr < 0.04 ? C.l0 : rr < 0.075 ? C.l1 : C.h4) : -1;
        if (b.unfinished && f === b.floors - 1 && rr < 0.5) continue;
        if (ww <= 1 || wh <= 1) {
          S.px(cxw, wy, lit >= 0 ? lit : glass);
          if (wh > 1) S.px(cxw, wy + 1, lit >= 0 ? lit : glass);
          continue;
        }
        if (b.frames && s > 7) { const ac = shade(b.accent, L_FRONT, z, midx); S.rect(wx - 1, wy - 1, ww + 2, wh + 2, ac); }
        // chajja (sunshade) above the window: a lit lip and its shadow
        if (s > 3.2) {
          S.hline(wx - 1, wx + ww, wy - 2, light);
          S.hline(wx - 1, wx + ww, wy - 1, dark);
        } else S.hline(wx, wx + ww - 1, wy - 1, dark);
        for (let j = 0; j < wh; j++) for (let i = 0; i < ww; i++) {
          let c = lit >= 0 ? lit : (j === 0 ? glass : glass2);
          if (s > 4.5 && lit < 0 && (i % 2 === 1) && j > 0) c = glass; // window grille
          if (s > 4.5 && lit >= 0 && (i === (ww >> 1))) c = dark; // mullion across the light
          S.px(wx + i, wy + j, c);
        }
        if (s > 8 && lit < 0 && ih(b.id, f * 5 + k, 44) < 0.3) { // wooden shutters swung open
          const sc = shade([[60, 130, 120], [70, 100, 160], [150, 90, 60], [90, 140, 80]][fl(ih(b.id, 1, 44) * 4)], L_FRONT, z, midx);
          const scD = shade([30, 40, 50], [1, 1, 1], z, midx), sw2 = Math.max(2, ww >> 1);
          S.rect(wx - sw2 - 1, wy, sw2, wh, sc); S.rect(wx + ww + 1, wy, sw2, wh, sc);
          for (let j = 1; j < wh; j += 2) { S.hline(wx - sw2 - 1, wx - 2, wy + j, scD); S.hline(wx + ww + 1, wx + ww + sw2, wy + j, scD); }
        }
        if (s > 8 && lit >= 0 && ih(b.id, f * 3 + k, 45) < 0.6) { // someone inside the lit room
          const hx = wx + 1 + fl(ih(b.id, f, 46) * Math.max(1, ww - 4));
          S.sprite(hx, wy + wh - 6, ['.kk.', '.kk.', 'kkkk', 'kkkk', 'kkkk', 'kkkk'], { k: shade([60, 40, 40], [1, 1, 1], z * 0.5, midx) });
        }
        if (s > 4.5 && lit < 0 && ih(b.id, f * 7 + k, 9) < 0.35) { // half-drawn curtain
          const cc = shade(FABRIC_RGB(ih(b.id, f, k) * FABRIC.length | 0), [0.5, 0.48, 0.56], z, midx);
          for (let j = 0; j < wh; j++) S.px(wx + (j & 1), wy + j, cc);
        }
        // AC box or flower pot under some windows
        if (s > 5 && ih(b.id, f * 13 + k, 21) < 0.2) {
          const ax = wx + fl(ww / 2) - 2, ay = wy + wh + 1;
          S.rect(ax, ay, 4, 3, shade([200, 196, 196], L_FRONT, z, midx));
          S.hline(ax, ax + 3, ay + 2, dark);
          S.px(ax + 1, ay + 1, dark);
        } else if (s > 4 && ih(b.id, f * 17 + k, 22) < 0.22) {
          S.hline(wx, wx + ww - 1, wy + wh, shade([140, 76, 54], L_FRONT, z, midx));
          for (let i = 0; i < ww; i += 2) S.px(wx + i, wy + wh - 1, shade([70, 130, 60], [0.7, 0.7, 0.75], z, midx));
        }
        if (s > 4 && ih(b.id, f * 3 + k, 33) < 0.35) { // damp streak below the sill
          const len = 2 + fl(ih(b.id, f, k * 5) * fh * 0.6);
          for (let j = 0; j < len; j++) S.px(wx + 1 + (k & 1), wy + wh + j, dark);
        }
      }
      // balconies: railing with laundry draped over
      if (balcony && f > 0 && (f + b.id) % 2 === 0) {
        const by = floorTop + Math.round(fh) - 1;
        const bx0 = xa + Math.round(fw * 0.12), bx1 = xb - Math.round(fw * 0.12);
        const rail = shade([60, 58, 70], [1, 1, 1], z, midx);
        S.hline(bx0, bx1, by - Math.round(1.0 * s), rail);
        for (let x = bx0; x <= bx1; x += 2) S.vline(x, by - Math.round(1.0 * s), by, rail);
        S.hline(bx0, bx1, by + 1, light);
        let x = bx0 + 1;
        while (x < bx1 - 2) {
          const cw = 2 + fl(ih(x, b.id, f) * 4);
          const fc = FABRIC_RGB(fl(ih(x, f, b.id) * FABRIC.length));
          if (ih(x, b.id, 77) < 0.6) {
            const cl = shade(fc, [0.75, 0.68, 0.72], z, midx), cd = shade(fc, [0.5, 0.45, 0.55], z, midx);
            const len = 2 + fl(ih(x, 3, b.id) * s * 0.9);
            for (let i = 0; i < cw && x + i < bx1; i++) for (let j = 0; j < len; j++) S.px(x + i, by - Math.round(1.0 * s) + 1 + j, i === cw - 1 ? cd : cl);
          }
          x += cw + 1 + fl(ih(x, 5, 5) * 3);
        }
      }
    }
    if (s > 5 && r() < 0.7) { // a sagging cable stapled across the face, with a junction box
      const cy = ya + Math.round(b.parapet * s + fl(r() * Math.max(1, b.floors - 1)) * fh + fh * 0.92), cc = shade([30, 28, 36], [1, 1, 1], z, midx);
      for (let x = xa; x <= xb; x++) { const t = (x - xa) / Math.max(1, fw); S.px(x, cy + Math.round(Math.sin(t * Math.PI * 3) * 1.2 + 1), cc); }
      const bx = xa + fl(r() * (fw - 4)); S.rect(bx, cy - 1, 3, 4, shade([200, 196, 190], L_FRONT, z, midx)); S.px(bx + 1, cy + 2, cc);
    }
    // a vertical drain pipe
    if (s > 3 && r() < 0.6) {
      const px0 = xa + 1 + fl(r() * (fw - 2));
      S.vline(px0, ya + 1, yb, dark);
      if (s > 6) S.vline(px0 + 1, ya + 1, yb, shade([40, 40, 46], [1, 1, 1], z, midx));
    }
  }
  const FABRIC_RGB = (k) => P[C[FABRIC[clamp(k, 0, FABRIC.length - 1)]]];

  /* =================================================================== roof clutter */
  function drawClutter(b, r) {
    const items = [];
    const { x0, x1, z0, z1, h } = b;
    const w = x1 - x0, d = z1 - z0;
    const s = F / z0;
    const at = (fx, fz) => [x0 + 0.6 + fx * (w - 1.2), z0 + 0.6 + fz * (d - 1.2)];
    if (r() < 0.62) { const [X, Z] = at(0.15 + r() * 0.5, 0.45 + r() * 0.5); items.push({ k: 'mumty', X, Z, w: 2.6 + r() * 0.8, d: 2.8, hh: 2.4, tank: r() < 0.55 }); }
    const nt = r() < 0.75 ? 1 + fl(r() * 2.4) : 0;
    for (let i = 0; i < nt; i++) { const [X, Z] = at(r(), 0.3 + r() * 0.7); items.push({ k: 'tank', X, Z, rad: 0.5 + r() * 0.3, ht: 1.1 + r() * 0.4, stand: r() < 0.4 ? 0.6 + r() * 1.1 : 0, col: r() < 0.72 ? 0 : r() < 0.6 ? 1 : 2 }); }
    if (r() < 0.45) { const [X, Z] = at(r(), r()); items.push({ k: 'dish', X, Z, rad: 0.35 + r() * 0.15 }); }
    if (r() < 0.2) { const [X, Z] = at(r(), r()); items.push({ k: 'aerial', X, Z }); }
    if (r() < 0.55) { const [Xa, Z] = at(r() * 0.3, 0.2 + r() * 0.6); items.push({ k: 'laundry', X: Xa, Z, len: Math.min(w - 1.5, 3 + r() * 5), seed: fl(r() * 1e6) }); }
    if (r() < 0.5) { const n = 1 + fl(r() * 4); for (let i = 0; i < n; i++) { const [X, Z] = at(r(), r() < 0.5 ? 0.02 : r()); items.push({ k: 'pot', X, Z, sp: r() < 0.3 ? 'boug' : 'green', sz: 0.4 + r() * 0.5 }); } }
    if (r() < 0.12) { const [X, Z] = at(r(), r()); items.push({ k: 'tarp', X, Z, sz: 1.2 + r() * 1.2 }); }
    if (r() < 0.12) { const [X, Z] = at(r(), r() * 0.5); items.push({ k: 'chair', X, Z, col: r() < 0.6 ? [200, 50, 44] : [220, 218, 214] }); }
    if (b.unfinished) { for (let i = 0; i < 4; i++) items.push({ k: 'rebar', X: x0 + 0.3 + (i % 2) * (w - 0.6), Z: z0 + 0.3 + (i >> 1) * (d - 0.6) }); }
    let list = items;
    if (b.noClutter) list = items.filter((it) => Math.abs(proj(it.X, h, it.Z)[0] - BOYX) > 26 || it.Z > z0 + 6);
    if (b.special) list.push(...b.special);
    list.sort((a, c) => c.Z - a.Z);
    for (const it of list) drawItem(it, b, r);
  }

  function drawItem(it, b, r) {
    const Z = it.Z, s = F / Z, h = b.h;
    const [sx, sy] = proj(it.X, h, Z);
    const ix = Math.round(sx), iy = Math.round(sy);
    const litSide = sx > SUNX ? -1 : 1;
    const sh = (rgb, L) => shade(rgb, L, Z, sx);
    const rimC = rimColour(sx, Z, 0.95);
    switch (it.k) {
      case 'tank': {
        const rw = Math.max(1, Math.round(it.rad * s)), ht = Math.max(2, Math.round(it.ht * s)), st = Math.round(it.stand * s);
        const col = it.col === 2 && s < 7 ? 1 : it.col;
        const body = col === 0 ? [34, 32, 44] : col === 1 ? [60, 100, 180] : [214, 210, 206];
        const cB = sh(body, col === 0 ? [1, 1, 1] : L_FRONT), cD = sh(body, col === 0 ? [0.6, 0.6, 0.7] : L_SHADOW);
        const cRib = sh(body, col === 0 ? [1.5, 1.45, 1.6] : [0.42, 0.4, 0.55]);
        const top = iy - st - ht;
        if (rw === 2) { // a small tank: a compact block with a lit lid and a shaded flank
          const yt = iy - st - ht, lid = sh(body, col === 0 ? [1.6, 1.5, 1.7] : [0.8, 0.76, 0.86]);
          S.hline(ix - 1, ix + 1, yt - 1, lid);
          for (let y = yt; y < iy - st; y++) for (let x = ix - 2; x <= ix + 1; x++) S.px(x, y, (x - ix + 0.5) * litSide > 0.8 ? cD : cB);
          S.vline(litSide > 0 ? ix - 2 : ix + 1, yt, iy - st - 1, rimC);
          if (st > 0) { S.vline(ix - 2, iy - st, iy, cD); S.vline(ix + 1, iy - st, iy, cD); }
          break;
        }
        if (rw <= 1) { // too small for a cylinder: a dark block with one lit pixel on the sun side
          S.rect(ix - 1, iy - st - ht, 2, ht, cB); S.px(litSide > 0 ? ix - 1 : ix, iy - st - ht, sh(body, [1.5, 1.4, 1.6]));
          if (st > 0) S.vline(ix - 1, iy - st, iy, sh([40, 38, 46], [1, 1, 1]));
          break;
        }
        if (st > 0) { // steel stand
          const leg = sh([40, 38, 46], [1, 1, 1]);
          S.vline(ix - rw + 1, iy - st, iy, leg); S.vline(ix + rw - 1, iy - st, iy, leg);
          if (st > 3) S.line(ix - rw + 1, iy - st, ix + rw - 1, iy, leg);
        }
        for (let y = top; y < iy - st; y++) for (let x = ix - rw; x <= ix + rw; x++) {
          let c = (x - ix) * litSide > rw * 0.3 ? cD : cB;
          if (rw >= 4 && (y - top) % 3 === 2) c = cRib;
          S.px(x, y, c);
        }
        if (rw >= 2) {
          const ry = Math.max(1, Math.round(rw * 0.35));
          S.ellipse(ix + 0.5, top + 0.5, rw + 0.5, ry, sh(body, [1.6, 1.5, 1.7]));
          if (rw >= 3) S.ellipse(ix + 0.5, top + 0.5, Math.max(1, rw * 0.4), Math.max(1, ry * 0.5), cD);
        }
        S.vline(litSide > 0 ? ix - rw : ix + rw, top, iy - st - 1, rimC);
        break;
      }
      case 'mumty': {
        const hw = it.w / 2, X0 = it.X - hw, X1 = it.X + hw, Z0 = it.Z - it.d / 2, Z1 = it.Z + it.d / 2, Yt = h + it.hh;
        const paint = b.paint;
        const sideX = X1 < 0 ? X1 : X0 > 0 ? X0 : null;
        const midx = proj(it.X, h, Z0)[0];
        if (sideX !== null) {
          const facesSun = (sideX === X0 && midx > SUNX) || (sideX === X1 && midx < SUNX);
          S.poly([proj(sideX, h, Z0), proj(sideX, Yt + 0.2, Z0), proj(sideX, Yt + 0.2, Z1), proj(sideX, h, Z1)], shade(paint, facesSun ? [1.2, 0.95, 0.78] : L_SHADOW, Z0, midx));
        }
        S.poly([proj(X0, Yt + 0.2, Z0), proj(X1, Yt + 0.2, Z0), proj(X1, Yt + 0.2, Z1), proj(X0, Yt + 0.2, Z1)], shade([120, 112, 114], [0.62, 0.56, 0.66], Z0, midx));
        const [ax, ay] = proj(X0, Yt + 0.2, Z0), [bx, by] = proj(X1, h, Z0);
        const xa = Math.round(ax), xb = Math.round(bx) - 1, ya = Math.round(ay), yb = Math.round(by);
        S.rect(xa, ya, xb - xa + 1, yb - ya + 1, shade(paint, L_FRONT, Z0, midx));
        const ss = F / Z0;
        // door, sometimes ajar with warm light
        const dw = Math.max(1, Math.round(0.8 * ss)), dh = Math.max(2, Math.round(2.0 * ss));
        const dx = xa + Math.round((xb - xa) * 0.3);
        const open = ih(b.id, 4, 4) < 0.3;
        S.rect(dx, yb - dh, dw, dh, open ? C.l0 : shade([60, 50, 60], [1, 1, 1], Z0, midx));
        if (open && dw > 2) S.vline(dx + dw - 1, yb - dh, yb - 1, C.o2);
        if (ss > 4) S.hline(dx - 1, dx + dw, yb - dh - 1, shade(paint, [0.36, 0.34, 0.46], Z0, midx));
        S.hline(xa, xb, ya, rimColour(midx, Z0));
        if (it.tank) drawItem({ k: 'tank', X: it.X + (ih(b.id, 1, 1) - 0.5) * hw, Z: it.Z, rad: 0.55, ht: 1.2, stand: 0, col: ih(b.id, 2, 2) < 0.75 ? 0 : 1 }, { h: Yt + 0.2, id: b.id }, r);
        break;
      }
      case 'dish': {
        // a dish tipped toward the southern sky: a slanted oval, lit face up-left, the feed arm across it
        const rr = Math.max(1, Math.round(it.rad * s));
        const pole = Math.max(1, Math.round(0.9 * s));
        const c1 = sh([206, 202, 206], [0.82, 0.78, 0.88]), c2 = sh([206, 202, 206], [0.5, 0.48, 0.6]), arm = sh([50, 48, 56], [1, 1, 1]);
        S.vline(ix, iy - pole, iy, arm);
        const cy = iy - pole - rr * 0.5;
        if (rr <= 2) { S.sprite(ix - 1, Math.round(cy) - 1, rr <= 1 ? ['ab'] : ['.a', 'ab', 'b.'], { a: c1, b: c2 }); break; }
        for (let j = -rr; j <= rr; j++) for (let i = -rr; i <= rr; i++) {
          const u = (i + j) / 1.414, v = (i - j) / 1.414;
          if (sq(u / rr) + sq(v / (rr * 0.5)) > 1) continue;
          S.px(ix + i, Math.round(cy) + j, v < -rr * 0.12 ? c1 : c2);
        }
        S.line(ix, Math.round(cy), ix - rr, Math.round(cy) - rr + 1, arm);
        break;
      }
      case 'aerial': {
        if (s < 4) break;
        const hgt = Math.round(3.2 * s), c = sh([50, 48, 60], [1, 1, 1]);
        S.vline(ix, iy - hgt, iy, c);
        for (let k = 0; k < 4; k++) { const yy = iy - hgt + k * Math.max(1, Math.round(0.35 * s)); const hw = Math.max(1, Math.round((0.7 - k * 0.12) * s)); S.hline(ix - hw, ix + hw, yy, c); }
        break;
      }
      case 'laundry': {
        const X2 = it.X + it.len, pH = 1.8;
        const [ax, ay] = proj(it.X, h + pH, Z), [bx, by] = proj(X2, h + pH, Z);
        const pc = sh([50, 46, 52], [1, 1, 1]);
        S.vline(Math.round(ax), Math.round(ay), iy, pc); S.vline(Math.round(bx), Math.round(by), Math.round(proj(X2, h, Z)[1]), pc);
        const rr = mulberry32(it.seed);
        const sag = 0.18 * s;
        const lineY = (x) => ay + (by - ay) * ((x - ax) / (bx - ax)) + sag * 4 * ((x - ax) / (bx - ax)) * (1 - (x - ax) / (bx - ax));
        for (let x = Math.round(ax); x <= Math.round(bx); x++) S.px(x, Math.round(lineY(x)), sh([40, 40, 48], [1, 1, 1]));
        let x = Math.round(ax) + 1;
        while (x < bx - 1) {
          const cw = Math.max(1, Math.round((0.4 + rr() * 0.8) * s));
          const fab = FABRIC_RGB(fl(rr() * FABRIC.length));
          const long = rr() < 0.3; // a sari
          const len = Math.max(1, Math.round((long ? 1.5 : 0.5 + rr() * 0.5) * s));
          const cl = sh(fab, [0.95, 0.85, 0.85]), cd = sh(fab, [0.6, 0.55, 0.65]);
          for (let i = 0; i < cw && x + i < bx; i++) {
            const ly = Math.round(lineY(x + i)) + 1;
            for (let j = 0; j < len; j++) {
              let c = (x + i) * 1 > sx - 99 && ((i === cw - 1 && cw > 2) || (litSide < 0 && i === 0 && cw > 2)) ? cd : cl;
              if (long && j === len - 1 && s > 4) c = sh(P[C.y2], [0.9, 0.8, 0.8]);
              S.px(x + i, ly + j, c);
            }
          }
          x += cw + (rr() < 0.4 ? 1 : 0) + (rr() < 0.2 ? Math.round(s * 0.5) : 0);
        }
        break;
      }
      case 'pot': {
        const pw = Math.max(1, Math.round(it.sz * s * 0.7)), ph = Math.max(1, Math.round(it.sz * s * 0.6));
        S.rect(ix - (pw >> 1), iy - ph, pw, ph, sh([150, 80, 56], L_FRONT));
        const pr = Math.max(1, Math.round(it.sz * s * 0.8));
        const leafA = it.sp === 'boug' ? sh([214, 50, 118], [0.95, 0.8, 0.86]) : sh([70, 130, 60], [0.85, 0.85, 0.85]);
        const leafB = it.sp === 'boug' ? sh([160, 30, 90], [0.6, 0.55, 0.65]) : sh([40, 80, 46], [0.6, 0.6, 0.66]);
        for (let j = -pr; j <= 0; j++) for (let i = -pr; i <= pr; i++) {
          if (i * i + j * j * 1.4 > pr * pr + 0.5) continue;
          if (ih(ix + i, iy + j, 41) < 0.18 && pr > 1) continue;
          S.px(ix + i, iy - ph + j, (i * litSide < 0 && j < 0) ? leafA : leafB);
        }
        break;
      }
      case 'tarp': {
        const hw = Math.max(1, Math.round(it.sz * s * 0.5)), hh = Math.max(1, Math.round(it.sz * s * 0.4));
        const c1 = sh([50, 90, 170], [0.95, 0.9, 1]), c2 = sh([50, 90, 170], [0.55, 0.52, 0.66]);
        for (let j = 0; j < hh; j++) for (let i = -hw; i <= hw; i++) {
          if (Math.abs(i) > hw - (j === 0 ? 1 : 0)) continue;
          S.px(ix + i, iy - hh + j, ((i + j * 2) % 4 === 0 && hw > 2) ? c2 : (i * litSide < 0 ? c1 : c2));
        }
        break;
      }
      case 'chair': {
        const c = sh(it.col, L_FRONT), ss = Math.max(1, Math.round(0.45 * s));
        S.rect(ix, iy - ss, ss + 1, 1, c); S.vline(ix, iy - 2 * ss, iy, c); S.vline(ix + ss, iy - ss, iy, c);
        break;
      }
      case 'rebar': {
        const hgt = Math.max(2, Math.round(1.1 * s));
        const c = sh([110, 70, 60], [0.6, 0.5, 0.55]);
        S.vline(ix, iy - hgt, iy, c);
        if (s > 5) S.vline(ix + 2, iy - hgt + 1, iy, c);
        S.px(ix, iy - hgt, rimC);
        break;
      }
      case 'boy': {
        // a boy in a white vest working the kite string, and his little sister holding the spool
        const boy = [
          '.........a.',
          '........a..',
          '.......a...',
          '...hh.a....',
          '..hhhha....',
          '..hhhhs....',
          '...sss.....',
          '..wwwwa....',
          '.awwwwwa...',
          'a.wwwww.a..',
          'a.wwwww..aa',
          '..wwwww....',
          '..bbbbb....',
          '..bbbbb....',
          '..s...s....',
          '..s...s....',
          '.ss...ss...',
        ];
        const bx0 = ix - 4, by0 = iy - boy.length;
        litSprite(bx0, by0, boy, { a: C.c1, h: C.k1, s: C.c1, w: C.w0, b: C.b0 }, -1, C.o3, null, undefined);
        S.px(bx0 + 3, by0 + 8, C.h1); S.px(bx0 + 3, by0 + 9, C.h1); S.px(bx0 + 6, by0 + 10, C.h1); S.px(bx0 + 6, by0 + 11, C.h1); // vest folds
        const sis = [
          '..hh..',
          '.hhhh.',
          '.hhhh.',
          '..ss..',
          '.rrrr.',
          'rrrrrr',
          'rcyycr',
          '.yyyy.',
          '.ykky.',
          '.yyyy.',
          '.rrrr.',
          '.s..s.',
          '.s..s.',
        ];
        litSprite(ix - 13, iy - sis.length, sis, { h: C.k1, s: C.c1, r: C.r1, y: C.y1, k: C.k2, c: C.c1 }, -1, C.o2, 'hrs', undefined);
        S.px(ix - 10, iy - 7, C.y2);
        it.hand = [bx0 + 9, by0];
        BOYHAND = it.hand;
        break;
      }
      case 'woman': {
        // a woman in a marigold sari, reaching up to unpeg the washing before the rain returns
        const wm = [
          '......a.',
          '......a.',
          '...hh.a.',
          '..hhhha.',
          '..hhhsa.',
          '..ppss..',
          '.ppssss.',
          '.ppsss..',
          '.pssss..',
          '..ssss..',
          '..sssss.',
          '..sssss.',
          '.ssssss.',
          '.ssssss.',
          '.sssssss',
          '.rrrrrrr',
          '..f..f..',
        ];
        litSprite(ix - 4, iy - wm.length, wm, { a: C.c1, h: C.k1, s: C.y2, p: C.r1, r: C.r1, f: C.c1 }, -1, C.h4, 'sph', undefined);
        // the far side of her in shade
        for (let j = 5; j < 15; j++) { const row = wm[j]; const i = row.lastIndexOf('s'); if (i > 0) S.px(ix - 4 + i, iy - wm.length + j, C.y1); }
        break;
      }
      case 'palm': drawPalm(it, b); break;
    }
  }
  let BOYHAND = null;
  const BOYX = 222;

  function drawPalm(it, b) {
    const Z = it.Z, s = F / Z;
    const [bx, by] = proj(it.X, it.base || 0, Z);
    const hgt = it.hgt * s;
    const lean = it.lean * s;
    const trunk = shade([70, 56, 52], [0.8, 0.75, 0.85], Z, bx);
    const trunkL = rimColour(bx, Z, 0.8);
    let tx = bx, ty = by;
    const steps = Math.round(hgt);
    for (let k = 0; k <= steps; k++) {
      const t = k / steps;
      const x = bx + lean * t * t, y = by - hgt * t;
      const tw = Math.max(1, Math.round(0.35 * s * (1.2 - t * 0.4)));
      for (let i = 0; i < tw; i++) S.px(Math.round(x) + i, Math.round(y), i === 0 && bx > SUNX ? trunkL : trunk);
      if (tw > 1 && k % 3 === 0) S.px(Math.round(x) + tw - 1, Math.round(y), shade([40, 30, 34], [1, 1, 1], Z, bx));
      tx = x; ty = y;
    }
    const fronds = 9;
    const g1 = shade([60, 110, 50], [0.85, 0.78, 0.7], Z, bx), g2 = shade([30, 60, 36], [0.7, 0.7, 0.8], Z, bx), gl = rimColour(bx, Z, 0.9);
    for (let f = 0; f < fronds; f++) {
      const a = -Math.PI / 2 + (f / (fronds - 1) - 0.5) * 3.6 + (ih(f, it.seed, 1) - 0.5) * 0.35;
      const len = (3.5 + ih(f, it.seed, 2) * 1.6) * s;
      let px = tx, py = ty;
      for (let k = 1; k <= len; k++) {
        const t = k / len;
        const x = tx + Math.cos(a) * k, y = ty + Math.sin(a) * k + t * t * len * 0.55;
        const c = (Math.sin(a) < -0.3 || Math.cos(a) * (bx > SUNX ? -1 : 1) > 0.4) && t < 0.7 ? g1 : g2;
        S.line(px, py, x, y, c);
        if (s > 2.5 && k % 2 === 0 && t > 0.15) { // leaflets hanging from the rachis
          const ll = Math.max(1, Math.round(s * 0.45 * (1 - t * 0.6)));
          S.vline(Math.round(x), Math.round(y) + 1, Math.round(y) + ll, g2);
        }
        if (k === 1 && Math.sin(a) < -0.5) S.px(Math.round(x), Math.round(y) - 1, gl);
        px = x; py = y;
      }
    }
    S.ellipse(tx + 0.5, ty + 1, Math.max(1, 0.4 * s), Math.max(1, 0.4 * s), shade([140, 110, 50], [0.6, 0.55, 0.6], Z, bx));
  }

  // foliage mass: clumpy cells inside dens(x,y) > 0, lit toward (lx,ly); flowers where fl(x,y) says so
  function foliage(x0, y0, x1, y1, dens, leaf, flower, flFrac, lx, ly, seed, sc, litLv) {
    sc = sc || 1; litLv = litLv || 2;
    const inside = new Uint8Array((x1 - x0 + 1) * (y1 - y0 + 1));
    const D = (x, y) => dens(x, y) + (vn2(x / (2.3 * sc), y / (2.3 * sc), seed) - 0.5) * 0.5;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      if (D(x, y) <= 0) continue;
      const n = vn2(x / (2.3 * sc), y / (2.3 * sc), seed), n2 = vn2(x / (1.4 * sc) + 3, y / (1.4 * sc), seed + 9);
      const isF = flower && vn2(x / 3.2 + 7, y / 3.2, seed + 3) < flFrac(x, y);
      const R = isF ? flower : leaf;
      const lit = D(x + lx * 2 * sc, y + ly * 2 * sc) <= 0, shd = D(x - lx * 2 * sc, y - ly * 2 * sc) <= 0;
      let lv = 1;
      if (n > 0.6) lv = 2;
      if (lit) lv = litLv;
      if (n < 0.32 || shd) lv = 0;
      if (lit && n2 > 0.55 && R.length > 3) lv = 3;
      if (!isF && n2 < 0.2 && !lit) lv = 0;
      S.px(x, y, R[Math.min(lv, R.length - 1)]);
      inside[(y - y0) * (x1 - x0 + 1) + (x - x0)] = 1;
    }
    despeckle(S, (x, y) => x >= x0 && x <= x1 && y >= y0 && y <= y1 && inside[(y - y0) * (x1 - x0 + 1) + (x - x0)] === 1, 1);
  }

  function drawMast(X, Z, base, hgt) {
    // a telecom lattice mast on a roof: tapering legs, cross-bracing, antenna panels, a red light
    const [bx, by] = proj(X, base, Z), [, ty] = proj(X, base + hgt, Z);
    const s = F / Z;
    const c = shade([60, 54, 70], [1, 1, 1], Z, bx), cl = shade([220, 120, 100], [0.8, 0.7, 0.75], Z, bx), cW = shade([220, 216, 214], [0.7, 0.66, 0.76], Z, bx);
    const half = (y) => lerp(1.1 * s, 0.3 * s, (by - y) / (by - ty));
    for (let y = Math.round(ty); y <= Math.round(by); y++) {
      const hw = half(y), xl = Math.round(bx - hw), xr = Math.round(bx + hw);
      const band = Math.floor((by - y) / Math.max(3, s * 2.4)) % 2 === 0;
      S.px(xl, y, band ? c : cl); S.px(xr, y, band ? c : cW);
      if (xr - xl > 2 && (y + xl) % 4 === 0) S.hline(xl, xr, y, c);
      const k = (y % 6) / 6; if (xr - xl > 2) { S.px(Math.round(lerp(xl, xr, k)), y, c); S.px(Math.round(lerp(xr, xl, k)), y, c); }
    }
    // antenna panels near the top and a dish
    const tx = Math.round(bx), tyy = Math.round(ty);
    S.rect(tx - 3, tyy + 3, 1, 4, cW); S.rect(tx + 3, tyy + 3, 1, 4, c); S.rect(tx - 1, tyy + 2, 1, 4, cW);
    S.vline(tx, tyy - 4, tyy, c);
    S.px(tx, tyy - 5, C.r1); S.px(tx - 1, tyy - 5, C.o1); S.px(tx + 1, tyy - 5, C.o1); S.px(tx, tyy - 6, C.o1);
  }

  function drawTree(X, Z, rad, seed) {
    // a neem crown rising over the roofs, lumpy clusters lit on the side facing the sun
    const s = F / Z, [cx, cy] = proj(X, 14, Z);
    const R = rad * s;
    const lx = cx > SUNX ? -0.8 : 0.8;
    const leaf = [[16, 30, 24], [28, 54, 38], [46, 92, 50], [86, 134, 60], [140, 160, 70]].map((c, k) => shade(c, k > 2 ? [1.05, 0.95, 0.75] : [0.9, 0.9, 0.95], Z, cx));
    const dens = (x, y) => 1 - Math.hypot((x - cx) / (R * 1.25), (y - cy) / (R * 0.85)) + (fbm(x / (R * 0.4) + seed, y / (R * 0.4), 3, 600) - 0.5) * 0.7;
    const [tx, ty] = proj(X, 0, Z);
    for (let y = Math.round(cy + R * 0.3); y < ty; y++) S.hline(Math.round(tx - 0.25 * s), Math.round(tx + 0.25 * s), y, leaf[0]);
    foliage(Math.round(cx - R * 1.7), Math.round(cy - R * 1.3), Math.round(cx + R * 1.7), Math.round(cy + R * 1.2), dens, leaf, null, null, lx, -0.6, seed * 7 + 3, 2, 3);
  }

  /* =================================================================== wires and kites */
  function catenary(ax, ay, bx, by, sag, c, kites) {
    const n = Math.max(2, Math.ceil(Math.abs(bx - ax)));
    let px = ax, py = ay;
    for (let k = 1; k <= n; k++) {
      const t = k / n, x = lerp(ax, bx, t), y = lerp(ay, by, t) + sag * 4 * t * (1 - t);
      S.line(px, py, x, y, c);
      px = x; py = y;
    }
  }
  function drawKite(x, y, sz, c1, c2, torn) {
    x = Math.round(x); y = Math.round(y);
    for (let j = -sz; j <= sz; j++) {
      const hw = sz - Math.abs(j);
      for (let i = -hw; i <= hw; i++) {
        if (torn && i > 0 && j > 0) continue;
        S.px(x + i, y + j, (i < 0) !== (j < 0) ? c1 : c2);
      }
    }
    // tail
    for (let k = 1; k < sz * 3; k++) S.px(x + Math.round(Math.sin(k * 0.8) * 1), y + sz + k, k % 3 === 0 ? c2 : c1);
  }

  /* =================================================================== foreground */
  function drawForeground() {
    const rnd = mulberry32(99);
    // ---- our parapet: coping, inner face, wet floor
    const capY = 466;
    const wallC = [190, 178, 150];
    for (let x = 0; x < W; x++) {
      const tilt = Math.round((x - 216) * 0.012);
      const cy = capY + tilt;
      // coping: wet top catching the sky
      S.px(x, cy - 1, x % 23 === 0 ? C.c3 : rimColour(x, 4, 1));
      S.px(x, cy, C.h0);
      S.px(x, cy + 1, C.k6);
      S.px(x, cy + 2, C.k3);
      for (let y = cy + 3; y < 522; y++) {
        // inner wall in deep shade: old whitewash with monsoon mould running down
        const mould = fbm(x / 7, y / 30, 3, 31) + (y - cy) * 0.004;
        const streak = ih(x >> 1, 7, 7) < 0.3 && (y - cy) < 8 + ih(x >> 1, 8, 8) * 40;
        let c = C.k5;
        if (mould > 0.62 || streak) c = C.k4;
        if (mould > 0.74) c = C.g1;
        if ((y - cy) % 11 === 10 && ih(x >> 3, y, 2) < 0.6) c = C.k4; // brick courses under the plaster
        if (y === 521) c = C.k2;
        S.px(x, y, c);
      }
      for (let y = 522; y < H; y++) {
        // wet terrace floor in deep shade; puddles mirror the dark wall and, at their far edge, the lit coping
        const pud = fbm(x / 30, y / 4, 3, 55);
        let c = C.k2;
        if (pud > 0.5) c = y - 522 < 3 + fl(ih(x >> 2, 1, 1) * 3) ? C.k4 : C.k3;
        if (pud > 0.5 && fbm(x / 30, (y - 1) / 4, 3, 55) <= 0.5) c = ih(x, y, 3) < 0.5 ? C.h0 : C.k6; // bright lip of the reflection
        if (pud <= 0.5 && ih(x, y, 9) < 0.06) c = C.k3; // grit
        S.px(x, y, c);
      }
    }
    // cracks in the plaster
    S.line(60, 478, 66, 488, C.k3); S.line(66, 488, 64, 500, C.k3); S.line(248, 470, 252, 481, C.k3);
    // ---- water tank on its brick stand (right)
    const tx0 = 352, tx1 = 440, tTop = 362, tBot = 458;
    const TR = [C.k1, C.k2, C.k3, C.k4, C.k5, C.k6, C.h0, C.h1];
    const tankLv = (u) => (u < 0.025 ? 7 : u < 0.06 ? 5 : u < 0.16 ? 4 : u < 0.36 ? 3 : u < 0.62 ? 2 : u < 0.86 ? 1 : 0);
    for (let y = tTop; y <= tBot; y++) for (let x = tx0; x < W; x++) {
      const u = (x - tx0) / (tx1 - tx0);
      let lv = tankLv(u);
      const rib = (y - tTop - 6) % 11;
      if (y > tTop + 4 && rib === 0) lv = Math.min(7, lv + 1); // raised rib: lit top edge
      if (y > tTop + 4 && rib === 1 && lv < 7) lv = Math.max(0, lv - 1); // and its shadow
      if (y > tBot - 3) lv = Math.max(0, lv - 1);
      if (u > 0.1 && ih(x >> 1, 3, 77) < 0.12 && (y - tTop) > 20 + ih(x >> 1, 4, 77) * 40 && lv > 0) lv -= 1; // dust runs
      S.px(x, y, TR[lv]);
    }
    // top: the domed lid seen from above, its far rim catching the sky
    const tkx = (tx0 + tx1) / 2;
    S.ellipse(tkx, tTop, (tx1 - tx0) / 2, 8, (x, y) => (y < tTop - 5 ? C.k6 : x < tkx - 20 ? C.k5 : C.k4));
    S.ellipse(tkx + 2, tTop - 1, 15, 4, C.k2);
    S.ellipse(tkx + 2, tTop - 2, 13, 3, (x) => (x < tkx - 4 ? C.k5 : C.k3));
    S.hline(Math.round(tkx - 6), Math.round(tkx + 6), tTop - 5, C.k6);
    for (let x = tx0 + 2; x < tx0 + 40; x++) { const k = (x - tx0) / ((tx1 - tx0) / 2) - 1; S.px(x, Math.round(tTop - Math.sqrt(Math.max(0, 1 - k * k)) * 8), x < tx0 + 22 ? C.h2 : C.h0); }
    S.vline(tx0, tTop, tBot - 2, C.h1); S.vline(tx0 + 1, tTop + 2, tBot - 4, C.k7);
    // brick stand
    for (let y = tBot + 1; y < 524; y++) for (let x = tx0 + 6; x < W; x++) {
      const row = (y - tBot - 1) >> 2, off = (row & 1) * 4;
      const mortar = (y - tBot - 1) % 4 === 3 || (x + off) % 8 === 0;
      S.px(x, y, mortar ? C.k2 : (x - tx0 < 9 ? C.o0 : C.c1));
    }
    // overflow and inlet pipes
    S.vline(tx0 + 12, tTop + 26, 524, C.k1); S.vline(tx0 + 13, tTop + 26, 524, C.k5); S.vline(tx0 + 14, tTop + 26, 524, C.k2);
    S.hline(tx0 + 12, tx0 + 20, tTop + 25, C.k5); S.hline(tx0 + 12, tx0 + 20, tTop + 26, C.k2);
    S.sprite(tx0 + 8, 500, ['.yy.', 'yyyy', '.oo.', '.o..', '.w..'], { y: C.y1, o: C.y0, w: C.h1 }); // brass tap, a bead of water
    S.px(tx0 + 9, 500, C.h4);
    // ---- two pigeons on the coping, wary of the cat
    const pig = [
      '...hhh.........',
      '..hhhhh........',
      '.bhehhh........',
      '..hhhhh........',
      '...nnnn........',
      '...nnnnnw......',
      '...nnwwwwww....',
      '...nwwwkwwwwt..',
      '....wwwwkwwwttt',
      '....wwwwwwwwtt.',
      '.....wwwwww....',
      '.......ll......',
      '......l..l.....',
    ];
    for (const [px0, flip] of [[214, false], [244, true]]) {
      const py = capY + Math.round((px0 - 216) * 0.012) - 1;
      litSprite(px0, py - pig.length, pig, { h: C.k6, e: C.o2, b: C.k3, n: C.t2, w: C.k6, k: C.k4, t: C.k4, l: C.o1 }, flip ? 1 : -1, C.h1, 'hnw', C.k7, flip);
      // iridescent neck, darker wing bars
      S.px(px0 + (flip ? 10 : 4), py - pig.length + 5, C.g3); S.px(px0 + (flip ? 9 : 5), py - pig.length + 6, C.m1);
    }
    // ---- the cat on the coping, back to us, watching the city (ginger tabby, lit from the left)
    drawCat(326, capY + Math.round((326 - 216) * 0.012) - 1);
    // ---- tulsi in its whitewashed planter, a clay diya burning in the niche
    const vx = 40, vTop = 438, vBot = 522, vw = 34;
    for (let y = vTop; y <= vBot; y++) for (let x = vx; x < vx + vw; x++) {
      const u = (x - vx) / vw;
      let c = u < 0.12 ? C.h0 : u < 0.55 ? C.k6 : C.k5;
      if ((y - vTop) % 14 === 0) c = C.k4;
      if (y < vTop + 3) c = (y === vTop ? C.h2 : C.k7);
      S.px(x, y, c);
    }
    // stepped plinth
    S.rect(vx - 3, vBot - 6, vw + 6, 7, (x, y) => (y === vBot - 6 ? C.h0 : x < vx ? C.k6 : C.k4));
    // saffron border band and painted swastika-free simple motifs: dots
    S.hline(vx, vx + vw - 1, vTop + 6, C.o1); S.hline(vx, vx + vw - 1, vTop + 7, C.o0);
    for (let x = vx + 3; x < vx + vw - 2; x += 5) S.px(x, vTop + 10, C.o2);
    // the niche with the diya
    const nx = vx + 11, ny = vTop + 24;
    S.rect(nx, ny, 12, 14, C.k1);
    S.ellipse(nx + 6, ny, 6, 4, C.k1);
    for (let y = ny - 3; y < ny + 14; y++) for (let x = nx; x < nx + 12; x++) {
      const d = Math.hypot(x - (nx + 6), (y - (ny + 10)) * 1.3);
      if (S.get(x, y) === C.k1 && d < 9) S.px(x, y, d < 4 ? C.o0 : d < 7 ? C.m0 : C.k2);
    }
    S.sprite(nx + 3, ny + 9, ['.oooo.', 'oooooo'], { o: C.o1 });
    S.sprite(nx + 5, ny + 4, ['.h', 'hh', 'hl', 'ly'], { h: C.h6, l: C.l0, y: C.o3 });
    // warm spill on the plinth
    S.hline(nx + 1, nx + 10, ny + 14, C.o1); S.hline(nx + 3, nx + 8, ny + 15, C.o0);
    // the tulsi bush: upright, many-stemmed, purple-tipped
    const tr = mulberry32(7);
    for (let k = 0; k < 9; k++) { const x = Math.round(vx + 5 + tr() * (vw - 10)); S.line(x, vTop - 1, x + (tr() - 0.5) * 10, vTop - 14 - tr() * 16, C.c0); }
    const tcx = vx + vw / 2;
    const tDens = (x, y) => {
      const dy = (vTop - 1 - y) / 40, dx = (x - tcx) / (12 + 14 * Math.sin(Math.min(1, dy * 1.6) * Math.PI / 2));
      return y > vTop - 1 || dy > 1.05 ? -1 : (1 - Math.hypot(dx, (dy - 0.45) * 1.7)) * 0.9 + 0.25 * (vn2(x / 3, 0, 8) - 0.5);
    };
    foliage(vx - 14, vTop - 46, vx + vw + 14, vTop - 1, tDens, [C.g0, C.g1, C.g2, C.g3, C.g4], [C.m0, C.m1, C.p0, C.p1],
      (x, y) => 0.14 * sstep(vTop - 12, vTop - 34, y), -0.8, -0.6, 13);
    for (let k = 0; k < 12; k++) { // flower spikes rising above the leaves
      const x = Math.round(tcx - 14 + tr() * 28), y0 = Math.round(vTop - 24 - tr() * 18);
      if (tDens(x, y0 + 4) < 0) continue;
      for (let j = 0; j < 4; j++) S.px(x, y0 + j, j === 0 ? C.p1 : j === 1 ? C.p0 : C.m1);
    }
    // ---- small things on the wet floor: a brass lota for the evening offering, chappals, a steel bucket under the tap
    S.sprite(14, 516, [
      '...nn...',
      '..yyyy..',
      '.yyhyyy.',
      'yyhhyyyo',
      'yyhyyyoo',
      'yyyyyooo',
      '.yyyooo.',
      '..oooo..',
    ], { n: C.y1, y: C.y2, h: C.h5, o: C.y1 });
    S.hline(15, 21, 524, C.y0); S.px(16, 525, C.y1); S.px(19, 526, C.y0); // its reflection in the wet floor
    S.sprite(86, 528, ['..bb.....bb..', '.bkkb...bkkb.', 'kkkkkk.kkkkkk', 'kkkkkk.kkkkkk', '.kkkk...kkkk.'], { b: C.b1, k: C.k5 });
    S.px(88, 528, C.t3); S.px(95, 528, C.t3); S.hline(87, 91, 533, C.k3); S.hline(94, 98, 533, C.k3);
    S.sprite(362, 521, [
      'whhhhhhhhhw',
      'kt0000000tk',
      '.w6666655k.',
      '.w6666554k.',
      '.w6665544k.',
      '.w6665544k.',
      '.w6655444k.',
      '.w6655444k.',
      '..w55444k..',
    ], { w: C.w0, h: C.h0, k: C.k3, t: C.k5, '0': C.k4, '6': C.k7, '5': C.k6, '4': C.k5 });
    S.px(364, 522, C.h1); S.px(369, 522, C.h1); // the water in it, catching a drip of sky
    S.px(361, 509, C.h0); S.px(361, 513, C.k6); S.px(361, 517, C.k6); // a drip falling from the tap
    // ---- bougainvillea climbing the bamboo pole and spilling across the coping
    drawBougainvillea();
    // ---- foreground laundry line, tied to the bamboo pole
    drawNearLaundry();
  }

  function drawCat(cx, by) {
    // a ginger cat sitting with its back to us; silhouette from a smooth width profile
    const keys = [[0, 13], [-2, 14.5], [-6, 15.2], [-11, 14], [-17, 11.5], [-23, 9], [-27, 7], [-29, 6.6]];
    const body = (dy) => {
      if (dy > 0 || dy < -29) return -1;
      for (let k = 0; k < keys.length - 1; k++) { const [a0, w0] = keys[k], [a1, w1] = keys[k + 1]; if (dy <= a0 && dy >= a1) { const t = (a0 - dy) / (a0 - a1); return lerp(w0, w1, t * t * (3 - 2 * t)); } }
      return -1;
    };
    const head = (dy) => { const t = (dy + 35) / 6.8; return Math.abs(t) > 1 ? -1 : 7.6 * Math.sqrt(1 - t * t); };
    const inCat = (x, y) => {
      const dx = x + 0.5 - cx, dy = y - by;
      const hw = Math.max(body(dy), head(dy));
      if (hw > 0 && Math.abs(dx + (dy < -28 ? 0.8 : 0)) <= hw) return true;
      // ears: two triangles leaning out
      if (dy <= -39 && dy >= -47) { const t = (dy + 47) / 8; const e1 = -5.2 - (1 - t) * 0.6, e2 = 3.6 + (1 - t) * 0.6; const ew = t * 2.6 + 0.2; if (Math.abs(dx - e1) <= ew || Math.abs(dx - e2) <= ew) return true; }
      return false;
    };
    for (let y = by - 48; y <= by; y++) {
      let L = 1e9, R = -1e9;
      for (let x = cx - 18; x <= cx + 18; x++) if (inCat(x, y)) { if (x < L) L = x; if (x > R) R = x; }
      if (L > R) continue;
      for (let x = L; x <= R; x++) {
        if (!inCat(x, y)) continue;
        const dl = x - L, dr = R - x, dy = y - by;
        let c = C.o1;
        if (dr <= 5) c = C.o0;
        if (dr <= 1) c = C.m0;
        if (dl <= 3) c = C.o2;
        if (dl <= 1) c = C.o3;
        if (dl <= 0) c = C.h4;
        if (!inCat(x, y - 1) && dl < (R - L) * 0.45) c = dl <= 2 ? C.h4 : C.o3; // sky light on the top contours
        if (dy < -39 && head(dy) < 0) { // ears: dark inner fur, lit outer edge
          const dx = x + 0.5 - cx, t = (dy + 47) / 8, ec = dx < 0 ? -5.2 - (1 - t) * 0.6 : 3.6 + (1 - t) * 0.6, ew = t * 2.6 + 0.2;
          if (Math.abs(dx - ec) < ew - 1 && t > 0.3) c = C.m0;
        }
        if (dy >= -31 && dy <= -29 && dr <= 6 && dr > 1) c = C.m0; // shadow under the jaw on the far side
        S.px(x, y, c);
      }
    }
    // short tabby dashes following the curve of the back
    const dashes = [[-3, -24, 4], [2, -22, 3], [-5, -19, 5], [1, -17, 5], [-7, -13, 4], [-1, -12, 6], [6, -14, 3], [-6, -8, 5], [1, -7, 6], [8, -9, 3], [-2, -3, 5]];
    for (const [dx, dy, len] of dashes) for (let k = 0; k < len; k++) { const x = cx + dx + k, y = by + dy + Math.round(sq(dx + k) * 0.02); const c = S.get(x, y); S.px(x, y, c === C.o2 ? C.o1 : c === C.o1 ? C.o0 : c === C.o0 ? C.m0 : c); }
    S.px(cx - 6, by - 47, C.h5); S.px(cx + 3, by - 47, C.o2);
    S.px(cx - 10, by - 33, C.h3); S.px(cx - 11, by - 32, C.o2); // whisker tips past the cheek
    // tail draped over the coping toward us
    const tail = [[13, -2], [14, -1], [15, 0], [15, 1], [16, 2], [16, 3], [16, 4], [16, 5], [15, 6], [15, 7], [15, 8], [16, 9], [17, 10], [18, 11]];
    tail.forEach(([dx, dy], k) => { S.px(cx + dx, by + dy, k % 4 === 1 ? C.o0 : C.o1); S.px(cx + dx + 1, by + dy, C.o0); S.px(cx + dx + 2, by + dy, C.m0); });
  }

  function drawBougainvillea() {
    const r = mulberry32(31);
    const poleX = 100;
    for (let y = 118; y < 470; y++) {
      S.px(poleX, y, y > HY ? C.y0 : C.y1); S.px(poleX + 1, y, C.c1);
      S.px(poleX - 1, y, y > HY ? C.c2 : C.h1);
      if (y % 26 === 0) { S.hline(poleX - 1, poleX + 1, y, y > HY ? C.y1 : C.h3); S.px(poleX + 2, y, C.c0); }
    }
    // trunk stems twisting up out of an old paint drum behind the coping
    const capAt = (x) => 466 + Math.round((x - 216) * 0.012);
    const blobs = [[134, 456, 50, 12], [118, 448, 20, 14], [102, 424, 7, 26], [101, 398, 5, 16], [76, 462, 24, 8], [172, 464, 30, 7], [150, 476, 30, 7], [120, 475, 14, 7], [204, 466, 10, 4]];
    const dens = (x, y) => {
      let m = -1;
      for (const [cx, cy, rx, ry] of blobs) m = Math.max(m, 1 - Math.hypot((x - cx) / rx, (y - cy) / ry));
      return m;
    };
    for (let k = 0; k < 9; k++) { const x0 = 90 + r() * 90; S.line(x0, capAt(x0) + 30, x0 + (r() - 0.5) * 30, capAt(x0) - 6, C.c0); }
    foliage(50, 360, 220, 505, dens, [C.g0, C.g1, C.g2, C.g3], [C.m0, C.m1, C.m2, C.m3],
      (x, y) => 0.48 - 0.28 * sstep(440, 385, y) - 0.2 * sstep(470, 490, y), -0.7, -0.7, 71);
    // tiny white true flowers in the brightest bracts
    for (let k = 0; k < 40; k++) { const x = 60 + fl(r() * 150), y = 380 + fl(r() * 100); if (S.get(x, y) === C.m3 && S.get(x + 1, y) !== C.w1) S.px(x, y, C.w1); }
    // trailing sprays hanging down our side of the parapet
    for (let k = 0; k < 6; k++) {
      let x = 120 + r() * 80, y = capAt(x) + 4;
      const len = 8 + r() * 18;
      for (let t = 0; t < len; t++) { S.px(Math.round(x), Math.round(y), t % 3 === 0 ? C.m1 : C.g1); if (t % 4 === 1) S.px(Math.round(x) + 1, Math.round(y), C.m2); x += Math.sin(t * 0.4 + k) * 0.5; y += 1; }
    }
  }

  function drawNearLaundry() {
    // line from beyond the left edge to the bamboo pole; backlit cloth hanging across the horizon
    const ax = -10, ay = 104, bx = 100, by = 124;
    const lineY = (x) => ay + (by - ay) * ((x - ax) / (bx - ax)) + 22 * 4 * ((x - ax) / (bx - ax)) * (1 - (x - ax) / (bx - ax));
    for (let x = 0; x <= bx; x++) S.px(x, Math.round(lineY(x)), C.k1);
    const items = [
      { x0: 0, w: 14, len: 52, col: 'w1', kind: 'kurta' },
      { x0: 17, w: 32, len: 126, col: 'm2', kind: 'sari', border: 'y2' },
      { x0: 52, w: 14, len: 24, col: 't3', kind: 'shirt' },
      { x0: 69, w: 24, len: 100, col: 'o2', kind: 'sari', border: 'g3' },
      { x0: 94, w: 5, len: 11, col: 'y2', kind: 'cloth' },
    ];
    const ramps = {
      w1: [C.k5, C.k7, C.h1, C.w0, C.w1], m2: [C.m0, C.m1, C.m2, C.m3, C.h3], t3: [C.t0, C.t1, C.t2, C.t3, C.l1],
      o2: [C.o0, C.o1, C.o2, C.o3, C.h4], y2: [C.y0, C.y1, C.y2, C.h4, C.h5],
    };
    for (const it of items) {
      const rp = ramps[it.col];
      for (let i = 0; i < it.w; i++) {
        const x = it.x0 + i;
        const top = Math.round(lineY(x)) + 1;
        // wind lifts the lower hem to the right; folds run down the fabric
        const fold = Math.sin(i * 0.62 + it.x0) * 0.6 + Math.sin(i * 0.23 + it.x0 * 0.3) * 0.4;
        const len = it.len + Math.round(Math.sin(i * 0.3 + it.x0) * 3) - (it.kind === 'shirt' && (i < 4 || i > it.w - 5) ? 10 : 0);
        for (let j = 0; j < len; j++) {
          const y = top + j;
          const sway = Math.round((j / it.len) * (j / it.len) * 7);
          const xx = x + sway;
          // backlight: the glowing sky behind shines through thin cloth
          const sky = sstep(120, 205, y) * (1 - 0.55 * sstep(214, 250, y)) * (0.75 + 0.25 * Math.exp(-sq((xx - SUNX) / 160)));
          const fq = fold > 0.35 ? 1 : fold < -0.35 ? -1 : 0; // folds as clean vertical bands
          let v = 0.22 + sky * 0.62 + fq * 0.17;
          if (i === 0 || i === it.w - 1) v -= 0.25;
          if (j < 2) v -= 0.15;
          let c = rp[clamp(Math.round(v * (rp.length - 1)), 0, rp.length - 1)];
          if (it.border && (j > len - 6 || i < 3)) c = ramps[it.border] ? ramps[it.border][clamp(Math.round(v * 4), 0, 4)] : (v > 0.5 ? C.h4 : C.y1);
          if (it.border && !ramps[it.border] && (j > len - 6 || i < 3)) c = v > 0.55 ? C.g4 : v > 0.3 ? C.g3 : C.g2;
          if (it.kind === 'sari' && (j % 9 === 4) && ((i + j) % 4 === 0) && j < len - 6) c = it.col === 'm2' ? C.y2 : C.y1; // zari buttis
          if (it.kind === 'kurta' && j < 6 && (i < 6 || i > it.w - 7)) c = rp[0];
          S.px(xx, y, c);
        }
      }
      // wooden clothes pegs
      S.px(it.x0 + 1, Math.round(lineY(it.x0 + 1)), C.y1); S.px(it.x0 + it.w - 2, Math.round(lineY(it.x0 + it.w - 2)), C.y1);
    }
  }

  /* =================================================================== sky life */
  function drawSkyLife() {
    // the boy's kite, high in the warm gap, with its string falling to his hands
    const kx = 300, ky = 150;
    if (BOYHAND) {
      const [hx, hy] = BOYHAND;
      const n = Math.ceil(Math.hypot(kx - hx, ky - hy));
      for (let k = 0; k < n; k++) {
        const t = k / n;
        const x = lerp(hx, kx, t) + Math.sin(t * Math.PI) * 6, y = lerp(hy, ky + 4, t) + Math.sin(t * Math.PI) * 14;
        S.px(Math.round(x), Math.round(y), y < HY ? C.k3 : (S.get(Math.round(x), Math.round(y)) === C.k6 || S.get(Math.round(x), Math.round(y)) === C.k7 ? C.h0 : C.k7));
      }
    }
    // the patang: a diamond of magenta and marigold paper on a bamboo spine, tail ribbon streaming downwind
    S.sprite(kx - 5, ky - 6, [
      '.....m.....',
      '....mmm....',
      '...Mmmmy...',
      '..MMmmyyy..',
      '.MMmmmyyyY.',
      'MMmmmmyyyYY',
      '.MMmmmyyyY.',
      '..MMmmyyY..',
      '...Mmmyy...',
      '....Mmy....',
      '.....y.....',
    ], { m: C.m2, M: C.m3, y: C.y2, Y: C.h4 });
    for (let y = ky - 5; y <= ky + 3; y++) S.px(kx, y, y < ky - 1 ? C.m1 : C.y1); // the bamboo spine, a shade under the paper
    const tail = [[0, 5], [0, 6], [1, 7], [2, 8], [2, 9], [3, 10], [4, 11], [4, 12], [5, 13], [6, 14]];
    tail.forEach(([dx, dy], k) => S.px(kx + dx, ky + dy, k % 3 === 2 ? C.y2 : C.o2));
    S.sprite(kx - 1, ky + 5, ['y.y'], { y: C.o1 });
    // two more kites far off, and a black kite (the bird) circling
    S.sprite(250, 152, ['.t.', 'ttw', '.w.'], { t: C.t2, w: C.w0 });
    S.px(251, 155, C.k4); S.px(250, 156, C.k4);
    S.sprite(388, 168, ['.o.', 'oor', '.r.'], { o: C.o2, r: C.r1 });
    S.px(389, 171, C.k4);
    const birds = [[214, 96, 1], [233, 88, 0], [380, 70, 1], [150, 118, 0], [158, 113, 1], [168, 122, 0]];
    for (const [bx, by, f] of birds) {
      S.sprite(bx, by, f ? ['k...k', '.k.k.', '..k..'] : ['.....', 'kk.kk', '..k..'], { k: C.k1 });
    }
    // pigeons crossing the glow
    for (const [bx, by] of [[200, 182], [206, 186], [196, 189], [212, 179]]) S.sprite(bx, by, ['k.k', '.k.'], { k: C.k3 });
  }

  /* =================================================================== rain shafts in the distance */
  function drawRain() {
    // a rain curtain hanging from the deck on the right: slanted, broken streaks one step darker than the air
    const darker = {};
    const seq = [C.k1, C.k2, C.k3, C.k4, C.k5, C.k6, C.k7, C.h0, C.h1, C.h2];
    for (let k = 1; k < seq.length; k++) darker[seq[k]] = seq[k - 1];
    darker[C.p0] = C.k6; darker[C.p1] = C.h0; darker[C.h3] = C.h2;
    for (let y = 100; y < HY + 10; y++) for (let x = 280; x < W; x++) {
      if (CLOUD[y * W + x] || S.getTag(x, y) !== 0) continue;
      const col = x - (y - 100) * 0.22;
      const dens = sstep(300, 360, col) * (0.55 + 0.45 * vn2(col / 18, 0, 4)) * (1 - sstep(HY - 30, HY + 6, y) * 0.6);
      const st = vn2(col / 1.6, y / 26, 13);
      if (st * dens > 0.5) { const c = S.get(x, y); if (darker[c] !== undefined) S.px(x, y, darker[c]); }
    }
  }

  /* =================================================================== compose */
  function render() {
    S = PX.Surface(W, H, PAL);
    BLD = []; BOYHAND = null;
    S.setTag(0);
    drawSky();
    drawRain();
    S.setTag(5);
    S.rect(0, HY + 41, W, H - HY - 41, C.k1); // the deep slots between buildings
    S.setTag(1);
    drawFarBands(500, 2000);
    drawTemple(140, HY + 10, 240);
    drawMosque(356, HY + 12, 260);
    drawFarBands(0, 499);
    buildCity();
    // people and palms
    const pick = (fn) => { let best = null; for (const b of BLD) if (fn(b) && (!best || fn(b) > fn(best))) best = b; return best; };
    const covers = (b, sx, zlo, zhi) => b.z0 >= zlo && b.z0 <= zhi && proj(b.x0, 0, b.z0)[0] < sx - 8 && proj(b.x1, 0, b.z0)[0] > sx + 8;
    let boyB = null;
    for (const b of BLD) if (covers(b, BOYX, 30, 46) && (!boyB || b.z0 < boyB.z0)) boyB = b;
    if (boyB) {
      boyB.floors = 4; boyB.h = 4 * 3.1 + 0.2; boyB.unfinished = false; boyB.roof = 0; boyB.wet = 0.9;
      const Zb = boyB.z0 + 2.6;
      boyB.special = [{ k: 'boy', X: (BOYX - CX) * Zb / F, Z: Zb }]; boyB.paint = [92, 172, 168]; boyB.balcony = true;
      boyB.noClutter = true;
      const Zw = boyB.z0 + 4.2;
      boyB.special.push({ k: 'woman', X: (168 - CX) * Zw / F, Z: Zw });
    }
    const womB = pick((b) => { const [x] = proj(b.x0, b.h, b.z0); return b.z0 > 30 && b.z0 < 50 && Math.abs(x - 80) < 40 && b !== boyB ? 100 - Math.abs(x - 80) : 0; });
    if (womB) womB.special = [{ k: 'woman', X: womB.x0 + 2.2, Z: womB.z0 + 3 }, { k: 'laundry', X: womB.x0 + 3, Z: womB.z0 + 3.4, len: 4.5, seed: 77 }];
    const extra = [
      { z: 140, X: -30, kind: 'palm', hgt: 19, lean: 3, seed: 1 }, { z: 150, X: -26, kind: 'palm', hgt: 16, lean: -2, seed: 2 },
      { z: 95, X: 30, kind: 'palm', hgt: 21, lean: 2.5, seed: 3 }, { z: 210, X: 70, kind: 'palm', hgt: 18, lean: -1.5, seed: 4 },
      { z: 75, X: -36, kind: 'tree', rad: 6, seed: 5 }, { z: 180, X: 10, kind: 'tree', rad: 7, seed: 6 },
      { z: 260, X: -95, kind: 'palm', hgt: 20, lean: 2, seed: 7 },
      { z: 165, X: 89.5, kind: 'mast', base: 15.7, hgt: 30 },
    ];
    const draws = BLD.map((b) => ({ z: b.z0, side: Math.abs((b.x0 + b.x1) / 2), b }));
    for (const e of extra) draws.push({ z: e.z, side: 0, e });
    draws.sort((a, c) => (c.z - a.z) || (c.side - a.side));
    for (const d of draws) {
      if (d.b) drawBuilding(d.b);
      else if (d.e.kind === 'palm') { S.setTag(2); drawPalm({ X: d.e.X, Z: d.e.z, hgt: d.e.hgt, lean: d.e.lean, seed: d.e.seed }, null); }
      else if (d.e.kind === 'mast') { S.setTag(2); drawMast(d.e.X, d.e.z, d.e.base, d.e.hgt); }
      else { S.setTag(2); drawTree(d.e.X, d.e.z, d.e.rad, d.e.seed); }
    }
    // street light spilling up out of the lanes below the parapet line
    for (let y = 400; y < 470; y++) for (let x = 0; x < W; x++) {
      const c = S.get(x, y);
      if ((c !== C.k0 && c !== C.k1) || S.getTag(x, y) < 5) continue;
      const v = sstep(408, 466, y) + (bayer(x, y) - 0.5) * 0.12;
      S.px(x, y, v > 0.75 ? C.o0 : v > 0.5 ? C.m0 : v > 0.28 ? C.k2 : c);
    }
    // wires: cable bundles slung between poles across the middle distance
    S.setTag(3);
    const wc = C.k1;
    catenary(-2, 318, 236, 352, 18, wc); catenary(-2, 322, 236, 354, 22, wc); catenary(-2, 327, 236, 358, 20, C.k2);
    catenary(236, 352, 434, 300, 16, wc); catenary(236, 356, 434, 306, 20, wc);
    catenary(140, 268, 434, 250, 10, C.k2);
    // the pole that holds them
    S.vline(236, 344, 448, C.k1); S.vline(237, 344, 448, C.k3); S.hline(231, 242, 350, C.k1); S.px(236, 343, rimColour(236, 30));
    drawKite(176, 349, 3, C.y2, C.r1, true); drawKite(330, 331, 3, C.t2, C.w0, true); drawKite(60, 337, 3, C.m2, C.w0, false);
    S.setTag(4);
    drawSkyLife();
    drawForeground();
    return S;
  }
  function stats(Sf) { const seen = new Set(Sf.buf); return seen.size + ' / ' + PAL.N; }
  window.PIECE = { render, stats };
})();
