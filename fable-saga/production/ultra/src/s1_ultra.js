  /* ================================================================ ultrathink (0:00–0:15) */
  {
  // ---------------------------------------------------------------- the maze: a wall of code blocks, MW × MH cells
  const MW = 25, MH = 13, MZ = new Uint8Array(MW * MH);          // 1 = block (wall), 0 = corridor
  MZ.fill(1);
  {
    const stack = [[1, 7]]; MZ[7 * MW + 1] = 0; let n = 0;
    while (stack.length) {
      const [cx, cy] = stack[stack.length - 1], opts = [];
      for (const [dx, dy] of [[2, 0], [-2, 0], [0, 2], [0, -2]]) { const nx = cx + dx, ny = cy + dy; if (nx > 0 && nx < MW - 1 && ny > 0 && ny < MH - 1 && MZ[ny * MW + nx]) opts.push([nx, ny, dx, dy]); }
      if (!opts.length) { stack.pop(); continue; }
      const [nx, ny, dx, dy] = opts[fl(ih(n++, cx * 31 + cy, 7101) * opts.length)];
      MZ[(cy + dy / 2) * MW + cx + dx / 2] = 0; MZ[ny * MW + nx] = 0; stack.push([nx, ny]);
    }
    MZ[7 * MW + 0] = 0; MZ[5 * MW + MW - 1] = 0;                    // the way in (left) and the way out (right)
  }
  const IN = [0, 7], OUT = [MW - 1, 5];
  // the search: distance of every corridor cell from the way in, and the one path through
  const DIST = new Int16Array(MW * MH).fill(-1), PREV = new Int32Array(MW * MH).fill(-1);
  { const q = [IN[1] * MW + IN[0]]; DIST[q[0]] = 0; for (let h = 0; h < q.length; h++) { const i = q[h], x = i % MW, y = (i / MW) | 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= MW || ny >= MH) continue; const j = ny * MW + nx; if (MZ[j] || DIST[j] >= 0) continue; DIST[j] = DIST[i] + 1; PREV[j] = i; q.push(j); } } }
  const PATH = []; for (let i = OUT[1] * MW + OUT[0]; i >= 0; i = PREV[i]) PATH.unshift(i);
  const ONP = new Uint8Array(MW * MH); for (const i of PATH) ONP[i] = 1;
  let MAXD = 0; for (let i = 0; i < MW * MH; i++) MAXD = Math.max(MAXD, DIST[i]);
  const T_ICE = mkTab('40a0ff', true);

  // the camera: world (cell units) → screen. cam = [cx, cy, k] (k: screen px per cell)
  let CAM = [0, 0, 20];
  const SX = (wx) => (wx - CAM[0]) * CAM[2] + 240, SY = (wy) => (wy - CAM[1]) * CAM[2] + 135;
  // a keyed track (numbers or arrays): [[t, v, ease]]
  function uK(keys, t) {
    const E_ = { o: eoc, i: eic, io: eio, b: eob, l: (u) => u };
    if (t <= keys[0][0]) return keys[0][1];
    for (let n = 1; n < keys.length; n++) if (t < keys[n][0]) { const [t0, a] = keys[n - 1], [t1, b, e] = keys[n], u = E_[e || 'io']((t - t0) / (t1 - t0)); return Array.isArray(a) ? a.map((v, k) => lerp(v, b[k], u)) : lerp(a, b, u); }
    return keys[keys.length - 1][1];
  }

  /* the wall, drawn per pixel: each block a bevelled tile of night-violet glass with lines of code glowing in it; the
     corridors dark grooves. o: { frozen (blue time-stop), search (0..MAXD+ the wavefront), path (0..1 how much of the gold
     path is lit), shatter (seconds since it broke; the blocks fly), chips: [[cell, g]] } */
  const CODE = [90, 89, 85, 59, 74, 56, 83];
  function wall(t, o) {
    const k = CAM[2], x0 = Math.max(0, fl(SX(0))), x1 = Math.min(W - 1, Math.ceil(SX(MW))), y0 = Math.max(LB, fl(SY(0))), y1 = Math.min(H - LB - 1, Math.ceil(SY(MH)));
    const sh = o.shatter || 0;
    if (sh > 0) return;                                            // (drawn as flying blocks instead)
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const wx = (x + 0.5 - 240) / k + CAM[0], wy = (y + 0.5 - 135) / k + CAM[1], cx = fl(wx), cy = fl(wy);
      if (cx < 0 || cy < 0 || cx >= MW || cy >= MH) continue;
      const i = cy * MW + cx, fx = wx - cx, fy = wy - cy;
      let c;
      if (MZ[i]) {
        // a block: bevel (lit top-left, dark bottom-right), glass body, code lines
        const e = Math.min(fx, fy, 1 - fx, 1 - fy);
        if (e < 0.07) c = fx < 0.07 || fy < 0.07 ? 8 : 2;
        else {
          c = (fx + fy) < 0.8 ? 5 : 4;
          const row = fl((fy - 0.14) / 0.17), inRow = frac((fy - 0.14) / 0.17);
          if (row >= 0 && row < 4 && inRow > 0.3 && inRow < 0.7) {
            const len = 0.25 + ih(i, row, 7102) * 0.55, ind = 0.14 + (ih(i, row + 9, 7103) < 0.4 ? 0.12 : 0);
            if (fx > ind && fx < ind + len) { const tok = fl((fx - ind) / 0.13); if (ih(i * 7 + row, tok, 7104) < 0.82) c = CODE[fl(ih(i, row * 3 + tok, 7105) * CODE.length)]; }
          }
          // a slow shimmer of light running down the wall
          if (frac(cy * 0.13 + cx * 0.05 - t * 0.35) < 0.04 && e > 0.12) c = 7;
        }
      } else {
        // a corridor: a dark groove with a faint grid, lit by the search
        c = (fx < 0.04 || fy < 0.04) ? 2 : 1;
        if (o.search !== undefined && DIST[i] >= 0) {
          const d = o.search - DIST[i];
          if (d >= 0) c = d < 1.0 ? 22 : d < 2.5 ? 91 : d < 6 ? 90 : bay(x, y) < Math.max(0.3, 0.9 - d * 0.03) ? 89 : 88;
        }
        if (o.path > 0 && ONP[i]) { const pi = PATH.indexOf(i) / (PATH.length - 1); if (pi <= o.path) c = Math.abs(fy - 0.5) < 0.18 && Math.abs(fx - 0.5) < 0.18 + 0.32 ? 22 : 59; }
      }
      BUF[y * W + x] = c;
    }
    // chips knocked off by the failed swings
    for (const [cell, g] of o.chips || []) rocks(SX(cell[0]), SY(cell[1]), g, 14, 120, Math.max(1.5, k * 0.08), [4, 5, 90, 22], 7106 + cell[1], 200, PI + 0.3, 1.6);
  }
  // the wall in pieces: every block a tile flying out from the cut path, tumbling, falling
  function wallShatter(t, g) {
    const k = CAM[2];
    for (let cy = 0; cy < MH; cy++) for (let cx = 0; cx < MW; cx++) {
      const i = cy * MW + cx; if (!MZ[i]) continue;
      const r = ih(cx, cy, 7107), side = cy < 6 ? -1 : 1, vx = (cx - 12) * 6 + (r - 0.5) * 40, vy = side * (30 + r * 60) - 40;
      const x = SX(cx + 0.5) + vx * g, y = SY(cy + 0.5) + vy * g + 260 * g * g, rot = g * (2 + r * 6) * (r < 0.5 ? -1 : 1), s = k * (1 - g * 0.15);
      if (y > H + s || x < -s || x > W + s) continue;
      const ca = Math.cos(rot) * s * 0.5, sa = Math.sin(rot) * s * 0.5;
      z5Tri(x - ca + sa, y - sa - ca, x + ca + sa, y + sa - ca, x + ca - sa, y + sa + ca, g < 0.12 ? 22 : 5);
      z5Tri(x - ca + sa, y - sa - ca, x + ca - sa, y + sa + ca, x - ca - sa, y - sa + ca, g < 0.12 ? 22 : r < 0.5 ? 4 : 6);
      if (s > 6) P(x, y, CODE[fl(r * 7)]);
    }
  }
  const hero = (o) => HERO3(Object.assign({ sword: -1.0 }, o));

  /* the whole film is one world (the dawn cloud sea where part IV ended, the wall standing out of it) and one camera */
  const CAMK = [[0, [2.2, 7.2, 20]], [1.4, [1.6, 7.0, 22]], [3.6, [0.4, 6.8, 21]], [4.0, [-2.4, 6.6, 38], 'io'], [6.0, [-2.6, 6.6, 42]], [6.3, [-1.0, 6.6, 30], 'o'], [8.0, [8, 6.5, 19.5]], [10.0, [12.5, 6.5, 17]], [10.9, [12.5, 6.5, 17.6]], [11.0, [12.5, 6.5, 17.6]], [11.7, [12.5, 6.5, 17.2]], [12.4, [12.5, 6.8, 16]], [15, [12.5, 6.8, 15.2]]];
  // the hero (world units): walks up, swings, staggers back
  const HP = [[0, [-3.4, 8.3]], [1.3, [-1.3, 8.3]], [1.6, [-0.85, 8.3], 'i'], [1.85, [-1.6, 8.3], 'o'], [2.3, [-1.2, 8.3]], [2.6, [-0.8, 8.3], 'i'], [2.9, [-0.8, 8.3]], [3.3, [-2.6, 8.3], 'o'], [4.0, [-2.6, 8.3]], [11.0, [-2.6, 8.3]]];
  const SWK = [[0, -1.0], [1.2, -2.5], [1.6, 0.35, 'i'], [1.85, -0.6, 'o'], [2.25, -2.8], [2.6, 0.2, 'i'], [2.9, 0.15], [3.15, -1.4, 'o'], [4.0, -1.0], [5.6, -1.0], [6.0, -1.2]];
  shot(0, 15.0, (lt, t) => {
    CAM = uK(CAMK, t);
    // the world: the dawn above the cloud sea (frozen in time from 6.0 to 11.0)
    const frozen = t >= 6.0 && t < 11.0, tw = frozen ? 6.0 : t < 11 ? t : t - 5.0;
    highSky(tw, CAM[0] * 6, 400, 175, 0.05);
    // the wall, standing out of the cloud
    const shatter = t >= 11.8 ? t - 11.8 : 0, search = t >= 6.3 && t < 11.0 ? (t - 6.3) / 3.6 * (MAXD + 2) : t >= 10.0 && t < 11.0 ? MAXD + 3 : undefined;
    const path = t >= 10.0 && t < 11.8 ? clamp((t - 10.0) / 0.45, 0, 1) : 0;
    if (!shatter) wall(t, { search: t < 11 ? search : undefined, path, chips: [[[0, 8], t - 1.6], [[0, 8.4], t - 2.6]] });
    // the dash (11.0–11.6): a streak of gold racing the path, the hero at its head; the wall cracking behind it
    const dash = t >= 11.0 && t < 11.8 ? clamp((t - 11.0) / 0.6, 0, 1) : t >= 11.8 ? 1 : 0;
    if (t >= 11.0 && !shatter) {
      const n = Math.max(1, fl(eio(dash) * (PATH.length - 1)));
      for (let q = 0; q < n; q++) { const a = PATH[q], b = PATH[q + 1]; if (b === undefined) break; thick(SX(a % MW + 0.5), SY(fl(a / MW) + 0.5), SX(b % MW + 0.5), SY(fl(b / MW) + 0.5), Math.max(2, CAM[2] * 0.22), q > n - 4 ? 22 : 60); }
      // cracks spreading out from the cut through every block
      if (t > 11.5) for (let k = 0; k < 40; k++) { const cx = fl(ih(k, 1, 7108) * MW), cy = fl(ih(k, 2, 7108) * MH); if (MZ[cy * MW + cx] && ih(k, 3, 7108) < (t - 11.5) * 3.5) lineP(SX(cx), SY(cy + ih(k, 4, 7108)), SX(cx + 1), SY(cy + ih(k, 5, 7108)), 22); }
    }
    if (shatter) { wallShatter(t, shatter); megaHit(SX(12.5), SY(6.5), shatter, 3, -PI / 2, [22, 60, 59], 7109); }
    // the cloud in front of the wall's foot
    highFore(tw, CAM[0] * 9, SY(MH + 0.9));
    // ---------------------------------------------------------------- the hero
    const [hx, hy] = uK(HP, Math.min(t, 11)), sw = uK(SWK, Math.min(t, 6.0)), S = CAM[2] / 22 * 1.5;
    const gold = t >= 5.6, eyes = t < 2.7 ? 'angry' : t < 4.2 ? 'wide' : t < 6.0 ? 'closed' : 'glow';
    const stuck = t > 2.6 && t < 2.95;
    if (t < 11.0) {
      const x = SX(hx), y = SY(hy) + (t > 1.85 && t < 2.2 ? z5Knock(t - 1.85, -3, 14, 5) : 0);
      // the ghosts: copies of the hero pouring through the maze (frozen time), one at every cell of the wavefront
      if (search !== undefined && t < 10.4) {
        const fade = 1 - sstep(10.0, 10.4, t);
        for (let i = 0; i < MW * MH; i++) { if (DIST[i] < 0) continue; const d = search - DIST[i]; if (d < 0 || d > 1.6) continue; const gx = SX(i % MW + 0.5), gy = SY(fl(i / MW) + 0.5) + 1; actor(hero({ eyes: 'glow', sword: -0.6, form: 'storm' }), gx, gy, CAM[2] / 40, 0, i % 3 === 0, { still: true, color: 91, alpha: (0.8 - d * 0.3) * fade }); }
      }
      const a = actor(hero({ eyes, sword: sw, swordCols: gold ? GOLD_SW : undefined, mouth: t > 2.62 && t < 3.0 ? 2 : t > 1.6 && t < 1.8 ? 1 : 0, sq: stuck ? 0.15 : 0 }), x, y, S, t > 3.0 && t < 4 ? -0.12 : stuck ? 0.1 : 0, false, { still: frozen });
      if (gold) aura(t, AURA_GOLD, 3 * S + (t > 6 ? 2 : 0), { sparks: 6 });
      if (frozen) for (const [ex, ey] of [[x - 6.5 * S, y - 3.3 * S], [x + 4.5 * S, y - 3.3 * S]]) glow(ex, ey, 7 * S, T_ICE, 0.5);
      // the swings: sparks where the blade meets the wall
      for (const [h, p] of [[1.6, 1], [2.6, 1.5]]) { const g = t - h; if (g >= 0 && g < 0.35) { burst(SX(0), SY(8.2), g / 0.3, 22 * p, 10, h, [22, 59], 2); if (g < 0.1) glow(SX(0), SY(8.2), 30 * p, T_WH, 0.6); shk(3 * p * (1 - g / 0.35)); } }
      // the mustard: a drop falls out of the top of the frame onto the blade, plips, and the sword turns gold
      if (t > 5.25 && t < 6.2) {
        const tip = a.tip, u = clamp((t - 5.25) / 0.35, 0, 1), dx = tip[0], dy = lerp(LB + 50, tip[1] - 4, u * u);
        if (u < 1) { glow(dx, dy, 16, T_GOLD, 0.5); discF(dx, dy, 4, 51); discF(dx, dy, 3.2, 52); discF(dx, dy - 3, 2.4, 52); discF(dx, dy - 5, 1.4, 52); P(dx - 1, dy - 1, 53); P(dx - 1, dy - 2, 22); }
        else { const g = t - 5.6; for (let k = 0; k < 8; k++) { const an = -PI * (0.15 + 0.7 * ih(k, 1, 7110)), v = 40 + ih(k, 2, 7110) * 50; P(tip[0] + Math.cos(an) * v * g, tip[1] - 3 + Math.sin(an) * v * g + 120 * g * g, k % 2 ? 52 : 53); } if (g < 0.2) glow(tip[0], tip[1], 30, T_GOLD, 0.7 * (1 - g / 0.2)); }
      }
    } else if (t < 11.8) {
      // the hero at the head of its own cut
      const n = eio(dash) * (PATH.length - 1), q = Math.min(PATH.length - 2, fl(n)), f = n - q, A = PATH[q], B = PATH[q + 1];
      const x = SX(lerp(A % MW, B % MW, f) + 0.5), y = SY(lerp(fl(A / MW), fl(B / MW), f) + 0.5);
      actor(hero({ eyes: 'glow', sword: 0.1, swordCols: GOLD_SW }), x, y, CAM[2] / 30, 0, false);
      aura(t, AURA_GOLD, 5, { sparks: 10 });
    } else {
      // through, and out the other side, landing on the cloud; it turns, blade still gold
      // flung on through the falling blocks, it lands on the cloud below the words and turns to us, blade still gold
      const g = t - 11.8, u = eoc(clamp(g / 0.7, 0, 1)), x = lerp(SX(MW - 1), 262, u), y = lerp(SY(5.5), 212, u) - Math.sin(PI * u) * 30;
      actor(hero({ eyes: g > 1.4 && g < 1.5 ? 'closed' : 'normal', sword: g < 0.7 ? -1.0 : lerp(-1.0, 0.35, eio(clamp((g - 0.7) / 0.4, 0, 1))), swordCols: GOLD_SW, mouth: g > 1.0 ? 1 : 0 }), x, y, 1.6, Math.sin(PI * u) * -0.5, false);
      aura(t, AURA_GOLD, 4, { sparks: 4 });
    }
    // ---------------------------------------------------------------- time stopped: the world drained and tinted blue
    if (frozen) {
      const into = sstep(6.0, 6.15, t) * (1 - sstep(10.85, 11.0, t));
      mapFx(GREYM, 0.55 * into); tintAll(T_ICE, 0.18 * into);
      if (t < 6.1) shockRing(SX(-2.6), SY(8.0), 10 + (t - 6) * 2400, 6 + (t - 6) * 1400, 3, [91, 90, 22], 1 - (t - 6) / 0.1);
      // dust and embers hanging in the air, stopped
      for (let k = 0; k < 40; k++) { const x = ih(k, 1, 7111) * W, y = LB + ih(k, 2, 7111) * (H - 2 * LB); P(x, y, k % 3 ? 91 : 89); }
    }
    if (t >= 10.0 && t < 10.12) glow(SX(12.5), SY(6.5), 200, T_GOLD, 0.35 * (1 - (t - 10) / 0.12));
    if (t >= 11.0 && t < 11.04) tintAll(T_WH, 0.5);
    // ---------------------------------------------------------------- the words
    // the terminal line: a dark box at the bottom of the frame, "> ultrathink" typed out, a blinking cursor
    if (t > 4.1 && t < 6.6) {
      const bx = 150, by = 36, bw = 180, a_ = sstep(4.1, 4.25, t) * (1 - sstep(6.3, 6.6, t));
      for (let y = by; y < by + 24; y++) for (let x = bx; x < bx + bw; x++) if (bay(x, y) < a_ * 0.9) BUF[y * W + x] = y === by || y === by + 23 || x === bx || x === bx + bw - 1 ? 8 : 1;
      const full = '> ultrathink', nv = clamp(fl((t - 4.2) / 1.2 * 12) + 2, 0, 12), shown = full.slice(0, nv);
      if (a_ > 0.5) { text(shown, bx + 10, by + 6, (i, j, k) => (k < 2 ? 59 : 22), 2); if (fl(t * 3) % 2 === 0 || nv < 12) rectF(bx + 12 + textWidth(shown, 2), by + 6, 8, 14, 22); }
    }
    // the title: ULTRATHINK IS BACK.
    if (t >= 12.4) {
      const g = t - 12.4, s = 'ULTRATHINK', sc = g < 0.06 ? 7 : 6, w = textWidth(s, sc), x0 = 240 - w / 2, y0 = 70 - (sc - 6) * 4;
      for (const [dx, c] of [[-2, 85], [2, 83]]) text(s, x0 + dx, y0, c, sc);
      text(s, x0, y0, (i, j, k) => (j < 2 ? 22 : PRISM_C[k % 7]), sc, 0);
      if (g > 0.3) { const s2 = 'IS BACK.'; text(s2, 240 - textWidth(s2, 3) / 2, 122, (i, j) => (j < 2 ? 22 : 59), 3, 0, fl((g - 0.3) * 30)); }
      // a little drop of mustard, glinting, under the words
      if (g > 0.8) { const mx = 240 + textWidth('IS BACK.', 3) / 2 + 12, dy = 140 + Math.sin(t * 3) * 1; glow(mx, dy, 18, T_GOLD, 0.35); discF(mx, dy, 6.2, 51); discF(mx, dy, 5.4, 52); discF(mx, dy - 4.5, 4, 52); discF(mx, dy - 8, 2.6, 52); discF(mx, dy - 10.5, 1.4, 52); discF(mx - 2, dy - 2, 1.4, 53); P(mx - 2, dy - 3, 22); if (frac(t * 0.8) < 0.08) sparkle(mx + 1, dy - 2, 6, 22, 53); }
      if (g < 0.06) flashWhite(0.5 * (1 - g / 0.06));
      tintAll(T_DARK, sstep(14.2, 15.0, t));
    }
    if (t < 0.8) tintAll(T_DARK, 1 - eio(t / 0.8));
  });
  FLASH_CUTS.push(11.8);
  }
