/* bridge.js: the humpback single-span stone bridge.
   Coursed masonry spandrels, wedge voussoirs, parapet + string course,
   and the barrel soffit that catches the keeper's lantern from below. */
(function () {
  'use strict';
  const LW = window.LW;
  const P = LW.P, L = LW.L, B = L.bridge;
  const VP = L.VP;
  const N = new LW.Noise(501);
  const N2 = new LW.Noise(502);

  const WY = L.waterY + 6; // base of the abutments (hidden just under the water line)
  const fs = B.farScale;
  const nearC = { x: B.cx, y: B.springY, r: B.r };
  const farC = { x: VP[0] + (B.cx - VP[0]) * fs, y: VP[1] + (B.springY - VP[1]) * fs, r: B.r * fs };
  const PAR = 58, STR = 16; // parapet height, string-course height
  const topY = B.topY;

  function arcPts(c, r, a0, a1, step = 0.01) {
    const out = [];
    const n = Math.max(2, Math.ceil(Math.abs(a1 - a0) / step));
    for (let i = 0; i <= n; i++) {
      const a = a0 + ((a1 - a0) * i) / n;
      out.push([c.x + Math.cos(a) * r, c.y + Math.sin(a) * r]);
    }
    return out;
  }

  // ---------------------------------------------------------------- geometry
  const G = (LW.bridgeGeom = {});
  {
    const top = [];
    for (let x = B.x0; x <= B.x1; x += 6) top.push([x, topY(x)]);
    const xr = nearC.x + nearC.r, xl = nearC.x - nearC.r;
    G.face = top.concat([[B.x1, WY], [xr, WY], [xr, nearC.y]], arcPts(nearC, nearC.r, 0, -Math.PI), [[xl, nearC.y], [xl, WY], [B.x0, WY]]);
    G.facePath = LW.polyPath(G.face);
    G.bbox = [B.x0 - 4, B.crownTop - 30, B.x1 + 4, WY + 4];
    G.opening = arcPts(nearC, nearC.r, 0, -Math.PI).concat([[xl, WY], [xr, WY]]);
    // ring (voussoir band) as half annulus
    G.ringOuter = B.r + B.ring;
    // soffit: inside near intrados, outside far intrados (upper half), plus abutment inner faces
    const farWY = VP[1] + (WY - VP[1]) * fs;
    G.farWY = farWY;
    G.soffit = arcPts(nearC, nearC.r, -Math.PI, 0).concat([[xr, WY], [farC.x + farC.r, farWY]], arcPts(farC, farC.r, 0, -Math.PI), [[farC.x - farC.r, farWY], [xl, WY]]);
    G.soffitPath = LW.polyPath(G.soffit);
    G.nearC = nearC; G.farC = farC;
  }

  // a rough-cut stone outline from a quad (tl, tr, br, bl)
  function stoneOutline(q, rng, chip = 3.5) {
    const pts = [];
    for (let i = 0; i < 4; i++) {
      const a = q[i], b = q[(i + 1) % 4];
      const L0 = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const cut = Math.min(L0 * 0.2, chip * (0.6 + rng.next()));
      const n = Math.max(2, Math.round(L0 / 9));
      for (let k = 0; k <= n; k++) {
        let t = k / n;
        // round the corner by insetting the first/last points
        if (k === 0) t = cut / L0;
        if (k === n) t = 1 - cut / L0;
        let x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t;
        const nx = -(b[1] - a[1]) / L0, ny = (b[0] - a[0]) / L0;
        const d = N.n2(x / 11, y / 11) * 1.3 + N2.n2(x / 3.7, y / 3.7) * 0.5;
        pts.push([x + nx * d, y + ny * d]);
      }
    }
    return pts;
  }
  // horizontal extent of a convex-ish polygon at height y
  function spanAt(poly, y) {
    let lo = Infinity, hi = -Infinity;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const a = poly[j], b = poly[i];
      if ((a[1] <= y && b[1] > y) || (b[1] <= y && a[1] > y)) {
        const x = a[0] + ((y - a[1]) * (b[0] - a[0])) / (b[1] - a[1]);
        if (x < lo) lo = x;
        if (x > hi) hi = x;
      }
    }
    return lo < hi ? [lo, hi] : null;
  }
  LW.spanAt = spanAt;

  // value of the bridge face (0 lit .. 1 dark) before firelight
  function faceDark(x, y) {
    let d = 0.42 + 0.1 * N.fbm(x / 300, y / 200, 2);
    d += 0.28 * LW.smooth(2120, 2250, y); // wet, shadowed base
    d -= 0.06 * LW.smooth(2000, 1760, y);
    // under the string course
    const ty = topY(x) + PAR + STR;
    if (y > ty && y < ty + 26) d += 0.3 * (1 - (y - ty) / 26);
    return d;
  }

  // ---------------------------------------------------------------- stones
  function buildStones() {
    const rng = new LW.RNG('bridge-stones');
    const stones = [];
    // spandrel courses
    let y = B.crownTop + PAR + STR;
    const yEnd = WY + 4;
    let row = 0;
    while (y < yEnd) {
      const h = 30 + rng.next() * 16 + (y > 2150 ? 8 : 0);
      const y2 = Math.min(y + h, yEnd);
      let x = B.x0 - rng.next() * 80;
      while (x < B.x1) {
        const w = (row % 3 === 2 ? 50 : 62) + rng.next() * 88 + (y > 2150 ? 30 : 0);
        const x2 = Math.min(x + w, B.x1 + 20);
        const g = 2.2; // mortar gap
        const tilt = (rng.next() - 0.5) * 3;
        const q = [[x + g, y + g + tilt], [x2 - g, y + g - tilt], [x2 - g + (rng.next() - 0.5) * 2, y2 - g], [x + g, y2 - g]];
        const cx = (x + x2) / 2, cy = (y + y2) / 2;
        // keep only stones whose centre lies in the spandrel (below the parapet zone, outside the ring)
        const below = cy > topY(cx) + PAR + STR + 4;
        const dc = Math.hypot(cx - nearC.x, cy - nearC.y);
        const outRing = cy > nearC.y ? (cx < nearC.x - nearC.r - 4 || cx > nearC.x + nearC.r + 4) : dc > G.ringOuter + 6;
        if (below && outRing) stones.push({ q, out: stoneOutline(q, rng), tone: (rng.next() - 0.5) * 0.3, kind: 'wall', cx, cy });
        x = x2;
      }
      y = y2;
      row++;
    }
    // voussoirs
    const nV = 29;
    const vous = [];
    for (let i = 0; i < nV; i++) {
      const a0 = -Math.PI + (Math.PI * i) / nV, a1 = -Math.PI + (Math.PI * (i + 1)) / nV;
      const key = i === (nV - 1) / 2;
      const ext = G.ringOuter + (key ? 24 : i % 2 ? -5 : 7) + rng.next() * 4;
      const r0 = nearC.r + 1;
      const g = 0.006;
      const p = (a, r) => [nearC.x + Math.cos(a) * r, nearC.y + Math.sin(a) * r];
      const aa = a0 + g, bb = a1 - g;
      const q = [p(aa, r0), p(aa, ext), p(bb, ext), p(bb, r0)];
      // curved intrados edge
      const out = [];
      const raw = stoneOutline(q, rng, 3);
      for (const pt of raw) out.push(pt);
      vous.push({ q, out, tone: (rng.next() - 0.5) * 0.25, kind: 'vous', a0: aa, a1: bb, r0, r1: ext, key });
    }
    // parapet: coping + two thin courses, string course
    const par = [];
    const along = (x0, x1, off0, off1, minW, maxW, tag) => {
      let x = x0;
      while (x < x1) {
        const w = minW + rng.next() * (maxW - minW);
        const x2 = Math.min(x + w, x1);
        const g = 2;
        const q = [[x + g, topY(x + g) + off0 + g], [x2 - g, topY(x2 - g) + off0 + g], [x2 - g, topY(x2 - g) + off1 - g], [x + g, topY(x + g) + off1 - g]];
        par.push({ q, out: stoneOutline(q, rng, 2.5), tone: (rng.next() - 0.5) * 0.22, kind: tag, cx: (x + x2) / 2, cy: topY((x + x2) / 2) + (off0 + off1) / 2 });
        x = x2;
      }
    };
    along(B.x0 - 30, B.x1 + 30, 0, 17, 55, 95, 'coping');
    along(B.x0 - 60 + rng.next() * 40, B.x1 + 30, 17, 38, 48, 110, 'par');
    along(B.x0 - 20 - rng.next() * 40, B.x1 + 30, 38, PAR, 48, 110, 'par');
    along(B.x0 - 30, B.x1 + 30, PAR, PAR + STR, 90, 170, 'string');
    return { stones, vous, par };
  }

  // ---------------------------------------------------------------- draw
  LW.drawBridge = function (ctx, S) {
    const t0 = performance.now();
    const { stones, vous, par } = buildStones();
    const all = stones.concat(par, vous);
    const kindW = 'bridge';
    const palF = [P.rock1, P.rock2, P.rock3, P.rock4, LW.mix(P.rock4, P.ink, 0.5)];
    LW.shadeFill(ctx, S, G.facePath, G.bbox, (x, y, out) => {
      const d = faceDark(x, y);
      let c = LW.stepPick(palF, LW.clamp(d, 0, 0.999), x, y, 0.04);
      const wv = LW.warm(x, y, kindW);
      const b = LW.warmBand(wv, x, y);
      if (b > 0) c = LW.warmFill[b];
      // cyan bounce on the wet base
      if (y > L.waterY - 26 && y < WY) {
        const t = LW.smooth(L.waterY - 26, L.waterY - 4, y + N.n2(x / 8, y / 8) * 6);
        if (t > 0.5) c = LW.mix(c, P.water2, 0.5);
      }
      out[0] = c[0]; out[1] = c[1]; out[2] = c[2];
    });
    // soffit fill: underside, dark unless firelit
    const palS = [P.rock3, P.rock4, LW.mix(P.rock4, P.ink, 0.45)];
    LW.shadeFill(ctx, S, G.soffitPath, LW.bbox(G.soffit, 4), (x, y, out) => {
      const d = 0.45 + 0.3 * LW.smooth(2000, 2240, y);
      let c = LW.stepPick(palS, d, x, y, 0.04);
      const b = LW.warmBand(LW.warm(x, y, 'soffit'), x, y);
      if (b > 0) c = LW.warmFill[Math.min(6, b)];
      out[0] = c[0]; out[1] = c[1]; out[2] = c[2];
    });

    // ---- ink
    const ink = new LW.Ink(503);
    ink.wobble = 0.7;
    const base = ink.col(P.ink);
    const warmI = [0, 1, 2, 3, 4, 5, 6].map((b) => ink.col(LW.warmInkColor(b, P.ink)));
    const rimI = ink.col(LW.mix(P.ink, P.water1, 0.7));
    const colAt = (x, y, k = kindW) => {
      const b = LW.warmBand(LW.warm(x, y, k), x, y);
      if (b > 0) return warmI[b];
      if (y > L.waterY - 24) return rimI;
      return base;
    };
    const rng = new LW.RNG('bridge-hatch');

    // stone hatching: horizontal bed lines in wall stones, arcs in voussoirs
    for (const s of stones.concat(par)) {
      const ys = s.q.map((p) => p[1]);
      const y0 = Math.min(...ys) + 3, y1 = Math.max(...ys) - 3;
      const cx = s.cx || (s.q[0][0] + s.q[2][0]) / 2, cy = s.cy || (y0 + y1) / 2;
      let d = LW.clamp(faceDark(cx, cy) + s.tone, 0, 1);
      const wv = LW.clamp(LW.warm(cx, cy, kindW), 0, 1.2);
      d *= 1 - 0.45 * Math.min(1, wv);
      const sp = 3.6 + (1 - d) * 9;
      let off = rng.next() * sp;
      for (let y = y0 + off; y < y1; y += sp * (0.85 + rng.next() * 0.3)) {
        const sp2 = spanAt(s.out, y);
        if (!sp2) continue;
        let xa = sp2[0] + 2.5, xb = sp2[1] - 2.5;
        // engraver leaves the lit upper-right of each stone open
        const lightCut = (1 - d) * 0.55;
        const rel = (y - y0) / (y1 - y0 + 1e-6);
        if (rel < lightCut) xb = xa + (xb - xa) * (0.25 + rng.next() * 0.35);
        if (xb - xa < 4) continue;
        const pts = [];
        const steps = Math.max(2, Math.round((xb - xa) / 6));
        for (let k = 0; k <= steps; k++) {
          const x = xa + ((xb - xa) * k) / steps;
          pts.push([x, y + N.n2(x / 30, y / 7) * 0.9]);
        }
        const w = 0.9 + d * 1.3;
        ink.line(pts, (x, yy) => ink.st(colAt(x, yy), w), { taper: 8, wobble: 0.5 });
      }
      // texture: pits and a crack on some stones
      if (rng.next() < 0.35) {
        const n = 2 + rng.int(0, 5);
        for (let k = 0; k < n; k++) {
          const px = s.q[0][0] + rng.next() * (s.q[1][0] - s.q[0][0]);
          const py = y0 + rng.next() * (y1 - y0);
          if (!LW.pointInPoly(px, py, s.out)) continue;
          const r = 1.2 + rng.next() * 2;
          const pts = [];
          for (let a = 0; a <= 6.3; a += 1.2) pts.push([px + Math.cos(a) * r, py + Math.sin(a) * r * 0.7]);
          ink.line(pts, ink.st(colAt(px, py), 1.1), { taper: 0, wobble: 0.3 });
        }
      }
      if (rng.next() < 0.18) {
        let px = s.q[0][0] + rng.next() * (s.q[1][0] - s.q[0][0]), py = y0;
        const pts = [[px, py]];
        while (py < y1) {
          py += 4 + rng.next() * 5;
          px += (rng.next() - 0.5) * 7;
          pts.push([px, py]);
        }
        ink.line(pts, ink.st(colAt(px, py), 1.3), { taper: 12 });
      }
    }
    for (const v of vous) {
      const amid = (v.a0 + v.a1) / 2;
      const cx = nearC.x + Math.cos(amid) * (v.r0 + v.r1) / 2, cy = nearC.y + Math.sin(amid) * (v.r0 + v.r1) / 2;
      let d = LW.clamp(0.38 + v.tone, 0, 1);
      const wv = LW.clamp(LW.warm(cx, cy, kindW), 0, 1.2);
      d *= 1 - 0.4 * Math.min(1, wv);
      const sp = 3.6 + (1 - d) * 8;
      for (let r = v.r0 + 3 + rng.next() * sp; r < v.r1 - 3; r += sp) {
        // a lit band on the outer half is left open
        if ((r - v.r0) / (v.r1 - v.r0) > 0.45 + d * 0.6 && rng.next() < 0.7) continue;
        const pts = arcPts(nearC, r, v.a0 + 0.004, v.a1 - 0.004, 0.004);
        ink.line(pts, (x, y) => ink.st(colAt(x, y), 0.9 + d * 1.2), { taper: 6, wobble: 0.4 });
      }
    }
    // stone outlines (heavier on the shadow side of each stone)
    for (const s of all) {
      const c = s.cx || 0;
      void c;
      const n = s.out.length;
      let mx = 0, my = 0;
      for (const p of s.out) { mx += p[0]; my += p[1]; }
      mx /= n; my /= n;
      const wv = LW.warm(mx, my, kindW);
      // light direction: moon from upper right unless firelit (lantern lower left)
      const lx = wv > 0.3 ? -0.6 : 0.6, ly = wv > 0.3 ? 0.8 : -0.8;
      const pts = s.out.concat([s.out[0]]);
      ink.line(pts, (x, y) => {
        const nx = x - mx, ny = y - my;
        const L0 = Math.hypot(nx, ny) || 1;
        const facing = (nx * lx + ny * ly) / L0; // >0 toward light
        const w = (s.kind === 'vous' ? 2.0 : 1.7) + (facing < 0 ? -facing * 1.5 : -facing * 0.5);
        return ink.st(colAt(x, y), Math.max(0.9, w));
      }, { taper: 0, wobble: 0.5 });
    }
    // shadow under the string course: a run of short vertical hatch
    for (let x = B.x0; x < B.x1; x += 3.2) {
      const y0 = topY(x) + PAR + STR + 1;
      const len = 8 + 14 * (0.5 + 0.5 * N.n2(x / 40, 3));
      ink.line([[x, y0], [x + 0.6, y0 + len]], (xx, yy) => ink.st(colAt(xx, yy), 1.3), { taper: 5, wobble: 0.3 });
    }

    // ---- face texture: chisel marks, cross-hatch on shadowed stones, mortar grit,
    //      moss on the upper beds, weathering streaks, stipple
    const fdots = new LW.Dots();
    {
      const tr = new LW.RNG('bridge-tex');
      const T = new LW.Noise(511);
      const dotCol = (x, y, k = kindW) => {
        const b = LW.warmBand(LW.warm(x, y, k), x, y, 0);
        return b > 0 ? LW.rgb(LW.warmInkColor(b, P.ink)) : y > L.waterY - 24 ? LW.rgb(LW.mix(P.ink, P.water1, 0.7)) : LW.rgb(P.ink);
      };
      const mossC = LW.rgb(LW.texCol.moss), mossD = LW.rgb(LW.texCol.mossDark), mossW = LW.rgb(LW.mix(P.warm1, P.teal, 0.45));
      for (const s of all) {
        const xs = s.out.map((p) => p[0]), ys = s.out.map((p) => p[1]);
        const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
        const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
        let d = LW.clamp(faceDark(cx, cy) + s.tone, 0, 1);
        const wv = LW.clamp(LW.warm(cx, cy, kindW), 0, 1.2);
        d *= 1 - 0.45 * Math.min(1, wv);
        // chisel marks: a few runs of short parallel diagonal strokes
        const runs = s.kind === 'vous' ? 1 : 1 + tr.int(0, 2);
        for (let r = 0; r < runs; r++) {
          const px = x0 + 6 + tr.next() * Math.max(1, x1 - x0 - 12), py = y0 + 5 + tr.next() * Math.max(1, (y1 - y0) * 0.6);
          const ang = -1.05 + (tr.next() - 0.5) * 0.4;
          const cnt = 3 + tr.int(0, 4);
          for (let k = 0; k < cnt; k++) {
            const qx = px + k * 2.6, qy = py + (tr.next() - 0.5) * 1.5;
            const len = 3 + tr.next() * 4;
            const e = [qx + Math.cos(ang) * len, qy + Math.sin(ang) * len];
            if (!LW.pointInPoly(qx, qy, s.out) || !LW.pointInPoly(e[0], e[1], s.out)) continue;
            ink.line([[qx, qy], e], (x, y) => ink.st(colAt(x, y), 0.7), { taper: 2, wobble: 0.1 });
          }
        }
        // second hatch direction on stones in shadow
        if (d > 0.5) {
          const sp = 4.2 + (1 - d) * 6;
          for (let k = -(y1 - y0); k < x1 - x0; k += sp) {
            const p0 = [x0 + k, y1], p1 = [x0 + k + (y1 - y0) * 0.75, y0];
            const pts = [];
            for (let t = 0; t <= 1.0001; t += 0.1) pts.push([p0[0] + (p1[0] - p0[0]) * t, p0[1] + (p1[1] - p0[1]) * t]);
            ink.line(pts, (x, y) => {
              if (!LW.pointInPoly(x, y, s.out)) return -1;
              if (T.n2(x / 14, y / 14) > 0.5) return -1;
              return ink.st(colAt(x, y), 0.75);
            }, { taper: 4, wobble: 0.3 });
          }
        }
        // stipple: pits and grain
        const area = (x1 - x0) * (y1 - y0);
        const nd = Math.round(area / 55 * (0.35 + d));
        for (let k = 0; k < nd; k++) {
          const px = x0 + tr.next() * (x1 - x0), py = y0 + tr.next() * (y1 - y0);
          if (!LW.pointInPoly(px, py, s.out)) continue;
          fdots.dot(px, py, 0.5 + tr.next() * 0.65, dotCol(px, py));
        }
        // mortar grit: dots just outside the stone edge
        for (let i = 0; i < s.out.length; i += 2) {
          if (tr.next() > 0.45) continue;
          const p = s.out[i];
          const ox = (p[0] - cx), oy = (p[1] - cy);
          const L0 = Math.hypot(ox, oy) || 1;
          fdots.dot(p[0] + ox / L0 * 2.2, p[1] + oy / L0 * 2.2, 0.5 + tr.next() * 0.5, dotCol(p[0], p[1]));
        }
        // moss along the upper bed of coping, string course and the wet lower courses
        const mossy = s.kind === 'coping' ? 0.8 : s.kind === 'string' ? 0.55 : s.cy > 2120 ? 0.6 : s.kind === 'vous' ? 0.15 : 0.18;
        if (tr.next() < mossy) {
          const mx0 = x0 + tr.next() * (x1 - x0) * 0.6, mw = 10 + tr.next() * 40;
          for (let x = mx0; x < Math.min(x1, mx0 + mw); x += 1.8) {
            let yTop = y0;
            for (let yy = y0; yy < y1; yy += 1.5) if (LW.pointInPoly(x, yy, s.out)) { yTop = yy; break; }
            const b = LW.warmBand(LW.warm(x, yTop, kindW), x, yTop, 0);
            const n = 1 + tr.int(0, 2);
            for (let q = 0; q < n; q++) fdots.dot(x + (tr.next() - 0.5) * 2, yTop + tr.next() * 4.5 - 1, 0.7 + tr.next() * 0.8, b > 1 ? mossW : tr.next() < 0.55 ? mossD : mossC);
            if (tr.next() < 0.12) fdots.flick(x, yTop, -Math.PI / 2 + (tr.next() - 0.5) * 1.2, 3 + tr.next() * 3, 1, b > 1 ? mossW : mossC);
          }
        }
      }
      // weathering streaks running down from under the string course
      for (let i = 0; i < 170; i++) {
        const x = B.x0 + 10 + tr.next() * (B.x1 - B.x0 - 20);
        const y = topY(x) + PAR + STR + 3;
        if (T.n2(x / 70, 2.5) < -0.1) continue;
        const len = 20 + Math.pow(tr.next(), 1.5) * 150;
        const pts = [];
        for (let yy = y; yy < Math.min(WY, y + len); yy += 4) {
          const xx = x + 1.2 * T.n2(yy / 30, x);
          const dc = Math.hypot(xx - nearC.x, yy - nearC.y);
          if (yy > nearC.y - nearC.r - 2 && dc < nearC.r + 1) break;
          pts.push([xx, yy]);
        }
        if (pts.length < 3) continue;
        const Lp = pts.length;
        ink.line(pts, (xx, yy, k) => (T.n2(xx / 5, yy / 20) > 0.4 ? -1 : ink.st(colAt(xx, yy), 0.55 + 0.9 * (1 - k / Lp))), { taper: 10, minScale: 0.2, wobble: 0.3 });
      }
      // the keystone: a dark wet stain down its face
      {
        const kx = nearC.x, ky0 = nearC.y - G.ringOuter - 20, ky1 = nearC.y - nearC.r;
        for (let k = 0; k < 6; k++) {
          const xx = kx - 6 + k * 2.4 + (tr.next() - 0.5);
          ink.line([[xx, ky0 + tr.next() * 20], [xx + 0.5, (ky0 + ky1) / 2], [xx, ky1 - 2]], (x, y) => ink.st(colAt(x, y), 1.1), { taper: 8, wobble: 0.4 });
        }
      }
    }
    ctx.save();
    ctx.clip(G.facePath);
    ink.flush(ctx);
    fdots.flush(ctx);
    ctx.restore();

    // soffit (inside the opening, so its own clip): barrel courses + transverse joints + dense hatch
    {
      const courses = 4;
      for (let k = 1; k < courses; k++) {
        const t = k / courses;
        const c = { x: LW.lerp(nearC.x, farC.x, t), y: LW.lerp(nearC.y, farC.y, t) };
        const r = LW.lerp(nearC.r, farC.r, t);
        ink.line(arcPts(c, r, -Math.PI, 0, 0.006), (x, y) => ink.st(colAt(x, y, 'soffit'), 1.6), { taper: 0 });
      }
      for (let k = 0; k < courses; k++) {
        const ta = k / courses, tb = (k + 1) / courses;
        const ca = { x: LW.lerp(nearC.x, farC.x, ta), y: LW.lerp(nearC.y, farC.y, ta) }, ra = LW.lerp(nearC.r, farC.r, ta);
        const cb = { x: LW.lerp(nearC.x, farC.x, tb), y: LW.lerp(nearC.y, farC.y, tb) }, rb = LW.lerp(nearC.r, farC.r, tb);
        const n = 26;
        for (let i = 0; i <= n; i++) {
          const a = -Math.PI + (Math.PI * (i + (k % 2) * 0.5)) / n;
          if (a > 0) continue;
          const p = [ca.x + Math.cos(a) * ra, ca.y + Math.sin(a) * ra], q = [cb.x + Math.cos(a) * rb, cb.y + Math.sin(a) * rb];
          ink.line([p, q], (x, y) => ink.st(colAt(x, y, 'soffit'), 1.4), { taper: 0, wobble: 0.3 });
        }
        // hatch lines along the barrel inside each course
        const hn = 5;
        for (let h = 1; h < hn; h++) {
          const t = ta + ((tb - ta) * h) / hn;
          const c = { x: LW.lerp(nearC.x, farC.x, t), y: LW.lerp(nearC.y, farC.y, t) };
          const r = LW.lerp(nearC.r, farC.r, t);
          ink.line(arcPts(c, r, -Math.PI, 0, 0.006), (x, y) => {
            const wv = LW.warm(x, y, 'soffit');
            if (wv > 0.75 && (h % 2 === 1)) return -1;
            if (wv > 1.05) return -1;
            return ink.st(colAt(x, y, 'soffit'), 0.9);
          }, { taper: 6, wobble: 0.3 });
        }
      }
    }
    // soffit texture: stone joints broken irregularly, stipple grain, chisel flecks, wet stains at the springing
    const sdots = new LW.Dots();
    {
      const tr = new LW.RNG('soffit-tex');
      const sbb = LW.bbox(G.soffit, 0);
      for (let i = 0; i < 22000; i++) {
        const x = sbb[0] + tr.next() * (sbb[2] - sbb[0]), y = sbb[1] + tr.next() * (sbb[3] - sbb[1]);
        if (!LW.pointInPoly(x, y, G.soffit)) continue;
        const wv = LW.warm(x, y, 'soffit');
        const p = 0.7 - 0.3 * LW.clamp(wv - 0.6, 0, 1);
        if (tr.next() > p) continue;
        const ci = colAt(x, y, 'soffit');
        if (tr.next() < 0.12) {
          const a = -1.0 + (tr.next() - 0.5) * 0.5, l = 2.5 + tr.next() * 3;
          ink.line([[x, y], [x + Math.cos(a) * l, y + Math.sin(a) * l]], ink.st(ci, 0.7), { taper: 2, wobble: 0.1 });
        } else sdots.dot(x, y, 0.5 + tr.next() * 0.6, ink.colors[ci]);
      }
      // dark damp at the foot of each side of the barrel
      for (const side of [-1, 1]) {
        for (let k = 0; k < 40; k++) {
          const t = tr.next();
          const c = { x: LW.lerp(nearC.x, farC.x, t), y: LW.lerp(nearC.y, farC.y, t) }, r = LW.lerp(nearC.r, farC.r, t);
          const a = side < 0 ? -Math.PI + 0.02 + tr.next() * 0.35 : -0.02 - tr.next() * 0.35;
          const p = [c.x + Math.cos(a) * r, c.y + Math.sin(a) * r];
          const yb = LW.lerp(WY, G.farWY, t);
          const pts = [];
          for (let y = p[1]; y < yb; y += 4) pts.push([p[0] + side * (y - p[1]) * 0.0 + (tr.next() - 0.5) * 0.8, y]);
          if (pts.length > 2) ink.line(pts, (x, y) => ink.st(colAt(x, y, 'soffit'), 0.8), { taper: 8, wobble: 0.3 });
        }
      }
    }
    ctx.save();
    ctx.clip(G.soffitPath);
    ink.flush(ctx);
    sdots.flush(ctx);
    ctx.restore();


    // outlines: silhouette, intrados, soffit far edge
    const ink2 = new LW.Ink(504);
    ink2.wobble = 0.6;
    const oc = ink2.col(P.ink);
    const top = [];
    for (let x = B.x0; x <= B.x1; x += 5) top.push([x, topY(x)]);
    ink2.line(top, ink2.st(oc, 4.6), { taper: 0 });
    ink2.line(arcPts(nearC, nearC.r, -Math.PI, 0, 0.005), (x, y) => ink2.st(colAt(x, y, 'soffit') === base ? oc : colAt(x, y, 'soffit'), 3.6), { taper: 0 });
    ink2.line(arcPts(farC, farC.r, -Math.PI, 0, 0.005), ink2.st(oc, 2.6), { taper: 0 });
    ink2.line([[nearC.x - nearC.r, nearC.y], [nearC.x - nearC.r, WY]], ink2.st(oc, 3.2), { taper: 0 });
    ink2.line([[nearC.x + nearC.r, nearC.y], [nearC.x + nearC.r, WY]], ink2.st(oc, 3.2), { taper: 0 });
    ink2.line([[farC.x - farC.r, farC.y], [farC.x - farC.r, G.farWY]], ink2.st(oc, 2.2), { taper: 0 });
    ink2.line([[farC.x + farC.r, farC.y], [farC.x + farC.r, G.farWY]], ink2.st(oc, 2.2), { taper: 0 });
    ink2.flush(ctx);
    // drips hanging from the keystone, one falling, a ring where it lands
    {
      const kx = nearC.x, ky = nearC.y - nearC.r + 2;
      const dc = LW.rgb(P.water5), dk = LW.rgb(P.ink);
      const drop = (x, y, s) => {
        const pts = [];
        for (let a = 0; a <= Math.PI * 2 + 0.01; a += 0.3) {
          const r = s * (a < Math.PI ? 1 : 1 - 0.75 * Math.sin(a - Math.PI));
          pts.push([x + Math.cos(a) * r * 0.75, y + Math.sin(a) * r * (a > Math.PI ? 1.9 : 1)]);
        }
        ctx.fillStyle = dc;
        ctx.fill(LW.polyPath(pts));
        ctx.strokeStyle = dk;
        ctx.lineWidth = 0.9;
        ctx.stroke(LW.polyPath(pts));
      };
      drop(kx - 9, ky + 6, 2.4);
      drop(kx + 2, ky + 9, 3.2);
      drop(kx + 11, ky + 5, 2.0);
      drop(kx + 1, ky + 80, 2.6);
      drop(kx + 1.5, ky + 190, 2.2);
      ctx.save();
      ctx.strokeStyle = LW.rgb(P.water5);
      for (let k = 1; k <= 3; k++) {
        ctx.lineWidth = 1.3 - k * 0.25;
        ctx.beginPath();
        ctx.ellipse(kx + 1.5, L.waterY + 14 + k * 1.5, 6 + k * 7, 1.6 + k * 1.4, 0, Math.PI * 0.05, Math.PI * 0.95 + (k === 2 ? 0.6 : 0));
        ctx.stroke();
      }
      ctx.restore();
    }
    // ivy: climbing up the left abutment from the waterline and draping from the parapet on the right
    {
      const ir = new LW.RNG('ivy2');
      const iv = new LW.Ink(505);
      iv.wobble = 0.3;
      const leaves = [];
      const stem = (x, y, ang, len, depth) => {
        const pts = [[x, y]];
        for (let s = 0; s < len; s += 5) {
          ang += (ir.next() - 0.5) * 0.5;
          x += Math.cos(ang) * 5; y += Math.sin(ang) * 5;
          if (x < B.x0 + 4 || x > B.x1 - 4) break;
          pts.push([x, y]);
          if (ir.next() < 0.55) leaves.push([x + (ir.next() - 0.5) * 8, y + (ir.next() - 0.5) * 6, ir.next() * Math.PI * 2, 0.75 + ir.next() * 0.55]);
          if (depth < 3 && ir.next() < 0.06) stem(x, y, ang + ir.sign() * (0.5 + ir.next() * 0.6), len * 0.45, depth + 1);
        }
        iv.line(pts, iv.st(iv.col(P.ink), 1.6 - depth * 0.3), { taper: 16 });
      };
      // climbing: from the base of the left abutment up its face and onto the spandrel
      for (let k = 0; k < 5; k++) stem(600 + k * 26 + ir.next() * 14, L.waterY - 6, -Math.PI / 2 + (ir.next() - 0.5) * 0.5, 160 + ir.next() * 170, 0);
      // draping: from the parapet foot on the right side, hanging down
      for (let k = 0; k < 7; k++) {
        const x0 = 1470 + k * 30 + ir.next() * 16;
        stem(x0, topY(x0) + PAR + STR - 3, Math.PI / 2 + (ir.next() - 0.5) * 0.3, 70 + ir.next() * 150, 1);
      }
      for (let k = 0; k < 40; k++) {
        const x = 1460 + ir.next() * 240;
        leaves.push([x, topY(x) + PAR + STR - 8 + ir.next() * 16, ir.next() * Math.PI * 2, 0.9 + ir.next() * 0.4]);
      }
      iv.flush(ctx);
      for (const [x, y, a, sc] of leaves) {
        const s = 9 * sc;
        const tr = (u, v) => [x + Math.cos(a) * u - Math.sin(a) * v, y + Math.sin(a) * u + Math.cos(a) * v];
        // three-lobed ivy leaf
        const leaf = [tr(0, 0), tr(s * 0.35, -s * 0.55), tr(s * 0.5, -s * 0.95), tr(s * 0.8, -s * 0.45), tr(s * 1.45, -s * 0.3), tr(s * 1.1, 0), tr(s * 1.45, s * 0.3), tr(s * 0.8, s * 0.45), tr(s * 0.5, s * 0.95), tr(s * 0.35, s * 0.55)];
        const wb = LW.warmBand(LW.warm(x, y, 'bridge'), x, y, 0);
        const lit = ((Math.cos(a) * 0.6 - Math.sin(a) * 0.8) > 0);
        ctx.fillStyle = LW.rgb(wb >= 3 ? (lit ? P.warm3 : P.warm1) : wb >= 1 ? LW.mix(P.teal, P.warm1, 0.55) : lit ? P.teal : P.tealDark);
        ctx.fill(LW.polyPath(LW.chaikin(leaf, 1, true)));
        iv.line(LW.chaikin(leaf, 1, true).concat([leaf[0]]), iv.st(iv.col(P.ink), 1.1), { taper: 0, wobble: 0.1 });
        iv.line([tr(0.15 * s, 0), tr(1.1 * s, 0)], iv.st(iv.col(P.ink), 0.7), { taper: 3, wobble: 0 });
      }
      iv.flush(ctx);
    }
    LW.log('bridge stones', all.length, 'ms', Math.round(performance.now() - t0));
  };
})();
