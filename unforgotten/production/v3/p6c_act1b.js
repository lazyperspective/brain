  /* ================================================================ ACT ONE (b) — the harbour: Tamo, the anchor, the Hush, the Bellwether */
  const DY = 0.35;                                             // the dock's top
  const RUNK = 6.2, WALKK = 7.5;                               // gait phase per metre travelled, so the feet keep (roughly) to the planks
  const ANCHOR_X = 6.2, ANCHOR_Z = 1.4, AK = 1.3;              // where the old anchor stands, and its size against its bearer
  const angF = (a, flip) => (flip ? PI - a : a);               // an angle in a figure's facing space, on screen
  const bobOf = (ph) => { const s = Math.abs(Math.sin(ph)); return s > 0.75 ? 1 : s < 0.3 ? -1 : 0; };

  // ---------------------------------------------------------------- props and helpers for this act
  // the anchor, drawn into the sprite canvas at scale k: its ring at (x, y), its flukes out along ang
  function drawAnchorK(x, y, ang, glowA, k) {
    const ca = Math.cos(ang), sa = Math.sin(ang), L = 20 * k, ex = x + ca * L, ey = y + sa * L;
    const iron = glowA ? C('teal', 6) : C('stone', 4), ironL = glowA ? C('teal', 7) : C('stone', 6), ironD = glowA ? C('teal', 4) : C('stone', 2);
    sLine(x - ca * 3 * k, y - sa * 3 * k, ex, ey, iron, 3, 2); sLine(x - ca * 2 * k, y - sa * 2 * k, ex - ca * 3, ey - sa * 3, ironL, 1, 2);
    const rx = x - ca * 6.5 * k, ry = y - sa * 6.5 * k; for (let a = 0; a < TAU; a += 0.12) sp(rx + Math.cos(a) * 2.8 * k, ry + Math.sin(a) * 2.8 * k, a > 2 && a < 4.5 ? ironD : iron, 2);
    sLine(x + ca * k - sa * 7 * k, y + sa * k + ca * 7 * k, x + ca * k + sa * 7 * k, y + sa * k - ca * 7 * k, ironD, 2, 2);
    for (let q = -11 * k; q <= 11 * k; q += 0.5) { const b = q * q / (11 * k) * 0.45, bx = ex - ca * b - sa * q, by = ey - sa * b + ca * q; sp(bx + ca, by + sa, ironD, 2); sp(bx, by, iron, 2); sp(bx - ca, by - sa, ironL, 2); }
    for (const s of [-1, 1]) {
      const tq = 11 * k * s, b = 11 * k * 0.45, fx = ex - ca * b - sa * tq, fy = ey - sa * b + ca * tq;
      sPoly([[fx + ca * 1.5, fy + sa * 1.5], [fx - ca * 6 * k - sa * s * 1.2, fy - sa * 6 * k + ca * s * 1.2], [fx - sa * s * 3.6 * k, fy + ca * s * 3.6 * k]], ironL, 2);
    }
    if (!glowA) { for (let q = 0; q < 6; q++) { const u = 0.15 + q * 0.14; sp(x + ca * L * u + (q & 1 ? -sa : sa), y + sa * L * u + (q & 1 ? ca : -ca), C('wood', 3), 2); } sp(ex - sa * 6 * k, ey + ca * 6 * k, C('moss', 5), 2); sp(ex + sa * 5 * k, ey - ca * 5 * k, C('moss', 4), 2); }
  }
  // the anchor in a bearer's hand (r from actor3), at the bearer's own pixel scale; ang on screen
  function heldAnchor(r, ang, glowA, behind) {
    if (!r || !r.hand) return null;
    const S = r.S, hx = Math.round(r.hand[0]), hy = Math.round(r.hand[1]);
    clearSprite(); drawAnchorK(30, 20, ang, glowA, AK); outlineSprite();
    stamp(hx, hy + Math.round(40 * S), S, 0, false, { z: r.z + (behind ? 0.06 : -0.06), fog: true, keepMask: true });
    const L = (20 + 5) * AK * S;
    return { x: hx, y: hy, tip: [hx + Math.cos(ang) * L, hy + Math.sin(ang) * L], L, S };
  }
  // the anchor standing (or lying) on its own: its ring at world (x, y, z)
  function anchorAt3(x, y, z, ang, glowA) {
    const p = proj(x, y, z); if (!p) return null; const S = snapS(CAM.F / p.z / 26); if (S > 12) return null;
    const px = Math.round(p.x), py = Math.round(p.y), pz = p.z;
    clearSprite(); drawAnchorK(30, 20, ang, glowA, AK); outlineSprite(); clearMask();
    stamp(px, py + Math.round(40 * S), S, 0, false, { z: pz, fog: true });
    return { x: px, y: py, S, z: pz, tip: [px + Math.cos(ang) * 25 * AK * S, py + Math.sin(ang) * 25 * AK * S] };
  }
  // a figure turned about its feet (lying, toppling) or about its middle (tumbling through the air)
  function atFeet(who, o, x, y, z, ang, opt) {
    opt = opt || {}; const p = proj(x, y, z); if (!p) return null;
    const S = snapS(CAM.F / p.z * (opt.size || 1) / 26); if (S > 12) return null;
    const pz = p.z, px = p.x, py = p.y;
    if (opt.gy !== undefined) contactShadow(opt.sx === undefined ? x : opt.sx, opt.gy, z, opt.sr || 0.6, 0.5);
    return Object.assign(actor(who, o, Math.round(px), Math.round(py), S, Object.assign({ z: pz, fog: true, ang: ang || 1e-6 }, opt)), { z: pz });
  }
  function spin(who, o, cx, cy, cz, ang, opt) {
    opt = opt || {}; const p = proj(cx, cy, cz); if (!p) return null;
    const S = snapS(CAM.F / p.z * (opt.size || 1) / 26); if (S > 12) return null;
    const pz = p.z, px = p.x, py = p.y, h = 22 * S;
    if (opt.gy !== undefined) { const hgt = Math.max(0, cy - 0.8 - opt.gy); if (hgt < 6) contactShadow(cx, opt.gy, cz, 0.45 + hgt * 0.05, 0.5 * (1 - hgt / 6)); }
    return Object.assign(actor(who, Object.assign({ air: true }, o), Math.round(px - Math.sin(ang) * h), Math.round(py + Math.cos(ang) * h), S, Object.assign({ z: pz, fog: true, ang: ang || 1e-6 }, opt)), { z: pz, cx: px, cy: py });
  }
  // a fish: a chunky silver body, a dark back, a forked tail (screen space, s = half length in pixels)
  function fishAt(px, py, pz, s, a, flop) {
    const ca = Math.cos(a), sa = Math.sin(a);
    for (const pass of [0, 1]) {
      const g = pass ? 0 : 1;
      for (let k = -s - g; k <= s + g; k += 0.5) { const w = Math.sqrt(Math.max(0, 1 - (k / (s + g)) ** 2)) * (s * 0.36 + g); for (let j = -w; j <= w; j += 0.5) PZ(px + ca * k - sa * j, py + sa * k + ca * j, pass ? (j < -w * 0.25 ? C('sea', 3) : j > w * 0.45 ? C('hush', 5) : C('stone', 6)) : C('night', 1), pz - 0.05 - pass * 0.001); }
      const tx = px - ca * (s + 0.5), ty = py - sa * (s + 0.5), f = 1 + (flop || 0) * 0.5;
      for (let j = -s * 0.5 * f - g; j <= s * 0.5 * f + g; j += 0.5) lineF(tx, ty, tx - ca * (Math.abs(j) * 0.8 + 1 + g) - sa * j, ty - sa * (Math.abs(j) * 0.8 + 1 + g) + ca * j, (x, y) => PZ(x, y, pass ? C('stone', 4) : C('night', 1), pz - 0.05 - pass * 0.001));
    }
    PZ(px + ca * s * 0.62 + sa, py + sa * s * 0.62 - ca, C('night', 0), pz - 0.06); PZ(px + ca * s * 0.62 + sa * 2, py + sa * s * 0.62 - ca * 2, WHITE, pz - 0.06);
  }
  function fish3(x, y, z, a, flop) { const p = proj(x, y, z); if (!p) return; fishAt(p.x, p.y, p.z, Math.max(2, Math.min(10, CAM.F / p.z * 0.17)), a, flop); }
  // a ring of dust rolling out along the planks from (x, z), g seconds old
  function dust3(x, z, g, size, seed, y0) {
    if (g < 0 || g > 1.5) return; size = size || 1; y0 = y0 === undefined ? DY : y0;
    const n = fl(10 + 8 * size), fade = 1 - g / 1.5;
    for (let k = 0; k < n; k++) {
      const a = ih(k, 1, seed) * TAU, v = (0.7 + ih(k, 2, seed) * 0.9) * size, r = v * eoc(g / 1.2);
      const px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r * 0.85, py = y0 + 0.08 + g * 0.35 * (0.4 + ih(k, 3, seed)) * size;
      const p = proj(px, py, pz); if (!p) continue;
      const rad = Math.min(40, (0.1 + 0.16 * eoc(g / 0.8)) * Math.sqrt(size) * CAM.F / p.z * (0.6 + ih(k, 4, seed) * 0.7));
      for (let yy = -rad; yy <= rad; yy++) for (let xx = -rad; xx <= rad; xx++) {
        const d = Math.hypot(xx, yy) / rad; if (d > 1) continue; const X = fl(p.x + xx), Y = fl(p.y + yy * 0.75); if (X < 0 || Y < LB || X >= W || Y >= H - LB) continue;
        if (bay(X, Y) > fade * (1.15 - d)) continue; const i = Y * W + X; if (ZB[i] < p.z - 0.4) continue;
        BUF[i] = yy < -rad * 0.3 ? C('linen', 6) : d < 0.6 ? C('linen', 5) : C('wood', 5);
      }
    }
  }
  // splinters: boards flung up from (x, y, z), tumbling, landing flat on the deck and staying there
  function plank3(x, y, z, L, w, rot, flat, ramp, s0) {
    const c = Math.cos(rot), s = Math.sin(rot), sh = (u, v, xx, yy) => shadeC(ramp === undefined ? R.wood : ramp, (s0 || 3.4) + (v < 0.03 ? -1.4 : 0.4), xx, yy);
    if (flat) poly3([[x - c * L / 2 + s * w, y, z - s * L / 2 - c * w], [x + c * L / 2 + s * w, y, z + s * L / 2 - c * w], [x + c * L / 2 - s * w, y, z + s * L / 2 + c * w], [x - c * L / 2 - s * w, y, z - s * L / 2 + c * w]], sh, { two: true });
    else poly3([[x - c * L / 2 + s * w, y - s * L / 2 - c * w, z], [x + c * L / 2 + s * w, y + s * L / 2 - c * w, z], [x + c * L / 2 - s * w, y + s * L / 2 + c * w, z], [x - c * L / 2 - s * w, y - s * L / 2 + c * w, z]], sh, { two: true });
  }
  function planks3(x, y, z, g, n, pow, seed, ramp, floor) {
    if (g < 0) return; floor = floor === undefined ? DY : floor;
    for (let k = 0; k < n; k++) {
      const a = ih(k, 1, seed) * TAU, v = (0.6 + ih(k, 2, seed) * 1.8) * pow, vy = (2.2 + ih(k, 3, seed) * 3.6) * pow;
      const L = 0.22 + ih(k, 4, seed) * 0.4, w = 0.035 + ih(k, 5, seed) * 0.03;
      const tl = (vy + Math.sqrt(vy * vy + 2 * 9.8 * Math.max(0, y - floor))) / 9.8, gg = Math.min(g, tl), landed = g >= tl;
      let px = x + Math.cos(a) * v * gg, pz = z + Math.sin(a) * v * gg * 0.6, py = y + vy * gg - 4.9 * gg * gg;
      if (Math.abs(pz) > 4.05 && floor === DY) { if (landed) continue; }          // off the edge: gone into the sea
      if (landed) { py = floor + 0.02; }
      plank3(px, py, pz, L, landed ? w * 2.4 : w, landed ? ih(k, 6, seed) * PI : ih(k, 6, seed) * TAU + gg * (7 + ih(k, 7, seed) * 9) * (k & 1 ? 1 : -1), landed, ramp, 2.8 + ih(k, 8, seed) * 1.4);
    }
  }
  // rings spreading on the water
  function ripple3(x, z, g, size) {
    if (g < 0 || g > 2.2) return; size = size || 1;
    for (let r = 0; r < 3; r++) { const gg = g - r * 0.25, rad = (0.25 + gg * 1.6) * size; if (gg <= 0) continue; for (let a = 0; a < TAU; a += 0.05) { if (bay(fl(a * 31), r * 3) > 1 - g / 2.2) continue; p3(x + Math.cos(a) * rad, HWY + 0.02, z + Math.sin(a) * rad * 0.9, r ? C('sea', 6) : C('hush', 4), 0.05); } }
  }
  // a warden fallen in, splashing about with only a head and an arm out of the water
  function swimmer(t, x, z, k, frozen) {
    const tt = frozen === undefined ? t : Math.min(t, frozen), b = Math.sin(tt * 3.1 + k) * 0.07;
    actor3('warden', { view: 'front', eyes: 'wide', armF: -1.2 + Math.sin(tt * 9 + k) * 0.6, armL: -1.9 - Math.sin(tt * 8 + k) * 0.5, bob: 0 }, x, HWY - 0.95 + b, z, { shadow: false });
    for (let q = 0; q < 10; q++) { const u = frac(ih(q, 1, 990 + k) + tt * 1.3); p3(x + (ih(q, 2, 990 + k) - 0.5) * 1.0, HWY + 0.1 + Math.sin(u * PI) * 0.5, z - 0.2 + (ih(q, 3, 990 + k) - 0.5) * 0.4, q & 1 ? WHITE : C('sea', 7), 0.07); }
  }
  // little musical notes from a whistler (screen space)
  const NOTE = ['.##', '.#.', '.#.', '##.', '##.'];
  function notes(x, y, t, t0, t1) { for (let k = 0; k < 4; k++) { const u = frac((t - t0) * 0.7 + k * 0.25); if (t < t0 + k * 0.35 || t > t1 + 0.6) continue; const nx = x + u * 26 + Math.sin(u * 9 + k) * 3, ny = y - u * 30; if (bay(fl(nx), fl(ny)) > 1.1 - u) continue; for (let j = 0; j < 5; j++) for (let i = 0; i < 3; i++) if (NOTE[j][i] === '#') { P(nx + i, ny + j, k & 1 ? C('teal', 6) : C('linen', 7)); } } }
  // a zig-zag bolt of lightning between two screen points
  function bolt(x0, y0, x1, y1, t, seed, c0, c1) { let px = x0, py = y0; const n = 7; for (let k = 1; k <= n; k++) { const u = k / n, j = k === n ? 0 : (ih(k, fl(t * 30), seed) - 0.5) * 14; const nx = lerp(x0, x1, u) - (y1 - y0) / Math.hypot(x1 - x0, y1 - y0 || 1) * j, ny = lerp(y0, y1, u) + (x1 - x0) / Math.hypot(x1 - x0, y1 - y0 || 1) * j; lineF(px, py, nx, ny, (x, y) => { P(x, y, c0); P(x + 1, y, c1); }); px = nx; py = ny; } }
  // dizzy stars round a head
  function dizzy(x, y, r, t) { for (let k = 0; k < 3; k++) { const a = t * 5 + k * TAU / 3; sparkle(Math.round(x + Math.cos(a) * r), Math.round(y + Math.sin(a) * r * 0.35), 2, WHITE, C('gold', 6)); } }
  // the hit-stop of this cut: the action's clock holds for d after each hit, then snaps on (beats stay where the audio has them)
  function hold(t, hits, d) { for (const h of hits) if (t >= h && t < h + d) return [h, true]; return [t, false]; }

  // ---------------------------------------------------------------- the Hush, painted: drained places become a pencil sketch on pale paper
  const SKB = new Uint8Array(NP);
  function sketchOver(amt, t, glyphs) {
    SKB.set(BUF);
    for (let y = LB; y < H - LB; y++) for (let x = 0; x < W; x++) {
      const a = amt(x, y); if (a <= 0) continue;
      const i = y * W + x, l = LUM[SKB[i]];
      if (a >= 0.85) {
        const lr = x < W - 1 ? LUM[SKB[i + 1]] : l, ld = y < H - 1 ? LUM[SKB[i + W]] : l, e = Math.max(Math.abs(l - lr), Math.abs(l - ld));
        if (e > 52) { BUF[i] = e > 90 ? C('night', 4) : C('stone', 5); continue; }
        // shading as hatching: the darker the old colour, the denser the pencil strokes
        const dk = 1 - l / 255, jit = (ih(x >> 3, y >> 3, 61) * 3) | 0;
        if ((dk > 0.42 && (x + y + jit) % 5 === 0) || (dk > 0.66 && (x - y + 400 + jit) % 5 === 0) || (dk > 0.84 && (x + jit) % 3 === 0)) { BUF[i] = C('stone', dk > 0.75 ? 4 : 5); continue; }
        BUF[i] = shadeC(R.hush, 3.0 + l / 255 * 4.4, x, y);
        continue;
      }
      tintI(i, x, y, T_HUSH, a);
      if (glyphs && a > 0.4 && ih(x >> 1, y >> 1, fl(t * 14)) < 0.035) BUF[i] = ih(x, y, 3) < 0.7 ? WHITE : C('crimson', 5);
    }
  }
  function sketchWorld(t, amount, glyphs) { sketchOver((x, y) => { const p = worldAt(y * W + x, x, y); return amount(p[0], p[1], p[2], x, y); }, t, glyphs); }

  // ---------------------------------------------------------------- the morning harbour, with whatever has changed by time t
  const HUSH_T = 228.5;                                        // the moment everything stops
  function harbour(t, opt) {
    opt = opt || {};
    drawHarbour(t, Object.assign({ lights: [], freeze: t > HUSH_T ? HUSH_T : undefined, keeperGone: true }, opt));
    ink(2);
    if (!opt.noGulls) gulls(t, 12, 2, 7, 16, t > HUSH_T ? HUSH_T : undefined);
  }
  // the hush over the harbour: first a faint chill, then a ring spreading from under the sigil
  const HUSH_O = [40, 0, 62], hushR = (t) => Math.min(60, Math.max(0, (t - 246.0) * 6));
  function harbourHush(t, extra) {
    if (t < HUSH_T) return;
    const R0 = hushR(t), chill = 0.16 * lin(HUSH_T, 231, t);
    sketchWorld(t, (wx, wy, wz) => {
      const d = Math.hypot(wx - HUSH_O[0], wz - HUSH_O[2]);
      let a = chill;
      if (R0 > 0) a = Math.max(a, d < R0 - 3 ? 1 : d < R0 ? 0.55 : 0);
      if (extra) a = Math.max(a, extra(wx, wy, wz));
      return a;
    }, R0 > 0);
  }

  // ---------------------------------------------------------------- 24 — the dock at morning: Tamo and a crate; something falls out of the sky onto him (2:56)
  const IMPACT = 178.0, IX = -3.0, IZ = 0.4;
  const TWALK = K({ t: 176.0, x: -6.7 }, { t: 177.45, x: -3.55, e: 'l' }, { t: 177.85, x: -3.05, e: 'o' });
  // the last fish, thrown straight up by the crash, comes down on his face at 180.5
  const FISH_UP = 180.5;
  function crateFish(t, skip0) {
    const g = t - IMPACT - 0.1; if (g < 0) return;
    for (let k = 1; k < 10; k++) {
      const a = ih(k, 1, 401) * TAU, vh = 0.8 + ih(k, 2, 401) * 2.0, vy = 2.6 + ih(k, 3, 401) * 3.2, y0 = DY + 0.8;
      const tl = (vy + Math.sqrt(vy * vy + 2 * 9.8 * (y0 - DY - 0.06))) / 9.8, gg = Math.min(g, tl);
      const x = IX + 0.35 + Math.cos(a) * vh * gg, z = IZ + Math.sin(a) * vh * gg * 0.5, y = y0 + vy * gg - 4.9 * gg * gg;
      if (Math.abs(z) > 4.0) continue;
      const landed = g >= tl, f = landed ? Math.sin(t * (14 + k) + k) * Math.max(0.2, 1 - (g - tl) * 0.3) : 0;
      fish3(x, landed ? DY + 0.07 + Math.abs(f) * 0.06 : y, z, landed ? ih(k, 4, 401) * 0.6 - 0.3 + f * 0.3 : gg * 9 + k, f);
    }
  }
  function fishUp(t) { const g = t - IMPACT - 0.1; if (g < 0 || t >= FISH_UP) return; const u = g / (FISH_UP - IMPACT - 0.1); fish3(lerp(IX + 0.35, IX - 0.7, u), DY + 0.8 + 12.0 * g - 4.9 * g * g, IZ, g * 7, 0); }
  function crateWreck(t) { planks3(IX + 0.35, DY + 0.75, IZ, t - IMPACT - 0.1, 14, 1.0, 402); crateFish(t); }
  shot(176.0, 182.0, (lt, t) => {
    const g = t - IMPACT, ge = g - 0.1;
    const wide = t < 178.45;
    if (wide) { const cx = lerp(-6.4, -3.0, sstep(176.0, 177.9, t)), up = sstep(177.35, 177.85, t) * (1 - sstep(178.05, 178.4, t)); lookAt(cx - 1.4, 1.8, -9.2, cx + 0.5 + up * 0.6, 1.3 + up * 0.9, IZ + 0.4, 46); }
    else { const u = lin(178.45, 182, t); lookAt(IX - 2.6 + u * 0.5, 1.55, -6.6 + u * 0.8, IX + 0.35, 1.2, IZ + 0.3, 46); }
    harbour(t);
    if (g < 0) {
      // he walks along whistling, a crate hugged to his chest; a shadow grows round him and he looks up
      const x = trk(TWALK, t).x, walking = t < 177.8, ph = x * WALKK, bob = walking ? bobOf(ph) : 0, look = sstep(177.48, 177.66, t), up = sstep(177.82, 177.95, t);
      const r = actor3('tamo', { view: 'side', walk: walking ? ph : undefined, bob, armF: lerp(0.05, -1.25, up), armB: lerp(0.25, -1.2, up), eyes: look > 0.5 ? 'wide' : 'closed', brows: look > 0.5 ? 'up' : 'n', smile: look > 0.5 ? 0 : 0.7, mouth: look > 0.5 ? 0.75 : 0.22, lean: -1.6 * look }, x, DY, IZ, {});
      crate3(x + 0.4 - look * 0.08, DY + 0.32 - bob / 26 + up * 0.75, IZ, 0.52);
      if (r && look < 0.5) notes(r.head[0] + 10 * r.S, r.head[1] + 2 * r.S, t, 176.2, 177.5);
      // the fall: a streak out of the sky with a girl at the head of it, and her shadow on the planks
      const u = lin(177.4, IMPACT, t);
      if (u > 0) {
        const e = (q) => Math.pow(q, 1.25), fx = (q) => lerp(IX + 6.0, IX + 0.1, e(q)), fy = (q) => lerp(8.5, DY + 1.1, e(q)), fz = (q) => lerp(IZ + 2.5, IZ, e(q));
        contactShadow(IX + 0.1, DY, IZ, 0.15 + u * 0.75, 0.8 * Math.min(1, u * 1.4));
        let pp = null; for (let j = 14; j >= 0; j--) { const q = Math.max(0, u - j * 0.03), p = proj(fx(q), fy(q), fz(q)); if (!p) continue; const c = [p.x, p.y]; if (pp) { const w = Math.max(1.5, 8 - j * 0.45); lineF(pp[0], pp[1], c[0], c[1], (xx, yy) => { for (let d = -w; d <= w; d++) if (bay(xx + d, yy) < 1.1 - j / 15) P(xx + d, yy, Math.abs(d) < w * 0.3 ? WHITE : Math.abs(d) < w * 0.65 ? C('gold', 6) : C('indigo', 5)); }); } pp = c; }
        spin('kaira', { view: 'front', eyes: 'wide', brows: 'worried', mouth: 0.8, armF: -1.7 + Math.sin(t * 30) * 0.2, armL: -1.4, wind: 7, seed: 0.6 }, fx(u), fy(u), fz(u), Math.PI + 0.75, { gy: DY });
        const hp = proj(fx(u), fy(u), fz(u)); if (hp) glow(hp.x, hp.y, 26, T_GOLD, 0.45);
      }
    } else {
      // the pile-up: Tamo flat on his back, the girl sat on top of him seeing stars; fish raining down
      const sit = eob(lin(181.1, 181.6, t)), front = t > 181.62;
      crateWreck(t); fishUp(t);
      dust3(IX, IZ, ge, 1.5, 403);
      let rT;
      const tamoO = { view: 'side', bob: 0, eyes: t > FISH_UP && t < 181.2 ? 'wide' : 'closed', brows: 'worried', mouth: t > FISH_UP && t < 181.0 ? 0.6 : 0.3, armF: lerp(-2.7, 1.2, sit), armB: lerp(-2.3, 1.9, sit), stride: (t > 179.3 && t < 179.5) || (t > 179.9 && t < 180.05) ? 1.5 : 0 };
      if (front) rT = actor3('tamo', { view: 'front', crouch: 1.2, eyes: 'narrow', brows: 'angry', smile: -0.6, armF: 1.3, armL: 1.9, bob: 0 }, IX, DY, IZ, {});
      else rT = atFeet('tamo', tamoO, lerp(IX + 0.45, IX, sit), lerp(DY + 0.38, DY, Math.min(1, sit)), IZ, lerp(-PI / 2, -0.05, Math.min(1, sit)), { gy: DY, sx: IX - 0.2, sr: 0.9 });
      // the fish that went up comes down on his face, and stays on his head
      if (rT && t >= FISH_UP) { const a = front ? 0 : lerp(-PI / 2, 0, Math.min(1, sit)), hx = rT.head[0] + Math.sin(a) * 10 * rT.S, hy = rT.head[1] - Math.cos(a) * 10 * rT.S - (front ? 2 * rT.S : 0); fishAt(hx, hy, rT.z - 0.1, 8 * rT.S / 3, a + (front ? 0.15 : 0) + Math.sin(t * 20) * 0.05, Math.sin(t * 22)); }
      if (t >= FISH_UP && t < FISH_UP + 0.3 && rT) { const p = rT.head; for (let k = 0; k < 10; k++) { const a = -PI * ih(k, 1, 405), v = 30 + ih(k, 2, 405) * 50, gg = t - FISH_UP; P(p[0] - 10 * rT.S + Math.cos(a) * v * gg, p[1] + Math.sin(a) * v * gg + 120 * gg * gg, k & 1 ? WHITE : C('sea', 7)); } }
      // her: squashed by the landing, dazed, then a hop off him onto her knees
      const hop = lin(181.0, 181.35, t);
      if (hop <= 0) {
        const rK = actor3('kaira', { view: 'front', crouch: g < 0.15 ? 1.6 : g < 0.3 ? 0.6 : 1.0, eyes: t > 180.8 ? 'open' : 'closed', brows: 'worried', mouth: t > 180.8 ? 0.2 : 0.35, armF: g < 0.3 ? -0.8 : 0.5, armL: g < 0.3 ? -2.2 : 2.6, look: t > 180.8 ? (t < 180.9 ? -2 : 2) : Math.sin(t * 5) * 1.4, wind: 1, seed: 0.5, bob: 0 }, IX - 0.12, DY + 0.6, IZ - 0.12, { shadow: false });
        if (rK && g > 0.4 && t < 180.85) dizzy(rK.head[0], rK.head[1] - 12 * rK.S, 9 * rK.S, t);
      } else if (hop < 1) {
        actor3('kaira', { view: 'side', air: true, eyes: 'open', brows: 'worried', armF: -1.0, wind: 3, seed: 0.5 }, lerp(IX - 0.12, IX + 1.6, hop), lerp(DY + 0.6, DY, hop) + Math.sin(hop * PI) * 0.55, lerp(IZ - 0.12, IZ + 0.2, hop), { flip: true, gy: DY });
      } else {
        const sq = lin(181.35, 181.6, t);
        actor3('kaira', { view: 'side', kneel: sq >= 1, crouch: sq < 1 ? lerp(1.4, 0.4, sq) : 0, eyes: 'open', brows: 'worried', armF: -2.0, smile: 0.2, seed: 0.5, blade2: 2.4, bob: 0 }, IX + 1.6, DY, IZ + 0.2, { flip: true });
      }
      if (g < 0.5) { const p = proj(IX, DY + 0.8, IZ); if (p) hitFx(p.x, p.y, g, 1.5, [WHITE, C('gold', 6)]); }
      if (!wide && t < 178.6) shk(3);
    }
  });

  // ---------------------------------------------------------------- 25 — "that was the GOOD crate!" / "you should run" / "run from wh—" THUD THUD THUD (3:02)
  const THUDS = [188.6, 188.8, 189.0], WDX = [-7.2, -6.2, -5.2], WDZ = [1.6, 2.1, 2.6];
  // the wreck as it lies on the planks
  function wreckRest(t) { crateWreck(t); }
  function fishOnHead(r, t, extra) { if (!r) return; fishAt(r.head[0] + r.S, r.head[1] - 12 * r.S - (extra || 0), r.z - 0.1, 8 * r.S / 3, 0.15 + Math.sin(t * 20) * 0.05, Math.sin(t * 22)); }
  function wardenDrop(t, k, x, z, opt) {
    opt = opt || {}; const g = t - THUDS[k];
    if (g < -0.6) return null;
    if (g < 0) {
      const y = DY + (-g) * 30, p = proj(x, y, z), q = proj(x, y + 6, z);
      if (p && q) lineF(q.x, q.y, p.x, p.y, (xx, yy, u) => { if (bay(xx, yy) < u) { P(xx - 1, yy, C('indigo', 6)); P(xx, yy, WHITE); P(xx + 1, yy, C('linen', 6)); } });
      return actor3('warden', { view: 'front', air: true, spear: -1.5, armL: -2.0 }, x, y, z, { gy: DY });
    }
    const land = eoc(lin(0, 0.35, g));
    if (g < 0.3) { const p = proj(x, DY, z); if (p) shockRing(p.x, p.y, 3 + g * 110, 1 + g * 26, 2, [WHITE, C('linen', 6), C('linen', 4)], 1 - g / 0.3); shk(3 * (1 - g / 0.3)); }
    dust3(x, z, g, 0.9, 411 + k); planks3(x, DY, z, g, 2, 0.5, 415 + k);
    return actor3('warden', Object.assign({ view: 'front', crouch: g < 0.35 ? 1.4 * (1 - land) : 0, spear: lerp(-1.5, -1.25, land), armL: 1.9, bob: g < 0.35 ? 0 : undefined }, opt.pose || {}), x, DY, z, opt.o || {});
  }
  shot(182.0, 197.0, (lt, t) => {
    if (t < 187.5) {
      // the two of them sat in the wreck: a slow push in
      const u = lin(182, 187.5, t);
      lookAt(-2.3, 1.35, -6.6 + u * 0.7, -2.25, 0.98, 0.5, 46);
      harbour(t); wreckRest(t);
      const tk = talking('tamo', t), good = t > 183.35 && t < 184.0, point = t > 184.0 && t < 184.6;
      const rT = actor3('tamo', {
        view: 'front', crouch: 1.2, eyes: blink(t, 21) ? 'closed' : t > 186.2 ? 'wide' : 'open', brows: t > 186.2 ? 'up' : 'angry', mouth: mouth('tamo', t), smile: -0.6,
        armF: good ? -0.9 + Math.sin(t * 22) * 0.25 : tk ? -0.3 + Math.sin(t * 9) * 0.5 : point ? 0.2 : t > 184.6 ? 2.6 : 1.3, armL: good ? -2.2 - Math.sin(t * 22) * 0.25 : t > 184.6 ? 0.55 : 1.9,
        look: t < 182.5 ? (fl(t * 8) % 2 ? 1 : -1) : t > 184.6 ? 1 : 0, bob: good ? (fl(t * 12) % 2 ? -1 : 0) : undefined,
      }, IX, DY, IZ, {});
      fishOnHead(rT, t, good ? 2 : 0);
      // Kaira: sheepish on her knees; she springs up; "Sorry! Not sorry! You should run."
      const pop = lin(184.72, 184.95, t), land = lin(184.95, 185.15, t), fr = t > 184.82;
      const sorry = t > 185.0 && t < 185.6, notS = t > 185.6 && t < 186.2, run = t > 186.2 && t < 187.3;
      const kO = fr ? {
        view: 'front', crouch: land < 1 ? 0.8 * (1 - land) : sorry ? 0.4 : 0, air: pop > 0 && pop < 1, eyes: blink(t, 22) ? 'closed' : notS ? 'narrow' : 'open', brows: run ? 'up' : sorry ? 'worried' : 'n',
        mouth: mouth('kaira', t), smile: notS ? 0.9 : 0.3, armF: sorry ? 2.4 : notS ? -0.7 : run ? 1.2 : 1.25, armL: sorry ? 0.75 : run ? PI + 0.35 : 1.9, seed: 0.5, blade2: 2.4, look: run ? -2 : 0, bob: sorry ? 1 : undefined,
      } : { view: 'side', kneel: t < 184.6, crouch: t < 184.6 ? 0 : 1.3, eyes: blink(t, 22) ? 'closed' : 'open', brows: 'worried', smile: 0.3, armF: -2.0 + Math.sin(t * 6) * 0.15, seed: 0.5, blade2: 2.4, mouth: 0, bob: 0 };
      actor3('kaira', kO, IX + 1.6, DY + (pop > 0 && pop < 1 ? Math.sin(pop * PI) * 0.22 : 0), IZ + 0.2, { flip: !fr, gy: DY });
    } else if (t < 189.4) {
      // Tamo, closer: "run from wh—" … and three shapes land behind him
      lookAt(0.3, 1.4, -4.4, -4.35, 1.1, 1.6, 46);
      harbour(t); wreckRest(t);
      for (let k = 0; k < 3; k++) wardenDrop(t, k, WDX[k], WDZ[k]);
      const jump = t > 188.6 && t < 188.78 ? Math.sin(lin(188.6, 188.78, t) * PI) * 0.12 : 0, startled = t > 188.6;
      const rT = actor3('tamo', { view: 'front', crouch: 1.2, eyes: startled ? 'wide' : blink(t, 21) ? 'closed' : 'narrow', brows: startled ? 'up' : 'angry', mouth: startled ? 0.5 : mouth('tamo', t), smile: -0.4, armF: t < 188.5 ? 0.35 : 1.0, armL: t < 188.5 ? 2.75 : 2.2, look: startled ? -2 : 1, bob: 0 }, IX, DY + jump, IZ, { gy: DY });
      fishOnHead(rT, t, jump > 0 ? 0 : 0);
    } else if (t < 191.6) {
      // over his shoulder, low: the three of them; the spears come down together, and a step
      const u = lin(189.4, 191.6, t);
      lookAt(0.6 + u * 0.2, 1.15, -3.3 + u * 0.3, -6.6, 1.25, 1.2, 46);
      harbour(t); wreckRest(t);
      const rise = sstep(189.75, 189.9, t), lower = eoc(lin(189.95, 190.15, t)), step = sstep(190.6, 191.0, t);
      for (let k = 0; k < 3; k++) {
        const x = WDX[k] + step * 0.35, ph = (x - WDX[k]) * WALKK * 2 + (k & 1) * PI;
        actor3('warden', { view: 'front', spear: lower > 0 ? lerp(-1.75, -0.55, lower) : lerp(-1.25, -1.75, rise), armL: 1.9 - lower * 0.4, walk: step > 0 && step < 1 ? ph : undefined, eyes: 'open' }, x, DY, WDZ[k], { rim: { side: 1, T: T_GOLD, a: 0.3 } });
        if (lower > 0 && lower < 1) { const p = proj(x, DY + 1.0, WDZ[k]); if (p && k === 1) for (let q = 0; q < 6; q++) P(p.x + 20 + q * 3, p.y - 14 + q * 2, WHITE); }
      }
      actor3('tamo', { view: 'back', crouch: 1.2, bob: 0 }, IX, DY, IZ, { dark: 1 });
    } else {
      // "three grown-ups… against one girl?" — he gets up, flicks the fish away, and walks off toward the anchor
      const cx = lerp(-3.7, -0.6, sstep(194.9, 197.3, t));
      lookAt(cx, 1.6, -8.3, cx, 1.0, 1.0, 50);
      harbour(t); wreckRest(t);
      for (let k = 0; k < 3; k++) {
        const turn = t > 195.2 + k * 0.15;
        actor3('warden', { view: turn ? 'side' : 'front', spear: turn ? 0.15 : -0.55, armL: 1.5, eyes: 'open' }, WDX[k] + 0.35, DY, WDZ[k], { flip: false });
      }
      const ant = lin(192.0, 192.25, t), push = lin(192.25, 192.6, t), settle = lin(192.6, 192.85, t);
      const crouch = t < 192.0 ? 1.2 : ant < 1 ? lerp(1.2, 1.6, ant) : push < 1 ? lerp(1.6, 0, eoc(push)) : settle < 1 ? Math.sin(settle * PI) * 0.35 : 0;
      const hopY = push > 0 && push < 1 ? Math.sin(push * PI) * 0.1 : 0;
      const WK = K({ t: 195.0, x: IX }, { t: 195.45, x: IX + 0.55, e: 'i' }, { t: 197.0, x: IX + 4.0, e: 'l' }), tx = trk(WK, t).x, walking = t > 195.0;
      const flick = lin(193.55, 193.85, t), roll = t > 194.2 && t < 194.9;
      const side = t > 194.85;
      const tO = side ? { view: 'side', walk: walking ? (tx - IX) * WALKK : undefined, eyes: blink(t, 23) ? 'closed' : 'narrow', brows: 'angry', smile: 0.5, mouth: 0 }
        : { view: 'front', crouch, eyes: blink(t, 23) ? 'closed' : 'narrow', brows: 'angry', mouth: mouth('tamo', t), smile: t > 194.0 ? 0.6 : 0,
          armF: flick > 0 && flick < 1 ? lerp(0.4, -1.7, eoc(flick)) : flick >= 1 && t < 194.2 ? -1.5 : roll ? -0.4 + Math.cos((t - 194.2) * 13) * 0.9 : t > 192.9 && t < 193.5 ? 0.6 : 1.3,
          armL: t > 192.9 && t < 193.5 ? PI + 0.1 : t < 192.0 ? 1.9 : 2.0, look: t < 191.9 ? -2 : t < 192.2 ? 2 : t > 192.9 && t < 193.5 ? 2 : 0, bob: ant > 0 && settle < 1 ? 0 : undefined };
      const rT = actor3('tamo', tO, tx, DY + hopY, IZ, { gy: DY });
      if (flick <= 0) fishOnHead(rT, t);
      else if (t < 194.35) { const u = lin(193.7, 194.35, t), p = proj(lerp(IX + 0.05, IX + 1.2, u), lerp(DY + 1.85, DY + 0.2, u) + Math.sin(u * PI) * 1.4, lerp(IZ, 4.6, u)); if (p) fishAt(p.x, p.y, p.z - 0.1, Math.max(3, CAM.F / p.z * 0.17), u * 14, 0); }
      splash3(IX + 1.2, HWY, 4.6, t - 194.35, 0.35); ripple3(IX + 1.2, 4.6, t - 194.35, 0.5);
      // Kaira steps back out of his way and turns to watch him go
      const kz = lerp(IZ + 0.2, IZ + 1.2, sstep(194.5, 195.1, t)), kturn = t > 195.5;
      actor3('kaira', { view: kturn ? 'side' : 'front', walk: t > 194.5 && t < 195.1 ? (kz - IZ) * WALKK : undefined, eyes: blink(t, 24) ? 'closed' : 'wide', brows: 'worried', seed: 0.5, blade2: 2.4, look: t < 193.0 ? -1 : 1, armF: kturn ? 1.3 : 2.4, armL: 0.8 }, IX + 1.6, DY, kz, { flip: false });
    }
  });

  // ---------------------------------------------------------------- 26 — the anchor: "that anchor hasn't moved in a hundred years—" … it moves (3:17)
  const GRIP = 199.5, RIP = 203.0, TAX = ANCHOR_X - 0.62, TAZ = ANCHOR_Z - 0.06;
  const seaPull = (t) => -0.4 - 1.8 * sstep(200.3, 202.8, t) * (t < RIP ? 1 : 0) + (t >= RIP ? -1.8 * (1 - eoc(lin(RIP, RIP + 0.9, t))) + 0.45 * Math.sin(lin(RIP + 0.4, RIP + 1.8, t) * PI) : 0);
  // cracks in the boards round the anchor's foot, growing with the strain
  function cracks(x, z, amt, t) {
    if (amt <= 0) return;
    for (let k = 0; k < 9; k++) { const a = ih(k, 1, 421) * TAU, L = amt * (0.5 + ih(k, 2, 421) * 1.1); let px = x, pz = z; for (let s = 1; s <= 5; s++) { const u = s / 5, nx = x + Math.cos(a + (ih(k, s, 422) - 0.5) * 0.7) * L * u, nz = z + Math.sin(a + (ih(k, s, 423) - 0.5) * 0.7) * L * u * 0.7; l3(px, DY + 0.005, pz, nx, DY + 0.005, nz, C('wood', 0), s < 3 ? 2 : 1); px = nx; pz = nz; } }
  }
  const DOCKER_X = 7.9, DOCKER_Z = 0.1;
  function dockerStack() { crate3(8.7, DY, -0.3, 0.75); crate3(8.65, DY + 0.75, -0.35, 0.6); barrel3(8.9, 0.65, 0.8); }
  shot(197.0, 214.0, (lt, t) => {
    if (t < GRIP) {
      // he strides up to it; the dockhand, leaning on his crates, warns him off
      const cx = lerp(3.4, 5.0, sstep(197.0, 199.2, t));
      lookAt(cx - 0.6, 1.75, -7.4, cx + 0.6, 1.15, 1.0, 52);
      harbour(t);
      anchorAt3(ANCHOR_X, DY + 1.0, ANCHOR_Z, PI / 2, 0);
      dockerStack();
      const dk = talking('docker', t);
      actor3('docker', { view: 'side', eyes: blink(t, 25) ? 'closed' : 'half', mouth: mouth('docker', t), armF: dk && t < 198.4 ? -0.5 + Math.sin(t * 11) * 0.35 : 1.0, armB: 1.6, lean: -1, smile: -0.3 }, DOCKER_X, DY, DOCKER_Z, { flip: true });
      const WK = K({ t: 197.0, x: 1.3, z: 0.6 }, { t: 198.45, x: TAX - 0.45, z: TAZ - 0.05, e: 'l' }, { t: 198.85, x: TAX, z: TAZ, e: 'o' }), w = trk(WK, t), walking = t < 198.8;
      const spit = t > 198.95 && t < 199.15, rub = t > 199.15 && t < 199.32, reach = sstep(199.3, 199.5, t);
      const rT = actor3('tamo', { view: 'side', walk: walking ? (w.x - 1.3) * WALKK : undefined, eyes: 'narrow', brows: 'angry', mouth: spit ? 0.5 : 0, armF: spit ? -0.7 : rub ? -0.1 + Math.sin(t * 40) * 0.25 : walking ? undefined : lerp(1.0, 0.0, reach), armB: rub ? -0.1 - Math.sin(t * 40) * 0.25 : walking ? undefined : lerp(1.6, 0.15, reach), crouch: reach * 0.5, lean: t > 198.85 && t < 198.95 ? 1 : 0, reach: reach * 1.5 }, w.x, DY, w.z, {});
      if (rT && spit) { const p = rT.head; P(p[0] + 9 * rT.S, p[1] + 6 * rT.S, WHITE); }
    } else if (t < RIP + 0.2) {
      // low, close: his grip; the planks groan; the sea draws back out of the harbour
      const sh = sstep(GRIP + 0.1, RIP - 0.1, t), u = t - RIP, push = sstep(GRIP, RIP, t);
      lookAt(ANCHOR_X - 3.1 + push * 0.5, 1.35, -2.9 + push * 0.7, ANCHOR_X - 0.35, 1.05, ANCHOR_Z, 50);
      harbour(t, { waterY: seaPull(t) });
      cracks(ANCHOR_X, ANCHOR_Z, sh * 1.3 + (u > 0 ? 0.5 : 0), t);
      const lift = u > 0 ? eoc(lin(0, 0.2, u)) * 0.7 : sh > 0.75 ? Math.abs(Math.sin(t * 23)) * 0.03 * sh : 0;
      const jit = (ih(fl(t * 30), 1, 7) - 0.5) * 0.025 * sh;
      anchorAt3(ANCHOR_X, DY + 1.0 + lift, ANCHOR_Z, PI / 2 + Math.sin(t * 41) * 0.02 * sh, sh > 0.6 ? 1 : 0);
      const rT = actor3('tamo', { view: 'side', crouch: 0.5 + sh * 0.7 - (u > 0 ? lin(0, 0.15, u) * 0.6 : 0), armF: -0.05 - lift * 0.8, armB: 0.1 - lift * 0.8, reach: 1.5, lean: -1.6 * sh, eyes: sh > 0.7 ? 'glow' : 'narrow', glow: C('teal', 7), brows: 'angry', mouth: sh > 0.4 ? 0.9 : 0, smile: -1, bob: 0 }, TAX + jit, DY, TAZ, { rim: { side: 1, T: T_TEAL, a: sh * 0.8 } });
      if (sh > 0.35) aura(t, [C('teal', 3), C('teal', 5), C('teal', 6), C('teal', 7)], 3 + sh * 7, { sparks: 22 });
      // sweat, and splinters starting out of the cracks
      if (rT && sh > 0.3) for (let k = 0; k < 3; k++) { const g = frac(t * 1.6 + k / 3); P(rT.head[0] - 6 * rT.S - g * 30, rT.head[1] - 6 * rT.S - g * 20 + g * g * 50, C('sea', 7)); }
      for (let k = 0; k < 12 * sh; k++) { const gg = frac(t * 0.9 + ih(k, 1, 424)), a = ih(k, 2, 424) * TAU, r = 0.4 + ih(k, 3, 424) * 1.2 * sh; p3(ANCHOR_X + Math.cos(a) * r, DY + gg * 1.4 * (0.5 + ih(k, 4, 424)), ANCHOR_Z + Math.sin(a) * r * 0.7, gg < 0.5 ? C('wood', 5) : C('teal', 6), 0.05); }
      // water climbing out of the sea in strands, winding in toward the anchor
      for (let k = 0; k < 110 * sh; k++) { const ph = ih(k, 1, 411) * TAU + t * 1.8, rr = 2.5 + ih(k, 2, 411) * 5 - (t - GRIP) * 0.5, fy = frac(ih(k, 3, 411) + t * 0.45); p3(ANCHOR_X + Math.cos(ph) * Math.max(0.6, rr), lerp(seaPull(t), DY + 2.4, fy), ANCHOR_Z + Math.sin(ph) * Math.max(0.6, rr), k & 1 ? C('teal', 7) : C('sea', 7), 0.07); }
      shk(0.4 + sh * 2.2);
      // the rip
      if (u >= 0) { planks3(ANCHOR_X, DY + 0.1, ANCHOR_Z, u, 16, 1.2, 425); splash3(ANCHOR_X, DY, ANCHOR_Z, u, 1.3); shk(6); if (u < 0.07) { const p = proj(ANCHOR_X, DY + 0.6, ANCHOR_Z); impactFrame(p ? p.x : 240, p ? p.y : 135, 1); } }
    } else if (t < 209.5) {
      // the hero shot, from the planks: the anchor held high as the sea comes roaring back
      const u = t - RIP;
      lookAt(ANCHOR_X - 3.9 + u * 0.04, 0.7, -4.3 - u * 0.03, ANCHOR_X - 0.55, 1.5, ANCHOR_Z, 54);
      harbour(t, { waterY: seaPull(t) });
      planks3(ANCHOR_X, DY + 0.1, ANCHOR_Z, u, 16, 1.2, 425);
      cracks(ANCHOR_X, ANCHOR_Z, 1.8, t);
      const hole = proj(ANCHOR_X, DY + 0.01, ANCHOR_Z); if (hole) { const r = CAM.F / hole.z * 0.35; for (let yy = -r * 0.3; yy <= r * 0.3; yy++) for (let xx = -r; xx <= r; xx++) if ((xx / r) ** 2 + (yy / (r * 0.3)) ** 2 < 1) { const X = fl(hole.x + xx), Y = fl(hole.y + yy), i = Y * W + X; if (X >= 0 && Y >= 0 && X < W && Y < H && ZB[i] > hole.z - 0.5) BUF[i] = C('night', 1); } }
      const settle = eoc(lin(0.2, 0.75, u)), lower = eio(lin(205.0, 205.5, t)), front = t > 205.45;
      const smirk = t > 207.0, glowEyes = u < 2.2;
      let rT, an;
      if (!front) {
        rT = actor3('tamo', { view: 'side', crouch: (1 - settle) * 0.9, armF: lerp(-1.35, -0.55, lower), armB: lerp(-1.1, 1.7, lower), eyes: glowEyes ? 'glow' : 'narrow', glow: C('teal', 7), brows: 'angry', mouth: u < 0.6 ? 0.9 : 0, wind: 3, bob: 0 }, TAX, DY, TAZ, { rim: { side: 1, T: T_TEAL, a: 0.4 } });
        an = heldAnchor(rT, lerp(-0.8, -2.55, lower), u < 2.4 ? 1 : 0, lower > 0.5);
      } else {
        rT = actor3('tamo', { view: 'front', armF: -1.5, armL: smirk && t < 207.8 ? PI + 0.3 : 1.9, eyes: blink(t, 26) ? 'closed' : 'narrow', brows: 'angry', mouth: mouth('tamo', t), smile: smirk ? 0.85 : 0.35, wind: 2 }, TAX, DY, TAZ, { rim: { side: 1, T: T_TEAL, a: 0.3 } });
        an = heldAnchor(rT, -2.3, 0, true);
      }
      if (u < 3.0) aura(t, [C('teal', 3), C('teal', 5), C('teal', 6), C('teal', 7)], 6 * (1 - u / 3.4), { sparks: 26 });
      if (an && t > 207.45 && t < 207.9) { const g2 = (t - 207.45) / 0.45; sparkle(Math.round(an.tip[0]), Math.round(an.tip[1]), 2 + Math.sin(g2 * PI) * 9, WHITE, C('teal', 7)); }
      // the sea thrown up comes down as rain; a crest of the returning wave bursts over the far edge
      for (let k = 0; k < 90; k++) { const fall = u * (5 + ih(k, 1, 426) * 4) - ih(k, 2, 426) * 3; if (fall < 0 || u > 3.5) continue; const y = DY + 7 - fall; if (y < DY) continue; p3(ANCHOR_X - 3 + ih(k, 3, 426) * 6, y, ANCHOR_Z - 1.5 + ih(k, 4, 426) * 4, k % 3 ? C('sea', 7) : WHITE, 0.06); }
      for (let q = 0; q < 4; q++) splash3(ANCHOR_X - 3 + q * 2, -0.2, 4.2, u - 0.45 - q * 0.08, 0.9);
      if (u < 0.5) shk(4 * (1 - u * 2));
    } else {
      // the wardens look at each other … and come anyway; he drags the anchor out to meet them
      lookAt(1.9, 2.0, -8.6, 1.1, 1.05, 1.3, 52);
      harbour(t);
      cracks(ANCHOR_X, ANCHOR_Z, 1.8, t); planks3(ANCHOR_X, DY + 0.1, ANCHOR_Z, t - RIP, 16, 1.2, 425);
      const TK = K({ t: 209.5, x: TAX, z: TAZ }, { t: 210.0, x: TAX - 0.6, z: 1.2, e: 'i' }, { t: 212.0, x: 0.75, z: 1.0, e: 'l' }, { t: 212.5, x: 0.6, z: 1.0, e: 'o' }), tp = trk(TK, t), walking = t < 212.4;
      const ready = eio(lin(212.6, 213.2, t));
      const rT = actor3('tamo', { view: 'side', walk: walking ? (TAX - tp.x) * WALKK : undefined, armF: walking ? 1.0 : lerp(1.0, 2.1, ready), armB: walking ? undefined : 1.8, crouch: ready * 0.6, eyes: blink(t, 27) ? 'closed' : 'narrow', brows: 'angry', smile: 0.4, wind: 2 }, tp.x, DY, tp.z, { flip: true });
      const an = heldAnchor(rT, angF(lerp(2.75, 2.5, ready), true), 0, true);
      // the drag: sparks where the flukes scrape the planks, and a pale groove behind
      if (an && walking && t > 210.0) { for (let k = 0; k < 6; k++) { const g = frac(t * 4 + k / 6); P(an.tip[0] + g * 20 + ih(k, fl(t * 30), 427) * 6, an.tip[1] - g * 14 + g * g * 30, k & 1 ? C('gold', 7) : WHITE); } }
      if (t > 210.0) l3(Math.min(TAX - 1.4, tp.x + 1.25), DY + 0.005, tp.z - 0.05, TAX - 1.4, DY + 0.005, TAZ - 0.05, C('wood', 6), 1);
      // three wardens: a look between them, a nod, and a charge — one of them circles out round the far side
      const conf = t > 210.4 && t < 211.3, nod = t > 211.0 && t < 211.3;
      const paths = [
        K({ t: 209.5, x: -4.0, z: 1.0 }, { t: 210.4, x: -3.0, e: 'o' }, { t: 211.4, x: -3.0 }, { t: 212.3, x: -1.0, z: 3.0, e: 'i' }, { t: 213.2, x: 2.4, z: 3.1, e: 'l' }, { t: 214.0, x: 5.6, z: 1.0, e: 'l' }),
        K({ t: 209.5, x: -5.4, z: 1.7 }, { t: 210.4, x: -4.2, e: 'o' }, { t: 211.4, x: -4.2 }, { t: 212.6, x: -3.3, e: 'i' }, { t: 214.0, x: -3.6, z: 1.4 }),
        K({ t: 209.5, x: -5.0, z: 0.4 }, { t: 210.4, x: -3.7, e: 'o' }, { t: 211.4, x: -3.7 }, { t: 212.6, x: -2.6, z: 0.8, e: 'i' }, { t: 214.0, x: -2.9, z: 0.9 }),
      ];
      for (let k = 0; k < 3; k++) {
        const w = trk(paths[k], t), w0 = trk(paths[k], t - 0.05), moving = Math.abs(w.x - w0.x) + Math.abs(w.z - w0.z) > 0.004, fast = t > 211.4;
        const lookL = conf && (k === 0 ? fl(t * 3) % 2 === 0 : k === 1 ? false : true);
        actor3('warden', { view: 'side', run: moving && fast ? (w.x + w.z) * RUNK : undefined, walk: moving && !fast ? (w.x + w.z) * WALKK : undefined, spear: fast ? 0.05 : -0.5, crouch: nod ? 0.4 : 0, eyes: 'open' }, w.x, DY, w.z, { flip: (w.x < w0.x - 0.002) || (lookL && !moving) });
      }
    }
  });

  // ---------------------------------------------------------------- 27 — the fight (3:34): a swing into the sea, a chain yanked into the barrels, a kick out of a lightning step
  const FHITS = [214.8, 217.2, 219.6], HSTOP = 0.1, TX = 0.6, TZ = 1.0;
  const BRL = [7.3, -0.9];
  function barrelStack(t) {
    if (t < 218.0) { barrel3(BRL[0] - 0.35, BRL[1] - 0.2, 0.8); barrel3(BRL[0] + 0.4, BRL[1] + 0.1, 0.8); barrel3(BRL[0], BRL[1] - 0.05, 0.72, DY + 0.84); crate3(BRL[0] + 1.1, DY, BRL[1] - 0.5, 0.7); return; }
    const g = t - 218.0;
    planks3(BRL[0], DY + 0.5, BRL[1], g, 18, 1.0, 431); planks3(BRL[0] + 0.2, DY + 0.9, BRL[1], g, 8, 0.8, 432, R.wood);
    barrel3(BRL[0] + 0.9 + eoc(lin(0, 1.2, g)) * 0.8, BRL[1] - 0.4, 0.8);
    crate3(BRL[0] + 1.4 + eoc(lin(0, 0.6, g)) * 0.3, DY, BRL[1] - 0.6, 0.7);
    dust3(BRL[0], BRL[1], g, 1.8, 433);
  }
  function w3Wreck(t) { if (t < 218.0) return; const g = t - 218.0; atFeet('warden', { view: 'side', walk: g < 1.5 ? t * 9 : t * 2, eyes: 'wide', spear: undefined, bob: 0 }, BRL[0] + 0.1, DY + 1.25 - Math.min(0.25, g * 2), BRL[1] + 0.05, PI + 0.15, { flip: true }); }
  shot(214.0, 221.0, (lt, t) => {
    const [T, frozen] = hold(t, FHITS, HSTOP);
    let cam = 1;
    if (t < 215.7) { const u = lin(214.0, 215.7, t), fl_ = sstep(214.95, 215.4, T); lookAt(2.0 + fl_ * 0.8, 1.65, -5.9 + u * 0.3, 2.2 + fl_ * 1.4, 1.1 + fl_ * 0.3, 1.6 + fl_ * 0.8, 50); }
    else if (t < 218.4) { cam = 2; const pan = eio(lin(217.3, 218.05, t)), lift = Math.sin(lin(217.3, 218.0, t) * PI) * 0.6; lookAt(-1.0 + pan * 5.9, 1.7 + lift * 0.4, -6.5 - pan * 1.0, -1.0 + pan * 6.8, 1.2 + lift, 1.0, 52); }
    else { cam = 3; const u = lin(218.4, 221, t); lookAt(-1.3 + u * 0.4, 1.6, -6.9 + u * 0.3, -1.2 + u * 0.4, 1.15, 1.2, 52); }
    harbour(t);
    barrelStack(T); w3Wreck(T);
    if (T > 215.6) swimmer(t, 5.4, 6.2, 1);
    // ---- Tamo
    let tO, tFlip, aAng, tx = TX;
    const sw1 = lin(214.65, 214.8, T), ft1 = lin(214.9, 215.3, T), rec1 = lin(215.3, 215.7, T);
    if (T < 215.7) {
      tFlip = T > 215.6;
      const wind = sstep(214.45, 214.65, T);
      aAng = T < 214.65 ? lerp(2.5, 2.85, wind) : T < 214.9 ? lerp(2.85, -1.0, eoc(sw1)) : T < 215.3 ? lerp(-1.0, -1.9, eoc(ft1)) : lerp(-1.9, -2.4, rec1);
      tx = TX + 0.3 * eoc(ft1);
      tO = { view: 'side', crouch: T < 214.65 ? 0.6 + wind * 0.4 : T < 214.9 ? lerp(1.0, 0.1, sw1) : lerp(0.1, 0.4, rec1), lean: T < 214.65 ? -1.2 * wind : T < 214.9 ? lerp(-1.2, 2.2, sw1) : lerp(2.2, 0, ft1), armF: T < 214.65 ? lerp(2.0, 2.3, wind) : T < 214.9 ? lerp(2.3, -1.1, eoc(sw1)) : lerp(-1.1, -0.8, rec1), armB: 1.2, eyes: frozen ? 'glow' : 'narrow', glow: C('teal', 7), brows: 'angry', mouth: frozen || (sw1 > 0 && sw1 < 1) ? 0.9 : 0, walk: ft1 > 0 && ft1 < 1 ? ft1 * 2.2 : undefined, wind: 3 };
    } else if (T < 218.0) {
      tFlip = true;
      const wrap = T > 216.78, tug = lin(216.8, 217.2, T), yank = lin(217.3, 217.7, T), fol = lin(217.7, 218.0, T);
      aAng = !wrap ? -2.4 : T < 217.3 ? lerp(-2.4, 0.25, eoc(lin(216.78, 216.95, T))) : T < 217.7 ? lerp(0.25, -PI - 0.6, eio(yank)) : lerp(-PI - 0.6, -PI - 0.95, fol);
      tx = TX + 0.3 - (wrap && T < 217.3 ? 0.12 * tug : 0.12);
      tO = { view: 'side', crouch: !wrap ? 0.4 : T < 217.3 ? 0.4 + tug * 0.5 : lerp(0.9, 0.3, yank), lean: !wrap ? 0 : T < 217.3 ? -1.6 * tug : lerp(-1.6, 1.5, yank), armF: !wrap ? -0.8 : T < 217.3 ? 0.1 : lerp(0.1, -2.6, eio(yank)), armB: 1.5, eyes: frozen ? 'glow' : 'narrow', glow: C('teal', 7), brows: 'angry', smile: T > 217.0 && T < 217.3 ? 0.8 : 0, mouth: yank > 0 && yank < 1 ? 0.9 : 0, wind: 2 };
    } else {
      tx = TX + 0.18;
      const turnBack = T > 219.25, flinch = T > 219.5 && T < 219.8, kL = T > 220.45;
      tFlip = turnBack;
      aAng = -2.45;
      tO = { view: 'side', crouch: flinch ? 0.6 : 0.15, lean: flinch ? -1.2 : 0, armF: -0.75, armB: T > 218.4 && T < 218.9 && !turnBack ? -1.7 : 1.7, eyes: turnBack ? (kL ? 'open' : 'wide') : 'narrow', brows: turnBack ? 'up' : 'angry', smile: turnBack ? (kL ? 0.4 : 0) : 0.7, mouth: T > 218.4 && T < 218.9 ? 0.6 : turnBack && !kL ? 0.5 : 0 };
    }
    const rT = actor3('tamo', tO, tx, DY, TZ, {});
    const an = heldAnchor(rT, angF(aAng, tFlip), 0, false);
    // swing smears
    if (rT && an && sw1 > 0 && sw1 < 1 && T < 214.9) smearArc(an.x, an.y, 2.85, angF(aAng, tFlip), an.L, [C('teal', 4), C('teal', 6), C('teal', 7)]);
    if (rT && an && T > 217.3 && T < 217.75) smearArc(an.x, an.y, angF(0.25, true), angF(aAng, true), an.L, [C('teal', 4), C('teal', 6), C('teal', 7)]);
    // ---- W1: charges from the right, eats the anchor, sails into the sea
    if (T < 215.25) {
      if (T < 214.9) {
        const w = trk(K({ t: 214.0, x: 5.6 }, { t: 214.62, x: 2.6, e: 'l' }, { t: 214.75, x: 2.2, e: 'o' }), T), lunge = lin(214.6, 214.75, T);
        actor3('warden', { view: 'side', run: T < 214.62 ? (5.6 - w.x) * RUNK : undefined, spear: 0.05, reach: lunge * 3, lean: lunge * 2, eyes: frozen ? 'wide' : 'open' }, w.x, DY, TZ, { flip: true });
      } else {
        const u = lin(214.9, 215.2, T);
        spin('warden', { view: 'side', eyes: 'wide', spear: -1.0 + u * 3 }, lerp(2.2, 5.4, u), lerp(DY + 0.8, -0.2, u) + Math.sin(u * PI) * 2.4, lerp(TZ, 6.2, u), (T - 214.9) * 16, { flip: true, gy: u < 0.4 ? DY : undefined });
        for (let k = 0; k < 3; k++) { const p = proj(lerp(2.2, 5.4, u) - 0.6 * (k + 1) * 0.3, lerp(DY + 0.8, -0.2, u) + Math.sin(u * PI) * 2.4, lerp(TZ, 6.2, u)); if (p) streaks(Math.atan2(-1, -1.2), 2, t + k, 0, WHITE, 18, 441 + k, [p.x - 30, p.y - 10, 30, 20]); }
      }
    }
    splash3(5.4, HWY, 6.2, T - 215.2, 1.5); ripple3(5.4, 6.2, T - 215.2, 1.4);
    // ---- W3: whirls a chain, wraps the anchor, gets yanked over Tamo's head into the barrels
    if (T < 218.0) {
      const crown = an ? an.tip : null;
      if (T < 217.3) {
        const throwU = lin(216.4, 216.75, T), tug = lin(216.8, 217.2, T);
        const wx = (T < 215.9 ? lerp(-3.6, -2.9, eoc(lin(214.0, 215.9, T))) : -2.9) - tug * 0.2;
        const rW = actor3('warden', { view: 'side', run: T < 215.9 ? wx * RUNK : undefined, armF: T < 216.4 ? -1.5 : throwU < 1 ? lerp(-1.5, 0.2, eoc(throwU)) : 0.05, armB: 1.6, lean: -1.8 * tug, crouch: tug * 0.5, eyes: 'open', spear: undefined }, wx, DY, 0.9, {});
        if (rW) {
          if (T < 216.45) { const a = T * 16, cx = rW.hand[0], cy = rW.hand[1] - 10 * rW.S; let lx = null, ly = 0; for (let q = 0; q < 30; q++) { const aa = a - q * 0.19, x = cx + Math.cos(aa) * 15 * rW.S, y = cy + Math.sin(aa) * 5 * rW.S; if (lx !== null) lineF(lx, ly, x, y, (xx, yy) => { P(xx, yy + 1, C('night', 1)); P(xx, yy, q < 8 ? WHITE : (xx + yy) & 1 ? C('stone', 6) : C('stone', 3)); if (q < 14) P(xx, yy - 1, C('stone', 5)); }); lx = x; ly = y; } lineF(rW.hand[0], rW.hand[1], cx + Math.cos(a) * 15 * rW.S, cy + Math.sin(a) * 5 * rW.S, (x, y, u) => { P(x, y, (x + y) % 2 ? C('stone', 6) : C('stone', 3)); P(x, y + 1, C('night', 1)); }); }
          else if (crown) { const e = throwU < 1 ? [lerp(rW.hand[0], crown[0], eoc(throwU)), lerp(rW.hand[1] - 20, crown[1], eoc(throwU))] : crown; lineF(rW.hand[0], rW.hand[1], e[0], e[1], (x, y, u) => { const sag = throwU < 1 ? Math.sin(u * PI) * 10 : (T < 216.8 ? Math.sin(u * PI) * 6 : 0); const yy = y + sag + Math.sin(u * 30 + t * 30) * (tug > 0 ? 0.6 : 0); P(x, yy, (x + y) % 3 === 1 ? C('stone', 7) : C('stone', 4)); P(x, yy + 1, C('night', 1)); }); if (throwU >= 1) for (let q = 0; q < 3; q++) ring(crown[0], crown[1] + q * 2 - 2, 5 + q, 3, C('stone', 5)); }
        }
      } else {
        const u = lin(217.3, 218.0, T), cx = lerp(-3.0, BRL[0] + 0.1, u), cy = DY + 0.9 + Math.sin(u * PI) * 1.9, cz = lerp(0.9, BRL[1], u);
        const rW = spin('warden', { view: 'side', eyes: 'wide', armF: -1.4, armB: -1.6 }, cx, cy, cz, -(T - 217.3) * 11, { gy: DY });
        if (rW && crown && u < 0.45) lineF(rW.hand[0], rW.hand[1], crown[0], crown[1], (x, y) => { P(x, y, (x + y) % 3 ? C('stone', 6) : C('stone', 3)); P(x, y + 1, C('night', 1)); });
      }
    }
    // ---- W2: sneaks up behind him; a spear thrust; a lightning step; a kick into the sea
    if (T > 218.0 && T < 220.1) {
      if (T < 219.7) {
        const w = trk(K({ t: 218.0, x: -4.4, z: 1.6 }, { t: 218.95, x: -1.25, z: 1.2, e: 'l' }), T), draw = lin(218.95, 219.08, T), thr = lin(219.08, 219.4, T);
        actor3('warden', { view: 'side', walk: T < 218.95 ? (w.x + 4.4) * WALKK * 1.4 : undefined, crouch: T < 218.95 ? 0.6 : 0.3, spear: 0.0, reach: draw < 1 ? -2 * draw : lerp(-2, 5, eoc(thr)), lean: draw < 1 ? -draw : lerp(-1, 2, thr), eyes: frozen ? 'wide' : 'open' }, w.x + eoc(thr) * 0.25, DY, w.z, {});
      } else {
        const u = lin(219.7, 220.1, T);
        spin('warden', { view: 'side', eyes: 'wide', spear: u * 4 }, lerp(-1.0, 0.5, u), lerp(DY + 0.8, -0.3, u) + Math.sin(u * PI) * 2.6, lerp(1.2, 6.2, u), (T - 219.7) * 15, { gy: u < 0.3 ? DY : undefined });
        // still crackling
        const p = proj(lerp(-1.0, 0.5, u), lerp(DY + 0.8, -0.3, u) + Math.sin(u * PI) * 2.6, lerp(1.2, 6.2, u)); if (p) for (let b = 0; b < 2; b++) bolt(p.x, p.y, p.x + (ih(b, fl(t * 30), 451) - 0.5) * 50, p.y + (ih(b + 2, fl(t * 30), 451) - 0.5) * 40, t, 452 + b, C('gold', 7), WHITE);
      }
    }
    splash3(0.5, HWY, 6.2, T - 220.1, 1.2); ripple3(0.5, 6.2, T - 220.1, 1.1);
    if (T > 220.6) swimmer(t, 0.5, 6.2, 2);
    // ---- Kaira: the lightning step
    if (T > 219.25) {
      const dash = lin(219.25, 219.55, T), ft = lin(219.7, 220.45, T), sq = lin(220.45, 220.8, T);
      const kx = (q) => lerp(-6.4, -1.75, eoc(q)), ky = (q) => DY + 0.45 + Math.sin(q * PI * 0.5) * 0.25;
      if (T < 219.7) {
        const after = dash < 1 ? [0.2, 0.4, 0.6, 0.8].map((q, i) => { const p = proj(kx(dash * q), ky(dash * q), 1.3); return p ? [Math.round(p.x), Math.round(p.y), i & 1 ? C('indigo', 6) : C('gold', 6), 0.25 + q * 0.4] : [0, 0, 0, 0]; }) : undefined;
        const p0 = proj(kx(0), ky(0) + 0.6, 1.3), p1 = proj(kx(dash), ky(dash) + 0.6, 1.3);
        if (p0 && p1 && dash < 1) { bolt(p0.x, p0.y, p1.x, p1.y, t, 453, C('gold', 7), WHITE); bolt(p0.x, p0.y + 8, p1.x, p1.y + 4, t + 0.5, 454, C('gold', 6), C('gold', 7)); }
        actor3('kaira', { view: 'side', air: true, stride: 3, armF: -0.6, armB: 2.4, reach: dash > 0.8 ? 3 : 0, blade2: 2.6, storm: true, eyes: 'narrow', brows: 'angry', seed: 0.8, wind: 6 }, kx(dash), ky(dash), 1.3, { after, ang: -0.55, gy: DY });
      } else if (T < 220.45) {
        const cx = lerp(-1.75, -1.05, ft), cy = DY + 0.85 + Math.sin(ft * PI) * 0.9 - ft * 0.05;
        spin('kaira', { view: 'side', armF: -1.0, blade: 0.4, blade2: 2.4, storm: true, eyes: 'narrow', brows: 'angry', seed: 0.8, wind: 4 }, cx, cy, 1.25, -0.55 - eio(ft) * (TAU - 0.55), { gy: DY });
      } else {
        actor3('kaira', { view: 'side', crouch: sq < 1 ? 1.3 * (1 - eob(sq)) : 0, armF: sq < 1 ? 0.6 : -0.2, blade: sq < 1 ? 0.5 : -0.35, blade2: 2.4, storm: T < 221, eyes: blink(t, 34) ? 'closed' : 'narrow', brows: 'angry', smile: sq >= 1 ? 0.6 : 0, seed: 0.6, wind: 2 }, -1.05, DY, 1.25, {});
        if (sq < 0.5) dust3(-1.05, 1.25, T - 220.45, 0.8, 455);
      }
      // a scorched streak along the planks where she ran
      if (T > 219.3 && T < 221) { const a = 1 - lin(219.6, 221, T); for (let q = 0; q < 40; q++) { const u = q / 40; if (u > eoc(Math.min(1, dash))) break; const p = proj(lerp(-6.4, -1.9, u), DY + 0.005, 1.3); if (p) for (let j = -1; j <= 1; j++) tintP(p.x, p.y + j, T_DARK, 0.5 * a); } }
    }
    // ---- the hits (each fires on its own beat; the clock holds behind it)
    const hitAt = [[2.2, DY + 0.95, TZ], [-2.9, DY + 1.0, 0.9], [-1.15, DY + 1.0, 1.2]];
    for (let k = 0; k < 3; k++) { const p = proj(hitAt[k][0], hitAt[k][1], hitAt[k][2]); if (p) hitFx(p.x, p.y, t - FHITS[k], k === 0 ? 1.4 : k === 1 ? 0.9 : 1.2, k === 2 ? [WHITE, C('gold', 6)] : [WHITE, C('teal', 7)]); }
    if (T >= 218.0 && T < 218.5) { const p = proj(BRL[0], DY + 0.8, BRL[1]); if (p) hitFx(p.x, p.y, T - 218.0, 0.9, [WHITE, C('wood', 6)]); }
    if (t > 219.6 && t < 219.75) { const p = proj(-1.15, DY + 0.9, 1.2); if (p) cam2(1 + 0.08 * (1 - (t - 219.6) / 0.15), 0, p.x, p.y); }
    void cam;
  });

  // ---------------------------------------------------------------- 28 — the breather: "Okay. Who ARE you?" / "Tamo! I work here…" (3:41)
  const KX = -1.05, KZ = 1.25;
  function breatherCam(t, k) { const u = lin(221, 231, t); lookAt(0.0, 1.32, -5.9 + u * 0.6, 0.0, 0.98, 1.1, 46); }
  function wreckFight(t) { barrelStack(t); w3Wreck(t); }
  shot(221.0, 228.0, (lt, t) => {
    breatherCam(t);
    harbour(t); wreckFight(t);
    swimmer(t, 5.4, 6.2, 1); swimmer(t, 0.5, 6.2, 2);
    const tk = talking('tamo', t), name = t > 222.9 && t < 223.45, here = t > 223.45 && t < 224.5, well = t > 224.55 && t < 225.3, you = t > 225.3 && t < 226.8;
    actor3('tamo', {
      view: 'front', eyes: blink(t, 31) ? 'closed' : well ? 'half' : 'open', brows: well ? 'worried' : 'n', mouth: mouth('tamo', t), smile: name ? 0.9 : well ? -0.3 : t > 226.8 ? 0.7 : 0.5,
      armF: t < 222.9 ? -1.15 : name ? 2.75 : here ? 0.15 + Math.sin(t * 6) * 0.15 : well ? 0.55 : you ? 1.25 : 1.15, armL: t < 222.8 ? -2.25 + Math.sin(t * 9) * 0.15 : well ? 2.55 : you ? PI + 0.05 : 1.9,
      look: you ? -1 : 0, lean: Math.sin(t * 1.3) * 0.8,
    }, TX, DY, TZ, {});
    const laugh = t > 225.55;
    actor3('kaira', {
      view: 'front', eyes: blink(t, 32) ? 'closed' : laugh ? 'closed' : 'open', brows: t < 222.5 ? 'up' : 'n', smile: laugh ? 0.95 : 0.25, mouth: laugh && t < 227 ? (fl(t * 9) % 2 ? 0.5 : 0.2) : mouth('kaira', t),
      armF: t < 222.6 ? 0.85 : laugh ? 2.6 : 1.3, armL: t < 222.6 ? 2.3 : 1.9, seed: 0.4, blade: t < 222.6 ? undefined : 1.3, blade2: 2.4, look: 1, bob: laugh && t < 227 ? (fl(t * 9) % 2 ? 1 : 0) : undefined, lean: 0.6 + Math.sin(t * 1.1 + 2) * 0.6,
    }, KX, DY, KZ, {});
  });

  // ---------------------------------------------------------------- 29 — the world goes quiet: gulls stop in the air; the ring opens over the harbour (3:48)
  const SIGIL_H = [34, 46, 78];
  // the Hush's ring in the sky, drawn here without a wash of light: three turning rings of glyphs, cracks running out of
  // them, and inside, the sky gone to paper with pencil hatching
  function sigil2(cx, cy, r, ry, t, a, seed) {
    if (a <= 0) return;
    for (let k = 0; k < 3; k++) {
      const rr = r * (1 - k * 0.15), rot = t * (k & 1 ? -0.35 : 0.25), n = fl(48 + rr * 0.6);
      for (let q = 0; q < n; q++) {
        if (ih(q, k, seed) > a) continue;
        const ang = q / n * TAU + rot, x = Math.round(cx + Math.cos(ang) * rr), y = Math.round(cy + Math.sin(ang) * rr * (ry / r)), g = fl(ih(q, k + 7, seed) * 5);
        if (g === 0) { rectF(x - 1, y - 1, 3, 1, WHITE); rectF(x, y - 1, 1, 3, WHITE); }
        else if (g === 1) { rectF(x - 1, y, 3, 1, WHITE); P(x - 1, y - 1, C('hush', 3)); P(x + 1, y + 1, C('hush', 3)); }
        else if (g === 2) { rectF(x, y - 1, 1, 3, C('hush', 6)); P(x + 1, y - 1, WHITE); }
        else if (g === 3) { P(x, y, WHITE); P(x + 1, y, C('crimson', 5)); }
        else P(x, y, C('hush', 4));
      }
      ring(cx, cy, rr + 3, (rr + 3) * ry / r, C('hush', 2), (x, y) => bay(fl(x), fl(y)) < 0.6 * a);
    }
    for (let k = 0; k < 10; k++) {
      const ang = ih(k, 1, seed + 5) * TAU, L = (0.3 + ih(k, 2, seed + 5) * 0.5) * r * a; let px = cx + Math.cos(ang) * r, py = cy + Math.sin(ang) * ry;
      for (let j = 1; j <= 5; j++) { const u = j / 5, nx = cx + Math.cos(ang + (ih(k, j, seed + 6) - 0.5) * 0.12) * (r + L * u), ny = cy + Math.sin(ang + (ih(k, j, seed + 6) - 0.5) * 0.12) * (ry + L * u * ry / r); lineF(px, py, nx, ny, (x, y) => { if (y >= LB && bay(x, y) < 1 - u * 0.7) P(x, y, j < 3 ? WHITE : C('hush', 3)); }); px = nx; py = ny; }
    }
  }
  function sigilOver(t, p, r0, a) {
    const r = r0, ry = r0 * 0.42;
    // the sky inside the ring becomes paper: pale, cross-hatched toward the rim, never a flat white
    for (let y = Math.max(LB, fl(p.y - ry)); y <= Math.min(H - LB - 1, p.y + ry); y++) for (let x = Math.max(0, fl(p.x - r)); x <= Math.min(W - 1, p.x + r); x++) {
      const i = y * W + x; if (IDB[i] !== 0) continue;
      const d = ((x - p.x) / r) ** 2 + ((y - p.y) / ry) ** 2; if (d > 1) continue;
      const k = a * (1 - d * 0.35);
      if (bay(x, y) > k * 1.3) continue;
      const hatch = ((x + y) % 4 === 0 && d > 0.25) || ((x - y + 400) % 4 === 0 && d > 0.6);
      BUF[i] = hatch ? C('stone', 5) : shadeC(R.hush, 0.6 + (1 - d) * 2.6, x, y);
    }
    sigil2(p.x, p.y, r, ry, t, a, 461);
  }
  shot(228.0, 246.0, (lt, t) => {
    if (t < 231.0) {
      // the laugh stops; everything stops; they look up
      breatherCam(t);
      harbour(t); wreckFight(t);
      swimmer(t, 5.4, 6.2, 1, HUSH_T); swimmer(t, 0.5, 6.2, 2, HUSH_T);
      harbourHush(t);
      const look = t > 229.4, lean = sstep(229.4, 229.8, t);
      actor3('tamo', { view: 'front', armF: 1.15, armL: 1.9, eyes: look ? 'wide' : 'open', brows: look ? 'up' : 'n', smile: look ? 0 : 0.6, look: look ? 1 : 0, lean: -lean * 1.2, mouth: look ? 0.35 : 0 }, TX, DY, TZ, { rim: { side: 1, T: T_WH, a: 0.35 * lean } });
      actor3('kaira', { view: 'front', eyes: t < HUSH_T ? 'closed' : look ? 'wide' : 'open', brows: look ? 'worried' : 'n', smile: t < HUSH_T ? 0.95 : 0, mouth: mouth('kaira', t), armF: 1.3, armL: 1.9, seed: 0.4, blade: 1.3, blade2: 2.4, look: look ? 1 : 0, lean: -lean }, KX, DY, KZ, { rim: { side: 1, T: T_WH, a: 0.35 * lean } });
    } else if (t < 235.4) {
      // the sky over the harbour opens: from the planks, past the two of them, up
      const u = t - 231.0; ENV.bloom = 0.12;
      lookAt(-1.4, 0.9, -4.2, 14, 16 + u * 1.8, 50, 58);
      harbour(t); harbourHush(t);
      const p = proj(SIGIL_H[0], SIGIL_H[1], SIGIL_H[2]);
      if (p) sigilOver(t, p, 18 + eoc(u / 3.6) * 92, lin(0, 2.4, u));
      actor3('tamo', { view: 'back', armF: 1.15, armL: 1.9, bob: 0 }, TX, DY, TZ - 0.6, { dark: 1, rim: { side: 1, T: T_WH, a: 0.5 } });
      actor3('kaira', { view: 'back', seed: 0.4, blade: 1.3, blade2: 2.4, bob: 0, wind: 1 }, KX, DY, KZ - 0.5, { dark: 1, rim: { side: 1, T: T_WH, a: 0.5 } });
      shk(0.5);
    } else if (t < 242.0) {
      // Tamo, close, the dark lighthouse behind him: "Hollow."
      const u = lin(235.4, 242, t);
      lookAt(TX - 3.9 + u * 0.4, 1.7, TZ - 4.0 + u * 0.4, TX, 1.45, TZ, 40);
      harbour(t); harbourHush(t);
      const down = t > 238.1 && t < 240.2;
      const rT = actor3('tamo', { view: 'front', armF: 0.9, armL: 1.9, eyes: blink(t, 33) ? 'closed' : down ? 'half' : 'sad', brows: 'worried', mouth: mouth('tamo', t), look: down ? -1 : 1, lean: Math.sin(t * 0.9) * 0.6 }, TX, DY, TZ, { rim: { side: 1, T: T_WH, a: 0.45 } });
      heldAnchor(rT, 1.35, 0, true);
    } else {
      // Oren drops in behind them: "No… not here. Not the harbour."
      const g = t - 242.0;
      lookAt(-0.9, 1.45, -6.0, -0.85, 1.05, 1.3, 48);
      harbour(t); wreckFight(t); harbourHush(t);
      const land = eoc(lin(0, 0.4, g));
      if (g < 0) { const p = proj(-2.4, DY + 6, 1.7), q = proj(-2.4, DY + (-g) * 30, 1.7); if (p && q) lineF(p.x, p.y, q.x, q.y, (x, y) => { if (bay(x, y) < 0.6) P(x, y, WHITE); }); }
      if (g >= 0 && g < 0.3) { const p = proj(-2.4, DY, 1.7); if (p) shockRing(p.x, p.y, 3 + g * 100, 1 + g * 24, 2, [WHITE, C('linen', 6), C('linen', 4)], 1 - g / 0.3); shk(3 * (1 - g / 0.3)); }
      dust3(-2.4, 1.7, g, 1.0, 471);
      actor3('warden', { view: 'front', captain: true, spear: lerp(-1.5, -1.2, land), armL: 1.9, eyes: 'wide', mouth: mouth('oren', t), crouch: g < 0.4 ? 1.4 * (1 - land) : 0, air: g < 0, bob: g < 0.4 ? 0 : undefined }, -2.4, DY + Math.max(0, -g * 30), 1.7, { rim: { side: 1, T: T_WH, a: 0.4 }, gy: DY });
      const turn = t > 242.25;
      actor3('kaira', { view: turn ? 'side' : 'front', seed: 0.5, blade: 1.3, blade2: 2.4, eyes: blink(t, 35) ? 'closed' : 'wide', brows: 'worried', armF: 1.0 }, KX, DY, KZ, { flip: true, rim: { side: 1, T: T_WH, a: 0.3 } });
      const rT = actor3('tamo', { view: turn ? 'side' : 'front', eyes: blink(t, 36) ? 'closed' : 'wide', brows: 'up', armF: -0.6 }, TX, DY, TZ, { flip: true, rim: { side: 1, T: T_WH, a: 0.3 } });
      heldAnchor(rT, angF(-2.4, true), 0, true);
    }
  });

  // ---------------------------------------------------------------- 30 — the Hollow fall like stars; a warden is erased; the Bellwether comes down (4:06)
  const HOLLOW_LAND = [247.0, 247.4, 247.7, 248.1, 248.5, 248.8, 249.2, 249.6], HOLLOW_X = [12, 9.5, 15, 7.5, 18, 11, 6.5, 14], HOLLOW_Z = [0.4, -1.8, 1.8, 2.2, -0.6, 2.6, -1.0, -2.6];
  const BELL_LAND = 260.0, BX = 8.4, BZ = 1.4, BSZ = 2.0;
  const hollowX = (k, t) => HOLLOW_X[k] - (t > 250 ? Math.min(3.2, (t - 250) * 0.5) : 0);
  function hollowCrowd(t, opt) {
    opt = opt || {};
    for (let k = 0; k < 8; k++) {
      const g = t - HOLLOW_LAND[k]; if (g < -0.6) continue;
      const x = hollowX(k, t), z = HOLLOW_Z[k] + (opt.part ? Math.sign(HOLLOW_Z[k] - VZ + 0.01) * opt.part * Math.max(0, 2.4 - Math.abs(HOLLOW_Z[k] - VZ)) : 0);
      if (g < 0) {
        const y = DY + (-g) * 40, p = proj(x, y, z), q = proj(x, y + 9, z);
        if (p && q) lineF(q.x, q.y, p.x, p.y, (xx, yy, u) => { if (bay(xx, yy) < u) { P(xx - 1, yy, C('crimson', 4)); P(xx, yy, WHITE); P(xx + 1, yy, C('char', 1)); } });
        continue;
      }
      const land = eoc(lin(0, 0.35, g)), moving = t > 250 && t < 256.4, cower = t > BELL_LAND && t < BELL_LAND + 2.5 ? sstep(BELL_LAND, BELL_LAND + 0.3, t) * (1 - sstep(BELL_LAND + 1.8, BELL_LAND + 2.5, t)) : 0;
      actor3('hollow', { view: opt.view || 'side', eyes: 'open', crouch: g < 0.35 ? 1.4 * (1 - land) : cower * 1.2, armF: 1.0 + Math.sin(t * 3 + k) * 0.25, armB: 1.7, walk: moving ? x * WALKK : undefined, lean: Math.sin(t * 2 + k) * 0.8 }, x, DY, z, { flip: true, dark: opt.dark || 0 });
      if (g < 0.25) { const p = proj(x, DY, z); if (p) { shockRing(p.x, p.y, 3 + g * 90, 1 + g * 20, 2, [WHITE, C('crimson', 5), C('hush', 3)], 1 - g / 0.25); shk(1); } }
    }
  }
  // the Bellwether: tall, robed, a cracked bronze bell for a head
  function bellwether(t, y, o, opt) { return actor3('bellwether', Object.assign({ glowEyes: true, sway: Math.sin(t * 0.8) * 2 }, o), BX, y, BZ, Object.assign({ size: BSZ, big: true }, opt || {})); }
  shot(246.0, 262.0, (lt, t) => {
    if (t < 250.0) {
      // wide, high: the white ring sweeping in across the far boats; the Hollow streak down onto the dock
      const u = lin(246, 250, t);
      lookAt(-10 + u * 1.5, 6.5, -17, 12, 2.5, 26, 56);
      harbour(t); harbourHush(t);
      const p = proj(SIGIL_H[0], SIGIL_H[1], SIGIL_H[2]); if (p) sigil2(p.x, p.y, 100, 42, t, 1, 461);
      hollowCrowd(t);
      for (const [x, z] of [[-2.4, 1.7], [-4.6, -0.8], [-5.8, 1.2]]) actor3('warden', { view: 'side', spear: 0.1, eyes: 'open' }, x, DY, z, {});
      const rT = actor3('tamo', { view: 'side', armF: -0.6, eyes: 'wide' }, TX, DY, TZ, {}); heldAnchor(rT, -2.4, 0, true);
      actor3('kaira', { view: 'side', seed: 0.5, blade: 0.6, blade2: 2.4, eyes: 'wide' }, KX, DY, KZ, {});
    } else if (t < 254.0) {
      // the fight with shadows: a spear goes through one and it only tears; a warden is touched, and is not a warden any more
      const er = t - 252.5;
      const u = lin(250, 254, t); lookAt(3.6 + u * 0.4, 1.9, -8.2 + u * 0.4, 5.6 + u * 0.4, 1.0, 0.0, 50);
      harbour(t); harbourHush(t);
      hollowCrowd(t);
      // Oren: thrust, a spin of the spear, a second thrust
      const th1 = lin(250.4, 250.6, t), sp = lin(251.0, 251.7, t), th2 = lin(252.05, 252.25, t);
      actor3('warden', { view: 'side', captain: true, spear: sp > 0 && sp < 1 ? sp * TAU * 2 : 0.0, reach: th1 > 0 && th1 < 1 ? th1 * 5 : th2 > 0 && th2 < 1 ? th2 * 5 : 0, lean: (th1 > 0 && th1 < 1) || (th2 > 0 && th2 < 1) ? 2 : 0, crouch: 0.4, eyes: er > 0.2 ? 'wide' : 'open' }, 4.4, DY, 0.4, { flip: er > 0.3, rim: { side: 1, T: T_WH, a: 0.3 } });
      if (th1 > 0.8 && th1 < 1) { const p = proj(5.9, DY + 0.9, 0.4); if (p) for (let k = 0; k < 12; k++) P(p.x + (ih(k, 1, 472) - 0.3) * 30, p.y + (ih(k, 2, 472) - 0.5) * 30, k & 1 ? WHITE : C('crimson', 5)); }
      // the warden at the back, and the Hollow that reaches him
      const gw = er > 0 ? Math.min(1, er / 0.6) : 0, reach = lin(252.0, 252.5, t);
      actor3('hollow', { view: 'side', eyes: 'open', armF: lerp(1.2, 0.05, reach), reach: reach * 4, lean: reach * 1.5, walk: t < 252.0 ? t * 5 : undefined }, 8.9 - reach * 0.5 - lin(250, 252, t) * 0.4, DY, -1.5, { flip: true });
      if (er < 1.4) {
        const wO = { view: er > 0 ? 'front' : 'side', spear: er > 0 ? undefined : 0.1, eyes: 'wide', armF: er > 0 ? -1.2 : undefined, armL: er > 0 ? -1.9 : undefined, bob: 0 };
        if (er < 0.1) actor3('warden', wO, 7.3, DY, -1.5, { white: er > 0, flip: false });
        else { actor3('warden', wO, 7.3, DY + er * 0.15, -1.5, { glitch: gw * 2, alpha: 1 - Math.max(0, er - 0.6) * 1.25, shadow: false }); }
      }
      if (er > 0.05 && er < 2.0) { const p = proj(7.3, 1.0, -1.5); if (p) for (let k = 0; k < 70; k++) { const uu = frac(ih(k, 1, 471) + er * 0.8); if (uu > er * 1.2) continue; const x = p.x + (ih(k, 2, 471) - 0.5) * 50 + Math.sin(uu * 6 + k) * 6, y = p.y + 30 - ih(k, 3, 471) * 50 - uu * 70; if (bay(fl(x), fl(y)) > 1 - uu) continue; P(x, y, ih(k, 4, 471) < 0.75 ? WHITE : C('crimson', 5)); if (k % 3 === 0) P(x + 1, y, C('hush', 3)); } }
      if (er > 0 && er < 0.04) impactFrame(240, 135, 0);
      // Tamo and Kaira back to back, in the left of the frame
      const rT = actor3('tamo', { view: 'side', armF: -0.6, eyes: 'narrow', brows: 'angry', crouch: 0.4 }, 2.4, DY, 1.6, { flip: true }); heldAnchor(rT, angF(-2.4, true), 0, true);
      actor3('kaira', { view: 'side', seed: 0.6, blade: 0.2, blade2: 2.6, eyes: 'narrow', brows: 'angry', crouch: 0.5 }, 3.1, DY, 2.0, {});
    } else {
      // the Bellwether coming down out of the ring, huge and slow; it lands, and rings
      const g = t - BELL_LAND, y = g >= 0 ? DY : t < 259.25 ? DY + 4.6 + 26 * (1 - eoc(lin(254.0, 259.25, t))) : t < 259.72 ? DY + 4.6 + Math.sin(lin(259.25, 259.72, t) * PI) * 0.35 : DY + 4.6 * (1 - eic(lin(259.72, BELL_LAND, t)));
      const fy = Math.max(3.4, lerp(y + 1.6, 3.4, sstep(258.3, 259.3, t)));
      lookAt(-2.8, 0.75, -8.0 - sstep(259.9, 261.5, t) * 0.6, BX - 1.5, fy, BZ, 60);
      harbour(t); harbourHush(t);
      const p = proj(SIGIL_H[0], SIGIL_H[1], SIGIL_H[2]); if (p) sigil2(p.x, p.y, 100, 42, t, 1, 461);
      // a thin falling column of glyphs it rides down
      if (g < 0.5) { for (let k = 0; k < 60; k++) { const fy = frac(ih(k, 1, 481) - t * 0.6) * 30, q = proj(BX + (ih(k, 2, 481) - 0.5) * 3, y + fy, BZ + (ih(k, 3, 481) - 0.5) * 2); if (q && bay(fl(q.x), fl(q.y)) < 0.6) P(q.x, q.y, k & 3 ? C('hush', 5) : WHITE); } }
      hollowCrowd(t);
      if (g < 0 && t > 259.72) { const q = proj(BX, y + 3, BZ); if (q) streaks(-PI / 2, 26, t, 2600, C('hush', 5), 50, 484, [q.x - 90, LB, 180, H - 2 * LB]); }
      const bw = bellwether(t, y, { sway: g < 0 ? Math.sin(t * 5) * 3 * (t < 259.72 ? 1 : 0.2) : Math.sin(t * 0.8) * 2, arms: g < 0 ? 0.55 + Math.sin(t * 1.3) * 0.08 : lerp(0.55, 1.3, eoc(lin(0.2, 1.4, g))), ring: g > 0 && g < 1.6 ? 1.6 * (1 - g / 1.6) : 0 }, { gy: DY, rim: { side: -1, T: T_WH, a: 0.3 } });
      const push = g > 0 ? eoc(lin(0, 0.5, g)) * 0.35 : 0, crouchH = g > 0 && g < 1.6 ? 1 - lin(0.6, 1.6, g) : 0;
      const rT = actor3('tamo', { view: 'back', armF: 1.15, armL: 1.9, crouch: crouchH * 0.8, bob: 0, wind: g > 0 && g < 1.5 ? 5 : 1 }, TX - 0.2 - push, DY, -0.6, { dark: 1, rim: { side: 1, T: T_WH, a: 0.4 } }); heldAnchor(rT, -1.3, 0, true);
      actor3('kaira', { view: 'back', seed: 0.6, blade: 0.8, blade2: 2.4, crouch: crouchH * 0.9, bob: 0, wind: g > 0 && g < 1.5 ? 6 : 1 }, TX - 1.05 - push, DY, -0.2, { dark: 1, rim: { side: 1, T: T_WH, a: 0.4 } });
      if (g > 0) {
        dust3(BX, BZ, g, 4.0, 482); planks3(BX, DY + 0.05, BZ, g, 20, 1.3, 483);
        const base = proj(BX, DY, BZ), bh = proj(BX, DY + 5.2, BZ);
        for (let r = 0; r < 3; r++) { const gg = g - r * 0.22; if (gg > 0 && gg < 1.4) { if (base) shockRing(base.x, base.y, 10 + gg * 380, 3 + gg * 60, 3, [WHITE, C('hush', 5), C('gold', 6)], 1 - gg / 1.4); if (bh) shockRing(bh.x, bh.y, 8 + gg * 200, 8 + gg * 200, 2, [WHITE, C('gold', 6), C('gold', 4)], 1 - gg / 1.4); } }
        if (bh && g < 0.6) radialLines(bh.x, bh.y, 36, 30, WHITE, t, 493);
        shk(6 * Math.exp(-g * 2.2)); if (g < 0.07) flashWhite(0.45);
      }
      void bw;
    }
  });

  // ---------------------------------------------------------------- 31 — "The courier. And the anchor-bearer. Two of four." (4:22)
  shot(262.0, 276.0, (lt, t) => {
    if (t < 266.2 || (t > 267.0 && t < 270.2)) {
      // low on the bell as it speaks; a slow push
      const a = t < 266.2, u = a ? lin(262, 266.2, t) : lin(267, 270.2, t);
      if (a) lookAt(2.0 + u * 0.5, 0.9, -7.2 + u * 0.6, BX, 4.6, BZ, 56); else lookAt(4.4 + u * 0.3, 3.2, -4.6 + u * 0.3, BX, 5.5, BZ, 44);
      harbour(t); wreckFight(t); harbourHush(t);
      hollowCrowd(t);
      const sp_ = talking('bellwether', t), m = mouth('bellwether', t), chuckle = t > 267.0 && t < 267.7;
      const bw = bellwether(t, DY, { ring: chuckle ? 0.9 : sp_ ? 0.35 * m : 0, arms: 1.3 + Math.sin(t * 0.7) * 0.1, sway: Math.sin(t * 0.8) * 2 + (chuckle ? Math.sin(t * 40) * 1 : 0) }, { rim: { side: -1, T: T_WH, a: 0.35 } });
      if (bw && bw.head && sp_) { glow(bw.head[0], bw.head[1] - 26 * bw.S, (8 + 14 * m) * bw.S / 2, T_GOLD, 0.35); }
    } else if (t < 267.0) {
      // the two of them, ready
      lookAt(-0.05, 1.3, -5.6, -0.05, 0.98, 1.1, 46);
      harbour(t); harbourHush(t);
      const draw = eoc(lin(266.3, 266.55, t));
      const rT = actor3('tamo', { view: 'front', armF: lerp(-1.15, -0.4, draw), armL: 1.9, eyes: 'narrow', brows: 'angry', crouch: draw * 0.4 }, TX, DY, TZ, { rim: { side: 1, T: T_WH, a: 0.4 } }); heldAnchor(rT, lerp(-2.1, -1.2, draw), 0, true);
      actor3('kaira', { view: 'front', seed: 0.7, blade: lerp(1.3, -0.9, draw), blade2: 2.4, armF: lerp(1.3, -0.4, draw), eyes: 'wide', brows: 'worried', crouch: draw * 0.4 }, KX, DY, KZ, { rim: { side: 1, T: T_WH, a: 0.4 } });
    } else {
      // the standoff, wide: their stances; it spreads its arms; the Hollow edge in
      const u = t - 270.2;
      lookAt(0.3, 1.7, -9.8 + u * 0.25, 3.5, 3.25, 1.0, 66);
      harbour(t); wreckFight(t); harbourHush(t);
      hollowCrowd(t);
      bellwether(t, DY, { arms: lerp(1.3, 0.2, eio(lin(273, 275.5, t))) }, { flip: true });
      const st = eio(lin(270.8, 271.6, t));
      const rT = actor3('tamo', { view: 'side', armF: lerp(-0.6, 0.6, st), crouch: st * 0.6, eyes: 'narrow', brows: 'angry', lean: st * 0.8 }, TX, DY, TZ, {}); heldAnchor(rT, lerp(-2.4, 2.6, st), 0, true);
      actor3('kaira', { view: 'side', seed: 0.7, blade: lerp(1.6, 0.0, eio(lin(271.4, 272.2, t))), blade2: 2.6, crouch: 0.7 * eio(lin(271.4, 272.2, t)), eyes: 'narrow', brows: 'angry', storm: t > 272 }, KX, DY, KZ + 0.2, {});
      for (let k = 0; k < 18; k++) { const yy = 120 + ih(k, 1, 491) * 110, x = frac(ih(k, 2, 491) - t * 0.25) * 560 - 40; lineF(x, yy, x + 14, yy - 1, (xx, y2) => { if (bay(xx, y2) < 0.4) P(xx, y2, C('hush', 5)); }); }
    }
  });

  // ---------------------------------------------------------------- 32 — the toll: a white wave down the dock; a wall of water; the strain; the break (4:36)
  const TOLL = 276.5, WALL = 277.5, MEET = 278.5, BREAK = 285.5, WX = 1.35;
  const waveFront = (t) => (t < TOLL ? 99 : t < MEET ? lerp(BX - 0.5, WX + 0.25, Math.pow(lin(TOLL, MEET, t), 1.4)) : t < BREAK ? WX + 0.25 + Math.sin(t * 7) * 0.06 : Math.max(-0.9, WX + 0.25 - (t - BREAK) * 3));
  // the wall of water: a churning sheet with a ragged foaming crest, spray thrown off its top, and the white eating into its far face
  function waterWall(t, h) {
    if (h < 0.05) return;
    const z0 = -4.6, z1 = 5.0, strain = t > MEET && t < BREAK;
    for (const [xo, dark] of [[0.22, 1], [0, 0]]) {
      poly3([[WX + xo, -0.5, z0], [WX + xo, -0.5, z1], [WX + xo, h + 0.6, z1], [WX + xo, h + 0.6, z0]], (u, v, x, y) => {
        // u: along z, v: up
        const crest = h - 0.25 + Math.sin(u * 3.1 + t * 5) * 0.12 + Math.sin(u * 7.3 - t * 7) * 0.07 + (vn(u * 4, t * 3, 1, 501) - 0.5) * 0.25;
        if (v > crest + 0.12) return -1;
        if (v > crest - 0.1) return bay(x, y) < 0.7 ? WHITE : C('hush', 4);
        const flow = vn(u * 2.2, v * 1.3 - t * 3.2, 1, 502), streak = frac(u * 2.7 + Math.sin(v * 1.5 + t * 2) * 0.3);
        let s = 2.6 + v / h * 2.2 + flow * 1.6 - dark * 0.8;
        if (streak < 0.08) s += 1.8;
        if (vn(u * 5, v * 5 - t * 6, 1, 503) > 0.8) return C('sea', 7);
        if (v < 0.5 + Math.sin(u * 4 + t * 6) * 0.15) return bay(x, y) < 0.5 ? WHITE : C('sea', 6);     // churn at the foot
        if (strain && !dark && ih(x >> 1, y >> 1, fl(t * 18)) < 0.04) return ih(x, y, 5) < 0.6 ? WHITE : C('crimson', 5);
        return shadeC(R.sea, s, x, y);
      }, { two: true });
    }
    // spray off the crest and droplets falling back
    for (let k = 0; k < 70; k++) { const zz = z0 + ih(k, 1, 504) * (z1 - z0), ph = frac(ih(k, 2, 504) + t * (0.8 + ih(k, 3, 504))), up = Math.sin(ph * PI) * (0.5 + ih(k, 4, 504) * 1.0); p3(WX + 0.1 - ph * 0.8 * ih(k, 5, 504), h - 0.1 + up, zz, k % 3 ? C('sea', 7) : WHITE, 0.09); }
    // where the white meets the water: static, glyphs, steam
    if (strain) for (let k = 0; k < 60; k++) { const zz = z0 + ih(k, 1, 505) * (z1 - z0), yy = ih(k, 2, 505) * h, ph = frac(ih(k, 3, 505) + t * 2); p3(WX + 0.35 + ph * 0.8, yy + ph * 0.6, zz, ph < 0.5 ? WHITE : C('crimson', 5), 0.06); }
  }
  shot(276.0, 292.0, (lt, t) => {
    const close = t > 280.4 && t < 285.2, after = t >= BREAK + 0.5;
    if (after) { const u = lin(BREAK + 0.5, 292, t); lookAt(-13.6 + u * 0.5, 1.25, -0.8, BX, 3.0, BZ, 48); }
    else if (close) { const u = lin(280.4, 285.2, t); lookAt(-2.6 + u * 0.3, 1.35, -4.5 + u * 0.35, 0.1, 1.28, 1.1, 48); }
    else { const u = lin(276, 280.4, t); lookAt(-4.6 + u * 0.3, 2.4, -7.4 + u * 0.3, 3.2, 2.6, 1.0, 60); }
    harbour(t); wreckFight(t);
    const front = waveFront(t);
    harbourHush(t, (wx, wy, wz) => (Math.abs(wz) > 8 || wy > 7 ? 0 : wx > front + 0.7 ? 1 : wx > front ? 0.55 : 0));
    // the wall
    const wh = t < WALL ? 0 : t < BREAK ? 4.4 * eob(lin(WALL, WALL + 0.7, t)) : 4.4 * (1 - eic(lin(BREAK, BREAK + 0.35, t)));
    waterWall(t, wh);
    if (t > WALL && t < WALL + 1.2) { splash3(WX, -0.3, -3.6, t - WALL, 1.6); splash3(WX, -0.3, 4.6, t - WALL, 1.6); }
    // the Bellwether, the Hollow
    hollowCrowd(t);
    bellwether(t, DY, { ring: t > TOLL && t < TOLL + 1.4 ? 1.5 * (1 - (t - TOLL) / 1.4) : 0, arms: t > 288 ? lerp(0.2, -0.9, eio(lin(288, 290.5, t))) : 0.2 }, { flip: !after });
    if (t > TOLL && t < TOLL + 1.2) { const b = proj(BX, DY + 5.2, BZ); if (b) for (let r = 0; r < 3; r++) { const gg = t - TOLL - r * 0.2; if (gg > 0 && gg < 1) shockRing(b.x, b.y, 8 + gg * 220, 8 + gg * 220, 2, [WHITE, C('gold', 6), C('gold', 4)], 1 - gg); } shk(3 * (1 - (t - TOLL) / 1.2)); }
    // the heroes: he slams the anchor down and holds the wall; she braces at his back; then they're thrown
    const thrownT = lin(BREAK + 0.5, BREAK + 1.15, t), thrownK = lin(BREAK + 0.55, BREAK + 1.3, t), down = t >= BREAK + 1.15, downK = t >= BREAK + 1.3;
    const slam = lin(WALL - 0.35, WALL, t), strain = t > WALL && t < BREAK + 0.5;
    if (!after && t < BREAK + 0.5) {
      const rT = actor3('tamo', {
        view: close ? 'front' : 'side', armF: close ? -1.3 + (strain ? Math.sin(t * 30) * 0.05 : 0) : slam < 1 ? lerp(-0.6, -1.5, sstep(276.6, WALL - 0.35, t)) : 0.5, armL: close ? -1.9 : undefined,
        crouch: t > WALL ? 1.0 : slam > 0 ? -0.0 : 0.4, lean: strain && !close ? 1.5 : 0, eyes: t > MEET ? 'glow' : 'narrow', glow: C('teal', 7), brows: 'angry', mouth: mouth('tamo', t) || (t > MEET && !talking('tamo', t) ? 0.0 : 0), smile: strain ? -1 : 0, bob: strain ? 0 : undefined,
      }, TX + (strain ? (ih(fl(t * 30), 3, 9) - 0.5) * 0.02 : 0), DY, TZ, { rim: { side: 1, T: T_TEAL, a: t > WALL ? 0.6 : 0 } });
      const aA = close ? -1.45 : t < WALL - 0.35 ? lerp(-2.4, -1.5, sstep(276.6, WALL - 0.4, t)) : t < WALL ? lerp(-1.5, 1.1, eic(slam)) : 1.15;
      heldAnchor(rT, aA, t > WALL ? 1 : 0, false);
      if (t > WALL && t < BREAK && !close) aura(t, [C('teal', 3), C('teal', 5), C('teal', 6), C('teal', 7)], 6, { sparks: 14 });
      if (t > WALL && t < WALL + 0.4) { dust3(TX + 0.8, TZ, t - WALL, 1.2, 506); planks3(TX + 0.8, DY, TZ, t - WALL, 8, 0.8, 507); }
    }
    const blaze = sstep(283.4, 284.2, t) * (t < BREAK ? 1 : 0);
    let ka = null;
    if (!after && t < BREAK + 0.55) ka = actor3('kaira', { view: close ? 'front' : 'side', seed: 0.6 + blaze * 0.4, blade: 0.3, blade2: 2.6, armF: close ? 1.3 : -0.1, crouch: 0.7, lean: strain ? 1.4 : 0, eyes: blaze > 0.5 ? 'glow' : 'wide', brows: 'worried', mouth: mouth('kaira', t), wind: 3 }, KX + 0.25, DY, KZ + (close ? 0.35 : 0), {});
    if (ka && blaze > 0) { glow(ka.chest[0], ka.chest[1], 40 * blaze, T_GOLD, 0.5 * blaze); for (let b = 0; b < 4; b++) if (ih(b, fl(t * 20), 491) < blaze) bolt(ka.chest[0], ka.chest[1], ka.chest[0] + (ih(b, fl(t * 20) + 1, 491) - 0.5) * 120, ka.chest[1] + (ih(b, fl(t * 20) + 2, 491) - 0.5) * 90, t, 492 + b, C('gold', 7), WHITE); shk(blaze * 2); }
    if (t > MEET && t < BREAK) shk(1.2 + Math.sin(t * 3) * 0.5);
    // the break: the wall bursts toward them; they're thrown back down the dock and land hard
    if (t > BREAK) {
      splash3(WX, DY, 0.6, t - BREAK, 2.4); splash3(WX, DY, -2.2, t - BREAK - 0.05, 1.8); splash3(WX, DY, 3.0, t - BREAK - 0.1, 1.8);
      const p = proj(WX, 1.6, 0.8); if (p && !after) hitFx(p.x, p.y, t - BREAK, 1.6, [WHITE, C('sea', 7)]);
      for (let k = 0; k < 120; k++) { const g = t - BREAK, a = ih(k, 1, 508) * PI, v = 3 + ih(k, 2, 508) * 6; if (g > 1.4) break; const y = 0.8 + ih(k, 3, 508) * 3 + Math.sin(a) * v * g * 0.6 - 4.9 * g * g; if (y < DY) continue; p3(WX - Math.abs(Math.cos(a)) * v * g, y, -3 + ih(k, 4, 508) * 7, k % 3 ? C('sea', 7) : WHITE, 0.1); }
    }
    if (t >= BREAK + 0.5) {
      // flying, then down: Tamo, his anchor, Kaira
      const TL = [-3.0, -4.3], ZL = [TZ, KZ + 0.3];
      if (!down) spin('tamo', { view: 'side', eyes: 'closed', brows: 'worried', armF: -2.4, armB: -2.0, wind: 5 }, lerp(TX, TL[0], thrownT), DY + 0.6 + Math.sin(thrownT * PI) * 1.3, lerp(TZ, ZL[0], thrownT), -thrownT * 4.2, { gy: DY });
      else atFeet('tamo', { view: 'side', eyes: t > 289.5 ? 'half' : 'closed', brows: 'worried', armF: -2.6, armB: 2.4, bob: 0, mouth: 0.2 }, TL[0] - 0.55 - eoc(lin(BREAK + 1.15, BREAK + 1.5, t)) * 0.2, DY + 0.36 + (t < BREAK + 1.3 ? Math.sin(lin(BREAK + 1.15, BREAK + 1.3, t) * PI) * 0.12 : 0), ZL[0], PI / 2, { gy: DY, sx: TL[0], sr: 0.9 });
      if (!downK) spin('kaira', { view: 'side', eyes: 'closed', brows: 'worried', armF: -2.2, blade2: 2.4, wind: 6 }, lerp(KX + 0.25, TL[1], thrownK), DY + 0.6 + Math.sin(thrownK * PI) * 1.5, lerp(KZ, ZL[1], thrownK), -thrownK * 5.0, { gy: DY });
      else atFeet('kaira', { view: 'side', eyes: 'closed', brows: 'worried', armF: 2.6, armB: -2.5, blade2: 2.4, bob: 0 }, TL[1] - 0.5, DY + 0.36 + (t < BREAK + 1.45 ? Math.sin(lin(BREAK + 1.3, BREAK + 1.45, t) * PI) * 0.12 : 0), ZL[1], PI / 2, { gy: DY, sx: TL[1], sr: 0.9 });
      if (t < BREAK + 1.8) { dust3(TL[0], ZL[0], t - BREAK - 1.15, 0.9, 509); dust3(TL[1], ZL[1], t - BREAK - 1.3, 0.9, 510); }
      // the anchor clatters down between them
      const au = lin(BREAK + 0.5, BREAK + 1.25, t), ax = lerp(TX + 0.5, -1.6, au), ay = au < 1 ? DY + 0.5 + Math.sin(au * PI) * 1.8 : DY + 0.2;
      anchorAt3(ax, ay, TZ - 0.2, au < 1 ? au * 9 : 0.1, 0);
      if (t > BREAK + 1.25 && t < BREAK + 1.6) shk(2);
    }
    // the Bellwether lifts its arms for the last toll … which never comes
    if (t > 288 && t < 290.6) { const b = proj(BX, DY + 5.0, BZ); if (b) { glow(b.x, b.y, 18 + (t - 288) * 12, T_GOLD, 0.35); radialLines(b.x, b.y, 24, 30, C('hush', 6), t, 492); } shk((t - 288) * 0.9); }
    if (t > 290.8) tintAll(T_DARK, 0.3);
  });

  // ---------------------------------------------------------------- 33 — the light in the fog (4:52)
  // Vesper: a tall armoured knight in a ragged cloak, a violet crest that streams like flame, a lantern
  const VSTEPS = [292.2, 293.4, 294.6, 295.8, 297.0], VZ = -2.5;
  function drawVesper3(o) {
    const ph = o.step || 0, s = Math.sin(ph), lift = (q) => Math.max(0, q) * 3;
    const armour = C('stone', 3), armL = C('stone', 5), armD = C('stone', 1), cloak = C('night', 1), cloakL = C('night', 2), vio = C('violet', 6), vioL = C('violet', 7);
    // the cloak behind, ragged at the hem, blown
    const w = o.wind || 0;
    sPoly([[17, 4], [43, 4], [48 - w, 58], [12 - w * 1.5, 60]], cloak);
    for (let k = 0; k < 7; k++) { const x = 12 - w * 1.5 + k * 5.5; sPoly([[x, 57], [x + 5, 57], [x + 2 - w * 0.6, 63 + (k & 1) * 2 + Math.sin(T_NOW * 3 + k) * 1]], k & 1 ? cloak : cloakL); }
    // legs, armoured, stepping
    const legX = [25 + s * 2, 33 - s * 2], legLift = [lift(-Math.cos(ph)), lift(Math.cos(ph))];
    for (let k = 0; k < 2; k++) { const x = legX[k], ly = 60 - legLift[k]; sRect(x - 3, 40, x + 2, ly - 3, k ? armour : armD); sRect(x - 4, ly - 3, x + 3, ly, k ? armL : armour); sRect(x - 3, 47, x + 2, 48, k ? armL : armour); }
    // the body: a breastplate and a tasset skirt
    sPoly([[19, 16], [41, 16], [39, 38], [21, 38]], armour); sRect(20, 16, 40, 17, armL); sLine(30, 18, 30, 36, armL);
    sPoly([[20, 37], [40, 37], [42, 45], [18, 45]], armD); for (let k = 0; k < 4; k++) sLine(21 + k * 5, 38, 20 + k * 5.5, 44, armour);
    // pauldrons
    sEll(17, 18, 6, 4.5, armL); sEll(43, 18, 6, 4.5, armour); sRect(12, 19, 22, 20, armD); sRect(38, 19, 48, 20, armD);
    // the left arm down with the lantern; the right on the sword's hilt
    const sw = Math.sin(ph) * 0.3;
    sLine(14, 22, 13 + Math.sin(sw) * 2, 34, armour, 4); sRect(11, 33, 15, 36, armD);
    const lx = 13 + Math.sin(sw) * 5, ly = 37 + Math.cos(sw) * 0;
    sLine(lx, 36, lx + Math.sin(sw) * 3, 40, C('stone', 2)); sRect(lx - 2 + Math.sin(sw) * 3, 40, lx + 2 + Math.sin(sw) * 3, 46, C('stone', 2)); sRect(lx - 1 + Math.sin(sw) * 3, 41, lx + 1 + Math.sin(sw) * 3, 45, vio, 3); sp(lx + Math.sin(sw) * 3, 42, vioL, 3);
    sLine(46, 22, 45, 33, armour, 4); sRect(43, 32, 47, 35, armD);
    sLine(45, 30, 45, 22, C('stone', 4), 2); sRect(42, 30, 48, 31, C('stone', 6));        // the hilt over the shoulder
    // the helm: tall, a visor slit, the eyes
    sPoly([[22, 15], [23, 2], [26, -3], [34, -3], [37, 2], [38, 15]], armour); sRect(22, 13, 38, 15, armD); sLine(27, -2, 27, 13, armL);
    sRect(24, 4, 37, 6, C('night', 0)); const eg = o.eyeGlow || 0;
    sRect(29, 4, 30, 5, vio, 3); sRect(33, 4, 34, 5, vio, 3); if (eg > 0.5) { sp(29, 4, WHITE, 3); sp(33, 4, WHITE, 3); }
    // the crest: violet strands streaming back like a flame
    for (let k = 0; k < 7; k++) { const bx = 27 + k * 1.2, L = 12 + (k % 3) * 4 + Math.sin(T_NOW * 7 + k * 1.7) * 2; let px = bx, py = -3; for (let j = 1; j <= 6; j++) { const u = j / 6, nx = bx - u * L * 0.9 - w * u * 2, ny = -3 - u * L * 0.55 + u * u * L * 0.5 + Math.sin(T_NOW * 9 + k + j) * u * 1.2; sLine(px, py, nx, ny, j < 3 ? vioL : k & 1 ? vio : C('violet', 5), j < 4 ? 3 : 2, 3); px = nx; py = ny; } }
  }
  function vesper3(o, wx, wy, wz, opt) {
    const p = proj(wx, wy, wz); if (!p) return null;
    const S = snapS(CAM.F / p.z * (opt.size || 1) / 26); if (S > 14) return null;
    clearSprite(); drawVesper3(o); outlineSprite(C('night', 0));
    clearMask(); const x = Math.round(p.x), y = Math.round(p.y);
    stamp(x, y, S, 0, opt.flip, Object.assign({ z: p.z, fog: true }, opt));
    return { x, y, S, z: p.z, eyes: [x + (opt.flip ? -1 : 1) * 1.5 * S, y - 56 * S], lantern: [x + (opt.flip ? 1 : -1) * 17 * S, y - 17 * S] };
  }
  // the fog: everything far off goes pale lavender, by depth
  const T_FOG = tab('#cfc6e2');
  function fogDepth(near, far, amax) { for (let y = LB; y < H - LB; y++) for (let x = 0; x < W; x++) { const i = y * W + x, z = IDB[i] === 0 ? far : ZB[i], a = amax * sstep(near, far, z); if (a > 0.02) tintI(i, x, y, T_FOG, a); } }
  shot(292.0, 300.0, (lt, t) => {
    if (t > 298.5) { BUF.fill(BLACK); return; }
    // where the knight is: one heavy step every 1.2 s, each landing on a footfall in the score
    const st = clamp((t - 291.6) / 1.2, 0, 4.2), vx = 17.2 - st * 1.15, ph = st * PI;   // a foot comes down at st = 0.5, 1.5, … = each footfall in the score
    const plant = VSTEPS.some((s) => t > s && t < s + 0.12);
    if (t < 297.2) {
      // from the planks beside the fallen two: the Bellwether turns; something walks out of the white
      const u = lin(292, 297.2, t);
      lookAt(-13.4 + u * 0.9, 1.25, -0.9, 14, 3.1 - u * 0.15, -1.6, 46);
      harbour(t, { noGulls: true });
      harbourHush(t, () => 1);
      hollowCrowd(t, { dark: 1, part: sstep(292.4, 294.5, t) });
      bellwether(t, DY, { arms: lerp(-0.9, 0.9, eio(lin(292.0, 293.6, t))), ring: 0 }, { flip: t > 293.2, rim: { side: 1, T: T_VIO, a: 0.3 * lin(292.5, 295, t) } });
      atFeet('tamo', { view: 'side', eyes: t > 294.5 ? 'half' : 'closed', brows: 'worried', armF: -2.6, armB: 2.4, bob: 0, mouth: 0.1 }, -3.75, DY + 0.36, TZ, PI / 2, { gy: DY, sx: -3.0, sr: 0.9, dark: 1 });
      atFeet('kaira', { view: 'side', eyes: 'closed', brows: 'worried', armF: 2.6, armB: -2.5, blade2: 2.4, bob: 0 }, -4.8, DY + 0.36, KZ + 0.3, PI / 2, { gy: DY, sx: -4.3, sr: 0.9, dark: 1 });
      fogDepth(9, 40, 0.85);
      const vs = vesper3({ step: ph, wind: 1.5, eyeGlow: 0.3 }, vx, DY, VZ, { size: 1.8, flip: true, dark: 2, tint: { T: T_FOG, a: 0.85 * (1 - sstep(292.0, 295.6, t)) }, rim: { side: 1, T: T_VIO, a: 0.4 } });
      // the lantern's light, the eyes, the dust of each footfall
      if (vs) { glow(vs.lantern[0], vs.lantern[1], 7 * vs.S, T_VIO, 0.35); glow(vs.eyes[0], vs.eyes[1], 3 * vs.S, T_VIO, 0.5); }
      for (let k = 0; k < VSTEPS.length; k++) { const g = t - VSTEPS[k]; if (g > 0 && g < 1.2) dust3(17.2 - ((VSTEPS[k] - 291.6) / 1.2) * 1.15, VZ, g, 0.9, 520 + k); }
      if (plant) shk(1.2);
    } else {
      // the helm, close; the eyes flare
      const u = lin(297.2, 298.5, t);
      lookAt(vx - 7.6 + u * 0.6, DY + 2.6, VZ - 2.4, vx, DY + 3.45, VZ, 40);
      harbour(t, { noGulls: true }); harbourHush(t, () => 1);
      fogDepth(4, 30, 0.8);
      const fl_ = sstep(297.35, 297.75, t);
      const vs = vesper3({ step: ph, wind: 2 + u, eyeGlow: fl_ }, vx, DY, VZ, { size: 1.8, flip: true, dark: 1, rim: { side: 1, T: T_VIO, a: 0.5 } });
      if (vs) { glow(vs.eyes[0], vs.eyes[1], (4 + fl_ * 10) * vs.S / 2, T_VIO, 0.85); if (fl_ > 0.3) for (const dx of [-2.5, 1.5]) sparkle(Math.round(vs.eyes[0] + dx * vs.S), Math.round(vs.eyes[1]), fl_ * 3 * vs.S, WHITE, C('violet', 7)); }
      for (let k = 0; k < 30; k++) { const yy = 40 + ih(k, 1, 530) * 190, x = frac(ih(k, 2, 530) - t * 0.08) * 600 - 60; lineF(x, yy, x + 30, yy, (xx, y2) => { if (bay(xx, y2) < 0.25) tintP(xx, y2, T_FOG, 0.6); }); }
    }
  });
