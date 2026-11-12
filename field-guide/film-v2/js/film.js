'use strict';
let TA = 0;   // real (ambient) clock; t is the story clock
// ------------------------------------------------------------------
// FABLE 5.2 — A FIELD GUIDE.  Film timeline (seconds). Built 10 s at a time.
//   0–10  PROLOGUE: the message arrives
// ------------------------------------------------------------------
const PAL = [...['d97757', 'a8553b', 'f2a585', '6e2a1a', 'ffd9c2', '1b1426', 'fff6ea'],
  '3f9a7c', '2f7a6a', '6fc49a', '1f5450', '6b4766', '553858', '3e2848', '2a1a35', '8f6f8c', '4a3046', '5e3b28', '8a5a3a', 'b07a4f', '3a2420',
  '6a62b0', '9b8fd6', '463f80', 'e2574c', 'ffd88a', 'fff1c4', 'f5b45a', 'efe4d0', 'b9b2c4', '7d7790', 'ffe7a3', 'fff6d8', 'ffffff',
  'f3ead6', 'd9cdb4', 'a8987c', '2a2350', 'e9e3f5', 'c3b9e0', '8e82b8', '1c1530', '140f22', '7fd7ff', '4aa3d8', 'c9f1ff', '1c2348', '2f3c78', '4a5a9a', '6a5a8a', '4f3d6e', '3a2a55', 'b3a6d6', '24152e', '2f1d3a', '472d52', '357f6a', '4fb08a', '8fd6a6', 'b8e3a4', '1f4a48', '2a6158', 'e6f0b8'];
const COL = {};
['top:3f9a7c', 'topD:2f7a6a', 'topL:6fc49a', 'lipL:6fc49a', 'lipR:3f9a7c', 'lipD:2f7a6a', 'dirtL:6b4766', 'dirtR:553858', 'strata:3e2848', 'stone:8f6f8c', 'root:4a3046', 'flower:ffe7a3',
  'trunk:5e3b28', 'trunkL:8a5a3a', 'trunkD:4a3046', 'leaf:2f7a6a', 'leafL:6fc49a', 'leafD:1f5450', 'wood:8a5a3a', 'woodL:b07a4f', 'woodD:5e3b28', 'shadow:1f5450',
  'post:5e3b28', 'postL:8a5a3a', 'postD:3a2420', 'box:6a62b0', 'boxL:9b8fd6', 'boxD:463f80', 'flag:e2574c', 'lamp:ffd88a', 'lampL:fff1c4', 'lampD:f5b45a', 'glow:f5b45a',
  'stem:efe4d0', 'cap:e2574c', 'spot:fff1c4', 'stoneL:b9b2c4', 'stoneD:7d7790', 'paper:f3ead6', 'paperD:d9cdb4', 'paperS:a8987c', 'ink:2a2350', 'cloudL:e9e3f5', 'cloud:c3b9e0', 'cloudD:8e82b8',
  'planeL:ffffff', 'planeM:fff6d8', 'planeD:8f6f8c', 'sil:2a1a35', 'zz:fff6d8', 'zzO:2a1a35'].forEach(s => { const [k, v] = s.split(':'); COL[k] = hex(v); });

const MASK = (i, j) => { const d = Math.hypot(i - 2.5, j - 2.5); return d <= 2.85 && !(hash(i, j, 77) < 0.3 && d > 2.4); };
const DEPTH = (i, j) => Math.round(16 + 44 * Math.max(0, 1 - Math.hypot(i - 2.5, j - 2.5) / 3.6) + hash(i, j, 5) * 12);
const MOON = { q: [272, 84], r: 44, par: 0.35 };     // the "moon" (it is the Handler's desk lamp; revealed at the end)

// ---------------- camera (one continuous move) ----------------
//  0.0 close on the sleeping face -> 2.0 pulled back to the wide with the moon -> 2.75 snaps into the face at the bonk
//  -> 4.1 out to medium for the hops -> 6.6 reading -> 7.2 over-the-shoulder towards the moon -> 10 settles
const CAMKEYS = [[0, 197, 254, 3.2], [0.45, 197, 252, 3.0], [2.0, 214, 198, 1.0], [2.45, 206, 214, 1.06], [2.78, 197, 249, 2.5], [3.5, 198, 250, 2.6], [4.1, 197, 252, 1.6], [4.5, 197, 252, 1.5], [6.6, 198, 252, 1.62], [7.2, 214, 210, 2.0], [8.8, 212, 214, 1.9], [10, 210, 210, 1.72]];

// ---------------- hero performance ----------------
function heroAt(t) {
  if (t >= 34.2) return heroAt4(t);
  if (t >= 20) return heroAt3(t);
  if (t >= 10) return heroAt2(t);
  const st = { eyes: 'open', look: [0, 0], mouth: '', arm: 0, hop: 0, squash: 0, walk: null, breathe: 0, blink: 0 };
  let x = 52;
  if (t < 2.6) { st.eyes = 'closed'; st.breathe = Math.sin(t * 2 * Math.PI / 1.6) > 0.3 ? 1 : 0; st.squash = 0.04 * Math.sin(t * 2 * Math.PI / 1.6); }
  else if (t < 3.0) { const u = (t - 2.6) / 0.4; st.eyes = 'wide'; st.mouth = 'o'; st.hop = Math.sin(u * Math.PI) * 8; st.squash = u < 0.12 ? 0.24 * (u / 0.12) : -0.14 * Math.sin((u - 0.12) / 0.88 * Math.PI); st.arm = Math.sin(u * Math.PI); st.look = [0, -1]; }
  else if (t < 3.6) { const u = (t - 3.0) / 0.6; st.squash = 0.16 * Math.sin(Math.min(1, u * 3) * Math.PI) * (1 - u); st.look = [Math.round(sm(0.2, 0.6, u)), Math.round(sm(0.2, 0.6, u))]; st.blink = (t > 3.18 && t < 3.26) ? 1 : 0; st.mouth = u < 0.3 ? 'o' : ''; }
  else if (t < 4.2) { const u = (t - 3.6) / 0.6, hu = (u * 2) % 1; x = 52 + 8 * ease(u); st.hop = Math.sin(hu * Math.PI) * 5; st.squash = hu < 0.15 ? 0.12 : hu > 0.85 ? 0.1 : -0.08; st.look = [1, 1]; st.arm = 0.3; }
  else if (t < 4.5) { x = 60; const u = (t - 4.2) / 0.3; st.arm = sm(0, 0.6, u); st.look = [1, 1]; st.squash = 0.07 * Math.sin(u * Math.PI); }
  else if (t < 6.7) { x = 60; st.arm = 1; const w = clamp((t - 4.7) / 0.7, 0, 0.999), ln = Math.floor(w * 3), pr = (w * 3) % 1; st.look = t < 4.7 || t > 5.45 ? [0, -1] : [Math.round(lerp(-1, 1, pr)), -2 + ln]; st.mouth = t > 6.15 ? 'o' : 'flat'; st.blink = (t > 5.75 && t < 5.83) ? 1 : 0; }
  else if (t < 7.2) { x = 60; const u = (t - 6.7) / 0.5; st.arm = 1 - sm(0, 0.5, u) * 0.6; st.look = [Math.round(lerp(1, 2, u)), Math.round(lerp(0, -2, sm(0, 0.6, u)))]; st.eyes = u > 0.5 ? 'wide' : 'open'; st.mouth = u > 0.5 ? 'o' : ''; st.shine = u > 0.4; st.squash = u > 0.4 ? -0.07 * Math.sin((u - 0.4) / 0.6 * Math.PI) : 0; }
  else if (t < 7.5) { x = 60; st.arm = 0.4; st.look = [-1, 1]; st.mouth = 'flat'; st.blink = (t > 7.3 && t < 7.36) ? 1 : 0; }
  else if (t < 7.8) { x = 60; const u = (t - 7.5) / 0.3; st.arm = 0.4; st.look = [2, -2]; st.shine = true; st.mouth = 'flat'; st.squash = 0.12 * Math.sin(u * Math.PI); st.sweat = u; }
  else if (t < 8.9) { x = 60; st.arm = 1; st.look = [2, -2]; st.shine = true; st.squint = t > 8.05 && t < 8.7; st.mouth = t > 8.05 && t < 8.7 ? 'flat' : ''; st.sweat = 1 + (t - 7.8) * 0.9; }
  else { x = 60; st.arm = 0.3; st.look = [-1, -2]; st.mouth = 'flat'; st.squash = 0.03 * Math.sin((t - 8.9) * 6); }
  return { x, y: 50, st };
}

// ---------------- the paper plane: released by the Handler's hand, loops across the moon ----------------
const PLANE_KEYS = [[0.0, 104, 114], [0.35, 124, 98], [0.67, 166, 74], [0.93, 222, 76], [1.1, 252, 104], [1.26, 282, 98], [1.41, 286, 72], [1.56, 262, 56], [1.71, 240, 74], [1.86, 252, 104], [2.08, 286, 142], [2.32, 244, 200], [2.6, 188, 236]];
function catmull(keys, t) {
  let i = 0; while (i < keys.length - 2 && t > keys[i + 1][0]) i++;
  const p0 = keys[Math.max(0, i - 1)], p1 = keys[i], p2 = keys[i + 1], p3 = keys[Math.min(keys.length - 1, i + 2)];
  const u = clamp((t - p1[0]) / (p2[0] - p1[0]), 0, 1), u2 = u * u, u3 = u2 * u;
  const f = (a, b, c, d) => 0.5 * ((2 * b) + (-a + c) * u + (2 * a - 5 * b + 4 * c - d) * u2 + (-a + 3 * b - 3 * c + d) * u3);
  return [f(p0[1], p1[1], p2[1], p3[1]), f(p0[2], p1[2], p2[2], p3[2])];
}
function planeAt(t) {
  if (t < 2.6) { const a = catmull(PLANE_KEYS, t), b = catmull(PLANE_KEYS, Math.min(2.6, t + 0.02)), c = catmull(PLANE_KEYS, Math.max(0, t - 0.02)); const ang = Math.atan2(b[1] - a[1], b[0] - a[0]), ang0 = Math.atan2(a[1] - c[1], a[0] - c[0]); let da = ang - ang0; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI; return { ref: a, ang, roll: clamp(da * 6, -1.2, 1.2), mode: 'fly' }; }
  const head = PREF(52, 50, 17), land = PREF(70, 53, 0);
  if (t < 3.15) { const u = (t - 2.6) / 0.55; return { ref: [lerp(head[0] + 2, land[0], u), lerp(head[1] - 2, land[1], u) - Math.sin(u * Math.PI) * 22], ang: lerp(-2.4, 0.25, u) + Math.sin(u * 14) * 0.4 * (1 - u), mode: 'fall' }; }
  if (t < 4.2) return { ref: land, ang: 0.25, mode: 'ground' };
  if (t < 4.45) { const u = ease((t - 4.2) / 0.25), hand = PREF(63, 64, 5); return { ref: [lerp(land[0], hand[0], u), lerp(land[1], hand[1], u)], ang: lerp(0.25, -0.1, u), mode: 'lift' }; }
  return { ref: PREF(63, 64, 5), ang: 0, mode: 'note' };
}

const st = (H, k) => H.st[k] || 0;
// ---------------- far layer (rendered soft and hazed for depth) ----------------
const FAR = [[30, 214, 0.55, 0.55, 41], [336, 176, 0.5, 0.45, 42], [92, 128, 0.4, 0.32, 43], [-10, 120, 0.3, 0.26, 44], [300, 268, 0.62, 0.5, 45], [196, 96, 0.22, 0.2, 46], [380, 70, 0.25, 0.22, 47], [140, 330, 0.7, 0.42, 48]];
function drawFar(B, t) {
  for (const [qx, qy, par, sc, seed] of FAR.slice().sort((a, b) => a[2] - b[2])) {
    const s = S([qx, qy + bob(TA, seed, 1.5)], par), sv = { ...ISO }; ISO.ox = Math.round(s[0]); ISO.oy = Math.round(s[1]); ISO.k = sc * (1 + (CAM.z - 1) * par);
    drawIslandW(B, { T: 16, N: 3, mask: (i, j) => hash(i, j, seed) > 0.15 || (i === 1 && j === 1), depth: (i, j) => Math.round(10 + hash(i, j, seed + 1) * 20), cols: COL });
    if (seed % 2) { const tp = P(18, 14, 0); B.rect(tp[0], tp[1] - 6 * ISO.k, Math.max(1, ISO.k), 6 * ISO.k, COL.trunk); B.circle(tp[0], tp[1] - 8 * ISO.k, 3.5 * ISO.k, COL.leaf); }
    const lp = P(30, 30, 10); B.glow(lp[0] - 10, lp[1] - 10, lp[0] + 10, lp[1] + 10, COL.glow, (x, y) => 0.6 * Math.max(0, 1 - Math.hypot(x - lp[0], y - lp[1]) / 7)); B.put(lp[0], lp[1], COL.lampL);
    Object.assign(ISO, sv);
  }
}
// ---------------- pixel layer ----------------
function drawWorld(B, t) {
  wispsW(B, TA);
  GUST = typeof gustAt === 'function' ? gustAt(t) : 0;
  applyCam();
  drawIslandW(B, { T: 16, N: 6, mask: MASK, depth: DEPTH, cols: COL });
  crystalsW(B, TA); vinesW(B, TA);
  const H = heroAt(t);
  pondW(B, TA); waterfallW(B, TA); holeW(B, t);
  for (const [x, y, len, w] of [[16, 20, 26, 9], [72, 26, 22, 4], [22, 68, 12, 4], ...(H.hidden || H.clip ? [] : [[H.x, H.y, 16 + (H.st.hop || 0) * 0.3, 10]]), [59, 64, 6, 10]]) {
    const a = P(x - 1, y + 3, 0), b = P(x - 3, y + 3 + len, 0), rx = w * ISO.k * 0.9, ry = rx * 0.5;
    B.glow(Math.min(a[0], b[0]) - rx, Math.min(a[1], b[1]) - ry, Math.max(a[0], b[0]) + rx, Math.max(a[1], b[1]) + ry, hex('1f4a48'), (px, py) => { const vx = b[0] - a[0], vy = b[1] - a[1], u = clamp(((px - a[0]) * vx + (py - a[1]) * vy) / (vx * vx + vy * vy), 0, 1), cx = a[0] + vx * u, cy = a[1] + vy * u, d = Math.hypot((px - cx) / rx, (py - cy) / ry); return d > 1 ? 0 : 0.42 * (1 - d) * (1 - u * 0.6); }, 14);
  }
  const items = [
    [0, () => stonesW(B, [[22, 62], [30, 58], [38, 56]], COL)],
    [36, () => treeW(B, 16, 20, 0, COL)],
    [50, () => mushW(B, [[26, 24, 0, 2], [30, 30, 0, 1], [20, 34, 0, 1]], COL)],
    [90, () => drawMailbox(B, 22, 68, 0, COL, t - 1.15)],
    [98, () => lanternW(B, 72, 26, 0, COL, TA)],
    [112, () => planksW(B, 50, 62, 0, COL, t > 17.7 || (t > 7.85 && t < 8.85) ? 2 : 3)],
    [31, () => placedPlank(B, t)],
    [140, () => { for (const [x, y] of [[94, 50], [94, 57], [94, 64]]) box(B, x, y, 0, 2, 2, 8, COL.postL, COL.post, COL.postD); const a = P(95, 51, 6), b = P(95, 65, 6); B.line(a[0], a[1], b[0], b[1], COL.postL); }],
    [H.x + H.y, () => { if (H.hidden) { const p0 = P(H.x, H.y, -6); H.r = { head: p0, top: p0, face: p0, hand: p0 }; } else if (H.clip) H.r = heroClipped(B, H, t); else H.r = heroW(B, H.x, H.y, H.z || 0, H.st, HERO, COL.shadow); }],
    [-60, () => slabsPlaced(B, t)],
  ];
  for (const [x, y, r] of TUFTS) items.push([x + y + 0.5, () => tuftsW(B, TA, v => Math.abs(v - (x + y)) < 0.01)]);
  for (const [x, y] of FLOWERS) items.push([x + y + 0.4, () => flowersW(B, TA, v => Math.abs(v - (x + y)) < 0.01)]);
  items.sort((a, b) => a[0] - b[0]); for (const [, f] of items) f();
  blanketW(B, t, H); dustPuff(B, t, 2.98, P(H.x, H.y, 0)); dustPuff(B, t, 3.88, P(H.x, H.y, 0), 7); dustPuff(B, t, 4.18, P(H.x, H.y, 0), 7);
  const tc = P(16, 20, 26); fallingLeaf(B, TA, tc); fireflyW(B, TA, 6, tc[0] + 6, tc[1] + 6, 34, 1);
  const lp = P(73, 27, 23); mothsW(B, TA, lp);
  carriedPlank(B, t, H); stormW(B, t, H); dialW(B, t); tumbleweedW(B, t); pickaxeW(B, t, H); dirtW(B, t); slabsFlying(B, t); windStreaks(B, t);
  // plane / note
  const pl = planeAt(t), ps = S(pl.ref);
  if (pl.mode !== 'note') {
    const m = S(MOON.q, MOON.par), inMoon = Math.hypot(ps[0] - m[0], ps[1] - m[1]) < MOON.r * (1 + (CAM.z - 1) * MOON.par) + 2;
    const cols = inMoon ? { light: COL.sil, mid: COL.sil, dark: COL.sil } : { light: COL.planeL, mid: COL.planeM, dark: COL.planeD };
    if (pl.mode === 'ground') drawPlane(B, { x: ps[0], y: ps[1], ang: pl.ang, landed: 1 }, cols, 1.35 * ISO.k); else planeW(B, ps[0], ps[1], pl.ang, pl.roll || 0, cols, 1.35 * ISO.k);
    if (t < 3.1) for (let q = 1; q < 26; q++) { const tt = Math.min(2.59, t) - q * 0.035; if (tt < 0) break; const life = 1 - q / 26; if (hash(q, Math.floor(tt * 40), 5) > life) continue; const a = S(catmull(PLANE_KEYS, tt)); const j = [Math.sin(q * 2.3) * 2, Math.cos(q * 1.7) * 2 + q * 0.3]; B.put(a[0] + j[0], a[1] + j[1], (q + Math.floor(t * 20)) % 3 ? COL.zz : COL.lampL); }
  } else {
    // unfolded note held in front of the creature
    const u = sm(4.45, 4.6, t), w = Math.round(lerp(5, 15, u) * ISO.k / 1.4), h = Math.round(lerp(3, 11, u) * ISO.k / 1.4);
    if (t < 4.62 || t > 6.68) { const x = Math.round(ps[0] - w / 2), y = Math.round(ps[1] - h); B.rect(x - 1, y - 1, w + 2, h + 2, COL.paperS); B.rect(x, y, w, h, COL.paper); for (let r = 2; r < h - 1; r += 2) B.rect(x + 2, y + r, Math.round(w * (r % 4 ? 0.7 : 0.5)), 1, COL.ink); B.line(x, y, x + w - 1, y + h - 1, COL.paperD); }
  }
  const fk = Math.max(1, ISO.k / 1.4), hd = H.r.head;
  // Zzz while asleep
  if (t < 2.6) for (let q = 0; q < 3; q++) { const ph = (t * 0.5 + q / 3) % 1; if (ph > 0.9) continue; const x = Math.round(hd[0] + (8 + ph * 18 + Math.sin(ph * 6 + q) * 2) * fk), y = Math.round(hd[1] - (10 + ph * 34) * fk), s = Math.round((ph > 0.45 ? 2 : 1) * fk); glyph(B, 'z', x + s, y + s, COL.zzO, s); glyph(B, 'z', x, y, COL.zz, s); }
  // startle: burst lines + "!" bubble
  if (t > 2.6 && t < 3.05) { const a = (t - 2.6) / 0.45; for (const [dx, dy] of [[-10, -12], [0, -16], [10, -12], [-14, -4], [14, -4]]) { const L = Math.round(4 * fk * Math.sin(a * Math.PI)); for (let s = 0; s < L; s++) B.put(hd[0] + dx * fk * (1 + a * 0.4) + Math.sign(dx) * s * 0.5, hd[1] + dy * fk * (1 + a * 0.4) - s * (dy < -8 ? 1 : 0.3), COL.zz); } }
  if (t > 2.66 && t < 3.6) { const a = sm(2.66, 2.76, t) * (1 - sm(3.45, 3.6, t)), G = Math.max(1, Math.round(fk)), w = 9 * G, h = Math.round(13 * G * a), x = Math.round(hd[0] + 9 * fk), y = Math.round(hd[1] - 16 * fk - h); if (h > 3) { B.rect(x, y, w, h, COL.zzO); B.rect(x + G, y + G, w - 2 * G, h - 2 * G, COL.zz); B.rect(x + G, y + h, 2 * G, 2 * G, COL.zzO); if (a > 0.9) glyph(B, '!', x + 4 * G, y + 3 * G, COL.flag, G); } }
  // sweat drop after the gulp
  if (st(H, 'sweat') > 0 && st(H, 'sweat') < 1.9) { const u = Math.min(1, H.st.sweat / 1.9), x = Math.round(hd[0] - 6 * fk), y = Math.round(hd[1] + (2 + u * 10) * fk), G = Math.max(1, Math.round(fk)); B.rect(x, y, G * 2, G * 3, hex('c9f1ff')); B.rect(x + G * 0.5, y - G, G, G, hex('c9f1ff')); B.put(x, y, COL.planeL); }
  // measuring the moon with a plank held at arm's length
  if (t > 7.8 && t < 8.9) {
    const up = sm(7.8, 8.12, t) * (1 - sm(8.7, 8.9, t)), mS = S(MOON.q, MOON.par), from = P(59, 64, 6), base = P(68, 47, 16), aim = Math.atan2(mS[1] - base[1], mS[0] - base[0]);
    const L0 = 24 * ISO.k * 0.85, to = [base[0] + Math.cos(aim) * L0 * 0.42, base[1] + Math.sin(aim) * L0 * 0.42], cx = lerp(from[0], to[0], up), cy = lerp(from[1], to[1], up), ang = lerp(-0.46, aim, up) + Math.sin(t * 9) * 0.015 * up;
    const L = L0, W = 3.2 * ISO.k * 0.8, ca = Math.cos(ang), sa = Math.sin(ang), T = (u, v) => [cx + u * ca - v * sa, cy + u * sa + v * ca];
    B.poly([T(-L / 2, -W / 2), T(L / 2, -W / 2), T(L / 2, W / 2), T(-L / 2, W / 2)], COL.woodL); B.poly([T(-L / 2, W / 6), T(L / 2, W / 6), T(L / 2, W / 2), T(-L / 2, W / 2)], COL.wood);
    for (let q = 1; q < 4; q++) { const p = T(-L / 2 + q * L / 4, -W / 2); B.put(p[0], p[1], COL.woodD); }
    if (up > 0.95) { const tip = T(L / 2, 0), mR = MOON.r * (1 + (CAM.z - 1) * MOON.par), dx = mS[0] - tip[0], dy = mS[1] - tip[1], d = Math.hypot(dx, dy), n = Math.floor((d - mR) / 5); for (let q = 1; q < n * sm(8.12, 8.45, t); q++) if (q % 2) B.put(tip[0] + dx / d * q * 5, tip[1] + dy / d * q * 5, COL.zz); }
    if (up > 0.95 && t > 8.15 && t < 8.6) { const tip = T(L / 2, 0); B.put(tip[0] + 3, tip[1] - 3, COL.planeL); B.put(tip[0] + 4, tip[1] - 4, COL.planeL); B.put(tip[0] + 2, tip[1] - 4, COL.zz); B.put(tip[0] + 4, tip[1] - 2, COL.zz); }
  }
  // the first thought starts to form (it becomes a storm in chapter I)
  if (t > 8.9 && t < 10) { const g = sm(8.9, 10.0, t), x = hd[0] + 10 * fk, y = hd[1] - (22 + g * 6) * fk, w = (18 + g * 22) * fk;
    B.circle(hd[0] + 5 * fk, hd[1] - 7 * fk, 1.5 * fk, COL.cloudL); if (g > 0.15) B.circle(hd[0] + 8 * fk, hd[1] - 13 * fk, 2.5 * fk, COL.cloudL);
    if (g > 0.3) { pixCloud(B, x + w * 0.3, y, w, { light: COL.cloudL, mid: COL.cloud, dark: COL.cloudD }, 7); const dots = Math.floor((t - 9.2) / 0.22) % 4, G = Math.max(2, Math.round(fk * 1.4)); for (let q = 0; q < dots; q++) B.rect(Math.round(x + w * 0.3 - 3 * G + q * 2.5 * G), Math.round(y - G), G, G, COL.ink); } }
  return H;
}

// ---------------- hi-res layers ----------------
function moonScreen() { const s = S(MOON.q, MOON.par); return { x: s[0] * SC, y: s[1] * SC, r: MOON.r * (1 + (CAM.z - 1) * MOON.par) * SC }; }
function drawSky(F, t) {
  let g = F.createLinearGradient(0, 0, 0, FH); g.addColorStop(0, '#0d0a1c'); g.addColorStop(0.55, '#1a1430'); g.addColorStop(1, '#0b0812'); F.fillStyle = g; F.fillRect(0, 0, FW, FH);
  const m = moonScreen();
  // the warm halo of the "moon"
  F.save(); F.globalCompositeOperation = 'lighter'; g = F.createRadialGradient(m.x, m.y, m.r * 0.9, m.x, m.y, m.r * 4.2); g.addColorStop(0, 'rgba(255,226,170,0.42)'); g.addColorStop(0.35, 'rgba(255,200,140,0.12)'); g.addColorStop(1, 'rgba(255,190,130,0)'); F.fillStyle = g; F.fillRect(0, 0, FW, FH); F.restore();
  // moonlight falling on the island (soft cone)
  const isl = SH(PREF(48, 48, 0));
  F.save(); F.globalCompositeOperation = 'lighter'; F.filter = 'blur(40px)'; g = F.createLinearGradient(m.x, m.y, isl[0], isl[1]); g.addColorStop(0, 'rgba(255,225,170,0.16)'); g.addColorStop(1, 'rgba(255,225,170,0.04)'); F.fillStyle = g;
  F.beginPath(); F.moveTo(m.x - m.r * 0.6, m.y + m.r * 0.3); F.lineTo(m.x + m.r * 0.5, m.y + m.r * 0.6); F.lineTo(isl[0] + 330, isl[1] + 120); F.lineTo(isl[0] - 360, isl[1] + 60); F.closePath(); F.fill(); F.restore();
  // "stars": warm motes drifting slowly (they are dust in the lamp light; nobody knows yet)
  const R = mulberry(17); for (let q = 0; q < 140; q++) {
    const par = 0.15 + R() * 0.5, q0 = [R() * 420 - 30, R() * 470 - 10], drift = [-t * (1.2 + R()), t * (0.8 + R() * 1.2)], s = S([q0[0] + drift[0], q0[1] + drift[1]], par), tw = 0.35 + 0.65 * Math.pow(0.5 + 0.5 * Math.sin(t * (1 + R() * 2.5) + q), 2), big = R() < 0.12;
    const x = s[0] * SC, y = s[1] * SC, d = Math.hypot(x - m.x, y - m.y) / (m.r * 5), warm = clamp(1 - d, 0, 1);
    F.fillStyle = `rgba(${255},${Math.round(232 + 20 * (1 - warm))},${Math.round(200 + 50 * (1 - warm))},${tw * (0.45 + 0.4 * warm)})`;
    F.beginPath(); F.arc(x, y, big ? 2.6 : 1.5, 0, 7); F.fill();
    if (big && tw > 0.7) { F.fillRect(x - 7, y - 0.6, 14, 1.2); F.fillRect(x - 0.6, y - 7, 1.2, 14); }
  }
  { const cov = typeof stormState === 'function' && TA > 12.7 ? stormState(warp(TA)).cover : 0; F.save(); F.globalCompositeOperation = 'lighter'; F.filter = 'blur(18px)';
    for (let q = 0; q < 7; q++) { const a = 1.85 + q * 0.22 + Math.sin(t * 0.15 + q) * 0.05, len = m.r * (6 + (q % 3) * 1.5), w = m.r * (0.18 + (q % 2) * 0.1);
      const g2 = F.createLinearGradient(m.x, m.y, m.x + Math.cos(a) * len, m.y + Math.sin(a) * len); g2.addColorStop(0, `rgba(255,228,180,${0.11 * (1 - cov)})`); g2.addColorStop(1, 'rgba(255,228,180,0)'); F.fillStyle = g2;
      F.beginPath(); F.moveTo(m.x, m.y); F.lineTo(m.x + Math.cos(a - 0.04) * len - Math.sin(a) * w, m.y + Math.sin(a - 0.04) * len + Math.cos(a) * w); F.lineTo(m.x + Math.cos(a + 0.04) * len + Math.sin(a) * w, m.y + Math.sin(a + 0.04) * len - Math.cos(a) * w); F.closePath(); F.fill(); }
    F.restore(); }
  // the moon itself: a warm frosted disc with faint mottling
  g = F.createRadialGradient(m.x - m.r * 0.3, m.y - m.r * 0.3, m.r * 0.05, m.x, m.y, m.r); g.addColorStop(0, '#fffdf4'); g.addColorStop(0.6, '#fff2d2'); g.addColorStop(1, '#f1d394'); F.fillStyle = g; F.beginPath(); F.arc(m.x, m.y, m.r, 0, 7); F.fill();
  F.save(); F.beginPath(); F.arc(m.x, m.y, m.r, 0, 7); F.clip(); F.fillStyle = 'rgba(214,180,120,0.22)';
  for (const [x, y, r] of [[-0.35, -0.2, 0.22], [0.25, 0.3, 0.16], [0.42, -0.32, 0.12], [-0.1, 0.52, 0.1], [0.04, -0.02, 0.08], [-0.55, 0.3, 0.1]]) { F.beginPath(); F.arc(m.x + x * m.r, m.y + y * m.r, r * m.r, 0, 7); F.fill(); }
  F.restore();
  // a barely-there dark rim behind the moon (the lamp shade, hidden in the dark)
  // depth haze at the bottom (the desk below is not revealed yet)
  g = F.createLinearGradient(0, FH * 0.62, 0, FH); g.addColorStop(0, 'rgba(10,7,16,0)'); g.addColorStop(1, 'rgba(10,7,16,0.85)'); F.fillStyle = g; F.fillRect(0, 0, FW, FH);
  // warm under-glow of the island lantern
  const lp = SH(PREF(83, 23, 23)); F.save(); F.globalCompositeOperation = 'lighter'; g = F.createRadialGradient(lp[0], lp[1], 4, lp[0], lp[1], 260 * CAM.z); g.addColorStop(0, 'rgba(255,200,120,0.22)'); g.addColorStop(1, 'rgba(255,180,100,0)'); F.fillStyle = g; F.fillRect(0, 0, FW, FH); F.restore();
}
function drawGrade(F, t) {
  const m = moonScreen();
  F.save(); F.globalCompositeOperation = 'soft-light'; const g = F.createRadialGradient(m.x, m.y, 40, m.x - 300, m.y + 500, 1100); g.addColorStop(0, 'rgba(255,224,160,0.7)'); g.addColorStop(1, 'rgba(40,24,70,0.55)'); F.fillStyle = g; F.fillRect(0, 0, FW, FH); F.restore();
  F.save(); F.globalCompositeOperation = 'soft-light'; const g3 = F.createLinearGradient(0, FH * 0.45, 0, FH); g3.addColorStop(0, 'rgba(60,80,150,0)'); g3.addColorStop(1, 'rgba(60,80,150,0.45)'); F.fillStyle = g3; F.fillRect(0, 0, FW, FH); F.restore();
  vignette(F, 0.5, '8,5,14');
}

// ---------------- overlays: captions, chapter cards, the note ----------------
function fadeIO(t, a, b, f = 0.25) { return Math.min(sm(a, a + f, t), 1 - sm(b - f, b, t)); }
function caption(F, t, a, b, lines, y = 1150, px = 8, x = FW / 2, lineIn) {
  const al = fadeIO(t, a, b); if (al <= 0) return; F.save(); F.globalAlpha = al;
  const lh = px * 7 + px * 4, top = y, bot = y + lines.length * lh;
  if (y > 900) { const g = F.createLinearGradient(0, top - 120, 0, bot + 120); g.addColorStop(0, 'rgba(6,4,12,0)'); g.addColorStop(0.35, 'rgba(6,4,12,0.55)'); g.addColorStop(0.75, 'rgba(6,4,12,0.55)'); g.addColorStop(1, 'rgba(6,4,12,0)'); F.fillStyle = g; F.fillRect(0, top - 120, FW, bot - top + 240); }
  lines.forEach((L, i) => { const la = lineIn && lineIn[i] ? sm(lineIn[i], lineIn[i] + 0.25, t) : 1; if (la <= 0) return; F.globalAlpha = al * la; hiText(F, L, x, y + i * lh + Math.round((1 - al * la) * 12), px, i === 0 ? '#fff6ea' : '#f3e6cf', { align: 'c' }); });
  F.restore();
}
function bug(F, t) {
  F.save(); F.globalAlpha = 0.7; hiText(F, 'FABLE 5.2 · A FIELD GUIDE', 44, 44, 3, '#f3e6cf', {}); F.restore();
  const ch = t < 9.3 ? 'PROLOGUE' : t < 19.5 ? 'CHAPTER I · THE REQUEST' : t < 34.2 ? 'CHAPTER II · THE WORK' : t < 51.6 ? 'CHAPTER III · THE RULES' : 'CHAPTER IV · ONE PLANK SHORT', a = t < 9.3 ? fadeIO(t, 0.2, 9.3, 0.3) : t < 19.5 ? fadeIO(t, 9.3, 19.5, 0.3) : t < 34.2 ? fadeIO(t, 19.5, 34.2, 0.3) : t < 51.6 ? fadeIO(t, 34.2, 51.6, 0.3) : sm(51.6, 51.9, t);
  F.save(); F.globalAlpha = 0.55 * a; hiText(F, ch, 44, 70, 3, '#d97757', {}); F.restore();
}
function chapterCard(F, t, a, b, num, title, cx = FW / 2, cy = 1110) {
  const al = fadeIO(t, a, b, 0.3); if (al <= 0) return; F.save(); F.globalAlpha = al;
  const y = cy - (1 - sm(a, a + 0.5, t)) * 16;
  hiText(F, num, cx, y, 4, '#d97757', { align: 'c' });
  const w = textW(title, 9); F.fillStyle = 'rgba(217,119,87,0.85)'; F.fillRect(cx - w / 2, y + 44, w * sm(a, a + 0.6, t), 4);
  hiText(F, title, cx, y + 66, 9, '#fff6ea', { align: 'c' }); F.restore();
}
function noteCard(F, t, H) {
  const inn = sm(4.55, 4.95, t), out = sm(6.45, 6.7, t), s = inn * (1 - out); if (s <= 0.001) return;
  const src = SH(PREF(63, 64, 7)), cx = lerp(src[0], FW / 2, s), cy = lerp(src[1], 360, s);
  const over = s < 1 ? 1 + Math.sin(inn * Math.PI) * 0.04 : 1, sc = s * over * 0.86, W = 790, Hh = 520, rot = -0.035 + Math.sin(t * 0.7) * 0.006;
  F.save(); F.translate(cx, cy); F.rotate(rot); F.scale(sc, sc);
  // unfold: the paper opens from thirds (top and bottom flaps swing open)
  const uf = sm(4.6, 4.98, t) * (1 - sm(6.45, 6.65, t));
  if (uf < 0.999) { const fh = Hh / 3, open = uf, flap = fh * open;
    F.shadowColor = 'rgba(0,0,0,0.5)'; F.shadowBlur = 30; F.shadowOffsetY = 12; F.fillStyle = '#f0e6cf'; F.fillRect(-W / 2, -fh / 2 - flap, W, fh + 2 * flap); F.shadowColor = 'transparent';
    // the flaps still swinging open show their darker back side, with a crease at each fold
    F.fillStyle = `rgb(${Math.round(200 + 40 * open)},${Math.round(186 + 38 * open)},${Math.round(156 + 34 * open)})`; F.fillRect(-W / 2, -fh / 2 - flap, W, flap); F.fillRect(-W / 2, fh / 2, W, flap);
    F.fillStyle = 'rgba(120,100,70,0.45)'; F.fillRect(-W / 2, -fh / 2 - 1, W, 3); F.fillRect(-W / 2, fh / 2 - 1, W, 3);
    F.fillStyle = 'rgba(255,250,235,0.7)'; F.fillRect(-W / 2, -fh / 2 - flap, W, 2); F.restore(); return; }
  F.shadowColor = 'rgba(0,0,0,0.55)'; F.shadowBlur = 40; F.shadowOffsetY = 18; F.fillStyle = '#f3ead6'; F.fillRect(-W / 2, -Hh / 2, W, Hh); F.shadowColor = 'transparent';
  // paper: fold creases from the plane, a little warm light from the moon
  const g = F.createLinearGradient(-W / 2, -Hh / 2, W / 2, Hh / 2); g.addColorStop(0, 'rgba(255,240,210,0.0)'); g.addColorStop(1, 'rgba(120,100,80,0.18)'); F.fillStyle = g; F.fillRect(-W / 2, -Hh / 2, W, Hh);
  F.strokeStyle = 'rgba(150,130,100,0.35)'; F.lineWidth = 2; F.beginPath(); F.moveTo(-W / 2, -Hh / 2); F.lineTo(0, Hh / 2); F.lineTo(W / 2, -Hh / 2); F.moveTo(0, -Hh / 2); F.lineTo(0, Hh / 2); F.stroke();
  F.strokeStyle = 'rgba(255,255,255,0.35)'; F.beginPath(); F.moveTo(-W / 2 + 3, -Hh / 2 + 2); F.lineTo(2, Hh / 2 - 2); F.stroke();
  // handwriting, revealed letter by letter as the creature reads
  const lines = ['BUILD ME', 'A BRIDGE', 'TO THE MOON.'], total = lines.join('').length, shown = Math.floor(clamp((t - 4.7) / 0.7, 0, 1) * total);
  let used = 0; lines.forEach((L, i) => { const vis = L.slice(0, Math.max(0, shown - used)); used += L.length; hiText(F, vis, -W / 2 + 64, -Hh / 2 + 74 + i * 100, 9, '#2a2350', { shadow: false, jitter: 1.4 }); });
  if (t > 5.45) { F.globalAlpha = sm(5.45, 5.7, t); hiText(F, '— THE HANDLER', W / 2 - 60 - textW('— THE HANDLER', 5), Hh / 2 - 70, 5, '#2a2350', { shadow: false });
    // a tiny drawn hand next to the signature
    F.fillStyle = '#2a2350'; const hx = W / 2 - 60 - textW('— THE HANDLER', 5) - 46, hy = Hh / 2 - 74; for (const [x, y, w, h] of [[0, 10, 22, 18], [0, 0, 4, 12], [6, -4, 4, 16], [12, -2, 4, 14], [18, 2, 4, 10], [-6, 14, 6, 4]]) F.fillRect(hx + x, hy + y, w, h); }
  F.restore();
}

// ---------------- cinematic hi-res extras ----------------
// the Handler's hand: a huge soft silhouette that lets the plane go and withdraws into the dark
function handerHand(F, t) {
  if (t > 2.2) return; const w = ease(clamp((t - 1.05) / 1.1, 0, 1)), base = S([92 - w * 110, 104 - w * 150], 0.7), sc = 3 * (1 + (CAM.z - 1) * 0.7) * 1.15;
  const x = base[0] * SC, y = base[1] * SC; if (y < -600 * sc / 3) return;
  F.save(); F.translate(x, y); F.rotate(0.65 - w * 0.25); F.scale(sc, sc); F.filter = 'blur(0.8px)';
  const fill = F.createLinearGradient(40, 60, -60, -160); fill.addColorStop(0, '#6a5578'); fill.addColorStop(0.45, '#3a2c48'); fill.addColorStop(1, '#120c1a');
  F.fillStyle = fill; F.beginPath(); F.ellipse(-30, -40, 46, 56, 0.2, 0, 7); F.fill();                        // palm
  for (const [fx, fy, len, a] of [[-6, 4, 54, 0.05], [10, -6, 60, -0.1], [24, -20, 56, -0.25], [34, -38, 44, -0.4]]) { F.save(); F.translate(fx, fy); F.rotate(a); F.beginPath(); F.roundRect(-8, -4, 16, len, 8); F.fill(); F.restore(); }
  F.save(); F.translate(-50, 4); F.rotate(0.8); F.beginPath(); F.roundRect(-8, -4, 16, 40, 8); F.fill(); F.restore();   // thumb
  F.beginPath(); F.rect(-90, -170, 90, 120); F.fill();                                                      // wrist into the dark
  // warm rim of moonlight on the fingertips
  F.filter = 'blur(1.6px)'; F.strokeStyle = 'rgba(255,214,160,0.75)'; F.lineWidth = 3.5;
  for (const [fx, fy, len, a] of [[-6, 4, 54, 0.05], [10, -6, 60, -0.1], [24, -20, 56, -0.25], [34, -38, 44, -0.4]]) { F.save(); F.translate(fx, fy); F.rotate(a); F.beginPath(); F.arc(0, len - 8, 7.5, -0.2, Math.PI + 0.2); F.stroke(); F.fillStyle = 'rgba(255,230,205,0.22)'; F.beginPath(); F.roundRect(-4, len - 12, 8, 7, 3); F.fill(); F.strokeStyle = 'rgba(255,220,190,0.12)'; F.lineWidth = 1.5; F.beginPath(); F.moveTo(-6, len * 0.45); F.lineTo(6, len * 0.45); F.stroke(); F.strokeStyle = 'rgba(255,214,160,0.75)'; F.lineWidth = 3.5; F.restore(); }
  F.strokeStyle = 'rgba(255,214,160,0.5)'; F.beginPath(); F.ellipse(-30, -40, 46, 56, 0.2, -0.3, 1.1); F.stroke();
  F.restore();
}
// the plane's shadow sweeps across the sleeping face (the hook)
function shadowSweep(F, t) {
  if (t < 0.1 || t > 0.75) return; const u = (t - 0.1) / 0.65, x = lerp(-500, FW + 300, u), y = lerp(380, 860, u);
  F.save(); F.filter = 'blur(26px)'; F.globalAlpha = 0.55 * Math.sin(u * Math.PI); F.fillStyle = '#05030a';
  F.translate(x, y); F.rotate(0.45); F.beginPath(); F.moveTo(260, 0); F.lineTo(-220, -170); F.lineTo(-120, 0); F.lineTo(-220, 150); F.closePath(); F.fill(); F.restore();
}
// foreground depth: an out-of-focus leafy branch on the right edge and a soft cloud drifting past the lens
function foreground(F, t) {
  const b = S([392, 150], 1.9), bx = b[0] * SC, by = b[1] * SC, sc = 1 + (CAM.z - 1) * 0.9;
  if (bx < FW + 400 && bx > -200) {
    F.save(); F.filter = 'blur(12px)'; F.fillStyle = '#05040a'; F.translate(bx, by); F.scale(sc, sc); F.rotate(Math.sin(t * 0.9) * 0.03);
    F.lineWidth = 16; F.strokeStyle = '#05040a'; F.beginPath(); F.moveTo(200, -40); F.quadraticCurveTo(40, 20, -60, 120); F.stroke();
    for (const [lx, ly, r, a] of [[-60, 120, 34, 0.4], [-20, 70, 30, -0.3], [40, 40, 36, 0.6], [100, 0, 30, -0.2], [-80, 170, 26, 1.0], [10, 140, 28, 0.2], [150, -30, 28, 0.5]]) { F.beginPath(); F.ellipse(lx + Math.sin(t * 1.3 + lx) * 3, ly, r, r * 0.5, a, 0, 7); F.fill(); }
    F.restore();
  }
  if (t > 0.3 && t < 2.6) { const u = (t - 0.3) / 2.3, c = [lerp(-600, FW + 600, u), lerp(1220, 1100, u)];
    F.save(); F.filter = 'blur(40px)'; F.globalAlpha = 0.55 * Math.sin(u * Math.PI); F.fillStyle = '#5c4d82'; for (const [dx, dy, r] of [[-160, 20, 150], [0, -30, 190], [170, 10, 150], [320, 40, 110]]) { F.beginPath(); F.arc(c[0] + dx, c[1] + dy, r, 0, 7); F.fill(); } F.restore(); }
}
