// Pixel-art light effects: lens-flare ghosts, rings, hexagons, starbursts, wisps.
// All effects are palette remaps (UP = one ramp step brighter) applied through Bayer densities.
'use strict';
function dens(x, y, d) { return bayer(x, y) < d; }

// filled disc brightened at `fill` density, with a rim `rimW` px wide at `rim` density
function flareDisc(cx, cy, r, fill, rim, rimW, map) {
  map = map || UP; rimW = rimW || 1;
  disc(cx, cy, r, (x, y, d) => {
    const onRim = d > r - rimW;
    if (!onRim && MASK[y * W + x]) return;
    if (dens(x, y, onRim ? rim : fill)) mapPx(x, y, map);
  });
}
// thin ring (no fill)
function flareRing(cx, cy, r, w, density, map) {
  map = map || UP;
  disc(cx, cy, r + w / 2, (x, y, d) => { if (d >= r - w / 2 && dens(x, y, density)) mapPx(x, y, map); });
}
// regular hexagon (aperture ghost)
function flareHex(cx, cy, r, rot, fill, edge, map) {
  map = map || UP;
  const pts = [];
  for (let k = 0; k < 6; k++) { const a = rot + k * Math.PI / 3; pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); }
  const inner = [];
  for (let k = 0; k < 6; k++) { const a = rot + k * Math.PI / 3; inner.push([cx + (r - 1.2) * Math.cos(a), cy + (r - 1.2) * Math.sin(a)]); }
  poly(pts, (x, y) => {
    const isEdge = !pointInPoly(x + 0.5, y + 0.5, inner);
    if (!isEdge && MASK[y * W + x]) return;
    if (dens(x, y, isEdge ? edge : fill)) mapPx(x, y, map);
  });
}
// starburst: rays of decreasing density
function starburst(cx, cy, rays, map) {
  map = map || UP;
  for (const ray of rays) {
    const { ang, len, d0 } = ray;
    const dx = Math.cos(ang), dy = Math.sin(ang);
    const steps = Math.ceil(len * 1.2);
    let lx = -9999, ly = -9999;
    for (let k = 0; k <= steps; k++) {
      const x = Math.floor(cx + dx * k / 1.2), y = Math.floor(cy + dy * k / 1.2);
      if (x === lx && y === ly) continue; lx = x; ly = y;
      const f = 1 - (k / 1.2) / len;
      if (dens(x, y, d0 * f + 0.02)) mapPx(x, y, map);
    }
  }
}
// sun disc: hot core + warm halo (warm ramp), drawn over sky
function sunDisc(cx, cy, rCore, rHalo) {
  disc(cx, cy, rHalo, (x, y, d) => {
    if (d <= rCore) px(x, y, WARM[6]);
    else if (d <= rCore + 1.6) px(x, y, dens(x, y, 0.75) ? WARM[6] : WARM[5]);
    else { const f = 1 - (d - rCore - 1.6) / (rHalo - rCore - 1.6); if (dens(x, y, f * 0.9)) px(x, y, f > 0.55 ? WARM[5] : UP[get(x, y)]); }
  });
}

// Pixel cumulus built from sphere-cap puffs: height field -> normal -> 4 hand-picked bands.
// cols: [deep shadow, shadow, body, highlight]; light from the upper right by default.
function makePuffCloud(seed, w, h, opts) {
  opts = opts || {};
  const rnd = mulberry32(seed);
  const puffs = [];
  const n = opts.n || 12, base = h - 2;
  for (let i = 0; i < n; i++) {
    // scatter puffs inside a dome: wide at the base, rising in the middle
    const fx = rnd();
    const mid = 1 - Math.abs(fx - 0.5) * 2;
    const r = (opts.rmin || 6) + ((opts.rmax || 16) - (opts.rmin || 6)) * Math.pow(mid, 0.7) * (0.6 + 0.4 * rnd());
    const cx = w * (0.1 + 0.8 * fx);
    const top = base - r * 0.5 - (h - 2 * r) * Math.pow(mid, 1.3) * (opts.tower || 0.8) * rnd();
    puffs.push([cx, Math.min(base - r * 0.35, top), r]);
  }
  for (let i = 0; i < (opts.top || 2); i++) {
    const p = puffs.reduce((a, b) => (b[1] - b[2] < a[1] - a[2] ? b : a));
    puffs.push([p[0] + (rnd() - 0.5) * p[2] * 1.4, p[1] - p[2] * 0.45, p[2] * (0.55 + 0.2 * rnd())]);
  }
  const L = norm3(opts.light || [0.55, -0.55, 0.62]);
  const cols = opts.cols || [SKY[6], SKY[7], SKY[8], SKY[9]];
  const data = new Uint8Array(w * h).fill(TRANSP);
  const hf = (x, y) => {
    let best = -1;
    for (const [cx, cy, r] of puffs) { const d2 = (x - cx) ** 2 + (y - cy) ** 2; if (d2 < r * r) best = Math.max(best, Math.sqrt(r * r - d2) + (r * 0.15)); }
    return y > base ? -1 : best;
  };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const hc = hf(x + 0.5, y + 0.5);
    if (hc < 0) continue;
    const gx = (hf(x + 1.5, y + 0.5) - hf(x - 0.5, y + 0.5)) / 2;
    const gy = (hf(x + 0.5, y + 1.5) - hf(x + 0.5, y - 0.5)) / 2;
    const nn = norm3([-clamp(gx, -3, 3), -clamp(gy, -3, 3), 1]);
    let l = nn[0] * L[0] + nn[1] * L[1] + nn[2] * L[2];
    l -= clamp((y - (base - 6)) / 6, 0, 1) * 0.45;   // flat, shaded base
    let k = l > (opts.t3 || 0.8) ? 3 : l > (opts.t2 || 0.5) ? 2 : l > (opts.t1 || 0.2) ? 1 : 0;
    data[y * w + x] = cols[k];
  }
  // clean single-pixel specks
  const tmp = { data, w, h };
  cleanSprite(data, w, h);
  return { w, h, data, ox: 0, oy: 0 };
}

// ======================= Pass 2: shared surreal language =======================

// Giant pale ringed planet. Body solid with pale latitude bands, lit limb, soft terminator;
// rings drawn in two halves (far half behind the body, near half in front) with gaps.
// fade(y) in 0..1 = how much haze lets it through (ordered dither toward the sky behind).
function drawPlanet(o) {
  const { cx, cy, r } = o;
  const rot = o.rot || -0.2, tilt = o.tilt || 0.22;
  const cr = Math.cos(rot), sr = Math.sin(rot);
  const L = norm3([o.light ? o.light[0] : 0.6, o.light ? o.light[1] : -0.4, 0.55]);
  const fade = o.fade || (() => 1);
  const clipY = o.clipY === undefined ? H : o.clipY;
  const bands = o.bands || [SKY[9], SUR[5], SKY[8], SUR[5], SKY[9], SUR[4], SKY[8], SUR[5], SKY[9]];
  const ringIn = 1.38, ringOut = 2.3;
  const ringCol = (q) => {
    if (q < 1.52) return [SUR[4], 0.4];
    if (q < 1.58) return null;
    if (q < 1.86) return [q < 1.7 ? SKY[9] : SUR[5], 0.85];
    if (q < 1.93) return null;                     // Cassini-like gap
    if (q < 2.12) return [SUR[5], 0.6];
    return [SUR[4], 0.35];
  };
  const put = (x, y, c, d) => {
    if (y >= clipY) return;
    const f = fade(y) * d;
    if (f >= 1 || dens(x, y, f)) px(x, y, c);
  };
  const ringPass = (front) => {
    const R2 = r * ringOut;
    for (let y = Math.floor(cy - R2); y <= cy + R2; y++) for (let x = Math.floor(cx - R2); x <= cx + R2; x++) {
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
      const u = dx * cr + dy * sr, v = -dx * sr + dy * cr;
      const q = Math.sqrt(u * u + (v / tilt) * (v / tilt)) / r;
      if (q < ringIn || q > ringOut) continue;
      const isFront = v > 0;
      if (isFront !== front) continue;
      if (!front && dx * dx + dy * dy < r * r) continue;   // hidden behind the body
      const rc = ringCol(q); if (!rc) continue;
      // planet's shadow falls across the far rings
      let c = rc[0];
      put(x, y, c, rc[1]);
    }
  };
  ringPass(false);
  for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) {
    const dx = x + 0.5 - cx, dy = y + 0.5 - cy, d2 = dx * dx + dy * dy;
    if (d2 > r * r) continue;
    const nz = Math.sqrt(1 - d2 / (r * r));
    const n = [dx / r, dy / r, nz];
    const lam = n[0] * L[0] + n[1] * L[1] + n[2] * L[2];
    const v = -dx * sr + dy * cr;                 // along the ring axis -> latitude
    const lat = v / r / Math.max(0.35, nz * 0.6 + 0.4);
    const bi = clamp(Math.floor((lat + 1) * bands.length / 2), 0, bands.length - 1);
    let c = bands[bi];
    if (lam < 0.12) c = DOWN[c];
    if (lam < -0.25) c = DOWN[c];
    if (lam < -0.55) c = DOWN[c];
    // ring shadow band on the body (just below the ring plane on the lit side)
    if (Math.abs(v - r * 0.18) < r * 0.045 && lam > 0) c = DOWN[c];
    // lit limb
    if (d2 > (r - 1.2) * (r - 1.2) && lam > 0.3) c = UP[c];
    put(x, y, c, lam < -0.4 ? 0.75 : 1);
  }
  ringPass(true);
}

// Daytime aurora veils: sinuous curtains whose rays brighten the sky toward a tint family.
function auroraVeil(t, o) {
  const map = o.map || TEALTINT;
  for (let x = o.x0; x < o.x1; x++) {
    const yb = o.base + o.amp * Math.sin(x * o.f1 + t * o.s1) + o.amp * 0.5 * Math.sin(x * o.f2 - t * o.s2 + 1.3);
    const ray = 0.55 + 0.45 * Math.sin(x * 0.21 + t * 0.9 + 2 * Math.sin(x * 0.037 + t * 0.2));
    const edge = clamp(Math.min(x - o.x0, o.x1 - x) / 30, 0, 1);
    const hgt = o.h * (0.7 + 0.3 * ray);
    for (let y = Math.max(0, Math.floor(yb - hgt)); y <= Math.min(H - 1, Math.floor(yb)); y++) {
      const f = (y - (yb - hgt)) / hgt;           // 0 top .. 1 bottom edge
      const dd = o.strength * ray * edge * Math.pow(f, 1.6);
      if (MASK[y * W + x]) continue;
      if (y === Math.floor(yb) && edge > 0.5 && ray > 0.55) { mapPx(x, y, UP); continue; }
      if (dens(x, y, dd)) { const i = y * W + x; FB[i] = map[FB[i]]; }
    }
  }
}

// Small floating rock island: grassy cap, cool stone body, dripping underside and roots.
function makeRock(seed, w) {
  const rnd = mulberry32(seed);
  const h = Math.round(w * 0.9) + 4;
  const data = new Uint8Array(w * h).fill(TRANSP);
  const top = 2;
  const prof = []; for (let x = 0; x < w; x++) { const c = (x + 0.5) / w * 2 - 1; prof.push((1 - Math.pow(Math.abs(c), 1.6)) * (h - 5) * (0.75 + 0.25 * rnd())); }
  for (let x = 0; x < w; x++) for (let y = top; y < top + 2 + prof[x]; y++) {
    const ly = y - top;
    let c;
    if (ly === 0) c = x < w * 0.45 ? MA[4] : MA[3];
    else if (ly === 1) c = MA[2];
    else c = ly < 4 ? (x < w * 0.4 ? ST[5] : ST[4]) : (ly < prof[x] * 0.6 ? ST[3] : ST[2]);
    if (ly > 2 && x === 0) c = ST[5];
    data[y * w + x] = c;
  }
  // a grass tuft and a dangling root
  const gx = Math.floor(w * (0.3 + 0.3 * rnd())); data[(top - 1) * w + gx] = MA[4]; data[(top - 1) * w + gx + 1] = MA[3];
  const rx = Math.floor(w * (0.25 + 0.5 * rnd())); for (let y = top + 2; y < h; y++) if (data[y * w + rx] === TRANSP && y < top + 4 + prof[rx] + 2) data[y * w + rx] = MA[1];
  return { w, h, data, ox: 0, oy: 0 };
}

// Slow drifting motes of light (world-independent screen space, deterministic).
function lightMotes(t, n, seed, region, cols) {
  for (let k = 0; k < n; k++) {
    const sx = region[0] + hash2(k, 1, seed) * (region[2] - region[0]);
    const sy = region[1] + hash2(k, 2, seed) * (region[3] - region[1]);
    const vx = (hash2(k, 3, seed) - 0.5) * 3, vy = -1.5 - hash2(k, 4, seed) * 2.5;
    let x = sx + vx * t + Math.sin(t * 0.7 + k) * 3, y = sy + vy * t;
    const span = region[3] - region[1]; y = region[1] + ((((y - region[1]) % span) + span) % span);
    x = Math.floor(x); y = Math.floor(y);
    if (MASK[y * W + x]) continue;
    const tw = Math.sin(t * (1.3 + hash2(k, 5, seed)) * 2 + k * 2.1);
    const c = cols[k % cols.length];
    if (tw > -0.2) px(x, y, c);
    if (tw > 0.75) { px(x + 1, y, UP[get(x + 1, y)]); px(x - 1, y, UP[get(x - 1, y)]); px(x, y - 1, UP[get(x, y - 1)]); px(x, y + 1, UP[get(x, y + 1)]); }
  }
}

// crisp hand-pixelled rims on a cloud sprite: sun-side outline + lit rim, rose underside line
function rimCloud(spr, sunDir, rimCol, shadeCol) {
  const { w, h, data } = spr, src = data.slice();
  const [sx, sy] = sunDir;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const c = src[y * w + x]; if (c === TRANSP) continue;
    const open = (i, j) => i < 0 || j < 0 || i >= w || j >= h || src[j * w + i] === TRANSP;
    if (open(x + sx, y + sy)) data[y * w + x] = rimCol;
    else if (shadeCol !== undefined && open(x, y + 1)) data[y * w + x] = shadeCol;
  }
  return spr;
}
