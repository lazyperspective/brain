'use strict';
// Orchestrates the painting: motif -> toned ground -> block-in -> successively finer passes ->
// drawing along forms (trees, snow loads, apples, grasses) -> falling snow -> raking light.

function treeChains(T) {
  const map = new Map();
  for (const s of T.segs) { if (!map.has(s.bid)) map.set(s.bid, []); map.get(s.bid).push(s); }
  return [...map.values()];
}

function offsetPath(segs, fn) {
  // vertices along a chain; fn(seg, nx, ny, end) -> {x,y,w} where (nx,ny) is the unit normal
  const pts = [];
  for (let i = 0; i <= segs.length; i++) {
    const a = segs[Math.max(0, i - 1)], b = segs[Math.min(segs.length - 1, i)];
    let dx = (a.sx1 - a.sx0) + (b.sx1 - b.sx0), dy = (a.sy1 - a.sy0) + (b.sy1 - b.sy0);
    const l = Math.hypot(dx, dy) + 1e-9; dx /= l; dy /= l;
    const s = i < segs.length ? segs[i] : segs[segs.length - 1];
    const x = i < segs.length ? s.sx0 : s.sx1, y = i < segs.length ? s.sy0 : s.sy1;
    const r = i < segs.length ? s.pr0 : s.pr1;
    pts.push(fn(s, x, y, r, -dy, dx));
  }
  return pts;
}

function pieces(pts, rng, minL, maxL) {
  const out = [];
  let i = 0;
  while (i < pts.length - 1) {
    const target = minL + (maxL - minL) * rng();
    let L = 0, j = i;
    while (j < pts.length - 1 && L < target) { L += Math.hypot(pts[j + 1].x - pts[j].x, pts[j + 1].y - pts[j].y); j++; }
    out.push(pts.slice(i, j + 1));
    if (j >= pts.length - 1) break;
    i = Math.max(i + 1, j - 1);
  }
  return out;
}

function paintTrees(P, scene, seed) {
  const rng = PRNG(seed);
  const S = scene.S;
  const Lx = -0.42, Ly = -0.9;
  for (const T of scene.trees) {
    const far = T.Z > 30;
    const edge = far ? 0.6 : T.Z > 16 ? 0.35 : 0;
    const chains = treeChains(T);
    // bark
    for (const ch of chains) {
      const rAvg = ch.reduce((m, s) => m + s.pr0 + s.pr1, 0) / (2 * ch.length);
      if (far && rAvg < 1.2) continue;
      if (!far && rAvg < 0.22) continue;
      const isTrunk = ch[0].bid === 0;
      const pts = offsetPath(ch, (s, x, y, r) => ({ x, y, w: (2 * r + 0.4 * S) * (r < 2.5 ? 0.75 + 0.5 * vnoise(x * 0.05 / S, y * 0.05 / S, 3) : 1) }));
      const wAvg = 2 * rAvg;
      for (const pc of pieces(pts, rng, Math.max(14 * S, wAvg * 5), Math.max(40 * S, wAvg * 14))) {
        const c = ch[0].bark, vj = 1 + (rng() - 0.5) * 0.2;
        P.strokePath(pc, { r: c[0] * vj, g: c[1] * vj, b: c[2] * vj * 1.02, alpha: far ? 0.8 : 0.97, thick: 0.06, dry: rAvg > 5 ? 0.25 : 0.08,
          smear: 0.1, bj: 0.12, rag: 0.3, edge, capStart: !(isTrunk && pc[0] === pts[0]), capEnd: true });
      }
      if (rAvg > 2.0) {
        // cool sky light on the upper/left flank, dragged dry so the bark tooth breaks it
        const lit = offsetPath(ch, (s, x, y, r, nx, ny) => {
          if (nx * Lx + ny * Ly < 0) { nx = -nx; ny = -ny; }
          const fac = clamp(nx * Lx + ny * Ly, 0, 1);
          return { x: x + nx * r * 0.5, y: y + ny * r * 0.5, w: r * (0.45 + 0.5 * fac) };
        });
        for (const pc of pieces(lit, rng, Math.max(6 * S, wAvg * 1.2), Math.max(16 * S, wAvg * 4))) {
          if (rng() < 0.3) continue;
          const l = ch[0].lit, vj = 0.85 + 0.3 * rng();
          const jx = (rng() - 0.5) * wAvg * 0.15, jy = (rng() - 0.5) * wAvg * 0.15, ws = 0.6 + 0.6 * rng();
          const q = pc.map(p => ({ x: p.x + jx, y: p.y + jy, w: p.w * ws }));
          P.strokePath(q, { r: l[0] * vj, g: l[1] * vj, b: l[2] * vj, alpha: 0.45 + 0.35 * rng(), thick: 0.25, dry: 0.7, smear: 0.25, bj: 0.16, rag: 0.7, edge: Math.max(edge, 0.4), capStart: true, capEnd: true });
        }
        if (T.rim > 0.02) {
          const rim = offsetPath(ch, (s, x, y, r, nx, ny) => {
            if (nx * T.rimDir < 0) { nx = -nx; ny = -ny; }
            const k = T.rim * clamp(1 - s.y0 / 3.2, 0, 1) * Math.abs(nx);
            return { x: x + nx * r * 0.62, y: y + ny * r * 0.62, w: r * 0.5 * Math.min(1, k * 2.5) };
          });
          P.strokePath(rim, { r: 0.95, g: 0.56, b: 0.27, alpha: 0.85, thick: 0.35, dry: 0.3, smear: 0.1, edge, capStart: true, capEnd: true });
        }
      }
      if (rAvg > 6) {
        // bark furrows and ridges following the limb
        const nf = 2 + Math.floor(rAvg / 6);
        for (let k = 0; k < nf; k++) {
          const off = (rng() - 0.5) * 1.6, wf = 0.06 + 0.12 * rng();
          const dark = rng() < 0.65;
          const f = offsetPath(ch, (s, x, y, r, nx, ny) => ({ x: x + nx * r * off, y: y + ny * r * off, w: Math.max(1.4 * S, r * wf) }));
          for (const pc of pieces(f, rng, 8 * S, 45 * S)) {
            if (rng() < 0.35) continue;
            const c = dark ? ch[0].bark : ch[0].lit, dk = dark ? 0.5 + 0.3 * rng() : 0.75 + 0.2 * rng();
            P.strokePath(pc, { r: c[0] * dk, g: c[1] * dk, b: c[2] * dk, alpha: dark ? 0.7 : 0.4, thick: dark ? 0.1 : 0.3, dry: 0.5, rag: 0.7, bj: 0.1, capStart: true, capEnd: true });
          }
        }
      }
    }
    // snow riding the upper sides: continuous, swelling and thinning, broken where it has slid off
    for (const ch of chains) {
      const rAvg = ch.reduce((m, s) => m + s.pr0 + s.pr1, 0) / (2 * ch.length);
      const stMax = Math.max(...ch.map(s => s.pst));
      if (stMax < (far ? 1.0 : 0.5)) continue;
      if (far && rAvg < 0.6) continue;
      const pts = offsetPath(ch, (s, x, y, r, nx, ny) => {
        if (ny > 0) { nx = -nx; ny = -ny; }
        const st = s.pst;
        const lump = 0.65 + 0.7 * vnoise(x * 0.09 / S, y * 0.09 / S, 17);
        return { x: x + nx * (r + st * 0.22 * lump), y: y + ny * (r + st * 0.22 * lump), w: st * 1.05 * lump };
      });
      const c = ch[0].snowc;
      for (const pc of pieces(pts, rng, 20 * S, 120 * S)) {
        const vj = 0.94 + 0.1 * rng(), blue = (rng() - 0.5) * 0.06;
        P.strokePath(pc, { r: c[0] * vj - blue, g: c[1] * vj, b: c[2] * vj + blue, alpha: 0.96, thick: far ? 0.4 : 0.8 + 0.6 * rng(), dry: 0.15, smear: 0.15, bj: 0.08, rag: 0.5, edge: Math.max(0.25, edge * 0.7), capStart: true, capEnd: true });
      }
      if (!far) for (const sg of ch) {
        if (sg.pst > 2.2 && rng() < 0.04) {
          const dx = sg.sx1 - sg.sx0, dy = sg.sy1 - sg.sy0, l = Math.hypot(dx, dy) + 1e-6;
          let nx = -dy / l, ny = dx / l; if (ny > 0) { nx = -nx; ny = -ny; }
          const r = sg.pr1;
          P.stroke({ x: sg.sx1 + nx * (r + sg.pst * 0.5), y: sg.sy1 + ny * (r + sg.pst * 0.5), a: Math.atan2(dy, dx), L: sg.pst * 1.5, w: sg.pst * 1.4,
            r: c[0] * 1.03, g: c[1] * 1.03, b: c[2] * 1.02, alpha: 0.95, thick: 2.0, dry: 0, smear: 0.1, taper: 0.3, full: true, rag: 0.2 });
        }
      }
    }
    // re-seat the trunk in its snow
    if (T.moundCol && T.Z < 30) {
      const tr = (T.hero ? 0.2 : 0.15) * T.ppm, c = T.moundCol;
      for (let k = 0; k < 6; k++) {
        const ox = (rng() - 0.5) * tr * 2.4;
        P.stroke({ x: T.bx + ox, y: T.by + tr * (0.1 + 0.15 * rng()), a: (rng() - 0.5) * 0.3, L: tr * (1.2 + rng()), w: tr * (0.3 + 0.25 * rng()),
          r: c[0] * (0.97 + 0.08 * rng()), g: c[1] * (0.97 + 0.08 * rng()), b: c[2], alpha: 0.95, thick: 0.9, dry: 0.1, smear: 0.25, taper: 0.5, bend: 0.3 });
      }
    }
  }
}

function paintApples(P, scene, seed) {
  const rng = PRNG(seed);
  const all = scene.apples.slice();
  const F = scene.fallen;
  for (const ap of all) {
    const r = ap.r, k = 0.66 * (1 - Math.exp(-ap.Z / 42)) * 0.8;
    const f = (c) => mixc(c, [0.40, 0.42, 0.58], k);
    const st = f([0.12, 0.08, 0.07]);
    P.stroke({ x: (ap.ax + ap.x) / 2, y: (ap.ay + ap.y - r) / 2, a: Math.atan2(ap.y - r - ap.ay, ap.x - ap.ax), L: Math.hypot(ap.x - ap.ax, ap.y - r - ap.ay) + 2, w: Math.max(1.5, r * 0.14), r: st[0], g: st[1], b: st[2], alpha: 0.95, thick: 0.2, taper: 0.5 });
    // body: curved strokes wrapping the form
    const body = f([0.40, 0.035, 0.065]), dark = f([0.18, 0.015, 0.05]), mid = f([0.62, 0.10, 0.11]);
    for (let i = 0; i < 4; i++) {
      const yy = ap.y + (i - 1.5) * r * 0.45;
      const hw = Math.sqrt(Math.max(0.1, 1 - ((yy - ap.y) / r) ** 2)) * r;
      P.stroke({ x: ap.x, y: yy, a: (rng() - 0.5) * 0.3, L: hw * 1.7, w: r * 0.62, r: body[0], g: body[1], b: body[2], alpha: 0.97, thick: 0.6, bend: 0.25, dry: 0.05, taper: 0.3, bj: 0.1 });
    }
    P.stroke({ x: ap.x + r * 0.32, y: ap.y + r * 0.3, a: -0.9, L: r * 1.3, w: r * 0.6, r: dark[0], g: dark[1], b: dark[2], alpha: 0.8, thick: 0.4, bend: -0.3, taper: 0.5 });
    P.stroke({ x: ap.x - r * 0.28, y: ap.y - r * 0.25, a: -0.6, L: r * 1.0, w: r * 0.5, r: mid[0], g: mid[1], b: mid[2], alpha: 0.85, thick: 0.8, bend: 0.2, taper: 0.4 });
    const hi = f([0.74, 0.56, 0.70]);
    P.stroke({ x: ap.x - r * 0.42, y: ap.y - r * 0.42, a: -0.7, L: r * 0.45, w: r * 0.24, r: hi[0], g: hi[1], b: hi[2], alpha: 0.9, thick: 1.4, taper: 0.5 });
    if (ap.snow) {
      const sc = f([0.84, 0.87, 0.98]);
      P.stroke({ x: ap.x - r * 0.05, y: ap.y - r * 0.86, a: 0.05, L: r * 1.1, w: r * 0.42, r: sc[0], g: sc[1], b: sc[2], alpha: 0.97, thick: 2.0, taper: 0.4, bend: 0.2 });
    }
  }
  // fallen apple
  {
    const r = F.r;
    P.stroke({ x: F.x, y: F.y, a: 0.1, L: r * 1.6, w: r * 1.3, r: 0.30, g: 0.03, b: 0.06, alpha: 0.95, thick: 0.6, bend: 0.2, taper: 0.3 });
    P.stroke({ x: F.x - r * 0.3, y: F.y - r * 0.3, a: -0.4, L: r * 0.6, w: r * 0.35, r: 0.55, g: 0.30, b: 0.42, alpha: 0.85, thick: 1.0, taper: 0.5 });
    P.stroke({ x: F.x + r * 0.1, y: F.y + r * 0.62, a: 0.02, L: r * 3.2, w: r * 0.75, r: 0.40, g: 0.44, b: 0.68, alpha: 0.95, thick: 1.0, taper: 0.5, bend: -0.1 });
  }
}

function paintGrasses(P, scene, seed) {
  const rng = PRNG(seed);
  for (const g of scene.grasses) {
    if (g.Z > 18) continue;
    for (const st of g.stalks) {
      if (!st.pts) continue;
      for (let i = 0; i + 1 < st.pts.length; i++) {
        const [x0, y0] = st.pts[i], [x1, y1] = st.pts[i + 1];
        const w = st.w * (1 - i / st.pts.length * 0.6) * 1.1;
        const vj = 0.9 + 0.25 * rng();
        P.stroke({ x: (x0 + x1) / 2, y: (y0 + y1) / 2, a: Math.atan2(y1 - y0, x1 - x0), L: Math.hypot(x1 - x0, y1 - y0) + w, w, r: st.col[0] * vj, g: st.col[1] * vj, b: st.col[2] * vj,
          alpha: 0.9, thick: 0.3, taper: 0.3, rag: 0.2 });
      }
    }
  }
}

function paintSnowfall(P, scene, seed) {
  const rng = PRNG(seed);
  const W = P.W, H = P.H, S = P.S;
  const wx = scene.window.x, wy = scene.window.y;
  const n = Math.round(1900 * S * S);
  for (let i = 0; i < n; i++) {
    const x = rng() * W, y = rng() * H * 0.97;
    const q = rng();
    const big = q > 0.94;
    const rad = (big ? 4 + 9 * rng() : 1.1 + 3.4 * q * q) * S;
    const d2 = ((x - wx) ** 2 + (y - wy) ** 2) / (2 * (260 * S) ** 2);
    const warm = Math.exp(-d2) * 0.8;
    // flakes read against darks; over bright snow they nearly vanish
    const j = ((y | 0) * W + (x | 0)) * 3;
    const bg = 0.3 * scene.tgt[j] + 0.59 * scene.tgt[j + 1] + 0.11 * scene.tgt[j + 2];
    let c = mixc([0.80, 0.83, 0.95], [1.0, 0.80, 0.58], warm);
    const al = (big ? 0.35 + 0.25 * rng() : 0.55 + 0.4 * rng()) * (1 - 0.6 * smooth(0.45, 0.7, bg));
    P.stroke({ x, y, a: Math.PI / 2 + (rng() - 0.5) * 0.8, L: rad * (0.9 + 0.5 * rng()), w: rad * 2, r: c[0], g: c[1], b: c[2],
      alpha: al, thick: big ? 0.05 : 0.3 + 0.5 * rng(), edge: big ? 0.9 : 0.5, taper: 0.1, rag: 0.15, bj: 0.02, dry: 0, full: true });
  }
}

function render(scale) {
  const t0 = performance.now();
  const W = Math.round(2160 * scale), H = Math.round(2700 * scale);
  const SEED = 20261110;
  const out = document.getElementById('c');
  out.width = W; out.height = H;
  const log = (m) => console.log(`[${((performance.now() - t0) / 1000).toFixed(1)}s] ${m}`);
  const scene = buildScene(W, H, SEED);
  log('scene'); window.__scene = scene;
  const S = scene.S;
  const P = new Painter(W, H, S, SEED + 1);
  P.ground([0.44, 0.27, 0.17]);
  log('ground');
  const layers = [
    { w: 95, sigma: 40, spacing: 0.5, lmin: 1.5, lmax: 3.6, alpha: 0.88, thick: 0.1, dry: 0.4, smear: 0.25, angJ: 0.35, cross: 0.25, clip: 0.4, vj: 0.14, tj: 0.06, bend: 0.4, rag: 0.7, bj: 0.14, mask: 0.5, m0: 0.25, m1: 0.6 },
    { w: 44, sigma: 17, spacing: 0.5, lmin: 1.4, lmax: 4.0, alpha: 0.9, thick: 0.3, dry: 0.3, smear: 0.2, angJ: 0.25, cross: 0.18, clip: 0.26, mask: 0.65, m0: 0.15, m1: 0.4, vj: 0.12, tj: 0.05, imp: 0.55, bj: 0.16 },
    { w: 20, sigma: 7.5, spacing: 0.55, lmin: 1.3, lmax: 4.0, alpha: 0.92, thick: 0.3, dry: 0.22, smear: 0.18, angJ: 0.2, cross: 0.12, clip: 0.2, mask: 0.75, m0: 0.12, m1: 0.3, err: 0.05, pAlways: 0.45, vj: 0.1, tj: 0.04, imp: 0.8, bj: 0.14 },
    { w: 9, sigma: 3.2, spacing: 0.6, lmin: 1.2, lmax: 3.6, alpha: 0.93, thick: 0.28, dry: 0.18, smear: 0.15, angJ: 0.16, cross: 0.06, clip: 0.18, mask: 0.8, m0: 0.1, m1: 0.26, err: 0.06, pAlways: 0.15, vj: 0.08, tj: 0.03, imp: 0.9, bj: 0.1 },
    { w: 4.2, sigma: 1.3, spacing: 0.7, lmin: 1.1, lmax: 3.0, alpha: 0.95, thick: 0.25, dry: 0.1, smear: 0.1, angJ: 0.12, cross: 0.04, clip: 0.15, mask: 0.85, m0: 0.09, m1: 0.25, err: 0.08, pAlways: 0.03, vj: 0.05, tj: 0.02, imp: 1.0, bj: 0.08 },
  ];
  layers.forEach((L, li) => {
    const o = Object.assign({}, L, { w: L.w * S, seed: SEED + 100 + li, maskTgt: scene.tgt });
    const tB = gaussBlur(scene.tgt, W, H, 3, L.sigma * S);
    const aB = gaussBlur(scene.aux, W, H, 3, L.sigma * S * 0.6 + 2 * S);
    const n = paintLayer(P, scene, tB, aB, o);
    log(`layer ${li} strokes ${n}`);
  });
  paintTrees(P, scene, SEED + 300); log('trees');
  paintGrasses(P, scene, SEED + 301); log('grasses');
  paintApples(P, scene, SEED + 302); log('apples');
  // final crisp pass around the focal point
  {
    const tB = gaussBlur(scene.tgt, W, H, 3, 0.8 * S);
    const aB = gaussBlur(scene.aux, W, H, 3, 2 * S);
    const wx = scene.window.x, wy = scene.window.y;
    const n = paintLayer(P, scene, tB, aB, { w: 3.0 * S, spacing: 0.7, lmin: 1, lmax: 2.6, alpha: 0.95, thick: 0.5, dry: 0.05, smear: 0.05, angJ: 0.1, clip: 0.12, mask: 0.9, m0: 0.08, m1: 0.22,
      err: 0.1, pAlways: 0.0, vj: 0.03, tj: 0.015, imp: 1.6, seed: SEED + 150, region: (x, y) => Math.abs(x - wx) < 260 * S && Math.abs(y - wy) < 200 * S });
    log(`focal strokes ${n}`);
  }
  paintSnowfall(P, scene, SEED + 400); log('snowfall');
  const ctx = out.getContext('2d');
  finishPainting(P, ctx, { weaveAmp: 0.22, heightAmp: 1.0, diffuse: 0.28, spec: 0.18, specPow: 16, vignette: 0.28, gamma: 1.0 });
  log(`done, ${P.count} strokes`);
  window.__done = true;
}

window.addEventListener('load', () => {
  const q = new URLSearchParams(location.search);
  const scale = parseFloat(q.get('scale') || '1');
  setTimeout(() => render(scale), 30);
});
