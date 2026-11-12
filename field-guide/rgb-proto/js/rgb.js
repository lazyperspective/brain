'use strict';
// ------------------------------------------------------------------
// RGB FIGHT PROTOTYPE v2 (5 s): Fable 5.2 vs. its alter ego, in the Field Guide format.
// Bigger arena (8x8 octagon, pylons, emblem, drifting rocks); detailed fighters (gradient shading, rim light,
// headbands with flowing tails, fists). Low-res pixel bodies + hi-res neon light. Choreography runs on
// "action time" (a) so hits can freeze (hit-stop).
// ------------------------------------------------------------------
const DUR5 = 5.0;
const PAL = ['d97757', 'a8553b', 'f2a585', '6e2a1a', 'ffd9c2', '1b1426', 'fff6ea', 'ffffff', '000000',
  'f7bfa0', 'e88a68', 'c4664a', '8f3f28', 'f07a6a', 'd9cbb5',
  '2a1f45', '17112b', '41316a', '0b0814', '5a4590', '352858', '221a3a', 'b02a80',
  'ff3ab0', 'ff2a6d', '2af0ff', '00b3ff', '7cff4f', 'ffe14f', 'b04fff', '4f6bff', 'ff4f4f', 'ff8a3d',
  '2a1d3d', '1c1430', '120c22', '3c2a5c', '5a4080', '8a6ab0', 'c3b9e0', '8e82b8', '24152e', '0d0a1c', '141c36', '1e2a4a', '2c3a66', '3a2a70'];
const HEROC = { body: hex('d97757'), bodyL: hex('e88a68'), bodyD: hex('c4664a'), shade: hex('a8553b'), shadeD: hex('8f3f28'), light: hex('f2a585'), lightL: hex('f7bfa0'), dark: hex('6e2a1a'),
  hi: hex('ffd9c2'), eye: hex('1b1426'), white: hex('fff6ea'), band: hex('fff6ea'), bandD: hex('d9cbb5'), blush: hex('f07a6a'), rimN: hex('ff3ab0'), tails: [7, 6] };
const ALTER = { body: hex('2a1f45'), bodyL: hex('352858'), bodyD: hex('221a3a'), shade: hex('17112b'), shadeD: hex('0b0814'), light: hex('41316a'), lightL: hex('5a4590'), dark: hex('0b0814'),
  hi: hex('ff3ab0'), spec: hex('5a4590'), eye: hex('ff2a6d'), white: hex('ffffff'), band: hex('ff3ab0'), bandD: hex('b02a80'), rimN: hex('2af0ff'), corrupt: true, glowEye: true, tails: [5, 3] };
const RGBC = [hex('ff4f4f'), hex('7cff4f'), hex('2af0ff')];
const NI = 8, MID = NI * 8;                                                   // 8x8 cells of 16 -> 128 world units, centre 64
const MASK8 = (i, j) => Math.hypot(i - 3.5, j - 3.5) <= 4.05;
const DEPTH8 = (i, j) => Math.round(22 + 60 * Math.max(0, 1 - Math.hypot(i - 3.5, j - 3.5) / 4.8) + hash(i, j, 6) * 12);
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
function thick(B, a, b, w, col) { for (let dx = 0; dx < w; dx++) for (let dy = 0; dy < w; dy++) B.line(a[0] + dx, a[1] + dy, b[0] + dx, b[1] + dy, col); }
// face: 'x' = face on the +x side (looks down-right), 'y' = face on the +y side (looks down-left)
// st: {hop, squash, eyes:'fierce'|'closed'|'x'|'open', look:[dx,dy], mouth, arm 0..1, punch 0..1, wind 0..1, T}
function fighter(B, hx, hy, hz, st, Cc, face) {
  const k = ISO.k, sq = st.squash || 0, bz = 13 * (1 - sq), bx = 16 * (1 + sq * 0.5), by = 14 * (1 + sq * 0.5), T = st.T || 0;
  const hop = st.hop || 0, z0 = hz + 3 + hop, x0 = hx - bx / 2, y0 = hy - by / 2, x1 = x0 + bx, y1 = y0 + by, zt = z0 + bz, ch = 2;
  const fk = Math.max(1, k / 1.4), G = Math.max(1, Math.round(fk)), OX = ISO.ox, OY = ISO.oy;
  if (st.shadow !== false) { const sp = P(hx, hy, 0), r = (12 - Math.min(7, hop * 0.3)) * k; B.ellipse(sp[0] + 1, sp[1] + 1, r, r * 0.45, hex('0b0814')); B.ellipse(sp[0] + 1, sp[1] + 1, r * 0.66, r * 0.28, hex('000000')); }
  // headband tails (behind the body): from the knot at the back corner, fluttering, streaming out when dashing
  const back = face === 'x' ? [-1, 0] : [0, -1], side = face === 'x' ? [0, 1] : [1, 0], wind = st.wind == null ? 0.25 : st.wind;
  const K = face === 'x' ? [x0 - 0.8, y1 - 1.2, zt - 2.2] : [x1 - 1.2, y0 - 0.8, zt - 2.2];
  Cc.tails.forEach((n, j) => {
    let prev = P(...K);
    for (let i = 1; i <= n; i++) {
      const along = i * 1.9, wv = Math.sin(T * 17 - i * 0.85 + j * 1.9) * 0.32 * i * (0.45 + wind), spread = (j ? 0.55 : -0.35) * i;
      const p = [K[0] + back[0] * along * (0.55 + 0.45 * wind) + side[0] * (wv + spread), K[1] + back[1] * along * (0.55 + 0.45 * wind) + side[1] * (wv + spread), K[2] - i * (1 - wind) * 0.95 + Math.sin(T * 13 - i + j) * 0.22 * i];
      const q = P(...p); thick(B, [prev[0], prev[1] + G * 0.5], [q[0], q[1] + G * 0.5], G, Cc.bandD); thick(B, prev, q, G, i === n ? Cc.bandD : Cc.band); prev = q;
    }
  });
  // feet
  for (const [lx, ly] of [[x0 + 1, y0 + 1], [x0 + bx - 4, y0 + 1], [x0 + 1, y0 + by - 4], [x0 + bx - 4, y0 + by - 4]]) { box(B, lx, ly, hz + hop, 3, 3, 3.5, Cc.shade, Cc.shadeD, Cc.dark); }
  // side faces: vertical light gradient, contact shadow, waist seam, (alter ego) corrupted pixels
  const zL = (sx, sy) => { const x = (sx + 0.5 - OX) / k + y1; return [x, (x + y1) / 2 - (sy + 0.5 - OY) / k]; };
  const zR = (sx, sy) => { const y = x1 - (sx + 0.5 - OX) / k; return [y, (x1 + y) / 2 - (sy + 0.5 - OY) / k]; };
  const faceCol = (base, lo, hi, along, z, sd) => {
    const f = clamp((z - z0) / bz, 0, 1); let c = f > 0.55 ? mix(base, hi, (f - 0.55) * 1.6) : mix(lo, base, 0.25 + f / 0.55 * 0.75);
    if (f < 0.13) c = mix(c, Cc.dark, 0.45 * (1 - f / 0.13));
    if (Math.abs(f - 0.3) < 0.03) c = mix(c, Cc.dark, 0.28);
    if (Cc.corrupt) { const ia = Math.floor(along * 1.4), iz = Math.floor(z * 1.4), hh = hash(ia, iz + Math.floor(T * 6) * (hash(ia, 1, sd) > 0.7 ? 1 : 0), sd); if (hh > 0.972) c = hash(ia, iz, sd + 5) > 0.5 ? hex('ff3ab0') : hex('2af0ff'); }
    return [...c, 12];
  };
  const LF = [P(x0, y1, zt), P(x1 - ch, y1, zt), P(x1 - ch, y1, z0), P(x0, y1, z0)], RF = [P(x1, y0, zt), P(x1, y1 - ch, zt), P(x1, y1 - ch, z0), P(x1, y0, z0)];
  B.poly(LF, (sx, sy) => { const [a, z] = zL(sx, sy); return faceCol(Cc.body, Cc.bodyD, Cc.bodyL, a, z, 1); });
  B.poly(RF, (sx, sy) => { const [a, z] = zR(sx, sy); return faceCol(Cc.shade, Cc.shadeD, Cc.bodyD, a, z, 2); });
  B.poly([P(x1 - ch, y1, zt), P(x1, y1 - ch, zt), P(x1, y1 - ch, z0), P(x1 - ch, y1, z0)], mix(Cc.body, Cc.shade, 0.45));
  { const a = P(x1 - ch * 0.5, y1 - ch * 0.5, zt - 0.5), b = P(x1 - ch * 0.5, y1 - ch * 0.5, z0 + bz * 0.45); B.line(a[0], a[1], b[0], b[1], mix(Cc.light, Cc.body, 0.4)); }
  // headband around the brow (both visible faces + the bevel)
  const zb0 = zt - 3.1, zb1 = zt - 1.1;
  B.poly([P(x0, y1, zb1), P(x1 - ch, y1, zb1), P(x1 - ch, y1, zb0), P(x0, y1, zb0)], Cc.band); B.poly([P(x1, y0, zb1), P(x1, y1 - ch, zb1), P(x1, y1 - ch, zb0), P(x1, y0, zb0)], Cc.bandD);
  B.poly([P(x1 - ch, y1, zb1), P(x1, y1 - ch, zb1), P(x1, y1 - ch, zb0), P(x1 - ch, y1, zb0)], mix(Cc.band, Cc.bandD, 0.5));
  { const a = P(x0, y1, zb0), b = P(x1 - ch, y1, zb0), c = P(x1, y1 - ch, zb0), d = P(x1, y0, zb0); B.line(a[0], a[1] + 1, b[0], b[1] + 1, mix(Cc.body, Cc.dark, 0.5)); B.line(c[0], c[1] + 1, d[0], d[1] + 1, Cc.shadeD); }
  if (face === 'x') box(B, x0 - 0.8, y1 - 2.2, zb0 - 0.3, 1.6, 2.2, 2.6, Cc.band, Cc.band, Cc.bandD); else box(B, x1 - 2.2, y0 - 0.8, zb0 - 0.3, 2.2, 1.6, 2.6, Cc.band, Cc.band, Cc.bandD);
  // top: light from the back-left, a soft specular spot
  B.poly([P(x0 + 1, y0, zt), P(x1, y0, zt), P(x1, y1 - ch, zt), P(x1 - ch, y1, zt), P(x0, y1, zt), P(x0, y0 + 1, zt)], (sx, sy) => {
    const u = (sx + 0.5 - OX) / k, v = (sy + 0.5 - OY) / k + zt, x = v + u / 2, y = v - u / 2, f = clamp(((x - x0) / bx + (y - y0) / by) / 2, 0, 1);
    let c = mix(Cc.lightL, Cc.light, f); if (Math.hypot(x - (x0 + bx * 0.3), (y - (y0 + by * 0.32)) * 1.2) < 2.1) c = Cc.spec || Cc.hi; return [...c, 12];
  });
  { const a = P(x0 + 1, y1, zt), b = P(x1 - ch, y1, zt), c = P(x1, y1 - ch, zt), d = P(x1, y0, zt); B.line(a[0], a[1], b[0], b[1] - 1, Cc.hi); B.line(c[0], c[1], d[0], d[1], mix(Cc.hi, Cc.shade, 0.45)); }
  { const r1 = P(x0 + 1, y0, zt), r2 = P(x1, y0, zt), r3 = P(x0, y0 + 1, zt), r4 = P(x0, y1, zt); B.line(r1[0], r1[1], r2[0], r2[1], Cc.rimN); B.line(r3[0], r3[1], r4[0], r4[1], mix(Cc.rimN, Cc.hi, 0.4)); }
  { const a = P(x0, y1, zt), b = P(x0, y1, z0 + 1), c = P(x1, y0, zt), d = P(x1, y0, z0 + 1); B.line(a[0], a[1], b[0], b[1], Cc.rimN); B.line(c[0], c[1], d[0], d[1], Cc.rimN); }
  // face
  const EW = Math.max(3, Math.round(3 * fk)), EH = Math.max(5, Math.round(5 * fk)), ez = z0 + bz * 0.56, lk = st.look || [0, 0];
  const eyePts = face === 'x' ? [P(x1, y0 + 3.6, ez), P(x1, y0 + 9.4, ez)] : [P(x0 + 3.6, y1, ez), P(x0 + 9.4, y1, ez)], skin = face === 'x' ? Cc.shade : Cc.body, eyes = [];
  eyePts.forEach((e, idx) => {
    const ex = Math.round(e[0] + lk[0] * fk), ey = Math.round(e[1] - G + lk[1] * fk), other = eyePts[1 - idx], inward = Math.sign(other[0] - e[0]); eyes.push([ex, ey]);
    if (Cc.blush && st.eyes !== 'x') B.rect(ex - inward * 2 * G - G, ey + Math.round(EH / 2) + G, 2 * G, G, Cc.blush);
    if (st.eyes === 'x') { for (let q = -2; q <= 2; q++) { B.rect(ex + q * G, ey + q * G, G, G, Cc.eye); B.rect(ex + q * G, ey - q * G, G, G, Cc.eye); } return; }
    if (st.eyes === 'closed') { const w = EW + 2 * G; B.rect(ex - Math.round(w / 2), ey, w, G, Cc.eye); B.rect(ex - Math.round(w / 2) - G, ey - G, G, G, Cc.eye); B.rect(ex + Math.round(w / 2), ey - G, G, G, Cc.eye); return; }
    const w = EW, h = EH, x = ex - Math.round(w / 2), y = ey - Math.round(h / 2);
    B.rect(x + G, y, w - 2 * G, h, Cc.eye); B.rect(x, y + G, w, h - 2 * G, Cc.eye);
    if (Cc.glowEye) { B.rect(ex - Math.floor(G / 2), y + G, G, h - 2 * G, Cc.white); }
    else { B.rect(x + G, y + G, Math.max(1, G), 2 * G, Cc.white); B.rect(x + w - 2 * G, y + h - 2 * G, G, G, mix(Cc.eye, Cc.white, 0.45)); }
    if (st.eyes === 'fierce') {   // angry brow: cuts the top of the eye, low at the inner end
      for (let q = -G; q < w + G; q++) { const fr = (q + G) / (w + 2 * G), inner = inward > 0 ? fr : 1 - fr, by_ = y - G + Math.round(inner * G * 2.2);
        B.rect(x + q, y - G, 1, Math.max(0, by_ - (y - G)), skin); B.rect(x + q, by_, 1, G, Cc.dark); }
    }
  });
  const mp = face === 'x' ? P(x1, y0 + 6.5, ez - 4.4) : P(x0 + 6.5, y1, ez - 4.4), mx = Math.round(mp[0] + lk[0] * fk * 0.5), my = Math.round(mp[1] + lk[1] * fk * 0.5);
  if (st.mouth === 'grit') { B.rect(mx - 3 * G, my, 6 * G, 2 * G, Cc.dark); for (let q = -2; q <= 1; q++) B.rect(mx + q * G + (q >= 0 ? G : 0) - G, my, G - (G > 1 ? 1 : 0) || 1, G, Cc.white); }
  else if (st.mouth === 'o') { B.rect(mx - G, my, 3 * G, 3 * G, Cc.dark); B.rect(mx - 2 * G, my + G, 5 * G, G, Cc.dark); }
  else if (st.mouth === 'smirk') { B.rect(mx - 2 * G, my + G, 4 * G, G, Cc.dark); B.rect(mx + 2 * G, my, G, G, Cc.dark); }
  else if (st.mouth === 'smile') { B.rect(mx - G, my + G, 3 * G, G, Cc.dark); B.rect(mx - 2 * G, my, G, G, Cc.dark); B.rect(mx + 2 * G, my, G, G, Cc.dark); }
  else B.rect(mx - G, my + G, 3 * G, G, Cc.dark);
  // arm on the visible side; raises with st.arm, the fist shoots forward with st.punch
  const az = z0 + bz * 0.26 + (st.arm || 0) * 3, pu = st.punch || 0, fs = 3.6 + pu * 1.2;
  if (face === 'x') { box(B, x0 + bx * 0.4 + pu * (bx * 0.62 + 3), y1 - 0.5 - pu * 1.5, az + pu * 1.5, fs, 3.2, fs, Cc.lightL, Cc.body, Cc.shade); if (pu > 0.3) { const kp = P(x0 + bx * 0.4 + pu * (bx * 0.62 + 3) + fs, y1 + 0.5, az + pu * 1.5 + fs * 0.6), kq = P(x0 + bx * 0.4 + pu * (bx * 0.62 + 3) + fs, y1 + 2.5, az + pu * 1.5 + fs * 0.6); B.line(kp[0], kp[1], kq[0], kq[1], Cc.dark); } }
  else { box(B, x1 - 0.5 - pu * 1.5, y0 + by * 0.4 + pu * (by * 0.62 + 3), az + pu * 1.5, 3.2, fs, fs, Cc.lightL, Cc.body, Cc.shade); }
  return { head: P(hx, hy, zt), center: P(hx, hy, z0 + bz / 2), foot: P(hx, hy, 0), eyes };
}
// draw a fighter into a scratch buffer, then composite: optional RGB fringe, glitch-tear rows, solid tint, ghost (checker) transparency
function fighterFX(B, hx, hy, hz, st, Cc, face, o = {}) {
  const Tb = new PBuf(PAL, 0); const r = fighter(Tb, hx, hy, hz, st, Cc, face), d = Tb.d, out = B.d, f = Math.round(o.fringe || 0), tear = o.tear || 0, seed = o.seed || 0;
  const shiftOf = y => tear > 0 && hash(y >> 2, seed, 3) < tear * 0.45 ? Math.round((hash(y >> 2, seed + 1, 7) - 0.5) * 26 * tear) : 0;
  if (f) for (let y = 0; y < LH; y++) { const sh = shiftOf(y); for (let x = 0; x < LW; x++) { const i = (y * LW + x) * 4; if (!d[i + 3]) continue;
    for (const [dx, c] of [[-f, RGBC[0]], [f, RGBC[2]]]) { const x2 = x + sh + dx; if (x2 < 0 || x2 >= LW) continue; const j = (y * LW + x2) * 4; out[j] = Math.max(out[j] * 0.4, c[0] * 0.85); out[j + 1] = out[j + 1] * 0.4 + c[1] * 0.25; out[j + 2] = Math.max(out[j + 2] * 0.4, c[2] * 0.85); out[j + 3] = 255; } } }
  for (let y = 0; y < LH; y++) { const sh = shiftOf(y); for (let x = 0; x < LW; x++) { const i = (y * LW + x) * 4; if (!d[i + 3]) continue; const xx = x + sh; if (xx < 0 || xx >= LW) continue;
    if (o.ghost && ((xx + y) & 1)) continue; const j = (y * LW + xx) * 4; let c0 = d[i], c1 = d[i + 1], c2 = d[i + 2];
    if (o.tint) { const m = o.tintK || 0.6; c0 = c0 * (1 - m) + o.tint[0] * m; c1 = c1 * (1 - m) + o.tint[1] * m; c2 = c2 * (1 - m) + o.tint[2] * m; }
    out[j] = c0; out[j + 1] = c1; out[j + 2] = c2; out[j + 3] = 255; } }
  return r;
}

// ---------------- choreography (action time a) ----------------
const H0 = [42, 86], A0 = [86, 42], CEN = [64, 64], DIRV = [Math.SQRT1_2, -Math.SQRT1_2];
const at_ = (p, s) => [p[0] + s * DIRV[0], p[1] + s * DIRV[1]];
const C1 = at_(H0, 16), B1 = at_(H0, -6), A1 = at_(CEN, 16), AK = at_(A1, 24);
const HITPT = [[...at_(H0, 8.5), 9], [...at_(CEN, 8), 9], [CEN[0], CEN[1], 6]];
function heroAt(a, T) {
  const st = { eyes: 'fierce', look: [1, -1], mouth: 'flat', arm: 0.4, hop: 0, squash: 0.06 + 0.04 * Math.sin(a * 10), T, wind: 0.25 }; let p = H0;
  if (a < 0.85) { st.arm = 0.4 + 0.4 * sm(0.3, 0.55, a); }
  else if (a < 1.0) { const u = (a - 0.85) / 0.15; p = lerp2(H0, B1, eOut(u)); st.arm = 1; st.squash = 0.22 * (1 - u); st.mouth = 'grit'; st.eyes = u < 0.5 ? 'closed' : 'fierce'; st.wind = 0.8; }
  else if (a < 1.15) { const u = (a - 1.0) / 0.15; p = B1; st.squash = 0.24 * sm(0, 1, u); st.arm = 0.1; st.mouth = 'grit'; }
  else if (a < 1.35) { const u = (a - 1.15) / 0.2; p = lerp2(B1, CEN, eIn(u)); st.hop = Math.sin(u * Math.PI) * 5; st.squash = -0.22; st.arm = 0.6; st.punch = sm(0.4, 1, u); st.mouth = 'grit'; st.wind = 1; }
  else if (a < 1.8) { const u = (a - 1.35) / 0.45; p = CEN; st.punch = 1 - sm(0.15, 0.6, u); st.arm = 0.6; st.squash = 0.16 * Math.sin(Math.min(1, u * 2) * Math.PI); st.mouth = 'grit'; st.wind = 1 - u * 0.7; }
  else if (a < 2.45) { p = CEN; st.mouth = a < 2.15 ? 'flat' : 'o'; st.look = a < 2.15 ? [1, -1] : [2, -1]; st.arm = 0.7; }
  else if (a < 3.3) { p = CEN; const w = (a - 2.45) * 7.5; st.look = [Math.round(Math.sin(w) * 2), Math.round(-Math.abs(Math.cos(w)))]; st.squash = 0.06 + 0.16 * sm(2.9, 3.3, a); st.mouth = a > 2.9 ? 'grit' : 'flat'; st.arm = 0.8; st.wind = 0.25 + 0.6 * sm(2.9, 3.3, a); }
  else if (a < 3.55) { p = CEN; st.squash = 0.22; st.eyes = 'closed'; st.mouth = 'grit'; st.arm = 0.2; st.wind = 0.9; }
  else if (a < 4.0) { p = CEN; const u = (a - 3.55) / 0.45; st.hop = Math.sin(u * Math.PI) * 16; st.squash = u < 0.15 ? -0.22 : -0.08; st.arm = 1; st.mouth = 'o'; st.wind = 1; }
  else { p = CEN; const u = clamp((a - 4.0) / 0.22, 0, 1); st.squash = 0.2 * Math.sin(u * Math.PI); st.arm = 1; st.mouth = 'smile'; st.look = [1, 0]; st.wind = 0.45; }
  return { x: p[0], y: p[1], st };
}
function alterAt(a, T) {
  const st = { eyes: 'fierce', look: [-1, -1], mouth: 'smirk', arm: 0.4, hop: 0, squash: 0.06 + 0.04 * Math.sin(a * 10 + 2), T: T + 0.7, wind: 0.25 }; let p = A0, tear = 0, show = true;
  if (a < 0.55) { tear = hash(Math.floor(a * 14), 2, 2) > 0.8 ? 0.25 : 0; }
  else if (a < 0.85) { const u = (a - 0.55) / 0.3; p = lerp2(A0, C1, eIn(u)); st.squash = -0.22; st.arm = 0.6; st.punch = sm(0.45, 1, u); st.mouth = 'grit'; st.wind = 1; }
  else if (a < 1.2) { const u = (a - 0.85) / 0.35; p = lerp2(C1, A1, eOut(u)); st.punch = 1 - sm(0, 0.5, u); st.hop = Math.sin(u * Math.PI) * 7; st.squash = u > 0.85 ? 0.15 : -0.05; st.wind = 0.8; }
  else if (a < 1.35) { p = A1; st.mouth = 'o'; st.look = [-2, 0]; }
  else if (a < 1.8) { const u = (a - 1.35) / 0.45; p = lerp2(A1, AK, eOut(u)); st.hop = Math.sin(u * Math.PI) * 6; st.squash = u < 0.25 ? 0.28 : 0.06; st.eyes = u < 0.6 ? 'closed' : 'fierce'; st.mouth = 'o'; tear = 1 - u * 0.8; st.wind = 1 - u * 0.5; }
  else if (a < 2.15) { p = AK; st.mouth = 'grit'; st.squash = 0.1 * Math.sin((a - 1.8) * 30); tear = 0.25 + 0.6 * sm(1.95, 2.15, a); st.arm = 0.9; }
  else if (a < 4.12) { show = false; }
  else { const u = clamp((a - 4.12) / 0.3, 0, 1); p = AK; st.squash = 0.3 - 0.18 * u + 0.04 * Math.sin(a * 18); st.eyes = 'x'; st.mouth = 'o'; st.look = [0, 0]; st.arm = 0; tear = (1 - u) * 0.9 + (hash(Math.floor(a * 12), 4, 4) > 0.7 ? 0.35 : 0); }
  return { x: p[0], y: p[1], st, tear, show };
}
// the three RGB copies: split off, ring the hero, circle, dash in together, get flung out, snap back together
function copiesAt(a) {
  const out = []; if (a < 2.12 || a >= 4.12) return out;
  for (let k = 0; k < 3; k++) {
    const th = -0.5 + k * 2.094 + 1.4 * sm(2.5, 3.3, a); let R = 32, hop = 0, tear = 0, x, y, dash = false;
    const ring = [CEN[0] + Math.cos(th) * R, CEN[1] + Math.sin(th) * R];
    if (a < 2.5) { const u = eOut((a - 2.12) / 0.38); [x, y] = lerp2(AK, ring, u); hop = Math.sin(u * Math.PI) * 7; tear = 0.6 * (1 - u); }
    else if (a < 3.3) { [x, y] = ring; hop = Math.max(0, Math.sin((a - 2.5) * 16 + k * 2)) * 1.5; }
    else if (a < 3.55) { R = lerp(32, 12, eIn((a - 3.3) / 0.25)); x = CEN[0] + Math.cos(th) * R; y = CEN[1] + Math.sin(th) * R; dash = true; }
    else if (a < 3.86) { const u = (a - 3.55) / 0.31; R = lerp(12, 52, eOut(u)); x = CEN[0] + Math.cos(th) * R; y = CEN[1] + Math.sin(th) * R; hop = Math.sin(u * Math.PI) * 18; tear = 0.8 * (1 - u) + 0.2; }
    else { const u = (a - 3.86) / 0.26, s = [CEN[0] + Math.cos(th) * 52, CEN[1] + Math.sin(th) * 52]; [x, y] = lerp2(s, AK, eIn(u)); hop = Math.sin(u * Math.PI) * 10; tear = 0.5; }
    out.push({ x, y, hop, tear, k, dash, th });
  }
  return out;
}
// camera [a, cx, cy, zoom]: wide establishing shot of the whole arena, then it follows the fight up close
const CAM5 = [[0, 180, 282, 1.2], [0.45, 178, 278, 1.45], [0.85, 152, 272, 2.25], [1.15, 165, 274, 1.95], [1.35, 198, 271, 2.35], [1.8, 206, 272, 2.0], [2.15, 214, 272, 1.85],
  [2.5, 184, 276, 1.7], [3.3, 180, 274, 1.95], [3.55, 180, 272, 2.35], [3.95, 186, 278, 1.55], [4.86, 204, 272, 1.75]];

// ---------------- low-res world ----------------
let RIP = [];   // floor ripples [a0, x, y, colour index]
function arenaTop(a, T) {
  const line = hex('2c3a66'), lineB = hex('3a2a70'), mag = hex('ff3ab0'), vio = hex('b04fff');
  return (x, y) => {
    const n = fbm(x * 0.05, y * 0.05, 3, 3); let c = n > 0.56 ? ICOL.topL : n < 0.37 ? ICOL.topD : ICOL.top;
    const gx = ((x % 8) + 8) % 8, gy = ((y % 8) + 8) % 8, on = gx < 0.5 || gy < 0.5;
    if (on) c = (Math.floor(x / 8) + Math.floor(y / 8)) & 1 ? line : lineB;
    const dc = Math.hypot(x - MID, y - MID), ang = Math.atan2(y - MID, x - MID);
    if (Math.abs(dc - 24) < 0.7) c = mag; else if (Math.abs(dc - 16) < 0.45 && Math.sin(ang * 8 + T * 2) > -0.3) c = vio; else if (dc < 23 && dc > 17 && Math.abs(Math.sin(ang * 4)) < 0.06) c = vio;
    const sweep = ((x + y - T * 70) % 180 + 180) % 180; if (on && sweep < 8) c = sweep < 3 ? mag : vio;
    for (const [a0, rx, ry, ci] of RIP) { const dt = a - a0; if (dt < 0 || dt > 0.75) continue; const d = Math.hypot(x - rx, y - ry), r = dt * 150, w = Math.max(0, 1 - Math.abs(d - r) / 7) * (1 - dt / 0.75);
      if (w > 0.15 && on) c = RGBC[ci]; else if (w > 0.55) c = mix(c, RGBC[ci], 0.45); }
    return [...c, 6];
  };
}
// neon pylon with a floating crystal
const PYLONS = [[22, 106, 0, 34], [106, 22, 1, 34]];
function pylonW(B, x, y, ci, h, T) {
  const dk = hex('1c1430'), dl = hex('2a1d3d'), dd = hex('120c22'); box(B, x - 3.5, y - 3.5, 0, 7, 7, 3, hex('3c2a5c'), dl, dd); box(B, x - 2.5, y - 2.5, 3, 5, 5, h, hex('3c2a5c'), dl, dk);
  for (let z = 7; z < h; z += 7) { const a = P(x - 2.5, y + 2.5, z + 3), b = P(x + 2.5, y + 2.5, z + 3), c = P(x + 2.5, y - 2.5, z + 3); B.line(a[0], a[1], b[0], b[1], RGBC[ci]); B.line(b[0], b[1], c[0], c[1], mix(RGBC[ci], dd, 0.35)); }
  if (h < 20) return;
  const zc = h + 14 + Math.sin(T * 2.2 + ci) * 2, sp = T * 2 + ci, r = 3.6, top = P(x, y, zc + 7), bot = P(x, y, zc - 6);
  const ring = [0, 1, 2, 3].map(q => P(x + Math.cos(sp + q * 1.571) * r, y + Math.sin(sp + q * 1.571) * r, zc));
  const pts = ring.map((p, q) => [p, q]).sort((p, q) => p[0][1] - q[0][1]);
  for (let q = 0; q < 4; q++) { const p1 = ring[q], p2 = ring[(q + 1) % 4], vis = (p1[1] + p2[1]) / 2 > ISO.oy + (x + y) / 2 * ISO.k - zc * ISO.k - 0.01;
    const lit = (q & 1) ? 0.55 : 0.85; B.poly([top, p1, p2], mix(hex('0b0814'), RGBC[ci], lit)); B.poly([bot, p1, p2], mix(hex('0b0814'), RGBC[ci], lit * 0.6)); }
  B.put(top[0], top[1] + 2, hex('ffffff')); B.put(top[0], top[1] + 3, hex('ffffff'));
}
function rocksW(B, T, front) {
  const R = front ? [[150, 70, -40, 3], [72, 156, -34, 4]] : [[-30, 50, -6, 1], [46, -34, -14, 2]];
  for (const [x, y, z, s] of R) { const o = P(x, y, z + Math.sin(T * 1.3 + s) * 1.5), sv = { ox: ISO.ox, oy: ISO.oy }; ISO.ox = Math.round(o[0]); ISO.oy = Math.round(o[1]);
    drawIslandW(B, { T: 9, N: 2, mask: (i, j) => hash(i, j, s) > 0.2 || (i === 0 && j === 0), depth: (i, j) => Math.round(8 + hash(i, j, s + 3) * 14), cols: ICOL, topFn: (px, py) => [...(hash(Math.floor(px / 4), Math.floor(py / 4), s) > 0.5 ? ICOL.topL : ICOL.top), 6] });
    ISO.ox = sv.ox; ISO.oy = sv.oy; }
}
function sparksW(B, at, a0, a, seed, n = 18) {
  const u = (a - a0) / 0.32; if (u < 0 || u > 1) return; const k = ISO.k / 1.4;
  for (let q = 0; q < n; q++) { const ang = hash(q, seed, 1) * 6.283, sp = (14 + hash(q, seed, 2) * 30) * k, r0 = sp * eOut(u) * 0.55, r1 = sp * eOut(u), col = u < 0.3 ? hex('ffffff') : [hex('ffe14f'), hex('2af0ff'), hex('ff3ab0')][q % 3];
    B.line(at[0] + Math.cos(ang) * r0, at[1] + Math.sin(ang) * r0 * 0.7, at[0] + Math.cos(ang) * r1, at[1] + Math.sin(ang) * r1 * 0.7 + u * u * 6 * k, col); }
}
function motesW(B, H, a) {   // coral power motes rising around the charging hero
  const pw = sm(2.85, 3.5, a) * (1 - sm(3.6, 3.9, a)); if (pw <= 0) return;
  for (let q = 0; q < 34; q++) { if (hash(q, 3, 3) > pw) continue; const ph = ((a * (0.9 + hash(q, 1, 1)) + hash(q, 2, 2)) % 1), ang = hash(q, 4, 4) * 6.283, r = 10 + hash(q, 5, 5) * 6;
    const p = P(H.x + Math.cos(ang) * r, H.y + Math.sin(ang) * r, ph * 32); B.put(p[0], p[1], ph < 0.5 ? hex('ffd9c2') : hex('d97757')); if (ph < 0.35) { B.put(p[0], p[1] - 1, hex('f2a585')); B.put(p[0] + 1, p[1], hex('f2a585')); } }
}
const faceTo = (x, y) => x - y > CEN[0] - CEN[1] ? 'y' : 'x';
function drawArena(B, a, T) {
  rocksW(B, T, false);
  drawIslandW(B, { T: 16, N: NI, mask: MASK8, depth: DEPTH8, cols: ICOL, topFn: arenaTop(a, T) });
  const items = [], H = heroAt(a, T), A = alterAt(a, T), cps = copiesAt(a);
  for (const [x, y, ci, h] of PYLONS) items.push({ d: x + y, f: () => pylonW(B, x, y, ci, h, T) });
  // afterimages (behind the fighters)
  const ghosts = [];
  if (a > 0.6 && a < 0.95) for (let g = 3; g >= 1; g--) { const ga = a - g * 0.035; if (ga < 0.55) continue; const s = alterAt(ga, T); ghosts.push([s.x, s.y, s.st, ALTER, 'y', { ghost: true, tint: RGBC[g - 1], tintK: 0.75 }]); }
  if (a > 1.17 && a < 1.45) for (let g = 3; g >= 1; g--) { const ga = a - g * 0.035; if (ga < 1.15) continue; const s = heroAt(ga, T); ghosts.push([s.x, s.y, s.st, HEROC, 'x', { ghost: true, tint: g === 1 ? hex('ffd9c2') : hex('d97757'), tintK: 0.6 }]); }
  for (const c of cps) if (c.dash) for (let g = 2; g >= 1; g--) { const pc = copiesAt(a - g * 0.04).find(q => q.k === c.k); if (pc) ghosts.push([pc.x, pc.y, { eyes: 'fierce', mouth: 'grit', hop: pc.hop, squash: -0.2, shadow: false, T, wind: 1 }, ALTER, faceTo(pc.x, pc.y), { ghost: true, tint: RGBC[c.k], tintK: 0.85 }]); }
  for (const g of ghosts) fighterFX(B, g[0], g[1], 0, g[2], g[3], g[4], g[5]);
  items.push({ d: H.x + H.y, f: () => { H.r = fighterFX(B, H.x, H.y, 0, H.st, HEROC, 'x', {}); } });
  if (A.show) items.push({ d: A.x + A.y, f: () => { A.r = fighterFX(B, A.x, A.y, 0, A.st, ALTER, 'y', { fringe: 1 + Math.round(A.tear * 2), tear: A.tear, seed: Math.floor(a * 30) }); } });
  for (const c of cps) items.push({ d: c.x + c.y, f: () => { c.r = fighterFX(B, c.x, c.y, 0, { eyes: 'fierce', mouth: a > 3.55 ? 'o' : 'smirk', hop: c.hop, squash: c.dash ? -0.2 : 0.05 * Math.sin(a * 12 + c.k), look: [0, 0], T: T + c.k, wind: c.dash || a > 3.55 ? 1 : 0.3, arm: 0.6, punch: c.dash ? 0.8 : 0 }, ALTER, faceTo(c.x, c.y), { tint: RGBC[c.k], tintK: 0.5, tear: c.tear, seed: Math.floor(a * 30) + c.k * 7 }); } });
  items.sort((p, q) => p.d - q.d).forEach(it => it.f());
  rocksW(B, T, true);
  motesW(B, H, a);
  HITS.forEach(([h], i) => sparksW(B, P(...HITPT[i]), h, a, i * 13 + 1, i === 2 ? 34 : 20));
  return { H, A, cps };
}

// ---------------- hi-res: sky, neon, effects ----------------
function skyGrid(F, T, a) {
  let g = F.createLinearGradient(0, 0, 0, FH); g.addColorStop(0, '#05030f'); g.addColorStop(0.35, '#120a2e'); g.addColorStop(0.62, '#2a0f45'); g.addColorStop(0.72, '#3d1250'); g.addColorStop(1, '#0a0618'); F.fillStyle = g; F.fillRect(0, 0, FW, FH);
  const R = mulberry(9); for (let q = 0; q < 140; q++) { const s = S([R() * 400 - 20, R() * 320 - 20], 0.12), tw = 0.3 + 0.7 * Math.pow(0.5 + 0.5 * Math.sin(T * (1.5 + R() * 3) + q), 2); F.fillStyle = `rgba(230,220,255,${tw * 0.7})`; F.fillRect(Math.round(s[0] * SC / 3) * 3, Math.round(s[1] * SC / 3) * 3, 3, 3); }
  // the neon ring (replaces the moon): a rotating RGB conic stroke with bloom, synthwave bands inside
  const c = HX(S([186, 132], 0.25)), r = 270 * (1 + (CAM.z - 1.5) * 0.18), rot = T * 1.3;
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
  const hz = HX(S([0, 318], 0.2))[1];
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
  if (!EDGES) { EDGES = []; const has = (i, j) => i >= 0 && j >= 0 && i < NI && j < NI && MASK8(i, j);
    for (let i = 0; i < NI; i++) for (let j = 0; j < NI; j++) if (has(i, j)) { const x0 = i * 16, y0 = j * 16, x1 = x0 + 16, y1 = y0 + 16;
      if (!has(i, j + 1)) EDGES.push([x0, y1, x1, y1, 1]); if (!has(i + 1, j)) EDGES.push([x1, y0, x1, y1, 1]); if (!has(i, j - 1)) EDGES.push([x0, y0, x1, y0, 0]); if (!has(i - 1, j)) EDGES.push([x0, y0, x0, y1, 0]); } }
  const pulse = HITS.reduce((m, [h]) => Math.max(m, Math.max(0, 1 - Math.abs(a - h - 0.04) / 0.25)), 0);
  for (const [lw, blur, al] of [[16, 14, 0.45 + pulse * 0.4], [4, 0, 0.95]]) {
    F.save(); F.globalCompositeOperation = 'lighter'; if (blur) F.filter = `blur(${blur}px)`; F.lineWidth = lw; F.lineCap = 'round';
    for (const [xa, ya, xb, yb, front] of EDGES) { const m = Math.atan2((ya + yb) / 2 - MID, (xa + xb) / 2 - MID) / 6.283; F.strokeStyle = hueCol(m + T * 0.35, al * (front ? 1 : 0.6)); const p = HX(P(xa, ya, 0)), q = HX(P(xb, yb, 0)); F.beginPath(); F.moveTo(p[0], p[1]); F.lineTo(q[0], q[1]); F.stroke(); }
    F.restore();
  }
}
function pylonGlow(F, T) {
  for (const [x, y, ci, h] of PYLONS) { const c = RGBC[ci]; if (h >= 20) glowAt(F, P(x, y, h + 14 + Math.sin(T * 2.2 + ci) * 2), 120, `rgba(${c.join(',')},0.45)`); glowAt(F, P(x, y, h * 0.5), 90, `rgba(${c.join(',')},0.16)`); }
}
function floorGlow(F, p, r, rgba) { const c = HX(p); F.save(); F.translate(c[0], c[1]); F.scale(1, 0.5); const g = F.createRadialGradient(0, 0, 0, 0, 0, r); g.addColorStop(0, rgba); g.addColorStop(1, 'rgba(0,0,0,0)'); F.globalCompositeOperation = 'lighter'; F.fillStyle = g; F.fillRect(-r, -r, 2 * r, 2 * r); F.restore(); }
function shockRing(F, wx, wy, a0, a, col, maxR, off = 0, life = 0.45) {
  const u = (a - a0) / life; if (u < 0 || u > 1) return; const R = maxR * eOut(u), c = HX(P(wx, wy, 0)), rx = R * ISO.k * 1.414 * SC, ry = R * ISO.k * 0.707 * SC;
  F.save(); F.globalCompositeOperation = 'lighter';
  for (const [lw, blur, al] of [[22 * (1 - u) + 6, 10, 0.5], [6 * (1 - u) + 2, 0, 1]]) { F.filter = blur ? `blur(${blur}px)` : 'none'; F.strokeStyle = `rgba(${col[0]},${col[1]},${col[2]},${al * (1 - u)})`; F.lineWidth = lw; F.beginPath(); F.ellipse(c[0] + off, c[1], rx, ry, 0, 0, 7); F.stroke(); }
  F.restore();
}
function speedLines(F, from, dir, amt, seed, col = [255, 255, 255]) {
  if (amt <= 0) return; const sd = [dir[0] - dir[1], (dir[0] + dir[1]) / 2], L = Math.hypot(...sd), ux = sd[0] / L, uy = sd[1] / L, c = HX(from);
  F.save(); F.globalCompositeOperation = 'lighter';
  for (let q = 0; q < 14; q++) { const o = (hash(q, seed, 1) - 0.5) * 170, len = 90 + hash(q, seed, 2) * 240, st = 50 + hash(q, seed, 3) * 60, x0 = c[0] - ux * st - uy * o, y0 = c[1] - uy * st + ux * o * 0.6 - 30;
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
function scanlines(F) { F.fillStyle = 'rgba(0,0,0,0.12)'; for (let y = 2; y < FH; y += 3) F.fillRect(0, y, FW, 1); }
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
  skyGrid(F, T, a); pixelUp(F, low); neonEdges(F, T, a); pylonGlow(F, T);
  // light: floor pools, eye glows, hero aura, impact flares, rings, speed lines
  const H = W.H, A = W.A;
  if (H.r) floorGlow(F, H.r.foot, 200 * CAM.z / 2, 'rgba(255,130,90,0.22)');
  if (A.show && A.r) { floorGlow(F, A.r.foot, 200 * CAM.z / 2, 'rgba(255,58,176,0.26)'); glowAt(F, A.r.center, 150 * CAM.z / 2, 'rgba(255,58,176,0.16)'); for (const e of A.r.eyes) glowAt(F, e, 60 * CAM.z / 2, 'rgba(255,42,109,0.6)'); }
  for (const c of W.cps) if (c.r) { glowAt(F, c.r.center, 130 * CAM.z / 2, `rgba(${RGBC[c.k].join(',')},0.26)`); floorGlow(F, c.r.foot, 160 * CAM.z / 2, `rgba(${RGBC[c.k].join(',')},0.25)`); }
  const aura = sm(2.85, 3.5, a) * (1 - sm(3.58, 3.9, a)); if (aura > 0 && H.r) glowAt(F, H.r.center, 280 * (0.8 + 0.2 * Math.sin(T * 30)), `rgba(255,140,90,${0.5 * aura})`);
  HITS.forEach(([h], i) => { const d = a - h; if (d >= -0.001 && d < 0.25) glowAt(F, P(...HITPT[i]), (i === 2 ? 280 : 170) * (1 - d / 0.25 * 0.4), `rgba(255,250,235,${0.5 * (1 - d / 0.25)})`); });
  shockRing(F, HITPT[0][0], HITPT[0][1], 0.85, a, [255, 79, 140], 30, 0); shockRing(F, HITPT[0][0], HITPT[0][1], 0.87, a, [42, 240, 255], 24, 6);
  shockRing(F, HITPT[1][0], HITPT[1][1], 1.35, a, [255, 79, 79], 46, -8); shockRing(F, HITPT[1][0], HITPT[1][1], 1.35, a, [124, 255, 79], 46, 0); shockRing(F, HITPT[1][0], HITPT[1][1], 1.35, a, [42, 240, 255], 46, 8);
  [[255, 79, 79], [124, 255, 79], [42, 240, 255]].forEach((c, i) => shockRing(F, CEN[0], CEN[1], 3.55 + i * 0.07, a, c, 74, 0, 0.6)); shockRing(F, CEN[0], CEN[1], 3.55, a, [255, 200, 160], 40, 0, 0.35);
  if (a > 0.58 && a < 0.88) { const s = alterAt(a, T); speedLines(F, P(s.x, s.y, 10), [-DIRV[0], -DIRV[1]], sm(0.58, 0.7, a) * (1 - sm(0.84, 0.88, a)), 3, [255, 58, 176]); }
  if (a > 1.15 && a < 1.4) { const h = heroAt(a, T); speedLines(F, P(h.x, h.y, 10), DIRV, sm(1.15, 1.22, a) * (1 - sm(1.34, 1.4, a)), 9, [255, 200, 160]); }
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
