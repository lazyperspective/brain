/* SHEET 19 — "The Bystander": an original ink character standing behind a press scrum, pulling a run of faces
   while the speaker talks. The pen draws the scene; then the bystander is redrawn ~12 times a second, synced to the audio. */
(window.SCENES = window.SCENES || []).push({
  name: 'The Bystander', seed: 7719, ink: '#111111', theme: 'pencil', audio: 'audio/bystander.m4a', loop: 19.2,
  build(P) {
    const S = Sketch, TAU = S.TAU, lerp = S.lerp, K = '#111111', Wh = '#ffffff', RED = '#7a0c10', R = (a, b) => P.r(a, b);
    const ENV = [0,0.42,1,0.63,0.27,0.81,0.88,1,0.33,0.94,0.83,0.65,0.62,0.94,0.96,0.66,0.62,0.53,0.56,1,0.78,0.9,0.53,0.33,0.89,0.98,0.66,0.65,1,0.57,0.42,0.99,0.84,0.67,0.8,0.62,0.59,1,0.55,0.39,0.42,0.42,0.58,0.61,0.6,0.67,0.58,0.64,0.62,0.67,0.62,0.57,0.56,0.54,0.6,1,0.98,0.12,0.26,1,0.86,0.79,0.27,0.42,0.96,0.97,0.5,0.16,0.29,1,0.9,0.9,0.4,0.93,1,0.79,0.71,0.43,0.25,0.49,1,0.7,0.69,0.85,0.57,1,0.81,0.63,0.41,1,0.83,0.56,0.36,1,0.53,0.81,0.7,0.32,1,0.87,0.79,0.8,0.75,0.67,0.55,0.87,0.99,0.55,0.24,0.73,0.69,0.86,0.78,0.73,0.82,0.83,0.83,0.57,0.72,0.21,0.32,0.97,0.6,0.85,1,0.56,0.93,0.51,1,0.98,0.57,0.91,0.98,0.46,0.93,0.76,0.6,0.67,0.71,0.9,0.88,0.86,0.44,0.95,1,0.87,0.54,0.62,0.39,0.89,1,0.9,0.87,0.27,0.53,0.52,0.44,0.46,0.52,0.47,0.37,0.52,0.58,0.57,0.56,0.67,0.5,0.84,1,0.77,0.75,0.54,0.4,0.26,0.42,0.5,0.41,0.45,0.55,0.67,0.57,0.56,0.56,0.38,1,0.91,0.27,0.71,0.81,0.55,0.66,1,0.41,1,0.79,0.33,0.88,1,0.87,0.23,1,0.36,0.43,0.3,0.63,0.78,1,0.48,0.22,1,0.9,0.67,0.7,0.42,0.39,0.45,0.5,0.37,0.42,0.42,0.49,0.47,0.96,0.5,0.91,0.85,0.81,0.65,1,1,1,0.44,1,0.66,0.44,0.54,0.46,1,0.87,0.67,0.45,0.38,0.87,0.91,0.59,0.65,0.72,0.8,0.5,0.21,0.33,0.96,0.88,0.78,0.7,0.8,0.72,0.35,0.32,0.42,0.32,0.42,0.43,0.56,0.48,0.44,0.4,1,0.67,0.25,1,0.98,0.65,0.59,1,0.81,0.17,0.5,0.94,0.94,0.93,0.45,0.48,0.78,0.59,0.46,0.55,0.53,0.65,0.58,0.51,0.57,0.64,0.48,0.48,0.47,0.41,0.54,0.54,1,1,0.69,0.84,0.46,0.5,1,0.87,0.77,0.16,0.77,1,0.96,0.46,0.74,1,0.49,1,0.98,0.69,0.8,0.34,1,0.72,0.35,0.59,0.83,0.64,1,0.75,0.6,0.44,0.37,0.37,0.49,0.51,0.43,0.59,0.74,0.81,0.86,0.81,0.54,0.64,0.91,1,0.44,0.32,0.96,0.99,0.19,0.9,0.98,1,0.68,0.81,0.33,0.99,1,1,0.84,0.97,1,0.76,0.41,0.18,0.48,0.5,1,1,1,0.89,0.54,0.37,0.92,0.93,0.86,0.81,1,0.85,0.86,0.41,0.48,0.39,0.33];
    /* ---------- live groups: drawn once by the pen, then redrawn by the player every frame ---------- */
    const anims = P.anims = [];
    const live = (fn, o = {}) => { const i0 = P.ops.length; fn(0); anims.push(Object.assign({ i0, i1: P.ops.length, fn: (Q, tt) => { const keep = P; P = Q; try { fn(tt); } finally { P = keep; } } }, o)); };
    const LOOP = 19.2, clock = tt => { if (!tt) return 0; const c = (typeof window !== 'undefined' && window.__sceneClock) ? window.__sceneClock() : tt; return ((c % LOOP) + LOOP) % LOOP; };
    /* ---------- ink vocabulary ---------- */
    const white = pts => P.occlude(pts, Wh), black = pts => P.wash(pts, '#070707', 1, { edge: 0, jit: 0, steps: 1 });
    const polyL = (pts, w = 1, c = K, closed = true) => P.path(closed ? pts.concat([pts[0]]) : pts, { w, c, a: 0.95, rough: 0.25, passes: 1 });
    const ell = (cx, cy, rx, ry, n = 28, rot = 0) => Array.from({ length: n }, (_, i) => { const a = i * TAU / n, x = Math.cos(a) * rx, y = Math.sin(a) * ry; return [cx + x * Math.cos(rot) - y * Math.sin(rot), cy + x * Math.sin(rot) + y * Math.cos(rot)]; });
    const fringe = (pts, cx, cy, r, o = {}) => { const rows = o.rows ?? 3; for (let i = 0; i < pts.length; i++) { const [x, y] = pts[i], a = Math.atan2(y - cy, x - cx), sh = -Math.cos(a - (o.light ?? -2.4)); if (sh < -0.05) continue; for (let m = 0; m < rows; m++) { const s0 = 1 + m * r * 0.09, L = r * (0.1 + 0.16 * sh) * (1 - m * 0.25); if (L < 1) continue; P.line(x - Math.cos(a) * s0, y - Math.sin(a) * s0, x - Math.cos(a) * (s0 + L), y - Math.sin(a) * (s0 + L), { w: 0.45, c: o.c ?? K, passes: 1, over: 0, rough: 0.1 }); } } };
    const lump = (cx, cy, r, o = {}) => { const pts = P.sample(Array.from({ length: 12 }, (_, i) => { const a = i * TAU / 12; return [cx + Math.cos(a) * r * R(0.8, 1.15), cy + Math.sin(a) * r * 0.85 * R(0.8, 1.12)]; }), true, 2); white(pts); fringe(pts, cx, cy, r, o); P.stipple(pts, Math.round(r * r * 0.14), { a: 0.9, r: 0.6, c: K, fade: (x, y) => Math.max(0, ((x - cx) * 0.7 + (y - cy)) / (r * 1.2)) }); polyL(pts, o.w ?? 1.4); return pts; };
    const shade = (pts, o = {}) => P.hatch(pts, Object.assign({ ang: -50, gap: 2.6, c: K, a: 0.7, w: 0.5 }, o));

    /* ================= BACKGROUND (drawn once by the pen) ================= */
    // a hedge of Peter-style lumps
    for (let row = 0; row < 4; row++) for (let x = -20; x < 1640; x += R(34, 58)) lump(x, 40 + row * 58 + R(-14, 14), R(26, 44) - row * 3, { rows: 3 });
    P.stipple([[0, 0], [1600, 0], [1600, 260], [0, 260]], 2200, { a: 0.7, r: 0.5, c: K, fade: (x, y) => Math.max(0, 1 - y / 300) });
    // a railing and a low fence
    { const F = [[0, 250], [1600, 236], [1600, 330], [0, 342]]; white(F); shade(F, { ang: 0, gap: 3.4, a: 0.55 }); polyL(F, 1.6); for (let x = 30; x < 1600; x += 110) { const pst = [[x, 244], [x + 16, 243], [x + 16, 336], [x, 337]]; white(pst); shade(pst, { ang: 90, gap: 2.2, a: 0.9 }); polyL(pst, 1.2); } P.line(0, 272, 1600, 258, { w: 2.4, c: K, passes: 1, over: 0 }); P.line(0, 300, 1600, 288, { w: 1.2, c: K, passes: 1, over: 0 }); }
    // the deadpan crowd behind him: two calm faces who have seen it all
    const CROWD = [[560, 380, 92, 1], [1420, 360, 96, -1]];
    CROWD.forEach(([x, y, r, s]) => { const suit = [[x - r * 1.7, 1000], [x - r * 1.5, y + r * 1.4], [x, y + r * 1.15], [x + r * 1.5, y + r * 1.4], [x + r * 1.7, 1000]]; white(suit); shade(suit, { ang: 60, gap: 3, a: 0.75 }); shade(suit, { ang: -30, gap: 6, a: 0.4 }); polyL(suit, 1.4);
      P.line(x, y + r * 1.15, x - r * 0.35, y + r * 2.1, { w: 1, c: K, passes: 1, over: 0 }); P.line(x, y + r * 1.15, x + r * 0.35, y + r * 2.1, { w: 1, c: K, passes: 1, over: 0 });
      const h = ell(x, y, r * 0.82, r); white(h); fringe(h, x, y, r, { rows: 3 }); P.stipple(h, 420, { a: 0.8, r: 0.55, c: K, fade: (px, py) => Math.max(0, (px - x) / r * s + 0.2) }); polyL(h, 1.6);
      const hair = [[x - r * 0.82, y - r * 0.2], [x - r * 0.7, y - r * 0.85], [x, y - r * 1.05], [x + r * 0.7, y - r * 0.85], [x + r * 0.82, y - r * 0.2], [x + r * 0.5, y - r * 0.6], [x - r * 0.3, y - r * 0.55]]; black(hair); for (let k = 0; k < 9; k++) P.line(x - r * 0.6 + k * r * 0.14, y - r * 0.9, x - r * 0.5 + k * r * 0.13, y - r * 0.6, { w: 0.6, c: Wh, passes: 1, over: 0 });
      P.line(x - r * 0.28, y + r * 0.45, x + r * 0.28, y + r * 0.45, { w: 2, c: K, passes: 1, over: 0 }); P.curve([[x + s * r * 0.05, y - r * 0.05], [x + s * r * 0.18, y + r * 0.2], [x + s * r * 0.02, y + r * 0.24]], { w: 1.2, c: K, passes: 1, rough: 0.1 }); });
    // the boom mic's furry windscreen poking in from the top
    { const bx = 420, by = 150; P.line(0, 40, bx - 40, by - 20, { w: 5, c: K, passes: 1, over: 0 }); const fur = ell(bx, by, 70, 34, 60, 0.25); white(fur); for (let i = 0; i < 300; i++) { const a = R(0, TAU), rr = Math.sqrt(R(0, 1)), x = bx + Math.cos(a) * 66 * rr, y = by + Math.sin(a) * 30 * rr, d = R(3, 8); P.line(x, y, x + Math.cos(a) * d, y + Math.sin(a) * d, { w: 0.5, c: K, passes: 1, over: 0, rough: 0.2 }); } fur.forEach(([x, y], i) => { const a = Math.atan2(y - by, x - bx); P.line(x, y, x + Math.cos(a + R(-0.5, 0.5)) * 10, y + Math.sin(a + R(-0.5, 0.5)) * 10, { w: 0.7, c: K, passes: 1, over: 0 }); }); }

    /* ================= THE EXPRESSION TIMELINE (read off the clip, pushed further) ================= */
    const D = { turn: 0, gx: 0, gy: 0, open: 1, squint: 0, bL: 0, bR: 0, knit: 0, mw: 1, smile: 0, purse: 0, twist: 0, teeth: 0, puff: 0, sweat: 0, blush: 0, duck: 0, tilt: 0, chin: 0, wob: 0 };
    const KEYS = [
      [0.0, { turn: 0.35, gx: 0.7, purse: 0.5, smile: -0.1, bL: 0.1, bR: 0.3 }],
      [1.2, { turn: 0.35, gx: 0.8, purse: 0.6, squint: 0.4, twist: 0.3, bR: 0.6 }],
      [2.0, { gx: 0, purse: 0.3, smile: -0.4, mw: 0.9, bL: 0.5, bR: 0.5, knit: 0.2 }],
      [3.2, { turn: 0.05, purse: 0.75, twist: -0.4, bL: 0.7, bR: 0.2, wob: 0.5 }],
      [4.0, { turn: -0.55, gx: -1, twist: 0.6, smile: 0.25, bL: 0.8, bR: -0.3 }],
      [5.3, { turn: -0.4, gx: -0.6, gy: 0.9, open: 0.45, twist: 0.5, puff: 0.35, smile: 0.1 }],
      [6.4, { turn: -0.1, open: 0, squint: 1, puff: 0.85, mw: 0.6, smile: -0.2, knit: 0.6, sweat: 0.2 }],
      [7.0, { open: 1.3, smile: -0.9, purse: 0.2, bL: 0.9, bR: 0.9, chin: 0.6 }],
      [8.0, { open: 1.1, smile: -1, purse: 0.8, knit: 0.8, bL: 0.3, bR: 0.6, chin: 1, wob: 1, sweat: 0.5 }],
      [9.5, { open: 0.9, smile: -1, purse: 0.9, twist: -0.5, knit: 0.9, chin: 1, wob: 1, sweat: 0.7 }],
      [10.2, { open: 1.25, teeth: 1, mw: 1.25, smile: -0.5, knit: 1, bL: 0.8, bR: 0.8, sweat: 0.9 }],
      [11.2, { teeth: 0.7, mw: 1.15, smile: -0.7, squint: 0.5, wob: 0.8, sweat: 0.9 }],
      [11.8, { purse: 0.7, smile: -0.6, chin: 0.8, wob: 0.5, sweat: 0.6 }],
      [12.6, { bL: 0.4, bR: 0.5, purse: 0.35, smile: -0.2, sweat: 0.3 }],
      [14.0, { bL: 0.5, bR: 0.2, purse: 0.4, twist: 0.3, gx: 0.3 }],
      [14.6, { gy: 1, open: 0.35, twist: 0.6, puff: 0.75, tilt: 0.1 }],
      [15.2, { duck: 1, tilt: 0.35, puff: 0.5, open: 0 }],
      [17.1, { duck: 1, tilt: 0.3, open: 0 }],
      [17.7, { smile: 0.55, blush: 0.9, bL: 0.6, bR: 0.6, gx: 0.2 }],
      [19.2, { turn: 0.35, gx: 0.7, purse: 0.5, smile: -0.1, bL: 0.1, bR: 0.3 }]
    ].map(([t, p]) => [t, Object.assign({}, D, p)]);
    const pose = t => { let i = 0; while (i < KEYS.length - 2 && KEYS[i + 1][0] <= t) i++; const [t0, a] = KEYS[i], [t1, b] = KEYS[i + 1], u = Math.max(0, Math.min(1, (t - t0) / (t1 - t0))), e = u * u * (3 - 2 * u), o = {}; for (const k in D) o[k] = a[k] + (b[k] - a[k]) * e;
      const bl = (t % 3.3) > 3.18 && o.open > 0.3 ? 0.08 : 1; o.open *= bl; return o; };

    /* ================= THE SPEAKER: a profile at the left edge, jaw flapping with the audio ================= */
    live(tt => { const t = clock(tt), e = ENV[Math.min(ENV.length - 1, Math.floor(t * 20))] || 0, jaw = e * 26, cx = 90, cy = 560;
      const suit = [[0, 1000], [0, 760], [180, 720], [330, 800], [360, 1000]]; white(suit); shade(suit, { ang: 55, gap: 2.4, a: 0.85 }); polyL(suit, 1.6);
      const head = [[0, 330], [120, 330], [230, 380], [280, 470], [300, 510], [345, 548], [300, 566], [296, 590], [322, 596 + jaw * 0.2], [300, 606 + jaw], [296, 640 + jaw], [250, 690 + jaw * 0.6], [170, 720], [0, 730]];
      white(head); fringe(head, cx, cy, 200, { rows: 3, light: 0.5 }); P.stipple(head, 700, { a: 0.8, r: 0.55, c: K, fade: (x) => Math.max(0, 1 - x / 260) }); polyL(head, 1.8);
      const hair = [[0, 320], [150, 318], [245, 370], [215, 400], [120, 380], [0, 420]]; black(hair); for (let k = 0; k < 12; k++) P.curve([[k * 20, 330], [k * 20 + 40, 345], [k * 20 + 90, 372]], { w: 0.7, c: Wh, passes: 1, rough: 0.1 });
      if (jaw > 4) { const m = [[300, 594], [322, 597 + jaw * 0.2], [300, 604 + jaw], [288, 600 + jaw * 0.6]]; black(m); }
      P.curve([[250, 450], [262, 446], [272, 452]], { w: 2.2, c: K, passes: 1 }); P.ellipse(258, 468, 5, 7, { w: 1.4, c: K, passes: 1 }); P.dot(261, 469, 3, { c: K });
      for (let k = 0; k < 3; k++) if (e > 0.5) P.curve([[352 + k * 14, 586 - k * 10], [362 + k * 16, 598], [352 + k * 14, 612 + k * 10]], { w: 0.9, c: K, passes: 1, rough: 0.1 }); }, { fps: 20 });

    /* ================= THE BYSTANDER ================= */
    const HX = 1010, HY = 420;
    live(tt => { const t = clock(tt), p = pose(t), shake = p.duck > 0.4 ? p.duck : 0;
      const ox = Math.sin(t * 38) * 7 * shake + p.duck * 50, oy = Math.abs(Math.sin(t * 19)) * 7 * shake + p.duck * 250;
      const cx = HX + ox, cy = HY + oy, tilt = p.tilt, pv = [HX, HY + 260];
      const T = (x, y) => { const X = x - pv[0] + ox, Y = y - pv[1] + oy; return [pv[0] + X * Math.cos(tilt) - Y * Math.sin(tilt), pv[1] + X * Math.sin(tilt) + Y * Math.cos(tilt)]; };
      const TL = pts => pts.map(([x, y]) => T(HX + x, HY + y));
      /* body: checked jacket, shirt, a red polka-dot bow tie; shoulders hunch when he laughs */
      const hunch = p.duck * 40, sx = HX + ox * 0.3;
      const neck = TL([[-58, 130], [58, 130], [62, 285], [-62, 285]]); white(neck); shade(neck, { ang: 80, gap: 2.4, a: 0.6 }); polyL(neck, 1.4);
      const jacket = [[sx - 430, 1000], [sx - 380, 790 - hunch], [sx - 150, 700 - hunch], [sx, 690], [sx + 150, 700 - hunch], [sx + 380, 790 - hunch], [sx + 430, 1000]];
      white(jacket); shade(jacket, { ang: 0, gap: 11, a: 0.8, w: 0.9 }); shade(jacket, { ang: 90, gap: 11, a: 0.8, w: 0.9 }); shade(jacket, { ang: 45, gap: 3.2, a: 0.55, w: 0.45 }); fringe(jacket, sx, 880, 330, { rows: 2 }); polyL(jacket, 2);
      const shirt = [[sx - 100, 690], [sx + 100, 690], [sx, 900]]; white(shirt); polyL(shirt, 1.2);
      [[-1, 1]].forEach(() => { P.path([[sx - 100, 690], [sx - 60, 800], [sx - 20, 920]], { w: 1.8, c: K, rough: 0.2, passes: 1 }); P.path([[sx + 100, 690], [sx + 60, 800], [sx + 20, 920]], { w: 1.8, c: K, rough: 0.2, passes: 1 }); });
      const by = 705; [[-1], [1]].forEach(([s]) => { const w = [[sx, by], [sx + s * 62, by - 26], [sx + s * 66, by + 26]]; white(w); shade(w, { ang: 30, gap: 2, c: RED, a: 0.9 }); for (let k = 0; k < 4; k++) P.dot(sx + s * (22 + k * 11), by + (k % 2 ? 8 : -8), 2.6, { c: RED }); polyL(w, 1.6); }); P.ellipse(sx, by, 12, 15, { w: 1.6, c: K, passes: 1 }); const knot = ell(sx, by, 11, 14); white(knot); shade(knot, { ang: 60, gap: 1.6, c: RED, a: 0.95 }); polyL(knot, 1.4);
      /* head */
      const RX = 150, RY = 185, fx = p.turn * 55;
      const earW = s => 28 * (1 + s * p.turn * 0.7);
      [-1, 1].forEach(s => { const ex = s * RX * 0.97, w = earW(-s); const ear = TL(ell(ex, 10, Math.max(8, w), 42, 18)); white(ear); fringe(ear, ...T(HX + ex, HY + 10), 40, { rows: 2 }); polyL(ear, 1.5); const inner = TL([[ex - s * 4, -14], [ex + s * w * 0.5, 4], [ex - s * 2, 30]]); P.path(inner, { w: 1, c: K, passes: 1, rough: 0.2 }); });
      const head = TL(Array.from({ length: 48 }, (_, i) => { const a = i * TAU / 48, s = Math.sin(a), c = Math.cos(a); let r = 1 + 0.07 * Math.max(0, s) - 0.05 * Math.max(0, -s); const cheek = Math.exp(-Math.pow((Math.abs(a - Math.PI / 2) - 0.95) / 0.35, 2)); r += p.puff * 0.12 * cheek; return [c * RX * r, s * RY * (1 + 0.03 * Math.max(0, s))]; }));
      const hc = T(HX, HY); white(head); fringe(head, hc[0], hc[1], 185, { rows: 4 }); P.stipple(head, 1400, { a: 0.8, r: 0.55, c: K, fade: (x, y) => Math.max(0, ((x - hc[0]) / RX + (y - hc[1]) / RY) * 0.8 - 0.1) }); polyL(head, 2.2);
      // three brave hairs and two side tufts
      [[-30, -1], [4, 1], [34, -1]].forEach(([hx, s], i) => P.curve(TL([[hx, -180], [hx + s * 16, -214 - i * 6], [hx - s * 10, -236], [hx + s * 6, -250]]), { w: 1.4, c: K, passes: 1, rough: 0.1 }));
      [-1, 1].forEach(s => { for (let k = 0; k < 6; k++) P.curve(TL([[s * (RX - 18), -90 + k * 12], [s * (RX + 8), -96 + k * 12], [s * (RX + 2), -80 + k * 12]]), { w: 1, c: K, passes: 1, rough: 0.2 }); });
      if (p.duck > 0.55) { // face buried: the top of his head, shaking with laughter
        const sh = TL(ell(-40, -120, 40, 22, 20, -0.3)); P.path(sh.slice(8, 16), { w: 3, c: Wh, passes: 1 }); P.path(TL([[-60, 120], [-20, 132], [20, 120]]), { w: 2, c: K, passes: 1 }); P.path(TL([[-70, 60], [-40, 50], [-10, 62]]), { w: 2, c: K, passes: 1 }); P.path(TL([[20, 62], [50, 50], [80, 60]]), { w: 2, c: K, passes: 1 });
        for (let k = 0; k < 5; k++) { const a = -2.4 + k * 0.35, q = T(HX + Math.cos(a) * 240, HY + Math.sin(a) * 250); P.line(q[0], q[1], q[0] + Math.cos(a) * 26, q[1] + Math.sin(a) * 26, { w: 1.6, c: K, passes: 1, over: 0 }); }
        const q = T(HX + 210, HY - 160); P.text('PFFT', q[0], q[1], { size: 30, c: RED }); const q2 = T(HX - 300, HY - 60); P.text('hk', q2[0], q2[1], { size: 20, c: K });
        return; }
      // forehead wrinkles when the brows go up
      const up = Math.max(0, (p.bL + p.bR) / 2); for (let k = 0; k < Math.round(up * 4); k++) P.curve(TL([[-70 + fx * 0.4, -130 + k * 14], [fx * 0.4, -138 + k * 14 - p.knit * 6], [70 + fx * 0.4, -130 + k * 14]]), { w: 0.9, c: K, passes: 1, rough: 0.3 });
      // eyes
      const sep = 60 * (1 - 0.2 * Math.abs(p.turn)), ey = -18, open = Math.max(0, p.open * (1 - 0.6 * p.squint));
      [-1, 1].forEach(s => { const ex = fx + s * sep, big = s * p.turn > 0 ? 1.08 : 0.94; const rx = 38 * big, ry = 32 * big * Math.min(1.45, open), pr = open > 1.12 ? 4.5 : 11;
        if (open < 0.15) { P.path(TL([[ex - 30, ey + 2], [ex - 10, ey - 10], [ex + 10, ey - 10], [ex + 30, ey + 2]]).map((q, i) => q), { w: 3, c: K, passes: 1 }); for (let k = 0; k < 3; k++) P.line(...T(HX + ex + s * 34, HY + ey - 6 + k * 8), ...T(HX + ex + s * 48, HY + ey - 12 + k * 12), { w: 1, c: K, passes: 1, over: 0 }); return; }
        const eye = TL(ell(ex, ey, rx, ry, 24)); white(eye); polyL(eye, 1.8); const pp = T(HX + ex + p.gx * rx * 0.45, HY + ey + p.gy * ry * 0.4); P.dot(pp[0], pp[1], pr * big, { c: K }); if (pr > 6) P.dot(pp[0] - 3, pp[1] - 3, 2.6, { c: Wh });
        const lid = TL(ell(ex, ey, rx + 1, ry + 1, 24).slice(12, 25)); P.path(lid, { w: 3.2, c: K, passes: 1 }); if (p.squint > 0.2) P.path(TL([[ex - rx, ey - ry * 0.3], [ex, ey - ry * 0.7], [ex + rx, ey - ry * 0.3]]), { w: 2, c: K, passes: 1 });
        P.curve(TL([[ex - 22, ey + ry + 8], [ex, ey + ry + 14], [ex + 22, ey + ry + 8]]), { w: 0.8, c: K, passes: 1 }); });
      // brows
      [-1, 1].forEach(s => { const b = s < 0 ? p.bL : p.bR, ex = fx + s * sep, yb = ey - 52 - b * 46, inner = p.knit * 22; const br = TL([[ex - s * 40, yb - 2 + inner * 0.2], [ex, yb - 12], [ex + s * 44, yb + inner], [ex + s * 42, yb + 13 + inner], [ex, yb + 5], [ex - s * 38, yb + 11]]); black(br); });
      // nose: a big bulb
      const nx = fx * 1.2, nose = TL(ell(nx, 50, 30, 26, 22)); white(nose); P.path(nose.slice(0, 16), { w: 1.8, c: K, passes: 1 }); P.stipple(nose, 90, { a: 0.8, r: 0.55, c: K, fade: (x, y) => Math.max(0, (x - T(HX + nx, 0)[0]) / 30) }); [-1, 1].forEach(s => { const q = T(HX + nx + s * 12, HY + 62); P.dot(q[0], q[1], 3, { c: K }); });
      // cheeks puffed
      if (p.puff > 0.2) [-1, 1].forEach(s => P.path(TL(ell(fx + s * 92, 80, 40, 30, 20).slice(s < 0 ? 8 : 14, s < 0 ? 14 : 20)), { w: 1.2, c: K, passes: 1 }));
      // mouth
      const mx = fx * 1.05, my = 122, w = 100 * p.mw * (1 - 0.5 * p.purse), wob = Math.sin(t * 31) * 7 * p.wob, yl = -p.smile * 36 + p.twist * 24 + wob, yr = -p.smile * 36 - p.twist * 24 - wob, mid = p.smile * 22;
      if (p.teeth > 0.3) { // the clenched, teeth-bared grimace: a wide box of a mouth, two rows of teeth
        const o = 54 * p.teeth, top = my - 16, bot = my + o, cl = my + yl * 0.5, cr = my + yr * 0.5;
        const m = TL([[mx - w, cl], [mx - w * 0.6, top + 4], [mx, top - 4], [mx + w * 0.6, top + 4], [mx + w, cr], [mx + w * 0.6, bot], [mx, bot + 6], [mx - w * 0.6, bot]]); black(m);
        const up = TL([[mx - w * 0.82, cl - 2], [mx - w * 0.55, top + 7], [mx, top + 1], [mx + w * 0.55, top + 7], [mx + w * 0.82, cr - 2], [mx + w * 0.5, top + o * 0.45], [mx - w * 0.5, top + o * 0.45]]); white(up);
        const dn = TL([[mx - w * 0.75, cl + 4], [mx - w * 0.45, bot - o * 0.35], [mx + w * 0.45, bot - o * 0.35], [mx + w * 0.75, cr + 4], [mx + w * 0.5, bot - 3], [mx, bot + 2], [mx - w * 0.5, bot - 3]]); white(dn);
        for (let k = -4; k <= 4; k++) { const x = mx + k * w * 0.17; P.line(...T(HX + x, HY + top + 2), ...T(HX + x, HY + top + o * 0.45), { w: 1.1, c: K, passes: 1, over: 0 }); P.line(...T(HX + x + w * 0.08, HY + bot - o * 0.35), ...T(HX + x + w * 0.08, HY + bot), { w: 1.1, c: K, passes: 1, over: 0 }); }
        polyL(up, 1); polyL(dn, 1); polyL(m, 2.6); [[-1, cl], [1, cr]].forEach(([sg, yy]) => { for (let k = 0; k < 3; k++) P.line(...T(HX + mx + sg * (w + 6), HY + yy - 10 + k * 10), ...T(HX + mx + sg * (w + 22), HY + yy - 16 + k * 16), { w: 1, c: K, passes: 1, over: 0 }); }); }
      else if (p.purse > 0.45) { const r2 = w * 0.62, pk = TL(Array.from({ length: 20 }, (_, i) => { const a = i * TAU / 20; return [mx + Math.cos(a) * r2 * (1 + 0.14 * Math.sin(a * 5 + t * 20 * p.wob)), my + (yl + yr) / 2 * 0.4 + Math.sin(a) * 26 * (1 + 0.1 * Math.sin(a * 3 + t * 17 * p.wob))]; })); P.hatch(pk, { ang: 20, gap: 2.4, c: RED, a: 0.55, w: 0.6 }); white(pk); polyL(pk, 2.4); P.path(TL([[mx - r2 * 0.6, my + (yl + yr) * 0.2], [mx + r2 * 0.6, my + (yl + yr) * 0.2]]), { w: 1.8, c: K, passes: 1 }); for (let k = 0; k < 10; k++) { const a = k * TAU / 10; P.line(...T(HX + mx + Math.cos(a) * (r2 + 6), HY + my + Math.sin(a) * 32), ...T(HX + mx + Math.cos(a) * (r2 + 16), HY + my + Math.sin(a) * 42), { w: 0.7, c: K, passes: 1, over: 0 }); } }
      else { const line = TL([[mx - w, my + yl], [mx - w * 0.5, my + mid * 0.8 + (yl * 0.3)], [mx, my + mid], [mx + w * 0.5, my + mid * 0.8 + (yr * 0.3)], [mx + w, my + yr]]); P.path(line, { w: 4.2, c: K, passes: 1, rough: 0.2 }); if (p.smile < -0.3) { const lip = TL([[mx - w * 0.8, my + yl * 0.9 + 10], [mx, my + mid + 20 + 14 * -p.smile], [mx + w * 0.8, my + yr * 0.9 + 10]]); P.path(lip, { w: 2.2, c: K, passes: 1 }); P.hatch(TL([[mx - w * 0.7, my + yl * 0.8 + 6], [mx + w * 0.7, my + yr * 0.8 + 6], [mx, my + mid + 18 + 14 * -p.smile]]), { ang: 10, gap: 2.2, c: RED, a: 0.5, w: 0.6 }); } P.path(TL([[mx - w * 0.4, my + mid + 16], [mx, my + mid + 20], [mx + w * 0.4, my + mid + 16]]), { w: 1, c: K, passes: 1 }); [[-1, yl], [1, yr]].forEach(([s, yy]) => P.path(TL([[mx + s * (w + 2), my + yy - 6], [mx + s * (w + 8), my + yy], [mx + s * (w + 2), my + yy + 6]]), { w: 1.2, c: K, passes: 1 })); }
      // pouty chin: dimples and a little shelf
      if (p.chin > 0.3) { const ch = TL(ell(mx, 176, 52, 22, 18)); P.stipple(ch, Math.round(160 * p.chin), { a: 0.9, r: 0.7, c: K }); P.path(TL([[mx - 36, 158], [mx, 150 - 8 * p.chin], [mx + 36, 158]]), { w: 1.2, c: K, passes: 1 }); }
      // sweat and blush
      if (p.sweat > 0.1) for (let k = 0; k < Math.round(p.sweat * 3); k++) { const d = (t * 40 + k * 23) % 60, x0 = (k % 2 ? 1 : -1) * (RX * 0.75) + fx * 0.3, y0 = -100 + k * 18 + d; const drop = TL([[x0, y0 - 12], [x0 + 7, y0 + 2], [x0, y0 + 9], [x0 - 7, y0 + 2]]); white(drop); polyL(drop, 1.2); P.dot(...T(HX + x0 - 2, HY + y0 + 1), 1.6, { c: K }); }
      if (p.blush > 0.1) [-1, 1].forEach(s => { const bl = TL(ell(fx + s * 96, 70, 30, 14, 16)); P.hatch(bl, { ang: 70, gap: 3, c: RED, a: 0.9 * p.blush, w: 1 }); });
      if (p.teeth > 0.6 || p.wob > 0.8) { const q = T(HX + 230, HY - 150); for (let k = 0; k < 3; k++) P.curve([[q[0] + k * 12, q[1] - k * 6], [q[0] + 10 + k * 12, q[1] + 8 - k * 6], [q[0] + k * 12, q[1] + 16 - k * 6]], { w: 1.4, c: K, passes: 1 }); }
    }, { fps: 12 });

    // the deadpan neighbours blink, and the one on the right slowly slides his eyes over to look at him
    live(tt => { const t = clock(tt); CROWD.forEach(([x, y, r, s], i) => { const slide = i === 1 ? Math.max(0, Math.min(1, (t - 8) / 1.5)) * (t < 13 ? 1 : Math.max(0, 1 - (t - 13))) : 0, dx = -slide * r * 0.12, blink = ((t + i * 1.7) % 4.1) > 3.95;
        [-1, 1].forEach(e => { const ex = x + e * r * 0.3, eyy = y - r * 0.05; if (blink) P.line(ex - 8, eyy, ex + 8, eyy, { w: 2, c: K, passes: 1, over: 0 }); else { white(ell(ex, eyy, 10, 7, 14)); P.ellipse(ex, eyy, 10, 7, { w: 1.2, c: K, passes: 1 }); P.dot(ex + dx, eyy + 1, 4, { c: K }); } }); }); }, { fps: 12 });

    P.text('THE BYSTANDER', 1560, 980, { size: 11, align: 'right', a: 0.75 });
  }
});
