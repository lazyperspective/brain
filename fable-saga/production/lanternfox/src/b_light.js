  /* ================================================================ light: materials, the lantern, deferred layers
     A surface is a material (an albedo, and the palette colours it may resolve to) lit by three lights: the scene's
     ambient floor, its sky light (moon or dusk, scaled by the surface's shade s, where texture, AO and form live) and
     the lantern (l: falloff × Lambert × the cage's shadows). Each scene builds a table TAB[m][s][l] → palette index
     once; a lit pixel is one dithered table lookup. Static scenery is painted once into G-buffer layers (material,
     shade, depth, normal, sparkle seed) and shaded per frame, so the warm pool really slides over everything. */
  const MATS = [null];
  function defMat(hex, pal, o) {
    o = o || {};
    MATS.push({ rgb: [parseInt(hex.slice(0, 2), 16) / 255, parseInt(hex.slice(2, 4), 16) / 255, parseInt(hex.slice(4, 6), 16) / 255], pal: pal || NATURAL, gloss: o.gloss || 0, lampK: o.lampK === undefined ? 1 : o.lampK });
    return MATS.length - 1;
  }
  const NS = 18, NL = 14, SQ = 10, LQ = 6;                    // shade levels (0 .. 1.7, steps of 0.1), lamp levels (0 .. 2.17, steps of 1/6)
  // a lighting rig: rgb (0..1+) of the ambient floor, the sky light at s = 1, the lantern at l = 1
  function mkRig(amb, sky, lamp) {
    const NM = MATS.length, tab = new Uint8Array(NM * NS * NL);
    for (let m = 1; m < NM; m++) {
      const M = MATS[m], a = M.rgb;
      for (let si = 0; si < NS; si++) for (let li = 0; li < NL; li++) {
        const s = si / SQ, l = li / LQ * M.lampK;
        const rgb = [0, 1, 2].map((k) => {
          let v = a[k] * (amb[k] + s * sky[k] + l * lamp[k]);
          if (l > 1) v += (l - 1) * 0.3 * lamp[k];                  // the hot core near the flame
          if (s > 1) v += (s - 1) * (0.25 + M.gloss) * sky[k];      // a sheen past full light
          return v;
        });
        // a soft shoulder that keeps the hue (warm light on white fur goes cream, not blank white)
        const mx = Math.max(rgb[0], rgb[1], rgb[2]), kn = 0.82;
        if (mx > kn) { const k = (kn + (1.02 - kn) * (1 - Math.exp(-(mx - kn) / (1.02 - kn)))) / mx; for (let q = 0; q < 3; q++) rgb[q] *= k; }
        for (let q = 0; q < 3; q++) rgb[q] = clamp(rgb[q] * 255, 0, 255);
        tab[(m * NS + si) * NL + li] = nearestIn(rgb[0], rgb[1], rgb[2], M.pal);
      }
    }
    return tab;
  }
  let TAB = null;
  // a lit colour: material m, shade s, lamp l, at screen (X, Y); dithered between levels with a narrowed seam
  // the same with a narrower dither seam (characters: crisper, calmer bands)
  function mcq(m, s, l, X, Y) {
    const b = BAYF[((Y & 7) << 3) | (X & 7)];
    let si = (s * SQ + 0.5 + (b - 0.5) * 0.5) | 0, li = (l * LQ + 0.5 + (BAYF[(((Y + 3) & 7) << 3) | ((X + 5) & 7)] - 0.5) * 0.6) | 0;
    si = si < 0 ? 0 : si >= NS ? NS - 1 : si; li = li < 0 ? 0 : li >= NL ? NL - 1 : li;
    return TAB[(m * NS + si) * NL + li];
  }
  function mc(m, s, l, X, Y) {
    const b = BAYF[((Y & 7) << 3) | (X & 7)];
    let si = (s * SQ + 0.5 + (b - 0.5) * 0.9) | 0, li = (l * LQ + 0.5 + (BAYF[(((Y + 3) & 7) << 3) | ((X + 5) & 7)] - 0.5) * 0.9) | 0;
    si = si < 0 ? 0 : si >= NS ? NS - 1 : si; li = li < 0 ? 0 : li >= NL ? NL - 1 : li;
    return TAB[(m * NS + si) * NL + li];
  }

  /* ---------------------------------------------------------------- the lantern as a light
     LAMP: screen position (x, y), depth z, intensity I, reach R (screen px), rot (the cage's turn, for its spoke
     shadows), on. Depth is in screen px at zoom 1. Shadow casters: ellipses on the ground that block the lamp (the fox's
     own shadow, thrown back from the flame) or the sky (contact shadows). */
  const LAMP = { on: 0, x: 0, y: 0, z: 0, I: 0, R: 40, rot: 0, zoom: 1, cut: 0, h: 16 };
  const SHAD = [];                                           // {x, y, rx, ry, a, lamp: 1 blocks the lamp / 0 the sky}
  // the lamp's light reaching a surface at screen (X, Y), depth zp, normal (nx, ny) (toward the camera nc ≥ 0)
  function lampAt(X, Y, zp, nx, ny) {
    if (!LAMP.on) return 0;
    const dx = X + 0.5 - LAMP.x, dy = Y + 0.5 - LAMP.y, R = LAMP.R, Rm = R * 3.2;
    if (dx > Rm || dx < -Rm || dy > Rm || dy < -Rm) return 0;
    const dz = (zp - LAMP.z) * LAMP.zoom;
    if (ny < -0.99) {
      // the ground (normal straight up): the lamp hangs LAMP.h above it; screen rows here mean depth, not height
      const hh = LAMP.h * LAMP.zoom, g2 = dx * dx + dz * dz + hh * hh;
      if (g2 >= Rm * Rm) return 0;
      const w = 1 - g2 / (Rm * Rm), fall = w * w / (1 + g2 / (R * R)), lam = Math.min(1, 1.25 * hh / Math.sqrt(g2) + 0.12);
      let cage = 1;
      if (g2 > 36) { const a = Math.atan2(dz * 1.6, dx) * 2 + LAMP.rot, c = Math.cos(a); cage = 1 - 0.2 * c * c * c * c; }
      return LAMP.I * fall * lam * cage;
    }
    const d2 = dx * dx + dy * dy + dz * dz;
    if (d2 >= Rm * Rm) return 0;
    const w = 1 - d2 / (Rm * Rm), fall = w * w / (1 + d2 / (R * R));
    const d = Math.sqrt(d2) + 0.001, nc = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
    const dot = (-nx * dx - ny * dy + nc * dz) / d, lam = dot < -0.5 ? 0 : (dot + 0.5) / 1.5;
    // the cage: four bars throw soft spokes of shadow; the cap shades what is above the flame
    let cage = 1;
    if (d2 > 36) { const a = Math.atan2(dy, dx * 0.8) * 2 + LAMP.rot, c = Math.cos(a); cage = 1 - 0.22 * c * c * c * c; }
    if (dy < -4) { const up = -dy / d; if (up > 0.8) cage *= 1 - 0.5 * sstep(0.8, 0.97, up) * sstep(4, 20, -dy); }
    return LAMP.I * fall * lam * cage;
  }
  function shadAt(X, Y, lampOnly) {
    let a = 0;
    for (let k = 0; k < SHAD.length; k++) {
      const S = SHAD[k]; if (S.lamp !== lampOnly) continue;
      const u = (X + 0.5 - S.x) / S.rx, v = (Y + 0.5 - S.y) / S.ry, q = u * u + v * v;
      if (q < 1) { const f = (1 - q) * S.a; if (f > a) a = f; }
    }
    return a > 1 ? 1 : a;
  }

  /* ---------------------------------------------------------------- G-buffer layers */
  // M: material (0 empty, 255 = unlit: S holds a palette index), S: shade × 150, Z: depth (z0 + Z·zk), N: normal (x, y)
  // × 127, F: sparkle seed (0 none). recv: does it take shadows (the ground). fog: haze level (0..1) toward FOGT.
  function mkLayer(w, h, o) {
    o = o || {};
    return { w, h, M: new Uint8Array(w * h), S: new Uint8Array(w * h), Z: new Uint8Array(w * h), N: new Int8Array(w * h * 2), F: new Uint8Array(w * h), z0: o.z0 || 0, zk: o.zk || 1, recv: !!o.recv };
  }
  function lput(L, x, y, m, s, z, nx, ny, f) {
    x = fl(x); y = fl(y); if (x < 0 || y < 0 || x >= L.w || y >= L.h) return;
    const i = y * L.w + x;
    L.M[i] = m; L.S[i] = clamp(Math.round(s * 150), 0, 255); L.Z[i] = clamp(Math.round(z), 0, 255);
    L.N[i * 2] = clamp(Math.round((nx || 0) * 127), -127, 127); L.N[i * 2 + 1] = clamp(Math.round((ny || 0) * 127), -127, 127);
    L.F[i] = f || 0;
  }
  const lputC = (L, x, y, c) => { x = fl(x); y = fl(y); if (x < 0 || y < 0 || x >= L.w || y >= L.h) return; const i = y * L.w + x; L.M[i] = 255; L.S[i] = c; L.F[i] = 0; };
  let FOGT = T_NIGHT;                                         // the scene's haze table (mkTab toward its haze colour)
  let SPK_SNOW = 0;                                           // which material sparkles (snow), and the sparkle palette
  const SPK = { t: 0, rate: 1 };
  /* draw a layer: layer point (ox, oy) lands at the screen centre (240, 135), magnified zoom; fog f (+ fy per row below
     the layer's mist line, for low mist); clip rows [ya, yb] */
  function comp(L, ox, oy, zoom, fog, opt) {
    opt = opt || {};
    const iz = 1 / zoom, w = L.w, h = L.h, M = L.M, S = L.S, Z = L.Z, N = L.N, F = L.F, z0 = L.z0, zk = L.zk, recv = L.recv;
    const ya = Math.max(ROW0, opt.ya === undefined ? ROW0 : opt.ya), yb = Math.min(ROW1, opt.yb === undefined ? ROW1 : opt.yb);
    const mist = opt.mist || 0, mistY = opt.mistY || 0, mistH = opt.mistH || 40, sk = opt.noSpark ? 0 : SPK_SNOW, t = SPK.t;
    const lamp = LAMP.on && !opt.noLamp, Rm = LAMP.R * 3.2, hasSh = SHAD.length > 0 && recv, dark = opt.dark || 0;
    const cust = opt.custom || null, cm0 = opt.cm0 || 0, cm1 = opt.cm1 || 0;
    for (let Y = ya; Y <= yb; Y++) {
      const ly = fl(oy + (Y + 0.5 - 135) * iz);
      if (ly < 0 || ly >= h) continue;
      const row = ly * w, o = Y * W;
      let fg = fog;
      if (mist) fg = clamp(fog + mist * clamp((ly - mistY) / mistH, 0, 1), 0, 1);
      const lampRow = lamp && Math.abs(Y + 0.5 - LAMP.y) < Rm;
      const x0 = Math.max(0, Math.ceil((-ox) * zoom + 240 - 0.5)), x1 = Math.min(W - 1, fl((w - ox) * zoom + 240 - 0.5));
      for (let X = x0; X <= x1; X++) {
        const lx = fl(ox + (X + 0.5 - 240) * iz);
        if (lx < 0 || lx >= w) continue;
        const i = row + lx, m = M[i];
        if (!m) continue;
        let c;
        if (m === 255) c = S[i];
        else {
          let s = S[i] * (1 / 150), l = 0;
          if (lampRow) {
            l = lampAt(X, Y, z0 + Z[i] * zk, N[i * 2] * (1 / 127), N[i * 2 + 1] * (1 / 127));
            if (hasSh && l > 0.01) { const a = shadAt(X, Y, 1); if (a > 0) l *= 1 - a; }
          }
          if (hasSh) { const a = shadAt(X, Y, 0); if (a > 0) s *= 1 - a; }
          if (dark) s *= 1 - dark;
          if (cust && m >= cm0 && m <= cm1) c = cust(m, s, l, F[i], X, Y, lx, ly, N[i * 2] * (1 / 127));
          else c = mc(m, s, l, X, Y);
          // snow crust: a crystal here and there catches the light and twinkles (warm and many near the lantern)
          if (m === sk && F[i]) {
            const f = F[i], tw = frac(f * 0.0391 + t * (0.55 + (f & 7) * 0.09)), on = tw < 0.16 ? 1 - tw / 0.16 : 0;
            if (on > 0) {
              const k = on * (0.32 * s + 1.6 * l);
              if (k > 0.5) c = l > 0.25 ? (k > 1.1 ? 22 : 200) : k > 0.75 ? 22 : 194;
            }
          }
        }
        if (fg > 0.004) { let lv = (fg * 8 + 0.5 + (BAYF[((Y & 7) << 3) | (X & 7)] - 0.5) * 0.6) | 0; if (lv > 8) lv = 8; if (lv > 0) c = FOGT[lv][c]; }
        BUF[o + X] = c;
      }
    }
  }
  // screen → layer coordinates for a comp() call (and back)
  const toLX = (ox, zoom, X) => ox + (X + 0.5 - 240) / zoom, toLY = (oy, zoom, Y) => oy + (Y + 0.5 - 135) / zoom;
  const toSX = (ox, zoom, lx) => (lx - ox) * zoom + 240 - 0.5, toSY = (oy, zoom, ly) => (ly - oy) * zoom + 135 - 0.5;
