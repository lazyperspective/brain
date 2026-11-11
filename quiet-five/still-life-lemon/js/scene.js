/* Still Life with Lemon — scene geometry, materials and a small CPU ray tracer.
   Output is split into linear light layers so the candle flicker can be re-mixed per frame:
     A  = ambient (constant)            D  = candle diffuse + indirect (breathes with the flame)
     Sa = candle speculars, flame pos a  Sb = candle speculars, flame pos b                      */
(function (G) {
  'use strict';
  const Q = G.Q;
  const NZ = Q.makeNoise(1717);
  const NW = Q.makeNoise(4242);
  const NL = Q.makeNoise(9091);
  const sqrt = Math.sqrt, abs = Math.abs, min = Math.min, max = Math.max, exp = Math.exp, pow = Math.pow;
  const PI = Math.PI;

  // ------------------------------------------------------------------ scene description (cm)
  const S = (Q.SCENE = {
    E: [0, 20.5, 84], T: [-0.2, 6.9, -9], fovY: (21.6 * PI) / 180,
    L: { P: [-70, 86, 18], R: 2.2, I: 21000, col: [1.0, 0.79, 0.55], dA: [-0.9, -1.2, 0.4], dB: [1.0, 1.3, -0.5] },
    tab: { zBack: -64, slabT: 4.0, nose: 1.0, inset: 14 },
    wallZ: -64,
    plate: { x: 1.9, z: -4.3, R: 10.5 },
    lemon: { C: [1.6, 3.15, -5.0], ax: [-0.82, 0.16, 0.55], A: 4.25, R: 2.9, uc: 3.0 },
    knife: { O: [-9.0, 0.72, -0.4], dir: [0.17, -0.985] },
    glass: { x: -9.3, z: -21.0, gs: 1.18 },
    amb: [0.020, 0.018, 0.015],
  });
  const ID = (Q.ID = { NONE: 0, WALL: 1, TOP: 2, NOSE: 3, FRONT: 4, APRON: 5, PLATE: 6, LEMON: 7, BLADE: 8, BOLSTER: 9, HANDLE: 10, GLASS: 11, PEEL: 12 });

  // ------------------------------------------------------------------ small vector helpers
  function norm3(v) { const l = sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; }
  function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
  function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  Q.norm3 = norm3; Q.cross = cross; Q.dot = dot;

  // ------------------------------------------------------------------ camera
  const CAM = (Q.CAM = {});
  function setupCamera(W, H) {
    const f = norm3([S.T[0] - S.E[0], S.T[1] - S.E[1], S.T[2] - S.E[2]]);
    const r = norm3(cross(f, [0, 1, 0]));
    const u = cross(r, f);
    CAM.f = f; CAM.r = r; CAM.u = u; CAM.W = W; CAM.H = H;
    CAM.ty = Math.tan(S.fovY / 2); CAM.tx = (CAM.ty * W) / H;
  }
  Q.setupCamera = setupCamera;
  Q.project = function (x, y, z, out) {
    const vx = x - S.E[0], vy = y - S.E[1], vz = z - S.E[2];
    const cx = vx * CAM.r[0] + vy * CAM.r[1] + vz * CAM.r[2];
    const cy = vx * CAM.u[0] + vy * CAM.u[1] + vz * CAM.u[2];
    const cz = vx * CAM.f[0] + vy * CAM.f[1] + vz * CAM.f[2];
    out[0] = ((cx / (cz * CAM.tx) + 1) * CAM.W) / 2 - 0.5;
    out[1] = ((1 - cy / (cz * CAM.ty)) * CAM.H) / 2 - 0.5;
    out[2] = cz;
    return out;
  };
  function camRay(px, py, out) {
    const sx = ((px + 0.5) / CAM.W) * 2 - 1, sy = 1 - ((py + 0.5) / CAM.H) * 2;
    const dx = CAM.f[0] + sx * CAM.tx * CAM.r[0] + sy * CAM.ty * CAM.u[0];
    const dy = CAM.f[1] + sx * CAM.tx * CAM.r[1] + sy * CAM.ty * CAM.u[1];
    const dz = CAM.f[2] + sx * CAM.tx * CAM.r[2] + sy * CAM.ty * CAM.u[2];
    const l = sqrt(dx * dx + dy * dy + dz * dz);
    out[0] = dx / l; out[1] = dy / l; out[2] = dz / l;
  }
  Q.camRay = camRay;

  // ------------------------------------------------------------------ lemon frame
  const LM = {};
  (function () {
    const a = norm3(S.lemon.ax);
    let b = [0, 1, 0];
    const k = dot(b, a); b = norm3([b[0] - a[0] * k, b[1] - a[1] * k, b[2] - a[2] * k]);
    const c = cross(a, b);
    LM.a = a; LM.b = b; LM.c = c;
  })();
  Q.LEMON_FRAME = LM;

  // peel boundary on the lemon: u position (along axis) where the remaining rind ends, as a function of angle
  function peelBoundary(phi) {
    return 1.25 + 0.75 * Math.sin(phi * 1.0 + 2.3) + 0.18 * Math.sin(phi * 3.0 + 1.1) + 0.06 * Math.sin(phi * 7.0);
  }
  Q.peelBoundary = peelBoundary;

  const RIND_T = 0.2;
  // signed distance of the intact (unpeeled) lemon body in lemon-local coords
  function lemonBody(u, v, w, x, y, z) {
    const A = S.lemon.A, R = S.lemon.R;
    const rr = R * (1 + 0.045 * u / A);
    const rho = sqrt(v * v + w * w);
    // body ellipsoid (iq approximate)
    let k0 = sqrt((u / A) * (u / A) + (rho / rr) * (rho / rr));
    let k1 = sqrt((u / (A * A)) * (u / (A * A)) + (rho / (rr * rr)) * (rho / (rr * rr)));
    let d = (k0 * (k0 - 1)) / k1;
    // nipples (both ends), smooth union
    const un = abs(u) - (A + 0.05);
    const k0n = sqrt((un / 0.62) * (un / 0.62) + (rho / 0.5) * (rho / 0.5));
    const k1n = sqrt((un / 0.3844) * (un / 0.3844) + (rho / 0.25) * (rho / 0.25));
    const dn = (k0n * (k0n - 1)) / k1n;
    const kk = 0.55;
    const h = Q.clamp(0.5 + (0.5 * (dn - d)) / kk, 0, 1);
    d = dn + (d - dn) * h - kk * h * (1 - h);
    // irregular, knobbly lemon
    d += 0.05 * NL.n3(x * 0.55, y * 0.55, z * 0.55) + 0.012 * NL.n3(x * 2.3, y * 2.3, z * 2.3);
    return d;
  }
  const LTMP = { peel: 0, cut: 0, dOuter: 0, u: 0, phi: 0 };
  function sdLemon(x, y, z) {
    const C = S.lemon.C;
    const px = x - C[0], py = y - C[1], pz = z - C[2];
    const u = px * LM.a[0] + py * LM.a[1] + pz * LM.a[2];
    const v = px * LM.b[0] + py * LM.b[1] + pz * LM.b[2];
    const w = px * LM.c[0] + py * LM.c[1] + pz * LM.c[2];
    const d0 = lemonBody(u, v, w, x, y, z);
    const phi = Math.atan2(w, v);
    const pb = peelBoundary(phi);
    const pm = Q.smooth(-0.09, 0.09, u - pb);
    let d = d0 + RIND_T * pm;
    const dc = u - S.lemon.uc;
    LTMP.peel = pm; LTMP.dOuter = d0; LTMP.u = u; LTMP.phi = phi; LTMP.cut = dc > d - 0.002 ? 1 : 0;
    if (dc > d) d = dc;
    return d;
  }
  Q.sdLemon = sdLemon;

  // ------------------------------------------------------------------ pewter plate (solid of revolution)
  function plateTop(r) {
    let h;
    if (r < 5.0) h = 0.40 + 0.02 * (r / 5.0);
    else if (r < 8.0) h = 0.42 + 1.02 * Q.smooth(5.0, 8.0, r);
    else h = 1.44 + 0.06 * ((r - 8.0) / 2.1);
    const q = (r - 10.12) / 0.21;
    h += 0.15 * exp(-q * q);
    return h;
  }
  Q.plateTop = plateTop;
  function smax(a, b, k) { const h = Q.clamp(0.5 - (0.5 * (b - a)) / k, 0, 1); return b + (a - b) * h + k * h * (1 - h); }
  function sdPlate(x, y, z) {
    const px = x - S.plate.x, pz = z - S.plate.z;
    const r = sqrt(px * px + pz * pz);
    const top = plateTop(r);
    const bot = r < 5.2 ? 0 : top - 0.32;
    let d = smax(y - top, bot - y, 0.05);
    d = smax(d, r - S.plate.R, 0.12);
    return d * 0.82;
  }
  Q.sdPlate = sdPlate;

  // ------------------------------------------------------------------ knife
  const KN = {};
  (function () {
    const k = S.knife;
    const tipLen = 12.2;
    const pitch = Math.asin((k.O[1] - 0.012) / tipLen);
    const hd = norm3([k.dir[0], 0, k.dir[1]]);
    const xa = norm3([hd[0] * Math.cos(pitch), -Math.sin(pitch), hd[2] * Math.cos(pitch)]);
    const za = norm3(cross(xa, [0, 1, 0]));
    const ya = cross(za, xa);
    KN.x = xa; KN.y = ya; KN.z = za; KN.len = tipLen;
  })();
  Q.KNIFE_FRAME = KN;
  const KTMP = { part: 0, lx: 0, ly: 0, lz: 0, frac: 0 };
  function sdKnife(x, y, z) {
    const O = S.knife.O;
    const px = x - O[0], py = y - O[1], pz = z - O[2];
    const lx = px * KN.x[0] + py * KN.x[1] + pz * KN.x[2];
    const ly = px * KN.y[0] + py * KN.y[1] + pz * KN.y[2];
    const lz = px * KN.z[0] + py * KN.z[1] + pz * KN.z[2];
    const L = KN.len;
    // blade
    const xs = Q.clamp(lx / L, 0, 1);
    const zs = 0.92 - 0.32 * xs * xs * xs;
    const ze = -1.02 + 1.62 * pow(xs, 2.6);
    const d2 = max(max(ze - lz, lz - zs), max(0.45 - lx, lx - L));
    const fr = Q.clamp((lz - ze) / max(zs - ze, 0.01), 0, 1);
    const ht = 0.010 + 0.062 * pow(fr, 0.6);
    let dBlade = max(d2 * 0.9, abs(ly) - ht);
    // bolster
    const rho = sqrt(ly * ly + lz * lz);
    const dB1 = max(abs(lx + 0.05) - 0.52, rho - 0.66);
    const dB2 = max(abs(lx + 0.62) - 0.07, rho - 0.80);
    const dBol = min(dB1, dB2) - 0.02;
    // handle (slightly oval bone)
    const xc = Q.clamp(lx, -8.6, -0.65);
    const tt = (-xc - 0.65) / 7.95;
    const rh = 0.72 + 0.24 * pow(tt, 0.8) - 0.05 * tt * tt * tt * tt;
    const lzz = lz * 0.93;
    const dH = sqrt((lx - xc) * (lx - xc) + ly * ly + lzz * lzz) - rh;
    let d = dBlade, part = 0;
    if (dBol < d) { d = dBol; part = 1; }
    if (dH < d) { d = dH; part = 2; }
    KTMP.part = part; KTMP.lx = lx; KTMP.ly = ly; KTMP.lz = lz; KTMP.frac = fr;
    return d;
  }
  Q.sdKnife = sdKnife;

  // ------------------------------------------------------------------ object list with bounding spheres
  const OBJS = [];
  function buildObjects() {
    OBJS.length = 0;
    OBJS.push({ id: ID.LEMON, sdf: sdLemon, c: S.lemon.C, r: 5.4 });
    OBJS.push({ id: ID.PLATE, sdf: sdPlate, c: [S.plate.x, 0.9, S.plate.z], r: S.plate.R + 0.3 });
    const k = S.knife;
    const mid = [k.O[0] + KN.x[0] * 2.5, k.O[1] + KN.x[1] * 2.5, k.O[2] + KN.x[2] * 2.5];
    OBJS.push({ id: ID.BLADE, sdf: sdKnife, c: mid, r: 12.8 });
  }
  buildObjects();
  Q.OBJS = OBJS;

  function raySphere(ox, oy, oz, dx, dy, dz, c, r, out) {
    const lx = ox - c[0], ly = oy - c[1], lz = oz - c[2];
    const b = lx * dx + ly * dy + lz * dz;
    const cc = lx * lx + ly * ly + lz * lz - r * r;
    const disc = b * b - cc;
    if (disc < 0) return false;
    const s = sqrt(disc);
    out[0] = -b - s; out[1] = -b + s;
    return out[1] > 0;
  }
  const RS = [0, 0];

  function marchSdf(sdf, ox, oy, oz, dx, dy, dz, t0, t1) {
    let t = t0;
    for (let i = 0; i < 220; i++) {
      const d = sdf(ox + dx * t, oy + dy * t, oz + dz * t);
      if (d < 0.0012 + t * 0.00002) return t;
      t += d;
      if (t > t1) return -1;
    }
    return -1;
  }

  // ------------------------------------------------------------------ hit record
  const H = { t: 0, id: 0, x: 0, y: 0, z: 0, nx: 0, ny: 0, nz: 0, obj: null };
  Q.HIT = H;

  function intersectOpaque(ox, oy, oz, dx, dy, dz, tmax, skipPlanes) {
    let best = tmax, id = 0, obj = null;
    const tb = S.tab;
    if (!skipPlanes) {
      // table top
      if (dy < 0 && oy > 0) {
        const t = -oy / dy; const z = oz + dz * t;
        if (t < best && z <= -tb.nose && z >= tb.zBack) { best = t; id = ID.TOP; }
      }
      // rounded nose: cylinder along x centred (y=-nose,z=-nose)
      {
        const cy = -tb.nose, cz = -tb.nose, R = tb.nose;
        const ly = oy - cy, lz = oz - cz;
        const a = dy * dy + dz * dz, b = ly * dy + lz * dz, c = ly * ly + lz * lz - R * R;
        const disc = b * b - a * c;
        if (disc > 0 && a > 1e-9) {
          const t = (-b - sqrt(disc)) / a;
          if (t > 0 && t < best) { const y = oy + dy * t, z = oz + dz * t; if (y >= cy && z >= cz) { best = t; id = ID.NOSE; } }
        }
      }
      // front face
      if (dz < 0 && oz > 0) {
        const t = -oz / dz; const y = oy + dy * t;
        if (t < best && y <= -tb.nose && y >= -tb.slabT) { best = t; id = ID.FRONT; }
      }
      // apron
      if (dz < 0 && oz > -tb.inset) {
        const t = (-tb.inset - oz) / dz; const y = oy + dy * t;
        if (t > 0 && t < best && y < -tb.slabT) { best = t; id = ID.APRON; }
      }
      // underside of slab (visible only from below)
      if (dy > 0 && oy < -tb.slabT) {
        const t = (-tb.slabT - oy) / dy; const z = oz + dz * t;
        if (t < best && z <= 0 && z >= -tb.inset) { best = t; id = ID.APRON; }
      }
      // wall
      if (dz < 0 && oz > S.wallZ) {
        const t = (S.wallZ - oz) / dz;
        if (t < best && oy + dy * t > 0) { best = t; id = ID.WALL; }
      }
    }
    for (let i = 0; i < OBJS.length; i++) {
      const o = OBJS[i];
      if (!raySphere(ox, oy, oz, dx, dy, dz, o.c, o.r, RS)) continue;
      const t0 = max(RS[0], 0.0005);
      const t1 = min(RS[1], best);
      if (t0 >= t1) continue;
      const t = marchSdf(o.sdf, ox, oy, oz, dx, dy, dz, t0, t1);
      if (t > 0 && t < best) { best = t; id = o.id; obj = o; }
    }
    if (id === 0) return false;
    H.t = best; H.id = id; H.obj = obj;
    H.x = ox + dx * best; H.y = oy + dy * best; H.z = oz + dz * best;
    // normals
    switch (id) {
      case ID.TOP: H.nx = 0; H.ny = 1; H.nz = 0; break;
      case ID.FRONT: case ID.APRON: H.nx = 0; H.ny = 0; H.nz = 1; if (dy > 0 && H.y <= -tb.slabT + 1e-3 && H.z > -tb.inset) { H.ny = -1; H.nz = 0; } break;
      case ID.WALL: H.nx = 0; H.ny = 0; H.nz = 1; break;
      case ID.NOSE: { const ny = H.y + tb.nose, nz = H.z + tb.nose; const l = sqrt(ny * ny + nz * nz); H.nx = 0; H.ny = ny / l; H.nz = nz / l; break; }
      default: {
        const f = obj.sdf, e = 0.0025;
        const x = H.x, y = H.y, z = H.z;
        const gx = f(x + e, y, z) - f(x - e, y, z);
        const gy = f(x, y + e, z) - f(x, y - e, z);
        const gz = f(x, y, z + e) - f(x, y, z - e);
        const l = sqrt(gx * gx + gy * gy + gz * gz) || 1;
        H.nx = gx / l; H.ny = gy / l; H.nz = gz / l;
        f(x, y, z); // refresh per-object temp info at the hit point
        if (id === ID.BLADE) { H.id = KTMP.part === 0 ? ID.BLADE : KTMP.part === 1 ? ID.BOLSTER : ID.HANDLE; }
      }
    }
    return true;
  }
  Q.intersectOpaque = intersectOpaque;

  // ------------------------------------------------------------------ glass (roemer) intersection
  const GL = S.glass;
  GL.yc = 11.9 * GL.gs; GL.a = 4.75 * GL.gs; GL.b = 5.35 * GL.gs; GL.yRim = 14.85 * GL.gs; GL.wl = 10.3 * GL.gs; GL.y0 = 1.45 * GL.gs; GL.rs = 2.2 * GL.gs;
  GL.yJoin = GL.yc - GL.b * sqrt(1 - (GL.rs / GL.a) * (GL.rs / GL.a));
  const PRUNTS = [];
  (function () {
    const rows = [2.6 * GL.gs, 4.05 * GL.gs, 5.5 * GL.gs];
    for (let r = 0; r < rows.length; r++) {
      for (let k = 0; k < 6; k++) {
        const ang = ((k + (r % 2) * 0.5) / 6) * 2 * PI + 0.35;
        const rr = GL.rs + 0.02;
        PRUNTS.push({ c: [GL.x + Math.cos(ang) * rr, rows[r], GL.z + Math.sin(ang) * rr], r: 0.4 * GL.gs });
      }
    }
  })();
  Q.PRUNTS = PRUNTS;
  function footR0(y) {
    const t = Q.clamp(y / GL.y0, 0, 1);
    const base = 3.85 - 1.55 * pow(t, 0.85);
    const coil = 0.09 * abs(Math.sin(t * PI * 4.5)) - 0.045;
    return (base + coil) * GL.gs;
  }
  const FOOTN = 2048, FOOTLUT = new Float32Array(FOOTN + 2);
  for (let i = 0; i <= FOOTN + 1; i++) FOOTLUT[i] = footR0((i / FOOTN) * GL.y0);
  function footR(y) {
    let f = (y / GL.y0) * FOOTN;
    if (f <= 0) return FOOTLUT[0];
    if (f >= FOOTN) return FOOTLUT[FOOTN];
    const i = f | 0; f -= i;
    return FOOTLUT[i] + (FOOTLUT[i + 1] - FOOTLUT[i]) * f;
  }
  // glass hit record
  const GH = { t: 0, part: 0, nx: 0, ny: 0, nz: 0, idx: 0 };
  // parts: 1 bowl, 2 wine surface, 3 stem, 4 foot, 5 prunt
  function intersectGlass(ox, oy, oz, dx, dy, dz, tmax) {
    let best = tmax, part = 0, idx = -1;
    // quick bound: cylinder radius 5 around glass axis, y in [-0.1, rim+0.2]
    {
      const lx = ox - GL.x, lz = oz - GL.z;
      const a = dx * dx + dz * dz, b = lx * dx + lz * dz, c = lx * lx + lz * lz - (GL.a + 0.4) * (GL.a + 0.4);
      const disc = b * b - a * c;
      if (disc <= 0 || a < 1e-12) return false;
      const s = sqrt(disc);
      const t0 = (-b - s) / a, t1 = (-b + s) / a;
      if (t1 < 0 || t0 > best) return false;
      const y0 = oy + dy * max(t0, 0), y1 = oy + dy * t1;
      if (min(y0, y1) > GL.yRim + 0.3 || max(y0, y1) < -0.1) return false;
    }
    // bowl ellipsoid
    {
      const ia = 1 / GL.a, ib = 1 / GL.b;
      const lx = (ox - GL.x) * ia, ly = (oy - GL.yc) * ib, lz = (oz - GL.z) * ia;
      const ex = dx * ia, ey = dy * ib, ez = dz * ia;
      const a = ex * ex + ey * ey + ez * ez, b = lx * ex + ly * ey + lz * ez, c = lx * lx + ly * ly + lz * lz - 1;
      const disc = b * b - a * c;
      if (disc > 0) {
        const s = sqrt(disc);
        const ts = [(-b - s) / a, (-b + s) / a];
        for (let k = 0; k < 2; k++) {
          const t = ts[k];
          if (t > 0.002 && t < best) {
            const y = oy + dy * t;
            if (y <= GL.yRim) { best = t; part = 1; break; }
          }
        }
      }
    }
    // wine surface
    if (abs(dy) > 1e-9) {
      const t = (GL.wl - oy) / dy;
      if (t > 0.002 && t < best) {
        const x = ox + dx * t - GL.x, z = oz + dz * t - GL.z;
        const ry = (GL.wl - GL.yc) / GL.b;
        const rmax = GL.a * sqrt(1 - ry * ry);
        if (x * x + z * z < rmax * rmax) { best = t; part = 2; }
      }
    }
    // stem cylinder
    {
      const lx = ox - GL.x, lz = oz - GL.z;
      const a = dx * dx + dz * dz, b = lx * dx + lz * dz, c = lx * lx + lz * lz - GL.rs * GL.rs;
      const disc = b * b - a * c;
      if (disc > 0 && a > 1e-12) {
        const s = sqrt(disc);
        const ts = [(-b - s) / a, (-b + s) / a];
        for (let k = 0; k < 2; k++) {
          const t = ts[k];
          if (t > 0.002 && t < best) {
            const y = oy + dy * t;
            if (y >= GL.y0 && y <= GL.yJoin) { best = t; part = 3; break; }
          }
        }
      }
    }
    // prunts
    for (let i = 0; i < PRUNTS.length; i++) {
      const p = PRUNTS[i];
      if (raySphere(ox, oy, oz, dx, dy, dz, p.c, p.r, RS)) {
        const t = RS[0] > 0.002 ? RS[0] : RS[1];
        if (t > 0.002 && t < best) {
          // ignore the part of the sphere buried in the stem
          const x = ox + dx * t - GL.x, z = oz + dz * t - GL.z;
          if (x * x + z * z > GL.rs * GL.rs) { best = t; part = 5; idx = i; }
        }
      }
    }
    // coiled foot: numerical march on f = rho - footR(y)
    {
      let tA = 0.002, tB = best;
      // restrict to slab y in [0, y0]
      if (abs(dy) > 1e-9) {
        const ta = (0 - oy) / dy, tb2 = (GL.y0 - oy) / dy;
        tA = max(tA, min(ta, tb2)); tB = min(tB, max(ta, tb2));
      } else if (oy < 0 || oy > GL.y0) tB = -1;
      if (tB > tA) {
        const n = 48;
        const dt = (tB - tA) / n;
        let tp = tA;
        let fp = 0;
        {
          const x = ox + dx * tp - GL.x, y = oy + dy * tp, z = oz + dz * tp - GL.z;
          fp = sqrt(x * x + z * z) - footR(y);
        }
        for (let i = 1; i <= n; i++) {
          const t = tA + dt * i;
          const x = ox + dx * t - GL.x, y = oy + dy * t, z = oz + dz * t - GL.z;
          const f = sqrt(x * x + z * z) - footR(y);
          if ((f < 0) !== (fp < 0)) {
            let lo = tp, hi = t, flo = fp;
            for (let k = 0; k < 14; k++) {
              const m = 0.5 * (lo + hi);
              const xm = ox + dx * m - GL.x, ym = oy + dy * m, zm = oz + dz * m - GL.z;
              const fm = sqrt(xm * xm + zm * zm) - footR(ym);
              if ((fm < 0) === (flo < 0)) { lo = m; flo = fm; } else hi = m;
            }
            const tt = 0.5 * (lo + hi);
            if (tt < best) { best = tt; part = 4; }
            break;
          }
          tp = t; fp = f;
        }
      }
    }
    if (!part) return false;
    GH.t = best; GH.part = part; GH.idx = idx;
    const x = ox + dx * best, y = oy + dy * best, z = oz + dz * best;
    let nx, ny, nz;
    if (part === 1) { nx = (x - GL.x) / (GL.a * GL.a); ny = (y - GL.yc) / (GL.b * GL.b); nz = (z - GL.z) / (GL.a * GL.a); }
    else if (part === 2) {
      // meniscus: near the wall the surface curls up
      const rx = x - GL.x, rz = z - GL.z; const rr = sqrt(rx * rx + rz * rz);
      const ry = (GL.wl - GL.yc) / GL.b; const rmax = GL.a * sqrt(1 - ry * ry);
      const m = Q.smooth(rmax - 0.22, rmax, rr);
      nx = (-rx / (rr || 1)) * m * 1.3; ny = 1; nz = (-rz / (rr || 1)) * m * 1.3;
    }
    else if (part === 3) { nx = x - GL.x; ny = 0; nz = z - GL.z; }
    else if (part === 5) { const c = PRUNTS[idx].c; nx = x - c[0]; ny = y - c[1]; nz = z - c[2]; }
    else {
      const rx = x - GL.x, rz = z - GL.z; const rr = sqrt(rx * rx + rz * rz) || 1;
      const e = 0.004; const dr = (footR(y + e) - footR(y - e)) / (2 * e);
      nx = rx / rr; ny = -dr; nz = rz / rr;
    }
    const l = sqrt(nx * nx + ny * ny + nz * nz) || 1;
    GH.nx = nx / l; GH.ny = ny / l; GH.nz = nz / l;
    return true;
  }
  Q.intersectGlass = intersectGlass;
  Q.GH = GH;

  function insideWine(x, y, z) {
    if (y > GL.wl) return false;
    const lx = (x - GL.x) / GL.a, ly = (y - GL.yc) / GL.b, lz = (z - GL.z) / GL.a;
    return lx * lx + ly * ly + lz * lz < 1;
  }
  Q.insideWine = insideWine;
  function insideGlassVolume(x, y, z) { // inside the bowl (air or wine) — used for medium bookkeeping
    if (y > GL.yRim) return false;
    const lx = (x - GL.x) / GL.a, ly = (y - GL.yc) / GL.b, lz = (z - GL.z) / GL.a;
    return lx * lx + ly * ly + lz * lz < 1;
  }

  // ------------------------------------------------------------------ light, shadows
  const LP = S.L.P;
  const LPA = [LP[0] + S.L.dA[0], LP[1] + S.L.dA[1], LP[2] + S.L.dA[2]];
  const LPB = [LP[0] + S.L.dB[0], LP[1] + S.L.dB[1], LP[2] + S.L.dB[2]];

  const SPOT = norm3([-2 - LP[0], 4 - LP[1], -9 - LP[2]]);
  function spot(x, y, z) {
    let lx = x - LP[0], ly = y - LP[1], lz = z - LP[2];
    const l = sqrt(lx * lx + ly * ly + lz * lz);
    const c = (lx * SPOT[0] + ly * SPOT[1] + lz * SPOT[2]) / l;
    return 0.07 + 0.93 * Q.smooth(Math.cos((30 * PI) / 180), Math.cos((9 * PI) / 180), c);
  }
  Q.spot = spot;
  function softShadow(px, py, pz, skipId) {
    let lx = LP[0] - px, ly = LP[1] - py, lz = LP[2] - pz;
    const dist = sqrt(lx * lx + ly * ly + lz * lz);
    lx /= dist; ly /= dist; lz /= dist;
    const kpen = dist / S.L.R; // inverse angular size
    let res = 1;
    for (let i = 0; i < OBJS.length; i++) {
      const o = OBJS[i];
      if (o.id === skipId && o.id !== ID.PLATE) continue; // convex: self shadowing handled by the terminator
      if (!raySphere(px, py, pz, lx, ly, lz, o.c, o.r + 1.0, RS)) continue;
      let t = max(RS[0], 0.01);
      const t1 = min(RS[1], dist);
      const sdf = o.sdf;
      let ph = 1e10;
      for (let k = 0; k < 120 && t < t1; k++) {
        const h = sdf(px + lx * t, py + ly * t, pz + lz * t);
        if (h < 0.0005) { res = 0; return 0; }
        const y = (h * h) / (2 * ph);
        const d = sqrt(max(h * h - y * y, 0));
        res = min(res, (kpen * 0.5 * d) / max(0.0001, t - y));
        ph = h;
        t += Q.clamp(h, 0.01, 1.5);
      }
    }
    res = Q.clamp(res, 0, 1);
    return res * res * (3 - 2 * res);
  }
  // shadow from the slab onto the recessed apron
  function apronShadow(px, py, pz) {
    const tb = S.tab;
    if (pz > -tb.inset + 0.01 || py > -tb.slabT) return 1;
    const lx = LP[0] - px, ly = LP[1] - py, lz = LP[2] - pz;
    const y0 = py + (ly * (0 - pz)) / lz; // y where light ray crosses z=0 plane
    return Q.smooth(-tb.slabT - 0.25, -tb.slabT - 0.02, -y0) ;
  }

  // glass shadow + caustic on the table via photon map (filled by buildCaustics)
  const CAU = (Q.CAUSTIC = { ok: false });
  function causticAt(x, z, out) {
    if (!CAU.ok) { out[0] = out[1] = out[2] = 1; return; }
    const fx = (x - CAU.x0) / CAU.cs, fz = (z - CAU.z0) / CAU.cs;
    if (fx < 0 || fz < 0 || fx >= CAU.nx - 1 || fz >= CAU.nz - 1) { out[0] = out[1] = out[2] = 1; return; }
    const ix = fx | 0, iz = fz | 0, ax = fx - ix, az = fz - iz;
    for (let c = 0; c < 3; c++) {
      const m = CAU.map[c];
      const i0 = iz * CAU.nx + ix;
      const v = (m[i0] * (1 - ax) + m[i0 + 1] * ax) * (1 - az) + (m[i0 + CAU.nx] * (1 - ax) + m[i0 + CAU.nx + 1] * ax) * az;
      out[c] = v;
    }
  }
  // approximate glass occlusion for non-table receivers (green tinted, soft)
  function glassShadowApprox(px, py, pz, out) {
    out[0] = out[1] = out[2] = 1;
    let lx = LP[0] - px, ly = LP[1] - py, lz = LP[2] - pz;
    const dist = sqrt(lx * lx + ly * ly + lz * lz); lx /= dist; ly /= dist; lz /= dist;
    // distance of light ray to glass axis segment
    const ax = GL.x - px, az = GL.z - pz;
    const tc = (ax * lx + az * lz) / max(lx * lx + lz * lz, 1e-6);
    if (tc <= 0) return;
    const cx = px + lx * tc - GL.x, cz = pz + lz * tc - GL.z, cy = py + ly * tc;
    if (cy < 0 || cy > GL.yRim + 0.5) return;
    const rr = sqrt(cx * cx + cz * cz);
    const R = cy > GL.yJoin ? GL.a * sqrt(max(0, 1 - ((cy - GL.yc) / GL.b) ** 2)) : cy > GL.y0 ? GL.rs + 0.4 : footR(cy);
    const inside = 1 - Q.smooth(R - 0.6, R + 0.4, rr);
    out[0] = 1 - inside * 0.30; out[1] = 1 - inside * 0.22; out[2] = 1 - inside * 0.42;
  }

  Q.LIGHT = { P: LP, A: LPA, B: LPB };
  Q.softShadowAt = softShadow;
  // peel static shadow hook (set by peel.js)
  Q.peelStaticShadow = null;

  // ------------------------------------------------------------------ BRDF helpers
  function ggx(nh, a) { const a2 = a * a; const d = nh * nh * (a2 - 1) + 1; return a2 / (PI * d * d); }
  function specTerm(nx, ny, nz, vx, vy, vz, Lp, px, py, pz, rough) {
    // returns D*Vis*nl for a sphere light at Lp (energy-normalised GGX widened by light size)
    let lx = Lp[0] - px, ly = Lp[1] - py, lz = Lp[2] - pz;
    const dist2 = lx * lx + ly * ly + lz * lz, dist = sqrt(dist2);
    lx /= dist; ly /= dist; lz /= dist;
    const nl = nx * lx + ny * ly + nz * lz;
    if (nl <= 0) return 0;
    const nv = max(nx * vx + ny * vy + nz * vz, 0.02);
    let hx = lx + vx, hy = ly + vy, hz = lz + vz; const hl = sqrt(hx * hx + hy * hy + hz * hz) || 1;
    hx /= hl; hy /= hl; hz /= hl;
    const nh = max(0, nx * hx + ny * hy + nz * hz);
    const a = min(1, rough * rough + (S.L.R / dist) * 0.5);
    const norm = (rough * rough) / a; // energy conservation for widened lobe
    const D = ggx(nh, a) * norm * norm;
    const k = (a * 0.5);
    const vis = 1 / ((nl * (1 - k) + k) * (nv * (1 - k) + k));
    return (D * vis * nl * 0.25) * (S.L.I / dist2);
  }
  Q.specTerm = function (a, b, c, d, e, f, g, h, i, j, k) { return specTerm(a, b, c, d, e, f, g, h, i, j, k); };
  function fresnel(cosT, f0) { const m = 1 - cosT; const m2 = m * m; return f0 + (1 - f0) * m2 * m2 * m; }
  function fresnelDiel(cosi, n1, n2) {
    const eta = n1 / n2; const sint2 = eta * eta * (1 - cosi * cosi);
    if (sint2 >= 1) return 1;
    const cost = sqrt(1 - sint2);
    const rs = (n1 * cosi - n2 * cost) / (n1 * cosi + n2 * cost);
    const rp = (n1 * cost - n2 * cosi) / (n1 * cost + n2 * cosi);
    return 0.5 * (rs * rs + rp * rp);
  }

  // ------------------------------------------------------------------ materials
  const MAT = { alb: [0, 0, 0], f0: [0, 0, 0], rough: 0.5, wrap: 0, gloss: 0, glossRough: 0, spec: 0, sss: [0, 0, 0], tang: [1, 0, 0], kind: 0 };
  Q.MAT = MAT;
  const TMP3 = [0, 0, 0], TMP3b = [0, 0, 0];

  function wallMask(x, y) {
    // the pool of candle light on the wall — brighter right of centre, falling away to the corners
    const dx = (x - 3) / 36, dy = (y - 18) / 26;
    const g = exp(-(dx * dx + dy * dy) * 1.25);
    const n = 0.85 + 0.3 * NW.fbm2(x * 0.03, y * 0.03, 3);
    return (0.035 + 0.9 * g) * n;
  }
  Q.wallMask = wallMask;

  function material(id, x, y, z, nrm, vdir) {
    const m = MAT;
    m.wrap = 0; m.gloss = 0; m.spec = 0; m.sss[0] = m.sss[1] = m.sss[2] = 0; m.kind = id; m.f0[0] = m.f0[1] = m.f0[2] = 0.04; m.rough = 0.5; m.glossRough = 0.3;
    switch (id) {
      case ID.WALL: {
        const n1 = NW.fbm2(x * 0.06, y * 0.06, 4), n2 = NW.fbm2(x * 0.5 + 40, y * 0.5, 3), n3 = NW.fbm2(x * 0.16 + 9, y * 0.2, 3);
        const k = 1 + 0.3 * n1 + 0.08 * n2 + 0.16 * n3;
        m.alb[0] = 0.070 * k; m.alb[1] = 0.062 * k * (1 + 0.04 * n2); m.alb[2] = 0.044 * k;
        m.spec = 0; m.rough = 0.9; m.tang[0] = 1; m.tang[1] = 0; m.tang[2] = 0;
        break;
      }
      case ID.TOP: case ID.NOSE: case ID.FRONT: case ID.APRON: {
        // dark waxed walnut, grain runs along x
        const gy = id === ID.TOP ? z : y * 1.0 + (id === ID.APRON ? 30 : 0);
        const warp = NZ.fbm2(x * 0.012, gy * 0.09, 4) * 6.0;
        const g = NZ.fbm2(x * 0.01 + 3, gy * 0.55 + warp, 3);
        const ring = 0.5 + 0.5 * Math.sin((gy * 0.9 + warp + g * 3.0) * 2.0);
        const pores = NZ.n2(x * 1.4, gy * 14);
        const broad = NZ.fbm2(x * 0.03, gy * 0.05, 3);
        let k = 0.82 + 0.16 * ring * ring + 0.06 * pores + 0.25 * broad;
        const dk = id === ID.APRON ? 0.7 : id === ID.FRONT ? 0.42 : 1.0;
        m.alb[0] = 0.040 * k * dk; m.alb[1] = 0.027 * k * dk; m.alb[2] = 0.017 * k * dk;
        m.rough = 0.28; m.f0[0] = m.f0[1] = m.f0[2] = 0.05; m.spec = 0.8; m.gloss = id === ID.TOP ? 0.8 : 0.0; m.glossRough = 0.16;
        m.tang[0] = 1; m.tang[1] = 0; m.tang[2] = 0;
        break;
      }
      case ID.PLATE: {
        const px = x - S.plate.x, pz = z - S.plate.z; const r = sqrt(px * px + pz * pz) || 1;
        const tarn = Q.clamp(0.45 + 1.1 * NZ.fbm2(px * 0.16 + 7, pz * 0.16, 4) + 0.3 * NZ.n2(px * 0.9, pz * 0.9), 0, 1);
        const lathe = 0.5 + 0.5 * Math.sin(r * 23 + NZ.n2(r * 0.7, 3.3) * 4);
        const k = 1 - 0.45 * tarn - 0.06 * lathe;
        m.f0[0] = 0.66 * k; m.f0[1] = 0.66 * k; m.f0[2] = 0.56 * k;
        m.alb[0] = 0.03 + 0.05 * tarn; m.alb[1] = 0.032 + 0.05 * tarn; m.alb[2] = 0.026 + 0.04 * tarn;
        m.rough = 0.17 + 0.2 * tarn; m.glossRough = m.rough; m.gloss = 1; m.spec = 1;
        // tangent: around the plate
        m.tang[0] = -pz / r; m.tang[1] = 0; m.tang[2] = px / r;
        // bump: lathe rings and small dents
        const bump = 0.03 * Math.sin(r * 31 + 2 * NZ.n2(r, 1)) + 0.0;
        nrm[0] += (px / r) * bump + 0.035 * NZ.n2(px * 0.8 + 40, pz * 0.8);
        nrm[2] += (pz / r) * bump + 0.035 * NZ.n2(px * 0.8, pz * 0.8 + 40);
        break;
      }
      case ID.LEMON: {
        const pm = LTMP.peel, cut = LTMP.cut, u = LTMP.u, phi = LTMP.phi;
        m.tang[0] = LM.b[0] * Math.cos(phi + PI / 2) + LM.c[0] * Math.sin(phi + PI / 2);
        m.tang[1] = LM.b[1] * Math.cos(phi + PI / 2) + LM.c[1] * Math.sin(phi + PI / 2);
        m.tang[2] = LM.b[2] * Math.cos(phi + PI / 2) + LM.c[2] * Math.sin(phi + PI / 2);
        if (cut) {
          // cross-section of the cut end
          const C = S.lemon.C; const pxl = x - C[0], pyl = y - C[1], pzl = z - C[2];
          const v = pxl * LM.b[0] + pyl * LM.b[1] + pzl * LM.b[2];
          const w = pxl * LM.c[0] + pyl * LM.c[1] + pzl * LM.c[2];
          const rho = sqrt(v * v + w * w);
          const ang = Math.atan2(w, v);
          const rEdge = rho - LTMP.dOuter * 0; // approx
          const ring = -LTMP.dOuter; // depth below intact surface
          const nseg = 10;
          const sa = ((ang + PI) / (2 * PI)) * nseg + 0.25 * NL.n2(rho * 1.5, 7.7);
          const fseg = sa - Math.floor(sa);
          const memb = Math.exp(-Math.pow((Math.min(fseg, 1 - fseg)) / 0.05, 2));
          const ves = 0.5 + 0.5 * NL.n2(rho * 9, sa * 7.5) * 1.2;
          const core = 1 - Q.smooth(0.22, 0.42, rho);
          const pith = Q.smooth(RIND_T + 0.08, RIND_T + 0.23, -ring + RIND_T * 0) ; // unused
          const outer = Q.smooth(0.10, 0.30, ring - RIND_T * pm);
          // outer = 0 at the rim ring (pith), 1 in flesh
          const fl = outer * (1 - core);
          const pithW = 1 - fl;
          const fk = 0.70 + 0.35 * ves - 0.25 * memb;
          m.alb[0] = (0.72 * fk) * fl + 0.74 * pithW + 0.12 * memb * fl;
          m.alb[1] = (0.47 * fk) * fl + 0.67 * pithW + 0.12 * memb * fl;
          m.alb[2] = (0.04 * fk) * fl + 0.44 * pithW + 0.10 * memb * fl;
          m.wrap = 0.5; m.rough = 0.08 + 0.1 * pithW; m.spec = 1.0 * fl + 0.2 * pithW; m.f0[0] = m.f0[1] = m.f0[2] = 0.03;
          m.sss[0] = 0.30 * fl; m.sss[1] = 0.19 * fl; m.sss[2] = 0.015 * fl;
          // wet juice: bumpy normals from vesicles
          const bx = NL.n3(x * 13, y * 13, z * 13), by = NL.n3(x * 13 + 5, y * 13, z * 13), bz = NL.n3(x * 13, y * 13 + 9, z * 13);
          nrm[0] += 0.35 * bx * fl; nrm[1] += 0.35 * by * fl; nrm[2] += 0.35 * bz * fl;
          // seeds
          const sd1 = (v - 0.55) * (v - 0.55) / 0.04 + (w + 0.35) * (w + 0.35) / 0.012;
          const sd2 = (v + 0.25) * (v + 0.25) / 0.012 + (w - 0.62) * (w - 0.62) / 0.045;
          if (sd1 < 1 || sd2 < 1) { m.alb[0] = 0.62; m.alb[1] = 0.56; m.alb[2] = 0.33; m.sss[0] *= 0.3; m.sss[1] *= 0.3; m.sss[2] *= 0.3; m.spec = 0.6; m.rough = 0.15; }
          m.tang[0] = LM.b[0] * Math.cos(ang) + LM.c[0] * Math.sin(ang);
          m.tang[1] = LM.b[1] * Math.cos(ang) + LM.c[1] * Math.sin(ang);
          m.tang[2] = LM.b[2] * Math.cos(ang) + LM.c[2] * Math.sin(ang);
          m.kind = 100; // flesh
        } else {
          const depth = -LTMP.dOuter; // how far below the intact rind surface we are
          const isRind = depth < 0.07 ? 1 - Q.smooth(0.035, 0.07, depth) : 0;
          // rind colour with mottling, greener at the stalk end
          const mott = NL.fbm3(x * 1.6, y * 1.6, z * 1.6, 3);
          const green = Q.smooth(-1.5, -4.2, u);
          const ry = 0.80 + 0.12 * mott, gy = 0.52 + 0.08 * mott + 0.05 * green, by = 0.035 + 0.01 * green;
          const pith = 0.88 + 0.08 * NL.n3(x * 4, y * 4, z * 4);
          m.alb[0] = ry * isRind + 0.80 * pith * (1 - isRind);
          m.alb[1] = gy * isRind + 0.715 * pith * (1 - isRind);
          m.alb[2] = by * isRind + 0.44 * pith * (1 - isRind);
          m.wrap = 0.32 * isRind + 0.6 * (1 - isRind);
          m.rough = 0.30 * isRind + 0.45 * (1 - isRind);
          m.spec = 1.0 * isRind + 0.35 * (1 - isRind);
          m.f0[0] = m.f0[1] = m.f0[2] = 0.04;
          m.sss[0] = 0.10 * isRind + 0.16 * (1 - isRind); m.sss[1] = 0.055 * isRind + 0.12 * (1 - isRind); m.sss[2] = 0.004 * isRind + 0.05 * (1 - isRind);
          // pores
          const f = 15;
          const bx = NL.n3(x * f, y * f, z * f), by2 = NL.n3(x * f + 11, y * f, z * f), bz = NL.n3(x * f, y * f + 13, z * f);
          const amp = 0.17 * isRind + 0.05 * (1 - isRind);
          nrm[0] += amp * bx; nrm[1] += amp * by2; nrm[2] += amp * bz;
          m.kind = isRind > 0.5 ? ID.LEMON : 101; // 101 = pith
        }
        break;
      }
      case ID.BLADE: {
        const lx = KTMP.lx, fr = KTMP.frac;
        const rust = Q.clamp(0.5 + NZ.fbm2(lx * 0.6, KTMP.lz * 2.5 + 8, 4) * 1.1, 0, 1);
        const k = 0.9 - 0.45 * rust;
        m.f0[0] = 0.40 * k; m.f0[1] = 0.40 * k; m.f0[2] = 0.385 * k;
        m.alb[0] = 0.03 + 0.03 * rust; m.alb[1] = 0.028 + 0.025 * rust; m.alb[2] = 0.025 + 0.018 * rust;
        m.rough = 0.12 + 0.18 * rust; m.glossRough = m.rough; m.gloss = 1; m.spec = 1;
        // bevel at the cutting edge
        if (fr < 0.22) {
          const tilt = (1 - fr / 0.22) * 0.5;
          nrm[0] -= KN.z[0] * tilt; nrm[1] -= KN.z[1] * tilt; nrm[2] -= KN.z[2] * tilt;
        }
        m.tang[0] = KN.x[0]; m.tang[1] = KN.x[1]; m.tang[2] = KN.x[2];
        break;
      }
      case ID.BOLSTER: {
        m.f0[0] = 0.55; m.f0[1] = 0.53; m.f0[2] = 0.47; m.alb[0] = m.alb[1] = m.alb[2] = 0.04;
        m.rough = 0.2; m.glossRough = 0.2; m.gloss = 1; m.spec = 1;
        m.tang[0] = KN.y[0]; m.tang[1] = KN.y[1]; m.tang[2] = KN.y[2];
        break;
      }
      case ID.HANDLE: {
        const lx = KTMP.lx, ang = Math.atan2(KTMP.lz, KTMP.ly);
        const stri = NZ.n2(lx * 0.25, ang * 6.0) * 0.6 + NZ.n2(lx * 0.08, ang * 18) * 0.4;
        const ageing = Q.smooth(-4, -8.6, lx);
        const k = 0.9 + 0.12 * stri;
        m.alb[0] = 0.64 * k; m.alb[1] = (0.565 - 0.04 * ageing) * k; m.alb[2] = (0.41 - 0.07 * ageing) * k;
        m.wrap = 0.3; m.rough = 0.26; m.spec = 0.9; m.f0[0] = m.f0[1] = m.f0[2] = 0.04;
        m.sss[0] = 0.05; m.sss[1] = 0.04; m.sss[2] = 0.025;
        m.tang[0] = KN.x[0]; m.tang[1] = KN.x[1]; m.tang[2] = KN.x[2];
        break;
      }
    }
    const l = sqrt(nrm[0] * nrm[0] + nrm[1] * nrm[1] + nrm[2] * nrm[2]) || 1;
    nrm[0] /= l; nrm[1] /= l; nrm[2] /= l;
    return m;
  }

  // ------------------------------------------------------------------ tracing
  const MAXD = 4;
  let GLOSS_N = 8;
  const NRM = [0, 0, 0];
  const SH3 = [1, 1, 1];
  let SAMPLE_SEED = 0;
  const Gbuf = { id: 0, tx: 1, ty: 0, tz: 0, depth: 0, x: 0, y: 0, z: 0, nx: 0, ny: 0, nz: 1, glassFront: 0 };
  Q.GB = Gbuf;
  let recordG = false;

  // radiance accumulator layout: [A rgb, D rgb, Sa rgb, Sb rgb]
  function shadeOpaque(dx, dy, dz, tr, tg, tb, depth, acc, flags) {
    const id = H.id;
    const x = H.x, y = H.y, z = H.z;
    NRM[0] = H.nx; NRM[1] = H.ny; NRM[2] = H.nz;
    const gnx = H.nx, gny = H.ny, gnz = H.nz;
    const m = material(id, x, y, z, NRM, null);
    const nx = NRM[0], ny = NRM[1], nz = NRM[2];
    let dnx = gnx + (nx - gnx) * 0.3, dny = gny + (ny - gny) * 0.3, dnz = gnz + (nz - gnz) * 0.3;
    { const l = sqrt(dnx * dnx + dny * dny + dnz * dnz) || 1; dnx /= l; dny /= l; dnz /= l; }
    if (recordG) {
      Gbuf.id = id === ID.LEMON ? (m.kind === 100 ? 21 : m.kind === 101 ? 22 : ID.LEMON) : id;
      Gbuf.tx = m.tang[0]; Gbuf.ty = m.tang[1]; Gbuf.tz = m.tang[2];
      Gbuf.x = x; Gbuf.y = y; Gbuf.z = z; Gbuf.nx = gnx; Gbuf.ny = gny; Gbuf.nz = gnz;
      recordG = false;
    }
    const vx = -dx, vy = -dy, vz = -dz;
    // light
    let lx = LP[0] - x, ly = LP[1] - y, lz = LP[2] - z;
    const dist2 = lx * lx + ly * ly + lz * lz, dist = sqrt(dist2);
    lx /= dist; ly /= dist; lz /= dist;
    const E = S.L.I / dist2;
    // shadows
    let sh = 1;
    const gnl = gnx * lx + gny * ly + gnz * lz;
    SH3[0] = SH3[1] = SH3[2] = 1;
    if (gnl > -0.3) {
      const ox = x + gnx * 0.004, oy = y + gny * 0.004, oz = z + gnz * 0.004;
      sh = softShadow(ox, oy, oz, (id === ID.BLADE || id === ID.BOLSTER || id === ID.HANDLE) ? ID.BLADE : id);
      if (id === ID.APRON) sh *= apronShadow(x, y, z);
      if (sh > 0) {
        if (id === ID.TOP) causticAt(x, z, SH3);
        else if (id !== ID.WALL) glassShadowApprox(ox, oy, oz, SH3);
        if (Q.peelStaticShadow) sh *= Q.peelStaticShadow(ox, oy, oz);
      }
    } else sh = 0;
    if (id === ID.WALL) sh *= wallMask(x, y);
    sh *= spot(x, y, z);
    const nl = dnx * lx + dny * ly + dnz * lz;
    const wrap = m.wrap;
    let diff = (nl + wrap) / (1 + wrap); if (diff < 0) diff = 0;
    // geometric term limit so bumps don't light the far side
    const diffG = Q.clamp((gnl + wrap) / (1 + wrap) * 1.5, 0, 1);
    diff = min(diff, diffG + 0.05) * sh;
    const lc = S.L.col;
    // diffuse colour: wrap region more saturated (light scattered through coloured tissue)
    const wsat = wrap > 0 ? Q.clamp(1 - (nl * 1.6 + 0.1), 0, 1) : 0;
    for (let c = 0; c < 3; c++) {
      const a = m.alb[c];
      const as = a * (1 - wsat * 0.45) + a * a * wsat * 0.45 * 1.3;
      acc[3 + c] += tr_(c, tr, tg, tb) * as * diff * E * lc[c] * SH3[c];
    }
    // subsurface glow (flesh/pith/bone): light diffusing through, weakly view dependent
    if (m.sss[0] > 0) {
      const lit = Q.clamp(0.35 + 0.65 * Q.clamp(gnl + 0.6, 0, 1), 0, 1) * (0.35 + 0.65 * sh);
      for (let c = 0; c < 3; c++) acc[3 + c] += tr_(c, tr, tg, tb) * m.sss[c] * E * lc[c] * lit * 0.55;
    }
    // ambient + bounce from the lit table
    const amb = S.amb;
    const ao = ambientOcclusion(x + gnx * 0.01, y + gny * 0.01, z + gnz * 0.01, gnx, gny, gnz, id);
    const skyw = 0.55 + 0.45 * ny;
    const bounce = Q.clamp(-ny * 0.6 + 0.4, 0, 1) * (y > -0.5 && id !== ID.WALL && id !== ID.TOP ? 1 : 0);
    for (let c = 0; c < 3; c++) {
      acc[c] += tr_(c, tr, tg, tb) * m.alb[c] * amb[c] * skyw * ao;
      acc[3 + c] += tr_(c, tr, tg, tb) * m.alb[c] * bounce * ao * 0.030 * [1.0, 0.62, 0.34][c];
    }
    // the recessed apron gets a little light back from the room and floor
    if (id === ID.APRON) {
      const k = 0.05 * (0.45 + 0.55 * Q.smooth(22, -18, x)) * (0.7 + 0.3 * Q.smooth(-30, -6, y));
      for (let c = 0; c < 3; c++) acc[3 + c] += tr_(c, tr, tg, tb) * m.alb[c] * k * lc[c];
    }
    // speculars from the flame (two flame positions)
    if (m.spec > 0 && sh > 0.001) {
      const nv = max(nx * vx + ny * vy + nz * vz, 0.001);
      for (let k = 0; k < 2; k++) {
        const Lp = k === 0 ? LPA : LPB;
        const s = specTerm(nx, ny, nz, vx, vy, vz, Lp, x, y, z, m.rough) * m.spec * sh;
        if (s <= 0) continue;
        // fresnel on half vector approx
        let hx = lx + vx, hy = ly + vy, hz = lz + vz; const hl = sqrt(hx * hx + hy * hy + hz * hz) || 1;
        const vh = max(0, (vx * hx + vy * hy + vz * hz) / hl);
        for (let c = 0; c < 3; c++) {
          const F = fresnel(vh, m.f0[c]);
          acc[6 + k * 3 + c] += tr_(c, tr, tg, tb) * s * F * lc[c] * SH3[c];
        }
      }
    }
    // glossy reflections of the scene
    if (m.gloss > 0 && depth < 2 && !(flags & 1)) {
      const nv = max(nx * vx + ny * vy + nz * vz, 0.0);
      const rdx0 = dx + 2 * nv * nx, rdy0 = dy + 2 * nv * ny, rdz0 = dz + 2 * nv * nz;
      const n = depth === 0 ? (id === ID.TOP ? max(2, GLOSS_N >> 1) : GLOSS_N) : 1;
      const rough = m.glossRough;
      // orthonormal basis around reflection dir
      let ux, uy, uz;
      if (abs(rdy0) < 0.9) { ux = rdz0; uy = 0; uz = -rdx0; } else { ux = 0; uy = -rdz0; uz = rdy0; }
      let ul = sqrt(ux * ux + uy * uy + uz * uz); ux /= ul; uy /= ul; uz /= ul;
      const wx = rdy0 * uz - rdz0 * uy, wy = rdz0 * ux - rdx0 * uz, wz = rdx0 * uy - rdy0 * ux;
      const rot = Q.hash2i(SAMPLE_SEED, 77, 3);
      for (let i = 0; i < n; i++) {
        const r1 = (i + 0.5) / n, r2 = (i * 0.618034 + rot) % 1;
        const rad = rough * 0.75 * sqrt(-Math.log(1 - r1 * 0.98)) * 0.6;
        const a = r2 * 2 * PI;
        let rx = rdx0 + (ux * Math.cos(a) + wx * Math.sin(a)) * rad;
        let ry = rdy0 + (uy * Math.cos(a) + wy * Math.sin(a)) * rad;
        let rz = rdz0 + (uz * Math.cos(a) + wz * Math.sin(a)) * rad;
        const rl = sqrt(rx * rx + ry * ry + rz * rz); rx /= rl; ry /= rl; rz /= rl;
        if (rx * gnx + ry * gny + rz * gnz < 0.01) { // below horizon: mirror about geometric normal
          const k2 = 2 * (rx * gnx + ry * gny + rz * gnz); rx -= k2 * gnx; ry -= k2 * gny; rz -= k2 * gnz;
        }
        const ndr = max(nx * rx + ny * ry + nz * rz, 0);
        const fr = fresnel(max(nv, 0.05), 0) ; void fr; void ndr;
        const ft = [0, 0, 0];
        for (let c = 0; c < 3; c++) ft[c] = fresnel(nv, m.f0[c]) * m.gloss / n;
        traceInto(x + gnx * 0.006, y + gny * 0.006, z + gnz * 0.006, rx, ry, rz,
          tr_(0, tr, tg, tb) * ft[0], tr_(1, tr, tg, tb) * ft[1], tr_(2, tr, tg, tb) * ft[2], depth + 1, acc, 1, true);
      }
    }
  }
  function tr_(c, r, g, b) { return c === 0 ? r : c === 1 ? g : b; }

  function ambientOcclusion(px, py, pz, nx, ny, nz, id) {
    let occ = 0, sc = 1;
    for (let i = 1; i <= 5; i++) {
      const h = 0.06 + 0.32 * i;
      const x = px + nx * h, y = py + ny * h, z = pz + nz * h;
      let d = 1e9;
      if (id !== ID.TOP && id !== ID.WALL) d = y + 0.0; // table plane (rough)
      if (id === ID.WALL) d = 1e9;
      for (let k = 0; k < OBJS.length; k++) {
        const o = OBJS[k];
        const ddx = x - o.c[0], ddy = y - o.c[1], ddz = z - o.c[2];
        const bd = sqrt(ddx * ddx + ddy * ddy + ddz * ddz) - o.r;
        if (bd > h) continue;
        const v = o.sdf(x, y, z); if (v < d) d = v;
      }
      if (id === ID.TOP) d = min(d, glassApproxSdf(x, y, z));
      occ += (h - min(d, h)) * sc; sc *= 0.75;
    }
    return Q.clamp(1 - occ * 0.9, 0, 1);
  }
  function glassApproxSdf(x, y, z) {
    const rx = x - GL.x, rz = z - GL.z; const r = sqrt(rx * rx + rz * rz);
    if (y < GL.y0) return max(r - footR(max(y, 0)), -y);
    return r - GL.rs - 0.3;
  }

  // light emerging through wine: in-scattering + absorption bookkeeping
  const WINE_SIG = [0.003, 0.016, 0.10];
  const WINE_SCAT = [0.0025, 0.0019, 0.0008];
  const GLASS_T = [0.95, 0.962, 0.915];

  // full trace — adds radiance into acc
  function traceInto(ox, oy, oz, dx, dy, dz, tr, tg, tb, depth, acc, flags, allowGlass) {
    let inWine = insideWine(ox, oy, oz);
    for (let seg = 0; seg < 40; seg++) {
      if (tr + tg + tb < 0.002) return;
      const hitO = intersectOpaque(ox, oy, oz, dx, dy, dz, 1e5, false);
      const tO = hitO ? H.t : 1e5;
      const hitG = allowGlass !== false && intersectGlass(ox, oy, oz, dx, dy, dz, tO);
      // wine absorption + in-scattering along this segment
      const tSeg = hitG ? GH.t : tO;
      if (inWine) {
        const len = min(tSeg, 30);
        // in-scattering: sample 3 points, light attenuated by distance travelled in wine toward the light (approx)
        for (let s = 0; s < 3; s++) {
          const tt = len * (s + 0.5) / 3;
          const px = ox + dx * tt, py = oy + dy * tt, pz = oz + dz * tt;
          let lx = LP[0] - px, ly = LP[1] - py, lz = LP[2] - pz;
          const dl = sqrt(lx * lx + ly * ly + lz * lz); lx /= dl; ly /= dl; lz /= dl;
          const ex = wineExit(px, py, pz, lx, ly, lz);
          const E = S.L.I / (dl * dl);
          const ph = 0.6 + 0.8 * max(0, -(dx * lx + dy * ly + dz * lz)) ** 3; // forward scattering toward viewer
          for (let c = 0; c < 3; c++) {
            const att = exp(-WINE_SIG[c] * (tt + ex));
            const t3 = c === 0 ? tr : c === 1 ? tg : tb;
            acc[3 + c] += t3 * WINE_SCAT[c] * E * S.L.col[c] * att * ph * (len / 3) * 0.6;
          }
        }
        tr *= exp(-WINE_SIG[0] * len); tg *= exp(-WINE_SIG[1] * len); tb *= exp(-WINE_SIG[2] * len);
      }
      if (hitG && inWine && GH.part === 1) {
        // light focused by the wine 'lens' onto the far side of the bowl: the glowing crescent
        const px = ox + dx * GH.t, py = oy + dy * GH.t, pz = oz + dz * GH.t;
        let lx = px - LP[0], ly = py - LP[1], lz = pz - LP[2];
        const dl = sqrt(lx * lx + ly * ly + lz * lz); lx /= dl; ly /= dl; lz /= dl;
        const ndl = GH.nx * lx + GH.ny * ly + GH.nz * lz;
        const g = Math.pow(max(0, ndl), 2.5) * (0.4 + 0.6 * max(0, dx * lx + dy * ly + dz * lz));
        const E = (S.L.I / (dl * dl)) * spot(px, py, pz);
        acc[3] += tr * g * E * 0.030; acc[4] += tg * g * E * 0.022; acc[5] += tb * g * E * 0.008;
      }
      if (hitG) {
        if (recordG) { Gbuf.id = ID.GLASS; Gbuf.tx = 0; Gbuf.ty = 1; Gbuf.tz = 0; Gbuf.x = ox + dx * GH.t; Gbuf.y = oy + dy * GH.t; Gbuf.z = oz + dz * GH.t; Gbuf.nx = GH.nx; Gbuf.ny = GH.ny; Gbuf.nz = GH.nz; Gbuf.glassFront = GH.part; recordG = false; }
        const px = ox + dx * GH.t, py = oy + dy * GH.t, pz = oz + dz * GH.t;
        let nx = GH.nx, ny = GH.ny, nz = GH.nz;
        let cosi = -(dx * nx + dy * ny + dz * nz);
        if (cosi < 0) { nx = -nx; ny = -ny; nz = -nz; cosi = -cosi; }
        const part = GH.part;
        // media
        const aheadWine = insideWine(px + dx * 0.004, py + dy * 0.004, pz + dz * 0.004);
        let n1 = inWine ? 1.34 : 1.0, n2 = aheadWine ? 1.34 : 1.0;
        let F;
        if (part === 2) F = fresnelDiel(cosi, n1, n2);
        else F = min(1, fresnelDiel(cosi, 1.0, 1.52) * (n1 === n2 ? 2 : 1.4)); // thin glass shell (two faces)
        if (part === 5 || part === 4) F = fresnelDiel(cosi, 1.0, 1.52) * 1.3;
        // speculars of the flame on the glass/wine interface
        const vx = -dx, vy = -dy, vz = -dz;
        const lc = S.L.col;
        // the thickened lip of the bowl catches the flame as a thin bright line
        const lip = part === 1 ? Q.smooth(GL.yRim - 0.22, GL.yRim - 0.02, py) : 0;
        if (lip > 0) {
          let lx = LP[0] - px, ly = LP[1] - py, lz = LP[2] - pz; const dl = sqrt(lx * lx + ly * ly + lz * lz); lx /= dl; ly /= dl; lz /= dl;
          const fc = max(0, GH.nx * lx + GH.nz * lz + 0.15);
          const facing = fc * fc * (0.6 + 0.4 * NZ.n2(px * 3.1, pz * 3.1));
          const E = (S.L.I / (dl * dl)) * spot(px, py, pz) * lip * facing;
          for (let c = 0; c < 3; c++) acc[3 + c] += (c === 0 ? tr : c === 1 ? tg : tb) * E * 0.07 * S.L.col[c];
        }
        const rough = part === 2 ? 0.04 : part === 4 ? 0.06 : lip > 0.5 ? 0.12 : 0.025;
        let shf = spot(px, py, pz);
        if (part === 2) shf *= 0.85; // light reaching meniscus partially through glass
        for (let k = 0; k < 2; k++) {
          const s = specTerm(nx, ny, nz, vx, vy, vz, k === 0 ? LPA : LPB, px, py, pz, rough);
          if (s <= 0) continue;
          const Fs = part === 2 ? 0.06 : 0.09;
          for (let c = 0; c < 3; c++) acc[6 + k * 3 + c] += (c === 0 ? tr : c === 1 ? tg : tb) * s * Fs * lc[c] * shf;
        }
        // reflection branch
        const rdx = dx + 2 * cosi * nx, rdy = dy + 2 * cosi * ny, rdz = dz + 2 * cosi * nz;
        if (depth < MAXD && F * (tr + tg + tb) > 0.01) {
          traceInto(px + nx * 0.003, py + ny * 0.003, pz + nz * 0.003, rdx, rdy, rdz, tr * F, tg * F, tb * F, depth + 1, acc, flags | 1, depth < 2);
        }
        if (F >= 0.999) { // total internal reflection: continue as reflection
          ox = px + nx * 0.003; oy = py + ny * 0.003; oz = pz + nz * 0.003; dx = rdx; dy = rdy; dz = rdz;
          inWine = insideWine(ox, oy, oz);
          continue;
        }
        // transmission
        let ndx = dx, ndy = dy, ndz = dz;
        if (n1 !== n2) {
          const eta = n1 / n2;
          const k = 1 - eta * eta * (1 - cosi * cosi);
          if (k > 0) {
            const a = eta * cosi - sqrt(k);
            ndx = eta * dx + a * nx; ndy = eta * dy + a * ny; ndz = eta * dz + a * nz;
          }
        }
        let tint0 = 1, tint1 = 1, tint2 = 1;
        if (part !== 2) {
          const pathk = 1 / max(cosi, 0.08);
          const thick = part === 1 ? 1 : part === 3 ? 1.2 : part === 4 ? 4.0 : 3.0;
          tint0 = pow(GLASS_T[0], pathk * thick); tint1 = pow(GLASS_T[1], pathk * thick); tint2 = pow(GLASS_T[2], pathk * thick);
          if (part === 5) { // solid prunt: chord through the sphere darkens the rim
            tint0 *= 0.92; tint1 *= 0.97; tint2 *= 0.85;
          }
        }
        tr *= (1 - F) * tint0; tg *= (1 - F) * tint1; tb *= (1 - F) * tint2;
        const ll = sqrt(ndx * ndx + ndy * ndy + ndz * ndz);
        dx = ndx / ll; dy = ndy / ll; dz = ndz / ll;
        // prunts/foot are solid: bend the ray a little for the lensing look
        if (part === 5 || part === 4) {
          dx -= nx * 0.25; dy -= ny * 0.25; dz -= nz * 0.25;
          const l2 = sqrt(dx * dx + dy * dy + dz * dz); dx /= l2; dy /= l2; dz /= l2;
          ox = px + dx * (part === 5 ? 0.6 : 0.02); oy = py + dy * (part === 5 ? 0.6 : 0.02); oz = pz + dz * (part === 5 ? 0.6 : 0.02);
        } else { ox = px + dx * 0.004; oy = py + dy * 0.004; oz = pz + dz * 0.004; }
        inWine = insideWine(ox, oy, oz);
        continue;
      }
      if (hitO) {
        shadeOpaque(dx, dy, dz, tr, tg, tb, depth, acc, flags);
        return;
      }
      // escaped: the dim, candle-lit room behind the painter
      if (depth > 0) {
        const up = Q.clamp(0.5 + 0.5 * dy, 0, 1), front = Q.clamp(0.5 + 0.5 * dz, 0, 1);
        const e = 0.006 + 0.022 * front * (0.4 + 0.6 * up);
        acc[3] += tr * e * 1.0; acc[4] += tg * e * 0.78; acc[5] += tb * e * 0.55;
      }
      return;
    }
  }
  function wineExit(px, py, pz, lx, ly, lz) {
    // distance from p (inside wine) along l to leave the wine (ellipsoid or surface plane)
    const ia = 1 / GL.a, ib = 1 / GL.b;
    const ox = (px - GL.x) * ia, oy = (py - GL.yc) * ib, oz = (pz - GL.z) * ia;
    const ex = lx * ia, ey = ly * ib, ez = lz * ia;
    const a = ex * ex + ey * ey + ez * ez, b = ox * ex + oy * ey + oz * ez, c = ox * ox + oy * oy + oz * oz - 1;
    const disc = max(b * b - a * c, 0);
    let t = (-b + sqrt(disc)) / a;
    if (ly > 0) t = min(t, (GL.wl - py) / ly);
    return max(t, 0);
  }

  // ------------------------------------------------------------------ caustic photon map
  Q.buildCaustics = function (nPhot) {
    const x0 = GL.x - 8, x1 = GL.x + 30, z0 = GL.z - 28, z1 = GL.z + 8;
    const cs = 0.09;
    const nx = Math.ceil((x1 - x0) / cs), nz = Math.ceil((z1 - z0) / cs);
    const h0 = new Float32Array(nx * nz), h1 = [new Float32Array(nx * nz), new Float32Array(nx * nz), new Float32Array(nx * nz)];
    const rnd = Q.mulberry32(99);
    // aim at a box around the glass
    for (let i = 0; i < nPhot; i++) {
      // point on flame disk
      const a1 = rnd() * 2 * PI, r1 = sqrt(rnd()) * S.L.R;
      const sx = LP[0] + Math.cos(a1) * r1, sy = LP[1] + Math.sin(a1) * r1 * 0.9, sz = LP[2] + rnd() * 0.5;
      const tx = GL.x + (rnd() * 2 - 1) * (GL.a + 0.5), ty = rnd() * (GL.yRim + 0.4), tz = GL.z + (rnd() * 2 - 1) * (GL.a + 0.5);
      let dx = tx - sx, dy = ty - sy, dz = tz - sz; const l = sqrt(dx * dx + dy * dy + dz * dz); dx /= l; dy /= l; dz /= l;
      // straight landing
      if (dy >= 0) continue;
      const t0 = -sy / dy;
      const qx = sx + dx * t0, qz = sz + dz * t0;
      const ix0 = Math.floor((qx - x0) / cs), iz0 = Math.floor((qz - z0) / cs);
      if (ix0 >= 0 && iz0 >= 0 && ix0 < nx && iz0 < nz) h0[iz0 * nx + ix0] += 1;
      // through glass
      let ox = sx, oy = sy, oz = sz, w0 = 1, w1 = 1, w2 = 1;
      let inW = false, ok = true;
      for (let seg = 0; seg < 12; seg++) {
        const tPlane = dy < 0 ? -oy / dy : 1e5;
        if (!intersectGlass(ox, oy, oz, dx, dy, dz, tPlane)) break;
        const px = ox + dx * GH.t, py = oy + dy * GH.t, pz = oz + dz * GH.t;
        if (inW) { const len = GH.t; w0 *= exp(-WINE_SIG[0] * len); w1 *= exp(-WINE_SIG[1] * len); w2 *= exp(-WINE_SIG[2] * len); }
        let nx2 = GH.nx, ny2 = GH.ny, nz2 = GH.nz;
        let cosi = -(dx * nx2 + dy * ny2 + dz * nz2);
        if (cosi < 0) { nx2 = -nx2; ny2 = -ny2; nz2 = -nz2; cosi = -cosi; }
        const aheadW = insideWine(px + dx * 0.004, py + dy * 0.004, pz + dz * 0.004);
        const n1 = inW ? 1.34 : 1, n2 = aheadW ? 1.34 : 1;
        const F = GH.part === 2 ? fresnelDiel(cosi, n1, n2) : min(1, fresnelDiel(cosi, 1, 1.52) * (n1 === n2 ? 2 : 1.4));
        if (F >= 0.999) { dx += 2 * cosi * nx2; dy += 2 * cosi * ny2; dz += 2 * cosi * nz2; ox = px + nx2 * 0.003; oy = py + ny2 * 0.003; oz = pz + nz2 * 0.003; inW = insideWine(ox, oy, oz); continue; }
        let ndx = dx, ndy = dy, ndz = dz;
        if (n1 !== n2) { const eta = n1 / n2; const k = 1 - eta * eta * (1 - cosi * cosi); const a = eta * cosi - sqrt(k); ndx = eta * dx + a * nx2; ndy = eta * dy + a * ny2; ndz = eta * dz + a * nz2; }
        const part = GH.part;
        if (part !== 2) {
          const pathk = 1 / max(cosi, 0.08);
          const thick = part === 1 ? 1 : part === 3 ? 1.2 : part === 4 ? 4.0 : 3.0;
          w0 *= pow(GLASS_T[0], pathk * thick); w1 *= pow(GLASS_T[1], pathk * thick); w2 *= pow(GLASS_T[2], pathk * thick);
        }
        w0 *= 1 - F; w1 *= 1 - F; w2 *= 1 - F;
        const ll = sqrt(ndx * ndx + ndy * ndy + ndz * ndz); dx = ndx / ll; dy = ndy / ll; dz = ndz / ll;
        if (part === 5 || part === 4) { dx -= nx2 * 0.25; dy -= ny2 * 0.25; dz -= nz2 * 0.25; const l2 = sqrt(dx * dx + dy * dy + dz * dz); dx /= l2; dy /= l2; dz /= l2; }
        ox = px + dx * 0.004; oy = py + dy * 0.004; oz = pz + dz * 0.004;
        inW = insideWine(ox, oy, oz);
      }
      if (!ok || dy >= 0) continue;
      const t1 = -oy / dy;
      const qx1 = ox + dx * t1, qz1 = oz + dz * t1;
      const ix1 = Math.floor((qx1 - x0) / cs), iz1 = Math.floor((qz1 - z0) / cs);
      if (ix1 >= 0 && iz1 >= 0 && ix1 < nx && iz1 < nz) { const j = iz1 * nx + ix1; h1[0][j] += w0; h1[1][j] += w1; h1[2][j] += w2; }
    }
    // blur both maps and take the ratio
    const blur = (arr, r) => {
      const tmp = new Float32Array(arr.length);
      for (let pass = 0; pass < 2; pass++) {
        for (let z = 0; z < nz; z++) for (let x = 0; x < nx; x++) {
          let s = 0, n = 0;
          for (let k = -r; k <= r; k++) {
            const xx = pass === 0 ? x + k : x, zz = pass === 0 ? z : z + k;
            if (xx < 0 || zz < 0 || xx >= nx || zz >= nz) continue;
            s += arr[zz * nx + xx]; n++;
          }
          tmp[z * nx + x] = s / n;
        }
        arr.set(tmp);
      }
    };
    blur(h0, 3); for (let c = 0; c < 3; c++) blur(h1[c], 2);
    let mean = 0, cnt = 0; for (let i = 0; i < h0.length; i++) if (h0[i] > 0) { mean += h0[i]; cnt++; }
    mean /= max(cnt, 1);
    const map = [new Float32Array(nx * nz), new Float32Array(nx * nz), new Float32Array(nx * nz)];
    for (let i = 0; i < nx * nz; i++) {
      const ref = h0[i];
      const conf = Q.smooth(mean * 0.15, mean * 0.5, ref);
      for (let c = 0; c < 3; c++) {
        const r = ref > 0 ? h1[c][i] / ref : 1;
        map[c][i] = 1 + (min(r, 9) - 1) * conf;
      }
    }
    CAU.x0 = x0; CAU.z0 = z0; CAU.cs = cs; CAU.nx = nx; CAU.nz = nz; CAU.map = map; CAU.ok = true;
  };

  // ------------------------------------------------------------------ static render into layer buffers
  // Returns an object with: layers (Float32Array W*H*12), id (Uint8Array), depth (Float32Array), tang (Float32Array W*H*2)
  Q.createStatic = function (W, H, opts) {
    opts = opts || {};
    setupCamera(W, H);
    GLOSS_N = opts.gloss || 8;
    const out = {
      W, H,
      layers: new Float32Array(W * H * 12),
      id: new Uint8Array(W * H),
      depth: new Float32Array(W * H),
      tang: new Float32Array(W * H * 2),
      nrm: new Float32Array(W * H * 3),
      pos: new Float32Array(W * H * 3),
      row: 0, aaRow: 0, phase: 0,
    };
    return out;
  };
  const ACC = new Float64Array(12);
  const RD = [0, 0, 0];
  const PJ = [0, 0, 0], PJ2 = [0, 0, 0];
  function renderSample(px, py, acc, record) {
    camRay(px, py, RD);
    recordG = record;
    if (record) { Gbuf.id = 0; Gbuf.glassFront = 0; }
    traceInto(S.E[0], S.E[1], S.E[2], RD[0], RD[1], RD[2], 1, 1, 1, 0, acc, 0, true);
    recordG = false;
  }
  // primary pass over rows [y0, y1)
  Q.renderRows = function (st, y0, y1, xa, xb) {
    const W = st.W;
    xa = xa || 0; xb = xb || W;
    for (let y = y0; y < y1; y++) {
      for (let x = xa; x < xb; x++) {
        const i = y * W + x;
        ACC.fill(0);
        SAMPLE_SEED = i;
        renderSample(x, y, ACC, true);
        const L = st.layers, o = i * 12;
        for (let k = 0; k < 12; k++) L[o + k] = ACC[k];
        st.id[i] = Gbuf.id;
        // depth & tangent
        if (Gbuf.id) {
          const ddx = Gbuf.x - S.E[0], ddy = Gbuf.y - S.E[1], ddz = Gbuf.z - S.E[2];
          st.depth[i] = sqrt(ddx * ddx + ddy * ddy + ddz * ddz);
          Q.project(Gbuf.x, Gbuf.y, Gbuf.z, PJ);
          Q.project(Gbuf.x + Gbuf.tx * 0.2, Gbuf.y + Gbuf.ty * 0.2, Gbuf.z + Gbuf.tz * 0.2, PJ2);
          let tx = PJ2[0] - PJ[0], ty = PJ2[1] - PJ[1]; const tl = sqrt(tx * tx + ty * ty) || 1;
          st.tang[i * 2] = tx / tl; st.tang[i * 2 + 1] = ty / tl;
          st.nrm[i * 3] = Gbuf.nx; st.nrm[i * 3 + 1] = Gbuf.ny; st.nrm[i * 3 + 2] = Gbuf.nz;
          st.pos[i * 3] = Gbuf.x; st.pos[i * 3 + 1] = Gbuf.y; st.pos[i * 3 + 2] = Gbuf.z;
        } else { st.depth[i] = 1e4; st.tang[i * 2] = 1; st.tang[i * 2 + 1] = 0; }
      }
    }
  };
  // adaptive antialiasing pass: resample pixels at object boundaries / high contrast
  Q.aaRows = function (st, y0, y1) {
    const W = st.W, Hh = st.H, L = st.layers;
    const lum = (i) => { const o = i * 12; return L[o + 3] + L[o + 4] + L[o + 6] + L[o + 7] + 0.1 * (L[o] + L[o + 1]); };
    const offs = [[-0.3, -0.3], [0.3, -0.3], [-0.3, 0.3], [0.3, 0.3], [0, -0.42], [0.42, 0], [0, 0.42], [-0.42, 0]];
    const tmp = new Float64Array(12);
    for (let y = y0; y < y1; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        let need = false;
        const id0 = st.id[i], l0 = lum(i);
        for (let dy = -1; dy <= 1 && !need; dy++) for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= W || yy >= Hh) continue;
          const j = yy * W + xx;
          if (st.id[j] !== id0) { need = true; break; }
          const l1 = lum(j); if (abs(l1 - l0) > 0.12 * (l0 + l1) + 0.02) { need = true; break; }
        }
        if (!need) continue;
        const ns = id0 === ID.GLASS || id0 === ID.PLATE ? 8 : 4;
        tmp.fill(0);
        for (let s = 0; s < ns; s++) {
          ACC.fill(0); SAMPLE_SEED = i * 13 + s + 1;
          renderSample(x + offs[s][0], y + offs[s][1], ACC, false);
          for (let k = 0; k < 12; k++) tmp[k] += ACC[k];
        }
        const o = i * 12;
        for (let k = 0; k < 12; k++) L[o + k] = (L[o + k] + tmp[k]) / (ns + 1);
      }
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
