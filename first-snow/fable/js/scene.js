'use strict';
// ---------------------------------------------------------------
// "First Snow, Orchard" -- composition and painting order
// ---------------------------------------------------------------
const HOR = 1190, VPX = 1330;
const WIN = { x: 1281, y: 1191 };           // window centre
function proj(X, z) { return { x: VPX + X * 875 / z, y: HOR + 1700 / z, h: 2630 / z, z: z }; }

// ---------- reference colour fields ----------
function skyCol(x, y) {
  const t = clamp(y / 1200, 0, 1);
  let c = grad([[0, C(12, 18, 48)], [0.3, C(20, 30, 74)], [0.56, C(36, 48, 102)], [0.78, C(64, 72, 130)],
    [0.92, C(100, 98, 148)], [1, C(126, 112, 152)]], t);
  const n = fbm(x / 1100 + 3.1, y / 300 + 7.7, 4), n2 = fbm(x / 380 + 11, y / 130 + 2, 3);
  const cl = sm(0.47, 0.7, n * 0.72 + n2 * 0.28);
  const cc = grad([[0, C(26, 26, 60)], [0.6, C(52, 50, 96)], [1, C(98, 88, 130)]], t);
  c = mix(c, cc, cl * 0.6);
  // lighter cloud undersides catching the last light
  const ed = sm(0.40, 0.47, n * 0.72 + n2 * 0.28) * (1 - cl) * sm(0.35, 0.9, t);
  c = mix(c, C(132, 124, 168), ed * 0.28);
  const g = Math.exp(-Math.pow((x - 1300) / 760, 2)) * sm(0.5, 1, t);
  c = mix(c, C(150, 126, 158), g * 0.34);
  // corners deepen
  const v = sm(0.5, 1.25, Math.hypot((x - 1200) / 1500, (y - 1250) / 1500));
  return mix(c, C(8, 10, 30), v * 0.45);
}
function warmAt(x, y) {
  if (y < 1284) return 0;
  const cx = WIN.x + (y - 1290) * 0.07, wd = 66 + (y - 1290) * 0.74;
  const fy = sm(1284, 1304, y) * Math.exp(-(y - 1296) / 250);
  return Math.exp(-Math.pow((x - cx) / wd, 2)) * fy;
}
function driftK(x, y) {
  const d = clamp((y - 1195) / 1505, 0, 1);
  const sx = 210 + 900 * d, sy = 16 + 560 * Math.pow(d, 1.3);
  const wx = x + (fbm(x / 800 + 2, y / 600 + 1, 2) - 0.5) * 420 * d;
  const n = fbm((wx + y * 0.45) / sx + 5, y / sy + 9, 4), n2 = fbm((wx - y * 0.6) / (sx * 0.4) + 1, y / (sy * 0.45) + 4, 3);
  return (n - 0.5) * 1.7 + (n2 - 0.5) * 0.5 * (1 - 0.6 * sm(0.5, 0.9, d));
}
function groundCol(x, y) {
  const d = clamp((y - 1195) / 1505, 0, 1);
  let c = grad([[0, C(110, 112, 162)], [0.1, C(94, 102, 158)], [0.35, C(72, 86, 150)], [0.7, C(52, 64, 128)], [1, C(36, 44, 98)]], d);
  const k = driftK(x, y);
  // lane: slightly lighter, smoother
  const lane = Math.exp(-Math.pow((x - VPX) / (60 + (y - HOR) * 0.62), 2));
  c = mix(c, C(118, 130, 190), lane * 0.22 * (1 - d * 0.5));
  if (k > 0) c = mix(c, C(152, 166, 214), clamp(k * 1.25, 0, 0.8) * (1 - 0.6 * sm(0.6, 0.95, d)));
  else c = mix(c, C(36, 34, 88), clamp(-k * 1.3, 0, 0.75));
  const w = warmAt(x, y);
  if (w > 0.003) {
    const wc = grad([[0, C(132, 92, 132)], [0.35, C(206, 118, 104)], [0.7, C(246, 160, 92)], [1, C(255, 206, 128)]], clamp(w * (1 + k * 0.5), 0, 1));
    c = mix(c, wc, clamp(w * 1.5, 0, 0.94));
  }
  const v = sm(0.55, 1.2, Math.hypot((x - 1250) / 1450, (y - 1300) / 1500));
  return mix(c, C(14, 14, 44), v * 0.6);
}
function treelineTop(x) {
  let t = 1124 - 44 * fbm(x / 240 + 2, 1.5, 3) - 22 * fbm(x / 60, 7.5, 2);
  t -= 70 * Math.exp(-Math.pow((x - 1340) / 380, 2));        // grove behind the house
  t += 30 * sm(1500, 2160, x) + 26 * sm(700, 0, x);
  return t;
}

function paintField(n, box, colFn, dirFn, o) {
  const [x0, y0, x1, y1] = box;
  const asp = (x1 - x0) / (y1 - y0);
  const ny = Math.max(1, Math.round(Math.sqrt(n / asp))), nx = Math.max(1, Math.round(n / ny));
  const order = [];
  for (let i = 0; i < nx * ny; i++) order.push(i);
  for (let i = order.length - 1; i > 0; i--) { const j = (R() * (i + 1)) | 0; const t = order[i]; order[i] = order[j]; order[j] = t; }
  for (const k of order) {
    const gx = k % nx, gy = (k / nx) | 0;
    const x = x0 + (gx + R()) / nx * (x1 - x0), y = y0 + (gy + R()) / ny * (y1 - y0);
    if (o.mask && !o.mask(x, y)) continue;
    const ws = o.wscale ? o.wscale(x, y) : 1;
    const len = rnd(o.len[0], o.len[1]) * ws, w = rnd(o.w[0], o.w[1]) * ws;
    const step = Math.max(5, w * 0.35);
    let a = dirFn(x, y);
    let px = x - Math.cos(a) * len * 0.5, py = y - Math.sin(a) * len * 0.5;
    const P = [px, py];
    const cv = o.straight ? gauss() * (o.curl === undefined ? 0.9 : o.curl) / len : 0;
    for (let s = 0; s < len; s += step) {
      if (o.straight) a += cv * step; else a = dirFn(px, py);
      px += Math.cos(a) * step; py += Math.sin(a) * step; P.push(px, py);
    }
    let col = jit(colFn(x, y), o.cj, o.lj2);
    if (o.acc && R() < 0.16) col = mix(col, o.acc[(R() * o.acc.length) | 0], rnd(0.12, 0.3));
    const col2 = jit(colFn(x + gauss() * w * 0.8, y + gauss() * w * 0.8), o.cj * 1.6, o.lj2);
    const so = Object.assign({}, o.s, { w: w, col: col, col2: col2 });
    stroke(P, so);
  }
}

// ---------------- trees ----------------
function genTree(bx, by, Ht, seed, o) {
  o = o || {};
  const rr = mulberry32(seed), U = (a, b) => a + rr() * (b - a);
  const B = [], tips = [];
  const maxD = o.maxD || 5, minW = o.minW || 1.25;
  const w0 = Ht * (o.tw || 0.072);
  const keep = o.keepOut;
  function walk(x, y, a, len, wa, wb, depth, targ, rate, kink) {
    const step = clamp(len / 10, 3.5, 24);
    const n = Math.max(2, Math.round(len / step));
    const pts = [x, y], angs = [a];
    for (let i = 1; i <= n; i++) {
      a += (rr() - 0.5) * kink; if (rr() < 0.13) a += (rr() - 0.5) * kink * 3.6;
      if (targ !== null) { let da = targ - a; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI; a += da * rate; }
      x += Math.cos(a) * step; y += Math.sin(a) * step;
      if (keep && keep.some(q => Math.hypot(x - q[0], y - q[1]) < q[2])) { break; }
      pts.push(x, y); angs.push(a);
    }
    const m = (pts.length >> 1) - 1;
    if (m >= 1) B.push({ pts: pts, w0: wa, w1: wb, depth: depth });
    return { pts: pts, angs: angs, n: m };
  }
  function grow(x, y, a, len, w, depth, targ) {
    w = Math.min(w, len * 0.085);
    if (w < minW * 0.8 || len < Ht * 0.012) { tips.push([x, y, a]); return; }
    const last = depth >= maxD || w < minW * 1.6;
    if (last) len *= 1.35;
    const wb = w * (last ? 0.4 : 0.6);
    const r = walk(x, y, a, len, w, wb, depth, last ? null : targ, depth === 1 ? 0.085 : 0.06, last ? 0.16 : depth <= 1 ? 0.3 : depth === 2 ? 0.4 : 0.4);
    const n = r.n; if (n < 1) return;
    if (last) { tips.push([r.pts[2 * n], r.pts[2 * n + 1], r.angs[n]]); return; }
    const nk = depth === 1 ? 3 + (rr() * 3 | 0) : depth === 2 ? 2 + (rr() * 2.5 | 0) : 1 + (rr() < 0.45 ? 1 : 0);
    for (let k = 0; k < nk; k++) {
      const t = U(0.2, 0.93); const i = clamp(Math.round(t * n), 1, n);
      const px = r.pts[2 * i], py = r.pts[2 * i + 1], ca = r.angs[i];
      let side = rr() < 0.5 ? 1 : -1;
      if (Math.sin(ca + side) > Math.sin(ca - side) && rr() < 0.78) side = -side;
      const na = ca + side * U(0.55, 1.2);
      const wl = (w + (wb - w) * t) * U(0.42, 0.66);
      const ll = len * U(0.42, 0.72) * (1 - 0.35 * t);
      const tg = rr() < 0.68 ? -Math.PI / 2 + U(-0.75, 0.75) : (Math.cos(na) > 0 ? U(-0.1, 0.6) : Math.PI - U(-0.1, 0.6));
      grow(px, py, na, ll, wl, depth + 1, tg);
    }
    const ex = r.pts[2 * n], ey = r.pts[2 * n + 1], ea = r.angs[n];
    const tg1 = rr() < 0.5 ? -Math.PI / 2 + U(-0.8, 0.8) : (Math.cos(ea) > 0 ? U(0, 0.7) : Math.PI - U(0, 0.7));
    grow(ex, ey, ea + U(0.15, 0.55), len * U(0.45, 0.7), wb * 0.88, depth + 1, tg1);
    if (depth < 3 || rr() < 0.6) grow(ex, ey, ea - U(0.15, 0.55), len * U(0.4, 0.62), wb * 0.74, depth + 1, -Math.PI / 2 + U(-0.9, 0.9));
  }
  // trunk
  const lean = o.lean || 0;
  const tl = Ht * (o.trunk || 0.3);
  const tr = walk(bx, by, -Math.PI / 2 + lean, tl, w0, w0 * 0.78, 0, -Math.PI / 2 + lean * 0.3, 0.05, 0.16);
  B[B.length - 1].trunk = true;
  const tx = tr.pts[2 * tr.n], ty = tr.pts[2 * tr.n + 1];
  const sc = o.scaff || (function () {
    const k = 3 + (rr() * 2 | 0), a = [];
    for (let i = 0; i < k; i++) {
      const f = k === 1 ? 0.5 : i / (k - 1);
      a.push({ a: -148 + f * 116 + U(-10, 10), l: U(0.42, 0.6), w: U(0.5, 0.72) });
    }
    return a;
  })();
  for (const s of sc) {
    const a = s.a * Math.PI / 180;
    const targ = s.t !== undefined ? s.t * Math.PI / 180 : (Math.cos(a) > 0.25 ? -0.22 : Math.cos(a) < -0.25 ? -Math.PI + 0.22 : -Math.PI / 2 + U(-0.3, 0.3));
    grow(tx, ty, a, Ht * s.l, w0 * 0.78 * s.w, 1, targ);
  }
  return { branches: B, tips: tips, bx: bx, by: by, Ht: Ht, w0: w0, top: [tx, ty] };
}

const HAZE = C(84, 84, 132);
function paintBranch(b, o) {
  const hz = o.haze, P = b.pts, w = b.w0, r = b.w1 / b.w0, n = (P.length >> 1) - 1;
  const prof = b.trunk ? (t => lerp(1, r, t) + 0.5 * Math.pow(1 - sm(0, 0.2, t), 1.5)) : (t => lerp(1, r, t));
  const dark = mix(C(13, 9, 18), HAZE, hz * 0.8);
  const dark2 = mix(C(34, 19, 25), HAZE, hz * 0.85);
  const lit = mix(C(60, 62, 98), C(104, 106, 152), hz);
  if (w < 5) {
    stroke(P, { w: Math.max(w, 1.1) * rnd(0.9, 1.25), col: jit(dark, 0.03), col2: dark2, alpha: (0.94 - hz * 0.35) * rnd(0.6, 1), prof: prof, thick: 0.15, dry: rnd(0.3, 0.75), press: 0.92, bk: 0.5, wk: 0.45 + hz * 0.3, soft: 0.3 + hz * 0.3, rag: 0.15, flat: 0.5 });
    return;
  }
  stroke(P, { w: w, col: jit(dark, 0.02), col2: dark2, alpha: 0.97 - hz * 0.25, prof: prof, thick: 0.22, dry: 0.15, bk: 0.35, wk: 0.15 + hz * 0.3, soft: 0.16 + hz * 0.35, rag: 0.25, mixv: 0.8, flat: 0.8 });
  if (w < 15) {
    // broken touches: sky light on the upper edge, warm dark below
    for (let i0 = 0; i0 < n;) {
      const i1 = Math.min(n, i0 + 1 + (R() * 4 | 0));
      const wl = w * lerp(1, r, (i0 + i1) / (2 * n));
      if (R() < 0.7) stroke(offsetPath(subPath(P, i0, i1), wl * 0.24, -0.5, -0.86), { w: wl * rnd(0.3, 0.5), col: jit(mix(dark2, lit, rnd(0.4, 1)), 0.05), col2: dark2, alpha: rnd(0.4, 0.75), prof: 'lens', thick: 0.3, dry: 0.7, bk: 0.8, wk: 0.4, soft: 0.5 });
      if (hz < 0.5 && R() < 0.4) stroke(offsetPath(subPath(P, i0, i1), wl * 0.26, 0.5, 0.86), { w: wl * 0.3, col: jit(C(50, 24, 24), 0.04), alpha: 0.5, prof: 'lens', thick: 0.1, dry: 0.7, bk: 0.8, wk: 0.4, soft: 0.5 });
      i0 = i1;
    }
    return;
  }
  // heavy limb / trunk: bark built from many strokes running along the form
  const cnt = Math.round(w / 1.7 * Math.max(1, n / 7));
  for (let k = 0; k < cnt; k++) {
    const i0 = (b.trunk ? 1 : 0) + (R() * (n - 1)) | 0, i1 = Math.min(n, i0 + 1 + (R() * 4 | 0));
    if (i0 >= i1) continue;
    const tm = (i0 + i1) / (2 * n);
    const wl = w * prof(tm);
    const off = (R() * 2 - 1) * 0.47;
    let c;
    const q = R();
    if (off < -0.14) c = mix(C(24, 20, 38), lit, sm(-0.12, -0.47, off) * (0.3 + 0.75 * R()));
    else if (off > 0.15) c = mix(C(16, 9, 15), C(7, 5, 11), R());
    else c = mix(C(15, 10, 18), C(36, 21, 25), R() * R());
    if (q < 0.1) c = mix(c, C(66, 38, 30), 0.55);
    else if (q < 0.16) c = mix(c, C(40, 50, 52), 0.5);
    else if (q < 0.24) c = mix(c, C(40, 28, 66), 0.55);
    c = mix(c, HAZE, hz * 0.8);
    const sub = offsetPath(subPath(P, i0, i1), wl * off, -0.5, -0.86);
    for (let j = 0; j < sub.length; j++) sub[j] += gauss() * wl * 0.03;
    const fine = R() < 0.3;
    stroke(sub, { w: fine ? rnd(2, 5) : wl * rnd(0.08, 0.26), col: jit(fine ? mix(c, C(5, 4, 9), 0.7) : c, 0.02), col2: jit(c, 0.06), alpha: rnd(0.6, 0.97), prof: 'lens', thick: fine ? 0.1 : rnd(0.25, 0.8), dry: rnd(0.3, 0.8), bk: 0.8, wk: 0.3, soft: 0.35, rag: 0.4, bs: 2.0 });
  }
}

const CAP = t => 0.22 + 0.78 * sm(0, 0.16, t) * (1 - sm(0.84, 1, t));
function snowBranch(b, o) {
  const P = b.pts, n = P.length >> 1, hz = o.haze;
  if (b.trunk) return;
  const sSh = mix(C(78, 90, 152), C(96, 102, 152), hz), sHi = mix(C(178, 192, 230), C(134, 144, 194), hz);
  const minS = lerp(2.2, 1.2, hz);
  let run = [], runW = 0;
  const flush = () => {
    if (run.length >= 2) {
      const m = run.length, Q1 = [], Q2 = [];
      const wl = runW / m;
      const sd = clamp(wl * 0.3 + minS, minS, 15);
      const lift = 0.7 + 0.5 * R();
      for (const i of run) {
        const a = Math.max(0, i - 1), c = Math.min(n - 1, i + 1);
        let tx = P[2 * c] - P[2 * a], ty = P[2 * c + 1] - P[2 * a + 1];
        const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
        let nx = -ty, ny = tx; if (ny > 0) { nx = -nx; ny = -ny; }
        const wi = lerp(b.w0, b.w1, i / (n - 1));
        const o1 = wi * 0.42 + sd * 0.1, o2 = wi * 0.42 + sd * 0.4 * lift;
        Q1.push(P[2 * i] + nx * o1, P[2 * i + 1] + ny * o1);
        Q2.push(P[2 * i] + nx * o2 + gauss() * 0.5, P[2 * i + 1] + ny * o2 - sd * 0.1 + gauss() * 0.5);
      }
      const mx = Q1[0], my = Q1[1];
      const dw = Math.hypot(mx - WIN.x, my - WIN.y);
      const wf = o.warm ? Math.exp(-dw / 300) * 1.3 : 0;
      const br = 0.45 + 0.55 * R();
      let hi = mix(sSh, sHi, br), sh = sSh;
      if (wf > 0.02) { hi = mix(hi, C(255, 190, 130), clamp(wf, 0, 0.85)); sh = mix(sh, C(170, 108, 120), clamp(wf * 0.8, 0, 0.7)); }
      if (wl < 3.2) {
        stroke(Q1, { w: sd * 1.0, col: jit(mix(sh, hi, 0.6), 0.03), col2: hi, alpha: 0.88, prof: CAP, thick: 0.6, dry: 0.4, bk: 0.6, wk: 0.3, soft: 0.4, rag: 0.25 });
      } else {
        stroke(Q1, { w: sd * 1.3, col: jit(sh, 0.03), col2: mix(sh, hi, 0.4), alpha: 0.93, prof: CAP, thick: 0.5, dry: 0.3, bk: 0.5, wk: 0.25, soft: 0.4, rag: 0.35 });
        stroke(Q2, { w: sd * 0.72, col: jit(hi, 0.03), col2: mix(hi, sh, 0.4), alpha: 0.95, prof: CAP, thick: 1.7 + Math.min(1, wl / 40), dry: 0.55, bk: 0.85, wk: 0.3, soft: 0.3, rag: 0.45, ridge: 1 });
        if (wl > 18) {
          // loaded dabs of thick paint on the heavy limbs
          for (let k = 0; k < m; k++) {
            if (R() < 0.45) continue;
            const j = (R() * (m - 1)) | 0;
            const x0 = Q2[2 * j], y0 = Q2[2 * j + 1], x1 = Q2[2 * j + 2], y1 = Q2[2 * j + 3];
            stroke([x0, y0 - sd * 0.15, lerp(x0, x1, 0.6) + gauss(), lerp(y0, y1, 0.6) - sd * 0.2], { w: sd * rnd(0.4, 0.7), col: jit(mix(hi, C(204, 214, 240), 0.5), 0.03), alpha: 0.9, prof: 'lens', thick: 2.0, dry: 0.3, bk: 0.7, wk: 0.2, soft: 0.3, ridge: 1.2 });
          }
        }
      }
    }
    run = []; runW = 0;
  };
  const thr = b.w0 < 4 ? 0.55 : 0.38;
  const skip = b.w0 < 3 ? 0.35 + hz * 0.5 : hz * 0.3;       // not every twig holds snow
  if (R() < skip) return;
  let gap = 0;
  for (let i = 0; i < n; i++) {
    const a = Math.max(0, i - 1), c = Math.min(n - 1, i + 1);
    const tx = P[2 * c] - P[2 * a], ty = P[2 * c + 1] - P[2 * a + 1];
    const hzn = Math.abs(tx) / (Math.hypot(tx, ty) || 1);
    if (gap > 0) { gap--; continue; }
    if (hzn > thr) { run.push(i); runW += lerp(b.w0, b.w1, i / (n - 1)); }
    else flush();
    if (run.length > 2 + R() * 6) { flush(); if (R() < 0.45) gap = 1 + (R() * 2 | 0); }
  }
  flush();
}

function paintApple(x, y, r, o) {
  const hz = o.haze;
  const d = mix(C(92, 10, 22), HAZE, hz * 0.6), m = mix(C(172, 24, 30), HAZE, hz * 0.5), h = mix(C(226, 86, 60), HAZE, hz * 0.45);
  stroke([x + r * 0.1, y - r * 2.0, x, y - r * 0.7], { w: Math.max(1.2, r * 0.16), col: C(22, 14, 20), alpha: 0.9, thick: 0.1, dry: 0, bk: 0.1, wk: 0.1 });
  dab(x, y, r, { col: jit(d, 0.03), col2: m, alpha: 0.98, thick: 0.8, dry: 0, bk: 0.3, wk: 0.1, soft: 0.22, rag: 0.2, mixv: 0.6, el: 0.12 });
  stroke(arc(x - r * 0.55, y + r * 0.1, -1.1, r * 1.0, 0.9 / r, 0, 2), { w: r * 0.8, col: jit(m, 0.04), col2: h, alpha: 0.92, prof: 'lens', thick: 1.1, dry: 0.2, bk: 0.5, wk: 0.1, soft: 0.5, mixv: 0.6 });
  dab(x - r * 0.36, y - r * 0.3, r * 0.24, { col: h, alpha: 0.6, thick: 1.2, dry: 0, bk: 0.3, wk: 0, soft: 0.6 });
  stroke(arc(x - r * 0.6, y - r * 0.62, -0.5, r * 1.15, 0.8 / r, 0, 2), { w: r * 0.36, col: mix(C(168, 182, 226), HAZE, hz * 0.4), col2: C(110, 124, 184), alpha: 0.9, prof: 'lens', thick: 1.5, dry: 0.1, bk: 0.4, wk: 0.1, soft: 0.35 });
}

function paintTree(T, o) {
  const s = T.Ht / 1000;
  const br = T.branches.slice().sort((a, b) => a.w0 - b.w0);
  if (o.haze < 0.62) for (const b of br) {
    if (b.w0 > 4.5 * Math.max(0.6, s) || R() < 0.45) continue;
    stroke(b.pts, { w: rnd(10, 28) * Math.max(0.5, s * 1.1), col: mix(C(28, 22, 50), HAZE, o.haze * 0.7), alpha: 0.2, press: 0.62, thick: 0.05, flat: 0.1, dry: 0.3, bk: 0.8, wk: 0.9, soft: 0.8, prof: 'lens' });
  }
  for (const b of br) paintBranch(b, o);
  // a few short fruiting spurs
  if (o.spurs) {
    for (const b of br) {
      if (b.w0 > 14 * Math.max(0.6, s) || b.w0 < 2.5 || b.trunk) continue;
      const n = (b.pts.length >> 1) - 1;
      const k = Math.round(n * o.spurs);
      for (let j = 0; j < k; j++) {
        const i = 1 + (R() * (n - 1) | 0);
        const x = b.pts[2 * i], y = b.pts[2 * i + 1];
        const a = -Math.PI / 2 + gauss() * 0.7, l = rnd(8, 22) * Math.max(0.5, s * 0.9);
        stroke(arc(x, y, a, l, gauss() * 0.01, 0.2, 4), { w: rnd(1.4, 2.6) * Math.max(0.7, s), col: mix(C(18, 12, 22), HAZE, o.haze * 0.8), alpha: 0.85, prof: 'taper', thick: 0.1, dry: 0.2, bk: 0.2, wk: 0.1, soft: 0.3 });
      }
    }
  }
  for (const b of br) snowBranch(b, o);
  const tr = T.branches.find(b => b.trunk);
  if (tr && T.w0 > 14) {
    const P = tr.pts, n = (P.length >> 1) - 1, w = T.w0;
    const sSh = mix(C(80, 92, 154), HAZE, o.haze * 0.5), sHi = mix(C(176, 190, 228), HAZE, o.haze * 0.5);
    const cnt = Math.round(3 + w / 22);
    for (let k = 0; k < cnt; k++) {
      const i0 = 1 + (R() * (n - 2) | 0), i1 = Math.min(n, i0 + 1 + (R() * 3 | 0));
      const off = rnd(0.3, 0.5) * w * 0.8;
      const sub = offsetPath(subPath(P, i0, i1), off, -1, -0.25);
      const ww = w * rnd(0.05, 0.12);
      stroke(sub, { w: ww * 1.4, col: jit(sSh, 0.03), alpha: 0.8, prof: 'tail', thick: 0.5, dry: 0.8, bk: 0.9, wk: 0.5, soft: 0.55, rag: 0.6 });
      if (R() < 0.6) stroke(offsetPath(sub, ww * 0.3, -1, -0.5), { w: ww * 0.7, col: jit(mix(sSh, sHi, 0.6), 0.03), col2: sSh, alpha: 0.8, prof: 'tail', thick: 1.2, dry: 0.8, bk: 0.9, wk: 0.5, soft: 0.45, rag: 0.6 });
    }
    const cx = T.top[0], cy = T.top[1];
    for (let k = 0; k < 3; k++) {
      const x = cx + gauss() * w * 0.12, y = cy + rnd(-0.05, 0.12) * w;
      stroke(arc(x - w * 0.12, y, rnd(-0.25, 0.25), w * rnd(0.18, 0.3), 0, 0.2, 4), { w: w * rnd(0.08, 0.14), col: jit(k < 2 ? sSh : sHi, 0.03), col2: sSh, alpha: 0.93, prof: 'lens', thick: 1.5, dry: 0.3, bk: 0.6, wk: 0.2, soft: 0.35 });
    }
  }
  if (o.warm) {
    for (const b of br) {
      if (b.w0 < 3) continue;
      const P = b.pts, mx = P[0], my = P[1];
      const dw = Math.hypot(mx - WIN.x, my - WIN.y);
      const wf = Math.exp(-dw / 240);
      if (wf < 0.05) continue;
      stroke(offsetPath(P, b.w0 * 0.3, WIN.x - mx, WIN.y - my), { w: Math.max(1.6, b.w0 * 0.3), col: C(226, 120, 70), col2: C(150, 70, 60), alpha: clamp(wf * 1.6, 0, 0.85), prof: t => lerp(1, b.w1 / b.w0, t), thick: 0.5, dry: 0.5, bk: 0.7, wk: 0.3, soft: 0.5 });
    }
  }
  const na = o.apples || 0;
  if (na) {
    const cand = T.tips.filter(t => t[1] < T.by - T.Ht * 0.3 && t[1] > T.by - T.Ht * 0.9 && (!o.appleBox || (t[0] > o.appleBox[0] && t[0] < o.appleBox[2] && t[1] > o.appleBox[1] && t[1] < o.appleBox[3])));
    const used = [];
    let tries = 0;
    while (used.length < na && tries++ < 400 && cand.length) {
      const t = cand[(R() * cand.length) | 0];
      const r = (o.appleR || 13) * rnd(0.85, 1.15);
      const ax = t[0] + gauss() * r * 0.3, ay = t[1] + r * 1.9;
      if (used.some(u => Math.hypot(u[0] - ax, u[1] - ay) < r * 5)) continue;
      used.push([ax, ay]);
      paintApple(ax, ay, r, o);
    }
  }
}

function treeBase(T, o) {
  const s = T.Ht / 1000, x = T.bx, y = T.by, w = T.w0;
  for (let k = 0; k < 8; k++) {
    const yy = y + rnd(-0.1, 0.45) * w, xx = x + gauss() * w * 0.7;
    const c = mix(C(26, 26, 74), groundCol(xx, yy), 0.4 + o.haze * 0.4);
    stroke(seg(xx - w * rnd(1.2, 3), yy + gauss() * 3 * s, xx + w * rnd(1.2, 3), yy + gauss() * 3 * s, w * 0.05), { w: w * rnd(0.3, 0.6), col: jit(c, 0.03), alpha: 0.45, prof: 'lens', thick: 0.1, dry: 0.5, bk: 0.6, wk: 0.5, soft: 0.7 });
  }
}
function treeFoot(T, o) {
  const x = T.bx, y = T.by, w = T.w0;
  const n = 9 + Math.round(w / 14);
  for (let k = 0; k < n; k++) {
    const f = k / (n - 1);
    const yy = y + lerp(-0.3, 0.62, f) * w, xx = x + gauss() * w * 0.3;
    const g = groundCol(xx, yy + w * 0.5);
    const c = mix(mix(C(92, 104, 166), C(162, 176, 222), R() * (1 - f * 0.6)), g, 0.3 + f * 0.5 + o.haze * 0.2);
    const hl = w * lerp(0.85, 1.4, f) * rnd(0.8, 1.1);
    stroke(arc(xx - hl * rnd(0.6, 1.1), yy + gauss() * w * 0.05, gauss() * 0.09, hl * rnd(1.3, 2), gauss() * 0.06 / hl, 0.03, 6), { w: w * rnd(0.24, 0.46), col: jit(c, 0.03), col2: g, alpha: 0.96, prof: R() < 0.5 ? 'tail' : 'lens', thick: 0.6 + 0.9 * R(), dry: 0.6, bk: 0.75, wk: 0.35, soft: 0.45 });
  }
}

// ---------------- the painting ----------------
function paintScene(stage) {
  reseed(71183);
  // ===== SKY =====
  const skyBox = [-80, -80, PW + 80, 1240];
  const skyAcc = [C(30, 70, 110), C(70, 50, 120), C(96, 84, 128), C(20, 30, 90)];
  paintField(320, skyBox, skyCol, () => -0.45 + gauss() * 0.5, { straight: true, len: [380, 760], w: [110, 190], cj: 0.03, acc: skyAcc, s: { alpha: 1, thick: 0.3, dry: 0.3, bk: 0.5, wk: 0.25, soft: 0.2 } });
  paintField(1400, skyBox, skyCol, () => (R() < 0.6 ? 0.5 : -0.3) + gauss() * 0.5, { straight: true, len: [150, 380], w: [44, 96], cj: 0.045, acc: skyAcc, s: { alpha: 0.9, thick: 0.36, dry: 0.6, bk: 0.6, wk: 0.35, soft: 0.3 } });
  paintField(1900, skyBox, skyCol, (x, y) => gauss() * (0.7 - 0.5 * sm(600, 1200, y)), { straight: true, len: [70, 220], w: [18, 44], cj: 0.05, acc: skyAcc, s: { alpha: 0.82, thick: 0.4, dry: 0.7, bk: 0.7, wk: 0.4, soft: 0.35 } });
  paintField(460, [-50, 740, PW + 50, 1200], (x, y) => mix(skyCol(x, y), C(156, 140, 178), 0.32), () => gauss() * 0.16, { straight: true, len: [100, 340], w: [14, 40], cj: 0.04, s: { alpha: 0.6, press: 0.62, thick: 0.45, dry: 0.5, bk: 0.8, wk: 0.7, soft: 0.4 } });
  if (stage < 2) return;

  // ===== FAR TREELINE =====
  for (let pass = 0; pass < 2; pass++) {
    for (let x = -30; x < PW + 30; x += rnd(7, 16)) {
      const top = treelineTop(x) + rnd(-8, 12) + pass * 14;
      const bot = 1232 + rnd(-6, 10);
      const hzz = 0.5 + 0.5 * fbm(x / 500, 3, 2);
      const cT = mix(C(50, 50, 96), C(74, 72, 118), hzz * (1 - pass * 0.5));
      const cB = mix(C(34, 34, 74), C(52, 52, 98), hzz);
      const lean = gauss() * 0.06;
      stroke(seg(x, top, x + lean * 80, top + (bot - top) * 0.55, 3), { w: rnd(14, 34), col: jit(cT, 0.03), col2: cB, alpha: 0.85, prof: 'tail', thick: 0.3, dry: 0.3, bk: 0.6, wk: 0.4, soft: 0.5, rag: 0.5 });
      stroke(seg(x + rnd(-6, 6), top + (bot - top) * 0.4, x + rnd(-6, 6), bot, 3), { w: rnd(18, 36), col: jit(cB, 0.03), alpha: 0.9, thick: 0.25, dry: 0.3, bk: 0.5, wk: 0.4, soft: 0.5 });
    }
  }
  if (stage < 3) return;

  // ===== GROUND =====
  const gDir = (x, y) => {
    const d = clamp((y - HOR) / 1500, 0, 1), e = 6 + 30 * d;
    const gx = driftK(x + e, y) - driftK(x - e, y), gy = driftK(x, y + e) - driftK(x, y - e);
    let a = Math.atan2(gx, -gy);
    if (a > Math.PI / 2) a -= Math.PI; if (a < -Math.PI / 2) a += Math.PI;
    const lim = 0.1 + 0.42 * d;
    return clamp(a, -lim, lim) + gauss() * (0.04 + 0.12 * d);
  };
  const gScale = (x, y) => 0.22 + 1.25 * Math.pow(clamp((y - HOR) / 1400, 0, 1), 1.15);
  const gBox = [-80, 1200, PW + 80, PH + 80];
  const gAcc = [C(40, 90, 130), C(96, 70, 140), C(120, 110, 150), C(30, 40, 110)];
  paintField(520, gBox, groundCol, gDir, { straight: true, len: [380, 800], w: [110, 190], cj: 0.03, curl: 0.3, acc: gAcc, wscale: gScale, s: { alpha: 1, thick: 0.35, dry: 0.3, bk: 0.5, wk: 0.25, soft: 0.2 } });
  paintField(2600, gBox, groundCol, gDir, { straight: true, len: [170, 420], w: [40, 90], cj: 0.045, curl: 0.3, acc: gAcc, wscale: gScale, s: { alpha: 0.93, thick: 0.4, dry: 0.6, bk: 0.6, wk: 0.35, soft: 0.25 } });
  paintField(5200, gBox, groundCol, gDir, { straight: true, len: [80, 240], w: [14, 40], cj: 0.05, curl: 0.3, acc: gAcc, wscale: gScale, s: { alpha: 0.88, thick: 0.45, dry: 0.7, bk: 0.7, wk: 0.4, soft: 0.3 } });
  for (let x = -20; x < PW + 20; x += rnd(18, 40)) {
    const y = 1232 + rnd(-8, 10);
    stroke(seg(x, y, x + rnd(60, 160), y + rnd(-5, 5), 3), { w: rnd(8, 18), col: jit(groundCol(x, 1240), 0.03), alpha: 0.7, prof: 'lens', thick: 0.4, dry: 0.6, bk: 0.7, wk: 0.5, soft: 0.6 });
  }
  // thin transparent darks in the hollows
  for (let k = 0; k < 500; k++) {
    const x = rnd(-40, PW + 40), y = 1230 + Math.pow(R(), 0.75) * 1500;
    const kk = driftK(x, y); if (kk > -0.14) continue;
    const d = clamp((y - HOR) / 1500, 0, 1), sc = 0.2 + 0.8 * d, len = rnd(140, 460) * sc;
    const c = mix(groundCol(x, y), R() < 0.5 ? C(28, 22, 78) : C(20, 34, 84), 0.5);
    const a = gDir(x, y);
    stroke(arc(x - Math.cos(a) * len / 2, y - Math.sin(a) * len / 2, a, len, gauss() * 0.6 / len, 0.1, 8), { w: rnd(20, 64) * sc, col: jit(c, 0.03), alpha: 0.5, prof: 'tail', thick: 0.05, flat: 0.3, dry: 0.6, bk: 0.7, wk: 0.7, soft: 0.6 });
  }
  // impasto slabs on the crests of the drifts
  for (let k = 0; k < 800; k++) {
    const x = rnd(-40, PW + 40), y = 1218 + Math.pow(R(), 0.75) * 1500;
    const kk = driftK(x, y); if (kk < 0.16) continue;
    const d = clamp((y - HOR) / 1500, 0, 1), sc = 0.2 + 0.8 * d, len = rnd(90, 320) * sc;
    const base = groundCol(x, y), wv = warmAt(x, y);
    const c = mix(base, wv > 0.3 ? C(255, 214, 150) : C(172, 186, 228), (0.14 + 0.24 * R()) * clamp(kk * 3, 0.4, 1) * (1 - 0.7 * sm(0.5, 0.9, d)));
    const a = gDir(x, y);
    stroke(arc(x - Math.cos(a) * len / 2, y - Math.sin(a) * len / 2, a, len, gauss() * 0.8 / len, 0.12, 8), { w: rnd(30, 90) * sc, col: jit(c, 0.03), col2: base, alpha: 0.8, prof: R() < 0.5 ? 'tail' : 'flat', thick: 0.9 + 1.0 * R(), dry: 0.75, bk: 0.85, wk: 0.5, soft: 0.4, ridge: 1 });
  }
  // a single line of footprints leading home, already softening under the new snow
  {
    const fx = y => { const t = clamp((y - 1300) / 1400, 0, 1); return lerp(1392, 1150, Math.pow(t, 0.85)) + Math.sin(t * 5.2) * 46 * t + (fbm(y / 200, 4.4, 2) - 0.5) * 50 * t; };
    let side = 1;
    for (let y = 1312; y < PH + 60;) {
      const d = clamp((y - HOR) / 1500, 0, 1), sc = 0.1 + 0.9 * d;
      const x = fx(y) + side * 20 * sc + gauss() * 4 * sc, yy = y + gauss() * 4 * sc;
      const g = groundCol(x, yy), wv = warmAt(x, yy);
      const L = 26 * sc + 1.5, Wd = 28 * sc + 2, tl = gauss() * 0.15;
      const dk = mix(g, wv > 0.12 ? C(84, 36, 64) : C(14, 14, 56), 0.78);
      stroke([x - L, yy - tl * L, x, yy, x + L, yy + tl * L], { w: Wd, col: jit(dk, 0.03), col2: g, alpha: 0.9, prof: 'lens', thick: 0.05, flat: 0.6, dry: 0.2, bk: 0.5, wk: 0.4, soft: 0.5 });
      stroke([x - L * 0.9, yy + Wd * 0.52, x + L * 0.95, yy + Wd * 0.5], { w: Wd * 0.42, col: jit(mix(g, wv > 0.12 ? C(255, 204, 146) : C(168, 182, 226), 0.5), 0.03), alpha: 0.8, prof: 'lens', thick: 1.4, dry: 0.5, bk: 0.8, wk: 0.4, soft: 0.45 });
      y += 60 * sc * rnd(0.9, 1.15) + 5; side = -side;
    }
  }
  if (stage < 4) return;

  paintHouse();
  if (stage < 5) return;

  // ===== ORCHARD =====
  const trees = [];
  const addRow = (X, zs, seed0, opt) => zs.forEach((z, i) => trees.push(Object.assign({ X: X, z: z, seed: seed0 + i * 17 }, opt || {})));
  addRow(-11, [9.8, 14], 300); addRow(-7.5, [6.6, 9.5, 13.5], 400); addRow(-4.6, [4.4, 6.4, 9.2], 500);
  addRow(-2.2, [4.2, 6.2], 617); addRow(2.2, [2.5], 700); addRow(2.75, [5.2], 717);
  addRow(4.6, [7.2, 10], 817); addRow(7.5, [11, 15], 900);
  trees.push({ X: -1.75, z: 1.35, seed: 4242, hero: true });
  trees.sort((a, b) => b.z - a.z);
  for (const t of trees) {
    const p = proj(t.X, t.z);
    const haze = clamp((t.z - 1.3) / 11, 0, 0.82);
    const o = { haze: haze, warm: t.z > 5, spurs: 0 };
    let T;
    if (t.hero) {
      T = genTree(p.x, p.y, p.h, t.seed, { lean: 0.15, maxD: 6, tw: 0.086, trunk: 0.36, keepOut: [[1330, 1130, 330]],
        scaff: [{ a: -124, l: 0.33, w: 0.55 }, { a: -95, l: 0.45, w: 0.7, t: -85 }, { a: -66, l: 0.47, w: 0.8, t: -36 }, { a: -30, l: 0.2, w: 0.38, t: -8 }] });
      o.apples = 6; o.appleR = 15; o.appleBox = [300, 600, 1150, 1500];
    } else {
      T = genTree(p.x + gauss() * 20 / t.z, p.y, p.h * rnd(0.86, 1.08), t.seed, { lean: gauss() * 0.14, maxD: t.z < 4 ? 5 : t.z < 7 ? 4 : 3, keepOut: [[WIN.x, WIN.y - 10, 125]] });
      o.apples = t.z < 3 ? 3 : t.z < 6 ? 2 : (R() < 0.4 ? 1 : 0); o.appleR = clamp(15 * 1.35 / t.z, 3.2, 12);
    }
    treeBase(T, o);
    paintTree(T, o);
    treeFoot(T, o);
  }
  if (stage < 6) return;
  paintForeground();
  if (stage < 7) return;
  paintSnowfall();
}

function paintHouse() {
  // dark firs of the windbreak behind the house
  const firs = [[1010, 1090, 40], [1066, 1050, 46], [1124, 1000, 54], [1190, 950, 60], [1262, 978, 56], [1350, 936, 62], [1432, 966, 58], [1512, 928, 64], [1584, 990, 56], [1642, 1040, 48], [1700, 1084, 40]];
  for (const f of firs) {
    const [fx, ft, fw] = f, fb = 1264;
    if (fx > 1150 && fx < 1560) continue;
    stroke(seg(fx, ft + 4, fx, fb, 1.5), { w: 6, col: C(16, 16, 40), alpha: 0.9, prof: t => 0.25 + 0.75 * t, thick: 0.3, dry: 0.2, soft: 0.4 });
    for (let k = 0; k < 44; k++) {
      const t = Math.pow(R(), 0.8), y = lerp(ft, fb, t), hw = fw * (0.06 + 0.94 * t);
      const sd = R() < 0.5 ? -1 : 1;
      const c = mix(C(18, 20, 46), C(38, 40, 82), R() * 0.6 + (1 - t) * 0.2);
      stroke(arc(fx, y - 4, sd > 0 ? rnd(0.25, 0.6) : Math.PI - rnd(0.25, 0.6), hw * rnd(0.6, 1.1), sd * 0.004, 0.3, 4), { w: 3 + 15 * t, col: jit(c, 0.02), col2: C(26, 24, 58), alpha: 0.9, prof: 'taper', thick: 0.3, dry: 0.5, bk: 0.7, wk: 0.35, soft: 0.4, rag: 0.5 });
    }
    for (let k = 0; k < 10; k++) {
      const t = Math.pow(R(), 0.7), y = lerp(ft + 8, fb - 20, t), hw = fw * (0.12 + 0.88 * t), sd = R() < 0.5 ? -1 : 1;
      stroke(arc(fx + sd * hw * rnd(0.1, 0.5), y, sd > 0 ? rnd(0.3, 0.6) : Math.PI - rnd(0.3, 0.6), hw * rnd(0.3, 0.6), 0, 0.2, 4), { w: rnd(3, 6), col: jit(C(100, 110, 166), 0.03), alpha: 0.7, prof: 'lens', thick: 0.7, dry: 0.5, bk: 0.7, wk: 0.4, soft: 0.4 });
    }
  }
  E.tf = { cx: 1330, cy: 1290, k: 1.3 };
  const wall = C(34, 24, 38), wallD = C(18, 13, 26);
  for (let y = 1208; y < 1290; y += 7) stroke(seg(1118, y, 1186, y, 1), { w: 10, col: jit(C(26, 19, 32), 0.02), col2: wall, alpha: 0.96, thick: 0.25, dry: 0.3, bk: 0.5, wk: 0.2, soft: 0.2 });
  for (let y = 1146; y < 1290; y += 6) {
    const t = (y - 1146) / 144;
    const c = mix(mix(wall, C(48, 34, 44), R() * 0.6), C(46, 44, 78), sm(0.6, 1, t) * 0.5);
    stroke(seg(1180, y + rnd(-1, 1), 1444, y + rnd(-1, 1), 1), { w: rnd(7, 10), col: jit(c, 0.02), col2: jit(wallD, 0.02), alpha: 0.97, thick: 0.25, dry: 0.3, bk: 0.5, wk: 0.2, soft: 0.2, mixv: 0.5 });
  }
  for (let x = 1446; x < 1522; x += 6) {
    const t = (x - 1446) / 76, top = x < 1484 ? lerp(1143, 1066, (x - 1446) / 38) : lerp(1066, 1134, (x - 1484) / 38);
    stroke(seg(x, top + 3, x, 1288 - t * 8, 1), { w: 8, col: jit(mix(wallD, C(28, 22, 46), R() * 0.6), 0.02), alpha: 0.97, thick: 0.25, dry: 0.3, bk: 0.5, wk: 0.2, soft: 0.2 });
  }
  const roofL = C(118, 130, 186), roofD = C(76, 88, 150);
  for (let k = 0; k < 90; k++) {
    const v = k < 14 ? k / 14 : R(), f = R();
    const y = lerp(1068, 1142, v);
    const xl = lerp(1210, 1168, v), xr = lerp(1482, 1450, v);
    const x = lerp(xl, xr, f), l = rnd(30, 110);
    const c = mix(roofD, roofL, clamp(0.75 - 0.9 * v + 0.5 * sm(0.75, 1, v) + (fbm(f * 5, v * 3, 2) - 0.5) * 0.8, 0, 1));
    stroke(seg(Math.max(xl + 3, x - l / 2), y + rnd(-2, 2), Math.min(xr - 3, x + l / 2), y + rnd(-2, 2) - 1, 1.5), { w: rnd(9, 15), col: jit(c, 0.03), col2: roofD, alpha: 0.95, prof: R() < 0.5 ? 'tail' : 'flat', thick: 0.8, dry: 0.5, bk: 0.7, wk: 0.25, soft: 0.35 });
  }
  stroke(seg(1118, 1206, 1184, 1196, 1), { w: 12, col: roofL, col2: roofD, alpha: 0.97, thick: 0.9, dry: 0.3, soft: 0.3 });
  stroke(seg(1114, 1214, 1184, 1205, 1), { w: 4, col: C(14, 10, 20), alpha: 0.9, thick: 0.1, dry: 0.2, soft: 0.3 });
  stroke(seg(1208, 1063, 1484, 1060, 1.5), { w: 7, col: C(168, 180, 222), col2: roofL, alpha: 0.95, thick: 1.5, dry: 0.3, bk: 0.6, soft: 0.3 });
  stroke(seg(1166, 1153, 1450, 1153, 1), { w: 6, col: C(12, 8, 18), alpha: 0.95, thick: 0.1, dry: 0.1, bk: 0.3, soft: 0.3 });
  stroke(seg(1162, 1146, 1452, 1146, 1.5), { w: 8, col: C(152, 166, 214), col2: roofD, alpha: 0.97, thick: 1.6, dry: 0.2, bk: 0.6, soft: 0.25 });
  stroke(seg(1452, 1146, 1484, 1062, 1), { w: 6, col: C(128, 140, 194), col2: roofD, alpha: 0.95, thick: 1.2, dry: 0.3, soft: 0.3 });
  stroke(seg(1486, 1062, 1524, 1132, 1), { w: 5, col: C(96, 108, 166), alpha: 0.9, thick: 0.9, dry: 0.3, soft: 0.3 });
  for (let x = 1288; x <= 1312; x += 6) stroke(seg(x, 1018, x, 1068, 0.5), { w: 8, col: jit(x < 1300 ? C(54, 30, 36) : C(28, 16, 26), 0.02), alpha: 0.97, thick: 0.4, dry: 0.2, soft: 0.2 });
  stroke(seg(1282, 1016, 1318, 1015, 0.5), { w: 7, col: C(160, 172, 216), col2: roofD, alpha: 0.97, thick: 1.4, dry: 0.2, soft: 0.3 });
  for (let x = 1374; x <= 1398; x += 6) stroke(seg(x, 1212, x, 1286, 0.5), { w: 7, col: jit(C(14, 10, 18), 0.01), alpha: 0.95, thick: 0.2, dry: 0.2, soft: 0.2 });
  stroke(seg(1370, 1209, 1402, 1209, 0.3), { w: 3, col: C(60, 46, 60), alpha: 0.8, thick: 0.3, dry: 0.2, soft: 0.3 });
  E.tf = null;
  glaze(WIN.x, WIN.y + 8, 150, 126, C(150, 62, 34), 0.5, 1.6, 'add');
  E.tf = { cx: 1330, cy: 1290, k: 1.3 };
  const wx0 = 1266, wx1 = 1318, wy0 = 1184, wy1 = 1246, wcx = 1292, wcy = 1214;
  stroke(seg(wx0 - 5, wy0 - 5, wx1 + 5, wy0 - 5, 0), { w: 5, col: C(70, 30, 22), alpha: 0.95, thick: 0.3, dry: 0, soft: 0.2 });
  for (let y = wy0; y <= wy1; y += 4) stroke(seg(wx0, y, wx1, y, 0.6), { w: 6, col: jit(C(238, 116, 34), 0.03), col2: C(212, 80, 28), alpha: 0.98, thick: 0.8, dry: 0, bk: 0.4, wk: 0.1, soft: 0.15 });
  for (let k = 0; k < 22; k++) {
    const x = rnd(wx0 + 7, wx1 - 7), y = rnd(wy0 + 7, wy1 - 7);
    dab(x, y, rnd(5, 9), { col: jit(C(255, 188, 84), 0.04), col2: C(250, 150, 50), alpha: 0.9, thick: 1.2, dry: 0, bk: 0.5, wk: 0, soft: 0.5 });
  }
  for (let k = 0; k < 9; k++) dab(rnd(wx0 + 10, wx1 - 10), rnd(wy0 + 9, wy1 - 16), rnd(3.5, 6), { col: jit(C(255, 234, 164), 0.03), alpha: 0.92, thick: 1.9, dry: 0, bk: 0.5, wk: 0, soft: 0.45 });
  stroke(seg(wcx, wy0 - 2, wcx, wy1 + 2, 0), { w: 3.4, col: C(74, 28, 18), alpha: 0.92, thick: 0.5, dry: 0, bk: 0.2, wk: 0, soft: 0.3 });
  stroke(seg(wx0 - 2, wcy, wx1 + 2, wcy, 0), { w: 3, col: C(74, 28, 18), alpha: 0.92, thick: 0.5, dry: 0, bk: 0.2, wk: 0, soft: 0.3 });
  stroke(seg(wx0 - 4, wy0 - 3, wx0 - 4, wy1 + 3, 0), { w: 4, col: C(60, 26, 22), alpha: 0.9, thick: 0.3, dry: 0, soft: 0.3 });
  stroke(seg(wx1 + 4, wy0 - 3, wx1 + 4, wy1 + 3, 0), { w: 4, col: C(60, 26, 22), alpha: 0.9, thick: 0.3, dry: 0, soft: 0.3 });
  stroke(seg(wx0 - 8, wy1 + 6, wx1 + 8, wy1 + 6, 0.5), { w: 6, col: C(255, 198, 132), col2: C(220, 130, 100), alpha: 0.96, thick: 1.5, dry: 0.1, bk: 0.5, soft: 0.3 });
  E.tf = null;
  for (let k = 0; k < 60; k++) {
    const x = rnd(1040, 1580), y = 1290 + rnd(-6, 10);
    const c = groundCol(x, y + 14);
    stroke(seg(x - rnd(20, 70), y + rnd(-2, 2), x + rnd(20, 70), y + rnd(-2, 2), 2), { w: rnd(8, 16), col: jit(c, 0.03), alpha: 0.92, prof: 'lens', thick: 0.9, dry: 0.4, bk: 0.6, wk: 0.3, soft: 0.4 });
  }
  for (let k = 0; k < 70; k++) {
    const y = 1296 + Math.pow(R(), 1.5) * 240, x = WIN.x + (y - 1290) * 0.07 + gauss() * (38 + (y - 1290) * 0.44);
    const w = warmAt(x, y); if (w < 0.12) continue;
    const c = grad([[0, C(170, 100, 120)], [0.4, C(232, 138, 96)], [0.75, C(252, 178, 104)], [1, C(255, 222, 152)]], clamp(w * rnd(0.8, 1.3), 0, 1));
    const a = gauss() * 0.07, l = rnd(40, 120);
    stroke(arc(x - l / 2, y, a, l, gauss() * 0.002, 0.15, 5), { w: rnd(12, 26) * (0.6 + (y - 1290) / 300), col: jit(c, 0.03), col2: C(214, 120, 104), alpha: 0.6, prof: 'flat', thick: 1.4, dry: 0.65, bk: 0.8, wk: 0.4, soft: 0.55 });
  }
  // smoke: soft, rising straight in the still air
  for (let k = 0; k < 190; k++) {
    const t = Math.pow(R(), 0.8);
    const y = lerp(930, 330, t), sw = 10 + 62 * Math.pow(t, 0.8);
    const x = 1291 + Math.sin(y / 80) * 9 * t + gauss() * sw * 0.32;
    const c = mix(C(132, 128, 168), skyCol(x, y), 0.2 + 0.62 * t);
    const a = (0.46 * (1 - t) + 0.05) * (t < 0.03 ? 0.5 : 1);
    stroke(arc(x, y + 34, -Math.PI / 2 + gauss() * 0.25, rnd(40, 120), gauss() * 0.01, 0.4, 5), { w: sw * rnd(0.5, 1.0), col: jit(c, 0.02), alpha: a, prof: 'lens', thick: 0.35, dry: 0.4, bk: 0.5, wk: 0.5, soft: 0.85, press: 0.9 });
  }
  glaze(WIN.x, WIN.y, 380, 340, C(255, 130, 50), 0.15, 2.2, 'add');
  glaze(WIN.x, WIN.y, 120, 120, C(255, 170, 80), 0.3, 2.0, 'add');
}

function paintForeground() {
  // dead grasses and weed stalks through the snow, gathered along the tree rows
  for (let k = 0; k < 64; k++) {
    const y = 1450 + Math.pow(R(), 0.6) * 1270;
    const d = clamp((y - HOR) / 1500, 0, 1);
    const side = R() < 0.55 ? -1 : 1;
    const x = VPX + side * (y - HOR) * rnd(0.75, 1.5) + gauss() * 60;
    if (x < -30 || x > PW + 30) continue;
    if (Math.abs(x - 230) < 170 && y < 2470 && y > 1650) continue;
    const sc = 0.15 + 0.85 * d, nst = 3 + (R() * 12 | 0), hgt = rnd(0.5, 1.5);
    for (let j = 0; j < nst; j++) {
      const a = -Math.PI / 2 + gauss() * 0.45, l = rnd(30, 110) * sc * hgt;
      const c = R() < 0.55 ? C(26, 18, 26) : R() < 0.5 ? C(98, 76, 56) : C(62, 46, 46);
      stroke(arc(x + gauss() * 22 * sc, y + gauss() * 5 * sc, a, l, gauss() * 0.01 / sc, 0.3, 4), { w: rnd(1.6, 3.6) * sc + 0.8, col: jit(c, 0.03), alpha: 0.88, prof: 'taper', thick: 0.4, dry: 0.5, bk: 0.5, wk: 0.25, soft: 0.3 });
    }
    for (let j = 0; j < 1; j++) {
      const xx = x + gauss() * 20 * sc;
      stroke(seg(xx - rnd(20, 50) * sc, y + 5 * sc, xx + rnd(20, 50) * sc, y + 4 * sc, 2 * sc), { w: rnd(8, 14) * sc + 2, col: jit(mix(groundCol(x, y), C(164, 178, 222), 0.22), 0.03), alpha: 0.75, prof: 'tail', thick: 1.0, dry: 0.7, bk: 0.8, wk: 0.4, soft: 0.5 });
    }
  }
  // a few windfall apples half buried in the snow
  const falls = [];
  for (const f of falls) {
    const [x, y, r] = f;
    stroke(seg(x - r * 1.6, y + r * 0.6, x + r * 1.9, y + r * 0.7, 1), { w: r * 0.9, col: C(28, 28, 78), alpha: 0.5, prof: 'lens', thick: 0.05, dry: 0.3, soft: 0.8 });
    dab(x, y, r, { col: C(88, 10, 22), col2: C(150, 22, 28), alpha: 0.96, thick: 0.8, dry: 0.2, bk: 0.4, wk: 0.1, soft: 0.3, mixv: 0.6, el: 0.2 }, 0.2);
    dab(x - r * 0.25, y + r * 0.05, r * 0.45, { col: C(170, 30, 32), col2: C(196, 60, 46), alpha: 0.7, thick: 1.0, dry: 0.2, bk: 0.5, soft: 0.7 });
    stroke(seg(x - r * 1.0, y - r * 0.5, x + r * 0.9, y - r * 0.58, r * 0.12, 3), { w: r * 1.0, col: jit(mix(groundCol(x, y), C(150, 164, 214), 0.3), 0.03), col2: C(100, 112, 172), alpha: 0.95, prof: 'lens', thick: 1.4, dry: 0.3, bk: 0.6, soft: 0.4 });
    stroke(seg(x - r * 1.2, y + r * 0.6, x + r * 1.1, y + r * 0.66, r * 0.1, 3), { w: r * 0.9, col: jit(mix(groundCol(x, y), C(150, 164, 214), 0.15), 0.03), alpha: 0.92, prof: 'tail', thick: 1.2, dry: 0.5, bk: 0.7, soft: 0.45 });
  }
}

function paintSnowfall() {
  reseed(9917);
  const flake = (x, y, r, warmK) => {
    const dw = Math.hypot(x - WIN.x, y - WIN.y);
    let c = mix(C(204, 214, 242), C(146, 160, 212), R() * 0.75);
    c = mix(c, C(255, 206, 140), clamp(Math.exp(-dw / 210) * warmK, 0, 0.92));
    const big = r > 5.5;
    dab(x, y, r, { col: c, alpha: big ? rnd(0.15, 0.35) : rnd(0.3, 0.95), thick: big ? 0.3 : 1.6, flat: big ? 0.2 : 0.8, dry: 0, bk: 0.3, wk: 0.1, soft: big ? 0.9 : 0.6, rag: 0.5, el: rnd(0.15, 0.6) }, Math.PI / 2 + gauss() * 0.3);
  };
  for (let k = 0; k < 820; k++) {
    const x = rnd(0, PW), y = rnd(0, PH);
    if (Math.hypot(x - WIN.x, y - WIN.y) < 70) continue;
    const q = R();
    flake(x, y, q < 0.68 ? rnd(1.5, 3.0) : q < 0.93 ? rnd(3.0, 5.0) : rnd(6, 11), 1.4);
  }
  // flakes catching the window light
  for (let k = 0; k < 130; k++) {
    const a = rnd(0, 6.283), d = 80 + Math.pow(R(), 0.8) * 330;
    flake(WIN.x + Math.cos(a) * d * 1.1, WIN.y + Math.sin(a) * d * 0.9 + 30, rnd(1.4, 3.4), 2.2);
  }
}
