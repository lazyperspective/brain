// glyphs.js — a large invented alphabet. Eight "script families" (stroke grammars)
// generate hundreds of abstract glyphs at 3 sizes. None are real letters: 3x5 shapes
// that collide with a Latin/digit pixel font are rejected, and every glyph needs
// at least two stroke elements plus an ornament.
(function (g) {
  'use strict';
  const P = g.PX;
  const LATIN35 = ['010101111101101', '110101110101110', '011100100100011', '110101101101110', '111100110100111', '111100110100100',
    '011100101101011', '101101111101101', '111010010010111', '001001001101010', '101101110101101', '100100100100111',
    '101111111101101', '110101101101101', '010101101101010', '111101101101111', '110101110100100', '110101110101101',
    '011100010001110', '111010010010010', '101101101101111', '101101101101010', '101101111111101', '101101010101101',
    '101101010010010', '111001010100111', '010110010010111', '111001111100111', '111001111001111', '101101111001001',
    '111100111001111', '111100111101111', '111001001001001', '111101111101111', '111101111001111', '010010010010010',
    '111101111101101', '100100100100100', '001001001001001', '111100100100100', '111001001001111', '111100100100111'];
  const BL = new Set(LATIN35);
  LATIN35.forEach(s => { let m = ''; for (let y = 0; y < 5; y++) m += s.substr(y * 3, 3).split('').reverse().join(''); BL.add(m); });

  function gen(w, h, fam, r) {
    const b = new Uint8Array(w * h);
    const S = (x, y) => { if (x >= 0 && y >= 0 && x < w && y < h) b[y * w + x] = 1; };
    const L = (x0, y0, x1, y1) => {
      let dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1, dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1, e = dx + dy;
      for (; ;) { S(x0, y0); if (x0 === x1 && y0 === y1) break; const e2 = 2 * e; if (e2 >= dy) { e += dy; x0 += sx; } if (e2 <= dx) { e += dx; y0 += sy; } }
    };
    const X = w - 1, Y = h - 1, mx = X >> 1, my = Y >> 1;
    const big = w >= 5;
    switch (fam) {
      case 0: { // rune: stem + branches
        const sx = r.pick([0, mx, X]);
        L(sx, r.i(0, 1), sx, Y - r.i(0, 1));
        const nb = r.i(1, big ? 3 : 2);
        for (let i = 0; i < nb; i++) {
          const y0 = r.i(0, Y), ox = sx === 0 ? X : sx === X ? 0 : r.pick([0, X]);
          L(sx, y0, ox, P.clamp(y0 + r.pick([-2, -1, 1, 2, 3]) * (big ? 1 : 1), 0, Y));
        }
        if (r.chance(0.6)) S(sx === 0 ? X : 0, r.pick([0, Y]));
        break;
      }
      case 1: { // box + stroke + dot
        const top = r.chance(0.5), bh = r.i(2, big ? 3 : 2), by = top ? 0 : Y - bh;
        const omit = r.i(0, 3);
        if (omit !== 0) L(0, by, X, by);
        if (omit !== 1) L(0, by + bh, X, by + bh);
        if (omit !== 2) L(0, by, 0, by + bh);
        if (omit !== 3) L(X, by, X, by + bh);
        const sx = r.pick([0, mx, X]);
        if (top) L(sx, by + bh, sx, Y); else L(sx, 0, sx, by);
        if (r.chance(0.5)) { const yy = top ? Y : 0; L(sx, yy, sx === X ? mx : X, yy); }
        if (big && r.chance(0.7)) S(mx, by + (bh >> 1) + (bh === 2 ? 1 : 0) - (bh === 2 ? 0 : 0));
        if (r.chance(0.4)) S(sx === 0 ? X : 0, top ? Y - 1 : 1);
        break;
      }
      case 2: { // head-bar with hanging strokes
        L(0, 0, X, 0);
        const n = r.i(1, big ? 3 : 2), used = {};
        for (let i = 0; i < n; i++) {
          let x = r.pick(big ? [0, mx, X, 1, X - 1] : [0, mx, X]); if (used[x]) continue; used[x] = 1;
          const len = r.i(2, Y - (r.chance(0.5) ? 0 : 2));
          L(x, 0, x, len);
          if (r.chance(0.55)) L(x, len, P.clamp(x + r.pick([-2, -1, 1, 2]), 0, X), len);
        }
        if (r.chance(0.5)) S(r.i(0, X), Y);
        if (big && r.chance(0.4)) L(mx - 1, my + 1, mx + 1, my + 1);
        break;
      }
      case 3: { // cursive: baseline, upturn, dots
        const by = Y - r.i(1, big ? 3 : 2);
        L(0, by, X, by);
        const e = r.chance(0.5) ? 0 : X;
        L(e, by, e, by - r.i(1, by > 2 ? 3 : 1));
        if (r.chance(0.6)) L(X - e, by, X - e, Y);
        const nd = r.i(1, 3);
        for (let i = 0; i < nd; i++) S(P.clamp(mx - 1 + i + (nd === 1 ? 1 : 0), 0, X), by < 3 ? Y : Math.max(0, by - 2 - (big && i === 1 ? 1 : 0)));
        if (big && r.chance(0.5)) { const lx = r.i(1, X - 2); L(lx, by - 2, lx + 1, by - 2); S(lx, by - 1); S(lx + 2 > X ? X : lx + 2, by - 1); }
        if (r.chance(0.4)) S(mx, Y);
        break;
      }
      case 4: { // ring with tail
        const rw = big ? r.i(3, Math.min(5, w)) : 3, rh = big ? r.i(3, 4) : 3;
        const rx = r.i(0, w - rw), ry = r.chance(0.5) ? 0 : h - rh;
        for (let x = 0; x < rw; x++) { S(rx + x, ry); S(rx + x, ry + rh - 1); }
        for (let y = 0; y < rh; y++) { S(rx, ry + y); S(rx + rw - 1, ry + y); }
        if (big && r.chance(0.6)) { b[ry * w + rx] = 0; b[(ry + rh - 1) * w + rx + rw - 1] = 0; }
        const tx = r.pick([rx, rx + rw - 1, rx + (rw >> 1)]);
        if (ry === 0) { L(tx, rh, tx, Y); if (r.chance(0.6)) L(tx, Y, P.clamp(tx + r.pick([-2, 2]), 0, X), Y - r.i(0, 1)); }
        else { L(tx, 0, tx, ry); if (r.chance(0.6)) L(tx, 0, P.clamp(tx + r.pick([-2, 2]), 0, X), r.i(0, 1)); }
        if (r.chance(0.5)) S(tx === 0 ? X : 0, ry === 0 ? Y - 1 : 1);
        break;
      }
      case 5: { // wedges / tally marks
        const vert = r.chance(0.5), n = big ? r.i(2, 3) : 2;
        for (let i = 0; i < n; i++) {
          if (vert) { const x = Math.round(i * X / (n - 1 || 1)); L(x, r.i(0, 2), x, Y - r.i(0, 2)); }
          else { const y = Math.round(i * Y / (n - 1 || 1)); L(r.i(0, 1), y, X - r.i(0, 1), y); }
        }
        if (vert) { const y = r.i(1, Y - 1); L(0, y, X, P.clamp(y + r.pick([-1, 0, 1]), 0, Y)); }
        else { const x = r.pick([0, mx, X]); L(x, 0, P.clamp(x + r.pick([-1, 0, 1]), 0, X), Y); }
        if (r.chance(0.6)) S(r.pick([0, X]), r.pick([0, Y]));
        if (big && r.chance(0.5)) { const y = r.i(1, Y - 1); S(mx, y); S(mx + (r.chance(0.5) ? 1 : -1), y + 1); }
        break;
      }
      case 6: { // zigzag through lattice points
        const n = r.i(3, big ? 5 : 4); let side = r.chance(0.5), py = 0, px = side ? 0 : X;
        for (let i = 1; i < n; i++) {
          side = !side;
          const ny = Math.round(i * Y / (n - 1)), nx = side ? r.pick([0, 0, mx]) : r.pick([X, X, mx]);
          L(px, py, nx, ny); px = nx; py = ny;
        }
        if (r.chance(0.6)) L(px, py, X - px, py);
        if (r.chance(0.7)) S(r.pick([0, X]), my + r.pick([-1, 1]));
        break;
      }
      default: { // mirrored ornament
        const hw = (w + 1) >> 1;
        const col = mx;
        L(col, r.i(0, 2), col, Y - r.i(0, 2));
        const k = r.i(2, big ? 4 : 2);
        for (let i = 0; i < k; i++) {
          const y = r.i(0, Y), len = r.i(1, hw - 1), up = r.pick([-1, 0, 0, 1]);
          for (let j = 1; j <= len; j++) { const yy = y + (j === len ? up : 0); S(col - j, yy); S(col + j, yy); }
        }
        if (r.chance(0.5)) { S(0, 0); S(X, 0); }
        if (r.chance(0.3)) { S(0, Y); S(X, Y); }
        break;
      }
    }
    return b;
  }

  function make(w, h, perFam, seed) {
    const r = P.rng(seed), out = [], seen = new Set();
    for (let fam = 0; fam < 8; fam++) {
      let made = 0, tries = 0;
      while (made < perFam && tries++ < perFam * 60) {
        const b = gen(w, h, fam, r);
        let n = 0, key = ''; for (let i = 0; i < b.length; i++) { n += b[i]; key += b[i]; }
        if (n < w * h * 0.26 || n > w * h * 0.62) continue;
        if (seen.has(key)) continue;
        if (w === 3 && h === 5 && BL.has(key)) continue;
        // need ink in at least 3 of 4 quadrant-ish rows/cols so nothing reads as a bare bar
        let cols = 0, rows = 0;
        for (let x = 0; x < w; x++) { let c = 0; for (let y = 0; y < h; y++) c += b[y * w + x]; if (c) cols++; }
        for (let y = 0; y < h; y++) { let c = 0; for (let x = 0; x < w; x++) c += b[y * w + x]; if (c) rows++; }
        if (cols < w - (w > 3 ? 1 : 0) || rows < h - 2) continue;
        seen.add(key);
        out.push({ w: w, h: h, b: b, fam: fam, n: n });
        made++;
      }
    }
    return out;
  }
  const G7 = make(7, 9, 36, 7001), G5 = make(5, 7, 40, 5001), G3 = make(3, 5, 22, 3001);
  // tiny 2x3 "far glyph" marks (all 2x3 patterns with 3-5 px that are not solid bars)
  const G2 = [];
  for (let m = 1; m < 64; m++) {
    let n = 0; for (let i = 0; i < 6; i++) n += (m >> i) & 1;
    if (n < 3 || n > 4) continue;
    const b = new Uint8Array(6); for (let i = 0; i < 6; i++) b[i] = (m >> i) & 1;
    if ((b[0] && b[2] && b[4] && !b[1] && !b[3] && !b[5]) || (b[1] && b[3] && b[5] && !b[0] && !b[2] && !b[4])) continue;
    G2.push({ w: 2, h: 3, b: b, fam: m & 7, n: n });
  }
  const byFam = set => { const o = []; for (let f = 0; f < 8; f++) { const s = set.filter(q => q.fam === f); o.push(s.length ? s : set); } return o; };
  g.GLY = { G7, G5, G3, G2, F7: byFam(G7), F5: byFam(G5), F3: byFam(G3) };
})(typeof window !== 'undefined' ? window : globalThis);
