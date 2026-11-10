// s4.js — MANY WINDOWS (wide). A floating night city over still water; every lit
// window holds the same lantern. Also plays the last shot: one window dark, and the
// cursor that starts to blink inside it.
(function (g) {
  'use strict';
  const P = g.PX, C = P.C, L = P.LUT, TL = g.TL, LAN = g.LAN;
  const W = 480, H = 270, WY = 196;
  const HERO = { x: 240, y: 137 };                 // lantern position inside the centre window
  const HT = { x0: 150, x1: 270, top: 12, cols: [160, 180, 200, 220, 240, 260], rows: [23, 39, 55, 71, 87, 103, 119, 135, 151, 167, 183] };
  let sky, far, mid, hero, built = false;
  const tog = { far: [], mid: [] }, beads = [];
  let heroWin = [];

  // ---------- generic tower painter (upright, into a temp buffer; optional shear) ----------
  function tower(dst, x, yTop, w, h, o) {
    const t = P.mk(w + 8, h + 30 + (o.float || 0)), ox = 4, oy = 26, r = P.rng(o.seed);
    P.rect(t, ox, oy, w, h, o.wall);
    P.vl(t, ox, oy, h, o.sh); if (w > 12) P.vl(t, ox + 1, oy, h, o.sh);
    P.vl(t, ox + w - 1, oy, h, o.hi);
    const ww = o.ww, wh = o.wh, px_ = o.px, py = o.py;
    const cols = Math.floor((w - 3) / px_), x0 = ox + ((w - cols * px_ + (px_ - ww)) >> 1);
    const wins = [];
    for (let yy = oy + 3; yy + wh < oy + h - 2; yy += py) {
      const band = r.chance(0.12);
      if (band) { P.hl(t, ox, yy + wh + 1, w, o.hi2 || o.sh); }
      for (let c = 0; c < cols; c++) {
        const xx = x0 + c * px_, hh = r();
        const lit = hh < o.lit;
        if (lit) {
          const warm = r.chance(0.86), c1 = warm ? (r.chance(0.55) ? o.l1 : o.l0) : r.pick([C.T2, C.R2, C.V2]);
          P.rect(t, xx, yy, ww, wh, c1);
          // the lantern: a hot pixel low in the window
          if (ww >= 2) P.px(t, xx + r.i(0, ww - 1), yy + wh - 1 - (wh > 2 ? r.i(0, 1) : 0), warm ? o.l2 : C.A6);
          if (ww >= 3 && r.chance(0.4)) P.px(t, xx + r.i(0, ww - 1), yy + wh - 1, C.A0); // someone
          wins.push([xx - ox, yy - oy, c1, warm ? o.l2 : C.A6]);
        } else P.rect(t, xx, yy, ww, wh, o.dark);
      }
    }
    // roof furniture
    const k = o.roof === undefined ? r.i(0, 4) : o.roof;
    if (k === 0) { P.rect(t, ox + 2, oy - 4, w - 4, 4, o.wall); P.hl(t, ox + 2, oy - 4, w - 4, o.hi); P.vl(t, ox + (w >> 1), oy - 16, 12, o.hi); P.px(t, ox + (w >> 1), oy - 17, C.R3); }
    else if (k === 1) { for (let i = 0; i < 3; i++) { P.rect(t, ox + 2 + i * 2, oy - 3 - i * 3, w - 4 - i * 4, 3, o.wall); P.hl(t, ox + 2 + i * 2, oy - 3 - i * 3, w - 4 - i * 4, o.hi); } P.vl(t, ox + (w >> 1), oy - 14, 5, o.hi); }
    else if (k === 2) { P.ell(t, ox + w / 2 - 0.5, oy, w / 2 - 1, Math.min(10, w / 2), o.wall); P.rect(t, ox, oy, w, 2, o.wall); P.hl(t, ox, oy, w, o.hi); P.px(t, ox + (w >> 1), oy - Math.min(10, w >> 1) - 1, C.A5); }
    else if (k === 3) { P.rect(t, ox + 2, oy - 6, 6, 6, o.sh); P.hl(t, ox + 2, oy - 6, 6, o.hi); P.vl(t, ox + w - 4, oy - 9, 9, o.hi); P.hl(t, ox + w - 6, oy - 9, 5, o.hi); P.px(t, ox + 4, oy - 3, o.l1); }
    else { P.poly(t, [[ox, oy], [ox + w / 2, oy - Math.min(14, w * 0.6)], [ox + w, oy]], o.wall); P.line(t, ox + (w >> 1), oy - Math.min(14, Math.round(w * 0.6)), ox + w - 1, oy - 1, o.hi); }
    P.hl(t, ox, oy, w, o.hi);
    // floating: a tapering wedge of rock under the building
    if (o.float) {
      const fh = o.float;
      for (let i = 0; i < fh; i++) {
        const f = (i + 1) / fh, inset = Math.round(Math.pow(f, 0.75) * (w / 2 - 1) + (P.hash(i >> 1, o.seed, 3) - 0.5) * 2);
        const y = oy + h + i, a = ox + Math.max(0, inset), e = ox + w - Math.max(0, inset) - (i % 3 === 2 ? 1 : 0);
        if (y >= t.h || e <= a) break;
        P.hl(t, a, y, e - a, i === 0 ? o.hi : o.sh);
        P.px(t, a, y, o.dark); if (e - a > 2) P.px(t, e - 1, y, o.wall);
        if (i > 0 && i % 4 === 1 && e - a > 5) P.hl(t, a + 2, y, Math.min(4, e - a - 3), o.dark);
      }
    }
    // blit with shear
    const sh = o.shear || 0, th = t.h;
    for (let yy = 0; yy < th; yy++) {
      const dxs = Math.round((yy - (oy + h)) * sh);
      P.blit(dst, t, x - ox + dxs, yTop - oy + yy, { sy: yy, sh: 1 });
    }
    if (o.float) for (let i = 0; i < 2; i++) { // lanterns hanging on chains from the rock
      const rx = x + 4 + Math.round((i + 0.3 + r() * 0.4) * (w - 8) / 2), ry0 = yTop + h + Math.round(o.float * 0.45), rl = r.i(4, 9);
      for (let j = 0; j < rl; j += 2) P.px(dst, rx, ry0 + j, o.hi);
      P.px(dst, rx, ry0 + rl, C.A5); P.px(dst, rx, ry0 + rl + 1, C.A7);
    }
    if (o.tog) for (const q of wins) if (r.chance(o.togp || 0.12)) {
      const dxs = Math.round((q[1] + oy - (oy + h)) * sh);
      o.tog.push({ x: x + q[0] + dxs, y: yTop + q[1], w: ww, h: wh, c: q[2], hot: q[3], dark: o.dark, t0: r.r(0, 9), per: r.r(5, 11), duty: r.r(0.35, 0.8) });
    }
  }

  function buildSky() {
    sky = P.mk(W, WY, C.N1);
    P.vgrad(sky, 0, 0, W, WY, [C.N1, C.N1, C.N2, C.N2, C.N3, C.N3, C.N4, C.V1], 1);
    const r = P.rng(5005);
    for (let i = 0; i < 260; i++) { const x = r.i(0, W - 1), y = r.i(0, 150), h = r(); P.px(sky, x, y, h < 0.5 ? C.N6 : h < 0.85 ? C.N7 : h < 0.96 ? C.N9 : C.N11); }
    for (let i = 0; i < 7; i++) { const x = r.i(10, W - 10), y = r.i(30, 120); P.px(sky, x, y, C.N11); P.px(sky, x - 1, y, C.N8); P.px(sky, x + 1, y, C.N8); P.px(sky, x, y - 1, C.N8); P.px(sky, x, y + 1, C.N8); }
    // --- the huge soft planet ---
    const pc = { x: 384, y: 104, r: 84 };
    P.shade(sky, pc.x - pc.r - 2, 0, W, WY, (x, y, c) => {
      const dx = x - pc.x, dy = y - pc.y, d = Math.sqrt(dx * dx + dy * dy);
      if (d > pc.r) return -1;
      const nz = Math.sqrt(Math.max(0, 1 - (d / pc.r) * (d / pc.r)));
      // light from upper-left; terminator falls into the night
      const lit = (-dx * 0.62 - dy * 0.55) / pc.r + nz * 0.55;
      const band = Math.sin((dy + dx * 0.18 + Math.sin(dx * 0.05) * 3) * 0.21) * 0.5 + Math.sin(dy * 0.47 + 1) * 0.25;
      const th = (P.bay(x, y) + 0.5) / 16;
      const v = lit + band * 0.16 + (th - 0.5) * 0.22;
      if (v < -0.12) return c;                 // night side dissolves into the sky
      if (v < 0.08) return C.V0;
      if (v < 0.28) return band > 0.2 ? C.R0 : C.V0;
      if (v < 0.5) return band > 0.15 ? C.R1 : C.V1;
      if (v < 0.72) return band > 0.3 ? C.R2 : band < -0.3 ? C.V1 : C.R1;
      if (v < 0.92) return band > 0.25 ? C.R3 : C.R2;
      return band > 0.2 ? C.O1 : C.R3;
    });
    // its ring: two thin tilted ellipses, behind the top and in front of the bottom
    for (let a = 0; a < 720; a++) {
      const th = a / 720 * Math.PI * 2;
      for (let k = 0; k < 3; k++) {
        const rr = 118 + k * 7, x = Math.round(pc.x + Math.cos(th) * rr * 1.0 + Math.sin(th) * rr * 0.08), y = Math.round(pc.y + Math.sin(th) * rr * 0.2 - Math.cos(th) * rr * 0.22);
        const dx = x - pc.x, dy = y - pc.y, inside = dx * dx + dy * dy < pc.r * pc.r;
        if (Math.sin(th) < 0 && inside) continue;
        if (y >= WY) continue;
        const c = k === 1 ? (a % 9 < 6 ? C.N8 : C.N6) : (a % 7 < 4 ? C.V2 : C.N5);
        if (k === 2 && a % 3 === 0) continue;
        P.px(sky, x, y, inside ? (k === 1 ? C.R4 : C.R2) : c);
      }
    }
    // small teal moon with a crescent
    P.shade(sky, 30, 22, 80, 72, (x, y, c) => {
      const dx = x - 55, dy = y - 46, d = Math.sqrt(dx * dx + dy * dy); if (d > 17) return -1;
      const d2 = Math.sqrt((dx - 6) * (dx - 6) + (dy - 4) * (dy - 4));
      if (d2 < 16) return (P.bay(x, y) < 5 && d2 > 12) ? C.T1 : C.T0;
      return d > 15.5 ? C.T3 : (dx + dy < -14 ? C.T5 : C.T4);
    });
    P.px(sky, 46, 40, C.T3); P.px(sky, 44, 47, C.T3); P.px(sky, 47, 46, C.T5);
    // --- the second horizon: a city hanging upside-down from the top of the sky ---
    const r2 = P.rng(5106);
    let x = -4;
    while (x < W) {
      const w = r2.i(7, 18), edge = Math.abs(x + w / 2 - 240) / 240;
      let h = Math.round(6 + edge * edge * 34 + r2.i(0, 12));
      if (x + w > 140 && x < 280) h = Math.min(h, 9);
      const col = r2.chance(0.5) ? C.N2 : C.N3;
      P.rect(sky, x, 0, w, h, col); P.vl(sky, x + w - 1, 0, h, C.N3);
      if (r2.chance(0.4)) P.vl(sky, x + (w >> 1), h, r2.i(2, 7), col);
      for (let yy = 1; yy < h - 2; yy += 3) for (let xx = x + 1; xx < x + w - 2; xx += 2) if (r2.chance(0.36)) P.px(sky, xx, yy, r2.chance(0.75) ? C.A2 : C.A3);
      x += w + r2.i(-1, 3);
    }
    // faint mist under the hanging city
    P.shade(sky, 0, 0, W, 60, (x2, y, c) => (c === C.N1 && P.bay(x2, y) < 3 - y / 14 ? C.N2 : -1));
  }
  function buildFar() {
    far = P.mk(W + 40, WY);
    const r = P.rng(5207);
    const o = { wall: C.N3, sh: C.N2, hi: C.N4, dark: C.N2, l0: C.A2, l1: C.A3, l2: C.A5, ww: 1, wh: 1, px: 2, py: 3, lit: 0.42, tog: tog.far, togp: 0.05 };
    let x = -8;
    while (x < W + 40) {
      const w = r.i(8, 22), h = r.chance(0.12) ? r.i(36, 52) : r.i(10, 34);
      tower(far, x, WY - h, w, h, Object.assign({}, o, { seed: 5300 + x, roof: r.i(0, 4) }));
      x += w + r.i(-3, 3);
    }
    // nearer skyline row, slightly lighter, 1x2 windows
    const o2 = { wall: C.N4, sh: C.N3, hi: C.N5, dark: C.N3, l0: C.A3, l1: C.A4, l2: C.A6, ww: 1, wh: 2, px: 3, py: 4, lit: 0.5, tog: tog.far, togp: 0.06 };
    x = -10;
    while (x < W + 40) {
      const w = r.i(10, 24), h = r.i(6, 22);
      if (r.chance(0.8)) tower(far, x, WY - h, w, h, Object.assign({}, o2, { seed: 5600 + x, roof: r.i(0, 4) }));
      x += w + r.i(0, 10);
    }
  }
  function buildMid() {
    mid = P.mk(W + 40, H);
    const o = { wall: C.N4, sh: C.N3, hi: C.N6, hi2: C.N5, dark: C.N2, l0: C.A3, l1: C.A4, l2: C.A7, ww: 2, wh: 3, px: 4, py: 6, lit: 0.62, tog: tog.mid, togp: 0.10 };
    const oD = Object.assign({}, o, { wall: C.N3, sh: C.N2, hi: C.N5, hi2: C.N4 });
    const T = (x, y, w, h, extra) => tower(mid, x, y, w, h, Object.assign({}, o, extra));
    // left: a tall floater and a pile of blocks stacked at odd angles
    T(26, 52, 40, 100, { seed: 1, float: 22, roof: 0 });
    tower(mid, 2, 96, 22, 70, Object.assign({}, oD, { seed: 2, float: 14, roof: 2 }));
    T(88, 128, 44, 42, { seed: 3, float: 16, shear: 0, roof: 3 });
    T(96, 92, 34, 36, { seed: 4, shear: -0.22, roof: 3 });
    T(84, 58, 30, 34, { seed: 5, shear: 0.2, roof: 4 });
    T(108, 30, 20, 28, { seed: 6, shear: -0.14, roof: 0 });
    // right: floaters in front of the planet
    T(292, 44, 36, 112, { seed: 7, float: 26, roof: 1 });
    T(346, 118, 50, 50, { seed: 8, float: 18, roof: 3 });
    T(356, 84, 36, 34, { seed: 9, shear: 0.26, roof: 3 });
    T(350, 54, 30, 30, { seed: 10, shear: -0.2, roof: 2 });
    T(432, 36, 42, 118, { seed: 11, float: 24, roof: 0 });
    tower(mid, 404, 100, 24, 62, Object.assign({}, oD, { seed: 12, float: 12, roof: 4 }));
    T(478, 70, 30, 90, { seed: 13, float: 16, roof: 1 });
    // a little upside-down tower, because the city has two horizons
    const tmp = P.mk(60, 120); tower(tmp, 10, 30, 22, 50, Object.assign({}, oD, { seed: 14, roof: 0, tog: null }));
    P.blit(mid, tmp, 200 - 60, -18, { fy: true });
    // --- bridges of light ---
    const bridge = (x0, y0, x1, y1, sag, seed) => {
      const n = Math.max(Math.abs(x1 - x0), 8), pts = [];
      for (let i = 0; i <= n; i++) {
        const f = i / n, x = Math.round(P.lerp(x0, x1, f)), y = Math.round(P.lerp(y0, y1, f) + Math.sin(f * Math.PI) * sag);
        pts.push([x, y]);
        if (i % 3 === 0) P.px(mid, x, y, i % 9 === 0 ? C.A6 : C.A4);
        else P.px(mid, x, y, C.A1);
        if (i % 9 === 0 && sag > 0) { P.px(mid, x, y + 1, C.A2); }
        if (i % 12 === 6) { P.vl(mid, x, y - 4, 4, C.A1); }         // hangers up to a second, fainter cable
      }
      for (let i = 0; i <= n; i += 2) { const f = i / n; P.px(mid, Math.round(P.lerp(x0, x1, f)), Math.round(P.lerp(y0, y1, f) + Math.sin(f * Math.PI) * (sag - 5) - 4 + 0.5), C.A2); }
      beads.push({ pts, sp: 14 + (seed % 7), ph: seed * 1.7, n: 2 + (seed % 2) });
    };
    bridge(66, 92, 150, 76, 10, 1); bridge(128, 44, 150, 34, 3, 2);
    bridge(270, 60, 292, 66, 4, 3); bridge(328, 82, 357, 96, 8, 4); bridge(396, 126, 432, 110, 7, 5);
    bridge(270, 108, 346, 128, 12, 6); bridge(64, 132, 88, 140, 4, 7); bridge(380, 58, 432, 50, 6, 8);
    bridge(24, 110, 26, 110, 0, 9);
  }

  // ---------- the hero tower: big windows, each a tiny room with the lantern ----------
  function heroWindow(b, cx, cy, i, j, state, wide) {
    // interior 15x11 (or 35x11 for a double room) centred on (cx,cy); state: 'lit' | 'dark' | 'off' | 'tv'
    const w = wide ? 35 : 15, x = cx - 7, y = cy - 5, h = P.hash(i, j, 900), h2 = P.hash(i, j, 901), h3 = P.hash(i, j, 902);
    P.box(b, x - 1, y - 1, w + 2, 13, C.N6); P.hl(b, x - 1, y - 1, w + 2, C.N7); P.hl(b, x - 2, y + 12, w + 4, C.N7); P.hl(b, x - 1, y + 13, w + 2, C.N3);
    if (state === 'off') { P.rect(b, x, y, w, 11, C.N2); P.hl(b, x, y, w, C.N1); P.rect(b, x, y, 4, 11, C.N3); P.px(b, x + 9, y + 3, C.N3); P.px(b, x + 10, y + 2, C.N3); return; }
    if (state === 'dark') { P.rect(b, x, y, w, 11, C.N0); return; }
    const t = P.mk(w, 11);
    const pal = h < 0.56 ? [C.A2, C.A3, C.A4] : h < 0.72 ? [C.R1, C.R2, C.A4] : h < 0.86 ? [C.A1, C.A2, C.A3] : h < 0.94 ? [C.V1, C.V2, C.A4] : [C.T1, C.T2, C.A4];
    P.rect(t, 0, 0, w, 11, pal[0]);
    const lx = 2 + Math.floor(h2 * (w - 5));
    P.ell(t, lx + 1, 7, 5.2, 4.2, pal[1]);                      // one clean band of lantern light
    P.hl(t, 0, 0, w, L.dn1[pal[0]]);
    const kind = Math.floor(h3 * 7), fx0 = lx > w / 2 ? 1 : w - 6;
    if (kind === 0) { P.rect(t, fx0, 2, 4, 9, C.A1); P.hl(t, fx0, 4, 4, C.A0); P.hl(t, fx0, 7, 4, C.A0); P.px(t, fx0 + 1, 3, C.T3); P.px(t, fx0 + 2, 6, C.R3); }
    else if (kind === 1) { P.vl(t, 0, 0, 11, C.R2); P.vl(t, 1, 0, 9, C.R1); P.vl(t, w - 1, 0, 11, C.R2); }
    else if (kind === 2) { P.px(t, fx0 + 2, 1, C.T2); P.px(t, fx0 + 1, 2, C.T3); P.px(t, fx0 + 3, 2, C.T2); P.vl(t, fx0 + 2, 2, 2, C.T1); }
    else if (kind === 3) { P.rect(t, fx0, 2, 4, 3, C.A1); P.px(t, fx0 + 1, 3, C.T3); }
    else if (kind === 4) { P.hl(t, fx0 - 1, 3, 6, C.A1); P.px(t, fx0, 2, C.R3); P.px(t, fx0 + 3, 2, C.T3); }
    else if (kind === 5) { P.rect(t, fx0, 6, 5, 4, C.A1); P.hl(t, fx0, 6, 5, C.A0); }
    if (wide) { P.rect(t, 15, 0, 1, 2, C.A1); P.rect(t, 18, 6, 9, 4, C.A1); P.hl(t, 18, 6, 9, L.dn1[pal[0]]); P.px(t, 22, 5, C.A0); P.px(t, 23, 5, C.A0); P.rect(t, 22, 3, 2, 2, C.A0); }
    const who = P.hash(i, j, 903);
    if (who < 0.72) {
      const fx = P.clamp(lx + (lx > w / 2 ? -5 : 5), 1, w - 3);
      P.rect(t, fx, 4, 2, 2, C.A0); P.rect(t, fx - 1, 6, 4, 4, C.A0);
      if (who < 0.3) P.px(t, fx + (lx > fx ? 3 : -2), 8, C.A0);
    }
    P.hl(t, 0, 10, w, C.A1);
    LAN.draw(t, lx + 1, 7, 2, { noGlow: true });
    P.blit(b, t, x, y);
  }
  function buildHero() {
    hero = P.mk(W, H);
    const { x0, x1, cols, rows } = HT, w = x1 - x0, top = 44, ptop = 12, px0 = 170, px1 = 250;
    const block = (bx0, bx1, by0) => {
      P.rect(hero, bx0, by0, bx1 - bx0, WY - by0, C.N4);
      P.rect(hero, bx1 - 2, by0, 2, WY - by0, C.N6); P.vl(hero, bx0, by0, WY - by0, C.N3); P.vl(hero, bx0 + 1, by0, WY - by0, C.N3);
      P.rect(hero, bx0 - 2, by0 - 3, bx1 - bx0 + 4, 4, C.N5); P.hl(hero, bx0 - 2, by0 - 3, bx1 - bx0 + 4, C.N7); P.hl(hero, bx0 - 2, by0, bx1 - bx0 + 4, C.N3);
      for (let x = bx0; x < bx1; x += 4) P.rect(hero, x, by0 - 5, 2, 2, C.N5);
    };
    block(x0, x1, top); block(px0, px1, ptop);
    for (const cx of cols) { const y0 = (cx === 160 || cx === 260) ? top : ptop; if (cx > 160) { P.rect(hero, cx - 10, y0 + 1, 2, WY - y0 - 1, C.N5); P.vl(hero, cx - 10, y0 + 1, WY - y0 - 1, C.N3); } }
    for (const ry of rows) {
      const bx0 = ry < 50 ? px0 : x0, bx1 = ry < 50 ? px1 : x1;
      P.hl(hero, bx0 + 2, ry + 9, bx1 - bx0 - 4, C.N3);
      for (const cx of cols) { if (cx < bx0 || cx > bx1) continue; P.px(hero, cx - 3, ry + 10, C.N5); P.px(hero, cx, ry + 10, C.N6); P.px(hero, cx + 3, ry + 10, C.N5); P.px(hero, cx, ry - 8, C.N6); P.px(hero, cx - 1, ry - 8, C.N5); P.px(hero, cx + 1, ry - 8, C.N5); }
    }
    // left terrace: water tank on stilts.  right terrace: a small garden, a table, a lantern
    P.rect(hero, x0 + 3, top - 19, 13, 10, C.N4); P.hl(hero, x0 + 3, top - 19, 13, C.N6); P.vl(hero, x0 + 3, top - 19, 10, C.N3); P.hl(hero, x0 + 3, top - 14, 13, C.N3); P.vl(hero, x0 + 15, top - 18, 9, C.N5);
    P.poly(hero, [[x0 + 2, top - 19], [x0 + 9.5, top - 24], [x0 + 17, top - 19]], C.N5); P.px(hero, x0 + 9, top - 25, C.N6);
    P.vl(hero, x0 + 5, top - 9, 5, C.N3); P.vl(hero, x0 + 13, top - 9, 5, C.N3); P.line(hero, x0 + 5, top - 9, x0 + 13, top - 5, C.N3);
    for (let i = 0; i < 6; i++) { const x = px1 + 3 + i * 2 + (i % 2), hh = 2 + (i * 7) % 5; P.rect(hero, x, top - 3 - hh, 2, hh, i % 2 ? C.T1 : C.T2); P.px(hero, x, top - 3 - hh, i % 3 ? C.T3 : C.R3); }
    P.hl(hero, px1 + 13, top - 7, 5, C.N6); P.vl(hero, px1 + 15, top - 6, 3, C.N5); LAN.draw(hero, px1 + 15, top - 9, 1, { noGlow: true });
    for (let i = 0; i < 10; i++) { const x = px1 + 1 + i * 2; P.px(hero, x, top - 12 - Math.round(Math.sin(i / 9 * Math.PI) * 2), i % 3 === 0 ? C.R3 : i % 3 === 1 ? C.T4 : C.A5); }
    // penthouse roof: mast, a shed with a lit door, vents
    P.vl(hero, px0 + 62, ptop - 30, 27, C.N6); P.hl(hero, px0 + 59, ptop - 24, 7, C.N5); P.hl(hero, px0 + 60, ptop - 19, 5, C.N5);
    P.rect(hero, px0 + 22, ptop - 12, 12, 9, C.N3); P.hl(hero, px0 + 22, ptop - 12, 12, C.N6); P.rect(hero, px0 + 25, ptop - 9, 4, 6, C.A3); P.px(hero, px0 + 26, ptop - 6, C.A6);
    for (let i = 0; i < 7; i++) { const x = px0 + 4 + i * 2 + (i % 3), hh = 2 + (i * 5) % 4; P.rect(hero, x, ptop - 3 - hh, 2, hh, i % 2 ? C.T1 : C.T2); P.px(hero, x, ptop - 3 - hh, C.T3); }
    P.rect(hero, px0 + 44, ptop - 8, 6, 5, C.N5); P.hl(hero, px0 + 44, ptop - 8, 6, C.N7); P.rect(hero, px0 + 70, ptop - 7, 5, 4, C.N3); P.hl(hero, px0 + 70, ptop - 7, 5, C.N5);
    // fire escape on the left flank
    for (let j = 3; j < rows.length; j++) {
      const y = rows[j] + 8;
      P.hl(hero, x0 - 8, y, 9, C.N6); P.hl(hero, x0 - 8, y - 6, 9, C.N5); P.vl(hero, x0 - 8, y - 6, 6, C.N5); P.vl(hero, x0 - 5, y - 5, 5, C.N4);
      if (j < rows.length - 1) P.line(hero, x0 - 7, y + 1, x0 - 1, y + 15, C.N5);
    }
    // quay
    P.rect(hero, x0 - 6, WY - 3, w + 12, 3, C.N5); P.hl(hero, x0 - 6, WY - 3, w + 12, C.N7);
    for (let x = x0 - 4; x < x1 + 6; x += 9) P.vl(hero, x, WY - 2, 2, C.N3);
    heroWin = [];
    const WIDE = { '71:0': 1, '103:3': 1, '119:1': 1, '167:2': 1, '167:4': 1, '87:4': 1, '39:1': 1, '55:0': 1 };
    rows.forEach((ry, j) => {
      for (let i = 0; i < cols.length; i++) {
        const cx = cols[i];
        if (ry < 50 && (cx === 160 || cx === 260)) continue;
        const wide = !!WIDE[ry + ':' + i];
        const off = P.hash(i, j, 950) < 0.1 && ry !== 135 && !wide;
        if (wide) { P.rect(hero, cx + 8, ry - 7, 4, 16, C.N4); }
        heroWin.push({ cx, cy: ry, i, j, off, wide });
        heroWindow(hero, cx, ry, i, j, off ? 'off' : 'lit', wide);
        if (wide) i++;
      }
    });
    // balconies on two floors: a slab and a thin rail
    for (const ry of [87, 151]) {
      P.rect(hero, x0 - 3, ry + 7, w + 6, 2, C.N6); P.hl(hero, x0 - 3, ry + 7, w + 6, C.N8); P.hl(hero, x0 - 3, ry + 9, w + 6, C.N2);
      for (let x = x0 - 2; x < x1 + 3; x += 5) P.vl(hero, x, ry + 3, 4, C.N3);
      for (let x = x0 - 3; x < x1 + 3; x++) if (x % 5 !== 3) P.px(hero, x, ry + 3, C.N7);
      P.rect(hero, x0 + 26 + (ry % 7) * 9, ry + 4, 3, 3, C.T2); P.px(hero, x0 + 27 + (ry % 7) * 9, ry + 3, C.R3);
    }
    // the row we will visit: hint at what is inside
    const vy = 135 - 5;
    P.rect(hero, 160 + 2, vy + 2, 5, 4, C.N2); P.px(hero, 163, vy + 3, C.T4); P.px(hero, 165, vy + 4, C.T3); P.px(hero, 164, vy + 5, C.R3);
    P.rect(hero, 220 + 1, vy + 2, 5, 4, C.N2); P.px(hero, 222, vy + 3, C.A6); P.px(hero, 223, vy + 4, C.A4);
  }

  function init() {
    if (built) return; built = true;
    buildSky(); buildFar(); buildMid(); buildHero();
  }
  function water(b, t) {
    const d = b.d;
    for (let k = 0; k < H - WY; k++) {
      const sy = WY - 1 - k, dy = WY + k;
      const ph = Math.sin(k * 0.83 - t * 1.3) + Math.sin(k * 0.31 + t * 0.8);
      const off = k > 2 ? (ph > 1.35 ? 1 : ph < -1.4 ? -1 : 0) + (k > 30 && Math.sin(k * 0.5 + t * 1.1) > 0.8 ? 1 : 0) : 0;
      const gap = Math.sin(k * 1.31 - t * 0.7) + Math.sin(k * 0.53 + t * 0.4) > 1.62;
      const Lk = k < 28 ? L.dn1 : L.dn2;
      for (let x = 0; x < W; x++) {
        let o = Lk[d[sy * W + P.clamp(x + off, 0, W - 1)]];
        if (k >= 26 && k < 30 && P.bay(x, dy) < (k - 25) * 4) o = L.dn2[d[sy * W + P.clamp(x + off, 0, W - 1)]];
        if (gap && ((x + k * 5 + Math.floor(t * 2)) % 23) < 15) o = L.dn1[o];
        d[dy * W + x] = o;
      }
    }
    for (let x = 0; x < W; x++) if (P.hash(x >> 3, 9, 5) < 0.7) d[WY * W + x] = C.N5;
  }
  function render(b, t) {
    init();
    const ending = t >= TL.toWide[0];
    const tt = ending ? t - TL.toWide[0] + 6 : t - TL.glassCity[0];
    const dMid = -Math.round(tt * 1.3), dFar = -Math.round(tt * 0.5);
    P.rect(b, 0, WY, W, H - WY, C.N1);
    P.blit(b, sky, 0, 0);
    // stars twinkle (tiny)
    for (let i = 0; i < 26; i++) { const x = Math.floor(P.hash(i, 1, 60) * W), y = Math.floor(P.hash(i, 2, 60) * 120) + 8; if (b.d[y * W + x] <= C.N3 && Math.sin(t * (1 + P.hash(i, 3, 60) * 2) + i) > 0.6) b.d[y * W + x] = C.N10; }
    P.layer(b, far, dFar, 0);
    for (const q of tog.far) { const ph = ((t + q.t0) % q.per) / q.per; if (ph > q.duty) P.rect(b, q.x + dFar, q.y, q.w, q.h, q.dark); }
    P.layer(b, mid, dMid, 0);
    for (const q of tog.mid) { const ph = ((t + q.t0) % q.per) / q.per; if (ph > q.duty) P.rect(b, q.x + dMid, q.y, q.w, q.h, q.dark); }
    // people of light crossing the bridges
    for (const br of beads) for (let k = 0; k < br.n; k++) {
      const n = br.pts.length; if (n < 6) continue;
      const pos = ((t * br.sp + br.ph * 9 + k * n / br.n) % (2 * n) + 2 * n) % (2 * n), idx = Math.floor(pos < n ? pos : 2 * n - 1 - pos);
      const p = br.pts[P.clamp(idx, 0, n - 1)]; P.px(b, p[0] + dMid, p[1], C.A8); P.px(b, p[0] + dMid, p[1] - 1, C.A6);
    }
    // a slow airship-lantern and its string of small ones
    const ax = Math.round(520 - ((tt * 5 + 150) % 620)), ay = 70 + Math.round(Math.sin(tt * 0.5) * 2);
    P.ell(b, ax, ay, 7, 3.2, C.N5); P.hl(b, ax - 5, ay - 2, 9, C.N7); P.px(b, ax - 7, ay, C.N6); P.rect(b, ax - 2, ay + 4, 4, 2, C.N4); P.px(b, ax, ay + 5, C.A6); P.px(b, ax - 1, ay + 5, C.A4);
    // loose pages from the library's moon, crossing the city like birds
    for (let i = 0; i < 7; i++) {
      const sp = 7 + i * 1.3, x = Math.round(((P.hash(i, 1, 310) * 560 + tt * sp) % 560) - 40), y = Math.round(34 + P.hash(i, 2, 310) * 76 + Math.sin(t * 0.8 + i * 2) * 3);
      const fl = Math.floor(t * 3 + i * 0.37) % 2;
      if (fl) { P.px(b, x, y, C.N9); P.px(b, x + 1, y + 1, C.N11); P.px(b, x + 2, y + 1, C.N11); P.px(b, x + 3, y + 1, C.N11); P.px(b, x + 4, y, C.N9); }
      else { P.px(b, x, y + 2, C.N9); P.px(b, x + 1, y + 1, C.N11); P.px(b, x + 2, y + 1, C.N11); P.px(b, x + 3, y + 1, C.N11); P.px(b, x + 4, y + 2, C.N9); }
    }
    P.layer(b, hero, 0, 0);
    // hero windows: slow life (someone crosses the room, a lantern flickers one step)
    for (const wdw of heroWin) {
      if (wdw.off) continue;
      if (wdw.cx === 240 && wdw.cy === 135) {
        if (ending) { heroWindow(b, 240, 135, wdw.i, wdw.j, 'dark'); }
        continue;
      }
      const ph = Math.sin(t * (0.6 + P.hash(wdw.i, wdw.j, 77)) + wdw.i * 3 + wdw.j * 5);
      if (ph > 0.93) { const lx = wdw.cx - 7 + 2 + Math.floor(P.hash(wdw.i, wdw.j, 901) * ((wdw.wide ? 35 : 15) - 5)) + 1; P.px(b, lx, wdw.cy + 1, C.A8); }
    }
    // mast light (small, slow)
    if (Math.sin(t * 2.2) > 0) { P.px(b, 232, -19 + 0, C.R3); } else P.px(b, 232, -19, C.R1);
    water(b, t);
    // a boat with one lantern, crossing in the foreground
    const bx = Math.round(60 + tt * 4), by = WY + 38;
    P.hl(b, bx - 6, by, 13, C.N5); P.hl(b, bx - 5, by + 1, 11, C.N3); P.hl(b, bx - 3, by + 2, 7, C.N2); P.px(b, bx - 7, by - 1, C.N5); P.px(b, bx + 7, by - 1, C.N5);
    P.rect(b, bx - 1, by - 5, 2, 5, C.N2); P.px(b, bx - 1, by - 6, C.N3);
    P.vl(b, bx + 4, by - 7, 7, C.N6); LAN.draw(b, bx + 4, by - 9, 1, { noGlow: true });
    for (let k = 0; k < 7; k++) if (((k + Math.floor(t * 2)) & 1) === 0) P.px(b, bx + 4 + (k % 2 ? 1 : 0) - (k % 3 === 0 ? 1 : 0), by + 3 + k * 2, k < 3 ? C.A5 : C.A3);
    for (let k = 1; k < 4; k++) { P.hl(b, bx - 10 - k * 7, by + 1 + (k & 1), 4, C.N4); }
    if (ending) {
      const S1 = g.S1;
      if (t >= TL.bIris[0]) {
        let k = P.prog(t, TL.bIris[0], TL.bIris[1]); k = k * k * (0.3 + 0.7 * k);
        const x0 = Math.round(P.lerp(233, -2, k)), x1 = Math.round(P.lerp(248, 482, k)), y0 = Math.round(P.lerp(130, -2, k)), y1 = Math.round(P.lerp(141, 272, k));
        // the window frame rides the edge of the dark for a moment, then it is only dark
        if (k < 0.5) { P.box(b, x0 - 1, y0 - 1, x1 - x0 + 2, y1 - y0 + 2, C.N6); P.hl(b, x0 - 1, y0 - 1, x1 - x0 + 2, C.N7); }
        else P.box(b, x0 - 1, y0 - 1, x1 - x0 + 2, y1 - y0 + 2, C.N2);
        P.rect(b, x0, y0, x1 - x0, y1 - y0, C.N0);
      }
      if (t >= TL.curOn && TL.cursorOn(t)) S1.cursor(b, true, false);
    }
  }
  g.S4 = { init, render, HERO, HT, WY, heroWindow, tower, water };
})(typeof window !== 'undefined' ? window : globalThis);
