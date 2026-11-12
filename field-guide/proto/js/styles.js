'use strict';
// ------------------------------------------------------------------
// Nine style prototypes of the same 3-second prologue.
// Each style: { name, pal, amp, low(B,t), hiBack(F,t), hiFront(F,t), compose }
// ------------------------------------------------------------------
const HEROPAL = ['d97757', 'a8553b', 'f2a585', '6e2a1a', 'ffd9c2', '1b1426', 'fff6ea'];
const roundMask = (i, j) => { const d = Math.hypot(i - 2.5, j - 2.5); return d <= 2.85 && !(hash(i, j, 77) < 0.3 && d > 2.4); };
const depthFn = (i, j) => Math.round(16 + 44 * Math.max(0, 1 - Math.hypot(i - 2.5, j - 2.5) / 3.6) + hash(i, j, 5) * 12);
const K = 1.4;
// default prop layout (world units on the 6x6 island of 16-unit tiles)
const LAYOUT = { hero: [52, 50, 0], tree: [16, 20], planks: [68, 70], mailbox: [12, 68], lantern: [82, 22], stones: [[22, 62], [30, 58], [38, 56]], mush: [[24, 14, 0, 2], [28, 24, 0, 1], [10, 30, 0, 1]] };
function std(B, t, o) {
  const L = Object.assign({}, LAYOUT, o.layout || {});
  if (o.island !== false) drawIsland(B, Object.assign({ T: 16, N: 6, mask: roundMask, depth: depthFn, seed: 3 }, o.island || {}, { cols: o.cols }));
  if (o.back) o.back(B, t);
  const [hx, hy, hz] = o.hero || L.hero;
  const H = P(hx, hy, hz + 17);
  const items = [];
  const c = o.cols;
  if (L.stones && c.stoneL) items.push([0, () => drawStones(B, L.stones, c)]);
  if (L.tree && o.tree !== false) items.push([L.tree[0] + L.tree[1], () => drawTreeRound(B, L.tree[0], L.tree[1], L.tree[2] || 0, c, o.treeScale || 1.15)]);
  if (L.mush && c.cap) items.push([L.mush[0][0] + L.mush[0][1] + 1, () => drawMushrooms(B, L.mush, c)]);
  if (L.mailbox && c.box && o.mailbox !== false) items.push([L.mailbox[0] + L.mailbox[1], () => drawMailbox(B, L.mailbox[0], L.mailbox[1], 0, c, t)]);
  if (L.lantern && c.lamp && o.lantern !== false) items.push([L.lantern[0] + L.lantern[1], () => drawLantern(B, L.lantern[0], L.lantern[1], 0, c, t)]);
  if (L.planks && o.planks !== false) items.push([L.planks[0] + L.planks[1], () => drawPlanks(B, L.planks[0], L.planks[1], 0, { top: c.woodL, side: c.wood, dark: c.woodD })]);
  if (o.items) for (const it of o.items) items.push(it);
  let st, r;
  items.push([hx + hy, () => { drawTrail(B, t, H, c.trail); st = heroState(t); r = drawHero(B, hx, hy, hz, st, { shadowCol: c.shadow }); }]);
  items.sort((a, b) => a[0] - b[0]);
  for (const [, f] of items) f();
  if (o.mid) o.mid(B, t, H);
  drawPlane(B, planeState(t, H), c.plane);
  drawZzz(B, r.head, t, c.z, c.zOut);
  drawBubble(B, r.head, st.bubble, c.bubble);
  if (o.front) o.front(B, t, H, r);
  return { H, st, r };
}
// standard prop colours (wood post, lilac mailbox, coral flag, warm lamp, mushrooms, stones)
const PROPS = { post: '5e3b28', postL: '8a5a3a', postD: '3a2420', box: '6a62b0', boxL: '9b8fd6', boxD: '463f80', flag: 'e2574c', lamp: 'ffd88a', lampL: 'fff1c4', lampD: 'f5b45a', glow: 'f5b45a', stem: 'efe4d0', cap: 'e2574c', spot: 'fff1c4', stoneL: 'b9b2c4', stoneD: '7d7790' };
const PROPPAL = ['5e3b28', '8a5a3a', '3a2420', '6a62b0', '9b8fd6', '463f80', 'e2574c', 'ffd88a', 'fff1c4', 'f5b45a', 'efe4d0', 'b9b2c4', '7d7790'];
const C = (o) => { const r = {}; for (const k in o) r[k] = Array.isArray(o[k]) && typeof o[k][0] === 'number' ? o[k] : (typeof o[k] === 'string' ? hex(o[k]) : o[k]); return r; };
function miniIsland(B, ox, oy, s, cols, seed) {
  const sv = { ...ISO }; ISO.ox = ox; ISO.oy = oy;
  drawIsland(B, { T: Math.round(8 * s), N: 3, mask: (i, j) => hash(i, j, seed) > 0.15 || (i === 1 && j === 1), depth: (i, j) => Math.round((10 + hash(i, j, seed + 1) * 18) * s), cols, seed });
  ISO.ox = sv.ox; ISO.oy = sv.oy;
}
function bob(t, ph, a = 1.5) { return Math.sin((t / DUR) * 2 * Math.PI + ph) * a; }

// ---------- hi-res helpers ----------
function softCloud(F, x, y, w, h, light, shade, seed) {
  const R = mulberry(seed);
  const puffs = []; for (let k = 0; k < 26; k++) { const u = R(); puffs.push([x + (u - 0.5) * w, y + (R() - 0.3) * h * 0.5 - Math.sin(u * Math.PI) * h * 0.55, (0.18 + R() * 0.22) * w * (0.6 + Math.sin(u * Math.PI) * 0.6)]); }
  for (const [px, py, r] of puffs) { const g = F.createRadialGradient(px, py + r * 0.35, r * 0.1, px, py + r * 0.3, r); g.addColorStop(0, shade); g.addColorStop(1, 'rgba(0,0,0,0)'); F.fillStyle = g; F.beginPath(); F.arc(px, py + r * 0.3, r, 0, 7); F.fill(); }
  for (const [px, py, r] of puffs) { const g = F.createRadialGradient(px - r * 0.25, py - r * 0.35, r * 0.05, px, py, r * 0.95); g.addColorStop(0, light); g.addColorStop(0.7, light.replace(/[\d.]+\)$/, '0.75)')); g.addColorStop(1, 'rgba(255,255,255,0)'); F.fillStyle = g; F.beginPath(); F.arc(px, py, r * 0.95, 0, 7); F.fill(); }
}
function grain(F, amt, seed) { const id = F.getImageData(0, 0, FW, FH), d = id.data; let s = seed | 0; for (let i = 0; i < d.length; i += 4) { s = (s * 1103515245 + 12345) & 0x7fffffff; const n = ((s >> 8) & 255) / 255 - 0.5; d[i] += n * amt; d[i + 1] += n * amt; d[i + 2] += n * amt; } F.putImageData(id, 0, 0); }
function pixelUp(F, low) { F.imageSmoothingEnabled = false; F.drawImage(low, 0, 0, FW, FH); F.imageSmoothingEnabled = true; }
function bloom(F, low, thr, strength, blur) {
  const c = document.createElement('canvas'); c.width = LW; c.height = LH; const x = c.getContext('2d'); x.drawImage(low, 0, 0);
  const id = x.getImageData(0, 0, LW, LH), d = id.data; for (let i = 0; i < d.length; i += 4) { const l = 0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2]; const k = clamp((l - thr) / (255 - thr), 0, 1); d[i] *= k; d[i + 1] *= k; d[i + 2] *= k; } x.putImageData(id, 0, 0);
  F.save(); F.globalCompositeOperation = 'lighter'; F.globalAlpha = strength; F.filter = `blur(${blur}px)`; F.drawImage(c, 0, 0, FW, FH); F.filter = `blur(${blur * 3}px)`; F.globalAlpha = strength * 0.7; F.drawImage(c, 0, 0, FW, FH); F.restore();
}
function vignette(F, a, col = '0,0,0') { const g = F.createRadialGradient(FW / 2, FH * 0.48, FW * 0.35, FW / 2, FH * 0.5, FH * 0.75); g.addColorStop(0, `rgba(${col},0)`); g.addColorStop(1, `rgba(${col},${a})`); F.fillStyle = g; F.fillRect(0, 0, FW, FH); }

function penrose(B, cx, cy, s, t) {
  const c1 = hex('e2d8c0'), c2 = hex('a89a80'), c3 = hex('544a3e'), ln = hex('15120f');
  const r = s, w = s * 0.26, rot = Math.sin(t * 0.8) * 0.03;
  const V = k => [cx + Math.cos(-Math.PI / 2 + k * 2 * Math.PI / 3 + rot) * r, cy + Math.sin(-Math.PI / 2 + k * 2 * Math.PI / 3 + rot) * r];
  const A = V(0), Bp = V(1), Cp = V(2);
  const inner = k => { const p = V(k); return [lerp(p[0], cx, 0.52), lerp(p[1], cy, 0.52)]; };
  const a2 = inner(0), b2 = inner(1), c2p = inner(2);
  const bars = [[A, Bp, b2, a2, c1], [Bp, Cp, c2p, b2, c2], [Cp, A, a2, c2p, c3]];
  for (const [p, q, q2, p2, col] of bars) B.poly([p, q, q2, p2], col);
  for (const [p, q] of [[A, Bp], [Bp, Cp], [Cp, A], [a2, b2], [b2, c2p], [c2p, a2]]) B.line(p[0], p[1], q[0], q[1], ln);
}

function withISO(ox, oy, k, fn) { const sv = { ...ISO }; ISO.ox = ox; ISO.oy = oy; ISO.k = k; try { return fn(); } finally { ISO.ox = sv.ox; ISO.oy = sv.oy; ISO.k = sv.k; } }
function cloudSea(B, t, y0, cols, seed, n = 7, sp = 6) {
  for (let k = 0; k < n; k++) { const w = 70 + hash(k, 1, seed) * 60, x = ((k * 61 + hash(k, 2, seed) * 40 + t * sp * (1 + (k % 3) * 0.4)) % (LW + 140)) - 70, y = y0 + (k % 3) * 14 + hash(k, 3, seed) * 8; pixCloud(B, x, y, w, cols, seed * 10 + k); }
}
function fireflies(B, t, n, region, col, glowCol, seed) {
  for (let k = 0; k < n; k++) { const x = region[0] + hash(k, 1, seed) * region[2] + Math.sin(t * 1.3 + k * 2) * 8, y = region[1] + hash(k, 2, seed) * region[3] + Math.cos(t * 1.1 + k) * 6; const on = 0.5 + 0.5 * Math.sin(t * 3 + k * 1.7); if (on < 0.25) continue;
    B.glow(x - 6, y - 6, x + 7, y + 7, glowCol, (px, py) => 0.5 * on * Math.max(0, 1 - Math.hypot(px - x, py - y) / 6)); B.put(x, y, col); }
}

const STYLES = [];

// =====================================================================
// 1. MOON HARBOR — iso pixel night: upward waterfall, sea of clouds, fireflies.
// =====================================================================
STYLES.push({
  name: 'Moon Harbor', sub: 'pure isometric pixel art',
  pal: [...HEROPAL, ...PROPPAL, '07081a', '0b0d24', '141737', '1d2150', '2a2d6a', '3b3c85', '544e9e', '7d65b0', 'a27fc0', 'c9b2e0', 'fff3d6', 'f2deb0', 'd9c08e', 'b59c74',
    '1f5450', '2f7a6a', '3f9a7c', '6fc49a', '6b4766', '553858', '3e2848', '2a1a35', '8f6f8c', '4a3046', 'b07a4f', '7fd7ff', 'c9f1ff', '4aa3d8', 'ffe7a3', 'ffffff'],
  amp: 30,
  low(B, t) {
    skyGrad(B, [[0, '07081a'], [0.35, '1d2150'], [0.7, '3b3c85'], [1, '7d65b0']]);
    drawStars(B, t, 11, [hex('ffffff'), hex('a27fc0')], 300, 130);
    const mx = 272, my = 92, mr = 56;
    B.glow(mx - 130, my - 130, mx + 130, my + 130, hex('a27fc0'), (x, y) => { const d = Math.hypot(x - mx, y - my); return d < mr ? 0 : 0.6 * Math.pow(Math.max(0, 1 - (d - mr) / 100), 2); });
    drawMoon(B, mx, my, mr, { light: hex('fff3d6'), dark: hex('b59c74') });
    const isl = C({ top: '3f9a7c', topD: '2f7a6a', topL: '6fc49a', lipL: '6fc49a', lipR: '3f9a7c', lipD: '2f7a6a', dirtL: '6b4766', dirtR: '553858', strata: '3e2848', stone: '8f6f8c', root: '4a3046', flower: 'ffe7a3' });
    // far clouds and islets
    cloudSea(B, t, 300, C({ light: '7d65b0', mid: '544e9e', dark: '3b3c85' }), 2, 6, 4);
    withISO(40, 200 + bob(t, 0, 2), 1, () => miniIsland(B, 40, 200 + bob(t, 0, 2), 0.9, isl, 41));
    withISO(330, 170 + bob(t, 2, 2), 1, () => miniIsland(B, 330, 170 + bob(t, 2, 2), 0.6, isl, 42));
    const cols = Object.assign(isl, C(PROPS), C({ trunk: '5e3b28', trunkL: '8a5a3a', trunkD: '4a3046', leaf: '2f7a6a', leafL: '6fc49a', leafD: '1f5450', wood: '8a5a3a', woodL: 'b07a4f', woodD: '5e3b28', shadow: '1f5450', trail: 'c9f1ff', z: 'c9f1ff', zOut: '1d2150' }));
    cols.plane = C({ light: 'ffffff', mid: 'c9f1ff', dark: '8f6f8c' }); cols.bubble = C({ out: '1b1426', fill: 'fff6ea', ink: 'd97757' });
    withISO(180, 186, K, () => std(B, t, {
      cols,
      back(B, t) { // upward waterfall rising off the island's right edge into the sky
        const base = P(96, 34, 0), w = 9;
        for (let y = 0; y < base[1] + 2; y++) for (let x = 0; x < w; x++) {
          const ph = (y + t * 90 + hash(x, 0, 3) * 40) % 26, edge = x === 0 || x === w - 1, fade = y < 40 ? y / 40 : 1;
          if (hash(x, y, 7) > fade) continue;
          const c = ph < 3 ? 'c9f1ff' : edge ? '4aa3d8' : (ph < 9 ? '7fd7ff' : '4aa3d8');
          B.put(base[0] - 4 + x + Math.round(Math.sin(y * 0.08 + t * 2) * 0.8), y, hex(c));
        }
        for (let k = 0; k < 18; k++) { const ph = (t * 1.6 + k / 18) % 1; B.put(base[0] + Math.sin(k * 7.1) * 12 * ph, base[1] - ph * 18, hex('c9f1ff')); }
      },
      front(B, t) {
        cloudSea(B, t, 400, C({ light: 'c9b2e0', mid: 'a27fc0', dark: '7d65b0' }), 5, 7, 7);
        fireflies(B, t, 9, [60, 150, 240, 140], hex('ffe7a3'), hex('ffe7a3'), 3);
      }
    }));
  }
});

// =====================================================================
// 2. EMPIRE OF LIGHT — Magritte: a daylight sky, but the island keeps its own night.
// =====================================================================
STYLES.push({
  name: 'Empire of Light', sub: 'Magritte day-sky × pixel night',
  pal: [...HEROPAL, ...PROPPAL, '0a0e14', '111822', '17232c', '1e3330', '27443a', '355a45', '4b7350', '2a2230', '3a2f3e', '4b3d4e', '5e4c5e', 'ffefc4', 'c98a3e', '8a6a3a', '6d8a9c', '9fb6c4', 'dfe9ef', 'ffffff', '33405a', '4a5a78'],
  amp: 26,
  low(B, t) {
    const cols = Object.assign(C(PROPS), C({ top: '27443a', topD: '1e3330', topL: '355a45', lipL: '355a45', lipR: '27443a', lipD: '1e3330', dirtL: '3a2f3e', dirtR: '2a2230', strata: '111822', stone: '4b3d4e', root: '17232c',
      trunk: '111822', trunkL: '2a2230', trunkD: '0a0e14', leaf: '17232c', leafL: '1e3330', leafD: '0a0e14', wood: '8a6a3a', woodL: 'c98a3e', woodD: '3a2f3e', shadow: '0a0e14', trail: 'dfe9ef', z: 'dfe9ef', zOut: '111822',
      stoneL: '4b3d4e', stoneD: '2a2230', cap: '3a2f3e', stem: '4b3d4e', spot: '5e4c5e', box: '33405a', boxL: '4a5a78', boxD: '17232c' }));
    cols.plane = C({ light: 'ffffff', mid: 'dfe9ef', dark: '6d8a9c' }); cols.bubble = C({ out: '0a0e14', fill: 'ffefc4', ink: 'd97757' });
    withISO(180, 196, K, () => std(B, t, {
      cols, lantern: false, layout: { tree: [10, 36], mailbox: [86, 50] },
      back(B) { // Magritte's house with lit windows, and a street lamp
        box(B, 46, 2, 0, 30, 20, 20, null, hex('3a2f3e'), hex('2a2230'));
        B.poly([P(46, 2, 20), P(76, 2, 20), P(76, 12, 31), P(46, 12, 31)], hex('4b3d4e')); B.poly([P(46, 12, 31), P(76, 12, 31), P(76, 22, 20), P(46, 22, 20)], hex('5e4c5e'));
        for (const wx of [52, 66]) { const a = P(wx, 22, 13); B.rect(Math.round(a[0]) - 5, Math.round(a[1]) - 6, 5, 7, hex('ffd88a')); B.rect(Math.round(a[0]) - 5, Math.round(a[1]) - 3, 5, 1, hex('c98a3e')); B.put(Math.round(a[0]) - 4, Math.round(a[1]) - 6, hex('ffefc4')); }
        const s = P(76, 10, 7); B.rect(Math.round(s[0]) + 3, Math.round(s[1]) - 6, 4, 7, hex('f5b45a'));
        box(B, 26, 70, 0, 2, 2, 40, hex('2a2230'), hex('111822'), hex('0a0e14'));
        box(B, 23, 67, 40, 8, 8, 7, hex('ffefc4'), hex('ffd88a'), hex('f5b45a'));
        box(B, 22, 66, 47, 10, 10, 2, hex('2a2230'), hex('111822'), hex('0a0e14'));
      },
      front(B) {
        const L = P(27, 71, 43);
        B.glow(L[0] - 130, L[1] - 70, L[0] + 150, L[1] + 140, hex('f5b45a'), (x, y) => { const d = Math.hypot((x - L[0]) * 0.75, (y - L[1] - 40) * 1.1); return 0.6 * Math.pow(Math.max(0, 1 - d / 110), 1.6); });
        const W = P(59, 22, 10); B.glow(W[0] - 50, W[1] - 20, W[0] + 50, W[1] + 50, hex('ffd88a'), (x, y) => 0.3 * Math.max(0, 1 - Math.hypot(x - W[0], (y - W[1] - 12) * 1.4) / 40));
      }
    }));
  },
  hiBack(F, t) {
    const g = F.createLinearGradient(0, 0, 0, FH); g.addColorStop(0, '#3f78bd'); g.addColorStop(0.5, '#86b4e0'); g.addColorStop(1, '#d5e6f3'); F.fillStyle = g; F.fillRect(0, 0, FW, FH);
    const dx = t * 16;
    softCloud(F, 200 + dx, 250, 560, 230, 'rgba(255,255,255,1)', 'rgba(110,130,165,0.38)', 3);
    softCloud(F, 880 + dx * 0.7, 170, 440, 180, 'rgba(255,255,255,1)', 'rgba(110,130,165,0.34)', 5);
    softCloud(F, 1010 + dx * 1.2, 560, 380, 150, 'rgba(255,252,246,1)', 'rgba(110,130,165,0.32)', 8);
    softCloud(F, 60 + dx * 0.9, 640, 300, 120, 'rgba(255,252,246,1)', 'rgba(110,130,165,0.30)', 13);
    softCloud(F, 860 + dx * 0.6, 1180, 420, 160, 'rgba(255,252,246,1)', 'rgba(110,130,165,0.30)', 17);
    softCloud(F, 150 - dx * 0.4, 1240, 360, 140, 'rgba(255,252,246,1)', 'rgba(110,130,165,0.30)', 19);
    F.fillStyle = 'rgba(255,255,255,0.6)'; F.beginPath(); F.arc(840, 330, 62, 0, 7); F.fill(); F.fillStyle = 'rgba(180,200,230,0.35)'; F.beginPath(); F.arc(822, 318, 16, 0, 7); F.arc(860, 350, 11, 0, 7); F.fill();
    // the island's own night: a soft column of darkness hanging beneath it, full of stars
    F.save(); F.filter = 'blur(46px)';
    let g2 = F.createLinearGradient(0, 600, 0, 1350); g2.addColorStop(0, 'rgba(8,13,22,1)'); g2.addColorStop(0.75, 'rgba(8,13,22,0.95)'); g2.addColorStop(1, 'rgba(8,13,22,0.6)'); F.fillStyle = g2;
    F.beginPath(); F.ellipse(540, 760, 400, 210, 0, 0, 7); F.fill();
    F.beginPath(); F.moveTo(170, 760); F.bezierCurveTo(200, 1000, 300, 1200, 380, 1400); F.lineTo(700, 1400); F.bezierCurveTo(780, 1200, 880, 1000, 910, 760); F.closePath(); F.fill(); F.restore();
    const R = mulberry(9); for (let k = 0; k < 120; k++) { const y = 860 + R() * 480, hw = 330 - (y - 860) * 0.32, x = 540 + (R() - 0.5) * 2 * hw * 0.9, a = 0.35 + 0.65 * Math.abs(Math.sin(t * 2 + k)); F.fillStyle = `rgba(255,248,230,${a})`; F.fillRect(Math.round(x / 3) * 3, Math.round(y / 3) * 3, 3, 3); }
  },
  hiFront(F, t) { const L = P(27, 71, 43); F.save(); F.globalCompositeOperation = 'lighter'; const g = F.createRadialGradient(L[0] * 3, L[1] * 3, 4, L[0] * 3, L[1] * 3, 300); g.addColorStop(0, 'rgba(255,220,150,0.5)'); g.addColorStop(1, 'rgba(255,200,120,0)'); F.fillStyle = g; F.fillRect(0, 0, FW, FH); F.restore(); grain(F, 8, 5); }
});

// =====================================================================
// 3. MELTING MOON — Dalí: pastel desert dusk, the moon drips like wax, stilt-legged elephant.
// =====================================================================
STYLES.push({
  name: 'Melting Moon', sub: 'Dalí desert dusk × pixel',
  pal: [...HEROPAL, ...PROPPAL, '2b2240', '3a2a52', '4a3460', '6d4878', '9a5c84', 'c97b88', 'eaa08e', 'f6c59e', 'ffeccf', 'f6d7a8', 'e2b98a', 'c99a70', 'f0c48a', 'd9a06a', 'b97a50', 'c46e4e', '9a4e3e', '6e3434', '4a2430', '7a5a8a', '5a4070', '3a2430', 'e8b04a', 'b8803a'],
  amp: 30,
  low(B, t) {
    skyGrad(B, [[0, '2b2240'], [0.28, '4a3460'], [0.52, '9a5c84'], [0.75, 'eaa08e'], [1, 'f6c59e']]);
    drawStars(B, t, 5, [hex('ffeccf'), hex('9a5c84')], 140, 40);
    // distant mesas on the horizon and a stilt-legged elephant crossing slowly
    for (const [x, w, h] of [[20, 70, 26], [250, 110, 18], [330, 60, 30]]) B.poly([[x, 330], [x + 8, 330 - h], [x + w - 10, 330 - h], [x + w, 330]], hex('c97b88'));
    B.rect(0, 330, LW, 3, hex('eaa08e'));
    const ex = 300 - t * 9, ey = 248;
    for (let k = 0; k < 4; k++) { const ph = t * 2.2 + k * 1.6, lx = ex - 10 + k * 7 + Math.sin(ph) * 2; B.line(lx, ey + 6, lx + Math.sin(ph) * 3, ey + 82, hex('6d4878')); }
    B.ellipse(ex, ey, 17, 10, hex('6d4878')); B.ellipse(ex - 16, ey - 2, 7, 6, hex('6d4878')); B.line(ex - 21, ey, ex - 24, ey + 12, hex('6d4878')); B.rect(ex - 8, ey - 14, 14, 5, hex('9a5c84')); B.rect(ex - 4, ey - 22, 2, 8, hex('6d4878'));
    // melting moon
    const mx = 238, my = 92, mr = 58;
    B.glow(mx - 120, my - 110, mx + 120, my + 150, hex('f6c59e'), (x, y) => { const d = Math.hypot(x - mx, y - my); return d < mr ? 0 : 0.5 * Math.pow(Math.max(0, 1 - (d - mr) / 90), 2); });
    const drips = [[-0.66, 0.8, 0], [-0.34, 1.6, 1], [-0.02, 1.0, 2], [0.3, 1.35, 3], [0.6, 0.75, 4]];
    drawMoon(B, mx, my, mr, { light: hex('ffeccf'), dark: hex('c99a70') });
    for (const [u, sp, k] of drips) {
      const x = mx + u * mr, ytop = my + Math.sqrt(1 - u * u) * mr - 6, Ld = 12 + sp * (16 + t * 8) + Math.sin(t * 2 + k) * 2, w = 10 - Math.abs(u) * 4;
      B.poly([[x - w / 2 - 2, ytop - 2], [x + w / 2 + 2, ytop - 2], [x + w * 0.32, ytop + Ld], [x - w * 0.32, ytop + Ld]], (px) => mix(hex('ffeccf'), hex('c99a70'), clamp((px - x + w / 2) / w * 0.85 + 0.1, 0, 1)), 22);
      B.circle(x, ytop + Ld, w * 0.5, (px, py) => mix(hex('ffeccf'), hex('c99a70'), clamp((px - x) / w + 0.55, 0, 1)), 22); B.put(x - w * 0.2, ytop + Ld - w * 0.2, hex('ffffff'));
      if (k % 2 === 0) { const ph = ((t * 0.3 + k * 0.23) % 1); B.circle(x, ytop + Ld + 8 + ph * 150, 2.4, hex('f6d7a8')); }
    }
    const cols = Object.assign(C(PROPS), C({ top: 'f0c48a', topD: 'd9a06a', topL: 'f6d7a8', lipL: 'f6d7a8', lipR: 'f0c48a', lipD: 'd9a06a', dirtL: 'c46e4e', dirtR: '9a4e3e', strata: '6e3434', stone: 'eaa08e', root: '4a2430',
      trunk: '4a2430', trunkL: '6e3434', trunkD: '3a2430', wood: 'b97a50', woodL: 'd9a06a', woodD: '6e3434', shadow: 'c99a70', trail: 'ffeccf', z: 'ffeccf', zOut: '4a3460', stoneL: 'f6d7a8', stoneD: 'c99a70', cap: 'c46e4e', box: '7a5a8a', boxL: '9a5c84', boxD: '4a3460' }));
    cols.plane = C({ light: 'ffeccf', mid: 'f6c59e', dark: 'c99a70' }); cols.bubble = C({ out: '3a2430', fill: 'ffeccf', ink: 'd97757' });
    withISO(184, 196, K, () => std(B, t, {
      cols, tree: false, lantern: false, island: { depth: (i, j) => Math.round(24 + 50 * Math.max(0, 1 - Math.hypot(i - 2.5, j - 2.5) / 3.6) + hash(i, j, 5) * 10) },
      back(B, t) {
        // long dusk shadows across the sand
        B.poly([P(46, 44, 0), P(58, 56, 0), P(112, 96, 0), P(100, 84, 0)], hex('d9a06a'));
        // dead tree with a melted pocket watch draped over its branch
        const b = P(16, 22, 0); B.rect(b[0] - 1, b[1] - 46, 4, 46, hex('4a2430')); B.line(b[0] + 2, b[1] - 40, b[0] + 24, b[1] - 54, hex('4a2430')); B.line(b[0] + 2, b[1] - 41, b[0] + 24, b[1] - 55, hex('4a2430')); B.line(b[0], b[1] - 30, b[0] - 14, b[1] - 44, hex('4a2430'));
        const wx = b[0] + 21, wy = b[1] - 54 + Math.sin(t * 1.5) * 0.6;
        B.poly([[wx - 12, wy], [wx + 9, wy - 3], [wx + 10, wy + 7], [wx + 8, wy + 18], [wx + 3, wy + 26], [wx - 1, wy + 19], [wx - 8, wy + 10]], hex('e8b04a'));
        B.poly([[wx - 9, wy + 1], [wx + 7, wy], [wx + 8, wy + 7], [wx + 5, wy + 16], [wx + 2, wy + 21], [wx - 1, wy + 15], [wx - 5, wy + 9]], hex('ffeccf'));
        B.line(wx, wy + 6, wx + 3, wy + 11, hex('3a2430')); B.line(wx, wy + 6, wx - 3, wy + 8, hex('3a2430'));
        withISO(46, 284 + bob(t, 1, 2), 1, () => miniIsland(B, 46, 284 + bob(t, 1, 2), 0.9, cols, 51));
      },
      front(B, t) { for (let k = 0; k < 14; k++) { const ph = (t * 0.4 + k / 14) % 1; B.put(150 + k * 10 + Math.sin(k) * 6, 320 + ph * 130, hex('f0c48a')); } }
    }));
  },
  hiFront(F) { grain(F, 7, 3); }
});

// =====================================================================
// 4. LITHOGRAPH — Escher: paper sky, stairs to a door in the air, the moon is a hole into night.
// =====================================================================
STYLES.push({
  name: 'Lithograph', sub: 'Escher stairs · the moon is a hole in the paper',
  pal: [...HEROPAL, 'f1ead8', 'e2d8c0', 'c9bca0', 'a89a80', '7d705c', '544a3e', '2e2822', '15120f', '0b0b18', '1c1d3a', 'ffffff', 'fff6d8'],
  amp: 40,
  low(B, t) {
    B.rect(0, 0, LW, LH, (x, y) => { const v = 0.1 + 0.16 * (y / LH) + (fbm(x * 0.03, y * 0.03, 2) - 0.5) * 0.22; return mix(hex('f1ead8'), hex('7d705c'), v); }, 40);
    for (let y = 0; y < LH; y += 3) for (let x = 0; x < LW; x++) if (((x + y * 2) % 6 === 0) && fbm(x * 0.02, y * 0.02, 7) > 0.56) B.put(x, y, hex('c9bca0'));
    const mx = 268, my = 88, mr = 54;
    B.circle(mx, my, mr + 2, hex('2e2822'));
    B.circle(mx, my, mr, (x, y) => mix(hex('0b0b18'), hex('1c1d3a'), clamp((y - my + mr) / (2 * mr), 0, 1)), 18);
    const R = mulberry(4); for (let k = 0; k < 46; k++) { const a = R() * 6.28, r = Math.sqrt(R()) * (mr - 3); const x = mx + Math.cos(a) * r, y = my + Math.sin(a) * r; const tw = Math.sin(t * 3 + k) > -0.3; B.put(x, y, tw ? hex('ffffff') : hex('c9bca0')); if (k < 5 && tw) { B.put(x + 1, y, hex('c9bca0')); B.put(x - 1, y, hex('c9bca0')); B.put(x, y - 1, hex('c9bca0')); B.put(x, y + 1, hex('c9bca0')); } }
    for (let k = 0; k < 90; k++) { const a = k / 90 * 6.28; if (Math.sin(a * 3 + 1) > 0.55) B.put(mx + Math.cos(a) * (mr + 1), my + Math.sin(a) * (mr + 1), hex('f1ead8')); }
    // a thin beam of real moonlight leaks through the hole onto the island
    B.glow(120, 120, 300, 330, hex('fff6d8'), (x, y) => { const c = mx - 10 - (y - my) * 0.62; const d = Math.abs(x - c) / (10 + (y - my) * 0.08); return y < my + mr * 0.7 ? 0 : 0.35 * Math.max(0, 1 - d); });
    penrose(B, 318, 214, 30, t);
    const cols = C({ top: 'c9bca0', topD: 'a89a80', topL: 'c9bca0', lipL: 'e2d8c0', lipR: 'c9bca0', lipD: '7d705c', dirtL: 'a89a80', dirtR: '7d705c', strata: '544a3e', stone: 'a89a80', root: '2e2822',
      trunk: '2e2822', trunkL: '544a3e', trunkD: '15120f', leaf: '7d705c', leafL: 'a89a80', leafD: '544a3e', wood: 'a89a80', woodL: 'c9bca0', woodD: '544a3e', shadow: '544a3e', trail: '544a3e', z: '2e2822', zOut: 'f1ead8',
      stoneL: 'e2d8c0', stoneD: '7d705c', post: '544a3e', postL: '7d705c', postD: '2e2822', box: 'a89a80', boxL: 'e2d8c0', boxD: '544a3e', flag: 'd97757', lamp: 'fff6d8', lampL: 'ffffff', lampD: 'e2d8c0', glow: 'fff6d8' });
    cols.plane = C({ light: 'ffffff', mid: 'e2d8c0', dark: 'a89a80' }); cols.bubble = C({ out: '15120f', fill: 'ffffff', ink: 'd97757' });
    withISO(186, 200, K, () => std(B, t, {
      cols, tree: false, layout: { lantern: [84, 30] },
      back(B) {
        // stairs that climb off the island into empty air and end at a door
        for (let k = 0; k < 10; k++) box(B, 14 - k * 9, 30 - k * 2, k * 7, 10, 14, 7, hex('e2d8c0'), hex('a89a80'), hex('7d705c'));
        box(B, -78, 8, 70, 2, 16, 30, hex('544a3e'), hex('2e2822'), hex('15120f'));
        B.poly([P(-76, 10, 72), P(-76, 22, 72), P(-76, 22, 97), P(-76, 10, 97)], hex('fff6d8'));
        B.glow(0, 0, LW, LH, hex('fff6d8'), (x, y) => { const d = P(-76, 16, 84); return 0.3 * Math.max(0, 1 - Math.hypot(x - d[0], y - d[1]) / 40); });
      },
      front(B, t) { // ink hatching on the island's underside
        for (let y = 250; y < 420; y += 2) for (let x = 40; x < 330; x++) { const p = B.get(x, y); if (p && (p[0] === 125 || p[0] === 84) && (x + y) % 4 === 0) B.put(x, y, hex('544a3e')); }
      }
    }));
  },
  hiFront(F) { grain(F, 10, 2); }
});

// =====================================================================
// 5. TEACUP SEA — the island is a sugar cube floating in a giant cup of night.
// =====================================================================
STYLES.push({
  name: 'Teacup Sea', sub: 'scale surrealism · sugar-cube island',
  pal: [...HEROPAL, ...PROPPAL, '090b22', '10143a', '1a1f52', '2a2f6e', '3d4592', '6a73b8', 'eef0f6', 'cdd3e2', '9aa3bd', '6a7290', '474d66', 'e6bf6a', 'b38a3e', '3d5aa8', '2a3f80', '1a1430', '2a1f3a', '3a2b4e', 'fff3d6', 'f2deb0', 'c9b28a', '4fa07a', '2f7a5e', '8fd0a8', 'f8f6f0', 'e4e0d6', 'c8c2b4', 'ffffff'],
  amp: 28,
  low(B, t) {
    skyGrad(B, [[0, '090b22'], [0.5, '1a1f52'], [1, '3d4592']]);
    drawStars(B, t, 21, [hex('ffffff'), hex('6a73b8')], 250, 100);
    drawMoon(B, 80, 70, 40, { light: hex('fff3d6'), dark: hex('c9b28a') });
    const cx = 180, cy = 312, rx = 172, ry = 58;
    B.ellipse(cx + rx + 10, cy + 92, 36, 54, hex('cdd3e2')); B.ellipse(cx + rx + 10, cy + 92, 21, 37, hex('10143a'));
    B.poly([[cx - rx, cy], [cx + rx, cy], [cx + rx - 14, LH + 10], [cx - rx + 14, LH + 10]], (x, y) => { const u = (x - (cx - rx)) / (2 * rx); const l = 0.25 + 0.75 * Math.pow(Math.sin(u * Math.PI), 0.7) * (u < 0.62 ? 1 : 0.8); const band = (y - cy) > 42 && (y - cy) < 60; const pat = band && ((Math.floor(x / 3) + Math.floor((y - cy) / 3)) % 4 === 0); return pat ? hex('3d5aa8') : band ? mix(hex('9aa3bd'), hex('eef0f6'), l) : mix(hex('6a7290'), hex('eef0f6'), l); }, 24);
    B.rect(cx - rx + 6, cy + 40, 2 * rx - 12, 2, hex('e6bf6a')); B.rect(cx - rx + 8, cy + 62, 2 * rx - 16, 1, hex('e6bf6a'));
    B.ellipse(cx, cy, rx + 4, ry + 4, hex('e6bf6a')); B.ellipse(cx, cy, rx + 1, ry + 1, hex('eef0f6')); B.ellipse(cx, cy + 1, rx - 2, ry - 2, hex('cdd3e2'));
    B.ellipse(cx, cy + 3, rx - 6, ry - 6, (x, y) => { const v = (y - (cy - ry)) / (2 * ry); return mix(hex('1a1430'), hex('3a2b4e'), clamp(v + Math.sin(x * 0.07 + t * 2) * 0.05, 0, 1)); }, 22);
    const R = mulberry(8); for (let k = 0; k < 60; k++) { const a = R() * 6.28, r = Math.sqrt(R()); const x = cx + Math.cos(a) * r * (rx - 12), y = cy + 3 + Math.sin(a) * r * (ry - 10); if (Math.sin(t * 3 + k) > 0) B.put(x, y, hex('cdd3e2')); }
    for (let k = 0; k < 8; k++) { const y = cy - 20 + k * 3, w = 22 - k * 2 + Math.sin(t * 4 + k) * 3; B.rect(Math.round(80 + Math.sin(t * 3 + k * 0.8) * 3 - w / 2), y, Math.round(w), 1, hex(k < 3 ? 'fff3d6' : 'c9b28a')); }
    // spoon
    B.poly([[cx - 146, cy - 2], [cx - 138, cy - 5], [cx - 196, cy - 160], [cx - 203, cy - 157]], hex('cdd3e2')); B.line(cx - 140, cy - 4, cx - 198, cy - 158, hex('eef0f6'));
    B.ellipse(cx - 205, cy - 170, 10, 15, hex('9aa3bd')); B.ellipse(cx - 206, cy - 172, 7, 11, hex('eef0f6'));
    // steam: soft continuous wisps that curl up and become clouds
    for (let k = 0; k < 3; k++) for (let sIdx = 0; sIdx < 160; sIdx++) {
      const ph = (sIdx / 160 + t * 0.1 + k * 0.13) % 1, x = cx - 70 + k * 64 + Math.sin(ph * 8 + k * 2 + t * 0.8) * (5 + ph * 20), y = cy - 52 - ph * 230, a = 0.45 * Math.sin(ph * Math.PI) ;
      B.glow(x - 4, y - 4, x + 5, y + 5, hex('eef0f6'), (px, py) => a * Math.max(0, 1 - Math.hypot(px - x, py - y) / (2.5 + ph * 4)), 30);
    }
    // sugar-cube island bobbing in the tea, with ripples
    const oy = 200 + bob(t, 0, 1.6);
    withISO(186, oy, K, () => {
      const rp = P(48, 48, -40); for (let k = 0; k < 3; k++) { const ph = (t * 0.5 + k / 3) % 1, rx2 = 70 + ph * 50, ry2 = 18 + ph * 13; for (let a = 0; a < 200; a++) { const an = a / 200 * 6.283; if (Math.sin(an) < 0.0 || hash(a, k, 7) < 0.3) continue; B.put(rp[0] + Math.cos(an) * rx2, rp[1] + 6 + Math.sin(an) * ry2, ph < 0.6 ? hex('6a73b8') : hex('3a2b4e')); } }
      const cube = (x, y) => (hash(Math.floor(x / 2), Math.floor(y / 2), 4) > 0.8 ? hex('c8c2b4') : null);
      box(B, 8, 8, -40, 84, 84, 36, null, (x, y) => cube(x, y) || hex('f8f6f0'), (x, y) => cube(x, y) || hex('e4e0d6'));
      box(B, 8, 8, -4, 84, 84, 4, (x, y) => (hash(x, y, 2) > 0.88 ? hex('8fd0a8') : hex('4fa07a')), hex('4fa07a'), hex('2f7a5e'));
      // reflection band on the tea under the cube
      const cols = Object.assign(C(PROPS), C({ trunk: '7a5a3a', trunkL: 'b08a5a', trunkD: '474d66', leaf: '2f7a5e', leafL: '8fd0a8', leafD: '1a1f52', wood: 'b08a5a', woodL: 'e4e0d6', woodD: '7a5a3a', shadow: '2f7a5e', trail: 'cdd3e2', z: 'eef0f6', zOut: '10143a' }));
      cols.plane = C({ light: 'ffffff', mid: 'cdd3e2', dark: '9aa3bd' }); cols.bubble = C({ out: '10143a', fill: 'fff3d6', ink: 'd97757' });
      std(B, t, { cols, island: false, layout: { tree: [20, 20], mailbox: [16, 74], lantern: [82, 18], planks: [68, 72], stones: null, mush: null } });
    });
  },
  hiFront(F) { grain(F, 6, 4); }
});

// =====================================================================
// 6. UPSIDE-DOWN SEA — the ocean hangs overhead, a whale swims in the sky, the moon rises below.
// =====================================================================
STYLES.push({
  name: 'Upside-Down Sea', sub: 'ocean overhead · moon below',
  pal: [...HEROPAL, ...PROPPAL, '041821', '07283a', '0b3a52', '115270', '1a6e8c', '2a8fa8', '54b7c4', '9fe3e0', 'e8fffb', '0a2030', '16405a', '1e5a6e', '06121c', '0b1f30', '12304a', 'fff2c8', 'f2d68e', 'c9a860', '3f9a7c', '6fc49a', '2f7a6a', 'c9a87a', 'a8865a', '7a5e44', '4e3a30', 'ffffff'],
  amp: 28,
  low(B, t) {
    skyGrad(B, [[0, '0b3a52'], [0.3, '0b1f30'], [0.7, '06121c'], [1, '12304a']]);
    drawStars(B, t, 31, [hex('e8fffb'), hex('2a8fa8')], LH, 80);
    const mx = 180, my = 478, mr = 100;
    B.glow(mx - 190, my - 190, mx + 190, LH, hex('2a8fa8'), (x, y) => { const d = Math.hypot(x - mx, y - my); return d < mr ? 0 : 0.55 * Math.pow(Math.max(0, 1 - (d - mr) / 120), 2); });
    drawMoon(B, mx, my, mr, { light: hex('fff2c8'), dark: hex('c9a860') });
    const surf = x => 110 + Math.sin(x * 0.05 + t * 2.1) * 4 + Math.sin(x * 0.13 - t * 3.3) * 2;
    B.rect(0, 0, LW, 122, (x, y) => { const s = surf(x); if (y > s) return null; return mix(hex('041821'), hex('1a6e8c'), Math.pow(y / s, 1.6)); }, 26);
    for (let x = 0; x < LW; x++) { const s = Math.round(surf(x)); B.put(x, s, hex('9fe3e0')); if (hash(x, Math.floor(t * 12), 3) > 0.6) B.put(x, s - 1, hex('e8fffb')); if (hash(x, 1, 5) > 0.8) B.put(x, s + 1, hex('54b7c4')); if (hash(x, 9, 5) > 0.93) B.put(x, s + 2, hex('2a8fa8')); }
    for (let k = 0; k < 6; k++) { const x0 = 30 + k * 60 + Math.sin(t + k) * 8; B.glow(x0 - 40, 110, x0 + 70, 340, hex('54b7c4'), (x, y) => { const c = x0 + (y - 110) * 0.25; const d = Math.abs(x - c) / (6 + (y - 110) * 0.06); return 0.22 * Math.max(0, 1 - d) * Math.max(0, 1 - (y - 110) / 230); }); }
    // whale
    const wx = 70 + (t / DUR) * 150, wy = 58, sw = Math.sin(t * 2.4);
    B.poly([[wx - 62, wy], [wx - 40, wy - 18], [wx + 14, wy - 21], [wx + 46, wy - 9], [wx + 58, wy + 2], [wx + 28, wy + 13], [wx - 40, wy + 13]], hex('0a2030'));
    B.poly([[wx - 62, wy], [wx - 86, wy - 15 + sw * 4], [wx - 78, wy + 2], [wx - 86, wy + 16 + sw * 4]], hex('0a2030'));
    B.poly([[wx - 40, wy + 7], [wx + 34, wy + 7], [wx + 26, wy + 13], [wx - 40, wy + 13]], hex('16405a'));
    for (let k = 0; k < 7; k++) B.line(wx - 30 + k * 9, wy + 8, wx - 27 + k * 9, wy + 12, hex('1e5a6e'));
    B.poly([[wx - 2, wy + 8], [wx + 10, wy + 8], [wx + 2, wy + 24 + sw * 2]], hex('0a2030'));
    B.put(wx + 34, wy - 5, hex('9fe3e0')); B.put(wx + 35, wy - 5, hex('e8fffb'));
    for (let k = 0; k < 5; k++) { const ph = (t * 0.25 + k / 5) % 1; const x = 30 + ((k * 97 + ph * 300) % 300), y = 150 + k * 30 + Math.sin(ph * 12) * 4; B.poly([[x, y], [x + 6, y - 2], [x + 9, y], [x + 6, y + 2]], hex('f2d68e')); B.put(x - 1, y - 1, hex('f2d68e')); B.put(x - 1, y + 1, hex('f2d68e')); B.put(x + 7, y - 1, hex('4e3a30')); }
    for (let k = 0; k < 18; k++) { const ph = (t * 0.35 + hash(k, 1, 1)) % 1; const x = 100 + hash(k, 2, 2) * 170 + Math.sin(ph * 10 + k) * 3, y = 230 - ph * 120; B.put(x, y, hex('9fe3e0')); if (k % 3 === 0) { B.put(x + 1, y, hex('54b7c4')); B.put(x, y + 1, hex('54b7c4')); } }
    const cols = Object.assign(C(PROPS), C({ top: '3f9a7c', topD: '2f7a6a', topL: '6fc49a', lipL: '6fc49a', lipR: '3f9a7c', lipD: '2f7a6a', dirtL: 'c9a87a', dirtR: 'a8865a', strata: '7a5e44', stone: 'e8fffb', root: '4e3a30',
      trunk: '7a5e44', trunkL: 'a8865a', trunkD: '4e3a30', leaf: '1e5a6e', leafL: '54b7c4', leafD: '16405a', wood: 'a8865a', woodL: 'c9a87a', woodD: '7a5e44', shadow: '2f7a6a', trail: '9fe3e0', z: 'e8fffb', zOut: '0b1f30', box: '2a8fa8', boxL: '54b7c4', boxD: '115270' }));
    cols.plane = C({ light: 'ffffff', mid: 'e8fffb', dark: '54b7c4' }); cols.bubble = C({ out: '06121c', fill: 'fff2c8', ink: 'd97757' });
    withISO(180, 200, K, () => std(B, t, { cols,
      front(B, t) { for (let k = 0; k < 9; k++) { const p = P(10 + k * 11, 96, -36 - hash(k, 1, 1) * 30); const L = 12 + hash(k, 3, 3) * 22; for (let s = 0; s < L; s++) { const xx = p[0] + Math.round(Math.sin(s * 0.4 + t * 2 + k) * 2); B.put(xx, p[1] + s, hex(k % 2 ? 'f2d68e' : '54b7c4')); if (k % 2 && s % 5 === 2) B.put(xx + 1, p[1] + s, hex('f2d68e')); } } } }));
  },
  hiFront(F) { grain(F, 6, 6); }
});

// =====================================================================
// 7. PAPER STORYBOOK — layered paper-cut night, paper moon on a thread, the pixel island as a sticker.
// =====================================================================
STYLES.push({
  name: 'Paper Storybook', sub: 'paper-cut layers × pixel sticker',
  pal: [...HEROPAL, ...PROPPAL, '3f9a7c', '2f7a6a', '6fc49a', '1f5450', 'c9876a', 'a8654e', '7a4638', '4e2c26', 'e8c9a0', 'b07a4f', 'ffffff', 'f3eadb', 'c7c0d8', '7d7aa8', '2b2a4a', 'ffe7a3'],
  amp: 0,
  low(B, t) {
    const cols = Object.assign(C(PROPS), C({ top: '3f9a7c', topD: '2f7a6a', topL: '6fc49a', lipL: '6fc49a', lipR: '3f9a7c', lipD: '2f7a6a', dirtL: 'c9876a', dirtR: 'a8654e', strata: '7a4638', stone: 'e8c9a0', root: '4e2c26', flower: 'ffe7a3',
      trunk: '5e3b28', trunkL: '8a5a3a', trunkD: '4e2c26', leaf: '2f7a6a', leafL: '6fc49a', leafD: '1f5450', wood: '8a5a3a', woodL: 'b07a4f', woodD: '5e3b28', shadow: '1f5450', trail: 'ffffff', z: 'ffffff', zOut: '2b2a4a' }));
    cols.plane = C({ light: 'ffffff', mid: 'f3eadb', dark: 'c7c0d8' }); cols.bubble = C({ out: '2b2a4a', fill: 'ffffff', ink: 'd97757' });
    withISO(180, 196 + bob(t, 0, 1.2), K, () => std(B, t, { cols }));
  },
  compose(F, low, t) {
    F.fillStyle = '#1c2348'; F.fillRect(0, 0, FW, FH);
    const layer = (col, yBase, amp, freq, ph, sh, tex) => {
      F.save(); F.shadowColor = 'rgba(0,0,0,0.5)'; F.shadowBlur = 28; F.shadowOffsetY = sh; F.fillStyle = col; F.beginPath(); F.moveTo(-20, FH + 20);
      for (let x = -20; x <= FW + 20; x += 16) F.lineTo(x, yBase + Math.sin(x * freq + ph) * amp + Math.sin(x * freq * 2.7 + ph * 2) * amp * 0.35); F.lineTo(FW + 20, FH + 20); F.closePath(); F.fill(); F.restore();
    };
    const R = mulberry(3); F.fillStyle = '#f3eadb'; for (let k = 0; k < 70; k++) { const x = R() * FW, y = R() * 760, r = 2 + R() * 3; F.globalAlpha = 0.45 + 0.55 * Math.abs(Math.sin(t * 2 + k)); F.beginPath(); F.arc(x, y, r, 0, 7); F.fill(); } F.globalAlpha = 1;
    // paper clouds (cut shapes with shadows) drifting at different depths
    const pcloud = (x, y, s, col) => { F.save(); F.shadowColor = 'rgba(0,0,0,0.45)'; F.shadowBlur = 18; F.shadowOffsetX = 8; F.shadowOffsetY = 12; F.fillStyle = col; F.beginPath(); for (const [dx, dy, r] of [[-60, 10, 40], [-15, -12, 56], [40, -4, 46], [80, 14, 32], [0, 22, 46]]) { F.moveTo(x + dx * s + r * s, y + dy * s); F.arc(x + dx * s, y + dy * s, r * s, 0, 7); } F.fill(); F.restore(); };
    pcloud(140 + t * 12, 520, 1.1, '#3a4680'); pcloud(930 - t * 9, 620, 0.9, '#3a4680');
    const sw = Math.sin(t * 1.6) * 0.05; F.save(); F.translate(810, -10); F.rotate(sw); F.strokeStyle = 'rgba(243,234,219,0.8)'; F.lineWidth = 2; F.beginPath(); F.moveTo(0, 0); F.lineTo(0, 150); F.stroke();
    F.shadowColor = 'rgba(0,0,0,0.5)'; F.shadowBlur = 30; F.shadowOffsetX = 14; F.shadowOffsetY = 18; F.fillStyle = '#f6ecd6'; F.beginPath(); F.arc(0, 310, 160, 0, 7); F.fill(); F.shadowColor = 'transparent';
    F.fillStyle = 'rgba(200,180,150,0.35)'; for (const [x, y, r] of [[-60, 260, 34], [50, 360, 24], [70, 240, 16], [-20, 400, 18]]) { F.beginPath(); F.arc(x, y, r, 0, 7); F.fill(); } F.restore();
    for (let k = 0; k < 3; k++) { const x = 140 + k * 170, L = 120 + k * 80, a = Math.sin(t * 1.8 + k) * 0.08; F.save(); F.translate(x, -10); F.rotate(a); F.strokeStyle = 'rgba(243,234,219,0.7)'; F.lineWidth = 2; F.beginPath(); F.moveTo(0, 0); F.lineTo(0, L); F.stroke(); F.translate(0, L + 26); F.shadowColor = 'rgba(0,0,0,0.45)'; F.shadowBlur = 14; F.shadowOffsetX = 6; F.shadowOffsetY = 8; F.fillStyle = '#ffe7a3'; F.beginPath(); for (let i = 0; i < 10; i++) { const r = i % 2 ? 11 : 26, an = i * Math.PI / 5 - Math.PI / 2; F.lineTo(Math.cos(an) * r, Math.sin(an) * r); } F.closePath(); F.fill(); F.restore(); }
    layer('#27306a', 900, 40, 0.004, 0.3 + t * 0.05, 12); pcloud(560 + t * 6, 880, 1.3, '#4a5896'); layer('#34417c', 1040, 34, 0.006, 1.7 - t * 0.08, 14); layer('#46538f', 1170, 26, 0.008, 2.9 + t * 0.1, 16); layer('#5a68a6', 1285, 20, 0.01, 4.1 - t * 0.12, 18);
    const sil = document.createElement('canvas'); sil.width = FW; sil.height = FH; const s = sil.getContext('2d'); s.imageSmoothingEnabled = false; s.drawImage(low, 0, 0, FW, FH); s.globalCompositeOperation = 'source-in'; s.fillStyle = '#fbf6ec'; s.fillRect(0, 0, FW, FH);
    F.save(); F.shadowColor = 'rgba(0,0,0,0.55)'; F.shadowBlur = 34; F.shadowOffsetX = 14; F.shadowOffsetY = 26; for (let a = 0; a < 16; a++) { F.drawImage(sil, Math.cos(a / 16 * 6.283) * 10, Math.sin(a / 16 * 6.283) * 10); if (a === 0) F.shadowColor = 'transparent'; } F.restore();
    pixelUp(F, low);
    pcloud(980 + t * 15, 1080, 1.0, '#f3eadb');
    grain(F, 10, 7);
  }
});

// =====================================================================
// 8. CRYSTAL LOW-POLY — faceted 3D island + crystal moon, rendered as pixels with bloom.
// =====================================================================
STYLES.push({
  name: 'Crystal Low-Poly', sub: 'faceted 3D as pixels + bloom',
  pal: [...HEROPAL, ...PROPPAL, '141331', '1d1b3a', '2c2858', '3f3577', '5b4596', '7e57aa', 'a86cb5', 'd38bb8', 'f2b3b8', 'ffe1c6', '2e6b5e', '3f8f6c', '5fb27a', 'a6d68a', 'd2eea6', '5a4a6a', '7a6a8a', '9c8aa8', '3e3150', 'e8fbff', 'c9f0ff', '8fd3f5', '5aa4e0', '3a6cc0', '2a3f80', 'ffffff', 'b07a4f'],
  amp: 22,
  low(B, t) {
    skyGrad(B, [[0, '141331'], [0.35, '2c2858'], [0.7, '7e57aa'], [1, 'f2b3b8']]);
    drawStars(B, t, 7, [hex('ffffff'), hex('a86cb5')], 220, 70);
    const mx = 270, my = 94, mr = 56, R = mulberry(12), vs = [];
    B.glow(mx - 120, my - 120, mx + 120, my + 120, hex('8fd3f5'), (x, y) => { const d = Math.hypot(x - mx, y - my); return d < mr ? 0 : 0.35 * Math.pow(Math.max(0, 1 - (d - mr) / 80), 2); });
    for (let k = 0; k < 14; k++) { const a = k / 14 * 6.283 + t * 0.12; vs.push([mx + Math.cos(a) * mr, my + Math.sin(a) * mr]); }
    const inner = []; for (let k = 0; k < 7; k++) { const a = k / 7 * 6.283 + 0.3 + t * 0.12; inner.push([mx + Math.cos(a) * mr * 0.5 + (R() - 0.5) * 6, my + Math.sin(a) * mr * 0.5 + (R() - 0.5) * 6]); }
    const face = (pts) => { const c = pts.reduce((a, p) => [a[0] + p[0] / pts.length, a[1] + p[1] / pts.length], [0, 0]); const nx = (c[0] - mx) / mr, ny = (c[1] - my) / mr; const l = clamp(0.55 + (-nx * 0.6 - ny * 0.7) * 0.6 + (hash(Math.round(c[0]), Math.round(c[1]), 1) - 0.5) * 0.3, 0, 1); B.poly(pts, mix(hex('3a6cc0'), hex('e8fbff'), l)); };
    for (let k = 0; k < 14; k++) { const a = vs[k], b = vs[(k + 1) % 14], c = inner[Math.floor(k / 2) % 7], d = inner[(Math.floor(k / 2) + 1) % 7]; face([a, b, k % 2 ? d : c]); }
    for (let k = 0; k < 7; k++) face([inner[k], inner[(k + 1) % 7], [mx, my]]);
    for (let k = 0; k < 7; k++) { const a = k / 7 * 6.283 + t * 0.6, x = mx + Math.cos(a) * 88, y = my + Math.sin(a) * 26, s = 4 + (k % 3); if (Math.sin(a) < -0.2) continue; B.poly([[x, y - s], [x + s * 0.6, y], [x, y + s * 1.3], [x - s * 0.6, y]], mix(hex('5aa4e0'), hex('e8fbff'), 0.5 + 0.5 * Math.sin(a))); B.poly([[x, y - s], [x + s * 0.6, y], [x, y + s * 1.3]], hex('3a6cc0')); }
    withISO(180, 196, K, () => {
      const N = 8, T = 12, cxh = 4, hgt = (i, j) => { if (Math.hypot(i - 4.3, j - 4.2) < 1.7) return 0; const d = Math.hypot(i - cxh, j - cxh); return d > 3.7 ? -1 : Math.round(Math.max(0, (hash(i, j, 3) - 0.3) * 14 + (i < 3 && j < 3 ? 10 : 0))); };
      const inside = (i, j) => Math.hypot(i - cxh, j - cxh) <= 4.05, tris = [], sun = [0.5, -0.4, 0.77];
      for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) { if (!inside(i + 0.5, j + 0.5)) continue; const v = (a, b) => [a * T, b * T, inside(a, b) ? Math.max(0, hgt(a, b)) : -1]; const A = v(i, j), Bv = v(i + 1, j), Cv = v(i + 1, j + 1), D = v(i, j + 1); if ((i + j) % 2) tris.push([A, Bv, Cv, 'top'], [A, Cv, D, 'top']); else tris.push([A, Bv, D, 'top'], [Bv, Cv, D, 'top']); }
      const rim = []; for (let k = 0; k < 22; k++) { const a = k / 22 * 6.283; rim.push([48 + Math.cos(a) * 50, 48 + Math.sin(a) * 50, -1]); }
      const tip = [52, 52, -96], mids = rim.map((p, k) => [lerp(p[0], tip[0], 0.42) + (hash(k, 1, 1) - 0.5) * 12, lerp(p[1], tip[1], 0.42) + (hash(k, 2, 1) - 0.5) * 12, -38 - hash(k, 3, 3) * 18]);
      for (let k = 0; k < 22; k++) { const a = rim[k], b = rim[(k + 1) % 22], c = mids[k], d = mids[(k + 1) % 22]; tris.push([a, b, d, 'rock'], [a, d, c, 'rock'], [c, d, tip, 'rock']); }
      const nrm = (tr) => { const [a, b, c] = tr, u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], w = [c[0] - a[0], c[1] - a[1], c[2] - a[2]]; let n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]]; const l = Math.hypot(...n) || 1; n = n.map(q => q / l); if (tr[3] === 'top' && n[2] < 0) n = n.map(q => -q); return n; };
      const key = tr => tr.slice(0, 3).reduce((s, p) => s + p[0] + p[1] + p[2] * 0.25, 0);
      tris.sort((p, q) => key(p) - key(q));
      for (const tr of tris) {
        const n = nrm(tr); if (tr[3] === 'rock' && n[0] + n[1] < -0.05) continue;
        const d = clamp(n[0] * sun[0] + n[1] * sun[1] + n[2] * sun[2], 0, 1), jit = (hash(Math.round(key(tr)), 3, 3) - 0.5) * 0.12;
        const col = tr[3] === 'top' ? mix(hex('2e6b5e'), hex('d2eea6'), clamp(d * 1.05 - 0.1 + jit, 0, 1)) : mix(hex('3e3150'), hex('9c8aa8'), clamp(0.1 + d * 0.95 + jit, 0, 1));
        B.poly(tr.slice(0, 3).map(p => P(...p)), col);
      }
      for (const [x, y, h, w] of [[16, 26, 34, 6], [26, 16, 26, 5], [12, 38, 20, 4], [84, 30, 22, 4]]) { const b = P(x, y, 2), tp = P(x, y, h); B.poly([[b[0] - w, b[1]], [tp[0], tp[1]], [b[0], b[1] + 2]], hex('8fd3f5')); B.poly([[b[0], b[1] + 2], [tp[0], tp[1]], [b[0] + w, b[1]]], hex('3a6cc0')); B.line(tp[0], tp[1], b[0], b[1] + 1, hex('e8fbff')); }
      const cols = Object.assign(C(PROPS), C({ wood: '8a5a3a', woodL: 'b07a4f', woodD: '5e3b28', shadow: '2e6b5e', trail: 'e8fbff', z: 'e8fbff', zOut: '2c2858', stoneL: '9c8aa8', stoneD: '5a4a6a', box: '5b4596', boxL: 'a86cb5', boxD: '3f3577' }));
      cols.plane = C({ light: 'ffffff', mid: 'e8fbff', dark: '9c8aa8' }); cols.bubble = C({ out: '141331', fill: 'ffffff', ink: 'd97757' });
      std(B, t, { cols, island: false, tree: false, layout: { mush: null, lantern: [80, 60], mailbox: [24, 72], stones: null } });
    });
    for (let k = 0; k < 4; k++) { const x = 40 + k * 92, y = 336 + (k % 2) * 40 + bob(t, k, 3), s = 6 + (k % 2) * 4; B.poly([[x, y - s], [x + s, y], [x, y + s * 1.6], [x - s, y]], hex('7a6a8a')); B.poly([[x, y - s], [x + s, y], [x, y + s * 1.6]], hex('5a4a6a')); B.poly([[x - s, y], [x, y - s], [x + s, y], [x, y - 2]], hex('5fb27a')); }
  },
  compose(F, low, t) { pixelUp(F, low); bloom(F, low, 170, 0.6, 10); grain(F, 5, 8); }
});

// =====================================================================
// 9. DESK-LAMP MOON — the moon is a giant desk lamp; the island hovers over the Handler's desk.
// =====================================================================
STYLES.push({
  name: 'Desk-Lamp Moon', sub: 'the moon is a lamp on a giant desk',
  pal: [...HEROPAL, ...PROPPAL, '3f9a7c', '2f7a6a', '6fc49a', '1f5450', '6b4766', '553858', '3e2848', '2a1a35', '8f6f8c', '4a3046', 'b07a4f', 'ffe7a3', 'fff6d8', 'c9f1ff', 'ffffff'],
  amp: 0,
  low(B, t) {
    const cols = Object.assign(C(PROPS), C({ top: '3f9a7c', topD: '2f7a6a', topL: '6fc49a', lipL: '6fc49a', lipR: '3f9a7c', lipD: '2f7a6a', dirtL: '6b4766', dirtR: '553858', strata: '3e2848', stone: '8f6f8c', root: '4a3046', flower: 'ffe7a3',
      trunk: '5e3b28', trunkL: '8a5a3a', trunkD: '4a3046', leaf: '2f7a6a', leafL: '6fc49a', leafD: '1f5450', wood: '8a5a3a', woodL: 'b07a4f', woodD: '5e3b28', shadow: '1f5450', trail: 'fff6d8', z: 'fff6d8', zOut: '2a1a35' }));
    cols.plane = C({ light: 'ffffff', mid: 'fff6d8', dark: '8f6f8c' }); cols.bubble = C({ out: '2a1a35', fill: 'fff6d8', ink: 'd97757' });
    withISO(166, 214 + bob(t, 0, 1.4), K, () => std(B, t, { cols }));
  },
  compose(F, low, t) {
    let g = F.createLinearGradient(0, 0, 0, FH); g.addColorStop(0, '#0f0b18'); g.addColorStop(0.7, '#1b1324'); g.addColorStop(1, '#271a22'); F.fillStyle = g; F.fillRect(0, 0, FW, FH);
    // wallpaper hint: faint vertical stripes
    F.fillStyle = 'rgba(255,255,255,0.025)'; for (let x = 0; x < FW; x += 90) F.fillRect(x, 0, 40, 1060);
    // desk in perspective
    F.save(); F.beginPath(); F.moveTo(0, 1090); F.lineTo(FW, 1030); F.lineTo(FW, FH); F.lineTo(0, FH); F.closePath(); F.clip();
    g = F.createLinearGradient(0, 1030, 0, FH); g.addColorStop(0, '#4f2f23'); g.addColorStop(1, '#2a1712'); F.fillStyle = g; F.fillRect(0, 1000, FW, 400);
    for (let k = 0; k < 34; k++) { F.strokeStyle = `rgba(${95 + (k % 3) * 15},${58 + (k % 4) * 6},40,0.28)`; F.lineWidth = 1 + (k % 3); F.beginPath(); const y = 1040 + k * 9; F.moveTo(0, y + 50); F.bezierCurveTo(300, y + 40 + Math.sin(k) * 10, 700, y + 10 + Math.cos(k) * 10, FW, y); F.stroke(); }
    F.save(); F.translate(180, 1250); F.rotate(-0.1); F.shadowColor = 'rgba(0,0,0,0.5)'; F.shadowBlur = 20; F.shadowOffsetY = 8; F.fillStyle = '#efe4cf'; F.fillRect(-130, -70, 360, 150); F.shadowColor = 'transparent'; F.fillStyle = 'rgba(120,110,150,0.35)'; for (let i = 0; i < 6; i++) F.fillRect(-110, -50 + i * 20, 300, 2); F.fillStyle = 'rgba(40,30,60,0.6)'; F.font = 'italic 22px Georgia'; F.fillText('a bridge to the moon?', -100, -18); F.restore();
    F.save(); F.translate(840, 1205); F.rotate(-0.25); F.shadowColor = 'rgba(0,0,0,0.5)'; F.shadowBlur = 16; F.shadowOffsetY = 8; F.fillStyle = '#e8b04a'; F.fillRect(-190, -17, 310, 34); F.shadowColor = 'transparent'; F.fillStyle = '#c98a2a'; F.fillRect(-190, 6, 310, 11); F.fillStyle = '#f2d2a8'; F.beginPath(); F.moveTo(120, -17); F.lineTo(178, 0); F.lineTo(120, 17); F.fill(); F.fillStyle = '#2a1b22'; F.beginPath(); F.moveTo(162, -5); F.lineTo(178, 0); F.lineTo(162, 5); F.fill(); F.fillStyle = '#d98a8a'; F.fillRect(-222, -17, 32, 34); F.fillStyle = '#b8b0a8'; F.fillRect(-200, -17, 12, 34); F.restore();
    F.restore();
    // lamp: the bulb faces us like a full moon; the shade is a dark crescent around it
    const bx = 780, by = 290, br = 118;
    F.strokeStyle = '#2e2236'; F.lineWidth = 28; F.lineCap = 'round'; F.beginPath(); F.moveTo(FW + 60, 640); F.lineTo(1010, 470); F.lineTo(bx + 150, by + 40); F.stroke();
    F.strokeStyle = '#4c3b55'; F.lineWidth = 7; F.beginPath(); F.moveTo(FW + 52, 632); F.lineTo(1002, 462); F.lineTo(bx + 142, by + 32); F.stroke();
    F.fillStyle = '#3a2c44'; F.beginPath(); F.arc(1010, 470, 22, 0, 7); F.fill(); F.fillStyle = '#5a4866'; F.beginPath(); F.arc(1005, 465, 8, 0, 7); F.fill();
    F.save(); F.globalCompositeOperation = 'lighter'; g = F.createRadialGradient(bx, by, br * 0.8, bx - 120, by + 500, 820); g.addColorStop(0, 'rgba(255,236,190,0.36)'); g.addColorStop(0.5, 'rgba(255,220,160,0.1)'); g.addColorStop(1, 'rgba(255,210,150,0)');
    F.fillStyle = g; F.beginPath(); F.moveTo(bx - br, by); F.lineTo(bx + br * 0.7, by + br * 0.7); F.lineTo(620, 1350); F.lineTo(-150, 1200); F.closePath(); F.fill(); F.restore();
    F.save(); g = F.createRadialGradient(bx + 40, by - 30, br * 0.7, bx + 20, by - 10, br * 1.5); g.addColorStop(0, '#5b4865'); g.addColorStop(1, '#231a2c'); F.fillStyle = g; F.beginPath(); F.arc(bx + 26, by - 22, br * 1.22, 0, 7); F.fill();
    F.strokeStyle = '#8a7494'; F.lineWidth = 4; F.beginPath(); F.arc(bx + 2, by + 2, br + 10, 0, 7); F.stroke(); F.restore();
    g = F.createRadialGradient(bx - 30, by - 30, 10, bx, by, br); g.addColorStop(0, '#ffffff'); g.addColorStop(0.55, '#fff4d4'); g.addColorStop(1, '#f2d08e'); F.fillStyle = g; F.beginPath(); F.arc(bx, by, br, 0, 7); F.fill();
    F.fillStyle = 'rgba(230,200,140,0.35)'; for (const [x, y, r] of [[-40, -20, 22], [30, 30, 15], [40, -40, 10], [-10, 50, 12]]) { F.beginPath(); F.arc(bx + x, by + y, r, 0, 7); F.fill(); }
    F.save(); F.globalCompositeOperation = 'lighter'; g = F.createRadialGradient(bx, by, br * 0.9, bx, by, br * 3.4); g.addColorStop(0, 'rgba(255,235,190,0.5)'); g.addColorStop(1, 'rgba(255,220,160,0)'); F.fillStyle = g; F.fillRect(0, 0, FW, FH); F.restore();
    const R = mulberry(4); for (let k = 0; k < 80; k++) { const x = 120 + R() * 760 + Math.sin(t * 0.8 + k) * 14, y = 360 + R() * 760 - t * 10 * (0.5 + R()); F.fillStyle = `rgba(255,240,210,${0.25 + 0.5 * R()})`; F.beginPath(); F.arc(x, y, 1.5 + R() * 1.6, 0, 7); F.fill(); }
    F.save(); F.filter = 'blur(26px)'; F.fillStyle = 'rgba(0,0,0,0.6)'; F.beginPath(); F.ellipse(430, 1190, 290, 46, -0.05, 0, 7); F.fill(); F.restore();
    pixelUp(F, low);
    F.save(); F.globalCompositeOperation = 'soft-light'; g = F.createRadialGradient(bx, by, 50, bx - 250, by + 450, 850); g.addColorStop(0, 'rgba(255,220,150,0.85)'); g.addColorStop(1, 'rgba(60,30,80,0.6)'); F.fillStyle = g; F.fillRect(0, 0, FW, FH); F.restore();
    vignette(F, 0.5, '10,6,14'); grain(F, 7, 9);
  }
});
