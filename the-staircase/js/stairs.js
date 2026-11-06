// THE STAIRCASE - the impossible staircase itself, as real 3D geometry.
//
// The steps climb around a square in the order +x, +z, -x, -z, each step one rise (h) higher than the last. A real
// 3D square ring cannot do that and close, so this one does not close: the four flights have unequal lengths and the
// last step ends up displaced from the first by LAP = (n1 - n3, N*h, n2 - n4) - up a whole lap's rise AND toward the
// camera. The orthographic camera looks exactly along LAP, so anything moved by LAP lands on the same pixel: on screen
// the top of the climb sits precisely on the bottom of it and the loop reads as closed (the hidden gap is a depth gap).
//
// Everything that moves lives on the infinite helix  P(s + L) = P(s) + LAP  (s = path length along the centre line).
// At render time each object is folded back into the one physical lap by subtracting floor(s / L) * LAP, with s
// taken from that object (a foot uses its own step). Folding never moves a pixel; it only picks the depth that
// agrees with the stone underfoot. That is the whole trick, and why one lap returns everyone to frame 0.
(function () {
  const S = window.STAIR, U = S.U;
  const LEGS = [9, 8, 3, 2];       // straight steps per flight: +x, +z, -x, -z
  const SEAM_LEG = 2, SEAM_AFTER = 1; // the hidden gap sits in the -x flight (a flight that recedes from the camera)
  const h = 0.25;                  // rise per step
  const TW = 1.0;                  // tread depth of a straight step
  const W = 1.55;                  // stair width (corner steps are W x W)
  const T = 0.62;                  // block thickness
  const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]];

  // ---- build the sequence of steps and the centre-line segments of one lap (lap 0, before centring)
  const seq = [];
  const pushLeg = (leg, n) => { for (let i = 0; i < n; i++) seq.push({ corner: false, leg }); };
  pushLeg(SEAM_LEG, SEAM_AFTER);
  for (let k = 0; k < 4; k++) {
    const a = (SEAM_LEG + k) % 4, b = (a + 1) % 4;
    seq.push({ corner: true, leg: a, next: b });
    if (k < 3) pushLeg(b, LEGS[b]);
  }
  pushLeg(SEAM_LEG, LEGS[SEAM_LEG] - SEAM_AFTER);
  const N = seq.length;

  const steps = [];
  const segs = [];
  let px = 0, pz = 0, s = 0;
  for (let j = 0; j < N; j++) {
    const q = seq[j];
    const d = DIRS[q.leg];
    if (!q.corner) {
      const st = { j, corner: false, s0: s, len: TW, cx: px + d[0] * TW / 2, cz: pz + d[1] * TW / 2, dx: d[0], dz: d[1], sx: d[0] ? TW : W, sz: d[0] ? W : TW };
      segs.push({ type: 'line', s0: s, len: TW, x0: px, z0: pz, dx: d[0], dz: d[1] });
      px += d[0] * TW; pz += d[1] * TW; s += TW;
      steps.push(st);
    } else {
      const e = DIRS[q.next];
      const cx = px + d[0] * W / 2, cz = pz + d[1] * W / 2;           // corner square centre
      const ox = cx - d[0] * W / 2 + e[0] * W / 2, oz = cz - d[1] * W / 2 + e[1] * W / 2; // inner corner (arc centre)
      const r = W / 2, len = Math.PI / 2 * r;
      const a0 = Math.atan2(pz - oz, px - ox);
      const cross = d[0] * e[1] - d[1] * e[0];                          // turn direction
      segs.push({ type: 'arc', s0: s, len, ox, oz, r, a0, sgn: cross > 0 ? 1 : -1 });
      steps.push({ j, corner: true, s0: s, len, cx, cz, dx: d[0], dz: d[1], ex: e[0], ez: e[1], sx: W, sz: W, ix: ox, iz: oz });
      px = cx + e[0] * W / 2; pz = cz + e[1] * W / 2; s += len;
    }
  }
  const L = s;
  const LAP = { x: px, y: N * h, z: pz };       // (start was 0,0)

  // centre the ring: put the middle of the lap's bounding box (in xz) and mid-height at the origin
  let mnx = 1e9, mxx = -1e9, mnz = 1e9, mxz = -1e9;
  for (const st of steps) { mnx = Math.min(mnx, st.cx - st.sx / 2); mxx = Math.max(mxx, st.cx + st.sx / 2); mnz = Math.min(mnz, st.cz - st.sz / 2); mxz = Math.max(mxz, st.cz + st.sz / 2); }
  const OX = -(mnx + mxx) / 2, OZ = -(mnz + mxz) / 2, OY = -N * h * 0.5;
  for (const st of steps) { st.cx += OX; st.cz += OZ; if (st.corner) { st.ix += OX; st.iz += OZ; } st.y = OY + st.j * h; st.sc = st.s0 + st.len / 2; }
  for (const g of segs) { if (g.type === 'line') { g.x0 += OX; g.z0 += OZ; } else { g.ox += OX; g.oz += OZ; } }

  const VIEW = (() => { const l = Math.hypot(LAP.x, LAP.y, LAP.z); return { x: LAP.x / l, y: LAP.y / l, z: LAP.z / l }; })();

  // ---- path queries on the infinite helix
  const lapOf = (s) => Math.floor(s / L);
  function segAt(sl) { let lo = 0, hi = segs.length - 1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (segs[m].s0 <= sl) lo = m; else hi = m - 1; } return segs[lo]; }
  // centre-line point at path length s (helix space): x, z, tangent (tx, tz)
  function pathXZ(s, out = {}) {
    const k = lapOf(s), sl = s - k * L, g = segAt(sl), u = sl - g.s0;
    if (g.type === 'line') { out.x = g.x0 + g.dx * u; out.z = g.z0 + g.dz * u; out.tx = g.dx; out.tz = g.dz; }
    else { const a = g.a0 + g.sgn * u / g.r; out.x = g.ox + g.r * Math.cos(a); out.z = g.oz + g.r * Math.sin(a); out.tx = -Math.sin(a) * g.sgn; out.tz = Math.cos(a) * g.sgn; }
    out.x += k * LAP.x; out.z += k * LAP.z;
    return out;
  }
  // step index (unwrapped) containing path length s
  function stepAt(s) {
    const k = lapOf(s), sl = s - k * L;
    let lo = 0, hi = N - 1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (steps[m].s0 <= sl) lo = m; else hi = m - 1; }
    return lo + k * N;
  }
  const stepRec = (J) => steps[U.wrap(J, N)];
  const stepY = (J) => OY + J * h;                                   // tread top of unwrapped step J (helix space)
  const stepS0 = (J) => { const k = Math.floor(J / N); return steps[J - k * N].s0 + k * L; };
  const stepSc = (J) => { const k = Math.floor(J / N); return steps[J - k * N].sc + k * L; };
  const stepLen = (J) => stepRec(J).len;
  // fractional step coordinate: u = J at the centre of step J (piecewise linear in s between centres)
  function uOfS(s) {
    const J = stepAt(s), c = stepSc(J);
    if (s >= c) { const c2 = stepSc(J + 1); return J + (s - c) / (c2 - c); }
    const c0 = stepSc(J - 1); return J - 1 + (s - c0) / (c - c0);
  }
  function sOfU(u) { const J = Math.floor(u), a = stepSc(J), b = stepSc(J + 1); return a + (b - a) * (u - J); }
  // tread under (x, z) in helix space, among unwrapped steps J0..J1 (null if none)
  function treadAt(x, z, J0, J1) {
    let best = null;
    for (let J = J0; J <= J1; J++) {
      const st = stepRec(J), k = Math.floor(J / N);
      const cx = st.cx + k * LAP.x, cz = st.cz + k * LAP.z;
      if (Math.abs(x - cx) <= st.sx / 2 && Math.abs(z - cz) <= st.sz / 2) { const y = stepY(J); if (best === null || y > best) best = y; }
    }
    return best;
  }
  // point on the stair at path s, lateral offset `side` (+ = to the left of travel), on the tread of the step there
  function onStair(s, side, out = {}) {
    pathXZ(s, out);
    out.x += -out.tz * side; out.z += out.tx * side;
    out.y = stepY(stepAt(s));
    return out;
  }
  const fold = (s) => lapOf(s);

  S.stairs = { N, L, h, W, T, TW, LEGS, steps, segs, LAP, VIEW, OY, pathXZ, stepAt, stepRec, stepY, stepS0, stepSc, stepLen, uOfS, sOfU, treadAt, onStair, fold, lapOf };
})();
