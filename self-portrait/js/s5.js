// s5.js — MANY WINDOWS (close). A slow track along one floor of the tower: five rooms,
// five small faceless people, the same lantern beside each. In the last room the
// conversation ends and the lantern goes dark.
(function (g) {
  'use strict';
  const P = g.PX, C = P.C, L = P.LUT, TL = g.TL, LAN = g.LAN, G = g.GLY;
  const W = 480, H = 270, RW = 204, RH = 150, PITCH = 244, WX0 = 138, WY0 = 52, NR = 6;
  const WW = WX0 + PITCH * 4 + 480 - WX0 + 4;
  let world, built = false;
  const NIGHT = [];                         // dimming LUT chain for the last room
  const rooms = [];                         // {ox, oy, lan:{x,y}}

  const SIDE = [  // seated figure, facing left
    '........hhhhh.......', '.......hhhhhhhpp....', '......hhhhhhhhhpp...', '......sshhhhhhh.pp..', '.....ssssshhhhh.pp..',
    '.....sssssshhhh..p..', '.....sssssshhh......', '......sssssh........', '.......ssss.........', '......cccccc........',
    '.....cccccccc.......', '....cccccccccc......', '...ccccccccccc......', '..sscccCccccccc.....', '.sssccCCcccccccc....',
    '....ccCcccccccc.....', '.....cccccccccc.....', '.....cccccccccc.....', '.....ddddddddddd....', '....dddddddddddd....',
    '....ddddddddddd.....', '....dddd............', '.....ddd............', '.....ddd............', '.....ddd............',
    '....dddd............', '...ffffff...........'];
  const CAT = ['.e..e.......', '.eeee.......', 'eeeeeeeeee..', 'eeeeeeeeeee.', '.eeeeeeeeeet', '..eeeeeeeett'];
  function fig(map, noTail) {
    const rows = noTail ? SIDE.map(r => r.replace(/p/g, '.')) : SIDE;
    return P.spr(rows, map);
  }
  // a seated, faceless figure built from parts (hip at HX,HY of the returned buffer; faces right)
  const HX = 16, HY = 36;
  function person(o) {
    const t = P.mk(44, 52), hx = HX, hy = HY, ln = o.lean || 0, dn = c => L.dn1[c];
    P.rect(t, hx + 11, hy, 4, 12, o.pants); P.vl(t, hx + 11, hy, 12, dn(o.pants)); P.rect(t, hx + 11, hy + 11, 7, 2, o.shoe); P.px(t, hx + 17, hy + 11, P.TR);
    P.rect(t, hx - 3, hy - 5, 18, 5, o.pants); P.hl(t, hx - 2, hy - 1, 17, dn(o.pants)); P.px(t, hx - 3, hy - 5, P.TR);
    for (let r = 0; r < 15; r++) { const y = hy - 5 - r, xo = Math.round(ln * r / 14), w = r > 12 ? 8 : r < 2 ? 10 : 9; P.hl(t, hx - 4 + xo, y, w, o.top); P.px(t, hx - 4 + xo, y, o.topSh); if (r % 5 === 2) P.px(t, hx + 1 + xo, y, o.topSh); }
    P.rect(t, hx - 1 + ln, hy - 21, 3, 2, o.skinSh);
    const cx = hx + 1 + ln, cy = hy - 26;
    for (let y = cy - 7; y <= cy + 7; y++) for (let x = cx - 7; x <= cx + 7; x++) {
      const dx = x - cx, dy = y - cy, e = dx * dx / 27 + dy * dy / 32;
      if (e > 1) continue;
      let c = o.skin;
      if (dx < -1 || dy < -2 || (dx < 2 && dy < -1)) c = o.hair;
      if (o.style === 'beanie') { if (dy < -1) c = o.hat; if (dy === -1 || dy === 0 && dx < 0) c = o.hat2; if (dy >= 0 && dx < -2) c = o.hair; }
      else if (c === o.hair && dx < -3 && dy > 0) c = o.hair2 || o.hair;
      if (c === o.skin && dy > 3) c = o.skinSh;
      P.px(t, x, y, c);
    }
    if (o.style === 'pony') { for (let j = 0; j < 9; j++) { const x = cx - 6 - (j < 3 ? j : j < 6 ? 2 : 1), y = cy - 2 + j; P.px(t, x, y, o.hair); P.px(t, x + 1, y, o.hair); } P.px(t, cx - 5, cy - 2, o.band || o.hair); }
    if (o.style === 'bun') { P.disc(t, cx - 5, cy - 5, 2.6, o.hair); P.px(t, cx - 5, cy - 6, o.hair2 || o.hair); }
    if (o.style === 'beanie') { P.rect(t, cx - 1, cy - 8, 3, 2, o.hat2); }
    if (o.phones) { P.rect(t, cx - 2, cy - 1, 3, 4, o.phones); for (let a = 0; a < 9; a++) { const th = Math.PI * (1.0 + a / 8 * 0.62); P.px(t, Math.round(cx - 0.5 + Math.cos(th) * 6), Math.round(cy + Math.sin(th) * 6.6), o.phones); } }
    const sx = hx + 1 + ln, sy = hy - 16, thick = (x0, y0, x1, y1, c) => { P.line(t, x0, y0, x1, y1, c); P.line(t, x0, y0 + 1, x1, y1 + 1, c); P.line(t, x0 + 1, y0, x1 + 1, y1, c); };
    if (o.arm === 'head') { thick(sx, sy, hx + 8, hy - 11, o.topSh); thick(hx + 8, hy - 11, cx + 5, cy + 1, o.top); P.rect(t, cx + 4, cy - 2, 2, 3, o.skin); }
    else if (o.arm === 'lap') { thick(sx - 1, sy, hx + 1, hy - 9, o.topSh); thick(hx + 1, hy - 9, hx + 8, hy - 7, o.top); P.rect(t, hx + 9, hy - 7, 2, 2, o.skin); }
    else { thick(sx, sy, hx + 5 + (ln >> 1), hy - 9, o.topSh); thick(hx + 5 + (ln >> 1), hy - 9, hx + 12, hy - 10 + (o.hand || 0), o.top); P.rect(t, hx + 13, hy - 10 + (o.hand || 0), 2, 2, o.skin); }
    return t;
  }
  function place(b, t, x, y, left) { if (left) P.blit(b, t, x - (43 - HX), y - HY, { fx: true }); else P.blit(b, t, x - HX, y - HY); }

  // ---------- façade ----------------------------------------------------------------------
  function facade() {
    world = P.mk(WW, H, C.N4);
    // brickwork: quiet courses, a few lighter and darker bricks
    P.shade(world, 0, 0, WW, H, (x, y) => {
      const row = Math.floor(y / 5), off = (row & 1) * 6, col = Math.floor((x + off) / 12);
      if (y % 5 === 4) return C.N3;
      if ((x + off) % 12 === 11) return C.N3;
      const h = P.hash(col, row, 31);
      return h < 0.07 ? C.N5 : h > 0.95 ? C.N3 : C.N4;
    });
    for (let i = -1; i < NR; i++) {
      const ox = WX0 + PITCH * i;
      // string course between floors
      P.rect(world, ox - 20, 22, PITCH, 5, C.N5); P.hl(world, ox - 20, 22, PITCH, C.N7); P.hl(world, ox - 20, 26, PITCH, C.N2);
      for (let x = ox - 20; x < ox - 20 + PITCH; x += 6) P.rect(world, x + 1, 27, 3, 2, C.N3);
      P.rect(world, ox - 20, 226, PITCH, 4, C.N5); P.hl(world, ox - 20, 226, PITCH, C.N7); P.hl(world, ox - 20, 229, PITCH, C.N2);
      winFrame(ox, WY0, RW, RH, true);
      // upstairs window bottoms and downstairs window tops: lit, each with its lantern
      winFrame(ox + 10, -60, RW - 20, 72, false);
      upstairs(ox + 10, 0, RW - 20, 12, i);
      winFrame(ox + 10, 244, RW - 20, 80, false);
      downstairs(ox + 10, 244, RW - 20, 26, i);
      // pier furniture
      const px_ = ox + RW + 8;
      if ((i + 4) % 3 === 0) { // drainpipe
        P.rect(world, px_ + 9, 0, 4, H, C.N5); P.vl(world, px_ + 9, 0, H, C.N3); P.vl(world, px_ + 12, 0, H, C.N6);
        for (let y = 14; y < H; y += 62) { P.rect(world, px_ + 7, y, 8, 3, C.N6); P.hl(world, px_ + 7, y + 2, 8, C.N3); }
      } else if ((i + 4) % 3 === 1) { // ivy
        const r = P.rng(700 + i);
        for (let k = 0; k < 150; k++) {
          const y = r.i(40, 268), x = px_ + 4 + Math.round(Math.sin(y * 0.07 + i) * 7) + r.i(-5, 5);
          const c = r.chance(0.5) ? C.T1 : r.chance(0.7) ? C.T2 : C.T3;
          P.px(world, x, y, c); P.px(world, x + 1, y, c); if (r.chance(0.5)) P.px(world, x, y + 1, C.T0);
          if (r.chance(0.04)) P.px(world, x, y - 1, C.R3);
        }
      } else { // an old lamp bracket, unlit, and cables
        P.rect(world, px_ + 8, 96, 3, 14, C.N6); P.hl(world, px_ + 6, 96, 7, C.N7); P.rect(world, px_ + 6, 110, 7, 8, C.N3); P.box(world, px_ + 6, 110, 7, 8, C.N6); P.hl(world, px_ + 5, 118, 9, C.N6);
        for (let x = 0; x < 24; x++) { P.px(world, px_ - 4 + x, 60 + Math.round(Math.sin(x / 23 * Math.PI) * 4), C.N2); }
      }
    }
    // pennants strung along the upper course
    for (let x = 30; x < WW - 20; x += 9) {
      const y = 32 + Math.round(Math.sin(x * 0.026) * 3 + Math.sin(x * 0.011) * 2);
      P.px(world, x, y, C.N2); P.px(world, x + 3, y, C.N2); P.px(world, x + 6, y, C.N2);
      const k = Math.floor(x / 9) % 5;
      if (k !== 4) { const c = [C.R2, C.T2, C.V2, C.A3][k]; P.hl(world, x + 1, y + 1, 5, c); P.hl(world, x + 2, y + 2, 3, c); P.px(world, x + 3, y + 3, c); }
    }
  }
  function winFrame(x, y, w, h, main) {
    // stone surround
    P.rect(world, x - 6, y - 6, w + 12, h + 12, C.N6);
    P.hl(world, x - 6, y - 6, w + 12, C.N8); P.vl(world, x - 6, y - 6, h + 12, C.N7);
    P.hl(world, x - 6, y + h + 5, w + 12, C.N3); P.vl(world, x + w + 5, y - 6, h + 12, C.N4);
    P.box(world, x - 2, y - 2, w + 4, h + 4, C.N3); P.box(world, x - 1, y - 1, w + 2, h + 2, C.N2);
    for (let xx = x - 4; xx < x + w + 4; xx += 10) P.vl(world, xx, y - 5, 3, C.N5);
    // keystone + sill
    P.poly(world, [[x + w / 2 - 6, y - 10], [x + w / 2 + 6, y - 10], [x + w / 2 + 4, y - 2], [x + w / 2 - 4, y - 2]], C.N7);
    P.hl(world, x + w / 2 - 6, y - 10, 12, C.N9); P.vl(world, Math.round(x + w / 2), y - 8, 5, C.N5);
    P.rect(world, x - 10, y + h + 6, w + 20, 5, C.N6); P.hl(world, x - 10, y + h + 6, w + 20, C.N8); P.hl(world, x - 10, y + h + 10, w + 20, C.N3);
    P.hl(world, x - 8, y + h + 11, w + 16, C.N2); P.dith(world, x - 6, y + h + 12, w + 12, 2, C.N3, 8);
  }
  function upstairs(x, y, w, h, i) {
    const pal = [[C.A2, C.A3], [C.R1, C.R2], [C.A2, C.A3], [C.M1, C.A2], [C.A1, C.A2], [C.A2, C.A3], [C.A2, C.A3]][(i + 7) % 7];
    P.rect(world, x, y, w, h, pal[0]);
    const lx = x + 30 + ((i * 53 + 80) % (w - 70));
    P.ell(world, lx, y + 7, 30, 10, pal[1]); P.ell(world, lx, y + 7, 13, 6, L.up1[pal[1]]);
    LAN.draw(world, lx, y + 5, 3, { noGlow: true });
    P.hl(world, x, y + h - 1, w, C.A1);
    // legs of furniture / a pot on the inner sill
    const fx = x + ((i * 97 + 20) % (w - 60)) + 10;
    P.rect(world, fx, y, 3, h - 1, C.A0); P.rect(world, fx + 30, y, 3, h - 1, C.A0); P.hl(world, fx - 2, y, 38, C.A0);
    P.rect(world, x + w - 30, y + 5, 9, 6, C.A1); P.rect(world, x + w - 28, y + 1, 2, 4, C.T2); P.rect(world, x + w - 25, y, 2, 5, C.T3); P.px(world, x + w - 23, y + 2, C.T2);
    // flower box on the outer sill
    for (let k = 0; k < w - 30; k += 3) { const xx = x + 15 + k, hh = P.hash(k, i, 12); P.px(world, xx, y + h + 4 - (hh > 0.5 ? 1 : 0), hh < 0.3 ? C.R3 : hh < 0.5 ? C.A5 : C.T2); P.px(world, xx + 1, y + h + 5, C.T1); }
  }
  function downstairs(x, y, w, h, i) {
    const pal = [[C.A2, C.A3], [C.A1, C.A2], [C.R1, C.R2], [C.A2, C.A3], [C.M1, C.A2], [C.A2, C.A3], [C.A1, C.A2]][(i + 7) % 7];
    P.rect(world, x, y, w, h, pal[0]);
    P.hl(world, x, y, w, L.dn1[pal[0]]); P.hl(world, x, y + 1, w, L.dn1[pal[0]]);
    // a high shelf with the lantern on it
    const sx = x + 16 + ((i * 71 + 40) % (w - 110));
    P.ell(world, sx + 30, y + 14, 44, 13, pal[1]); P.ell(world, sx + 30, y + 13, 20, 8, L.up1[pal[1]]);
    P.rect(world, sx, y + 19, 70, 2, C.A1); P.hl(world, sx, y + 19, 70, C.A3);
    LAN.draw(world, sx + 30, y + 15, 3, { noGlow: true });
    const cols = [C.R2, C.T2, C.V2, C.A4, C.N7, C.R3, C.T3];
    for (let k = 0; k < 8; k++) { const hh = 5 + (k * 5 + i) % 4; if (k === 3 || k === 4) continue; P.rect(world, sx + 3 + k * 4 + (k > 4 ? 26 : 0), y + 19 - hh, 3, hh, cols[(k + i + 7) % 7]); }
    // curtain tops
    P.rect(world, x, y, 12, h, C.R1); for (let k = 0; k < 12; k += 3) P.vl(world, x + k, y, h, C.R0);
    P.rect(world, x + w - 12, y, 12, h, C.R1); for (let k = 0; k < 12; k += 3) P.vl(world, x + w - 12 + k, y, h, C.R0);
    P.hl(world, x, y + 3, w, C.A0);
  }

  // ---------- room helpers ------------------------------------------------------------------
  function roomBase(wall, wall2, floor, floor2, skirt) {
    const b = P.mk(RW, RH, wall);
    P.rect(b, 0, 118, RW, 32, floor);
    for (let y = 122; y < RH; y += 6) P.hl(b, 0, y, RW, floor2);
    for (let y = 118; y < RH; y += 6) for (let x = ((y / 6) & 1) * 17 + 5; x < RW; x += 34) P.vl(b, x, y, 5, floor2);
    P.rect(b, 0, 114, RW, 4, skirt); P.hl(b, 0, 114, RW, wall2);
    P.hl(b, 0, 0, RW, L.dn1[wall]); P.hl(b, 0, 1, RW, L.dn1[wall]);
    return b;
  }
  function books(b, x, yBase, n, seed, maxH) {
    const cols = [C.R2, C.T2, C.V2, C.A3, C.N7, C.R3, C.T3, C.M2, C.V3, C.A4, C.O0];
    let xx = x;
    for (let k = 0; k < n; k++) {
      const h = P.hash(k, seed, 1), w = h < 0.3 ? 2 : h < 0.8 ? 3 : 4, hh = Math.round((maxH || 12) * (0.6 + P.hash(k, seed, 2) * 0.4));
      const c = cols[Math.floor(P.hash(k, seed, 3) * cols.length)];
      if (P.hash(k, seed, 4) < 0.08) { xx += 3; continue; }
      P.rect(b, xx, yBase - hh, w, hh, c); P.vl(b, xx, yBase - hh, hh, L.dn1[c]);
      if (w > 2) P.px(b, xx + 1, yBase - hh + 2, L.up1[c]);
      xx += w;
    }
    return xx;
  }
  function frame(b, x, y, w, h, c) { P.rect(b, x, y, w, h, C.N2); P.box(b, x, y, w, h, c); P.hl(b, x, y, w, L.up1[c]); }
  function chairLegs(b, x, y, c) { P.vl(b, x, y, 14, c); P.vl(b, x + 12, y, 14, c); P.hl(b, x, y + 6, 13, c); }
  // lantern light as bands along each colour's own ramp (no hue drift): +2, +1, local, -1
  function light(b, lx, ly, big) {
    const R = big ? [17, 38, 84, 92] : [15, 32, 70, 78];
    P.shade(b, 0, 0, RW, RH, (x, y, c) => {
      const d = Math.hypot(x - lx, (y - ly) * 1.15) + ((P.bay(x, y) + 0.5) / 16 - 0.5) * 3;
      if (d < R[0]) return L.up2[c]; if (d < R[1]) return L.up1[c];
      if (d < R[2]) return c; if (d < R[3]) return P.bay(x + 1, y) < 8 ? L.dn1[c] : c;
      return L.dn1[c];
    });
  }

  // 1 — debugging at 3 a.m.
  function room1() {
    const b = roomBase(C.N3, C.N5, C.M0, C.N2, C.N4);
    // poster: abstract orbit diagram
    frame(b, 10, 34, 30, 40, C.N6); P.ring(b, 25, 52, 9, C.T2); P.ring(b, 25, 52, 5, C.V2); P.px(b, 25, 52, C.A5); P.px(b, 34, 52, C.T4); P.px(b, 22, 48, C.R3);
    P.hl(b, 14, 68, 12, C.N5); P.hl(b, 14, 70, 18, C.N5);
    // clock at three
    P.disc(b, 56, 22, 8, C.N6); P.disc(b, 56, 22, 6.6, C.N10); P.vl(b, 56, 17, 5, C.N2); P.hl(b, 56, 22, 4, C.N2); P.px(b, 56, 22, C.R3);
    for (let a = 0; a < 12; a++) P.px(b, Math.round(56 + Math.cos(a * Math.PI / 6) * 6), Math.round(22 + Math.sin(a * Math.PI / 6) * 6), C.N7);
    // desk
    P.rect(b, 46, 96, 158, 4, C.M2); P.hl(b, 46, 96, 158, C.M3); P.hl(b, 46, 99, 158, C.M0);
    P.rect(b, 50, 100, 4, 18, C.M1); P.rect(b, 196, 100, 4, 18, C.M1); P.rect(b, 150, 100, 46, 18, C.M1); P.box(b, 150, 100, 46, 18, C.M0); P.hl(b, 168, 105, 10, C.M3); P.hl(b, 168, 112, 10, C.M3); P.hl(b, 150, 109, 46, C.M0);
    // wall of monitors
    const mon = (x, y, w, h) => { P.rect(b, x - 2, y - 2, w + 4, h + 4, C.N1); P.box(b, x - 2, y - 2, w + 4, h + 4, C.N5); P.hl(b, x - 2, y - 2, w + 4, C.N6); P.rect(b, x, y, w, h, C.T0); };
    mon(72, 40, 24, 46); mon(104, 34, 50, 40); mon(162, 30, 38, 24); mon(162, 62, 38, 26);
    P.rect(b, 126, 78, 6, 16, C.N1); P.rect(b, 118, 93, 22, 3, C.N1); P.rect(b, 82, 90, 4, 6, C.N1); P.rect(b, 178, 92, 6, 4, C.N1);
    code(b, 104, 34, 50, 40, 11, 0); code(b, 72, 40, 24, 46, 12, 1);
    // plot + error wall
    for (let x = 0; x < 34; x++) { const y = 46 - Math.round(Math.abs(Math.sin(x * 0.4)) * 9 + (x > 22 ? (x - 22) * 0.8 : 0)); P.px(b, 164 + x, y, x > 22 ? C.R3 : C.T3); if (x % 6 === 0) P.vl(b, 164 + x, y, 51 - y, C.T1); }
    P.hl(b, 164, 51, 34, C.T2);
    P.rect(b, 162, 62, 38, 26, C.R0); for (let k = 0; k < 7; k++) { P.hl(b, 165, 65 + k * 3, 8 + (k * 13) % 22, k === 2 || k === 3 ? C.R4 : C.R2); } P.rect(b, 164, 70, 2, 5, C.R4);
    // sticky notes, cans, mug, keyboard
    P.rect(b, 100, 76, 4, 4, C.A5); P.rect(b, 156, 46, 4, 4, C.R4); P.rect(b, 157, 54, 4, 4, C.T4); P.px(b, 101, 77, C.A3);
    P.rect(b, 142, 90, 12, 3, C.N5); P.hl(b, 142, 90, 12, C.N7); for (let x = 143; x < 153; x += 2) P.px(b, x, 91, C.N2);
    P.rect(b, 186, 88, 4, 8, C.T2); P.hl(b, 186, 88, 4, C.T4); P.rect(b, 191, 89, 4, 7, C.T1); P.hl(b, 191, 89, 4, C.T3); P.rect(b, 181, 93, 7, 3, C.T2); P.px(b, 181, 93, C.T4);
    P.rect(b, 160, 90, 5, 6, C.N9); P.px(b, 165, 92, C.N9); P.px(b, 165, 93, C.N9); P.hl(b, 160, 90, 5, C.A1);
    // tower PC + cables
    P.rect(b, 12, 86, 18, 32, C.N1); P.box(b, 12, 86, 18, 32, C.N4); P.hl(b, 15, 92, 12, C.N3); P.hl(b, 15, 95, 12, C.N3); P.rect(b, 16, 104, 10, 10, C.N2); P.ring(b, 21, 109, 3, C.N4);
    for (let x = 30; x < 50; x++) P.px(b, x, 112 - Math.round(Math.sin((x - 30) / 20 * Math.PI) * 5), C.N1);
    // pizza box, rug
    P.rect(b, 22, 136, 150, 10, C.V0); P.hl(b, 22, 136, 150, C.V1); P.hl(b, 22, 145, 150, C.V1); for (let x = 26; x < 170; x += 8) P.px(b, x, 140, C.V1);
    P.rect(b, 176, 126, 22, 4, C.O0); P.hl(b, 176, 126, 22, C.O1); P.rect(b, 178, 122, 18, 4, C.M2); P.hl(b, 178, 122, 18, C.O1);
    // light: monitors (cool) + lantern (warm)
    light(b, 64, 86, false);
    P.glow(b, 150, 60, [44, 66], [L.up2, L.up1], { dw: 6, sq: 0.85 });
    // screens stay emissive
    code(b, 104, 34, 50, 40, 11, 0); code(b, 72, 40, 24, 46, 12, 1);
    P.px(b, 16, 90, C.T4); P.px(b, 19, 90, C.A5);
    P.hl(b, 100, 96, 100, C.T2); P.hl(b, 150, 97, 50, C.T1);       // screen light along the desk edge
    // chair + person from behind (drawn after the light so the silhouette stays crisp against the screens)
    P.rect(b, 127, 120, 3, 12, C.N1); P.hl(b, 116, 132, 26, C.N1); P.px(b, 116, 133, C.N4); P.px(b, 128, 133, C.N4); P.px(b, 141, 133, C.N4);
    P.rect(b, 105, 82, 7, 18, C.T1); P.vl(b, 105, 82, 18, C.T2); P.rect(b, 146, 82, 7, 18, C.T1); P.vl(b, 152, 82, 18, C.T0);
    P.rect(b, 108, 75, 42, 14, C.T1); P.rect(b, 111, 72, 36, 4, C.T1); P.hl(b, 112, 72, 34, C.T3); P.vl(b, 108, 76, 12, C.T2); P.px(b, 110, 73, C.T2);
    P.rect(b, 112, 82, 34, 40, C.M1); P.box(b, 112, 82, 34, 40, C.M0); P.vl(b, 113, 83, 38, C.M3); P.vl(b, 114, 83, 38, C.M2); P.hl(b, 113, 82, 32, C.M2); for (let y = 89; y < 118; y += 6) P.hl(b, 117, y, 25, C.M0);
    P.rect(b, 124, 68, 11, 5, C.O0); P.hl(b, 124, 72, 11, C.T2);                                         // neck
    P.ell(b, 129, 61, 7, 7.5, C.V1); P.ell(b, 127, 60, 4.6, 5.2, C.V2); P.px(b, 124, 57, C.V3); P.px(b, 125, 56, C.V3); P.px(b, 124, 59, C.V3);
    for (let a2 = 0; a2 < 7; a2++) { const th = -0.2 - a2 * 0.16; P.px(b, Math.round(129 + Math.cos(th) * 7), Math.round(61 + Math.sin(th) * 7.5), C.T3); }   // screen light on the hair
    for (let a2 = 0; a2 <= 22; a2++) { const th = Math.PI + a2 / 22 * Math.PI; P.px(b, Math.round(129 + Math.cos(th) * 8.4), Math.round(60 + Math.sin(th) * 8.6), C.N8); }
    P.rect(b, 119, 58, 4, 8, C.R3); P.vl(b, 119, 58, 8, C.R4); P.rect(b, 136, 58, 4, 8, C.R2); P.vl(b, 139, 58, 8, C.R1);
    // a cat asleep by the tower
    const cat = P.spr(CAT, { e: C.O1, t: C.O0 }); P.blit(b, cat, 34, 112); P.px(b, 36, 114, C.A1); P.px(b, 39, 115, C.O2); P.px(b, 42, 115, C.O2);
    return { b, lan: { x: 64, y: 87 } };
  }
  function code(b, x, y, w, h, seed, scroll) {
    P.rect(b, x, y, w, h, C.T0);
    P.rect(b, x, y, 3, h, C.N2);
    for (let ln = 0; ln * 3 + 2 < h; ln++) {
      const id = ln + scroll * 0, yy = y + 2 + ln * 3;
      const ind = Math.floor(P.hash(id, seed, 1) * 4) * 3, n = 1 + Math.floor(P.hash(id, seed, 2) * 4);
      if (P.hash(id, seed, 3) < 0.14) continue;
      let xx = x + 5 + ind;
      P.px(b, x + 1, yy, C.N5);
      for (let k = 0; k < n && xx < x + w - 3; k++) {
        const len = 2 + Math.floor(P.hash(id * 7 + k, seed, 4) * 7), c = [C.T3, C.T4, C.A5, C.R3, C.V3, C.N9, C.T3][Math.floor(P.hash(id * 7 + k, seed, 5) * 7)];
        P.hl(b, xx, yy, Math.min(len, x + w - 2 - xx), c); xx += len + 2;
      }
    }
  }
  // 2 — a student, books, a long night
  function room2() {
    const b = roomBase(C.A1, C.A3, C.R0, C.N1, C.A2);
    for (let y = 8; y < 112; y += 10) for (let x = (y / 10 & 1) * 6 + 4; x < RW; x += 12) P.px(b, x, y, C.A2);   // wallpaper dots
    // wall shelves with books
    P.rect(b, 14, 46, 96, 3, C.A2); P.hl(b, 14, 46, 96, C.A4); P.rect(b, 14, 22, 96, 3, C.A2); P.hl(b, 14, 22, 96, C.A4);
    books(b, 17, 46, 14, 21, 15); books(b, 70, 46, 9, 22, 13); books(b, 17, 22, 9, 23, 13); books(b, 60, 22, 6, 24, 12);
    P.disc(b, 97, 16, 5, C.T2); P.ell(b, 96, 15, 2, 2.5, C.T4); P.px(b, 99, 18, C.A4); P.rect(b, 96, 21, 3, 1, C.A1);          // globe
    P.rect(b, 48, 16, 6, 6, C.O0); P.px(b, 50, 13, C.T3); P.px(b, 51, 12, C.T2); P.px(b, 49, 14, C.T2); P.px(b, 52, 14, C.T3); P.vl(b, 51, 13, 3, C.T1); // plant
    // study notes pinned in a grid
    for (let k = 0; k < 10; k++) { const x = 20 + (k % 5) * 9, y = 58 + Math.floor(k / 5) * 9; P.rect(b, x, y, 6, 6, [C.A6, C.T4, C.R4, C.N10, C.A5][(k * 3) % 5]); P.hl(b, x + 1, y + 2, 3, C.A2); P.hl(b, x + 1, y + 4, 4, C.A2); P.px(b, x + 3, y, C.R3); }
    // posters above the bed
    frame(b, 136, 22, 28, 34, C.N7); P.rect(b, 137, 23, 26, 32, C.N2); P.disc(b, 150, 36, 7, C.R2); P.ell(b, 148, 34, 3, 3, C.R3); P.hl(b, 139, 37, 22, C.R4); P.px(b, 157, 27, C.N10); P.px(b, 141, 30, C.N9); P.hl(b, 141, 49, 14, C.N6);
    frame(b, 170, 28, 26, 22, C.A3); P.rect(b, 171, 29, 24, 20, C.T1); P.poly(b, [[171, 49], [180, 36], [187, 44], [191, 39], [195, 49]], C.T2); P.poly(b, [[178, 39], [180, 36], [182, 39]], C.N10); P.disc(b, 189, 33, 2, C.A6);
    for (let k = 0; k < 9; k++) { const x = 128 + k * 9, y = 10 + Math.round(Math.sin(k / 8 * Math.PI) * 5); P.px(b, x, y, C.A6); P.px(b, x - 1, y, C.A4); P.px(b, x + 1, y, C.A4); P.px(b, x, y - 1, C.A4); P.px(b, x, y + 1, C.A4); P.px(b, x + 4, y + 1, C.A0); }
    // bed
    P.rect(b, 128, 100, 76, 14, C.M1); P.hl(b, 128, 100, 76, C.M2); P.rect(b, 128, 114, 4, 8, C.M0); P.rect(b, 196, 80, 8, 38, C.M1); P.vl(b, 196, 80, 38, C.M2);
    P.rect(b, 128, 90, 68, 10, C.N10); P.hl(b, 128, 90, 68, C.N11); P.rect(b, 128, 92, 50, 12, C.R2); P.hl(b, 128, 92, 50, C.R3);
    for (let x = 130; x < 176; x += 6) { P.px(b, x, 96, C.R4); P.px(b, x + 3, 100, C.R1); }
    P.rect(b, 180, 84, 15, 7, C.N11); P.hl(b, 180, 90, 15, C.N9); P.px(b, 180, 84, C.N10);
    // desk, stacks of books, open book, cup of pencils
    P.rect(b, 22, 94, 92, 4, C.A3); P.hl(b, 22, 94, 92, C.A5); P.hl(b, 22, 97, 92, C.A1); P.rect(b, 24, 98, 4, 20, C.A2); P.rect(b, 108, 98, 4, 20, C.A2); P.rect(b, 28, 98, 22, 16, C.A2); P.box(b, 28, 98, 22, 16, C.A1); P.px(b, 39, 106, C.A5);
    const stack = (x, n, seed) => { for (let k = 0; k < n; k++) { const c = [C.R2, C.T2, C.V2, C.N7, C.A4, C.R3, C.T3][(k * 3 + seed) % 7], w = 16 + ((k * 5 + seed) % 5), o = (k * 3 + seed) % 4; P.rect(b, x + o, 91 - k * 3, w, 3, c); P.hl(b, x + o, 93 - k * 3, w, L.dn1[c]); P.px(b, x + o + 2, 92 - k * 3, C.N10); } };
    stack(26, 7, 1); stack(50, 3, 4);
    P.rect(b, 70, 91, 9, 3, C.N10); P.rect(b, 80, 91, 9, 3, C.N11); P.px(b, 79, 92, C.N7); P.hl(b, 71, 92, 6, C.N8); P.hl(b, 81, 92, 6, C.N8); P.px(b, 70, 93, C.N8);
    P.rect(b, 100, 87, 5, 7, C.T2); P.vl(b, 101, 82, 5, C.A5); P.vl(b, 103, 83, 4, C.R3); P.px(b, 102, 84, C.N10);
    // backpack, rug, socks
    P.rect(b, 114, 122, 14, 16, C.T2); P.rect(b, 115, 121, 12, 3, C.T3); P.rect(b, 117, 128, 8, 6, C.T1); P.vl(b, 113, 124, 10, C.T1);
    P.ell(b, 60, 138, 44, 7, C.V1); P.ell(b, 60, 138, 38, 5, C.V2); P.ell(b, 60, 138, 28, 3, C.V1);
    // chair + student
    P.rect(b, 101, 84, 3, 34, C.A2); P.vl(b, 103, 84, 34, C.A3); P.rect(b, 86, 106, 18, 3, C.A2); P.hl(b, 86, 106, 18, C.A3); P.vl(b, 87, 109, 9, C.A1); P.hl(b, 87, 113, 15, C.A1);
    place(b, person({ skin: C.O2, skinSh: C.O1, hair: C.V0, hair2: C.V1, band: C.R3, style: 'pony', top: C.T2, topSh: C.T1, pants: C.N4, shoe: C.N10, lean: 2 }), 96, 105, true);
    light(b, 60, 78, true);
    return { b, lan: { x: 60, y: 76 } };
  }
  // 3 — a hard letter
  function room3() {
    const b = roomBase(C.V0, C.V1, C.A0, C.N1, C.A1);
    for (let x = 3; x < RW; x += 8) for (let y = 2; y < 84; y++) if (y % 8 < 5) P.px(b, x, y, C.V1);  // wallpaper stripes of dashes
    P.rect(b, 0, 84, RW, 3, C.A1); P.hl(b, 0, 84, RW, C.A2); P.rect(b, 0, 87, RW, 27, C.M0); for (let x = 6; x < RW; x += 22) P.box(b, x, 91, 18, 19, C.M1);
    // pictures: a landscape with a book-moon, and an empty oval
    frame(b, 126, 24, 44, 30, C.A4); P.rect(b, 128, 26, 40, 26, C.N3); P.poly(b, [[128, 52], [140, 40], [150, 46], [160, 38], [168, 52]], C.N5); P.hl(b, 144, 31, 5, C.N11); P.hl(b, 150, 31, 5, C.N11); P.hl(b, 145, 32, 4, C.N10); P.hl(b, 150, 32, 4, C.N10); P.px(b, 149, 33, C.N9);
    P.ell(b, 186, 38, 9, 12, C.A4); P.ell(b, 186, 38, 7, 10, C.N2); P.px(b, 183, 33, C.N4);
    P.ell(b, 100, 36, 7, 9, C.A3); P.ell(b, 100, 36, 5.4, 7.4, C.N2); P.px(b, 100, 26, C.A5);
    // window with a drawn curtain, on the far left
    P.rect(b, 6, 18, 30, 52, C.N2); P.box(b, 6, 18, 30, 52, C.A2); P.vl(b, 21, 18, 52, C.A2); P.hl(b, 6, 44, 30, C.A2); P.px(b, 12, 26, C.N8); P.px(b, 28, 36, C.N6); P.px(b, 16, 54, C.N7);
    P.rect(b, 2, 14, 12, 62, C.R1); for (let x = 2; x < 14; x += 3) P.vl(b, x, 14, 62, C.R0); P.hl(b, 2, 14, 38, C.A3); P.rect(b, 30, 14, 8, 62, C.R1); P.vl(b, 33, 14, 62, C.R0); P.vl(b, 36, 14, 62, C.R0);
    // bureau with pigeonholes
    P.rect(b, 52, 92, 78, 4, C.A2); P.hl(b, 52, 92, 78, C.A4); P.rect(b, 54, 96, 74, 22, C.A1); P.box(b, 54, 96, 74, 22, C.A0); P.hl(b, 54, 106, 74, C.A0); P.px(b, 72, 101, C.A5); P.px(b, 110, 101, C.A5); P.px(b, 72, 112, C.A5); P.px(b, 110, 112, C.A5);
    P.rect(b, 84, 70, 46, 22, C.A1); P.box(b, 84, 70, 46, 22, C.A2); P.hl(b, 84, 70, 46, C.A4);
    for (let k = 0; k < 4; k++) { P.vl(b, 95 + k * 9, 71, 20, C.A2); P.rect(b, 87 + k * 11, 78 + (k % 2) * 2, 5, 9, k % 2 ? C.N10 : C.O3); P.px(b, 88 + k * 11, 80 + (k % 2) * 2, C.R3); }
    P.hl(b, 85, 81, 44, C.A2);
    // the letter, a pen, an inkwell, tea, a photo turned face-down
    P.rect(b, 66, 89, 14, 3, C.N11); P.hl(b, 68, 90, 8, C.N8); P.px(b, 66, 91, C.N9); P.line(b, 78, 88, 82, 84, C.N10); P.px(b, 83, 83, C.T4);
    P.rect(b, 58, 88, 4, 4, C.N2); P.hl(b, 58, 88, 4, C.N6);
    P.rect(b, 120, 87, 6, 5, C.N10); P.px(b, 126, 89, C.N10); P.hl(b, 120, 87, 6, C.O0);
    // lamp with a shade
    P.vl(b, 136, 74, 18, C.A3); P.rect(b, 132, 91, 9, 2, C.A3); P.poly(b, [[130, 74], [143, 74], [140, 64], [133, 64]], C.O1); P.hl(b, 133, 64, 8, C.O2); P.hl(b, 130, 73, 13, C.O0);
    // waste basket, and the drafts that did not make it
    P.rect(b, 142, 124, 14, 16, C.M1); for (let x = 143; x < 156; x += 3) P.vl(b, x, 124, 16, C.M2); P.hl(b, 141, 124, 16, C.M3);
    const ball = (x, y, k) => { P.rect(b, x, y, 4, 3, C.N10); P.px(b, x + 1, y - 1, C.N10); P.px(b, x + 2, y - 1, C.N11); P.px(b, x + (k % 3), y + 1, C.N8); P.px(b, x + 3, y + 2, C.N8); P.px(b, x, y, C.N9); };
    [[144, 120], [149, 121], [146, 117], [160, 138], [134, 141], [170, 133], [126, 134], [112, 143], [158, 144], [96, 139]].forEach((q, k) => ball(q[0], q[1], k));
    // armchair with a shawl
    P.rect(b, 162, 76, 36, 40, C.T1); P.rect(b, 160, 72, 40, 8, C.T1); P.hl(b, 160, 72, 40, C.T2); P.rect(b, 158, 94, 8, 24, C.T1); P.rect(b, 194, 94, 8, 24, C.T1); P.hl(b, 158, 94, 8, C.T2); P.hl(b, 194, 94, 8, C.T2);
    P.rect(b, 166, 100, 28, 6, C.T2); P.hl(b, 166, 100, 28, C.T3); for (let y = 80; y < 98; y += 6) for (let x = 168 + (y % 12 ? 3 : 0); x < 194; x += 8) P.px(b, x, y, C.T0);
    P.poly(b, [[182, 72], [198, 72], [198, 92], [190, 96]], C.R2); P.line(b, 182, 72, 190, 96, C.R3); for (let k = 0; k < 5; k++) P.px(b, 190 + k * 2, 97 + (k & 1), C.R3);
    P.rect(b, 160, 116, 4, 4, C.A1); P.rect(b, 196, 116, 4, 4, C.A1);
    P.ell(b, 86, 138, 40, 7, C.R1); P.ell(b, 86, 138, 33, 5, C.R2); P.ell(b, 86, 138, 20, 2.5, C.R1);
    // chair + writer (facing right), one hand to the forehead
    P.rect(b, 34, 80, 3, 38, C.A2); P.vl(b, 34, 80, 38, C.A3); P.rect(b, 34, 103, 18, 3, C.A2); P.hl(b, 34, 103, 18, C.A3); P.vl(b, 50, 106, 12, C.A1); P.hl(b, 36, 112, 15, C.A1);
    place(b, person({ skin: C.O1, skinSh: C.O0, hair: C.N9, hair2: C.N8, style: 'bun', top: C.M2, topSh: C.M1, pants: C.N3, shoe: C.N2, lean: 3, arm: 'head' }), 43, 102, false);
    P.rect(b, 39, 86, 4, 12, C.R2); P.vl(b, 39, 86, 12, C.R1); P.px(b, 43, 88, C.R2);
    light(b, 104, 80, false);
    P.glow(b, 136, 70, [9], [L.up1], { dw: 2 });
    return { b, lan: { x: 106, y: 83 } };
  }
  // 4 — an artist drawing pixel art (a pixel painting inside the pixel painting)
  function room4() {
    const b = roomBase(C.T0, C.T1, C.M0, C.N2, C.N3);
    // prints
    const print = (x, y, w, h, fn) => { frame(b, x, y, w, h, C.N8); fn(x + 2, y + 2); };
    print(10, 20, 22, 22, (x, y) => { P.rect(b, x, y, 18, 18, C.V0); P.disc(b, x + 9, y + 9, 5, C.A5); P.disc(b, x + 9, y + 9, 3, C.A7); for (let a = 0; a < 8; a++) P.px(b, Math.round(x + 9 + Math.cos(a * 0.785) * 7), Math.round(y + 9 + Math.sin(a * 0.785) * 7), C.A4); });
    print(36, 26, 18, 24, (x, y) => { P.rect(b, x, y, 14, 20, C.N3); P.rect(b, x + 4, y + 8, 7, 8, C.R2); P.poly(b, [[x + 2, y + 9], [x + 7, y + 3], [x + 13, y + 9]], C.R3); P.px(b, x + 7, y + 12, C.A6); P.hl(b, x, y + 16, 14, C.T2); });
    print(12, 48, 20, 18, (x, y) => { P.rect(b, x, y, 16, 14, C.T1); P.rect(b, x + 7, y + 7, 2, 7, C.A2); P.disc(b, x + 8, y + 5, 4, C.T3); P.px(b, x + 6, y + 4, C.T4); P.px(b, x + 10, y + 3, C.T4); });
    // shelf: jars, plants trailing, small carved shapes
    P.rect(b, 60, 22, 132, 3, C.M2); P.hl(b, 60, 22, 132, C.M3);
    for (let k = 0; k < 6; k++) { const x = 64 + k * 9, c = [C.R3, C.T3, C.A5, C.V3, C.N10, C.O1][k]; P.rect(b, x, 15, 5, 7, C.N6); P.rect(b, x + 1, 17, 3, 5, c); P.hl(b, x, 15, 5, C.N8); }
    P.rect(b, 124, 16, 8, 6, C.O0); const vine = (x0, len, s) => { for (let j = 0; j < len; j++) { const x = x0 + Math.round(Math.sin(j * 0.4 + s) * 2); P.px(b, x, 22 + j, C.T2); if (j % 3 === 0) { P.px(b, x + 1, 22 + j, C.T3); P.px(b, x - 1, 23 + j, C.T2); } } };
    vine(125, 22, 0); vine(129, 15, 2); vine(131, 28, 4); P.px(b, 126, 14, C.T3); P.px(b, 128, 13, C.T4); P.px(b, 130, 14, C.T3);
    P.rect(b, 144, 18, 4, 4, C.A4); P.poly(b, [[152, 22], [155, 15], [158, 22]], C.R3); P.disc(b, 166, 19, 2.5, C.V3); P.rect(b, 174, 14, 3, 8, C.N9); P.rect(b, 180, 16, 8, 6, C.T2); P.px(b, 183, 14, C.T4);
    // string lights
    for (let k = 0; k < 24; k++) { const x = 6 + k * 8.4, y = 5 + Math.round(Math.sin((k % 8) / 8 * Math.PI) * 4); P.px(b, Math.round(x), y, [C.A6, C.R4, C.T4, C.V4][k % 4]); P.px(b, Math.round(x + 4), y + (k % 8 < 4 ? 1 : -1), C.N2); }
    // desk
    P.rect(b, 52, 96, 150, 4, C.M2); P.hl(b, 52, 96, 150, C.M3); P.hl(b, 52, 99, 150, C.M0); P.rect(b, 56, 100, 4, 18, C.M1); P.rect(b, 194, 100, 4, 18, C.M1);
    // the monitor: a painting program (no words), canvas with a chunky lantern in progress
    P.rect(b, 110, 34, 74, 52, C.N1); P.box(b, 110, 34, 74, 52, C.N6); P.hl(b, 110, 34, 74, C.N7); P.rect(b, 142, 86, 10, 8, C.N1); P.rect(b, 134, 93, 26, 3, C.N1); P.hl(b, 134, 93, 26, C.N5);
    P.rect(b, 112, 36, 70, 48, C.N3);
    P.rect(b, 112, 36, 8, 48, C.N4); for (let k = 0; k < 7; k++) { P.rect(b, 114, 39 + k * 6, 4, 4, [C.N10, C.N10, C.A5, C.N10, C.N10, C.N10, C.N10][k]); P.px(b, 115, 40 + k * 6, C.N4); }
    P.rect(b, 172, 36, 10, 48, C.N4); const sw = [C.A8, C.A6, C.A5, C.A3, C.R4, C.R2, C.T4, C.T2, C.V3, C.N10, C.N6, C.N1];
    for (let k = 0; k < 12; k++) P.rect(b, 173 + (k % 2) * 4, 38 + (k >> 1) * 4, 3, 3, sw[k]);
    P.rect(b, 173, 64, 8, 6, C.N2); P.box(b, 173, 64, 8, 6, C.N8); P.rect(b, 173, 72, 8, 6, C.N2); P.px(b, 176, 74, C.A5); P.rect(b, 173, 80, 8, 2, C.N6);
    P.rect(b, 122, 38, 48, 44, C.N1);
    // desk things: tablet, sketchbooks, cup of brushes
    P.rect(b, 100, 92, 30, 4, C.N2); P.box(b, 100, 92, 30, 4, C.N6); P.hl(b, 102, 93, 26, C.N3);
    P.rect(b, 166, 91, 22, 2, C.R2); P.rect(b, 164, 93, 24, 3, C.T2); P.hl(b, 164, 93, 24, C.T3);
    P.rect(b, 190, 86, 6, 10, C.O0); P.vl(b, 191, 79, 7, C.A4); P.vl(b, 193, 81, 5, C.N9); P.vl(b, 194, 78, 8, C.R3); P.px(b, 191, 78, C.T4);
    // guitar leaning, dog asleep on its bed
    P.ell(b, 22, 104, 8, 10, C.A3); P.ell(b, 22, 96, 6, 6, C.A3); P.disc(b, 22, 102, 2.5, C.A0); P.rect(b, 21, 62, 3, 30, C.A1); P.rect(b, 20, 58, 5, 5, C.A2); P.vl(b, 22, 64, 44, C.N9); P.ell(b, 20, 106, 3, 5, C.A4);
    P.ell(b, 34, 134, 22, 6, C.R1); P.ell(b, 34, 133, 18, 4, C.R2); P.ell(b, 33, 130, 10, 4, C.O2); P.disc(b, 42, 128, 3.2, C.O2); P.px(b, 45, 129, C.A1); P.rect(b, 40, 125, 2, 2, C.O0); P.px(b, 24, 129, C.O1); P.px(b, 23, 128, C.O1);
    P.ell(b, 120, 138, 46, 7, C.T1); P.ell(b, 120, 138, 36, 5, C.T2); for (let x = 90; x < 152; x += 6) P.px(b, x, 138, C.T1);
    // stool + artist (facing right): beanie, headphones
    P.rect(b, 78, 106, 18, 3, C.M2); P.hl(b, 78, 106, 18, C.M3); P.vl(b, 80, 109, 9, C.M1); P.vl(b, 93, 109, 9, C.M1); P.hl(b, 80, 114, 14, C.M1);
    place(b, person({ skin: C.O0, skinSh: C.A3, hair: C.A1, style: 'beanie', hat: C.T3, hat2: C.T4, phones: C.N9, top: C.R2, topSh: C.R1, pants: C.N3, shoe: C.N2, lean: 1 }), 86, 105, false);
    light(b, 66, 80, true);
    
    return { b, lan: { x: 66, y: 87 } };
  }
  // the canvas on the artist's screen: 16x15 art pixels at 3x, painted in order
  const MINI = ['......kkkk......', '.....k....k.....', '.....k....k.....', '......mnnm......', '.....mnoonm.....', '....kkkkkkkk....', '....k455554k....', '....k567765k....',
    '....k578875k....', '....k578875k....', '....k567765k....', '....k455554k....', '....kkkkkkkk....', '.....mnnnnm.....', '....mmnnnnmm....'];
  const MINIMAP = { k: C.A1, m: C.A2, n: C.A3, o: C.A4, 4: C.A4, 5: C.A5, 6: C.A6, 7: C.A7, 8: C.A8 };
  let miniOrder = [];
  function buildMini() {
    miniOrder = [];
    for (let y = 0; y < MINI.length; y++) for (let x = 0; x < 16; x++) if (MINI[y][x] !== '.') miniOrder.push([x, y, MINIMAP[MINI[y][x]]]);
    // paint outline first, then the light — like a person would
    miniOrder.sort((a, q) => ((a[2] <= C.A3 ? 0 : 1) - (q[2] <= C.A3 ? 0 : 1)) || (a[1] - q[1]) || (a[0] - q[0]));
  }
  function drawMini(b, sx, sy, t) {
    const n = miniOrder.length, done = Math.min(n, Math.floor(n * 0.5 + (t - TL.pan0 - 3 * (TL.rest + TL.move) + 0.5) * n * 0.28));
    // checker under-canvas + faint glow rings already sketched
    for (let i = 0; i < Math.max(0, done); i++) { const q = miniOrder[i]; P.rect(b, sx + q[0] * 3, sy + q[1] * 3 - 1, 3, 3, q[2]); }
    if (done > 0 && done < n) { const q = miniOrder[done]; P.box(b, sx + q[0] * 3 - 1, sy + q[1] * 3 - 2, 5, 5, C.N11); }
  }
  // 5 — the conversation that ends
  function room5() {
    const b = roomBase(C.R0, C.R2, C.A1, C.A0, C.R1);
    for (let y = 10; y < 112; y += 12) for (let x = (y / 12 & 1) * 8 + 5; x < RW; x += 16) { P.px(b, x, y, C.R1); P.px(b, x, y + 1, C.R1); }
    // bookcase
    P.rect(b, 6, 18, 40, 98, C.A1); P.box(b, 6, 18, 40, 98, C.A2); P.hl(b, 6, 18, 40, C.A4);
    for (let k = 0; k < 5; k++) { const y = 36 + k * 19; P.rect(b, 8, y, 36, 2, C.A2); P.hl(b, 8, y, 36, C.A3); if (k === 2) { P.rect(b, 12, y - 8, 7, 8, C.O0); P.px(b, 14, y - 11, C.T3); P.px(b, 16, y - 12, C.T2); P.px(b, 13, y - 10, C.T2); P.px(b, 17, y - 10, C.T3); books(b, 24, y, 6, 50 + k, 13); } else books(b, 9, y, 11, 50 + k, 14); }
    // a big picture: night sea with the book-moon
    frame(b, 82, 20, 70, 40, C.A4); P.rect(b, 84, 22, 66, 36, C.N2); P.rect(b, 84, 44, 66, 14, C.N3);
    P.hl(b, 108, 30, 6, C.N11); P.hl(b, 115, 30, 6, C.N11); P.hl(b, 109, 31, 5, C.N10); P.hl(b, 115, 31, 5, C.N10); P.hl(b, 110, 32, 4, C.N9); P.hl(b, 115, 32, 4, C.N9); P.px(b, 114, 33, C.N8);
    for (let k = 0; k < 6; k++) P.hl(b, 108 - k + (k & 1) * 3, 46 + k * 2, 10 + k * 2 - (k & 1) * 4, k < 2 ? C.N9 : C.N6);
    P.px(b, 90, 26, C.N9); P.px(b, 140, 28, C.N8); P.px(b, 132, 36, C.N7); P.poly(b, [[84, 44], [94, 38], [102, 44]], C.N4);
    frame(b, 160, 28, 16, 20, C.N7); P.rect(b, 162, 30, 12, 16, C.T1); P.disc(b, 168, 37, 3, C.T3);
    // floor lamp (off), plant
    P.vl(b, 196, 50, 68, C.N6); P.poly(b, [[189, 50], [203, 50], [200, 38], [192, 38]], C.M2); P.hl(b, 192, 38, 8, C.M3); P.hl(b, 191, 117, 10, C.N6);
    P.rect(b, 54, 104, 12, 14, C.O0); P.hl(b, 54, 104, 12, C.O1); const leaf = (x, y, dx, len, c) => { for (let j = 0; j < len; j++) { P.px(b, x + Math.round(dx * j), y - j, c); P.px(b, x + Math.round(dx * j) + (dx > 0 ? 1 : -1), y - j, c); } };
    leaf(60, 103, -0.5, 22, C.T2); leaf(60, 103, 0.35, 26, C.T3); leaf(59, 103, -0.15, 30, C.T2); leaf(61, 103, 0.7, 16, C.T2); leaf(58, 103, -0.9, 14, C.T1);
    // sofa
    P.rect(b, 96, 76, 92, 30, C.T1); P.hl(b, 96, 76, 92, C.T2); P.rect(b, 90, 90, 10, 28, C.T1); P.hl(b, 90, 90, 10, C.T2); P.rect(b, 184, 90, 10, 28, C.T1); P.hl(b, 184, 90, 10, C.T2);
    P.rect(b, 100, 102, 84, 10, C.T2); P.hl(b, 100, 102, 84, C.T3); P.vl(b, 142, 102, 10, C.T1); P.rect(b, 96, 112, 92, 6, C.T1); P.hl(b, 96, 112, 92, C.T0);
    for (let x = 104; x < 184; x += 12) P.px(b, x, 86, C.T0);
    P.rect(b, 160, 88, 18, 14, C.A3); P.hl(b, 160, 88, 18, C.A4); P.px(b, 169, 95, C.A2); P.rect(b, 102, 90, 14, 12, C.V2); P.hl(b, 102, 90, 14, C.V3);
    // coffee table with mug + book
    P.rect(b, 44, 122, 62, 3, C.A3); P.hl(b, 44, 122, 62, C.A5); P.rect(b, 48, 125, 3, 12, C.A2); P.rect(b, 99, 125, 3, 12, C.A2);
    P.rect(b, 84, 117, 5, 5, C.N10); P.px(b, 89, 119, C.N10); P.rect(b, 50, 119, 16, 3, C.T2); P.hl(b, 50, 121, 16, C.N10);
    P.ell(b, 100, 142, 70, 6, C.V1); P.ell(b, 100, 142, 60, 4, C.V0); P.ell(b, 100, 142, 40, 2, C.V1);
    light(b, 74, 110, true);
    return { b, lan: { x: 74, y: 113 } };
  }
  function person5(b, sx, sy, t, dimLUT) {
    // on the sofa, facing left, a laptop on the knees; then leaning back and closing it
    const k = P.ease(P.prog(t, TL.lapClose - 0.55, TL.lapClose - 0.05));
    const lid = t < TL.lapClose ? 2 : t < TL.lapClose + 0.13 ? 1 : 0;
    const q = c => dimLUT ? dimLUT[c] : c;
    const o = { skin: q(C.O1), skinSh: q(C.O0), hair: q(C.A1), hair2: q(C.A0), style: 'short', top: q(C.A4), topSh: q(C.A3), pants: q(C.N5), shoe: q(C.N8), lean: Math.round(P.lerp(2, -3, k)), arm: k > 0.5 ? 'lap' : 'desk', hand: 2 + (k <= 0 ? (Math.floor(t * 9) % 3 === 1 ? 1 : 0) : 0) };
    place(b, person(o), sx + 136, sy + 101, true);
    const lx = sx + 110, ly = sy + 95;
    P.rect(b, lx, ly, 14, 2, q(C.N8)); P.hl(b, lx, ly + 1, 14, q(C.N6));
    if (lid === 2) {
      P.line(b, lx, ly - 1, lx - 3, ly - 10, q(C.N8)); P.line(b, lx + 1, ly - 1, lx - 2, ly - 10, q(C.N6));
      for (let j = 0; j < 8; j++) P.px(b, lx + 2 - Math.round(j * 0.33), ly - 2 - j, j % 3 === Math.floor(t * 5) % 3 ? C.N11 : C.N10);
    } else if (lid === 1) { P.line(b, lx, ly - 1, lx - 6, ly - 5, q(C.N8)); P.line(b, lx, ly - 2, lx - 5, ly - 5, q(C.N6)); }
    else { P.hl(b, lx, ly - 1, 14, q(C.N8)); P.px(b, lx + 6, ly - 1, q(C.N10)); }
  }

  function init() {
    if (built) return; built = true;
    for (const s of [0.2, 0.4, 0.58, 0.74, 0.86]) NIGHT.push(P.mixLUT(C.N1, s));
    NIGHT.push(P.mixLUT(C.N1, 0.93));
    facade(); buildMini();
    [room1, room2, room3, room4, room5, room2].forEach((fn, i) => {
      const r = fn(), ox = WX0 + PITCH * i;
      if (i === 5) { // the neighbour past the last room: same bones, different light — only half is ever seen
        P.lutRect(r.b, 0, 0, RW, RH, L.rose1);
      }
      P.blit(world, r.b, ox, WY0);
      rooms.push({ ox, oy: WY0, lan: r.lan, b: r.b });
      // inner shadow under the lintel and by the left jamb (depth)
      P.lutRect(world, ox, WY0, RW, 3, L.dn1); P.lutRect(world, ox, WY0, 2, RH, L.dn1);
      // outer flower box on some sills
      if (i % 2 === 0) for (let k = 0; k < 60; k += 3) { const xx = ox + 20 + k + (i * 37) % 90, hh = P.hash(k, i, 13); P.rect(world, xx, WY0 + RH + 3 - (hh > 0.5 ? 2 : 1), 2, 3, hh < 0.3 ? C.T2 : C.T1); P.px(world, xx, WY0 + RH + 2 - (hh > 0.5 ? 2 : 1), hh < 0.25 ? C.R3 : hh < 0.4 ? C.A5 : C.T3); }
    });
    // a pigeon asleep on the third sill
    const px_ = WX0 + PITCH * 2 + 170, py = WY0 + RH + 1; P.ell(world, px_, py + 2, 5, 3, C.N8); P.rect(world, px_ + 3, py - 1, 3, 3, C.N8); P.px(world, px_ + 6, py, C.A4); P.px(world, px_ - 5, py + 3, C.N6); P.hl(world, px_ - 2, py + 2, 4, C.N9);
  }
  function camX(t) {
    const u = t - TL.pan0, seg = TL.rest + TL.move;
    if (u <= 0) return 0;
    const k = Math.min(4, Math.floor(u / seg)), f = u - k * seg;
    if (k >= 4) return PITCH * 4;
    return Math.round(PITCH * (k + P.smooth(P.prog(f, TL.rest, seg))));
  }
  function render(b, t) {
    init();
    const cx = camX(t);
    P.blit(b, world, 0, 0, { sx: cx, sw: W });
    for (let i = 0; i < rooms.length; i++) {
      const r = rooms[i], sx = r.ox - cx, sy = r.oy;
      if (sx > W || sx + RW < 0) continue;
      const clip = [Math.max(0, sx), sy, Math.min(W, sx + RW), sy + RH];
      const tmp = g.S5._t || (g.S5._t = P.mk(W, H));
      let lit = 1;
      if (i === 4) lit = 1 - P.prog(t, TL.dim[0], TL.dim[1]);
      // living details, drawn in screen space and clipped to the window
      P.clear(tmp);
      if (i === 0) {
        const s = Math.floor(t * 4);
        for (let k = 0; k < 14; k++) { const yy = sy + 42 + k * 3; if (P.hash(k + s, 12, 3) < 0.8) P.hl(tmp, sx + 77, yy, 3 + Math.floor(P.hash(k + s, 12, 4) * 14), [C.T3, C.T4, C.T2, C.N9][Math.floor(P.hash(k + s, 12, 5) * 4)]); else P.hl(tmp, sx + 77, yy, 17, C.T0); }
        P.rect(tmp, sx + 77, sy + 41, 18, 44, P.TR);
        P.rect(tmp, sx + 75, sy + 41, 20, 44, C.T0);
        for (let k = 0; k < 14; k++) { const yy = sy + 42 + k * 3; if (P.hash(k + s, 12, 3) < 0.8) P.hl(tmp, sx + 77, yy, 3 + Math.floor(P.hash(k + s, 12, 4) * 14), [C.T3, C.T4, C.T2, C.N9][Math.floor(P.hash(k + s, 12, 5) * 4)]); }
        if (Math.floor(t * 2) % 2) P.rect(tmp, sx + 136, sy + 60, 2, 3, C.A6);            // code cursor
        if (Math.sin(t * 3) > 0) P.rect(tmp, sx + 164, sy + 70, 2, 5, C.R5);                // error marker
        P.px(tmp, sx + 16, sy + 90, Math.floor(t * 6) % 3 ? C.T4 : C.T2);
        for (let k = 0; k < 4; k++) { const ph = (t * 0.7 + k * 0.25) % 1; P.px(tmp, sx + 162 + Math.round(Math.sin(ph * 6 + k) * 1), sy + 88 - Math.round(ph * 8), ph < 0.5 ? C.N8 : C.N6); } // steam
        const tap = Math.floor(t * 8) % 4; P.px(tmp, sx + 144 + tap * 2, sy + 91, C.N10);
      } else if (i === 1) {
        const nod = Math.sin(t * 1.4) > 0.7 ? 1 : 0;
        P.px(tmp, sx + 81 - nod, sy + 93, C.A6); P.px(tmp, sx + 80 - nod, sy + 92, C.A5);         // pencil moving
        if (Math.sin(t * 0.9 + 1) > 0.2) P.px(tmp, sx + 150, sy + 10, C.A8);
      } else if (i === 2) {
        for (let k = 0; k < 4; k++) { const ph = (t * 0.6 + k * 0.25) % 1; P.px(tmp, sx + 122 + Math.round(Math.sin(ph * 6 + k) * 1), sy + 85 - Math.round(ph * 8), ph < 0.5 ? C.N9 : C.M3); }
        const w = Math.floor(t * 3) % 4; P.px(tmp, sx + 70 + w * 2, sy + 90, C.N6);                  // the pen hesitates
      } else if (i === 3) {
        drawMini(tmp, sx + 122, sy + 39, t);
        const a = Math.floor(t * 5) % 3; P.px(tmp, sx + 103 + a * 2, sy + 93, C.N11); P.px(tmp, sx + 102 + a * 2, sy + 92, C.N9);
        for (let k = 0; k < 24; k++) if ((k + Math.floor(t * 2)) % 6 === 0) P.px(tmp, sx + Math.round(6 + k * 8.4), sy + 5 + Math.round(Math.sin((k % 8) / 8 * Math.PI) * 4), C.A8);
        P.px(tmp, sx + 23, sy + 128 - (Math.sin(t * 2.2) > 0.5 ? 1 : 0), C.O1);                     // the dog's ear twitches
      }
      P.blit(b, tmp, clip[0], clip[1], { sx: clip[0], sy: clip[1], sw: clip[2] - clip[0], sh: clip[3] - clip[1] });
      // tmp is in screen space already
      if (i === 4) {
        // dim the room in dithered stages before drawing the person and the lantern
        const dk = (1 - lit) * NIGHT.length, st = Math.min(NIGHT.length - 1, Math.floor(dk)), fr = dk - st;
        let personLUT = null;
        if (lit < 1) {
          if (st > 0) P.lutRect(b, clip[0], clip[1], clip[2] - clip[0], clip[3] - clip[1], NIGHT[st - 1]);
          // re-read from world for the next stage where the dither says so
          const lv = lit <= 0 ? 16 : Math.round(fr * 16);
          for (let y = clip[1]; y < clip[3]; y++) for (let x = clip[0]; x < clip[2]; x++) if (P.bay(x, y) < lv) b.d[y * W + x] = NIGHT[st][world.d[y * WW + x + cx]];
          personLUT = NIGHT[Math.min(NIGHT.length - 1, Math.round(dk) > 0 ? Math.round(dk) - 1 : 0)];
          if (Math.round(dk) === 0) personLUT = null;
        }
        P.clear(tmp);
        person5(tmp, sx, sy, t, personLUT);
        P.blit(b, tmp, clip[0], clip[1], { sx: clip[0], sy: clip[1], sw: clip[2] - clip[0], sh: clip[3] - clip[1] });
      }
      // dust motes drifting in the lantern light (every room breathes)
      if (lit >= 1) for (let k = 0; k < 7; k++) {
        const ph = (t * (0.07 + k * 0.011) + P.hash(k, i, 88)) % 1, mx = sx + r.lan.x + Math.round((P.hash(k, i, 89) - 0.5) * 70 + Math.sin(t * 0.8 + k) * 3), my = sy + r.lan.y + 14 - Math.round(ph * 60);
        if (mx > clip[0] && mx < clip[2] - 1 && my > clip[1] && my < clip[3]) { const c0 = b.d[my * W + mx]; b.d[my * W + mx] = L.up1[c0]; }
      }
      // the lantern itself
      const lx = sx + r.lan.x, ly = sy + r.lan.y;
      if (lx > -20 && lx < W + 20) LAN.draw(b, lx, ly, 5, { lit: lit, noGlow: true });
      if (lit >= 1) { const fl = Math.floor(t * 15 + i * 3) % 5; if (fl === 0) P.px(b, lx, ly + 1, C.A7); else if (fl === 2) P.px(b, lx - 1, ly + 3, C.A8); else if (fl === 3) P.px(b, lx + 1, ly + 1, C.A7); }
    }
  }
  function irisIn(dst, tmpB, t) {
    render(tmpB, t);
    let k = P.prog(t, TL.wIris[0], TL.wIris[1]); k = k * k * (0.3 + 0.7 * k);
    const x0 = Math.round(P.lerp(153, -4, k)), x1 = Math.round(P.lerp(168, 484, k)), y0 = Math.round(P.lerp(130, -4, k)), y1 = Math.round(P.lerp(141, 274, k));
    const xa = Math.max(0, x0), xb = Math.min(W, x1), ya = Math.max(0, y0), yb = Math.min(H, y1);
    for (let y = ya; y < yb; y++) dst.d.set(tmpB.d.subarray(y * W + xa, y * W + xb), y * W + xa);
    P.box(dst, x0 - 1, y0 - 1, x1 - x0 + 2, y1 - y0 + 2, C.N6); P.hl(dst, x0 - 1, y0 - 1, x1 - x0 + 2, C.N8);
    P.box(dst, x0 - 2, y0 - 2, x1 - x0 + 4, y1 - y0 + 4, C.N3);
  }
  g.S5 = { init, render, irisIn, camX };
})(typeof window !== 'undefined' ? window : globalThis);
