'use strict';
// ------------------------------------------------------------------
// PART 5 · CHAPTER IV · ONE PLANK SHORT   (story t 51.6 → 66.6  ≈ real T 56.4 → 71.4)
// It builds a moonstone staircase up into the sky; the moon draws near. It stops exactly one slab short,
// turns and holds up "WANT ME TO CONTINUE?". Tip: avoid stopping while you still owe work. The last slab lands.
// ------------------------------------------------------------------
const CAMKEYS5 = [[51.8, 232, 172, 1.4], [52.8, 300, 120, 1.35], [53.8, 390, 40, 1.4], [54.8, 470, -50, 1.7], [55.4, 488, -72, 1.85], [60.2, 488, -72, 1.88], [60.6, 476, -62, 2.05], [64.0, 476, -62, 2.0], [65.0, 492, -80, 1.7], [66.6, 500, -90, 1.6]];
const STAIR_T = [[6, 52.2], [7, 52.6], [8, 53.0], [9, 53.4], [10, 53.8], [11, 54.2], [12, 54.6], [13, 64.75]];
function slabOrigin(k) { return k <= 5 ? [34, -18 * k, (k - 1) * 6] : [34, -90 - (k - 5) * 11, 24 + (k - 5) * 12]; }
function slabTop(k) { const o = slabOrigin(k); return [o[0] + 6, o[1] + 9, o[2] + 3]; }
// the moon approaches during the climb: from far in the sky to just past the end of the stair
function moonBlend(t) { return sm(51.9, 55.2, t); }
function moonTarget() { const top = PREF(...slabTop(13)); return [top[0] + 36, top[1] - 32]; }

function heroAt5(t) {
  const st = { eyes: 'open', look: [2, -2], mouth: 'smile', arm: 0.6, hop: 0, squash: 0, walk: null, breathe: 0, blink: 0 };
  const at = (k) => slabTop(k);
  let p = at(4);
  if (t < 51.8) { p = at(4); }
  else if (t < 54.8) {       // hop onto each new slab just after it lands
    const steps = [[51.8, 4], [52.2, 5], [52.4, 6], [52.8, 7], [53.2, 8], [53.6, 9], [54.0, 10], [54.4, 11], [54.8, 12]];
    let i = 0; while (i < steps.length - 2 && t > steps[i + 1][0]) i++; const [t0, k0] = steps[i], [t1, k1] = steps[i + 1], u = clamp((t - t0) / (t1 - t0), 0, 1), a = at(k0), b = at(k1);
    p = [lerp(a[0], b[0], ease(u)), lerp(a[1], b[1], ease(u)), lerp(a[2], b[2], ease(u))]; st.hop = Math.sin(u * Math.PI) * 7; st.squash = u < 0.12 ? 0.13 : u > 0.88 ? 0.1 : -0.1; st.arm = 1;
  }
  else if (t < 55.4) { p = at(12); const u = (t - 54.8) / 0.6; st.squash = 0.12 * Math.sin(u * Math.PI); st.look = u < 0.5 ? [2, -2] : [1, 1]; st.mouth = 'o'; }
  else if (t < 58.2) { p = at(12); st.look = [0, 1]; st.mouth = 'smile'; st.arm = sm(55.4, 55.6, t); st.blink = (t > 56.6 && t < 56.68) || (t > 57.6 && t < 57.68) ? 1 : 0; }
  else if (t < 60.6) { p = at(12); st.look = [0, 1]; st.mouth = 'flat'; st.arm = 0.4; st.blink = (t > 59.3 && t < 59.38) ? 1 : 0; }
  else if (t < 63.7) { p = at(12); const bonk = [60.95, 61.35].some(a => t > a && t < a + 0.12); st.squash = bonk ? 0.18 : 0.03; st.eyes = bonk ? 'closed' : 'open'; st.look = t > 61.6 ? [2, -2] : [0, -1]; st.mouth = t > 61.7 ? 'smile' : 'flat'; st.shine = t > 61.7; }
  else if (t < 64.0) { p = at(12); const u = (t - 63.7) / 0.3; st.arm = Math.sin(u * Math.PI); st.look = [-1, 0]; st.mouth = 'smile'; st.squash = -0.06 * Math.sin(u * Math.PI); }
  else if (t < 65.0) { p = at(12); const u = (t - 64.0) / 1.0; st.hop = u > 0.55 ? Math.sin((u - 0.55) / 0.45 * Math.PI) * 9 : 0; st.squash = u < 0.5 ? 0.15 * sm(0, 0.5, u) : u > 0.95 ? 0.2 : -0.12; st.arm = 1; st.look = [2, -2]; st.mouth = 'o'; }
  else { const u = clamp((t - 65.0) / 0.6, 0, 1), a = at(12), b = at(13); p = [lerp(a[0], b[0], ease(u)), lerp(a[1], b[1], ease(u)), lerp(a[2], b[2], ease(u))]; st.hop = Math.sin(u * Math.PI) * 7; st.look = [2, -2]; st.mouth = 'smile'; st.shine = true; st.arm = 1; }
  return { x: p[0], y: p[1], z: p[2], st };
}
// staircase slabs 6..13 materialise with a pop; the last one slams in with a flare
function stairW(B, t, only) {
  for (const [k, land] of STAIR_T) {
    if (t < land - 0.12 || (only !== undefined && only !== k)) continue; const pop = sm(land - 0.12, land, t), o = slabOrigin(k), c = P(o[0] + 6, o[1] + 9, o[2] + 2), fresh = Math.max(0, 1 - (t - land) / 0.5), big = k === 13 ? 2.2 : 1;
    B.glow(c[0] - 44 * big, c[1] - 30 * big, c[0] + 44 * big, c[1] + 30 * big, hex('c3b9e0'), (x, y) => (0.25 + 0.55 * fresh) * Math.max(0, 1 - Math.hypot((x - c[0]) / (36 * big), (y - c[1]) / (22 * big))));
    box(B, o[0] + 6 * (1 - pop), o[1] + 9 * (1 - pop), o[2] + (1 - pop) * (k === 13 ? 20 : 4), 12 * pop, 18 * pop, 3, MOONS.t, MOONS.l, MOONS.r);
    if (pop > 0.98) { const a = P(o[0] + 2, o[1] + 4, o[2] + 3), b = P(o[0] + 10, o[1] + 14, o[2] + 3); B.line(a[0], a[1], b[0], b[1], hex('ffffff')); }
    if (fresh > 0) dustPuff(B, t, land, c, k === 13 ? 14 : 8);
  }
}
// hi-res: the sign it holds up, and the pencil's two little taps
function signHi(F, t, H) {
  const up = sm(55.45, 55.7, t) * (1 - sm(57.95, 58.2, t)); if (up <= 0) return; const hs = heroScreen(H), w = 440, h = 170, x = hs.x - w / 2 + 10, y = hs.y - 250 - h + (1 - up) * 60;
  F.save(); F.globalAlpha = up; F.fillStyle = '#8a5a3a'; F.fillRect(hs.x - 6, y + h - 6, 12, 120 * up);
  F.shadowColor = 'rgba(0,0,0,0.5)'; F.shadowBlur = 20; F.shadowOffsetY = 8; F.fillStyle = '#f3ead6'; F.beginPath(); F.roundRect(x, y, w, h, 10); F.fill(); F.shadowColor = 'transparent';
  F.strokeStyle = '#b07a4f'; F.lineWidth = 8; F.beginPath(); F.roundRect(x, y, w, h, 10); F.stroke();
  hiText(F, 'WANT ME TO', hs.x + 10, y + 34, 7, '#2a2350', { align: 'c', shadow: false }); hiText(F, 'CONTINUE?', hs.x + 10, y + 100, 7, '#d97757', { align: 'c', shadow: false });
  F.restore();
}
function pencilNudge(F, t, H) {
  if (t < 60.4 || t > 62.0) return; const hs = heroScreen(H), inn = ease(clamp((t - 60.4) / 0.4, 0, 1)), out = ease(clamp((t - 61.6) / 0.4, 0, 1));
  const tap = [60.95, 61.35].reduce((m, a) => Math.max(m, Math.max(0, 1 - Math.abs(t - a - 0.05) / 0.12)), 0);
  drawPencil(F, hs.x - 10 - (1 - inn) * 400 - out * 400, hs.y - 30 - (1 - tap) * 60 - (1 - inn) * 500 - out * 500, -2.1, 0.7, { eraser: true });
}
function moonFlare(F, t) {
  if (t < 64.7 || t > 66.6) return; const m = moonScreen(), u = (t - 64.75) / 1.8, a = Math.max(0, Math.sin(clamp(u, 0, 1) * Math.PI)) * 0.55;
  F.save(); F.globalCompositeOperation = 'lighter'; const g = F.createRadialGradient(m.x, m.y, m.r * 0.6, m.x, m.y, m.r * 3.4); g.addColorStop(0, `rgba(255,236,190,${a})`); g.addColorStop(1, 'rgba(255,220,160,0)'); F.fillStyle = g; F.fillRect(0, 0, FW, FH); F.restore();
}

function signToss(B, t, H) {
  if (t < 63.7 || t > 64.6) return; const u = (t - 63.7) / 0.9, hd = H.r ? H.r.head : P(H.x, H.y, 16), k = ISO.k / 1.4;
  const x = hd[0] + 6 * k - u * 70 * k, y = hd[1] - 6 * k - Math.sin(u * Math.PI) * 50 * k + u * u * 120 * k, r = 4 * k;
  B.circle(x, y, r, COL.paper); B.circle(x - r * 0.3, y - r * 0.3, r * 0.5, COL.planeL); B.put(x + r * 0.3, y + r * 0.2, COL.paperS); B.put(x - r * 0.4, y + r * 0.4, COL.paperD);
}
