'use strict';
// ------------------------------------------------------------------
// RGB FIGHT PROTOTYPE (5 s): Fable 5.2 vs. its alter ego, in the Field Guide format.
// Low-res pixel bodies + hi-res neon light. Choreography runs on "action time" (a) so hits can freeze (hit-stop).
// ------------------------------------------------------------------
const DUR5 = 5.0;
const PAL = ['d97757', 'a8553b', 'f2a585', '6e2a1a', 'ffd9c2', '1b1426', 'fff6ea', 'ffffff', '000000',
  '2a1f45', '17112b', '41316a', '0b0814', 'ff3ab0', 'ff2a6d', '2af0ff', '00b3ff', '7cff4f', 'ffe14f', 'b04fff', '4f6bff', 'ff4f4f', 'ff8a3d',
  '2a1d3d', '1c1430', '120c22', '3c2a5c', '5a4080', '8a6ab0', 'c3b9e0', '8e82b8', '24152e', '0d0a1c', '141c36', '1e2a4a', '2c3a66', '3a2a70'];
const ALTER = { body: hex('2a1f45'), shade: hex('17112b'), light: hex('41316a'), dark: hex('0b0814'), hi: hex('ff3ab0'), eye: hex('ff2a6d'), white: hex('ffffff') };
const HEROC = Object.assign({}, HERO, { white: hex('fff6ea') });
const RGBC = [hex('ff4f4f'), hex('7cff4f'), hex('2af0ff')];
const MASK5 = (i, j) => Math.hypot(i - 2.5, j - 2.5) <= 3.0;
const DEPTH5 = (i, j) => Math.round(20 + 44 * Math.max(0, 1 - Math.hypot(i - 2.5, j - 2.5) / 3.6) + hash(i, j, 6) * 10);
const ICOL = { top: hex('141c36'), topL: hex('1e2a4a'), topD: hex('0d0a1c'), lipL: hex('ff3ab0'), lipR: hex('2af0ff'), lipD: hex('b04fff'), dirtL: hex('2a1d3d'), dirtR: hex('1c1430'),
  stone: hex('3c2a5c'), strata: hex('120c22'), root: hex('0b0814'), rim: hex('b04fff'), rim2: hex('5a4080') };
function hueCol(h, a = 1) { const k = ((h % 1) + 1) % 1, r = Math.round(150 + 105 * Math.cos(6.283 * k)), g = Math.round(110 + 110 * Math.cos(6.283 * (k - 1 / 3))), b = Math.round(150 + 105 * Math.cos(6.283 * (k - 2 / 3))); return `rgba(${r},${g},${b},${a})`; }
const lerp2 = (p, q, u) => [lerp(p[0], q[0], u), lerp(p[1], q[1], u)];
const eOut = u => 1 - Math.pow(1 - clamp(u, 0, 1), 3), eIn = u => Math.pow(clamp(u, 0, 1), 2.2);
const HX = p => [p[0] * SC, p[1] * SC];                 // low-res screen point -> hi-res

// ---------------- action time with hit-stop ----------------
const HITS = [[0.85, 0.06], [1.35, 0.1], [3.55, 0.14]];          // [action time, real freeze seconds]
function actionT(t) { let acc = 0; for (const [h, d] of HITS) { const rs = h + acc; if (t < rs) break; if (t < rs + d) return h; acc += d; } return t - acc; }
function realHit(i) { let acc = 0; for (let q = 0; q < i; q++) acc += HITS[q][1]; return HITS[i][0] + acc; }

// ---------------- the fighters ----------------
// face: 'x' = face on the +x side (looks down-right), 'y' = face on the +y side (looks down-left)
function fighter(B, hx, hy, hz, st, Cc, face) {
  const k = ISO.k, sq = st.squash || 0, bz = Math.round(13 * (1 - sq)), bx = Math.round(16 * (1 + sq * 0.5)), by = Math.round(14 * (1 + sq * 0.5));
  const hop = st.hop || 0, z0 = hz + 3 + hop, x0 = hx - bx / 2, y0 = hy - by / 2, x1 = x0 + bx, y1 = y0 + by, zt = z0 + bz, ch = 2;
  if (st.shadow !== false) { const sp = P(hx, hy, 0); const r = (11 - Math.min(6, hop * 0.3)) * k; B.ellipse(sp[0] + 1, sp[1] + 1, r, r * 0.45, hex('0b0814')); }
  for (const [lx, ly] of [[x0 + 1, y0 + 1], [x0 + bx - 4, y0 + 1], [x0 + 1, y0 + by - 4], [x0 + bx - 4, y0 + by - 4]]) box(B, lx, ly, hz + hop, 3, 3, 3, Cc.dark, Cc.shade, Cc.dark);
  B.poly([P(x0, y1, zt), P(x1 - ch, y1, zt), P(x1 - ch, y1, z0), P(x0, y1, z0)], Cc.body);
  B.poly([P(x1, y0, zt), P(x1, y1 - ch, zt), P(x1, y1 - ch, z0), P(x1, y0, z0)], Cc.shade);
  B.poly([P(x1 - ch, y1, zt), P(x1, y1 - ch, zt), P(x1, y1 - ch, z0), P(x1 - ch, y1, z0)], mix(Cc.body, Cc.shade, 0.5));
  B.poly([P(x0, y1, z0 + bz * 0.28), P(x1 - ch, y1, z0 + bz * 0.28), P(x1 - ch, y1, z0), P(x0, y1, z0)], mix(Cc.body, Cc.shade, 0.35));
  B.poly([P(x1, y0, z0 + bz * 0.28), P(x1, y1 - ch, z0 + bz * 0.28), P(x1, y1 - ch, z0), P(x1, y0, z0)], mix(Cc.shade, Cc.dark, 0.25));
  B.poly([P(x0 + 1, y0, zt), P(x1, y0, zt), P(x1, y1 - ch, zt), P(x1 - ch, y1, zt), P(x0, y1, zt), P(x0, y0 + 1, zt)], Cc.light);
  { const a = P(x0 + 1, y1, zt), b = P(x1 - ch, y1, zt), c = P(x1, y1 - ch, zt), d = P(x1, y0, zt); B.line(a[0], a[1], b[0], b[1] - 1, Cc.hi); B.line(c[0], c[1], d[0], d[1], mix(Cc.hi, Cc.shade, 0.4)); }
  { const r1 = P(x0 + 1, y0, zt), r2 = P(x1, y0, zt), r3 = P(x0, y0 + 1, zt), r4 = P(x0, y1, zt); B.line(r1[0], r1[1], r2[0], r2[1], Cc.hi); B.line(r3[0], r3[1], r4[0], r4[1], Cc.hi); }
  // arm nub on the side away from the face, raises with st.arm
  const az = z0 + Math.round(bz * 0.35) + Math.round((st.arm || 0) * 6);
  if (face === 'x') box(B, x0 + bx * 0.45, y1, az, 4, 3, 4, Cc.light, Cc.body, Cc.shade); else box(B, x1, y0 + by * 0.4, az, 3, 4, 4, Cc.light, Cc.body, Cc.shade);
  const fk = Math.max(1, k / 1.4), G = Math.max(1, Math.round(fk)), EW = Math.max(3, Math.round(3 * fk)), EH = Math.max(5, Math.round(5 * fk)), ez = z0 + Math.round(bz * 0.58);
  const eyePts = face === 'x' ? [P(x1, y0 + 3.5, ez), P(x1, y0 + 9.5, ez)] : [P(x0 + 3.5, y1, ez), P(x0 + 9.5, y1, ez)];
  const lk = st.look || [0, 0], eyes = [];
  eyePts.forEach((e, idx) => {
    const ex = Math.round(e[0] + lk[0] * fk), ey = Math.round(e[1] - G + lk[1] * fk); eyes.push([ex, ey]);
    if (st.eyes === 'x') { for (let q = -1; q <= 1; q++) { B.rect(ex + q * G, ey + q * G, G, G, Cc.eye); B.rect(ex + q * G, ey - q * G, G, G, Cc.eye); } return; }
    if (st.eyes === 'closed') { B.rect(ex - Math.round(EW / 2) - G, ey, EW + 2 * G, G, Cc.eye); B.rect(ex - Math.round(EW / 2) - 2 * G, ey - G, G, G, Cc.eye); B.rect(ex + Math.round(EW / 2) + G, ey - G, G, G, Cc.eye); return; }
    const fierce = st.eyes === 'fierce', w = EW, h = fierce ? Math.max(3, EH - G) : EH, x = ex - Math.round(w / 2), y = ey - Math.round(h / 2) + (fierce ? G : 0);
    B.rect(x, y, w, h, Cc.eye); B.rect(x, y, G, G, Cc.white);
    if (fierce) {   // slanted brow, low at the inner end (between the eyes)
      const inner = idx === 1; for (let q = -G; q < w + G; q++) { const f = (q + G) / (w + 2 * G), dy = Math.round((inner ? 1 - f : f) * G * 1.6); B.rect(x + q, y - 2 * G + dy, 1, G, Cc.dark); }
    }
  });
  const mp = face === 'x' ? P(x1, y0 + 6.5, ez - 4.5) : P(x0 + 6.5, y1, ez - 4.5), mx = Math.round(mp[0] + lk[0] * fk * 0.5), my = Math.round(mp[1] + lk[1] * fk * 0.5);
  if (st.mouth === 'grit') { B.rect(mx - 2 * G, my, 5 * G, 2 * G, Cc.dark); B.rect(mx - G, my, G, G, Cc.white); B.rect(mx + G, my, G, G, Cc.white); }
  else if (st.mouth === 'o') B.rect(mx - G, my, 3 * G, 3 * G, Cc.dark);
  else if (st.mouth === 'smirk') { B.rect(mx - G, my + G, 3 * G, G, Cc.dark); B.rect(mx + 2 * G, my, G, G, Cc.dark); }
  else if (st.mouth === 'smile') { B.rect(mx - G, my + G, 3 * G, G, Cc.dark); B.rect(mx - 2 * G, my, G, G, Cc.dark); B.rect(mx + 2 * G, my, G, G, Cc.dark); }
  else B.rect(mx - G, my + G, 3 * G, G, Cc.dark);
  return { head: P(hx, hy, zt), center: P(hx, hy, z0 + bz / 2), eyes };
}
// draw a fighter into a scratch buffer, then composite: optional RGB fringe, glitch-tear rows, solid tint, ghost (checker) transparency
function fighterFX(B, hx, hy, hz, st, Cc, face, o = {}) {
  const Tb = new PBuf(PAL, 0); const r = fighter(Tb, hx, hy, hz, st, Cc, face), d = Tb.d, out = B.d, f = Math.round(o.fringe || 0), tear = o.tear || 0, seed = o.seed || 0;
  const shiftOf = y => tear > 0 && hash(y >> 2, seed, 3) < tear * 0.45 ? Math.round((hash(y >> 2, seed + 1, 7) - 0.5) * 22 * tear) : 0;
  if (f) for (let y = 0; y < LH; y++) { const sh = shiftOf(y); for (let x = 0; x < LW; x++) { const i = (y * LW + x) * 4; if (!d[i + 3]) continue;
    for (const [dx, c] of [[-f, RGBC[0]], [f, RGBC[2]]]) { const x2 = x + sh + dx; if (x2 < 0 || x2 >= LW) continue; const j = (y * LW + x2) * 4; out[j] = Math.max(out[j] * 0.4, c[0] * 0.85); out[j + 1] = out[j + 1] * 0.4 + c[1] * 0.25; out[j + 2] = Math.max(out[j + 2] * 0.4, c[2] * 0.85); out[j + 3] = 255; } } }
  for (let y = 0; y < LH; y++) { const sh = shiftOf(y); for (let x = 0; x < LW; x++) { const i = (y * LW + x) * 4; if (!d[i + 3]) continue; const xx = x + sh; if (xx < 0 || xx >= LW) continue;
    if (o.ghost && ((xx + y) & 1)) continue; const j = (y * LW + xx) * 4; let c0 = d[i], c1 = d[i + 1], c2 = d[i + 2];
    if (o.tint) { const m = o.tintK || 0.6; c0 = c0 * (1 - m) + o.tint[0] * m; c1 = c1 * (1 - m) + o.tint[1] * m; c2 = c2 * (1 - m) + o.tint[2] * m; }
    out[j] = c0; out[j + 1] = c1; out[j + 2] = c2; out[j + 3] = 255; } }
  return r;
}

// ---------------- choreography (action time a) ----------------
const H0 = [34, 62], A0 = [68, 30], CEN = [51, 46], AK = [76, 23];
const DIRV = [0.728, -0.685], C1 = [H0[0] + 15 * DIRV[0], H0[1] + 15 * DIRV[1]], B1 = [H0[0] - 5 * DIRV[0], H0[1] - 5 * DIRV[1]], A1 = [62, 36];
const HITPT = [[(H0[0] + C1[0]) / 2 + 1, (H0[1] + C1[1]) / 2 - 1, 9], [(CEN[0] + A1[0]) / 2, (CEN[1] + A1[1]) / 2, 9], [CEN[0], CEN[1], 6]];
function heroAt(a) {
  const st = { eyes: 'fierce', look: [1, -1], mouth: 'flat', arm: 0.3, hop: 0, squash: 0.06 + 0.04 * Math.sin(a * 10) }; let p = H0;
  if (a < 0.85) { st.arm = 0.3 + 0.2 * sm(0.3, 0.55, a); }
  else if (a < 1.0) { const u = (a - 0.85) / 0.15; p = lerp2(H0, B1, eOut(u)); st.arm = 1; st.squash = 0.22 * (1 - u); st.mouth = 'grit'; st.eyes = u < 0.5 ? 'closed' : 'fierce'; }
  else if (a < 1.15) { const u = (a - 1.0) / 0.15; p = B1; st.squash = 0.24 * sm(0, 1, u); st.arm = 0.1; st.mouth = 'grit'; }
  else if (a < 1.35) { const u = (a - 1.15) / 0.2; p = lerp2(B1, CEN, eIn(u)); st.hop = Math.sin(u * Math.PI) * 5; st.squash = -0.22; st.arm = 1; st.mouth = 'grit'; }
  else if (a < 1.8) { const u = (a - 1.35) / 0.45; p = CEN; st.arm = 1 - 0.6 * u; st.squash = 0.16 * Math.sin(Math.min(1, u * 2) * Math.PI); st.mouth = 'grit'; }
  else if (a < 2.45) { p = CEN; st.mouth = a < 2.15 ? 'flat' : 'o'; st.look = a < 2.15 ? [1, -1] : [2, -1]; }
  else if (a < 3.3) { p = CEN; const w = (a - 2.45) * 7.5; st.look = [Math.round(Math.sin(w) * 2), Math.round(-Math.abs(Math.cos(w)))]; st.squash = 0.06 + 0.16 * sm(2.9, 3.3, a); st.mouth = a > 2.9 ? 'grit' : 'flat'; }
  else if (a < 3.55) { p = CEN; st.squash = 0.22; st.eyes = 'closed'; st.mouth = 'grit'; }
  else if (a < 4.0) { p = CEN; const u = (a - 3.55) / 0.45; st.hop = Math.sin(u * Math.PI) * 16; st.squash = u < 0.15 ? -0.22 : -0.08; st.arm = 1; st.mouth = 'o'; }
  else { p = CEN; const u = clamp((a - 4.0) / 0.22, 0, 1); st.squash = 0.2 * Math.sin(u * Math.PI); st.arm = 1; st.mouth = 'smile'; st.look = [1, 0]; }
  return { x: p[0], y: p[1], st };
}
function alterAt(a) {
  const st = { eyes: 'fierce', look: [-1, -1], mouth: 'smirk', arm: 0.3, hop: 0, squash: 0.06 + 0.04 * Math.sin(a * 10 + 2) }; let p = A0, tear = 0, show = true;
  if (a < 0.55) { tear = hash(Math.floor(a * 14), 2, 2) > 0.8 ? 0.25 : 0; }
  else if (a < 0.85) { const u = (a - 0.55) / 0.3; p = lerp2(A0, C1, eIn(u)); st.squash = -0.22; st.arm = 1; st.mouth = 'grit'; }
  else if (a < 1.2) { const u = (a - 0.85) / 0.35; p = lerp2(C1, A1, eOut(u)); st.hop = Math.sin(u * Math.PI) * 7; st.squash = u > 0.85 ? 0.15 : -0.05; }
  else if (a < 1.35) { p = A1; st.mouth = 'o'; st.look = [-2, 0]; }
  else if (a < 1.8) { const u = (a - 1.35) / 0.45; p = lerp2(A1, AK, eOut(u)); st.hop = Math.sin(u * Math.PI) * 6; st.squash = u < 0.25 ? 0.28 : 0.06; st.eyes = u < 0.6 ? 'closed' : 'fierce'; st.mouth = 'o'; tear = 1 - u * 0.8; }
  else if (a < 2.15) { p = AK; st.mouth = 'grit'; st.squash = 0.1 * Math.sin((a - 1.8) * 30); tear = 0.25 + 0.6 * sm(1.95, 2.15, a); }
  else if (a < 4.12) { show = false; }
  else { const u = clamp((a - 4.12) / 0.3, 0, 1); p = AK; st.squash = 0.3 - 0.18 * u + 0.04 * Math.sin(a * 18); st.eyes = 'x'; st.mouth = 'o'; st.look = [0, 0]; tear = (1 - u) * 0.9 + (hash(Math.floor(a * 12), 4, 4) > 0.7 ? 0.35 : 0); }
  return { x: p[0], y: p[1], st, tear, show };
}
// the three RGB copies: split off, ring the hero, circle, dash in together, get flung out, snap back together
function copiesAt(a) {
  const out = []; if (a < 2.12 || a >= 4.12) return out;
  for (let k = 0; k < 3; k++) {
    const th = -0.5 + k * 2.094 + 1.4 * sm(2.5, 3.3, a); let R = 28, hop = 0, tear = 0, x, y, dash = false;
    const ring = [CEN[0] + Math.cos(th) * R, CEN[1] + Math.sin(th) * R];
    if (a < 2.5) { const u = eOut((a - 2.12) / 0.38); [x, y] = lerp2(AK, ring, u); hop = Math.sin(u * Math.PI) * 6; tear = 0.6 * (1 - u); }
    else if (a < 3.3) { [x, y] = ring; hop = Math.max(0, Math.sin((a - 2.5) * 16 + k * 2)) * 1.5; }
    else if (a < 3.55) { R = lerp(28, 12, eIn((a - 3.3) / 0.25)); x = CEN[0] + Math.cos(th) * R; y = CEN[1] + Math.sin(th) * R; dash = true; }
    else if (a < 3.86) { const u = (a - 3.55) / 0.31; R = lerp(12, 46, eOut(u)); x = CEN[0] + Math.cos(th) * R; y = CEN[1] + Math.sin(th) * R; hop = Math.sin(u * Math.PI) * 16; tear = 0.8 * (1 - u) + 0.2; }
    else { const u = (a - 3.86) / 0.26, s = [CEN[0] + Math.cos(th) * 46, CEN[1] + Math.sin(th) * 46]; [x, y] = lerp2(s, AK, eIn(u)); hop = Math.sin(u * Math.PI) * 10; tear = 0.5; }
    out.push({ x, y, hop, tear, k, dash, th });
  }
  return out;
}
const CAM5 = [[0, 188, 240, 1.5], [0.55, 186, 240, 1.56], [0.85, 172, 246, 1.95], [1.15, 180, 242, 1.65], [1.35, 196, 242, 2.0], [1.8, 200, 240, 1.7], [2.15, 204, 240, 1.62], [2.5, 190, 242, 1.45], [3.3, 188, 244, 1.62], [3.55, 188, 244, 1.95], [3.95, 194, 240, 1.48], [4.86, 196, 240, 1.52]];

// ---------------- low-res world ----------------
let RIP = [];   // floor ripples [a0, x, y, colour index]
function arenaTop(a, T) {
  const base = ICOL.top, baseL = ICOL.topL, line = hex('2c3a66'), lineB = hex('3a2a70');
  return (x, y) => {
    const n = fbm(x * 0.06, y * 0.06, 3, 3); let c = n > 0.55 ? baseL : n < 0.38 ? ICOL.topD : base;
    const gx = ((x % 8) + 8) % 8, gy = ((y % 8) + 8) % 8, on = gx < 0.55 || gy < 0.55;
    if (on) c = (Math.floor(x / 8) + Math.floor(y / 8)) & 1 ? line : lineB;
    const sweep = ((x + y - T * 60) % 140 + 140) % 140; if (on && sweep < 7) c = sweep < 3 ? hex('ff3ab0') : hex('b04fff');
    for (const [a0, rx, ry, ci] of RIP) { const dt = a - a0; if (dt < 0 || dt > 0.7) continue; const d = Math.hypot(x - rx, y - ry), r = dt * 120, w = Math.max(0, 1 - Math.abs(d - r) / 6) * (1 - dt / 0.7);
      if (w > 0.15 && on) c = RGBC[ci]; else if (w > 0.55) c = mix(c, RGBC[ci], 0.45); }
    return [...c, 6];
  };
}
function sparksW(B, at, a0, a, seed, n = 18) {
  const u = (a - a0) / 0.32; if (u < 0 || u > 1) return; const k = ISO.k / 1.4;
  for (let q = 0; q < n; q++) { const ang = hash(q, seed, 1) * 6.283, sp = (14 + hash(q, seed, 2) * 30) * k, r0 = sp * eOut(u) * 0.55, r1 = sp * eOut(u), col = u < 0.3 ? hex('ffffff') : [hex('ffe14f'), hex('2af0ff'), hex('ff3ab0')][q % 3];
    B.line(at[0] + Math.cos(ang) * r0, at[1] + Math.sin(ang) * r0 * 0.7, at[0] + Math.cos(ang) * r1, at[1] + Math.sin(ang) * r1 * 0.7 + u * u * 6 * k, col); }
}
function motesW(B, H, a) {   // coral power motes rising around the charging hero
  const pw = sm(2.85, 3.5, a) * (1 - sm(3.6, 3.9, a)); if (pw <= 0) return;
  for (let q = 0; q < 26; q++) { if (hash(q, 3, 3) > pw) continue; const ph = ((a * (0.9 + hash(q, 1, 1)) + hash(q, 2, 2)) % 1), ang = hash(q, 4, 4) * 6.283, r = 9 + hash(q, 5, 5) * 5;
    const p = P(H.x + Math.cos(ang) * r, H.y + Math.sin(ang) * r, ph * 30); B.put(p[0], p[1], ph < 0.5 ? hex('ffd9c2') : hex('d97757')); if (ph < 0.3) B.put(p[0], p[1] - 1, hex('f2a585')); }
}
const faceTo = (x, y) => x - y > CEN[0] - CEN[1] ? 'y' : 'x';
function drawArena(B, a, T) {
  drawIslandW(B, { T: 16, N: 6, mask: MASK5, depth: DEPTH5, cols: ICOL, topFn: arenaTop(a, T) });
  const items = [], H = heroAt(a), A = alterAt(a), cps = copiesAt(a);
  // afterimages (drawn first, behind the fighters)
  const ghosts = [];
  if (a > 0.6 && a < 0.95) for (let g = 3; g >= 1; g--) { const ga = a - g * 0.035; if (ga < 0.55) continue; const s = alterAt(ga); ghosts.push([s.x, s.y, s.st, ALTER, 'y', { ghost: true, tint: RGBC[g - 1], tintK: 0.75 }]); }
  if (a > 1.17 && a < 1.45) for (let g = 3; g >= 1; g--) { const ga = a - g * 0.035; if (ga < 1.15) continue; const s = heroAt(ga); ghosts.push([s.x, s.y, s.st, HEROC, 'x', { ghost: true, tint: g === 1 ? hex('ffd9c2') : hex('d97757'), tintK: 0.6 }]); }
  for (const c of cps) if (c.dash) for (let g = 2; g >= 1; g--) { const pc = copiesAt(a - g * 0.04).find(q => q.k === c.k); if (pc) ghosts.push([pc.x, pc.y, { eyes: 'fierce', mouth: 'grit', hop: pc.hop, squash: -0.2, shadow: false }, ALTER, faceTo(pc.x, pc.y), { ghost: true, tint: RGBC[c.k], tintK: 0.85 }]); }
  for (const g of ghosts) fighterFX(B, g[0], g[1], 0, g[2], g[3], g[4], g[5]);
  items.push({ d: H.x + H.y, f: () => { H.r = fighterFX(B, H.x, H.y, 0, H.st, HEROC, 'x', {}); } });
  if (A.show) items.push({ d: A.x + A.y, f: () => { A.r = fighterFX(B, A.x, A.y, 0, A.st, ALTER, 'y', { fringe: 1 + Math.round(A.tear * 2), tear: A.tear, seed: Math.floor(a * 30) }); } });
  for (const c of cps) items.push({ d: c.x + c.y, f: () => { c.r = fighterFX(B, c.x, c.y, 0, { eyes: 'fierce', mouth: a > 3.55 ? 'o' : 'smirk', hop: c.hop, squash: c.dash ? -0.2 : 0.05 * Math.sin(a * 12 + c.k), look: [0, 0] }, ALTER, faceTo(c.x, c.y), { tint: RGBC[c.k], tintK: 0.55, tear: c.tear, seed: Math.floor(a * 30) + c.k * 7 }); } });
  items.sort((p, q) => p.d - q.d).forEach(it => it.f());
  motesW(B, H, a);
  HITS.forEach(([h], i) => sparksW(B, P(...HITPT[i]), h, a, i * 13 + 1, i === 2 ? 30 : 18));
  return { H, A, cps };
}

// ---------------- hi-res: sky, neon, effects ----------------
function skyGrid(F, T, a) {
  let g = F.createLinearGradient(0, 0, 0, FH); g.addColorStop(0, '#05030f'); g.addColorStop(0.35, '#120a2e'); g.addColorStop(0.62, '#2a0f45'); g.addColorStop(0.72, '#3d1250'); g.addColorStop(1, '#0a0618'); F.fillStyle = g; F.fillRect(0, 0, FW, FH);
  const R = mulberry(9); for (let q = 0; q < 120; q++) { const s = S([R() * 400 - 20, R() * 300 - 20], 0.12), tw = 0.3 + 0.7 * Math.pow(0.5 + 0.5 * Math.sin(T * (1.5 + R() * 3) + q), 2); F.fillStyle = `rgba(230,220,255,${tw * 0.7})`; F.fillRect(Math.round(s[0] * SC / 3) * 3, Math.round(s[1] * SC / 3) * 3, 3, 3); }
  // the neon ring (replaces the moon): a rotating RGB conic stroke with bloom, synthwave bands inside
  const c = HX(S([188, 118], 0.22)), r = 250 * (1 + (CAM.z - 1.5) * 0.2), rot = T * 1.3;
  F.save(); F.globalCompositeOperation = 'lighter';
  g = F.createRadialGradient(c[0], c[1], r * 0.2, c[0], c[1], r * 1.9); g.addColorStop(0, 'rgba(255,60,170,0.10)'); g.addColorStop(0.55, 'rgba(120,60,255,0.10)'); g.addColorStop(1, 'rgba(0,0,0,0)'); F.fillStyle = g; F.fillRect(0, 0, FW, FH);
  F.beginPath(); F.arc(c[0], c[1], r * 0.94, 0, 7); F.clip();
  for (let q = 0; q < 9; q++) { const y = c[1] + r * (0.05 + q * 0.11) + ((T * 30) % (r * 0.11)), h = 6 + q * 2.4; const gg = F.createLinearGradient(0, c[1] - r, 0, c[1] + r); gg.addColorStop(0, 'rgba(255,90,170,0.0)'); gg.addColorStop(1, 'rgba(255,90,170,0.22)'); F.fillStyle = gg; F.fillRect(c[0] - r, y, 2 * r, h); }
  F.restore();
  for (const [lw, blur, al] of [[34, 30, 0.55], [14, 8, 0.8], [5, 0, 1]]) {
    F.save(); F.globalCompositeOperation = 'lighter'; if (blur) F.filter = `blur(${blur}px)`; const cg = F.createConicGradient(rot, c[0], c[1]);
    for (let q = 0; q <= 6; q++) cg.addColorStop(q / 6, hueCol(q / 6, al)); F.strokeStyle = cg; F.lineWidth = lw; F.beginPath(); F.arc(c[0], c[1], r, 0, 7); F.stroke(); F.restore();
  }
  // distant low-poly mountains + the synthwave floor far below
  const hz = HX(S([0, 296], 0.18))[1];
  for (const [seed, hh, col, par] of [[4, 150, '#1d0c36', 0.1], [7, 95, '#2a0f45', 0.16]]) {
    F.fillStyle = col; F.beginPath(); F.moveTo(0, hz + 4); const off = (CAM.cx - 188) * par * 9;
    for (let x = -60; x <= FW + 60; x += 60) { const n = hash(Math.floor((x + off) / 60) + 50, seed, seed); F.lineTo(x - (off % 60), hz - n * hh); } F.lineTo(FW, hz + 4); F.closePath(); F.fill();
  }
  F.save(); F.globalCompositeOperation = 'lighter'; F.strokeStyle = 'rgba(255,58,176,0.75)'; F.lineWidth = 3; F.beginPath(); F.moveTo(0, hz); F.lineTo(FW, hz); F.stroke();
  const vx = FW / 2 + (188 - CAM.cx) * 2;
  for (let q = -14; q <= 14; q++) { F.strokeStyle = 'rgba(255,58,176,0.45)'; F.lineWidth = 2; F.beginPath(); F.moveTo(vx + q * 14, hz); F.lineTo(vx + q * 230, FH + 40); F.stroke(); }
  for (let q = 0; q < 14; q++) { const z = 14 - ((q + T * 2.2) % 14), y = hz + 260 / z * 1.6; if (y > FH) continue; F.strokeStyle = `rgba(255,58,176,${clamp(0.75 - z * 0.04, 0.1, 0.8)})`; F.lineWidth = Math.max(1.5, 4 - z * 0.2); F.beginPath(); F.moveTo(0, y); F.lineTo(FW, y); F.stroke(); }
  g = F.createLinearGradient(0, hz - 80, 0, hz + 140); g.addColorStop(0, 'rgba(255,70,170,0)'); g.addColorStop(0.45, 'rgba(255,70,170,0.22)'); g.addColorStop(1, 'rgba(255,70,170,0)'); F.fillStyle = g; F.fillRect(0, hz - 80, FW, 220);
  F.restore();
}
// glowing outline of the island deck, its colour flowing around the rim
let EDGES = null;
function neonEdges(F, T, a) {
  if (!EDGES) { EDGES = []; const has = (i, j) => i >= 0 && j >= 0 && i < 6 && j < 6 && MASK5(i, j);
    for (let i = 0; i < 6; i++) for (let j = 0; j < 6; j++) if (has(i, j)) { const x0 = i * 16, y0 = j * 16, x1 = x0 + 16, y1 = y0 + 16;
      if (!has(i, j + 1)) EDGES.push([x0, y1, x1, y1, 1]); if (!has(i + 1, j)) EDGES.push([x1, y0, x1, y1, 1]); if (!has(i, j - 1)) EDGES.push([x0, y0, x1, y0, 0]); if (!has(i - 1, j)) EDGES.push([x0, y0, x0, y1, 0]); } }
  const pulse = HITS.reduce((m, [h]) => Math.max(m, Math.max(0, 1 - Math.abs(a - h - 0.04) / 0.25)), 0);
  for (const [lw, blur, al] of [[16, 14, 0.45 + pulse * 0.4], [4, 0, 0.95]]) {
    F.save(); F.globalCompositeOperation = 'lighter'; if (blur) F.filter = `blur(${blur}px)`; F.lineWidth = lw; F.lineCap = 'round';
    for (const [xa, ya, xb, yb, front] of EDGES) { const m = Math.atan2((ya + yb) / 2 - 48, (xa + xb) / 2 - 48) / 6.283; F.strokeStyle = hueCol(m + T * 0.35, al * (front ? 1 : 0.6)); const p = HX(P(xa, ya, 0)), q = HX(P(xb, yb, 0)); F.beginPath(); F.moveTo(p[0], p[1]); F.lineTo(q[0], q[1]); F.stroke(); }
    F.restore();
  }
}
function shockRing(F, wx, wy, a0, a, col, maxR, off = 0, life = 0.45) {
  const u = (a - a0) / life; if (u < 0 || u > 1) return; const R = maxR * eOut(u), c = HX(P(wx, wy, 0)), rx = R * ISO.k * 1.414 * SC, ry = R * ISO.k * 0.707 * SC;
  F.save(); F.globalCompositeOperation = 'lighter';
  for (const [lw, blur, al] of [[22 * (1 - u) + 6, 10, 0.5], [6 * (1 - u) + 2, 0, 1]]) { F.filter = blur ? `blur(${blur}px)` : 'none'; F.strokeStyle = `rgba(${col[0]},${col[1]},${col[2]},${al * (1 - u)})`; F.lineWidth = lw; F.beginPath(); F.ellipse(c[0] + off, c[1], rx, ry, 0, 0, 7); F.stroke(); }
  F.restore();
}
function speedLines(F, from, dir, amt, seed, col = [255, 255, 255]) {
  if (amt <= 0) return; const sd = [dir[0] - dir[1], (dir[0] + dir[1]) / 2], L = Math.hypot(...sd), ux = sd[0] / L, uy = sd[1] / L, c = HX(from);
  F.save(); F.globalCompositeOperation = 'lighter';
  for (let q = 0; q < 14; q++) { const o = (hash(q, seed, 1) - 0.5) * 150, len = 80 + hash(q, seed, 2) * 220, st = 40 + hash(q, seed, 3) * 60, x0 = c[0] - ux * st - uy * o, y0 = c[1] - uy * st + ux * o * 0.6 - 30;
    const cc = q % 3 === 0 ? RGBC[0] : q % 3 === 1 ? col : RGBC[2]; F.strokeStyle = `rgba(${cc[0]},${cc[1]},${cc[2]},${0.55 * amt})`; F.lineWidth = 3 + (q % 2) * 3; F.beginPath(); F.moveTo(x0, y0); F.lineTo(x0 - ux * len * amt, y0 - uy * len * amt); F.stroke(); }
  F.restore();
}
function glowAt(F, p, r, rgba) { const c = HX(p), g = F.createRadialGradient(c[0], c[1], 0, c[0], c[1], r); g.addColorStop(0, rgba); g.addColorStop(1, 'rgba(0,0,0,0)'); F.save(); F.globalCompositeOperation = 'lighter'; F.fillStyle = g; F.fillRect(c[0] - r, c[1] - r, 2 * r, 2 * r); F.restore(); }
function chromaShift(F, amt) {
  if (amt < 0.6) return; const dx = Math.round(amt), id = F.getImageData(0, 0, FW, FH), s = new Uint8ClampedArray(id.data), d = id.data;
  for (let y = 0; y < FH; y++) { const row = y * FW * 4; for (let x = 0; x < FW; x++) { const i = row + x * 4, xr = Math.min(FW - 1, x + dx), xb = Math.max(0, x - dx); d[i] = s[row + xr * 4]; d[i + 2] = s[row + xb * 4 + 2]; } }
  F.putImageData(id, 0, 0);
}
function glitchBands(F, amt, seed) {
  if (amt <= 0.05) return; const cv = F.canvas;
  for (let q = 0; q < 7; q++) { if (hash(q, seed, 1) > amt) continue; const y = Math.floor(hash(q, seed, 2) * FH / 3) * 3, h = 9 + Math.floor(hash(q, seed, 3) * 14) * 3, dx = Math.round((hash(q, seed, 4) - 0.5) * 120 * amt / 3) * 3; F.drawImage(cv, 0, y, FW, h, dx, y, FW, h); }
}
function scanlines(F) { F.fillStyle = 'rgba(0,0,0,0.13)'; for (let y = 2; y < FH; y += 3) F.fillRect(0, y, FW, 1); }
function bloom(F, k) { F.save(); F.globalCompositeOperation = 'screen'; F.globalAlpha = k; F.filter = 'blur(16px) brightness(1.1)'; F.drawImage(F.canvas, 0, 0); F.restore(); }
function rgbText(F, str, x, y, px, col, split, al = 1) {
  F.save(); F.globalAlpha = al; hiText(F, str, x, y, px, 'rgba(0,0,0,0)', { align: 'c', shadowCol: 'rgba(6,2,16,0.85)' }); F.globalCompositeOperation = 'lighter';
  hiText(F, str, x - split, y, px, 'rgba(255,60,90,0.9)', { align: 'c', shadow: false }); hiText(F, str, x + split, y, px, 'rgba(40,220,255,0.9)', { align: 'c', shadow: false }); F.globalCompositeOperation = 'source-over';
  hiText(F, str, x, y, px, col, { align: 'c', shadow: false }); F.restore();
}
function fadeIO(t, a, b, f = 0.25) { return Math.min(sm(a, a + f, t), 1 - sm(b - f, b, t)); }
function caption(F, t, a, b, lines, y = 1150, px = 8, x = FW / 2) {
  const al = fadeIO(t, a, b); if (al <= 0) return; F.save(); F.globalAlpha = al; const lh = px * 11, bot = y + lines.length * lh;
  const g = F.createLinearGradient(0, y - 120, 0, bot + 120); g.addColorStop(0, 'rgba(6,4,12,0)'); g.addColorStop(0.35, 'rgba(6,4,12,0.6)'); g.addColorStop(0.75, 'rgba(6,4,12,0.6)'); g.addColorStop(1, 'rgba(6,4,12,0)'); F.fillStyle = g; F.fillRect(0, y - 120, FW, bot - y + 240);
  lines.forEach((L, i) => hiText(F, L, x, y + i * lh + Math.round((1 - al) * 12), px, i === 0 ? '#fff6ea' : '#f3e6cf', { align: 'c' })); F.restore();
}
function cornerBug(F, t) {
  const k = 1 - sm(3.8, 4.1, t); F.save(); F.globalAlpha = 0.7 * k; hiText(F, 'FABLE 5.2 · FIGHT FILE', 44, 44, 3, '#f3e6cf', {}); F.globalAlpha = 0.6 * k; hiText(F, 'ROUND 1 · THE ALTER EGO', 44, 70, 3, '#ff3ab0', {}); F.restore();
}
function roundSlam(F, t) {
  if (t > 0.8) return; const inn = sm(0.04, 0.16, t), al = inn * (1 - sm(0.6, 0.78, t)), s = lerp(2.4, 1, eOut((t - 0.04) / 0.14)), sp = 4 + 18 * (1 - sm(0.12, 0.35, t));
  F.save(); F.translate(FW / 2, 360); F.scale(s, s); F.translate(-FW / 2, -360); rgbText(F, 'ROUND 1', FW / 2, 330, 14, '#fff6ea', sp, al); F.restore();
  if (t > 0.1 && t < 0.3) { F.save(); F.globalCompositeOperation = 'lighter'; F.fillStyle = `rgba(255,255,255,${0.18 * (1 - (t - 0.1) / 0.2)})`; F.fillRect(0, 0, FW, FH); F.restore(); }
}
function endTitle(F, t) {
  const al = sm(3.95, 4.3, t); if (al <= 0) return; const sp = 3 + 14 * (1 - sm(4.0, 4.5, t)) + (hash(Math.floor(t * 20), 1, 1) > 0.85 ? 8 : 0), y0 = 150 - (1 - eOut((t - 3.95) / 0.4)) * 30;
  const g = F.createLinearGradient(0, y0 - 90, 0, y0 + 330); g.addColorStop(0, 'rgba(6,3,16,0)'); g.addColorStop(0.3, `rgba(6,3,16,${0.55 * al})`); g.addColorStop(0.7, `rgba(6,3,16,${0.55 * al})`); g.addColorStop(1, 'rgba(6,3,16,0)'); F.fillStyle = g; F.fillRect(0, y0 - 90, FW, 420);
  rgbText(F, 'FABLE 5.2', FW / 2, y0, 13, '#fff6ea', sp, al); rgbText(F, 'VS.', FW / 2, y0 + 118, 6, '#ff3ab0', sp * 0.5, al * sm(4.1, 4.3, t)); rgbText(F, 'ITS ALTER EGO', FW / 2, y0 + 178, 9, '#fff6ea', sp, al * sm(4.2, 4.45, t));
}

// ---------------- the frame ----------------
function renderFight(F, low, T) {
  const a = actionT(T), hitR = HITS.map((_, i) => realHit(i));
  RIP = HITS.map(([h], i) => [h, HITPT[i][0], HITPT[i][1], i === 0 ? 0 : i === 1 ? 2 : 1]);
  const k = keyedSmooth(CAM5, a), shake = HITS.reduce((m, [h], i) => { const d = a - h; return d >= 0 && d < 0.3 ? m + (1 - d / 0.3) * [2.2, 3.2, 4.5][i] : m; }, 0);
  CAM.cx = k[0] + Math.sin(T * 61) * shake + Math.sin(T * 0.8) * 0.6; CAM.cy = k[1] + Math.cos(T * 47) * shake * 0.6 + Math.sin(T * 0.6) * 0.5; CAM.z = k[2]; REF.oy = 196 + Math.sin(T * 1.5) * 1.2; applyCam();
  const B = new PBuf(PAL, 18); const W = drawArena(B, a, T); low.getContext('2d').clearRect(0, 0, LW, LH); B.toCanvas(low);
  F.setTransform(1, 0, 0, 1, 0, 0); F.filter = 'none'; F.globalAlpha = 1; F.globalCompositeOperation = 'source-over';
  skyGrid(F, T, a); pixelUp(F, low); neonEdges(F, T, a);
  // light: eye glows, hero aura, impact flares, rings, speed lines
  const H = W.H, A = W.A;
  if (A.show && A.r) { glowAt(F, A.r.center, 170, 'rgba(255,58,176,0.2)'); for (const e of A.r.eyes) glowAt(F, e, 70, 'rgba(255,42,109,0.55)'); }
  for (const c of W.cps) if (c.r) glowAt(F, c.r.center, 130, `rgba(${RGBC[c.k].join(',')},0.28)`);
  const aura = sm(2.85, 3.5, a) * (1 - sm(3.58, 3.9, a)); if (aura > 0 && H.r) glowAt(F, H.r.center, 260 * (0.8 + 0.2 * Math.sin(T * 30)), `rgba(255,140,90,${0.5 * aura})`);
  if (H.r) glowAt(F, H.r.center, 150, 'rgba(255,150,110,0.12)');
  HITS.forEach(([h], i) => { const d = a - h; if (d >= -0.001 && d < 0.25) glowAt(F, P(...HITPT[i]), (i === 2 ? 240 : 150) * (1 - d / 0.25 * 0.4), `rgba(255,250,235,${0.5 * (1 - d / 0.25)})`); });
  shockRing(F, HITPT[0][0], HITPT[0][1], 0.85, a, [255, 79, 140], 26, 0); shockRing(F, HITPT[0][0], HITPT[0][1], 0.87, a, [42, 240, 255], 20, 6);
  shockRing(F, HITPT[1][0], HITPT[1][1], 1.35, a, [255, 79, 79], 38, -8); shockRing(F, HITPT[1][0], HITPT[1][1], 1.35, a, [124, 255, 79], 38, 0); shockRing(F, HITPT[1][0], HITPT[1][1], 1.35, a, [42, 240, 255], 38, 8);
  [[255, 79, 79], [124, 255, 79], [42, 240, 255]].forEach((c, i) => shockRing(F, CEN[0], CEN[1], 3.55 + i * 0.07, a, c, 60, 0, 0.6)); shockRing(F, CEN[0], CEN[1], 3.55, a, [255, 200, 160], 34, 0, 0.35);
  if (a > 0.58 && a < 0.88) { const s = alterAt(a); speedLines(F, P(s.x, s.y, 10), [-DIRV[0], -DIRV[1]], sm(0.58, 0.7, a) * (1 - sm(0.84, 0.88, a)), 3, [255, 58, 176]); }
  if (a > 1.15 && a < 1.4) { const h = heroAt(a); speedLines(F, P(h.x, h.y, 10), DIRV, sm(1.15, 1.22, a) * (1 - sm(1.34, 1.4, a)), 9, [255, 200, 160]); }
  // post: bloom, chroma split + glitch bands on hits, scanlines, grade
  bloom(F, 0.15);
  const ca = hitR.reduce((m, rs, i) => { const d = T - rs; return d >= 0 && d < 0.4 ? Math.max(m, [9, 14, 20][i] * (1 - d / 0.4)) : m; }, 0) + (A.show ? A.tear * 4 : 0) + (a > 2.1 && a < 2.5 ? 6 : 0);
  chromaShift(F, ca);
  glitchBands(F, (hitR.some(rs => T - rs > 0 && T - rs < 0.18) ? 0.8 : 0) + (a > 2.1 && a < 2.35 ? 0.6 : 0) + (a > 4.12 && a < 4.35 ? 0.4 : 0), Math.floor(T * 30));
  hitR.forEach(rs => { const d = T - rs; if (d >= 0 && d < 0.07) { F.save(); F.globalCompositeOperation = 'lighter'; F.fillStyle = 'rgba(255,240,255,0.12)'; F.fillRect(0, 0, FW, FH); F.restore(); } });
  scanlines(F); vignette(F, 0.6, '6,2,16');
  roundSlam(F, T); cornerBug(F, T); endTitle(F, T);
  caption(F, T, 4.05, 5.2, ['SAME BLOCK.', 'DIFFERENT PROMPT.'], 1130, 7);
  grain(F, 7, Math.floor(T * 30) % 7 + 1);
}
