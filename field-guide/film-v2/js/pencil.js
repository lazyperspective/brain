'use strict';
// ------------------------------------------------------------------
// THE HANDLER'S PENCIL — the Handler's presence in the film (replaces the hand).
// A giant hexagonal pencil: graphite tip, sharpened wood, yellow body, metal ferrule, pink eraser.
// drawPencil(F, x, y, ang, s, opt): (x,y) = the graphite tip (or the eraser end if opt.eraser), ang = the
// direction the tip points, s = scale (1 ≈ 64 px wide body).
// ------------------------------------------------------------------
function drawPencil(F, x, y, ang, s, opt = {}) {
  const L = 1300, W = 64, tip = 26, cone = 86, fer = 70, era = 64;
  F.save(); F.translate(x, y); F.rotate(ang); F.scale(s, s);
  if (opt.eraser) F.translate(L, 0);      // eraser mode: the eraser sits at the origin and ang is the direction the body extends
  F.shadowColor = 'rgba(0,0,0,0.45)'; F.shadowBlur = 30; F.shadowOffsetY = 14;
  // body (hex prism seen side-on: three long faces)
  const bx0 = -L + era + fer, bx1 = -tip - cone;
  F.fillStyle = '#e8b04a'; F.fillRect(bx0, -W / 2, bx1 - bx0, W); F.shadowColor = 'transparent';
  F.fillStyle = '#ffd77a'; F.fillRect(bx0, -W / 2, bx1 - bx0, W * 0.3);                // lit face
  F.fillStyle = '#c98a2a'; F.fillRect(bx0, W * 0.2, bx1 - bx0, W * 0.3);                 // shadow face
  F.fillStyle = 'rgba(255,240,200,0.55)'; F.fillRect(bx0, -W / 2, bx1 - bx0, 3);         // moonlit rim
  F.fillStyle = 'rgba(40,20,10,0.25)'; F.fillRect(bx0, -W / 2 + W * 0.3, bx1 - bx0, 2); F.fillRect(bx0, W * 0.2, bx1 - bx0, 2);
  // a little printed lettering on the side
  F.fillStyle = 'rgba(70,40,10,0.55)'; for (let q = 0; q < 6; q++) F.fillRect(bx0 + 220 + q * 22, -6, 14, 12);
  // sharpened wood cone + graphite
  F.fillStyle = '#f2d2a8'; F.beginPath(); F.moveTo(bx1, -W / 2); F.lineTo(-tip, -9); F.lineTo(-tip, 9); F.lineTo(bx1, W / 2); F.closePath(); F.fill();
  F.fillStyle = '#d9b080'; F.beginPath(); F.moveTo(bx1, W * 0.2); F.lineTo(-tip, 4); F.lineTo(-tip, 9); F.lineTo(bx1, W / 2); F.closePath(); F.fill();
  F.fillStyle = '#e8b04a'; F.beginPath(); F.moveTo(bx1, -W / 2); F.quadraticCurveTo(bx1 + 14, -W / 4, bx1, 0); F.quadraticCurveTo(bx1 + 14, W / 4, bx1, W / 2); F.fill();
  F.fillStyle = '#2a2350'; F.beginPath(); F.moveTo(-tip, -9); F.lineTo(0, 0); F.lineTo(-tip, 9); F.closePath(); F.fill();
  F.fillStyle = 'rgba(200,200,230,0.5)'; F.beginPath(); F.moveTo(-tip, -9); F.lineTo(0, 0); F.lineTo(-tip, -3); F.closePath(); F.fill();
  // ferrule + eraser
  const fx0 = -L + era; F.fillStyle = '#b9b2c4'; F.fillRect(fx0, -W / 2 - 2, fer, W + 4);
  F.fillStyle = '#e9e3f5'; F.fillRect(fx0, -W / 2 - 2, fer, 10); F.fillStyle = '#7d7790'; for (let q = 1; q < 4; q++) F.fillRect(fx0 + q * fer / 4, -W / 2 - 2, 3, W + 4);
  F.fillStyle = '#e88a9a'; F.beginPath(); F.roundRect(-L, -W / 2, era + 6, W, [16, 0, 0, 16]); F.fill();
  F.fillStyle = '#f6b3c4'; F.beginPath(); F.roundRect(-L, -W / 2, era + 6, W * 0.32, [16, 0, 0, 0]); F.fill();
  F.restore();
}
// screen point of a low-res ref position at a given parallax, in hi-res pixels
function HS(q, par = 1) { const s = S(q, par); return [s[0] * SC, s[1] * SC]; }

// PROLOGUE: the pencil flicks the paper plane out of the dark, then withdraws
function pencilPrologue(F, t) {
  if (t > 2.3) return; const w = ease(clamp((t - 1.45) / 0.85, 0, 1)), flick = Math.sin(clamp(t / 0.5, 0, 1) * Math.PI) * 0.12;
  const p = HS([112 - w * 150, 118 - w * 190], 0.7), s = 0.9 * (1 + (CAM.z - 1) * 0.7) * 0.6;
  drawPencil(F, p[0], p[1], 0.55 + flick - w * 0.2, s);
}
// CHAPTER I: the eraser end pushes the EFFORT dial down, click by click
function pencilDial(F, t) {
  if (t < 14.3 || t > 17.2) return;
  const inn = ease(clamp((t - 14.3) / 0.75, 0, 1)), out = ease(clamp((t - 16.35) / 0.8, 0, 1)), c = HS(DIAL.q, 0.9);
  const twist = (dialAngle(t) - DETENTS.HIGH) * Math.PI / 180, ang = -2.25 + twist * 0.6, press = [15.55, 15.75, 15.95].some(a => t > a - 0.05 && t < a + 0.06) ? 10 : 0;
  const dx = Math.cos(ang + Math.PI), dy = Math.sin(ang + Math.PI), back = (1 - inn) * 900 + out * 900 - press;
  drawPencil(F, c[0] - dx * back, c[1] - dy * back, ang, 0.75 * (1 + (CAM.z - 1) * 0.9), { eraser: true });
}
// CHAPTER II: the pencil taps impatiently in the silence
function pencilTap(F, T) {
  if (T < 28.4 || T > 31.9) return; const inn = sm(28.4, 28.9, T) * (1 - sm(31.4, 31.9, T)), tap = Math.max(0, Math.sin(T * 13)), p = [110 + (1 - inn) * -400, 690 - tap * 26];
  drawPencil(F, p[0], p[1], 1.25, 0.62);
  if (tap < 0.15 && inn > 0.8) { F.save(); F.strokeStyle = 'rgba(255,240,210,0.8)'; F.lineWidth = 3; for (const a of [-2.4, -1.9, -1.2]) { F.beginPath(); F.moveTo(p[0] + Math.cos(a) * 18, p[1] + 10 + Math.sin(a) * 18); F.lineTo(p[0] + Math.cos(a) * 34, p[1] + 10 + Math.sin(a) * 34); F.stroke(); } F.restore(); }
}
// CHAPTER III: the eraser rubs the old rules out (story t 43.35 → 44.8)
function eraserRubAt(t) { return clamp((t - 43.35) / 1.45, 0, 1); }
function pencilEraser(F, t, H) {
  if (t < 43.0 || t > 45.3) return; const hs = heroScreen(H), inn = ease(clamp((t - 43.0) / 0.35, 0, 1)), out = ease(clamp((t - 44.85) / 0.45, 0, 1));
  const rub = Math.sin((t - 43.35) * 26) * 70 * (t > 43.35 && t < 44.8 ? 1 : 0), x = hs.x + rub - out * 300, y = hs.y - 40 - (1 - inn) * 700 - out * 600;
  drawPencil(F, x, y, -1.75 + Math.sin((t - 43.35) * 26) * 0.08, 0.95, { eraser: true });
}
function eraserCrumbs(F, t, H) {
  if (t < 43.4 || t > 45.6) return; const hs = heroScreen(H);
  for (let q = 0; q < 40; q++) { const born = 43.4 + hash(q, 1, 1) * 1.3, u = (t - born) / 0.8; if (u < 0 || u > 1) continue; const x = hs.x + (hash(q, 2, 2) - 0.5) * 220 + (hash(q, 3, 3) - 0.5) * 300 * u, y = hs.y - 20 + u * 160 + u * u * 120;
    F.fillStyle = q % 3 ? '#e88a9a' : '#f6b3c4'; F.fillRect(Math.round(x / 3) * 3, Math.round(y / 3) * 3, 9, 6); }
}
