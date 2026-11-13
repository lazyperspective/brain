// pier.js -- the jetty. Grey boards on short piles, coming in from the bank at our right and stopping
// where the water used to be deep enough. Seven mooring posts. Six have nothing tied to them.
(function (G) {
  'use strict';
  const A = G.ART, Wd = A.W, K = Wd.K, T = A.TOOL, v = Wd.v, fbm = A.fbm, vn = A.vn, ss = A.ss, clamp = A.clamp;
  const S = (A.S = A.S || {});

  const PA = [3.32, 3.9], PB = [1.07, 8.72], HD = 0.42, HWID = 0.64;
  const LEN = Math.hypot(PB[0] - PA[0], PB[1] - PA[1]);
  const dv = [(PB[0] - PA[0]) / LEN, (PB[1] - PA[1]) / LEN], nl = [-dv[1], dv[0] * -1 * -1 === 0 ? 0 : -dv[0] * -1];
  // left normal (toward the channel and a little toward us)
  const NL = [-dv[1], -(-dv[0])].map((q, i) => (i === 0 ? -Math.abs(dv[1]) : -Math.abs(dv[0])));
  const at = (s, off, Y) => Wd.proj(PA[0] + dv[0] * s + NL[0] * off, Y, PA[1] + dv[1] * s + NL[1] * off);
  const S0 = -1.4;
  const quad = (a, b, c, d) => A.poly([a[0], a[1], b[0], b[1], c[0], c[1], d[0], d[1]]);
  const deck = quad(at(S0, HWID, HD), at(LEN, HWID, HD), at(LEN, -HWID, HD), at(S0, -HWID, HD));
  const side = quad(at(S0, HWID, HD), at(LEN, HWID, HD), at(LEN, HWID, 0), at(S0, HWID, 0));
  const SH = [-Wd.SUN[0] / Wd.SUN[1], -Wd.SUN[2] / Wd.SUN[1]];   // ground shift of a shadow per metre of height
  const atS = (s, off, Y, h) => Wd.proj(PA[0] + dv[0] * s + NL[0] * off + SH[0] * h, Y, PA[1] + dv[1] * s + NL[1] * off + SH[1] * h);
  const shadow = quad(atS(S0, HWID, 0, HD), atS(LEN, HWID, 0, HD), atS(LEN, -HWID, 0, HD), atS(S0, -HWID, 0, HD));

  // posts: s along, which edge (+1 left / -1 right), height above the deck, lean
  const posts = [
    { s: LEN - 0.12, e: 1, h: 0.58, lean: 0.03, tied: true },
    { s: LEN - 1.42, e: 1, h: 0.50, lean: -0.05 }, { s: LEN - 2.72, e: 1, h: 0.62, lean: 0.02 }, { s: LEN - 4.02, e: 1, h: 0.44, lean: 0.07 },
    { s: LEN - 0.12, e: -1, h: 0.52, lean: -0.03 }, { s: LEN - 2.07, e: -1, h: 0.60, lean: 0.04 }, { s: LEN - 4.02, e: -1, h: 0.55, lean: -0.02 },
  ];
  const PR = 0.085;
  for (const p of posts) {
    const off = p.e * (HWID + 0.07);
    p.base = at(p.s, off, p.e > 0 ? 0 : HD);         // left posts are seen all the way down to the ground
    p.deckPt = at(p.s, off, HD);
    p.top = at(p.s + p.lean * 0.3, off + p.lean, HD + p.h);
    p.r = (p.deckPt[1] - Wd.HZ) / (Wd.HE - HD) * PR * 1.0;      // half-width on the sheet
    p.poly = quad([p.base[0] - p.r, p.base[1]], [p.top[0] - p.r, p.top[1]], [p.top[0] + p.r, p.top[1]], [p.base[0] + p.r, p.base[1]]);
    p.topS = (p.top[1] - Wd.HZ) / (Wd.HE - HD - p.h);
  }
  Wd.pier = { deck, side, posts, at, LEN, HD };
  Wd.keep.push((x, y) => { if (x < 700) return false; if (deck.inside(x, y) || side.inside(x, y)) return true; for (const p of posts) if (Math.abs(x - p.base[0]) < p.r + 6 && p.poly.inside(x, y)) return true; return false; });
  (Wd.occ = Wd.occ || []).push(function (f) {
    if (f.x < 780) return null;
    if (deck.inside(f.x, f.y) || deck.inside(f.x, f.y - f.s * 0.6)) return 'skip';
    if (side.inside(f.x, f.y)) return 'skip';
    if (side.inside(f.x, f.y - 5 - f.s) || side.inside(f.x + 4, f.y - 4)) return 'front';
    for (const p of posts) if (p.e > 0 && Math.abs(f.x - p.base[0]) < p.r + f.s && f.y > p.base[1] - 3 && f.y < p.base[1] + 22) return 'front';
    return null;
  });

  function post(C, rng, p) {
    const r = p.r, bx = p.base[0], by = p.base[1], tx = p.top[0], ty = p.top[1];
    const R = A.region([Math.min(bx, tx) - r - 1, ty - r * 0.4, Math.max(bx, tx) + r + 1, by + 1], (x, y) => p.poly.inside(x, y));
    const up = Math.atan2(ty - by, tx - bx);
    A.scribble(C, rng, R, { tool: T.crayonTip, col: K.drift, w: Math.max(2.2, r * 0.7), gap: Math.max(1.2, r * 0.3), ang: up, p: 0.95, over: 0.5, under: 0, run: 6, wob: 0.4 });
    // sun on the left, shade on the right
    A.scribble(C, rng, A.region(R.bbox, (x, y) => R.inside(x, y) && (x - (bx + (tx - bx) * (by - y) / Math.max(1, by - ty))) < -r * 0.2), { tool: T.crayonTip, col: K.bone, w: Math.max(2, r * 0.6), gap: Math.max(1.3, r * 0.34), ang: up + 0.03, p: 0.9, over: 0, under: 0.5, run: 5, wob: 0.4 });
    A.scribble(C, rng, A.region(R.bbox, (x, y) => R.inside(x, y) && (x - (bx + (tx - bx) * (by - y) / Math.max(1, by - ty))) < -r * 0.62), { tool: T.chalk, col: K.cream, w: Math.max(1.6, r * 0.34), gap: Math.max(1.6, r * 0.5), ang: up, p: 0.7, over: 0, under: 1, run: 3, wob: 0.4, skip: 0.2 });
    const Rsh = A.region(R.bbox, (x, y) => R.inside(x, y) && (x - (bx + (tx - bx) * (by - y) / Math.max(1, by - ty))) > r * 0.1);
    A.scribble(C, rng, Rsh, { tool: T.crayonTip, col: K.slate, w: Math.max(2, r * 0.5), gap: Math.max(1.4, r * 0.36), ang: up - 0.04, p: 0.7, over: 0, under: 0.5, run: 5, wob: 0.4 });
    A.hatch(C, rng, Rsh, { tool: T.pencil, colAt: (x, y, q) => (q.chance(0.6) ? K.walnut : K.umber), w: 1.2 + r * 0.03, gap: 1.6 + r * 0.16, ang: 0.8, p: 0.7, seg: 5 + r * 0.8 });
    // grain and cracks running up it
    for (let k = 0; k < 4 + r * 0.5; k++) {
      const f = rng.r(-0.85, 0.85), y0 = by - rng.r(0, (by - ty) * 0.6), y1 = Math.max(ty + 1, y0 - rng.r(6, (by - ty) * 0.7));
      const xa = bx + (tx - bx) * (by - y0) / (by - ty) + f * r, xb = bx + (tx - bx) * (by - y1) / (by - ty) + f * r;
      C.line(rng, T.pencil, rng.chance(0.6) ? K.umber : K.walnut, [xa, y0, (xa + xb) / 2 + rng.g() * 0.5, (y0 + y1) / 2, xb, y1], 1.05 + r * 0.02, 0.6, { wob: 0.5, wl: 25 });
    }
    // lichen
    for (let k = 0; k < 3 + r * 0.8; k++) {
      const f = rng.r(-0.8, 0.3), yy = by - rng.r(0.15, 0.95) * (by - ty), xx = bx + (tx - bx) * (by - yy) / (by - ty) + f * r;
      C.dab(T.crayonTip, rng.chance(0.5) ? K.mustard : rng.chance(0.5) ? K.lemon : K.sage, xx, yy, rng.r(1.2, 1.4 + r * 0.28), 0.8);
    }
    // the cut top: an ellipse with its rings
    const ry = Math.max(1.1, r * 0.36);
    const el = []; for (let a = 0; a <= 6.4; a += 0.4) el.push(tx + Math.cos(a) * r * 0.98, ty + Math.sin(a) * ry);
    const tp = A.poly(el.slice(0, 32));
    A.scribble(C, rng, A.region(tp.bbox, (x, y) => tp.inside(x, y)), { tool: T.crayonTip, col: K.bone, w: Math.max(1.6, r * 0.5), gap: Math.max(1, r * 0.22), ang: 0.1, p: 0.95, over: 0.3, under: 0, run: 6, wob: 0.2 });
    C.line(rng, T.chalk, K.white, [tx - r * 0.6, ty - ry * 0.1, tx + r * 0.2, ty - ry * 0.3], Math.max(1.2, r * 0.28), 0.7, { wob: 0.2 });
    C.line(rng, T.pencil, K.walnut, el, 1.2 + r * 0.02, 0.8, { wob: 0.3, step: 2 });
    if (r > 4) { const e2 = []; for (let a = 0.5; a <= 6.2; a += 0.5) e2.push(tx + r * 0.1 + Math.cos(a) * r * 0.5, ty + Math.sin(a) * ry * 0.5); C.line(rng, T.pencil, K.umber, e2, 1.0, 0.5, { wob: 0.3, step: 2 }); C.dab(T.pencil, K.walnut, tx + r * 0.1, ty, 1.3, 0.8); }
    // outline, both sides
    C.line(rng, T.pencil, K.walnut, [bx - r, by, (bx + tx) / 2 - r + rng.g() * 0.4, (by + ty) / 2, tx - r, ty], 1.3 + r * 0.02, 0.8, { wob: 0.5, wl: 40 });
    C.line(rng, T.pencil, K.walnut, [bx + r, by, (bx + tx) / 2 + r + rng.g() * 0.4, (by + ty) / 2, tx + r, ty], 1.5 + r * 0.03, 0.9, { wob: 0.5, wl: 40 });
    // an iron ring, rusted, and what is left of a rope
    const ringY = ty + (by - ty) * (p.e > 0 ? 0.3 : 0.38), ringX = bx + (tx - bx) * (by - ringY) / (by - ty) - r * 0.25, rr = Math.max(1.6, r * 0.42);
    C.dab(T.pencil, K.walnut, ringX, ringY - rr, 1.6 + r * 0.06, 0.9);
    const ring = []; for (let a = -1.2; a <= 4.4; a += 0.45) ring.push(ringX + Math.cos(a) * rr * 0.8, ringY + Math.sin(a) * rr);
    C.line(rng, T.pencil, K.rust, ring, 1.3 + r * 0.05, 0.9, { wob: 0.2, step: 2 });
    C.line(rng, T.pencil, K.walnut, ring.map((z, j) => (j & 1 ? z + 0.5 : z + 0.5)), 1.0, 0.5, { wob: 0.2, step: 2 });
    C.line(rng, T.pencil, K.rust, [ringX, ringY + rr, ringX + rng.g() * 0.4, ringY + rr + rng.r(3, 3 + r * 0.9)], 1.1, 0.4, { wob: 0.3 });
    p.ring = [ringX, ringY + rr * 0.8];
    if (!p.tied && rng.chance(0.75)) { // a frayed end, a hand long
      const Ln = rng.r(1.2, 2.6) * r, ex = ringX + rng.g() * r * 0.5, ey = ringY + rr + Ln;
      C.line(rng, T.crayonTip, K.straw, A.curve([ringX, ringY + rr * 0.6, ringX + rng.g() * 1, ringY + rr + Ln * 0.5, ex, ey]), 1.4 + r * 0.1, 0.85, { wob: 0.3, step: 2.5, pe: 0.8 });
      C.line(rng, T.pencil, K.umber, A.curve([ringX + 0.8, ringY + rr * 0.6, ringX + 0.8 + rng.g() * 1, ringY + rr + Ln * 0.5, ex + 0.8, ey]), 1.0, 0.55, { wob: 0.3, step: 2.5 });
      for (let k = 0; k < 4; k++) C.line(rng, T.pencil, K.straw, [ex, ey, ex + rng.g() * r * 0.3, ey + rng.r(1, 1 + r * 0.5)], 1.0, 0.8, { wob: 0.2 });
    }
  }

  S.pier = function (C, rng) {
    const ppmAt = s => (at(s, 0, HD)[1] - Wd.HZ) / (Wd.HE - HD);
    // ---- its shadow on the ground, off to the right
    {
      const R = A.region(shadow.bbox, (x, y) => shadow.inside(x + (vn(x / 11, y / 11, 3) - 0.5) * 6, y) && !deck.inside(x, y) && y < 900);
      A.scribble(C, rng, R, { tool: T.crayon, col: K.spruce, w: 9, gap: 6, ang: 0.2, p: 0.6, over: 1, under: 1, run: 5, wob: 0.8 });
      A.hatch(C, rng, R, { tool: T.pencil, colAt: (x, y, q) => (q.chance(0.5) ? K.pine : K.slate), w: 1.8, gap: 3.2, ang: 0.75, p: 0.8, seg: 40 });
      A.hatch(C, rng, R, { tool: T.pencil, col: K.pine, w: 1.6, gap: 5, ang: -0.45, p: 0.6, seg: 26, skip: 0.2 });
    }
    // ---- underneath, seen from the channel side: dark, with the piles and the long bearer
    {
      const R = A.region(side.bbox, (x, y) => side.inside(x, y));
      A.scribble(C, rng, R, { tool: T.crayon, col: K.pine, w: 7, gap: 3.6, ang: 0.5, p: 0.9, over: 0, under: 0, run: 6, wob: 0.5 });
      A.hatch(C, rng, R, { tool: T.pencil, colAt: (x, y, q) => (q.chance(0.6) ? K.walnut : K.spruce), w: 1.7, gap: 2.6, ang: 0.9, p: 0.85, seg: 26 });
      A.hatch(C, rng, R, { tool: T.pencil, col: K.walnut, w: 1.6, gap: 3.6, ang: -0.3, p: 0.7, seg: 20, skip: 0.15 });
      // piles between the posts
      for (let s = LEN - 0.75; s > S0; s -= 1.3) {
        const a = at(s, HWID - 0.05, HD), b = at(s, HWID - 0.05, 0), r = ppmAt(s) * 0.07;
        C.line(rng, T.crayonTip, K.umber, [a[0], a[1], b[0], b[1]], r * 2, 0.85, { wob: 0.4, pe: 0.9 });
        C.line(rng, T.pencil, K.drift, [a[0] - r * 0.5, a[1], b[0] - r * 0.5, b[1]], 1.2 + r * 0.1, 0.7, { wob: 0.4 });
      }
      // the bearer under the board ends
      const b0 = [], b1 = [];
      for (let s = S0; s <= LEN; s += 0.5) { const p = at(s, HWID, HD - 0.03), q = at(s, HWID, HD - 0.15); b0.push(p[0], p[1]); b1.push(q[0], q[1]); }
      const bp = A.poly(b0.concat((() => { const o = []; for (let i = b1.length - 2; i >= 0; i -= 2) o.push(b1[i], b1[i + 1]); return o; })()));
      A.scribble(C, rng, A.region(bp.bbox, (x, y) => bp.inside(x, y)), { tool: T.crayonTip, col: K.drift, w: 4, gap: 2.2, ang: Math.atan2(b0[b0.length - 1] - b0[1], b0[b0.length - 2] - b0[0]), p: 0.9, over: 1, under: 0, run: 5, wob: 0.4 });
      C.line(rng, T.pencil, K.walnut, b1, 1.5, 0.85, { wob: 0.6, wl: 60 });
      C.line(rng, T.pencil, K.umber, b0.map((z, j) => (j & 1 ? z + 2 : z)), 1.1, 0.55, { wob: 0.8, wl: 40 });
    }
    // ---- right-edge posts stand behind the deck edge: draw them first
    for (const p of posts) if (p.e < 0) post(C, rng.fork(), p);
    // ---- the boards, one at a time
    const boards = [];
    for (let s = LEN; s > S0;) {
      const w = rng.r(0.15, 0.2), gapW = rng.r(0.012, 0.03);
      boards.push({ s1: s, s0: s - w, missing: false });
      s -= w + gapW;
    }
    // some are gone
    for (const k of [5, 13, 14, 22]) if (boards[k]) boards[k].missing = true;
    const ang = Math.atan2(at(2, -HWID, HD)[1] - at(2, HWID, HD)[1], at(2, -HWID, HD)[0] - at(2, HWID, HD)[0]);
    for (let k = 0; k < boards.length; k++) {
      const b = boards[k], r = rng.fork();
      const oL = HWID + r.r(0.0, 0.07), oR = -(HWID + r.r(0.0, 0.07)), sk = r.g() * 0.012;
      const a = at(b.s1 + sk, oL, HD), bq = at(b.s1 - sk, oR, HD), c = at(b.s0 - sk, oR, HD), d = at(b.s0 + sk, oL, HD);
      const pl = quad(a, bq, c, d), bw = Math.abs(d[1] - a[1]) + Math.abs(d[0] - a[0]) * 0.4;
      if (a[1] > 930 && bq[1] > 930) continue;
      const R = A.region(pl.bbox, (x, y) => pl.inside(x, y));
      if (b.missing) { // the hole: dark, a cross-bearer glimpsed, grass coming up through
        A.scribble(C, r, R, { tool: T.crayonTip, col: K.pine, w: Math.max(2, bw * 0.5), gap: Math.max(1.2, bw * 0.22), ang: ang, p: 0.95, over: 0, under: 0, run: 6, wob: 0.3 });
        A.hatch(C, r, R, { tool: T.pencil, col: K.walnut, w: 1.5, gap: 2, ang: 0.9, p: 0.85, seg: 14 });
        for (let q = 0; q < 6; q++) { const f = r.r(0.1, 0.9), x = d[0] + (c[0] - d[0]) * f, y = d[1] + (c[1] - d[1]) * f; Wd.flick(C, r, T.crayonTip, r.pick([K.sap, K.pist, K.lemon, K.moss]), x, y, bw * r.r(1.2, 3.2), r.g() * 0.3, 1.4 + bw * 0.08, 0.85); }
        continue;
      }
      const tone = r.pick([K.drift, K.drift, K.bone, K.bone, K.sage]);
      A.scribble(C, r, R, { tool: T.crayonTip, col: v(tone, r, 0.025), w: Math.max(2.4, bw * 0.55), gap: Math.max(1.3, bw * 0.24), ang: ang + r.g() * 0.02, p: 0.95, over: 0.8, under: 0, run: 7, wob: 0.35 });
      A.scribble(C, r, R, { tool: T.crayonTip, col: r.pick([K.bone, K.cream, K.drift, K.far]), w: Math.max(2, bw * 0.4), gap: Math.max(2, bw * 0.5), ang: ang + r.g() * 0.03, p: 0.6, over: 0, under: 1, run: 3, wob: 0.4, skip: 0.25 });
      // grain, a knot, the dark gap on the near edge, a pale lip on the far edge
      const ng = 1 + Math.round(bw / 5);
      for (let q = 0; q < ng; q++) { const f = (q + r()) / ng, p0 = [a[0] + (d[0] - a[0]) * f, a[1] + (d[1] - a[1]) * f], p1 = [bq[0] + (c[0] - bq[0]) * f, bq[1] + (c[1] - bq[1]) * f], t0 = r.r(0, 0.4), t1 = r.r(0.6, 1); C.line(r, T.pencil, r.chance(0.6) ? K.umber : K.drift, [p0[0] + (p1[0] - p0[0]) * t0, p0[1] + (p1[1] - p0[1]) * t0, p0[0] + (p1[0] - p0[0]) * t1, p0[1] + (p1[1] - p0[1]) * t1], 1.0 + bw * 0.012, 0.5, { wob: 0.5, wl: 30 }); }
      if (r.chance(0.3)) { const f = r.r(0.15, 0.85), g = r.r(0.3, 0.7), x = a[0] + (bq[0] - a[0]) * f + (d[0] - a[0]) * g, y = a[1] + (bq[1] - a[1]) * f + (d[1] - a[1]) * g; C.line(r, T.pencil, K.umber, [x - 2, y, x, y - 1, x + 2, y, x, y + 1, x - 2, y], 1.1, 0.7, { wob: 0.2, step: 2 }); }
      C.line(r, T.pencil, K.walnut, [d[0], d[1], c[0], c[1]], 1.5 + bw * 0.03, 0.85, { wob: 0.5, wl: 50 });
      C.line(r, T.chalk, K.white, [a[0], a[1] + 1, bq[0], bq[1] + 1], 1.1 + bw * 0.02, 0.5, { wob: 0.4, pj: 0.7 });
      C.line(r, T.pencil, K.walnut, [a[0], a[1], d[0], d[1]], 1.4, 0.8, { wob: 0.3 });     // the sawn end facing us
      // two nails each end
      for (const f of [0.08, 0.92]) for (const g of [0.3, 0.7]) { const x = a[0] + (bq[0] - a[0]) * f + (d[0] - a[0]) * g, y = a[1] + (bq[1] - a[1]) * f + (d[1] - a[1]) * g; C.dab(T.pencil, r.chance(0.6) ? K.rust : K.walnut, x, y, 1.2 + bw * 0.035, 0.85); }
      // moss in the joint, here and there
      if (r.chance(0.4)) for (let q = 0; q < 5; q++) { const f = r.r(0, 1); C.dab(T.crayonTip, r.pick([K.moss, K.sap, K.lemon]), d[0] + (c[0] - d[0]) * f, d[1] + (c[1] - d[1]) * f, 1.3 + bw * 0.06, 0.8); }
    }
    // ---- shadows of the left-hand posts lying across the boards (3 o'clock would have been shorter)
    for (const p of posts) {
      if (p.e < 0) continue;
      const off = HWID + 0.07, h = p.h;
      const a = at(p.s - PR, off, HD), b = at(p.s + PR, off, HD);
      const c = [Wd.proj(PA[0] + dv[0] * (p.s + PR) + NL[0] * off + SH[0] * h, HD, PA[1] + dv[1] * (p.s + PR) + NL[1] * off + SH[1] * h), Wd.proj(PA[0] + dv[0] * (p.s - PR) + NL[0] * off + SH[0] * h, HD, PA[1] + dv[1] * (p.s - PR) + NL[1] * off + SH[1] * h)];
      const sp = quad(a, b, c[0], c[1]);
      const R = A.region(sp.bbox, (x, y) => sp.inside(x, y) && deck.inside(x, y));
      A.scribble(C, rng, R, { tool: T.crayonTip, col: K.slate, w: 4, gap: 2.6, ang: Math.atan2(c[0][1] - b[1], c[0][0] - b[0]), p: 0.8, over: 0, under: 0, run: 5, wob: 0.4 });
      A.hatch(C, rng, R, { tool: T.pencil, colAt: (x, y, q) => (q.chance(0.55) ? K.walnut : K.bluepencil), w: 1.5, gap: 2.4, ang: 0.85, p: 0.75, seg: 18 });
    }
    // ---- left-edge posts, far to near
    posts.filter(p => p.e > 0).sort((a, b) => a.base[1] - b.base[1]).forEach(p => post(C, rng.fork(), p));
    // ---- the edges of the deck, said again
    const eL = [], eR = [];
    for (let s = S0; s <= LEN; s += 0.6) { const p = at(s, HWID + 0.03, HD), q = at(s, -HWID - 0.03, HD); eL.push(p[0], p[1]); eR.push(q[0], q[1]); }
    C.line(rng, T.pencil, K.walnut, eL, 1.3, 0.55, { wob: 1.0, wl: 80 });
    C.line(rng, T.pencil, K.walnut, eR, 1.3, 0.6, { wob: 1.0, wl: 80 });
    // construction lines a grown-up left in: the edges carried on to where they would meet
    const va = at(LEN, HWID, HD), vb = at(LEN + 9, HWID, HD), vc = at(LEN, -HWID, HD), vd = at(LEN + 9, -HWID, HD);
    C.line(rng, T.graphite, K.graphite, [va[0], va[1], vb[0], vb[1]], 1.2, 0.5, { wob: 0.6, wl: 100, a1: 0.5, pe: 0.1 });
    C.line(rng, T.graphite, K.graphite, [vc[0], vc[1], vd[0], vd[1]], 1.2, 0.5, { wob: 0.6, wl: 100, a1: 0.5, pe: 0.1 });
  };
})(typeof self !== 'undefined' ? self : globalThis);
