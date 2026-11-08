// Starship sprite generator: an analytic orthographic ray-caster that rasterises the ship
// (stainless barrel, ogive nose, belly tiles, 2 forward + 2 aft flaps) straight into palette
// indices at native resolution, with banded (unsmoothed) shading supplied per shot.
// For tiny sizes it renders at k x and picks each output pixel by majority vote of palette
// indices (no blending: the result is still pure palette pixels).
'use strict';

const SHIP = {
  L: 11.0,          // length in radii (50 m / 4.5 m)
  Ln: 2.9,          // ogive nose length
  tileHalf: 1.55,   // tile coverage half-angle around the belly (rad, ~93 deg)
  // aft flaps: polygon in (u, rho) [u from engine end, rho from axis], azimuth from belly
  aftPoly: [[0.10, 0.9], [3.05, 0.9], [2.15, 1.95], [0.10, 1.95]],
  aftPhi: 2.0,
  // forward flaps on the nose cone, mounted further leeward
  fwdPoly: [[8.05, 0.75], [9.75, 0.35], [9.2, 1.35], [8.35, 1.62], [8.05, 1.62]],
  fwdPhi: 2.25,
  plate: 0.075,     // half thickness
};

function shipRadius(u) {
  const L = SHIP.L, Lb = L - SHIP.Ln;
  if (u < 0 || u > L) return -1;
  if (u <= Lb) return 1;
  const s = (u - Lb) / SHIP.Ln;
  return Math.pow(Math.max(0, 1 - Math.pow(s, 2.15)), 0.52);
}
function shipRadiusD(u) { const e = 1e-3; return (shipRadius(Math.min(SHIP.L, u + e)) - shipRadius(Math.max(0, u - e))) / (2 * e); }

function pointInPoly(x, y, pts) {
  let ins = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) ins = !ins;
  }
  return ins;
}

// orientation: theta = screen angle of nose (rad, CCW), elev = belly tilt toward camera,
// yaw = axis tilt toward camera (nose toward viewer if > 0)
function shipFrame(theta, elev, yaw) {
  let a = [1, 0, 0], b = [0, -Math.cos(elev), Math.sin(elev)];
  const rotY = (v) => [v[0] * Math.cos(yaw) + v[2] * Math.sin(yaw), v[1], -v[0] * Math.sin(yaw) + v[2] * Math.cos(yaw)];
  const rotZ = (v) => [v[0] * Math.cos(theta) - v[1] * Math.sin(theta), v[0] * Math.sin(theta) + v[1] * Math.cos(theta), v[2]];
  a = rotZ(rotY(a)); b = rotZ(rotY(b));
  const c = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  return { a, b, c };
}
const dot3 = (p, q) => p[0] * q[0] + p[1] * q[1] + p[2] * q[2];
function norm3(v) { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; }

// Cast one ray at camera-space (X, Y). Returns hit info or null.
function castShip(X, Y, F, flaps) {
  const { a, b, c } = F, L = SHIP.L;
  // local coords at z=0 and their z-derivatives
  const u0 = X * a[0] + Y * a[1] + L / 2, uz = a[2];
  const v0 = X * b[0] + Y * b[1], vz = b[2];
  const w0 = X * c[0] + Y * c[1], wz = c[2];
  let best = null, bestZ = -1e9;

  // ---- hull: bounded by the unit cylinder ----
  const A = vz * vz + wz * wz, B = 2 * (v0 * vz + w0 * wz), C = v0 * v0 + w0 * w0 - 1;
  let zlo, zhi;
  if (A < 1e-9) { if (C > 0) zlo = 1, zhi = 0; else { zlo = -50; zhi = 50; } }
  else {
    const D = B * B - 4 * A * C;
    if (D < 0) { zlo = 1; zhi = 0; }
    else { const sq = Math.sqrt(D); zlo = (-B - sq) / (2 * A); zhi = (-B + sq) / (2 * A); }
  }
  if (Math.abs(uz) > 1e-9) {
    let za = (0 - u0) / uz, zb = (L - u0) / uz; if (za > zb) { const t = za; za = zb; zb = t; }
    zlo = Math.max(zlo, za); zhi = Math.min(zhi, zb);
  } else if (u0 < 0 || u0 > L) { zlo = 1; zhi = 0; }
  if (zhi > zlo) {
    const inside = (z) => { const u = u0 + z * uz, v = v0 + z * vz, w = w0 + z * wz; const r = shipRadius(u); return r > 0 && v * v + w * w <= r * r; };
    const step = 0.012;
    let zIn = null;
    if (inside(zhi - 1e-6)) zIn = zhi - 1e-6;
    else {
      for (let z = zhi; z >= zlo; z -= step) { if (inside(z)) { let o = z + step, i = z; for (let k = 0; k < 10; k++) { const m = (o + i) / 2; if (inside(m)) i = m; else o = m; } zIn = i; break; } }
    }
    if (zIn !== null) {
      const u = u0 + zIn * uz, v = v0 + zIn * vz, w = w0 + zIn * wz;
      const rho = Math.hypot(v, w) || 1e-6, r = shipRadius(u);
      let n;
      const q = [(v * b[0] + w * c[0]) / rho, (v * b[1] + w * c[1]) / rho, (v * b[2] + w * c[2]) / rho];
      if (u < 0.02 && rho < r - 0.02) n = [-a[0], -a[1], -a[2]];
      else { const d = shipRadiusD(u); n = norm3([q[0] - d * a[0], q[1] - d * a[1], q[2] - d * a[2]]); }
      bestZ = zIn;
      best = { mat: 1, u, phi: Math.atan2(w, v), rho, n, z: zIn };
    }
  }

  // ---- flaps: thin plates ----
  for (const fl of flaps) {
    const cp = Math.cos(fl.phi), sp = Math.sin(fl.phi);
    const h0 = v0 * cp + w0 * sp, hz = vz * cp + wz * sp;
    const d0 = -v0 * sp + w0 * cp, dz = -vz * sp + wz * cp;
    const t = SHIP.plate;
    const test = (z) => {
      const u = u0 + z * uz, h = h0 + z * hz;
      if (h < shipRadius(u) - 0.05 && h < 0.98) return null;
      return pointInPoly(u, h, fl.poly) ? { u, h } : null;
    };
    let hit = null, hz0 = 0, face = 0;
    if (Math.abs(dz) > 1e-4) {
      const za = (t - d0) / dz, zb = (-t - d0) / dz;
      const zf = Math.max(za, zb), zbk = Math.min(za, zb);
      const N = 4;
      for (let k = 0; k <= N; k++) { const z = zf - (zf - zbk) * k / N; const r = test(z); if (r) { hit = r; hz0 = z; face = k === 0 ? 1 : 0; break; } }
    } else if (Math.abs(d0) <= t) {
      for (let z = 6; z >= -6; z -= 0.02) { const r = test(z); if (r) { hit = r; hz0 = z; break; } }
    }
    if (hit && hz0 > bestZ) {
      const m = [-sp * b[0] + cp * c[0], -sp * b[1] + cp * c[1], -sp * b[2] + cp * c[2]];
      const sgn = m[2] >= 0 ? 1 : -1;  // face toward camera
      // windward face = the one whose normal leans toward the belly (b)
      const nf = [m[0] * sgn, m[1] * sgn, m[2] * sgn];
      const windward = dot3(nf, b) > 0;
      bestZ = hz0;
      best = { mat: fl.mat, u: hit.u, fh: hit.h, n: face ? nf : nf, windward, edge: !face, z: hz0, phi: fl.phi };
    }
  }
  return best;
}

// Build a sprite. opts: {scale (px per radius), theta, elev, yaw, aftDefl:[l,r], fwdDefl:[l,r], shade(hit,i,j,ctx), ss (supersample), cleanup}
function renderShip(o) {
  const F = shipFrame(o.theta, o.elev, o.yaw || 0);
  const ss = o.ss || 1;
  const s = o.scale * ss;
  const ext = (SHIP.L / 2 + 2.2) * s;
  const half = Math.ceil(ext) + 2;
  const Wn = half * 2, Hn = half * 2;
  const aD = o.aftDefl || [0, 0], fD = o.fwdDefl || [0, 0];
  const flaps = [
    { mat: 2, phi: SHIP.aftPhi + aD[0], poly: SHIP.aftPoly },
    { mat: 2, phi: -SHIP.aftPhi - aD[1], poly: SHIP.aftPoly },
    { mat: 3, phi: SHIP.fwdPhi + fD[0], poly: SHIP.fwdPoly },
    { mat: 3, phi: -SHIP.fwdPhi - fD[1], poly: SHIP.fwdPoly },
  ];
  const ctx = { F, scale: s, ss };
  const big = new Uint8Array(Wn * Hn).fill(TRANSP);
  const bigM = new Uint8Array(Wn * Hn);
  for (let j = 0; j < Hn; j++) {
    for (let i = 0; i < Wn; i++) {
      const X = (i + 0.5 - half) / s, Y = -(j + 0.5 - half) / s;
      const hit = castShip(X, Y, F, flaps);
      if (hit) {
        big[j * Wn + i] = o.shade(hit, i, j, ctx);
        const tile = hit.tile;
        bigM[j * Wn + i] = hit.mat === 1 ? (tile ? 2 : 1) : (hit.mat === 2 ? 3 : 4) + (tile ? 0 : 2);
      }
    }
  }
  let w = Wn, h = Hn, data = big, mat = bigM, ox = half, oy = half;
  if (ss > 1) {
    w = Math.ceil(Wn / ss); h = Math.ceil(Hn / ss); ox = half / ss; oy = half / ss;
    data = new Uint8Array(w * h).fill(TRANSP);
    mat = new Uint8Array(w * h);
    const cnt = new Float32Array(256), firstM = new Uint8Array(256);
    const thr = o.coverage || 0.4;
    const weight = o.weight || (() => 1);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const used = [];
      let cov = 0;
      for (let y = 0; y < ss; y++) for (let x = 0; x < ss; x++) {
        const I = i * ss + x, J = j * ss + y;
        if (I >= Wn || J >= Hn) continue;
        const c = big[J * Wn + I];
        if (c === TRANSP) continue;
        cov++;
        if (cnt[c] === 0) { used.push(c); firstM[c] = bigM[J * Wn + I]; }
        cnt[c] += weight(c);
      }
      if (cov / (ss * ss) >= thr) {
        let bc = used[0], bv = -1;
        for (const c of used) if (cnt[c] > bv) { bv = cnt[c]; bc = c; }
        data[j * w + i] = bc; mat[j * w + i] = firstM[bc];
      }
      for (const c of used) cnt[c] = 0;
    }
  }
  if (o.cleanup !== false) cleanSprite(data, w, h, o.protect);
  if (o.edges) edgeLight(data, mat, w, h, o.edges);
  if (o.post) o.post(data, mat, w, h);
  // trim
  let x0 = w, x1 = -1, y0 = h, y1 = -1;
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (data[j * w + i] !== TRANSP) { x0 = Math.min(x0, i); x1 = Math.max(x1, i); y0 = Math.min(y0, j); y1 = Math.max(y1, j); }
  if (x1 < 0) return { w: 1, h: 1, data: new Uint8Array([TRANSP]), ox: 0, oy: 0, F, s: o.scale };
  const tw = x1 - x0 + 1, th = y1 - y0 + 1, td = new Uint8Array(tw * th), tm = new Uint8Array(tw * th);
  for (let j = 0; j < th; j++) for (let i = 0; i < tw; i++) { td[j * tw + i] = data[(j + y0) * w + i + x0]; tm[j * tw + i] = mat[(j + y0) * w + i + x0]; }
  return { w: tw, h: th, data: td, mat: tm, ox: ox - x0, oy: oy - y0, F, s: o.scale };
}

// project a ship-local point (u along axis from engine end, v toward belly, w) to sprite coords
function shipProject(spr, u, v, w) {
  const { a, b, c } = spr.F, L = SHIP.L;
  const X = (u - L / 2) * a[0] + v * b[0] + w * c[0];
  const Y = (u - L / 2) * a[1] + v * b[1] + w * c[1];
  return [spr.ox + X * spr.s, spr.oy - Y * spr.s];
}

// remove orphan pixels: a pixel whose 4 neighbours are all one other colour takes that colour
function cleanSprite(d, w, h, protect) {
  const src = d.slice();
  for (let j = 1; j < h - 1; j++) for (let i = 1; i < w - 1; i++) {
    const c = src[j * w + i];
    if (c === TRANSP || (protect && protect(c))) continue;
    const n1 = src[(j - 1) * w + i], n2 = src[(j + 1) * w + i], n3 = src[j * w + i - 1], n4 = src[j * w + i + 1];
    if (n1 === n2 && n2 === n3 && n3 === n4 && n1 !== c && n1 !== TRANSP) d[j * w + i] = n1;
  }
  // lone pixels hanging off the silhouette (only 1 opaque 4-neighbour) are removed
  const src2 = d.slice();
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const c = src2[j * w + i]; if (c === TRANSP) continue;
    let k = 0;
    if (j > 0 && src2[(j - 1) * w + i] !== TRANSP) k++;
    if (j < h - 1 && src2[(j + 1) * w + i] !== TRANSP) k++;
    if (i > 0 && src2[j * w + i - 1] !== TRANSP) k++;
    if (i < w - 1 && src2[j * w + i + 1] !== TRANSP) k++;
    if (k === 0) d[j * w + i] = TRANSP;
  }
}

// Pixel-art edge lighting. edges: [{dir:[dx,dy], mats:[...], cols:[outermost, next, ...], over:[mats treated as open]}]
// A pixel gets cols[k] when the neighbour k+1 steps toward the light is open (transparent or an 'over' material).
function edgeLight(d, m, w, h, edges) {
  const src = d.slice();
  for (const e of edges) {
    const [dx, dy] = e.dir;
    const open = (i, j) => i < 0 || j < 0 || i >= w || j >= h || src[j * w + i] === TRANSP || (e.over && e.over.includes(m[j * w + i]));
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const k0 = j * w + i;
      if (src[k0] === TRANSP || !e.mats.includes(m[k0])) continue;
      if (e.only && !e.only(src[k0])) continue;
      for (let k = 0; k < e.cols.length; k++) {
        if (open(i + dx * (k + 1), j + dy * (k + 1))) { if (e.cols[k] !== null) d[k0] = typeof e.cols[k] === 'function' ? e.cols[k](src[k0]) : e.cols[k]; break; }
      }
    }
  }
}

// simple cache
const SHIP_CACHE = new Map();
function cachedShip(key, fn) {
  if (SHIP_CACHE.has(key)) return SHIP_CACHE.get(key);
  const s = fn();
  if (SHIP_CACHE.size > 400) SHIP_CACHE.clear();
  SHIP_CACHE.set(key, s);
  return s;
}

// ---- generic material shader factory ----
// env: {up:[x,y,z] world-up in camera space, sun:[x,y,z] toward sun, steelBase, tileBase, rim, ...}
function makeShader(env) {
  const up = norm3(env.up), sun = norm3(env.sun);
  return function (hit, i, j, ctx) {
    const n = hit.n;
    const ndl = dot3(n, sun);
    const ndu = dot3(n, up);
    const s = ctx.scale;
    let tile;
    if (hit.mat === 1) tile = Math.abs(hit.phi) < SHIP.tileHalf;
    else tile = hit.windward;
    // reflection of view vector (0,0,1)
    const r = [2 * n[2] * n[0], 2 * n[2] * n[1], 2 * n[2] * n[2] - 1];
    const rh = dot3(r, up), rs = dot3(r, sun);
    // rim: grazing surfaces facing the sun
    const graze = 1 - Math.abs(n[2]);
    const rim = ndl > env.rimMin && graze > env.rimGraze ? (ndl - env.rimMin) * graze : 0;
    if (tile && hit.mat === 1 && env.tileJag) {
      // jagged tile line: tiles end in a sawtooth along the steel boundary
      const saw = Math.abs(((hit.u * env.tileJag) % 2) - 1) - 0.5;
      tile = Math.abs(hit.phi) < SHIP.tileHalf + saw * 0.09;
    }
    hit.tile = tile;
    if (tile) {
      let v = env.tileFn ? env.tileFn(n, hit) : env.tileBase + env.tileFill * Math.max(0, ndu) + env.tileSheen * Math.max(0, rh) * Math.max(0, n[2]) + env.tileSun * Math.max(0, ndl);
      // patchwork of slightly different tiles (in surface coordinates, ~tilePx pixels)
      if (env.tilePx && hit.mat === 1 && s >= 6) {
        const arc = hit.phi * s, ax = hit.u * s;
        const tp = env.tilePx;
        const row = Math.floor(arc / tp);
        const col = Math.floor((ax + (row & 1) * tp * 0.5) / (tp * 1.15));
        const hv = hash2(col, row, 77);
        if (hv < (env.tileLight || 0.03)) v += 1; else if (hv > 1 - (env.tileDarkP || 0.03)) v -= 1;
        if (env.tileSeam && v >= env.tileSeam) {
          const fa = arc / tp - row, fx = (ax + (row & 1) * tp * 0.5) / (tp * 1.15) - col;
          if (fa < 1 / tp || fx < 1 / (tp * 1.15)) v -= 1;
        }
      }
      if (rim > env.rimHot) return WARM[env.rimCol[2]];
      if (rim > env.rimWarm) return WARM[env.rimCol[1]];
      if (rim > env.rimLow) return WARM[env.rimCol[0]];
      return ST[clamp(Math.round(v), env.tileMin || 0, 4)];
    }
    // stainless: mostly what it reflects
    let v;
    if (rh > 0) v = env.skyHor - (env.skyHor - env.skyZen) * Math.pow(rh, 0.8);
    else v = env.gndHor + (env.gndHor - env.gndNad) * rh;
    v += env.steelSun * Math.max(0, ndl);
    // weld rings on the barrel
    if (env.ringPx && hit.mat === 1 && hit.u < SHIP.L - SHIP.Ln && s >= 8) {
      const ringU = 0.4; const fu = hit.u / ringU;
      if (fu - Math.floor(fu) < 1.0 / (ringU * s) && (Math.floor(fu) % (env.ringEvery || 1)) === 0) v -= env.ringDark || 0.75;
    }
    if (hit.mat !== 1) v -= env.flapDark || 0;
    if (env.streak && hit.mat === 1) { const ap = Math.abs(hit.phi); if (ap > env.streak[0] && ap < env.streak[1]) return env.streak[2]; }
    if (rs > env.specHot) return env.specCol;
    if (rim > env.rimHot) return WARM[env.rimCol[2] + 1] ?? WARM[6];
    if (rim > env.rimWarm) return WARM[env.rimCol[2]];
    if (env.chrome) return env.chrome[clamp(Math.round(v), 0, env.chrome.length - 1)];
    return ST[clamp(Math.round(v), 2, 8)];
  };
}

// ---- Mini ship (for the wide shot): a crafted thick-line rasteriser that keeps a constant
// 3-px body at every angle, a rounded ogive tip, aft flaps on both sides and the forward flap
// pair as single-pixel nubs. theta: nose direction on screen (deg, CCW). lit: +1 when the
// leeward (steel) side faces the light.
function miniShip(theta, Lp, opts) {
  opts = opts || {};
  const th = theta * Math.PI / 180;
  const ax = Math.cos(th), ay = -Math.sin(th);          // axis on screen (y down)
  const nx = -ay, ny = -ax;                             // leeward normal: axis rotated +90 (screen up when nose right)
  // fix: leeward = 'up' for a nose-right ship
  const lx = ay, ly = -ax;
  const half = Math.ceil(Lp / 2) + 4, w = half * 2, h = half * 2;
  const data = new Uint8Array(w * h).fill(TRANSP);
  const hw = opts.hw || 1.2, nose = opts.nose || 3.6;
  const C = opts.cols || { lit: ST[5], hi: ST[7], mid: ST[3], tile: ST[1], tile2: ST[2], flap: ST[2], flapHi: ST[4] };
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const px0 = i - half, py0 = j - half;
    const s = px0 * ax + py0 * ay + Lp / 2;          // along axis from engine end
    const t = px0 * lx + py0 * ly;                   // across: + leeward
    let hwS = hw;
    if (s > Lp - nose) { const q = (s - (Lp - nose)) / nose; hwS = hw * Math.sqrt(Math.max(0, 1 - q * q)) + 0.25; }
    let c = TRANSP;
    if (s >= 0 && s <= Lp && Math.abs(t) <= hwS) {
      if (t > 0.5) c = C.lit;
      else if (t > -0.5) c = C.mid;
      else c = C.tile;
      if (s > Lp - 1.4 && t > -0.5) c = C.hi;                     // glint on the nose tip
    } else if (s >= 0.0 && s <= 2.6 && Math.abs(t) > hw && Math.abs(t) <= hw + 1.1) {
      c = t > 0 ? C.flapHi : C.flap;                              // aft flaps
    } else if (s >= Lp - nose - 1.8 && s <= Lp - nose + 0.3 && t > hw && t <= hw + 1.1) {
      c = C.flapHi;                                               // forward flap (leeward)
    }
    data[j * w + i] = c;
  }
  cleanSprite(data, w, h);
  return { w, h, data, ox: half, oy: half, ax, ay, Lp, lx, ly };
}
