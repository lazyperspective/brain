// THE STAIRCASE v2 - one switchback staircase climbing straight up into the sky, as real 3D geometry.
//
// One module = flight F1 (4 steps), two quarter-turn corner steps (a U-turn), flight F2 (4 steps back the other
// way, beside F1), two more corner steps. Every block, corners included, is one riser (h) higher than the last, so
// the module ends exactly above where it began: MOD = (0, 12 h, 0). The staircase is infinite and physical (no
// illusions): block J is block J mod 12 lifted by floor(J / 12) modules. Nothing ahead of the build front exists yet
// and nothing far behind the humans exists any more (story.js), so only a short stretch is ever on screen.
//
// The module is laid out in a local frame (F1 along +x) and then turned about y by PHI, so that F1 comes toward the
// camera at an angle (faces and the chest tag read on F1; F2 shows Claude's back).
(function () {
  const S = window.STAIR, U = S.U;
  const NF = 4;                    // steps per flight
  const h = 0.42;                  // rise per block (tall risers: every step reads as going up)
  const TW = 0.62;                 // tread depth of a flight step
  const W = 1.18;                  // stair width (corner blocks are W x W)
  const T = 0.62;                  // block thickness
  const PHI = -0.7;                // local -> world turn about y (F1 heads toward the camera and to the right)
  const DIRS = { '+x': [1, 0], '-x': [-1, 0], '+z': [0, 1], '-z': [0, -1] };

  // local layout: F1 at z = +W/2 heading +x, F2 at z = -W/2 heading -x
  const seq = [];
  for (let i = 0; i < NF; i++) seq.push({ corner: false, d: '+x' });
  seq.push({ corner: true, d: '+x', e: '-z' }, { corner: true, d: '-z', e: '-x' });
  for (let i = 0; i < NF; i++) seq.push({ corner: false, d: '-x' });
  seq.push({ corner: true, d: '-x', e: '+z' }, { corner: true, d: '+z', e: '+x' });
  const N = seq.length;            // 12 blocks per module
  const H = N * h;                 // module rise

  const steps = [], segs = [];
  let px = -NF * TW / 2, pz = W / 2, s = 0;
  for (let j = 0; j < N; j++) {
    const q = seq[j], d = DIRS[q.d];
    if (!q.corner) {
      steps.push({ j, corner: false, s0: s, len: TW, cx: px + d[0] * TW / 2, cz: pz + d[1] * TW / 2, dx: d[0], dz: d[1], sx: d[0] ? TW : W, sz: d[0] ? W : TW });
      segs.push({ type: 'line', s0: s, len: TW, x0: px, z0: pz, dx: d[0], dz: d[1] });
      px += d[0] * TW; pz += d[1] * TW; s += TW;
    } else {
      const e = DIRS[q.e];
      const cx = px + d[0] * W / 2, cz = pz + d[1] * W / 2;
      const ox = cx - d[0] * W / 2 + e[0] * W / 2, oz = cz - d[1] * W / 2 + e[1] * W / 2;   // inner corner = arc centre
      const r = W / 2, len = Math.PI / 2 * r;
      const a0 = Math.atan2(pz - oz, px - ox);
      const cross = d[0] * e[1] - d[1] * e[0];
      segs.push({ type: 'arc', s0: s, len, ox, oz, r, a0, sgn: cross > 0 ? 1 : -1 });
      steps.push({ j, corner: true, s0: s, len, cx, cz, dx: d[0], dz: d[1], ex: e[0], ez: e[1], sx: W, sz: W });
      px = cx + e[0] * W / 2; pz = cz + e[1] * W / 2; s += len;
    }
  }
  const L = s;                     // path length of one module
  if (Math.hypot(px - (-NF * TW / 2), pz - W / 2) > 1e-9) throw new Error('module does not close');

  // local -> world
  const cP = Math.cos(PHI), sP = Math.sin(PHI);
  const toW = (x, z, out) => { out.x = x * cP + z * sP; out.z = -x * sP + z * cP; return out; };
  for (const st of steps) {
    const w = toW(st.cx, st.cz, {}); st.wx = w.x; st.wz = w.z; st.y = st.j * h; st.sc = st.s0 + st.len / 2;
  }

  // ---- path queries (s = path length along the centre line, unbounded; module k = floor(s / L))
  const modOf = (s) => Math.floor(s / L);
  function segAt(sl) { let lo = 0, hi = segs.length - 1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (segs[m].s0 <= sl) lo = m; else hi = m - 1; } return segs[lo]; }
  const tmpL = {};
  // centre-line point at path length s: world x, z and unit tangent (tx, tz)
  function pathXZ(s, out = {}) {
    const k = modOf(s), sl = s - k * L, g = segAt(sl), u = sl - g.s0;
    let x, z, tx, tz;
    if (g.type === 'line') { x = g.x0 + g.dx * u; z = g.z0 + g.dz * u; tx = g.dx; tz = g.dz; }
    else { const a = g.a0 + g.sgn * u / g.r; x = g.ox + g.r * Math.cos(a); z = g.oz + g.r * Math.sin(a); tx = -Math.sin(a) * g.sgn; tz = Math.cos(a) * g.sgn; }
    toW(x, z, out); const ox = out.x, oz = out.z;
    toW(tx, tz, tmpL); out.x = ox; out.z = oz; out.tx = tmpL.x; out.tz = tmpL.z;
    return out;
  }
  function stepAt(s) {
    const k = modOf(s), sl = s - k * L;
    let lo = 0, hi = N - 1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (steps[m].s0 <= sl) lo = m; else hi = m - 1; }
    return lo + k * N;
  }
  const stepRec = (J) => steps[U.wrap(J, N)];
  const stepY = (J) => J * h;                                        // tread top of block J
  const stepS0 = (J) => { const k = Math.floor(J / N); return steps[J - k * N].s0 + k * L; };
  const stepSc = (J) => { const k = Math.floor(J / N); return steps[J - k * N].sc + k * L; };
  const stepLen = (J) => stepRec(J).len;
  // fractional step coordinate: u = J at the centre of block J (piecewise linear in s between centres)
  function uOfS(s) {
    const J = stepAt(s), c = stepSc(J);
    if (s >= c) { const c2 = stepSc(J + 1); return J + (s - c) / (c2 - c); }
    const c0 = stepSc(J - 1); return J - 1 + (s - c0) / (c - c0);
  }
  function sOfU(u) { const J = Math.floor(u), a = stepSc(J), b = stepSc(J + 1); return a + (b - a) * (u - J); }
  // block footprint test in world xz (rotated rectangle)
  function inBlock(J, x, z, pad = 0) {
    const st = stepRec(J), dx = x - st.wx, dz = z - st.wz;
    const lx = dx * cP - dz * sP, lz = dx * sP + dz * cP;            // world -> local
    return Math.abs(lx) <= st.sx / 2 + pad && Math.abs(lz) <= st.sz / 2 + pad;
  }
  // highest tread under (x, z) among blocks J0..J1 that `exists(J)` (all, if no predicate); null if none
  function treadAt(x, z, J0, J1, exists) {
    let best = null;
    for (let J = J0; J <= J1; J++) {
      if (exists && !exists(J)) continue;
      if (inBlock(J, x, z)) { const y = stepY(J); if (best === null || y > best) best = y; }
    }
    return best;
  }
  // point on the stair at path s, lateral offset `side` (+ = left of travel), on the tread of the block there
  function onStair(s, side, out = {}) {
    pathXZ(s, out);
    out.x += -out.tz * side; out.z += out.tx * side;
    out.y = stepY(stepAt(s));
    return out;
  }
  // centre of block J's tread (world)
  const blockTop = (J, out = {}) => { const st = stepRec(J); out.x = st.wx; out.z = st.wz; out.y = stepY(J); return out; };

  S.stairs = { N, NF, L, H, h, W, T, TW, PHI, steps, segs, MOD: { x: 0, y: H, z: 0 }, pathXZ, stepAt, stepRec, stepY, stepS0, stepSc, stepLen, uOfS, sOfU, treadAt, inBlock, onStair, blockTop, modOf, toW };
})();
