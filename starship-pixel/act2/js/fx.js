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
