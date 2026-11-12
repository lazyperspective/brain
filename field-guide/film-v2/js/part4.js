'use strict';
// ------------------------------------------------------------------
// PART 4 · CHAPTER III · THE RULES   (story t 34.2 → 51.8  ≈ real T 39.0 → 56.6)
// Old cautious notes rain down and pile up until it is a sticky-note mummy asking "may I blink?".
// The Handler's gust strips them away; one rule is rewritten with scope: ASK BEFORE DELETING FILES.
// ------------------------------------------------------------------
const CAMKEYS4 = [[34.2, 214, 182, 1.15], [35.2, 192, 226, 1.7], [37.2, 190, 228, 1.85], [38.6, 190, 226, 2.15], [41.2, 190, 226, 2.25], [43.2, 196, 220, 1.55], [44.8, 196, 220, 1.5], [48.0, 190, 224, 1.6], [48.4, 189, 220, 2.5], [50.2, 189, 220, 2.45], [51.0, 214, 196, 1.55], [51.8, 232, 172, 1.4]];
const NOTE_COL = { Y: ['#ffe7a3', '#e8c86a'], P: ['#f6b3c4', '#d98aa0'], B: ['#b6dcf2', '#86b6d6'], G: ['#c6eab0', '#93c482'] };
// [text lines, colour, land time, attach offset (hero units: x right, y up from the top centre), rotation]
const NOTES = [
  [['NEVER', 'RETRY'], 'Y', 36.0, [-5, -2], -0.18], [['ASK', 'FIRST'], 'P', 36.8, [6, 0], 0.14], [['STOP AT', 'FIRST', 'ERROR'], 'B', 37.55, [0, -9], 0.05],
  [['NEVER', 'DELETE', 'FILES'], 'Y', 37.7, [0, 4], -0.04], [['ASK', 'FIRST'], 'G', 37.8, [-9, -10], 0.3], [['DOUBLE', 'CHECK'], 'P', 37.9, [9, -10], -0.25],
  [['WAIT', 'FOR OK'], 'B', 38.0, [-11, -4], 0.4], [['NEVER', 'GUESS'], 'Y', 38.1, [11, -3], -0.35], [['ASK', 'FIRST'], 'P', 38.2, [-4, -14], 0.2],
  [['NO', 'SHORT', 'CUTS'], 'G', 38.3, [5, -14], -0.15], [['CHECK', 'AGAIN'], 'B', 38.4, [-8, 2], 0.1], [['ASK', 'FIRST'], 'Y', 38.48, [8, 3], -0.1],
  [['BE', 'CAREFUL'], 'P', 38.56, [0, -17], 0.06], [['NEVER', 'RUSH'], 'G', 38.64, [-12, -12], 0.5],
];
const KEEP = 3;   // "NEVER DELETE FILES" stays, and is rewritten with scope

function heroAt4(t) {
  const st = { eyes: 'open', look: [2, -2], mouth: 'smile', arm: 0.3, hop: 0, squash: 0, walk: null, breathe: 0, blink: 0 };
  let x = 36, y = 30, z = 0;
  const hits = NOTES.filter(n => t > n[2] && t < n[2] + 0.18).length;
  if (t < 35.2) { st.shine = true; st.squash = 0.04 * Math.sin((t - 34) * 8); }
  else if (t < 38.6) { st.look = t < 37.1 ? [-1, -2] : [0, -2]; st.eyes = 'wide'; st.mouth = 'o'; st.arm = 0.8; st.squash = 0.06 + (hits ? 0.14 : 0) + (t - 35.2) * 0.02; }
  else if (t < 43.4) { st.look = [1, -1]; st.mouth = ''; st.squash = 0.12; const p = sm(39.6, 39.9, t) * (1 - sm(41.1, 41.4, t)); st.arm = 0.3 + p * 0.7 + p * Math.sin(t * 40) * 0.08; }
  else if (t < 44.8) { st.eyes = 'closed'; st.mouth = 'flat'; st.squash = 0.1 + Math.sin(t * 25) * 0.03; st.arm = 0.2; }
  else if (t < 48.2) { st.look = [0, -2]; st.mouth = t > 46.8 ? 'smile' : 'flat'; st.squash = 0.04; }
  else if (t < 50.3) { st.look = [0, -2]; st.mouth = t > 49.1 ? 'smile' : 'flat'; st.shine = t > 49.1; st.blink = ((t > 49.3 && t < 49.4) || (t > 49.6 && t < 49.7)) ? 1 : 0; }
  else {    // hops onto the bridge and races up the slabs
    const pts = [[36, 30, 0], [40, 8, 0], [40, -9, 2], [40, -27, 9], [40, -45, 15], [40, -63, 21]], u = clamp((t - 50.3) / 1.5, 0, 0.999) * (pts.length - 1), i = Math.floor(u), f = u - i;
    x = lerp(pts[i][0], pts[i + 1][0], ease(f)); y = lerp(pts[i][1], pts[i + 1][1], ease(f)); z = lerp(pts[i][2], pts[i + 1][2], ease(f)); st.hop = Math.sin(f * Math.PI) * 6; st.squash = f < 0.12 ? 0.12 : f > 0.88 ? 0.1 : -0.1; st.look = [2, -2]; st.mouth = 'smile'; st.arm = 1;
  }
  return { x, y, z, st };
}
let GUST = 0;
function gustAt(t) { return sm(43.55, 43.9, t) * (1 - sm(44.7, 45.3, t)); }
// pixel wind streaks during the gust
function windStreaks(B, t) {
  const g = gustAt(t); if (g <= 0.02) return;
  for (let q = 0; q < 16; q++) { const ph = (t * 1.8 + q / 16) % 1, y = 60 + hash(q, 1, 9) * 330, x0 = -40 + ph * 460, L = 18 + hash(q, 2, 9) * 30; if (hash(q, Math.floor(t * 6), 3) > g) continue;
    for (let s = 0; s < L; s++) B.put(x0 + s, y + Math.sin((x0 + s) * 0.05 + q) * 4, s > L * 0.7 ? hex('c3b9e0') : hex('e9e3f5')); }
}

// ---------------- hi-res sticky notes ----------------
function heroScreen(H) { const top = H.r ? H.r.top : P(H.x, H.y, 16); return { x: top[0] * SC, y: top[1] * SC, u: ISO.k * SC }; }
function drawNote(F, x, y, size, rot, lines, col, alpha = 1, opts = {}) {
  F.save(); F.globalAlpha = alpha; F.translate(x, y); F.rotate(rot);
  F.shadowColor = 'rgba(0,0,0,0.35)'; F.shadowBlur = size * 0.12; F.shadowOffsetY = size * 0.05; F.fillStyle = NOTE_COL[col][0]; F.fillRect(-size / 2, -size / 2, size, size); F.shadowColor = 'transparent';
  F.fillStyle = NOTE_COL[col][1]; F.fillRect(-size / 2, -size / 2, size, size * 0.16);                                  // adhesive strip
  F.fillStyle = 'rgba(255,255,255,0.25)'; F.beginPath(); F.moveTo(size / 2, size / 2); F.lineTo(size / 2 - size * 0.16, size / 2); F.lineTo(size / 2, size / 2 - size * 0.16); F.fill(); // curled corner
  const px = Math.max(1, Math.floor(size / (Math.max(...lines.map(L => L.length)) * 6 + 6)));
  if (px >= 1 && size > 14) lines.forEach((L, i) => hiText(F, L, 0, -size / 2 + size * 0.24 + i * px * 9, px, '#2a2350', { align: 'c', shadow: false }));
  if (opts.strike) { F.fillStyle = '#c0392b'; const sw = opts.strike; F.fillRect(-size * 0.42, -size * 0.05, size * 0.84 * sw, Math.max(2, size * 0.03)); F.fillRect(-size * 0.42, size * 0.12, size * 0.84 * sw, Math.max(2, size * 0.03)); }
  F.restore();
}
function notesHi(F, t, H) {
  if (t < 35.1 || t > 50.6) return;
  const hs = heroScreen(H), base = 8.5 * hs.u, gone = sm(43.85, 44.9, t);
  NOTES.forEach((n, k) => {
    const [lines, col, land, off, rot] = n, fallT = k < 3 ? 1.15 : 0.45, t0 = land - fallT; if (t < t0) return;
    const ax = hs.x + off[0] * hs.u * 0.75, ay = hs.y - off[1] * hs.u * 0.6 + base * 0.3;
    if (t < land) {
      const u = (t - t0) / fallT;
      if (k < 3) {   // key rules: drift down big and slow mid-frame (readable), then swoop onto the creature
        const hang = [FW * 0.66, 420 + k * 40], drop = sm(0, 0.3, u), swoop = sm(0.68, 1, u), x = lerp(lerp(FW * 0.72, hang[0], drop), ax, swoop) + Math.sin(u * 6 + k) * 22 * (1 - swoop), y = lerp(lerp(-200, hang[1], drop), ay, swoop * swoop);
        drawNote(F, x, y, base * lerp(3.6, 1, swoop), rot + Math.sin(u * 5 + k) * 0.25 * (1 - swoop), lines, col); return;
      }
      const e = u * u, sx = FW * (0.3 + hash(k, 1, 5) * 0.6), sy = -260, x = lerp(sx, ax, e) + Math.sin(u * 9 + k) * 50 * (1 - u), y = lerp(sy, ay, e);
      drawNote(F, x, y, base * lerp(2.2, 1, e), rot + Math.sin(u * 7 + k) * 0.6 * (1 - u), lines, col); return;
    }
    if (k === KEEP && t > 43.85) return;              // drawn separately below
    if (gone > 0) {      // the gust: spin away up and towards the camera
      const u = clamp((t - 43.85 - hash(k, 2, 2) * 0.25) / 0.9, 0, 1), x = ax + u * u * (500 + hash(k, 3, 3) * 600), y = ay - u * (300 + hash(k, 4, 4) * 500), s = base * (1 + u * 2.2), r = rot + u * (6 + k);
      if (u < 1) drawNote(F, x, y, s, r, lines, col, 1 - u * 0.4); return;
    }
    const thwap = sm(land, land + 0.06, t) * (1 - sm(land + 0.06, land + 0.16, t));
    drawNote(F, ax, ay, base * (1 + thwap * 0.15), rot, lines, col);
  });
  // the one rule that stays — then rewritten with scope by the Handler's pencil
  if (t > 43.85) {
    const n = NOTES[KEEP], ax = hs.x, ay = hs.y - 4 * hs.u * 0.6 - base * 0.35, big = 1 + sm(48.2, 48.5, t) * 0.55;
    const strike = sm(48.6, 48.95, t), rewritten = t > 49.05;
    drawNote(F, ax, ay, base * big, -0.04 + Math.sin(TA * 2) * 0.02, rewritten ? ['ASK BEFORE', 'DELETING', 'FILES.'] : n[0], rewritten ? 'G' : 'Y', 1, { strike: rewritten ? 0 : strike });
    // the giant pencil tip doing the rewrite
    if (t > 48.45 && t < 49.6) { const u = clamp((t - 48.5) / 0.95, 0, 1), px = ax - base * 0.4 * big + base * 0.8 * big * ((u * 3) % 1), py = ay - base * 0.1 + Math.floor(u * 3) * base * 0.15;
      F.save(); F.translate(px, py); F.rotate(-0.7); F.fillStyle = '#2a2350'; F.beginPath(); F.moveTo(0, 0); F.lineTo(14, -10); F.lineTo(10, -16); F.fill(); F.fillStyle = '#f2d2a8'; F.beginPath(); F.moveTo(14, -10); F.lineTo(10, -16); F.lineTo(44, -60); F.lineTo(52, -50); F.fill(); F.fillStyle = '#e8b04a'; F.fillRect(44, -78, 26, 300); F.fillStyle = '#c98a2a'; F.fillRect(60, -78, 10, 300); F.restore(); }
  }
}
// mummy speech bubble
function mummyBubble(F, t, H) {
  const al = sm(39.6, 39.75, t) * (1 - sm(41.05, 41.2, t)); if (al <= 0) return; const hs = heroScreen(H), txt = 'MAY I BLINK?', w = textW(txt, 6) + 50, h = 76, bx = hs.x + 120, by = hs.y - 300;
  F.save(); F.globalAlpha = al; F.translate(bx, by); F.shadowColor = 'rgba(0,0,0,0.5)'; F.shadowBlur = 18; F.fillStyle = '#fff6ea'; F.beginPath(); F.roundRect(0, 0, w, h, 16); F.fill(); F.shadowColor = 'transparent';
  F.beginPath(); F.moveTo(24, h - 2); F.lineTo(-30, h + 70); F.lineTo(54, h - 2); F.closePath(); F.fill(); hiText(F, txt, w / 2, h / 2 - 21, 6, '#2a2350', { align: 'c', shadow: false }); F.restore();
}
// the Handler's hand sweeps across: the gust
function handSweep(F, T) {
  if (T < 47.9 || T > 49.8) return; const u = clamp((T - 47.9) / 1.9, 0, 1), x = lerp(-700, FW + 300, ease(u)), y = 520 - Math.sin(u * Math.PI) * 140, sc = 2.6;
  F.save(); F.translate(x, y); F.rotate(-0.25 + u * 0.4); F.scale(sc, sc); F.filter = 'blur(2px)';
  const g = F.createLinearGradient(60, 0, -80, -60); g.addColorStop(0, '#6a5578'); g.addColorStop(0.5, '#3a2c48'); g.addColorStop(1, '#120c1a'); F.fillStyle = g;
  F.beginPath(); F.ellipse(-40, 0, 60, 46, 0, 0, 7); F.fill(); F.beginPath(); F.roundRect(-300, -36, 260, 74, 30); F.fill();
  for (const [fy, len] of [[-34, 70], [-12, 82], [10, 78], [32, 62]]) { F.beginPath(); F.roundRect(10, fy - 9, len, 18, 9); F.fill(); }
  F.beginPath(); F.roundRect(-30, -66, 18, 54, 9); F.fill();
  F.strokeStyle = 'rgba(255,214,160,0.7)'; F.lineWidth = 3; for (const [fy, len] of [[-34, 70], [-12, 82], [10, 78], [32, 62]]) { F.beginPath(); F.arc(10 + len - 9, fy, 8, -1.4, 1.4); F.stroke(); }
  F.restore();
}
