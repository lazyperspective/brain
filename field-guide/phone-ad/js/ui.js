// ------------------------------------------------------------------
// KILN OS — the screen, drawn into a canvas texture.
// state: { wake 0..1, unlock 0..1, ask 0..1, t seconds, wall 'dunes'|'dawn'|'ink', type 0..1 (prompt typing) }
// ------------------------------------------------------------------
import * as THREE from 'three';
const W = 1080, H = 2376, SERIF = '"Newsreader", Georgia, serif', SANS = '"Inter", system-ui, sans-serif';
const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const walls = {};
function wallpaper(kind) {
  if (walls[kind]) return walls[kind]; const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
  const P = kind === 'dawn' ? { sky: ['#0b0810', '#24110f', '#7a3020', '#d8683a'], sun: '#ffd2a0', sunY: 0.5, sunR: 230, bands: ['#3a1810', '#2a110c', '#1d0c09', '#130807', '#0b0505'], hi: 'rgba(255,150,90,0.35)' }
    : kind === 'ink' ? { sky: ['#121014', '#181417', '#221a1a', '#2c1f1b'], sun: '#d97757', sunY: 0.42, sunR: 160, bands: ['#241c1b', '#1d1716', '#171212', '#110e0e', '#0b0909'], hi: 'rgba(217,119,87,0.25)' }
      : { sky: ['#c86f4c', '#d88460', '#e6a07a', '#eab08c'], sun: '#fff1e0', sunY: 0.43, sunR: 150, bands: ['#d98260', '#c86b48', '#b05a3b', '#8e4630', '#6a3324'], hi: 'rgba(255,236,220,0.5)' };
  let g = x.createLinearGradient(0, 0, 0, H * 0.62); P.sky.forEach((s, i) => g.addColorStop(i / (P.sky.length - 1), s)); x.fillStyle = g; x.fillRect(0, 0, W, H);
  const sx = W * 0.64, sy = H * P.sunY; g = x.createRadialGradient(sx, sy, 0, sx, sy, P.sunR * 4); g.addColorStop(0, P.sun); g.addColorStop(0.22, P.sun + 'aa'); g.addColorStop(1, P.sun + '00'); x.fillStyle = g; x.fillRect(0, 0, W, H);
  x.fillStyle = P.sun; x.beginPath(); x.arc(sx, sy, P.sunR, 0, 7); x.fill();
  P.bands.forEach((col, i) => {   // layered dunes, each with a soft lit crest
    const y0 = H * (0.52 + i * 0.1), amp = 70 - i * 6, ph = i * 1.7;
    const f = X => y0 + Math.sin(X / W * Math.PI * (1.3 + i * 0.35) + ph) * amp + Math.sin(X / W * Math.PI * 4.1 + ph * 2) * amp * 0.25;
    x.beginPath(); x.moveTo(0, H); for (let X = 0; X <= W; X += 8) x.lineTo(X, f(X)); x.lineTo(W, H); x.closePath();
    const bg = x.createLinearGradient(0, y0 - amp, 0, y0 + 500); bg.addColorStop(0, col); bg.addColorStop(1, i === P.bands.length - 1 ? col : P.bands[Math.min(P.bands.length - 1, i + 1)]); x.fillStyle = bg; x.fill();
    x.strokeStyle = P.hi; x.lineWidth = 3; x.beginPath(); for (let X = 0; X <= W; X += 8) X ? x.lineTo(X, f(X)) : x.moveTo(X, f(X)); x.stroke();
  });
  const d = x.getImageData(0, 0, W, H), a = d.data; let s = 7; for (let i = 0; i < a.length; i += 4) { s = (s * 1103515245 + 12345) & 0x7fffffff; const n = ((s >> 9) & 15) - 7.5; a[i] += n; a[i + 1] += n; a[i + 2] += n; } x.putImageData(d, 0, 0);
  return (walls[kind] = c);
}
function rr(x, X, Y, w, h, r) { x.beginPath(); x.roundRect(X, Y, w, h, r); }
function text(x, s, X, Y, font, col, align = 'left', ls = 0) { x.font = font; x.fillStyle = col; x.textAlign = align; x.textBaseline = 'alphabetic'; x.letterSpacing = ls + 'px'; x.fillText(s, X, Y); x.letterSpacing = '0px'; }
function frost(x, X, Y, w, h, r, a = 1) { x.save(); x.globalAlpha *= a; rr(x, X, Y, w, h, r); x.fillStyle = 'rgba(255,255,255,0.16)'; x.fill(); x.strokeStyle = 'rgba(255,255,255,0.28)'; x.lineWidth = 2; x.stroke(); x.restore(); }
// the assistant's presence: a soft ember orb that breathes
function orb(x, X, Y, r, t, k = 1) {
  const b = 1 + 0.06 * Math.sin(t * 2.4), R = r * b;
  let g = x.createRadialGradient(X, Y, 0, X, Y, R * 3); g.addColorStop(0, `rgba(255,170,120,${0.45 * k})`); g.addColorStop(1, 'rgba(255,140,90,0)'); x.fillStyle = g; x.fillRect(X - R * 3, Y - R * 3, R * 6, R * 6);
  g = x.createRadialGradient(X - R * 0.3, Y - R * 0.35, R * 0.05, X, Y, R); g.addColorStop(0, `rgba(255,248,240,${k})`); g.addColorStop(0.45, `rgba(255,186,140,${k})`); g.addColorStop(1, `rgba(217,119,87,${k})`); x.fillStyle = g; x.beginPath(); x.arc(X, Y, R, 0, 7); x.fill();
  x.strokeStyle = `rgba(255,236,220,${0.5 * k})`; x.lineWidth = 3; for (let i = 0; i < 2; i++) { const p = ((t * 0.5 + i * 0.5) % 1); x.globalAlpha = (1 - p) * k; x.beginPath(); x.arc(X, Y, R * (1.1 + p * 0.9), 0, 7); x.stroke(); } x.globalAlpha = 1;
}
function icon(x, kind, X, Y) {
  x.save(); x.strokeStyle = 'rgba(255,255,255,0.92)'; x.fillStyle = 'rgba(255,255,255,0.92)'; x.lineWidth = 5; x.lineCap = 'round'; x.lineJoin = 'round';
  if (kind === 'talk') { x.beginPath(); x.roundRect(X - 30, Y - 24, 60, 42, 16); x.stroke(); x.beginPath(); x.moveTo(X - 10, Y + 18); x.lineTo(X - 18, Y + 30); x.lineTo(X + 2, Y + 18); x.stroke(); }
  if (kind === 'lens') { x.beginPath(); x.roundRect(X - 32, Y - 24, 64, 48, 14); x.stroke(); x.beginPath(); x.arc(X, Y, 13, 0, 7); x.stroke(); }
  if (kind === 'path') { x.beginPath(); x.arc(X, Y, 28, 0, 7); x.stroke(); x.beginPath(); x.moveTo(X + 12, Y - 12); x.lineTo(X - 5, Y - 5); x.lineTo(X - 12, Y + 12); x.lineTo(X + 5, Y + 5); x.closePath(); x.fill(); }
  if (kind === 'grid') { for (const [dx, dy] of [[-14, -14], [14, -14], [-14, 14], [14, 14]]) { x.beginPath(); x.arc(X + dx, Y + dy, 8, 0, 7); x.fill(); } }
  x.restore();
}
function status(x, a, dark = false) {
  x.save(); x.globalAlpha = a; const c = 'rgba(255,255,255,0.9)'; text(x, 'KILN', 70, 92, `600 30px ${SANS}`, c, 'left', 6);
  for (let i = 0; i < 4; i++) { x.fillStyle = c; rr(x, W - 260 + i * 16, 92 - 12 - i * 6, 10, 12 + i * 6, 3); x.fill(); }
  x.strokeStyle = c; x.lineWidth = 3; rr(x, W - 170, 66, 78, 34, 11); x.stroke(); x.fillStyle = c; rr(x, W - 164, 72, 52, 22, 6); x.fill(); rr(x, W - 89, 76, 6, 14, 2); x.fill(); x.restore();
}

export function makeScreen() {
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const x = cv.getContext('2d');
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  function draw(s) {
    const t = s.t || 0, wake = s.wake ?? 1, u = s.unlock || 0, ask = s.ask || 0, wp = wallpaper(s.wall || 'dunes');
    x.setTransform(1, 0, 0, 1, 0, 0); x.globalAlpha = 1; x.filter = 'none'; x.fillStyle = '#000'; x.fillRect(0, 0, W, H);
    if (wake <= 0.001) { tex.needsUpdate = true; return; }
    // wallpaper: zooms + softens as it unlocks
    const z = 1 + 0.1 * u + 0.03 * (1 - sm(0, 1, wake)); x.save(); x.translate(W / 2, H / 2); x.scale(z, z); x.translate(-W / 2, -H / 2);
    if (u > 0.02) x.filter = `blur(${Math.round(36 * sm(0, 1, u))}px)`; x.drawImage(wp, 0, 0); x.filter = 'none'; x.restore();
    x.fillStyle = `rgba(30,12,6,${0.32 * sm(0.2, 1, u) + 0.1 * ask})`; x.fillRect(0, 0, W, H);
    // ---- lock screen
    const la = Math.max(0, 1 - u * 1.6), ly = -u * 420;
    if (la > 0) {
      x.save(); x.globalAlpha = la; x.translate(0, ly); status(x, 1);
      text(x, 'Thursday 13 November', W / 2, 330, `500 46px ${SANS}`, 'rgba(255,255,255,0.88)', 'center', 1);
      x.shadowColor = 'rgba(80,30,10,0.25)'; x.shadowBlur = 30; text(x, '7:24', W / 2, 640, `300 330px ${SERIF}`, '#ffffff', 'center', -6); x.shadowBlur = 0;
      const na = sm(0.6, 1.2, s.tn ?? 9); frost(x, 70, 1430, 940, 200, 46, na);
      x.globalAlpha = la * na; orb(x, 160, 1530, 34, t, 1); text(x, 'Morning brief', 230, 1510, `600 38px ${SANS}`, '#fff'); text(x, 'Three things worth your attention today.', 230, 1566, `400 34px ${SANS}`, 'rgba(255,255,255,0.82)');
      x.globalAlpha = la; orb(x, W / 2, 1900, 64, t, 1);
      text(x, 'Swipe up  ·  or hold Ask', W / 2, 2200, `500 32px ${SANS}`, 'rgba(255,255,255,0.7)', 'center', 1);
      x.fillStyle = 'rgba(255,255,255,0.9)'; rr(x, W / 2 - 150 + 0, 2290 - u * 300, 300, 12, 6); x.fill(); x.restore();
    }
    // ---- home: "Today"
    const h = sm(0.3, 1, u);
    if (h > 0) {
      const st = (i) => sm(0.3 + i * 0.07, 0.75 + i * 0.07, u), up = i => (1 - st(i)) * 160;
      x.save(); status(x, h);
      x.globalAlpha = st(0); text(x, 'THU 13 NOV', 80, 250 + up(0), `600 30px ${SANS}`, 'rgba(255,255,255,0.75)', 'left', 6);
      text(x, 'Good morning.', 76, 400 + up(0), `400 128px ${SERIF}`, '#fff', 'left', -2);
      text(x, 'Your day, gently organised.', 80, 480 + up(0), `400 42px ${SANS}`, 'rgba(255,255,255,0.78)');
      x.globalAlpha = st(1); orb(x, 150, 650 + up(1), 54, t, 1); frost(x, 240, 590 + up(1), 770, 120, 60, 1);
      const q = 'What should I focus on first?', n = Math.floor(q.length * Math.min(1, s.type ?? 1)); text(x, q.slice(0, n) + (n < q.length && Math.floor(t * 3) % 2 ? '|' : ''), 290, 666 + up(1), `400 40px ${SANS}`, '#fff');
      x.globalAlpha = st(2); let cx = 80; for (const c of ['Plan my day', 'Catch me up', 'Draft a reply']) { x.font = `500 34px ${SANS}`; const w = x.measureText(c).width + 64; frost(x, cx, 780 + up(2), w, 84, 42, 1); text(x, c, cx + 32, 834 + up(2), `500 34px ${SANS}`, '#fff'); cx += w + 18; }
      x.globalAlpha = st(3); frost(x, 70, 920 + up(3), 940, 400, 54, 1);
      text(x, 'NEXT  ·  10:30', 120, 1010 + up(3), `600 30px ${SANS}`, 'rgba(255,255,255,0.75)', 'left', 4); text(x, 'Design review', 118, 1110 + up(3), `400 86px ${SERIF}`, '#fff'); text(x, 'with Maya and Arun  ·  I drafted the agenda', 120, 1176 + up(3), `400 34px ${SANS}`, 'rgba(255,255,255,0.8)');
      x.fillStyle = 'rgba(255,255,255,0.22)'; rr(x, 120, 1240 + up(3), 840, 12, 6); x.fill(); x.fillStyle = '#ffd9c2'; rr(x, 120, 1240 + up(3), 840 * 0.38, 12, 6); x.fill();
      x.globalAlpha = st(4); frost(x, 70, 1350 + up(4), 460, 360, 54, 1); frost(x, 550, 1350 + up(4), 460, 360, 54, 1);
      text(x, 'INBOX', 120, 1430 + up(4), `600 30px ${SANS}`, 'rgba(255,255,255,0.75)', 'left', 4); text(x, '3', 116, 1580 + up(4), `300 160px ${SERIF}`, '#fff'); text(x, 'need you today', 120, 1650 + up(4), `400 34px ${SANS}`, 'rgba(255,255,255,0.8)');
      text(x, 'OUTSIDE', 600, 1430 + up(4), `600 30px ${SANS}`, 'rgba(255,255,255,0.75)', 'left', 4); text(x, '18°', 596, 1580 + up(4), `300 160px ${SERIF}`, '#fff'); text(x, 'Clear. Walk at 5?', 600, 1650 + up(4), `400 34px ${SANS}`, 'rgba(255,255,255,0.8)');
      x.globalAlpha = st(5); frost(x, 70, 1740 + up(5), 940, 200, 54, 1); text(x, 'Focus', 120, 1860 + up(5), `400 64px ${SERIF}`, '#fff'); text(x, 'Quiet until 12. I’ll hold the rest.', 330, 1852 + up(5), `400 32px ${SANS}`, 'rgba(255,255,255,0.8)');
      x.fillStyle = '#ffd9c2'; rr(x, 880, 1810 + up(5), 90, 54, 27); x.fill(); x.fillStyle = '#c8653e'; x.beginPath(); x.arc(943, 1837 + up(5), 21, 0, 7); x.fill();
      x.globalAlpha = st(6); frost(x, 70, 2110 + up(6), 940, 180, 90, 1); ['talk', 'lens', 'path', 'grid'].forEach((k, i) => icon(x, k, 190 + i * 233, 2200 + up(6)));
      x.restore();
    }
    // ---- Ask: the whole screen listens (warm edge glow, orb in the centre, voice bars)
    if (ask > 0.001) {
      x.save(); x.globalAlpha = ask; x.fillStyle = 'rgba(12,6,4,0.45)'; x.fillRect(0, 0, W, H);
      for (let i = 0; i < 4; i++) { const g = x.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#ffb98f'); g.addColorStop(0.5, '#d97757'); g.addColorStop(1, '#ffd9c2'); x.strokeStyle = g; x.lineWidth = 40 - i * 9; x.globalAlpha = ask * (0.18 + i * 0.2); rr(x, 6, 6, W - 12, H - 12, 120); x.stroke(); }
      x.globalAlpha = ask; orb(x, W / 2, H * 0.45, 120 + 20 * Math.sin(t * 5), t, 1);
      for (let i = 0; i < 9; i++) { const hgt = 30 + 70 * Math.abs(Math.sin(t * 7 + i * 0.9)) * (1 - Math.abs(i - 4) / 6); x.fillStyle = '#ffe3cf'; rr(x, W / 2 - 160 + i * 40 - 8, H * 0.62 - hgt / 2, 16, hgt, 8); x.fill(); }
      text(x, 'Listening…', W / 2, H * 0.7, `400 64px ${SERIF}`, '#fff', 'center'); x.restore();
    }
    // wake: brightness ramps up from black with an ember bloom from the centre
    if (wake < 1) { x.fillStyle = `rgba(0,0,0,${1 - sm(0.15, 1, wake)})`; x.fillRect(0, 0, W, H);
      const r = 900 * sm(0, 0.7, wake), g = x.createRadialGradient(W / 2, H * 0.48, 0, W / 2, H * 0.48, r + 1); g.addColorStop(0, `rgba(255,200,160,${0.9 * (1 - sm(0.4, 1, wake))})`); g.addColorStop(1, 'rgba(255,140,90,0)'); x.fillStyle = g; x.fillRect(0, 0, W, H); }
    tex.needsUpdate = true;
  }
  return { cv, tex, draw };
}
