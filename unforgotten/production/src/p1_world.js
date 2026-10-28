  /* ================================================================ the 3D world: camera, sky, planes, boxes, fog, ink */
  // world: y is up, metres-ish. The camera is a pinhole; F is the focal length in pixels.
  const CAM = { x: 0, y: 2, z: -10, fx: 0, fy: 0, fz: 1, rx: 1, ry: 0, rz: 0, ux: 0, uy: 1, uz: 0, F: 300, cx: 240, cy: 135 };
  function lookAt(px, py, pz, tx, ty, tz, fov, roll) {
    let fx = tx - px, fy = ty - py, fz = tz - pz; const fl_ = Math.hypot(fx, fy, fz) || 1; fx /= fl_; fy /= fl_; fz /= fl_;
    let rx = fz, rz = -fx; const rl = Math.hypot(rx, rz) || 1; rx /= rl; rz /= rl; let ry = 0;
    let ux = fy * rz - fz * ry, uy = fz * rx - fx * rz, uz = fx * ry - fy * rx;
    if (roll) { const c = Math.cos(roll), s = Math.sin(roll); const nrx = rx * c + ux * s, nry = ry * c + uy * s, nrz = rz * c + uz * s; ux = ux * c - rx * s; uy = uy * c - ry * s; uz = uz * c - rz * s; rx = nrx; ry = nry; rz = nrz; }
    Object.assign(CAM, { x: px, y: py, z: pz, fx, fy, fz, rx, ry, rz, ux, uy, uz, F: (W / 2) / Math.tan((fov || 60) * PI / 360) });
  }
  // world → screen; returns null behind the camera. Z is the depth along the view axis.
  const PR = { x: 0, y: 0, z: 0 };
  function proj(x, y, z) {
    const dx = x - CAM.x, dy = y - CAM.y, dz = z - CAM.z, Z = dx * CAM.fx + dy * CAM.fy + dz * CAM.fz;
    if (Z < 0.05) return null;
    PR.x = CAM.cx + CAM.F * (dx * CAM.rx + dy * CAM.ry + dz * CAM.rz) / Z; PR.y = CAM.cy - CAM.F * (dx * CAM.ux + dy * CAM.uy + dz * CAM.uz) / Z; PR.z = Z;
    return PR;
  }
  // the ray through a pixel, scaled so that its forward component is 1 (so t along it is the depth)
  const RY = { x: 0, y: 0, z: 0 };
  function ray(sx, sy) {
    const a = (sx - CAM.cx) / CAM.F, b = -(sy - CAM.cy) / CAM.F;
    RY.x = CAM.fx + CAM.rx * a + CAM.ux * b; RY.y = CAM.fy + CAM.ry * a + CAM.uy * b; RY.z = CAM.fz + CAM.rz * a + CAM.uz * b; return RY;
  }

  // light & fog for the current set
  const ENV = { sun: [0.4, 0.8, -0.45], amb: 0.35, fog: null, fogNear: 30, fogFar: 160, fogMax: 0.85 };
  function setFog(hex, near, far, max) { ENV.fog = hex ? tab(hex) : null; ENV.fogNear = near; ENV.fogFar = far; ENV.fogMax = max === undefined ? 0.85 : max; }
  function setSun(x, y, z, amb) { const l = Math.hypot(x, y, z); ENV.sun = [x / l, y / l, z / l]; ENV.amb = amb; }
  const fogA = (z) => (ENV.fog ? ENV.fogMax * sstep(ENV.fogNear, ENV.fogFar, z) : 0);
  function fogC(c, z, x, y) { if (!ENV.fog) return c; const a = fogA(z); if (a <= 0) return c; const l = Math.min(7, fl(a * 8 + bay(x, y) - 0.5)); return l >= 0 ? ENV.fog[l * NPAL + c] : c; }
  // a shade value (0..7, fractional) on a ramp, dithered to a palette index
  const shadeC = (ramp, s, x, y) => ramp * 8 + clamp(fl(s + bay(x, y) - 0.5 + 0.5), 0, 7);
  const lightOf = (nx, ny, nz) => ENV.amb + (1 - ENV.amb) * Math.max(0, nx * ENV.sun[0] + ny * ENV.sun[1] + nz * ENV.sun[2]);

  let QID = 1;
  function beginWorld() { ZB.fill(1e9); IDB.fill(0); QID = 1; }
  // the sky: fn(dirx, diry, dirz, x, y) → colour, for every pixel nothing else will cover
  function sky(fn) {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const d = ray(x + 0.5, y + 0.5), l = Math.hypot(d.x, d.y, d.z); BUF[y * W + x] = fn(d.x / l, d.y / l, d.z / l, x, y); }
  }
  // a horizontal plane at height h; tex(wx, wz, depth, x, y) → colour (or -1 for a hole)
  function plane(h, tex, opt) {
    opt = opt || {}; const id = QID++, maxD = opt.maxD || 1e9;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const d = ray(x + 0.5, y + 0.5); if (Math.abs(d.y) < 1e-6) continue;
      const t = (h - CAM.y) / d.y; if (t <= 0.05 || t > maxD) continue;
      const i = y * W + x; if (t >= ZB[i]) continue;
      const c = tex(CAM.x + t * d.x, CAM.z + t * d.z, t, x, y); if (c < 0) continue;
      BUF[i] = opt.nofog ? c : fogC(c, t, x, y); ZB[i] = t; IDB[i] = opt.id || id;
    }
  }
  // a flat convex polygon in the world (3 or 4 corners, any order around the edge); shade(u, v, x, y, depth, n) → colour
  // u runs along the first edge and v along the last, both in world units
  const CLIP = [], SCR = [];
  function poly3(pts, shade, opt) {
    opt = opt || {};
    const p0 = pts[0], p1 = pts[1], pl = pts[pts.length - 1];
    let ex = p1[0] - p0[0], ey = p1[1] - p0[1], ez = p1[2] - p0[2], gx = pl[0] - p0[0], gy = pl[1] - p0[1], gz = pl[2] - p0[2];
    let nx = ey * gz - ez * gy, ny = ez * gx - ex * gz, nz = ex * gy - ey * gx; const nl = Math.hypot(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl;
    const facing = nx * (CAM.x - p0[0]) + ny * (CAM.y - p0[1]) + nz * (CAM.z - p0[2]);
    if (facing <= 0) { if (!opt.two) return; nx = -nx; ny = -ny; nz = -nz; }
    const el = Math.hypot(ex, ey, ez) || 1, gl = Math.hypot(gx, gy, gz) || 1; ex /= el; ey /= el; ez /= el; gx /= gl; gy /= gl; gz /= gl;
    // camera space, clipped against the near plane
    CLIP.length = 0;
    const cs = pts.map((p) => { const dx = p[0] - CAM.x, dy = p[1] - CAM.y, dz = p[2] - CAM.z; return [dx * CAM.rx + dy * CAM.ry + dz * CAM.rz, dx * CAM.ux + dy * CAM.uy + dz * CAM.uz, dx * CAM.fx + dy * CAM.fy + dz * CAM.fz]; });
    const NEAR = 0.08;
    for (let i = 0; i < cs.length; i++) {
      const a = cs[i], b = cs[(i + 1) % cs.length], ain = a[2] >= NEAR, bin = b[2] >= NEAR;
      if (ain) CLIP.push(a);
      if (ain !== bin) { const u = (NEAR - a[2]) / (b[2] - a[2]); CLIP.push([a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, NEAR]); }
    }
    if (CLIP.length < 3) return;
    SCR.length = 0; let minx = 1e9, maxx = -1e9, miny = 1e9, maxy = -1e9;
    for (const c of CLIP) { const sx = CAM.cx + CAM.F * c[0] / c[2], sy = CAM.cy - CAM.F * c[1] / c[2]; SCR.push(sx, sy); if (sx < minx) minx = sx; if (sx > maxx) maxx = sx; if (sy < miny) miny = sy; if (sy > maxy) maxy = sy; }
    const x0 = Math.max(0, fl(minx)), x1 = Math.min(W - 1, Math.ceil(maxx)), y0 = Math.max(0, fl(miny)), y1 = Math.min(H - 1, Math.ceil(maxy));
    if (x0 > x1 || y0 > y1) return;
    const n = SCR.length / 2; let area = 0;
    for (let i = 0; i < n; i++) { const j = (i + 1) % n; area += SCR[2 * i] * SCR[2 * j + 1] - SCR[2 * j] * SCR[2 * i + 1]; }
    const sg = area > 0 ? 1 : -1, id = opt.id || QID++;
    const pd = nx * p0[0] + ny * p0[1] + nz * p0[2], camd = nx * CAM.x + ny * CAM.y + nz * CAM.z;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const px = x + 0.5, py = y + 0.5; let ok = true;
      for (let i = 0; i < n; i++) { const j = (i + 1) % n, ax = SCR[2 * i], ay = SCR[2 * i + 1]; if (sg * ((SCR[2 * j] - ax) * (py - ay) - (SCR[2 * j + 1] - ay) * (px - ax)) < 0) { ok = false; break; } }
      if (!ok) continue;
      const d = ray(px, py), den = nx * d.x + ny * d.y + nz * d.z; if (Math.abs(den) < 1e-9) continue;
      const t = (pd - camd) / den; if (t <= 0.05) continue;
      const i = y * W + x; if (t >= ZB[i]) continue;
      const hx = CAM.x + t * d.x - p0[0], hy = CAM.y + t * d.y - p0[1], hz = CAM.z + t * d.z - p0[2];
      const c = shade(hx * ex + hy * ey + hz * ez, hx * gx + hy * gy + hz * gz, x, y, t, nx, ny, nz); if (c < 0) continue;
      BUF[i] = opt.nofog ? c : fogC(c, t, x, y); ZB[i] = t; IDB[i] = id;
    }
  }
  // an axis-aligned box; mat(face, u, v, x, y, depth, light) → colour; face is 'top', 'bottom', 'n', 's', 'e' or 'w'
  function box(x0, y0, z0, x1, y1, z1, mat, opt) {
    const F = [
      ['top', [[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]], [0, 1, 0]],
      ['s', [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0]], [0, 0, -1]],
      ['n', [[x1, y0, z1], [x0, y0, z1], [x0, y1, z1], [x1, y1, z1]], [0, 0, 1]],
      ['w', [[x0, y0, z1], [x0, y0, z0], [x0, y1, z0], [x0, y1, z1]], [-1, 0, 0]],
      ['e', [[x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0]], [1, 0, 0]],
      ['bottom', [[x0, y0, z1], [x1, y0, z1], [x1, y0, z0], [x0, y0, z0]], [0, -1, 0]],
    ];
    for (const [nm, pts, nn] of F) {
      if (nn[0] * (CAM.x - pts[0][0]) + nn[1] * (CAM.y - pts[0][1]) + nn[2] * (CAM.z - pts[0][2]) <= 0) continue;
      const L = lightOf(nn[0], nn[1], nn[2]);
      // our corner order winds the normal inward for poly3, so pass it reversed
      poly3([pts[0], pts[3], pts[2], pts[1]], (u, v, x, y, t) => mat(nm, v, u, x, y, t, L), opt);
    }
  }
  // a gabled roof over [x0..x1] × [z0..z1], ridge along x at height y0 + h
  function roof(x0, z0, x1, z1, y0, h, mat, over) {
    over = over || 0.3; const zm = (z0 + z1) / 2, xa = x0 - over, xb = x1 + over, za = z0 - over, zb = z1 + over, yr = y0 + h;
    const sides = [
      [[[xa, y0, za], [xb, y0, za], [xb, yr, zm], [xa, yr, zm]], 's'],
      [[[xb, y0, zb], [xa, y0, zb], [xa, yr, zm], [xb, yr, zm]], 'n'],
    ];
    for (const [pts, nm] of sides) {
      const e1 = [pts[1][0] - pts[0][0], pts[1][1] - pts[0][1], pts[1][2] - pts[0][2]], e2 = [pts[3][0] - pts[0][0], pts[3][1] - pts[0][1], pts[3][2] - pts[0][2]];
      let nx = e1[1] * e2[2] - e1[2] * e2[1], ny = e1[2] * e2[0] - e1[0] * e2[2], nz = e1[0] * e2[1] - e1[1] * e2[0]; const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
      const L = lightOf(nx, ny, nz);
      poly3(pts, (u, v, x, y, t) => mat('roof' + nm, u, v, x, y, t, L), { two: true });
    }
    for (const [pts, nm] of [[[[x0, y0, z0], [x0, y0, z1], [x0, yr, zm]], 'w'], [[[x1, y0, z1], [x1, y0, z0], [x1, yr, zm]], 'e']]) {
      const L = lightOf(nm === 'w' ? -1 : 1, 0, 0);
      poly3(pts, (u, v, x, y, t) => mat('gable', u, v, x, y, t, L), { two: true });
    }
  }
  // ink: darken the near side of every edge between surfaces (and between surfaces and the sky)
  const RD = (c, k) => (c & ~7) | Math.max(0, (c & 7) - k);
  function ink(strength, far) {
    far = far || 120; strength = strength === undefined ? 2 : strength;
    for (let y = 0; y < H - 1; y++) for (let x = 0; x < W - 1; x++) {
      const i = y * W + x, id = IDB[i]; if (id === 0 || id === 65535) continue;
      const a = IDB[i + 1], b = IDB[i + W], za = ZB[i];
      let edge = false;
      if (a !== id && a !== 65535 && za <= ZB[i + 1] * 1.002) edge = true;
      else if (b !== id && b !== 65535 && za <= ZB[i + W] * 1.002) edge = true;
      else if (x > 0 && IDB[i - 1] !== id && IDB[i - 1] !== 65535 && za < ZB[i - 1] * 0.98) edge = true;
      else if (y > 0 && IDB[i - W] !== id && IDB[i - W] !== 65535 && za < ZB[i - W] * 0.98) edge = true;
      if (edge) BUF[i] = RD(BUF[i], za > far ? 1 : strength);
    }
  }
  // 3D marks with depth testing
  function p3(x, y, z, c, size) { const p = proj(x, y, z); if (!p) return null; const s = Math.min(3, Math.max(1, Math.round((size || 0.1) * CAM.F / p.z))), sx = fl(p.x - s / 2), sy = fl(p.y - s / 2), zz = p.z; for (let j = 0; j < s; j++) for (let i = 0; i < s; i++) PZ(sx + i, sy + j, c, zz); return p; }
  function l3(ax, ay, az, bx, by, bz, c, w) {
    const a = proj(ax, ay, az); if (!a) return; const sa = [a.x, a.y, a.z]; const b = proj(bx, by, bz); if (!b) return;
    const sw = w || 1; lineF(sa[0], sa[1], b.x, b.y, (x, y, u) => { const z = lerp(sa[2], b.z, u); for (let k = 0; k < sw; k++) PZ(x + k, y, c, z); });
  }
  // a glow at a world point, scaled by distance and hidden behind nearer surfaces
  function glow3(x, y, z, r, T, a, test) { const p = proj(x, y, z); if (!p) return; if (test !== false) { const ix = fl(p.x), iy = fl(p.y); if (ix >= 0 && iy >= 0 && ix < W && iy < H && ZB[iy * W + ix] < p.z - 0.5) return; } glow(p.x, p.y, r * CAM.F / p.z, T, a); }
  // rain: streaks in a box around the camera, falling and blowing
  function rain3(t, n, len, wind, c, seed, box_) {
    const B = box_ || 18;
    for (let k = 0; k < n; k++) {
      const fx = ih(k, 1, seed), fz = ih(k, 2, seed), fall = frac(ih(k, 3, seed) + t * (1.4 + ih(k, 4, seed) * 0.5));
      const x = CAM.x + (fx - 0.5) * B * 2 + CAM.fx * B * 0.6, z = CAM.z + (fz - 0.5) * B * 2 + CAM.fz * B * 0.6, y = CAM.y + B * 0.6 - fall * B * 1.4;
      l3(x, y, z, x - wind * len, y + len, z, c);
    }
  }

