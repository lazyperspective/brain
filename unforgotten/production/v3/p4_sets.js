  /* ================================================================ sets */
  // ---------------------------------------------------------------- materials
  // wood walls with planks and lit paper windows
  function wallMat(seed, lit) {
    return (face, u, v, x, y, t, L) => {
      if (face === 'bottom') return C('wood', 1);
      if (face === 'top') return shadeC(R.wood, 1 + L * 2, x, y);
      const plank = fl(u / 0.45), seam = frac(u / 0.45) < 0.1;
      let s = 1 + L * 2.6 + (ih(plank, seed, 31) - 0.5) * 0.8 - (seam ? 0.9 : 0);
      // windows: lit squares of paper in a grid
      const wu = frac(u / 2.4), wv = v;
      if (lit && wv > 1.1 && wv < 2.2 && wu > 0.3 && wu < 0.7 && ih(fl(u / 2.4), seed, 33) < lit) {
        const mull = Math.abs(wu - 0.5) < 0.03 || Math.abs(wv - 1.65) < 0.05;
        const fl_ = ih(fl(T_NOW * 6), fl(u / 2.4) + seed * 7, 34) * 0.4;
        return mull ? C('wood', 1) : shadeC(R.ember, 5.2 + fl_ + (wv > 1.65 ? 0.5 : 0), x, y);
      }
      if (v < 0.35) s -= 0.8;                                         // a dark skirting
      return shadeC(R.wood, s, x, y);
    };
  }
  const roofMat = (ramp, base) => (face, u, v, x, y, t, L) => {
    if (face === 'gable') return shadeC(R.wood, 1 + L * 2, x, y);
    const row = frac(v / 0.32) < 0.18, col = frac((u + fl(v / 0.32) * 0.2) / 0.4) < 0.1;
    return shadeC(ramp, base + L * 2.6 - (row ? 1 : 0) - (col ? 0.5 : 0) + (frac(v / 0.32) > 0.8 ? 0.6 : 0), x, y);
  };
  const stoneMat = (ramp, base) => (face, u, v, x, y, t, L) => {
    const bx = fl(u / 0.7 + (fl(v / 0.35) % 2) * 0.5), by = fl(v / 0.35), mortar = frac(u / 0.7 + (by % 2) * 0.5) < 0.08 || frac(v / 0.35) < 0.12;
    return shadeC(ramp, base + L * 2.4 + (ih(bx, by, 41) - 0.5) * 0.9 - (mortar ? 1.1 : 0), x, y);
  };
  const flatMat = (ramp, base, k) => (face, u, v, x, y, t, L) => shadeC(ramp, base + L * (k || 2.5), x, y);
  // a cobbled ground: tex(wx, wz, depth, x, y)
  const cobble = (ramp, base, wet) => (wx, wz, d, x, y) => {
    const cx = fl(wx / 0.55 + (fl(wz / 0.45) % 2) * 0.5), cz = fl(wz / 0.45), gap = frac(wx / 0.55 + (cz % 2) * 0.5) < 0.1 || frac(wz / 0.45) < 0.12;
    let s = base + (ih(cx, cz, 51) - 0.5) * 1.1 - (gap ? 1.2 : 0);
    if (wet && !gap && ih(cx, cz, 52) < 0.2) s += 1.2;                                        // puddle shine
    return shadeC(ramp, s, x, y);
  };

  // ---------------------------------------------------------------- EMBERWICK: a terraced village climbing to a shrine, at night, in rain
  const EW = { houses: [], lanterns: [], terr: [] };
  (function buildEmberwick() {
    for (let k = 0; k < 7; k++) EW.terr.push({ z0: k * 10, z1: k * 10 + 10, y: k * 1.8 });
    for (let k = 0; k < 7; k++) for (const side of [-1, 1]) for (let j = 0; j < 3; j++) {
      const w = 3.2 + ih(k, j * 2 + side, 61) * 2.2, d = 3 + ih(k, j, 62) * 2, h = 2.6 + ih(k, j + 9, 63) * 1.8;
      const x0 = side * (3.4 + j * 6.2 + ih(k, j, 64) * 1.5), z0 = k * 10 + 1.5 + ih(j, k, 65) * 3;
      const xa = side < 0 ? x0 - w : x0, y0 = k * 1.8;
      EW.houses.push({ x0: xa, z0, x1: xa + w, z1: z0 + d, y0, h, roofH: 1.2 + ih(k, j, 66) * 0.6, seed: k * 7 + j + (side > 0 ? 50 : 0), lit: 0.75 });
      if (ih(k, j + side * 3, 67) < 0.7) EW.lanterns.push([side < 0 ? xa + w + 0.3 : xa - 0.3, y0 + 2.4, z0 + 0.5, ih(k, j, 68)]);
    }
  })();
  const EW_SHRINE = { x: 0, y: 7 * 1.8, z: 72 };
  function skyNight(dx, dy, dz, x, y) {
    const el = dy;
    if (el < -0.05) return C('night', 1);
    const cl = fbm(Math.atan2(dx, dz) * 60 + T_NOW * 0.6, el * 120, 18, 3, 71);
    let s = 0.8 + el * 3.2 + (cl > 0.55 ? (cl - 0.55) * 4 : 0);
    if (el > 0.15 && ih(fl(Math.atan2(dx, dz) * 400), fl(el * 400), 72) > 0.997 && cl < 0.5) return C('night', 6);
    return shadeC(R.night, Math.min(3.2, s), x, y);
  }
  // draw the village from the current camera; hush(x, y) optional erasure handled by the shot
  function drawEmberwick(t, opt) {
    opt = opt || {};
    setSun(-0.3, 0.7, -0.6, 0.18); setFog('#121a33', 18, 95, 0.8);
    sky(opt.sky || skyNight);
    // terraces and the central stair
    for (const tr of EW.terr) {
      box(-40, tr.y - 6, tr.z0, 40, tr.y, tr.z1, (face, u, v, x, y, tt, L) => face === 'top' ? cobble(R.stone, 1.2 + L * 1.6, true)(u - 40, v, tt, x, y) : stoneMat(R.stone, 0.8)(face, u, v, x, y, tt, L));
      for (let s = 0; s < 6; s++) box(-1.6, tr.y + s * 0.3, tr.z1 - 1.8 + s * 0.3, 1.6, tr.y + (s + 1) * 0.3, tr.z1 + 0.01, stoneMat(R.stone, 1.4));
    }
    for (const h of EW.houses) {
      if (opt.cull && !opt.cull(h)) continue;
      box(h.x0, h.y0, h.z0, h.x1, h.y0 + h.h, h.z1, wallMat(h.seed, opt.dark ? 0 : h.lit));
      roof(h.x0, h.z0, h.x1, h.z1, h.y0 + h.h, h.roofH, roofMat(R.night, 1.0));
    }
    // the shrine: a platform, two red pillars and a beam, and the fire
    const S = EW_SHRINE;
    box(-6, S.y - 1, S.z - 4, 6, S.y, S.z + 6, stoneMat(R.stone, 1.3));
    for (const sx of [-3.2, 3.2]) box(sx - 0.25, S.y, S.z - 3.2, sx + 0.25, S.y + 4.4, S.z - 2.7, flatMat(R.crimson, 1.4, 2.6));
    box(-4.2, S.y + 4.0, S.z - 3.3, 4.2, S.y + 4.5, S.z - 2.6, flatMat(R.crimson, 1.6, 2.6));
    box(-3.8, S.y + 3.3, S.z - 3.15, 3.8, S.y + 3.55, S.z - 2.75, flatMat(R.char, 1.4, 2));
    box(-2.4, S.y, S.z + 1, 2.4, S.y + 2.6, S.z + 4, wallMat(901, 0)); roof(-2.4, S.z + 1, 2.4, S.z + 4, S.y + 2.6, 1.4, roofMat(R.crimson, 0.6));
  }
  // lights that should sit on top of everything: lanterns, the shrine fire, rain
  function emberwickLights(t, opt) {
    opt = opt || {};
    for (const [x, y, z, ph] of EW.lanterns) {
      const p = proj(x, y, z); if (!p) continue;
      const fl_ = 0.85 + 0.15 * Math.sin(t * 7 + ph * 20);
      p3(x, y, z, C('ember', 6), 0.32); p3(x, y - 0.16, z, C('ember', 4), 0.24);
      glow3(x, y, z, 1.6 * fl_, T_EMBER, 0.55 * (opt.lantern === undefined ? 1 : opt.lantern));
    }
    const S = EW_SHRINE;
    if (opt.fire !== 0) {
      for (let k = 0; k < 40; k++) { const u = frac(ih(k, 1, 81) + t * (0.5 + ih(k, 2, 81) * 0.6)); p3(S.x + (ih(k, 3, 81) - 0.5) * 1.6 * (1 - u) + Math.sin(t * 3 + k) * 0.2 * u, S.y + 0.2 + u * 3.2, S.z + (ih(k, 4, 81) - 0.5) * 1.2, u < 0.3 ? C('ember', 7) : u < 0.6 ? C('ember', 6) : C('ember', 4), 0.18 * (1 - u * 0.6)); }
      glow3(S.x, S.y + 1, S.z, 6, T_EMBER, 0.6 * (opt.fire === undefined ? 1 : opt.fire), false);
    }
  }

