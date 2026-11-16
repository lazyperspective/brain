/* STILL WARM — the hand.
 * The artist looks at the paper, compares it with the picture in their head,
 * picks one stick out of a small box, and makes one more stroke. Thousands of times.
 */
(function (g) {
'use strict';

function createPainter(E, Sc) {
  const { R, rr, PX, PY, PP, stroke, scratch, erase, TOOLS, curAt, cdist, hex, c01, sstep, sq, fbm, vnoise, mix3 } = E;
  const { HOR, GLOW, NEST, MOON, REG, regAt } = Sc;
  const CRAYON = TOOLS.CRAYON, PENCIL = TOOLS.PENCIL, DUST = TOOLS.DUST;
  const PAPER = E.PAPER;

  // ---------- the box (every colour has a name, because every stick was somebody's)
  const BOX = {
    lastBusIndigo: '#141a52', schoolInk: '#1c2f7c', tinTrunkCobalt: '#25509e', kiteString: '#2f7fae', peppermintDusk: '#5fb0b4',
    unripeGuava: '#c4cfaa', jaggeryLight: '#ffd596', papaya: '#ff9c70', roseSherbet: '#ee7288', periwinkle: '#565cb2',
    jacaranda: '#8672c4', bougainvillea: '#cc78b6', guavaPink: '#f5859c', peachSkin: '#ffb48e', butter: '#ffe4b0',
    lemonDrop: '#ffe066', newLeaf: '#b4d862', grass: '#86b85a', parrot: '#3f9466', pondGreen: '#1c6c60',
    wellWater: '#144d5a', deepTeal: '#123358', turquoiseBead: '#5cc0ae', sandalwood: '#c79a6a', terracotta: '#bf6a44',
    tamarind: '#7a3e50', aubergine: '#3c2852', inkPlum: '#221a3e', marigold: '#f7dc6a', turmeric: '#eda653',
    farHill: '#5b56a6', dusk: '#27408f', mauve: '#a476b6', paleSky: '#8088dc', seaGlass: '#6fa6cf', moth: '#fff1bd',
    moss: '#7d9a45', oldGold: '#c9a942', nightGreen: '#10304e', duskRose: '#c97cac', slate: '#45457f',
  };
  const C = {}; for (const k in BOX) C[k] = hex(BOX[k]);
  const set = (...n) => n.map(k => C[k]);
  const SKYS = set('lastBusIndigo', 'schoolInk', 'tinTrunkCobalt', 'kiteString', 'peppermintDusk', 'unripeGuava', 'jaggeryLight', 'papaya', 'roseSherbet', 'periwinkle', 'jacaranda', 'bougainvillea', 'dusk', 'mauve', 'duskRose', 'butter');
  const CLOUDS = set('periwinkle', 'jacaranda', 'bougainvillea', 'guavaPink', 'peachSkin', 'butter', 'roseSherbet', 'mauve', 'jaggeryLight', 'farHill');
  const HILLS = set('farHill', 'periwinkle', 'jacaranda', 'mauve', 'dusk', 'schoolInk', 'lastBusIndigo', 'duskRose', 'tinTrunkCobalt', 'slate');
  const WATERS = set('lastBusIndigo', 'schoolInk', 'tinTrunkCobalt', 'kiteString', 'peppermintDusk', 'unripeGuava', 'jaggeryLight', 'papaya', 'roseSherbet', 'periwinkle', 'jacaranda', 'dusk', 'mauve', 'farHill', 'butter');
  const GRASSES = set('lastBusIndigo', 'deepTeal', 'wellWater', 'pondGreen', 'parrot', 'grass', 'newLeaf', 'marigold', 'lemonDrop', 'butter', 'schoolInk', 'dusk', 'nightGreen', 'moss');
  const PATHS = set('slate', 'schoolInk', 'tamarind', 'sandalwood', 'jaggeryLight', 'butter', 'mauve', 'dusk', 'turmeric', 'farHill');
  const BARKS = set('inkPlum', 'aubergine', 'tamarind', 'terracotta', 'turmeric', 'jaggeryLight', 'dusk', 'schoolInk', 'sandalwood');
  const LEAVES = set('lastBusIndigo', 'nightGreen', 'wellWater', 'pondGreen', 'parrot', 'moss', 'oldGold', 'turmeric', 'marigold', 'schoolInk', 'dusk', 'deepTeal', 'jaggeryLight');
  const UNDERS = set('paleSky', 'seaGlass', 'turquoiseBead', 'newLeaf', 'lemonDrop', 'butter', 'moth', 'jaggeryLight', 'marigold', 'peachSkin');

  const tg = [0, 0, 0], tg0 = [0, 0, 0], cu = [0, 0, 0], tt = [0, 0, 0];
  function jit(c, a) { const k = (R() - 0.5) * a; return [c[0] + k + (R() - 0.5) * a * 0.6, c[1] + k + (R() - 0.5) * a * 0.6, c[2] + k + (R() - 0.5) * a * 0.6]; }
  const inR = id => (x, y) => regAt(x, y) === id;

  // ---------- one pass of looking-and-correcting over a region
  function artistPass(o) {
    const T = o.tool, sticks = o.sticks, bb = o.bbox || [0, 0, 1600, 900], cell = o.cell;
    const seeds = [];
    for (let y = bb[1]; y < bb[3]; y += cell) for (let x = bb[0]; x < bb[2]; x += cell) seeds.push(x + R() * cell, y + R() * cell);
    const ns = seeds.length / 2;
    for (let i = ns - 1; i > 0; i--) {
      const j = (R() * (i + 1)) | 0;
      let t = seeds[i * 2]; seeds[i * 2] = seeds[j * 2]; seeds[j * 2] = t;
      t = seeds[i * 2 + 1]; seeds[i * 2 + 1] = seeds[j * 2 + 1]; seeds[j * 2 + 1] = t;
    }
    const ae = T.flow * (o.ae || 0.6), tr = T.transl, itr = 1 - tr, dith = o.dith === undefined ? 0.04 : o.dith;
    const inside = o.in, edge = o.edge === undefined ? 0.4 : o.edge, wobA = o.wob === undefined ? 0.35 : o.wob;
    const bx = new Float32Array(512), by = new Float32Array(512);
    for (let si = 0; si < ns; si++) {
      const sx = seeds[si * 2], sy = seeds[si * 2 + 1];
      if (!inside(sx, sy)) continue;
      if (o.target(sx, sy, tg) === false) continue;
      tg0[0] = tg[0]; tg0[1] = tg[1]; tg0[2] = tg[2];
      const dl = (R() - 0.5) * 2 * dith;
      tg[0] += dl + (R() - 0.5) * dith; tg[1] += dl + (R() - 0.5) * dith; tg[2] += dl + (R() - 0.5) * dith;
      curAt(sx, sy, cu);
      const e0 = cdist(cu, tg);
      if (o.only && !o.only(cu, tg)) continue;
      let col;
      if (o.cont) {
        if (!o.always && e0 < 0.03) continue;
        col = [tg[0], tg[1], tg[2]];
      } else {
        let best = -1, be = 1e9;
        for (let k = 0; k < sticks.length; k++) {
          const s = sticks[k];
          tt[0] = cu[0] + ae * (s[0] * (itr + tr * (cu[0] * 0.8 + 0.2)) - cu[0]);
          tt[1] = cu[1] + ae * (s[1] * (itr + tr * (cu[1] * 0.8 + 0.2)) - cu[1]);
          tt[2] = cu[2] + ae * (s[2] * (itr + tr * (cu[2] * 0.8 + 0.2)) - cu[2]);
          const e = cdist(tt, tg);
          if (e < be) { be = e; best = k; }
        }
        if (!o.always && be > e0 * (o.gain || 0.96)) continue;
        col = jit(sticks[best], 0.035);
      }
      let p = (o.p[0] + (o.p[1] - o.p[0]) * Math.min(1, e0 / (o.eref || 0.42))) * (0.82 + 0.36 * fbm(sx / 170, sy / 170, 77, 2));
      const ls = o.lenScale ? o.lenScale(sx, sy) : 1;
      const len = rr(o.len[0], o.len[1]) * ls, w = rr(o.w[0], o.w[1]) * (o.wScale ? o.wScale(sx, sy) : 1);
      const a0 = o.ang(sx, sy) + (R() - 0.5) * (o.angJit === undefined ? 0.3 : o.angJit) + 0.55 * (fbm(sx / 210, sy / 210, 78, 2) - 0.5);
      // march both ways from the seed until the shape (or the colour) ends
      const step = Math.min(2.4, Math.max(0.7, len / 8)), hw = w * edge, kc = (R() - 0.5) * 2 * (o.curve || 0) / Math.max(4, len);
      let nb = 0, x = sx, y = sy, a = a0 + Math.PI, s = 0, lim = len * rr(0.35, 0.65), i2 = 0;
      const ok = (x, y, a) => {
        if (!inside(x, y)) return false;
        if (hw > 0.45) { const px = -Math.sin(a) * hw, py = Math.cos(a) * hw; if (!inside(x + px, y + py) || !inside(x - px, y - py)) return false; }
        if (o.stop && ((i2++) & 1)) { if (o.target(x, y, tt) === false) return false; if (cdist(tt, tg0) > o.stop) return false; }
        return true;
      };
      while (s < lim && nb < 250) { a -= kc * step; x += Math.cos(a) * step; y += Math.sin(a) * step; if (!ok(x, y, a)) break; bx[nb] = x; by[nb] = y; nb++; s += step; }
      let n = 0;
      for (let i = nb - 1; i >= 0; i--) { PX[n] = bx[i]; PY[n] = by[i]; n++; }
      PX[n] = sx; PY[n] = sy; n++;
      x = sx; y = sy; a = a0; s = 0; lim = len - lim;
      while (s < lim && n < 500) { a += kc * step; x += Math.cos(a) * step; y += Math.sin(a) * step; if (!ok(x, y, a)) break; PX[n] = x; PY[n] = y; n++; s += step; }
      if (n < 2) { if (o.dots) { PP[0] = p; stroke(1, w, T, col, 1); } continue; }
      if ((n - 1) * step < (o.minLen || 0)) continue;
      const ph1 = R() * 6.28, ph2 = R() * 6.28, ca = Math.cos(a0), sa_ = Math.sin(a0), pm = o.pmod;
      for (let i = 0; i < n; i++) {
        const t = i / (n - 1);
        const taper = Math.min(1, t / 0.12 + 0.5) * Math.min(1, (1 - t) / 0.28 + 0.22);
        PP[i] = p * taper * (0.88 + 0.24 * R()) * (pm ? pm(PX[i], PY[i]) : 1);
        const wv = wobA * (0.6 * Math.sin(i * step * 0.31 + ph1) + Math.sin(i * step * 0.09 + ph2));
        PX[i] += -sa_ * wv; PY[i] += ca * wv;
      }
      stroke(n, w, T, col, o.op === undefined ? 1 : o.op);
    }
  }

  // ---------- free-hand line through control points (Catmull-Rom, with tremor)
  function pathPts(pts, o) {
    o = o || {};
    const step = o.step || 1.4, wob = o.wob === undefined ? 0.3 : o.wob, p0 = o.p0 === undefined ? 0.5 : o.p0, p1 = o.p1 === undefined ? 0.5 : o.p1, pm = o.press === undefined ? 1 : o.press;
    let n = 0; const ph1 = R() * 6.28, ph2 = R() * 6.28;
    const m = pts.length;
    if (m === 1) { PX[0] = pts[0][0]; PY[0] = pts[0][1]; PP[0] = pm; return 1; }
    let total = 0; for (let i = 0; i < m - 1; i++) total += Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]);
    let acc = 0;
    for (let i = 0; i < m - 1; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[i], c = pts[i + 1], d = pts[Math.min(m - 1, i + 2)];
      const L = Math.hypot(c[0] - b[0], c[1] - b[1]), k = Math.max(1, Math.round(L / step));
      for (let j = 0; j < k + (i === m - 2 ? 1 : 0); j++) {
        const t = j / k, t2 = t * t, t3 = t2 * t;
        let x = 0.5 * ((2 * b[0]) + (-a[0] + c[0]) * t + (2 * a[0] - 5 * b[0] + 4 * c[0] - d[0]) * t2 + (-a[0] + 3 * b[0] - 3 * c[0] + d[0]) * t3);
        let y = 0.5 * ((2 * b[1]) + (-a[1] + c[1]) * t + (2 * a[1] - 5 * b[1] + 4 * c[1] - d[1]) * t2 + (-a[1] + 3 * b[1] - 3 * c[1] + d[1]) * t3);
        const u = (acc + L * t) / (total || 1);
        const sdist = acc + L * t;
        const nx = -(c[1] - b[1]) / (L || 1), ny = (c[0] - b[0]) / (L || 1);
        const wv = wob * (0.6 * Math.sin(sdist * 0.33 + ph1) + Math.sin(sdist * 0.085 + ph2));
        if (n >= E.MAXP - 1) break;
        PX[n] = x + nx * wv; PY[n] = y + ny * wv;
        const tp = Math.min(1, u / 0.12 * (1 - p0) + p0) * Math.min(1, (1 - u) / 0.2 * (1 - p1) + p1);
        PP[n] = pm * tp * (0.9 + 0.2 * R());
        n++;
      }
      acc += L;
    }
    return n;
  }
  function line(pts, w, T, col, o) { const n = pathPts(pts, o); stroke(n, w, T, col, o && o.op); }
  function pin(pts, w, st, o) { const n = pathPts(pts, Object.assign({ wob: 0.15, p0: 0.3, p1: 0.2, step: 0.8 }, o || {})); scratch(n, w, st === undefined ? 0.92 : st); }
  function rub(pts, w, st, o) { const n = pathPts(pts, Object.assign({ wob: 0, p0: 1, p1: 1, step: Math.max(1, w * 0.2) }, o || {})); erase(n, w, st); }

  // =====================================================================
  //  STAGES
  // =====================================================================
  const paperT = (x, y, o) => { o[0] = PAPER[0]; o[1] = PAPER[1]; o[2] = PAPER[2]; return o; };
  const underTarget = (x, y, o) => { if (!Sc.underT(x, y, o)) paperT(x, y, o); return o; };
  const softer = (fn, k) => (x, y, o) => { fn(x, y, o); return mix3(PAPER, o, k, o); };
  const all = (x, y) => regAt(x, y) > 0;
  const q = [0, 0], q2 = [0, 0], tc = [0, 0, 0];
  const pick = arr => arr[(R() * arr.length) | 0];
  function near(sticks, c) { let b = 0, be = 1e9; for (let k = 0; k < sticks.length; k++) { const e = cdist(sticks[k], c); if (e < be) { be = e; b = k; } } return sticks[b]; }
  const ds = (x, y) => 0.3 + 1.25 * Math.pow(c01((y - 600) / 300), 1.15);
  const lean = (x, y) => -1.5708 + 0.75 * (fbm(x / 130, y / 60, 51, 2) - 0.5);
  function dot(x, y, w, T, col, p) { PX[0] = x; PY[0] = y; PP[0] = p === undefined ? 1 : p; stroke(1, w, T, col, 1); }
  function pinDot(x, y, w, st) { PX[0] = x; PY[0] = y; PP[0] = 1; scratch(1, w, st === undefined ? 0.95 : st); }
  function rubDot(x, y, w, st) { PX[0] = x; PY[0] = y; PP[0] = 1; erase(1, w, st); }
  function blade(x, y, h, ln, w, T, col, press, usePin) {
    const pts = [[x, y], [x + ln * h * 0.28 + rr(-0.06, 0.06) * h, y - h * 0.58], [x + ln * h, y - h]];
    if (usePin) pin(pts, w, press, { p0: 0.9, p1: 0.05 }); else line(pts, w, T, col, { press, p0: 1, p1: 0.08, wob: 0.2 });
  }

  // the trail the small lights take, from the hollow up to the thin moon
  const TRAIL = [];
  (function () {
    const P = [[960, 730], [988, 652], [954, 566], [905, 476], [826, 404], [778, 322], [694, 268], [636, 198], [556, 162], [MOON.x + 5, MOON.y + 11]];
    for (let i = 0; i < P.length - 1; i++) {
      const a = P[Math.max(0, i - 1)], b = P[i], c = P[i + 1], d = P[Math.min(P.length - 1, i + 2)];
      for (let j = 0; j < 30; j++) {
        const t = j / 30, t2 = t * t, t3 = t2 * t;
        TRAIL.push([0.5 * ((2 * b[0]) + (-a[0] + c[0]) * t + (2 * a[0] - 5 * b[0] + 4 * c[0] - d[0]) * t2 + (-a[0] + 3 * b[0] - 3 * c[0] + d[0]) * t3),
          0.5 * ((2 * b[1]) + (-a[1] + c[1]) * t + (2 * a[1] - 5 * b[1] + 4 * c[1] - d[1]) * t2 + (-a[1] + 3 * b[1] - 3 * c[1] + d[1]) * t3)]);
      }
    }
  })();
  const MOTES = [];
  (function () {
    for (let i = 0; i < 64; i++) {
      const u = (i + R()) / 64, t = 0.03 + 0.97 * Math.pow(u, 1.25), p = TRAIL[Math.min(TRAIL.length - 1, (t * (TRAIL.length - 1)) | 0)];
      const spread = 4 + 15 * Math.sin(Math.PI * t) + 34 * Math.exp(-t * 11);
      MOTES.push([p[0] + E.gs() * spread, p[1] + E.gs() * spread * 0.55, (2.1 - 1.2 * t) * rr(0.55, 1.3)]);
    }
    for (let i = 0; i < 26; i++) { // low sparks still hanging over the hollow
      const a = R() * 6.283, r = NEST.R * Math.sqrt(R()) * 0.95; Sc.w2s(r * Math.cos(a), r * Math.sin(a), q);
      MOTES.push([q[0] + rr(-4, 4), q[1] - rr(6, 70) * (0.4 + 0.6 * R()), rr(0.6, 1.5)]);
    }
  })();

  function sketch() {
    const G = hex('#77748c');   // the grey-violet pencil, held far back and barely pressed
    const o = { press: 0.34, wob: 0.6, p0: 0.5, p1: 0.4 };
    let pts = [];
    for (let k = 0; k <= 50; k++) { const a = -2.2 + k / 50 * 7.2; Sc.w2s(NEST.R * 1.0 * Math.cos(a), NEST.R * (1.0 + 0.03 * Math.sin(a * 2)) * Math.sin(a), q); pts.push([q[0], q[1]]); }
    line(pts, 1.0, PENCIL, G, o);
    line([[14, HOR + 1.5], [420, HOR - 0.5], [900, HOR + 0.8], [1586, HOR - 1]], 0.9, PENCIL, G, { press: 0.28, wob: 0.5 });
    line([[1104, 706], [1114, 640], [1108, 560], [1103, 470]], 1.0, PENCIL, G, o);
    line([[1186, 706], [1158, 640], [1146, 560], [1139, 470]], 1.0, PENCIL, G, o);
    for (const b of [Sc.BIG[0], Sc.BIG[2], Sc.BIG[3]]) {
      pts = []; const a0 = rr(0, 6);
      for (let k = 0; k <= 40; k++) { const a = a0 + k / 40 * 5.2; pts.push([b[0] + b[2] * 0.96 * Math.cos(a), b[1] + b[3] * 0.96 * Math.sin(a)]); }
      line(pts, 1.0, PENCIL, G, { press: 0.26, wob: 1.2 });
    }
    for (const p of Sc.PUFFS) if (p[2] > 46 && p[4] === 0) {
      pts = []; for (let k = 0; k <= 24; k++) { const a = -3.5 + k / 24 * 3.9; pts.push([p[0] + p[2] * Math.cos(a), p[1] + p[3] * Math.sin(a)]); }
      line(pts, 0.9, PENCIL, G, { press: 0.24, wob: 0.8 });
    }
    for (const sgn of [-1, 1]) { pts = []; for (let i = 0; i < Sc.PATH.length; i += 10) { const p = Sc.PATH[i]; pts.push([p[0] + sgn * 2, p[1] + sgn * Sc.pathW(p[1]) * 0.24]); } line(pts, 0.9, PENCIL, G, { press: 0.26, wob: 0.7 }); }
  }

  function cloudContours() {
    for (const p of Sc.PUFFS) {
      if (p[4] === 1) continue;
      let run = null; const steps = Math.max(24, Math.round(p[2] * 1.3));
      for (let k = 0; k <= steps + 1; k++) {
        const a = k / steps * 6.283, ca = Math.cos(a), sa = Math.sin(a);
        const ox = p[0] + p[2] * 1.035 * ca, oy = p[1] + p[3] * 1.035 * sa, ix = p[0] + p[2] * 0.9 * ca, iy = p[1] + p[3] * 0.9 * sa;
        const ext = k <= steps && regAt(ox, oy) === REG.SKY && regAt(ix, iy) === REG.CLOUD;
        if (ext) { (run = run || []).push([p[0] + p[2] * 0.99 * ca, p[1] + p[3] * 0.99 * sa]); }
        else if (run) {
          if (run.length > 3 && R() < 0.8) {
            // let the line curl a little way into the cloud, as a hand does
            const ext2 = rr(0.15, 0.6); for (let e = 1; e <= 5; e++) { const a2 = a + ext2 * e / 5; if (regAt(p[0] + p[2] * 0.97 * Math.cos(a2), p[1] + p[3] * 0.97 * Math.sin(a2)) !== REG.CLOUD) break; run.push([p[0] + p[2] * 0.97 * Math.cos(a2), p[1] + p[3] * 0.97 * Math.sin(a2)]); }
            const m = run[run.length >> 1]; Sc.cloudT(m[0], m[1], tc);
            const lum = tc[0] * 0.5 + tc[1] * 0.3 + tc[2] * 0.2;
            const col = lum > 0.8 ? pick([C.terracotta, C.roseSherbet, C.papaya]) : lum > 0.62 ? pick([C.roseSherbet, C.bougainvillea, C.tamarind]) : pick([C.schoolInk, C.periwinkle, C.dusk]);
            line(run, rr(0.9, 1.4), PENCIL, jit(col, 0.03), { press: rr(0.35, 0.62), p0: 0.4, p1: 0.1, wob: 0.45 });
          }
          run = null;
        }
      }
    }
  }

  function landLines() {
    // far shore, middle hills, the crest of the near meadow
    for (let x0 = 8; x0 < 1590;) {
      const L = rr(40, 150), pts = [];
      for (let x = x0; x < Math.min(1592, x0 + L); x += 6) { const h = Sc.farH(x); if (h > 0.6) pts.push([x, HOR - h - 0.3]); }
      if (pts.length > 2) line(pts, 1.0, PENCIL, jit(C.schoolInk, 0.03), { press: rr(0.25, 0.45), wob: 0.3 });
      x0 += L + rr(0, 30);
    }
    for (let x0 = 8; x0 < 1590;) {
      const L = rr(30, 120), pts = [];
      for (let x = x0; x < Math.min(1592, x0 + L); x += 2.5) { const y = Sc.midY(x); if (y < Sc.groundY(x) - 2 && regAt(x, y + 2) === REG.MID) pts.push([x, y - 0.2]); }
      if (pts.length > 2) line(pts, 1.1, PENCIL, jit(C.lastBusIndigo, 0.03), { press: rr(0.3, 0.55), wob: 0.25 });
      x0 += L + rr(0, 24);
    }
    // a soft pencil line where water meets sky
    line([[20, HOR + 0.6], [300, HOR + 0.2], [700, HOR + 0.7], [1090, HOR + 0.3]], 0.9, PENCIL, C.tamarind, { press: 0.28, wob: 0.3 });
    // quiet streaks of high cloud near the horizon
    for (let k = 0; k < 46; k++) {
      const y = rr(452, 551), x = rr(20, 1560), L = rr(30, 190);
      if (regAt(x, y) !== REG.SKY) continue;
      const pts = [[x, y], [x + L * 0.5, y + rr(-1.2, 1.2)], [x + L, y + rr(-1.5, 1.5)]];
      if (regAt(x + L, y) !== REG.SKY) continue;
      line(pts, rr(1.0, 2.0), PENCIL, jit(pick([C.roseSherbet, C.jacaranda, C.papaya, C.bougainvillea, C.mauve]), 0.03), { press: rr(0.2, 0.45), p0: 0.1, p1: 0.1, wob: 0.3 });
    }
  }

  function crestTufts() {
    for (let x = 6; x < 1594; x += rr(0.9, 2.6)) {
      const y = Sc.groundY(x);
      const r = regAt(x, y + 4); if (r !== REG.MEADOW && r !== REG.PATH) continue;
      if (regAt(x, y - 6) === REG.TRUNK || regAt(x, y - 6) === REG.CANOPY) continue;
      const h = rr(2.5, 7.5) * (R() < 0.07 ? 1.8 : 1);
      blade(x, y + 2, h + 2, rr(-0.5, 0.5), rr(0.9, 1.5), PENCIL, jit(pick([C.lastBusIndigo, C.deepTeal, C.nightGreen, C.wellWater]), 0.02), rr(0.6, 0.95));
    }
  }

  function trunkDetails() {
    // bark furrows that follow the lean of the tree
    for (let k = 0; k < 1500; k++) {
      const x0 = rr(870, 1450), y0 = rr(190, 715);
      if (regAt(x0, y0) !== REG.TRUNK) continue;
      const ti = Sc.trunkInfo(x0, y0), a = ti.ang + rr(-0.12, 0.12), thick = y0 > 450 && x0 > 1090 && x0 < 1190;
      const L = thick ? rr(12, 52) : rr(8, 26), x1 = x0 + Math.cos(a) * L, y1 = y0 + Math.sin(a) * L;
      if (regAt(x1, y1) !== REG.TRUNK) continue;
      const mx = (x0 + x1) / 2 + rr(-1.6, 1.6), my = (y0 + y1) / 2 + rr(-1, 1);
      Sc.trunkT(mx, my, tc);
      const lum = tc[0] * 0.5 + tc[1] * 0.35 + tc[2] * 0.15;
      const col = lum > 0.6 ? pick([C.terracotta, C.tamarind]) : lum > 0.35 ? pick([C.tamarind, C.aubergine]) : pick([C.inkPlum, C.lastBusIndigo]);
      line([[x0, y0], [mx, my], [x1, y1]], rr(0.9, 1.7), PENCIL, jit(col, 0.03), { press: rr(0.35, 0.7), p0: 0.2, p1: 0.1, wob: 0.5 });
    }
    // an old knot, like a closed eye
    line([[1118, 590], [1124, 585], [1131, 589], [1126, 595], [1119, 592], [1123, 589]], 1.3, PENCIL, C.inkPlum, { press: 0.6, wob: 0.2, step: 0.8 });
    // outline, heavier on the night side
    for (const s of Sc.LIMBS) {
      const dx = s[3] - s[0], dy = s[4] - s[1], L = Math.hypot(dx, dy), nx = -dy / L, ny = dx / L;
      for (const sgn of [-1, 1]) {
        let pts = [];
        const flush = pp => {
          const m = pp[pp.length >> 1]; Sc.trunkT(m[0] - nx * sgn * 2, m[1] - ny * sgn * 2, tc);
          const lum = tc[0] * 0.5 + tc[1] * 0.35 + tc[2] * 0.15;
          line(pp, rr(1.0, 1.5), PENCIL, jit(lum > 0.5 ? C.tamarind : C.inkPlum, 0.02), { press: lum > 0.5 ? 0.45 : 0.7, wob: 0.35, p0: 0.5, p1: 0.3 });
        };
        for (let t = 0; t <= 1.001; t += 0.2) {
          const hw = s[2] + (s[5] - s[2]) * (s[6] ? Math.pow(t, 0.55) : t), x = s[0] + dx * t + nx * sgn * hw * 0.97, y = s[1] + dy * t + ny * sgn * hw * 0.97;
          if (regAt(x - nx * sgn * 1.5, y - ny * sgn * 1.5) === REG.TRUNK && regAt(x + nx * sgn * 2.5, y + ny * sgn * 2.5) !== REG.TRUNK) pts.push([x, y]);
          else { if (pts.length > 1) flush(pts); pts = []; }
        }
        if (pts.length > 1) flush(pts);
      }
    }
  }

  function leaves() {
    const TB = [760, 0, 1600, 520];
    // leaves along the silhouette, dark against the dusk
    for (let k = 0; k < 9000; k++) {
      const x = rr(TB[0], TB[2]), y = rr(TB[1], TB[3]);
      if (Sc.fv(Sc.CNF, x, y) < -0.2) continue;
      const v = Sc.canopyV(x, y); if (v < 0.0 || v > 0.24) continue;
      const i = Sc.fi(x, y), U = Sc.canopyU(x, y);
      let a = Math.atan2(Sc.CNF.ny[i], Sc.CNF.nx[i]) + rr(-1.3, 1.3);
      const L = rr(4, 8.5), tx = x + Math.cos(a) * L, ty = y + Math.sin(a) * L;
      let col;
      if (U < 0.16) col = pick([C.lastBusIndigo, C.nightGreen, C.deepTeal, C.lastBusIndigo]);
      else { if (regAt(tx, ty) !== REG.CANOPY) continue; col = U < 0.3 ? pick([C.pondGreen, C.parrot]) : pick([C.moss, C.parrot]); }
      const rt = regAt(tx, ty); if (rt === REG.TRUNK) continue;
      const mx = (x + tx) / 2 + Math.sin(a) * L * 0.18, my = (y + ty) / 2 - Math.cos(a) * L * 0.18;
      line([[x, y], [mx, my], [tx, ty]], rr(2.0, 3.4), CRAYON, jit(col, 0.03), { press: rr(0.6, 0.95), p0: 0.5, p1: 0.2, wob: 0.1, step: 1 });
    }
    // leaf shadows inside the lit undersides, so the gold breaks into leaves
    for (let k = 0; k < 9000; k++) {
      const x = rr(TB[0], TB[2]), y = rr(TB[1], TB[3]);
      if (regAt(x, y) !== REG.CANOPY) continue;
      const U = Sc.canopyU(x, y); if (U < 0.2) continue;
      Sc.canopyT(x, y, tc); tc[0] *= 0.6; tc[1] *= 0.68; tc[2] *= 0.7;
      const a = rr(0, 6.283), L = rr(3.5, 7.5);
      line([[x, y], [x + Math.cos(a) * L * 0.5 + Math.sin(a) * 1.2, y + Math.sin(a) * L * 0.5 - Math.cos(a) * 1.2], [x + Math.cos(a) * L, y + Math.sin(a) * L]], rr(1.4, 2.4), PENCIL, jit(near(LEAVES, tc), 0.03), { press: rr(0.35, 0.7), p0: 0.4, p1: 0.15, wob: 0.1, step: 1 });
    }
  }

  function meadowDetails() {
    // individual blades standing a little darker than the ground behind them
    for (let k = 0; k < 6500; k++) {
      const x = rr(4, 1596), y = 600 + 300 * Math.sqrt(R());
      if (regAt(x, y) !== REG.MEADOW) continue;
      const L = Sc.nestLight(x, y); if (L > 0.5 && R() < 0.8) continue;
      Sc.s2w(x, y, q); if (Math.hypot(q[0], q[1]) < NEST.R * 1.25) continue;
      Sc.meadowT(x, y, tc); const dk = L > 0.3 ? 0.76 : L > 0.08 ? 0.64 : 0.8; tc[0] *= dk; tc[1] *= dk + 0.06; tc[2] *= dk + 0.08;
      const sc = ds(x, y);
      blade(x, y, rr(9, 24) * sc, Math.tan(lean(x, y) + 1.5708) * 0.8 + rr(-0.3, 0.3), rr(1.2, 2.1) * Math.max(0.6, sc), PENCIL, jit(near(GRASSES, tc), 0.03), rr(0.4, 0.8));
    }
    // tufts leaning over the path, where feet have not quite reached
    for (let i = 2; i < Sc.PATH.length - 3; i++) {
      const p = Sc.PATH[i], w = Sc.pathW(p[1]);
      for (const sgn of [-1, 1]) for (let k = 0; k < 2; k++) {
        if (R() < 0.35) continue;
        const x = p[0] + rr(-3, 3), y = p[1] + sgn * w * 0.25 * rr(0.8, 1.25);
        if (regAt(x, y) === 0) continue;
        Sc.meadowT(x, y + sgn * 4, tc); tc[0] *= 0.7; tc[1] *= 0.76; tc[2] *= 0.8;
        const sc = ds(x, y);
        blade(x, y + 2, rr(6, 15) * sc, rr(-0.5, 0.5) - sgn * 0.1, rr(1.2, 2.0) * Math.max(0.6, sc), PENCIL, jit(near(GRASSES, tc), 0.03), rr(0.5, 0.85));
      }
    }
    // small stones and scuffs on the worn earth
    for (let k = 0; k < 150; k++) {
      const p = Sc.PATH[(R() * Sc.PATH.length) | 0], w = Sc.pathW(p[1]);
      const x = p[0] + rr(-6, 6), y = p[1] + rr(-0.16, 0.16) * w; if (regAt(x, y) !== REG.PATH) continue;
      Sc.pathT(x, y, tc); const dk = rr(0.62, 0.85); tc[0] *= dk; tc[1] *= dk; tc[2] *= dk + 0.05;
      const L = rr(1.5, 7) * ds(x, y);
      line([[x, y], [x + L, y + rr(-0.4, 0.4)]], rr(1, 1.8), PENCIL, [tc[0], tc[1], tc[2]], { press: rr(0.3, 0.6), wob: 0.2 });
    }
  }

  const FLOWERS = [];
  function nestDetails() {
    const Rn = NEST.R;
    // the grass still pressed round, the way something small and warm left it
    for (let k = 0; k < 150; k++) {
      const th = R() * 6.283, rho = Rn * (0.30 + 0.60 * Math.sqrt(R())), dth = rr(0.3, 0.95), pts = [];
      for (let i = 0; i <= 12; i++) { const t = i / 12, r2 = rho * (1 - 0.25 * t); Sc.w2s(r2 * Math.cos(th + dth * t), r2 * Math.sin(th + dth * t), q); pts.push([q[0], q[1]]); }
      const sc = Sc.depthScale(pts[0][1]);
      const far = rho / Rn;
      const col = pick(far > 0.7 ? [C.oldGold, C.sandalwood, C.turmeric, C.jaggeryLight] : [C.oldGold, C.moss, C.sandalwood, C.grass, C.turmeric]);
      line(pts, rr(1.0, 1.9) * sc, PENCIL, jit(col, 0.04), { press: rr(0.16, 0.42) * (1.1 - 0.5 * far), p0: 0.3, p1: 0.05, wob: 0.25 });
    }
    rub([[NEST.x - 30, NEST.y + 2], [NEST.x + 30, NEST.y + 2]], 22, 0.4);
    // grass around the ring: lit beyond it, a little darker in front of it
    for (let k = 0; k < 230; k++) {
      const th = R() * 6.283, rho = Rn * rr(1.16, 1.8); Sc.w2s(rho * Math.cos(th), rho * Math.sin(th), q);
      if (regAt(q[0], q[1]) !== REG.MEADOW) continue;
      const sc = Sc.depthScale(q[1]), front = Math.sin(th) < -0.05;
      const col = front ? pick([C.parrot, C.grass, C.parrot, C.pondGreen]) : pick([C.grass, C.moss, C.newLeaf]);
      blade(q[0], q[1], rr(9, 20) * sc, Math.cos(th) * 0.35 + rr(-0.25, 0.25), rr(1.1, 1.9) * sc, PENCIL, jit(col, 0.03), front ? rr(0.45, 0.8) : rr(0.3, 0.5));
    }
    // a pale band lifted with the eraser all the way round
    { const pts = []; for (let k = 0; k <= 60; k++) { const a = k / 60 * 6.283; Sc.w2s(Rn * Math.cos(a), Rn * Math.sin(a), q); pts.push([q[0], q[1]]); } rub(pts, 30, 0.5); rub(pts, 15, 0.5); }
    // the flowers that came up where it used to sleep. Their white is only the paper, taken back.
    for (let i = 0; i < 27; i++) {
      const th = i / 27 * 6.283 + rr(-0.07, 0.07), rho = Rn * rr(0.93, 1.09);
      Sc.w2s(rho * Math.cos(th), rho * Math.sin(th), q); FLOWERS.push([q[0], q[1], 1, th]);
    }
    for (let i = 0; i < 12; i++) { const th = R() * 6.283, rho = Rn * rr(1.14, 1.42); Sc.w2s(rho * Math.cos(th), rho * Math.sin(th), q); FLOWERS.push([q[0], q[1], 0.6, th]); }
    for (let i = 0; i < 4; i++) { const th = R() * 6.283, rho = Rn * rr(0.66, 0.84); Sc.w2s(rho * Math.cos(th), rho * Math.sin(th), q); FLOWERS.push([q[0], q[1], 0.6, th]); }
    FLOWERS.sort((a, b) => a[1] - b[1]);
    for (const f of FLOWERS) {
      const fx = f[0], sc = Sc.depthScale(f[1]), s = rr(6.6, 8.8) * sc * f[2], fy = f[1] - s * rr(0.9, 1.7);
      const bx = fx + rr(-1.5, 1.5) * s * 0.3, by = f[1] + s * 0.9;
      line([[bx, by], [(bx + fx) / 2 + rr(-0.8, 0.8), (by + fy) / 2], [fx, fy + s * 0.2]], 1.0 * sc, PENCIL, jit(pick([C.parrot, C.moss, C.grass]), 0.03), { press: 0.6, wob: 0.15, p0: 0.8, p1: 0.6, step: 0.9 });
      for (const sg of [-1, 1]) if (R() < 0.6) line([[bx, by - s * 0.2], [bx + sg * s * 0.5, by - s * 0.6], [bx + sg * s * 0.85, by - s * 0.5]], 1.4 * sc, PENCIL, jit(pick([C.parrot, C.grass]), 0.03), { press: 0.5, wob: 0.1, p0: 0.5, p1: 0.1, step: 0.8 });
      rubDot(fx, fy, s * 3.6, 0.62);
      const ph = R() * 6.283, np = R() < 0.15 ? 6 : 5, sq2 = 0.78, angs = [], lens = [];
      for (let k = 0; k < np; k++) { angs.push(ph + k * 6.283 / np + rr(-0.13, 0.13)); lens.push(s * rr(0.9, 1.1)); }
      const P = (aa, rad) => [fx + Math.cos(aa) * rad, fy + Math.sin(aa) * rad * sq2];
      for (let k = 0; k < np; k++) {
        pin([P(angs[k], s * 0.15), P(angs[k], lens[k] * 0.55), P(angs[k], lens[k] * 0.82)], s * 0.58, 1, { p0: 0.55, p1: 0.85, wob: 0, step: 0.5 });
      }
      const oc = jit(pick([C.turmeric, C.terracotta, C.terracotta, C.sandalwood]), 0.03);
      for (let k = 0; k < np; k++) {
        const a = angs[k], L = lens[k], sp = 0.50;
        if (R() < 0.9) line([P(a - 0.1, s * 0.25), P(a - sp, L * 0.66), P(a - sp * 0.4, L * 0.98), P(a, L * 1.04), P(a + sp * 0.4, L * 0.98), P(a + sp, L * 0.66), P(a + 0.1, s * 0.25)], 0.8 * Math.max(0.85, sc), PENCIL, oc, { press: rr(0.55, 0.8), wob: 0.1, p0: 0.5, p1: 0.4, step: 0.5 });
        if (R() < 0.5) line([P(a, s * 0.3), P(a, L * 0.6)], 0.6, PENCIL, jit(C.jaggeryLight, 0.03), { press: 0.4, wob: 0.05, p0: 0.8, p1: 0.1, step: 0.5 });
      }
      dot(fx, fy, s * 0.5, PENCIL, jit(C.turmeric, 0.03), 0.95);
      dot(fx + rr(-0.2, 0.2), fy + s * 0.06, s * 0.24, PENCIL, jit(C.terracotta, 0.03), 0.85);
    }
    for (let k = 0; k < 150; k++) {
      const x = rr(1092, 1204), y = rr(702, 722) + Math.abs(x - 1148) * -0.04;
      Sc.meadowT(x, y + 4, tc); tc[0] *= 0.82; tc[1] *= 0.86; tc[2] *= 0.86;
      blade(x, y + 4, rr(9, 20), rr(-0.4, 0.4), rr(1.3, 2.2), PENCIL, jit(near(GRASSES, tc), 0.03), rr(0.6, 0.9));
    }
    // a few dark blades crossing in front of the nearest flowers
    for (let k = 0; k < 16; k++) {
      const th = rr(3.5, 5.9), rho = Rn * rr(1.1, 1.24); Sc.w2s(rho * Math.cos(th), rho * Math.sin(th), q);
      const sc = Sc.depthScale(q[1]);
      blade(q[0], q[1] + 3, rr(12, 26) * sc, rr(-0.4, 0.4), rr(1.2, 2.0) * sc, PENCIL, jit(pick([C.pondGreen, C.parrot, C.wellWater]), 0.03), rr(0.6, 0.9));
    }
  }

  function foreground() {
    // tall grass at the very front, dark, close enough to touch
    const zones = [[-14, 170, 58, 50, 185], [1300, 1614, 64, 50, 200], [330, 760, 22, 22, 70], [1060, 1300, 16, 26, 84], [176, 330, 6, 12, 30]];
    for (const z of zones) for (let k = 0; k < z[2]; k++) {
      const x = rr(z[0], z[1]), y = rr(886, 912), h = rr(z[3], z[4]), ln = rr(-0.45, 0.45) + (x < 400 ? 0.12 : -0.1);
      const col = jit(pick([C.deepTeal, C.nightGreen, C.wellWater, C.lastBusIndigo, C.nightGreen]), 0.02);
      const pts = [[x, y], [x + ln * h * 0.25 + rr(-0.05, 0.05) * h, y - h * 0.55], [x + ln * h * 0.8, y - h * 0.9], [x + ln * h * 1.15, y - h]];
      const bw = rr(2.2, 4.2) * (h > 80 ? 1.35 : 1);
      line(pts, bw * 0.55, PENCIL, col, { press: 0.95, p0: 1, p1: 0.05, wob: 0.3 });
      line(pts.slice(0, 3), bw, CRAYON, col, { press: 0.95, p0: 1, p1: 0.3, wob: 0.3 });
      line([pts[0], [(pts[0][0] + pts[1][0]) / 2, (pts[0][1] + pts[1][1]) / 2], pts[1]], bw * 1.5, CRAYON, col, { press: 0.95, p0: 1, p1: 0.4, wob: 0.3 });
      if (h > 90 && R() < 0.5) { // a seed-head
        const tx = pts[3][0], ty = pts[3][1], dx = (pts[3][0] - pts[2][0]), dy = (pts[3][1] - pts[2][1]), L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L;
        for (let j = 0; j < 9; j++) { const t = j * 3.2, sg = j % 2 ? 1 : -1, sx = tx - ux * t, sy = ty - uy * t; line([[sx, sy], [sx + (-uy * sg) * 3.4 + ux * 3, sy + (ux * sg) * 3.4 + uy * 3]], rr(1.5, 2.3), PENCIL, col, { press: 0.85, wob: 0, step: 0.8 }); }
      }
    }
  }

  const CLOCKS = [[1296, 838, 46, 7.4, 0], [1352, 866, 34, 6.2, 0], [668, 858, 42, 7.0, 1]];
  for (const c of CLOCKS) { c[5] = c[0] + rr(-4, 4); c[6] = c[1] - c[2]; }
  function clocks() {
    for (const c of CLOCKS) {
      const hx = c[5], hy = c[6];
      line([[c[0], c[1]], [(c[0] + hx) / 2 + 2, c[1] - c[2] * 0.5], [hx, hy]], 1.3, PENCIL, jit(C.pondGreen, 0.02), { press: 0.8, wob: 0.2 });
      rubDot(hx, hy, c[3] * 2.6, 0.3);
      const n = 30;
      for (let k = 0; k < n; k++) {
        const a = k / n * 6.283 + rr(-0.08, 0.08);
        if (c[4] && Math.cos(a - 2.2) > 0.1) continue;       // half of this one has already left
        const r1 = c[3] * rr(0.86, 1.08);
        pin([[hx + Math.cos(a) * 1.2, hy + Math.sin(a) * 1.2], [hx + Math.cos(a) * r1, hy + Math.sin(a) * r1]], 0.5, 0.8, { p0: 0.5, p1: 0.6, wob: 0.05 });
        pinDot(hx + Math.cos(a) * r1, hy + Math.sin(a) * r1, 1.1, 0.9);
      }
      dot(hx, hy, 1.8, PENCIL, C.tamarind, 0.8);
      if (c[4]) for (let k = 0; k < 6; k++) { // its seeds, going
        const t = (k + 1) / 6, sx = hx - 14 - 70 * t + 8 * Math.sin(k * 2.4), sy = hy - 12 - 60 * t * t - 8 - 8 * Math.cos(k * 1.7);
        
        pin([[sx, sy], [sx + 1.2, sy + 3.2]], 0.45, 0.8, { p0: 0.8, p1: 0.8, wob: 0 });
        pinDot(sx, sy, 1.5, 0.9); pinDot(sx - 1.1, sy - 0.2, 0.8, 0.8); pinDot(sx + 1.1, sy - 0.3, 0.8, 0.8);
      }
    }
  }

  function wildflowers() {
    const drifts = [[420, 722, 60, 12, 14], [246, 792, 70, 18, 14], [566, 688, 50, 9, 10], [1384, 762, 60, 14, 14], [1486, 842, 60, 18, 12], [116, 692, 50, 9, 10], [770, 884, 60, 9, 8], [1250, 690, 50, 8, 8], [60, 850, 40, 20, 8]];
    for (const d of drifts) for (let k = 0; k < d[4]; k++) {
      const x = d[0] + E.gs() * d[2], y = d[1] + E.gs() * d[3];
      if (regAt(x, y) !== REG.MEADOW) continue;
      const sc = ds(x, y) * 1.1, s = rr(1.7, 2.9) * sc, ph = R() * 6.283, hy = y - rr(4, 10) * sc;
      const lit = Sc.nestLight(x, y) > 0.05;
      for (let j = 0; j < 5; j++) { const a = ph + j * 1.2566; pin([[x + Math.cos(a) * s * 0.25, hy + Math.sin(a) * s * 0.2], [x + Math.cos(a) * s, hy + Math.sin(a) * s * 0.8]], s * 0.5, lit ? 0.9 : 0.72, { p0: 0.7, p1: 0.8, wob: 0 }); }
      if (lit) dot(x, hy, s * 0.5, PENCIL, jit(C.turmeric, 0.03), 0.8);
    }
  }

  const STARS = [];
  function pinWork() {
    // stars: each one a single touch of the pin
    for (let k = 0; k < 400 && STARS.length < 74; k++) {
      const x = rr(10, 1590), y = 8 + 440 * Math.pow(R(), 1.7);
      if (regAt(x, y) !== REG.SKY || regAt(x + 3, y) !== REG.SKY || regAt(x - 3, y) !== REG.SKY) continue;
      if (Math.hypot(x - MOON.x, y - MOON.y) < 52) continue;
      STARS.push([x, y, R() < 0.12 ? rr(1.3, 1.8) : rr(0.55, 1.15)]);
    }
    for (const s of STARS) {
      const fade = 1 - 0.5 * c01((s[1] - 150) / 300);
      pinDot(s[0], s[1], s[2] * 1.5, 0.95 * fade);
      if (s[2] > 1.3) { rubDot(s[0], s[1], 9, 0.25); pin([[s[0] - 3.2, s[1]], [s[0] + 3.2, s[1]]], 0.45, 0.8, { p0: 0.1, p1: 0.1, wob: 0 }); pin([[s[0], s[1] - 3.6], [s[0], s[1] + 3.6]], 0.45, 0.8, { p0: 0.1, p1: 0.1, wob: 0 }); pinDot(s[0], s[1], 1.9, 1); }
    }
    // the moon: a thin boat of a moon, scraped out one arc at a time; the rest of its circle only lifted with the eraser
    rubDot(MOON.x, MOON.y, 110, 0.10); rubDot(MOON.x, MOON.y, 56, 0.08);
    for (let rad = 0.6; rad < MOON.r - 0.3; rad += 0.62) { const c = []; for (let a = 0; a <= 6.4; a += 0.25) c.push([MOON.x + rad * Math.cos(a), MOON.y + rad * Math.sin(a)]); pin(c, 0.8, 0.09, { p0: 1, p1: 1, wob: 0.05 }); }
    const sx = 0.26, sy = 0.9656, sa = Math.atan2(sy, sx), r = MOON.r;
    for (let rad = r - 0.25; rad > r * 0.5; rad -= 0.5) {
      let run = [];
      for (let a = -1.5; a <= 1.5; a += 0.04) {
        const x = MOON.x + rad * Math.cos(sa + a), y = MOON.y + rad * Math.sin(sa + a);
        const inner = Math.hypot(x - (MOON.x - sx * 0.40 * r), y - (MOON.y - sy * 0.40 * r));
        if (inner >= r * 1.0) run.push([x, y]); else if (run.length) { if (run.length > 1) pin(run, 0.75, 0.97, { p0: 0.5, p1: 0.5, wob: 0.03 }); run = []; }
      }
      if (run.length > 1) pin(run, 0.75, 0.97, { p0: 0.5, p1: 0.5, wob: 0.03 });
    }
    // the small lights going up
    for (const m of MOTES) {
      curAt(m[0], m[1], tc); const bright = tc[0] * 0.4 + tc[1] * 0.4 + tc[2] * 0.2 > 0.62;
      rubDot(m[0], m[1], 5 + m[2] * 7, 0.2 + 0.12 * m[2]);
      pinDot(m[0], m[1], m[2] * 1.6, 0.97);
      if (bright && regAt(m[0], m[1]) !== REG.MEADOW) { dot(m[0], m[1], m[2] * 2.6, PENCIL, jit(C.turmeric, 0.03), 0.7); pinDot(m[0], m[1], m[2] * 0.8, 0.9); }
    }
    // glints in the grass: the buried yellow, found again
    for (let k = 0; k < 9000; k++) {
      const x = rr(380, 1596), y = rr(640, 898);
      if (regAt(x, y) !== REG.MEADOW) continue;
      const L = Sc.nestLight(x, y); if (L > 0.5 || R() > L * 3.2 + 0.03) continue;
      const sc = ds(x, y);
      blade(x, y, rr(6, 19) * sc, Math.tan(lean(x, y) + 1.5708) * 0.8 + rr(-0.35, 0.35), rr(0.5, 0.85) * Math.max(0.7, sc), null, null, rr(0.6, 0.9), true);
    }
    for (let k = 0; k < 1500; k++) {
      const x = rr(4, 1596), y = rr(620, 898);
      if (regAt(x, y) !== REG.MEADOW) continue;
      const L = Sc.nestLight(x, y); if (L > 0.04) continue;
      const sc = ds(x, y);
      blade(x, y, rr(5, 15) * sc, Math.tan(lean(x, y) + 1.5708) * 0.8 + rr(-0.35, 0.35), rr(0.45, 0.7) * Math.max(0.7, sc), null, null, rr(0.3, 0.6), true);
    }
    // leaves that catch the light from below
    for (let k = 0; k < 14000; k++) {
      const x = rr(770, 1596), y = rr(4, 520);
      if (regAt(x, y) !== REG.CANOPY) continue;
      const U = Sc.canopyU(x, y);
      let st;
      if (U > 0.05 && U < 0.42) { if (R() > 0.2 + U * 1.6) continue; st = rr(0.6, 0.92); }
      else if (U <= 0.05) { if (R() > 0.08) continue; st = rr(0.3, 0.55); } else continue;
      const a = rr(0, 6.283), L = rr(2.6, 6);
      pin([[x, y], [x + Math.cos(a) * L * 0.5 + Math.sin(a) * 0.9, y + Math.sin(a) * L * 0.5 - Math.cos(a) * 0.9], [x + Math.cos(a) * L, y + Math.sin(a) * L]], rr(0.7, 1.25), st, { p0: 0.3, p1: 0.2, wob: 0 });
    }
    // glitter on the water under the last of the day
    for (let k = 0; k < 170; k++) {
      const y = HOR + 1.5 + 40 * Math.pow(R(), 1.4), x = GLOW.x + E.gs() * (16 + (y - HOR) * 1.5);
      if (regAt(x, y) !== REG.WATER) continue;
      const L = rr(2.5, 12) * (0.6 + (y - HOR) / 40);
      pin([[x - L / 2, y], [x + L / 2, y + rr(-0.2, 0.2)]], rr(0.45, 0.8), rr(0.6, 0.95), { p0: 0.2, p1: 0.2, wob: 0.05 });
    }
    // bark catching a little gold
    for (let k = 0; k < 400; k++) {
      const x = rr(1090, 1160), y = rr(500, 700);
      if (regAt(x, y) !== REG.TRUNK) continue;
      const ti = Sc.trunkInfo(x, y); if (ti.nx > -0.35 || R() < 0.75) continue;
      pin([[x, y], [x + Math.cos(ti.ang) * rr(6, 18) + rr(-1, 1), y + Math.sin(ti.ang) * rr(6, 18)]], 0.6, rr(0.4, 0.75), { wob: 0.3 });
    }
  }

  function smudges() {
    // where the side of the hand rested, and dragged a little colour out onto the bare edge
    const spots = [[1400, 897, C.wellWater], [520, 898, C.pondGreen], [1597, 640, C.duskRose], [3, 300, C.tinTrunkCobalt], [880, 3, C.schoolInk], [1597, 180, C.nightGreen], [3, 700, C.deepTeal], [240, 3, C.schoolInk]];
    for (const s of spots) for (let k = 0; k < 5; k++) {
      const x = s[0] + rr(-40, 40), y = s[1] + rr(-3, 3);
      const horiz = s[1] < 10 || s[1] > 890;
      line([[x, y], [x + (horiz ? rr(10, 40) : rr(-2, 2)), y + (horiz ? rr(-2, 2) : rr(10, 40))]], rr(5, 11), DUST, mix3(PAPER, s[2], 0.5, [0, 0, 0]), { press: rr(0.3, 0.6), wob: 0.4, op: 0.35 });
    }
  }

  function crumbs() {
    for (let k = 0; k < 420; k++) {
      const x = rr(6, 1594), y = rr(6, 894);
      curAt(x + rr(-14, 14), y + rr(-14, 14), tc);
      dot(x, y, rr(0.6, 1.3), PENCIL, [tc[0] * 0.9, tc[1] * 0.9, tc[2] * 0.9], rr(0.6, 1));
    }
  }

  function* stages() {
    E.makePaper();
    yield 'paper';
    Sc.buildRegions();
    sketch();
    yield 'first shy lines';

    // ---- 1. the first bright layer (to be buried, and found again by the pin)
    const warmR = (x, y) => regAt(x, y) >= 6;
    artistPass({ in: warmR, target: underTarget, cont: true, tool: DUST, cell: 13, w: [14, 24], len: [50, 140], ang: () => -0.5, angJit: 0.6, p: [0.6, 0.9], dith: 0.02, curve: 0.3, edge: 0.1, stop: 0.25 });
    artistPass({ in: all, target: underTarget, tool: CRAYON, sticks: UNDERS, cell: 10, w: [8, 13], len: [50, 130], ang: () => -0.62, angJit: 0.5, p: [0.3, 0.8], dith: 0.03, curve: 0.3, edge: 0.15, stop: 0.22 });
    artistPass({ in: all, target: underTarget, tool: CRAYON, sticks: UNDERS, cell: 7, w: [5, 9], len: [30, 90], ang: () => 0.5, angJit: 0.5, p: [0.3, 0.8], dith: 0.03, curve: 0.3, edge: 0.15, stop: 0.2 });
    for (let mi = 0; mi < MOTES.length; mi++) { const m = MOTES[mi]; if (mi < 64 && m[1] < 640) dot(m[0], m[1], 12 + m[2] * 7, DUST, jit(C.lemonDrop, 0.03), 0.9); dot(m[0], m[1], 4.5 + m[2] * 2.5, CRAYON, jit(pick([C.lemonDrop, C.marigold, C.butter]), 0.03), 0.95); }
    E.snapshotUnder();
    for (const c of CLOCKS) { E.keepBare(c[5], c[6], c[3] * 1.5); if (c[4]) for (let k = 0; k < 6; k++) { const t = (k + 1) / 6; E.keepBare(c[5] - 14 - 70 * t + 8 * Math.sin(k * 2.4), c[6] - 12 - 60 * t * t - 8 - 8 * Math.cos(k * 1.7), 3.2); } }
    yield 'first bright layer';

    // ---- 2. sky: thumb-rubbed chalk dust, then wax, then pencil
    const SKY = inR(REG.SKY);
    artistPass({ in: SKY, target: softer(Sc.skyT, 0.5), cont: true, always: true, tool: DUST, cell: 26, w: [30, 52], len: [140, 320], ang: () => -0.42, angJit: 0.25, p: [0.6, 0.85], dith: 0.015, curve: 0.2, edge: 0.12 });
    artistPass({ in: SKY, target: softer(Sc.skyT, 0.72), cont: true, always: true, tool: DUST, cell: 17, w: [18, 30], len: [80, 220], ang: () => 0.06, angJit: 0.2, p: [0.55, 0.8], dith: 0.015, curve: 0.2, edge: 0.15 });
    artistPass({ in: SKY, target: softer(Sc.skyT, 0.8), cont: true, tool: DUST, cell: 8, w: [7, 12], len: [20, 60], ang: () => -0.42, angJit: 0.8, p: [0.55, 0.8], dith: 0.015, curve: 0.2, edge: 0.05 });
    const others = (x, y) => { const r = regAt(x, y); return r >= 2 && r <= 5; };
    artistPass({ in: others, target: softer(Sc.target, 0.62), cont: true, tool: DUST, cell: 7, w: [7, 12], len: [16, 60], ang: () => -0.3, angJit: 0.8, p: [0.6, 0.85], dith: 0.015, curve: 0.3, edge: 0.1, stop: 0.2 });
    yield 'chalk dust, rubbed in';
    artistPass({ in: SKY, target: Sc.skyT, tool: CRAYON, sticks: SKYS, cell: 9, w: [7, 12], len: [50, 150], ang: () => -0.55, angJit: 0.35, p: [0.3, 0.78], dith: 0.05, curve: 0.3, stop: 0.2 });
    artistPass({ in: SKY, target: Sc.skyT, tool: CRAYON, sticks: SKYS, cell: 7, w: [4, 7], len: [30, 90], ang: () => 0.3, angJit: 0.35, p: [0.3, 0.75], dith: 0.05, curve: 0.3, stop: 0.18 });
    yield 'sky wax';
    artistPass({ in: SKY, target: Sc.skyT, tool: PENCIL, sticks: SKYS, cell: 3.4, w: [1.7, 2.6], len: [18, 60], ang: () => -0.58, angJit: 0.3, p: [0.35, 0.8], dith: 0.05, curve: 0.25, always: true, edge: 0.2 });
    artistPass({ in: SKY, target: Sc.skyT, tool: PENCIL, sticks: SKYS, cell: 2.8, w: [1.5, 2.3], len: [12, 44], ang: () => -0.5, angJit: 0.6, p: [0.3, 0.8], dith: 0.04, curve: 0.25, edge: 0.1 });
    yield 'sky pencil';

    // ---- 3. cloud
    const CLD = inR(REG.CLOUD);
    const cang = (x, y) => { const i = Sc.fi(x, y); return Sc.CLF.k[i] === 1 ? 0 : Math.atan2(Sc.CLF.nx[i], -Sc.CLF.ny[i]); };
    artistPass({ in: CLD, target: Sc.cloudT, tool: CRAYON, sticks: CLOUDS, cell: 6, w: [5, 8.5], len: [16, 50], ang: cang, angJit: 0.5, p: [0.35, 0.8], dith: 0.04, curve: 0.8, stop: 0.13, edge: 0.3 });
    artistPass({ in: CLD, target: Sc.cloudT, tool: CRAYON, sticks: CLOUDS, cell: 4.5, w: [3, 5], len: [10, 34], ang: cang, angJit: 0.7, p: [0.35, 0.8], dith: 0.04, curve: 0.8, stop: 0.11, edge: 0.25 });
    artistPass({ in: CLD, target: Sc.cloudT, tool: PENCIL, sticks: CLOUDS, cell: 2.6, w: [1.7, 2.5], len: [8, 28], ang: cang, angJit: 0.6, p: [0.35, 0.8], dith: 0.045, curve: 0.8, stop: 0.1, edge: 0.1, always: true });
    artistPass({ in: CLD, target: Sc.cloudT, tool: PENCIL, sticks: CLOUDS, cell: 2.4, w: [1.5, 2.2], len: [6, 22], ang: (x, y) => -0.55, angJit: 0.4, p: [0.3, 0.8], dith: 0.04, curve: 0.5, stop: 0.1, edge: 0.1 });
    cloudContours();
    yield 'cloud';

    // ---- 4. far shore, water, middle hills
    const FAR = inR(REG.FAR), WAT = inR(REG.WATER), MID = inR(REG.MID);
    artistPass({ in: FAR, target: Sc.farT, tool: CRAYON, sticks: HILLS, bbox: [0, 500, 1600, 570], cell: 4, w: [3, 5], len: [10, 34], ang: () => -0.5, p: [0.35, 0.8], edge: 0.3 });
    artistPass({ in: FAR, target: Sc.farT, tool: PENCIL, sticks: HILLS, bbox: [0, 500, 1600, 570], cell: 2.2, w: [1.5, 2.2], len: [6, 22], ang: () => -0.6, p: [0.35, 0.8], edge: 0.1, always: true });
    artistPass({ in: WAT, target: Sc.waterT, tool: CRAYON, sticks: WATERS, bbox: [0, 550, 1600, 640], cell: 4.5, w: [2.6, 4.6], len: [30, 130], ang: () => 0, angJit: 0.04, p: [0.3, 0.8], stop: 0.14, edge: 0.3, dith: 0.035, curve: 0.02 });
    artistPass({ in: WAT, target: Sc.waterT, tool: PENCIL, sticks: WATERS, bbox: [0, 550, 1600, 640], cell: 2.4, w: [1.4, 2.2], len: [12, 80], ang: () => 0, angJit: 0.05, p: [0.3, 0.8], stop: 0.12, edge: 0.1, dith: 0.04, curve: 0.02, always: true });
    artistPass({ in: WAT, target: Sc.waterT, tool: PENCIL, sticks: WATERS, bbox: [0, 550, 1600, 640], cell: 2.2, w: [1.3, 2.0], len: [8, 50], ang: () => 0, angJit: 0.05, p: [0.3, 0.8], stop: 0.1, edge: 0.1, dith: 0.03, curve: 0.02 });
    artistPass({ in: MID, target: Sc.midT, tool: CRAYON, sticks: HILLS, bbox: [0, 560, 1600, 660], cell: 5, w: [3.5, 6], len: [14, 50], ang: () => -0.9, p: [0.4, 0.85], edge: 0.3 });
    artistPass({ in: MID, target: Sc.midT, tool: PENCIL, sticks: HILLS, bbox: [0, 560, 1600, 660], cell: 2.3, w: [1.6, 2.4], len: [6, 26], ang: () => -1.0, angJit: 0.5, p: [0.4, 0.85], edge: 0.1, always: true });
    artistPass({ in: MID, target: Sc.midT, tool: PENCIL, sticks: HILLS, bbox: [0, 560, 1600, 660], cell: 2.3, w: [1.5, 2.2], len: [5, 18], ang: () => -1.57, angJit: 0.5, p: [0.4, 0.85], edge: 0.1 });
    landLines();
    yield 'far shore and water';

    // ---- 5. meadow
    const MEA = inR(REG.MEADOW), PTH = inR(REG.PATH), GB = [0, 590, 1600, 900];
    artistPass({ in: MEA, target: Sc.meadowT, tool: CRAYON, sticks: GRASSES, bbox: GB, cell: 8, w: [7, 12], len: [40, 110], ang: () => -0.7, angJit: 0.5, p: [0.3, 0.8], dith: 0.045, curve: 0.3, stop: 0.2, edge: 0.3 });
    artistPass({ in: MEA, target: Sc.meadowT, tool: CRAYON, sticks: GRASSES, bbox: GB, cell: 6, w: [3.5, 6.5], len: [18, 60], lenScale: ds, ang: lean, angJit: 0.5, p: [0.3, 0.8], dith: 0.045, curve: 0.5, stop: 0.16, edge: 0.25 });
    yield 'meadow wax';
    artistPass({ in: MEA, target: Sc.meadowT, tool: PENCIL, sticks: GRASSES, bbox: GB, cell: 3.0, w: [1.6, 2.5], len: [12, 40], lenScale: ds, ang: lean, angJit: 0.6, p: [0.35, 0.85], dith: 0.06, curve: 0.9, stop: 0.2, edge: 0.1, always: true });
    artistPass({ in: MEA, target: Sc.meadowT, tool: PENCIL, sticks: GRASSES, bbox: GB, cell: 2.6, w: [1.4, 2.2], len: [10, 34], lenScale: ds, ang: lean, angJit: 0.7, p: [0.35, 0.85], dith: 0.05, curve: 0.9, stop: 0.16, edge: 0.1 });
    artistPass({ in: PTH, target: Sc.pathT, tool: CRAYON, sticks: PATHS, bbox: [150, 730, 900, 900], cell: 5, w: [3, 6], len: [14, 50], ang: () => -0.2, angJit: 0.4, p: [0.3, 0.75], dith: 0.04, stop: 0.16, edge: 0.3 });
    artistPass({ in: PTH, target: Sc.pathT, tool: PENCIL, sticks: PATHS, bbox: [150, 730, 900, 900], cell: 2.5, w: [1.5, 2.3], len: [8, 36], ang: () => -0.2, angJit: 0.5, p: [0.3, 0.8], dith: 0.05, stop: 0.14, edge: 0.1, always: true });
    yield 'meadow pencil';

    // ---- 6. the tree
    const TRK = inR(REG.TRUNK), CAN = inR(REG.CANOPY), TB = [760, 0, 1600, 740];
    const tang = (x, y) => Sc.trunkInfo(x, y).ang;
    artistPass({ in: TRK, target: Sc.trunkT, tool: CRAYON, sticks: BARKS, bbox: TB, cell: 4, w: [3, 5.5], len: [14, 50], ang: tang, angJit: 0.2, p: [0.35, 0.85], dith: 0.05, curve: 0.3, stop: 0.2, edge: 0.3 });
    artistPass({ in: TRK, target: Sc.trunkT, tool: PENCIL, sticks: BARKS, bbox: TB, cell: 2.2, w: [1.5, 2.4], len: [8, 40], ang: tang, angJit: 0.25, p: [0.35, 0.85], dith: 0.06, curve: 0.4, stop: 0.18, edge: 0.1, always: true });
    artistPass({ in: TRK, target: Sc.trunkT, tool: PENCIL, sticks: BARKS, bbox: TB, cell: 2.0, w: [1.3, 2.0], len: [6, 30], ang: tang, angJit: 0.3, p: [0.35, 0.85], dith: 0.05, curve: 0.4, stop: 0.14, edge: 0.1 });
    const lang = (x, y) => { const i = Sc.fi(x, y); return Math.atan2(Sc.CN2.nx[i], -Sc.CN2.ny[i]); };
    artistPass({ in: CAN, target: Sc.canopyT, tool: CRAYON, sticks: LEAVES, bbox: TB, cell: 7, w: [6, 10], len: [16, 50], ang: lang, angJit: 0.7, p: [0.35, 0.85], dith: 0.05, curve: 0.9, stop: 0.2, edge: 0.3 });
    artistPass({ in: CAN, target: Sc.canopyT, tool: CRAYON, sticks: LEAVES, bbox: TB, cell: 4.6, w: [3, 5.5], len: [7, 18], ang: lang, angJit: 2.4, p: [0.35, 0.85], dith: 0.07, curve: 0.9, stop: 0.2, edge: 0.25 });
    artistPass({ in: CAN, target: Sc.canopyT, tool: PENCIL, sticks: LEAVES, bbox: TB, cell: 2.6, w: [1.8, 3.0], len: [5, 13], ang: lang, angJit: 3.1, p: [0.4, 0.9], dith: 0.08, curve: 0.9, stop: 0.2, edge: 0.1, always: true });
    artistPass({ in: CAN, target: Sc.canopyT, tool: PENCIL, sticks: LEAVES, bbox: TB, cell: 2.4, w: [1.5, 2.4], len: [4, 12], ang: lang, angJit: 3.1, p: [0.4, 0.9], dith: 0.06, curve: 0.9, stop: 0.16, edge: 0.1 });
    // the bits the hand forgot, found on a second look
    const ALLS = Object.keys(C).map(k => C[k]);
    artistPass({ in: all, target: Sc.target, tool: PENCIL, sticks: ALLS, cell: 1.8, w: [1.5, 2.3], len: [2, 7], ang: () => -0.6, angJit: 1.2, p: [0.45, 0.9], dith: 0.03, edge: 0, gain: 0.8, dots: true, wob: 0.1, only: (cu, tg) => cdist(cu, PAPER) < 0.3 && cdist(tg, PAPER) > 0.38 && R() < 0.8 });
    yield 'tree';
    trunkDetails();
    leaves();
    yield 'bark and leaves';

    // ---- 7. the small things
    crestTufts();
    meadowDetails();
    nestDetails();
    yield 'the hollow';
    foreground();
    yield 'near grass';

    // ---- 8. taking away: the pin and the eraser
    pinWork();
    wildflowers();
    clocks();
    yield 'pin and eraser';
    smudges();
    crumbs();
    yield 'done';
  }

  return { stages, BOX };
}

g.SW = g.SW || {};
g.SW.createPainter = createPainter;
if (typeof module !== 'undefined' && module.exports) module.exports = { createPainter };
})(typeof self !== 'undefined' ? self : globalThis);
