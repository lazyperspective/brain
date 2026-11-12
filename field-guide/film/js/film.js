'use strict';
// ------------------------------------------------------------------
// FABLE 5.2 — A FIELD GUIDE.  Film timeline (seconds). Built 10 s at a time.
//   0–10  PROLOGUE: the message arrives
// ------------------------------------------------------------------
const PAL = [...['d97757', 'a8553b', 'f2a585', '6e2a1a', 'ffd9c2', '1b1426', 'fff6ea'],
  '3f9a7c', '2f7a6a', '6fc49a', '1f5450', '6b4766', '553858', '3e2848', '2a1a35', '8f6f8c', '4a3046', '5e3b28', '8a5a3a', 'b07a4f', '3a2420',
  '6a62b0', '9b8fd6', '463f80', 'e2574c', 'ffd88a', 'fff1c4', 'f5b45a', 'efe4d0', 'b9b2c4', '7d7790', 'ffe7a3', 'fff6d8', 'ffffff',
  'f3ead6', 'd9cdb4', 'a8987c', '2a2350', 'e9e3f5', 'c3b9e0', '8e82b8', '1c1530', '140f22', '7fd7ff', '4aa3d8', 'c9f1ff', '1c2348', '2f3c78', '4a5a9a', '6a5a8a', '4f3d6e', '3a2a55', 'b3a6d6'];
const COL = {};
['top:3f9a7c', 'topD:2f7a6a', 'topL:6fc49a', 'lipL:6fc49a', 'lipR:3f9a7c', 'lipD:2f7a6a', 'dirtL:6b4766', 'dirtR:553858', 'strata:3e2848', 'stone:8f6f8c', 'root:4a3046', 'flower:ffe7a3',
  'trunk:5e3b28', 'trunkL:8a5a3a', 'trunkD:4a3046', 'leaf:2f7a6a', 'leafL:6fc49a', 'leafD:1f5450', 'wood:8a5a3a', 'woodL:b07a4f', 'woodD:5e3b28', 'shadow:1f5450',
  'post:5e3b28', 'postL:8a5a3a', 'postD:3a2420', 'box:6a62b0', 'boxL:9b8fd6', 'boxD:463f80', 'flag:e2574c', 'lamp:ffd88a', 'lampL:fff1c4', 'lampD:f5b45a', 'glow:f5b45a',
  'stem:efe4d0', 'cap:e2574c', 'spot:fff1c4', 'stoneL:b9b2c4', 'stoneD:7d7790', 'paper:f3ead6', 'paperD:d9cdb4', 'paperS:a8987c', 'ink:2a2350', 'cloudL:e9e3f5', 'cloud:c3b9e0', 'cloudD:8e82b8',
  'planeL:ffffff', 'planeM:fff6d8', 'planeD:8f6f8c', 'sil:2a1a35', 'zz:fff6d8', 'zzO:2a1a35'].forEach(s => { const [k, v] = s.split(':'); COL[k] = hex(v); });

const MASK = (i, j) => { const d = Math.hypot(i - 2.5, j - 2.5); return d <= 2.85 && !(hash(i, j, 77) < 0.3 && d > 2.4); };
const DEPTH = (i, j) => Math.round(16 + 44 * Math.max(0, 1 - Math.hypot(i - 2.5, j - 2.5) / 3.6) + hash(i, j, 5) * 12);
const MOON = { q: [272, 84], r: 44, par: 0.35 };     // the "moon" (it is the Handler's desk lamp; revealed at the end)

// ---------------- camera ----------------
const CAMKEYS = [[0, 182, 236, 1.0], [2.4, 184, 240, 1.08], [3.9, 192, 246, 1.18], [4.6, 194, 247, 1.24], [7.3, 196, 249, 1.30], [8.5, 214, 176, 1.02], [10, 210, 184, 1.06]];

// ---------------- hero performance ----------------
function heroAt(t) {
  const st = { eyes: 'open', look: [0, 0], mouth: '', arm: 0, hop: 0, squash: 0, walk: null, breathe: 0, blink: 0 };
  let x = 52;
  if (t < 2.4) { st.eyes = 'closed'; st.breathe = Math.sin(t * 2 * Math.PI / 1.6) > 0.3 ? 1 : 0; st.squash = 0.04 * Math.sin(t * 2 * Math.PI / 1.6); }
  else if (t < 2.8) { const u = (t - 2.4) / 0.4; st.eyes = 'wide'; st.mouth = 'o'; st.hop = Math.sin(u * Math.PI) * 7; st.squash = u < 0.15 ? 0.22 * (u / 0.15) : -0.12 * Math.sin((u - 0.15) / 0.85 * Math.PI); st.arm = Math.sin(u * Math.PI); st.look = [0, -1]; }
  else if (t < 3.2) { const u = (t - 2.8) / 0.4; st.squash = 0.14 * Math.sin(Math.min(1, u * 2.5) * Math.PI) * (1 - u); st.look = [Math.round(sm(0.3, 0.8, u)), Math.round(sm(0.3, 0.8, u))]; st.blink = (t > 2.95 && t < 3.03) ? 1 : 0; }
  else if (t < 3.9) { const u = (t - 3.2) / 0.7; x = 52 + 8 * ease(u); st.walk = u * 3; st.look = [1, 1]; st.mouth = ''; }
  else if (t < 4.6) { x = 60; const u = (t - 3.9) / 0.7; st.arm = sm(0, 0.4, u); st.look = [1, 1]; st.squash = 0.06 * Math.sin(u * Math.PI); }
  else if (t < 7.6) { x = 60; st.arm = 1; const ln = Math.min(2, Math.floor(clamp((t - 4.8) / 0.95, 0, 0.999) * 3)), pr = ((t - 4.8) / 0.95 * 3) % 1; st.look = t < 4.8 || t > 5.75 ? [0, -1] : [Math.round(lerp(-1, 1, pr)), -2 + ln]; st.mouth = t > 6.4 ? 'o' : 'flat'; st.blink = (t > 5.9 && t < 5.98) ? 1 : 0; }
  else if (t < 8.3) { x = 60; const u = (t - 7.6) / 0.7; st.arm = 1 - sm(0, 0.5, u) * 0.6; st.look = [Math.round(lerp(1, 2, u)), Math.round(lerp(1, -2, sm(0, 0.6, u)))]; st.eyes = u > 0.55 ? 'wide' : 'open'; st.mouth = u > 0.55 ? 'o' : ''; st.shine = u > 0.4; st.squash = u > 0.5 ? -0.06 * Math.sin((u - 0.5) * 2 * Math.PI) : 0; }
  else if (t < 9.0) { x = 60; const u = (t - 8.3) / 0.7; st.arm = 0.4; st.look = u < 0.45 ? [-1, 1] : [1, -2]; st.blink = (t > 8.62 && t < 8.7) ? 1 : 0; st.mouth = 'flat'; }
  else { x = 60; st.arm = 0.4; st.look = [-1, -2]; st.mouth = 'flat'; st.shine = true; st.squash = 0.03 * Math.sin((t - 9) * 6); }
  return { x, y: 50, st };
}

// ---------------- the paper plane ----------------
const PLANE_KEYS = [[0.0, 14, 150], [0.32, 78, 100], [0.62, 160, 74], [0.86, 222, 76], [1.02, 252, 104], [1.16, 282, 98], [1.3, 286, 72], [1.44, 262, 56], [1.58, 240, 74], [1.72, 252, 104], [1.92, 286, 142], [2.14, 244, 200], [2.4, 188, 236]];
function catmull(keys, t) {
  let i = 0; while (i < keys.length - 2 && t > keys[i + 1][0]) i++;
  const p0 = keys[Math.max(0, i - 1)], p1 = keys[i], p2 = keys[i + 1], p3 = keys[Math.min(keys.length - 1, i + 2)];
  const u = clamp((t - p1[0]) / (p2[0] - p1[0]), 0, 1), u2 = u * u, u3 = u2 * u;
  const f = (a, b, c, d) => 0.5 * ((2 * b) + (-a + c) * u + (2 * a - 5 * b + 4 * c - d) * u2 + (-a + 3 * b - 3 * c + d) * u3);
  return [f(p0[1], p1[1], p2[1], p3[1]), f(p0[2], p1[2], p2[2], p3[2])];
}
function planeAt(t, hero) {
  if (t < 2.4) { const a = catmull(PLANE_KEYS, t), b = catmull(PLANE_KEYS, Math.min(2.4, t + 0.02)), c = catmull(PLANE_KEYS, Math.max(0, t - 0.02)); const ang = Math.atan2(b[1] - a[1], b[0] - a[0]), ang0 = Math.atan2(a[1] - c[1], a[0] - c[0]); let da = ang - ang0; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI; return { ref: a, ang, roll: clamp(da * 6, -1.2, 1.2), mode: 'fly' }; }
  const head = PREF(52, 50, 17), land = PREF(70, 53, 0);
  if (t < 2.95) { const u = (t - 2.4) / 0.55; return { ref: [lerp(head[0] + 2, land[0], u), lerp(head[1] - 2, land[1], u) - Math.sin(u * Math.PI) * 22], ang: lerp(-2.4, 0.25, u) + Math.sin(u * 14) * 0.4 * (1 - u), mode: 'fall' }; }
  if (t < 3.9) return { ref: land, ang: 0.25, mode: 'ground' };
  if (t < 4.3) { const u = ease((t - 3.9) / 0.4), hand = PREF(63, 64, 5); return { ref: [lerp(land[0], hand[0], u), lerp(land[1], hand[1], u)], ang: lerp(0.25, -0.1, u), mode: 'lift' }; }
  return { ref: PREF(63, 64, 5), ang: 0, mode: 'note' };
}

// ---------------- pixel layer ----------------
function drawWorld(B, t) {
  wispsW(B, t);
  // distant islets (parallax, smaller scale), each with a tiny lantern: other islands, other jobs
  for (const [qx, qy, par, sc, seed] of [[30, 214, 0.55, 0.55, 41], [336, 176, 0.5, 0.45, 42], [92, 128, 0.4, 0.32, 43]]) {
    const s = S([qx, qy + bob(t, seed, 1.5)], par), sv = { ...ISO }; ISO.ox = Math.round(s[0]); ISO.oy = Math.round(s[1]); ISO.k = sc * (1 + (CAM.z - 1) * par);
    drawIslandW(B, { T: 16, N: 3, mask: (i, j) => hash(i, j, seed) > 0.15 || (i === 1 && j === 1), depth: (i, j) => Math.round(10 + hash(i, j, seed + 1) * 20), cols: COL });
    const lp = P(30, 30, 10); B.glow(lp[0] - 10, lp[1] - 10, lp[0] + 10, lp[1] + 10, COL.glow, (x, y) => 0.6 * Math.max(0, 1 - Math.hypot(x - lp[0], y - lp[1]) / 7)); B.put(lp[0], lp[1], COL.lampL);
    Object.assign(ISO, sv);
  }
  applyCam();
  drawIslandW(B, { T: 16, N: 6, mask: MASK, depth: DEPTH, cols: COL });
  crystalsW(B, t); vinesW(B, t);
  const H = heroAt(t);
  pondW(B, t); waterfallW(B, t);
  const items = [
    [0, () => stonesW(B, [[22, 62], [30, 58], [38, 56]], COL)],
    [36, () => treeW(B, 16, 20, 0, COL)],
    [50, () => mushW(B, [[26, 24, 0, 2], [30, 30, 0, 1], [20, 34, 0, 1]], COL)],
    [90, () => drawMailbox(B, 22, 68, 0, COL, t - 1.15)],
    [98, () => lanternW(B, 72, 26, 0, COL, t)],
    [138, () => planksW(B, 68, 70, 0, COL)],
    [140, () => { for (const [x, y] of [[94, 50], [94, 57], [94, 64]]) box(B, x, y, 0, 2, 2, 8, COL.postL, COL.post, COL.postD); const a = P(95, 51, 6), b = P(95, 65, 6); B.line(a[0], a[1], b[0], b[1], COL.postL); }],
    [H.x + H.y, () => { H.r = heroW(B, H.x, H.y, 0, H.st, HERO, COL.shadow); }],
  ];
  for (const [x, y, r] of TUFTS) items.push([x + y + 0.5, () => tuftsW(B, t, v => Math.abs(v - (x + y)) < 0.01)]);
  for (const [x, y] of FLOWERS) items.push([x + y + 0.4, () => flowersW(B, t, v => Math.abs(v - (x + y)) < 0.01)]);
  items.sort((a, b) => a[0] - b[0]); for (const [, f] of items) f();
  blanketW(B, t, H); dustPuff(B, t, 2.78, P(H.x, H.y, 0));
  const tc = P(16, 20, 26); fallingLeaf(B, t, tc); fireflyW(B, t, 6, tc[0] + 6, tc[1] + 6, 34, 1);
  const lp = P(73, 27, 23); mothsW(B, t, lp);
  // plane / note
  const pl = planeAt(t, H), ps = S(pl.ref);
  if (pl.mode !== 'note') {
    const m = S(MOON.q, MOON.par), inMoon = Math.hypot(ps[0] - m[0], ps[1] - m[1]) < MOON.r * (1 + (CAM.z - 1) * MOON.par) + 2;
    const cols = inMoon ? { light: COL.sil, mid: COL.sil, dark: COL.sil } : { light: COL.planeL, mid: COL.planeM, dark: COL.planeD };
    if (pl.mode === 'ground') drawPlane(B, { x: ps[0], y: ps[1], ang: pl.ang, landed: 1 }, cols, 1.35 * ISO.k); else planeW(B, ps[0], ps[1], pl.ang, pl.roll || 0, cols, 1.35 * ISO.k);
    if (t < 2.9) for (let q = 1; q < 26; q++) { const tt = Math.min(2.39, t) - q * 0.035; if (tt < 0) break; const life = 1 - q / 26; if (hash(q, Math.floor(tt * 40), 5) > life) continue; const a = S(catmull(PLANE_KEYS, tt)); const j = [Math.sin(q * 2.3) * 2, Math.cos(q * 1.7) * 2 + q * 0.3]; B.put(a[0] + j[0], a[1] + j[1], (q + Math.floor(t * 20)) % 3 ? COL.zz : COL.lampL); }
  } else {
    // unfolded note held in front of the creature
    const u = sm(4.3, 4.55, t), back = 1 - sm(7.3, 7.55, t), w = Math.round(lerp(5, 15, u) * ISO.k / 1.4), h = Math.round(lerp(3, 11, u) * ISO.k / 1.4);
    if (t < 4.62 || t > 7.28) { const x = Math.round(ps[0] - w / 2), y = Math.round(ps[1] - h); B.rect(x - 1, y - 1, w + 2, h + 2, COL.paperS); B.rect(x, y, w, h, COL.paper); for (let r = 2; r < h - 1; r += 2) B.rect(x + 2, y + r, Math.round(w * (r % 4 ? 0.7 : 0.5)), 1, COL.ink); B.line(x, y, x + w - 1, y + h - 1, COL.paperD); }
  }
  // Zzz while asleep
  if (t < 2.4) { const hd = H.r.head; for (let q = 0; q < 3; q++) { const ph = (t * 0.5 + q / 3) % 1; if (ph > 0.9) continue; const x = Math.round(hd[0] + 8 + ph * 18 + Math.sin(ph * 6 + q) * 2), y = Math.round(hd[1] - 10 - ph * 34), s = ph > 0.45 ? 2 : 1; glyph(B, 'z', x + 1, y + 1, COL.zzO, s); glyph(B, 'z', x, y, COL.zz, s); } }
  // startle marks at the bonk
  if (t > 2.4 && t < 2.85) { const hd = H.r.head, a = (t - 2.4) / 0.45; for (const [dx, dy] of [[-10, -12], [0, -16], [10, -12]]) { const L = Math.round(4 * Math.sin(a * Math.PI)); for (let s = 0; s < L; s++) B.put(hd[0] + dx * (1 + a * 0.4) + Math.sign(dx) * s * 0.5, hd[1] + dy * (1 + a * 0.4) - s, COL.zz); } }
  // the first thought starts to form (it will become a storm in chapter I)
  if (t > 9.0) { const hd = H.r.head, g = sm(9.0, 10.0, t), x = hd[0] + 10, y = hd[1] - 22 - g * 6, w = 18 + g * 22;
    B.circle(hd[0] + 5, hd[1] - 7, 1.5, COL.cloudL); if (g > 0.15) B.circle(hd[0] + 8, hd[1] - 13, 2.5, COL.cloudL);
    if (g > 0.3) { pixCloud(B, x + w * 0.3, y, w, { light: COL.cloudL, mid: COL.cloud, dark: COL.cloudD }, 7); const dots = Math.floor((t - 9.3) / 0.22) % 4; for (let q = 0; q < dots; q++) B.rect(Math.round(x + w * 0.3 - 6 + q * 5), Math.round(y - 2), 2, 2, COL.ink); } }
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
  vignette(F, 0.5, '8,5,14');
}

// ---------------- overlays: captions, chapter cards, the note ----------------
function fadeIO(t, a, b, f = 0.25) { return Math.min(sm(a, a + f, t), 1 - sm(b - f, b, t)); }
function caption(F, t, a, b, lines, y = 1150, px = 6, x = FW / 2) {
  const al = fadeIO(t, a, b); if (al <= 0) return; F.save(); F.globalAlpha = al;
  lines.forEach((L, i) => hiText(F, L, x, y + i * (px * 7 + px * 4) + Math.round((1 - al) * 10), px, i === 0 ? '#fff6ea' : '#f3e6cf', { align: 'c' }));
  F.restore();
}
function bug(F, t) {
  F.save(); F.globalAlpha = 0.7; hiText(F, 'FABLE 5.2 · A FIELD GUIDE', 44, 44, 3, '#f3e6cf', {}); F.restore();
  const ch = t < 9.1 ? 'PROLOGUE' : 'CHAPTER I · THE REQUEST', a = t < 9.1 ? fadeIO(t, 0.2, 9.1, 0.3) : sm(9.1, 9.4, t);
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
  const inn = sm(4.55, 5.0, t), out = sm(7.05, 7.35, t), s = inn * (1 - out); if (s <= 0.001) return;
  const src = SH(PREF(63, 64, 7)), cx = lerp(src[0], FW / 2, s), cy = lerp(src[1], 360, s);
  const over = s < 1 ? 1 + Math.sin(inn * Math.PI) * 0.04 : 1, sc = s * over * 0.86, W = 790, Hh = 520, rot = -0.035 + Math.sin(t * 0.7) * 0.006;
  F.save(); F.translate(cx, cy); F.rotate(rot); F.scale(sc, sc);
  // unfold: the paper opens from thirds (top and bottom flaps swing open)
  const uf = sm(4.6, 5.05, t) * (1 - sm(7.05, 7.3, t));
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
  const lines = ['BUILD ME', 'A BRIDGE', 'TO THE MOON.'], total = lines.join('').length, shown = Math.floor(clamp((t - 4.8) / 0.95, 0, 1) * total);
  let used = 0; lines.forEach((L, i) => { const vis = L.slice(0, Math.max(0, shown - used)); used += L.length; hiText(F, vis, -W / 2 + 64, -Hh / 2 + 74 + i * 100, 9, '#2a2350', { shadow: false, jitter: 1.4 }); });
  if (t > 5.85) { F.globalAlpha = sm(5.85, 6.15, t); hiText(F, '— THE HANDLER', W / 2 - 60 - textW('— THE HANDLER', 5), Hh / 2 - 70, 5, '#2a2350', { shadow: false });
    // a tiny drawn hand next to the signature
    F.fillStyle = '#2a2350'; const hx = W / 2 - 60 - textW('— THE HANDLER', 5) - 46, hy = Hh / 2 - 74; for (const [x, y, w, h] of [[0, 10, 22, 18], [0, 0, 4, 12], [6, -4, 4, 16], [12, -2, 4, 14], [18, 2, 4, 10], [-6, 14, 6, 4]]) F.fillRect(hx + x, hy + y, w, h); }
  F.restore();
}
