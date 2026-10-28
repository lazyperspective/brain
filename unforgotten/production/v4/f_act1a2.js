  /* ================================================================ ACT ONE (a), part two — the window, the rooftop chase */
  // ---------------------------------------------------------------- the rooftops of Halcyon Spire, side on
  // The chase runs left to right along one line of roofs; world x in frame pixels, the camera scrolls (camX, camY).
  // ROOF: [x0, x1, top, seed], gaps between them that she jumps.
  const ROOF = [];
  const LEAP_X = 262 + (142.6 - 117.4) * 150, LEAP_W = 150;
  (function () { let x = 180, k = 0; while (x < 9000) { let w = 150 + ih(k, 1, 401) * 230, gap = 30 + ih(k, 3, 401) * 34; const y = k === 0 ? 214 : 200 + fl((ih(k, 2, 401) - 0.5) * 30); if (x < LEAP_X && x + w + gap > LEAP_X - 60) { w = LEAP_X - x; gap = LEAP_W; } ROOF.push([x, x + w, y, k]); x += w + gap; k++; } })();
  const K_V = 150, K_X0 = 262, K_T0 = 117.4;                // her running speed (px/s), where and when the run starts
  function roofAt(x) { for (const r of ROOF) if (x >= r[0] && x < r[1]) return r; return null; }
  // where Kaira is at time t: running along the roofs, an arc over every gap
  function kairaAt(t) {
    const x = K_X0 + Math.max(0, t - K_T0) * K_V, r = roofAt(x);
    if (r) return { x, y: r[2], air: false, r };
    let a = null, b = null; for (const q of ROOF) { if (q[1] <= x && (!a || q[1] > a[1])) a = q; if (q[0] > x && (!b || q[0] < b[0])) b = q; }
    if (!a || !b) return { x, y: 200, air: false };
    const u = (x - a[1]) / (b[0] - a[1]); return { x, y: lerp(a[2], b[2], u) - Math.sin(u * PI) * (16 + (b[0] - a[1]) * 0.25), air: true, u };
  }
  const RF_WALL = [R.linen, R.rose, R.linen, R.gold, R.stone, R.tan];
  // one building: plaster facade with arched shuttered windows and flower boxes, a gold cornice, a strip of roof tile
  // seen over the parapet, and its dressing (chimneys, a water tank, herbs, laundry); sx: screen x of x0, sy: of the top
  function building(r, sx, sy, t) {
    const [x0, x1, , seed] = r, w = x1 - x0, ramp = RF_WALL[seed % 6], tile = ih(seed, 4, 402) < 0.5 ? R.crimson : R.teal;
    // the roof surface beyond the parapet: rows of tile receding
    for (let y = fl(sy - 7); y < sy; y++) for (let x = Math.max(0, fl(sx)); x < Math.min(W, sx + w); x++) { if (y < 0 || y >= H) continue; const v = sy - y; BUF[y * W + x] = cel(tile, 2.4 + v * 0.18 + (v % 3 === 0 ? -0.9 : 0) + (((x - sx) + (v % 6 < 3 ? 3 : 0)) % 6 === 0 ? -0.6 : 0), x, y); }
    // dressing on the roof, behind the runner's line
    const dress = (k) => ih(seed, k, 403);
    if (dress(1) < 0.7) { const cx = sx + w * (0.15 + dress(2) * 0.2); rectF(cx, sy - 26, 9, 22, C('ember', 3)); rectF(cx - 1, sy - 28, 11, 3, C('ember', 4)); for (let y = 0; y < 22; y += 3) rectF(cx, sy - 26 + y, 9, 1, C('ember', 2)); rectF(cx + 6, sy - 26, 3, 22, C('ember', 2)); for (let k = 0; k < 5; k++) { const u = frac(t * 0.3 + k / 5), px = cx + 4 + u * 14 + Math.sin(u * 6 + k) * 3, py = sy - 30 - u * 40; if (py > 0) fillEll(px, py, 2 + u * 5, 2 + u * 4, 0, (x, y, uu, vv) => (bay(x, y) < 0.7 - u * 0.6 ? cel(R.linen, 6 - u * 2 + (uu + vv < 0 ? 1 : 0), x, y) : -1)); } }
    if (dress(3) < 0.45) { const cx = sx + w * (0.55 + dress(4) * 0.25); rectF(cx - 1, sy - 30, 2, 26, C('wood', 2)); rectF(cx + 14, sy - 30, 2, 26, C('wood', 2)); fillEll(cx + 8, sy - 34, 11, 6, 0, (x, y, u, v) => cel(R.wood, 3 + (u < -0.2 ? 1 : 0) - (frac((x - cx) / 4) < 0.25 ? 0.8 : 0), x, y)); rectF(cx - 3, sy - 41, 22, 3, C('wood', 1)); }
    if (dress(5) < 0.6) { const lx = sx + w * 0.3, lx2 = sx + w * 0.8; for (let x = fl(lx); x < lx2; x++) { const u = (x - lx) / (lx2 - lx), y = sy - 22 + Math.sin(u * PI) * 5; put(x, fl(y), C('linen', 6)); } for (let k = 0; k < 5; k++) { const u = (k + 0.7) / 5.4, x = lerp(lx, lx2, u), y = sy - 22 + Math.sin(u * PI) * 5, col = [R.crimson, R.teal, R.gold, R.linen, R.indigo][(k + seed) % 5], sw = Math.sin(t * 3 + k) * 2; fillPoly([[x - 4, y], [x + 4, y], [x + 4 + sw, y + 9], [x - 4 + sw, y + 10]], (xx, yy) => cel(col, 4.4 - (xx > x + 1 ? 1 : 0) + ((yy - y) % 4 === 0 ? -0.6 : 0), xx, yy)); } rectF(lx - 1, sy - 24, 2, 20, C('wood', 2)); rectF(lx2 - 1, sy - 24, 2, 20, C('wood', 2)); }
    for (let k = 0; k < 4; k++) { if (dress(10 + k) > 0.5) continue; const px = sx + w * (0.1 + 0.8 * dress(20 + k)); rectF(px - 3, sy - 6, 7, 5, C('ember', 3)); rectF(px - 3, sy - 6, 7, 1, C('ember', 5)); for (let j = 0; j < 7; j++) put(fl(px - 3 + j + Math.sin(t * 2 + j) * 0.6), fl(sy - 7 - (j % 3) - 2), C('moss', 3 + (j % 2) * 2)); if (dress(30 + k) < 0.5) put(fl(px), fl(sy - 11), C('rose', 6)); }
    // the facade
    const y0 = Math.max(0, fl(sy)), cw = 24, rh = 30;
    for (let y = y0; y < H; y++) for (let x = Math.max(0, fl(sx)); x < Math.min(W, sx + w); x++) {
      const u = x - sx, v = y - sy, uu = (u - 6) % cw, vv = (v - 12) % rh, col = fl((u - 6) / cw), row = fl((v - 12) / rh);
      let c;
      if (v < 2) c = C('gold', v === 0 ? 6 : 4);
      else if (v < 5) c = cel(R.gold, 2.6 - (u % 3 === 0 ? 0.8 : 0), x, y);
      else if (v > 12 && uu >= 4 && uu < 16 && vv >= 0 && vv < 20 && u > 6 && u < w - 10) {
        // an arched window: a dark pane (sometimes lamp-lit), shutters, a sill with a flower box
        const ax = uu - 10, top = 5 - Math.sqrt(Math.max(0, 36 - ax * ax)) * 0.8 + 0.5;
        if (vv < top) c = cel(ramp, 4.2, x, y);
        else if (uu === 4 || uu === 15) c = C('ink', 1);
        else if (uu < 7 || uu > 12) c = cel(ih(col, seed, 404) < 0.5 ? R.teal : R.crimson, 3.4 - (vv % 3 === 0 ? 0.8 : 0) + (uu < 7 ? 0.6 : 0), x, y);
        else if (vv > 17) c = vv === 18 ? C('stone', 6) : cel(R.ember, 3, x, y);
        else c = ih(col, row + seed * 9, 405) < 0.2 ? (vv < top + 2 ? C('fire', 6) : C('fire', 5)) : cel(R.indigo, 1.6 + (vv < top + 3 ? 0.8 : 0), x, y);
        if (vv === 17 && (uu === 5 || uu === 8 || uu === 11 || uu === 14) && ih(col, row, seed + 7) < 0.7) c = C(ih(col, uu, 406) < 0.5 ? 'rose' : 'gold', 6);
        if (vv === 16 && (uu === 6 || uu === 10 || uu === 13) && ih(col, row, seed + 7) < 0.7) c = C('moss', 4);
      } else {
        const brick = vn(x - sx, y, 7, seed + 50) > 0.8, joint = brick && (v % 4 === 0 || (u + (fl(v / 4) % 2) * 4) % 8 === 0);
        c = brick ? cel(R.tan, joint ? 2.4 : 3.6, x, y) : cel(ramp, 4.4 + (u < 3 ? 1 : 0) - Math.min(1.6, v / 70) + (vn(u, v, 4, seed) - 0.5) * 0.8 - (u > w - 5 ? 1.4 : 0), x, y);
      }
      BUF[y * W + x] = c;
    }
  }
  // what lies beyond the roofs: dawn sky, distant spires over the cloud sea, a band of far roofs and domes
  function cityBack(t, camX, camY) {
    skyDawn(t, 330 - camX * 0.02, 70 - camY * 0.05);
    birds(300 - camX * 0.05, 60, 10, t, 70, 13);
    for (let k = 0; k < 16; k++) { const z = 8, x = ((k * 97 + ih(k, 1, 411) * 40 - camX / z) % 640 + 640) % 640 - 80, w = 6 + ih(k, 2, 411) * 6; spireTower(x, 200 - camY / z, w, 80 + ih(k, 3, 411) * 70, { seed: k, t, fog: 0.5, tiers: 2 }); }
    cloudSea(176 - camY / 8, t, camX * 0.3, 6, 5, -0.4);
    // the far roofs: domes and flat roofs, hazy rose
    const ox = camX * 0.45;
    for (let x = 0; x < W; x++) { const wx = x + ox, k = fl(wx / 46), u = frac(wx / 46), h = 30 + ih(k, 1, 412) * 30, dome = ih(k, 2, 412) < 0.3 && Math.abs(u - 0.5) < 0.3, top = 190 - camY * 0.45 - h - (dome ? Math.sqrt(0.09 - (u - 0.5) ** 2) * 50 : 0);
      for (let y = Math.max(0, fl(top)); y < H; y++) BUF[y * W + x] = dome && y < top + 3 ? C('gold', 4) : cel(R.rose, 4.2 - (y - top) / 60 + ((y - fl(top)) % 9 === 4 && Math.abs(u - 0.5) < 0.35 && ih(k, y, 413) < 0.3 ? 1.6 : 0), x, y); }
    fog(150 - camY * 0.4, H, tab('#f0b8a8'), 0.25, t, 7);
  }
  // the whole rooftop set at a camera; dark depths in the gaps between buildings
  function roofs(t, camX, camY) {
    cityBack(t, camX, camY);
    for (const r of ROOF) { const sx = r[0] - camX, sy = r[2] - camY; if (sx > W || sx + (r[1] - r[0]) < 0) continue; building(r, sx, sy, t); }
    // prayer flags strung across each gap
    for (let i = 0; i + 1 < ROOF.length; i++) { const a = ROOF[i], b = ROOF[i + 1], xa = a[1] - 20 - camX, xb = b[0] + 20 - camX; if (xb < 0 || xa > W) continue; const ya = a[2] - 34 - camY, yb = b[2] - 34 - camY;
      for (let k = 0; k <= 12; k++) { const u = k / 12, x = lerp(xa, xb, u), y = lerp(ya, yb, u) + Math.sin(u * PI) * 10; if (k < 12) line(x, y, lerp(xa, xb, u + 1 / 12), lerp(ya, yb, u + 1 / 12) + Math.sin((u + 1 / 12) * PI) * 10, C('linen', 5)); if (k > 0 && k < 12) { const col = [R.crimson, R.gold, R.indigo, R.teal, R.linen][(k + i) % 5], f = Math.sin(t * 4 + k) * 1.5; fillPoly([[x - 2, y], [x + 3, y], [x + 0.5 + f, y + 7]], (xx, yy) => cel(col, 4.6, xx, yy)); } } }
  }
  // dust kicked up on landing: a low ring of puffs
  function dust(x, y, g, n, seed) { if (g < 0 || g > 0.8) return; for (let k = 0; k < n; k++) { const s = (k / (n - 1) - 0.5) * 2, r = 2 + g * 10 * (1 - Math.abs(s) * 0.3), px = x + s * (6 + g * 34), py = y - 2 - g * 6 * (1 - Math.abs(s)); fillEll(px, py, r, r * 0.8, 0, (xx, yy, u, v) => (bay(xx, yy) < 1 - g * 1.1 ? cel(R.linen, 6 - g * 3 + (u + v < 0 ? 1 : 0), xx, yy) : -1)); } }
  // speed lines across the frame
  function streaks(t, n, y0, y1, seed, c) { for (let k = 0; k < n; k++) { const y = y0 + ih(k, 1, seed) * (y1 - y0), len = 20 + ih(k, 2, seed) * 60, x = W - ((t * (900 + ih(k, 3, seed) * 600) + ih(k, 4, seed) * 2000) % (W + len * 2)); for (let j = 0; j < len; j++) if (bay(fl(x + j), fl(y)) < 1 - j / len) put(fl(x + j), fl(y), c); } }
  // Kaira in her run: a long-stride sprint, the satchel bouncing, hair streaming
  function kRun(t, k, S, f, extra) {
    const P = runPose(Object.assign({ t, wind: 3 }, extra || {}), t * 17, 6, KAIRA.body);
    if (k.air) { const u = k.u || 0; P.legs = [{ foot: [7, -10 + u * 6] }, { foot: [-8, -4] }]; P.arms = [{ a: 2.2, b: 0.3 }, { a: -1.0, b: 0.4 }]; P.hip = -KAIRA.body.leg + 4; P.lean = 3; }
    return actor(KAIRA, P, k.sx, k.sy, S, f);
  }

  // ---------------------------------------------------------------- the temple's face: white stone, the great window
  const GLASS0 = 113.0, WINX = 40, WINY = 92;
  // story time inside the window shot: a breath of real time, slow motion through the glass, a frozen card, then a snap
  const glassT = (g) => (g < 0.15 ? g : g < 1.0 ? 0.15 + (g - 0.15) * 0.18 : g < 3.0 ? 0.303 : 0.303 + (g - 3.0));
  function facade(t, camX, broken, g) {
    const ox = -camX;
    for (let y = 0; y < H; y++) for (let x = 0; x < Math.min(W, 150 + ox); x++) {
      const wx = x - ox, pc = ((wx + 400) % 44 + 44) % 44, course = y % 9 === 0, joint = ((wx + 400 + (fl(y / 9) % 2) * 11) % 22) === 0;
      let c = cel(R.linen, 4.8 - (pc < 7 ? -0.6 : 0) - (pc === 7 || pc === 0 ? 1.2 : 0) - (course || joint ? 0.7 : 0) + (vn(wx, y, 9, 77) - 0.5) * 0.6 - y / 300 - (wx > 140 ? 1.6 : 0), x, y);
      if (y > 26 && y < 34) c = cel(R.gold, 3.6 + (Math.abs(((wx + 400) % 8) - 4) > (y - 26) / 2 ? 1 : -0.6), x, y);
      BUF[y * W + x] = c;
    }
    // the window: a tall pointed arch of glass, gold-framed; once broken, a ragged hole on the burning-red vault
    const cx = WINX + ox, cy = WINY;
    fillEll(cx, cy, 34, 58, 0, (x, y, u, v) => {
      const ar = v < 0 ? Math.abs(u) + (v * v) * 0.5 > 1.04 : Math.abs(u) > 1; if (ar) return -1;
      const frame = v < 0 ? Math.abs(u) + v * v * 0.5 > 0.9 : Math.abs(u) > 0.86; if (frame) return cel(R.gold, 4.4 - u * 1.2, x, y);
      const hole = broken && Math.hypot(u * 1.2, v + 0.1) < 0.55 + ih(fl(Math.atan2(v, u) * 5), 1, 421) * 0.25;
      if (hole) return cel(R.crimson, 3.6 + (0.5 + 0.5 * Math.sin(t * 9)) * 1.8 - Math.hypot(u, v), x, y);
      const pu = fl((u + 1) * 6), pv = fl((v + 1) * 7);
      if (frac((u + 1) * 6) < 0.12 || frac((v + 1) * 7) < 0.1 || Math.abs(Math.hypot(u, v + 0.3) - 0.42) < 0.03) return C('ink', 1);
      return cel([R.indigo, R.crimson, R.teal, R.gold, R.violet][fl(ih(pu, pv, 422) * 5)], 3.4 + (u < 0 ? 0.8 : 0) + (ih(pu, pv, 423) < 0.2 ? 1.4 : 0), x, y);
    });
    // banners either side
    for (const bx of [-48, 48]) { const x0 = cx + bx, sw = Math.sin(t * 1.4 + bx) * 2; fillPoly([[x0 - 7, 36], [x0 + 7, 36], [x0 + 7 + sw, 150], [x0 + sw, 142], [x0 - 7 + sw, 150]], (x, y) => cel(R.indigo, 3 + (x < x0 + sw * (y - 36) / 114 - 3 ? 1 : 0) - ((y - 36) % 16 === 0 ? 0.6 : 0), x, y)); fillEll(x0 + sw * 0.4, 70, 3, 3, 0, (x, y, u, v) => C('gold', u + v < 0 ? 7 : 5)); }
    // a lower temple roof running under the window to the first house: the ledge
    // a balustrade on the ledge, then the lower temple roof of crimson tile sloping away under it
    for (let y = 156; y < 168; y++) for (let x = 0; x < Math.min(W, 172 + ox); x++) { const bx = ((x - ox) % 10 + 10) % 10, post = bx > 2 && bx < 7 && Math.abs(y - 162) < 4.5 - (bx === 3 || bx === 6 ? 1.5 : 0) * (Math.abs(y - 162) > 2 ? 1 : 0); if (y < 158 || post) BUF[y * W + x] = cel(R.linen, y < 158 ? 6 : 5 - (bx > 4 ? 1 : 0), x, y); }
    for (let y = 168; y < H; y++) for (let x = 0; x < Math.min(W, 180 + ox); x++) { const v = y - 172, row = v % 5 === 0, cu = (x - ox + (fl(v / 5) % 2) * 4) % 8 === 0; BUF[y * W + x] = y < 172 ? C('gold', y === 168 ? 6 : 4) : cel(R.crimson, 3.0 - v / 30 + (row ? -1 : 0) + (cu ? -0.6 : 0) + (v % 5 === 1 ? 0.6 : 0), x, y); }
    if (broken) { glow(cx, cy, 70, tab('#ff4060', true), 0.25 * (0.6 + 0.4 * Math.sin(t * 9))); }
  }
  // a shard of glass: a little spinning sliver, its colour and a white glint
  function shard(x, y, s, a, c, hi) { const dx = Math.cos(a), dy = Math.sin(a); for (let q = -s; q <= s; q++) { const w = Math.max(0, 1 - Math.abs(q) / (s + 0.5)) * s * 0.5; for (let p = -w; p <= w; p += 0.7) put(fl(x + dx * q - dy * p), fl(y + dy * q + dx * p), q === -s + 1 ? hi : c); } }

  // 17 — the window bursts; Kaira, in slow motion, and her card; then she lands and runs (1:52)
  shot(112.0, 122.0, (lt, t) => {
    const g = t - GLASS0, st = Math.max(0, glassT(g)), broken = g > 0, frozen = g >= 1.0 && g < 3.0;
    // her flight: out through the glass, a tucked somersault, down onto the first roof (story time 0 → 1.5)
    const FL = 1.5, u = clamp(st / FL, 0, 1), landX = K_X0, landY = ROOF[0][2];
    let kx = lerp(WINX + 10, landX, u), ky = lerp(WINY + 20, landY, u * u) - Math.sin(u * PI) * 60, rot = u < 0.85 ? eio(u / 0.85) * TAU * 1.0 : 0;
    const k = kairaAt(t), running = t > K_T0;
    if (running) { kx = k.x; ky = k.y; }
    const camX = lerp(-140, k.x - 230, eio(lin(K_T0 - 0.2, K_T0 + 1.2, t))), zoomF = frozen ? eio(lin(1.0, 1.15, g)) : 0;
    roofs(t, camX, 0); facade(t, camX, broken, g);
    LIGHT.x = -0.8; LIGHT.y = -0.5; ENV.edge = C('gold', 6);
    if (g <= 0) { /* before the burst: quiet, banners in the wind, the alarm glows behind the glass */ glow(WINX - camX, WINY, 40 + Math.sin(t * 9) * 4, tab('#ff4060', true), 0.12 + lin(112.0, 113.0, t) * 0.15); }
    else if (!running && st < FL && !frozen) {
      const P = { t, face: { eyes: 'narrow', brows: 'angry' }, wind: 4, hip: -KAIRA.body.leg + 10, legs: [{ foot: [7, -12] }, { foot: [2, -14] }], arms: [{ hand: [8, -26] }, { hand: [4, -24] }], lean: 3 };
      LIGHTS.x = LIGHT.x; LIGHTS.y = LIGHT.y; rig(KAIRA, P, t); soutline(ENV.edge); stamp(kx - camX, ky + 18, 1, false, { rot, piv: 22 });
    } else if (!running && !frozen) {
      // landed: a crouch with one hand down, then up and away
      const c = 1 - lin(K_T0 - 0.2, K_T0, t);
      actor(KAIRA, { t, face: { eyes: 'narrow', brows: 'angry' }, wind: 2, hip: -KAIRA.body.leg + 12 * c, lean: 4 * c, legs: [{ foot: [8, 0] }, { foot: [-7, 0] }], arms: [{ hand: [12, -3 * c - 20 * (1 - c)] }, { a: -0.8, b: 0.6 }] }, kx - camX, ky, 1, 1);
    } else kRun(t, { sx: k.x - camX, sy: k.y, air: k.air, u: k.u }, 1, 1, { face: { eyes: 'narrow', brows: 'angry' } });
    ENV.edge = null;
    dust(landX - camX, landY, t - (GLASS0 + 3.0 + (FL - 0.303)), 7, 1);
    // the glass: a burst of coloured shards flung out and falling, frozen in the card
    if (broken) for (let q = 0; q < 140; q++) {
      const vx = 30 + ih(q, 1, 431) * 160, vy = (ih(q, 2, 431) - 0.65) * 160, tt = st * 1.2, x = WINX + (ih(q, 3, 431) - 0.5) * 50 + vx * tt - camX, y = WINY + (ih(q, 4, 431) - 0.5) * 70 + vy * tt + 120 * tt * tt;
      if (y > H) continue;
      shard(x, y, 1 + fl(ih(q, 5, 431) * 3), ih(q, 6, 431) * TAU + tt * (4 + ih(q, 7, 431) * 8), [C('indigo', 5), C('gold', 6), C('crimson', 5), C('teal', 5), C('violet', 5)][q % 5], WHITE);
    }
    if (g > 0 && g < 0.15) { flash(0.6 * (1 - g / 0.15)); shk(4); }
    // the freeze-frame card: the world pulls in and goes soft and cold; Kaira, close, mid-flight among the shards
    if (frozen) {
      view(lerp(240, kx - camX, zoomF), lerp(135, ky, zoomF), 1 + zoomF * 1.4); defocus(2);
      tintAll(tab('#1a1440', true), 0.35);
      LIGHT.x = -0.8; LIGHT.y = -0.5; ENV.edge = C('crimson', 6);
      bust('kaira', { t: GLASS0 + 1.0, face: { eyes: 'narrow', brows: 'angry', smile: 0.3 }, wind: 3, headY: 2 }, 300 + fl((1 - zoomF) * 40), H - 22 + 4, 3, 1);
      ENV.edge = null;
      for (let q = 0; q < 26; q++) shard(ih(q, 1, 441) * W, LB + ih(q, 2, 441) * 150, 2 + fl(ih(q, 3, 441) * 5), ih(q, 4, 441) * TAU, [C('indigo', 6), C('gold', 6), C('crimson', 6), C('teal', 6), C('violet', 6)][q % 5], WHITE);
      const a = eoc(lin(1.0, 1.25, g));
      for (let y = 190; y < 240; y++) for (let x = 0; x < W; x++) { const xx = x - (y - 190) * 0.6; if (xx > 20 && xx < 20 + 440 * a) BUF[y * W + x] = y < 193 || y > 236 ? C('gold', 5) : cel(R.indigo, 1.6 + ((xx + t * 0) % 40 < 20 ? 0.3 : 0), x, y); }
      text('KAIRA', 40, 197, C('gold', 6), 4, C('ink', 0), fl((g - 1.1) * 30));
      text('COURIER OF THE SKY TEMPLE', 44, 226, C('linen', 7), 1, C('ink', 0), fl((g - 1.4) * 40));
    }
    if (g > 2.98 && g < 3.06) flash(0.4);
  });

  // ---------------------------------------------------------------- the chase
  // a jagged bolt of lightning between two points, re-forked every frame
  function bolt(x0, y0, x1, y1, seed, c, c2) {
    const n = Math.max(3, fl(Math.hypot(x1 - x0, y1 - y0) / 8)); let px = x0, py = y0;
    for (let i = 1; i <= n; i++) { const u = i / n, j = i === n ? 0 : (ih(i, seed, 451) - 0.5) * 12, nx = lerp(x0, x1, u) + j * (y1 - y0) / Math.hypot(x1 - x0, y1 - y0 || 1), ny = lerp(y0, y1, u) - j * (x1 - x0) / Math.hypot(x1 - x0 || 1, y1 - y0); line(px, py, nx, ny, c2 || c, 2); line(px, py, nx, ny, c); px = nx; py = ny; }
  }
  // the pursuers: Oren and his wardens on the same roofs, a little behind her, jumping the same gaps
  function pursuers(t, camX, camY, n, S, o) {
    o = o || {};
    for (let k = n - 1; k >= 0; k--) {
      const d = (o.lag || 0.9) + k * 0.32, q = kairaAt(t - d), CH = k === 0 ? OREN : WARDEN;
      const P = runPose({ t, face: {} }, t * 15 + k * 1.7, 5, WARDEN.body);
      if (q.air) { P.legs = [{ foot: [6, -9] }, { foot: [-7, -3] }]; P.hip = -WARDEN.body.leg + 3; }
      P.prop = (A) => spearArt(A.hand[0], A.hand[1], 1.1, 34, t);
      if (o.throwK === k) { const u = o.throwU; P.arms = [{ a: lerp(-2.6, 1.6, u), b: 0.2 }, { a: 0.9, b: 0.4 }]; if (u > 0.4) P.prop = null; }
      actor(CH, P, q.x - camX, q.y - camY, S || 1, 1);
    }
  }
  // the camera for the chase: Kaira a little left of centre, the horizon steady, a hint of lag
  const chaseCam = (t, lead) => { const k = kairaAt(t); return { k, camX: k.x - (lead || 200), camY: Math.min(0, (kairaAt(t - 0.25).y - 200) * 0.6) }; };
  // the running bust: Kaira close, tracking with her, the rooftops streaming past soft behind her
  function runBust(t, F, o) {
    o = o || {};
    const { camX } = chaseCam(t), f = o.f || 1;
    closeBg(() => roofs(t, camX + (o.bgDX || 0), -30), o.fx || 300, o.fy || 112, 2.0, 3);
    streaks(t, 18, LB, H - LB, 461, C('linen', 6));
    const bob = Math.round(Math.abs(Math.sin(t * 8.5)) * 3);
    LIGHT.x = -0.8; LIGHT.y = -0.5; ENV.edge = C('gold', 6);
    const r = bust('kaira', { t, face: F, wind: 3, headX: o.headX || 0, headY: o.headY || 0 }, o.x || 250, H - LB + 8 - bob, 3, f);
    ENV.edge = null;
    // prayer flags strung between the roofs whip past close to the lens, every so often
    const fp = frac(t * 0.55 + 0.3), fx0 = W + 40 - fp * (W + 400);
    if (fp < 0.9) for (let q = 0; q < 9; q++) { const x = fx0 + q * 40, y = LB + 10 + Math.sin(q / 8 * PI) * 22 + q * 3, col = [R.crimson, R.gold, R.indigo, R.teal, R.linen][q % 5], fl_ = Math.sin(t * 9 + q) * 5; if (x < -30 || x > W + 30) continue; line(x - 20, y - 2, x + 20, y + 2, C('linen', 3), 2); fillPoly([[x - 9, y], [x + 9, y + 1], [x + fl_ * 0.5, y + 22]], (xx, yy) => cel(col, 3.6 + (xx < x ? 1 : 0), xx, yy)); }
    return r;
  }

  // 18 — the chase: a wide, the wardens spilling onto the roofs behind her (2:02)
  shot(122.0, 123.0, (lt, t) => {
    const { k, camX, camY } = chaseCam(t, 260);
    roofs(t, camX, camY);
    LIGHT.x = -0.8; LIGHT.y = -0.5; ENV.edge = C('gold', 6);
    pursuers(t, camX, camY, 4, 1);
    kRun(t, { sx: k.x - camX, sy: k.y - camY, air: k.air, u: k.u }, 1, 1, { face: { eyes: 'wide', brows: 'worried' } });
    ENV.edge = null;
  });
  // 18b — close, running: "[gasp] Okay. Okay. Framed, chased, and glowing. Great start to the week."
  shot(123.0, 128.3, (lt, t) => {
    const back = sstep(123.9, 124.2, t) * (1 - sstep(125.0, 125.3, t)), wry = sstep(126.2, 126.6, t);
    runBust(t, { eyes: blink(t, 7) ? 'closed' : lt < 0.5 ? 'wide' : wry > 0.5 ? 'half' : 'open', brows: wry > 0.5 ? 'up' : 'worried', mouth: mouth('kaira', t), smile: wry * 0.7 - (1 - wry) * 0.2, look: -2 * back }, { headX: -Math.round(back * 2) });
  });
  // 18c — Oren leads the wardens over a gap: "Courier! Return the Seed!"
  shot(128.3, 131.0, (lt, t) => {
    const q = kairaAt(t - 0.9), camX = q.x - 190, camY = Math.min(0, (q.y - 200) * 0.6) - 10;
    roofs(t, camX, camY);
    LIGHT.x = -0.8; LIGHT.y = -0.5; ENV.edge = C('gold', 6);
    pursuers(t, camX, camY, 4, 1);
    ENV.edge = null;
    // Oren's visor flares as he shouts
    const oq = kairaAt(t - 0.9); if (talking('oren', t)) glow(oq.x - camX + 6, oq.y - camY - 58, 10, tab('#ffb040', true), 0.5);
    view(q.x - camX + 10, q.y - camY - 40, 2);
  });

  // 19 — "I don't HAVE it!" shouted back over her shoulder; the chest glows; "[sigh] Okay. I might have it." (2:11)
  shot(131.0, 135.6, (lt, t) => {
    const back = sstep(131.3, 131.5, t) * (1 - sstep(132.7, 132.9, t)), glowA = sstep(132.8, 133.5, t), down = sstep(133.0, 133.3, t) * (1 - sstep(134.1, 134.4, t)), sigh = sstep(134.3, 134.6, t);
    const r = runBust(t, { eyes: blink(t, 5) ? 'closed' : down > 0.5 ? 'half' : sigh > 0.5 ? 'half' : 'wide', brows: back > 0.5 ? 'angry' : sigh > 0.5 ? 'up' : 'worried', mouth: mouth('kaira', t), smile: sigh * 0.5, look: back > 0.5 ? -3 : 0 }, { f: back > 0.5 ? -1 : 1, x: back > 0.5 ? 236 : 250, headY: Math.round(down * 3) });
    if (glowA > 0) {
      // the Storm Seed in her satchel, light leaking through the canvas and her fingers, little arcs crawling over it
      const cx = r.chest[0] - 14, cy = r.chest[1] + 14, p = 0.75 + 0.25 * Math.sin(t * 9);
      tintAll(tab('#ffc060', true), 0.12 * glowA);
      glow(cx, cy, 80 * p, tab('#ffd060', true), 0.7 * glowA);
      glow(cx, cy, 26, tab('#80f0ff', true), 0.9 * glowA);
      fillEll(cx, cy, 4, 3, 0, (x, y) => (glowA > 0.4 ? WHITE : -1));
      for (let b = 0; b < 3; b++) { const a = ih(b, fl(t * 14), 471) * TAU, L = 12 + ih(b, fl(t * 14) + 1, 471) * 22; if (glowA > 0.5) bolt(cx, cy, cx + Math.cos(a) * L, cy + Math.sin(a) * L, fl(t * 14) + b, C('snow', 7), C('cyan', 6)); }
    }
  });
  // 19b — the spear: thrown from behind, it flies at her back; she steps through the air in a flash of lightning
  const STEP_T = 136.3, STEP_D = 70;
  shot(135.6, 140.0, (lt, t) => {
    const { k, camX, camY } = chaseCam(t, 240), stepped = t > STEP_T, sx = k.x - camX + (stepped ? STEP_D * eoc(lin(STEP_T, STEP_T + 0.12, t)) : 0), sy = k.y - camY;
    roofs(t, camX, camY);
    LIGHT.x = -0.8; LIGHT.y = -0.5; ENV.edge = C('gold', 6);
    const th = lin(135.6, 135.85, t);
    pursuers(t, camX, camY, 3, 1, { throwK: 0, throwU: th });
    // the after-images she leaves behind in the step, fading gold
    if (t > STEP_T && t < STEP_T + 0.6) for (let q = 0; q < 4; q++) { const u = q / 4; LIGHTS.x = LIGHT.x; LIGHTS.y = LIGHT.y; rig(KAIRA, runPose({ t: STEP_T, wind: 3, face: {} }, STEP_T * 17, 6, KAIRA.body), STEP_T); soutline(); stamp(k.x - camX + u * STEP_D, sy, 1, false, { color: C(q % 2 ? 'gold' : 'cyan', 6), alpha: (1 - (t - STEP_T) / 0.6) * (0.3 + u * 0.5) }); }
    kRun(t, { sx, sy, air: k.air, u: k.u }, 1, 1, { face: { eyes: 'narrow', brows: stepped ? 'up' : 'angry', smile: stepped ? 0.8 : 0 } });
    ENV.edge = null;
    // the spear: from Oren's hand in a flat arc to exactly where her back was, a hair after she has gone; it buries
    // its head in the roof tiles and quivers
    if (t > 135.85) {
      const o = kairaAt(135.85 - 0.9), w = kairaAt(STEP_T), X0 = o.x + 12, Y0 = o.y - 40, X1 = w.x + 16, Y1 = w.y - 2, T1 = 136.36;
      const at = (tt) => { const u = clamp((tt - 135.85) / (T1 - 135.85), 0, 1); return [lerp(X0, X1, u), lerp(Y0, Y1, u * u) - Math.sin(u * PI) * 8]; };
      const stuck = t >= T1, p = at(t), p0 = at(Math.min(t, T1) - 0.02), ang = stuck ? Math.atan2(at(T1)[1] - at(T1 - 0.02)[1], at(T1)[0] - at(T1 - 0.02)[0]) : Math.atan2(p[1] - p0[1], p[0] - p0[0]);
      const quiv = stuck ? Math.sin((t - T1) * 46) * Math.exp(-(t - T1) * 5) * 0.12 : 0, a2 = ang + quiv, dx = Math.cos(a2), dy = Math.sin(a2), tx = p[0] - camX, ty = p[1] - camY;
      for (let q = 0; q < 44; q++) { put(fl(tx - dx * q), fl(ty - dy * q), C('wood', q % 4 ? 4 : 3)); put(fl(tx - dx * q), fl(ty - dy * q + 1), C('wood', 2)); }
      for (let q = 0; q < 6; q++) for (let j = -1.5 + q * 0.25; j <= 1.5 - q * 0.25; j += 0.5) put(fl(tx + dx * q - dy * j), fl(ty + dy * q + dx * j), C('steel', j < 0 ? 7 : 5));
      if (!stuck) for (let q = 0; q < 34; q++) if (bay(fl(tx - dx * (44 + q)), fl(ty - dy * (44 + q))) < 1 - q / 34) put(fl(tx - dx * (44 + q)), fl(ty - dy * (44 + q)), C('linen', 7));
      if (stuck && t < T1 + 0.4) { const g = (t - T1) / 0.4; for (let q = 0; q < 10; q++) put(fl(tx + 4 + (ih(q, 1, 481) - 0.5) * 30 * g), fl(ty - ih(q, 2, 481) * 18 * g + g * g * 20), C(q % 2 ? 'crimson' : 'ember', 5)); if (g < 0.2) shk(2); }
    }
    // the step itself: a flash and lightning down the line she travelled
    if (t > STEP_T && t < STEP_T + 0.35) { const a = 1 - (t - STEP_T) / 0.35; for (let b = 0; b < 2; b++) bolt(k.x - camX, sy - 28 + b * 10, sx, sy - 26 + b * 6, fl(t * 30) + b, C('snow', 7), C('gold', 6)); glow(sx, sy - 26, 40 * a, tab('#ffe080', true), 0.6 * a); if (t < STEP_T + 0.06) { flash(0.4); shk(3); } }
    // then in close beside her as she runs on, grinning
    if (t > 137.1) view(sx - 20, sy - 44, 2);
  });

  // 20 — the wide: the wardens throwing chains, a long gap between two roofs, her spinning leap over it (2:20)
  const CHAINS = [[141.2, 1], [144.6, 2], [146.0, 1]];
  shot(140.0, 148.0, (lt, t) => {
    const { k, camX, camY } = chaseCam(t, 220), spin = lin(LEAP_X / 1 > 0 ? 142.6 : 0, 143.6, t);
    roofs(t, camX, camY);
    LIGHT.x = -0.8; LIGHT.y = -0.5; ENV.edge = C('gold', 6);
    pursuers(t, camX, camY, 5, 1, { lag: 1.1 });
    const sx = k.x - camX, sy = k.y - camY;
    if (spin > 0 && spin < 1) {
      // tucked tight and turning over the gap; the Seed answering with a spiral of light
      const P = { t, wind: 4, face: { eyes: 'narrow', brows: 'angry' }, hip: -KAIRA.body.leg + 12, legs: [{ foot: [8, -14] }, { foot: [4, -12] }], arms: [{ hand: [9, -24] }, { hand: [5, -22] }], lean: 3 };
      LIGHTS.x = LIGHT.x; LIGHTS.y = LIGHT.y;
      for (const lagT of [0.12, 0.06]) { const s2 = lin(142.6, 143.6, t - lagT), q = kairaAt(t - lagT); if (s2 <= 0) continue; rig(KAIRA, P, t); soutline(); stamp(q.x - camX, q.y - camY + 14, 1, false, { rot: eio(s2) * TAU, piv: 22, color: C('gold', 6), alpha: 0.4 }); }
      rig(KAIRA, P, t); soutline(ENV.edge); stamp(sx, sy + 14, 1, false, { rot: eio(spin) * TAU, piv: 22 });
      for (let q = 0; q < 26; q++) { const a = q / 26 * TAU * 1.5 + t * 14, r = 26 + Math.sin(q * 0.6) * 4; if (bay(fl(sx + Math.cos(a) * r), fl(sy - 10 + Math.sin(a) * r)) < 0.8) put(fl(sx + Math.cos(a) * r), fl(sy - 10 + Math.sin(a) * r), q % 3 ? C('gold', 6) : C('cyan', 6)); }
      glow(sx, sy - 10, 30, tab('#ffd060', true), 0.3);
    } else kRun(t, { sx, sy, air: k.air, u: k.u }, 1, 1, { face: { eyes: 'narrow', brows: 'angry', smile: t > 143.6 && t < 145 ? 0.8 : 0 } });
    ENV.edge = null;
    // chains whipped at her from the wardens: a weighted end on a line of links, falling short or wrapping a post
    for (const [c0, who] of CHAINS) {
      const u = (t - c0) / 0.7; if (u <= 0 || u > 1.8) continue;
      const w = kairaAt(t - 1.1 - who * 0.32), x0 = w.x - camX + 8, y0 = w.y - camY - 40, tgt = kairaAt(c0 + 0.7), tx = tgt.x - camX - 24, ty = tgt.y - camY - 30;
      const reach = Math.min(1, u), drop = Math.max(0, u - 1) * 60;
      for (let c = 0; c <= 40; c++) { const v = c / 40 * reach, x = lerp(x0, tx, v), y = lerp(y0, ty, v) - Math.sin(v * PI) * 30 + drop * v * v; fillEll(x, y, c % 2 ? 2 : 1.4, c % 2 ? 1.4 : 2, 0, (xx, yy, uu, vv) => (Math.hypot(uu, vv) < 0.45 ? -1 : C('steel', uu + vv < 0 ? 6 : 3))); }
      const ex = lerp(x0, tx, reach), ey = lerp(y0, ty, reach) - Math.sin(reach * PI) * 30 + drop; fillEll(ex, ey, 4, 4, 0, (x, y, uu, vv) => C('steel', uu + vv < -0.3 ? 7 : uu + vv < 0.4 ? 5 : 2));
    }
    // a gust of cloud through the long gap
    if (t > 142.0 && t < 144.5) streaks(t, 10, sy - 80, sy + 20, 491, C('linen', 7));
    // in close running with her, pulled wide for the leap and the last chain
    if (t < 142.2 || (t > 144.3 && t < 145.7)) view(sx - 30, sy - 50, 2);
  });
