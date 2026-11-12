'use strict';
// ------------------------------------------------------------------
// EPILOGUE · THE REPORT   (story t 66.6 → 84.8  ≈ real T 71.4 → 89.6)
// A river of jargon -> tip: write for a reader who wasn't there -> one clear card + the pencil's check mark
// -> the reveal: the moon is the Handler's desk lamp; the island floats over the desk.
// ------------------------------------------------------------------
const CAMKEYS6 = [[66.6, 500, -90, 1.6], [67.6, 506, -104, 1.72], [69.6, 498, -92, 1.5], [72.0, 498, -92, 1.5], [75.2, 502, -98, 1.62], [77.6, 502, -98, 1.62], [80.6, 330, 318, 0.35], [84.8, 330, 326, 0.335]];
const MOONSPOT = () => { const s = slabTop(13); return [s[0] + 6, s[1] - 16, s[2] + 8]; };
function heroAt6(t) {
  const st = { eyes: 'open', look: [2, -2], mouth: 'smile', arm: 0.6, hop: 0, squash: 0, walk: null, breathe: 0, blink: 0 };
  const a = slabTop(13), b = MOONSPOT(); let p = b;
  if (t < 67.6) { const u = clamp((t - 66.6) / 1.0, 0, 1); p = [lerp(a[0], b[0], ease(u)), lerp(a[1], b[1], ease(u)), lerp(a[2], b[2], ease(u))]; st.hop = Math.sin(u * Math.PI) * 9; st.squash = u > 0.9 ? 0.15 : -0.08; st.eyes = 'wide'; }
  else if (t < 72.4) { st.arm = 1; st.look = [-1, 1]; st.mouth = t > 69.6 ? 'o' : 'smile'; st.blink = (t > 71.0 && t < 71.08) ? 1 : 0; }
  else if (t < 75.4) { st.look = [0, 1]; st.mouth = t < 73.4 ? 'flat' : 'smile'; st.arm = 0.5; st.squash = 0.04 * Math.sin(t * 5); }
  else if (t < 77.6) { st.arm = 1; st.look = [0, 1]; st.mouth = 'smile'; st.shine = true; st.blink = (t > 76.9 && t < 76.98) ? 1 : 0; st.squash = t > 76.4 && t < 76.6 ? -0.1 : 0; st.hop = t > 76.4 && t < 76.8 ? Math.sin((t - 76.4) / 0.4 * Math.PI) * 6 : 0; }
  else { st.arm = 0.5 + 0.5 * Math.sin(t * 9); st.look = [0, 1]; st.mouth = 'smile'; st.shine = true; st.blink = ((t * 10) % 31 < 0.8) ? 1 : 0; }
  return { x: p[0], y: p[1], z: p[2], st };
}
const JARGON = ["REFACTORED VIA SLAB-API (SEE ABOVE)", "L42: FIXED? 2/3 -> RE-RAN", "PER PREV CTX: OK-ISH", "IMPL'D AS DISCUSSED + EDGE CASES", "N.B. SEE NOTES 7, 9, 12", "MOONSTONE V2 -> V3 (MIGRATED)", "STAIR#4 = OFF BY 1 (FIXED?)", "SWAPPED THE THING (CF. EARLIER)", "TODO: ASK RE: PLANK 13", "SEE ABOVE. SEE ABOVE.", "ROLLED BACK, THEN FORWARD", "100% DONE-ISH (+/- 3%)"];
function reportRiver(F, t, H) {
  const grow = sm(67.8, 69.6, t), back = sm(72.4, 73.4, t), len = grow * (1 - back) * 2400; if (len < 4) return;
  const hs = heroScreen(H), x0 = hs.x - 30, y0 = hs.y + 40, W = 230, seg = 70;
  F.save();
  for (let d = 0, i = 0; d < len; d += seg, i++) {
    const u = d / 2400, ang = 2.2 + Math.sin(u * 7 + TA * 0.8) * 0.25, cx = x0 - Math.cos(2.2) * -d * 0.0 + Math.cos(ang) * 0 , px = x0 + (-0.55 * d) + Math.sin(d * 0.006 + TA) * 40, py = y0 + 0.78 * d;
    F.save(); F.translate(px, py); F.rotate(-0.62 + Math.sin(d * 0.006 + TA) * 0.12);
    F.fillStyle = i % 2 ? '#f3ead6' : '#efe4cf'; F.fillRect(-W / 2, -seg / 2 - 1, W, seg + 2); F.fillStyle = 'rgba(120,100,70,0.25)'; F.fillRect(-W / 2, -seg / 2, 4, seg); F.fillRect(W / 2 - 4, -seg / 2, 4, seg);
    for (let r = 0; r < 3; r++) { const txt = JARGON[(i * 3 + r) % JARGON.length]; hiText(F, txt.slice(0, 26), -W / 2 + 10, -seg / 2 + 8 + r * 20, 2, r === 1 ? '#7a2a2a' : '#2a2350', { shadow: false }); }
    F.restore();
  }
  // the scroll's roll at the hero's paws
  F.fillStyle = '#e9dcc0'; F.beginPath(); F.ellipse(x0, y0, 30, 18, -0.6, 0, 7); F.fill(); F.fillStyle = '#c9b48f'; F.beginPath(); F.ellipse(x0, y0, 12, 7, -0.6, 0, 7); F.fill();
  F.restore();
}
function cleanCard(F, t, H) {
  const inn = sm(75.4, 75.75, t) * (1 - sm(77.5, 77.9, t)); if (inn <= 0) return; const hs = heroScreen(H), w = 860, h = 300, x = FW / 2 - w / 2, y = 360 + (1 - inn) * 60;
  F.save(); F.globalAlpha = inn; F.shadowColor = 'rgba(0,0,0,0.5)'; F.shadowBlur = 30; F.shadowOffsetY = 12; F.fillStyle = '#f3ead6'; F.beginPath(); F.roundRect(x, y, w, h, 14); F.fill(); F.shadowColor = 'transparent';
  F.fillStyle = '#6fc49a'; F.beginPath(); F.roundRect(x, y, 14, h, [14, 0, 0, 14]); F.fill();
  hiText(F, 'DONE.', x + 54, y + 50, 12, '#2a2350', { shadow: false }); hiText(F, 'THE BRIDGE IS BUILT.', x + 54, y + 170, 6, '#2a2350', { shadow: false }); hiText(F, '13 SLABS · 0 LEFT', x + 54, y + 230, 4, '#7d7790', { shadow: false });
  // the Handler's check mark, drawn by the pencil
  const ck = sm(76.4, 76.8, t), cx = x + w - 150, cy = y + 110;
  if (ck > 0) { F.strokeStyle = '#3f9a7c'; F.lineWidth = 16; F.lineCap = 'round'; F.lineJoin = 'round'; F.beginPath(); F.moveTo(cx, cy); const p1 = [cx + 34, cy + 40], p2 = [cx + 110, cy - 60], k1 = Math.min(1, ck * 2.2), k2 = clamp((ck - 0.45) / 0.55, 0, 1); F.lineTo(lerp(cx, p1[0], k1), lerp(cy, p1[1], k1)); if (k2 > 0) F.lineTo(lerp(p1[0], p2[0], k2), lerp(p1[1], p2[1], k2)); F.stroke(); }
  if (t > 76.2 && t < 77.1) { const u = clamp((t - 76.4) / 0.4, 0, 1), inn2 = sm(76.2, 76.35, t) * (1 - sm(76.9, 77.1, t)), path = u < 0.45 ? [lerp(cx, cx + 34, u / 0.45), lerp(cy, cy + 40, u / 0.45)] : [lerp(cx + 34, cx + 110, (u - 0.45) / 0.55), lerp(cy + 40, cy - 60, (u - 0.45) / 0.55)];
    drawPencil(F, path[0] + (1 - inn2) * 500, path[1] - (1 - inn2) * 500, 2.35, 0.55); }
  F.restore();
}
// ---------------- the reveal: desk, lamp, the note, the pencil ----------------
function revealK(t) { return sm(78.0, 80.4, t); }
function revealBack(F, t) {   // behind the pixel world: the room, the desk, the lamp shade and its light
  const rv = revealK(t); if (rv <= 0.001) return; const m = moonScreen(), deskY = S([0, 560])[1] * SC;
  F.save(); F.globalAlpha = rv;
  let g = F.createLinearGradient(0, 0, 0, deskY); g.addColorStop(0, 'rgba(26,18,30,0.65)'); g.addColorStop(1, 'rgba(46,30,36,0.7)'); F.fillStyle = g; F.fillRect(0, 0, FW, deskY);
  // the desk in perspective
  F.beginPath(); F.moveTo(-50, deskY + 30); F.lineTo(FW + 50, deskY - 30); F.lineTo(FW + 50, FH + 10); F.lineTo(-50, FH + 10); F.closePath(); g = F.createLinearGradient(0, deskY - 30, 0, FH); g.addColorStop(0, '#5a3626'); g.addColorStop(1, '#2a1712'); F.fillStyle = g; F.fill();
  F.save(); F.clip(); for (let k = 0; k < 30; k++) { F.strokeStyle = `rgba(${110 + (k % 3) * 15},${70 + (k % 4) * 6},48,0.25)`; F.lineWidth = 1 + (k % 3); F.beginPath(); const y = deskY - 20 + k * 12; F.moveTo(-50, y + 40); F.bezierCurveTo(300, y + 30 + Math.sin(k) * 8, 700, y + Math.cos(k) * 8, FW + 50, y - 20); F.stroke(); } F.restore();
  g = F.createRadialGradient(m.x, m.y, m.r, m.x, m.y, m.r * 14); g.addColorStop(0, 'rgba(120,80,70,0.55)'); g.addColorStop(1, 'rgba(60,40,50,0)'); F.fillStyle = g; F.fillRect(0, 0, FW, deskY);
  // lamp: arm from the bulb up and over to a base on the desk at the right
  const r = m.r, sx = m.x + r * 1.0, sy = m.y - r * 1.15, ex = FW - 60, ey = deskY - 10;
  F.strokeStyle = '#4a3a50'; F.lineWidth = Math.max(10, r * 0.3); F.lineCap = 'round'; F.beginPath(); F.moveTo(sx + r * 0.5, sy - r * 0.2); F.lineTo(sx + r * 2.6, sy - r * 2.0); F.lineTo(ex - 40, ey - 60); F.stroke();
  F.fillStyle = '#3a2c44'; F.beginPath(); F.arc(sx + r * 2.6, sy - r * 2.0, r * 0.2, 0, 7); F.fill(); F.beginPath(); F.ellipse(ex - 40, ey - 10, r * 1.2, r * 0.35, 0, 0, 7); F.fill();
  // the shade: a dark dome hugging the back of the bulb
  F.save(); F.translate(m.x, m.y); F.rotate(-0.75); g = F.createLinearGradient(-r * 1.6, 0, r * 1.6, 0); g.addColorStop(0, '#231a2c'); g.addColorStop(0.5, '#4c3b55'); g.addColorStop(1, '#231a2c'); F.fillStyle = g;
  F.beginPath(); F.moveTo(-r * 1.45, r * 0.15); F.quadraticCurveTo(-r * 1.3, -r * 1.9, 0, -r * 2.0); F.quadraticCurveTo(r * 1.3, -r * 1.9, r * 1.45, r * 0.15); F.closePath(); F.fill();
  F.strokeStyle = '#8a7494'; F.lineWidth = Math.max(2, r * 0.08); F.beginPath(); F.ellipse(0, r * 0.12, r * 1.45, r * 0.42, 0, Math.PI, 2 * Math.PI); F.stroke();
  F.strokeStyle = 'rgba(255,214,160,0.7)'; F.lineWidth = Math.max(2, r * 0.07); F.beginPath(); F.moveTo(-r * 1.4, r * 0.05); F.quadraticCurveTo(-r * 1.25, -r * 1.8, 0, -r * 1.93); F.stroke(); F.restore();
  // its light falling on the desk
  F.globalCompositeOperation = 'lighter'; g = F.createRadialGradient(m.x, m.y, r, m.x - r * 6, deskY, r * 18); g.addColorStop(0, 'rgba(255,230,180,0.22)'); g.addColorStop(1, 'rgba(255,210,150,0)'); F.fillStyle = g;
  F.beginPath(); F.moveTo(m.x - r, m.y); F.lineTo(m.x + r * 0.6, m.y + r); F.lineTo(m.x - r * 2, FH); F.lineTo(-100, FH); F.lineTo(-100, deskY); F.closePath(); F.fill();
  F.restore();
}
function revealFront(F, t) {    // in front: the original note and the giant pencil lying on the desk
  const rv = revealK(t); if (rv <= 0.001) return; const z = CAM.z, n = S([150, 650]), p = S([440, 720]);
  F.save(); F.globalAlpha = sm(0.25, 1, rv);
  F.translate(n[0] * SC, n[1] * SC); F.rotate(-0.08); const w = 760 * z * 3 / 3.2, h = 520 * z * 3 / 3.2;
  F.shadowColor = 'rgba(0,0,0,0.5)'; F.shadowBlur = 20; F.fillStyle = '#f3ead6'; F.fillRect(-w / 2, -h / 2, w, h); F.shadowColor = 'transparent';
  F.strokeStyle = 'rgba(150,130,100,0.35)'; F.lineWidth = 2; F.beginPath(); F.moveTo(-w / 2, -h / 2); F.lineTo(0, h / 2); F.lineTo(w / 2, -h / 2); F.stroke();
  const px = Math.max(2, Math.round(9 * z * 3 / 3.2)); ['BUILD ME', 'A BRIDGE', 'TO THE MOON.'].forEach((L, i) => hiText(F, L, -w / 2 + px * 7, -h / 2 + px * 7 + i * px * 11, px, '#2a2350', { shadow: false }));
  F.strokeStyle = '#3f9a7c'; F.lineWidth = Math.max(4, px * 1.6); F.lineCap = 'round'; F.beginPath(); F.moveTo(w * 0.22, h * 0.12); F.lineTo(w * 0.28, h * 0.24); F.lineTo(w * 0.42, h * 0.02); F.stroke();
  F.restore();
  F.save(); F.globalAlpha = sm(0.25, 1, rv); drawPencil(F, p[0] * SC, p[1] * SC, -0.12, 1.9 * z); F.restore();
}
function endTitle(F, T) {
  const a = sm(85.0, 85.6, T); if (a <= 0) return; F.save(); F.globalAlpha = a;
  hiText(F, 'FABLE 5.2', 70, 150, 12, '#fff6ea', {}); hiText(F, 'A FIELD GUIDE', 76, 252, 5, '#d97757', {});
  F.globalAlpha = sm(86.0, 86.6, T); hiText(F, 'HANDLE WITH CLEAR INSTRUCTIONS.', 76, 310, 4, '#f3e6cf', {}); F.restore();
}
