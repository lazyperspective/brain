// Scene: a designed canyon heightfield + foreground ledge, ray-marched at golden hour,
// with a painted storm sky. Produces a colour "study" (the painter's reference) plus the
// semantic buffers the painting engine needs: stroke direction, material, depth, sunlight.
(function (G) {
  'use strict';
  const { makeRng, makeNoise, clamp, mix, smooth } = G.CORE;

  const SEED = 40417;
  const N1 = makeNoise(SEED + 1), N2 = makeNoise(SEED + 2), N3 = makeNoise(SEED + 3);
  const N4 = makeNoise(SEED + 4), N5 = makeNoise(SEED + 5), N6 = makeNoise(SEED + 6);

  // ---------------------------------------------------------------- camera
  const CAM = { y: 1.03, pitch: (7.0 * Math.PI) / 180, tanY: Math.tan((27.5 * Math.PI) / 180) };
  CAM.tanX = CAM.tanY * 0.8;
  const cp = Math.cos(CAM.pitch), sp = Math.sin(CAM.pitch);
  function camRay(u, v) {
    // u,v in [-1,1], v up
    const x = u * CAM.tanX, y = v * CAM.tanY, z = 1;
    // pitch down: rotate around x axis
    const dy = y * cp - z * sp, dz = y * sp + z * cp;
    const l = Math.hypot(x, dy, dz);
    return [x / l, dy / l, dz / l];
  }
  function project(px, py, pz) {
    // world -> normalised screen (u,v in [-1,1]) ; returns null if behind
    const y = py - CAM.y;
    const cy = y * cp + pz * sp, cz = -y * sp + pz * cp;
    if (cz <= 1e-6) return null;
    return [px / cz / CAM.tanX, cy / cz / CAM.tanY, cz];
  }

  // Sun: true direction (sky glow, beams) and a slightly side-swung lighting direction for the
  // rock, as a painter would arrange it.
  function norm3(a) { const l = Math.hypot(a[0], a[1], a[2]); return [a[0] / l, a[1] / l, a[2] / l]; }
  const SUN_SCREEN = [0.30, 0.215]; // fraction of width/height where the sun sits
  const SUN = (() => {
    const u = SUN_SCREEN[0] * 2 - 1, v = 1 - SUN_SCREEN[1] * 2;
    return camRay(u, v);
  })();
  const LIGHT = norm3([-0.85, 0.22, 0.50]);

  // ---------------------------------------------------------------- terrain
  const RIM_NEAR = 1.0, RIM_FAR = 1.075, MAXH = 1.16;
  function riverZ(x) {
    return 2.75 + 0.55 * Math.sin(0.42 * x + 0.9) + 0.30 * Math.sin(1.5 * x + 2.3) + 0.07 * Math.sin(2.9 * x + 0.4);
  }
  function riverZd(x) {
    return 0.55 * 0.42 * Math.cos(0.42 * x + 0.9) + 0.30 * 1.5 * Math.cos(1.5 * x + 2.3) + 0.07 * 2.9 * Math.cos(2.9 * x + 0.4);
  }
  function nearRimZ(x) {
    return 0.012 + 0.06 * smooth(1.0, 2.6, Math.abs(x)) + 0.03 * (N1.fbm(x * 1.5 + 3.1, 1.7, 3) + 0.5);
  }
  function farRimD(x) {
    return 10.6 + 1.2 * Math.sin(0.23 * x + 1.3) + 0.8 * N1.fbm(x * 0.3, 5.5, 3);
  }

  // Strata: [top elevation, hardness(0 slope..1 cliff)]
  const STRATA = [
    [0.04, 0.3], [0.12, 0.9], [0.18, 0.4], [0.265, 0.9], [0.335, 0.1], [0.43, 0.97],
    [0.48, 0.3], [0.56, 0.8], [0.61, 0.3], [0.68, 0.7], [0.75, 0.2], [0.86, 0.98],
    [0.90, 0.35], [0.985, 0.95], [1.2, 0.1],
  ];
  function terrace(hs) {
    let bot = 0;
    for (let i = 0; i < STRATA.length; i++) {
      const top = STRATA[i][0];
      if (hs < top || i === STRATA.length - 1) {
        const f = clamp((hs - bot) / (top - bot), 0, 1);
        const k = STRATA[i][1];
        const w = mix(0.9, 0.12, k), c = 0.55;
        const g = smooth(c - w / 2, c + w / 2, f) * 0.93 + f * 0.07;
        return bot + (top - bot) * mix(f, g, k);
      }
      bot = top;
    }
    return hs;
  }

  // monumental temples (buttes) placed by design: x, z, radius, top, elongation angle, aspect
  const TEMPLES = [
    [0.50, 4.9, 0.62, 0.80, 0.35, 1.5],
    [-0.45, 6.2, 0.40, 0.66, -0.2, 1.2],
    [-2.3, 7.2, 0.85, 0.92, 0.6, 1.4],
    [2.9, 9.0, 1.0, 0.97, -0.3, 1.6],
    [-1.35, 3.7, 0.30, 0.47, 0.2, 1.3],
    [1.8, 4.0, 0.32, 0.52, -0.5, 1.2],
    [-4.6, 9.6, 1.1, 0.99, 0.2, 1.5],
    [5.6, 11.2, 1.2, 1.0, 0.1, 1.4],
    [-0.62, 1.25, 0.26, 0.62, 0.4, 1.4],
    [0.75, 1.55, 0.3, 0.55, -0.3, 1.3],
  ];
  function templeH(x, z) {
    let best = 0;
    for (let i = 0; i < TEMPLES.length; i++) {
      const T = TEMPLES[i];
      const dx = x - T[0], dz = z - T[1];
      if (Math.abs(dx) > T[2] * 2.6 || Math.abs(dz) > T[2] * 2.6) continue;
      const c = Math.cos(T[4]), s = Math.sin(T[4]);
      const u = (dx * c + dz * s) / T[5], v = -dx * s + dz * c;
      const a = Math.atan2(v, u);
      const r = Math.hypot(u, v);
      const wob = 1 + 0.28 * N4.fbm(Math.cos(a) * 1.3 + i * 7.1, Math.sin(a) * 1.3 + i * 3.3, 3)
        + 0.10 * N5.fbm(x * 6 + i, z * 6, 2);
      const rr = r / (T[2] * wob);
      // stepped pyramid profile; terrace() adds the strata cliffs
      const p = clamp(1 - Math.pow(Math.max(0, rr - 0.25) / 0.95, 1.1), 0, 1);
      const h = T[3] * Math.pow(p, 0.75);
      if (h > best) best = h;
    }
    return best;
  }

  function canyonH(x, z, detail) {
    const zr = riverZ(x);
    const slope = riverZd(x);
    const dd = (z - zr) / Math.sqrt(1 + slope * slope);
    let d, D, rim, far;
    if (dd >= 0) {
      far = true; d = dd; D = farRimD(x); rim = RIM_FAR;
    } else {
      far = false; d = -dd; D = Math.max(0.3, zr - nearRimZ(x)); rim = RIM_NEAR;
    }
    // erosion potential: distance from the river plus side canyons eaten back into the walls
    const sN = d / D;
    const wx = x + 0.6 * N2.fbm(x * 0.22, z * 0.22, 2);
    const v1 = 1 - smooth(0.0, 0.22, Math.abs(N2.fbm(wx * (far ? 0.42 : 0.75) + 11.0, z * 0.16, 3)));
    const v2 = 1 - smooth(0.0, 0.14, Math.abs(N3.fbm(wx * 1.25 + 4.0, z * 0.4 + 2.0, 3)));
    const v3 = 1 - smooth(0.0, 0.09, Math.abs(N3.fbm(wx * 3.0 + 9.0, z * 1.1, 2)));
    let P = (far ? Math.pow(Math.max(0, 1 - sN), 1.4) * 1.45 - 0.5 + 0.55 * v1 : 0.42 + 0.58 * Math.pow(clamp((1 - sN) / 0.85, 0, 1), 0.8) + 0.3 * (v1 - 0.5)) + 0.26 * v2 + 0.08 * v3 + 0.16 * N6.fbm(x * 1.1, z * 1.1, 3);
    let hs = rim - (rim - 0.295) * smooth(0, 1, P);
    // inner gorge
    const gz = sN * D;
    if (gz < 0.95) hs = Math.min(hs, gz < 0.06 ? 0 : 0.27 * Math.pow((gz - 0.06) / 0.89, far ? 1.0 : 0.75));
    // side gorges: tributaries trench the platform on their way to the river
    {
      const trib = smooth(0.55, 0.95, v2) * smooth(0.45, 0.0, sN) * (far ? 1 : 0.7);
      if (trib > 0) {
        const depthT = 0.20 * trib * smooth(0.0, 0.05, sN);
        hs = Math.min(hs, mix(hs, Math.max(0.03, 0.27 - depthT - 0.06 * sN), trib));
      }
    }
    if (sN > 1) hs = rim + 0.01 * (sN - 1);
    // the temples stand on the Tonto platform
    if (far || d > 0.4) hs = Math.max(hs, templeH(x, z) * smooth(0.025, 0.09, sN));
    if (detail > 0) {
      hs += 0.012 * N5.fbm(x * 2.0, z * 2.0, 3) + 0.006 * detail * N5.fbm(x * 9, z * 9, 3);
    }
    let h = terrace(hs);
    if (hs < 0.04) h = Math.min(h, hs * 0.9);
    if (detail > 1) h += 0.0012 * N6.fbm(x * 70, z * 70, 3);
    return h;
  }

  // Foreground: a jointed sandstone ledge on the right, a darker rock shoulder at left.
  const FG = { x0: -0.07, x1: 0.07, z0: 0.0, z1: 0.13 };
  function hash2(i, j) {
    let h = (i * 374761393 + j * 668265263) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  function blocks(x, z, su, sw, rot, seed) {
    const c = Math.cos(rot), s = Math.sin(rot);
    const u = x * c + z * s, w = -x * s + z * c;
    const uu = u / su + 0.35 * N1.n2(w * 160 + seed, 0.5), ww = w / sw + 0.35 * N2.n2(u * 160 + seed, 2.5);
    const iu = Math.floor(uu), iw = Math.floor(ww);
    const fu = uu - iu, fw = ww - iw;
    const dj = Math.min(Math.min(fu, 1 - fu) * su, Math.min(fw, 1 - fw) * sw);
    return { id: hash2(iu + seed, iw), id2: hash2(iw - 7 + seed, iu + 3), dj };
  }
  function fgH(x, z) {
    // right ledge: a limestone outcrop stepping down in strata toward its edge
    const xL = 0.0028 + 0.06 * Math.max(0, z - 0.05) + 0.0024 * N1.fbm(z * 110, 3.3, 4);
    const zTip = 0.080 - 0.20 * Math.max(0, x - 0.004) + 0.0035 * N2.fbm(x * 90, 1.2, 4);
    const e = Math.min(x - xL, (zTip - z) * 1.2);
    let top = 1.0 - 0.10 * Math.max(0, z - 0.035) - 0.03 * Math.max(0, x - 0.02);
    top += 0.0005 * N4.fbm(x * 70, z * 70, 4) + 0.00012 * N3.fbm(x * 420, z * 420, 3);
    // sparse joints
    const j1 = Math.abs(N5.fbm(x * 38 + 0.4 * N6.n2(z * 90, 1), z * 22, 3));
    top -= 0.0006 * (1 - smooth(0.0, 0.035, j1)) * smooth(0.0, 0.0015, e);
    // strata steps near the edge
    const st1 = 0.0042 + 0.0016 * N3.fbm(x * 120, z * 120, 3);
    const st2 = 0.0016 + 0.0008 * N4.fbm(x * 140 + 5, z * 140, 3);
    top -= 0.0016 * smooth(st1 + 0.0002, st1 - 0.0002, e) + 0.0014 * smooth(st2 + 0.0002, st2 - 0.0002, e);
    let hr;
    if (e > 0) hr = top - 0.0004 * (1 - smooth(0, 0.0005, e));
    else hr = top - 0.0004 + e * 14 - 0.0008 * N6.fbm(x * 300, z * 300, 2);
    // left shoulder: a rounded rock mass, lower
    const xS = -0.0125 - 0.30 * Math.max(0, z - 0.042) + 0.003 * N4.fbm(z * 80, 7.7, 4);
    const eS = xS - x;
    let topS = 0.989 - 0.22 * Math.max(0, z - 0.035) + 0.0016 * N6.fbm(x * 70, z * 70, 4) + 0.0003 * N2.fbm(x * 380, z * 380, 3);
    const sS = 0.0035 + 0.0015 * N5.fbm(x * 110, z * 110, 3);
    topS -= 0.0022 * smooth(sS + 0.0003, sS - 0.0003, eS);
    topS -= 0.0018 * (1 - smooth(0, 0.004, eS)) * (1 - smooth(0, 0.004, eS));
    const hs = eS > 0 ? topS : topS + eS * 14;
    return Math.max(hr, hs);
  }

  // ---------------------------------------------------------------- grids
  function makeGrid(x0, x1, z0, z1, nx, nz, fn) {
    const data = new Float32Array(nx * nz);
    const dx = (x1 - x0) / (nx - 1), dz = (z1 - z0) / (nz - 1);
    for (let j = 0; j < nz; j++) {
      const z = z0 + j * dz;
      for (let i = 0; i < nx; i++) data[j * nx + i] = fn(x0 + i * dx, z);
    }
    return { x0, x1, z0, z1, nx, nz, dx, dz, data };
  }
  function gridSample(g, x, z) {
    let fx = (x - g.x0) / g.dx, fz = (z - g.z0) / g.dz;
    if (fx < 0) fx = 0; else if (fx > g.nx - 1.001) fx = g.nx - 1.001;
    if (fz < 0) fz = 0; else if (fz > g.nz - 1.001) fz = g.nz - 1.001;
    const i = fx | 0, j = fz | 0, u = fx - i, v = fz - j;
    const k = j * g.nx + i, d = g.data;
    const a = d[k] + (d[k + 1] - d[k]) * u;
    const b = d[k + g.nx] + (d[k + g.nx + 1] - d[k + g.nx]) * u;
    return a + (b - a) * v;
  }
  function inside(g, x, z, m) {
    // returns blend weight 1 inside (with margin m fraction), 0 outside
    const ux = (x - g.x0) / (g.x1 - g.x0), uz = (z - g.z0) / (g.z1 - g.z0);
    if (ux <= 0 || ux >= 1 || uz <= 0 || uz >= 1) return 0;
    const e = Math.min(ux, 1 - ux, uz, 1 - uz);
    return e >= m ? 1 : e / m;
  }

  let GR = null;
  function buildGrids(quality) {
    const q = quality || 1;
    const t0 = performance.now();
    const g0 = makeGrid(-17, 17, -0.6, 24, Math.round(1600 * q), Math.round(1160 * q), (x, z) => canyonH(x, z, 1));
    const g1 = makeGrid(-3.2, 3.2, -0.3, 5.6, Math.round(1500 * q), Math.round(1380 * q), (x, z) => canyonH(x, z, 2));
    const g2 = makeGrid(-0.7, 0.7, -0.05, 1.3, Math.round(1100 * q), Math.round(1060 * q), (x, z) => canyonH(x, z, 2));
    const g3 = makeGrid(FG.x0, FG.x1, FG.z0, FG.z1, Math.round(1500 * q), Math.round(1400 * q), fgH);
    GR = { g0, g1, g2, g3 };
    console.log('grids', Math.round(performance.now() - t0), 'ms');
  }
  function H(x, z) {
    // canyon from LOD grids
    let h;
    const w2 = inside(GR.g2, x, z, 0.06);
    if (w2 >= 1) h = gridSample(GR.g2, x, z);
    else {
      const w1 = inside(GR.g1, x, z, 0.05);
      let hc;
      if (w1 >= 1) hc = gridSample(GR.g1, x, z);
      else {
        const h0 = gridSample(GR.g0, x, z);
        hc = w1 > 0 ? mix(h0, gridSample(GR.g1, x, z), w1) : h0;
      }
      h = w2 > 0 ? mix(hc, gridSample(GR.g2, x, z), w2) : hc;
    }
    if (x > FG.x0 && x < FG.x1 && z > FG.z0 && z < FG.z1) {
      const hf = gridSample(GR.g3, x, z);
      if (hf > h) h = hf;
    }
    return h;
  }
  function isFG(x, z, y) {
    if (!(x > FG.x0 && x < FG.x1 && z > FG.z0 && z < FG.z1)) return false;
    return gridSample(GR.g3, x, z) >= y - 0.0004;
  }

  // ---------------------------------------------------------------- sky
  // Cloud density on a plane above the canyon (perspective), with coverage designed in
  // screen space: a heavy storm deck breaking open around the sun, bars low over the rim.
  function screenOf(dx, dy, dz) {
    const p = project(dx * 100, CAM.y + dy * 100, dz * 100);
    if (!p) return [0.5, 0.0];
    return [(p[0] + 1) / 2, (1 - p[1]) / 2];
  }
  function cloudField(dx, dy, dz) {
    const sy0 = dy;
    if (dy <= 0.006) dy = 0.006;
    const [fx, fy] = screenOf(dx, sy0, dz);
    const px = (dx / dy) * 0.7, pz = (dz / dy) * 0.7;
    const wx = px + 0.45 * N1.fbm(px * 0.35 + 1.0, pz * 0.35, 4);
    const wz = pz + 0.45 * N2.fbm(px * 0.35 + 5.0, pz * 0.35 + 3.0, 4);
    let n = N3.fbm(wx * 0.55, wz * 0.6, 5) * 0.8;
    // puffy cells (turbulence) for the lumpy underside
    let tb = 0, ta = 1, tn = 0, ux = wx * 1.3 + 3, uz = wz * 1.5;
    for (let o = 0; o < 4; o++) { tb += ta * Math.abs(N4.n2(ux, uz)); tn += ta; ta *= 0.5; ux = ux * 2.1 + 1.7; uz = uz * 2.1 + 4.1; }
    tb = tb / tn;
    n += 0.55 * (0.32 - tb);
    const el = Math.asin(clamp(sy0, -1, 1));
    // storm deck: covers the top, ragged lower edge descending to the right
    const edgeY = 0.10 + 0.15 * fx + 0.035 * N5.fbm(fx * 3.5, 1.5, 3);
    let cov = 1.0 * smooth(edgeY + 0.09, edgeY - 0.07, fy);
    // the break around the sun, opening down to the left
    const hx = fx - 0.30, hy = fy - 0.21;
    const hole = Math.exp(-(hx * hx) / 0.016 - (hy * hy) / 0.0075 + hx * hy * 30);
    cov -= 0.8 * hole;
    // ragged scud and drifting fragments in the mid sky, thinning toward the rim
    cov += 0.25 * smooth(0.10, 0.2, fy) * smooth(0.37, 0.24, fy) * (1 - 0.7 * hole);
    // a few bars low over the far rim
    cov += 0.18 * smooth(0.30, 0.335, fy) * smooth(0.383, 0.36, fy);
    const T = cov * 1.3 + n * 1.1 - 0.35;
    const d = smooth(0.0, 0.22, T);
    const th = smooth(0.15, 1.1, T);
    return { d, th, T, el, fx, fy };
  }

  function skyBase(dx, dy, dz) {
    const el = Math.max(0, dy);
    const cs = dx * SUN[0] + dy * SUN[1] + dz * SUN[2];
    const sunward = Math.pow(Math.max(0, cs), 3);
    const zen = [0.10, 0.17, 0.26];
    const hor = [mix(0.50, 0.95, sunward), mix(0.40, 0.66, sunward), mix(0.40, 0.34, sunward)];
    const t = Math.pow(1 - clamp(el, 0, 1), 3.2);
    let r = mix(zen[0], hor[0], t), g = mix(zen[1], hor[1], t), b = mix(zen[2], hor[2], t);
    const mie = Math.pow(Math.max(0, cs), 90) * 1.6 + Math.pow(Math.max(0, cs), 14) * 0.45;
    r += mie * 1.0; g += mie * 0.80; b += mie * 0.45;
    return [r, g, b];
  }
  function sunDisk(dx, dy, dz) {
    const cs = dx * SUN[0] + dy * SUN[1] + dz * SUN[2];
    const a = Math.acos(clamp(cs, -1, 1));
    return smooth(0.0105, 0.0085, a) * 30 + Math.exp(-a * a / 0.0005) * 3;
  }

  function skyColor(dx, dy, dz, withSun) {
    const base = skyBase(dx, dy, dz);
    let r = base[0], g = base[1], b = base[2];
    const cs = dx * SUN[0] + dy * SUN[1] + dz * SUN[2];
    const cf = cloudField(dx, dy, dz);
    const d = cf.d;
    if (withSun) {
      const s = sunDisk(dx, dy, dz) * (1 - d * 0.97);
      r += s * 1.0; g += s * 0.9; b += s * 0.66;
    }
    if (d <= 0.001) return { c: [r, g, b], d: 0 };
    // relief of the cloud underside: lumps lit on the side facing the sun
    const e = 0.006;
    const dX = cloudField(dx + e, dy, dz).T, dY = cloudField(dx, dy + e, dz).T;
    let gx = (dX - cf.T) / e, gy = (dY - cf.T) / e;
    let tx = SUN[0] - dx, ty = SUN[1] - dy;
    const tl = Math.hypot(tx, ty) + 1e-6; tx /= tl; ty /= tl;
    const gl = Math.hypot(gx, gy);
    const facing = gl > 1e-6 ? -(gx * tx + gy * ty) / gl : 0;
    const relief = clamp(gl * 0.12, 0, 1);
    const shade = clamp(0.5 + 0.5 * facing * relief, 0, 1);
    const ang = Math.acos(clamp(cs, -1, 1));
    const warm = Math.exp(-ang / 0.32);
    const lowness = 1 - smooth(0.02, 0.4, cf.el);
    const reach = clamp(warm * 1.15 + lowness * 0.35, 0, 1); // how much sun reaches under the deck
    const litC = [mix(0.50, 1.55, warm), mix(0.27, 0.92, warm), mix(0.24, 0.42, warm)];
    const darkC = [mix(0.045, 0.20, warm), mix(0.05, 0.12, warm), mix(0.08, 0.10, warm)];
    const th = cf.th;
    let lit = reach * (0.25 + 0.75 * shade) * (1 - 0.8 * th);
    lit = clamp(lit, 0, 1);
    let cr = mix(darkC[0], litC[0], lit), cg = mix(darkC[1], litC[1], lit), cb = mix(darkC[2], litC[2], lit);
    // thin, backlit edges glow
    const fwd = Math.pow(Math.max(0, cs), 40) * 3.5 + Math.pow(Math.max(0, cs), 8) * 0.6;
    const edge = (1 - th) * smooth(0.0, 0.35, d) * fwd;
    cr += edge * 1.3; cg += edge * 1.0; cb += edge * 0.6;
    const op = clamp(d * 1.25, 0, 1);
    r = mix(r, cr, op); g = mix(g, cg, op); b = mix(b, cb, op);
    return { c: [r, g, b], d: op };
  }

  // ---------------------------------------------------------------- painted cloud masses
  // Clouds are built the way a painter constructs them: overlapping rounded billows arranged
  // into designed masses (storm deck, broken fragments around the sun, low bars over the rim).
  // Each billow is a soft dome; the combined dome surface is lit from the low sun.
  function makePuffs() {
    const rng = makeRng(SEED + 77);
    const P = [];
    const edgeY = (fx) => 0.105 + 0.15 * fx + 0.03 * N5.fbm(fx * 3.5, 1.5, 3);
    const inHole = (fx, fy) => {
      const hx = (fx - 0.30) / 0.19, hy = (fy - 0.215) / 0.12;
      return hx * hx + hy * hy;
    };
    const pw = (a, b, e) => a + (b - a) * Math.pow(rng(), e);
    // storm deck: broad masses
    for (let i = 0; i < 260; i++) {
      const fx = rng() * 1.3 - 0.15;
      const ey = edgeY(fx);
      const fy = -0.1 + rng() * (ey + 0.06);
      if (fy > ey - 0.02) continue;
      const hh = inHole(fx, fy);
      if (hh < 1.15) continue;
      const r = pw(0.045, 0.14, 2.2) * (1.15 - fy * 1.5);
      P.push({ x: fx, y: fy, r, asp: 0.5 + 0.2 * rng(), z: rng() * 0.3, k: 1.0, deck: 1, relief: 0.35 });
    }
    // lumpy, hanging underside along the deck edge
    for (let i = 0; i < 520; i++) {
      const fx = rng() * 1.3 - 0.15;
      const fy = edgeY(fx) - 0.035 + rng() * 0.05 + (rng() < 0.15 ? rng() * 0.03 : 0);
      const hh = inHole(fx, fy);
      if (hh < 1.0 && rng() > 0.25 * hh * hh) continue;
      const r = pw(0.006, 0.045, 2.6);
      P.push({ x: fx, y: fy, r, asp: 0.55 + 0.25 * rng(), z: 0.3 + rng() * 0.3, k: 0.9, deck: 0.75, relief: 1 });
    }
    // broken, sunlit fragments in clusters, ringing the break and drifting in mid sky
    for (let c = 0; c < 34; c++) {
      let cx, cy;
      if (c < 18) {
        const a = -0.3 + rng() * Math.PI * 1.6, rr = 1.0 + 0.35 * rng();
        cx = 0.30 + Math.cos(a) * 0.19 * rr; cy = 0.215 + Math.sin(a) * 0.12 * rr;
      } else { cx = 0.4 + rng() * 0.7; cy = 0.19 + rng() * 0.12; if (rng() < 0.75) continue; }
      if (cy > 0.33 || cy < edgeY(cx) - 0.01 && c >= 18) continue;
      const n = 3 + Math.floor(rng() * 9), span = 0.02 + rng() * 0.05;
      for (let i = 0; i < n; i++) {
        const fx = cx + (rng() - 0.5) * span * 2, fy = cy + (rng() - 0.5) * span * 0.45;
        const r = pw(0.005, 0.03, 2.0) * (1.3 - fy * 1.4);
        P.push({ x: fx, y: fy, r, asp: 0.42 + 0.25 * rng(), z: 0.5 + rng() * 0.3, k: 0.75, deck: 0.25, relief: 1 });
      }
    }
    // long thin bars low over the far rim
    for (let c = 0; c < 22; c++) {
      const cx = rng() * 1.2 - 0.1, cy = 0.31 + rng() * 0.06;
      const n = 3 + Math.floor(rng() * 6), len = 0.04 + rng() * 0.12, tilt = (rng() - 0.5) * 0.02;
      for (let i = 0; i < n; i++) {
        const t = (i / Math.max(1, n - 1) - 0.5) * len;
        const r = 0.012 + 0.03 * rng() * (1 - Math.abs(t) / len);
        P.push({ x: cx + t, y: cy + t * tilt + (rng() - 0.5) * 0.004, r, asp: 0.1 + 0.08 * rng(), z: 0.7, k: 0.5, deck: 0.1, relief: 0.6 });
      }
    }
    return P;
  }

  function buildSky(RW, RH) {
    const t0 = performance.now();
    const puffs = makePuffs();
    const N = RW * RH;
    const Hc = new Float32Array(N), D = new Float32Array(N), DK = new Float32Array(N);
    // bin puffs
    const B = 48, bx = Math.ceil(RW / B), by = Math.ceil(RH / B);
    const bins = Array.from({ length: bx * by }, () => []);
    puffs.forEach((p, idx) => {
      const cx = p.x * RW, cy = p.y * RH, rx = p.r * RW * 1.35, ry = rx * p.asp;
      const i0 = Math.max(0, Math.floor((cx - rx) / B)), i1 = Math.min(bx - 1, Math.floor((cx + rx) / B));
      const j0 = Math.max(0, Math.floor((cy - ry) / B)), j1 = Math.min(by - 1, Math.floor((cy + ry) / B));
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) bins[j * bx + i].push(idx);
    });
    const horizonY = 0.381 * RH;
    for (let y = 0; y < Math.min(RH, Math.ceil(horizonY + 4)); y++) {
      for (let x = 0; x < RW; x++) {
        const k = y * RW + x;
        const list = bins[Math.floor(y / B) * bx + Math.floor(x / B)];
        let hmax = 0, dsum = 0, dk = 0;
        for (let q = 0; q < list.length; q++) {
          const p = puffs[list[q]];
          const rx = p.r * RW, ry = rx * p.asp;
          const ux = (x - p.x * RW) / rx, uy = (y - p.y * RH) / ry;
          let dd = ux * ux + uy * uy;
          if (dd > 1.9) continue;
          // fractal edge: noise at the billow's own scale
          const en = N6.fbm(x / (rx * 0.6) + list[q] * 3.1, y / (ry * 0.75), 4);
          let rq = Math.sqrt(dd) + 0.2 * en;
          if (rq >= 1) continue;
          const dome = Math.sqrt(1 - rq * rq);
          const h = p.z + dome * p.r * 9 * p.relief;
          if (h > hmax) hmax = h;
          const w = dome * p.k;
          dsum += w;
          dk += w * p.deck;
        }
        Hc[k] = hmax; D[k] = dsum; DK[k] = dsum > 0 ? dk / dsum : 0;
      }
    }
    console.log('sky puffs', puffs.length, Math.round(performance.now() - t0), 'ms');
    return { Hc, D, DK };
  }

  function shadeSky(RW, RH, SKY, k, x, y, dx, dy, dz) {
    const base = skyBase(dx, dy, dz);
    let r = base[0], g = base[1], b = base[2];
    const cs = dx * SUN[0] + dy * SUN[1] + dz * SUN[2];
    const d = SKY.D[k];
    const op = smooth(0.0, 0.35, d);
    const s = sunDisk(dx, dy, dz) * (1 - op * 0.97);
    r += s; g += s * 0.9; b += s * 0.66;
    if (op <= 0.001) return { c: [r, g, b], d: 0 };
    // surface normal of the billow field
    const xm = Math.max(0, x - 1), xp = Math.min(RW - 1, x + 1), ym = Math.max(0, y - 1), yp = Math.min(RH - 1, y + 1);
    const hx = (SKY.Hc[y * RW + xp] - SKY.Hc[y * RW + xm]) * 0.5;
    const hy = (SKY.Hc[yp * RW + x] - SKY.Hc[ym * RW + x]) * 0.5;
    const sc = 0.02 * RW / 1080;
    let nx = -hx / sc, ny = -hy / sc, nz = 1;
    const nl = Math.hypot(nx, ny, nz); nx /= nl; ny /= nl; nz /= nl;
    // light comes from the sun's position on the picture plane, low and from behind the clouds
    const sunX = SUN_SCREEN[0] * RW, sunY = SUN_SCREEN[1] * RH;
    let lx = sunX - x, ly = sunY - y;
    const ldist = Math.hypot(lx, ly) / RW;
    const ll = Math.hypot(lx, ly) + 1e-6; lx /= ll; ly /= ll;
    const lz = 0.25;
    const lnorm = Math.hypot(1, lz);
    const ndl = (nx * lx + ny * ly + nz * lz) / lnorm;
    const warm = Math.exp(-ldist / 0.22);
    const deck = SKY.DK[k];
    // how much direct light reaches this billow: the deck interior is starved, fragments are lit
    const thick = smooth(0.4, 2.4, d);
    const reach = clamp((1 - deck * 0.85) * 0.65 + warm * 1.1, 0, 1) * (1 - 0.7 * thick * deck);
    const lit = clamp(ndl * 0.85 + 0.25, 0, 1) * reach;
    const litC = [mix(0.95, 1.9, warm), mix(0.50, 1.25, warm), mix(0.40, 0.62, warm)];
    const darkC = [mix(0.035, 0.22, warm * 0.8), mix(0.037, 0.13, warm * 0.8), mix(0.06, 0.12, warm * 0.8)];
    let cr = mix(darkC[0], litC[0], lit), cg = mix(darkC[1], litC[1], lit), cb = mix(darkC[2], litC[2], lit);
    // thin, backlit edges glow (silver lining)
    const fwd = Math.pow(Math.max(0, cs), 30) * 4.0 + Math.pow(Math.max(0, cs), 6) * 0.5;
    const thin = 1 - smooth(0.0, 0.5, d);
    cr += thin * fwd * 1.4; cg += thin * fwd * 1.1; cb += thin * fwd * 0.65;
    r = mix(r, cr, op); g = mix(g, cg, op); b = mix(b, cb, op);
    return { c: [r, g, b], d: op };
  }

  // haze / aerial perspective colour along a view direction
  function hazeColor(dx, dy, dz) {
    const cs = dx * SUN[0] + dy * SUN[1] + dz * SUN[2];
    const g = Math.pow(Math.max(0, cs), 8);
    const g2 = Math.pow(Math.max(0, cs), 2);
    return [0.36 + 0.62 * g + 0.15 * g2, 0.30 + 0.44 * g + 0.09 * g2, 0.36 + 0.14 * g];
  }

  // ---------------------------------------------------------------- ray march
  function march(ox, oy, oz, dx, dy, dz, tmax) {
    let t = 0.004;
    let lastT = t, lastD = 1;
    for (let i = 0; i < 1400; i++) {
      const x = ox + dx * t, y = oy + dy * t, z = oz + dz * t;
      if (y > MAXH && dy >= 0) return -1;
      const h = H(x, z);
      const dh = y - h;
      if (dh < 0) {
        // bisection refine
        let a = lastT, b = t;
        for (let k = 0; k < 8; k++) {
          const m = (a + b) * 0.5;
          if (oy + dy * m - H(ox + dx * m, oz + dz * m) < 0) b = m; else a = m;
        }
        return (a + b) * 0.5;
      }
      lastT = t; lastD = dh;
      t += Math.max(0.0012 * t + 0.00004, dh * 0.45);
      if (t > tmax) return -1;
    }
    return -1;
  }
  function shadow(ox, oy, oz) {
    let t = 0.0015 + oz * 0.001, res = 1;
    const lx = LIGHT[0], ly = LIGHT[1], lz = LIGHT[2];
    for (let i = 0; i < 260; i++) {
      const x = ox + lx * t, y = oy + ly * t, z = oz + lz * t;
      if (y > MAXH) break;
      const dh = y - H(x, z);
      if (dh < 0) return 0;
      res = Math.min(res, (dh / t) * 6);
      t += Math.max(0.002 * t + 0.0003, dh * 0.5);
      if (t > 8) break;
    }
    return clamp(res, 0, 1);
  }
  function normalAt(x, z, e) {
    const hx = H(x + e, z) - H(x - e, z);
    const hz = H(x, z + e) - H(x, z - e);
    const nx = -hx, ny = 2 * e, nz = -hz;
    const l = Math.hypot(nx, ny, nz);
    return [nx / l, ny / l, nz / l];
  }

  // stratum colour by elevation (the rock's own colour, before light)
  const BANDS = [
    [0.00, [0.20, 0.17, 0.16]], // inner gorge schist
    [0.10, [0.25, 0.19, 0.15]],
    [0.16, [0.42, 0.33, 0.24]], // tapeats
    [0.24, [0.46, 0.44, 0.33]], // bright angel greenish
    [0.31, [0.62, 0.40, 0.27]], // muav
    [0.42, [0.70, 0.36, 0.22]], // redwall
    [0.48, [0.66, 0.40, 0.26]],
    [0.60, [0.74, 0.40, 0.24]], // supai red
    [0.70, [0.78, 0.44, 0.27]],
    [0.76, [0.72, 0.36, 0.22]], // hermit
    [0.86, [0.88, 0.76, 0.58]], // coconino cream
    [0.92, [0.80, 0.58, 0.40]],
    [1.00, [0.84, 0.74, 0.60]], // kaibab
    [1.20, [0.50, 0.50, 0.36]],
  ];
  function rockColor(y, x, z) {
    const yy = y + 0.006 * N4.n2(x * 7, z * 7);
    let i = 0;
    while (i < BANDS.length - 2 && BANDS[i + 1][0] < yy) i++;
    const a = BANDS[i], b = BANDS[i + 1];
    const f = smooth(0, 1, clamp((yy - a[0]) / (b[0] - a[0]), 0, 1));
    return [mix(a[1][0], b[1][0], f), mix(a[1][1], b[1][1], f), mix(a[1][2], b[1][2], f)];
  }

  // ---------------------------------------------------------------- render study
  let BEAM_K = 0.0;
  function render(RW, RH, opts) {
    if (opts && opts.beamK != null) BEAM_K = opts.beamK;
    opts = opts || {};
    if (!GR) buildGrids(opts.gridQ || 1);
    const t0 = performance.now();
    const N = RW * RH;
    const col = new Float32Array(N * 3);
    const depth = new Float32Array(N);
    const mat = new Uint8Array(N); // 0 sky,1 canyon,2 water,3 foreground
    const ang = new Float32Array(N); // stroke direction hint (radians, screen)
    const angW = new Float32Array(N); // confidence of hint
    const sunlit = new Float32Array(N);
    const cloud = new Float32Array(N);
    const occl = new Float32Array(N); // beam source mask (bright, unoccluded sky)
    const px2rad = (2 * CAM.tanY) / RH;
    const SKY = buildSky(RW, RH);
    const skyAt = (dx, dy, dz) => {
      const [fx, fy] = screenOf(dx, dy, dz);
      const xi = clamp(Math.round(fx * RW), 0, RW - 1), yi = clamp(Math.round(fy * RH), 0, RH - 1);
      return shadeSky(RW, RH, SKY, yi * RW + xi, xi, yi, dx, dy, dz);
    };
    for (let py = 0; py < RH; py++) {
      const v = 1 - ((py + 0.5) / RH) * 2;
      for (let px = 0; px < RW; px++) {
        const u = ((px + 0.5) / RW) * 2 - 1;
        const [dx, dy, dz] = camRay(u, v);
        const k = py * RW + px;
        const t = dy > 0.2 ? -1 : march(0, CAM.y, 0, dx, dy, dz, 40);
        let r, g, b;
        if (t < 0) {
          const s = shadeSky(RW, RH, SKY, k, px, py, dx, dy, dz);
          [r, g, b] = s.c;
          mat[k] = 0; depth[k] = 1e9; cloud[k] = s.d;
          const cs = dx * SUN[0] + dy * SUN[1] + dz * SUN[2];
          occl[k] = (1 - s.d) * Math.exp(-(1 - cs) / 0.0025);
          // strokes in sky: follow cloud contours; resolved later from structure, default horizontal
          ang[k] = 0; angW[k] = 0.25;
        } else {
          const x = dx * t, y = CAM.y + dy * t, z = dz * t;
          const fg = isFG(x, z, y);
          const e = Math.max(0.00004, t * px2rad * 1.2);
          const n = normalAt(x, z, e);
          // bump detail: fine rock texture, frequency limited by pixel footprint
          const fq = 1 / Math.max(e * 3, 1e-6);
          let bx = 0, bz = 0;
          {
            const f1 = Math.min(fq, fg ? 6000 : 300);
            const s1 = N5.fbm(x * f1, (z + y) * f1 * 0.5 + y * f1 * 2, 3);
            const s2 = N6.fbm(x * f1 + 4, (z - y) * f1 * 0.5 + 7 + y * f1 * 2, 3);
            const ba = fg ? 0.16 : 0.3;
            bx = s1 * ba; bz = s2 * ba;
          }
          let nx = n[0] + bx * (1 - Math.abs(n[1]) * 0.3), ny = n[1], nz = n[2] + bz;
          const nl = Math.hypot(nx, ny, nz); nx /= nl; ny /= nl; nz /= nl;
          let water = false;
          if (!fg && y < 0.012) {
            const dr = Math.abs(z - riverZ(x));
            if (dr < 0.12) water = true;
          }
          const sh = shadow(x, y, z);
          // cloud shadows drifting over the canyon (patches of sun)
          const cs1 = N1.fbm(x * 0.32 + 7.0, z * 0.45 + 1.0, 4);
          const zb = z < 2.9 ? -0.45 * smooth(2.9, 2.2, z) : 0.22 * smooth(3.6, 4.3, z) * smooth(9.0, 7.5, z);
          let cshadow = smooth(-0.08, 0.12, cs1 + zb + 0.02);
          if (fg) cshadow = 0.35 + 0.65 * smooth(-0.0005, 0.0025, (x - 0.004) - 0.5 * (z - 0.06)) * smooth(0.0, 0.004, 0.072 - z);
          const ndl = Math.max(0, nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2]);
          const sunAmt = ndl * sh * (0.12 + 0.88 * cshadow);
          sunlit[k] = sunAmt;
          let alb = fg ? rockColor(0.82 + (y - 0.99) * 6, x * 30, z * 30) : rockColor(y, x, z);
          if (fg) {
            // weathered grey-gold sandstone of the ledge, lichen and varnish streaks
            const lv = N2.fbm(x * 160, z * 160, 4), sp = N3.fbm(x * 900, z * 900, 2);
            const lich = smooth(0.25, 0.4, N4.fbm(x * 260 + 9, z * 260, 3));
            const lichO = smooth(0.35, 0.45, N5.fbm(x * 520 + 2, z * 520, 3));
            alb = [0.33 + 0.07 * lv + 0.03 * sp, 0.27 + 0.055 * lv + 0.025 * sp, 0.21 + 0.035 * lv + 0.02 * sp];
            alb = [mix(alb[0], 0.42, lich * 0.5), mix(alb[1], 0.42, lich * 0.5), mix(alb[2], 0.33, lich * 0.5)];
            alb = [mix(alb[0], 0.56, lichO * 0.6), mix(alb[1], 0.33, lichO * 0.6), mix(alb[2], 0.14, lichO * 0.6)];
          }
          // desert varnish streaks on cliffs + albedo variation
          const vs = N3.fbm(x * 40 + z * 40, y * 6, 3);
          const steep = 1 - Math.abs(ny);
          const av = 1 + 0.18 * N4.fbm(x * 9, z * 9 + y * 20, 3) - 0.25 * steep * smooth(0.1, 0.5, vs);
          alb = [alb[0] * av, alb[1] * av, alb[2] * av];
          // light
          const sunC = [1.75, 1.12, 0.62];
          const skyAmb = fg ? [0.07, 0.07, 0.10] : [0.065, 0.075, 0.15];
          const bounce = fg ? [0.12, 0.07, 0.045] : [0.16, 0.08, 0.045];
          const ao_e = Math.max(0.0004, t * 0.01);
          const ao = clamp(1 + (y - (H(x + ao_e, z) + H(x - ao_e, z) + H(x, z + ao_e) + H(x, z - ao_e)) * 0.25) / ao_e * 1.5, 0.4, 1);
          const hemi = 0.5 + 0.5 * ny;
          let lr = sunC[0] * sunAmt + (skyAmb[0] * hemi + bounce[0] * (1 - hemi) * 0.9) * ao;
          let lg = sunC[1] * sunAmt + (skyAmb[1] * hemi + bounce[1] * (1 - hemi) * 0.9) * ao;
          let lb = sunC[2] * sunAmt + (skyAmb[2] * hemi + bounce[2] * (1 - hemi) * 0.9) * ao;
          r = alb[0] * lr; g = alb[1] * lg; b = alb[2] * lb;
          if (water) {
            // reflect the sky at grazing incidence, ripple-broken
            const rip = N5.fbm(x * 60, z * 220, 3) * 0.08;
            let rdx = dx, rdy = -dy + Math.abs(rip) * 0.5 + 0.02, rdz = dz + rip;
            const rl = Math.hypot(rdx, rdy, rdz);
            const sc = skyAt(rdx / rl, rdy / rl, rdz / rl).c;
            const fres = 0.35 + 0.6 * Math.pow(1 - Math.abs(dy), 5);
            const body = [0.10, 0.09, 0.06];
            r = mix(body[0], sc[0], fres) * (0.6 + 0.4 * sh);
            g = mix(body[1], sc[1], fres) * (0.6 + 0.4 * sh);
            b = mix(body[2], sc[2], fres) * (0.6 + 0.4 * sh);
            mat[k] = 2;
          } else mat[k] = fg ? 3 : 1;
          // aerial perspective
          const dist = t;
          const hz = hazeColor(dx, dy, dz);
          const dens = fg ? 0 : 1 - Math.exp(-dist * 0.05);
          // haze is thicker low in the canyon (pooling air)
          const pool = 0;
          const fa = clamp(dens + pool, 0, 0.92);
          r = mix(r, hz[0], fa); g = mix(g, hz[1], fa); b = mix(b, hz[2], fa);
          depth[k] = t;
          // stroke direction: horizontal contour of the surface projected to screen
          let tx = -n[2], tz = n[0];
          const tl = Math.hypot(tx, tz);
          if (tl > 1e-4) {
            tx /= tl; tz /= tl;
            const p0 = project(x, y, z), p1 = project(x + tx * t * 0.01, y, z + tz * t * 0.01);
            if (p0 && p1) {
              const sx = (p1[0] - p0[0]) * RW, sy = -(p1[1] - p0[1]) * RH;
              ang[k] = Math.atan2(sy, sx);
            }
          }
          // steep cliffs -> strong horizontal strata; flats -> horizontal too
          angW[k] = 0.4 + 0.5 * steep;
        }
        col[k * 3] = r; col[k * 3 + 1] = g; col[k * 3 + 2] = b;
      }
    }
    console.log('raymarch', Math.round(performance.now() - t0), 'ms');
    // crepuscular beams: radial blur of the bright-sky mask toward the sun
    const sp = project(SUN[0] * 100, CAM.y + SUN[1] * 100, SUN[2] * 100);
    const sunPx = [((sp[0] + 1) / 2) * RW, ((1 - sp[1]) / 2) * RH];
    const beams = new Float32Array(N);
    const NS = 48;
    for (let py = 0; py < RH; py++) {
      for (let px = 0; px < RW; px++) {
        const k = py * RW + px;
        let acc = 0, w = 1, wsum = 0;
        const vx = (sunPx[0] - px) / NS, vy = (sunPx[1] - py) / NS;
        for (let i = 0; i < NS; i++) {
          const sx = Math.round(px + vx * i * 0.9), sy = Math.round(py + vy * i * 0.9);
          if (sx >= 0 && sx < RW && sy >= 0 && sy < RH) acc += occl[sy * RW + sx] * w;
          wsum += w; w *= 0.985;
        }
        beams[k] = acc / wsum;
      }
    }
    for (let k = 0; k < N; k++) {
      const dpt = depth[k];
      const air = mat[k] === 0 ? 0.55 : mat[k] === 3 ? 0.0 : clamp(1 - Math.exp(-dpt * 0.5), 0, 1);
      const bb = beams[k] * BEAM_K * air;
      col[k * 3] += bb * 1.0; col[k * 3 + 1] += bb * 0.78; col[k * 3 + 2] += bb * 0.45;
    }
    // halation: the glow around the light spreads softly, as in a luminist sky
    const bright = new Float32Array(N * 3);
    for (let k = 0; k < N; k++) {
      const l = 0.3 * col[k * 3] + 0.59 * col[k * 3 + 1] + 0.11 * col[k * 3 + 2];
      const f = Math.max(0, l - 0.85) / Math.max(l, 1e-4);
      bright[k * 3] = col[k * 3] * f; bright[k * 3 + 1] = col[k * 3 + 1] * f; bright[k * 3 + 2] = col[k * 3 + 2] * f;
    }
    const bl1 = G.CORE.blurPlane(bright, RW, RH, 3, RW * 0.012, 3);
    const bl2 = G.CORE.blurPlane(bright, RW, RH, 3, RW * 0.05, 3);
    for (let k = 0; k < N * 3; k++) col[k] += bl1[k] * 0.35 + bl2[k] * 0.45;
    // tone map (filmic shoulder, keeps darks rich) + grade: richer chroma, cool shadows, warm lights
    const SAT = 1.28;
    for (let k = 0; k < N; k++) {
      const o = k * 3;
      for (let c = 0; c < 3; c++) {
        let x = col[o + c] * 0.85;
        x = (x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14);
        col[o + c] = clamp(x, 0, 1);
      }
      let r = col[o], g = col[o + 1], b = col[o + 2];
      const l = 0.3 * r + 0.59 * g + 0.11 * b;
      r = l + (r - l) * SAT; g = l + (g - l) * SAT; b = l + (b - l) * SAT;
      const sh = 1 - smooth(0.05, 0.4, l), hi = smooth(0.45, 0.9, l);
      r += -0.012 * sh + 0.02 * hi; g += -0.004 * sh + 0.008 * hi; b += 0.02 * sh - 0.02 * hi;
      col[o] = Math.pow(clamp(r, 0, 1), 1 / 2.2);
      col[o + 1] = Math.pow(clamp(g, 0, 1), 1 / 2.2);
      col[o + 2] = Math.pow(clamp(b, 0, 1), 1 / 2.2);
    }
    console.log('study done', Math.round(performance.now() - t0), 'ms');
    return { RW, RH, col, depth, mat, ang, angW, sunlit, cloud, beams, sunPx };
  }

  G.SCENE = { canyonH: (x, z) => canyonH(x, z, 1), pick: (fx, fy) => { if (!GR) buildGrids(0.3); const [dx, dy, dz] = camRay(fx * 2 - 1, 1 - fy * 2); const t = march(0, CAM.y, 0, dx, dy, dz, 40); return t < 0 ? null : [dx * t, CAM.y + dy * t, dz * t, t]; }, render, buildGrids, project, camRay, SUN, LIGHT, CAM, riverZ, H: (x, z) => H(x, z) };
})(typeof window !== 'undefined' ? window : globalThis);
