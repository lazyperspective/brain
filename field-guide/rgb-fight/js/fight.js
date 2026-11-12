'use strict';
// ------------------------------------------------------------------
// RGB FIGHT — PART 1 (0–15 s). Six readable beats, one main action at a time, every move wound up first:
//  A 0–2     entrance: the alter ego glitches in · ROUND 1 · FIGHT!
//  B 2–3.9   fists: it punches, the hero blocks (shield), counter-punch knocks it back
//  C 3.9–6   power-up: an orb drops from the neon ring; both race; the hero gets it: SWORD!
//  D 6–8     sword: swing 1 whiffs (it blinks away), swing 2 lands
//  E 8–10    glitch axe: a rift spits out an axe; it leaps and slams; the floor cracks, tiles fly
//  F 10–11.6 clash: blade lock, sparks + lightning, blown apart
//  G 11.6–13 spin attack shatters the axe
//  H 13–14.35 hook: the shards stream back into it, the sky ring glitches red, it starts to split
// Positions are along the fight line: pos(s, p) — s along the line (hero left, alter right), p toward the camera.
// Everything runs on action time a; hit-stops freeze it (real time = a + earlier freezes).
// ------------------------------------------------------------------
const HITS = [[2.55, 0.06], [3.25, 0.1], [7.05, 0.12], [9.4, 0.12], [10.35, 0.15], [12.4, 0.1]];
function actionT(t) { let acc = 0; for (const [h, d] of HITS) { const rs = h + acc; if (t < rs) break; if (t < rs + d) return h; acc += d; } return t - acc; }
function realHit(i) { let acc = 0; for (let q = 0; q < i; q++) acc += HITS[q][1]; return HITS[i][0] + acc; }
const CEN = [64, 64], FWD_H = [Math.SQRT1_2, -Math.SQRT1_2], FWD_A = [-Math.SQRT1_2, Math.SQRT1_2];
const pos = (s, p = 0) => [CEN[0] + (s + p) * Math.SQRT1_2, CEN[1] + (p - s) * Math.SQRT1_2];
const SPREAD = 1.25;   // track s values are scaled by this (room between the blocks)
const HITPT = [[...pos(-19, 4), 9], [...pos(-6, 4), 9], [...pos(30, 6), 12], [...pos(2, 7), 1], [...pos(2, 7), 19], [...pos(-6, 7), 10]];
const ORB = pos(-8.5, 17), RIFT = pos(50, 14), SLAM = HITPT[3];

// keyframed position track: [a, s, p, hop, ease]  (hop = arc height of the segment ending at that key)
function track(keys, a) {
  if (a <= keys[0][0]) return { s: keys[0][1], p: keys[0][2], hop: 0 };
  for (let i = 1; i < keys.length; i++) { const k = keys[i]; if (a <= k[0]) { const q = keys[i - 1], u = (a - q[0]) / (k[0] - q[0]), e = k[4] || 'sm', w = e === 'in' ? eIn(u) : e === 'out' ? eOut(u) : e === 'lin' ? u : sm(0, 1, u);
    return { s: lerp(q[1], k[1], w), p: lerp(q[2], k[2], w), hop: (k[3] || 0) * Math.sin(u * Math.PI) }; } }
  const L = keys[keys.length - 1]; return { s: L[1], p: L[2], hop: 0 };
}
const HK = [[0, -24, 0], [2.55, -24, 0], [2.72, -29, 0, 0, 'out'], [3.05, -29, 0], [3.25, -14, 0, 3, 'in'], [3.9, -18, 0], [4.8, -18, 0], [5.25, -7, 16, 10], [5.85, -7, 16], [6.1, -2, 2],
  [6.3, 0, 0, 0, 'in'], [6.47, 1, 0], [6.85, 8, 0], [7.05, 10, 0, 0, 'in'], [7.6, 6, 0], [9.1, 6, 0], [9.38, -14, 0, 9, 'out'], [9.4, -14, 0], [9.7, -20, 0, 5, 'out'], [10.0, -20, 0],
  [10.35, -12, 0, 0, 'in'], [11.25, -12, 0], [11.6, -22, 0, 6, 'out'], [12.1, -22, 0], [12.4, -14, 0], [12.85, -10, 0], [14.35, -10, 0]];
const AKS = [[0, 24, 0], [2.3, 24, 0], [2.55, -6, 0, 2, 'in'], [2.9, 4, 0, 5, 'out'], [3.25, 4, 0], [3.7, 26, 0, 7, 'out'], [4.8, 26, 0], [5.2, 14, 6], [5.5, 20, 0], [6.31, 20, 0], [6.33, 32, 0, 0, 'lin'],
  [7.05, 32, 0], [7.5, 44, 0, 7, 'out'], [8.6, 44, 0], [9.0, 28, 0, 7], [9.4, 16, 0, 16], [10.0, 16, 0], [10.35, 12, 0, 0, 'in'], [11.25, 12, 0], [11.6, 24, 0, 6, 'out'], [11.95, 24, 0],
  [12.35, 10, 0, 3, 'in'], [12.4, 10, 0], [12.9, 36, 0, 11, 'out'], [14.35, 36, 0]];
const lockD = a => a > 10.35 && a < 11.25 ? 1.8 * Math.sin((a - 10.35) * 9) * sm(10.35, 10.5, a) : 0;
function faceForDir(d) { return d[0] >= 0.38 && d[0] >= d[1] ? 'x' : d[1] >= 0.38 ? 'y' : null; }

function heroAt(a, T) {
  const tr = track(HK, a), s = tr.s * SPREAD + lockD(a), [x, y] = pos(s, tr.p);
  const st = { eyes: 'fierce', look: [1, -1], mouth: 'flat', arm: 0.5, hop: tr.hop, squash: 0.05 + 0.04 * Math.sin(a * 9), T, wind: 0.25 };
  let w = a >= 5.25 ? { kind: 'sword', th: 74, f: FWD_H, grow: sm(5.25, 5.5, a), glow: 0 } : null, face = 'x';
  if (a < 1.3) { st.eyes = a < 0.5 ? 'open' : a < 0.95 ? 'open' : 'fierce'; st.look = a < 0.5 ? [0, 0] : [2, -1]; st.mouth = a > 0.55 && a < 1.0 ? 'o' : 'flat'; }
  else if (a < 2.3) { st.arm = 0.7; st.squash = 0.08 + 0.05 * Math.sin(a * 12); }
  else if (a < 2.55) { st.arm = 1; st.mouth = 'grit'; }
  else if (a < 2.9) { st.arm = 1; st.eyes = a < 2.7 ? 'closed' : 'fierce'; st.mouth = 'grit'; st.squash = 0.2 * (1 - (a - 2.55) / 0.35); st.wind = 0.8; }
  else if (a < 3.05) { st.squash = 0.24 * sm(2.9, 3.05, a); st.arm = 0.1; st.mouth = 'grit'; }
  else if (a < 3.25) { st.squash = -0.2; st.arm = 0.6; st.punch = sm(3.08, 3.25, a); st.mouth = 'grit'; st.wind = 1; }
  else if (a < 3.9) { st.punch = 1 - sm(3.35, 3.65, a); st.mouth = a > 3.5 ? 'smile' : 'grit'; st.arm = 0.6; }
  else if (a < 4.8) { st.look = a < 4.2 ? [0, -2] : [1, 1]; st.eyes = 'open'; st.mouth = a > 4.4 ? 'o' : 'flat'; }
  else if (a < 5.25) { st.look = [1, 1]; st.mouth = 'grit'; st.wind = 1; st.arm = 0.9; st.squash = a < 4.9 ? 0.18 : -0.15; }
  else if (a < 5.85) { const u = clamp((a - 5.45) / 0.4, 0, 1); w.th = 74 + 70 * Math.sin(u * Math.PI); w.glow = 1 - sm(5.5, 5.85, a); st.mouth = 'smile'; st.eyes = 'open'; st.look = [1, -1]; st.squash = a < 5.35 ? 0.2 * (1 - (a - 5.25) / 0.1) : 0.05; }
  else if (a < 6.1) { st.mouth = 'flat'; }
  else if (a < 6.3) { w.th = lerp(74, 150, sm(6.1, 6.28, a)); st.mouth = 'grit'; st.wind = 0.8; }
  else if (a < 6.47) { w.th = lerp(150, -25, eIn((a - 6.3) / 0.15)); st.mouth = 'grit'; st.wind = 1; }
  else if (a < 6.85) { w.th = lerp(-25, 150, sm(6.5, 6.82, a)); st.eyes = a < 6.62 ? 'open' : 'fierce'; st.mouth = a < 6.62 ? 'o' : 'grit'; }
  else if (a < 7.05) { w.th = lerp(150, -25, eIn((a - 6.85) / 0.2)); st.mouth = 'grit'; st.wind = 1; }
  else if (a < 7.6) { w.th = lerp(-25, 74, sm(7.15, 7.55, a)); st.mouth = 'smile'; }
  else if (a < 9.0) { st.look = a > 8.1 ? [2, -1] : [1, -1]; st.mouth = a > 8.3 ? 'o' : 'flat'; st.eyes = a > 8.3 ? 'open' : 'fierce'; }
  else if (a < 9.4) { w.th = lerp(60, 105, sm(9.0, 9.15, a)); st.eyes = 'open'; st.mouth = 'o'; st.wind = 0.9; st.squash = a < 9.1 ? 0.16 : -0.12; }
  else if (a < 9.7) { w.th = 120; st.eyes = 'closed'; st.mouth = 'grit'; st.squash = 0.12; st.wind = 1; }
  else if (a < 10.0) { w.th = lerp(120, 70, sm(9.7, 9.95, a)); st.mouth = 'grit'; }
  else if (a < 10.35) { w.th = a < 10.2 ? lerp(70, 130, sm(10.0, 10.2, a)) : lerp(130, 35, eIn((a - 10.2) / 0.15)); st.mouth = 'grit'; st.squash = -0.14; st.wind = 1; }
  else if (a < 11.25) { w.th = 35 + Math.sin(a * 40) * 2; st.mouth = 'grit'; st.squash = 0.1 + 0.04 * Math.sin(a * 31); st.wind = 0.6; }
  else if (a < 11.6) { w.th = lerp(35, 100, sm(11.25, 11.5, a)); st.eyes = 'closed'; st.mouth = 'o'; st.wind = 1; }
  else if (a < 12.1) { const u = sm(11.6, 12.0, a); w.th = lerp(100, 210, u); w.glow = u; st.squash = 0.15 * u; st.mouth = 'grit'; st.wind = 0.5 + 0.5 * u; }
  else if (a < 12.85) { const u = (a - 12.1) / 0.75, phi = -Math.PI / 4 + u * 4 * Math.PI; w = { kind: 'sword', flat: phi, glow: 1, f: FWD_H }; const d = [Math.cos(phi), Math.sin(phi)], fc = faceForDir(d);
    face = fc || 'x'; st.noFace = !fc; st.hop = Math.sin(u * Math.PI) * 4; st.wind = 1; st.mouth = 'grit'; st.squash = -0.06; }
  else if (a < 13.3) { w.th = lerp(0, 80, sm(12.85, 13.1, a)); w.glow = 1 - sm(13.0, 13.3, a); st.mouth = 'smile'; st.squash = 0.15 * Math.sin(clamp((a - 12.85) / 0.2, 0, 1) * Math.PI); }
  else { w.th = 74; st.look = a > 13.8 ? [2, -1] : [1, -1]; st.mouth = a > 13.85 ? 'o' : 'flat'; st.eyes = a > 13.85 ? 'open' : 'fierce'; }
  return { x, y, s, st, w, face };
}
function alterAt(a, T) {
  const tr = track(AKS, a), s = tr.s * SPREAD + lockD(a), [x, y] = pos(s, tr.p);
  const st = { eyes: 'fierce', look: [-1, -1], mouth: 'smirk', arm: 0.5, hop: tr.hop, squash: 0.05 + 0.04 * Math.sin(a * 9 + 2), T: T + 0.7, wind: 0.25 };
  let show = true, tear = 0, fringe = 1, w = null;
  if (a < 0.45) show = false;
  else if (a < 1.3) { tear = 1.6 * (1 - sm(0.45, 1.25, a)); show = a > 0.8 || hash(Math.floor(a * 40), 3, 3) > 0.4; st.eyes = a < 1.0 ? 'closed' : 'fierce'; st.mouth = a < 1.1 ? 'flat' : 'smirk'; fringe = 1 + Math.round(tear * 2); }
  else if (a < 2.0) { st.squash = 0.08 + 0.05 * Math.sin(a * 12 + 1); }
  else if (a < 2.3) { st.squash = 0.22 * sm(2.0, 2.3, a); st.mouth = 'grit'; st.arm = 0.2; }
  else if (a < 2.55) { st.squash = -0.2; st.punch = sm(2.38, 2.55, a); st.mouth = 'grit'; st.wind = 1; }
  else if (a < 2.9) { st.punch = 1 - sm(2.6, 2.85, a); st.mouth = 'smirk'; }
  else if (a < 3.25) { st.mouth = 'o'; st.look = [-2, 0]; }
  else if (a < 3.7) { const u = (a - 3.25) / 0.45; st.eyes = u < 0.6 ? 'closed' : 'fierce'; st.mouth = 'o'; st.squash = u < 0.25 ? 0.28 : 0.05; tear = 0.9 * (1 - u); st.wind = 0.8; }
  else if (a < 3.9) { st.squash = 0.06 * Math.sin(a * 40); st.mouth = 'grit'; }
  else if (a < 4.8) { st.look = a < 4.2 ? [0, -2] : [-1, 1]; st.mouth = 'o'; }
  else if (a < 5.5) { st.mouth = a < 5.25 ? 'grit' : 'o'; st.wind = a < 5.2 ? 1 : 0.4; st.look = [-1, 1]; }
  else if (a < 6.3) { st.mouth = 'flat'; }
  else if (a < 6.6) { show = !(a > 6.30 && a < 6.36); tear = a < 6.36 ? 1.2 : 1.2 * (1 - sm(6.36, 6.6, a)); fringe = 2; st.mouth = 'smirk'; }
  else if (a < 6.85) { st.mouth = 'smirk'; st.squash = 0.06 * Math.sin(a * 30); }
  else if (a < 7.05) { st.mouth = 'o'; }
  else if (a < 7.5) { const u = (a - 7.05) / 0.45; st.eyes = 'closed'; st.mouth = 'o'; st.squash = u < 0.3 ? 0.3 : 0.1; tear = 1 - u * 0.7; st.wind = 0.9; }
  else if (a < 8.0) { st.eyes = a < 7.75 ? 'closed' : 'fierce'; st.mouth = a < 7.75 ? 'o' : 'grit'; st.squash = 0.15 * (1 - sm(7.5, 7.9, a)); tear = 0.3 + 0.3 * sm(7.8, 8.0, a); }
  else if (a < 8.55) { st.arm = 0.4 + 0.6 * sm(8.0, 8.3, a); st.mouth = 'smirk'; st.look = [-1, 1]; tear = 0.35; }
  if (a >= 8.55 && a < 13.5) {
    w = { kind: a < 12.4 ? 'axe' : 'handle', th: 70, f: FWD_A, glow: 0 };
    if (a < 8.6) w.th = 70;
    else if (a < 9.0) { w.th = lerp(70, 150, sm(8.6, 8.95, a)); w.glow = sm(8.6, 9.0, a); st.mouth = 'grit'; }
    else if (a < 9.3) { w.th = lerp(150, 165, sm(9.0, 9.3, a)); w.glow = 1; st.squash = -0.1; st.wind = 1; st.mouth = 'grit'; }
    else if (a < 9.4) { w.th = lerp(165, -30, eIn((a - 9.3) / 0.1)); w.glow = 1; st.mouth = 'grit'; st.wind = 1; }
    else if (a < 9.6) { w.th = -30; st.squash = 0.2; st.mouth = 'smirk'; }
    else if (a < 10.0) { w.th = lerp(-30, 100, eIn((a - 9.6) / 0.4)); st.mouth = 'grit'; st.squash = 0.12 + 0.03 * Math.sin(a * 50); }
    else if (a < 10.35) { w.th = a < 10.2 ? lerp(100, 140, sm(10.0, 10.2, a)) : lerp(140, 40, eIn((a - 10.2) / 0.15)); st.mouth = 'grit'; st.squash = -0.14; st.wind = 1; }
    else if (a < 11.25) { w.th = 40 + Math.sin(a * 37) * 2; st.mouth = 'grit'; st.squash = 0.1 + 0.04 * Math.sin(a * 29); st.wind = 0.6; }
    else if (a < 11.6) { w.th = lerp(40, 110, sm(11.25, 11.5, a)); st.eyes = 'closed'; st.mouth = 'o'; st.wind = 1; }
    else if (a < 11.95) { w.th = 110; st.mouth = 'grit'; st.squash = 0.12; }
    else if (a < 12.3) { w.th = lerp(110, 150, sm(11.95, 12.25, a)); w.glow = 1; st.mouth = 'grit'; st.wind = 1; st.squash = -0.12; }
    else if (a < 12.4) { w.th = lerp(150, 0, eIn((a - 12.3) / 0.1)); w.glow = 1; st.mouth = 'grit'; st.wind = 1; }
    else if (a < 12.9) { const u = (a - 12.4) / 0.5; w.th = 60; st.eyes = u < 0.7 ? 'closed' : 'fierce'; st.mouth = 'o'; st.squash = u < 0.25 ? 0.3 : 0.08; tear = 0.9 * (1 - u); st.wind = 1; }
    else { w.th = lerp(60, -10, sm(12.9, 13.15, a)); st.look = [0, 2]; st.mouth = 'o'; st.eyes = 'fierce'; }
  }
  if (a >= 13.5) {
    st.look = a < 13.75 ? [0, 2] : [-1, -1]; st.mouth = a < 13.75 ? 'flat' : a < 13.95 ? 'grit' : 'smirk'; st.arm = 0.3;
    if (a > 13.75) { st.squash = 0.08 * Math.sin(a * 30); tear = 0.15 + (hash(Math.floor(a * 15), 6, 6) > 0.7 ? 0.4 : 0) + 0.3 * sm(14.0, 14.35, a); fringe = 1 + Math.round(3 * sm(13.9, 14.35, a)); }
  }
  return { x, y, s, st, w, face: 'y', show, tear, fringe };
}
const geomOf = (f) => f && f.w ? weaponGeom(f.x, f.y, 3 + (f.st.hop || 0), 13 * (1 - (f.st.squash || 0)), f.w) : null;

// ---------------- low-res world ----------------
const TILES = (() => { const c0 = [Math.floor(SLAM[0] / 8), Math.floor(SLAM[1] / 8)], out = [];
  for (const [di, dj] of [[0, 0], [1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [-1, -1], [2, 0], [0, 2], [-1, 1]]) { const i = c0[0] + di, j = c0[1] + dj, d = Math.hypot(di, dj);
    out.push({ x: i * 8, y: j * 8, delay: d * 0.03, vz: 34 + hash(i, j, 1) * 22 - d * 4 }); }
  return out; })();
const tileZ = (t, a) => { const u = a - 9.4 - t.delay; if (u <= 0) return 0; const z = t.vz * u - 95 * u * u; return z > 0 ? z : 0; };
function arenaTop(a, T) {
  const line = hex('2c3a66'), lineB = hex('3a2a70'), mag = hex('ff3ab0'), vio = hex('b04fff'), hole = hex('0b0814');
  const up = TILES.filter(t => tileZ(t, a) > 0.01), age = a - 9.4;
  return (x, y) => {
    for (const t of up) if (x >= t.x && x < t.x + 8 && y >= t.y && y < t.y + 8) return [...hole, 0];
    const n = fbm(x * 0.05, y * 0.05, 3, 3); let c = n > 0.56 ? ICOL.topL : n < 0.37 ? ICOL.topD : ICOL.top;
    const gx = ((x % 8) + 8) % 8, gy = ((y % 8) + 8) % 8, on = gx < 0.5 || gy < 0.5;
    if (on) c = (Math.floor(x / 8) + Math.floor(y / 8)) & 1 ? line : lineB;
    const dc = Math.hypot(x - MID, y - MID), ang = Math.atan2(y - MID, x - MID);
    if (Math.abs(dc - 24) < 0.7) c = mag; else if (Math.abs(dc - 16) < 0.45 && Math.sin(ang * 8 + T * 2) > -0.3) c = vio; else if (dc < 23 && dc > 17 && Math.abs(Math.sin(ang * 4)) < 0.06) c = vio;
    const sweep = ((x + y - T * 70) % 180 + 180) % 180; if (on && sweep < 8) c = sweep < 3 ? mag : vio;
    for (const [a0, rx, ry, ci] of RIP) { const dt = a - a0; if (dt < 0 || dt > 0.75) continue; const d = Math.hypot(x - rx, y - ry), r = dt * 150, w = Math.max(0, 1 - Math.abs(d - r) / 7) * (1 - dt / 0.75);
      if (w > 0.15 && on) c = RGBC[ci]; else if (w > 0.55) c = mix(c, RGBC[ci], 0.45); }
    if (age > 0) {   // the axe crater and its cracks (hot magenta, cooling to violet)
      const d = Math.hypot(x - SLAM[0], y - SLAM[1]), an = Math.atan2(y - SLAM[1], x - SLAM[0]), k = Math.floor((an + Math.PI) / (2 * Math.PI) * 9);
      const ca = (k + 0.5) / 9 * 2 * Math.PI - Math.PI + (hash(k, 5, 5) - 0.5) * 0.5 + 0.09 * Math.sin(d * 0.7 + k), da = Math.abs(((an - ca + 3 * Math.PI) % (2 * Math.PI)) - Math.PI);
      const L = 10 + hash(k, 6, 6) * 20, hot = 1 - sm(0.2, 1.4, age);
      if (d < 3.2) c = hole; else if (d < L && da * d < 0.75 * (1 - d / L) + 0.25) c = hot > 0.5 ? (d < L * 0.5 ? hex('ffffff') : mag) : hot > 0.1 ? mag : vio;
    }
    return [...c, 6];
  };
}
function tilesW(B, a, items) {
  for (const t of TILES) { const z = tileZ(t, a); if (z <= 0.01) continue; items.push({ d: t.x + t.y + 8, f: () => { box(B, t.x + 0.5, t.y + 0.5, z - 2, 7, 7, 2, hex('1e2a4a'), hex('2a1d3d'), hex('1c1430'));
    const p = P(t.x + 0.5, t.y + 7.5, z), q = P(t.x + 7.5, t.y + 7.5, z), r = P(t.x + 7.5, t.y + 0.5, z); B.line(p[0], p[1], q[0], q[1], hex('ff3ab0')); B.line(q[0], q[1], r[0], r[1], hex('b04fff')); } }); }
}
function riftW(B, a) {
  const o = sm(8.0, 8.2, a) * (1 - sm(8.6, 8.9, a)); if (o <= 0) return; const c = P(RIFT[0], RIFT[1], 0), k = ISO.k, r = 9 * o * k;
  B.ellipse(c[0], c[1], r * 1.25, r * 0.6, hex('ff3ab0')); B.ellipse(c[0], c[1], r * 1.05, r * 0.48, hex('0b0814'));
  for (let q = 0; q < 22; q++) { const an = q / 22 * 6.283, j = 1 + (hash(q, Math.floor(a * 20), 2) - 0.5) * 0.35; B.put(c[0] + Math.cos(an) * r * 1.3 * j, c[1] + Math.sin(an) * r * 0.62 * j, q % 3 ? hex('ff3ab0') : hex('2af0ff')); }
}
// the axe rising out of the rift, then flying into the alter ego's hand
function riftAxeW(B, a, A, G, items) {
  if (a < 8.1 || a >= 8.55) return; const top = [RIFT[0], RIFT[1], lerp(-14, 6, eOut((a - 8.1) / 0.3))];
  let grip = top, dir = [0, 0, 1];
  if (a > 8.4) { const tgt = weaponGeom(A.x, A.y, 3, 13, { kind: 'axe', th: 70, f: FWD_A }), u = eIn((a - 8.4) / 0.15); grip = [lerp(top[0], tgt.grip[0], u), lerp(top[1], tgt.grip[1], u), lerp(top[2], tgt.grip[2], u) + Math.sin(u * Math.PI) * 6]; dir = V3.norm([lerp(0, tgt.dir[0], u), lerp(0, tgt.dir[1], u), lerp(1, tgt.dir[2], u)]); }
  items.push({ d: grip[0] + grip[1], f: () => freeWeapon(B, 'axe', grip, dir, FWD_A, G) });
}
// the broken handle, dropped
function stubW(B, a, A, G, items) {
  if (a < 13.5) return; const g0 = weaponGeom(A.x, A.y, 3, 13, { kind: 'handle', th: -10, f: FWD_A }), u = clamp((a - 13.5) / 0.25, 0, 1);
  const grip = [g0.grip[0] + FWD_A[0] * 3 * u, g0.grip[1] + FWD_A[1] * 3 * u, Math.max(0.6, lerp(g0.grip[2], 0.6, u * u))], dir = V3.norm([FWD_A[0], FWD_A[1], lerp(-0.2, 0, u)]);
  items.push({ d: grip[0] + grip[1] + 2, f: () => freeWeapon(B, 'handle', grip, dir, FWD_A, G) });
}
// axe shards: burst at the shatter, bounce to rest, then (the hook) stream back into the alter ego
let SHARDS = null;
function shardsW(B, a, A) {
  if (a < 12.4) return;
  if (!SHARDS) { const al = alterAt(12.4, 0), g = geomOf(al), head = V3.add(g.tip, V3.sc(g.u, 3)); SHARDS = [];
    for (let q = 0; q < 20; q++) { const an = hash(q, 1, 9) * 6.283, sp = 18 + hash(q, 2, 9) * 30; let p = head.slice(), v = [Math.cos(an) * sp, Math.sin(an) * sp, 12 + hash(q, 3, 9) * 26], path = [];
      for (let i = 0; i < 160; i++) { v[2] -= 90 / 60; p = V3.add(p, V3.sc(v, 1 / 60)); if (p[2] < 0) { p[2] = 0; v = [v[0] * 0.5, v[1] * 0.5, -v[2] * 0.3]; } path.push(p.slice()); }
      SHARDS.push({ path, col: q % 4 === 0 ? hex('2af0ff') : q % 2 ? hex('ff3ab0') : hex('5a4590'), s: 1 + (q % 3) }); } }
  const k = ISO.k / 1.4, i = Math.min(159, Math.floor((a - 12.4) * 60)), pull = sm(13.8, 14.3, a), ac = [A.x, A.y, 10];
  SHARDS.forEach((sh, q) => { let p = sh.path[i]; const u = clamp(pull * 1.4 - hash(q, 4, 9) * 0.4, 0, 1); if (u > 0) p = [lerp(p[0], ac[0], eIn(u)), lerp(p[1], ac[1], eIn(u)), lerp(p[2], ac[2], eIn(u)) + Math.sin(u * Math.PI) * 10];
    if (u >= 0.98) return; const s = P(...p), sz = Math.max(1, Math.round(sh.s * k)); B.rect(Math.round(s[0]), Math.round(s[1]), sz, sz, sh.col); if (u > 0) B.put(s[0] - 1, s[1] + 1, hex('ffffff')); });
}
function motesAt(B, c, a, a0, a1, cols, n = 30, R = 10) {
  const pw = sm(a0, a0 + 0.3, a) * (1 - sm(a1 - 0.15, a1, a)); if (pw <= 0) return;
  for (let q = 0; q < n; q++) { if (hash(q, 3, 3) > pw) continue; const ph = ((a * (0.9 + hash(q, 1, 1)) + hash(q, 2, 2)) % 1), an = hash(q, 4, 4) * 6.283, r = R + hash(q, 5, 5) * 6;
    const p = P(c[0] + Math.cos(an) * r, c[1] + Math.sin(an) * r, ph * 30); B.put(p[0], p[1], cols[0]); if (ph < 0.35) { B.put(p[0], p[1] - 1, cols[1]); B.put(p[0] + 1, p[1], cols[1]); } }
}
function drawArena(B, a, T) {
  rocksW(B, T, false);
  drawIslandW(B, { T: 16, N: NI, mask: MASK8, depth: DEPTH8, cols: ICOL, topFn: arenaTop(a, T) });
  riftW(B, a);
  const H = heroAt(a, T), A = alterAt(a, T), G = Math.max(1, Math.round(ISO.k / 1.4)), items = [];
  if (a > 3.9 && a < 5.25) { const z = orbZ(a), sp = P(ORB[0], ORB[1], 0), r = clamp(8 - z * 0.06, 2, 8) * ISO.k; B.ellipse(sp[0], sp[1], r, r * 0.45, hex('0b0814')); }
  for (const [x, y, ci, h] of PYLONS) items.push({ d: x + y, f: () => pylonW(B, x, y, ci, h, T) });
  // afterimages behind the dashers
  const ghost = (fn, a0, a1, tints, face, Cc, k) => { if (a < a0 || a > a1) return; for (let g = 3; g >= 1; g--) { const ga = a - g * 0.035; if (ga < a0) continue; const s = fn(ga, T); items.push({ d: s.x + s.y - 0.1, f: () => fighterFX(B, s.x, s.y, 0, Object.assign({}, s.st, { wpn: s.w }), Cc, s.face, { ghost: true, tint: tints[g - 1], tintK: k }) }); } };
  ghost(alterAt, 2.32, 2.6, RGBC, 'y', ALTER, 0.75); ghost(alterAt, 9.0, 9.45, RGBC, 'y', ALTER, 0.75); ghost(alterAt, 10.05, 10.4, RGBC, 'y', ALTER, 0.75); ghost(alterAt, 11.97, 12.42, RGBC, 'y', ALTER, 0.75);
  const warm = [hex('ffd9c2'), hex('d97757'), hex('d97757')];
  ghost(heroAt, 3.08, 3.3, warm, 'x', HEROC, 0.6); ghost(heroAt, 6.12, 6.5, warm, 'x', HEROC, 0.6); ghost(heroAt, 9.12, 9.42, warm, 'x', HEROC, 0.6); ghost(heroAt, 10.05, 10.4, warm, 'x', HEROC, 0.6);
  items.push({ d: H.x + H.y, f: () => { H.r = fighterFX(B, H.x, H.y, 0, Object.assign({}, H.st, { wpn: H.w }), HEROC, H.face, {}); } });
  if (A.show) items.push({ d: A.x + A.y, f: () => { A.r = fighterFX(B, A.x, A.y, 0, Object.assign({}, A.st, { wpn: A.w }), ALTER, 'y', { fringe: A.fringe, tear: A.tear, seed: Math.floor(a * 30) }); } });
  if (a > 13.95) for (let k = 0; k < 3; k++) { const off = eOut((a - 13.95) / 0.4), pp = pos(A.s + [3, 11, 6][k] * off, [-13, -3, 7][k] * off); items.push({ d: A.x + A.y - 0.5, f: () => fighterFX(B, pp[0], pp[1], 0, Object.assign({}, A.st, { shadow: false }), ALTER, 'y', { ghost: true, tint: RGBC[k], tintK: 0.7 }) }); }
  riftAxeW(B, a, A, G, items); stubW(B, a, A, G, items); tilesW(B, a, items);
  items.sort((p, q) => p.d - q.d).forEach(it => it.f());
  rocksW(B, T, true);
  shardsW(B, a, A);
  motesAt(B, [H.x, H.y], a, 11.6, 12.15, [hex('ffd9c2'), hex('f2a585')], 36, 11);
  motesAt(B, [A.x, A.y], a, 8.6, 9.35, [hex('ff3ab0'), hex('b04fff')], 26, 11);
  motesAt(B, [A.x, A.y], a, 13.75, 14.4, [hex('ff3ab0'), hex('2af0ff')], 30, 12);
  HITS.forEach(([h], i) => sparksW(B, P(...HITPT[i]), h, a, i * 13 + 1, [16, 20, 24, 30, 34, 30][i]));
  if (a > 10.4 && a < 11.25) { const ph = Math.floor(a * 14); sparksW(B, P(...HITPT[4]), ph / 14, a, ph * 7 + 3, 10); }
  return { H, A };
}
function orbZ(a) { return a < 4.5 ? lerp(140, 12, eOut((a - 3.9) / 0.6)) : 12 + Math.sin((a - 4.5) * 6) * 1.5; }

// ---------------- hi-res layers ----------------
const SWORD_ICON = ['........##', '.......###', '......###.', '.#...###..', '..#.###...', '...###....', '...##.....', '..#..#....', '.#........', '#.........'];
function orbHi(F, a, T) {
  if (a < 3.85 || a > 5.6) return; const z = orbZ(a), c = HX(P(ORB[0], ORB[1], z)), k = CAM.z / 2, got = a >= 5.25, ga = clamp((a - 5.25) / 0.35, 0, 1);
  F.save(); F.globalCompositeOperation = 'lighter';
  const bm = sm(3.85, 4.0, a) * (1 - sm(4.45, 4.8, a)); if (bm > 0) { const g = F.createLinearGradient(c[0] - 50, 0, c[0] + 50, 0); g.addColorStop(0, 'rgba(255,200,170,0)'); g.addColorStop(0.5, `rgba(255,230,210,${0.55 * bm})`); g.addColorStop(1, 'rgba(255,200,170,0)'); F.fillStyle = g; F.fillRect(c[0] - 50, 0, 100, c[1]); }
  if (!got) { const r = 50 * k * (1 + 0.06 * Math.sin(T * 9)); let g = F.createRadialGradient(c[0], c[1], 0, c[0], c[1], r * 3); g.addColorStop(0, 'rgba(255,190,150,0.55)'); g.addColorStop(1, 'rgba(255,120,90,0)'); F.fillStyle = g; F.fillRect(c[0] - r * 3, c[1] - r * 3, r * 6, r * 6);
    F.restore(); F.save(); g = F.createRadialGradient(c[0] - r * 0.3, c[1] - r * 0.35, r * 0.1, c[0], c[1], r); g.addColorStop(0, 'rgba(255,250,240,0.95)'); g.addColorStop(0.6, 'rgba(255,170,130,0.85)'); g.addColorStop(1, 'rgba(217,119,87,0.9)'); F.fillStyle = g; F.beginPath(); F.arc(c[0], c[1], r, 0, 7); F.fill();
    F.strokeStyle = 'rgba(255,255,255,0.9)'; F.lineWidth = 3; F.beginPath(); F.arc(c[0], c[1], r + 6, T * 3, T * 3 + 4.2); F.stroke();
    const px = Math.max(4, Math.round(6 * k)); F.fillStyle = '#6e2a1a'; SWORD_ICON.forEach((row, j) => { for (let i = 0; i < row.length; i++) if (row[i] === '#') F.fillRect(Math.round(c[0] - 5 * px + i * px), Math.round(c[1] - 5 * px + j * px), px, px); });
  } else { const r = 40 * k * (1 + ga * 3); F.strokeStyle = `rgba(255,220,190,${1 - ga})`; F.lineWidth = 10 * (1 - ga) + 2; F.beginPath(); F.arc(c[0], c[1], r, 0, 7); F.stroke();
    for (let q = 0; q < 12; q++) { const an = q / 12 * 6.283 + 0.26, r0 = r * 1.15, r1 = r * 1.45; F.beginPath(); F.moveTo(c[0] + Math.cos(an) * r0, c[1] + Math.sin(an) * r0); F.lineTo(c[0] + Math.cos(an) * r1, c[1] + Math.sin(an) * r1); F.stroke(); } }
  F.restore();
}
function popLabel(F, text, wp, a0, a, col, px = 7, dur = 1.0) {
  const u = (a - a0) / dur; if (u < 0 || u > 1) return; const c = HX(P(...wp)), hw = textW(text, px) / 2 + 50; c[0] = clamp(c[0], hw, FW - hw); const s = 1 + 0.6 * (1 - eOut(u / 0.15)), al = 1 - sm(0.75, 1, u), y = c[1] - 40 * u;
  F.save(); F.translate(c[0], y); F.scale(s, s); F.translate(-c[0], -y); rgbText(F, text, c[0], y, px, col, 4, al); F.restore();
}
function shieldHi(F, H, a) {
  const u = (a - 2.45) / 0.5; if (u < 0 || u > 1 || !H.r) return; const c = HX(H.r.center), k = CAM.z / 2, x = c[0] + 80 * k, r = 105 * k * (0.8 + 0.25 * eOut(u)), al = Math.min(1, u * 8) * (1 - sm(0.5, 1, u));
  F.save(); F.globalCompositeOperation = 'lighter'; F.translate(x, c[1]); F.scale(0.55, 1);
  F.beginPath(); for (let q = 0; q < 6; q++) { const an = q / 6 * 6.283 + Math.PI / 6; F.lineTo(Math.cos(an) * r, Math.sin(an) * r); } F.closePath();
  F.fillStyle = `rgba(255,150,110,${0.35 * al})`; F.fill(); F.strokeStyle = `rgba(255,240,225,${al})`; F.lineWidth = 10; F.stroke();
  F.lineWidth = 4; F.strokeStyle = `rgba(255,200,170,${0.6 * al})`; for (let q = 0; q < 3; q++) { const an = q / 3 * Math.PI + Math.PI / 6; F.beginPath(); F.moveTo(-Math.cos(an) * r, -Math.sin(an) * r); F.lineTo(Math.cos(an) * r, Math.sin(an) * r); F.stroke(); } F.restore();
}
function slashHi(F, a) {
  const u = (a - 7.0) / 0.3; if (u < 0 || u > 1) return; const c = HX(P(...HITPT[2])), k = CAM.z / 2, r = 120 * k, al = 1 - u;
  F.save(); F.globalCompositeOperation = 'lighter'; F.translate(c[0], c[1]); F.rotate(-0.5);
  for (const [lw, cl] of [[26, `rgba(255,150,110,${0.5 * al})`], [10, `rgba(255,250,240,${al})`]]) { F.strokeStyle = cl; F.lineWidth = lw * (1 - u * 0.6); F.lineCap = 'round'; F.beginPath(); F.arc(0, 0, r, -1.9 + u * 0.4, 0.6 + u * 0.4); F.stroke(); }
  F.restore();
}
function starBurst(F, wp, a0, a, size, col = '255,250,240', life = 0.3) {
  const u = (a - a0) / life; if (u < 0 || u > 1) return; const c = HX(P(...wp)), k = CAM.z / 2, al = 1 - u;
  F.save(); F.globalCompositeOperation = 'lighter'; F.strokeStyle = `rgba(${col},${al})`; F.lineCap = 'round';
  for (let q = 0; q < 10; q++) { const an = q / 10 * 6.283 + hash(q, 1, Math.floor(a0 * 10)) * 0.3, L = size * k * (q % 2 ? 0.55 : 1) * (0.6 + 0.6 * eOut(u)); F.lineWidth = (q % 2 ? 4 : 8) * (1 - u) + 1; F.beginPath(); F.moveTo(c[0] + Math.cos(an) * L * 0.25, c[1] + Math.sin(an) * L * 0.25); F.lineTo(c[0] + Math.cos(an) * L, c[1] + Math.sin(an) * L); F.stroke(); }
  F.restore();
}
function bolt(F, from, to, seed, col) {
  const pts = [from]; for (let q = 1; q < 8; q++) { const u = q / 8, nx = -(to[1] - from[1]), ny = to[0] - from[0], L = Math.hypot(nx, ny) || 1, o = (hash(q, seed, 4) - 0.5) * 40; pts.push([lerp(from[0], to[0], u) + nx / L * o, lerp(from[1], to[1], u) + ny / L * o]); } pts.push(to);
  F.save(); F.globalCompositeOperation = 'lighter'; for (const [lw, blur, al] of [[10, 8, 0.5], [3, 0, 1]]) { F.filter = blur ? `blur(${blur}px)` : 'none'; F.strokeStyle = `rgba(${col},${al})`; F.lineWidth = lw; F.beginPath(); pts.forEach((p, i) => i ? F.lineTo(p[0], p[1]) : F.moveTo(p[0], p[1])); F.stroke(); } F.restore();
}
function lockHi(F, a, T) {
  if (a < 10.35 || a > 11.3) return; const c = HX(P(...HITPT[4])), k = CAM.z / 2, ph = Math.floor(T * 15);
  glowAt(F, P(...HITPT[4]), 160 * k * (0.85 + 0.15 * Math.sin(T * 40)), 'rgba(255,240,255,0.45)');
  ['255,79,79', '124,255,79', '42,240,255'].forEach((col, q) => { const an = hash(q, ph, 7) * 6.283, L = (80 + hash(q, ph, 8) * 90) * k; bolt(F, c, [c[0] + Math.cos(an) * L, c[1] + Math.sin(an) * L * 0.7], ph * 3 + q, col); });
}
// motion smear behind a swinging weapon (samples the last few frames of the weapon's sweep)
function smearHi(F, fn, a, T, col, wins) {
  if (!wins.some(([p, q]) => a > p && a < q)) return; const N = 7, pts = [];
  for (let q = 0; q < N; q++) { const f = fn(a - q * 0.014, T), g = geomOf(f); if (!g) return; pts.push([HX(P(...V3.add(g.grip, V3.sc(g.dir, g.len * 0.35)))), HX(P(...g.tip))]); }
  F.save(); F.globalCompositeOperation = 'lighter';
  for (let q = 0; q + 1 < N; q++) { F.fillStyle = `rgba(${col},${0.42 * (1 - q / N)})`; F.beginPath(); F.moveTo(...pts[q][0]); F.lineTo(...pts[q][1]); F.lineTo(...pts[q + 1][1]); F.lineTo(...pts[q + 1][0]); F.closePath(); F.fill(); }
  F.restore();
}
function weaponGlow(F, r, col, k) { if (!r || !r.wGeo) return; const g = r.wGeo; for (let q = 0; q <= 4; q++) glowAt(F, P(...V3.add(g.grip, V3.sc(g.dir, 2 + g.len * q / 4))), 34 * k, `rgba(${col},0.22)`); }
function whirlHi(F, H, a) {
  if (a < 12.1 || a > 12.9 || !H.r) return; const u = (a - 12.1) / 0.75, c = HX(P(H.x, H.y, 9 + (H.st.hop || 0))), k = CAM.z / 2, R = 26 * ISO.k * SC * 1.414 / 1.0, al = Math.sin(clamp(u, 0, 1) * Math.PI);
  F.save(); F.globalCompositeOperation = 'lighter'; F.translate(c[0], c[1]); F.scale(1, 0.5);
  for (let q = 0; q < 3; q++) { const st = a * 26 + q * 2.1; F.strokeStyle = `rgba(255,${180 + q * 25},${140 + q * 30},${0.45 * al})`; F.lineWidth = (16 - q * 4) * k; F.beginPath(); F.arc(0, 0, R * (0.75 + q * 0.12), st, st + 2.6); F.stroke(); }
  F.restore();
}
function riftHi(F, a) { const o = sm(8.0, 8.2, a) * (1 - sm(8.6, 8.9, a)); if (o <= 0) return; glowAt(F, P(RIFT[0], RIFT[1], 2), 200 * o * CAM.z / 2, 'rgba(255,58,176,0.45)'); F.save(); F.globalCompositeOperation = 'lighter'; const c = HX(P(RIFT[0], RIFT[1], 0)); const g = F.createLinearGradient(0, c[1] - 260, 0, c[1]); g.addColorStop(0, 'rgba(255,58,176,0)'); g.addColorStop(1, `rgba(255,58,176,${0.35 * o})`); F.fillStyle = g; F.fillRect(c[0] - 40 * o, c[1] - 260, 80 * o, 260); F.restore(); }
// fighting-game HUD: two health bars with a white damage-lag chunk
const DMG_H = [[2.55, 6], [9.4, 12]], DMG_A = [[3.25, 14], [7.05, 22], [12.4, 18]];
const hpAt = (list, a) => 100 - list.reduce((m, [t, d]) => m + (a >= t ? d : 0), 0);
function hud(F, a, T) {
  const al = sm(1.0, 1.4, a); if (al <= 0) return; const y = 58 - (1 - eOut((a - 1.0) / 0.4)) * 80, W = 410, Hh = 26;
  F.save(); F.globalAlpha = al;
  const bar = (x, list, col, colD, right) => {
    const hp = hpAt(list, a), lag = Math.max(hp, hpAt(list, a - 0.5) - (hpAt(list, a - 0.5) - hp) * sm(0.25, 0.5, a - (list.filter(([t]) => a >= t).pop() || [-9])[0]));
    F.fillStyle = 'rgba(6,3,16,0.8)'; F.fillRect(x - 6, y - 6, W + 12, Hh + 12); F.fillStyle = '#2a1f45'; F.fillRect(x, y, W, Hh);
    const fx = w => right ? x + W - w : x; F.fillStyle = '#fff6ea'; F.fillRect(fx(W * lag / 100), y, W * lag / 100, Hh);
    const g = F.createLinearGradient(0, y, 0, y + Hh); g.addColorStop(0, col); g.addColorStop(1, colD); F.fillStyle = g; F.fillRect(fx(W * hp / 100), y, W * hp / 100, Hh);
    F.fillStyle = 'rgba(255,255,255,0.35)'; F.fillRect(fx(W * hp / 100), y + 3, W * hp / 100, 4);
    for (let q = 1; q < 10; q++) { F.fillStyle = 'rgba(6,3,16,0.5)'; F.fillRect(x + W * q / 10, y, 3, Hh); }
    const flash = list.some(([t]) => a >= t && a < t + 0.12); if (flash) { F.fillStyle = 'rgba(255,255,255,0.6)'; F.fillRect(x, y, W, Hh); }
  };
  bar(44, DMG_H, '#f2a585', '#c4664a', false); bar(FW - 44 - W, DMG_A, '#ff6ac8', '#b02a80', true);
  hiText(F, 'FABLE 5.2', 44, y + Hh + 16, 3, '#fff6ea', {}); const nm = 'ALTER EGO'; hiText(F, nm, FW - 44 - textW(nm, 3), y + Hh + 16, 3, '#ff6ac8', {});
  hiText(F, 'R1', FW / 2, y + 2, 4, '#fff6ea', { align: 'c' }); F.restore();
}
function slamText(F, text, t0, t1, a, px = 14) {
  if (a < t0 || a > t1) return; const s = lerp(2.4, 1, eOut((a - t0) / 0.14)), al = sm(t0, t0 + 0.1, a) * (1 - sm(t1 - 0.15, t1, a)), sp = 4 + 18 * (1 - sm(t0 + 0.08, t0 + 0.3, a));
  F.save(); F.translate(FW / 2, 400); F.scale(s, s); F.translate(-FW / 2, -400); rgbText(F, text, FW / 2, 370, px, '#fff6ea', sp, al); F.restore();
  if (a > t0 + 0.06 && a < t0 + 0.24) { F.save(); F.globalCompositeOperation = 'lighter'; F.fillStyle = `rgba(255,255,255,${0.14 * (1 - (a - t0 - 0.06) / 0.18)})`; F.fillRect(0, 0, FW, FH); F.restore(); }
}

// ---------------- camera ----------------
const CAMK = [[0, 180, 282, 1.15], [0.5, 180, 280, 1.3], [1.3, 180, 276, 1.6], [2.3, 178, 274, 1.75], [2.55, 164, 272, 2.0], [3.0, 168, 274, 1.85], [3.25, 176, 272, 2.05], [3.9, 180, 276, 1.6],
  [4.8, 176, 280, 1.7], [5.25, 170, 284, 2.0], [5.9, 178, 280, 1.8], [6.3, 192, 274, 1.85], [7.05, 220, 272, 2.05], [7.6, 222, 274, 1.75], [8.5, 230, 272, 1.75], [9.0, 214, 270, 1.6],
  [9.4, 192, 276, 1.75], [10.0, 182, 274, 1.65], [10.35, 180, 268, 2.1], [11.2, 180, 268, 2.45], [11.6, 180, 274, 1.65], [12.4, 176, 272, 1.95], [12.9, 186, 274, 1.65], [13.6, 208, 272, 1.8], [14.35, 214, 270, 2.05]];
const SHAKE = [2.0, 3.0, 3.6, 6.0, 4.5, 4.0], CHROMA = [5, 8, 9, 11, 12, 9];

// ---------------- the frame ----------------
function renderFight(F, low, T) {
  const a = actionT(T), hitR = HITS.map((_, i) => realHit(i));
  RIP = HITS.map(([h], i) => [h, HITPT[i][0], HITPT[i][1], [0, 2, 1, 0, 2, 1][i]]);
  RINGG = sm(13.6, 13.8, a) * (0.6 + 0.4 * (hash(Math.floor(T * 12), 9, 9) > 0.5 ? 1 : 0));
  const k0 = keyedSmooth(CAMK, a), k = [180 + (k0[0] - 180) * SPREAD, k0[1], k0[2] * 0.92], shake = HITS.reduce((m, [h], i) => { const d = a - h; return d >= 0 && d < 0.35 ? m + (1 - d / 0.35) * SHAKE[i] : m; }, 0) + (a > 10.35 && a < 11.25 ? 0.6 : 0);
  CAM.cx = k[0] + Math.sin(T * 61) * shake + Math.sin(T * 0.8) * 0.6; CAM.cy = k[1] + Math.cos(T * 47) * shake * 0.6 + Math.sin(T * 0.6) * 0.5; CAM.z = k[2]; REF.oy = 196 + Math.sin(T * 1.5) * 1.2; applyCam();
  const B = new PBuf(PAL, 18); const W = drawArena(B, a, T); low.getContext('2d').clearRect(0, 0, LW, LH); B.toCanvas(low);
  F.setTransform(1, 0, 0, 1, 0, 0); F.filter = 'none'; F.globalAlpha = 1; F.globalCompositeOperation = 'source-over';
  skyGrid(F, T, a); pixelUp(F, low); neonEdges(F, T, a); pylonGlow(F, T);
  const H = W.H, A = W.A, kz = CAM.z / 2;
  if (H.r) floorGlow(F, H.r.foot, 200 * kz, 'rgba(255,130,90,0.22)');
  if (A.show && A.r) { floorGlow(F, A.r.foot, 200 * kz, 'rgba(255,58,176,0.26)'); glowAt(F, A.r.center, 150 * kz, 'rgba(255,58,176,0.16)'); for (const e of A.r.eyes) glowAt(F, e, (a > 13.75 ? 110 : 60) * kz, `rgba(255,42,109,${a > 13.75 ? 0.85 : 0.6})`); }
  if (H.w) weaponGlow(F, H.r, '255,170,130', kz * (H.w.glow ? 1.8 : 1)); if (A.w && A.w.kind === 'axe') weaponGlow(F, A.r, '255,58,176', kz * (A.w.glow ? 1.6 : 0.8));
  riftHi(F, a); orbHi(F, a, T); whirlHi(F, H, a);
  smearHi(F, heroAt, a, T, '255,190,150', [[6.3, 6.48], [6.86, 7.08], [10.21, 10.37], [12.1, 12.86]]);
  smearHi(F, alterAt, a, T, '255,58,176', [[9.3, 9.42], [10.21, 10.37], [12.3, 12.42]]);
  shieldHi(F, H, a); slashHi(F, a); lockHi(F, a, T);
  HITS.forEach(([h], i) => { const d = a - h; if (d >= -0.001 && d < 0.25) glowAt(F, P(...HITPT[i]), [150, 170, 200, 260, 260, 220][i] * kz * (1 - d / 0.25 * 0.4), `rgba(255,250,235,${0.5 * (1 - d / 0.25)})`); starBurst(F, HITPT[i], h, a, [110, 130, 150, 160, 220, 180][i]); });
  shockRing(F, HITPT[0][0], HITPT[0][1], 2.55, a, [255, 150, 110], 22, 0);
  shockRing(F, HITPT[1][0], HITPT[1][1], 3.25, a, [255, 79, 79], 34, -8); shockRing(F, HITPT[1][0], HITPT[1][1], 3.25, a, [42, 240, 255], 34, 8);
  shockRing(F, HITPT[2][0], HITPT[2][1], 7.05, a, [255, 190, 150], 36, 0);
  [[255, 79, 79], [124, 255, 79], [42, 240, 255]].forEach((c, i) => shockRing(F, SLAM[0], SLAM[1], 9.4 + i * 0.06, a, c, 64, 0, 0.6)); shockRing(F, SLAM[0], SLAM[1], 9.4, a, [255, 58, 176], 30, 0, 0.35);
  shockRing(F, HITPT[4][0], HITPT[4][1], 11.25, a, [255, 240, 255], 50, 0, 0.45);
  [[255, 79, 79], [124, 255, 79], [42, 240, 255]].forEach((c, i) => shockRing(F, HITPT[5][0], HITPT[5][1], 12.4 + i * 0.05, a, c, 44, 0, 0.5));
  for (const [a0, a1, fn, dirS, col, seed] of [[2.3, 2.56, alterAt, -1, [255, 58, 176], 3], [3.08, 3.26, heroAt, 1, [255, 200, 160], 9], [9.0, 9.4, alterAt, -1, [255, 58, 176], 5], [10.05, 10.36, heroAt, 1, [255, 200, 160], 11], [10.05, 10.36, alterAt, -1, [255, 58, 176], 12], [11.97, 12.4, alterAt, -1, [255, 58, 176], 14]])
    if (a > a0 && a < a1) { const s = fn(a, T); speedLines(F, P(s.x, s.y, 10), dirS > 0 ? FWD_H : FWD_A, sm(a0, a0 + 0.06, a) * (1 - sm(a1 - 0.04, a1, a)), seed, col); }
  bloom(F, 0.15);
  const ca = hitR.reduce((m, rs, i) => { const d = T - rs; return d >= 0 && d < 0.4 ? Math.max(m, CHROMA[i] * (1 - d / 0.4)) : m; }, 0) + (A.show ? A.tear * 3 : 0) + (a > 0.45 && a < 1.25 ? 4 : 0) + RINGG * 3;
  chromaShift(F, ca);
  glitchBands(F, (a > 0.45 && a < 1.2 ? 0.5 : 0) + (a > 6.28 && a < 6.42 ? 0.7 : 0) + ([1, 2, 5].some(i => T - hitR[i] > 0 && T - hitR[i] < 0.16) ? 0.55 : 0) + (a > 13.8 ? 0.2 + 0.3 * (hash(Math.floor(T * 15), 5, 5) > 0.6 ? 1 : 0) : 0), Math.floor(T * 30));
  hitR.forEach(rs => { const d = T - rs; if (d >= 0 && d < 0.07) { F.save(); F.globalCompositeOperation = 'lighter'; F.fillStyle = 'rgba(255,240,255,0.1)'; F.fillRect(0, 0, FW, FH); F.restore(); } });
  scanlines(F); vignette(F, 0.6, '6,2,16');
  // words: one per beat, near the action
  const top = r => r ? [r.top[0], r.top[1], r.top[2] + 12] : [0, 0, 0];
  popLabel(F, 'BLOCK!', [...pos(-30, 0), 30], 2.55, a, '#ffd9c2', 5, 0.6);
  popLabel(F, 'SWORD!', [...pos(-8.5, 16), 34], 5.28, a, '#ffd9c2', 8, 1.1);
  popLabel(F, 'GLITCH AXE!', [...pos(55, 0), 36], 8.5, a, '#ff6ac8', 7, 1.1);
  popLabel(F, 'CLASH!', [...pos(2, 7), 42], 10.36, a, '#fff6ea', 9, 0.9);
  popLabel(F, 'AXE BROKEN!', [...pos(14, 0), 36], 12.42, a, '#ffd9c2', 7, 1.0);
  slamText(F, 'ROUND 1', 1.25, 1.85, a); slamText(F, 'FIGHT!', 1.85, 2.35, a, 16);
  hud(F, a, T);
  grain(F, 7, Math.floor(T * 30) % 7 + 1);
}
