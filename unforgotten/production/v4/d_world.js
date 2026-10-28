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
  // fire: layered tongues of stepped colour, flickering, with a hot core
  function fire(x, y, s, t, seed) {
    for (let k = 0; k < 9; k++) {
      const ph = t * (7 + k) + ih(k, seed, 1) * 9, h = s * (0.6 + ih(k, seed, 2) * 0.7) * (0.8 + Math.sin(ph) * 0.2), w = s * (0.18 + ih(k, seed, 3) * 0.16), ox = (ih(k, seed, 4) - 0.5) * s * 0.8;
      for (let yy = 0; yy < h; yy++) { const u = yy / h, hw = w * (1 - u) * (1 - u * 0.3), cx = x + ox + Math.sin(ph + u * 5) * s * 0.08 * u; for (let xx = fl(cx - hw); xx <= cx + hw; xx++) { const a = Math.abs(xx - cx) / Math.max(0.5, hw); put(xx, fl(y - yy), u < 0.25 && a < 0.5 ? C('snow', 7) : u < 0.5 && a < 0.7 ? C('fire', 6) : u < 0.75 ? C('fire', 4) : C('ember', 4)); } }
    }
    glow(x, y - s * 0.4, s * 5, tab('#ff9040', true), 0.55);
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
