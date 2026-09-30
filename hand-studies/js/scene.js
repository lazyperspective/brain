/* scene.js — what the pen needs to know about the block-in: which shape is in front at a
 * point, how the light falls across it (cylinder / sphere shading across its width),
 * beside-the-overlap contact shading, and the soft muscle / tendon / knuckle bumps. */
(function () {
  'use strict';
  const HS = window.HS;
  const { clamp, lerp, smooth, V } = HS;
  const sqrt = Math.sqrt, exp = Math.exp, pow = Math.pow, cos = Math.cos, sin = Math.sin;

  function pip(P, n, x, y) {
    let inside = false;
    for (let i = 0, j = n - 1; i < n; j = i++) {
      const xi = P[i * 2], yi = P[i * 2 + 1], xj = P[j * 2], yj = P[j * 2 + 1];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }

  HS.makeScene = function (sc, sk, pose) {
    const { forms, cam, k } = sc;
    const S = { sc, sk, forms, cam, k, pose };
    const Lc = V.norm(pose.light || [-0.55, 0.62, 0.6]);
    S.L = Lc; S.Lr = V.norm([0.7, -0.4, 0.35]);
    S.away = (() => { const a = [-Lc[0], Lc[1]]; const l = Math.hypot(a[0], a[1]) || 1; return [a[0] / l, a[1] / l]; })();
    S.toLight2 = [-S.away[0], -S.away[1]];
    S.amb = pose.amb == null ? 0.14 : pose.amb;

    let gx0 = 1e9, gy0 = 1e9, gx1 = -1e9, gy1 = -1e9;
    for (const f of forms) {
      f.P = new Float64Array(f.poly.length * 2);
      f.poly.forEach((p, i) => { f.P[i * 2] = p[0]; f.P[i * 2 + 1] = p[1]; });
      f.np = f.poly.length;
      if (f.m) {
        f.cum = [0];
        for (let i = 1; i < f.m.length; i++) f.cum.push(f.cum[i - 1] + Math.hypot(f.m[i][0] - f.m[i - 1][0], f.m[i][1] - f.m[i - 1][1]));
        f.total = f.cum[f.cum.length - 1];
      }
      let a = 0;
      for (let i = 0; i < f.np; i++) { const j = (i + 1) % f.np; a += f.P[i * 2] * f.P[j * 2 + 1] - f.P[j * 2] * f.P[i * 2 + 1]; }
      f.area = a / 2;
      const hwMax = f.hw ? Math.max(...f.hw) : 10;
      f.bx = [f.bbox[0], f.bbox[1], f.bbox[2], f.bbox[3]];
      if (f.faceN) {
        const s = f.faceN[2] >= 0 ? 1 : -1;
        f.faceZ = f.faceN[2];
        f.tilt = [f.faceN[0] * s * f.tiltW, f.faceN[1] * s * f.tiltW];
      } else f.tilt = [0, 0];
      f.pxCm = k;
      gx0 = Math.min(gx0, f.bx[0]); gy0 = Math.min(gy0, f.bx[1]); gx1 = Math.max(gx1, f.bx[2]); gy1 = Math.max(gy1, f.bx[3]);
    }
    // a digit that is not folded up shades as one continuous form across its joints
    for (const digit of sc.fingers.concat([sc.thumb])) {
      let ok = true;
      for (let j = 0; j < 2; j++) {
        const a = digit[j], b = digit[j + 1];
        const ax = a.ax[a.N - 1], bx = b.ax[0];
        const cosA = ax[0] * bx[0] + ax[1] * bx[1];
        const la = a.total, lb = b.total;
        if (cosA < 0.2 || la < 0.9 * a.hw[0] || lb < 0.9 * b.hw[0]) ok = false;
      }
      if (!ok) continue;
      const ch = { m: [], hw: [], zc: [], zr: [] };
      digit.forEach((f, j) => {
        for (let i = j === 0 ? 0 : 1; i < f.N; i++) { ch.m.push(f.m[i]); ch.hw.push(f.hw[i]); ch.zc.push(f.zc[i]); ch.zr.push(f.zr[i]); }
      });
      ch.N = ch.m.length;
      ch.ax = []; ch.perp = [];
      digit.forEach((f, j) => { for (let i = j === 0 ? 0 : 1; i < f.N; i++) { ch.ax.push(f.ax[i]); ch.perp.push(f.perp[i]); } });
      ch.cum = [0];
      for (let i = 1; i < ch.N; i++) ch.cum.push(ch.cum[i - 1] + Math.hypot(ch.m[i][0] - ch.m[i - 1][0], ch.m[i][1] - ch.m[i - 1][1]));
      ch.total = ch.cum[ch.N - 1];
      ch.forms = new Set(digit.map((f) => f.id));
      ch.bow = digit.reduce((a, f) => a + f.bow, 0) / 3;
      for (const f of digit) f.chain = ch;
    }
    S.units = [];
    const seen = new Set();
    for (const f of forms) {
      if (f.kind !== 'tube' || seen.has(f)) continue;
      if (f.chain) { if (seen.has(f.chain)) continue; seen.add(f.chain); S.units.push(f.chain); }
      else { seen.add(f); S.units.push({ m: f.m, hw: f.hw, ax: f.ax, perp: f.perp, cum: f.cum, total: f.total, N: f.N, bow: f.bow, isBody: !!f.isBody, forms: new Set([f.id]) }); }
    }
    const pad = 24;
    S.gx0 = gx0 - pad; S.gy0 = gy0 - pad; S.gx1 = gx1 + pad; S.gy1 = gy1 + pad;
    S.cell = 24;
    S.gw = Math.ceil((S.gx1 - S.gx0) / S.cell); S.gh = Math.ceil((S.gy1 - S.gy0) / S.cell);
    S.cells = Array.from({ length: S.gw * S.gh }, () => []);
    for (const f of forms) {
      const c0 = Math.floor((f.bx[0] - 16 - S.gx0) / S.cell), c1 = Math.floor((f.bx[2] + 16 - S.gx0) / S.cell);
      const r0 = Math.floor((f.bx[1] - 16 - S.gy0) / S.cell), r1 = Math.floor((f.bx[3] + 16 - S.gy0) / S.cell);
      for (let r = Math.max(0, r0); r <= Math.min(S.gh - 1, r1); r++) for (let c = Math.max(0, c0); c <= Math.min(S.gw - 1, c1); c++) S.cells[r * S.gw + c].push(f);
    }
    S.at = (x, y) => {
      const c = Math.floor((x - S.gx0) / S.cell), r = Math.floor((y - S.gy0) / S.cell);
      if (c < 0 || r < 0 || c >= S.gw || r >= S.gh) return null;
      return S.cells[r * S.gw + c];
    };
    S.inside = (f, x, y) => x >= f.bx[0] && x <= f.bx[2] && y >= f.bx[1] && y <= f.bx[3] && pip(f.P, f.np, x, y);

    /* ---- soft bumps (muscle, tendon, knuckle) on the palm/forearm block ---- */
    const P = sk.palm, bumps = [];
    const proj = (x, y, top) => cam.proj(P.face(x, y, top));
    const bump = (cx, cy, top, sx, sy, A, axisTo) => {
      const c = proj(cx, cy, top);
      let ux = 0, uy = -1;
      const b = proj(axisTo ? axisTo[0] : cx, axisTo ? axisTo[1] : cy + 1, top);
      const l = Math.hypot(b[0] - c[0], b[1] - c[1]);
      if (l > 1e-6) { ux = (b[0] - c[0]) / l; uy = (b[1] - c[1]) / l; }
      bumps.push({ x: c[0], y: c[1], ux, uy, su: sx * k * 1.25, sv: sy * k * 1.25, A: A * k * 0.6, side: top ? 1 : -1 });
    };
    const ext = pose.fingers.map((f) => clamp(1 - (f.mcp || 0) / 1.0, 0.25, 1));
    sk.MCP.forEach((m, i) => {
      const y1 = 8.6, x1 = m.x, y0 = 1.2, x0 = m.x * 0.5;
      const mid = [(x0 + x1) / 2, (y0 + y1) / 2];
      bump(mid[0], mid[1], true, 3.4, 0.33, 0.14 * ext[i], [x1, y1]);
      const fl = clamp((pose.fingers[i].mcp || 0) / 1.2, 0, 1);
      bump(m.x, m.y - 0.15, true, 0.8, 0.8, 0.1 + 0.32 * fl);
      bump(m.x, m.y - 0.8, false, 0.75, 0.55, 0.2);
    });
    bump(-3.2, 5.2, true, 1.6, 1.2, 0.38 * (pose.interosseous == null ? 1 : pose.interosseous));
    bump(2.4, -0.5, true, 0.6, 0.5, 0.3);
    bump(-2.6, -0.6, true, 0.7, 0.6, 0.22);
    bump(-0.6, -5.0, true, 2.2, 1.7, 0.28);
    bump(-2.4, 3.0, false, 2.4, 1.9, 0.9 * (pose.thenar == null ? 0.9 : pose.thenar), [-3.2, 4.4]);
    bump(2.4, 3.9, false, 2.4, 1.2, 0.5);
    bump(0.2, 5.4, false, 1.7, 1.7, -0.4 * (0.4 + (pose.cup || 0)));
    S.bumps = bumps;
    const bodyF = forms.find((f) => f.isBody);
    S.body = bodyF;
    S.bumpW = { 1: smooth(0.05, 0.5, bodyF.faceZ), '-1': smooth(0.05, 0.5, -bodyF.faceZ) };
    S.fadeY = pose.fadeArm ? [P.y0 + 0.2, P.y0 + Math.min(sk.arm * 0.78, 5.2)] : null;

    S.ev = { depth: 0, nx: 0, ny: 0, nz: 1, t: 0, fade: 1, nz0: 1 };
    return S;
  };

  /* evaluate a form at a screen point already known to be inside it */
  HS.evalForm = function (S, f, x, y, o) {
    if (f.kind === 'web') {
      o.depth = f.zc[0]; o.nx = f.tilt[0]; o.ny = f.tilt[1]; o.nz = 1; o.t = 0; o.fade = 1; o.nz0 = 1;
      // valleys: darker close to the finger sides
      let d = 1e9;
      for (const [a, b] of [[f.A0, f.A1], [f.B0, f.B1]]) {
        const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy || 1;
        const t = clamp(((x - a[0]) * dx + (y - a[1]) * dy) / l2, 0, 1);
        d = Math.min(d, Math.hypot(x - a[0] - dx * t, y - a[1] - dy * t));
      }
      o.valley = exp(-d / (0.16 * S.k));
      const n = V.norm([o.nx * 0.6, o.ny * 0.6, 1]);
      o.nx = n[0]; o.ny = n[1]; o.nz = n[2];
      return o;
    }
    const G = f.chain || f;
    const m = G.m, N = G.N;
    let best = 1e18, bi = 0, bt = 0;
    for (let i = 0; i < N - 1; i++) {
      const a = m[i], b = m[i + 1], dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy || 1e-9;
      const t = clamp(((x - a[0]) * dx + (y - a[1]) * dy) / l2, 0, 1);
      const qx = a[0] + dx * t - x, qy = a[1] + dy * t - y, d2 = qx * qx + qy * qy;
      if (d2 < best) { best = d2; bi = i; bt = t; }
    }
    const hw = lerp(G.hw[bi], G.hw[bi + 1], bt) || 1;
    const mx = lerp(m[bi][0], m[bi + 1][0], bt), my = lerp(m[bi][1], m[bi + 1][1], bt);
    let ox = (x - mx) / hw, oy = (y - my) / hw;
    let r2 = ox * ox + oy * oy;
    if (r2 > 0.9995) { const r = sqrt(r2); ox /= r * 1.0003; oy /= r * 1.0003; r2 = ox * ox + oy * oy; }
    if (f.flat !== 1) { const kk = pow(r2 + 1e-9, (f.flat - 1) / 2); ox *= kk; oy *= kk; r2 = ox * ox + oy * oy; }
    const nz0 = sqrt(Math.max(0, 1 - r2));
    let nx = ox + f.tilt[0], ny = -oy + f.tilt[1], nz = nz0 + 0.02;
    if (f.isBody) {
      for (const b of S.bumps) {
        const wgt = S.bumpW[b.side];
        if (wgt < 0.02) continue;
        const dx = x - b.x, dy = y - b.y;
        const a = dx * b.ux + dy * b.uy, c = -dx * b.uy + dy * b.ux;
        const G = b.A * exp(-((a * a) / (b.su * b.su) + (c * c) / (b.sv * b.sv)));
        if (G < 1e-4 * b.A && G > -1e-4) continue;
        const ga = (-2 * a * G) / (b.su * b.su), gc = (-2 * c * G) / (b.sv * b.sv);
        const gx = ga * b.ux - gc * b.uy, gy = ga * b.uy + gc * b.ux;
        nx += -gx * wgt; ny += gy * wgt;
      }
    }
    const l = Math.hypot(nx, ny, nz) || 1;
    o.nx = nx / l; o.ny = ny / l; o.nz = nz / l; o.nz0 = nz0;
    o.depth = lerp(G.zc[bi], G.zc[bi + 1], bt) - nz0 * lerp(G.zr[bi], G.zr[bi + 1], bt);
    o.t = bi + bt; o.hw = hw; o.mx = mx; o.my = my;
    o.fade = 1;
    if (f.isBody && S.fadeY) { const y = S.sk.palm.y0 + o.t * ((7.6 - S.sk.palm.y0) / (N - 1)); o.fade = smooth(S.fadeY[0], S.fadeY[1], y); }
    return o;
  };

  /* which shape is nearest the viewer at (x, y)? returns the form (or null); S.ev holds its eval */
  const tmp = { depth: 0, nx: 0, ny: 0, nz: 1, t: 0, fade: 1 };
  HS.owner = function (S, x, y) {
    const list = S.at(x, y);
    if (!list) return null;
    let best = null, bd = 1e9;
    for (let i = 0; i < list.length; i++) {
      const f = list[i];
      if (!S.inside(f, x, y)) continue;
      HS.evalForm(S, f, x, y, tmp);
      let d = tmp.depth;
      if (f.kind === 'web') d += 0.05;
      if (d < bd) { bd = d; best = f; const e = S.ev; e.depth = tmp.depth; e.nx = tmp.nx; e.ny = tmp.ny; e.nz = tmp.nz; e.t = tmp.t; e.fade = tmp.fade; e.hw = tmp.hw; e.valley = tmp.valley; e.nz0 = tmp.nz0; }
    }
    return best;
  };

  /* is the point held by form f, or by something fused to it at almost the same depth? */
  HS.heldBy = function (S, f, x, y) {
    const o = HS.owner(S, x, y);
    if (!o) return null;
    if (o === f) return o;
    if (f.linked.has(o.id) && Math.abs(S.ev.depth - depthOf(S, f, x, y)) < 0.9) return o;
    return null;
  };
  const tmp2 = { depth: 0, nx: 0, ny: 0, nz: 1 };
  function depthOf(S, f, x, y) { HS.evalForm(S, f, x, y, tmp2); return tmp2.depth; }
  HS.depthOf = depthOf;

  /* tone 0 (paper) .. 1 (deepest ink) for the current S.ev belonging to form f at (x, y) */
  HS.tone = function (S, f, x, y) {
    const e = S.ev, L = S.L, Lr = S.Lr;
    const lam = clamp(e.nx * L[0] + e.ny * L[1] + e.nz * L[2], 0, 1);
    const refl = pow(Math.max(0, e.nx * Lr[0] + e.ny * Lr[1] + e.nz * Lr[2]), 1.5) * 0.2;
    const I = S.amb + (1 - S.amb) * pow(lam, 1.1) + refl * (1 - lam) * 0.8;
    let t = pow(clamp((1 - I - 0.2) / 0.78, 0, 1), 1.0);
    if (f.kind === 'web') t = 0.2 + 0.5 * (e.valley || 0) + 0.25 * t;
    // contact shading beside overlaps (nearer shapes throw a short shadow onto this one)
    const list = S.at(x, y);
    if (list && list.length > 1) {
      let sh = 0;
      const ax = S.away[0], ay = S.away[1], k = S.k;
      for (let i = 0; i < list.length && sh < 1; i++) {
        const b = list[i];
        if (b === f || b.kind === 'web') continue;
        const d1 = 0.12 * k, d2 = 0.3 * k;
        const x1 = x - ax * d1, y1 = y - ay * d1, x2 = x - ax * d2, y2 = y - ay * d2;
        const in1 = S.inside(b, x1, y1), in2 = in1 || S.inside(b, x2, y2);
        if (!in2) continue;
        if (f.linked.has(b.id) && Math.abs(depthOf(S, b, in1 ? x1 : x2, in1 ? y1 : y2) - e.depth) < 0.5) continue;
        const gap = e.depth - depthOf(S, b, in1 ? x1 : x2, in1 ? y1 : y2);
        if (gap < 0.3) continue;
        sh = Math.max(sh, in1 ? 1 : 0.55);
      }
      if (sh > 0) t = t + sh * (0.6 - 0.45 * t);
    }
    return clamp(t, 0, 1) * (e.fade == null ? 1 : e.fade);
  };
})();
