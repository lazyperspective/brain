'use strict';
// ------------------------------------------------------------------
// EPILOGUE · THE REPORT   (story t 66.6 → 87.4  ≈ real T 74.0 → 92.2)
// A river of jargon -> tip: write for a reader who wasn't there -> one clear card + the pencil's check mark
// -> the reveal: the moon is the Handler's desk lamp; the island floats over the desk.
// ------------------------------------------------------------------
const CAMKEYS6 = [[66.6, 500, -90, 1.6], [67.6, 506, -104, 1.72], [72.2, 498, -92, 1.5], [74.6, 498, -92, 1.5], [77.8, 502, -98, 1.62], [80.2, 502, -98, 1.62], [83.2, 330, 318, 0.35], [87.4, 330, 326, 0.335]];
const MOONSPOT = () => { const s = slabTop(13); return [s[0] + 6, s[1] - 16, s[2] + 8]; };
function heroAt6(t) {
  const st = { eyes: 'open', look: [2, -2], mouth: 'smile', arm: 0.6, hop: 0, squash: 0, walk: null, breathe: 0, blink: 0 };
  const a = slabTop(13), b = MOONSPOT(); let p = b;
  if (t < 67.6) { const u = clamp((t - 66.6) / 1.0, 0, 1); p = [lerp(a[0], b[0], ease(u)), lerp(a[1], b[1], ease(u)), lerp(a[2], b[2], ease(u))]; st.hop = Math.sin(u * Math.PI) * 9; st.squash = u > 0.9 ? 0.15 : -0.08; st.eyes = 'wide'; }
  else if (t < 70.4) { st.arm = t > 69.0 ? 1 : 0.5; st.look = t < 69.0 ? [-1, -2] : [0, 1]; st.mouth = t < 69.0 ? 'o' : 'flat'; st.eyes = t > 68.9 && t < 69.1 ? 'wide' : 'open'; }
  else if (t < 75.0) { st.arm = 1; st.look = [-1, 1]; st.mouth = t > 72.2 ? 'o' : 'smile'; st.blink = (t > 73.6 && t < 73.68) ? 1 : 0; }
  else if (t < 78.0) { st.look = [0, 1]; st.mouth = t < 76.0 ? 'flat' : 'smile'; st.arm = 0.5; st.squash = 0.04 * Math.sin(t * 5); }
  else if (t < 80.2) { st.arm = 1; st.look = [0, 1]; st.mouth = 'smile'; st.shine = true; st.blink = (t > 79.5 && t < 79.58) ? 1 : 0; st.squash = t > 79.0 && t < 79.2 ? -0.1 : 0; st.hop = t > 79.0 && t < 79.4 ? Math.sin((t - 79.0) / 0.4 * Math.PI) * 6 : 0; }
  else { st.arm = 0.5 + 0.5 * Math.sin(t * 9); st.look = [0, 1]; st.mouth = 'smile'; st.shine = true; st.blink = ((t * 10) % 31 < 0.8) ? 1 : 0; }
  return { x: p[0], y: p[1], z: p[2], st };
}
const JARGON = ["REFACTORED VIA SLAB-API (SEE ABOVE)", "L42: FIXED? 2/3 -> RE-RAN", "PER PREV CTX: OK-ISH", "IMPL'D AS DISCUSSED + EDGE CASES", "N.B. SEE NOTES 7, 9, 12", "MOONSTONE V2 -> V3 (MIGRATED)", "STAIR#4 = OFF BY 1 (FIXED?)", "SWAPPED THE THING (CF. EARLIER)", "TODO: ASK RE: PLANK 13", "SEE ABOVE. SEE ABOVE.", "ROLLED BACK, THEN FORWARD", "100% DONE-ISH (+/- 3%)"];
function reportRiver(F, t, H) {
  const pull = sm(70.4, 70.65, t) * (1 - sm(75.8, 76.1, t)), grow = sm(70.75, 72.4, t), back = sm(75.0, 76.0, t), len = grow * (1 - back) * 2400; if (pull <= 0) return;
  const hs = heroScreen(H), x0 = hs.x - 30, y0 = hs.y + 40, W = 300, seg = 84;
  F.save();
  for (let d = 0, i = 0; len > 4 && d < len; d += seg, i++) {
    const u = d / 2400, ang = 2.2 + Math.sin(u * 7 + TA * 0.8) * 0.25, cx = x0 - Math.cos(2.2) * -d * 0.0 + Math.cos(ang) * 0 , px = x0 + (-0.55 * d) + Math.sin(d * 0.006 + TA) * 40, py = y0 + 0.78 * d;
    F.save(); F.translate(px, py); F.rotate(-0.62 + Math.sin(d * 0.006 + TA) * 0.12);
    F.fillStyle = i % 2 ? '#f3ead6' : '#efe4cf'; F.fillRect(-W / 2, -seg / 2 - 1, W, seg + 2); F.fillStyle = 'rgba(120,100,70,0.25)'; F.fillRect(-W / 2, -seg / 2, 4, seg); F.fillRect(W / 2 - 4, -seg / 2, 4, seg);
    for (let r = 0; r < 3; r++) { const txt = JARGON[(i * 3 + r) % JARGON.length]; hiText(F, txt.slice(0, 22), -W / 2 + 12, -seg / 2 + 8 + r * 26, 2.4, r === 1 ? '#7a2a2a' : '#2a2350', { shadow: false }); }
    F.restore();
  }
  // the scroll's roll at the hero's paws (pops in as it is pulled out)
  const rs = pull * (1 + Math.sin(sm(70.4, 70.65, t) * Math.PI) * 0.25); F.fillStyle = '#e9dcc0'; F.beginPath(); F.ellipse(x0, y0, 34 * rs, 20 * rs, -0.6, 0, 7); F.fill(); F.fillStyle = '#c9b48f'; F.beginPath(); F.ellipse(x0, y0, 13 * rs, 8 * rs, -0.6, 0, 7); F.fill(); F.fillStyle = '#c0392b'; F.fillRect(x0 - 4 * rs, y0 - 20 * rs, 8 * rs, 40 * rs);
  F.restore();
}
function cleanCard(F, t, H) {
  const inn = sm(78.0, 78.35, t) * (1 - sm(80.1, 80.5, t)); if (inn <= 0) return; const hs = heroScreen(H), w = 860, h = 300, x = FW / 2 - w / 2, y = 360 + (1 - inn) * 60;
  F.save(); F.globalAlpha = inn; F.shadowColor = 'rgba(0,0,0,0.5)'; F.shadowBlur = 30; F.shadowOffsetY = 12; F.fillStyle = '#f3ead6'; F.beginPath(); F.roundRect(x, y, w, h, 14); F.fill(); F.shadowColor = 'transparent';
  F.fillStyle = '#6fc49a'; F.beginPath(); F.roundRect(x, y, 14, h, [14, 0, 0, 14]); F.fill();
  hiText(F, 'DONE.', x + 54, y + 50, 12, '#2a2350', { shadow: false }); hiText(F, 'THE BRIDGE IS BUILT.', x + 54, y + 170, 6, '#2a2350', { shadow: false }); hiText(F, '13 SLABS · 0 LEFT', x + 54, y + 230, 4, '#7d7790', { shadow: false });
  // the Handler's check mark, drawn by the pencil
  const ck = sm(79.0, 79.4, t), cx = x + w - 150, cy = y + 110;
  if (ck > 0) { F.strokeStyle = '#3f9a7c'; F.lineWidth = 16; F.lineCap = 'round'; F.lineJoin = 'round'; F.beginPath(); F.moveTo(cx, cy); const p1 = [cx + 34, cy + 40], p2 = [cx + 110, cy - 60], k1 = Math.min(1, ck * 2.2), k2 = clamp((ck - 0.45) / 0.55, 0, 1); F.lineTo(lerp(cx, p1[0], k1), lerp(cy, p1[1], k1)); if (k2 > 0) F.lineTo(lerp(p1[0], p2[0], k2), lerp(p1[1], p2[1], k2)); F.stroke(); }
  if (t > 78.8 && t < 79.7) { const u = clamp((t - 79.0) / 0.4, 0, 1), inn2 = sm(78.8, 78.95, t) * (1 - sm(79.5, 79.7, t)), path = u < 0.45 ? [lerp(cx, cx + 34, u / 0.45), lerp(cy, cy + 40, u / 0.45)] : [lerp(cx + 34, cx + 110, (u - 0.45) / 0.55), lerp(cy + 40, cy - 60, (u - 0.45) / 0.55)];
    drawPencil(F, path[0] + (1 - inn2) * 500, path[1] - (1 - inn2) * 500, 2.35, 0.55); }
  F.restore();
}
// ---------------- the reveal: desk, lamp, the note, the pencil ----------------
function revealK(t) { return sm(80.6, 83.0, t); }
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
  const a = sm(87.6, 88.2, T); if (a <= 0) return; F.save(); F.globalAlpha = a;
  hiText(F, 'FABLE 5.2', 70, 150, 12, '#fff6ea', {}); hiText(F, 'A FIELD GUIDE', 76, 252, 5, '#d97757', {});
  F.globalAlpha = sm(88.6, 89.2, T); hiText(F, 'HANDLE WITH', 76, 310, 4, '#f3e6cf', {}); hiText(F, 'CLEAR INSTRUCTIONS.', 76, 352, 4, '#f3e6cf', {}); F.restore();
}

// ---------------- the Handler asks for the report ----------------
function requestPlane(B, t, H) {
  if (t < 67.7 || t > 69.05) return; const u = clamp((t - 67.7) / 1.3, 0, 1), hd = H.r ? H.r.head : P(H.x, H.y, 16), e = ease(u);
  const x = lerp(hd[0] - 150, hd[0] - 4, e) + Math.sin(u * 6) * 14 * (1 - u), y = lerp(hd[1] - 130, hd[1] - 4, e) - Math.sin(u * Math.PI) * 30;
  const ang = Math.atan2((hd[1] - 4) - (hd[1] - 130), (hd[0] - 4) - (hd[0] - 150)) + Math.sin(u * 9) * 0.25;
  planeW(B, x, y, ang, Math.sin(u * 7) * 0.6, { light: COL.planeL, mid: COL.planeM, dark: COL.planeD }, 1.35 * ISO.k);
  for (let q = 1; q < 12; q++) { const uu = Math.max(0, u - q * 0.03), ee = ease(uu); if ((q + Math.floor(t * 20)) % 2) B.put(lerp(hd[0] - 150, hd[0] - 4, ee), lerp(hd[1] - 130, hd[1] - 4, ee) - Math.sin(uu * Math.PI) * 30, COL.zz); }
}
function requestPencil(F, t, H) { if (t < 67.5 || t > 68.6) return; const hs = heroScreen(H), inn = sm(67.5, 67.7, t) * (1 - sm(68.2, 68.6, t)); drawPencil(F, hs.x - 470 - (1 - inn) * 300, hs.y - 400 - (1 - inn) * 300, 0.7, 0.55); }
function requestNote(F, t) {
  const a = sm(69.05, 69.3, t) * (1 - sm(70.2, 70.4, t)); if (a <= 0) return; const w = 780, h = 230, x = FW / 2 - w / 2, y = 300 + (1 - a) * 30;
  F.save(); F.globalAlpha = a; F.translate(FW / 2, y + h / 2); F.rotate(-0.03); F.translate(-FW / 2, -(y + h / 2));
  F.shadowColor = 'rgba(0,0,0,0.5)'; F.shadowBlur = 30; F.shadowOffsetY = 12; F.fillStyle = '#f3ead6'; F.fillRect(x, y, w, h); F.shadowColor = 'transparent';
  F.strokeStyle = 'rgba(150,130,100,0.35)'; F.lineWidth = 2; F.beginPath(); F.moveTo(x, y); F.lineTo(x + w / 2, y + h); F.lineTo(x + w, y); F.stroke();
  hiText(F, 'HOW DID IT GO?', x + 50, y + 54, 8, '#2a2350', { shadow: false, jitter: 1.2 }); hiText(F, '— THE HANDLER', x + w - 50 - textW('— THE HANDLER', 4), y + h - 56, 4, '#2a2350', { shadow: false });
  F.restore();
}
