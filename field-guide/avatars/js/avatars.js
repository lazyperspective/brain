'use strict';
// ------------------------------------------------------------------
// AVATARS — stylized block characters in the RGB-fight style. Recognizable by signature traits only
// (hair, outfit, glasses, one small prop); same block body language as the hero.
// Zones on the block: clothes (bottom) · skin (face band) · hair (top + fringe). Face on the +x side ('x') or +y ('y').
// ------------------------------------------------------------------
const HITS = [];
const AV = {
  elon: { name: 'ELON', skin: 'f0c6a4', skinD: 'd2a383', hair: '3a2a22', hairL: '5c4436', hairD: '22170f', style: 'swept', cloth: '1d1d25', clothL: '343442', clothD: '101016', neck: 'crew', shoe: '15151a', mouth: 'smirk' },
  jensen: { name: 'JENSEN', skin: 'e6b38d', skinD: 'c99470', hair: 'b3b3bc', hairL: 'd8d8de', hairD: '75757f', style: 'back', cloth: '16161c', clothL: '4a4a58', clothD: '09090c', neck: 'jacket', shoe: '0e0e12', mouth: 'grin' },
  sam: { name: 'SAM', skin: 'f2c8a6', skinD: 'd6a987', hair: '6b4a32', hairL: '8c6649', hairD: '45301f', style: 'short', cloth: '8b9097', clothL: 'a9aeb5', clothD: '676c73', neck: 'crew', shoe: 'ececec', mouth: 'smile' },
  dario: { name: 'DARIO', skin: 'eec3a1', skinD: 'd1a482', hair: '2b1e19', hairL: '4a352b', hairD: '150d0a', style: 'curly', cloth: '2c3e66', clothL: '425a8e', clothD: '1c2946', neck: 'collar', shoe: '3a2a20', mouth: 'smile', glasses: true },
};
for (const k in AV) for (const c of ['skin', 'skinD', 'hair', 'hairL', 'hairD', 'cloth', 'clothL', 'clothD', 'shoe']) AV[k][c] = hex(AV[k][c]);
const APAL = PAL.concat(['f0c6a4', 'd2a383', 'e6b38d', 'c99470', 'f2c8a6', 'd6a987', 'eec3a1', 'd1a482', 'b8876a', '9c6f55',
  '3a2a22', '5c4436', '22170f', 'b3b3bc', 'd8d8de', '75757f', '6b4a32', '8c6649', '45301f', '2b1e19', '4a352b', '150d0a',
  '1d1d25', '343442', '101016', '16161c', '4a4a58', '09090c', '8b9097', 'a9aeb5', '676c73', 'ececec', '2c3e66', '425a8e', '1c2946', 'f2f2f2', '3a2a20',
  '2a1d1a', 'e86a6a', '3fbf5a', '9be86a', 'c8a040', 'dfe6ff', '8fb4ff', 'f5f0e6', '7a4a30', 'ff8a3d']);

function avatar(B, c, hx, hy, st, face) {
  const k = ISO.k, sq = st.squash || 0, bz = 17 * (1 - sq), bx = 15 * (1 + sq * 0.5), by = 15 * (1 + sq * 0.5), T = st.T || 0;
  const z0 = 3 + (st.hop || 0), x0 = hx - bx / 2, y0 = hy - by / 2, x1 = x0 + bx, y1 = y0 + by, zt = z0 + bz, ch = 1.6;
  const fk = Math.max(1, k / 1.4), G = Math.max(1, Math.round(fk)), OX = ISO.ox, OY = ISO.oy, D = hex('2a1d1a');
  { const sp = P(hx, hy, 0), r = 11.5 * k; B.ellipse(sp[0] + 1, sp[1] + 1, r, r * 0.45, hex('0b0814')); B.ellipse(sp[0] + 1, sp[1] + 1, r * 0.66, r * 0.28, hex('000000')); }
  for (const [lx, ly] of [[x0 + 1.5, y0 + 1.5], [x0 + bx - 4.5, y0 + 1.5], [x0 + 1.5, y0 + by - 4.5], [x0 + bx - 4.5, y0 + by - 4.5]]) box(B, lx, ly, st.hop || 0, 3, 3, 3.2, mix(c.shoe, hex('ffffff'), 0.15), c.shoe, mix(c.shoe, hex('000000'), 0.35));
  const isFace = s => (face === 'x') === (s === 'R');
  const CL = 0.36;                                                                     // clothes up to here
  const hairLine = (along, s) => {
    if (!isFace(s)) return 0.66 + 0.04 * Math.sin(along * 0.9);                        // side of the head
    const u = along / by;
    if (c.style === 'swept') return 0.79 + 0.09 * u + (hash(Math.floor(along * 1.2), 3, 1) < 0.3 ? -0.02 : 0);
    if (c.style === 'back') return 0.86;
    if (c.style === 'curly') return 0.74 + 0.045 * Math.abs(Math.sin(along * 1.25));
    return 0.81 + 0.025 * Math.sin(along * 2.1);
  };
  const hairTex = (a, z, lit) => {
    let h = c.hair;
    if (c.style === 'curly') { const ci = Math.floor(a / 1.6), cz = Math.floor(z / 1.6), dx = a - (ci + 0.5) * 1.6, dz = z - (cz + 0.5) * 1.6, d = Math.hypot(dx, dz); h = d < 0.5 ? c.hairL : d > 0.85 ? c.hairD : c.hair; }
    else if (c.style === 'back' || c.style === 'swept') { const q = Math.sin(a * 2.6 + z * 0.5); h = q > 0.6 ? c.hairL : q < -0.7 ? c.hairD : c.hair; }
    else { h = hash(Math.floor(a * 1.5), Math.floor(z * 1.5), 7) > 0.75 ? c.hairL : c.hair; }
    return lit ? h : mix(h, c.hairD, 0.45);
  };
  const clothTex = (a, z, f, s) => {
    let col = s === 'L' ? c.cloth : mix(c.cloth, c.clothD, 0.55); const mid = by / 2, fromTop = (CL - f) / CL;   // 0 at the neckline
    if (c.neck === 'crew' && fromTop < 0.12) col = mix(col, c.clothL, 0.55);
    if (c.neck === 'jacket') {
      const sheen = Math.sin(a * 0.9 - z * 1.3); if (sheen > 0.85) col = mix(col, c.clothL, 0.6); else if (sheen > 0.6) col = mix(col, c.clothL, 0.25);
      if (isFace(s)) { const v = Math.abs(a - mid); if (v < (1 - fromTop) * 3.2) col = hex('2a2a32'); else if (v < (1 - fromTop) * 3.2 + 0.9) col = mix(c.clothL, hex('ffffff'), 0.2);
        if (Math.abs(a - mid - 4.5) < 0.35 && fromTop > 0.15) col = hex('6a6a78'); }
    }
    if (c.neck === 'collar' && isFace(s)) { const v = Math.abs(a - mid); if (fromTop < 0.28 && v < 2.6 - fromTop * 6) col = hex('f2f2f2'); else if (fromTop < 0.1 && v < 4) col = hex('dcdcdc'); }
    if (c.neck === 'crew' && c.name === 'SAM' && hash(Math.floor(a * 2), Math.floor(z * 2), 3) > 0.8) col = mix(col, c.clothL, 0.35);   // knit fleck
    if (f < 0.07) col = mix(col, hex('000000'), 0.35);
    return col;
  };
  const zoneCol = (a, z, s) => {
    const f = clamp((z - z0) / bz, 0, 1), lit = s === 'L';
    let col;
    if (f < CL) col = clothTex(a, z, f, s);
    else if (f > hairLine(a, s)) col = hairTex(a, z, lit);
    else { col = lit ? c.skin : c.skinD; if (f < CL + 0.06) col = mix(col, c.skinD, 0.6); if (f > hairLine(a, s) - 0.04) col = mix(col, c.hairD, 0.3);
      if (!isFace(s) && Math.abs(a - by * 0.5) < 1.1 && f > 0.52 && f < 0.6) col = mix(col, c.skinD, 0.7); }   // ear
    return [...col, 10];
  };
  const unL = (sx, sy) => { const x = (sx + 0.5 - OX) / k + y1; return [x - x0, (x + y1) / 2 - (sy + 0.5 - OY) / k]; };
  const unR = (sx, sy) => { const y = x1 - (sx + 0.5 - OX) / k; return [y - y0, (x1 + y) / 2 - (sy + 0.5 - OY) / k]; };
  B.poly([P(x0, y1, zt), P(x1 - ch, y1, zt), P(x1 - ch, y1, z0), P(x0, y1, z0)], (sx, sy) => { const [a, z] = unL(sx, sy); return zoneCol(a, z, 'L'); });
  B.poly([P(x1, y0, zt), P(x1, y1 - ch, zt), P(x1, y1 - ch, z0), P(x1, y0, z0)], (sx, sy) => { const [a, z] = unR(sx, sy); return zoneCol(by - a, z, 'R'); });
  B.poly([P(x1 - ch, y1, zt), P(x1, y1 - ch, zt), P(x1, y1 - ch, z0), P(x1 - ch, y1, z0)], (sx, sy) => { const z = (x1 + y1 - ch) / 2 - (sy + 0.5 - OY) / k, f = (z - z0) / bz; return [...(f < CL ? mix(c.cloth, c.clothD, 0.3) : f > 0.74 ? c.hair : mix(c.skin, c.skinD, 0.5)), 8]; });
  // top: hair, lit from the back-left
  B.poly([P(x0 + 1, y0, zt), P(x1, y0, zt), P(x1, y1 - ch, zt), P(x1 - ch, y1, zt), P(x0, y1, zt), P(x0, y0 + 1, zt)], (sx, sy) => {
    const u = (sx + 0.5 - OX) / k, v = (sy + 0.5 - OY) / k + zt, x = v + u / 2 - x0, y = v - u / 2 - y0;
    const dir = c.style === 'back' ? (face === 'x' ? x : y) : c.style === 'swept' ? x + y * 0.6 : x - y;
    let col = hairTex(dir, (face === 'x' ? y : x) * 0.7, true); if (x + y < 9) col = mix(col, c.hairL, 0.3); return [...col, 10];
  });
  // hair volume: pompadour, curls, front swoop
  if (c.style === 'back') { if (face === 'x') box(B, x1 - 5, y0 + 1.5, zt, 4, by - 3.5, 1.4, c.hair, c.hairD, c.hair); else box(B, x0 + 1.5, y1 - 5, zt, bx - 3.5, 4, 1.4, c.hair, c.hair, c.hairD); }
  if (c.style === 'swept') { if (face === 'x') box(B, x1 - 4, y0 + 1, zt, 3.2, by - 4, 1.2, c.hairL, c.hair, c.hairD); else box(B, x0 + 1, y1 - 4, zt, bx - 4, 3.2, 1.2, c.hairL, c.hair, c.hairD); }
  if (c.style === 'curly') { for (let q = 0; q < 14; q++) { const t = q / 13, px = q < 7 ? lerp(x0 + 1, x1 - 1, t * 2) : x1 - 0.5, py = q < 7 ? y1 - 0.5 : lerp(y1 - 1, y0 + 1, (t - 0.5) * 2), p = P(px, py, zt + 0.4), r = (1.1 + hash(q, 1, 2) * 0.5) * k; B.circle(p[0], p[1], r, c.hair); B.circle(p[0] - r * 0.3, p[1] - r * 0.3, r * 0.45, c.hairL); }
    for (let q = 0; q < 9; q++) { const p = P(x0 + 2 + hash(q, 2, 2) * (bx - 4), y0 + 2 + hash(q, 3, 2) * (by - 4), zt + 0.6), r = (1.2 + hash(q, 4, 2) * 0.6) * k; B.circle(p[0], p[1], r, c.hair); B.circle(p[0] - r * 0.3, p[1] - r * 0.3, r * 0.4, c.hairL); } }
  { const a = P(x0 + 1, y1, zt), b = P(x1 - ch, y1, zt); B.line(a[0], a[1], b[0], b[1], c.hairL); }
  // face
  const ez = z0 + bz * 0.6, lk = st.look || [0, 0], EW = Math.max(2, Math.round(2.4 * fk)), EH = Math.max(3, Math.round(3.4 * fk)), eyes = [];
  const fp = (along, z) => face === 'x' ? P(x1, y0 + along, z) : P(x0 + along, y1, z);
  const eyeAt = [by * 0.3, by * 0.7].map(al => fp(al, ez));
  eyeAt.forEach((e, idx) => {
    const ex = Math.round(e[0] + lk[0] * fk), ey = Math.round(e[1] + lk[1] * fk); eyes.push([ex, ey]); const x = ex - Math.round(EW / 2), y = ey - Math.round(EH / 2);
    if (st.blink) B.rect(x - G, ey, EW + 2 * G, G, D); else { B.rect(x, y + G, EW, EH - G, D); B.rect(x, y, EW, G, D); B.rect(x, y + G, G, G, hex('ffffff')); }
    const inward = Math.sign(eyeAt[1 - idx][0] - e[0]);
    for (let q = -G; q < EW + G; q++) B.rect(x + q, y - 2 * G - (c.style === 'back' && (inward > 0 ? q < EW / 2 : q > EW / 2) ? G : 0), 1, G, c.hairD);       // brows
    if (c.glasses) { const gx = x - G - 1, gy = y - G, gw = EW + 2 * G + 2, gh = EH + 2 * G + 1; B.rect(gx, gy, gw, G, hex('101016')); B.rect(gx, gy + gh - G, gw, G, hex('101016')); B.rect(gx, gy, G, gh, hex('101016')); B.rect(gx + gw - G, gy, G, gh, hex('101016'));
      B.rect(gx + G, gy + G, G, G, hex('dfe6ff')); if (inward > 0) B.rect(gx + gw, gy + Math.round(gh / 3), Math.round((eyeAt[1 - idx][0] - e[0]) - gw - 0), G, hex('101016')); }
  });
  const mp = fp(by * 0.5, z0 + bz * 0.44), mx = Math.round(mp[0] + lk[0] * fk * 0.5), my = Math.round(mp[1]);
  if (c.mouth === 'grin') { B.rect(mx - 2 * G, my, 5 * G, 2 * G, D); B.rect(mx - G, my, 3 * G, G, hex('ffffff')); }
  else if (c.mouth === 'smirk') { B.rect(mx - 2 * G, my + G, 4 * G, G, D); B.rect(mx + 2 * G, my, G, G, D); }
  else { B.rect(mx - G, my + G, 3 * G, G, D); B.rect(mx - 2 * G, my, G, G, D); B.rect(mx + 2 * G, my, G, G, D); }
  { const n = fp(by * 0.5, z0 + bz * 0.52); B.rect(Math.round(n[0]) - (face === 'x' ? 0 : G), Math.round(n[1]), G, G, c.skinD); }
  // arm on the non-face visible side (clothes) with a skin hand; raises with st.arm
  const az = z0 + bz * 0.12 + (st.arm || 0) * 7, hand = face === 'x' ? [x0 + bx * 0.45, y1 + 1.2, az + 3.5] : [x1 + 1.2, y0 + by * 0.45, az + 3.5];
  if (face === 'x') box(B, x0 + bx * 0.4, y1, az, 3.6, 2.6, 4, mix(c.cloth, c.clothL, 0.4), c.cloth, c.clothD); else box(B, x1, y0 + by * 0.4, az, 2.6, 3.6, 4, mix(c.cloth, c.clothL, 0.4), c.cloth, c.clothD);
  { const h = P(...hand); B.rect(Math.round(h[0]) - G, Math.round(h[1]) - G, 3 * G, 2 * G, c.skin); }
  return { center: P(hx, hy, z0 + bz / 2), top: P(hx, hy, zt), foot: P(hx, hy, 0), hand, eyes };
}

// ---------------- props ----------------
function rocketW(B, at, T) {   // a little rocket hovering, flame flickering
  const p = P(at[0], at[1], at[2] + Math.sin(T * 3) * 1.5), k = ISO.k / 1.4, s = Math.max(1, Math.round(k));
  const x = Math.round(p[0]), y = Math.round(p[1]);
  B.rect(x - s, y - 7 * s, 3 * s, 8 * s, hex('f5f0e6')); B.rect(x, y - 9 * s, s, 2 * s, hex('f5f0e6')); B.rect(x - s, y - 8 * s, 3 * s, s, hex('dfe6ff'));
  B.rect(x, y - 5 * s, s, s, hex('2c3e66')); B.rect(x - 2 * s, y - s, s, 2 * s, hex('c8a040')); B.rect(x + 2 * s, y - s, s, 2 * s, hex('c8a040'));
  const fl = 2 + Math.round((Math.sin(T * 40) * 0.5 + 0.5) * 3); B.rect(x - s + 1, y + s, s, fl * s, hex('ff8a3d')); B.rect(x, y + s, s, (fl + 1) * s, hex('ffe14f'));
}
function chipW(B, at, T) {   // a glowing green chip held up
  const z = at[2] + 3 + Math.sin(T * 2.5) * 0.6; box(B, at[0] - 3, at[1] - 3, z, 6, 6, 1.2, hex('3fbf5a'), hex('2a8a3e'), hex('1f6a30'));
  box(B, at[0] - 1.6, at[1] - 1.6, z + 1.2, 3.2, 3.2, 0.8, hex('9be86a'), hex('3fbf5a'), hex('2a8a3e'));
  for (let q = -2; q <= 2; q++) { const a = P(at[0] + q * 1.2, at[1] + 3.2, z + 0.4), b = P(at[0] + 3.2, at[1] + q * 1.2, z + 0.4); B.put(a[0], a[1] + 1, hex('c8a040')); B.put(b[0], b[1] + 1, hex('c8a040')); }
}
function orbW(B, at, T) { const p = P(at[0] + 4, at[1], at[2] + 3 + Math.sin(T * 2.2) * 1.5), r = 2.6 * ISO.k * (1 + 0.08 * Math.sin(T * 6)); B.circle(p[0], p[1], r, hex('8fb4ff')); B.circle(p[0] - r * 0.3, p[1] - r * 0.3, r * 0.5, hex('dfe6ff')); }
function bookW(B, at, T) {   // an upright notebook held at the side (spine toward the viewer)
  const x = at[0] + 0.6, y = at[1] - 3, z = at[2] - 1;
  box(B, x, y, z, 1.6, 6, 7, hex('f5f0e6'), hex('5a3220'), hex('7a4a30'));
  for (let q = 0; q < 3; q++) { const a = P(x + 1.6, y + 1, z + 5.5 - q * 1.6), b = P(x + 1.6, y + 4.5, z + 5.5 - q * 1.6); B.line(a[0], a[1], b[0], b[1], hex('c8a040')); }
}

// ---------------- the lineup scene ----------------
const LINE = [['elon', -39, 2, 'x'], ['jensen', -13, 9, 'x'], ['sam', 13, 9, 'y'], ['dario', 39, 2, 'y']];
const lpos = (s, p) => [64 + (s + p) * Math.SQRT1_2, 64 + (p - s) * Math.SQRT1_2];
function simpleTop(T) {
  const line = hex('2c3a66'), lineB = hex('3a2a70'), mag = hex('ff3ab0'), vio = hex('b04fff');
  return (x, y) => { const n = fbm(x * 0.05, y * 0.05, 3, 3); let c = n > 0.56 ? ICOL.topL : n < 0.37 ? ICOL.topD : ICOL.top;
    const gx = ((x % 8) + 8) % 8, gy = ((y % 8) + 8) % 8, on = gx < 0.5 || gy < 0.5; if (on) c = (Math.floor(x / 8) + Math.floor(y / 8)) & 1 ? line : lineB;
    const sweep = ((x + y - T * 70) % 180 + 180) % 180; if (on && sweep < 8) c = sweep < 3 ? mag : vio; return [...c, 6]; };
}
function renderAvatars(F, low, T) {
  CAM.cx = 180 + Math.sin(T * 0.5) * 2; CAM.cy = 262 + Math.sin(T * 0.4) * 1; CAM.z = 1.72; REF.oy = 196 + Math.sin(T * 1.5) * 1.0; applyCam();
  const B = new PBuf(APAL, 16); rocksW(B, T, false); drawIslandW(B, { T: 16, N: NI, mask: MASK8, depth: DEPTH8, cols: ICOL, topFn: simpleTop(T) });
  const items = [], R = {};
  for (const [x, y, ci, h] of PYLONS) items.push({ d: x + y, f: () => pylonW(B, x, y, ci, h, T) });
  LINE.forEach(([id, s, p, face], i) => {
    const [x, y] = lpos(s, p), ph = T * 2.2 + i * 1.3, c = AV[id];
    const st = { T, squash: 0.03 + 0.03 * Math.sin(ph * 2), look: [face === 'x' ? 1 : -1, Math.sin(T * 0.7 + i) > 0.6 ? -1 : 0], blink: ((T + i * 0.83) % 3.1) < 0.12, arm: id === 'jensen' ? 0.15 : id === 'dario' ? 0.3 : id === 'sam' ? 0.1 : 0.2 };
    items.push({ d: x + y, f: () => { R[id] = avatar(B, c, x, y, st, face); const hd = R[id].hand;
      if (id === 'jensen') chipW(B, hd, T); if (id === 'sam') orbW(B, hd, T); if (id === 'dario') bookW(B, hd, T);
      if (id === 'elon') rocketW(B, [x + 3, y - 12, 26], T); } });
  });
  items.sort((a, b) => a.d - b.d).forEach(it => it.f());
  rocksW(B, T, true); low.getContext('2d').clearRect(0, 0, LW, LH); B.toCanvas(low);
  F.setTransform(1, 0, 0, 1, 0, 0); F.filter = 'none'; F.globalAlpha = 1; F.globalCompositeOperation = 'source-over';
  skyGrid(F, T, 0); pixelUp(F, low); neonEdges(F, T, 0); pylonGlow(F, T);
  const kz = CAM.z / 2;
  LINE.forEach(([id, s, p], i) => { const r = R[id]; if (!r) return; floorGlow(F, r.foot, 170 * kz, ['rgba(255,140,90,0.18)', 'rgba(200,200,220,0.14)', 'rgba(120,170,255,0.2)', 'rgba(150,120,255,0.2)'][i]);
    if (id === 'jensen') glowAt(F, P(r.hand[0], r.hand[1], r.hand[2] + 4), 80 * kz, 'rgba(90,255,120,0.4)');
    if (id === 'sam') glowAt(F, P(r.hand[0] + 4, r.hand[1], r.hand[2] + 3), 120 * kz, 'rgba(150,190,255,0.5)');
    if (id === 'elon') { const [x, y] = lpos(s, p); glowAt(F, P(x + 3, y - 12, 22), 70 * kz, 'rgba(255,170,80,0.45)'); } });
  bloom(F, 0.14); scanlines(F); vignette(F, 0.55, '6,2,16');
  LINE.forEach(([id], i) => { const r = R[id]; if (!r) return; const c = HX(r.foot), nm = AV[id].name, w = textW(nm, 4);
    F.fillStyle = 'rgba(6,3,16,0.75)'; F.fillRect(c[0] - w / 2 - 14, c[1] + 46, w + 28, 46); F.fillStyle = ['#ff8a5a', '#5aff7a', '#8fb4ff', '#b49bff'][i]; F.fillRect(c[0] - w / 2 - 14, c[1] + 88, w + 28, 4);
    hiText(F, nm, c[0], c[1] + 56, 4, '#fff6ea', { align: 'c' }); });
  F.save(); hiText(F, 'THE LINEUP', FW / 2, 70, 9, '#fff6ea', { align: 'c' }); hiText(F, 'FABLE 5.2 · FIGHT FILE', FW / 2, 160, 3, '#ff6ac8', { align: 'c' }); F.restore();
  grain(F, 6, Math.floor(T * 30) % 7 + 1);
}
