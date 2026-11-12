'use strict';
// ------------------------------------------------------------------
// PART 3 · CHAPTER II · THE WORK   (story t 20 → 34.5  ≈ real T 24.8 → 39.3)
// It digs into the island to quarry moonstone and goes completely quiet. The Handler waits.
// Tip: every few steps, give a one-line update. Its head starts popping out with updates
// while glowing moonstone slabs fly out and extend the bridge towards the moon.
// ------------------------------------------------------------------
const CAMKEYS3 = [[20, 182, 198, 1.5], [21.2, 174, 226, 1.7], [23.0, 174, 230, 1.72], [24.0, 198, 188, 1.0], [29.0, 198, 188, 1.0], [29.6, 228, 176, 1.35], [33.8, 226, 178, 1.32], [34.6, 214, 182, 1.15]];
const HOLE = { x: 30, y: 40, r: 12 };
const PEEKS = [[29.2, 30.6, 'FOUND MOONSTONE.'], [30.8, 32.1, 'CUTTING SLABS.'], [32.3, 33.6, '4 SLABS DONE.']];
const SLABS = [[2, 29.55, 30.05], [3, 31.0, 31.5], [4, 31.4, 31.9], [5, 32.5, 33.0]];     // [index, thrown, lands]
const SWINGS = [21.4, 21.85, 22.3];                                                    // each swing lasts 0.45 s; impact at +0.42

function peekZ(t) { for (const [a, b] of PEEKS) if (t > a && t < b) return -16 + 8 * sm(a, a + 0.15, t) * (1 - sm(b - 0.15, b, t)); return null; }
function heroAt3(t) {
  const st = { eyes: 'open', look: [2, -2], mouth: 'smile', arm: 0.3, hop: 0, squash: 0, walk: null, breathe: 0, blink: 0 };
  let x = 40, y = 16, z = 0, hidden = false, clip = false;
  if (t < 20.4) { st.shine = true; }
  else if (t < 21.2) { const u = (t - 20.4) / 0.8, hu = (u * 3) % 1; x = lerp(40, HOLE.x, ease(u)); y = lerp(16, HOLE.y, ease(u)); st.hop = Math.sin(hu * Math.PI) * 5; st.squash = hu < 0.12 ? 0.12 : hu > 0.88 ? 0.1 : -0.08; st.look = [1, 1]; st.mouth = ''; }
  else if (t < 22.8) {
    x = HOLE.x; y = HOLE.y; st.look = [1, 2]; st.mouth = 'flat'; st.arm = 1;
    for (const s of SWINGS) if (t > s && t < s + 0.45) { const u = (t - s) / 0.45; st.squash = u > 0.85 ? 0.14 : -0.06 * Math.sin(u * Math.PI / 0.85); st.mouth = u > 0.85 ? 'o' : 'flat'; }
  }
  else if (t < 23.05) { const u = (t - 22.8) / 0.25; x = HOLE.x; y = HOLE.y; z = Math.sin(Math.min(1, u * 1.6) * Math.PI) * 8 - (u > 0.62 ? (u - 0.62) * 60 : 0); st.squash = u < 0.3 ? 0.15 : -0.25; st.eyes = 'wide'; st.mouth = 'o'; clip = u > 0.62; }
  else if (t < 33.6) { x = HOLE.x; y = HOLE.y; const pz = peekZ(t); if (pz === null) hidden = true; else { z = pz; clip = true; st.look = [2, -1]; st.mouth = 'smile'; st.blink = ((t * 7) % 5 < 0.25) ? 1 : 0; } }
  else if (t < 34.0) { const u = (t - 33.6) / 0.4; x = lerp(HOLE.x, HOLE.x + 6, u); y = lerp(HOLE.y, HOLE.y - 10, u); z = lerp(-16, 0, Math.min(1, u * 1.4)) + Math.sin(u * Math.PI) * 10; clip = u < 0.35; st.squash = u > 0.85 ? 0.12 : -0.1; st.eyes = 'wide'; st.mouth = 'smile'; }
  else { x = HOLE.x + 6; y = HOLE.y - 10; st.look = [2, -2]; st.shine = true; st.mouth = 'smile'; st.squash = 0.04 * Math.sin((t - 34) * 8); }
  return { x, y, z, st, hidden, clip };
}
function holeR(t) { return HOLE.r * sm(21.4, 22.75, t); }
function holeW(B, t) {
  const r = holeR(t); if (r < 0.5) return; const c = P(HOLE.x, HOLE.y, 0), rx = r * ISO.k * 1.41, ry = rx * 0.5;
  // spoil heap beside the hole
  const hp = P(HOLE.x - 16, HOLE.y + 10, 0), hh = sm(21.5, 22.8, t) * 6 * ISO.k;
  B.ellipse(hp[0], hp[1] - hh * 0.3, hh * 1.4 + 1, hh * 0.75 + 0.5, COL.dirtL); B.ellipse(hp[0] - hh * 0.2, hp[1] - hh * 0.5, hh * 0.9, hh * 0.5, COL.stone);
  B.ellipse(c[0], c[1] + 1, rx + 2, ry + 1.5, COL.dirtR); B.ellipse(c[0], c[1], rx, ry, (x, y) => mix(hex('140f22'), hex('2a1a35'), clamp((y - (c[1] - ry)) / (2 * ry), 0, 1)), 12);
  // a faint glow of moonstone deep inside once it has found some
  if (t > 29.0) { const g = 0.35 + 0.15 * Math.sin(TA * 3); B.glow(c[0] - rx, c[1] - ry, c[0] + rx, c[1] + ry, hex('c3b9e0'), (x, y) => g * Math.max(0, 1 - Math.hypot((x - c[0]) / rx, (y - c[1]) / ry) * 1.2)); }
}
function rimClipY(x, t) { const r = holeR(t), c = P(HOLE.x, HOLE.y, 0), rx = r * ISO.k * 1.41, ry = rx * 0.5, dx = (x + 0.5 - c[0]) / rx; return Math.abs(dx) >= 1 ? -1 : c[1] + ry * Math.sqrt(1 - dx * dx); }
// hero drawn into a scratch buffer, copied only above the hole's front rim (so it peeks out of the ground)
function heroClipped(B, H, t) {
  const T = new PBuf(PAL, 22); const r = heroW(T, H.x, H.y, H.z, H.st, HERO, null);
  for (let y = 0; y < LH; y++) for (let x = 0; x < LW; x++) { const i = (y * LW + x) * 4; if (!T.d[i + 3]) continue; if (y < rimClipY(x, t)) { B.d[i] = T.d[i]; B.d[i + 1] = T.d[i + 1]; B.d[i + 2] = T.d[i + 2]; B.d[i + 3] = 255; } }
  return r;
}
function pickaxeW(B, t, H) {
  if (t < 21.15 || t > 22.85 || !H.r) return;
  let a = -1.9; for (const s of SWINGS) if (t > s && t < s + 0.45) { const u = (t - s) / 0.45; a = u < 0.55 ? lerp(-0.9, -2.3, ease(u / 0.55)) : lerp(-2.3, 0.65, Math.pow((u - 0.55) / 0.45, 2)); }
  if (t < 21.4) a = lerp(0.4, -0.9, sm(21.15, 21.4, t));
  const k = ISO.k, pv = P(H.x + 9, H.y + 7, 9), L = 13 * k / 1.4 * 1.3, ex = pv[0] + Math.cos(a) * L, ey = pv[1] + Math.sin(a) * L;
  B.line(pv[0], pv[1], ex, ey, COL.trunkL); B.line(pv[0] + 1, pv[1], ex + 1, ey, COL.trunk);
  const hx = Math.cos(a + Math.PI / 2), hy = Math.sin(a + Math.PI / 2), hl = 5 * k / 1.4 * 1.3;
  B.line(ex - hx * hl, ey - hy * hl, ex + hx * hl, ey + hy * hl, COL.stoneL); B.line(ex - hx * hl + 1, ey - hy * hl + 1, ex + hx * hl + 1, ey + hy * hl + 1, COL.stoneD); B.put(ex + hx * hl, ey + hy * hl, COL.planeL);
}
function dirtW(B, t) {
  for (const s of SWINGS) { const t0 = s + 0.42, u = (t - t0) / 0.6; if (u < 0 || u > 1) continue; const c = P(HOLE.x + 3, HOLE.y, 0);
    for (let q = 0; q < 14; q++) { const vx = (hash(q, Math.round(s * 10), 1) - 0.5) * 50, vy = -30 - hash(q, Math.round(s * 10), 2) * 40; const x = c[0] + vx * u * ISO.k / 1.4, y = c[1] + (vy * u + 90 * u * u) * ISO.k / 1.4; B.put(x, y, q % 3 ? COL.dirtL : COL.stone); if (q % 4 === 0) B.put(x + 1, y, COL.dirtR); } }
  if (t > 22.98 && t < 23.6) { const u = (t - 22.98) / 0.6, c = P(HOLE.x, HOLE.y, 0); for (let q = 0; q < 12; q++) { const a = q / 12 * 6.283; B.put(c[0] + Math.cos(a) * (8 + u * 20) * ISO.k / 1.4, c[1] + Math.sin(a) * (4 + u * 9) * ISO.k / 1.4 - u * 6, u < 0.5 ? COL.stoneL : COL.dirtL); } }
}
// tumbleweed rolling across the empty island during the silence
function tumbleweedW(B, t) {
  if (t < 23.6 || t > 25.7) return; const u = (t - 23.6) / 2.1, x = lerp(-14, 112, u), z = Math.abs(Math.sin(u * Math.PI * 5)) * 5 * (1 - u * 0.4), p = P(x, 62 - u * 6, z + 4), r = 4.5 * ISO.k / 1.4 * 1.4, rot = u * 22;
  for (let q = 0; q < 9; q++) { const a = rot + q * 0.7, b = rot * 1.3 + q * 1.9; B.line(p[0] + Math.cos(a) * r, p[1] + Math.sin(a) * r * 0.9, p[0] + Math.cos(b) * r, p[1] + Math.sin(b) * r * 0.9, q % 2 ? COL.trunkL : COL.woodL); }
  const sp = P(x, 62 - u * 6, 0); B.ellipse(sp[0], sp[1] + 1, r * 0.8, r * 0.3, COL.topD);
}
// moonstone slabs: placed ones (part of the bridge) and flying ones
const MOONS = { t: hex('e9e3f5'), l: hex('c3b9e0'), r: hex('8e82b8') };
function slabBox(B, k, z = 0) { box(B, 34, -18 * k, (k - 1) * 6 + z, 12, 18, 3, MOONS.t, MOONS.l, MOONS.r); const a = P(36, -18 * k + 4, (k - 1) * 6 + 3 + z), b = P(44, -18 * k + 14, (k - 1) * 6 + 3 + z); B.line(a[0], a[1], b[0], b[1], hex('ffffff')); }
function slabsPlaced(B, t) {
  for (const [k, , land] of SLABS) if (t >= land) {
    const pulse = Math.max(0, 1 - (t - land) / 0.6), c = P(40, -18 * k + 9, (k - 1) * 6 + 2);
    B.glow(c[0] - 40, c[1] - 26, c[0] + 40, c[1] + 26, hex('c3b9e0'), (x, y) => (0.28 + 0.5 * pulse) * Math.max(0, 1 - Math.hypot((x - c[0]) / 34, (y - c[1]) / 20)));
    slabBox(B, k, -(1 - sm(land, land + 0.08, t)) * 3);
    if (pulse > 0) dustPuff(B, t, land, c, 8);
  }
}
function slabsFlying(B, t) {
  for (const [k, thrown, land] of SLABS) { if (t < thrown || t >= land) continue; const u = (t - thrown) / (land - thrown), a = [HOLE.x, HOLE.y, -4], b = [40, -18 * k + 9, (k - 1) * 6 + 2];
    const x = lerp(a[0], b[0], u), y = lerp(a[1], b[1], u), z = lerp(a[2], b[2], u) + Math.sin(u * Math.PI) * 34, sx = 9, sy = 13;
    box(B, x - sx / 2, y - sy / 2, z, sx, sy, 3, MOONS.t, MOONS.l, MOONS.r);
    for (let q = 1; q < 6; q++) { const uu = Math.max(0, u - q * 0.05), p = P(lerp(a[0], b[0], uu), lerp(a[1], b[1], uu), lerp(a[2], b[2], uu) + Math.sin(uu * Math.PI) * 34); if (q % 2) B.put(p[0], p[1], MOONS.t); } }
}
// ---------------- hi-res: drumming fingers, update bubbles ----------------
function drummingFingers(F, T) {
  if (T < 28.5 || T > 31.8) return; const inn = sm(28.5, 29.0, T) * (1 - sm(31.3, 31.8, T)), x0 = -460 + inn * 420, y0 = 560;
  F.save(); F.translate(x0, y0); F.scale(1.8, 1.8); F.filter = 'blur(0.7px)'; { const g = F.createLinearGradient(160, 120, -200, -60); g.addColorStop(0, '#6a5578'); g.addColorStop(0.5, '#3a2c48'); g.addColorStop(1, '#120c1a'); F.fillStyle = g; }
  F.beginPath(); F.roundRect(-200, -60, 260, 130, 50); F.fill();
  for (let k = 0; k < 4; k++) { const ph = T * 16 - k * 1.1, lift = Math.max(0, Math.sin(ph)) * 22; F.beginPath(); F.roundRect(40 + k * 4, -40 + k * 34 - lift * 0.2, 120 - k * 10, 28, 14); F.fill();
    F.strokeStyle = 'rgba(255,214,160,0.75)'; F.lineWidth = 3; F.beginPath(); F.arc(40 + k * 4 + 120 - k * 10 - 14, -40 + k * 34 + 14 - lift * 0.2, 13, -1.4, 1.4); F.stroke(); F.fillStyle = 'rgba(255,230,205,0.25)'; F.beginPath(); F.roundRect(40 + k * 4 + 120 - k * 10 - 20, -40 + k * 34 + 6 - lift * 0.2, 12, 14, 4); F.fill(); { const g = F.createLinearGradient(160, 120, -200, -60); g.addColorStop(0, '#6a5578'); g.addColorStop(0.5, '#3a2c48'); g.addColorStop(1, '#120c1a'); F.fillStyle = g; } }
  F.restore();
}
function updateBubbles(F, t) {
  for (const [a, b, txt] of PEEKS) {
    const al = sm(a + 0.1, a + 0.22, t) * (1 - sm(b - 0.25, b - 0.1, t)); if (al <= 0) continue;
    const head = P(HOLE.x, HOLE.y, 6), hx = head[0] * SC, hy = head[1] * SC, w = textW(txt, 6) + 56, h = 76, bx = hx + 40, by = hy - 150, s = 0.85 + 0.15 * sm(a + 0.1, a + 0.3, t);
    F.save(); F.globalAlpha = al; F.translate(bx, by); F.scale(s, s);
    F.shadowColor = 'rgba(0,0,0,0.5)'; F.shadowBlur = 18; F.shadowOffsetY = 6; F.fillStyle = '#fff6ea'; F.beginPath(); F.roundRect(0, 0, w, h, 16); F.fill(); F.shadowColor = 'transparent';
    F.beginPath(); F.moveTo(20, h - 2); F.lineTo(-10, h + 40); F.lineTo(48, h - 2); F.closePath(); F.fill();
    F.fillStyle = '#d97757'; F.beginPath(); F.arc(24, h / 2, 6, 0, 7); F.fill();
    hiText(F, txt, 42, h / 2 - 21, 6, '#2a2350', { shadow: false });
    F.restore();
  }
}
