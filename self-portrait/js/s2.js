// s2.js — WHAT I'M MADE OF. An impossible night library whose books are glowing glyphs.
// Static layers are painted once (seeded); each frame composes them with pixel-snapped
// parallax, falling glyph-snow, twinkles and a mirror floor.
(function (g) {
  'use strict';
  const P = g.PX, C = P.C, L = P.LUT, G = g.GLY, TL = g.TL;
  const W = 480, H = 270, HY = 178, CX = 240;
  const MOON = { x: 318, y: 50 };
  let sky, far, midL, midR, nearL, nearR, built = false;
  const tw = { far: [], midL: [], midR: [], nearL: [], nearR: [] };
  let snow = [];

  // ---------- shelf painter -----------------------------------------------------
  const RAMPSEL = [['A', 0.66], ['T', 0.13], ['R', 0.12], ['V', 0.09]];
  function pickRamp(h) { let a = 0; for (const [k, p] of RAMPSEL) { a += p; if (h < a) return k; } return 'A'; }
  // o: {size:2|3|5|7, base, board, hi, lvl (0 far .. 2 near), seed, tw, lit}
  function shelves(b, x, y, w, h, o) {
    const size = o.size, gw = size === 2 ? 2 : size, gh = size === 2 ? 3 : size === 3 ? 5 : size === 5 ? 7 : 9;
    const padT = size >= 5 ? 2 : 1, boardH = size >= 5 ? 2 : 1;
    const pitchY = gh + padT + boardH, pitchX = gw + (size >= 5 ? 2 : 1);
    const set = size === 7 ? G.F7 : size === 5 ? G.F5 : size === 3 ? G.F3 : null;
    P.rect(b, x, y, w, h, o.base);
    const rows = Math.floor(h / pitchY), cols = Math.floor((w - 1) / pitchX);
    const x0 = x + ((w - cols * pitchX + 1) >> 1);
    const lit = o.lit === undefined ? 0.8 : o.lit;
    for (let r = 0; r < rows; r++) {
      const ry = y + r * pitchY;
      // board
      P.hl(b, x, ry + pitchY - boardH, w, o.board);
      if (boardH === 2) P.hl(b, x, ry + pitchY - 2, w, o.hi);
      let c = 0;
      while (c < cols) {
        // a "language section": same family + ramp for a run of glyphs
        const hs = P.hash(c, r, o.seed), run = 3 + Math.floor(P.hash(c, r, o.seed + 1) * 8);
        const fam = Math.floor(hs * 8), rk = pickRamp(P.hash(c, r, o.seed + 2)), rp = P.RAMP[rk];
        const baseI = (rk === 'A' ? 1 : rk === 'V' ? 0 : 1) + o.lvl * (rk === 'A' ? 1 : 0.5);
        for (let k = 0; k < run && c < cols; k++, c++) {
          const hh = P.hash(c * 7 + 3, r * 13 + 1, o.seed + 5);
          if (hh > lit) continue;                       // empty slot
          const hb = P.hash(c * 3 + 11, r * 5 + 7, o.seed + 9);
          let bi = Math.floor(baseI) + (hb < 0.52 ? 0 : hb < 0.86 ? 1 : hb < 0.97 ? 2 : 3);
          bi = Math.min(rp.length - 1, bi);
          const gx = x0 + c * pitchX, gy = ry + padT + (hb > 0.93 && size >= 3 ? -1 : 0);
          let gl;
          if (set) { const fs = set[fam]; gl = fs[Math.floor(P.hash(c, r, o.seed + 13) * fs.length)]; }
          else gl = G.G2[Math.floor(P.hash(c, r, o.seed + 13) * G.G2.length)];
          P.glyph(b, gl, gx, gy, rp[bi]);
          if (o.tw && hb > 0.5 && P.hash(c, r, o.seed + 21) < (o.twp || 0.12)) o.tw.push({ x: gx, y: gy, g: gl, c: rp[bi], up: rp[Math.min(rp.length - 1, bi + 1)], dn: rp[Math.max(0, bi - 1)], ph: P.hash(c, r, o.seed + 22) });
        }
        if (P.hash(c, r, o.seed + 30) < 0.25) c += 1 + Math.floor(P.hash(c, r, o.seed + 31) * 2); // gap between sections
      }
    }
    // plinth below last full row
    const used = rows * pitchY;
    if (h - used > 0) P.rect(b, x, y + used, w, h - used, o.board);
  }
  function pilaster(b, x, y, w, h, o) {
    P.rect(b, x, y, w, h, o.body);
    P.vl(b, x, y, h, o.sh); P.vl(b, x + w - 1, y, h, o.hi);
    if (w >= 5) for (let yy = y + 6; yy < y + h - 6; yy += 2) P.px(b, x + (w >> 1), yy, o.sh);
    // capital + base
    P.rect(b, x - 1, y, w + 2, 2, o.hi); P.hl(b, x - 1, y + 2, w + 2, o.sh);
    P.rect(b, x - 1, y + h - 3, w + 2, 3, o.body); P.hl(b, x - 1, y + h - 3, w + 2, o.hi);
  }
  function cornice(b, x, y, w, o, big) {
    P.rect(b, x - 2, y - (big ? 5 : 3), w + 4, big ? 5 : 3, o.body);
    P.hl(b, x - 2, y - (big ? 5 : 3), w + 4, o.hi);
    P.hl(b, x - 2, y - 1, w + 4, o.sh);
    if (big) for (let xx = x - 1; xx < x + w + 1; xx += 3) P.px(b, xx, y - 3, o.sh); // dentils
  }
  // side-view stair; dir = +1 climbs to the right, -1 to the left. inv = hanging upside-down
  function stair(b, x0, y0, n, dir, o) {
    const tw_ = o.tread || 3, rise = 2, inv = o.inv ? -1 : 1, thick = o.thick || 4;
    for (let i = 0; i < n; i++) {
      const sx = dir > 0 ? x0 + i * tw_ : x0 - (i + 1) * tw_ + 1, sy = y0 - inv * i * rise;
      for (let k = 0; k < thick + rise; k++) P.hl(b, sx, sy + inv * k, tw_, k === 0 ? o.hi : k < thick + rise - 1 ? o.body : o.sh);
      if (!o.inv) P.px(b, dir > 0 ? sx : sx + tw_ - 1, sy + 1, o.sh);
      if (o.rail && i % 2 === 0) P.vl(b, sx + 1, inv > 0 ? sy - 6 : sy + 1, 6, o.rail);
    }
    if (o.rail) {
      const ax = dir > 0 ? x0 : x0 - tw_ + 1, bx = dir > 0 ? x0 + (n - 1) * tw_ : x0 - n * tw_ + 1;
      const ry = inv > 0 ? -7 : 7;
      P.line(b, ax + 1, y0 + ry, bx + 1, y0 - inv * (n - 1) * rise + ry, o.railHi || o.rail);
    }
  }
  function ladder(b, x, y, h, c, c2) {
    P.vl(b, x, y, h, c); P.vl(b, x + 4, y, h, c);
    for (let yy = y + 2; yy < y + h; yy += 3) P.hl(b, x + 1, yy, 3, c2);
  }
  function arch(b, cx, yb, w, h, c) { // carve an arched opening (transparent or colour)
    const r = w / 2;
    for (let y = yb - h; y < yb; y++) for (let x = Math.floor(cx - r); x < cx + r; x++) {
      const top = yb - h + r;
      if (y >= top || ((x + 0.5 - cx) * (x + 0.5 - cx) + (y + 0.5 - top) * (y + 0.5 - top) <= r * r)) P.px(b, x, y, c);
    }
  }

  // an arched passage: nested arches receding to a small warm light
  function tunnel(b, cx, yb, w, h, dir) {
    arch(b, cx, yb, w + 4, h + 2, C.N6); arch(b, cx, yb, w + 2, h + 1, C.N3); arch(b, cx, yb, w, h, C.N1);
    P.px(b, cx - 1, yb - h - 3, C.N7); P.px(b, cx, yb - h - 3, C.N7); P.rect(b, cx - 1, yb - h - 5, 2, 2, C.N5);
    let ww = w - 6, hh = h - 5, x = cx + dir * 2, k = 0;
    while (ww > 4) {
      arch(b, x, yb, ww, hh, k % 2 ? C.N1 : C.N2);
      if (k % 2 === 0) { arch(b, x, yb, ww - 2, hh - 1, C.N1); }
      ww -= 5; hh -= 6; x += dir * 2; k++;
    }
    P.rect(b, x - dir * 2 - 1, yb - 9, 2, 5, C.A4); P.px(b, x - dir * 2 - 1, yb - 8, C.A6); P.px(b, x - dir * 2, yb - 7, C.A6);
    P.dith(b, x - dir * 2 - 3, yb - 3, 6, 3, C.A1, 8);
    for (let i = 0; i < w - 2; i += 3) P.px(b, cx - (w >> 1) + 1 + i, yb - 1, C.N3);
  }

  // ---------- sky: gradient, stars, the shelf-ring, the open-book moon -----------
  function ringGeom(x, y) {
    const dx = x - 240, dy = y - 196;
    const rin = Math.sqrt((dx / 238) * (dx / 238) + (dy / 152) * (dy / 152));
    const rout = Math.sqrt((dx / 268) * (dx / 268) + (dy / 186) * (dy / 186));
    if (rin < 1 || rout > 1) return null;
    return { rho: (rin - 1) / ((rin - 1) + (1 - rout)), th: Math.atan2(dy / 169, dx / 253) };
  }
  function buildSky() {
    sky = P.mk(W, HY, C.N1);
    P.vgrad(sky, 0, 0, W, HY, [C.N1, C.N1, C.N2, C.N2, C.N3, C.N3, C.N4], 1);
    // violet haze low on the horizon
    P.shade(sky, 0, HY - 34, W, HY, (x, y, c) => {
      const f = (y - (HY - 34)) / 34;
      return (P.bay(x, y) + 0.5) / 16 < f * 0.75 ? (f > 0.7 && P.bay(x + 2, y + 1) < 5 ? C.V1 : C.V0) : -1;
    });
    const r = P.rng(201);
    // constellations: dim glyphs written in the sky itself
    for (let i = 0; i < 26; i++) {
      const gl = r.pick(G.G5), x = r.i(6, W - 12), y = r.i(4, 120);
      P.glyph(sky, gl, x, y, y < 60 ? C.N3 : C.N4);
    }
    for (let i = 0; i < 230; i++) {
      const x = r.i(0, W - 1), y = r.i(0, 150), h = r();
      P.px(sky, x, y, h < 0.5 ? C.N6 : h < 0.85 ? C.N7 : h < 0.96 ? C.N9 : C.N11);
    }
    for (let i = 0; i < 9; i++) { // a few cross stars
      const x = r.i(10, W - 10), y = r.i(6, 110);
      P.px(sky, x, y, C.N11); P.px(sky, x - 1, y, C.N8); P.px(sky, x + 1, y, C.N8); P.px(sky, x, y - 1, C.N8); P.px(sky, x, y + 1, C.N8);
    }
    // moon glow (bands)
    P.glow(sky, MOON.x, MOON.y + 2, [50, 74], [L.up2, L.up1], { dw: 14, sq: 0.72 });
    // --- the ring: shelves that curve up into the sky and over ---
    P.shade(sky, 0, 0, W, HY, (x, y, c) => {
      const q = ringGeom(x, y); if (!q) return -1;
      const far_ = Math.sin(Math.max(0, -q.th)); // 1 at the zenith
      const body = far_ > 0.85 ? (P.bay(x, y) < 8 ? C.N3 : C.N2) : C.N3;
      return body;
    });
    // shelf lines + bay ribs by detecting cell changes
    P.shade(sky, 0, 0, W, HY, (x, y, c) => {
      const q = ringGeom(x, y); if (!q) return -1;
      const qd = ringGeom(x, y + 1), qr = ringGeom(x + 1, y);
      const far_ = Math.sin(Math.max(0, -q.th));
      const lineC = C.N4, edgeC = far_ > 0.8 ? C.N5 : C.N6;
      if (!qd) return edgeC;                               // inner (lower) edge catches moonlight
      if (!ringGeom(x, y - 1)) return C.N4;
      if (Math.floor(q.rho * 4) !== Math.floor(qd.rho * 4)) return lineC;
      if (qr && Math.floor(q.th * 28) !== Math.floor(qr.th * 28)) return lineC;
      return -1;
    });
    // glyph-books along each ring shelf
    for (let row = 0; row < 4; row++) {
      const rho = (row + 0.5) / 4;
      const rx = 238 + (268 - 238) * rho, ry = 152 + (186 - 152) * rho;
      let th = -Math.PI + 0.02;
      while (th < -0.02) {
        const x = Math.round(240 + rx * Math.cos(th)) - 1, y = Math.round(196 + ry * Math.sin(th)) - 2;
        const step = 4.6 / Math.hypot(rx * Math.sin(th), ry * Math.cos(th));
        const h = P.hash(Math.round(th * 1000), row, 77), far_ = Math.sin(-th);
        if (y < HY - 6 && h < 0.72) {
          const q0 = ringGeom(x, y), q1 = ringGeom(x + 2, y + 4);
          if (q0 && q1 && Math.floor(q0.rho * 4) === Math.floor(q1.rho * 4) && Math.floor(q0.th * 28) === Math.floor(q1.th * 28)) {
            const hh = P.hash(Math.round(th * 1000), row, 78);
            const rk = pickRamp(P.hash(Math.floor(th * 9), row, 79)), rp = P.RAMP[rk];
            let bi = (rk === 'A' ? 2 : 1) + (hh < 0.6 ? 0 : hh < 0.92 ? 1 : 2) - (far_ > 0.85 ? 1 : 0);
            bi = P.clamp(bi, 0, rp.length - 1);
            const gl = G.G3[Math.floor(P.hash(Math.round(th * 1000), row, 80) * G.G3.length)];
            P.glyph(sky, gl, x, y, rp[bi]);
          }
        }
        th += step;
      }
    }
  }
  function drawBookMoon(b, cx, cy) {
    const r = P.rng(314), HW = 38;
    // ribbon bookmark trailing down into the sky
    let rx = cx + 1;
    for (let i = 0; i < 46; i++) {
      const y = cy + 16 + i; rx = cx + 1 + Math.round(Math.sin(i * 0.16) * 3 + i * 0.08);
      P.px(b, rx, y, i > 38 && P.bay(rx, y) < 8 ? C.R1 : C.R2); P.px(b, rx + 1, y, i > 30 ? C.R1 : C.R3);
    }
    P.px(b, rx, cy + 62, C.R2); P.px(b, rx + 2, cy + 62, C.R1);
    for (let side = -1; side <= 1; side += 2) {
      for (let dx = 0; dx <= HW; dx++) {
        const x = side < 0 ? cx - 1 - dx : cx + 1 + dx, f = dx / HW;
        const bow = Math.sin(Math.PI * Math.pow(f, 0.85));
        const top = Math.round(cy - 15 - 7 * bow - dx * 0.10 + (f > 0.9 ? (f - 0.9) * 30 : 0));
        const bot = Math.round(cy + 17 - 6 * bow - dx * 0.16);
        // page stack under the page + cover
        for (let k = 0; k < 4; k++) P.px(b, x, bot + 1 + k, k === 3 ? C.V2 : (k & 1 ? C.N8 : C.N9));
        if (dx === HW) { P.vl(b, x + side, top + 2, bot - top + 2, C.N8); P.vl(b, x + side * 2, top + 4, bot - top, C.V2); }
        for (let y = top; y <= bot; y++) {
          let c = C.N11;
          if (dx < 2) c = C.N8; else if (dx < 4) c = C.N9; else if (dx < 7) c = C.N10;
          else if (f > 0.93) c = C.N10;
          else if (side < 0 && f > 0.55 && P.bay(x, y) < (f - 0.55) * 20) c = C.N10; // left page turns away from light
          if (y === top) c = dx < 4 ? C.N9 : C.N11;
          P.px(b, x, y, c);
        }
      }
      // lines of unreadable writing following the page curve
      for (let ln = 0; ln < 6; ln++) {
        let dx = 6 + r.i(0, 2);
        const indent = ln === 0 && side < 0 ? 5 : 0; dx += indent;
        const endDx = HW - 4 - (ln === 5 ? r.i(8, 16) : r.i(0, 3));
        while (dx < endDx) {
          const wl = r.i(2, 6);
          for (let k = 0; k < wl && dx < endDx; k++, dx++) {
            const x = side < 0 ? cx - 1 - dx : cx + 1 + dx, f = dx / HW, bow = Math.sin(Math.PI * Math.pow(f, 0.85));
            const y = Math.round(cy - 10 + ln * 4.4 - 6.6 * bow - dx * 0.12);
            P.px(b, x, y, (k + ln) % 3 === 0 ? C.N7 : C.N8);
            if (r.chance(0.3)) P.px(b, x, y - 1, C.N9);
          }
          dx += r.i(1, 2);
        }
      }
      // an illuminated initial block on the right page
      if (side > 0) { P.rect(b, cx + 30, cy - 4, 6, 7, C.R3); P.rect(b, cx + 31, cy - 3, 4, 5, C.A5); P.px(b, cx + 32, cy - 1, C.R2); P.px(b, cx + 33, cy, C.R2); }
    }
    P.vl(b, cx, cy - 14, 34, C.N7); P.vl(b, cx - 1, cy - 15, 34, C.N8);
    // a few loose pages drifting off like birds
    const pg = [[-58, -20], [-70, -8], [56, -26], [70, -14], [-49, -32]];
    pg.forEach(([dx, dy], i) => {
      const x = cx + dx, y = cy + dy;
      P.hl(b, x, y, 4, C.N10); P.hl(b, x + 1, y + 1, 4, C.N9); if (i % 2) P.px(b, x + 4, y - 1, C.N10); else P.px(b, x - 1, y + 1, C.N8);
    });
  }

  // ---------- far towers -----------------------------------------------------------
  function buildFar() {
    far = P.mk(W, HY);
    const r = P.rng(402);
    const o = { size: 2, base: C.N3, board: C.N4, hi: C.N4, lvl: 0, lit: 0.62, tw: tw.far, twp: 0.05 };
    const col = { body: C.N3, sh: C.N2, hi: C.N4 };
    // very distant spires down the aisle
    for (let i = 0; i < 9; i++) {
      const x = 206 + i * 8 + r.i(-2, 2), h = 10 + r.i(0, 26) - Math.abs(i - 4) * 1;
      if (Math.abs(x - 240) < 7) continue;
      P.rect(far, x, HY - h, 5, h, C.N3); P.px(far, x + 2, HY - h - 1, C.N3); P.px(far, x + 2, HY - h - 2, C.N3);
      for (let y = HY - h + 2; y < HY - 1; y += 3) if (r.chance(0.6)) P.px(far, x + 1 + r.i(0, 2), y, r.chance(0.3) ? C.A3 : C.A2);
    }
    const spec = [];
    let x = -6;
    while (x < W) {
      const dd0 = Math.abs(x + 10 - CX);
      const w = dd0 < 60 ? r.i(9, 13) : dd0 < 110 ? r.i(14, 22) : r.i(22, 40);
      const cxm = x + w / 2, dist = Math.abs(cxm - CX);
      if (dist < 13) { x += 4; continue; }
      let top = Math.round(150 - Math.pow(dist / 240, 0.9) * 122 + r.i(-12, 12));
      if (cxm > 264 && cxm < 372) top = Math.max(top, 104 + r.i(0, 14)); // keep the moon clear
      top = P.clamp(top, 26, 156);
      spec.push({ x, w, top });
      x += w + (dist < 60 ? r.i(0, 2) : r.i(-4, 8));
    }
    spec.forEach((s, i) => {
      o.seed = 500 + i * 17;
      const h = HY - s.top;
      shelves(far, s.x, s.top, s.w, h, o);
      P.vl(far, s.x, s.top, h, C.N2); P.vl(far, s.x + s.w - 1, s.top, h, C.N5);
      cornice(far, s.x, s.top, s.w, col, false);
      const kind = r.i(0, 4);
      if (kind === 0) { // stepped crown
        P.rect(far, s.x + 3, s.top - 7, s.w - 6, 4, C.N3); P.hl(far, s.x + 3, s.top - 7, s.w - 6, C.N4);
        P.rect(far, s.x + 7, s.top - 11, s.w - 14, 4, C.N3); P.hl(far, s.x + 7, s.top - 11, s.w - 14, C.N4);
      } else if (kind === 1) { // dome
        P.ell(far, s.x + s.w / 2 - 0.5, s.top - 3, s.w / 2 - 3, 8, C.N3);
        P.rect(far, s.x - 2, s.top - 3, s.w + 4, 3, C.N3); P.hl(far, s.x - 2, s.top - 3, s.w + 4, C.N4);
        P.vl(far, Math.round(s.x + s.w / 2), s.top - 16, 6, C.N4);
      } else if (kind === 2) { // broken top with a floating fragment above
        const fw = Math.min(16, s.w - 8), fx = s.x + r.i(2, s.w - fw - 2), fy = s.top - r.i(14, 24);
        const o2 = Object.assign({}, o, { seed: o.seed + 3 });
        shelves(far, fx, fy, fw, 10, o2);
        P.hl(far, fx - 1, fy - 1, fw + 2, C.N4); P.hl(far, fx, fy + 10, fw, C.N2);
        for (let k = 0; k < 5; k++) P.px(far, fx + r.i(1, fw - 2), fy + 12 + r.i(0, s.top - fy - 16), C.A2);
      } else if (kind === 3) { // arch through the base
        arch(far, Math.round(s.x + s.w / 2), HY, Math.min(12, s.w - 8), 18, C.N1);
        const ax = Math.round(s.x + s.w / 2); P.px(far, ax, HY - 6, C.A3); P.px(far, ax, HY - 7, C.A5);
      }
    });
    // the mirror, tiny, at the end of the aisle (where the walk is heading): arched, gilt, catching the moon
    const mx = CX, my = HY;
    P.rect(far, mx - 4, my - 15, 9, 15, C.A3); P.rect(far, mx - 3, my - 17, 7, 2, C.A3); P.rect(far, mx - 2, my - 18, 5, 1, C.A3);
    P.vl(far, mx + 4, my - 15, 15, C.A5); P.px(far, mx + 3, my - 17, C.A5); P.px(far, mx, my - 20, C.A5); P.px(far, mx, my - 19, C.A4);
    P.vl(far, mx - 4, my - 15, 14, C.A2);
    P.rect(far, mx - 2, my - 15, 5, 13, C.N2); P.rect(far, mx - 1, my - 16, 3, 1, C.N2);
    P.vl(far, mx - 1, my - 14, 6, C.N8); P.px(far, mx, my - 13, C.N11); P.px(far, mx + 1, my - 5, C.N6); P.px(far, mx, my - 7, C.N5);
    P.hl(far, mx - 5, my - 1, 11, C.A2); P.px(far, mx - 5, my - 1, C.A1); P.px(far, mx + 5, my - 1, C.A4);
  }

  // ---------- mid walls ---------------------------------------------------------------
  function buildMid() {
    midL = P.mk(W, HY); midR = P.mk(W, HY);
    const col = { body: C.N4, sh: C.N3, hi: C.N6 };
    const colD = { body: C.N4, sh: C.N2, hi: C.N5 };
    const mkBay = (b, x, w, top, seed, twl, mirror) => {
      const o = { size: 3, base: C.N2, board: C.N4, hi: C.N5, lvl: 1, lit: 0.8, seed, tw: twl, twp: 0.1 };
      shelves(b, x + 4, top, w - 8, HY - top - 4, o);
      P.rect(b, x, HY - 4, w, 4, C.N4); P.hl(b, x, HY - 4, w, C.N5);
      pilaster(b, x, top, 4, HY - top, mirror ? col : col);
      pilaster(b, x + w - 4, top, 4, HY - top, col);
      cornice(b, x, top, w, col, true);
    };
    // LEFT: three bays stepping down toward the aisle
    mkBay(midL, 26, 66, 26, 611, tw.midL);
    mkBay(midL, 94, 58, 60, 622, tw.midL);
    mkBay(midL, 154, 48, 98, 633, tw.midL);
    // pediment + finial on the tall bay
    P.poly(midL, [[30, 21], [59, 8], [88, 21]], C.N4); P.line(midL, 30, 20, 59, 8, C.N6); P.line(midL, 59, 8, 88, 20, C.N5);
    P.disc(midL, 59, 16, 2.5, C.N2); P.px(midL, 59, 16, C.A4); P.vl(midL, 59, 2, 6, C.N5); P.px(midL, 59, 1, C.A5);
    // arch passage through the middle bay, with a tiny lamp-less glow of glyphs beyond
    tunnel(midL, 123, HY - 4, 26, 44, 1);
    // rolling ladder on the tall bay
    ladder(midL, 70, 62, HY - 66, C.N6, C.N5);
    // the stair that goes nowhere: up across the shelves, turn, and stop in mid-air
    const st = { hi: C.N8, body: C.N5, sh: C.N3, rail: C.N6, railHi: C.N7, tread: 3 };
    stair(midL, 199, HY - 1, 30, -1, st);          // climbs left: 90px over, 60 up
    P.rect(midL, 96, HY - 62, 14, 5, C.N5); P.hl(midL, 96, HY - 62, 14, C.N8); P.hl(midL, 96, HY - 58, 14, C.N3); // landing
    stair(midL, 110, HY - 64, 22, 1, st);           // turns back, climbs right into the air
    // the last step: a doorframe with nothing in it
    const dx = 110 + 22 * 3, dy = HY - 64 - 21 * 2;
    P.rect(midL, dx - 1, dy, 12, 4, C.N5); P.hl(midL, dx - 1, dy, 12, C.N8); P.hl(midL, dx - 1, dy + 3, 12, C.N3);
    P.vl(midL, dx + 1, dy - 18, 18, C.N6); P.vl(midL, dx + 9, dy - 18, 18, C.N7); P.hl(midL, dx + 1, dy - 19, 9, C.N7);
    P.hl(midL, dx, dy - 20, 11, C.N6); P.px(midL, dx + 5, dy - 21, C.A4);
    // hanging stair: comes down out of the sky, upside-down, and ends
    const hs = { hi: C.N3, body: C.N4, sh: C.N6, rail: C.N5, railHi: C.N5, tread: 3, inv: true };
    stair(midL, 150, 0, 20, 1, hs);
    P.rect(midL, 210, 38, 10, 4, C.N4); P.hl(midL, 210, 41, 10, C.N6);

    // RIGHT: mirrored rhythm but different proportions
    mkBay(midR, 280, 46, 104, 644, tw.midR);
    mkBay(midR, 328, 62, 82, 655, tw.midR);
    mkBay(midR, 392, 64, 34, 666, tw.midR);
    // round window (an "oculus") in the tall right bay showing sky
    P.disc(midR, 424, 60, 11, C.N6); P.disc(midR, 424, 60, 9.4, P.TR);
    P.vl(midR, 424, 51, 19, C.N5); P.hl(midR, 415, 60, 19, C.N5);
    // crown of the tall right bay: a broken arch
    for (let a = 0; a < 40; a++) { const th = Math.PI * (1 - a / 52); P.rect(midR, Math.round(424 + Math.cos(th) * 30), Math.round(29 - Math.sin(th) * 20), 2, 3, a % 9 < 8 ? C.N4 : C.N6); }
    tunnel(midR, 359, HY - 4, 30, 38, -1);
    ladder(midR, 300, 120, HY - 124, C.N6, C.N5);
    // a short stair on the right that climbs into the oculus
    stair(midR, 372, HY - 60, 14, 1, { hi: C.N8, body: C.N5, sh: C.N3, rail: C.N6, railHi: C.N7, tread: 3 });
    // banners (rose / teal) hanging from cornices: a surreal accent, kept few
    const banner = (b, x, y, h, c1, c2) => { P.rect(b, x, y, 5, h, c1); P.vl(b, x, y, h, c2); P.px(b, x + 2, y + h, c1); P.px(b, x + 1, y + h, c1); P.px(b, x + 3, y + h, c1); P.px(b, x + 2, y + h + 1, c1); P.glyph(b, G.G3[7], x + 1, y + 3, c2); };
    banner(midL, 91, 62, 22, C.R1, C.R2); banner(midR, 389, 36, 26, C.T1, C.T2);
  }

  // ---------- near frames -----------------------------------------------------------------
  function buildNear() {
    nearL = P.mk(120, H); nearR = P.mk(120, H);
    const mk = (b, mirror, seed, twl) => {
      // drawn as a left-hand piece; mirrored for the right
      const o = { size: 7, base: C.N1, board: C.N2, hi: C.N4, lvl: 1, lit: 0.8, seed, tw: null };
      const t = P.mk(120, H);
      shelves(t, 0, 0, 40, HY + 2, o);
      const o5 = { size: 5, base: C.N1, board: C.N2, hi: C.N4, lvl: 1, lit: 0.8, seed: seed + 50, tw: null };
      shelves(t, 44, 22, 14, HY - 22 + 2, o5);
      // column between
      P.rect(t, 38, 0, 7, HY + 2, C.N3); P.vl(t, 38, 0, HY + 2, C.N2); P.vl(t, 44, 0, HY + 2, C.N5); P.vl(t, 41, 0, HY + 2, C.N2);
      for (let y = 9; y < HY; y += 30) { P.rect(t, 37, y, 9, 3, C.N4); P.hl(t, 37, y, 9, C.N6); }
      // inner end: fluted column with capital
      P.rect(t, 58, 14, 8, HY - 12, C.N3); P.vl(t, 58, 14, HY - 12, C.N2); P.vl(t, 65, 14, HY - 12, C.N6); P.vl(t, 61, 20, HY - 24, C.N2); P.vl(t, 63, 20, HY - 24, C.N4);
      P.rect(t, 56, 14, 12, 4, C.N4); P.hl(t, 56, 14, 12, C.N6); P.rect(t, 55, 10, 14, 4, C.N3); P.hl(t, 55, 10, 14, C.N5);
      P.rect(t, 56, HY - 4, 12, 6, C.N4); P.hl(t, 56, HY - 4, 12, C.N6);
      // an urn of loose glyphs on the capital
      P.rect(t, 59, 4, 6, 6, C.N4); P.hl(t, 58, 4, 8, C.N6); P.px(t, 61, 2, C.A5); P.px(t, 63, 1, C.A4); P.px(t, 60, 0, C.A3);
      P.rect(t, 42, 18, 16, 4, C.N3); P.hl(t, 42, 18, 16, C.N5);
      if (mirror) P.blit(b, t, 0, 0, { fx: true }); else P.blit(b, t, 0, 0);
    };
    mk(nearL, false, 811); mk(nearR, true, 822);
  }

  // ---------- snow ----------------------------------------------------------------------
  function buildSnow() {
    const r = P.rng(909);
    snow = [];
    const add = (n, depth) => {
      for (let i = 0; i < n; i++) {
        const land = depth === 0 ? HY + r.i(1, 14) : depth === 1 ? HY + r.i(12, 46) : HY + r.i(48, 88);
        const sp = depth === 0 ? r.r(9, 13) : depth === 1 ? r.r(14, 20) : r.r(22, 30);
        const set = depth === 0 ? G.G2 : depth === 1 ? G.G3 : G.G5;
        const rk = pickRamp(r()), rp = P.RAMP[rk];
        const bi = Math.min(rp.length - 1, (rk === 'A' ? 3 : 2) + depth + (r.chance(0.25) ? 1 : 0));
        snow.push({
          x: r.i(-20, W + 20), land, sp, depth, g: r.pick(set), c: rp[bi], dn: rp[Math.max(0, bi - 2)], dn2: rp[Math.max(0, bi - 3)],
          t0: r.r(-16, 20), sw: r.r(2, 5), fr: r.r(0.25, 0.6), ph: r.r(0, 6.28)
        });
      }
    };
    add(110, 0); add(64, 1); add(12, 2);
  }
  // u = seconds since the snow clock started; par = outward parallax per depth
  function drawSnow(b, u, par, floorOnly, clip) {
    for (const s of snow) {
      const fallH = s.land + 20, tFall = fallH / s.sp, tt = u - s.t0;
      if (tt < 0) continue;
      const k = 1 + par[s.depth];
      const X = x => Math.round(CX + (x - CX) * k);
      const gl = s.g;
      if (tt < tFall) {
        if (floorOnly) continue;
        const y = Math.round(-20 + tt * s.sp), x = X(s.x) + Math.round(Math.sin(tt * s.fr * 6.28 + s.ph) * s.sw);
        if (clip && (x < clip[0] || x > clip[2] || y < clip[1] || y > clip[3])) continue;
        // reflection first (mirror about the landing line)
        const ry = 2 * s.land - y - gl.h;
        if (ry < H && ry > HY) drawFlipped(b, gl, x, ry, s.dn2);
        P.glyph(b, gl, x, y - gl.h, s.c);
      } else {
        // settled: squashed flat on the mirror, dimming over a few seconds
        const age = tt - tFall, x = X(s.x) + Math.round(Math.sin(tFall * s.fr * 6.28 + s.ph) * s.sw);
        const y = Math.round(HY + (s.land - HY) * k);
        if (y >= H) continue;
        if (clip && (x < clip[0] || x > clip[2] || y < clip[1] || y > clip[3])) continue;
        const c = age < 0.5 ? s.c : age < 3 ? s.dn : s.dn2;
        for (let yy = 0, oy = 0; yy < gl.h; yy += 2, oy++) for (let xx = 0; xx < gl.w; xx++) if (gl.b[yy * gl.w + xx]) P.px(b, x + xx, y - ((gl.h + 1) >> 1) + oy, c);
        if (age < 0.5) { P.px(b, x - 2, y, s.dn); P.px(b, x + gl.w + 1, y, s.dn); } // a tiny ripple ring on touch-down
        else if (age < 1.0) { P.px(b, x - 4, y, s.dn2); P.px(b, x + gl.w + 3, y, s.dn2); }
      }
    }
  }
  function drawFlipped(b, gl, x, y, c) {
    for (let yy = 0; yy < gl.h; yy++) for (let xx = 0; xx < gl.w; xx++) if (gl.b[(gl.h - 1 - yy) * gl.w + xx]) P.px(b, x + xx, y + yy, c);
  }
  function twinkle(b, list, ox, oy, t) {
    for (const q of list) {
      const s = Math.sin(t * (0.5 + q.ph * 0.9) + q.ph * 40);
      if (s > 0.55) P.glyph(b, q.g, q.x + ox, q.y + oy, q.up);
      else if (s < -0.8) P.glyph(b, q.g, q.x + ox, q.y + oy, q.dn);
    }
  }
  // mirror floor: flip rows above the horizon, darken, with a rare 1px shimmer
  function reflect(b, t, deep) {
    const d = b.d, Lw = L.dn1, Lw2 = L.dn2;
    for (let k = 0; k < H - HY; k++) {
      const sy = HY - 1 - k, dy = HY + k;
      if (sy < 0) break;
      const ph = Math.sin(k * 0.83 - t * 1.1) + Math.sin(k * 0.31 + t * 0.7);
      const off = k > 3 && ph > 1.55 ? 1 : k > 3 && ph < -1.6 ? -1 : 0;
      const f = k / (H - HY);
      for (let x = 0; x < W; x++) {
        const sx = P.clamp(x + off, 0, W - 1);
        const c = d[sy * W + sx];
        d[dy * W + x] = (k >= 40 || (k >= 36 && P.bay(x, dy) < (k - 35) * 4) || deep) ? Lw2[c] : Lw[c];
      }
    }
    // the seam between world and reflection: a thin broken line of light
    for (let x = 0; x < W; x++) { if (P.hash(x >> 3, 3, 5) < 0.8) d[HY * W + x] = C.N5; }
    // long faint sheen lines: the floor is glass
    for (let i = 0; i < 9; i++) {
      const y = HY + 6 + i * 9 + (i * i) % 5, x0 = Math.floor(P.hash(i, 1, 44) * 380), len = 30 + Math.floor(P.hash(i, 2, 44) * 90);
      for (let x = x0; x < x0 + len && x < W; x++) { const j = y * W + x; if (((x + i) & 7) !== 7) d[j] = L.up1[d[j]]; }
    }
  }

  // the moon turns a page (once, mid-scene) and lets a flurry of glyphs go
  const TURN = [9.2, 10.3];
  function pageTurn(b, t) {
    const k = P.prog(t, TURN[0], TURN[1]);
    if (k > 0 && k < 1) {
      const a = k * Math.PI, c = Math.cos(a), lift = Math.sin(a);       // page edge swings right -> up -> left
      const cx = MOON.x, cy = MOON.y;
      for (let d = 2; d <= 36; d++) {
        const f = d / 36, x = Math.round(cx + c * d), bow = Math.sin(Math.PI * Math.pow(f, 0.85));
        const top = Math.round(cy - 15 - 7 * bow * Math.abs(c) - lift * (4 + f * 9)), bot = Math.round(cy + 17 - 6 * bow * Math.abs(c) - lift * (2 + f * 5));
        for (let y = top; y <= bot; y++) P.px(b, x, y, y === top || d === 36 ? C.N9 : (lift > 0.6 ? C.N10 : C.N11));
        if (d > 5 && d < 33) for (let ln = 0; ln < 6; ln++) { const y = Math.round(top + 5 + ln * (bot - top - 9) / 5.4); if ((d * 5 + ln * 7) % 11 < 8 && !(ln === 5 && d > 20)) P.px(b, x, y, C.N8); }
      }
    }
    // flurry
    for (let i = 0; i < 26; i++) {
      const t0 = TURN[0] + 0.25 + P.hash(i, 1, 510) * 0.7, tt = t - t0;
      if (tt < 0 || tt > 7) continue;
      const vx = (P.hash(i, 2, 510) - 0.5) * 34, x = Math.round(MOON.x + (P.hash(i, 3, 510) - 0.5) * 50 + vx * Math.min(tt, 2.5) * 0.5 + Math.sin(tt * 1.7 + i) * 3);
      const y = Math.round(MOON.y - 6 + tt * (12 + P.hash(i, 4, 510) * 9) + tt * tt * 1.2);
      if (y > HY - 8) continue;
      const gl = G.G3[Math.floor(P.hash(i, 5, 510) * G.G3.length)];
      P.glyph(b, gl, x, y, tt < 0.5 ? C.N11 : tt < 1.2 ? C.A7 : tt < 2.4 ? C.A6 : C.A5);
    }
  }
  function init() {
    if (built) return; built = true;
    buildSky(); buildFar(); buildMid(); buildNear(); buildSnow();
  }
  // drift u: 0..1 over the scene (and beyond for the mirror scene)
  function render(b, t, opt) {
    init(); opt = opt || {};
    const ts = t - TL.s2 + 2.0;                 // scene clock (starts before the door opens)
    const u = opt.u !== undefined ? opt.u : P.clamp(ts / 12.5, 0, 1.2);
    const e = u * (0.55 + 0.45 * u);          // gentle acceleration, like walking
    const dF = Math.round(e * 7), dM = Math.round(e * 30), dN = Math.round(e * 70);
    P.rect(b, 0, HY, W, H - HY, C.N1);
    P.blit(b, sky, 0, 0);
    if (opt.dimLayers) P.lutRect(b, 0, 0, W, HY, L.dn1);
    drawBookMoon(b, MOON.x + (opt.moonDx || 0), MOON.y + (opt.moonDy || 0));
    // loose pages crossing the sky like birds
    for (let i = 0; i < 5; i++) {
      const sp = 5 + i * 1.7, x = Math.round(((P.hash(i, 1, 300) * 560 + t * sp) % 560) - 40), y = Math.round(18 + P.hash(i, 2, 300) * 70 + Math.sin(t * 0.7 + i * 2) * 3);
      const fl = Math.floor(t * 3 + i * 0.37) % 2;
      if (y < 4) continue;
      if (fl) { P.px(b, x, y, C.N9); P.px(b, x + 1, y + 1, C.N10); P.px(b, x + 2, y + 1, C.N10); P.px(b, x + 3, y + 1, C.N10); P.px(b, x + 4, y, C.N9); }
      else { P.px(b, x, y + 2, C.N8); P.px(b, x + 1, y + 1, C.N10); P.px(b, x + 2, y + 1, C.N10); P.px(b, x + 3, y + 1, C.N10); P.px(b, x + 4, y + 2, C.N8); }
    }
    // far layer split around the aisle so it too breathes outward
    const LD = opt.dimLayers ? L.dn1 : undefined;
    P.blit(b, far, -dF, 0, { sx: 0, sw: 232, lut: LD }); P.blit(b, far, 248 + dF, 0, { sx: 248, sw: 232, lut: LD }); P.blit(b, far, 232, 0, { sx: 232, sw: 16, lut: LD });
    if (!LD) { twinkle(b, tw.far.filter(q => q.x < 232), -dF, 0, t); twinkle(b, tw.far.filter(q => q.x >= 248), dF, 0, t); }
    if (!opt.noMid) {
      if (LD) { P.blit(b, midL, -dM, 0, { lut: LD }); P.blit(b, midR, dM, 0, { lut: LD }); }
      else { P.layer(b, midL, -dM, 0); twinkle(b, tw.midL, -dM, 0, t); P.layer(b, midR, dM, 0); twinkle(b, tw.midR, dM, 0, t); }
    }
    if (!opt.noNear) {
      P.blit(b, nearL, -dN, 0, { sh: HY }); P.blit(b, nearR, W - 120 + dN, 0, { sh: HY });
    }
    if (opt.pre) opt.pre(b);
    pageTurn(b, t);
    reflect(b, t, false);
    drawSnow(b, t - TL.s2 + 14, [e * 0.02, e * 0.10, e * 0.24], false, null);
    if (!opt.noNear) { // near frames stand on the floor in front of everything
      P.blit(b, nearL, -dN, 0, { sy: 0, sh: HY + 2 }); P.blit(b, nearR, W - 120 + dN, 0, { sy: 0, sh: HY + 2 });
    }
    return { dF, dM, dN, e };
  }
  g.S2 = { drawBookMoon, init, render, reflect, drawSnow, shelves, pilaster, cornice, stair, arch, twinkle, HY, MOON, pickRamp, get snow() { return snow; } };
})(typeof window !== 'undefined' ? window : globalThis);
