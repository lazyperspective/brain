// Shot 8 (65.8-71.2): fisheye camera on the catch arm. The ship's shiny steel body and
// nose slide down between the arms against a deep blue sky; the arms close and clank at 68.0,
// the ship settles with friction sparks, and the sun glints off the nose.
(function () {
  'use strict';
  const { W, H, S, Wm, T, M, A, D, buf, P, Pd, rect, hl, vl, line, poly, disc, ring, pick, bth, hash, vnoise, fbm2,
    clamp, lerp, smooth, spline, ri, get, DARKER } = PX;
  window.SHOTS = window.SHOTS || {};

  // ---- fisheye (barrel) mapping between world and screen ----
  const FK = 0.17, FA = 240, FC = [240, 135];
  function fwd(wx, wy) {
    const dx = wx - FC[0], dy = wy - FC[1], r2 = (dx * dx + dy * dy) / (FA * FA), s = 1 / (1 + FK * r2);
    return [FC[0] + dx * s, FC[1] + dy * s];
  }
  const INVX = new Float32Array(W * H), INVY = new Float32Array(W * H);
  (function () {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const sx = x + 0.5 - FC[0], sy = y + 0.5 - FC[1], rs = Math.hypot(sx, sy);
      let k = 1;
      if (rs > 1e-6) { const q = FK * rs / (FA * FA); k = (1 - Math.sqrt(1 - 4 * q * rs)) / (2 * q) / rs; }
      INVX[y * W + x] = FC[0] + sx * k; INVY[y * W + x] = FC[1] + sy * k;
    }
  })();
  // inverse at an arbitrary (shaken) screen pixel
  function inv(x, y) {
    if (x >= 0 && x < W && y >= 0 && y < H) return [INVX[y * W + x], INVY[y * W + x]];
    const sx = x + 0.5 - FC[0], sy = y + 0.5 - FC[1], rs = Math.hypot(sx, sy);
    const q = FK * rs / (FA * FA), k = (1 - Math.sqrt(Math.max(0, 1 - 4 * q * rs))) / (2 * q) / rs;
    return [FC[0] + sx * k, FC[1] + sy * k];
  }
  // polygon in world coords: subdivide edges, map, fill in screen
  function wpoly(pts, c, cb, sh) {
    const out = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      for (let k = 0; k < 8; k++) { const f = k / 8; const p = fwd(a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f); out.push([p[0] + sh[0], p[1] + sh[1]]); }
    }
    poly(out, c, cb);
  }
  function wline(a, b, c, sh, fn) {
    let prev = null;
    for (let k = 0; k <= 16; k++) {
      const f = k / 16, p = fwd(a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f);
      const q = [ri(p[0] + sh[0]), ri(p[1] + sh[1])];
      if (prev) line(prev[0], prev[1], q[0], q[1], c, fn);
      prev = q;
    }
  }

  // ---- timing ----
  const TC = 68.0; // arms clamp: the clank
  const tipY = spline([[65.8, -430], [66.6, -298], [67.4, -176], [68.0, -86], [68.6, -34], [69.2, -4], [69.8, 11], [70.4, 19], [70.9, 21.4], [71.2, 21.6]]);
  const closeF = t => smooth(67.15, 68.0, t);
  function shake(t) {
    if (t < TC) return [0, 0];
    const a = t - TC, e = Math.exp(-a * 6.5);
    return [ri(1.3 * e * Math.sin(a * 2 * Math.PI * 5)), ri(2.7 * e * Math.cos(a * 2 * Math.PI * 7))];
  }

  // ---- background: sky + far coast below the horizon ----
  const HZ = 214;
  function background(t, sh) {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const [wx, wy] = inv(x - sh[0], y - sh[1]);
      if (wy < HZ) {
        const fy = clamp(wy / HZ, 0, 1);
        let v = 2.3 + 5.4 * Math.pow(fy, 1.8) + 0.9 * clamp(wx / 480, 0, 1) * fy * fy;
        v -= 0.6 * clamp(((x - 240) * (x - 240) + (y - 135) * (y - 135)) / 80000 - 0.4, 0, 1) * (1 - fy); // lens falloff in the corners
        buf[i] = pick(S, Math.min(v, 8.3), x, y);
      } else {
        const g = wy - HZ;
        let c;
        if (g < 1.2) c = S[8];
        else if (g < 9) {
          c = pick(A, 3.6 - g * 0.18, x, y);
          const gl = hash(ri(wx / 3), ri(wy), Math.floor(t * 6 + wx * 0.07));
          if (gl > 0.93) c = A[4];
          if (gl > 0.985) c = S[9];
        } else if (g < 12) c = pick([M[5], M[6]], 1 - (g - 9) / 3 * 0.8, x, y);
        else {
          const n = fbm2(wx * 0.018, wy * 0.16, 33, 3);
          c = n > 0.66 ? A[2] : n > 0.62 ? A[3] : pick([M[3], M[4], M[5], M[6]], 0.6 + n * 2.6 - (g - 12) * 0.02, x, y);
        }
        buf[i] = c;
      }
    }
  }

  // ---- the other side of the catch structure (left), silhouetted against the bright horizon ----
  function leftStructure(t, sh, cf) {
    const ox = 9 * cf;
    const X = x => x + ox;
    // legs dropping out of frame
    const legs = [[48, 6], [122, 5], [186, 4]];
    for (const [lx, w] of legs) wpoly([[X(lx - w / 2), 210], [X(lx + w / 2), 210], [X(lx + w / 2), 330], [X(lx - w / 2), 330]], T[1], null, sh);
    const diag = [[48, 210, 110, 330, 4], [122, 214, 64, 330, 4], [186, 214, 136, 330, 3], [186, 214, 238, 330, 3], [10, 214, -10, 300, 5]];
    for (const [ax, ay, bx, by, w] of diag) wpoly([[X(ax - w / 2), ay], [X(ax + w / 2), ay], [X(bx + w / 2), by], [X(bx - w / 2), by]], T[1], null, sh);
    for (const [lx, w] of legs) wline([X(lx - w / 2), 212], [X(lx - w / 2), 330], T[3], sh);
    // a cross tie
    wpoly([[X(-20), 252], [X(200), 246], [X(200), 249], [X(-20), 256]], T[2], null, sh);
    // heavy beam under the rail
    wpoly([[X(-40), 196], [X(222), 205], [X(222), 214], [X(-40), 212]], T[1], null, sh);
    wline([X(-40), 196], [X(222), 205], T[3], sh);
    // the shiny catch rail box with panels catching the warm light
    const top0 = [X(36), 168], top1 = [X(214), 193], bot0 = [X(36), 198], bot1 = [X(214), 205];
    wpoly([top0, top1, bot1, bot0], 0, (x, y) => {
      const [wx, wy] = inv(x - sh[0], y - sh[1]);
      const p = (wx - X(36)) / 178, yt = lerp(168, 193, p), yb = lerp(198, 205, p), q = (wy - yt) / (yb - yt);
      const pi = Math.floor(p * 10), pf = p * 10 - pi;
      let c;
      if (q < 0.1) c = T[8];
      else if (q > 0.9) c = T[3];
      else if (pf < 0.06) c = T[4];
      else {
        const warm = (pi === 2 || pi === 3 || pi === 6) ? 1 : 0;
        const v = 6.6 - pf * 1.4 - q * 0.8;
        c = warm ? pick([T[6], Wm[4], Wm[5], Wm[6]], 1.3 - pf * 1.3 + (1 - q) * 0.9, x, y) : pick(T, v, x, y);
      }
      P(x, y, c);
    }, sh);
    // end plates
    wpoly([[X(30), 166], [X(37), 167], [X(37), 199], [X(30), 199]], T[2], null, sh);
    wpoly([[X(212), 191], [X(220), 192], [X(220), 207], [X(212), 206]], T[2], null, sh);
    wline([X(36), 168], [X(214), 193], T[8], sh);
    // a lamp mast on the far end
    wpoly([[X(8), 140], [X(10), 140], [X(10), 197], [X(8), 197]], T[2], null, sh);
    wpoly([[X(8), 140], [X(40), 146], [X(40), 148], [X(8), 142]], T[2], null, sh);
  }

  // ---- the ship ----
  const prof = s => Math.pow(1 - Math.pow(1 - clamp(s, 0, 1), 2), 0.5);
  // base reflection value across the steel (u = -1 left limb .. tile edge)
  const BAND = [[-1, 2.2], [-0.93, 3.8], [-0.72, 6.1], [-0.6, 7.2], [-0.5, 8.0], [-0.42, 7.5], [-0.3, 6.2], [-0.12, 5.3], [0.02, 4.9], [0.14, 5.6], [0.26, 6.9], [0.4, 5.6]];
  function bandV(u) {
    if (u <= BAND[0][0]) return BAND[0][1];
    for (let i = 1; i < BAND.length; i++) if (u <= BAND[i][0]) { const a = BAND[i - 1], b = BAND[i]; return lerp(a[1], b[1], (u - a[0]) / (b[0] - a[0])); }
    return BAND[BAND.length - 1][1];
  }
  function shipGeom(t) {
    const cf = closeF(t);
    const R0 = 51 + 8 * cf + 2 * smooth(68, 71.2, t);
    const XC = 266 + 4 * cf;
    const tip = tipY(t);
    const LN = 1.22 * R0;
    const xc = wy => XC + 0.035 * (wy - 135);
    const Rw = wy => R0 * (1 + 0.0011 * (wy - 135));
    const hwAt = wy => { const s = (wy - tip) / LN; return s < 0 ? -1 : (s < 1 ? Rw(wy) * prof(s) : Rw(wy)); };
    const slow = Math.abs(tipY(t + 0.02) - tipY(t - 0.02)) / 0.04 < 75;
    return { cf, R0, XC, tip, LN, xc, Rw, hwAt, slow };
  }
  function shipBody(t, sh, G) {
    const { tip, LN, xc, Rw, hwAt, R0 } = G;
    const race = [-0.6, -0.02];
    const raceTop = tip + LN + 0.32 * R0;
    const rhw = 0.055 * R0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const [wx, wy] = inv(x - sh[0], y - sh[1]);
      const hw = hwAt(wy);
      if (hw <= 0) continue;
      const c0 = xc(wy), dxw = wx - c0;
      if (Math.abs(dxw) >= hw) continue;
      const u = dxw / hw, s = (wy - tip) / LN;
      const te = 0.4 + (Math.floor((wy - tip) / 3) & 1 ? 0.012 : -0.012);
      let c;
      const tileCap = s < 0.4 + 0.07 * u;
      if (u > te || tileCap) {
        // heat-shield tiles: black hex mosaic with a soft sky sheen
        let v = 1.0 + 1.2 * Math.exp(-(((u - 0.62) / 0.13) ** 2));
        if (tileCap) v = 1.1 + 2.2 * Math.exp(-(((u + 0.45) / 0.3) ** 2)) * smooth(0.02, 0.12, s) + 0.6 * smooth(0.3, 0.0, s);
        if (u > 0.93) v = 0.3;
        c = pick(T, v, x, y);
        const row = Math.floor((wy - tip) / 4.5), col = (wx - c0 + (row & 1) * 3) / 6;
        if (G.slow && ((wy - tip) % 4.5 < 0.9 || col - Math.floor(col) < 0.14)) c = DARKER[c];
      } else {
        let v = bandV(u) + 0.38 * Math.sin((wy - tip) * 0.045 + u * 3.1) + 0.25 * Math.sin((wy - tip) * 0.013 + 1);
        // nose steel catches more sky above, ogive darker toward its limb
        if (s < 1) v -= (1 - s) * 0.6;
        c = pick(T, v, x, y);
        // blue sky in the left limb
        if (u > -0.9 && u < -0.76) c = pick(S, 5.2 + (u + 0.9) * 8 + (s < 1.4 ? 0.8 : 0), x, y);
        // golden reflection of the sunlit land lower down
        const wI = smooth(-0.36, -0.25, u) * (1 - smooth(0.03, 0.13, u)) * smooth(140, 250, y) * (s > 1.2 ? 1 : 0);
        if (wI > 0.05) { const wv = 2.6 + wI * 2.6 + 0.4 * Math.sin((wy - tip) * 0.03); if (wI * 1.4 > bth(x, y)) c = pick(Wm, wv, x, y); }
        // raised raceways with their own little shading and a cast shadow on the hull
        if (wy > raceTop - rhw) for (const ru of race) {
          const rx = c0 + ru * Rw(wy), d = wx - rx;
          const capY = raceTop, inCap = wy < capY ? (d * d + (wy - capY) * (wy - capY) < rhw * rhw) : Math.abs(d) < rhw;
          if (inCap) {
            const lv = d / rhw;
            c = lv < -0.45 ? T[8] : lv < 0.15 ? (wI > 0.3 ? Wm[5] : T[7]) : lv < 0.65 ? T[6] : T[4];
          } else if (d >= rhw && d < rhw + 1.7 && wy > capY) c = DARKER[DARKER[c]];
        }
        if (Math.abs(dxw) > hw - 1.1 && u < 0) c = T[2];
      }
      buf[y * W + x] = c;
    }
  }
  function shipDetails(t, sh, G) {
    const { tip, LN, xc, Rw, hwAt, R0 } = G;
    const at = (u, wy) => { const p = fwd(xc(wy) + u * Rw(wy), wy); return [ri(p[0] + sh[0]), ri(p[1] + sh[1])]; };
    // weld rings (curving up in the middle: we look up at them)
    for (let k = 0; k < 14; k++) {
      const wy0 = tip + LN + 0.95 * R0 + k * 0.92 * R0;
      if (wy0 > 340) break;
      const seen = new Set();
      let prev = null;
      for (let i = 0; i <= 40; i++) {
        const u = -0.97 + i * (1.36 / 40);
        const wy = wy0 - 0.11 * R0 * Math.sqrt(Math.max(0, 1 - u * u));
        const p = at(u, wy);
        if (prev) line(prev[0], prev[1], p[0], p[1], 0, (x, y) => seen.add(y * W + x));
        prev = p;
      }
      for (const i of seen) if (i >= 0 && i < W * H) { const c = buf[i]; buf[i] = DARKER[c]; }
    }
    // nose/body joint seam
    // ports, window, vent grille
    const ports = [[-0.36, tip + LN + 0.22 * R0], [-0.17, tip + LN + 0.22 * R0]];
    for (const [u, wy] of ports) { const [x, y] = at(u, wy); rect(x - 1, y - 1, 3, 3, D[1]); P(x - 1, y - 1, T[3]); P(x + 1, y + 1, T[7]); }
    { const [x, y] = at(0.2, tip + LN * 0.97); rect(x - 3, y - 3, 7, 6, T[3]); rect(x - 2, y - 2, 5, 4, D[1]); hl(x - 2, x + 2, y - 2, T[2]); P(x - 2, y - 2, T[5]); }
    { const [x, y] = at(0.04, tip + LN + 0.58 * R0); ring(x, y, 3, T[3]); disc(x + 0.5, y + 0.5, 2.6, D[1]); hl(x - 1, x + 1, y, T[3]); hl(x - 1, x + 1, y - 1, T[2]); hl(x - 1, x + 1, y + 1, T[2]); P(x + 2, y + 3, T[7]); }
    { const [x, y] = at(-0.78, tip + LN * 0.82); rect(x - 2, y - 3, 4, 6, T[3]); rect(x - 1, y - 2, 2, 4, D[2]); }
    // catch pin on the left limb (the hard point that lands on the arms)
    { const wy = tip + LN + 0.42 * R0, [x, y] = at(-1, wy);
      rect(x - 6, y - 4, 6, 8, T[5]); hl(x - 6, x - 1, y - 4, T[7]); hl(x - 6, x - 1, y + 3, T[3]); vl(x - 7, y - 3, y + 2, T[4]);
      rect(x - 9, y - 2, 3, 4, T[6]); vl(x - 9, y - 2, y + 1, T[8]); }
  }
  function flaps(t, sh, G) {
    const { tip, LN, xc, Rw, hwAt, R0 } = G;
    for (const side of [-1, 1]) {
      const root = [];
      const wyA = tip + 0.42 * LN, wyB = tip + LN + 0.62 * R0;
      for (let k = 0; k <= 8; k++) { const wy = lerp(wyA, wyB, k / 8); root.push([xc(wy) + side * (hwAt(wy) - 1.5), wy]); }
      const B = root[8], Ar = root[0];
      const C = [B[0] + side * 0.5 * R0, B[1] - 0.06 * R0];
      const Dd = [xc(wyA) + side * (hwAt(wyB) + 0.42 * R0), wyA + 0.5 * R0];
      const pts = side < 0 ? [Ar, Dd, C, ...root.slice().reverse()] : [Ar, Dd, C, ...root.slice().reverse()];
      wpoly(pts, 0, (x, y) => {
        const [wx, wy] = inv(x - sh[0], y - sh[1]);
        const out = Math.abs(wx - xc(wy)) - hwAt(wy);
        const v = 1.1 + 0.9 * smooth(0, 0.45 * R0, out) * (side < 0 ? 1 : 0.5);
        P(x, y, pick(T, v, x, y));
      }, sh);
      // lit leading edge, darker outer edge
      wline(Ar, Dd, T[4], sh);
      wline(Dd, C, T[3], sh);
    }
  }

  // ---- arm hardware rigidly attached to the camera (foreground right) ----
  function ellipse(cx, cy, rx, ry, cb) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry; if (dx * dx + dy * dy <= 1) cb(x, y, dx, dy);
    }
  }
  const inTri = (p, a, b, c) => {
    const s = (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
    const t2 = (c[0] - b[0]) * (p[1] - b[1]) - (c[1] - b[1]) * (p[0] - b[0]);
    const u = (a[0] - c[0]) * (p[1] - c[1]) - (a[1] - c[1]) * (p[0] - c[0]);
    return (s >= 0 && t2 >= 0 && u >= 0) || (s <= 0 && t2 <= 0 && u <= 0);
  };
  function pipe(p0, pc, p1, r, light) {
    const pts = [];
    for (let k = 0; k <= 48; k++) { const f = k / 48, a = (1 - f) * (1 - f), b = 2 * f * (1 - f), c = f * f; pts.push([a * p0[0] + b * pc[0] + c * p1[0], a * p0[1] + b * pc[1] + c * p1[1]]); }
    const x0 = Math.min(p0[0], p1[0], pc[0]) - r - 1, x1 = Math.max(p0[0], p1[0], pc[0]) + r + 1;
    const y0 = Math.min(p0[1], p1[1], pc[1]) - r - 1, y1 = Math.max(p0[1], p1[1], pc[1]) + r + 1;
    for (let y = Math.floor(y0); y <= y1; y++) for (let x = Math.floor(x0); x <= x1; x++) {
      if (x < 0 || x >= W || y < 0 || y >= H) continue;
      let best = 1e9, bi = 0;
      for (let k = 0; k < pts.length; k++) { const dx = x + 0.5 - pts[k][0], dy = y + 0.5 - pts[k][1], d = dx * dx + dy * dy; if (d < best) { best = d; bi = k; } }
      const d = Math.sqrt(best);
      if (d > r) continue;
      const k2 = Math.min(bi + 1, pts.length - 1), k1 = Math.max(bi - 1, 0);
      const tx = pts[k2][0] - pts[k1][0], ty = pts[k2][1] - pts[k1][1], tl = Math.hypot(tx, ty);
      const nside = ((x + 0.5 - pts[bi][0]) * (-ty) + (y + 0.5 - pts[bi][1]) * tx) / tl; // + = above for left->right
      const v = -nside / r; // -1 top .. 1 bottom
      let c;
      if (v < -0.9) c = T[3];
      else if (v < -0.72) c = light ? T[5] : T[4];
      else if (v < -0.6) c = S[3];
      else if (v < 0.5) c = pick(T, 2.7 - (v + 0.6) * 1.5, x, y);
      else c = v < 0.9 ? T[1] : T[0];
      buf[y * W + x] = c;
    }
  }
  function hardware(t) {
    // pipes first (furthest back of the foreground), on a shadowed bundle
    poly([[372, 204], [480, 186], [480, 272], [336, 272], [362, 236]], T[1]);
    pipe([340, 290], [420, 266], [500, 266], 15, false);
    pipe([384, 246], [438, 232], [500, 233], 16, true);
    pipe([372, 214], [428, 200], [500, 201], 13, true);
    // gusset plate with triangular lightening holes
    const tri1 = [[336, 224], [370, 219], [348, 247]], tri2 = [[354, 262], [380, 222], [372, 262]];
    poly([[322, 212], [392, 202], [368, 272], [328, 272]], 0, (x, y) => {
      const p = [x + 0.5, y + 0.5];
      if (inTri(p, ...tri1) || inTri(p, ...tri2)) return;
      P(x, y, pick(T, 4.6 - (x - 322) / 70 * 1.2, x, y));
    });
    line(322, 212, 328, 271, T[6]); line(323, 212, 329, 271, T[5]);
    line(tri1[0][0], tri1[0][1] + 1, tri1[2][0], tri1[2][1] + 1, T[6]); line(tri2[0][0], tri2[0][1] + 1, tri2[1][0], tri2[1][1] + 1, T[3]);
    // pin receiver bar
    poly([[316, 197], [394, 188], [394, 202], [316, 213]], T[5]);
    line(316, 197, 394, 188, T[7]); line(316, 198, 394, 189, T[7]); line(316, 213, 394, 202, T[3]);
    for (const hx of [340, 357, 373]) { const hy = ri(lerp(197, 188, (hx - 316) / 78)) + 4; rect(hx - 3, hy, 6, 5, T[1]); hl(hx - 3, hx + 2, hy, T[0]); hl(hx - 3, hx + 2, hy + 5, T[6]); }
    // roller (pin catcher)
    disc(311, 206, 10.5, T[4]);
    disc(311, 206, 9.2, 0, (x, y, dx, dy) => { const v = 6.4 - (dx + dy) * 0.11; P(x, y, pick(T, v, x, y)); });
    disc(308, 203, 4.2, 0, (x, y, dx, dy) => { if (dx + dy < -2.5) P(x, y, T[8]); });
    disc(311.5, 206.5, 3, T[5]); P(311, 206, T[3]); P(310, 205, T[7]);
    // pad bracket plate against the ship
    poly([[292, 136], [305, 133], [307, 220], [294, 223]], T[2]);
    line(292, 136, 294, 223, T[4]); line(292, 136, 305, 133, T[5]);
    for (let y = 146; y < 216; y += 14) P(296 + ri((y - 136) * 0.02), y, T[4]);
    // rail box with round lightening holes
    const F = [[303, 131], [374, 177], [374, 193], [303, 159]];
    poly(F, 0, (x, y) => P(x, y, pick(T, 3.6 + (1 - (x - 303) / 71) * 1.6 - ((y - lerp(131, 177, (x - 303) / 71)) / 28) * 0.8, x, y)));
    poly([[303, 131], [313, 125], [382, 172], [374, 177]], 0, (x, y) => P(x, y, pick(T, 6.6 + (y - 125) / 52 * 0.8, x, y)));
    line(303, 131, 374, 177, T[8]);
    line(303, 159, 374, 193, T[2]);
    line(303, 131, 303, 159, T[6]);
    const holes = [0.13, 0.31, 0.48, 0.63, 0.76, 0.88];
    for (const p of holes) {
      const cx = lerp(303, 374, p) + 1, cy = lerp(145, 185, p), ry = 10 * (1 - p * 0.55), rx = ry * 0.42;
      ellipse(cx, cy, rx, ry, (x, y, dx, dy) => P(x, y, dx < -0.35 ? T[1] : D[1]));
      ellipse(cx, cy, rx, ry, (x, y, dx, dy) => { if (dx * dx + dy * dy > 0.62 && dx > 0.1 && dy > -0.2) P(x, y, T[6]); });
    }
    // bottom-left dark beam corner
    poly([[0, 238], [26, 249], [74, 272], [0, 272]], T[1]);
    line(0, 238, 26, 249, T[3]); line(26, 249, 74, 271, T[3]);
  }

  // ---- sparks where the ship's tiles grind down the arm pad ----
  function sparks(t) {
    const N = 110;
    for (let i = 0; i < N; i++) {
      const burst = i < 30;
      const ts = burst ? TC + 0.02 * hash(i, 9, 5) : TC + Math.pow((i - 30) / (N - 30), 1.6) * 2.5;
      const a = t - ts;
      const life = (burst ? 0.55 : 0.32) + 0.25 * hash(i, 3, 5);
      if (a < 0 || a > life) continue;
      const vx = -(burst ? 50 + 110 * hash(i, 1, 5) : 18 + 40 * hash(i, 1, 5));
      const vy = -(burst ? 40 + 140 * hash(i, 2, 5) : 20 + 55 * hash(i, 2, 5));
      const x0 = 296 + 3 * hash(i, 4, 5), y0 = 134 + 8 * hash(i, 6, 5);
      const pos = aa => [ri(x0 + vx * aa), ri(y0 + vy * aa + 150 * aa * aa)];
      const q = a / life;
      const [x, y] = pos(a), [px, py] = pos(Math.max(0, a - (burst ? 2 : 1) / 30));
      line(px, py, x, y, 0, (xx, yy) => P(xx, yy, q < 0.5 ? Wm[4] : Wm[3]));
      P(x, y, q < 0.3 ? Wm[6] : q < 0.65 ? Wm[5] : Wm[4]);
    }
  }
  // ---- sun glint rolling over the nose as it settles ----
  function glint(t, sh, G) {
    const t0 = 70.15, t1 = 70.95;
    if (t < t0 || t > t1) return;
    const k = Math.sin(Math.PI * (t - t0) / (t1 - t0));
    const wy = G.tip + G.LN * 0.24, p = fwd(G.xc(wy) - 0.42 * G.hwAt(wy), wy);
    const x = ri(p[0] + sh[0]), y = ri(p[1] + sh[1]);
    const L = ri(2 + 7 * k), Ld = ri(1 + 3 * k);
    for (let i = 1; i <= L; i++) {
      const c = i <= L * 0.4 ? Wm[6] : i <= L * 0.75 ? Wm[5] : Wm[4];
      P(x + i, y, c); P(x - i, y, c); P(x, y + i, c); P(x, y - i, c);
    }
    for (let i = 1; i <= Ld; i++) { const c = i === 1 ? Wm[6] : Wm[5]; P(x + i, y + i, c); P(x - i, y - i, c); P(x + i, y - i, c); P(x - i, y + i, c); }
    P(x, y, Wm[6]);
  }

  window.SHOTS.shot8 = function (t) {
    const sh = shake(t);
    const G = shipGeom(t);
    background(t, sh);
    leftStructure(t, sh, G.cf);
    shipBody(t, sh, G);
    shipDetails(t, sh, G);
    flaps(t, sh, G);
    hardware(t);
    sparks(t);
    glint(t, sh, G);
  };
})();
