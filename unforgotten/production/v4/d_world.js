  /* ================================================================ the world: painted layers */
  // Scenes are composed in 2D, back to front, like a matte painting: sky, far ridges, the village, the set, figures,
  // then weather and light. Each helper draws at the frame's own pixels with stepped, hand-placed-looking shading.
  // camera: a layer at depth z (1 = the action plane) is offset by the camera position divided by z
  const CAM = { x: 0, y: 0 };
  const px_ = (x, z) => x - CAM.x / (z || 1), py_ = (y, z) => y - CAM.y / (z || 1);
  function vgrad(y0, y1, ramp, v0, v1, x0, x1) { x0 = x0 || 0; x1 = x1 || W; for (let y = Math.max(0, fl(y0)); y < Math.min(H, y1); y++) { const v = lerp(v0, v1, (y - y0) / Math.max(1, y1 - y0)); for (let x = Math.max(0, x0); x < Math.min(W, x1); x++) BUF[y * W + x] = cel(ramp, v, x, y); } }
  // pixel clouds: banks of rounded lumps with a lit top edge and a shadowed belly, 3-4 hard tones
  function cloudBank(y, h, z, ramp, base, seed, t, drift) {
    const ox = CAM.x / z + (t || 0) * (drift || 2);
    for (let x = 0; x < W; x++) {
      const wx = x + ox, top = y - (fbm(wx, seed, 38, 3, seed) - 0.3) * h * 1.6 - Math.max(0, Math.sin(wx / 23 + seed)) * h * 0.35;
      for (let yy = Math.max(0, fl(top)); yy < Math.min(H, y + h * 0.6); yy++) {
        const d = yy - top, n = vn(wx * 0.6, yy * 1.2, 7, seed + 5);
        BUF[yy * W + x] = cel(ramp, base + (d < 1.5 ? 1.6 : d < 4 ? 0.8 : 0) - (yy > y + h * 0.2 ? 0.7 : 0) + (n > 0.62 ? 0.5 : 0), x, yy);
      }
    }
  }
  // a ridge line, filled below: stepped noise, a lit crest
  function ridge(yb, amp, freq, z, ramp, base, seed, crest) {
    const ox = CAM.x / z;
    for (let x = 0; x < W; x++) {
      const wx = x + ox, top = yb - fbm(wx, 0, freq, 4, seed) * amp - Math.abs(Math.sin(wx / freq / 1.7 + seed)) * amp * 0.4;
      for (let y = Math.max(0, fl(top)); y < H; y++) BUF[y * W + x] = cel(ramp, base + (y - top < 1.5 && crest ? crest : 0) - (y - top > 30 ? 0.5 : 0), x, y);
    }
  }
  // a timber house front: plastered or planked walls, a tiled roof with deep eaves, lit paper windows
  // (x, yb: the middle of its base; w, h: wall size; rh: roof height; lit: 0..1 share of lit windows)
  function house(x, yb, w, h, rh, o) {
    o = o || {}; const wall = o.wall === undefined ? R.wood : o.wall, roofR = o.roof === undefined ? R.ink : o.roof, sh = o.shade || 0, seed = o.seed || 1, lit = o.lit === undefined ? 0.6 : o.lit;
    const x0 = Math.round(x - w / 2), x1 = Math.round(x + w / 2), yt = Math.round(yb - h);
    for (let yy = yt; yy < yb; yy++) for (let xx = x0; xx < x1; xx++) {
      if (xx < 0 || xx >= W || yy < 0 || yy >= H) continue;
      const u = xx - x0, v = yy - yt, plank = o.plaster ? 0 : (u % 4 === 0 ? -0.8 : 0), beam = (v === 1 || u === 0 || u === w - 1 || (w > 16 && Math.abs(u - fl(w / 2)) < 1)) ? -1 : 0;
      let c = cel(wall, 2.6 + sh + plank + beam + (u < 2 ? 0.6 : 0), xx, yy);
      // windows: a grid of paper panes, warm when lit
      const cw = Math.max(5, fl(w / 3)), wu = u % cw, wv = v - 3, cell = fl(u / cw) * 7 + seed * 13;
      if (h > 9 && wv >= 0 && wv < Math.min(6, h - 6) && wu >= 2 && wu < cw - 1) { const on = ih(cell, seed, 3) < lit; c = on ? (wu === 2 || wv === 0 ? C('fire', 4) : ((wu + wv) % 3 === 0 ? C('fire', 5) : C('fire', 6))) : C('ink', 2); if (on) LAMPS.push([xx, yy]); }
      BUF[yy * W + xx] = c;
    }
    // the roof: a trapezoid of tile rows with an upswept eave
    const ov = Math.max(2, fl(w * 0.14)), ry = yt - rh;
    for (let yy = ry; yy < yt + 1; yy++) {
      const v = (yy - ry) / Math.max(1, rh), half = lerp(w * 0.22, w / 2 + ov, v) + (v > 0.85 ? 1 : 0);
      for (let xx = Math.round(x - half); xx < Math.round(x + half); xx++) {
        if (xx < 0 || xx >= W || yy < 0 || yy >= H) continue;
        const row = (yy - ry) % 3 === 0, edge = xx === Math.round(x - half) || xx === Math.round(x + half) - 1;
        BUF[yy * W + xx] = edge || yy === yt ? C(roofR, 0) : cel(roofR, 2.2 + sh + (row ? -1 : 0) + (xx < x ? 0.5 : 0) + (v < 0.2 ? 0.8 : 0), xx, yy);
      }
    }
    if (o.chimney) rectF(x + w * 0.2, ry - 4, 3, 6, C('stone', 1 + sh));
  }
  const LAMPS = [];
  // a paper lantern: ribbed, glowing, swinging a little
  function lantern(x, y, r, t, seed, ramp) {
    ramp = ramp === undefined ? R.crimson : ramp; const sw = Math.sin(t * 1.3 + seed) * 1.2;
    x += sw; line(x - sw, y - r * 1.6 - 6, x, y - r * 1.2, C('ink', 1));
    fillEll(x, y, r * 0.9, r * 1.15, 0, (xx, yy, u, v) => cel(ramp, 5.2 - Math.abs(u) * 2.4 - (frac((u + 1) * 2.5) < 0.18 ? 1 : 0) + (Math.abs(v) > 0.82 ? -2 : 0), xx, yy));
    rectF(x - r * 0.5, y - r * 1.2, r, 2, C('ink', 1)); rectF(x - r * 0.5, y + r * 1.05, r, 2, C('ink', 1));
    glow(x, y, r * 4.5, tab('#ff8a3a', true), 0.4);
  }
  // fire: a banded flame field (white core, yellow, orange, red, a wisp of smoke) that licks upward with the noise,
  // sparks that climb and wink out, and the glow it throws around it
  function fire(x, y, s, t, seed, o) {
    o = o || {}; const w = s * 0.75, h = s * 2.0, sp = t * 2.4;
    for (let yy = 0; yy < h; yy++) for (let xx = -fl(w) - 1; xx <= w + 1; xx++) {
      const u = xx / w, tongue = (1 - Math.min(1, Math.abs(u)) ** 1.6) * h * (0.55 + 0.45 * vn(xx * 0.35 + seed * 9, sp * 1.6, 1, seed));
      const n = fbm(xx * 0.9 + seed * 17, yy * 0.55 + sp * s * 0.9, 3.2, 2, seed + 3);
      const heat = 1 - yy / Math.max(1, tongue) + (n - 0.5) * 0.9 - Math.abs(u) * 0.25;
      let c = -1;
      if (heat > 0.82) c = WHITE; else if (heat > 0.6) c = C('fire', 6); else if (heat > 0.42) c = C('fire', 4); else if (heat > 0.26) c = C('ember', 5); else if (heat > 0.13) c = C('ember', 3);
      else if (heat > 0.02 && yy > h * 0.35 && o.smoke !== false && ((xx + yy) & 1)) c = C('stone', 2);
      if (c >= 0) put(fl(x + xx + Math.sin(yy * 0.3 + sp * 3) * yy * 0.06), fl(y - yy), c);
    }
    for (let k = 0; k < (o.sparks === undefined ? 14 : o.sparks); k++) {
      const life = 0.9 + ih(k, 1, seed) * 0.9, u = frac(ih(k, 2, seed) + t / life), sx = x + (ih(k, 3, seed) - 0.5) * w * 1.4 + Math.sin(t * 3 + k) * u * s * 0.5, sy = y - h * 0.4 - u * s * 3.2;
      if (u < 0.85) put(fl(sx), fl(sy), u < 0.3 ? WHITE : u < 0.6 ? C('fire', 6) : C('ember', 4));
    }
    glow(x, y - s * 0.6, s * 4.5, tab('#ff9040', true), 0.5 + Math.sin(t * 13) * 0.04 + Math.sin(t * 7.3) * 0.04);
  }
  // rain splashes on a floor band: a crown of droplets, then a ring that spreads and fades (frozen: hold them)
  function splashes(t, y0, y1, n, seed, frozen) {
    const tt = frozen === undefined ? t : frozen;
    for (let k = 0; k < n; k++) {
      const per = 0.35 + ih(k, 1, seed) * 0.4, ph = frac(tt / per + ih(k, 2, seed)), cyc = fl(tt / per + ih(k, 2, seed));
      const x = fl(ih(k, cyc, seed + 1) * W), y = fl(lerp(y0, y1, ih(k, cyc, seed + 2))), sc = 0.5 + (y - y0) / Math.max(1, y1 - y0);
      if (ph < 0.25) { put(x, y - 1, C('sky', 6)); put(x - 1, y - 2, C('sky', 5)); put(x + 1, y - 2, C('sky', 5)); }
      else { const r = (ph - 0.15) * 6 * sc; for (let a = 0; a < TAU; a += 0.5 / Math.max(1, r)) { const px = fl(x + Math.cos(a) * r), py = fl(y + Math.sin(a) * r * 0.35); if (py >= 0 && py < H && px >= 0 && px < W && ph < 0.85) tintI(py * W + px, px, py, tab('#9fb8e8', true), 0.35 * (1 - ph)); } }
    }
  }
  // rain: slanted streaks in three depths; drops splash where they hit the floor (y > floorY)
  function rain(t, n, ang, floorY, frozen) {
    for (let k = 0; k < n; k++) {
      const z = 1 + (k % 3), sp = (420 + ih(k, 1, 51) * 160) / z, len = 12 / z + 3, tt = frozen === undefined ? t : frozen;
      const x0 = ih(k, 2, 51) * (W + 80) - 40, y = ((tt * sp + ih(k, 3, 51) * 400) % (H + 40)) - 20, x = x0 + y * ang;
      const c = z === 1 ? C('sky', 5) : z === 2 ? C('night', 5) : C('night', 4);
      for (let j = 0; j < len; j++) put(fl(x - j * ang), fl(y - j), c);
      if (frozen === undefined && floorY && y > floorY && z === 1 && ih(k, fl(t * 6), 52) < 0.3) { put(fl(x) - 1, fl(y) - 1, C('sky', 6)); put(fl(x) + 1, fl(y) - 1, C('sky', 6)); }
    }
  }
  // low drifting fog: a band of soft tint with holes
  function fog(y0, y1, T, a, t, seed) { for (let y = Math.max(0, fl(y0)); y < Math.min(H, y1); y++) for (let x = 0; x < W; x++) { const n = fbm(x + t * 6, y * 2.5, 40, 3, seed); const k = a * sstep(0.35, 0.7, n) * Math.sin((y - y0) / (y1 - y0) * PI); if (k > 0.02) tintI(y * W + x, x, y, T, k); } }
  // embers drifting up from a point
  function embers(x, y, n, spread, t, seed) { for (let k = 0; k < n; k++) { const u = frac(ih(k, 1, seed) + t * (0.25 + ih(k, 2, seed) * 0.3)); const ex = x + (ih(k, 3, seed) - 0.5) * spread + Math.sin(t * 2 + k) * 6 * u, ey = y - u * 90; put(fl(ex), fl(ey), u < 0.3 ? C('fire', 6) : u < 0.7 ? C('ember', 5) : C('ember', 3)); } }
  function letterbox(h) { rectF(0, 0, W, h, BLACK); rectF(0, H - h, W, h, BLACK); }
  // the lens: after a shot has painted its 1× stage, show part of it magnified Z times around (fx, fy), so the
  // characters and the world always share one pixel size (a close-up is the same picture, nearer)
  const ZT = new Uint8Array(NP);
  function view(fx, fy, Z) {
    if (Z <= 1.001 && Math.abs(fx - W / 2) < 0.5 && Math.abs(fy - H / 2) < 0.5) return;
    ZT.set(BUF);
    const x0 = clamp(fx - W / 2 / Z, 0, W - W / Z), y0 = clamp(fy - H / 2 / Z, 0, H - H / Z);
    for (let y = 0; y < H; y++) { const sy = Math.min(H - 1, fl(y0 + (y + 0.5) / Z)), o = sy * W; for (let x = 0; x < W; x++) BUF[y * W + x] = ZT[o + Math.min(W - 1, fl(x0 + (x + 0.5) / Z))]; }
  }
  // depth of field: blur what is behind the subject and put it back into the palette (a 32-level colour cube lookup),
  // so a close-up's background melts into soft bands and its lights into round bokeh. k: blur radius (frame px)
  let LUT = null;
  function lut() {
    if (LUT) return LUT; LUT = new Uint8Array(32768);
    for (let r = 0; r < 32; r++) for (let g = 0; g < 32; g++) for (let b = 0; b < 32; b++) LUT[(r << 10) | (g << 5) | b] = nearest(r * 8.2, g * 8.2, b * 8.2);
    return LUT;
  }
  const DR = new Float32Array(NP), DG = new Float32Array(NP), DB = new Float32Array(NP), DT = new Float32Array(NP);
  function boxPass(A, k, horiz) {
    for (let a = 0; a < (horiz ? H : W); a++) {
      let acc = 0; const n = horiz ? W : H, st = horiz ? 1 : W, o = horiz ? a * W : a;
      for (let i = -k; i <= k; i++) acc += A[o + clamp(i, 0, n - 1) * st];
      for (let i = 0; i < n; i++) { DT[o + i * st] = acc / (2 * k + 1); acc += A[o + clamp(i + k + 1, 0, n - 1) * st] - A[o + clamp(i - k, 0, n - 1) * st]; }
      for (let i = 0; i < n; i++) A[o + i * st] = DT[o + i * st];
    }
  }
  function defocus(k, boost) {
    const L = lut(); boost = boost || 1.25;
    for (let i = 0; i < NP; i++) { const p = PAL[BUF[i]], hot = LUM[BUF[i]] > 170 ? boost : 1; DR[i] = p[0] * hot; DG[i] = p[1] * hot; DB[i] = p[2] * hot; }
    for (const A of [DR, DG, DB]) for (let pass = 0; pass < 2; pass++) { boxPass(A, k, true); boxPass(A, k, false); }
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = y * W + x, d = (bay(x, y) - 0.5) * 6; BUF[i] = L[(clamp(fl((DR[i] + d) / 8.2), 0, 31) << 10) | (clamp(fl((DG[i] + d) / 8.2), 0, 31) << 5) | clamp(fl((DB[i] + d) / 8.2), 0, 31)]; }
  }
  // light shafts: rays from a point, brightening what they cross, broken up so they read as beams through rain
  function rays(cx, cy, n, len, T, a, t, seed) {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const dx = x - cx, dy = y - cy, d = Math.hypot(dx, dy); if (d > len || d < 4) continue;
      const ang = Math.atan2(dy, dx), beam = vn(ang * n + seed, t * 0.3, 1, seed);
      if (beam < 0.55) continue;
      tintI(y * W + x, x, y, T, a * (beam - 0.55) / 0.45 * (1 - d / len));
    }
  }
