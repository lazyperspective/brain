'use strict';
// ------------------------------------------------------------------
// Film world: camera, world-anchored island textures (no shimmer when
// the camera moves), the acting hero, props scaled with the camera.
// ------------------------------------------------------------------
const REF = { ox: 180, oy: 196, k: 1.4 };        // island layout at zoom 1
const CAM = { cx: 180, cy: 225, z: 1 };          // camera centre (ref low-res coords) + zoom
function applyCam() { ISO.k = REF.k * CAM.z; ISO.ox = Math.round(180 + (REF.ox - CAM.cx) * CAM.z); ISO.oy = Math.round(225 + (REF.oy - CAM.cy) * CAM.z); }
// ref low-res point -> screen low-res point, and -> hi-res point
function S(q, par = 1) { const zp = 1 + (CAM.z - 1) * par, cx = 180 + (CAM.cx - 180) * par, cy = 225 + (CAM.cy - 225) * par; return [180 + (q[0] - cx) * zp, 225 + (q[1] - cy) * zp]; }
const SH = (q, par = 1) => { const s = S(q, par); return [s[0] * SC, s[1] * SC]; };
// ref point of a world position (independent of camera)
const PREF = (x, y, z) => [REF.ox + (x - y) * REF.k, REF.oy + ((x + y) / 2 - z) * REF.k];

// keyframed value: keys [[t, value(s)...]] with smootherstep between keys
function keyed(keys, t) {
  if (t <= keys[0][0]) return keys[0].slice(1);
  for (let i = 0; i + 1 < keys.length; i++) { const a = keys[i], b = keys[i + 1]; if (t <= b[0]) { let u = (t - a[0]) / (b[0] - a[0]); u = u * u * u * (u * (u * 6 - 15) + 10); return a.slice(1).map((v, k) => v + (b[k + 1] - v) * u); } }
  return keys[keys.length - 1].slice(1);
}

// ---------------- island with world-anchored textures ----------------
function drawIslandW(B, cfg) {
  const T = cfg.T || 16, N = cfg.N || 6, cols = cfg.cols, k = ISO.k;
  const cells = []; for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) if (cfg.mask(i, j)) cells.push([i, j]);
  cells.sort((a, b) => (a[0] + a[1]) - (b[0] + b[1]) || a[0] - b[0]);
  const has = (i, j) => i >= 0 && j >= 0 && i < N && j < N && cfg.mask(i, j);
  const topW = (sx, sy, zt) => { const u = (sx + 0.5 - ISO.ox) / k, v = (sy + 0.5 - ISO.oy) / k + zt; return [v + u / 2, v - u / 2]; };
  const leftW = (sx, sy, y1) => { const x = (sx + 0.5 - ISO.ox) / k + y1; return [x, (x + y1) / 2 - (sy + 0.5 - ISO.oy) / k]; };
  const rightW = (sx, sy, x1) => { const y = x1 - (sx + 0.5 - ISO.ox) / k; return [y, (x1 + y) / 2 - (sy + 0.5 - ISO.oy) / k]; };
  const side = (a, z, base, seed) => {
    const zb = Math.floor((z + 400) / 5.5), off = (z + 400) % 5.5;
    if (off < 0.9 && hash(zb, Math.floor(a / 6), seed) < 0.75) return cols.strata;
    const st = hash(Math.floor(a / 2.2), Math.floor((z + 400) / 1.6), seed + 3); if (st > 0.94) return cols.stone; if (st < 0.04) return cols.strata;
    return base;
  };
  const top = (x, y) => { const h = hash(Math.floor(x * 1.1), Math.floor(y * 1.1), 1), h2 = hash(Math.floor(x * 0.6), Math.floor(y * 1.3), 2); if (cols.flower && h > 0.994) return cols.flower; if (h2 > 0.88) return cols.topL; if (h2 < 0.08) return cols.topD; return cols.top; };
  for (const [i, j] of cells) {
    const x0 = i * T, y0 = j * T, zt = 0, d = cfg.depth(i, j), z0 = zt - d, x1 = x0 + T, y1 = y0 + T;
    if (!has(i, j + 1)) B.poly([P(x0, y1, zt), P(x1, y1, zt), P(x1, y1, z0), P(x0, y1, z0)], (sx, sy) => { const [a, z] = leftW(sx, sy, y1); return side(a, z, cols.dirtL, 11); });
    if (!has(i + 1, j)) B.poly([P(x1, y0, zt), P(x1, y1, zt), P(x1, y1, z0), P(x1, y0, z0)], (sx, sy) => { const [a, z] = rightW(sx, sy, x1); return side(a, z, cols.dirtR, 23); });
    B.poly([P(x0, y0, zt), P(x1, y0, zt), P(x1, y1, zt), P(x0, y1, zt)], (sx, sy) => { const [x, y] = topW(sx, sy, zt); return top(x, y); });
    // grass lip + drips anchored to world positions along the edge
    const lip = (fx, fy, dirX, seed, col) => { for (let w = 0; w <= T; w += 0.5 / k) { const wx = fx + dirX * w, wy = fy + (1 - dirX) * w, p = P(wx, wy, zt); const xi = Math.round(p[0]), yi = Math.round(p[1]); B.put(xi, yi, col); B.put(xi, yi + 1, col); B.put(xi, yi + Math.round(k), col); const cell = Math.floor(w / 1.6); if (hash(seed, cell, 4) < 0.33) { const L = Math.round((1 + hash(seed, cell, 8) * 2.5) * k); for (let s = 0; s < L; s++) B.put(xi, yi + 2 + s, s === L - 1 ? cols.lipD : col); } } };
    if (!has(i, j + 1)) lip(x0, y1, 1, i * 31 + j, cols.lipL);
    if (!has(i + 1, j)) lip(x1, y0, 0, i * 17 + j * 5 + 3, cols.lipR);
    if (cols.root && (!has(i, j + 1) || !has(i + 1, j))) for (let q = 0; q < 2; q++) {
      const fx = !has(i, j + 1) ? lerp(x0, x1, 0.2 + 0.6 * hash(i, j, q + 11)) : x1, fy = !has(i, j + 1) ? y1 : lerp(y0, y1, 0.2 + 0.6 * hash(i, j, q + 3)), bp = P(fx, fy, z0);
      const L = Math.round((4 + hash(i, j, q + 21) * 12) * k); let x = bp[0];
      for (let s = 0; s < L; s++) { B.put(x, bp[1] + s, cols.root); if (hash(i * 7 + Math.floor(s / k), j, q) < 0.3 && s % Math.max(1, Math.round(k)) === 0) x += hash(i, j * 3 + s, q) < 0.5 ? -1 : 1; }
    }
  }
}

// ---------------- props (camera-scaled) ----------------
function treeW(B, x, y, z, c, s = 1.15) {
  box(B, x - 1.5, y - 1.5, z, 3, 3, 14 * s, c.trunkL, c.trunk, c.trunkD);
  const k = ISO.k, cp = P(x, y, z + 18 * s);
  for (const [dx, dy, r] of [[0, 0, 9], [-6, 3, 6], [6, 2, 6.5], [-2, -6, 6], [3, 5, 5]]) {
    const R = r * s * k / 1.4, X = cp[0] + dx * s * k / 1.4, Y = cp[1] + dy * s * k / 1.4;
    B.circle(X, Y, R, (px, py) => { const d = Math.hypot(px - (X - R * 0.4), py - (Y - R * 0.45)) / R; return d < 0.45 ? c.leafL : d < 1.05 ? c.leaf : c.leafD; });
  }
}
function lanternW(B, x, y, z, c, t, glowK = 1) {
  box(B, x, y, z, 2, 2, 20, c.postL, c.post, c.postD);
  box(B, x - 2, y - 2, z + 20, 6, 6, 6, c.lampL, c.lamp, c.lampD);
  box(B, x - 3, y - 3, z + 26, 8, 8, 2, c.postL, c.post, c.postD);
  const L = P(x + 1, y + 1, z + 23), fl = (0.9 + 0.1 * Math.sin(t * 13) * Math.sin(t * 7.3)) * glowK, R = 34 * ISO.k;
  B.glow(L[0] - R * 1.3, L[1] - R, L[0] + R * 1.3, L[1] + R * 1.4, c.glow, (px, py) => { const d = Math.hypot(px - L[0], (py - L[1]) * 1.2); return d < 3 ? 0 : 0.42 * fl * Math.pow(Math.max(0, 1 - d / R), 2); });
}
function mushW(B, pts, c) { const k = ISO.k / 1.4; for (const [x, y, z, s0] of pts) { const s = Math.max(1, Math.round(s0 * k)); const b = P(x, y, z); B.rect(Math.round(b[0]), Math.round(b[1]) - 3 * s, s, 3 * s, c.stem); B.ellipse(b[0] + s / 2, b[1] - 3 * s, 2.5 * s, 1.5 * s, c.cap); B.put(b[0] - s, b[1] - 3 * s - 1, c.spot); } }
function stonesW(B, pts, c) { for (const [x, y] of pts) { const p = P(x, y, 0); B.ellipse(p[0], p[1], 3.5 * ISO.k, 1.6 * ISO.k, c.stoneD); B.ellipse(p[0], p[1] - 1, 3 * ISO.k, 1.3 * ISO.k, c.stoneL); } }
function planksW(B, x, y, z, c, n = 3) { for (let q = 0; q < n; q++) box(B, x + (q % 2) * 2, y + q, z + q * 2, 18, 5, 2, c.woodL, c.wood, c.woodD); }

// ---------------- the acting hero ----------------
// st: {hop, squash, eyes:'closed'|'open', blink(0..1), look:[dx,dy] px, mouth:''|'o'|'smile'|'flat', arm(0..1), walk: phase or null, lean}
function heroW(B, hx, hy, hz, st, C = HERO, shadowCol) {
  const k = ISO.k, sq = st.squash || 0;
  const bz = Math.round(13 * (1 - sq)), bx = Math.round(16 * (1 + sq * 0.5)), by = Math.round(14 * (1 + sq * 0.5));
  const walkBob = st.walk != null ? Math.abs(Math.sin(st.walk * Math.PI)) * 1.2 : 0;
  const z0 = hz + 3 + (st.hop || 0) + walkBob, x0 = hx - bx / 2, y0 = hy - by / 2, x1 = x0 + bx, y1 = y0 + by, zt = z0 + bz + (st.breathe || 0), ch = 2;
  if (shadowCol) { const sp = P(hx, hy, hz); const r = (11 - Math.min(5, (st.hop || 0) * 0.3)) * k; B.ellipse(sp[0] + 1, sp[1] + 1, r, r * 0.45, shadowCol); }
  const legs = [[x0 + 1, y0 + 1, 0], [x0 + bx - 4, y0 + 1, 1], [x0 + 1, y0 + by - 4, 1], [x0 + bx - 4, y0 + by - 4, 0]];
  for (const [lx, ly, ph] of legs) { const lift = st.walk != null ? Math.max(0, Math.sin((st.walk + ph) * Math.PI)) * 2.2 : 0; box(B, lx, ly, hz + (st.hop || 0) + lift, 3, 3, 3 + walkBob - lift * 0.3, C.dark, C.shade, C.dark); }
  B.poly([P(x0, y1, zt), P(x1 - ch, y1, zt), P(x1 - ch, y1, z0), P(x0, y1, z0)], C.body);
  B.poly([P(x1, y0, zt), P(x1, y1 - ch, zt), P(x1, y1 - ch, z0), P(x1, y0, z0)], C.shade);
  B.poly([P(x1 - ch, y1, zt), P(x1, y1 - ch, zt), P(x1, y1 - ch, z0), P(x1 - ch, y1, z0)], mix(C.body, C.shade, 0.5));
  B.poly([P(x0 + 1, y0, zt), P(x1, y0, zt), P(x1, y1 - ch, zt), P(x1 - ch, y1, zt), P(x0, y1, zt), P(x0, y0 + 1, zt)], C.light);
  const a = P(x0 + 1, y1, zt), b = P(x1 - ch, y1, zt); B.line(a[0], a[1], b[0], b[1] - 1, C.hi);
  const c3 = P(x1, y1 - ch, z0), c4 = P(x1, y0, z0); B.line(c3[0] + 1, c3[1] - 1, c4[0] - 1, c4[1], C.dark);
  // arm nub (raises with st.arm)
  const az = z0 + Math.round(bz * 0.35) + Math.round((st.arm || 0) * 6);
  box(B, x0 + bx * 0.45, y1, az, 4, 3, 4, C.light, C.body, C.shade);
  // face on the +x face
  const ez = z0 + Math.round(bz * 0.58), lk = st.look || [0, 0];
  for (const e of [P(x1, y0 + 3.5, ez), P(x1, y0 + 9.5, ez)]) {
    const ex = Math.round(e[0] + lk[0]), ey = Math.round(e[1] - 1 + lk[1]);
    const closed = st.eyes === 'closed' || (st.blink || 0) > 0.5;
    if (closed) { B.rect(ex - 1, ey + 1, 4, 1, C.eye); B.put(ex - 2, ey, C.eye); B.put(ex + 3, ey, C.eye); }
    else if (st.eyes === 'wide') { B.rect(ex - 1, ey - 3, 4, 6, C.eye); B.rect(ex - 1, ey - 3, 2, 2, C.white); B.put(ex + 2, ey + 2, mix(C.eye, C.white, 0.35)); }
    else { B.rect(ex - 1, ey - 2, 3, 5, C.eye); B.rect(ex - 1, ey - 2, 1, 2, C.white); B.put(ex + 1, ey + 2, mix(C.eye, C.white, 0.35)); }
    if (st.shine && !closed) { B.put(ex + 1, ey + 1, hex('fff1c4')); B.put(ex, ey + 2, hex('ffd88a')); }
  }
  const bl = P(x1, y0 + 12.5, ez - 3), bl2 = P(x1, y0 + 1.5, ez - 3);
  B.rect(Math.round(bl[0]), Math.round(bl[1]), 3, 1, C.light); B.rect(Math.round(bl2[0]), Math.round(bl2[1]), 2, 1, C.light);
  const m = P(x1, y0 + 6.5, ez - 4.5), mx = Math.round(m[0] + lk[0] * 0.5), my = Math.round(m[1] + lk[1] * 0.5);
  if (st.mouth === 'o') B.rect(mx - 1, my, 3, 3, C.dark);
  else if (st.mouth === 'smile') { B.rect(mx - 1, my + 1, 3, 1, C.dark); B.put(mx - 2, my, C.dark); B.put(mx + 2, my, C.dark); }
  else if (st.mouth === 'flat') B.rect(mx - 1, my + 1, 3, 1, C.dark);
  return { head: P(hx, hy, zt), face: P(x1, y0 + 6.5, ez), hand: P(x1 + 3, y0 + 7, z0 + bz * 0.45), top: P(hx, hy, zt) };
}

// pixel glyph text in the low-res buffer (uses FONT from font.js)
function pixText(B, str, x, y, col, s = 1) { let cx = x; for (const ch of str) { const g = FONT[ch] || FONT[' ']; for (let j = 0; j < g.length; j++) for (let i = 0; i < g[j].length; i++) if (g[j][i] === '#') B.rect(cx + i * s, y + j * s, s, s, col); cx += (g[0].length + 1) * s; } return cx - x; }
