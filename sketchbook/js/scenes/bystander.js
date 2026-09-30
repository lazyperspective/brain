/* SHEET 19 — "The Bystander": an original ink character standing behind a press scrum, pulling a run of faces
   while the speaker talks. The pen draws the scene; then the bystander is redrawn ~12 times a second, synced to the audio.
   His head is a small 3D rig (an egg-shaped ellipsoid that yaws, nods and rolls), so every feature foreshortens as he turns. */
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
    const line = (a, b, w = 1, c = K, al = 0.95) => P.line(a[0], a[1], b[0], b[1], { w, c, a: al, passes: 1, over: 0, rough: 0.15 });
    const curve = (pts, w = 1, c = K) => P.curve(pts, { w, c, passes: 1, rough: 0.15 });
    const ell = (cx, cy, rx, ry, n = 28, rot = 0) => Array.from({ length: n }, (_, i) => { const a = i * TAU / n, x = Math.cos(a) * rx, y = Math.sin(a) * ry; return [cx + x * Math.cos(rot) - y * Math.sin(rot), cy + x * Math.sin(rot) + y * Math.cos(rot)]; });
    const fringe = (pts, cx, cy, r, o = {}) => { const rows = o.rows ?? 3; for (let i = 0; i < pts.length; i++) { const [x, y] = pts[i], a = Math.atan2(y - cy, x - cx), sh = -Math.cos(a - (o.light ?? -2.4)); if (sh < -0.05) continue; for (let m = 0; m < rows; m++) { const s0 = 1 + m * r * 0.09, L = r * (0.1 + 0.16 * sh) * (1 - m * 0.25); if (L < 1) continue; P.line(x - Math.cos(a) * s0, y - Math.sin(a) * s0, x - Math.cos(a) * (s0 + L), y - Math.sin(a) * (s0 + L), { w: 0.45, c: o.c ?? K, passes: 1, over: 0, rough: 0.1 }); } } };
    const lump = (cx, cy, r, o = {}) => { const pts = P.sample(Array.from({ length: 12 }, (_, i) => { const a = i * TAU / 12; return [cx + Math.cos(a) * r * R(0.8, 1.15), cy + Math.sin(a) * r * 0.85 * R(0.8, 1.12)]; }), true, 2); white(pts); fringe(pts, cx, cy, r, o); P.stipple(pts, Math.round(r * r * 0.14), { a: 0.9, r: 0.6, c: K, fade: (x, y) => Math.max(0, ((x - cx) * 0.7 + (y - cy)) / (r * 1.2)) }); polyL(pts, o.w ?? 1.4); return pts; };
    const shade = (pts, o = {}) => P.hatch(pts, Object.assign({ ang: -50, gap: 2.6, c: K, a: 0.7, w: 0.5 }, o));
    const ballStick = (x, y, a, L, w = 0.8) => { const ex = x + Math.cos(a) * L, ey = y + Math.sin(a) * L; P.line(x, y, ex, ey, { w, c: K, passes: 1, over: 0, rough: 0.15 }); P.dot(ex, ey, w * 1.8 + 0.4, { c: K }); };

    /* ================= BACKGROUND (drawn once by the pen) ================= */
    // the hedge: packed lumps, then leaves, berries and ball-and-stick sprigs worked into the gaps
    for (let row = 0; row < 4; row++) for (let x = -20; x < 1640; x += R(34, 58)) lump(x, 40 + row * 58 + R(-14, 14), R(26, 44) - row * 3, { rows: 3 });
    P.stipple([[0, 0], [1600, 0], [1600, 262], [0, 262]], 3200, { a: 0.7, r: 0.5, c: K, fade: (x, y) => Math.max(0, 1 - y / 300) });
    for (let i = 0; i < 90; i++) { const x = R(10, 1590), y = R(10, 240); P.leaf(x, y, R(0, TAU), R(12, 22), R(4, 7), { w: 0.7, veins: 2 }); }
    for (let i = 0; i < 40; i++) { const x = R(20, 1580), y = R(20, 230); for (let k = 0; k < 5; k++) { const bx = x + R(-7, 7), by = y + R(-7, 7); P.circle(bx, by, 2.6, { w: 0.8, c: K, passes: 1 }); P.dot(bx - 0.8, by - 0.8, 0.8, { c: K }); } }
    for (let i = 0; i < 26; i++) { const x = R(20, 1580), y = R(8, 60); ballStick(x, y, -Math.PI / 2 + R(-0.6, 0.6), R(12, 26), 0.7); }
    // a railing and a plank fence with rivets, grain and a sign
    { const F = [[0, 250], [1600, 236], [1600, 334], [0, 346]]; white(F); shade(F, { ang: 0, gap: 3.4, a: 0.5 }); for (let y = 262; y < 340; y += 9) for (let x = R(0, 60); x < 1600; x += R(60, 160)) P.line(x, y - x * 0.0088, x + R(20, 60), y - (x + 40) * 0.0088, { w: 0.4, c: K, a: 0.7, passes: 1, over: 0 }); polyL(F, 1.6);
      for (let x = 30; x < 1600; x += 110) { const pst = [[x, 244], [x + 16, 243], [x + 16, 340], [x, 341]]; white(pst); shade(pst, { ang: 90, gap: 2.2, a: 0.9 }); polyL(pst, 1.2); [256, 318].forEach(y => { P.circle(x + 8, y, 2.4, { w: 0.8, c: K, passes: 1 }); P.dot(x + 8, y, 0.9, { c: K }); }); }
      P.line(0, 272, 1600, 258, { w: 2.6, c: K, passes: 1, over: 0 }); P.line(0, 276, 1600, 262, { w: 0.6, c: K, passes: 1, over: 0 }); P.line(0, 302, 1600, 290, { w: 1.2, c: K, passes: 1, over: 0 });
      P.stipple([[0, 340], [1600, 330], [1600, 356], [0, 366]], 900, { a: 0.8, r: 0.55, c: K, fade: (x, y) => Math.max(0, 1 - (y - 336) / 26) });
      // two pigeons on the rail, pecking at nothing
      [[1250, 250, 1], [1305, 248, -1]].forEach(([x, y, s]) => { const b = P.sample([[x - 22 * s, y + 2], [x - 6 * s, y - 14], [x + 10 * s, y - 12], [x + 18 * s, y - 22], [x + 26 * s, y - 18], [x + 22 * s, y - 8], [x + 14 * s, y + 4], [x - 4 * s, y + 8]], true, 2); white(b); fringe(b, x, y - 6, 20, { rows: 2 }); polyL(b, 1.3); P.dot(x + 20 * s, y - 18, 1.6, { c: K }); line([x + 26 * s, y - 17], [x + 32 * s, y - 15], 1.2); line([x - 2 * s, y + 6], [x - 4 * s, y + 13], 0.8); line([x + 6 * s, y + 6], [x + 6 * s, y + 13], 0.8); for (let k = 0; k < 4; k++) curve([[x - 12 * s + k * 5 * s, y - 6], [x - 4 * s + k * 5 * s, y - 2], [x - 10 * s + k * 5 * s, y + 3]], 0.5); }); }
    // the back row: small onlookers peeking over the fence, two holding phones up
    const BACK = [[700, 320, 34, 'hat'], [790, 330, 30, 'phone'], [1230, 318, 32, 'glasses'], [1330, 326, 30, 'phone'], [300, 330, 30, 'bald']];
    BACK.forEach(([x, y, r, kind]) => { const h = ell(x, y, r * 0.8, r, 22); white(h); fringe(h, x, y, r, { rows: 2 }); P.stipple(h, 120, { a: 0.8, r: 0.5, c: K, fade: (px) => Math.max(0, (px - x) / r) }); polyL(h, 1.2); P.dot(x - r * 0.28, y - r * 0.05, 1.8, { c: K }); P.dot(x + r * 0.28, y - r * 0.05, 1.8, { c: K }); line([x - r * 0.25, y + r * 0.45], [x + r * 0.2, y + r * 0.42], 1);
      if (kind === 'hat') { const hat = [[x - r * 1.1, y - r * 0.55], [x + r * 1.1, y - r * 0.55], [x + r * 0.7, y - r * 0.7], [x + r * 0.6, y - r * 1.5], [x - r * 0.6, y - r * 1.5], [x - r * 0.7, y - r * 0.7]]; white(hat); shade(hat, { ang: 90, gap: 1.8, a: 0.9 }); polyL(hat, 1.2); }
      else if (kind === 'glasses') { P.circle(x - r * 0.28, y - r * 0.05, r * 0.24, { w: 1.1, c: K, passes: 1 }); P.circle(x + r * 0.28, y - r * 0.05, r * 0.24, { w: 1.1, c: K, passes: 1 }); black([[x - r * 0.7, y - r * 0.6], [x - r * 0.5, y - r], [x + r * 0.5, y - r], [x + r * 0.75, y - r * 0.55], [x, y - r * 0.75]]); }
      else if (kind === 'bald') { curve([[x - r * 0.5, y - r * 0.8], [x - r * 0.2, y - r * 0.95], [x + r * 0.1, y - r * 0.9]], 1.4, Wh); }
      else { black([[x - r * 0.8, y - r * 0.5], [x - r * 0.6, y - r], [x + r * 0.6, y - r], [x + r * 0.8, y - r * 0.5], [x, y - r * 0.8]]); const ph = [[x + r * 0.6, y - r * 2.2], [x + r * 1.3, y - r * 2.3], [x + r * 1.35, y - r * 1.1], [x + r * 0.65, y - r * 1.0]]; white(ph); polyL(ph, 1.4); const sc = [[x + r * 0.7, y - r * 2.1], [x + r * 1.25, y - r * 2.18], [x + r * 1.28, y - r * 1.2], [x + r * 0.72, y - r * 1.12]]; shade(sc, { ang: 30, gap: 1.6, a: 0.8 }); P.circle(x + r * 0.98, y - r * 1.65, r * 0.16, { w: 0.8, c: K, passes: 1 }); line([x + r * 0.7, y - r * 0.9], [x + r * 0.9, y - r * 0.1], 3); } });
    // the deadpan neighbours: calm faces that have seen it all
    const CROWD = [[560, 380, 92, 1], [1420, 360, 96, -1]];
    CROWD.forEach(([x, y, r, s]) => { const suit = [[x - r * 1.7, 1000], [x - r * 1.5, y + r * 1.4], [x, y + r * 1.15], [x + r * 1.5, y + r * 1.4], [x + r * 1.7, 1000]]; white(suit); shade(suit, { ang: 60, gap: 3, a: 0.75 }); shade(suit, { ang: -30, gap: 6, a: 0.4 }); fringe(suit, x, y + r * 3, r * 1.6, { rows: 2 }); polyL(suit, 1.4);
      const lap = [[x - r * 0.5, y + r * 1.2], [x - r * 0.18, y + r * 2.4], [x - r * 0.62, y + r * 1.9]]; white(lap); polyL(lap, 1); const lap2 = lap.map(([px, py]) => [2 * x - px, py]); white(lap2); polyL(lap2, 1);
      const tie = [[x - r * 0.1, y + r * 1.2], [x + r * 0.1, y + r * 1.2], [x + r * 0.14, y + r * 2.3], [x, y + r * 2.5], [x - r * 0.14, y + r * 2.3]]; white(tie); shade(tie, { ang: 45, gap: 2.2, a: 0.9 }); polyL(tie, 1);
      const neck = [[x - r * 0.35, y + r * 0.8], [x + r * 0.35, y + r * 0.8], [x + r * 0.3, y + r * 1.2], [x - r * 0.3, y + r * 1.2]]; white(neck); shade(neck, { ang: 80, gap: 2.4, a: 0.6 }); polyL(neck, 1);
      [-1, 1].forEach(e => { const ear = ell(x + e * r * 0.8, y + r * 0.05, r * 0.14, r * 0.26, 14); white(ear); polyL(ear, 1.2); curve([[x + e * r * 0.82, y - r * 0.08], [x + e * r * 0.88, y + r * 0.05], [x + e * r * 0.82, y + r * 0.18]], 0.7); });
      const h = ell(x, y, r * 0.82, r); white(h); fringe(h, x, y, r, { rows: 3 }); P.stipple(h, 520, { a: 0.8, r: 0.55, c: K, fade: (px, py) => Math.max(0, (px - x) / r * s + 0.2) }); polyL(h, 1.6);
      const hair = [[x - r * 0.82, y - r * 0.2], [x - r * 0.7, y - r * 0.85], [x, y - r * 1.05], [x + r * 0.7, y - r * 0.85], [x + r * 0.82, y - r * 0.2], [x + r * 0.5, y - r * 0.6], [x - r * 0.3, y - r * 0.55]]; black(hair); for (let k = 0; k < 12; k++) P.line(x - r * 0.65 + k * r * 0.11, y - r * 0.92, x - r * 0.55 + k * r * 0.1, y - r * 0.6, { w: 0.6, c: Wh, passes: 1, over: 0 });
      [-1, 1].forEach(e => { black([[x + e * r * 0.46, y - r * 0.3], [x + e * r * 0.12, y - r * 0.26], [x + e * r * 0.12, y - r * 0.2], [x + e * r * 0.46, y - r * 0.23]]); curve([[x + e * r * 0.45, y + r * 0.12], [x + e * r * 0.3, y + r * 0.18], [x + e * r * 0.15, y + r * 0.12]], 0.6); });
      line([x - r * 0.28, y + r * 0.45], [x + r * 0.28, y + r * 0.45], 2); curve([[x + s * r * 0.05, y - r * 0.05], [x + s * r * 0.18, y + r * 0.2], [x + s * r * 0.02, y + r * 0.24]], 1.2); curve([[x - r * 0.35, y + r * 0.3], [x - r * 0.4, y + r * 0.45], [x - r * 0.33, y + r * 0.58]], 0.6); curve([[x + r * 0.35, y + r * 0.3], [x + r * 0.4, y + r * 0.45], [x + r * 0.33, y + r * 0.58]], 0.6);
      const badge = [[x + r * 0.55, y + r * 1.7], [x + r * 0.95, y + r * 1.66], [x + r * 0.97, y + r * 1.95], [x + r * 0.57, y + r * 1.99]]; white(badge); polyL(badge, 1); for (let k = 0; k < 3; k++) line([x + r * 0.62, y + r * (1.76 + k * 0.07)], [x + r * 0.9, y + r * (1.74 + k * 0.07)], 0.5); });
    // a photographer at the right edge with a big camera, and the boom mic's furry windscreen poking in from the top
    { const cx = 1545, cy = 520; const bd = [[1600, 1000], [1440, 1000], [1450, 700], [1520, 640], [1600, 630]]; white(bd); shade(bd, { ang: 50, gap: 2.2, a: 0.9 }); polyL(bd, 1.4);
      const cam = [[1440, 470], [1560, 460], [1570, 560], [1446, 570]]; white(cam); shade(cam, { ang: 90, gap: 1.8, a: 0.95 }); polyL(cam, 1.6); for (let k = 0; k < 5; k++) { const rr = 44 - k * 7; P.circle(1470, 516, rr, { w: k ? 0.9 : 1.8, c: K, passes: 1 }); } black(ell(1470, 516, 14, 14, 18)); P.dot(1464, 510, 3, { c: Wh }); const fl = [[1500, 420], [1560, 416], [1562, 458], [1502, 462]]; white(fl); for (let k = 0; k < 8; k++) line([1504 + k * 7, 424], [1504 + k * 7, 456], 0.6); polyL(fl, 1.3);
      const hand = P.sample([[1560, 600], [1600, 580], [1600, 640], [1566, 646]], true, 2); white(hand); fringe(hand, 1580, 615, 30, { rows: 2 }); polyL(hand, 1.2); void cx; void cy; }
    { const bx = 420, by = 150; P.line(0, 40, bx - 40, by - 20, { w: 5, c: K, passes: 1, over: 0 }); const fur = ell(bx, by, 70, 34, 60, 0.25); white(fur); for (let i = 0; i < 420; i++) { const a = R(0, TAU), rr = Math.sqrt(R(0, 1)), x = bx + Math.cos(a) * 66 * rr, y = by + Math.sin(a) * 30 * rr, d = R(3, 8); P.line(x, y, x + Math.cos(a) * d, y + Math.sin(a) * d, { w: 0.5, c: K, passes: 1, over: 0, rough: 0.2 }); } fur.forEach(([x, y]) => { const a = Math.atan2(y - by, x - bx); P.line(x, y, x + Math.cos(a + R(-0.5, 0.5)) * 11, y + Math.sin(a + R(-0.5, 0.5)) * 11, { w: 0.7, c: K, passes: 1, over: 0 }); }); }

    /* ================= THE TIMELINE: faces and head moves read off the clip, pushed further ================= */
    const D = { turn: 0, pitch: 0, tilt: 0, lean: 0, gx: 0, gy: 0, open: 1, squint: 0, bL: 0, bR: 0, knit: 0, mw: 1, smile: 0, purse: 0, twist: 0, teeth: 0, puff: 0, sweat: 0, blush: 0, duck: 0, chin: 0, wob: 0, spasm: 0 };
    const KEYS = [
      [0.0, { turn: 0.32, tilt: -0.04, gx: 0.7, purse: 0.5, smile: -0.1, bL: 0.1, bR: 0.3 }],
      [1.2, { turn: 0.38, tilt: -0.06, gx: 0.8, purse: 0.6, squint: 0.4, twist: 0.3, bR: 0.6 }],
      [2.0, { turn: 0.02, pitch: -0.05, gx: 0, purse: 0.3, smile: -0.4, mw: 0.9, bL: 0.5, bR: 0.5, knit: 0.2 }],
      [3.2, { turn: 0.1, tilt: 0.06, purse: 0.75, twist: -0.4, bL: 0.7, bR: 0.2, wob: 0.5 }],
      [4.0, { turn: -0.7, tilt: -0.1, lean: -30, gx: -1, twist: 0.6, smile: 0.25, bL: 0.8, bR: -0.3 }],
      [5.3, { turn: -0.5, pitch: 0.3, tilt: -0.05, lean: -20, gx: -0.6, gy: 0.9, open: 0.45, twist: 0.5, puff: 0.35, smile: 0.1, spasm: 0.5 }],
      [6.4, { turn: -0.12, pitch: 0.1, open: 0, squint: 1, puff: 0.85, mw: 0.6, smile: -0.2, knit: 0.6, sweat: 0.2, spasm: 1 }],
      [7.0, { turn: 0, pitch: -0.08, open: 1.3, smile: -0.9, purse: 0.2, bL: 0.9, bR: 0.9, chin: 0.6 }],
      [8.0, { pitch: -0.14, tilt: 0.05, open: 1.1, smile: -1, purse: 0.8, knit: 0.8, bL: 0.3, bR: 0.6, chin: 1, wob: 1, sweat: 0.5 }],
      [9.5, { turn: 0.12, pitch: -0.12, tilt: -0.06, open: 0.9, smile: -1, purse: 0.9, twist: -0.5, knit: 0.9, chin: 1, wob: 1, sweat: 0.7 }],
      [10.2, { turn: 0, pitch: -0.05, open: 1.25, teeth: 1, mw: 1.25, smile: -0.5, knit: 1, bL: 0.8, bR: 0.8, sweat: 0.9 }],
      [11.2, { turn: -0.08, tilt: 0.08, teeth: 0.75, mw: 1.15, smile: -0.7, squint: 0.5, wob: 0.8, sweat: 0.9 }],
      [11.8, { turn: 0.05, purse: 0.7, smile: -0.6, chin: 0.8, wob: 0.5, sweat: 0.6 }],
      [12.6, { turn: 0.15, tilt: -0.05, bL: 0.4, bR: 0.5, purse: 0.35, smile: -0.2, sweat: 0.3 }],
      [14.0, { turn: 0.2, bL: 0.5, bR: 0.2, purse: 0.4, twist: 0.3, gx: 0.3 }],
      [14.6, { turn: 0.25, pitch: 0.35, tilt: 0.12, gy: 1, open: 0.35, twist: 0.6, puff: 0.75, spasm: 0.8 }],
      [15.2, { turn: 0.35, pitch: 1.25, tilt: 0.3, lean: 40, duck: 1, puff: 0.5, open: 0 }],
      [17.1, { turn: 0.3, pitch: 1.2, tilt: 0.25, lean: 35, duck: 1, open: 0 }],
      [17.7, { turn: 0.1, pitch: -0.04, tilt: -0.05, smile: 0.55, blush: 0.9, bL: 0.6, bR: 0.6, gx: 0.2 }],
      [19.2, { turn: 0.32, tilt: -0.04, gx: 0.7, purse: 0.5, smile: -0.1, bL: 0.1, bR: 0.3 }]
    ].map(([t, p]) => [t, Object.assign({}, D, p)]);
    const pose = t => { let i = 0; while (i < KEYS.length - 2 && KEYS[i + 1][0] <= t) i++; const [t0, a] = KEYS[i], [t1, b] = KEYS[i + 1], u = Math.max(0, Math.min(1, (t - t0) / (t1 - t0))), e = u * u * (3 - 2 * u), o = {}; for (const k in D) o[k] = a[k] + (b[k] - a[k]) * e;
      o.open *= (t % 3.3) > 3.18 && o.open > 0.3 ? 0.08 : 1;                                   // blinks
      o.turn += 0.05 * Math.sin(t * 1.3) + o.spasm * 0.03 * Math.sin(t * 23); o.pitch += 0.03 * Math.sin(t * 2.1) + o.spasm * 0.05 * Math.abs(Math.sin(t * 17)); o.tilt += 0.025 * Math.sin(t * 0.9);
      return o; };

    /* ================= THE SPEAKER: a profile at the left edge, jaw and brow moving with the audio ================= */
    live(tt => { const t = clock(tt), e = ENV[Math.min(ENV.length - 1, Math.floor(t * 20))] || 0, jaw = e * 26, bob = Math.sin(t * 3) * 3 + e * 4, cx = 90, cy = 560;
      const suit = [[0, 1000], [0, 760], [180, 720], [330, 800], [360, 1000]]; white(suit); shade(suit, { ang: 55, gap: 2.4, a: 0.85 }); shade(suit, { ang: -35, gap: 5, a: 0.5 }); polyL(suit, 1.6);
      const col = [[150, 722], [240, 716], [300, 790], [236, 760]]; white(col); polyL(col, 1.2); const tie = [[230, 740], [262, 736], [276, 800], [250, 816]]; white(tie); shade(tie, { ang: 30, gap: 2, a: 0.95 }); polyL(tie, 1.2); line([176, 730], [300, 1000], 1.3); for (let y = 760; y < 1000; y += 9) P.dot(160 + (y - 740) * 0.5, y, 0.8, { c: K });
      const head = [[0, 330], [120, 330 + bob], [230, 380 + bob], [280, 470 + bob], [300, 510 + bob], [345, 548 + bob], [300, 566 + bob], [296, 590 + bob], [322, 596 + jaw * 0.2 + bob], [300, 606 + jaw + bob], [296, 640 + jaw + bob], [250, 690 + jaw * 0.6 + bob], [170, 720], [0, 730]];
      white(head); fringe(head, cx, cy, 200, { rows: 4, light: 0.5 }); P.stipple(head, 1100, { a: 0.8, r: 0.55, c: K, fade: (x) => Math.max(0, 1 - x / 260) }); polyL(head, 1.9);
      const ear = ell(118, 500 + bob, 22, 38, 18); white(ear); fringe(ear, 118, 500 + bob, 38, { rows: 2 }); polyL(ear, 1.4); curve([[112, 476 + bob], [128, 490 + bob], [118, 520 + bob]], 0.8); P.dot(120, 506 + bob, 2.2, { c: K });
      const hair = [[0, 320], [150, 318 + bob], [245, 370 + bob], [215, 400 + bob], [120, 380 + bob], [0, 420]]; black(hair); for (let k = 0; k < 16; k++) curve([[k * 15, 328 + bob], [k * 15 + 40, 345 + bob], [k * 15 + 90, 372 + bob]], 0.6, Wh);
      if (jaw > 4) black([[300, 594 + bob], [322, 597 + jaw * 0.2 + bob], [300, 604 + jaw + bob], [288, 600 + jaw * 0.6 + bob]]);
      const br = bob - e * 10; P.path([[236, 444 + br], [256, 438 + br], [276, 446 + br]], { w: 3.4, c: K, passes: 1 }); P.ellipse(258, 468 + bob, 6, 8, { w: 1.4, c: K, passes: 1 }); P.dot(262, 469 + bob, 3.4, { c: K }); line([252, 486 + bob], [270, 490 + bob], 0.7);
      curve([[282, 520 + bob], [272, 548 + bob], [292, 562 + bob]], 1); curve([[262, 610 + bob], [250, 640 + bob], [262, 670 + bob]], 0.7); for (let k = 0; k < 3; k++) curve([[210, 420 + k * 14 + bob], [226, 416 + k * 14 + bob], [240, 422 + k * 14 + bob]], 0.5);
      for (let k = 0; k < 3; k++) if (e > 0.5) curve([[352 + k * 14, 586 - k * 10 + bob], [362 + k * 16, 598 + bob], [352 + k * 14, 612 + k * 10 + bob]], 0.9);
      // the scrum of microphones reaching in from below
      [[430, 700, -2.3, 'box'], [470, 760, -2.5, ''], [400, 800, -2.05, 'box'], [520, 830, -2.7, '']].forEach(([x, y, a, kind], i) => { const hx = 380 + i * 30, hy = 1000, len = Math.hypot(x - hx, y - hy), ang = Math.atan2(y - hy, x - hx), nx = -Math.sin(ang), ny = Math.cos(ang);
        const hd = [[hx + nx * 9, hy + ny * 9], [x + nx * 7, y + ny * 7], [x - nx * 7, y - ny * 7], [hx - nx * 9, hy - ny * 9]]; white(hd); shade(hd, { ang: ang * 180 / Math.PI + 90, gap: 2, a: 0.9 }); polyL(hd, 1.2);
        if (kind === 'box') { const bx = x - Math.cos(ang) * 40, by = y - Math.sin(ang) * 40, bb = [[bx - 18, by - 16], [bx + 18, by - 16], [bx + 18, by + 16], [bx - 18, by + 16]]; white(bb); shade(bb, { ang: 0, gap: 3, a: 0.4 }); polyL(bb, 1.4); curve([[bx - 10, by - 2], [bx - 2, by - 8], [bx + 6, by + 2], [bx + 12, by - 4]], 1.2, RED); }
        const fx = x + Math.cos(ang) * 16, fy = y + Math.sin(ang) * 16; const foam = ell(fx, fy, 20, 18, 22); white(foam); for (let k = 0; k < 60; k++) { const aa = R(0, TAU), rr = Math.sqrt(R(0, 1)) * 18; P.dot(fx + Math.cos(aa) * rr, fy + Math.sin(aa) * rr, 0.8, { c: K }); } fringe(foam, fx, fy, 20, { rows: 3 }); polyL(foam, 1.4); void len; void a; }); }, { fps: 15, cache: true });

    /* ================= THE BYSTANDER ================= */
    const HX = 1010, HY = 420, RX = 150, RY = 185, RZ = 140;
    live(tt => { const t = clock(tt), p = pose(t);
      const shake = p.duck > 0.4 ? p.duck : 0, ox = p.lean + Math.sin(t * 38) * 7 * shake, oy = Math.abs(Math.sin(t * 19)) * 7 * shake + Math.max(0, p.pitch) * 90;
      const yaw = p.turn * 0.9, pit = p.pitch, roll = p.tilt, cyw = Math.cos(yaw), syw = Math.sin(yaw), cp = Math.cos(pit), sp = Math.sin(pit), pv = [HX, HY + 250];
      const T = (x, y) => { const X = x - pv[0] + ox, Y = y - pv[1] + oy; return [pv[0] + X * Math.cos(roll) - Y * Math.sin(roll), pv[1] + X * Math.sin(roll) + Y * Math.cos(roll)]; };
      const rot = ([x, y, z]) => { const x1 = x * cyw + z * syw, z1 = -x * syw + z * cyw; return [x1, y * cp + z1 * sp, -y * sp + z1 * cp]; };
      const P3 = q => { const r = rot(q), s = T(HX + r[0], HY + r[1]); return [s[0], s[1], r[2]]; };
      // a point on the face given in "flat face pixels" (x right, y down from the head centre), lifted d off the surface
      const surf = (x, y, d = 0) => { const u = Math.max(-1.5, Math.min(1.5, x / RX * 1.05)), v = Math.max(-1.45, Math.min(1.45, y / RY * 1.1)), jow = 1 + 0.07 * Math.max(0, Math.sin(v)); return [RX * Math.sin(u) * Math.cos(v) * jow * (1 + d), RY * Math.sin(v) * (1 + d * 0.3), RZ * Math.cos(u) * Math.cos(v) * (1 + d)]; };
      const F = (x, y, d = 0) => P3(surf(x, y, d)), FL = (pts, d = 0) => pts.map(([x, y]) => { const q = F(x, y, d); return [q[0], q[1]]; }), vis = (x, y, d = 0) => F(x, y, d)[2] > 4;
      const fl = (pts, w, c = K, d = 0) => P.path(FL(pts, d), { w, c, passes: 1, rough: 0.15 });

      /* ---- body: checked jacket with notched lapels, pocket square, buttons, lanyard; shoulders follow the head ---- */
      const hunch = p.duck * 40, sx = HX + ox * 0.35 + p.turn * 18, shk = Math.sin(t * 38) * 4 * shake;
      const jacket = [[sx - 430, 1000], [sx - 380 + shk, 790 - hunch], [sx - 150, 700 - hunch], [sx, 690], [sx + 150, 700 - hunch], [sx + 380 + shk, 790 - hunch], [sx + 430, 1000]];
      white(jacket); shade(jacket, { ang: 0, gap: 11, a: 0.8, w: 0.9 }); shade(jacket, { ang: 90, gap: 11, a: 0.8, w: 0.9 }); shade(jacket, { ang: 0, gap: 33, c: RED, a: 0.6, w: 0.7 }); shade(jacket, { ang: 45, gap: 3.2, a: 0.5, w: 0.45 }); fringe(jacket, sx, 880, 330, { rows: 3 });
      [[sx - 300, 820, sx - 250, 900], [sx + 280, 830, sx + 300, 920], [sx - 200, 760, sx - 160, 830]].forEach(([a, b, c, d]) => curve([[a, b], [(a + c) / 2 + 12, (b + d) / 2], [c, d]], 1));
      polyL(jacket, 2.2);
      const neck = [T(HX - 62, HY + 125), T(HX + 62, HY + 125), [sx + 70, 700], [sx - 70, 700]]; white(neck); shade(neck, { ang: 80, gap: 2.2, a: 0.55 }); shade([neck[0], neck[1], [(neck[1][0] + neck[2][0]) / 2, neck[1][1] + 30], [(neck[0][0] + neck[3][0]) / 2, neck[0][1] + 30]], { ang: 20, gap: 1.8, a: 0.8 }); polyL(neck, 1.4);
      const nk = T(HX, HY + 190); curve([[nk[0] - 12, nk[1] - 8], [nk[0], nk[1] + 4], [nk[0] + 12, nk[1] - 8]], 1.2); if (p.teeth > 0.4) [-1, 1].forEach(s => curve([T(HX + s * 38, HY + 150), T(HX + s * 30, HY + 200), [sx + s * 26, 690]], 1.1));
      const shirt = [[sx - 104, 688], [sx + 104, 688], [sx, 905]]; white(shirt); for (let y = 700; y < 890; y += 18) P.dot(sx, y, 1.6, { c: K }); curve([[sx - 60, 720], [sx - 40, 800], [sx - 20, 880]], 0.6); polyL(shirt, 1.2);
      [-1, 1].forEach(s => { const col = [[sx + s * 104, 686], [sx + s * 20, 700], [sx + s * 58, 742]]; white(col); polyL(col, 1.3); for (let k = 1; k < 6; k++) P.dot(sx + s * (100 - k * 15), 690 + k * 2.2, 0.8, { c: K }); });
      [-1, 1].forEach(s => { const lap = [[sx + s * 104, 690], [sx + s * 150, 700 - hunch], [sx + s * 170, 760], [sx + s * 128, 770], [sx + s * 150, 800], [sx + s * 30, 930], [sx + s * 20, 905]]; white(lap); shade(lap, { ang: 0, gap: 11, a: 0.6, w: 0.8 }); shade(lap, { ang: 90, gap: 11, a: 0.6, w: 0.8 }); shade(lap, { ang: s * 60, gap: 2.4, a: 0.55 }); polyL(lap, 1.8); P.path(lap.slice(0, 6).map(([x, y]) => [x - s * 6, y + 4]), { w: 0.5, c: K, a: 0.9, passes: 1, rough: 0.1 }); for (let k = 0; k < 18; k++) { const tq = k / 18, a = lap[Math.floor(tq * 5)], b = lap[Math.floor(tq * 5) + 1], f = tq * 5 % 1; P.dot(lerp(a[0], b[0], f) - s * 9, lerp(a[1], b[1], f) + 6, 0.7, { c: K }); } });
      const pk = [[sx + 190, 830], [sx + 290, 822], [sx + 292, 836], [sx + 192, 844]]; white(pk); polyL(pk, 1.4); const sq = P.sample([[sx + 200, 830], [sx + 214, 796], [sx + 232, 814], [sx + 248, 790], [sx + 262, 812], [sx + 280, 800], [sx + 284, 828]], false, 2); white(sq.concat([[sx + 284, 830], [sx + 200, 832]])); for (let k = 0; k < 7; k++) line([sx + 206 + k * 11, 828], [sx + 214 + k * 11, 800], 0.8, RED); polyL(sq, 1.3, K, false);
      [880, 950].forEach(y => { P.circle(sx + 8, y, 10, { w: 1.4, c: K, passes: 1 }); [[-3, -3], [3, -3], [-3, 3], [3, 3]].forEach(([a, b]) => P.dot(sx + 8 + a, y + b, 1.2, { c: K })); });
      curve([[sx - 70, 700], [sx - 110, 820], [sx - 132, 900]], 1.4); curve([[sx + 70, 700], [sx + 30, 800], [sx - 110, 900]], 1.4); const bd = [[sx - 170, 896], [sx - 96, 892], [sx - 92, 956], [sx - 166, 960]]; white(bd); polyL(bd, 1.4); P.text('GUEST', sx - 131, 918, { size: 12, align: 'center', c: RED }); for (let k = 0; k < 3; k++) line([sx - 158, 930 + k * 8], [sx - 104, 928 + k * 8], 0.5);
      const by = 705; [-1, 1].forEach(s => { const w = [[sx, by], [sx + s * 64, by - 28], [sx + s * 58, by], [sx + s * 68, by + 28]]; white(w); shade(w, { ang: 30, gap: 1.8, c: RED, a: 0.9 }); for (let k = 0; k < 5; k++) P.circle(sx + s * (20 + k * 10), by + (k % 2 ? 9 : -9), 2.4, { w: 0.8, c: K, passes: 1 }); curve([[sx + s * 16, by - 6], [sx + s * 40, by - 2], [sx + s * 58, by - 12]], 0.6); polyL(w, 1.6); }); const knot = ell(sx, by, 11, 14); white(knot); shade(knot, { ang: 60, gap: 1.4, c: RED, a: 0.95 }); polyL(knot, 1.4);

      /* ---- ears (drawn first: the head covers the half that swings behind it) ---- */
      [-1, 1].forEach(s => { const ear = Array.from({ length: 20 }, (_, i) => { const a = i * TAU / 20; return P3([s * RX * (0.97 + 0.3 * (Math.cos(a) + 1) / 2), 12 + 46 * Math.sin(a), -20 + 14 * Math.cos(a)]); }).map(q => [q[0], q[1]]); const ec = P3([s * RX * 1.05, 12, -14]); white(ear); fringe(ear, ec[0], ec[1], 44, { rows: 3 }); polyL(ear, 1.6);
        const helix = Array.from({ length: 9 }, (_, i) => { const a = -1.2 + i * 0.3; return P3([s * RX * (1.02 + 0.2 * (Math.cos(a) + 1) / 2), 12 + 34 * Math.sin(a), -18 + 8 * Math.cos(a)]); }).map(q => [q[0], q[1]]); P.path(helix, { w: 1, c: K, passes: 1 }); const ch = P3([s * RX * 1.1, 18, -14]); P.dot(ch[0], ch[1], 3.4, { c: K }); P.stipple(ell(ch[0], ch[1], 9, 12, 12), 40, { a: 0.9, r: 0.6, c: K }); });

      /* ---- the head: the ellipsoid's silhouette, egg-shaped at the jowls, cheeks that puff ---- */
      const ax = rot([RX, 0, 0]), ay = rot([0, RY, 0]), az = rot([0, 0, RZ]), a0 = ax[0] * ax[0] + ay[0] * ay[0] + az[0] * az[0], b0 = ax[0] * ax[1] + ay[0] * ay[1] + az[0] * az[1], d0 = ax[1] * ax[1] + ay[1] * ay[1] + az[1] * az[1];
      const tr = a0 + d0, dt = a0 * d0 - b0 * b0, l1 = tr / 2 + Math.sqrt(Math.max(0, tr * tr / 4 - dt)), l2 = tr / 2 - Math.sqrt(Math.max(0, tr * tr / 4 - dt)), th = Math.abs(b0) > 1e-6 ? Math.atan2(l1 - a0, b0) : (a0 >= d0 ? 0 : Math.PI / 2);
      const down = [ay[0], ay[1]], dl = Math.hypot(...down) || 1;
      const head = Array.from({ length: 56 }, (_, i) => { const a = i * TAU / 56; let x = Math.sqrt(l1) * Math.cos(a), y = Math.sqrt(l2) * Math.sin(a); const X = x * Math.cos(th) - y * Math.sin(th), Y = x * Math.sin(th) + y * Math.cos(th); const dn = (X * down[0] + Y * down[1]) / dl / RY; const side = Math.abs((X * down[1] - Y * down[0]) / dl) / RX; let k = 1 + 0.07 * Math.max(0, dn) * side * 1.6; const cheek = Math.exp(-Math.pow((dn - 0.35) / 0.25, 2)) * side; k += p.puff * 0.1 * cheek; const q = T(HX + X * k, HY + Y * k); return q; });
      const hc = T(HX, HY); white(head); fringe(head, hc[0], hc[1], 185, { rows: 5 }); P.stipple(head, 2200, { a: 0.75, r: 0.5, c: K, fade: (x, y) => Math.max(0, ((x - hc[0]) / RX + (y - hc[1]) / RY) * 0.8 - 0.05) }); polyL(head, 2.4);
      // the crown: three brave hairs, a shine, and tufts over the ears
      [[-30, -1], [4, 1], [34, -1]].forEach(([hx, s], i) => { const b = [hx, -RY * 0.99, 30]; if (P3(b)[2] < -60) return; const pts = [b, [hx + s * 16, -RY - 28 - i * 6, 30], [hx - s * 10, -RY - 52, 26], [hx + s * 6, -RY - 66, 24]].map(q => { const r = P3(q); return [r[0], r[1]]; }); P.curve(pts, { w: 1.4, c: K, passes: 1, rough: 0.1 }); });
      { const sh = [[-60, -150, 60], [-30, -168, 40], [10, -172, 30]].map(q => P3(q)); if (sh[1][2] > 0) P.path(sh.map(q => [q[0], q[1]]), { w: 3.2, c: Wh, passes: 1 }); }
      [-1, 1].forEach(s => { for (let k = 0; k < 7; k++) { const pts = [[s * RX * 0.93, -96 + k * 11, -4], [s * RX * 1.08, -102 + k * 11, -10], [s * RX * 1.02, -86 + k * 11, -16]].map(q => P3(q)); if (pts[0][2] < -40) continue; P.curve(pts.map(q => [q[0], q[1]]), { w: 1, c: K, passes: 1, rough: 0.2 }); } });
      if (p.duck > 0.55) { // face buried: shaking with laughter
        for (let k = 0; k < 6; k++) { const a = -2.5 + k * 0.33, q = T(HX + Math.cos(a) * 250, HY + Math.sin(a) * 260); line(q, [q[0] + Math.cos(a) * 28, q[1] + Math.sin(a) * 28], 1.8); }
        const q = T(HX + 200, HY - 150); P.text('PFFT', q[0], q[1], { size: 32, c: RED }); const q2 = T(HX - 290, HY - 40); P.text('hk hk', q2[0], q2[1], { size: 20, c: K }); for (let k = 0; k < 4; k++) { const a = T(HX - 170 - k * 18, HY + 120 + k * 10); P.dot(a[0], a[1], 3 - k * 0.5, { c: K }); }
        return; }

      /* ---- face structure: shadow side of the cheek, jaw and double chin, temples, stubble, freckles ---- */
      const L = 1; // light comes from the upper left
      if (vis(95, 40)) { const ck = FL([[70, -30], [132, -40], [140, 60], [118, 150], [70, 120], [60, 40]]); shade(ck, { ang: -55, gap: 3, a: 0.45, w: 0.45 }); P.stipple(ck, 260, { a: 0.7, r: 0.5, c: K }); }
      if (vis(0, 172)) { const jw = FL([[-120, 150], [-60, 176], [0, 184], [60, 176], [120, 150], [110, 186], [0, 200], [-110, 186]]); shade(jw, { ang: -20, gap: 2.2, a: 0.7 }); shade(jw, { ang: 40, gap: 3.6, a: 0.4 }); fl([[-70, 190], [0, 203], [70, 190]], 1.1); }
      [-1, 1].forEach(s => { if (vis(s * 118, -70)) P.stipple(FL([[s * 100, -120], [s * 140, -110], [s * 146, -30], [s * 108, -40]]), 120, { a: 0.8, r: 0.5, c: K }); });
      if (vis(0, 150)) P.stipple(FL([[-100, 110], [100, 110], [110, 170], [0, 186], [-110, 170]]), 420, { a: 0.55, r: 0.45, c: K });
      [[-82, 40], [-94, 54], [-70, 60], [88, 44]].forEach(([x, y]) => { if (vis(x, y)) { const q = F(x, y); P.dot(q[0], q[1], 1.3, { c: K }); } });
      // forehead wrinkles that stack as the brows climb, and the knit between them
      const up = Math.max(0, (p.bL + p.bR) / 2); for (let k = 0; k < 1 + Math.round(up * 5); k++) { const y = -118 - k * 13; if (vis(0, y)) fl(Array.from({ length: 9 }, (_, i) => [-84 + i * 21, y + Math.sin(i * 0.9 + k) * 3 - (i === 4 ? p.knit * 6 : 0)]), k ? 0.7 : 0.9); }
      if (p.knit > 0.3) [-1, 1].forEach(s => fl([[s * 10, -88], [s * 7, -72], [s * 11, -58]], 0.9));

      /* ---- eyes: sockets, lids, lashes, iris rings, bags, crow's feet ---- */
      const sep = 60, ey = -18, open = Math.max(0, p.open * (1 - 0.6 * p.squint));
      [-1, 1].forEach(s => { const ex = s * sep; if (!vis(ex, ey)) return; const rx = 38, ry = 32 * Math.min(1.45, open);
        const sock = FL(Array.from({ length: 13 }, (_, i) => { const a = Math.PI + i * Math.PI / 12; return [ex + Math.cos(a) * (rx + 16), ey + Math.sin(a) * (ry + 22) + 4]; }).concat(Array.from({ length: 13 }, (_, i) => { const a = TAU - i * Math.PI / 12; return [ex + Math.cos(a) * (rx + 2), ey + Math.sin(a) * (ry + 2)]; })));
        shade(sock, { ang: s > 0 ? -60 : -40, gap: 2.2, a: s > 0 ? 0.65 : 0.4, w: 0.45 });
        [10, 18].forEach((o, k) => fl([[ex - 26, ey + ry + o - 4], [ex, ey + ry + o + 2], [ex + 26, ey + ry + o - 4]], k ? 0.6 : 0.9)); P.stipple(FL([[ex - 24, ey + ry + 8], [ex + 24, ey + ry + 8], [ex + 20, ey + ry + 22], [ex - 20, ey + ry + 22]]), 50, { a: 0.8, r: 0.5, c: K });
        if (p.squint > 0.3 || p.smile > 0.3 || open < 0.2) for (let k = 0; k < 3; k++) fl([[ex + s * (rx + 8), ey - 4 + k * 9], [ex + s * (rx + 24), ey - 10 + k * 14]], 0.9);
        if (open < 0.15) { fl([[ex - 32, ey + 2], [ex - 12, ey - 10], [ex + 12, ey - 10], [ex + 32, ey + 2]], 3.4); fl([[ex - 26, ey + 8], [ex, ey + 12], [ex + 26, ey + 8]], 1); return; }
        const eye = FL(ell(ex, ey, rx, ry, 26)); white(eye);
        const ir = Math.min(rx, ry) * (open > 1.12 ? 0.42 : 0.62), gx = ex + p.gx * (rx - ir) * 0.8, gy = ey + p.gy * (ry - ir) * 0.6, irs = FL(ell(gx, gy, ir, ir, 22)); white(irs); polyL(irs, 1.4);
        for (let k = 0; k < 14; k++) { const a = k * TAU / 14; fl([[gx + Math.cos(a) * ir * 0.45, gy + Math.sin(a) * ir * 0.45], [gx + Math.cos(a) * ir * 0.92, gy + Math.sin(a) * ir * 0.92]], 0.5); }
        const pu = FL(ell(gx, gy, ir * (open > 1.12 ? 0.35 : 0.45), ir * (open > 1.12 ? 0.35 : 0.45), 16)); black(pu); const gl = F(gx - ir * 0.3, gy - ir * 0.35); P.dot(gl[0], gl[1], 2.8, { c: Wh }); const g2 = F(gx + ir * 0.25, gy + ir * 0.3); P.dot(g2[0], g2[1], 1.2, { c: Wh });
        polyL(eye, 1.6); const lid = FL(ell(ex, ey, rx + 1, ry + 1, 26).slice(13, 27)); P.path(lid, { w: 3.6, c: K, passes: 1 }); fl(ell(ex, ey - 8, rx + 4, ry + 8, 26).slice(15, 25), 0.9);
        for (let k = 0; k < 6; k++) { const a = Math.PI * 1.1 + k * 0.16 + (s > 0 ? 0.25 : 0), bx = ex + Math.cos(a) * (rx + 1), byy = ey + Math.sin(a) * (ry + 1); fl([[bx, byy], [bx + Math.cos(a) * 9 + s * 3, byy + Math.sin(a) * 9 - 3]], 1); }
        if (p.squint > 0.2) fl([[ex - rx, ey - ry * 0.3], [ex, ey - ry * 0.7], [ex + rx, ey - ry * 0.3]], 2.2); });
      // brows: a solid bar with hairs brushing out of it
      [-1, 1].forEach(s => { const b = s < 0 ? p.bL : p.bR, ex = s * sep, yb = ey - 52 - b * 46, inner = p.knit * 22; if (!vis(ex, yb)) return; const br = FL([[ex - s * 40, yb - 2 + inner * 0.2], [ex, yb - 12], [ex + s * 44, yb + inner], [ex + s * 42, yb + 13 + inner], [ex, yb + 5], [ex - s * 38, yb + 11]]); black(br); for (let k = 0; k < 12; k++) { const u = -40 + k * 7.5, yy = yb + (u * s > 0 ? inner * (u * s) / 44 : 0); fl([[ex + s * u, yy + 2], [ex + s * (u + 6), yy - 9]], 0.8); } });

      /* ---- nose: a foreshortened bulb that pokes out as he turns, nostrils, a bridge line, a hatched shadow under it ---- */
      if (vis(0, 50, 0.2)) { const nose = FL(ell(0, 52, 32, 27, 24), 0.2); white(nose); const nc = F(0, 52, 0.2); P.stipple(nose, 140, { a: 0.8, r: 0.5, c: K, fade: (x) => Math.max(0, (x - nc[0]) / 30 + 0.2) }); P.path(nose.slice(0, 17), { w: 1.9, c: K, passes: 1 }); fl([[-6, -10], [-10, 14], [-14, 30]], 0.8, K, 0.08); [-1, 1].forEach(s => { const q = F(s * 13, 66, 0.16); P.dot(q[0], q[1], 3.2, { c: K }); fl([[s * 30, 58], [s * 36, 70], [s * 24, 78]], 1.1, K, 0.1); }); shade(FL([[-26, 80], [26, 80], [18, 92], [-18, 92]], 0.05), { ang: 0, gap: 1.6, a: 0.85 }); }
      if (p.puff > 0.2) [-1, 1].forEach(s => { if (vis(s * 96, 80)) fl(ell(s * 96, 80, 42, 32, 20).slice(s < 0 ? 7 : 13, s < 0 ? 13 : 20), 1.3); });

      /* ---- mouth ---- */
      const mx = 0, my = 122, w = 100 * p.mw * (1 - 0.5 * p.purse), wob = Math.sin(t * 31) * 7 * p.wob, yl = -p.smile * 36 + p.twist * 24 + wob, yr = -p.smile * 36 - p.twist * 24 - wob, mid = p.smile * 22;
      const fold = Math.min(1, Math.abs(p.smile) * 0.8 + p.teeth + p.puff * 0.6 + 0.25); [[-1, yl], [1, yr]].forEach(([s, yy]) => { if (vis(s * 60, 90)) fl([[s * 34, 64], [s * 64, 88], [s * (w + 14), my + yy - 2]], 0.8 + fold * 1.4); });
      if (vis(0, my)) {
        if (p.teeth > 0.3) { const o = 54 * p.teeth, top = my - 16, bot = my + o, cl = my + yl * 0.5, cr = my + yr * 0.5;
          const m = FL([[mx - w, cl], [mx - w * 0.6, top + 4], [mx, top - 4], [mx + w * 0.6, top + 4], [mx + w, cr], [mx + w * 0.6, bot], [mx, bot + 6], [mx - w * 0.6, bot]]); black(m);
          const gum = FL([[mx - w * 0.8, cl - 2], [mx, top - 1], [mx + w * 0.8, cr - 2], [mx, top + 6]]); shade(gum, { ang: 0, gap: 1.6, c: RED, a: 0.9 });
          const upr = FL([[mx - w * 0.82, cl - 2], [mx - w * 0.55, top + 7], [mx, top + 3], [mx + w * 0.55, top + 7], [mx + w * 0.82, cr - 2], [mx + w * 0.5, top + o * 0.45], [mx - w * 0.5, top + o * 0.45]]); white(upr);
          const dn = FL([[mx - w * 0.75, cl + 4], [mx - w * 0.45, bot - o * 0.35], [mx + w * 0.45, bot - o * 0.35], [mx + w * 0.75, cr + 4], [mx + w * 0.5, bot - 3], [mx, bot + 2], [mx - w * 0.5, bot - 3]]); white(dn);
          for (let k = -4; k <= 4; k++) { const x = mx + k * w * 0.17; fl([[x, top + 3], [x, top + o * 0.45]], 1.1); fl([[x + w * 0.08, bot - o * 0.35], [x + w * 0.08, bot]], 1.1); }
          polyL(upr, 1); polyL(dn, 1); polyL(m, 2.8); [[-1, cl], [1, cr]].forEach(([sg, yy]) => { for (let k = 0; k < 3; k++) fl([[mx + sg * (w + 6), yy - 10 + k * 10], [mx + sg * (w + 24), yy - 16 + k * 16]], 1.1); }); }
        else if (p.purse > 0.45) { const r2 = w * 0.62, pk = FL(Array.from({ length: 22 }, (_, i) => { const a = i * TAU / 22; return [mx + Math.cos(a) * r2 * (1 + 0.14 * Math.sin(a * 5 + t * 20 * p.wob)), my + (yl + yr) / 2 * 0.4 + Math.sin(a) * 26 * (1 + 0.1 * Math.sin(a * 3 + t * 17 * p.wob))]; })); white(pk); shade(pk, { ang: 20, gap: 2.2, c: RED, a: 0.6, w: 0.6 }); P.stipple(pk, 60, { a: 0.8, r: 0.5, c: K }); polyL(pk, 2.6);
          fl([[mx - r2 * 0.6, my + (yl + yr) * 0.2], [mx, my + (yl + yr) * 0.2 + 3], [mx + r2 * 0.6, my + (yl + yr) * 0.2]], 1.9); for (let k = 0; k < 12; k++) { const a = k * TAU / 12; fl([[mx + Math.cos(a) * (r2 + 6), my + Math.sin(a) * 32], [mx + Math.cos(a) * (r2 + 18), my + Math.sin(a) * 44]], 0.8); } }
        else { const ln = FL([[mx - w, my + yl], [mx - w * 0.5, my + mid * 0.8 + yl * 0.3], [mx - w * 0.12, my + mid - 3], [mx, my + mid], [mx + w * 0.12, my + mid - 3], [mx + w * 0.5, my + mid * 0.8 + yr * 0.3], [mx + w, my + yr]]);
          const upl = FL([[mx - w * 0.9, my + yl * 0.9], [mx - w * 0.3, my + mid * 0.6 - 10], [mx - w * 0.06, my + mid - 13], [mx, my + mid - 9], [mx + w * 0.06, my + mid - 13], [mx + w * 0.3, my + mid * 0.6 - 10], [mx + w * 0.9, my + yr * 0.9]]); P.path(upl, { w: 1, c: K, passes: 1 }); shade(upl.concat(ln.slice().reverse()), { ang: 10, gap: 2, c: RED, a: 0.5, w: 0.5 });
          P.path(ln, { w: 4.4, c: K, passes: 1, rough: 0.2 }); const lip = FL([[mx - w * 0.7, my + yl * 0.8 + 8], [mx, my + mid + 18 + 12 * Math.max(0, -p.smile)], [mx + w * 0.7, my + yr * 0.8 + 8]]); P.path(lip, { w: 1.6, c: K, passes: 1 }); shade(FL([[mx - w * 0.6, my + yl * 0.7 + 6], [mx + w * 0.6, my + yr * 0.7 + 6], [mx, my + mid + 16 + 12 * Math.max(0, -p.smile)]]), { ang: 10, gap: 2.2, c: RED, a: 0.55, w: 0.6 });
          shade(FL([[mx - w * 0.5, my + mid + 22], [mx + w * 0.5, my + mid + 22], [mx, my + mid + 34]]), { ang: 0, gap: 1.8, a: 0.7 });
          [[-1, yl], [1, yr]].forEach(([s, yy]) => fl([[mx + s * (w + 2), my + yy - 7], [mx + s * (w + 9), my + yy], [mx + s * (w + 2), my + yy + 7]], 1.3)); if (p.smile > 0.3) [-1, 1].forEach(s => { const q = F(s * (w + 22), my - 18); P.dot(q[0], q[1], 2.2, { c: K }); }); }
        if (p.chin > 0.3 && vis(0, 176)) { P.stipple(FL(ell(mx, 178, 52, 22, 18)), Math.round(220 * p.chin), { a: 0.9, r: 0.7, c: K }); fl([[mx - 38, 160], [mx, 150 - 8 * p.chin], [mx + 38, 160]], 1.3); for (let k = 0; k < 6; k++) { const q = F(mx - 30 + k * 12, 172 + (k % 2) * 6); P.circle(q[0], q[1], 2.2, { w: 0.7, c: K, passes: 1 }); } } }
      // sweat, blush, strain marks
      if (p.sweat > 0.1) for (let k = 0; k < Math.round(p.sweat * 4); k++) { const d = (t * 40 + k * 23) % 60, x0 = (k % 2 ? 1 : -1) * 112, y0 = -110 + k * 16 + d; if (!vis(x0, y0)) continue; const c = F(x0, y0, 0.02), drop = [[c[0], c[1] - 13], [c[0] + 8, c[1] + 2], [c[0], c[1] + 10], [c[0] - 8, c[1] + 2]]; white(drop); polyL(drop, 1.3); P.dot(c[0] - 2, c[1] + 1, 1.8, { c: K }); line([c[0] + 2, c[1] - 2], [c[0] + 3, c[1] + 4], 0.8, Wh); }
      if (p.blush > 0.1) [-1, 1].forEach(s => { if (vis(s * 96, 70)) { const bl = FL(ell(s * 96, 72, 32, 15, 16)); P.hatch(bl, { ang: 70, gap: 2.6, c: RED, a: 0.95 * p.blush, w: 1 }); P.hatch(bl, { ang: 110, gap: 4, c: RED, a: 0.6 * p.blush, w: 0.8 }); } });
      if (p.teeth > 0.6 || p.wob > 0.8) { const q = T(HX + 230, HY - 150); for (let k = 0; k < 3; k++) curve([[q[0] + k * 12, q[1] - k * 6], [q[0] + 10 + k * 12, q[1] + 8 - k * 6], [q[0] + k * 12, q[1] + 16 - k * 6]], 1.4); if (vis(-120, -90)) { const v0 = F(-112, -100, 0.01), v1 = F(-100, -70, 0.01), v2 = F(-118, -52, 0.01); P.curve([[v0[0], v0[1]], [v1[0], v1[1]], [v2[0], v2[1]]], { w: 1.4, c: RED, passes: 1 }); } }
      if (p.spasm > 0.4) { const q = T(HX - 200, HY + 40); for (let k = 0; k < 3; k++) line([q[0] - k * 8, q[1] - 20 + k * 20], [q[0] - 26 - k * 8, q[1] - 20 + k * 20], 1.2); }
    }, { fps: 12, cache: true });

    // the deadpan neighbours blink, and the one on the right slowly slides his eyes over to stare at him
    live(tt => { const t = clock(tt); CROWD.forEach(([x, y, r, s], i) => { const slide = i === 1 ? Math.max(0, Math.min(1, (t - 8) / 1.5)) * (t < 13 ? 1 : Math.max(0, 1 - (t - 13))) : (t > 15 && t < 17.5 ? 1 : 0), dx = (i === 1 ? -1 : 1) * slide * r * 0.12, blink = ((t + i * 1.7) % 4.1) > 3.95;
        [-1, 1].forEach(e => { const ex = x + e * r * 0.3, eyy = y - r * 0.05; if (blink) P.line(ex - 9, eyy, ex + 9, eyy, { w: 2, c: K, passes: 1, over: 0 }); else { white(ell(ex, eyy, 11, 7.5, 14)); P.ellipse(ex, eyy, 11, 7.5, { w: 1.2, c: K, passes: 1 }); P.dot(ex + dx, eyy + 1, 4.2, { c: K }); P.line(ex - 11, eyy - 6, ex + 11, eyy - 6, { w: 1.6, c: K, passes: 1, over: 0 }); } }); }); }, { fps: 12 });
    // the photographer's flash fires now and then
    live(tt => { const t = clock(tt); if (!tt || (t % 2.9) > 0.14) return; const fx = 1530, fy = 440; for (let k = 0; k < 16; k++) { const a = k * TAU / 16; P.line(fx + Math.cos(a) * 30, fy + Math.sin(a) * 30, fx + Math.cos(a) * (k % 2 ? 70 : 110), fy + Math.sin(a) * (k % 2 ? 70 : 110), { w: k % 2 ? 1 : 2, c: K, passes: 1, over: 0 }); } P.circle(fx, fy, 24, { w: 1.4, c: K, passes: 1 }); }, { fps: 24 });

    P.text('THE BYSTANDER', 1560, 980, { size: 11, align: 'right', a: 0.75 });
  }
});
