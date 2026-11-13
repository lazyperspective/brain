// ------------------------------------------------------------------
// KILN OS · Light — a light-based interface, drawn into the phone's screen texture.
//  Surfaces are sheets of light at different depths (frosted, lit rim, soft bloom, parallax by depth).
//  Content condenses out of light: it arrives blurred and glowing and comes into focus with spring physics.
//  The assistant is the ember: a point of warm light that rests at the left screen edge, beside the
//  physical Ask strip, and travels to wherever it is working.
// draw(T, view) is a pure function of film time T (seconds), so every frame is deterministic.
// ------------------------------------------------------------------
import * as THREE from 'three';
import { spring, sm, clamp, lerp, easeIO, easeOut } from './engine.js';

const W = 1080, H = 2376, SERIF = '"Newsreader", Georgia, serif', SANS = '"Inter", system-ui, sans-serif';
const IVORY = '255,240,228', EMBER = '255,150,92', REST = { x: -6, y: 872 };
const PI = Math.PI;

// ---------------------------------------------------------------- tiny helpers
const cv = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
function rr(x, X, Y, w, h, r) { x.beginPath(); x.roundRect(X, Y, w, h, r); }
function txt(x, s, X, Y, font, col, align = 'left', ls = 0) { x.font = font; x.fillStyle = col; x.textAlign = align; x.textBaseline = 'alphabetic'; x.letterSpacing = ls + 'px'; x.fillText(s, X, Y); x.letterSpacing = '0px'; }
function measure(x, s, font, ls = 0) { x.font = font; x.letterSpacing = ls + 'px'; const w = x.measureText(s).width; x.letterSpacing = '0px'; return w; }
function wrap(x, s, font, maxW) { x.font = font; const out = []; let line = ''; for (const w of s.split(' ')) { const t = line ? line + ' ' + w : w; if (x.measureText(t).width > maxW && line) { out.push(line); line = w; } else line = t; } if (line) out.push(line); return out; }
// spring-in progress for an element that starts at time t0
const sp = (T, t0, w = 13, z = 0.78) => spring(T - t0, w, z);
const rand = (i, k = 0) => { const s = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return s - Math.floor(s); };

// blur via a quarter-resolution scratch (canvas filters on a full-size layer are far too slow in software)
const SCR = {};
function scratch(id, w, h) { let S = SCR[id]; if (!S) { S = SCR[id] = { a: cv(Math.ceil(w / 4), Math.ceil(h / 4)), b: cv(Math.ceil(w / 4), Math.ceil(h / 4)) }; } return S; }
function blurDraw(x, fn, b, alpha, comp = 'source-over', id = 'in') {
  if (alpha <= 0.003) return;
  const S = scratch(id, x.canvas.width, x.canvas.height), m = x.getTransform(), A = S.a.getContext('2d'), B = S.b.getContext('2d');
  A.setTransform(1, 0, 0, 1, 0, 0); A.clearRect(0, 0, S.a.width, S.a.height); A.globalAlpha = 1; A.globalCompositeOperation = 'source-over'; A.filter = 'none';
  A.setTransform(m.a / 4, m.b / 4, m.c / 4, m.d / 4, m.e / 4, m.f / 4); fn(A);
  B.setTransform(1, 0, 0, 1, 0, 0); B.clearRect(0, 0, S.b.width, S.b.height); B.filter = `blur(${Math.max(0.3, b / 4).toFixed(2)}px)`; B.drawImage(S.a, 0, 0); B.filter = 'none';
  x.save(); x.setTransform(1, 0, 0, 1, 0, 0); x.globalAlpha = alpha; x.globalCompositeOperation = comp; x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high'; x.drawImage(S.b, 0, 0, x.canvas.width, x.canvas.height); x.restore();
}
// condense: draw fn(ctx) emerging from light. k: 0 → 1 (may overshoot for spring scale)
function condense(x, k, cx, cy, fn, opt = {}) {
  const a = clamp(k, 0, 1); if (a <= 0.003) return;
  const blur = (1 - a) * (opt.blur ?? 22), sc = 1 + (1 - k) * (opt.scale ?? 0.06), dy = (1 - k) * (opt.dy ?? 26);
  x.save(); x.translate(cx, cy + dy); x.scale(sc, sc); x.translate(-cx, -cy);
  const al = x.globalAlpha * Math.pow(a, 0.8);
  if (blur < 2.5) { x.globalAlpha = al; fn(x); }
  else blurDraw(x, fn, blur, al);
  if (a < 0.98 && opt.glow !== false) blurDraw(x, fn, 12 + blur, x.globalAlpha * Math.sin(a * PI) * 0.45 / Math.max(0.05, Math.pow(a, 0.8)) * Math.pow(a, 0.8), 'lighter', 'glow');
  x.restore();
}
// a sheet of light (rendered once per size into a cached bitmap: halo, frosted body, lit rim, inner glow line)
const SHEETS = new Map(), SM = 90;
function sheetBitmap(w, h, r, o) {
  const key = [w, h, r, o.halo ?? 1, o.lum ?? 1, o.tint || ''].join('|'); let c = SHEETS.get(key); if (c) return c;
  c = cv(Math.ceil(w + SM * 2), Math.ceil(h + SM * 2)); const x = c.getContext('2d'), X = SM, Y = SM;
  x.shadowColor = `rgba(255,150,100,${0.22 * (o.halo ?? 1)})`; x.shadowBlur = 70; x.shadowOffsetY = 10;
  rr(x, X, Y, w, h, r); x.fillStyle = 'rgba(40,20,14,0.30)'; x.fill(); x.shadowColor = 'transparent';
  let g = x.createLinearGradient(X, Y, X + w * 0.3, Y + h); g.addColorStop(0, `rgba(${IVORY},${0.20 * (o.lum ?? 1)})`); g.addColorStop(0.5, `rgba(${IVORY},${0.10 * (o.lum ?? 1)})`); g.addColorStop(1, `rgba(${IVORY},${0.07 * (o.lum ?? 1)})`);
  rr(x, X, Y, w, h, r); x.fillStyle = g; x.fill();
  if (o.tint) { rr(x, X, Y, w, h, r); x.fillStyle = o.tint; x.fill(); }
  g = x.createLinearGradient(X, Y, X + w * 0.6, Y + h); g.addColorStop(0, `rgba(${IVORY},0.75)`); g.addColorStop(0.35, `rgba(${IVORY},0.18)`); g.addColorStop(1, `rgba(${IVORY},0.05)`);
  rr(x, X + 1, Y + 1, w - 2, h - 2, r); x.strokeStyle = g; x.lineWidth = 2.5; x.stroke();
  g = x.createLinearGradient(X + r, 0, X + w - r, 0); g.addColorStop(0, `rgba(${IVORY},0)`); g.addColorStop(0.3, `rgba(${IVORY},0.5)`); g.addColorStop(1, `rgba(${IVORY},0)`);
  x.fillStyle = g; x.fillRect(X + r, Y + 2, w - 2 * r, 2);
  SHEETS.set(key, c); return c;
}
function sheet(x, X, Y, w, h, r, a = 1, o = {}) {
  if (a <= 0.003) return;
  x.save(); x.globalAlpha *= a; x.drawImage(sheetBitmap(w, h, r, o), X - SM, Y - SM); x.restore();
}
// the ember — the assistant's presence
function ember(x, X, Y, r, k = 1, T = 0, amp = 0, think = 0) {
  if (k <= 0.003) return;
  x.save(); x.globalCompositeOperation = 'lighter';
  const br = 1 + 0.05 * Math.sin(T * 2.3) + amp * 0.18, R = r * br;
  let g = x.createRadialGradient(X, Y, 0, X, Y, R * 7); g.addColorStop(0, `rgba(${EMBER},${0.32 * k})`); g.addColorStop(0.35, `rgba(255,120,70,${0.12 * k})`); g.addColorStop(1, 'rgba(255,110,60,0)');
  x.fillStyle = g; x.fillRect(X - R * 7, Y - R * 7, R * 14, R * 14);
  // voice halo: a ring whose radius breathes with the voice
  if (amp > 0.01 || think > 0.01) {
    for (let ring = 0; ring < 3; ring++) {
      x.beginPath();
      for (let i = 0; i <= 120; i++) {
        const th = i / 120 * PI * 2, n = Math.sin(th * 3 + T * 5.1 + ring) * 0.5 + Math.sin(th * 5 - T * 7.3 + ring * 2) * 0.35 + Math.sin(th * 2 + T * 3.3) * 0.4;
        const rad = R * (1.55 + ring * 0.42) + n * R * 0.42 * amp + Math.sin(th * 6 + T * 9) * R * 0.06 * think;
        const px = X + Math.cos(th) * rad, py = Y + Math.sin(th) * rad; i ? x.lineTo(px, py) : x.moveTo(px, py);
      }
      x.strokeStyle = `rgba(255,${190 - ring * 25},${140 - ring * 30},${(0.55 - ring * 0.15) * k * Math.max(amp, think * 0.7)})`; x.lineWidth = 4 - ring; x.stroke();
    }
    if (think > 0.01) {   // thinking: arcs of light orbit the core
      for (let i = 0; i < 3; i++) { const a0 = T * (2.2 + i * 0.7) + i * 2.1; x.beginPath(); x.arc(X, Y, R * (1.35 + i * 0.22), a0, a0 + 1.1); x.strokeStyle = `rgba(255,220,190,${0.6 * think * k})`; x.lineWidth = 3; x.stroke(); }
    }
  }
  g = x.createRadialGradient(X, Y, 0, X, Y, R * 2.2); g.addColorStop(0, `rgba(255,200,160,${0.7 * k})`); g.addColorStop(1, 'rgba(255,140,80,0)'); x.fillStyle = g; x.beginPath(); x.arc(X, Y, R * 2.2, 0, 7); x.fill();
  g = x.createRadialGradient(X - R * 0.2, Y - R * 0.25, 0, X, Y, R); g.addColorStop(0, `rgba(255,255,250,${k})`); g.addColorStop(0.35, `rgba(255,222,190,${k})`); g.addColorStop(0.8, `rgba(255,150,92,${0.9 * k})`); g.addColorStop(1, 'rgba(255,120,70,0)');
  x.fillStyle = g; x.beginPath(); x.arc(X, Y, R, 0, 7); x.fill();
  x.restore();
}
// the ember at rest: a half-light peeking from the left edge where the Ask strip is
function emberRest(x, k, T, flare = 0) {
  if (k <= 0.003) return;
  x.save(); x.globalCompositeOperation = 'lighter';
  const len = 200 + flare * 220, a = k * (0.55 + 0.1 * Math.sin(T * 1.7)) + flare;
  let g = x.createLinearGradient(0, REST.y - len, 0, REST.y + len); g.addColorStop(0, 'rgba(255,140,80,0)'); g.addColorStop(0.5, `rgba(255,170,110,${0.5 * a})`); g.addColorStop(1, 'rgba(255,140,80,0)');
  x.fillStyle = g; x.fillRect(0, REST.y - len, 6 + flare * 10, len * 2);
  g = x.createRadialGradient(0, REST.y, 0, 0, REST.y, 110 + flare * 400); g.addColorStop(0, `rgba(255,190,140,${0.55 * a})`); g.addColorStop(0.4, `rgba(255,140,80,${0.18 * a})`); g.addColorStop(1, 'rgba(255,120,60,0)');
  x.fillStyle = g; x.fillRect(0, REST.y - 600, 600, 1200);
  g = x.createRadialGradient(0, REST.y, 0, 0, REST.y, 26); g.addColorStop(0, `rgba(255,250,240,${Math.min(1, a * 1.3)})`); g.addColorStop(1, 'rgba(255,170,110,0)'); x.fillStyle = g; x.beginPath(); x.arc(0, REST.y, 26, 0, 7); x.fill();
  x.restore();
}
// icons (line, drawn in light)
function icon(x, kind, X, Y, s = 1, col = `rgba(${IVORY},0.9)`) {
  x.save(); x.translate(X, Y); x.scale(s, s); x.strokeStyle = col; x.fillStyle = col; x.lineWidth = 3.4; x.lineCap = 'round'; x.lineJoin = 'round';
  if (kind === 'cal') { x.beginPath(); x.roundRect(-17, -14, 34, 32, 7); x.stroke(); x.beginPath(); x.moveTo(-17, -3); x.lineTo(17, -3); x.moveTo(-8, -20); x.lineTo(-8, -10); x.moveTo(8, -20); x.lineTo(8, -10); x.stroke(); }
  if (kind === 'walk') { x.beginPath(); x.arc(2, -16, 5, 0, 7); x.fill(); x.beginPath(); x.moveTo(0, -8); x.lineTo(-3, 6); x.lineTo(-10, 18); x.moveTo(-3, 6); x.lineTo(6, 18); x.moveTo(-1, -4); x.lineTo(-11, 2); x.moveTo(0, -4); x.lineTo(10, 0); x.stroke(); }
  if (kind === 'msg') { x.beginPath(); x.roundRect(-18, -15, 36, 26, 9); x.stroke(); x.beginPath(); x.moveTo(-8, 11); x.lineTo(-13, 19); x.lineTo(0, 11); x.stroke(); }
  if (kind === 'drop') { x.beginPath(); x.moveTo(0, -17); x.bezierCurveTo(10, -4, 13, 2, 13, 7); x.arc(0, 7, 13, 0, PI); x.bezierCurveTo(-13, 2, -10, -4, 0, -17); x.stroke(); }
  if (kind === 'sun') { x.beginPath(); x.arc(0, 0, 8, 0, 7); x.stroke(); for (let i = 0; i < 8; i++) { const a = i * PI / 4; x.beginPath(); x.moveTo(Math.cos(a) * 13, Math.sin(a) * 13); x.lineTo(Math.cos(a) * 18, Math.sin(a) * 18); x.stroke(); } }
  if (kind === 'check') { x.beginPath(); x.moveTo(-12, 0); x.lineTo(-3, 9); x.lineTo(13, -9); x.stroke(); }
  if (kind === 'moon') { x.beginPath(); x.arc(0, 0, 14, 0.9, 5.4); x.arc(7, -3, 11, 4.6, 1.5, true); x.closePath(); x.stroke(); }
  if (kind === 'inbox') { x.beginPath(); x.moveTo(-18, 0); x.lineTo(-12, -14); x.lineTo(12, -14); x.lineTo(18, 0); x.lineTo(18, 14); x.lineTo(-18, 14); x.closePath(); x.moveTo(-18, 0); x.lineTo(-7, 0); x.lineTo(-4, 5); x.lineTo(4, 5); x.lineTo(7, 0); x.lineTo(18, 0); x.stroke(); }
  x.restore();
}
function status(x, a, time, T) {
  if (a <= 0) return; x.save(); x.globalAlpha *= a; const c = `rgba(${IVORY},0.92)`;
  if (time) txt(x, time, 96, 104, `600 38px ${SANS}`, c);
  for (let i = 0; i < 4; i++) { x.fillStyle = i < 3 ? c : `rgba(${IVORY},0.35)`; rr(x, W - 268 + i * 15, 100 - 12 - i * 6, 9, 12 + i * 6, 3); x.fill(); }
  x.strokeStyle = c; x.lineWidth = 3; rr(x, W - 182, 74, 70, 32, 11); x.stroke(); x.fillStyle = c; rr(x, W - 176, 80, 46, 20, 6); x.fill(); rr(x, W - 109, 84, 5, 13, 2); x.fill();
  x.restore();
}

// ---------------------------------------------------------------- backgrounds (the lumen field)
let BASE = null, MAP = null;
function base() {
  if (BASE) return BASE; BASE = cv(W, H); const x = BASE.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#140b09'); g.addColorStop(0.55, '#1f0f0a'); g.addColorStop(1, '#2c140b'); x.fillStyle = g; x.fillRect(0, 0, W, H);
  const d = x.getImageData(0, 0, W, H), a = d.data; for (let i = 0; i < a.length; i += 4) { const n = (rand(i, 3) - 0.5) * 5; a[i] += n; a[i + 1] += n; a[i + 2] += n; } x.putImageData(d, 0, 0);
  return BASE;
}
let LUM = null;
function lumen(X, T, mood = {}) {
  // drawn at quarter resolution (it is all soft light) and scaled up over the grain base
  if (!LUM) LUM = cv(W / 4, H / 4); const x = LUM.getContext('2d'); x.setTransform(0.25, 0, 0, 0.25, 0, 0); x.clearRect(0, 0, W, H);
  X.drawImage(base(), 0, 0);
  const dawn = mood.dawn ?? 1, cool = mood.cool ?? 0, dim = mood.dim ?? 0;
  x.save(); x.globalCompositeOperation = 'lighter';
  const blob = (X, Y, R, col, a) => { const g = x.createRadialGradient(X, Y, 0, X, Y, R); g.addColorStop(0, `rgba(${col},${a})`); g.addColorStop(0.5, `rgba(${col},${a * 0.35})`); g.addColorStop(1, `rgba(${col},0)`); x.fillStyle = g; x.fillRect(X - R, Y - R, R * 2, R * 2); };
  const k = 1 - dim;
  blob(760 + Math.sin(T * 0.21) * 90, 2250 + Math.sin(T * 0.17) * 40, 1350, cool > 0.5 ? '150,120,120' : '255,128,70', 0.55 * dawn * k);
  blob(260 + Math.sin(T * 0.13 + 1) * 70, 1550 + Math.cos(T * 0.19) * 120, 820, '255,170,110', 0.16 * k);
  blob(820 + Math.cos(T * 0.15) * 60, 420 + Math.sin(T * 0.23) * 60, 700, cool > 0.5 ? '170,170,190' : '255,215,180', 0.10 * k);
  blob(540, 2700, 1300, '255,180,120', 0.42 * dawn * k);
  x.restore();
  X.save(); X.globalCompositeOperation = 'lighter'; X.imageSmoothingQuality = 'high'; X.drawImage(LUM, 0, 0, W, H); X.restore();
}
function rain(x, T, a) {
  if (a <= 0) return; x.save(); x.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 70; i++) {
    const sp = 900 + rand(i, 1) * 900, X = rand(i, 2) * W, L = 60 + rand(i, 3) * 160, Y = ((rand(i, 4) * (H + 400) + T * sp) % (H + 400)) - 200;
    const g = x.createLinearGradient(X, Y, X - L * 0.12, Y + L); g.addColorStop(0, 'rgba(220,210,230,0)'); g.addColorStop(1, `rgba(230,220,235,${0.16 * a * (0.4 + rand(i, 5))})`);
    x.strokeStyle = g; x.lineWidth = 1.5 + rand(i, 6) * 1.5; x.beginPath(); x.moveTo(X, Y); x.lineTo(X - L * 0.12, Y + L); x.stroke();
  }
  x.restore();
}
// a little map for the walk card (soft dark city, light streets, a river, a park)
function mapCanvas() {
  if (MAP) return MAP; const w = 520, h = 340; MAP = cv(w, h); const x = MAP.getContext('2d');
  let g = x.createLinearGradient(0, 0, w, h); g.addColorStop(0, '#2a1710'); g.addColorStop(1, '#1d100b'); x.fillStyle = g; x.fillRect(0, 0, w, h);
  // blocks
  x.fillStyle = 'rgba(255,230,210,0.035)';
  for (const [X, Y, bw, bh] of [[100, 20, 95, 50], [100, 95, 95, 50], [245, 15, 40, 40], [395, 100, 110, 45], [245, 175, 120, 40], [110, 185, 80, 30], [400, 20, 100, 30]]) { rr(x, X, Y, bw, bh, 8); x.fill(); }
  // park
  g = x.createRadialGradient(330, 85, 0, 330, 85, 80); g.addColorStop(0, 'rgba(150,170,110,0.22)'); g.addColorStop(1, 'rgba(150,170,110,0.08)'); x.fillStyle = g; rr(x, 300, 40, 75, 85, 26); x.fill();
  // river
  x.strokeStyle = 'rgba(130,140,190,0.30)'; x.lineWidth = 24; x.lineCap = 'round'; x.beginPath(); x.moveTo(-20, 262); x.bezierCurveTo(140, 222, 280, 300, 540, 236); x.stroke();
  // streets: soft light lines
  x.strokeStyle = `rgba(${IVORY},0.13)`; x.lineWidth = 6;
  for (const pts of [[[0, 82], [520, 64]], [[0, 160], [520, 150]], [[75, 0], [92, 340]], [[222, 0], [230, 340]], [[380, 0], [372, 340]]]) { x.beginPath(); x.moveTo(...pts[0]); x.lineTo(...pts[1]); x.stroke(); }
  x.lineWidth = 3; x.strokeStyle = `rgba(${IVORY},0.07)`;
  for (const pts of [[[0, 120], [222, 112]], [[230, 110], [520, 100]], [[300, 0], [296, 160]], [[150, 160], [160, 340]]]) { x.beginPath(); x.moveTo(...pts[0]); x.lineTo(...pts[1]); x.stroke(); }
  // a little bridge over the river
  x.strokeStyle = `rgba(${IVORY},0.13)`; x.lineWidth = 6; x.beginPath(); x.moveTo(230, 200); x.lineTo(232, 340); x.stroke();
  return MAP;
}
const ROUTE = [[70, 290], [75, 240], [90, 170], [150, 165], [222, 158], [228, 100], [300, 78], [372, 66], [440, 70]];
function routePath(x, u, X, Y) { // partial polyline by arc length
  const seg = []; let L = 0; for (let i = 1; i < ROUTE.length; i++) { const l = Math.hypot(ROUTE[i][0] - ROUTE[i - 1][0], ROUTE[i][1] - ROUTE[i - 1][1]); seg.push(l); L += l; }
  let left = u * L; x.beginPath(); x.moveTo(X + ROUTE[0][0], Y + ROUTE[0][1]); let hx = ROUTE[0][0], hy = ROUTE[0][1];
  for (let i = 1; i < ROUTE.length && left > 0; i++) { const f = Math.min(1, left / seg[i - 1]); hx = lerp(ROUTE[i - 1][0], ROUTE[i][0], f); hy = lerp(ROUTE[i - 1][1], ROUTE[i][1], f); x.lineTo(X + hx, Y + hy); left -= seg[i - 1]; }
  return [X + hx, Y + hy];
}

// ---------------------------------------------------------------- screens
// LOCK — live time, a seconds trace, the morning brief
function lockScreen(x, T, lift) {
  const t0 = 17.95; // wake
  const sec = 57 + (T - 18.0); const minute = sec >= 60 ? 25 : 24, s = ((sec % 60) + 60) % 60;
  const kd = sp(T, t0 + 0.45, 11);
  condense(x, kd, 540, 300, (x) => txt(x, 'Thursday, 12 November', 540, 318, `500 40px ${SANS}`, `rgba(${IVORY},0.78)`, 'center', 2));
  // time: the minute turns over with a light dissolve
  const kt = sp(T, t0 + 0.15, 9, 0.8), flip = sm(20.95, 21.35, T);
  condense(x, kt, 540, 600, (x) => {
    if (flip < 1) { x.save(); x.globalAlpha *= 1 - flip; txt(x, '7:24', 540, 700, `300 380px ${SERIF}`, `rgba(255,246,238,0.97)`, 'center', -6); x.restore(); }
    if (flip > 0) { x.save(); x.globalAlpha *= flip; txt(x, '7:25', 540, 700, `300 380px ${SERIF}`, `rgba(255,246,238,0.97)`, 'center', -6); x.restore(); }
  }, { blur: 36, scale: 0.08, dy: 0 });
  // seconds trace: a thin line of light filling across, with a bright head
  const ks = sm(t0 + 0.8, t0 + 1.4, T);
  if (ks > 0) {
    x.save(); x.globalAlpha *= ks; const X0 = 250, X1 = 830, hx = X0 + (X1 - X0) * (s / 60);
    x.fillStyle = `rgba(${IVORY},0.14)`; x.fillRect(X0, 768, X1 - X0, 3);
    const g = x.createLinearGradient(X0, 0, hx, 0); g.addColorStop(0, `rgba(${EMBER},0)`); g.addColorStop(1, `rgba(255,200,160,0.9)`); x.fillStyle = g; x.fillRect(X0, 767, hx - X0, 5);
    x.globalCompositeOperation = 'lighter'; const gg = x.createRadialGradient(hx, 769, 0, hx, 769, 30); gg.addColorStop(0, 'rgba(255,240,225,1)'); gg.addColorStop(1, 'rgba(255,160,100,0)'); x.fillStyle = gg; x.fillRect(hx - 30, 739, 60, 60);
    x.restore();
    txt(x, `:${String(Math.floor(s)).padStart(2, '0')}`, X1 + 22, 784, `500 34px ${SANS}`, `rgba(${IVORY},${0.55 * ks})`, 'left');
  }
  const kw = sp(T, t0 + 0.95, 11);
  condense(x, kw, 540, 860, (x) => { icon(x, 'drop', 372, 862, 0.95); txt(x, '14°  ·  Rain from 2 pm', 405, 876, `500 40px ${SANS}`, `rgba(${IVORY},0.85)`, 'left'); });
  // the morning brief — a sheet that condenses, then its lines arrive one by one
  const kb = sp(T, 19.25, 10, 0.8), X = 70, Y = 1170, w = 940, h = 660;
  condense(x, kb, 540, Y + h / 2, (x) => sheet(x, X, Y, w, h, 60, 1), { blur: 30, scale: 0.05, glow: false });
  const row = (i, fn) => condense(x, sp(T, 19.55 + i * 0.16, 12), 540, Y + 100 + i * 100, fn, { blur: 16, dy: 18 });
  row(0, (x) => { ember(x, X + 72, Y + 82, 11, 1, T); txt(x, 'MORNING BRIEF', X + 110, Y + 94, `600 30px ${SANS}`, 'rgba(255,196,160,0.95)', 'left', 6); txt(x, '7:25', X + w - 60, Y + 94, `500 30px ${SANS}`, `rgba(${IVORY},0.5)`, 'right'); });
  row(1, (x) => txt(x, 'Rain arrives at 2 pm.', X + 60, Y + 210, `400 74px ${SERIF}`, 'rgba(255,246,238,1)'));
  row(2, (x) => txt(x, 'Your afternoon is outdoors.', X + 60, Y + 290, `italic 300 58px ${SERIF}`, `rgba(${IVORY},0.82)`));
  row(3, (x) => { x.fillStyle = `rgba(${IVORY},0.16)`; x.fillRect(X + 60, Y + 345, w - 120, 2); });
  const item = (i, ic, a, b) => row(3 + i, (x) => { icon(x, ic, X + 84, Y + 420 + (i - 1) * 92, 1); txt(x, a, X + 130, Y + 434 + (i - 1) * 92, `500 42px ${SANS}`, `rgba(${IVORY},0.95)`); if (b) txt(x, b, X + w - 60, Y + 434 + (i - 1) * 92, `500 42px ${SANS}`, 'rgba(255,190,150,0.95)', 'right'); });
  item(1, 'walk', 'Studio visit · Halden Works', '3:00');
  item(2, 'cal', 'Coffee with Noor', '4:00');
  item(3, 'msg', '2 messages worth your time', '');
  // swipe hint
  const kh = sm(20.6, 21.2, T) * (1 - sm(22.25, 22.5, T));
  if (kh > 0) { x.save(); x.globalAlpha *= kh; const by = 2232 - Math.sin(T * 2.6) * 8; const g = x.createLinearGradient(470, 0, 610, 0); g.addColorStop(0, `rgba(${IVORY},0)`); g.addColorStop(0.5, `rgba(${IVORY},0.9)`); g.addColorStop(1, `rgba(${IVORY},0)`); x.fillStyle = g; rr(x, 440, by, 200, 8, 4); x.fill(); x.restore(); }
}

// HOME — "Today": sheets at depth
function homeScreen(x, T, intro, view) {
  const p = view.par || [0, 0];
  const at = (i) => intro + i * 0.09;
  const lay = (i, fn, depth = 1) => { const k = sp(T, at(i), 12, 0.74); x.save(); x.translate(p[0] * depth, p[1] * depth); condense(x, k, 540, 300 + i * 260, fn, { blur: 26, scale: 0.07, dy: 60 }); x.restore(); };
  status(x, sm(intro, intro + 0.4, T), '7:25', T);
  lay(0, (x) => { txt(x, 'THURSDAY', 90, 238, `600 30px ${SANS}`, 'rgba(255,196,160,0.9)', 'left', 6); txt(x, 'Good morning, Mara.', 86, 340, `300 92px ${SERIF}`, 'rgba(255,246,238,1)'); }, 0.4);
  lay(1, (x) => {
    const X = 70, Y = 410, w = 940, h = 370; sheet(x, X, Y, w, h, 56);
    txt(x, 'NEXT  ·  3:00 PM', X + 56, Y + 76, `600 30px ${SANS}`, `rgba(${IVORY},0.6)`, 'left', 5);
    txt(x, 'Studio visit', X + 52, Y + 168, `400 76px ${SERIF}`, 'rgba(255,246,238,1)');
    txt(x, 'Halden Works  ·  22 min walk', X + 56, Y + 232, `400 40px ${SANS}`, `rgba(${IVORY},0.72)`);
    x.save(); rr(x, X + 52, Y + 270, 470, 64, 32); x.fillStyle = 'rgba(255,150,92,0.18)'; x.fill(); x.strokeStyle = 'rgba(255,170,120,0.55)'; x.lineWidth = 2; x.stroke(); x.restore();
    icon(x, 'drop', X + 92, Y + 302, 0.8, 'rgba(255,200,160,1)'); txt(x, 'Rain likely by then', X + 122, Y + 316, `500 36px ${SANS}`, 'rgba(255,205,170,1)');
  }, 1);
  lay(2, (x) => {
    const X = 70, Y = 810, w = 940, h = 400; sheet(x, X, Y, w, h, 56);
    txt(x, '14°', X + 48, Y + 200, `300 170px ${SERIF}`, 'rgba(255,246,238,1)');
    txt(x, 'Rain from 2 pm', X + 380, Y + 110, `500 42px ${SANS}`, `rgba(${IVORY},0.95)`);
    txt(x, 'Heaviest 3 – 5 pm', X + 380, Y + 164, `400 38px ${SANS}`, `rgba(${IVORY},0.65)`);
    // hourly rain: bars of light
    const hrs = ['11', '12', '1', '2', '3', '4', '5', '6'], lev = [0.05, 0.05, 0.12, 0.45, 0.85, 1, 0.7, 0.35];
    hrs.forEach((hh, i) => { const bx = X + 70 + i * 106, bh = 16 + lev[i] * 90, by = Y + 330 - bh; const g = x.createLinearGradient(0, by, 0, by + bh); g.addColorStop(0, `rgba(255,${200 - lev[i] * 60},${170 - lev[i] * 80},${0.35 + lev[i] * 0.6})`); g.addColorStop(1, `rgba(255,150,92,0.15)`); x.fillStyle = g; rr(x, bx, by, 34, bh, 17); x.fill(); txt(x, hh, bx + 17, Y + 376, `500 30px ${SANS}`, `rgba(${IVORY},0.55)`, 'center'); });
  }, 1.2);
  lay(3, (x) => {
    let X = 70, Y = 1240, w = 455, h = 300; sheet(x, X, Y, w, h, 50);
    txt(x, 'NOOR', X + 46, Y + 72, `600 30px ${SANS}`, `rgba(${IVORY},0.6)`, 'left', 5);
    txt(x, 'Coffee at 4?', X + 44, Y + 160, `400 58px ${SERIF}`, 'rgba(255,246,238,1)');
    txt(x, 'Sent 7:02', X + 46, Y + 230, `400 36px ${SANS}`, `rgba(${IVORY},0.6)`);
    X = 555; sheet(x, X, Y, w, h, 50);
    txt(x, 'FOCUS', X + 46, Y + 72, `600 30px ${SANS}`, `rgba(${IVORY},0.6)`, 'left', 5);
    txt(x, 'Until noon', X + 44, Y + 160, `400 58px ${SERIF}`, 'rgba(255,246,238,1)');
    x.save(); rr(x, X + 46, Y + 196, 120, 56, 28); x.fillStyle = 'rgba(255,170,110,0.85)'; x.fill(); x.beginPath(); x.arc(X + 138, Y + 224, 22, 0, 7); x.fillStyle = '#fff4ea'; x.fill(); x.restore();
  }, 1.4);
  lay(4, (x) => {
    const X = 70, Y = 1570, w = 940, h = 230; sheet(x, X, Y, w, h, 50);
    icon(x, 'inbox', X + 80, Y + 92, 1.1); txt(x, 'INBOX', X + 130, Y + 102, `600 30px ${SANS}`, `rgba(${IVORY},0.6)`, 'left', 5);
    txt(x, '3 need you today', X + 52, Y + 180, `400 54px ${SERIF}`, 'rgba(255,246,238,1)'); txt(x, '11 can wait', X + w - 56, Y + 178, `400 38px ${SANS}`, `rgba(${IVORY},0.55)`, 'right');
  }, 1.6);
}

// ASK → LISTEN → BUILD → CONFIRM
const LINES = [['Plan', 'my', 'afternoon'], ['around', 'the', 'rain.']], WORD_T = [28.85, 29.08, 29.3, 29.82, 30.04, 30.25];
function voiceAmp(T) { // a speaking envelope: syllable bumps while words are being said
  if (T < 28.75 || T > 30.9) return 0; let a = 0; WORD_T.forEach((w, i) => { const d = T - w + 0.05; if (d > 0) a += Math.exp(-d * 9) * (i === 2 || i === 5 ? 1.0 : 0.75) * (d < 0.3 ? 1 : 0.6); });
  return clamp(a * (0.75 + 0.25 * Math.sin(T * 38) * Math.sin(T * 23)), 0, 1.2);
}
function transcript(x, T, move) {
  // shared element: centered big transcript (listening) → left-aligned title (plan)
  const font = `400 84px ${SERIF}`; let wi = 0;
  LINES.forEach((ws, li) => {
    const full = ws.join(' '), lw = measure(x, full, font);
    const cx0 = 540 - lw / 2, cy0 = 1520 + li * 108, cx1 = 92, cy1 = 352 + li * 74, s1 = 0.72;
    const X = lerp(cx0, cx1, move), Y = lerp(cy0, cy1, move), s = lerp(1, s1, move);
    let off = 0;
    ws.forEach((w, k) => {
      const kw = sp(T, WORD_T[wi], 11, 0.8); const ww = measure(x, w + ' ', font);
      x.save(); x.translate(X, Y); x.scale(s, s);
      condense(x, kw, off + ww / 2, -28, (x) => txt(x, w, off, 0, font, 'rgba(255,246,238,1)'), { blur: 20, dy: 22, scale: 0.1 });
      x.restore(); off += ww; wi++;
    });
  });
}
function planCards(x, T, fold) {
  // fold: 0 = laid out, 1 = folded into the confirmation
  const F = (k, i) => { // fold transform for card i
    const f = easeIO(0, 1, clamp(fold * 1.4 - i * 0.18, 0, 1)); return f;
  };
  const card = (i, t0, Y, h, fn) => {
    const f = F(fold, i), k = sp(T, t0, 11, 0.78) * (1 - f);
    if (k <= 0.003) return;
    x.save(); const cy = Y + h / 2; const ty = lerp(0, 1160 - cy, f); x.translate(0, ty); x.translate(540, cy); x.scale(1 - f * 0.25, 1 - f * 0.6); x.translate(-540, -cy);
    condense(x, k, 540, cy, (c) => fn(c), { blur: 28, scale: 0.05, dy: 50 });
    x.restore();
  };
  // A — calendar, reworked
  card(0, 32.25, 470, 640, (x) => {
    const X = 60, Y = 470, w = 960, h = 640; sheet(x, X, Y, w, h, 56);
    icon(x, 'cal', X + 76, Y + 70, 1, 'rgba(255,200,160,1)'); txt(x, 'CALENDAR  ·  REWORKED', X + 120, Y + 82, `600 30px ${SANS}`, 'rgba(255,196,160,0.95)', 'left', 5);
    // timeline spine
    x.fillStyle = `rgba(${IVORY},0.16)`; x.fillRect(X + 232, Y + 140, 2, 450);
    // rain band (2–6 pm)
    const rb = sm(32.6, 33.2, T); x.save(); x.globalAlpha *= rb; const g = x.createLinearGradient(0, Y + 330, 0, Y + 610); g.addColorStop(0, 'rgba(150,160,200,0)'); g.addColorStop(0.2, 'rgba(160,170,210,0.16)'); g.addColorStop(1, 'rgba(160,170,210,0.10)'); x.fillStyle = g; rr(x, X + 30, Y + 330, w - 60, 280, 30); x.fill();
    icon(x, 'drop', X + w - 76, Y + 372, 0.8, 'rgba(200,205,235,0.9)'); txt(x, 'Rain 2 – 6 pm', X + w - 108, Y + 384, `500 32px ${SANS}`, 'rgba(210,214,240,0.9)', 'right'); x.restore();
    // studio visit slides from 3:00 to 11:30 (shared element)
    const mv = easeIO(33.05, 33.75, T), ry = lerp(Y + 470, Y + 200, mv);
    const t1 = 1 - mv; x.save(); x.globalAlpha *= t1; txt(x, '3:00', X + 200, ry + 12, `400 50px ${SERIF}`, 'rgba(255,190,150,1)', 'right'); x.restore();
    x.save(); x.globalAlpha *= mv; txt(x, '11:30', X + 200, ry + 12, `400 50px ${SERIF}`, 'rgba(255,246,238,1)', 'right'); x.restore();
    x.save(); x.globalCompositeOperation = 'lighter'; const dg = x.createRadialGradient(X + 233, ry - 4, 0, X + 233, ry - 4, 26); dg.addColorStop(0, 'rgba(255,230,210,1)'); dg.addColorStop(1, 'rgba(255,150,92,0)'); x.fillStyle = dg; x.fillRect(X + 200, ry - 40, 70, 70); x.restore();
    txt(x, 'Studio visit', X + 270, ry + 6, `600 44px ${SANS}`, 'rgba(255,246,238,1)');
    txt(x, mv > 0.5 ? 'Halden Works · moved before the rain' : 'Halden Works', X + 270, ry + 58, `400 34px ${SANS}`, `rgba(${IVORY},0.65)`);
    // coffee row, rewritten indoors
    const kc = sp(T, 33.55, 12);
    condense(x, kc, 540, Y + 520, (x) => {
      txt(x, '3:30', X + 200, Y + 532, `400 50px ${SERIF}`, 'rgba(255,246,238,1)', 'right');
      x.save(); x.globalCompositeOperation = 'lighter'; const dg2 = x.createRadialGradient(X + 233, Y + 516, 0, X + 233, Y + 516, 22); dg2.addColorStop(0, 'rgba(255,230,210,0.9)'); dg2.addColorStop(1, 'rgba(255,150,92,0)'); x.fillStyle = dg2; x.fillRect(X + 200, Y + 480, 70, 70); x.restore();
      txt(x, 'Coffee with Noor', X + 270, Y + 526, `600 44px ${SANS}`, 'rgba(255,246,238,1)');
      txt(x, 'Moved indoors → Café Lumen', X + 270, Y + 578, `400 34px ${SANS}`, 'rgba(255,200,165,0.95)');
    }, { blur: 14, dy: 16 });
  });
  // B — the walk
  card(1, 32.75, 1140, 470, (x) => {
    const X = 60, Y = 1140, w = 960, h = 470; sheet(x, X, Y, w, h, 56);
    const mx = X + 36, my = Y + 96; x.save(); rr(x, mx, my, 520, 340, 34); x.clip(); x.drawImage(mapCanvas(), mx, my);
    const u = easeIO(33.3, 34.6, T);
    x.lineCap = 'round'; x.lineJoin = 'round';
    x.globalCompositeOperation = 'lighter'; x.strokeStyle = 'rgba(255,150,92,0.35)'; x.lineWidth = 22; routePath(x, u, mx, my); x.stroke();
    x.strokeStyle = 'rgba(255,225,200,1)'; x.lineWidth = 7; const [hx, hy] = routePath(x, u, mx, my); x.stroke();
    const hg = x.createRadialGradient(hx, hy, 0, hx, hy, 34); hg.addColorStop(0, 'rgba(255,250,240,1)'); hg.addColorStop(1, 'rgba(255,150,92,0)'); x.fillStyle = hg; x.fillRect(hx - 34, hy - 34, 68, 68);
    x.globalCompositeOperation = 'source-over';
    x.fillStyle = `rgba(${IVORY},0.9)`; x.beginPath(); x.arc(mx + 70, my + 290, 10, 0, 7); x.fill();
    x.globalAlpha = sm(34.4, 34.7, T); x.fillStyle = 'rgba(255,170,110,1)'; x.beginPath(); x.arc(mx + 440, my + 70, 14, 0, 7); x.fill(); x.fillStyle = '#fff'; x.beginPath(); x.arc(mx + 440, my + 70, 6, 0, 7); x.fill();
    x.restore();
    icon(x, 'walk', X + 76, Y + 58, 0.9, 'rgba(255,200,160,1)'); txt(x, 'WALK', X + 112, Y + 70, `600 30px ${SANS}`, 'rgba(255,196,160,0.95)', 'left', 5);
    const RX = X + 600;
    txt(x, '18 min', RX, Y + 210, `300 96px ${SERIF}`, 'rgba(255,246,238,1)');
    txt(x, 'to Halden Works', RX, Y + 262, `400 34px ${SANS}`, `rgba(${IVORY},0.65)`);
    icon(x, 'sun', RX + 16, Y + 334, 0.85, 'rgba(255,215,170,1)'); txt(x, 'Dry until 1:40', RX + 48, Y + 346, `500 36px ${SANS}`, 'rgba(255,225,200,1)');
    txt(x, 'Leave by 11:05', RX, Y + 404, `400 34px ${SANS}`, `rgba(${IVORY},0.65)`);
  });
  // C — a message, drafted in your voice
  card(2, 33.3, 1640, 340, (x) => {
    const X = 60, Y = 1640, w = 960, h = 340; sheet(x, X, Y, w, h, 56);
    icon(x, 'msg', X + 76, Y + 66, 0.9, 'rgba(255,200,160,1)'); txt(x, 'DRAFT  ·  TO NOOR', X + 118, Y + 78, `600 30px ${SANS}`, 'rgba(255,196,160,0.95)', 'left', 5);
    const msg = "Rain's coming at 2. Swap to Café Lumen at 3:30? I'll grab the window table.";
    const n = Math.floor(clamp((T - 33.9) / 1.15, 0, 1) * msg.length), font = `400 44px ${SERIF}`;
    const lines = wrap(x, msg, font, w - 110); let used = 0, cx = 0, cyy = 0;
    lines.forEach((ln, i) => { const part = ln.slice(0, Math.max(0, n - used)); txt(x, part, X + 56, Y + 160 + i * 62, font, 'rgba(255,246,238,1)'); if (n - used >= 0 && n - used <= ln.length + 1) { cx = X + 56 + measure(x, part, font); cyy = Y + 160 + i * 62; } used += ln.length + 1; });
    if (n < msg.length && T > 33.9) { x.save(); x.globalCompositeOperation = 'lighter'; x.fillStyle = `rgba(255,190,140,${0.6 + 0.4 * Math.sin(T * 18)})`; x.fillRect(cx + 4, cyy - 40, 4, 48); x.restore(); }
  });
}
function confirmBtn(x, T, fold) {
  const k = sp(T, 34.95, 12, 0.7) * (1 - sm(36.0, 36.3, T)); if (k <= 0.003) return;
  const press = Math.exp(-Math.max(0, T - 35.7) * 6) * (T > 35.7 ? 1 : 0);
  condense(x, k, 540, 2100, (x) => {
    x.save(); x.translate(540, 2100); x.scale(1 - press * 0.05, 1 - press * 0.05); x.translate(-540, -2100);
    x.shadowColor = 'rgba(255,140,80,0.7)'; x.shadowBlur = 60; rr(x, 300, 2035, 480, 130, 65);
    const g = x.createLinearGradient(300, 2035, 780, 2165); g.addColorStop(0, '#ffe2cc'); g.addColorStop(1, '#ffa877'); x.fillStyle = g; x.fill(); x.shadowColor = 'transparent';
    txt(x, 'Confirm all', 540, 2116, `600 48px ${SANS}`, '#3a1a0e', 'center');
    x.restore();
  }, { blur: 24 });
}
function tapRipple(x, T, X, Y, t0) {
  const d = T - t0; if (d < -0.25 || d > 1.1) return;
  x.save(); x.globalCompositeOperation = 'lighter';
  // the fingertip: a soft pressure of light
  const fa = clamp(1 - Math.abs(d + 0.05) / 0.3, 0, 1); const g = x.createRadialGradient(X, Y, 0, X, Y, 120); g.addColorStop(0, `rgba(255,250,240,${0.7 * fa})`); g.addColorStop(1, 'rgba(255,200,160,0)'); x.fillStyle = g; x.fillRect(X - 120, Y - 120, 240, 240);
  if (d > 0) for (let i = 0; i < 3; i++) { const dd = d - i * 0.08; if (dd <= 0) continue; const r = 60 + dd * 2600, a = Math.max(0, 1 - dd / 0.9); for (const [lw, aa] of [[30 + dd * 60, 0.12], [12 + dd * 30, 0.25], [4 + dd * 8, 0.5]]) { x.strokeStyle = `rgba(255,210,175,${aa * a})`; x.lineWidth = lw; x.beginPath(); x.arc(X, Y, r, 0, 7); x.stroke(); } }
  x.restore();
}
function doneSheet(x, T) {
  const k = sp(T, 36.35, 10, 0.75); if (k <= 0.003) return;
  condense(x, k, 540, 1160, (x) => {
    const X = 90, Y = 930, w = 900, h = 470; sheet(x, X, Y, w, h, 60, 1, { halo: 1.6, lum: 1.3 });
    ember(x, X + 90, Y + 100, 16, 1, T); icon(x, 'check', X + 90, Y + 100, 0.9, '#3a1a0e');
    txt(x, 'Afternoon set.', X + 150, Y + 122, `400 76px ${SERIF}`, 'rgba(255,246,238,1)');
    txt(x, 'Studio at 11:30  ·  Lumen at 3:30', X + 60, Y + 236, `500 40px ${SANS}`, `rgba(${IVORY},0.9)`);
    txt(x, 'Noor has your note. Leave by 11:05.', X + 60, Y + 296, `400 38px ${SANS}`, `rgba(${IVORY},0.65)`);
    txt(x, 'You’ll stay dry.', X + 60, Y + 400, `italic 300 64px ${SERIF}`, 'rgba(255,200,165,1)');
  }, { blur: 30, scale: 0.08 });
}

// CONDENSE — fourteen into one
const NOTES = [
  ['L', 'Lena Ortiz', 'Deck v4 attached — final-ish'], ['S', 'Studio group', 'Who has the keys for Monday?'], ['N', 'Noor', 'Lumen works! See you at 3:30'],
  ['C', 'Calendar', 'Design sync moved to Friday'], ['B', 'Bank', 'Card payment · 4.20 · Bakery Ost'], ['L', 'Lena Ortiz', 'Can you check slides 7 and 12?'],
  ['W', 'Weather', 'Heavy rain until 5 pm'], ['P', 'Parcel', 'Delivered to reception'], ['S', 'Studio group', 'Sam has the keys'],
  ['N', 'News', 'The afternoon edition is ready'], ['M', 'Mum', 'Call later? x'], ['P', 'Podcasts', 'New episode: Slow Light'], ['P', 'Photos', '3 new memories'], ['L', 'Lena Ortiz', 'Also: notes from the client'],
];
const NT0 = 37.45, NDT = 0.115;
function note(x, i, Y, sc, a, T, txtA = 1) {
  const [g, who, what] = NOTES[i], X = 70, w = 940, h = 150;
  x.save(); x.globalAlpha *= a; x.translate(540, Y + h / 2); x.scale(sc, sc); x.translate(-540, -(Y + h / 2));
  sheet(x, X, Y, w, h, 44, 1, { halo: 0.5 });
  if (txtA <= 0.01) { x.restore(); return; } x.globalAlpha *= txtA;
  x.fillStyle = 'rgba(255,170,120,0.22)'; x.beginPath(); x.arc(X + 76, Y + 75, 38, 0, 7); x.fill(); txt(x, g, X + 76, Y + 90, `600 38px ${SANS}`, 'rgba(255,220,195,1)', 'center');
  txt(x, who, X + 138, Y + 66, `600 38px ${SANS}`, 'rgba(255,246,238,1)'); txt(x, what, X + 138, Y + 116, `400 36px ${SANS}`, `rgba(${IVORY},0.72)`);
  txt(x, 'now', X + w - 44, Y + 66, `400 30px ${SANS}`, `rgba(${IVORY},0.45)`, 'right');
  x.restore();
}
function condenseScreen(x, T) {
  status(x, 1, '2:47', T);
  const kt = sp(T, 37.1, 10);
  condense(x, kt, 540, 400, (x) => { txt(x, '2:47', 540, 520, `300 300px ${SERIF}`, 'rgba(255,246,238,0.96)', 'center', -4); txt(x, 'Thursday  ·  Raining, 13°', 540, 610, `500 38px ${SANS}`, `rgba(${IVORY},0.72)`, 'center', 1); }, { blur: 24 });
  const squash = easeIO(39.25, 39.85, T), band = lerp(700, 2300, easeIO(39.2, 39.85, T));
  // stack: newest on top at y=700; older ones recede downward and back
  if (squash < 1) {
    let n = 0; for (let i = 0; i < NOTES.length; i++) if (T > NT0 + i * NDT) n = i + 1;
    for (let i = 0; i < n; i++) {
      const age = n - 1 - i, kin = sp(T, NT0 + i * NDT, 16, 0.8);
      const depth = age; const Y = 700 + (Math.min(depth, 3) * 168 + Math.max(0, depth - 3) * 30) + (1 - kin) * -70, sc = (1 - Math.max(0, depth - 2) * 0.03) * (1 - squash * 0.3), a = clamp(kin, 0, 1) * (depth > 10 ? Math.max(0, 1 - (depth - 10) * 0.5) : 1) * (1 - squash);
      const squY = lerp(Y, 1180, squash);
      if (depth < 12) note(x, i, squY, sc, a * (depth < 3 ? 1 : 0.85 - (depth - 3) * 0.07), T, clamp(3.6 - depth - kin * 0 , 0, 1) * (depth < 3 ? 1 : 1 - clamp(T - (NT0 + (i + 3) * NDT), 0, 0.2) * 5));
    }
    if (n > 3) txt(x, `${n} new`, 540, 662, `600 32px ${SANS}`, `rgba(${IVORY},${0.6 * (1 - squash)})`, 'center', 3);
  }
  // the band of light that condenses them
  const kb = sm(39.15, 39.35, T) * (1 - sm(39.85, 40.15, T));
  if (kb > 0) { x.save(); x.globalCompositeOperation = 'lighter'; const g = x.createLinearGradient(0, band - 160, 0, band + 40); g.addColorStop(0, 'rgba(255,150,92,0)'); g.addColorStop(0.8, `rgba(255,220,195,${0.7 * kb})`); g.addColorStop(1, 'rgba(255,250,240,0)'); x.fillStyle = g; x.fillRect(0, band - 160, W, 200); x.restore(); }
  // a line of light where they merged
  const kl = sm(39.6, 39.85, T) * (1 - sm(40.0, 40.35, T));
  if (kl > 0) { x.save(); x.globalCompositeOperation = 'lighter'; const g = x.createLinearGradient(70, 0, 1010, 0); g.addColorStop(0, 'rgba(255,200,160,0)'); g.addColorStop(0.5, `rgba(255,245,235,${kl})`); g.addColorStop(1, 'rgba(255,200,160,0)'); x.fillStyle = g; x.fillRect(70, 1177, 940, 6); x.globalAlpha = 0.4; x.fillRect(70, 1170, 940, 20); x.restore(); }
  // the summary sheet
  const ks = sp(T, 39.95, 9, 0.8); if (ks <= 0.003) return;
  const X = 70, Y = 760, w = 940, h = 1020;
  x.save(); const open = clamp(ks, 0, 1.2); x.translate(0, 1180); x.scale(1, 0.02 + 0.98 * Math.min(1, open)); x.translate(0, -1180);
  sheet(x, X, Y, w, h, 60, Math.min(1, ks * 1.5), { halo: 1.4, lum: 1.2 }); x.restore();
  const row = (i, fn) => condense(x, sp(T, 40.2 + i * 0.12, 12), 540, Y + 120 + i * 200, fn, { blur: 16, dy: 18 });
  row(0, (x) => { ember(x, X + 74, Y + 82, 12, 1, T); txt(x, 'WHILE YOU WALKED', X + 112, Y + 94, `600 30px ${SANS}`, 'rgba(255,196,160,0.95)', 'left', 6); txt(x, '14 → 1', X + w - 56, Y + 94, `600 32px ${SANS}`, `rgba(${IVORY},0.55)`, 'right'); });
  row(1, (x) => { txt(x, 'Noor’s in — Lumen, 3:30.', X + 56, Y + 210, `400 64px ${SERIF}`, 'rgba(255,246,238,1)'); txt(x, 'She confirmed at 2:31.', X + 58, Y + 268, `400 38px ${SANS}`, `rgba(${IVORY},0.62)`); });
  row(2, (x) => { txt(x, 'Lena sent the deck.', X + 56, Y + 390, `400 64px ${SERIF}`, 'rgba(255,246,238,1)'); txt(x, 'I pulled slides 7 and 12 — the two', X + 58, Y + 450, `400 38px ${SANS}`, `rgba(${IVORY},0.72)`); txt(x, 'she needs you on.', X + 58, Y + 500, `400 38px ${SANS}`, `rgba(${IVORY},0.72)`); });
  row(3, (x) => { txt(x, 'Keys for Monday: Sam.', X + 56, Y + 620, `400 64px ${SERIF}`, 'rgba(255,246,238,1)'); });
  row(4, (x) => { x.fillStyle = `rgba(${IVORY},0.14)`; x.fillRect(X + 56, Y + 690, w - 112, 2); txt(x, '11 more can wait.', X + 56, Y + 790, `italic 300 58px ${SERIF}`, 'rgba(255,200,165,1)'); txt(x, 'I’ll bring them back at 5.', X + 58, Y + 852, `400 38px ${SANS}`, `rgba(${IVORY},0.62)`);
    x.save(); rr(x, X + 56, Y + 900, 330, 84, 42); x.fillStyle = 'rgba(255,170,110,0.9)'; x.fill(); txt(x, 'Open slides', X + 221, Y + 955, `600 36px ${SANS}`, '#3a1a0e', 'center'); rr(x, X + 406, Y + 900, 200, 84, 42); x.strokeStyle = `rgba(${IVORY},0.5)`; x.lineWidth = 2.5; x.stroke(); txt(x, 'Later', X + 506, Y + 955, `500 36px ${SANS}`, `rgba(${IVORY},0.9)`, 'center'); x.restore(); });
}

// GLANCE — the calm ambient state for hero shots
function glance(x, T, time, line) {
  txt(x, time, 540, 700, `300 360px ${SERIF}`, 'rgba(255,246,238,0.95)', 'center', -6);
  txt(x, line, 540, 820, `500 40px ${SANS}`, `rgba(${IVORY},0.75)`, 'center', 1);
  ember(x, 540, 1600, 34, 0.9, T);
}

// ---------------------------------------------------------------- the OS
export function makeOS(scale = 1) {
  const c = cv(Math.round(W * scale), Math.round(H * scale)), x = c.getContext('2d');
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 16; tex.generateMipmaps = true; tex.minFilter = THREE.LinearMipmapLinearFilter;
  const L = cv(W, H), lx = L.getContext('2d');   // layer for receding home
  const small = cv(W / 6, H / 6), sx = small.getContext('2d');
  let lastKey = '';
  function draw(T, view = {}) {
    const mode = view.mode || modeAt(T);
    if (mode === 'off') { if (lastKey !== 'off') { x.setTransform(1, 0, 0, 1, 0, 0); x.fillStyle = '#000'; x.fillRect(0, 0, c.width, c.height); tex.needsUpdate = true; } lastKey = 'off'; return; }
    lastKey = 'on'; x.setTransform(scale, 0, 0, scale, 0, 0); x.globalAlpha = 1; x.globalCompositeOperation = 'source-over'; x.filter = 'none';
    if (mode === 'condense') { lumen(x, T, { cool: 1, dim: 0.35, dawn: 0.5 }); rain(x, T, 1); condenseScreen(x, T); emberRest(x, 0.7, T); }
    else if (mode === 'glance') { lumen(x, T, { dawn: 0.9 }); glance(x, T, view.time || '3:28', view.line || 'Café Lumen  ·  2 min  ·  Noor is here'); emberRest(x, 0.6, T); }
    else {
      // the morning: lock → home → ask → build
      lumen(x, T, { dawn: 1 });
      const unlock = easeIO(22.35, 23.15, T);
      if (T < 23.3) { // lock lifts toward the viewer and dissolves into light
        x.save(); const s = 1 + unlock * 0.12; x.translate(540, 1100); x.scale(s, s); x.translate(-540, -1100 - unlock * 180);
        if (unlock < 0.02) lockScreen(x, T); else blurDraw(x, (c) => lockScreen(c, T), 3 + unlock * 22, 1 - unlock, 'source-over', 'outer');
        x.restore();
      }
      // home, receding when the ember takes over
      const recede = easeIO(27.0, 27.9, T), gone = sm(31.4, 32.2, T);
      if (T > 22.75 && gone < 1) {
        if (recede < 0.01) homeScreen(x, T, 22.85, view);
        else {
          lx.setTransform(1, 0, 0, 1, 0, 0); lx.clearRect(0, 0, W, H); homeScreen(lx, T, 22.85, view);
          sx.clearRect(0, 0, small.width, small.height); sx.drawImage(L, 0, 0, small.width, small.height);
          x.save(); x.globalAlpha = (1 - recede * 0.8) * (1 - gone); const s = 1 - recede * 0.07; x.translate(540, 1100); x.scale(s, s); x.translate(-540, -1100);
          x.globalAlpha *= 1; x.save(); x.globalAlpha *= 1 - recede; x.drawImage(L, 0, 0); x.restore(); x.save(); x.globalAlpha *= recede; x.imageSmoothingQuality = 'high'; x.drawImage(small, 0, 0, W, H); x.restore();
          x.restore();
        }
      }
      // the swipe: a fingertip of light rising, leaving a trail
      const sw = clamp((T - 22.3) / 0.55, 0, 1);
      if (sw > 0 && sw < 1) { x.save(); x.globalCompositeOperation = 'lighter'; const fy = lerp(2250, 1300, easeOut(0, 1, sw)), a = Math.sin(sw * PI);
        let g = x.createLinearGradient(0, fy, 0, fy + 700); g.addColorStop(0, `rgba(255,220,195,${0.55 * a})`); g.addColorStop(1, 'rgba(255,150,92,0)'); x.fillStyle = g; x.fillRect(500, fy, 80, 700);
        g = x.createRadialGradient(540, fy, 0, 540, fy, 140); g.addColorStop(0, `rgba(255,250,240,${0.8 * a})`); g.addColorStop(1, 'rgba(255,190,140,0)'); x.fillStyle = g; x.fillRect(400, fy - 140, 280, 280); x.restore(); }
      // the ember: rests at the edge, flares when the strip is pressed, travels to the centre, then to the plan
      const press = 26.95, travel = easeIO(27.15, 28.05, T), toTop = easeIO(31.35, 32.15, T);
      const flare = Math.exp(-Math.max(0, T - press) * 3) * (T > press ? 1 : 0) * (1 - travel);
      if (T > 18.4) emberRest(x, sm(18.4, 19.2, T) * (1 - travel), T, flare);
      if (travel > 0) {
        // a river of light from the edge as it travels
        const ex = lerp(REST.x, 540, travel), ey = lerp(REST.y, 1060, travel) - Math.sin(travel * PI) * 160;
        const X = lerp(ex, 110, toTop), Y = lerp(ey, 215, toTop), r = lerp(lerp(26, 92, travel), 22, toTop);
        if (travel < 1) blurDraw(x, (c) => { c.strokeStyle = 'rgba(255,170,110,1)'; c.lineWidth = 30; c.lineCap = 'round'; c.beginPath(); c.moveTo(0, REST.y); c.quadraticCurveTo(lerp(0, 270, travel), REST.y - 200 * travel, ex, ey); c.stroke(); }, 14, 0.45 * Math.sin(travel * PI), 'lighter');
        const amp = voiceAmp(T), think = sm(30.8, 31.2, T) * (1 - sm(32.0, 32.6, T)) + sm(28.1, 28.5, T) * (1 - sm(28.75, 28.9, T)) * 0.4;
        ember(x, X, Y, r, 1, T, amp * (1 - toTop), think);
        // listening label
        const kl = sm(28.0, 28.4, T) * (1 - sm(30.6, 31.0, T));
        if (kl > 0) txt(x, 'LISTENING', 540, 1345, `600 32px ${SANS}`, `rgba(255,200,165,${0.75 * kl})`, 'center', 8);
        const kth = sm(30.85, 31.1, T) * (1 - sm(31.6, 31.9, T));
        if (kth > 0) txt(x, 'THINKING WITH YOU', 540, 1345, `600 32px ${SANS}`, `rgba(255,200,165,${0.75 * kth})`, 'center', 8);
        if (T > 28.7) transcript(x, T, easeIO(31.3, 32.2, T));
        const kh = sm(32.0, 32.5, T) * (1 - sm(36.0, 36.3, T));
        if (kh > 0) txt(x, 'Here’s a drier afternoon', 150, 228, `500 36px ${SANS}`, `rgba(255,200,165,${0.9 * kh})`);
        if (T > 31.8) { const fold = easeIO(35.95, 36.6, T); planCards(x, T, fold); confirmBtn(x, T, fold); tapRipple(x, T, 540, 2100, 35.7); doneSheet(x, T); }
      }
      // the wake: light pours in from the Ask-strip edge
      const wk = clamp((T - 17.55) / 1.1, 0, 1);
      if (wk < 1) {
        const R = 40 + Math.pow(wk, 1.6) * 2900;
        x.save(); x.globalCompositeOperation = 'destination-in'; const g = x.createRadialGradient(0, REST.y, 0, 0, REST.y, R); g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(0.75, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, W, H); x.restore();
        x.save(); x.globalCompositeOperation = 'destination-over'; x.fillStyle = '#000'; x.fillRect(0, 0, W, H); x.restore();
        x.save(); x.globalCompositeOperation = 'lighter'; const g2 = x.createRadialGradient(0, REST.y, R * 0.6, 0, REST.y, R); g2.addColorStop(0, 'rgba(255,160,100,0)'); g2.addColorStop(0.85, `rgba(255,225,200,${0.55 * (1 - wk)})`); g2.addColorStop(1, 'rgba(255,160,100,0)'); x.fillStyle = g2; x.fillRect(0, 0, W, H);
        const g3 = x.createRadialGradient(0, REST.y, 0, 0, REST.y, 260); g3.addColorStop(0, `rgba(255,245,235,${(1 - wk)})`); g3.addColorStop(1, 'rgba(255,160,100,0)'); x.fillStyle = g3; x.fillRect(0, REST.y - 260, 260, 520); x.restore();
      }
    }
    tex.needsUpdate = true;
  }
  return { tex, draw, canvas: c };
}
export function modeAt(T) { if (T < 17.55) return 'off'; if (T < 37.0) return 'morning'; if (T < 41.4) return 'condense'; return 'glance'; }
