// Phosphor: the instrument around the trace, built once per resolution.
//   mask/vign/grain  the faceplate (round 5-inch CRT), its edge fall-off and the phosphor's grain
//   gcov             the edge-lit perspex graticule (engraved 1 cm grid, minor ticks on the axes)
//   stat (RGB)       light that does not come from the trace: graticule lamps (warm), the pilot jewel, a faint
//                    night window reflected in the curved glass, the cool room fill
//   lit  (RGB)       panel, bezel and knobs as lit by the screen's glow (scaled each frame by the total emission)
//   lipF/lipI        the bezel's inner lip, lit locally by the part of the screen next to it
(function () {
  const PH = window.PH;
  const { clamp, smooth, lerp, fbm, vnoise, hash2, rng, TAU } = PH;

  PH.Renderer.prototype.buildStatic = function () {
    const W = this.W, H = this.H, s = this.s, cx = this.cx, cy = this.cy, R = this.R;
    const N = W * H;
    const mask = (this.mask = new Float32Array(N));
    const vign = (this.vign = new Float32Array(N));
    const grain = (this.grain = new Float32Array(N));
    const gcov = (this.gcov = new Float32Array(N));
    const stat = (this.stat = new Float32Array(N * 3));
    const lit = (this.lit = new Float32Array(N * 3));
    const dith = (this.dith = new Float32Array(N));
    const lipF = (this.lipF = new Float32Array(N));
    const lipI = (this.lipI = new Int32Array(N));
    // camera lens fall-off over the whole frame: the room's corners sink into deep darks
    const fvig = (this.fvig = new Float32Array(N));
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const qx = (x + 0.5 - W * 0.5) / (W * 0.62), qy = (y + 0.5 - H * 0.43) / (H * 0.62), d = Math.sqrt(qx * qx + qy * qy);
      fvig[y * W + x] = 1 - 0.6 * smooth(0.5, 1.3, d);
    }
    const L6 = this.levels[5];

    // ---- geometry of the bezel (radii in px)
    const rLip = R + 30 * s, rFace = R + 86 * s, rOut = R + 100 * s;
    const knobs = [
      // x, y, skirt radius, cap radius, height, pointer angle (rad, 0 = up, clockwise)
      { x: 330, y: 2445, rk: 150, rt: 92, hk: 70, ang: -0.9 },
      { x: 735, y: 2478, rk: 86, rt: 56, hk: 52, ang: 0.55 },
      { x: 1835, y: 2445, rk: 150, rt: 92, hk: 70, ang: 0.35 },
    ].map((k) => ({ x: k.x * s, y: k.y * s, rk: k.rk * s, rt: k.rt * s, hk: k.hk * s, ang: k.ang }));
    const bnc = { x: 1345 * s, y: 2490 * s, r: 58 * s };
    const pilot = { x: 1585 * s, y: 2275 * s, r: 27 * s };
    const screws = [];
    for (let k = 0; k < 4; k++) { const a = TAU / 8 + (k * TAU) / 4; screws.push({ x: cx + Math.cos(a) * (R + 58 * s), y: cy + Math.sin(a) * (R + 58 * s), r: 15 * s, slot: 0.4 + k * 0.9 }); }
    const PHOS = [0.17, 1.0, 0.36];
    const AMBER = [1.0, 0.5, 0.17];

    // ---- graticule: 1 div = R/5.4, lines clipped short of the rim
    const div = R / 5.4;
    const lw = 1.05 * s;
    function gratAt(x, y, r) {
      if (r > R - 14 * s) return 0;
      const fx = (x - cx) / div, fy = (y - cy) / div;
      let c = 0;
      const dxl = Math.abs(fx - Math.round(fx)) * div, dyl = Math.abs(fy - Math.round(fy)) * div;
      if (Math.abs(Math.round(fx)) <= 5) c = Math.max(c, Math.exp(-(dxl * dxl) / (2 * lw * lw)));
      if (Math.abs(Math.round(fy)) <= 5) c = Math.max(c, Math.exp(-(dyl * dyl) / (2 * lw * lw)));
      // minor ticks on the two centre axes, every 0.2 div
      const tl = 9 * s;
      const mx = (fx * 5 - Math.round(fx * 5)) * div / 5, my = (fy * 5 - Math.round(fy * 5)) * div / 5;
      if (Math.abs(y - cy) < tl) c = Math.max(c, Math.exp(-(mx * mx) / (2 * lw * lw)) * 0.9);
      if (Math.abs(x - cx) < tl) c = Math.max(c, Math.exp(-(my * my) / (2 * lw * lw)) * 0.9);
      // engraving is not perfect: brightness wanders along the cut, with occasional chips
      const v = 0.78 + 0.22 * vnoise(x / (37 * s), y / (37 * s), 11) + 0.25 * Math.max(0, vnoise(x / (5 * s), y / (5 * s), 12) - 0.55);
      return c * v * smooth(R - 14 * s, R - 34 * s, r);
    }

    // ---- reflections in the curved faceplate: a dim night window up-left and the rim's sheen
    function reflection(x, y, r) {
      const u = (x - cx) / R, v = (y - cy) / R;
      // dome mapping: reflections compress toward the rim
      const rr = Math.min(0.999, r / R);
      const k = 1 + 0.35 * rr * rr;
      const qu = u * k, qv = v * k;
      // window: soft rounded rectangle, with a cross bar, rotated slightly
      const a = -0.12, ca = Math.cos(a), sa = Math.sin(a);
      const wx = (qu + 0.5) * ca - (qv + 0.66) * sa, wy = (qu + 0.5) * sa + (qv + 0.66) * ca;
      const hx = 0.17, hy = 0.22, soft = 0.1;
      const box = smooth(hx + soft, hx - soft, Math.abs(wx)) * smooth(hy + soft, hy - soft, Math.abs(wy));
      const bars = 1 - 0.55 * Math.exp(-(wx * wx) / (2 * 0.012 * 0.012)) - 0.55 * Math.exp(-((wy + 0.03) * (wy + 0.03)) / (2 * 0.012 * 0.012));
      const win = box * bars * (0.75 + 0.25 * smooth(-0.3, 0.3, -wy));
      // sheen along the upper-left rim
      const ang = Math.atan2(v, u);
      const rim = Math.exp(-Math.pow((rr - 0.955) / 0.018, 2)) * Math.exp(-Math.pow((ang + 2.25) / 0.45, 2));
      const broad = Math.exp(-Math.pow((rr - 0.86) / 0.12, 2)) * Math.exp(-Math.pow((ang + 2.2) / 0.8, 2));
      return { win, rim, broad };
    }

    const R2 = rng(1234);
    const dust = [];
    for (let i = 0; i < 170; i++) {
      const a = R2() * TAU, rr = Math.sqrt(R2()) * R * 0.98;
      dust.push({ x: cx + Math.cos(a) * rr, y: cy + Math.sin(a) * rr, r: (0.6 + 1.6 * Math.pow(R2(), 3)) * s, a: 0.3 + 0.7 * R2() });
    }
    const scratches = [];
    for (let i = 0; i < 9; i++) {
      const a = R2() * TAU, rr = Math.sqrt(R2()) * R * 0.9, len = (40 + 180 * R2()) * s, d = R2() * Math.PI;
      scratches.push({ x: cx + Math.cos(a) * rr, y: cy + Math.sin(a) * rr, dx: Math.cos(d), dy: Math.sin(d), len, a: 0.25 + 0.6 * R2(), bow: (R2() - 0.5) * 0.004 });
    }
    // dust bins for speed
    const BIN = 64 * s;
    const bins = new Map();
    const binKey = (bx, by) => bx * 10000 + by;
    dust.forEach((d, i) => { const k = binKey(Math.floor(d.x / BIN), Math.floor(d.y / BIN)); if (!bins.has(k)) bins.set(k, []); bins.get(k).push(d); });

    // ---- panel helpers
    function knobAt(x, y) {
      for (const k of knobs) { const dx = x - k.x, dy = y - k.y; if (dx * dx + dy * dy < (k.rk + 2 * s) * (k.rk + 2 * s)) return k; }
      return null;
    }

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x, j = i * 3;
        const px = x + 0.5, py = y + 0.5;
        const dx = px - cx, dy = py - cy, r = Math.hypot(dx, dy);
        dith[i] = (hash2(x, y, 7) + hash2(x, y, 8) - 1) * 0.9;
        // ---------------- glass
        const m = clamp((R - r) / (1.2 * s) + 0.5, 0, 1);
        mask[i] = m;
        if (r < R + 2 * s) {
          const rho = r / R;
          vign[i] = (1 - 0.32 * Math.pow(rho, 4)) * (1 - 0.06 * rho * rho);
          // phosphor grain: fine clumps
          const gn = vnoise(px / (1.3 * s), py / (1.3 * s), 3) * 0.6 + vnoise(px / (4.5 * s), py / (4.5 * s), 4) * 0.4;
          grain[i] = 1 + 0.3 * gn;
          gcov[i] = gratAt(px, py, r) * m;
          // graticule lamps at 9 and 3 o'clock: warm edge light, strongest near the lamps
          const dl = Math.hypot(px - (cx - R), py - cy), dr = Math.hypot(px - (cx + R), py - cy);
          const edge = Math.exp(-dl / (330 * s)) + Math.exp(-dr / (330 * s)) + 0.10;
          const ga = gcov[i] * edge * 0.018;
          // the perspex rim glows where the lamps feed it
          const rimg = Math.exp(-Math.pow((r - (R - 4 * s)) / (3.0 * s), 2)) * (Math.exp(-dl / (200 * s)) + Math.exp(-dr / (200 * s))) * 0.05;
          const rf = reflection(px, py, r);
          let sr = 0, sg = 0, sb = 0;
          sr += (ga + rimg) * AMBER[0]; sg += (ga + rimg) * AMBER[1]; sb += (ga + rimg) * AMBER[2];
          const wv = rf.win * 0.0038, rv = rf.rim * 0.007 + rf.broad * 0.0007;
          sr += wv * 0.5 + rv * 0.5; sg += wv * 0.8 + rv * 0.95; sb += wv * 0.9 + rv * 0.85;
          // dust and fine scratches on the glass catch a little light
          const bx = Math.floor(px / BIN), by = Math.floor(py / BIN);
          let du = 0;
          for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
            const arr = bins.get(binKey(bx + ox, by + oy));
            if (!arr) continue;
            for (const d of arr) { const q = ((px - d.x) * (px - d.x) + (py - d.y) * (py - d.y)) / (d.r * d.r); if (q < 9) du += d.a * Math.exp(-q * 0.5); }
          }
          for (const sc of scratches) {
            const qx = px - sc.x, qy = py - sc.y;
            const along = qx * sc.dx + qy * sc.dy;
            if (along < 0 || along > sc.len) continue;
            const perp = -qx * sc.dy + qy * sc.dx - sc.bow * along * (along - sc.len) / s;
            if (Math.abs(perp) < 2 * s) du += sc.a * 0.5 * Math.exp(-(perp * perp) / (2 * 0.45 * 0.45 * s * s)) * Math.sin(Math.PI * along / sc.len);
          }
          const dv = du * 0.0045;
          sr += dv * 0.8; sg += dv * 0.9; sb += dv * 1.0;
          // the faceplate is not perfectly black: deep green-grey glass
          sr += 0.00035; sg += 0.0006; sb += 0.0006;
          stat[j] += sr * m; stat[j + 1] += sg * m; stat[j + 2] += sb * m;
        }
        if (m >= 1) continue;
        const om = 1 - m;
        // ---------------- outside the glass: bezel, panel, knobs
        let z = 0, nx = 0, ny = 0, nz = 1, alb = [0.2, 0.22, 0.24], spec = 0.04, gloss = 20, mat = 'panel';
        const ux = dx / (r + 1e-9), uy = dy / (r + 1e-9);
        if (r < rOut + 1 * s) {
          if (r < rLip) {
            // rounded inner lip rising from the glass: faces the screen
            const f = (r - R) / (rLip - R);
            const ang = (1 - f) * 1.15; // normal tilt toward the centre
            nx = -ux * Math.sin(ang); ny = -uy * Math.sin(ang); nz = Math.cos(ang);
            const lt = 0.75 + 0.25 * vnoise(Math.atan2(dy, dx) * 60, f * 3, 33) + 0.15 * vnoise(Math.atan2(dy, dx) * 400, 0.5, 34);
            alb = [0.03 * lt, 0.032 * lt, 0.035 * lt]; spec = 0.1 * lt * lt; gloss = 30; mat = 'lip';
            lipF[i] = 0.4 * lt * Math.sin(ang) * (1 - f * 0.5) * om;
            const qx = cx + dx * (R * 0.8 / r), qy = cy + dy * (R * 0.8 / r);
            lipI[i] = Math.min(L6.h - 1, Math.max(0, Math.floor(qy / 64))) * L6.w + Math.min(L6.w - 1, Math.max(0, Math.floor(qx / 64)));
          } else if (r < rFace) {
            // bezel face: black crinkle paint, very slightly conical
            const cr = fbm(px / (3.2 * s), py / (3.2 * s), 21, 3, 2.1, 0.55);
            nx = ux * 0.05 + cr * 0.12; ny = uy * 0.05 + fbm(px / (3.2 * s) + 9, py / (3.2 * s), 22, 3, 2.1, 0.55) * 0.12; nz = 1;
            alb = [0.03, 0.031, 0.033]; spec = 0.12; gloss = 14; mat = 'bezel';
            // the inner edge of the face is worn to bare metal in places
            const wear = 0.35 * smooth(0.6, 0.8, vnoise(px / (30 * s), py / (30 * s), 31) * 0.5 + 0.5) * Math.exp(-Math.pow((r - rLip - 3 * s) / (4 * s), 2));
            if (wear > 0) { alb = alb.map((a) => lerp(a, 0.35, wear)); spec = lerp(spec, 0.5, wear); }
            for (const sw of screws) {
              const ddx = px - sw.x, ddy = py - sw.y, dd = Math.hypot(ddx, ddy);
              if (dd < sw.r + 2 * s) {
                const f = clamp(dd / sw.r, 0, 1);
                const tilt = Math.pow(f, 2) * 0.9;
                nx = (ddx / (dd + 1e-9)) * Math.sin(tilt); ny = (ddy / (dd + 1e-9)) * Math.sin(tilt); nz = Math.cos(tilt);
                alb = [0.32, 0.31, 0.29]; spec = 0.6; gloss = 40; mat = 'screw';
                const along = -ddx * Math.sin(sw.slot) + ddy * Math.cos(sw.slot);
                if (Math.abs(along) < 2.6 * s && dd < sw.r * 0.85) { alb = [0.02, 0.02, 0.02]; spec = 0.02; }
                if (dd > sw.r) { alb = [0.01, 0.01, 0.01]; spec = 0; } // the countersink shadow
              }
            }
          } else {
            // rolled outer edge
            const f = (r - rFace) / (rOut - rFace);
            const ang = f * 1.2;
            nx = ux * Math.sin(ang); ny = uy * Math.sin(ang); nz = Math.cos(ang);
            alb = [0.035, 0.036, 0.04]; spec = 0.3; gloss = 26; mat = 'bezel';
          }
          z = 30 * s;
        } else {
          // panel: blue-grey hammertone (soft craters ~3 mm across, fine grain), worn
          const c1 = vnoise(px / (34 * s), py / (34 * s), 41), c2 = vnoise(px / (34 * s) + 7.7, py / (34 * s) + 3.1, 42);
          const g1 = vnoise(px / (2.6 * s), py / (2.6 * s), 43), g2 = vnoise(px / (2.6 * s) + 5.5, py / (2.6 * s) + 1.3, 44);
          nx = c1 * 0.07 + g1 * 0.035; ny = c2 * 0.07 + g2 * 0.035; nz = 1;
          const tone = 0.94 + 0.06 * vnoise(px / (140 * s), py / (140 * s), 45);
          alb = [0.20 * tone, 0.225 * tone, 0.245 * tone]; spec = 0.12; gloss = 14;
          // the seam between the CRT plate and the controls plate: a dark groove, its lower lip catching the glow
          {
            const gy = 2232 * s, dyg = py - gy;
            if (Math.abs(dyg) < 6 * s) {
              const groove = Math.exp(-Math.pow(dyg / (1.6 * s), 2));
              const lip = Math.exp(-Math.pow((dyg - 2.6 * s) / (0.9 * s), 2));
              alb = alb.map((a) => a * (1 - 0.85 * groove));
              ny -= lip * 0.9; nz = 1 - lip * 0.4; spec = lerp(spec, 0.5, lip); gloss = lerp(gloss, 40, lip);
            }
            // plate screws near the frame edges
            for (const sx of [64 * s, W - 64 * s]) {
              const dd = Math.hypot(px - sx, py - (gy + 44 * s));
              if (dd < 15 * s) {
                const f = dd / (13 * s), tilt = Math.min(1.2, Math.pow(f, 2) * 0.9);
                nx = ((px - sx) / (dd + 1e-9)) * Math.sin(tilt); ny = ((py - gy - 44 * s) / (dd + 1e-9)) * Math.sin(tilt); nz = Math.cos(tilt);
                alb = f > 1 ? [0.01, 0.01, 0.01] : [0.3, 0.3, 0.28]; spec = f > 1 ? 0 : 0.6; gloss = 40;
                const along = -(px - sx) * Math.sin(0.7 + sx) + (py - gy - 44 * s) * Math.cos(0.7 + sx);
                if (f <= 1 && Math.abs(along) < 2.4 * s && f < 0.85) { alb = [0.02, 0.02, 0.02]; spec = 0.02; }
              }
            }
          }
          // wear: polished rings round the knobs (fingers), fine arc scratches from turning them, a few chips to
          // bare aluminium along the lower bezel edge and by the knobs
          for (const k of knobs) {
            const kd = Math.hypot(px - k.x, py - k.y);
            const ring = Math.exp(-Math.pow((kd - k.rk - 10 * s) / (22 * s), 2));
            if (ring > 0.01) {
              const pa = Math.atan2(px - k.x, -(py - k.y));
              const scr = Math.max(0, vnoise(kd / (0.9 * s), pa * 2.0, 57 + Math.round(k.x)) - 0.55) * 2.2 * smooth(0.0, 0.5, vnoise(pa * 4, kd / (30 * s), 58) * 0.5 + 0.5);
              spec = lerp(spec, 0.35, ring * 0.6); gloss = lerp(gloss, 30, ring * 0.6);
              alb = alb.map((a0) => a0 * (1 + 0.25 * ring) + 0.12 * scr * ring);
              nx *= 1 - 0.6 * ring; ny *= 1 - 0.6 * ring;
            }
          }
          {
            const zone = Math.max(Math.exp(-Math.pow((r - rOut - 5 * s) / (14 * s), 2)) * smooth(0.2, 0.9, dy / R), ...knobs.map((k) => 0.8 * Math.exp(-Math.pow((Math.hypot(px - k.x, py - k.y) - k.rk - 5 * s) / (10 * s), 2))));
            if (zone > 0.02) {
              const nb = vnoise(px / (7 * s), py / (7 * s), 51) * 0.7 + vnoise(px / (2 * s), py / (2 * s), 52) * 0.3;
              const wz = smooth(0.7, 0.73, nb * 0.5 + 0.5 + 0.2 * zone - 0.1) * smooth(0.1, 0.4, zone);
              if (wz > 0) { alb = alb.map((a, c) => lerp(a, [0.46, 0.46, 0.44][c], wz)); spec = lerp(spec, 0.6, wz); gloss = lerp(gloss, 50, wz); nx *= 1 - wz; ny *= 1 - wz; }
            }
          }
          // painted tick marks round the big knobs (no lettering), worn
          for (const k of knobs) {
            if (k.rk < 120 * s) continue;
            const kd = Math.hypot(px - k.x, py - k.y);
            if (kd < k.rk + 16 * s || kd > k.rk + 50 * s) continue;
            const a = Math.atan2(px - k.x, -(py - k.y)); // 0 = up, clockwise
            if (Math.abs(a) > 2.45) continue;
            const step = 4.8 / 10, ti = Math.round((a + 2.4) / step), da = (a + 2.4 - ti * step) * kd;
            if (ti < 0 || ti > 10) continue;
            const long = ti % 5 === 0 ? 1 : 0;
            if (kd < k.rk + (long ? 48 : 36) * s) {
              const cov = smooth(3.0 * s, 1.8 * s, Math.abs(da)) * smooth(k.rk + 16 * s, k.rk + 19 * s, kd) * smooth(k.rk + (long ? 48 : 36) * s, k.rk + (long ? 45 : 33) * s, kd);
              const paint = 0.35 + 0.65 * smooth(-0.35, 0.2, vnoise(px / (4 * s), py / (4 * s), 61));
              alb = alb.map((a0) => lerp(a0, 0.75, cov * paint));
            }
          }
          // knob shadows (light falls from the screen above) and contact occlusion
          for (const k of knobs) {
            const sx = k.x + (k.x - cx) * 0.06, sy = k.y + k.hk * 1.25;
            const sd = Math.hypot(px - sx, (py - sy) * 0.9);
            const sh = 0.75 * smooth(k.rk * 1.15, k.rk * 0.8, sd);
            const kd = Math.hypot(px - k.x, py - k.y);
            const ao = Math.exp(-Math.max(0, kd - k.rk) / (9 * s)) * 0.5;
            if (sh > 0 || ao > 0.01) alb = alb.map((a) => a * (1 - 0.8 * sh) * (1 - ao));
          }
          const kn = knobAt(px, py);
          if (kn) {
            const kdx = px - kn.x, kdy = py - kn.y, kd = Math.hypot(kdx, kdy), ku = kdx / (kd + 1e-9), kv = kdy / (kd + 1e-9);
            const pa = Math.atan2(kdx, -kdy);
            const tx = -kv, ty = ku;
            if (kd < kn.rt) {
              // cap: glossy bakelite with an aluminium insert, slightly domed, rounded edge
              const f = kd / kn.rt;
              const tilt = 0.08 * f + 1.25 * Math.pow(smooth(0.82, 1.0, f), 1.3);
              nx = ku * Math.sin(tilt); ny = kv * Math.sin(tilt); nz = Math.cos(tilt);
              alb = [0.03, 0.028, 0.026]; spec = 1.1; gloss = 60; mat = 'knob';
              if (f < 0.6) {
                const ring = Math.sin(kd / (0.9 * s)) * 0.025 + vnoise(kd / (1.5 * s), pa * 3, 71) * 0.02;
                nx += ku * ring; ny += kv * ring;
                const brushed = 0.9 + 0.1 * Math.sin(kd / (2.2 * s) + vnoise(kd / (8 * s), 0, 72) * 3);
                const sheen = 0.45 + 0.75 * Math.pow(Math.max(0, -kv * 0.8 + 0.2 * ku), 1.5) * (0.6 + 0.4 * f / 0.6);
                alb = [0.42 * brushed * sheen, 0.43 * brushed * sheen, 0.44 * brushed * sheen]; spec = 0.9; gloss = 80; mat = 'alu';
                if (f > 0.56) { alb = [0.02, 0.02, 0.02]; spec = 0.2; } // the seat of the insert
              }
              // pointer line engraved in the bakelite, filled with worn white paint
              const pd = Math.abs(-kdx * Math.cos(kn.ang) - kdy * Math.sin(kn.ang)), along = kdx * Math.sin(kn.ang) - kdy * Math.cos(kn.ang);
              if (along > kn.rt * 0.64 && along < kn.rt * 0.93) { const cov = smooth(3.4 * s, 2.0 * s, pd); alb = alb.map((a0) => lerp(a0, 0.55, cov)); spec = lerp(spec, 0.15, cov); }
              z = kn.hk;
            } else {
              // skirt: sloping flange, fine knurl round its outer band, rounded rim
              const f = (kd - kn.rt) / (kn.rk - kn.rt);
              let tilt = 0.38 + 1.1 * Math.pow(smooth(0.8, 1.0, f), 1.4);
              const nfl = Math.round((TAU * kn.rk) / (7 * s));
              const fl = f > 0.55 ? Math.sin(pa * nfl) * 0.45 * smooth(0.55, 0.62, f) : 0;
              nx = ku * Math.sin(tilt) + tx * fl; ny = kv * Math.sin(tilt) + ty * fl; nz = Math.cos(tilt);
              alb = [0.028, 0.026, 0.025]; spec = 0.9; gloss = 40; mat = 'knob';
              if (f < 0.06) { alb = [0.006, 0.006, 0.006]; spec = 0.1; } // the step down from the cap
              z = kn.hk * (0.55 - 0.45 * f);
            }
          }
          // BNC connector
          {
            const bd = Math.hypot(px - bnc.x, py - bnc.y);
            if (bd < bnc.r + 8 * s) {
              const bu = (px - bnc.x) / (bd + 1e-9), bv = (py - bnc.y) / (bd + 1e-9);
              if (bd > bnc.r) { alb = alb.map((a) => a * (0.3 + 0.7 * smooth(bnc.r, bnc.r + 8 * s, bd))); }
              else if (bd > bnc.r * 0.55) {
                const f = (bd - bnc.r * 0.55) / (bnc.r * 0.45);
                const tilt = 0.15 + 1.1 * Math.pow(smooth(0.6, 1, f), 1.3) - 0.5 * Math.exp(-Math.pow((f - 0.25) / 0.08, 2));
                nx = bu * Math.sin(tilt); ny = bv * Math.sin(tilt); nz = Math.cos(tilt);
                alb = [0.5, 0.5, 0.49]; spec = 1.0; gloss = 90; mat = 'chrome';
              } else if (bd > bnc.r * 0.22) { alb = [0.035, 0.033, 0.03]; spec = 0.3; gloss = 30; nx = bu * 0.1; ny = bv * 0.1; nz = 1; mat = 'chrome'; }
              else if (bd > bnc.r * 0.1) { alb = [0.5, 0.44, 0.28]; spec = 0.8; gloss = 60; mat = 'chrome'; const tt = 0.6 * (bd / (bnc.r * 0.22)); nx = bu * tt; ny = bv * tt; nz = 1; }
              else { alb = [0.004, 0.004, 0.004]; spec = 0; mat = 'chrome'; }
              for (const sgn of [-1, 1]) {
                const sx = bnc.x + sgn * bnc.r * 0.8, sy = bnc.y, sd = Math.hypot(px - sx, py - sy);
                if (sd < 7.5 * s) { const tt = Math.min(0.95, sd / (7.5 * s)); nx = ((px - sx) / (sd + 1e-9)) * tt; ny = ((py - sy) / (sd + 1e-9)) * tt; nz = Math.sqrt(1 - tt * tt); alb = [0.55, 0.55, 0.53]; spec = 1.0; gloss = 90; mat = 'chrome'; }
              }
            }
          }
          // pilot lamp: chrome bezel ring, faceted amber jewel (emissive)
          {
            const pd = Math.hypot(px - pilot.x, py - pilot.y);
            if (pd < pilot.r + 13 * s) {
              const pu = (px - pilot.x) / (pd + 1e-9), pv = (py - pilot.y) / (pd + 1e-9);
              if (pd > pilot.r) {
                const f = (pd - pilot.r) / (13 * s), tilt = 1.0 * (1 - f) - 0.6 * f;
                nx = -pu * Math.sin(tilt); ny = -pv * Math.sin(tilt); nz = Math.cos(tilt);
                alb = [0.45, 0.45, 0.44]; spec = 0.9; gloss = 70; mat = 'chrome';
              } else {
                mat = 'jewel';
                alb = [0.0, 0.0, 0.0]; spec = 0.5; gloss = 90;
                const f = pd / pilot.r, pa2 = Math.atan2(pv, pu);
                const ringI = f < 0.38 ? 0 : f < 0.72 ? 1 : 2, sect = ringI === 0 ? 0 : Math.floor(((pa2 + Math.PI) / TAU) * (ringI === 1 ? 8 : 12) + (ringI === 1 ? 0.5 : 0));
                const facet = 0.6 + 0.4 * hash2(ringI, sect, 81);
                const edge = Math.abs(((pa2 + Math.PI) / TAU) * (ringI === 1 ? 8 : 12) - Math.round(((pa2 + Math.PI) / TAU) * (ringI === 1 ? 8 : 12)));
                const em = (0.30 * Math.exp(-f * f * 4.0) + 0.05) * facet * (1 - 0.7 * smooth(0.85, 1, f)) * (ringI ? 0.85 + 0.15 * smooth(0, 0.08, edge) : 1);
                stat[j] += em * 1.0 * om; stat[j + 1] += em * 0.36 * om; stat[j + 2] += em * 0.07 * om;
                const tilt = f * 0.7;
                nx = pu * Math.sin(tilt); ny = pv * Math.sin(tilt); nz = Math.cos(tilt);
              }
            }
          }
        }
        // ---------------- shading
        const nl = Math.hypot(nx, ny, nz); nx /= nl; ny /= nl; nz /= nl;
        // light from the glowing screen: comes from the screen's direction, low over the panel
        let lx = cx - px, ly = cy - py; const ld = Math.hypot(lx, ly) + 1e-6;
        const dEdge = Math.max(0, r - R);
        const elev = mat === 'lip' ? 0.2 : 0.38;
        lx /= ld; ly /= ld;
        let lz = elev; const lN = Math.hypot(lx, ly, lz); lx /= lN; ly /= lN; lz /= lN;
        const I = 1 / (1 + Math.pow(dEdge / (260 * s), 1.6)) + (mat === 'lip' ? 0.1 : 0);
        const ndl = Math.max(0, nx * lx + ny * ly + nz * lz);
        let hxv = lx, hyv = ly, hzv = lz + 1; const hl = Math.hypot(hxv, hyv, hzv); hxv /= hl; hyv /= hl; hzv /= hl;
        const ndh = Math.max(0, nx * hxv + ny * hyv + nz * hzv);
        const sp = spec * Math.pow(ndh, gloss) * (gloss + 8) / 60;
        // the room, lit by the screen: soft fill from the front, a little stronger toward the screen
        const amb = 0.035 * (0.35 + 0.65 * Math.max(0, nz)) * (0.3 + 0.7 / (1 + Math.pow(dEdge / (500 * s), 2)));
        const kL = 0.15; // screen light scale (per unit emission level)
        for (let c = 0; c < 3; c++) lit[j + c] += kL * PHOS[c] * (alb[c] * (ndl * I + amb) + sp * I) * om;
        // cool fill from the room (a window behind the camera) and the pilot lamp's warm pool
        const fill = 0.0065 * (0.4 + 0.6 * nz);
        stat[j] += alb[0] * fill * 0.7 * om; stat[j + 1] += alb[1] * fill * 0.85 * om; stat[j + 2] += alb[2] * fill * 1.2 * om;
        const pdx = pilot.x - px, pdy = pilot.y - py, pdd = Math.hypot(pdx, pdy);
        if (mat !== 'jewel') {
          const pz = 22 * s, pl = Math.hypot(pdx, pdy, pz);
          const pndl = Math.max(0, (nx * pdx + ny * pdy + nz * pz) / pl);
          const pI = 0.03 / (1 + Math.pow(pdd / (60 * s), 2));
          let phx = pdx / pl, phy = pdy / pl, phz = pz / pl + 1; const phl = Math.hypot(phx, phy, phz);
          const psp = spec * Math.pow(Math.max(0, (nx * phx + ny * phy + nz * phz) / phl), gloss) * (gloss + 8) / 60;
          for (let c = 0; c < 3; c++) stat[j + c] += AMBER[c] * pI * (alb[c] * pndl + psp) * om;
        }
        // pilot glow halo (in the lens)
        const ph = 1 / (1 + Math.pow(pdd / (16 * s), 2)) + 0.25 / (1 + Math.pow(pdd / (60 * s), 2));
        stat[j] += 0.0075 * ph * om; stat[j + 1] += 0.0026 * ph * om; stat[j + 2] += 0.0005 * ph * om;
      }
    }
    // LUT: u = x/(1+x) -> display value 0..255 (toe, shoulder, sRGB)
    const LN = 16384, lut = (this.lut = new Float32Array(LN + 1));
    for (let k = 0; k <= LN; k++) {
      const u = Math.min(k / LN, 0.99995), x = u / (1 - u);
      let v = (x * x) / (x + 0.0006); // toe: the deepest darks stay deep
      v = v < 0.72 ? v : 0.72 + 0.28 * (1 - Math.exp(-(v - 0.72) / 0.28));
      const sr = v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
      lut[k] = sr * 255;
    }
  };
})();
