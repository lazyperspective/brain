// ------------------------------------------------------------------
// KILN OS · PULSE — a voice-first, kinetic interface drawn into the phone's screen texture (1080 × 2376).
// Language: warm black, hard colour blocks (clay / ember / cream), heavy Inter at display sizes, everything springs,
// wipes and snaps on the beat. The assistant is "the Wave" — and before it speaks, "the Iris" (a ring echoing the camera).
// draw(state): state = { scene, lt (local time in scene), t (film time), ...scene params }
// ------------------------------------------------------------------
import * as THREE from 'three';
import { spr, sm, lin, clamp, eo, eo5, ei, beatKick, mix } from './engine.js';

export const SW = 1080, SH = 2376;
const F = '"Inter", system-ui, sans-serif';
export const C = { black: '#0b0909', ink: '#151211', graph: '#221e1d', graph2: '#2d2827', clay: '#d97757', ember: '#ff5b2c', cream: '#f0e6dc', bone: '#fff7ef', mute: 'rgba(240,230,220,0.55)', dim: 'rgba(240,230,220,0.32)' };
const ASK_Y = 873, ASK_H = 409;   // where the hardware Ask strip sits, in screen pixels (left edge)

// ---------------------------------------------------------------- primitives
function rr(x, X, Y, w, h, r) { x.beginPath(); x.roundRect(X, Y, w, h, Math.max(0, Math.min(r, w / 2, h / 2))); }
function block(x, X, Y, w, h, r, fill) { if (w <= 0 || h <= 0) return; rr(x, X, Y, w, h, r); x.fillStyle = fill; x.fill(); }
function T(x, s, X, Y, size, wt, col, align = 'left', ls = 0, base = 'alphabetic') { x.font = `${wt} ${size}px ${F}`; x.fillStyle = col; x.textAlign = align; x.textBaseline = base; x.letterSpacing = ls + 'px'; x.fillText(s, X, Y); x.letterSpacing = '0px'; }
function TW(x, s, size, wt, ls = 0) { x.font = `${wt} ${size}px ${F}`; x.letterSpacing = ls + 'px'; const w = x.measureText(s).width; x.letterSpacing = '0px'; return w; }
function label(x, s, X, Y, col = C.mute, size = 30, align = 'left') { T(x, s, X, Y, size, 700, col, align, size * 0.2); }
function chip(x, s, X, Y, size, bg, fg, padX = 26, h = null) { const w = TW(x, s, size, 700, size * 0.12) + padX * 2, hh = h || size * 1.9; block(x, X, Y, w, hh, hh / 2, bg); T(x, s, X + padX, Y + hh / 2 + size * 0.36, size, 700, fg, 'left', size * 0.12); return w; }
// clip-rect reveal helper: draws fn inside a rect that wipes in (dir: 'up' | 'down' | 'left' | 'right')
function wipe(x, X, Y, w, h, k, dir, fn) {
  if (k <= 0) return; x.save(); x.beginPath();
  if (dir === 'up') x.rect(X, Y + h * (1 - k), w, h * k); else if (dir === 'down') x.rect(X, Y, w, h * k); else if (dir === 'left') x.rect(X + w * (1 - k), Y, w * k, h); else x.rect(X, Y, w * k, h);
  x.clip(); fn(); x.restore();
}
// odometer text: each glyph rolls up into its own clip box with a staggered spring
function roll(x, s, X, Y, size, wt, col, lt, t0, stag = 0.05, ls = 0, align = 'left') {
  x.font = `${wt} ${size}px ${F}`; x.letterSpacing = ls + 'px'; const tw = x.measureText(s).width; let cx = align === 'center' ? X - tw / 2 : align === 'right' ? X - tw : X;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]; x.font = `${wt} ${size}px ${F}`; x.letterSpacing = ls + 'px'; const cw = x.measureText(ch).width; const p = spr(lt, t0 + i * stag, 2.6, 0.42);
    if (p > 0.001) { x.save(); x.beginPath(); x.rect(cx - 10, Y - size * 0.95, cw + 20, size * 1.15); x.clip(); T(x, ch, cx, Y + (1 - p) * size * 1.05, size, wt, col, 'left', ls); x.restore(); }
    cx += cw;
  }
  x.letterSpacing = '0px'; return tw;
}
// words that land one by one (spring up from a mask), wrapping; hl = { word: [bg, fg] } turns into a block chip
function words(x, list, X, Y, maxW, size, lh, appear, lt, opts = {}) {
  const wt = opts.wt || 800, col = opts.col || C.bone, hl = opts.hl || {}; let cx = X, cy = Y; const sp = size * 0.28;
  for (let i = 0; i < list.length; i++) {
    const w = list[i], ww = TW(x, w, size, wt, -size * 0.03); if (opts.lines ? (i > 0 && opts.lines[i] !== opts.lines[i - 1]) : (cx + ww > X + maxW && cx > X)) { cx = X; cy += lh; }
    const p = spr(lt, appear[i], 3.2, 0.45); if (p > 0.001 && lt >= appear[i]) {
      const key = w.replace(/[.,!?¡¿—]/g, '').toLowerCase(), H = hl[key];
      x.save(); x.beginPath(); x.rect(cx - 20, cy - size * 1.05, ww + 40, size * 1.4); x.clip();
      const dy = (1 - p) * size * 1.1;
      if (H) { const hk = spr(lt, appear[i] + 0.12, 3, 0.5); block(x, cx - 14, cy - size * 0.86 + dy, (ww + 28) * clamp(hk, 0, 1.05), size * 1.12, 18, H[0]); T(x, w, cx, cy + dy, size, wt, hk > 0.5 ? H[1] : col, 'left', -size * 0.03); }
      else T(x, w, cx, cy + dy, size, wt, col, 'left', -size * 0.03);
      x.restore();
    }
    cx += ww + sp;
  }
  return cy;
}
// synthetic speech energy (syllables) for the wave
export function speech(t, seed = 0) { const a = Math.abs(Math.sin(t * 11.3 + seed)) * (0.55 + 0.45 * Math.sin(t * 3.7 + seed * 2)), b = Math.abs(Math.sin(t * 17.1 + 1.3 + seed)); return clamp(0.25 + 0.75 * a * (0.6 + 0.4 * b), 0, 1); }
// THE WAVE — layered luminous ribbons; energy 0..1
function wave(x, cx, cy, w, amp, t, energy, opts = {}) {
  const layers = opts.layers || [[C.ember, 1.0, 1.0, 0], [C.clay, 0.8, 1.6, 1.7], ['#ffb08a', 0.62, 2.3, 3.1], [C.cream, 0.42, 3.1, 4.6], ['#ff3d1a', 0.9, 0.7, 2.2]];
  x.save(); x.globalCompositeOperation = 'lighter';
  const N = 90, A = amp * (0.25 + 0.75 * energy);
  for (const [col, ga, kf, ph] of layers) {
    const top = [], k = 2 * Math.PI * (1.2 + kf * 0.55) / w;
    for (let i = 0; i <= N; i++) { const u = i / N, X = cx - w / 2 + u * w, env = Math.pow(Math.sin(Math.PI * u), 2.2), y = A * ga * env * (0.65 * Math.sin(k * (X - cx) + t * (4 + kf * 1.3) + ph) + 0.35 * Math.sin(k * 2.3 * (X - cx) - t * (6.1 + kf) + ph * 1.7)); top.push([X, y]); }
    x.beginPath(); top.forEach(([X, y], i) => i ? x.lineTo(X, cy - Math.abs(y) - 2) : x.moveTo(X, cy - Math.abs(y) - 2)); for (let i = N; i >= 0; i--) x.lineTo(top[i][0], cy + Math.abs(top[i][1]) + 2); x.closePath();
    const g = x.createLinearGradient(0, cy - A, 0, cy + A); g.addColorStop(0, col + '00'); g.addColorStop(0.5, col + 'aa'); g.addColorStop(1, col + '00'); x.fillStyle = g; x.globalAlpha = 0.55; x.fill();
    x.globalAlpha = 0.9; x.strokeStyle = col; x.lineWidth = 3; x.beginPath(); top.forEach(([X, y], i) => i ? x.lineTo(X, cy + y) : x.moveTo(X, cy + y)); x.stroke();
  }
  // hot core
  x.globalAlpha = 0.9; const g = x.createLinearGradient(cx - w / 2, 0, cx + w / 2, 0); g.addColorStop(0, 'rgba(255,240,230,0)'); g.addColorStop(0.5, 'rgba(255,240,230,1)'); g.addColorStop(1, 'rgba(255,240,230,0)'); x.fillStyle = g; x.fillRect(cx - w / 2, cy - 2.5, w, 5);
  x.restore();
}
// THE IRIS — concentric segmented rings, echoing the camera iris; open 0..1, used as the idle/listening seed
function iris(x, cx, cy, r, t, k = 1, open = 0.5) {
  if (k <= 0) return; x.save(); x.globalAlpha = k;
  const g = x.createRadialGradient(cx, cy, 0, cx, cy, r * 2.2); g.addColorStop(0, 'rgba(255,110,60,0.45)'); g.addColorStop(1, 'rgba(255,90,40,0)'); x.fillStyle = g; x.fillRect(cx - r * 2.2, cy - r * 2.2, r * 4.4, r * 4.4);
  // blades
  for (let i = 0; i < 9; i++) { const a0 = i / 9 * Math.PI * 2 + t * 0.6; x.beginPath(); x.arc(cx, cy, r, a0, a0 + 0.62); x.arc(cx, cy, r * (0.38 + 0.3 * open), a0 + 0.95, a0 + 0.2, true); x.closePath(); x.fillStyle = i % 2 ? C.clay : C.ember; x.fill(); }
  x.lineWidth = 6; x.strokeStyle = C.cream; x.beginPath(); x.arc(cx, cy, r * 1.12, 0, 7); x.stroke();
  x.lineWidth = 3; x.globalAlpha = k * 0.5; x.beginPath(); x.arc(cx, cy, r * 1.32, t * 1.3, t * 1.3 + 4.4); x.stroke();
  x.globalAlpha = k; x.fillStyle = C.black; x.beginPath(); x.arc(cx, cy, r * 0.3 * (0.5 + open * 0.6), 0, 7); x.fill();
  x.fillStyle = C.bone; x.beginPath(); x.arc(cx - r * 0.07, cy - r * 0.08, r * 0.06, 0, 7); x.fill();
  x.restore();
}
function pulseLine(x, X, Y, w, t, col = C.clay, a = 1) {   // a tiny heartbeat trace that beats with the music
  x.save(); x.globalAlpha = a; x.strokeStyle = col; x.lineWidth = 4; x.lineJoin = 'round'; x.beginPath();
  const bk = beatKick(t, 0.25);
  for (let i = 0; i <= 60; i++) { const u = i / 60, X2 = X + u * w, c = Math.exp(-Math.pow((u - 0.5) * 9, 2)); const y = Y - c * Math.sin(u * 60) * 22 * (0.3 + bk); i ? x.lineTo(X2, y) : x.moveTo(X2, y); } x.stroke(); x.restore();
}
function status(x, t, a = 1, col = C.bone) {
  if (a <= 0) return; x.save(); x.globalAlpha = a;
  T(x, 'KILN', 84, 104, 30, 800, col, 'left', 7); pulseLine(x, 190, 96, 90, t, C.ember);
  for (let i = 0; i < 4; i++) block(x, SW - 270 + i * 16, 104 - 12 - i * 6, 10, 12 + i * 6, 3, col);
  x.strokeStyle = col; x.lineWidth = 3; rr(x, SW - 178, 78, 78, 34, 11); x.stroke(); block(x, SW - 172, 84, 52, 22, 6, col); block(x, SW - 97, 88, 6, 14, 2, col);
  x.restore();
}
function homeBar(x, a = 1, col = C.bone) { x.save(); x.globalAlpha = a * 0.85; block(x, SW / 2 - 150, SH - 70, 300, 12, 6, col); x.restore(); }
// the screen edge lights from the Ask strip and runs around the glass
function edgeGlow(x, k, t) {
  if (k <= 0) return; x.save(); x.globalCompositeOperation = 'lighter';
  const g = x.createRadialGradient(0, ASK_Y, 0, 0, ASK_Y, 900 * (0.4 + 0.6 * k)); g.addColorStop(0, `rgba(255,110,60,${0.75 * k})`); g.addColorStop(0.4, `rgba(255,90,40,${0.25 * k})`); g.addColorStop(1, 'rgba(255,80,30,0)'); x.fillStyle = g; x.fillRect(0, 0, SW, SH);
  const run = clamp(k * 1.4, 0, 1);
  for (let i = 0; i < 3; i++) { x.globalAlpha = (0.25 + i * 0.25) * k; x.lineWidth = 36 - i * 12; const gg = x.createLinearGradient(0, 0, 0, SH); gg.addColorStop(0, '#ff9a6a'); gg.addColorStop(0.5, '#ff5b2c'); gg.addColorStop(1, '#ffb48a'); x.strokeStyle = gg; x.setLineDash([SH * 2.6 * run, 99999]); x.lineDashOffset = -(ASK_Y - 120) + 0; rr(x, 8, 8, SW - 16, SH - 16, 140); x.stroke(); }
  x.setLineDash([]); x.restore();
}
function slam(x, lt, t0 = 0, col = 'rgba(255,247,239,') { const f = 1 - lin(t0, t0 + 0.14, lt); if (f > 0 && lt >= t0) { x.fillStyle = col + (f * 0.95) + ')'; x.fillRect(0, 0, SW, SH); } }
function avatar(x, cx, cy, r, ini, bg, fg) { x.fillStyle = bg; x.beginPath(); x.arc(cx, cy, r, 0, 7); x.fill(); T(x, ini, cx, cy + r * 0.36, r, 800, fg, 'center'); }
function check(x, cx, cy, r, k, bg = C.ember) { if (k <= 0) return; x.save(); x.translate(cx, cy); x.scale(k, k); x.fillStyle = bg; x.beginPath(); x.arc(0, 0, r, 0, 7); x.fill(); x.strokeStyle = C.black; x.lineWidth = r * 0.28; x.lineCap = 'round'; x.lineJoin = 'round'; x.beginPath(); x.moveTo(-r * 0.42, 0); x.lineTo(-r * 0.1, r * 0.32); x.lineTo(r * 0.45, -r * 0.35); x.stroke(); x.restore(); }

// ---------------------------------------------------------------- scenes
const S = {};
S.off = () => {};

// LOCK — slams on: white hit, digits roll up, blocks snap
S.lock = (x, s) => {
  const lt = s.lt, t = s.t, bk = beatKick(t);
  x.fillStyle = C.black; x.fillRect(0, 0, SW, SH);
  // clay block from the bottom, ember sliver
  const b = spr(lt, 0.05, 2.2, 0.5); block(x, 0, SH - 1560 * b, SW, 1700, 0, C.clay);
  block(x, 0, SH - 1560 * b - 26, SW * spr(lt, 0.2, 2, 0.6), 26, 0, C.ember);
  status(x, t, lin(0.1, 0.3, lt), C.bone);
  wipe(x, 0, 160, SW, 120, spr(lt, 0.15, 3, 0.6), 'right', () => { label(x, 'THU 13 NOV', 84, 240, C.bone, 38); label(x, '18° · CLEAR', SW - 84, 240, C.mute, 38, 'right'); });
  // giant stacked time
  roll(x, '07', 70, 760, 560, 900, C.bone, lt, 0.08, 0.06, -30);
  roll(x, '24', 70, 1350, 560, 900, C.black, lt, 0.16, 0.06, -30);
  // beat dots (the colon, alive)
  for (let i = 0; i < 2; i++) { const k = spr(lt, 0.3 + i * 0.05, 3, 0.4); x.fillStyle = C.ember; x.beginPath(); x.arc(870, 520 + i * 150, (34 + 10 * bk) * k, 0, 7); x.fill(); }
  // catch-me-up block
  const n = spr(lt, 0.35, 2.6, 0.45); if (n > 0) { x.save(); x.translate(84, 1450); x.scale(1, clamp(n, 0, 1.2)); block(x, 0, 0, SW - 168, 230, 48, C.black); x.restore();
    if (n > 0.6) { T(x, '47', 130, 1620, 150, 900, C.ember, 'left', -6); T(x, 'updates while you slept', 380, 1545, 40, 700, C.bone); T(x, 'Hold Ask: “catch me up”', 380, 1610, 38, 500, C.mute); } }
  // the hint at the Ask key (left edge) — chevrons beat toward the hardware strip
  const ha = lin(0.5, 0.8, lt); if (ha > 0) { x.save(); x.globalAlpha = ha; block(x, 0, ASK_Y + 120 - ASK_H / 2, 14, ASK_H, 7, C.ember);
    for (let i = 0; i < 3; i++) { const p = ((t * 2 + i / 3) % 1); x.globalAlpha = ha * (1 - p); x.strokeStyle = C.bone; x.lineWidth = 7; x.lineCap = 'round'; const X = 80 + (1 - p) * 70; x.beginPath(); x.moveTo(X + 20, 1860 - 26); x.lineTo(X, 1860); x.lineTo(X + 20, 1860 + 26); x.stroke(); }
    x.globalAlpha = ha; T(x, 'HOLD ASK', 190, 1876, 46, 900, C.black, 'left', 8); T(x, 'and think out loud', 190, 1934, 36, 600, 'rgba(11,9,9,0.65)'); x.restore(); }
  homeBar(x, lin(0.5, 0.8, lt), C.black);
  slam(x, lt, 0);
};

// LISTEN — the iris blooms into the wave, words land
const REQ = ['Book', 'dinner', 'for', 'four,', 'somewhere', 'quiet,', '8pm.'];
export const REQ_T = [0.0, 0.25, 0.5, 0.625, 1.0, 1.5, 2.0];   // word onsets (s) after speech start — on 8ths/16ths
S.listen = (x, s) => {
  const lt = s.lt, t = s.t; x.fillStyle = C.black; x.fillRect(0, 0, SW, SH);
  const ja = s.justAsk || 0, sp = s.speak ?? -9;   // sp = seconds since speech started
  edgeGlow(x, sm(0, 0.35, lt), t);
  status(x, t, 0.9);
  // header
  const hk = spr(lt, 0.05, 3, 0.5);
  if (hk > 0) { x.save(); x.globalAlpha = clamp(hk, 0, 1); x.fillStyle = C.ember; x.beginPath(); x.arc(102, 232, 13 * (0.7 + 0.3 * beatKick(t)), 0, 7); x.fill(); label(x, 'LISTENING', 132, 244, C.bone, 34); const secs = Math.max(0, sp); label(x, `00:0${Math.floor(clamp(secs, 0, 9))}`, SW - 84, 244, C.mute, 34, 'right'); x.restore(); }
  // the iris (match-cut seed), centred where the camera iris sat in the macro
  const irisK = 1 - sm(0.55, 0.95, Math.max(lt - (s.irisHold || 0), 0)), irisY = s.irisY ?? 1000;
  if (irisK > 0) { const r = 190 * (0.75 + 0.25 * spr(lt, 0, 2.5, 0.4)); x.save(); x.translate(SW / 2, irisY); x.scale(1 + (1 - irisK) * 1.8, irisK); iris(x, 0, 0, r, t, 1, 0.3 + 0.5 * spr(lt, 0, 2, 0.5)); x.restore(); }
  // JUST ASK. — big kinetic type inside the screen
  if (ja > 0) { const a = spr(ja, 0, 3, 0.45), b = spr(ja, 0.25, 3, 0.45);
    x.save(); x.beginPath(); x.rect(0, 1240, SW, 300); x.clip(); T(x, 'JUST', 70, 1500 + (1 - a) * 300, 300, 900, C.bone, 'left', -16); x.restore();
    x.save(); x.beginPath(); x.rect(0, 1540, SW, 300); x.clip(); T(x, 'ASK.', 70, 1800 + (1 - b) * 300, 300, 900, C.ember, 'left', -16); x.restore(); }
  // the wave
  const wk = sm(0.45, 0.85, lt) * (1 - sm(0, 0.3, ja > 0 && sp < 0 ? 0 : 0));
  if (wk > 0) { const e = sp > -0.2 && sp < 2.3 ? speech(t) : 0.18 + 0.08 * Math.sin(t * 3); x.save(); x.globalAlpha = wk; wave(x, SW / 2, s.waveY ?? 900, SW * 0.98 * (0.4 + 0.6 * wk), 230, t, e); x.restore(); }
  // transcript
  if (sp > -0.1) {
    words(x, REQ, 84, 1400, SW - 168, 132, 158, REQ_T, sp, { lines: [0, 0, 1, 1, 2, 3, 3], hl: { four: [C.clay, C.black], quiet: [C.cream, C.black], '8pm': [C.ember, C.black] } });
    const dk = lin(2.3, 2.5, sp); if (dk > 0) { x.save(); x.globalAlpha = dk; label(x, 'ON IT  ·  3 QUIET PLACES NEARBY', 84, 2060, C.ember, 36); block(x, 84, 2090, (SW - 168) * eo(lin(2.3, 3.0, sp)), 10, 5, C.ember); x.restore(); }
  }
  homeBar(x, 0.6);
};

// BUILD — the answer arrives as blocks that snap in on the beat
const PLACES = [['Sable & Rye', 'Harbour St · 0.6 km', 92], ['Osteria Lume', 'Canal Row · 1.1 km', 81], ['Hanami House', 'Old Mill · 1.8 km', 77]];
S.build = (x, s) => {
  const lt = s.lt, t = s.t, bk = beatKick(t); x.fillStyle = C.black; x.fillRect(0, 0, SW, SH);
  status(x, t, 1);
  // header block: cream, drops from top
  const h = spr(lt, 0.0, 2.6, 0.45); x.save(); x.translate(0, (1 - h) * -420);
  block(x, 60, 150, SW - 120, 380, 54, C.cream);
  label(x, 'KILN  ·  ON IT', 112, 236, 'rgba(11,9,9,0.55)', 30);
  T(x, 'Dinner for 4', 104, 370, 132, 900, C.black, 'left', -6);
  let cx = 112; [['THU', C.black, C.cream], ['20:00', C.ember, C.black], ['QUIET', C.clay, C.black], ['≤ 2 KM', C.black, C.cream]].forEach(([s2, bg, fg], i) => { const k = spr(lt, 0.15 + i * 0.06, 3, 0.5); if (k > 0) { x.save(); x.globalAlpha = clamp(k, 0, 1); cx += chip(x, s2, cx, 415 + (1 - k) * 30, 34, bg, fg) + 14; x.restore(); } });
  x.restore();
  // option rows
  PLACES.forEach(([nm, sub, q], i) => {
    const t0 = 0.25 + i * 0.25, k = spr(lt, t0, 2.8, 0.42); if (k <= 0) return; const Y = 570 + i * 232, sel = i === 0, pick = s.pick ?? 0;
    x.save(); x.translate((1 - k) * SW, 0); const bg = sel ? C.ember : C.graph; block(x, 60, Y, SW - 120, 212, 44, bg);
    if (sel && pick > 0) { x.save(); x.globalAlpha = 0.25 * (1 - pick); block(x, 60, Y, SW - 120, 212, 44, C.bone); x.restore(); }
    T(x, '0' + (i + 1), 104, Y + 92, 40, 800, sel ? 'rgba(11,9,9,0.6)' : C.dim);
    T(x, nm, 190, Y + 98, 64, 900, sel ? C.black : C.bone, 'left', -2); T(x, sub, 192, Y + 158, 36, 600, sel ? 'rgba(11,9,9,0.7)' : C.mute);
    // quiet meter: 10 bars filling on the beat
    for (let j = 0; j < 10; j++) { const on = j < Math.round(q / 10) * clamp(lin(t0 + 0.1, t0 + 0.6, lt), 0, 1); block(x, 760 + j * 22, Y + 66 - j * 3, 13, 50 + j * 3, 4, on ? (sel ? C.black : C.clay) : (sel ? 'rgba(11,9,9,0.2)' : 'rgba(240,230,220,0.14)')); }
    T(x, 'QUIET ' + q, 980, Y + 168, 30, 800, sel ? C.black : C.mute, 'right', 3);
    x.restore();
  });
  // map block
  const m = spr(lt, 1.0, 2.4, 0.5); if (m > 0) { const Y = 1290, Hm = 520; x.save(); rr(x, 60, Y, SW - 120, Hm * clamp(m, 0, 1.1), 48); x.clip(); mapBlock(x, 60, Y, SW - 120, Hm, lt - 1.0, t); x.restore(); }
  // button
  const bt = spr(lt, 1.25, 3, 0.45), tap = s.tap ?? -9; if (bt > 0) {
    const press = tap >= 0 ? 1 - 0.05 * Math.sin(clamp(tap / 0.18, 0, 1) * Math.PI) : 1; x.save(); x.translate(SW / 2, 1960 + 85); x.scale(press * clamp(bt, 0, 1.1), press); x.translate(-SW / 2, -(1960 + 85));
    block(x, 60, 1960, SW - 120, 170, 85, C.bone); T(x, 'Book Sable & Rye  ·  20:00', 118, 2064, 50, 900, C.black, 'left', -1);
    x.fillStyle = C.ember; x.beginPath(); x.arc(SW - 145, 2045, 52 + 6 * bk, 0, 7); x.fill(); x.strokeStyle = C.black; x.lineWidth = 9; x.lineCap = 'round'; x.beginPath(); x.moveTo(SW - 168, 2045); x.lineTo(SW - 122, 2045); x.moveTo(SW - 142, 2022); x.lineTo(SW - 120, 2045); x.lineTo(SW - 142, 2068); x.stroke();
    x.restore();
    if (tap >= 0) { const r = eo(lin(0, 0.45, tap)) * 900; x.save(); x.globalAlpha = 0.45 * (1 - lin(0, 0.45, tap)); x.fillStyle = C.ember; x.beginPath(); x.arc(SW - 145, 2045, r, 0, 7); x.fill(); x.restore();
      x.save(); x.globalAlpha = 1 - lin(0.1, 0.3, tap); x.strokeStyle = C.bone; x.lineWidth = 8; x.beginPath(); x.arc(SW - 145, 2045, 60 + 120 * eo(lin(0, 0.3, tap)), 0, 7); x.stroke(); x.restore(); }
  }
  homeBar(x, 0.6);
};
function mapBlock(x, X, Y, w, h, lt, t) {
  x.fillStyle = '#1a1615'; x.fillRect(X, Y, w, h);
  x.save(); x.translate(X, Y);
  // river
  x.strokeStyle = '#2b2422'; x.lineWidth = 70; x.beginPath(); x.moveTo(-20, h * 0.75); x.bezierCurveTo(w * 0.3, h * 0.55, w * 0.55, h * 1.0, w + 20, h * 0.62); x.stroke();
  // streets
  x.strokeStyle = '#3a3230'; x.lineWidth = 6; for (let i = 0; i < 9; i++) { x.beginPath(); x.moveTo(i * 120 - 40, -10); x.lineTo(i * 120 + 60, h + 10); x.stroke(); }
  x.lineWidth = 4; for (let i = 0; i < 6; i++) { x.beginPath(); x.moveTo(-10, i * 95 + 20); x.lineTo(w + 10, i * 95 - 10); x.stroke(); }
  x.lineWidth = 12; x.strokeStyle = '#4a403d'; x.beginPath(); x.moveTo(-10, h * 0.3); x.lineTo(w + 10, h * 0.42); x.stroke();
  // route draws on
  const P = [[150, 420], [260, 330], [420, 340], [560, 230], [700, 200]], r = eo(lin(0.2, 1.0, lt));
  x.strokeStyle = C.ember; x.lineWidth = 14; x.lineCap = 'round'; x.lineJoin = 'round'; x.setLineDash([]); x.beginPath();
  let tot = 0; const segs = []; for (let i = 1; i < P.length; i++) { const d = Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]); segs.push(d); tot += d; }
  let rem = tot * r; x.moveTo(...P[0]); for (let i = 1; i < P.length && rem > 0; i++) { const u = Math.min(1, rem / segs[i - 1]); x.lineTo(P[i - 1][0] + (P[i][0] - P[i - 1][0]) * u, P[i - 1][1] + (P[i][1] - P[i - 1][1]) * u); rem -= segs[i - 1]; } x.stroke();
  // pins
  const pins = [[700, 200, '1', C.ember], [820, 360, '2', C.clay], [330, 120, '3', C.clay]];
  pins.forEach(([px, py, n, col], i) => { const k = spr(lt, 0.1 + i * 0.12, 3, 0.4); if (k <= 0) return; x.save(); x.translate(px, py); x.scale(k, k); x.fillStyle = col; x.beginPath(); x.arc(0, -40, 40, 0, 7); x.fill(); x.beginPath(); x.moveTo(-22, -22); x.lineTo(0, 10); x.lineTo(22, -22); x.fill(); T(x, n, 0, -26, 40, 900, C.black, 'center'); x.restore(); });
  x.fillStyle = C.bone; x.beginPath(); x.arc(150, 420, 20, 0, 7); x.fill(); x.strokeStyle = 'rgba(255,247,239,0.4)'; x.lineWidth = 4; x.beginPath(); x.arc(150, 420, 20 + 30 * ((t * 2) % 1), 0, 7); x.stroke();
  label(x, 'YOU', 190, 470, C.bone, 28); label(x, '8 MIN WALK', w - 40, h - 40, C.bone, 28, 'right');
  x.restore();
}

// BOOKED — a clay block fills, the word slams, invites tick out
S.booked = (x, s) => {
  const lt = s.lt, t = s.t, bk = beatKick(t); x.fillStyle = C.black; x.fillRect(0, 0, SW, SH);
  const g = spr(lt, 0, 2.2, 0.55), top = mix(1960, 0, clamp(g, 0, 1.05));
  block(x, 0, top, SW, 1500 - top * 0.6, 0, C.clay);
  status(x, t, 1, C.black);
  const L = 'BOOKED.'; let cx = 64; for (let i = 0; i < L.length; i++) { const k = spr(lt, 0.12 + i * 0.035, 3.4, 0.4); const cw = TW(x, L[i], 236, 900, -14); if (k > 0) { x.save(); x.beginPath(); x.rect(cx - 6, 380, cw + 12, 280); x.clip(); T(x, L[i], cx, 620 + (1 - k) * 280, 236, 900, C.black, 'left', -14); x.restore(); } cx += cw; }
  wipe(x, 0, 690, SW, 520, eo(lin(0.35, 0.7, lt)), 'right', () => {
    T(x, 'Sable & Rye', 76, 800, 96, 900, C.black, 'left', -3);
    T(x, 'Thu 13 Nov  ·  20:00  ·  Table for 4', 80, 880, 42, 700, 'rgba(11,9,9,0.78)');
    T(x, 'Back-room booth — the quiet one.', 80, 940, 42, 500, 'rgba(11,9,9,0.62)');
    block(x, 80, 1000, 420, 96, 48, C.black); T(x, 'LEAVE 19:38', 124, 1064, 38, 800, C.bone, 'left', 4);
    block(x, 520, 1000, 330, 96, 48, 'rgba(11,9,9,0.14)'); T(x, '8 MIN', 560, 1064, 38, 800, C.black, 'left', 4);
  });
  // invites
  const ik = spr(lt, 0.7, 2.6, 0.5); if (ik > 0) { const Y = 1330 + (1 - ik) * 600; block(x, 60, Y, SW - 120, 620, 54, C.graph);
    label(x, 'INVITES', 112, Y + 92, C.mute, 32); const sent = lt > 1.45; label(x, sent ? 'SENT  ✓' : 'SENDING…', SW - 112, Y + 92, sent ? C.ember : C.mute, 32, 'right');
    [['M', 'Maya', C.cream], ['A', 'Arun', C.clay], ['J', 'Jo', C.ember]].forEach(([ini, nm, col], i) => { const ax = 210 + i * 330, ay = Y + 300, k = spr(lt, 0.85 + i * 0.1, 3, 0.4);
      if (k > 0) { x.save(); x.translate(ax, ay); x.scale(k, k); avatar(x, 0, 0, 110, ini, col, C.black); x.restore(); T(x, nm, ax, ay + 200, 46, 800, C.bone, 'center'); }
      check(x, ax + 80, ay - 80, 46, spr(lt, 1.1 + i * 0.125, 3.5, 0.4), C.bone); });
  }
  homeBar(x, 0.6);
};

// CATCH ME UP — the dial scrubs, 47 slivers compress into 3 lines
const NOTE3 = [['WORK', 'Maya moved the design review to 11:00.', C.cream], ['TONIGHT', 'Jo’s 10 min late — the table holds till 20:15.', C.clay], ['HOME', 'Parcel lands at 14:00. Sam can sign.', C.graph2]];
S.catchup = (x, s) => {
  const lt = s.lt, t = s.t, c = s.compress ?? 0; x.fillStyle = C.black; x.fillRect(0, 0, SW, SH);
  status(x, t, 1);
  // the dial
  const cx = SW / 2, cy = 640, R = 360, ang = s.dial || 0;
  x.save(); x.translate(cx, cy);
  x.strokeStyle = C.graph2; x.lineWidth = 46; x.beginPath(); x.arc(0, 0, R, 0, 7); x.stroke();
  x.strokeStyle = C.ember; x.lineCap = 'round'; x.beginPath(); x.arc(0, 0, R, -Math.PI / 2, -Math.PI / 2 + 0.05 + c * Math.PI * 1.88); x.stroke(); x.lineCap = 'butt';
  x.rotate(ang); for (let i = 0; i < 60; i++) { const a = i / 60 * Math.PI * 2, big = i % 5 === 0; x.strokeStyle = big ? C.bone : C.dim; x.lineWidth = big ? 7 : 4; x.beginPath(); x.moveTo(Math.cos(a) * (R - 60), Math.sin(a) * (R - 60)); x.lineTo(Math.cos(a) * (R - (big ? 110 : 86)), Math.sin(a) * (R - (big ? 110 : 86))); x.stroke(); }
  x.fillStyle = C.ember; x.beginPath(); x.arc(0, -(R - 150), 16, 0, 7); x.fill();
  x.restore();
  const n = Math.round(mix(47, 3, eo(c))); T(x, String(n), cx, cy + 95, 290, 900, n === 3 ? C.ember : C.bone, 'center', -14);
  label(x, n === 3 ? 'THAT MATTER' : 'UPDATES', cx, cy + 175, C.mute, 34, 'center');
  label(x, 'CATCH ME UP', 84, 1110, C.bone, 34); label(x, c < 1 ? 'COMPRESSING…' : '47 → 3', SW - 84, 1110, c < 1 ? C.mute : C.ember, 34, 'right');
  // slivers → 3 blocks
  const top = 1160, n3 = sm(0.55, 1.0, c);
  for (let i = 0; i < 47; i++) {
    const g = i % 3, yS = top + i * 22 * (1 - eo(c) * 0.7), yB = top + g * 330, Y = mix(yS, yB, n3), hgt = mix(14, 300, n3), a = 1 - lin(0.75, 1, c) * (i >= 3 ? 1 : 0);
    if (a <= 0) continue; x.save(); x.globalAlpha = a * (n3 > 0.01 && i >= 3 ? 0.5 : 1); block(x, 60, Y, SW - 120, hgt, Math.min(44, hgt / 2), n3 > 0.4 ? NOTE3[g][2] : ['#3a3331', '#2d2827', C.clay, '#4a403d'][i % 4]); x.restore();
  }
  if (c >= 0.98) NOTE3.forEach(([tag, txt, col], i) => { const k = spr(lt - s.doneAt, i * 0.1, 3, 0.5); if (k <= 0) return; const Y = top + i * 330, dark = col !== C.graph2; x.save(); x.beginPath(); x.rect(60, Y, SW - 120, 300); x.clip();
    const fg = dark ? C.black : C.bone; chip(x, tag, 104, Y + 40 + (1 - k) * 60, 28, dark ? C.black : C.ember, dark ? col : C.black); wrapText(x, txt, 104, Y + 175 + (1 - k) * 120, SW - 220, 58, 800, fg, 68); x.restore(); });
  homeBar(x, 0.6);
};
function wrapText(x, s, X, Y, maxW, size, wt, col, lh) { const ws = s.split(' '); let line = '', y = Y; for (const w of ws) { const tst = line ? line + ' ' + w : w; if (TW(x, tst, size, wt, -1) > maxW && line) { T(x, line, X, y, size, wt, col, 'left', -1); line = w; y += lh; } else line = tst; } T(x, line, X, y, size, wt, col, 'left', -1); return y; }

// TRANSLATE — the conversation, each phone in its own language
const TR = { en: { me: 'We booked a table for four, under Rivera.', them: 'Perfect! Right this way, please.' }, es: { me: 'Tenemos mesa para cuatro, a nombre de Rivera.', them: '¡Perfecto! Por aquí, por favor.' } };
S.translate = (x, s) => {
  const lt = s.lt, t = s.t, side = s.side || 'en', other = side === 'en' ? 'ES' : 'EN', mine = side.toUpperCase(); x.fillStyle = C.black; x.fillRect(0, 0, SW, SH);
  status(x, t, 1);
  label(x, 'LIVE TRANSLATE', 84, 236, C.mute, 32);
  // giant language code
  T(x, mine, 64, 560, 330, 900, side === 'en' ? C.cream : C.clay, 'left', -18); T(x, '⇄ ' + other, 600, 540, 110, 900, C.dim, 'left', -4);
  // which line is being spoken: line 1 at lt 0..1.4 (spoken by the EN user), line 2 at 1.5..2.9 (the host)
  const l1 = side === 'en' ? TR.en.me : TR.es.me, l2 = side === 'en' ? TR.en.them : TR.es.them;
  const lag = side === 'en' ? 0 : 0.22, lag2 = side === 'en' ? 0.22 : 0;
  const speaking = lt < 1.45 ? (side === 'en') : (side === 'es');
  const e = speaking ? speech(t, side === 'en' ? 0 : 2) : 0.3 * speech(t * 0.7, 5);
  wave(x, SW / 2, 760, SW * 0.92, 150, t, e);
  bubble(x, l1, 1000, lt - lag, side === 'en' ? C.cream : C.clay, C.black, side === 'en' ? 'YOU' : 'TRANSLATED');
  bubble(x, l2, 1560, lt - 1.5 - lag2, side === 'en' ? C.graph2 : C.cream, side === 'en' ? C.bone : C.black, side === 'en' ? 'TRANSLATED' : 'YOU');
  homeBar(x, 0.6);
};
function bubble(x, s, Y, lt, bg, fg, tag) {
  if (lt < 0) return; const k = spr(lt, 0, 2.8, 0.5), ws = s.split(' '), n = Math.min(ws.length, Math.floor(lt / 0.11) + 1);
  x.save(); x.translate(0, (1 - k) * 120); x.globalAlpha = clamp(k * 2, 0, 1);
  block(x, 60, Y, SW - 120, 500, 54, bg); label(x, tag, 112, Y + 84, fg === C.black ? 'rgba(11,9,9,0.55)' : C.mute, 30);
  // words appear one at a time, last one pops
  const shown = ws.slice(0, n).join(' '); wrapText(x, shown, 104, Y + 200, SW - 210, 76, 900, fg, 90);
  x.restore();
}

// SCAN — the camera understands the menu
let MENU = null;
function menuCanvas() {
  if (MENU) return MENU; const c = document.createElement('canvas'); c.width = 900; c.height = 1300; const x = c.getContext('2d');
  x.fillStyle = '#efe6d6'; x.fillRect(0, 0, 900, 1300); let s = 9; const r = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const d = x.getImageData(0, 0, 900, 1300), a = d.data; for (let i = 0; i < a.length; i += 4) { const n = (r() - 0.5) * 14; a[i] += n; a[i + 1] += n; a[i + 2] += n; } x.putImageData(d, 0, 0);
  x.fillStyle = '#2a201b'; x.textAlign = 'center'; x.font = '400 72px "Newsreader", Georgia, serif'; x.fillText('Sable & Rye', 450, 150); x.font = '600 24px "Inter"'; x.letterSpacing = '8px'; x.fillText('CARTA · JUEVES', 450, 205); x.letterSpacing = '0px';
  x.fillRect(330, 240, 240, 2);
  MENU_ITEMS.forEach(([n, d2, p], i) => { const Y = 340 + i * 150; x.textAlign = 'left'; x.font = '500 46px "Newsreader", Georgia, serif'; x.fillText(n, 90, Y); x.font = '400 26px "Inter"'; x.fillStyle = '#6a5a50'; x.fillText(d2, 90, Y + 44); x.fillStyle = '#2a201b'; x.textAlign = 'right'; x.font = '500 40px "Newsreader", Georgia, serif'; x.fillText(p, 810, Y); });
  return (MENU = c);
}
const MENU_ITEMS = [['Croquetas de setas', 'setas, bechamel, sal', '9'], ['Pan con tomate', 'tomate, ajo, aceite', '5'], ['Romesco de invierno', 'almendra, avellana, puerro', '11'], ['Arroz de setas', 'para cuatro · 30 min', '34'], ['Pulpo a la brasa', 'patata, pimentón', '19'], ['Tarta de almendra', 'almendra, limón', '8']];
const MENU_TAG = [['NO NUTS', 1], ['NO NUTS', 1], ['NUTS', 0], ['SHARE ×4', 1], ['NO NUTS', 1], ['NUTS', 0]];
S.scan = (x, s) => {
  const lt = s.lt, t = s.t; x.fillStyle = '#1b1512'; x.fillRect(0, 0, SW, SH);
  // the "camera": warm table, the menu card (handheld drift)
  const g = x.createRadialGradient(SW / 2, SH * 0.45, 100, SW / 2, SH * 0.5, SH * 0.7); g.addColorStop(0, '#5a3a2a'); g.addColorStop(1, '#140e0c'); x.fillStyle = g; x.fillRect(0, 0, SW, SH);
  x.save(); x.translate(SW / 2 + Math.sin(t * 1.3) * 8, 1150 + Math.cos(t * 1.1) * 6); x.rotate(-0.035 + Math.sin(t * 0.9) * 0.004); const zz = 1.06 - 0.06 * eo(lin(0, 0.6, lt)); x.scale(zz, zz);
  x.shadowColor = 'rgba(0,0,0,0.6)'; x.shadowBlur = 60; x.shadowOffsetY = 30; x.drawImage(menuCanvas(), -450, -650); x.shadowColor = 'transparent';
  // scan line + detected rows (in card space)
  const sc = lin(0.35, 1.25, lt); if (sc > 0 && sc < 1) { const Y = -650 + 260 + sc * 950; x.save(); x.globalCompositeOperation = 'lighter'; const sg = x.createLinearGradient(0, Y - 80, 0, Y + 6); sg.addColorStop(0, 'rgba(255,91,44,0)'); sg.addColorStop(1, 'rgba(255,91,44,0.55)'); x.fillStyle = sg; x.fillRect(-470, Y - 80, 940, 86); x.fillStyle = '#ffd0b8'; x.fillRect(-470, Y, 940, 5); x.restore(); }
  MENU_ITEMS.forEach((it, i) => { const Y = -650 + 340 + i * 150, k = spr(lt, 0.45 + i * 0.125, 3.2, 0.45); if (k <= 0) return; const [tg, ok] = MENU_TAG[i];
    if (!ok) { x.save(); x.globalAlpha = 0.72 * clamp(k, 0, 1); x.fillStyle = '#1b1512'; x.fillRect(-380, Y - 52, 760 * clamp(k, 0, 1), 110); x.restore(); x.strokeStyle = C.ember; x.lineWidth = 6; x.beginPath(); x.moveTo(-370, Y - 12); x.lineTo(-370 + 560 * eo(k), Y - 12); x.stroke(); }
    else { x.strokeStyle = C.ember; x.lineWidth = 6; const w = 790, h = 112; x.save(); x.globalAlpha = clamp(k, 0, 1); const L = 34; for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { const cx2 = sx * w / 2 * (1.08 - 0.08 * k) - 15, cy2 = Y - 6 + sy * h / 2; x.beginPath(); x.moveTo(cx2, cy2 - sy * L); x.lineTo(cx2, cy2); x.lineTo(cx2 - sx * L, cy2); x.stroke(); } x.restore(); }
    x.save(); x.translate((1 - k) * 80, Y - 40); x.globalAlpha = clamp(k, 0, 1); chip(x, tg, 300 - TW(x, tg, 28, 700, 3) - 44, -12, 28, ok ? C.ember : C.black, ok ? C.black : C.bone, 22); x.restore(); });
  x.restore();
  // viewfinder chrome
  status(x, t, 1);
  label(x, 'LENS  ·  READING MENU', 84, 236, C.bone, 32); block(x, 84, 262, 300 * eo(lin(0.3, 1.3, lt)), 6, 3, C.ember);
  // result block slides up
  const rk = spr(lt, 1.55, 2.4, 0.5); if (rk > 0) { const Y = SH - 640 * clamp(rk, 0, 1.08); block(x, 40, Y, SW - 80, 700, 56, C.ember);
    label(x, 'FOR THE TABLE  ·  NUT-FREE', 92, Y + 92, 'rgba(11,9,9,0.6)', 30);
    T(x, 'Arroz de setas', 88, Y + 210, 86, 900, C.black, 'left', -3); T(x, '+ croquetas, pan con tomate', 92, Y + 290, 46, 700, C.black);
    T(x, '€48', 88, Y + 460, 130, 900, C.black, 'left', -6); T(x, 'for four · ready in 30 min', 370, Y + 440, 40, 700, 'rgba(11,9,9,0.7)'); }
  homeBar(x, 0.6);
};

// HOME — evening state for hero shots: the Wave idles at the bottom, blocks breathe on the beat
S.home = (x, s) => {
  const lt = s.lt, t = s.t, bk = beatKick(t); x.fillStyle = C.black; x.fillRect(0, 0, SW, SH);
  status(x, t, 1);
  label(x, 'THU 13 NOV', 84, 236, C.mute, 34);
  roll(x, '19:38', 60, 560, 330, 900, C.bone, lt + 5, 0, 0.04, -18);
  block(x, 60, 640, SW - 120, 560, 54, C.ember);
  label(x, 'LEAVE NOW', 112, 735, 'rgba(11,9,9,0.6)', 32); T(x, 'Sable & Rye', 104, 860, 104, 900, C.black, 'left', -4); T(x, '8 min walk · table for 4 at 20:00', 110, 940, 42, 700, 'rgba(11,9,9,0.75)');
  [['M', C.cream], ['A', C.clay], ['J', C.black]].forEach(([i2, c2], i) => { x.save(); avatar(x, 170 + i * 110, 1080, 56, i2, c2, i2 === 'J' ? C.ember : C.black); x.restore(); });
  T(x, 'all in', 470, 1098, 44, 800, C.black);
  block(x, 60, 1230, 455, 420, 54, C.graph); block(x, 565, 1230, 455, 420, 54, C.cream);
  label(x, 'CAUGHT UP', 108, 1320, C.mute, 28); T(x, '47→3', 100, 1500, 128, 900, C.bone, 'left', -6); T(x, 'nothing urgent', 108, 1580, 38, 700, C.mute);
  label(x, 'TRANSLATE', 612, 1320, 'rgba(11,9,9,0.55)', 28); T(x, 'ES', 604, 1500, 150, 900, C.black, 'left', -6); T(x, 'ready offline', 612, 1580, 38, 700, 'rgba(11,9,9,0.7)');
  block(x, 60, 1680, SW - 120, 470, 54, C.ink);
  wave(x, SW / 2, 1880, SW - 200, 110, t, 0.25 + 0.2 * bk);
  T(x, 'Hold Ask — think out loud', SW / 2, 2090, 40, 700, C.mute, 'center');
  homeBar(x, 0.6);
};

// IDLE IRIS — the assistant waiting (formation / title)
S.idle = (x, s) => { const t = s.t; x.fillStyle = C.black; x.fillRect(0, 0, SW, SH); status(x, t, 1); iris(x, SW / 2, 1000, 200, t, 1, 0.4 + 0.3 * beatKick(t)); wave(x, SW / 2, 1500, SW * 0.9, 120, t, 0.3 + 0.4 * beatKick(t)); label(x, 'HOLD ASK', SW / 2, 1880, C.mute, 40, 'center'); homeBar(x, 0.6); };

export function makeScreen(scale = 1) {
  const cv = document.createElement('canvas'); cv.width = Math.round(SW * scale); cv.height = Math.round(SH * scale); const x = cv.getContext('2d');
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  let last = null;
  function draw(s) {
    if (!s) s = { scene: 'off' };
    x.setTransform(scale, 0, 0, scale, 0, 0); x.globalAlpha = 1; x.globalCompositeOperation = 'source-over'; x.filter = 'none'; x.fillStyle = '#000'; x.fillRect(0, 0, SW, SH);
    (S[s.scene] || S.off)(x, s);
    if (s.bright !== undefined && s.bright < 1) { x.setTransform(scale, 0, 0, scale, 0, 0); x.globalAlpha = 1; x.fillStyle = `rgba(0,0,0,${1 - s.bright})`; x.fillRect(0, 0, SW, SH); }
    tex.needsUpdate = true; last = s;
  }
  return { cv, tex, draw };
}
