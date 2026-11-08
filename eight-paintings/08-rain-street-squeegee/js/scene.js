// scene.js — builds the photographic "reference" the painter works from: a rainy tram street at night.
// Pinhole camera, ray-traced facades / awnings / blade signs / wet ground with mirror reflections,
// Canvas2D billboards (figure, taxi, tram, car, lamps, wires) drawn in world metres, HDR emitters, bloom.
(function () {
  'use strict';
  const N = P8.noise, FB = P8.fbm, SM = P8.smooth, CL = P8.clamp, HF = P8.hashf;

  P8.buildScene = function (W, H, seed) {
    const S = W / 2160;
    const R = P8.rng(seed);
    const f = 1650 * S, xv = 0.55 * W, yh = 0.43 * H, cx = -2.0, cy = 1.6;
    const XL = -7, XR = 7, CURB = 4.5, SWH = 0.15;
    const FOGD = 105;
    const fogCol = [0.052, 0.044, 0.058];
    const cam = { f: f, xv: xv, yh: yh, cx: cx, cy: cy, S: S };
    const proj = function (x, h, z) { return [xv + f * (x - cx) / z, yh - f * (h - cy) / z]; };
    const projM = function (x, h, z) { return [xv + f * (x - cx) / z, yh + f * (h + cy) / z]; };

    // ---------------------------------------------------------------- buildings
    function mkSide(side, sd) {
      const r = P8.rng(sd), segs = [];
      let z = side < 0 ? 2 : 4;
      const walls = side < 0
        ? [[0.20, 0.13, 0.10], [0.16, 0.15, 0.14], [0.24, 0.19, 0.13], [0.12, 0.11, 0.11], [0.22, 0.12, 0.09]]
        : [[0.17, 0.15, 0.14], [0.21, 0.14, 0.10], [0.13, 0.12, 0.12], [0.25, 0.21, 0.15]];
      const shopCols = [[1.0, 0.66, 0.36], [1.0, 0.78, 0.52], [0.78, 0.9, 1.0], [0.85, 1.0, 0.82], [1.0, 0.55, 0.42], [1.0, 0.72, 0.6]];
      let k = 0;
      while (z < 420) {
        const w = 8 + r() * 11;
        const b = {
          z0: z, z1: z + w, h: 15 + r() * 11 + (r() < 0.2 ? 5 : 0),
          wall: walls[(k + (r() * 2 | 0)) % walls.length].slice(), gf: 4.1 + r() * 0.4, fh: 3.1 + r() * 0.4,
          bay: 2.3 + r() * 0.8, ww: 0.42 + r() * 0.18, lit: 0.3 + r() * 0.35, seed: (r() * 1e9) | 0,
          shop: r() < 0.88, shopCol: shopCols[(r() * shopCols.length) | 0], shopI: 0.55 + r() * 0.75,
          sbay: 2.6 + r() * 1.4, fascia: r() < 0.55, fasciaCol: [[0.9, 0.2, 0.25], [0.15, 0.55, 0.9], [0.95, 0.8, 0.5], [0.2, 0.8, 0.6], [0.95, 0.95, 0.9]][(r() * 5) | 0],
          neon: null, stype: 0
        };
        { const t = r(); b.stype = t < 0.35 ? 0 : t < 0.65 ? 1 : t < 0.82 ? 3 : 2; }
        b.wall[0] *= 0.8 + r() * 0.4; b.wall[1] *= 0.8 + r() * 0.4; b.wall[2] *= 0.8 + r() * 0.4;
        segs.push(b); z += w + (r() < 0.15 ? 0.6 : 0); k++;
      }
      const lut = new Int16Array(460);
      for (let i = 0, j = 0; i < 460; i++) { while (j < segs.length - 1 && segs[j].z1 < i + 0.5) j++; lut[i] = j; }
      return { segs: segs, lut: lut, side: side };
    }
    const LEFT = mkSide(-1, seed + 11), RIGHT = mkSide(1, seed + 23);
    function bldAt(sd, z) {
      const i = CL(Math.floor(z), 0, 459); let j = sd.lut[i];
      const s = sd.segs;
      while (j > 0 && s[j].z0 > z) j--; while (j < s.length - 1 && s[j].z1 < z) j++;
      return s[j];
    }

    // neon tube sets, defined as polylines in facade (z,h) or sign (x,h) coordinates
    const neons = [];
    function addNeon(plane, side, pts, col, I, r) { neons.push({ plane: plane, side: side, pts: pts, col: col, I: I, r: r || 0.028 }); }
    function circlePts(c0, c1, rad, n, a0, a1, sx) { const p = []; for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; p.push([c0 + Math.cos(a) * rad * (sx || 1), c1 + Math.sin(a) * rad]); } return p; }
    // left facade neons (z along street, h up)
    addNeon('L', -1, [[9.2, 3.55], [12.6, 3.55], [12.6, 4.05], [9.2, 4.05], [9.2, 3.55]], [1.0, 0.12, 0.32], 9);   // magenta frame
    addNeon('L', -1, circlePts(15.6, 3.75, 0.42, 26, 0, Math.PI * 2, 1.0), [0.15, 0.85, 1.0], 8);                 // cyan ring
    addNeon('L', -1, [[17.0, 3.4], [17.6, 4.0], [18.2, 3.4], [18.8, 4.0], [19.4, 3.4], [20.0, 4.0]], [1.0, 0.3, 0.12], 8); // orange zigzag
    addNeon('L', -1, [[27.5, 3.5], [31.5, 3.5]], [0.3, 1.0, 0.5], 7);
    addNeon('L', -1, [[27.5, 3.95], [31.5, 3.95]], [0.3, 1.0, 0.5], 7);
    addNeon('L', -1, circlePts(38.5, 3.7, 0.5, 20, Math.PI, 2 * Math.PI, 2.0), [1.0, 0.15, 0.25], 9);
    addNeon('L', -1, [[47, 3.45], [51, 3.45], [51, 4.0], [47, 4.0], [47, 3.45]], [0.95, 0.4, 1.0], 8);
    addNeon('L', -1, [[62, 3.6], [67, 3.6]], [1.0, 0.75, 0.3], 8);
    addNeon('R', 1, [[24, 3.5], [27.5, 3.5], [27.5, 4.0], [24, 4.0], [24, 3.5]], [0.2, 0.6, 1.0], 8);
    addNeon('R', 1, circlePts(36, 3.75, 0.45, 20, 0, Math.PI * 2, 2.0), [1.0, 0.2, 0.4], 8);
    addNeon('R', 1, [[55, 3.5], [59, 3.5]], [1.0, 0.6, 0.2], 8);

    // ---------------------------------------------------------------- quads (blade signs, awnings)
    const quads = [];
    function blade(side, z, x0, x1, h0, h1, panel, nfun) { quads.push({ type: 'blade', side: side, z: z, x0: x0, x1: x1, h0: h0, h1: h1, panel: panel, neon: nfun }); }
    blade(-1, 10.6, -7, -5.95, 4.3, 6.3, [0.95, 0.85, 0.55], 0);
    blade(-1, 21.5, -7, -6.05, 4.0, 5.6, [0.2, 0.75, 0.95], 1);
    blade(-1, 33.0, -7, -6.1, 4.2, 6.0, [0.95, 0.25, 0.3], 2);
    blade(-1, 52.0, -7, -6.1, 4.0, 5.5, [0.4, 0.95, 0.6], 1);
    blade(1, 29.0, 6.05, 7, 4.1, 5.8, [0.95, 0.6, 0.2], 2);
    blade(1, 47.0, 6.1, 7, 4.0, 5.4, [0.6, 0.4, 1.0], 0);
    function awning(side, z0, z1, col, stripe) {
      quads.push({ type: 'awn', side: side, z0: z0, z1: z1, hTop: 3.35, out: 1.5, drop: 0.55, col: col, stripe: stripe });
    }
    awning(-1, 22.7, 27.0, [0.32, 0.06, 0.05], 1);
    awning(-1, 40.5, 46.0, [0.06, 0.16, 0.10], 0);
    awning(1, 18.0, 23.0, [0.1, 0.12, 0.2], 1);
    awning(1, 60.0, 66.0, [0.3, 0.1, 0.05], 1);

    // ---------------------------------------------------------------- lights (for diffuse irradiance)
    const lights = [];
    function L(x, h, z, col, I, dir, ex) { lights.push({ x: x, h: h, z: z, c: col, I: I, dir: dir || null, ex: ex || 18 }); }
    const SODIUM = [1.0, 0.6, 0.3], LED = [0.8, 0.9, 1.0];
    const lampsR = [], lampsL = [];
    for (let z = 30; z < 260; z += 23) { lampsR.push(z); L(4.9, 7.4, z, SODIUM, 60, [0, -1, 0], 1.6); }
    for (let z = 14; z < 260; z += 24) { lampsL.push(z); L(-5.9, 5.55, z, LED, 14, [0.25, -1, 0], 2.0); }
    // shop window spill
    [LEFT, RIGHT].forEach(function (sd) {
      sd.segs.forEach(function (b) {
        if (!b.shop || b.z0 > 160) return;
        for (let z = b.z0 + b.sbay * 0.5; z < b.z1; z += b.sbay) if (b.stype !== 2) L(sd.side * 6.3, 1.6, z, b.shopCol, 2.6 * b.shopI, [-sd.side, -0.3, 0], 1.0);
      });
    });
    neons.forEach(function (n) {
      let a = 0, bb = 0; n.pts.forEach(function (p) { a += p[0]; bb += p[1]; }); a /= n.pts.length; bb /= n.pts.length;
      if (n.plane === 'L' || n.plane === 'R') L(n.side * 6.4, bb, a, n.col, n.I * 0.35);
    });
    // oncoming car headlights (spot toward -z), taxi tail lights, tram, traffic signal
    const CAR = { x: -3.1, z: 40 }, TR = { x0: 0.45, x1: 2.75, z0: 15.5, z1: 45.5 }, TRAM = { x: -1.6, z: 96 }, SIG = { x: -4.85, z: 11.2 };
    L(CAR.x - 0.62, 0.66, CAR.z - 2.3, [1.0, 0.93, 0.8], 260, [0, -0.05, -1]);
    L(CAR.x + 0.62, 0.66, CAR.z - 2.3, [1.0, 0.93, 0.8], 260, [0, -0.05, -1]);
    L(TR.x0 + 0.25, 0.75, TR.z0 - 0.1, [1.0, 0.08, 0.04], 2.5);
    L(TR.x1 - 0.25, 0.75, TR.z0 - 0.1, [1.0, 0.08, 0.04], 2.5);
    for (let z = TR.z0 + 2; z < TR.z1 - 1; z += 3.2) L(TR.x0 - 0.2, 1.9, z, [1.0, 0.82, 0.58], 2.2, [-1, -0.35, 0], 1.2);
    L(TRAM.x, 0.9, TRAM.z - 1, [1.0, 0.9, 0.75], 140, [0, -0.04, -1]);
    L(SIG.x + 0.1, 2.55, SIG.z, [0.15, 1.0, 0.65], 2.5);

    function irr(px, ph, pz, nx, ny, nz, out) {
      let r = 0, g = 0, b = 0;
      for (let i = 0; i < lights.length; i++) {
        const l = lights[i];
        const dx = l.x - px, dh = l.h - ph, dz = l.z - pz;
        const d2 = dx * dx + dh * dh + dz * dz;
        if (d2 > 3600) continue;
        const d = Math.sqrt(d2) + 1e-6;
        let c = (dx * nx + dh * ny + dz * nz) / d; if (c <= 0) continue;
        let k = l.I * c / (d2 + 0.5);
        if (l.dir) { const dd = -(dx * l.dir[0] + dh * l.dir[1] + dz * l.dir[2]) / d; k *= dd > 0 ? Math.pow(dd, l.ex) : 0; }
        r += k * l.c[0]; g += k * l.c[1]; b += k * l.c[2];
      }
      out[0] = r; out[1] = g; out[2] = b;
    }

    // ---------------------------------------------------------------- sky
    function sky(dx, dy, dz, out) {
      const hz = Math.sqrt(dx * dx + dz * dz), el = dy / hz;
      const t = CL(el / 0.75, 0, 1);
      const glow = Math.exp(-t * 4.0);
      const cl = 0.5 + 0.5 * FB(dx / dz * 2.2 + 3, el * 5.5, 4, 77);
      const cl2 = 0.5 + 0.5 * FB(dx / dz * 6.0, el * 14, 3, 91);
      const m = 0.55 + 0.6 * cl * cl2;
      out[0] = (0.010 + 0.085 * glow) * m + 0.004;
      out[1] = (0.011 + 0.048 * glow) * m + 0.004;
      out[2] = (0.024 + 0.058 * glow) * m + 0.007;
    }

    // ---------------------------------------------------------------- neon distance
    function segDist(px, py, ax, ay, bx, by) {
      const vx = bx - ax, vy = by - ay, wx = px - ax, wy = py - ay;
      const t = CL((wx * vx + wy * vy) / (vx * vx + vy * vy + 1e-9), 0, 1);
      const qx = wx - vx * t, qy = wy - vy * t; return Math.sqrt(qx * qx + qy * qy);
    }
    function neonEmit(plane, u, v, out, gain) {
      for (let i = 0; i < neons.length; i++) {
        const n = neons[i]; if (n.plane !== plane) continue;
        let dm = 1e9;
        const p = n.pts;
        if (Math.abs(u - p[0][0]) > 8) continue;
        for (let j = 0; j < p.length - 1; j++) dm = Math.min(dm, segDist(u, v, p[j][0], p[j][1], p[j + 1][0], p[j + 1][1]));
        const core = Math.exp(-(dm / n.r) * (dm / n.r));
        const halo = gain * 0.35 / (1 + (dm / 0.12) * (dm / 0.12));
        const e = n.I * (core * 1.6 + halo);
        out[0] += e * n.col[0] + core * n.I * 0.25; out[1] += e * n.col[1] + core * n.I * 0.2; out[2] += e * n.col[2] + core * n.I * 0.22;
      }
    }
    // blade sign icon neon in local (x,h) of sign
    function bladeNeon(q, u, v, out) {
      // u in 0..1 across sign, v 0..1 up
      let dm;
      if (q.neon === 0) { // concentric ring + bar
        const du = (u - 0.5) * 1.0, dv = (v - 0.55) * 1.9;
        dm = Math.abs(Math.sqrt(du * du + dv * dv) - 0.3);
        dm = Math.min(dm, segDist(u, v, 0.2, 0.18, 0.8, 0.18) * 1.2);
      } else if (q.neon === 1) { // three chevrons
        dm = 1e9;
        for (let k = 0; k < 3; k++) { const o = 0.25 + k * 0.22; dm = Math.min(dm, segDist(u, v, 0.25, o, 0.5, o + 0.12), segDist(u, v, 0.5, o + 0.12, 0.75, o)); }
      } else { // wave + dot
        dm = Math.abs(v - (0.55 + 0.12 * Math.sin(u * 12.0)));
        dm = Math.min(dm, Math.sqrt((u - 0.5) * (u - 0.5) + (v - 0.25) * (v - 0.25)) - 0.06);
        dm = Math.max(dm, 0);
      }
      const w = 0.045, core = Math.exp(-(dm / w) * (dm / w));
      const e = 9 * core;
      out[0] += e * 0.4 + core * 2; out[1] += e * 0.4 + core * 2; out[2] += e * 0.4 + core * 2;
      return core;
    }

    // ---------------------------------------------------------------- interior mapping for shop windows (parallax-correct rooms)
    let inRefl = 0;
    const RT = [0, 0, 0];
    function glassRefl(side, z, h, dx, dy, dz, out) {
      // reflection of the street in the glass: trace the mirrored ray once (no deeper recursion)
      if (inRefl) { out[0] = 0.02; out[1] = 0.02; out[2] = 0.025; return; }
      inRefl = 1;
      const sx = hit.x, sh = hit.h, sz = hit.z, st = hit.t, sid = hit.id;
      const r = trace(side < 0 ? XL + 0.01 : XR - 0.01, h, z, -dx, dy, dz, true, out);
      if (r === 2) { out[0] = 0.015; out[1] = 0.014; out[2] = 0.016; }
      hit.x = sx; hit.h = sh; hit.z = sz; hit.t = st; hit.id = sid;
      inRefl = 0;
    }
    function interior(b, side, z, h, dx, dy, dz, out) {
      const inx = Math.abs(dx) + 1e-6, sd = b.seed & 4095;
      const Dp = 3.6 + 2.4 * HF(1, 2, sd);
      const sc = b.shopCol, I0 = b.shopI;
      const zA = b.z0 + 0.3, zB = b.z1 - 0.3;
      let t = Dp / inx, kind = 0;
      if (dy < 0) { const tf = (h - 0.06) / -dy; if (tf < t) { t = tf; kind = 1; } }
      else if (dy > 0) { const tc = (3.0 - h) / dy; if (tc < t) { t = tc; kind = 2; } }
      const ts = (zB - z) / dz; if (ts > 0 && ts < t) { t = ts; kind = 3; }
      let r = 0, g = 0, bl = 0;
      // free-standing contents on planes at fixed depths (front to back)
      const st = b.stype;
      const planes = st === 0 ? [1.4, 2.7] : st === 1 ? [0.9, 1.9, 2.8] : [1.0, 2.1];
      for (let q = 0; q < planes.length; q++) {
        const tm = planes[q] / inx; if (tm >= t) break;
        const zm = z + dz * tm, hm = h + dy * tm;
        if (zm < zA || zm > zB) continue;
        const cz = Math.floor((zm - zA) / 1.25), cu = (zm - zA) / 1.25 - cz, ch = P8.hash2(cz, q + 11, sd) / 4294967296;
        let hitObj = false, oc = null;
        if (st === 0) { // shelving units: rows of goods
          if (hm < 1.65 && cu > 0.08 && cu < 0.92 && ch < 0.8) {
            hitObj = true;
            const row = Math.floor(hm / 0.32), rf = hm / 0.32 - row;
            if (rf < 0.1 || hm > 1.6) oc = [0.25, 0.25, 0.27];
            else {
              const pk = P8.hash2(Math.floor(zm * 9), row + q * 7, sd) / 4294967296;
              const pc = [[0.9, 0.3, 0.2], [0.3, 0.45, 0.9], [0.95, 0.85, 0.4], [0.4, 0.8, 0.45], [0.9, 0.9, 0.85], [0.8, 0.4, 0.7], [0.95, 0.6, 0.2]][(pk * 7) | 0];
              const sh = 0.55 + 0.45 * SM(0.1, 0.6, rf);
              oc = [pc[0] * sh * 0.7, pc[1] * sh * 0.7, pc[2] * sh * 0.7];
            }
          }
        } else if (st === 1) { // cafe: tables, seated people, pendant lamps
          if (q === 1) { // pendant lamps
            const lu = cu - 0.5, lh = hm - 2.25;
            const dd = lu * lu * 1.56 / 0.016 + lh * lh / 0.02;
            if (dd < 1) { r += sc[0] * 7; g += sc[1] * 6; bl += sc[2] * 4.5; out[0] = r; out[1] = g; out[2] = bl; return; }
            if (Math.abs(lu) < 0.008 && hm > 2.3) { hitObj = true; oc = [0.02, 0.02, 0.02]; }
          } else {
            if (Math.abs(hm - 0.76) < 0.025 && cu > 0.15 && cu < 0.75) { hitObj = true; oc = [0.35, 0.22, 0.12]; }
            else if (hm < 0.75 && Math.abs(cu - 0.45) < 0.02) { hitObj = true; oc = [0.03, 0.02, 0.015]; }
            else if (ch < 0.65) {
              const pc = 0.25 + 0.35 * ch, hx = (cu - pc) * 1.25;
              const hd = Math.hypot(hx / 0.095, (hm - 1.22) / 0.12), bd = Math.hypot(hx / 0.2, (hm - 0.93) / 0.24);
              if (hd < 1 || (bd < 1 && hm > 0.72)) { hitObj = true; oc = [0.04 + 0.05 * ch, 0.028, 0.022]; }
            }
          }
        } else { // boutique: clothes rails and mannequins
          if (q === 0 && hm > 0.95 && hm < 1.78 && cu > 0.1 && cu < 0.9) {
            const gi = Math.floor(zm / 0.13), gh = P8.hash2(gi, 5, sd) / 4294967296;
            if (hm > 1.78 - (0.4 + 0.35 * gh) && ((zm / 0.13) % 1) < 0.8) { hitObj = true; const gc = [[0.15, 0.15, 0.2], [0.6, 0.15, 0.12], [0.85, 0.8, 0.7], [0.2, 0.3, 0.25], [0.1, 0.1, 0.1], [0.75, 0.6, 0.45]][(gh * 6) | 0]; oc = gc; }
          } else if (q === 1 && ch < 0.5) {
            const hx = (cu - 0.5) * 1.25;
            if ((Math.abs(hx) < 0.07 + 0.06 * Math.exp(-(hm - 1.35) * (hm - 1.35) * 6) && hm < 1.75 && hm > 0.3) || Math.hypot(hx / 0.08, (hm - 1.85) / 0.1) < 1) { hitObj = true; oc = [0.75, 0.72, 0.68]; }
          }
        }
        if (hitObj) {
          const lit = I0 * (0.6 + 0.5 * SM(0, 2.2, hm));
          out[0] = oc[0] * sc[0] * lit; out[1] = oc[1] * sc[1] * lit; out[2] = oc[2] * sc[2] * lit; return;
        }
      }
      const d = inx * t, zz = z + dz * t, hh = h + dy * t;
      const fall = 1 - 0.12 * d / Dp;
      if (kind === 0 || kind === 3) { // walls
        let w = (kind === 0 ? 0.55 : 0.42) * (0.75 + 0.35 * SM(0, 2.8, hh));
        if (st === 0 && kind === 0 && hh > 0.3 && hh < 2.2) { // wall shelving
          const row = Math.floor(hh / 0.3), rf = hh / 0.3 - row;
          const pk = P8.hash2(Math.floor(zz * 8), row, sd + 3) / 4294967296;
          w *= rf < 0.1 ? 0.5 : 0.35 + 0.6 * pk;
          const pc = [[1, 0.6, 0.5], [0.6, 0.7, 1], [1, 1, 0.7], [0.7, 1, 0.75]][(pk * 4) | 0];
          r = sc[0] * pc[0]; g = sc[1] * pc[1]; bl = sc[2] * pc[2];
        } else if (st === 1 && kind === 0) {
          if (hh < 1.05) { w *= 0.25; } // bar counter
          else if (hh < 1.12) w *= 1.5;
          else if (hh > 1.4 && hh < 1.95 && ((zz * 0.55) % 1) < 0.35) w *= 0.45; // pictures
          else if (hh > 1.25 && hh < 1.35) { const bt = P8.hash2(Math.floor(zz * 14), 2, sd) / 4294967296; w *= bt < 0.6 ? 1.6 : 0.6; } // bottles
          r = sc[0]; g = sc[1] * 0.92; bl = sc[2] * 0.85;
        } else { r = sc[0]; g = sc[1]; bl = sc[2]; }
        w *= fall * I0;
        r *= w; g *= w; bl *= w;
      } else if (kind === 1) { // floor, with soft reflections of the lights
        const refl = 0.25 + 0.2 * Math.max(0, Math.sin(zz * 2.5)) ;
        const w = I0 * 0.22 * refl * fall;
        r = sc[0] * w; g = sc[1] * w; bl = sc[2] * w;
      } else { // ceiling and its lights
        const dd2 = inx * t;
        let w = I0 * 0.32;
        if (st === 0) { const fu = (zz * 0.8) % 1; if (Math.abs(fu - 0.5) < 0.04) w = 6; }
        else if (st === 3) { const a2 = ((zz * 0.9) % 1) - 0.5, b2 = ((dd2 * 0.9) % 1) - 0.5; if (a2 * a2 + b2 * b2 < 0.01) w = 7; }
        else w *= 0.6;
        r = sc[0] * w; g = sc[1] * w; bl = sc[2] * w;
      }
      out[0] = r; out[1] = g; out[2] = bl;
    }

    // ---------------------------------------------------------------- facade shading
    const E = [0, 0, 0];
    function facade(sd, z, h, dx, dy, dz, out) {
      const b = bldAt(sd, z);
      const side = sd.side;
      const xw = side * 7 * -1 === 0 ? 0 : (side < 0 ? XL : XR);
      const nx = -side;
      const cornice = h > b.h - 0.7;
      let alb0 = b.wall[0], alb1 = b.wall[1], alb2 = b.wall[2];
      const tex = 0.75 + 0.25 * FB(z * 0.7, h * 0.7, 3, b.seed & 1023) + 0.12 * N(z * 6, h * 6, 5);
      alb0 *= tex; alb1 *= tex; alb2 *= tex;
      let er = 0, eg = 0, eb = 0;
      let isGlass = false;
      const view = CL(Math.abs(dz / (dx + 1e-6)), 0, 30);
      if (h < b.gf) {
        // shopfront
        if (b.shop) {
          const zz = z - b.z0, bi = Math.floor(zz / b.sbay), u = zz / b.sbay - bi;
          const hs = P8.hash2(bi, 7, b.seed) / 4294967296;
          const pil = u < 0.07 || u > 0.93;
          const door = hs < 0.22 && b.stype !== 2;
          const top = 3.05, bot = door ? 0.02 : 0.5;
          if (!pil && h > bot && h < top) {
            const rev = CL(0.04 * view, 0, 0.25);
            const inner = side < 0 ? u < 0.93 - rev : u > 0.07 + rev;
            const mull = (Math.abs(u - 0.5) < 0.012 || Math.abs(h - 2.55) < 0.025) && !door && b.stype !== 2;
            if (inner && !mull) {
              const vv = (h - bot) / (top - bot);
              const sc = b.shopCol;
              let I = 0;
              if (b.stype === 2) {
                // closed roller shutter: ribbed metal lit by the street
                const rib = 0.75 + 0.25 * Math.sin(h * 78) + 0.1 * N(z * 3, h * 40, 17);
                const a = 0.16 * rib * (0.8 + 0.2 * FB(z * 0.8, h * 0.8, 2, 19));
                alb0 = a; alb1 = a * 0.98; alb2 = a * 1.02;
              } else {
                isGlass = true;
                const IN = [0, 0, 0];
                interior(b, side, z, h, dx, dy, dz, IN);
                const cosI = Math.abs(dx) / Math.sqrt(dx * dx + dy * dy + dz * dz);
                const Fg = 0.05 + 0.95 * Math.pow(1 - cosI, 5);
                glassRefl(side, z, h, dx, dy, dz, RT);
                const fog2 = 0.85 + 0.15 * N(z * 3, h * 3, 99); // smeared, rain-wet glass
                er += (IN[0] * (1 - Fg) + RT[0] * Fg) * fog2; eg += (IN[1] * (1 - Fg) + RT[1] * Fg) * fog2; eb += (IN[2] * (1 - Fg) + RT[2] * Fg) * fog2;
                alb0 = alb1 = alb2 = 0.01;
              }
            } else if (inner && mull) { alb0 = alb1 = alb2 = 0.03; }
            else { alb0 *= 0.45; alb1 *= 0.45; alb2 *= 0.45; }
          } else if (h >= 3.2 && h < 3.95 && !pil) {
            if (b.fascia) {
              const fc = b.fasciaCol, vv = (h - 3.2) / 0.75;
              const I = 1.1 * (0.8 + 0.2 * Math.sin(vv * 3.1)) * (0.92 + 0.08 * N(z * 2, 0, 3));
              er += fc[0] * I; eg += fc[1] * I; eb += fc[2] * I; alb0 = alb1 = alb2 = 0.0;
            } else { alb0 *= 0.5; alb1 *= 0.5; alb2 *= 0.5; }
          } else if (h < bot) { alb0 *= 0.7; alb1 *= 0.7; alb2 *= 0.7; }
        } else {
          alb0 *= 0.7; alb1 *= 0.7; alb2 *= 0.7;
        }
      } else if (!cornice) {
        const zz = z - b.z0 - 0.6, bi = Math.floor(zz / b.bay), u = zz / b.bay - bi;
        const fi = Math.floor((h - b.gf) / b.fh), v = (h - b.gf) / b.fh - fi;
        const string = v < 0.06;
        if (string) { alb0 *= 1.35; alb1 *= 1.35; alb2 *= 1.35; }
        const u0 = 0.5 - b.ww * 0.5, u1 = 0.5 + b.ww * 0.5;
        if (u > u0 && u < u1 && v > 0.28 && v < 0.86 && zz > 0 && z < b.z1 - 0.6) {
          const hs = P8.hash2(bi, fi, b.seed) / 4294967296;
          const rev = CL(0.035 * view, 0, 0.3) * b.ww;
          const inGlass = side < 0 ? (u < u1 - rev) : (u > u0 + rev);
          const frame = (u - u0) < 0.03 || (u1 - u) < 0.03 || v < 0.31 || v > 0.83;
          if (!inGlass) { alb0 *= 0.35; alb1 *= 0.35; alb2 *= 0.35; }
          else if (frame) { alb0 = alb1 = alb2 = 0.16; }
          else {
            isGlass = true;
            const uu = (u - u0) / (u1 - u0), vv = (v - 0.28) / 0.58;
            if (hs < b.lit) {
              const hc = P8.hash2(bi, fi + 99, b.seed) / 4294967296;
              const wc = hc < 0.55 ? [1.0, 0.62, 0.32] : hc < 0.8 ? [1.0, 0.8, 0.55] : hc < 0.92 ? [0.55, 0.7, 1.0] : [1.0, 0.45, 0.35];
              let I = 0.15 + 0.8 * Math.pow(P8.hash2(bi, fi + 7, b.seed) / 4294967296, 1.5);
              const curtain = hc > 0.4 ? 0.72 + 0.28 * N(uu * 7 + hc * 30, vv * 0.6, 23) : hc > 0.25 ? 0.75 + 0.25 * Math.sin(vv * 60) : 1;
              I *= curtain * (0.7 + 0.5 * vv);
              if (hc < 0.3) { I *= vv > 0.55 ? 1.15 : 0.55; if (uu > 0.15 && uu < 0.55 && vv < 0.4) I *= 0.4; }
              er += wc[0] * I; eg += wc[1] * I; eb += wc[2] * I;
            } else {
              er += 0.008 + 0.01 * vv; eg += 0.008 + 0.01 * vv; eb += 0.014 + 0.012 * vv;
            }
            alb0 = alb1 = alb2 = 0.01;
          }
        } else if (v > 0.2 && v < 0.27 && u > u0 - 0.06 && u < u1 + 0.06) { alb0 *= 1.6; alb1 *= 1.6; alb2 *= 1.6; } // sill
      } else {
        const cv = (b.h - h) / 0.7;
        const k = cv < 0.25 ? 1.5 : cv < 0.55 ? 0.6 : 1.15;
        alb0 *= k; alb1 *= k; alb2 *= k;
      }
      // neon on the facade (+ its wall spill)
      const tmp = [0, 0, 0];
      neonEmit(side < 0 ? 'L' : 'R', z, h, tmp, isGlass ? 0.3 : 1);
      er += tmp[0]; eg += tmp[1]; eb += tmp[2];
      irr(side < 0 ? XL : XR, h, z, nx, 0, 0, E);
      out[0] = alb0 * (E[0] + 0.012) + er; out[1] = alb1 * (E[1] + 0.012) + eg; out[2] = alb2 * (E[2] + 0.018) + eb;
    }

    // ---------------------------------------------------------------- ground albedo/info
    const G = { alb: [0, 0, 0], wet: 0, puddle: 0, rail: 0, id: 4, rough: 1 };
    const rails = [-1.6 - 0.72, -1.6 + 0.72, 1.6 - 0.72, 1.6 + 0.72];
    function ground(x, z, sidewalk, dist) {
      const lod = CL(9 / dist, 0, 1);
      if (!sidewalk) {
        let a = 0.040 + 0.016 * FB(x * 0.25, z * 0.25, 3, 5) + 0.012 * FB(x * 1.3, z * 1.3, 2, 8);
        // patch repairs
        const patch = SM(0.25, 0.3, FB(x * 0.12 + 7, z * 0.07, 3, 13));
        a = a * (1 - patch) + patch * (a * 0.7);
        // aggregate: small stones, faded by pixel footprint
        const fp = f / dist; // px per metre
        const ag1 = N(x * 70, z * 70, 3), ag2 = N(x * 160, z * 160, 4);
        a += CL(fp / 900, 0, 1) * (0.022 * SM(0.25, 0.6, ag1) - 0.01 * SM(0.2, 0.6, -ag1)) + CL(fp / 1800, 0, 1) * 0.012 * ag2;
        let ar = a, ag = a, ab = a * 1.06;
        let wet = 0.62 + 0.25 * FB(x * 0.5, z * 0.3, 3, 21);
        // puddles
        let pn = FB(x * 0.42 + 3, z * 0.3, 4, 31) + 0.18 * FB(x * 1.6, z * 1.1, 2, 41) + 0.12 * SM(12, 3, z);
        let pud = SM(0.1, 0.16, pn);
        let rail = 0;
        for (let i = 0; i < 4; i++) {
          const d = Math.abs(x - rails[i]);
          if (d < 0.034) rail = 1;
          else if (d < 0.07 && ((i & 1) ? x < rails[i] : x > rails[i])) { ar *= 0.25; ag *= 0.25; ab *= 0.25; pud = Math.max(pud, 0.85); }
        }
        // zebra crossing
        if (z > 6.0 && z < 9.6 && x > -4.2 && x < 4.2) {
          const s = ((x + 4.2) / 1.05) % 1;
          if (s < 0.5) {
            const edge = Math.min(s, 0.5 - s) / 0.5;
            const wear = CL(0.92 - 0.55 * SM(0.15, 0.6, FB(x * 1.3, z * 0.9, 4, 61)) - 0.35 * SM(0.3, 0.8, N(x * 22, z * 14, 62)) * (1 - edge * 0.5), 0, 1);
            const pa = 0.50 * wear;
            ar = ar * (1 - wear) + pa; ag = ag * (1 - wear) + pa; ab = ab * (1 - wear) + pa * 0.98;
            pud *= 0.4; wet *= 0.8;
          }
        }
        if (Math.abs(x) > CURB - 0.35) pud = Math.max(pud, SM(0.0, 0.08, FB(x * 0.5, z * 0.4, 3, 71) + 0.1));
        G.alb[0] = ar; G.alb[1] = ag; G.alb[2] = ab; G.wet = wet; G.puddle = pud; G.rail = rail; G.id = 4;
      } else {
        const gx = x / 0.6, gz = z / 0.6;
        const fx = gx - Math.floor(gx), fz = gz - Math.floor(gz);
        const joint = (fx < 0.04 || fz < 0.04) ? 0.55 : 1;
        const tile = 0.09 + 0.03 * HF(Math.floor(gx), Math.floor(gz), 9);
        const a = tile * joint * (0.9 + 0.2 * FB(x * 2, z * 2, 2, 19));
        G.alb[0] = a; G.alb[1] = a * 0.98; G.alb[2] = a * 0.97;
        G.wet = 0.5; G.puddle = SM(0.25, 0.3, FB(x * 0.6, z * 0.35, 3, 83)) * 0.9; G.rail = 0; G.id = 5;
      }
    }

    // ---------------------------------------------------------------- tracer
    const hit = { t: 0, id: 0, x: 0, h: 0, z: 0 };
    function fog(out, t) {
      const T = Math.exp(-t / FOGD);
      out[0] = out[0] * T + fogCol[0] * (1 - T); out[1] = out[1] * T + fogCol[1] * (1 - T); out[2] = out[2] * T + fogCol[2] * (1 - T);
    }
    // returns radiance in out; when allowGround, ground info left in G/hit
    function trace(ox, oy, oz, dx, dy, dz, allowGround, out) {
      let tBest = 1e9, kind = 0, qBest = null;
      if (dx < 0) { const t = (XL - ox) / dx; if (t > 0) { tBest = t; kind = 1; } }
      else if (dx > 0) { const t = (XR - ox) / dx; if (t > 0) { tBest = t; kind = 2; } }
      if (kind) { const hh = oy + dy * tBest, zz = oz + dz * tBest; const b = bldAt(kind === 1 ? LEFT : RIGHT, zz); if (hh > b.h || hh < 0) { kind = 0; tBest = 1e9; } }
      let groundT = 1e9, sidewalk = false;
      if (allowGround && dy < 0) {
        const t0 = oy / -dy, x0 = ox + dx * t0;
        if (Math.abs(x0) <= CURB) { groundT = t0; }
        else {
          const t1 = (oy - SWH) / -dy, x1 = ox + dx * t1;
          if (Math.abs(x1) > CURB) { groundT = t1; sidewalk = true; }
          else { const tc = ((x0 < 0 ? -CURB : CURB) - ox) / dx; groundT = tc; sidewalk = true; }
        }
      }
      for (let i = 0; i < quads.length; i++) {
        const q = quads[i];
        let t;
        if (q.type === 'blade') {
          if (Math.abs(dz) < 1e-6) continue;
          t = (q.z - oz) / dz; if (t <= 0.01 || t >= tBest) continue;
          const xx = ox + dx * t, hh = oy + dy * t;
          if (xx < q.x0 || xx > q.x1 || hh < q.h0 || hh > q.h1) continue;
          tBest = t; kind = 3; qBest = q;
        } else {
          const k = q.drop / q.out, sx = q.side; // h = hTop - (|x| - 7 + out)... plane through facade top edge sloping outward
          // points: x = sx*(7 - s), h = hTop - s*k, s in [0,out]
          const den = dy - k * sx * dx;
          if (Math.abs(den) < 1e-9) continue;
          t = (q.hTop - k * 7 + k * sx * ox - oy) / den;
          if (t <= 0.01 || t >= tBest) continue;
          const xx = ox + dx * t, zz = oz + dz * t, s = 7 - sx * xx;
          if (s < 0 || s > q.out || zz < q.z0 || zz > q.z1) continue;
          tBest = t; kind = 4; qBest = q;
        }
      }
      if (groundT < tBest) {
        hit.t = groundT; hit.id = sidewalk ? 5 : 4; hit.x = ox + dx * groundT; hit.h = oy + dy * groundT; hit.z = oz + dz * groundT;
        return 2; // caller shades ground
      }
      hit.t = tBest; hit.x = ox + dx * tBest; hit.h = oy + dy * tBest; hit.z = oz + dz * tBest;
      if (kind === 0) { sky(dx, dy, dz, out); hit.id = 0; out[0] = out[0] * 0.75 + fogCol[0] * 0.3; out[1] = out[1] * 0.75 + fogCol[1] * 0.3; out[2] = out[2] * 0.75 + fogCol[2] * 0.3; return 0; }
      if (kind === 1 || kind === 2) { facade(kind === 1 ? LEFT : RIGHT, hit.z, hit.h, dx, dy, dz, out); hit.id = kind; }
      else if (kind === 3) {
        const q = qBest, u = (hit.x - q.x0) / (q.x1 - q.x0), v = (hit.h - q.h0) / (q.h1 - q.h0);
        const fr = u < 0.07 || u > 0.93 || v < 0.05 || v > 0.95;
        if (fr) { irr(hit.x, hit.h, hit.z, 0, 0, -1, E); out[0] = 0.08 * (E[0] + 0.03); out[1] = 0.08 * (E[1] + 0.03); out[2] = 0.09 * (E[2] + 0.03); }
        else {
          const pc = q.panel, I = 0.55 + 0.25 * v + 0.1 * N(u * 4, v * 4, 7);
          out[0] = pc[0] * I * 0.6; out[1] = pc[1] * I * 0.6; out[2] = pc[2] * I * 0.6;
          bladeNeon(q, u, v, out);
        }
        hit.id = 3;
      } else {
        const q = qBest, s = 7 - q.side * hit.x;
        const st = q.stripe ? (Math.floor((hit.z - q.z0) / 0.45) & 1) : 0;
        const a = st ? [0.42, 0.40, 0.36] : q.col;
        // underside lit warmly by the shop windows below
        irr(hit.x, hit.h - 0.05, hit.z, 0, -1, 0, E);
        const fold = 0.85 + 0.15 * Math.sin((hit.z - q.z0) * 14);
        out[0] = a[0] * (E[0] * 1.3 + 0.03) * fold; out[1] = a[1] * (E[1] * 1.3 + 0.03) * fold; out[2] = a[2] * (E[2] * 1.3 + 0.03) * fold;
        if (s > q.out - 0.12) { const vb = 0.7; out[0] *= vb; out[1] *= vb; out[2] *= vb; }
        hit.id = 3;
      }
      fog(out, tBest);
      return 1;
    }

    // ---------------------------------------------------------------- render primary + mirror
    const n = W * H;
    const Ld = P8.img(W, H), Lm = P8.img(W, H);
    const Fw = new Float32Array(n), Pud = new Float32Array(n), Rail = new Float32Array(n), Zd = new Float32Array(n), Gx = new Float32Array(n);
    const ID = new Uint8Array(n);
    const out = [0, 0, 0], mout = [0, 0, 0];
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        const dx = (x + 0.5 - xv) / f, dy = -(y + 0.5 - yh) / f, dz = 1;
        const r = trace(cx, cy, 0, dx, dy, dz, true, out);
        if (r === 2) {
          const gx = hit.x, gz = hit.z, gt = hit.t, gid = hit.id, gh = hit.h;
          const curbFace = gid === 5 && Math.abs(gx) <= CURB + 0.001 && gh < SWH - 0.001;
          ground(gx, gz, gid === 5, gt);
          let ar = G.alb[0], ag = G.alb[1], ab = G.alb[2];
          if (curbFace) { ar = ag = ab = 0.13; G.wet = 0.3; G.puddle = 0; }
          if (curbFace) irr(gx, gh, gz, gx < 0 ? 1 : -1, 0, 0, E); else irr(gx, gh, gz, 0, 1, 0, E);
          // Fresnel (water)
          const len = Math.sqrt(dx * dx + dy * dy + 1);
          const cosI = curbFace ? 0.5 : Math.abs(dy) / len;
          const F = 0.02 + 0.98 * Math.pow(1 - cosI, 5);
          const wetF = G.puddle > 0 ? F * (G.wet * (1 - G.puddle) + G.puddle) : F * G.wet;
          const dimW = 1 - 0.35 * G.wet - 0.4 * G.puddle;
          out[0] = ar * dimW * (E[0] + 0.02) * (1 - wetF);
          out[1] = ag * dimW * (E[1] + 0.02) * (1 - wetF);
          out[2] = ab * dimW * (E[2] + 0.024) * (1 - wetF);
          fog(out, gt);
          // mirror ray
          if (!curbFace) {
            trace(gx, gh, gz, dx, -dy, dz, false, mout);
            const T = Math.exp(-gt / FOGD);
            Lm.r[i] = mout[0] * T + fogCol[0] * (1 - T); Lm.g[i] = mout[1] * T + fogCol[1] * (1 - T); Lm.b[i] = mout[2] * T + fogCol[2] * (1 - T);
          }
          Fw[i] = curbFace ? 0 : wetF * Math.exp(-gt / FOGD); Pud[i] = G.puddle; Rail[i] = G.rail; Zd[i] = gz; Gx[i] = gx;
          ID[i] = curbFace ? 6 : gid;
        } else { ID[i] = hit.id; Zd[i] = hit.z; }
        Ld.r[i] = out[0]; Ld.g[i] = out[1]; Ld.b[i] = out[2];
      }
    }

    // ---------------------------------------------------------------- billboards via Canvas2D (direct + mirror)
    function mkCanvas() { const c = document.createElement('canvas'); c.width = W; c.height = H; return c; }
    const cvD = mkCanvas(), cvM = mkCanvas();
    const ctxD = cvD.getContext('2d'), ctxM = cvM.getContext('2d');
    const tmpC = mkCanvas(), tctx = tmpC.getContext('2d');
    function fogHex(z) { const T = Math.exp(-z / FOGD); return 1 - T; }
    function rgbs(c, a) { return 'rgba(' + Math.round(255 * P8.lin2s(c[0])) + ',' + Math.round(255 * P8.lin2s(c[1])) + ',' + Math.round(255 * P8.lin2s(c[2])) + ',' + (a === undefined ? 1 : a) + ')'; }
    // draw a sprite function fn(ctx, mirror) at depth z (billboard transform), apply fog, composite into both canvases
    function sprite(z, fn, screenSpace) {
      [false, true].forEach(function (mir) {
        tctx.setTransform(1, 0, 0, 1, 0, 0); tctx.clearRect(0, 0, W, H);
        const s = f / z;
        if (!screenSpace) tctx.setTransform(s, 0, 0, mir ? s : -s, xv - s * cx, yh + s * cy);
        fn(tctx, mir, s);
        tctx.setTransform(1, 0, 0, 1, 0, 0);
        const fa = fogHex(z);
        if (fa > 0.01) { tctx.globalCompositeOperation = 'source-atop'; tctx.fillStyle = rgbs(fogCol, fa); tctx.fillRect(0, 0, W, H); tctx.globalCompositeOperation = 'source-over'; }
        (mir ? ctxM : ctxD).drawImage(tmpC, 0, 0);
      });
    }
    const extraSprites = [];
    const emit = []; // HDR emitters {x,h,z,r,c,I,glare}
    function em(x, h, z, r, c, I, glare) { emit.push({ x: x, h: h, z: z, r: r, c: c, I: I, glare: glare || 0 }); }
    function poly(ctx, pts) { ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]); ctx.closePath(); }

    // wires (screen space, perspective)
    function wires(ctx, mir) {
      const P = mir ? projM : proj;
      ctx.lineCap = 'round';
      [-1.6, 1.6].forEach(function (wx) {
        for (let z = 6; z < 300; z *= 1.08) {
          const z2 = z * 1.08;
          const a = P(wx, 5.9, z), b = P(wx, 5.9, z2);
          ctx.strokeStyle = rgbs([0.03, 0.03, 0.035], 0.95 - fogHex(z) * 0.8);
          ctx.lineWidth = Math.max(0.8 * S, f * 0.016 / z);
          ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
        }
      });
      for (let z = 20; z < 200; z += 24) {
        ctx.strokeStyle = rgbs([0.035, 0.032, 0.035], 0.9 - fogHex(z) * 0.8);
        ctx.lineWidth = Math.max(0.7 * S, f * 0.012 / z);
        ctx.beginPath();
        for (let k = 0; k <= 24; k++) {
          const xx = -7 + 14 * k / 24, sag = 0.35 * (1 - Math.pow((xx / 7), 2));
          const p = P(xx, 6.4 - sag, z);
          if (k === 0) ctx.moveTo(p[0], p[1]); else ctx.lineTo(p[0], p[1]);
        }
        ctx.stroke();
      }
    }

    function lampR(z) {
      return function (ctx, mir) {
        ctx.fillStyle = rgbs([0.025, 0.025, 0.028]);
        ctx.fillRect(6.25, 0.15, 0.14, 7.5);
        ctx.strokeStyle = rgbs([0.025, 0.025, 0.028]); ctx.lineWidth = 0.09;
        ctx.beginPath(); ctx.moveTo(6.3, 7.45); ctx.quadraticCurveTo(6.0, 7.9, 4.9, 7.72); ctx.stroke();
        ctx.fillStyle = rgbs([0.05, 0.045, 0.04]); poly(ctx, [[4.55, 7.68], [5.25, 7.72], [5.15, 7.56], [4.65, 7.54]]); ctx.fill();
      };
    }
    lampsR.forEach(function (z) { em(4.9, 7.52, z, 0.2, SODIUM, 26, 1); });
    function lampL(z) {
      return function (ctx) {
        ctx.strokeStyle = rgbs([0.03, 0.03, 0.03]); ctx.lineWidth = 0.07;
        ctx.beginPath(); ctx.moveTo(-7, 5.95); ctx.lineTo(-6.1, 5.95); ctx.stroke();
        ctx.fillStyle = rgbs([0.04, 0.04, 0.045]); poly(ctx, [[-6.35, 5.98], [-5.85, 5.98], [-5.95, 5.68], [-6.25, 5.68]]); ctx.fill();
      };
    }
    lampsL.forEach(function (z) { em(-6.1, 5.62, z, 0.16, LED, 18, 1); });

    function signal(ctx) {
      const x = SIG.x;
      ctx.fillStyle = rgbs([0.02, 0.02, 0.022]);
      ctx.fillRect(x - 0.05, 0.15, 0.1, 3.4);
      poly(ctx, [[x - 0.17, 2.3], [x + 0.17, 2.3], [x + 0.17, 3.3], [x - 0.17, 3.3]]); ctx.fill();
      ctx.fillStyle = rgbs([0.12, 0.01, 0.01]); ctx.beginPath(); ctx.arc(x, 3.1, 0.085, 0, 7); ctx.fill();
      ctx.fillStyle = rgbs([0.10, 0.06, 0.01]); ctx.beginPath(); ctx.arc(x, 2.8, 0.085, 0, 7); ctx.fill();
      // hood edges catching light
      ctx.strokeStyle = rgbs([0.12, 0.14, 0.13]); ctx.lineWidth = 0.02; ctx.beginPath(); ctx.moveTo(x - 0.17, 3.3); ctx.lineTo(x + 0.17, 3.3); ctx.stroke();
    }
    em(SIG.x, 2.5, SIG.z, 0.085, [0.2, 1.0, 0.7], 22, 1);

    function tram(ctx) {
      const x = TRAM.x;
      ctx.fillStyle = rgbs([0.16, 0.12, 0.08]);
      ctx.beginPath(); ctx.moveTo(x - 1.2, 0.3); ctx.lineTo(x + 1.2, 0.3); ctx.lineTo(x + 1.2, 3.0); ctx.quadraticCurveTo(x + 1.15, 3.45, x, 3.5); ctx.quadraticCurveTo(x - 1.15, 3.45, x - 1.2, 3.0); ctx.closePath(); ctx.fill();
      ctx.fillStyle = rgbs([0.9, 0.7, 0.45]); poly(ctx, [[x - 1.05, 1.3], [x + 1.05, 1.3], [x + 1.0, 2.6], [x - 1.0, 2.6]]); ctx.fill();
      ctx.fillStyle = rgbs([0.95, 0.6, 0.15]); ctx.fillRect(x - 0.6, 2.75, 1.2, 0.35);
      ctx.fillStyle = rgbs([0.02, 0.02, 0.02]); ctx.fillRect(x - 1.25, 0.15, 2.5, 0.25);
      ctx.strokeStyle = rgbs([0.04, 0.04, 0.04]); ctx.lineWidth = 0.08;
      ctx.beginPath(); ctx.moveTo(x - 0.4, 3.5); ctx.lineTo(x + 0.2, 4.6); ctx.lineTo(x - 0.1, 5.9); ctx.stroke();
    }
    em(TRAM.x - 0.85, 0.9, TRAM.z, 0.13, [1.0, 0.93, 0.8], 70, 1);
    em(TRAM.x + 0.85, 0.9, TRAM.z, 0.13, [1.0, 0.93, 0.8], 70, 1);

    function car(ctx) {
      const x = CAR.x;
      ctx.fillStyle = rgbs([0.022, 0.022, 0.026]);
      ctx.beginPath(); ctx.moveTo(x - 0.92, 0.2); ctx.lineTo(x + 0.92, 0.2); ctx.lineTo(x + 0.9, 0.85); ctx.lineTo(x + 0.7, 1.0); ctx.lineTo(x + 0.55, 1.42); ctx.lineTo(x - 0.55, 1.42); ctx.lineTo(x - 0.7, 1.0); ctx.lineTo(x - 0.9, 0.85); ctx.closePath(); ctx.fill();
      ctx.fillStyle = rgbs([0.05, 0.06, 0.08]); poly(ctx, [[x - 0.62, 1.02], [x + 0.62, 1.02], [x + 0.5, 1.36], [x - 0.5, 1.36]]); ctx.fill();
      ctx.fillStyle = rgbs([0.01, 0.01, 0.01]); ctx.fillRect(x - 0.95, 0.0, 0.3, 0.38); ctx.fillRect(x + 0.65, 0.0, 0.3, 0.38);
      ctx.fillStyle = rgbs([0.8, 0.62, 0.3]); ctx.fillRect(x - 0.28, 1.43, 0.56, 0.16);
    }
    em(CAR.x - 0.62, 0.66, CAR.z, 0.11, [1.0, 0.95, 0.85], 140, 2.2);
    em(CAR.x + 0.62, 0.66, CAR.z, 0.11, [1.0, 0.95, 0.85], 140, 2.2);

    // near tram on the right track, moving away: left side in perspective + rear face
    function tramNear(ctx, mir) {
      const P = mir ? projM : proj;
      const x0 = TR.x0, x1 = TR.x1, z0 = TR.z0, z1 = TR.z1;
      const rt = P8.rng(seed + 77);
      function quad(xa, ha, za, xb, hb, zb, col, a) {
        const p = [P(xa, ha, za), P(xa, ha, zb), P(xa, hb, zb), P(xa, hb, za)];
        ctx.fillStyle = rgbs(col, a); poly(ctx, p); ctx.fill();
      }
      function gquad(ha, hb, za, zb, c0, c1) { // vertical gradient on the side plane
        const p = [P(x0, ha, za), P(x0, ha, zb), P(x0, hb, zb), P(x0, hb, za)];
        const g = ctx.createLinearGradient(0, p[0][1], 0, p[3][1]);
        g.addColorStop(0, rgbs(c0)); g.addColorStop(1, rgbs(c1));
        ctx.fillStyle = g; poly(ctx, p); ctx.fill();
      }
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = 'rgba(0,0,0,0.85)'; poly(ctx, [P(x0 - 0.05, 0.0, z0), P(x1, 0.0, z0), P(x1, 0.0, z1), P(x0 - 0.05, 0.0, z1)]); ctx.fill();
      gquad(0.38, 1.02, z0, z1, [0.012, 0.002, 0.002], [0.05, 0.008, 0.007]);
      gquad(1.02, 1.16, z0, z1, [0.05, 0.043, 0.034], [0.08, 0.07, 0.055]);
      quad(x0, 1.16, z0, x0, 2.56, z1, [0.03, 0.028, 0.026]);
      gquad(2.56, 3.12, z0, z1, [0.07, 0.06, 0.046], [0.035, 0.03, 0.025]);
      quad(x0, 3.12, z0, x0, 3.36, z1, [0.02, 0.02, 0.022]);
      quad(x0, 1.11, z0, x0, 1.13, z1, [0.3, 0.26, 0.2]);
      quad(x0, 0.95, z0, x0, 0.97, z1, [0.12, 0.05, 0.04]);
      quad(x0, 0.38, z0, x0, 0.47, z1, [0.006, 0.003, 0.003]);
      // long reflections of street lamps along the wet body
      for (let q = 0; q < 5; q++) { const zz = z0 + 3 + q * 5.5; quad(x0, 0.55, zz, x0, 0.62, zz + 1.6, [0.28, 0.12, 0.07], 0.8); quad(x0, 2.75, zz + 1, x0, 2.8, zz + 2.4, [0.3, 0.22, 0.15], 0.7); }
      let zc = z0 + 0.9, k = 0;
      while (zc < z1 - 1.2) {
        const door = (k % 4 === 1);
        const len = door ? 1.3 : 1.55;
        const ha = door ? 0.55 : 1.2, hb = 2.5;
        const I = 0.75 + 0.2 * rt();
        gquad(ha, hb, zc, zc + len, [0.42 * I, 0.3 * I, 0.17 * I], [0.95 * I, 0.8 * I, 0.56 * I]);
        quad(x0, hb - 0.1, zc, x0, hb - 0.03, zc + len, [1, 0.95, 0.82]);
        quad(x0, 2.05, zc, x0, 2.08, zc + len, [0.2, 0.17, 0.12], 0.8); // handrail
        if (!door) quad(x0, 1.2, zc, x0, 1.42, zc + len, [0.16, 0.1, 0.06], 0.75); // seat backs
        const np = (rt() * 2.8) | 0;
        for (let j = 0; j < np; j++) {
          const pz = zc + 0.25 + rt() * (len - 0.5), ph = door ? 1.52 + rt() * 0.18 : 1.43 + rt() * 0.1;
          const c = P(x0, ph, pz), sc = f / pz;
          ctx.fillStyle = rgbs([0.03, 0.02, 0.018], 0.95);
          ctx.beginPath(); ctx.ellipse(c[0], c[1], 0.075 * sc * 0.55, 0.1 * sc, 0, 0, 7); ctx.fill();
          const sh = P(x0, ph - 0.3, pz);
          ctx.beginPath(); ctx.ellipse(sh[0], sh[1], 0.21 * sc * 0.5, 0.22 * sc, 0, 0, 7); ctx.fill();
        }
        // vertical grab pole
        const gp1 = P(x0, 1.2, zc + len * 0.5), gp2 = P(x0, 2.45, zc + len * 0.5);
        ctx.strokeStyle = rgbs([0.5, 0.4, 0.25], 0.6); ctx.lineWidth = Math.max(0.8, f * 0.03 / (zc + len * 0.5));
        ctx.beginPath(); ctx.moveTo(gp1[0], gp1[1]); ctx.lineTo(gp2[0], gp2[1]); ctx.stroke();
        zc += len; quad(x0, 1.16, zc, x0, 2.56, zc + 0.22, [0.025, 0.022, 0.02]); zc += 0.22; k++;
      }
      // window glass sheen (reflection band of the opposite shops)
      quad(x0, 1.9, z0, x0, 2.15, z1, [0.6, 0.55, 0.5], 0.08);
      ctx.fillStyle = rgbs([0.015, 0.015, 0.018]);
      poly(ctx, [P(x0 + 0.3, 3.36, z0 + 4), P(x0 + 0.3, 3.36, z0 + 11), P(x0 + 0.3, 3.7, z0 + 11), P(x0 + 0.3, 3.7, z0 + 4.5)]); ctx.fill();
      ctx.strokeStyle = rgbs([0.02, 0.02, 0.025]); ctx.lineWidth = Math.max(1, f * 0.05 / (z0 + 14));
      const pa = P(1.6, 3.7, z0 + 13), pb = P(1.6, 4.9, z0 + 14.5), pc = P(1.6, 5.9, z0 + 13.2);
      ctx.beginPath(); ctx.moveTo(pa[0], pa[1]); ctx.lineTo(pb[0], pb[1]); ctx.lineTo(pc[0], pc[1]); ctx.stroke();
      ctx.restore();
      // rear face (billboard at z0)
      const g = ctx.createLinearGradient(0, 0.4, 0, 3.3);
      g.addColorStop(0, rgbs([0.012, 0.002, 0.002])); g.addColorStop(0.22, rgbs([0.045, 0.007, 0.006])); g.addColorStop(0.26, rgbs([0.07, 0.06, 0.045])); g.addColorStop(1, rgbs([0.045, 0.04, 0.032]));
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(x0, 0.38); ctx.lineTo(x1, 0.38); ctx.lineTo(x1, 3.0); ctx.quadraticCurveTo(x1 - 0.05, 3.36, x1 - 0.5, 3.38); ctx.lineTo(x0 + 0.5, 3.38); ctx.quadraticCurveTo(x0 + 0.05, 3.36, x0, 3.0); ctx.closePath(); ctx.fill();
      // rear windscreen: interior perspective down the aisle
      const wx0 = x0 + 0.2, wx1 = x1 - 0.2, wh0 = 1.22, wh1 = 2.62;
      const wg = ctx.createLinearGradient(0, wh0, 0, wh1);
      wg.addColorStop(0, rgbs([0.3, 0.21, 0.12])); wg.addColorStop(0.6, rgbs([0.7, 0.56, 0.36])); wg.addColorStop(1, rgbs([0.86, 0.72, 0.5]));
      ctx.fillStyle = wg; poly(ctx, [[wx0, wh0], [wx1, wh0], [wx1 - 0.04, wh1], [wx0 + 0.04, wh1]]); ctx.fill();
      const cxm = (x0 + x1) / 2;
      ctx.fillStyle = rgbs([0.95, 0.88, 0.7]); poly(ctx, [[wx0 + 0.15, wh1 - 0.05], [wx1 - 0.15, wh1 - 0.05], [cxm + 0.12, 2.15], [cxm - 0.12, 2.15]]); ctx.fill(); // ceiling light lines converging
      ctx.fillStyle = rgbs([0.5, 0.36, 0.2]); poly(ctx, [[cxm - 0.35, wh0], [cxm + 0.35, wh0], [cxm + 0.12, 1.75], [cxm - 0.12, 1.75]]); ctx.fill(); // aisle floor
      ctx.fillStyle = rgbs([0.1, 0.06, 0.035]);
      poly(ctx, [[wx0, wh0], [cxm - 0.38, wh0], [cxm - 0.14, 1.72], [wx0 + 0.25, 1.72]]); ctx.fill(); // seats left
      poly(ctx, [[cxm + 0.38, wh0], [wx1, wh0], [wx1 - 0.25, 1.72], [cxm + 0.14, 1.72]]); ctx.fill(); // seats right
      ctx.fillStyle = rgbs([0.02, 0.015, 0.012]);
      ctx.beginPath(); ctx.ellipse(cxm - 0.42, 1.98, 0.09, 0.115, 0, 0, 7); ctx.fill();
      poly(ctx, [[cxm - 0.62, wh0], [cxm - 0.22, wh0], [cxm - 0.27, 1.84], [cxm - 0.57, 1.84]]); ctx.fill();
      ctx.beginPath(); ctx.ellipse(cxm + 0.2, 1.85, 0.05, 0.065, 0, 0, 7); ctx.fill();
      ctx.strokeStyle = rgbs([0.05, 0.04, 0.03]); ctx.lineWidth = 0.035; ctx.beginPath(); ctx.moveTo(cxm, wh0); ctx.lineTo(cxm, wh1); ctx.stroke(); // centre pillar
      ctx.strokeStyle = rgbs([0.02, 0.02, 0.02]); ctx.lineWidth = 0.02; ctx.beginPath(); ctx.moveTo(wx0 + 0.1, wh0 + 0.05); ctx.lineTo(wx0 + 0.6, wh0 + 0.55); ctx.stroke(); // wiper
      ctx.fillStyle = rgbs([0.55, 0.32, 0.08]); ctx.fillRect(x0 + 0.55, 2.78, x1 - x0 - 1.1, 0.3);
      ctx.fillStyle = rgbs([0.85, 0.55, 0.15], 0.6); ctx.fillRect(x0 + 0.62, 2.88, x1 - x0 - 1.24, 0.1);
      ctx.fillStyle = rgbs([0.006, 0.004, 0.004]); ctx.fillRect(x0 - 0.02, 0.25, x1 - x0 + 0.04, 0.2);
      ctx.fillStyle = rgbs([0.25, 0.22, 0.18], 0.7); ctx.fillRect(x0, 0.44, x1 - x0, 0.02);
      ctx.fillStyle = rgbs([0.35, 0.02, 0.015]); ctx.fillRect(x0 + 0.1, 0.6, 0.32, 0.24); ctx.fillRect(x1 - 0.42, 0.6, 0.32, 0.24);
      ctx.fillStyle = rgbs([0.5, 0.35, 0.1]); ctx.fillRect(x0 + 0.1, 0.86, 0.32, 0.06); ctx.fillRect(x1 - 0.42, 0.86, 0.32, 0.06);
      ctx.fillStyle = rgbs([0.25, 0.22, 0.18], 0.7); ctx.fillRect(x0, 1.03, x1 - x0, 0.025);
    }
    em(TR.x0 + 0.26, 0.72, TR.z0 - 0.05, 0.1, [1.0, 0.06, 0.03], 10, 1);
    em(TR.x1 - 0.26, 0.72, TR.z0 - 0.05, 0.1, [1.0, 0.06, 0.03], 10, 1);
    em(CAR.x, 1.52, CAR.z + 1.2, 0.12, [1.0, 0.82, 0.45], 3, 0.5);

    // the figure: a woman in a long coat with a translucent crimson umbrella, walking right across the crossing
    const FIG = { x: -2.25, z: 6.7 };
    function figure(ctx, mir) {
      ctx.save(); ctx.translate(FIG.x, 0);
      const dark = rgbs([0.004, 0.0035, 0.004]), coat = rgbs([0.009, 0.0075, 0.0075]), coatL = rgbs([0.03, 0.022, 0.018]);
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      function lim(pts, w, col) { ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]); ctx.stroke(); }
      // back leg (heel raised), front leg
      lim([[-0.04, 0.9], [-0.1, 0.49], [-0.25, 0.13]], 0.12, dark);
      lim([[0.05, 0.9], [0.14, 0.5], [0.2, 0.09]], 0.125, dark);
      ctx.fillStyle = dark;
      poly(ctx, [[-0.36, 0.03], [-0.22, 0.09], [-0.2, 0.17], [-0.3, 0.14]]); ctx.fill();
      poly(ctx, [[0.14, 0.02], [0.33, 0.0], [0.34, 0.06], [0.17, 0.13]]); ctx.fill();
      // swinging back arm
      lim([[-0.06, 1.4], [-0.14, 1.12], [-0.2, 0.92]], 0.085, coat);
      // coat: dark, a touch lighter toward the backlit edge
      { const cg = ctx.createLinearGradient(-0.25, 0, 0.24, 0); cg.addColorStop(0, rgbs([0.012, 0.009, 0.008])); cg.addColorStop(0.6, rgbs([0.007, 0.006, 0.006])); cg.addColorStop(1, rgbs([0.02, 0.017, 0.015])); ctx.fillStyle = cg; }
      ctx.beginPath(); ctx.moveTo(-0.12, 1.47);
      ctx.bezierCurveTo(-0.17, 1.25, -0.16, 1.05, -0.2, 0.86); ctx.lineTo(-0.25, 0.55);
      ctx.quadraticCurveTo(-0.02, 0.6, 0.23, 0.6); ctx.lineTo(0.17, 0.92);
      ctx.bezierCurveTo(0.15, 1.05, 0.15, 1.2, 0.14, 1.33); ctx.quadraticCurveTo(0.12, 1.47, 0.0, 1.5); ctx.closePath(); ctx.fill();
      // coat folds / belt, faintly lit
      ctx.filter = 'blur(' + (0.8 * S).toFixed(2) + 'px)';
      ctx.strokeStyle = coatL; ctx.lineWidth = 0.014;
      ctx.beginPath(); ctx.moveTo(-0.17, 1.02); ctx.lineTo(0.16, 1.03); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0.02, 1.0); ctx.quadraticCurveTo(0.0, 0.8, 0.05, 0.6); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-0.12, 0.98); ctx.quadraticCurveTo(-0.15, 0.78, -0.2, 0.58); ctx.stroke();
      ctx.filter = 'none';
      // scarf (muted ochre, lit by the shop windows)
      { const sg = ctx.createLinearGradient(-0.1, 0, 0.1, 0); sg.addColorStop(0, rgbs([0.14, 0.08, 0.03])); sg.addColorStop(1, rgbs([0.04, 0.022, 0.01])); ctx.fillStyle = sg; }
      poly(ctx, [[-0.09, 1.5], [0.1, 1.49], [0.08, 1.42], [-0.08, 1.42]]); ctx.fill();
      poly(ctx, [[-0.08, 1.45], [-0.03, 1.44], [-0.1, 1.2], [-0.15, 1.22]]); ctx.fill();
      // head
      ctx.fillStyle = dark; ctx.beginPath(); ctx.ellipse(0.03, 1.6, 0.085, 0.108, 0.15, 0, 7); ctx.fill();
      ctx.strokeStyle = rgbs([0.2, 0.12, 0.08], 0.6); ctx.lineWidth = 0.012; ctx.beginPath(); ctx.ellipse(0.03, 1.6, 0.08, 0.104, 0.15, Math.PI * 0.55, Math.PI * 1.25); ctx.stroke();
      // umbrella arm and shaft
      lim([[0.02, 1.43], [0.09, 1.2], [0.15, 1.31]], 0.085, coat);
      ctx.strokeStyle = rgbs([0.03, 0.025, 0.02]); ctx.lineWidth = 0.02;
      ctx.beginPath(); ctx.moveTo(0.15, 1.28); ctx.lineTo(0.09, 2.08); ctx.stroke();
      ctx.fillStyle = rgbs([0.04, 0.03, 0.025]); ctx.beginPath(); ctx.ellipse(0.15, 1.3, 0.035, 0.03, 0, 0, 7); ctx.fill();
      // canopy, tilted into the walk, translucent crimson glowing where the headlights shine through
      ctx.save(); ctx.translate(0.09, 1.97); ctx.rotate(mir ? 0.1 : -0.1);
      const g = ctx.createRadialGradient(-0.12, 0.02, 0.03, 0, 0.05, 0.62);
      g.addColorStop(0, rgbs([0.5, 0.04, 0.05])); g.addColorStop(0.45, rgbs([0.2, 0.014, 0.02])); g.addColorStop(1, rgbs([0.04, 0.004, 0.008]));
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(-0.57, -0.07);
      ctx.bezierCurveTo(-0.47, 0.2, -0.22, 0.26, 0.0, 0.26); ctx.bezierCurveTo(0.22, 0.26, 0.47, 0.2, 0.57, -0.07);
      for (let kk = 0; kk < 7; kk++) { const xa = 0.57 - (kk + 1) * (1.14 / 7), xm = xa + 1.14 / 14; ctx.quadraticCurveTo(xm, -0.025, xa, -0.08); }
      ctx.closePath(); ctx.fill();
      for (let kk = 0; kk < 7; kk++) { // alternate panel shading
        const xa = -0.57 + kk * 1.14 / 7, xb = xa + 1.14 / 7;
        ctx.fillStyle = kk % 2 ? 'rgba(0,0,0,0.18)' : 'rgba(255,120,120,0.04)';
        ctx.beginPath(); ctx.moveTo(0, 0.26); ctx.quadraticCurveTo(xa * 0.78, 0.21, xa, -0.075); ctx.lineTo(xb, -0.075); ctx.quadraticCurveTo(xb * 0.78, 0.21, 0, 0.26); ctx.fill();
      }
      ctx.strokeStyle = rgbs([0.03, 0.003, 0.006], 0.6); ctx.lineWidth = 0.009;
      for (let kk = 0; kk <= 7; kk++) { const xa = -0.57 + kk * 1.14 / 7; ctx.beginPath(); ctx.moveTo(0, 0.26); ctx.quadraticCurveTo(xa * 0.78, 0.21, xa, -0.075); ctx.stroke(); }
      ctx.strokeStyle = rgbs([0.9, 0.55, 0.5], mir ? 0.3 : 0.75); ctx.lineWidth = 0.016;
      ctx.beginPath(); ctx.moveTo(-0.52, 0.02); ctx.bezierCurveTo(-0.42, 0.2, -0.2, 0.255, 0.04, 0.255); ctx.stroke();
      ctx.strokeStyle = rgbs([0.5, 0.3, 0.3], 0.5); ctx.lineWidth = 0.01;
      ctx.beginPath(); ctx.moveTo(0.1, 0.25); ctx.bezierCurveTo(0.3, 0.22, 0.46, 0.15, 0.54, -0.02); ctx.stroke();
      ctx.strokeStyle = rgbs([0.05, 0.04, 0.04]); ctx.lineWidth = 0.02; ctx.beginPath(); ctx.moveTo(0, 0.26); ctx.lineTo(0, 0.32); ctx.stroke();
      // drops falling from the rim
      ctx.strokeStyle = rgbs([0.7, 0.6, 0.6], 0.55); ctx.lineWidth = 0.006;
      for (let kk = 0; kk < 7; kk++) { const xa = -0.57 + (kk + 0.5) * 1.14 / 7 + 0.03; ctx.beginPath(); ctx.moveTo(xa, -0.1 - (kk % 3) * 0.08); ctx.lineTo(xa - 0.004, -0.16 - (kk % 3) * 0.08); ctx.stroke(); }
      ctx.restore();
      // backlight rim on the coat (headlights behind) + warm rim from the shops on the left (soft)
      ctx.filter = 'blur(' + (1.6 * S).toFixed(2) + 'px)';
      ctx.strokeStyle = rgbs([0.9, 0.8, 0.65], mir ? 0.15 : 0.4); ctx.lineWidth = 0.016;
      ctx.beginPath(); ctx.moveTo(0.14, 1.33); ctx.bezierCurveTo(0.15, 1.2, 0.15, 1.05, 0.17, 0.92); ctx.lineTo(0.23, 0.6); ctx.stroke();
      ctx.strokeStyle = rgbs([0.6, 0.38, 0.18], mir ? 0.1 : 0.2); ctx.lineWidth = 0.02;
      ctx.beginPath(); ctx.moveTo(-0.12, 1.47); ctx.bezierCurveTo(-0.17, 1.25, -0.16, 1.05, -0.2, 0.86); ctx.lineTo(-0.25, 0.56); ctx.stroke();
      ctx.lineWidth = 0.012; ctx.beginPath(); ctx.moveTo(-0.08, 0.88); ctx.lineTo(-0.13, 0.49); ctx.lineTo(-0.27, 0.15); ctx.stroke();
      ctx.filter = 'none';
      ctx.restore();
    }

    // draw order: far to near; the figure is composited after the emitters so it occludes their glare
    sprite(1, function (ctx, mir) { wires(ctx, mir); }, true);
    const far = [];
    lampsR.forEach(function (z) { far.push([z, lampR(z)]); });
    lampsL.forEach(function (z) { far.push([z, lampL(z)]); });
    far.push([TRAM.z, tram], [CAR.z, car], [TR.z0, tramNear], [SIG.z, signal]);
    extraSprites.forEach(function (e) { far.push(e); });
    far.sort(function (a, b) { return b[0] - a[0]; });
    far.forEach(function (e) { sprite(e[0], e[1]); });

    function compositeCanvas(cv, dst, onlyGround) {
      const d = cv.getContext('2d').getImageData(0, 0, W, H).data;
      const lut = new Float32Array(256); for (let i = 0; i < 256; i++) lut[i] = P8.s2lin(i / 255);
      for (let i = 0; i < n; i++) {
        const a = d[i * 4 + 3] / 255; if (a === 0) continue;
        if (onlyGround && !(ID[i] === 4 || ID[i] === 5)) continue;
        dst.r[i] = dst.r[i] * (1 - a) + lut[d[i * 4]] * a;
        dst.g[i] = dst.g[i] * (1 - a) + lut[d[i * 4 + 1]] * a;
        dst.b[i] = dst.b[i] * (1 - a) + lut[d[i * 4 + 2]] * a;
        if (!onlyGround && a > 0.5) ID[i] = 7;
      }
    }
    compositeCanvas(cvD, Ld, false);
    compositeCanvas(cvM, Lm, true);
    // HDR emitters (direct and mirrored)
    function splat(dst, sx, sy, rad, c, I, glare, onlyGround) {
      const R0 = Math.max(rad, 0.7 * S), gR = R0 * (6 + 10 * glare);
      const x0 = Math.max(0, Math.floor(sx - gR)), x1 = Math.min(W - 1, Math.ceil(sx + gR));
      const y0 = Math.max(0, Math.floor(sy - gR)), y1 = Math.min(H - 1, Math.ceil(sy + gR));
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const i = y * W + x;
        if (onlyGround && !(ID[i] === 4 || ID[i] === 5)) continue;
        const dx = x + 0.5 - sx, dy = y + 0.5 - sy, d2 = (dx * dx + dy * dy) / (R0 * R0);
        const dn = Math.sqrt(dx * dx + dy * dy) / gR; if (dn >= 1) continue; const wnd = (1 - dn) * (1 - dn);
        let e = I * Math.exp(-d2 * 1.2) + I * 0.006 * glare / (1 + d2 * 0.08) * wnd;
        dst.r[i] += e * c[0]; dst.g[i] += e * c[1]; dst.b[i] += e * c[2];
      }
    }
    emit.forEach(function (e) {
      const T = Math.exp(-e.z / FOGD);
      const a = proj(e.x, e.h, e.z), am = projM(e.x, e.h, e.z), r = f * e.r / e.z;
      splat(Ld, a[0], a[1], r, e.c, e.I * T, e.glare, false);
      splat(Lm, am[0], am[1], r, e.c, e.I * T, e.glare, true);
    });

    // near sprites (the figure) over the glare
    ctxD.clearRect(0, 0, W, H); ctxM.clearRect(0, 0, W, H);
    sprite(FIG.z, figure);
    const figMask = new Float32Array(n);
    { const d = ctxD.getImageData(0, 0, W, H).data; for (let i = 0; i < n; i++) figMask[i] = d[i * 4 + 3] / 255; }
    compositeCanvas(cvD, Ld, false);
    compositeCanvas(cvM, Lm, true);

    // ---------------------------------------------------------------- reflections: rough (streaked, vertically smeared) vs puddle (sharp, rippled)
    const LmS = P8.copyImg(Lm);
    const LmA = P8.blurImg(P8.copyImg(Lm), 2.5 * S, 22 * S);
    const LmB = P8.blurImg(P8.copyImg(Lm), 5 * S, 70 * S);
    // ripples: rings from raindrops in puddles -> vertical offset of the sharp mirror lookup
    const rip = new Float32Array(n);
    const rr = P8.rng(seed + 5);
    for (let k = 0; k < 2600; k++) {
      const gx = -6 + rr() * 12, gz = 2 + Math.pow(rr(), 1.6) * 40;
      const rad = 0.05 + rr() * 0.22, ph = rr() * 6.28;
      const c = proj(gx, 0, gz); if (c[1] < yh || c[1] > H + 40) continue;
      const sx = f * rad / gz * 1.6, sy = sx * 1.6 / gz * 1.0 + 0.5 * S;
      const x0 = Math.max(0, Math.floor(c[0] - sx - 2)), x1 = Math.min(W - 1, Math.ceil(c[0] + sx + 2));
      const y0 = Math.max(0, Math.floor(c[1] - sy - 2)), y1 = Math.min(H - 1, Math.ceil(c[1] + sy + 2));
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const dx = (x - c[0]) / sx, dy = (y - c[1]) / sy, d = Math.sqrt(dx * dx + dy * dy);
        if (d > 1.05) continue;
        rip[y * W + x] += Math.sin(d * 18 + ph) * (1 - d) * 3.2 * S;
      }
    }
    // vertical streak modulation of rough reflections
    for (let y = 0; y < H; y++) {
      const t = CL((y - yh) / (H - yh), 0, 1);
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        if (!(ID[i] === 4 || ID[i] === 5)) continue;
        const z = Zd[i], gx = Gx[i];
        const st = 0.55 + 0.75 * Math.max(0, FB(gx * 7.0, z * 0.25, 3, 501)) + 0.25 * N(x / (2.2 * S), y / (60 * S), 502);
        const k = SM(0.0, 0.5, t);
        let rr0 = LmA.r[i] * (1 - k) + LmB.r[i] * k, rg = LmA.g[i] * (1 - k) + LmB.g[i] * k, rb = LmA.b[i] * (1 - k) + LmB.b[i] * k;
        rr0 *= st; rg *= st; rb *= st;
        const p = Pud[i];
        if (p > 0) {
          const oy = CL(Math.round(y + rip[i]), 0, H - 1), j = oy * W + x;
          const sr = LmS.r[j], sg = LmS.g[j], sb = LmS.b[j];
          rr0 = rr0 * (1 - p) + sr * p; rg = rg * (1 - p) + sg * p; rb = rb * (1 - p) + sb * p;
        }
        if (Rail[i] > 0) { const m = 1.1 * (0.5 + 0.5 * SM(-0.2, 0.4, N(Zd[i] * 0.8, 0, 511))); rr0 = LmA.r[i] * m + 0.006; rg = LmA.g[i] * m + 0.006; rb = LmA.b[i] * m + 0.008; }
        const F = Rail[i] > 0 ? 0.6 : Fw[i];
        Ld.r[i] += F * rr0; Ld.g[i] += F * rg; Ld.b[i] += F * rb;
        // near field: wet aggregate glints and raindrop rings catching the light
        if (z < 9) {
          const nearK = SM(9, 3, z);
          const gl = HF(x, y, 777);
          if (gl > 0.994) { const a = nearK * (0.006 + 0.5 * (LmB.r[i] + LmB.g[i] + LmB.b[i])) * (gl - 0.994) * 150; Ld.r[i] += a * 0.9; Ld.g[i] += a * 0.92; Ld.b[i] += a; }
        }
      }
    }

    // ---------------------------------------------------------------- bloom (rain haze)
    const br = P8.img(W, H);
    for (let i = 0; i < n; i++) { br.r[i] = Math.max(0, Ld.r[i] - 0.9); br.g[i] = Math.max(0, Ld.g[i] - 0.9); br.b[i] = Math.max(0, Ld.b[i] - 0.9); }
    const b1 = P8.blurImg(P8.copyImg(br), 6 * S, 6 * S), b2 = P8.blurImg(P8.copyImg(br), 24 * S, 24 * S), b3 = P8.blurImg(br, 80 * S, 80 * S);
    for (let i = 0; i < n; i++) {
      const fm = 1 - 0.7 * figMask[i];
      Ld.r[i] += (0.22 * b1.r[i] + 0.12 * b2.r[i] + 0.07 * b3.r[i]) * fm;
      Ld.g[i] += (0.22 * b1.g[i] + 0.12 * b2.g[i] + 0.07 * b3.g[i]) * fm;
      Ld.b[i] += (0.22 * b1.b[i] + 0.12 * b2.b[i] + 0.07 * b3.b[i]) * fm;
    }

    // ---------------------------------------------------------------- rain: fine slanted streaks, visible where lit (in front of lights / glows)
    {
      const glow = new Float32Array(n);
      for (let i = 0; i < n; i++) glow[i] = 0.3 * (b2.r[i] + b2.g[i] + b2.b[i]) + 0.6 * (b3.r[i] + b3.g[i] + b3.b[i]) + 0.04 * (Ld.r[i] + Ld.g[i] + Ld.b[i]);
      const rr2 = P8.rng(seed + 9);
      const NR = Math.round(34000 * S * S);
      for (let k = 0; k < NR; k++) {
        const x0 = rr2() * W, y0 = rr2() * H;
        const near = Math.pow(rr2(), 3); // a few big near drops
        const L = (9 + 26 * rr2() + 60 * near) * S, ang = 0.13 + 0.05 * (rr2() - 0.5);
        const dx = Math.sin(ang), dy = Math.cos(ang);
        const g0 = glow[(Math.min(H - 1, y0 | 0)) * W + (x0 | 0)];
        if (g0 < 0.03 && rr2() < 0.93) continue;
        const I = Math.min(0.5, 0.05 + 0.25 * g0) * (0.5 + 0.8 * rr2()) * (near > 0.3 ? 0.5 : 1);
        const steps = Math.ceil(L);
        for (let s2 = 0; s2 < steps; s2++) {
          const t = s2 / steps, px = x0 + dx * s2, py = y0 + dy * s2;
          const ix = px | 0, iy = py | 0; if (ix < 0 || iy < 0 || ix >= W - 1 || iy >= H) break;
          const fx = px - ix, a = I * Math.sin(Math.PI * t);
          const i = iy * W + ix;
          const cr = 0.85, cg = 0.88, cb = 1.0;
          Ld.r[i] += a * (1 - fx) * cr; Ld.g[i] += a * (1 - fx) * cg; Ld.b[i] += a * (1 - fx) * cb;
          Ld.r[i + 1] += a * fx * cr; Ld.g[i + 1] += a * fx * cg; Ld.b[i + 1] += a * fx * cb;
        }
      }
    }

    // ---------------------------------------------------------------- tone map to paint reflectance
    const ref = P8.img(W, H), lumHDR = new Float32Array(n);
    const EXP = 1.5;
    for (let i = 0; i < n; i++) {
      let r = Ld.r[i] * EXP, g = Ld.g[i] * EXP, b = Ld.b[i] * EXP;
      lumHDR[i] = 0.3 * r + 0.6 * g + 0.1 * b;
      r = 1 - Math.exp(-r); g = 1 - Math.exp(-g); b = 1 - Math.exp(-b);
      // toe: keep darks deep
      r = r * r / (r + 0.012); g = g * g / (g + 0.012); b = b * b / (b + 0.012);
      ref.r[i] = Math.min(0.97, r); ref.g[i] = Math.min(0.97, g); ref.b[i] = Math.min(0.97, b);
    }
    return { ref: ref, ID: ID, Z: Zd, Fw: Fw, lumHDR: lumHDR, cam: cam, proj: proj, FIG: FIG };
  };
})();
