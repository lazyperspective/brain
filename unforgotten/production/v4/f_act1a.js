  /* ================================================================ ACT ONE (a) — Halcyon Spire, now: the vault, the window, the chase, the edge */
  // ---------------------------------------------------------------- the city above the clouds, at dawn
  function skyDawn(t, sunX, sunY) {
    for (let y = 0; y < H; y++) { const u = y / H; for (let x = 0; x < W; x++) { const v = u < 0.45 ? lerp(1.2, 3.6, u / 0.45) : lerp(3.6, 5.6, (u - 0.45) / 0.55); BUF[y * W + x] = u < 0.32 ? soft(R.dusk, v + 1, x, y) : u < 0.62 ? soft(R.rose, v - 0.8, x, y) : soft(R.fire, v - 1.4, x, y); } }
    glow(sunX, sunY, 120, tab('#ffd890', true), 0.5);
    fillEll(sunX, sunY, 14, 14, 0, (x, y, u, v) => cel(R.snow, 7 - Math.hypot(u, v) * 0.6, x, y));
  }
  // a sea of cloud: banks of rounded lumps, lit gold on top, rose and violet in their bellies
  function cloudSea(y0, t, camX, z, seed, lit) {
    const ox = camX / z + t * 3;
    for (let x = 0; x < W; x++) {
      const wx = x + ox, top = y0 - (fbm(wx, seed, 30 * z, 3, seed) - 0.3) * 26 - Math.max(0, Math.sin(wx / (18 * z) + seed)) * 10;
      for (let y = Math.max(0, fl(top)); y < H; y++) { const d = y - top; BUF[y * W + x] = d < 1.5 ? cel(R.fire, 6.4, x, y) : d < 4 ? cel(R.rose, 6 + lit, x, y) : d < 12 ? cel(R.rose, 4.6 + lit + (vn(wx, y, 6, seed) > 0.6 ? 0.6 : 0), x, y) : cel(R.dusk, 4.6 - Math.min(2, (d - 12) / 20) + lit, x, y); }
    }
  }
  // a white tower of the city: a round shaft (shaded as a cylinder lit from the left), rows of gold-framed windows,
  // a gold band, a gold roof in pagoda tiers, a pennant; cx, base: bottom centre; w, h: shaft size; s: detail scale
  function spireTower(cx, base, w, h, o) {
    o = o || {}; const seed = o.seed || 1, fogA = o.fog || 0, t = o.t || 0;
    const x0 = fl(cx - w / 2), x1 = fl(cx + w / 2), top = fl(base - h);
    for (let y = Math.max(0, top); y < Math.min(H, base); y++) for (let x = Math.max(0, x0); x < Math.min(W, x1); x++) {
      const u = (x + 0.5 - cx) / (w / 2), shade = 5.6 - u * 1.8 - Math.abs(u) ** 4 * 1.4, v = y - top;
      const wrow = fl(v / 14), wv = v % 14, wcol = fl((u * 0.5 + 0.5) * Math.max(2, fl(w / 7))), wu = frac((u * 0.5 + 0.5) * Math.max(2, fl(w / 7)));
      let c = cel(R.linen, shade + (v % 6 === 0 ? -0.4 : 0), x, y);
      if (w > 8 && wv > 4 && wv < 11 && wu > 0.3 && wu < 0.7 && Math.abs(u) < 0.85) c = (wv === 5 || wu < 0.38 || wu > 0.62) ? cel(R.gold, 4 + (u < 0 ? 1 : 0), x, y) : ih(wcol, wrow, seed) < 0.25 ? cel(R.fire, 5.4, x, y) : cel(R.indigo, 2 + (wv < 7 ? 1 : 0), x, y);
      if (v > 0 && v % 42 < 2) c = cel(R.gold, 4.6 - u, x, y);
      BUF[y * W + x] = c;
    }
    // the roof: three tiers of upswept gold eaves, a spike, a pennant
    let ry = top;
    for (let k = 0; k < (o.tiers || 3); k++) {
      const rw = w * (0.75 - k * 0.18) + 6, rh = Math.max(3, w * 0.22);
      for (let y = 0; y < rh; y++) { const hw = lerp(rw * 0.3, rw / 2 + 2, y / rh) + (y > rh - 2 ? 2 : 0); for (let x = fl(cx - hw); x < cx + hw; x++) put(x, fl(ry - rh + y), y > rh - 2 ? C('gold', 2) : cel(R.gold, 5 + ((x - cx) / hw) * -1.4 + ((y + x) % 3 === 0 ? -0.6 : 0), x, ry - rh + y)); }
      ry -= rh; if (k < (o.tiers || 3) - 1) { const hw = rw * 0.22; for (let y = 0; y < 3; y++) for (let x = fl(cx - hw); x < cx + hw; x++) put(x, fl(ry - y), cel(R.linen, 5 - (x - cx) / hw, x, ry - y)); ry -= 3; }
    }
    for (let y = 0; y < w * 0.4; y++) put(fl(cx), fl(ry - y), C('gold', 5));
    if (w > 10) { const py = ry - w * 0.4; for (let k = 0; k < w * 0.6; k++) { const wv_ = Math.sin(t * 5 + k * 0.5 + seed) * 1.2 * k / (w * 0.6); for (let j = 0; j < Math.max(1, 3 - k / (w * 0.3)); j++) put(fl(cx + k), fl(py + j + wv_), C('crimson', 4)); } }
    if (fogA > 0) for (let y = Math.max(0, fl(ry - w)); y < Math.min(H, base); y++) for (let x = Math.max(0, fl(cx - w)); x < Math.min(W, cx + w); x++) { const i = y * W + x; if (BUF[i] >> 3 === R.linen || BUF[i] >> 3 === R.gold || BUF[i] >> 3 === R.indigo || BUF[i] >> 3 === R.fire || BUF[i] >> 3 === R.crimson) tintSoft(i, x, y, tab('#f0b8a8'), fogA); }
  }
  // the city's towers in layers of depth; camera (camX, camY) and a push-in k that brings the near layers closer
  // towers by depth layer: [z, count, width, how high the roofs reach (fraction of the frame from the top)]
  const SPIRE_L = [[6, 14, 7, 0.32], [4, 10, 11, 0.24], [2.6, 6, 18, 0.16], [1.7, 4, 30, 0.08]];
  const SPIRE_T = []; SPIRE_L.forEach(([z, n, w, top], li) => { for (let k = 0; k < n; k++) SPIRE_T.push({ x: (k / n - 0.5) * 1100 * (z / 3) + (ih(k, li, 91) - 0.5) * 60, z, w: w * (0.8 + ih(k, 2, 91) * 0.5), top: top + ih(k, 3, 91) * 0.3, seed: k * 7 + li }); });
  function spireCity(t, camX, camY, push, opt) {
    opt = opt || {};
    for (const [z] of SPIRE_L) {
      const m = 1 + push / (z * z);
      if (z === 6) cloudSea(170 - camY / 8, t, camX, 8, 3, -0.6);
      for (const T of SPIRE_T) {
        if (T.z !== z) continue;
        const x = 240 + (T.x - camX / z * 3) * m / z, base = 240 - camY / z, w = T.w * m;
        if (x < -w || x > W + w) continue;
        if (z < 3 && Math.abs(x - 240) < 70) continue;                 // keep the temple clear
        const topY = (T.top * H - camY / z * 0.6) - (m - 1) * 40;
        spireTower(x, base, w, base - topY, { seed: T.seed, t, fog: [0.5, 0.32, 0.16, 0.04][SPIRE_L.findIndex((L) => L[0] === z)], tiers: 2 + (T.seed % 2) });
      }
      if (z === 4) { for (let k = 0; k < 4; k++) { const xa = 240 + ((k - 1.5) * 150 - camX / 4 * 3) * (1 + push / 16) / 4, xb = xa + 50, by = 150 - camY / 4 - k * 9; for (let x = fl(xa); x < xb; x++) { const sag = Math.sin((x - xa) / (xb - xa) * PI) * 4; put(x, fl(by + sag), C('gold', 5)); put(x, fl(by + sag + 1), C('linen', 4)); put(x, fl(by + sag + 2), C('linen', 3)); } } cloudSea(206 - camY / 4, t, camX, 4, 7, 0); }
      if (z === 2.6) { if (opt.temple) opt.temple(push); cloudSea(242 - camY / 2.6, t, camX, 2.6, 11, 0.4); }
    }
    cloudSea(266 - camY / 1.2, t, camX, 1.2, 17, 0.8);
  }
  // birds: little V's wheeling in a loose flock
  function birds(cx, cy, n, t, spread, seed) { for (let k = 0; k < n; k++) { const a = t * (0.3 + ih(k, 1, seed) * 0.2) + ih(k, 2, seed) * TAU, r = spread * (0.4 + ih(k, 3, seed)); const x = cx + Math.cos(a) * r, y = cy + Math.sin(a * 0.7) * r * 0.3 + ih(k, 4, seed) * 20, f = Math.sin(t * 12 + k * 2) > 0 ? 1 : 0; put(fl(x), fl(y), C('dusk', 1)); put(fl(x) - 1, fl(y) - f, C('dusk', 1)); put(fl(x) + 1, fl(y) - f, C('dusk', 1)); if (ih(k, 5, seed) < 0.4) { put(fl(x) - 2, fl(y) - 1 - f, C('dusk', 1)); put(fl(x) + 2, fl(y) - 1 - f, C('dusk', 1)); } } }
  // the temple: the tallest tower, a great dome, a bell tower whose bells toll
  const BELLS = [96.5, 99.5, 102.5];
  function temple(t, cx, base, sc) {
    spireTower(cx, base, 40 * sc, 100 * sc, { seed: 99, t, tiers: 4 });
    // a great rose window halfway up
    const wy = base - 64 * sc; fillEll(cx, wy, 11 * sc, 11 * sc, 0, (x, y, u, v) => { const r = Math.hypot(u, v), a = Math.atan2(v, u); if (r > 0.86) return C('gold', 4); if (Math.abs(frac(a / TAU * 8) - 0.5) > 0.44 || Math.abs(r - 0.5) < 0.06) return C('gold', 3); return cel([R.indigo, R.crimson, R.teal, R.gold][fl((a / TAU + 1) * 8) % 4], 4.6, x, y); });
    for (const bt of BELLS) { const g = t - bt; if (g > 0 && g < 2.4) for (let k = 0; k < 2; k++) { const gg = g - k * 0.25; if (gg <= 0) continue; const r = gg * 140 * sc / 2; for (let a = 0; a < TAU; a += 0.6 / Math.max(4, r)) { const x = cx + Math.cos(a) * r, y = base - 118 * sc + Math.sin(a) * r * 0.35; if (bay(fl(x), fl(y)) < 1 - gg / 2.4) put(fl(x), fl(y), C('gold', 6)); } } }
  }
  // a title card: big letters with a dark outline, typed on, and a subtitle
  function card(t0, t, title, sub, x, y) {
    const a = lin(t0, t0 + 0.4, t); if (a <= 0) return;
    const nv = fl((t - t0) * 30);
    text(title, x, y, C('snow', 7), 2, C('ink', 0), nv);
    if (sub) text(sub, x, y + 20, C('gold', 6), 1, C('ink', 0), Math.max(0, nv - title.length));
  }

  // 15 — HALCYON SPIRE (1:33): up out of the cloud sea at dawn, gliding between the towers toward the temple
  shot(93.0, 104.0, (lt, t) => {
    const u = eio(lt / 11), camX = lerp(-90, 40, u), camY = lerp(120, -10, eio(lin(0, 7, lt))), push = lerp(0, 1.4, u);
    skyDawn(t, 120 - camX * 0.05, 92 + camY * 0.12);
    birds(260, 70 + camY * 0.2, 14, t, 90, 5);
    spireCity(t, camX, camY, push, { temple: (p) => temple(t, 250 + (40 - camX) / 6, 250 - camY / 2.6, 1.25 * (1 + p / 5)) });
    birds(150, 120 + camY * 0.5, 8, t * 1.3, 120, 9);
    card(95.2, t, 'HALCYON SPIRE', 'THE CITY ABOVE THE CLOUDS · NOW', 26, 40);
    fade(1 - lin(0, 0.5, lt));
  }, { nocaps: false });

  // ---------------------------------------------------------------- the temple vault: a long hall in one-point perspective
  const VH = 112;            // the horizon (the vanishing point's y)
  function vault(t, alarm, cx) {
    cx = cx === undefined ? 240 : cx;
    // the back wall and its great window, glowing gold and blue
    for (let y = 0; y < VH + 30; y++) for (let x = 0; x < W; x++) BUF[y * W + x] = cel(R.indigo, 1.2 + (y % 18 < 1 ? -0.6 : 0) + ((x + fl(y / 18) * 9) % 26 < 1 ? -0.6 : 0), x, y);
    fillEll(cx, 60, 30, 46, 0, (x, y, u, v) => {
      if (v > 0.55) return -1; const r = Math.hypot(u, v + 0.15), a = Math.atan2(v + 0.15, u);
      if (Math.abs(r - 0.55) < 0.04 || r > 0.94 || Math.abs(frac(a / TAU * 12) - 0.5) > 0.45) return C('gold', 2);
      if (Math.abs(frac(x / 6) - 0.5) > 0.4 || Math.abs(frac(y / 7) - 0.5) > 0.42) return C('ink', 1);
      return cel(r < 0.55 ? R.gold : [R.indigo, R.crimson, R.teal, R.violet][fl(ih(fl(x / 6), fl(y / 7), 301) * 4)], r < 0.55 ? 6 : 5, x, y);
    });
    // the floor: dark polished stone in perspective, thin gold inlay lines, a gold sunburst only round the pedestal,
    // the window's light lying along it
    for (let y = VH + 1; y < H; y++) { const d = 60 / (y - VH); for (let x = 0; x < W; x++) { const wx = (x - cx) * d, wz = 60 * d, r = Math.hypot(wx, (wz - 32) * 0.9), a = Math.atan2(wx, wz - 32);
      const inlay = frac(wx / 6) < 0.05 || frac(wz / 6) < 0.04, burst = r < 12 && Math.abs(frac(a / TAU * 16) - 0.5) < 0.12, refl = Math.max(0, 1 - Math.abs(x - cx) / (22 + (y - VH) * 0.6)) * 2.2;
      BUF[y * W + x] = burst || (inlay && r < 30) ? cel(R.gold, 2.6 + refl * 0.6 + (y - VH) / 120, x, y) : cel(R.indigo, 1.0 + (y - VH) / 160 + refl + (inlay ? -0.6 : 0), x, y); } }
    // pillars receding in pairs, pale stone with gold capitals, standing in shadow
    for (let k = 5; k >= 0; k--) {
      const z = 24 + k * 13, s = 60 / z;
      for (const side of [-1, 1]) {
        const px = cx + side * 30 * s, pw = 4 * s, top = VH - 100 * s, bot = VH + 60 * s;
        for (let y = Math.max(0, fl(top)); y < Math.min(H, bot); y++) for (let x = fl(px - pw); x < px + pw; x++) { if (x < 0 || x >= W) continue; const u = (x + 0.5 - px) / pw; BUF[y * W + x] = cel(R.lav, 3.4 - u * side * 1.4 - Math.abs(u) ** 4 * 1.6 - k * 0.35 - (y - top) / (bot - top) * 0.8, x, y); }
        for (const yy of [top, bot - 4 * s]) rectF(px - pw * 1.4, yy, pw * 2.8, Math.max(2, 4 * s), C('gold', 3));
      }
    }
    // the pedestal and its smashed glass case, the Storm Seed's cradle empty
    const ps = 60 / 32, py = VH + 60 * ps * 0.48;
    fillPoly([[cx - 14, py - 20], [cx + 14, py - 20], [cx + 18, py + 4], [cx - 18, py + 4]], (x, y) => cel(R.gold, 4.4 - (x - cx) / 18 * 1.4 + (y > py ? -1 : 0), x, y));
    for (let k = 0; k < 9; k++) { const a = -PI / 2 + (k - 4) * 0.28, L = 8 + ih(k, 1, 303) * 10; line(cx + Math.cos(a) * 6, py - 22, cx + Math.cos(a) * L, py - 22 + Math.sin(a) * L, C('cyan', 6)); }
    for (let k = 0; k < 30; k++) { const x = cx + (ih(k, 1, 304) - 0.5) * 90, y = py + 2 + ih(k, 2, 304) * 30; put(fl(x), fl(y), ih(k, fl(t * 4), 305) < 0.3 ? WHITE : C('cyan', 5)); }
    rays(cx, 40, 6, 260, tab('#ffd27a', true), 0.16, t, 7);
    glow(cx, py - 22, 30, tab('#46d2f0', true), 0.3);
    for (let k = 0; k < 40; k++) { const u = frac(ih(k, 1, 306) + t * 0.03); put(fl(cx + (ih(k, 2, 306) - 0.5) * 140), fl(30 + u * 160), C('gold', 6)); }
    // the alarm: red light pulsing through the hall, swinging from lamps high on the walls
    if (alarm) { const p = 0.5 + 0.5 * Math.sin(t * 9); tintAll(tab('#ff2040', true), p * 0.12); for (const side of [-1, 1]) { const lx = cx + side * 190, ly = 26, a = Math.sin(t * 4 * side) * 0.6 + (side < 0 ? 0.6 : PI - 0.6); for (let r = 0; r < 140; r += 1) for (let w = -r * 0.12; w <= r * 0.12; w++) { const x = fl(lx + Math.cos(a) * r - Math.sin(a) * w), y = fl(ly + Math.sin(a) * r + Math.cos(a) * w); if (x >= 0 && x < W && y >= 0 && y < H) tintI(y * W + x, x, y, tab('#ff3050', true), 0.3 * (1 - r / 140)); } fillEll(lx, ly, 4, 4, 0, C('crimson', 6)); } }
  }
  // 16 — the vault (1:44): the alarm, wardens running in, an empty cradle — "The Storm Seed… it's gone!"
  shot(104.0, 107.0, (lt, t) => {
    vault(t, true);
    LIGHT.x = 0; LIGHT.y = -1; ENV.edge = C('gold', 6);
    const order = [[-60, 0.0, 1], [70, 0.25, -1], [-110, 0.5, 1]];
    order.forEach(([x0, d, f], k) => {
      const u = eoc(lin(d, d + 1.3, lt)), x = 240 + x0 * (1 - u * 0.55), y = 250 - u * 26, run = u < 0.98;
      const P = run ? runPose({ t }, t * 14 + k, 5, WARDEN.body) : { t, arms: [{ a: 0.5, b: 0.4 }, { a: 0.1 }], legs: [{ foot: [5, 0] }, { foot: [-5, 0] }] };
      P.prop = (A) => spearArt(A.hand[0], A.hand[1], run ? 0.9 : 0.15, 36, t);
      actor(WARDEN, P, x, y, 1, f);
    });
    ENV.edge = null;
    view(240, 160, 1.5);
  });
  // 16b — Oren, close: "The courier. Kaira was the last one in the vault. Find her!"
  shot(107.0, 112.0, (lt, t) => {
    closeBg(() => vault(t, true, 300), 220, 120, 2.6, 3);
    LIGHT.x = -0.6; LIGHT.y = -0.6; ENV.edge = C('crimson', 6);
    bust('oren', { t, face: { mouth: mouth('oren', t) }, headX: Math.round(Math.sin(t * 1.2) * 0.8) }, 236, H - 22 + 6, 3, 1);
    ENV.edge = null;
    tintAll(tab('#ff2040', true), (0.5 + 0.5 * Math.sin(t * 9)) * 0.1);
  });
